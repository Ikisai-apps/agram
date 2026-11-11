// Los archivos adjuntos (issues #21, #22; encargo pv0): la función `archivos` (servidor/supabase/funciones/archivos/api.js)
// servida por el servidor de prueba (subir, leer, rechazar tipo, tamaño, contenido y clave; idempotente; lo que se sirve
// no se ejecuta), el cliente de la carta (carta/archivos.js: adjuntar, bajar, sin red, sin servidor) y la acción de la
// época «attach a file» (PV2, el registro como representación rica con la referencia archivo:<sha256>).

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { arrancar } from '../servidor/prueba/servidor.mjs';
import { LIMITE_ARCHIVO, TIPOS, POLITICA, tipoPorContenido, crearArchivos } from '../servidor/supabase/funciones/archivos/api.js';
import { Archivos, tipoDeArchivo, formatoDeTipo, LIMITE, LIMITE_HTML } from '../carta/archivos.js';
import * as A from '../src/acciones.js';
import * as C from '../src/contrato.js';
import * as modelos from '../src/modelos.js';
import * as salida from '../src/escritura.js';
import { ejemploCompra } from '../ejemplos/ikisai/compra-food.mjs';

let servidor;
let clave;
before(async () => {
  servidor = await arrancar({ puerto: 0, secreto: 'prueba' });
  const r = await fetch(servidor.url + '/ejes', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Crear-Ejes': 'prueba' }, body: JSON.stringify({ eje: 'archivos' }) });
  clave = (await r.json()).claveLectura;
});
after(async () => servidor.cerrar());

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const HTML = new TextEncoder().encode('<!doctype html><html><head><title>landing</title></head><body><h1>AGRAM</h1><script>alert(1)</script></body></html>');
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82]);
const subir = (bytes, tipo, { eje = 'archivos', conClave = clave } = {}) => fetch(servidor.url + '/archivos?eje=' + eje, { method: 'POST', headers: { 'Content-Type': tipo, ...(conClave ? { 'X-Clave-Lectura': conClave } : {}) }, body: bytes });
const bajar = (id, { eje = 'archivos', conClave = clave } = {}) => fetch(servidor.url + '/archivos/' + id + '?eje=' + eje, { headers: conClave ? { 'X-Clave-Lectura': conClave } : {} });

test('POST /archivos: sube con la clave de lectura; el id es el SHA-256 del contenido; idempotente (201 la primera, 200 después)', async () => {
  let r = await subir(HTML, 'text/html; charset=utf-8');
  assert.equal(r.status, 201);
  assert.deepEqual(await r.json(), { id: sha(HTML), tipo: 'text/html', bytes: HTML.length });
  r = await subir(HTML, 'text/html');
  assert.equal(r.status, 200, 'el mismo contenido: ya estaba');
  assert.equal((await r.json()).id, sha(HTML));
  r = await subir(PNG, 'image/png');
  assert.equal(r.status, 201);
  assert.equal((await r.json()).id, sha(PNG));
});

test('GET /archivos/<id>: devuelve el archivo con su tipo, inline, nosniff y la política sandbox (nada se ejecuta aunque se abra a mano)', async () => {
  await subir(HTML, 'text/html');
  const r = await bajar(sha(HTML));
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'text/html; charset=utf-8');
  assert.equal(r.headers.get('content-disposition'), 'inline');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('content-security-policy'), POLITICA);
  assert.match(POLITICA, /^sandbox;/);
  assert.match(POLITICA, /default-src 'none'/);
  assert.equal(r.headers.get('referrer-policy'), 'no-referrer');
  assert.deepEqual(new Uint8Array(await r.arrayBuffer()), HTML);
  assert.equal((await bajar('0'.repeat(64))).status, 404);
  assert.equal((await bajar('no-es-un-id')).status, 400);
});

test('se rechaza: sin clave o con otra (401), eje desconocido (404), tipo no admitido (415), más de 2 MB (413), vacío o contenido que no es del tipo (400)', async () => {
  assert.equal((await subir(HTML, 'text/html', { conClave: null })).status, 401);
  assert.equal((await subir(HTML, 'text/html', { conClave: 'otra' })).status, 401);
  assert.equal((await bajar(sha(HTML), { conClave: null })).status, 401);
  assert.equal((await subir(HTML, 'text/html', { eje: 'nadie' })).status, 404);
  for (const tipo of ['application/javascript', 'text/javascript', 'application/pdf', 'image/gif', '']) {
    const r = await subir(HTML, tipo);
    assert.equal(r.status, 415, tipo);
  }
  assert.deepEqual([...TIPOS], ['text/html', 'image/png', 'image/jpeg', 'image/svg+xml', 'application/json']);
  const grande = new Uint8Array(LIMITE_ARCHIVO + 1).fill(0x61);
  assert.equal((await subir(grande, 'text/html')).status, 413);
  assert.equal(LIMITE_ARCHIVO, 2 * 1024 * 1024);
  assert.equal((await subir(new Uint8Array(0), 'text/html')).status, 400);
  assert.equal((await subir(HTML, 'image/png')).status, 400, 'no es un PNG');
  assert.equal((await subir(HTML, 'application/json')).status, 400, 'no es JSON');
  assert.equal((await subir(new TextEncoder().encode('<p>hola</p>'), 'image/svg+xml')).status, 400, 'no es un SVG');
  assert.equal((await subir(new TextEncoder().encode('{"v":"5.7","layers":[]}'), 'application/json')).status, 201);
  assert.equal((await subir(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), 'image/svg+xml')).status, 201);
});

