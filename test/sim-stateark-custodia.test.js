// Pruebas de la simulación de StateArk (§6 custodia), copiadas del commit d6bc6bd de InTheState/stateark/sim; el repo de AGRAM es este.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { Custodia, RechazoCustodia, esquemaNoble, esquemaSimulado, verificarVinculo, Simulacion } from '../servidor/sim/stateark/index.js';
import { sha256Texto } from '../servidor/sim/stateark/hash.js';

const codigo = (c) => (e) => e instanceof RechazoCustodia && e.codigo === c;

// El repo de AGRAM en esta máquina: si está, las pruebas BIP-340 corren contra su noble y su propio verificador.
const AGRAM = process.env.AGRAM_SRC ?? fileURLToPath(new URL('../src', import.meta.url));
const hayAgram = existsSync(`${AGRAM}/vendor/noble-secp256k1.js`);
const deAgram = (f) => import(pathToFileURL(`${AGRAM}/${f}`).href);

test('crear claves: una raíz por clave, la privada no sale, dominios cerrados', async () => {
  const k = new Custodia();
  const a = await k.crearClave('agram', 'vg');
  const b = await k.crearClave('cartera', 'vg');
  assert.match(a.publica, /^[0-9a-f]{64}$/);
  assert.notEqual(a.publica, b.publica); // mismo nombre, otro dominio: otra clave
  assert.equal(JSON.stringify(k.listar()).includes('privada'), false);
  assert.deepEqual(Object.keys(a).sort(), ['dominio', 'nombre', 'publica']);
  await assert.rejects(k.crearClave('nostr', 'vg'), codigo('domain_unknown'));
  await assert.rejects(k.crearClave('agram', 'vg'), codigo('key_exists'));
  assert.throws(() => k.publica('agram', 'nadie'), codigo('key_unknown'));
  // Ni una sola función pública firma bytes sueltos.
  const metodos = Object.getOwnPropertyNames(Custodia.prototype);
  assert.equal(metodos.some((m) => /^firmar$|^sign$|^firmarBytes$/.test(m)), false);
});

test('firmarAgram recalcula el id y no firma si no cuadra', async () => {
  const k = new Custodia();
  await k.crearClave('agram', 'vg');
  const canonico = '{"autor":"vg","payload":"hola"}';
  const id = await sha256Texto(canonico);
  const f = await k.firmarAgram('vg', { canonico, id });
  assert.equal(f.firmante, k.publica('agram', 'vg'));
  assert.equal(await k.verificarAgram({ id, ...f }), true);
  const otro = await sha256Texto('otra cosa');
  await assert.rejects(k.firmarAgram('vg', { canonico, id: otro }), codigo('id_mismatch'));
  await assert.rejects(k.firmarAgram('vg', { canonico: '', id }), codigo('canonical_missing'));
  await assert.rejects(k.firmarAgram('vg', { canonico, id: 'corto' }), codigo('id_invalid'));
  // La clave de cartera no puede firmar eventos.
  await k.crearClave('cartera', 'w');
  await assert.rejects(k.firmarAgram('w', { canonico, id }), codigo('key_unknown'));
});

test('firmarAutorizacion sirve al §5: la cartera de la custodia es el titular que autoriza', async () => {
  const k = new Custodia();
  const sim = await Simulacion.crear({ verificarFirma: k.verificadorDeFirma() });
  const c = sim.carril;
  const { publica: titular } = await k.crearClave('cartera', 'casa');
  await c.crearCartera('casa', { titular });
  await c.acunar(await c.direccion('casa'), 100_000);
  await sim.minar();
  const ins = { schema: 'stateark.payment-instruction@1', rail: 'bitcoin.onchain', asset: 'BTC', amount: { valor: 10_000, unidad: 'sat' }, destino: { clase: 'bitcoin/address', valor: await c.direccion('casa') }, correlation_id: 'C6' };
  const plan = await c.preparar('casa', ins);
  const aut = await c.autorizar(plan, await k.firmarAutorizacion('casa', plan));
  await c.ejecutar('casa', ins, plan, aut);
  await assert.rejects(k.firmarAutorizacion('casa', { schema: 'otra cosa' }), codigo('not_a_plan'));
  // Una clave de AGRAM no autoriza pagos.
  await k.crearClave('agram', 'casa-id');
  await assert.rejects(k.firmarAutorizacion('casa-id', plan), codigo('key_unknown'));
});

