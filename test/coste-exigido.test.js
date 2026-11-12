// La condición «writing burns today's T» exige lo calculado por la regla «the cost of writing» (VG 12-11, #64 b):
// una sola tarifa, un minuto del calendario por posición del payload, venga el registro de donde venga. Quemar menos
// se rechaza con su motivo; quemar de más vale; la cantidad se suma en cualquier escala real, convertida a segundos
// con el calendario de la época; el T informativo (pasado, futuro, inventado) no paga la escritura.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluar } from '../src/bqlm.js';
import { ContextoEje } from '../src/contexto-eje.js';
import { EPOCA_0_BTML } from '../src/epocas.js';
import { crearEvento } from '../src/evento.js';
import { exigido, costeT, quemaDelCoste } from '../src/escritura.js';
import { ejemploCompra } from '../ejemplos/ikisai/compra-food.mjs';

const REGLA = "writing burns today's T";
const t = '2026-11-07T15:00:00Z';

/** Una candidata de la huésped sobre el menú con ese payload y esa quema. */
async function candidata(menu, payload, ...quemas) {
  return crearEvento({
    autor: 'huesped',
    sobre: menu.id,
    t,
    movimientos: quemas.map(([escala, cantidad, extra = {}]) => ({ token: 'T', escala, cantidad, de: 'huesped', a: null, ...extra })),
    payload,
  });
}

const PAYLOADS = [
  ['uno'],
  ['uno', 'dos', 'tres'],
  ['Compra', ['a', 'b', 'c'], ['x', 'y']],
  ['a', ['b', ['c']], ['d'], ['e']],
];

test('la cuenta de la condición es la de la regla del coste: exigido(payload) en segundos, para cada payload', async () => {
  const { eje, menu } = await ejemploCompra();
  for (const payload of PAYLOADS) {
    const ev = await candidata(menu, payload, ['minuto', 1]);
    const ctx = new ContextoEje(eje, { ev, epoch: EPOCA_0_BTML });
    const r = evaluar('first (first ev.8).6.1 * first epoch.7.0.1.1', ctx);
    assert.equal(r.estado, 'RESUELTO');
    assert.equal(r.valor[0], exigido(payload, { eje }), JSON.stringify(payload));
  }
});

test('quemaDelCoste: la quema que paga lo exigido, en la escala pedida y redondeada hacia arriba', () => {
  const payload = ['Compra', ['a', 'b', 'c'], ['x', 'y']];
  const n = costeT(payload);
  assert.ok(n > 1);
  assert.deepEqual(quemaDelCoste('ana', payload), { token: 'T', escala: 'minuto', cantidad: n, de: 'ana', a: null });
  assert.deepEqual(quemaDelCoste('ana', payload, 'segundo'), { token: 'T', escala: 'segundo', cantidad: n * 60, de: 'ana', a: null });
  assert.deepEqual(quemaDelCoste('ana', payload, 'hora'), { token: 'T', escala: 'hora', cantidad: Math.ceil(n / 60), de: 'ana', a: null });
  assert.throws(() => quemaDelCoste('ana', payload, 'futuro'), /escala real/);
});

test('quemar lo exigido pasa; un minuto menos se rechaza con lo que cuesta escribir; de más vale', async () => {
  const { eje, menu } = await ejemploCompra();
  for (const payload of PAYLOADS) {
    const n = costeT(payload, { eje });
    const justo = await candidata(menu, payload, ['minuto', n]);
    assert.deepEqual(await eje.validar(justo), [], 'justo ' + JSON.stringify(payload));
    const de_mas = await candidata(menu, payload, ['minuto', n + 3]);
    assert.deepEqual(await eje.validar(de_mas), [], 'de más');
    if (n > 1) {
      const corto = await candidata(menu, payload, ['minuto', n - 1]);
      const errores = await eje.validar(corto);
      assert.deepEqual(errores, [REGLA + ': huesped burns less T than writing costs (' + n * 60 + ' seconds), or more T than is left today (day 20764)'], JSON.stringify(payload));
    }
  }
});

