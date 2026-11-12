// Encargo 3c-1: la mitad de datos del contrato entre el núcleo y la pantalla (src/contrato.js, docs/CONTRATO.md).
// Principio (VG): la carta pinta un registro con un tamaño, en un punto de vista, sin lógica propia; todo lo que decide
// algo viene del núcleo como posición, vista o regla, y nada sale de una constante del módulo: todo se lee de la época.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as C from '../src/contrato.js';
import { pintar, pintarPara } from './carta-texto.mjs';
import { EPOCA_0_BTML, cargarEpocaBtml } from '../src/epocas.js';
import { EPOCA_0_BTML_DATOS, REGLAS_DE_EPOCA_DATOS, PLANTILLAS_DE_EPOCA_DATOS, CORRECCIONES_DE_EPOCA_DATOS } from '../datos/epocas/epocas.js';
import { evaluar } from '../src/bqlm.js';
import { ContextoEje } from '../src/contexto-eje.js';
import { crearEvento } from '../src/evento.js';
import { ejemploCompra, ejemploCuenta, ejemploJardinYParque, ejemploFabrica, ejemploFuturoYCohorte } from '../ejemplos/ikisai/compra-food.mjs';
import { generarClaves } from '../src/autoridad.js';
import { escribirBase, SIN_BASE_ESCRITA, HITOS } from '../src/bases.js';
import { pasos as pasosDe, pasoDe } from '../src/pasos.js';
import { recuento, miradasDe, ANUNCIO } from '../src/motor.js';
import { estadoDePaquete } from '../src/lente.js';
import * as A from '../src/acciones.js';
import { ejemploReserva } from '../ejemplos/ikisai/reserva-booking.mjs';
import { ejemploTarea } from '../ejemplos/ikisai/tarea-tasks.mjs';
import { ejemploComprasHermanas } from '../ejemplos/ikisai/compras-hermanas.mjs';
import { ejemploLente } from '../ejemplos/ikisai/lente-booking.mjs';
import { pagaElCoste } from './ayudas-coste.js';

const minuto = (de, cantidad) => (cantidad === undefined ? pagaElCoste(de) : { token: 'T', escala: 'minuto', cantidad, de, a: null });
const CERRADO = 'all announced movements happened';
const corto = (x) => JSON.stringify(x).replace(/[0-9a-f]{64}/g, (m) => m.slice(0, 8));

/** Una copia de la época 0 con cambios: lo que el contrato devuelve ha de cambiar con ella. */
function epocaCon(cambiar) {
  const e = JSON.parse(JSON.stringify(EPOCA_0_BTML_DATOS));
  cambiar(e);
  return cargarEpocaBtml(e, { registros: REGLAS_DE_EPOCA_DATOS, plantillas: PLANTILLAS_DE_EPOCA_DATOS, correcciones: CORRECCIONES_DE_EPOCA_DATOS, id: EPOCA_0_BTML.id });
}

const { eje, menu, compra, alta } = await ejemploCompra();
const cuenta = await ejemploCuenta(eje, compra);

// ---------- 1. plantillas ----------

test('plantilla: la compra nombra «purchase» en su 5 y la reserva «booking»; el menú no tiene; el alta tampoco (su 5 es su clave y su id)', async () => {
  assert.equal(C.nombreDePlantilla(C.plantilla(eje, compra.id)), 'purchase');
  assert.equal(C.nombreDePlantilla(C.plantilla(eje, compra)), 'purchase', 'por id o por el evento');
  assert.equal(C.plantilla(eje, menu.id), null);
  assert.equal(C.plantilla(eje, eje.alta('huesped').id), null, 'un alta no referencia plantilla');
  assert.equal(C.plantilla(eje, 'f'.repeat(64)), null);
  const { eje: b, reserva } = await ejemploReserva();
  assert.equal(C.nombreDePlantilla(C.plantilla(b, reserva.id)), 'booking');
  // Las que hay: las de dominio de la época (detrás de su cabecera), las preferencias y las del eje.
  assert.deepEqual(C.plantillas(eje).map((p) => [p.nombre, p.donde]), [['purchase', '9210000000'], ['booking', '9220000000'], ['guide settings', '9230000000'], ['opinion', '9240000000'], ['exterior settings', '9250000000'], ['preferences', '9300000000']]);
  for (const p of C.plantillas(eje)) assert.ok(C.esPlantilla(p.registro) && p.registro[4][4].includes('template'), p.nombre + ': su 4.4 dice template');
  // Un id de un registro que no es plantilla, una referencia a una posición de la época que no lo es, o un nombre
  // desconocido, no son plantilla; una referencia a la plantilla de la época sí, y una plantilla escrita en el eje también.
  const T = '2026-11-07T18:00:00Z';
  const con5 = async (cinco, payload0 = 'x') => eje.escribir({ autor: 'huesped', sobre: menu.id, t: T, movimientos: [minuto('huesped')], payload: [payload0, ['a'], ['b'], ['c'], ['d'], cinco] });
  assert.equal(C.plantilla(eje, await con5([menu.id])), null);
  assert.equal(C.plantilla(eje, await con5([{ ref: EPOCA_0_BTML.id, dir: '8300000000' }])), null);
  assert.equal(C.plantilla(eje, await con5(['desconocida'])), null);
  assert.equal(C.nombreDePlantilla(C.plantilla(eje, await con5([{ ref: EPOCA_0_BTML.id, dir: '9220000000' }]))), 'booking');
  const propia = [[['nota'], ['text']], [['cuerpo'], ['text']], ['x'], ['x'], ['template']];
  const escrita = await eje.escribir({ autor: 'huesped', sobre: menu.id, t: T, movimientos: [minuto('huesped')], payload: propia });
  assert.equal(C.plantillas(eje).at(-1).donde, escrita.id);
  assert.equal(C.nombreDePlantilla(C.plantilla(eje, await con5([{ ref: escrita.id }]))), 'nota');
  assert.equal(C.nombreDePlantilla(C.plantilla(eje, await con5(['nota']))), 'nota', 'también por su nombre');
});

test('etiqueta, ayuda, marcador y tipo: lo que dice la plantilla y, si calla, la regla corta de la época (respaldo en cadena)', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map((d) => C.etiqueta(eje, compra, d)), ['purchase', 'order', 'criteria', 'who', 'actions']);
  assert.deepEqual([5, 6, 7, 8, 9].map((d) => C.etiqueta(eje, compra, d)), ['estructura', 'pasado', 'futuro', 'comparabilidad', 'camino'], 'donde la plantilla calla, la cruceta');
  assert.deepEqual([C.etiqueta(eje, compra, '1.2'), C.etiqueta(eje, compra, [1, 2]), C.etiqueta(eje, compra, '1200000000')], ['con qué condición', 'con qué condición', 'con qué condición'], 'en profundidad, la regla corta de la profundidad');
  assert.deepEqual([0, 1, 2, 3, 4].map((d) => C.etiqueta(eje, menu, d)), ['representación', 'recursos', 'criterios', 'comunicación', 'fábrica'], 'sin plantilla, la genérica entera');
  assert.equal(C.ayuda(eje, compra, 1), 'what is bought, how many and at what price: 1.0 the dish or menu (a reference), 1.1 the quantity, 1.2 the unit price');
  assert.match(C.ayuda(eje, compra, 7), /^PV7: hilos del futuro/);
  assert.match(C.ayuda(eje, menu, '1.1'), /cuánto; su magnitud/);
  assert.deepEqual(C.marcador(eje, compra, 2), ['all announced movements happened']);
  assert.match(C.marcador(eje, menu, 1)[0], /^compra 1 = /, 'el ejemplo de la regla corta');
  assert.deepEqual([C.tipo(eje, compra, 0), C.tipo(eje, compra, 1), C.tipo(eje, compra, 3)], [['text', 'icon', 'image'], ['tenfold'], ['identity']]);
  assert.deepEqual([C.tipo(eje, compra, 7), C.tipo(eje, menu, 1), C.tipo(eje, menu, '1.5')], [['instant'], ['number'], ['ref']], 'el tipo genérico del dígito (epoch.9.2.0.1)');
  assert.equal(C.etiqueta(eje, compra, [1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1]), null, 'fuera de las diez profundidades, nada');
});

test('validar: la compra y la reserva pasan sus validaciones; una compra sin cantidad y sin la plantilla de cerrado no, con el motivo de la plantilla', async () => {
  assert.deepEqual(C.validar(eje, compra), []);
  assert.deepEqual(C.validar(eje, menu), [], 'sin plantilla no hay nada que validar');
  const { eje: b, reserva } = await ejemploReserva();
  assert.deepEqual(C.validar(b, reserva), []);
  const rara = await eje.escribir({ autor: 'huesped', sobre: menu.id, t: '2026-11-07T18:00:00Z', movimientos: [minuto('huesped')], payload: ['Compra rara', [[{ ref: menu.id, dir: '1000000000' }], [0], ['EUR 0']], ['sin cerrado'], ['huesped', 'cocina'], ['pagar'], ['purchase']] });
  assert.deepEqual(C.validar(eje, rara), [
    { posicion: 1, motivo: 'order: what is bought, how many and at what price: 1.0 the dish or menu (a reference), 1.1 the quantity, 1.2 the unit price' },
    { posicion: 2, motivo: 'criteria: the criteria of the menu and the closing template (epoch.9.0.1)' },
  ]);
  // Una candidata que aún no está en el eje se valida igual (it = ev).
  const candidata = await crearEvento({ autor: 'huesped', sobre: menu.id, t: '2026-11-07T18:00:00Z', movimientos: [minuto('huesped')], payload: ['Otra compra', [[{ ref: menu.id, dir: '1000000000' }], [2], ['EUR 12']], [CERRADO], ['huesped', 'cocina'], ['pagar'], ['purchase']] });
  assert.deepEqual(C.validar(eje, candidata), []);
});

// ---------- 2. representaciones ----------

test('representaciones: una hoja en el 0 es texto sin tamaño mínimo; una décupla es rica (0 alternativo, 1 [tamaño, formato], 5 recurso); lo que la plantilla no admite se omite', async () => {
  assert.deepEqual(C.representaciones(eje, compra), [{ texto: 'Compra del menú del día', tamano: 0, formato: 'text', recurso: null }]);
  const T = '2026-11-07T18:00:00Z';
  const rica = (alt, tamano, formato, recurso) => [[alt], [tamano, formato], ['x'], ['x'], ['x'], [recurso]];
  // Una compra con una imagen en el 0 (la plantilla «purchase» admite text, icon e image) y un vídeo anclado en su raíz (no lo admite).
  const conFoto = await eje.escribir({ autor: 'huesped', sobre: menu.id, t: T, movimientos: [minuto('huesped')], payload: [rica('la foto del menú', 2, 'image', 'img/menu.png'), [[{ ref: menu.id, dir: '1000000000' }], [1], ['EUR 12']], [CERRADO], ['huesped', 'cocina'], ['pagar'], ['purchase']] });
  await eje.escribir({ autor: 'huesped', sobre: conFoto.id, t: T, movimientos: [minuto('huesped')], payload: rica('el vídeo', 3, 'video', 'video/menu.mp4') });
  await eje.escribir({ autor: 'huesped', sobre: conFoto.id, t: T, movimientos: [minuto('huesped')], payload: rica('el icono', 1, 'icon', { ref: menu.id }) });
  assert.deepEqual(C.representaciones(eje, conFoto), [
    { texto: 'el icono', tamano: 1, formato: 'icon', recurso: { ref: menu.id } },
    { texto: 'la foto del menú', tamano: 2, formato: 'image', recurso: 'img/menu.png' },
  ], 'por tamaño mínimo; el vídeo no lo admite el tipo');
  // Sin plantilla, la época admite todos sus formatos; un tamaño que la época no tiene se omite; una lista en el 0 son varios textos.
  const libre = await eje.escribir({ autor: 'huesped', sobre: menu.id, t: T, movimientos: [minuto('huesped')], payload: [['Menú', 'Carta del día']] });
  await eje.escribir({ autor: 'huesped', sobre: libre.id, t: T, movimientos: [minuto('huesped')], payload: rica('el vídeo', 3, 'video', 'video/menu.mp4') });
  await eje.escribir({ autor: 'huesped', sobre: libre.id, t: T, movimientos: [minuto('huesped')], payload: rica('gigante', 7, 'image', 'img/x.png') });
  await eje.escribir({ autor: 'huesped', sobre: libre.id, t: T, movimientos: [minuto('huesped')], payload: rica('raro', 2, 'hologram', 'x') });
  assert.deepEqual(C.representaciones(eje, libre).map((r) => [r.texto, r.tamano, r.formato]), [['Menú', 0, 'text'], ['Carta del día', 0, 'text'], ['el vídeo', 3, 'video']]);
  assert.deepEqual(C.tamanos().map((t) => [t.tamano, t.nombre, t.datos]), [[1, 'slot', 1], [2, 'card', 4], [3, 'screen', 10]]);
  // Un registro terminal es su propio texto.
  const nota = await eje.escribir({ autor: 'huesped', sobre: menu.id, t: T, movimientos: [minuto('huesped')], payload: 'una nota' });
  assert.deepEqual(C.representaciones(eje, nota), [{ texto: 'una nota', tamano: 0, formato: 'text', recurso: null }]);
});

