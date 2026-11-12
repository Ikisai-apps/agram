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
//
// Encargo 3b-bis (VG, 10-11: «me parece bien tu planteamiento»; mapa §15 [D] «P guarda su origen; recuentos abiertos
// por cantidad»): el P guarda su ORIGEN (quien lo obtuvo), como la R su emisor; delegarlo no lo cambia, así que pasar P
// a un títere no crea otro 100 %. La obtención es por cantidad (diez por unidad de E o R que llega de su emisor). Con
// «cualquiera» se cuenta por cantidad de P obtenido; con nombres, por reparto (el 100 % de cada origen por dominio) ×
// presión. Cierra NEU-09 y NEU-10: «emitir desde dos fuentes vale lo mismo que desde una».

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
import { raizDeAmbito } from '../src/tokens.js';
import { pagaElCoste } from './ayudas-coste.js';

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
const minuto = (de, cantidad, a = null) => (a === null ? (cantidad === undefined ? pagaElCoste(de) : { token: 'T', escala: 'minuto', cantidad, de, a }) : { token: 'E', emisor: de, denominacion: 'minuto', cantidad: cantidad ?? 1, de, a });
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
    // Mapa §15 [D] N1: C tiene diez P sobre X por haberlo escrito, y nadie acuña más a mano; lo reparte. Lo repartido
    // sigue siendo de origen C (encargo 3b-bis): quien lo devuelve lo dice.
    const deC = (m) => 'P:' + m.X + '/C';
    const uno = await mundo(['A']);
    await uno.eje.escribir({ autor: 'C', sobre: uno.X, t: T0, movimientos: [minuto('C'), { token: 'P', ambito: uno.X, cantidad: p, de: 'C', a: 'A' }], payload: unico('delega') });
    if (aC) await uno.eje.escribir({ autor: 'A', sobre: uno.X, t: T0, movimientos: [minuto('A'), { token: 'P', ambito: uno.X, origen: 'C', cantidad: aC, de: 'A', a: 'C' }], payload: unico('delega') });

    const ids = nombres('A', k);
    const div = await mundo(ids);
    const reparto = repartir(g, p, k);
    await div.eje.escribir({ autor: 'C', sobre: div.X, t: T0, movimientos: [minuto('C'), ...reparto.map((c, i) => [c, ids[i]]).filter(([c]) => c > 0).map(([c, a]) => ({ token: 'P', ambito: div.X, cantidad: c, de: 'C', a }))], payload: unico('delega') });
    let resta = aC;
    for (const id of ids) {
      const c = Math.min(resta, div.eje.saldo(id, deC(div)));
      if (c > 0) await div.eje.escribir({ autor: id, sobre: div.X, t: T0, movimientos: [minuto(id), { token: 'P', ambito: div.X, origen: 'C', cantidad: c, de: id, a: 'C' }], payload: unico('delega') });
      resta -= c;
    }
    const msg = 'caso ' + caso;
    assert.equal(div.eje.poderSobre('C', div.X), uno.eje.poderSobre('C', uno.X), msg + ': el P que llega al tercero');
    assert.equal(ids.reduce((s, id) => s + div.eje.poderSobre(id, div.X), 0), uno.eje.poderSobre('A', uno.X), msg + ': el P de la coalición');
    assert.equal(div.eje.saldo('C', deC(div)), uno.eje.saldo('C', deC(uno)), msg + ': el P que conserva el dueño');
    const acunadoX = (m) => m.eje.libro.sumas({ primitiva: 'acunar', serie: deC(m) });
    assert.deepEqual([acunadoX(div), acunadoX(uno)], [10, 10], msg + ': lo acuñado sobre X no crece al repartir');
    // Y nadie de la coalición obtuvo P sobre X: todo lo que tiene ahí es de C.
    assert.ok(ids.every((id) => div.eje.poderSobre(id, div.X, id) === 0), msg + ': delegar no crea P propio');
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

// ---------- recuentos y reparto (encargo 3b y 3b-bis) ----------

// Encargo 3b (VG, 8-11, mapa §15 [D] «P como peso de criterio» y «Una sola operación: registrar»): se retiran autorizar
// con umbral y los estados del motor. Una decisión de C sobre X se cuenta con el criterio que C escribe en su 2 (la
// plantilla en 2.2, a quién cuenta y con qué presión en 2.3; por defecto, solo C), y cada compromiso (P bloqueado con
// la salida = la decisión) pesa por su ORIGEN (encargo 3b-bis): con nombres, el P comprometido ÷ el P de su origen en
// el dominio de X, esté en la mano que esté; con «cualquiera», por cantidad.
//
// El P propio en el dominio de C se obtiene comprando: C paga EUR de su serie (atada a su alta, la raíz de su dominio)
// y quien los recibe obtiene diez P por unidad sobre ella; o plazas, una serie de C atada a la casa X.

