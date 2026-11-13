// Etapa 3 del roadmap: el libro compartido (src/sincronia.js) contra el servidor de prueba (servidor/prueba/servidor.mjs),
// que sirve el mismo contrato que la función de Supabase. Dos ejes locales A y B de la misma cuenta (la misma clave) y
// una cuenta sin alta en el eje.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { arrancar } from '../servidor/prueba/servidor.mjs';
import { Sincronia, SinRed, ErrorDelServidor, espera, VERSION_SINCRONIA } from '../src/sincronia.js';
import { Eje } from '../src/eje.js';
import { crearEvento, hash } from '../src/evento.js';
import { generarClaves, firmar } from '../src/autoridad.js';
import { serializar, restaurar } from '../src/persistencia.js';
import { evaluar } from '../src/bqlm.js';
import { ContextoEje } from '../src/contexto-eje.js';
import * as agram from '../src/index.js';
import { entrarPorInvitacion } from '../ejemplos/ikisai/altas.mjs';
import { pagaElCoste } from './ayudas-coste.js';

const T = (m) => '2026-11-10T10:' + String(m).padStart(2, '0') + ':00Z';
const minuto = (de) => pagaElCoste(de);

let servidor;
let reloj = Date.parse('2026-11-10T12:00:00Z'); // el reloj del servidor y el del cliente, controlados
const ahora = () => reloj;
const avanzar = (ms) => { reloj += ms; };

before(async () => {
  servidor = await arrancar({ puerto: 0, secreto: 'prueba', ahora: () => new Date(reloj) });
});
after(async () => servidor.cerrar());

/** Crea un eje en el servidor y devuelve su clave de lectura. */
async function crearEje(nombre) {
  const r = await fetch(servidor.url + '/ejes', { method: 'POST', headers: { 'X-Crear-Ejes': 'prueba', 'Content-Type': 'application/json' }, body: JSON.stringify({ eje: nombre }) });
  assert.equal(r.status, 201);
  const datos = await r.json();
  assert.match(datos.claveLectura, /^[A-Za-z0-9_-]{43}$/);
  return datos.claveLectura;
}

/** Un fetch que falla mientras `red.caida` sea true: «sin red». */
const red = { caida: false };
const fetchConRed = (url, opciones) => (red.caida ? Promise.reject(new TypeError('fetch failed')) : fetch(url, opciones));

const subir = (clave, nombre, evento) => fetch(servidor.url + '/eventos', { method: 'POST', headers: { 'X-Clave-Lectura': clave, 'Content-Type': 'application/json' }, body: JSON.stringify({ eje: nombre, evento }) });

test('la sincronía está en el índice del núcleo y la espera crece hasta cinco minutos', () => {
  assert.equal(agram.sincronia.Sincronia, Sincronia);
  assert.equal(agram.sincronia.VERSION_SINCRONIA, VERSION_SINCRONIA);
  assert.deepEqual([1, 2, 3, 4, 20].map(espera), [1000, 2000, 4000, 8000, 300000]);
});

