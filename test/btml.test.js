import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarPayload, direccion, resolver, esDireccion, esTerminal, indicesDe, ARIDAD, esLista, esDecupla, dentroDeLista } from '../src/btml.js';
import { crearEvento, canonico } from '../src/evento.js';

test('terminales: número, palabra, referencia', () => {
  assert.equal(esTerminal(3), true);
  assert.equal(esTerminal('menú'), true);
  assert.equal(esTerminal({ ref: 'abc' }), true);
  assert.equal(esTerminal({ ref: 'abc', dir: '1200000000' }), true);
  assert.equal(esTerminal(''), false);
  assert.equal(esTerminal(NaN), false);
  assert.equal(esTerminal({ ref: 'abc', dir: '12' }), false);
});

test('array válido: hasta diez posiciones, sin huecos, anidado', () => {
  assert.equal(validarPayload(['a', ['b', 2], { ref: 'x' }]).ok, true);
  assert.equal(validarPayload([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).ok, true);
});

test('array inválido: vacío, hueco, más de diez', () => {
  assert.equal(validarPayload([]).ok, false);
  const r = validarPayload(['a', null, 'c']);
  assert.equal(r.ok, false);
  assert.match(r.errores[0], /^1: hueco/);
  assert.equal(validarPayload(Array(11).fill(1)).ok, false);
  const anidado = validarPayload(['a', ['b', []]]);
  assert.equal(anidado.ok, false);
  assert.match(anidado.errores[0], /^11: array vacío/);
});

/**
 * Un array disperso con la longitud máxima de JavaScript y una sola posición
 * presente. Vigila cuántas posiciones se miran: si alguien recorre la longitud
 * en vez de rechazarla, falla al pasar de ARIDAD en lugar de colgarse.
 */
function dispersoEnorme() {
  const enorme = [];
  enorme.length = 2 ** 32 - 1;
  enorme[0] = 'x';
  let miradas = 0;
  const mira = (k) => {
    if (typeof k === 'string' && /^[0-9]+$/.test(k) && ++miradas > ARIDAD) throw new Error('recorre la longitud');
  };
  return new Proxy(enorme, {
    has: (t, k) => (mira(k), Reflect.has(t, k)),
    get: (t, k, r) => (mira(k), Reflect.get(t, k, r)),
  });
}

test('array disperso de longitud enorme: se rechaza por la longitud, sin recorrerlo', async () => {
  assert.deepEqual(validarPayload(dispersoEnorme()).errores, ['raíz: más de 10 posiciones']);
  // VG, 7-11 noche: por hojas. Bajo una posición, un array de más de diez puede
  // ser una lista; uno disperso no lo es: «hueco en la lista», contando sus
  // claves presentes y sin recorrer la longitud.
  assert.deepEqual(validarPayload(['a', dispersoEnorme()]).errores, ['1: hueco en la lista']);
  // Por crearEvento también: la copia del payload no recorre la longitud.
  const movimientos = [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'raiz', a: null }];
  await assert.rejects(
    crearEvento({ autor: 'raiz', sobre: 'f'.repeat(64), t: '2026-11-07T10:00:00Z', movimientos, payload: ['a', dispersoEnorme()] }),
    /payload 1: hueco en la lista/,
  );
});

test('direcciones: diez dígitos, ceros finales', () => {
  assert.equal(direccion([8, 4, 1, 2, 3]), '8412300000');
  assert.equal(direccion([]), '0000000000');
  assert.equal(esDireccion('8412300000'), true);
  assert.equal(esDireccion('841'), false);
  assert.throws(() => direccion([10]));
  assert.throws(() => direccion(Array(11).fill(0)));
});

test('1100000000 y 0000000011 no son equivalentes', () => {
  const p = [['x', 'y'], [['a'], ['b']]]; // la 1 es décupla: cada posición va entre corchetes
  assert.deepEqual(resolver(p, '1100000000'), ['b']);
  assert.equal(resolver(p, '0000000011'), undefined);
});

test('resolver desciende y se detiene en el terminal', () => {
  const p = ['raíz', ['uno', [['dos'], ['tres']]], 'fin']; // la 1.1 es décupla: cada posición va entre corchetes
  assert.deepEqual(resolver(p, '1110000000'), ['tres']);
  assert.equal(resolver(p, '2000000000'), 'fin');
  assert.deepEqual(resolver(p, '1000000000'), ['uno', [['dos'], ['tres']]]);
  assert.equal(resolver(p, '5000000000'), undefined);
});

test('indicesDe: ceros finales fuera, cero intermedio es índice real', () => {
  assert.deepEqual(indicesDe('8412300000'), [8, 4, 1, 2, 3]);
  assert.deepEqual(indicesDe('1010000000'), [1, 0, 1]);
  assert.deepEqual(indicesDe('0000000000'), []);
});

