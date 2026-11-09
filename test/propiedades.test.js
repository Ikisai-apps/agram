// Pruebas de propiedades del núcleo: casos generados con un PRNG con semilla
// fija (mulberry32), pocos cientos por propiedad, y cada fallo real que
// encontró el fuzz como regresión. Lo que exige una decisión queda en
// { skip: '<id>: motivo' }, como en las pruebas de conformidad: el id es el de
// la regla del corpus que toca y el motivo lleva «[X] decidir VG» y lo que
// pasa hoy. El fuzz largo (miles de casos) vive fuera del repo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarPayload, esReferencia, esTerminal, esLista, direccion, indicesDe, resolver, esDireccion, ARIDAD } from '../src/btml.js';
import { crearEvento, canonico, cuerpo, verificarId, validarForma } from '../src/evento.js';
import { claveToken, cantidadBase } from '../src/tokens.js';
import { Eje } from '../src/eje.js';
import * as E from '../src/encaje.js';
import * as B from '../src/bql.js';
import * as motor from '../src/motor.js';
import { serializar, restaurar } from '../src/persistencia.js';
import { escribirDesde, costeT } from '../src/escritura.js';
import { cabeTope } from '../src/modos.js';
import { generarClaves, verificar } from '../src/autoridad.js';
import { entrarPorInvitacion } from '../ejemplos/ikisai/altas.mjs';

const SEMILLA = 20261107;
const T0 = '2026-11-07T00:00:00Z';

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function prng(semilla) {
  const r = mulberry32(semilla);
  return { r, int: (a, b) => a + Math.floor(r() * (b - a + 1)), pick: (xs) => xs[Math.floor(r() * xs.length)], si: (p = 0.5) => r() < p };
}
const hex = (g, n = 64) => Array.from({ length: n }, () => '0123456789abcdef'[g.int(0, 15)]).join('');
const gastaT = (de, cantidad = 1) => ({ token: 'T', escala: 'minuto', cantidad, de, a: null });
const ida = (eje) => JSON.parse(JSON.stringify(serializar(eje)));
const fotoSaldos = (eje) => JSON.stringify([...eje.saldos].map(([k, v]) => [k, [...v]]));
const foto = (eje) => JSON.stringify({ orden: eje.orden, saldos: fotoSaldos(eje), claves: [...eje.claves], series: eje.series(), personas: eje.identidades().map((i) => eje.esPersona(i)) });

// ---------- BTML ----------

/** Oráculo independiente de validarPayload: terminal o array 1–10 sin huecos; referencia = exactamente {ref, dir?} propias. */
function oraculo(x, ancestros = []) {
  if (typeof x === 'number') return Number.isFinite(x);
  if (typeof x === 'string') return x.length > 0;
  if (Array.isArray(x)) {
    if (ancestros.includes(x) || x.length < 1 || x.length > 10) return false;
    for (let i = 0; i < x.length; i++) {
      if (!Object.prototype.hasOwnProperty.call(x, i) || x[i] === null || x[i] === undefined) return false;
      if (!oraculo(x[i], [...ancestros, x])) return false;
    }
    return true;
  }
  if (x !== null && typeof x === 'object') {
    const k = Object.keys(x);
    return k.includes('ref') && k.every((c) => c === 'ref' || c === 'dir') && typeof x.ref === 'string' && x.ref.length > 0 && (!k.includes('dir') || (typeof x.dir === 'string' && /^[0-9]{10}$/.test(x.dir)));
  }
  return false;
}

function valorAleatorio(g, prof = 0) {
  const k = g.r();
  if (prof < 4 && k < 0.4) {
    const n = g.si(0.1) ? g.pick([0, 11]) : g.int(1, 5);
    const a = Array.from({ length: n }, () => valorAleatorio(g, prof + 1));
    if (n && g.si(0.08)) delete a[g.int(0, n - 1)]; // hueco real (array disperso)
    if (g.si(0.03)) a.length = n + 1; // hueco al final
    return a;
  }
  return g.pick([
    () => g.pick([0, 1, -2.5, 12, NaN, Infinity]),
    () => g.pick(['menú', 'EUR 12', '', '=LOCAL(1)']),
    () => g.pick([null, undefined, true]),
    () => ({ ref: hex(g, 8) }),
    () => ({ ref: hex(g, 8), dir: direccion([g.int(0, 9), g.int(0, 9)]) }),
    () => ({ ref: hex(g, 8), dir: g.pick(['12', undefined, 1200000000]) }),
    () => ({ ref: '' }),
    () => ({ ref: 'abc', extra: [null] }),
    () => Object.create({ ref: 'abc' }),
    () => ({ ref: 'abc', toJSON: () => 'hola' }),
    () => ({ a: 1 }),
  ])();
}

test('propiedad: validarPayload coincide con el oráculo (terminal o array ≤10 sin huecos; referencia {ref, dir?})', () => {
  const g = prng(SEMILLA);
  let validos = 0;
  for (let i = 0; i < 600; i++) {
    const v = valorAleatorio(g);
    const r = validarPayload(v);
    assert.equal(r.ok, oraculo(v), 'caso ' + i);
    assert.equal(r.ok, r.errores.length === 0);
    if (r.ok) validos++;
  }
  assert.ok(validos > 50);
});

test('propiedad: direccion e indicesDe son inversas; resolver sigue el camino exacto', () => {
  const g = prng(SEMILLA + 1);
  for (let i = 0; i < 400; i++) {
    const n = g.int(0, 10);
    const ind = Array.from({ length: n }, () => g.int(0, 9));
    while (ind.length && ind[ind.length - 1] === 0) ind.pop();
    const d = direccion(ind);
    assert.ok(esDireccion(d));
    assert.deepEqual(indicesDe(d), ind);
    assert.equal(direccion(indicesDe(d)), d);
    const p = valorAleatorio(g);
    let nodo = p;
    for (const k of ind) nodo = Array.isArray(nodo) && k < nodo.length ? nodo[k] : undefined;
    assert.equal(resolver(p, d), nodo);
  }
});

test('regresión: un array disperso tiene huecos (Array(3), [1, , 3]) y no entra en el eje', async () => {
  assert.equal(validarPayload(Array(3)).ok, false);
  assert.deepEqual(validarPayload([1, , 3]).errores, ['1: hueco']); // eslint-disable-line no-sparse-arrays
  await assert.rejects(Eje.genesis({ demostracion: true, identidad: 'ana', emision: [], foco: [1, , 3], t: T0 }), /hueco/); // eslint-disable-line no-sparse-arrays
  await assert.rejects(crearEvento({ autor: 'ana', sobre: 'g', t: T0, movimientos: [gastaT('ana')], payload: Array(2) }), /hueco/);
});

