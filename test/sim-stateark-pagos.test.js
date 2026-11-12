// Pruebas de la simulación de StateArk (§5 pagos), copiadas tal cual del commit 0ddd6e7 de InTheState/stateark/sim con las rutas adaptadas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulacion, firmaSimulada, mensajeAutorizacion, RechazoPago } from '../servidor/sim/stateark/index.js';
import { huella } from '../servidor/sim/stateark/canon.js';
import { sha256Texto } from '../servidor/sim/stateark/hash.js';

const INICIO = '2026-11-12T00:00:00.000Z';
const reloj = () => Date.parse(INICIO);
const clave = (s) => sha256Texto(`clave ${s}`);

async function escenario() {
  const sim = await Simulacion.crear({ inicio: INICIO, reloj });
  const c = sim.carril;
  const vg = await clave('vg');
  const aina = await clave('aina');
  await c.crearCartera('vg', { titular: vg });
  await c.crearCartera('aina', { titular: aina });
  await c.acunar(await c.direccion('vg'), 805_883);
  await c.acunar(await c.direccion('vg'), 100_000);
  await sim.minar();
  return { sim, c, vg, aina };
}

const orden = (destino, extra = {}) => ({
  schema: 'stateark.payment-instruction@1',
  rail: 'bitcoin.onchain',
  asset: 'BTC',
  amount: { valor: 61_000, unidad: 'sat' },
  destino,
  vencimiento: { marca: 'valido_hasta', valor: 50, fuente: 'consenso', unidad: 'bitcoin_block_height' },
  on_timeout: 'caducado',
  correlation_id: 'AGRAM-R3',
  originador_ref: 'ref:agram/actor',
  proposito_ref: 'ref:agram/asunto',
  ...extra,
});

async function firmar(plan, titular) {
  return { titular, firma: await firmaSimulada(titular, await mensajeAutorizacion(await huella(plan))) };
}

async function pagar(ctx, ins, nombre = 'vg') {
  const plan = await ctx.c.preparar(nombre, ins);
  const aut = await ctx.c.autorizar(plan, await firmar(plan, ctx[nombre]));
  return { plan, aut, recibo: await ctx.c.ejecutar(nombre, ins, plan, aut) };
}

test('recorrido completo: orden → plan → autorización → recibo pendiente → bloque → recibo verificado', async () => {
  const ctx = await escenario();
  const destino = await ctx.c.direccion('aina');
  const ins = orden({ clase: 'bitcoin/address', valor: destino });
  const { plan, aut, recibo } = await pagar(ctx, ins);

  assert.equal(plan.importe_sat, 61_000);
  assert.equal(plan.entradas.length, 1);
  assert.equal(plan.entradas[0].sat, 805_883); // de mayor a menor
  assert.equal(plan.importe_sat + plan.comision_sat + plan.cambio_sat, 805_883);
  assert.match(plan.cambio_origen, /^cambio\/\d+$/);
  assert.equal(aut.uso, 'StateArk/App/PaymentAuthorization/v1');

  assert.equal(recibo.posicion.altura_del_bloque, null);
  assert.equal((await ctx.c.verificarRecibo(recibo)).motivo, 'pendiente: la transacción aún no está en un bloque');

  const b = await ctx.sim.minar();
  assert.equal(b.pagos, 1);
  const r = ctx.c.recibo(recibo.posicion.txid);
  assert.equal(r.posicion.altura_del_bloque, b.altura);
  assert.equal(r.posicion.confirmaciones, 1);
  assert.equal(r.instruccion.correlacion, 'AGRAM-R3');
  assert.equal(r.instruccion.proposito_ref, 'ref:agram/asunto');
  assert.ok(r.alcance.some((a) => a.startsWith('NO afirma que el pago cumpla una E')));
  const v = await ctx.c.verificarRecibo(r);
  assert.equal(v.ok, true);
  assert.equal(v.motivo, 'pagado');
  assert.equal(ctx.c.saldo('aina'), 61_000);
});

