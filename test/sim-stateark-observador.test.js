// Copia de test/observador.test.js de stateark-sim (Core StateArk, commit 9be12c3), con las rutas adaptadas a este repo (servidor/sim/stateark/ y src/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { Sellador, Custodia, esquemaNoble, selloComoDecupla, leerCabecera, aplicarOts, alturaLe, verificarObservacion } from '../servidor/sim/stateark/index.js';
import { OBJETIVO, comoNumero } from '../servidor/sim/stateark/cadena.js';
import { sha256Texto, sha256d } from '../servidor/sim/stateark/hash.js';

const AGRAM = process.env.AGRAM_SRC ?? fileURLToPath(new URL('../src', import.meta.url));
const hayAgram = existsSync(`${AGRAM}/btml.js`);
const INICIO = '2026-11-12T00:00:00.000Z';
const reloj = () => Date.parse(INICIO);

async function sellado(n = 1, otrosLotes = 0) {
  const s = await Sellador.crear({ inicio: INICIO, reloj });
  const ids = await Promise.all(Array.from({ length: n }, (_, k) => sha256Texto(`evento ${k}`)));
  await s.sellar(ids);
  for (let j = 0; j < otrosLotes; j++) await s.sellar([await sha256Texto(`otro lote ${j}`)]);
  await s.minar();
  return { s, ids, p: s.prueba(ids[0]) };
}

test('la prueba trae la cabecera de 80 bytes, cuyo doble SHA-256 es el hash del bloque, con prueba de trabajo de regtest', async () => {
  const { p } = await sellado();
  assert.match(p.prueba.cabecera, /^[0-9a-f]{160}$/);
  const c = await leerCabecera(p.prueba.cabecera);
  assert.equal(c.hash, p.hash);
  assert.equal(await sha256d(p.prueba.cabecera), p.hash);
  assert.equal(c.bits, 0x207fffff);
  assert.ok(comoNumero(p.hash) <= OBJETIVO);
  assert.equal(c.hora, Date.parse(p.instante) / 1000);
});

test('los pasos OTS llevan la raíz del lote a la raíz de Merkle de la cabecera (también con varios lotes en el bloque)', async () => {
  for (const otros of [0, 1, 2, 4]) {
    const { p } = await sellado(3, otros);
    const c = await leerCabecera(p.prueba.cabecera);
    assert.equal(await aplicarOts(p.lote, p.prueba.pasos), c.raiz, `con ${otros} lotes más`);
    if (otros === 0) assert.deepEqual(p.prueba.pasos, []); // un solo compromiso: la raíz es él
    else assert.ok(p.prueba.pasos.some(([op]) => op === 'append' || op === 'prepend'));
  }
});

test('el observador firmó la cabecera a esa altura, y verificar lo comprueba', async () => {
  const { s, ids, p } = await sellado(2, 1);
  assert.equal(p.prueba.observador.clave, s.claveObservador);
  assert.equal(p.prueba.observador.altura_le, alturaLe(p.altura));
  assert.equal(await verificarObservacion({ cabecera: p.prueba.cabecera, ...p.prueba.observador }), true);
  assert.equal((await s.verificar(ids[0], p)).ok, true);
});

test('verificar rechaza cada manipulación de la cabecera, los pasos o el observador', async () => {
  const { s, ids, p } = await sellado(2, 1);
  const copia = () => structuredClone(p);
  const otraClave = (await (async () => { const k = new Custodia(); return (await k.crearClave('nostr', 'x')).publica; })());
  const casos = [
    [(() => { const c = copia(); c.prueba.cabecera = c.prueba.cabecera.slice(0, 158) + (c.prueba.cabecera.endsWith('00') ? '01' : '00'); return c; })(), /cabecera no da el hash/],
    [(() => { const c = copia(); c.prueba.cabecera = 'ab'; return c; })(), /80 bytes/],
    [(() => { const c = copia(); c.prueba.pasos = [...c.prueba.pasos, ['sha256']]; return c; })(), /pasos OTS/],
    [(() => { const c = copia(); c.prueba.pasos = [['triturar', 'aa']]; return c; })(), /pasos OTS/],
    [(() => { const c = copia(); c.prueba.observador.altura_le = alturaLe(p.altura + 1); return c; })(), /altura firmada/],
    [(() => { const c = copia(); c.prueba.observador.clave = otraClave; return c; })(), /no está entre los declarados/],
    [(() => { const c = copia(); c.prueba.observador.firma = '00'.repeat(32); return c; })(), /firma del observador/],
  ];
  for (const [malo, motivo] of casos) {
    const v = await s.verificar(ids[0], malo);
    assert.equal(v.ok, false);
    assert.match(v.motivo, motivo);
  }
});

test('un sellador que declara otros observadores no acepta el suyo', async () => {
  const s = await Sellador.crear({ inicio: INICIO, reloj, observadores: [await sha256Texto('otro observador')] });
  const id = await sha256Texto('e');
  await s.sellar([id]);
  await s.minar();
  assert.match((await s.verificar(id, s.prueba(id))).motivo, /no está entre los declarados/);
});

test('la décupla del sello es BTML válido según AGRAM (sin huecos, sin relleno y sin tuplas: 7 lo observado, 8 y 9 lados y hermanos si los hay)', { skip: !hayAgram && 'no está el repo de AGRAM' }, async () => {
  const { validarPayload } = await import(pathToFileURL(`${AGRAM}/btml.js`).href);
  for (const [n, otros] of [[1, 0], [3, 2]]) {
    const { ids, p } = await sellado(n, otros);
    const d = selloComoDecupla(p, ids[0]);
    assert.deepEqual(validarPayload(d), { ok: true, errores: [] }, `n=${n}, otros=${otros}`);
    assert.equal(d[1], p.altura);
    assert.equal(d[4], ids[0]);
    assert.equal(d[7][0], p.prueba.cabecera);
    assert.equal(d[7][2], alturaLe(p.altura));
    assert.equal(d[7][3], p.prueba.observador.clave);
    assert.equal(d.length, n === 1 ? 8 : 10); // un lote de un solo id no tiene camino
    assert.equal(d[7].length, otros === 0 ? 4 : 6); // un solo compromiso en el bloque: sin camino «bitcoin»
    if (n > 1) assert.equal(d[8].length, d[9].length); // lados y hermanos en paralelo
    // Ninguna tupla: los caminos son listas de hojas.
    const tieneTuplas = (x) => Array.isArray(x) && x.some((e) => Array.isArray(e) && e.length === 2 && ['i', 'd'].includes(e[0]) && /^[0-9a-f]{64}$/.test(e[1]));
    assert.equal([d[7], d[8] ?? [], d[9] ?? []].some(tieneTuplas), false);
  }
});

test('observador con BIP-340 real (noble de AGRAM)', { skip: !hayAgram && 'no está el repo de AGRAM' }, async () => {
  const { schnorr } = await import(pathToFileURL(`${AGRAM}/vendor/noble-secp256k1.js`).href);
  const esquema = esquemaNoble(schnorr);
  const custodia = new Custodia({ esquema });
  await custodia.crearClave('nostr', 'stateark');
  const s = await Sellador.crear({ inicio: INICIO, reloj, observador: { custodia, nombre: 'stateark' } });
  const id = await sha256Texto('evento real');
  await s.sellar([id]);
  await s.minar();
  const p = s.prueba(id);
  assert.equal(p.prueba.observador.firma.length, 128);
  assert.equal(await verificarObservacion({ cabecera: p.prueba.cabecera, ...p.prueba.observador }, { esquema }), true);
  assert.equal((await s.verificar(id, p)).ok, true);
});
