// Pruebas de la simulación de StateArk (§8 candado por hash), copiadas tal cual del commit d6bc6bd de InTheState/stateark/sim con las rutas adaptadas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulacion, firmaSimulada, mensajeAutorizacion, nuevoSecreto, hashDePreimagen, RechazoPago } from '../servidor/sim/stateark/index.js';
import { huella } from '../servidor/sim/stateark/canon.js';
import { sha256Texto } from '../servidor/sim/stateark/hash.js';

const INICIO = '2026-11-12T00:00:00.000Z';
const reloj = () => Date.parse(INICIO);

// Plaza por pago (contrato §8): la casa cobra con un candado H; la huésped paga; cobrar revela s;
// con s la huésped liberaría su E en AGRAM.
async function escenario() {
  const sim = await Simulacion.crear({ inicio: INICIO, reloj });
  const c = sim.carril;
  const casa = await sha256Texto('clave casa');
  const huesped = await sha256Texto('clave huesped');
  await c.crearCartera('casa', { titular: casa });
  await c.crearCartera('huesped', { titular: huesped });
  await c.acunar(await c.direccion('huesped'), 300_000);
  await sim.minar(); // altura 1
  const secreto = await nuevoSecreto(); // lo genera la casa; solo ella sabe s
  return { sim, c, casa, huesped, secreto };
}

async function pagarConCandado(ctx, { vence = 10, importe = 120_000 } = {}) {
  const cobra = await ctx.c.direccion('casa');
  const ins = {
    schema: 'stateark.payment-instruction@1', rail: 'bitcoin.onchain', asset: 'BTC',
    amount: { valor: importe, unidad: 'sat' },
    destino: { clase: 'htlc/sha256', valor: ctx.secreto.hash, cobra, vence },
    correlation_id: 'PLAZA-1',
  };
  const plan = await ctx.c.preparar('huesped', ins);
  const firma = await firmaSimulada(ctx.huesped, await mensajeAutorizacion(await huella(plan)));
  const aut = await ctx.c.autorizar(plan, { titular: ctx.huesped, firma });
  const recibo = await ctx.c.ejecutar('huesped', ins, plan, aut);
  return { ins, plan, recibo, cobra };
}

const codigo = (c) => (e) => e instanceof RechazoPago && e.codigo === c;

test('nuevoSecreto: hash = SHA-256 de los 32 bytes de la preimagen', async () => {
  const { preimagen, hash } = await nuevoSecreto();
  assert.match(preimagen, /^[0-9a-f]{64}$/);
  assert.equal(await hashDePreimagen(preimagen), hash);
});

test('intercambio completo: paga bajo H, la casa cobra revelando s, la huésped lee s; queda en firme', async () => {
  const ctx = await escenario();
  const { plan, recibo } = await pagarConCandado(ctx);
  assert.equal(plan.candado.hash, ctx.secreto.hash);
  assert.match(plan.destino, /^simhtlc1/);
  assert.equal(recibo.candado.vence, 10);
  await ctx.sim.minar(); // altura 2

  assert.equal(ctx.c.reciboCandado(ctx.secreto.hash).estado, 'pendiente');
  assert.equal(await ctx.c.preimagenDe(ctx.secreto.hash), null);

  await ctx.c.reclamar('casa', ctx.secreto.hash, ctx.secreto.preimagen);
  assert.equal(await ctx.c.preimagenDe(ctx.secreto.hash), null, 'sin bloque, la preimagen aún no cuenta');
  await ctx.sim.minar(); // altura 3

  const leida = await ctx.c.preimagenDe(ctx.secreto.hash);
  assert.equal(leida.preimagen, ctx.secreto.preimagen);
  assert.equal(leida.altura, 3);
  assert.ok(ctx.c.saldo('casa') > 119_000);

  const rc = ctx.c.reciboCandado(ctx.secreto.hash);
  assert.equal(rc.estado, 'cobrado');
  assert.equal(rc.preimagen, ctx.secreto.preimagen);
  assert.match(rc.en_firme, /^[0-9a-f]{64}:0$/);
  assert.deepEqual(await ctx.c.verificarCandado(rc), { ok: true, motivo: 'en firme', hash: ctx.secreto.hash, preimagen: ctx.secreto.preimagen, altura: 3 });
});

