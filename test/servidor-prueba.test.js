// El contrato HTTP del libro compartido, servido por servidor/prueba/servidor.mjs (el mismo api.js que la función de
// Supabase): crear ejes, subir y bajar eventos, los errores, los límites, CORS y el archivo.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { arrancar } from '../servidor/prueba/servidor.mjs';
import { LIMITE_CUERPO, PAGINA, generarClaveLectura, hashDeClave } from '../servidor/supabase/funciones/eventos/api.js';
import { Eje } from '../src/eje.js';
import { generarClaves } from '../src/autoridad.js';
import { pagaElCoste } from './ayudas-coste.js';

const T = (m) => '2026-11-10T09:' + String(m).padStart(2, '0') + ':00Z';
const minuto = (de) => pagaElCoste(de);

let servidor;
const reloj = Date.parse('2026-11-10T12:00:00Z');
before(async () => {
  servidor = await arrancar({ puerto: 0, secreto: 'prueba', ahora: () => new Date(reloj) });
});
after(async () => servidor.cerrar());

const json = (r) => r.json();
const post = (camino, cuerpo, cabeceras = {}) => fetch(servidor.url + camino, { method: 'POST', headers: { 'Content-Type': 'application/json', ...cabeceras }, body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo) });
const crear = (eje) => post('/ejes', { eje }, { 'X-Crear-Ejes': 'prueba' }).then(json);

async function ejeFirmado(identidad = 'vg') {
  const claves = await generarClaves();
  const eje = await Eje.genesis({ identidad, foco: ['prueba'], t: T(0), clave: claves.publica, privada: claves.privada, exigirFirmas: true });
  return { eje, claves };
}

