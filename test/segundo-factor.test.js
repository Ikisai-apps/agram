// El segundo factor (VG 12/13-11, #66 y #70; SIP 0 de StateArk, objeto «autorización» y regla «second factor»): el
// umbral es un criterio del usuario en el 2.4 de su alta (la plantilla PV2 «second factor»: 0 nombre, 1 familia o serie,
// 2 cantidad, 3 titular, 4 la acción); al ejecutar desde el 4, si lo que mueve alcanza el umbral, el registro se escribe
// pero su estación queda en «autorizada» («pendiente de segundo factor») hasta que la cosa titular escribe y firma una
// autorización anclada sobre él (acciones.autorizar). Las dos lecturas de la época: «second factor» (X.6.8.7) y
// «authorized by the holder» (X.6.8.8). Docs: docs/CONTRATO.md §12.4 bis.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../src/acciones.js';
import * as contrato from '../src/contrato.js';
import { EPOCA_0_BTML } from '../src/epocas.js';
import { ANUNCIO } from '../src/motor.js';
import { generarClaves, firmarPosesion } from '../src/autoridad.js';
import { ejemploCompra } from '../ejemplos/ikisai/compra-food.mjs';
import { pagaElCoste } from './ayudas-coste.js';
import { arbol as arbolEnIdioma, formulario, preferencias, segundoFactorDeConfiguracion } from '../carta/carta.js';
import { html, htmlConfiguracion } from '../carta/dom.js';

const T1 = '2026-11-08T12:00:00Z';
const ORDENADOR = { ancho: 1920, alto: 1080 };
const regla = (nombre) => EPOCA_0_BTML.lecturas.find((r) => r[0][0] === nombre);

/**
 * La compra de ejemplo: la cocina abre un encargo y anuncia que la huésped le pagará 7 EUR; la huésped da de alta una
 * cosa con clave («cartera», su segundo factor: la custodia StateArk) y le da 60 minutos de T.
 */
async function mundo() {
  const c = await ejemploCompra();
  const { eje, menu } = c;
  const encargo = await eje.escribir({ autor: 'cocina', sobre: menu.id, t: T1, payload: ['Encargo', ['x'], ['all announced movements happened'], ['cocina', 'huesped']], movimientos: [pagaElCoste('cocina')] });
  const anunciado = { token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 7, de: 'huesped', a: 'cocina', estado: 'anunciado', refiere: '2026-11-20T10:00:00Z' };
  const anuncio = await eje.escribir({ autor: 'cocina', sobre: encargo.id, en: ANUNCIO, t: T1, payload: 'pagar la cena', movimientos: [pagaElCoste('cocina'), anunciado] });
  const cosa = await generarClaves();
  const altaH = eje.alta('huesped').id;
  const r = await A.transaccion(eje, 'register a thing', { X: altaH, thing: 'cartera', minutes: 60, key: cosa.publica }, 'huesped', { t: T1 });
  assert.ok(r.ok, JSON.stringify(r.motivos));
  await eje.anadir(await firmarPosesion(r.evento, 'cartera', cosa.privada));
  return { ...c, eje, encargo, anuncio, cosa, altaH };
}

/** La huésped escribe su criterio con la plantilla «second factor» (en el 2.4 de su alta). */
async function criterio(m, family, amount, holder = 'cartera') {
  const r = await A.transaccion(m.eje, 'second factor', { X: m.altaH, family, amount, holder }, 'huesped', { t: T1 });
  assert.ok(r.ok, JSON.stringify(r.motivos));
  await m.eje.anadir(r.evento);
  return r.evento;
}

/** La huésped paga el anuncio desde el 4 («pay», anclado sobre el anuncio). */
async function pagar(m) {
  const r = await A.transaccion(m.eje, 'pay', { X: m.encargo.id }, 'huesped', { t: T1 });
  assert.ok(r.ok, JSON.stringify(r.motivos));
  await m.eje.anadir(r.evento);
  return r;
}

const deE = (m) => A.estaciones(m.eje, m.encargo.id).find((e) => e.familia === 'E');