test('regresión: un payload cíclico se rechaza sin reventar la pila', () => {
  const a = ['x'];
  a.push(a);
  assert.deepEqual(validarPayload(a).errores, ['1: ciclo']);
});

test('regresión: una referencia es exactamente {ref} o {ref, dir} propias', () => {
  assert.equal(esReferencia({ ref: 'abc', dir: undefined }), false);
  assert.equal(esReferencia(Object.create({ ref: 'abc' })), false);
  assert.equal(esReferencia({ ref: 'abc', extra: [null] }), false);
  assert.equal(esReferencia({ ref: 'abc', toJSON: () => 'hola' }), false);
  assert.equal(esTerminal({ ref: 'abc', dir: '1200000000' }), true);
});

test('regresión: las rutas de error no confunden el índice 10 con el camino 1→0', () => {
  assert.deepEqual(validarPayload([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, null]).errores, ['raíz: más de 10 posiciones']);
  assert.deepEqual(validarPayload(['x', [null]]).errores, ['10: hueco']);
});

test('un payload más hondo que la profundidad máxima se rechaza sin agotar la pila',
  { skip: 'BTML-26: [X] decidir VG la profundidad máxima del payload, ligada al cambio de foco pendiente (BTML-40, ver BTML-26b); hoy validarPayload agota la pila (RangeError) con 20 000 niveles' },
  () => {
    let p = 'x';
    for (let i = 0; i < 20000; i++) p = [p];
    assert.equal(validarPayload(p).ok, false);
  });

// ---------- evento y canónico ----------

test('propiedad: el id no cambia al pasar por JSON y lo creado no depende de lo que se le pasó', async () => {
  const g = prng(SEMILLA + 2);
  for (let i = 0; i < 150; i++) {
    const payload = [g.pick(['a', 'b', 1]), { ref: hex(g), ...(g.si() ? { dir: '1000000000' } : {}) }];
    const contexto = { n: i, nota: g.si() ? undefined : 'x', lista: [1, g.si() ? undefined : 2], f: g.si(0.2) ? () => 1 : 3 };
    const ev = await crearEvento({ autor: 'ana', sobre: 'g', t: T0, movimientos: [gastaT('ana', g.int(1, 3))], payload, contexto });
    const json = JSON.parse(JSON.stringify(ev));
    assert.equal(await verificarId(json), true, 'caso ' + i);
    assert.equal(canonico(cuerpo(ev)), canonico(cuerpo(json)));
    payload[0] = 'mutado';
    assert.notEqual(ev.payload[0], 'mutado');
    assert.ok(Object.isFrozen(ev.payload) && Object.isFrozen(ev.movimientos[0]) && Object.isFrozen(ev.contexto));
  }
});

test('regresión: undefined en el contexto o en la referencia no cambia el id tras guardar', async () => {
  const eje = await Eje.genesis({ demostracion: true, identidad: 'r', emision: [], foco: 'g', t: T0 });
  await eje.escribir({ autor: 'r', sobre: eje.genesisId, t: T0, movimientos: [gastaT('r')], payload: { ref: eje.genesisId, dir: undefined }, contexto: { nota: undefined } });
  const otro = await restaurar(ida(eje));
  assert.deepEqual(otro.orden, eje.orden);
});

test('regresión: mutar el payload después de escribir no corrompe el eje', async () => {
  const eje = await Eje.genesis({ demostracion: true, identidad: 'r', emision: [], foco: 'g', t: T0 });
  const p = ['a'];
  const ev = await eje.escribir({ autor: 'r', sobre: eje.genesisId, t: T0, movimientos: [gastaT('r')], payload: p });
  p[0] = 'z';
  assert.equal(eje.obtener(ev.id).payload[0], 'a');
  assert.deepEqual((await restaurar(ida(eje))).orden, eje.orden);
});

test('regresión: una consolidación con un candidato sin tipo (undefined en el contexto) se restaura', async () => {
  const eje = await Eje.genesis({ demostracion: true, identidad: 'r', emision: [], foco: ['g', 'uno'], t: T0 });
  await motor.consolidar(eje, { autor: 'r', foco: eje.genesisId, elecciones: { 1: { candidato: { evento: eje.genesisId, dir: '1000000000' } } }, t: T0 });
  assert.deepEqual((await restaurar(ida(eje))).orden, eje.orden);
});

test('regresión: un movimiento null o un contexto que no es objeto dan errores, no TypeError', async () => {
  const base = { autor: 'r', sobre: 'g', t: T0, payload: 'x' };
  assert.ok(validarForma({ ...base, movimientos: [null, gastaT('r')] }).some((e) => /no es objeto/.test(e)));
  assert.ok(validarForma({ ...base, movimientos: [gastaT('r')], contexto: 5 }).some((e) => /contexto/.test(e)));
  const eje = await Eje.genesis({ demostracion: true, identidad: 'r', emision: [], foco: 'g', t: T0 });
  const ev = await crearEvento({ ...base, sobre: eje.genesisId, movimientos: [gastaT('r')] });
  for (const movimientos of [[...ev.movimientos, null], {}, 5]) {
    const errores = await eje.validar({ ...ev, movimientos });
    assert.ok(errores.length > 0);
  }
  await assert.rejects(eje.anadir({ ...ev, movimientos: [...ev.movimientos, null] }), /evento rechazado/);
});

// ---------- tokens y eje ----------

test('regresión: la cadena vacía no es una identidad', async () => {
  const eje = await Eje.genesis({ demostracion: true, identidad: 'r', emision: [], foco: 'g', t: T0 });
  await assert.rejects(eje.escribir({ autor: 'r', sobre: eje.genesisId, t: T0, movimientos: [gastaT('r'), { token: 'T', escala: 'minuto', cantidad: 1, de: 'r', a: '' }], payload: 'x' }), /identidad/);
});

test('regresión: el génesis con clave va firmado con ella (como exige restaurar)', async () => {
  const { publica } = await generarClaves();
  const otra = await generarClaves();
  const emision = [];
  await assert.rejects(Eje.genesis({ demostracion: true, identidad: 'r', emision, foco: 'g', t: T0, clave: publica }), /firmado/);
  await assert.rejects(Eje.genesis({ demostracion: true, identidad: 'r', emision, foco: 'g', t: T0, clave: publica, privada: otra.privada }), /firmado/);
});