/** Una decisión de C sobre X con la lista dada en su 2.3 (sin lista: solo cuenta C) y la plantilla (por defecto, la suma). */
async function decisionDeC(m, lista, plantilla = 'weighted sum') {
  // P por mirada (VG, tras 3b-bis): lo comprado (E) da P sobre la mirada 1 de su registro, y pesa solo en una decisión
  // que diga esa mirada en su criterio («view 1», junto a la plantilla de recuento, en el 2.2).
  const criterio = lista ? [['decidir'], ['x'], [plantilla, 'view 1'], lista] : [['decidir'], ['x'], [plantilla, 'view 1']];
  return m.eje.escribir({ autor: 'C', sobre: m.X, t: T0, movimientos: [minuto('C')], payload: [unico('¿abrimos?'), ['x'], criterio] });
}

/**
 * C vende a cada identidad lo suyo en una sola transacción (así C escribe lo mismo, venda a una o a varias): EUR (atados
 * a su alta, divisibles) o plazas (una serie atada a la casa X, en enteros). Quien recibe obtiene diez P por unidad.
 */
async function vende(m, reparto, { que = 'EUR' } = {}) {
  const dar = Object.entries(reparto).filter(([, c]) => c > 0);
  const total = dar.reduce((s, [, c]) => s + c, 0);
  const serie = (c, de, a) => (que === 'EUR' ? eur('C', c, de, a) : { token: 'E', emisor: 'C', denominacion: 'plaza', registro: m.X, cantidad: c, de, a });
  const movimientos = [minuto('C'), ...(que === 'EUR' || !total ? [] : [serie(total, null, 'C')]), ...dar.map(([a, c]) => serie(c, 'C', a))];
  return m.eje.escribir({ autor: 'C', sobre: m.X, t: T0, movimientos, payload: unico('vende ' + que) });
}

/** El P que tiene una identidad en el dominio de C (de cualquier origen), por serie: [{ ambito, origen, cantidad }] disponible. */
const suP = (m, id) => m.eje.poderes(id).filter((p) => p.cantidad > 0 && m.eje.hilo(raizDeAmbito(p.ambito)).some((e) => e.id === m.eje.alta('C').id));

/** Cada identidad compromete con D todo el P que tiene en el dominio de C, diciendo su origen; escribe en su propia alta (fuera del dominio). */
async function comprometenTodo(m, D, ids) {
  for (const id of ids) {
    const movs = suP(m, id).map((p) => ({ token: 'P', ambito: p.ambito, origen: p.origen, cantidad: p.cantidad, de: id, a: id, estado: 'bloqueo', salida: D.id }));
    if (movs.length) await m.eje.escribir({ autor: id, sobre: m.eje.alta(id).id, t: T0, payload: unico('comprometo'), movimientos: [minuto(id), ...movs] });
  }
  const r = motor.recuento(m.eje, D.id);
  return [r.valor, r.pasa];
}

/** `de` pasa a `a` `cantidad` de su P en el dominio de C de origen `origen` sobre `ambito`, escribiendo en su propia alta. */
async function pasaP(m, de, a, ambito, origen, cantidad) {
  return m.eje.escribir({ autor: de, sobre: m.eje.alta(de).id, t: T0, payload: unico('paso P'), movimientos: [minuto(de), { token: 'P', ambito, origen, cantidad, de, a }] });
}

