// La división de cada mundo en pantalla completa (VG, 10-11 noche, corrige la tanda 4): epoch.8.7 «world division» es un
// dato de la época y la división no es una matriz con herencia sino la cruceta aplicada al elemento pulsado. Una fila
// por PV: [[pv], [hijos], [profundidad], [formas], [lo que mide], [estilo de los de abajo], [nota], [hilos], [enlace]].
// contrato.divisionDelMundo la lee, contrato.hijosDe da los hijos de un elemento con sus ocupantes y la carta coloca
// las celdas según la forma del nivel: una por hijo (un hijo sin ocupantes, apagado y sin entrar), las franjas del 6 y
// el 7 (una por escala de T que el calendario mide), las diez cajas del 8 (los HITOS) y los pasos del camino del 9.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { arbol, escalaDeTamanos, preferencias, LATERALES, CENTROS } from '../carta/carta.js';
import { html } from '../carta/dom.js';
import { t } from '../carta/textos.js';
import * as C from '../src/contrato.js';
import * as A from '../src/acciones.js';
import { pasos } from '../src/pasos.js';
import { HITOS } from '../src/bases.js';
import { EPOCA_0_BTML, cargarEpocaBtml, REGISTROS_DE_MODELOS } from '../src/epocas.js';
import { EPOCA_0_BTML_DATOS, REGLAS_DE_EPOCA_DATOS, PLANTILLAS_DE_EPOCA_DATOS, CORRECCIONES_DE_EPOCA_DATOS } from '../datos/epocas/epocas.js';
import { ejemploCompra, ejemploJardinYParque } from '../ejemplos/ikisai/compra-food.mjs';

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
const celdasDe = (r) => r.celdas.map((c) => [c.fila, c.columna, c.pv]);

test('epoch.8.7 «world division» es un dato de la época con su procedencia: una fila por PV [[pv], [hijos], [profundidad], [formas], [lo que mide], [estilo], [nota], [hilos], [enlace]], sin posiciones vacías', () => {
  const fila = EPOCA_0_BTML.registro[8][7];
  assert.equal(fila[0][0], 'world division');
  assert.match(fila[2][0], /^VG, 10-11 noche/);
  const filas = fila[1];
  assert.deepEqual(filas.map((f) => f[0][0]), [0, 5, 1, 2, 3, 4, 6, 7, 8, 9]);
  // nueve posiciones (la 8 es el enlace, #11); el 6 y el 7, una décima: el orden de sus listas verticales (VG 11-11, #18)
  for (const f of filas) { assert.equal(f.length, [6, 7].includes(f[0][0]) ? 10 : 9); assert.ok(f.every((p) => Array.isArray(p) && p.length > 0), 'sin posiciones vacías: ' + JSON.stringify(f).slice(0, 60)); }
  const d = (pv, nivel = 1) => C.divisionDelMundo(null, pv, { nivel });
  // hijos, profundidad y forma: la cruceta aplicada al elemento pulsado, no una matriz con herencia
  assert.deepEqual([1, 2, 3, 4].map((pv) => [d(pv).hijos, d(pv).profundidad, d(pv).forma]), [
    [[1, 2, 3, 4], 4, 'cruceta'],
    [[1, 2, 3, 4, 5], 5, 'escalera'],
    [[1, 2, 3, 4, 5, 6], 6, 'rejilla'],
    [[], 1, 'matriz'],
  ]);
  for (const pv of [1, 2, 3, 4, 6, 7, 8, 9, 0, 5]) for (const quitado of ['columnas', 'filas', 'hereda']) assert.equal(quitado in d(pv), false, quitado + ' ya no existe');
  assert.deepEqual([0, 5].map((pv) => [d(pv).hijos, d(pv).profundidad, d(pv).forma, d(pv).entra]), [[[], 0, 'lente', false], [[], 0, 'json', false]], 'el 0 y el 5 no se dividen');
  // el 2 enciende los sitios del 1 más el centro (5, dónde encaja); el 3, los del 2 más el lateral izquierdo (6, de dónde viene)
  assert.deepEqual(d(2).hijos, [...d(1).hijos, 5]);
  assert.deepEqual(d(3).hijos, [...d(2).hijos, 6]);
  // los hilos horizontales del 6 y el 7, y solo ellos
  assert.deepEqual(d(6).hilos, [1, 3, 2, 4]);
  assert.deepEqual(d(7).hilos, [2, 4, 1, 3]);
  assert.equal([1, 2, 3, 4, 8, 9].some((pv) => 'hilos' in d(pv)), false);
  assert.deepEqual([d(6).orden, d(7).orden], ['latest', 'soonest']);
  assert.equal([1, 2, 3, 4, 8, 9, 0, 5].some((pv) => 'orden' in d(pv)), false);
  // el 4 mide epoch.5 y el pv; la franja del 6 y el 7, las escalas de T que el calendario mide (epoch.1.3 ∩ epoch.7), no un número escrito
  const medidas = EPOCA_0_BTML.registro[7][0].map((r) => r[0][0]);
  const escalas = EPOCA_0_BTML.registro[1][3][1].map((r, escala) => ({ escala, nombre: r[0][0] })).filter((e) => medidas.includes(e.nombre));
  for (const pv of [6, 7]) {
    assert.deepEqual([d(pv).forma, d(pv).hijos, d(pv).paso], ['franjas', [], 'escala']);
    assert.deepEqual(d(pv).bandas.map((b) => [b.escala, b.nombre]), escalas.map((e) => [e.escala, e.nombre]));
  }
  assert.ok(escalas.length < EPOCA_0_BTML.registro[1][3][1].length, 'hay escalas de T que el calendario no mide (pasado, futuro, inventado)');
  // el 8 y el 9: las diez cajas nivel.grado de HITOS (src/bases.js)
  const cajas = HITOS.map((h) => ({ indice: h.indice, nivel: Number(h.nivel.split('.')[0]), grado: Number(h.nivel.split('.')[1]), nombre: h.nombre }));
  assert.deepEqual([d(8).forma, d(9).forma], ['cielo', 'camino']);
  assert.deepEqual(d(8).bandas, cajas);
  assert.deepEqual(d(9).bandas, cajas);
  assert.equal(d(8).paso, 'cuota', 'el paso que coloca cada registro en su caja es un dato de la fila');
  // el estilo de los de abajo: el CSS por defecto de la época para los hijos (de ejemplo, uno mínimo en el 1)
  assert.equal(d(1).estilo, '--hueco: 1fr;');
  assert.equal(d(2).estilo, '');
  assert.equal(C.divisionDelMundo(null, 11), null);
});

