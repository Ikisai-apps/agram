// El libro compartido en la carta (carta/sincronia.js, lo que carta/app.js hace con él), contra el servidor de prueba
// (servidor/prueba/servidor.mjs en un puerto libre), sin DOM: cada «dispositivo» es un localStorage simulado propio.
// Una cuenta A con servidor, eje compartido y clave de lectura escribe y la cola sube; un dispositivo B, con la misma
// cuenta restaurada de la copia (que lleva la clave de lectura, cifrada), obtiene el eje con sincronizar(null); sin red
// queda pendiente y la línea de estado lo dice, y al volver se sube; un rechazo del servidor aparece en la línea de
// estado; las llamadas van de una en una; y las claves de almacén de la sincronía no se cruzan con las de los
// ejemplos. Nada real: las claves y los ejes se crean en cada prueba.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { arrancar } from '../servidor/prueba/servidor.mjs';
import { acciones, salida, sincronia, persistencia, contrato } from '../src/index.js';
import * as Q from '../carta/cuentas.js';
import * as S from '../carta/sincronia.js';
import { preferencias } from '../carta/carta.js';
import { htmlSincronia, htmlConfiguracion } from '../carta/dom.js';
import { t } from '../carta/textos.js';

const T = (m) => '2026-11-10T10:' + String(m).padStart(2, '0') + ':00Z';
const FRASE = 'una frase larga que solo yo sé';

let servidor;
let reloj = Date.parse('2026-11-10T12:00:00Z'); // el reloj del servidor y el de la cola, controlados
const ahora = () => reloj;
const avanzar = (ms) => { reloj += ms; };

/** Un fetch que falla mientras `red.caida` sea true: «sin red». */
const red = { caida: false };
const fetchConRed = (url, opciones) => (red.caida ? Promise.reject(new TypeError('fetch failed')) : fetch(url, opciones));

before(async () => {
  servidor = await arrancar({ puerto: 0, secreto: 'prueba', ahora: () => new Date(reloj) });
});
after(async () => {
  await servidor.cerrar();
  delete globalThis.localStorage;
});

/** Un dispositivo: su propio localStorage simulado, que pasa a ser el global mientras se usa. */
function dispositivo() {
  const almacen = new Map();
  const ls = { getItem: (k) => almacen.get(k) ?? null, setItem: (k, v) => almacen.set(k, String(v)), removeItem: (k) => almacen.delete(k) };
  return { almacen, usar: () => { globalThis.localStorage = ls; } };
}

/** Crea un eje en un servidor y devuelve su clave de lectura (lo que Core o VG hacen a mano: servidor/LEEME.md). */
async function crearEje(url, nombre) {
  const r = await fetch(url + '/ejes', { method: 'POST', headers: { 'X-Crear-Ejes': 'prueba', 'Content-Type': 'application/json' }, body: JSON.stringify({ eje: nombre }) });
  assert.equal(r.status, 201);
  return (await r.json()).claveLectura;
}

/** Escribe en mi configuración el servidor y el eje compartido (un registro «preferences» de mi alta, firmado). */
async function configurar(c, url, nombre, m = 1) {
  const p = preferencias(c.eje, c.cuenta.identidad, { [sincronia.CONFIGURACION.url]: [url], [sincronia.CONFIGURACION.eje]: [nombre] });
  await salida.escribirDesde(c.eje, { modo: 'sequenced', autor: c.cuenta.identidad, sobre: p.sobre, en: p.en, payload: p.payload, t: T(m) }, c.privada);
}

/** Un registro nuevo anclado en mi alta (firmado), como lo escribe la carta. */
async function escribir(c, titulo, m) {
  const tx = await acciones.transaccion(c.eje, 'anchor here', { X: c.cuenta.alta, title: titulo }, c.cuenta.identidad, { t: T(m), firmar: Q.firmarCon(c.privada) });
  assert.equal(tx.ok, true, JSON.stringify(tx.motivos));
  await c.eje.anadir(tx.evento);
  return tx.evento;
}

const idsDelServidor = (srv, nombre) => srv.almacen.filas(nombre).map((f) => f.id);

// Lo que comparten las pruebas de A y B (en orden: node:test corre las de un archivo una tras otra).
const A = dispositivo();
const B = dispositivo();
let cuentaA;
let claveLectura;
let copia;

