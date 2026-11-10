// Be, el mando de Core en solo lectura (be.mjs, docs/CONTRATO.md §17), contra el servidor de prueba
// (servidor/prueba/servidor.mjs en un puerto libre). Un eje compartido se crea y se llena con el cliente de sincronía
// (un génesis, un registro «AGRAM», un menú, el ajuste «opinions anchor» y una opinión anclada con la plantilla «opinion»
// y su respuesta); be.mjs corre como proceso hijo con una configuración temporal y una caché temporal (AGRAM_BE_CACHE).
// Nada real: el eje y su clave se crean en cada ejecución, y todo vive en una carpeta temporal.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { arrancar } from '../servidor/prueba/servidor.mjs';
import { acciones, salida, sincronia } from '../src/index.js';
import * as Q from '../carta/cuentas.js';
import * as G from '../carta/guia.js';
import * as X from '../carta/externa.js';
import { nuevaOpinion } from '../carta/opinar.js';

const BE = fileURLToPath(new URL('../be.mjs', import.meta.url));
const T = (m) => '2026-11-10T10:' + String(m).padStart(2, '0') + ':00Z';

let servidor;
let carpeta;
let cuenta;
let cfg;
let cache;
let ids; // { agram, menu, opinion, respuesta }
let claveLectura;

/** Ejecuta be.mjs como proceso hijo: → { codigo, salida, error }. */
const be = (...args) => new Promise((resolver) => {
  execFile(process.execPath, [BE, ...args], { env: { ...process.env, AGRAM_BE_CACHE: cache, AGRAM_BE_CONFIG: '' }, timeout: 60000 }, (e, out, err) => resolver({ codigo: e ? (e.code ?? 1) : 0, salida: out, error: err }));
});
const conCfg = (...args) => be(...args, '--config', cfg);

before(async () => {
  servidor = await arrancar({ puerto: 0, secreto: 'prueba' });
  carpeta = mkdtempSync(join(tmpdir(), 'agram-be-'));
  cache = join(carpeta, 'cache');
  cfg = join(carpeta, 'be.json');

  const r = await fetch(servidor.url + '/ejes', { method: 'POST', headers: { 'X-Crear-Ejes': 'prueba', 'Content-Type': 'application/json' }, body: JSON.stringify({ eje: 'vg' }) });
  assert.equal(r.status, 201);
  claveLectura = (await r.json()).claveLectura;

  // El eje de VG: su génesis (su alta) y lo que escribe, firmado, con T de minuto distinto en cada registro.
  cuenta = await Q.crearCuenta({ nombre: 'Víctor', idioma: 'es', t: T(0) });
  const yo = cuenta.cuenta.identidad;
  const firmar = Q.firmarCon(cuenta.privada);
  let m = 1;
  const anclar = async (sobre, title, content) => {
    const tx = await acciones.transaccion(cuenta.eje, 'anchor here', { X: sobre, title, ...(content ? { content } : {}) }, yo, { t: T(m++), firmar });
    assert.equal(tx.ok, true, JSON.stringify(tx.motivos));
    return (await cuenta.eje.anadir(tx.evento)).id;
  };
  const agram = await anclar(cuenta.cuenta.alta, 'AGRAM', 'el proyecto');
  const menu = await anclar(cuenta.cuenta.alta, 'Menú del día', 'tres platos y postre');
  const a = G.ajustesEditables(cuenta.eje, yo, { 'opinions anchor': 'AGRAM' });
  assert.equal(a.cambiado, true);
  await salida.escribirDesde(cuenta.eje, { modo: 'sequenced', autor: yo, sobre: a.sobre, en: a.en, payload: a.payload, t: T(m++) }, cuenta.privada);
  const op = nuevaOpinion({
    nodo: { tipo: 'ocupante', pv: 3, X: menu, X0: 'Menú del día', d: 1, tamano: 'tarjeta', representacion: 'texto@0', texto: 'Menú del día', ruta: ['carta', 'pv'] },
    entorno: { modo: 'apilada', ancho: 400, alto: 700, render: 'sobrio', foco: { X: menu, X0: 'Menú del día' } },
    version: 'v-prueba', cuenta: 'vg', ahora: Date.parse(T(m)),
  }, 'el botón del menú es pequeño');
  const dada = await X.anclarOpinion(cuenta.eje, yo, op, { firmar, t: T(m++) });
  assert.equal(dada.ok, true, dada.motivo);
  const respuesta = await anclar(dada.id, 'Lo miro', 'respuesta de prueba');
  ids = { agram, menu, opinion: dada.id, respuesta };

  const S = new sincronia.Sincronia({ url: servidor.url, eje: 'vg', claveLectura });
  const informe = await S.sincronizar(cuenta.eje);
  assert.deepEqual([informe.pendientes, informe.errores], [[], []]);
  assert.equal(servidor.almacen.filas('vg').length, cuenta.eje.orden.length);
  writeFileSync(cfg, JSON.stringify({ sync_url: servidor.url, eje: 'vg', clave_lectura: claveLectura }));
});

