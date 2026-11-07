// Décupla y lista, por hojas (VG, 7-11 noche: por hojas). Dentro de una
// posición, un array solo de hojas (terminales o referencias) es una LISTA:
// cada elemento es un ocupante de la posición, con la misma llegada y el
// mismo encaje que el evento y en el orden de la lista, alcanzable por índice
// y nunca por dirección. Un array con algún array dentro es una DÉCUPLA
// (subposiciones 0–9 por dígito). La raíz es siempre la décupla de lo
// escrito. Sustituye a la lectura de la PR #64 («todo array dentro de una
// posición es su lista»). Datos inventados.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ejemploCompra, ejemploCuenta } from '../ejemplos/ikisai/compra-food.mjs';
import { lista, ocupantes, ordenarPorEncaje } from '../src/encaje.js';
import { EPOCA_0, PV, cargarEpoca, leerDireccion, leerCamino, nombreEnNodo } from '../src/epocas.js';
import { consultar } from '../src/bql.js';
import { decupla, render } from '../src/pointed.js';
import { mapa } from '../src/mapped.js';
import { ARIDAD, esLista, esDecupla } from '../src/btml.js';
import { contarPosiciones, cabeTope } from '../src/modos.js';

const PREGUNTAS = PV.map((_, d) => EPOCA_0.reglaCorta(1, d));
const gasta = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });

async function compraConCuenta() {
  const base = await ejemploCompra();
  const cuenta = await ejemploCuenta(base.eje, base.compra);
  return { ...base, cuenta };
}

const escribe = (eje, sobre, en, payload, t = '2026-11-07T15:00:00Z') => eje.escribir({ autor: 'huesped', sobre, en, t, movimientos: [gasta('huesped')], payload });

// ---------- la forma ----------

test('por hojas: solo hojas es una lista; con un array dentro, una décupla; la convención envuelve el 0', async () => {
  const { compra, menu } = await compraConCuenta();
  assert.ok(esLista(menu.payload[1])); // los platos: ['ensalada', 'guiso', 'fruta']
  assert.ok(esLista(compra.payload[3])); // quién habla con quién: ['huesped', 'cocina']
  assert.ok(esLista(compra.payload[2])); // una lista de uno: la referencia a los criterios del menú
  assert.ok(esDecupla(compra.payload[1]) && !esLista(compra.payload[1])); // [[menú], 1, 'EUR 12']
  assert.ok(!esLista([]) && !esLista('a') && !esDecupla(['a', 'b']));
});

// ---------- núcleo: la lista de la posición ----------

test('lista: una lista en una posición son sus ocupantes, con la misma llegada y en su orden; luego los escritos', async () => {
  const { eje, compra } = await compraConCuenta();
  const l = lista(eje, compra.id, [3]);
  assert.deepEqual(l.map((o) => [o.llegada, o.tipo, o.enLista, o.indice, o.contenido]), [[0, 'propio', true, 0, 'huesped'], [0, 'propio', true, 1, 'cocina']]);
  assert.ok(l.every((o) => o.evento === compra.id && o.camino.join('.') === '3')); // el camino es el de la posición
  const nota = await escribe(eje, compra.id, '3000000000', 'me apunto');
  const otra = await escribe(eje, compra.id, '3000000000', 'y yo', '2026-11-07T15:05:00Z');
  assert.deepEqual(lista(eje, compra.id, [3]).map((o) => [o.llegada, o.tipo, o.evento === compra.id ? 'compra' : o.evento]), [[0, 'propio', 'compra'], [0, 'propio', 'compra'], [1, 'escrito', nota.id], [2, 'escrito', otra.id]]);
});

test('lista: una décupla es un solo ocupante; su 0 envuelto es una lista de uno con lo que alcanza', async () => {
  const { eje, compra, menu, cuenta } = await compraConCuenta();
  const l = lista(eje, compra.id, [1]);
  assert.deepEqual(l.map((o) => [o.llegada, o.tipo, o.enLista ?? false]), [[0, 'propio', false], [1, 'escrito', false]]);
  assert.deepEqual(l[0].contenido, compra.payload[1]); // la décupla entera, sin tocar
  assert.equal(l[1].evento, cuenta.id);
  // La 1.0 de la décupla: la lista de uno [menú]; la referencia dice lo que alcanza (la lista de platos), sin copiar.
  const cero = lista(eje, compra.id, [1, 0]);
  assert.deepEqual([cero[0].tipo, cero[0].enLista, cero[0].indice, cero[0].camino], ['propio', true, 0, [1, 0]]);
  assert.equal(cero[0].alcanza.evento, menu.id);
  assert.deepEqual(cero[0].alcanza.contenido, ['ensalada', 'guiso', 'fruta']);
  // La raíz es la cruceta, no una lista: solo lo escrito en ella.
  const raiz = await escribe(eje, compra.id, '0000000000', 'suelta en la raíz');
  assert.deepEqual(lista(eje, compra.id, []).map((o) => [o.tipo, o.evento]), [['escrito', raiz.id]]);
  assert.deepEqual(lista(eje, compra.id, [7]), []);
});

