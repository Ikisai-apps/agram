import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as agram from '../src/index.js';

test('el índice expone el núcleo y los modos por nombre', () => {
  assert.equal(typeof agram.Eje, 'function');
  assert.equal(typeof agram.crearEvento, 'function');
  assert.equal(typeof agram.validarPayload, 'function');
  assert.equal(typeof agram.leerDireccion, 'function');
  assert.equal(typeof agram.escritura, 'function');
  assert.equal(typeof agram.pointed.render, 'function');
  assert.equal(typeof agram.sequenced.render, 'function');
});