test('A sube el génesis, B lo baja; tres eventos de A, uno sin red que queda en cola y sube al volver; B los baja y los valida; el servidor rechaza una firma inválida y un extraño; lo que no pasa las reglas va a rechazados; sin clave 401; duplicado idempotente; orden de llegada estable; el reloj del servidor llega al contexto', async () => {
  const claveLectura = await crearEje('vg');
  const cuenta = await generarClaves();
  const ejeA = await Eje.genesis({ identidad: 'vg', foco: ['mi eje'], t: T(0), clave: cuenta.publica, privada: cuenta.privada, exigirFirmas: true });
  const A = new Sincronia({ url: servidor.url + '/', eje: 'vg', claveLectura, fetch: fetchConRed, ahora });
  const B = new Sincronia({ url: servidor.url, eje: 'vg', claveLectura, fetch: fetchConRed, ahora });

  // A crea el génesis y lo sube.
  let informe = await A.sincronizar(ejeA);
  assert.deepEqual([informe.subidos, informe.pendientes, informe.sinRed, informe.bajados], [[ejeA.genesisId], [], false, 0]);
  assert.equal(A.orden(ejeA.genesisId), 1);
  assert.equal(A.recibido(ejeA.genesisId), new Date(reloj).toISOString(), 'el reloj del servidor');

  // B no tiene eje: nace del génesis que baja.
  informe = await B.sincronizar(null);
  const ejeB = informe.eje;
  assert.ok(ejeB instanceof Eje);
  assert.deepEqual(ejeB.orden, ejeA.orden);
  assert.equal(ejeB.exigirFirmas, true);
  assert.deepEqual(informe.anadidos, [ejeA.genesisId]);

  // A escribe tres eventos: el primero con red, el segundo sin red (queda en cola), el tercero con red (espera detrás).
  const e1 = await ejeA.escribir({ autor: 'vg', sobre: ejeA.genesisId, t: T(1), movimientos: [minuto('vg')], payload: ['uno'] }, cuenta.privada);
  informe = await A.sincronizar(ejeA);
  assert.deepEqual(informe.subidos, [e1.id]);
  const e2 = await ejeA.escribir({ autor: 'vg', sobre: e1.id, t: T(2), movimientos: [minuto('vg')], payload: ['dos'] }, cuenta.privada);
  red.caida = true;
  informe = await A.sincronizar(ejeA);
  assert.equal(informe.sinRed, true);
  assert.deepEqual(informe.pendientes, [e2.id]);
  assert.deepEqual(A.cola.map((c) => [c.id, c.intentos, c.proximo - reloj, c.error]), [[e2.id, 1, 1000, null]]);
  red.caida = false;
  const e3 = await ejeA.escribir({ autor: 'vg', sobre: e2.id, t: T(3), movimientos: [minuto('vg')], payload: ['tres'] }, cuenta.privada);
  // Vuelve la red, pero aún no toca reintentar: nada sube (y e3 espera detrás de e2).
  informe = await A.sincronizar(ejeA);
  assert.deepEqual([informe.subidos, informe.pendientes, informe.sinRed], [[], [e2.id, e3.id], false]);
  avanzar(1000);
  informe = await A.sincronizar(ejeA);
  assert.deepEqual([informe.subidos, informe.pendientes, A.cola], [[e2.id, e3.id], [], []]);

  // B baja los tres y los valida con las reglas.
  informe = await B.sincronizar(ejeB);
  assert.deepEqual(informe.anadidos, [e1.id, e2.id, e3.id]);
  assert.deepEqual(informe.rechazados, []);
  assert.deepEqual(ejeB.orden, ejeA.orden);
  assert.equal(ejeB.obtener(e2.id).payload[0], 'dos');

  // Una firma inválida la rechaza el servidor (400); un cuerpo tocado con el mismo id, también.
  const firmaMala = { ...e3, firma: e3.firma.slice(0, -2) + (e3.firma.endsWith('aa') ? 'bb' : 'aa'), id: await hash('otro') };
  let r = await subir(claveLectura, 'vg', firmaMala);
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /id no corresponde/);
  const cuerpoTocado = { ...e3, payload: ['tres tocado'], id: await hash(agram.canonico(agram.cuerpo({ ...e3, payload: ['tres tocado'] }))) };
  r = await subir(claveLectura, 'vg', cuerpoTocado);
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /firma inválida de vg/);
  // Un extraño (una cuenta sin alta en este eje) firma bien, pero el servidor no le conoce: 403.
  const otra = await generarClaves();
  const extrano = await firmar(await crearEvento({ autor: 'otro', sobre: ejeA.genesisId, t: T(4), movimientos: [minuto('otro')], payload: ['hola'] }), otra.privada);
  r = await subir(claveLectura, 'vg', extrano);
  assert.equal(r.status, 403);
  assert.match((await r.json()).error, /no tiene alta/);
  assert.equal((await A.subir(extrano).catch((e) => e)).estado, 403, 'el cliente lanza ErrorDelServidor con el estado');

  // Válido para el servidor (bien formado, firmado por vg) pero fuera de las reglas (anclado a un registro que no existe):
  // el servidor lo guarda, y en B va a rechazados sin romper la sincronización.
  const fantasma = await firmar(await crearEvento({ autor: 'vg', sobre: await hash('no existe'), t: T(5), movimientos: [minuto('vg')], payload: ['sobre nada'] }), cuenta.privada);
  r = await subir(claveLectura, 'vg', fantasma);
  assert.equal(r.status, 201);
  const e4 = await ejeA.escribir({ autor: 'vg', sobre: e3.id, t: T(6), movimientos: [minuto('vg')], payload: ['cuatro'] }, cuenta.privada);
  // En A: el fantasma llega antes que e4 (pendiente), así que A se reordena, lo rechaza y sube e4 detrás.
  const deA = await A.sincronizar(ejeA);
  assert.deepEqual([deA.reordenado, deA.rechazados.map((x) => [x.id, x.de]), deA.subidos], [true, [[fantasma.id, 'reglas']], [e4.id]]);
  informe = await B.sincronizar(ejeB);
  assert.deepEqual(informe.rechazados.map((x) => [x.id, x.de]), [[fantasma.id, 'reglas']]);
  assert.match(informe.rechazados[0].motivo, /evento rechazado: every record hangs on a record of the ledger/);
  assert.deepEqual([informe.anadidos, informe.reordenado], [[e4.id], false]);
  assert.equal(ejeB.eventos.has(fantasma.id), false);
  assert.deepEqual(B.rechazados.map((x) => x.id), [fantasma.id]);
  // No se vuelve a intentar: la siguiente sincronización está limpia.
  informe = await A.sincronizar(ejeA);
  assert.deepEqual([informe.rechazados, informe.anadidos, informe.bajados], [[], [], 0]);
  assert.deepEqual(ejeA.orden, ejeB.orden);

  // Leer sin clave, o con otra: 401. El cliente no lanza: lo anota en errores.
  r = await fetch(servidor.url + '/eventos?eje=vg');
  assert.equal(r.status, 401);
  r = await fetch(servidor.url + '/eventos?eje=vg', { headers: { 'X-Clave-Lectura': 'otra' } });
  assert.equal(r.status, 401);
  const sinClave = new Sincronia({ url: servidor.url, eje: 'vg', fetch: fetchConRed, ahora });
  informe = await sinClave.sincronizar(null);
  assert.deepEqual([informe.eje, informe.errores], [null, ['bajar: servidor 401: clave de lectura ausente o incorrecta']]);
  await assert.rejects(sinClave.bajar(0), ErrorDelServidor);

  // Duplicado: idempotente, el mismo orden.
  const dup = await A.subir(e1);
  assert.deepEqual(dup, { orden: 2, recibido: A.recibido(e1.id), duplicado: true });
  r = await subir(claveLectura, 'vg', e1);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).orden, 2);

  // Orden de llegada estable: el del servidor es el de las subidas, y los dos ejes lo siguen (sin el fantasma).
  const todo = await B.bajar(0);
  assert.deepEqual(todo.eventos.map((x) => x.orden), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(todo.eventos.map((x) => x.evento.id), [ejeA.genesisId, e1.id, e2.id, e3.id, fantasma.id, e4.id]);
  assert.equal(todo.siguiente, null);
  assert.deepEqual(ejeB.orden, [ejeA.genesisId, e1.id, e2.id, e3.id, e4.id]);
  // Paginado: de dos en dos.
  const pagina = await B.bajar(0, 2);
  assert.deepEqual([pagina.eventos.map((x) => x.orden), pagina.siguiente], [[1, 2], 2]);
  const paginas = [];
  for await (const p of B.paginas(0, 4)) paginas.push(p.eventos.map((x) => x.orden));
  assert.deepEqual(paginas, [[1, 2, 3, 4], [5, 6]]);

  // El reloj del servidor llega al contexto como el reloj de los demás (before.6.3), no como el mayor t del libro (6.0).
  const mayorRecibido = Math.max(...todo.eventos.map((x) => Date.parse(x.recibido)));
  assert.equal(ejeB.relojExterno, mayorRecibido);
  assert.equal(ejeB.tMaximo(['vg']), mayorRecibido, 'sin nadie más en el eje, el reloj de los demás es el del servidor');
  assert.equal(ejeB.tMaximo(), Date.parse(T(6)), 'el mayor t del libro sigue siendo el de los eventos');
  const ctx = new ContextoEje(ejeB, { ev: { autor: 'vg', sobre: e4.id, t: T(7), movimientos: [minuto('vg')], payload: ['mirar'] } });
  const leer = (src) => evaluar(src, ctx);
  assert.equal(leer('before.6.3').valor[0], new Date(mayorRecibido).toISOString());
  assert.equal(leer('before.6.0').valor[0], new Date(Date.parse(T(6))).toISOString());
  assert.equal(ejeA.relojExterno, ejeB.relojExterno, 'A también lo marca al subir y al bajar');
});