test('el almacén que no conserva el tipo (Storage guarda el HTML como text/plain): se sirve por su contenido', async () => {
  assert.equal(tipoPorContenido(HTML), 'text/html');
  assert.equal(tipoPorContenido(PNG), 'image/png');
  assert.equal(tipoPorContenido(new TextEncoder().encode('<?xml version="1.0"?>\n<svg></svg>')), 'image/svg+xml');
  assert.equal(tipoPorContenido(new TextEncoder().encode('{"layers":[]}')), 'application/json');
  const guardado = new Map();
  const almacen = {
    eje: async () => ({ clave_lectura_hash: sha(new TextEncoder().encode('k')) }),
    guardar: async (eje, id, tipo, bytes) => { guardado.set(id, bytes); return { nuevo: true }; },
    leer: async (eje, id) => (guardado.has(id) ? { tipo: 'text/plain', bytes: guardado.get(id) } : null),
  };
  const manejar = crearArchivos({ almacen });
  await manejar(new Request('http://x/archivos?eje=e', { method: 'POST', headers: { 'Content-Type': 'text/html', 'X-Clave-Lectura': 'k' }, body: HTML }));
  const r = await manejar(new Request('http://x/functions/v1/archivos/' + sha(HTML) + '?eje=e', { headers: { 'X-Clave-Lectura': 'k' } }));
  assert.equal(r.headers.get('content-type'), 'text/html; charset=utf-8');
  assert.equal(r.headers.get('content-security-policy'), POLITICA);
});

test('carta/archivos.js: adjunta (prepara, calcula el id en local, sube) y lo bajado se pinta: el HTML como texto (hasta 1 MB), la imagen como URL local', async () => {
  const destino = () => ({ url: servidor.url + '/', eje: 'archivos', claveLectura: clave });
  let cambios = 0;
  const a = new Archivos({ destino, alCambiar: () => { cambios += 1; } });
  const r = await a.adjuntar({ nombre: 'landing.html', tipo: '', bytes: HTML });
  assert.deepEqual([r.id, r.tipo, r.referencia, r.subido, r.sinRed], [sha(HTML), 'text/html', 'archivo:' + sha(HTML), true, false]);
  assert.equal(a.contenido(r.id).texto, new TextDecoder().decode(HTML), 'lo adjuntado ya está en la pestaña');
  // Otra pestaña (sin caché): lo pide, y al llegar avisa.
  const b = new Archivos({ destino, alCambiar: () => { cambios += 1; } });
  assert.equal(b.contenido(r.id).estado, 'cargando');
  await new Promise((ok) => setTimeout(ok, 200));
  assert.equal(cambios, 1);
  assert.equal(b.contenido(r.id).estado, 'listo');
  assert.equal(b.contenido(r.id).texto, new TextDecoder().decode(HTML));
  const p = await b.adjuntar({ nombre: 'x.png', bytes: PNG });
  assert.match(b.contenido(p.id).url, /^blob:/);
  // Lo que no hay: «falta»; lo que pasa de 1 MB de HTML no se pinta.
  b.contenido('f'.repeat(64));
  await new Promise((ok) => setTimeout(ok, 200));
  assert.equal(b.contenido('f'.repeat(64)).estado, 'falta');
  const grande = new Uint8Array(LIMITE_HTML + 10).fill(0x61);
  const g = await b.adjuntar({ nombre: 'grande.html', bytes: grande });
  assert.equal(b.contenido(g.id).estado, 'error');
  assert.equal(b.contenido(g.id).texto, undefined);
  // Los tipos: por el navegador o por la extensión; la época dice el formato.
  assert.deepEqual([tipoDeArchivo('a.HTM', ''), tipoDeArchivo('a.bin', 'image/svg+xml'), tipoDeArchivo('a.js', 'text/javascript'), tipoDeArchivo('a.gif', 'image/gif')], ['text/html', 'image/svg+xml', null, null]);
  assert.deepEqual(['text/html', 'image/png', 'image/jpeg', 'image/svg+xml', 'application/json'].map((x) => formatoDeTipo(x)), ['html', 'image', 'image', 'svg', 'lottie']);
  assert.equal(LIMITE, LIMITE_ARCHIVO);
});

