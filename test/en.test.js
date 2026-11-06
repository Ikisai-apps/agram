import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Eje } from '../src/eje.js';
import { crearEvento, RAIZ, validarForma } from '../src/evento.js';
import { direccion } from '../src/btml.js';

const T0 = '2026-11-06T20:00:00Z';
const gastaT = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });

async function ejeBase() {
  return Eje.genesis({ identidad: 'raiz', emision: [{ token: 'T', escala: 'hora', cantidad: 10 }], foco: ['casa', ['menú']], t: T0 });
}

test('lo escrito va en el PV donde se escribe: en = posición del foco', async () => {
  const eje = await ejeBase();
  const g = eje.genesisId;
  const accion = await eje.escribir({ autor: 'raiz', sobre: g, en: direccion([4]), t: T0, movimientos: [gastaT('raiz')], payload: 'servir' });
  const futuro = await eje.escribir({ autor: 'raiz', sobre: g, en: direccion([7]), t: T0, movimientos: [gastaT('raiz')], payload: 'mañana' });
  const raiz = await eje.escribir({ autor: 'raiz', sobre: g, t: T0, movimientos: [gastaT('raiz')], payload: 'nota' });
  assert.equal(accion.en, '4000000000');
  assert.equal(raiz.en, RAIZ);
  assert.deepEqual(eje.sobre(g).map((e) => e.payload), ['servir', 'mañana', 'nota']);
  assert.deepEqual(eje.sobre(g, '4000000000').map((e) => e.payload), ['servir']);
  assert.deepEqual(eje.sobre(g, '7000000000').map((e) => e.payload), ['mañana']);
  assert.deepEqual(eje.sobre(g, RAIZ).map((e) => e.payload), ['nota']);
  assert.equal(eje.hilo(futuro.id).length, 2);
});

test('la posición forma parte del id', async () => {
  const base = { autor: 'a', sobre: 'g', t: T0, movimientos: [gastaT('a')], payload: 'x' };
  const a = await crearEvento({ ...base, en: direccion([1]) });
  const b = await crearEvento({ ...base, en: direccion([2]) });
  const c = await crearEvento({ ...base });
  assert.notEqual(a.id, b.id);
  assert.equal(c.en, RAIZ);
});

test('en inválido y génesis fuera de la raíz se rechazan', () => {
  const base = { autor: 'a', sobre: 'g', t: T0, movimientos: [gastaT('a')], payload: 'x' };
  assert.ok(validarForma({ ...base, en: '4' }).some((e) => /diez dígitos/.test(e)));
  assert.ok(validarForma({ ...base, sobre: null, en: '4000000000', contexto: { genesis: true },
    movimientos: [{ token: 'T', escala: 'hora', cantidad: 1, de: null, a: 'a' }] }).some((e) => /raíz/.test(e)));
});
