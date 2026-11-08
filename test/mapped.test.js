import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapa, render, MATRIZ, ocho, textoOcho } from '../src/mapped.js';
import { MEDIDAS, SIN_BASE_ESCRITA, leerBase, medir } from '../src/bases.js';
import { generarClaves } from '../src/autoridad.js';
import { COSAS, ejemploComprasHermanas, escribirBasesDelEjemplo } from '../ejemplos/ikisai/compras-hermanas.mjs';
import { ejemploCompra } from '../ejemplos/ikisai/compra-food.mjs';
import { direccion } from '../src/btml.js';
import { Eje } from '../src/eje.js';
import { contenido } from '../src/modos.js';

const gastaT = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });
const soloMedidas = (m) => Object.fromEntries(MEDIDAS.map(({ clave }) => [clave, m[clave]]));

test('la matriz es 1 8 2 / 6 5 7 / 3 9 4', () => {
  assert.deepEqual(MATRIZ, [[1, 8, 2], [6, 5, 7], [3, 9, 4]]);
});

test('mapa de la compra: celdas, eje y, si se piden, las medidas del 8', async () => {
  const { eje, compra, menu } = await ejemploCompra();
  const m = mapa(eje, compra.id, { medidas: true });
  assert.equal(m.celdas.length, 10);
  assert.equal(m.celdas[0].contenido, 'Compra del menú del día');
  assert.deepEqual(m.celdas[4].contenido, ['pagar', 'servir']);
  assert.equal(m.celdas[7].contenido, undefined);
  assert.deepEqual(m.hilo.map((e) => e.id)[0], menu.id);
  assert.equal(m.hilo.length, 3);
  assert.deepEqual(m.hijos, []);
  // La medida única del 8 (bases.medir), no unos recuentos propios de la vista (VG, 8-11).
  assert.deepEqual(m.medidas, { ...soloMedidas(medir(eje, compra.id)), tokens: { 'T:hora': 1, 'E:casa/EUR': 12 } });
  assert.equal(m.medidas.profundidadHilo, 3);
  assert.equal(m.medidas.movimientos, 2);
  assert.equal(m.medidas.identidades, 2);
  assert.equal(m.medidas.posiciones, 5);
  assert.equal(mapa(eje, compra.id).medidas, null); // sin la opción, no se mide
});

test('lo escrito en una posición cuenta en su celda y en el eje', async () => {
  const { eje, compra } = await ejemploCompra();
  await eje.escribir({ autor: 'huesped', sobre: compra.id, en: direccion([7]), t: '2026-11-07T14:00:00Z', movimientos: [gastaT('huesped')], payload: 'repetir el viernes' });
  const m = mapa(eje, compra.id, { medidas: true });
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
  // Menú 1 es una lista (solo hojas; VG, 7-11 noche: por hojas): sus celdas son ocupantes por llegada.
  assert.deepEqual(m.lista, ['ensalada', 'guiso', 'fruta']);
  assert.deepEqual(m.celdas.slice(0, 4).map((c) => c.significado), ['ocupante 1', 'ocupante 2', 'ocupante 3', 'con quién']);
});

test('render sobrio: tres filas, eje y medidas', async () => {
  const { eje, compra } = await ejemploCompra();
  const texto = render(mapa(eje, compra.id));
  const lineas = texto.split('\n');
  assert.equal(lineas.length, 5);
  // VG, 7-11 noche: por hojas. Compra 1 es una décupla de tres; compra 2, [ref], una lista de uno.
  assert.match(lineas[0], /^1 recursos\s+\[3\]\s+\| 8 comparabilidad\s+—\s+\| 2 criterios\s+\{1 en lista\}/);
  assert.match(lineas[1], /^6 pasado\s+—\s+\| 5 estructura\s+[0-9a-f]{8}\s+\| 7 futuro/);
  assert.match(lineas[3], /^eje: [0-9a-f]{8} ← [0-9a-f]{8} ← [0-9a-f]{8} ← \[[0-9a-f]{8}\] → $/);
  assert.equal(lineas[4], 'medidas del 8: bajo demanda (la celda 8, o mapa con { medidas: true })');
  assert.match(render(mapa(eje, compra.id, { medidas: true })).split('\n')[4], /^medidas del 8: hilo 3 · escritos 0 · movimientos 2 · identidades 2 · posiciones 5$/);
  assert.throws(() => render(mapa(eje, compra.id), 'animado'), /no disponible/);
});