test('cuenta A con servidor, eje compartido y clave de lectura: lo escrito sube (el servidor lo recibe), el estado de la sincronía se guarda junto al eje sin la clave y la línea dice «al día»', async () => {
  claveLectura = await crearEje(servidor.url, 'vg');
  A.usar();
  cuentaA = await Q.crearCuenta({ nombre: 'Víctor', idioma: 'es', t: T(0) });
  assert.equal(await Q.guardarCuenta(cuentaA), true);
  const alta = cuentaA.cuenta.alta;
  const yo = cuentaA.cuenta.identidad;
  // Sin configuración ni clave, la cuenta no sincroniza.
  assert.equal(S.abrir({ alta, eje: cuentaA.eje, yo, fetch: fetchConRed, ahora }), null);
  await configurar(cuentaA, servidor.url + '/', 'vg');
  assert.deepEqual(sincronia.destino(cuentaA.eje, yo), { url: servidor.url, eje: 'vg' });
  assert.equal(S.abrir({ alta, eje: cuentaA.eje, yo, fetch: fetchConRed, ahora }), null, 'sin clave de lectura en este navegador, tampoco');
  assert.equal(Q.guardarClaveLectura(alta, '  ' + claveLectura + '  '), true);
  assert.equal(A.almacen.get(Q.CLAVES.lectura(alta)), claveLectura, 'agram.sync.<alta>, sin espacios');
  assert.equal(Q.claveLectura(alta), claveLectura);
  // La clave de lectura nunca entra en el eje (el registro de preferencias lleva el servidor y el eje, no la clave).
  assert.ok(!JSON.stringify(persistencia.serializar(cuentaA.eje)).includes(claveLectura));

  const sinc = S.abrir({ alta, eje: cuentaA.eje, yo, fetch: fetchConRed, ahora });
  assert.ok(sinc, 'con las tres cosas, sincroniza');
  assert.deepEqual([sinc.url, sinc.eje, sinc.desde], [servidor.url, 'vg', 0]);
  let informe = await S.pasar(sinc, cuentaA.eje, alta);
  assert.deepEqual([informe.subidos, informe.pendientes, informe.sinRed, informe.errores], [cuentaA.eje.orden, [], false, []], 'el génesis (mi alta) y la configuración');
  const nuevo = await escribir(cuentaA, 'Mi primer registro', 2);
  informe = await S.pasar(sinc, cuentaA.eje, alta);
  assert.deepEqual(informe.subidos, [nuevo.id]);
  assert.deepEqual(idsDelServidor(servidor, 'vg'), cuentaA.eje.orden, 'el servidor tiene lo mismo, en el mismo orden');
  // El estado de la sincronía, junto al eje y por cuenta: sin la clave de lectura.
  const guardado = A.almacen.get(Q.CLAVES.sincronia(alta));
  assert.ok(guardado && !guardado.includes(claveLectura));
  assert.deepEqual(JSON.parse(guardado), sinc.serializar());
  assert.deepEqual(Q.estadoSincronia(alta), sinc.serializar());
  // Al volver a abrir (recargar la página), la sincronía se restaura de lo guardado: nada pendiente.
  const otra = S.abrir({ alta, eje: cuentaA.eje, yo, fetch: fetchConRed, ahora });
  assert.deepEqual([otra.desde, otra.pendientes(cuentaA.eje)], [sinc.desde, []]);
  const linea = S.lineaDeEstado(sinc, informe);
  assert.deepEqual(linea, { partes: [t('alDia')], titulo: '', rechazados: [], errores: [] });
  assert.match(htmlSincronia(linea), /data-sincronia[^>]*>al día con el eje compartido</);
  assert.equal(htmlSincronia(null), '', 'sin sincronía, nada');
});

