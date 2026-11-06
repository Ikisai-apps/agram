import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapa, render, MATRIZ } from '../src/mapped.js';
import { ejemploCompra } from '../ejemplos/ikisai/compra-food.mjs';
import { direccion } from '../src/btml.js';

const gastaT = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });

test('la matriz es 1 8 2 / 6 5 7 / 3 9 4', () => {
  assert.deepEqual(MATRIZ, [[1, 8, 2], [6, 5, 7], [3, 9, 4]]);
});

test('mapa de la compra: celdas, eje y medidas', async () => {
  const { eje, compra, menu } = await ejemploCompra();
  const m = mapa(eje, compra.id);
  assert.equal(m.celdas.length, 10);
  assert.equal(m.celdas[0].contenido, 'Compra del menú del día');
  assert.deepEqual(m.celdas[4].contenido, ['pagar', 'servir']);
  assert.equal(m.celdas[7].contenido, undefined);
  assert.deepEqual(m.hilo.map((e) => e.id)[0], menu.id);
  assert.equal(m.hilo.length, 3);
  assert.deepEqual(m.hijos, []);
  assert.equal(m.medidas.profundidadHilo, 3);
  assert.equal(m.medidas.movimientos, 2);
  assert.equal(m.medidas.identidades, 2);
  assert.equal(m.medidas.posicionesDesarrolladas, 5);
});

test('lo escrito en una posición cuenta en su celda y en el eje', async () => {
  const { eje, compra } = await ejemploCompra();
  await eje.escribir({ autor: 'huesped', sobre: compra.id, en: direccion([7]), t: '2026-11-07T14:00:00Z', movimientos: [gastaT('huesped')], payload: 'repetir el viernes' });
  const m = mapa(eje, compra.id);
  assert.equal(m.celdas[7].escritos, 1);
  assert.equal(m.celdas[4].escritos, 0);
  assert.equal(m.hijos.length, 1);
  assert.equal(m.medidas.escritos, 1);
});

test('mapa en profundidad sigue el camino', async () => {
  const { eje, menu } = await ejemploCompra();
  const m = mapa(eje, menu.id, { camino: [1] });
  assert.deepEqual(m.celdas.slice(0, 3).map((c) => c.contenido), ['ensalada', 'guiso', 'fruta']);
  assert.equal(m.celdas[3].contenido, undefined);
  assert.deepEqual(m.camino, [1]);
});

test('render sobrio: tres filas, eje y medidas', async () => {
  const { eje, compra } = await ejemploCompra();
  const texto = render(mapa(eje, compra.id));
  const lineas = texto.split('\n');
  assert.equal(lineas.length, 5);
  assert.match(lineas[0], /^1 recursos\s+\[3\]\s+\| 8 comparabilidad\s+—\s+\| 2 criterios\s+\[1\]/);
  assert.match(lineas[1], /^6 pasado\s+—\s+\| 5 estructura\s+[0-9a-f]{8}\s+\| 7 futuro/);
  assert.match(lineas[3], /^eje: [0-9a-f]{8} ← [0-9a-f]{8} ← [0-9a-f]{8} ← \[[0-9a-f]{8}\] → $/);
  assert.match(lineas[4], /^medidas: hilo 3 · escritos 0/);
  assert.throws(() => render(mapa(eje, compra.id), 'animado'), /no disponible/);
});
