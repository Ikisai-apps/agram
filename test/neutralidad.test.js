// Neutralidad ante agrupación y división (VG, 7-11 noche; mapa §12 [D]):
// «Emitir desde dos fuentes es igual de válido que emitir el doble desde una
// única fuente. No da más.» La propiedad: dividir una identidad en varias o
// fundir varias en una no cambia lo que obtienen de los demás (saldos que
// reciben de terceros, lo que ve el tercero, orden de sus candidatos,
// recuentos). T queda fuera (VG, 7-11 noche: «T no vale nada por sí
// mismo; es el medidor anti-spam propio»).
//
// Se construyen ejes pequeños con la API de hoy y se compara un mundo con
// una sola identidad («uno») con el mismo guion repartido entre varias
// («dividido») o fundido de nuevo en una («fundido»). Donde el código de hoy
// viola la propiedad, la prueba está escrita igual y va en
// { skip: 'NEU-xx: … [X] decidir VG …' } citando la concesión de
// docs/notas/NEUTRALIDAD_IDENTIDAD.md. No se toca el núcleo.
//
// Encargo 3b (mapa §15 y §16 [D]): se retiran autorizar con umbral, el colateral de R, «R no es fungible», el P del
// génesis y estrechar P. La regla madre se queda; lo que pesa en un recuento es el peso por dominio (el P de A en X ÷
// el P de A en el dominio de X) y solo de quien el dueño nombra; las personas entran por invitación; el P se obtiene
// (diez por registro escrito, por E recibida y por R recibida de su emisor) y no se acuña a mano.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Eje } from '../src/eje.js';
import { crearEvento } from '../src/evento.js';
import * as motor from '../src/motor.js';
import { ocupantes } from '../src/encaje.js';
import * as tiempo from '../src/tiempo.js';
import { confluir } from '../src/bases.js';
import { evaluar } from '../src/bql.js';
import { direccion } from '../src/btml.js';
import { generarClaves } from '../src/autoridad.js';
import { entrarPorInvitacion } from '../ejemplos/ikisai/altas.mjs';

const SEMILLA = 20261107;
const T0 = '2026-11-07T22:00:00Z';
// Las altas, un mes antes de T0 (ya no hace falta: cada persona escribe con su asignación de T del día (VG, 8-11)).
const ALTA = '2026-10-07T22:00:00Z';
const CASOS = 60;

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
  return { r, int: (a, b) => a + Math.floor(r() * (b - a + 1)), pick: (xs) => xs[Math.floor(r() * xs.length)] };
}

// T no cruza de persona (VG, 7-11 noche): ceder minutos a otro es E de la serie de tiempo de quien los da
// (E:<de>/minuto, que el génesis emite); sin destinatario, consumir T propio.
const minuto = (de, cantidad = 1, a = null) => (a === null ? { token: 'T', escala: 'minuto', cantidad, de, a } : { token: 'E', emisor: de, denominacion: 'minuto', cantidad, de, a });
const eur = (emisor, cantidad, de, a) => ({ token: 'E', emisor, denominacion: 'EUR', cantidad, de, a });
let cuenta = 0;
/** Payload único: dos pagos iguales serían el mismo evento (mismo id). */
const unico = (texto) => texto + ' #' + (++cuenta);
const nombres = (base, k) => (k === 1 ? [base] : Array.from({ length: k }, (_, i) => base + (i + 1)));

/** Reparte un entero n > 0 en k partes ≥ 0 al azar (la suma es n). */
function repartir(g, n, k) {
  const cortes = Array.from({ length: k - 1 }, () => g.int(0, n)).sort((a, b) => a - b);
  return [...cortes, n].map((c, i) => c - (i ? cortes[i - 1] : 0));
}

/**
 * Mundo mínimo: génesis «g» (persona), que emite su R y su serie de minutos en
 * su primera transacción (encargo 3b: el génesis no mueve nada); las personas
 * entran por invitación de g (mapa §16 [D]) y reciben minutos; el tercero «C»
 * escribe la casa X sobre su alta (diez posiciones; la plaza 1 declara
 * capacidad 4), y con ello obtiene diez P sobre X (mapa §15 [D] N1); luego
 * emite su R (sin colateral: VG, 9-11) y su E:C/EUR, sobre su alta. Es un eje
 * de demostración, sin claves (R9): lo que se compara aquí son cantidades, no
 * firmas. NEU-08 construye el suyo con claves.
 */
async function mundo(personas, { tercero = 'C', criterio = 'normas' } = {}) {
  const eje = await Eje.genesis({
    demostracion: true,
    identidad: 'g', t: ALTA, foco: ['raíz'],
    emision: [{ token: 'R', cantidad: 1000 }, { token: 'E', denominacion: 'minuto', cantidad: 1e9 }],
  });
  const altas = [tercero, ...personas];
  // B1 (VG, 10-11): las personas escriben su propia alta, aceptando una invitación (encargo 3b).
  for (const id of altas) await entrarPorInvitacion(eje, { por: 'g', quien: id, t: ALTA });
  await eje.escribir({
    autor: 'g', sobre: eje.genesisId, t: ALTA,
    movimientos: [minuto('g'), ...altas.map((id) => minuto('g', 5000, id))],
    payload: 'altas',
  });
  const casa = await eje.escribir({
    autor: tercero, sobre: eje.alta(tercero).id, t: T0, movimientos: [minuto(tercero)],
    payload: ['casa', ['plaza', 30, 4], criterio, 'anfitrión', 'ficha', 'estructura', 'pasado', 'futuro', 'medidas', 'camino'],
  });
  // Emisión: C gasta T, emite su R (D2: emitir E exige R propia emitida) y da un R:C a g; y emite su E, que va sobre su
  // alta, donde tiene P por haberla escrito. Es igual en todos los mundos, así que no cambia lo que se compara.
  await eje.escribir({
    autor: tercero, sobre: casa.id, t: T0,
    movimientos: [minuto(tercero), { token: 'R', emisor: tercero, cantidad: 1000, de: null, a: tercero }, { token: 'R', emisor: tercero, cantidad: 1, de: tercero, a: 'g' },
      // Sus EUR admiten fracciones (céntimos): divisible en la primera emisión (R2, VG 7-11 noche).
      { ...eur(tercero, 1e6, null, tercero), divisible: true }],
    payload: 'emisión de ' + tercero,
  });
  return { eje, X: casa.id };
}

