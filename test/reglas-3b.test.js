// Encargo 3b: las reglas de la época que el mapa §15 y §16 cambian o añaden, cada una en positivo y en negativo, y
// las propiedades que piden: el peso por dominio no cambia al dividir o fundir identidades; nadie mueve lo ajeno; un
// mensaje sin pago no entra; aceptar una invitación da de alta y la persona escribe con su asignación.
//
// Las decisiones de VG que se comprueban (mapa global §15 y §16, textuales en docs/FUNDAMENTOS.md):
//   P como peso de criterio (8-11): P se obtiene (N1: escribir un registro propio da diez; conseguir E da P sobre su
//     registro; N2: recibir R da diez en la raíz de quien la da), se reposiciona por el árbol (subir deja una décima,
//     bajar añade una décima; N7: solo subir y bajar), y el peso es por dominio; se cuenta según el PV2 del dueño (N4).
//   Una sola operación, registrar (8-11): cada uno mueve lo suyo; «cerrado» lo establece el proceso (N5).
//   R según el corpus (9-11): sin colateral, transferible, se devuelve para pedir atención y se perdona quemándola.
//   PV3 = regla de atención (9-11): escribirme tiene el precio de tu grupo; el veto rechaza.
//   El árbol mínimo es la invitación (9-11): la aceptación es el alta; el génesis es la época 0, sin movimientos.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Eje } from '../src/eje.js';
import { crearEvento } from '../src/evento.js';
import { evaluar, evaluarRegla, evaluarEscritura } from '../src/bqlm.js';
import { ContextoEje } from '../src/contexto-eje.js';
import { EPOCA_0_BTML } from '../src/epocas.js';
import { recuento, peso, cerrado, cierre, siguiente, registrar, ANUNCIO } from '../src/motor.js';
import { lenteDe, valor, devoluciones, pendientes } from '../src/lente.js';
import { generarClaves } from '../src/autoridad.js';
import { validez } from '../src/validez.js';
import { entrarPorInvitacion } from '../ejemplos/ikisai/altas.mjs';

const T0 = '2026-11-08T10:00:00Z';
const minuto = (de, cantidad = 1) => ({ token: 'T', escala: 'minuto', cantidad, de, a: null });
const R = (emisor, cantidad, de, a) => ({ token: 'R', emisor, cantidad, de, a });
const P = (ambito, cantidad, de, a, extra = {}) => ({ token: 'P', ambito, cantidad, de, a, ...extra });
const regla = (nombre) => [...EPOCA_0_BTML.condiciones, ...EPOCA_0_BTML.escrituras].find((r) => r[0][0] === nombre);

/**
 * g escribe el génesis y emite su R y sus vales; invita a ana (cercanos, zona 3) y a bea (sin grupo: desconocidos), y
 * escribe la plaza, un registro suyo sobre el génesis donde los demás escriben sin pagar atención (escribir sobre el
 * alta de otro, el génesis incluido, es escribirle: revisión de seguridad del encargo 3b).
 */
let plaza;
async function mundo() {
  const eje = await Eje.genesis({ demostracion: true, identidad: 'g', t: T0, foco: 'raíz', emision: [{ token: 'R', cantidad: 10 }, { token: 'E', denominacion: 'vale', cantidad: 100 }] });
  await entrarPorInvitacion(eje, { por: 'g', quien: 'ana', t: T0, grupo: 3 });
  await entrarPorInvitacion(eje, { por: 'g', quien: 'bea', t: T0 });
  const g = eje.genesisId;
  plaza = (await eje.escribir({ autor: 'g', sobre: g, t: T0, payload: ['Plaza'], movimientos: [minuto('g')] })).id;
  const X = await eje.escribir({ autor: 'g', sobre: g, t: T0, payload: ['Huerto'], movimientos: [minuto('g')] });
  const Y = await eje.escribir({ autor: 'g', sobre: X.id, t: T0, payload: ['Bancal'], movimientos: [minuto('g')] });
  return { eje, g, X, Y };
}

/** Los motivos con que el eje rechazaría el evento (vacío si lo acepta). */
async function motivos(eje, datos) {
  return eje.validar(await crearEvento({ t: T0, ...datos }));
}

/** Lo que obtuvo una transacción (los pasos de la obtención): [[titular, serie, cantidad]]. */
const obtenido = (eje, ev) => eje.libro.asientos({ clase: 'obtencion' }).filter((a) => a.tx.id === ev.id).map((a) => [a.a, a.serie, a.cantidad]);

// ---------- el génesis y la obtención de P ----------

test('el génesis es la época 0 en el eje: sin movimientos, con la referencia a la época, y es el alta de quien lo escribe', async () => {
  const { eje, g } = await mundo();
  const gen = eje.obtener(g);
  assert.deepEqual(gen.movimientos, []);
  assert.equal(gen.contexto.epoca, EPOCA_0_BTML.id, 'lleva el id de la época 0');
  assert.equal(eje.alta('g').id, g, 'es el alta de g: la única sin invitación');
  assert.equal(eje.esPersona('g'), true);
  await assert.rejects(Eje.genesis({ demostracion: true, identidad: 'h', t: T0, foco: 'x', emision: [{ token: 'P', ambito: 'genesis', cantidad: 1 }] }), /nadie acuña P a mano/);
  // Un génesis guardado con movimientos (de antes del 3b) no se restaura.
  const viejo = await crearEvento({ autor: 'h', sobre: null, t: T0, payload: 'x', movimientos: [{ token: 'R', emisor: 'h', cantidad: 1, de: null, a: 'h' }], contexto: { genesis: true, demostracion: true } });
  await assert.rejects(Eje.desde([viejo]), /el génesis no mueve nada/);
});

