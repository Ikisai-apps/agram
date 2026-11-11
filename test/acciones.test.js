// Encargo 3c-2a: las acciones del aro (src/acciones.js, docs/CONTRATO.md «Acciones»). Principio (VG): nada hardcodeado
// en la pantalla ni negocio en JavaScript que pueda ser una regla o un dato de la época: cada acción es una plantilla
// de transacción de la época (epoch.9.6), su 2 dice cuándo se ofrece, su 4 qué mueve y su 5 dónde ancla. Y los datos
// que VG decidió tras el 3b-bis: los seis grupos de R son seis precios, P por mirada, la orientación de una E es el
// token que la paga y los pasos de un proceso se tipan por token (la lectura «stage»).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Eje } from '../src/eje.js';
import { crearEvento } from '../src/evento.js';
import { evaluar } from '../src/bqlm.js';
import { ContextoEje } from '../src/contexto-eje.js';
import { EPOCA_0_BTML, cargarEpocaBtml } from '../src/epocas.js';
import { EPOCA_0_BTML_DATOS, REGLAS_DE_EPOCA_DATOS, PLANTILLAS_DE_EPOCA_DATOS, CORRECCIONES_DE_EPOCA_DATOS } from '../datos/epocas/epocas.js';
import * as A from '../src/acciones.js';
import * as C from '../src/contrato.js';
import { recuento, cerrado, peso, ANUNCIO } from '../src/motor.js';
import { ejemploCompra } from '../ejemplos/ikisai/compra-food.mjs';
import { ejemploReserva } from '../ejemplos/ikisai/reserva-booking.mjs';
import { ejemploTarea } from '../ejemplos/ikisai/tarea-tasks.mjs';
import { entrarPorInvitacion } from '../ejemplos/ikisai/altas.mjs';
import { raizDeAmbito } from '../src/tokens.js';
import { generarClaves, firmar as firmarEvento } from '../src/autoridad.js';

const T0 = '2026-11-08T10:00:00Z';
const T1 = '2026-11-08T12:00:00Z';
const minuto = (de, cantidad = 1) => ({ token: 'T', escala: 'minuto', cantidad, de, a: null });
const R = (emisor, cantidad, de, a) => ({ token: 'R', emisor, cantidad, de, a });
const nombres = (lista) => lista.map((x) => x.nombre);
const movs = (ev) => ev.movimientos.map((m) => [m.token, m.cantidad, m.de, m.a]);

/** Una copia de la época 0 con cambios: lo que el aro ofrece ha de cambiar con ella. */
function epocaCon(cambiar) {
  const e = JSON.parse(JSON.stringify(EPOCA_0_BTML_DATOS));
  const plantillas = JSON.parse(JSON.stringify(PLANTILLAS_DE_EPOCA_DATOS));
  cambiar(e, plantillas);
  return cargarEpocaBtml(e, { registros: REGLAS_DE_EPOCA_DATOS, plantillas, correcciones: CORRECCIONES_DE_EPOCA_DATOS, id: EPOCA_0_BTML.id });
}

/**
 * g escribe el génesis y emite su R y sus vales; invita a seis personas, una por grupo: ana (desconocidos, zona 0),
 * bea (comercial, 1), carla (expertos, 2), dani (cercanos, 3), eli (equipo, 4) y fer (vetados, 5); los grupos 1, 2, 4 y
 * 5 los nombra g anclando en el 3.k.3 de su alta (el génesis); dani entra por una invitación con grupo 3.
 */
async function mundoDeGrupos() {
  const eje = await Eje.genesis({ demostracion: true, identidad: 'g', t: T0, foco: ['raíz'], emision: [{ token: 'R', cantidad: 10 }, { token: 'E', denominacion: 'vale', cantidad: 100 }] });
  for (const quien of ['ana', 'bea', 'carla', 'eli', 'fer']) await entrarPorInvitacion(eje, { por: 'g', quien, t: T0 });
  await entrarPorInvitacion(eje, { por: 'g', quien: 'dani', t: T0, grupo: 3 });
  const g = eje.genesisId;
  for (const [zona, quien] of [[1, 'bea'], [2, 'carla'], [4, 'eli'], [5, 'fer']]) {
    await eje.escribir({ autor: 'g', sobre: g, en: '3' + zona + '30000000', t: T0, payload: [quien], movimientos: [minuto('g')] });
  }
  // bea tiene vales (E) para pagar; carla, P sobre el dominio de g (el 3 del génesis, por la R de su invitación).
  await eje.escribir({ autor: 'g', sobre: g, t: T0, payload: 'vales', movimientos: [minuto('g'), { token: 'E', emisor: 'g', denominacion: 'vale', cantidad: 3, de: 'g', a: 'bea' }] });
  const plaza = await eje.escribir({ autor: 'g', sobre: g, t: T0, payload: ['Plaza de g', ['x'], ['all announced movements happened']], movimientos: [minuto('g')] });
  return { eje, g, plaza };
}

// ---------- 1. qué ofrece el aro ----------

