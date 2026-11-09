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
  descubrir, proponer, consolidar, registrar, cerrado, siguiente, recuento, propuestas, FABRICA, ANUNCIO, OPERADORES,
} from '../src/motor.js';
import { entrarPorInvitacion } from '../ejemplos/ikisai/altas.mjs';
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
/**
 * Las altas del mundo, un mes antes de T0 (ya no hace falta: cada persona escribe con su asignación de T del día (VG, 8-11)).
 */
const ALTA = '2026-10-08T10:00:00Z';
// El génesis emite también su tiempo como E (E:<génesis>/minuto): T no cruza de persona (VG, 7-11 noche), y el
// tiempo que se cede a otro es E de la serie del que lo da, denominada en su tiempo. Cada uno escribe con su
// propio T, que se acuña al gastarse.
// Encargo 3b (VG, 8-11, mapa §15 [D]): P no se acuña en el génesis (se obtiene al escribir), y quien emite E necesita
// R propia emitida: la emisión lleva su R.
const EMISION = [{ token: 'R', cantidad: 10 }, { token: 'E', denominacion: 'minuto', cantidad: 1e6 }];
const gastaT = (de, cantidad = 1) => ({ token: 'T', escala: 'minuto', cantidad, de, a: null });
/** Ceder minutos a otra identidad: E de la serie de tiempo de `emisor` (por defecto, la de quien los da). */
const daT = (de, a, cantidad, emisor = de) => ({ token: 'E', emisor, denominacion: 'minuto', cantidad, de, a });
const daE = (de, a, cantidad, denominacion = 'EUR', emisor = 'raiz') => ({ token: 'E', emisor, denominacion, cantidad, de, a });
const ID_INEXISTENTE = 'f'.repeat(64);
/** El precio del equipo (zona 4) en el alta de su dueño: su 3.4.2. */
const EQUIPO_GRATIS = '3420000000';
/**
 * Revisión de seguridad (encargo 3b): todo lo que se ancla sobre el alta de otra identidad paga el precio de su
 * atención. `dueno` deja su equipo (zona 4) sin precio: cero de su R; quien entra en ese grupo escribe gratis sobre su alta.
 */
const equipoSinPrecio = (eje, dueno, t, privada) => eje.escribir({ autor: dueno, sobre: eje.alta(dueno).id, en: EQUIPO_GRATIS, t, movimientos: [gastaT(dueno)], payload: [['their R'], [0]] }, privada);
/** P dado dentro de su ámbito, que es un registro (mapa §15 [D]: «P moves within a known scope»). */
const daP = (de, a, cantidad, ambito) => ({ token: 'P', ambito, cantidad, de, a });
/**
 * Emitir E exige R propia emitida (VG, 8-11, mapa §15 [D]: sin colateral; «minting E needs own R issued»). La persona
 * se emite R suya; la R es transferible, así que puede dar una (por defecto, a la raíz).
 */
const rEnJuego = (persona, a = 'raiz') => [{ token: 'R', emisor: persona, cantidad: 2, de: null, a: persona }, { token: 'R', emisor: persona, cantidad: 1, de: persona, a }];

/**
 * El mundo del motor: la raíz (génesis, con poder sobre todo el eje, euros y
 * reputación propia), ana (escribe y consolida, sin poder) y bea (sin poder);
 * ana y bea son personas (se declara en su alta: así pueden emitir sus series).
 * Los euros son la serie de la raíz (E:raiz/EUR). El foco del génesis tiene
 * contenido en las posiciones 1–4.
 */
async function mundo(foco = ['Compra', 'yogur', 'sin lactosa', 'aviso a cocina', 'pagar']) {
  const eje = await Eje.genesis({
    demostracion: true,
    identidad: 'raiz',
    // da T a sus cosas (Core, 8-11); a las personas, nunca: T no cruza de persona
    emision: [...EMISION, { token: 'E', denominacion: 'EUR', cantidad: 100 }],
    foco,
    t: ALTA,
  });
  const g = eje.genesisId;
  // Las personas entran por invitación de la raíz (encargo 3b, VG, 9-11, mapa §15 [D]).
  // Revisión de seguridad (encargo 3b): todo lo que se ancla sobre el alta de otra identidad (el génesis es el alta de
  // la raíz) paga el precio de su atención. ana y bea entran en el equipo de la raíz (zona 4) y la raíz deja ese
  // grupo sin precio (su 3.4.2: cero de su R), así que escriben sobre el foco del génesis como antes.
  for (const id of ['ana', 'bea']) await entrarPorInvitacion(eje, { por: 'raiz', quien: id, t: ALTA, grupo: 4 });
  await equipoSinPrecio(eje, 'raiz', ALTA);
  await eje.escribir({ autor: 'raiz', sobre: g, t: ALTA, movimientos: [gastaT('raiz'), daT('raiz', 'ana', 300), daT('raiz', 'bea', 120), daE('raiz', 'ana', 50)], payload: 'altas de ana y bea' });
  return { eje, g };
}

/** Escribe un registro sobre otro, opcionalmente anclado en una dirección. */
const escribe = (eje, sobre, payload, en, autor = 'raiz', t = T0) =>
  eje.escribir({ autor, sobre, en, t, movimientos: [gastaT(autor)], payload });

/** El anuncio de un movimiento en el 4.1 de X: [[serie], [cantidad], [qué], [[de], [a]]] (un registro por movimiento). */
const anuncio = (serie, cantidad, que, de, a) => [[serie], [cantidad], [que], [[de], [a]]];

/**
 * Una propuesta de ana sobre el foco con un pago anunciado (por defecto, 5 EUR de ana a la raíz). Sustituye a la
 * consolidación autorizada: se retira el guion consolidar → autorizar → ejecutar y nadie autoriza lo ajeno, porque
 * cada uno solo mueve lo suyo (encargo 3b; VG, 8-11, mapa §15 [D] «Una sola operación: registrar»).
 */
async function anunciada(eje, foco, elecciones = { 1: 'dos yogures' }, cantidad = 5) {
  const c = await consolidar(eje, { autor: 'ana', foco, t: T0, elecciones });
  const a = await registrar(eje, { autor: 'ana', sobre: c.id, en: ANUNCIO, t: T0, movimientos: [gastaT('ana')], payload: anuncio('E:raiz/EUR', cantidad, 'pagar', 'ana', 'raiz') });
  return { c, a };
}

/** Hacer lo que a X le falta de `yo`: la primera transacción que propone siguiente(), con su t (y su anclaje, si se da). */
const cumplir = (eje, X, yo, extra = {}) => registrar(eje, { ...siguiente(eje, X, yo).faltaDeMi[0].transaccion, t: T0, ...extra });

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

/** La casa como génesis: una plaza (un token por plaza y noche), una habitación con una cama y dos huéspedes, que entran por invitación. */
async function casaConUnaPlaza() {
  const eje = await Eje.genesis({
    demostracion: true,
    identidad: 'casa',
    emision: [...EMISION, { token: 'E', denominacion: 'plaza-7-11', cantidad: 1 }],
    foco: ['Habitación 1', 'cama A'],
    t: ALTA,
  });
  const hab = eje.genesisId;
  // Altas un mes antes: los huéspedes son personas, entran por invitación de la casa y escriben con su propio T.
  // Piden en la plaza del génesis (el alta de la casa): entran en su equipo, que la casa deja sin precio (revisión de seguridad, encargo 3b).
  for (const id of ['h1', 'h2']) await entrarPorInvitacion(eje, { por: 'casa', quien: id, t: ALTA, grupo: 4 });
  await equipoSinPrecio(eje, 'casa', ALTA);
  return { eje, hab };
}

/**
 * La reserva de un huésped en la plaza 1 de la habitación: el huésped la pide en la plaza (los pedidos colisionan
 * ahí), la casa consolida sobre el pedido y anuncia que moverá la plaza al huésped. Se retira la autorización con el
 * P de recepción (VG, 8-11, mapa §15 [D] «Una sola operación: registrar»): la plaza es de la casa y solo la casa la mueve.
 */
async function reservaDeLaCasa(eje, hab, huesped) {
  const pedido = await eje.escribir({ autor: huesped, sobre: hab, en: direccion([1, 4]), t: T0, movimientos: [gastaT(huesped)], payload: 'reserva de ' + huesped + ', noche del 7-11' });
  const c = await consolidar(eje, { autor: 'casa', foco: pedido.id, camino: [1], t: T0, elecciones: { 1: 'plaza para ' + huesped + ', noche del 7-11' } });
  await registrar(eje, { autor: 'casa', sobre: c.id, en: ANUNCIO, t: T0, movimientos: [gastaT('casa')], payload: anuncio('E:casa/plaza-7-11', 1, 'dar la plaza', 'casa', huesped) });
  return { c, pedido };
}

/**
 * El huésped reserva y la casa (que no es el génesis) respalda la plaza con su propia serie (E:casa/plaza). El
 * huésped anuncia en su propuesta que la plaza pasa de la casa a él, y la casa, a quien siguiente() le dice lo que le
 * falta, la mueve (VG, 8-11, mapa §15 [D] «Una sola operación: registrar»: nadie autoriza lo ajeno; cada parte escribe su propio movimiento). Devuelve también
 * `antes`: la lectura de cerrado antes de que la casa la mueva.
 */