test('lista: es de n; cada elemento cuenta en el tope del evento, no en el de la posición', async () => {
  const { eje, compra } = await compraConCuenta();
  const doce = Array.from({ length: 12 }, (_, k) => 'invitado ' + (k + 1));
  const payload = ['Mesa grande', doce];
  assert.equal(contarPosiciones(payload), 13);
  assert.equal(cabeTope(payload, 'pointed'), false); // el modo pone el tope: doce ocupantes no caben en una décupla
  const mesa = await escribe(eje, compra.id, '3000000000', payload);
  const l = lista(eje, mesa.id, [1]);
  assert.equal(l.length, 12);
  assert.ok(l.length > ARIDAD);
  assert.deepEqual(l.map((o) => o.indice), [...Array(12).keys()]);
  assert.ok(l.every((o) => o.llegada === 0));
  // Un array de más de diez con un array dentro no es una lista: es una décupla demasiado larga.
  await assert.rejects(escribe(eje, compra.id, '3000000000', ['Mesa', [...doce.slice(0, 10), ['x'], 'y']]), /más de 10 posiciones/);
});

// ---------- encaje: los elementos de una lista ----------

test('encaje: cada elemento de una lista es un ocupante con la misma llegada y el mismo encaje; el orden de la lista se conserva', async () => {
  const { eje, menu } = await compraConCuenta();
  const oc = ocupantes(eje, menu.id, [1]);
  assert.deepEqual(oc.map((o) => [o.tipo, o.origen, o.enLista, o.indice, o.contenido]), [
    ['propio', 'propio', true, 0, 'ensalada'], ['propio', 'propio', true, 1, 'guiso'], ['propio', 'propio', true, 2, 'fruta'],
  ]);
  assert.ok(oc.every((o) => o.acuerdo === ARIDAD && o.signo === 'exacto' && o.vector.every((x) => x === 0)));
  assert.ok(oc.every((o) => o.empate && o.empatados === 2)); // la misma puntuación: el orden lo da la lista
  assert.deepEqual(oc.map((o) => o.procedencia[0]), [0, 1, 2].map((k) => menu.id + ':1000000000#1[' + k + ']'));
  assert.deepEqual(ordenarPorEncaje([...oc].reverse()).map((o) => o.indice), [2, 1, 0]); // estable: no reordena entre iguales
  assert.match(oc[1].justificacion, /^elemento 2 de la lista, propio del registro/);
  // Una dirección dentro de la lista no existe: nada colisiona en la 1.1 del menú.
  assert.deepEqual(ocupantes(eje, menu.id, [1, 1]), []);
});

// ---------- épocas: la regla corta vuelve a las décuplas; la lista se nombra por llegada ----------

test('leerDireccion: una dirección solo nombra subposiciones de décuplas, con su regla corta', async () => {
  assert.deepEqual(leerDireccion('1200000000').map((x) => x.significado), ['recursos', 'con qué condición']);
  assert.deepEqual(leerDireccion('3100000000', 'época 0').map((x) => x.significado), ['comunicación', 'cuánto']);
  const e = cargarEpoca({ nombre: 'con larga', reglas: [{ ruta: '12', nombre: 'precio pactado' }] }, { respaldo: EPOCA_0 });
  assert.equal(leerDireccion('1200000000', e)[1].significado, 'precio pactado');
});

test('leerCamino con el payload: en una décupla, la regla corta; en una lista, «ocupante k» sin regla', async () => {
  const { compra } = await compraConCuenta();
  const leer = (c, epoca = EPOCA_0) => leerCamino(c, epoca, { payload: compra.payload }).map((x) => x.significado);
  assert.deepEqual(leer([1, 1]), ['recursos', 'cuánto']); // compra 1 = [[menú], 1, 'EUR 12']: 1.1 cuánto
  assert.deepEqual(leer([1, 2]), ['recursos', 'con qué condición']);
  assert.deepEqual(leer([3, 1]), ['comunicación', 'ocupante 2 de la posición 3']); // ['huesped', 'cocina']
  assert.deepEqual(leer([1, 0, 0]), ['recursos', 'qué es', 'ocupante 1 de la posición 1.0']); // la lista de uno [menú]
  const c = leerCamino([3, 1], EPOCA_0, { payload: compra.payload })[1];
  assert.deepEqual([c.ocupante, c.posicion, c.larga], [1, '3', undefined]);
  // Una regla larga no se aplica al índice de un ocupante; sí a la subposición de una décupla.
  const e = cargarEpoca({ nombre: 'con larga', reglas: [{ ruta: '31', nombre: 'el que responde' }, { ruta: '12', nombre: 'precio pactado' }] }, { respaldo: EPOCA_0 });
  assert.deepEqual(leer([3, 1], e), ['comunicación', 'ocupante 2 de la posición 3']);
  assert.deepEqual(leer([1, 2], e), ['recursos', 'precio pactado']);
  assert.throws(() => leerCamino([1, 10]), TypeError);
});

