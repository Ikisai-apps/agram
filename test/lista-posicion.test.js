// La lista de una posición son colisiones fuera del árbol (VG, 7-11 noche,
// mapa §12 [D]): un array dentro de una posición son sus ocupantes por
// llegada, no dígitos con PV; los PV de un elemento solo existen cuando se
// escribe en una subposición por dirección (`en`). Datos inventados.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ejemploCompra, ejemploCuenta } from '../ejemplos/ikisai/compra-food.mjs';
import { lista, ocupantes } from '../src/encaje.js';
import { EPOCA_0, PV, cargarEpoca, leerDireccion, leerCamino, nombreEnNodo } from '../src/epocas.js';
import { consultar } from '../src/bql.js';
import { decupla } from '../src/pointed.js';
import { mapa } from '../src/mapped.js';
import { ARIDAD } from '../src/btml.js';

const gasta = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });

async function compraConCuenta() {
  const base = await ejemploCompra();
  const cuenta = await ejemploCuenta(base.eje, base.compra);
  return { ...base, cuenta };
}

const escribe = (eje, sobre, en, payload, t = '2026-11-07T15:00:00Z') => eje.escribir({ autor: 'huesped', sobre, en, t, movimientos: [gasta('huesped')], payload });

// ---------- núcleo: la lista de la posición ----------

test('lista: un array en una posición son sus ocupantes por llegada (el orden del array y luego los escritos)', async () => {
  const { eje, compra, menu, cuenta } = await compraConCuenta();
  const l = lista(eje, compra.id, [1]);
  assert.deepEqual(l.map((o) => o.llegada), [0, 1, 2, 3]);
  assert.deepEqual(l.map((o) => o.tipo), ['propio', 'propio', 'propio', 'escrito']);
  assert.deepEqual(l.map((o) => o.camino), [[1, 0], [1, 1], [1, 2], []]);
  assert.deepEqual(l.slice(0, 3).map((o) => o.contenido), compra.payload[1]); // el elemento entero, sin tocar
  assert.equal(l[3].evento, cuenta.id); // la cuenta, anclada en 1, llega después del payload
  assert.equal(l[3].autor, 'cocina');
  // Una referencia de la lista dice lo que alcanza, con su procedencia; no se copia.
  assert.equal(l[0].alcanza.evento, menu.id);
  assert.deepEqual(l[0].alcanza.contenido, menu.payload[1]);
  // Lo escrito después llega después.
  const nota = await escribe(eje, compra.id, '1000000000', 'otra ronda');
  assert.deepEqual(lista(eje, compra.id, [1]).map((o) => o.evento).slice(3), [cuenta.id, nota.id]);
});

test('lista: un terminal en la posición es un solo ocupante; la raíz es la cruceta, no una lista', async () => {
  const { eje, compra } = await compraConCuenta();
  const l0 = lista(eje, compra.id, [0]);
  assert.deepEqual(l0.map((o) => [o.tipo, o.camino, o.contenido]), [['propio', [0], 'Compra del menú del día']]);
  assert.deepEqual(lista(eje, compra.id, [7]), []);
  const raiz = await escribe(eje, compra.id, '0000000000', 'suelta en la raíz');
  assert.deepEqual(lista(eje, compra.id, []).map((o) => [o.tipo, o.evento]), [['escrito', raiz.id]]);
});

test('lista: una subposición por dirección solo tiene sus escritos; el índice del array no es la subposición', async () => {
  const { eje, compra } = await compraConCuenta();
  // compra 1.2 del payload es el ocupante 3 de la posición 1, no la subposición 1.2.
  assert.deepEqual(lista(eje, compra.id, [1, 2]), []);
  const precio = await escribe(eje, compra.id, '1200000000', 'precio de carta');
  assert.deepEqual(lista(eje, compra.id, [1, 2]).map((o) => [o.llegada, o.tipo, o.evento]), [[0, 'escrito', precio.id]]);
  // El encaje de la dirección sigue viendo la colisión entera: el camino del payload y el escrito.
  assert.deepEqual(ocupantes(eje, compra.id, [1, 2], { orden: 'llegada' }).map((o) => o.tipo), ['propio', 'escrito']);
});

test('lista: es de n; el límite de diez es por evento, no por posición', async () => {
  const { eje, compra } = await compraConCuenta();
  for (let k = 0; k < 11; k++) await escribe(eje, compra.id, '3000000000', 'mensaje ' + k, '2026-11-07T15:' + String(10 + k) + ':00Z');
  const l = lista(eje, compra.id, [3]);
  assert.equal(l.length, 2 + 11); // huesped y cocina del payload, y once escritos
  assert.ok(l.length > ARIDAD);
  assert.deepEqual(l.map((o) => o.llegada), [...Array(13).keys()]);
  assert.equal(l.at(-1).contenido, 'mensaje 10');
});

// ---------- núcleo: el índice de un ocupante no lleva regla corta ----------