test('el dispositivo B restaura la cuenta de la copia (que lleva la clave de lectura, cifrada) y obtiene el eje con sincronizar(null); lo que escribe B lo baja A', async () => {
  A.usar();
  copia = Q.textoDeArchivo(await Q.exportarCuenta({ ...cuentaA, claveLectura: Q.claveLectura(cuentaA.cuenta.alta) }, FRASE, { t: T(3) }));
  assert.ok(!copia.includes(claveLectura), 'la clave de lectura va dentro de lo cifrado');
  // La foto es de antes de lo último que escribió A: B la completa desde el servidor.
  const foto = JSON.parse(copia);
  foto.eje.eventos = foto.eje.eventos.slice(0, 3); // mi alta, el idioma y el servidor
  B.usar();
  const r = await Q.restaurarCuenta(foto, FRASE);
  assert.equal(r.claveLectura, claveLectura, 'restaurar repone la clave de lectura');
  const destino = sincronia.destino(r.eje, r.cuenta.identidad);
  assert.deepEqual(destino, { url: servidor.url, eje: 'vg' }, 'el servidor y el eje compartido van en la configuración, dentro de la foto');
  const d = await S.ejeDelServidor({ cuenta: r.cuenta, url: destino.url, eje: destino.eje, claveLectura: r.claveLectura, foto: r.eje, fetch: fetchConRed, ahora });
  assert.equal(d.motivo, undefined);
  assert.deepEqual(d.eje.orden, cuentaA.eje.orden, 'el eje entero, en el orden del servidor');
  assert.deepEqual(d.informe.anadidos, cuentaA.eje.orden);
  // Sin foto (el eje local perdido) también: el eje nace del génesis del servidor.
  const sinFoto = await S.ejeDelServidor({ cuenta: r.cuenta, url: destino.url, eje: destino.eje, claveLectura: r.claveLectura, fetch: fetchConRed, ahora });
  assert.deepEqual(sinFoto.eje.orden, cuentaA.eje.orden);
  // Lo que hace la carta: guarda la cuenta (con su clave de lectura) y el estado de la sincronía, y la abre.
  r.eje = d.eje;
  assert.equal(await Q.guardarCuenta(r), true);
  Q.guardarEstadoSincronia(r.cuenta.alta, d.sincronia.serializar());
  assert.equal(B.almacen.get(Q.CLAVES.lectura(r.cuenta.alta)), claveLectura);
  const abierta = await Q.abrirCuenta(r.cuenta.alta);
  const sincB = S.abrir({ alta: r.cuenta.alta, eje: abierta.eje, yo: r.cuenta.identidad, fetch: fetchConRed, ahora });
  assert.deepEqual([sincB.desde, sincB.pendientes(abierta.eje)], [d.sincronia.desde, []]);
  // B escribe; sube; A lo baja y lo valida.
  const deB = await escribir({ ...r, eje: abierta.eje }, 'Desde el móvil', 4);
  const subidoB = await S.pasar(sincB, abierta.eje, r.cuenta.alta);
  assert.deepEqual(subidoB.subidos, [deB.id]);
  A.usar();
  const sincA = S.abrir({ alta: cuentaA.cuenta.alta, eje: cuentaA.eje, yo: cuentaA.cuenta.identidad, fetch: fetchConRed, ahora });
  const bajadoA = await S.pasar(sincA, cuentaA.eje, cuentaA.cuenta.alta);
  assert.deepEqual(bajadoA.anadidos, [deB.id]);
  assert.deepEqual((await Q.abrirCuenta(cuentaA.cuenta.alta)).eje.orden, cuentaA.eje.orden, 'pasar guardó el eje que cambió');
  // Una copia sin clave de lectura sigue valiendo (y es como las de antes).
  const sinClave = await Q.exportarCuenta(cuentaA, FRASE, { t: T(5) });
  const restaurada = await Q.restaurarCuenta(sinClave, FRASE);
  assert.deepEqual([restaurada.claveLectura, restaurada.eje.orden], [undefined, cuentaA.eje.orden]);
  // Un eje compartido que no es el de esta cuenta, o vacío, no se toma: el motivo lo dice.
  const ajena = await Q.crearCuenta({ nombre: 'Otra', t: T(0) });
  const ajenoD = await S.ejeDelServidor({ cuenta: ajena.cuenta, url: servidor.url, eje: 'vg', claveLectura, fetch: fetchConRed, ahora });
  assert.deepEqual([ajenoD.eje, ajenoD.motivo], [undefined, t('servidorDeOtraCuenta', { eje: 'vg' })]);
  const vacio = await crearEje(servidor.url, 'vacio');
  const vacioD = await S.ejeDelServidor({ cuenta: cuentaA.cuenta, url: servidor.url, eje: 'vacio', claveLectura: vacio, fetch: fetchConRed, ahora });
  assert.equal(vacioD.motivo, t('servidorVacio'));
  const malaClave = await S.ejeDelServidor({ cuenta: cuentaA.cuenta, url: servidor.url, eje: 'vg', claveLectura: 'otra', fetch: fetchConRed, ahora });
  assert.match(malaClave.motivo, /401/);
});

