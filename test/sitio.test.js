// La configuración por defecto del sitio (carta/sitio.js, docs/CONTRATO.md §16.2 ter): un `./sitio.json` opcional con
// solo claves de ajustes conocidas, que la carta lee al cargar y usa COMO DEFECTO: la cuenta nueva nace con ellos (en los
// registros de ajustes de siempre) y la configuración los enseña cuando la cuenta no tiene ese ajuste. Sin fichero, o sin
// JSON, todo como hoy; las claves desconocidas se ignoran; una clave de lectura (o cualquier secreto) se ignora y avisa
// en la consola. Sin DOM: la carta se prueba por sus módulos (cuentas, sitio, dom) y el cableado de app.js se lee como texto.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as Q from '../carta/cuentas.js';
import * as S from '../carta/sitio.js';
import { preferencias } from '../carta/carta.js';
import { ajustesEditablesDe } from '../carta/guia.js';
import { htmlConfiguracion } from '../carta/dom.js';
import { sincronia, exterior } from '../src/index.js';

const T1 = '2026-11-14T10:00:00Z';
const SITIO = { 'sync url': 'https://aarpia.ikisai.com/', 'sync ledger': 'nodo-ikisai', 'guide url': 'https://aarpia.ikisai.com' };
const APP = readFileSync(new URL('../carta/app.js', import.meta.url), 'utf8');
const EJEMPLO = JSON.parse(readFileSync(new URL('../sitio.ejemplo.json', import.meta.url), 'utf8'));

/** Un fetch simulado que sirve `cuerpo` con ese estado (y recuerda lo pedido). */
const servir = (estado, cuerpo, pedidos = []) => async (url, opciones) => { pedidos.push({ url, opciones }); return { ok: estado >= 200 && estado < 300, status: estado, text: async () => cuerpo }; };

/** Captura lo que sale por console.warn mientras dura fn. */
async function avisos(fn) {
  const guardado = console.warn;
  const salidas = [];
  console.warn = (...a) => salidas.push(a.join(' '));
  try { await fn(); } finally { console.warn = guardado; }
  return salidas;
}

test('sitio.ejemplo.json (el documentado) es válido tal cual: sus tres claves pasan sin avisos', () => {
  const r = S.validar(EJEMPLO);
  assert.deepEqual(r.avisos, []);
  assert.deepEqual(Object.keys(r.ajustes).sort(), ['guide url', 'sync ledger', 'sync url']);
});

test('validar: solo claves conocidas con valor de su forma; direcciones http(s) sin barra final ni credenciales; nombres de eje; lo desconocido, sin ruido', () => {
  const r = S.validar({ ...SITIO, 'relay url': 'http://127.0.0.1:8788', 'seal url': 'ftp://x', 'blossom url': 'https://u:p@x.com', color: 'rojo', 'sync ledger ': 'x' });
  assert.deepEqual(r.ajustes, { 'sync url': 'https://aarpia.ikisai.com', 'sync ledger': 'nodo-ikisai', 'guide url': 'https://aarpia.ikisai.com', 'relay url': 'http://127.0.0.1:8788' });
  assert.equal(r.avisos.length, 2, 'avisa de los valores malos de claves conocidas, no de las desconocidas: ' + r.avisos.join(' | '));
  assert.deepEqual(S.validar({ 'sync ledger': 'Nombre Con Espacios' }).ajustes, {});
  for (const mal of [null, 3, 'texto', [], undefined]) assert.deepEqual(S.validar(mal), { ajustes: {}, avisos: [] });
  assert.deepEqual(S.validar(Object.create({ 'sync url': 'https://x.com' })).ajustes, {}, 'lo heredado no cuenta');
});

test('una clave (de lectura o la que sea) en el sitio.json se ignora y se avisa en la consola; nunca llega a los defectos', async () => {
  const salida = await avisos(() => {
    const d = S.fijar({ ...SITIO, 'read key': 'SECRETO-LECTURA', 'clave de lectura': 'otra', 'sync key': 'x', token: 't' });
    assert.deepEqual(Object.keys(d).sort(), ['guide url', 'sync ledger', 'sync url']);
    assert.doesNotMatch(JSON.stringify(d), /SECRETO|otra/);
  });
  assert.equal(salida.length, 4);
  assert.ok(salida.every((a) => /ignorada/.test(a) && !/SECRETO|otra/.test(a)), 'el aviso no repite el secreto: ' + salida.join(' | '));
  S.fijar({});
});

