// Encargo 3c-2a: las acciones del aro (src/acciones.js, docs/CONTRATO.md «Acciones»). Principio (VG): nada hardcodeado
// en la pantalla ni negocio en JavaScript que pueda ser una regla o un dato de la época: cada acción es una plantilla
// de transacción de la época (epoch.9.6), su 2 dice cuándo se ofrece, su 4 qué mueve y su 5 dónde ancla. Y los datos
// que VG decidió tras el 3b-bis: los seis grupos de R son seis precios, P por mirada, la orientación de una E es el
// token que la paga y los pasos de un proceso se tipan por token (la lectura «stage»).

import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { Eje } from '../src/eje.js';
import { crearEvento } from '../src/evento.js';
import { evaluar } from '../src/bqlm.js';
import { ContextoEje } from '../src/contexto-eje.js';
import { EPOCA_0_BTML, cargarEpocaBtml } from '../src/epocas.js';
import { EPOCA_0_BTML_DATOS, REGLAS_DE_EPOCA_DATOS, PLANTILLAS_DE_EPOCA_DATOS, CORRECCIONES_DE_EPOCA_DATOS } from '../datos/epocas/epocas.js';
import * as A from '../src/acciones.js';
import * as C from '../src/contrato.js';
import { recuento, cerrado, peso, ANUNCIO } from '../src/motor.js';
import { ejemploCompra, ejemploFabrica } from '../ejemplos/ikisai/compra-food.mjs';
import { ejemploReserva } from '../ejemplos/ikisai/reserva-booking.mjs';
import { ejemploTarea } from '../ejemplos/ikisai/tarea-tasks.mjs';
import { entrarPorInvitacion } from '../ejemplos/ikisai/altas.mjs';
import { raizDeAmbito } from '../src/tokens.js';
import { generarClaves, firmar as firmarEvento } from '../src/autoridad.js';
import { costeT, exigido, tDelCoste } from '../src/escritura.js';
import { pagaElCoste } from './ayudas-coste.js';

const T0 = '2026-11-08T10:00:00Z';
const T1 = '2026-11-08T12:00:00Z';
const minuto = (de, cantidad) => (cantidad === undefined ? pagaElCoste(de) : { token: 'T', escala: 'minuto', cantidad, de, a: null });
const R = (emisor, cantidad, de, a) => ({ token: 'R', emisor, cantidad, de, a });
const nombres = (lista) => lista.map((x) => x.nombre);
const movs = (ev) => ev.movimientos.map((m) => [m.token, m.cantidad, m.de, m.a]);
/** El coste de escribir una candidata (VG 12-11, decisión 7: la regla «the cost of writing», un minuto por posición; antes, un minuto copiado). */
const coste = (ev) => ['T', costeT(ev.payload), ev.autor, null];

/** Una copia de la época 0 con cambios: lo que el aro ofrece ha de cambiar con ella. */
function epocaCon(cambiar) {
  const e = JSON.parse(JSON.stringify(EPOCA_0_BTML_DATOS));
  const plantillas = JSON.parse(JSON.stringify(PLANTILLAS_DE_EPOCA_DATOS));
  cambiar(e, plantillas);
  return cargarEpocaBtml(e, { registros: REGLAS_DE_EPOCA_DATOS, plantillas, correcciones: CORRECCIONES_DE_EPOCA_DATOS, id: EPOCA_0_BTML.id });
}

/**
 * g escribe el génesis y emite su R y sus vales; invita a seis personas, una por grupo: ana (desconocidos, zona 0),
 * bea (comercial, 1), carla (expertos, 2), dani (cercanos, 3), eli (equipo, 4) y fer (vetados, 5); los grupos 1, 2, 4 y
 * 5 los nombra g anclando en el 3.k.3 de su alta (el génesis); dani entra por una invitación con grupo 3.
 */
async function mundoDeGrupos() {
  const eje = await Eje.genesis({ demostracion: true, identidad: 'g', t: T0, foco: ['raíz'], emision: [{ token: 'R', cantidad: 10 }, { token: 'E', denominacion: 'vale', cantidad: 100 }] });
  for (const quien of ['ana', 'bea', 'carla', 'eli', 'fer']) await entrarPorInvitacion(eje, { por: 'g', quien, t: T0 });
  await entrarPorInvitacion(eje, { por: 'g', quien: 'dani', t: T0, grupo: 3 });
  const g = eje.genesisId;
  for (const [zona, quien] of [[1, 'bea'], [2, 'carla'], [4, 'eli'], [5, 'fer']]) {
    await eje.escribir({ autor: 'g', sobre: g, en: '3' + zona + '30000000', t: T0, payload: [quien], movimientos: [minuto('g')] });
  }
  // bea tiene vales (E) para pagar; carla, P sobre el dominio de g (el 3 del génesis, por la R de su invitación).
  await eje.escribir({ autor: 'g', sobre: g, t: T0, payload: 'vales', movimientos: [minuto('g'), { token: 'E', emisor: 'g', denominacion: 'vale', cantidad: 3, de: 'g', a: 'bea' }] });
  const plaza = await eje.escribir({ autor: 'g', sobre: g, t: T0, payload: ['Plaza de g', ['x'], ['all announced movements happened']], movimientos: [minuto('g')] });
  return { eje, g, plaza };
}

// ---------- 1. qué ofrece el aro ----------

test('acciones: lo que el aro ofrece a cada identidad en cada PV lo dicen las plantillas de la época (su 2 con it = X y me); la primera de cada PV es la acción por defecto', async () => {
  const { eje, menu, alta } = await ejemploCompra();
  const de = (yo, k, X = menu.id) => nombres(A.acciones(eje, X, k, yo));
  // La huésped, sobre el menú: puede darle E (apply a resource, por defecto) y escribirle a su dueña (write to X).
  assert.equal(de('huesped', 1)[0], 'apply a resource');
  assert.ok(de('huesped', 3).includes('write to X'));
  assert.ok(A.acciones(eje, menu.id, 1, 'huesped')[0].porDefecto && !A.acciones(eje, menu.id, 1, 'huesped')[1]?.porDefecto);
  // La cocina, dueña del menú (tiene P sobre él por escribirlo): emite E atada a él, declara su capacidad y mide.
  assert.ok(de('cocina', 1).includes('issue E tied to X'));
  assert.ok(de('cocina', 2).includes('declare capacity or threshold'));
  assert.ok(de('cocina', 8).includes('measure'));
  // La casa, sobre el menú, ni emite ni mide (no tiene P sobre él); sobre su propio registro de altas, sí.
  assert.ok(!de('casa', 1).includes('issue E tied to X') && !de('casa', 8).includes('measure'));
  assert.ok(de('casa', 1, alta.id).includes('issue E tied to X') && de('casa', 2, alta.id).includes('declare capacity or threshold') && de('casa', 8, alta.id).includes('measure'));
  // Nadie se escribe a sí mismo: la cocina no ve «write to X» sobre su menú.
  assert.ok(!de('cocina', 3).includes('write to X'));
  // Los nueve puntos de vista con acciones: 1, 2, 3, 4, 6, 7, 8, 9 (el 0 y el 5 no tienen); cada acción dice qué parámetros pide y cuáles faltan.
  assert.deepEqual([0, 5].map((k) => de('huesped', k)), [[], []]);
  const aplica = A.acciones(eje, menu.id, 1, 'huesped')[0];
  assert.deepEqual(aplica.parametros.map((p) => [p.nombre, p.falta]), [['what', false], ['quantity', false], ['price', true], ['criteria', false], ['who', false], ['actions', false], ['type', false]], 'el menú no tiene serie: el precio lo da quien lanza');
  assert.deepEqual([aplica.parametros[1].valor, aplica.parametros[4].valor, aplica.parametros[6].valor], [1, ['huesped', 'cocina'], 'purchase']);
  // Lo que solo lee y lo que lanza el camino se marcan como tales (su 4: read, path).
  assert.ok(A.acciones(eje, menu.id, 6, 'huesped').find((a) => a.nombre === 'view thread').lectura);
  assert.ok(A.acciones(eje, menu.id, 9, 'huesped').find((a) => a.nombre === 'follow the path').camino);
  // El veto lo dice el 2: si la cocina veta a la huésped (3.5.3 de su alta), «write to X» desaparece.
  await eje.escribir({ autor: 'cocina', sobre: eje.alta('cocina').id, en: '3530000000', t: T1, payload: ['huesped'], movimientos: [minuto('cocina')] });
  assert.ok(!de('huesped', 3).includes('write to X'));
  // Nada decidido en JS: cambiar el 2 de una plantilla en una copia de la época cambia lo que se ofrece.
  const sinAplicar = epocaCon((e, plantillas) => { plantillas.find((p) => p.registro[0][0] === 'apply a resource').registro[2] = ['=1 = 2']; });
  assert.ok(!nombres(A.acciones(eje, menu.id, 1, 'huesped', { epoca: sinAplicar })).includes('apply a resource'));
  assert.equal(A.plantillasDeTransaccion().length, 42);
  // el 0: la configuración del sitio (encargo pv3, #37 y #38: no está en el aro; la abre el interrogante del sitio)
  assert.deepEqual([...new Set(A.plantillasDeTransaccion().map((p) => p.pv))].sort(), [0, 1, 2, 3, 4, 6, 7, 8, 9]);
  assert.deepEqual(A.plantillasDeTransaccion().filter((p) => p.pv === 0).map((p) => p.nombre), ['set a minimum', 'set a minimum rank', 'configure a place']);
});

