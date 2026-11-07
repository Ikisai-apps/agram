import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decupla, render, sobrio } from '../src/pointed.js';
import { leerDireccion, PV } from '../src/epocas.js';

const ev = {
  id: 'abcdef0123456789',
  autor: 'raiz',
  t: '2026-11-06T20:00:00Z',
  sobre: null,
  // Por hojas (VG, 7-11 noche): la 1 es una décupla (su 0 va envuelto); la 2, una lista de uno.
  payload: ['Menú del día', [['menú'], 1, 'EUR 12'], ['sin gluten'], { ref: 'ffff0000aaaa', dir: '3000000000' }],
};

test('décupla: diez posiciones con significado de época 0', () => {
  const d = decupla(ev);
  assert.equal(d.posiciones.length, 10);
  assert.deepEqual(d.posiciones.map((p) => p.significado), [...PV]);
  assert.equal(d.posiciones[0].contenido, 'Menú del día');
  assert.deepEqual(d.posiciones[1].contenido, [['menú'], 1, 'EUR 12']);
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
  assert.match(lineas[3], /^2 criterios\s+lista de 1: sin gluten$/);
  assert.match(lineas[4], /^3 comunicación\s+→ ffff0000:3000000000$/);
  assert.match(lineas[10], /^9 camino\s+—$/);
  assert.equal(render(decupla(ev)), texto);
  assert.throws(() => render(decupla(ev), 'animado'), /no disponible/);
});

test('leer dirección bajo época 0', () => {
  assert.deepEqual(
    leerDireccion('1200000000').map((x) => x.significado),
    ['recursos', 'con qué condición'],
  );
  assert.deepEqual(leerDireccion('0000000000'), []);
});

// VG, 7-11 noche (10.1): lo leído se cuenta por lo que hay; antes, una décupla contaba siempre diez.
test('décupla: alcance con los tres números de Pointed; cuenta las posiciones con contenido, no diez', () => {
  // 'Menú del día' 1 + [['menú'], 1, 'EUR 12'] 3 + ['sin gluten'] 1 + la referencia 1 = 6.
  assert.deepEqual(decupla(ev).alcance, { conseguido: 6, minimo: 1, maximo: 10, alMinimo: true });
  assert.deepEqual(decupla({ ...ev, payload: 42 }).alcance, { conseguido: 1, minimo: 1, maximo: 10, alMinimo: true }); // un terminal, una
  assert.deepEqual(decupla({ ...ev, payload: ['a', 'b', 'c'] }).alcance.conseguido, 3); // una décupla con tres posiciones, tres
  assert.equal(decupla(ev).corte, null);
  assert.deepEqual(decupla(ev).avisos, []);
});

// VG, 7-11 noche (10.2): todos cortan duro, Pointed también, con el aviso de Scened.
test('décupla: corta duro en diez posiciones con contenido, por índice, con el aviso arriba y abajo', () => {
  const doce = Array.from({ length: 12 }, (_, i) => 'ocupante ' + (i + 1));
  // Bajo una posición (profundidad 1): una lista de doce ocupantes; entran los diez primeros por llegada.
  const l = decupla({ ...ev, payload: doce }, 'época 0', 1);
  assert.deepEqual(l.alcance, { conseguido: 10, minimo: 1, maximo: 10, alMinimo: true });
  assert.deepEqual(l.lista, doce.slice(0, 10));
  assert.deepEqual(l.posiciones.map((p) => p.contenido), doce.slice(0, 10));
  assert.deepEqual(l.corte, { maximo: 10, conseguido: 10, necesario: 12, cortadas: [] }); // las diez posiciones entran enteras: lo cortado son los ocupantes 11 y 12
  assert.equal(l.avisos[0], 'Pointed corta en su máximo (10 posiciones): entran sus 10 primeras posiciones con contenido, por índice; la lista trae 12 ocupantes y entran los 10 primeros por llegada. Trae 10 de 12 posiciones.');
  // En la raíz: la 0 trae uno y la 1 una lista de doce; entran la 0 y los nueve primeros de la 1, y lo demás queda fuera.
  const r = decupla({ ...ev, payload: ['Cena', doce, 'postre'] });
  assert.deepEqual(r.alcance.conseguido, 10);
  assert.deepEqual(r.posiciones[1].contenido, doce.slice(0, 9));
  assert.equal(r.posiciones[1].cortada, true);
  assert.equal(r.posiciones[2].contenido, undefined); // no entra nada
  assert.equal(r.posiciones[2].cortada, true);
  assert.equal(r.posiciones[0].cortada, undefined);
  assert.deepEqual(r.corte, { maximo: 10, conseguido: 10, necesario: 14, cortadas: [1, 2] });
  assert.match(r.avisos[0], /quedan cortadas las 1, 2\. Trae 10 de 14 posiciones\.$/);
  const lineas = render(r).split('\n');
  assert.equal(lineas[1], 'aviso: ' + r.avisos[0]); // arriba
  assert.equal(lineas.at(-1), 'aviso: ' + r.avisos[0]); // y abajo
  assert.match(lineas[3], /^1 .* \(cortada\)$/);
  // Leer no muta el registro.
  assert.equal(doce.length, 12);
});