test('el orden local difiere del servidor: B escribe sin red mientras A sube; al sincronizar, B se reordena por el orden del servidor y lo suyo va detrás; A lo recibe', async () => {
  const claveLectura = await crearEje('dos');
  const cuenta = await generarClaves();
  const ejeA = await Eje.genesis({ identidad: 'vg', foco: ['compartido'], t: T(0), clave: cuenta.publica, privada: cuenta.privada, exigirFirmas: true });
  const A = new Sincronia({ url: servidor.url, eje: 'dos', claveLectura, ahora });
  const B = new Sincronia({ url: servidor.url, eje: 'dos', claveLectura, ahora });
  await A.sincronizar(ejeA);
  const ejeB = (await B.sincronizar(null)).eje;
  // B escribe en local (no sincroniza aún); A escribe y sube.
  const b1 = await ejeB.escribir({ autor: 'vg', sobre: ejeB.genesisId, t: T(1), movimientos: [minuto('vg')], payload: ['de B'] }, cuenta.privada);
  const a1 = await ejeA.escribir({ autor: 'vg', sobre: ejeA.genesisId, t: T(1), movimientos: [minuto('vg')], payload: ['de A'] }, cuenta.privada);
  await A.sincronizar(ejeA);
  assert.deepEqual(ejeB.orden, [ejeB.genesisId, b1.id]);
  // B sincroniza: baja a1, que va antes que b1 en el servidor; se reordena y luego sube b1.
  const informe = await B.sincronizar(ejeB);
  assert.deepEqual([informe.reordenado, informe.anadidos, informe.subidos, informe.rechazados], [true, [a1.id], [b1.id], []]);
  assert.deepEqual(ejeB.orden, [ejeB.genesisId, a1.id, b1.id]);
  assert.deepEqual(ejeB.hijos.get(ejeB.genesisId).map((e) => e.payload[0]), ['de A', 'de B'], 'los índices se reconstruyen en el orden nuevo');
  assert.equal(ejeB.saldo('vg', 'T:minuto'), 0);
  // A baja b1 por detrás, sin reordenar.
  const deA = await A.sincronizar(ejeA);
  assert.deepEqual([deA.reordenado, deA.anadidos], [false, [b1.id]]);
  assert.deepEqual(ejeA.orden, ejeB.orden);
  const todo = await A.bajar(0);
  assert.deepEqual(todo.eventos.map((x) => x.evento.id), ejeA.orden);
});

