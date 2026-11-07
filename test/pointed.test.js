import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decupla, render, sobrio } from '../src/pointed.js';
import { leerDireccion, PV } from '../src/epocas.js';

const ev = {
  id: 'abcdef0123456789',
  autor: 'raiz',
  t: '2026-11-06T20:00:00Z',
  sobre: null,
  payload: ['Menú del día', ['menú', 1, 'EUR 12'], ['sin gluten'], { ref: 'ffff0000aaaa', dir: '3000000000' }],
};

test('décupla: diez posiciones con significado de época 0', () => {
  const d = decupla(ev);
  assert.equal(d.posiciones.length, 10);
  assert.deepEqual(d.posiciones.map((p) => p.significado), [...PV]);
  assert.equal(d.posiciones[0].contenido, 'Menú del día');
  assert.deepEqual(d.posiciones[1].contenido, ['menú', 1, 'EUR 12']);
  assert.equal(d.posiciones[9].contenido, undefined);
});

test('décupla de un terminal: no tiene posición 0; el terminal va aparte (MAPA §12)', () => {
  const d = decupla({ ...ev, payload: 42 });
  assert.equal(d.terminal, 42);
  assert.ok(d.posiciones.every((p) => p.contenido === undefined));
  assert.equal(decupla(ev).terminal, undefined);
  assert.match(sobrio(d).split('\n')[1], /^terminal 42$/);
});

test('render sobrio: una línea por posición', () => {
  const texto = sobrio(decupla(ev));
  const lineas = texto.split('\n');
  assert.equal(lineas.length, 11);
  assert.match(lineas[1], /^0 representación\s+Menú del día$/);
  assert.match(lineas[2], /^1 recursos\s+\[3 posiciones\]$/);
  assert.match(lineas[4], /^3 comunicación\s+→ ffff0000:3000000000$/);
  assert.match(lineas[10], /^9 camino\s+—$/);
  assert.equal(render(decupla(ev)), texto);
  assert.throws(() => render(decupla(ev), 'animado'), /no disponible/);
});

test('leer dirección bajo época 0', () => {
  assert.deepEqual(
    leerDireccion('1200000000').map((x) => x.significado),
    ['recursos', 'criterios'],
  );
  assert.deepEqual(leerDireccion('0000000000'), []);
});