test('la plantilla PV2 «second factor» escribe el criterio en el 2.4 de mi alta, sin huecos: 0 nombre, 1 familia o serie, 2 cantidad, 3 titular (una cosa mía), 4 la acción', async () => {
  const m = await mundo();
  const p = A.plantillaDeTransaccion('second factor');
  assert.ok(p, 'está en epoch.9.6');
  assert.deepEqual(p[8], [2, 5], 'PV2; «attach a file» sigue la última del sitio 2');
  assert.deepEqual(A.plantillaDeTransaccion('attach a file')[8], [2, 6]);
  assert.ok(A.acciones(m.eje, m.altaH, 2, 'huesped').some((a) => a.nombre === 'second factor'), 'se ofrece sobre mi alta');
  assert.ok(!A.acciones(m.eje, m.altaH, 2, 'cocina').some((a) => a.nombre === 'second factor'), 'no sobre el alta de otro');
  // El titular se elige entre MIS cosas (contrato.opciones con el defecto «=first …» del parámetro).
  const f = formulario(m.eje, m.altaH, 'second factor', 'huesped');
  assert.deepEqual(f.campos.find((c) => c.nombre === 'holder').opciones.map((o) => o.valor), ['cartera']);
  const ev = await criterio(m, 'E', 5);
  assert.equal(ev.en, '2400000000');
  assert.deepEqual(ev.payload, ['second factor', ['E'], [5], ['cartera'], ['second factor']]);
  assert.deepEqual(A.criteriosDeSegundoFactor(m.eje, 'huesped').map((c) => [c.familias, c.cantidad, c.titular]), [[['E'], 5, 'cartera']]);
  // Un titular que no es cosa mía no vale (la validación del parámetro).
  const otro = await A.transaccion(m.eje, 'second factor', { X: m.altaH, family: 'E', amount: 5, holder: 'cocina' }, 'huesped', { t: T1 });
  assert.equal(otro.ok, false);
  assert.ok(otro.motivos.some((x) => x.parametro === 'holder'));
  // Las dos lecturas de la época, en X.6.8.7 y X.6.8.8; leen, no mueven.
  assert.deepEqual([regla('second factor')[3], regla('second factor')[4]], [['X.6.8.7'], ['read']]);
  assert.deepEqual([regla('authorized by the holder')[3], regla('authorized by the holder')[4]], [['X.6.8.8'], ['read']]);
});

test('umbral no alcanzado: el pago se ejecuta como siempre; nada cambia', async () => {
  const m = await mundo();
  await criterio(m, 'E', 10);
  const { evento } = await pagar(m);
  assert.equal(A.estacionDeAnuncio(m.eje, m.anuncio.id), 'ejecutada');
  assert.deepEqual(deE(m).pendientesDeSegundoFactor, []);
  assert.deepEqual(A.segundoFactor(m.eje, evento.id), { exige: false, pendiente: false, criterios: [], titulares: [], autorizaciones: [], motivo: null, estado: 'RESUELTO' });
});

test('umbral alcanzado: el registro se escribe, el anuncio queda en «autorizada» y pendiente de segundo factor; ejecutar lo sabe antes', async () => {
  const m = await mundo();
  await criterio(m, 'E', 5);
  const antes = A.ejecucion(m.eje, 'pay', { X: m.encargo.id }, 'huesped', { t: T1 });
  assert.deepEqual([antes.segundoFactor.exige, antes.segundoFactor.titulares], [true, ['cartera']], 'el botón de ejecutar lo sabe antes');
  const saldo = m.eje.saldo('huesped', 'E:casa/EUR');
  const r = await pagar(m);
  assert.deepEqual(r.segundoFactor.titulares, ['cartera']);
  assert.equal(m.eje.saldo('huesped', 'E:casa/EUR'), saldo - 7, 'nada se rechaza: lo movido está movido');
  assert.equal(A.estacionDeAnuncio(m.eje, m.anuncio.id), 'autorizada');
  assert.deepEqual(deE(m).pendientesDeSegundoFactor, [m.anuncio.id]);
  assert.deepEqual(deE(m).pendientesDeSello, [], 'sin sello configurado, no es «pendiente de sello»');
  const ej = A.ejecuciones(m.eje, m.encargo.id).find((x) => x.ocupante?.ref === m.anuncio.id);
  assert.deepEqual([ej.estacion, ej.pendienteDeSegundoFactor, ej.pendienteDeSello], ['autorizada', true, undefined]);
  const sf = A.segundoFactor(m.eje, r.evento.id);
  assert.deepEqual([sf.exige, sf.pendiente, sf.titulares], [true, true, ['cartera']]);
  assert.match(sf.motivo, /falta la autorización de cartera/);
  // «si mueve T» con cantidad 3: quemar T al escribir es mover T (el coste cuenta).
  const m2 = await mundo();
  await criterio(m2, 'T', 3);
  await pagar(m2);
  assert.equal(A.estacionDeAnuncio(m2.eje, m2.anuncio.id), 'autorizada');
});

