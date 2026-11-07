// Conformidad del motor y de los tokens: pruebas escritas DESDE LA
// ESPECIFICACIÓN (corpus V4 04_AGRAM_OPERACIONES, 05_DIEZ_PV, 06_EPOCAS_TIEMPO,
// herencia V2/V3, STATE de decisiones y MAPA_GLOBAL_AGRAM §2.4–§2.8, §9–§12),
// no desde el código. Cada prueba corresponde a una regla con fuerza
// «decidido» o «acuerdo», con su id. Lo que el código no cumple todavía está
// igualmente escrito, en { skip } con su id y el motivo; no se maquilla. Cuando
// una regla se cumple en parte, la parte cumplida es la prueba «NN» y la que
// falta es «NNb» (skip). Las reglas con fuerza «propuesta» o «abierto» van en
// el bloque comentado del final, con su id.
//
// Dos series de reglas viven aquí y comparten números TOK-nn:
//   MOT-01…MOT-68 y M:TOK-01…M:TOK-04   serie del motor (M:TOK = los tokens vistos desde el motor)
//   TOK-01…TOK-79                       serie de tokens, tiempo, épocas y fronteras
// (B:TOK-01, B:TOK-02 y B:MOT-01…03 son de la serie BTML: test/conformidad-btml.test.js.)
//
// Ejes pequeños con Eje.genesis + escribir; datos inventados; los ids nacen al
// escribir. El génesis emite T en minutos (la escala que se gasta al escribir),
// así las pruebas no dependen de convertir unas escalas en otras; y lo que se
// lee de los saldos de T se lee por escala (saldoT) o por el rechazo del eje.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { Eje } from '../src/eje.js';
import { crearEvento, validarForma, verificarId } from '../src/evento.js';
import { validarPayload, esDireccion, direccion } from '../src/btml.js';
import * as tokens from '../src/tokens.js';
import { ESCALAS_T, SEGUNDOS, validarMovimiento } from '../src/tokens.js';
import { ocupantes, seguir, caminosDe, vector, signo, ordenarPorEncaje, arbol } from '../src/encaje.js';
import { evaluar, consultar, analizar } from '../src/bql.js';
import * as motor from '../src/motor.js';
import {
  descubrir, proponer, consolidar, autorizar, ejecutar, estadoDe, consolidaciones, puedeAutorizar,
  autorizacionesValidas, FABRICA, OPERADORES,
} from '../src/motor.js';
import { escribirDesde, desdePointed, desdeSequenced, desdeMapped, costeT, proporcionDeRegistro } from '../src/escritura.js';
import { contarPosiciones, escritura, lectura, cabeEscritura, proporcionDe, MODOS } from '../src/modos.js';
import { EPOCA_0, PV, leerDireccion } from '../src/epocas.js';
import { decupla } from '../src/pointed.js';
import { mapa, sobrio as sobrioMapa } from '../src/mapped.js';
import { secuencia } from '../src/sequenced.js';
import { banda, ejeTemporal } from '../src/tiempo.js';
import { situar, confluir } from '../src/bases.js';
import { serializar } from '../src/persistencia.js';
import { generarClaves, firmar, verificar } from '../src/autoridad.js';
import * as agram from '../src/index.js';

const T0 = '2026-11-07T10:00:00Z';
const AHORA = '2026-11-07T12:00:00Z';
const EMISION = [{ token: 'T', escala: 'minuto', cantidad: 600 }, { token: 'P', cantidad: 5, ambito: 'genesis' }];
const gastaT = (de, cantidad = 1) => ({ token: 'T', escala: 'minuto', cantidad, de, a: null });
const daT = (de, a, cantidad) => ({ token: 'T', escala: 'minuto', cantidad, de, a });
const daE = (de, a, cantidad, denominacion = 'EUR', emisor = 'raiz') => ({ token: 'E', emisor, denominacion, cantidad, de, a });
const ID_INEXISTENTE = 'f'.repeat(64);
/** P delegado (por defecto, sobre todo el eje): quien emite E necesita P sobre el registro. */
const daP = (de, a, cantidad = 1, ambito = 'genesis') => ({ token: 'P', ambito, cantidad, de, a });
/**
 * VG, 7-11 noche: emitir P o E exige R propia en juego en el mismo evento. La
 * persona emite un R suyo y lo pone en manos de otra (por defecto, la raíz).
 */
const rEnJuego = (persona, a = 'raiz') => [{ token: 'R', emisor: persona, cantidad: 1, de: null, a: persona }, { token: 'R', emisor: persona, cantidad: 1, de: persona, a }];

/**
 * El mundo del motor: la raíz (génesis, con poder sobre todo el eje, euros y
 * reputación propia), ana (escribe y consolida, sin poder) y bea (sin poder);
 * ana y bea son personas (se declara en su alta: así pueden emitir sus series).
 * Los euros son la serie de la raíz (E:raiz/EUR). El foco del génesis tiene
 * contenido en las posiciones 1–4.
 */
async function mundo(foco = ['Compra', 'yogur', 'sin lactosa', 'aviso a cocina', 'pagar']) {
  const eje = await Eje.genesis({
    identidad: 'raiz',
    emision: [...EMISION, { token: 'E', denominacion: 'EUR', cantidad: 100 }, { token: 'R', cantidad: 10, emisor: 'raiz' }],
    foco,
    t: T0,
  });
  const g = eje.genesisId;
  await eje.escribir({ autor: 'raiz', sobre: g, t: T0, movimientos: [gastaT('raiz'), daT('raiz', 'ana', 300), daT('raiz', 'bea', 120), daE('raiz', 'ana', 50)], payload: 'altas de ana y bea', contexto: { tipos: { ana: 'persona', bea: 'persona' } } });
  return { eje, g };
}

/** Escribe un registro sobre otro, opcionalmente anclado en una dirección. */
const escribe = (eje, sobre, payload, en, autor = 'raiz', t = T0) =>
  eje.escribir({ autor, sobre, en, t, movimientos: [gastaT(autor)], payload });

/** Una consolidación de ana sobre el foco, ya autorizada por la raíz. */
async function autorizada(eje, foco, elecciones = { 1: 'dos yogures' }) {
  const c = await consolidar(eje, { autor: 'ana', foco, t: T0, elecciones });
  const a = await autorizar(eje, { autorizante: 'raiz', consolidacion: c.id, t: T0 });
  return { c, a };
}

/** Huella del eje (registros y saldos) para comprobar que algo no tiene efectos. */
const huella = (eje) => JSON.stringify([eje.orden, [...eje.saldos].map(([k, v]) => [k, [...v]])]);

/** Minutos de T que mueve el autor en un evento. */
const minutosDe = (ev) => ev.movimientos.filter((m) => m.token === 'T' && m.escala === 'minuto' && m.de === ev.autor).reduce((s, m) => s + m.cantidad, 0);

/** Época espía: anota las profundidades por las que se le pregunta. */
function epocaEspia() {
  const consultadas = [];
  return { consultadas, epoca: { nombre: 'espía', ordinal: (k) => { consultadas.push(k); return false; }, reglaCorta: (p, d) => PV[d] } };
}

/**
 * Cuerpo de una prueba en skip cuya regla aún no tiene forma observable en el
 * código. Falla a propósito: quitar el skip sin escribir la prueba no puede dar
 * un verde vacío.
 */
const sinForma = (id) => () => assert.fail(id + ': la regla aún no tiene forma observable; escribir la prueba al implementarla');

/** Los especificadores de import de src/: todos relativos (nada de fuera). */
function importsDeSrc() {
  const dir = new URL('../src/', import.meta.url);
  const lista = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.js'))) {
    const texto = readFileSync(new URL(f, dir), 'utf8');
    for (const m of texto.matchAll(/(?:from\s+|import\s*\(\s*)'([^']+)'/g)) lista.push([f, m[1]]);
  }
  return lista;
}

/** Nombres que exporta el núcleo, también dentro de sus módulos con espacio de nombres. */
const nombresExportados = () => Object.entries(agram).flatMap(([k, v]) => (Object.prototype.toString.call(v) === '[object Module]' ? [k, ...Object.keys(v)] : [k]));

/** La casa como génesis: una plaza (un token por plaza y noche), una habitación con una cama, recepción con poder y dos huéspedes. */
async function casaConUnaPlaza() {
  const eje = await Eje.genesis({
    identidad: 'casa',
    emision: [...EMISION, { token: 'E', denominacion: 'plaza-7-11', cantidad: 1 }],
    foco: ['Habitación 1', 'cama A'],
    t: T0,
  });
  const hab = eje.genesisId;
  await eje.escribir({ autor: 'casa', sobre: hab, t: T0, movimientos: [gastaT('casa'), daT('casa', 'recepcion', 60), { token: 'P', cantidad: 1, ambito: 'genesis', de: 'casa', a: 'recepcion' }, daT('casa', 'h1', 60), daT('casa', 'h2', 60)], payload: 'altas', contexto: { tipos: { h1: 'persona', h2: 'persona' } } });
  return { eje, hab };
}

/**
 * La reserva de un huésped en la plaza 1 de la habitación: el huésped la pide en la plaza (los pedidos colisionan
 * ahí) y deja a recepción confirmar por él (acuña P sobre su pedido, con su R en juego, y se lo delega); la casa
 * consolida sobre el pedido y recepción la autoriza. Antes la casa consolidaba sobre la habitación y recepción
 * autorizaba con el P que la casa le había delegado; ya no cuenta: para autorizar lo que propone la casa solo
 * cuenta el P sobre un registro del hilo que la casa no escribió ([X] confirmar VG, motor.poderParaAutorizar).
 */
async function reservaDeLaCasa(eje, hab, huesped) {
  const pedido = await eje.escribir({ autor: huesped, sobre: hab, en: direccion([1, 4]), t: T0, movimientos: [gastaT(huesped)], payload: 'reserva de ' + huesped + ', noche del 7-11' });
  await eje.escribir({ autor: huesped, sobre: pedido.id, t: T0, payload: 'recepción confirma por mí',
    movimientos: [gastaT(huesped), ...rEnJuego(huesped, 'recepcion'), { token: 'P', ambito: pedido.id, cantidad: 1, de: null, a: huesped }, daP(huesped, 'recepcion', 1, pedido.id)] });
  const c = await consolidar(eje, { autor: 'casa', foco: pedido.id, camino: [1], t: T0, elecciones: { 1: 'plaza para ' + huesped + ', noche del 7-11' } });
  await autorizar(eje, { autorizante: 'recepcion', consolidacion: c.id, t: T0 });
  return { c, pedido };
}

/**
 * El huésped reserva y la casa (que no es el génesis) respalda la plaza con su
 * propia serie (E:casa/plaza). VG, 7-11 noche: la casa que emite es una
 * persona (antes, un grupo), con P delegado y su R en juego.
 */
async function reservaDelHuesped() {
  const eje = await Eje.genesis({ identidad: 'raiz', emision: EMISION, foco: 'Mundo', t: T0 });
  const g = eje.genesisId;
  await eje.escribir({ autor: 'raiz', sobre: g, t: T0, movimientos: [gastaT('raiz'), daT('raiz', 'casa', 120), daT('raiz', 'huesped', 120), daP('raiz', 'casa')], payload: 'altas', contexto: { tipos: { casa: 'persona', huesped: 'persona' } } });
  // La casa emite su serie limitada: un token por plaza y noche.
  await eje.escribir({ autor: 'casa', sobre: g, t: T0, movimientos: [gastaT('casa'), ...rEnJuego('casa'), { token: 'E', denominacion: 'plaza', emisor: 'casa', cantidad: 1, de: null, a: 'casa' }], payload: 'capacidad: una plaza la noche del 7-11' });
  const hab = await escribe(eje, g, ['Habitación 1', 'cama A'], undefined, 'casa');
  const c = await consolidar(eje, { autor: 'huesped', foco: hab.id, camino: [1], t: T0, elecciones: { 1: 'reserva noche del 7-11' } });
  await autorizar(eje, { autorizante: 'raiz', consolidacion: c.id, t: T0 });
  // Ejecutar la reserva en la fábrica mueve la plaza de la casa al huésped.
  await ejecutar(eje, { autor: 'huesped', consolidacion: c.id, t: T0, movimientos: [daE('casa', 'huesped', 1, 'plaza', 'casa')] });
  return { eje, c };
}

// =====================================================================
// Motor · capacidades
// =====================================================================

test('MOT-01 las seis capacidades existen como primitivas del motor: interpretar, resolver, posicionar, comparar, calcular y componer', async () => {
  const { eje, g } = await mundo();
  // INTERPRETAR: forma, gramática y regla de la época.
  assert.equal(validarPayload(['x', ['y']]).ok, true);
  assert.equal(analizar('LOCAL(1) + 2').tipo, 'bin');
  assert.equal(leerDireccion(FABRICA)[0].significado, 'fábrica');
  // RESOLVER: referencias con procedencia.
  const a = await escribe(eje, g, ['A', 'dato']);
  assert.equal(seguir(eje, { ref: a.id, dir: '1000000000' }).contenido, 'dato');
  // POSICIONAR: rutas locales y colisiones por ceros.
  assert.equal(direccion([4]), FABRICA);
  // VG, 7-11 noche: por hojas: [['y']] es décupla (1 y 1.0); ['y'] sería una lista.
  assert.equal(caminosDe(['x', [['y']]], '1000000000').length, 2);
  // COMPARAR: vector y orden por encaje.
  assert.deepEqual(vector('4100000000', FABRICA).slice(0, 2), [0, 1]);
  assert.equal(ordenarPorEncaje([]).length, 0);
  // CALCULAR: magnitudes.
  assert.equal(consultar(eje, g, [0], '12 EUR + 2 EUR').texto, '14 EUR (12 EUR + 2 EUR)');
  // COMPONER: propuesta y consolidación.
  assert.ok(Object.keys(proponer(eje, g).elecciones).length > 0);
  assert.equal(typeof consolidar, 'function');
});

test('MOT-01b las seis capacidades tienen nombre en el motor',
  { skip: 'MOT-01: no hay módulo ni nombres para las seis capacidades; están repartidas entre epocas, bql, btml, encaje y motor. [X] decidir VG si se nombran en el código (abajo, forma supuesta) o solo en la documentación' },
  () => {
    assert.deepEqual(Object.keys(motor.CAPACIDADES ?? {}), ['INTERPRETAR', 'RESOLVER', 'POSICIONAR', 'COMPARAR', 'CALCULAR', 'COMPONER']);
  });

test('MOT-02 las seis capacidades no son palabras reservadas de BQL', async () => {
  const { eje, g } = await mundo();
  for (const nombre of ['INTERPRETAR', 'RESOLVER', 'POSICIONAR', 'COMPARAR', 'CALCULAR', 'COMPONER']) {
    const r = consultar(eje, g, [0], nombre + '(1)');
    assert.equal(r.estado, 'ERROR', nombre);
    assert.match(r.motivo, /función desconocida/);
  }
});

test('MOT-03 INTERPRETAR lee tipo y forma, la gramática de la expresión y la regla corta de la época', async () => {
  assert.deepEqual(validarPayload(['a', []]).ok, false); // forma
  assert.equal(analizar('REF("abc", "1000000000")').nombre, 'REF'); // gramática
  assert.throws(() => analizar('1 +'), SyntaxError);
  const otra = { nombre: 'otra', reglaCorta: (p, d) => 'd' + d + '@' + p };
  assert.equal(leerDireccion('8400000000', otra)[1].significado, 'd4@1'); // la regla de la época elegida
  assert.equal(leerDireccion('8400000000')[1].significado, 'qué se hace');
});

test('MOT-03b INTERPRETAR aplica también reglas largas y el significado del contexto',
  { skip: 'MOT-03: las reglas largas ya existen (cargarEpoca, TOK-65), pero no hay significado de contexto: lo que dice la lectura de una dirección depende solo de la época y la ruta. Forma supuesta abajo.' },
  () => {
    const conLarga = { nombre: 'con larga', reglaCorta: (p, d) => PV[d], reglaLarga: (prefijo) => (prefijo === '84' ? 'compras' : undefined) };
    assert.equal(leerDireccion('8412000000', conLarga)[1].significado, 'compras');
    assert.equal(leerDireccion('7412000000', conLarga)[1].significado, PV[4]);
  });

test('MOT-04 RESOLVER sigue LOCAL, REF y ACTUAL, con procedencia y ciclos detectados', async () => {
  const { eje, g } = await mundo();
  const a = await escribe(eje, g, ['A', 'dato']);
  const x = await escribe(eje, g, ['X', 'propio', '=LOCAL(1)', '=REF("' + a.id + '", "1000000000")', '=ACTUAL(1)', '=LOCAL(6)', '=LOCAL(5)']);
  assert.equal(evaluar(eje, x.id, [2]).texto, 'propio');
  assert.equal(evaluar(eje, x.id, [3]).texto, 'dato');
  assert.ok(evaluar(eje, x.id, [3]).dependencias.includes(a.id + ':1000000000'));
  assert.equal(evaluar(eje, x.id, [4]).texto, 'propio');
  assert.match(evaluar(eje, x.id, [5]).motivo, /ciclo/);
  assert.deepEqual(seguir(eje, { ref: a.id, dir: '1000000000' }).procedencia, [a.id + ':1000000000']);
});

test('MOT-04b RESOLVER comprueba permisos de lectura',
  { skip: 'MOT-04: el motor no comprueba permisos de lectura: descubrir() llama a evaluar() sin gancho y el eje y el encaje leen todo. BQL, desde la PR #36, integrada, pregunta al gancho opcional puedeLeer por cada lectura, ocupante y salto y da PENDIENTE DE AUTORIZACIÓN (O-12b, O-12c), pero el motor no lo pasa ni tiene modelo de permisos; ese modelo es de AARPIA (mapa §12)' },
  sinForma('MOT-04'));

test('MOT-05 POSICIONAR obtiene posiciones por rutas locales, anclajes y ceros, sin pasar de diez profundidades', async () => {
  const { eje, g } = await mundo();
  assert.equal(direccion([8, 4, 1, 2]), '8412000000'); // ruta local
  assert.throws(() => direccion(Array(11).fill(1)), RangeError);
  const h = await escribe(eje, g, 'anclado', '3000000000'); // anclaje
  assert.ok(ocupantes(eje, g, [3]).some((o) => o.evento === h.id));
  const x = await escribe(eje, g, ['X', [['uno'], 'dos']]); // VG, 7-11 noche: por hojas: la posición 0 envuelta hace de 1 una décupla
  assert.deepEqual(ocupantes(eje, x.id, [1]).map((o) => o.camino), [[1], [1, 0]]); // ceros
});

