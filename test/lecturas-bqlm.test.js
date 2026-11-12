// B5 (VG, 10-11; mapa §16 [D]): las lecturas son reglas de la época con «read» en su 4. «present»,
// «informative», «attended», «obligation», «share» y «weight» están en el 2 de la época como las demás reglas,
// no son condiciones, y el contexto las pone en la posición que dice su 3: las otras reglas las leen ahí, por su
// posición, sin repetirlas. Cada lectura da lo mismo que la función JS que lee hoy lo mismo. Encargo 3b:
// «attended» es un registro del emisor anclado sobre la petición, con T real (ya no contexto.atiende), y
// «obligation» pasa al 8.1 de la identidad (el 3 son sus grupos de atención).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Eje } from '../src/eje.js';
import { evaluar, evaluarRegla, leerRegla, esLectura, posicionDeLectura, analizar } from '../src/bqlm.js';
import { ContextoEje } from '../src/contexto-eje.js';
import { EPOCA_0_BTML } from '../src/epocas.js';
import { esPresente } from '../src/evento.js';
import { esInformativoT } from '../src/ciclo.js';
import { devoluciones } from '../src/lente.js';
import { entrarPorInvitacion } from '../ejemplos/ikisai/altas.mjs';
import { ejemploCompra, ejemploFuturoYCohorte } from '../ejemplos/ikisai/compra-food.mjs';
import { diaCivil } from '../src/tokens.js';
import { ejemploReserva } from '../ejemplos/ikisai/reserva-booking.mjs';
import { ejemploComprasHermanas } from '../ejemplos/ikisai/compras-hermanas.mjs';
import { ejemploLente } from '../ejemplos/ikisai/lente-booking.mjs';
import { pagaElCoste } from './ayudas-coste.js';

const T0 = '2026-11-08T10:00:00Z';
const minuto = (de, cantidad) => (cantidad === undefined ? pagaElCoste(de) : { token: 'T', escala: 'minuto', cantidad, de, a: null });
const R = (emisor, cantidad, de, a) => ({ token: 'R', emisor, cantidad, de, a });
const LECTURAS = EPOCA_0_BTML.lecturas;
const lectura = (nombre) => LECTURAS.find((r) => r[0][0] === nombre);
const uno = (expr, ctx) => {
  const r = evaluar(expr, ctx);
  assert.equal(r.estado, 'RESUELTO', expr + ': ' + r.motivo);
  assert.equal(r.valor.length, 1, expr + ' da ' + r.texto);
  return r.valor[0];
};

/** Un libro con R: ana emite (sin colateral: VG, 9-11) y da a bea; bea le devuelve una (pide atención); ana la atiende después. */
async function conR() {
  const eje = await Eje.genesis({ demostracion: true, identidad: 'g', t: T0, foco: 'raíz', emision: [{ token: 'R', cantidad: 10 }, { token: 'E', denominacion: 'minuto', cantidad: 1e6 }] });
  for (const id of ['ana', 'bea', 'otra']) await entrarPorInvitacion(eje, { por: 'g', quien: id, t: T0, da: [] });
  await eje.escribir({ autor: 'ana', sobre: eje.alta('ana').id, t: T0, payload: 'mi R', movimientos: [minuto('ana'), R('ana', 10, null, 'ana'), R('ana', 4, 'ana', 'bea'), R('ana', 2, 'ana', 'otra')] });
  // La petición, en el 3 del alta de ana: devolverle su R es el precio de su atención (revisión de seguridad, encargo 3b).
  const dev = await eje.escribir({ autor: 'bea', sobre: eje.alta('ana').id, en: '3000000000', t: T0, payload: 'ana, te pido atención', movimientos: [minuto('bea'), R('ana', 1, 'bea', 'ana')] });
  return { eje, dev };
}