test('sin red: lo escrito queda pendiente y la línea dice «n por subir» y «sin red: se subirá al volver»; al volver la red, se sube', async () => {
  A.usar();
  const alta = cuentaA.cuenta.alta;
  const sinc = S.abrir({ alta, eje: cuentaA.eje, yo: cuentaA.cuenta.identidad, fetch: fetchConRed, ahora });
  red.caida = true;
  const uno = await escribir(cuentaA, 'Sin red', 6);
  let informe = await S.pasar(sinc, cuentaA.eje, alta);
  assert.deepEqual([informe.sinRed, informe.pendientes], [true, [uno.id]]);
  let linea = S.lineaDeEstado(sinc, informe);
  assert.deepEqual(linea.partes, [t('porSubir', { cuantos: 1 }), t('sinRedSeSubira')]);
  assert.match(htmlSincronia(linea), /1 por subir · sin red: se subirá al volver/);
  // La cola sobrevive a recargar: está en el estado guardado.
  assert.deepEqual(Q.estadoSincronia(alta).cola.map(([id]) => id), [uno.id]);
  assert.ok(!idsDelServidor(servidor, 'vg').includes(uno.id));
  // Vuelve la red (el evento «online»): pasada la espera de la cola, sube.
  red.caida = false;
  avanzar(1000);
  informe = await S.pasar(sinc, cuentaA.eje, alta);
  assert.deepEqual([informe.subidos, informe.pendientes, informe.sinRed], [[uno.id], [], false]);
  assert.ok(idsDelServidor(servidor, 'vg').includes(uno.id), 'el servidor lo recibió');
  linea = S.lineaDeEstado(sinc, informe);
  assert.deepEqual(linea.partes, [t('alDia')]);
});

test('un rechazo del servidor aparece en la línea de estado (el desplegable: id corto, motivo y de dónde viene) y deja de aparecer cuando el servidor lo acepta', async () => {
  // Otro servidor de prueba, con un tope de dos escrituras por minuto: la tercera, un 429.
  const estricto = await arrancar({ puerto: 0, secreto: 'prueba', ahora: () => new Date(reloj), escriturasPorMinuto: 2 });
  try {
    const C = dispositivo();
    C.usar();
    const clave = await crearEje(estricto.url, 'tope');
    const c = await Q.crearCuenta({ nombre: 'Tope', t: T(0) });
    await configurar(c, estricto.url, 'tope');
    await Q.guardarCuenta({ ...c, claveLectura: clave });
    const alta = c.cuenta.alta;
    const sinc = S.abrir({ alta, eje: c.eje, yo: c.cuenta.identidad, fetch: fetchConRed, ahora });
    reloj = Math.ceil(reloj / 60000) * 60000; // al empezar un minuto: el tope cuenta por minuto
    let informe = await S.pasar(sinc, c.eje, alta);
    assert.equal(informe.subidos.length, 2);
    const tercero = await escribir(c, 'El tercero', 2);
    informe = await S.pasar(sinc, c.eje, alta);
    assert.deepEqual(informe.rechazados.map((r) => [r.id, r.de]), [[tercero.id, 'servidor']]);
    assert.match(informe.rechazados[0].motivo, /429/);
    const linea = S.lineaDeEstado(sinc, informe);
    assert.deepEqual([linea.titulo, linea.rechazados], [t('noEntraron', { cuantos: 1 }), [{ id: tercero.id.slice(0, 8), motivo: informe.rechazados[0].motivo, de: 'servidor', deTexto: t('rechazadoServidor') }]]);
    assert.deepEqual(linea.partes, [t('porSubir', { cuantos: 1 })], 'sigue pendiente: espera en la cola');
    const h = htmlSincronia(linea);
    assert.match(h, /<details class="rechazados"><summary>1 registros no entraron<\/summary>/);
    assert.ok(h.includes('<code>' + tercero.id.slice(0, 8) + '</code>') && h.includes('429') && h.includes(t('rechazadoServidor')));
    // Al minuto siguiente el servidor lo acepta: deja de estar en la línea.
    avanzar(60000);
    informe = await S.pasar(sinc, c.eje, alta);
    assert.deepEqual(informe.subidos, [tercero.id]);
    assert.deepEqual(S.lineaDeEstado(sinc, informe), { partes: [t('alDia')], titulo: '', rechazados: [], errores: [] });
    // Un error (otra clave de lectura) va tal cual.
    const mala = new sincronia.Sincronia({ url: estricto.url, eje: 'tope', claveLectura: 'otra', fetch: fetchConRed, ahora });
    const conError = await mala.sincronizar(c.eje);
    const lineaError = S.lineaDeEstado(mala, conError);
    assert.ok(lineaError.errores.length && lineaError.errores.every((e) => /401/.test(e)));
    assert.match(htmlSincronia(lineaError), /<span class="error" role="alert">bajar: servidor 401/);
  } finally {
    await estricto.cerrar();
  }
});