test('regresión: restaurar exige al génesis lo mismo que Eje.genesis (en la versión 2, P con ámbito genesis; en la 3, nada; claves del autor)', async () => {
  const fantasma = (await generarClaves()).publica;
  const T = { token: 'T', escala: 'hora', cantidad: 1, de: null, a: 'r' };
  const casos = [
    [{ token: 'P', ambito: 'f'.repeat(64), cantidad: 1, de: null, a: 'r' }], // P con un ámbito que no existe: inmovilizable
    [{ token: 'P', ambito: 'otro', cantidad: 1, de: null, a: 'r' }],
  ];
  for (const extra of casos) {
    const g = await crearEvento({ autor: 'r', sobre: null, t: T0, payload: 'g', contexto: { genesis: true }, movimientos: [T, ...extra] });
    await assert.rejects(restaurar({ version: 2, eventos: [g] }), /génesis rechazado: el P del génesis/);
    // Encargo 3b (mapa §15 [D]): nadie acuña P a mano, tampoco al empezar.
    await assert.rejects(Eje.genesis({ demostracion: true, identidad: 'r', emision: [{ token: 'P', ambito: extra[0].ambito, cantidad: 1 }], foco: 'g', t: T0 }), /nadie acuña P a mano/);
  }
  // Con las reglas de ahora, el génesis es la época 0 y no mueve nada (VG, 10-11, A2; encargo 3b).
  const g3 = await crearEvento({ autor: 'r', sobre: null, t: T0, payload: 'g', contexto: { genesis: true, demostracion: true }, movimientos: [{ token: 'R', emisor: 'r', cantidad: 1, de: null, a: 'r' }] });
  await assert.rejects(restaurar({ version: 3, eventos: [g3] }), /génesis rechazado: el génesis no mueve nada/);
  const g = await crearEvento({ autor: 'r', sobre: null, t: T0, payload: 'g', contexto: { genesis: true, claves: { fantasma } }, movimientos: [T] });
  await assert.rejects(restaurar({ version: 2, eventos: [g] }), /génesis rechazado: el génesis solo declara la clave de su autor/);
  await assert.rejects(Eje.genesis({ demostracion: true, identidad: 'r', emision: [], foco: 'g', t: T0, contexto: { claves: { fantasma } } }), /clave de su autor/);
});

test('regresión: una clave declarada debe ser pública e importable (sin d, sin x/y basura)', async () => {
  const eje = await Eje.genesis({ demostracion: true, identidad: 'r', emision: [{ token: 'R', cantidad: 1 }, { token: 'E', denominacion: 'minuto', cantidad: 600 }], foco: 'g', t: T0 });
  const par = await generarClaves();
  const alta = (clave) => eje.escribir({ autor: 'r', sobre: eje.genesisId, t: T0, movimientos: [gastaT('r'), { token: 'E', emisor: 'r', denominacion: 'minuto', cantidad: 5, de: 'r', a: 'bea' }], payload: 'alta', contexto: { claves: { bea: clave } } });
  await assert.rejects(alta({ ...par.publica, d: 'PRIVADA' }), /clave inválida/);
  await assert.rejects(alta({ kty: 'EC', crv: 'P-256', x: 'zz', y: 'zz' }), /clave inválida/);
  assert.equal(eje.clave('bea'), undefined);
});

test('regresión (encargo 3b): P va sobre un registro; «genesis» ya no es un ámbito, y el P de un registro no cubre lo de debajo', async () => {
  // Mapa §15 [D] «P como peso de criterio»: se retira «P del génesis sobre todo el eje»; el P de un registro es criterio
  // sobre él, y llevarlo a otro es reposicionarlo.
  const eje = await Eje.genesis({ demostracion: true, identidad: 'r', emision: [], foco: 'g', t: T0 });
  assert.equal(eje.poderSobre('r', eje.genesisId), 10); // escribir el génesis le dio diez (N1)
  await entrarPorInvitacion(eje, { por: 'r', quien: 'b', t: T0 });
  const x = await eje.escribir({ autor: 'r', sobre: eje.genesisId, t: T0, movimientos: [gastaT('r'), { token: 'P', ambito: eje.genesisId, cantidad: 4, de: 'r', a: 'b' }], payload: 'x' });
  await assert.rejects(eje.escribir({ autor: 'b', sobre: eje.genesisId, t: T0, movimientos: [gastaT('b'), { token: 'P', ambito: 'genesis', cantidad: 1, de: 'b', a: 'r' }], payload: 'y' }), /P moves within a known scope/);
  // 4 que le da r (de origen r: encargo 3b-bis) y 10 suyos por recibir R:r en su invitación (N2: en la raíz de r).
  assert.deepEqual([eje.saldo('b', 'P:' + eje.genesisId + '/r'), eje.saldo('b', 'P:' + eje.genesisId + '.3/b'), eje.poderSobre('b', eje.genesisId)], [4, 10, 14]);
  assert.equal(eje.poderSobre('b', x.id), 0); // el P sobre el génesis no cubre lo que cuelga de él
});

// TOK-02 ya no se salta (VG, 7-11 noche: «escribir consume T»): el evento mínimo es un consumo de T del autor.
test('mover T de uno a sí mismo no paga la escritura', async () => {
  const eje = await Eje.genesis({ demostracion: true, identidad: 'r', emision: [], foco: 'g', t: T0 });
  await assert.rejects(eje.escribir({ autor: 'r', sobre: eje.genesisId, t: T0, movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'r', a: 'r' }], payload: 'gratis' }), /escribir consume T del autor/);
  await assert.rejects(eje.escribir({ autor: 'r', sobre: eje.genesisId, t: T0, movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'r', a: 'r', estado: 'bloqueo', salida: 's' }], payload: 'gratis' }), /escribir consume T del autor/);
  await eje.escribir({ autor: 'r', sobre: eje.genesisId, t: T0, movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'r', a: null }], payload: 'pagada' });
  assert.equal(eje.saldoT('r', 'minuto'), 1439);
});

/**
 * Secuencias aleatorias de escrituras (válidas e inválidas) con enteros. Tras
 * cada intento: si se rechaza, nada cambia (atomicidad de anadir) y el
 * rechazo es controlado; saldos finitos y no negativos; conservación por
 * serie (Σ saldos + consumido = emitido, con lo emitido que lleva el eje; P
 * por familia, porque delegar cambia de ámbito); toda emisión aceptada es de
 * una persona (VG, 7-11 noche; antes, también de un grupo), nace en su cartera
 * y va a su propia serie (E:<emisor>/<denominación>, R:<emisor>, y T para sí
 * misma); una cosa no emite, pero recibe, conserva y mueve. Al
 * final, restaurar reproduce el eje.
 */