/**
 * Saldos de una identidad sin T (T es el medidor propio; VG, 7-11 noche) ni los minutos que g cede en las altas
 * (E:g/minuto: T no cruza de persona, y lo que antes era T de las altas es ahora E de la serie de tiempo de g), ni
 * la R:g que guarda cada invitación (encargo 3b: entrar cuesta a quien invita una unidad de su R por cabeza; es del
 * guion de las altas, no de lo que se compara). Sin P: el P obtenido son diez por registro escrito y por E o R recibida (mapa §15 [D] N1, N2), así que su cantidad sigue al
 * número de transacciones; lo que pesa es su parte por dominio, que se prueba aparte (abajo, «peso por dominio»).
 */
function sinT(eje, id) {
  return Object.fromEntries([...(eje.saldos.get(id) ?? new Map())].filter(([k, v]) => !k.startsWith('T:') && !k.startsWith('P:') && k !== 'E:g/minuto' && k !== 'R:g' && v !== 0).sort());
}
/** Suma por serie, sin T, de un conjunto de identidades: lo que tiene la coalición. */
function sumaCoalicion(eje, ids) {
  const s = {};
  for (const id of ids) for (const [k, v] of Object.entries(sinT(eje, id))) s[k] = (s[k] ?? 0) + v;
  return Object.fromEntries(Object.entries(s).filter(([, v]) => v !== 0).sort());
}
/** Lo emitido de cada serie sin T ni P (P no se emite: se obtiene): emitir desde una o desde varias fuentes no cambia las series ajenas. */
const seriesAjenas = (eje, ajenos) => eje.series().filter((s) => s.token !== 'T' && s.token !== 'P' && ajenos.includes(s.emisor)).map((s) => [s.clave, s.emitido]);

// ---------- lo que hoy ya es neutral ----------

test('neutral: lo que un tercero paga y lo que la coalición tiene no cambia al dividir ni al fundir (E y R por emisor)', async () => {
  const g = prng(SEMILLA);
  for (let caso = 0; caso < CASOS; caso++) {
    const k = g.int(2, 5);
    const pagos = Array.from({ length: g.int(1, 4) }, () => g.int(1, 500));
    const devuelve = g.int(0, pagos.reduce((s, x) => s + x, 0));
    const r = g.int(1, 100);
    const repartos = pagos.map((p) => repartir(g, p, k));
    const repartoR = repartir(g, r, k);

    // Uno: A recibe todo de C, devuelve una parte y recibe R:C.
    const uno = await mundo(['A']);
    for (const p of pagos) await uno.eje.escribir({ autor: 'C', sobre: uno.X, t: T0, movimientos: [minuto('C'), eur('C', p, 'C', 'A')], payload: unico('pago') });
    if (devuelve) await uno.eje.escribir({ autor: 'A', sobre: uno.X, t: T0, movimientos: [minuto('A'), eur('C', devuelve, 'A', 'C')], payload: 'devolución' });
    await uno.eje.escribir({ autor: 'C', sobre: uno.X, t: T0, movimientos: [minuto('C'), { token: 'R', emisor: 'C', cantidad: r, de: 'C', a: 'A' }], payload: 'aval' });

    // Dividido: A1…Ak reciben lo mismo repartido y devuelven lo mismo entre todas.
    const ids = nombres('A', k);
    const div = await mundo(ids);
    for (const reparto of repartos) {
      await div.eje.escribir({ autor: 'C', sobre: div.X, t: T0, movimientos: [minuto('C'), ...reparto.map((c, i) => [c, ids[i]]).filter(([c]) => c > 0).map(([c, a]) => eur('C', c, 'C', a))], payload: unico('pago') });
    }
    let resta = devuelve;
    for (const id of ids) {
      const c = Math.min(resta, div.eje.saldo(id, 'E:C/EUR'));
      if (c > 0) await div.eje.escribir({ autor: id, sobre: div.X, t: T0, movimientos: [minuto(id), eur('C', c, id, 'C')], payload: 'devolución' });
      resta -= c;
    }
    await div.eje.escribir({ autor: 'C', sobre: div.X, t: T0, movimientos: [minuto('C'), ...repartoR.map((c, i) => [c, ids[i]]).filter(([c]) => c > 0).map(([c, a]) => ({ token: 'R', emisor: 'C', cantidad: c, de: 'C', a }))], payload: 'aval' });

    // Fundido: las k vuelven a juntar su E en A1 (el padre que lleva el dinero de sus hijos); la R se la da C a A1.
    const fun = await mundo(ids);
    for (const reparto of repartos) {
      await fun.eje.escribir({ autor: 'C', sobre: fun.X, t: T0, movimientos: [minuto('C'), ...reparto.map((c, i) => [c, ids[i]]).filter(([c]) => c > 0).map(([c, a]) => eur('C', c, 'C', a))], payload: unico('pago') });
    }
    for (const id of ids.slice(1)) {
      const c = fun.eje.saldo(id, 'E:C/EUR');
      if (c > 0) await fun.eje.escribir({ autor: id, sobre: fun.X, t: T0, movimientos: [minuto(id), eur('C', c, id, ids[0])], payload: 'al padre' });
    }
    if (devuelve) await fun.eje.escribir({ autor: ids[0], sobre: fun.X, t: T0, movimientos: [minuto(ids[0]), eur('C', devuelve, ids[0], 'C')], payload: 'devolución' });
    await fun.eje.escribir({ autor: 'C', sobre: fun.X, t: T0, movimientos: [minuto('C'), { token: 'R', emisor: 'C', cantidad: r, de: 'C', a: ids[0] }], payload: 'aval' });

    const msg = 'caso ' + caso + ' (k=' + k + ')';
    for (const otro of [div, fun]) {
      assert.deepEqual(sinT(otro.eje, 'C'), sinT(uno.eje, 'C'), msg + ': lo que tiene el tercero');
      assert.deepEqual(sumaCoalicion(otro.eje, ids), sumaCoalicion(uno.eje, ['A']), msg + ': lo que tiene la coalición');
      assert.deepEqual(seriesAjenas(otro.eje, ['C', 'g']), seriesAjenas(uno.eje, ['C', 'g']), msg + ': las series ajenas');
    }
    // El padre tiene lo mismo que la persona sola.
    assert.equal(fun.eje.saldo(ids[0], 'E:C/EUR'), uno.eje.saldo('A', 'E:C/EUR'), msg);
  }
});