test('la cola y lo bajado se guardan y se restauran igual que el eje: tras recargar, lo pendiente sube y lo rechazado no se repite', async () => {
  const claveLectura = await crearEje('persistente');
  const cuenta = await generarClaves();
  const eje = await Eje.genesis({ identidad: 'vg', foco: ['guardado'], t: T(0), clave: cuenta.publica, privada: cuenta.privada, exigirFirmas: true });
  const S = new Sincronia({ url: servidor.url, eje: 'persistente', claveLectura, fetch: fetchConRed, ahora });
  await S.sincronizar(eje);
  const e1 = await eje.escribir({ autor: 'vg', sobre: eje.genesisId, t: T(1), movimientos: [minuto('vg')], payload: ['pendiente'] }, cuenta.privada);
  red.caida = true;
  await S.sincronizar(eje);
  red.caida = false;
  // Se guarda todo (el eje con persistencia.serializar; la sincronía con la suya, sin la clave de lectura).
  const guardado = JSON.parse(JSON.stringify({ eje: serializar(eje), sincronia: S.serializar() }));
  assert.equal(guardado.sincronia.version, VERSION_SINCRONIA);
  assert.equal(JSON.stringify(guardado.sincronia).includes(claveLectura), false, 'la clave de lectura no se guarda con la sincronía');
  assert.deepEqual(guardado.sincronia.cola.map(([id, c]) => [id, c.intentos]), [[e1.id, 1]]);
  // Otra sesión: restaura los dos; la clave de lectura llega aparte.
  const eje2 = await restaurar(guardado.eje);
  const S2 = Sincronia.restaurar(guardado.sincronia, { claveLectura, fetch: fetchConRed, ahora });
  assert.deepEqual([S2.url, S2.eje, S2.desde, S2.orden(eje.genesisId)], [servidor.url, 'persistente', S.desde, S.orden(eje.genesisId)]);
  assert.deepEqual(S2.pendientes(eje2), [e1.id]);
  assert.equal(S2.marcarReloj(eje2), Date.parse(S.recibido(eje.genesisId)), 'el reloj de los demás vuelve al eje restaurado');
  let informe = await S2.sincronizar(eje2);
  assert.deepEqual(informe.subidos, [], 'aún en espera');
  avanzar(2000);
  informe = await S2.sincronizar(eje2);
  assert.deepEqual([informe.subidos, S2.cola], [[e1.id], []]);
  assert.throws(() => Sincronia.restaurar({ version: 99 }), /inválidos/);
  assert.throws(() => new Sincronia({ eje: 'x' }), /url/);
});