test('propiedad: secuencias de escrituras — atomicidad, saldos ≥ 0, conservación y restauración', async () => {
  const g = prng(SEMILLA + 3);
  const fam = (k) => (k.startsWith('P:') ? 'P' : k);
  const quienes = ['b', 'c', 'hab'];
  const vistos = { emisionDeOtros: 0, cosaMueve: 0, cosaNoEmite: 0 };
  for (let s = 0; s < 12; s++) {
    const eje = await Eje.genesis({ demostracion: true, identidad: 'r', emision: [{ token: 'E', emisor: 'r', denominacion: 'EUR', cantidad: 50 }, { token: 'E', emisor: 'r', denominacion: 'minuto', cantidad: 50 }, { token: 'R', emisor: 'r', cantidad: 5 }], foco: ['g', ['a', 'b']], t: T0 });
    // Alta: b acepta la invitación de r y es persona (B1; encargo 3b); c y hab son cosas de r (con cartera, sin emisión;
    // no hay identidades de grupo: VG, 8-11).
    await entrarPorInvitacion(eje, { por: 'r', quien: 'b', t: T0 });
    const alta = await eje.escribir({ autor: 'r', sobre: eje.genesisId, t: T0, movimientos: [gastaT('r'), ...quienes.map((a) => (a === 'hab' ? { token: 'T', escala: 'minuto', cantidad: 5, de: 'r', a } : { token: 'E', emisor: 'r', denominacion: 'minuto', cantidad: 5, de: 'r', a })), { token: 'E', emisor: 'r', denominacion: 'EUR', cantidad: 3, de: 'r', a: 'hab' }], payload: 'alta' });
    const consumido = new Map([['T:minuto', 4]]); // la emisión de r, la invitación, el alta de b y la de r
    const ids = [eje.genesisId, alta.id];
    for (let paso = 0; paso < 25; paso++) {
      const autor = g.pick(['r', 'r', 'b', 'c', 'hab', 'nadie']);
      const mov = [{ token: 'T', escala: g.pick(['segundo', 'minuto']), cantidad: g.int(1, 3), de: autor, a: g.si(0.3) ? g.pick(quienes) : null }];
      const op = g.int(0, 9);
      if (op === 0) mov.push({ token: 'E', denominacion: g.pick(['EUR', 'plaza']), emisor: g.pick(['r', autor]), cantidad: g.int(1, 30), de: autor, a: g.pick([...quienes, null]) });
      if (op === 1) mov.push({ token: 'P', ambito: g.pick([...ids, 'genesis']), cantidad: g.int(1, 4), de: autor, a: g.pick(quienes) });
      if (op === 2) mov.push({ token: 'R', emisor: 'r', cantidad: g.int(1, 3), de: autor, a: g.pick(quienes) });
      if (op === 3) {
        // Emite su serie (solo personas) y a veces da plazas a la cosa en el mismo evento.
        // VG, 7-11 noche: E exige además R propia en juego (a veces la pone) y P sobre el registro (solo r lo tiene).
        if (g.si(0.8)) {
          const denominacion = g.pick(['EUR', 'plaza']);
          if (g.si()) mov.push({ token: 'R', emisor: autor, cantidad: 1, de: null, a: autor }, { token: 'R', emisor: autor, cantidad: 1, de: autor, a: g.pick(quienes) });
          mov.push({ token: 'E', denominacion, emisor: autor, cantidad: g.int(1, 3), de: null, a: autor });
          if (g.si()) mov.push({ token: 'E', denominacion, emisor: autor, cantidad: 1, de: autor, a: 'hab' });
        } else mov.push({ token: 'R', emisor: autor, cantidad: g.int(1, 3), de: null, a: autor });
      }
      if (op === 4) mov.push({ token: 'T', escala: 'minuto', cantidad: 1, de: 'r', a: autor }); // tokens ajenos si autor ≠ r
      if (op === 5) mov.push({ token: 'T', escala: 'anio', cantidad: 100, de: autor, a: 'b' }); // saldo insuficiente
      // VG, 8-11: T no se emite (cada persona tiene su asignación diaria); una persona emite su R con su colateral (R6).
      if (op === 7) mov.push({ token: 'T', escala: 'minuto', cantidad: 1, de: null, a: autor });
      if (op === 8) mov.push({ token: 'R', emisor: autor, cantidad: 10, de: null, a: autor }, { token: 'R', emisor: autor, cantidad: 1, de: autor, a: autor, estado: 'bloqueo', salida: 'R:' + autor });
      // Solo r escribe sobre el génesis, su alta: los demás pagarían el precio de su atención (revisión de seguridad,
      // encargo 3b).
      const datos = { autor, sobre: g.si(0.9) ? g.pick(autor === 'r' ? ids : ids.slice(1)) : hex(g), en: direccion([g.int(0, 2)]), t: T0, movimientos: mov, payload: op === 6 ? ['x', null] : ['p', paso, s], contexto: { paso } };
      const antes = foto(eje);
      let ev;
      try {
        ev = await eje.escribir(datos);
      } catch (e) {
        assert.equal(e.constructor, Error, e.message);
        assert.match(e.message, /evento (rechazado|mal formado)/);
        assert.equal(foto(eje), antes, 'un rechazo no cambia nada');
        if (op === 7 && /^evento rechazado/.test(e.message) && !/autor desconocido|foco desconocido/.test(e.message)) assert.match(e.message, /nobody mints T|only persons mint/);
        if (autor === 'hab' && op === 3) {
          assert.match(e.message, /only persons mint/);
          vistos.cosaNoEmite++;
        }
        continue;
      }
      ids.push(ev.id);
      for (const m of ev.movimientos.filter((x) => x.de === null)) {
        assert.equal(eje.esPersona(ev.autor), true); // VG, 7-11 noche: solo emiten personas (B1: quien escribió su alta)
        assert.equal(m.a, ev.autor); // la emisión nace en la cartera de quien la emite
        if (m.token === 'E' || m.token === 'R') assert.equal(m.emisor, ev.autor);
        if (ev.autor !== 'r') vistos.emisionDeOtros++;
      }
      if (ev.autor === 'hab') vistos.cosaMueve++;
      for (const serie of eje.series()) {
        // P no se emite: se obtiene, también una cosa al escribir (encargo 3b, mapa §15 [D] N1); lo demás, solo personas.
        if (serie.token !== 'P') assert.equal(eje.esPersona(serie.emisor), true, serie.clave + ' la emite ' + serie.emisor);
        if (serie.token === 'E') assert.equal(serie.clave, 'E:' + serie.emisor + '/' + serie.denominacion);
        if (serie.token === 'R') assert.equal(serie.clave, 'R:' + serie.emisor);
      }
      for (const m of ev.movimientos) if (m.a === null) consumido.set(fam(claveToken(m)), (consumido.get(fam(claveToken(m))) ?? 0) + cantidadBase(m));
      for (const [id, saldos] of eje.saldos) for (const [k, v] of saldos) assert.ok(Number.isFinite(v) && v >= 0, id + ' ' + k + ' = ' + v);
      const total = new Map();
      for (const [, saldos] of eje.saldos) for (const [k, v] of saldos) total.set(fam(k), (total.get(fam(k)) ?? 0) + v);
      for (const id of eje.identidades()) for (const b of eje.bloqueos(id)) total.set(fam(b.clave), (total.get(fam(b.clave)) ?? 0) + b.cantidad);
      // Lo acuñado, del libro, de todas las clases: la emisión, la asignación diaria de T (VG, 8-11) y la obtención de P
      // (encargo 3b, mapa §15: el P se obtiene al escribir, al conseguir E y al recibir R, sin movimiento en el evento).
      const emitido = new Map();
      for (const [k, v] of Object.entries(eje.libro.sumas({ primitiva: 'acunar' }))) emitido.set(fam(k), (emitido.get(fam(k)) ?? 0) + v);
      assert.deepEqual([...total.keys()].sort(), [...emitido.keys()].sort());
      for (const [k, e] of emitido) assert.equal(total.get(k) + (consumido.get(k) ?? 0), e, 'conservación de ' + k);
    }
    const otro = await restaurar(ida(eje));
    assert.equal(foto(otro), foto(eje));
    assert.deepEqual(ida(otro), ida(eje));
  }
  assert.ok(vistos.emisionDeOtros > 0 && vistos.cosaMueve > 0 && vistos.cosaNoEmite > 0, JSON.stringify(vistos));
});