test('MOT-05b POSICIONAR usa la orientación (el tercer cero)',
  { skip: 'MOT-05: la orientación (tercer cero) no está implementada; sus reglas están abiertas (BTML-37)' },
  sinForma('MOT-05'));

test('MOT-06 COMPARAR mira coincidencia de ruta, el vector de diez diferencias con signo y las relaciones entre candidatos', async () => {
  const { eje, g } = await mundo();
  const plan = await escribe(eje, g, ['Plan', 'a', 'b', 'tres']);
  const x = await escribe(eje, g, ['X', 'r', { ref: plan.id, dir: '3000000000' }]);
  await escribe(eje, x.id, 'escrito', '2000000000');
  const oc = ocupantes(eje, x.id, [2]);
  assert.deepEqual(oc.map((o) => o.origen), ['propio', 'escrito', 'referencia']);
  assert.deepEqual(oc.map((o) => o.acuerdo), [10, 10, 0]);
  assert.deepEqual(oc[2].vector, [1, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(signo(oc[2].vector), 'reducir');
});

test('MOT-06b COMPARAR usa preferencias según el contexto, precedentes consolidados y compatibilidad demostrada',
  { skip: 'MOT-06: no hay preferencias, precedentes consolidados ni compatibilidad demostrada como criterio; ordenan el acuerdo de prefijo y la llegada (opción B)' },
  sinForma('MOT-06'));

test('MOT-07 CALCULAR opera magnitudes con tipo, sin dar por hecha un álgebra universal', async () => {
  const { eje, g } = await mundo();
  const c = (f) => consultar(eje, g, [0], f);
  assert.equal(c('12 EUR + 2 EUR').texto, '14 EUR (12 EUR + 2 EUR)');
  assert.equal(c('200 m + 5 EUR').valor.tipo, 'composicion'); // no se suman
  assert.equal(c('12 EUR * 2 EUR').estado, 'INCOMPATIBLE'); // ni todo opera con todo
  assert.equal(c('3 * 4 EUR').texto, '12 EUR');
});

test('MOT-07b CALCULAR opera estructuras y matrices tipadas, con versiones de implementación',
  { skip: 'MOT-07: no hay matrices tipadas ni versiones de implementación en BQL. Terreno de src/bql.js (otro agente): no se toca aquí' },
  sinForma('MOT-07'));

test('MOT-08 COMPONER construye una propuesta sin escribir, mantiene referencias y solo mueve recursos al ejecutar lo autorizado', async () => {
  const { eje, g } = await mundo();
  const antes = huella(eje);
  const p = proponer(eje, g);
  assert.equal(huella(eje), antes); // la vista provisional no escribe
  assert.deepEqual(p.elecciones[1], { ref: g, dir: '1000000000' }); // referencias, no copias
  const c = await consolidar(eje, { autor: 'ana', foco: g, t: T0, elecciones: p.elecciones });
  assert.deepEqual(c.payload[1], { ref: g, dir: '1000000000' });
  assert.equal(eje.saldo('ana', 'E:raiz/EUR'), 50);
  await autorizar(eje, { autorizante: 'raiz', consolidacion: c.id, t: T0 });
  assert.equal(eje.saldo('ana', 'E:raiz/EUR'), 50);
  await ejecutar(eje, { autor: 'ana', consolidacion: c.id, t: T0, movimientos: [daE('ana', 'raiz', 5)] });
  assert.equal(eje.saldo('ana', 'E:raiz/EUR'), 45);
});

test('MOT-08b COMPONER solo emite el cambio que se consolidó y autorizó',
  { skip: 'MOT-08: ejecutar() acepta cualquier movimiento del autor aunque la consolidación no lo nombre, y consolidar() escribe su registro sin autorización. [X] decidir VG si «emitir un cambio» incluye el propio registro de la consolidación. Terreno de la capacidad al ejecutar (ejecutar en src/motor.js, otro agente): no se toca aquí' },
  async () => {
    const { eje, g } = await mundo();
    const { c } = await autorizada(eje, g, { 1: 'pagar 5 EUR a raiz' });
    await assert.rejects(ejecutar(eje, { autor: 'ana', consolidacion: c.id, t: T0, movimientos: [daE('ana', 'bea', 5)] }));
  });

// =====================================================================
// Motor · entradas y salidas
// =====================================================================

test('MOT-09 el motor no exige volver a escribir los datos: resuelve las referencias que ya existen', async () => {
  const { eje, g } = await mundo();
  const oferta = await escribe(eje, g, ['Oferta', 'dos por uno'], '1000000000');
  const elegido = descubrir(eje, g, { posiciones: [1] })[0].candidatos.find((x) => x.evento === oferta.id);
  const c = await consolidar(eje, { autor: 'ana', foco: g, t: T0, elecciones: { 1: { candidato: elegido }, 3: 'nuevo' } });
  assert.deepEqual(c.payload[2], { ref: g, dir: '2000000000' }); // el hueco se hereda por referencia
  assert.equal(JSON.stringify(c.payload).includes('dos por uno'), false);
  assert.equal(consultar(eje, c.id, [0], 'LOCAL(1)').valor.tipo, 'array'); // y se lee siguiendo la referencia
  assert.equal(consultar(eje, c.id, [0], 'LOCAL(2)').texto, 'sin lactosa');
});

test('MOT-10 si falta información, el motor devuelve un pendiente explicado y no inventa el dato', async () => {
  const { eje, g } = await mundo();
  const plan = await escribe(eje, g, ['Plan', '=LOCAL(9)', '=1 +', '=ELEGIR(BUSCAR(7))']);
  const p = proponer(eje, plan.id);
  assert.deepEqual(Object.keys(p.elecciones), []);
  assert.deepEqual(p.pendientes.map((x) => x.posicion), [1, 2, 3]);
  assert.match(p.pendientes[0].motivo, /PENDIENTE/);
  assert.match(p.pendientes[1].motivo, /ERROR/);
  assert.equal(p.pendientes[2].motivo, 'sin candidatos');
  await assert.rejects(consolidar(eje, { autor: 'ana', foco: plan.id, t: T0, elecciones: { 6: 'x' } }), /hueco en 4/);
});

test('MOT-11 descubrir devuelve candidatos identificados y ordenados, con distancias vectoriales y referencias', async () => {
  const { eje, g } = await mundo();
  const h = await escribe(eje, g, 'otro yogur', '1000000000');
  const [p1] = descubrir(eje, g, { posiciones: [1] });
  assert.deepEqual(p1.candidatos.map((c) => c.evento), [g, h.id]);
  for (const c of p1.candidatos) {
    for (const campo of ['evento', 'origen', 'vector', 'distancia', 'acuerdo', 'signo', 'procedencia', 'estado', 'texto']) assert.ok(c[campo] !== undefined, campo);
  }
});

test('MOT-11b descubrir señala el empate y da un motivo de encaje', async () => {
  const { eje, g } = await mundo();
  await escribe(eje, g, 'uno', '1000000000');
  await escribe(eje, g, 'dos', '1000000000');
  const [p1] = descubrir(eje, g, { posiciones: [1] });
  // El motivo de encaje va en `justificacion` (`motivo` es, como en BQL, el porqué de un estado que no es RESUELTO).
  assert.ok(p1.candidatos.every((c) => typeof c.justificacion === 'string' && c.justificacion.length > 0));
  assert.ok(p1.candidatos.filter((c) => c.origen === 'escrito').every((c) => c.empate === true));
  assert.ok(p1.candidatos.every((c) => /empata con 2/.test(c.justificacion)));
});

test('MOT-12 el motor entrega las diferencias entre lo propuesto y lo vigente y pide la selección o confirmación',
  { skip: 'MOT-12: no existe ningún cálculo de diferencias entre propuesta o consolidación y lo vigente; solo los pendientes de proponer(). Sin forma acordada de «lo vigente» (¿lo propio del foco?, ¿la última consolidación?) ni de cuándo pedir selección o confirmación. [X] decidir VG' },
  sinForma('MOT-12'));

test('MOT-13 antes de consolidar se ven las alternativas, lo que se registra, a qué se refiere y lo que sigue pendiente', async () => {
  const { eje, g } = await mundo();
  const alternativa = await escribe(eje, g, 'otro yogur', '1000000000');
  const [p1] = descubrir(eje, g, { posiciones: [1] }); // alternativas
  assert.deepEqual(p1.candidatos.map((c) => c.evento), [g, alternativa.id]);
  const plan = await escribe(eje, g, ['Plan', '=LOCAL(9)']);
  assert.equal(proponer(eje, plan.id).pendientes.length, 1); // lo que sigue pendiente
  const c = await consolidar(eje, { autor: 'ana', foco: g, t: T0, elecciones: { 1: { candidato: p1.candidatos[1] }, 3: 'nuevo aviso' } });
  assert.deepEqual(c.contexto.fuentes, [alternativa.id]); // a qué se refiere
  assert.deepEqual(c.payload[2], { ref: g, dir: '2000000000' }); // lo heredado
  assert.equal(c.payload[3], 'nuevo aviso'); // lo nuevo que se registra
});

test('MOT-13b en PV4 se pueden combinar varios candidatos (y terminales nuevos) en una misma posición', async () => {
  const { eje, g } = await mundo();
  const otra = await escribe(eje, g, 'otro yogur', '1000000000');
  const [p1] = descubrir(eje, g, { posiciones: [1] });
  const c = await consolidar(eje, { autor: 'ana', foco: g, t: T0, elecciones: { 1: [{ candidato: p1.candidatos[0] }, { candidato: p1.candidatos[1] }, 'y una nota'] } });
  assert.deepEqual([...c.contexto.fuentes].sort(), [g, otra.id].sort());
  assert.deepEqual(c.payload[1], [{ ref: g, dir: '1000000000' }, { ref: otra.id, dir: '0000000000' }, 'y una nota']); // referencias, no copias
  assert.deepEqual(c.contexto.encaje.map((e) => [e.posicion, e.evento]), [[1, g], [1, otra.id]]);
});

test('MOT-13c en PV4 se muestran las diferencias y qué se reemplaza antes de consolidar',
  { skip: 'MOT-13: no se calculan diferencias entre lo propuesto y lo vigente ni se indica qué se reemplaza (ver MOT-12); la interfaz (app.js, panelFabrica) tampoco' },
  sinForma('MOT-13'));

// =====================================================================
// Motor · ciclo
// =====================================================================

test('MOT-14 el ciclo: descubrir → elegir o crear → consolidar en PV4 → ejecutar con autorización → registrar evidencia', async () => {
  const { eje, g } = await mundo();
  const d = descubrir(eje, g);
  assert.deepEqual(d.map((x) => x.posicion), [1, 2, 3, 4]);
  const elecciones = { 1: { candidato: d[0].candidatos[0] }, 2: 'sin azúcar' }; // elegir y crear
  const c = await consolidar(eje, { autor: 'ana', foco: g, t: T0, elecciones, titulo: 'Compra del yogur' });
  assert.equal(c.en, FABRICA);
  assert.equal(estadoDe(eje, c.id), 'PENDIENTE DE AUTORIZACIÓN');
  const a = await autorizar(eje, { autorizante: 'raiz', consolidacion: c.id, t: T0 });
  assert.equal(estadoDe(eje, c.id), 'AUTORIZADO');
  const e = await ejecutar(eje, { autor: 'ana', consolidacion: c.id, t: T0, movimientos: [daE('ana', 'raiz', 3)] });
  assert.equal(estadoDe(eje, c.id), 'EJECUTADO');
  assert.deepEqual(e.contexto.evidencia, [c.id, a.id]);
});

test('MOT-15 las etapas van en orden: solo se autoriza una consolidación, solo se ejecuta lo autorizado y no dos veces', async () => {
  const { eje, g } = await mundo();
  const nota = await escribe(eje, g, 'una nota cualquiera');
  await assert.rejects(autorizar(eje, { autorizante: 'raiz', consolidacion: nota.id, t: T0 }), /no es una consolidación/);
  await assert.rejects(ejecutar(eje, { autor: 'raiz', consolidacion: nota.id, t: T0 }), /no es una consolidación/);
  const c = await consolidar(eje, { autor: 'ana', foco: g, t: T0, elecciones: { 1: 'x' } });
  await assert.rejects(ejecutar(eje, { autor: 'ana', consolidacion: c.id, t: T0 }), /PENDIENTE DE AUTORIZACIÓN/);
  await autorizar(eje, { autorizante: 'raiz', consolidacion: c.id, t: T0 });
  await assert.rejects(autorizar(eje, { autorizante: 'raiz', consolidacion: c.id, t: T0 }), /ya está autorizado/);
  await ejecutar(eje, { autor: 'ana', consolidacion: c.id, t: T0 });
  await assert.rejects(ejecutar(eje, { autor: 'ana', consolidacion: c.id, t: T0 }), /ya ejecutado/);
});

test('MOT-16 descubrir conserva las alternativas que ocupan la misma posición con distinto id', async () => {
  const { eje, g } = await mundo(['Compra', 'a', 'b', 'c', [['fábrica'], 'x']]); // VG, 7-11 noche: por hojas: 4 décupla, 4.0 lista de uno
  const h = await escribe(eje, g, 'otra fábrica', FABRICA, 'ana');
  const [p4] = descubrir(eje, g, { posiciones: [4] });
  assert.deepEqual(p4.candidatos.map((c) => [c.origen, c.camino.join('.')]), [['propio', '4'], ['propio', '4.0'], ['escrito', '']]); // [4] y [4.0] colisionan
  assert.equal(p4.candidatos[2].evento, h.id);
});

test('MOT-17 elegir no escribe: es reversible hasta consolidar y deja mezclar candidatos y terminales nuevos', async () => {
  const { eje, g } = await mundo();
  const antes = huella(eje);
  const p = proponer(eje, g);
  const elecciones = { ...p.elecciones };
  elecciones[2] = 'cambiado a mano'; // modificar la candidatura
  delete elecciones[4]; // deshacer una elección
  consultar(eje, g, [1], 'ELEGIR(BUSCAR(1))'); // ELEGIR no publica
  assert.equal(huella(eje), antes);
  const c = await consolidar(eje, { autor: 'ana', foco: g, t: T0, elecciones });
  assert.deepEqual(c.payload.slice(1), [{ ref: g, dir: '1000000000' }, 'cambiado a mano', { ref: g, dir: '3000000000' }]);
});

test('MOT-18 consolidar fija la decisión con sus fuentes y vínculos, sin copiar el árbol', async () => {
  const { eje, g } = await mundo();
  const oferta = await escribe(eje, g, ['Oferta', ['muy', 'honda']], '1000000000');
  const elegido = descubrir(eje, g, { posiciones: [1] })[0].candidatos.find((x) => x.evento === oferta.id);
  const c = await consolidar(eje, { autor: 'ana', foco: g, t: T0, elecciones: { 1: { candidato: elegido } } });
  assert.deepEqual(c.contexto.fuentes, [oferta.id]);
  assert.equal(c.contexto.encaje[0].evento, oferta.id);
  assert.equal(c.sobre, g);
  assert.equal(JSON.stringify(c.payload).includes('honda'), false);
});

test('MOT-18b consolidar registra también la época, las reglas y los criterios aplicados',
  { skip: 'MOT-18: el contexto de la consolidación solo tiene {motor, fase, fuentes, encaje, modo}: ni época ni reglas ni criterios (nombres de campo supuestos). [!] Guardar la época en el propio registro roza BTML-04 y TOK-60 (la época no es atributo del dato); los criterios no tienen forma acordada. [X] decidir VG' },
  async () => {
    const { eje, g } = await mundo();
    const c = await consolidar(eje, { autor: 'ana', foco: g, t: T0, elecciones: { 1: 'x' } });
    assert.ok(c.contexto.epoca);
    assert.ok(c.contexto.criterios);
  });

// =====================================================================
// Motor · consolidar ≠ ejecutar
// =====================================================================

test('MOT-19 consolidar no es ejecutar: elegir un yogur no lo compra; no mueve recursos', async () => {
  const { eje, g } = await mundo();
  const antes = [eje.saldo('ana', 'E:raiz/EUR'), eje.saldo('raiz', 'E:raiz/EUR'), eje.poderes('ana'), eje.reputaciones('ana')];
  const c = await consolidar(eje, { autor: 'ana', foco: g, t: T0, elecciones: { 1: 'comprar el yogur', 4: 'pagar 2 EUR' } });
  assert.deepEqual([eje.saldo('ana', 'E:raiz/EUR'), eje.saldo('raiz', 'E:raiz/EUR'), eje.poderes('ana'), eje.reputaciones('ana')], antes);
  assert.deepEqual(c.movimientos.map((m) => m.token), ['T']);
  assert.notEqual(estadoDe(eje, c.id), 'EJECUTADO');
});

test('MOT-20 consultar, elegir, preparar, consolidar, firmar y ejecutar son actos distintos', async () => {
  const { eje, g } = await mundo();
  const antes = huella(eje);
  consultar(eje, g, [1], 'ELEGIR(BUSCAR(1))'); // consultar y elegir: sin registro
  const p = proponer(eje, g); // preparar: sin registro
  assert.equal(huella(eje), antes);
  const c = await consolidar(eje, { autor: 'ana', foco: g, t: T0, elecciones: p.elecciones });
  assert.equal(c.contexto.fase, 'consolidado');
  assert.equal(c.firma, undefined); // consolidar no firma
  const { publica, privada } = await generarClaves();
  const f = await firmar(await crearEvento({ autor: 'x', sobre: g, t: T0, movimientos: [gastaT('x')], payload: 'y' }), privada);
  assert.equal(await verificar(f, publica), true); // firmar es otro acto
  await autorizar(eje, { autorizante: 'raiz', consolidacion: c.id, t: T0 });
  const e = await ejecutar(eje, { autor: 'ana', consolidacion: c.id, t: T0 });
  assert.equal(e.contexto.fase, 'ejecutado');
  assert.notEqual(e.id, c.id);
});

test('MOT-20b acreditar el resultado material es un acto propio',
  { skip: 'MOT-20: no existe el acto de acreditar el resultado material. La capa 4 de src/validez.js (desde la #49) solo mira el respaldo en el libro y dice «externa: sin acreditar»; acreditar lo ocurrido en el mundo es de AARPIA, fuera de AGRAM' },
  sinForma('MOT-20'));

test('MOT-21 una compra autorizada no es una compra hecha: AUTORIZADO ≠ EJECUTADO y los recursos solo se mueven al ejecutar', async () => {
  const { eje, g } = await mundo();
  const { c } = await autorizada(eje, g, { 1: 'comprar', 4: 'pagar 7 EUR' });
  assert.equal(estadoDe(eje, c.id), 'AUTORIZADO');
  assert.equal(eje.saldo('ana', 'E:raiz/EUR'), 50);
  await ejecutar(eje, { autor: 'ana', consolidacion: c.id, t: T0, movimientos: [daE('ana', 'raiz', 7)] });
  assert.equal(estadoDe(eje, c.id), 'EJECUTADO');
  assert.equal(eje.saldo('ana', 'E:raiz/EUR'), 43);
});

// =====================================================================
// Motor · ejecutar
// =====================================================================

test('MOT-22 ejecutar exige el acto del autor de la consolidación y una autorización válida', async () => {
  const { eje, g } = await mundo();
  const c = await consolidar(eje, { autor: 'ana', foco: g, t: T0, elecciones: { 1: 'x' } });
  await assert.rejects(ejecutar(eje, { autor: 'ana', consolidacion: c.id, t: T0 }), /PENDIENTE DE AUTORIZACIÓN/);
  await autorizar(eje, { autorizante: 'raiz', consolidacion: c.id, t: T0 });
  await assert.rejects(ejecutar(eje, { autor: 'bea', consolidacion: c.id, t: T0 }), /ejecuta el autor de la consolidación/);
  await assert.rejects(ejecutar(eje, { autor: 'raiz', consolidacion: c.id, t: T0 }), /ejecuta el autor de la consolidación/);
});

test('MOT-22b ejecutar respeta reglas, condiciones y límites de gasto, tiempo y alcance',
  { skip: 'MOT-22: no hay reglas, condiciones ni límites: ejecutar() mueve todo el saldo E del autor aunque la consolidación no lo mencione. Terreno de la capacidad al ejecutar (ejecutar en src/motor.js, otro agente): no se toca aquí' },
  async () => {
    const { eje, g } = await mundo();
    const { c } = await autorizada(eje, g, { 1: 'un yogur', 4: 'pagar 2 EUR' });
    await assert.rejects(ejecutar(eje, { autor: 'ana', consolidacion: c.id, t: T0, movimientos: [daE('ana', 'raiz', 50)] }));
  });

test('MOT-23 evaluar una fórmula «=» nunca ejecuta nada: leer no tiene efectos', async () => {
  const { eje, g } = await mundo();
  const plan = await escribe(eje, g, ['Plan', 'a', 'b', 'c', 'd', 'e', 'f', '=ELEGIR(BUSCAR(1))', '=LOCAL(1)']);
  const antes = huella(eje);
  assert.equal(evaluar(eje, plan.id, [7]).estado, 'RESUELTO');
  evaluar(eje, plan.id, [8]);
  consultar(eje, plan.id, [7], 'CONTAR(BUSCAR(1))');
  descubrir(eje, plan.id);
  proponer(eje, plan.id);
  assert.equal(huella(eje), antes);
  assert.deepEqual(consolidaciones(eje, plan.id), []);
});

test('MOT-24 PV7 guarda el horizonte: un plan declarado en 7 no se convierte en hecho', async () => {
  const { eje, g } = await mundo();
  const antes = [eje.saldo('ana', 'E:raiz/EUR'), eje.saldo('raiz', 'E:raiz/EUR')];
  const plan = await escribe(eje, g, ['Plan', 'a', 'b', 'c', 'd', 'e', 'f', 'pagar el viernes si llega el pedido'], undefined, 'ana');
  const e = ejeTemporal(eje, plan.id, { ahora: AHORA });
  assert.ok(e.futuro.some((x) => x.tipo === 'declarado' && x.contenido === 'pagar el viernes si llega el pedido'));
  assert.deepEqual([eje.saldo('ana', 'E:raiz/EUR'), eje.saldo('raiz', 'E:raiz/EUR')], antes);
  assert.deepEqual(consolidaciones(eje, plan.id), []);
});

test('MOT-24b PV7 aloja la ejecución condicional y autorizada',
  { skip: 'MOT-24: no existe ejecución condicional ni con fecha; tiempo.ejeTemporal solo lista lo declarado en 7 y las consolidaciones pendientes. Terreno de src/tiempo.js (otro agente): no se toca aquí' },
  sinForma('MOT-24'));

test('MOT-25 registrar el resultado distingue éxito, rechazo, no ocurrido, parcial y sin confirmación',
  { skip: 'MOT-25: solo existe EJECUTADO; una ejecución rechazada lanza un error, no deja registro y el estado sigue en AUTORIZADO (nombre de fase supuesto: cualquier fase de resultado distinta de «autorizado»). [!] Choca con M:TOK-04 y TOK-31, que piden que tras una ejecución rechazada la consolidación siga en AUTORIZADO; y es ejecutar. Terreno de la capacidad al ejecutar (ejecutar en src/motor.js, otro agente): no se toca aquí' },
  async () => {
    const { eje, g } = await mundo();
    const { c } = await autorizada(eje, g);
    await assert.rejects(ejecutar(eje, { autor: 'ana', consolidacion: c.id, t: T0, movimientos: [daE('raiz', 'ana', 1)] }), /nadie mueve tokens ajenos/);
    const resultado = eje.sobre(c.id, FABRICA).find((e) => e.contexto?.fase && e.contexto.fase !== 'autorizado');
    assert.ok(resultado);
    assert.notEqual(estadoDe(eje, c.id), 'AUTORIZADO');
  });

test('MOT-26 la ejecución deja evidencia: un registro nuevo que referencia la consolidación y su autorización, encadenado en el hilo', async () => {
  const { eje, g } = await mundo();
  const { c, a } = await autorizada(eje, g);
  const e = await ejecutar(eje, { autor: 'ana', consolidacion: c.id, t: T0 });
  assert.deepEqual(e.payload.slice(1), [{ ref: c.id }, { ref: a.id }]);
  assert.deepEqual(e.contexto.evidencia, [c.id, a.id]);
  assert.deepEqual(eje.hilo(e.id).slice(0, 3).map((x) => x.id), [e.id, c.id, g]);
});

test('MOT-26b la evidencia acredita el resultado material, no solo el proceso',
  { skip: 'MOT-26: la evidencia es del proceso (consolidación y autorización); la acreditación del resultado material (capa 4) no existe' },
  sinForma('MOT-26'));

// =====================================================================
// Motor · fronteras y autoridad
// =====================================================================

test('MOT-27 PV4 no es el único almacén: lo escrito en 3, 6, 7 y 9 queda en su PV', async () => {
  const { eje, g } = await mundo(['Foco', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']);
  for (const pv of [3, 6, 7, 9]) {
    const ev = await escribirDesde(eje, { modo: 'pointed', autor: 'ana', sobre: g, en: direccion([pv]), payload: 'en el PV ' + pv, t: T0 });
    assert.equal(ev.en, direccion([pv]));
    assert.ok(ocupantes(eje, g, [pv]).some((o) => o.evento === ev.id));
  }
  const c = await consolidar(eje, { autor: 'ana', foco: g, t: T0, elecciones: { 1: 'x' } });
  assert.deepEqual(consolidaciones(eje, g).map((x) => x.id), [c.id]); // solo lo de 4 es consolidación
});

test('MOT-27b registro, autorización y verificación material son fronteras independientes',
  { skip: 'MOT-27: la verificación material no existe (consolidación, autorización y ejecución viven todas en la posición 4)' },
  sinForma('MOT-27'));

test('MOT-28 un flujo puede empezar desde cualquier PV, pero la posición no da autoridad', async () => {
  const { eje, g } = await mundo(['Foco', 'a', 'b', 'c', 'd', 'e', 'f', ['siete', 'x']]);
  const desde7 = await consolidar(eje, { autor: 'ana', foco: g, camino: [7], t: T0, elecciones: { 1: 'desde el 7' } });
  assert.equal(desde7.en, '7400000000');
  // Escribir en la fábrica con fase «autorizado» o «ejecutado» no da autoridad a quien no la tiene.
  await eje.escribir({ autor: 'bea', sobre: desde7.id, en: FABRICA, t: T0, movimientos: [gastaT('bea')], payload: '==autorizo', contexto: { motor: 'fabrica', fase: 'autorizado' } });
  assert.equal(estadoDe(eje, desde7.id), 'PENDIENTE DE AUTORIZACIÓN');
  await eje.escribir({ autor: 'bea', sobre: desde7.id, en: FABRICA, t: T0, movimientos: [gastaT('bea')], payload: 'hecho', contexto: { motor: 'fabrica', fase: 'ejecutado', evidencia: [desde7.id] } });
  assert.equal(estadoDe(eje, desde7.id), 'PENDIENTE DE AUTORIZACIÓN');
});

// =====================================================================
// Motor · fábrica
// =====================================================================

test('MOT-29 la fábrica cierra una sola acción de registro: cada consolidación es un único evento', async () => {
  const { eje, g } = await mundo();
  for (const camino of [[], [1]]) {
    const antes = eje.orden.length;
    const c = await consolidar(eje, { autor: 'ana', foco: g, camino, t: T0, elecciones: { 1: 'x' } });
    assert.equal(eje.orden.length, antes + 1);
    assert.equal(c.en, direccion([...camino, 4]));
  }
});

test('MOT-30 lo consolidado en un registro ocupa un espacio de diez por diez', async () => {
  const { eje, g } = await mundo(['Foco']);
  const elecciones = {};
  for (let i = 1; i <= 9; i++) elecciones[i] = Array.from({ length: 10 }, (_, k) => 'i' + i + ' k' + k);
  const c = await consolidar(eje, { autor: 'ana', foco: g, t: T0, elecciones });
  assert.equal(c.payload.length, 10);
  assert.ok(c.payload.slice(1).every((fila) => Array.isArray(fila) && fila.length === 10));
});

test('MOT-30b las diez posiciones del registro se pueden elegir: diez interpretaciones por diez interacciones',
  { skip: 'MOT-30: el mapa §12 (7-11) fija los ejes: posición × subposición del foco, de 0 a 9, con la clase de modificación como tercera dimensión (la matriz 10×10×10 está en src/escritura.js desde la #40). consolidar() aún reserva la posición 0 para su título y no deja elegirla, así que solo caben nueve por diez' },
  async () => {
    const { eje, g } = await mundo(['Foco']);
    const elecciones = {};
    for (let i = 0; i <= 9; i++) elecciones[i] = Array.from({ length: 10 }, (_, k) => 'i' + i + ' k' + k);
    const c = await consolidar(eje, { autor: 'ana', foco: g, t: T0, elecciones });
    assert.equal(contarPosiciones(c.payload), 100);
  });

test('MOT-31 la fábrica, en 4, emite un evento nuevo con el array consolidado y referencias a sus fuentes; ejecutar es otro acto', async () => {
  const { eje, g } = await mundo();
  const fuente = await escribe(eje, g, 'yogur griego', '1000000000');
  const c = await consolidar(eje, { autor: 'ana', foco: g, t: T0, elecciones: { 1: { ref: fuente.id } } });
  assert.equal(c.en, FABRICA);
  assert.deepEqual(c.payload, ['Consolidación', { ref: fuente.id }]);
  await assert.rejects(ejecutar(eje, { autor: 'ana', consolidacion: c.id, t: T0 }), /PENDIENTE DE AUTORIZACIÓN/); // otra autoridad
  await autorizar(eje, { autorizante: 'raiz', consolidacion: c.id, t: T0 });
  const e = await ejecutar(eje, { autor: 'ana', consolidacion: c.id, t: T0 });
  assert.notEqual(e.id, c.id);
});

test('MOT-32 consolidar no borra nada: varias consolidaciones del mismo foco conviven, cada una con su estado', async () => {
  const { eje, g } = await mundo();
  const c1 = await consolidar(eje, { autor: 'ana', foco: g, t: T0, elecciones: { 1: 'primera' } });
  const { c: c2 } = await autorizada(eje, g, { 1: 'segunda' });
  const c3 = await consolidar(eje, { autor: 'ana', foco: g, t: T0, elecciones: { 1: 'corrección de la primera' } });
  assert.deepEqual(consolidaciones(eje, g).map((x) => [x.id, x.estado]), [[c1.id, 'PENDIENTE DE AUTORIZACIÓN'], [c2.id, 'AUTORIZADO'], [c3.id, 'PENDIENTE DE AUTORIZACIÓN']]);
  assert.ok(eje.obtener(c1.id));
});

test('MOT-33 la consolidación guarda el vector de encaje de cada fuente', async () => {
  const { eje, g } = await mundo();
  const plan = await escribe(eje, g, ['Plan', 'a', 'b', 'c', 'd', 'e', 'f', 'siete']);
  const x = await escribe(eje, g, ['X', { ref: plan.id, dir: '7000000000' }]);
  const ref = descubrir(eje, x.id, { posiciones: [1] })[0].candidatos.find((o) => o.origen === 'referencia');
  const c = await consolidar(eje, { autor: 'ana', foco: x.id, t: T0, elecciones: { 1: { candidato: ref } } });
  const [e] = c.contexto.encaje;
  assert.equal(e.evento, plan.id);
  assert.equal(e.origen, '7000000000');
  assert.equal(e.destino, '1000000000');
  assert.deepEqual(e.vector, [6, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(e.signo, 'reducir');
});

test('MOT-34 la consolidación se ancla en la posición 4 del foco; los huecos se heredan del foco o se rechazan', async () => {
  const { eje, g } = await mundo();
  const c = await consolidar(eje, { autor: 'ana', foco: g, t: T0, elecciones: { 3: 'solo la tercera' } });
  assert.equal(c.en, FABRICA);
  assert.deepEqual(c.payload.slice(1, 3), [{ ref: g, dir: '1000000000' }, { ref: g, dir: '2000000000' }]);
  await assert.rejects(consolidar(eje, { autor: 'ana', foco: g, t: T0, elecciones: { 7: 'lejos' } }), /hueco en 5/);
});

test('MOT-35 la consolidación dura: otros escriben sus propios registros sobre ella sin apropiarse de ella', async () => {
  const { eje, g } = await mundo();
  const { c, a } = await autorizada(eje, g);
  assert.equal(a.autor, 'raiz');
  assert.equal(a.sobre, c.id);
  assert.equal(eje.obtener(c.id).autor, 'ana'); // la operación sigue siendo de ana
  assert.deepEqual(eje.obtener(c.id), c);
});

test('MOT-35b la consolidación referencia los recibos de terceros (aceptación, despacho, recepción)',
  { skip: 'MOT-35: otros solo pueden escribir una autorización que cuente; no hay recibos de aceptación, despacho o recepción ni estados de la frontera externa (nombre de campo supuesto: recibos). No está acordado qué cuenta como recibo (¿cualquier registro de un tercero sobre la consolidación?) ni sus estados (ver MOT-68c). [X] decidir VG' },
  async () => {
    const { eje, g } = await mundo();
    const { c } = await autorizada(eje, g);
    const recibo = await eje.escribir({ autor: 'bea', sobre: c.id, en: FABRICA, t: T0, movimientos: [gastaT('bea')], payload: 'despachado', contexto: { fase: 'despachado' } });
    assert.ok(consolidaciones(eje, g)[0].recibos.includes(recibo.id));
  });

test('MOT-36 cerrar una tarea permite empezar otra sin fingir que la anterior ya no está pendiente', async () => {
  const { eje, g } = await mundo();
  const otra = await escribe(eje, g, ['Otra tarea', 'a']);
  const c1 = await consolidar(eje, { autor: 'ana', foco: g, t: T0, elecciones: { 1: 'primera' } });
  await consolidar(eje, { autor: 'ana', foco: otra.id, t: T0, elecciones: { 1: 'segunda' } });
  assert.equal(consolidaciones(eje, g)[0].estado, 'PENDIENTE DE AUTORIZACIÓN');
  assert.ok(ejeTemporal(eje, g, { ahora: AHORA }).futuro.some((x) => x.id === c1.id && x.tipo === 'consolidacion'));
});

test('MOT-37 las consolidaciones no ejecutadas son futuro subjetivo', async () => {
  const { eje, g } = await mundo();
  const { c } = await autorizada(eje, g);
  const enFuturo = () => ejeTemporal(eje, g, { ahora: AHORA }).futuro.find((x) => x.id === c.id && x.tipo === 'consolidacion');
  assert.equal(enFuturo().estado, 'AUTORIZADO');
  await ejecutar(eje, { autor: 'ana', consolidacion: c.id, t: T0 });
  assert.equal(enFuturo(), undefined);
});

test('MOT-38 se ejecuta en 4 y la ejecución es un registro nuevo que entra en el eje (X → cruz)', async () => {
  const { eje, g } = await mundo();
  const { c } = await autorizada(eje, g);
  const antes = eje.orden.length;
  const e = await ejecutar(eje, { autor: 'ana', consolidacion: c.id, t: T0 });
  assert.equal(e.en, FABRICA);
  assert.equal(e.sobre, c.id);
  assert.equal(eje.orden.length, antes + 1);
  assert.ok(ocupantes(eje, c.id, [4]).some((o) => o.evento === e.id));
});

test('MOT-39 papeles: BTML es la estructura, BQL la vista sin efectos y el motor la ejecución real', async () => {
  const { eje, g } = await mundo(['Compra', 'yogur', '=LOCAL(1)']);
  const antes = huella(eje);
  evaluar(eje, g, [2]);
  consultar(eje, g, [0], 'BUSCAR(1)');
  assert.equal(huella(eje), antes); // BQL no mueve nada
  const { c } = await autorizada(eje, g);
  await ejecutar(eje, { autor: 'ana', consolidacion: c.id, t: T0, movimientos: [daE('ana', 'raiz', 4)] });
  assert.equal(eje.saldo('raiz', 'E:raiz/EUR'), 54); // el motor sí
});

test('MOT-41 AARPIA es el motor real de autorización y ejecución',
  { skip: 'MOT-41: no hay AARPIA; autorizar y ejecutar viven en src/motor.js (por decisión de VG del 6-11 AARPIA queda fuera salvo instancias y transiciones, TOK-74)' },
  sinForma('MOT-41'));

test('MOT-43 lo que escribe quien no puede autorizar o ejecutar no cambia el estado', async () => {
  const { eje, g } = await mundo();
  const c = await consolidar(eje, { autor: 'ana', foco: g, t: T0, elecciones: { 1: 'x' } });
  await eje.escribir({ autor: 'bea', sobre: c.id, en: FABRICA, t: T0, movimientos: [gastaT('bea')], payload: '==autorizo', contexto: { fase: 'autorizado' } });
  assert.equal(autorizacionesValidas(eje, c.id).length, 0);
  assert.equal(estadoDe(eje, c.id), 'PENDIENTE DE AUTORIZACIÓN');
  await autorizar(eje, { autorizante: 'raiz', consolidacion: c.id, t: T0 });
  await eje.escribir({ autor: 'raiz', sobre: c.id, en: FABRICA, t: T0, movimientos: [gastaT('raiz')], payload: 'hecho', contexto: { fase: 'ejecutado', evidencia: [c.id] } });
  assert.equal(estadoDe(eje, c.id), 'AUTORIZADO'); // ejecutar es del autor
});

test('MOT-44 tres estados: PENDIENTE DE AUTORIZACIÓN → AUTORIZADO → EJECUTADO; el pendiente es un estado, no un fallo', async () => {
  const { eje, g } = await mundo();
  const c = await consolidar(eje, { autor: 'ana', foco: g, t: T0, elecciones: { 1: 'x' } }); // no lanza
  const estados = [estadoDe(eje, c.id)];
  await autorizar(eje, { autorizante: 'raiz', consolidacion: c.id, t: T0 });
  estados.push(estadoDe(eje, c.id));
  await ejecutar(eje, { autor: 'ana', consolidacion: c.id, t: T0 });
  estados.push(estadoDe(eje, c.id));
  assert.deepEqual(estados, ['PENDIENTE DE AUTORIZACIÓN', 'AUTORIZADO', 'EJECUTADO']);
});

// =====================================================================
// Motor · operadores Q/B/C
// =====================================================================

test('MOT-46 Q interroga: aplicar un PV es volver a interrogar el resultado, y consultar no cambia ningún hecho', async () => {
  const { eje, g } = await mundo(['Compra', [['recursos'], 'yogur', 'leche'], 'b']); // VG, 7-11 noche: por hojas: 1 décupla
  assert.equal(OPERADORES.Q, 'descubrir');
  const antes = huella(eje);
  const fuera = descubrir(eje, g, { posiciones: [1] });
  const dentro = descubrir(eje, g, { camino: [1], posiciones: [1, 2] }); // el resultado de 1, interrogado otra vez
  assert.equal(fuera[0].dir, '1000000000');
  assert.deepEqual(dentro.map((x) => [x.dir, x.candidatos[0].texto]), [['1100000000', 'yogur'], ['1200000000', 'leche']]);
  evaluar(eje, g, [1, 1]);
  assert.equal(huella(eje), antes);
});

test('MOT-47 B construye una propuesta de cambio sin certificarla', async () => {
  const { eje, g } = await mundo();
  assert.equal(OPERADORES.B, 'proponer');
  const antes = huella(eje);
  const p = proponer(eje, g);
  assert.equal(huella(eje), antes);
  assert.deepEqual(Object.keys(p).sort(), ['elecciones', 'foco', 'origenes', 'pendientes']);
  assert.deepEqual(consolidaciones(eje, g), []);
});

test('MOT-48 C consolida y la autoridad decide después: una consolidación de quien no tiene poder no certifica nada', async () => {
  const { eje, g } = await mundo();
  assert.equal(OPERADORES.C, 'consolidar');
  const c = await consolidar(eje, { autor: 'bea', foco: g, t: T0, elecciones: { 1: 'x' } });
  assert.equal(estadoDe(eje, c.id), 'PENDIENTE DE AUTORIZACIÓN');
  await assert.rejects(autorizar(eje, { autorizante: 'bea', consolidacion: c.id, t: T0 }), /no se autoriza a sí mismo/);
  await assert.rejects(autorizar(eje, { autorizante: 'ana', consolidacion: c.id, t: T0 }), /no tiene poder/);
});

test('MOT-48b C solo consolida lo que permite un contrato válido (con autoridad)',
  { skip: 'MOT-48: consolidar() no comprueba autoridad ni contrato: quien no tiene P consolida; la autoridad llega al autorizar. [!] Choca con V4 (consolidar = registrar la intención; la autorización es para ejecutar). [X] decidir VG' },
  async () => {
    const { eje, g } = await mundo();
    await assert.rejects(consolidar(eje, { autor: 'bea', foco: g, t: T0, elecciones: { 1: 'x' } }));
  });

test('MOT-49 el orden de composición importa: 13 no es 31 (primero i, después j)', async () => {
  assert.deepEqual(leerDireccion('1300000000').map((x) => x.significado), ['recursos', 'con quién']);
  assert.deepEqual(leerDireccion('3100000000').map((x) => x.significado), ['comunicación', 'cuánto']);
  const { eje, g } = await mundo(['F', [['1.0'], '1.1', '1.2', 'uno y tres'], 'b', [['3.0'], 'tres y uno']]); // VG, 7-11 noche: por hojas: 1 y 3 décuplas
  assert.equal(ocupantes(eje, g, [1, 3])[0].contenido, 'uno y tres');
  assert.equal(ocupantes(eje, g, [3, 1])[0].contenido, 'tres y uno');
});

test('MOT-49b existe un operador que vuelve a interrogar el resultado de una aplicación (Q_j∘Q_i)',
  { skip: 'MOT-49: el orden solo cuenta al leer direcciones; no hay operadores Q_i componibles ni PVPath' },
  sinForma('MOT-49'));

test('MOT-50 componer PV de lado y bajar en profundidad son dimensiones distintas',
  { skip: 'MOT-50: el código solo tiene profundidad (direcciones); no hay composición lateral. [!] El mapa (§2.1, §8) lee una dirección como cadena de perspectivas: bajar es aplicar otra perspectiva' },
  sinForma('MOT-50'));

test('MOT-51 la dirección BTML es una cadena de diez dígitos distinta de un PVPath («2342») y de la geometría (4^4)', () => {
  assert.equal(esDireccion('8412300000'), true);
  assert.equal(esDireccion('2342'), false);
  assert.equal(esDireccion('4^4'), false);
  assert.throws(() => leerDireccion('2342'), TypeError);
});

test('MOT-51b PVPath, dirección BTML y geometría tienen nombres distintos en el código',
  { skip: 'MOT-51: solo existe la dirección BTML, y en la época 0 se lee como cadena de perspectivas (leerDireccion), lo que la acerca a PVPath. [X] decidir VG si en la época 0 coinciden' },
  sinForma('MOT-51'));

// =====================================================================
// Motor · registro de salida y proporción por modo
// =====================================================================

test('MOT-54 el registro de salida se anida sobre el foco y va en el PV donde se escribe; el génesis solo en la raíz', async () => {
  const { eje, g } = await mundo();
  const ev = await escribirDesde(eje, { modo: 'pointed', autor: 'ana', sobre: g, en: '2000000000', payload: 'criterio', t: T0 });
  assert.deepEqual([ev.sobre, ev.en], [g, '2000000000']);
  await assert.rejects(crearEvento({ autor: 'x', sobre: null, en: '2000000000', t: T0, movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: null, a: 'x' }], payload: 'g', contexto: { genesis: true } }), /el génesis solo se anida en la raíz/);
});

test('MOT-55 forma por modo: Pointed un terminal; Sequenced una hilera de 1–10 sin huecos; Mapped una décupla con herencia por referencia', async () => {
  const { eje, g } = await mundo();
  assert.equal(desdePointed(eje, 'servido'), 'servido');
  assert.deepEqual(desdePointed(eje, '@' + g.slice(0, 8)), { ref: g }); // un terminal: también una referencia
  assert.throws(() => desdePointed(eje, '   '), /vacío/);
  assert.deepEqual(desdeSequenced(eje, ['a', 'b', '3']), ['a', 'b', 3]);
  assert.throws(() => desdeSequenced(eje, ['a', '', 'c']), /hueco/);
  assert.throws(() => desdeSequenced(eje, Array(11).fill('x')), /más de 10/);
  const celdas = [];
  celdas[3] = ['nuevo aviso'];
  const { payload, heredadas } = desdeMapped(eje, celdas, g);
  assert.deepEqual(heredadas, [0, 1, 2]);
  assert.deepEqual(payload[3], 'nuevo aviso');
  const lejos = [];
  lejos[7] = ['x'];
  // Lo lejano se ancla (mapa §12, «lo lejano = anclaje»; PR #40): la 7 va aparte, en su dirección, sin rellenar 5 y 6.
  const r = desdeMapped(eje, lejos, g);
  assert.equal(r.payload, null);
  assert.deepEqual(r.anclados.map((x) => [x.en, x.payload, x.faltan]), [['7000000000', 'x', ['5', '6']]]);
});

test('MOT-56 la proporción se cuenta en posiciones: una por terminal o referencia', () => {
  assert.equal(contarPosiciones('x'), 1);
  assert.equal(contarPosiciones({ ref: 'a'.repeat(64) }), 1);
  assert.equal(contarPosiciones(['a', ['b', 'c'], { ref: 'a'.repeat(64) }]), 4);
  assert.equal(costeT(['a', ['b', 'c']]), 3);
});

// VG, 7-11 noche: la proporción propone, el máximo manda (decisión 10.3). Antes, MOT-57/58/59 rechazaban por la proporción.
test('MOT-57 desde Pointed se propone una posición de cada diez leídas; el máximo (10) manda', async () => {
  assert.equal(lectura('pointed'), 10);
  assert.deepEqual(escritura('pointed'), [1, 1]);
  assert.equal(cabeEscritura('x', 'pointed'), true);
  assert.equal(cabeEscritura(['x', 'y'], 'pointed'), false); // fuera de la propuesta: solo informa
  const { eje, g } = await mundo();
  const dos = await escribirDesde(eje, { modo: 'pointed', autor: 'ana', sobre: g, payload: ['a', 'b'], t: T0 });
  assert.equal(proporcionDeRegistro(dos).estado, 'por encima'); // se escribe y se avisa
  await assert.rejects(escribirDesde(eje, { modo: 'pointed', autor: 'ana', sobre: g, payload: ['a', ['b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k']], t: T0 }), /Pointed emite como mucho 10 posiciones; este registro tiene 11/);
  const { a } = await autorizada(eje, g);
  assert.equal(a.contexto.modo, 'pointed');
  assert.equal(contarPosiciones(a.payload), 1);
});

test('MOT-58 desde Sequenced se propone como mucho una quinta parte de lo leído (20 de 100); el máximo (100) manda', async () => {
  assert.equal(lectura('sequenced'), 100);
  assert.deepEqual(escritura('sequenced'), [10, 20]);
  const { eje, g } = await mundo();
  const veintiuna = [Array(10).fill('x'), Array(10).fill('y'), 'z'];
  const ev = await escribirDesde(eje, { modo: 'sequenced', autor: 'ana', sobre: g, payload: veintiuna, t: T0 });
  assert.match(proporcionDeRegistro(ev).aviso, /^Sequenced propone escribir de 10 a 20 posiciones .*esto tiene 21, por encima\. No es error/);
  const cientoUna = [...Array(9).fill(Array(10).fill('x')), [...Array(9).fill('y'), ['z', 'z', 'z']]];
  assert.equal(contarPosiciones(cientoUna), 102);
  await assert.rejects(escribirDesde(eje, { modo: 'sequenced', autor: 'ana', sobre: g, payload: cientoUna, t: T0 }), /Sequenced emite como mucho 100 posiciones; este registro tiene 102/);
});

test('MOT-58b desde Sequenced se escribe al menos una décima parte de lo leído',
  { skip: 'MOT-58: el mínimo no se exige (escribirDesde acepta una posición) y desdeSequenced solo llega a 10 posiciones. El mapa §12 fija topes duros por modo (Sequenced 100) además de la proporción, y que siempre se emite algo (los topes están en src/modos.js desde la #40); no fija un mínimo. [!] §10.1 dice «Sequenced 1–2 de 100», que no cuadra con «entre un quinto y un décimo». [X] decidir VG si el mínimo de la banda es obligatorio (MOT-60)' },
  async () => {
    const { eje, g } = await mundo();
    await assert.rejects(escribirDesde(eje, { modo: 'sequenced', autor: 'ana', sobre: g, payload: ['solo una'], t: T0 }));
  });

test('MOT-59 desde Mapped se propone como mucho un tercio de lo leído (333 de 1000); el máximo (1000) manda', async () => {
  assert.equal(lectura('mapped'), 1000);
  assert.deepEqual(escritura('mapped'), [250, 333]);
  const { eje, g } = await mundo();
  const encima = Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => Array(4).fill('x'))); // 400 posiciones
  assert.equal(contarPosiciones(encima), 400);
  // Por encima de la propuesta, dentro del máximo: la escritura no lo rechaza (aquí falla por saldo de T, no por la proporción).
  assert.equal(proporcionDe(400, 'mapped').estado, 'por encima');
  await assert.rejects(escribirDesde(eje, { modo: 'mapped', autor: 'ana', sobre: g, payload: encima, t: T0 }), /saldo insuficiente de T:minuto/);
  const milUna = Array.from({ length: 10 }, (_, i) => Array.from({ length: 10 }, (_, j) => (i === 9 && j === 9 ? Array(11).fill('x') : Array(10).fill('x'))));
  assert.equal(contarPosiciones(milUna), 1001);
  await assert.rejects(escribirDesde(eje, { modo: 'mapped', autor: 'ana', sobre: g, payload: milUna, t: T0 }), /Mapped emite como mucho 1000 posiciones; este registro tiene 1001/);
});

test('MOT-59b desde Mapped se escribe al menos un cuarto de lo leído (250 de 1000)',
  { skip: 'MOT-59: solo se exige el máximo; escribirDesde en Mapped acepta una posición, desdeMapped conforma la matriz 10×10×10 bajo un camino y consolidar() escribe en Mapped con pocas posiciones. El mapa §12 fija topes duros por modo (Mapped 1000) además de la proporción (están en src/modos.js desde la #40); no fija un mínimo. [X] decidir VG si el mínimo de la banda es obligatorio (MOT-60)' },
  async () => {
    const { eje, g } = await mundo();
    await assert.rejects(escribirDesde(eje, { modo: 'mapped', autor: 'ana', sobre: g, payload: ['una'], t: T0 }));
  });

// =====================================================================
// Motor · cinco capas de validez y evaluación segura
// =====================================================================

test('MOT-61 capas de validez distintas: forma, interpretación, criptografía y permiso se comprueban por separado', async () => {
  const raiz = await generarClaves();
  const eje = await Eje.genesis({ identidad: 'raiz', emision: EMISION, foco: ['Foco', 'a'], t: T0, clave: raiz.publica, privada: raiz.privada });
  const g = eje.genesisId;
  // 1 · forma
  assert.ok(validarForma({ autor: 'raiz', sobre: g, en: '4', t: T0, movimientos: [gastaT('raiz')], payload: 'x' }).length > 0);
  // 2 · interpretación
  const p = await eje.escribir({ autor: 'raiz', sobre: g, t: T0, movimientos: [gastaT('raiz')], payload: ['P', '=LOCAL(9)', { ref: ID_INEXISTENTE }] }, raiz.privada);
  assert.equal(evaluar(eje, p.id, [1]).estado, 'PENDIENTE');
  assert.equal(ocupantes(eje, p.id, [2]).find((o) => o.origen === 'referencia').rota, true);
  // 3 · criptografía y procedencia
  assert.equal(await verificarId(p), true);
  assert.equal(await verificarId({ ...p, payload: 'cambiado' }), false);
  assert.equal(await verificar(p, raiz.publica), true);
  // 5 · permiso y ejecución
  await eje.escribir({ autor: 'raiz', sobre: g, t: T0, movimientos: [gastaT('raiz'), daT('raiz', 'ana', 60)], payload: 'alta' }, raiz.privada);
  const c = await consolidar(eje, { autor: 'ana', foco: g, t: T0, elecciones: { 1: 'x' } });
  assert.equal(estadoDe(eje, c.id), 'PENDIENTE DE AUTORIZACIÓN');
});

test('MOT-61b la acreditación material (capa 4) y un informe por capas',
  { skip: 'MOT-61: el informe por capas ya existe (src/validez.js, desde la #49; lo comprueba MOT-61c), pero su capa 4 solo mira el respaldo en el libro: acreditar el resultado material en el mundo no tiene acto ni dato propio (AARPIA, fuera de AGRAM)' },
  sinForma('MOT-61'));

test('MOT-61c un informe por capas: cinco estados independientes, sin veredicto global', async () => {
  const { validez, CAPAS, ESTADOS_CAPA } = await import('../src/validez.js');
  const { eje, g } = await mundo();
  const alta = eje.sobre(g)[0];
  const v = await validez(eje, alta.id);
  assert.deepEqual(v.capas.map((c) => c.capa), [1, 2, 3, 4, 5]);
  assert.deepEqual(CAPAS.map((c) => c.clave), ['forma', 'interpretacion', 'criptografia', 'acreditacion', 'permiso']);
  for (const c of v.capas) assert.ok(ESTADOS_CAPA.includes(c.estado), c.clave + ': ' + c.estado);
  for (const global of ['valido', 'valida', 'veredicto', 'puntuacion']) assert.equal(v[global], undefined, global);
  assert.match(v.acreditacion.resumen, /externa: sin acreditar/); // la capa 4 mira el libro; el mundo queda fuera
});

test('MOT-62 las capas no se confunden: estructura válida y firmada no es autorización; la firma solo prueba quién escribe', async () => {
  const raiz = await generarClaves();
  const bea = await generarClaves();
  const eje = await Eje.genesis({ identidad: 'raiz', emision: EMISION, foco: ['Foco', 'a'], t: T0, clave: raiz.publica, privada: raiz.privada });
  const g = eje.genesisId;
  await eje.escribir({ autor: 'raiz', sobre: g, t: T0, movimientos: [gastaT('raiz'), daT('raiz', 'ana', 60), daT('raiz', 'bea', 60)], payload: 'altas', contexto: { claves: { bea: bea.publica } } }, raiz.privada);
  const c = await consolidar(eje, { autor: 'ana', foco: g, t: T0, elecciones: { 1: 'x' } });
  const firmada = await eje.escribir({ autor: 'bea', sobre: c.id, en: FABRICA, t: T0, movimientos: [gastaT('bea')], payload: '==autorizo', contexto: { motor: 'fabrica', fase: 'autorizado' } }, bea.privada);
  assert.deepEqual(validarForma(firmada), []);
  assert.equal(await verificar(firmada, bea.publica), true);
  assert.equal(estadoDe(eje, c.id), 'PENDIENTE DE AUTORIZACIÓN');
});

test('MOT-63 en el registro en foco se pueden inspeccionar señales de validez, que no la garantizan', async () => {
  const raiz = await generarClaves();
  const eje = await Eje.genesis({ identidad: 'raiz', emision: EMISION, foco: ['Foco', 'a'], t: T0, clave: raiz.publica, privada: raiz.privada });
  const ev = await eje.escribir({ autor: 'raiz', sobre: eje.genesisId, t: T0, movimientos: [gastaT('raiz')], payload: ['Dice', 'que está pagado'] }, raiz.privada);
  // Señales: forma, id y firma.
  assert.deepEqual(validarForma(ev), []);
  assert.equal(await verificarId(ev), true);
  assert.equal(ev.firmante, 'raiz');
  assert.equal(await verificar(ev, raiz.publica), true);
  // Que lo diga un registro bien formado y firmado no lo hace pagado: no hay estado ni movimiento de E.
  assert.deepEqual(ev.movimientos.map((m) => m.token), ['T']);
});

test('MOT-63b una vista por registro de las señales de las capas 2, 4 y 5',
  { skip: 'MOT-63: app.js muestra «firmado/sin firma» y el JSON (capas 1 y 3); no hay vista por registro de las capas 2, 4 y 5. [!] Según §9, PV5 es el propio registro en foco y PV0 la lente' },
  sinForma('MOT-63'));

test('MOT-64 un fallo no borra alternativas ni hace pasar un pendiente por incompatible', async () => {
  const { eje, g } = await mundo();
  const roto = await escribe(eje, g, '=1 +', '1000000000');
  const [p1] = descubrir(eje, g, { posiciones: [1] });
  assert.deepEqual(p1.candidatos.map((c) => [c.evento, c.estado]), [[g, 'RESUELTO'], [roto.id, 'ERROR']]);
  const plan = await escribe(eje, g, ['Plan', '=LOCAL(9)', '="a" + 1']);
  assert.equal(evaluar(eje, plan.id, [1]).estado, 'PENDIENTE');
  assert.equal(evaluar(eje, plan.id, [2]).estado, 'INCOMPATIBLE');
  assert.match(proponer(eje, plan.id).pendientes[0].motivo, /^PENDIENTE/);
});

test('MOT-65 la evaluación retiene procedencia y vectores para auditoría y tiene límites de cálculo', async () => {
  const { eje, g } = await mundo();
  const fuente = await escribe(eje, g, 'otro', '1000000000');
  const elegido = descubrir(eje, g, { posiciones: [1] })[0].candidatos.find((x) => x.evento === fuente.id);
  const c = await consolidar(eje, { autor: 'ana', foco: g, t: T0, elecciones: { 1: { candidato: elegido } } });
  assert.equal(c.contexto.encaje[0].evento, fuente.id);
  assert.equal(c.contexto.encaje[0].vector.length, 10);
  const enorme = '=' + Array.from({ length: 3000 }, () => '1').join(' + ');
  const x = await escribe(eje, g, ['X', enorme]);
  assert.notEqual(evaluar(eje, x.id, [1]).estado, 'RESUELTO');
});

test('MOT-65b la evaluación limita el número de candidatos, sin presentar el corte como completo', async () => {
  const { eje, g } = await mundo();
  await escribe(eje, g, 'uno', '1000000000');
  await escribe(eje, g, 'dos', '1000000000');
  const [p1] = descubrir(eje, g, { posiciones: [1], maximo: 1 });
  assert.ok(p1.candidatos.length <= 1);
  assert.deepEqual([p1.total, p1.limitada], [3, true]); // el resto no se borra: se dice cuántos hay
  const [todo] = descubrir(eje, g, { posiciones: [1] });
  assert.deepEqual([todo.candidatos.length, todo.total, todo.limitada], [3, 3, false]);
  assert.deepEqual(p1.candidatos.map((c) => c.evento), todo.candidatos.slice(0, 1).map((c) => c.evento)); // los primeros por encaje
});

test('MOT-65c la evaluación guarda caché y snapshot de resultados, reglas y época, con versiones y límite de tiempo',
  { skip: 'MOT-65: no hay caché ni snapshot de reglas ni de época, ni versiones de implementación, ni límite de tiempo' },
  sinForma('MOT-65'));

// =====================================================================
// Motor · genericidad
// =====================================================================

test('MOT-67 el motor es genérico: sin funciones por sector, y una composición puede ser nodo de otra', async () => {
  const { eje, g } = await mundo();
  const c1 = await consolidar(eje, { autor: 'ana', foco: g, t: T0, elecciones: { 1: 'primera composición' } });
  // La consolidación es foco y fuente de otra, sin código especial.
  const c2 = await consolidar(eje, { autor: 'ana', foco: c1.id, t: T0, elecciones: { 1: { ref: c1.id, dir: '1000000000' } } });
  assert.deepEqual(c2.contexto.fuentes, [c1.id]);
  assert.equal(consultar(eje, c2.id, [0], 'LOCAL(1)').texto, 'primera composición');
  for (const nombre of Object.keys(motor)) assert.equal(/ikisai|reserva|booking|compra|yogur|menu|hotel/i.test(nombre), false, nombre);
});

test('MOT-68 no se impone una máquina de estados a todo: el ciclo de autorización es solo de las consolidaciones', async () => {
  const { eje, g } = await mundo();
  const nota = await escribe(eje, g, 'una nota');
  await assert.rejects(autorizar(eje, { autorizante: 'raiz', consolidacion: nota.id, t: T0 }), /no es una consolidación/);
  await assert.rejects(ejecutar(eje, { autor: 'raiz', consolidacion: nota.id, t: T0 }), /no es una consolidación/);
  assert.equal(nota.contexto.fase, undefined);
  assert.deepEqual(consolidaciones(eje, g), []);
});

test('MOT-68b ningún registro recibe un estado que no le corresponde', async () => {
  const { eje, g } = await mundo();
  assert.equal(estadoDe(eje, g), undefined);
  const nota = await escribe(eje, g, 'una nota');
  assert.equal(estadoDe(eje, nota.id), undefined);
  const { c, a } = await autorizada(eje, g);
  assert.equal(estadoDe(eje, a.id), undefined); // la autorización no es otra consolidación
  assert.equal(estadoDe(eje, c.id), 'AUTORIZADO');
});

test('MOT-68c los contextos tienen sus propios estados, sin una máquina de estados universal',
  { skip: 'MOT-68: toda consolidación tiene el mismo ciclo de tres estados, sin estados propios del contexto (aceptado, despachado, recibido…). [X] decidir VG si el ciclo de autorización cuenta como máquina de estados universal' },
  sinForma('MOT-68'));

// =====================================================================
// Motor · tokens (M:TOK)
// =====================================================================

test('M:TOK-01 cada posición escrita mueve un minuto de T del autor (consolidar y autorizar)', async () => {
  const { eje, g } = await mundo();
  const c = await consolidar(eje, { autor: 'ana', foco: g, t: T0, elecciones: { 1: 'uno', 2: ['dos', 'tres'] } });
  assert.equal(minutosDe(c), contarPosiciones(c.payload));
  assert.equal(minutosDe(c), 4);
  const a = await autorizar(eje, { autorizante: 'raiz', consolidacion: c.id, t: T0 });
  assert.equal(minutosDe(a), contarPosiciones(a.payload));
});

test('M:TOK-01b ejecutar también paga un minuto por posición escrita', async () => {
  const { eje, g } = await mundo();
  const { c } = await autorizada(eje, g);
  const e = await ejecutar(eje, { autor: 'ana', consolidacion: c.id, t: T0 });
  assert.equal(minutosDe(e), contarPosiciones(e.payload));
});

test('M:TOK-02 el coste en minutos se paga con T de minuto, no con horas convertidas', async () => {
  const eje = await Eje.genesis({ identidad: 'raiz', emision: [{ token: 'T', escala: 'hora', cantidad: 10 }], foco: ['Casa', 'x'], t: T0 });
  await assert.rejects(escribirDesde(eje, { modo: 'pointed', autor: 'raiz', sobre: eje.genesisId, en: '1000000000', payload: 'nota', t: T0 }), /saldo insuficiente/);
});

test('M:TOK-03 cada acto del ciclo mueve al menos T de su autor; E, P y R solo se mueven al ejecutar', async () => {
  const { eje, g } = await mundo();
  const { c, a } = await autorizada(eje, g);
  const e = await ejecutar(eje, { autor: 'ana', consolidacion: c.id, t: T0, movimientos: [daE('ana', 'raiz', 2)] });
  for (const ev of [c, a, e]) assert.ok(minutosDe(ev) >= 1, ev.contexto.fase);
  assert.deepEqual([c, a].map((ev) => ev.movimientos.map((m) => m.token)), [['T'], ['T']]);
  assert.deepEqual(e.movimientos.map((m) => m.token), ['T', 'E']);
});

test('M:TOK-04 la reserva: la plaza es una serie limitada; la segunda reserva solapada se escribe y colisiona, pero no se ejecuta por saldo', async () => {
  // Así funciona hoy solo si la casa es el génesis, consolida y ejecuta (ver M:TOK-04b).
  const { eje, hab } = await casaConUnaPlaza();
  const { c: r1, pedido: p1 } = await reservaDeLaCasa(eje, hab, 'h1');
  const { c: r2, pedido: p2 } = await reservaDeLaCasa(eje, hab, 'h2');
  assert.deepEqual(ocupantes(eje, hab, [1, 4]).filter((o) => o.origen === 'escrito').map((o) => o.evento), [p1.id, p2.id]); // colisionan
  await ejecutar(eje, { autor: 'casa', consolidacion: r1.id, t: T0, movimientos: [daE('casa', 'h1', 1, 'plaza-7-11', 'casa')] });
  assert.equal(eje.saldo('h1', 'E:casa/plaza-7-11'), 1);
  await assert.rejects(ejecutar(eje, { autor: 'casa', consolidacion: r2.id, t: T0, movimientos: [daE('casa', 'h2', 1, 'plaza-7-11', 'casa')] }), /saldo insuficiente/);
  assert.deepEqual([estadoDe(eje, r1.id), estadoDe(eje, r2.id)], ['EJECUTADO', 'AUTORIZADO']);
});

test('M:TOK-04b la reserva del huésped mueve la plaza de la casa al huésped, y la casa emite su propia serie',
  { skip: 'M:TOK-04: la casa ya emite su serie (E:casa/plaza), pero ejecuta el autor de la consolidación y nadie mueve tokens ajenos: el huésped no puede mover la plaza de la casa. [X] decidir VG cómo casa con TOK-35. Terreno de la capacidad al ejecutar (ejecutar en src/motor.js, otro agente): no se toca aquí' },
  async () => {
    const { eje } = await reservaDelHuesped();
    assert.equal(eje.saldo('huesped', 'E:casa/plaza'), 1);
  });

// =====================================================================
// Tokens · base y series
// =====================================================================

test('TOK-01 todo evento es una transición de tokens: no existe evento sin movimiento', async () => {
  const { eje, g } = await mundo();
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: g, t: T0, movimientos: [], payload: 'quieto' }), /todo evento mueve tokens/);
  assert.ok([...eje.eventos.values()].every((ev) => ev.movimientos.length > 0));
});

