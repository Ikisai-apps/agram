import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejemploCompra, ejemploCuenta } from '../ejemplos/ikisai/compra-food.mjs';
import { consultar, evaluar } from '../src/bql.js';
import { pagaElCoste } from './ayudas-coste.js';

const gastaT = (de) => pagaElCoste(de);
const T = '2026-11-07T15:00:00Z';

async function escenario() {
  const { eje, compra, menu } = await ejemploCompra();
  const cuenta = await ejemploCuenta(eje, compra);
  // Tres propinas escritas en la fábrica (posición 4) de la compra por las dos identidades que la compra nombra en
  // su 3 (huesped y cocina): son elegibles (R8, src/elegibles.js). Una de la casa, que no está en el 3, no lo es.
  const p1 = await eje.escribir({ autor: 'huesped', sobre: compra.id, en: '4000000000', t: T, movimientos: [gastaT('huesped')], payload: '2 EUR' });
  const p2 = await eje.escribir({ autor: 'cocina', sobre: compra.id, en: '4000000000', t: T, movimientos: [gastaT('cocina')], payload: '5 EUR' });
  const p3 = await eje.escribir({ autor: 'huesped', sobre: compra.id, en: '4000000000', t: T, movimientos: [gastaT('huesped')], payload: '1 EUR' });
  return { eje, compra, menu, cuenta, p1, p2, p3 };
}

test('BUSCAR devuelve los candidatos de la posición sin registrar nada', async () => {
  const { eje, compra, p1, p2, p3 } = await escenario();
  const antes = eje.orden.length;
  // Una dirección nombra la colisión entera. VG, 7-11 noche: por hojas: la 4 es la lista ['pagar', 'servir'],
  // dos ocupantes propios (la dirección no entra en ella: no hay 4.0 aparte), y detrás los tres escritos.
  const r = consultar(eje, compra.id, [4], 'BUSCAR("4000000000")');
  assert.equal(r.estado, 'RESUELTO');
  assert.equal(r.valor.tipo, 'coleccion');
  assert.deepEqual(r.valor.items.map((i) => i.origen), ['propio', 'propio', 'escrito', 'escrito', 'escrito']);
  assert.deepEqual(r.valor.items.slice(2).map((i) => i.evento), [p1.id, p2.id, p3.id]);
  assert.equal(eje.orden.length, antes);
  assert.equal(consultar(eje, compra.id, [4], 'CONTAR(BUSCAR("4000000000"))').texto, '5');
  // Un índice es camino exacto (mapa §12 [D]): 4 es la posición 4 y los escritos anclados en ella.
  const exacto = consultar(eje, compra.id, [4], 'BUSCAR(4)').valor.items;
  // VG, 7-11 noche: por hojas: cada elemento de la lista es un candidato aparte, con su lugar en ella.
  assert.deepEqual(exacto.map((i) => [i.origen, i.indices, i.lista]), [['propio', [4], 0], ['propio', [4], 1], ['escrito', [], undefined], ['escrito', [], undefined], ['escrito', [], undefined]]);
  // BUSCAR(4, k) es el ocupante k de la lista de la 4, por llegada: 'pagar', 'servir' y luego los escritos.
  assert.deepEqual(consultar(eje, compra.id, [4], 'BUSCAR(4, 0)').valor.items.map((i) => [i.origen, i.indices, i.lista]), [['propio', [4], 0]]);
  assert.deepEqual(consultar(eje, compra.id, [4], 'BUSCAR(4, 1)').valor.items.map((i) => [i.origen, i.lista]), [['propio', 1]]);
  assert.deepEqual(consultar(eje, compra.id, [4], 'BUSCAR(4, 2)').valor.items.map((i) => i.evento), [p1.id]);
  assert.deepEqual(consultar(eje, compra.id, [4], 'BUSCAR(4, 4)').valor.items.map((i) => i.evento), [p3.id]);
  assert.equal(consultar(eje, compra.id, [4], 'BUSCAR(4, 5)').texto, '0 candidatos');
  assert.equal(consultar(eje, compra.id, [4], 'BUSCAR(4, 9)').texto, '0 candidatos');
  assert.equal(consultar(eje, compra.id, [4], 'LOCAL(4, 0)').texto, 'pagar'); // por índice, LOCAL sí entra en la lista
  assert.equal(consultar(eje, compra.id, [4], 'LOCAL(4, 1)').texto, 'servir');
  assert.equal(consultar(eje, compra.id, [4], 'BUSCAR(7)').texto, '0 candidatos');
  // R8: la casa no está en el 3 de la compra; su propina colisiona (queda en el eje) pero no es elegible, y solo se cuenta aparte.
  await eje.escribir({ autor: 'casa', sobre: compra.id, en: '4000000000', t: T, movimientos: [gastaT('casa')], payload: '9 EUR' });
  const conCasa = consultar(eje, compra.id, [4], 'BUSCAR("4000000000")');
  assert.deepEqual([conCasa.valor.items.length, conCasa.valor.noElegibles], [5, 1]);
  assert.match(conCasa.texto, /\(y 1 no elegibles, sin contar\)$/);
  assert.equal(consultar(eje, compra.id, [4], 'CONTAR(BUSCAR("4000000000"))').texto, '5');
});