test('las llamadas van de una en una: dos a la vez son una y una repetición, nunca dos en paralelo; con la sincronía de verdad, igual', async () => {
  let enMarcha = 0;
  let maximo = 0;
  let vueltas = 0;
  let soltar;
  const llamar = S.enSerie(async () => {
    vueltas += 1;
    enMarcha += 1;
    maximo = Math.max(maximo, enMarcha);
    await new Promise((r) => { soltar = r; });
    enMarcha -= 1;
  });
  const p1 = llamar();
  const p2 = llamar();
  const p3 = llamar();
  assert.equal(vueltas, 1, 'la segunda y la tercera esperan');
  assert.equal(p2, p1, 'las que llegan en marcha se juntan en la misma promesa');
  soltar();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(vueltas, 2, 'una sola repetición por las dos que llegaron');
  soltar();
  await Promise.all([p1, p2, p3]);
  assert.deepEqual([vueltas, maximo], [2, 1]);
  // Una vuelta que lanza no corta la serie.
  const fallos = [];
  let n = 0;
  const conFallo = S.enSerie(async () => { n += 1; if (n === 1) throw new Error('uno'); }, { alFallar: (e) => fallos.push(e.message) });
  conFallo();
  await conFallo();
  await conFallo();
  assert.deepEqual([n, fallos], [3, ['uno']]);
  // Con la sincronía de verdad (la cuenta A): S.sincronizar nunca corre dos veces a la vez.
  A.usar();
  const sinc = S.abrir({ alta: cuentaA.cuenta.alta, eje: cuentaA.eje, yo: cuentaA.cuenta.identidad, fetch: fetchConRed, ahora });
  const original = sinc.sincronizar.bind(sinc);
  let aLaVez = 0;
  let pico = 0;
  let llamadas = 0;
  sinc.sincronizar = async (...args) => {
    llamadas += 1;
    aLaVez += 1;
    pico = Math.max(pico, aLaVez);
    try { return await original(...args); } finally { aLaVez -= 1; }
  };
  const sincronizar = S.enSerie(() => S.pasar(sinc, cuentaA.eje, cuentaA.cuenta.alta));
  await escribir(cuentaA, 'Dos escrituras seguidas', 7);
  const a = sincronizar();
  await escribir(cuentaA, 'La segunda', 8);
  const b = sincronizar();
  await Promise.all([a, b]);
  assert.deepEqual([llamadas, pico], [2, 1]);
  assert.deepEqual(idsDelServidor(servidor, 'vg'), cuentaA.eje.orden, 'las dos escrituras subieron');
});

