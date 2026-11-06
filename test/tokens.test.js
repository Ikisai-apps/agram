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

test('movimientos inválidos', () => {
  assert.ok(validarMovimiento({ token: 'Z', cantidad: 1, de: 'a', a: 'b' }).length);
  assert.ok(validarMovimiento({ token: 'T', cantidad: 0, escala: 'hora', de: 'a', a: 'b' }).length);
  assert.ok(validarMovimiento({ token: 'T', cantidad: 1, escala: 'mes', de: 'a', a: 'b' }).length);
  assert.ok(validarMovimiento({ token: 'E', cantidad: 1, de: null, a: null }).length);
  assert.ok(validarMovimiento({ token: 'E', cantidad: 1, de: 'a' }).length);
});