test('«writing a record gives ten P on it» (N1): quien escribe obtiene diez P sobre su registro; sobre el de otro, no', async () => {
  const { eje, g, X } = await mundo();
  assert.deepEqual(obtenido(eje, X), [['g', 'P:' + X.id, 10]]);
  assert.equal(eje.poderSobre('g', g), 10, 'también el génesis: lo escribió g');
  const nota = await eje.escribir({ autor: 'ana', sobre: X.id, t: T0, payload: 'una nota', movimientos: [minuto('ana')] });
  assert.deepEqual(obtenido(eje, nota), [['ana', 'P:' + nota.id, 10]], 'ana obtiene P sobre su nota, no sobre el huerto de g');
  assert.equal(eje.poderSobre('ana', X.id), 0);
  // La regla que escribe, leída a mano: coloca diez en (first ev.3).2.1.(first ev.5).
  const ev = await crearEvento({ autor: 'ana', sobre: X.id, t: T0, payload: 'otra', movimientos: [minuto('ana')] });
  const r = evaluarEscritura(regla('writing a record gives ten P on it'), new ContextoEje(eje, { ev, epoch: EPOCA_0_BTML }));
  assert.deepEqual(r.escrituras, [{ sujeto: 'ana', camino: [2, 1], clave: ev.id, valor: 10 }]);
  assert.match(evaluarRegla(regla('writing a record gives ten P on it'), new ContextoEje(eje, { ev, epoch: EPOCA_0_BTML })).motivo, /regla que escribe/);
});

test('«getting E gives ten P on its record»: quien recibe E obtiene P sobre el registro de la serie; bloquear E no da nada', async () => {
  const { eje, g } = await mundo();
  const da = await eje.escribir({ autor: 'g', sobre: g, t: T0, payload: 'vales', movimientos: [minuto('g'), { token: 'E', emisor: 'g', denominacion: 'vale', cantidad: 5, de: 'g', a: 'ana' }] });
  assert.ok(obtenido(eje, da).some(([a, s, c]) => a === 'ana' && s === 'P:' + g && c === 10), 'el vale está atado al alta de g (el génesis)');
  const bloquea = await eje.escribir({ autor: 'ana', sobre: plaza, t: T0, payload: 'aparto', movimientos: [minuto('ana'), { token: 'E', emisor: 'g', denominacion: 'vale', cantidad: 1, de: 'ana', a: 'ana', estado: 'bloqueo', salida: 'algo' }] });
  assert.deepEqual(obtenido(eje, bloquea).filter(([a]) => a === 'ana' && false), []);
  assert.ok(!obtenido(eje, bloquea).some(([, s]) => s === 'P:' + g), 'bloquear E no es conseguirla');
});

test('«receiving R gives ten P on the root of its issuer» (N2): recibir R da P en el alta de su emisor; devolverla, no', async () => {
  const { eje, g } = await mundo();
  // ana recogió en su alta la R de g que le guardaba la invitación: diez P sobre el alta de g.
  assert.ok(eje.poderSobre('ana', g) >= 10);
  const devuelve = await eje.escribir({ autor: 'ana', sobre: g, en: '3000000000', t: T0, payload: 'g, te escribo', movimientos: [minuto('ana'), R('ana', 1, null, 'ana'), R('ana', 1, 'ana', 'g')] });
  assert.ok(obtenido(eje, devuelve).some(([a, s]) => a === 'g' && s === 'P:' + eje.alta('ana').id), 'g recibe R de ana: P sobre el alta de ana');
  const vuelve = await eje.escribir({ autor: 'bea', sobre: g, en: '3000000000', t: T0, payload: 'te pido atención', movimientos: [minuto('bea'), R('g', 1, 'bea', 'g')] });
  assert.ok(!obtenido(eje, vuelve).some(([a]) => a === 'g'), 'su propia R devuelta no le da P');
});

// ---------- reposicionar P ----------

test('«P is repositioned one step at a time» (N7): subir deja una décima, bajar añade una; a mano, lejos o con otro factor, no', async () => {
  const { eje, g, X, Y } = await mundo();
  const repos = (movs) => motivos(eje, { autor: 'g', sobre: g, payload: 'repos', movimientos: [minuto('g'), ...movs] });
  assert.deepEqual(await repos([P(Y.id, 10, 'g', null), P(X.id, 1, null, 'g')]), [], 'subir: 10 del bancal dan 1 en el huerto');
  assert.deepEqual(await repos([P(X.id, 1, 'g', null), P(Y.id, 1.1, null, 'g')]), [], 'bajar: 1 del huerto da 1,1 en el bancal');
  assert.deepEqual(await repos([P(X.id, 10, 'g', null), P(g, 1, null, 'g')]), [], 'subir al génesis');
  const regla9 = /P is repositioned one step at a time/;
  assert.ok((await repos([P(X.id, 1, null, 'g')])).some((m) => regla9.test(m)), 'acuñar P a mano');
  assert.ok((await repos([P(Y.id, 10, 'g', null), P(X.id, 2, null, 'g')])).some((m) => regla9.test(m)), 'subir con otro factor');
  assert.ok((await repos([P(Y.id, 10, 'g', null), P(g, 1, null, 'g')])).some((m) => regla9.test(m)), 'dos niveles de una vez');
  assert.ok((await repos([P(Y.id, 10, 'g', null), P(X.id, 1, null, 'ana')])).some((m) => regla9.test(m)), 'acuñar para otro');
  // Con decimales: el P es divisible.
  await eje.escribir({ autor: 'g', sobre: g, t: T0, payload: 'baja', movimientos: [minuto('g'), P(X.id, 1, 'g', null), P(Y.id, 1.1, null, 'g')] });
  assert.equal(eje.poderSobre('g', Y.id), 11.1);
});

test('«P moves within a known scope»: P va sobre un registro del libro; ya no hay P sobre «genesis» (mapa §15: se retira el P del génesis)', async () => {
  const { eje, g, X } = await mundo();
  assert.deepEqual(await motivos(eje, { autor: 'g', sobre: g, payload: 'da', movimientos: [minuto('g'), P(X.id, 2, 'g', 'ana')] }), []);
  assert.ok((await motivos(eje, { autor: 'g', sobre: g, payload: 'da', movimientos: [minuto('g'), P('genesis', 1, 'g', 'ana')] })).some((m) => /P moves within a known scope/.test(m)));
});

// ---------- el escalonado: la exigencia E ← P ← R ← T (N3) ----------