test('la autorización escrita y firmada por la cosa titular pasa el anuncio a «ejecutada»; la del propio usuario o la de otro no, con motivo claro', async () => {
  const m = await mundo();
  await criterio(m, 'E', 5);
  const { evento: pago } = await pagar(m);
  // La huésped se autoriza a sí misma: no vale (el titular es su cosa).
  const propia = await A.autorizar(m.eje, pago.id, 'huesped', undefined, { t: T1 });
  assert.ok(propia.ok, JSON.stringify(propia.motivos));
  await m.eje.anadir(propia.evento);
  let sf = A.segundoFactor(m.eje, pago.id);
  assert.equal(sf.pendiente, true);
  assert.match(sf.motivo, /la escribe huesped y la firma nadie, y solo vale la que escribe y firma el titular, cartera/);
  assert.equal(A.estacionDeAnuncio(m.eje, m.anuncio.id), 'autorizada');
  // Otro (la cocina) tampoco.
  const ajena = await A.autorizar(m.eje, pago.id, 'cocina', undefined, { t: T1 });
  assert.ok(ajena.ok, JSON.stringify(ajena.motivos));
  await m.eje.anadir(ajena.evento);
  assert.equal(A.segundoFactor(m.eje, pago.id).pendiente, true);
  // La cosa sin firmar no pasa el suelo: tiene clave, y quien tiene clave firma.
  const sinFirma = await A.autorizar(m.eje, pago.id, 'cartera', undefined, { t: T1 });
  assert.equal(sinFirma.ok, false);
  // La cosa, firmada con su clave: ejecutada.
  const buena = await A.autorizar(m.eje, pago.id, 'cartera', m.cosa.privada, { t: T1 });
  assert.ok(buena.ok, JSON.stringify(buena.motivos));
  assert.deepEqual(buena.evento.payload, [['autorización', 'SIP 0'], [{ ref: pago.id }], ['StateArk/SecondFactor/v1'], ['cartera']]);
  assert.deepEqual([buena.evento.sobre, buena.evento.en, buena.evento.firmante], [pago.id, '4000000000', 'cartera']);
  await m.eje.anadir(buena.evento);
  sf = A.segundoFactor(m.eje, pago.id);
  assert.deepEqual([sf.exige, sf.pendiente, sf.motivo, sf.criterios[0].autorizado], [true, false, null, true]);
  assert.equal(A.estacionDeAnuncio(m.eje, m.anuncio.id), 'ejecutada');
  assert.deepEqual(deE(m).pendientesDeSegundoFactor, []);
  assert.deepEqual(A.ejecuciones(m.eje, m.encargo.id).filter((x) => x.ocupante?.ref === m.anuncio.id).map((x) => [x.estacion, x.pendienteDeSegundoFactor]), [['ejecutada', undefined]]);
});

test('criterio con varias series (una por ocupante del 1): lo alcanza la que se mueve, y no las demás', async () => {
  const m = await mundo();
  const ev = await criterio(m, ['E:otra/USD', 'E:casa/EUR'], 5);
  assert.deepEqual(ev.payload[1], ['E:otra/USD', 'E:casa/EUR']);
  await pagar(m);
  assert.equal(A.estacionDeAnuncio(m.eje, m.anuncio.id), 'autorizada');
  const n = await mundo();
  await criterio(n, ['E:otra/USD', 'T:hora'], 1);
  await pagar(n);
  assert.equal(A.estacionDeAnuncio(n.eje, n.anuncio.id), 'ejecutada', 'ni E:otra/USD ni T:hora se mueven');
});

