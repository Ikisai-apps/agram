import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarPayload, direccion, resolver, esDireccion, esTerminal, indicesDe, ARIDAD } from '../src/btml.js';
import { crearEvento } from '../src/evento.js';

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

/**
 * Un array disperso con la longitud máxima de JavaScript y una sola posición
 * presente. Vigila cuántas posiciones se miran: si alguien recorre la longitud
 * en vez de rechazarla, falla al pasar de ARIDAD en lugar de colgarse.
 */
function dispersoEnorme() {
  const enorme = [];
  enorme.length = 2 ** 32 - 1;
  enorme[0] = 'x';
  let miradas = 0;
  const mira = (k) => {
    if (typeof k === 'string' && /^[0-9]+$/.test(k) && ++miradas > ARIDAD) throw new Error('recorre la longitud');
  };
  return new Proxy(enorme, {
    has: (t, k) => (mira(k), Reflect.has(t, k)),
    get: (t, k, r) => (mira(k), Reflect.get(t, k, r)),
  });
}

test('array disperso de longitud enorme: se rechaza por la longitud, sin recorrerlo', async () => {
  assert.deepEqual(validarPayload(dispersoEnorme()).errores, ['raíz: más de 10 posiciones']);
  assert.deepEqual(validarPayload(['a', dispersoEnorme()]).errores, ['1: más de 10 posiciones']);
  // Por crearEvento también: la copia del payload no recorre la longitud.
  const movimientos = [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'raiz', a: null }];
  await assert.rejects(
    crearEvento({ autor: 'raiz', sobre: 'f'.repeat(64), t: '2026-11-07T10:00:00Z', movimientos, payload: ['a', dispersoEnorme()] }),
    /payload 1: más de 10 posiciones/,
  );
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
