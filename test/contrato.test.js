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
import { ejemploCompra, ejemploCuenta } from '../ejemplos/ikisai/compra-food.mjs';
import { ejemploReserva } from '../ejemplos/ikisai/reserva-booking.mjs';
import { ejemploTarea } from '../ejemplos/ikisai/tarea-tasks.mjs';
import { ejemploComprasHermanas } from '../ejemplos/ikisai/compras-hermanas.mjs';
import { ejemploLente } from '../ejemplos/ikisai/lente-booking.mjs';

const minuto = (de, cantidad = 1) => ({ token: 'T', escala: 'minuto', cantidad, de, a: null });
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
  assert.deepEqual(C.plantillas(eje).map((p) => [p.nombre, p.donde]), [['purchase', '9210000000'], ['booking', '9220000000'], ['preferences', '9300000000']]);
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
  assert.deepEqual(C.ordenes().map((o) => o.nombre), ['arrival', 'newest', 'fit']);
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
  assert.deepEqual(C.madurez(eje, compra), { nivel: 11, de: 15, nombre: 'list', clave: 'list', medida: { posiciones: 15, profundidad: 1, cantidad: 16 } });
  assert.deepEqual(C.madurez(eje, cuenta), { nivel: 4, de: 15, nombre: 'stem', clave: 'stem', medida: { posiciones: 4, profundidad: 0, cantidad: 3 } });
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
  assert.deepEqual(C.madurez(b, reserva), { nivel: 4, de: 5, nombre: 'settled', clave: 'settled', medida: { posiciones: 37, profundidad: 1, cantidad: 205 } });
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
    id: compra.id, t: compra.t, autor: 'huesped', ancla: { sobre: menu.id, en: '0000000000' },
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
  assert.equal(r.total, 8);
  assert.deepEqual(r.entradas.slice(-2).map((e) => [e.id, e.autor, e.ancla.sobre]), [[entrega.id, 'casa', reserva.id], [pago.id, 'huesped', reserva.id]]);
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
  assert.deepEqual(y.atencion.map((g) => [g.nombre, g.zona, g.precio.enQue, g.precio.cuanto]), [['desconocidos', 0, 'my R', 1], ['comercial', 1, 'E', 1], ['expertos', 2, 'P', 1], ['cercanos', 3, 'their R', 1], ['equipo', 4, 'open record', 0], ['vetados', 5, 'nothing', 0]]);
  assert.deepEqual(Object.keys(y.tiempo), ['segundo', 'minuto', 'hora', 'día', 'semana', 'ciclo', 'año'], 'las escalas reales, por su nombre en la época');
  assert.equal(y.tiempo.hora, 1, 'la hora de la compra, gastada el día del reloj del libro');
  assert.ok(y.tiempo.minuto >= 1 && y.tiempo.segundo === 0);
  assert.equal(C.yo(eje, 'nadie-conocido'), null);
});

test('configuracion: los defectos de la plantilla «preferences» si no hay registro, y el registro anclado en el 9 de mi alta si lo hay (validado por su plantilla)', async () => {
  assert.deepEqual(C.configuracion(eje, 'huesped'), { step: 10, render: 'sober', language: 'en', sizes: [1, 2, 3], model: 'sobrio', animations: 10, de: null });
  assert.deepEqual(C.configuracion(eje, C.yo(eje, 'huesped')), C.configuracion(eje, 'huesped'));
  const T = '2026-11-07T18:00:00Z';
  const mias = await eje.escribir({ autor: 'huesped', sobre: eje.alta('huesped').id, en: '9000000000', t: T, movimientos: [minuto('huesped')], payload: ['preferences', 20, 'animated', 'es', [1, 3], 'preferences'] });
  assert.deepEqual(C.configuracion(eje, 'huesped'), { step: 20, render: 'animated', language: 'es', sizes: [1, 3], model: 'sobrio', animations: 10, de: mias.id }, 'el 5 (el tipo) no es una preferencia; «model» (encargo 3c-2b) tiene su defecto');
  assert.deepEqual(C.validar(eje, mias), []);
  // Un registro de preferencias anclado en otro sitio no es mi configuración; lo último mío en mi 9 manda.
  await eje.escribir({ autor: 'huesped', sobre: menu.id, en: '9000000000', t: T, movimientos: [minuto('huesped')], payload: ['preferences', 99, 'sober', 'en', [2], 'preferences'] });
  assert.equal(C.configuracion(eje, 'huesped').step, 20);
  const otras = await eje.escribir({ autor: 'huesped', sobre: eje.alta('huesped').id, en: '9000000000', t: T, movimientos: [minuto('huesped')], payload: ['preferences', 5, 'sober', 'en', [2], 'preferences'] });
  assert.deepEqual(C.configuracion(eje, 'huesped'), { step: 5, render: 'sober', language: 'en', sizes: 2, model: 'sobrio', animations: 10, de: otras.id }, 'el último mío');
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
  const fuente = readFileSync(new URL('./carta-texto.mjs', import.meta.url), 'utf8');
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
    for (const tamano of [2, 3]) assert.equal(sinIds(await pintarPara(r.eje, id, tamano, yo, { t: '2026-11-09T09:00:00Z' }), nombres), esperado[nombre][tamano - 2], nombre + ' para ' + yo + ' en el tamaño ' + tamano);
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