test('un registro del 4 que no es un anuncio también espera: estación propia «autorizada» y, autorizado, «ejecutada»', async () => {
  const m = await mundo();
  await criterio(m, 'E', 1);
  const r = await A.transaccion(m.eje, 'apply a resource', { X: m.menu.id, quantity: 2, price: [['E:casa/EUR'], [12]] }, 'huesped', { t: T1 });
  assert.ok(r.ok, JSON.stringify(r.motivos));
  await m.eje.anadir(r.evento);
  const de = () => A.ejecuciones(m.eje, m.menu.id).find((x) => x.ocupante?.ref === r.evento.id);
  assert.deepEqual([de().estacion, de().pendienteDeSegundoFactor], ['autorizada', true]);
  await m.eje.anadir((await A.autorizar(m.eje, r.evento.id, 'cartera', m.cosa.privada, { t: T1 })).evento);
  assert.deepEqual([de().estacion, de().pendienteDeSegundoFactor], ['ejecutada', undefined]);
  // Lo de quien no tiene criterio no cambia: sin estación ni marca.
  assert.ok(A.ejecuciones(m.eje, m.menu.id).filter((x) => x.ocupante?.ref && m.eje.obtener(x.ocupante.ref)?.autor === 'cocina').every((x) => x.pendienteDeSegundoFactor === undefined));
});

// ---------- la carta ----------

test('carta: la celda del 4 y el reverso dicen «pendiente de segundo factor»; ejecutar lo avisa antes; autorizado, «ejecutada» y sin marca', async () => {
  const m = await mundo();
  await criterio(m, 'E', 5);
  // El formulario en modo ejecutar avisa antes: «esto pedirá el segundo factor».
  const conForm = () => arbolEnIdioma({ foco: { X: m.encargo.id, pv: 4 }, formulario: { X: m.encargo.id, accion: 'pay', valores: {}, ejecutar: true } }, m.eje, 'huesped', ORDENADOR, { idioma: 'es' });
  const f = (await conForm()).formulario;
  assert.deepEqual(f.ejecucion.segundoFactor, { titulares: ['cartera'] });
  assert.match(html(await conForm()), /<p class="aviso-segundo-factor" role="note">esto pedirá el segundo factor: [^<]*cartera lo autorice desde StateArk<\/p>/);
  const { evento: pago } = await pagar(m);
  const cuatro = html(await arbolEnIdioma({ foco: { X: m.encargo.id, pv: 4 } }, m.eje, 'huesped', ORDENADOR, { idioma: 'es' }));
  assert.match(cuatro, /<li class="ejecucion" data-estado="autorizada"[^>]*>(?:(?!<\/li>).)*<small class="pendiente-segundo-factor" title="[^"]+">pendiente de segundo factor<\/small><\/li>/s);
  assert.doesNotMatch(cuatro, /pendiente-sello/, 'no es «pendiente de sello»');
  const reverso = await arbolEnIdioma({ foco: { X: pago.id, pv: 5 } }, m.eje, 'huesped', ORDENADOR, { idioma: 'es' });
  assert.equal(reverso.centro.pendienteDeSegundoFactor, true);
  assert.match(html(reverso), /<p class="verificado-linea"><small class="pendiente-segundo-factor" title="falta la autorización de cartera[^"]*">pendiente de segundo factor<\/small><\/p>/);
  await m.eje.anadir((await A.autorizar(m.eje, pago.id, 'cartera', m.cosa.privada, { t: T1 })).evento);
  const despues = html(await arbolEnIdioma({ foco: { X: m.encargo.id, pv: 4 } }, m.eje, 'huesped', ORDENADOR, { idioma: 'es' }));
  assert.doesNotMatch(despues, /pendiente-segundo-factor/);
  assert.match(despues, /<li class="ejecucion" data-estado="ejecutada"/);
});