test('TOK-02 el evento mínimo mueve T del autor (en el génesis, el autor lo recibe)', async () => {
  await assert.rejects(Eje.genesis({ identidad: 'raiz', emision: [{ token: 'P', cantidad: 1, ambito: 'genesis' }], foco: 'x', t: T0 }), /el génesis debe emitir T al autor/);
  const { eje, g } = await mundo();
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: g, t: T0, movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'bea', a: null }], payload: 'x' }), /el autor debe mover T/);
  const minimo = await escribe(eje, g, 'nota', undefined, 'ana');
  assert.deepEqual(minimo.movimientos.map((m) => [m.token, m.de]), [['T', 'ana']]);
});

test('TOK-03 E/P/R/T son registros del eje, sin Nostr ni Bitcoin: los saldos se derivan de los eventos', async () => {
  const { eje } = await mundo();
  for (const [f, especificador] of importsDeSrc()) assert.ok(especificador.startsWith('.'), f + ' importa ' + especificador);
  const datos = JSON.parse(JSON.stringify(serializar(eje)));
  const otro = await Eje.desde(datos.eventos);
  assert.equal(huella(otro), huella(eje));
});

test('TOK-03b los tokens viven en una base de datos',
  { skip: 'TOK-03: el eje vive en memoria y en localStorage; la persistencia en base de datos está pendiente (MAPA §11)' },
  sinForma('TOK-03'));

