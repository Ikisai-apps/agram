// Encargo 3c-2b: los pasos (src/pasos.js). Los estados del motor ya no existen: lo que la animación necesita como
// estado son PASOS, valores discretos que salen de lecturas y que usa como índice de fotograma. La tabla de pasos es
// un dato de la época (epoch.9.8): cambiarla cambia lo que devuelve.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pasos, tabla, mecanismos } from '../src/pasos.js';
import { madurez } from '../src/contrato.js';
import { cuota } from '../src/mapped.js';
import { cajaDeCuota } from '../src/bases.js';
import { EPOCA_0_BTML, cargarEpocaBtml } from '../src/epocas.js';
import { EPOCA_0_BTML_DATOS, REGLAS_DE_EPOCA_DATOS, CORRECCIONES_DE_EPOCA_DATOS } from '../datos/epocas/epocas.js';
import { crearEvento } from '../src/evento.js';
import { ejemploCompra, ejemploCuenta } from '../ejemplos/ikisai/compra-food.mjs';
import { ejemploReserva } from '../ejemplos/ikisai/reserva-booking.mjs';
import { ejemploTarea } from '../ejemplos/ikisai/tarea-tasks.mjs';

const minuto = (de, cantidad = 1) => ({ token: 'T', escala: 'minuto', cantidad, de, a: null });

function epocaCon(cambiar) {
  const e = JSON.parse(JSON.stringify(EPOCA_0_BTML_DATOS));
  cambiar(e);
  return cargarEpocaBtml(e, { registros: REGLAS_DE_EPOCA_DATOS, correcciones: CORRECCIONES_DE_EPOCA_DATOS, id: EPOCA_0_BTML.id });
}

test('la tabla de pasos es un dato de la época: una fila por punto de vista (4 el ciclo, 8 la cuota, 7 la escala, * la madurez), con k y de como fórmulas o como lecturas del núcleo', () => {
  const t = tabla();
  assert.deepEqual(t.map((f) => [f.pv, f.nombre]), [[4, 'ciclo'], [8, 'cuota'], [7, 'escala'], [7, 'cuando'], ['*', 'madurez']]); // «cuando»: encargo «datos3»
  assert.ok(t.every((f) => f.nota), 'cada fila dice qué es');
  for (const f of t) for (const x of [f.k, f.de]) assert.ok(typeof x === 'number' || /^=/.test(x) || mecanismos().includes(x), f.nombre + ': ' + x);
  assert.deepEqual(mecanismos(), ['maturity', 'share box', 'when scale']);
});

test('los cuatro pasos sobre los ejemplos: la compra, el menú, la cuenta, la reserva y la tarea', async () => {
  const { eje, menu, compra } = await ejemploCompra();
  const cuenta = await ejemploCuenta(eje, compra);
  const p = pasos(eje, compra.id);
  assert.deepEqual(Object.keys(p), ['ciclo', 'cuota', 'escala', 'cuando', 'madurez']);
  assert.deepEqual(p.ciclo, { pv: 4, k: 0, de: 0 }, 'la compra no anuncia movimientos: cero de cero');
  assert.deepEqual(p.escala, { pv: 7, k: 2, de: 10 }, 'la compra quema una hora: la escala 2 de epoch.1.3.1');
  assert.deepEqual(p.madurez, { pv: '*', k: 11, de: 15 });
  assert.deepEqual(p.madurez, { pv: '*', k: madurez(eje, compra).nivel, de: madurez(eje, compra).de }, 'la misma lectura que el contrato');
  // La caja de la cuota: la del foco frente a su padre en la serie en que más pesa (la compra es lo único que mueve algo bajo el menú).
  const c = cuota(eje, compra.id);
  const mayor = Math.max(...c.series.filter((s) => s.foco > 0).map((s) => s.cuota));
  assert.deepEqual(p.cuota, { pv: 8, k: cajaDeCuota(mayor), de: 10 });
  assert.equal(p.cuota.k, 9);
  assert.deepEqual(pasos(eje, menu.id).escala.k, 2, 'el menú quema horas');
  assert.deepEqual(pasos(eje, cuenta.id).escala, { pv: 7, k: 1, de: 10 }, 'la cuenta quema minutos');
  assert.equal(pasos(eje, cuenta.id).madurez.k, 4);
  // La raíz: sin padre no hay cuota, y el génesis no quema T.
  const g = pasos(eje, eje.genesisId);
  assert.deepEqual([g.cuota.k, g.escala.k, g.ciclo], [null, null, { pv: 4, k: 0, de: 0 }]);
  // La reserva anuncia cuatro movimientos (tres noches y el pago): confirmada, 4 de 4; recién escrita, 0 de 4; a medias, 3 de 4.
  const b = await ejemploReserva();
  const r = pasos(b.eje, b.reserva.id);
  assert.deepEqual(r.ciclo, { pv: 4, k: 4, de: 4 });
  assert.deepEqual(r.madurez, { pv: '*', k: 4, de: 5 }, 'los cinco niveles de «booking»');
  assert.equal(r.escala.k, 1);
  const abierta = await ejemploReserva({ confirmar: false });
  assert.deepEqual(pasos(abierta.eje, abierta.reserva.id).ciclo, { pv: 4, k: 0, de: 4 });
  const { eje: e2, reserva: r2 } = await ejemploReserva({ confirmar: false });
  const { siguiente } = await import('../src/motor.js');
  const mio = siguiente(e2, r2.id, 'casa').faltaDeMi.filter((x) => x.plantilla === 'move what was announced').map((x) => x.transaccion.movimientos[1]);
  await e2.escribir({ autor: 'casa', sobre: r2.id, t: '2026-11-09T09:00:00Z', movimientos: [minuto('casa'), ...mio], payload: 'Plaza entregada' });
  assert.deepEqual(pasos(e2, r2.id).ciclo, { pv: 4, k: 3, de: 4 }, 'entregadas las plazas, falta el pago');
  // La tarea de Tasks también anuncia movimientos en su 4.1.
  const t = await ejemploTarea();
  const pt = pasos(t.eje, t.tarea.id);
  assert.ok(pt.ciclo.de >= 1 && pt.ciclo.k <= pt.ciclo.de);
  // Una candidata que aún no está en el eje: su escala y su madurez propias; sin cuota.
  const candidata = await crearEvento({ autor: 'huesped', sobre: menu.id, t: '2026-11-07T18:00:00Z', movimientos: [minuto('huesped')], payload: ['x', 'y'] });
  const pc = pasos(eje, candidata);
  assert.deepEqual([pc.escala.k, pc.madurez.k, pc.cuota.k, pc.ciclo], [1, 2, null, { pv: 4, k: 0, de: 0 }]);
  assert.deepEqual(pasos(eje, 'f'.repeat(64)), {});
});

