// Copia de test/recibo-pago.test.js de stateark-sim (Core StateArk, commit 0ddd6e7: el recibo único «pago» con la transacción cruda), con las rutas adaptadas a este repo (servidor/sim/stateark/ y src/). La regla «paid» de la época, en test/verificado-regla.test.js.
// El recibo único de clase «pago» (stateark.recibo@1) con la transacción cruda de Bitcoin, leído con el código REAL
// de AGRAM (src/cripto.js: leerTx, leerCabecera, raizMerkle; src/btml.js), como lo comprobará la regla «paid» del
// SIP 0: la transacción está en el bloque (Merkle «bitcoin» hasta la raíz de la cabecera), la cabecera da el bloque
// afirmado y una salida paga «cuánto» al script «destino». Core AGRAM, 13-11.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { Simulacion, Custodia, decuplaDeRecibo, firmaSimulada, mensajeAutorizacion, verificarReciboComun, camposDeRecibo } from '../servidor/sim/stateark/index.js';
import { huella } from '../servidor/sim/stateark/canon.js';
import { sha256Texto } from '../servidor/sim/stateark/hash.js';

const AGRAM = process.env.AGRAM_SRC ?? fileURLToPath(new URL('../src', import.meta.url));
const hayAgram = existsSync(`${AGRAM}/cripto.js`);
const INICIO = '2026-11-12T00:00:00.000Z';
const reloj = () => Date.parse(INICIO);

const orden = (destino, extra = {}) => ({
  schema: 'stateark.payment-instruction@1', rail: 'bitcoin.onchain', asset: 'BTC',
  amount: { valor: 61_000, unidad: 'sat' }, destino,
  vencimiento: { marca: 'valido_hasta', valor: 50, fuente: 'consenso', unidad: 'bitcoin_block_height' },
  on_timeout: 'caducado', correlation_id: 'AGRAM-R3', ...extra,
});

async function pagar(c, nombre, titular, ins) {
  const plan = await c.preparar(nombre, ins);
  const firma = await firmaSimulada(titular, await mensajeAutorizacion(await huella(plan)));
  const aut = await c.autorizar(plan, { titular, firma });
  return c.ejecutar(nombre, ins, plan, aut);
}

async function escenario(pagosEnElBloque) {
  const sim = await Simulacion.crear({ inicio: INICIO, reloj });
  const c = sim.carril;
  const vg = await sha256Texto('clave vg');
  await c.crearCartera('vg', { titular: vg });
  await c.crearCartera('aina', { titular: await sha256Texto('clave aina') });
  for (let k = 0; k < pagosEnElBloque; k++) await c.acunar(await c.direccion('vg'), 200_000);
  await sim.minar();
  const recibos = [];
  for (let k = 0; k < pagosEnElBloque; k++) {
    const extra = k === 0 ? { puntero: await sha256Texto('el registro de AGRAM') } : {};
    recibos.push(await pagar(c, 'vg', vg, orden({ clase: 'bitcoin/address', valor: await c.direccion('aina') }, extra)));
  }
  await sim.minar();
  return { sim, c, txid: recibos[0].posicion.txid };
}

/** Lo que comprueba «paid», escrito con las primitivas de AGRAM sobre la décupla del recibo. */
async function paid(d) {
  const { leerTx, leerCabecera, raizMerkle, deHex, aHex } = await import(pathToFileURL(`${AGRAM}/cripto.js`).href);
  const valor = (k) => d[3][d[2].indexOf(k)];
  const tx = leerTx(deHex(d[4][0][0]));
  const cab = leerCabecera(deHex(d[4][1][0]));
  const lados = d[4][2] ?? [];
  const hermanos = (d[4][3] ?? []).map(deHex);
  const enElBloque = aHex(raizMerkle(tx.txid, lados.map((l, i) => [l, hermanos[i]]), 'bitcoin')) === aHex(cab.raiz);
  const bloque = aHex(cab.hash) === valor('bloque');
  const sats = Number(valor('cuánto').split(' ')[0]);
  const paga = tx.salidas.some((s) => Number(s.sats) === sats && aHex(s.script) === valor('destino'));
  return { enElBloque, bloque, paga, txid: aHex(tx.txid) };
}