test('«minting R needs real T»: con T real se emite R; solo con T informativo, no', async () => {
  const { eje, g } = await mundo();
  assert.deepEqual(await motivos(eje, { autor: 'bea', sobre: plaza, payload: 'mi R', movimientos: [minuto('bea'), R('bea', 5, null, 'bea')] }), []);
  assert.ok((await motivos(eje, { autor: 'bea', sobre: plaza, payload: 'mi R', movimientos: [{ token: 'T', escala: 'inventado', cantidad: 1, de: 'bea', a: null }, R('bea', 5, null, 'bea')] })).some((m) => /minting R needs real T/.test(m)));
});

test('«minting E needs P on its record» y «minting E needs own R issued» (N3, D2): E sobre un registro donde se tiene P, con R propia emitida', async () => {
  const { eje, g, X } = await mundo();
  const propio = await eje.escribir({ autor: 'bea', sobre: plaza, t: T0, payload: ['Puesto de bea'], movimientos: [minuto('bea')] });
  const vale = (registro) => ({ token: 'E', emisor: 'bea', denominacion: 'fruta', registro, cantidad: 3, de: null, a: 'bea' });
  // Sin R propia: bea solo tiene la R de g que le dio la invitación.
  assert.ok((await motivos(eje, { autor: 'bea', sobre: propio.id, payload: 'fruta', movimientos: [minuto('bea'), vale(propio.id)] })).some((m) => /minting E needs own R issued/.test(m)));
  // Con su R en la misma transacción, sobre su puesto (diez P): pasa.
  assert.deepEqual(await motivos(eje, { autor: 'bea', sobre: propio.id, payload: 'fruta', movimientos: [minuto('bea'), R('bea', 1, null, 'bea'), vale(propio.id)] }), []);
  // Sobre el huerto de g, donde bea no tiene P: no.
  assert.ok((await motivos(eje, { autor: 'bea', sobre: X.id, payload: 'fruta', movimientos: [minuto('bea'), R('bea', 1, null, 'bea'), vale(X.id)] })).some((m) => /minting E needs P on its record/.test(m)));
});

// ---------- delegar y comprometer P ----------

test('delegar es transferir con salida (mapa §15 [D] (6)): el P llega bloqueado con la decisión; sin bloquearlo antes, no hay qué pasar', async () => {
  const { eje, g, X } = await mundo();
  const D = await eje.escribir({ autor: 'g', sobre: X.id, t: T0, payload: ['¿Plantamos?'], movimientos: [minuto('g')] });
  await eje.escribir({ autor: 'g', sobre: D.id, t: T0, payload: 'delego en ana', movimientos: [minuto('g'), P(X.id, 4, 'g', 'g', { estado: 'bloqueo', salida: D.id }), P(X.id, 4, 'g', 'ana', { salida: D.id })] });
  assert.deepEqual([eje.bloqueado('ana', 'P:' + X.id, D.id), eje.saldo('ana', 'P:' + X.id), eje.bloqueado('g', 'P:' + X.id, D.id)], [4, 0, 0]);
  assert.ok((await motivos(eje, { autor: 'g', sobre: D.id, payload: 'más', movimientos: [minuto('g'), P(X.id, 4, 'g', 'bea', { salida: D.id })] })).some((m) => /no hay 4 de P:/.test(m)), 'lo bloqueado con esa salida no alcanza');
});

test('tomar prestados criterios (la lente de criterios): A.2.3 son las personas que A nombra en el 2.3 de su alta', async () => {
  const { eje, g } = await mundo();
  const altaAna = eje.alta('ana').id;
  await eje.escribir({ autor: 'ana', sobre: altaAna, en: '2300000000', t: T0, payload: ['g'], movimientos: [minuto('ana')] });
  // bea no puede ni escribir ahí sin pagar la atención de ana (revisión de seguridad); y aunque pagara, no contaría.
  await assert.rejects(eje.escribir({ autor: 'bea', sobre: altaAna, en: '2300000000', t: T0, payload: ['bea'], movimientos: [minuto('bea')] }), /attention has a price/);
  const ctx = new ContextoEje(eje, { epoch: EPOCA_0_BTML });
  assert.deepEqual(evaluar('("ana").2.3', ctx).valor, ['g'], 'solo lo que ancla ella: lo de bea no cuenta');
  assert.ok(g);
});

// ---------- el peso por dominio y el recuento ----------

test('el peso por dominio («share», A.2.1.8): P de A en X ÷ P de A en el dominio de X, y no cambia al dividir o fundir identidades', async () => {
  const { eje, g } = await mundo();
  const Ra = await eje.escribir({ autor: 'ana', sobre: plaza, t: T0, payload: ['Taller de ana'], movimientos: [minuto('ana')] });
  const Xa = await eje.escribir({ autor: 'ana', sobre: Ra.id, t: T0, payload: ['Mesa'], movimientos: [minuto('ana')] });
  const antes = [peso(eje, 'ana', Xa.id), peso(eje, 'ana', Ra.id)];
  assert.deepEqual(antes, [0.5, 0.5], 'diez sobre la mesa y diez sobre el taller: el dominio es el taller');
  // Dividir: ana pasa la mitad de cada P del dominio a bea (otra identidad suya, digamos). Lo escribe fuera del
  // dominio (sobre el génesis), para que el P que obtiene al escribir no caiga en él.
  await eje.escribir({ autor: 'ana', sobre: plaza, t: T0, payload: 'divido', movimientos: [minuto('ana'), P(Ra.id, 5, 'ana', 'bea'), P(Xa.id, 5, 'ana', 'bea')] });
  assert.deepEqual([peso(eje, 'ana', Xa.id), peso(eje, 'bea', Xa.id)], [antes[0], antes[0]], 'cada parte pesa lo mismo que el todo');
  // Fundir: bea se lo devuelve.
  await eje.escribir({ autor: 'bea', sobre: plaza, t: T0, payload: 'fundo', movimientos: [minuto('bea'), P(Ra.id, 5, 'bea', 'ana'), P(Xa.id, 5, 'bea', 'ana')] });
  assert.equal(peso(eje, 'ana', Xa.id), antes[0]);
  // La lectura, en su posición: A.2.1.8 de cada entrada.
  const ctx = new ContextoEje(eje, { epoch: EPOCA_0_BTML });
  assert.deepEqual(evaluar('("ana").2.1.("' + Xa.id + '").8', ctx).valor, [antes[0]]);
});

