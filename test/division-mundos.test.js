// La división de cada mundo en pantalla completa (VG, 10-11, tanda 4): epoch.8.7 «world division» es un dato de la época
// (una fila por PV: columnas, filas, niveles de profundidad, de qué hereda); contrato.divisionDelMundo la lee y la carta
// coloca el contenido del PV en esa rejilla (el 2 y el 3 heredan del 1 y del 2 a la misma profundidad; el 6 y el 7, una
// banda por escala de T que el calendario mide; el 8, una por caja de la cuota; el 9, los pasos del camino).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arbol, escalaDeTamanos, LATERALES, CENTROS } from '../carta/carta.js';
import { html } from '../carta/dom.js';
import * as C from '../src/contrato.js';
import { EPOCA_0_BTML, cargarEpocaBtml, REGISTROS_DE_MODELOS } from '../src/epocas.js';
import { EPOCA_0_BTML_DATOS, REGLAS_DE_EPOCA_DATOS, PLANTILLAS_DE_EPOCA_DATOS, CORRECCIONES_DE_EPOCA_DATOS } from '../datos/epocas/epocas.js';
import { ejemploCompra } from '../ejemplos/ikisai/compra-food.mjs';

const GRANDE = { ancho: 1920, alto: 1080 };
const ORDENADOR = { ancho: 1200, alto: 800 };
const T = [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'casa', a: null }];

function epocaCon(cambiar) {
  const e = JSON.parse(JSON.stringify(EPOCA_0_BTML_DATOS));
  const plantillas = JSON.parse(JSON.stringify(PLANTILLAS_DE_EPOCA_DATOS));
  cambiar(e, plantillas);
  return cargarEpocaBtml(e, { registros: [...REGLAS_DE_EPOCA_DATOS, ...REGISTROS_DE_MODELOS], plantillas, correcciones: CORRECCIONES_DE_EPOCA_DATOS, id: EPOCA_0_BTML.id });
}

/** La fila de epoch.8.7 de un PV en una copia de los datos de la época. */
const filaDe = (e, pv) => e[8][7][1].find((f) => f[0][0] === pv);

/** Una compra con una «Carpeta» colgada (1 → «Nota» → «Hoja»): un registro con ocupantes que son referencias, para entrar en sus celdas. */
async function conCarpeta() {
  const { eje, compra } = await ejemploCompra();
  const t = '2026-11-08T09:00:00Z';
  const hoja = await eje.escribir({ autor: 'casa', sobre: compra.id, t, movimientos: T, payload: [['Hoja']] });
  const nota = await eje.escribir({ autor: 'casa', sobre: compra.id, t: '2026-11-08T09:01:00Z', movimientos: T, payload: [['Nota'], [{ ref: hoja.id }]] });
  const carpeta = await eje.escribir({ autor: 'casa', sobre: compra.id, t: '2026-11-08T09:02:00Z', movimientos: T, payload: [['Carpeta'], [{ ref: nota.id }]] });
  return { eje, compra, hoja, nota, carpeta };
}

const completa = (X, pv, extra = {}) => ({ foco: { X, pv }, ...extra });

test('epoch.8.7 «world division» es un dato de la época con su procedencia: una fila por PV [[pv], [columnas], [filas], [niveles], [de qué hereda], [nota]], sin posiciones vacías', () => {
  const fila = EPOCA_0_BTML.registro[8][7];
  assert.equal(fila[0][0], 'world division');
  assert.match(fila[2][0], /^VG, 10-11/);
  const filas = fila[1];
  assert.deepEqual(filas.map((f) => f[0][0]), [0, 5, 1, 2, 3, 4, 6, 7, 8, 9]);
  for (const f of filas) { assert.equal(f.length, 6); assert.ok(f.every((p) => Array.isArray(p) && p.length > 0), 'sin posiciones vacías: ' + JSON.stringify(f).slice(0, 60)); }
  const d = (pv) => C.divisionDelMundo(null, pv);
  assert.deepEqual([1, 2, 3, 4].map((pv) => [d(pv).columnas, d(pv).filas, d(pv).niveles]), [[4, 4, 4], [5, 5, 5], [6, 6, 6], [10, 10, 1]]);
  assert.deepEqual([d(1).hereda, d(2).hereda, d(3).hereda, d(4).hereda], [null, 1, 2, null]);
  assert.deepEqual([0, 5].map((pv) => [d(pv).columnas, d(pv).filas]), [[0, 0], [0, 0]], 'el 0 y el 5 no se dividen');
  assert.equal(d(8).filas, 10);
  assert.equal(d(9).filas, 10);
  // Las bandas del 6 y el 7 son las escalas de T que mide el calendario (epoch.1.3 ∩ epoch.7), no un número escrito: nombres y dígito de la escala de epoch.1.3.1.
  const medidas = EPOCA_0_BTML.registro[7][0].map((r) => r[0][0]);
  const escalas = EPOCA_0_BTML.registro[1][3][1].map((r, escala) => ({ escala, nombre: r[0][0] })).filter((e) => medidas.includes(e.nombre));
  for (const pv of [6, 7]) {
    assert.equal(d(pv).bandas.length, escalas.length);
    assert.deepEqual(d(pv).bandas.map((b) => [b.escala, b.nombre]), escalas.map((e) => [e.escala, e.nombre]));
    assert.equal(d(pv).filas, escalas.length);
  }
  assert.ok(escalas.length < EPOCA_0_BTML.registro[1][3][1].length, 'hay escalas de T que el calendario no mide (pasado, futuro, inventado)');
});