test('carta: la configuración (personaje del 0 → 2) tiene el desplegable «segundo factor» con el titular entre mis cosas y los criterios que ya hay', async () => {
  const m = await mundo();
  const sf = segundoFactorDeConfiguracion(m.eje, 'huesped');
  assert.deepEqual(sf.campos.map((c) => c.nombre), ['family', 'amount', 'holder']);
  assert.deepEqual(sf.campos.find((c) => c.nombre === 'holder').opciones.map((o) => o.valor), ['cartera']);
  assert.deepEqual(sf.criterios, []);
  const h0 = htmlConfiguracion(preferencias(m.eje, 'huesped'), { segundoFactor: sf });
  assert.match(h0, /<details class="segundo-factor"[^>]*><summary>segundo factor<\/summary>/);
  assert.match(h0, /<select id="segundo-factor-holder" data-segundo-factor-campo="holder"[^>]*><option value="cartera" selected>/);
  assert.match(h0, /<input id="segundo-factor-family" data-segundo-factor-campo="family" type="text" value=""/);
  assert.match(h0, /sin segundo factor/);
  await criterio(m, 'E', 5);
  const h1 = htmlConfiguracion(preferencias(m.eje, 'huesped'), { segundoFactor: segundoFactorDeConfiguracion(m.eje, 'huesped') });
  assert.match(h1, /<details class="segundo-factor"[^>]* open><summary>/);
  assert.match(h1, /<ul class="segundo-factor-actuales"><li>E desde 5 → cartera<\/li><\/ul>/);
});

// ---------- #70 (3): autorizar también quema T, precalculado desde el 4 (VG 14-11) ----------

/** Lo que quema de T real quien escribe un evento, en segundos del calendario. */
const quemaDe = (ev, de) => ev.movimientos.filter((m) => m.token === 'T' && m.de === de && m.a === null).reduce((s, m) => s + m.cantidad * { segundo: 1, minuto: 60, hora: 3600 }[m.escala], 0);

test('coste de autorizar: un segundo por criterio alcanzado, mínimo un minuto; se suma a lo exigido y se quema en la propuesta (prepagado)', async () => {
  const m0 = await mundo();
  const sin = A.ejecucion(m0.eje, 'pay', { X: m0.encargo.id }, 'huesped', { t: T1 });
  assert.deepEqual([sin.autorizacion, sin.elementos, sin.partes.map((p) => p.parte), sin.exigido], [0, 0, ['coste', 'plantilla'], 300], 'sin criterio alcanzado, no hay parte de autorización');
  const r0 = await A.transaccion(m0.eje, 'pay', { X: m0.encargo.id }, 'huesped', { t: T1 });
  assert.deepEqual([r0.autorizacion, quemaDe(r0.evento, 'huesped')], [0, 300], 'lo de siempre: el coste de escribir, 5 posiciones, 5 minutos');
  // Un criterio alcanzado: un segundo, pero el mínimo es un minuto. Se suma a lo exigido y se quema en la propuesta.
  const m = await mundo();
  await criterio(m, 'E', 5);
  const e = A.ejecucion(m.eje, 'pay', { X: m.encargo.id }, 'huesped', { t: T1 });
  assert.deepEqual([e.autorizacion, e.elementos, e.partes.map((p) => p.parte), e.partes[2]], [60, 1, ['coste', 'plantilla', 'autorizacion'], { parte: 'autorizacion', segundos: 60, elementos: 1 }]);
  assert.deepEqual([e.coste, e.exigido, e.denominacion, e.paga, e.cubre], [300, 360, [{ escala: 'minuto', cantidad: 6 }], 360, true]);
  const r = await pagar(m);
  assert.equal(r.autorizacion, 60);
  assert.equal(quemaDe(r.evento, 'huesped'), 360, 'la propuesta quema lo exigido (5 min) y la autorización (1 min)');
  assert.deepEqual(r.ejecucion.partes.map((p) => p.parte), ['coste', 'plantilla', 'autorizacion']);
  // El botón de ejecutar (con denominación) quema lo mismo, en las piezas elegidas.
  const m1 = await mundo();
  await criterio(m1, 'E', 5);
  const conDen = await A.transaccion(m1.eje, 'pay', { X: m1.encargo.id }, 'huesped', { t: T1, denominacion: 'minuto' });
  assert.ok(conDen.ok, JSON.stringify(conDen.motivos));
  assert.equal(quemaDe(conDen.evento, 'huesped'), 360);
});