test('una escritura que el servidor rechaza queda en rechazados y en cola con su error, lo de detrás espera; un eje local con otro génesis no se mezcla', async () => {
  const claveLectura = await crearEje('rechazo');
  const cuenta = await generarClaves();
  // Un eje de demostración con clave en el génesis: el servidor admite lo que vg firma, pero ana entra sin clave (vale
  // en demostración) y el servidor no la conoce.
  const eje = await Eje.genesis({ identidad: 'vg', foco: ['x'], t: T(0), clave: cuenta.publica, privada: cuenta.privada, demostracion: true });
  const S = new Sincronia({ url: servidor.url, eje: 'rechazo', claveLectura, ahora });
  await S.sincronizar(eje);
  const { invitacion, alta } = await entrarPorInvitacion(eje, { por: 'vg', quien: 'ana', t: T(1), privadaDe: () => cuenta.privada });
  const a2 = await eje.escribir({ autor: 'vg', sobre: eje.genesisId, t: T(2), movimientos: [minuto('vg')], payload: ['después'] }, cuenta.privada);
  const informe = await S.sincronizar(eje);
  assert.deepEqual([informe.subidos, informe.pendientes], [[invitacion.id], [alta.id, a2.id]]);
  assert.deepEqual(informe.rechazados.map((x) => [x.id, x.de]), [[alta.id, 'servidor']]);
  assert.match(informe.rechazados[0].motivo, /servidor 400: evento mal formado: firma obligatoria/);
  assert.deepEqual(S.cola.map((c) => [c.id, c.intentos, c.proximo - reloj]), [[alta.id, 1, 1000]]);
  assert.match(S.cola[0].error, /400/);
  // Otro eje local, con otro génesis, apuntando al mismo eje del servidor: error claro y nada se sube ni se mezcla.
  const otro = await Eje.genesis({ identidad: 'vg', foco: ['otro'], t: T(0), clave: cuenta.publica, privada: cuenta.privada, exigirFirmas: true });
  const O = new Sincronia({ url: servidor.url, eje: 'rechazo', claveLectura, ahora });
  const r = await O.sincronizar(otro);
  assert.deepEqual([r.subidos, r.anadidos, r.rechazados, otro.orden.length], [[], [], [], 1]);
  assert.match(r.errores[0], /no es este: su génesis es/);
});