test('el recibo «pago»: décupla BTML válida según AGRAM, con la evidencia como décupla, firmado y verificable', { skip: !hayAgram && 'no está el repo de AGRAM' }, async () => {
  const { validarPayload, esDecupla } = await import(pathToFileURL(`${AGRAM}/btml.js`).href);
  for (const n of [1, 3]) {
    const { c, txid } = await escenario(n);
    const campos = await c.reciboPago(txid);
    const custodia = new Custodia();
    await custodia.crearClave('nostr', 'carril');
    const r = await custodia.firmarRecibo('carril', campos, { t: INICIO });
    assert.equal((await verificarReciboComun(r)).ok, true);
    const d = r.recibo;
    assert.deepEqual(validarPayload(d), { ok: true, errores: [] }, `n=${n}`);
    assert.deepEqual(d[0], ['recibo', 'pago']);
    assert.deepEqual(d[1], [txid]);
    assert.deepEqual(d[2].slice(0, 5), ['destino', 'bloque', 'altura', 'orden', 'universo']);
    assert.ok(d[2].includes('cuánto') && d[2].includes('no afirma'));
    assert.equal(esDecupla(d[4]), true, 'la evidencia es una décupla: 4.0, 4.1… se pueden leer');
    assert.equal(d[4].length, n === 1 ? 2 : 4, 'sin camino «bitcoin» si la transacción está sola en su bloque');
    assert.equal(camposDeRecibo(d).cuanto[0], '61000');
  }
});

test('«paid» con las primitivas de AGRAM: la transacción cruda da el txid, está en el bloque y paga cuánto al destino', { skip: !hayAgram && 'no está el repo de AGRAM' }, async () => {
  for (const n of [1, 2, 3]) {
    const { c, txid } = await escenario(n);
    const campos = await c.reciboPago(txid);
    const dec = decuplaDeRecibo(campos);
    const p = await paid(dec);
    assert.equal(p.txid, txid, 'el txid que lee AGRAM es el del carril (orden interno)');
    assert.deepEqual([p.enElBloque, p.bloque, p.paga], [true, true, true], `n=${n}`);
    // Manipulaciones: otro importe, otro destino, otro bloque, otro hermano: falso.
    const otra = (k, v) => { const x = structuredClone(dec); x[3][x[2].indexOf(k)] = v; return x; };
    assert.equal((await paid(otra('cuánto', '61001 sat'))).paga, false);
    assert.equal((await paid(otra('destino', '0014' + '00'.repeat(20)))).paga, false);
    assert.equal((await paid(otra('bloque', '00'.repeat(32)))).bloque, false);
    if (dec[4][3]) {
      const x = structuredClone(dec);
      x[4][3][0] = '11'.repeat(32);
      assert.equal((await paid(x)).enElBloque, false);
    }
  }
});

test('el puntero a AGRAM va como OP_RETURN en la transacción cruda, y el pago aún sin bloque no tiene recibo «pago»', { skip: !hayAgram && 'no está el repo de AGRAM' }, async () => {
  const { leerTx, deHex, aHex } = await import(pathToFileURL(`${AGRAM}/cripto.js`).href);
  const { c, txid } = await escenario(1);
  const campos = await c.reciboPago(txid);
  const tx = leerTx(deHex(campos.evidencia[0][0]));
  const puntero = new TextEncoder().encode('agram:' + (await sha256Texto('el registro de AGRAM')));
  const op = tx.salidas.find((s) => s.script[0] === 0x6a);
  assert.equal(aHex(op.script), '6a46' + aHex(puntero));
  assert.equal(Number(op.sats), 0);
  // Un pago nuevo (con la vuelta del anterior), aún sin minar: su recibo «pago» no tiene evidencia todavía.
  const vg = await sha256Texto('clave vg');
  const r = await pagar(c, 'vg', vg, orden({ clase: 'bitcoin/address', valor: await c.direccion('aina') }));
  await assert.rejects(c.reciboPago(r.posicion.txid), /unconfirmed/);
  assert.equal(await c.reciboPago('ab'.repeat(32)), null);
});