test('la cantidad se suma en cualquier escala real: una hora y once minutos pagan setenta y un minutos; un segundo de menos no', async () => {
  const { eje, menu } = await ejemploCompra();
  const payload = [...Array.from({ length: 7 }, (_, i) => Array.from({ length: 10 }, (_, j) => 'p' + i + j)), ['x']]; // 71 posiciones: 71 minutos
  assert.equal(exigido(payload, { eje }), 71 * 60);
  assert.deepEqual(await eje.validar(await candidata(menu, payload, ['hora', 1], ['minuto', 11])), []);
  assert.deepEqual(await eje.validar(await candidata(menu, payload, ['minuto', 71])), []);
  assert.deepEqual(await eje.validar(await candidata(menu, payload, ['segundo', 71 * 60])), []);
  const corto = await eje.validar(await candidata(menu, payload, ['hora', 1], ['minuto', 10], ['segundo', 59]));
  assert.equal(corto.length, 1);
  assert.match(corto[0], /burns less T than writing costs \(4260 seconds\)/);
});

test('el T informativo no paga la escritura: quemar futuro o pasado no cubre lo exigido', async () => {
  const { eje, menu } = await ejemploCompra();
  const payload = ['uno', 'dos', 'tres'];
  const ev = await candidata(menu, payload, ['minuto', 1], ['futuro', 100, { refiere: '2026-12-24T20:00:00Z' }]);
  const errores = await eje.validar(ev);
  assert.ok(errores.some((e) => /burns less T than writing costs \(180 seconds\)/.test(e)), errores.join('; '));
});

test('un registro de una sola posición sigue costando un minuto (la tarifa de antes para lo más corto)', async () => {
  const { eje, menu } = await ejemploCompra();
  assert.deepEqual(await eje.validar(await candidata(menu, ['uno'], ['minuto', 1])), []);
  assert.deepEqual(await eje.validar(await candidata(menu, ['uno'], ['segundo', 60])), []);
  assert.equal((await eje.validar(await candidata(menu, ['uno'], ['segundo', 59]))).length, 1);
});

test('el T informativo no paga la escritura (VG 13-11, #76): una memoria, un plan o lo inventado pagan el coste en T real de hoy; el T informativo es contenido, no pago', async () => {
  const { eje, menu } = await ejemploCompra();
  const payload = ['uno', 'dos', 'tres'];
  const informativo = ['futuro', 1, { refiere: '2026-12-24T20:00:00Z' }];
  // solo T informativo (futuro, pasado o inventado): se rechaza como cualquiera que paga de menos
  for (const solo of [informativo, ['pasado', 1, { refiere: '2025-01-01T00:00:00Z' }], ['inventado', 1, { nota: 'érase una vez' }]]) {
    const mal = await eje.validar(await candidata(menu, payload, solo));
    assert.equal(mal.length, 1, solo[0]);
    assert.match(mal[0], /writing burns today's T/);
  }
  // con algo de T real que no llega a lo exigido, también
  assert.equal((await eje.validar(await candidata(menu, payload, ['minuto', 1], informativo))).length, 1);
  // con el coste en T real, la memoria o el plan valen y el T informativo va de contenido
  const coste = costeT(payload, { eje });
  assert.deepEqual(await eje.validar(await candidata(menu, payload, ['minuto', coste], informativo)), []);
  assert.deepEqual(await eje.validar(await candidata(menu, payload, ['minuto', coste])), []);
});

test('un registro de mil posiciones y uno con referencias se evalúan con el presupuesto de cálculo y cuestan lo que la regla dice', async () => {
  const { eje, menu } = await ejemploCompra();
  const grande = ['Mil', Array.from({ length: 1000 }, (_, i) => 'o' + i)];
  assert.equal(costeT(grande, { eje }), 1001);
  assert.deepEqual(await eje.validar(await candidata(menu, grande, ['dia', 1])), []); // un día entero cubre 1001 minutos
  assert.equal((await eje.validar(await candidata(menu, grande, ['hora', 16]))).length, 1); // 16 h = 960 min: no
  const conRef = ['Con referencias', { ref: menu.id, dir: '1000000000' }, [{ ref: menu.id, dir: '2000000000' }]];
  const n = costeT(conRef, { eje });
  assert.deepEqual(await eje.validar(await candidata(menu, conRef, ['minuto', n])), []);
  assert.equal((await eje.validar(await candidata(menu, conRef, ['minuto', n - 1]))).length, 1);
});