test('B5: las catorce lecturas están en el 2 de la época, con read en su 4 y su posición en el 3; no son condiciones', () => {
  // VG 12-11 (estudio BQL-transacciones): el movimiento con fecha (X.7.9), la fecha a la que se refiere (X.7.7) y los tres
  // relojes fuera de orden (X.6.9, #42); y el coste de escribir (decisión 7), que se lee sobre la candidata (ev), sin
  // materializarse en ninguna posición.
  assert.deepEqual(LECTURAS.map((r) => r[0][0]), ['present', 'informative', 'attended', 'obligation', 'share', 'weight', 'maturity', 'attention group', 'attention price', 'stage', 'dated movement', 'for when', 'clocks out of order', 'the cost of writing']);
  assert.deepEqual(LECTURAS.map(posicionDeLectura), ['X.6.1', 'X.6.7', 'X.7.4', 'A.8.1', 'A.2.6.8', 'X.2.4.8', 'X.8.1', 'X.6.3', 'X.6.2', 'X.4.8', 'X.7.9', 'X.7.7', 'X.6.9', 'ev']);
  for (const r of LECTURAS) {
    assert.ok(esLectura(r));
    assert.equal(r.length, 10, 'una lectura lleva las diez posiciones, como toda regla');
    assert.ok(!EPOCA_0_BTML.condiciones.includes(r), r[0][0] + ' no es una condición');
    assert.match(evaluarRegla(r, new ContextoEje(null, { epoch: EPOCA_0_BTML })).motivo, /es una lectura/);
  }
  // y las diez de los puntos de vista (encargo «lecturas», «point of view» en su 4: tampoco son condiciones)
  assert.equal(EPOCA_0_BTML.reglasConId.length, EPOCA_0_BTML.condiciones.length + EPOCA_0_BTML.escrituras.length + LECTURAS.length + EPOCA_0_BTML.lecturasDePv.length);
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
  await entrarPorInvitacion(eje, { por: 'g', quien: 'ana', t: T0 });
  const recuerdo = await eje.escribir({ autor: 'ana', sobre: eje.alta('ana').id, t: T0, payload: 'lo que hice hace un año', movimientos: [{ token: 'T', escala: 'pasado', cantidad: 1, de: 'ana', a: null, refiere: '2025-11-08T10:00:00Z' }] });
  const ctx = new ContextoEje(eje, { epoch: EPOCA_0_BTML });
  assert.equal(esPresente(recuerdo), false);
  assert.deepEqual([uno('first ("' + recuerdo.id + '").6.1', ctx), uno('first ("' + recuerdo.id + '").6.7', ctx)], [false, true]);
  assert.deepEqual([uno('first ("' + eje.genesisId + '").6.1', ctx), uno('first ("' + eje.genesisId + '").6.7', ctx)], [true, false], 'el génesis es presente');
  // Lo leen otras expresiones por su posición, sin repetir la fórmula: los registros no presentes del libro.
  assert.deepEqual(evaluar('(before.1 where not first it.6.1) each 5', ctx).valor.filter((x) => typeof x === 'string'), [recuerdo.id]);
});

test('«obligation» (A.8.1) da lo mismo que eje.obligaciones: la R propia en manos ajenas, disponible o bloqueada', async () => {
  const { eje } = await conR();
  const ctx = new ContextoEje(eje, { epoch: EPOCA_0_BTML, ev: eje.obtener(eje.orden.at(-1)) });
  for (const id of eje.identidades()) assert.equal(uno('first ("' + id + '").8.1', ctx), eje.obligaciones(id), 'obligation de ' + id);
  assert.equal(eje.obligaciones('ana'), 5, 'bea 3 y otra 2; la devuelta vuelve a ana y no obliga');
  const lente = (await ejemploLente()).eje;
  const ctxLente = new ContextoEje(lente, { epoch: EPOCA_0_BTML });
  for (const id of lente.identidades()) assert.equal(uno('first ("' + id + '").8.1', ctxLente), lente.obligaciones(id), 'obligation de ' + id);
});

