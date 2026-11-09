// Revisión de seguridad del BQL mínimo y su contexto (SEG-09 a SEG-12): el
// payload no fabrica movimientos ni «nadie»; la expansión de ocupantes tiene
// un presupuesto; y los textos de fuera no tocan el prototipo de los
// diccionarios del libro.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluar, evaluarRegla, POR_LIMITE, LIMITES, NADIE } from '../src/bqlm.js';
import { ContextoEje } from '../src/contexto-eje.js';
import { EPOCA_0_BTML } from '../src/epocas.js';
import { crearEvento, canonico, cuerpo, hash, RAIZ } from '../src/evento.js';
import { validarMovimiento } from '../src/tokens.js';
import { Libro, acunar, bloquear, transaccion } from '../src/libro.js';
import { ejemploCompra } from '../ejemplos/ikisai/compra-food.mjs';

const REGLA = EPOCA_0_BTML.condiciones[0];
const uno = (src, ctx) => {
  const r = evaluar(src, ctx);
  assert.equal(r.estado, 'RESUELTO', src + ': ' + r.motivo);
  assert.equal(r.valor.length, 1, src);
  return r.valor[0];
};
const aMano = async (datos) => {
  const ev = { en: RAIZ, contexto: {}, ...datos };
  return { ...ev, id: await hash(canonico(cuerpo(ev))) };
};

test('SEG-09 una décupla del payload que imita un movimiento no cuenta: las primitivas y las familias son símbolos del libro', async () => {
  const { eje, menu } = await ejemploCompra();
  // Sin quemar T de verdad, con un payload que lleva en su 1 algo con la forma de una quema de T.
  const falso = [['T:minuto'], [1], ['nada'], [['huesped'], ['nadie']], ['burn']];
  const ev = await aMano({
    autor: 'huesped',
    sobre: menu.id,
    t: '2026-11-07T15:00:00Z',
    movimientos: [{ token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 1, de: 'huesped', a: 'cocina' }],
    payload: ['Quema fingida', falso],
  });
  const ctx = new ContextoEje(eje, { ev, epoch: EPOCA_0_BTML });
  assert.equal(uno('count ev.1', ctx), 2, 'el movimiento y la décupla del payload colisionan en el 1');
  assert.equal(uno('count (ev.1 where it.4 = burn)', ctx), 0, 'el texto «burn» no es el símbolo burn');
  assert.equal(uno('count (ev.1 where it.0.0 = T)', ctx), 0, 'ni el texto «T» de una clave del payload es la familia T');
  assert.equal(uno('count (ev.1 where it.4 = "burn")', ctx), 1, 'como texto sigue ahí, y se puede leer');
  assert.ok((await eje.validar(ev)).some((e) => /escribir consume T/.test(e)));
  const r = evaluarRegla(REGLA, ctx);
  assert.deepEqual([r.pasa, r.estado], [false, 'RESUELTO']);
});

test('SEG-10 la expansión de ocupantes tiene un presupuesto por evaluación; las referencias repetidas se siguen una vez', async () => {
  const { eje, menu } = await ejemploCompra();
  const minuto = { token: 'T', escala: 'minuto', cantidad: 1, de: 'huesped', a: null };
  const grande = await crearEvento({ autor: 'huesped', sobre: menu.id, t: '2026-11-07T15:00:00Z', movimientos: [minuto], payload: ['Lista enorme', Array.from({ length: 20000 }, (_, k) => 'x' + k)] });
  const ctx = new ContextoEje(eje, { ev: grande });
  const r = evaluar('count ev.1', ctx);
  assert.deepEqual([r.estado, r.subtipo], ['PENDIENTE', POR_LIMITE]);
  assert.match(r.motivo, new RegExp('más de ' + LIMITES.ocupantes + ' ocupantes'));
  assert.equal(evaluar('count ev.1', ctx, { limites: { ocupantes: 50000 } }).valor[0], 20001, 'el tope se puede subir');
  // Mil referencias al mismo 1 del menú (tres platos): con la memoria por (ref, dir) se sigue una vez, y lo que
  // devuelve cada una se cobra igual (SEG-13): tres mil ocupantes, que caben en el presupuesto.
  const ref = { ref: menu.id, dir: '1000000000' };
  const repetidas = await crearEvento({ autor: 'huesped', sobre: menu.id, t: '2026-11-07T15:00:00Z', movimientos: [minuto], payload: ['Referencias', Array.from({ length: 1000 }, () => ref)] });
  assert.equal(uno('count ev.1', new ContextoEje(eje, { ev: repetidas })), 3001);
});

