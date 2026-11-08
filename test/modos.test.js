import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  lectura, escritura, contarPosiciones, cabeEscritura, maximo, minimo, tope, cabeTope, alcanceDe, nombreModo, MODOS,
  contenido, recortar, admitir, avisoCorte, orden, minimoDe, maximoDe, ordenDeEscala, ORDENES_DE_ESCALA,
} from '../src/modos.js';
import { ESCALAS_T, ESCALAS_REALES } from '../src/tokens.js';

test('lectura por modo: una, diez, cien, mil décuplas', () => {
  assert.equal(lectura('pointed'), 10);
  assert.equal(lectura('sequenced'), 100);
  assert.equal(lectura('mapped'), 1000);
  assert.equal(lectura('scened'), 10000);
});

test('escritura por modo según la proporción de VG', () => {
  assert.deepEqual(escritura('pointed'), [1, 1]);
  assert.deepEqual(escritura('sequenced'), [10, 20]);
  assert.deepEqual(escritura('mapped'), [250, 333]);
  assert.equal(escritura('scened'), null);
});

test('contar posiciones: cada terminal cuenta una, anidado incluido', () => {
  assert.equal(contarPosiciones('x'), 1);
  assert.equal(contarPosiciones(['a', ['b', 'c'], { ref: 'r' }]), 4);
  assert.equal(contarPosiciones([[[1, 2], 3], 4]), 4);
});

test('cabe como escritura del modo', () => {
  assert.equal(cabeEscritura('una palabra', 'pointed'), true);
  assert.equal(cabeEscritura(['a', 'b'], 'pointed'), false);
  assert.equal(cabeEscritura(Array(20).fill('x').slice(0, 10).map((x, i) => (i < 5 ? [x, x] : x)), 'sequenced'), true);
  assert.equal(cabeEscritura(Array(10).fill(['a', 'b', 'c']), 'sequenced'), false);
  assert.equal(cabeEscritura(Array(10).fill(['a', 'b', 'c']), 'scened'), true);
});

// VG, 7-11 noche: tres números por modo; el máximo es el mismo para representar y para emitir.
test('máximo y mínimo por modo (VG, 7-11 noche): Pointed 1/10, Sequenced 10/100, Mapped 100/1000, Scened 1000/10000, Be sin mínimo/todos', () => {
  assert.deepEqual(Object.keys(MODOS).map(maximo), [10, 100, 1000, 10000, Infinity]);
  assert.deepEqual(Object.keys(MODOS).map(minimo), [1, 10, 100, 1000, null]);
  for (const m of Object.keys(MODOS)) {
    assert.equal(lectura(m), maximo(m), m); // lectura y tope son alias de maximo
    assert.equal(tope(m), maximo(m), m);
  }
  assert.equal(nombreModo('be'), 'Be');
  assert.equal(escritura('be'), null); // proporción de Be sin fijar
  const cienMil = Array(10).fill(Array(10).fill(Array(10).fill(Array(10).fill(Array(10).fill('z')))));
  assert.equal(cabeTope(cienMil, 'scened'), false);
  assert.equal(cabeTope(cienMil, 'be'), true); // Be: todos
  assert.throws(() => maximo('otro'), /modo desconocido: otro/);
  assert.throws(() => minimo('otro'), /modo desconocido: otro/);
});

test('alcanceDe: lo conseguido, el mínimo y el máximo; no llegar al mínimo se dice, no se rechaza', () => {
  assert.deepEqual(alcanceDe(7, 'sequenced'), { conseguido: 7, minimo: 10, maximo: 100, alMinimo: false });
  assert.deepEqual(alcanceDe(10, 'sequenced'), { conseguido: 10, minimo: 10, maximo: 100, alMinimo: true });
  assert.deepEqual(alcanceDe(0, 'pointed'), { conseguido: 0, minimo: 1, maximo: 10, alMinimo: false });
  // VG, 7-11 noche (10.4): Be no tiene mínimo propio; responde exactamente lo que se le pide.
  assert.deepEqual(alcanceDe(5, 'be'), { conseguido: 5, pedido: 5, maximo: Infinity, alMinimo: true });
  assert.deepEqual(alcanceDe(5, 'be', { pedido: 8 }), { conseguido: 5, pedido: 8, maximo: Infinity, alMinimo: true });
  assert.throws(() => alcanceDe(5, 'be', { pedido: -1 }), /pedido inválido/);
  for (const n of [-1, 1.5, '3', NaN]) assert.throws(() => alcanceDe(n, 'mapped'), /conseguido inválido/);
});

// VG, 7-11 noche (10.1): lo leído se cuenta por lo que hay.
test('contenido: cada posición con contenido una, un terminal una, una lista uno por ocupante; una décupla no cuenta diez', () => {
  assert.equal(contenido('x'), 1); // un terminal
  assert.equal(contenido(42), 1);
  assert.equal(contenido({ ref: 'abc', dir: '1000000000' }), 1); // una referencia es un terminal
  assert.equal(contenido(['a', 'b', 'c']), 3); // una décupla con tres posiciones
  const doce = Array.from({ length: 12 }, (_, i) => 'ocupante ' + i);
  assert.equal(contenido(doce), 12); // una lista de doce ocupantes
  assert.equal(contenido(['Cena', doce]), 13);
  assert.equal(contenido(['a', ['b', 'c'], { ref: 'r' }]), 4); // anidado: lo que hay, a cualquier profundidad
  assert.equal(contenido(undefined), 0);
  assert.equal(contenido(null), 0);
  assert.equal(contarPosiciones(['a', ['b', 'c']]), contenido(['a', ['b', 'c']])); // el nombre de antes, alias
  // La emisión cuenta igual: lo emitido por su contenido real, sin las heredadas.
  assert.equal(cabeTope(Array(10).fill('x'), 'pointed'), true);
  assert.equal(cabeTope(['x', doce], 'pointed'), false);
  assert.equal(cabeTope(['x', doce], 'pointed', [0, 1, 2]), true);
});

