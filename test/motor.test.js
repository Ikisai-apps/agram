import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejemploCompra, ejemploCuenta } from '../ejemplos/ikisai/compra-food.mjs';
import { descubrir, consolidar, autorizar, ejecutar, estadoDe, consolidaciones, FABRICA } from '../src/motor.js';
import { evaluar } from '../src/bql.js';

const T = '2026-11-07T16:00:00Z';

test('descubrir: candidatos por posición de interacción, con fórmulas resueltas', async () => {
  const { eje, compra } = await ejemploCompra();
  const cuenta = await ejemploCuenta(eje, compra);
  const d = descubrir(eje, compra.id);
  assert.deepEqual(d.map((x) => x.posicion), [1, 2, 3, 4]);
  const p1 = d[0];
  assert.deepEqual(p1.candidatos.map((c) => c.origen), ['propio', 'propio', 'referencia', 'escrito']);
  assert.equal(p1.candidatos[3].evento, cuenta.id);
  assert.equal(p1.candidatos[3].texto, 'Cuenta del menú');
  assert.equal(d[3].candidatos.length, 2); // [4] y [4.0] colisionan
});

test('ciclo completo: consolidar → PENDIENTE DE AUTORIZACIÓN → autorizar → ejecutar con evidencia', async () => {
  const { eje, compra, menu } = await ejemploCompra();
  const cuenta = await ejemploCuenta(eje, compra);
  const d = descubrir(eje, compra.id);
  const c = await consolidar(eje, {
    autor: 'huesped', foco: compra.id, t: T, titulo: 'Pago del menú',
    elecciones: { 1: { candidato: d[0].candidatos[3] }, 2: 'sin lactosa', 4: 'pagar 14 EUR' },
  });
  assert.equal(c.en, FABRICA);
  assert.equal(c.contexto.fase, 'consolidado');
  assert.deepEqual(c.contexto.fuentes, [cuenta.id]);
  assert.equal(c.payload[0], 'Pago del menú');
  assert.deepEqual(c.payload[1], { ref: cuenta.id, dir: '0000000000' });
  assert.equal(c.payload[2], 'sin lactosa');
  assert.deepEqual(c.payload[3], { ref: compra.id, dir: '3000000000' }); // hueco heredado del foco
  assert.equal(c.payload[4], 'pagar 14 EUR');
  assert.equal(estadoDe(eje, c.id), 'PENDIENTE DE AUTORIZACIÓN');
  assert.equal(consolidaciones(eje, compra.id)[0].estado, 'PENDIENTE DE AUTORIZACIÓN');

  // Ejecutar sin autorización se rechaza.
  await assert.rejects(ejecutar(eje, { autor: 'huesped', consolidacion: c.id, t: T }), /PENDIENTE DE AUTORIZACIÓN/);

  const a = await autorizar(eje, { autorizante: 'casa', consolidacion: c.id, t: T });
  assert.equal(a.payload, '==autorizo');
  assert.equal(estadoDe(eje, c.id), 'AUTORIZADO');
  await assert.rejects(autorizar(eje, { autorizante: 'casa', consolidacion: c.id, t: T }), /ya está autorizado/);

  const antesCocina = eje.saldo('cocina', 'E:EUR');
  const e = await ejecutar(eje, {
    autor: 'huesped', consolidacion: c.id, t: T,
    movimientos: [{ token: 'E', denominacion: 'EUR', cantidad: 14, de: 'huesped', a: 'cocina' }],
  });
  assert.equal(estadoDe(eje, c.id), 'EJECUTADO');
  assert.equal(eje.saldo('cocina', 'E:EUR'), antesCocina + 14);
  assert.deepEqual(e.contexto.evidencia, [c.id, a.id]);
  assert.deepEqual(e.payload[1], { ref: c.id });
  // La evidencia es el hilo: ejecución → consolidación → compra → menú → …
  assert.deepEqual(eje.hilo(e.id).slice(0, 3).map((x) => x.id), [e.id, c.id, compra.id]);
  await assert.rejects(ejecutar(eje, { autor: 'huesped', consolidacion: c.id, t: T }), /ya ejecutado/);
  void menu;
});

test('autoriza quien tiene poder y no es el autor; ejecuta el autor; lo demás no cuenta', async () => {
  const { eje, compra } = await ejemploCompra();
  const c = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: T, elecciones: { 1: 'dos menús' } });
  await assert.rejects(autorizar(eje, { autorizante: 'huesped', consolidacion: c.id, t: T }), /no se autoriza a sí mismo/);
  await assert.rejects(autorizar(eje, { autorizante: 'cocina', consolidacion: c.id, t: T }), /no tiene poder/);
  // Un «autorizado» escrito a mano por quien no puede no cambia el estado.
  await eje.escribir({ autor: 'cocina', sobre: c.id, en: FABRICA, t: T, movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'cocina', a: null }], payload: '==autorizo', contexto: { fase: 'autorizado' } });
  assert.equal(estadoDe(eje, c.id), 'PENDIENTE DE AUTORIZACIÓN');
  await autorizar(eje, { autorizante: 'casa', consolidacion: c.id, t: T });
  assert.equal(estadoDe(eje, c.id), 'AUTORIZADO');
  await assert.rejects(ejecutar(eje, { autor: 'casa', consolidacion: c.id, t: T }), /ejecuta el autor/);
  // Un «ejecutado» escrito por otro no cuenta.
  await eje.escribir({ autor: 'cocina', sobre: c.id, en: FABRICA, t: T, movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'cocina', a: null }], payload: 'falso', contexto: { fase: 'ejecutado' } });
  assert.equal(estadoDe(eje, c.id), 'AUTORIZADO');
  await ejecutar(eje, { autor: 'huesped', consolidacion: c.id, t: T });
  assert.equal(estadoDe(eje, c.id), 'EJECUTADO');
});

test('consolidar rechaza huecos no heredables y no consolida nada vacío', async () => {
  const { eje, compra } = await ejemploCompra();
  await assert.rejects(consolidar(eje, { autor: 'casa', foco: compra.id, t: T, elecciones: {} }), /nada que consolidar/);
  await assert.rejects(consolidar(eje, { autor: 'casa', foco: compra.id, t: T, elecciones: { 7: 'más tarde' } }), /hueco en 5/);
  await assert.rejects(consolidar(eje, { autor: 'casa', foco: compra.id, t: T, elecciones: { 0: 'x' } }), /1–9/);
});

test('consolidar no ejecuta: no mueve E, solo el T de escribir', async () => {
  const { eje, compra } = await ejemploCompra();
  const antes = eje.saldo('huesped', 'E:EUR');
  const c = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: T, elecciones: { 1: 'dos menús' } });
  assert.equal(eje.saldo('huesped', 'E:EUR'), antes);
  assert.equal(c.movimientos.length, 1);
  assert.equal(c.movimientos[0].token, 'T');
  assert.equal(evaluar(eje, c.id, [1]).texto, 'dos menús');
});
