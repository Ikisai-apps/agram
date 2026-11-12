// «verificado» como regla de la época (encargo «verificado-regla»; VG 12-11, #64 d, #67 y #50; docs/CONTRATO.md §4.4):
// las lecturas «sealed» (X.6.8.5: la prueba del sello de tiempo copiada en X.6.8.2, la décupla del SIP 0, que desde el
// encargo «taproot» ancla por Taproot: VG 13-11, H20) y «received» (X.6.8.4: el recibo de llegada copiado en X.6.8.1) son
// reglas de la época escritas con las primitivas de verificación; contrato.verificado es la fachada que las evalúa. Y
// «paid» (X.6.8.6: el recibo de pago de StateArk copiado en X.6.8.3), con el carril de pagos de la simulación ddcc475 (observador y puntero). Sellos completos sintéticos (test/ayudas-sello.js) y los de la
// simulación de StateArk (servidor/sim/sello-agram.js): verdadero con todo; PENDIENTE si falta un dato; falso con una
// clave no declarada, una firma mala o una prueba que no cuadra. Y «sin verificar no se ejecuta»: las estaciones de
// epoch.4.3 con y sin sello configurado, y «pendiente de sello» en la carta.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contrato, acciones, sello as selloDe } from '../src/index.js';
import { Eje } from '../src/eje.js';
import { evaluar } from '../src/bqlm.js';
import { ContextoEje } from '../src/contexto-eje.js';
import { EPOCA_0_BTML } from '../src/epocas.js';
import { generarClaves } from '../src/autoridad.js';
import { validarPayload } from '../src/btml.js';
import { selloSimulado } from '../servidor/sim/sello-agram.js';
import { selloComoDecupla, Simulacion, Custodia, esquemaNoble, firmaSimulada, mensajeAutorizacion } from '../servidor/sim/stateark/index.js';
import { huella } from '../servidor/sim/stateark/canon.js';
import { sha256Texto } from '../servidor/sim/stateark/hash.js';
import { schnorr } from '../src/vendor/noble-secp256k1.js';
import { arbol as arbolEnIdioma } from '../carta/carta.js';
import { html } from '../carta/dom.js';
import { ejemploCompra, ejemploFabrica } from '../ejemplos/ikisai/compra-food.mjs';
import { pagaElCoste } from './ayudas-coste.js';
import { selloCompleto, observadorDePrueba, releDePrueba, reciboFirmado, declararExterior, NUMS } from './ayudas-sello.js';

const T = (m) => '2026-11-10T10:' + String(m).padStart(2, '0') + ':00Z';
const regla = (nombre) => EPOCA_0_BTML.lecturas.find((r) => r[0][0] === nombre);
const leer = (eje, id, d) => evaluar('=first (first it.6).8.' + d, new ContextoEje(eje, { epoch: EPOCA_0_BTML }), { sujeto: id });

/** Un eje con firmas, dos registros y la cuenta raíz (vg) con sus ajustes del exterior. */
async function ejeDePrueba({ observadores = [], sello } = {}) {
  const cuenta = await generarClaves();
  const eje = await Eje.genesis({ identidad: 'vg', foco: ['mi eje'], t: T(0), clave: cuenta.publica, privada: cuenta.privada, exigirFirmas: true });
  const e1 = await eje.escribir({ autor: 'vg', sobre: eje.genesisId, t: T(1), movimientos: [pagaElCoste('vg')], payload: ['uno'] }, cuenta.privada);
  const e2 = await eje.escribir({ autor: 'vg', sobre: e1.id, t: T(2), movimientos: [pagaElCoste('vg')], payload: ['dos'] }, cuenta.privada);
  if (observadores.length || sello) await declararExterior(eje, { observadores, sello, privada: cuenta.privada, t: T(3) });
  return { cuenta, eje, e1, e2 };
}

