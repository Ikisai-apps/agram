import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarMovimiento, claveToken, cantidadBase } from '../src/tokens.js';

test('movimiento T válido y clave por escala', () => {
  const m = { token: 'T', escala: 'hora', cantidad: 1, de: 'ana', a: null };
  assert.deepEqual(validarMovimiento(m), []);
  assert.equal(claveToken(m), 'T');
  assert.equal(cantidadBase(m), 3600);
  assert.equal(cantidadBase({ token: 'T', escala: 'anio', cantidad: 1 }), 365 * 86400);
});

test('movimiento E con denominación', () => {
  const m = { token: 'E', denominacion: 'EUR', cantidad: 12.5, de: 'ana', a: 'cocina' };
  assert.deepEqual(validarMovimiento(m), []);
  assert.equal(claveToken(m), 'E:EUR');
});

test('P exige ámbito; R exige emisor y no es fungible', () => {
  assert.ok(validarMovimiento({ token: 'P', cantidad: 1, de: 'a', a: 'b' }).some((e) => /ámbito/.test(e)));
  assert.deepEqual(validarMovimiento({ token: 'P', cantidad: 1, de: 'a', a: 'b', ambito: 'genesis' }), []);
  assert.equal(claveToken({ token: 'P', ambito: 'abc' }), 'P:abc');
  assert.ok(validarMovimiento({ token: 'R', cantidad: 1, de: 'a', a: 'b' }).some((e) => /emisor/.test(e)));
  assert.deepEqual(validarMovimiento({ token: 'R', cantidad: 1, de: 'a', a: 'b', emisor: 'a' }), []);
  assert.ok(validarMovimiento({ token: 'R', cantidad: 1, de: 'b', a: 'c', emisor: 'a' }).some((e) => /no es fungible/.test(e)));
  assert.ok(validarMovimiento({ token: 'R', cantidad: 1, de: null, a: 'b', emisor: 'a' }).some((e) => /propio emisor/.test(e)));
  assert.equal(claveToken({ token: 'R', emisor: 'a' }), 'R:a');
  assert.ok(validarMovimiento({ token: 'E', cantidad: 1, de: 'a', a: 'b', ambito: 'x' }).some((e) => /ámbito solo en P/.test(e)));
});

test('movimientos inválidos', () => {
  assert.ok(validarMovimiento({ token: 'Z', cantidad: 1, de: 'a', a: 'b' }).length);
  assert.ok(validarMovimiento({ token: 'T', cantidad: 0, escala: 'hora', de: 'a', a: 'b' }).length);
  assert.ok(validarMovimiento({ token: 'T', cantidad: 1, escala: 'mes', de: 'a', a: 'b' }).length);
  assert.ok(validarMovimiento({ token: 'E', cantidad: 1, de: null, a: null }).length);
  assert.ok(validarMovimiento({ token: 'E', cantidad: 1, de: 'a' }).length);
});