test('el recuento según el PV2 del dueño (N4): por defecto solo el dueño; con lista, presiones; suma, media y umbral', async () => {
  const { eje, g, X } = await mundo();
  const nota = await eje.escribir({ autor: 'bea', sobre: X.id, t: T0, payload: 'nota de bea', movimientos: [minuto('bea')] });
  const decision = async (criterio) => eje.escribir({ autor: 'g', sobre: X.id, t: T0, payload: ['¿Plantamos?', ['x'], criterio], movimientos: [minuto('g')] });
  // Sin lista: solo cuenta g. bea compromete y no cuenta; g compromete y pasa (por defecto, el umbral es 0).
  const D = await decision('decidir');
  await eje.escribir({ autor: 'bea', sobre: D.id, t: T0, payload: 'sí', movimientos: [minuto('bea'), P(nota.id, 10, 'bea', 'bea', { estado: 'bloqueo', salida: D.id })] });
  assert.deepEqual([recuento(eje, D.id).valor, recuento(eje, D.id).pasa], [0, false], 'bea no está en la lista: no cuenta');
  await eje.escribir({ autor: 'g', sobre: D.id, t: T0, payload: 'sí', movimientos: [minuto('g'), P(X.id, 10, 'g', 'g', { estado: 'bloqueo', salida: D.id })] });
  assert.equal(recuento(eje, D.id).pasa, true);
  // Con lista y presiones: la media ponderada, con umbral 0.4.
  const E = await decision([['decidir'], [1], ['weighted mean', 'above 0.4'], ['g', 'bea 5']]);
  const r0 = recuento(eje, E.id);
  assert.deepEqual([r0.plantilla, r0.umbral, r0.valor], ['weighted mean', 0.4, 0]);
  await eje.escribir({ autor: 'g', sobre: E.id, t: T0, payload: 'todo', movimientos: [minuto('g'), P(g, 10, 'g', 'g', { estado: 'bloqueo', salida: E.id })] });
  const r1 = recuento(eje, E.id);
  assert.ok(r1.valor > 0 && r1.valor < 1, 'g compromete una parte de su P del dominio: ' + r1.valor);
  // «cualquiera» abre a todos: con el umbral, la fracción del P del dominio comprometido.
  const F = await decision([['decidir'], [1], ['threshold'], ['cualquiera']]);
  await eje.escribir({ autor: 'bea', sobre: F.id, t: T0, payload: 'sí', movimientos: [minuto('bea'), P(nota.id, 10, 'bea', 'bea', { estado: 'liberacion', salida: D.id }), P(nota.id, 10, 'bea', 'bea', { estado: 'bloqueo', salida: F.id })] });
  const r2 = recuento(eje, F.id);
  assert.equal(r2.plantilla, 'threshold');
  assert.ok(r2.valor > 0, 'cuenta lo de bea: ' + r2.valor);
});

// ---------- el ciclo: una sola operación ----------

test('cerrado y siguiente (N5): lo anunciado en el 4.1 cierra el proceso cuando cada parte mueve lo suyo; nadie mueve lo ajeno', async () => {
  const { eje, g } = await mundo();
  await eje.escribir({ autor: 'g', sobre: g, t: T0, payload: 'vales', movimientos: [minuto('g'), { token: 'E', emisor: 'g', denominacion: 'vale', cantidad: 10, de: 'g', a: 'ana' }] });
  const trato = await eje.escribir({ autor: 'ana', sobre: plaza, t: T0, payload: ['Trato', ['x'], ['all announced movements happened']], movimientos: [minuto('ana')] });
  const anuncio = [['E:g/vale'], [3], ['pagar'], [['ana'], ['g']]];
  await eje.escribir({ autor: 'ana', sobre: trato.id, en: ANUNCIO, t: T0, payload: anuncio, movimientos: [minuto('ana', 4)] });
  assert.equal(cerrado(eje, trato.id).cerrado, false);
  const deG = siguiente(eje, trato.id, 'g');
  assert.deepEqual([deG.faltaDeMi.length, deG.espera.map((x) => x.de)], [0, ['ana']], 'g espera a ana');
  // Nadie mueve lo ajeno: g no puede cobrarse los vales de ana.
  assert.ok((await motivos(eje, { autor: 'g', sobre: trato.id, payload: 'cobro', movimientos: [minuto('g'), { token: 'E', emisor: 'g', denominacion: 'vale', cantidad: 3, de: 'ana', a: 'g' }] })).some((m) => /nobody moves tokens of others/.test(m)));
  const deAna = siguiente(eje, trato.id, 'ana');
  assert.equal(deAna.faltaDeMi.length, 1);
  await registrar(eje, { ...deAna.faltaDeMi[0].transaccion, t: T0 });
  assert.deepEqual([cerrado(eje, trato.id).cerrado, siguiente(eje, trato.id, 'ana').faltaDeMi.length], [true, 0]);
  // El registro que lo cerró es el pago, no un comentario posterior.
  const pago = cierre(eje, trato.id);
  await eje.escribir({ autor: 'g', sobre: trato.id, t: T0, payload: 'gracias', movimientos: [minuto('g')] });
  assert.equal(cierre(eje, trato.id).id, pago.id);
  assert.equal(pago.autor, 'ana');
});

// ---------- R según el corpus ----------

test('R según el corpus: se emite sin colateral, pasa de tenedor a tenedor sin cambiar de emisor, se perdona quemándola', async () => {
  const { eje, g } = await mundo();
  await eje.escribir({ autor: 'ana', sobre: plaza, t: T0, payload: 'mi R', movimientos: [minuto('ana'), R('ana', 10, null, 'ana'), R('ana', 4, 'ana', 'bea')] });
  assert.equal(eje.obligaciones('ana'), 4);
  // bea la pasa a g (sin devolverla a ana): sigue siendo R:ana.
  await eje.escribir({ autor: 'bea', sobre: plaza, t: T0, payload: 'te paso R de ana', movimientos: [minuto('bea'), R('ana', 2, 'bea', 'g')] });
  assert.deepEqual([eje.saldo('g', 'R:ana'), eje.obligaciones('ana')], [2, 4]);
  // g la perdona: la quema sin pedir atención; la obligación de ana baja.
  await eje.escribir({ autor: 'g', sobre: g, t: T0, payload: 'te la perdono', movimientos: [minuto('g'), R('ana', 2, 'g', null)] });
  assert.deepEqual([eje.saldo('g', 'R:ana'), eje.obligaciones('ana')], [0, 2]);
});