test('el puntero a un evento de AGRAM viaja en la transacción y se comprueba', async () => {
  const ctx = await escenario();
  const id = await sha256Texto('evento de AGRAM');
  const ins = orden({ clase: 'bitcoin/address', valor: await ctx.c.direccion('aina') }, { puntero: id });
  const { recibo } = await pagar(ctx, ins);
  await ctx.sim.minar();
  const tx = ctx.c.transaccion(recibo.posicion.txid);
  assert.ok(tx.salidas.some((s) => s.op_return === `agram:${id}`));
  const r = ctx.c.recibo(recibo.posicion.txid);
  assert.equal(r.puntero, id);
  assert.equal((await ctx.c.verificarRecibo(r)).ok, true);
  const otro = await sha256Texto('otro evento');
  assert.match((await ctx.c.verificarRecibo({ ...r, puntero: otro })).motivo, /no lleva ese puntero/);
});

test('fondos en sats de una serie de E: se prueban, no se gastan como saldo y se ven gastados', async () => {
  const ctx = await escenario();
  const serie = 'E:vg/cama-2@2026-11-13';
  const ins = orden({ clase: 'agram/serie', valor: serie }, { amount: { valor: 200_000, unidad: 'sat' } });
  const { recibo } = await pagar(ctx, ins);
  await ctx.sim.minar();
  const r = ctx.c.recibo(recibo.posicion.txid);
  const f = await ctx.c.verificarFondos(serie, r);
  assert.deepEqual([f.ok, f.motivo, f.sat], [true, 'con fondos en sats', 200_000]);
  assert.equal(await ctx.c.fondosDeSerie('vg', serie), 200_000);
  assert.equal((await ctx.c.verificarFondos('E:vg/otra', r)).ok, false);
  // Los fondos de la serie no cuentan como saldo gastable ni entran en un plan normal.
  const saldo = ctx.c.saldo('vg');
  assert.ok(saldo < 805_883 + 100_000 - 200_000);
  const plan = await ctx.c.preparar('vg', orden({ clase: 'bitcoin/address', valor: await ctx.c.direccion('aina') }, { amount: { valor: 1_000, unidad: 'sat' } }));
  assert.ok(plan.entradas.every((e) => e.sat !== 200_000));
  // Si alguien gasta la salida de la serie, la prueba de fondos cae.
  const vout = ctx.c.transaccion(r.posicion.txid).salidas.findIndex((s) => s.direccion === r.destino);
  ctx.c.monedas.get(`${r.posicion.txid}:${vout}`).gastada_por = 'canje-simulado';
  assert.match((await ctx.c.verificarFondos(serie, r)).motivo, /se gastaron/);
});

test('cada orden mal formada se rechaza con su código fijo', async () => {
  const ctx = await escenario();
  const dir = await ctx.c.direccion('aina');
  const base = orden({ clase: 'bitcoin/address', valor: dir });
  const casos = [
    [{ ...base, schema: 'otra@1' }, 'schema_unknown'],
    [{ ...base, rail: 'lightning' }, 'rail_unknown'],
    [{ ...base, asset: 'EUR' }, 'asset_unknown'],
    [{ ...base, amount: { valor: 1, unidad: 'btc' } }, 'amount_unit_invalid'],
    [{ ...base, amount: { valor: 1.5, unidad: 'sat' } }, 'amount_invalid'],
    [{ ...base, amount: { valor: 100, unidad: 'sat' } }, 'amount_invalid'],
    [{ ...base, destino: { clase: 'iban', valor: 'ES00' } }, 'destination_kind_unknown'],
    [{ ...base, destino: { clase: 'bitcoin/address', valor: 'bc1qreal' } }, 'destination_invalid'],
    [{ ...base, vencimiento: { ...base.vencimiento, unidad: 'segundos' } }, 'vencimiento_unit_invalid'],
    [{ ...base, vencimiento: { ...base.vencimiento, fuente: 'reloj' } }, 'vencimiento_source_invalid'],
    [{ ...base, vencimiento: { ...base.vencimiento, marca: 'desde' } }, 'vencimiento_mark_invalid'],
    [{ ...base, vencimiento: { ...base.vencimiento, valor: 1 } }, 'expired'],
    [{ ...base, on_timeout: 'reintentar' }, 'on_timeout_unknown'],
    [{ ...base, correlation_id: '' }, 'correlation_missing'],
    [{ ...base, puntero: 'no-es-id' }, 'pointer_invalid'],
    [{ ...base, amount: { valor: 10_000_000, unidad: 'sat' } }, 'insufficient_funds'],
  ];
  for (const [ins, codigo] of casos) {
    await assert.rejects(ctx.c.preparar('vg', ins), (e) => e instanceof RechazoPago && e.codigo === codigo, codigo);
  }
});

