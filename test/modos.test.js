import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lectura, escritura, contarPosiciones, cabeEscritura } from '../src/modos.js';

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
