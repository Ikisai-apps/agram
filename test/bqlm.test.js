// El BQL mínimo (src/bqlm.js): el analizador, cada operación del léxico, los
// tres estados y los errores claros. El contexto es el del eje
// (src/contexto-eje.js), aquí sin eje: solo payloads y despliegues.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analizar, evaluar, evaluarRegla, rellenar, textoDe, ESTADOS, PALABRAS, PRIMITIVAS, LIMITES, SIMBOLOS, NADIE, esSimbolo } from '../src/bqlm.js';
import { ContextoEje } from '../src/contexto-eje.js';

/** Un payload de prueba, leído como `epoch` (datos inventados). */
const P = [
  'Lista de la compra', // 0
  ['pan', 'leche', 'huevos'], // 1 una lista de tres ocupantes
  [[2], [3], [12]], // 2 una décupla: 2.0, 2.1, 2.2
  [[['pan'], [2]], [['leche'], [1]], [['huevos'], [12]]], // 3 tres décuplas: 3.k.0 qué, 3.k.1 cuánto
  ['12 EUR'], // 4 una magnitud (D-VALOR)
  ['2026-11-09T10:30:00Z'], // 5 un instante (D-FECHA)
  ['T:minuto', 'E:casa/EUR', 'P:genesis', 'R:casa'], // 6 cuatro claves de serie escritas como texto (B3: ya no se despliegan)
];

/** Una transacción candidata de prueba, fuera de cualquier eje. */
const EV = {
  autor: 'ana',
  sobre: null,
  t: '2026-11-09T10:30:00Z',
  movimientos: [
    { token: 'T', escala: 'minuto', cantidad: 3, de: 'ana', a: null },
    { token: 'E', emisor: 'ana', denominacion: 'EUR', cantidad: 10, de: null, a: 'ana' },
    { token: 'E', emisor: 'ana', denominacion: 'EUR', cantidad: 4, de: 'ana', a: 'bea' },
  ],
  payload: ['Prueba'],
};

const ctx = new ContextoEje(null, { epoch: P, ev: EV });
const val = (src, c = ctx) => {
  const r = evaluar(src, c);
  assert.equal(r.estado, 'RESUELTO', src + ': ' + r.motivo);
  return r.valor;
};
const uno = (src, c) => {
  const v = val(src, c);
  assert.equal(v.length, 1, src + ' da ' + v.length);
  return v[0];
};
const estado = (src, c = ctx) => evaluar(src, c);
const falla = (src, re, c = ctx) => {
  const r = estado(src, c);
  assert.equal(r.estado, 'ERROR', src + ' → ' + r.estado + ' ' + (r.texto ?? r.motivo));
  if (re) assert.match(r.motivo, re, src);
};
const espera = (src, re, c = ctx) => {
  const r = estado(src, c);
  assert.equal(r.estado, 'PENDIENTE', src + ' → ' + r.estado + ' ' + (r.texto ?? r.motivo));
  if (re) assert.match(r.motivo, re, src);
};

test('léxico: tres estados, las palabras cortas y las cinco primitivas', () => {
  assert.deepEqual(ESTADOS, ['RESUELTO', 'PENDIENTE', 'ERROR']);
  assert.deepEqual(PALABRAS, ['first', 'last', 'nth', 'each', 'where', 'up', 'down', 'path', 'count', 'sum', 'max', 'min', 'floor', 'and', 'or', 'not', 'in']);
  assert.deepEqual(PRIMITIVAS, ['mint', 'transfer', 'lock', 'release', 'burn']);
  assert.equal(LIMITES.hilo, 10);
});

test('literales: números, textos y símbolos, que se leen por su nombre pero no son texto', () => {
  assert.equal(uno('42'), 42);
  assert.equal(uno('2.5'), 2.5);
  assert.equal(uno('"hola \\"tú\\""'), 'hola "tú"');
  for (const s of ['mint', 'transfer', 'lock', 'release', 'burn', 'E', 'P', 'R', 'T']) {
    assert.equal(uno(s), SIMBOLOS[s]);
    assert.ok(esSimbolo(uno(s)) && Object.isFrozen(uno(s)));
    assert.equal(evaluar(s, ctx).texto, s, 'se lee por su nombre');
  }
  assert.equal(uno('burn = burn'), true);
  assert.equal(uno('T = "T"'), false, 'un texto no es el símbolo (SEG-09)');
  assert.equal(esSimbolo(NADIE), true);
  assert.equal(esSimbolo({ simbolo: 'burn' }), false, 'un objeto que lo imita no es el símbolo');
  assert.equal(uno('=1 + 1'), 2, 'el «=» de fórmula se admite');
});

test('aritmética: + - * / floor y el signo', () => {
  assert.equal(uno('1 + 2 * 3'), 7);
  assert.equal(uno('(1 + 2) * 3'), 9);
  assert.equal(uno('7 / 2'), 3.5);
  assert.equal(uno('floor (7 / 2)'), 3);
  assert.equal(uno('floor 7 / 2'), 3.5, 'floor es prefija: floor 7, y luego / 2');
  assert.equal(uno('-3 + 1'), -2);
  assert.equal(uno('10 - 4 - 3'), 3, 'por la izquierda');
  falla('1 / 0', /división por cero/);
  falla('"a" + 1', /\+ espera un número/);
});