test('acciones: lo que el aro ofrece a cada identidad en cada PV lo dicen las plantillas de la época (su 2 con it = X y me); la primera de cada PV es la acción por defecto', async () => {
  const { eje, menu, alta } = await ejemploCompra();
  const de = (yo, k, X = menu.id) => nombres(A.acciones(eje, X, k, yo));
  // La huésped, sobre el menú: puede darle E (apply a resource, por defecto) y escribirle a su dueña (write to X).
  assert.equal(de('huesped', 1)[0], 'apply a resource');
  assert.ok(de('huesped', 3).includes('write to X'));
  assert.ok(A.acciones(eje, menu.id, 1, 'huesped')[0].porDefecto && !A.acciones(eje, menu.id, 1, 'huesped')[1]?.porDefecto);
  // La cocina, dueña del menú (tiene P sobre él por escribirlo): emite E atada a él, declara su capacidad y mide.
  assert.ok(de('cocina', 1).includes('issue E tied to X'));
  assert.ok(de('cocina', 2).includes('declare capacity or threshold'));
  assert.ok(de('cocina', 8).includes('measure'));
  // La casa, sobre el menú, ni emite ni mide (no tiene P sobre él); sobre su propio registro de altas, sí.
  assert.ok(!de('casa', 1).includes('issue E tied to X') && !de('casa', 8).includes('measure'));
  assert.ok(de('casa', 1, alta.id).includes('issue E tied to X') && de('casa', 2, alta.id).includes('declare capacity or threshold') && de('casa', 8, alta.id).includes('measure'));
  // Nadie se escribe a sí mismo: la cocina no ve «write to X» sobre su menú.
  assert.ok(!de('cocina', 3).includes('write to X'));
  // Los nueve puntos de vista con acciones: 1, 2, 3, 4, 6, 7, 8, 9 (el 0 y el 5 no tienen); cada acción dice qué parámetros pide y cuáles faltan.
  assert.deepEqual([0, 5].map((k) => de('huesped', k)), [[], []]);
  const aplica = A.acciones(eje, menu.id, 1, 'huesped')[0];
  assert.deepEqual(aplica.parametros.map((p) => [p.nombre, p.falta]), [['what', false], ['quantity', false], ['price', true], ['criteria', false], ['who', false], ['actions', false], ['type', false]], 'el menú no tiene serie: el precio lo da quien lanza');
  assert.deepEqual([aplica.parametros[1].valor, aplica.parametros[4].valor, aplica.parametros[6].valor], [1, ['huesped', 'cocina'], 'purchase']);
  // Lo que solo lee y lo que lanza el camino se marcan como tales (su 4: read, path).
  assert.ok(A.acciones(eje, menu.id, 6, 'huesped').find((a) => a.nombre === 'view thread').lectura);
  assert.ok(A.acciones(eje, menu.id, 9, 'huesped').find((a) => a.nombre === 'follow the path').camino);
  // El veto lo dice el 2: si la cocina veta a la huésped (3.5.3 de su alta), «write to X» desaparece.
  await eje.escribir({ autor: 'cocina', sobre: eje.alta('cocina').id, en: '3530000000', t: T1, payload: ['huesped'], movimientos: [minuto('cocina')] });
  assert.ok(!de('huesped', 3).includes('write to X'));
  // Nada decidido en JS: cambiar el 2 de una plantilla en una copia de la época cambia lo que se ofrece.
  const sinAplicar = epocaCon((e, plantillas) => { plantillas.find((p) => p.registro[0][0] === 'apply a resource').registro[2] = ['=1 = 2']; });
  assert.ok(!nombres(A.acciones(eje, menu.id, 1, 'huesped', { epoca: sinAplicar })).includes('apply a resource'));
  assert.equal(A.plantillasDeTransaccion().length, 35);
  assert.deepEqual([...new Set(A.plantillasDeTransaccion().map((p) => p.pv))], [1, 2, 3, 4, 6, 7, 8, 9]);
});

// ---------- 2. construir, validar y asentar ----------

test('transaccion: una compra entera por el aro (acciones → transaccion → asentar): el registro es una «purchase» válida y la cocina cobra', async () => {
  const { eje, menu, compra } = await ejemploCompra();
  const antes = eje.saldo('cocina', 'E:casa/EUR');
  const r = await A.transaccion(eje, 'apply a resource', { X: menu.id, quantity: 2, price: [['E:casa/EUR'], [12]] }, 'huesped', { t: T1 });
  assert.deepEqual(r.motivos, []);
  assert.equal(r.ok, true);
  assert.deepEqual(movs(r.evento), [['T', 1, 'huesped', null], ['E', 24, 'huesped', 'cocina']], 'un minuto de T y el precio por la cantidad, de quien lanza al dueño de X');
  assert.deepEqual([r.evento.sobre, r.evento.en], [menu.id, '0000000000']);
  assert.deepEqual(r.evento.payload.slice(1), [[[{ ref: menu.id }], [2], [['E:casa/EUR'], [12]]], ['all announced movements happened'], ['huesped', 'cocina'], ['apply a resource'], ['purchase']]);
  assert.match(r.evento.payload[0], /^apply a resource: huesped gives 24 E:casa\/EUR to cocina for Menú del día$/);
  assert.equal(eje.obtener(r.evento.id), undefined, 'transaccion no asienta');
  assert.deepEqual(C.validar(eje, r.evento), [], 'la plantilla de datos «purchase» la valida');
  const hecho = await eje.anadir(r.evento);
  assert.equal(eje.saldo('cocina', 'E:casa/EUR'), antes + 24);
  assert.equal(C.nombreDePlantilla(C.plantilla(eje, hecho.id)), 'purchase');
  assert.equal(cerrado(eje, hecho.id).cerrado, true);
  assert.equal(eje.poderSobre('huesped', hecho.id), 10, 'escribirla le da diez P');
  // El aro la recuerda: la plantilla de la compra original también se puede relanzar (los parámetros por defecto vienen del aro).
  const [aplica] = A.acciones(eje, menu.id, 1, 'huesped');
  const r2 = await A.transaccion(eje, aplica.plantilla, { X: menu.id, price: [['E:casa/EUR'], [12]] }, 'huesped', { t: T1 });
  assert.equal(r2.ok, true);
  void compra;
});

