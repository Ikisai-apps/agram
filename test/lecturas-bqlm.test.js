// B5 (VG, 10-11; mapa §16 [D]): las lecturas son reglas de la época con «read» en su 4. «present»,
// «informative», «attended» y «obligation» están en el 2 de la época como las demás reglas, no son
// condiciones, y el contexto las pone en la posición que dice su 3: las otras reglas las leen ahí, por su
// posición, sin repetirlas. Cada lectura da lo mismo que la función JS que lee hoy lo mismo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Eje } from '../src/eje.js';
import { evaluar, evaluarRegla, leerRegla, esLectura, posicionDeLectura, analizar } from '../src/bqlm.js';
import { ContextoEje } from '../src/contexto-eje.js';
import { EPOCA_0_BTML } from '../src/epocas.js';
import { esPresente } from '../src/evento.js';
import { esInformativoT } from '../src/ciclo.js';
import { colateral, devoluciones } from '../src/lente.js';
import { ejemploCompra } from '../ejemplos/ikisai/compra-food.mjs';
import { ejemploReserva } from '../ejemplos/ikisai/reserva-booking.mjs';
import { ejemploComprasHermanas } from '../ejemplos/ikisai/compras-hermanas.mjs';
import { ejemploLente } from '../ejemplos/ikisai/lente-booking.mjs';

const T0 = '2026-11-08T10:00:00Z';
const minuto = (de, cantidad = 1) => ({ token: 'T', escala: 'minuto', cantidad, de, a: null });
const R = (emisor, cantidad, de, a) => ({ token: 'R', emisor, cantidad, de, a });
const LECTURAS = EPOCA_0_BTML.lecturas;
const lectura = (nombre) => LECTURAS.find((r) => r[0][0] === nombre);
const uno = (expr, ctx) => {
  const r = evaluar(expr, ctx);
  assert.equal(r.estado, 'RESUELTO', expr + ': ' + r.motivo);
  assert.equal(r.valor.length, 1, expr + ' da ' + r.texto);
  return r.valor[0];
};

/** Un libro con R: ana emite y da a bea; bea le devuelve una (pide atención); ana la atiende después. */
async function conR() {
  const eje = await Eje.genesis({ demostracion: true, identidad: 'g', t: T0, foco: 'raíz', emision: [{ token: 'E', denominacion: 'minuto', cantidad: 1e6 }] });
  for (const id of ['ana', 'bea', 'otra']) await eje.entrar({ identidad: id, t: T0 });
  await eje.escribir({ autor: 'ana', sobre: eje.genesisId, t: T0, payload: 'mi R', movimientos: [minuto('ana'), R('ana', 10, null, 'ana'), colateral('ana', 1), R('ana', 4, 'ana', 'bea'), R('ana', 2, 'ana', 'otra')] });
  const dev = await eje.escribir({ autor: 'bea', sobre: eje.genesisId, t: T0, payload: 'ana, te pido atención', movimientos: [minuto('bea'), R('ana', 1, 'bea', 'ana')] });
  return { eje, dev };
}

test('B5: las cuatro lecturas están en el 2 de la época, con read en su 4 y su posición en el 3; no son condiciones', () => {
  assert.deepEqual(LECTURAS.map((r) => r[0][0]), ['present', 'informative', 'attended', 'obligation']);
  assert.deepEqual(LECTURAS.map(posicionDeLectura), ['X.6.1', 'X.6.7', 'X.7.4', 'A.3.1']);
  for (const r of LECTURAS) {
    assert.ok(esLectura(r));
    assert.equal(r.length, 10, 'una lectura lleva las diez posiciones, como toda regla');
    assert.ok(!EPOCA_0_BTML.condiciones.includes(r), r[0][0] + ' no es una condición');
    assert.match(evaluarRegla(r, new ContextoEje(null, { epoch: EPOCA_0_BTML })).motivo, /es una lectura/);
  }
  assert.equal(EPOCA_0_BTML.reglasConId.length, EPOCA_0_BTML.condiciones.length + LECTURAS.length);
  // En el BQL mínimo, epoch.2 las da con las demás: se encuentran por su nombre.
  const ctx = new ContextoEje(null, { epoch: EPOCA_0_BTML });
  assert.equal(uno('count (epoch.2 where first it.0 = "present")', ctx), 1);
  assert.equal(uno('first (first (epoch.2 where first it.0 = "obligation")).4', ctx), 'read');
  // Una condición no es una lectura, y leerRegla no evalúa condiciones.
  assert.match(leerRegla(EPOCA_0_BTML.condiciones[0], 'ana', ctx).motivo, /no es una lectura/);
  // En una lectura, it es lo que se lee y su primer where da it2: fuera de una lectura, it sin where es error.
  assert.throws(() => analizar('it.1'), /it solo vale dentro de where/);
  assert.doesNotThrow(() => analizar('count (it.1 where it2.4 = burn)', { sujeto: true }));
});

