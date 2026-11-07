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
  assert.equal(eje.saldoT('huesped', 'minuto'), 480 - 1); // gasta minutos; sus horas no se tocan
  assert.equal(eje.saldoT('huesped', 'hora'), 23);
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

test('Mapped ancla en su posición lo que el foco no puede heredar, en vez de rechazarlo', async () => {
  const { eje, compra } = await ejemploCompra();
  const celdas = [];
  celdas[7] = ['más tarde'];
  const { payload, anclados } = desdeMapped(eje, celdas, compra.id);
  assert.equal(payload, null); // nada cabe dentro: el foco no tiene 5 ni 6
  assert.deepEqual(anclados, [{ celda: [7, 0, 0], en: '7000000000', payload: 'más tarde', faltan: ['5', '6'] }]);
  assert.throws(() => desdeMapped(eje, [], compra.id), /vacía/);
});

test('la proporción del modo se respeta, como antes, y además el tope duro', async () => {
  const { eje, compra } = await ejemploCompra();
  // La proporción rechaza como antes del 7-11 ([X] decidir VG si rechaza o solo informa).
  await assert.rejects(
    escribirDesde(eje, { modo: 'pointed', autor: 'huesped', sobre: compra.id, payload: ['a', 'b'], t: '2026-11-07T14:00:00Z' }),
    /^Error: pointed escribe como mucho 1 posiciones; este registro tiene 2$/,
  );
  const grande = Array(10).fill(Array(3).fill('x'));
  await assert.rejects(
    escribirDesde(eje, { modo: 'sequenced', autor: 'huesped', sobre: compra.id, payload: grande, t: '2026-11-07T14:00:00Z' }),
    /^Error: sequenced escribe como mucho 20 posiciones; este registro tiene 30$/,
  );
  const ev = await escribirDesde(eje, { modo: 'mapped', autor: 'huesped', sobre: compra.id, payload: grande, t: '2026-11-07T14:00:00Z' });
  assert.equal(ev.movimientos[0].cantidad, 30);
  // La proporción se mira primero: el mensaje es el de siempre aunque también se pase el tope (30 > 10 en Pointed), como en main.
  await assert.rejects(
    escribirDesde(eje, { modo: 'pointed', autor: 'huesped', sobre: compra.id, payload: grande, t: '2026-11-07T14:00:00Z' }),
    /^Error: pointed escribe como mucho 1 posiciones; este registro tiene 30$/,
  );
  // Además, el tope duro: decide donde la proporción no rechaza (Scened no tiene proporción).
  const diezMilUno = [Array(10).fill(Array(10).fill(Array(10).fill(Array(10).fill('z')))), 'una más'];
  await assert.rejects(
    escribirDesde(eje, { modo: 'scened', autor: 'huesped', sobre: compra.id, payload: diezMilUno, t: '2026-11-07T14:00:00Z' }),
    /^Error: Scened emite como mucho 10000 posiciones; este registro tiene 10001$/,
  );
  await assert.rejects(
    escribirDesde(eje, { modo: 'otro', autor: 'huesped', sobre: compra.id, payload: 'x', t: '2026-11-07T14:00:00Z' }),
    /^Error: modo desconocido: otro$/,
  );
});