test('transaccion: los motivos legibles, en el idioma de quien lanza (los parámetros con su ayuda; las reglas con su 9 traducido; el libro con su texto)', async () => {
  const { eje, menu } = await ejemploCompra();
  // Un parámetro que no cumple su validación, y uno que falta.
  const mal = await A.transaccion(eje, 'apply a resource', { X: menu.id, quantity: 0, price: [['E:casa/EUR'], [12]] }, 'huesped', { t: T1, idioma: 'en' });
  assert.deepEqual([mal.ok, mal.evento, mal.motivos], [false, null, [{ regla: 'quantity', mensaje: 'quantity: how many units', parametro: 'quantity' }]]);
  const sin = await A.transaccion(eje, 'apply a resource', { X: menu.id }, 'huesped', { t: T1, idioma: 'en' });
  assert.deepEqual(sin.motivos.map((m) => m.regla), ['price']);
  // Una regla de la época, en español (la configuración de la cocina lo pide): la cocina es una cosa y no acuña.
  await eje.escribir({ autor: 'cocina', sobre: eje.alta('cocina').id, en: '9000000000', t: T1, movimientos: [minuto('cocina')], payload: ['preferences', 10, 'sober', 'es', [1, 2, 3], 'preferences'] });
  assert.equal(C.configuracion(eje, 'cocina').language, 'es');
  const emite = await A.transaccion(eje, 'issue E tied to X', { X: menu.id, denomination: 'racion', quantity: 5 }, 'cocina', { t: T1 });
  assert.equal(emite.ok, false);
  assert.ok(emite.motivos.some((m) => m.regla === 'only persons mint' && m.mensaje === 'only persons mint: cocina es una cosa (su alta la escribió casa), y solo acuñan las personas'), JSON.stringify(emite.motivos));
  assert.ok(emite.motivos.some((m) => m.regla === 'minting E needs own R issued' && /nunca ha emitido R propia/.test(m.mensaje)));
  // El mismo motivo en inglés si se pide.
  const en = await A.transaccion(eje, 'issue E tied to X', { X: menu.id, denomination: 'racion', quantity: 5 }, 'cocina', { t: T1, idioma: 'en' });
  assert.ok(en.motivos.some((m) => m.mensaje === 'only persons mint: cocina is a thing (its alta was written by casa), and only persons mint'));
  // Lo que rechaza el libro (la aritmética) llega con su texto: la huésped no tiene R de la cocina que devolverle.
  const w = await A.transaccion(eje, 'write to X', { X: menu.id, text: 'hola' }, 'huesped', { t: T1 });
  assert.deepEqual([w.ok, w.motivos], [false, [{ regla: null, mensaje: 'saldo insuficiente de R:cocina en huesped' }]]);
  // Una plantilla desconocida, o X que no está en el libro.
  assert.equal((await A.transaccion(eje, 'fly', { X: menu.id }, 'huesped')).ok, false);
  assert.equal((await A.transaccion(eje, 'apply a resource', { X: 'f'.repeat(64) }, 'huesped')).ok, false);
});

// ---------- 3. los seis grupos de R son seis precios ----------

test('write to X: el precio del grupo en que el destinatario pone a quien escribe, leído de los datos (seis casos)', async () => {
  const { eje, g, plaza } = await mundoDeGrupos();
  const ctx = new ContextoEje(eje, { epoch: EPOCA_0_BTML });
  assert.deepEqual(evaluar('("g").3 each 2.0', ctx).valor, ['my R', 'E', 'P', 'their R', 'open record', 'nothing'], 'los seis precios de la época');
  const escribe = (yo) => A.transaccion(eje, 'write to X', { X: plaza.id, text: 'hola g' }, yo, { t: T1 });
  // Desconocidos: la propia R de g devuelta (la que le guardó la invitación).
  const ana = await escribe('ana');
  assert.deepEqual([ana.ok, movs(ana.evento)], [true, [['T', 1, 'ana', null], ['R', 1, 'ana', 'g']]]);
  assert.equal(ana.evento.movimientos[1].emisor, 'g');
  assert.deepEqual([ana.evento.sobre, ana.evento.en], [g, '3000000000'], 'anclado en el 3 del alta del destinatario');
  assert.deepEqual(ana.evento.payload, [['hola g'], ['my R', 1], [{ ref: plaza.id }], ['ana', 'g'], ['write to X']]);
  // Comercial: E (la cantidad la fija el dueño; el token no se cambia).
  const bea = await escribe('bea');
  assert.deepEqual([bea.ok, movs(bea.evento)[1], bea.evento.movimientos[1].denominacion], [true, ['E', 1, 'bea', 'g'], 'vale']);
  // Expertos: P del remitente sobre el dominio del destinatario (el que carla tiene sobre el 3 del génesis por su R).
  const carla = await escribe('carla');
  assert.deepEqual([carla.ok, movs(carla.evento)[1]], [true, ['P', 1, 'carla', 'g']]);
  assert.ok(eje.hilo(raizDeAmbito(carla.evento.movimientos[1].ambito)).some((e) => e.id === g), 'P sobre un registro del dominio de g');
  // Cercanos: la propia R del remitente (acuñada en la misma transacción si no la tiene).
  const dani = await escribe('dani');
  assert.deepEqual([dani.ok, movs(dani.evento).slice(1)], [true, [['R', 1, null, 'dani'], ['R', 1, 'dani', 'g']]]);
  // Equipo: sin pago mientras exista un registro abierto entre ambos; sin él, la regla rechaza.
  const eli = await escribe('eli');
  assert.deepEqual([eli.ok, movs(eli.evento)], [false, [['T', 1, 'eli', null]]]);
  assert.deepEqual(eli.motivos.map((m) => m.regla), ['attention has a price']);
  const trato = await eje.escribir({ autor: 'g', sobre: plaza.id, t: T1, payload: ['Trato con eli', ['x'], ['all announced movements happened'], ['g', 'eli']], movimientos: [minuto('g')] });
  await eje.escribir({ autor: 'g', sobre: trato.id, en: ANUNCIO, t: T1, payload: [['E:g/vale'], [1], ['pagar'], [['g'], ['eli']]], movimientos: [minuto('g', 4)] });
  const eli2 = await escribe('eli');
  assert.deepEqual([eli2.ok, movs(eli2.evento)], [true, [['T', 1, 'eli', null]]], 'con un registro abierto entre los dos, nada que pagar');
  // Vetados: no se ofrece, y lanzada a mano la rechaza la regla.
  assert.ok(!nombres(A.acciones(eje, plaza.id, 3, 'fer')).includes('write to X'));
  const fer = await escribe('fer');
  assert.deepEqual([fer.ok, fer.motivos.map((m) => m.regla)], [false, ['attention has a price']]);
  // Las lecturas que lo dicen: el grupo (X.6.3) y el precio (X.6.2) de cada candidata.
  for (const [r, zona, precio] of [[ana, 0, 'my R'], [bea, 1, 'E'], [carla, 2, 'P'], [dani, 3, 'their R'], [eli2, 4, 'open record'], [fer, 5, 'nothing']]) {
    const c = new ContextoEje(eje, { ev: r.evento, epoch: EPOCA_0_BTML });
    assert.deepEqual([evaluar('first ev.6.3', c).valor[0], evaluar('first ev.6.2.0', c).valor[0]], [zona, precio]);
  }
  // Y se asientan: cada mensaje pasa por las reglas de siempre.
  for (const r of [ana, bea, carla, dani, eli2]) await eje.anadir(r.evento);
  assert.equal(eje.saldo('g', 'R:dani'), 1);
  // El dueño cambia el precio de un grupo con «set a group price» (el 3.k.2 de su alta): los desconocidos pagan ahora con P.
  const precio = await A.transaccion(eje, 'set a group price', { X: g, token: 'P', amount: 1, zone: 0 }, 'g', { t: T1 });
  assert.deepEqual([precio.ok, precio.evento.sobre, precio.evento.en, precio.evento.payload], [true, g, '3020000000', [['P'], [1]]]);
  await eje.anadir(precio.evento);
  const ana2 = await escribe('ana');
  assert.deepEqual([ana2.ok, movs(ana2.evento)[1]?.[0]], [true, 'P']);
});