after(async () => {
  await servidor.cerrar();
  rmSync(carpeta, { recursive: true, force: true });
});

test('estado: el eje, los registros, el último orden, las identidades con su alta y el registro AGRAM; la primera vez baja el eje del génesis y deja la caché fuera del repo', async () => {
  assert.ok(!existsSync(cache));
  const r = await conCfg('estado');
  assert.equal(r.codigo, 0, r.error);
  assert.match(r.salida, /^eje: vg$/m);
  assert.match(r.salida, new RegExp('^registros: ' + cuenta.eje.orden.length + '$', 'm'));
  assert.match(r.salida, new RegExp('^último orden del servidor: ' + servidor.almacen.filas('vg').at(-1).orden + '$', 'm'));
  assert.match(r.salida, new RegExp('^  ' + cuenta.cuenta.identidad + ' · alta ' + cuenta.cuenta.alta.slice(0, 8) + ' · 0: «Víctor»$', 'm'));
  assert.match(r.salida, new RegExp('^proyecto AGRAM: ' + ids.agram.slice(0, 8), 'm'));
  assert.ok(!r.salida.includes(claveLectura), 'la clave de lectura no se imprime');
  const guardado = readFileSync(join(cache, 'vg.json'), 'utf8');
  assert.ok(!guardado.includes(claveLectura), 'ni se guarda en la caché');
  assert.equal(JSON.parse(guardado).sincronia.desde, servidor.almacen.filas('vg').at(-1).orden);
});

test('la configuración acepta url y claveLectura, y también AGRAM_BE_CONFIG', async () => {
  const otra = join(carpeta, 'otra.json');
  writeFileSync(otra, JSON.stringify({ url: servidor.url + '/', eje: 'vg', claveLectura }));
  const r = await new Promise((resolver) => execFile(process.execPath, [BE, 'estado'], { env: { ...process.env, AGRAM_BE_CACHE: cache, AGRAM_BE_CONFIG: otra } }, (e, out, err) => resolver({ codigo: e ? 1 : 0, salida: out, error: err })));
  assert.equal(r.codigo, 0, r.error);
  assert.match(r.salida, /^registros: /m);
  const sin = await be('estado');
  assert.equal(sin.codigo, 1);
  assert.match(sin.error, /falta la configuración/);
});

test('ver: la lectura, la madurez y la carta de texto del registro, por id, por prefijo de 8 caracteres o por su 0', async () => {
  const porId = await conCfg('ver', ids.menu);
  assert.equal(porId.codigo, 0, porId.error);
  for (const parte of ['## lectura', '## madurez', '## carta de texto (tamaño 3)', 'Menú del día', 'tres platos y postre']) assert.ok(porId.salida.includes(parte), parte);
  assert.match(porId.salida, /nivel \d+\/\d+/);
  assert.equal((await conCfg('ver', ids.menu.slice(0, 8))).salida, porId.salida);
  assert.equal((await conCfg('ver', 'Menú del día')).salida, porId.salida);
  const raro = await conCfg('ver', 'noexiste');
  assert.equal(raro.codigo, 1);
  assert.match(raro.error, /no encuentro el registro/);
  const otro = await conCfg('ver', ids.menu, '--como', 'nadie');
  assert.equal(otro.codigo, 1);
  assert.match(otro.error, /no tiene alta/);
});

test('camino y aro: los pasos con su fuente y las acciones por punto de vista, con el nombre canónico y el traducido', async () => {
  const c = await conCfg('camino', cuenta.cuenta.alta.slice(0, 8));
  assert.equal(c.codigo, 0, c.error);
  assert.match(c.salida, /^camino de [0-9a-f]{8} «Víctor» como .+ · 3 pasos/);
  assert.match(c.salida, /^2\. \[tutorial\] hacer: .+\n {5}falta: /m);
  const a = await conCfg('aro', 'Menú del día');
  assert.equal(a.codigo, 0, a.error);
  assert.match(a.salida, /^PV\d:$/m);
  assert.match(a.salida, /^ {2}[*-] anchor here · /m);
});

