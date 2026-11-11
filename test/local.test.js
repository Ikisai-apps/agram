// Encargo 3c-2b: el libro local (src/local.js). Cada interacción quema un T de segundo en un libro propio de la
// persona, nunca en el eje; englobar lleva al eje UN registro de escala minuto que quema 1 T de minuto y ancla en su 6
// el recorrido; nada de los segundos se publica (VG).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LibroLocal, ESCALA_INTERACCION, ESCALA_REGISTRO, REGLA_DEL_T, VERSION_LOCAL } from '../src/local.js';
import { EPOCA_0_BTML, cargarEpocaBtml } from '../src/epocas.js';
import { EPOCA_0_BTML_DATOS, REGLAS_DE_EPOCA_DATOS, CORRECCIONES_DE_EPOCA_DATOS } from '../datos/epocas/epocas.js';
import { ejemploCompra } from '../ejemplos/ikisai/compra-food.mjs';
import { diaCivil } from '../src/tokens.js';
import * as agram from '../src/index.js';

const T = (s) => '2026-11-07T15:00:' + String(s).padStart(2, '0') + 'Z';

/** Una copia de la época 0 con cambios. */
function epocaCon(cambiar) {
  const e = JSON.parse(JSON.stringify(EPOCA_0_BTML_DATOS));
  cambiar(e);
  return cargarEpocaBtml(e, { registros: REGLAS_DE_EPOCA_DATOS, correcciones: CORRECCIONES_DE_EPOCA_DATOS, id: EPOCA_0_BTML.id });
}

test('las escalas son niveles de agregación: la interacción es la primera de la época (segundo) y el registro que engloba, la siguiente (minuto)', () => {
  assert.equal(ESCALA_INTERACCION, EPOCA_0_BTML.registro[1][3][1][0][0][0]);
  assert.equal(ESCALA_REGISTRO, EPOCA_0_BTML.registro[1][3][1][1][0][0]);
  assert.equal(EPOCA_0_BTML.registro[1][3][1][0][1][0], 86400, 'un segundo por segundo del día');
});

test('ver y tocar queman un T de segundo del día en el libro local, lo anotan y nada llega al eje', async () => {
  const { eje, menu, compra } = await ejemploCompra();
  const antes = eje.orden.length;
  const local = new LibroLocal(eje, 'huesped');
  assert.equal(local.quedaHoy(T(0)), 86400);
  const v = local.ver(menu.id, { t: T(0) });
  assert.deepEqual(v, { ok: true, anotacion: { t: T(0), X: menu.id, accion: 'ver', en: null }, queda: 86399 });
  const t2 = local.tocar(compra.id, 'abrir', { t: T(1) });
  assert.equal(t2.ok, true);
  assert.equal(local.ver(compra.id, { t: T(2) }).ok, true);
  assert.equal(local.quedaHoy(T(2)), 86397);
  assert.equal(local.gastadoHoy(T(2)), 3, 'lo acuñado de la asignación del día');
  assert.equal(local.libro.saldo('huesped', 'T:' + ESCALA_INTERACCION), 0, 'cada segundo se acuña con tope y se quema en el mismo paso: nada queda');
  assert.deepEqual([local.tiempo(menu.id), local.tiempo(compra.id)], [1, 2], 'los segundos quemados sobre cada registro');
  assert.deepEqual(local.recorrido().map((a) => [a.X === menu.id ? 'menú' : 'compra', a.accion]), [['menú', 'ver'], ['compra', 'abrir'], ['compra', 'ver']]);
  assert.deepEqual(local.recorrido(1).length, 2);
  assert.deepEqual(local.recorrido(T(1)).length, 2, 'desde un instante');
  // En el eje, nada: ni un registro más, ni una serie de T de segundo.
  assert.equal(eje.orden.length, antes);
  assert.equal(eje.libro.sumas({ serie: 'T:' + ESCALA_INTERACCION }), 0);
  assert.ok(!eje.series().some((s) => s.clave === 'T:' + ESCALA_INTERACCION));
  // Otro día civil, la asignación entera otra vez: nada se acumula.
  assert.equal(local.quedaHoy('2026-11-08T00:00:00Z'), 86400);
  assert.equal(local.ver(menu.id, { t: '2026-11-08T00:00:00Z' }).queda, 86399);
  // Lo que no es una interacción: un registro que no está, una acción que no es texto, un t que no es instante.
  assert.match(local.ver('f'.repeat(64), { t: T(3) }).motivo, /registro desconocido/);
  assert.equal(local.tocar(menu.id, 7, { t: T(3) }).ok, false);
  assert.equal(local.ver(menu.id, { t: 'ayer' }).ok, false);
});

