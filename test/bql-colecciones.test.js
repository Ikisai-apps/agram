import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejemploCompra, ejemploCuenta } from '../ejemplos/ikisai/compra-food.mjs';
import { consultar, evaluar } from '../src/bql.js';

const gastaT = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });
const T = '2026-11-07T15:00:00Z';

async function escenario() {
  const { eje, compra, menu } = await ejemploCompra();
  const cuenta = await ejemploCuenta(eje, compra);
  // Tres propinas escritas en la fábrica (posición 4) de la compra, por distintas identidades.
  const p1 = await eje.escribir({ autor: 'huesped', sobre: compra.id, en: '4000000000', t: T, movimientos: [gastaT('huesped')], payload: '2 EUR' });
  const p2 = await eje.escribir({ autor: 'casa', sobre: compra.id, en: '4000000000', t: T, movimientos: [gastaT('casa')], payload: '5 EUR' });
  const p3 = await eje.escribir({ autor: 'cocina', sobre: compra.id, en: '4000000000', t: T, movimientos: [gastaT('cocina')], payload: '1 EUR' });
  return { eje, compra, menu, cuenta, p1, p2, p3 };
}

test('BUSCAR devuelve los candidatos de la posición sin registrar nada', async () => {
  const { eje, compra, p1, p2, p3 } = await escenario();
  const antes = eje.orden.length;
  const r = consultar(eje, compra.id, [4], 'BUSCAR(4)');
  assert.equal(r.estado, 'RESUELTO');
  assert.equal(r.valor.tipo, 'coleccion');
  assert.deepEqual(r.valor.items.map((i) => i.origen), ['propio', 'escrito', 'escrito', 'escrito']);
  assert.deepEqual(r.valor.items.slice(1).map((i) => i.evento), [p1.id, p2.id, p3.id]);
  assert.equal(eje.orden.length, antes);
  assert.equal(consultar(eje, compra.id, [4], 'CONTAR(BUSCAR(4))').texto, '4');
  assert.equal(consultar(eje, compra.id, [4], 'BUSCAR(7)').texto, '0 candidatos');
});

test('FILTRAR con ACTUAL como candidato; LOCAL sigue siendo el anfitrión', async () => {
  const { eje, compra } = await escenario();
  // Solo los escritos (cuyo valor es una magnitud en EUR) mayores de 1 EUR.
  const r = consultar(eje, compra.id, [4], 'FILTRAR(FILTRAR(BUSCAR(4), ACTUAL() = ACTUAL()), ACTUAL() > 1 EUR)');
  assert.equal(r.estado, 'INCOMPATIBLE'); // el propio es un array y no se compara con 1 EUR
  const r2 = consultar(eje, compra.id, [4], 'CONTAR(FILTRAR(ELEGIR(ORDENAR(BUSCAR(4), ACTUAL(0) = "pagar"), ACTUAL(0) = "pagar", "desc"), 3), NO(ACTUAL(0) = "pagar")))');
  void r2;
  // Camino claro: la posición 0 de los candidatos escritos es su representación (el propio texto).
  const sinPropio = consultar(eje, compra.id, [4], 'CONTAR(FILTRAR(BUSCAR(4), NO(ACTUAL(0) = "pagar")))');
  assert.equal(sinPropio.texto, '3');
  const grandes = consultar(eje, compra.id, [4], 'CONTAR(FILTRAR(FILTRAR(BUSCAR(4), NO(ACTUAL(0) = "pagar")), ACTUAL() > 1 EUR))');
  assert.equal(grandes.texto, '2');
  // LOCAL dentro de FILTRAR lee el anfitrión (la compra), no el candidato.
  const local = consultar(eje, compra.id, [4], 'CONTAR(FILTRAR(BUSCAR(4), LOCAL(0) = "Compra del menú del día"))');
  assert.equal(local.texto, '4');
});

test('ORDENAR, ELEGIR y SUMAR sobre las propinas', async () => {
  const { eje, compra, p2 } = await escenario();
  const propinas = 'FILTRAR(BUSCAR(4), NO(ACTUAL(0) = "pagar"))';
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