async function reservaDelHuesped() {
  const eje = await Eje.genesis({ demostracion: true, identidad: 'raiz', emision: EMISION, foco: 'Mundo', t: T0 });
  const g = eje.genesisId;
  for (const id of ['casa', 'huesped']) await entrarPorInvitacion(eje, { por: 'raiz', quien: id, t: T0 });
  // La casa emite su serie limitada: un token por plaza y noche (con R suya emitida, sobre su alta, donde tiene P).
  await eje.escribir({ autor: 'casa', sobre: eje.alta('casa').id, t: T0, movimientos: [gastaT('casa'), ...rEnJuego('casa'), { token: 'E', denominacion: 'plaza', emisor: 'casa', cantidad: 1, de: null, a: 'casa' }], payload: 'capacidad: una plaza la noche del 7-11' });
  // La habitación cuelga del alta de la casa: sobre el génesis (el alta de la raíz) pagaría su atención (revisión de seguridad, encargo 3b).
  const hab = await escribe(eje, eje.alta('casa').id, ['Habitación 1', 'cama A'], undefined, 'casa');
  void g;
  const c = await consolidar(eje, { autor: 'huesped', foco: hab.id, camino: [1], t: T0, elecciones: { 1: 'reserva noche del 7-11' } });
  await registrar(eje, { autor: 'huesped', sobre: c.id, en: ANUNCIO, t: T0, movimientos: [gastaT('huesped')], payload: anuncio('E:casa/plaza', 1, 'dar la plaza', 'casa', 'huesped') });
  const antes = cerrado(eje, c.id).cerrado;
  await cumplir(eje, c.id, 'casa');
  return { eje, c, antes };
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
  const x = await escribe(eje, g, ['X', [['uno'], ['dos']]]); // VG, 7-11 noche: por hojas: la forma canónica (cada posición entre corchetes) hace de 1 una décupla
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

test('MOT-08 COMPONER construye una propuesta sin escribir, mantiene referencias y solo mueve recursos el registro que los mueve', async () => {
  const { eje, g } = await mundo();
  const antes = huella(eje);
  const p = proponer(eje, g);
  assert.equal(huella(eje), antes); // la vista provisional no escribe
  assert.deepEqual(p.elecciones[1], { ref: g, dir: '1000000000' }); // referencias, no copias
  const c = await consolidar(eje, { autor: 'ana', foco: g, t: T0, elecciones: p.elecciones });
  assert.deepEqual(c.payload[1], { ref: g, dir: '1000000000' });
  assert.equal(eje.saldo('ana', 'E:raiz/EUR'), 50);
  // Encargo 3b (VG, 8-11, mapa §15 [D] «Una sola operación: registrar»): ni autorizar ni ejecutar. Anunciar no mueve; el pago es el registro de ana que lo mueve.
  await registrar(eje, { autor: 'ana', sobre: c.id, en: ANUNCIO, t: T0, movimientos: [gastaT('ana')], payload: anuncio('E:raiz/EUR', 5, 'pagar', 'ana', 'raiz') });
  assert.equal(eje.saldo('ana', 'E:raiz/EUR'), 50);
  await cumplir(eje, c.id, 'ana');
  assert.equal(eje.saldo('ana', 'E:raiz/EUR'), 45);
});

test('MOT-08b COMPONER solo da por hecho el cambio que se anunció: otro movimiento no lo cierra', async () => {
  // Encargo 3b (VG, 8-11, mapa §15 [D] «Una sola operación: registrar»): se retira ejecutar, así que nada impide a ana mover lo suyo como quiera; pero la lectura de
  // cerrado (por defecto, «all announced movements happened») solo da por hecho lo anunciado.
  const { eje, g } = await mundo();
  const { c } = await anunciada(eje, g, { 1: 'pagar 5 EUR a raiz' });
  await registrar(eje, { autor: 'ana', sobre: c.id, t: T0, movimientos: [gastaT('ana'), daE('ana', 'bea', 5)], payload: 'pago a otra' });
  assert.equal(cerrado(eje, c.id).cerrado, false);
  await cumplir(eje, c.id, 'ana');
  assert.equal(cerrado(eje, c.id).cerrado, true);
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

test('MOT-14 el ciclo: descubrir → elegir o crear → consolidar en PV4 → anunciar → registrar lo anunciado → cerrado', async () => {
  // Encargo 3b (VG, 8-11, mapa §15 [D] «Una sola operación: registrar»): el ciclo es la cadena de registros anclados hasta que se cierra; se retiran autorizar y
  // ejecutar, y la evidencia es la propia cadena.
  const { eje, g } = await mundo();
  const d = descubrir(eje, g);
  assert.deepEqual(d.map((x) => x.posicion), [1, 2, 3, 4]);
  const elecciones = { 1: { candidato: d[0].candidatos[0] }, 2: 'sin azúcar' }; // elegir y crear
  const c = await consolidar(eje, { autor: 'ana', foco: g, t: T0, elecciones, titulo: 'Compra del yogur' });
  assert.equal(c.en, FABRICA);
  assert.equal(cerrado(eje, c.id).cerrado, true); // nada anunciado: nada falta
  const a = await registrar(eje, { autor: 'ana', sobre: c.id, en: ANUNCIO, t: T0, movimientos: [gastaT('ana')], payload: anuncio('E:raiz/EUR', 3, 'pagar', 'ana', 'raiz') });
  assert.equal(cerrado(eje, c.id).cerrado, false);
  const e = await cumplir(eje, c.id, 'ana');
  assert.equal(cerrado(eje, c.id).cerrado, true);
  assert.equal(a.sobre, c.id);
  assert.deepEqual(eje.hilo(e.id).slice(0, 2).map((x) => x.id), [e.id, c.id]);
});

test('MOT-15 el orden lo da la cadena: lo anunciado se mueve una vez y, hecho, ya no falta nada', async () => {
  // Encargo 3b (VG, 8-11, mapa §15 [D] «Una sola operación: registrar»): se retiran los estados del núcleo (solo se autoriza una consolidación, solo se ejecuta lo
  // autorizado y no dos veces); lo que queda es la lectura de lo que falta, siguiente().
  const { eje, g } = await mundo();
  const nota = await escribe(eje, g, 'una nota cualquiera');
  assert.deepEqual(siguiente(eje, nota.id, 'raiz').faltaDeMi, []); // un registro sin anuncios no pide nada
  const { c } = await anunciada(eje, g, { 1: 'x' });
  assert.equal(siguiente(eje, c.id, 'ana').faltaDeMi.length, 1);
  await cumplir(eje, c.id, 'ana');
  assert.deepEqual(siguiente(eje, c.id, 'ana'), { cerrado: true, faltaDeMi: [], espera: [] });
});

test('MOT-16 descubrir conserva las alternativas que ocupan la misma posición con distinto id', async () => {
  const { eje, g } = await mundo(['Compra', 'a', 'b', 'c', [['fábrica'], ['x']]]); // VG, 7-11 noche: por hojas: 4 décupla, 4.0 lista de uno
  const h = await escribe(eje, g, 'otra fábrica', FABRICA); // del dueño: ana no es elegible en el génesis de raiz (R8)
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
  const antes = [eje.saldo('ana', 'E:raiz/EUR'), eje.saldo('raiz', 'E:raiz/EUR'), eje.reputaciones('ana')];
  const c = await consolidar(eje, { autor: 'ana', foco: g, t: T0, elecciones: { 1: 'comprar el yogur', 4: 'pagar 2 EUR' } });
  assert.deepEqual([eje.saldo('ana', 'E:raiz/EUR'), eje.saldo('raiz', 'E:raiz/EUR'), eje.reputaciones('ana')], antes);
  assert.deepEqual(c.movimientos.map((m) => m.token), ['T']);
  // El P sí cambia: escribir un registro da a su autor 10 P sobre él (VG, 8-11, mapa §15 [D]: P se obtiene al
  // escribir, nadie lo acuña a mano). Es peso posicionado en el registro, no un recurso que se mueva.
  assert.equal(eje.poderSobre('ana', c.id), 10);
  assert.deepEqual(siguiente(eje, c.id, 'ana').faltaDeMi, []); // y no hay nada que mover
});

test('MOT-20 consultar, elegir, preparar, consolidar, firmar y ejecutar son actos distintos', async () => {
  const { eje, g } = await mundo();
  const antes = huella(eje);
  consultar(eje, g, [1], 'ELEGIR(BUSCAR(1))'); // consultar y elegir: sin registro
  const p = proponer(eje, g); // preparar: sin registro
  assert.equal(huella(eje), antes);
  const c = await consolidar(eje, { autor: 'ana', foco: g, t: T0, elecciones: p.elecciones });
  assert.equal(c.contexto.motor, 'fabrica'); // sin fase: se retiran los estados del núcleo (VG, 8-11, mapa §15 [D] «Una sola operación: registrar»)
  assert.equal(c.firma, undefined); // consolidar no firma
  const { publica, privada } = await generarClaves();
  const f = await firmar(await crearEvento({ autor: 'x', sobre: g, t: T0, movimientos: [gastaT('x')], payload: 'y' }), privada);
  assert.equal(await verificar(f, publica), true); // firmar es otro acto
  // Anunciar es otro acto, y mover lo anunciado (lo que era ejecutar), otro registro.
  await registrar(eje, { autor: 'ana', sobre: c.id, en: ANUNCIO, t: T0, movimientos: [gastaT('ana')], payload: anuncio('E:raiz/EUR', 1, 'pagar', 'ana', 'raiz') });
  const e = await cumplir(eje, c.id, 'ana');
  assert.equal(cerrado(eje, c.id).cerrado, true);
  assert.notEqual(e.id, c.id);
});

test('MOT-20b acreditar el resultado material es un acto propio',
  { skip: 'MOT-20: no existe el acto de acreditar el resultado material. La capa 4 de src/validez.js (desde la #49) solo mira el respaldo en el libro y dice «externa: sin acreditar»; acreditar lo ocurrido en el mundo es de AARPIA, fuera de AGRAM' },
  sinForma('MOT-20'));

test('MOT-21 una compra anunciada no es una compra hecha: los recursos solo se mueven con el registro que los mueve', async () => {
  // Encargo 3b (VG, 8-11, mapa §15 [D] «Una sola operación: registrar»): se retiran AUTORIZADO y EJECUTADO; la diferencia la lee cerrado().
  const { eje, g } = await mundo();
  const { c } = await anunciada(eje, g, { 1: 'comprar', 4: 'pagar 7 EUR' }, 7);
  assert.equal(cerrado(eje, c.id).cerrado, false);
  assert.equal(eje.saldo('ana', 'E:raiz/EUR'), 50);
  await cumplir(eje, c.id, 'ana');
  assert.equal(cerrado(eje, c.id).cerrado, true);
  assert.equal(eje.saldo('ana', 'E:raiz/EUR'), 43);
});

// =====================================================================
// Motor · ejecutar
// =====================================================================

test('MOT-22 cada uno mueve lo suyo: lo anunciado de ana solo lo mueve ana, y a los demás se les lee como espera', async () => {
  // Encargo 3b (VG, 8-11, mapa §15 [D] «Una sola operación: registrar»): «nadie autoriza lo ajeno, porque cada uno solo mueve lo suyo»; se retira «ejecuta el autor de
  // la consolidación, con una autorización válida».
  const { eje, g } = await mundo();
  const { c } = await anunciada(eje, g, { 1: 'x' });
  for (const otro of ['bea', 'raiz']) {
    assert.deepEqual(siguiente(eje, c.id, otro).faltaDeMi, []);
    assert.deepEqual(siguiente(eje, c.id, otro).espera.map((x) => x.de), ['ana']);
    await assert.rejects(registrar(eje, { autor: otro, sobre: c.id, t: T0, movimientos: [gastaT(otro), daE('ana', 'raiz', 5)], payload: 'lo muevo yo' }), /nobody moves tokens of others/);
  }
  assert.equal(cerrado(eje, c.id).cerrado, false);
});

test('MOT-22b un registro respeta reglas, condiciones y límites de gasto, tiempo y alcance',
  { skip: 'MOT-22: se retira ejecutar (VG, 8-11, mapa §15 [D] «Una sola operación: registrar»); cada uno mueve lo suyo y nada acota cuánto mueve en una propuesta: lo más cercano es la lectura de cerrado, que solo da por hecho lo anunciado (MOT-08b). [X] decidir VG si los límites son plantillas del PV2 del dueño' },
  sinForma('MOT-22'));

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
  assert.deepEqual(propuestas(eje, plan.id), []);
});

test('MOT-24 PV7 guarda el horizonte: un plan declarado en 7 no se convierte en hecho', async () => {
  const { eje, g } = await mundo();
  const antes = [eje.saldo('ana', 'E:raiz/EUR'), eje.saldo('raiz', 'E:raiz/EUR')];
  const plan = await escribe(eje, g, ['Plan', 'a', 'b', 'c', 'd', 'e', 'f', 'pagar el viernes si llega el pedido'], undefined, 'ana');
  const e = ejeTemporal(eje, plan.id, { ahora: AHORA });
  assert.ok(e.futuro.some((x) => x.tipo === 'declarado' && x.contenido === 'pagar el viernes si llega el pedido'));
  assert.deepEqual([eje.saldo('ana', 'E:raiz/EUR'), eje.saldo('raiz', 'E:raiz/EUR')], antes);
  assert.deepEqual(propuestas(eje, plan.id), []);
});

test('MOT-24b PV7 aloja la ejecución condicional y autorizada',
  { skip: 'MOT-24: no existe ejecución condicional ni con fecha; tiempo.ejeTemporal solo lista lo declarado en 7 y las consolidaciones pendientes. Terreno de src/tiempo.js (otro agente): no se toca aquí' },
  sinForma('MOT-24'));

test('MOT-25 registrar el resultado distingue éxito, rechazo, no ocurrido, parcial y sin confirmación',
  { skip: 'MOT-25: se retiran los estados del núcleo (VG, 8-11, mapa §15 [D] «Una sola operación: registrar»); cerrado() solo dice cerrado o no según la plantilla del dueño, y un movimiento rechazado no deja registro. Éxito, rechazo, no ocurrido, parcial y sin confirmación serían plantillas de lectura que la época aún no trae. [X] decidir VG' },
  sinForma('MOT-25'));

test('MOT-26 lo hecho deja evidencia: el registro que mueve lo anunciado cuelga de la propuesta, encadenado en el hilo', async () => {
  // Encargo 3b (VG, 8-11, mapa §15 [D] «Una sola operación: registrar»): sin autorización, la evidencia es la cadena anclada: propuesta, anuncio y movimiento.
  const { eje, g } = await mundo();
  const { c, a } = await anunciada(eje, g);
  const e = await cumplir(eje, c.id, 'ana');
  assert.equal(a.sobre, c.id);
  assert.equal(e.sobre, c.id);
  assert.deepEqual(e.payload, ['mover 5 E:raiz/EUR de ana a raiz']);
  assert.deepEqual(eje.hilo(e.id).slice(0, 3).map((x) => x.id), [e.id, c.id, g]);
});

test('MOT-26b la evidencia acredita el resultado material, no solo el proceso',
  { skip: 'MOT-26: la evidencia es del proceso (propuesta, anuncio y movimiento); la acreditación del resultado material (capa 4) no existe' },
  sinForma('MOT-26'));

// =====================================================================
// Motor · fronteras y autoridad
// =====================================================================

test('MOT-27 PV4 no es el único almacén: lo escrito en 3, 6, 7 y 9 queda en su PV', async () => {
  const { eje, g } = await mundo(['Foco', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']);
  for (const pv of [3, 6, 7, 9]) {
    // En el 3 de la raíz escribe la raíz: escribir en el 3 de otro es pedirle atención, y la atención tiene precio
    // (VG, 9-11, mapa §16 [D] «PV3 = regla de atención»).
    const autor = pv === 3 ? 'raiz' : 'ana';
    const ev = await escribirDesde(eje, { modo: 'pointed', autor, sobre: g, en: direccion([pv]), payload: 'en el PV ' + pv, t: T0 });
    assert.equal(ev.en, direccion([pv]));
    assert.ok(ocupantes(eje, g, [pv]).some((o) => o.evento === ev.id));
  }
  const c = await consolidar(eje, { autor: 'ana', foco: g, t: T0, elecciones: { 1: 'x' } });
  assert.deepEqual(propuestas(eje, g).map((x) => x.id), [c.id]); // solo lo de 4 es propuesta de la fábrica
});

test('MOT-27b registro, autorización y verificación material son fronteras independientes',
  { skip: 'MOT-27: la verificación material no existe (la propuesta, sus anuncios y lo que se mueve cuelgan todos de la posición 4; ya no hay autorización: VG, 8-11, mapa §15 [D] «Una sola operación: registrar»)' },
  sinForma('MOT-27'));

test('MOT-28 un flujo puede empezar desde cualquier PV, pero la posición no da autoridad', async () => {
  const { eje, g } = await mundo(['Foco', 'a', 'b', 'c', 'd', 'e', 'f', ['siete', 'x']]);
  const desde7 = await consolidar(eje, { autor: 'ana', foco: g, camino: [7], t: T0, elecciones: { 1: 'desde el 7' } });
  assert.equal(desde7.en, '7400000000');
  await registrar(eje, { autor: 'ana', sobre: desde7.id, en: ANUNCIO, t: T0, movimientos: [gastaT('ana')], payload: anuncio('E:raiz/EUR', 2, 'pagar', 'ana', 'raiz') });
  // Escribir en la fábrica con un contexto de «autorizado» o «ejecutado» no da autoridad ni cierra nada: ya no hay
  // estados del núcleo, y lo hecho es lo movido (VG, 8-11, mapa §15 [D] «Una sola operación: registrar»).
  await eje.escribir({ autor: 'bea', sobre: desde7.id, en: FABRICA, t: T0, movimientos: [gastaT('bea')], payload: '==autorizo', contexto: { motor: 'fabrica', fase: 'autorizado' } });
  await eje.escribir({ autor: 'bea', sobre: desde7.id, en: FABRICA, t: T0, movimientos: [gastaT('bea')], payload: 'hecho', contexto: { motor: 'fabrica', fase: 'ejecutado', evidencia: [desde7.id] } });
  assert.equal(cerrado(eje, desde7.id).cerrado, false);
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

test('MOT-31 la fábrica, en 4, emite un evento nuevo con el array consolidado y referencias a sus fuentes; mover es otro acto', async () => {
  const { eje, g } = await mundo();
  const fuente = await escribe(eje, g, 'yogur griego', '1000000000');
  const c = await consolidar(eje, { autor: 'ana', foco: g, t: T0, elecciones: { 1: { ref: fuente.id } } });
  assert.equal(c.en, FABRICA);
  assert.deepEqual(c.payload, ['Consolidación', { ref: fuente.id }]);
  assert.deepEqual(c.movimientos.map((m) => m.token), ['T']); // consolidar no mueve recursos
  // Mover es otro registro (VG, 8-11, mapa §15 [D] «Una sola operación: registrar»): se anuncia y lo mueve quien lo tiene.
  await registrar(eje, { autor: 'ana', sobre: c.id, en: ANUNCIO, t: T0, movimientos: [gastaT('ana')], payload: anuncio('E:raiz/EUR', 1, 'pagar', 'ana', 'raiz') });
  const e = await cumplir(eje, c.id, 'ana');
  assert.notEqual(e.id, c.id);
  assert.equal(cerrado(eje, c.id).cerrado, true);
});

test('MOT-32 consolidar no borra nada: varias propuestas del mismo foco conviven, cada una con su lectura de cerrado', async () => {
  // Encargo 3b (VG, 8-11, mapa §15 [D] «Una sola operación: registrar»): sin estados del núcleo; cada propuesta se lee con la plantilla de cerrado de su dueño (por
  // defecto, «all announced movements happened»: sin nada anunciado, nada falta).
  const { eje, g } = await mundo();
  const c1 = await consolidar(eje, { autor: 'ana', foco: g, t: T0, elecciones: { 1: 'primera' } });
  const { c: c2 } = await anunciada(eje, g, { 1: 'segunda' });
  const c3 = await consolidar(eje, { autor: 'ana', foco: g, t: T0, elecciones: { 1: 'corrección de la primera' } });
  assert.deepEqual(propuestas(eje, g).map((x) => [x.id, x.cerrado]), [[c1.id, true], [c2.id, false], [c3.id, true]]);
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
  const { c } = await anunciada(eje, g);
  const nota = await registrar(eje, { autor: 'bea', sobre: c.id, t: T0, movimientos: [gastaT('bea')], payload: 'me apunto' });
  assert.equal(nota.sobre, c.id);
  assert.equal(eje.obtener(c.id).autor, 'ana'); // la operación sigue siendo de ana
  assert.deepEqual(eje.obtener(c.id), c);
  assert.equal(cerrado(eje, c.id).cerrado, false); // y lo que escribe bea no cierra lo de ana
});

test('MOT-35b la consolidación referencia los recibos de terceros (aceptación, despacho, recepción)',
  { skip: 'MOT-35: otros escriben sus registros sobre la propuesta (MOT-35), pero no hay recibos de aceptación, despacho o recepción ni estados de la frontera externa: propuestas() solo da su lectura de cerrado (VG, 8-11, mapa §15 [D] «Una sola operación: registrar»). No está acordado qué cuenta como recibo ni sus estados (ver MOT-68c). [X] decidir VG' },
  sinForma('MOT-35'));

test('MOT-36 cerrar una tarea permite empezar otra sin fingir que la anterior ya no está pendiente', async () => {
  const { eje, g } = await mundo();
  const otra = await escribe(eje, g, ['Otra tarea', 'a']);
  const { c: c1 } = await anunciada(eje, g, { 1: 'primera' });
  await consolidar(eje, { autor: 'ana', foco: otra.id, t: T0, elecciones: { 1: 'segunda' } });
  // Pendiente es una lectura (VG, 8-11, mapa §15 [D] «Una sola operación: registrar»): lo anunciado en la primera aún no se ha movido.
  assert.equal(propuestas(eje, g)[0].cerrado, false);
  assert.ok(ejeTemporal(eje, g, { ahora: AHORA }).futuro.some((x) => x.id === c1.id && x.tipo === 'consolidacion'));
});

test('MOT-37 las consolidaciones no cerradas son futuro subjetivo', async () => {
  const { eje, g } = await mundo();
  const { c } = await anunciada(eje, g);
  const enFuturo = () => ejeTemporal(eje, g, { ahora: AHORA }).futuro.find((x) => x.id === c.id && x.tipo === 'consolidacion');
  assert.ok(enFuturo());
  await cumplir(eje, c.id, 'ana'); // movido lo anunciado, se cierra (VG, 8-11, mapa §15 [D] «Una sola operación: registrar»)
  assert.equal(enFuturo(), undefined);
});

test('MOT-38 se ejecuta en 4: lo anunciado se mueve con un registro nuevo que entra en la fábrica de la propuesta (X → cruz)', async () => {
  // Encargo 3b (VG, 8-11, mapa §15 [D] «Una sola operación: registrar»): ejecutar es registrar el movimiento anunciado; aquí ana lo ancla en el 4 de su propuesta.
  const { eje, g } = await mundo();
  const { c } = await anunciada(eje, g);
  const antes = eje.orden.length;
  const e = await cumplir(eje, c.id, 'ana', { en: FABRICA });
  assert.equal(e.en, FABRICA);
  assert.equal(e.sobre, c.id);
  assert.equal(eje.orden.length, antes + 1);
  assert.ok(ocupantes(eje, c.id, [4]).some((o) => o.evento === e.id));
});

test('MOT-38b lo anunciado y movido en el 4 de la propuesta la cierra',
  async () => {
    const { eje, g } = await mundo();
    const { c } = await anunciada(eje, g);
    await cumplir(eje, c.id, 'ana', { en: FABRICA });
    assert.equal(cerrado(eje, c.id).cerrado, true);
  });

test('MOT-39 papeles: BTML es la estructura, BQL la vista sin efectos y el motor la ejecución real', async () => {
  const { eje, g } = await mundo(['Compra', 'yogur', '=LOCAL(1)']);
  const antes = huella(eje);
  evaluar(eje, g, [2]);
  consultar(eje, g, [0], 'BUSCAR(1)');
  assert.equal(huella(eje), antes); // BQL no mueve nada
  const { c } = await anunciada(eje, g, undefined, 4);
  await cumplir(eje, c.id, 'ana'); // registrar lo anunciado (VG, 8-11, mapa §15 [D] «Una sola operación: registrar»)
  assert.equal(eje.saldo('raiz', 'E:raiz/EUR'), 54); // el motor sí
});

test('MOT-41 AARPIA es el motor real de autorización y ejecución',
  { skip: 'MOT-41: no hay AARPIA; lo que queda del ciclo (registrar y sus lecturas: VG, 8-11, mapa §15 [D] «Una sola operación: registrar») vive en src/motor.js (por decisión de VG del 6-11 AARPIA queda fuera salvo instancias y transiciones, TOK-74)' },
  sinForma('MOT-41'));

test('MOT-43 lo que escribe quien no es el dueño no cambia la lectura: ni anuncia por él ni cierra lo suyo', async () => {
  // Encargo 3b (VG, 8-11, mapa §15 [D] «Una sola operación: registrar»): se retira «quien no puede autorizar o ejecutar»; cuenta lo que anuncia el dueño de X y lo
  // que mueve quien lo tiene.
  const { eje, g } = await mundo();
  const { c } = await anunciada(eje, g, { 1: 'x' });
  await eje.escribir({ autor: 'bea', sobre: c.id, en: ANUNCIO, t: T0, movimientos: [gastaT('bea')], payload: anuncio('E:raiz/EUR', 50, 'pagar', 'ana', 'bea') });
  await eje.escribir({ autor: 'raiz', sobre: c.id, en: FABRICA, t: T0, movimientos: [gastaT('raiz')], payload: 'hecho', contexto: { fase: 'ejecutado', evidencia: [c.id] } });
  assert.equal(cerrado(eje, c.id).cerrado, false);
  assert.deepEqual(siguiente(eje, c.id, 'ana').faltaDeMi.map((x) => x.que), ['mover 5 E:raiz/EUR de ana a raiz']);
});

test('MOT-44 el pendiente es una lectura, no un estado ni un fallo: cerrado() lo dice con la plantilla del dueño', async () => {
  // Encargo 3b (VG, 8-11, mapa §15 [D] «Una sola operación: registrar»): se retiran los tres estados del núcleo (PENDIENTE DE AUTORIZACIÓN → AUTORIZADO → EJECUTADO);
  // «cerrado» se establece por proceso con la plantilla que el dueño nombra en su PV2 (por defecto, la de la época).
  const { eje, g } = await mundo();
  const c = await consolidar(eje, { autor: 'ana', foco: g, t: T0, elecciones: { 1: 'x' } }); // no lanza
  const lecturas = [cerrado(eje, c.id)];
  await registrar(eje, { autor: 'ana', sobre: c.id, en: ANUNCIO, t: T0, movimientos: [gastaT('ana')], payload: anuncio('E:raiz/EUR', 1, 'pagar', 'ana', 'raiz') });
  lecturas.push(cerrado(eje, c.id));
  await cumplir(eje, c.id, 'ana');
  lecturas.push(cerrado(eje, c.id));
  const P = 'all announced movements happened';
  assert.deepEqual(lecturas.map((x) => [x.cerrado, x.plantilla]), [[true, P], [false, P], [true, P]]);
});

// =====================================================================
// Motor · operadores Q/B/C
// =====================================================================

test('MOT-46 Q interroga: aplicar un PV es volver a interrogar el resultado, y consultar no cambia ningún hecho', async () => {
  const { eje, g } = await mundo(['Compra', [['recursos'], ['yogur'], ['leche']], 'b']); // VG, 7-11 noche: por hojas: 1 décupla
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
  assert.deepEqual(propuestas(eje, g), []);
});

test('MOT-48 C consolida y cada parte decide después: la propuesta de bea no mueve nada de nadie', async () => {
  // Encargo 3b (VG, 8-11, mapa §15 [D] «Una sola operación: registrar»): se retira autorizar con P. Bea puede anunciar en su propuesta un pago de ana; solo ana lo
  // mueve, si quiere, y hasta entonces no está hecho.
  const { eje, g } = await mundo();
  assert.equal(OPERADORES.C, 'consolidar');
  const c = await consolidar(eje, { autor: 'bea', foco: g, t: T0, elecciones: { 1: 'x' } });
  await registrar(eje, { autor: 'bea', sobre: c.id, en: ANUNCIO, t: T0, movimientos: [gastaT('bea')], payload: anuncio('E:raiz/EUR', 5, 'pagar', 'ana', 'raiz') });
  assert.equal(eje.saldo('ana', 'E:raiz/EUR'), 50);
  assert.deepEqual(siguiente(eje, c.id, 'ana').faltaDeMi.map((x) => x.que), ['mover 5 E:raiz/EUR de ana a raiz']); // se le pide…
  assert.equal(cerrado(eje, c.id).cerrado, false); // …y hasta que lo mueva, no está hecho
});

test('MOT-48b C solo consolida lo que permite un contrato válido (con autoridad)',
  { skip: 'MOT-48: consolidar() no comprueba autoridad ni contrato: cualquiera consolida, y desde el encargo 3b ya no hay autorizar (VG, 8-11, mapa §15 [D] «Una sola operación: registrar»): cada parte mueve lo suyo. [X] decidir VG si un contrato limita quién propone' },
  async () => {
    const { eje, g } = await mundo();
    await assert.rejects(consolidar(eje, { autor: 'bea', foco: g, t: T0, elecciones: { 1: 'x' } }));
  });

test('MOT-49 el orden de composición importa: 13 no es 31 (primero i, después j)', async () => {
  assert.deepEqual(leerDireccion('1300000000').map((x) => x.significado), ['recursos', 'con quién']);
  assert.deepEqual(leerDireccion('3100000000').map((x) => x.significado), ['comunicación', 'cuánto']);
  const { eje, g } = await mundo(['F', [['1.0'], ['1.1'], ['1.2'], ['uno y tres']], 'b', [['3.0'], ['tres y uno']]]); // VG, 7-11 noche: por hojas: 1 y 3 décuplas
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
  // Un registro Pointed de una posición (antes, la autorización, que se retira: VG, 8-11, mapa §15 [D] «Una sola operación: registrar»).
  const uno = await escribirDesde(eje, { modo: 'pointed', autor: 'ana', sobre: g, payload: 'a', t: T0 });
  assert.equal(uno.contexto.modo, 'pointed');
  assert.equal(contarPosiciones(uno.payload), 1);
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
  // Por encima de la propuesta, dentro del máximo: la escritura no lo rechaza. Cuesta 400 minutos de ana, que se
  // acuñan al gastarse (VG, 7-11 noche) y se anotan en el registro que la soporta.
  assert.equal(proporcionDe(400, 'mapped').estado, 'por encima');
  const antes = eje.tiempoSobre(g).minuto ?? 0;
  await escribirDesde(eje, { modo: 'mapped', autor: 'ana', sobre: g, payload: encima, t: T0 });
  assert.equal(eje.tiempoSobre(g).minuto, antes + 400);
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
  const eje = await Eje.genesis({ demostracion: true, identidad: 'raiz', emision: EMISION, foco: ['Foco', 'a'], t: ALTA, clave: raiz.publica, privada: raiz.privada });
  const g = eje.genesisId;
  // 1 · forma
  assert.ok(validarForma({ autor: 'raiz', sobre: g, en: '4', t: T0, movimientos: [gastaT('raiz')], payload: 'x' }).length > 0);
  // 2 · interpretación
  const p = await eje.escribir({ autor: 'raiz', sobre: g, t: T0, movimientos: [gastaT('raiz')], payload: ['P', '=LOCAL(9)', '=REF("' + ID_INEXISTENTE + '")'] }, raiz.privada);
  assert.equal(evaluar(eje, p.id, [1]).estado, 'PENDIENTE');
  assert.equal(evaluar(eje, p.id, [2]).estado, 'PENDIENTE');
  // C1 (VG, 10-11): una referencia { ref } a un evento ausente no entra en un eje local.
  await assert.rejects(eje.escribir({ autor: 'raiz', sobre: g, t: T0, movimientos: [gastaT('raiz')], payload: ['P', { ref: ID_INEXISTENTE }] }, raiz.privada), /referencia a un evento que no está en el eje/);
  // 3 · criptografía y procedencia
  assert.equal(await verificarId(p), true);
  assert.equal(await verificarId({ ...p, payload: 'cambiado' }), false);
  assert.equal(await verificar(p, raiz.publica), true);
  // 5 · permiso: cada uno mueve lo suyo (VG, 8-11, mapa §15 [D] «Una sola operación: registrar»). Ana entra por invitación de la raíz, que la firma.
  // La aceptación no se fecha antes de lo último del libro, y ana, en el equipo sin precio, consolida sobre el génesis (revisión de seguridad, encargo 3b).
  await entrarPorInvitacion(eje, { por: 'raiz', quien: 'ana', t: T0, grupo: 4, privadaDe: (id) => (id === 'raiz' ? raiz.privada : undefined) });
  await equipoSinPrecio(eje, 'raiz', T0, raiz.privada);
  await eje.escribir({ autor: 'raiz', sobre: g, t: T0, movimientos: [gastaT('raiz'), daT('raiz', 'ana', 60)], payload: 'alta' }, raiz.privada);
  const c = await consolidar(eje, { autor: 'ana', foco: g, t: T0, elecciones: { 1: 'x' } });
  await assert.rejects(registrar(eje, { autor: 'ana', sobre: c.id, t: T0, movimientos: [gastaT('ana'), daT('raiz', 'ana', 1)], payload: 'me lo doy' }), /nobody moves tokens of others/);
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
  const eje = await Eje.genesis({ demostracion: true, identidad: 'raiz', emision: EMISION, foco: ['Foco', 'a'], t: ALTA, clave: raiz.publica, privada: raiz.privada });
  const g = eje.genesisId;
  // Las personas entran por invitación de la raíz (que firma); bea, con su clave en su alta.
  const privadaDe = (id) => (id === 'raiz' ? raiz.privada : undefined);
  // En el equipo de la raíz, sin precio: ana consolida sobre el génesis (revisión de seguridad, encargo 3b).
  await entrarPorInvitacion(eje, { por: 'raiz', quien: 'ana', t: ALTA, grupo: 4, privadaDe });
  await entrarPorInvitacion(eje, { por: 'raiz', quien: 'bea', t: ALTA, clave: bea, grupo: 4, privadaDe });
  await equipoSinPrecio(eje, 'raiz', ALTA, raiz.privada);
  await eje.escribir({ autor: 'raiz', sobre: g, t: ALTA, movimientos: [gastaT('raiz'), daT('raiz', 'ana', 60), daT('raiz', 'bea', 60)], payload: 'altas' }, raiz.privada);
  const c = await consolidar(eje, { autor: 'ana', foco: g, t: T0, elecciones: { 1: 'x' } });
  await registrar(eje, { autor: 'ana', sobre: c.id, en: ANUNCIO, t: T0, movimientos: [gastaT('ana')], payload: anuncio('E:raiz/minuto', 5, 'devolver', 'ana', 'raiz') });
  const firmada = await eje.escribir({ autor: 'bea', sobre: c.id, en: FABRICA, t: T0, movimientos: [gastaT('bea')], payload: 'hecho', contexto: { motor: 'fabrica', fase: 'ejecutado' } }, bea.privada);
  assert.deepEqual(validarForma(firmada), []);
  assert.equal(await verificar(firmada, bea.publica), true);
  assert.equal(cerrado(eje, c.id).cerrado, false); // firmado y bien formado, y no por eso hecho (VG, 8-11, mapa §15 [D] «Una sola operación: registrar»)
});

test('MOT-63 en el registro en foco se pueden inspeccionar señales de validez, que no la garantizan', async () => {
  const raiz = await generarClaves();
  const eje = await Eje.genesis({ demostracion: true, identidad: 'raiz', emision: EMISION, foco: ['Foco', 'a'], t: T0, clave: raiz.publica, privada: raiz.privada });
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

test('MOT-68 no se impone una máquina de estados a todo: no hay estados del núcleo, solo lecturas', async () => {
  // Encargo 3b (VG, 8-11, mapa §15 [D] «Una sola operación: registrar»): se retira el ciclo de autorización; «cerrado» se establece por proceso, y hay procesos que se
  // cierran y otros no.
  const { eje, g } = await mundo();
  const nota = await escribe(eje, g, 'una nota');
  assert.equal(nota.contexto.fase, undefined);
  assert.deepEqual(propuestas(eje, g), []);
  assert.deepEqual(siguiente(eje, nota.id, 'raiz'), { cerrado: true, faltaDeMi: [], espera: [] });
  for (const retirado of ['autorizar', 'ejecutar', 'estadoDe', 'consolidaciones']) assert.equal(retirado in motor, false, retirado);
});

test('MOT-68b ningún registro recibe un estado: ni el foco, ni la propuesta, ni su anuncio llevan fase', async () => {
  const { eje, g } = await mundo();
  const { c, a } = await anunciada(eje, g);
  for (const ev of [eje.obtener(g), c, a]) assert.equal(ev.contexto?.fase, undefined);
  assert.equal(cerrado(eje, c.id).cerrado, false); // lo que hay es una lectura (VG, 8-11, mapa §15 [D] «Una sola operación: registrar»)
});

test('MOT-68c los contextos tienen sus propios estados, sin una máquina de estados universal',
  { skip: 'MOT-68: ya no hay ciclo de tres estados (VG, 8-11, mapa §15 [D] «Una sola operación: registrar»); los estados propios del contexto (aceptado, despachado, recibido…) serían plantillas de cerrado que el dueño nombra en su PV2, y la época solo trae «all announced movements happened». [X] decidir VG' },
  sinForma('MOT-68'));

// =====================================================================
// Motor · tokens (M:TOK)
// =====================================================================

test('M:TOK-01 cada posición escrita mueve un minuto de T del autor (consolidar y anunciar)', async () => {
  const { eje, g } = await mundo();
  const c = await consolidar(eje, { autor: 'ana', foco: g, t: T0, elecciones: { 1: 'uno', 2: ['dos', 'tres'] } });
  assert.equal(minutosDe(c), contarPosiciones(c.payload));
  assert.equal(minutosDe(c), 4);
  // Antes, la autorización (se retira: VG, 8-11, mapa §15 [D] «Una sola operación: registrar»); ahora, el anuncio escrito desde Mapped.
  const a = await escribirDesde(eje, { modo: 'mapped', autor: 'ana', sobre: c.id, en: ANUNCIO, payload: anuncio('E:raiz/EUR', 1, 'pagar', 'ana', 'raiz'), t: T0 });
  assert.equal(minutosDe(a), contarPosiciones(a.payload));
});

test('M:TOK-01b mover lo anunciado también paga un minuto por posición escrita', async () => {
  const { eje, g } = await mundo();
  const { c } = await anunciada(eje, g);
  const e = await cumplir(eje, c.id, 'ana'); // lo que era ejecutar (VG, 8-11, mapa §15 [D] «Una sola operación: registrar»)
  assert.equal(minutosDe(e), contarPosiciones(e.payload));
});

test('M:TOK-02 el coste en minutos se paga con T de minuto, no con horas convertidas', async () => {
  // VG, 8-11: T es la asignación diaria de cada persona; lo que se comprueba es que el coste en minutos
  // se anota en minutos y no toca las horas (no se convierten).
  const eje = await Eje.genesis({ demostracion: true, identidad: 'raiz', emision: [], foco: ['Casa', 'x'], t: T0 });
  const ev = await escribirDesde(eje, { modo: 'pointed', autor: 'raiz', sobre: eje.genesisId, en: '1000000000', payload: 'nota', t: T0 });
  assert.deepEqual(ev.movimientos.map((m) => [m.token, m.escala, m.de, m.a]), [['T', 'minuto', 'raiz', null]]);
  assert.deepEqual([eje.saldo('raiz', 'T:hora'), eje.saldoT('raiz', 'hora', T0)], [0, 24]);
  assert.deepEqual(eje.tiempoSobre(eje.genesisId), { minuto: ev.movimientos[0].cantidad });
});

test('M:TOK-03 cada acto del ciclo mueve al menos T de su autor; E, P y R solo cambian de manos con el registro que los mueve', async () => {
  // Encargo 3b (VG, 8-11, mapa §15 [D] «Una sola operación: registrar»): los actos son consolidar, anunciar y mover lo anunciado; se retira autorizar (bloquear P).
  const { eje, g } = await mundo();
  const { c, a } = await anunciada(eje, g, undefined, 2);
  const e = await cumplir(eje, c.id, 'ana');
  for (const ev of [c, a, e]) assert.ok(minutosDe(ev) >= 1, ev.id);
  assert.deepEqual(c.movimientos.map((m) => m.token), ['T']);
  assert.deepEqual(a.movimientos.map((m) => m.token), ['T']);
  assert.deepEqual(e.movimientos.map((m) => m.token), ['T', 'E']);
});

test('M:TOK-04 la reserva: la plaza es una serie limitada; la segunda reserva solapada se escribe y colisiona, pero no se mueve por saldo', async () => {
  const { eje, hab } = await casaConUnaPlaza();
  const { c: r1, pedido: p1 } = await reservaDeLaCasa(eje, hab, 'h1');
  const { c: r2, pedido: p2 } = await reservaDeLaCasa(eje, hab, 'h2');
  assert.deepEqual(ocupantes(eje, hab, [1, 4]).filter((o) => o.origen === 'escrito').map((o) => o.evento), [p1.id, p2.id]); // colisionan
  await cumplir(eje, r1.id, 'casa');
  assert.equal(eje.saldo('h1', 'E:casa/plaza-7-11'), 1);
  await assert.rejects(cumplir(eje, r2.id, 'casa'), /saldo insuficiente/);
  assert.deepEqual([cerrado(eje, r1.id).cerrado, cerrado(eje, r2.id).cerrado], [true, false]);
});

test('M:TOK-04b la reserva del huésped mueve la plaza de la casa al huésped, y la casa emite su propia serie', async () => {
  // Ya no se salta (encargo 3b; VG, 8-11, mapa §15 [D] «Una sola operación: registrar»): el huésped anuncia en su propuesta que la plaza pasa de la casa a él, y la
  // casa la mueve, porque es suya; siguiente() le dice lo que le falta. Encaja con TOK-35.
  const { eje, c, antes } = await reservaDelHuesped();
  assert.equal(antes, false);
  assert.equal(eje.saldo('huesped', 'E:casa/plaza'), 1);
  assert.equal(cerrado(eje, c.id).cerrado, true);
});

// =====================================================================
// Tokens · base y series
// =====================================================================

test('TOK-01 todo evento es una transición de tokens: no existe evento sin movimiento', async () => {
  const { eje, g } = await mundo();
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: g, t: T0, movimientos: [], payload: 'quieto' }), /todo evento mueve tokens/);
  // Salvo el génesis, que no mueve nada (encargo 3b, mapa §15 [D]: la emisión va en la transacción siguiente).
  assert.deepEqual(eje.obtener(g).movimientos, []);
  assert.ok([...eje.eventos.values()].every((ev) => ev.id === g || ev.movimientos.length > 0));
});

test('TOK-02 el evento mínimo mueve T del autor (el génesis no: no emite T; VG, 8-11: no hay T acumulable)', async () => {
  assert.equal((await Eje.genesis({ demostracion: true, identidad: 'raiz', emision: [{ token: 'R', cantidad: 1 }], foco: 'x', t: T0 })).serie('T:minuto').emitido, 0);
  await assert.rejects(Eje.genesis({ demostracion: true, identidad: 'raiz', emision: [{ token: 'T', escala: 'minuto', cantidad: 1 }], foco: 'x', t: T0 }), /nobody mints T/);
  const { eje, g } = await mundo();
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: g, t: T0, movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'bea', a: null }], payload: 'x' }), /escribir consume T del autor/);
  // VG, 7-11 noche: el mínimo es un CONSUMO (de = autor, a = null); dárselo a uno mismo no cuenta, y T no cruza de persona.
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: g, t: T0, movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'ana', a: 'ana' }], payload: 'x' }), /escribir consume T del autor/);
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: g, t: T0, movimientos: [gastaT('ana'), { token: 'T', escala: 'minuto', cantidad: 1, de: 'ana', a: 'bea' }], payload: 'x' }), /T only goes to things/);
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
    demostracion: true,
    identidad: 'raiz',
    emision: [...EMISION, { token: 'E', denominacion: 'EUR', cantidad: 100 }, { token: 'E', denominacion: 'kg', cantidad: 5 }],
    foco: 'x',
    t: T0,
  });
  const g = eje.genesisId;
  assert.deepEqual([eje.saldo('raiz', 'E:raiz/EUR'), eje.saldo('raiz', 'E:raiz/kg')], [100, 5]);
  await assert.rejects(eje.escribir({ autor: 'raiz', sobre: g, t: T0, movimientos: [gastaT('raiz'), { token: 'E', emisor: 'raiz', denominacion: 'kg', cantidad: 6, de: 'raiz', a: null }], payload: 'x' }), /saldo insuficiente/);
  // P por ámbito: un registro del eje, nunca «genesis» (VG, 8-11, mapa §15 [D]: «P moves within a known scope»; se
  // obtiene al escribir: 10 sobre cada registro propio).
  assert.equal(eje.poderSobre('raiz', g), 10);
  assert.ok(eje.poderes('raiz').every((p) => Boolean(eje.obtener(p.ambito))));
  assert.deepEqual(eje.reputaciones('raiz'), [{ emisor: 'raiz', cantidad: 10 }]);
});