test('cargar: lee ./sitio.json del mismo origen, sin credenciales ni caché; silencioso si no existe, no es JSON, el alojamiento da otra página o la red falla', async () => {
  const pedidos = [];
  const ok = await S.cargar({ fetch: servir(200, JSON.stringify(SITIO), pedidos) });
  assert.equal(ok['sync url'], 'https://aarpia.ikisai.com');
  assert.equal(S.defectos()['sync ledger'], 'nodo-ikisai');
  assert.equal(pedidos[0].url, './sitio.json');
  assert.deepEqual([pedidos[0].opciones.credentials, pedidos[0].opciones.cache], ['omit', 'no-cache']);
  const salida = await avisos(async () => {
    for (const f of [servir(404, 'no existe'), servir(200, '<!doctype html><title>carta</title>'), servir(200, ''), servir(200, '[1,2]'), servir(200, 'null'), async () => { throw new TypeError('sin red'); }, null]) {
      const d = await S.cargar({ fetch: f });
      assert.deepEqual({ ...d }, {}, 'sin defectos');
      assert.deepEqual({ ...S.defectos() }, {});
    }
  });
  assert.deepEqual(salida, [], 'ni un aviso');
  // Una respuesta que nunca llega no retrasa el arranque más que la espera.
  const colgado = (url, { signal }) => new Promise((_, rechazar) => signal.addEventListener('abort', () => rechazar(new Error('abortado'))));
  assert.deepEqual({ ...(await S.cargar({ fetch: colgado, espera: 20 })) }, {});
});

test('la cuenta nueva con sitio.json nace con esos defectos: sync url y ledger en sus preferencias, guide url en «exterior settings», todo firmado; la sincronía ya tiene destino', async () => {
  const { cuenta, eje } = await Q.crearCuenta({ nombre: 'Víctor', ajustes: S.fijar(SITIO), t: T1 });
  const d = sincronia.destino(eje, cuenta.identidad);
  assert.deepEqual(d, { url: 'https://aarpia.ikisai.com', eje: 'nodo-ikisai' });
  assert.equal(exterior.exterior(eje, cuenta.identidad).guia, 'https://aarpia.ikisai.com');
  assert.equal(sincronia.destinoDelLibro(eje, cuenta.identidad).url, 'https://aarpia.ikisai.com');
  assert.equal(eje.orden.length, 3, 'el alta y los dos registros de ajustes');
  for (const id of eje.orden.slice(1)) assert.ok(eje.obtener(id).firma, 'firmado por la cuenta');
  // La clave de lectura no está en ningún evento de la cuenta ni se inventa.
  assert.doesNotMatch(JSON.stringify(eje.orden.map((id) => eje.obtener(id))), /lectura|read key/i);
  // Con el idioma distinto del de la época, el idioma y el sitio comparten el registro de preferencias (un solo registro).
  const en = await Q.crearCuenta({ nombre: 'Ana', idioma: 'en', ajustes: { 'sync url': 'https://aarpia.ikisai.com', 'sync ledger': 'nodo-ikisai' }, t: T1 });
  assert.equal(en.eje.orden.length, 2);
  assert.equal(sincronia.destino(en.eje, en.cuenta.identidad).eje, 'nodo-ikisai');
  assert.equal(preferencias(en.eje, en.cuenta.identidad).campos.find((c) => c.clave === 'language').valor, 'en');
  S.fijar({});
});

