import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validarMovimiento, claveToken, cantidadBase, partirClave, esIdRegistro, capacidadDe, franjaDe, familiaDe, TODAS_LAS_FRANJAS,
  SERIE, SEPARADOR_REGISTRO, CRITERIO_CAPACIDAD, ESCALAS_T, MAXIMO_ESCALAS_T, FAMILIAS, TIPOS, EMITEN,
} from '../src/tokens.js';

test('T: un token por escala, sin conversión entre escalas', () => {
  const m = { token: 'T', escala: 'hora', cantidad: 1, de: 'ana', a: null };
  assert.deepEqual(validarMovimiento(m), []);
  assert.equal(claveToken(m), 'T:hora');
  assert.equal(cantidadBase(m), 1); // una hora es una hora, no 3600 segundos
  assert.equal(claveToken({ token: 'T', escala: 'minuto', cantidad: 60 }), 'T:minuto');
  assert.notEqual(claveToken({ token: 'T', escala: 'minuto' }), claveToken({ token: 'T', escala: 'hora' }));
  assert.equal(cantidadBase({ token: 'T', escala: 'anio', cantidad: 1 }), 1);
  assert.deepEqual(ESCALAS_T, ['segundo', 'minuto', 'hora', 'dia', 'semana', 'ciclo', 'anio', 'pasado', 'futuro', 'inventado']);
  assert.ok(ESCALAS_T.length <= MAXIMO_ESCALAS_T); // tokens.js lanza al cargar si se pasa del tope
  assert.equal(MAXIMO_ESCALAS_T, 10);
});

test('T va en enteros: cada escala es un token (media hora serían minutos)', () => {
  assert.ok(validarMovimiento({ token: 'T', escala: 'hora', cantidad: 0.5, de: 'ana', a: null }).some((e) => /T va en enteros/.test(e)));
  assert.ok(validarMovimiento({ token: 'T', escala: 'hora', cantidad: 2 ** 53, de: 'ana', a: null }).some((e) => /T va en enteros/.test(e)));
  assert.deepEqual(validarMovimiento({ token: 'T', escala: 'minuto', cantidad: 30, de: 'ana', a: null }), []);
  // La forma admite fracciones en E; el eje solo las acepta en las series declaradas divisibles (R2, VG 7-11 noche).
  assert.deepEqual(validarMovimiento({ token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 12.5, de: 'ana', a: 'cocina' }), []);
});