/**
 * Escribir cuesta minutos: escribirDesde mueve un minuto de T por posición
 * (costeT) y cada escala es su propio token, así que las horas no pagan.
 * Se acepta si cabe en el máximo del modo y hay minutos; si no, nada cambia.
 * La raíz no declaró ser persona: no acuña su T al gastarlo (Core, 8-11).
 */
test('propiedad: escribir desde un modo cuesta T:minuto por posición y no toca las demás escalas', async () => {
  const g = prng(SEMILLA + 6);
  const vistos = { aceptado: 0, sinMinutos: 0, noCabe: 0 };
  for (let i = 0; i < 150; i++) {
    const minutos = g.pick([0, 1, 2, 5, 20, 400]);
    // Ningún T se acumula (VG, 8-11): r tiene los 1440 minutos del día; gasta antes los que no van a quedarle.
    const eje = await Eje.genesis({ demostracion: true, identidad: 'r', emision: [], foco: ['g', ['a', 'b']], t: T0 });
    await eje.escribir({ autor: 'r', sobre: eje.genesisId, t: T0, payload: 'el resto del día', movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1440 - minutos, de: 'r', a: null }] });
    const modo = g.pick(['pointed', 'sequenced', 'mapped']);
    const payload = g.si(0.3) ? g.pick(['plaza', 7, { ref: eje.genesisId, dir: '1000000000' }]) : payloadEje(g, [eje.genesisId]);
    const coste = costeT(payload);
    const cabe = cabeTope(payload, modo); // VG, 7-11 noche: la proporción propone, el máximo manda (antes, cabeEscritura)
    const antes = foto(eje);
    let ev;
    try {
      ev = await escribirDesde(eje, { modo, autor: 'r', sobre: eje.genesisId, payload, t: T0 });
    } catch (e) {
      assert.ok(!cabe || minutos < coste, 'rechazado sin motivo: ' + e.message);
      assert.equal(foto(eje), antes, 'un rechazo no cambia nada');
      if (!cabe) vistos.noCabe++;
      else {
        assert.match(e.message, /writing burns today's T/);
        vistos.sinMinutos++;
      }
      continue;
    }
    assert.ok(cabe && minutos >= coste, 'aceptado sin caber o sin minutos: ' + modo + ' ' + coste + '/' + minutos);
    assert.deepEqual(ev.movimientos.map((m) => [m.token, m.escala, m.cantidad, m.de, m.a]), [['T', 'minuto', coste, 'r', null]]);
    assert.equal(eje.saldoT('r', 'minuto'), minutos - coste);
    assert.equal(eje.saldoT('r', 'hora'), 24, 'las horas no pagan minutos');
    vistos.aceptado++;
  }
  assert.ok(vistos.aceptado > 0 && vistos.sinMinutos > 0 && vistos.noCabe > 0, JSON.stringify(vistos));
});

// ---------- encaje ----------

function payloadEje(g, ids, prof = 0, formula) {
  if (prof >= 3 || g.r() < 0.35) {
    const k = g.r();
    if (k < 0.3) return g.pick([0, 1, 12, -3]);
    if (k < 0.5) return g.pick(['menú', '12 EUR', '5 min', '==texto', 'plaza']);
    if (k < 0.7 && ids.length) return g.si(0.3) ? { ref: g.pick(ids) } : { ref: g.pick(ids), dir: direccion([g.int(0, 3), g.int(0, 3)].slice(0, g.int(0, 2))) };
    // C1 (VG, 10-11): una referencia rota no entra en el eje; su lectura la prueban los ejes falsos de más abajo.
    if (k < 0.78) { g.si(); hex(g); return ids.length ? { ref: ids[ids.length - 1] } : 'x'; } // el mismo azar de antes
    if (formula && k < 0.95) return '=' + formula(g, ids);
    return 'x';
  }
  return Array.from({ length: g.int(1, g.si(0.15) ? 10 : 4) }, () => payloadEje(g, ids, prof + 1, formula));
}

async function ejeAleatorio(semilla, { n = 6, formula } = {}) {
  const g = prng(semilla);
  const eje = await Eje.genesis({ demostracion: true, identidad: 'r', emision: [], foco: payloadEje(g, [], 0, formula), t: T0 });
  const ids = [eje.genesisId];
  for (let i = 0; i < n; i++) {
    const en = g.si() ? direccion([g.int(0, 3), g.int(0, 2)].slice(0, g.int(0, 2))) : '0000000000';
    const ev = await eje.escribir({ autor: 'r', sobre: g.pick(ids), en, t: T0, movimientos: [gastaT('r')], payload: payloadEje(g, ids, 0, formula), contexto: { i } });
    ids.push(ev.id);
  }
  return { eje, ids, g };
}

const caminar = (p, camino) => camino.reduce((n, i) => (Array.isArray(n) ? n[i] : undefined), p);