test('comparación: = != < <= > >=; solo se ordenan números', () => {
  assert.equal(uno('2 < 3'), true);
  assert.equal(uno('3 <= 3'), true);
  assert.equal(uno('3 > 3'), false);
  assert.equal(uno('3 >= 3'), true);
  assert.equal(uno('"a" = "a"'), true);
  assert.equal(uno('"a" != "b"'), true);
  assert.equal(uno('1 = "1"'), false, 'tipos distintos no son iguales');
  falla('"a" < "b"', /espera un número/);
  falla('1 < 2 < 3', /comparaciones encadenadas/);
});

test('lógica: and, or y not, perezosos; in', () => {
  assert.equal(uno('1 = 2 and 1 / 0 = 1'), false, 'and no mira el segundo si el primero es falso');
  assert.equal(uno('1 = 1 or 1 / 0 = 1'), true, 'or no mira el segundo si el primero es verdadero');
  falla('1 = 1 and 1 / 0 = 1', /división por cero/);
  assert.equal(uno('not 1 = 2'), true);
  assert.equal(uno('not not 1 = 1'), true);
  falla('1 and 1 = 1', /and espera verdadero o falso/);
  assert.equal(uno('"leche" in epoch.1'), true);
  assert.equal(uno('"vino" in epoch.1'), false);
  assert.equal(uno('epoch.9 in epoch.1'), false, 'nada no está en ninguna lista');
});

test('posiciones: una posición da sus ocupantes por llegada; una lista de uno vale como su elemento (G3)', () => {
  assert.deepEqual(val('epoch.0'), ['Lista de la compra']);
  assert.deepEqual(val('epoch.1'), ['pan', 'leche', 'huevos']);
  assert.deepEqual(val('epoch.2.1'), [3]);
  assert.equal(uno('epoch.2.1 + 1'), 4);
  assert.deepEqual(val('epoch.3.1.0'), ['leche']);
  assert.deepEqual(val('epoch.9'), [], 'lo que no se escribió está vacío');
  falla('epoch.1 = "pan"', /lista de 3.*first, last, nth/);
  falla('epoch.2 = 1', /una décupla no tiene valor/);
  // Una expresión entre paréntesis también se lee por posición, y each es lo mismo que el punto.
  assert.deepEqual(val('(epoch.3).1.1'), [1]);
  assert.deepEqual(val('epoch.6 each 0'), val('epoch.6.0'));
  assert.deepEqual(val('epoch.6 each 0'), [], 'una clave escrita como texto no se despliega (B3): la serie es un registro');
  assert.deepEqual(val('ev.1.0.0.0'), [SIMBOLOS.T, SIMBOLOS.E, SIMBOLOS.E], 'la serie de un movimiento sí: su 0.0 es la familia');
});

test('índice por valor: un dígito es esa posición; un texto, los ocupantes que se llaman así', () => {
  assert.deepEqual(val('epoch.3.(1).0'), ['leche']);
  assert.deepEqual(val('epoch.3.(2 - 1).1'), [1]);
  assert.deepEqual(val('epoch.6.("T:minuto")'), ['T:minuto'], 'el ocupante que vale «T:minuto»');
  assert.deepEqual(val('ev.1.("T:minuto").0.0.1'), [1], 'y la serie del movimiento que se llama así: su escala, minuto');
  assert.deepEqual(val('epoch.1.("leche")'), ['leche']);
  assert.deepEqual(val('ev.1.("E:ana/EUR").1'), [10, 4], 'un movimiento se llama como su serie (su 0)');
  falla('epoch.3.(10)', /dígito 0-9/);
  falla('epoch.3.(1.5)', /dígito 0-9/);
  falla('epoch.3.(1 = 1)', /un dígito o un texto/);
});

test('listas: first, last, nth (desde 0), count, sum, max, min', () => {
  assert.deepEqual(val('first epoch.1'), ['pan']);
  assert.deepEqual(val('last epoch.1'), ['huevos']);
  assert.deepEqual(val('nth 1 epoch.1'), ['leche']);
  assert.deepEqual(val('nth 5 epoch.1'), []);
  falla('nth 1.5 epoch.1', /entero/);
  assert.equal(uno('count epoch.1'), 3);
  assert.equal(uno('count epoch.9'), 0);
  assert.equal(uno('sum (ev.1 each 1)'), 17);
  assert.equal(uno('max (ev.1 each 1)'), 10);
  assert.equal(uno('min (ev.1 each 1)'), 3);
  assert.equal(uno('sum epoch.9'), 0, 'la suma de nada es 0');
  assert.deepEqual(val('max epoch.9'), [], 'el máximo de nada es nada');
  falla('sum epoch.1', /sum espera números/);
});