test('sin T de segundo del día, ver y tocar devuelven el motivo de la regla de la época (writing burns today\'s T) y no lanzan; el día siguiente vuelve', async () => {
  const { eje, menu } = await ejemploCompra();
  const epoca = epocaCon((e) => { e[1][3][1][0][1] = [2]; }); // dos segundos al día
  // El idioma de la época es el español: el motivo en inglés lo pide la configuración de la huésped.
  await eje.escribir({ autor: 'huesped', sobre: eje.alta('huesped').id, en: '9000000000', t: '2026-11-07T17:00:00Z', movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'huesped', a: null }], payload: ['preferences', 10, 'sober', 'en', [1, 2, 3], 'preferences'] });
  const local = new LibroLocal(eje, 'huesped', { epoca });
  assert.equal(local.quedaHoy(T(0)), 2);
  assert.equal(local.ver(menu.id, { t: T(0) }).ok, true);
  assert.equal(local.ver(menu.id, { t: T(1) }).ok, true);
  const r = local.ver(menu.id, { t: T(2) });
  assert.equal(r.ok, false);
  assert.equal(r.motivo, REGLA_DEL_T + ': huesped burns no T, or more T than is left today (day ' + diaCivil(T(2)) + ')');
  assert.equal(local.recorrido().length, 2, 'lo que no cupo no se anota');
  assert.equal(local.ver(menu.id, { t: '2026-11-08T09:00:00Z' }).ok, true, 'a medianoche, la asignación nueva');
  // Con la configuración en español, el motivo en español.
  await eje.escribir({ autor: 'huesped', sobre: eje.alta('huesped').id, en: '9000000000', t: '2026-11-07T18:00:00Z', movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'huesped', a: null }], payload: ['preferences', 10, 'sober', 'es', [1, 2, 3], 'preferences'] });
  const otro = new LibroLocal(eje, 'huesped', { epoca: epocaCon((e) => { e[1][3][1][0][1] = [1]; }) });
  otro.ver(menu.id, { t: T(0) });
  assert.match(otro.ver(menu.id, { t: T(1) }).motivo, /^writing burns today's T: huesped no quema T, o quema más T del que le queda hoy/);
});

