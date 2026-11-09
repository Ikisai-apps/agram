// La primera regla de la época escrita en BQL mínimo, «writing burns today's T»
// (epoch.2.0): da el mismo veredicto que la validación actual del eje sobre los
// ejemplos de Ikisai (compra, reserva) y sobre eventos inválidos hechos a mano.
// No está conectada al eje: se evalúa aparte, con el eje de justo antes.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluarRegla } from '../src/bqlm.js';
import { ContextoEje } from '../src/contexto-eje.js';
import { EPOCA_0_BTML } from '../src/epocas.js';
import { Eje } from '../src/eje.js';
import { crearEvento, canonico, cuerpo, hash, RAIZ } from '../src/evento.js';
import { diaCivil } from '../src/tokens.js';
import { ejemploCompra, ejemploCuenta, ejemploComprasVecinas } from '../ejemplos/ikisai/compra-food.mjs';
import { ejemploReserva } from '../ejemplos/ikisai/reserva-booking.mjs';

const REGLA = EPOCA_0_BTML.condiciones[0];
const juzgar = (eje, ev) => evaluarRegla(REGLA, new ContextoEje(eje, { ev, epoch: EPOCA_0_BTML }));

/**
 * Rehace el eje evento a evento: antes de añadir cada uno, la regla lo juzga
 * con el eje de justo antes (el libro de antes) y se compara con eje.validar.
 */
async function repasar(eje) {
  const eventos = eje.orden.map((id) => eje.obtener(id));
  const nuevo = await Eje.desde([eventos[0]]);
  const veredictos = [];
  for (const ev of eventos.slice(1)) {
    const errores = await nuevo.validar(ev);
    const r = juzgar(nuevo, ev);
    assert.equal(r.pasa, errores.length === 0, ev.autor + ' ' + ev.id.slice(0, 8) + ': ' + (r.motivo ?? '') + ' / ' + errores.join('; '));
    veredictos.push(r.pasa);
    await nuevo.anadir(ev);
  }
  return veredictos;
}

/** Un evento con su id, sin pasar por crearEvento (que ya rechaza la forma). */
async function aMano(datos) {
  const ev = { en: RAIZ, contexto: {}, ...datos };
  return { ...ev, id: await hash(canonico(cuerpo(ev))) };
}

test('la regla es la del mapa, leída de la época', () => {
  assert.equal(REGLA[0][0], "writing burns today's T");
  assert.equal(REGLA.length, 10);
});

test('compra (con la cuenta y las compras vecinas): el mismo veredicto que el eje en cada evento', async () => {
  const c = await ejemploCompra();
  await ejemploCuenta(c.eje, c.compra);
  await ejemploComprasVecinas(c.eje, c);
  const veredictos = await repasar(c.eje);
  assert.ok(veredictos.length >= 10);
  assert.ok(veredictos.every(Boolean), 'todos válidos, y la regla los deja pasar');
});

test('reserva (con su ciclo de confirmación): el mismo veredicto que el eje en cada evento', async () => {
  const { eje } = await ejemploReserva();
  const veredictos = await repasar(eje);
  assert.ok(veredictos.length >= 10);
  assert.ok(veredictos.every(Boolean));
});

test('inválido a mano: escribir sin quemar T; el eje lo rechaza y la regla no pasa', async () => {
  const { eje, menu } = await ejemploCompra();
  const t = '2026-11-07T15:00:00Z';
  const ev = await aMano({
    autor: 'huesped',
    sobre: menu.id,
    t,
    movimientos: [{ token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 2, de: 'huesped', a: 'cocina' }],
    payload: ['Propina sin tiempo'],
  });
  const errores = await eje.validar(ev);
  assert.ok(errores.some((e) => /escribir consume T del autor/.test(e)), errores.join('; '));
  const r = juzgar(eje, ev);
  assert.equal(r.pasa, false);
  assert.equal(r.estado, 'RESUELTO');
  assert.equal(r.motivo, "writing burns today's T: huesped burns no T, or more T than is left today (day " + diaCivil(t) + ')');
});

test('inválido a mano: quemar más T del que da la asignación del día; el eje lo rechaza y la regla no pasa', async () => {
  const { eje, menu } = await ejemploCompra();
  const ev = await crearEvento({
    autor: 'huesped',
    sobre: menu.id,
    t: '2026-11-07T16:00:00Z',
    movimientos: [{ token: 'T', escala: 'hora', cantidad: 25, de: 'huesped', a: null }],
    payload: ['Un día de 25 horas'],
  });
  const errores = await eje.validar(ev);
  assert.ok(errores.some((e) => /T del día agotado \(hora\)/.test(e)), errores.join('; '));
  assert.equal(juzgar(eje, ev).pasa, false);
});

test('lo gastado hoy (A.7.e) cuenta: 23 horas más caben tras la compra; la hora 25 ya no', async () => {
  const { eje, menu } = await ejemploCompra();
  const horas = (n, t) => crearEvento({ autor: 'huesped', sobre: menu.id, t, movimientos: [{ token: 'T', escala: 'hora', cantidad: n, de: 'huesped', a: null }], payload: [n + ' horas'] });
  const veintitres = await horas(23, '2026-11-07T20:00:00Z');
  assert.deepEqual(await eje.validar(veintitres), []);
  assert.equal(juzgar(eje, veintitres).pasa, true, '1 de la compra + 23 = 24: cabe');
  await eje.anadir(veintitres);
  const una = await horas(1, '2026-11-07T21:00:00Z');
  assert.ok((await eje.validar(una)).some((e) => /T del día agotado/.test(e)));
  assert.equal(juzgar(eje, una).pasa, false);
  // Al día siguiente la asignación empieza entera (VG, 8-11): la misma hora vuelve a caber.
  const mañana = await horas(1, '2026-11-08T09:00:00Z');
  assert.deepEqual(await eje.validar(mañana), []);
  assert.equal(juzgar(eje, mañana).pasa, true);
});

test('lo que la regla no ve: una cosa no tiene asignación; lo que gasta de más lo para el saldo (el suelo), no esta regla', async () => {
  const { eje, menu } = await ejemploCompra();
  const ev = await crearEvento({ autor: 'cocina', sobre: menu.id, t: '2026-11-07T16:00:00Z', movimientos: [{ token: 'T', escala: 'hora', cantidad: 19, de: 'cocina', a: null }], payload: ['Más horas de las que tiene'] });
  assert.ok((await eje.validar(ev)).some((e) => /saldo insuficiente de T:hora en cocina/.test(e)));
  assert.equal(juzgar(eje, ev).pasa, true, '[X] decidir VG: la asignación de una cosa (docs/BQLM.md §8)');
});

test('sin época la regla no puede leer la asignación: PENDIENTE, y no pasa', async () => {
  const { eje, menu } = await ejemploCompra();
  const ev = await crearEvento({ autor: 'huesped', sobre: menu.id, t: '2026-11-07T16:00:00Z', movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'huesped', a: null }], payload: ['x'] });
  const r = evaluarRegla(REGLA, new ContextoEje(eje, { ev }));
  assert.deepEqual([r.pasa, r.estado], [false, 'PENDIENTE']);
  assert.match(r.motivo, /no hay epoch/);
});