test('recortar: entran las primeras posiciones con contenido por índice; lo que queda es un prefijo sin huecos', () => {
  const doce = Array.from({ length: 12 }, (_, i) => 'o' + i);
  assert.deepEqual(recortar(['a', 'b'], 10), { payload: ['a', 'b'], conseguido: 2, necesario: 2, cortado: false });
  assert.deepEqual(recortar(doce, 10), { payload: doce.slice(0, 10), conseguido: 10, necesario: 12, cortado: true });
  assert.deepEqual(recortar(['a', ['b', 'c', 'd'], 'e'], 3), { payload: ['a', ['b', 'c']], conseguido: 3, necesario: 5, cortado: true });
  assert.deepEqual(recortar(['a', [['b', 'c'], 'd'], 'e'], 2), { payload: ['a', [['b']]], conseguido: 2, necesario: 5, cortado: true });
  assert.deepEqual(recortar('x', 0), { payload: undefined, conseguido: 0, necesario: 1, cortado: true });
  assert.equal(recortar(doce, Infinity).cortado, false);
  assert.equal(doce.length, 12); // no muta
  for (const max of [-1, 1.5, NaN]) assert.throws(() => recortar('x', max), /máximo inválido/);
});

test('admitir y avisoCorte: piezas enteras en orden hasta el máximo, y el mismo aviso en todos los modos', () => {
  assert.deepEqual(admitir([3, 4, 5], 10), { entran: 2, conseguido: 7, necesario: 12, cortado: true });
  assert.deepEqual(admitir([3, 4, 3], 10), { entran: 3, conseguido: 10, necesario: 10, cortado: false });
  assert.deepEqual(admitir([11, 1], 10), { entran: 0, conseguido: 0, necesario: 12, cortado: true }); // nada entra a medias
  assert.deepEqual(admitir([], 10), { entran: 0, conseguido: 0, necesario: 0, cortado: false });
  assert.equal(avisoCorte('pointed', 10, 12), 'Pointed corta en su máximo (10 posiciones). Trae 10 de 12 posiciones.');
  assert.equal(avisoCorte('sequenced', 100, 120, 'quedan fuera 2'), 'Sequenced corta en su máximo (100 posiciones): quedan fuera 2. Trae 100 de 120 posiciones.');
  assert.throws(() => avisoCorte('be', 1, 2), /Be no corta: representa todos/); // Be no corta
});

// VG, 7-11 noche («T, corregido por VG», punto 4): órdenes de magnitud como medida general.
test('orden: el n tal que 10^(n−1) < posiciones ≤ 10^n; 0 → 0, 1 → 1', () => {
  const casos = [[0, 0], [1, 1], [2, 1], [10, 1], [11, 2], [100, 2], [101, 3], [1000, 3], [1001, 4], [10000, 4], [10001, 5], [10 ** 7, 7], [10 ** 7 + 1, 8]];
  for (const [p, n] of casos) assert.equal(orden(p), n, String(p));
  for (const p of [-1, 1.5, NaN, Infinity, '3']) assert.throws(() => orden(p), /posiciones inválidas/);
  assert.deepEqual([0, 1, 2, 3, 4, 7].map(minimoDe), [0, 1, 10, 100, 1000, 10 ** 6]);
  assert.deepEqual([0, 1, 2, 3, 4, 7].map(maximoDe), [0, 10, 100, 1000, 10000, 10 ** 7]);
  for (const n of [-1, 1.5, 16, Infinity]) {
    assert.throws(() => minimoDe(n), /orden inválido/);
    assert.throws(() => maximoDe(n), /orden inválido/);
  }
  // Cada orden n ≥ 1 va de su mínimo (exclusivo, salvo el 1) a su máximo.
  for (let n = 1; n <= 7; n++) assert.equal(orden(maximoDe(n)), n);
});

test('los modos se expresan por su orden: Pointed 1, Sequenced 2, Mapped 3, Scened 4, Be del quinto en adelante', () => {
  assert.deepEqual(Object.keys(MODOS).map((m) => MODOS[m].orden), [1, 2, 3, 4, 5]);
  for (const m of ['pointed', 'sequenced', 'mapped', 'scened']) {
    assert.equal(minimo(m), minimoDe(MODOS[m].orden), m);
    assert.equal(maximo(m), maximoDe(MODOS[m].orden), m);
    assert.equal(orden(maximo(m)), MODOS[m].orden, m);
  }
  assert.equal(maximo('be'), Infinity);
  assert.equal(minimo('be'), null); // no aplica: Be responde lo que se le pide (VG, 7-11 noche)
  assert.equal(orden(maximo('scened') + 1), MODOS.be.orden); // Be empieza donde acaba Scened
});

test('ordenDeEscala: segundo 1, minuto 2, hora 3, día 4, semana 5, ciclo 6, año 7, solo informativa; pasado, futuro e inventado, sin orden', () => {
  assert.deepEqual(ESCALAS_T.map(ordenDeEscala), [1, 2, 3, 4, 5, 6, 7, null, null, null]);
  assert.deepEqual(Object.keys(ORDENES_DE_ESCALA), [...ESCALAS_REALES]); // las mismas escalas reales que tokens.js, en su orden
  assert.equal(ordenDeEscala('segundo'), 1);
  assert.equal(ordenDeEscala('dia'), 4);
  assert.equal(ordenDeEscala('anio'), 7);
  for (const e of ['día', 'mes', '', undefined, 'toString']) assert.throws(() => ordenDeEscala(e), /escala T desconocida/);
});