test('autorizar y ejecutar: la autorización no vale para otro plan, ni la firma de otro, ni tocar el plan', async () => {
  const ctx = await escenario();
  const dir = await ctx.c.direccion('aina');
  const ins = orden({ clase: 'bitcoin/address', valor: dir });
  const plan = await ctx.c.preparar('vg', ins);
  const aut = await ctx.c.autorizar(plan, await firmar(plan, ctx.vg));
  const codigo = (c) => (e) => e instanceof RechazoPago && e.codigo === c;

  // Firma que no verifica.
  await assert.rejects(ctx.c.autorizar(plan, { titular: ctx.vg, firma: '00'.repeat(32) }), codigo('signature_invalid'));
  // Autorización firmada por otro titular: verifica, pero no es el de la cartera.
  const ajena = await ctx.c.autorizar(plan, await firmar(plan, ctx.aina));
  await assert.rejects(ctx.c.ejecutar('vg', ins, plan, ajena), codigo('authorization_not_holder'));
  // Mover mil sat de la vuelta al destino: cuadra, y no se firma (como en la ronda 3).
  const tocado = { ...plan, importe_sat: plan.importe_sat + 1000, cambio_sat: plan.cambio_sat - 1000 };
  await assert.rejects(ctx.c.ejecutar('vg', ins, tocado, aut), codigo('authorization_mismatch'));
  // La autorización de este plan no vale para otra orden.
  const otra = { ...ins, correlation_id: 'OTRA' };
  await assert.rejects(ctx.c.ejecutar('vg', otra, plan, aut), codigo('plan_mismatch'));
  // Ejecutar desde la cartera de otro.
  await assert.rejects(ctx.c.ejecutar('aina', ins, plan, aut), codigo('authorization_not_holder'));
});

test('reejecutar el mismo plan con la misma autorización da la misma transacción y no gasta dos veces', async () => {
  const ctx = await escenario();
  const ins = orden({ clase: 'bitcoin/address', valor: await ctx.c.direccion('aina') });
  const { plan, aut, recibo } = await pagar(ctx, ins);
  const otra = await ctx.c.ejecutar('vg', ins, plan, aut);
  assert.equal(otra.posicion.txid, recibo.posicion.txid);
  assert.equal(ctx.c.pendientes.length, 1);
  await ctx.sim.minar();
  assert.equal(ctx.c.saldo('aina'), 61_000);
});

test('un segundo plan sobre las mismas monedas ya gastadas se rechaza', async () => {
  const ctx = await escenario();
  const ins = orden({ clase: 'bitcoin/address', valor: await ctx.c.direccion('aina') });
  const plan1 = await ctx.c.preparar('vg', ins);
  const plan2 = await ctx.c.preparar('vg', { ...ins, correlation_id: 'B' }); // mismas monedas: preparar no reserva
  await ctx.c.ejecutar('vg', ins, plan1, await ctx.c.autorizar(plan1, await firmar(plan1, ctx.vg)));
  const aut2 = await ctx.c.autorizar(plan2, await firmar(plan2, ctx.vg));
  await assert.rejects(ctx.c.ejecutar('vg', { ...ins, correlation_id: 'B' }, plan2, aut2), (e) => e.codigo === 'input_spent');
});

