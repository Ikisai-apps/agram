// La división de cada mundo en pantalla completa (VG, 10-11 noche, corrige la tanda 4): epoch.8.7 «world division» es un
// dato de la época y la división no es una matriz con herencia sino la cruceta aplicada al elemento pulsado. Una fila
// por PV: [[pv], [hijos], [profundidad], [formas], [lo que mide], [estilo de los de abajo], [nota], [hilos]].
// contrato.divisionDelMundo la lee, contrato.hijosDe da los hijos de un elemento con sus ocupantes y la carta coloca
// las celdas según la forma del nivel: una por hijo (un hijo sin ocupantes, apagado y sin entrar), las franjas del 6 y
// el 7 (una por escala de T que el calendario mide), las diez cajas del 8 (los HITOS) y los pasos del camino del 9.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arbol, escalaDeTamanos, LATERALES, CENTROS } from '../carta/carta.js';
import { html } from '../carta/dom.js';
import * as C from '../src/contrato.js';
import { HITOS } from '../src/bases.js';
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
const celdasDe = (r) => r.celdas.map((c) => [c.fila, c.columna, c.pv]);

test('epoch.8.7 «world division» es un dato de la época con su procedencia: una fila por PV [[pv], [hijos], [profundidad], [formas], [lo que mide], [estilo], [nota], [hilos]], sin posiciones vacías', () => {
  const fila = EPOCA_0_BTML.registro[8][7];
  assert.equal(fila[0][0], 'world division');
  assert.match(fila[2][0], /^VG, 10-11 noche/);
  const filas = fila[1];
  assert.deepEqual(filas.map((f) => f[0][0]), [0, 5, 1, 2, 3, 4, 6, 7, 8, 9]);
  for (const f of filas) { assert.equal(f.length, 8); assert.ok(f.every((p) => Array.isArray(p) && p.length > 0), 'sin posiciones vacías: ' + JSON.stringify(f).slice(0, 60)); }
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
  assert.deepEqual(r.celdas.filter((c) => c.ocupante).map((c) => c.ocupante.texto), C.ocupantes(eje, compra.id, 2, 0, total).ocupantes.map((o) => C.legible(eje, o, C.tipo(eje, compra.id, 2), {}).texto));
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

test('el 8 da las diez cajas nivel.grado de HITOS; el 9, primero esas diez posiciones para situarse y después los pasos del camino o, sin pasos, los niveles de madurez', async () => {
  const { eje, compra } = await ejemploCompra();
  const r8 = (await arbol(completa(compra.id, 8), eje, 'huesped', GRANDE)).centro.rejilla;
  assert.equal(r8.forma, 'cielo');
  assert.equal(r8.bandas.length, 10);
  assert.deepEqual(r8.bandas.map((b) => b.indice), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(r8.bandas.map((b) => b.nombre), HITOS.map((h) => h.nombre));
  assert.deepEqual(r8.bandas.map((b) => `${b.nivel}.${b.grado}`), HITOS.map((h) => h.nivel));
  const r9 = (await arbol(completa(compra.id, 9), eje, 'huesped', GRANDE)).centro.rejilla;
  assert.equal(r9.forma, 'camino');
  assert.equal(r9.bandas.length, 10);
  assert.equal(r9.pasos, true);
  assert.deepEqual(r9.situarse.map((b) => b.nombre), HITOS.map((h) => h.nombre), 'las diez posiciones para situarse');
  const a9 = await arbol(completa(compra.id, 9), eje, 'huesped', GRANDE);
  if (a9.camino.pasos.length) assert.deepEqual(r9.bandas.map((b) => b.falta).slice(0, a9.camino.pasos.length), a9.camino.pasos.map((p) => p.falta));
  else assert.ok(r9.bandas.every((b) => typeof b.nivel === 'string'), 'sin pasos, los niveles de madurez');
  const h = html(a9);
  assert.equal((h.match(/class="rejilla-banda hijo[ "]/g) ?? []).length, 10);
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
  // Las franjas del 6 (7 × 48 = 336 px) no caben en su bloque a 1920 × 1080 (270 px de alto); con tres escalas menos en el calendario (192 px), sí.
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