test('divisionDelMundo: la forma es la del nivel en que se mira (la última se repite); entra mientras queden niveles de profundidad', () => {
  const d = (pv, nivel) => C.divisionDelMundo(null, pv, { nivel });
  assert.deepEqual([1, 2, 3, 5, 6, 99].map((n) => d(2, n).forma), ['escalera', 'columnas', 'columnas', 'columnas', 'columnas', 'columnas'], 'el 2: escalera y, de ahí en adelante, columnas');
  assert.deepEqual(d(2, 1).formas, ['escalera', 'columnas']);
  assert.deepEqual([1, 2, 6].map((n) => d(3, n).forma), ['rejilla', 'conversacion', 'conversacion'], 'el 3: rejilla y dentro la conversación');
  assert.deepEqual([1, 2, 4].map((n) => d(1, n).forma), ['cruceta', 'cruceta', 'cruceta'], 'una sola forma: se repite en todos los niveles');
  assert.deepEqual([1, 2, 4, 5].map((n) => [d(2, n).nivel, d(2, n).entra]), [[1, true], [2, true], [4, true], [5, false]]);
  assert.equal(d(2, 99).nivel, 5);
  assert.equal(d(4, 1).entra, false, 'un solo nivel: no se entra');
  assert.equal(C.divisionDelMundo(null, 1, { epoca: epocaCon((e) => { e[8][7][1] = e[8][7][1].filter((f) => f[0][0] !== 1); }) }), null, 'sin fila, la época no dice nada del PV');
});

test('hijosDe(eje, X, pv): los dígitos que el mundo enciende, con su nombre a esa profundidad (epoch.5) y los ocupantes de X.<dígito>; vacio si no hay', async () => {
  const { eje, compra, nota, carpeta } = await conCarpeta();
  const nombres = (nivel) => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => EPOCA_0_BTML.registro[5][nivel][d][0][0]);
  const h = C.hijosDe(eje, carpeta.id, 3);
  assert.deepEqual(h.map((x) => x.digito), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(h.map((x) => x.nombre), [1, 2, 3, 4, 5, 6].map((d) => nombres(1)[d]), 'profundidad 1: cuánto, con qué condición, con quién, qué se hace, dónde encaja, de dónde viene');
  assert.deepEqual(h.map((x) => x.nombre).slice(0, 2), ['cuánto', 'con qué condición']);
  assert.deepEqual(h.map((x) => x.vacio), [false, true, true, true, true, true], 'la carpeta solo tiene ocupantes en su 1');
  assert.deepEqual(h[0].ocupantes, C.ocupantes(eje, carpeta.id, 1, 0, 100).ocupantes);
  assert.equal(h[0].total, 1);
  assert.deepEqual(h[1].ocupantes, []);
  // a mayor nivel, el nombre es el de esa profundidad de epoch.5
  assert.deepEqual(C.hijosDe(eje, nota.id, 1, { nivel: 2 }).map((x) => x.nombre), [1, 2, 3, 4].map((d) => nombres(2)[d]));
  assert.deepEqual(C.hijosDe(eje, compra.id, 4).map((x) => x.digito), [], 'la matriz del 4 no tiene hijos');
  assert.deepEqual(C.hijosDe(eje, 'no-existe', 1).map((x) => x.vacio), [true, true, true, true], 'un registro que no existe: todos vacíos');
  assert.deepEqual(C.hijosDe(eje, compra.id, 99), [], 'sin fila, ninguno');
});

test('la división sale de la época: cambiar la fila en una copia cambia el árbol (el 1 en tres columnas, el 6 con una escala menos, el 8 sin lo que mide)', async () => {
  const { eje, compra } = await ejemploCompra();
  const base = await arbol(completa(compra.id, 1), eje, 'huesped', GRANDE);
  assert.equal(base.centro.rejilla.celdas.length, 4);
  assert.deepEqual(celdasDe(base.centro.rejilla), [[0, 0, 1], [0, 1, 2], [1, 0, 3], [1, 1, 4]], 'cruceta: ↖1 ↗2 ↙3 ↘4');
  const epoca = epocaCon((e) => {
    filaDe(e, 1)[1] = [1, 2, 3];
    filaDe(e, 1)[3] = ['columnas'];
    e[7][0] = e[7][0].filter((r) => r[0][0] !== 'año'); // el calendario deja de medir el año
    filaDe(e, 8)[4] = ['-'];
  });
  const otra = await arbol(completa(compra.id, 1), eje, 'huesped', GRANDE, { epoca });
  assert.deepEqual(celdasDe(otra.centro.rejilla), [[0, 0, 1], [0, 1, 2], [0, 2, 3]]);
  assert.match(html(otra), /data-rejilla="1"[^>]*data-columnas="3" data-filas="1"/);
  assert.equal((await arbol(completa(compra.id, 6), eje, 'huesped', GRANDE)).centro.rejilla.bandas.length, 7);
  assert.equal((await arbol(completa(compra.id, 6), eje, 'huesped', GRANDE, { epoca })).centro.rejilla.bandas.length, 6);
  assert.equal((await arbol(completa(compra.id, 8), eje, 'huesped', GRANDE)).centro.rejilla.bandas.length, 10);
  assert.equal((await arbol(completa(compra.id, 8), eje, 'huesped', GRANDE, { epoca })).centro.rejilla, null, 'sin cajas que medir, el cielo no se divide (cae a la lista de ocupantes)');
});

test('la geometría sale de la forma y de los hijos: cruceta 2 × 2, escalera 1 × 5, columnas 5, rejilla 3 × 2, matriz 10 × 10', async () => {
  const { eje, carpeta } = await conCarpeta();
  const por = async (pv, nivel = 1, extra = {}) => {
    const ruta = nivel === 1 ? {} : { profundidad: { [pv]: Array(nivel - 1).fill(carpeta.id) } };
    return (await arbol(completa(carpeta.id, pv, { ...ruta, ...extra }), eje, 'casa', GRANDE)).centro.rejilla;
  };
  const forma = (r) => [r.forma, r.columnas, r.filas, r.celdas.length];
  assert.deepEqual(forma(await por(1)), ['cruceta', 2, 2, 4]);
  assert.deepEqual(forma(await por(2)), ['escalera', 1, 5, 5]);
  assert.deepEqual(forma(await por(2, 2)), ['columnas', 5, 1, 5]);
  assert.deepEqual(forma(await por(3)), ['rejilla', 3, 2, 6]);
  assert.deepEqual(forma(await por(4)), ['matriz', 10, 10, 100]);
  const r3 = await por(3);
  assert.deepEqual(celdasDe(r3), [[0, 0, 1], [0, 1, 2], [0, 2, 3], [1, 0, 4], [1, 1, 5], [1, 2, 6]], 'cada celda lleva el dígito de su hijo');
  assert.deepEqual((await por(2)).celdas.map((c) => c.nombre), ['cuánto', 'con qué condición', 'con quién', 'qué se hace', 'dónde encaja']);
  // el color de cada celda es el de su hijo (data-color y data-pv)
  const h = html(await arbol(completa(carpeta.id, 3), eje, 'casa', GRANDE));
  for (const d of [1, 2, 3, 4, 5, 6]) assert.match(h, new RegExp(`class="rejilla-celda hijo[^"]*" data-color="${d}" data-pv="${d}"`));
  // la matriz del 4 sigue siendo una lista de ocupantes por filas, con su página
  const r4 = await por(4);
  assert.deepEqual(r4.pagina, { actual: 1, de: 1 });
  assert.ok(r4.celdas.every((c) => c.pv === 4));
});