test('«attended» (X.7.4): una devolución de R queda atendida cuando su emisor ancla sobre ella un registro suyo con T real (como lente.devoluciones)', async () => {
  const { eje, dev } = await conR();
  const atendida = (e) => uno('first ("' + dev.id + '").7.4', new ContextoEje(e, { epoch: EPOCA_0_BTML }));
  assert.equal(atendida(eje), false);
  assert.equal(devoluciones(eje, 'ana')[0].atencion, null);
  // Un registro de otro sobre ella no la atiende; uno del emisor pagado solo con T informativo (sin T real), tampoco
  // (VG, 9-11, mapa §15 [D] «R, últimas dos»: atender lo define el PV2 del emisor; por defecto, con T real).
  await eje.escribir({ autor: 'otra', sobre: dev.id, t: T0, payload: 'yo no la atiendo', movimientos: [minuto('otra')] });
  assert.equal(atendida(eje), false);
  await eje.escribir({ autor: 'ana', sobre: dev.id, t: T0, payload: 'lo recuerdo', movimientos: [{ token: 'T', escala: 'inventado', cantidad: 1, de: 'ana', a: null }] });
  assert.equal(atendida(eje), false);
  const at = await eje.escribir({ autor: 'ana', sobre: dev.id, t: T0, payload: 'te atiendo', movimientos: [minuto('ana')] });
  assert.equal(devoluciones(eje, 'ana')[0].atencion, at.id);
  assert.equal(atendida(eje), true);
  const ctx = new ContextoEje(eje, { epoch: EPOCA_0_BTML });
  // Un registro que no devuelve R no está atendido aunque alguien lo cite.
  assert.equal(uno('first ("' + eje.genesisId + '").7.4', ctx), false);
});

// ---------- BQL lee transacciones (VG 12-11, estudio BQL-transacciones, decisiones 1-4) ----------

/** La compra con un subárbol de tres niveles bajo ella (la casa, la cocina y otra vez la casa) y su futuro. */
async function conTresNiveles() {
  const c = await ejemploCompra();
  const t = (m) => '2026-11-07T17:' + String(m).padStart(2, '0') + ':00Z';
  const uno = await c.eje.escribir({ autor: 'casa', sobre: c.compra.id, en: '9000000000', t: t(1), movimientos: [minuto('casa')], payload: [['Nivel 1']] });
  const dos = await c.eje.escribir({ autor: 'cocina', sobre: uno.id, en: '9000000000', t: t(2), movimientos: [minuto('cocina')], payload: [['Nivel 2']] });
  const tres = await c.eje.escribir({ autor: 'casa', sobre: dos.id, en: '9000000000', t: t(3), movimientos: [minuto('casa')], payload: [['Nivel 3']] });
  return { ...c, uno, dos, tres, ctx: new ContextoEje(c.eje, { epoch: EPOCA_0_BTML }) };
}

const conSujeto = (expr, ctx, sujeto, opciones = {}) => evaluar(expr, ctx, { sujeto, ...opciones });

test('under: el nodo y todo lo que cuelga de él, a cualquier profundidad y por llegada (un subárbol de tres niveles); de una hoja, ella sola; el presupuesto es su tope', async () => {
  const c = await conTresNiveles();
  const ids = (r) => r.valor.map((o) => c.ctx.valor(o));
  const deUno = conSujeto('=under it', c.ctx, c.uno.id);
  assert.deepEqual(ids(deUno), [c.uno.id, c.dos.id, c.tres.id]);
  assert.deepEqual(ids(conSujeto('=under it', c.ctx, c.tres.id)), [c.tres.id], 'una hoja: ella sola');
  const deCompra = ids(conSujeto('=under it', c.ctx, c.compra.id));
  assert.deepEqual(deCompra, c.eje.orden.filter((id) => c.eje.hilo(id).some((e) => e.id === c.compra.id)), 'por llegada, todo el subárbol');
  assert.deepEqual(deCompra.slice(-3), [c.uno.id, c.dos.id, c.tres.id]);
  // el tercer nivel bajo la compra: su hilo es tres más largo
  assert.deepEqual(ids(conSujeto('=(under it) where count (path it2) = count (path it) + 3', c.ctx, c.compra.id)), [c.tres.id]);
  // down baja uno; under, todos
  assert.equal(conSujeto('=count (under it) - count (down it)', c.ctx, c.uno.id).valor[0], 2);
  // el presupuesto: un subárbol mayor que él es PENDIENTE POR LÍMITE
  const corto = conSujeto('=count (under it)', c.ctx, c.compra.id, { limites: { ocupantes: 2 } });
  assert.deepEqual([corto.estado, corto.subtipo], ['PENDIENTE', 'PENDIENTE POR LÍMITE']);
  // de algo que no es un registro, ERROR
  assert.equal(evaluar('under "casa"', c.ctx).estado, 'ERROR');
  assert.equal(evaluar('under 3', c.ctx).estado, 'ERROR');
});