test('POST /ejes: protegido, nombres válidos, la clave de lectura una sola vez (solo se guarda su hash), 409 si existe, también en /eventos/ejes', async () => {
  let r = await post('/ejes', { eje: 'uno' });
  assert.equal(r.status, 401);
  r = await post('/ejes', { eje: 'uno' }, { 'X-Crear-Ejes': 'otra' });
  assert.equal(r.status, 401);
  r = await post('/ejes', { eje: 'Mayúsculas' }, { 'X-Crear-Ejes': 'prueba' });
  assert.equal(r.status, 400);
  r = await post('/ejes', 'no json', { 'X-Crear-Ejes': 'prueba' });
  assert.equal(r.status, 400);
  r = await post('/ejes', { eje: 'uno' }, { 'X-Crear-Ejes': 'prueba' });
  assert.equal(r.status, 201);
  const creado = await r.json();
  assert.match(creado.claveLectura, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(creado.eje, 'uno');
  assert.equal(creado.creado, new Date(reloj).toISOString());
  const fila = await servidor.almacen.eje('uno');
  assert.equal(fila.clave_lectura_hash, await hashDeClave(creado.claveLectura), 'se guarda el hash, no la clave');
  assert.equal(JSON.stringify(fila).includes(creado.claveLectura), false);
  r = await post('/ejes', { eje: 'uno' }, { 'X-Crear-Ejes': 'prueba' });
  assert.equal(r.status, 409);
  r = await post('/eventos/ejes', { eje: 'uno.b_2-x' }, { 'X-Crear-Ejes': 'prueba' });
  assert.equal(r.status, 201, 'la ruta bajo la función de Supabase');
  r = await fetch(servidor.url + '/ejes');
  assert.equal(r.status, 405);
  assert.notEqual(generarClaveLectura(), generarClaveLectura());
  // Sin secreto ni clave de servicio, crear ejes está deshabilitado.
  const cerrado = await arrancar({ puerto: 0, secreto: '' });
  r = await fetch(cerrado.url + '/ejes', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Crear-Ejes': '' }, body: '{"eje":"x"}' });
  assert.equal(r.status, 503);
  await cerrado.cerrar();
});

test('GET /eventos: 404 eje desconocido, 401 sin clave o con otra, parámetros válidos, vacío al empezar', async () => {
  const { claveLectura } = await crear('lectura');
  let r = await fetch(servidor.url + '/eventos?eje=nadie', { headers: { 'X-Clave-Lectura': claveLectura } });
  assert.equal(r.status, 404);
  r = await fetch(servidor.url + '/eventos?eje=lectura');
  assert.equal(r.status, 401);
  r = await fetch(servidor.url + '/eventos?eje=lectura', { headers: { 'X-Clave-Lectura': 'x' } });
  assert.equal(r.status, 401);
  r = await fetch(servidor.url + '/eventos?eje=lectura&desde=-1', { headers: { 'X-Clave-Lectura': claveLectura } });
  assert.equal(r.status, 400);
  r = await fetch(servidor.url + '/eventos?eje=lectura&cuantos=' + (PAGINA + 1), { headers: { 'X-Clave-Lectura': claveLectura } });
  assert.equal(r.status, 400);
  r = await fetch(servidor.url + '/eventos?eje=lectura', { headers: { 'X-Clave-Lectura': claveLectura } });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { eventos: [], siguiente: null });
  r = await fetch(servidor.url + '/eventos?eje=lectura', { method: 'PUT', headers: { 'X-Clave-Lectura': claveLectura } });
  assert.equal(r.status, 405);
});

test('POST /eventos: el génesis firmado abre el eje; después solo quien tiene alta; duplicado 200; cuerpo no JSON 400; demasiado grande 413', async () => {
  const { claveLectura } = await crear('escritura');
  const { eje, claves } = await ejeFirmado();
  const g = eje.obtener(eje.genesisId);
  const cab = { 'X-Clave-Lectura': claveLectura };
  // Antes del génesis, nada.
  const e0 = await eje.escribir({ autor: 'vg', sobre: eje.genesisId, t: T(1), movimientos: [minuto('vg')], payload: ['antes'] }, claves.privada);
  let r = await post('/eventos', { eje: 'escritura', evento: e0 }, cab);
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /vacío: solo se admite su génesis/);
  // Un génesis sin clave declarada no vale para compartir.
  const demo = await Eje.genesis({ identidad: 'vg', foco: ['demo'], t: T(0), demostracion: true });
  r = await post('/eventos', { eje: 'escritura', evento: demo.obtener(demo.genesisId) }, cab);
  assert.equal(r.status, 400);
  // Sin clave de lectura tampoco se escribe.
  r = await post('/eventos', { eje: 'escritura', evento: g });
  assert.equal(r.status, 401);
  r = await post('/eventos', { eje: 'escritura', evento: g }, cab);
  assert.equal(r.status, 201);
  const primero = await r.json();
  assert.deepEqual(Object.keys(primero), ['orden', 'recibido']);
  assert.equal(primero.recibido, new Date(reloj).toISOString());
  r = await post('/eventos', { eje: 'escritura', evento: g }, cab);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ...primero, duplicado: true });
  // Otro génesis (otro eje local) no entra; e0 sí, con el orden siguiente.
  const { eje: otro } = await ejeFirmado();
  r = await post('/eventos', { eje: 'escritura', evento: otro.obtener(otro.genesisId) }, cab);
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /ya tiene génesis/);
  r = await post('/eventos', { eje: 'escritura', evento: e0 }, cab);
  assert.equal(r.status, 201);
  assert.equal((await r.json()).orden, primero.orden + 1);
  // Lo guardado: solo los campos del evento, con autor y firma en sus columnas.
  const filas = servidor.almacen.filas('escritura');
  assert.deepEqual(filas.map((f) => [f.id, f.autor, f.firma]), [[g.id, 'vg', g.firma], [e0.id, 'vg', e0.firma]]);
  assert.deepEqual(filas[1].cuerpo, JSON.parse(JSON.stringify(e0)));
  // Errores de cuerpo.
  r = await post('/eventos', '{no', cab);
  assert.equal(r.status, 400);
  r = await post('/eventos', { eje: 'escritura' }, cab);
  assert.equal(r.status, 400);
  const e1 = await eje.escribir({ autor: 'vg', sobre: e0.id, t: T(2), movimientos: [minuto('vg')], payload: ['después'] }, claves.privada);
  r = await post('/eventos', { eje: 'escritura', evento: { ...e1, firmante: 'otro' } }, cab);
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /el firmante debe ser el autor/);
  r = await post('/eventos', { eje: 'escritura', evento: { ...e0, firmante: 'otro' } }, cab);
  assert.equal(r.status, 200, 'un id que ya está responde su orden sin volver a mirar nada: idempotente');
  r = await post('/eventos', { eje: 'escritura', evento: { ...e0, payload: 'x'.repeat(LIMITE_CUERPO) } }, cab);
  assert.equal(r.status, 413);
  // Lo que se baja es lo que se subió, en orden de llegada.
  r = await fetch(servidor.url + '/eventos?eje=escritura&desde=' + (primero.orden - 1), { headers: cab });
  const bajado = await r.json();
  assert.deepEqual(bajado.eventos.map((x) => [x.orden, x.evento.id]), [[primero.orden, g.id], [primero.orden + 1, e0.id]]);
  assert.equal(bajado.siguiente, null);
  r = await fetch(servidor.url + '/eventos?eje=escritura&desde=' + primero.orden + '&cuantos=1', { headers: cab });
  assert.deepEqual((await r.json()).eventos.map((x) => x.evento.id), [e0.id]);
});