test('nombreEnNodo, décupla y mapa: la décupla lleva la regla corta; la lista se pinta como lista', async () => {
  const { eje, compra, menu } = await compraConCuenta();
  assert.deepEqual(nombreEnNodo(['a', 'b'], 1, 1), { ocupante: 1, significado: 'ocupante 2' });
  assert.deepEqual(nombreEnNodo(['a', 'b'], 1, 2), { significado: 'con qué condición' });
  assert.deepEqual(nombreEnNodo([['a'], 'b'], 1, 1), { significado: 'cuánto' }); // una décupla
  assert.deepEqual(nombreEnNodo(['a', 'b'], 0, 1), { significado: PV[1] }); // la raíz es la cruceta
  // Pointed: la décupla de la compra vuelve a leer 1.1 = cuánto; la lista de platos del menú, ocupantes.
  assert.deepEqual(decupla({ ...compra, payload: compra.payload[1] }, EPOCA_0, 1).posiciones.map((p) => p.significado), PREGUNTAS);
  const platos = decupla({ ...menu, payload: menu.payload[1] }, EPOCA_0, 1);
  assert.deepEqual(platos.posiciones.slice(0, 4).map((p) => [p.significado, p.ocupante, p.contenido]), [['ocupante 1', 0, 'ensalada'], ['ocupante 2', 1, 'guiso'], ['ocupante 3', 2, 'fruta'], ['con quién', undefined, undefined]]);
  assert.deepEqual(platos.lista, ['ensalada', 'guiso', 'fruta']);
  assert.match(render(decupla(menu)), /^1 recursos\s+lista de 3: ensalada · guiso · fruta$/m);
  assert.match(render(decupla(compra)), /^1 recursos\s+\[3 posiciones\]$/m);
  // Mapped: bajo la 1 del menú, la lista; bajo la 1 de la compra, la décupla.
  const m = mapa(eje, menu.id, { camino: [1] });
  assert.deepEqual(m.celdas.slice(0, 4).map((c) => c.significado), ['ocupante 1', 'ocupante 2', 'ocupante 3', 'con quién']);
  assert.deepEqual(m.lista, ['ensalada', 'guiso', 'fruta']);
  assert.deepEqual(mapa(eje, compra.id, { camino: [1] }).celdas.map((c) => c.significado), PREGUNTAS);
  assert.equal(mapa(eje, compra.id, { camino: [1] }).lista, undefined);
});

// ---------- BQL: BUSCAR desplegado, BUSCAR(n, k) por llegada, REF por dirección = décupla ----------

test('BUSCAR(n) despliega la lista; BUSCAR(n, k) da el ocupante k por llegada; REF por dirección es la décupla', async () => {
  const { eje, compra, menu, cuenta } = await compraConCuenta();
  const q = (f) => consultar(eje, compra.id, [0], f);
  const tres = q('BUSCAR(3)').valor.items;
  assert.deepEqual(tres.map((i) => [i.origen, i.indices, i.lista]), [['propio', [3], 0], ['propio', [3], 1]]); // no el array entero
  assert.deepEqual(q('BUSCAR(3, 1)').valor.items.map((i) => i.lista), [1]);
  assert.equal(q('BUSCAR(3, 2)').texto, '0 candidatos');
  assert.equal(q('ACTUAL(3)').texto, 'huesped'); // el valor de un candidato de lista es su elemento
  assert.equal(q('CONTAR(BUSCAR(3))').texto, '2');
  // En la 1, la décupla es un ocupante y la cuenta, escrita encima, el siguiente por llegada.
  assert.deepEqual(q('BUSCAR(1)').valor.items.map((i) => i.evento), [compra.id, cuenta.id]);
  assert.deepEqual(q('BUSCAR(1, 1)').valor.items.map((i) => i.evento), [cuenta.id]);
  // Por dirección, la décupla: la 1.2 es el precio. Dentro de una lista, una dirección no existe.
  assert.equal(q('REF("' + compra.id.slice(0, 8) + '", "1200000000")').texto, '12 EUR');
  const dentro = q('REF("' + menu.id.slice(0, 8) + '", "1100000000")');
  assert.equal(dentro.estado, 'PENDIENTE');
  assert.match(dentro.motivo, /cae dentro de la lista de la 1/);
  // Por índice, LOCAL sí entra en la lista; la 1.1 de la décupla es cuánto.
  assert.equal(q('LOCAL(3, 1)').texto, 'cocina');
  assert.equal(q('LOCAL(1, 1)').texto, '1');
  assert.equal(q('LOCAL(3)').texto, 'huesped · cocina'); // una lista se escribe con sus ocupantes
  assert.equal(consultar(eje, menu.id, [0], 'BUSCAR(1, 2)').valor.items.length, 1);
});