test('NEU-01: con una segunda identidad, A no gana peso en la decisión de C; por defecto solo cuenta el dueño, y lo que el dueño delega cuenta como suyo', async () => {
  const uno = await mundo(['A']);
  const D1 = await decisionDeC(uno);
  await vende(uno, { A: 4 });
  assert.deepEqual(await comprometenTodo(uno, D1, ['A']), [0, false]);
  const dos = await mundo(['A', 'A2']);
  const D2 = await decisionDeC(dos);
  await vende(dos, { A: 2, A2: 2 });
  assert.deepEqual(await comprometenTodo(dos, D2, ['A', 'A2']), [0, false], 'dividirse no cambia el recuento');
  // Lo positivo: C compromete su P sobre la decisión (diez, por escribirla) y pasa.
  await dos.eje.escribir({ autor: 'C', sobre: D2.id, t: T0, payload: 'sí', movimientos: [minuto('C'), { token: 'P', ambito: D2.id, cantidad: 10, de: 'C', a: 'C', estado: 'bloqueo', salida: D2.id }] });
  assert.equal(motor.recuento(dos.eje, D2.id).pasa, true);
  // Encargo 3b-bis: el P que C delega en A sigue siendo de C; si A lo compromete, cuenta como de C (el dueño), no de A.
  const tres = await mundo(['A']);
  const D3 = await decisionDeC(tres);
  await tres.eje.escribir({ autor: 'C', sobre: tres.eje.alta('C').id, t: T0, payload: unico('delego'), movimientos: [minuto('C'), { token: 'P', ambito: tres.X, cantidad: 5, de: 'C', a: 'A' }] });
  const [v3, pasa3] = await comprometenTodo(tres, D3, ['A']);
  assert.ok(v3 > 0 && pasa3, 'cuenta como de C: ' + v3);
});

test('NEU-02: repartir el mismo P entre más identidades que el dueño no nombra no da más peso', async () => {
  // C nombra a B en su 2.3: solo B cuenta, con su 100 %. Repartir lo que B compra entre B y k títeres no nombrados no
  // cambia el recuento: B sigue comprometiendo todo lo suyo.
  const recuento = async (k) => {
    const ids = ['B', ...nombres('T', k)];
    const m = await mundo(ids);
    const D = await decisionDeC(m, ['B']);
    await vende(m, Object.fromEntries(ids.map((id) => [id, 6 / (k + 1)])));
    return comprometenTodo(m, D, ids);
  };
  const solo = await (async () => { const m = await mundo(['B']); const D = await decisionDeC(m, ['B']); await vende(m, { B: 6 }); return comprometenTodo(m, D, ['B']); })();
  assert.deepEqual(solo, [1, true]);
  for (const k of [1, 3, 5]) assert.deepEqual(await recuento(k), solo, 'k=' + k);
});

test('propiedad (NEU-02): con una lista de nombres, repartir lo de una nombrada entre k identidades no nombradas no cambia el recuento', async () => {
  const g = prng(SEMILLA + 3);
  for (let caso = 0; caso < CASOS / 6; caso++) {
    const n = g.int(1, 9); // lo que la coalición compra a C
    const k = g.int(2, 5);
    const nombradas = g.int(0, 1) ? ['A'] : ['A', 'Z'];
    const reparto = repartir(g, n, k);
    const uno = await mundo(['A', 'Z']);
    const D1 = await decisionDeC(uno, nombradas);
    await vende(uno, { A: n });
    const r1 = await comprometenTodo(uno, D1, ['A']);
    // Dividido: A compra su parte y el resto lo compran títeres que nadie nombra.
    const ids = ['A', ...nombres('T', k - 1)];
    const div = await mundo([...ids, 'Z']);
    const D2 = await decisionDeC(div, nombradas);
    await vende(div, Object.fromEntries(ids.map((id, i) => [id, reparto[i]])));
    const r2 = await comprometenTodo(div, D2, ids);
    const msg = 'caso ' + caso + ' (n=' + n + ', k=' + k + ', ' + JSON.stringify(reparto) + ')';
    // Los títeres no cuentan; A cuenta su 100 % por dominio si compró algo (y lo compromete todo).
    assert.equal(r2[0], reparto[0] > 0 ? r1[0] : 0, msg);
    assert.ok(r2[0] <= r1[0], msg + ': dividirse nunca da más');
  }
});

// NEU-10 (cerrada por el encargo 3b-bis): con «cualquiera» en el 2.3 se cuenta por cantidad de P obtenido, nunca por
// cabeza ni por reparto: k identidades que comprometen lo que compraron suman lo mismo que una que compró todo.
test('NEU-10: con «cualquiera», dos compradores con una plaza cada uno pesan lo mismo que uno con dos', async () => {
  const abierto = async (compras, plantilla) => {
    const m = await mundo(Object.keys(compras));
    const D = await decisionDeC(m, ['cualquiera'], plantilla);
    await vende(m, compras, { que: 'plaza' });
    return (await comprometenTodo(m, D, Object.keys(compras)))[0];
  };
  for (const plantilla of ['weighted sum', 'weighted mean', 'threshold']) {
    const dos = await abierto({ B1: 1, B2: 1 }, plantilla);
    assert.equal(dos, await abierto({ B: 2 }, plantilla), plantilla);
    assert.ok(dos > 0, plantilla);
  }
  // La suma ponderada, por cantidad: diez P por plaza, con la presión de «cualquiera» (9 de 9).
  assert.equal(await abierto({ B: 2 }, 'weighted sum'), 20);
  // Y repartir entre k el mismo P comprado no multiplica el recuento (la prueba que estaba en skip).
  const valor = async (k) => {
    const ids = nombres('A', k);
    const m = await mundo(ids);
    const D = await decisionDeC(m, ['cualquiera']);
    await vende(m, Object.fromEntries(ids.map((id) => [id, 6 / k])));
    return (await comprometenTodo(m, D, ids))[0];
  };
  assert.equal(await valor(3), await valor(1));
});

