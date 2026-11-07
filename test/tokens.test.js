import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarMovimiento, claveToken, cantidadBase, partirClave, SERIE, ESCALAS_T, MAXIMO_ESCALAS_T, FAMILIAS } from '../src/tokens.js';

test('T: un token por escala, sin conversión entre escalas', () => {
  const m = { token: 'T', escala: 'hora', cantidad: 1, de: 'ana', a: null };
  assert.deepEqual(validarMovimiento(m), []);
  assert.equal(claveToken(m), 'T:hora');
  assert.equal(cantidadBase(m), 1); // una hora es una hora, no 3600 segundos
  assert.equal(claveToken({ token: 'T', escala: 'minuto', cantidad: 60 }), 'T:minuto');
  assert.notEqual(claveToken({ token: 'T', escala: 'minuto' }), claveToken({ token: 'T', escala: 'hora' }));
  assert.equal(cantidadBase({ token: 'T', escala: 'anio', cantidad: 1 }), 1);
  assert.deepEqual(ESCALAS_T, ['segundo', 'minuto', 'hora', 'dia', 'semana', 'ciclo', 'anio']);
  assert.ok(ESCALAS_T.length <= MAXIMO_ESCALAS_T);
  assert.equal(MAXIMO_ESCALAS_T, 10);
});

test('la constante: cada familia es una serie de denominaciones', () => {
  assert.deepEqual(Object.keys(SERIE).sort(), [...FAMILIAS].sort());
  assert.deepEqual(SERIE, { T: 'escala', E: 'denominacion', P: 'ambito', R: 'emisor' });
  const claves = [
    claveToken({ token: 'T', escala: 'dia' }),
    claveToken({ token: 'E', denominacion: 'cama-2@2026-11-13' }),
    claveToken({ token: 'P', ambito: 'genesis' }),
    claveToken({ token: 'R', emisor: 'casa' }),
  ];
  assert.deepEqual(claves, ['T:dia', 'E:cama-2@2026-11-13', 'P:genesis', 'R:casa']);
  assert.deepEqual(partirClave('E:cama-2@2026-11-13'), { token: 'E', serie: 'cama-2@2026-11-13' });
  assert.deepEqual(partirClave('E:a:b'), { token: 'E', serie: 'a:b' }); // la denominación puede llevar dos puntos
});

test('movimiento E con denominación; emitir exige emisor', () => {
  const m = { token: 'E', denominacion: 'EUR', cantidad: 12.5, de: 'ana', a: 'cocina' };
  assert.deepEqual(validarMovimiento(m), []);
  assert.equal(claveToken(m), 'E:EUR');
  assert.ok(validarMovimiento({ token: 'E', cantidad: 1, de: 'ana', a: 'bea' }).some((e) => /E exige denominación/.test(e)));
  // Emisión de una serie: de = null y emisor declarado.
  assert.deepEqual(validarMovimiento({ token: 'E', denominacion: 'cama', cantidad: 4, de: null, a: 'casa', emisor: 'casa' }), []);
  assert.deepEqual(validarMovimiento({ token: 'E', denominacion: 'cama', cantidad: 1, de: null, a: 'huesped', emisor: 'casa' }), []);
  assert.ok(validarMovimiento({ token: 'E', denominacion: 'cama', cantidad: 1, de: null, a: 'casa' }).some((e) => /emisión de E exige emisor/.test(e)));
  // Fuera de la emisión, el emisor no viaja en E: la serie ya sabe quién la emite.
  assert.ok(validarMovimiento({ token: 'E', denominacion: 'cama', cantidad: 1, de: 'casa', a: 'bea', emisor: 'casa' }).some((e) => /emisor en E solo al emitir/.test(e)));
  assert.ok(validarMovimiento({ token: 'T', escala: 'hora', cantidad: 1, de: 'casa', a: 'bea', denominacion: 'EUR' }).some((e) => /denominación solo en E/.test(e)));
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
  assert.ok(validarMovimiento({ token: 'E', denominacion: 'EUR', cantidad: 1, de: 'a', a: 'b', ambito: 'x' }).some((e) => /ámbito solo en P/.test(e)));
  assert.ok(validarMovimiento({ token: 'P', cantidad: 1, de: 'a', a: 'b', ambito: 'genesis', emisor: 'a' }).some((e) => /emisor solo en R y en la emisión de E/.test(e)));
});

test('movimientos inválidos', () => {
  assert.ok(validarMovimiento({ token: 'Z', cantidad: 1, de: 'a', a: 'b' }).length);
  assert.ok(validarMovimiento({ token: 'T', cantidad: 0, escala: 'hora', de: 'a', a: 'b' }).length);
  assert.ok(validarMovimiento({ token: 'T', cantidad: 1, escala: 'mes', de: 'a', a: 'b' }).length);
  assert.ok(validarMovimiento({ token: 'E', denominacion: 'EUR', cantidad: 1, de: null, a: null }).length);
  assert.ok(validarMovimiento({ token: 'E', denominacion: 'EUR', cantidad: 1, de: 'a' }).length);
});