test('TOK-04b también T es una serie: un saldo por escala', async () => {
  // Gastar 3 horas no toca los minutos: salen de la asignación del día en horas (VG, 8-11: asignación diaria).
  const eje = await Eje.genesis({ demostracion: true, identidad: 'raiz', emision: [], foco: 'x', t: T0 });
  // Una cosa (su alta la escribe otra identidad, B1) no tiene asignación: saldo insuficiente, como siempre.
  await eje.escribir({ autor: 'raiz', sobre: eje.genesisId, t: T0, movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'raiz', a: null }, { token: 'T', escala: 'minuto', cantidad: 1, de: 'raiz', a: 'maquina' }], payload: 'una máquina' });
  await assert.rejects(eje.escribir({ autor: 'maquina', sobre: eje.genesisId, t: T0, movimientos: [{ token: 'T', escala: 'hora', cantidad: 3, de: 'maquina', a: null }], payload: 'x' }), /saldo insuficiente de T:hora en maquina/);
  await eje.escribir({ autor: 'raiz', sobre: eje.genesisId, t: T0, movimientos: [{ token: 'T', escala: 'hora', cantidad: 3, de: 'raiz', a: null }], payload: 'x' });
  assert.deepEqual([eje.saldoT('raiz', 'hora', T0), eje.saldoT('raiz', 'minuto', T0)], [21, 1438]);
  const hora = eje.series().find((s) => s.clave === 'T:hora');
  assert.deepEqual([hora.emitido, hora.consumido, hora.deAsignacion], [0, 3, 3]);
});