test('FILTRAR con ACTUAL como candidato; LOCAL sigue siendo el anfitrión', async () => {
  const { eje, compra } = await escenario();
  // Solo los escritos (cuyo valor es una magnitud en EUR) mayores de 1 EUR.
  const r = consultar(eje, compra.id, [4], 'FILTRAR(FILTRAR(BUSCAR(4), ACTUAL() = ACTUAL()), ACTUAL() > 1 EUR)');
  assert.equal(r.estado, 'INCOMPATIBLE'); // el propio 'pagar' es un texto y no se compara con 1 EUR
  // ORIGEN() distingue la procedencia del candidato; un terminal no tiene posición 0.
  const sinPropio = consultar(eje, compra.id, [4], 'CONTAR(FILTRAR(BUSCAR(4), ORIGEN() = "escrito"))');
  assert.equal(sinPropio.texto, '3');
  // VG, 7-11 noche: por hojas: los dos elementos de la lista ['pagar', 'servir'] son dos propios.
  assert.equal(consultar(eje, compra.id, [4], 'CONTAR(FILTRAR(BUSCAR(4), ORIGEN() = "propio"))').texto, '2');
  const grandes = consultar(eje, compra.id, [4], 'CONTAR(FILTRAR(FILTRAR(BUSCAR(4), ORIGEN() = "escrito"), ACTUAL() > 1 EUR))');
  assert.equal(grandes.texto, '2');
  assert.equal(consultar(eje, compra.id, [4], 'CONTAR(FILTRAR(BUSCAR(4), ACTUAL(0) = "pagar"))').estado, 'PENDIENTE');
  assert.equal(consultar(eje, compra.id, [4], 'ORIGEN()').estado, 'ERROR');
  // LOCAL dentro de FILTRAR lee el anfitrión (la compra), no el candidato.
  const local = consultar(eje, compra.id, [4], 'CONTAR(FILTRAR(BUSCAR(4), LOCAL(0) = "Compra del menú del día"))');
  assert.equal(local.texto, '5');
});

test('ORDENAR, ELEGIR y SUMAR sobre las propinas', async () => {
  const { eje, compra, p2 } = await escenario();
  const propinas = 'FILTRAR(BUSCAR(4), ORIGEN() = "escrito")';
  const suma = consultar(eje, compra.id, [4], 'SUMAR(' + propinas + ')');
  assert.equal(suma.texto, '8 EUR (2 EUR + 5 EUR + 1 EUR)');
  const mayor = consultar(eje, compra.id, [4], 'ELEGIR(ORDENAR(' + propinas + ', ACTUAL(), "desc"))');
  assert.equal(mayor.valor.items.length, 1);
  assert.equal(mayor.valor.items[0].evento, p2.id);
  const menor = consultar(eje, compra.id, [4], 'ELEGIR(ORDENAR(' + propinas + ', ACTUAL()), 2)');
  assert.deepEqual(menor.valor.items.map((i) => i.evento).length, 2);
});

test('ACTUAL fuera de FILTRAR: la colección activa de una posición, limitada', async () => {
  const { eje, compra } = await escenario();
  const uno = consultar(eje, compra.id, [8], 'ACTUAL(4)');
  // VG, 7-11 noche: por hojas: el primer candidato es el primer elemento propio de la lista, 'pagar'.
  assert.equal(uno.valor.tipo, 'texto');
  assert.equal(uno.texto, 'pagar');
  const dos = consultar(eje, compra.id, [8], 'ACTUAL(4, 2)');
  assert.equal(dos.valor.items.length, 2);
  assert.equal(consultar(eje, compra.id, [8], 'ACTUAL(7)').estado, 'PENDIENTE');
});

test('comparaciones y lógica', async () => {
  const { eje, compra } = await escenario();
  const c = (f) => consultar(eje, compra.id, [8], f).texto;
  assert.equal(c('1 < 2'), 'verdadero');
  assert.equal(c('2 EUR >= 3 EUR'), 'falso');
  assert.equal(c('"a" <> "b"'), 'verdadero');
  assert.equal(c('Y(1 < 2, 2 < 3)'), 'verdadero');
  assert.equal(c('O(1 > 2, NO(2 > 3))'), 'verdadero');
  assert.equal(consultar(eje, compra.id, [8], '1 < "a"').estado, 'INCOMPATIBLE');
});