// ---------- 3. ocupantes ----------

test('ocupantes: tal cual (hojas, décuplas, referencias por su id), por llegada por defecto, paginados; el orden lo nombra la plantilla o el dueño en el 2.3, nunca la carta', async () => {
  assert.deepEqual(C.ocupantes(eje, menu, 1), { total: 3, desde: 0, cuantos: 10, orden: 'arrival', ocupantes: ['ensalada', 'guiso', 'fruta'] });
  assert.deepEqual(C.ocupantes(eje, menu, 1, 1, 1).ocupantes, ['guiso']);
  assert.deepEqual(C.ocupantes(eje, menu, 1, 2, 5), { total: 3, desde: 2, cuantos: 5, orden: 'arrival', ocupantes: ['fruta'] });
  // La 1 de la compra: su décupla y, detrás, la cuenta anclada en ella (la referencia a su id, no su contenido).
  assert.deepEqual(C.ocupantes(eje, compra, 1).ocupantes, [[[{ ref: menu.id, dir: '1000000000' }], [1], ['EUR 12']], { ref: cuenta.id }]);
  assert.deepEqual(C.ocupantes(eje, compra, [1, 0]).ocupantes, [{ ref: menu.id, dir: '1000000000' }], 'una referencia va por su id: lo que alcanza se pide aparte');
  assert.deepEqual(C.ocupantes(eje, compra, '1.2').ocupantes, ['EUR 12']);
  assert.deepEqual(C.ocupantes(eje, compra, 6), { total: 0, desde: 0, cuantos: 10, orden: 'arrival', ocupantes: [] });
  // El dueño nombra «newest» en el 2.3 de su registro: los ocupantes salen al revés.
  const T = '2026-11-07T18:00:00Z';
  const lista = await eje.escribir({ autor: 'huesped', sobre: menu.id, t: T, movimientos: [minuto('huesped')], payload: ['Lista', ['a', 'b', 'c'], [['x'], ['x'], ['x'], ['newest']]] });
  assert.deepEqual(C.ocupantes(eje, lista, 1), { total: 3, desde: 0, cuantos: 10, orden: 'newest', ocupantes: ['c', 'b', 'a'] });
  // Un orden que la época no tiene no vale: por defecto.
  const otra = await eje.escribir({ autor: 'huesped', sobre: menu.id, t: T, movimientos: [minuto('huesped')], payload: ['Lista', ['a', 'b'], [['x'], ['x'], ['x'], ['alphabetical']]] });
  assert.deepEqual(C.ocupantes(eje, otra, 1).orden, 'arrival');
  // «fit»: por encaje (encaje.ordenarPorEncaje), con lo anclado.
  const porEncaje = await eje.escribir({ autor: 'huesped', sobre: menu.id, t: T, movimientos: [minuto('huesped')], payload: ['Lista', ['a', 'b'], [['x'], ['x'], ['x'], ['fit']]] });
  await eje.escribir({ autor: 'huesped', sobre: porEncaje.id, en: '1000000000', t: T, movimientos: [minuto('huesped')], payload: 'c' });
  const r = C.ocupantes(eje, porEncaje, 1);
  assert.equal(r.orden, 'fit');
  assert.equal(r.total, 3);
  assert.deepEqual(C.ordenes().map((o) => o.nombre), ['arrival', 'newest', 'latest', 'soonest', 'fit']);
  assert.equal(C.paso(), 10);
  // Una candidata fuera del eje: lo propio de su payload.
  const candidata = await crearEvento({ autor: 'huesped', sobre: menu.id, t: T, movimientos: [minuto('huesped')], payload: ['x', ['p', 'q']] });
  assert.deepEqual(C.ocupantes(eje, candidata, 1).ocupantes, ['p', 'q']);
});

// ---------- 4. la división ----------

test('division: la tabla del espacio de bloque de epoch.8.3 (datos que caben → puntos de vista), lista o matriz por la forma del hueco, el máximo del modo y «cargar más» de diez en diez', async () => {
  const d = (datos, forma, modo) => C.division(eje, compra.id, { datos, forma, modo });
  assert.deepEqual(d(1, { ancho: 1, alto: 3 }), { pvs: [0], disposicion: 'list', paso: 10, datos: 1, maximo: Infinity, cargarMas: false });
  assert.deepEqual([2, 3, 4, 5, 6].map((n) => d(n).pvs), [[0, 5], [1, 2, 3], [1, 2, 3, 4], [0, 1, 2, 3, 4], [0, 1, 2, 3, 4, 5]]);
  assert.deepEqual([7, 8].map((n) => d(n).pvs), [[0, 1, 2, 3, 4, 5, 8], [1, 2, 3, 4, 6, 7, 8, 9]], 'propuesta de Core, [X] decidir VG');
  assert.deepEqual([9, 10].map((n) => d(n).pvs), [[1, 2, 3, 4, 0, 6, 7, 8, 9], [1, 2, 3, 4, 0, 5, 6, 7, 8, 9]]);
  assert.deepEqual(d(37, { ancho: 4, alto: 4 }), { pvs: [1, 2, 3, 4, 0, 5, 6, 7, 8, 9], disposicion: 'matrix', paso: 10, datos: 10, maximo: Infinity, cargarMas: true }, 'más de diez: diez y cargar más');
  // La forma: lista si es más alto que ancho (por encima del umbral de la época), matriz si es cuadrado; o su nombre.
  assert.deepEqual([{ ancho: 3, alto: 4 }, { ancho: 1, alto: 1 }, { ancho: 4, alto: 3 }, 2, 1.2, 'list', 'matrix'].map((forma) => d(4, forma).disposicion), ['list', 'matrix', 'matrix', 'list', 'matrix', 'list', 'matrix']);
  // El modo acota los datos: Pointed, diez; Sequenced, cien.
  assert.deepEqual([d(25, 1, 'pointed'), d(25, 1, 'Sequenced')].map((x) => [x.datos, x.maximo, x.cargarMas]), [[10, 10, false], [10, 100, true]]);
  assert.deepEqual(C.modos().map((m) => [m.nombre, m.minimo, m.maximo]), [['Pointed', 1, 10], ['Sequenced', 10, 100], ['Mapped', 100, 1000], ['Scened', 1000, 10000], ['Be', 'sin mínimo', Infinity]]);
  // Con un dato: el 0 si el registro tiene representación; si no (un registro terminal), el 5.
  const nota = await eje.escribir({ autor: 'huesped', sobre: menu.id, t: '2026-11-07T18:00:00Z', movimientos: [minuto('huesped')], payload: 'nota suelta' });
  assert.deepEqual(C.division(eje, nota.id, { datos: 1 }).pvs, [5]);
  assert.deepEqual(C.division(eje, { id: menu.id }, { datos: 1 }).pvs, [0]);
});

// ---------- 5. la madurez ----------