test('una orden caduca si el pago entraría por encima de su altura', async () => {
  const ctx = await escenario(); // altura 1
  const ins = orden({ clase: 'bitcoin/address', valor: await ctx.c.direccion('aina') }, {
    vencimiento: { marca: 'valido_hasta', valor: 2, fuente: 'consenso', unidad: 'bitcoin_block_height' },
  });
  const plan = await ctx.c.preparar('vg', ins); // entraría en la 2: vale
  const aut = await ctx.c.autorizar(plan, await firmar(plan, ctx.vg));
  await ctx.sim.minar(); // la cadena va por la 2: el pago entraría en la 3
  await assert.rejects(ctx.c.ejecutar('vg', ins, plan, aut), (e) => e.codigo === 'expired');
});

test('verificarRecibo rechaza recibos manipulados, de otro universo o sin confirmaciones suficientes', async () => {
  const ctx = await escenario();
  const { recibo } = await pagar(ctx, orden({ clase: 'bitcoin/address', valor: await ctx.c.direccion('aina') }));
  await ctx.sim.minar();
  const r = ctx.c.recibo(recibo.posicion.txid);
  const otroDestino = await ctx.c.direccion('aina');
  const casos = [
    [{ ...r, importe_sat: r.importe_sat + 1 }, /ninguna salida paga/],
    [{ ...r, destino: otroDestino }, /ninguna salida paga/],
    [{ ...r, universe: 'Bitcoin mainnet' }, /otro universo/],
    [{ ...r, schema: 'x' }, /no es un recibo/],
    [{ ...r, posicion: { ...r.posicion, txid: 'f'.repeat(64) } }, /no está en la cadena/],
    [{ ...r, comision_sat: r.comision_sat - 1 }, /no cuadra/],
    [{ ...r, entradas: [] }, /no son las declaradas/],
  ];
  for (const [malo, motivo] of casos) {
    const v = await ctx.c.verificarRecibo(malo);
    assert.equal(v.ok, false);
    assert.match(v.motivo, motivo);
  }
  assert.match((await ctx.c.verificarRecibo(r, { confirmaciones: 6 })).motivo, /1 confirmaciones de 6/);
  for (let k = 0; k < 5; k++) await ctx.sim.minar();
  assert.equal((await ctx.c.verificarRecibo(r, { confirmaciones: 6 })).ok, true);
});

test('§3 y §5 comparten bloque: un lote sellado y un pago entran en el mismo', async () => {
  const ctx = await escenario();
  const id = await sha256Texto('evento sellado');
  await ctx.sim.sellador.sellar([id]);
  const { recibo } = await pagar(ctx, orden({ clase: 'bitcoin/address', valor: await ctx.c.direccion('aina') }));
  const b = await ctx.sim.minar();
  assert.equal(ctx.sim.sellador.prueba(id).altura, b.altura);
  assert.equal(ctx.c.recibo(recibo.posicion.txid).posicion.altura_del_bloque, b.altura);
  assert.equal((await ctx.sim.sellador.verificar(id, ctx.sim.sellador.prueba(id))).ok, true);
});

test('el verificador de firma se puede inyectar (AGRAM puede pasar BIP-340 real)', async () => {
  const llamadas = [];
  const sim = await Simulacion.crear({ inicio: INICIO, reloj, verificarFirma: async (f, m, t) => { llamadas.push([f, m, t]); return f === 'firma-buena'; } });
  const c = sim.carril;
  const t = await clave('t');
  await c.crearCartera('t', { titular: t });
  await c.acunar(await c.direccion('t'), 50_000);
  await sim.minar();
  const plan = await c.preparar('t', orden({ clase: 'bitcoin/address', valor: await c.direccion('t') }, { amount: { valor: 10_000, unidad: 'sat' } }));
  await assert.rejects(c.autorizar(plan, { titular: t, firma: 'mala' }), (e) => e.codigo === 'signature_invalid');
  const aut = await c.autorizar(plan, { titular: t, firma: 'firma-buena' });
  assert.equal(llamadas.at(-1)[1], await mensajeAutorizacion(await huella(plan)));
  assert.equal(aut.firma, 'firma-buena');
});
