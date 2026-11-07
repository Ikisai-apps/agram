import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejemploCompra } from '../ejemplos/ikisai/compra-food.mjs';
import { decupla, render } from '../src/pointed.js';
import { resolver } from '../src/btml.js';

test('ejemplo Ikisai: compra de comida recorre el eje entero', async () => {
  const { eje, menu, compra } = await ejemploCompra();
  assert.deepEqual(eje.identidades(), ['casa', 'cocina', 'huesped']);
  assert.equal(eje.saldo('cocina', 'E:EUR'), 12);
  assert.equal(eje.saldo('huesped', 'E:EUR'), 48);
  assert.equal(eje.saldoT('huesped', 'hora'), 23);
  // Series: la casa emite los EUR y las dos escalas de T que usa; las altas reparten ambas.
  assert.deepEqual(eje.serie('EUR'), { emisor: 'casa', emitido: 500 });
  assert.deepEqual(eje.series().map((s) => s.clave), ['T:hora', 'T:minuto', 'E:EUR', 'P:genesis']);
  assert.deepEqual(eje.tiempos('huesped'), [{ escala: 'minuto', cantidad: 480 }, { escala: 'hora', cantidad: 23 }]);
  assert.deepEqual(eje.recursos('huesped'), [{ denominacion: 'EUR', cantidad: 48 }]);
  assert.equal(eje.hilo(compra.id).length, 4);
  // La referencia no copia: se resuelve sobre el menú.
  const ref = compra.payload[1][0];
  assert.deepEqual(resolver(eje.obtener(ref.ref).payload, ref.dir), ['ensalada', 'guiso', 'fruta']);
  assert.equal(ref.ref, menu.id);
  const texto = render(decupla(compra));
  assert.match(texto, /^4 fábrica\s+\[2 posiciones\]$/m);
});