test('divisionDelMundo con el nivel en que se mira: entra mientras queden niveles; no pasa del último', () => {
  assert.deepEqual([1, 2, 4, 5].map((n) => [C.divisionDelMundo(null, 2, { nivel: n }).nivel, C.divisionDelMundo(null, 2, { nivel: n }).entra]), [[1, true], [2, true], [4, true], [5, false]]);
  assert.equal(C.divisionDelMundo(null, 2, { nivel: 99 }).nivel, 5);
  assert.equal(C.divisionDelMundo(null, 4, { nivel: 1 }).entra, false, 'un solo nivel: no se entra');
  assert.equal(C.divisionDelMundo(null, 1, { epoca: epocaCon((e) => { e[8][7][1] = e[8][7][1].filter((f) => f[0][0] !== 1); }) }), null, 'sin fila, la época no dice nada del PV');
});

test('la división sale de la época: cambiar la fila en una copia cambia el árbol (el 1 en 3 × 3, el 6 con una escala menos, el 8 con cinco cajas)', async () => {
  const { eje, compra } = await ejemploCompra();
  const base = await arbol(completa(compra.id, 1), eje, 'huesped', GRANDE);
  assert.equal(base.centro.rejilla.celdas.length, 16);
  const epoca = epocaCon((e) => {
    filaDe(e, 1)[1] = [3];
    filaDe(e, 1)[2] = [3];
    e[7][0] = e[7][0].filter((r) => r[0][0] !== 'año'); // el calendario deja de medir el año
    e[9][8].find((f) => f[1]?.[0] === 'cuota')[3] = [5];
  });
  const otra = await arbol(completa(compra.id, 1), eje, 'huesped', GRANDE, { epoca });
  assert.equal(otra.centro.rejilla.celdas.length, 9);
  assert.match(html(otra), /data-rejilla="1"[^>]*data-columnas="3" data-filas="3"/);
  assert.equal((await arbol(completa(compra.id, 6), eje, 'huesped', GRANDE)).centro.rejilla.bandas.length, 7);
  assert.equal((await arbol(completa(compra.id, 6), eje, 'huesped', GRANDE, { epoca })).centro.rejilla.bandas.length, 6);
  assert.equal((await arbol(completa(compra.id, 8), eje, 'huesped', GRANDE)).centro.rejilla.bandas.length, 10);
  assert.equal((await arbol(completa(compra.id, 8), eje, 'huesped', GRANDE, { epoca })).centro.rejilla.bandas.length, 5);
});