// VG, 9-11 (mapa §15 [D] «R según el corpus»): R se transfiere entre tenedores sin cambiar de emisor (se corrige la
// #62, que solo dejaba devolverla). Juntarla en un «padre» no amplía su serie ni le da más valor que tenerla repartida:
// el valor de R es por unidad y con la lente del lector (test/lente.test.js).
test('neutral: juntar R ajena no la amplía, y nadie emite la serie de otro, sea uno o sean varios', async () => {
  const { eje, X } = await mundo(['A1', 'A2']);
  await eje.escribir({ autor: 'C', sobre: X, t: T0, movimientos: [minuto('C'), { token: 'R', emisor: 'C', cantidad: 5, de: 'C', a: 'A1' }], payload: 'aval' });
  const emitida = eje.serie('R:C').emitido;
  await eje.escribir({ autor: 'A1', sobre: X, t: T0, movimientos: [minuto('A1'), { token: 'R', emisor: 'C', cantidad: 5, de: 'A1', a: 'A2' }], payload: 'juntar' });
  assert.deepEqual([eje.saldo('A1', 'R:C'), eje.saldo('A2', 'R:C'), eje.serie('R:C').emitido], [0, 5, emitida]);
  // Ninguna de las dos emite E:C/EUR ni R:C: más nombres no amplían la serie de un tercero.
  await assert.rejects(eje.escribir({ autor: 'A2', sobre: X, t: T0, movimientos: [minuto('A2'), eur('C', 100, null, 'C')], payload: 'falsificar' }), /(E is minted by and to|E\/R is minted by|R is minted by) its issuer/);
  await assert.rejects(eje.escribir({ autor: 'A1', sobre: X, t: T0, movimientos: [minuto('A1'), { token: 'R', emisor: 'C', cantidad: 5, de: null, a: 'C' }], payload: 'falsificar' }), /(E is minted by and to|E\/R is minted by|R is minted by) its issuer/);
  assert.equal(eje.serie('E:C/EUR').emitido, 1e6);
});

test('neutral: delegar P reparte y no copia; dividir el P recibido no cambia lo que llega a un tercero', async () => {
  const g = prng(SEMILLA + 1);
  for (let caso = 0; caso < CASOS; caso++) {
    const k = g.int(2, 6);
    const p = g.int(1, 9);
    const aC = g.int(0, p);
    // Mapa §15 [D] N1: C tiene diez P sobre X por haberlo escrito, y nadie acuña más a mano; lo reparte.
    const uno = await mundo(['A']);
    await uno.eje.escribir({ autor: 'C', sobre: uno.X, t: T0, movimientos: [minuto('C'), { token: 'P', ambito: uno.X, cantidad: p, de: 'C', a: 'A' }], payload: unico('delega') });
    if (aC) await uno.eje.escribir({ autor: 'A', sobre: uno.X, t: T0, movimientos: [minuto('A'), { token: 'P', ambito: uno.X, cantidad: aC, de: 'A', a: 'C' }], payload: unico('delega') });

    const ids = nombres('A', k);
    const div = await mundo(ids);
    const reparto = repartir(g, p, k);
    await div.eje.escribir({ autor: 'C', sobre: div.X, t: T0, movimientos: [minuto('C'), ...reparto.map((c, i) => [c, ids[i]]).filter(([c]) => c > 0).map(([c, a]) => ({ token: 'P', ambito: div.X, cantidad: c, de: 'C', a }))], payload: unico('delega') });
    let resta = aC;
    for (const id of ids) {
      const c = Math.min(resta, div.eje.saldo(id, 'P:' + div.X));
      if (c > 0) await div.eje.escribir({ autor: id, sobre: div.X, t: T0, movimientos: [minuto(id), { token: 'P', ambito: div.X, cantidad: c, de: id, a: 'C' }], payload: unico('delega') });
      resta -= c;
    }
    const msg = 'caso ' + caso;
    assert.equal(div.eje.poderSobre('C', div.X), uno.eje.poderSobre('C', uno.X), msg + ': el P que llega al tercero');
    assert.equal(ids.reduce((s, id) => s + div.eje.poderSobre(id, div.X), 0), uno.eje.poderSobre('A', uno.X), msg + ': el P de la coalición');
    assert.equal(div.eje.saldo('C', 'P:' + div.X), uno.eje.saldo('C', 'P:' + uno.X), msg + ': el P que conserva el dueño');
    const acunadoX = (m) => m.eje.libro.sumas({ primitiva: 'acunar', serie: 'P:' + m.X });
    assert.deepEqual([acunadoX(div), acunadoX(uno)], [10, 10], msg + ': lo acuñado sobre X no crece al repartir');
  }
});

test('neutral: el orden de los candidatos en la posición de un tercero no depende de quién los escribe', async () => {
  const g = prng(SEMILLA + 2);
  for (let caso = 0; caso < CASOS / 2; caso++) {
    const k = g.int(2, 5);
    const textos = Array.from({ length: g.int(1, 6) }, (_, i) => 'oferta ' + i);
    const dirs = textos.map(() => g.pick([[1], [1, 2], [1, 0, 3]]));
    const autores = textos.map(() => g.int(0, k - 1));
    const uno = await mundo(['A']);
    const ids = nombres('A', k);
    const div = await mundo(ids);
    for (let i = 0; i < textos.length; i++) {
      await uno.eje.escribir({ autor: 'A', sobre: uno.X, en: direccion(dirs[i]), t: T0, movimientos: [minuto('A')], payload: textos[i] });
      await div.eje.escribir({ autor: ids[autores[i]], sobre: div.X, en: direccion(dirs[i]), t: T0, movimientos: [minuto(ids[autores[i]])], payload: textos[i] });
    }
    const vista = (m) => ocupantes(m.eje, m.X, [1]).map((o) => [o.tipo, JSON.stringify(o.contenido), o.vector.join(',')]);
    assert.deepEqual(vista(div), vista(uno), 'caso ' + caso);
  }
});

// ---------- lo que hoy viola la propiedad (skip con id y concesión) ----------

// Encargo 3b (VG, 8-11, mapa §15 [D] «P como peso de criterio» y «Una sola operación: registrar»): se retiran autorizar
// con umbral y los estados del motor. Una decisión de C sobre X se cuenta con el criterio que C escribe en su 2 (la
// plantilla en 2.2, a quién cuenta y con qué presión en 2.3; por defecto, solo C), y cada compromiso (P bloqueado con
// la salida = la decisión) pesa por dominio: el P comprometido ÷ el P de su titular en el dominio de X. NEU-01 y NEU-02
// se reescriben sobre ese recuento.