test('eje.reordenar: vuelve a validar en el orden nuevo, lo que no pasa se devuelve sin lanzar, lo no listado va detrás y el eje sigue siendo el mismo objeto', async () => {
  const cuenta = await generarClaves();
  const eje = await Eje.genesis({ identidad: 'vg', foco: ['r'], t: T(0), clave: cuenta.publica, privada: cuenta.privada, exigirFirmas: true });
  const a = await eje.escribir({ autor: 'vg', sobre: eje.genesisId, t: T(1), movimientos: [minuto('vg')], payload: ['a'] }, cuenta.privada);
  const b = await eje.escribir({ autor: 'vg', sobre: a.id, t: T(2), movimientos: [minuto('vg')], payload: ['b'] }, cuenta.privada);
  const c = await eje.escribir({ autor: 'vg', sobre: eje.genesisId, t: T(3), movimientos: [minuto('vg')], payload: ['c'] }, cuenta.privada);
  eje.marcarReloj('2026-11-10T20:00:00Z');
  // c antes que a; b (no listado) va detrás.
  let r = await eje.reordenar([eje.genesisId, c.id, a]);
  assert.deepEqual(r, { anadidos: [], rechazados: [] });
  assert.deepEqual(eje.orden, [eje.genesisId, c.id, a.id, b.id]);
  assert.deepEqual(eje.hijos.get(eje.genesisId).map((e) => e.id), [c.id, a.id]);
  assert.equal(eje.relojExterno, Date.parse('2026-11-10T20:00:00Z'), 'el reloj externo se conserva');
  assert.equal(eje.saldo('vg', 'T:minuto'), 0);
  // b antes que a: b ancla sobre a, que aún no está → rechazado, y el eje sigue entero sin él.
  r = await eje.reordenar([eje.genesisId, b.id, a.id, c.id]);
  assert.deepEqual(r.rechazados.map((x) => x.id), [b.id]);
  assert.match(r.rechazados[0].motivo, /evento rechazado/);
  assert.deepEqual(eje.orden, [eje.genesisId, a.id, c.id]);
  // Un evento nuevo en la lista entra (anadidos); el génesis ha de ir primero; un id desconocido lanza.
  const d = await firmar(await crearEvento({ autor: 'vg', sobre: c.id, t: T(4), movimientos: [minuto('vg')], payload: ['d'] }), cuenta.privada);
  r = await eje.reordenar([eje.genesisId, a.id, c.id, d]);
  assert.deepEqual(r, { anadidos: [d.id], rechazados: [] });
  assert.equal(eje.obtener(d.id).payload[0], 'd');
  await assert.rejects(eje.reordenar([a.id, eje.genesisId]), /el génesis va primero/);
  await assert.rejects(eje.reordenar([eje.genesisId, 'f'.repeat(64)]), /ids que el eje no tiene/);
  // Un instante que no se lee no mueve el reloj externo; uno menor tampoco.
  assert.equal(eje.marcarReloj('ayer'), Date.parse('2026-11-10T20:00:00Z'));
  assert.equal(eje.marcarReloj('2026-11-10T19:00:00Z'), Date.parse('2026-11-10T20:00:00Z'));
});