// ---------- 4. P por mirada ----------

test('P por mirada: conseguir E coloca en r.1 y recibir R en el 3 del alta del emisor; una decisión cuenta el P de r y el de su mirada, no el de otras', async () => {
  const { eje, menu, compra } = await ejemploCompra();
  const g = eje.genesisId;
  // La huésped: diez por la R de la casa (sobre el 3 del génesis), 600 por sus 60 EUR (sobre el 1), diez por su alta y por su compra (enteros).
  const y = C.yo(eje, 'huesped');
  assert.deepEqual(y.criterio.posicionado.filter((p) => p.registro === g).map((p) => [p.mirada, p.cuanto]), [[3, 10], [1, 600]]);
  assert.deepEqual(y.criterio.posicionado.filter((p) => p.registro === compra.id).map((p) => [p.mirada, p.cuanto]), [[undefined, 10]]);
  assert.deepEqual([eje.poderSobre('huesped', g), eje.poderSobre('huesped', g, undefined, 1), eje.poderSobre('huesped', g, undefined, 3), eje.poderSobre('huesped', g, undefined, 2)], [610, 600, 10, 0]);
  const ctx = new ContextoEje(eje, { epoch: EPOCA_0_BTML });
  assert.deepEqual(evaluar('(("huesped").2.1 where it.0 = "' + g + '") each 5', ctx).valor, [3, 1], 'A.2.1: una entrada por ámbito, con la mirada en su 5');
  assert.deepEqual(evaluar('(("huesped").1 where P in it.0.0.0 and it.0.0.1 = "' + g + '") each 0.0.5', ctx).valor, [3, 1], 'D-SERIE: la mirada en el 0.5 de la serie');
  // La casa decide sobre la mirada 1 del génesis (su E): el P de la huésped sobre el 1 cuenta; sobre la mirada 3, no.
  const decide = (vista) => eje.escribir({ autor: 'casa', sobre: g, t: T1, payload: ['¿Subimos el menú?', ['x'], [['decidir'], ['x'], ['weighted sum', 'view ' + vista], ['cualquiera']]], movimientos: [minuto('casa')] });
  const D1 = await decide(1);
  const D3 = await decide(3);
  const compromete = (D) => A.transaccion(eje, 'commit P', { X: D.id, power: 'P:' + g + '.1/huesped', amount: 600 }, 'huesped', { t: T1 });
  const c1 = await compromete(D1);
  assert.equal(c1.ok, true, JSON.stringify(c1.motivos));
  assert.deepEqual(c1.evento.movimientos[1], { token: 'P', ambito: g + '.1', origen: 'huesped', cantidad: 600, de: 'huesped', a: 'huesped', estado: 'bloqueo', salida: D1.id });
  await eje.anadir(c1.evento);
  assert.deepEqual([recuento(eje, D1.id).valor, recuento(eje, D1.id).pasa], [600, true], 'sobre la mirada 1 cuenta el P de r.1 (por cantidad: «cualquiera»)');
  // Liberarlo y comprometerlo con la decisión sobre la mirada 3: pesa cero.
  await eje.escribir({ autor: 'huesped', sobre: D3.id, t: T1, payload: 'cambio', movimientos: [minuto('huesped'), { token: 'P', ambito: g + '.1', cantidad: 600, de: 'huesped', a: 'huesped', estado: 'liberacion', salida: D1.id }, { token: 'P', ambito: g + '.1', cantidad: 600, de: 'huesped', a: 'huesped', estado: 'bloqueo', salida: D3.id }] });
  assert.deepEqual([recuento(eje, D3.id).valor, recuento(eje, D3.id).pasa], [0, false], 'sobre la mirada 3 no cuenta el P de r.1');
  // El P del registro entero cuenta en las dos: la casa compromete sus diez del génesis con D3.
  await eje.escribir({ autor: 'casa', sobre: g, t: T1, payload: 'sí', movimientos: [minuto('casa'), { token: 'P', ambito: g, cantidad: 10, de: 'casa', a: 'casa', estado: 'bloqueo', salida: D3.id }] });
  assert.equal(recuento(eje, D3.id).valor, 10);
  // El peso (la lectura «share») también sabe de miradas: todo lo de la huésped sobre el génesis, o lo que pesa en una mirada.
  const total = eje.obtenidoPor('huesped').reduce((s, x) => s + x.cantidad, 0); // todo lo que obtuvo cuelga del génesis: el dominio de la casa
  assert.ok(Math.abs(peso(eje, 'huesped', g) - 610 / total) < 1e-9 && Math.abs(peso(eje, 'huesped', g, 3) - 10 / total) < 1e-9 && Math.abs(peso(eje, 'huesped', g, 1) - 600 / total) < 1e-9, 'su 100 % en el dominio de la casa: todo lo del génesis, o lo que pesa en una mirada');
  // Reposicionar hacia una mirada es un paso (bajar); de la mirada al entero, otro (subir); de una mirada a otra, dos.
  const repos = (movimientos) => eje.validar({ autor: 'huesped', sobre: menu.id, t: T1, payload: 'repos', movimientos: [minuto('huesped'), ...movimientos] }).then((m) => m.filter((x) => /repositioned/.test(x)));
  const P = (ambito, cantidad, de, a) => ({ token: 'P', ambito, cantidad, de, a });
  assert.deepEqual(await repos([P(compra.id, 10, 'huesped', null), P(compra.id + '.1', 11, null, 'huesped')]), [], 'del registro a su mirada: bajar');
  assert.deepEqual(await repos([P(g + '.3', 10, 'huesped', null), P(g, 1, null, 'huesped')]), [], 'de la mirada al registro: subir');
  assert.equal((await repos([P(g + '.3', 10, 'huesped', null), P(g + '.1', 1, null, 'huesped')])).length, 1, 'de una mirada a otra son dos pasos');
  assert.equal((await repos([P(g + '.3', 10, 'huesped', null), P(eje.alta('huesped').id, 1, null, 'huesped')])).length, 1, 'de una mirada a un hijo del registro, también');
  // «minting E needs P on its record» admite el P en r o en r.1: la huésped acuña E atada al génesis con su P del 1.
  const vale = await eje.validar(await crearEvento({ autor: 'huesped', sobre: menu.id, t: T1, payload: 'vale', movimientos: [minuto('huesped'), R('huesped', 1, null, 'huesped'), { token: 'E', emisor: 'huesped', denominacion: 'vale', registro: g, cantidad: 1, de: null, a: 'huesped' }] }));
  assert.deepEqual(vale, []);
});