// Décupla y lista por hojas (VG, 7-11 noche: por hojas).

test('por hojas: solo hojas es lista; con un array dentro, décupla', () => {
  assert.equal(esLista(['a', 2, { ref: 'x' }]), true);
  assert.equal(esDecupla(['a', 2, { ref: 'x' }]), false);
  assert.equal(esLista([['a'], [2]]), false);
  assert.equal(esDecupla([['a'], [2]]), true);
  assert.equal(esLista([]), false);
  assert.equal(esLista('a'), false);
});

test('por hojas: la raíz es siempre décupla, aunque sean solo hojas', () => {
  // En la raíz, once hojas no son una lista: son once posiciones.
  assert.deepEqual(validarPayload(Array(11).fill('h')).errores, ['raíz: más de 10 posiciones']);
  // Y una dirección de la raíz entra en ella aunque solo tenga hojas.
  assert.equal(resolver(['a', 'b', 'c'], '2000000000'), 'c');
});

test('por hojas: una lista bajo una posición pasa de diez; una décupla no', () => {
  const doce = Array.from({ length: 12 }, (_, k) => 'h' + k);
  assert.equal(validarPayload(['Compra', doce]).ok, true);
  const once = [...Array.from({ length: 10 }, (_, k) => 'h' + k), ['dentro']];
  assert.deepEqual(validarPayload(['Compra', once]).errores.length, 1);
  assert.match(validarPayload(['Compra', once]).errores[0], /^1: más de 10 posiciones/);
});

test('por hojas: huecos y nulos en una lista se rechazan', () => {
  assert.match(validarPayload(['Compra', ['a', null, 'c']]).errores[0], /^11: hueco/);
  assert.match(validarPayload(['Compra', ['a', , 'c']]).errores[0], /^11: hueco/); // posición ausente
  const larga = Array.from({ length: 12 }, (_, k) => 'h' + k);
  larga[5] = null;
  assert.deepEqual(validarPayload(['Compra', larga]).errores, ['1: hueco en la lista']);
  delete larga[5];
  assert.deepEqual(validarPayload(['Compra', larga]).errores, ['1: hueco en la lista']);
});

test('por hojas: resolver no entra en una lista y la devuelve entera en su dirección', () => {
  const p = ['Compra', [['menú'], [1], ['EUR 12']], ['ensalada', 'guiso', 'fruta']];
  assert.deepEqual(resolver(p, '2000000000'), ['ensalada', 'guiso', 'fruta']);
  assert.equal(resolver(p, '2100000000'), undefined); // el «guiso» no tiene dirección
  assert.deepEqual(resolver(p, '1000000000'), [['menú'], [1], ['EUR 12']]);
  assert.deepEqual(resolver(p, '1100000000'), [1]); // en una décupla, sí: la lista de su único ocupante
  // 1.0 es la lista de uno [menú]: no se entra en ella.
  assert.equal(resolver(p, '1010000000'), undefined);
});

test('por hojas: dentroDeLista dice qué posición tiene la lista en la que cae un camino', () => {
  const p = ['Compra', [['menú'], [1], ['EUR 12']], ['ensalada', 'guiso', 'fruta']];
  assert.deepEqual(dentroDeLista(p, '2100000000'), [2]);
  assert.deepEqual(dentroDeLista(p, [1, 0, 0]), [1, 0]);
  assert.equal(dentroDeLista(p, '2000000000'), null); // la propia lista no cuenta
  assert.equal(dentroDeLista(p, '1100000000'), null); // por una décupla
  assert.equal(dentroDeLista(['a', 'b'], '1000000000'), null); // la raíz no es lista
});

test('por hojas: el hash es estable y distingue el orden de una lista', async () => {
  const movimientos = [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'raiz', a: null }];
  const base = { autor: 'raiz', sobre: 'f'.repeat(64), t: '2026-11-07T10:00:00Z', movimientos };
  const a = await crearEvento({ ...base, payload: ['Menú', ['ensalada', 'guiso', 'fruta']] });
  const otra = await crearEvento({ ...base, payload: ['Menú', ['ensalada', 'guiso', 'fruta']] });
  const b = await crearEvento({ ...base, payload: ['Menú', ['fruta', 'guiso', 'ensalada']] });
  assert.equal(a.id, otra.id);
  assert.notEqual(a.id, b.id);
  assert.equal(canonico(a.payload), canonico(['Menú', ['ensalada', 'guiso', 'fruta']]));
  assert.notEqual(canonico(a.payload), canonico(b.payload));
});