test('una fórmula en slot puede usar colecciones y se evalúa desde el frontend', async () => {
  const { eje, compra } = await escenario();
  const total = await eje.escribir({ autor: 'cocina', sobre: compra.id, en: '8000000000', t: T, movimientos: [gastaT('cocina')],
    payload: ['Propinas', '=SUMAR(FILTRAR(REFBUSCAR(), NO(ACTUAL(0) = "pagar")))'] });
  // REFBUSCAR no existe: ERROR claro. La fórmula correcta busca en el anfitrión, que es el propio registro de propinas.
  assert.equal(evaluar(eje, total.id, [1]).estado, 'ERROR');
  const total2 = await eje.escribir({ autor: 'cocina', sobre: compra.id, en: '8000000000', t: T, movimientos: [gastaT('cocina')],
    payload: ['Propinas', '=CONTAR(BUSCAR(1))'] });
  assert.equal(evaluar(eje, total2.id, [1]).texto, '1'); // la propia fórmula ocupa la posición 1
});

test('décupla y lista por hojas: BUSCAR despliega la lista, el índice entra en ella y la dirección no', async () => {
  // VG, 7-11 noche: por hojas. La 1 del menú es la lista ['ensalada', 'guiso', 'fruta']; la 1 de la compra,
  // la décupla [[ref menú:1], [1], ['EUR 12']] (cada posición entre corchetes).
  const { eje, compra, menu } = await escenario();
  const e1 = await eje.escribir({ autor: 'cocina', sobre: menu.id, en: '1000000000', t: T, movimientos: [gastaT('cocina')], payload: 'pan' });
  // Los dos de cocina, la dueña del menú: un escrito de la casa no sería elegible (R8, src/elegibles.js).
  const e2 = await eje.escribir({ autor: 'cocina', sobre: menu.id, en: '1000000000', t: T, movimientos: [gastaT('cocina')], payload: 'agua' });
  const q = (f) => consultar(eje, menu.id, [8], f);
  // BUSCAR(1): un candidato por elemento de la lista, en su orden, y detrás los escritos.
  const todos = q('BUSCAR(1)').valor.items;
  assert.deepEqual(todos.map((i) => [i.origen, i.lista]), [['propio', 0], ['propio', 1], ['propio', 2], ['escrito', undefined], ['escrito', undefined]]);
  assert.deepEqual(todos.slice(3).map((i) => i.evento), [e1.id, e2.id]);
  assert.equal(q('CONTAR(BUSCAR(1))').texto, '5');
  assert.equal(q('ACTUAL(1)').texto, 'ensalada');
  // BUSCAR(1, k): el k-ésimo por llegada, desde 0; los escritos van detrás de la lista; fuera de rango, vacío.
  assert.deepEqual(q('BUSCAR(1, 0)').valor.items.map((i) => i.lista), [0]);
  assert.deepEqual(q('BUSCAR(1, 2)').valor.items.map((i) => i.lista), [2]);
  assert.deepEqual(q('BUSCAR(1, 3)').valor.items.map((i) => i.evento), [e1.id]);
  assert.deepEqual(q('BUSCAR(1, 4)').valor.items.map((i) => i.evento), [e2.id]);
  assert.equal(q('BUSCAR(1, 5)').texto, '0 candidatos');
  assert.equal(q('CONTAR(FILTRAR(BUSCAR(1, 1), ACTUAL() = "guiso"))').texto, '1');
  // LOCAL por índice sí entra en la lista; leer la posición de la lista da la lista entera.
  assert.equal(q('LOCAL(1, 2)').texto, 'fruta');
  assert.equal(q('LOCAL(1)').valor.tipo, 'lista');
  assert.equal(q('LOCAL(1)').texto, 'ensalada · guiso · fruta');
  // REF por dirección nombra subposiciones de la décupla: la 1.2 de la compra es su precio.
  const c8 = compra.id.slice(0, 8);
  const m8 = menu.id.slice(0, 8);
  assert.equal(q('REF("' + c8 + '", "1200000000")').texto, '12 EUR');
  assert.equal(q('REF("' + c8 + '", "1100000000")').texto, '1');
  assert.equal(q('REF("' + c8 + '", "1000000000")').texto, '[3 posiciones]'); // ceros finales: la 1 entera, una décupla
  // Una dirección dentro de una lista no existe: PENDIENTE, con el motivo.
  const dentro = q('REF("' + m8 + '", "1200000000")');
  assert.equal(dentro.estado, 'PENDIENTE');
  assert.match(dentro.motivo, /^posición sin desarrollar: 1200000000 cae dentro de la lista de la 1;/);
  const laLista = q('REF("' + m8 + '", "1000000000")'); // la dirección de la lista: la lista entera
  assert.deepEqual([laLista.valor.tipo, laLista.texto], ['lista', 'ensalada · guiso · fruta']);
});