test('TOK-04 las series siguen la misma mecánica: E por denominación, P por ámbito, R por emisor', async () => {
  const eje = await Eje.genesis({
    identidad: 'raiz',
    emision: [...EMISION, { token: 'E', denominacion: 'EUR', cantidad: 100 }, { token: 'E', denominacion: 'kg', cantidad: 5 }, { token: 'R', cantidad: 10, emisor: 'raiz' }],
    foco: 'x',
    t: T0,
  });
  const g = eje.genesisId;
  assert.deepEqual([eje.saldo('raiz', 'E:raiz/EUR'), eje.saldo('raiz', 'E:raiz/kg')], [100, 5]);
  await assert.rejects(eje.escribir({ autor: 'raiz', sobre: g, t: T0, movimientos: [gastaT('raiz'), { token: 'E', emisor: 'raiz', denominacion: 'kg', cantidad: 6, de: 'raiz', a: null }], payload: 'x' }), /saldo insuficiente/);
  assert.deepEqual(eje.poderes('raiz'), [{ ambito: 'genesis', cantidad: 5 }]);
  assert.deepEqual(eje.reputaciones('raiz'), [{ emisor: 'raiz', cantidad: 10 }]);
});

test('TOK-04b también T es una serie: un saldo por escala', async () => {
  const eje = await Eje.genesis({ identidad: 'raiz', emision: [{ token: 'T', escala: 'hora', cantidad: 2 }, { token: 'T', escala: 'minuto', cantidad: 120 }], foco: 'x', t: T0 });
  await assert.rejects(eje.escribir({ autor: 'raiz', sobre: eje.genesisId, t: T0, movimientos: [{ token: 'T', escala: 'hora', cantidad: 3, de: 'raiz', a: null }], payload: 'x' }), /saldo insuficiente/);
});