test('B5: nunca repetidas: ninguna condición de la época lleva la fórmula de una lectura', () => {
  const formulas = LECTURAS.map((r) => r[2].at(-1).slice(1));
  for (const c of EPOCA_0_BTML.condiciones) for (const f of formulas) assert.ok(!c[2].at(-1).includes(f), c[0][0]);
});

test('«present» (X.6.1) e «informative» (X.6.7) dan lo mismo que evento.esPresente y ciclo.esInformativoT en cada registro de los ejemplos', async () => {
  const ejes = [(await ejemploCompra()).eje, (await ejemploReserva()).eje, (await ejemploComprasHermanas()).eje, (await ejemploLente()).eje];
  let vistos = 0;
  for (const eje of ejes) {
    for (const id of eje.orden) {
      const e = eje.obtener(id);
      const ctx = new ContextoEje(eje, { epoch: EPOCA_0_BTML, ev: e });
      assert.equal(uno('first ("' + id + '").6.1', ctx), esPresente(e), 'present de ' + id.slice(0, 8));
      assert.equal(uno('first ("' + id + '").6.7', ctx), e.movimientos.some(esInformativoT), 'informative de ' + id.slice(0, 8));
      // La candidata se lee igual.
      assert.equal(uno('first ev.6.1', ctx), esPresente(e));
      vistos++;
    }
  }
  assert.ok(vistos > 40, vistos + ' registros');
});

test('«present» e «informative» con T pasado: válido, gratis en T real y no presente', async () => {
  const eje = await Eje.genesis({ demostracion: true, identidad: 'g', t: T0, foco: 'raíz' });
  await eje.entrar({ identidad: 'ana', t: T0 });
  const recuerdo = await eje.escribir({ autor: 'ana', sobre: eje.genesisId, t: T0, payload: 'lo que hice hace un año', movimientos: [{ token: 'T', escala: 'pasado', cantidad: 1, de: 'ana', a: null, refiere: '2025-11-08T10:00:00Z' }] });
  const ctx = new ContextoEje(eje, { epoch: EPOCA_0_BTML });
  assert.equal(esPresente(recuerdo), false);
  assert.deepEqual([uno('first ("' + recuerdo.id + '").6.1', ctx), uno('first ("' + recuerdo.id + '").6.7', ctx)], [false, true]);
  assert.deepEqual([uno('first ("' + eje.genesisId + '").6.1', ctx), uno('first ("' + eje.genesisId + '").6.7', ctx)], [true, false], 'el génesis es presente');
  // Lo leen otras expresiones por su posición, sin repetir la fórmula: los registros no presentes del libro.
  assert.deepEqual(evaluar('(before.1 where not first it.6.1) each 5', ctx).valor.filter((x) => typeof x === 'string'), [recuerdo.id]);
});

test('«obligation» (A.3.1) da lo mismo que eje.obligaciones: la R propia en manos ajenas, disponible o bloqueada', async () => {
  const { eje } = await conR();
  const ctx = new ContextoEje(eje, { epoch: EPOCA_0_BTML, ev: eje.obtener(eje.orden.at(-1)) });
  for (const id of eje.identidades()) assert.equal(uno('first ("' + id + '").3.1', ctx), eje.obligaciones(id), 'obligation de ' + id);
  assert.equal(eje.obligaciones('ana'), 5, 'bea 3 y otra 2; la devuelta vuelve a ana y no obliga, ni el colateral que ana bloquea en su cartera');
  const lente = (await ejemploLente()).eje;
  const ctxLente = new ContextoEje(lente, { epoch: EPOCA_0_BTML });
  for (const id of lente.identidades()) assert.equal(uno('first ("' + id + '").3.1', ctxLente), lente.obligaciones(id), 'obligation de ' + id);
});

test('«attended» (X.7.4): una devolución de R queda atendida cuando su emisor escribe un registro que la cita (como lente.devoluciones)', async () => {
  const { eje, dev } = await conR();
  const atendida = (e) => uno('first ("' + dev.id + '").7.4', new ContextoEje(e, { epoch: EPOCA_0_BTML }));
  assert.equal(atendida(eje), false);
  assert.equal(devoluciones(eje, 'ana')[0].atencion, null);
  // Citarla en un registro de otro no la atiende.
  await eje.escribir({ autor: 'otra', sobre: dev.id, t: T0, payload: 'yo no la atiendo', movimientos: [minuto('otra')] });
  assert.equal(atendida(eje), false);
  const at = await eje.escribir({ autor: 'ana', sobre: dev.id, t: T0, payload: 'te atiendo', contexto: { atiende: dev.id }, movimientos: [minuto('ana')] });
  assert.equal(devoluciones(eje, 'ana')[0].atencion, at.id);
  assert.equal(atendida(eje), true);
  const ctx = new ContextoEje(eje, { epoch: EPOCA_0_BTML });
  assert.deepEqual(evaluar('("' + at.id + '").6.4', ctx).valor, [dev.id], 'lo que atiende un registro está en su 6.4');
  // Un registro que no devuelve R no está atendido aunque alguien lo cite.
  assert.equal(uno('first ("' + eje.genesisId + '").7.4', ctx), false);
});
