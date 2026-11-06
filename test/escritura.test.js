import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejemploCompra } from '../ejemplos/ikisai/compra-food.mjs';
import { desdePointed, desdeSequenced, desdeMapped, escribirDesde, item, resolverRef, costeT } from '../src/escritura.js';
import { resolver } from '../src/btml.js';

test('ítems: texto, número y referencia por prefijo', async () => {
  const { eje, menu } = await ejemploCompra();
  assert.equal(item(eje, ' hola '), 'hola');
  assert.equal(item(eje, '12.5'), 12.5);
  assert.deepEqual(item(eje, '@' + menu.id.slice(0, 8)), { ref: menu.id });
  assert.deepEqual(item(eje, '@' + menu.id.slice(0, 8) + ':1000000000'), { ref: menu.id, dir: '1000000000' });
  assert.throws(() => resolverRef(eje, '@zzzz'), /desconocida/);
  assert.throws(() => resolverRef(eje, '@ab'), /corta/);
  assert.throws(() => item(eje, '  '), /vacío/);
});

test('Pointed escribe un terminal y mueve un minuto', async () => {
  const { eje, compra } = await ejemploCompra();
  const p = desdePointed(eje, 'servido');
  const ev = await escribirDesde(eje, { modo: 'pointed', autor: 'huesped', sobre: compra.id, en: '4000000000', payload: p, t: '2026-11-07T14:00:00Z' });
  assert.equal(ev.payload, 'servido');
  assert.equal(ev.en, '4000000000');
  assert.equal(ev.contexto.modo, 'pointed');
  assert.equal(ev.movimientos[0].cantidad, 1);
  assert.equal(eje.saldoT('huesped', 'minuto'), 23 * 60 - 1);
});

test('Sequenced escribe una hilera sin huecos, hasta diez', async () => {
  const { eje, compra, menu } = await ejemploCompra();
  const h = desdeSequenced(eje, ['llegar', '@' + menu.id.slice(0, 8), '3', '', '']);
  assert.deepEqual(h, ['llegar', { ref: menu.id }, 3]);
  assert.throws(() => desdeSequenced(eje, ['a', '', 'c']), /hueco en la posición 1/);
  assert.throws(() => desdeSequenced(eje, ['', '']), /vacía/);
  assert.throws(() => desdeSequenced(eje, Array(11).fill('x')), /más de 10/);
  const ev = await escribirDesde(eje, { modo: 'sequenced', autor: 'huesped', sobre: compra.id, payload: h, t: '2026-11-07T14:00:00Z' });
  assert.equal(ev.movimientos[0].cantidad, 3);
  assert.equal(costeT(h), 3);
});

test('Mapped escribe una décupla y hereda del foco por referencia las celdas vacías', async () => {
  const { eje, compra } = await ejemploCompra();
  const celdas = [];
  celdas[2] = ['sin lactosa'];
  celdas[4] = ['pagado', 'servido a las 14:05'];
  const { payload, heredadas } = desdeMapped(eje, celdas, compra.id);
  assert.deepEqual(heredadas, [0, 1, 3]);
  assert.equal(payload.length, 5);
  assert.deepEqual(payload[0], { ref: compra.id, dir: '0000000000' });
  assert.equal(payload[2], 'sin lactosa');
  assert.deepEqual(payload[3], { ref: compra.id, dir: '3000000000' });
  assert.deepEqual(payload[4], ['pagado', 'servido a las 14:05']);
  // Resolver la herencia devuelve el contenido del foco sin copiarlo.
  assert.deepEqual(resolver(eje.obtener(compra.id).payload, payload[3].dir), ['huesped', 'cocina']);
});

test('Mapped rechaza huecos que el foco no puede heredar', async () => {
  const { eje, compra } = await ejemploCompra();
  const celdas = [];
  celdas[7] = ['más tarde'];
  assert.throws(() => desdeMapped(eje, celdas, compra.id), /hueco en 5/);
  assert.throws(() => desdeMapped(eje, [], compra.id), /vacía/);
});

test('la proporción del modo se respeta', async () => {
  const { eje, compra } = await ejemploCompra();
  await assert.rejects(
    escribirDesde(eje, { modo: 'pointed', autor: 'huesped', sobre: compra.id, payload: ['a', 'b'], t: '2026-11-07T14:00:00Z' }),
    /pointed escribe como mucho 1/,
  );
  const grande = Array(10).fill(Array(3).fill('x'));
  await assert.rejects(
    escribirDesde(eje, { modo: 'sequenced', autor: 'huesped', sobre: compra.id, payload: grande, t: '2026-11-07T14:00:00Z' }),
    /sequenced escribe como mucho 20/,
  );
  const ev = await escribirDesde(eje, { modo: 'mapped', autor: 'huesped', sobre: compra.id, payload: grande, t: '2026-11-07T14:00:00Z' });
  assert.equal(ev.movimientos[0].cantidad, 30);
});
