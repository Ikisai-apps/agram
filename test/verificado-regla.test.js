// «verificado» como regla de la época (encargo «verificado-regla»; VG 12-11, #64 d, #67 y #50; docs/CONTRATO.md §4.4):
// las lecturas «sealed» (X.6.8.5: la prueba del sello de tiempo copiada en X.6.8.2, la décupla del SIP 0) y «received»
// (X.6.8.4: el recibo de llegada copiado en X.6.8.1) son reglas de la época escritas con las primitivas de verificación;
// contrato.verificado es la fachada que las evalúa. Sellos completos sintéticos (test/ayudas-sello.js) y los de la
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
import { selloComoDecupla } from '../servidor/sim/stateark/index.js';
import { arbol as arbolEnIdioma } from '../carta/carta.js';
import { html } from '../carta/dom.js';
import { ejemploCompra, ejemploFabrica } from '../ejemplos/ikisai/compra-food.mjs';
import { pagaElCoste } from './ayudas-coste.js';
import { selloCompleto, observadorDePrueba, releDePrueba, reciboFirmado, declararExterior } from './ayudas-sello.js';

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

test('las dos reglas están en el 2 de la época: «sealed» en X.6.8.5 y «received» en X.6.8.4, lecturas (read) que no mueven', () => {
  for (const [nombre, donde] of [['sealed', 'X.6.8.5'], ['received', 'X.6.8.4']]) {
    const r = regla(nombre);
    assert.ok(r, nombre + ' está en EPOCA_0_BTML.lecturas');
    assert.equal(r.length, 10, 'las diez posiciones del molde');
    assert.deepEqual(r[3], [donde]);
    assert.deepEqual(r[4], ['read']);
    assert.ok(!EPOCA_0_BTML.condiciones.includes(r), 'no es una condición de la transacción');
    assert.match(contrato.mensaje(null, r, 'es'), /^(sealed|received): /, 'su 9 en español (epoch.9.4)');
  }
  assert.match(regla('sealed')[2].at(-1), /signed\(.*"StateArk\/Observador\/Cabecera\/v1"\), bytes\(.*\.7\.3\)\) and first .*\.7\.3 in before\.8\.6$/);
  assert.match(regla('sealed')[2].at(-1), /below\(reverse\(/, 'la prueba de trabajo de la cabecera');
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
  // El camino «sip», sin tuplas: los lados y los hermanos en dos posiciones hermanas, en paralelo.
  assert.deepEqual([decupla[Number(selloDe.POSICIONES_DEL_SELLO.lados)], decupla[Number(selloDe.POSICIONES_DEL_SELLO.hermanos)].length], [['d'], 1]);
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
  assert.deepEqual(contrato.verificado(eje, e1.id), { ok: true, sello: true, recibo: null, relojes: true, altura: 7, profundidad: 1, enFirme: false, pendiente: [], pendienteDeSello: false });
  // En un lote de varios ids, con su camino «sip»: también.
  eje.marcarSello(e2.id, await selloCompleto(e2.id, { altura: 9, observador: obs, ids: [e1.id, e2.id, eje.genesisId] }));
  assert.ok(eje.sello(e2.id).decupla[8].length >= 1, 'un camino de verdad (los lados en el 8 y los hermanos en el 9, al final: solo si lo hay)');
  assert.equal(eje.sello(e1.id).decupla.length, 8, 'un lote de un solo id: sin camino, sin posición 8 (ni hueco ni «-»)');
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

test('con la simulación de StateArk (9be12c3, sin huecos ni tuplas): la prueba trae cabecera, caminos y observador; «sealed» verdadero si la cuenta raíz declara su clave, con y sin camino «bitcoin»', async () => {
  const s = selloSimulado({ inicio: '2026-11-10T11:00:00.000Z', reloj: () => Date.parse('2026-11-10T11:00:00.000Z') });
  const { eje, e1, e2 } = await ejeDePrueba({ observadores: [await s.claveObservador()] });
  // Un bloque con un solo compromiso (sin camino «bitcoin») y otro con dos lotes (con él).
  await s.sellar([e1.id, eje.genesisId]);
  await s.minar();
  await s.sellar([e2.id]);
  await s.sellar(['ee'.repeat(32)]);
  await s.minar();
  assert.equal((await s.prueba(e1.id)).prueba.pasos.length, 0);
  assert.ok((await s.prueba(e2.id)).prueba.pasos.length > 0, 'dos lotes en el bloque: camino «bitcoin» del lote a la cabecera');
  for (const id of [e1.id, e2.id]) {
    const p = await s.prueba(id);
    // La misma décupla que la de la simulación, salvo que, sin camino «bitcoin», lo observado (7) va con cada parte en
    // una lista de uno: así es una décupla (la de la simulación es entonces una lista de hojas y 7.0 no existe en BTML).
    const nuestra = selloDe.decuplaDeSello(p, id);
    const desenvuelta = nuestra.map((x, k) => (k === 7 && x.length === 4 ? x.map((y) => y[0]) : x));
    assert.deepEqual(desenvuelta, selloComoDecupla(p, id));
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
  // Una prueba de antes de H9 (sin cabecera ni observador): PENDIENTE.
  const vieja = { ...p, prueba: { camino: p.prueba.camino, ots: null, via: 'simulado' } };
  const { eje: e3, e1: z1 } = await ejeDePrueba({ observadores: [await s.claveObservador()] });
  await s.sellar([z1.id]);
  await s.minar();
  const pz = await s.prueba(z1.id);
  e3.marcarSello(z1.id, { altura: pz.altura, hash: pz.hash, instante: pz.instante, verificado: true, decupla: selloDe.decuplaDeSello({ ...pz, prueba: vieja.prueba }, z1.id) });
  assert.equal(leer(e3, z1.id, 5).estado, 'PENDIENTE');
});

test('«received» (X.6.8.4): el recibo de llegada firmado por su relé es verdadero; con una firma mala, falso; sin el id del recibo, PENDIENTE', async () => {
  const obs = await observadorDePrueba();
  const rele = await releDePrueba();
  const { eje, e1, e2 } = await ejeDePrueba({ observadores: [obs.publica] });
  eje.marcarSello(e1.id, await selloCompleto(e1.id, { observador: obs }));
  eje.marcarRecibo(e1.id, reciboFirmado(rele, { instante: '2026-11-10T10:30:00.000Z' }));
  assert.deepEqual(leer(eje, e1.id, 4).valor, [true]);
  assert.deepEqual(contrato.verificado(eje, e1.id), { ok: true, sello: true, recibo: true, relojes: true, altura: 1, profundidad: 1, enFirme: false, pendiente: [], pendienteDeSello: false });
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