test('las reglas están en el 2 de la época: «sealed» en X.6.8.5, «received» en X.6.8.4 y «paid» en X.6.8.6, lecturas (read) que no mueven', () => {
  for (const [nombre, donde] of [['sealed', 'X.6.8.5'], ['received', 'X.6.8.4']]) {
    const r = regla(nombre);
    assert.ok(r, nombre + ' está en EPOCA_0_BTML.lecturas');
    assert.equal(r.length, 10, 'las diez posiciones del molde');
    assert.deepEqual(r[3], [donde]);
    assert.deepEqual(r[4], ['read']);
    assert.ok(!EPOCA_0_BTML.condiciones.includes(r), 'no es una condición de la transacción');
    assert.match(contrato.mensaje(null, r, 'es'), /^(sealed|received): /, 'su 9 en español (epoch.9.4)');
  }
  assert.deepEqual(regla('paid')[3], ['X.6.8.6'], '«paid» en X.6.8.6, junto al recibo de pago copiado en X.6.8.3');
  assert.deepEqual(regla('paid')[4], ['read']);
  assert.match(contrato.mensaje(null, regla('paid'), 'es'), /^paid: /);
  const f = regla('sealed')[2].at(-1);
  assert.match(f, /signed\(.*"StateArk\/Observador\/Cabecera\/v1"\), bytes\(.*\.7\.3\)\) and first .*\.7\.3 in before\.8\.6 and /);
  assert.match(f, /below\(reverse\(/, 'la prueba de trabajo de la cabecera');
  assert.match(f, /cat\(bytes\("5120"\), taptweak\(bytes\(first .*\.8\.2\), tapleaf\(cat\(bytes\("6a20"\), bytes\(first .*\.3\)\)\), .*\.8\.3\)\) = first \(nth \(first .*\.8\.1\) \(first tx\(bytes\(first .*\.8\.0\)\)\)\.2\)\.1/, 'la cadena Taproot: hoja de compromiso, TapTweak y la salida de la transacción de anclaje');
  assert.match(f, /merkle\(first \(first tx\(.*\)\)\.5, .*\.7\.4, .*\.7\.5, "bitcoin"\)/, 'el txid de la transacción de anclaje llega a la cabecera');
  assert.doesNotMatch(f, /ots\(/, 'ots queda como primitiva sin uso');
  assert.match(f, /"taproot" in .*\.6$/);
});

test('un solo mapa de posiciones del sello: la fórmula de «sealed» es la que escribe formulaDeSellado() con él, y decuplaDeSello pone cada parte donde dice', async () => {
  assert.equal(regla('sealed')[2].at(-1), selloDe.formulaDeSellado(), 'datos/epocas/reglas/sealed.json se reescribe con formulaDeSellado()');
  const obs = await observadorDePrueba();
  const id = 'ab'.repeat(32);
  const { decupla } = await selloCompleto(id, { altura: 7, observador: obs, ids: [id, 'cd'.repeat(32)] });
  // Lo que hay en la posición del mapa (una lista de uno, como la lee BTML, se lee como su elemento).
  const en = (k) => { const x = selloDe.POSICIONES_DEL_SELLO[k].split('.').map(Number).reduce((y, d) => y?.[d], decupla); return Array.isArray(x) && x.length === 1 && !Array.isArray(x[0]) ? x[0] : x; };
  assert.ok([en('clase')].flat().includes(selloDe.POSICIONES_DEL_SELLO.marca));
  assert.deepEqual([en('altura'), en('id'), en('clave')], [7, id, obs.publica]);
  for (const k of ['hash', 'lote']) assert.match(en(k), /^[0-9a-f]{64}$/);
  assert.match(en('cabecera'), /^[0-9a-f]{160}$/);
  assert.match(en('firma'), /^[0-9a-f]{128}$/);
  assert.equal(en('alturaLe'), '07000000');
  // El anclaje Taproot (8): la transacción, la salida, la clave interna y, con otros lotes, los hermanos.
  assert.match(en('tx'), /^02000000/);
  assert.deepEqual([en('vout'), en('interna')], [0, NUMS]);
  assert.equal(en('via'), 'taproot');
  // El camino «sip», sin tuplas: los lados y los hermanos en dos posiciones hermanas, en paralelo.
  assert.equal(en('lados'), 'd');
  assert.match(en('hermanos'), /^[0-9a-f]{64}$/);
  const { decupla: conTodo } = await selloCompleto(id, { observador: obs, ids: [id, 'cd'.repeat(32), 'ef'.repeat(32)], otrosLotes: 3, otrasTx: 2 });
  for (const k of ['ladosBitcoin', 'hermanosBitcoin', 'hermanosTaproot', 'lados', 'hermanos']) {
    const x = selloDe.POSICIONES_DEL_SELLO[k].split('.').map(Number).reduce((y, d) => y?.[d], conTodo);
    assert.ok(Array.isArray(x) && x.length >= 1, k + ' es una lista en su posición');
  }
  // Otro mapa da otra fórmula (lo que habrá que hacer cuando StateArk cambie la forma del sello).
  assert.notEqual(selloDe.formulaDeSellado({ ...selloDe.POSICIONES_DEL_SELLO, clave: '9' }), selloDe.formulaDeSellado());
});

test('sello completo sintético con la clave del observador declarada por la cuenta raíz: «sealed» verdadero y verificado ok', async () => {
  const obs = await observadorDePrueba();
  const { eje, e1, e2 } = await ejeDePrueba({ observadores: [obs.publica] });
  assert.deepEqual(evaluar('before.8.6', new ContextoEje(eje, { epoch: EPOCA_0_BTML })).valor, [obs.publica], 'before.8.6: las «observer keys» de la cuenta raíz');
  eje.marcarSello(e1.id, await selloCompleto(e1.id, { altura: 7, observador: obs }));
  assert.equal(eje.sello(e1.id).decupla[0][0], 'sello de tiempo', 'la prueba copiada se guarda con el sello');
  assert.deepEqual(leer(eje, e1.id, 5).valor, [true]);
  assert.deepEqual(contrato.verificado(eje, e1.id), { ok: true, sello: true, recibo: null, relojes: true, pago: null, altura: 7, profundidad: 1, enFirme: false, pendiente: [], pendienteDeSello: false });
  // En un lote de varios ids, con su camino «sip», otros lotes en el mismo anclaje (hermanos Taproot) y otras transacciones
  // en el bloque (camino «bitcoin»): también.
  eje.marcarSello(e2.id, await selloCompleto(e2.id, { altura: 9, observador: obs, ids: [e1.id, e2.id, eje.genesisId], otrosLotes: 2, otrasTx: 3 }));
  assert.ok(eje.sello(e2.id).decupla[9][0].length >= 1, 'un camino de verdad (los lados en el 9.0 y los hermanos en el 9.1, al final: solo si lo hay)');
  assert.equal(eje.sello(e2.id).decupla[8].length, 4, 'con hermanos Taproot (8.3)');
  assert.equal(eje.sello(e2.id).decupla[7].length, 6, 'con camino «bitcoin» (7.4, 7.5)');
  assert.equal(eje.sello(e1.id).decupla.length, 9, 'un lote de un solo id: sin camino «sip», sin posición 9 (ni hueco ni «-»)');
  assert.equal(contrato.verificado(eje, e2.id).sello, true);
});

test('falta 7.0 (o la firma, o la clave): PENDIENTE, nunca verdadero; sin sello, también PENDIENTE', async () => {
  const obs = await observadorDePrueba();
  const { eje, e1, e2 } = await ejeDePrueba({ observadores: [obs.publica] });
  const sinSello = contrato.verificado(eje, e1.id);
  assert.equal(sinSello.sello, false);
  assert.deepEqual(sinSello.pendiente.map((p) => p.lectura), ['sello']);
  assert.equal(leer(eje, e1.id, 5).estado, 'PENDIENTE');
  // Sin cabecera (7.0), como el sello de la simulación antes de H9: la décupla no lleva lo observado (7), sin huecos.
  eje.marcarSello(e1.id, await selloCompleto(e1.id, { observador: obs, cambiar: (p) => { delete p.prueba.cabecera; } }));
  assert.equal(eje.sello(e1.id).decupla.length, 7);
  assert.ok(!JSON.stringify(eje.sello(e1.id).decupla).includes('"-"'), 'sin relleno');
  const r = leer(eje, e1.id, 5);
  assert.equal(r.estado, 'PENDIENTE');
  assert.match(r.motivo, /^sealed: .*vacía/);
  const v = contrato.verificado(eje, e1.id);
  assert.deepEqual([v.ok, v.sello, v.pendiente.map((p) => p.lectura)], [false, false, ['sello']]);
  // Sin la firma ni la clave del observador (7.1, 7.3).
  eje.marcarSello(e2.id, await selloCompleto(e2.id, { observador: obs, cambiar: (p) => { delete p.prueba.observador; } }));
  assert.equal(leer(eje, e2.id, 5).estado, 'PENDIENTE');
  assert.equal(contrato.verificado(eje, e2.id).sello, false);
  // Sin el anclaje Taproot (la transacción, el vout o la clave interna: 8.0-8.2), aunque el lote tenga varios ids (sin 8
  // no puede ir el camino «sip», 9): PENDIENTE, no falso.
  for (const cambiar of [(p) => { delete p.prueba.taproot; }, (p) => { delete p.prueba.taproot.tx; }, (p) => { delete p.prueba.taproot.interna; }, (p) => { p.prueba.taproot.vout = -1; }]) {
    const { eje: b, e1: y1, e2: y2 } = await ejeDePrueba({ observadores: [obs.publica] });
    b.marcarSello(y1.id, await selloCompleto(y1.id, { observador: obs, ids: [y1.id, y2.id], cambiar }));
    assert.equal(b.sello(y1.id).decupla.length, 8, 'con lo observado (7) y sin anclaje (8) ni camino (9)');
    const r = leer(b, y1.id, 5);
    assert.equal(r.estado, 'PENDIENTE', r.motivo);
    assert.deepEqual(contrato.verificado(b, y1.id).pendiente.map((p) => p.lectura), ['sello']);
  }
});

test('clave no declarada, firma mala, prueba que no cuadra: «sealed» falso (no pendiente)', async () => {
  const obs = await observadorDePrueba();
  const otro = await observadorDePrueba();
  const { eje, e1, e2 } = await ejeDePrueba({ observadores: [obs.publica] });
  // Firmado por un observador que la cuenta raíz no declaró.
  eje.marcarSello(e1.id, await selloCompleto(e1.id, { observador: otro }));
  assert.deepEqual(leer(eje, e1.id, 5).valor, [false]);
  assert.deepEqual([contrato.verificado(eje, e1.id).sello, contrato.verificado(eje, e1.id).pendiente], [false, []]);
  // La clave declarada, pero la firma de otro.
  const ajena = await selloCompleto(e2.id, { observador: otro });
  eje.marcarSello(e2.id, await selloCompleto(e2.id, { observador: obs, cambiar: (p) => { p.prueba.observador.firma = ajena.decupla[7][1][0]; } }));
  assert.deepEqual(leer(eje, e2.id, 5).valor, [false]);
  // La prueba de otro registro (su hoja no es este id): no se guarda la décupla (su 5 no es este id), luego PENDIENTE.
  const { eje: eje2, e1: x1, e2: x2 } = await ejeDePrueba({ observadores: [obs.publica] });
  const deOtro = await selloCompleto(x2.id, { observador: obs });
  eje2.marcarSello(x1.id, { ...deOtro });
  assert.equal(eje2.sello(x1.id).decupla, undefined, 'una décupla que no es de este id no se guarda');
  // Una altura firmada que no es la del sello: falso.
  eje2.marcarSello(x2.id, await selloCompleto(x2.id, { altura: 5, observador: obs, cambiar: (p) => { p.prueba.observador.altura_le = '06000000'; } }));
  assert.deepEqual(leer(eje2, x2.id, 5).valor, [false]);
  // La cadena Taproot manipulada: otra clave interna (un punto de la curva), un hermano Taproot de más o cambiado, otra
  // salida, una vía que no es «taproot»: falso.
  const G = '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
  for (const [que, opciones, cambiar] of [
    ['otra interna', {}, (p) => { p.prueba.taproot.interna = G; }],
    ['un hermano de más', {}, (p) => { p.prueba.taproot.hermanos.push('ab'.repeat(32)); }],
    ['un hermano cambiado', { otrosLotes: 2 }, (p) => { p.prueba.taproot.hermanos[0] = 'cd'.repeat(32); }],
    ['un camino «bitcoin» cambiado', { otrasTx: 2 }, (p) => { p.prueba.pasos[0][1] = 'ef'.repeat(32); }],
    ['otra vía', {}, (p) => { p.prueba.via = 'opentimestamps'; }],
  ]) {
    const { eje: b, e1: y1 } = await ejeDePrueba({ observadores: [obs.publica] });
    b.marcarSello(y1.id, await selloCompleto(y1.id, { observador: obs, ...opciones, cambiar }));
    assert.deepEqual(leer(b, y1.id, 5).valor, [false], que);
    assert.equal(contrato.verificado(b, y1.id).sello, false, que);
  }
  // Una interna que no es la x de un punto de la curva: ERROR (nunca verdadero).
  const { eje: b, e1: y1 } = await ejeDePrueba({ observadores: [obs.publica] });
  b.marcarSello(y1.id, await selloCompleto(y1.id, { observador: obs, cambiar: (p) => { p.prueba.taproot.interna = '0'.repeat(63) + '5'; } }));
  const r = leer(b, y1.id, 5);
  assert.equal(r.estado, 'ERROR');
  assert.match(r.motivo, /taptweak: la clave interna no es la x de un punto/);
  assert.equal(contrato.verificado(b, y1.id).sello, false);
});

test('profundidad y en firme: con la regla verdadera, las confirmaciones de la cuenta raíz; sin ella, nunca en firme', async () => {
  const obs = await observadorDePrueba();
  const { eje, e1, e2 } = await ejeDePrueba({ observadores: [obs.publica] });
  eje.marcarSello(e1.id, await selloCompleto(e1.id, { altura: 100, observador: obs }));
  eje.marcarSello(e2.id, await selloCompleto(e2.id, { altura: 105, observador: obs }));
  const de = (id) => { const v = contrato.verificado(eje, id); return [v.altura, v.profundidad, v.enFirme]; };
  assert.deepEqual(de(e1.id), [100, 6, true], '105 − 100 + 1 = 6, las 6 por defecto');
  assert.deepEqual(de(e2.id), [105, 1, false]);
  // El mismo bloque sin la prueba copiada: la profundidad se sabe, pero no está sellado ni en firme.
  const { eje: b, e1: y1, e2: y2 } = await ejeDePrueba({ observadores: [obs.publica] });
  b.marcarSello(y1.id, { altura: 100, hash: 'a'.repeat(64), instante: '2026-11-10T11:00:00.000Z', verificado: true });
  b.marcarSello(y2.id, { altura: 105, hash: 'b'.repeat(64), instante: '2026-11-10T11:00:00.000Z', verificado: true });
  const v = contrato.verificado(b, y1.id);
  assert.deepEqual([v.altura, v.profundidad, v.enFirme, v.sello], [100, 6, false, false]);
});

test('con la simulación de StateArk (0ddd6e7, el sello por Taproot): la prueba trae el anclaje, la cabecera, los caminos y el observador; «sealed» verdadero si la cuenta raíz declara su clave, con y sin caminos «sip», «bitcoin» y hermanos Taproot', async () => {
  const s = selloSimulado({ inicio: '2026-11-10T11:00:00.000Z', reloj: () => Date.parse('2026-11-10T11:00:00.000Z') });
  const { eje, e1, e2 } = await ejeDePrueba({ observadores: [await s.claveObservador()] });
  // Un bloque con un solo lote y la transacción de anclaje sola (sin hermanos Taproot ni camino «bitcoin»), y otro con dos
  // lotes en el mismo anclaje y otra transacción en el bloque (con los dos).
  await s.sellar([e1.id, eje.genesisId]);
  await s.minar();
  await s.sellar([e2.id]);
  await s.sellar(['ee'.repeat(32)]);
  await (await s.sellador).minar(['ff'.repeat(32)]);
  const p1 = await s.prueba(e1.id);
  assert.deepEqual([p1.prueba.via, p1.prueba.taproot.hermanos.length, p1.prueba.pasos.length], ['taproot', 0, 0]);
  const p2 = await s.prueba(e2.id);
  assert.ok(p2.prueba.taproot.hermanos.length > 0, 'dos lotes en el anclaje: hermanos Taproot');
  assert.ok(p2.prueba.pasos.length > 0, 'dos transacciones en el bloque: camino «bitcoin» de la de anclaje a la cabecera');
  for (const [id, p] of [[e1.id, p1], [e2.id, p2]]) {
    // La misma décupla que la de la simulación, byte a byte (7 y 8 siempre décuplas, cada hoja suelta entre corchetes).
    assert.deepEqual(selloDe.decuplaDeSello(p, id), selloComoDecupla(p, id));
    assert.equal(validarPayload(selloDe.decuplaDeSello(p, id)).ok, true);
    assert.equal((await s.verificar(id, p)).ok, true);
    eje.marcarSello(id, { altura: p.altura, hash: p.hash, instante: p.instante, verificado: true, decupla: selloDe.decuplaDeSello(p, id) });
    assert.deepEqual(leer(eje, id, 5).valor, [true], 'la regla «sealed» da verdadero con la sim');
    assert.equal(contrato.verificado(eje, id).ok, true);
  }
  // Sin declarar la clave del observador de la sim: falso.
  const { eje: otro, e1: o1 } = await ejeDePrueba();
  await s.sellar([o1.id]);
  await s.minar();
  const p = await s.prueba(o1.id);
  otro.marcarSello(o1.id, { altura: p.altura, hash: p.hash, instante: p.instante, verificado: true, decupla: selloDe.decuplaDeSello(p, o1.id) });
  assert.deepEqual(leer(otro, o1.id, 5).valor, [false]);
  // Una prueba de antes de H9 (sin cabecera ni observador) o de antes de Taproot (con cabecera y observador, sin anclaje):
  // PENDIENTE.
  for (const vieja of [(x) => ({ camino: x.camino, ots: null, via: 'simulado' }), (x) => ({ ...x, taproot: undefined, via: 'simulado' })]) {
    const { eje: e3, e1: z1 } = await ejeDePrueba({ observadores: [await s.claveObservador()] });
    await s.sellar([z1.id]);
    await s.minar();
    const pz = await s.prueba(z1.id);
    e3.marcarSello(z1.id, { altura: pz.altura, hash: pz.hash, instante: pz.instante, verificado: true, decupla: selloDe.decuplaDeSello({ ...pz, prueba: vieja(pz.prueba) }, z1.id) });
    assert.equal(leer(e3, z1.id, 5).estado, 'PENDIENTE');
  }
});

test('«received» (X.6.8.4): el recibo de llegada firmado por su relé es verdadero; con una firma mala, falso; sin el id del recibo, PENDIENTE', async () => {
  const obs = await observadorDePrueba();
  const rele = await releDePrueba();
  const { eje, e1, e2 } = await ejeDePrueba({ observadores: [obs.publica] });
  eje.marcarSello(e1.id, await selloCompleto(e1.id, { observador: obs }));
  eje.marcarRecibo(e1.id, reciboFirmado(rele, { instante: '2026-11-10T10:30:00.000Z' }));
  assert.deepEqual(leer(eje, e1.id, 4).valor, [true]);
  assert.deepEqual(contrato.verificado(eje, e1.id), { ok: true, sello: true, recibo: true, relojes: true, pago: null, altura: 1, profundidad: 1, enFirme: false, pendiente: [], pendienteDeSello: false });
  // e2: el transporte da recibos (e1 tiene) y e2 no tiene: false, sin pendiente de recibo.
  assert.equal(contrato.verificado(eje, e2.id).recibo, false);
  // Firma mala: la de otro id.
  const malo = { ...reciboFirmado(rele, { instante: '2026-11-10T10:31:00.000Z' }), firma: reciboFirmado(rele, { semilla: 'otro' }).firma };
  eje.marcarRecibo(e2.id, malo);
  assert.deepEqual(leer(eje, e2.id, 4).valor, [false]);
  assert.equal(contrato.verificado(eje, e2.id).recibo, false);
  // Sin el id del recibo (la forma de antes): PENDIENTE.
  const { eje: b, e1: y1 } = await ejeDePrueba();
  const { recibo, ...sinId } = reciboFirmado(rele);
  assert.ok(recibo);
  b.marcarRecibo(y1.id, sinId);
  assert.equal(leer(b, y1.id, 4).estado, 'PENDIENTE');
  assert.deepEqual(contrato.verificado(b, y1.id).pendiente.map((p) => p.lectura), ['sello', 'recibo']);
});

test('«sin verificar no se ejecuta» (epoch.4.3): sin sello configurado, ejecutada como siempre; con «seal url» en la raíz y sin sellar, autorizada y «pendiente de sello»; sellado, verificada', async () => {
  const c = await ejemploCompra();
  await ejemploFabrica(c.eje, c);
  const { eje, compra } = c;
  const deE = () => acciones.estaciones(eje, compra.id).find((e) => e.familia === 'E');
  const [anuncio] = deE().hechos;
  assert.ok(anuncio, 'la fábrica de la compra tiene un anuncio de E ya movido');
  assert.equal(acciones.estacionDeAnuncio(eje, anuncio), 'ejecutada', 'sin «seal url» en la cuenta raíz, como antes');
  assert.deepEqual(deE().pendientesDeSello, []);

  // La cuenta raíz (casa) configura el sello y declara su observador: lo movido sin sello comprobado se queda en autorizada.
  const obs = await observadorDePrueba();
  await declararExterior(eje, { observadores: [obs.publica], sello: 'http://127.0.0.1:8787' });
  assert.equal(acciones.estacionDeAnuncio(eje, anuncio), 'autorizada');
  assert.deepEqual(deE().pendientesDeSello, [anuncio]);
  assert.deepEqual(deE().hechos, [anuncio], 'nada se rechaza ni se deshace: sigue movido');
  const ej = acciones.ejecuciones(eje, compra.id).find((x) => x.ocupante?.ref === anuncio);
  assert.deepEqual([ej.estacion, ej.pendienteDeSello], ['autorizada', true]);

  // La carta: la celda del 4 lo pinta en el color de autorizada, con «pendiente de sello».
  const ORDENADOR = { ancho: 1920, alto: 1080 };
  const cuatro = html(await arbolEnIdioma({ foco: { X: compra.id, pv: 4 } }, eje, 'huesped', ORDENADOR, { idioma: 'es' }));
  assert.match(cuatro, /<li class="ejecucion" data-estado="autorizada"[^>]*>(?:(?!<\/li>).)*<small class="pendiente-sello" title="[^"]+">pendiente de sello<\/small><\/li>/s);

  // Sellar todo lo que lo cumple (lo anclado sobre el anuncio) con la prueba completa: verificada.
  const cumplen = eje.sobre(anuncio).map((h) => h.id);
  assert.ok(cumplen.length > 0);
  for (const [k, id] of cumplen.entries()) eje.marcarSello(id, await selloCompleto(id, { altura: 10 + k, observador: obs }));
  assert.equal(acciones.estacionDeAnuncio(eje, anuncio), 'verificada');
  assert.deepEqual(deE().pendientesDeSello, []);
  assert.deepEqual(deE().verificados, [anuncio]);
});

test('el reverso de un registro con sello configurado y sin sello comprobado dice «pendiente de sello»; sin sello configurado, nada', async () => {
  const c = await ejemploCompra();
  const { eje, compra } = c;
  const ORDENADOR = { ancho: 1920, alto: 1080 };
  const reverso = async () => arbolEnIdioma({ foco: { X: compra.id, pv: 5 } }, eje, 'huesped', ORDENADOR, { idioma: 'es' });
  assert.equal((await reverso()).centro.pendienteDeSello, undefined);
  assert.doesNotMatch(html(await reverso()), /pendiente-sello/);
  await declararExterior(eje, { sello: 'http://127.0.0.1:8787' });
  const r = await reverso();
  assert.equal(r.centro.pendienteDeSello, true);
  assert.match(html(r), /<p class="verificado-linea"><small class="pendiente-sello" title="[^"]+">pendiente de sello<\/small><\/p>/);
});

// ---------- «paid» (X.6.8.6): el recibo de pago de StateArk copiado en X.6.8.3 (encargos «taproot» y «pago2», Core AGRAM 13-11) ----------

const INICIO_PAGO = '2026-11-12T00:00:00.000Z';
const ordenDePago = (destino, extra = {}) => ({
  schema: 'stateark.payment-instruction@1', rail: 'bitcoin.onchain', asset: 'BTC',
  amount: { valor: 61_000, unidad: 'sat' }, destino,
  vencimiento: { marca: 'valido_hasta', valor: 50, fuente: 'consenso', unidad: 'bitcoin_block_height' },
  on_timeout: 'caducado', correlation_id: 'AGRAM-PAID', ...extra,
});

/** Un observador de cabeceras que firma con BIP-340 real (la noble de src/vendor) y su clave x-only: { custodia, nombre, clave }. */
async function observadorDeLaSim() {
  const custodia = new Custodia({ esquema: esquemaNoble(schnorr) });
  await custodia.crearClave('nostr', 'observador');
  return { custodia, nombre: 'observador', clave: await custodia.publica('nostr', 'observador') };
}

/**
 * Un pago del carril de la simulación de StateArk (ddcc475), con `n` pagos en el mismo bloque, observado por `observador`
 * (la clave que declara la cuenta raíz) y con `puntero` (el id de AGRAM) en el primero; sin él, sin puntero. Da el carril,
 * `pagar()` (un pago más, aún sin minar), la custodia del carril (BIP-340 real: lo que comprueba signed) y `firmar(campos)`,
 * el sobre del recibo único (Custodia.firmarRecibo) de unos campos (los de Carril.reciboPago, o unos tocados).
 */
async function pagoDeLaSim(n = 1, { observador, puntero } = {}) {
  const sim = await Simulacion.crear({ inicio: INICIO_PAGO, reloj: () => Date.parse(INICIO_PAGO), observador: { custodia: observador.custodia, nombre: observador.nombre } });
  const c = sim.carril;
  const vg = await sha256Texto('clave vg');
  await c.crearCartera('vg', { titular: vg });
  await c.crearCartera('aina', { titular: await sha256Texto('clave aina') });
  for (let k = 0; k < n; k++) await c.acunar(await c.direccion('vg'), 200_000);
  await sim.minar();
  const pagar = async (extra = {}) => {
    const ins = ordenDePago({ clase: 'bitcoin/address', valor: await c.direccion('aina') }, extra);
    const plan = await c.preparar('vg', ins);
    const firma = await firmaSimulada(vg, await mensajeAutorizacion(await huella(plan)));
    return c.ejecutar('vg', ins, plan, await c.autorizar(plan, { titular: vg, firma }));
  };
  const txids = [];
  for (let k = 0; k < n; k++) txids.push((await pagar(k === 0 && puntero ? { puntero } : {})).posicion.txid);
  await sim.minar();
  const custodia = new Custodia({ esquema: esquemaNoble(schnorr) });
  await custodia.crearClave('nostr', 'carril');
  let k = 0; // cada recibo, un segundo antes que el anterior: marcarPago se queda con el recibo más antiguo de un registro, y así cada caso reemplaza al de antes
  const firmar = (campos) => custodia.firmarRecibo('carril', campos, { t: new Date(Date.parse(INICIO_PAGO) - 1000 * k++).toISOString() });
  return { sim, c, txid: txids[0], pagar, firmar };
}

test('«paid» con el recibo de pago de la simulación (ddcc475): la transacción cruda está en el bloque firmado por el observador declarado, paga cuánto al destino y apunta a este registro, y el emisor firmó el recibo: verdadero; verificado lo da en «pago»', async () => {
  for (const [n, conPuntero] of [[1, true], [3, true], [1, false], [3, false]]) {
    const obs = await observadorDeLaSim();
    const { eje, e1, e2 } = await ejeDePrueba({ observadores: [obs.clave] });
    const { c, txid, firmar } = await pagoDeLaSim(n, { observador: obs, puntero: conPuntero ? e1.id : undefined });
    const campos = await c.reciboPago(txid);
    assert.equal(campos.ata.some(([k]) => k === 'puntero'), conPuntero);
    const sobre = await firmar(campos);
    assert.equal(eje.marcarPago(e1.id, sobre), true);
    const copiado = eje.pago(e1.id).decupla;
    // Dónde va cada cosa: el mapa del recibo de pago.
    const P = selloDe.POSICIONES_DEL_PAGO;
    const en = (k) => P[k].split('.').map(Number).reduce((y, d) => y?.[d], copiado);
    assert.deepEqual(en('clase'), ['recibo', 'pago']);
    assert.deepEqual(en('sujeto'), [txid]);
    assert.deepEqual([en('emisor'), en('t'), en('id'), en('firmaEmisor')], [sobre.emisor, sobre.t, sobre.id, sobre.firma]);
    assert.match(en('tx')[0], /^02000000/);
    assert.match(en('cabecera')[0], /^[0-9a-f]{160}$/);
    assert.match(en('firma')[0], /^[0-9a-f]{128}$/);
    assert.deepEqual([en('clave'), en('alturaLe')], [[obs.clave], [campos.evidencia[3][0]]]);
    assert.equal(copiado[2].includes(P.puntero), conPuntero, 'la clave «puntero» va en las claves 2 (y su valor en 3) solo si el recibo la trae');
    if (conPuntero) assert.equal(copiado[3][copiado[2].indexOf(P.puntero)], e1.id);
    assert.equal(copiado[3][copiado[2].indexOf('altura')], String(campos.ata[2][1]), 'la altura es TEXTO en el recibo');
    assert.equal(copiado[4].length, n === 1 ? 5 : 7, 'sin camino «bitcoin» si la transacción está sola en su bloque');
    assert.equal(validarPayload(copiado).ok, true);
    assert.deepEqual(leer(eje, e1.id, 6).valor, [true], `«paid» con ${n} pagos en el bloque${conPuntero ? ' y puntero' : ''}`);
    const v = contrato.verificado(eje, e1.id);
    assert.deepEqual([v.pago, v.pendiente.map((p) => p.lectura)], [true, ['sello']], 'el pago se da aparte; no entra en ok, que es de los relojes');
    // Sin recibo de pago: PENDIENTE, y verificado no lo exige.
    assert.equal(leer(eje, e2.id, 6).estado, 'PENDIENTE');
    assert.equal(contrato.verificado(eje, e2.id).pago, null);
  }
});

test('«paid» falso con un recibo firmado que miente (otro importe, destino, bloque, altura, camino, firma o clave del observador, puntero) o con la firma de otro; PENDIENTE sin recibo, sin observador (unobserved) o sin su evidencia; marcarPago no guarda lo que no da su id', async () => {
  const obs = await observadorDeLaSim();
  const { eje, e1, e2 } = await ejeDePrueba({ observadores: [obs.clave] });
  const { c, txid, pagar, firmar, sim } = await pagoDeLaSim(3, { observador: obs, puntero: e1.id });
  const campos = await c.reciboPago(txid);
  const ata = (k, v) => ({ ...structuredClone(campos), ata: campos.ata.map(([a, b]) => [a, a === k ? v : b]) });
  const evid = (f) => { const x = structuredClone(campos); f(x.evidencia); return x; };
  const otroObs = await observadorDeLaSim();
  const altura = campos.ata.find(([k]) => k === 'altura')[1];
  const casos = [
    ['otro importe', { ...structuredClone(campos), cuanto: [61_001, 'sat'] }],
    ['otra unidad', { ...structuredClone(campos), cuanto: [61_000, 'EUR'] }],
    ['otro destino', ata('destino', '0014' + '00'.repeat(20))],
    ['otro bloque', ata('bloque', '00'.repeat(32))],
    ['otra altura (no es la firmada)', ata('altura', String(Number(altura) + 1))],
    ['la altura con un cero delante', ata('altura', '0' + altura)],
    ['otro hermano del camino «bitcoin»', evid((e) => { e[6][0] = '11'.repeat(32); })],
    ['otro txid en el sujeto', { ...structuredClone(campos), sujeto: ['ab'.repeat(32)] }],
    ['otra firma del observador', evid((e) => { e[2][0] = 'ab'.repeat(64); })],
    ['otra altura firmada', evid((e) => { e[3][0] = '63000000'; })],
    ['una clave de observador no declarada (con su firma)', evid((e) => { e[4][0] = otroObs.clave; })],
    ['otro puntero en el recibo', ata('puntero', 'ab'.repeat(32))],
  ];
  for (const [que, tocados] of casos) {
    assert.equal(eje.marcarPago(e1.id, await firmar(tocados)), true, que + ': el recibo es BTML y da su id; la regla dice si es verdad');
    assert.deepEqual(leer(eje, e1.id, 6).valor, [false], que);
    assert.equal(contrato.verificado(eje, e1.id).pago, false, que);
  }
  // El recibo bueno, pero la cuenta raíz no declara al observador: falso.
  const { eje: sinDeclarar, e1: s1 } = await ejeDePrueba();
  assert.equal(sinDeclarar.marcarPago(s1.id, await firmar(campos)), true);
  assert.deepEqual(leer(sinDeclarar, s1.id, 6).valor, [false], 'el observador no es de la cuenta raíz');
  // El mismo recibo en otro registro (el puntero es el de e1, no el de e2): falso.
  const bueno = await firmar(campos);
  assert.equal(eje.marcarPago(e2.id, bueno), true);
  assert.deepEqual(leer(eje, e2.id, 6).valor, [false], 'el puntero es el de e1, no el de e2');
  // El puntero del recibo es el de este registro, pero la transacción apunta a otro: falso.
  const otroPago = await pagoDeLaSim(1, { observador: obs, puntero: 'cd'.repeat(32) });
  const otroCampos = await otroPago.c.reciboPago(otroPago.txid);
  const miente = { ...structuredClone(otroCampos), ata: otroCampos.ata.map(([a, b]) => [a, a === 'puntero' ? e1.id : b]) };
  assert.equal(eje.marcarPago(e1.id, await firmar(miente)), true);
  assert.deepEqual(leer(eje, e1.id, 6).valor, [false], 'la transacción no lleva agram:<id de e1>');
  // La firma de otro recibo (el id es el de este cuerpo, pero no lo firmó su emisor): falso.
  const otro = await firmar({ ...structuredClone(campos), noAfirma: ['nada'] });
  const { eje: eje3, e1: g1 } = await ejeDePrueba({ observadores: [obs.clave] });
  assert.equal(eje3.marcarPago(g1.id, { ...bueno, firma: otro.firma }), true);
  assert.deepEqual(leer(eje3, g1.id, 6).valor, [false]);
  // Lo que no se guarda: un id que no es el de su cuerpo, otra clase, otro esquema, un registro que el eje no tiene.
  const { eje: eje2, e1: f1, e2: f2 } = await ejeDePrueba({ observadores: [obs.clave] });
  assert.equal(eje2.marcarPago(f2.id, { ...bueno, id: otro.id }), false);
  assert.equal(eje2.marcarPago(f2.id, { ...bueno, schema: 'otro@1' }), false);
  assert.equal(eje2.marcarPago(f2.id, await firmar({ clase: 'sello', sujeto: [txid], universo: 'x', noAfirma: ['nada'] })), false);
  assert.equal(eje2.marcarPago('cd'.repeat(32), bueno), false);
  assert.equal(eje2.pago(f2.id), null);
  assert.equal(leer(eje2, f2.id, 6).estado, 'PENDIENTE');
  // Un recibo sin lo del observador (la evidencia de antes: [[tx], [cabecera]]) no dice nada de la cadena buena: PENDIENTE.
  const sola = await pagoDeLaSim(1, { observador: obs, puntero: f1.id });
  const camposSola = await sola.c.reciboPago(sola.txid);
  assert.equal(eje2.marcarPago(f1.id, await sola.firmar({ ...structuredClone(camposSola), evidencia: camposSola.evidencia.slice(0, 2) })), true);
  assert.equal(leer(eje2, f1.id, 6).estado, 'PENDIENTE', 'sin la firma del observador, ni verdadero ni falso');
  assert.deepEqual(contrato.verificado(eje2, f1.id).pendiente.map((p) => p.lectura).sort(), ['pago', 'sello'], 'verificado lo da en «pendiente», no como verdadero');
  assert.notEqual(contrato.verificado(eje2, f1.id).pago, true);
  // El observador aún no ha firmado la cabecera de ese bloque («unobserved»), o el pago aún no está en un bloque
  // («unconfirmed»): no hay recibo de pago que copiar y «paid» queda PENDIENTE.
  sim.carril.sellador.observaciones.delete(Number(altura));
  await assert.rejects(c.reciboPago(txid), /unobserved/);
  const r = await pagar();
  await assert.rejects(c.reciboPago(r.posicion.txid), /unconfirmed/);
  assert.deepEqual(contrato.verificado(eje2, f2.id).pendiente.map((p) => p.lectura), ['sello']);
  assert.equal(contrato.verificado(eje2, f2.id).pago, null);
});

test('un solo mapa del recibo de pago: la fórmula de «paid» es la que escribe formulaDePago() con él', () => {
  assert.equal(regla('paid')[2].at(-1), selloDe.formulaDePago());
  assert.notEqual(selloDe.formulaDePago({ ...selloDe.POSICIONES_DEL_PAGO, firma: '9' }), selloDe.formulaDePago());
  assert.notEqual(selloDe.formulaDePago({ ...selloDe.POSICIONES_DEL_PAGO, hermanos: '4.7' }), selloDe.formulaDePago());
  const f = regla('paid')[2].at(-1);
  assert.match(f, /^=signed\(bytes\(first \(first \(first it\.6\)\.8\.3\)\.8\)/, 'primero la firma del emisor: sin recibo, PENDIENTE');
  assert.match(f, /merkle\(.*\.4\.5, .*\.4\.6, "bitcoin"\)/, 'el camino «bitcoin» está en 4.5 y 4.6');
  assert.match(f, /hash\(le\(bytes\(first .*\.4\.3\)\)\) = sha256\(utf8\(first lookup\(.*"altura"\)\)\)/, 'la altura del recibo (texto) contra la firmada');
  assert.match(f, / in before\.8\.6 /, 'la clave del observador, declarada');
  assert.match(f, /"puntero" in .* or .* = first it\.5.*6a46/, 'el puntero, si lo hay, es este registro y va en una salida 6a46 ‖ agram:<id>');
});