test('«uno por persona» no es una plantilla: pedirlo da su motivo (exige identidad de fuera)', async () => {
  const m = await mundo(['A']);
  const D = await m.eje.escribir({ autor: 'C', sobre: m.X, t: T0, movimientos: [minuto('C')], payload: [unico('¿votamos?'), ['x'], [['decidir'], ['x'], ['one per person'], ['cualquiera']]] });
  const r = motor.recuento(m.eje, D.id);
  assert.deepEqual([r.plantilla, r.valor, r.pasa, r.estado], ['one per person', null, null, 'ERROR']);
  assert.match(r.motivo, /outside identity/);
});

// Reparto por origen (VG, 8-11, mapa §15 [D] (3): «cada persona se lee como su 100 %»; encargo 3b-bis: el de SU origen,
// esté en la mano que esté): el P que obtuvo A sobre X ÷ el que obtuvo A en el dominio de X (lectura «share» de la
// época en A.2.6.8; src/motor.js, peso). Repartir lo obtenido entre k identidades en la misma proporción deja a cada
// una el reparto de A; pasar P a otras manos no lo cambia.

/** Cada identidad compra x plazas (P sobre X) e y EUR (P sobre el alta de C), en el dominio de C. */
async function pesoEnDominio(compras) {
  const m = await mundo(Object.keys(compras));
  await vende(m, Object.fromEntries(Object.entries(compras).map(([id, [x]]) => [id, x])), { que: 'plaza' });
  await vende(m, Object.fromEntries(Object.entries(compras).map(([id, [, y]]) => [id, y])));
  return m;
}

test('neutral (reparto por origen): obtener en proporción entre k, pasarlo a otras manos o fundirlo no cambia el reparto de nadie', async () => {
  const g = prng(SEMILLA + 8);
  for (let caso = 0; caso < 8; caso++) {
    const k = g.int(2, 4);
    const [x, y] = [g.int(1, 2), g.int(0, 2)];
    const esperado = x / (x + y);
    const msg = 'caso ' + caso + ' (k=' + k + ', x=' + x + ', y=' + y + ')';
    // Uno: A compra k·x plazas y k·y EUR. Dividido: k identidades, x e y cada una.
    const uno = await pesoEnDominio({ A: [k * x, k * y] });
    const ids = nombres('A', k);
    const div = await pesoEnDominio(Object.fromEntries(ids.map((id) => [id, [x, y]])));
    assert.ok(Math.abs(motor.peso(uno.eje, 'A', uno.X) - esperado) < 1e-9, msg);
    for (const id of ids) assert.ok(Math.abs(motor.peso(div.eje, id, div.X) - esperado) < 1e-9, msg + ': ' + id);
    // Pasar a otras manos: A reparte al azar su P entre las demás identidades del mundo dividido (que hacen de títeres),
    // y lo funde de vuelta en A1. El reparto de cada origen no cambia, y quien solo tiene P ajeno no reparte nada suyo.
    const altaC = div.eje.alta('C').id;
    for (const id of ids.slice(1)) {
      const pX = g.int(0, 10 * x);
      // Lo comprado está en la mirada 1 de su registro (P por mirada): se pasa desde ahí.
      if (pX) await pasaP(div, id, ids[0], div.X + '.1', id, pX);
      const pY = g.int(0, 10 * y);
      if (pY) await pasaP(div, id, ids[0], altaC + '.1', id, pY);
    }
    for (const id of ids) assert.ok(Math.abs(motor.peso(div.eje, id, div.X) - esperado) < 1e-9, msg + ': ' + id + ' tras fundir en ' + ids[0]);
  }
});