// ---------- 5. la orientación de una E es el token que la paga ----------

test('el precio de una serie de E: su emisión lo declara (precio y precios), la serie lo da en su 2.2, y «apply a resource» lo lee; sin declarar, el de la época', async () => {
  const { eje, menu } = await ejemploCompra();
  const g = eje.genesisId;
  const ctx = () => new ContextoEje(eje, { epoch: EPOCA_0_BTML });
  // Sin declarar: el de la primera orientación (una unidad de E).
  assert.deepEqual(evaluar('(before.4.("E:casa/EUR")).2.2', ctx()).texto, '[["E"],[1]]');
  assert.deepEqual([0, 1, 2, 3].map((k) => evaluar('epoch.1.0.1.' + k + '.2.0', ctx()).valor[0]), ['E', 'P', 'R', 'T'], 'las cuatro orientaciones, cuatro tokens');
  // La casa escribe su taller y emite una serie atada a él que se paga con horas de T (dos por unidad) o con euros.
  const taller = await eje.escribir({ autor: 'casa', sobre: g, t: T1, payload: ['Taller de la casa', ['x'], ['all announced movements happened']], movimientos: [minuto('casa')] });
  const emision = await eje.escribir({ autor: 'casa', sobre: taller.id, t: T1, payload: 'plazas del taller', movimientos: [minuto('casa'), { token: 'E', emisor: 'casa', denominacion: 'plaza-taller', registro: taller.id, cantidad: 4, de: null, a: 'casa', precio: ['T:hora', 2], precios: [['T:hora', 2], ['E:casa/EUR', 15]] }] });
  const clave = 'E:casa/plaza-taller@' + taller.id;
  assert.deepEqual([eje.serie(clave).precio, eje.serie(clave).precios], [['T:hora', 2], [['T:hora', 2], ['E:casa/EUR', 15]]]);
  assert.deepEqual(evaluar('(before.4.("' + clave + '")).2.2 each 0', ctx()).valor, ['T:hora', 'E:casa/EUR'], 'el principal primero, luego los aceptados');
  assert.deepEqual(evaluar('(("' + taller.id + '").1 where count it.0.2.2 > 0) each 0.2.2.1', ctx()).valor, [2, 15]);
  // El aro lee ese precio: la huésped pide una plaza del taller y paga con su tiempo.
  const [aplica] = A.acciones(eje, taller.id, 1, 'huesped');
  assert.deepEqual([aplica.nombre, aplica.parametros.find((p) => p.nombre === 'price').valor], ['apply a resource', [['T:hora'], [2]]]);
  const r = await A.transaccion(eje, 'apply a resource', { X: taller.id, quantity: 2 }, 'huesped', { t: T1 });
  assert.deepEqual(r.evento.movimientos[1], { token: 'T', escala: 'hora', cantidad: 4, de: 'huesped', a: 'casa' });
  // Las reglas de siempre deciden si pasa: T no cruza de persona (la casa es una persona), y la regla lo dice.
  assert.deepEqual([r.ok, r.motivos.map((m) => m.regla)], [false, ['T only goes to things']]);
  // Con el precio aceptado en euros, pasa.
  const eur = await A.transaccion(eje, 'apply a resource', { X: taller.id, quantity: 2, price: [['E:casa/EUR'], [15]] }, 'huesped', { t: T1 });
  assert.deepEqual([eur.ok, eur.evento.movimientos[1].cantidad, eur.evento.movimientos[1].denominacion], [true, 30, 'EUR']);
  // El precio no es forma libre.
  assert.ok(eje.validar({ ...emision, movimientos: [minuto('casa'), { token: 'E', emisor: 'casa', denominacion: 'x', cantidad: 1, de: null, a: 'casa', precio: 'T:hora' }] }).then((m) => m.some((x) => /precio de E es/.test(x))));
  void menu;
});