// =====================================================================
// Tokens · T (escalas, zoom, calendario)
// =====================================================================

test('TOK-05 T son siete tokens, uno por escala, cada uno con su propio saldo', async () => {
  // Sin T explícito (VG, 8-11: no hay T acumulable): cada escala, su asignación del día, sin convertir.
  const eje = await Eje.genesis({ demostracion: true, identidad: 'raiz', emision: [], foco: 'x', t: T0 });
  assert.equal(eje.saldoT('raiz', 'hora'), 24);
  assert.equal(eje.saldoT('raiz', 'minuto'), 1440);
});

test('TOK-06 las escalas de T no se convierten entre sí: gastar en una no consume saldo de otra', async () => {
  const eje = await Eje.genesis({ demostracion: true, identidad: 'raiz', emision: [], foco: 'x', t: T0 });
  const g = eje.genesisId;
  // Gastar días o minutos sale de la asignación del día en su escala (VG, 8-11): trescientos días no caben en
  // un día; un minuto sí. Las horas y el año no se tocan.
  await assert.rejects(eje.escribir({ autor: 'raiz', sobre: g, t: T0, movimientos: [{ token: 'T', escala: 'dia', cantidad: 300, de: 'raiz', a: null }], payload: 'x' }),
    /writing burns today's T/);
  await eje.escribir({ autor: 'raiz', sobre: g, t: T0, movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'raiz', a: null }], payload: 'y' });
  assert.deepEqual([eje.saldoT('raiz', 'hora', T0), eje.saldoT('raiz', 'anio', T0), eje.saldoT('raiz', 'dia', T0)], [24, 1, 1]);
  assert.deepEqual(eje.tiempoSobre(g), { minuto: 1 });
});