// =====================================================================
// Tokens · T (escalas, zoom, calendario)
// =====================================================================

test('TOK-05 T son siete tokens, uno por escala, cada uno con su propio saldo', async () => {
  const eje = await Eje.genesis({ identidad: 'raiz', emision: [{ token: 'T', escala: 'hora', cantidad: 1 }], foco: 'x', t: T0 });
  assert.equal(eje.saldoT('raiz', 'hora'), 1);
  assert.equal(eje.saldoT('raiz', 'minuto'), 0);
});

test('TOK-06 las escalas de T no se convierten entre sí: gastar en una no consume saldo de otra', async () => {
  const eje = await Eje.genesis({ identidad: 'raiz', emision: [{ token: 'T', escala: 'hora', cantidad: 100 }, { token: 'T', escala: 'anio', cantidad: 1 }], foco: 'x', t: T0 });
  const g = eje.genesisId;
  await assert.rejects(eje.escribir({ autor: 'raiz', sobre: g, t: T0, movimientos: [{ token: 'T', escala: 'dia', cantidad: 300, de: 'raiz', a: null }], payload: 'x' }), /saldo insuficiente/);
  await assert.rejects(eje.escribir({ autor: 'raiz', sobre: g, t: T0, movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'raiz', a: null }], payload: 'x' }), /saldo insuficiente/);
});

test('TOK-07 una misma actividad puede mover a la vez varias escalas de T', async () => {
  const eje = await Eje.genesis({ identidad: 'raiz', emision: ESCALAS_T.map((escala) => ({ token: 'T', escala, cantidad: 10 })), foco: 'x', t: T0 });
  const ev = await eje.escribir({ autor: 'raiz', sobre: eje.genesisId, t: T0, movimientos: ['minuto', 'dia', 'semana', 'anio'].map((escala) => ({ token: 'T', escala, cantidad: 1, de: 'raiz', a: null })), payload: 'intervención, atención, horizonte, estrategia' });
  assert.deepEqual(ev.movimientos.map((m) => m.escala), ['minuto', 'dia', 'semana', 'anio']);
});

test('TOK-07b las escalas que mueve una actividad son saldos independientes', async () => {
  const eje = await Eje.genesis({ identidad: 'raiz', emision: [{ token: 'T', escala: 'minuto', cantidad: 10 }, { token: 'T', escala: 'dia', cantidad: 10 }], foco: 'x', t: T0 });
  await eje.escribir({ autor: 'raiz', sobre: eje.genesisId, t: T0, movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'raiz', a: null }, { token: 'T', escala: 'dia', cantidad: 1, de: 'raiz', a: null }], payload: 'x' });
  assert.deepEqual([eje.saldoT('raiz', 'minuto'), eje.saldoT('raiz', 'dia')], [9, 9]);
});

test('TOK-08 las escalas de T son exactamente siete: segundo, minuto, hora, día, semana, ciclo de 28 días y año', () => {
  assert.deepEqual([...ESCALAS_T], ['segundo', 'minuto', 'hora', 'dia', 'semana', 'ciclo', 'anio']);
  for (const mala of ['mes', 'trimestre', 'decada']) {
    assert.ok(validarMovimiento({ token: 'T', escala: mala, cantidad: 1, de: 'x', a: null }).some((e) => /escala T inválida/.test(e)), mala);
  }
});

test('TOK-09 T tiene hoy siete escalas', () => {
  assert.equal(ESCALAS_T.length, 7);
  assert.equal(Object.isFrozen(ESCALAS_T), true);
});

test('TOK-09b T se puede ampliar como máximo hasta diez escalas', () => {
  assert.equal(tokens.MAXIMO_ESCALAS_T, 10);
});

test('TOK-11 elegir una escala o un zoom de tiempo no concede tiempo: cambiar la vista no mueve saldos', async () => {
  const { eje, g } = await mundo();
  const antes = huella(eje);
  for (const e of ESCALAS_T) banda(SEGUNDOS[e]);
  for (const maximo of [1, 10, 100]) ejeTemporal(eje, g, { ahora: AHORA, maximo });
  ejeTemporal(eje, g, { ahora: '2030-01-01T00:00:00Z' });
  mapa(eje, g);
  secuencia(eje, g, { sentido: 'hijos' });
  assert.equal(huella(eje), antes);
});

test('TOK-12 PV6 y PV7 usan las siete escalas como bandas de los hilos', async () => {
  const { eje, g } = await mundo();
  await escribe(eje, g, 'mañana', undefined, 'ana', '2026-11-08T12:00:00Z');
  const e = ejeTemporal(eje, g, { ahora: AHORA });
  for (const x of [...e.pasado, ...e.futuro]) assert.ok([...ESCALAS_T, 'mas'].includes(x.banda), x.banda);
  assert.equal(e.futuro.find((x) => x.tipo === 'proyeccion').banda, 'semana'); // justo un día ya no cabe en «dia»: la banda siguiente
});