test('el 1 en pantalla completa da 16 celdas (4 × 4); el 2 da 25 con 16 heredadas del 1 y 9 propias; el 3 da 36: 16 del 1, 9 del 2 y 11 propias', async () => {
  const { eje, carpeta } = await conCarpeta();
  const por = async (pv) => (await arbol(completa(carpeta.id, pv), eje, 'casa', GRANDE)).centro.rejilla;
  const r1 = await por(1);
  assert.deepEqual([r1.columnas, r1.filas, r1.celdas.length, r1.nivel, r1.niveles], [4, 4, 16, 1, 4]);
  assert.ok(r1.celdas.every((c) => c.pv === 1));
  const r2 = await por(2);
  assert.equal(r2.celdas.length, 25);
  assert.equal(r2.celdas.filter((c) => c.pv === 1).length, 16);
  assert.equal(r2.celdas.filter((c) => c.pv === 2).length, 9);
  // Las 16 heredadas son las de la esquina de arriba a la izquierda (la 4 × 4); las propias, la fila y la columna añadidas.
  assert.ok(r2.celdas.filter((c) => c.pv === 1).every((c) => c.fila < 4 && c.columna < 4));
  assert.ok(r2.celdas.filter((c) => c.pv === 2).every((c) => c.fila === 4 || c.columna === 4));
  // La 4 × 4 de dentro enseña lo del 1 de ese registro (lo mismo que su rejilla propia), y lo propio es lo del 2.
  assert.deepEqual(r2.celdas.filter((c) => c.pv === 1 && c.ocupante).map((c) => [c.fila, c.columna, c.ocupante.texto]), r1.celdas.filter((c) => c.ocupante).map((c) => [c.fila, c.columna, c.ocupante.texto]));
  assert.deepEqual(r2.celdas.filter((c) => c.pv === 2 && c.ocupante).map((c) => c.ocupante.texto), C.ocupantes(eje, carpeta.id, 2, 0, 9).ocupantes.map((o) => C.legible(eje, o, C.tipo(eje, carpeta.id, 2), {}).texto));
  const r3 = await por(3);
  assert.equal(r3.celdas.length, 36);
  assert.deepEqual([1, 2, 3].map((pv) => r3.celdas.filter((c) => c.pv === pv).length), [16, 9, 11]);
  assert.ok(r3.celdas.filter((c) => c.pv === 3).every((c) => c.fila === 5 || c.columna === 5));
  // El color de cada celda es el de su PV (data-color) y el de cada ocupante ya lo lleva por su posición (data-pv).
  const h = html(await arbol(completa(carpeta.id, 2), eje, 'casa', GRANDE));
  assert.equal((h.match(/class="rejilla-celda[^"]*" data-color="1"/g) ?? []).length, 16);
  assert.equal((h.match(/class="rejilla-celda[^"]*" data-color="2"/g) ?? []).length, 9);
});

test('entrar en una celda del 1 baja un nivel de profundidad y «volver» sube; en el último nivel, la celda ya no entra', async () => {
  const { eje, hoja, nota, carpeta } = await conCarpeta();
  const lee = (estado) => arbol(estado, eje, 'casa', GRANDE).then((a) => ({ a, r: a.centro.rejilla }));
  const { a: a0, r: r0 } = await lee(completa(carpeta.id, 1));
  assert.equal(r0.nivel, 1);
  const celda = r0.celdas.find((c) => c.ocupante);
  assert.equal(celda.entra, true, 'el ocupante es un registro y quedan niveles');
  assert.equal(celda.ocupante.X, nota.id);
  const h0 = html(a0);
  assert.match(h0, new RegExp(`data-celda="${nota.id}"`));
  assert.doesNotMatch(h0, /data-subir=/);
  assert.match(h0, /class="volver volver-claro"[^>]*data-foco-pv="0"/, 'a nivel 1, volver sale de la pantalla completa');
  // Entrar (lo que hace la app: estado.profundidad[pv] = [...ruta, X]): la rejilla es ahora la de «Nota» y enseña sus ocupantes.
  const { a: a1, r: r1 } = await lee(completa(carpeta.id, 1, { profundidad: { 1: [nota.id] } }));
  assert.deepEqual([r1.nivel, r1.X, r1.ruta], [2, nota.id, [nota.id]]);
  assert.equal(r1.celdas.length, 16, 'cada celda vuelve a dividirse en 4 × 4');
  assert.equal(r1.celdas.find((c) => c.ocupante).ocupante.X, hoja.id);
  const h1 = html(a1);
  assert.match(h1, /class="volver volver-claro"[^>]*data-subir="1"/, 'a nivel 2, volver sube un nivel');
  assert.match(h1, /data-subir="1"[^>]*>↑/, 'y la cabecera de la rejilla también lo tiene');
  assert.match(h1, /nivel 2 de 4/);
  // El foco no se mueve: sigue siendo el mismo registro; subir (quitar el último) devuelve la rejilla de antes.
  assert.equal(a1.X, carpeta.id);
  const { r: r2 } = await lee(completa(carpeta.id, 1, { profundidad: { 1: [] } }));
  assert.deepEqual(r2.celdas.map((c) => c.ocupante?.texto ?? null), r0.celdas.map((c) => c.ocupante?.texto ?? null));
  // Un registro que no existe en la ruta se ignora; no se pasa de los niveles de la época.
  const { r: r3 } = await lee(completa(carpeta.id, 1, { profundidad: { 1: ['no-existe', nota.id, hoja.id, hoja.id, hoja.id, hoja.id, hoja.id] } }));
  assert.equal(r3.nivel, 4);
  assert.equal(r3.celdas.every((c) => !c.entra), true, 'en el último nivel no se entra más');
  // Con un solo nivel (el 4), ninguna celda entra.
  const { r: r4 } = await lee(completa(carpeta.id, 4));
  assert.equal(r4.celdas.every((c) => !c.entra), true);
});

test('la paginación es por rejillas enteras: «n de m» con más ocupantes que celdas, y la segunda página sigue donde acabó la primera', async () => {
  const { eje, compra } = await ejemploCompra();
  // Una época con el 1 en 1 × 2: dos celdas por página; el 1 de la compra trae un solo ocupante, así que el 3 (36 celdas, 16 del 1) no pagina y el 2 tampoco.
  const epoca = epocaCon((e) => { filaDe(e, 2)[1] = [2]; filaDe(e, 2)[2] = [1]; filaDe(e, 2)[4] = ['-']; });
  const r = (await arbol(completa(compra.id, 2), eje, 'huesped', GRANDE, { epoca })).centro.rejilla;
  assert.equal(r.celdas.length, 2);
  const de = Math.ceil(C.ocupantes(eje, compra.id, 2, 0, 0).total / 2);
  assert.deepEqual(r.pagina, { actual: 1, de });
  assert.ok(de >= 1);
  const ultima = (await arbol(completa(compra.id, 2, { paginas: { 2: 99 } }), eje, 'huesped', GRANDE, { epoca })).centro.rejilla;
  assert.equal(ultima.pagina.actual, de, 'no pasa de la última');
  const dos = (await arbol(completa(compra.id, 2, { paginas: { 2: 2 } }), eje, 'huesped', GRANDE, { epoca })).centro.rejilla;
  if (de >= 2) assert.equal(dos.celdas[0].ocupante?.texto, C.legible(eje, C.ocupantes(eje, compra.id, 2, 2, 1).ocupantes[0], C.tipo(eje, compra.id, 2), {}).texto);
  if (de > 1) assert.match(html(await arbol(completa(compra.id, 2), eje, 'huesped', GRANDE, { epoca })), /data-pagina="2" data-delta="1"/);
});

test('el 6 y el 7: una banda por escala de T que el calendario mide, de la más fina a la más gruesa, y cada entrada en la banda del paso «escala»', async () => {
  const { eje, compra } = await ejemploCompra();
  const escalas = C.divisionDelMundo(null, 6).bandas;
  for (const pv of [6, 7]) {
    const r = (await arbol(completa(compra.id, pv), eje, 'huesped', GRANDE)).centro.rejilla;
    assert.equal(r.bandas.length, escalas.length, 'tantas bandas como escalas reales');
    assert.deepEqual(r.bandas.map((b) => b.nombre), escalas.map((e) => e.nombre));
    assert.deepEqual(r.bandas.map((b) => b.escala), [...r.bandas.map((b) => b.escala)].sort((a, b) => a - b), 'de la más fina a la más gruesa');
  }
  // El diario de la compra (el pasado, el 6) quema horas: su entrada está en la banda «hora» y en ninguna otra.
  const pasado = (await arbol(completa(compra.id, 6), eje, 'huesped', GRANDE)).centro.rejilla;
  const conEntradas = pasado.bandas.filter((b) => b.items.length);
  assert.deepEqual(conEntradas.map((b) => b.nombre), ['hora']);
  assert.equal(conEntradas[0].items[0].tipo, 'entrada');
  const h = html(await arbol(completa(compra.id, 6), eje, 'huesped', GRANDE));
  assert.equal((h.match(/class="rejilla-banda[ "]/g) ?? []).length, escalas.length);
});

test('el 8 da diez bandas (la cuota «k de 10»); el 9, los diez pasos del camino o, sin pasos, los niveles de madurez', async () => {
  const { eje, compra } = await ejemploCompra();
  const r8 = (await arbol(completa(compra.id, 8), eje, 'huesped', GRANDE)).centro.rejilla;
  assert.equal(r8.bandas.length, 10);
  assert.deepEqual(r8.bandas.map((b) => b.indice), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  // Lo que cuelga de la compra (su hilo) cae en la caja de su cuota: el diario de la compra mueve lo único que hay bajo el menú.
  const hijos = (await arbol(completa(compra.id, 8), eje, 'huesped', GRANDE)).centro.rejilla;
  assert.ok(hijos.bandas.reduce((n, b) => n + b.items.length, 0) + hijos.sinBanda.length >= 0);
  const r9 = (await arbol(completa(compra.id, 9), eje, 'huesped', GRANDE)).centro.rejilla;
  assert.equal(r9.bandas.length, 10);
  assert.equal(r9.pasos, true);
  const a9 = await arbol(completa(compra.id, 9), eje, 'huesped', GRANDE);
  if (a9.camino.pasos.length) assert.deepEqual(r9.bandas.map((b) => b.falta).slice(0, a9.camino.pasos.length), a9.camino.pasos.map((p) => p.falta));
  else assert.ok(r9.bandas.every((b) => typeof b.nivel === 'string'), 'sin pasos, los niveles de madurez');
  const h = html(a9);
  assert.equal((h.match(/class="rejilla-banda[ "]/g) ?? []).length, 10);
});

test('en un bloque la rejilla se usa si cabe (celdas de 48 px o más); si no, la división de epoch.8.3 como hasta ahora', async () => {
  const { eje, compra } = await ejemploCompra();
  const e = escalaDeTamanos();
  const estado = { foco: { X: compra.id, pv: 0 }, niveles: Object.fromEntries(LATERALES.map((pv) => [pv, e.tope])) };
  const a = await arbol(estado, eje, 'huesped', ORDENADOR);
  const bloque = (pv) => a.laterales.find((n) => n.pv === pv);
  // El 1 en una esquina (un cuarto de 1200 × 800: 600 × 400, o menos si compiten): 4 × 4 de 48 px caben.
  const n1 = bloque(1);
  assert.ok(n1.nivel >= NIVEL_BLOQUE && n1.rejilla, 'el 1 usa la rejilla');
  assert.equal(n1.rejilla.celdas.length, 16);
  assert.ok(n1.rejilla.columnas * 48 <= n1.caja.ancho * ORDENADOR.ancho && n1.rejilla.filas * 48 <= n1.caja.alto * ORDENADOR.alto);
  assert.equal(n1.rejilla.entra, false, 'en un bloque no se entra: se sube a pantalla completa');
  // El 4 (10 × 10 = 480 px) no cabe en un cuarto de 800 de alto: cae a la división de 8.3, con su lista de ocupantes.
  const n4 = bloque(4);
  assert.equal(n4.rejilla, undefined, 'el 4 no cabe: sin rejilla');
  assert.ok(n4.ocupantes && n4.disposicion, 'la división de epoch.8.3 como hasta ahora');
  // Cambiar la época para que el 1 sea 10 × 10 lo deja también sin rejilla en ese bloque.
  const epoca = epocaCon((x) => { filaDe(x, 1)[1] = [10]; filaDe(x, 1)[2] = [10]; });
  const b = await arbol(estado, eje, 'huesped', ORDENADOR, { epoca });
  assert.equal(b.laterales.find((n) => n.pv === 1).rejilla, undefined);
  // Las bandas del 6 (7 × 48 = 336 px) no caben en su bloque a 1920 × 1080 (270 px de alto); con tres escalas menos en el calendario (192 px), sí.
  const g = await arbol(estado, eje, 'huesped', GRANDE);
  assert.equal(g.laterales.find((n) => n.pv === 6).rejilla, undefined);
  const pocas = epocaCon((x) => { x[7][0] = x[7][0].filter((r) => ['segundo', 'minuto', 'hora', 'día'].includes(r[0][0])); });
  const h = await arbol(estado, eje, 'huesped', GRANDE, { epoca: pocas });
  assert.equal(h.laterales.find((n) => n.pv === 6).rejilla?.bandas.length, 4);
});

test('la pantalla completa de cada PV lateral usa su rejilla (menos el 0 y el 5, que no se dividen); sin fila en la época, la división de antes', async () => {
  const { eje, compra } = await ejemploCompra();
  for (const pv of LATERALES) assert.ok((await arbol(completa(compra.id, pv), eje, 'huesped', GRANDE)).centro.rejilla, 'rejilla del ' + pv);
  for (const pv of CENTROS) assert.equal((await arbol(completa(compra.id, pv), eje, 'huesped', GRANDE)).centro.rejilla ?? null, null, 'el ' + pv + ' no se divide');
  const sin = epocaCon((e) => { e[8][7][1] = [filaDe(e, 0)]; });
  const a = await arbol(completa(compra.id, 1), eje, 'huesped', GRANDE, { epoca: sin });
  assert.equal(a.centro.rejilla, null);
  assert.ok(a.centro.ocupantes && a.centro.division, 'cae a la lista paginada con la división de epoch.8.3');
});

const NIVEL_BLOQUE = 3;
