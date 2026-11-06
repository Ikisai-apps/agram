import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejemploCompra, ejemploCuenta } from '../ejemplos/ikisai/compra-food.mjs';
import { banda, ejeTemporal, comparar, HITOS, medir } from '../src/tiempo.js';
import { consolidar } from '../src/motor.js';

const gastaT = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });

test('bandas: la escala más pequeña que contiene la distancia', () => {
  assert.equal(banda(30), 'minuto');
  assert.equal(banda(-30), 'minuto');
  assert.equal(banda(3600 * 5), 'dia');
  assert.equal(banda(86400 * 10), 'ciclo');
  assert.equal(banda(86400 * 40), 'anio');
  assert.equal(banda(86400 * 400), 'mas');
});

test('eje temporal: pasado hacia atrás, futuro con proyecciones, consolidaciones y lo declarado', async () => {
  const { eje, compra, menu } = await ejemploCompra();
  const cuenta = await ejemploCuenta(eje, compra); // 14:10, pasado respecto a las 15:00
  const ahora = '2026-11-07T15:00:00Z';
  const viernes = await eje.escribir({ autor: 'huesped', sobre: compra.id, en: '7000000000', t: '2026-11-13T13:30:00Z', movimientos: [gastaT('huesped')], payload: 'repetir el viernes' });
  const c = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: '2026-11-07T14:30:00Z', elecciones: { 1: 'dos menús' } });
  const e = ejeTemporal(eje, compra.id, { ahora });
  assert.deepEqual(e.pasado.map((x) => x.id).slice(0, 3), [c.id, cuenta.id, menu.id]); // lo más cercano primero
  assert.equal(e.pasado[0].banda, 'hora');
  assert.equal(e.pasado[0].tipo, 'registro');
  assert.deepEqual(e.futuro.map((x) => x.tipo), ['consolidacion', 'proyeccion']);
  assert.equal(e.futuro[1].id, viernes.id);
  assert.equal(e.futuro[1].banda, 'semana'); // seis días
  assert.equal(e.futuro[0].id, c.id);
  assert.equal(e.futuro[0].estado, 'PENDIENTE DE AUTORIZACIÓN');
  // La propia consolidación es también un escrito pasado (14:30 < 15:00): no se duplica por id+tipo.
  assert.ok(e.pasado.some((x) => x.id === c.id && x.tipo === 'registro'));
});

test('lo declarado en la posición 7 aparece como futuro declarado', async () => {
  const { eje, compra } = await ejemploCompra();
  const ev = await eje.escribir({ autor: 'casa', sobre: compra.id, t: '2026-11-07T14:00:00Z', movimientos: [gastaT('casa')], payload: ['Plan', 'a', 'b', 'c', 'd', 'e', 'f', 'cena el sábado'] });
  const e = ejeTemporal(eje, ev.id, { ahora: '2026-11-07T15:00:00Z' });
  assert.equal(e.futuro[0].tipo, 'declarado');
  assert.equal(e.futuro[0].contenido, 'cena el sábado');
});

test('comparar: el foco frente a sus hermanos, sin nivel ni grado', async () => {
  const { eje, compra, alta } = await ejemploCompra();
  await ejemploCuenta(eje, compra);
  const hermana = await eje.escribir({ autor: 'casa', sobre: alta.id, t: '2026-11-07T10:00:00Z', movimientos: [gastaT('casa')], payload: 'nota breve' });
  // El menú y la nota son hermanos (ambos escritos sobre el alta). El menú tiene más posiciones y un escrito encima.
  const menu = eje.sobre(alta.id)[0];
  const c = comparar(eje, menu.id);
  assert.equal(c.de, 2);
  assert.equal(c.posicion, 1);
  assert.equal(c.comparables[1].id, hermana.id);
  assert.equal(c.hitos, HITOS);
  assert.equal(HITOS[9].nivel, '5.3');
  assert.deepEqual(medir(eje, hermana.id), { posiciones: 1, escritos: 0, movimientos: 1 });
  assert.equal(comparar(eje, eje.genesisId).de, 1);
});
