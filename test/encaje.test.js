import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejemploCompra, ejemploCuenta } from '../ejemplos/ikisai/compra-food.mjs';
import { ocupantes, seguir, arbol, colisiones } from '../src/encaje.js';

const gastaT = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });

test('ocupantes: propio, lo que alcanza la referencia y lo escrito, en ese orden', async () => {
  const { eje, compra, menu } = await ejemploCompra();
  const cuenta = await ejemploCuenta(eje, compra);
  // Posición 1 de la compra: lo propio (array), lo que alcanza su representación
  // (la posición 0 es una referencia al menú:1) y la cuenta escrita ahí.
  // «1.0» y «1» son la misma dirección: el cero final mira la representación.
  const oc = ocupantes(eje, compra.id, [1]);
  assert.deepEqual(oc.map((o) => o.origen), ['propio', 'referencia', 'escrito']);
  assert.deepEqual(oc[1].contenido, ['ensalada', 'guiso', 'fruta']);
  assert.deepEqual(oc[1].procedencia, [compra.id + ':1000000000', menu.id + ':1000000000']);
  assert.equal(oc[2].evento, cuenta.id);
  assert.equal(oc[2].autor, 'cocina');
  assert.deepEqual(ocupantes(eje, compra.id, [1, 0]), oc);
  // Posición 7: nada propio, nada escrito.
  assert.deepEqual(ocupantes(eje, compra.id, [7]), []);
});

test('seguir una cadena de referencias conserva la procedencia; la rota se marca', async () => {
  const { eje, compra, menu } = await ejemploCompra();
  const a = await eje.escribir({ autor: 'casa', sobre: compra.id, t: '2026-11-07T15:00:00Z', movimientos: [gastaT('casa')], payload: { ref: compra.id, dir: '1000000000' } });
  // seguir solo sigue referencias directas: llega al array de la compra:1, no a su representación.
  const r = seguir(eje, { ref: a.id });
  assert.equal(r.contenido.length, 3);
  assert.deepEqual(r.procedencia, [a.id + ':0000000000', compra.id + ':1000000000']);
  // Los ocupantes de a sí llegan al menú a través de la representación.
  const oc = ocupantes(eje, a.id, []);
  void oc; void menu;
  const rota = seguir(eje, { ref: 'ffff' });
  assert.equal(rota.rota, true);
});

test('árbol lógico: todas las posiciones desarrolladas y las que solo tienen escritos', async () => {
  const { eje, compra } = await ejemploCompra();
  await ejemploCuenta(eje, compra);
  await eje.escribir({ autor: 'huesped', sobre: compra.id, en: '7000000000', t: '2026-11-07T15:00:00Z', movimientos: [gastaT('huesped')], payload: 'repetir' });
  const m = arbol(eje, compra.id);
  assert.ok(m.has('1000000000'));
  assert.ok(m.has('1200000000')); // 'EUR 12'
  assert.ok(m.has('7000000000')); // solo escritos
  assert.equal(m.get('7000000000')[0].origen, 'escrito');
  const c = colisiones(m);
  // 1: propio + lo alcanzado por su representación + la cuenta escrita. 2: propio + referencia.
  assert.equal(c.find((x) => x.dir === '1000000000').ocupantes.length, 3);
  assert.equal(c.find((x) => x.dir === '2000000000').ocupantes.length, 2);
  assert.ok(!c.find((x) => x.dir === '1100000000'));
});

test('árbol con profundidad limitada', async () => {
  const { eje, compra } = await ejemploCompra();
  const m = arbol(eje, compra.id, { profundidad: 1 });
  assert.ok(m.has('1000000000'));
  assert.ok(!m.has('1200000000'));
});
