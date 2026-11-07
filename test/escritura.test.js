import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejemploCompra } from '../ejemplos/ikisai/compra-food.mjs';
import { desdePointed, desdeSequenced, desdeMapped, escribirDesde, escribirSalida, alcanceDeRegistro, proporcionDeRegistro, item, resolverRef, costeT } from '../src/escritura.js';
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
  assert.deepEqual(payload[4], [['pagado'], 'servido a las 14:05']); // VG, 7-11 noche: por hojas; la salida de Mapped es una décupla: su 0 va envuelto
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

// VG, 7-11 noche: la proporción propone, el máximo manda (decisión 10.3; antes, la proporción rechazaba).
test('la proporción propone y se avisa; el máximo del modo manda y rechaza', async () => {
  const { eje, compra } = await ejemploCompra();
  const T = '2026-11-07T14:00:00Z';
  // Fuera de la proporción, pero dentro del máximo: se escribe, y el aviso lo dice.
  const dos = await escribirDesde(eje, { modo: 'pointed', autor: 'huesped', sobre: compra.id, payload: ['a', 'b'], t: T });
  assert.deepEqual(proporcionDeRegistro(dos), {
    posiciones: 2, rango: [1, 1], estado: 'por encima',
    aviso: 'Pointed propone escribir 1 posición (la proporción sobre lo leído); esto tiene 2, por encima. No es error: la proporción propone, el máximo (10) manda.',
  });
  const grande = Array(10).fill(Array(3).fill('x'));
  const s = await escribirDesde(eje, { modo: 'sequenced', autor: 'huesped', sobre: compra.id, payload: grande, t: T });
  assert.equal(s.movimientos[0].cantidad, 30);
  assert.equal(proporcionDeRegistro(s).estado, 'por encima');
  const ev = await escribirDesde(eje, { modo: 'mapped', autor: 'huesped', sobre: compra.id, payload: grande, t: T });
  assert.equal(ev.movimientos[0].cantidad, 30);
  assert.match(proporcionDeRegistro(ev).aviso, /^Mapped propone escribir de 250 a 333 posiciones .*esto tiene 30, por debajo\./);
  // Dentro de la proporción, sin aviso.
  assert.equal(proporcionDeRegistro(await escribirDesde(eje, { modo: 'pointed', autor: 'huesped', sobre: compra.id, payload: 'servido', t: T })).aviso, null);
  // El máximo manda: 30 > 10 en Pointed se rechaza, con el mensaje del tope.
  await assert.rejects(
    escribirDesde(eje, { modo: 'pointed', autor: 'huesped', sobre: compra.id, payload: grande, t: T }),
    /^Error: Pointed emite como mucho 10 posiciones; este registro tiene 30$/,
  );
  // El tope duro también donde no hay proporción (Scened).
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

test('emitir por debajo del mínimo del modo se admite y se informa con los tres números (VG, 7-11 noche)', async () => {
  const { eje, compra } = await ejemploCompra();
  const T = '2026-11-07T14:00:00Z';
  // Pointed: un terminal llega al mínimo (1).
  const p = await escribirDesde(eje, { modo: 'pointed', autor: 'huesped', sobre: compra.id, payload: 'servido', t: T });
  assert.deepEqual(alcanceDeRegistro(p), { conseguido: 1, minimo: 1, maximo: 10, alMinimo: true });
  // Sequenced: tres posiciones, por debajo de 10; se escribe igual.
  const s = await escribirDesde(eje, { modo: 'sequenced', autor: 'huesped', sobre: compra.id, payload: ['a', 'b', 'c'], t: T });
  assert.equal(eje.obtener(s.id), s);
  assert.deepEqual(alcanceDeRegistro(s), { conseguido: 3, minimo: 10, maximo: 100, alMinimo: false });
  // Mapped con la salida entera: lo heredado no se emite y no cuenta; el alcance va en el resultado.
  const celdas = [];
  celdas[2] = ['sin lactosa'];
  const salida = desdeMapped(eje, celdas, compra.id);
  assert.deepEqual(salida.heredadas, [0, 1]);
  const r = await escribirSalida(eje, { modo: 'mapped', autor: 'huesped', sobre: compra.id, salida, t: T });
  assert.deepEqual(r.alcance, { conseguido: 1, minimo: 100, maximo: 1000, alMinimo: false });
  assert.deepEqual(alcanceDeRegistro(r.registro), r.alcance);
  // Scened: sin proporción, el mínimo (1000) solo se dice; el máximo sigue siendo duro.
  const sc = await escribirDesde(eje, { modo: 'scened', autor: 'huesped', sobre: compra.id, payload: ['x', 'y'], t: T });
  assert.deepEqual(alcanceDeRegistro(sc), { conseguido: 2, minimo: 1000, maximo: 10000, alMinimo: false });
  assert.throws(() => alcanceDeRegistro(eje.obtener(compra.id)), /no dice desde qué modo/);
});