/** Una decisión de C sobre X con la lista dada en su 2.3 (sin lista: solo cuenta C). */
async function decisionDeC(m, lista) {
  const criterio = lista ? [['decidir'], ['x'], ['weighted sum'], lista] : [['decidir'], ['x'], ['weighted sum']];
  return m.eje.escribir({ autor: 'C', sobre: m.X, t: T0, movimientos: [minuto('C')], payload: [unico('¿abrimos?'), ['x'], criterio] });
}
/** C reparte las partes de su P sobre X entre las identidades y cada una lo compromete con D; todo escrito fuera del dominio de C. */
async function comprometen(m, D, ids, partes) {
  const dar = partes.map((c, i) => [c, ids[i]]).filter(([c]) => c > 0);
  if (dar.length) await m.eje.escribir({ autor: 'C', sobre: m.eje.alta('C').id, t: T0, payload: unico('reparte'), movimientos: [minuto('C'), ...dar.map(([c, a]) => ({ token: 'P', ambito: m.X, cantidad: c, de: 'C', a }))] });
  for (const [c, a] of dar) {
    await m.eje.escribir({ autor: a, sobre: m.eje.alta(a).id, t: T0, payload: unico('comprometo'), movimientos: [minuto(a), { token: 'P', ambito: m.X, cantidad: c, de: a, a, estado: 'bloqueo', salida: D.id }] });
  }
  const r = motor.recuento(m.eje, D.id);
  return [r.valor, r.pasa];
}

test('NEU-01: con una segunda identidad, A no gana peso en la decisión de C; por defecto solo cuenta el dueño', async () => {
  const uno = await mundo(['A']);
  const D1 = await decisionDeC(uno);
  assert.deepEqual(await comprometen(uno, D1, ['A'], [4]), [0, false]);
  const dos = await mundo(['A', 'A2']);
  const D2 = await decisionDeC(dos);
  assert.deepEqual(await comprometen(dos, D2, ['A', 'A2'], [2, 2]), [0, false], 'dividirse no cambia el recuento');
  // Lo positivo: C compromete su P sobre la decisión (diez, por escribirla) y pasa.
  await dos.eje.escribir({ autor: 'C', sobre: D2.id, t: T0, payload: 'sí', movimientos: [minuto('C'), { token: 'P', ambito: D2.id, cantidad: 10, de: 'C', a: 'C', estado: 'bloqueo', salida: D2.id }] });
  assert.equal(motor.recuento(dos.eje, D2.id).pasa, true);
});

test('NEU-02: repartir el mismo P entre más identidades que el dueño no nombra no da más peso', async () => {
  // C nombra a B en su 2.3: solo B cuenta. Repartir lo de B entre B y k títeres no nombrados no cambia el recuento.
  const recuento = async (k) => {
    const ids = ['B', ...nombres('T', k)];
    const m = await mundo(ids);
    const D = await decisionDeC(m, ['B']);
    return comprometen(m, D, ids, ids.map((id, i) => (i === 0 ? 6 / (k + 1) : 6 / (k + 1))));
  };
  const solo = await (async () => { const m = await mundo(['B']); const D = await decisionDeC(m, ['B']); return comprometen(m, D, ['B'], [6]); })();
  assert.deepEqual(solo, [1, true]);
  for (const k of [1, 3, 5]) assert.deepEqual(await recuento(k), solo, 'k=' + k);
});

test('propiedad (NEU-02): con una lista de nombres, repartir el P de una nombrada entre k identidades no nombradas no cambia el recuento', async () => {
  const g = prng(SEMILLA + 3);
  for (let caso = 0; caso < CASOS / 6; caso++) {
    const n = g.int(1, 9); // el P de X que C da a la coalición
    const k = g.int(2, 5);
    const nombradas = g.int(0, 1) ? ['A'] : ['A', 'Z'];
    const reparto = repartir(g, n, k);
    const uno = await mundo(['A', 'Z']);
    const D1 = await decisionDeC(uno, nombradas);
    const r1 = await comprometen(uno, D1, ['A'], [n]);
    // Dividido: A conserva su parte y el resto va a títeres que nadie nombra.
    const ids = ['A', ...nombres('T', k - 1)];
    const div = await mundo([...ids, 'Z']);
    const D2 = await decisionDeC(div, nombradas);
    const r2 = await comprometen(div, D2, ids, reparto);
    const msg = 'caso ' + caso + ' (n=' + n + ', k=' + k + ', ' + JSON.stringify(reparto) + ')';
    // Los títeres no cuentan; A cuenta su 100 % por dominio si compromete algo (su P en el dominio de C es el que compromete).
    assert.equal(r2[0], reparto[0] > 0 ? r1[0] : 0, msg);
    assert.ok(r2[0] <= r1[0], msg + ': dividirse nunca da más');
  }
});

// NEU-10: con «cualquiera» en el 2.3 todas cuentan, y cada una pesa su 100 % por dominio: k identidades que comprometen
// todo su P en el dominio suman k. Se salta hasta que VG decida.
test('NEU-10: con «cualquiera» en el 2.3, repartir el mismo P entre k identidades no multiplica el recuento', {
  skip: 'NEU-10: [X] decidir VG. Con «cualquiera» la plantilla «weighted sum» suma el peso por dominio de cada identidad (presión ÷ 9 × comprometido ÷ su P en el dominio): una sola con 6 de P da 1; tres con 2 cada una dan 3. La regla madre pide que dependa de cantidades, no de cabezas: o «cualquiera» pesa por cantidad comprometida sobre el total, o el peso por dominio no se suma entre identidades (mapa §15 [D] (3) y (4))',
}, async () => {
  const valor = async (k) => {
    const ids = nombres('A', k);
    const m = await mundo(ids);
    const D = await decisionDeC(m, ['cualquiera']);
    return (await comprometen(m, D, ids, ids.map(() => 6 / k)))[0];
  };
  assert.equal(await valor(3), await valor(1));
});

// Peso por dominio (VG, 8-11, mapa §15 [D] (3): «cada persona se lee como su 100 %»): el P de A sobre X ÷ el P de A en
// el dominio de X (lectura «share» de la época; src/motor.js, peso). Lo que se cumple: es una razón de cantidades, así
// que repartir el P de A entre k identidades en la misma proporción deja a cada una el peso de A, y fundirlas lo
// conserva. Lo que no (NEU-09, abajo): pasar a un títere el P de A fuera de X sube el peso de A sobre X.