test('la constante: cada familia es una serie; E es del emisor como R', () => {
  assert.deepEqual(Object.keys(SERIE).sort(), [...FAMILIAS].sort());
  assert.deepEqual(SERIE, { T: ['escala'], E: ['emisor', 'denominacion', 'registro'], P: ['ambito'], R: ['emisor'] });
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

test('tipos de identidad: solo las personas emiten (VG, 7-11 noche; antes, personas y grupos)', () => {
  assert.deepEqual(TIPOS, ['persona', 'grupo', 'cosa']);
  assert.deepEqual(EMITEN, ['persona']);
});

test('movimientos inválidos', () => {
  assert.ok(validarMovimiento({ token: 'Z', cantidad: 1, de: 'a', a: 'b' }).length);
  assert.ok(validarMovimiento({ token: 'T', cantidad: 0, escala: 'hora', de: 'a', a: 'b' }).length);
  assert.ok(validarMovimiento({ token: 'T', cantidad: 1, escala: 'mes', de: 'a', a: 'b' }).length);
  assert.ok(validarMovimiento({ token: 'E', emisor: 'a', denominacion: 'EUR', cantidad: 1, de: null, a: null }).length);
  assert.ok(validarMovimiento({ token: 'E', emisor: 'a', denominacion: 'EUR', cantidad: 1, de: 'a' }).length);
  assert.ok(validarMovimiento({ token: 'E', emisor: 'a', denominacion: 'EUR', cantidad: Infinity, de: 'a', a: 'b' }).length);
});

test('los separadores de las claves de serie están reservados', () => {
  assert.ok(validarMovimiento({ token: 'E', denominacion: 'EUR', emisor: 'casa', cantidad: 1, de: 'a|b', a: 'c' }).some((e) => /no puede llevar/.test(e)));
  assert.ok(validarMovimiento({ token: 'E', denominacion: 'x/y', emisor: 'casa', cantidad: 1, de: 'casa', a: 'c' }).some((e) => /no puede llevar/.test(e)));
  assert.ok(validarMovimiento({ token: 'P', ambito: 'a:b', cantidad: 1, de: 'casa', a: 'c' }).some((e) => /no puede llevar/.test(e)));
});

test('E atada al registro (R2): la clave lleva el registro tras la última «@» y se parte sin ambigüedad', () => {
  const reg = 'ab'.repeat(32); // un id de evento: 64 hexadecimales
  const m = { token: 'E', emisor: 'casa', denominacion: 'cama-2@2026-11-13', registro: reg, cantidad: 1, de: 'casa', a: 'bea' };
  assert.deepEqual(validarMovimiento(m), []);
  assert.equal(SEPARADOR_REGISTRO, '@');
  assert.equal(claveToken(m), 'E:casa/cama-2@2026-11-13@' + reg);
  assert.deepEqual(partirClave(claveToken(m)), { token: 'E', serie: 'casa/cama-2@2026-11-13@' + reg, emisor: 'casa', denominacion: 'cama-2@2026-11-13', registro: reg });
  // Sin registro la clave es la de siempre, y la '@' de la denominación no se toma por registro.
  assert.equal(claveToken({ ...m, registro: undefined }), 'E:casa/cama-2@2026-11-13');
  assert.equal(partirClave('E:casa/cama-2@2026-11-13').registro, undefined);
  // Ida y vuelta, con y sin registro, también con '@' dentro de la denominación.
  for (const d of ['EUR', 'a@b', 'x@' + 'f'.repeat(63), 'cama@2026-11-13']) {
    for (const r of [undefined, reg]) {
      const p = partirClave(claveToken({ token: 'E', emisor: 'e', denominacion: d, registro: r }));
      assert.equal(p.denominacion, d);
      assert.equal(p.registro, r);
    }
  }
  assert.ok(esIdRegistro(reg));
  assert.ok(!esIdRegistro('AB'.repeat(32)) && !esIdRegistro('ab') && !esIdRegistro(null));
});

test('E atada al registro (R2): forma del registro, divisible y emisores', () => {
  const reg = '0123456789abcdef'.repeat(4);
  const emite = (extra) => ({ token: 'E', emisor: 'casa', denominacion: 'cama', cantidad: 1, de: null, a: 'casa', ...extra });
  assert.deepEqual(validarMovimiento(emite({ registro: reg, divisible: true, emisores: ['casa', 'bea'] })), []);
  assert.ok(validarMovimiento(emite({ registro: 'casa' })).some((e) => /registro de E es el id de un evento/.test(e)));
  assert.ok(validarMovimiento(emite({ registro: reg.toUpperCase() })).some((e) => /registro de E es el id de un evento/.test(e)));
  // Una denominación que acabase en '@<id>' se confundiría con el registro.
  assert.ok(validarMovimiento(emite({ denominacion: 'cama@' + reg })).some((e) => /esa cola es la del registro/.test(e)));
  assert.ok(validarMovimiento(emite({ divisible: false })).some((e) => /divisible solo admite true/.test(e)));
  assert.ok(validarMovimiento(emite({ emisores: ['casa'] })).some((e) => /dos o más identidades/.test(e)));
  assert.ok(validarMovimiento(emite({ emisores: ['casa', 'casa'] })).some((e) => /dos o más identidades/.test(e)));
  assert.ok(validarMovimiento(emite({ emisores: ['ana', 'bea'] })).some((e) => /incluye al emisor de la serie/.test(e)));
  assert.ok(validarMovimiento(emite({ emisores: ['casa', 'b/c'] })).some((e) => /no puede llevar/.test(e)));
  // divisible y emisores son del contrato: solo en la emisión. El registro va en todo movimiento de la serie.
  assert.ok(validarMovimiento({ ...emite({ divisible: true }), de: 'casa', a: 'bea' }).some((e) => /solo en la emisión de E/.test(e)));
  assert.deepEqual(validarMovimiento({ ...emite({ registro: reg }), de: 'casa', a: 'bea' }), []);
  const valor = { registro: reg, divisible: true, emisores: ['a', 'b'] };
  for (const campo of ['registro', 'divisible', 'emisores']) {
    assert.ok(validarMovimiento({ token: 'R', emisor: 'a', cantidad: 1, de: 'a', a: 'b', [campo]: valor[campo] }).includes(campo + ' solo en E'));
  }
});

test('franja de una denominación (tras su última «@», texto opaco) y familia de una serie (la franja «*»)', () => {
  const reg = 'cd'.repeat(32);
  assert.deepEqual(['cama-2@2026-11-13', 'a@b@turno-3', 'EUR', '@x', 'x@'].map(franjaDe), ['2026-11-13', 'turno-3', '', 'x', '']);
  assert.equal(TODAS_LAS_FRANJAS, '*');
  assert.equal(familiaDe('E:casa/cama-2@2026-11-13@' + reg), 'E:casa/cama-2@*@' + reg);
  assert.equal(familiaDe('E:casa/EUR'), 'E:casa/EUR@*');
  assert.equal(familiaDe('T:hora'), 'T:hora');
  assert.ok(validarMovimiento({ token: 'E', emisor: 'casa', denominacion: 'cama@*', cantidad: 1, de: 'casa', a: 'b' }).some((e) => /franja reservada/.test(e)));
});

test('capacidad: un entero positivo en la posición 2 de una décupla (la plaza o el payload raíz de un registro)', () => {
  assert.equal(CRITERIO_CAPACIDAD, 2);
  assert.equal(capacidadDe(['plaza', 'EUR 30', 4]), 4);
  assert.equal(capacidadDe(['Alojamiento', ['camas'], 4]), 4);
  for (const x of [['a', 'b', 0], ['a', 'b', 2.5], ['a', 'b', '4'], ['a'], 'casa', null]) assert.equal(capacidadDe(x), undefined);
});