test('la regla del vacío: un hijo sin ocupantes se pinta con su nombre apagado y no se entra; si todos están vacíos, no se baja', async () => {
  const { eje, hoja, nota, carpeta } = await conCarpeta();
  const lee = (estado) => arbol(estado, eje, 'casa', GRANDE).then((a) => ({ a, r: a.centro.rejilla }));
  const { a, r } = await lee(completa(carpeta.id, 1));
  assert.deepEqual(r.celdas.map((c) => c.vacio), [false, true, true, true]);
  assert.equal(r.vacia, false);
  const h = html(a);
  assert.equal((h.match(/class="rejilla-celda hijo vacia"[^>]*data-vacio/g) ?? []).length, 3, 'tres hijos vacíos, con data-vacio');
  assert.doesNotMatch(h, /class="rejilla-celda hijo"[^>]*data-vacio/);
  for (const c of r.celdas.filter((x) => x.vacio)) assert.deepEqual([c.entra, c.ocupantes.length, typeof c.nombre], [false, 0, 'string'], 'su nombre se conserva (apagado) y no entra');
  assert.equal(r.celdas[0].entra, true, 'la nota tiene algo dentro: se entra');
  // «Hoja» no tiene nada dentro: el ocupante existe pero no se baja a él
  const dentro = (await lee(completa(carpeta.id, 1, { profundidad: { 1: [nota.id] } }))).r;
  assert.equal(dentro.celdas[0].ocupante.X, hoja.id);
  assert.equal(dentro.celdas[0].entra, false);
  assert.equal(dentro.vacia, false);
  // la compra del ejemplo: el 3 tiene ocupantes en el 3 y el 4 pero no en el 5 ni el 6
  const { eje: e2, compra } = await ejemploCompra();
  const r2 = (await arbol(completa(compra.id, 3), e2, 'huesped', GRANDE)).centro.rejilla;
  assert.deepEqual(r2.celdas.map((c) => c.vacio), [false, false, false, false, C.ocupantes(e2, compra.id, 5).total === 0, C.ocupantes(e2, compra.id, 6).total === 0]);
  // un registro sin nada en ningún hijo: todos vacíos, y la rejilla lo dice
  const vacio = await e2.escribir({ autor: 'casa', sobre: compra.id, t: '2026-11-08T10:00:00Z', movimientos: T, payload: [['Vacío']] });
  const rv = (await arbol(completa(vacio.id, 1), e2, 'casa', GRANDE)).centro.rejilla;
  assert.equal(rv.vacia, true);
  assert.ok(rv.celdas.every((c) => c.vacio && !c.entra));
  assert.match(html(await arbol(completa(vacio.id, 1), e2, 'casa', GRANDE)), /data-vacia/);
});