/** C da a cada una de las identidades x de P sobre X e y sobre Y (otro registro de su dominio); devuelve el mundo e Y. */
async function pesoEnDominio(ids, x, y) {
  const m = await mundo(ids);
  const Y = await m.eje.escribir({ autor: 'C', sobre: m.X, t: T0, payload: 'Y', movimientos: [minuto('C')] });
  await m.eje.escribir({ autor: 'C', sobre: m.eje.alta('C').id, t: T0, payload: unico('reparte'), movimientos: [minuto('C'),
    ...ids.flatMap((a) => [{ token: 'P', ambito: m.X, cantidad: x, de: 'C', a }, { token: 'P', ambito: Y.id, cantidad: y, de: 'C', a }]).filter((p) => p.cantidad > 0)] });
  return { ...m, Y: Y.id };
}

test('neutral (peso por dominio): repartir el P de una identidad en proporción entre k, o fundirlo, no cambia el peso de cada una', async () => {
  const g = prng(SEMILLA + 8);
  for (let caso = 0; caso < 8; caso++) {
    const k = g.int(2, 4);
    const [x, y] = [g.int(1, 2), g.int(0, 2)]; // C tiene diez P sobre X y diez sobre Y: k·x y k·y no pasan de 8
    // Uno: A con k·x sobre X y k·y sobre Y. Dividido: k identidades con x y y cada una. Fundido: las k pasan todo a A1,
    // escribiendo fuera del dominio de C (escribir dentro le daría a quien escribe diez P más en él).
    const uno = await pesoEnDominio(['A'], k * x, k * y);
    const ids = nombres('A', k);
    const div = await pesoEnDominio(ids, x, y);
    const fun = await pesoEnDominio(ids, x, y);
    for (const id of ids.slice(1)) {
      await fun.eje.escribir({ autor: id, sobre: fun.eje.alta(id).id, t: T0, payload: unico('al padre'), movimientos: [minuto(id),
        { token: 'P', ambito: fun.X, cantidad: x, de: id, a: ids[0] }, ...(y ? [{ token: 'P', ambito: fun.Y, cantidad: y, de: id, a: ids[0] }] : [])] });
    }
    const esperado = x / (x + y);
    const msg = 'caso ' + caso + ' (k=' + k + ', x=' + x + ', y=' + y + ')';
    assert.ok(Math.abs(motor.peso(uno.eje, 'A', uno.X) - esperado) < 1e-9, msg);
    for (const id of ids) assert.ok(Math.abs(motor.peso(div.eje, id, div.X) - esperado) < 1e-9, msg + ': ' + id);
    assert.ok(Math.abs(motor.peso(fun.eje, ids[0], fun.X) - esperado) < 1e-9, msg + ': fundido');
  }
});

test('NEU-09: el peso por dominio es invariante ante dividir o fundir identidades (pasar a un títere el P de fuera de X no sube el peso sobre X)', {
  skip: 'NEU-09: [X] decidir VG. El peso por dominio es una razón por identidad (mapa §15 [D] (3)): A con 5 de P sobre X y 5 sobre Y (mismo dominio) pesa 0,5 sobre X; si pasa los 5 de Y a un títere A2 (escribiendo fuera del dominio), A pesa 1 sobre X y A2 pesa 1 sobre Y. Sin coste, y la suma de pesos se dobla. Opciones: medir el 100 % sobre lo obtenido y no sobre lo que se tiene, o que el P transferido no cuente en el denominador de quien lo da',
}, async () => {
  const m = await pesoEnDominio(['A', 'A2'], 0, 0);
  await m.eje.escribir({ autor: 'C', sobre: m.eje.alta('C').id, t: T0, payload: unico('reparte'), movimientos: [minuto('C'), { token: 'P', ambito: m.X, cantidad: 5, de: 'C', a: 'A' }, { token: 'P', ambito: m.Y, cantidad: 5, de: 'C', a: 'A' }] });
  const antes = motor.peso(m.eje, 'A', m.X);
  assert.equal(antes, 0.5);
  await m.eje.escribir({ autor: 'A', sobre: m.eje.alta('A').id, t: T0, payload: 'a A2', movimientos: [minuto('A'), { token: 'P', ambito: m.Y, cantidad: 5, de: 'A', a: 'A2' }] });
  assert.equal(motor.peso(m.eje, 'A', m.X), antes);
});

// NEU-03 ya no se salta: el ciclo E/P/R/T (PR #62, VG 7-11 noche: «emite siempre una persona») lo implementa
// (src/tokens.js: EMITEN = ['persona']; src/ciclo.js).
// VG, 8-11: «lo único que tenemos de grupo es la delegación»: no hay identidades de grupo, y nadie emite a nombre de otro.
test('NEU-03: agruparse no añade un emisor (no hay identidades de grupo; un grupo es un registro con P delegado)',
  async () => {
    const { eje, X } = await mundo(['P1', 'P2']);
    // No hay tipo (B1), así que tampoco «grupo»: un alta no declara qué es nadie.
    await assert.rejects(eje.escribir({ autor: 'g', sobre: eje.genesisId, t: T0, movimientos: [minuto('g'), minuto('g', 5, 'G')], payload: 'un grupo', contexto: { tipos: { G: 'grupo' } } }), /no hay tipo en el alta/);
    await assert.rejects(
      eje.escribir({ autor: 'P1', sobre: X, t: T0, movimientos: [minuto('P1'), { token: 'R', emisor: 'P2', cantidad: 100, de: null, a: 'P2' }], payload: 'R de los dos' }),
      /(E is minted by and to|R is minted by) its issuer/,
    );
  });

/**
 * La casa de `capacidad` plazas (R2, VG 7-11 noche): un registro H de C que
 * declara su capacidad en la posición 2. C tiene diez P sobre H por escribirlo
 * (mapa §15 [D] N1) y reparte `partes` entre las fuentes; si `resto` > 0, lo
 * compromete él con otra serie atada a H (así la cuota de las fuentes no es
 * toda la capacidad: D1 y F1, VG 9-11). Cada fuente emite antes su R (D2: emitir
 * E exige R propia emitida; sin colateral desde el encargo 3b).
 */
async function casaDe(m, { capacidad = 4, fuentes, partes, resto = 0 }) {
  const H = await m.eje.escribir({ autor: 'C', sobre: m.X, t: T0, movimientos: [minuto('C')], payload: ['casa de ' + capacidad, ['plaza', 30], capacidad] });
  await m.eje.escribir({ autor: 'C', sobre: H.id, t: T0, payload: unico('reparte'), movimientos: [minuto('C'), ...fuentes.map((f, i) => ({ token: 'P', ambito: H.id, cantidad: partes[i], de: 'C', a: f })).filter((x) => x.cantidad > 0),
    ...(resto > 0 ? [{ token: 'P', ambito: H.id, cantidad: resto, de: 'C', a: 'C', estado: 'bloqueo', salida: 'E:C/reserva@' + H.id }] : [])] });
  for (const f of fuentes) await m.eje.escribir({ autor: f, sobre: m.X, t: T0, payload: unico('R de ' + f), movimientos: [minuto(f), { token: 'R', emisor: f, cantidad: 10, de: null, a: f }] });
  return H.id;
}

