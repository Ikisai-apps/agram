import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejemploCompra } from '../ejemplos/ikisai/compra-food.mjs';
import { decupla, render } from '../src/pointed.js';
import { resolver } from '../src/btml.js';

test('ejemplo Ikisai: compra de comida recorre el eje entero', async () => {
  const { eje, menu, compra } = await ejemploCompra();
  assert.deepEqual(eje.identidades(), ['casa', 'cocina', 'huesped']);
  assert.equal(eje.saldo('cocina', 'E:casa/EUR'), 12);
  assert.equal(eje.saldo('huesped', 'E:casa/EUR'), 48);
  // T no cruza de persona (VG, 7-11 noche): la persona huésped no recibió T; la hora que gasta al comprar sale
  // de su asignación del día (VG, 8-11) y queda anotada en el menú, el registro que soporta la compra.
  assert.equal(eje.saldo('huesped', 'T:hora'), 0);
  assert.equal(eje.saldoT('huesped', 'hora'), 23);
  assert.equal(eje.tiempoSobre(menu.id).hora, 1);
  // Series: la casa (una persona, VG, 7-11 noche; antes un grupo) emite sus EUR y las dos escalas de T que usa; las
  // altas declaran tipo, y la casa da T a la cocina, que es una cosa suya (Core, 8-11).
  assert.deepEqual(eje.serie('E:casa/EUR'), { emisor: 'casa', emitido: 500 });
  assert.deepEqual(eje.series().map((s) => s.clave), ['T:hora', 'T:minuto', 'E:casa/EUR', 'P:genesis']);
  // R2 (VG, 7-11 noche): los EUR de la casa van atados al registro de su emisor (el génesis, que escribió ella) y,
  // sin capacidad declarada en su hilo, no tienen tope: son deuda del emisor.
  const eur = eje.series().find((s) => s.clave === 'E:casa/EUR');
  assert.deepEqual([eur.registro, eur.tope, eur.nota, eur.divisible], [eje.genesisId, null, 'sin capacidad declarada: deuda del emisor', false]);
  assert.deepEqual(eje.tiempos('huesped'), []);
  assert.deepEqual(eje.recursos('huesped'), [{ emisor: 'casa', denominacion: 'EUR', cantidad: 48 }]);
  assert.deepEqual(['casa', 'cocina', 'huesped'].map((id) => eje.tipo(id)), ['persona', 'cosa', 'persona']);
  assert.equal(eje.hilo(compra.id).length, 4);
  // La referencia no copia: se resuelve sobre el menú. VG, 7-11 noche: por hojas; compra 1 es
  // [[menú], [1], ['EUR 12']] y la referencia va en su 1.0, una lista de uno.
  const ref = compra.payload[1][0][0];
  assert.deepEqual(resolver(eje.obtener(ref.ref).payload, ref.dir), ['ensalada', 'guiso', 'fruta']);
  assert.equal(ref.ref, menu.id);
  const texto = render(decupla(compra));
  assert.match(texto, /^4 fábrica\s+lista de 2: pagar · servir$/m); // solo hojas: una lista de dos ocupantes
  assert.match(texto, /^1 recursos\s+\[3 posiciones\]$/m); // con un array dentro: una décupla
});