test('TOK-12b la escala elegida en PV4 cambia la expectativa, la exigencia y la resolución de la fábrica',
  { skip: 'TOK-12: PV4 no tiene escala elegible; consolidar() no la recibe ni la registra (nombre supuesto: escala)' },
  async () => {
    const { eje, g } = await mundo();
    const c = await consolidar(eje, { autor: 'ana', foco: g, t: T0, elecciones: { 1: 'x' }, escala: 'semana' });
    assert.equal(c.contexto.escala, 'semana');
  });

test('TOK-14 el 7 de la geometría 7^7 de PV4 no es el número de escalas de T', async () => {
  assert.equal(ESCALAS_T.length, 7);
  for (const m of Object.keys(MODOS)) assert.notEqual(lectura(m), 7 ** 7, m);
  const { eje, g } = await mundo(['Foco']);
  const elecciones = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [i + 1, 'p' + (i + 1)]));
  const c = await consolidar(eje, { autor: 'ana', foco: g, t: T0, elecciones });
  assert.equal(c.payload.length, 10); // la fábrica tiene diez posiciones, no siete
});

test('TOK-16 el ciclo nativo es siempre de 28 días y la semana de 7; el mes gregoriano no es una escala', () => {
  assert.equal(SEGUNDOS.ciclo, 28 * 86400);
  assert.equal(SEGUNDOS.semana, 7 * 86400);
  assert.equal(SEGUNDOS.anio, (13 * 28 + 1) * 86400);
  assert.equal(ESCALAS_T.includes('mes'), false);
  assert.equal(banda(27 * 86400), 'ciclo');
  assert.equal(banda(29 * 86400), 'anio'); // 29 días no caben en un ciclo, aunque sí en un mes civil
});

test('TOK-16b el calendario civil es una vista alternativa de las fechas nativas',
  { skip: 'TOK-16: no hay vista nativa de una fecha (año, ciclo, día) ni vista civil alternativa; los t de los eventos son ISO civiles. Terreno de src/tiempo.js (otro agente): no se toca aquí' },
  sinForma('TOK-16'));

test('TOK-19 los hilos son cadenas de registros encadenados por referencia (sobre), no una secuencia temporal', async () => {
  // El t de un evento no es anterior al de su foco ([X] confirmar VG, src/ciclo.js): el hilo no va hacia atrás en
  // el reloj. No es una secuencia temporal porque deja fuera lo escrito entre medias sobre otro foco (suelto).
  const { eje, g } = await mundo();
  const a = await escribe(eje, g, 'a', undefined, 'ana', '2026-11-07T11:00:00Z');
  const suelto = await escribe(eje, g, 'suelto', undefined, 'ana', '2026-11-07T11:05:00Z');
  const b = await escribe(eje, a.id, 'b', undefined, 'ana', '2026-11-07T11:10:00Z');
  const c = await escribe(eje, b.id, 'c', undefined, 'ana', '2026-11-07T11:30:00Z');
  assert.deepEqual(eje.hilo(c.id).map((e) => e.id), [c.id, b.id, a.id, g]);
  assert.equal(eje.hilo(c.id).some((e) => e.id === suelto.id), false);
  // Escribir sobre a con un t anterior al suyo se rechaza.
  await assert.rejects(escribe(eje, a.id, 'antes', undefined, 'ana', '2026-11-07T10:30:00Z'), /el t del evento \(2026-11-07T10:30:00Z\) es anterior al de su foco/);
});

test('TOK-19b el eje temporal ordena el pasado por la posición en el hilo, no por la fecha',
  { skip: 'TOK-19: ejeTemporal ordena el pasado por fecha frente a ahora (tiempo.js), no por la posición en el hilo. Terreno de src/tiempo.js (otro agente): no se toca aquí' },
  async () => {
    const { eje, g } = await mundo();
    // Desde el ciclo E/P/R/T el t de un evento no es anterior al de su foco ([X] confirmar VG): un hilo con b
    // anterior a a ya no se puede escribir, y por fecha y por posición en el hilo el pasado sale en el mismo orden.
    const a = await escribe(eje, g, 'a', undefined, 'ana', '2026-11-07T11:00:00Z');
    const b = await escribe(eje, a.id, 'b', undefined, 'ana', '2026-11-07T11:10:00Z');
    const c = await escribe(eje, b.id, 'c', undefined, 'ana', '2026-11-07T11:30:00Z');
    const e = ejeTemporal(eje, c.id, { ahora: AHORA });
    assert.deepEqual(e.pasado.map((x) => x.id), eje.hilo(c.id).slice(1).map((x) => x.id));
  });

test('TOK-20 en el eje 6/7 los registros van al pasado y las proyecciones al futuro; el presente es la costura', async () => {
  const { eje, g } = await mundo();
  // Antes de AHORA (12:00) pero no antes del génesis ni del alta de ana (10:00): el t de un evento no es anterior al
  // de su foco ni al alta de su autor ([X] confirmar VG, src/ciclo.js). Antes iba «ayer», el 6-11.
  const antes = await escribe(eje, g, 'antes', undefined, 'ana', '2026-11-07T11:00:00Z');
  const manana = await escribe(eje, g, 'mañana', undefined, 'ana', '2026-11-08T12:00:00Z');
  const e = ejeTemporal(eje, g, { ahora: AHORA });
  assert.ok(e.pasado.some((x) => x.id === antes.id));
  assert.ok(e.futuro.some((x) => x.id === manana.id && x.tipo === 'proyeccion'));
  assert.ok(e.pasado.every((x) => x.delta <= 0));
  assert.ok(e.futuro.filter((x) => x.tipo === 'proyeccion').every((x) => x.delta > 0));
});

test('TOK-20b Mapped no pinta a la derecha (futuro) lo que ya ocurrió',
  { skip: 'TOK-20: mapped.js pinta a la derecha del foco todos sus hijos, también los ya ocurridos. Depende de cómo se reparten los hijos del foco entre pasado y futuro (ejeTemporal). Terreno de src/tiempo.js (otro agente): no se toca aquí' },
  async () => {
    const { eje, g } = await mundo();
    const ayer = await escribe(eje, g, 'ayer', undefined, 'ana', '2026-11-07T11:00:00Z'); // no antes del génesis (src/ciclo.js)
    const derecha = sobrioMapa(mapa(eje, g)).split('] →')[1];
    assert.equal(derecha.includes(ayer.id.slice(0, 8)), false);
  });

test('TOK-21 más resolución cerca del presente: las distancias se agrupan en bandas de las siete escalas', () => {
  const distancias = [0, 30, 3599, 86399, 6 * 86400, 27 * 86400, 300 * 86400];
  assert.deepEqual(distancias.map(banda), ['segundo', 'minuto', 'hora', 'dia', 'semana', 'ciclo', 'anio']);
  assert.equal(banda(-30), banda(30)); // pasado y futuro con la misma escala
});

test('TOK-21b lo lejano se comprime y agrupa por bandas, sin truncarse',
  { skip: 'TOK-21: ejeTemporal corta en `maximo` en vez de agrupar lo que no cabe (forma del grupo supuesta: una entrada con cantidad). Terreno de src/tiempo.js (otro agente): no se toca aquí' },
  async () => {
    const { eje, g } = await mundo();
    for (let k = 0; k < 12; k++) await escribe(eje, g, 'r' + k, undefined, 'ana', new Date(Date.parse(T0) - k * 86400000).toISOString());
    const e = ejeTemporal(eje, g, { ahora: AHORA, maximo: 10 });
    const contadas = e.pasado.reduce((n, x) => n + (x.cantidad ?? 1), 0);
    assert.equal(contadas, e.totalPasado);
  });

test('TOK-23 PV7 guarda previsiones: lo declarado en 7 es futuro y no se convierte en hecho', async () => {
  const { eje, g } = await mundo();
  const plan = await escribe(eje, g, ['Plan', 'a', 'b', 'c', 'd', 'e', 'f', 'cenar el sábado'], undefined, 'ana');
  const e = ejeTemporal(eje, plan.id, { ahora: AHORA });
  const declarado = e.futuro.find((x) => x.tipo === 'declarado');
  assert.equal(declarado.contenido, 'cenar el sábado');
  assert.equal(e.pasado.some((x) => x.tipo === 'declarado'), false);
  assert.deepEqual(consolidaciones(eje, plan.id), []);
});

test('TOK-23b lo declarado en 7 no inventa distancia ni banda, y tiene expiración y ejecución condicional',
  { skip: 'TOK-23: lo declarado en 7 sale con delta 0 y banda «segundo» inventados; no hay expiración ni ejecución condicional. Terreno de src/tiempo.js (otro agente): no se toca aquí' },
  async () => {
    const { eje, g } = await mundo();
    const plan = await escribe(eje, g, ['Plan', 'a', 'b', 'c', 'd', 'e', 'f', 'cenar el sábado'], undefined, 'ana');
    const declarado = ejeTemporal(eje, plan.id, { ahora: AHORA }).futuro.find((x) => x.tipo === 'declarado');
    assert.equal(declarado.banda, undefined);
  });

// =====================================================================
// Tokens · E y capacidad
// =====================================================================

test('TOK-24 E es una cantidad por denominación', async () => {
  const { eje } = await mundo();
  assert.equal(eje.saldo('ana', 'E:raiz/EUR'), 50);
  assert.equal(eje.saldo('ana', 'E:raiz/kg'), 0);
});

test('TOK-24b E abarca disponibilidad (bloqueado o libre), derechos y obligaciones',
  { skip: 'TOK-24: E es solo una cantidad por denominación; no hay disponible/bloqueado, derechos ni obligaciones. Terreno de la serie de tokens (src/tokens.js y src/eje.js, otro agente): no se toca aquí' },
  sinForma('TOK-24'));

test('TOK-25 declarar no prueba poseer: un payload no crea saldo y nadie gasta lo que no tiene', async () => {
  const { eje, g } = await mundo();
  await escribe(eje, g, ['Tengo', '1000 EUR'], undefined, 'bea');
  assert.equal(eje.saldo('bea', 'E:raiz/EUR'), 0);
  await assert.rejects(eje.escribir({ autor: 'bea', sobre: g, t: T0, movimientos: [gastaT('bea'), daE('bea', 'ana', 1)], payload: 'pago' }), /saldo insuficiente/);
  for (const id of eje.identidades()) for (const [, v] of eje.saldos.get(id)) assert.ok(v >= 0, id);
});

test('TOK-25b ni un génesis manipulado deja a nadie en negativo', async () => {
  const g = await crearEvento({ autor: 'raiz', sobre: null, t: T0, movimientos: [{ token: 'T', escala: 'minuto', cantidad: 60, de: null, a: 'raiz' }, daE('mallory', 'raiz', 50)], payload: 'x', contexto: { genesis: true } });
  await assert.rejects(Eje.desde([g]));
});

test('TOK-26 E se cuenta por denominación: recursos distintos no se suman', async () => {
  const eje = await Eje.genesis({ identidad: 'raiz', emision: [...EMISION, { token: 'E', denominacion: 'EUR', cantidad: 10 }, { token: 'E', denominacion: 'BTC', cantidad: 10 }], foco: 'x', t: T0 });
  await assert.rejects(eje.escribir({ autor: 'raiz', sobre: eje.genesisId, t: T0, movimientos: [gastaT('raiz'), { token: 'E', emisor: 'raiz', denominacion: 'EUR', cantidad: 15, de: 'raiz', a: null }], payload: 'x' }), /saldo insuficiente/);
  assert.deepEqual([eje.saldo('raiz', 'E:raiz/EUR'), eje.saldo('raiz', 'E:raiz/BTC')], [10, 10]);
});

test('TOK-26b no hay E sin denominación', async () => {
  await assert.rejects(Eje.genesis({ identidad: 'raiz', emision: [...EMISION, { token: 'E', cantidad: 5 }], foco: 'x', t: T0 }));
});

test('TOK-27 cada denominación de E está ligada a su emisor: las plazas de dos casas son series distintas', async () => {
  const eje = await Eje.genesis({ identidad: 'raiz', emision: EMISION, foco: 'x', t: T0 });
  const g = eje.genesisId;
  // VG, 7-11 noche: las casas que emiten son personas (antes, grupos), con P delegado y su R en juego.
  await eje.escribir({ autor: 'raiz', sobre: g, t: T0, movimientos: [gastaT('raiz'), daT('raiz', 'casaA', 60), daT('raiz', 'casaB', 60), daP('raiz', 'casaA'), daP('raiz', 'casaB')], payload: 'altas', contexto: { tipos: { casaA: 'persona', casaB: 'persona' } } });
  for (const [casa, n] of [['casaA', 2], ['casaB', 3]]) {
    await eje.escribir({ autor: casa, sobre: g, t: T0, movimientos: [gastaT(casa), ...rEnJuego(casa), { token: 'E', denominacion: 'plaza', emisor: casa, cantidad: n, de: null, a: casa }], payload: 'plazas de ' + casa });
  }
  assert.deepEqual([eje.saldo('casaA', 'E:casaA/plaza'), eje.saldo('casaB', 'E:casaB/plaza')], [2, 3]);
  assert.equal(eje.saldo('casaA', 'E:casaB/plaza'), 0); // la misma palabra, dos series
});

test('TOK-28 cada emisor emite sus propias series (la E que respalda y su R) y solo él amplía su serie', async () => {
  const eje = await Eje.genesis({ identidad: 'raiz', emision: EMISION, foco: 'x', t: T0 });
  const g = eje.genesisId;
  // VG, 7-11 noche: la casa que emite es una persona (antes, un grupo), con P delegado y su R en juego.
  await eje.escribir({ autor: 'raiz', sobre: g, t: T0, movimientos: [gastaT('raiz'), daT('raiz', 'casa', 60), daT('raiz', 'otro', 60), daP('raiz', 'casa')], payload: 'altas', contexto: { tipos: { casa: 'persona', otro: 'persona' } } });
  await eje.escribir({ autor: 'casa', sobre: g, t: T0, movimientos: [gastaT('casa'), ...rEnJuego('casa'), { token: 'E', denominacion: 'plaza', emisor: 'casa', cantidad: 2, de: null, a: 'casa' }], payload: 'plazas' });
  await eje.escribir({ autor: 'casa', sobre: g, t: T0, movimientos: [gastaT('casa'), { token: 'R', emisor: 'casa', cantidad: 5, de: null, a: 'casa' }], payload: 'reputación de la casa' });
  assert.deepEqual([eje.saldo('casa', 'E:casa/plaza'), eje.saldo('casa', 'R:casa')], [2, 5]);
  // Solo la casa amplía su serie: otro no puede emitir a nombre de la casa.
  await assert.rejects(eje.escribir({ autor: 'otro', sobre: g, t: T0, movimientos: [gastaT('otro'), { token: 'E', denominacion: 'plaza', emisor: 'casa', cantidad: 1, de: null, a: 'casa' }], payload: 'amplío la serie ajena' }), /nadie emite en nombre de otro|la emisión de E va a su propio emisor/);
  assert.equal(eje.serie('E:casa/plaza').emitido, 2);
});

test('TOK-29 nadie emite una serie ajena: la R se emite a su propio emisor', async () => {
  await assert.rejects(Eje.genesis({ identidad: 'raiz', emision: [...EMISION, { token: 'R', cantidad: 5, emisor: 'otra' }], foco: 'x', t: T0 }), /la emisión de R va a su propio emisor/);
  const { eje, g } = await mundo();
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: g, t: T0, movimientos: [gastaT('ana'), { token: 'R', cantidad: 1, emisor: 'raiz', de: null, a: 'raiz' }], payload: 'x' }));
});

test('TOK-29b nadie emite una denominación de E ajena: ni el génesis amplía la serie de otro', async () => {
  const eje = await Eje.genesis({ identidad: 'raiz', emision: EMISION, foco: 'x', t: T0, tipo: 'persona' });
  const g = eje.genesisId;
  // VG, 7-11 noche: la casa que emite es una persona (antes, un grupo), con P delegado y su R en juego.
  await eje.escribir({ autor: 'raiz', sobre: g, t: T0, movimientos: [gastaT('raiz'), daT('raiz', 'casa', 60), daP('raiz', 'casa')], payload: 'alta', contexto: { tipos: { casa: 'persona' } } });
  await eje.escribir({ autor: 'casa', sobre: g, t: T0, movimientos: [gastaT('casa'), ...rEnJuego('casa'), { token: 'E', denominacion: 'plaza', emisor: 'casa', cantidad: 1, de: null, a: 'casa' }], payload: 'plaza' });
  await assert.rejects(eje.escribir({ autor: 'raiz', sobre: g, t: T0, movimientos: [gastaT('raiz'), ...rEnJuego('raiz', 'casa'), { token: 'E', denominacion: 'plaza', emisor: 'casa', cantidad: 1, de: null, a: 'casa' }], payload: 'plaza ajena' }), /nadie emite en nombre de otro/);
  // Lo que la raíz llame «plaza» es su propia serie (E:raiz/plaza): la de la casa no cambia.
  await eje.escribir({ autor: 'raiz', sobre: g, t: T0, movimientos: [gastaT('raiz'), ...rEnJuego('raiz', 'casa'), { token: 'E', denominacion: 'plaza', emisor: 'raiz', cantidad: 1, de: null, a: 'raiz' }], payload: 'plaza de la raíz' });
  assert.deepEqual([eje.serie('E:casa/plaza').emitido, eje.serie('E:raiz/plaza').emitido], [1, 1]);
});

test('TOK-30 la capacidad es una serie limitada de quien respalda el recurso; ejecutar la reserva la mueve de la casa al huésped',
  { skip: 'TOK-30: la casa ya emite su serie de plazas, pero ejecutar() del huésped con un movimiento casa→huésped se rechaza («nadie mueve tokens ajenos»). [X] decidir VG cómo encaja con TOK-35. Terreno de la capacidad al ejecutar (ejecutar en src/motor.js, otro agente): no se toca aquí' },
  async () => {
    const { eje, c } = await reservaDelHuesped();
    assert.equal(eje.saldo('casa', 'E:casa/plaza'), 0);
    assert.equal(estadoDe(eje, c.id), 'EJECUTADO');
  });

test('TOK-31 la plaza es una posición donde las reservas colisionan; la segunda solapada se escribe pero no se ejecuta por saldo', async () => {
  // Con la casa como génesis y autora de las reservas; el huésped que reserva es TOK-30 (skip).
  const { eje, hab } = await casaConUnaPlaza();
  const { c: r1, pedido: p1 } = await reservaDeLaCasa(eje, hab, 'h1');
  const { c: r2, pedido: p2 } = await reservaDeLaCasa(eje, hab, 'h2');
  const enLaPlaza = ocupantes(eje, hab, [1, 4]).map((o) => o.evento);
  assert.ok(enLaPlaza.includes(p1.id) && enLaPlaza.includes(p2.id)); // se ven todas
  await ejecutar(eje, { autor: 'casa', consolidacion: r1.id, t: T0, movimientos: [daE('casa', 'h1', 1, 'plaza-7-11', 'casa')] });
  await assert.rejects(ejecutar(eje, { autor: 'casa', consolidacion: r2.id, t: T0, movimientos: [daE('casa', 'h2', 1, 'plaza-7-11', 'casa')] }), /saldo insuficiente/);
  assert.ok(eje.obtener(r2.id)); // escrita sigue
  assert.equal(estadoDe(eje, r2.id), 'AUTORIZADO');
});

