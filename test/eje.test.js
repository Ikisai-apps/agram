import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Eje } from '../src/eje.js';
import { crearEvento } from '../src/evento.js';

const T0 = '2026-11-06T20:00:00Z';

async function ejeBase() {
  return Eje.genesis({
    identidad: 'raiz',
    emision: [
      { token: 'T', escala: 'hora', cantidad: 100 },
      { token: 'E', denominacion: 'EUR', cantidad: 50 },
    ],
    foco: 'mundo de prueba',
    t: T0,
  });
}

const gastaT = (de, cantidad = 1) => ({ token: 'T', escala: 'hora', cantidad, de, a: null });

test('génesis: emite a la primera identidad y fija el foco raíz', async () => {
  const eje = await ejeBase();
  const g = eje.obtener(eje.genesisId);
  assert.equal(g.sobre, null);
  assert.equal(g.contexto.genesis, true);
  assert.equal(g.payload, 'mundo de prueba');
  assert.equal(eje.saldoT('raiz', 'hora'), 100);
  assert.equal(eje.saldo('raiz', 'E:EUR'), 50);
  assert.deepEqual(eje.identidades(), ['raiz']);
});

test('escribir sobre el foco mueve tokens y crea identidades al recibir', async () => {
  const eje = await ejeBase();
  const ev = await eje.escribir({
    autor: 'raiz',
    sobre: eje.genesisId,
    t: T0,
    movimientos: [gastaT('raiz'), { token: 'T', escala: 'hora', cantidad: 10, de: 'raiz', a: 'cocina' }],
    payload: ['alta de cocina'],
  });
  assert.equal(eje.saldoT('raiz', 'hora'), 89);
  assert.equal(eje.saldoT('cocina', 'hora'), 10);
  assert.equal(eje.saldoT('cocina', 'minuto'), 600);
  assert.deepEqual(eje.identidades(), ['raiz', 'cocina']);
  assert.deepEqual(eje.hilo(ev.id).map((e) => e.id), [ev.id, eje.genesisId]);
  assert.equal(eje.sobre(eje.genesisId).length, 1);
});

test('rechazos: foco desconocido, autor desconocido, emisión, saldo, duplicado', async () => {
  const eje = await ejeBase();
  const base = { autor: 'raiz', sobre: eje.genesisId, t: T0, payload: 'x' };
  await assert.rejects(eje.escribir({ ...base, sobre: 'nadie', movimientos: [gastaT('raiz')] }), /foco desconocido/);
  await assert.rejects(eje.escribir({ ...base, autor: 'bea', movimientos: [gastaT('bea')] }), /autor desconocido/);
  await assert.rejects(
    eje.escribir({ ...base, movimientos: [gastaT('raiz'), { token: 'E', denominacion: 'EUR', cantidad: 1, de: null, a: 'raiz' }] }),
    /solo el génesis emite/,
  );
  await assert.rejects(eje.escribir({ ...base, movimientos: [gastaT('raiz', 1000)] }), /saldo insuficiente/);
  await assert.rejects(eje.escribir({ ...base, movimientos: [{ token: 'T', escala: 'hora', cantidad: 1, de: 'raiz', a: 'raiz' }, gastaT('raiz')] }).then(() => eje.escribir({ ...base, movimientos: [{ token: 'T', escala: 'hora', cantidad: 1, de: 'raiz', a: 'raiz' }, gastaT('raiz')] })), /ya registrado/);
});

test('nadie puede fingir un segundo génesis', async () => {
  const eje = await ejeBase();
  await assert.rejects(
    eje.escribir({ autor: 'bea', sobre: eje.genesisId, t: T0, payload: 'x', contexto: { genesis: true },
      movimientos: [{ token: 'T', escala: 'hora', cantidad: 1, de: 'raiz', a: 'bea' }] }),
    /ya hay génesis/,
  );
});

test('un evento con id manipulado se rechaza', async () => {
  const eje = await ejeBase();
  const ev = await crearEvento({ autor: 'raiz', sobre: eje.genesisId, t: T0, movimientos: [gastaT('raiz')], payload: 'x' });
  const falso = { ...ev, payload: 'y' };
  await assert.rejects(eje.anadir(falso), /id no corresponde/);
});

test('hilo encadenado por referencia, no por orden temporal', async () => {
  const eje = await ejeBase();
  const a = await eje.escribir({ autor: 'raiz', sobre: eje.genesisId, t: T0, movimientos: [gastaT('raiz')], payload: 'a' });
  const b = await eje.escribir({ autor: 'raiz', sobre: eje.genesisId, t: T0, movimientos: [gastaT('raiz')], payload: 'b' });
  const c = await eje.escribir({ autor: 'raiz', sobre: a.id, t: T0, movimientos: [gastaT('raiz')], payload: 'c' });
  assert.deepEqual(eje.hilo(c.id).map((e) => e.payload), ['c', 'a', 'mundo de prueba']);
  assert.deepEqual(eje.hilo(b.id).map((e) => e.payload), ['b', 'mundo de prueba']);
});