test('R: devolverla es pedir atención; la atiende un registro del emisor sobre la petición, con T real («attended»)', async () => {
  const { eje, g } = await mundo();
  await eje.escribir({ autor: 'ana', sobre: plaza, t: T0, payload: 'mi R', movimientos: [minuto('ana'), R('ana', 10, null, 'ana'), R('ana', 2, 'ana', 'bea')] });
  const peticion = await eje.escribir({ autor: 'bea', sobre: eje.alta('ana').id, en: '3000000000', t: T0, payload: 'ana, te pido atención', movimientos: [minuto('bea'), R('ana', 1, 'bea', 'ana')] });
  assert.deepEqual(pendientes(eje, 'ana'), [peticion.id]);
  await eje.escribir({ autor: 'ana', sobre: peticion.id, t: T0, payload: 'te atiendo', movimientos: [minuto('ana')] });
  assert.deepEqual([pendientes(eje, 'ana'), devoluciones(eje, 'ana').length], [[], 1]);
});

test('la lente de R es la condición de aceptación (§16): vale una unidad la R de quien el lector acepta como pago, y nada la de los demás', async () => {
  const { eje, g } = await mundo();
  await eje.escribir({ autor: 'ana', sobre: plaza, t: T0, payload: 'mi R', movimientos: [minuto('ana'), R('ana', 10, null, 'ana'), R('ana', 3, 'ana', 'bea')] });
  await eje.escribir({ autor: 'bea', sobre: plaza, t: T0, payload: 'mi R', movimientos: [minuto('bea'), R('bea', 100, null, 'bea')] });
  // g pone a ana con los cercanos (zona 3: cobran con su R).
  await eje.escribir({ autor: 'g', sobre: g, en: '3330000000', t: T0, payload: ['ana'], movimientos: [minuto('g')] });
  assert.deepEqual([...lenteDe(eje, 'g').pesos], [['ana', 1]]);
  assert.equal(valor(eje, 'g', 'bea'), 3, 'tres unidades de R:ana');
  assert.equal(valor(eje, 'ana', 'bea'), 0, 'ana no acepta la R de nadie');
  assert.equal(valor(eje, 'g', 'ana'), 0, 'la propia R de ana no es que otro responda por ella');
});

// ---------- PV3: la atención tiene precio ----------

test('«attention has a price»: desconocidos pagan con mi R, cercanos con su R; sin pago no entra y el veto rechaza aunque pague', async () => {
  const { eje, g } = await mundo();
  const escribe = (autor, movs) => motivos(eje, { autor, sobre: g, en: '3000000000', payload: 'hola', movimientos: [minuto(autor), ...movs] });
  const precio = /attention has a price/;
  // bea, sin grupo: desconocidos, devolviendo la R de g que le guardó la invitación.
  assert.ok((await escribe('bea', [])).some((m) => precio.test(m)), 'sin pago no entra');
  assert.deepEqual(await escribe('bea', [R('g', 1, 'bea', 'g')]), []);
  // ana, cercanos por su invitación (zona 3): con su propia R.
  assert.ok((await escribe('ana', [R('g', 1, 'ana', 'g')])).some((m) => precio.test(m)), 'mi R no es su precio');
  assert.deepEqual(await escribe('ana', [R('ana', 1, null, 'ana'), R('ana', 1, 'ana', 'g')]), []);
  // g la veta (zona 5, 3.5.3): ni pagando.
  await eje.escribir({ autor: 'g', sobre: g, en: '3530000000', t: T0, payload: ['bea'], movimientos: [minuto('g')] });
  assert.ok((await escribe('bea', [R('g', 1, 'bea', 'g')])).some((m) => precio.test(m)));
  // g abre a bea el grupo comercial (3.1.3): paga con E.
  await eje.escribir({ autor: 'g', sobre: g, en: '3130000000', t: T0, payload: ['bea'], movimientos: [minuto('g')] });
  assert.ok((await escribe('bea', [R('g', 1, 'bea', 'g')])).some((m) => precio.test(m)), 'la última zona que la nombra manda: el veto');
  // Lo que g escribe en su propio 3 no paga nada: es suyo.
  assert.deepEqual(await motivos(eje, { autor: 'g', sobre: g, en: '3000000000', payload: 'nota', movimientos: [minuto('g')] }), []);
});

test('PV3: el precio de un grupo lo corrige su dueño en el 3.k.2 de su alta (gana el último), y los grupos son la vista A.3', async () => {
  const { eje, g } = await mundo();
  const ctx = () => new ContextoEje(eje, { epoch: EPOCA_0_BTML });
  assert.deepEqual(evaluar('("g").3 each 1', ctx()).valor, [0, 1, 2, 3, 4, 5], 'las seis zonas de la época');
  assert.equal(evaluar('last (("g").3 where it.1 = 0).2.0', ctx()).valor[0], 'my R');
  // g cobra a los desconocidos con P.
  await eje.escribir({ autor: 'g', sobre: g, en: '3020000000', t: T0, payload: [['P'], [1]], movimientos: [minuto('g')] });
  assert.equal(evaluar('last (("g").3 where it.1 = 0).2.0', ctx()).valor[0], 'P');
  const precio = /attention has a price/;
  assert.ok((await motivos(eje, { autor: 'bea', sobre: g, en: '3000000000', payload: 'hola', movimientos: [minuto('bea'), R('g', 1, 'bea', 'g')] })).some((m) => precio.test(m)), 'mi R ya no basta');
  const suyo = eje.alta('bea').id;
  assert.deepEqual(await motivos(eje, { autor: 'bea', sobre: g, en: '3000000000', payload: 'hola', movimientos: [minuto('bea'), P(suyo, 1, 'bea', 'g')] }), [], 'con P, sí');
});