// NEU-09 (cerrada por el encargo 3b-bis): antes, el peso era una razón sobre lo que se TIENE, y pasar a un títere el P de
// otro registro del dominio subía el peso de A sobre X (sin coste, y la suma de pesos se doblaba). Ahora el 100 % es el
// P de SU origen, esté donde esté.
test('NEU-09: pasar a un títere el P de otro registro del dominio no cambia el peso de A ni el recuento (el P sigue siendo de origen A)', async () => {
  const m = await mundo(['A', 'T']);
  // A obtiene diez P sobre dos notas suyas en la casa de C (el dominio de C).
  const N1 = await m.eje.escribir({ autor: 'A', sobre: m.X, t: T0, payload: unico('nota 1'), movimientos: [minuto('A')] });
  const N2 = await m.eje.escribir({ autor: 'A', sobre: m.X, t: T0, payload: unico('nota 2'), movimientos: [minuto('A')] });
  const D = await decisionDeC(m, ['A']);
  await m.eje.escribir({ autor: 'A', sobre: m.eje.alta('A').id, t: T0, payload: unico('comprometo'), movimientos: [minuto('A'), { token: 'P', ambito: N1.id, cantidad: 10, de: 'A', a: 'A', estado: 'bloqueo', salida: D.id }] });
  // El peso de A sobre N1 se lee en el dominio de N1 (lo escribió A: es suyo, su 100 %); el recuento, en el de la
  // decisión (el de C), donde A obtuvo veinte y compromete diez.
  const antes = [motor.peso(m.eje, 'A', N1.id), motor.recuento(m.eje, D.id).valor];
  assert.deepEqual(antes, [1, 0.5]);
  // A pasa al títere los diez de N2, escribiendo fuera del dominio (su propia alta).
  await pasaP(m, 'A', 'T', N2.id, 'A', 10);
  assert.deepEqual([motor.peso(m.eje, 'A', N1.id), motor.recuento(m.eje, D.id).valor], antes, 'ni el peso de A ni el recuento cambian');
  assert.deepEqual([motor.peso(m.eje, 'A', N2.id), motor.peso(m.eje, 'T', N2.id)], [1, 0], 'el P de N2 sigue siendo de A; el títere no obtuvo nada');
  // Si el títere lo compromete (diciendo su origen), cuenta como de A: A llega a su 100 %, no más.
  await m.eje.escribir({ autor: 'T', sobre: m.eje.alta('T').id, t: T0, payload: unico('comprometo'), movimientos: [minuto('T'), { token: 'P', ambito: N2.id, origen: 'A', cantidad: 10, de: 'T', a: 'T', estado: 'bloqueo', salida: D.id }] });
  assert.equal(motor.recuento(m.eje, D.id).valor, 1);
});

test('un títere sin obtención propia pesa cero en los recuentos abiertos y no cuenta en los nombrados si no está nombrado', async () => {
  // A compra dos plazas (veinte P suyos sobre X) y pasa la mitad a su títere T. Cada decisión, en su mundo.
  const mundoDe = async (lista) => {
    const m = await mundo(['A', 'T']);
    const D = await decisionDeC(m, lista);
    await vende(m, { A: 2 }, { que: 'plaza' });
    await pasaP(m, 'A', 'T', m.X + '.1', 'A', 10);
    return { m, D };
  };
  // Abierto: lo que comprometen A y el títere suma lo que A obtuvo (veinte), lo mismo que si A lo comprometiera todo.
  const abierto = await mundoDe(['cualquiera']);
  assert.deepEqual(await comprometenTodo(abierto.m, abierto.D, ['A', 'T']), [20, true]);
  assert.equal(motor.peso(abierto.m.eje, 'T', abierto.m.X), 0, 'el títere no reparte nada suyo');
  assert.deepEqual(abierto.m.eje.obtenidoPor('T').filter((x) => x.registro === abierto.m.X), [], 'ni obtuvo nada en X');
  const soloA = await mundo(['A']);
  const DA = await decisionDeC(soloA, ['cualquiera']);
  await vende(soloA, { A: 2 }, { que: 'plaza' });
  assert.deepEqual(await comprometenTodo(soloA, DA, ['A']), [20, true], 'sin títere, lo mismo');
  // Nombrado: si el dueño nombra al títere (y no a A), lo que el títere compromete es de A: no cuenta.
  const aT = await mundoDe(['T']);
  assert.deepEqual(await comprometenTodo(aT.m, aT.D, ['T']), [0, false]);
  // Si no nombra a ninguno de los dos, tampoco.
  const aZ = await mundoDe(['Z']);
  assert.deepEqual(await comprometenTodo(aZ.m, aZ.D, ['A', 'T']), [0, false]);
  // Si nombra a A, cuenta lo suyo esté en la mano que esté: su 100 %.
  const aA = await mundoDe(['A']);
  assert.deepEqual(await comprometenTodo(aA.m, aA.D, ['A', 'T']), [1, true]);
});