test('las claves de la sincronía son por cuenta y no se cruzan con las de los ejemplos; olvidar la cuenta las borra; los ejemplos no sincronizan; otro destino empieza de cero; el formulario pinta la clave de lectura aparte', async () => {
  const D = dispositivo();
  D.usar();
  const c = await Q.crearCuenta({ nombre: 'Huesped', t: T(0) });
  const alta = c.cuenta.alta;
  assert.deepEqual([Q.CLAVES.lectura(alta), Q.CLAVES.sincronia(alta)], ['agram.sync.' + alta, 'agram.sync.estado.' + alta]);
  const deCuenta = Q.clavesDe(c.cuenta, ['huesped', 'casa']);
  assert.ok(deCuenta.includes(Q.CLAVES.lectura(alta)) && deCuenta.includes(Q.CLAVES.sincronia(alta)));
  const deEjemplo = [...Object.values(Q.CLAVES_EJEMPLO).filter((v) => typeof v === 'string'), ...['huesped', 'casa', 'sync', 'sync.' + alta].map(Q.CLAVES_EJEMPLO.local)];
  assert.ok(deCuenta.every((k) => !deEjemplo.includes(k)), JSON.stringify({ deCuenta, deEjemplo }));
  assert.equal(new Set(deCuenta).size, deCuenta.length, 'ninguna clave de la cuenta pisa a otra');
  // Los ejemplos no sincronizan: no tienen cuenta (ni alta en la lista, ni clave de lectura).
  assert.equal(S.abrir({ alta: undefined, eje: c.eje, yo: c.cuenta.identidad }), null);
  // Con clave pero con un servidor que no es una url (o sin eje compartido), tampoco.
  await Q.guardarCuenta({ ...c, claveLectura: 'una-clave' });
  await configurar(c, 'preferences', 'vg');
  assert.equal(sincronia.destino(c.eje, c.cuenta.identidad), null);
  assert.equal(S.abrir({ alta, eje: c.eje, yo: c.cuenta.identidad }), null);
  // Lo guardado de otro destino no se restaura: se empieza de cero.
  await configurar(c, 'http://127.0.0.1:9/', 'otro', 2);
  Q.guardarEstadoSincronia(alta, { version: sincronia.VERSION_SINCRONIA, url: 'http://127.0.0.1:9', eje: 'vg', desde: 7, ordenes: [], recibidos: [], cola: [], rechazados: [] });
  assert.equal(S.abrir({ alta, eje: c.eje, yo: c.cuenta.identidad }).desde, 0);
  Q.guardarEstadoSincronia(alta, { version: sincronia.VERSION_SINCRONIA, url: 'http://127.0.0.1:9', eje: 'otro', desde: 7, ordenes: [], recibidos: [], cola: [], rechazados: [] });
  assert.equal(S.abrir({ alta, eje: c.eje, yo: c.cuenta.identidad }).desde, 7);
  // Olvidar la cuenta borra su clave de lectura y el estado de su sincronía.
  Q.olvidarCuenta(alta, ['huesped']);
  assert.ok([...D.almacen.keys()].every((k) => !k.includes(alta)), JSON.stringify([...D.almacen.keys()]));
  assert.equal(Q.claveLectura(alta), null);
  // La configuración pinta el servidor y el eje compartido (de la época) y, en una cuenta, la clave de lectura aparte, sin `name`.
  const p = preferencias(c.eje, c.cuenta.identidad);
  const conClave = htmlConfiguracion(p, { claveLectura: 'secreta', parte: '9' }); // la clave de lectura va en «guía y exterior» (#92)
  assert.ok(p.campos.some((x) => x.clave === sincronia.CONFIGURACION.url) && p.campos.some((x) => x.clave === sincronia.CONFIGURACION.eje));
  assert.match(conClave, /<input id="pref-clave-lectura" data-clave-lectura type="password" value="secreta"/);
  assert.ok(!/name="[^"]*"[^>]*data-clave-lectura|data-clave-lectura[^>]*name=/.test(conClave), 'no entra en el registro de preferencias');
  assert.ok(!htmlConfiguracion(p, {}).includes('data-clave-lectura'), 'en un ejemplo no hay clave de lectura');
  void contrato;
});

test('una foto con algo que el servidor aún no tiene: el eje nace del servidor y lo de la foto va detrás, pendiente de subir', async () => {
  A.usar();
  const soloEnLaFoto = await escribir(cuentaA, 'Escrito sin sincronizar', 9);
  const archivo = await Q.exportarCuenta({ ...cuentaA, claveLectura: Q.claveLectura(cuentaA.cuenta.alta) }, FRASE, { t: T(9) });
  const E = dispositivo();
  E.usar();
  const r = await Q.restaurarCuenta(archivo, FRASE);
  const destino = sincronia.destino(r.eje, r.cuenta.identidad);
  const d = await S.ejeDelServidor({ cuenta: r.cuenta, url: destino.url, eje: destino.eje, claveLectura: r.claveLectura, foto: r.eje, fetch: fetchConRed, ahora });
  assert.deepEqual(d.eje.orden, cuentaA.eje.orden);
  assert.deepEqual(d.sincronia.pendientes(d.eje), [soloEnLaFoto.id]);
  const informe = await d.sincronia.sincronizar(d.eje);
  assert.deepEqual(informe.subidos, [soloEnLaFoto.id]);
  assert.ok(idsDelServidor(servidor, 'vg').includes(soloEnLaFoto.id));
});
