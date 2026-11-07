import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejemploCompra, ejemploCuenta } from '../ejemplos/ikisai/compra-food.mjs';
import { vector, acuerdo, norma, sentido, ordenarPorEncaje, ocupantes } from '../src/encaje.js';
import { consultar } from '../src/bql.js';
import { consolidar, descubrir } from '../src/motor.js';

const gastaT = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });
const T = '2026-11-07T16:00:00Z';

test('vector: destino menos origen, dígito a dígito; acuerdo, norma y sentido', () => {
  assert.deepEqual(vector('1000000000', '1000000000'), [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(vector('0000000000', '4000000000'), [4, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(vector('7000000000', '2000000000'), [-5, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(vector('1230000000', '1200000000'), [0, 0, -3, 0, 0, 0, 0, 0, 0, 0]);
  const exacto = vector('1000000000', '1000000000');
  assert.equal(acuerdo(exacto), 10);
  assert.equal(sentido(exacto), 'exacto');
  const lectura = vector('6000000000', '1000000000');
  assert.equal(sentido(lectura), 'lectura'); // de la cruz a la X
  assert.equal(norma(lectura), 5);
  const escritura = vector('0000000000', '4000000000');
  assert.equal(sentido(escritura), 'escritura'); // de la X a la cruz
  assert.equal(acuerdo(vector('1230000000', '1200000000')), 2);
  assert.throws(() => vector('12', '1200000000'), TypeError);
});

test('ordenar por encaje: exactos, luego acuerdo, luego desplazamiento; empates por llegada', () => {
  const lista = [
    { nombre: 'ref desde 7', vector: vector('7000000000', '2000000000') },
    { nombre: 'escrito en 2', vector: vector('0000000000', '2000000000') },
    { nombre: 'exacto', vector: vector('2000000000', '2000000000') },
    { nombre: 'desvío hondo', vector: vector('2300000000', '2000000000') },
    { nombre: 'otro escrito', vector: vector('0000000000', '2000000000') },
  ];
  assert.deepEqual(ordenarPorEncaje(lista).map((x) => x.nombre), ['exacto', 'desvío hondo', 'escrito en 2', 'otro escrito', 'ref desde 7']);
});

test('los ocupantes llevan su vector y salen por encaje; la llegada sigue disponible', async () => {
  const { eje, compra } = await ejemploCompra();
  // Un registro cuya posición 2 es una referencia a la posición 7 de otro (viene leyendo),
  // y un hijo escrito en su posición 2 (viene escribiendo).
  const plan = await eje.escribir({ autor: 'casa', sobre: compra.id, t: T, movimientos: [gastaT('casa')], payload: ['Plan', 'a', 'b', 'c', 'd', 'e', 'f', 'cena el sábado'] });
  const x = await eje.escribir({ autor: 'casa', sobre: compra.id, t: T, movimientos: [gastaT('casa')], payload: ['X', 'r', { ref: plan.id, dir: '7000000000' }] });
  const hijo = await eje.escribir({ autor: 'casa', sobre: x.id, en: '2000000000', t: T, movimientos: [gastaT('casa')], payload: 'criterio escrito' });
  const llegada = ocupantes(eje, x.id, [2], { orden: 'llegada' });
  assert.deepEqual(llegada.map((o) => o.origen), ['propio', 'referencia', 'escrito']);
  assert.deepEqual(llegada.map((o) => o.sentido), ['exacto', 'lectura', 'escritura']);
  assert.deepEqual(llegada[1].vector.slice(0, 1), [-5]);
  assert.deepEqual(llegada[2].vector.slice(0, 1), [2]);
  const encaje = ocupantes(eje, x.id, [2]);
  assert.deepEqual(encaje.map((o) => o.origen), ['propio', 'escrito', 'referencia']); // menor desplazamiento antes
  assert.equal(encaje[1].evento, hijo.id);
  // Las colisiones por ceros son encajes exactos entre sí.
  const oc = ocupantes(eje, compra.id, [1]);
  assert.ok(oc.filter((o) => o.origen === 'propio').every((o) => o.sentido === 'exacto'));
});

test('BQL: BUSCAR sale por encaje y SENTIDO/ACUERDO/DESPLAZAMIENTO son consultables', async () => {
  const { eje, compra } = await ejemploCompra();
  await ejemploCuenta(eje, compra);
  const c = (f) => consultar(eje, compra.id, [1], f);
  assert.equal(c('CONTAR(FILTRAR(BUSCAR(1), SENTIDO() = "exacto"))').texto, '3'); // [1], [1.0] y la referencia al menú:1
  assert.equal(c('CONTAR(FILTRAR(BUSCAR(1), SENTIDO() = "escritura"))').texto, '1'); // la cuenta, escrita en 1
  assert.equal(c('CONTAR(FILTRAR(BUSCAR(1), DESPLAZAMIENTO() > 0))').texto, '1');
  assert.equal(c('CONTAR(FILTRAR(BUSCAR(1), ACUERDO() = 10))').texto, '3');
  assert.equal(c('SENTIDO()').estado, 'ERROR');
});

test('la consolidación guarda el encaje de cada fuente elegida', async () => {
  const { eje, compra } = await ejemploCompra();
  const cuenta = await ejemploCuenta(eje, compra);
  const d = descubrir(eje, compra.id);
  const candidatoCuenta = d[0].candidatos.find((x) => x.evento === cuenta.id);
  const cons = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: T, elecciones: { 1: { candidato: candidatoCuenta }, 4: 'pagar' } });
  const e = cons.contexto.encaje;
  assert.equal(e.length, 1);
  assert.equal(e[0].posicion, 1);
  assert.equal(e[0].evento, cuenta.id);
  assert.equal(e[0].sentido, 'escritura');
  assert.deepEqual(e[0].vector.slice(0, 2), [1, 0]);
  assert.deepEqual(cons.contexto.fuentes, [cuenta.id]);
});