test('propiedad: ocupantes y árbol — vector bien formado, orden por acuerdo y llegada, colisiones, sin escribir', async () => {
  for (let s = 0; s < 15; s++) {
    const { eje, ids, g } = await ejeAleatorio(SEMILLA + 100 + s);
    const antes = JSON.stringify(ida(eje));
    for (const id of ids) {
      const ev = eje.obtener(id);
      for (let k = 0; k < 4; k++) {
        const indices = Array.from({ length: g.int(0, 10) }, () => g.int(0, g.si(0.8) ? 2 : 9));
        const dir = direccion(indices);
        const lleg = E.ocupantes(eje, id, indices, { orden: 'llegada' });
        const enc = E.ocupantes(eje, id, indices);
        assert.deepEqual(E.ocupantes(eje, id, indices), enc, 'determinista');
        assert.equal(enc.length, lleg.length);
        const llave = (o) => JSON.stringify([o.origen, o.evento, o.camino, o.procedencia]);
        const pos = enc.map((o) => lleg.findIndex((x) => llave(x) === llave(o)));
        for (let i = 1; i < enc.length; i++) {
          assert.ok(enc[i - 1].acuerdo >= enc[i].acuerdo);
          if (enc[i - 1].acuerdo === enc[i].acuerdo) assert.ok(pos[i - 1] < pos[i], 'el empate conserva la llegada');
        }
        for (const o of lleg) {
          assert.equal(o.vector.length, 10);
          assert.ok(o.vector.every((x) => Number.isInteger(x) && Math.abs(x) <= 9));
          assert.equal(o.acuerdo, E.acuerdo(o.vector));
          assert.deepEqual(o.distancia, o.vector.map(Math.abs));
          assert.equal(o.destino, dir);
          if (o.origen === 'propio') {
            assert.equal(direccion(o.camino), dir);
            // VG, 7-11 noche: por hojas: una lista (bajo la raíz, solo hojas) da un ocupante por elemento, con su
            // índice y el camino de la lista; una décupla, una hoja o la raíz, uno solo.
            const nodo = caminar(ev.payload, o.camino);
            if (o.enLista) {
              assert.ok(o.camino.length > 0 && esLista(nodo), 'un elemento de lista sale de una lista');
              assert.equal(nodo[o.indice], o.contenido);
              assert.equal(o.procedencia[0], id + ':' + dir + '#' + o.camino.join('.') + '[' + o.indice + ']');
            } else {
              assert.equal(nodo, o.contenido);
              assert.ok(!(o.camino.length > 0 && esLista(nodo)), 'una lista nunca es un solo ocupante');
            }
          }
          if (o.origen === 'referencia' && o.rota) assert.equal(o.contenido, undefined);
          if (o.origen === 'referencia' && !o.rota) assert.equal(esReferencia(o.contenido), false);
          if (o.origen === 'escrito') assert.equal(eje.obtener(o.evento).en, dir);
        }
        assert.equal(lleg.filter((o) => o.origen === 'escrito').length, eje.sobre(id, dir).length);
        const porCamino = (c) => (c.indices.length > 0 && esLista(c.contenido) ? c.contenido.length : 1);
        assert.equal(lleg.filter((o) => o.origen === 'propio').length, E.caminosDe(ev.payload, dir).reduce((s, c) => s + porCamino(c), 0));
      }
      const mapa = E.arbol(eje, id);
      for (const [dir, oc] of mapa) assert.deepEqual(oc, E.ocupantes(eje, id, indicesDe(dir)));
      assert.deepEqual(E.colisiones(mapa).map((c) => c.dir), [...mapa].filter(([, o]) => o.length > 1).map(([d]) => d));
      for (const h of eje.sobre(id)) assert.ok(mapa.has(h.en));
    }
    assert.equal(JSON.stringify(ida(eje)), antes, 'el encaje no escribe');
  }
});

test('propiedad: referencias cíclicas y cadenas largas terminan (seguir, ocupantes, árbol)', () => {
  const g = prng(SEMILLA + 4);
  for (let s = 0; s < 60; s++) {
    const n = g.int(1, 30);
    const ids = Array.from({ length: n }, () => hex(g));
    const eventos = new Map(ids.map((id, i) => {
      const sig = ids[(i + 1) % n];
      const payload = g.pick([{ ref: sig }, ['x', { ref: sig, dir: '1000000000' }], [{ ref: sig }], { ref: hex(g) }]);
      return [id, { id, payload, en: '0000000000' }];
    }));
    const falso = { obtener: (id) => eventos.get(id), sobre: () => [] };
    for (const id of ids) {
      const r = E.seguir(falso, { ref: id });
      assert.ok(r.rota || !esReferencia(r.contenido));
      for (const ind of [[], [0], [1], [1, 0]]) E.ocupantes(falso, id, ind).forEach((o) => assert.equal(o.vector.length, 10));
      E.arbol(falso, id);
    }
  }
});

// ---------- BQL ----------

function formula(g, ids, prof = 0) {
  const indices = () => Array.from({ length: g.si(0.1) ? g.int(9, 12) : g.int(1, 3) }, () => (g.si(0.95) ? g.int(0, 9) : g.pick([10, -1, 1.5]))).join(', ');
  const hoja = () => g.pick([
    () => String(g.pick([0, 1, 2, 12, 0.5])),
    () => g.pick(['12 EUR', '2 EUR', '5 min']),
    () => JSON.stringify(g.pick(['desc', 'propio', 'hola', ''])),
    () => 'LOCAL(' + indices() + ')',
    () => g.pick(['ORIGEN()', 'ACUERDO()', 'DESPLAZAMIENTO()', 'SIGNO()', 'FALTAS()', 'EXCEDENTES()', 'ACTUAL()', 'ACTUAL(1)']),
    () => 'REF(' + JSON.stringify(ids.length && g.si(0.8) ? g.pick(ids).slice(0, g.pick([8, 64, 1])) : 'zzzz') + (g.si() ? ', "' + direccion([g.int(0, 3)]) + '"' : '') + ')',
  ])();
  if (prof > 3 || g.r() < 0.3) return hoja();
  const sub = () => formula(g, ids, prof + 1);
  const col = () => g.pick([
    () => 'BUSCAR(' + indices() + ')',
    () => 'FILTRAR(BUSCAR(' + indices() + '), ' + sub() + ')',
    () => 'ORDENAR(BUSCAR(' + indices() + '), ' + sub() + ', "desc")',
    () => 'ELEGIR(BUSCAR(' + indices() + '), ' + g.int(0, 3) + ')',
    () => 'ACTUAL(' + g.int(0, 9) + ', ' + g.int(1, 3) + ')',
  ])();
  return g.pick([
    () => sub() + ' ' + g.pick(['+', '-', '*', '/']) + ' ' + sub(),
    () => sub() + ' ' + g.pick(['=', '<>', '<', '>=']) + ' ' + sub(),
    () => '-' + sub(),
    () => '(' + sub() + ')',
    col,
    () => g.pick(['CONTAR', 'SUMAR']) + '(' + col() + ')',
    () => g.pick(['Y', 'O']) + '(' + sub() + ', ' + sub() + ')',
    () => 'NO(' + sub() + ')',
    () => g.pick(['FOO()', 'LOCAL()', '1 +', '((1)', '"sin cerrar', 'ñ', 'NO()', 'CONTAR()', 'SUMAR()', 'FILTRAR()', 'ORDENAR()', 'ELEGIR()']),
  ])();
}

function slots(p, camino = [], out = []) {
  if (camino.length > ARIDAD) return out;
  out.push(camino);
  if (Array.isArray(p)) p.forEach((h, i) => slots(h, [...camino, i], out));
  return out;
}

