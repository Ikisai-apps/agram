import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapa, render, MATRIZ, ocho, textoOcho } from '../src/mapped.js';
import { MEDIDAS, SIN_BASE_ESCRITA, leerBase } from '../src/bases.js';
import { generarClaves } from '../src/autoridad.js';
import { COSAS, ejemploComprasHermanas, escribirBasesDelEjemplo } from '../ejemplos/ikisai/compras-hermanas.mjs';
import { ejemploCompra } from '../ejemplos/ikisai/compra-food.mjs';
import { direccion } from '../src/btml.js';
import { Eje } from '../src/eje.js';

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

test('mapa: alcance con los tres números de Mapped; cuenta el foco, su hilo y sus hijos, diez por décupla (VG, 7-11 noche)', async () => {
  const { eje, compra } = await ejemploCompra();
  const m = mapa(eje, compra.id);
  const traidos = new Set([m.foco, ...m.hilo.map((e) => e.id), ...m.hijos.map((e) => e.id)]);
  assert.deepEqual(m.alcance, { conseguido: traidos.size * 10, minimo: 100, maximo: 1000, alMinimo: false }); // el ejemplo es pequeño: se dice, no es error
  // Una cadena larga: el foco y diez de su hilo, 110 posiciones, por encima del mínimo.
  const T0 = '2026-11-06T20:00:00Z';
  const larga = await Eje.genesis({ identidad: 'raiz', emision: [{ token: 'T', escala: 'minuto', cantidad: 100 }], foco: 'g', t: T0 });
  let sobre = larga.genesisId;
  for (let i = 1; i <= 15; i++) sobre = (await larga.escribir({ autor: 'raiz', sobre, t: T0, movimientos: [gastaT('raiz')], payload: 'paso ' + i })).id;
  assert.deepEqual(mapa(larga, sobre).alcance, { conseguido: 110, minimo: 100, maximo: 1000, alMinimo: true });
});

test('celda 8: ocho() lee la base escrita del 8; sin ella, el respaldo al vuelo lo dice; sin puesto ni puntuación', async () => {
  const claves = {};
  for (const id of ['casa', ...COSAS]) claves[id] = await generarClaves();
  const ej = await ejemploComprasHermanas({ claves });
  const { eje } = ej;
  // Sin base escrita: el respaldo, declarado.
  const antes = ocho(eje, ej.guisos.id);
  assert.deepEqual([antes.estado, antes.escrita, antes.base, antes.frescura, antes.n, antes.registro], ['RESUELTO', false, null, SIN_BASE_ESCRITA, 4, ej.menu.id]);
  assert.deepEqual(antes.medidas.map((m) => m.clave), MEDIDAS.map((m) => m.clave));
  assert.ok(antes.medidas.every((m) => m.debajo + m.enCaja + m.encima === 4 && !('posicion' in m) && !('puntuacion' in m)));
  assert.match(textoOcho(antes), /^8 · hermanos · sin base escrita \(respaldo al vuelo\) · n 4\nposiciones 5: caja 4 · /);
  // Con la base escrita: la lee, con su frescura.
  await escribirBasesDelEjemplo(ej);
  const despues = ocho(eje, ej.guisos.id);
  const base = leerBase(eje, ej.menu.id);
  assert.deepEqual([despues.escrita, despues.base, despues.frescura, despues.n], [true, base.id, base.frescura, 4]);
  assert.deepEqual(despues.medidas, antes.medidas); // la misma verdad: la escrita al día coincide con el cálculo al vuelo
  assert.ok(textoOcho(despues).startsWith('8 · hermanos · base ' + base.id.slice(0, 8) + ' (sin novedades) · n 4'));
  assert.equal(ocho(eje, ej.guisos.id, { alcance: 'general' }).n, 14);
  // El génesis no tiene hermanos.
  const g = ocho(eje, eje.genesisId);
  assert.deepEqual([g.estado, g.medidas], ['PENDIENTE', []]);
  assert.equal(textoOcho(g), '8 · hermanos · sin cohorte: el génesis no tiene padre');
});