test('límite de escrituras por minuto por eje (429) con el reloj del servidor', async () => {
  let ahora = Date.parse('2026-11-10T15:00:00Z');
  const s = await arrancar({ puerto: 0, secreto: 'prueba', ahora: () => new Date(ahora), escriturasPorMinuto: 2 });
  const r0 = await fetch(s.url + '/ejes', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Crear-Ejes': 'prueba' }, body: '{"eje":"limite"}' });
  const { claveLectura } = await r0.json();
  const { eje } = await ejeFirmado();
  const g = eje.obtener(eje.genesisId);
  const subir = () => fetch(s.url + '/eventos', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Clave-Lectura': claveLectura }, body: JSON.stringify({ eje: 'limite', evento: g }) });
  assert.deepEqual([(await subir()).status, (await subir()).status, (await subir()).status], [201, 200, 429]);
  ahora += 60000;
  assert.equal((await subir()).status, 200);
  // Las lecturas no cuentan.
  const r = await fetch(s.url + '/eventos?eje=limite', { headers: { 'X-Clave-Lectura': claveLectura } });
  assert.equal(r.status, 200);
  await s.cerrar();
});

test('CORS: la carta publicada y localhost; otro origen no recibe la cabecera', async () => {
  const pedir = (origen) => fetch(servidor.url + '/eventos', { method: 'OPTIONS', headers: { Origin: origen, 'Access-Control-Request-Method': 'POST' } });
  let r = await pedir('https://agram.ikisai.com');
  assert.equal(r.status, 204);
  assert.equal(r.headers.get('access-control-allow-origin'), 'https://agram.ikisai.com');
  assert.match(r.headers.get('access-control-allow-headers'), /X-Clave-Lectura/);
  r = await pedir('http://localhost:5173');
  assert.equal(r.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  r = await pedir('https://otro.example');
  assert.equal(r.status, 204);
  assert.equal(r.headers.get('access-control-allow-origin'), null);
  // Las respuestas normales también la llevan.
  r = await fetch(servidor.url + '/eventos?eje=nadie', { headers: { Origin: 'http://localhost:8080' } });
  assert.equal(r.headers.get('access-control-allow-origin'), 'http://localhost:8080');
});

test('con --archivo, lo guardado sobrevive a reiniciar el servidor', async () => {
  const carpeta = mkdtempSync(join(tmpdir(), 'agram-libro-'));
  const archivo = join(carpeta, 'libro.json');
  const s1 = await arrancar({ puerto: 0, secreto: 'prueba', archivo });
  const r0 = await fetch(s1.url + '/ejes', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Crear-Ejes': 'prueba' }, body: '{"eje":"disco"}' });
  const { claveLectura } = await r0.json();
  const { eje } = await ejeFirmado();
  const g = eje.obtener(eje.genesisId);
  const r1 = await fetch(s1.url + '/eventos', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Clave-Lectura': claveLectura }, body: JSON.stringify({ eje: 'disco', evento: g }) });
  const { orden } = await r1.json();
  await s1.cerrar();
  const s2 = await arrancar({ puerto: 0, secreto: 'prueba', archivo });
  const r2 = await fetch(s2.url + '/eventos?eje=disco', { headers: { 'X-Clave-Lectura': claveLectura } });
  const bajado = await r2.json();
  assert.deepEqual(bajado.eventos.map((x) => [x.orden, x.evento.id]), [[orden, g.id]]);
  await s2.cerrar();
  rmSync(carpeta, { recursive: true, force: true });
});
