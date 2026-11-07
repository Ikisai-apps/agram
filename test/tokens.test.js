import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarMovimiento, claveToken, cantidadBase, partirClave, SERIE, ESCALAS_T, MAXIMO_ESCALAS_T, FAMILIAS, TIPOS, EMITEN } from '../src/tokens.js';

test('T: un token por escala, sin conversión entre escalas', () => {
  const m = { token: 'T', escala: 'hora', cantidad: 1, de: 'ana', a: null };
  assert.deepEqual(validarMovimiento(m), []);
  assert.equal(claveToken(m), 'T:hora');
  assert.equal(cantidadBase(m), 1); // una hora es una hora, no 3600 segundos
  assert.equal(claveToken({ token: 'T', escala: 'minuto', cantidad: 60 }), 'T:minuto');
  assert.notEqual(claveToken({ token: 'T', escala: 'minuto' }), claveToken({ token: 'T', escala: 'hora' }));
  assert.equal(cantidadBase({ token: 'T', escala: 'anio', cantidad: 1 }), 1);
  assert.deepEqual(ESCALAS_T, ['segundo', 'minuto', 'hora', 'dia', 'semana', 'ciclo', 'anio']);
  assert.ok(ESCALAS_T.length <= MAXIMO_ESCALAS_T); // tokens.js lanza al cargar si se pasa del tope
  assert.equal(MAXIMO_ESCALAS_T, 10);
});

test('T va en enteros: cada escala es un token (media hora serían minutos)', () => {
  assert.ok(validarMovimiento({ token: 'T', escala: 'hora', cantidad: 0.5, de: 'ana', a: null }).some((e) => /T va en enteros/.test(e)));
  assert.ok(validarMovimiento({ token: 'T', escala: 'hora', cantidad: 2 ** 53, de: 'ana', a: null }).some((e) => /T va en enteros/.test(e)));
  assert.deepEqual(validarMovimiento({ token: 'T', escala: 'minuto', cantidad: 30, de: 'ana', a: null }), []);
  // E sigue admitiendo fracciones (céntimos): [X] decidir VG.
  assert.deepEqual(validarMovimiento({ token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 12.5, de: 'ana', a: 'cocina' }), []);
});

test('la constante: cada familia es una serie; E es del emisor como R', () => {
  assert.deepEqual(Object.keys(SERIE).sort(), [...FAMILIAS].sort());
  assert.deepEqual(SERIE, { T: ['escala'], E: ['emisor', 'denominacion'], P: ['ambito'], R: ['emisor'] });
  const claves = [
    claveToken({ token: 'T', escala: 'dia' }),
    claveToken({ token: 'E', emisor: 'casa', denominacion: 'cama-2@2026-11-13' }),
    claveToken({ token: 'P', ambito: 'genesis' }),
    claveToken({ token: 'R', emisor: 'casa' }),
  ];
  assert.deepEqual(claves, ['T:dia', 'E:casa/cama-2@2026-11-13', 'P:genesis', 'R:casa']);
  // La misma denominación de dos emisores son dos series.
  assert.notEqual(claveToken({ token: 'E', emisor: 'casaA', denominacion: 'EUR' }), claveToken({ token: 'E', emisor: 'casaB', denominacion: 'EUR' }));
  // partirClave es la inversa: devuelve los campos de la serie.
  assert.deepEqual(partirClave('E:casa/cama-2@2026-11-13'), { token: 'E', serie: 'casa/cama-2@2026-11-13', emisor: 'casa', denominacion: 'cama-2@2026-11-13' });
  assert.deepEqual(partirClave('E:casa/a/b:c'), { token: 'E', serie: 'casa/a/b:c', emisor: 'casa', denominacion: 'a/b:c' }); // la denominación puede llevar '/' y ':'
  assert.deepEqual(partirClave('T:hora'), { token: 'T', serie: 'hora', escala: 'hora' });
  assert.deepEqual(partirClave('P:genesis'), { token: 'P', serie: 'genesis', ambito: 'genesis' });
  assert.deepEqual(partirClave('R:casa'), { token: 'R', serie: 'casa', emisor: 'casa' });
});