test('TOK-07 una misma actividad puede mover a la vez varias escalas de T', async () => {
  const eje = await Eje.genesis({ demostracion: true, identidad: 'raiz', emision: [], foco: 'x', t: T0 });
  const ev = await eje.escribir({ autor: 'raiz', sobre: eje.genesisId, t: T0, movimientos: ['minuto', 'dia', 'semana', 'anio'].map((escala) => ({ token: 'T', escala, cantidad: 1, de: 'raiz', a: null })), payload: 'intervención, atención, horizonte, estrategia' });
  assert.deepEqual(ev.movimientos.map((m) => m.escala), ['minuto', 'dia', 'semana', 'anio']);
});

test('TOK-07b las escalas que mueve una actividad son saldos independientes', async () => {
  const eje = await Eje.genesis({ demostracion: true, identidad: 'raiz', emision: [], foco: 'x', t: T0 });
  await eje.escribir({ autor: 'raiz', sobre: eje.genesisId, t: T0, movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'raiz', a: null }, { token: 'T', escala: 'dia', cantidad: 1, de: 'raiz', a: null }], payload: 'x' });
  assert.deepEqual([eje.saldoT('raiz', 'minuto'), eje.saldoT('raiz', 'dia')], [1439, 0]);
});

test('TOK-08 las escalas reales de T son exactamente siete: segundo, minuto, hora, día, semana, ciclo de 28 días y año; y tres informativas (VG, 8-11)', () => {
  assert.deepEqual([...tokens.ESCALAS_REALES], ['segundo', 'minuto', 'hora', 'dia', 'semana', 'ciclo', 'anio']);
  assert.deepEqual([...ESCALAS_T], [...tokens.ESCALAS_REALES, 'pasado', 'futuro', 'inventado']);
  for (const mala of ['mes', 'trimestre', 'decada']) {
    assert.ok(validarMovimiento({ token: 'T', escala: mala, cantidad: 1, de: 'x', a: null }).some((e) => /escala T inválida/.test(e)), mala);
  }
});

test('TOK-09 T tiene hoy diez escalas: siete reales y tres informativas (VG, 8-11)', () => {
  assert.equal(ESCALAS_T.length, 10);
  assert.equal(tokens.ESCALAS_REALES.length, 7);
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
  assert.equal(tokens.ESCALAS_REALES.length, 7);
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
  await assert.rejects(escribe(eje, a.id, 'antes', undefined, 'ana', '2026-11-07T10:30:00Z'), /not before its focus/);
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
  assert.deepEqual(propuestas(eje, plan.id), []);
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
  const eje = await Eje.genesis({ demostracion: true, identidad: 'raiz', emision: [...EMISION, { token: 'E', denominacion: 'EUR', cantidad: 10 }, { token: 'E', denominacion: 'BTC', cantidad: 10 }], foco: 'x', t: T0 });
  await assert.rejects(eje.escribir({ autor: 'raiz', sobre: eje.genesisId, t: T0, movimientos: [gastaT('raiz'), { token: 'E', emisor: 'raiz', denominacion: 'EUR', cantidad: 15, de: 'raiz', a: null }], payload: 'x' }), /saldo insuficiente/);
  assert.deepEqual([eje.saldo('raiz', 'E:raiz/EUR'), eje.saldo('raiz', 'E:raiz/BTC')], [10, 10]);
});

test('TOK-26b no hay E sin denominación', async () => {
  await assert.rejects(Eje.genesis({ demostracion: true, identidad: 'raiz', emision: [...EMISION, { token: 'E', cantidad: 5 }], foco: 'x', t: T0 }));
});

test('TOK-27 cada denominación de E está ligada a su emisor: las plazas de dos casas son series distintas', async () => {
  const eje = await Eje.genesis({ demostracion: true, identidad: 'raiz', emision: EMISION, foco: 'x', t: T0 });
  const g = eje.genesisId;
  // Las casas que emiten son personas; entran por invitación (y la R que les guarda la raíz les da P sobre su alta,
  // el génesis), y emiten con R suya emitida (encargo 3b, VG, 8-11 y 9-11, mapa §15 [D]).
  for (const id of ['casaA', 'casaB']) await entrarPorInvitacion(eje, { por: 'raiz', quien: id, t: T0 });
  void g;
  for (const [casa, n] of [['casaA', 2], ['casaB', 3]]) {
    // Sobre su propia alta: sobre el génesis (el alta de la raíz) pagaría su atención (revisión de seguridad, encargo 3b).
    await eje.escribir({ autor: casa, sobre: eje.alta(casa).id, t: T0, movimientos: [gastaT(casa), ...rEnJuego(casa), { token: 'E', denominacion: 'plaza', emisor: casa, cantidad: n, de: null, a: casa }], payload: 'plazas de ' + casa });
  }
  assert.deepEqual([eje.saldo('casaA', 'E:casaA/plaza'), eje.saldo('casaB', 'E:casaB/plaza')], [2, 3]);
  assert.equal(eje.saldo('casaA', 'E:casaB/plaza'), 0); // la misma palabra, dos series
});

test('TOK-28 cada emisor emite sus propias series (la E que respalda y su R) y solo él amplía su serie', async () => {
  const eje = await Eje.genesis({ demostracion: true, identidad: 'raiz', emision: EMISION, foco: 'x', t: ALTA });
  const g = eje.genesisId;
  // La casa que emite es una persona: entra por invitación y emite con R suya emitida (encargo 3b, mapa §15 [D]).
  for (const id of ['casa', 'otro']) await entrarPorInvitacion(eje, { por: 'raiz', quien: id, t: ALTA });
  // Cada una sobre su propia alta: sobre el génesis (el alta de la raíz) pagaría su atención (revisión de seguridad, encargo 3b).
  void g;
  await eje.escribir({ autor: 'casa', sobre: eje.alta('casa').id, t: T0, movimientos: [gastaT('casa'), ...rEnJuego('casa'), { token: 'E', denominacion: 'plaza', emisor: 'casa', cantidad: 2, de: null, a: 'casa' }], payload: 'plazas' });
  await eje.escribir({ autor: 'casa', sobre: eje.alta('casa').id, t: T0, movimientos: [gastaT('casa'), { token: 'R', emisor: 'casa', cantidad: 5, de: null, a: 'casa' }], payload: 'reputación de la casa' });
  // Sin colateral (VG, 9-11, mapa §15 [D] «R según el corpus»: se retira el de la #75): 7 emitidos, 1 en la raíz.
  assert.deepEqual([eje.saldo('casa', 'E:casa/plaza'), eje.saldo('casa', 'R:casa'), eje.bloqueado('casa', 'R:casa')], [2, 6, 0]);
  // Solo la casa amplía su serie: otro no puede emitir a nombre de la casa.
  await assert.rejects(eje.escribir({ autor: 'otro', sobre: eje.alta('otro').id, t: T0, movimientos: [gastaT('otro'), { token: 'E', denominacion: 'plaza', emisor: 'casa', cantidad: 1, de: null, a: 'casa' }], payload: 'amplío la serie ajena' }), /E is minted by and to its issuer|la emisión de E va a su propio emisor/);
  assert.equal(eje.serie('E:casa/plaza').emitido, 2);
});