// ---------- 6. los pasos de un proceso se tipan por token: «stage» ----------

test('stage (X.4.8): lo anunciado y pendiente, por estación (E pagar, P decidir, R atender, T trabajar); la estación nombra la plantilla que lo mueve', async () => {
  const { eje, menu, compra } = await ejemploCompra();
  const g = eje.genesisId;
  // La cocina abre un encargo con tres anuncios: la huésped paga euros (E), le cede poder sobre la compra (P) y la casa devuelve su R a la huésped… no: la huésped devuelve R a la casa (R).
  const encargo = await eje.escribir({ autor: 'cocina', sobre: menu.id, t: T1, payload: ['Encargo', ['x'], ['all announced movements happened'], ['cocina', 'huesped']], movimientos: [minuto('cocina')] });
  const anuncio = (serie, cantidad, que, de, a) => eje.escribir({ autor: 'cocina', sobre: encargo.id, en: ANUNCIO, t: T1, payload: [[serie], [cantidad], [que], [[de], [a]]], movimientos: [minuto('cocina', 4)] });
  const aE = await anuncio('E:casa/EUR', 5, 'pagar', 'huesped', 'cocina');
  const aP = await anuncio('P:' + compra.id + '/huesped', 1, 'decidir', 'huesped', 'cocina');
  const aR = await anuncio('R:casa', 1, 'atender', 'huesped', 'casa');
  const porFamilia = (lista) => Object.fromEntries(lista.map((e) => [e.familia, e]));
  const antes = porFamilia(A.estaciones(eje, encargo.id));
  assert.deepEqual(Object.entries(antes).map(([f, e]) => [f, e.estacion, e.plantilla, e.pendientes.length, e.hechos.length]), [['E', 'pay', 'pay', 1, 0], ['P', 'decide', 'deliver', 1, 0], ['R', 'attend', 'deliver', 1, 0], ['T', 'work', 'deliver', 0, 0]]);
  assert.deepEqual([antes.E.pendientes, antes.P.pendientes, antes.R.pendientes], [[aE.id], [aP.id], [aR.id]]);
  const ctx = new ContextoEje(eje, { epoch: EPOCA_0_BTML });
  assert.equal(evaluar('count ("' + encargo.id + '").4.8', ctx).valor[0], 3, 'la lectura, en el 4.8 del registro');
  assert.deepEqual(evaluar('(("' + encargo.id + '").4.8 where E in (before.4.(first it.0)).0.0) each 5', ctx).valor, [aE.id], 'la familia de un anuncio se busca por su valor en las series del libro (before.4)');
  // El camino de la huésped: tres pasos suyos, uno por estación, con la plantilla que la cumple.
  const c = await A.camino(eje, encargo.id, 'huesped', { t: T1 });
  assert.deepEqual(c.pasos.map((p) => [p.fuente, p.regla, p.hacer?.plantilla, p.espera]), [['reglas', 'stage', 'pay', null], ['reglas', 'stage', 'deliver', null], ['reglas', 'stage', 'deliver', null]]);
  assert.ok(c.pasos.every((p) => /^stage: /.test(p.falta)), 'lo que falta se lee con el 9 de la lectura');
  // Pagar: la plantilla «pay» mueve lo anunciado; después la estación E está hecha.
  const pago = await A.transaccion(eje, 'pay', { X: encargo.id, announcement: { ref: aE.id } }, 'huesped', { t: T1 });
  assert.deepEqual([pago.ok, movs(pago.evento)[1]], [true, ['E', 5, 'huesped', 'cocina']]);
  await eje.anadir(pago.evento);
  const despues = porFamilia(A.estaciones(eje, encargo.id));
  assert.deepEqual([despues.E.hechos, despues.E.pendientes, despues.P.pendientes], [[aE.id], [], [aP.id]]);
  assert.equal(cerrado(eje, encargo.id).cerrado, false);
  // Lo demás, con autoejecutar: entrega el P y la R anunciados y el encargo se cierra.
  const auto = await A.autoejecutar(eje, encargo.id, 'huesped', null, { t: T1 });
  assert.deepEqual([auto.hechos.length, auto.parado], [2, null]);
  assert.equal(cerrado(eje, encargo.id).cerrado, true);
  assert.deepEqual(A.estaciones(eje, encargo.id).map((e) => e.pendientes.length), [0, 0, 0, 0]);
  assert.equal(eje.saldo('cocina', 'P:' + compra.id + '/huesped'), 1);
  assert.deepEqual(A.estacionesDeLaEpoca().map((e) => e.familia + ' ' + e.estacion), ['E pay', 'P decide', 'R attend', 'T work']);
  void g;
});

test('transaccion y autoejecutar: con claves, la candidata se firma antes de validarse (opciones.firmar) y pasa; sin firmar, quien tiene clave ve «who has a key signs»', async () => {
  const claves = { casa: await generarClaves(), cocina: await generarClaves(), huesped: await generarClaves() };
  const { eje, menu } = await ejemploCompra({ claves });
  const firmar = (ev) => firmarEvento(ev, claves.huesped.privada);
  const sin = await A.transaccion(eje, 'apply a resource', { X: menu.id, quantity: 1, price: [['E:casa/EUR'], [12]] }, 'huesped', { t: T1 });
  assert.deepEqual([sin.ok, sin.motivos.map((m) => m.regla)], [false, ['who has a key signs']]);
  const con = await A.transaccion(eje, 'apply a resource', { X: menu.id, quantity: 1, price: [['E:casa/EUR'], [12]] }, 'huesped', { t: T1, firmar });
  assert.equal(con.ok, true, JSON.stringify(con.motivos));
  assert.ok(con.evento.firma, 'el evento vuelve firmado');
  await eje.anadir(con.evento);
  // Autoejecutar con claves: la huésped paga la reserva firmando cada paso.
  const { eje: b, reserva } = await ejemploReserva({ claves: { ...claves, recepcion: await generarClaves() }, confirmar: false });
  const a = await A.autoejecutar(b, reserva.id, 'huesped', firmar, { t: '2026-11-09T09:00:00Z' });
  assert.deepEqual([a.hechos.length, a.parado], [1, null]);
  assert.ok(a.hechos[0].evento.firma);
});

