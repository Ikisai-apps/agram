import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarPayload, direccion, resolver, esDireccion, esTerminal, indicesDe } from '../src/btml.js';

test('terminales: número, palabra, referencia', () => {
  assert.equal(esTerminal(3), true);
  assert.equal(esTerminal('menú'), true);
  assert.equal(esTerminal({ ref: 'abc' }), true);
  assert.equal(esTerminal({ ref: 'abc', dir: '1200000000' }), true);
  assert.equal(esTerminal(''), false);
  assert.equal(esTerminal(NaN), false);
  assert.equal(esTerminal({ ref: 'abc', dir: '12' }), false);
});

test('array válido: hasta diez posiciones, sin huecos, anidado', () => {
  assert.equal(validarPayload(['a', ['b', 2], { ref: 'x' }]).ok, true);
  assert.equal(validarPayload([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).ok, true);
});

test('array inválido: vacío, hueco, más de diez', () => {
  assert.equal(validarPayload([]).ok, false);
  const r = validarPayload(['a', null, 'c']);
  assert.equal(r.ok, false);
  assert.match(r.errores[0], /^1: hueco/);
  assert.equal(validarPayload(Array(11).fill(1)).ok, false);
  const anidado = validarPayload(['a', ['b', []]]);
  assert.equal(anidado.ok, false);
  assert.match(anidado.errores[0], /^11: array vacío/);
});

test('direcciones: diez dígitos, ceros finales', () => {
  assert.equal(direccion([8, 4, 1, 2, 3]), '8412300000');
  assert.equal(direccion([]), '0000000000');
  assert.equal(esDireccion('8412300000'), true);
  assert.equal(esDireccion('841'), false);
  assert.throws(() => direccion([10]));
  assert.throws(() => direccion(Array(11).fill(0)));
});

test('1100000000 y 0000000011 no son equivalentes', () => {
  const p = [['x', 'y'], ['a', 'b']];
  assert.equal(resolver(p, '1100000000'), 'b');
  assert.equal(resolver(p, '0000000011'), undefined);
});

test('resolver desciende y se detiene en el terminal', () => {
  const p = ['raíz', ['uno', ['dos', 'tres']], 'fin'];
  assert.equal(resolver(p, '1110000000'), 'tres');
  assert.equal(resolver(p, '2000000000'), 'fin');
  assert.deepEqual(resolver(p, '1000000000'), ['uno', ['dos', 'tres']]);
  assert.equal(resolver(p, '5000000000'), undefined);
});

test('indicesDe: ceros finales fuera, cero intermedio es índice real', () => {
  assert.deepEqual(indicesDe('8412300000'), [8, 4, 1, 2, 3]);
  assert.deepEqual(indicesDe('1010000000'), [1, 0, 1]);
  assert.deepEqual(indicesDe('0000000000'), []);
});
