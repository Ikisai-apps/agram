import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lectura, escritura, contarPosiciones, cabeEscritura, maximo, minimo, tope, cabeTope, alcanceDe, nombreModo, MODOS } from '../src/modos.js';

test('lectura por modo: una, diez, cien, mil décuplas', () => {
  assert.equal(lectura('pointed'), 10);
  assert.equal(lectura('sequenced'), 100);
  assert.equal(lectura('mapped'), 1000);
  assert.equal(lectura('scened'), 10000);
});

test('escritura por modo según la proporción de VG', () => {
  assert.deepEqual(escritura('pointed'), [1, 1]);
  assert.deepEqual(escritura('sequenced'), [10, 20]);
  assert.deepEqual(escritura('mapped'), [250, 333]);
  assert.equal(escritura('scened'), null);
});

test('contar posiciones: cada terminal cuenta una, anidado incluido', () => {
  assert.equal(contarPosiciones('x'), 1);
  assert.equal(contarPosiciones(['a', ['b', 'c'], { ref: 'r' }]), 4);
  assert.equal(contarPosiciones([[[1, 2], 3], 4]), 4);
});

test('cabe como escritura del modo', () => {
  assert.equal(cabeEscritura('una palabra', 'pointed'), true);
  assert.equal(cabeEscritura(['a', 'b'], 'pointed'), false);
  assert.equal(cabeEscritura(Array(20).fill('x').slice(0, 10).map((x, i) => (i < 5 ? [x, x] : x)), 'sequenced'), true);
  assert.equal(cabeEscritura(Array(10).fill(['a', 'b', 'c']), 'sequenced'), false);
  assert.equal(cabeEscritura(Array(10).fill(['a', 'b', 'c']), 'scened'), true);
});

// VG, 7-11 noche: tres números por modo; el máximo es el mismo para representar y para emitir.
test('máximo y mínimo por modo (VG, 7-11 noche): Pointed 1/10, Sequenced 10/100, Mapped 100/1000, Scened 1000/10000, Be sin mínimo/todos', () => {
  assert.deepEqual(Object.keys(MODOS).map(maximo), [10, 100, 1000, 10000, Infinity]);
  assert.deepEqual(Object.keys(MODOS).map(minimo), [1, 10, 100, 1000, null]);
  for (const m of Object.keys(MODOS)) {
    assert.equal(lectura(m), maximo(m), m); // lectura y tope son alias de maximo
    assert.equal(tope(m), maximo(m), m);
  }
  assert.equal(nombreModo('be'), 'Be');
  assert.equal(escritura('be'), null); // proporción de Be sin fijar
  const cienMil = Array(10).fill(Array(10).fill(Array(10).fill(Array(10).fill(Array(10).fill('z')))));
  assert.equal(cabeTope(cienMil, 'scened'), false);
  assert.equal(cabeTope(cienMil, 'be'), true); // Be: todos
  assert.throws(() => maximo('otro'), /modo desconocido: otro/);
  assert.throws(() => minimo('otro'), /modo desconocido: otro/);
});

test('alcanceDe: lo conseguido, el mínimo y el máximo; no llegar al mínimo se dice, no se rechaza', () => {
  assert.deepEqual(alcanceDe(7, 'sequenced'), { conseguido: 7, minimo: 10, maximo: 100, alMinimo: false });
  assert.deepEqual(alcanceDe(10, 'sequenced'), { conseguido: 10, minimo: 10, maximo: 100, alMinimo: true });
  assert.deepEqual(alcanceDe(0, 'pointed'), { conseguido: 0, minimo: 1, maximo: 10, alMinimo: false });
  assert.deepEqual(alcanceDe(5, 'be'), { conseguido: 5, minimo: null, maximo: Infinity, alMinimo: null }); // mínimo de Be sin fijar
  for (const n of [-1, 1.5, '3', NaN]) assert.throws(() => alcanceDe(n, 'mapped'), /conseguido inválido/);
});