test('el paso es un índice de fotograma: k es un entero entre 0 y de (o null si la lectura no da valor)', async () => {
  const { eje } = await ejemploCompra();
  for (const id of eje.orden) {
    for (const [nombre, paso] of Object.entries(pasos(eje, id))) {
      assert.ok(paso.k === null || (Number.isInteger(paso.k) && paso.k >= 0), id.slice(0, 8) + ' ' + nombre + ': ' + paso.k);
      if (paso.k !== null && typeof paso.de === 'number') assert.ok(paso.k <= Math.max(paso.de, 1) || nombre === 'madurez', id.slice(0, 8) + ' ' + nombre);
    }
  }
});

test('cambiar la tabla en una copia de la época cambia el resultado: los nombres, el de, el punto de vista y las fórmulas', async () => {
  const { eje, compra } = await ejemploCompra();
  const epoca = epocaCon((e) => {
    const t = e[9][8];
    t[3][1] = ['scale']; // la fila de la escala se llama de otra forma
    t[3][3] = ['=count epoch.9.1 - 1']; // y su de es otro: los nueve del tutorial menos uno
    t[2][0] = [6]; // la cuota pasa al 6
    t[1][2] = ['=count epoch.9.1']; // el ciclo lee otra cosa: los nueve del tutorial
    t.splice(t.findIndex((f) => Array.isArray(f) && f[1]?.[0] === 'madurez'), 1); // y no hay madurez
  });
  const p = pasos(eje, compra.id, { epoca });
  assert.deepEqual(Object.keys(p), ['ciclo', 'cuota', 'scale', 'cuando']);
  assert.deepEqual(p.scale, { pv: 7, k: 2, de: 8 });
  assert.equal(p.cuota.pv, 6);
  assert.deepEqual(p.ciclo, { pv: 4, k: 9, de: 0 });
  assert.deepEqual(tabla({ epoca }).map((f) => f.nombre), ['ciclo', 'cuota', 'scale', 'cuando']);
  // Una fila que nombra una lectura que el núcleo no da, o una fórmula que no se resuelve, da null: nunca lanza.
  const rara = epocaCon((e) => { e[9][8][1][2] = ['nothing known']; e[9][8][1][3] = ['=it.4.9.9 + 1']; });
  assert.deepEqual(pasos(eje, compra.id, { epoca: rara }).ciclo, { pv: 4, k: null, de: null });
  // Sin tabla, nada.
  const sin = epocaCon((e) => { e[9][8] = [e[9][8][0]]; });
  assert.deepEqual(pasos(eje, compra.id, { epoca: sin }), {});
});
