import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonico, crearEvento, verificarId, validarForma } from '../src/evento.js';

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

test('todo evento mueve tokens y el autor mueve T', () => {
  const base = { autor: 'ana', sobre: 'g', t: '2026-11-06T20:00:00Z', payload: 'x' };
  assert.ok(validarForma({ ...base, movimientos: [] }).some((e) => /mueve tokens/.test(e)));
  const soloE = [{ token: 'E', emisor: 'ana', denominacion: 'EUR', cantidad: 1, de: 'ana', a: 'bea' }];
  assert.ok(validarForma({ ...base, movimientos: soloE }).some((e) => /mover T/.test(e)));
  const ajeno = [{ token: 'T', escala: 'hora', cantidad: 1, de: 'bea', a: null }];
  assert.ok(validarForma({ ...base, movimientos: ajeno }).some((e) => /mover T/.test(e)));
  assert.deepEqual(validarForma({ ...base, movimientos: [T] }), []);
});

test('payload inválido rechazado al crear', async () => {
  await assert.rejects(
    crearEvento({ autor: 'ana', sobre: 'g', t: '2026-11-06T20:00:00Z', movimientos: [T], payload: ['a', null] }),
    /hueco/,
  );
});
