import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejemploCompra, ejemploCuenta } from '../ejemplos/ikisai/compra-food.mjs';
import { ocupantes, seguir, arbol, colisiones } from '../src/encaje.js';

const gastaT = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });

test('ocupantes: propio, lo que alcanza la referencia y lo escrito, en ese orden', async () => {
  const { eje, compra, menu } = await ejemploCompra();
  const cuenta = await ejemploCuenta(eje, compra);
  // Dirección 1000000000 de la compra: colisionan la posición 1 (array) y la 1.0
  // (una referencia al menú:1); lo que alcanza la referencia; y la cuenta escrita ahí.
  // Las colisiones se quieren: todas ocupan el lugar, con su camino y su procedencia.
  const oc = ocupantes(eje, compra.id, [1]);
  assert.deepEqual(oc.map((o) => o.origen), ['propio', 'propio', 'referencia', 'escrito']);
  assert.deepEqual(oc[0].camino, [1]);
  assert.deepEqual(oc[1].camino, [1, 0]);
  assert.deepEqual(oc[2].contenido, ['ensalada', 'guiso', 'fruta']);
  assert.deepEqual(oc[2].procedencia, [compra.id + ':1000000000#1.0', menu.id + ':1000000000']);
  assert.equal(oc[3].evento, cuenta.id);
  assert.equal(oc[3].autor, 'cocina');
  // La misma dirección por otro camino: la misma colisión.
  assert.deepEqual(ocupantes(eje, compra.id, [1, 0]), oc);
  // 1.1 (la cantidad, un terminal) no colisiona con nada.
  assert.deepEqual(ocupantes(eje, compra.id, [1, 1]).map((o) => o.camino), [[1, 1]]);
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
  // 1: [1] + [1.0] + lo alcanzado por la referencia + la cuenta escrita. 2: [2] + [2.0] + referencia.
  assert.equal(c.find((x) => x.dir === '1000000000').ocupantes.length, 4);
  assert.equal(c.find((x) => x.dir === '2000000000').ocupantes.length, 3);
  assert.ok(!c.find((x) => x.dir === '1100000000'));
  // La raíz también colisiona con su posición 0.
  assert.equal(m.get('0000000000').length, 2);
});

test('árbol con profundidad limitada', async () => {
  const { eje, compra } = await ejemploCompra();
  const m = arbol(eje, compra.id, { profundidad: 1 });
  assert.ok(m.has('1000000000'));
  assert.ok(!m.has('1200000000'));
});