test('madurez: la lectura «maturity» (X.8.1) con su medida (X.8.6), y el nombre entre los niveles de la época o los de la plantilla del tipo', async () => {
  assert.deepEqual(C.madurez(eje, compra), { nivel: 11, de: 15, nombre: 'list', clave: 'list', medida: { posiciones: 15, profundidad: 1, cantidad: 17 } });
  assert.deepEqual(C.madurez(eje, cuenta), { nivel: 4, de: 15, nombre: 'stem', clave: 'stem', medida: { posiciones: 4, profundidad: 0, cantidad: 4 } });
  const T = '2026-11-07T18:00:00Z';
  const semilla = await eje.escribir({ autor: 'huesped', sobre: menu.id, t: T, movimientos: [minuto('huesped')], payload: ['x'] });
  assert.deepEqual(C.madurez(eje, semilla), { nivel: 1, de: 15, nombre: 'seed', clave: 'seed', medida: { posiciones: 1, profundidad: 0, cantidad: 1 } });
  const diez = await eje.escribir({ autor: 'huesped', sobre: menu.id, t: T, movimientos: [minuto('huesped')], payload: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'] });
  assert.deepEqual([C.madurez(eje, diez).nivel, C.madurez(eje, diez).nombre], [10, 'tenfold']);
  // Lo que mueve cuenta por órdenes de magnitud (doce euros no hacen una tienda): un registro de una posición que mueve 500 es una lista, no un distrito.
  const grande = await eje.escribir({ autor: 'casa', sobre: eje.genesisId, t: T, movimientos: [minuto('casa'), { token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 400, de: 'casa', a: 'huesped' }], payload: 'euros' });
  assert.deepEqual([C.madurez(eje, grande).nivel, C.madurez(eje, grande).nombre, C.madurez(eje, grande).medida.cantidad], [3, 'shoot', 401]);
  assert.deepEqual(C.niveles(), ['seed', 'sprout', 'shoot', 'stem', 'branch', 'leaf', 'bud', 'flower', 'fruit', 'tenfold', 'list', 'shop', 'block', 'district', 'kingdom']);
  // La reserva tiene su propia escala en el 8.8 de «booking»: cinco niveles, repartidos sobre los genéricos.
  const { eje: b, reserva, habitacion } = await ejemploReserva();
  // VG 12-11 (decisión 8): sus dos anuncios son movimientos anunciados (no cuentan como movidos) y lo que los cumple
  // cuelga de ellos (profundidad 2).
  assert.deepEqual(C.madurez(b, reserva), { nivel: 4, de: 5, nombre: 'settled', clave: 'settled', medida: { posiciones: 19, profundidad: 2, cantidad: 187 } });
  assert.equal(C.madurez(b, habitacion).nombre, 'list');
  // La lectura es una regla de la época como las demás: en el 2, con read en su 4, después de «weight», y se lee en X.8.1.
  const regla = EPOCA_0_BTML.lecturas.find((r) => r[0][0] === 'maturity');
  assert.deepEqual([regla[3], regla[4], regla[8]], [['X.8.1'], ['read'], ['after weight']]);
  const ctx = new ContextoEje(eje, { epoch: EPOCA_0_BTML });
  assert.deepEqual(evaluar('first ("' + compra.id + '").8.1', ctx).valor, [11]);
  assert.deepEqual(evaluar('("' + compra.id + '").8.6.1', ctx).valor, [15]);
  // La candidata también: su propio payload, sin subárbol.
  const candidata = await crearEvento({ autor: 'huesped', sobre: menu.id, t: T, movimientos: [minuto('huesped')], payload: ['x', 'y'] });
  assert.deepEqual(C.madurez(eje, candidata).medida, { posiciones: 2, profundidad: 0, cantidad: 1 });
  assert.deepEqual(evaluar('first ev.8.1', new ContextoEje(eje, { ev: candidata, epoch: EPOCA_0_BTML })).valor, [2]);
});

// ---------- 6. el diario ----------

test('diario: las transacciones del subárbol por llegada, con los asientos del libro (movimientos, asignación y obtención) y su ancla; paginado desde un índice o un id', async () => {
  const d = C.diario(eje, menu.id, 0, 3);
  assert.equal(d.total, eje.orden.filter((id) => eje.hilo(id).some((x) => x.id === menu.id)).length);
  assert.deepEqual(d.entradas.map((e) => e.id), [menu.id, compra.id, cuenta.id]);
  assert.deepEqual(d.entradas[1], {
    id: compra.id, t: compra.t, autor: 'huesped', ancla: { sobre: menu.id, en: '0000000000' }, pv: 1, estado: null,
    movimientos: [
      { primitiva: 'acunar', serie: 'T:hora', de: null, a: 'huesped', cantidad: 1, clase: 'asignacion', etiqueta: 20764 },
      { primitiva: 'quemar', serie: 'T:hora', de: 'huesped', a: null, cantidad: 1 },
      { primitiva: 'transferir', serie: 'E:casa/EUR', de: 'huesped', a: 'cocina', cantidad: 12 },
      { primitiva: 'acunar', serie: 'P:' + compra.id + '/huesped', de: null, a: 'huesped', cantidad: 10, clase: 'obtencion', etiqueta: 'writing a record gives ten P on it' },
    ],
  });
  assert.deepEqual(C.diario(eje, menu.id, compra.id, 1).entradas.map((e) => e.id), [compra.id], 'desde un id');
  assert.deepEqual(C.diario(eje, menu.id, 1, 1).entradas.map((e) => e.id), [compra.id], 'desde un índice');
  assert.equal(C.diario(eje, menu.id).entradas.length, Math.min(10, d.total), 'el paso de la época');
  assert.deepEqual(C.diario(eje, cuenta.id).entradas.map((e) => e.id), [cuenta.id], 'una hoja: ella sola');
  assert.deepEqual(C.diario(eje, 'f'.repeat(64)), { total: 0, desde: 0, entradas: [] });
  const { eje: b, reserva, entrega, pago } = await ejemploReserva();
  const r = C.diario(b, reserva.id);
  assert.equal(r.total, 6); // la reserva, sus noches, sus dos anuncios y lo que los cumple, anclado sobre cada uno (VG 12-11, decisión 8)
  const anuncios = b.sobre(reserva.id, ANUNCIO).map((a) => a.id);
  assert.deepEqual(r.entradas.slice(-2).map((e) => [e.id, e.autor, e.ancla.sobre]), [[entrega.id, 'casa', anuncios[0]], [pago.id, 'huesped', anuncios[1]]]);
  assert.ok(r.entradas.at(-1).movimientos.some((m) => m.primitiva === 'transferir' && m.serie === 'E:casa/EUR' && m.cantidad === 165));
});

// ---------- 7. yo y mi configuración ----------

test('yo: mi alta y sus posiciones (cartera, criterio, atención, tiempo), leídas como vistas con el BQL mínimo', () => {
  const y = C.yo(eje, 'huesped');
  assert.equal(y.alta, eje.alta('huesped').id);
  assert.deepEqual(y.cartera.find((x) => x.serie === 'E:casa/EUR'), { serie: 'E:casa/EUR', disponible: eje.saldo('huesped', 'E:casa/EUR'), bloqueado: [] });
  assert.ok(eje.saldo('huesped', 'E:casa/EUR') >= 48);
  assert.ok(y.cartera.some((x) => x.serie === 'R:casa' && x.disponible === 1), 'la R de la invitación');
  assert.ok(y.criterio.posicionado.some((p) => p.registro === compra.id && p.cuanto === 10 && p.origenes.includes('huesped')), 'diez P sobre la compra');
  assert.deepEqual(y.criterio.adopta, []);
  // la R es el precio universal (VG, 12-11, encargo pv3): los cinco grupos cobran lo mismo; vetados, nada
  assert.deepEqual(y.atencion.map((g) => [g.nombre, g.zona, g.precio.enQue, g.precio.cuanto]), [['desconocidos', 0, 'their R', 1], ['comercial', 1, 'their R', 1], ['expertos', 2, 'their R', 1], ['cercanos', 3, 'their R', 1], ['equipo', 4, 'their R', 1], ['vetados', 5, 'nothing', 0]]);
  assert.deepEqual(Object.keys(y.tiempo), ['segundo', 'minuto', 'hora', 'día', 'semana', 'ciclo', 'año'], 'las escalas reales, por su nombre en la época');
  assert.equal(y.tiempo.hora, 1, 'la hora de la compra, gastada el día del reloj del libro');
  assert.ok(y.tiempo.minuto >= 1 && y.tiempo.segundo === 0);
  assert.equal(C.yo(eje, 'nadie-conocido'), null);
});

test('configuracion: los defectos de la plantilla «preferences» si no hay registro, y el registro anclado en el 9 de mi alta si lo hay (validado por su plantilla)', async () => {
  assert.deepEqual(C.configuracion(eje, 'huesped'), { step: 10, render: 'sober', language: 'es', sizes: [1, 2, 3], model: 'general', animations: 10, de: null });
  assert.deepEqual(C.configuracion(eje, C.yo(eje, 'huesped')), C.configuracion(eje, 'huesped'));
  const T = '2026-11-07T18:00:00Z';
  const mias = await eje.escribir({ autor: 'huesped', sobre: eje.alta('huesped').id, en: '9000000000', t: T, movimientos: [minuto('huesped')], payload: ['preferences', 20, 'animated', 'es', [1, 3], 'preferences'] });
  assert.deepEqual(C.configuracion(eje, 'huesped'), { step: 20, render: 'animated', language: 'es', sizes: [1, 3], model: 'general', animations: 10, de: mias.id }, 'el 5 (el tipo) no es una preferencia; «model» (encargo 3c-2b) tiene su defecto');
  assert.deepEqual(C.validar(eje, mias), []);
  // Un registro de preferencias anclado en otro sitio no es mi configuración; lo último mío en mi 9 manda.
  await eje.escribir({ autor: 'huesped', sobre: menu.id, en: '9000000000', t: T, movimientos: [minuto('huesped')], payload: ['preferences', 99, 'sober', 'en', [2], 'preferences'] });
  assert.equal(C.configuracion(eje, 'huesped').step, 20);
  const otras = await eje.escribir({ autor: 'huesped', sobre: eje.alta('huesped').id, en: '9000000000', t: T, movimientos: [minuto('huesped')], payload: ['preferences', 5, 'sober', 'en', [2], 'preferences'] });
  assert.deepEqual(C.configuracion(eje, 'huesped'), { step: 5, render: 'sober', language: 'en', sizes: 2, model: 'general', animations: 10, de: otras.id }, 'el último mío');
  // Sin su 5 no es un registro de preferencias (y como el 5 exige el 0-4, un registro de preferencias siempre dice todo).
  await eje.escribir({ autor: 'huesped', sobre: eje.alta('huesped').id, en: '9000000000', t: T, movimientos: [minuto('huesped')], payload: ['preferences', 7, 'animated'] });
  assert.equal(C.configuracion(eje, 'huesped').de, otras.id);
  const mal = await eje.escribir({ autor: 'huesped', sobre: eje.alta('huesped').id, en: '9000000000', t: T, movimientos: [minuto('huesped')], payload: ['preferences', 0, 'loud', 'en', [1], 'preferences'] });
  assert.deepEqual(C.validar(eje, mal).map((x) => x.posicion), [1, 2]);
  assert.deepEqual(C.etiqueta(eje, mal, 2), 'render');
});

// ---------- 8. mensajes ----------

test('mensaje: el 9 de cada regla en español (epoch.9.4, «es») con los mismos huecos, resueltos como el 9 de toda regla; sin el idioma o sin la regla, el inglés', async () => {
  assert.equal(C.mensaje(eje, 'every event moves tokens', 'es'), 'every event moves tokens: la transacción no mueve ningún token');
  assert.equal(C.mensaje(eje, 'every event moves tokens', 'en'), 'every event moves tokens: the transaction moves no token');
  assert.equal(C.mensaje(eje, 'every event moves tokens', 'fr'), 'every event moves tokens: the transaction moves no token', 'sin el idioma, el inglés');
  assert.equal(C.mensaje(eje, 'no existe', 'es'), null);
  assert.equal(C.mensaje(eje, 'writing a record gives ten P on it', 'es', { ev: compra }), 'writing a record gives ten P on it: huesped obtiene 10 P sobre el registro que escribe');
  assert.equal(C.mensaje(eje, EPOCA_0_BTML.escrituras[0], 'en', { ev: compra }), 'writing a record gives ten P on it: huesped gets 10 P on the record it writes', 'la regla misma, o su nombre');
  assert.equal(C.mensaje(null, 'nobody mints T', 'es'), 'nobody mints T: {first ev.3} acuña {sum ((ev.1 where T in it.0.0.0 and mint in it.4) each 1)} T; cada uno tiene la asignación de hoy', 'sin eje ni candidata, los huecos quedan');
  assert.deepEqual(C.idiomas(), ['en', 'es']);
  // Todas las reglas de hoy tienen su traducción, con los mismos huecos y distinta del original.
  const huecos = (s) => [...s.matchAll(/\{([^{}]+)\}/g)].map((m) => m[1]);
  for (const { regla } of EPOCA_0_BTML.reglasConId) {
    const en = regla[9].at(-1);
    const es = C.mensaje(null, regla, 'es');
    assert.ok(es.startsWith(regla[0][0] + ': '), regla[0][0] + ': el nombre canónico delante');
    assert.notEqual(es, en, regla[0][0] + ': traducida');
    assert.deepEqual(huecos(es), huecos(en), regla[0][0] + ': los mismos huecos');
  }
  // Una regla rechazando, con su mensaje en español y los huecos rellenos sobre la candidata.
  const robo = await crearEvento({ autor: 'cocina', sobre: menu.id, t: '2026-11-07T18:00:00Z', movimientos: [minuto('cocina'), { token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 1, de: 'huesped', a: 'cocina' }], payload: 'robo' });
  assert.match((await eje.validar(robo)).join('; '), /nobody moves tokens of others: cocina moves from huesped/);
  assert.equal(C.mensaje(eje, 'nobody moves tokens of others', 'es', { ev: robo }), 'nobody moves tokens of others: cocina mueve desde huesped');
});

// ---------- 9. la carta de texto y la ausencia de constantes ----------

test('la carta de texto solo importa el contrato (y, si acaso, bqlm y libro), y pinta cada ejemplo en los tres tamaños como se espera', async () => {
  const fuente = readFileSync(new URL('../carta/texto.js', import.meta.url), 'utf8');
  const importados = [...fuente.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
  assert.ok(importados.length >= 1);
  for (const i of importados) assert.ok(['../src/contrato.js', '../src/acciones.js', '../src/bqlm.js', '../src/libro.js'].includes(i), 'la carta no importa ' + i);
  const esperado = JSON.parse(readFileSync(new URL('./carta-esperada.json', import.meta.url), 'utf8'));
  const nombresDe = (r) => {
    const n = new Map();
    if (r.eje?.genesisId) n.set(r.eje.genesisId, 'génesis');
    for (const [k, v] of Object.entries(r)) {
      if (v && typeof v === 'object' && typeof v.id === 'string' && 'payload' in v) n.set(v.id, k);
      if (Array.isArray(v)) v.forEach((x, i) => { if (x && typeof x === 'object' && typeof x.id === 'string' && 'payload' in x) n.set(x.id, k + i); });
    }
    return n;
  };
  const sinIds = (s, nombres) => s.replace(/[0-9a-f]{64}|\b[0-9a-f]{8}\b/g, (x) => { for (const [id, nombre] of nombres) if (id.startsWith(x)) return '<' + nombre + '>'; return '<id>'; });
  const c = await ejemploCompra();
  c.cuenta = await ejemploCuenta(c.eje, c.compra);
  const b = await ejemploReserva();
  const t = await ejemploTarea();
  const h = await ejemploComprasHermanas();
  const l = await ejemploLente();
  const focos = { compra: [c, c.compra.id], 'menú': [c, c.menu.id], reserva: [b, b.reserva.id], tarea: [t, t.tarea.id], hermanas: [h, h.compra.id], lente: [l, l.reserva.id] };
  // Con quien mira (encargo 3c-2a): el aro y el camino, del menú para la huésped y de la reserva abierta para las dos partes.
  const abierta = await ejemploReserva({ confirmar: false });
  const paraQuien = { 'menú·huesped': [c, c.menu.id, 'huesped'], 'reserva·huesped': [abierta, abierta.reserva.id, 'huesped'], 'reserva·casa': [abierta, abierta.reserva.id, 'casa'] };
  assert.deepEqual(Object.keys(esperado).sort(), [...Object.keys(focos), ...Object.keys(paraQuien)].sort());
  for (const [nombre, [r, id]] of Object.entries(focos)) {
    const nombres = nombresDe(r);
    for (const tamano of [1, 2, 3]) assert.equal(sinIds(pintar(r.eje, id, tamano), nombres), esperado[nombre][tamano - 1], nombre + ' en el tamaño ' + tamano);
  }
  for (const [nombre, [r, id, yo]] of Object.entries(paraQuien)) {
    const nombres = nombresDe(r);
    for (const tamano of [2, 3]) assert.equal(sinIds(await pintarPara(r.eje, id, tamano, yo, { t: '2026-11-09T09:00:00Z', idioma: 'en' }), nombres), esperado[nombre][tamano - 2], nombre + ' para ' + yo + ' en el tamaño ' + tamano);
  }
  // Lo que pinta cada tamaño es lo que la época dice que cabe: un dato en el hueco, cuatro en la tarjeta, diez en la pantalla.
  assert.equal(pintar(eje, compra.id, 1).split('\n').length, 1);
  assert.equal(pintar(eje, compra.id, 2).split('\n').filter((l) => /^  \d · /.test(l)).length, 4);
  assert.equal(pintar(eje, compra.id, 3).split('\n').filter((l) => /^  \d · /.test(l)).length, 10);
});

test('nada sale de una constante del módulo: cambiar la época cambia las etiquetas, los órdenes, la división, los niveles, los tamaños y los mensajes', async () => {
  const epoca = epocaCon((e) => {
    e[9][2][1][1][0] = ['pedido']; // la etiqueta del 1 de «purchase»
    e[5][0][7][0] = ['porvenir']; // la regla corta del 7 en la profundidad 0
    e[8][5][1] = [e[8][5][1][1], e[8][5][1][0], e[8][5][1][2]]; // «newest» pasa a ser el orden por defecto
    e[8][3][1][3] = [[4], [0, 1, 2, 3]]; // con cuatro datos, otros puntos de vista
    e[8][3][2] = [[['lista'], ['alto'], [1.25]], [['matriz'], ['cuadrado'], [1.25]]]; // las disposiciones, en español
    e[8][3][3] = [['load more'], [5], ['de cinco en cinco']]; // el paso
    e[8][4][2][0] = 'semilla'; // el primer nivel
    e[8][4][4] = ['lista', 'tienda', 'manzana', 'distrito', 'reino']; // los de orden de magnitud
    e[9][5][2] = [[[1], ['hueco'], [2]], [[2], ['tarjeta'], [4]], [[3], ['pantalla'], [10]]]; // en el hueco caben dos datos
    e[9][4][1][1] = e[9][4][1][1].map((m) => (m.startsWith('every event moves tokens: ') ? 'every event moves tokens: nada se mueve' : m));
    e[9][3][1][9] = [25, 'cuántos por carga']; // el defecto de «step»
  });
  const o = { epoca };
  assert.equal(C.etiqueta(eje, compra, 1, o), 'pedido');
  assert.equal(C.etiqueta(eje, compra, 7, o), 'porvenir');
  assert.deepEqual(C.ocupantes(eje, menu, 1, 0, undefined, o), { total: 3, desde: 0, cuantos: 5, orden: 'newest', ocupantes: ['fruta', 'guiso', 'ensalada'] });
  assert.deepEqual(C.division(eje, compra.id, { datos: 4, forma: { ancho: 1, alto: 3 }, ...o }), { pvs: [0, 1, 2, 3], disposicion: 'lista', paso: 5, datos: 4, maximo: Infinity, cargarMas: false });
  assert.equal(C.division(eje, compra.id, { datos: 4, forma: 1, ...o }).disposicion, 'matriz');
  const semilla = await eje.escribir({ autor: 'huesped', sobre: menu.id, t: '2026-11-07T18:00:00Z', movimientos: [minuto('huesped')], payload: ['semilla de prueba'] });
  assert.equal(C.madurez(eje, semilla, o).nombre, 'semilla');
  assert.equal(C.madurez(eje, compra, o).nombre, 'lista');
  assert.deepEqual(C.tamanos(o).map((t) => [t.nombre, t.datos]), [['hueco', 2], ['tarjeta', 4], ['pantalla', 10]]);
  assert.equal(C.mensaje(eje, 'every event moves tokens', 'es', o), 'every event moves tokens: nada se mueve');
  assert.equal(C.configuracion(eje, 'cocina', o).step, 25);
  assert.match(pintar(eje, compra.id, 1, o), /^\[hueco · matriz\] /);
  assert.match(pintar(eje, compra.id, 2, o), /\n  1 · pedido \(arrival\): /, 'la plantilla «purchase» fija «arrival» en su 1.8: manda sobre el defecto de la época');
  assert.match(pintar(eje, menu.id, 2, o), /\n  1 · recursos \(newest\): fruta · guiso · ensalada/, 'sin plantilla, el defecto de la época');
  // Y la plantilla del tipo manda sobre la época: su 9.9 es su propio modelo de división, su 8.8 sus niveles.
  const conModelo = epocaCon((e) => {
    const p = e[9][2][1];
    for (let d = 5; d <= 9; d++) p[d] = [['pos ' + d], ['text'], ['any'], ['owner'], ['write'], [String(d)], ['prueba'], ['optional'], ['arrival'], ['ayuda']];
    p[8][8] = ['nueva', 'hecha'];
    p[9][9] = [[[1], [4]], [[2], [4, 0]], [[3], [4, 0, 1]], [[4], [4, 0, 1, 2]]];
  });
  assert.deepEqual(C.division(eje, compra.id, { datos: 4, epoca: conModelo }).pvs, [4, 0, 1, 2]);
  assert.deepEqual(C.division(eje, menu.id, { datos: 4, epoca: conModelo }).pvs, [1, 2, 3, 4], 'el menú no es una compra: la tabla de la época');
  assert.deepEqual([C.madurez(eje, compra, { epoca: conModelo }).nombre, C.madurez(eje, compra, { epoca: conModelo }).de], ['hecha', 2]);
  // El módulo no lleva escrita ninguna etiqueta, orden, disposición, nivel ni tamaño de la época.
  const fuente = readFileSync(new URL('../src/contrato.js', import.meta.url), 'utf8');
  const literales = new Set([...fuente.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1]));
  const raiz = EPOCA_0_BTML.registro;
  const palabras = [
    ...raiz[5][0].map((r) => r[0][0]), ...raiz[5][1].map((r) => r[0][0]),
    ...C.niveles(), ...C.ordenes().map((x) => x.nombre), ...raiz[8][3][2].map((x) => x[0][0]), ...C.tamanos().map((t) => t.nombre),
    ...C.plantillas(eje).flatMap((p) => p.registro.filter(Array.isArray).map((d) => d[0]?.[0]).filter((x) => typeof x === 'string')),
    ...raiz[9][5][1].filter((f) => f !== 'ref'),
  ];
  for (const p of palabras) assert.ok(!literales.has(p), 'src/contrato.js lleva escrito «' + p + '»');
});

test('el índice expone el contrato como espacio de nombres', async () => {
  const agram = await import('../src/index.js');
  assert.equal(agram.contrato.plantilla, C.plantilla);
  assert.equal(typeof agram.contrato.division, 'function');
  assert.equal(typeof agram.plantilla, 'undefined', 'ningún nombre plano nuevo');
});

// ---------- 9. las opciones de una posición (issue #5: «desplegables en todas partes») ----------

test('opciones (a): el 5 lista las plantillas que hay; un tipo `ref` que nombra una plantilla, los registros de esa plantilla; `identity`, las identidades del eje; cada uno con su legible', async () => {
  const { eje: e, compra: c, menu: m } = await ejemploCompra();
  assert.deepEqual(C.opciones(e, c.id, 5).map((o) => o.valor), [...new Set(C.plantillas(e).map((p) => p.nombre))]);
  const es = C.opciones(e, c.id, 5, { idioma: 'es' }).find((o) => o.valor === 'purchase');
  assert.equal(es.texto, C.texto(e, C.claves.plantilla('purchase'), 'es', { original: 'purchase' }), 'el nombre de la plantilla, traducido');
  // el 3 de una compra es `identity`: las identidades del eje, por el 0 de su alta
  assert.deepEqual(C.tipo(e, c.id, 3), ['identity']);
  assert.deepEqual(C.opciones(e, c.id, 3).map((o) => o.valor), e.identidades());
  assert.deepEqual(C.opciones(e, c.id, 3).map((o) => o.texto), e.identidades().map((i) => C.legible(e, i, ['identity']).texto));
  // una época cuya plantilla «opinion» dice en su 6 «ref purchase»: las opciones son las compras del eje
  const epoca = epocaCon((x) => { x[9][2][4][6][1] = ['ref', 'purchase']; });
  const T = '2026-11-07T18:00:00Z';
  const op = await e.escribir({ autor: 'huesped', sobre: m.id, t: T, movimientos: [minuto('huesped')], payload: ['me gusta', 'x', 'y', 'huesped', 'z', 'opinion'] });
  assert.deepEqual(C.opciones(e, op.id, 6, { epoca }), [{ valor: c.id, texto: C.legible(e, { ref: c.id }, null).texto }]);
  assert.deepEqual(C.opciones(e, op.id, 6), [], 'con la época de siempre, su 6 es un `ref` sin plantilla y no tiene hermanos');
  assert.deepEqual(C.opciones(e, 'f'.repeat(64), 0), [], 'un registro que no está, sin opciones');
});

test('opciones (b): las enumeraciones de la época: el pintado (su validación), el idioma (epoch.9.4), el modelo (epoch.9.7.0.5), los niveles (epoch.8.4), un rango de dígitos y la lista del defecto «=first …» de un parámetro', async () => {
  const { eje: e, compra: c } = await ejemploCompra();
  const T = '2026-11-07T18:00:00Z';
  const mias = await e.escribir({ autor: 'huesped', sobre: e.alta('huesped').id, en: '9000000000', t: T, movimientos: [minuto('huesped')], payload: ['preferences', 20, 'animated', 'es', [1, 3], 'preferences', 'general'] });
  assert.deepEqual(C.opciones(e, mias.id, 2).map((o) => o.valor), ['sober', 'own', 'animated'], 'la validación «="sober" in it.2 or "own" in it.2 or "animated" in it.2»');
  assert.deepEqual(C.opciones(e, mias.id, 3).map((o) => o.valor), C.idiomas());
  assert.equal(C.opciones(e, mias.id, 3).find((o) => o.valor === 'es').texto, EPOCA_0_BTML.registro[9][4].slice(1).find((r) => r[0].includes('es'))[0][1], 'con el nombre del idioma de su registro de mensajes');
  const cabecera = EPOCA_0_BTML.registro[9][7][0];
  assert.equal(cabecera[5][0], '9360000000', 'la cabecera de los modelos nombra la preferencia del 6');
  assert.deepEqual(new Set(C.opciones(e, mias.id, 6).map((o) => o.valor)), new Set(cabecera[2]), 'los modelos de la época');
  assert.deepEqual(C.opciones(e, mias.id, 1), [], 'el paso es un número sin enumeración ni hermanos');
  assert.deepEqual(C.opciones(e, c.id, 8).map((o) => o.valor), C.niveles(), 'el 8 de una compra es un `level`');
  assert.deepEqual(C.opciones(e, c.id, 8, { idioma: 'es' }).map((o) => o.texto), C.niveles({ idioma: 'es' }));
  // un parámetro: «=it >= 0 and it <= 9» son los dígitos; el defecto «=first epoch.9.0.1.2», la lista de la que toma el primero
  const precio = A.parametros(A.plantillaDeTransaccion('set a group price')).find((p) => p.nombre === 'zone');
  assert.deepEqual(C.opciones(e, c.id, null, { parametro: precio }).map((o) => o.valor), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const criterio = A.parametros(A.plantillaDeTransaccion('commit time')).find((p) => p.nombre === 'criteria');
  assert.deepEqual(C.opciones(e, c.id, null, { yo: 'huesped', parametro: criterio }).map((o) => o.valor), [CERRADO]);
  const serie = A.parametros(A.plantillaDeTransaccion('commit time')).find((p) => p.nombre === 'series');
  const mis = C.opciones(e, c.id, null, { yo: 'huesped', parametro: serie }).map((o) => o.valor);
  assert.ok(mis.length >= 1 && mis.every((s) => C.yo(e, 'huesped').cartera.some((x) => x.serie === s) && !s.startsWith('T:')), 'las series de mi cartera que no son T: ' + mis);
  // un tipo que no es simple (una décupla) se edita en BTML: sin lista
  const pago = A.parametros(A.plantillaDeTransaccion('issue E tied to X')).find((p) => p.nombre === 'price');
  assert.deepEqual(C.opciones(e, c.id, null, { yo: 'huesped', parametro: pago }), []);
});

test('opciones (c): sin referencia ni enumeración, lo ya escrito en esa posición en los registros hermanos (mismo padre, misma plantilla), sin repetir y sin el propio', async () => {
  const H = await ejemploComprasHermanas();
  const ceros = (r) => C.opciones(H.eje, r.id, 0).map((o) => o.valor);
  assert.ok(ceros(H.fruta).length >= 1);
  assert.ok(!ceros(H.fruta).includes(C.representaciones(H.eje, H.fruta.id)[0].texto), 'el propio no es una opción');
  assert.ok(ceros(H.fruta).includes(C.representaciones(H.eje, H.compra.id)[0].texto), 'el 0 de una compra hermana sí');
  assert.ok(!ceros(H.fruta).includes(C.representaciones(H.eje, H.cena?.id ?? H.compraCena.id)[0]?.texto), 'una compra de otro padre no');
  assert.equal(new Set(ceros(H.fruta)).size, ceros(H.fruta).length, 'sin repetir');
  assert.ok(C.opciones(H.eje, H.fruta.id, 4).every((o) => !(typeof o.valor === 'string' && o.valor.startsWith('='))), 'una fórmula no es un valor que se elija');
  // un parámetro: lo ya escrito en esa posición por los registros anclados donde anclará la acción
  const { eje: e, compra: c } = await ejemploCompra();
  const texto = A.parametros(A.plantillaDeTransaccion('write to X')).find((p) => p.nombre === 'text');
  assert.deepEqual(C.opciones(e, c.id, null, { parametro: { ...texto, en: '3000000000' } }), []);
  await e.escribir({ autor: 'huesped', sobre: c.id, en: '3000000000', t: '2026-11-07T18:00:00Z', movimientos: [minuto('huesped')], payload: ['¿hay pan?'] });
  assert.deepEqual(C.opciones(e, c.id, null, { parametro: { ...texto, en: '3000000000' } }), [{ valor: '¿hay pan?', texto: '¿hay pan?' }]);
});

// ---------- 10. lo que el núcleo mide de cada hijo de los mundos 2 y 3 (encargo «datos», issue #11) ----------

/** La compra con su jardín y su parque (ejemplos/ikisai/compra-food.mjs, ejemploJardinYParque). */
async function jardinYParque() {
  const c = await ejemploCompra();
  await ejemploCuenta(c.eje, c.compra);
  return { ...c, ...(await ejemploJardinYParque(c.eje, c)) };
}
const filaDelMundo = (e, pv) => e[8][7][1].find((f) => f[0][0] === pv);
const sinOcupantes = (hijos) => hijos.map(({ ocupantes, nombre, ...h }) => h);

test('epoch.8.7: la posición 8 de cada fila es el enlace (dato de la época); el 2 mide el P por mirada y el recuento, el 3 los grupos (las cajas de personas, encargo pv3) y los paquetes', () => {
  const d = (pv) => C.divisionDelMundo(null, pv);
  assert.deepEqual([d(2).mide, d(2).enlace], [['epoch.1.1', 'epoch.9.0.0'], [1, 2, 3, 4, 5]]);
  // el 3 por tema (VG, 12-11): sus hijos son las cajas 0-5, numeradas como los PV; el dígito es la caja, sin enlace
  assert.deepEqual([d(3).hijos, d(3).mide, 'enlace' in d(3)], [[0, 1, 2, 3, 4, 5], ['groups', 'attended'], false]);
  for (const pv of [0, 5, 4, 6, 7, 9]) assert.equal('enlace' in d(pv), false, 'sin enlace en el ' + pv);
  // el del 8 es la escalera dulce, una dirección por caja (encargo «el4»); el del 4, los dos ejes de la matriz (ejes, no enlace)
  assert.deepEqual(d(8).enlace, C.escalera().map((p) => p.direccion));
  assert.deepEqual(d(4).ejes, C.ejesDeLaMatriz());
  // el enlace del 2 son las miradas de epoch.1.1, uno por hijo
  const raiz = EPOCA_0_BTML.registro;
  assert.deepEqual(d(2).enlace, raiz[1][1][1].map((m) => m[1][0]));
  assert.equal(d(2).enlace.length, d(2).hijos.length);
  // las cajas del 3 son las zonas de epoch.1.2.1, una por hijo (el dígito es la zona)
  assert.deepEqual(d(3).hijos, raiz[1][2][1].map((z) => z[1][0]));
  assert.match(raiz[8][7][2][1], /^Encargo «datos» \(issue #11/, 'con su procedencia');
});

test('hijosDe en el 2: cada hijo, su mirada y el P sobre ella (comprometido y reposicionable, de todos sus titulares); el umbral solo si el criterio del dueño dice esa mirada', async () => {
  const { eje, compra, decision } = await jardinYParque();
  // La compra: la huésped bajó su P a la mirada 2 (once) y comprometió cinco con la decisión; el criterio de la compra no dice ninguna mirada.
  assert.deepEqual(sinOcupantes(C.hijosDe(eje, compra.id, 2)).map((h) => [h.digito, h.mirada, h.comprometidos, h.reposicionables, 'umbral' in h]), [
    [1, 1, 0, 0, false], [2, 2, 5, 6, false], [3, 3, 0, 0, false], [4, 4, 0, 0, false], [5, 5, 0, 0, false],
  ]);
  assert.deepEqual(miradasDe(eje, compra.id), []);
  // La decisión dice «view 2» y «above 10»: el hijo 2 lleva su recuento (siete comprometidos: cinco de la compra y dos suyos) y le faltan tres.
  assert.deepEqual(miradasDe(eje, decision.id), [2]);
  const r = recuento(eje, decision.id);
  assert.deepEqual([r.plantilla, r.valor, r.umbral, r.pasa], ['weighted sum', 7, 10, false]);
  const hijos = C.hijosDe(eje, decision.id, 2, { nivel: 2 });
  const dos = hijos.find((h) => h.digito === 2);
  assert.deepEqual([dos.mirada, dos.comprometidos, dos.reposicionables, dos.umbral, dos.valor, dos.pasa, dos.faltan], [2, 2, 9, 10, 7, false, 3]);
  assert.equal(dos.faltan, r.umbral - r.valor);
  assert.ok(hijos.filter((h) => h.digito !== 2).every((h) => !('umbral' in h)), 'el umbral solo en la mirada que dice el criterio');
  // Las mismas cifras que yo() da por titular: la suma del P posicionado sobre la mirada 2 de la decisión.
  const mio = C.yo(eje, 'huesped').criterio.posicionado.find((p) => p.registro === decision.id && p.mirada === 2);
  assert.deepEqual([mio.cuanto - mio.disponible, mio.disponible], [dos.comprometidos, dos.reposicionables]);
  // Comprometer cuatro más (de la mirada 2 de la decisión) la hace pasar: ya no le falta nada.
  const mas = await A.transaccion(eje, 'commit P', { X: decision.id, power: 'P:' + decision.id + '.2/huesped', amount: 4 }, 'huesped', { t: '2026-11-07T16:00:00Z' });
  assert.equal(mas.ok, true, JSON.stringify(mas.motivos));
  await eje.anadir(mas.evento);
  const despues = C.hijosDe(eje, decision.id, 2, { nivel: 2 }).find((h) => h.digito === 2);
  assert.deepEqual([despues.comprometidos, despues.reposicionables, despues.valor, despues.pasa, despues.faltan], [6, 5, 11, true, 0]);
});

test('hijosDe en el 2 sale de la época: sin el recuento en lo que mide no hay umbral; sin enlace no hay mirada; otro enlace mueve el P a otro hijo', async () => {
  const { eje, compra, decision } = await jardinYParque();
  const con = (cambiar) => epocaCon((e) => cambiar(filaDelMundo(e, 2)));
  const dosDe = (epoca) => C.hijosDe(eje, decision.id, 2, { nivel: 2, epoca }).find((h) => h.digito === 2);
  const sinRecuento = dosDe(con((f) => { f[4] = ['epoch.1.1']; }));
  assert.deepEqual([sinRecuento.comprometidos, 'umbral' in sinRecuento], [2, false]);
  const sinEnlace = dosDe(con((f) => { f[8] = ['-']; }));
  assert.equal(['mirada', 'comprometidos', 'umbral'].some((k) => k in sinEnlace), false);
  const alReves = C.hijosDe(eje, compra.id, 2, { epoca: con((f) => { f[8] = [5, 4, 3, 2, 1]; }) });
  assert.deepEqual(alReves.map((h) => [h.digito, h.mirada, h.comprometidos]), [[1, 5, 0], [2, 4, 0], [3, 3, 0], [4, 2, 5], [5, 1, 0]]);
  // Un registro que no está en el eje no mide nada; los otros mundos, tampoco.
  assert.equal(C.hijosDe(eje, 'no-existe', 2).some((h) => 'mirada' in h), false);
  assert.equal(C.hijosDe(eje, compra.id, 1).some((h) => 'mirada' in h || 'precio' in h || 'estados' in h), false);
});

test('hijosDe en el 3 por tema (encargo pv3, VG 12-11): las seis cajas 0-5 con el nombre de su grupo (epoch.1.2.1), cada una con sus personas y no con lo anclado en X.d; doy y recibo, el canal de R de la pareja; sin «groups» en lo que mide, lo anclado como antes', async () => {
  const { eje, compra } = await jardinYParque();
  const zonas = EPOCA_0_BTML.registro[1][2][1];
  const hijos = C.hijosDe(eje, compra.id, 3, { idioma: 'es' });
  assert.deepEqual(hijos.map((h) => [h.digito, h.nombre]), zonas.map((z) => [z[1][0], z[0][0]]));
  // la huésped (dueña de la compra) habla con la casa en el 3 de la compra devolviéndole su R: sin tema, la caja 0
  assert.deepEqual(hijos.map((h) => h.ocupantes), [['casa'], [], [], [], [], []]);
  const casa = hijos[0].personas[0];
  assert.deepEqual([casa.identidad, casa.texto, casa.alta, casa.doy, casa.recibo, casa.porque], ['casa', C.legible(eje, 'casa', 'identity', { idioma: 'es' }).texto, eje.alta('casa').id, eje.saldo('casa', 'R:huesped'), eje.saldo('huesped', 'R:casa'), 'bandeja']);
  assert.deepEqual(hijos.map((h) => [h.vacio, h.total]), [[false, 1], [true, 0], [true, 0], [true, 0], [true, 0], [true, 0]]);
  // gruposDelTres da lo mismo, con el filtro de cada caja (el botón: doy, recibo, todos)
  const g = C.gruposDelTres(eje, compra.id, { filtros: { 0: 'doy' } });
  assert.deepEqual([g[0].filtro, g[0].total, g[0].personas.length], ['doy', 1, casa.doy > 0 ? 1 : 0]);
  // sin los grupos en lo que mide, los hijos vuelven a ser lo anclado en X.d (la regla general de hijosDe)
  const sinGrupos = epocaCon((e) => { filaDelMundo(e, 3)[4] = ['attended']; });
  assert.equal(C.hijosDe(eje, compra.id, 3, { epoca: sinGrupos }).some((h) => 'personas' in h), false);
});

test('el estado de cada paquete del 3: una petición de atención (R devuelta a su emisor) pendiente o atendida, una R perdonada; lo demás, null; en la conversación con una persona (contrato.conversacionDelTres), el chat con el estado de cada uno', async () => {
  const { eje, compra, conversacion, atendida, respuesta, pendiente, perdonada } = await jardinYParque();
  assert.deepEqual([atendida, pendiente, perdonada, respuesta, conversacion].map((r) => estadoDePaquete(eje, r.id)), ['atendido', 'pendiente', 'perdonado', null, null]);
  assert.equal(estadoDePaquete(eje, 'no-existe'), null);
  const c = C.conversacionDelTres(eje, compra.id, 'casa', { idioma: 'es' });
  assert.deepEqual([c.dueno, c.persona, c.caja, c.nombre, c.capas.map((k) => k.capa)], ['huesped', 'casa', 0, 'desconocidos', [0]]);
  assert.deepEqual(c.capas[0].items.map((i) => [i.ref, i.estado]), [[conversacion.id, null], [atendida.id, 'atendido'], [respuesta.id, null], [pendiente.id, 'pendiente'], [perdonada.id, 'perdonado']]);
  // por el alta de la persona también (la carta entra en ella por su alta)
  assert.deepEqual(C.conversacionDelTres(eje, compra.id, eje.alta('casa').id).capas[0].items.length, 5);
});

// ---------- 11. lo que el núcleo mide de cada hijo del 1 (encargo «datos2», issue #11) ----------

/** La compra con su cuenta y su fábrica (ejemplos/ikisai/compra-food.mjs, ejemploFabrica): coste, capacidad y lo que entra y sale. */
async function conFabrica() {
  const c = await ejemploCompra();
  await ejemploCuenta(c.eje, c.compra);
  return { ...c, ...(await ejemploFabrica(c.eje, c)) };
}
/** La denominación de una serie de E sin su registro: «1100000000@2026-11-20». */
const denominacion = (serie) => serie.split('/')[1].replace(/@[0-9a-f]{64}$/, '');

test('epoch.8.7: el 1 mide el coste, la capacidad y lo que entra y sale; su enlace dice qué hijo mide qué (1 el coste, 2 la capacidad, 3 lo que entra y sale, 4 nada)', () => {
  const d = C.divisionDelMundo(null, 1);
  assert.deepEqual([d.mide, d.enlace], [['epoch.9.2', 'capacity', 'epoch.4.0'], ['epoch.9.2', 'capacity', 'epoch.4.0', null]]);
  assert.equal(d.enlace.length, d.hijos.length, 'uno por hijo, con null donde la fila pone «-»');
  assert.ok(d.enlace.filter(Boolean).every((ref) => d.mide.includes(ref)), 'cada enlace es una referencia de lo que la fila mide');
  assert.match(EPOCA_0_BTML.registro[8][7][2][3], /^Encargo «datos2» \(issue #11/, 'con su procedencia');
});

test('hijosDe en el 1 de la compra: el coste del 1.2 de su plantilla (hijo 1), la capacidad que declara por el aro (hijo 2) y lo que sale de su dueño (hijo 3); el 4 no mide nada', async () => {
  const { eje, compra, capacidad } = await conFabrica();
  const h = sinOcupantes(C.hijosDe(eje, compra.id, 1));
  assert.deepEqual(h[0].coste, { posicion: '1.2', cuanto: 12, unidad: 'EUR', texto: 'EUR 12' });
  // «declare capacity or threshold» de la huésped en el 2.2 de la compra: dos a la vez; no hay E atado a la compra, nada comprometido
  assert.deepEqual(['capacidad', 'comprometido', 'disponible', 'franja', 'declara'].map((k) => h[1][k]), [2, 0, 2, '', capacidad.id]);
  // lo que entra y sale, visto desde la huésped: paga 12 EUR a la cocina con la compra y 12 más con el pago de lo que
  // anunció (ejemploFabrica: anclado sobre su anuncio, VG 12-11, decisión 8), y quema su T al escribir (la compra, una
  // hora; lo demás, minutos)
  const quemado = C.diario(eje, compra.id, 0, 1e9).entradas.flatMap((e) => e.movimientos).filter((m) => m.serie === 'T:minuto' && m.de === 'huesped' && m.primitiva === 'quemar').reduce((s, m) => s + m.cantidad, 0);
  assert.ok(quemado > 0);
  assert.deepEqual(h[2].entradas, []);
  assert.deepEqual(h[2].salidas.map((x) => [x.serie, x.cantidad, x.con]), [['T:hora', 1, [null]], ['E:casa/EUR', 24, ['cocina']], ['T:minuto', quemado, [null]]]);
  // la cuenta la escribe la cocina: su T es de la cocina, no sale de la huésped; la asignación del día no cuenta como entrada
  assert.equal(h[2].salidas.some((x) => x.con.includes('huesped')), false);
  assert.deepEqual([h[0], h[1], h[2], h[3]].map((x) => ['coste', 'capacidad', 'entradas'].filter((k) => k in x)), [['coste'], ['capacidad'], ['entradas'], []]);
});

test('hijosDe en el 1 de la reserva: el coste llega por referencia (el precio de la plaza), la capacidad es la del Alojamiento con lo comprometido por noche, y entran las plazas y salen los euros', async () => {
  const r = await ejemploReserva();
  const h = sinOcupantes(C.hijosDe(r.eje, r.reserva.id, 1));
  assert.deepEqual([h[0].coste.cuanto, h[0].coste.unidad], [55, 'EUR']);
  // el Alojamiento declara 4 plazas por noche (su 2: el tope del eje); la noche más apretada es una de las de la reserva: una cama entregada
  assert.deepEqual([h[1].capacidad, h[1].comprometido, h[1].disponible, h[1].franja, h[1].declara], [4, 1, 3, '2026-11-20', r.alojamiento.id]);
  assert.equal(h[1].capacidad, r.eje.topes(r.reserva.id).find((x) => x.franja === '2026-11-20').capacidad);
  // a la huésped le entran las tres noches de la cama individual (de la casa) y le salen los euros (a la casa) y su T
  assert.deepEqual(h[2].entradas.map((x) => [denominacion(x.serie), x.cantidad, x.con]), ['2026-11-20', '2026-11-21', '2026-11-22'].map((n) => ['1100000000@' + n, 1, ['casa']]));
  assert.deepEqual(h[2].salidas.find((x) => x.serie === 'E:casa/EUR'), { serie: 'E:casa/EUR', cantidad: 165, con: ['casa'] });
  // la habitación no tiene plantilla: sin coste; su capacidad es la misma (la del Alojamiento, en su hilo)
  const hab = sinOcupantes(C.hijosDe(r.eje, r.habitacion.id, 1));
  assert.equal('coste' in hab[0], false);
  assert.deepEqual([hab[1].capacidad, hab[1].disponible], [4, 3]);
  // un registro sin nadie que declare capacidad en su hilo, sin capacidad
  assert.equal('capacidad' in C.hijosDe(eje, compra.id, 1)[1], false);
});

test('lo que mide cada hijo del 1 sale de la época: otro enlace lo mueve de hijo; sin la referencia en lo que mide, no se da', async () => {
  const { eje, compra } = await conFabrica();
  const otro = epocaCon((e) => { filaDelMundo(e, 1)[8] = ['-', 'epoch.4.0', 'capacity', 'epoch.9.2']; });
  const h = C.hijosDe(eje, compra.id, 1, { epoca: otro });
  assert.deepEqual(h.map((x) => ['coste', 'capacidad', 'entradas'].filter((k) => k in x)), [[], ['entradas'], ['capacidad'], []], 'el 4.2 de la compra no es una magnitud: sin coste');
  const sinCapacidad = epocaCon((e) => { filaDelMundo(e, 1)[4] = ['epoch.9.2', 'epoch.4.0']; });
  assert.equal(C.hijosDe(eje, compra.id, 1, { epoca: sinCapacidad }).some((x) => 'capacidad' in x), false);
  const sinEnlace = epocaCon((e) => { filaDelMundo(e, 1)[8] = ['-']; });
  assert.equal('enlace' in C.divisionDelMundo(null, 1, { epoca: sinEnlace }), false);
  assert.equal(C.hijosDe(eje, compra.id, 1, { epoca: sinEnlace }).some((x) => 'coste' in x || 'capacidad' in x || 'entradas' in x), false);
});

// ---------- encargo «datos3» (issue #11, tercera parte): los mundos 6/7, 8 y 9 ----------

/** La compra con la cuenta, la fábrica y su futuro y su cohorte (ejemploFuturoYCohorte), firmado si se dan claves. */
async function conFuturo(claves = {}) {
  const c = await ejemploCompra({ claves });
  const privadas = Object.fromEntries(Object.entries(claves).map(([k, v]) => [k, v?.privada]));
  const cuenta = await ejemploCuenta(c.eje, c.compra, privadas.cocina);
  const fabrica = await ejemploFabrica(c.eje, c, privadas);
  return { ...c, cuenta, ...fabrica, ...(await ejemploFuturoYCohorte(c.eje, c, privadas)), privadas };
}

test('diario: cada entrada con el PV de X del que cuelga (su «en», o la posición de su padre a la que se refiere) y el estado de su futuro', async () => {
  const c = await conFuturo();
  const d = C.diario(c.eje, c.compra.id, 0, 100).entradas;
  const de = (ev) => d.find((e) => e.id === ev.id);
  assert.equal(de(c.compra).pv, 0, 'X mismo, el centro');
  assert.equal(de(c.cuenta).pv, 1, 'la cuenta modifica el 1 de la compra');
  assert.equal(de(c.pagar).pv, 4, 'un anuncio del 4.1');
  // VG 12-11 (#64 c): «declare future T» es un anuncio de T con fecha en el 4.1 (cuelga del 4), previsto en su fecha.
  assert.deepEqual([de(c.manana).pv, de(c.semana).pv, de(c.plazo).pv, de(c.cohorte).pv], [4, 4, 7, 8]);
  assert.deepEqual([de(c.manana).estado, de(c.cuenta).estado], [{ tipo: 'previsto', fecha: '2026-11-08T13:30:00Z', serie: 'T:minuto', cantidad: 1 }, null]);
  assert.deepEqual(de(c.nochebuena).estado, { tipo: 'previsto', fecha: '2026-12-24T20:00:00Z', serie: 'T:futuro', cantidad: 3 }, 'el T futuro informativo de antes se lee igual');
  // anclada en la raíz del menú, la compra se refiere a su 1 ({ ref: menu, dir: '1000000000' }): cuelga del 1 del menú
  assert.equal(C.pvDeEntrada(c.eje, c.menu.id, c.compra.id), 1);
  assert.equal(C.pvDeEntrada(c.eje, c.compra.id, c.menu.id), null, 'el menú no cuelga de la compra');
  // un registro anclado en la raíz sin referencia a su padre: el centro
  const suelto = await c.eje.escribir({ autor: 'casa', sobre: c.compra.id, t: '2026-11-07T17:00:00Z', movimientos: [minuto('casa')], payload: [['Nota suelta']] });
  assert.equal(C.pvDeEntrada(c.eje, c.compra.id, suelto.id), 0);
  const nieto = await c.eje.escribir({ autor: 'casa', sobre: c.cuenta.id, en: '3000000000', t: '2026-11-07T17:01:00Z', movimientos: [minuto('casa')], payload: [['Sobre la cuenta']] });
  assert.equal(C.pvDeEntrada(c.eje, c.compra.id, nieto.id), 3, 'el de la posición que modificó, aunque cuelgue de la cuenta');
});

test('estadoDeEntrada: previsto (T futuro con su «when»), bloqueado hasta y liberado (un bloqueo con fecha), caduca y caducado (la caducidad de una emisión de E o la quema de E propia)', async () => {
  const c = await conFuturo();
  // En BQL desde VG 12-11: los estados de epoch.7.4 sobre el movimiento con fecha (X.7.9); el previsto también dice su serie.
  // «declare future T» anuncia T real con fecha (VG 12-11, #64 c): previsto, con la serie anunciada; el T futuro de antes, igual.
  assert.deepEqual(C.estadoDeEntrada(c.eje, c.semana.id), { tipo: 'previsto', fecha: '2026-11-12T20:00:00Z', serie: 'T:minuto', cantidad: 2 });
  assert.deepEqual(C.estadoDeEntrada(c.eje, c.nochebuena.id), { tipo: 'previsto', fecha: '2026-12-24T20:00:00Z', serie: 'T:futuro', cantidad: 3 });
  const plazo = C.estadoDeEntrada(c.eje, c.plazo.id);
  assert.deepEqual([plazo.tipo, plazo.fecha, plazo.cantidad], ['bloqueado', '2026-11-30T12:00:00Z', 5]);
  assert.equal(c.eje.bloqueado('huesped', plazo.serie, plazo.fecha), 5, 'sigue bloqueado en el libro');
  // liberarlo: el mismo registro ya dice «liberado» (la fecha era la salida)
  const bloqueo = c.eje.obtener(c.plazo.id).movimientos.find((m) => m.estado === 'bloqueo');
  await c.eje.escribir({ autor: 'huesped', sobre: c.compra.id, en: '7000000000', t: '2026-11-07T17:00:00Z', movimientos: [minuto('huesped'), { ...bloqueo, estado: 'liberacion' }], payload: [['Libero el plazo']] });
  assert.equal(C.estadoDeEntrada(c.eje, c.plazo.id).tipo, 'liberado');
  // una emisión de E con caducidad: caduca antes de la fecha, caducada después (el reloj del libro o `t`)
  const emite = await c.eje.escribir({ autor: 'casa', sobre: c.compra.id, en: '1000000000', t: '2026-11-07T17:02:00Z', movimientos: [minuto('casa'), { token: 'E', emisor: 'casa', denominacion: 'bono', cantidad: 3, de: null, a: 'casa', caduca: '2026-11-09T00:00:00Z' }], payload: [['Bonos de la casa']] });
  assert.equal(C.estadoDeEntrada(c.eje, emite.id).tipo, 'caduca');
  assert.equal(C.estadoDeEntrada(c.eje, emite.id, { t: '2026-11-10T00:00:00Z' }).tipo, 'caducado');
  const quema = await c.eje.escribir({ autor: 'casa', sobre: c.compra.id, en: '7000000000', t: '2026-11-07T17:03:00Z', movimientos: [minuto('casa'), { token: 'E', emisor: 'casa', denominacion: 'bono', cantidad: 1, de: 'casa', a: null }], payload: [['Caduco un bono']] });
  assert.equal(C.estadoDeEntrada(c.eje, quema.id).tipo, 'caducado');
  assert.equal(C.estadoDeEntrada(c.eje, c.cuenta.id), null);
});

test('la franja de una entrada del 7 es la de la fecha a la que se refiere (epoch.7.0 desde el reloj del libro) y, si no tiene, la de su escala; sin incongruencia de escala (#42): rara solo con los tres relojes fuera de orden', async () => {
  const c = await conFuturo();
  const escalas = Object.fromEntries(C.divisionDelMundo(c.eje, 7).bandas.map((b) => [b.nombre, b.escala]));
  // el reloj del libro es el del último registro (2026-11-07T16:13): mañana a las 13:30 cae en «día», el 12 en «semana», el 30 en «ciclo»
  assert.deepEqual([c.manana, c.semana, c.plazo].map((x) => C.franjaDeEntrada(c.eje, x.id, 7).k), [escalas['día'], escalas.semana, escalas.ciclo]);
  assert.deepEqual(C.franjaDeEntrada(c.eje, c.manana.id, 7), { k: escalas['día'], paso: 'cuando', rara: false }, 'declara un minuto (lo que quema al escribir) y por su fecha le toca un día: ya no es incongruente (#42)');
  assert.equal(pasoDe(c.eje, c.manana.id, 'cuando').k, escalas['día'], 'el paso «cuando» de epoch.9.8 (una fórmula BQL sobre X.7.7 y before.6.0)');
  assert.deepEqual(C.franjaDeEntrada(c.eje, c.cuenta.id, 7), { k: escalas.minuto, paso: 'escala', rara: false }, 'sin fecha, por su escala');
  assert.deepEqual(C.franjaDeEntrada(c.eje, c.cuenta.id, 6), { k: escalas.minuto, paso: 'escala', rara: false }, 'el 6, solo por su escala');
  // con otro reloj, otra franja; más allá del año, la más gruesa; sin fecha, ninguna
  assert.equal(pasoDe(c.eje, c.semana.id, 'cuando', { t: '2026-11-12T19:30:00Z' }).k, escalas.hora);
  assert.equal(pasoDe(c.eje, c.semana.id, 'cuando', { t: '2029-01-01T00:00:00Z' }).k, escalas['año']);
  assert.equal(pasoDe(c.eje, c.cuenta.id, 'cuando').k, null);
  assert.equal('escalaDeFecha' in C, false, 'when scale cayó a BQL: ya no hay escalaDeFecha en JavaScript');
  // es un dato de la época: sin «cuando» en lo que mide el 7, todo por su escala
  const sinCuando = epocaCon((e) => { filaDelMundo(e, 7)[4] = ['epoch.1.3', 'epoch.7', 'escala']; });
  assert.deepEqual(C.franjaDeEntrada(c.eje, c.manana.id, 7, { epoca: sinCuando }), { k: escalas.minuto, paso: 'escala', rara: false });
});

test('cohortes y cohorteDe: las que admite «change cohort» (su validación), la que eligió el dueño, los comparables por caja de su cuota en ella y quién escribió la base', async () => {
  const claves = {};
  for (const id of ['casa', 'cocina', 'huesped']) claves[id] = await generarClaves();
  const c = await conFuturo(claves);
  assert.deepEqual(C.cohortes({ idioma: 'es' }), [
    { valor: 'siblings', alcance: 'hermanos', texto: 'hermanos' }, { valor: 'project', alcance: 'proyecto', texto: 'proyecto' }, { valor: 'genesis', alcance: 'general', texto: 'general' },
  ]);
  assert.deepEqual(C.divisionDelMundo(null, 8, { idioma: 'es' }).cohortes.map((x) => x.valor), ['siblings', 'project', 'genesis']);
  // la elegida por la huésped («change cohort» en el 8 de la compra): el proyecto (las altas del fin de semana)
  const p = C.cohorteDe(c.eje, c.compra.id);
  assert.deepEqual([p.cohorte, p.alcance, p.elegida, p.registro], ['project', 'proyecto', 'project', c.alta.id]);
  assert.ok(p.comparables.some((x) => x.ref === c.menu.id) && p.comparables.some((x) => x.ref === c.cuenta.id), 'el subárbol del proyecto');
  assert.deepEqual(p.base, { escrita: false, registro: c.alta.id, texto: SIN_BASE_ESCRITA });
  for (const x of p.comparables) assert.ok(x.caja === null || (Number.isInteger(x.caja) && x.caja >= 0 && x.caja <= 9));
  assert.equal(p.caja, p.comparables.find((x) => x.foco).caja);
  // pedida: los hermanos (solo la compra sobre el menú): toda la cuota es suya, la caja 9, la misma que el paso «cuota»
  const h = C.cohorteDe(c.eje, c.compra.id, { cohorte: 'hermanos' });
  assert.deepEqual([h.cohorte, h.comparables.map((x) => x.ref), h.caja], ['siblings', [c.compra.id], pasosDe(c.eje, c.compra.id).cuota.k]);
  // la base escrita en el 8 del proyecto: quién y cuándo
  const base = await escribirBase(c.eje, { registro: c.alta.id, autor: 'casa', privada: claves.casa.privada, t: '2026-11-07T18:00:00Z' });
  assert.deepEqual(C.cohorteDe(c.eje, c.compra.id).base, { escrita: true, id: base.id, autor: 'casa', t: '2026-11-07T18:00:00Z', registro: c.alta.id });
  // el formulario de «change cohort» lista las tres (opciones b: su validación es una enumeración) y no admite otra
  const param = A.parametros(A.plantillaDeTransaccion('change cohort')).find((x) => x.nombre === 'cohort');
  assert.deepEqual(C.opciones(c.eje, c.compra.id, null, { parametro: param }).map((x) => x.valor), ['siblings', 'project', 'genesis']);
  const otra = await A.transaccion(c.eje, 'change cohort', { X: c.compra.id, cohort: 'barrio' }, 'huesped', {});
  assert.equal(otra.ok, false);
});

test('hijosDe en el 8: las diez cajas de los hitos como hijos, con los comparables de la cohorte en la caja de su rango (un solo rango, encargo «el4»), la cohorte y la base', async () => {
  const c = await conFuturo();
  const h = C.hijosDe(c.eje, c.compra.id, 8);
  assert.deepEqual(h.map((x) => [x.digito, x.nombre]), HITOS.map((x) => [x.indice, x.nombre]));
  const co = C.cohorteDe(c.eje, c.compra.id);
  for (const x of h) {
    assert.deepEqual(x.comparables.map((y) => y.ref), co.comparables.filter((y) => y.rango === x.digito).map((y) => y.ref));
    assert.deepEqual([x.total, x.vacio, x.cohorte, x.base], [x.comparables.length, x.comparables.length === 0, 'project', co.base]);
  }
  assert.deepEqual(h.filter((x) => x.foco).map((x) => x.digito), [co.rango]);
  assert.equal(co.rango, C.rango(c.eje, c.compra.id).peldano);
  assert.ok(co.comparables.every((x) => x.rango === C.rango(c.eje, x.ref).peldano));
  // la caja de su cuota sigue ahí, como medida
  assert.ok(co.comparables.every((x) => x.caja === null || (Number.isInteger(x.caja) && x.caja >= 0 && x.caja <= 9)));
  assert.deepEqual(C.hijosDe(c.eje, c.compra.id, 8, { cohorte: 'siblings' }).map((x) => x.total), [1, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  // sin «cohort» en lo que mide el 8, como antes: sin hijos
  const sin = epocaCon((e) => { filaDelMundo(e, 8)[4] = ['hitos', 'cuota']; });
  assert.deepEqual(C.hijosDe(c.eje, c.compra.id, 8, { epoca: sin }), []);
});

// ---------- encargo «el4» (VG 12-11, #39 y #41): la escalera dulce y un solo rango, el del 8 ----------

/** Una cadena de n registros anidados desde X, cada uno anclado en el anterior (el primero en X), escritos por `autor`. */
async function cadenaDe(e, X, n, { autor, en = '0000000000', movimientos, desde = 0 }) {
  const fuera = [];
  let sobre = X;
  for (let k = 0; k < n; k++) {
    const t = '2026-11-08T10:' + String(desde + k).padStart(2, '0') + ':00Z';
    const r = await e.escribir({ autor, sobre, en, t, movimientos: movimientos(k), payload: [['Paso ' + (k + 1)]] });
    fuera.push(r);
    sobre = r.id;
  }
  return fuera;
}
/** Planear con T futuro (registrar · proyección al futuro: la celda del peldaño 6, 4.2). */
const planear = (k) => [minuto('cocina'), { token: 'T', escala: 'futuro', cantidad: 1, de: 'cocina', a: null, refiere: '2026-12-0' + ((k % 9) + 1) + 'T10:00:00Z' }];

test('rango: la compra y el alta de los ejemplos no cubren ninguna celda de la escalera: el primer peldaño (0.3, la idea), sin medida; disponible solo ese', async () => {
  const c = await conFuturo();
  for (const X of [c.compra.id, c.alta.id, c.eje.alta('casa').id]) {
    const r = C.rango(c.eje, X);
    assert.deepEqual([r.peldano, `${r.nivel}.${r.grado}`, r.nombre, r.direccion, r.medida, r.exacto, r.disponibles], [0, '0.3', HITOS[0].nombre, '1000000000', null, false, [0]], X.slice(0, 8));
    assert.equal(r.celdas.length, 10);
    assert.ok(r.celdas.every((x) => x.profundidad === 0 && x.alcanza === null));
  }
  // las celdas de la escalera son la fila k con la columna k+1 (la 9 con la 0)
  assert.deepEqual(C.rango(c.eje, c.compra.id).celdas.map((x) => [x.fila, x.columna]), [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 0]]);
  assert.equal(C.rango(c.eje, 'no-existe'), null);
});

test('rango: el peldaño por la celda de la escalera cubierta y su profundidad; un desajuste puntúa hacia arriba (menos profundidad: ese peldaño; más: el siguiente)', async () => {
  const c = await ejemploCompra();
  // registrar (la posición 6, a mano) con T futuro: la celda 6 · 7, el peldaño 6 (7777777000 → 4.2)
  const cadena = await cadenaDe(c.eje, c.compra.id, 8, { autor: 'cocina', en: '6000000000', movimientos: planear });
  assert.deepEqual(cadena.map((r) => [C.celdaDeEjecucion(c.eje, r.id).oficio, C.celdaDeEjecucion(c.eje, r.id).ejecucion]), Array(8).fill([6, 7]));
  const r = C.rango(c.eje, c.compra.id);
  const celda = r.celdas.find((x) => x.peldano === 6);
  assert.deepEqual([celda.profundidad, celda.direccion, celda.cadena], [8, '7777777700', cadena.map((x) => x.id)]);
  assert.deepEqual([r.peldano, `${r.nivel}.${r.grado}`, r.exacto, r.medida.direccion], [7, '5.1', false, '7777777700'], 'ocho de profundidad, uno más que su peldaño: sube al siguiente');
  assert.deepEqual(r.disponibles, [0, 1, 2, 3, 4, 5, 6, 7]);
  // desde lo anclado más abajo, la misma cadena es más corta: 7 (exacto, 4.2) y 1 (desajuste, 4.2)
  const siete = C.rango(c.eje, cadena[0].id);
  assert.deepEqual([siete.peldano, `${siete.nivel}.${siete.grado}`, siete.exacto, siete.medida.direccion, siete.direccion], [6, '4.2', true, '7777777000', '7777777000']);
  const uno = C.rango(c.eje, cadena[6].id);
  assert.deepEqual([uno.peldano, `${uno.nivel}.${uno.grado}`, uno.exacto, uno.medida.direccion], [6, '4.2', false, '7000000000'], 'una sola: su dirección cae entre 4.1 y 4.2, puntúa hacia arriba');
  assert.deepEqual(C.rango(c.eje, cadena[7].id).peldano, 0, 'lo último de la cadena no tiene nada debajo');
});

test('rango: el primer peldaño exacto (gestionar con E en la raíz, 1000000000 → 0.3) y, a dos de profundidad, el siguiente (1.1); el mayor de todas las celdas', async () => {
  const c = await ejemploCompra();
  const fichas = await cadenaDe(c.eje, c.compra.id, 2, { autor: 'casa', movimientos: () => [minuto('casa'), { token: 'E', emisor: 'casa', denominacion: 'ficha', cantidad: 1, de: null, a: 'casa' }] });
  assert.deepEqual(C.celdaDeEjecucion(c.eje, fichas[0].id), { oficio: 0, ejecucion: 1, por: { oficio: 'posicion', ejecucion: 'token E' } });
  const abajo = C.rango(c.eje, fichas[0].id);
  assert.deepEqual([abajo.peldano, abajo.exacto, abajo.medida.direccion], [0, true, '1000000000'], 'mostrar con E una vez: 0.3 exacto');
  const arriba = C.rango(c.eje, c.compra.id);
  assert.deepEqual([arriba.peldano, `${arriba.nivel}.${arriba.grado}`, arriba.exacto, arriba.medida.direccion], [1, '1.1', false, '1100000000']);
  // con otra celda más alta cubierta, gana la mayor
  await cadenaDe(c.eje, c.compra.id, 1, { autor: 'cocina', en: '6000000000', movimientos: planear, desde: 30 });
  assert.equal(C.rango(c.eje, c.compra.id).peldano, 6);
});

test('el 9 lee el rango del 8: las posiciones para situarse son las que deja (del primer peldaño al suyo) y la suya, sin rango declarado', async () => {
  const c = await ejemploCompra();
  const sin = C.hijosDe(c.eje, c.compra.id, 9);
  assert.deepEqual(sin.map((x) => [x.digito, x.disponible, x.actual]), HITOS.map((h) => [h.indice, h.indice === 0, h.indice === 0]));
  assert.deepEqual(sin.map((x) => x.direccion), C.escalera().map((p) => p.direccion));
  await cadenaDe(c.eje, c.compra.id, 1, { autor: 'cocina', en: '6000000000', movimientos: planear });
  const r = C.rango(c.eje, c.compra.id);
  assert.equal(r.peldano, 6);
  const h = C.hijosDe(c.eje, c.compra.id, 9);
  assert.deepEqual(h.filter((x) => x.disponible).map((x) => x.digito), r.disponibles);
  assert.deepEqual(h.filter((x) => x.actual).map((x) => x.digito), [6]);
  assert.ok(h.every((x) => x.vacio && x.total === 0), 'situarse no es un ocupante');
  // la regla del 9 dice que lee el rango del 8 (su nota), y la del 8 que el rango es suyo
  const reglas = C.lecturasDePv();
  assert.match(reglas.find((x) => x.pv === 9).regla[6].at(-1), /situarse lee el rango del 8/);
  assert.match(reglas.find((x) => x.pv === 8).regla[6].at(-1), /un solo rango, el del 8/);
  // sin escalera en la época, ni rango ni posiciones
  const sinEscalera = epocaCon((e) => { filaDelMundo(e, 8)[8] = ['-']; });
  assert.equal(C.rango(c.eje, c.compra.id, { epoca: sinEscalera }), null);
  assert.deepEqual(C.hijosDe(c.eje, c.compra.id, 9, { epoca: sinEscalera }), []);
});

test('verificado: además del sello, trae la altura de su bloque, la profundidad (altura del último sello conocido − la suya + 1) y enFirme (contra las «confirmations» de la cuenta raíz del eje: 6 por defecto); sin alturas, null', async () => {
  const { eje, compra } = await ejemploCompra();
  assert.equal(C.verificado(eje, 'no existe'), null);
  const sinSello = C.verificado(eje, compra.id);
  assert.deepEqual([sinSello.altura, sinSello.profundidad, sinSello.enFirme], [null, null, false]);
  // Un sello sintético (la simulación aún no trae la cabecera ni la firma del observador, 8.0 y 8.2): la altura es la del sello.
  const sello = (altura, h) => ({ altura, hash: h.repeat(64), instante: '2099-01-01T00:00:00.000Z', verificado: true });
  eje.marcarSello(compra.id, sello(840000, 'a'));
  assert.deepEqual(['altura', 'profundidad', 'enFirme'].map((k) => C.verificado(eje, compra.id)[k]), [840000, 1, false]);
  const otro = eje.orden.map((id) => id).find((id) => id !== compra.id && id !== eje.genesisId);
  eje.marcarSello(otro, sello(840005, 'b'));
  assert.deepEqual(['altura', 'profundidad', 'enFirme'].map((k) => C.verificado(eje, compra.id)[k]), [840000, 6, true], '840005 − 840000 + 1');
  assert.deepEqual(['altura', 'profundidad', 'enFirme'].map((k) => C.verificado(eje, otro)[k]), [840005, 1, false]);
  // leer del 5 lo trae igual.
  assert.equal(C.leer(eje, compra.id, 5).verificado.profundidad, 6);
});

// ---------- ejecutar desde el 4 (VG 12-11, decisión 7 de #49): el valor del registro y el botón por rango ----------

test('valorDeRegistro y valorDeCelda (VG 12-11, decisión 7): el valor de un registro crece con sus transacciones (todas suman: la T real que movió él y lo anclado debajo); la celda enseña la suma', async () => {
  const c = await ejemploCompra();
  const t = (m) => '2026-11-08T11:' + String(m).padStart(2, '0') + ':00Z';
  const raiz = await c.eje.escribir({ autor: 'cocina', sobre: c.compra.id, en: '4000000000', t: t(0), movimientos: [minuto('cocina')], payload: [['Turno']] });
  assert.deepEqual(C.valorDeRegistro(c.eje, raiz.id), { segundos: 60, transacciones: 1 }, 'el coste de escribirlo');
  const trabajo = await c.eje.escribir({ autor: 'cocina', sobre: raiz.id, t: t(1), movimientos: [minuto('cocina'), { token: 'T', escala: 'hora', cantidad: 1, de: 'cocina', a: null }], payload: [['Trabajo']] });
  const dado = await c.eje.escribir({ autor: 'cocina', sobre: trabajo.id, t: t(2), movimientos: [minuto('cocina'), { token: 'T', escala: 'minuto', cantidad: 11, de: 'cocina', a: null }], payload: [['Remate']] });
  assert.deepEqual(C.valorDeRegistro(c.eje, dado.id), { segundos: 60 + 660, transacciones: 1 });
  assert.deepEqual(C.valorDeRegistro(c.eje, raiz.id), { segundos: 60 + (60 + 3600) + (60 + 660), transacciones: 3 }, 'todas suman: 1 h 11 min más lo de escribir');
  // lo anunciado aún no se mueve: no suma hasta que se cumple
  const anuncio = await c.eje.escribir({ autor: 'cocina', sobre: raiz.id, en: '4100000000', t: t(3), movimientos: [minuto('cocina'), { token: 'T', escala: 'hora', cantidad: 5, de: 'cocina', a: null, estado: 'anunciado', refiere: '2026-12-01T10:00:00Z' }], payload: [['Mañana']] });
  assert.deepEqual(C.valorDeRegistro(c.eje, anuncio.id), { segundos: 60, transacciones: 1 });
  assert.deepEqual(C.valorDeCelda(c.eje, [dado.id, { ref: anuncio.id }, 'pagar']), { segundos: 720 + 60, transacciones: 2, registros: 2 }, 'lo que no es un registro no suma');
  assert.equal(C.valorDeRegistro(c.eje, 'no-existe'), null);
  assert.deepEqual(C.valorDeCelda(c.eje, []), { segundos: 0, transacciones: 0, registros: 0 });
});

test('botonDeEjecutar (VG 12-11, decisión 7): cambia con el rango del 8: apagado (pero pulsable) al principio, marcado al llegar al 3, efectos al subir', async () => {
  const c = await ejemploCompra();
  const apagado = C.botonDeEjecutar(c.eje, c.compra.id);
  assert.deepEqual([apagado.estado, apagado.pulsable, apagado.peldano, apagado.marca, apagado.subida], ['apagado', true, 0, { peldano: 3, nivel: 3, grado: 1 }, 0]);
  // administrar acuñando R propia (la posición 2): la celda 2 · 3 a cuatro de profundidad, una más que su peldaño (2.1): sube al 3 (3.1)
  const darR = () => [minuto('huesped'), { token: 'R', emisor: 'huesped', cantidad: 1, de: null, a: 'huesped' }];
  const coordina = await cadenaDe(c.eje, c.compra.id, 4, { autor: 'huesped', en: '2000000000', movimientos: darR });
  assert.equal(C.rango(c.eje, c.compra.id).peldano, 3);
  const marcado = C.botonDeEjecutar(c.eje, c.compra.id);
  assert.deepEqual([marcado.estado, marcado.peldano, `${marcado.nivel}.${marcado.grado}`, marcado.subida], ['marcado', 3, '3.1', 0]);
  // planear con T futuro: el peldaño 6 (4.2), tres por encima de la marca
  await cadenaDe(c.eje, c.compra.id, 1, { autor: 'cocina', en: '6000000000', movimientos: planear, desde: 30 });
  const efectos = C.botonDeEjecutar(c.eje, c.compra.id);
  assert.deepEqual([efectos.estado, efectos.peldano, efectos.subida], ['efectos', 6, 3]);
  assert.equal(C.botonDeEjecutar(c.eje, coordina[3].id).estado, 'apagado', 'lo último de la cadena no tiene nada debajo');
  assert.deepEqual([C.botonDeEjecutar(c.eje, 'no-existe').estado, C.botonDeEjecutar(c.eje, 'no-existe').peldano], ['apagado', null]);
  assert.deepEqual(C.BOTON_DE_EJECUTAR.estados, ['apagado', 'marcado', 'efectos']);
});

test('formaDe: las formas van por modo en epoch.8.7 (VG 12-11, #52): una hoja por modo, «-» hereda del modo anterior, cinco modos', () => {
  assert.deepEqual(C.modos().map((m) => m.nombre), ['Pointed', 'Sequenced', 'Mapped', 'Scened', 'Be'], 'cinco modos, en el orden de epoch.8.2');
  // la posición 3 de cada fila es una lista con una hoja por modo (no una décupla: solo hojas)
  for (const f of EPOCA_0_BTML.registro[8][7][1]) assert.ok(f[3].length === 5 && f[3].every((h) => typeof h === 'string'), 'una hoja por modo: ' + JSON.stringify(f[0]));
  // lo de hoy: Mapped y Sequenced se ven como siempre; Pointed no declara forma
  assert.deepEqual([1, 2, 3, 4, 6, 7, 8, 9].map((pv) => C.formaDe(null, pv, 'mapped').forma), ['cruceta', 'escalera', 'rejilla', 'matriz', 'franjas', 'franjas', 'cielo', 'camino']);
  assert.deepEqual([1, 2, 3, 4, 6, 7, 8, 9].map((pv) => C.formaDe(null, pv, 'sequenced').forma), ['cruceta', 'escalera', 'rejilla', 'matriz', 'franjas', 'franjas', 'cielo', 'camino']);
  assert.deepEqual(C.formaDe(null, 2, 'pointed'), { forma: null, formas: [], de: null }, 'Pointed no declara forma y no hay modo anterior');
  // los niveles dentro de la hoja; la última forma se repite
  assert.deepEqual(C.formaDe(null, 2, 'mapped', { nivel: 1 }), { forma: 'escalera', formas: ['escalera', 'columnas'], de: 'mapped' });
  assert.deepEqual([1, 2, 5, 99].map((nivel) => C.formaDe(null, 2, 'mapped', { nivel }).forma), ['escalera', 'columnas', 'columnas', 'columnas']);
  // herencia hacia abajo: Scened ← Mapped y Be ← Scened («-» en los datos)
  assert.deepEqual(C.formaDe(null, 3, 'scened'), { forma: 'rejilla', formas: ['rejilla', 'conversacion'], de: 'mapped' });
  assert.deepEqual(C.formaDe(null, 3, 'be'), { forma: 'rejilla', formas: ['rejilla', 'conversacion'], de: 'mapped' });
  assert.equal(C.formaDe(null, 11, 'mapped'), null, 'sin fila, la época no dice nada del PV');
  assert.throws(() => C.formaDe(null, 1, 'inventado'), /modo desconocido/);
  assert.equal(C.formaDe(null, 1, 'MAPPED').forma, 'cruceta', 'el nombre del modo no distingue mayúsculas');
  // sin modo, el de siempre: Mapped (la fila de hoy); divisionDelMundo lo lee con la misma herencia y dice de qué modo
  assert.equal(C.divisionDelMundo(null, 2).forma, 'escalera');
  assert.deepEqual(['pointed', 'sequenced', 'mapped', 'scened', 'be'].map((modo) => C.divisionDelMundo(null, 1, { modo }).forma), [null, 'cruceta', 'cruceta', 'cruceta', 'cruceta']);
  // la herencia es de los datos: una época con otras hojas la cambia (Pointed con la suya, Mapped heredando de Sequenced, Be con la suya)
  const otra = epocaCon((e) => { e[8][7][1].find((f) => f[0][0] === 1)[3] = ['fila', 'columnas', '-', '-', 'cielo']; });
  const por = (modo) => C.formaDe(null, 1, modo, { epoca: otra });
  assert.deepEqual(['pointed', 'sequenced', 'mapped', 'scened', 'be'].map((m) => [por(m).forma, por(m).de]), [['fila', 'pointed'], ['columnas', 'sequenced'], ['columnas', 'sequenced'], ['columnas', 'sequenced'], ['cielo', 'be']]);
  // una lista más corta que los modos deja los últimos heredando
  const corta = epocaCon((e) => { e[8][7][1].find((f) => f[0][0] === 1)[3] = ['cruceta']; });
  assert.deepEqual(['pointed', 'mapped', 'be'].map((m) => C.formaDe(null, 1, m, { epoca: corta }).de), ['pointed', 'pointed', 'pointed']);
});