test('entrar en una celda baja un nivel de profundidad y «volver» sube; en el último nivel, la celda ya no entra', async () => {
  const { eje, hoja, nota, carpeta } = await conCarpeta();
  const lee = (estado) => arbol(estado, eje, 'casa', GRANDE).then((a) => ({ a, r: a.centro.rejilla }));
  const { a: a0, r: r0 } = await lee(completa(carpeta.id, 1));
  assert.deepEqual([r0.nivel, r0.niveles], [1, 4]);
  const celda = r0.celdas.find((c) => c.ocupante);
  assert.equal(celda.pv, 1, 'el ocupante está en el hijo 1 (cuánto) de la carpeta');
  assert.equal(celda.entra, true, 'el ocupante es un registro con algo dentro y quedan niveles');
  assert.equal(celda.ocupante.X, nota.id);
  const h0 = html(a0);
  assert.match(h0, new RegExp(`data-celda="${nota.id}"`));
  assert.doesNotMatch(h0, /data-subir=/);
  assert.match(h0, /class="volver volver-claro"[^>]*data-foco-pv="0"/, 'a nivel 1, volver sale de la pantalla completa');
  // Entrar (lo que hace la app: estado.profundidad[pv] = [...ruta, X]): la rejilla es ahora la de «Nota» y enseña sus ocupantes.
  const { a: a1, r: r1 } = await lee(completa(carpeta.id, 1, { profundidad: { 1: [nota.id] } }));
  assert.deepEqual([r1.nivel, r1.X, r1.ruta], [2, nota.id, [nota.id]]);
  assert.equal(r1.celdas.length, 4, 'cada esquina vuelve a dividirse');
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

test('la matriz del 4 pagina por matrices enteras; las demás formas no paginan (cada hijo lleva la lista de sus ocupantes)', async () => {
  const { eje, compra } = await ejemploCompra();
  // Una época con el 2 como matriz: 100 celdas por página; la compra trae pocos ocupantes en el 2, una sola página.
  const epoca = epocaCon((e) => { filaDe(e, 2)[3] = ['matriz']; });
  const r = (await arbol(completa(compra.id, 2), eje, 'huesped', GRANDE, { epoca })).centro.rejilla;
  assert.equal(r.celdas.length, 100);
  assert.deepEqual(r.pagina, { actual: 1, de: 1 });
  const total = C.ocupantes(eje, compra.id, 2, 0, 0).total;
  assert.equal(r.celdas.filter((c) => c.ocupante).length, total);
  assert.deepEqual(r.celdas.filter((c) => c.ocupante).map((c) => c.ocupante.texto), C.ocupantes(eje, compra.id, 2, 0, total).ocupantes.map((o) => C.legible(eje, o, C.tipo(eje, compra.id, 2), { idioma: 'es' }).texto));
  const ultima = (await arbol(completa(compra.id, 2, { paginas: { 2: 99 } }), eje, 'huesped', GRANDE, { epoca })).centro.rejilla;
  assert.equal(ultima.pagina.actual, 1, 'no pasa de la última');
  const cruceta = (await arbol(completa(compra.id, 1), eje, 'huesped', GRANDE)).centro.rejilla;
  assert.equal(cruceta.pagina, null);
  assert.deepEqual(cruceta.celdas[0].ocupantes.map((o) => o.texto).length, C.ocupantes(eje, compra.id, 1).total, 'cada hijo lleva todos sus ocupantes (hasta el paso de la época)');
});

test('el 6 y el 7: una franja por escala de T que el calendario mide; el 6 con la más lejana a la izquierda y hoy a la derecha, el 7 al revés', async () => {
  const { eje, compra } = await ejemploCompra();
  const escalas = C.divisionDelMundo(null, 6).bandas;
  const r6 = (await arbol(completa(compra.id, 6), eje, 'huesped', GRANDE)).centro.rejilla;
  const r7 = (await arbol(completa(compra.id, 7), eje, 'huesped', GRANDE)).centro.rejilla;
  for (const r of [r6, r7]) {
    assert.equal(r.forma, 'franjas');
    assert.equal(r.bandas.length, escalas.length, 'tantas franjas como escalas reales');
  }
  assert.deepEqual(r7.bandas.map((b) => b.escala), [...r7.bandas.map((b) => b.escala)].sort((a, b) => a - b), 'el 7: la más cercana a ahora (la más fina) a la izquierda');
  assert.deepEqual(r6.bandas.map((b) => b.escala), [...r7.bandas.map((b) => b.escala)].reverse(), 'el 6: al revés, la más cercana a ahora a la derecha');
  assert.deepEqual(r7.bandas.map((b) => b.nombre), escalas.map((e) => e.nombre));
  // El diario de la compra (el pasado, el 6) quema horas: su entrada está en la franja «hora» y en ninguna otra.
  const conEntradas = r6.bandas.filter((b) => b.items.length);
  assert.deepEqual(conEntradas.map((b) => b.nombre), ['hora']);
  assert.equal(conEntradas[0].items[0].tipo, 'entrada');
  const h = html(await arbol(completa(compra.id, 6), eje, 'huesped', GRANDE));
  assert.equal((h.match(/class="rejilla-banda hijo[ "]/g) ?? []).length, escalas.length);
});

test('el 8 da las diez cajas nivel.grado de HITOS; el 9, primero esas diez posiciones para situarse (con la madurez del foco) y debajo los pasos del camino y la guía, plegables', async () => {
  const { eje, compra } = await ejemploCompra();
  const r8 = (await arbol(completa(compra.id, 8), eje, 'huesped', GRANDE)).centro.rejilla;
  assert.equal(r8.forma, 'cielo');
  assert.equal(r8.bandas.length, 10);
  assert.deepEqual(r8.bandas.map((b) => b.indice), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(r8.bandas.map((b) => b.nombre), HITOS.map((h) => h.nombre));
  assert.deepEqual(r8.bandas.map((b) => `${b.nivel}.${b.grado}`), HITOS.map((h) => h.nivel));
  const a9 = await arbol(completa(compra.id, 9), eje, 'huesped', GRANDE);
  const r9 = a9.centro.rejilla;
  assert.equal(r9.forma, 'camino');
  assert.equal(r9.camino, true);
  assert.equal(r9.bandas.length, 10);
  assert.deepEqual(r9.bandas.map((b) => b.nombre), HITOS.map((h) => h.nombre), 'primero las diez posiciones para situarse');
  assert.deepEqual(r9.bandas.map((b) => `${b.nivel}.${b.grado}`), HITOS.map((h) => h.nivel));
  const m = C.madurez(eje, compra.id);
  assert.deepEqual([r9.madurez.nivel, r9.madurez.de], [m.nivel, m.de], 'la madurez del foco, del núcleo (ninguna caja se enciende: nada asigna nivel ni grado al foco)');
  const h = html(a9);
  assert.equal((h.match(/class="rejilla-banda hijo[ "]/g) ?? []).length, 10);
  // Debajo, los pasos del camino y la guía de siempre (htmlCamino), plegables; la guía no se repite fuera de la rejilla.
  assert.match(h, /class="camino-mensajes"><details class="plegable" open><summary>[^<]*<\/summary><section class="camino"/);
  assert.deepEqual([r8.columnas, r8.filas, r9.columnas, r9.filas], [5, 2, 5, 2], 'las diez cajas en dos filas');
});

test('en un bloque la rejilla se usa si cabe (celdas de 48 px o más); si no, la división de epoch.8.3 como hasta ahora', async () => {
  const { eje, compra } = await ejemploCompra();
  const e = escalaDeTamanos();
  const estado = { foco: { X: compra.id, pv: 0 }, niveles: Object.fromEntries(LATERALES.map((pv) => [pv, e.tope])) };
  const a = await arbol(estado, eje, 'huesped', ORDENADOR);
  const bloque = (pv) => a.laterales.find((n) => n.pv === pv);
  // El 1 en una esquina (un cuarto de 1200 × 800: 600 × 400, o menos si compiten): la cruceta 2 × 2 de 48 px cabe.
  const n1 = bloque(1);
  assert.ok(n1.nivel >= NIVEL_BLOQUE && n1.rejilla, 'el 1 usa la rejilla');
  assert.equal(n1.rejilla.celdas.length, 4);
  assert.ok(n1.rejilla.columnas * 48 <= n1.caja.ancho * ORDENADOR.ancho && n1.rejilla.filas * 48 <= n1.caja.alto * ORDENADOR.alto);
  assert.equal(n1.rejilla.entra, false, 'en un bloque no se entra: se sube a pantalla completa');
  // El 4 (10 × 10 = 480 px) no cabe en un cuarto de 800 de alto: cae a la división de 8.3, con su lista de ocupantes.
  const n4 = bloque(4);
  assert.equal(n4.rejilla, undefined, 'el 4 no cabe: sin rejilla');
  assert.ok(n4.ocupantes && n4.disposicion, 'la división de epoch.8.3 como hasta ahora');
  // Cambiar la época para que el 1 sea una matriz (10 × 10) lo deja también sin rejilla en ese bloque.
  const epoca = epocaCon((x) => { filaDe(x, 1)[3] = ['matriz']; });
  const b = await arbol(estado, eje, 'huesped', ORDENADOR, { epoca });
  assert.equal(b.laterales.find((n) => n.pv === 1).rejilla, undefined);
  // Las franjas del 6 son verticales: siete columnas (7 × 48 = 336 px) y los cuatro hilos más la fila de los nombres
  // (5 × 48 = 240 px) caben en su bloque a 1920 × 1080; en una pantalla de 900 × 600 (un bloque de 300 × 200), no;
  // con tres escalas menos en el calendario (4 × 48 = 192 px de ancho), tampoco: no caben los cinco de alto.
  const g = await arbol(estado, eje, 'huesped', GRANDE);
  const r6 = g.laterales.find((n) => n.pv === 6).rejilla;
  assert.deepEqual([r6?.forma, r6?.columnas, r6?.filas, r6?.bandas.length], ['franjas', 7, 5, 7]);
  const pequena = { ancho: 900, alto: 600 };
  assert.equal((await arbol(estado, eje, 'huesped', pequena)).laterales.find((n) => n.pv === 6).rejilla, undefined);
  const pocas = epocaCon((x) => { x[7][0] = x[7][0].filter((r) => ['segundo', 'minuto', 'hora', 'día'].includes(r[0][0])); });
  assert.equal((await arbol(estado, eje, 'huesped', pequena, { epoca: pocas })).laterales.find((n) => n.pv === 6).rejilla, undefined);
  assert.equal((await arbol(estado, eje, 'huesped', GRANDE, { epoca: pocas })).laterales.find((n) => n.pv === 6).rejilla?.bandas.length, 4);
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

// ---------- las formas sobrias del segundo nivel (VG, mockup v3): lo que cada mundo pinta a pantalla completa ----------

/** El HTML de la rejilla a pantalla completa (desde su contenedor hasta la ayuda del centro). */
const rejillaHtml = (h) => {
  const desde = h.indexOf('<div class="rejilla rejilla-completa"');
  return h.slice(desde, h.indexOf('<p class="ayuda">', desde));
};

test('la cruceta trae cuatro celdas (las esquinas) y el pulsado como tarjeta central flotante con sus dos caras y ↻; en un bloque, sin tarjeta', async () => {
  const { eje, compra } = await ejemploCompra();
  const a = await arbol(completa(compra.id, 1), eje, 'huesped', GRANDE);
  const r = a.centro.rejilla;
  assert.equal(r.celdas.length, 4);
  assert.deepEqual(Object.keys(r.flotante).sort(), ['X', 'ancla', 'etiqueta', 'medida', 'pasos', 'plantilla', 'pv', 'texto'].sort());
  assert.equal(r.flotante.X, compra.id);
  assert.equal(r.flotante.texto, C.legible(eje, { ref: compra.id }, null, { idioma: a.idioma }).texto, 'su nombre, el legible del núcleo');
  assert.equal(r.flotante.medida.k, a.centro.medida.k, 'su medida en este mundo, la del PV');
  const h = rejillaHtml(html(a));
  assert.match(h, /^<div class="rejilla rejilla-completa" data-rejilla="1" data-forma="cruceta"/);
  assert.match(h, /<div class="rejilla-celdas rejilla-cruceta"/);
  assert.equal((h.match(/class="rejilla-celda hijo[ "]/g) ?? []).length, 4);
  assert.equal((h.match(/class="centro-flotante"/g) ?? []).length, 1);
  assert.match(h, /class="flotante-cara cara-0">[\s\S]*data-girar[\s\S]*class="flotante-cara cara-5" aria-hidden="true">[\s\S]*data-girar/, 'cara 0 y cara 5, cada una con su ↻');
  assert.match(h, /class="flotante-barra" style="--lleno:0\.\d+"/, 'la medida con «de» lleva su barra');
  // las esquinas: la tarjeta del hijo (nombre, total) y su tabla; la décupla, una columna por hoja
  assert.match(h, /data-pv="1"[^>]*><header class="hijo-cabeza"><span class="numero">1<\/span><span class="hijo-nombre">cuánto<\/span><span class="hijo-cifra">\d+<\/span><\/header><div class="hijo-cuerpo"><table class="hijo-tabla">/);
  // en un bloque, la misma rejilla sin tarjeta flotante
  const e = escalaDeTamanos();
  const b = await arbol({ foco: { X: compra.id, pv: 0 }, niveles: Object.fromEntries(LATERALES.map((pv) => [pv, e.tope])) }, eje, 'huesped', ORDENADOR);
  assert.ok(b.laterales.find((n) => n.pv === 1).rejilla.flotante, 'el árbol la trae');
  assert.doesNotMatch(html(b), /class="centro-flotante"/, 'pero en un bloque no se pinta');
});

test('los ganchos del animado: cada hijo es .hijo[data-pv] con .hijo-nombre, .hijo-cifra y .hijo-cuerpo; el contenedor .rejilla-completa[data-forma] posicionado y aislado; los huecos salen de --hueco', async () => {
  const { eje, compra } = await ejemploCompra();
  for (const pv of [1, 2, 3]) {
    const h = rejillaHtml(html(await arbol(completa(compra.id, pv), eje, 'huesped', GRANDE)));
    const hijos = h.split('<div class="rejilla-celda hijo').slice(1);
    assert.ok(hijos.length >= 4, 'hijos del ' + pv);
    for (const x of hijos) {
      assert.match(x, /^[^"]*" data-color="\d" data-pv="\d"/);
      for (const c of ['hijo-nombre', 'hijo-cifra', 'hijo-cuerpo']) assert.ok(x.includes(`class="${c}`), c + ' en ' + x.slice(0, 80));
    }
  }
  const css = readFileSync(new URL('../carta/estilo.css', import.meta.url), 'utf8');
  assert.match(css, /\.rejilla-completa\{position:relative;isolation:isolate;--hueco:/);
  assert.match(css, /\.rejilla-completa \.rejilla-celdas,\.rejilla-completa \.rejilla-bandas\{gap:var\(--hueco\)\}/);
  assert.match(css, /\.flotante-giro\{[^}]*transition:transform 300ms ease-out/, 'el giro: rotateY en 300 ms');
  assert.match(css, /\.centro-flotante\.girada \.flotante-giro\{transform:rotateY\(180deg\)\}/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)\{\.flotante-giro\{transition:none\}\}/);
  // nada de eso puede venir de datos: cssSeguro no deja pasar position, z-index, transform ni animation
  assert.equal(C.cssSeguro('position: absolute; z-index: 3; transform: rotateY(180deg); animation: x 1s'), '');
  assert.equal(C.cssSeguro('--hueco: 12px; position: absolute'), '--hueco: 12px;');
  // girar la tarjeta es solo cosa de la pantalla (gestos.js, data-girar); entrar en una celda baja en el mundo de la rejilla
  const gestos = readFileSync(new URL('../carta/gestos.js', import.meta.url), 'utf8');
  assert.match(gestos, /\[data-girar\][\s\S]*?classList\.toggle\('girada'\)/);
  assert.match(gestos, /m\.celda\?\.\(Number\(el\.closest\('\[data-rejilla\]'\)\?\.dataset\.rejilla/);
});

test('la regla del vacío pinta el paso del camino: «escribir aquí · <acción por defecto del PV>», con el nombre que dan las acciones en el idioma', async () => {
  const { eje, compra } = await ejemploCompra();
  for (const yo of ['huesped', 'casa']) {
    const a = await arbol(completa(compra.id, 3), eje, yo, GRANDE);
    const vacio = a.centro.rejilla.celdas.find((c) => c.vacio);
    assert.ok(vacio, 'el 3 de la compra tiene un hijo vacío');
    const lista = A.acciones(eje, compra.id, vacio.pv, yo, { idioma: a.idioma });
    const defecto = lista.find((x) => x.porDefecto) ?? lista[0] ?? null;
    assert.deepEqual(vacio.escribir, defecto ? { id: defecto.id, nombre: defecto.etiqueta } : null);
    const h = rejillaHtml(html(a));
    const texto = defecto ? t('escribirAquiAccion', { accion: defecto.etiqueta }) : t('escribirAqui');
    assert.ok(h.includes(`data-pv="${vacio.pv}" data-fila="${vacio.fila}" data-columna="${vacio.columna}" data-vacio><header class="hijo-cabeza"><span class="numero">${vacio.pv}</span><span class="hijo-nombre">${vacio.nombre}</span><span class="hijo-cifra"></span></header><div class="hijo-cuerpo"><span class="hijo-vacio">${texto}</span>`), 'nombre apagado y debajo el paso del camino');
  }
  // las celdas con ocupantes no lo llevan
  const r = (await arbol(completa(compra.id, 1), eje, 'huesped', GRANDE)).centro.rejilla;
  assert.ok(r.celdas.filter((c) => !c.vacio).every((c) => c.escribir === null));
});

test('el nivel 2 del 2 son cinco columnas con el nivel siguiente dentro (contrato.hijosDe al nivel + 1, con la misma regla del vacío)', async () => {
  const { eje, nota, carpeta } = await conCarpeta();
  const a = await arbol(completa(carpeta.id, 2, { profundidad: { 2: [carpeta.id] } }), eje, 'casa', GRANDE);
  const r = a.centro.rejilla;
  assert.deepEqual([r.forma, r.nivel, r.columnas, r.filas, r.celdas.length], ['columnas', 2, 5, 1, 5]);
  const columna = r.celdas.find((c) => c.siguiente?.length);
  assert.equal(columna.pv, 1, 'la nota cuelga del 1 de la carpeta');
  const sig = columna.siguiente[0];
  assert.equal(sig.X, nota.id);
  const esperados = C.hijosDe(eje, nota.id, 2, { nivel: 3 });
  assert.deepEqual(sig.hijos.map((h) => [h.digito, h.nombre, h.total, h.vacio]), esperados.map((h) => [h.digito, h.nombre, h.total, h.vacio]));
  assert.equal(sig.hijos.find((h) => !h.vacio).digito, 1, 'la hoja, en el 1 de la nota');
  assert.ok(sig.hijos.filter((h) => h.vacio).every((h) => 'escribir' in h), 'los vacíos llevan su paso del camino');
  const h = rejillaHtml(html(a));
  assert.match(h, /<div class="rejilla-celdas rejilla-columnas" style="--columnas:5;--filas:1">/);
  assert.equal((h.match(/class="siguiente-hijo[ "]/g) ?? []).length, 5);
  assert.equal((h.match(/class="siguiente-hijo vacia"[^>]*data-vacio/g) ?? []).length, 4);
});

test('la matriz del 4 trae sus dos ejes nombrados (columnas: los diez PV como tipo de interacción; filas: la posición modificada) y la diagonal marcada', async () => {
  const { eje, compra } = await ejemploCompra();
  const a = await arbol(completa(compra.id, 4), eje, 'huesped', GRANDE);
  const r = a.centro.rejilla;
  const opts = { idioma: a.idioma };
  const diez = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  assert.deepEqual(r.ejes.columnas.map((c) => c.pv), diez);
  assert.deepEqual(r.ejes.columnas.map((c) => c.etiqueta), diez.map((k) => C.etiqueta(eje, null, k, opts)));
  assert.deepEqual(r.ejes.filas.map((f) => f.nombre), diez.map((k) => C.etiqueta(eje, null, [0, k], opts)));
  assert.deepEqual(r.ejes.filas.slice(0, 3).map((f) => f.nombre), ['qué es', 'cuánto', 'con qué condición']);
  assert.deepEqual(r.celdas.filter((c) => c.diagonal).map((c) => [c.fila, c.columna]), diez.map((k) => [k, k]));
  const h = rejillaHtml(html(a));
  assert.equal((h.match(/class="matriz-eje matriz-columna"/g) ?? []).length, 10);
  assert.equal((h.match(/class="matriz-eje matriz-fila"/g) ?? []).length, 10);
  assert.equal((h.match(/class="rejilla-celda hijo[^"]* diagonal"/g) ?? []).length, 10);
  assert.equal((h.match(/class="rejilla-celda hijo estacion/g) ?? []).length, C.ocupantes(eje, compra.id, 4).total, 'cada celda con ocupante, una estación');
});

test('las franjas del 6 y el 7 son verticales y traen cuatro hilos horizontales en el orden de d.hilos; cada cuenta en su franja y en un hilo', async () => {
  const { eje, compra } = await ejemploCompra();
  for (const pv of [6, 7]) {
    const d = C.divisionDelMundo(eje, pv);
    const a = await arbol(completa(compra.id, pv), eje, 'huesped', GRANDE);
    const r = a.centro.rejilla;
    assert.deepEqual(r.hilos.map((x) => x.pv), d.hilos);
    assert.deepEqual([r.columnas, r.filas], [d.bandas.length, d.hilos.length + 1], 'una columna por franja; una fila por hilo y la de los nombres');
    for (const b of r.bandas) assert.deepEqual(b.cruces.map((c) => c.hilo), d.hilos, 'cada franja, cruzada por los cuatro hilos');
    const h = rejillaHtml(html(a));
    assert.deepEqual([...h.matchAll(/class="hilo" data-hilo="(\d)" data-color="\d" style="grid-column:1 \/ -1;grid-row:(\d)"/g)].map((m) => [Number(m[1]), Number(m[2])]), d.hilos.map((x, j) => [x, j + 2]), 'los hilos, de arriba abajo, atraviesan todas las columnas');
    assert.deepEqual([...h.matchAll(/class="rejilla-banda hijo franja-tiempo[^"]*" data-banda="(\d)" style="grid-column:(\d+);grid-row:1 \/ -1"/g)].map((m) => [Number(m[1]), Number(m[2])]), r.bandas.map((b, i) => [b.indice, i + 2]), 'las franjas, columnas de izquierda a derecha, de arriba abajo');
    assert.equal(r.bandas.find((b) => b.ahora).escala, Math.min(...d.bandas.map((b) => b.escala)), 'la más cercana a ahora, marcada');
  }
  // la entrada del diario de la compra (en la franja «hora») no cuelga de ninguno de los cuatro hilos: va en el primero, marcada
  const a6 = await arbol(completa(compra.id, 6), eje, 'huesped', GRANDE);
  const r6 = a6.centro.rejilla;
  const hora = r6.bandas.find((b) => b.nombre === 'hora');
  assert.equal(hora.cruces[0].items[0].tipo, 'entrada');
  assert.equal(hora.cruces[0].items[0].hilo, r6.hilos[0].pv);
  assert.equal(hora.cruces[0].items[0].hiloSupuesto, true);
  assert.match(html(a6), /<div class="cruce" data-banda="2" data-hilo="1" style="grid-column:\d+;grid-row:2"><button type="button" class="ocupante cuenta supuesta"[^>]*title="[^"]*2026-11-07 13:30/, 'nombre y fecha en el title');
});

test('más cuentas de las que caben en un cruce: una cuenta mayor con el número', async () => {
  const { eje, compra } = await ejemploCompra();
  // Muchos escritos que queman horas colgados de la compra: el 7 (sin ocupantes) reparte lo que cuelga de ella.
  for (let i = 0; i < 12; i++) await eje.escribir({ autor: 'casa', sobre: compra.id, t: `2026-11-08T1${i % 10}:0${i % 6}:00Z`, movimientos: [{ token: 'T', escala: 'hora', cantidad: 1, de: 'casa', a: null }], payload: [['Hora ' + i]] });
  const pequena = { ancho: 900, alto: 500 };
  const a = await arbol(completa(compra.id, 7), eje, 'casa', pequena);
  const cruce = a.centro.rejilla.bandas.flatMap((b) => b.cruces).find((c) => c.mas);
  assert.ok(cruce, 'algún cruce no da abasto');
  assert.match(html(a), new RegExp(`class="cuenta cuenta-mayor"[^>]*>${cruce.mas}</span>`));
});

test('el cielo del 8 trae las diez cajas nivel.grado en dos filas (arriba 0.3 1.1 2.1 3.1 3.2, abajo 4.1 4.2 5.1 5.2 5.3), la caja del foco por su cuota y las vacías con su paso del camino', async () => {
  const { eje, compra } = await ejemploCompra();
  const a = await arbol(completa(compra.id, 8), eje, 'huesped', GRANDE);
  const r = a.centro.rejilla;
  assert.deepEqual([r.columnas, r.filas], [5, 2]);
  const h = rejillaHtml(html(a));
  const cajas = [...h.matchAll(/class="rejilla-banda hijo caja-cielo[^"]*" data-banda="(\d)" data-nivel="(\d)" data-grado="(\d)"/g)].map((m) => `${m[2]}.${m[3]}`);
  assert.deepEqual(cajas, HITOS.map((x) => x.nivel));
  assert.deepEqual([cajas.slice(0, 5), cajas.slice(5)], [['0.3', '1.1', '2.1', '3.1', '3.2'], ['4.1', '4.2', '5.1', '5.2', '5.3']]);
  assert.match(h, /<div class="rejilla-bandas rejilla-cielo" style="--columnas:5;--filas:2">/);
  const cuota = pasos(eje, compra.id).cuota;
  assert.deepEqual(r.cuota, { nombre: 'cuota', k: cuota.k, de: cuota.de });
  assert.deepEqual(r.bandas.filter((b) => b.foco).map((b) => b.indice), [cuota.k]);
  assert.deepEqual(r.enElFoco, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter((k) => C.ocupantes(eje, compra.id, k, 0, 0).total > 0));
  const medir = A.acciones(eje, compra.id, 8, 'huesped', { idioma: a.idioma }).find((x) => x.porDefecto);
  const vacias = r.bandas.filter((x) => !x.items.length && !x.foco);
  assert.ok(vacias.length);
  for (const b of vacias) assert.deepEqual(b.escribir, { id: medir.id, nombre: medir.etiqueta });
  assert.ok(h.includes(`<span class="hijo-vacio">${t('vacia')} · ${t('escribirAquiAccion', { accion: medir.etiqueta })}</span>`));
});

/** El HTML sin ningún nodo de clase `capa` (con todo lo que lleva dentro). */
function sinCapas(h) {
  const vacios = new Set(['img', 'br', 'input', 'meta', 'link', 'hr', 'source', 'wbr']);
  const re = /<(\/?)([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  let fuera = '';
  let desde = 0;
  let saltando = null;
  let m;
  while ((m = re.exec(h))) {
    const [todo, cierre, nombre, attrs] = m;
    const tag = nombre.toLowerCase();
    if (saltando) {
      if (tag === saltando.tag && !vacios.has(tag)) saltando.n += cierre ? -1 : 1;
      if (saltando.n === 0) { saltando = null; desde = m.index + todo.length; }
      continue;
    }
    if (!cierre && (/\bclass="([^"]*)"/.exec(attrs)?.[1] ?? '').split(/\s+/).includes('capa')) {
      fuera += h.slice(desde, m.index);
      if (vacios.has(tag)) desde = m.index + todo.length;
      else saltando = { tag, n: 1 };
    }
  }
  return fuera + (saltando ? '' : h.slice(desde));
}

test('nada de la forma depende del modelo: en sobrio y en animado la rejilla de cada mundo es el mismo HTML', async () => {
  const { eje, compra } = await ejemploCompra();
  const sobrio = {};
  for (const pv of [1, 2, 3, 4, 6, 7, 8, 9]) sobrio[pv] = rejillaHtml(html(await arbol(completa(compra.id, pv), eje, 'huesped', GRANDE)));
  const clave = C.clavesDeConfiguracion().find((c) => c.clave === 'render');
  const otra = clave.valores.find((v) => v !== C.configuracion(eje, 'huesped').render);
  // aun con el modelo sobrio nombrado, va al final de la cadena (#3) y el animado trae sus capas: sin ellas, el mismo HTML
  // (el «mismo DOM sin .capa» en detalle lo comprueba test/animado-capas.test.js)
  const p = preferencias(eje, 'huesped', { render: otra, model: 'sobrio' });
  await eje.escribir({ autor: 'huesped', sobre: p.sobre, en: p.en, t: '2026-11-07T13:30:00Z', movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'huesped', a: null }], payload: p.payload });
  // la preferencia es un escrito más: el diario (el 6) y la madurez del alta no son de la compra; lo de la compra no cambia
  for (const pv of [1, 2, 3, 4, 6, 7, 8, 9]) {
    const a = await arbol(completa(compra.id, pv), eje, 'huesped', GRANDE);
    assert.equal(a.animado, true);
    const h = rejillaHtml(html(a));
    assert.ok(h.length > 200, 'rejilla del ' + pv);
    assert.match(h, /class="capa /, 'el sobrio nombrado no quita el arte (#3)');
    assert.equal(sinCapas(h), sobrio[pv], 'el mundo ' + pv + ' es igual en sobrio y en animado (sin las capas)');
  }
});

// ---------- lo que el núcleo mide de cada hijo, en la pantalla completa del 2 y del 3 (encargo «datos», issue #11) ----------

/** La compra con su jardín y su parque (ejemplos/ikisai/compra-food.mjs): votos y umbral en el 2, paquetes en el 3. */
async function conJardinYParque() {
  const c = await ejemploCompra();
  return { ...c, ...(await ejemploJardinYParque(c.eje, c)) };
}

test('el 2 a pantalla completa: cada peldaño y cada columna con sus votos (P comprometido y reposicionable) y, si el criterio dice su mirada, «umbral n · faltan m» y la barra hacia el umbral', async () => {
  const { eje, compra, decision } = await conJardinYParque();
  // nivel 1, la escalera de la compra: el peldaño 2 con los votos de su mirada; sin umbral (el criterio de la compra no dice mirada)
  const a = await arbol(completa(compra.id, 2), eje, 'huesped', GRANDE);
  const r = a.centro.rejilla;
  assert.equal(r.forma, 'escalera');
  const hijos = C.hijosDe(eje, compra.id, 2);
  assert.deepEqual(r.celdas.map((c) => [c.pv, c.votos ?? null, c.meta ?? null]), hijos.map((h) => [h.digito, h.comprometidos + h.reposicionables > 0 ? { comprometidos: h.comprometidos, reposicionables: h.reposicionables } : null, null]));
  const h1 = rejillaHtml(html(a));
  const votos = t('hijoVotos', { comprometidos: 5, reposicionables: 6 });
  assert.ok(h1.includes(`<footer class="hijo-pie"><p class="hijo-medida">${votos}</p><span class="hijo-barra" data-de="votos" style="--lleno:0.455"`), 'la línea de los votos y la barra de lo comprometido');
  assert.equal((h1.match(/class="hijo-pie"/g) ?? []).length, 1, 'solo el peldaño que tiene votos');
  // nivel 2, dentro de la decisión: la columna 2 con «umbral 10 · faltan 3» y la barra hacia el umbral (7 de 10)
  const b = await arbol(completa(compra.id, 2, { profundidad: { 2: [decision.id] } }), eje, 'huesped', GRANDE);
  const dos = b.centro.rejilla.celdas.find((c) => c.pv === 2);
  assert.equal(b.centro.rejilla.forma, 'columnas');
  assert.deepEqual([dos.meta, dos.votos], [{ umbral: 10, valor: 7, pasa: false, faltan: 3 }, { comprometidos: 2, reposicionables: 9 }]);
  const h2 = rejillaHtml(html(b));
  assert.ok(h2.includes(`<p class="hijo-medida">${t('hijoUmbral', { umbral: 10, faltan: 3 })} · ${t('hijoVotos', { comprometidos: 2, reposicionables: 9 })}</p><span class="hijo-barra" data-de="umbral" style="--lleno:0.7"`));
});

test('el 3 a pantalla completa: cada caja con su grupo de atención y su precio (el enlace de la época); dentro, cada mensaje con el estado de su paquete', async () => {
  const { eje, compra, conversacion } = await conJardinYParque();
  const a = await arbol(completa(compra.id, 3), eje, 'huesped', GRANDE);
  const r = a.centro.rejilla;
  assert.equal(r.forma, 'rejilla');
  const hijos = C.hijosDe(eje, compra.id, 3, { idioma: a.idioma });
  assert.deepEqual(r.celdas.map((c) => [c.pv, c.precio]), hijos.map((h) => [h.digito, h.precio]));
  const h1 = rejillaHtml(html(a));
  for (const h of hijos) assert.ok(h1.includes(`<p class="hijo-precio" data-zona="${h.precio.zona}"><b>${h.precio.grupo}</b> · ${h.precio.texto}</p>`), 'el precio de la zona ' + h.precio.zona);
  // la regla del vacío sigue igual: el nombre apagado y debajo el paso del camino, y el precio en el pie
  assert.ok(r.celdas.some((c) => c.vacio && c.precio));
  // nivel 2: la conversación, cada mensaje con su paquete
  const b = await arbol(completa(compra.id, 3, { profundidad: { 3: [conversacion.id] } }), eje, 'huesped', GRANDE);
  assert.equal(b.centro.rejilla.forma, 'conversacion');
  const tres = b.centro.rejilla.celdas.find((c) => c.pv === 3);
  assert.deepEqual(tres.ocupantes.map((o) => o.estado ?? null), ['atendido', 'pendiente', 'perdonado']);
  const h2 = rejillaHtml(html(b));
  for (const [estado, clave] of [['atendido', 'paqueteAtendido'], ['pendiente', 'paquetePendiente'], ['perdonado', 'paquetePerdonado']]) {
    assert.ok(h2.includes(`<small class="paquete" data-estado="${estado}">${t(clave)}</small>`), estado);
  }
  // los textos son de la interfaz (carta/textos.js) y el estilo solo CSS
  const css = readFileSync(new URL('../carta/estilo.css', import.meta.url), 'utf8');
  for (const sel of ['.hijo-pie{', '.hijo-barra{', '.hijo-precio b{', '.conversacion .mensaje .paquete{']) assert.ok(css.includes(sel), sel);
});