test('propiedad: dividir o fundir identidades no cambia ningún recuento, abierto o nombrado, salvo lo que el dueño nombre', async () => {
  const g = prng(SEMILLA + 9);
  const plantillas = ['weighted sum', 'weighted mean', 'threshold'];
  const cerca = (a, b) => (a === null || b === null ? a === b : Math.abs(a - b) < 1e-6);
  const si = (p) => g.r() < p;
  for (let caso = 0; caso < 6; caso++) {
    const n = g.int(1, 6);
    const k = g.int(2, 4);
    const plantilla = g.pick(plantillas);
    const ids = nombres('A', k);
    const reparto = repartir(g, n, k);
    const msg = 'caso ' + caso + ' (n=' + n + ', k=' + k + ', ' + plantilla + ', ' + JSON.stringify(reparto) + ')';
    // Abierto: comprar n plazas una identidad o k (repartidas como sea) y comprometerlo todo da lo mismo.
    const abierto = async (compras) => {
      const m = await mundo(Object.keys(compras));
      const D = await decisionDeC(m, ['cualquiera'], plantilla);
      await vende(m, compras, { que: 'plaza' });
      return (await comprometenTodo(m, D, Object.keys(compras)))[0];
    };
    const r1 = await abierto({ A: n });
    const rk = await abierto(Object.fromEntries(ids.map((id, i) => [id, reparto[i]])));
    assert.ok(cerca(rk, r1), msg + ': abierto ' + rk + ' frente a ' + r1);
    // Nombrado y abierto: con lo obtenido fijo, mover el P entre identidades (dividirlo o fundirlo, con su origen) antes
    // de comprometerlo no cambia el recuento, para la lista que sea (salvo lo que el dueño nombre, que es lo que cuenta).
    const listas = [['cualquiera'], [g.pick(ids)], ids.filter(() => si(0.5)).map((id) => (si(0.5) ? id + ' ' + g.int(1, 9) : id))];
    for (const lista of listas) {
      const base = async (mover) => {
        const m = await mundo(ids);
        const D = await decisionDeC(m, lista.length ? lista : ['nadie'], plantilla);
        await vende(m, Object.fromEntries(ids.map((id, i) => [id, reparto[i]])), { que: 'plaza' });
        if (mover) {
          for (let i = 0; i < 4; i++) {
            const de = g.pick(ids);
            const p = suP(m, de);
            if (!p.length) continue;
            const x = g.pick(p);
            await pasaP(m, de, g.pick(ids.filter((id) => id !== de)), x.ambito, x.origen, si(0.5) ? x.cantidad : x.cantidad / 2);
          }
        }
        return (await comprometenTodo(m, D, ids))[0];
      };
      const quieto = await base(false);
      const movido = await base(true);
      assert.ok(cerca(movido, quieto), msg + ': lista ' + JSON.stringify(lista) + ': ' + movido + ' frente a ' + quieto);
    }
  }
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

/**
 * Evento de `f` que bloquea `bloquea` de P:`ambito` con la salida = la serie y emite `cantidad` de E atada a `registro`.
 * El P que bloquea es el que le dio C (encargo 3b-bis: conserva su origen, C), salvo que se diga otro `origen`.
 */
function emiteAtada(f, { registro, sobre = registro, ambito = registro, origen = 'C', denominacion = 'plaza-noche', cantidad, bloquea = 0, emisores, otros = [] }) {
  const clave = 'E:' + f + '/' + denominacion + '@' + registro;
  return {
    autor: f, sobre, t: T0, payload: unico('respaldo ' + cantidad),
    movimientos: [
      minuto(f), ...otros,
      ...(bloquea ? [{ token: 'P', ambito, origen, cantidad: bloquea, de: f, a: f, estado: 'bloqueo', salida: clave }] : []),
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
        await m.eje.escribir({ autor: fuentes[i], sobre: H, t: T0, payload: unico('firma'), movimientos: [minuto(fuentes[i]), { token: 'P', ambito: H, origen: 'C', cantidad: cuotas[i], de: fuentes[i], a: fuentes[i], estado: 'bloqueo', salida: S }] });
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
      const disponible = m.eje.saldo(f, 'P:' + H + '/C');
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