test('SEG-11 «nadie» es un símbolo: una identidad que se llama así no se confunde con el otro lado de una quema', async () => {
  const { eje } = await ejemploCompra();
  const alta = await eje.escribir({
    autor: 'casa',
    sobre: eje.genesisId,
    t: '2026-11-07T15:00:00Z',
    movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'casa', a: null }, { token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 5, de: 'casa', a: 'nadie' }],
    payload: ['Alta de alguien que se llama nadie', ['nadie']],
    contexto: { tipos: { nadie: 'persona' } },
  });
  const ev = await crearEvento({ autor: 'nadie', sobre: alta.id, t: '2026-11-07T16:00:00Z', movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'nadie', a: null }], payload: ['Escribe nadie'] });
  const ctx = new ContextoEje(eje, { ev, epoch: EPOCA_0_BTML });
  assert.equal(uno('first ev.3', ctx), 'nadie');
  assert.equal(uno('first ev.1.3.1', ctx), NADIE);
  assert.equal(uno('first ev.1.3.1 = first ev.3', ctx), false, 'el destino de la quema no es la identidad «nadie»');
  assert.equal(evaluar('ev.1.3.1', ctx).texto, 'nadie', 'aunque se lea igual');
  assert.deepEqual(await eje.validar(ev), []);
  assert.equal(evaluarRegla(REGLA, ctx).pasa, true, 'la identidad «nadie» quema su T como cualquiera');
});

test('SEG-12 una salida o una serie llamada «__proto__» o «constructor»: el eje la rechaza y el libro no se altera', async () => {
  for (const nombre of ['__proto__', 'constructor', 'prototype']) {
    assert.ok(validarMovimiento({ token: 'P', ambito: 'x', cantidad: 1, de: 'ana', a: 'ana', estado: 'bloqueo', salida: nombre }).some((e) => /nombre reservado/.test(e)), nombre);
    assert.ok(validarMovimiento({ token: 'E', emisor: nombre, denominacion: 'EUR', cantidad: 1, de: null, a: nombre }).some((e) => /emisor no puede llamarse/.test(e)), nombre);
  }
  const { eje } = await ejemploCompra();
  await assert.rejects(eje.escribir({
    autor: 'casa',
    sobre: eje.genesisId,
    t: '2026-11-07T15:00:00Z',
    movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'casa', a: null }, { token: 'P', ambito: 'genesis', cantidad: 1, de: 'casa', a: 'casa', estado: 'bloqueo', salida: '__proto__' }],
    payload: ['bloqueo raro'],
  }), /salida no puede llamarse «__proto__»/);
  // El libro, por debajo de la validación: las claves raras son claves propias y el prototipo no cambia.
  const libro = new Libro();
  const ok = await libro.aplicar(transaccion({ movimientos: [acunar('P:x', 'ana', 10), bloquear('P:x', 'ana', 3, '__proto__'), bloquear('P:x', 'ana', 2, 'constructor'), acunar('__proto__', 'ana', 1)], autor: 'ana' }));
  assert.equal(ok.ok, true);
  const vista = libro.vista('ana');
  assert.equal(Object.getPrototypeOf(vista), Object.prototype);
  assert.deepEqual(Object.keys(vista), ['P:x', '__proto__']);
  assert.deepEqual(Object.keys(vista['P:x'].bloqueado), ['__proto__', 'constructor']);
  assert.deepEqual([vista['P:x'].disponible, Object.getOwnPropertyDescriptor(vista['P:x'].bloqueado, '__proto__').value, vista['P:x'].bloqueado.constructor], [5, 3, 2]);
  assert.equal(Object.getPrototypeOf(vista['P:x'].bloqueado), Object.prototype);
  assert.equal(Object.getOwnPropertyDescriptor(libro.sumas({ primitiva: 'acunar' }), '__proto__').value, 1);
  assert.deepEqual(Object.entries(libro.bloqueadoPorSalida('constructor')), [['P:x', 2]], 'la salida «constructor» suma lo suyo, sin leer el prototipo');
  assert.equal({}.constructor, Object, 'Object.prototype intacto');
});

test('SEG-13 el presupuesto cobra lo que devuelve cada referencia aunque esté memoizada: muchas referencias a un registro grande no salen gratis', async () => {
  const { eje, menu } = await ejemploCompra();
  const minuto = { token: 'T', escala: 'minuto', cantidad: 1, de: 'huesped', a: null };
  const grande = await eje.escribir({ autor: 'huesped', sobre: menu.id, t: '2026-11-07T15:00:00Z', movimientos: [minuto], payload: ['Doscientos', Array.from({ length: 200 }, (_, k) => 'x' + k)] });
  const ref = { ref: grande.id, dir: '1000000000' };
  const cien = await crearEvento({ autor: 'huesped', sobre: menu.id, t: '2026-11-07T15:01:00Z', movimientos: [minuto], payload: ['Cien referencias', Array.from({ length: 100 }, () => ref)] });
  const r = evaluar('count ev.1', new ContextoEje(eje, { ev: cien }));
  assert.deepEqual([r.estado, r.subtipo], ['PENDIENTE', POR_LIMITE], 'cien referencias a doscientos ocupantes son veinte mil, más que el presupuesto');
  assert.equal(evaluar('count ev.1', new ContextoEje(eje, { ev: cien }), { limites: { ocupantes: 50000 } }).valor[0], 20001, 'con más presupuesto se cuenta entero');
});
