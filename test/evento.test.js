import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonico, crearEvento, verificarId, validarForma, esConsumoT } from '../src/evento.js';

const T = { token: 'T', escala: 'minuto', cantidad: 1, de: 'ana', a: null };

test('canónico ordena claves y es estable', () => {
  assert.equal(canonico({ b: 1, a: [2, { d: 'x', c: null }] }), '{"a":[2,{"c":null,"d":"x"}],"b":1}');
});

test('crear evento: id es hash del cuerpo, inmutable', async () => {
  const ev = await crearEvento({ autor: 'ana', sobre: 'g', t: '2026-11-06T20:00:00Z', movimientos: [T], payload: 'hola' });
  assert.match(ev.id, /^[0-9a-f]{64}$/);
  assert.equal(await verificarId(ev), true);
  assert.equal(Object.isFrozen(ev), true);
  const ev2 = await crearEvento({ autor: 'ana', sobre: 'g', t: '2026-11-06T20:00:00Z', movimientos: [T], payload: 'hola' });
  assert.equal(ev.id, ev2.id);
  const ev3 = await crearEvento({ autor: 'ana', sobre: 'g', t: '2026-11-06T20:00:00Z', movimientos: [T], payload: 'adiós' });
  assert.notEqual(ev.id, ev3.id);
});

test('todo evento mueve tokens y el autor CONSUME T (VG, 7-11 noche)', () => {
  const base = { autor: 'ana', sobre: 'g', t: '2026-11-06T20:00:00Z', payload: 'x' };
  assert.ok(validarForma({ ...base, movimientos: [] }).some((e) => /mueve tokens/.test(e)));
  const soloE = [{ token: 'E', emisor: 'ana', denominacion: 'EUR', cantidad: 1, de: 'ana', a: 'bea' }];
  assert.ok(validarForma({ ...base, movimientos: soloE }).some((e) => /escribir consume T del autor/.test(e)));
  const ajeno = [{ token: 'T', escala: 'hora', cantidad: 1, de: 'bea', a: null }];
  assert.ok(validarForma({ ...base, movimientos: ajeno }).some((e) => /escribir consume T del autor/.test(e)));
  assert.deepEqual(validarForma({ ...base, movimientos: [T] }), []);
  // Ni dárselo a sí misma ni bloquearlo o liberarlo cuenta: no cuesta nada.
  const aSiMisma = [{ token: 'T', escala: 'hora', cantidad: 1, de: 'ana', a: 'ana' }];
  assert.ok(validarForma({ ...base, movimientos: aSiMisma }).some((e) => /escribir consume T del autor/.test(e)));
  const bloqueo = [{ ...aSiMisma[0], estado: 'bloqueo', salida: 's' }];
  assert.ok(validarForma({ ...base, movimientos: bloqueo }).some((e) => /escribir consume T del autor/.test(e)));
  assert.deepEqual([esConsumoT(T, 'ana'), esConsumoT(aSiMisma[0], 'ana'), esConsumoT(bloqueo[0], 'ana'), esConsumoT(T, 'bea')], [true, false, false, false]);
});

// «T no cruza de persona» (VG, 7-11 noche) depende de qué es quien lo recibe (una persona sí da su T a una cosa;
// Core, 8-11), así que no es de forma: lo dicen las reglas del ciclo (test/t-consumido.test.js).
test('la forma no decide si T cruza de persona: no sabe de qué tipo es quien lo recibe', () => {
  const base = { autor: 'ana', sobre: 'g', t: '2026-11-06T20:00:00Z', payload: 'x' };
  assert.deepEqual(validarForma({ ...base, movimientos: [T, { token: 'T', escala: 'hora', cantidad: 2, de: 'ana', a: 'bea' }] }), []);
  // Y un evento guardado con la versión 2 se valida con las reglas de entonces: bastaba con que el autor moviese T.
  assert.deepEqual(validarForma({ ...base, movimientos: [{ token: 'T', escala: 'hora', cantidad: 1, de: 'ana', a: 'bea' }] }, { v2: true }), []);
  assert.deepEqual(validarForma({ ...base, movimientos: [{ token: 'T', escala: 'hora', cantidad: 1, de: 'ana', a: 'bea' }] }, { tLaxo: true }), []);
  assert.ok(validarForma({ ...base, movimientos: [{ token: 'T', escala: 'hora', cantidad: 1, de: 'ana', a: 'bea' }] }).some((e) => /escribir consume T del autor/.test(e)));
});

test('payload inválido rechazado al crear', async () => {
  await assert.rejects(
    crearEvento({ autor: 'ana', sobre: 'g', t: '2026-11-06T20:00:00Z', movimientos: [T], payload: ['a', null] }),
    /hueco/,
  );
});