test('carta/archivos.js: sin servidor se rechaza (no hay dónde encolarlo); sin red queda pendiente y se sube en la siguiente vuelta; lo que el servidor rechaza, con su motivo', async () => {
  await assert.rejects(new Archivos({ destino: () => null }).adjuntar({ nombre: 'a.html', bytes: HTML }), /sin servidor/);
  await assert.rejects(new Archivos({ destino: () => ({ url: servidor.url, eje: 'archivos', claveLectura: clave }) }).adjuntar({ nombre: 'a.js', tipo: 'text/javascript', bytes: HTML }), /no es de un tipo admitido/);
  await assert.rejects(new Archivos({ destino: () => ({ url: servidor.url, eje: 'archivos', claveLectura: clave }) }).adjuntar({ nombre: 'a.html', bytes: new Uint8Array(LIMITE + 1) }), /pasa de 2 MB/);
  await assert.rejects(new Archivos({ destino: () => ({ url: servidor.url, eje: 'archivos', claveLectura: 'otra' }) }).adjuntar({ nombre: 'a.html', bytes: HTML }), /401/);
  let red = false;
  const fetchCortado = (...args) => (red ? fetch(...args) : Promise.reject(new TypeError('Failed to fetch')));
  const a = new Archivos({ destino: () => ({ url: servidor.url, eje: 'archivos', claveLectura: clave }), fetch: fetchCortado });
  const sinRed = new TextEncoder().encode('<p>sin red</p>');
  const r = await a.adjuntar({ nombre: 'b.html', bytes: sinRed });
  assert.deepEqual([r.subido, r.sinRed, a.pendientes.size], [false, true, 1]);
  assert.equal(a.contenido(r.id).texto, '<p>sin red</p>', 'en la pestaña se ve ya');
  assert.equal(await a.subirPendientes(), 1, 'sigue sin red');
  red = true;
  assert.equal(await a.subirPendientes(), 0);
  assert.equal((await bajar(r.id)).status, 200, 'subido al volver la red');
});

test('«attach a file» (PV2, no preferente): escribe una representación rica anclada en la raíz de X con archivo:<sha256>; el HTML solo se admite como archivo adjunto (se pinta aislado)', async () => {
  const { eje, compra } = await ejemploCompra();
  const nuevo = await salida.escribirDesde(eje, { modo: 'pointed', autor: 'huesped', sobre: compra.id, en: '1000000000', payload: salida.desdePointed(eje, 'Proyecto AGRAM') });
  const lista = A.acciones(eje, nuevo.id, 2, 'huesped');
  const adjuntar = lista.find((a) => a.nombre === 'attach a file');
  assert.ok(adjuntar, 'en el sitio 2 del elemento');
  assert.equal(adjuntar.porDefecto, false, 'no preferente');
  assert.equal(lista[lista.length - 1], adjuntar, 'la última de la lista');
  const pide = A.parametros(adjuntar.plantilla).filter((p) => A.archivoDe(p)).map((p) => [p.nombre, A.archivoDe(p)]);
  assert.deepEqual(pide, [['file', 'ref'], ['format', 'format']]);
  const ref = modelos.referenciaDeArchivo(sha(HTML));
  const r = await A.transaccion(eje, adjuntar.id, { X: nuevo.id, file: ref, format: 'html' }, 'huesped');
  assert.equal(r.ok, true, JSON.stringify(r.motivos));
  assert.equal(r.evento.sobre, nuevo.id);
  assert.equal(r.evento.en, '0000000000', 'en la raíz de X: colisiona con su 0, es una representación');
  await eje.anadir(r.evento);
  const html = C.representaciones(eje, nuevo.id).find((x) => x.formato === 'html');
  assert.deepEqual([html.tamano, html.recurso], [3, ref]);
  assert.equal(modelos.idDeArchivo(html.recurso), sha(HTML));
  // SEG-14: lo que se pinta aislado solo entra como archivo adjunto; una URL o una ruta, no.
  assert.equal(modelos.pintaEnSandbox('html'), true);
  assert.equal(modelos.representacionAdmitida(html), true);
  assert.equal(modelos.representacionAdmitida({ formato: 'html', recurso: 'https://agram.ikisai.com/x.html' }), false);
  assert.equal(modelos.representacionAdmitida({ formato: 'html', recurso: 'arte/x.html' }), false);
  assert.equal(modelos.representacionAdmitida({ formato: 'image', recurso: 'arte/x.png' }), true);
  assert.equal(modelos.recursoAdmitido(ref), true);
  assert.equal(modelos.recursoAdmitido('archivo:' + 'x'.repeat(64)), false);
  // Una plantilla que no admite html en su 0 (la compra: text, icon, image) no lo toma como representación.
  const enCompra = await A.transaccion(eje, adjuntar.id, { X: compra.id, file: ref, format: 'html' }, 'huesped');
  await eje.anadir(enCompra.evento);
  assert.equal(C.representaciones(eje, compra.id).some((x) => x.formato === 'html'), false);
});