// =====================================================================
// Tokens · P y R
// =====================================================================

test('TOK-32 P es poder con ámbito: no existe un P total', async () => {
  const { eje, g } = await mundo();
  assert.ok(validarMovimiento({ token: 'P', cantidad: 1, de: 'raiz', a: 'ana' }).some((e) => /P exige ámbito/.test(e)));
  await assert.rejects(eje.escribir({ autor: 'raiz', sobre: g, t: T0, movimientos: [gastaT('raiz'), { token: 'P', cantidad: 1, de: 'raiz', a: 'ana' }], payload: 'x' }), /ámbito/);
  const sub = await escribe(eje, g, 'subárbol');
  await eje.escribir({ autor: 'raiz', sobre: g, t: T0, movimientos: [gastaT('raiz'), { token: 'P', cantidad: 2, ambito: sub.id, de: 'raiz', a: 'ana' }], payload: 'delegación' });
  assert.deepEqual(eje.poderes('ana'), [{ ambito: sub.id, cantidad: 2 }]);
  assert.equal(eje.poderSobre('ana', g), 0);
});

test('TOK-34 P no es un permiso automático: tener P no basta por sí solo para autorizar',
  { skip: 'TOK-34: motor.puedeAutorizar deja autorizar a quien tiene P > 0 sobre el registro y no es el autor: es la regla V0 provisional (MOT-42, hueco de AARPIA)' },
  async () => {
    const { eje, g } = await mundo();
    const c = await consolidar(eje, { autor: 'ana', foco: g, t: T0, elecciones: { 1: 'x' } });
    assert.equal(puedeAutorizar(eje, 'raiz', c.id), false);
  });

test('TOK-35 nadie mueve tokens ajenos: todo movimiento con origen sale del autor', async () => {
  const { eje, g } = await mundo();
  await assert.rejects(eje.escribir({ autor: 'bea', sobre: g, t: T0, movimientos: [gastaT('bea'), daE('ana', 'bea', 1)], payload: 'x' }), /nadie mueve tokens ajenos/);
  const { c } = await autorizada(eje, g);
  await assert.rejects(ejecutar(eje, { autor: 'ana', consolidacion: c.id, t: T0, movimientos: [daE('raiz', 'ana', 1)] }), /nadie mueve tokens ajenos/);
});

test('TOK-37 PV8 no emite P por subir de posición ni por reunir registros', async () => {
  const { eje, g } = await mundo();
  const a = await escribe(eje, g, ['A', 'mucho', 'contenido'], undefined, 'ana');
  for (let k = 0; k < 3; k++) await escribe(eje, a.id, 'apoyo ' + k, undefined, 'bea');
  const antes = huella(eje);
  // VG, 7-11 noche: se retira comparar(); leer el 8 (aquí, el respaldo al vuelo: no hay base escrita) no escribe ni emite.
  assert.equal(situar(eje, a.id, { respaldo: true }).medidas.escritos.foco, 3);
  assert.equal(huella(eje), antes);
  assert.deepEqual(eje.poderes('ana'), []);
});

test('TOK-38 R se cuenta por emisor y no es fungible ni popularidad', async () => {
  const { eje, g } = await mundo();
  await eje.escribir({ autor: 'raiz', sobre: g, t: T0, movimientos: [gastaT('raiz'), { token: 'R', cantidad: 3, emisor: 'raiz', de: 'raiz', a: 'ana' }], payload: 'buen trato' });
  assert.deepEqual(eje.reputaciones('ana'), [{ emisor: 'raiz', cantidad: 3 }]);
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: g, t: T0, movimientos: [gastaT('ana'), { token: 'R', cantidad: 1, emisor: 'raiz', de: 'ana', a: 'bea' }], payload: 'x' }), /no es fungible/);
  for (let k = 0; k < 3; k++) await escribe(eje, g, 'me gusta ana ' + k, undefined, 'bea'); // la popularidad no es R
  assert.deepEqual(eje.reputaciones('ana'), [{ emisor: 'raiz', cantidad: 3 }]);
});

test('TOK-41 PV3 no es R: comunicar no emite reputación', async () => {
  const { eje, g } = await mundo();
  const antes = eje.reputaciones('ana');
  const msg = await escribirDesde(eje, { modo: 'pointed', autor: 'ana', sobre: g, en: '3000000000', payload: 'hola a todos', t: T0 });
  assert.deepEqual(msg.movimientos.map((m) => m.token), ['T']);
  assert.deepEqual(eje.reputaciones('ana'), antes);
});

test('TOK-42 la R viaja en un evento con su contexto: se sabe quién la dio, cuándo y por qué', async () => {
  const { eje, g } = await mundo();
  const ev = await eje.escribir({ autor: 'raiz', sobre: g, t: T0, movimientos: [gastaT('raiz'), { token: 'R', cantidad: 2, emisor: 'raiz', de: 'raiz', a: 'ana' }], payload: ['Reconocimiento', 'entregó a tiempo'] });
  const conR = [...eje.eventos.values()].filter((e) => e.movimientos.some((m) => m.token === 'R' && m.a === 'ana'));
  assert.deepEqual(conR.map((e) => [e.autor, e.payload[1]]), [['raiz', 'entregó a tiempo']]);
  assert.equal(conR[0].id, ev.id);
});

test('TOK-42b la R enlaza con historial, compromisos, juicios y evidencias',
  { skip: 'TOK-42: R es una cantidad por emisor; su único contexto es el payload del evento que la mueve, sin enlace a evidencias' },
  sinForma('TOK-42'));

test('TOK-43 los tokens recorren los diez PV: cualquier evento, en cualquier posición, puede mover cualquier familia', async () => {
  const { eje, g } = await mundo(['Foco', 'a', 'b', 'c', 'd', 'e', 'f', 'g']);
  await eje.escribir({ autor: 'raiz', sobre: g, en: '3000000000', t: T0, movimientos: [gastaT('raiz'), daE('raiz', 'ana', 1)], payload: 'E en el 3' });
  await eje.escribir({ autor: 'raiz', sobre: g, en: '1000000000', t: T0, movimientos: [gastaT('raiz'), { token: 'P', cantidad: 1, ambito: 'genesis', de: 'raiz', a: 'ana' }], payload: 'P en el 1' });
  await eje.escribir({ autor: 'raiz', sobre: g, en: '7000000000', t: T0, movimientos: [gastaT('raiz'), { token: 'R', cantidad: 1, emisor: 'raiz', de: 'raiz', a: 'ana' }], payload: 'R en el 7' });
  await eje.escribir({ autor: 'raiz', sobre: g, en: '2000000000', t: T0, movimientos: [gastaT('raiz'), daT('raiz', 'ana', 5)], payload: 'T en el 2' });
  assert.equal(eje.saldo('ana', 'E:raiz/EUR'), 51);
  assert.equal(eje.poderSobre('ana', g), 1);
  assert.deepEqual(eje.reputaciones('ana'), [{ emisor: 'raiz', cantidad: 1 }]);
});

test('TOK-47 se ven los tokens: P por ámbito y R por emisor, separados de los recursos', async () => {
  const { eje, g } = await mundo();
  await eje.escribir({ autor: 'raiz', sobre: g, t: T0, movimientos: [gastaT('raiz'), { token: 'P', cantidad: 1, ambito: 'genesis', de: 'raiz', a: 'ana' }, { token: 'R', cantidad: 1, emisor: 'raiz', de: 'raiz', a: 'ana' }], payload: 'x' });
  assert.deepEqual(eje.poderes('ana'), [{ ambito: 'genesis', cantidad: 1 }]);
  assert.deepEqual(eje.reputaciones('ana'), [{ emisor: 'raiz', cantidad: 1 }]);
  assert.equal(eje.saldo('ana', 'E:raiz/EUR'), 50);
});

test('TOK-47b se ven todas las denominaciones de E y todas las escalas de T', async () => {
  const { eje } = await mundo();
  assert.deepEqual(eje.tiempos('ana'), [{ escala: 'minuto', cantidad: 300 }]);
  assert.deepEqual(eje.recursos('ana'), [{ emisor: 'raiz', denominacion: 'EUR', cantidad: 50 }]); // cada serie de E con su emisor
});

test('TOK-48 los cuatro tokens tienen mecanismos efectivos: T paga la escritura, P autoriza, R no es fungible, E se mueve al ejecutar', async () => {
  const { eje, g } = await mundo();
  await eje.escribir({ autor: 'raiz', sobre: g, t: T0, movimientos: [gastaT('raiz'), daT('raiz', 'pobre', 1)], payload: 'alta con un minuto' });
  await escribe(eje, g, 'una', undefined, 'pobre');
  await assert.rejects(escribe(eje, g, 'otra', undefined, 'pobre'), /saldo insuficiente/); // T
  const c = await consolidar(eje, { autor: 'ana', foco: g, t: T0, elecciones: { 1: 'x' } });
  await assert.rejects(autorizar(eje, { autorizante: 'bea', consolidacion: c.id, t: T0 }), /no tiene poder/); // P
  await autorizar(eje, { autorizante: 'raiz', consolidacion: c.id, t: T0 });
  await ejecutar(eje, { autor: 'ana', consolidacion: c.id, t: T0, movimientos: [daE('ana', 'bea', 10)] });
  assert.equal(eje.saldo('bea', 'E:raiz/EUR'), 10); // E
});

test('TOK-48b los cuatro tokens tienen presencia visible, no solo cifras',
  { skip: 'TOK-48: desde la #50 los movimientos de un evento nuevo se ven en el mundo de los hilos (mundos/hilos.js: un punto por movimiento de «de» a «a», con un color por familia, tentativo), pero solo al animarse; en reposo los saldos siguen siendo cifras por identidad (ui/saldos.js) y los demás mundos no existen todavía' },
  sinForma('TOK-48'));

test('TOK-49 P, R y T no se reducen a dinero ni a puntuación', async () => {
  const { eje, g } = await mundo();
  const antes = eje.saldo('ana', 'E:raiz/EUR');
  await eje.escribir({ autor: 'raiz', sobre: g, t: T0, movimientos: [gastaT('raiz'), daT('raiz', 'ana', 10), { token: 'P', cantidad: 1, ambito: 'genesis', de: 'raiz', a: 'ana' }, { token: 'R', cantidad: 1, emisor: 'raiz', de: 'raiz', a: 'ana' }], payload: 'x' });
  assert.equal(eje.saldo('ana', 'E:raiz/EUR'), antes); // nada se convierte en E
  assert.ok([...eje.saldos.get('ana').keys()].every((k) => /^(T|E:|P:|R:)/.test(k))); // ni hay una cifra total
  assert.equal(typeof eje.total, 'undefined');
});

test('TOK-50 más transferencias no son más riqueza: mover tokens no es progreso automático', async () => {
  const { eje, g } = await mundo();
  const padre = await escribe(eje, g, 'padre');
  const a = await escribe(eje, padre.id, 'igual', undefined, 'ana');
  await eje.escribir({ autor: 'raiz', sobre: padre.id, t: T0, movimientos: [gastaT('raiz'), daT('raiz', 'ana', 1), daT('raiz', 'bea', 1), daE('raiz', 'ana', 1)], payload: 'igual' });
  // VG, 7-11 noche: se retira comparar() y su puntuación con pesos. Sin puesto: la hermana que mueve más
  // tokens solo cae en otra caja de «movimientos»; en lo demás, las dos comparten caja.
  const c = confluir(eje, a.id);
  assert.ok(!('posicion' in c) && !('puntuacion' in c) && c.comparables.every((x) => !('puntuacion' in x)));
  assert.deepEqual([c.medidas.movimientos.foco, c.medidas.movimientos.debajo, c.medidas.movimientos.encima], [1, 0, 1]);
  assert.equal(c.medidas.terminales.enCaja, 2);
});

test('TOK-54 ninguna organización es imprescindible para participar: los tokens pasan de unas identidades a otras', async () => {
  const { eje, g } = await mundo();
  await eje.escribir({ autor: 'ana', sobre: g, t: T0, movimientos: [gastaT('ana'), daT('ana', 'cris', 5), daE('ana', 'cris', 5)], payload: 'ana da de alta a cris' });
  const ev = await escribe(eje, g, 'cris participa', undefined, 'cris');
  assert.equal(ev.autor, 'cris');
  assert.equal(eje.saldo('cris', 'E:raiz/EUR'), 5);
});

test('TOK-54b una identidad que no es el génesis puede emitir sus propias series', async () => {
  const { eje, g } = await mundo();
  // VG, 7-11 noche: E es el último escalón. Ana pone en juego un R suyo (ante bea) y escribe sobre un registro suyo, sobre el que emite P.
  const suyo = await escribe(eje, g, 'mis clases', undefined, 'ana');
  await eje.escribir({ autor: 'ana', sobre: suyo.id, t: T0, payload: 'mi reputación y mis horas de clase', movimientos: [gastaT('ana'),
    { token: 'R', cantidad: 6, emisor: 'ana', de: null, a: 'ana' }, { token: 'R', cantidad: 1, emisor: 'ana', de: 'ana', a: 'bea' },
    { token: 'P', ambito: suyo.id, cantidad: 1, de: null, a: 'ana' },
    { token: 'E', denominacion: 'horas de clase', emisor: 'ana', cantidad: 3, de: null, a: 'ana' }] });
  assert.deepEqual(eje.reputaciones('ana'), [{ emisor: 'ana', cantidad: 5 }]);
  assert.equal(eje.saldo('ana', 'E:ana/horas de clase'), 3);
});

test('TOK-54c ninguna organización permanente es imprescindible: T y P no dependen solo de la primera identidad', async () => {
  // VG, 7-11 noche: cada persona emite su T (con el tope del reloj) y su P sobre registros suyos; antes solo el génesis.
  const { eje, g } = await mundo();
  const unaHoraDespues = '2026-11-07T11:00:00Z';
  await eje.escribir({ autor: 'ana', sobre: g, t: unaHoraDespues, payload: 'mi tiempo', movimientos: [gastaT('ana'), { token: 'T', escala: 'minuto', cantidad: 60, de: null, a: 'ana' }] });
  assert.equal(eje.emitidoT('ana', 'minuto'), 60);
  const suyo = await escribe(eje, g, 'mi taller', undefined, 'ana', unaHoraDespues);
  await eje.escribir({ autor: 'ana', sobre: suyo.id, t: unaHoraDespues, payload: 'mi poder', movimientos: [gastaT('ana'), ...rEnJuego('ana', 'bea'), { token: 'P', ambito: suyo.id, cantidad: 2, de: null, a: 'ana' }] });
  assert.equal(eje.poderSobre('ana', suyo.id), 2);
  assert.equal(eje.serie('P:' + suyo.id).emisor, 'ana');
});

test('TOK-55 las alternativas descentralizadas se ofrecen por defecto («multinacional de autónomos»)',
  { skip: 'TOK-55: no hay ningún mecanismo para ello' },
  sinForma('TOK-55'));

test('TOK-56 el génesis es la emisión inicial a la primera identidad, con un foco raíz y T incluido', async () => {
  const { eje, g } = await mundo();
  const gen = eje.obtener(g);
  assert.ok(gen.movimientos.every((m) => m.de === null && m.a === 'raiz'));
  assert.ok(gen.movimientos.some((m) => m.token === 'T'));
  assert.equal(gen.sobre, null);
});

test('TOK-56b un génesis reconstruido solo vale si todo son emisiones a su autor', async () => {
  const emitir = (a) => ({ token: 'T', escala: 'minuto', cantidad: 60, de: null, a });
  const conMallory = await crearEvento({ autor: 'raiz', sobre: null, t: T0, movimientos: [emitir('raiz'), daE('mallory', 'raiz', 50)], payload: 'x', contexto: { genesis: true } });
  const aOtra = await crearEvento({ autor: 'raiz', sobre: null, t: T0, movimientos: [emitir('raiz'), emitir('otra')], payload: 'x', contexto: { genesis: true } });
  await assert.rejects(Eje.desde([conMallory]));
  await assert.rejects(Eje.desde([aOtra]));
});

test('TOK-57 una identidad existe cuando recibe tokens; quien la da de alta la declara, con su clave en el mismo evento', async () => {
  const { eje, g } = await mundo();
  await assert.rejects(escribe(eje, g, 'x', undefined, 'dani'), /autor desconocido/);
  assert.equal(eje.identidades().includes('dani'), false);
  const dani = await generarClaves();
  await eje.escribir({ autor: 'raiz', sobre: g, t: T0, movimientos: [gastaT('raiz'), daT('raiz', 'dani', 10)], payload: 'alta de dani', contexto: { claves: { dani: dani.publica } } });
  assert.ok(eje.identidades().includes('dani'));
  assert.deepEqual(eje.clave('dani'), dani.publica);
});

test('TOK-58 el token-identidad no es token-valor: las claves van aparte de los saldos', async () => {
  const { eje, g } = await mundo();
  const dani = await generarClaves();
  await eje.escribir({ autor: 'raiz', sobre: g, t: T0, movimientos: [gastaT('raiz'), daT('raiz', 'dani', 10)], payload: 'alta', contexto: { claves: { dani: dani.publica } } });
  assert.ok(eje.claves.has('dani'));
  assert.ok([...eje.saldos.get('dani').keys()].every((k) => !/clave/i.test(k)));
  assert.equal(eje.claves.has('ana'), false); // tener saldo no da identidad criptográfica
  assert.ok(eje.saldos.has('ana'));
});

test('TOK-59 cada posición escrita cuesta al autor un minuto de T', async () => {
  const { eje, g } = await mundo();
  for (const [modo, payload] of [['pointed', 'uno'], ['sequenced', ['a', 'b', 'c']], ['mapped', ['a', ['b', 'c'], 'd']]]) {
    const ev = await escribirDesde(eje, { modo, autor: 'ana', sobre: g, payload, t: T0 });
    assert.equal(minutosDe(ev), contarPosiciones(payload), modo);
  }
});

test('TOK-59b también ejecutar paga un minuto por posición', async () => {
  const { eje, g } = await mundo();
  const { c } = await autorizada(eje, g);
  const e = await ejecutar(eje, { autor: 'ana', consolidacion: c.id, t: T0, titulo: ['Ejecutado', 'con detalle'] });
  assert.equal(minutosDe(e), contarPosiciones(e.payload));
  assert.equal(minutosDe(e), 4);
});