test('propiedad: BQL con fórmulas generadas por gramática nunca lanza, nunca escribe y es determinista', async () => {
  const vistos = new Set();
  for (let s = 0; s < 10; s++) {
    const { eje, ids, g } = await ejeAleatorio(SEMILLA + 200 + s, { formula });
    const antes = JSON.stringify(ida(eje));
    for (const id of ids) {
      for (const camino of slots(eje.obtener(id).payload)) {
        const a = B.evaluar(eje, id, camino);
        assert.ok(B.ESTADOS.includes(a.estado));
        assert.equal(typeof a.texto, 'string');
        assert.deepEqual(B.evaluar(eje, id, camino), a);
        vistos.add(a.estado);
      }
      for (let k = 0; k < 4; k++) {
        const f = formula(g, ids);
        const camino = Array.from({ length: g.int(1, g.si(0.15) ? 10 : 3) }, () => g.int(0, 9));
        const a = B.consultar(eje, id, camino, f);
        assert.ok(B.ESTADOS.includes(a.estado), f);
        assert.deepEqual(B.consultar(eje, id, camino, f), a);
      }
    }
    assert.equal(JSON.stringify(ida(eje)), antes, 'BQL no escribe');
  }
  assert.deepEqual([...vistos].sort(), ['ERROR', 'INCOMPATIBLE', 'PENDIENTE', 'RESUELTO']);
});

// Integración 7-11: con BQL según el corpus (#36, O-33/E-09) agotar un límite es PENDIENTE POR LÍMITE, no ERROR.
test('propiedad: los ciclos acaban en ERROR y el presupuesto en PENDIENTE POR LÍMITE', async () => {
  const eje = await Eje.genesis({ demostracion: true, identidad: 'r', emision: [], foco: ['=LOCAL(1)', '=LOCAL(0)', '=LOCAL(2)', ...Array.from({ length: 7 }, (_, i) => (i < 6 ? '=LOCAL(' + (i + 4) + ') + LOCAL(' + (i + 4) + ')' : 1))], t: T0 });
  assert.match(B.evaluar(eje, eje.genesisId, [0]).texto, /^ERROR: ciclo/);
  assert.match(B.evaluar(eje, eje.genesisId, [2]).texto, /^ERROR: ciclo/);
  assert.equal(B.evaluar(eje, eje.genesisId, [3]).texto, '64');
  assert.match(B.consultar(eje, eje.genesisId, [0], Array(3000).fill('1').join('+')).texto, /^PENDIENTE POR LÍMITE: presupuesto/);
});

// Integración 7-11: #43 pedía ERROR; BQL según el corpus (#36) da PENDIENTE «posición sin desarrollar: más de diez profundidades» (docs/BQL.md §8). Lo que se vigila sigue igual: un estado, no RangeError.
// [X] decidir VG: PENDIENTE (lo de hoy, #36) o ERROR (lo que pedía #43). Se decidió en la integración y está sin revisar; si VG prefiere ERROR, cambian los tres `throw new Parada('PENDIENTE', '… más de diez profundidades')` de src/bql.js y estas pruebas.
test('regresión: BUSCAR, ACTUAL o una fórmula más allá de diez profundidades dan PENDIENTE, no RangeError', async () => {
  let p = '=BUSCAR(1, 1, 0)'; // VG, 7-11 noche: el último número es el índice en la lista; el camino, 1.1 más hondo
  for (let i = 0; i < 10; i++) p = [p];
  const eje = await Eje.genesis({ demostracion: true, identidad: 'r', emision: [], foco: p, t: T0 });
  const fondo = Array(10).fill(0);
  const PROFUNDO = 'PENDIENTE: posición sin desarrollar: más de diez profundidades';
  assert.equal(B.evaluar(eje, eje.genesisId, fondo).texto, PROFUNDO);
  // Once dígitos de camino y el índice en la lista (VG, 7-11 noche: el último número de BUSCAR es ese índice).
  assert.equal(B.consultar(eje, eje.genesisId, [0], 'BUSCAR(' + Array(12).fill(1).join(',') + ')').texto, PROFUNDO);
  assert.equal(B.consultar(eje, eje.genesisId, [...fondo, 0], 'ACTUAL(1, 2)').texto, PROFUNDO);
  let q = '=1+1';
  for (let i = 0; i < 11; i++) q = [q];
  const hondo = await Eje.genesis({ demostracion: true, identidad: 'r', emision: [], foco: q, t: T0 });
  assert.equal(B.evaluar(hondo, hondo.genesisId, Array(11).fill(0)).texto, PROFUNDO);
  assert.equal(B.consultar(hondo, hondo.genesisId, [0], 'LOCAL(' + Array(11).fill(0).join(',') + ')').texto, PROFUNDO);
});

// Integración 7-11: con #36 la anidación tiene límite propio (limites.profundidad): PENDIENTE POR LÍMITE, no ERROR.
test('regresión: una fórmula anidada miles de veces da PENDIENTE POR LÍMITE, no desborda la pila', async () => {
  const eje = await Eje.genesis({ demostracion: true, identidad: 'r', emision: [], foco: 'g', t: T0 });
  for (const f of ['('.repeat(20000) + '1' + ')'.repeat(20000), 'NO('.repeat(20000) + '1=1' + ')'.repeat(20000), '-'.repeat(50000) + '1']) {
    const r = B.consultar(eje, eje.genesisId, [0], f);
    assert.equal(r.estado, 'PENDIENTE POR LÍMITE');
  }
});

test('regresión: una función sin el argumento que espera da ERROR, no TypeError', async () => {
  const eje = await Eje.genesis({ demostracion: true, identidad: 'r', emision: [], foco: ['g', 'a'], t: T0 });
  // Integración 7-11: con #36, las funciones de colección dicen qué esperan (docs/BQL.md §8).
  assert.equal(B.consultar(eje, eje.genesisId, [0], 'NO()').texto, 'ERROR: NO espera un argumento');
  for (const f of ['CONTAR()', 'SUMAR()', 'FILTRAR()', 'ORDENAR()', 'ELEGIR()']) {
    assert.equal(B.consultar(eje, eje.genesisId, [0], f).texto, 'ERROR: ' + f.slice(0, -2) + ' espera una colección');
  }
});

// ---------- persistencia ----------

