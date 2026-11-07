import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejemploCompra, ejemploCuenta } from '../ejemplos/ikisai/compra-food.mjs';
import { ocupantes, seguir, arbol, colisiones, lista, ordenarPorEncaje } from '../src/encaje.js';
import { Eje } from '../src/eje.js';

const gastaT = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });

test('ocupantes: propio, lo que alcanza la referencia y lo escrito, en ese orden', async () => {
  const { eje, compra, menu } = await ejemploCompra();
  const cuenta = await ejemploCuenta(eje, compra);
  // Dirección 1000000000 de la compra: colisionan la posición 1 (una décupla) y la 1.0
  // (la lista de uno [ref menú:1]: su elemento, la referencia); lo que alcanza la referencia; y la cuenta escrita ahí.
  // Las colisiones se quieren: todas ocupan el lugar, con su camino y su procedencia.
  const oc = ocupantes(eje, compra.id, [1]);
  assert.deepEqual(oc.map((o) => o.origen), ['propio', 'propio', 'referencia', 'escrito']);
  assert.deepEqual(oc[0].camino, [1]);
  assert.equal(oc[0].enLista, undefined); // la décupla es un solo ocupante
  assert.deepEqual(oc[1].camino, [1, 0]);
  // VG, 7-11 noche: por hojas: el elemento de la lista lleva su índice y la procedencia '…#1.0[0]'.
  assert.deepEqual([oc[1].enLista, oc[1].indice], [true, 0]);
  assert.deepEqual(oc[2].contenido, ['ensalada', 'guiso', 'fruta']);
  assert.deepEqual(oc[2].procedencia, [compra.id + ':1000000000#1.0[0]', menu.id + ':1000000000']);
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
  // 1: [1] + el elemento de la lista [1.0] + lo alcanzado por la referencia + la cuenta escrita.
  // 2 (VG, 7-11 noche: por hojas): la lista de uno [ref menú:2] no tiene 2.0: su elemento + lo alcanzado.
  assert.equal(c.find((x) => x.dir === '1000000000').ocupantes.length, 4);
  assert.equal(c.find((x) => x.dir === '2000000000').ocupantes.length, 2);
  assert.deepEqual(m.get('2000000000').map((o) => [o.origen, o.indice]), [['propio', 0], ['referencia', undefined]]);
  // 3: la lista ['huesped', 'cocina'], dos ocupantes; el árbol no baja por ella (no hay 3.1).
  assert.deepEqual(m.get('3000000000').map((o) => o.contenido), ['huesped', 'cocina']);
  assert.ok(!m.has('3100000000'));
  assert.ok(!c.find((x) => x.dir === '1100000000'));
  // La raíz también colisiona con su posición 0.
  assert.equal(m.get('0000000000').length, 2);
});

test('por hojas: una lista en una posición da un ocupante por elemento; una décupla, uno', async () => {
  // VG, 7-11 noche: por hojas. La 1 es una lista de tres hojas; la 2, una décupla (el 0 envuelto).
  const eje = await Eje.genesis({ identidad: 'raiz', emision: [{ token: 'T', escala: 'minuto', cantidad: 60 }], foco: ['X', ['a', 'b', 'c'], [['d'], 'e']], t: '2026-11-07T10:00:00Z' });
  const id = eje.genesisId;
  const oc = ocupantes(eje, id, [1], { orden: 'llegada' });
  assert.deepEqual(oc.map((o) => [o.tipo, o.enLista, o.indice, o.contenido]), [['propio', true, 0, 'a'], ['propio', true, 1, 'b'], ['propio', true, 2, 'c']]);
  assert.ok(oc.every((o) => o.camino.length === 1 && o.camino[0] === 1)); // el camino de la posición de la lista
  assert.deepEqual(oc.map((o) => o.procedencia[0]), [0, 1, 2].map((k) => id + ':1000000000#1[' + k + ']'));
  // Mismo encaje que el registro: mismo vector, acuerdo y signo; el orden estable conserva el de la lista.
  assert.ok(oc.every((o) => JSON.stringify(o.vector) === JSON.stringify(oc[0].vector) && o.acuerdo === oc[0].acuerdo && o.signo === oc[0].signo));
  assert.deepEqual(ordenarPorEncaje(oc).map((o) => o.indice), [0, 1, 2]);
  assert.deepEqual(ocupantes(eje, id, [1]).map((o) => o.indice), [0, 1, 2]);
  // Misma llegada (la del evento) en la lista de la posición.
  assert.deepEqual(lista(eje, id, [1]).map((o) => [o.llegada, o.indice, o.contenido]), [[0, 0, 'a'], [0, 1, 'b'], [0, 2, 'c']]);
  // Una décupla es un solo ocupante, sin índice de lista; su 2.0 (la lista ['d']) colisiona por ceros con ella.
  const d = ocupantes(eje, id, [2], { exacto: true });
  assert.deepEqual(d.map((o) => [o.tipo, o.enLista, o.contenido]), [['propio', undefined, [['d'], 'e']]]);
  assert.deepEqual(lista(eje, id, [2]).map((o) => [o.llegada, o.enLista]), [[0, undefined]]);
  assert.deepEqual(ocupantes(eje, id, [2]).map((o) => o.camino), [[2], [2, 0]]);
});

test('árbol con profundidad limitada', async () => {
  const { eje, compra } = await ejemploCompra();
  const m = arbol(eje, compra.id, { profundidad: 1 });
  assert.ok(m.has('1000000000'));
  assert.ok(!m.has('1200000000'));
});