test('sin red desde el principio: nada falla, todo queda en cola, y SinRed es distinguible', async () => {
  const cuenta = await generarClaves();
  const eje = await Eje.genesis({ identidad: 'vg', foco: ['aislado'], t: T(0), clave: cuenta.publica, privada: cuenta.privada, exigirFirmas: true });
  const S = new Sincronia({ url: 'http://127.0.0.1:1', eje: 'nadie', claveLectura: 'x', fetch: () => Promise.reject(new TypeError('fetch failed')), ahora });
  const informe = await S.sincronizar(eje);
  assert.deepEqual([informe.sinRed, informe.pendientes, informe.subidos, informe.errores], [true, [eje.genesisId], [], []]);
  await assert.rejects(S.subir(eje.obtener(eje.genesisId)), SinRed);
  await assert.rejects(S.bajar(), SinRed);
});

test('el recibo de llegada (X.6.8.1): el servidor de prueba sirve /eventos/recibo y la sincronía lo pone en el eje, al subir y al bajar, sin tocar el evento; sin clave, 401; id desconocido, 404', async () => {
  const claveLectura = await crearEje('recibo');
  const cuenta = await generarClaves();
  const ejeA = await Eje.genesis({ identidad: 'vg', foco: ['mi eje'], t: T(0), clave: cuenta.publica, privada: cuenta.privada, exigirFirmas: true });
  const A = new Sincronia({ url: servidor.url, eje: 'recibo', claveLectura, ahora });
  const B = new Sincronia({ url: servidor.url, eje: 'recibo', claveLectura, ahora });
  const e1 = await ejeA.escribir({ autor: 'vg', sobre: ejeA.genesisId, t: T(1), movimientos: [minuto('vg')], payload: ['uno'] }, cuenta.privada);
  const firma = e1.firma;

  let informe = await A.sincronizar(ejeA);
  assert.deepEqual(informe.recibos.recibidos, [ejeA.genesisId, e1.id]);
  const r = ejeA.recibo(e1.id);
  assert.equal(r.instante, A.recibido(e1.id), 'el instante del recibo es el `recibido` del servidor');
  assert.match(r.rele, /^[0-9a-f]{64}$/);
  // Detrás del instante y del relé, el recibo copiado (una décupla: encargo «verificado-regla»), que no tiene valor.
  assert.deepEqual(evaluar('=((first it.6).8.1 where count it2.0 = 0 or not ("recibo de llegada" in it2.0))', new ContextoEje(ejeA), { sujeto: e1.id }).valor, [r.instante, r.rele]);
  assert.equal(ejeA.obtener(e1.id).firma, firma, 'la firma, intacta');

  // B baja el eje: sus recibos llegan igual.
  informe = await B.sincronizar(null);
  assert.deepEqual(informe.recibos.recibidos.sort(), [ejeA.genesisId, e1.id].sort());
  assert.deepEqual(informe.eje.recibo(e1.id), r);

  // La ruta: la misma autorización que GET /eventos.
  const pedir = (id, cab) => fetch(servidor.url + '/eventos/recibo?eje=recibo&id=' + id, { headers: cab });
  assert.equal((await pedir(e1.id, {})).status, 401);
  assert.equal((await pedir(e1.id, { 'X-Clave-Lectura': 'x' })).status, 401);
  assert.equal((await pedir('e'.repeat(64), { 'X-Clave-Lectura': claveLectura })).status, 404);
  assert.equal((await fetch(servidor.url + '/eventos/recibo?eje=nadie&id=' + e1.id, { headers: { 'X-Clave-Lectura': claveLectura } })).status, 401, 'eje inexistente: como la clave mala (#106)');
  assert.equal((await fetch(servidor.url + '/eventos/recibo?eje=recibo&id=' + e1.id, { method: 'POST', headers: { 'X-Clave-Lectura': claveLectura } })).status, 405);
});