test('TOK-29 nadie emite una serie ajena: la R se emite a su propio emisor', async () => {
  await assert.rejects(Eje.genesis({ demostracion: true, identidad: 'raiz', emision: [...EMISION, { token: 'R', cantidad: 5, emisor: 'otra' }], foco: 'x', t: T0 }), /la emisión de R va a su propio emisor/);
  const { eje, g } = await mundo();
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: g, t: T0, movimientos: [gastaT('ana'), { token: 'R', cantidad: 1, emisor: 'raiz', de: null, a: 'raiz' }], payload: 'x' }));
});

test('TOK-29b nadie emite una denominación de E ajena: ni el génesis amplía la serie de otro', async () => {
  const eje = await Eje.genesis({ demostracion: true, identidad: 'raiz', emision: EMISION, foco: 'x', t: T0 });
  const g = eje.genesisId;
  // La casa que emite es una persona: entra por invitación y emite con R suya emitida (encargo 3b, mapa §15 [D]).
  for (const id of ['casa']) await entrarPorInvitacion(eje, { por: 'raiz', quien: id, t: T0 });
  // Sobre su propia alta: sobre el génesis (el alta de la raíz) pagaría su atención (revisión de seguridad, encargo 3b).
  await eje.escribir({ autor: 'casa', sobre: eje.alta('casa').id, t: T0, movimientos: [gastaT('casa'), ...rEnJuego('casa'), { token: 'E', denominacion: 'plaza', emisor: 'casa', cantidad: 1, de: null, a: 'casa' }], payload: 'plaza' });
  await assert.rejects(eje.escribir({ autor: 'raiz', sobre: g, t: T0, movimientos: [gastaT('raiz'), ...rEnJuego('raiz', 'casa'), { token: 'E', denominacion: 'plaza', emisor: 'casa', cantidad: 1, de: null, a: 'casa' }], payload: 'plaza ajena' }), /(E is minted by and to|R is minted by) its issuer/);
  // Lo que la raíz llame «plaza» es su propia serie (E:raiz/plaza): la de la casa no cambia.
  await eje.escribir({ autor: 'raiz', sobre: g, t: T0, movimientos: [gastaT('raiz'), ...rEnJuego('raiz', 'casa'), { token: 'E', denominacion: 'plaza', emisor: 'raiz', cantidad: 1, de: null, a: 'raiz' }], payload: 'plaza de la raíz' });
  assert.deepEqual([eje.serie('E:casa/plaza').emitido, eje.serie('E:raiz/plaza').emitido], [1, 1]);
});

test('TOK-30 la capacidad es una serie limitada de quien respalda el recurso; la reserva la mueve de la casa al huésped', async () => {
  // Ya no se salta (encargo 3b; VG, 8-11, mapa §15 [D] «Una sola operación: registrar»): no la mueve el huésped; la mueve la casa, porque es suya (TOK-35).
  const { eje, c } = await reservaDelHuesped();
  assert.equal(eje.saldo('casa', 'E:casa/plaza'), 0);
  assert.equal(cerrado(eje, c.id).cerrado, true);
});

test('TOK-31 la plaza es una posición donde las reservas colisionan; la segunda solapada se escribe pero no se mueve por saldo', async () => {
  // Con la casa como génesis y autora de las propuestas; el huésped que reserva es TOK-30.
  const { eje, hab } = await casaConUnaPlaza();
  const { c: r1, pedido: p1 } = await reservaDeLaCasa(eje, hab, 'h1');
  const { c: r2, pedido: p2 } = await reservaDeLaCasa(eje, hab, 'h2');
  const enLaPlaza = ocupantes(eje, hab, [1, 4]).map((o) => o.evento);
  assert.ok(enLaPlaza.includes(p1.id) && enLaPlaza.includes(p2.id)); // se ven todas
  await cumplir(eje, r1.id, 'casa');
  await assert.rejects(cumplir(eje, r2.id, 'casa'), /saldo insuficiente/);
  assert.ok(eje.obtener(r2.id)); // escrita sigue
  assert.equal(cerrado(eje, r2.id).cerrado, false);
});

// =====================================================================
// Tokens · P y R
// =====================================================================

test('TOK-32 P es poder con ámbito: no existe un P total', async () => {
  const { eje, g } = await mundo();
  assert.ok(validarMovimiento({ token: 'P', cantidad: 1, de: 'raiz', a: 'ana' }).some((e) => /P exige ámbito/.test(e)));
  await assert.rejects(eje.escribir({ autor: 'raiz', sobre: g, t: T0, movimientos: [gastaT('raiz'), { token: 'P', cantidad: 1, de: 'raiz', a: 'ana' }], payload: 'x' }), /ámbito/);
  const sub = await escribe(eje, g, 'subárbol');
  const enG = eje.poderSobre('ana', g);
  await eje.escribir({ autor: 'raiz', sobre: g, t: T0, movimientos: [gastaT('raiz'), { token: 'P', cantidad: 2, ambito: sub.id, de: 'raiz', a: 'ana' }], payload: 'delegación' });
  assert.equal(eje.poderSobre('ana', sub.id), 2);
  assert.equal(eje.poderSobre('ana', g), enG); // P sobre un subárbol no es P sobre el todo
  assert.ok(eje.poderes('ana').every((p) => Boolean(eje.obtener(p.ambito)))); // cada P, con su registro de ámbito
  await assert.rejects(eje.escribir({ autor: 'raiz', sobre: g, t: T0, movimientos: [gastaT('raiz'), { token: 'P', cantidad: 1, ambito: 'genesis', de: 'raiz', a: 'ana' }], payload: 'x' }), /P moves within a known scope/);
});

// Encargo 3b (VG, 8-11, mapa §15 [D] (4) y (5)): se retira autorizar con umbral; lo que queda es el recuento del
// dueño, que cuenta el P que cada persona compromete con X (bloqueado con la salida = X), no el que tiene.
test('TOK-34 P no es un permiso automático: tener P no cuenta en el recuento hasta que se compromete', async () => {
  const { eje, g } = await mundo();
  const decision = await eje.escribir({ autor: 'raiz', sobre: g, t: T0, movimientos: [gastaT('raiz')], payload: ['¿Compramos?', ['x'], [['decidir'], ['x'], ['threshold'], ['raiz']]] });
  assert.ok(eje.poderSobre('raiz', g) > 0); // tiene P…
  assert.equal(recuento(eje, decision.id).pasa, false); // …pero tenerlo no cuenta
  await eje.escribir({ autor: 'raiz', sobre: decision.id, t: T0, payload: 'sí', movimientos: [gastaT('raiz'), { token: 'P', ambito: g, cantidad: 10, de: 'raiz', a: 'raiz', estado: 'bloqueo', salida: decision.id }] });
  assert.equal(recuento(eje, decision.id).pasa, true);
});

test('TOK-35 nadie mueve tokens ajenos: todo movimiento con origen sale del autor', async () => {
  const { eje, g } = await mundo();
  await assert.rejects(eje.escribir({ autor: 'bea', sobre: g, t: T0, movimientos: [gastaT('bea'), daE('ana', 'bea', 1)], payload: 'x' }), /nobody moves tokens of others/);
  // Tampoco dentro de una propuesta: lo anunciado de otro lo mueve ese otro (VG, 8-11, mapa §15 [D] «Una sola operación: registrar»).
  const { c } = await anunciada(eje, g);
  await assert.rejects(registrar(eje, { autor: 'ana', sobre: c.id, t: T0, movimientos: [gastaT('ana'), daE('raiz', 'ana', 1)], payload: 'x' }), /nobody moves tokens of others/);
});

test('TOK-37 PV8 no emite P por subir de posición ni por reunir registros', async () => {
  const { eje, g } = await mundo();
  const a = await escribe(eje, g, ['A', 'mucho', 'contenido'], undefined, 'ana');
  // Ana tiene el P que obtuvo al escribir (10 sobre cada registro suyo: VG, 8-11, mapa §15 [D]); reunir apoyos no le da más.
  const poderes = JSON.stringify(eje.poderes('ana'));
  for (let k = 0; k < 3; k++) await escribe(eje, a.id, 'apoyo ' + k, undefined, 'bea');
  assert.equal(JSON.stringify(eje.poderes('ana')), poderes);
  const antes = huella(eje);
  // VG, 7-11 noche: se retira comparar(); leer el 8 (aquí, el respaldo al vuelo: no hay base escrita) no escribe ni emite.
  assert.equal(situar(eje, a.id, { respaldo: true }).medidas.escritos.foco, 3);
  assert.equal(huella(eje), antes);
  assert.equal(JSON.stringify(eje.poderes('ana')), poderes);
});

test('TOK-38 R se cuenta por emisor y no es popularidad: se transfiere sin cambiar de emisor', async () => {
  // Encargo 3b (VG, 9-11, mapa §15 [D] «R según el corpus» y «R, últimas dos»): se corrige «R no es fungible» (#62):
  // R se transfiere libremente entre tenedores sin cambiar de emisor; lo que vale para un tercero es de su lente.
  const { eje, g } = await mundo();
  const deRaiz = (id) => eje.reputaciones(id).find((r) => r.emisor === 'raiz')?.cantidad ?? 0;
  const [ana0, bea0] = [deRaiz('ana'), deRaiz('bea')]; // la unidad que les guardó la invitación
  await eje.escribir({ autor: 'raiz', sobre: g, t: T0, movimientos: [gastaT('raiz'), { token: 'R', cantidad: 3, emisor: 'raiz', de: 'raiz', a: 'ana' }], payload: 'buen trato' });
  assert.equal(deRaiz('ana'), ana0 + 3);
  await eje.escribir({ autor: 'ana', sobre: g, t: T0, movimientos: [gastaT('ana'), { token: 'R', cantidad: 1, emisor: 'raiz', de: 'ana', a: 'bea' }], payload: 'te paso una' });
  assert.deepEqual([deRaiz('ana'), deRaiz('bea')], [ana0 + 2, bea0 + 1]); // sigue siendo R de la raíz
  assert.equal(eje.reputaciones('bea').some((r) => r.emisor === 'ana'), false);
  const antes = deRaiz('ana');
  for (let k = 0; k < 3; k++) await escribe(eje, g, 'me gusta ana ' + k, undefined, 'bea'); // la popularidad no es R
  assert.equal(deRaiz('ana'), antes);
});

test('TOK-41 PV3 no es R: comunicar no emite reputación', async () => {
  const { eje, g } = await mundo();
  const antes = eje.reputaciones('ana');
  // En el 3 de un registro suyo: en el de otro, la atención tiene precio (VG, 9-11, mapa §16 [D] «PV3 = regla de atención»).
  const tablon = await escribe(eje, g, 'mi tablón', undefined, 'ana');
  const msg = await escribirDesde(eje, { modo: 'pointed', autor: 'ana', sobre: tablon.id, en: '3000000000', payload: 'hola a todos', t: T0 });
  assert.deepEqual(msg.movimientos.map((m) => m.token), ['T']);
  assert.deepEqual(eje.reputaciones('ana'), antes);
});

test('TOK-42 la R viaja en un evento con su contexto: se sabe quién la dio, cuándo y por qué', async () => {
  const { eje, g } = await mundo();
  // Sin contar el alta de ana, que recoge la R que le guardó su invitación (encargo 3b, mapa §16 [D]).
  const previos = new Set([...eje.eventos.values()].filter((e) => e.movimientos.some((m) => m.token === 'R' && m.a === 'ana')).map((e) => e.id));
  const ev = await eje.escribir({ autor: 'raiz', sobre: g, t: T0, movimientos: [gastaT('raiz'), { token: 'R', cantidad: 2, emisor: 'raiz', de: 'raiz', a: 'ana' }], payload: ['Reconocimiento', 'entregó a tiempo'] });
  const conR = [...eje.eventos.values()].filter((e) => !previos.has(e.id) && e.movimientos.some((m) => m.token === 'R' && m.a === 'ana'));
  assert.deepEqual(conR.map((e) => [e.autor, e.payload[1]]), [['raiz', 'entregó a tiempo']]);
  assert.equal(conR[0].id, ev.id);
});

test('TOK-42b la R enlaza con historial, compromisos, juicios y evidencias',
  { skip: 'TOK-42: R es una cantidad por emisor; su único contexto es el payload del evento que la mueve, sin enlace a evidencias' },
  sinForma('TOK-42'));