test('E: denominación y emisor siempre; la emisión va a su propio emisor', () => {
  const m = { token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 12, de: 'ana', a: 'cocina' };
  assert.deepEqual(validarMovimiento(m), []); // E es fungible dentro de su serie: la mueve quien la tiene
  assert.equal(claveToken(m), 'E:casa/EUR');
  assert.ok(validarMovimiento({ token: 'E', emisor: 'casa', cantidad: 1, de: 'ana', a: 'bea' }).some((e) => /E exige denominación/.test(e)));
  assert.ok(validarMovimiento({ token: 'E', denominacion: 'EUR', cantidad: 1, de: 'ana', a: 'bea' }).some((e) => /E exige emisor/.test(e)));
  assert.ok(validarMovimiento({ token: 'E', emisor: 'ca/sa', denominacion: 'EUR', cantidad: 1, de: 'ana', a: 'bea' }).some((e) => /no lleva «\/»/.test(e)));
  // Emisión: de = null, a = el emisor (como R). Para darla a otro se mueve después.
  assert.deepEqual(validarMovimiento({ token: 'E', emisor: 'casa', denominacion: 'cama', cantidad: 4, de: null, a: 'casa' }), []);
  assert.ok(validarMovimiento({ token: 'E', emisor: 'casa', denominacion: 'cama', cantidad: 1, de: null, a: 'huesped' }).some((e) => /emisión de E va a su propio emisor/.test(e)));
  assert.ok(validarMovimiento({ token: 'T', escala: 'hora', cantidad: 1, de: 'casa', a: 'bea', denominacion: 'EUR' }).some((e) => /denominación solo en E/.test(e)));
});

test('P exige ámbito; R exige emisor y no es fungible', () => {
  assert.ok(validarMovimiento({ token: 'P', cantidad: 1, de: 'a', a: 'b' }).some((e) => /ámbito/.test(e)));
  assert.deepEqual(validarMovimiento({ token: 'P', cantidad: 1, de: 'a', a: 'b', ambito: 'genesis' }), []);
  assert.equal(claveToken({ token: 'P', ambito: 'abc' }), 'P:abc');
  assert.ok(validarMovimiento({ token: 'R', cantidad: 1, de: 'a', a: 'b' }).some((e) => /emisor/.test(e)));
  assert.deepEqual(validarMovimiento({ token: 'R', cantidad: 1, de: 'a', a: 'b', emisor: 'a' }), []);
  assert.ok(validarMovimiento({ token: 'R', cantidad: 1, de: 'b', a: 'c', emisor: 'a' }).some((e) => /no es fungible/.test(e)));
  assert.ok(validarMovimiento({ token: 'R', cantidad: 1, de: null, a: 'b', emisor: 'a' }).some((e) => /emisión de R va a su propio emisor/.test(e)));
  assert.deepEqual(validarMovimiento({ token: 'R', cantidad: 1, de: null, a: 'a', emisor: 'a' }), []);
  assert.equal(claveToken({ token: 'R', emisor: 'a' }), 'R:a');
  assert.ok(validarMovimiento({ token: 'E', emisor: 'a', denominacion: 'EUR', cantidad: 1, de: 'a', a: 'b', ambito: 'x' }).some((e) => /ámbito solo en P/.test(e)));
  assert.ok(validarMovimiento({ token: 'P', cantidad: 1, de: 'a', a: 'b', ambito: 'genesis', emisor: 'a' }).some((e) => /emisor solo en E y en R/.test(e)));
});

test('tipos de identidad: solo personas y grupos emiten', () => {
  assert.deepEqual(TIPOS, ['persona', 'grupo', 'cosa']);
  assert.deepEqual(EMITEN, ['persona', 'grupo']);
});

test('movimientos inválidos', () => {
  assert.ok(validarMovimiento({ token: 'Z', cantidad: 1, de: 'a', a: 'b' }).length);
  assert.ok(validarMovimiento({ token: 'T', cantidad: 0, escala: 'hora', de: 'a', a: 'b' }).length);
  assert.ok(validarMovimiento({ token: 'T', cantidad: 1, escala: 'mes', de: 'a', a: 'b' }).length);
  assert.ok(validarMovimiento({ token: 'E', emisor: 'a', denominacion: 'EUR', cantidad: 1, de: null, a: null }).length);
  assert.ok(validarMovimiento({ token: 'E', emisor: 'a', denominacion: 'EUR', cantidad: 1, de: 'a' }).length);
  assert.ok(validarMovimiento({ token: 'E', emisor: 'a', denominacion: 'EUR', cantidad: Infinity, de: 'a', a: 'b' }).length);
});