// ---------- 7. el camino ----------

test('camino: la reserva dice a la huésped lo que le falta (pagar) y lo que espera de la casa (las plazas), con la plantilla que lo cumple; autoejecutar lo lanza', async () => {
  const { eje, reserva } = await ejemploReserva({ confirmar: false });
  const t = '2026-11-09T09:00:00Z';
  const h = await A.camino(eje, reserva.id, 'huesped', { t });
  const mios = h.pasos.filter((p) => p.hacer && !p.espera);
  const esperas = h.pasos.filter((p) => p.espera);
  assert.deepEqual([mios.length, mios[0].hacer.plantilla, esperas.length, [...new Set(esperas.map((p) => p.espera))]], [1, 'pay', 3, ['casa']]);
  assert.match(mios[0].falta, /^stage: .* · pagar 165 E:casa\/EUR huesped → casa$/);
  assert.ok(esperas.every((p) => /ocupar 1 E:casa\/1100000000@2026-11-2\d@/.test(p.falta)));
  assert.equal(h.niveles, undefined, 'la reserva ya tiene madurez: no hace falta ubicarse');
  // La casa ve lo contrario: tres pasos suyos (las plazas) y la espera del pago.
  const c = await A.camino(eje, reserva.id, 'casa', { t });
  assert.deepEqual([c.pasos.filter((p) => p.hacer && !p.espera).map((p) => p.hacer.plantilla), c.pasos.filter((p) => p.espera).map((p) => p.espera)], [['pay', 'pay', 'pay'], ['huesped']]);
  // Autoejecutar: la huésped paga, la casa entrega, y la reserva queda cerrada; nadie mueve lo ajeno.
  const a = await A.autoejecutar(eje, reserva.id, 'huesped', null, { t });
  assert.deepEqual([a.hechos.length, a.parado, movs(a.hechos[0].evento)[1]], [1, null, ['E', 165, 'huesped', 'casa']]);
  assert.equal(cerrado(eje, reserva.id).cerrado, false);
  const b = await A.autoejecutar(eje, reserva.id, 'casa', null, { t });
  assert.deepEqual([b.hechos.length, b.parado], [3, null]);
  assert.equal(cerrado(eje, reserva.id).cerrado, true);
  assert.deepEqual((await A.camino(eje, reserva.id, 'huesped', { t })).pasos, []);
  // La firma que le pasa la carta se aplica a cada evento antes de asentarlo.
  const { eje: e2, reserva: r2 } = await ejemploReserva({ confirmar: false });
  const firmados = [];
  await A.autoejecutar(e2, r2.id, 'huesped', (ev) => { firmados.push(ev.id); return ev; }, { t });
  assert.equal(firmados.length, 1);
});

test('camino: las sugerencias pasan por las mismas reglas, el orden sigue el criterio del dueño y autoejecutar se detiene en el primer paso que no pasa', async () => {
  const { eje, menu, compra } = await ejemploCompra();
  // Un encargo de la cocina que pide a la huésped más euros de los que tiene.
  const encargo = await eje.escribir({ autor: 'cocina', sobre: menu.id, t: T1, payload: ['Encargo caro', ['x'], ['all announced movements happened'], ['cocina', 'huesped']], movimientos: [minuto('cocina')] });
  await eje.escribir({ autor: 'cocina', sobre: encargo.id, en: ANUNCIO, t: T1, payload: [['E:casa/EUR'], [1000], ['pagar'], [['huesped'], ['cocina']]], movimientos: [minuto('cocina', 4)] });
  const auto = await A.autoejecutar(eje, encargo.id, 'huesped', null, { t: T1 });
  assert.deepEqual([auto.hechos, auto.parado.paso.hacer.plantilla, auto.parado.motivos], [[], 'pay', [{ regla: null, mensaje: 'saldo insuficiente de E:casa/EUR en huesped' }]]);
  // Las sugerencias: un gancho sin LLM; cada una se construye y valida, y queda marcada.
  const sugerencias = () => [{ plantilla: 'anchor here', parametros: { title: 'una nota' } }, { plantilla: 'give own R', parametros: { amount: 1 } }];
  const c = await A.camino(eje, menu.id, 'huesped', { t: T1, sugerencias });
  const s = c.pasos.filter((p) => p.fuente === 'sugerencia');
  assert.deepEqual(s.map((p) => [p.hacer.plantilla, p.pasa]), [['anchor here', true], ['give own R', true]]);
  // El orden: lo que el dueño nombra en el 2.3 de X va delante.
  const X = await eje.escribir({ autor: 'cocina', sobre: menu.id, t: T1, payload: ['Con criterio', ['x'], [['x'], ['x'], ['x'], ['give own R']]], movimientos: [minuto('cocina')] });
  const o = await A.camino(eje, X.id, 'huesped', { t: T1, sugerencias });
  assert.deepEqual(o.pasos.filter((p) => p.fuente === 'sugerencia').map((p) => p.hacer.plantilla), ['give own R', 'anchor here']);
  // Las caducidades próximas son pasos de espera (del emisor) o míos (expire something mine).
  const { eje: b, reserva, habitacion } = await ejemploReserva({ confirmar: false });
  const cad = await A.camino(b, habitacion.id, 'huesped', { t: '2026-11-20T18:00:00Z' });
  assert.ok(cad.pasos.some((p) => p.espera === 'casa' && /expires at 2026-11-21T12:00:00Z/.test(p.falta)), 'la plaza de la primera noche caduca al día siguiente');
  const mia = await A.camino(b, habitacion.id, 'casa', { t: '2026-11-20T18:00:00Z' });
  assert.ok(mia.pasos.some((p) => p.hacer?.plantilla === 'expire something mine'));
  void compra; void reserva;
});