// ---------- 2. construir, validar y asentar ----------

test('transaccion: una compra entera por el aro (acciones → transaccion → asentar): el registro es una «purchase» válida y la cocina cobra', async () => {
  const { eje, menu, compra } = await ejemploCompra();
  const antes = eje.saldo('cocina', 'E:casa/EUR');
  const r = await A.transaccion(eje, 'apply a resource', { X: menu.id, quantity: 2, price: [['E:casa/EUR'], [12]] }, 'huesped', { t: T1 });
  assert.deepEqual(r.motivos, []);
  assert.equal(r.ok, true);
  assert.deepEqual(movs(r.evento), [coste(r.evento), ['E', 24, 'huesped', 'cocina']], 'el coste de escribir (un minuto por posición) y el precio por la cantidad, de quien lanza al dueño de X');
  assert.deepEqual([movs(r.evento)[0][1], r.exigido], [10, 600], 'diez posiciones, diez minutos (600 segundos exigidos)');
  assert.deepEqual([r.evento.sobre, r.evento.en], [menu.id, '0000000000']);
  assert.deepEqual(r.evento.payload.slice(1), [[[{ ref: menu.id }], [2], [['E:casa/EUR'], [12]]], ['all announced movements happened'], ['huesped', 'cocina'], ['apply a resource'], ['purchase']]);
  assert.match(r.evento.payload[0], /^apply a resource: huesped gives 24 E:casa\/EUR to cocina for Menú del día$/);
  assert.equal(eje.obtener(r.evento.id), undefined, 'transaccion no asienta');
  assert.deepEqual(C.validar(eje, r.evento), [], 'la plantilla de datos «purchase» la valida');
  const hecho = await eje.anadir(r.evento);
  assert.equal(eje.saldo('cocina', 'E:casa/EUR'), antes + 24);
  assert.equal(C.nombreDePlantilla(C.plantilla(eje, hecho.id)), 'purchase');
  assert.equal(cerrado(eje, hecho.id).cerrado, true);
  assert.equal(eje.poderSobre('huesped', hecho.id), 10, 'escribirla le da diez P');
  // El aro la recuerda: la plantilla de la compra original también se puede relanzar (los parámetros por defecto vienen del aro).
  const [aplica] = A.acciones(eje, menu.id, 1, 'huesped');
  const r2 = await A.transaccion(eje, aplica.plantilla, { X: menu.id, price: [['E:casa/EUR'], [12]] }, 'huesped', { t: T1 });
  assert.equal(r2.ok, true);
  void compra;
});

test('transaccion: los motivos legibles, en el idioma de quien lanza (los parámetros con su ayuda; las reglas con su 9 traducido; el libro con su texto)', async () => {
  const { eje, menu } = await ejemploCompra();
  // Un parámetro que no cumple su validación, y uno que falta.
  const mal = await A.transaccion(eje, 'apply a resource', { X: menu.id, quantity: 0, price: [['E:casa/EUR'], [12]] }, 'huesped', { t: T1, idioma: 'en' });
  assert.deepEqual([mal.ok, mal.evento, mal.motivos], [false, null, [{ regla: 'quantity', mensaje: 'quantity: how many units', parametro: 'quantity' }]]);
  const sin = await A.transaccion(eje, 'apply a resource', { X: menu.id }, 'huesped', { t: T1, idioma: 'en' });
  assert.deepEqual(sin.motivos.map((m) => m.regla), ['price']);
  // Una regla de la época, en español (la configuración de la cocina lo pide): la cocina es una cosa y no acuña.
  await eje.escribir({ autor: 'cocina', sobre: eje.alta('cocina').id, en: '9000000000', t: T1, movimientos: [minuto('cocina')], payload: ['preferences', 10, 'sober', 'es', [1, 2, 3], 'preferences'] });
  assert.equal(C.configuracion(eje, 'cocina').language, 'es');
  const emite = await A.transaccion(eje, 'issue E tied to X', { X: menu.id, denomination: 'racion', quantity: 5 }, 'cocina', { t: T1 });
  assert.equal(emite.ok, false);
  assert.ok(emite.motivos.some((m) => m.regla === 'only persons mint' && m.mensaje === 'only persons mint: cocina es una cosa (su alta la escribió casa), y solo acuñan las personas'), JSON.stringify(emite.motivos));
  assert.ok(emite.motivos.some((m) => m.regla === 'minting E needs own R issued' && /nunca ha emitido R propia/.test(m.mensaje)));
  // El mismo motivo en inglés si se pide.
  const en = await A.transaccion(eje, 'issue E tied to X', { X: menu.id, denomination: 'racion', quantity: 5 }, 'cocina', { t: T1, idioma: 'en' });
  assert.ok(en.motivos.some((m) => m.mensaje === 'only persons mint: cocina is a thing (its alta was written by casa), and only persons mint'));
  // Lo que rechaza el libro (la aritmética) llega con su texto: diez raciones a doce euros son más de lo que tiene la huésped.
  const w = await A.transaccion(eje, 'apply a resource', { X: menu.id, quantity: 10, price: [['E:casa/EUR'], [12]] }, 'huesped', { t: T1 });
  assert.deepEqual([w.ok, w.motivos], [false, [{ regla: null, mensaje: 'saldo insuficiente de E:casa/EUR en huesped' }]]);
  // Una plantilla desconocida, o X que no está en el libro.
  assert.equal((await A.transaccion(eje, 'fly', { X: menu.id }, 'huesped')).ok, false);
  assert.equal((await A.transaccion(eje, 'apply a resource', { X: 'f'.repeat(64) }, 'huesped')).ok, false);
});

// ---------- 3. los seis grupos de R son seis precios ----------

test('write to X: la R es el precio universal (VG, 12-11, encargo pv3): los cinco grupos cobran lo mismo, quien tiene R del destinatario la devuelve y quien no, pone la suya; el vetado no llega', async () => {
  const { eje, g, plaza } = await mundoDeGrupos();
  await entrarPorInvitacion(eje, { por: 'ana', quien: 'gus', t: T0 }); // un desconocido para g: lo invitó ana, no tiene R de g
  const ctx = new ContextoEje(eje, { epoch: EPOCA_0_BTML });
  assert.deepEqual(evaluar('("g").3 each 2.0', ctx).valor, ['their R', 'their R', 'their R', 'their R', 'their R', 'nothing'], 'un solo precio (y el veto)');
  const escribe = (yo) => A.transaccion(eje, 'write to X', { X: plaza.id, text: 'hola g' }, yo, { t: T1 });
  // Quien tiene R de g (se la guardó la invitación) paga devolviéndosela, en cualquier grupo: cerrar el canal es devolver.
  const de = {};
  for (const quien of ['ana', 'bea', 'carla', 'dani', 'eli']) {
    de[quien] = await escribe(quien);
    assert.deepEqual([de[quien].ok, movs(de[quien].evento), de[quien].evento.movimientos[1].emisor], [true, [coste(de[quien].evento), ['R', 1, quien, 'g']], 'g'], quien);
  }
  assert.deepEqual([de.ana.evento.sobre, de.ana.evento.en], [g, '3000000000'], 'anclado en el 3 del alta del destinatario');
  assert.deepEqual(de.ana.evento.payload, [['hola g'], ['their R', 1], [{ ref: plaza.id }], ['ana', 'g'], ['write to X']]);
  // Un desconocido sin R de g pone la suya, acuñada en la misma transacción: es la bandeja de g (su 3.0).
  const gus = await escribe('gus');
  assert.deepEqual([gus.ok, movs(gus.evento).slice(1), gus.evento.movimientos[2].emisor], [true, [['R', 1, null, 'gus'], ['R', 1, 'gus', 'g']], 'gus']);
  // Vetados: no se ofrece, y lanzada a mano la rechaza la regla (el veto gana sobre cualquier R).
  assert.ok(!nombres(A.acciones(eje, plaza.id, 3, 'fer')).includes('write to X'));
  const fer = await escribe('fer');
  assert.deepEqual([fer.ok, fer.motivos.map((m) => m.regla)], [false, ['attention has a price']]);
  // Las lecturas que lo dicen: el grupo (X.6.3) y el precio (X.6.2) de cada candidata.
  for (const [r, zona, precio] of [[de.ana, 0, 'their R'], [de.bea, 1, 'their R'], [de.carla, 2, 'their R'], [de.dani, 3, 'their R'], [de.eli, 4, 'their R'], [gus, 0, 'their R'], [fer, 5, 'nothing']]) {
    const c = new ContextoEje(eje, { ev: r.evento, epoch: EPOCA_0_BTML });
    assert.deepEqual([evaluar('first ev.6.3', c).valor[0], evaluar('first ev.6.2.0', c).valor[0]], [zona, precio]);
  }
  // Y se asientan: cada mensaje pasa por las reglas de siempre.
  for (const r of [...Object.values(de), gus]) await eje.anadir(r.evento);
  assert.equal(eje.saldo('g', 'R:gus'), 1);
  // El dueño aún puede cambiar el precio de un grupo con «set a group price» (el 3.k.2 de su alta): los desconocidos pagan ahora con P.
  const precio = await A.transaccion(eje, 'set a group price', { X: g, token: 'P', amount: 1, zone: 0 }, 'g', { t: T1 });
  assert.deepEqual([precio.ok, precio.evento.sobre, precio.evento.en, precio.evento.payload], [true, g, '3020000000', [['P'], [1]]]);
  await eje.anadir(precio.evento);
  const ana2 = await escribe('ana');
  assert.deepEqual([ana2.ok, movs(ana2.evento)[1]?.[0]], [true, 'P']);
});