/** Evento de `f` que bloquea `bloquea` de P:`ambito` con la salida = la serie y emite `cantidad` de E atada a `registro`. */
function emiteAtada(f, { registro, sobre = registro, ambito = registro, denominacion = 'plaza-noche', cantidad, bloquea = 0, emisores, otros = [] }) {
  const clave = 'E:' + f + '/' + denominacion + '@' + registro;
  return {
    autor: f, sobre, t: T0, payload: unico('respaldo ' + cantidad),
    movimientos: [
      minuto(f), ...otros,
      ...(bloquea ? [{ token: 'P', ambito, cantidad: bloquea, de: f, a: f, estado: 'bloqueo', salida: clave }] : []),
      { token: 'E', emisor: f, denominacion, registro, cantidad, de: null, a: f, ...(emisores ? { emisores } : {}) },
    ],
  };
}

/** Lo más que acepta el eje de una emisión (de `desde` hacia abajo), sin escribirla; 0 si nada. */
async function maximoAceptado(eje, hacer, desde) {
  for (let c = desde; c > 0; c--) {
    const ev = await crearEvento(hacer(c));
    if (!(await eje.validar(ev)).length) return c;
  }
  return 0;
}

test('NEU-04: dos fuentes no respaldan más E sobre el mismo recurso que una (la casa tiene 4 plazas)', async () => {
  // Antes (concesión C4): A y A2 emitían 4 + 4 plazas sobre la misma casa de 4. Con R2 la serie va atada al
  // registro H, el E vivo de H no pasa de su capacidad y cada fuente emite en proporción a su P:H comprometido (D1).
  const emitido = async (fuentes) => {
    const m = await mundo(fuentes);
    const H = await casaDe(m, { capacidad: 4, fuentes, partes: fuentes.map(() => 4 / fuentes.length) });
    let total = 0;
    for (const f of fuentes) {
      const cada = 4 / fuentes.length;
      // Cada fuente intenta respaldar las 4 plazas y se queda con lo que el eje le acepta.
      const c = await maximoAceptado(m.eje, (cantidad) => emiteAtada(f, { registro: H, cantidad, bloquea: cada }), 4);
      if (c) await m.eje.escribir(emiteAtada(f, { registro: H, cantidad: c, bloquea: cada }));
      total += c;
    }
    assert.ok(m.eje.topes(H, T0)[0].vivo <= 4);
    return total;
  };
  const capacidad = motor.capacidadDe(['plaza', 30, 4]);
  assert.ok(await emitido(['A']) <= capacidad);
  assert.equal(await emitido(['A', 'A2']), await emitido(['A']));
  assert.equal(await emitido(['A', 'A2', 'A3', 'A4']), await emitido(['A']));
});

test('neutral (R2): repartir la capacidad de un registro entre k emisores con el mismo P total no cambia el E vivo máximo', async () => {
  const g = prng(SEMILLA + 4);
  for (let caso = 0; caso < 20; caso++) {
    const capacidad = g.int(1, 9);
    const pH = g.int(1, 6);
    const k = g.int(2, 4);
    const total = g.int(k, Math.max(k, pH));
    const resto = Math.max(pH, total) - total; // lo que C compromete con otra serie de H (D1: el denominador)
    const partes = repartir(g, total - k, k).map((x) => x + 1); // cada una al menos 1: cada coemisor firma con su bloqueo
    const maximo = async (fuentes, cuotas) => {
      const m = await mundo(fuentes);
      const H = await casaDe(m, { capacidad, fuentes, partes: cuotas, resto });
      const S = 'E:' + fuentes[0] + '/plaza-noche@' + H;
      // Los coemisores firman con su bloqueo; el primero bloquea el suyo y emite por todos.
      for (let i = 1; i < fuentes.length; i++) {
        await m.eje.escribir({ autor: fuentes[i], sobre: H, t: T0, payload: unico('firma'), movimientos: [minuto(fuentes[i]), { token: 'P', ambito: H, cantidad: cuotas[i], de: fuentes[i], a: fuentes[i], estado: 'bloqueo', salida: S }] });
      }
      const conjunta = fuentes.length > 1 ? fuentes : undefined;
      return maximoAceptado(m.eje, (c) => emiteAtada(fuentes[0], { registro: H, cantidad: c, bloquea: cuotas[0], emisores: conjunta }), capacidad + 1);
    };
    const uno = await maximo(['A'], [total]);
    const varios = await maximo(nombres('A', k), partes);
    assert.equal(uno, Math.min(capacidad, Math.floor((total * capacidad) / (total + resto))), 'caso ' + caso);
    assert.equal(varios, uno, 'caso ' + caso + ': ' + JSON.stringify({ capacidad, pH, k, total, partes }));
  }
});