test('sin sitio.json la cuenta nace como hoy: solo su alta, sin destino de sincronía; y el formulario no trae nada precargado', async () => {
  await S.cargar({ fetch: servir(404, '') });
  const { cuenta, eje } = await Q.crearCuenta({ nombre: 'Víctor', ajustes: S.defectos(), t: T1 });
  assert.equal(eje.orden.length, 1);
  assert.equal(sincronia.destino(eje, cuenta.identidad), null);
  const aparte = await Q.crearCuenta({ nombre: 'Víctor', t: T1 });
  assert.equal(aparte.eje.orden.length, 1, 'y sin la opción, igual');
  assert.deepEqual(S.faltantes(eje, cuenta.identidad), { preferencias: {}, exterior: {} });
  const h = htmlConfiguracion(preferencias(eje, cuenta.identidad, S.faltantes(eje, cuenta.identidad).preferencias), { parte: '9', claveLectura: '' });
  assert.doesNotMatch(h, /aarpia/);
});

test('la configuración (parte 9) de una cuenta sin esos ajustes enseña los defectos del sitio y no escribe nada; con el ajuste propio, gana el de la cuenta', async () => {
  const { cuenta, eje } = await Q.crearCuenta({ nombre: 'Víctor', t: T1 });
  const id = cuenta.identidad;
  S.fijar(SITIO);
  const f = S.faltantes(eje, id);
  assert.deepEqual(f, { preferencias: { 'sync url': 'https://aarpia.ikisai.com', 'sync ledger': 'nodo-ikisai' }, exterior: { 'guide url': 'https://aarpia.ikisai.com' } });
  const ext = ajustesEditablesDe(exterior.AJUSTES.plantilla, eje, id, f.exterior);
  const h = htmlConfiguracion(preferencias(eje, id, f.preferencias), { parte: '9', claveLectura: '', exterior: ext });
  assert.match(h, /name="sync url" type="text" value="https:\/\/aarpia\.ikisai\.com"/);
  assert.match(h, /name="sync ledger" type="text" value="nodo-ikisai"/);
  assert.match(h, /guide url[^>]*value="https:\/\/aarpia\.ikisai\.com"/);
  assert.match(h, /data-clave-lectura type="password" value=""/, 'la clave de lectura, vacía: la mete la persona');
  assert.equal(eje.orden.length, 1, 'mirar no escribe');
  assert.equal(sincronia.destino(eje, id), null, 'hasta que se guarda, no hay destino');
  // La persona guarda otra dirección: gana la suya, y el sitio ya no se ofrece para ese ajuste.
  const { cuenta: c2, eje: e2 } = await Q.crearCuenta({ nombre: 'Luis', ajustes: { 'sync url': 'https://otro.example', 'sync ledger': 'mi-eje' }, t: T1 });
  assert.deepEqual(S.faltantes(e2, c2.identidad).preferencias, {});
  assert.deepEqual(S.faltantes(e2, c2.identidad).exterior, { 'guide url': 'https://aarpia.ikisai.com' }, 'lo que le falta, sí');
  const h2 = htmlConfiguracion(preferencias(e2, c2.identidad, S.faltantes(e2, c2.identidad).preferencias), { parte: '9', claveLectura: '' });
  assert.match(h2, /name="sync url" type="text" value="https:\/\/otro\.example"/);
  S.fijar({});
});

test('app.js: lee el sitio al arrancar, crea las cuentas con sus defectos y enseña los que faltan en la configuración; la clave de lectura sigue siendo del navegador', () => {
  assert.match(APP, /import \* as ajustesDelSitio from '\.\/sitio\.js'/);
  assert.match(APP, /await ajustesDelSitio\.cargar\(\)/);
  assert.match(APP, /cuentas\.crearCuenta\(\{[^}]*ajustes: ajustesDelSitio\.defectos\(\)/);
  assert.match(APP, /preferencias\(estado\.eje, estado\.identidad, porDefectoDelSitio\(\)\.preferencias\)/);
  assert.match(APP, /ajustesEditablesDe\(exterior\.AJUSTES\.plantilla, estado\.eje, estado\.identidad, porDefectoDelSitio\(\)\.exterior\)/);
  assert.doesNotMatch(readFileSync(new URL('../carta/sitio.js', import.meta.url), 'utf8'), /guardarClaveLectura|eval\(|new Function|innerHTML/);
});