// VG, 7-11 noche (10.1): lo leído se cuenta por lo que hay; antes, diez por décupla traída.
test('mapa: alcance con los tres números de Mapped; cuenta el contenido real del foco, su hilo y sus hijos', async () => {
  const { eje, compra } = await ejemploCompra();
  const m = mapa(eje, compra.id);
  const traidos = [eje.obtener(m.foco), ...m.hilo, ...m.hijos];
  assert.deepEqual(m.alcance, { conseguido: traidos.reduce((n, e) => n + contenido(e.payload), 0), minimo: 100, maximo: 1000, alMinimo: false }); // el ejemplo es pequeño: se dice, no es error
  assert.equal(m.alcance.conseguido, 19); // compra 9, menú 6, altas 3 y el génesis, un terminal, 1
  assert.equal(m.corte, null);
  assert.deepEqual(m.avisos, []);
  // Una cadena larga: el foco y diez de su hilo, de diez posiciones cada uno: 110, por encima del mínimo.
  const T0 = '2026-11-06T20:00:00Z';
  const larga = await Eje.genesis({ demostracion: true, identidad: 'raiz', emision: [{ token: 'T', escala: 'minuto', cantidad: 100 }], foco: 'g', t: T0 });
  let sobre = larga.genesisId;
  for (let i = 1; i <= 15; i++) sobre = (await larga.escribir({ autor: 'raiz', sobre, t: T0, movimientos: [gastaT('raiz')], payload: ['paso ' + i, ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']] })).id;
  assert.deepEqual(mapa(larga, sobre).alcance, { conseguido: 110, minimo: 100, maximo: 1000, alMinimo: true });
});

// VG, 7-11 noche (10.2): todos cortan duro, también Mapped, con el aviso de Scened.
test('mapa: corta duro en 1000 posiciones (el foco, el hilo y los hijos, por ese orden), con aviso; pedir más es un error', async () => {
  const T0 = '2026-11-06T20:00:00Z';
  const eje = await Eje.genesis({ demostracion: true, identidad: 'raiz', emision: [{ token: 'T', escala: 'minuto', cantidad: 100 }], foco: 'g', t: T0 });
  const lista = (n) => Array.from({ length: n }, (_, i) => 'o' + i);
  // El foco, 1 + 300 = 301, y su hilo, el génesis, 1; los hijos, 301 cada uno: entran dos (904) y el tercero pasaría (1205).
  const foco = await eje.escribir({ autor: 'raiz', sobre: eje.genesisId, t: T0, movimientos: [gastaT('raiz')], payload: ['foco', lista(300)] });
  const hijos = [];
  for (let i = 0; i < 4; i++) hijos.push(await eje.escribir({ autor: 'raiz', sobre: foco.id, t: T0, movimientos: [gastaT('raiz')], payload: ['hijo ' + i, lista(300)] }));
  const m = mapa(eje, foco.id);
  assert.deepEqual(m.hilo.map((e) => e.id), [eje.genesisId]); // el hilo entra antes que los hijos: el génesis, 1
  assert.deepEqual(m.hijos.map((e) => e.id), [hijos[0].id, hijos[1].id]); // los hijos por llegada, mientras caben
  assert.deepEqual(m.alcance, { conseguido: 301 + 1 + 301 + 301, minimo: 100, maximo: 1000, alMinimo: true });
  assert.deepEqual(m.corte, { maximo: 1000, conseguido: 904, necesario: 301 + 1 + 4 * 301, foco: 'entero', fuera: [hijos[2].id, hijos[3].id] });
  assert.match(m.avisos[0], /^Mapped corta en su máximo \(1000 posiciones\): entran el foco, su hilo y sus hijos, por ese orden, mientras caben; quedan fuera 2 registros: [0-9a-f]{8} [0-9a-f]{8}\. Trae 904 de 1506 posiciones\.$/);
  const lineas = render(m).split('\n');
  assert.equal(lineas[0], 'aviso: ' + m.avisos[0]); // arriba
  assert.equal(lineas.at(-1), 'aviso: ' + m.avisos[0]); // y abajo
  // Un foco que solo ya pasa del máximo entra recortado por índice, como en Pointed, y nada más.
  const enorme = await eje.escribir({ autor: 'raiz', sobre: eje.genesisId, t: T0, movimientos: [gastaT('raiz')], payload: ['enorme', lista(1200)] });
  const e = mapa(eje, enorme.id);
  assert.equal(e.alcance.conseguido, 1000);
  assert.deepEqual([e.hilo, e.hijos], [[], []]);
  assert.equal(e.celdas[1].contenido.length, 999);
  assert.equal(e.corte.foco, 'recortado');
  assert.match(e.avisos[0], /el foco solo ya pasa del máximo y entra recortado por índice; queda fuera 1 registro: [0-9a-f]{8}\. Trae 1000 de 1202 posiciones\.$/);
  assert.equal(eje.obtener(enorme.id).payload[1].length, 1200); // leer no muta el registro
  // Pedir más registros de hilo e hijos de los que caben nunca es posible: error, como en Scened.
  assert.equal(mapa(eje, foco.id, { maximo: 499 }).hijos.length, 2);
  for (const maximo of [500, Infinity]) assert.throws(() => mapa(eje, foco.id, { maximo }), /maximo inválido: .* el máximo de Mapped es duro; se puede pedir menos, nunca más/);
  for (const maximo of [-1, 1.5, '3']) assert.throws(() => mapa(eje, foco.id, { maximo }), /maximo inválido/);
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
  assert.match(textoOcho(antes), /^8 · hermanos · sin base escrita \(respaldo al vuelo\) · n 4\nE:[^\n]+: caja \d · \d debajo · \d en su caja · \d encima · cuota frente al padre [\d,]+ %\n/);
  assert.match(textoOcho(antes), /\nrecuentos \(información\): hilo \d+ · escritos \d+ · movimientos \d+ · posiciones \d+ · identidades \d+$/);
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