test('englobar escribe UN solo registro de escala minuto en el eje: quema 1 T de minuto, su 6 ancla el recorrido, su 7 dice la escala, y queda anclado a lo anterior', async () => {
  const { eje, menu, compra } = await ejemploCompra();
  const local = new LibroLocal(eje, 'huesped');
  assert.equal(await local.englobar(), null, 'sin nada pendiente no se escribe nada');
  local.ver(menu.id, { t: T(0) });
  local.tocar(compra.id, 'abrir', { t: T(1) });
  local.ver(menu.id, { t: T(2) });
  const antes = eje.orden.length;
  const minutoAntes = eje.gastadoT('huesped', ESCALA_REGISTRO, diaCivil(T(2)));
  const ev = await local.englobar(undefined, { nota: 'una tarde en el menú' });
  assert.equal(eje.orden.length, antes + 1, 'un registro, y solo uno');
  assert.equal(ev.autor, 'huesped');
  assert.equal(ev.sobre, eje.alta('huesped').id, 'anclado a lo anterior: la primera vez, el alta');
  assert.equal(ev.t, T(2), 'el t de la última interacción');
  assert.deepEqual(ev.movimientos, [{ token: 'T', escala: ESCALA_REGISTRO, cantidad: 1, de: 'huesped', a: null }], 'un minuto, y nada de segundos');
  assert.equal(eje.gastadoT('huesped', ESCALA_REGISTRO, diaCivil(T(2))), minutoAntes + 1, 'la regla del T del día lo cobra como a cualquier registro');
  const asientos = eje.libro.asientos({ registro: ev.sobre }).filter((a) => a.tx.id === ev.id);
  assert.ok(asientos.some((a) => a.primitiva === 'quemar' && a.serie === 'T:' + ESCALA_REGISTRO && a.cantidad === 1));
  assert.ok(!asientos.some((a) => a.serie === 'T:' + ESCALA_INTERACCION), 'nada de los segundos se publica');
  assert.equal(eje.libro.sumas({ serie: 'T:' + ESCALA_INTERACCION }), 0);
  // El payload: 0 la nota, 1 cuántas, 2 el hash, 3 quién, 4 las acciones por llegada, 5 lo anterior, 6 el recorrido, 7 la escala.
  const [cero, uno, dos, tres, cuatro, cinco, seis, siete] = ev.payload;
  assert.deepEqual([cero, uno, tres, cuatro, cinco, siete], [['una tarde en el menú'], [3], ['huesped'], ['ver', 'abrir', 'ver'], [{ ref: ev.sobre }], [ESCALA_REGISTRO]]);
  assert.match(dos[0], /^[0-9a-f]{64}$/);
  assert.deepEqual(seis, [[menu.id, compra.id], [3], [T(0), T(2)], dos], 'los ids visitados por llegada, cuántas, el primer y el último t, el hash');
  // Lo englobado no se repite: el recorrido queda vacío, las anotaciones saben en qué registro están, y el siguiente minuto se ancla al anterior.
  assert.deepEqual(local.recorrido(), []);
  assert.ok(local.anotaciones().every((a) => a.en === ev.id));
  assert.equal(local.anterior, ev.id);
  assert.equal(await local.englobar(), null);
  local.ver(compra.id, { t: T(10) });
  const ev2 = await local.englobar();
  assert.equal(ev2.sobre, ev.id, 'anclado a lo anterior');
  assert.deepEqual([ev2.payload[0], ev2.payload[1], ev2.payload[6][0]], [[ESCALA_REGISTRO + ' de huesped'], [1], [compra.id]]);
  assert.equal(eje.orden.length, antes + 2);
  // Con una función que firma (o no): el evento pasa por ella antes de entrar.
  local.ver(menu.id, { t: T(20) });
  let visto = null;
  const ev3 = await local.englobar(async (e) => { visto = e; return e; }, { t: T(30) });
  assert.equal(visto.id, ev3.id);
  assert.equal(ev3.t, T(30));
});

test('serializar y restaurar: la misma forma que el eje; lo restaurado vuelve a quemar sus segundos, conserva lo englobado y lo anterior', async () => {
  const { eje, menu, compra } = await ejemploCompra();
  const local = new LibroLocal(eje, 'huesped');
  local.ver(menu.id, { t: T(0) });
  const ev = await local.englobar();
  local.tocar(compra.id, 'abrir', { t: T(5) });
  const datos = JSON.parse(JSON.stringify(local.serializar()));
  assert.deepEqual(datos, { version: VERSION_LOCAL, yo: 'huesped', anterior: ev.id, anotaciones: [{ t: T(0), X: menu.id, accion: 'ver', en: ev.id }, { t: T(5), X: compra.id, accion: 'abrir', en: null }] });
  const otro = LibroLocal.restaurar(eje, datos);
  assert.equal(otro.quedaHoy(T(5)), 86398);
  assert.deepEqual(otro.recorrido(), [{ t: T(5), X: compra.id, accion: 'abrir' }]);
  assert.equal(otro.anterior, ev.id);
  assert.deepEqual(otro.serializar(), datos);
  const ev2 = await otro.englobar();
  assert.equal(ev2.sobre, ev.id);
  assert.throws(() => LibroLocal.restaurar(eje, { version: 7 }), /inválidos/);
  assert.throws(() => LibroLocal.restaurar(eje, { ...datos, anotaciones: [{ t: T(0), X: 'f'.repeat(64), accion: 'ver', en: null }] }), /no cabe/);
  assert.throws(() => new LibroLocal(eje, ''), /identidad/);
});

test('el índice expone el libro local, los pasos y los modelos como espacios de nombres', () => {
  assert.equal(agram.local.LibroLocal, LibroLocal);
  assert.equal(typeof agram.pasos.pasos, 'function');
  assert.equal(typeof agram.modelos.pieza, 'function');
});