test('where: it es el elemento; en un where anidado, it2; where se lleva lo que queda a su derecha', () => {
  assert.deepEqual(val('epoch.1 where it != "leche"'), ['pan', 'huevos']);
  assert.equal(uno('count (ev.1 where it.4 = burn)'), 1);
  assert.equal(uno('count (ev.1 where it.0.0.0 = E and it.4 = transfer)'), 1);
  assert.deepEqual(val('(ev.1 where it.0.0.0 = E) each 0.0.2'), ['EUR', 'EUR']);
  // Anidado: para cada movimiento, cuántos movimientos tienen su misma serie.
  assert.deepEqual(val('(ev.1 where count (ev.1 where it2.0 = it.0) = 2) each 1'), [10, 4]);
  // Encadenado: el segundo where filtra lo que dejó el primero.
  assert.deepEqual(val('epoch.1 where it != "pan" where it != "leche"'), ['huevos']);
  falla('it', /it solo vale dentro de where/);
  falla('epoch.1 where it2 = 1', /it2 solo vale dentro de un where anidado/);
  falla('epoch.1 where it', /where espera verdadero o falso/);
});

test('vacío: = y != comparan nada; la aritmética y el orden con nada quedan PENDIENTE', () => {
  assert.equal(uno('epoch.9 = 1'), false);
  assert.equal(uno('epoch.9 != 1'), true);
  assert.equal(uno('epoch.9 = epoch.8'), true);
  espera('epoch.9 + 1', /vacía, falta un valor/);
  espera('epoch.9 < 1', /vacía/);
  espera('floor epoch.9', /vacía/);
});

test('ERROR claro: lo que no es BQL mínimo, funciones con nombre y sintaxis', () => {
  falla('FILTRAR(epoch.1, 1)', /no es BQL mínimo: «FILTRAR» \(no hay funciones con nombre\)/);
  falla('LOCAL(1)', /no es BQL mínimo/);
  falla('put 1 at epoch.1', /no es BQL mínimo: «put»/);
  falla('día', /no es BQL mínimo: «día»/);
  falla('it1', /no es BQL mínimo/);
  falla('1 +', /sintaxis: falta una expresión/);
  falla('(1 + 2', /se esperaba «\)»/);
  falla('ev.', /se esperaba un dígito/);
  falla('ev.12', /un solo dígito.*1\.2/);
  falla('"abc', /carácter inesperado/);
  falla('1 2', /sobra/);
  falla('where 1', /fuera de sitio/);
  falla('"texto".1', /una posición se lee de ev, epoch, before, it/);
  falla('', /expresión vacía/);
  assert.throws(() => analizar('FOO'), (e) => e.estado === 'ERROR' && /no es BQL mínimo/.test(e.message));
  assert.equal(analizar('ev.1.0').n, 'paso');
});

test('PENDIENTE: un nombre que el contexto no tiene, y los límites de cálculo', () => {
  const sinNada = new ContextoEje(null);
  espera('ev.1', /no hay ev/, sinNada);
  espera('epoch.1', /no hay epoch/, sinNada);
  espera('before.3', /no hay before/, sinNada);
  const r = evaluar('count (epoch.1 where it != "x")', ctx, { limites: { pasos: 3 } });
  assert.equal(r.estado, 'PENDIENTE');
  assert.match(r.motivo, /límite de cálculo/);
  espera('1' + ' + (1'.repeat(120) + ')'.repeat(120), /límite de cálculo/);
});

test('textoDe y rellenar: cómo se lee un valor y un mensaje con {posiciones}', () => {
  assert.equal(textoDe([], ctx), '∅');
  assert.equal(evaluar('epoch.1', ctx).texto, 'pan, leche, huevos');
  assert.equal(evaluar('1 = 1', ctx).texto, 'true');
  assert.equal(rellenar('{first epoch.1} y {count epoch.1} cosas; {epoch.9}; {1 / 0}', ctx), 'pan y 3 cosas; ∅; {1 / 0: ERROR}');
});

test('evaluarRegla: la condición del 2; si no se cumple, el mensaje del 9 con sus posiciones', () => {
  const regla = (cond, mensaje = 'faltan {3 - count epoch.1} cosas') => [['prueba'], [3], [cond], ['ev.3'], ['burn'], ['*'], ['prueba'], ['epoch 0'], ['first'], [mensaje]];
  assert.deepEqual(evaluarRegla(regla('=count epoch.1 >= 3'), ctx), { pasa: true, estado: 'RESUELTO', motivo: null });
  assert.deepEqual(evaluarRegla(regla('=count epoch.1 >= 6'), ctx), { pasa: false, estado: 'RESUELTO', motivo: 'faltan 0 cosas' });
  assert.equal(evaluarRegla(regla('=epoch.9 + 1 = 2'), ctx).estado, 'PENDIENTE');
  assert.equal(evaluarRegla(regla('=epoch.9 + 1 = 2'), ctx).pasa, false);
  assert.match(evaluarRegla(regla('=count epoch.1'), ctx).motivo, /no da verdadero o falso/);
  assert.match(evaluarRegla(regla('count epoch.1 >= 3'), ctx).motivo, /su 2 no es una condición/);
  assert.match(evaluarRegla(regla('=FOO'), ctx).motivo, /prueba: ERROR: no es BQL mínimo/);
});