test('el tutorial del alta sale del 9 de la plantilla de identidad: la clave (la regla), los grupos de atención y el primer registro; autoejecutar hace lo que puede y se para en lo que pide algo', async () => {
  const { eje, g } = await mundoDeGrupos();
  await entrarPorInvitacion(eje, { por: 'g', quien: 'nueva', t: T1 });
  const alta = eje.alta('nueva').id;
  const c = await A.camino(eje, alta, 'nueva', { t: T1 });
  const tutorial = c.pasos.filter((p) => p.fuente === 'tutorial');
  assert.deepEqual(tutorial.map((p) => [p.regla ?? p.hacer.plantilla, p.hecho]), [['a key is declared at its alta', false], ['set a group price', false], ['anchor here', false]]);
  assert.match(tutorial[0].falta, /^a key is declared at its alta: /);
  assert.deepEqual(tutorial[1].hacer.parametros, { token: 'my R', amount: 1, zone: 0 });
  assert.equal(tutorial[2].hacer.parametros.title, undefined, 'el primer registro pide un título');
  // Autoejecutar: pone el precio de su primer grupo y se para en el registro, que pide un título.
  const auto = await A.autoejecutar(eje, alta, 'nueva', null, { t: T1 });
  assert.deepEqual([auto.hechos.map((h) => h.paso.hacer.plantilla), auto.parado.paso.hacer.plantilla, auto.parado.motivos.map((m) => m.regla)], [['set a group price'], 'anchor here', ['title']]);
  assert.equal(eje.sobre(alta, '3020000000').length, 1);
  const otra = await A.camino(eje, alta, 'nueva', { t: T1 });
  assert.deepEqual(otra.pasos.filter((p) => p.fuente === 'tutorial').map((p) => p.hecho), [false, true, false]);
  // Con el título, el primer registro pasa, y el tutorial queda hecho.
  const r = await A.transaccion(eje, 'anchor here', { X: alta, title: 'Mi primer registro' }, 'nueva', { t: T1 });
  assert.equal(r.ok, true, JSON.stringify(r.motivos));
  await eje.anadir(r.evento);
  assert.deepEqual((await A.camino(eje, alta, 'nueva', { t: T1 })).pasos.filter((p) => p.fuente === 'tutorial').map((p) => p.hecho), [false, true, true]);
  // El tutorial es dato: en una copia de la época con otro 9, otros pasos.
  const otraEpoca = epocaCon((e) => { e[3][0][9] = ['cómo: su guía', 'give own R']; });
  assert.deepEqual((await A.camino(eje, alta, 'nueva', { t: T1, epoca: otraEpoca })).pasos.filter((p) => p.fuente === 'tutorial').map((p) => p.hacer.plantilla), ['give own R']);
  // Las plantillas que lanzan el camino: «follow the path» construye el primer paso mío; «view thread» solo lee.
  const sigue = await A.transaccion(eje, 'follow the path', { X: g }, 'nueva', { t: T1 });
  assert.equal(sigue.paso, null, 'sobre el génesis, a la nueva no le falta nada');
  const ve = await A.transaccion(eje, 'view thread', { X: g }, 'nueva', { t: T1 });
  assert.deepEqual([ve.ok, ve.evento, ve.lectura.nombre], [true, null, 'view thread']);
});

test('aggregate T engloba lo que cuelga de X en un registro de la fábrica de X con las partes en su 6; la tarea de Tasks se paga por el aro', async () => {
  const { eje, menu, compra } = await ejemploCompra();
  const r = await A.transaccion(eje, 'aggregate T', { X: menu.id }, 'cocina', { t: T1 });
  assert.equal(r.ok, true, JSON.stringify(r.motivos));
  assert.deepEqual([r.evento.sobre, r.evento.en, r.evento.payload[6], r.evento.payload[1]], [menu.id, '4000000000', [{ ref: compra.id }], [3]], 'las dos horas del menú y la de la compra; la parte, la compra');
  // Tasks: la organizadora paga lo anunciado con «pay» en vez de a mano.
  const t = await ejemploTarea({ hasta: 'entregada' });
  const pasos = (await A.camino(t.eje, t.tarea.id, 'organizadora', { t: '2026-11-13T18:00:00Z' })).pasos.filter((p) => p.hacer);
  assert.deepEqual(pasos.map((p) => p.hacer.plantilla), ['pay', 'pay']);
  const auto = await A.autoejecutar(t.eje, t.tarea.id, 'organizadora', null, { t: '2026-11-13T18:00:00Z' });
  assert.deepEqual([auto.hechos.length, auto.parado, cerrado(t.eje, t.tarea.id).cerrado], [2, null, true]);
});

test('el índice expone las acciones como espacio de nombres, y el contexto resuelve «me»', async () => {
  const agram = await import('../src/index.js');
  assert.equal(agram.acciones.transaccion, A.transaccion);
  const { eje } = await ejemploCompra();
  const ctx = new ContextoEje(eje, { epoch: EPOCA_0_BTML, me: 'huesped' });
  assert.deepEqual(evaluar('me', ctx).valor, ['huesped']);
  assert.equal(evaluar('count me.3', ctx).valor[0], 6, 'sus grupos de atención');
  assert.equal(evaluar('me.1', new ContextoEje(eje, { epoch: EPOCA_0_BTML })).estado, 'PENDIENTE', 'sin quien mira, no hay me');
});