test('opiniones: fecha, autor, clasificación, el registro opinado, el texto y las respuestas; --nuevas, la segunda vez, vacía', async () => {
  const nuevas1 = await conCfg('opiniones', '--nuevas');
  assert.equal(nuevas1.codigo, 0, nuevas1.error);
  assert.match(nuevas1.salida, /^opiniones en [0-9a-f]{8} «AGRAM»: 1 nuevas \(de 1\)$/m);
  assert.match(nuevas1.salida, new RegExp('^2026-11-10T10:\\d\\d:00Z · ' + cuenta.cuenta.identidad + ' · ' + ids.opinion.slice(0, 8) + '$', 'm'));
  assert.match(nuevas1.salida, /^ {2}clasificación: type: ocupante · pv: 3 · d: 1 · size: tarjeta/m);
  assert.match(nuevas1.salida, new RegExp('^ {2}sobre: ' + ids.menu.slice(0, 8) + ' «Menú del día» · ruta: carta > pv$', 'm'));
  assert.match(nuevas1.salida, /^ {2}texto: el botón del menú es pequeño$/m);
  assert.match(nuevas1.salida, /respuestas \(1\):/);
  assert.match(nuevas1.salida, new RegExp('↳ .+ · ' + ids.respuesta.slice(0, 8) + ' · NUEVA · Lo miro'));
  const nuevas2 = await conCfg('opiniones', '--nuevas');
  assert.match(nuevas2.salida, /: 0 nuevas \(de 1\)$/m);
  assert.ok(!nuevas2.salida.includes('el botón del menú'));
  // Sin --nuevas se listan todas, y el proyecto puede darse por su 0 o por su id.
  const todas = await conCfg('opiniones', ids.agram.slice(0, 8));
  assert.match(todas.salida, /: 1$/m);
  assert.ok(todas.salida.includes('el botón del menú es pequeño'));
  // Una opinión nueva (y solo ella) sale con --nuevas: otra, anclada desde el mismo eje compartido.
  const yo = cuenta.cuenta.identidad;
  const tx = await acciones.transaccion(cuenta.eje, 'anchor here', { X: ids.opinion, title: 'Otra respuesta', content: 'segunda' }, yo, { t: T(30), firmar: Q.firmarCon(cuenta.privada) });
  assert.equal(tx.ok, true, JSON.stringify(tx.motivos));
  await cuenta.eje.anadir(tx.evento);
  const S = new sincronia.Sincronia({ url: servidor.url, eje: 'vg', claveLectura });
  assert.deepEqual((await S.sincronizar(cuenta.eje, { bajar: false })).errores, []);
  const nuevas3 = await conCfg('opiniones', '--nuevas');
  assert.match(nuevas3.salida, /: 1 nuevas \(de 1\)$/m);
  assert.match(nuevas3.salida, /· NUEVA · Otra respuesta$/m);
  assert.ok(!nuevas3.salida.includes(ids.respuesta.slice(0, 8) + ' · NUEVA'));
  assert.match((await conCfg('estado')).salida, new RegExp('^registros: ' + cuenta.eje.orden.length + '$', 'm'), 'la segunda llamada bajó solo lo nuevo');
});

test('buscar, diario y contexto', async () => {
  const b = await conCfg('buscar', 'tres platos');
  assert.equal(b.codigo, 0, b.error);
  assert.match(b.salida, /^1 registros con «tres platos»$/m);
  assert.match(b.salida, new RegExp('^' + ids.menu.slice(0, 8) + ' · .+ · 0: «Menú del día»$', 'm'));
  assert.match((await conCfg('buscar', 'AGRAM')).salida, new RegExp('^' + ids.agram.slice(0, 8), 'm'));
  assert.match((await conCfg('buscar', 'zzzz-no-existe')).salida, /^0 registros/);
  const d = await conCfg('diario', '--cuantos', '2');
  assert.match(d.salida, /^diario: 2 entradas de \d+/);
  assert.equal((d.salida.match(/^#\d+ · orden \d+/gm) ?? []).length, 2);
  const c = await conCfg('contexto', ids.menu.slice(0, 8));
  assert.equal(c.codigo, 0, c.error);
  assert.ok(c.salida.includes('foco: ' + ids.menu.slice(0, 8)));
  assert.ok(c.salida.includes('tres platos y postre'));
});

test('errores del servidor tal cual: clave de lectura mala (401) y eje que no existe (404)', async () => {
  const mala = join(carpeta, 'mala.json');
  writeFileSync(mala, JSON.stringify({ sync_url: servidor.url, eje: 'vg', clave_lectura: 'no-es-la-clave' }));
  const r401 = await be('estado', '--config', mala);
  assert.equal(r401.codigo, 1);
  assert.match(r401.error, /servidor 401/);
  const nada = join(carpeta, 'nada.json');
  writeFileSync(nada, JSON.stringify({ sync_url: servidor.url, eje: 'no-existe', clave_lectura: claveLectura }));
  const r404 = await be('estado', '--config', nada);
  assert.equal(r404.codigo, 1);
  assert.match(r404.error, /servidor 404/);
});

test('sin red: lee la caché y lo dice; sin caché, lo dice y falla', async () => {
  await servidor.cerrar();
  const r = await conCfg('estado');
  assert.equal(r.codigo, 0, r.error);
  assert.match(r.salida, /^\(sin red: leo la caché \(.+, hasta el orden \d+\)\)$/m);
  assert.match(r.salida, new RegExp('^registros: ' + cuenta.eje.orden.length + '$', 'm'));
  assert.match((await conCfg('ver', ids.menu.slice(0, 8))).salida, /tres platos y postre/);
  const otra = join(carpeta, 'otra-cache');
  const r2 = await new Promise((resolver) => execFile(process.execPath, [BE, 'estado', '--config', cfg], { env: { ...process.env, AGRAM_BE_CACHE: otra } }, (e, out, err) => resolver({ codigo: e ? 1 : 0, error: err })));
  assert.equal(r2.codigo, 1);
  assert.match(r2.error, /sin red y sin caché/);
  servidor = await arrancar({ puerto: 0, secreto: 'prueba' }); // para que after() cierre algo
});