// =====================================================================
// Épocas
// =====================================================================

test('TOK-60 la época es una convención paralela, fuera del dato: se elige al leer', async () => {
  const { eje, g } = await mundo();
  const ev = eje.obtener(g);
  assert.equal('epoca' in ev, false);
  const otra = { nombre: 'otra', reglaCorta: (p, d) => 'otra ' + d };
  assert.equal(decupla(ev, otra).posiciones[4].significado, 'otra 4');
  assert.equal(mapa(eje, g, { epoca: otra }).celdas[4].significado, 'otra 4');
  assert.equal(leerDireccion(FABRICA, otra)[0].significado, 'otra 4');
});

test('TOK-60b el motor también lee bajo la época elegida: descubrir la pasa al encaje', async () => {
  const { eje, g } = await mundo();
  const { consultadas, epoca } = epocaEspia();
  descubrir(eje, g, { posiciones: [1], epoca });
  assert.ok(consultadas.length > 0);
  // Leer bajo la época 0 es lo mismo que leer sin elegir: es la época por defecto.
  const lista = (opciones) => descubrir(eje, g, { posiciones: [1, 2], ...opciones }).map((p) => p.candidatos.map((c) => [c.evento, c.origen, c.texto]));
  assert.deepEqual(lista({ epoca: EPOCA_0 }), lista({}));
});

test('TOK-60c BQL y el tiempo también leen bajo la época elegida',
  { skip: 'TOK-60: evaluar/consultar (BQL) y ejeTemporal (tiempo) no aceptan época. Terreno de src/bql.js y src/tiempo.js (otros agentes): no se toca aquí' },
  sinForma('TOK-60'));

test('TOK-61 la época actual es la confluencia de las pasadas y fija cómo se calculará la siguiente',
  { skip: 'TOK-61: no implementado. Terreno de src/epocas.js (otro agente): no se toca aquí' },
  sinForma('TOK-61'));

test('TOK-62 una época es un árbol ordinario adoptado como tronco compartido',
  { skip: 'TOK-62: las épocas son datos JSON (datos/epocas/*.json, desde la PR #33, integrada) que cargarEpoca convierte en un objeto; ninguna es un árbol de eventos del eje ni se adopta como tronco compartido. Terreno de src/epocas.js (otro agente): no se toca aquí' },
  sinForma('TOK-62'));

test('TOK-63 en la época 0 la profundidad 0 son los diez PV y en toda profundidad n ≥ 1 el dígito es el PV aplicado al nodo de arriba', () => {
  for (let d = 0; d < 10; d++) assert.equal(EPOCA_0.reglaCorta(0, d), PV[d]);
  for (let p = 1; p < 10; p++) for (let d = 0; d < 10; d++) assert.match(EPOCA_0.regla(p, d).significado, /^Aplicado al nodo de arriba/);
});

test('TOK-64 la regla corta es exhaustiva: cubre los diez dígitos en las diez profundidades', () => {
  let cubiertas = 0;
  for (let p = 0; p < 10; p++) for (let d = 0; d < 10; d++) if (typeof EPOCA_0.reglaCorta(p, d) === 'string' && EPOCA_0.reglaCorta(p, d)) cubiertas++;
  assert.equal(cubiertas, 100);
});

test('TOK-64b las cien reglas cortas propias de cada profundidad', () => {
  const claves = new Set(EPOCA_0.reglas.map((r) => r.profundidad + '.' + r.digito));
  assert.equal(claves.size, 100);
  for (let p = 1; p < 10; p++) {
    // Cada profundidad trae sus propios significados y ejemplos: ninguno se repite en otra.
    const ejemplos = EPOCA_0.reglas.filter((r) => r.profundidad === p).map((r) => r.ejemplo);
    assert.equal(new Set(ejemplos).size, 10, 'profundidad ' + p);
    for (let q = p + 1; q < 10; q++) {
      const otros = new Set(EPOCA_0.reglas.filter((r) => r.profundidad === q).map((r) => r.ejemplo));
      assert.ok(ejemplos.every((x) => !otros.has(x)), 'ejemplos repetidos entre las profundidades ' + p + ' y ' + q);
    }
  }
});

test('TOK-65 las reglas largas refinan rutas y prefijos completos, parciales y dispersas',
  () => {
    const conLarga = { nombre: 'con larga', reglaCorta: (p, d) => PV[d], reglaLarga: (prefijo) => (prefijo === '84' ? 'compras' : undefined) };
    assert.equal(leerDireccion('8412000000', conLarga)[1].significado, 'compras');
  });

test('TOK-66 la época 0 da las reglas por defecto de toda lectura', async () => {
  const { eje, g } = await mundo();
  assert.deepEqual(leerDireccion('1300000000'), leerDireccion('1300000000', EPOCA_0));
  assert.deepEqual(decupla(eje.obtener(g)).posiciones.map((p) => p.significado), PV);
  assert.deepEqual(mapa(eje, g).celdas.map((c) => c.significado), PV);
});

test('TOK-66b diez épocas, con la 0 como respaldo, y bifurcaciones que convergen por referencias sin borrar ramas',
  { skip: 'TOK-66: el respaldo existe (cargarEpoca(datos, { respaldo }), probado en test/epocas.test.js, también para reglas largas), pero hoy solo hay la época 0, y no hay bifurcaciones ni convergencia por referencias: las épocas son datos JSON, no árboles del eje (ver TOK-62)' },
  sinForma('TOK-66'));

test('TOK-68 una implementación referenciada por hash no da permiso para ejecutar código', async () => {
  const { eje, g } = await mundo();
  const hash = 'a'.repeat(64);
  const x = await escribe(eje, g, ['Regla', '=IMPL("' + hash + '")', '=REF("' + hash + '")', 'sha256:' + hash]);
  const antes = huella(eje);
  assert.equal(evaluar(eje, x.id, [1]).estado, 'ERROR');
  assert.match(evaluar(eje, x.id, [1]).motivo, /función desconocida/);
  assert.notEqual(evaluar(eje, x.id, [2]).estado, 'RESUELTO');
  assert.equal(evaluar(eje, x.id, [3]).valor.tipo, 'texto');
  assert.equal(huella(eje), antes);
});

test('TOK-69 la época cambia cómo se ordenan los ocupantes', () => {
  const lista = [{ n: 'desde 9', vector: vector('9000000000', '2000000000') }, { n: 'desde 3', vector: vector('3000000000', '2000000000') }];
  assert.deepEqual(ordenarPorEncaje(lista, { epoca: EPOCA_0 }).map((x) => x.n), ['desde 9', 'desde 3']);
  assert.deepEqual(ordenarPorEncaje(lista, { epoca: { ordinal: (k) => k === 0 } }).map((x) => x.n), ['desde 3', 'desde 9']);
});

test('TOK-69b la época llega al árbol entero: arbol() reconstruye bajo la época elegida', async () => {
  const { eje, g } = await mundo();
  const { consultadas, epoca } = epocaEspia();
  arbol(eje, g, { epoca });
  assert.ok(consultadas.length > 0);
});

test('TOK-69c la época cambia qué ocupantes aparecen y los vectores',
  { skip: 'TOK-69: nada filtra ocupantes por época y vector() usa los dígitos sin más: ninguna regla de época dice todavía cómo cambian (las cien reglas cortas, en V5). Terreno de src/epocas.js (otro agente). [X] decidir VG la forma' },
  sinForma('TOK-69'));

test('TOK-70 elegir una época no prueba legitimidad, verdad ni autoridad de ejecución', async () => {
  const { eje, g } = await mundo();
  const c = await consolidar(eje, { autor: 'ana', foco: g, t: T0, elecciones: { 1: 'x' } });
  const antes = [huella(eje), estadoDe(eje, c.id), puedeAutorizar(eje, 'bea', c.id)];
  const generosa = { nombre: 'generosa', ordinal: () => true, reglaCorta: () => 'todo autorizado' };
  leerDireccion(c.en, generosa);
  decupla(c, generosa);
  ocupantes(eje, g, [4], { epoca: generosa });
  assert.deepEqual([huella(eje), estadoDe(eje, c.id), puedeAutorizar(eje, 'bea', c.id)], antes);
});

test('TOK-71 el cambio de época compone aportaciones de varias ramas en vez de elegir una ganadora',
  { skip: 'TOK-71: no implementado. Terreno de src/epocas.js (otro agente): no se toca aquí' },
  sinForma('TOK-71'));

// =====================================================================
// Fronteras
// =====================================================================

test('TOK-72 AGRAM no firma por nadie: la firma la pone el autor con su clave', async () => {
  const { eje, g } = await mundo();
  const { c, a } = await autorizada(eje, g);
  const e = await ejecutar(eje, { autor: 'ana', consolidacion: c.id, t: T0 });
  for (const ev of [c, a, e]) assert.equal(ev.firma, undefined); // sin clave del autor, nada firmado
  const ana = await generarClaves();
  const eje2 = await Eje.genesis({ identidad: 'ana', emision: EMISION, foco: ['F', 'a'], t: T0, clave: ana.publica, privada: ana.privada });
  const c2 = await consolidar(eje2, { autor: 'ana', foco: eje2.genesisId, t: T0, elecciones: { 1: 'x' } }, ana.privada);
  assert.equal(c2.firmante, 'ana');
  assert.equal(await verificar(c2, ana.publica), true);
});

test('TOK-72b AGRAM no genera por sí mismo pagos ni ejecuciones: invoca servicios autorizados',
  { skip: 'TOK-72: motor.ejecutar mueve tokens dentro del eje. Lo decide el mapa §12 (7-11): AARPIA es el motor real de autorización y ejecución, y lo del motor es un hueco provisional; AARPIA queda fuera por decisión de VG (MOT-41, TOK-74)' },
  sinForma('TOK-72'));

test('TOK-73 la regla de autorización del motor es un hueco provisional en un solo punto: puedeAutorizar', async () => {
  const { eje, g } = await mundo();
  const c = await consolidar(eje, { autor: 'ana', foco: g, t: T0, elecciones: { 1: 'x' } });
  for (const quien of ['ana', 'bea', 'raiz']) {
    const puede = puedeAutorizar(eje, quien, c.id);
    if (puede) await autorizar(eje, { autorizante: quien, consolidacion: c.id, t: T0 });
    else await assert.rejects(autorizar(eje, { autorizante: quien, consolidacion: c.id, t: T0 }));
  }
  assert.deepEqual(autorizacionesValidas(eje, c.id).map((x) => x.autor), ['raiz']);
});

test('TOK-73b una frontera con AARPIA, el motor real de autorización y ejecución',
  { skip: 'TOK-73: la regla provisional está en motor.js sin frontera con AARPIA' },
  sinForma('TOK-73'));

test('TOK-74 fuera quedan AARPIA, Nostr y Bitcoin, salvo instancias y transiciones', async () => {
  const { eje, g } = await mundo();
  for (const [f, especificador] of importsDeSrc()) assert.equal(/nostr|bitcoin|stateark|aarpia/i.test(especificador), false, f);
  const ev = eje.obtener(g); // una instancia…
  assert.ok(Array.isArray(ev.movimientos) && ev.movimientos.length > 0); // …con sus transiciones
});

test('TOK-75 firmar no hace verdadero el contenido, y publicar no hace a un evento descubrible por todos', async () => {
  const raiz = await generarClaves();
  const crear = () => Eje.genesis({ identidad: 'raiz', emision: EMISION, foco: 'x', t: T0, clave: raiz.publica, privada: raiz.privada });
  const aqui = await crear();
  const alli = await crear();
  assert.equal(aqui.genesisId, alli.genesisId);
  const falso = await aqui.escribir({ autor: 'raiz', sobre: aqui.genesisId, t: T0, movimientos: [gastaT('raiz')], payload: 'la luna es de queso' }, raiz.privada);
  assert.equal(await verificar(falso, raiz.publica), true); // firmado, y no por eso cierto
  assert.equal(alli.obtener(falso.id), undefined); // publicado aquí, no descubierto allí
});

test('TOK-76 no hay anclaje (raíz Merkle, StateArk, Bitcoin) ni se afirma ninguna integración', async () => {
  for (const nombre of nombresExportados()) assert.equal(/merkle|anclar|anclaje|stateark|bitcoin/i.test(nombre), false, nombre);
  const { eje } = await mundo();
  assert.equal(/merkle|raizMerkle/i.test(JSON.stringify(serializar(eje))), false);
});

test('TOK-77 ningún token sale del eje: todo movimiento va a una identidad del eje o se consume', async () => {
  const { eje, g } = await mundo();
  const { c } = await autorizada(eje, g);
  await ejecutar(eje, { autor: 'ana', consolidacion: c.id, t: T0, movimientos: [daE('ana', 'raiz', 1)] });
  const identidades = new Set(eje.identidades());
  for (const ev of eje.eventos.values()) for (const m of ev.movimientos) assert.ok(m.a === null || identidades.has(m.a), m.a);
});

test('TOK-78 el viejo Core no vuelve: no hay módulo ni ontología Core en el núcleo', () => {
  const ficheros = readdirSync(new URL('../src/', import.meta.url));
  assert.equal(ficheros.some((f) => /core/i.test(f)), false);
  assert.equal(nombresExportados().some((n) => /^core$/i.test(n)), false);
});

test('TOK-79 capas de validez separadas: el eje valida forma, id, firma y saldos por su lado', async () => {
  const raiz = await generarClaves();
  const eje = await Eje.genesis({ identidad: 'raiz', emision: EMISION, foco: 'x', t: T0, clave: raiz.publica, privada: raiz.privada });
  const g = eje.genesisId;
  await assert.rejects(eje.escribir({ autor: 'raiz', sobre: g, en: '4', t: T0, movimientos: [gastaT('raiz')], payload: 'x' }, raiz.privada), /en debe ser/); // forma
  const bueno = await firmar(await crearEvento({ autor: 'raiz', sobre: g, t: T0, movimientos: [gastaT('raiz')], payload: 'x' }), raiz.privada);
  await assert.rejects(eje.anadir({ ...bueno, payload: 'y' }), /id no corresponde/); // id
  await assert.rejects(eje.anadir({ ...bueno, firma: bueno.firma.slice(0, -4) + 'AAAA' }), /firma inválida/); // firma
  await assert.rejects(eje.escribir({ autor: 'raiz', sobre: g, t: T0, movimientos: [gastaT('raiz', 100000)], payload: 'x' }, raiz.privada), /saldo insuficiente/); // saldos
});

test('TOK-79b la acreditación material y un modelo de capas que PV5 inspecciona',
  { skip: 'TOK-79: el modelo de capas ya existe (src/validez.js, desde la #49; MOT-61c), pero no hay acreditación material del mundo ni una vista de PV5 que lo inspeccione en app.js' },
  sinForma('TOK-79'));

// =====================================================================
// Reglas con fuerza «propuesta» o «abierto»: sin prueba hasta que VG decida.
// Se listan con su id para que no se conviertan en regla por accidente.
// =====================================================================
//
// Serie del motor
//   MOT-40 [abierto]   el motor no genera derechos, firmas, pruebas, pagos ni ejecuciones: puede invocar servicios
//                      autorizados. [!] Choca con MOT-39 (el motor es la ejecución real) y MOT-41 (AARPIA ejecuta).
//   MOT-42 [propuesta] regla V0: autoriza quien tiene P > 0 sobre el registro y no es el autor; ejecuta el autor
//                      (hueco provisional hasta AARPIA; hoy implementada en puedeAutorizar y ejecutar).
//   MOT-45 [abierto]   qué ejecuciones necesitan la autorización de otra identidad («cuando corresponda»).
//   MOT-52 [abierto]   si C exige que antes haya habido Q y B (hoy consolidar no lo exige).
//   MOT-53 [propuesta] que el orden cambie el resultado depende del contexto; no es un axioma «siempre diferentes».
//   MOT-60 [abierto]   si la proporción por modo es un tope o una banda con mínimo, y si obliga a autorizar y ejecutar.
//   MOT-66 [propuesta] un registro rechazado no produce efectos económicos; una respuesta provisional no es autorización
//                      (hoy eje.validar simula y, si algo falla, nada cambia).
//
// Serie de tokens
//   TOK-10 [decidido]  quién emite T de cada escala: cada persona, para sí misma, con el tope del reloj desde su alta
//                      (VG, 7-11 noche; src/ciclo.js). El génesis sigue emitiendo T, y eso no cuenta para el tope.
//   TOK-13 [propuesta] la escala que muestra la interfaz y el presupuesto real de trabajo son dos controles distintos.
//   TOK-15 [propuesta] año nativo = 13 ciclos de 28 días + 1 día fuera de ciclos (hoy solo como duración).
//   TOK-17 [abierto]   años bisiestos y sincronización con el calendario civil.
//   TOK-18 [abierto]   uso del día fuera de ciclos y su vínculo con el token anual y la elección de época.
//   TOK-22 [propuesta] cada banda más lejana ocupa unos dos tercios del espacio de la anterior.
//   TOK-33 [abierto]   qué es un ámbito de P: un área (P_Derecho) o el subárbol de un registro (hoy, el subárbol).
//   TOK-36 [abierto]   la delegación de P (hoy hacia un ámbito igual o más estrecho).
//   TOK-39 [propuesta] transferir R sin sustituir a su emisor (hoy la mueve su emisor; quien la tiene solo puede devolvérsela: VG, 7-11 noche).
//   TOK-40 [propuesta] emisión de R en doble entrada, con conservación al liquidar, bloqueo y aceptación (7-11 noche: hay obligaciones del emisor y bloqueo con salida; la aceptación no).
//   TOK-44 [propuesta] en PV2, luz/E, calor/P, agua/R y vida/T como metáfora visual flexible.
//   TOK-45 [propuesta] en PV3 los tokens condicionan paquetes, atención y pagos por comunicación.
//   TOK-46 [propuesta] en PV4 los tokens representan producción desagregada.
//   TOK-51 [abierto]   emisión, transferencia, conservación, precios, derechos, microeconomía y liquidación.
//   TOK-52 [propuesta] kernel V10: Value con siete relaciones y las primitivas ISSUE, TRANSFER, LOCK, RELEASE, CONSUME (7-11 noche: LOCK y RELEASE son el estado bloqueo/liberacion de un movimiento).
//   TOK-53 [propuesta] T cubre presupuestos, reservas, bloqueos, ventanas y respaldo; el T futuro no emitido no es valor bloqueado.
//   TOK-67 [abierto]   legitimidad y selección del tronco; compatibilidad histórica.