test('si la casa no cobra, al vencer la huésped recupera sus sats y no hay en firme', async () => {
  const ctx = await escenario();
  await pagarConCandado(ctx, { vence: 3 });
  await ctx.sim.minar(); // 2
  await assert.rejects(ctx.c.reembolsar('huesped', ctx.secreto.hash), codigo('not_expired'));
  await ctx.sim.minar(); // 3: el próximo bloque (4) ya pasa del vencimiento
  await assert.rejects(ctx.c.reclamar('casa', ctx.secreto.hash, ctx.secreto.preimagen), codigo('expired'));
  await ctx.c.reembolsar('huesped', ctx.secreto.hash);
  await ctx.sim.minar();
  const rc = ctx.c.reciboCandado(ctx.secreto.hash);
  assert.equal(rc.estado, 'reembolsado');
  assert.equal(rc.preimagen, null);
  assert.match((await ctx.c.verificarCandado(rc)).motivo, /reembolsado/);
  assert.equal(await ctx.c.preimagenDe(ctx.secreto.hash), null);
});

test('abrir el candado sin derecho se rechaza con su código', async () => {
  const ctx = await escenario();
  await pagarConCandado(ctx);
  await assert.rejects(ctx.c.reclamar('casa', ctx.secreto.hash, ctx.secreto.preimagen), codigo('htlc_unconfirmed'));
  await ctx.sim.minar();
  const otro = await nuevoSecreto();
  await assert.rejects(ctx.c.reclamar('casa', ctx.secreto.hash, otro.preimagen), codigo('preimage_invalid'));
  await assert.rejects(ctx.c.reclamar('casa', ctx.secreto.hash, 'no-hex'), codigo('preimage_invalid'));
  await assert.rejects(ctx.c.reclamar('huesped', ctx.secreto.hash, ctx.secreto.preimagen), codigo('input_not_owned'));
  await assert.rejects(ctx.c.reclamar('casa', otro.hash, otro.preimagen), codigo('htlc_unknown'));
  await assert.rejects(ctx.c.reembolsar('casa', ctx.secreto.hash), codigo('input_not_owned'));
  await ctx.c.reclamar('casa', ctx.secreto.hash, ctx.secreto.preimagen);
  await assert.rejects(ctx.c.reclamar('casa', ctx.secreto.hash, ctx.secreto.preimagen), codigo('input_spent'));
});

test('la orden con candado se valida: hash, cobrador y vencimiento futuro', async () => {
  const ctx = await escenario();
  const cobra = await ctx.c.direccion('casa');
  const base = {
    schema: 'stateark.payment-instruction@1', rail: 'bitcoin.onchain', asset: 'BTC',
    amount: { valor: 50_000, unidad: 'sat' }, correlation_id: 'X',
  };
  const malos = [
    { clase: 'htlc/sha256', valor: 'corto', cobra, vence: 10 },
    { clase: 'htlc/sha256', valor: ctx.secreto.hash, cobra: 'bc1real', vence: 10 },
    { clase: 'htlc/sha256', valor: ctx.secreto.hash, cobra, vence: 2 }, // la cadena va por 1: vencería en el próximo bloque
  ];
  for (const destino of malos) await assert.rejects(ctx.c.preparar('huesped', { ...base, destino }), codigo('destination_invalid'));
});

test('un reembolso con la s correcta pegada en el recibo no pasa por cobro', async () => {
  const ctx = await escenario();
  await pagarConCandado(ctx, { vence: 3 });
  await ctx.sim.minar();
  await ctx.sim.minar();
  await ctx.c.reembolsar('huesped', ctx.secreto.hash);
  await ctx.sim.minar();
  // La casa conocía s y la filtra, pero nunca cobró: no hay en firme.
  const falso = { ...ctx.c.reciboCandado(ctx.secreto.hash), preimagen: ctx.secreto.preimagen, estado: 'cobrado' };
  const v = await ctx.c.verificarCandado(falso);
  assert.equal(v.ok, false);
  assert.match(v.motivo, /no revela esa preimagen/);
});

test('verificarCandado rechaza recibos manipulados', async () => {
  const ctx = await escenario();
  await pagarConCandado(ctx);
  await ctx.sim.minar();
  await ctx.c.reclamar('casa', ctx.secreto.hash, ctx.secreto.preimagen);
  await ctx.sim.minar();
  const rc = ctx.c.reciboCandado(ctx.secreto.hash);
  const otro = await nuevoSecreto();
  const casos = [
    [{ ...rc, schema: 'x' }, /no es un recibo de candado/],
    [{ ...rc, preimagen: otro.preimagen }, /no es H/],
    [{ ...rc, hash: otro.hash, preimagen: otro.preimagen }, /no es de ese candado/],
    [{ ...rc, en_firme: `${rc.recibo.posicion.txid}:1` }, /no es la salida del candado/],
    [{ ...rc, recibo: { ...rc.recibo, importe_sat: 1 } }, /el pago:/],
  ];
  for (const [malo, motivo] of casos) {
    const v = await ctx.c.verificarCandado(malo);
    assert.equal(v.ok, false);
    assert.match(v.motivo, motivo);
  }
});