test('neutral (R2): partir el recurso en subregistros no esquiva el tope del ancestro', async () => {
  const g = prng(SEMILLA + 5);
  let aceptadas = 0;
  for (let caso = 0; caso < 8; caso++) {
    const fuentes = nombres('A', g.int(2, 3));
    const m = await mundo(fuentes);
    const capacidad = g.int(1, 6);
    const H = await casaDe(m, { capacidad, fuentes, partes: fuentes.map(() => 1) });
    // Antes, g les delegaba además P:H estrechado de su P:genesis. Encargo 3b (mapa §15 [D]): no hay P del génesis ni
    // se estrecha, y nadie acuña P a mano. Lo que se prueba sigue igual: ningún subregistro esquiva el tope de H.
    await assert.rejects(
      m.eje.escribir({ autor: 'g', sobre: H, t: T0, payload: unico('acuña'), movimientos: [minuto('g'), ...fuentes.map((f) => ({ token: 'P', ambito: H, cantidad: 4, de: null, a: f }))] }),
      /P is repositioned one step at a time|nadie acuña P a mano/,
    );
    // Cada fuente escribe dentro de H un subregistro suyo, con capacidad propia (a veces mucho mayor) o sin ella: tiene
    // diez P sobre él por escribirlo (N1).
    const subs = [];
    for (const f of fuentes) {
      const declarada = g.pick([undefined, capacidad, 10 * capacidad + 7]);
      const S = await m.eje.escribir({ autor: f, sobre: H, t: T0, movimientos: [minuto(f)], payload: declarada ? ['rincón de ' + f, ['camas'], declarada] : ['rincón de ' + f, ['camas']] });
      subs.push({ f, id: S.id, declarada });
    }
    for (let intento = 0; intento < 10; intento++) {
      const { f, id } = g.pick(subs);
      const registro = g.pick([id, H]);
      const otros = registro === H ? [] : [{ token: 'P', ambito: id, cantidad: 1, de: f, a: f, estado: 'bloqueo', salida: 'E:' + f + '/d' + intento + '@' + registro }];
      const disponible = m.eje.saldo(f, 'P:' + H);
      const ev = emiteAtada(f, { registro, ambito: H, denominacion: 'd' + intento, cantidad: g.int(1, 2 * capacidad), bloquea: disponible > 0 ? g.int(1, disponible) : 0, otros });
      await m.eje.escribir(ev).then(() => aceptadas++, () => {}); // rechazada: no cuenta
      const [deH] = m.eje.topes(H, T0).filter((x) => x.registro === H);
      assert.ok(deH.vivo <= capacidad, 'caso ' + caso + ': el E vivo de H (' + deH.vivo + ') pasa de su capacidad ' + capacidad);
      for (const s of subs) for (const x of m.eje.topes(s.id, T0)) assert.ok(x.vivo <= x.capacidad);
    }
  }
  assert.ok(aceptadas > 0, 'alguna emisión ha de entrar: si no, la prueba no prueba nada');
});

test('NEU-05: el 8 no tiene ranking que cambie al partir un escrito en piezas o en autores (VG, 7-11 noche: se retira comparar())', async () => {
  // La concesión «ranking por recuentos» (tiempo.comparar: posiciones + 2·escritos + movimientos) ya no existe:
  // el 8 sitúa en cajas, sin puesto ni puntuación, y solo por cantidades (R7, VG 7-11 noche).
  assert.equal(tiempo.comparar, undefined);
  {
    const puesto = async (k) => {
      const ids = nombres('A', k);
      const m = await mundo(['A', ...ids.filter((x) => x !== 'A')]);
      const Y = await m.eje.escribir({ autor: 'A', sobre: m.X, t: T0, movimientos: [minuto('A')], payload: 'Y' });
      if (k === 1) await m.eje.escribir({ autor: 'A', sobre: Y.id, t: T0, movimientos: [minuto('A', 10)], payload: Array.from({ length: 10 }, (_, i) => 'p' + i) });
      else for (let i = 0; i < 10; i++) await m.eje.escribir({ autor: ids[i % k], sobre: Y.id, t: T0, movimientos: [minuto(ids[i % k])], payload: 'p' + i });
      const c = confluir(m.eje, Y.id);
      const sitio = Object.fromEntries(Object.entries(c.tokens).map(([k, x]) => [k, [x.foco, x.caja, x.cuota, x.cajaCuota]]));
      return { sinPuesto: [c.posicion, c.puntuacion, ...c.comparables.map((x) => x.puntuacion)].filter((x) => x !== undefined), sitio };
    };
    const [diez, uno] = [await puesto(10), await puesto(1)];
    assert.deepEqual([diez.sinPuesto, uno.sinPuesto], [[], []]);
    // R7: partir el escrito en diez piezas de diez autores no cambia dónde cae Y por cantidades (su caja y su cuota).
    assert.deepEqual(diez.sitio, uno.sitio);
    assert.ok('tiempo:minuto' in uno.sitio, 'el T gastado encima de Y es una de sus cantidades');
  }
});

// NEU-06 ya no se salta: R7, el 8 solo funde cantidades (VG, 7-11 noche). Lo que el 8 compara de un pago son las
// sumas por serie y su cuota; identidades y movimientos siguen medidos, pero son recuentos informativos, sin caja.
test('NEU-06: lo que el 8 compara de un pago no cambia al repartirlo entre más identidades', async () => {
  const medidas = async (k) => {
    const ids = nombres('A', k);
    const m = await mundo(ids);
    const ev = await m.eje.escribir({ autor: 'C', sobre: m.X, t: T0, movimientos: [minuto('C'), ...ids.map((a) => eur('C', 8 / k, 'C', a))], payload: 'pago' });
    const c = confluir(m.eje, ev.id);
    const recuentos = [c.medidas.identidades, c.medidas.movimientos];
    assert.ok(recuentos.every((x) => x.recuento === true && !('caja' in x)), 'los recuentos se informan y no se sitúan');
    return Object.fromEntries(Object.entries(c.tokens).map(([s, x]) => [s, { foco: x.foco, suma: x.suma, caja: x.caja, cuota: x.cuota, cajaCuota: x.cajaCuota }]));
  };
  const [ocho, uno] = [await medidas(8), await medidas(1)];
  assert.deepEqual(ocho, uno);
  assert.deepEqual([uno['E:C/EUR'].foco, uno['E:C/EUR'].cuota], [8, 8 / uno['E:C/EUR'].suma]);
});

// NEU-07 ya no se salta: R8, elegibilidad antes que límites (src/elegibles.js; mapa §12 [D] «Quién ocupa una
// posición ajena»: elegible por defecto = el autor y quien aparece en su posición 3). BUSCAR filtra los elegibles y
// después aplica el límite; el ruido ajeno solo se cuenta (noElegibles).
test('NEU-07: escritos ajenos que el dueño no considera elegibles no le bloquean su BUSCAR', async () => {
  const buscar = async (ruido) => {
    const ids = nombres('S', Math.max(ruido, 1));
    const m = await mundo(ids);
    // El mercado del dueño: su posición 2 (criterio) busca entre los candidatos de su posición 1.
    const Z = await m.eje.escribir({ autor: 'C', sobre: m.X, t: T0, movimientos: [minuto('C')], payload: ['mercado', 'ofertas', '=BUSCAR(1)'] });
    await m.eje.escribir({ autor: 'C', sobre: Z.id, en: direccion([1]), t: T0, movimientos: [minuto('C')], payload: 'oferta del dueño' });
    for (let i = 0; i < ruido; i++) await m.eje.escribir({ autor: ids[i], sobre: Z.id, en: direccion([1]), t: T0, movimientos: [minuto(ids[i])], payload: 'ruido ' + i });
    const r = evaluar(m.eje, Z.id, [2], { limites: { candidatos: 3 } });
    return { estado: r.estado, candidatos: r.valor?.items.map((i) => [i.origen, i.evento]), fuera: r.valor?.noElegibles ?? 0 };
  };
  const [con, sin] = [await buscar(4), await buscar(0)];
  assert.deepEqual([con.estado, con.candidatos], [sin.estado, sin.candidatos]);
  assert.equal(con.estado, 'RESUELTO');
  assert.deepEqual([con.fuera, sin.fuera], [4, 0]); // el recuento informa y no puntúa
});