test('coste de autorizar: 65 criterios alcanzados son 65 segundos (más que el minuto); se redondea a la escala del minuto al quemar y la autorización llega pagada', async () => {
  assert.deepEqual([0, 1, 59, 60, 61, 70].map(A.segundosDeAutorizar), [0, 60, 60, 60, 61, 70]);
  const m = await mundo();
  for (let i = 0; i < 65; i++) await criterio(m, ['E:casa/EUR', 'E:otra/U' + i], 1); // cada criterio, distinto (una serie más que no se mueve)
  assert.equal(A.criteriosDeSegundoFactor(m.eje, 'huesped').length, 65);
  const e = A.ejecucion(m.eje, 'pay', { X: m.encargo.id }, 'huesped', { t: T1 });
  assert.deepEqual([e.elementos, e.autorizacion, e.exigido, e.cubre, e.alcanza], [65, 65, 365, true, true], 'un criterio por elemento: 65 s, no 60');
  assert.ok(e.paga >= 365);
  // Quemar en la propuesta, sin denominación pedida: sube al minuto entero (nunca por debajo, #78): 7 minutos.
  const r = await pagar(m);
  assert.deepEqual([r.autorizacion, quemaDe(r.evento, 'huesped')], [65, 420]);
  assert.equal(A.estacionDeAnuncio(m.eje, m.anuncio.id), 'autorizada');
  // La autorización llega pagada: la propuesta ya quemó la tarifa; lo que la cosa titular escribe al firmar es su propio
  // registro (sin excepciones en «writing burns today's T»): 5 posiciones, 5 minutos de la T de la cosa, y ni un segundo más a la huésped.
  const antes = m.eje.saldoT('huesped', 'minuto', T1);
  const buena = await A.autorizar(m.eje, r.evento.id, 'cartera', m.cosa.privada, { t: T1 });
  assert.ok(buena.ok, JSON.stringify(buena.motivos));
  assert.deepEqual([quemaDe(buena.evento, 'cartera'), quemaDe(buena.evento, 'huesped')], [300, 0]);
  await m.eje.anadir(buena.evento);
  assert.equal(m.eje.saldoT('huesped', 'minuto', T1), antes, 'autorizar no cobra nada más a quien propuso');
  assert.equal(A.estacionDeAnuncio(m.eje, m.anuncio.id), 'ejecutada');
});

test('un criterio sobre T se alcanza también con la T de la autorización (la T quemada cuenta): el punto fijo no se queda corto', async () => {
  const m = await mundo();
  await criterio(m, 'T', 3);
  const e = A.ejecucion(m.eje, 'pay', { X: m.encargo.id }, 'huesped', { t: T1 });
  assert.deepEqual([e.elementos, e.autorizacion], [1, 60]);
  const r = await pagar(m);
  assert.equal(r.autorizacion, 60);
  assert.equal(A.estacionDeAnuncio(m.eje, m.anuncio.id), 'autorizada');
});