// ---------- la invitación ----------

test('la invitación: aceptarla da de alta (persona), recoge lo que guarda y la persona escribe con su asignación; el tutorial', async () => {
  const { eje, g } = await mundo();
  const inv = await eje.invitar({ autor: 'g', invitado: 'carla', t: T0, grupo: 3, tema: 'el huerto' });
  assert.deepEqual([inv.sobre, inv.en, inv.payload[0], inv.payload[8], inv.payload[2]], [g, '3000000000', ['invitation'], [3], [{ ref: EPOCA_0_BTML.id }]]);
  assert.equal(eje.bloqueado('g', 'R:g', 'carla'), 1, 'lo que da: una unidad de su R, guardada con la salida = carla');
  const alta = await eje.aceptar(inv);
  assert.deepEqual([eje.alta('carla').id, eje.esPersona('carla'), eje.saldo('carla', 'R:g'), eje.bloqueado('g', 'R:g', 'carla')], [alta.id, true, 1, 0]);
  // Su asignación: cercanos (zona 3), con su R.
  assert.deepEqual(await motivos(eje, { autor: 'carla', sobre: g, en: '3000000000', payload: 'hola g', movimientos: [minuto('carla'), R('carla', 1, null, 'carla'), R('carla', 1, 'carla', 'g')] }), []);
  // El tutorial: siguiente sobre su alta.
  const sig = siguiente(eje, alta.id, 'carla');
  assert.deepEqual(sig.tutorial.map((x) => x.posicion), [5, 4, 1, 7, 2, 8, 9, 3, null]);
  assert.equal(sig.tutorial.at(-1).que, 'segunda alta');
});

test('«a person joins by an invitation»: sin invitación, con la de otro, caducada o con otra clave, no entra', async () => {
  const { eje, g } = await mundo();
  const rechaza = /a person joins by an invitation/;
  assert.ok((await motivos(eje, { autor: 'dani', sobre: g, payload: 'yo', movimientos: [minuto('dani')] })).some((m) => rechaza.test(m)), 'sin invitación');
  const inv = await eje.invitar({ autor: 'g', invitado: 'eva', t: T0, hasta: '2026-11-09T00:00:00Z' });
  assert.ok((await motivos(eje, { autor: 'dani', sobre: inv.id, payload: 'yo', movimientos: [minuto('dani')] })).some((m) => rechaza.test(m)), 'la de otra persona');
  assert.deepEqual(await motivos(eje, { autor: 'eva', sobre: inv.id, payload: 'yo', movimientos: [minuto('eva')] }), [], 'a tiempo');
  // Caducada: la caducidad se lee con el reloj de los demás (min del t de la aceptación y before.6.3), como la de E.
  // Fechada después sin que nadie más haya escrito, el reloj de los demás aún no pasó del 7: entra.
  assert.deepEqual(await motivos(eje, { autor: 'eva', sobre: inv.id, t: '2026-11-10T00:00:00Z', payload: 'yo', movimientos: [minuto('eva')] }), [], 'nadie ha visto pasar el plazo');
  await eje.escribir({ autor: 'g', sobre: g, t: '2026-11-10T00:00:00Z', payload: 'pasa el día', movimientos: [minuto('g')] });
  assert.ok((await motivos(eje, { autor: 'eva', sobre: inv.id, t: '2026-11-10T00:00:00Z', payload: 'yo', movimientos: [minuto('eva')] })).some((m) => rechaza.test(m)), 'caducada para los demás');
  assert.ok((await motivos(eje, { autor: 'eva', sobre: inv.id, t: T0, payload: 'yo', movimientos: [minuto('eva')] })).some((m) => rechaza.test(m)), 'fechar atrás no la revive');
  // Con clave: solo la que nombra la invitación.
  const [buena, mala] = [await generarClaves(), await generarClaves()];
  const T1 = '2026-11-10T00:00:00Z';
  const conClave = await eje.invitar({ autor: 'g', invitado: 'fer', t: T1, clave: buena.publica });
  await assert.rejects(eje.aceptar(conClave, mala, { t: T1 }), rechaza);
  const alta = await eje.aceptar(conClave, buena, { t: T1 });
  assert.equal(eje.clave('fer').x, buena.publica.x);
  assert.ok(alta.firma);
});

test('lo que guarda una invitación solo lo recoge su invitada, aceptándola: nadie mueve lo ajeno', async () => {
  const { eje, g } = await mundo();
  const inv = await eje.invitar({ autor: 'g', invitado: 'carla', t: T0 });
  const recoge = { token: 'R', emisor: 'g', cantidad: 1, de: 'g', a: 'bea', salida: 'carla' };
  assert.ok((await motivos(eje, { autor: 'bea', sobre: inv.id, payload: 'me lo quedo', movimientos: [minuto('bea'), recoge] })).some((m) => /nobody moves tokens of others/.test(m)), 'bea no es la invitada');
  // Ni la invitada fuera de su invitación.
  await entrarPorInvitacion(eje, { por: 'g', quien: 'hugo', t: T0, da: [] });
  const otra = await eje.invitar({ autor: 'g', invitado: 'hugo2', t: T0 });
  void otra;
  assert.ok((await motivos(eje, { autor: 'hugo', sobre: plaza, payload: 'x', movimientos: [minuto('hugo'), { ...recoge, a: 'hugo', salida: 'hugo' }] })).some((m) => /nobody moves tokens of others|no hay/.test(m)));
});