test('TOK-43 los tokens recorren los diez PV: cualquier evento, en cualquier posición, puede mover cualquier familia', async () => {
  const { eje, g } = await mundo(['Foco', 'a', 'b', 'c', 'd', 'e', 'f', 'g']);
  // P con su ámbito, un registro (mapa §15 [D]); P y R, relativos a lo que ana ya tiene (el P que obtiene y la R de su invitación).
  const [p0, r0] = [eje.poderSobre('ana', g), eje.saldo('ana', 'R:raiz')];
  await eje.escribir({ autor: 'raiz', sobre: g, en: '3000000000', t: T0, movimientos: [gastaT('raiz'), daE('raiz', 'ana', 1)], payload: 'E en el 3' });
  await eje.escribir({ autor: 'raiz', sobre: g, en: '1000000000', t: T0, movimientos: [gastaT('raiz'), { token: 'P', cantidad: 1, ambito: g, de: 'raiz', a: 'ana' }], payload: 'P en el 1' });
  await eje.escribir({ autor: 'raiz', sobre: g, en: '7000000000', t: T0, movimientos: [gastaT('raiz'), { token: 'R', cantidad: 1, emisor: 'raiz', de: 'raiz', a: 'ana' }], payload: 'R en el 7' });
  await eje.escribir({ autor: 'raiz', sobre: g, en: '2000000000', t: T0, movimientos: [gastaT('raiz'), daT('raiz', 'ana', 5)], payload: 'T en el 2' });
  assert.equal(eje.saldo('ana', 'E:raiz/EUR'), 51);
  // El P que le da la raíz es de origen raíz (encargo 3b-bis); lo que obtiene ana al recibir E, T y R, suyo.
  assert.equal(eje.poderSobre('ana', g, 'raiz'), 1);
  assert.ok(eje.poderSobre('ana', g) >= p0 + 1);
  assert.equal(eje.saldo('ana', 'R:raiz'), r0 + 1);
});

test('TOK-47 se ven los tokens: P por ámbito y R por emisor, separados de los recursos', async () => {
  const { eje, g } = await mundo();
  // P con su ámbito, un registro (mapa §15 [D]); relativos a lo que ana ya tiene.
  // El P que da la raíz conserva su origen (encargo 3b-bis): una serie aparte de la que ana obtiene sobre el génesis.
  const p = () => eje.poderes('ana').find((x) => x.ambito === g && x.origen === 'raiz')?.cantidad ?? 0;
  const r = () => eje.reputaciones('ana').find((x) => x.emisor === 'raiz')?.cantidad ?? 0;
  const [p0, r0] = [p(), r()];
  await eje.escribir({ autor: 'raiz', sobre: g, t: T0, movimientos: [gastaT('raiz'), { token: 'P', cantidad: 1, ambito: g, de: 'raiz', a: 'ana' }, { token: 'R', cantidad: 1, emisor: 'raiz', de: 'raiz', a: 'ana' }], payload: 'x' });
  assert.deepEqual([p(), r()], [p0 + 1, r0 + 1]);
  assert.ok(eje.poderes('ana').every((x) => Object.keys(x).sort().join() === 'ambito,cantidad,origen'));
  assert.ok(eje.reputaciones('ana').every((x) => Object.keys(x).sort().join() === 'cantidad,emisor'));
  assert.equal(eje.saldo('ana', 'E:raiz/EUR'), 50);
});

test('TOK-47b se ven todas las denominaciones de E y todas las escalas de T', async () => {
  const { eje } = await mundo();
  // T no cruza de persona (VG, 7-11 noche): ana no recibió T; los 300 minutos que la raíz le cedió son E:raiz/minuto.
  assert.deepEqual(eje.tiempos('ana'), []);
  // Ni la raíz tiene T explícito (VG, 8-11: no hay T acumulable): cada escala se ve por su asignación del día.
  assert.deepEqual(eje.tiempos('raiz'), []);
  assert.ok(tokens.ESCALAS_REALES.every((e) => eje.saldoT('raiz', e, T0) > 0));
  assert.deepEqual(eje.recursos('ana'), [{ emisor: 'raiz', denominacion: 'minuto', cantidad: 300 }, { emisor: 'raiz', denominacion: 'EUR', cantidad: 50 }]); // cada serie de E con su emisor
});

test('TOK-48 los cuatro tokens tienen mecanismos efectivos: T paga la escritura, P cuenta en el recuento, R va por emisor, E se mueve al registrar lo anunciado', async () => {
  const { eje, g } = await mundo();
  // T (VG, 7-11 noche; Core, 8-11): pobre es una cosa, y la raíz (una persona) le da un minuto de su T. Cada
  // escritura lo consume y queda anotada en el registro que la soporta; una cosa no tiene asignación: sin T no escribe.
  // Pobre escribe sobre su alta (la escribió la raíz): sobre el génesis, el alta de la raíz, pagaría su atención (revisión de seguridad, encargo 3b).
  const altaPobre = await eje.escribir({ autor: 'raiz', sobre: g, t: T0, movimientos: [gastaT('raiz'), { token: 'T', escala: 'minuto', cantidad: 1, de: 'raiz', a: 'pobre' }], payload: 'alta con un minuto' });
  const antes = eje.tiempoSobre(altaPobre.id).minuto ?? 0;
  await escribe(eje, altaPobre.id, 'una', undefined, 'pobre');
  await assert.rejects(escribe(eje, altaPobre.id, 'otra', undefined, 'pobre'), /saldo insuficiente de T:minuto en pobre/); // T
  assert.equal(eje.tiempoSobre(altaPobre.id).minuto, antes + 1);
  // P (encargo 3b, VG, 8-11, mapa §15 [D] «Una sola operación: registrar»; mapa §15 [D] (5)): se retira autorizar; el P comprometido cuenta en el recuento del dueño.
  const decision = await eje.escribir({ autor: 'raiz', sobre: g, t: T0, movimientos: [gastaT('raiz')], payload: ['¿Compramos?', ['x'], [['decidir'], ['x'], ['threshold'], ['raiz']]] });
  assert.equal(recuento(eje, decision.id).pasa, false);
  await eje.escribir({ autor: 'raiz', sobre: decision.id, t: T0, payload: 'sí', movimientos: [gastaT('raiz'), { token: 'P', ambito: g, cantidad: 10, de: 'raiz', a: 'raiz', estado: 'bloqueo', salida: decision.id }] });
  assert.equal(recuento(eje, decision.id).pasa, true); // P
  // R: pasa de mano y sigue siendo de su emisor (VG, 9-11, mapa §15 [D] «R según el corpus»).
  await eje.escribir({ autor: 'ana', sobre: g, t: T0, movimientos: [gastaT('ana'), { token: 'R', cantidad: 1, emisor: 'raiz', de: 'ana', a: 'bea' }], payload: 'te paso mi R de la raíz' });
  assert.equal(eje.saldo('bea', 'R:raiz'), 2); // la de su invitación y esta
  // E: se mueve con el registro que mueve lo anunciado.
  const c = await consolidar(eje, { autor: 'ana', foco: g, t: T0, elecciones: { 1: 'x' } });
  await registrar(eje, { autor: 'ana', sobre: c.id, en: ANUNCIO, t: T0, movimientos: [gastaT('ana')], payload: anuncio('E:raiz/EUR', 10, 'pagar', 'ana', 'bea') });
  await cumplir(eje, c.id, 'ana');
  assert.equal(eje.saldo('bea', 'E:raiz/EUR'), 10); // E
});

test('TOK-48b los cuatro tokens tienen presencia visible, no solo cifras',
  { skip: 'TOK-48: desde la #50 los movimientos de un evento nuevo se ven en el mundo de los hilos (mundos/hilos.js: un punto por movimiento de «de» a «a», con un color por familia, tentativo), pero solo al animarse; en reposo los saldos siguen siendo cifras por identidad (ui/saldos.js) y los demás mundos no existen todavía' },
  sinForma('TOK-48'));

test('TOK-49 P, R y T no se reducen a dinero ni a puntuación', async () => {
  const { eje, g } = await mundo();
  const antes = eje.saldo('ana', 'E:raiz/EUR');
  await eje.escribir({ autor: 'raiz', sobre: g, t: T0, movimientos: [gastaT('raiz'), daT('raiz', 'ana', 10), { token: 'P', cantidad: 1, ambito: g, de: 'raiz', a: 'ana' }, { token: 'R', cantidad: 1, emisor: 'raiz', de: 'raiz', a: 'ana' }], payload: 'x' });
  assert.equal(eje.saldo('ana', 'E:raiz/EUR'), antes); // nada se convierte en E
  assert.ok([...eje.saldos.get('ana').keys()].every((k) => /^(T|E:|P:|R:)/.test(k))); // ni hay una cifra total
  assert.equal(typeof eje.total, 'undefined');
});

test('TOK-50 más transferencias no son más riqueza: mover tokens no es progreso automático', async () => {
  const { eje, g } = await mundo();
  const padre = await escribe(eje, g, 'padre');
  const a = await escribe(eje, padre.id, 'igual', undefined, 'ana');
  await eje.escribir({ autor: 'raiz', sobre: padre.id, t: T0, movimientos: [gastaT('raiz'), daT('raiz', 'ana', 1), daT('raiz', 'bea', 1), daE('raiz', 'ana', 1)], payload: 'igual' });
  // VG, 7-11 noche: se retira comparar() y su puntuación con pesos, y el 8 solo sitúa cantidades (R7): mover más
  // veces no da caja; los movimientos son un recuento informativo. Por cantidad, las dos comparten caja de T.
  const c = confluir(eje, a.id);
  assert.ok(!('posicion' in c) && !('puntuacion' in c) && c.comparables.every((x) => !('puntuacion' in x)));
  assert.deepEqual([c.medidas.movimientos.foco, c.medidas.movimientos.maximo, c.medidas.movimientos.recuento, 'caja' in c.medidas.movimientos], [1, 4, true, false]);
  assert.equal(c.tokens['T:minuto'].enCaja, 2);
});

test('TOK-54 ninguna organización es imprescindible para participar: los tokens pasan de unas identidades a otras', async () => {
  const { eje, g } = await mundo();
  // Cris entra por invitación de ana, no de la raíz (encargo 3b, VG, 9-11, mapa §16 [D] «El árbol mínimo es la invitación»).
  await entrarPorInvitacion(eje, { por: 'ana', quien: 'cris', t: T0 });
  await eje.escribir({ autor: 'ana', sobre: g, t: T0, movimientos: [gastaT('ana'), daT('ana', 'cris', 5, 'raiz'), daE('ana', 'cris', 5)], payload: 'ana da a cris' });
  // Cris escribe sobre su propia alta: no está en el equipo de la raíz y sobre el génesis pagaría su atención (revisión de seguridad, encargo 3b).
  const ev = await escribe(eje, eje.alta('cris').id, 'cris participa', undefined, 'cris');
  assert.equal(ev.autor, 'cris');
  assert.equal(eje.saldo('cris', 'E:raiz/EUR'), 5);
});

test('TOK-54b una identidad que no es el génesis puede emitir sus propias series', async () => {
  const { eje, g } = await mundo();
  // E es el último escalón: ana emite R suya (sin colateral) y da una a bea, y emite E sobre un registro suyo, donde
  // tiene el P que obtuvo al escribirlo (encargo 3b, VG, 8-11 y 9-11, mapa §15 [D]: nadie acuña P a mano).
  const suyo = await escribe(eje, g, 'mis clases', undefined, 'ana');
  await eje.escribir({ autor: 'ana', sobre: suyo.id, t: T0, payload: 'mi reputación y mis horas de clase', movimientos: [gastaT('ana'),
    { token: 'R', cantidad: 6, emisor: 'ana', de: null, a: 'ana' }, { token: 'R', cantidad: 1, emisor: 'ana', de: 'ana', a: 'bea' },
    { token: 'E', denominacion: 'horas de clase', emisor: 'ana', cantidad: 3, de: null, a: 'ana' }] });
  assert.equal(eje.saldo('ana', 'R:ana'), 5); // 6 − 1 a bea
  assert.equal(eje.saldo('ana', 'E:ana/horas de clase'), 3);
});

test('TOK-54c ninguna organización permanente es imprescindible: T y P no dependen solo de la primera identidad', async () => {
  // VG, 8-11: cada persona tiene su T, la asignación diaria, y obtiene su P al escribir sus registros (mapa §15 [D]:
  // 10 sobre cada registro propio; se retira el P del génesis).
  const { eje, g } = await mundo();
  const unaHoraDespues = '2026-11-07T11:00:00Z';
  await eje.escribir({ autor: 'ana', sobre: g, t: unaHoraDespues, payload: 'mi tiempo', movimientos: [gastaT('ana')] });
  assert.equal(eje.saldoT('ana', 'minuto', unaHoraDespues) <= 1439, true); // su asignación del día, menos lo gastado
  const suyo = await escribe(eje, g, 'mi taller', undefined, 'ana', unaHoraDespues);
  assert.equal(eje.poderSobre('ana', suyo.id), 10);
  assert.equal(eje.poderSobre('raiz', suyo.id), 0);
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: suyo.id, t: unaHoraDespues, payload: 'más poder', movimientos: [gastaT('ana'), { token: 'P', ambito: suyo.id, cantidad: 2, de: null, a: 'ana' }] }), /P is repositioned one step at a time/);
});