test('encargo pv3: atender devuelve la R que trae el mensaje; quitar, vetar y llevar a un grupo son plantillas del 3; los mínimos y la configuración del sitio, del 0 (la cruceta del nodo)', async () => {
  const { eje, g } = await mundoDeGrupos();
  await entrarPorInvitacion(eje, { por: 'ana', quien: 'gus', t: T0 });
  const lanzar = async (nombre, X, valores, yo) => {
    const r = await A.transaccion(eje, nombre, { X, ...valores }, yo, { t: T1 });
    assert.equal(r.ok, true, nombre + ': ' + JSON.stringify(r.motivos));
    return eje.anadir(r.evento);
  };
  // gus (sin R de g) escribe con su R; g lo atiende: la devuelve (la regla es la misma en los dos sentidos).
  const msg = await lanzar('write to X', g, { text: 'hola' }, 'gus');
  assert.ok(nombres(A.acciones(eje, msg.id, 3, 'g')).includes('attend'));
  const at = await lanzar('attend', msg.id, {}, 'g');
  assert.deepEqual(movs(at).slice(1), [['R', 1, 'g', 'gus']]);
  assert.equal(at.movimientos[1].emisor, 'gus');
  // Vetar ancla la identidad en el 3.5.3 del alta de quien veta; llevar a un grupo, en el 3.<zona>.3.
  const altaGus = eje.alta('gus').id;
  assert.deepEqual(['veto someone', 'move to group'].map((n) => nombres(A.acciones(eje, altaGus, 3, 'g')).includes(n)), [true, true]);
  const llevar = await lanzar('move to group', altaGus, { zone: 2 }, 'g');
  assert.deepEqual([llevar.sobre, llevar.en, llevar.payload], [g, '3230000000', [['gus']]]);
  const veto = await lanzar('veto someone', altaGus, {}, 'g');
  assert.deepEqual([veto.sobre, veto.en, veto.payload], [g, '3530000000', [['gus']]]);
  assert.equal((await A.transaccion(eje, 'write to X', { X: g, text: 'otra' }, 'gus', { t: T1 })).ok, false, 'el vetado ya no llega');
  // Quitar: en el 3 de un registro mío, con la identidad en su 3.1; no mueve más que el T de escribir.
  const plaza = await eje.escribir({ autor: 'g', sobre: g, t: T0, payload: ['Plaza'], movimientos: [minuto('g')] });
  const quitar = await lanzar('remove someone', plaza.id, { whom: 'ana' }, 'g');
  assert.deepEqual([quitar.en, quitar.payload[3], movs(quitar)], ['3000000000', [['g'], ['ana']], [coste(quitar)]]);
  assert.equal(nombres(A.acciones(eje, plaza.id, 3, 'ana')).includes('remove someone'), false, 'solo el dueño quita');
  // Los mínimos y la configuración: PV 0 (no en el aro), sobre lo mío, anclados en el nodo X.3.d.
  assert.deepEqual(nombres(A.acciones(eje, g, 0, 'g')), ['set a minimum', 'set a minimum rank', 'configure a place']);
  assert.deepEqual(nombres(A.acciones(eje, g, 0, 'ana')), []);
  const minimo = await lanzar('set a minimum', g, { box: 3, amount: 2 }, 'g');
  assert.deepEqual([minimo.en, minimo.payload], ['3310000000', [[2]]]);
  const rango = await lanzar('set a minimum rank', g, { box: 2, rank: '3.1' }, 'g');
  assert.deepEqual([rango.en, rango.payload], ['3280000000', [['3.1'], ['up']]]);
  const guia = await lanzar('configure a place', g, { place: '3.4', position: 9, value: 'lo del equipo' }, 'g');
  assert.equal(guia.en, '3490000000');
  // La cruceta del nodo 3.4 (el personaje del sitio): sus diez posiciones, con su nombre, su valor y la acción que la pone.
  const s = A.sitio(eje, g, '3.4', 'g', { idioma: 'es' });
  assert.deepEqual(s.posiciones.map((p) => p.posicion), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual([s.posiciones[1].nombre, s.posiciones[1].accion.nombre, s.posiciones[1].accion.valores], ['cuánto', 'set a minimum', { box: 4 }]);
  assert.deepEqual([s.posiciones[8].accion.nombre, s.posiciones[8].accion.valores], ['set a minimum rank', { box: 4 }]);
  assert.deepEqual([s.posiciones[9].nombre, s.posiciones[9].valor, s.posiciones[9].accion.valores], ['cómo', ['lo del equipo'], { place: '3.4', position: 9 }]);
  assert.deepEqual(A.sitio(eje, g, '3.3', 'g').posiciones[1].valor, [2], 'el mínimo de la caja 3');
  assert.ok(A.sitio(eje, g, '3.4', 'ana').posiciones.every((p) => p.accion === null), 'quien no es el dueño lo ve, pero no lo toca');
});

// ---------- 4. P por mirada ----------

test('P por mirada: conseguir E coloca en r.1 y recibir R en el 3 del alta del emisor; una decisión cuenta el P de r y el de su mirada, no el de otras', async () => {
  const { eje, menu, compra } = await ejemploCompra();
  const g = eje.genesisId;
  // La huésped: diez por la R de la casa (sobre el 3 del génesis), 600 por sus 60 EUR (sobre el 1), diez por su alta y por su compra (enteros).
  const y = C.yo(eje, 'huesped');
  assert.deepEqual(y.criterio.posicionado.filter((p) => p.registro === g).map((p) => [p.mirada, p.cuanto]), [[3, 10], [1, 600]]);
  assert.deepEqual(y.criterio.posicionado.filter((p) => p.registro === compra.id).map((p) => [p.mirada, p.cuanto]), [[undefined, 10]]);
  assert.deepEqual([eje.poderSobre('huesped', g), eje.poderSobre('huesped', g, undefined, 1), eje.poderSobre('huesped', g, undefined, 3), eje.poderSobre('huesped', g, undefined, 2)], [610, 600, 10, 0]);
  const ctx = new ContextoEje(eje, { epoch: EPOCA_0_BTML });
  assert.deepEqual(evaluar('(("huesped").2.1 where it.0 = "' + g + '") each 5', ctx).valor, [3, 1], 'A.2.1: una entrada por ámbito, con la mirada en su 5');
  assert.deepEqual(evaluar('(("huesped").1 where P in it.0.0.0 and it.0.0.1 = "' + g + '") each 0.0.5', ctx).valor, [3, 1], 'D-SERIE: la mirada en el 0.5 de la serie');
  // La casa decide sobre la mirada 1 del génesis (su E): el P de la huésped sobre el 1 cuenta; sobre la mirada 3, no.
  const decide = (vista) => eje.escribir({ autor: 'casa', sobre: g, t: T1, payload: ['¿Subimos el menú?', ['x'], [['decidir'], ['x'], ['weighted sum', 'view ' + vista], ['cualquiera']]], movimientos: [minuto('casa')] });
  const D1 = await decide(1);
  const D3 = await decide(3);
  const compromete = (D) => A.transaccion(eje, 'commit P', { X: D.id, power: 'P:' + g + '.1/huesped', amount: 600 }, 'huesped', { t: T1 });
  const c1 = await compromete(D1);
  assert.equal(c1.ok, true, JSON.stringify(c1.motivos));
  assert.deepEqual(c1.evento.movimientos[1], { token: 'P', ambito: g + '.1', origen: 'huesped', cantidad: 600, de: 'huesped', a: 'huesped', estado: 'bloqueo', salida: D1.id });
  await eje.anadir(c1.evento);
  assert.deepEqual([recuento(eje, D1.id).valor, recuento(eje, D1.id).pasa], [600, true], 'sobre la mirada 1 cuenta el P de r.1 (por cantidad: «cualquiera»)');
  // Liberarlo y comprometerlo con la decisión sobre la mirada 3: pesa cero.
  await eje.escribir({ autor: 'huesped', sobre: D3.id, t: T1, payload: 'cambio', movimientos: [minuto('huesped'), { token: 'P', ambito: g + '.1', cantidad: 600, de: 'huesped', a: 'huesped', estado: 'liberacion', salida: D1.id }, { token: 'P', ambito: g + '.1', cantidad: 600, de: 'huesped', a: 'huesped', estado: 'bloqueo', salida: D3.id }] });
  assert.deepEqual([recuento(eje, D3.id).valor, recuento(eje, D3.id).pasa], [0, false], 'sobre la mirada 3 no cuenta el P de r.1');
  // El P del registro entero cuenta en las dos: la casa compromete sus diez del génesis con D3.
  await eje.escribir({ autor: 'casa', sobre: g, t: T1, payload: 'sí', movimientos: [minuto('casa'), { token: 'P', ambito: g, cantidad: 10, de: 'casa', a: 'casa', estado: 'bloqueo', salida: D3.id }] });
  assert.equal(recuento(eje, D3.id).valor, 10);
  // El peso (la lectura «share») también sabe de miradas: todo lo de la huésped sobre el génesis, o lo que pesa en una mirada.
  const total = eje.obtenidoPor('huesped').reduce((s, x) => s + x.cantidad, 0); // todo lo que obtuvo cuelga del génesis: el dominio de la casa
  assert.ok(Math.abs(peso(eje, 'huesped', g) - 610 / total) < 1e-9 && Math.abs(peso(eje, 'huesped', g, 3) - 10 / total) < 1e-9 && Math.abs(peso(eje, 'huesped', g, 1) - 600 / total) < 1e-9, 'su 100 % en el dominio de la casa: todo lo del génesis, o lo que pesa en una mirada');
  // Reposicionar hacia una mirada es un paso (bajar); de la mirada al entero, otro (subir); de una mirada a otra, dos.
  const repos = (movimientos) => eje.validar({ autor: 'huesped', sobre: menu.id, t: T1, payload: 'repos', movimientos: [minuto('huesped'), ...movimientos] }).then((m) => m.filter((x) => /repositioned/.test(x)));
  const P = (ambito, cantidad, de, a) => ({ token: 'P', ambito, cantidad, de, a });
  assert.deepEqual(await repos([P(compra.id, 10, 'huesped', null), P(compra.id + '.1', 11, null, 'huesped')]), [], 'del registro a su mirada: bajar');
  assert.deepEqual(await repos([P(g + '.3', 10, 'huesped', null), P(g, 1, null, 'huesped')]), [], 'de la mirada al registro: subir');
  assert.equal((await repos([P(g + '.3', 10, 'huesped', null), P(g + '.1', 1, null, 'huesped')])).length, 1, 'de una mirada a otra son dos pasos');
  assert.equal((await repos([P(g + '.3', 10, 'huesped', null), P(eje.alta('huesped').id, 1, null, 'huesped')])).length, 1, 'de una mirada a un hijo del registro, también');
  // «minting E needs P on its record» admite el P en r o en r.1: la huésped acuña E atada al génesis con su P del 1.
  const vale = await eje.validar(await crearEvento({ autor: 'huesped', sobre: menu.id, t: T1, payload: 'vale', movimientos: [minuto('huesped'), R('huesped', 1, null, 'huesped'), { token: 'E', emisor: 'huesped', denominacion: 'vale', registro: g, cantidad: 1, de: null, a: 'huesped' }] }));
  assert.deepEqual(vale, []);
});

// ---------- 5. la orientación de una E es el token que la paga ----------

test('el precio de una serie de E: su emisión lo declara (precio y precios), la serie lo da en su 2.2, y «apply a resource» lo lee; sin declarar, el de la época', async () => {
  const { eje, menu } = await ejemploCompra();
  const g = eje.genesisId;
  const ctx = () => new ContextoEje(eje, { epoch: EPOCA_0_BTML });
  // Sin declarar: el de la primera orientación (una unidad de E).
  assert.deepEqual(evaluar('(before.4.("E:casa/EUR")).2.2', ctx()).texto, '[["E"],[1]]');
  assert.deepEqual([0, 1, 2, 3].map((k) => evaluar('epoch.1.0.1.' + k + '.2.0', ctx()).valor[0]), ['E', 'P', 'R', 'T'], 'las cuatro orientaciones, cuatro tokens');
  // La casa escribe su taller y emite una serie atada a él que se paga con horas de T (dos por unidad) o con euros.
  const taller = await eje.escribir({ autor: 'casa', sobre: g, t: T1, payload: ['Taller de la casa', ['x'], ['all announced movements happened']], movimientos: [minuto('casa')] });
  const emision = await eje.escribir({ autor: 'casa', sobre: taller.id, t: T1, payload: 'plazas del taller', movimientos: [minuto('casa'), { token: 'E', emisor: 'casa', denominacion: 'plaza-taller', registro: taller.id, cantidad: 4, de: null, a: 'casa', precio: ['T:hora', 2], precios: [['T:hora', 2], ['E:casa/EUR', 15]] }] });
  const clave = 'E:casa/plaza-taller@' + taller.id;
  assert.deepEqual([eje.serie(clave).precio, eje.serie(clave).precios], [['T:hora', 2], [['T:hora', 2], ['E:casa/EUR', 15]]]);
  assert.deepEqual(evaluar('(before.4.("' + clave + '")).2.2 each 0', ctx()).valor, ['T:hora', 'E:casa/EUR'], 'el principal primero, luego los aceptados');
  assert.deepEqual(evaluar('(("' + taller.id + '").1 where count it.0.2.2 > 0) each 0.2.2.1', ctx()).valor, [2, 15]);
  // El aro lee ese precio: la huésped pide una plaza del taller y paga con su tiempo.
  const [aplica] = A.acciones(eje, taller.id, 1, 'huesped');
  assert.deepEqual([aplica.nombre, aplica.parametros.find((p) => p.nombre === 'price').valor], ['apply a resource', [['T:hora'], [2]]]);
  const r = await A.transaccion(eje, 'apply a resource', { X: taller.id, quantity: 2 }, 'huesped', { t: T1 });
  assert.deepEqual(r.evento.movimientos[1], { token: 'T', escala: 'hora', cantidad: 4, de: 'huesped', a: 'casa' });
  // Las reglas de siempre deciden si pasa: T no cruza de persona (la casa es una persona), y la regla lo dice.
  assert.deepEqual([r.ok, r.motivos.map((m) => m.regla)], [false, ['T only goes to things']]);
  // Con el precio aceptado en euros, pasa.
  const eur = await A.transaccion(eje, 'apply a resource', { X: taller.id, quantity: 2, price: [['E:casa/EUR'], [15]] }, 'huesped', { t: T1 });
  assert.deepEqual([eur.ok, eur.evento.movimientos[1].cantidad, eur.evento.movimientos[1].denominacion], [true, 30, 'EUR']);
  // El precio no es forma libre.
  assert.ok(eje.validar({ ...emision, movimientos: [minuto('casa'), { token: 'E', emisor: 'casa', denominacion: 'x', cantidad: 1, de: null, a: 'casa', precio: 'T:hora' }] }).then((m) => m.some((x) => /precio de E es/.test(x))));
  void menu;
});

// ---------- 6. los pasos de un proceso se tipan por token: «stage» ----------

test('stage (X.4.8): lo anunciado y pendiente, por estación (E pagar, P decidir, R atender, T trabajar); la estación nombra la plantilla que lo mueve', async () => {
  const { eje, menu, compra } = await ejemploCompra();
  const g = eje.genesisId;
  // La cocina abre un encargo con tres anuncios: la huésped paga euros (E), le cede poder sobre la compra (P) y la casa devuelve su R a la huésped… no: la huésped devuelve R a la casa (R).
  const encargo = await eje.escribir({ autor: 'cocina', sobre: menu.id, t: T1, payload: ['Encargo', ['x'], ['all announced movements happened'], ['cocina', 'huesped']], movimientos: [minuto('cocina')] });
  const anuncio = (serie, cantidad, que, de, a) => eje.escribir({ autor: 'cocina', sobre: encargo.id, en: ANUNCIO, t: T1, payload: [[serie], [cantidad], [que], [[de], [a]]], movimientos: [minuto('cocina')] });
  const aE = await anuncio('E:casa/EUR', 5, 'pagar', 'huesped', 'cocina');
  const aP = await anuncio('P:' + compra.id + '/huesped', 1, 'decidir', 'huesped', 'cocina');
  const aR = await anuncio('R:casa', 1, 'atender', 'huesped', 'casa');
  const porFamilia = (lista) => Object.fromEntries(lista.map((e) => [e.familia, e]));
  const antes = porFamilia(A.estaciones(eje, encargo.id));
  assert.deepEqual(Object.entries(antes).map(([f, e]) => [f, e.estacion, e.plantilla, e.pendientes.length, e.hechos.length]), [['E', 'pay', 'pay', 1, 0], ['P', 'decide', 'deliver', 1, 0], ['R', 'attend', 'deliver', 1, 0], ['T', 'work', 'deliver', 0, 0]]);
  assert.deepEqual([antes.E.pendientes, antes.P.pendientes, antes.R.pendientes], [[aE.id], [aP.id], [aR.id]]);
  const ctx = new ContextoEje(eje, { epoch: EPOCA_0_BTML });
  assert.equal(evaluar('count ("' + encargo.id + '").4.8', ctx).valor[0], 3, 'la lectura, en el 4.8 del registro');
  assert.deepEqual(evaluar('(("' + encargo.id + '").4.8 where E in (before.4.(first it.0)).0.0) each 5', ctx).valor, [aE.id], 'la familia de un anuncio se busca por su valor en las series del libro (before.4)');
  // El camino de la huésped: tres pasos suyos, uno por estación, con la plantilla que la cumple.
  const c = await A.camino(eje, encargo.id, 'huesped', { t: T1 });
  assert.deepEqual(c.pasos.map((p) => [p.fuente, p.regla, p.hacer?.plantilla, p.espera]), [['reglas', 'stage', 'pay', null], ['reglas', 'stage', 'deliver', null], ['reglas', 'stage', 'deliver', null]]);
  assert.ok(c.pasos.every((p) => /^stage: /.test(p.falta)), 'lo que falta se lee con el 9 de la lectura');
  // Pagar: la plantilla «pay» mueve lo anunciado; después la estación E está hecha.
  const pago = await A.transaccion(eje, 'pay', { X: encargo.id, announcement: { ref: aE.id } }, 'huesped', { t: T1 });
  assert.deepEqual([pago.ok, movs(pago.evento)[1]], [true, ['E', 5, 'huesped', 'cocina']]);
  await eje.anadir(pago.evento);
  const despues = porFamilia(A.estaciones(eje, encargo.id));
  assert.deepEqual([despues.E.hechos, despues.E.pendientes, despues.P.pendientes], [[aE.id], [], [aP.id]]);
  assert.equal(cerrado(eje, encargo.id).cerrado, false);
  // Lo demás, con autoejecutar: entrega el P y la R anunciados y el encargo se cierra.
  const auto = await A.autoejecutar(eje, encargo.id, 'huesped', null, { t: T1 });
  assert.deepEqual([auto.hechos.length, auto.parado], [2, null]);
  assert.equal(cerrado(eje, encargo.id).cerrado, true);
  assert.deepEqual(A.estaciones(eje, encargo.id).map((e) => e.pendientes.length), [0, 0, 0, 0]);
  assert.equal(eje.saldo('cocina', 'P:' + compra.id + '/huesped'), 1);
  assert.deepEqual(A.estacionesDeLaEpoca().map((e) => e.familia + ' ' + e.estacion), ['E pay', 'P decide', 'R attend', 'T work']);
  void g;
});

test('transaccion y autoejecutar: con claves, la candidata se firma antes de validarse (opciones.firmar) y pasa; sin firmar, quien tiene clave ve «who has a key signs»', async () => {
  const claves = { casa: await generarClaves(), cocina: await generarClaves(), huesped: await generarClaves() };
  const { eje, menu } = await ejemploCompra({ claves });
  const firmar = (ev) => firmarEvento(ev, claves.huesped.privada);
  const sin = await A.transaccion(eje, 'apply a resource', { X: menu.id, quantity: 1, price: [['E:casa/EUR'], [12]] }, 'huesped', { t: T1 });
  assert.deepEqual([sin.ok, sin.motivos.map((m) => m.regla)], [false, ['who has a key signs']]);
  const con = await A.transaccion(eje, 'apply a resource', { X: menu.id, quantity: 1, price: [['E:casa/EUR'], [12]] }, 'huesped', { t: T1, firmar });
  assert.equal(con.ok, true, JSON.stringify(con.motivos));
  assert.ok(con.evento.firma, 'el evento vuelve firmado');
  await eje.anadir(con.evento);
  // Autoejecutar con claves: la huésped paga la reserva firmando cada paso.
  const { eje: b, reserva } = await ejemploReserva({ claves: { ...claves, recepcion: await generarClaves() }, confirmar: false });
  const a = await A.autoejecutar(b, reserva.id, 'huesped', firmar, { t: '2026-11-09T09:00:00Z' });
  assert.deepEqual([a.hechos.length, a.parado], [1, null]);
  assert.ok(a.hechos[0].evento.firma);
});

// ---------- 7. el camino ----------

test('camino: la reserva dice a la huésped lo que le falta (pagar) y lo que espera de la casa (las plazas), con la plantilla que lo cumple; autoejecutar lo lanza', async () => {
  const { eje, reserva } = await ejemploReserva({ confirmar: false });
  const t = '2026-11-09T09:00:00Z';
  const h = await A.camino(eje, reserva.id, 'huesped', { t });
  const mios = h.pasos.filter((p) => p.hacer && !p.espera);
  const esperas = h.pasos.filter((p) => p.espera);
  // VG 12-11 (decisión 8): las tres noches van en un anuncio de la casa: una espera, con las tres.
  assert.deepEqual([mios.length, mios[0].hacer.plantilla, esperas.length, [...new Set(esperas.map((p) => p.espera))]], [1, 'pay', 1, ['casa']]);
  assert.match(mios[0].falta, /^stage: .* · pagar 165 E:casa\/EUR huesped → casa$/);
  assert.equal(esperas[0].falta.match(/1 E:casa\/1100000000@2026-11-2\d@/g).length, 3);
  assert.equal(h.niveles, undefined, 'la reserva ya tiene madurez: no hace falta ubicarse');
  // La casa ve lo contrario: un paso suyo (las tres plazas, en una transacción sobre su anuncio) y la espera del pago.
  const c = await A.camino(eje, reserva.id, 'casa', { t });
  assert.deepEqual([c.pasos.filter((p) => p.hacer && !p.espera).map((p) => p.hacer.plantilla), c.pasos.filter((p) => p.espera).map((p) => p.espera)], [['pay'], ['huesped']]);
  // Autoejecutar: la huésped paga, la casa entrega, y la reserva queda cerrada; nadie mueve lo ajeno.
  const a = await A.autoejecutar(eje, reserva.id, 'huesped', null, { t });
  assert.deepEqual([a.hechos.length, a.parado, movs(a.hechos[0].evento)[1]], [1, null, ['E', 165, 'huesped', 'casa']]);
  assert.equal(cerrado(eje, reserva.id).cerrado, false);
  const b = await A.autoejecutar(eje, reserva.id, 'casa', null, { t });
  assert.deepEqual([b.hechos.length, b.parado, b.hechos[0].evento.movimientos.length], [1, null, 4], 'las tres noches en una transacción (con su T)');
  assert.equal(cerrado(eje, reserva.id).cerrado, true);
  assert.deepEqual((await A.camino(eje, reserva.id, 'huesped', { t })).pasos, []);
  // La firma que le pasa la carta se aplica a cada evento antes de asentarlo.
  const { eje: e2, reserva: r2 } = await ejemploReserva({ confirmar: false });
  const firmados = [];
  await A.autoejecutar(e2, r2.id, 'huesped', (ev) => { firmados.push(ev.id); return ev; }, { t });
  assert.equal(firmados.length, 1);
});

test('camino: las sugerencias pasan por las mismas reglas, el orden sigue el criterio del dueño y autoejecutar se detiene en el primer paso que no pasa', async () => {
  const { eje, menu, compra } = await ejemploCompra();
  // Un encargo de la cocina que pide a la huésped más euros de los que tiene.
  const encargo = await eje.escribir({ autor: 'cocina', sobre: menu.id, t: T1, payload: ['Encargo caro', ['x'], ['all announced movements happened'], ['cocina', 'huesped']], movimientos: [minuto('cocina')] });
  await eje.escribir({ autor: 'cocina', sobre: encargo.id, en: ANUNCIO, t: T1, payload: [['E:casa/EUR'], [1000], ['pagar'], [['huesped'], ['cocina']]], movimientos: [minuto('cocina')] });
  const auto = await A.autoejecutar(eje, encargo.id, 'huesped', null, { t: T1 });
  assert.deepEqual([auto.hechos, auto.parado.paso.hacer.plantilla, auto.parado.motivos], [[], 'pay', [{ regla: null, mensaje: 'saldo insuficiente de E:casa/EUR en huesped' }]]);
  // Las sugerencias: un gancho sin LLM; cada una se construye y valida, y queda marcada.
  const sugerencias = () => [{ plantilla: 'anchor here', parametros: { title: 'una nota' } }, { plantilla: 'give own R', parametros: { amount: 1 } }];
  const c = await A.camino(eje, menu.id, 'huesped', { t: T1, sugerencias });
  const s = c.pasos.filter((p) => p.fuente === 'sugerencia');
  assert.deepEqual(s.map((p) => [p.hacer.plantilla, p.pasa]), [['anchor here', true], ['give own R', true]]);
  // El orden: lo que el dueño nombra en el 2.3 de X va delante.
  const X = await eje.escribir({ autor: 'cocina', sobre: menu.id, t: T1, payload: ['Con criterio', ['x'], [['x'], ['x'], ['x'], ['give own R']]], movimientos: [minuto('cocina')] });
  const o = await A.camino(eje, X.id, 'huesped', { t: T1, sugerencias });
  assert.deepEqual(o.pasos.filter((p) => p.fuente === 'sugerencia').map((p) => p.hacer.plantilla), ['give own R', 'anchor here']);
  // Las caducidades próximas son pasos de espera (del emisor) o míos (expire something mine).
  const { eje: b, reserva, habitacion } = await ejemploReserva({ confirmar: false });
  const cad = await A.camino(b, habitacion.id, 'huesped', { t: '2026-11-20T18:00:00Z' });
  assert.ok(cad.pasos.some((p) => p.espera === 'casa' && /expires at 2026-11-21T12:00:00Z/.test(p.falta)), 'la plaza de la primera noche caduca al día siguiente');
  const mia = await A.camino(b, habitacion.id, 'casa', { t: '2026-11-20T18:00:00Z' });
  assert.ok(mia.pasos.some((p) => p.hacer?.plantilla === 'expire something mine'));
  void compra; void reserva;
});

test('el tutorial del alta sale del 9 de la plantilla de identidad: la clave (la regla), los grupos de atención y el primer registro; autoejecutar hace lo que puede y se para en lo que pide algo', async () => {
  const { eje, g } = await mundoDeGrupos();
  await entrarPorInvitacion(eje, { por: 'g', quien: 'nueva', t: T1 });
  const alta = eje.alta('nueva').id;
  const c = await A.camino(eje, alta, 'nueva', { t: T1 });
  const tutorial = c.pasos.filter((p) => p.fuente === 'tutorial');
  assert.deepEqual(tutorial.map((p) => [p.regla ?? p.hacer.plantilla, p.hecho]), [['a key is declared at its alta', false], ['set a group price', false], ['anchor here', false]]);
  assert.match(tutorial[0].falta, /^a key is declared at its alta: /);
  assert.deepEqual(tutorial[1].hacer.parametros, { token: 'my R', amount: 1, zone: 0 });
  assert.equal(tutorial[2].hacer.parametros.title, undefined, 'el primer registro pide un título');
  // Autoejecutar: pone el precio de su primer grupo y se para en el registro, que pide un título.
  const auto = await A.autoejecutar(eje, alta, 'nueva', null, { t: T1 });
  assert.deepEqual([auto.hechos.map((h) => h.paso.hacer.plantilla), auto.parado.paso.hacer.plantilla, auto.parado.motivos.map((m) => m.regla)], [['set a group price'], 'anchor here', ['title']]);
  assert.equal(eje.sobre(alta, '3020000000').length, 1);
  const otra = await A.camino(eje, alta, 'nueva', { t: T1 });
  assert.deepEqual(otra.pasos.filter((p) => p.fuente === 'tutorial').map((p) => p.hecho), [false, true, false]);
  // Con el título, el primer registro pasa, y el tutorial queda hecho.
  const r = await A.transaccion(eje, 'anchor here', { X: alta, title: 'Mi primer registro' }, 'nueva', { t: T1 });
  assert.equal(r.ok, true, JSON.stringify(r.motivos));
  await eje.anadir(r.evento);
  assert.deepEqual((await A.camino(eje, alta, 'nueva', { t: T1 })).pasos.filter((p) => p.fuente === 'tutorial').map((p) => p.hecho), [false, true, true]);
  // El tutorial es dato: en una copia de la época con otro 9, otros pasos.
  const otraEpoca = epocaCon((e) => { e[3][0][9] = ['cómo: su guía', 'give own R']; });
  assert.deepEqual((await A.camino(eje, alta, 'nueva', { t: T1, epoca: otraEpoca })).pasos.filter((p) => p.fuente === 'tutorial').map((p) => p.hacer.plantilla), ['give own R']);
  // Las plantillas que lanzan el camino: «follow the path» construye el primer paso mío; «view thread» solo lee.
  const sigue = await A.transaccion(eje, 'follow the path', { X: g }, 'nueva', { t: T1 });
  assert.equal(sigue.paso, null, 'sobre el génesis, a la nueva no le falta nada');
  const ve = await A.transaccion(eje, 'view thread', { X: g }, 'nueva', { t: T1 });
  assert.deepEqual([ve.ok, ve.evento, ve.lectura.nombre], [true, null, 'view thread']);
});

test('aggregate T engloba lo que cuelga de X en un registro de la fábrica de X con las partes en su 6; la tarea de Tasks se paga por el aro', async () => {
  const { eje, menu, compra } = await ejemploCompra();
  const r = await A.transaccion(eje, 'aggregate T', { X: menu.id }, 'cocina', { t: T1 });
  assert.equal(r.ok, true, JSON.stringify(r.motivos));
  assert.deepEqual([r.evento.sobre, r.evento.en, r.evento.payload[6], r.evento.payload[1]], [menu.id, '4000000000', [{ ref: compra.id }], [3]], 'las dos horas del menú y la de la compra; la parte, la compra');
  // Tasks: la organizadora paga lo anunciado con «pay» en vez de a mano.
  const t = await ejemploTarea({ hasta: 'entregada' });
  const pasos = (await A.camino(t.eje, t.tarea.id, 'organizadora', { t: '2026-11-13T18:00:00Z' })).pasos.filter((p) => p.hacer);
  // Un anuncio con los dos pagos (VG 12-11, decisión 8): un paso, una transacción anclada sobre él.
  assert.deepEqual(pasos.map((p) => p.hacer.plantilla), ['pay']);
  const auto = await A.autoejecutar(t.eje, t.tarea.id, 'organizadora', null, { t: '2026-11-13T18:00:00Z' });
  assert.deepEqual([auto.hechos.length, auto.parado, cerrado(t.eje, t.tarea.id).cerrado, auto.hechos[0].evento.sobre], [1, null, true, t.anuncios[0].id]);
});

test('el índice expone las acciones como espacio de nombres, y el contexto resuelve «me»', async () => {
  const agram = await import('../src/index.js');
  assert.equal(agram.acciones.transaccion, A.transaccion);
  const { eje } = await ejemploCompra();
  const ctx = new ContextoEje(eje, { epoch: EPOCA_0_BTML, me: 'huesped' });
  assert.deepEqual(evaluar('me', ctx).valor, ['huesped']);
  assert.equal(evaluar('count me.3', ctx).valor[0], 6, 'sus grupos de atención');
  assert.equal(evaluar('me.1', new ContextoEje(eje, { epoch: EPOCA_0_BTML })).estado, 'PENDIENTE', 'sin quien mira, no hay me');
});

// ---------- la estación «autorizada» y las ejecuciones de la fábrica (encargo «datos2», issue #11) ----------

test('la estación «autorizada»: la cuarta posición de cada estación de epoch.4.2 dice qué autoriza un anuncio pendiente (el recuento del anuncio); sigue pendiente hasta que se mueve', async () => {
  assert.deepEqual(A.estacionesDeLaEpoca().map((e) => e.autoriza), ['epoch.9.0.0', 'epoch.9.0.0', 'epoch.9.0.0', 'epoch.9.0.0']);
  const c = await ejemploCompra();
  const f = await ejemploFabrica(c.eje, c);
  const est = Object.fromEntries(A.estaciones(c.eje, c.compra.id).map((e) => [e.familia, e]));
  // pagar ya pasó (la compra transfirió los doce euros); servir está respaldado (P comprometido con su anuncio); atender, no
  assert.deepEqual([est.E.hechos, est.T.pendientes, est.T.autorizados, est.R.pendientes, est.R.autorizados], [[f.pagar.id], [f.servir.id], [f.servir.id], [f.atender.id], []]);
  assert.deepEqual([recuento(c.eje, f.servir.id).pasa, recuento(c.eje, f.atender.id).pasa], [true, false]);
  assert.equal(cerrado(c.eje, c.compra.id).cerrado, false, 'autorizada no es ejecutada');
  // sin autorización en la época («-»), ningún autorizado
  const sin = epocaCon((e) => { for (const x of e[4][2]) if (Array.isArray(x) && Array.isArray(x[0])) x[3] = ['-']; });
  assert.deepEqual(A.estacionesDeLaEpoca({ epoca: sin }).map((e) => e.autoriza), [null, null, null, null]);
  assert.deepEqual(A.estaciones(c.eje, c.compra.id, { epoca: sin }).flatMap((e) => e.autorizados), []);
});

test('ejecuciones: lo propio del 4 de X y cada registro anclado en X, con el PV de la plantilla que lo escribió o que lo cumple, la posición que modifica y su estación; lo que no se sabe, a null', async () => {
  const c = await ejemploCompra();
  const f = await ejemploFabrica(c.eje, c);
  const lista = A.ejecuciones(c.eje, c.compra.id);
  const de = (r) => lista.find((x) => x.ocupante?.ref === r.id);
  const pvDe = (nombre) => A.plantillasDeTransaccion().find((p) => p.nombre === nombre).pv;
  assert.deepEqual([f.pagar, f.servir, f.atender].map((r) => [de(r).pv, de(r).posicion, de(r).accion, de(r).estacion]), [[pvDe('pay'), 4, 'pay', 'ejecutada'], [pvDe('deliver'), 4, 'deliver', 'autorizada'], [pvDe('deliver'), 4, 'deliver', 'propuesta']]);
  assert.deepEqual([de(f.capacidad).pv, de(f.capacidad).posicion, de(f.capacidad).accion, de(f.capacidad).estacion], [pvDe('declare capacity or threshold'), 2, 'declare capacity or threshold', null]);
  assert.deepEqual([de(f.nota).pv, de(f.nota).posicion], [pvDe('anchor here'), 0], 'anclar aquí es del 6 y modifica la raíz: fuera de la diagonal');
  // lo propio del 4 de la compra (pagar, servir) no tiene ni tipo ni posición; el respaldo cuelga del anuncio, no de la compra
  assert.deepEqual(lista.filter((x) => !x.ocupante?.ref).map((x) => [x.ocupante, x.pv, x.posicion]), [['pagar', null, null], ['servir', null, null]]);
  assert.equal(de(f.respaldo), undefined);
  // un registro escrito a mano, sin plantilla: su posición sí, su tipo de interacción no
  const nota = await c.eje.escribir({ autor: 'cocina', sobre: c.compra.id, en: '3000000000', t: T1, movimientos: [minuto('cocina')], payload: 'a mano' });
  const otra = A.ejecuciones(c.eje, c.compra.id).find((x) => x.ocupante?.ref === nota.id);
  assert.deepEqual([otra.pv, otra.posicion, otra.accion], [null, 3, null]);
  assert.deepEqual(A.ejecuciones(c.eje, 'no-existe'), []);
});

// ---------- BQL mueve (VG 12-11, estudio BQL-transacciones, decisiones 5 a 8 y 10) ----------

/** Los parámetros que las plantillas no traen por defecto, para lanzarlas sobre los ejemplos. */
const EXTRA = {
  'apply a resource': { price: [['E:casa/EUR'], [2]] },
  'issue E tied to X': { denomination: 'racion' },
  'write to X': { text: 'hola' },
  'commit time': { until: '2026-12-01T00:00:00Z' },
  'declare future T': { what: 'servir', when: '2026-12-01T00:00:00Z' },
};

/**
 * La doble ejecución, cerrada (VG 12-11, decisión 10; fusión de BQL-escritura con PV3): todas las plantillas dieron el
 * mismo evento por la lista de antes (una décupla por movimiento) y por sus sentencias en BQL, y la lista se retiró del
 * 4 de las plantillas y de src/acciones.js. Lo que movía la lista en cada caso quedó escrito, generado con ella antes de
 * retirarla, en test/doble-ejecucion-esperada.json: las sentencias han de seguir moviendo exactamente eso.
 */
const DOBLE = new URL('./doble-ejecucion-esperada.json', import.meta.url);
/** Los ids del libro, por su lugar en el orden del eje (#n): así un caso no depende del id de la época ni del de sus registros. */
const porOrden = (eje, x) => (x === null ? null : JSON.parse(JSON.stringify(x).replace(/[0-9a-f]{64}/g, (id) => '#' + eje.orden.indexOf(id))));

test('doble ejecución (cerrada): las sentencias de cada plantilla mueven lo que movía su lista de antes, sobre los ejemplos (test/doble-ejecucion-esperada.json)', async () => {
  const esperado = JSON.parse(readFileSync(DOBLE, 'utf8'));
  const conLista = A.plantillasDeTransaccion().filter((p) => esperado.plantillas.includes(p.nombre));
  assert.equal(conLista.length, esperado.plantillas.length, 'cada plantilla que tenía lista sigue en la época');
  const iguales = new Map(conLista.map((p) => [p.nombre, 0]));
  const vistos = new Set();
  const comparar = async (ejemplo, eje, cual, params, yo) => {
    const { X, key, ...resto } = params; // la clave de una cosa es nueva en cada vuelta: no entra en el caso
    const clave = [ejemplo, cual, yo, eje.orden.indexOf(X), JSON.stringify(resto)].join(' · ');
    void key;
    vistos.add(clave);
    const r = await A.transaccion(eje, cual, params, yo, { t: T1 });
    assert.deepEqual(porOrden(eje, r.evento ? r.evento.movimientos : null), esperado.casos[clave], clave + ': ' + JSON.stringify(r.motivos));
    return Boolean(r.evento);
  };
  const recorrer = async (ejemplo, eje, X) => {
    for (const yo of eje.identidades()) {
      for (const { nombre, pv } of conLista) {
        if (iguales.get(nombre) >= 2 || !A.acciones(eje, X, pv, yo).some((a) => a.nombre === nombre)) continue;
        if (await comparar(ejemplo, eje, nombre, { X, ...(EXTRA[nombre] ?? {}) }, yo)) iguales.set(nombre, iguales.get(nombre) + 1);
      }
    }
  };
  const c = await ejemploCompra();
  await ejemploFabrica(c.eje, c);
  for (const X of c.eje.orden.slice(-12)) await recorrer('compra', c.eje, X);
  const r = await ejemploReserva();
  for (const X of r.eje.orden) await recorrer('reserva', r.eje, X);
  const { eje: grupos, plaza } = await mundoDeGrupos();
  await recorrer('grupos', grupos, plaza.id);
  // La R de PV3 (encargo pv3): los cinco remitentes que tienen R de g la devuelven y gus, un desconocido sin R de g,
  // acuña la suya; g atiende el mensaje de gus (devuelve su R) y admite a alguien en la plaza.
  await entrarPorInvitacion(grupos, { por: 'ana', quien: 'gus', t: T0 });
  const g = grupos.genesisId;
  for (const yo of ['ana', 'bea', 'carla', 'dani', 'eli', 'gus']) {
    assert.ok(await comparar('grupos', grupos, 'write to X', { X: plaza.id, text: 'hola g' }, yo), 'write to X (' + yo + ')');
    iguales.set('write to X', iguales.get('write to X') + 1);
  }
  const deGus = await A.transaccion(grupos, 'write to X', { X: g, text: 'hola' }, 'gus', { t: T1 });
  const msg = await grupos.anadir(deGus.evento);
  assert.ok(await comparar('grupos', grupos, 'attend', { X: msg.id }, 'g'), 'attend');
  iguales.set('attend', iguales.get('attend') + 1);
  for (const valores of [{ whom: 'gus' }, { whom: 'ana', amount: 2, minutes: 5 }]) {
    assert.ok(await comparar('grupos', grupos, 'admit someone', { X: plaza.id, ...valores }, 'g'), 'admit someone ' + JSON.stringify(valores));
    iguales.set('admit someone', iguales.get('admit someone') + 1);
  }
  // Dar de alta una cosa (pide su clave y los minutos, sin defecto: #46): la casa, sobre su alta.
  const cosa = await generarClaves();
  if (await comparar('compra', c.eje, 'register a thing', { X: c.eje.alta('casa').id, thing: 'robot', minutes: 60, key: cosa.publica }, 'casa')) iguales.set('register a thing', iguales.get('register a thing') + 1);
  assert.deepEqual([...iguales].filter(([, n]) => n === 0).map(([nombre]) => nombre), [], 'cada plantilla que tenía lista se comparó al menos una vez: ' + JSON.stringify(Object.fromEntries(iguales)));
  // «pay» y «deliver» perdieron su lista antes (no sabía leer el anuncio como movimiento): lo que movía sobre los
  // anuncios de antes (un payload que imita un movimiento) es lo que mueven sus sentencias.
  const { eje, menu, compra } = await ejemploCompra();
  const encargo = await eje.escribir({ autor: 'cocina', sobre: menu.id, t: T1, payload: ['Encargo', ['x'], ['all announced movements happened'], ['cocina', 'huesped']], movimientos: [minuto('cocina')] });
  const anuncio = (serie, cantidad, que, de, a) => eje.escribir({ autor: 'cocina', sobre: encargo.id, en: ANUNCIO, t: T1, payload: [[serie], [cantidad], [que], [[de], [a]]], movimientos: [minuto('cocina')] });
  const aE = await anuncio('E:casa/EUR', 5, 'pagar', 'huesped', 'cocina');
  const aP = await anuncio('P:' + compra.id + '/huesped', 1, 'decidir', 'huesped', 'cocina');
  for (const [cual, a] of [['pay', aE], ['deliver', aP]]) {
    const nueva = A.plantillaDeTransaccion(cual);
    const params = { X: encargo.id, announcement: { ref: a.id } };
    const clave = ['anuncio', cual, 'huesped', eje.orden.indexOf(encargo.id)].join(' · ');
    vistos.add(clave);
    const hecha = await A.transaccion(eje, nueva, params, 'huesped', { t: T1 });
    assert.equal(hecha.ok, true, cual + ': ' + JSON.stringify(hecha.motivos));
    assert.deepEqual(porOrden(eje, hecha.evento.movimientos), esperado.casos[clave], clave);
  }
  assert.deepEqual([...vistos].sort(), Object.keys(esperado.casos).sort(), 'los mismos casos que cuando se escribió');
  // Nada queda sin migrar, y ninguna plantilla lleva ya una lista de décuplas en su 4.
  assert.deepEqual(A.plantillasDeTransaccion().filter((p) => !A.migrada(p.plantilla) && !A.esLectura(p.plantilla) && !A.esCamino(p.plantilla)).map((p) => p.nombre), []);
  assert.deepEqual(A.plantillasDeTransaccion().filter((p) => Array.isArray(p.plantilla[4]) && p.plantilla[4].some(Array.isArray)).map((p) => p.nombre), []);
});

test('el coste de escribir: una sola regla de la época, por posición (A3); la T en la escala pedida o en la menor que lo cubre; sin el minuto copiado en las plantillas', async () => {
  const regla = EPOCA_0_BTML.lecturas.find((r) => r[0][0] === 'the cost of writing');
  assert.ok(regla, 'la regla está en el 2 de la época, como lectura');
  assert.deepEqual([exigido(['a', ['b', 'c']]), costeT(['a', ['b', 'c']]), tDelCoste(180), tDelCoste(180, 'hora'), tDelCoste(3600), tDelCoste(30)], [180, 3, { escala: 'minuto', cantidad: 3 }, { escala: 'hora', cantidad: 1 }, { escala: 'hora', cantidad: 1 }, { escala: 'segundo', cantidad: 30 }]);
  // El minuto copiado ya no está en ninguna plantilla (tampoco en las de PV3, desde la fusión).
  const minuto1 = JSON.stringify([['T:minuto'], [1], ['burn'], [['=me'], ['nobody']]]);
  assert.deepEqual(A.plantillasDeTransaccion().filter((p) => Array.isArray(p.plantilla[4]) && p.plantilla[4].some((x) => JSON.stringify(x) === minuto1)).map((p) => p.nombre), []);
  // Una plantilla cobra lo que exige su candidata, por posición; con la escala pedida, en esa escala.
  const { eje, menu } = await ejemploCompra();
  const nota = await A.transaccion(eje, 'anchor here', { X: menu.id, title: 'Nota' }, 'huesped', { t: T1 });
  assert.deepEqual([nota.ok, nota.evento.movimientos, nota.exigido], [true, [{ token: 'T', escala: 'minuto', cantidad: costeT(nota.evento.payload), de: 'huesped', a: null }], 60 * costeT(nota.evento.payload)]);
  const enHoras = await A.transaccion(eje, 'anchor here', { X: menu.id, title: 'Nota' }, 'huesped', { t: T1, escala: 'hora' });
  assert.deepEqual([enHoras.ok, enHoras.evento.movimientos], [true, [{ token: 'T', escala: 'hora', cantidad: 1, de: 'huesped', a: null }]]);
  // Cambiar la regla en una copia de la época cambia el coste: es un dato, no código (dos minutos por posición).
  const cara = cargarEpocaBtml(JSON.parse(JSON.stringify(EPOCA_0_BTML_DATOS)), {
    registros: REGLAS_DE_EPOCA_DATOS.map((r) => (r.registro[0][0] === 'the cost of writing' ? { ...r, registro: r.registro.map((x, i) => (i === 2 ? ['=2 * first (first it.8).6.1 * first epoch.7.0.1.1'] : x)) } : r)),
    plantillas: PLANTILLAS_DE_EPOCA_DATOS, correcciones: CORRECCIONES_DE_EPOCA_DATOS, id: EPOCA_0_BTML.id,
  });
  assert.equal(exigido(['a'], { epoca: cara }), 120);
});

test('#48: un pago cumple un solo anuncio (el que lo lleva anclado); antes, uno solo cerraba dos anuncios iguales', async () => {
  const { eje, menu } = await ejemploCompra();
  const ctx = new ContextoEje(eje, { epoch: EPOCA_0_BTML });
  const encargo = await eje.escribir({ autor: 'cocina', sobre: menu.id, t: T1, payload: ['Encargo', ['x'], ['all announced movements happened'], ['cocina', 'huesped']], movimientos: [minuto('cocina')] });
  // Dos anuncios iguales: la huésped paga 5 euros a la cocina, dos veces.
  const anuncio = (t) => eje.escribir({ autor: 'cocina', sobre: encargo.id, en: ANUNCIO, t, payload: [['E:casa/EUR'], [5], ['pagar'], [['huesped'], ['cocina']]], movimientos: [minuto('cocina')] });
  const [a1, a2] = [await anuncio(T1), await anuncio('2026-11-08T12:01:00Z')];
  // La fórmula de antes (el primer ocupante del 2 de «stage») casaba por existencia: un solo pago en X los cerraba los dos.
  const antes = EPOCA_0_BTML.lecturas.find((r) => r[0][0] === 'stage')[2][0];
  const pendientesAntes = () => evaluar(antes, ctx, { sujeto: encargo.id }).valor.length;
  await eje.escribir({ autor: 'huesped', sobre: encargo.id, t: T1, payload: ['pago suelto'], movimientos: [minuto('huesped'), { token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 5, de: 'huesped', a: 'cocina' }] });
  assert.equal(pendientesAntes(), 0, 'el defecto, reproducido con la fórmula de antes: un pago de 5 cierra dos anuncios de 5');
  // Ahora: un pago suelto no cumple ninguno; el que se ancla sobre un anuncio cumple ese, y solo ese.
  assert.deepEqual(A.estaciones(eje, encargo.id)[0].pendientes, [a1.id, a2.id]);
  const pago = await A.transaccion(eje, 'pay', { X: encargo.id, announcement: { ref: a1.id } }, 'huesped', { t: T1 });
  assert.deepEqual([pago.ok, pago.evento.sobre, pago.evento.en], [true, a1.id, '4000000000'], 'el pago se ancla en el 4 del anuncio');
  await eje.anadir(pago.evento);
  assert.deepEqual([A.estaciones(eje, encargo.id)[0].pendientes, cerrado(eje, encargo.id).cerrado], [[a2.id], false], 'un anuncio cumplido deja de estar anunciado; el otro sigue');
  // El siguiente paso del camino es el otro anuncio; pagado, el encargo se cierra.
  const c = await A.camino(eje, encargo.id, 'huesped', { t: T1 });
  assert.deepEqual(c.pasos.filter((p) => p.regla === 'stage').map((p) => p.anuncio), [a2.id]);
  const auto = await A.autoejecutar(eje, encargo.id, 'huesped', null, { t: '2026-11-08T12:05:00Z' });
  assert.deepEqual([auto.hechos.map((h) => h.evento.sobre), cerrado(eje, encargo.id).cerrado], [[a2.id], true], JSON.stringify(auto.parado));
});

test('el anuncio es un movimiento anunciado del libro: no toca saldos, lo lee moves (2 «anunciado», 4.1 «anuncio», 7.1 para cuándo), lo cumple lo que se ancla sobre él y pasa por las estaciones de la época', async () => {
  const { eje, menu } = await ejemploCompra();
  const ctx = new ContextoEje(eje, { epoch: EPOCA_0_BTML });
  const encargo = await eje.escribir({ autor: 'cocina', sobre: menu.id, t: T1, payload: ['Encargo', ['x'], ['all announced movements happened'], ['cocina', 'huesped']], movimientos: [minuto('cocina')] });
  const saldo = eje.saldo('huesped', 'E:casa/EUR');
  const anunciado = { token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 7, de: 'huesped', a: 'cocina', estado: 'anunciado', refiere: '2026-11-20T10:00:00Z' };
  const a = await eje.escribir({ autor: 'cocina', sobre: encargo.id, en: ANUNCIO, t: T1, payload: 'pagar la cena', movimientos: [minuto('cocina'), anunciado] });
  assert.equal(eje.saldo('huesped', 'E:casa/EUR'), saldo, 'no toca saldos');
  const s = '("' + a.id + '")';
  assert.deepEqual(evaluar('count ' + s + '.1', ctx).valor, [1], 'el 1 del registro: solo lo que se movió (su T)');
  assert.deepEqual(evaluar('(moves ' + s + ' where "anunciado" in it.2) each 4.1', ctx).valor, ['anuncio']);
  assert.deepEqual(evaluar('first ((moves ' + s + ' where "anunciado" in it.2) each 7.1)', ctx).valor, ['2026-11-20T10:00:00Z']);
  // La estación: propuesta; el camino de la huésped la paga con «pay», anclada sobre el anuncio; ejecutada.
  assert.deepEqual(A.estacionesDelAnuncio().map((e) => e.nombre), ['propuesta', 'autorizada', 'ejecutada', 'verificada']);
  assert.equal(A.estacionDeAnuncio(eje, a.id), 'propuesta');
  const [paso] = (await A.camino(eje, encargo.id, 'huesped', { t: T1 })).pasos.filter((p) => p.regla === 'stage');
  assert.deepEqual([paso.hacer.plantilla, paso.anuncio], ['pay', a.id]);
  assert.match(paso.falta, /pagar la cena 7 E:casa\/EUR huesped → cocina$/);
  const pago = await A.transaccion(eje, 'pay', { X: encargo.id }, 'huesped', { t: T1 });
  assert.deepEqual([pago.ok, pago.evento.sobre, movs(pago.evento)[1]], [true, a.id, ['E', 7, 'huesped', 'cocina']], JSON.stringify(pago.motivos));
  await eje.anadir(pago.evento);
  assert.deepEqual([A.estacionDeAnuncio(eje, a.id), cerrado(eje, encargo.id).cerrado, eje.saldo('huesped', 'E:casa/EUR')], ['ejecutada', true, saldo - 7]);
  assert.deepEqual(A.ejecuciones(eje, encargo.id).filter((x) => x.ocupante?.ref === a.id).map((x) => [x.accion, x.estacion]), [['pay', 'ejecutada']]);
  // En BQL, mover con fecha (when) en lo que no es T informativo es anunciar: la plantilla lo construye, no lo mueve.
  const anuncia = epocaCon((e, plantillas) => {
    const p = plantillas.find((x) => x.registro[0][0] === 'anchor here').registro;
    p[4] = ['=transfer 3 E.("casa").("EUR") from "huesped" to "cocina" when "2026-11-21T10:00:00Z"'];
  });
  const r = await A.transaccion(eje, 'anchor here', { X: encargo.id, title: 'otro anuncio' }, 'cocina', { t: T1, epoca: anuncia });
  assert.deepEqual(r.evento.movimientos[1], { token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 3, de: 'huesped', a: 'cocina', estado: 'anunciado', refiere: '2026-11-21T10:00:00Z' });
});
