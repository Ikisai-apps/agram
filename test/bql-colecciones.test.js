import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejemploCompra, ejemploCuenta } from '../ejemplos/ikisai/compra-food.mjs';
import { consultar, evaluar } from '../src/bql.js';

const gastaT = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });
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
  // Una dirección nombra la colisión entera: la posición 4 (array) y la 4.0 ('pagar') ocupan la misma dirección.
  const r = consultar(eje, compra.id, [4], 'BUSCAR("4000000000")');
  assert.equal(r.estado, 'RESUELTO');
  assert.equal(r.valor.tipo, 'coleccion');
  assert.deepEqual(r.valor.items.map((i) => i.origen), ['propio', 'propio', 'escrito', 'escrito', 'escrito']);
  assert.deepEqual(r.valor.items.slice(2).map((i) => i.evento), [p1.id, p2.id, p3.id]);
  assert.equal(eje.orden.length, antes);
  assert.equal(consultar(eje, compra.id, [4], 'CONTAR(BUSCAR("4000000000"))').texto, '5');
  // Un índice es camino exacto (mapa §12 [D]): 4 es la posición 4 y los escritos anclados en ella; 4, 0 es solo la 4.0.
  const exacto = consultar(eje, compra.id, [4], 'BUSCAR(4)').valor.items;
  assert.deepEqual(exacto.map((i) => [i.origen, i.indices]), [['propio', [4]], ['escrito', []], ['escrito', []], ['escrito', []]]);
  assert.deepEqual(consultar(eje, compra.id, [4], 'BUSCAR(4, 0)').valor.items.map((i) => [i.origen, i.indices]), [['propio', [4, 0]]]);
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
  assert.equal(r.estado, 'INCOMPATIBLE'); // el propio es un array y no se compara con 1 EUR
  // ORIGEN() distingue la procedencia del candidato; un terminal no tiene posición 0.
  const sinPropio = consultar(eje, compra.id, [4], 'CONTAR(FILTRAR(BUSCAR(4), ORIGEN() = "escrito"))');
  assert.equal(sinPropio.texto, '3');
  assert.equal(consultar(eje, compra.id, [4], 'CONTAR(FILTRAR(BUSCAR(4), ORIGEN() = "propio"))').texto, '1'); // camino exacto: la 4.0 no
  const grandes = consultar(eje, compra.id, [4], 'CONTAR(FILTRAR(FILTRAR(BUSCAR(4), ORIGEN() = "escrito"), ACTUAL() > 1 EUR))');
  assert.equal(grandes.texto, '2');
  assert.equal(consultar(eje, compra.id, [4], 'CONTAR(FILTRAR(BUSCAR(4), ACTUAL(0) = "pagar"))').estado, 'PENDIENTE');
  assert.equal(consultar(eje, compra.id, [4], 'ORIGEN()').estado, 'ERROR');
  // LOCAL dentro de FILTRAR lee el anfitrión (la compra), no el candidato.
  const local = consultar(eje, compra.id, [4], 'CONTAR(FILTRAR(BUSCAR(4), LOCAL(0) = "Compra del menú del día"))');
  assert.equal(local.texto, '4');
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
  assert.equal(uno.valor.tipo, 'array'); // el primer candidato es lo propio: ['pagar', 'servir']
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