test('propiedad (R8): N identidades falsas con ruido en la posición del dueño no cambian lo que su BUSCAR devuelve ni su orden', async () => {
  const g = prng(SEMILLA + 7);
  for (let caso = 0; caso < CASOS / 3; caso++) {
    const guion = Array.from({ length: g.int(1, 5) }, (_, i) => ({ autor: g.pick(['C', 'A']), texto: 'oferta ' + i, dir: g.pick([[1], [1], [1, 2]]) }));
    const falsas = nombres('F', g.int(1, 8));
    const ruido = Array.from({ length: g.int(1, 12) }, (_, i) => ({ autor: g.pick(falsas), texto: 'ruido ' + i, dir: g.pick([[1], [1, 2], [1, 0]]), antes: g.int(0, guion.length) }));
    const limite = guion.length + 1; // cabe lo del dueño y lo de A; con el ruido delante, hoy no cabría
    const correr = async (conRuido) => {
      // A aparece en el 3 del mercado: es elegible. Las falsas solo existen en el mundo con ruido.
      const m = await mundo(conRuido ? ['A', ...falsas] : ['A']);
      const Z = await m.eje.escribir({ autor: 'C', sobre: m.X, t: T0, movimientos: [minuto('C')], payload: ['mercado', 'ofertas', '=BUSCAR("1000000000")', 'A'] });
      for (let k = 0; k <= guion.length; k++) {
        if (conRuido) for (const x of ruido.filter((r) => r.antes === k)) await m.eje.escribir({ autor: x.autor, sobre: Z.id, en: direccion(x.dir), t: T0, movimientos: [minuto(x.autor)], payload: x.texto });
        const x = guion[k];
        if (x) await m.eje.escribir({ autor: x.autor, sobre: Z.id, en: direccion(x.dir), t: T0, movimientos: [minuto(x.autor)], payload: x.texto });
      }
      const r = evaluar(m.eje, Z.id, [2], { limites: { candidatos: limite } });
      const propuesta = motor.proponer(m.eje, Z.id, { posiciones: [2] }).elecciones[2]?.candidato.evento;
      return { estado: r.estado, orden: r.valor?.items.map((i) => [i.origen, i.evento, i.autor ?? null]), propuesta };
    };
    const [sin, con] = [await correr(false), await correr(true)];
    // El mercado, sus escritos y los de A tienen el mismo id en los dos mundos: cuelgan de X, que no depende de las altas.
    assert.deepEqual(con, sin, 'caso ' + caso);
    assert.equal(sin.estado, 'RESUELTO', 'caso ' + caso);
  }
});

/**
 * Un eje con claves, sin demostración (R9): g firma el génesis y su emisión; S2
 * entra aceptando la invitación de g (B1: una persona) con su clave, firmada
 * con ella (su prueba de posesión), y S3 recibe tokens sin clave (una cosa de g).
 */
async function mundoConClaves() {
  const [kg, k2] = [await generarClaves(), await generarClaves()];
  const eje = await Eje.genesis({
    identidad: 'g', t: T0, foco: ['raíz'], clave: kg.publica, privada: kg.privada,
    emision: [{ token: 'R', cantidad: 10 }, { token: 'E', denominacion: 'minuto', cantidad: 1e9 }],
  });
  await entrarPorInvitacion(eje, { por: 'g', quien: 'S2', t: T0, clave: k2, privadaDe: () => kg.privada });
  const X = await eje.escribir({
    autor: 'g', sobre: eje.genesisId, t: T0, movimientos: [minuto('g'), minuto('g', 5000, 'S2'), minuto('g', 5000, 'S3')], payload: 'altas',
  }, kg.privada);
  return { eje, X: X.id, kg, k2 };
}

// NEU-08 ya no se salta: R9, sin clave no se actúa (src/eje.js:validar), salvo en un eje marcado como demostración.
test('NEU-08: sin clave no se actúa: nadie escribe como otra identidad ni mueve sus tokens', async () => {
  const { eje, X, kg, k2 } = await mundoConClaves();
  // Lo que se mueve es lo suyo: un minuto de los que g le cedió (E:g/minuto; T no cruza de persona, VG 7-11 noche).
  const devuelve = (de) => [minuto(de), { token: 'E', emisor: 'g', denominacion: 'minuto', cantidad: 1, de, a: 'g' }];
  const antes = [eje.saldo('S2', 'E:g/minuto'), eje.saldo('S3', 'E:g/minuto')];
  // «g» escribe en nombre de S2 (que tiene clave): sin su firma, o con la de g, no entra.
  await assert.rejects(eje.escribir({ autor: 'S2', sobre: X, t: T0, movimientos: devuelve('S2'), payload: 'escrito por g' }), /who has a key signs: S2 has a key/);
  await assert.rejects(eje.escribir({ autor: 'S2', sobre: X, t: T0, movimientos: devuelve('S2'), payload: 'escrito por g' }, kg.privada), /firma inválida de S2/);
  // Ni en nombre de S3, que no tiene clave: N nombres sin clave no son N votos gratis.
  await assert.rejects(eje.escribir({ autor: 'S3', sobre: X, t: T0, movimientos: devuelve('S3'), payload: 'escrito por g' }), /without a key nobody acts: S3 has no key/);
  assert.deepEqual([eje.saldo('S2', 'E:g/minuto'), eje.saldo('S3', 'E:g/minuto')], antes);
  // S2 sí actúa, con su firma.
  await eje.escribir({ autor: 'S2', sobre: X, t: T0, movimientos: devuelve('S2'), payload: 'escrito por S2' }, k2.privada);
  assert.equal(eje.saldo('S2', 'E:g/minuto'), antes[0] - 1);
  // Un eje de demostración conserva lo de antes, y lo dice: el génesis lo lleva en su contexto.
  const demo = await mundo(['S3']);
  assert.equal(demo.eje.demostracion, true);
  assert.equal(demo.eje.obtener(demo.eje.genesisId).contexto.demostracion, true);
  await demo.eje.escribir({ autor: 'S3', sobre: demo.X, t: T0, movimientos: devuelve('S3'), payload: 'escrito por g' });
});