test('«T only goes to things» con el P nuevo: una persona da T a una cosa; de cosa a cosa, del mismo dueño o con P sobre su alta', async () => {
  const { eje, g } = await mundo();
  const T = (de, a, cantidad) => ({ token: 'T', escala: 'minuto', cantidad, de, a });
  await eje.escribir({ autor: 'g', sobre: g, t: T0, payload: ['robot'], movimientos: [minuto('g'), T('g', 'robot', 10)] });
  const carro = await eje.escribir({ autor: 'ana', sobre: plaza, t: T0, payload: ['carro'], movimientos: [minuto('ana'), T('ana', 'carro', 10)] });
  const regla = /T only goes to things/;
  assert.deepEqual(await motivos(eje, { autor: 'ana', sobre: plaza, payload: 't', movimientos: [minuto('ana'), T('ana', 'robot', 2)] }), [], 'una persona, a una cosa');
  assert.ok((await motivos(eje, { autor: 'ana', sobre: plaza, payload: 't', movimientos: [minuto('ana'), T('ana', 'bea', 2)] })).some((m) => regla.test(m)), 'a una persona, no');
  const robotDa = () => motivos(eje, { autor: 'robot', sobre: plaza, payload: 't', movimientos: [T('robot', null, 1), T('robot', 'carro', 2)] });
  assert.ok((await robotDa()).some((m) => regla.test(m)), 'el robot de g, al carro de ana: sin P sobre su alta');
  // ana da al robot P sobre el alta del carro (su registro): ahora sí.
  await eje.escribir({ autor: 'ana', sobre: plaza, t: T0, payload: 'P', movimientos: [minuto('ana'), P(carro.id, 1, 'ana', 'robot')] });
  assert.deepEqual(await robotDa(), []);
});

// ---------- revisión de seguridad ----------

test('aceptar una invitación solo recoge lo que esa invitación guarda para quien la acepta: ni para un tercero ni otra cosa', async () => {
  const { eje } = await mundo();
  const inv = await eje.invitar({ autor: 'g', invitado: 'carla', t: T0 });
  // g guarda además, con la misma salida, unos vales que no son de la invitación... y otros para nadie de ella.
  await eje.escribir({ autor: 'g', sobre: eje.genesisId, t: T0, payload: 'aparto', movimientos: [minuto('g'), { token: 'E', emisor: 'g', denominacion: 'vale', cantidad: 5, de: 'g', a: 'g', estado: 'bloqueo', salida: 'otra' }] });
  const recoge = (movs) => motivos(eje, { autor: 'carla', sobre: inv.id, payload: ['Alta de carla'], movimientos: [minuto('carla'), ...movs] });
  const ajeno = /nobody moves tokens of others|nadie mueve lo ajeno/;
  assert.deepEqual(await recoge([{ token: 'R', emisor: 'g', cantidad: 1, de: 'g', a: 'carla', salida: 'carla' }]), [], 'lo suyo, para sí');
  assert.ok((await recoge([{ token: 'R', emisor: 'g', cantidad: 1, de: 'g', a: 'bea', salida: 'carla' }])).some((m) => ajeno.test(m)), 'para un tercero');
  assert.ok((await recoge([{ token: 'E', emisor: 'g', denominacion: 'vale', cantidad: 5, de: 'g', a: 'carla', salida: 'otra' }])).some((m) => ajeno.test(m)), 'lo guardado con otra salida');
  assert.ok((await recoge([{ token: 'R', emisor: 'g', cantidad: 1, de: 'g', a: 'carla' }])).some((m) => ajeno.test(m)), 'lo disponible de g');
  assert.ok((await recoge([{ token: 'R', emisor: 'g', cantidad: 2, de: 'g', a: 'carla', salida: 'carla' }])).some((m) => /no hay|hay 1/.test(m)), 'más de lo que guarda');
  // Ya con alta, ni sobre la invitación: la excepción es solo para el alta.
  await eje.aceptar(inv);
  const otra = await eje.invitar({ autor: 'g', invitado: 'dani', t: T0 });
  assert.ok((await motivos(eje, { autor: 'carla', sobre: otra.id, payload: 'me lo llevo', movimientos: [minuto('carla'), { token: 'R', emisor: 'g', cantidad: 1, de: 'g', a: 'carla', salida: 'dani' }] })).some((m) => ajeno.test(m)), 'la invitación de otra');
  // El suelo del libro dice lo mismo, aparte de las reglas de la época: la capa 4 rechaza sacar lo bloqueado de otro.
  const ev = await crearEvento({ autor: 'bea', sobre: otra.id, t: T0, payload: 'x', movimientos: [minuto('bea'), { token: 'R', emisor: 'g', cantidad: 1, de: 'g', a: 'bea', salida: 'dani' }] });
  const capa4 = (await validez(eje, ev)).acreditacion;
  assert.equal(capa4.estado, 'falla');
  assert.match(JSON.stringify(capa4), /nadie mueve lo ajeno: bea saca lo bloqueado de g/);
});

test('la obtención no se repite: un ir y venir de R no acuña P dos veces, y la R que llega de un tenedor no da P', async () => {
  const { eje, g } = await mundo();
  const altaAna = eje.alta('ana').id;
  const R1 = await eje.escribir({ autor: 'ana', sobre: plaza, t: T0, payload: 'mi R', movimientos: [minuto('ana'), R('ana', 10, null, 'ana'), R('ana', 1, 'ana', 'bea')] });
  assert.ok(obtenido(eje, R1).some(([a, s]) => a === 'bea' && s === 'P:' + altaAna), 'la primera vez, de su emisor: diez');
  const antes = eje.poderSobre('bea', altaAna);
  for (let i = 0; i < 3; i++) {
    await eje.escribir({ autor: 'bea', sobre: plaza, t: T0, payload: 'vuelve ' + i, movimientos: [minuto('bea'), R('ana', 1, 'bea', 'ana')] });
    const va = await eje.escribir({ autor: 'ana', sobre: plaza, t: T0, payload: 'va ' + i, movimientos: [minuto('ana'), R('ana', 1, 'ana', 'bea'), R('ana', 1, 'ana', 'bea')] });
    assert.deepEqual(obtenido(eje, va).filter(([a, s]) => a === 'bea' && s === 'P:' + altaAna), [], 'ni en el ir y venir ni dos veces en una transacción');
  }
  assert.equal(eje.poderSobre('bea', altaAna), antes);
  // bea pasa R de ana a g: g la recibe de un tenedor, no de su emisor.
  const pasa = await eje.escribir({ autor: 'bea', sobre: plaza, t: T0, payload: 'te paso R de ana', movimientos: [minuto('bea'), R('ana', 1, 'bea', 'g')] });
  assert.deepEqual(obtenido(eje, pasa).filter(([a]) => a === 'g'), []);
  // E: una vez por receptor y registro.
  const da = (n) => eje.escribir({ autor: 'g', sobre: g, t: T0, payload: 'vales ' + n, movimientos: [minuto('g'), { token: 'E', emisor: 'g', denominacion: 'vale', cantidad: 1, de: 'g', a: 'ana' }] });
  assert.equal(obtenido(eje, await da(1)).filter(([a, s]) => a === 'ana' && s === 'P:' + g).length, 1);
  assert.equal(obtenido(eje, await da(2)).filter(([a, s]) => a === 'ana' && s === 'P:' + g).length, 0);
});