test('moves: los asientos del libro de un registro (también los que añade el libro, con su clase en 4.1), de una identidad y de una serie; un nodo sin movimientos da nada; una identidad sin alta es ERROR', async () => {
  const c = await conTresNiveles();
  const v = (expr, sujeto) => { const r = conSujeto(expr, c.ctx, sujeto); assert.equal(r.estado, 'RESUELTO', expr + ': ' + r.motivo); return r.valor; };
  // de un registro: lo que asentó su transacción, con la asignación del día que añade el libro
  const delLibro = c.eje.libro.asientos().filter((a) => a.tx?.id === c.dos.id);
  const PRIMITIVA = { acunar: 'mint', transferir: 'transfer', bloquear: 'lock', liberar: 'release', quemar: 'burn' };
  assert.deepEqual(v('=(moves it) each 4.0', c.dos.id).map((s) => s.simbolo), delLibro.map((a) => PRIMITIVA[a.primitiva]));
  assert.ok(delLibro.some((a) => a.clase) && delLibro.some((a) => !a.clase));
  assert.deepEqual(v('=(moves it) each 4.1', c.dos.id), delLibro.filter((a) => a.clase).map((a) => a.clase), 'la clase del asiento: solo la tiene lo que añade el libro (la asignación, la obtención…)');
  assert.equal(v('=count (moves it where burn in it2.4)', c.dos.id)[0], 1, 'el 4 vale su primitiva');
  assert.equal(c.ctx.valor(v('=(first (moves it)).0', c.dos.id)[0]), 'T:minuto', 'la serie vale su clave');
  // 6: el instante y el registro que lo asienta
  assert.deepEqual(v('=(moves it) each 6.0', c.dos.id), delLibro.map(() => c.dos.t));
  assert.deepEqual(v('=(moves it) each 6.5', c.dos.id).map((o) => c.ctx.valor(o)), delLibro.map(() => c.dos.id));
  assert.equal(v('=(first (moves it)).6.0.0', c.dos.id)[0], Math.floor(Date.parse(c.dos.t) / 1000));
  // lo mismo que el libro: tantos asientos como los del diario
  for (const id of c.eje.orden) assert.equal(v('=count (moves it)', id)[0], c.eje.libro.asientos().filter((a) => a.tx?.id === id).length, id.slice(0, 8));
  // de una identidad: donde es de o a
  const deCocina = v('=moves "cocina"');
  assert.ok(deCocina.length > 0 && deCocina.every((o) => o.a.de === 'cocina' || o.a.a === 'cocina'));
  assert.equal(deCocina.length, c.eje.libro.asientos().filter((a) => a.de === 'cocina' || a.a === 'cocina').length);
  // de una serie del libro (por su valor en before.4; un texto no la fabrica)
  assert.equal(v('=count (moves before.4.("T:minuto"))')[0], c.eje.libro.asientos({ serie: 'T:minuto' }).length);
  // nada que mover: la candidata sin movimientos
  const vacia = new ContextoEje(c.eje, { epoch: EPOCA_0_BTML, ev: { autor: 'casa', sobre: c.compra.id, t: '2026-11-07T18:00:00Z', movimientos: [], payload: ['nada'] } });
  assert.equal(evaluar('count (moves ev)', vacia).valor[0], 0);
  // una identidad sin alta, un número o un contexto sin libro: ERROR
  assert.match(evaluar('moves "fulano"', c.ctx).motivo, /no es un registro, una identidad ni una serie/);
  assert.equal(evaluar('moves 3', c.ctx).estado, 'ERROR');
  assert.equal(evaluar('moves "casa"', new ContextoEje(null, {})).estado, 'ERROR');
  // SEG-09: el payload no fabrica asientos: una décupla del payload con «asignacion» en su 4.1 no es un movimiento
  const falso = await c.eje.escribir({ autor: 'casa', sobre: c.compra.id, en: '9000000000', t: '2026-11-07T18:01:00Z', movimientos: [minuto('casa')], payload: [['falso'], [[['T:minuto'], [99], ['sin estado'], [['casa'], ['casa']], ['mint', 'asignacion']]]] });
  assert.equal(v('=count (moves it where it2.4.1 = "asignacion")', falso.id)[0], 1, 'solo la asignación de verdad');
  assert.equal(v('=count (moves it where it2.1 = 99)', falso.id)[0], 0);
});

