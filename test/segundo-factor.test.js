// El segundo factor (VG 12/13-11, #66 y #70; SIP 0 de StateArk, objeto «autorización» y regla «second factor»): el
// umbral es un criterio del usuario en el 2.4 de su alta (la plantilla PV2 «second factor»: 0 nombre, 1 familia o serie,
// 2 cantidad, 3 titular, 4 la acción); al ejecutar desde el 4, si lo que mueve alcanza el umbral, el registro se escribe
// pero su estación queda en «autorizada» («pendiente de segundo factor») hasta que la cosa titular escribe y firma una
// autorización anclada sobre él (acciones.autorizar). Las dos lecturas de la época: «second factor» (X.6.8.7) y
// «authorized by the holder» (X.6.8.8). Docs: docs/CONTRATO.md §12.4 bis.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../src/acciones.js';
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