test('porAutorizar: los registros míos pendientes de segundo factor y los que me toca autorizar como titular (o mi cosa); nada pendiente, nada; autorizado, sale', async () => {
  const m = await mundo();
  await criterio(m, 'E', 5);
  // El criterio se lee sobre lo ya movido: la compra de la huésped (7 EUR) ya lo alcanza, y espera, igual que su estación.
  const compra = A.porAutorizar(m.eje, 'huesped');
  assert.deepEqual([compra.length, compra[0].que], [1, 'Compra del menú del día']);
  const { evento: pago } = await pagar(m);
  const [uno] = A.porAutorizar(m.eje, 'huesped');
  assert.deepEqual([A.porAutorizar(m.eje, 'huesped').length, uno.id, uno.autor, uno.propio, uno.titular, uno.titulares], [2, pago.id, 'huesped', true, true, ['cartera']], 'del más reciente al más antiguo');
  assert.equal(typeof uno.que, 'string');
  assert.match(uno.falta, /falta la autorización de cartera/);
  assert.deepEqual(uno.faltan.map((c) => [c.titular, c.familias, c.cantidad]), [['cartera', ['E'], 5]]);
  // La cosa titular lo ve como suyo por autorizar (no lo escribió); la cocina y quien no tiene nada que ver, nada.
  assert.deepEqual(A.porAutorizar(m.eje, 'cartera').map((x) => [x.id === pago.id, x.propio, x.titular]), [[true, false, true], [false, false, true]]);
  assert.equal(A.porAutorizar(m.eje, 'huesped', { cuantos: 1 }).length, 1);
  assert.deepEqual([A.porAutorizar(m.eje, 'cocina'), A.porAutorizar(m.eje, 'nadie'), A.porAutorizar(m.eje, '')], [[], [], []]);
  // El contrato la expone con el resto de las lecturas.
  assert.equal(contrato.porAutorizar, A.porAutorizar);
  // Una autorización que no vale (la de otro) no lo quita; la buena, sí: pasa a ejecutado.
  await m.eje.anadir((await A.autorizar(m.eje, pago.id, 'cocina', undefined, { t: T1 })).evento);
  assert.equal(A.porAutorizar(m.eje, 'huesped').length, 2);
  await m.eje.anadir((await A.autorizar(m.eje, pago.id, 'cartera', m.cosa.privada, { t: T1 })).evento);
  assert.deepEqual([A.porAutorizar(m.eje, 'huesped').map((x) => x.id), A.porAutorizar(m.eje, 'cartera').map((x) => x.id)], [[compra[0].id], [compra[0].id]], 'solo queda lo de antes');
  assert.equal(A.estacionDeAnuncio(m.eje, m.anuncio.id), 'ejecutada');
});

test('carta: el formulario de ejecutar muestra la parte «autorización» en lo exigido; el 6 de mi alta lista lo por autorizar, una línea por registro', async () => {
  const m = await mundo();
  await criterio(m, 'E', 5);
  const conForm = () => arbolEnIdioma({ foco: { X: m.encargo.id, pv: 4 }, formulario: { X: m.encargo.id, accion: 'pay', valores: {}, ejecutar: true } }, m.eje, 'huesped', ORDENADOR, { idioma: 'es' });
  const f = (await conForm()).formulario;
  assert.deepEqual([f.ejecucion.partes.map((p) => p.parte), f.ejecucion.exigido], [['coste', 'plantilla', 'autorizacion'], 360]);
  const h = html(await conForm());
  assert.match(h, /<li data-parte="autorizacion">autorización: 1 min \(1 que piden segundo factor\), se quema ya, en esta propuesta<\/li>/);
  // Sin nada por autorizar, el 6 de mi alta no pinta la lista.
  const seis = async (yo, X) => html(await arbolEnIdioma({ foco: { X, pv: 6 } }, m.eje, yo, ORDENADOR, { idioma: 'es' }));
  // (la compra de la huésped, ya movida, alcanza el criterio retroactivamente: una línea)
  assert.equal([...(await seis('huesped', m.altaH)).matchAll(/data-por-autorizar=/g)].length, 1);
  const { evento: pago } = await pagar(m);
  const h6 = await seis('huesped', m.altaH);
  assert.match(h6, /<section class="por-autorizar"[^>]*><ul><li class="por-autorizar-linea" data-por-autorizar="[0-9a-f]{64}"><button type="button" class="enlace" data-abrir="[0-9a-f]{64}">por autorizar: [^<]+<\/button> · <small>falta la autorización de cartera[^<]*<\/small><\/li>/);
  assert.equal([...h6.matchAll(/data-por-autorizar=/g)].length, 2, 'una línea por registro');
  // Solo en mi alta: en el alta de otro, no.
  assert.doesNotMatch(await seis('huesped', m.eje.alta('cocina').id), /por-autorizar/);
  // Autorizado, sale: el registro pasa a ejecutado.
  await m.eje.anadir((await A.autorizar(m.eje, pago.id, 'cartera', m.cosa.privada, { t: T1 })).evento);
  assert.equal([...(await seis('huesped', m.altaH)).matchAll(/data-por-autorizar=/g)].length, 1, 'queda la compra de antes');
});