test('by: ordena por un número o un texto, de menor a mayor y los empates por llegada; da el siguiente it como where; una clave vacía es PENDIENTE y mezclar tipos, ERROR', async () => {
  const c = await conTresNiveles();
  const ids = (r) => r.valor.map((o) => c.ctx.valor(o));
  // al revés de la llegada: por su instante, lo último primero
  assert.deepEqual(ids(conSujeto('=(under it) by 0 - (first it2.6.0).0', c.ctx, c.uno.id)), [c.tres.id, c.dos.id, c.uno.id]);
  // por un texto (el autor, también si no tiene alta): casa, casa, cocina; los empates (casa), por llegada
  assert.deepEqual(ids(conSujeto('=(under it) by first it2.3', c.ctx, c.uno.id)), [c.uno.id, c.tres.id, c.dos.id]);
  // un by dentro de un where: el elemento del where es it2 y el del by, it3
  assert.equal(conSujeto('=count ((under it) where count ((down it2) by first it3.3) > 0)', c.ctx, c.uno.id).valor[0], 2);
  // claves
  assert.equal(conSujeto('=(under it) by first it2.9', c.ctx, c.uno.id).estado, 'PENDIENTE', 'una clave vacía');
  assert.equal(conSujeto('=(under it) by it2.6', c.ctx, c.uno.id).estado, 'ERROR', 'una décupla no es una clave');
  assert.match(evaluar('(before.3) by 1', c.ctx).estado, /RESUELTO/);
  assert.throws(() => analizar('it by 1'), /it solo vale dentro de where/);
});

test('D-MOV 7.2 (bloqueado hasta: la salida que es un instante, que se despliega como fecha) y X.6.8 (los tres relojes: el del libro; Nostr y Bitcoin vacíos); los tres relojes en orden no son una cuenta rara', async () => {
  const c = await ejemploCompra();
  const futuro = await ejemploFuturoYCohorte(c.eje, c);
  const ctx = new ContextoEje(c.eje, { epoch: EPOCA_0_BTML });
  const lock = '(first (moves it where lock in it2.4))';
  assert.equal(conSujeto('=first ' + lock + '.7.2', ctx, futuro.plazo.id).valor[0], '2026-11-30T12:00:00Z');
  assert.equal(conSujeto('=(first ' + lock + '.7.2).0', ctx, futuro.plazo.id).valor[0], Date.parse('2026-11-30T12:00:00Z') / 1000);
  assert.equal(conSujeto('=(first (' + lock + '.2 where it2 != "bloqueo")).3', ctx, futuro.plazo.id).valor[0], diaCivil('2026-11-30T12:00:00Z'), 'la salida que es un instante se despliega (D-FECHA)');
  assert.equal(conSujeto('=count (moves it where count it2.7.2 > 0)', ctx, futuro.manana.id).valor[0], 0, 'sin bloqueo, sin 7.2');
  // los relojes
  assert.equal(conSujeto('=first (first it.6).8.0', ctx, futuro.plazo.id).valor[0], c.eje.obtener(futuro.plazo.id).t);
  assert.equal(conSujeto('=count (first it.6).8.1 + count (first it.6).8.2', ctx, futuro.plazo.id).valor[0], 0);
  assert.equal(conSujeto('=first (first it.6).9', ctx, futuro.plazo.id).valor[0], false, '«clocks out of order»: hoy, nunca');
  assert.deepEqual(evaluar('epoch.7.3.0', ctx).valor, [600]);
});