async function ejeConFirmas(g, pares) {
  const firmas = g.si(0.6);
  const [pr, pb] = pares;
  const priv = { r: firmas ? pr.privada : undefined, b: firmas ? pb.privada : undefined };
  // r es una persona y b una cosa suya, que escribe con el T que r le da (Core, 8-11).
  const eje = await Eje.genesis({ demostracion: true, identidad: 'r', emision: [{ token: 'R', cantidad: 1 }, { token: 'E', emisor: 'r', denominacion: 'EUR', cantidad: 100 }], foco: payloadEje(g, []), t: T0, ...(firmas ? { clave: pr.publica, privada: pr.privada } : {}), exigirFirmas: firmas && g.si() });
  const ids = [eje.genesisId];
  const alta = await eje.escribir({ autor: 'r', sobre: eje.genesisId, t: T0, movimientos: [gastaT('r'), { token: 'T', escala: 'minuto', cantidad: 100, de: 'r', a: 'b' }, { token: 'E', denominacion: 'EUR', emisor: 'r', cantidad: 10, de: 'r', a: 'b' }], payload: 'alta', contexto: { ...(firmas ? { claves: { b: pb.publica } } : {}) } }, priv.r);
  ids.push(alta.id);
  for (let i = 0; i < g.int(1, 4); i++) {
    const autor = g.pick(['r', 'b']);
    // En el 0, 1 o 2: el 3 del alta de r es su atención, y escribir ahí tiene precio (encargo 3b, mapa §16 [D]).
    // b no escribe sobre el génesis, el alta de r: tendría el precio de su atención (revisión de seguridad, encargo 3b).
    const ev = await eje.escribir({ autor, sobre: g.pick(autor === 'b' ? ids.slice(1) : ids), en: g.si() ? direccion([g.int(0, 2)]) : '0000000000', t: T0, movimientos: [gastaT(autor), { token: 'E', denominacion: 'EUR', emisor: 'r', cantidad: 1, de: autor, a: autor === 'r' ? 'b' : 'r' }], payload: payloadEje(g, ids), contexto: { i } }, priv[autor]);
    ids.push(ev.id);
  }
  return eje;
}

test('propiedad: serializar→restaurar es idempotente y los bytes manipulados se rechazan o no cambian nada', async () => {
  const g = prng(SEMILLA + 5);
  const pares = [await generarClaves(), await generarClaves()];
  let rechazos = 0;
  for (let s = 0; s < 12; s++) {
    const eje = await ejeConFirmas(g, pares);
    const S = JSON.stringify(serializar(eje));
    const r1 = await restaurar(JSON.parse(S));
    assert.equal(JSON.stringify(serializar(r1)), S);
    assert.equal(fotoSaldos(r1), fotoSaldos(eje));
    const inicio = S.indexOf('"eventos"'); // la cabecera (exigirFirmas) va aparte: ver el [X] de abajo
    for (let k = 0; k < 25; k++) {
      const pos = g.int(inicio, S.length - 1);
      const c = g.pick([...'0123456789abcdefAZ"{}[],:-_ .=\\nul']);
      const tipo = g.int(0, 2);
      const M = tipo === 0 ? S.slice(0, pos) + c + S.slice(pos + 1) : tipo === 1 ? S.slice(0, pos) + S.slice(pos + 1) : S.slice(0, pos) + c + S.slice(pos);
      if (M === S) continue;
      let datos;
      try { datos = JSON.parse(M); } catch { continue; }
      let r;
      try { r = await restaurar(datos); } catch (e) {
        assert.equal(e.constructor, Error, e.message);
        rechazos++;
        continue;
      }
      assert.equal(JSON.stringify(serializar(r)), S, 'manipulación aceptada en ' + JSON.stringify(S.slice(Math.max(0, pos - 30), pos + 10)));
    }
  }
  assert.ok(rechazos > 50);
});

test('regresión: el firmante del génesis es su autor; la firma es base64url canónica', async () => {
  const par = await generarClaves();
  const eje = await Eje.genesis({ demostracion: true, identidad: 'r', emision: [], foco: 'g', t: T0, clave: par.publica, privada: par.privada });
  const ev = await eje.escribir({ autor: 'r', sobre: eje.genesisId, t: T0, movimientos: [gastaT('r')], payload: 'x' }, par.privada);
  const datos = () => ida(eje);
  const sinFirmante = datos(); delete sinFirmante.eventos[0].firmante;
  await assert.rejects(restaurar(sinFirmante), /firmante/);
  const otroFirmante = datos(); otroFirmante.eventos[0].firmante = 'otro';
  await assert.rejects(restaurar(otroFirmante), /firmante/);
  const relleno = datos(); relleno.eventos[1].firma += '==';
  await assert.rejects(restaurar(relleno), /firma inválida/);
  // El último carácter de una firma de 64 bytes lleva bits de sobra: solo una variante es válida.
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let validas = 0;
  for (const c of B64) if (await verificar({ ...ev, firma: ev.firma.slice(0, -1) + c }, par.publica)) validas++;
  assert.equal(validas, 1);
});

test('regresión: campos desconocidos o por defecto en un evento guardado no cambian lo restaurado', async () => {
  const eje = await Eje.genesis({ demostracion: true, identidad: 'r', emision: [], foco: 'g', t: T0 });
  await eje.escribir({ autor: 'r', sobre: eje.genesisId, t: T0, movimientos: [gastaT('r')], payload: 'x' });
  const S = JSON.stringify(serializar(eje));
  for (const cambio of [(d) => { d.eventos[1].saldo = 999; }, (d) => { delete d.eventos[1].en; }, (d) => { delete d.eventos[1].contexto; }, (d) => { d.eventos[0].contexto.x = undefined; }]) {
    const d = JSON.parse(S);
    cambio(d);
    assert.equal(JSON.stringify(serializar(await restaurar(d))), S);
  }
});

test('un archivo que rebaja exigirFirmas no se restaura',
  { skip: 'BTML-06: [X] decidir VG si exigirFirmas entra en lo firmado; hoy va fuera (en la cabecera de serializar) y un archivo sin exigirFirmas restaura con la política rebajada' },
  async () => {
    const par = await generarClaves();
    const eje = await Eje.genesis({ demostracion: true, identidad: 'r', emision: [], foco: 'g', t: T0, clave: par.publica, privada: par.privada, exigirFirmas: true });
    const d = ida(eje);
    delete d.exigirFirmas;
    await assert.rejects(restaurar(d));
  });

test('la firma de un autor sin clave registrada no se guarda sin verificar',
  { skip: 'BTML-06: [X] decidir VG qué hacer con la firma de un autor sin clave registrada; hoy se guarda sin verificar y admite cualquier texto («basura» restaura)' },
  async () => {
    const eje = await Eje.genesis({ demostracion: true, identidad: 'r', emision: [], foco: 'g', t: T0 });
    await eje.escribir({ autor: 'r', sobre: eje.genesisId, t: T0, movimientos: [gastaT('r')], payload: 'x' });
    const d = ida(eje);
    d.eventos[1].firmante = 'r';
    d.eventos[1].firma = 'basura';
    await assert.rejects(restaurar(d));
  });