test('leerDireccion con el payload: el índice de un array dentro de una posición es un ocupante, sin regla corta', async () => {
  const { compra } = await compraConCuenta();
  // Sin payload, la dirección se lee como subposiciones escritas por dirección: la regla corta sigue.
  assert.deepEqual(leerDireccion('1200000000').map((x) => x.significado), ['recursos', 'con qué condición']);
  const conPayload = leerDireccion('1200000000', EPOCA_0, { payload: compra.payload });
  assert.deepEqual(conPayload.map((x) => x.significado), ['recursos', 'ocupante 3 de la posición 1']);
  assert.equal(conPayload[1].ocupante, 2); // la llegada
  assert.equal(conPayload[1].posicion, '1');
  // Donde la lista no llega, la subposición por dirección conserva su regla corta.
  assert.deepEqual(leerDireccion('1500000000', 'época 0', { payload: compra.payload }).map((x) => x.significado), ['recursos', 'dónde encaja']);
  // La profundidad 0 es siempre la cruceta.
  assert.deepEqual(leerDireccion('3000000000', EPOCA_0, { payload: compra.payload }).map((x) => x.significado), [PV[3]]);
});

test('leerCamino: un 0 final cuenta (ocupante 1) y las listas anidadas se nombran por su llegada', () => {
  const payload = ['Pedido', [['pan', 'aceite'], 'sal'], 'nota'];
  assert.deepEqual(leerCamino([1, 0], EPOCA_0, { payload }).map((x) => x.significado), ['recursos', 'ocupante 1 de la posición 1']);
  assert.deepEqual(leerCamino([1, 0, 1], EPOCA_0, { payload }).map((x) => x.significado),
    ['recursos', 'ocupante 1 de la posición 1', 'ocupante 2 del ocupante 1 de la posición 1']);
  // Bajo un ocupante terminal, lo que siga es por dirección: regla corta de su profundidad.
  assert.deepEqual(leerCamino([1, 1, 4], EPOCA_0, { payload }).map((x) => x.significado), ['recursos', 'ocupante 2 de la posición 1', 'qué se hace']);
  // Un terminal en la posición no es una lista.
  assert.deepEqual(leerCamino([2, 1], EPOCA_0, { payload }).map((x) => x.significado), ['criterios', 'cuánto']);
  assert.throws(() => leerCamino([1, 10]), TypeError);
});

test('una regla larga no se aplica al índice de un ocupante, sí a la subposición por dirección', () => {
  const e = cargarEpoca({ nombre: 'con larga', reglas: [{ ruta: '12', nombre: 'precio pactado' }] }, { respaldo: EPOCA_0 });
  const payload = ['Compra', ['menú', 1, 'EUR 12']];
  assert.equal(leerDireccion('1200000000', e)[1].significado, 'precio pactado');
  assert.equal(leerDireccion('1200000000', e, { payload })[1].significado, 'ocupante 3 de la posición 1');
  assert.equal(leerDireccion('1200000000', e, { payload })[1].larga, undefined);
});

test('nombreEnNodo, décupla y mapa: la lista se nombra por llegada; lo que no ocupa, por la regla corta', async () => {
  const { eje, compra } = await compraConCuenta();
  assert.deepEqual(nombreEnNodo(['a', 'b'], 1, 1), { ocupante: 1, significado: 'ocupante 2' });
  assert.deepEqual(nombreEnNodo(['a', 'b'], 1, 2), { significado: 'con qué condición' });
  assert.deepEqual(nombreEnNodo(['a', 'b'], 0, 1), { significado: PV[1] }); // la raíz es la cruceta
  const d = decupla({ ...compra, payload: compra.payload[1] }, EPOCA_0, 1);
  assert.deepEqual(d.posiciones.slice(0, 4).map((p) => [p.significado, p.ocupante]), [['ocupante 1', 0], ['ocupante 2', 1], ['ocupante 3', 2], ['con quién', undefined]]);
  const m = mapa(eje, compra.id, { camino: [4] });
  assert.deepEqual(m.celdas.slice(0, 3).map((c) => c.significado), ['ocupante 1', 'ocupante 2', 'con qué condición']);
});

// ---------- BUSCAR por índice ----------

test('BUSCAR por índice sigue devolviendo el ocupante de esa llegada; BUSCAR de la posición, por llegada', async () => {
  const { eje, compra, cuenta } = await compraConCuenta();
  const l = lista(eje, compra.id, [1]);
  for (let k = 0; k < 3; k++) {
    const items = consultar(eje, compra.id, [0], 'BUSCAR(1, ' + k + ')').valor.items;
    assert.deepEqual([items[0].origen, items[0].evento, items[0].indices], ['propio', compra.id, l[k].camino]); // índice = camino exacto = el ocupante k por llegada
    // El ocupante 1 es una referencia: detrás va lo que alcanza (el 1 del menú), como en lista().alcanza.
    assert.deepEqual(items.slice(1).map((i) => [i.origen, i.evento]), k === 0 ? [['referencia', l[0].alcanza.evento]] : []);
  }
  // BUSCAR(1): lo propio de la posición y luego el escrito, en orden de llegada.
  const todos = consultar(eje, compra.id, [0], 'BUSCAR(1)').valor.items;
  assert.deepEqual(todos.map((i) => i.origen), ['propio', 'escrito']);
  assert.equal(todos[1].evento, cuenta.id);
});
