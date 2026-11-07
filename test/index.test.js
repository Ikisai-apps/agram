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

test('el índice expone los efectos y las capas de validez como espacios de nombres', async () => {
  const { ejemploCompra } = await import('../ejemplos/ikisai/compra-food.mjs');
  const { eje, compra } = await ejemploCompra();
  assert.equal(typeof agram.efectos.efectosDe, 'function');
  assert.equal(typeof agram.efectos.render, 'function');
  assert.equal(typeof agram.validez.validez, 'function');
  assert.deepEqual(agram.validez.CAPAS, (await import('../src/validez.js')).CAPAS);
  // Lo mismo por el índice que por el módulo: el espacio de nombres no copia nada.
  assert.equal(agram.validez.validez, (await import('../src/validez.js')).validez);
  assert.equal((await agram.validez.validez(eje, compra.id)).capas.length, 5);
  assert.ok(agram.efectos.efectosDe(eje, compra.id).length > 0);
  // Ningún nombre plano nuevo: validez y efectos solo existen como espacios de nombres.
  assert.equal(typeof agram.efectosDe, 'undefined');
  assert.equal(typeof agram.CAPAS, 'undefined');
});