test('TOK-55 las alternativas descentralizadas se ofrecen por defecto («multinacional de autónomos»)',
  { skip: 'TOK-55: no hay ningún mecanismo para ello' },
  sinForma('TOK-55'));

test('TOK-56 el génesis es la emisión inicial a la primera identidad, con un foco raíz y sin T (VG, 8-11: no hay T acumulable)', async () => {
  const { eje, g } = await mundo();
  const gen = eje.obtener(g);
  assert.ok(gen.movimientos.every((m) => m.de === null && m.a === 'raiz'));
  assert.ok(!gen.movimientos.some((m) => m.token === 'T'));
  assert.equal(gen.sobre, null);
});

test('TOK-56b un génesis reconstruido solo vale si todo son emisiones a su autor', async () => {
  const emitir = (a) => ({ token: 'T', escala: 'minuto', cantidad: 60, de: null, a });
  const conMallory = await crearEvento({ autor: 'raiz', sobre: null, t: T0, movimientos: [emitir('raiz'), daE('mallory', 'raiz', 50)], payload: 'x', contexto: { genesis: true } });
  await assert.rejects(Eje.desde([conMallory]));
  const aOtraT = await crearEvento({ autor: 'raiz', sobre: null, t: T0, movimientos: [emitir('raiz'), emitir('otra')], payload: 'x', contexto: { genesis: true } });
  await assert.rejects(Eje.desde([aOtraT]));
  const aOtra = await crearEvento({ autor: 'raiz', sobre: null, t: T0, movimientos: [emitir('raiz'), { token: 'P', cantidad: 1, ambito: 'genesis', de: null, a: 'otra' }], payload: 'x', contexto: { genesis: true } });
  await assert.rejects(Eje.desde([aOtra]));
});

test('TOK-57 una identidad existe cuando tiene alta: una persona escribe la suya (B1); a una cosa la da de alta su dueño, con su clave en el mismo evento', async () => {
  const { eje, g } = await mundo();
  assert.equal(eje.identidades().includes('dani'), false);
  // Una persona entra aceptando una invitación (encargo 3b, VG, 9-11, mapa §16 [D] «El árbol mínimo es la invitación»):
  // se retira B1 (escribir sin cuenta era escribir el alta).
  await assert.rejects(escribe(eje, g, 'x', undefined, 'dani'), /a person joins by an invitation/);
  await entrarPorInvitacion(eje, { por: 'ana', quien: 'dani', t: T0 });
  assert.ok(eje.identidades().includes('dani'));
  assert.equal(eje.esPersona('dani'), true);
  // Una cosa la da de alta otra identidad, que declara su clave en el mismo evento.
  const robot = await generarClaves();
  await eje.escribir({ autor: 'raiz', sobre: g, t: T0, movimientos: [gastaT('raiz'), daT('raiz', 'robot', 10)], payload: 'alta del robot', contexto: { claves: { robot: robot.publica } } });
  assert.ok(eje.identidades().includes('robot'));
  assert.equal(eje.esPersona('robot'), false);
  assert.deepEqual(eje.clave('robot'), robot.publica);
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

test('TOK-59b también mover lo anunciado paga un minuto por posición', async () => {
  const { eje, g } = await mundo();
  const { c } = await anunciada(eje, g);
  const e = await cumplir(eje, c.id, 'ana'); // lo que era ejecutar (VG, 8-11, mapa §15 [D] «Una sola operación: registrar»)
  assert.equal(minutosDe(e), contarPosiciones(e.payload));
  assert.equal(minutosDe(e), 1);
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
  const { c } = await anunciada(eje, g, { 1: 'x' });
  const lee = () => [huella(eje), cerrado(eje, c.id).cerrado, JSON.stringify(siguiente(eje, c.id, 'bea'))];
  const antes = lee();
  const generosa = { nombre: 'generosa', ordinal: () => true, reglaCorta: () => 'todo autorizado' };
  leerDireccion(c.en, generosa);
  decupla(c, generosa);
  ocupantes(eje, g, [4], { epoca: generosa });
  assert.deepEqual(lee(), antes);
});

test('TOK-71 el cambio de época compone aportaciones de varias ramas en vez de elegir una ganadora',
  { skip: 'TOK-71: no implementado. Terreno de src/epocas.js (otro agente): no se toca aquí' },
  sinForma('TOK-71'));

// =====================================================================
// Fronteras
// =====================================================================

test('TOK-72 AGRAM no firma por nadie: la firma la pone el autor con su clave', async () => {
  const { eje, g } = await mundo();
  const { c, a } = await anunciada(eje, g);
  const e = await cumplir(eje, c.id, 'ana');
  for (const ev of [c, a, e]) assert.equal(ev.firma, undefined); // sin clave del autor, nada firmado
  const ana = await generarClaves();
  const eje2 = await Eje.genesis({ demostracion: true, identidad: 'ana', emision: EMISION, foco: ['F', 'a'], t: T0, clave: ana.publica, privada: ana.privada });
  const c2 = await consolidar(eje2, { autor: 'ana', foco: eje2.genesisId, t: T0, elecciones: { 1: 'x' } }, ana.privada);
  assert.equal(c2.firmante, 'ana');
  assert.equal(await verificar(c2, ana.publica), true);
});

test('TOK-72b AGRAM no genera por sí mismo pagos ni ejecuciones: invoca servicios autorizados',
  { skip: 'TOK-72: registrar mueve tokens dentro del eje (VG, 8-11, mapa §15 [D] «Una sola operación: registrar»). Lo decide el mapa §12 (7-11): AARPIA es el motor real de autorización y ejecución, y lo del motor es un hueco provisional; AARPIA queda fuera por decisión de VG (MOT-41, TOK-74)' },
  sinForma('TOK-72'));

test('TOK-73 el motor no tiene regla de autorización: una sola operación, registrar, y lecturas', async () => {
  // Encargo 3b (VG, 8-11, mapa §15 [D] «Una sola operación: registrar»): se retira el hueco provisional (puedeAutorizar); nadie autoriza lo ajeno, porque cada uno solo
  // mueve lo suyo, y lo que queda en el motor son lecturas de la cadena.
  for (const n of ['autorizar', 'ejecutar', 'puedeAutorizar', 'autorizacionesValidas', 'estadoDe', 'consolidaciones']) assert.equal(n in motor, false, n);
  const { eje, g } = await mundo();
  const nota = await registrar(eje, { autor: 'ana', sobre: g, t: T0, movimientos: [gastaT('ana')], payload: 'registrar es escribir' });
  assert.equal(eje.obtener(nota.id).autor, 'ana');
  const antes = huella(eje);
  for (const lectura of [cerrado, recuento]) lectura(eje, nota.id);
  siguiente(eje, nota.id, 'bea');
  assert.equal(huella(eje), antes);
});

test('TOK-73b una frontera con AARPIA, el motor real de autorización y ejecución',
  { skip: 'TOK-73: ya no hay regla provisional en el motor (TOK-73); la frontera con AARPIA no existe' },
  sinForma('TOK-73'));

test('TOK-74 fuera quedan AARPIA, Nostr y Bitcoin, salvo instancias y transiciones', async () => {
  const { eje, g } = await mundo();
  for (const [f, especificador] of importsDeSrc()) assert.equal(/nostr|bitcoin|stateark|aarpia/i.test(especificador), false, f);
  // Una instancia con sus transiciones: el génesis no mueve nada (encargo 3b), y su emisión es la transacción siguiente.
  const ev = eje.obtener(eje.orden[1]);
  assert.equal(ev.autor, 'raiz');
  assert.ok(Array.isArray(ev.movimientos) && ev.movimientos.length > 0);
});

test('TOK-75 firmar no hace verdadero el contenido, y publicar no hace a un evento descubrible por todos', async () => {
  const raiz = await generarClaves();
  const crear = () => Eje.genesis({ demostracion: true, identidad: 'raiz', emision: EMISION, foco: 'x', t: T0, clave: raiz.publica, privada: raiz.privada });
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
  const { c } = await anunciada(eje, g, undefined, 1);
  await cumplir(eje, c.id, 'ana');
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
  const eje = await Eje.genesis({ demostracion: true, identidad: 'raiz', emision: EMISION, foco: 'x', t: T0, clave: raiz.publica, privada: raiz.privada });
  const g = eje.genesisId;
  await assert.rejects(eje.escribir({ autor: 'raiz', sobre: g, en: '4', t: T0, movimientos: [gastaT('raiz')], payload: 'x' }, raiz.privada), /en debe ser/); // forma
  const bueno = await firmar(await crearEvento({ autor: 'raiz', sobre: g, t: T0, movimientos: [gastaT('raiz')], payload: 'x' }), raiz.privada);
  await assert.rejects(eje.anadir({ ...bueno, payload: 'y' }), /id no corresponde/); // id
  await assert.rejects(eje.anadir({ ...bueno, firma: bueno.firma.slice(0, -4) + 'AAAA' }), /firma inválida/); // firma
  await assert.rejects(eje.escribir({ autor: 'raiz', sobre: g, t: T0, movimientos: [gastaT('raiz'), daE('raiz', 'raiz', 1e7, 'minuto')], payload: 'x' }, raiz.privada), /saldo insuficiente/); // saldos (T se acuña al gastarse; E no)
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
//   MOT-42 [decidido VG, 8-11] se retira autorizar (mapa §15 [D] «Una sola operación: registrar»): nadie autoriza lo
//                      ajeno; cada uno mueve lo suyo, y comprometer P con X (bloquearlo con la salida = X) solo cuenta en
//                      el recuento del dueño (TOK-34). Sustituye la del 7-11 noche (bloquear P con umbral).
//   MOT-45 [abierto]   qué ejecuciones necesitan la autorización de otra identidad («cuando corresponda»).
//   MOT-52 [abierto]   si C exige que antes haya habido Q y B (hoy consolidar no lo exige).
//   MOT-53 [propuesta] que el orden cambie el resultado depende del contexto; no es un axioma «siempre diferentes».
//   MOT-60 [abierto]   si la proporción por modo es un tope o una banda con mínimo, y si obliga a autorizar y ejecutar.
//   MOT-66 [propuesta] un registro rechazado no produce efectos económicos; una respuesta provisional no es autorización
//                      (hoy eje.validar simula y, si algo falla, nada cambia).
//
// Serie de tokens
//   TOK-10 [decidido]  quién tiene T de cada escala: cada persona, su asignación diaria (VG, 8-11); solo el génesis lo emite
//                      (VG, 7-11 noche; src/ciclo.js). El génesis sigue emitiendo T, y eso no cuenta para el tope.
//   TOK-13 [propuesta] la escala que muestra la interfaz y el presupuesto real de trabajo son dos controles distintos.
//   TOK-15 [propuesta] año nativo = 13 ciclos de 28 días + 1 día fuera de ciclos (hoy solo como duración).
//   TOK-17 [abierto]   años bisiestos y sincronización con el calendario civil.
//   TOK-18 [abierto]   uso del día fuera de ciclos y su vínculo con el token anual y la elección de época.
//   TOK-22 [propuesta] cada banda más lejana ocupa unos dos tercios del espacio de la anterior.
//   TOK-33 [abierto]   qué es un ámbito de P: un área (P_Derecho) o el subárbol de un registro (hoy, el subárbol).
//   TOK-36 [abierto]   la delegación de P (hoy hacia un ámbito igual o más estrecho).
//   TOK-39 [decidido VG, 9-11] R se transfiere libremente entre tenedores sin cambiar de emisor (mapa §15 [D]; TOK-38).
//   TOK-40 [propuesta] emisión de R en doble entrada, con conservación al liquidar, bloqueo y aceptación (7-11 noche: hay obligaciones del emisor y bloqueo con salida; la aceptación no).
//   TOK-44 [propuesta] en PV2, luz/E, calor/P, agua/R y vida/T como metáfora visual flexible.
//   TOK-45 [propuesta] en PV3 los tokens condicionan paquetes, atención y pagos por comunicación.
//   TOK-46 [propuesta] en PV4 los tokens representan producción desagregada.
//   TOK-51 [abierto]   emisión, transferencia, conservación, precios, derechos, microeconomía y liquidación.
//   TOK-52 [propuesta] kernel V10: Value con siete relaciones y las primitivas ISSUE, TRANSFER, LOCK, RELEASE, CONSUME (7-11 noche: LOCK y RELEASE son el estado bloqueo/liberacion de un movimiento).
//   TOK-53 [propuesta] T cubre presupuestos, reservas, bloqueos, ventanas y respaldo; el T futuro no emitido no es valor bloqueado.
//   TOK-67 [abierto]   legitimidad y selección del tronco; compatibilidad histórica.