test('vínculo AGRAM ↔ cartera: firmado por las dos, verificable sin la custodia, y no se puede tocar', async () => {
  const k = new Custodia();
  await k.crearClave('agram', 'vg');
  await k.crearClave('cartera', 'vg');
  const v = await k.vincular('vg', 'vg', { instante: '2026-11-12T12:00:00Z' });
  assert.equal(v.agram, k.publica('agram', 'vg'));
  assert.equal(v.cartera, k.publica('cartera', 'vg'));
  assert.deepEqual(await verificarVinculo(v), { ok: true, motivo: 'vinculadas', agram: v.agram, cartera: v.cartera, instante: v.instante });

  await k.crearClave('cartera', 'otra');
  const ajena = k.publica('cartera', 'otra');
  const casos = [
    [{ ...v, cartera: ajena }, /cartera no verifica|AGRAM no verifica/],
    [{ ...v, instante: '2030-01-01T00:00:00Z' }, /no verifica/],
    [{ ...v, firmas: { agram: v.firmas.cartera, cartera: v.firmas.agram } }, /no verifica/],
    [{ ...v, firmas: { agram: v.firmas.agram, cartera: '00'.repeat(32) } }, /cartera no verifica/],
    [{ ...v, firmas: { agram: v.firmas.agram } }, /cartera no verifica/],
    [{ ...v, uso: 'otro' }, /no es un vínculo/],
    [{ ...v, cartera: v.agram }, /dos claves distintas/],
  ];
  for (const [malo, motivo] of casos) {
    const r = await verificarVinculo(malo);
    assert.equal(r.ok, false);
    assert.match(r.motivo, motivo);
  }
});

test('esquema simulado: verifica lo suyo y rechaza lo ajeno', async () => {
  const priv = '11'.repeat(32);
  const pub = await esquemaSimulado.publica(priv);
  const m = await sha256Texto('m');
  const f = await esquemaSimulado.firmar(m, priv);
  assert.equal(await esquemaSimulado.verificar(f, m, pub), true);
  assert.equal(await esquemaSimulado.verificar(f, await sha256Texto('otro'), pub), false);
});

test('BIP-340 real con la noble de AGRAM: AGRAM verifica lo que firma la custodia', { skip: !hayAgram && 'no está el repo de AGRAM' }, async () => {
  const { schnorr } = await deAgram('vendor/noble-secp256k1.js');
  const { crearEvento, canonico, cuerpo, verificarId } = await deAgram('evento.js');
  const { verificar } = await deAgram('autoridad.js');
  const k = new Custodia({ esquema: esquemaNoble(schnorr) });
  const { publica } = await k.crearClave('agram', 'ana');

  const ev = await crearEvento({ autor: publica, sobre: 'g', t: '2026-11-12T10:00:00Z', movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: publica, a: null }], payload: 'hola' });
  const firmado = await k.firmarEvento('ana', ev, (e) => canonico(cuerpo(e)));
  assert.equal(firmado.firma.length, 128); // 64 bytes
  assert.equal(firmado.firmante, publica);
  assert.equal(await verificarId(firmado), true, 'la custodia no toca el evento');
  assert.equal(await verificar(firmado, publica), true, 'el verificador de AGRAM acepta la firma');
  assert.equal(await k.verificarAgram(firmado), true);

  // Un evento manipulado después de calcular su id no se firma.
  await assert.rejects(k.firmarEvento('ana', { ...ev, payload: 'adiós' }, (e) => canonico(cuerpo(e))), codigo('id_mismatch'));

  // Vínculo con BIP-340 real, y no vale con el esquema simulado.
  await k.crearClave('cartera', 'ana');
  const v = await k.vincular('ana', 'ana');
  assert.equal((await verificarVinculo(v, esquemaNoble(schnorr))).ok, true);
  assert.equal((await verificarVinculo(v)).ok, false);
});