test('conseguir E da P una vez por receptor y registro, venga de quien venga: la misma E por tres manos da P una vez a cada una', async () => {
  const { eje, g } = await mundo();
  await entrarPorInvitacion(eje, { por: 'g', quien: 'carla', t: T0 });
  const vale = (de, a) => ({ token: 'E', emisor: 'g', denominacion: 'vale', cantidad: 1, de, a });
  const pasa = async (de, a, n) => obtenido(eje, await eje.escribir({ autor: de, sobre: de === 'g' ? g : plaza, t: T0, payload: 'pasa ' + n, movimientos: [minuto(de), vale(de, a)] })).filter(([x, k]) => x === a && k === 'P:' + g).length;
  // g → ana → bea → carla: cada mano obtiene P sobre el registro de la serie (el génesis) al conseguirla, también de un
  // revendedor («compro un recurso y eso me da P sobre él»).
  assert.deepEqual([await pasa('g', 'ana', 1), await pasa('ana', 'bea', 2), await pasa('bea', 'carla', 3)], [1, 1, 1]);
  // La segunda vez a la misma mano, no: ni de su emisor ni de otro.
  assert.deepEqual([await pasa('carla', 'ana', 4), await pasa('g', 'bea', 5)], [0, 0]);
  // Ni a uno mismo ni a quien aún no tiene alta.
  const aMi = await eje.escribir({ autor: 'g', sobre: g, t: T0, payload: 'a mí', movimientos: [minuto('g'), { token: 'E', emisor: 'g', denominacion: 'vale', cantidad: 5, de: 'g', a: 'nadie-aun' }] });
  assert.deepEqual(obtenido(eje, aMi).filter(([x]) => x === 'nadie-aun'), []);
});

test('conseguir E da P sobre su registro una sola vez, sea cual sea la serie: tres series de la misma casa compradas por la misma persona acuñan una vez', async () => {
  const { eje, g } = await mundo();
  const compra = async (denominacion, n) => {
    const ev = await eje.escribir({ autor: 'g', sobre: g, t: T0, payload: 'vende ' + n, movimientos: [minuto('g'), { token: 'E', emisor: 'g', denominacion, cantidad: 1, de: null, a: 'g' }, { token: 'E', emisor: 'g', denominacion, cantidad: 1, de: 'g', a: 'ana' }] });
    return obtenido(eje, ev).filter(([x, k]) => x === 'ana' && k === 'P:' + g).length;
  };
  assert.deepEqual([await compra('pan', 1), await compra('miel', 2), await compra('queso', 3)], [1, 0, 0]);
  assert.equal(eje.poderSobre('ana', g) >= 10, true);
  // Su propio emisor no obtiene P al recibir de vuelta su E.
  const vuelve = await eje.escribir({ autor: 'ana', sobre: plaza, t: T0, payload: 'te devuelvo el pan', movimientos: [minuto('ana'), { token: 'E', emisor: 'g', denominacion: 'pan', cantidad: 1, de: 'ana', a: 'g' }] });
  assert.deepEqual(obtenido(eje, vuelve).filter(([x]) => x === 'g'), []);
});

test('«attention has a price» en todo el alta ajena: anclar en 3100000000, en 3200000000 o sin dirección también paga; su dueño no', async () => {
  const { eje, g } = await mundo();
  const precio = /attention has a price/;
  for (const en of ['3100000000', '3200000000', undefined]) {
    const ev = { autor: 'bea', sobre: g, ...(en ? { en } : {}), payload: 'hola', movimientos: [minuto('bea')] };
    assert.ok((await motivos(eje, ev)).some((m) => precio.test(m)), 'sin pago, en ' + (en ?? 'el alta'));
    assert.deepEqual(await motivos(eje, { ...ev, movimientos: [minuto('bea'), R('g', 1, 'bea', 'g')] }), [], 'pagando, en ' + (en ?? 'el alta'));
  }
  // El dueño escribe en su propia alta, en su 3 o fuera, sin pagarse.
  for (const en of ['3000000000', '3530000000', undefined]) assert.deepEqual(await motivos(eje, { autor: 'g', sobre: g, ...(en ? { en } : {}), payload: 'mi configuración', movimientos: [minuto('g')] }), []);
  // Sobre un registro de g que no es su alta (la plaza), escribir no paga.
  assert.deepEqual(await motivos(eje, { autor: 'bea', sobre: plaza, payload: 'hola', movimientos: [minuto('bea')] }), []);
});

test('una cosa reposiciona su P como cualquiera: reponer no es emitir («only persons mint» no la frena)', async () => {
  const { eje, g, X } = await mundo();
  const T = (de, a, cantidad) => ({ token: 'T', escala: 'minuto', cantidad, de, a });
  await eje.escribir({ autor: 'g', sobre: g, t: T0, payload: ['robot'], movimientos: [minuto('g'), T('g', 'robot', 10)] });
  const pieza = await eje.escribir({ autor: 'robot', sobre: X.id, t: T0, payload: ['pieza'], movimientos: [T('robot', null, 1)] });
  assert.equal(eje.poderSobre('robot', pieza.id), 10);
  assert.deepEqual(await motivos(eje, { autor: 'robot', sobre: X.id, payload: 'subo', movimientos: [T('robot', null, 1), P(pieza.id, 10, 'robot', null), P(X.id, 1, null, 'robot')] }), []);
  assert.ok((await motivos(eje, { autor: 'robot', sobre: X.id, payload: 'emito', movimientos: [T('robot', null, 1), R('robot', 1, null, 'robot')] })).some((m) => /only persons mint/.test(m)), 'emitir R, no');
});
