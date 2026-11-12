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
import { acciones, salida, sincronia, autoridad, motor, elegibles as EL, direccion } from '../src/index.js';
import * as C2 from '../src/contrato.js';
import { ContextoEje } from '../src/contexto-eje.js';
import { EPOCA_0_BTML } from '../src/epocas.js';
import { evaluar } from '../src/bqlm.js';
import * as C from '../carta/carta.js';
import * as Q from '../carta/cuentas.js';
import * as G from '../carta/guia.js';
import * as X from '../carta/externa.js';
import { nuevaOpinion } from '../carta/opinar.js';
import { ejemploCompra } from '../ejemplos/ikisai/compra-food.mjs';
import { entrarPorInvitacion } from '../ejemplos/ikisai/altas.mjs';
import { costeT } from '../src/escritura.js';

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

// ---------- Core escribe (encargo core-escribe, VG 11-11): su identidad «cosa», su alta y sus propuestas ----------

let cfgCore; // la configuración de Core: la misma de lectura, más su identidad
let core; // { nombre, publica, privada } (de su configuración, para comprobar; no se imprime)
let propuestaIkisai;
const sincronizarVG = async () => {
  const S = new sincronia.Sincronia({ url: servidor.url, eje: 'vg', claveLectura });
  const informe = await S.sincronizar(cuenta.eje);
  assert.deepEqual([informe.pendientes, informe.errores, S.rechazados], [[], [], []]);
  return informe;
};

test('identidad --crear: el par de claves de Core en su configuración (nunca se imprime) y la petición de alta; sin alta no escribe', async () => {
  cfgCore = join(carpeta, 'core.json');
  writeFileSync(cfgCore, JSON.stringify({ sync_url: servidor.url, eje: 'vg', clave_lectura: claveLectura }));
  // La T de una cosa no tiene defecto (VG, 12-11, #46): sin --minutos la petición no pasa (lo dice), con --pedir se rehace.
  const sinMinutos = await be('identidad', '--crear', '--config', cfgCore);
  assert.equal(sinMinutos.codigo, 1);
  assert.match(sinMinutos.error, /la petición de alta no pasaría las reglas:[\s\S]*minut/);
  const r = await be('identidad', '--pedir', '--minutos', '60', '--config', cfgCore);
  assert.equal(r.codigo, 0, r.error);
  core = JSON.parse(readFileSync(cfgCore, 'utf8')).identidad;
  assert.equal(core.nombre, 'core');
  assert.equal(autoridad.publicaDe(core.privada), core.publica, 'la privada es la pareja de la pública');
  assert.match(r.salida, /^identidad de Core: core · clave [0-9a-f]{8}…/m);
  assert.match(r.salida, /^alta: aún no$/m);
  assert.ok(!r.salida.includes(core.privada) && !r.salida.includes(core.publica), 'ni la privada ni la pública enteras se imprimen');
  assert.ok(!r.salida.includes(claveLectura));
  // La petición: una propuesta del formato de la guía (carta/externa.js), la plantilla «register a thing» sobre el alta de VG, con su instante.
  const ruta = join(carpeta, 'peticion-alta-core.json');
  assert.ok(r.salida.includes('petición de alta: ' + ruta), r.salida);
  const p = JSON.parse(readFileSync(ruta, 'utf8'));
  assert.equal(p.propuestas.length, 1);
  const [una] = p.propuestas;
  assert.deepEqual([una.accion, una.sobre, una.parametros.thing, una.parametros.key, una.parametros.minutes], ['register a thing', cuenta.cuenta.alta, 'core', core.publica, 60]);
  assert.match(una.parametros.proof, /^[0-9a-f]{128}$/);
  assert.match(una.t, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  assert.ok(!JSON.stringify(p).includes(core.privada));
  // No se pisa una clave; sin alta no se escribe.
  const otra = await be('identidad', '--crear', '--config', cfgCore);
  assert.equal(otra.codigo, 1);
  assert.match(otra.error, /ya tiene identidad/);
  const sinAlta = await be('proponer', 'Ikisai', '--config', cfgCore);
  assert.equal(sinAlta.codigo, 1);
  assert.match(sinAlta.error, /«core» aún no tiene alta en este eje/);
});

test('VG da de alta a Core desde la carta: importa la petición y la acepta (con su instante); Core es una cosa de VG con su clave y su T', async () => {
  await sincronizarVG();
  const yo = cuenta.cuenta.identidad;
  const firmar = Q.firmarCon(cuenta.privada);
  const r = X.importar(readFileSync(join(carpeta, 'peticion-alta-core.json'), 'utf8'));
  assert.equal(r.ok, true, r.motivo);
  const e = X.evaluar(cuenta.eje, yo, r.propuestas[0]);
  assert.equal(e.valida, true, e.motivo);
  assert.deepEqual([e.accion, e.sobre, e.t], ['register a thing', cuenta.cuenta.alta, r.propuestas[0].t]);
  // En el camino del alta de VG es un paso de la tercera fuente que pasa (con su instante: la prueba firma ese id).
  const { pasos } = await acciones.camino(cuenta.eje, cuenta.cuenta.alta, yo, { sugerencias: X.sugerenciasDe(r.propuestas), firmar });
  const paso = pasos.find((x) => x.fuente === 'sugerencia');
  assert.deepEqual([paso.hacer.plantilla, paso.pasa], ['register a thing', true], JSON.stringify(paso.motivos));
  // Sin su instante el id cambia y la prueba de posesión no vale: lo dicen las reglas.
  const sinT = await C.enviar(cuenta.eje, e.sobre, e.accion, e.parametros, yo, firmar);
  assert.equal(sinT.ok, false);
  assert.match(sinT.motivos.map((m) => m.mensaje).join('; '), /posesión/);
  // Aceptar, como la carta (app.js, propuesta('aceptar')): acciones.transaccion con la firma de VG y el instante de la petición.
  const ok = await C.enviar(cuenta.eje, e.sobre, e.accion, e.parametros, yo, firmar, { t: e.t });
  assert.equal(ok.ok, true, JSON.stringify(ok.motivos));
  const alta = ok.asentado;
  assert.deepEqual([alta.autor, alta.firmante, alta.sobre, alta.en, alta.contexto.claves.core], [yo, yo, cuenta.cuenta.alta, '1400000000', core.publica]);
  assert.match(alta.posesion.core, /^[0-9a-f]{128}$/);
  assert.equal(cuenta.eje.esPersona('core'), false, 'una cosa: su alta la escribió VG');
  assert.equal(cuenta.eje.clave('core'), core.publica);
  assert.equal(cuenta.eje.saldoT('core', 'minuto'), 60);
  await sincronizarVG();
  // Be la ve: alta, quién la escribió, su T, el proyecto de VG y aún nada escrito en lo ajeno.
  const v = await be('identidad', '--config', cfgCore);
  assert.equal(v.codigo, 0, v.error);
  assert.match(v.salida, new RegExp('^alta: ' + alta.id.slice(0, 8) + ' · la escribió ' + yo + ' \\(es una cosa suya\\)', 'm'));
  assert.match(v.salida, /^T de minuto: 60$/m);
  assert.match(v.salida, new RegExp('^proyecto de VG: ' + ids.agram.slice(0, 8) + ' «AGRAM»$', 'm'));
  assert.match(v.salida, /^escrito en lo ajeno: 0$/m);
});

test('proponer: Core escribe una propuesta firmada en la fábrica del proyecto de VG; por la regla general queda pendiente hasta que el criterio de VG la admite', async () => {
  const r = await be('proponer', 'Ikisai', '--valores', JSON.stringify({ content: 'el ecosistema de apps' }), '--config', cfgCore);
  assert.equal(r.codigo, 0, r.error);
  assert.match(r.salida, /^propuesta: [0-9a-f]{8} «Ikisai» en la fábrica de [0-9a-f]{8} «AGRAM» · por core$/m);
  assert.match(r.salida, new RegExp('^estado: pendiente: ' + cuenta.cuenta.identidad + ' no lo ha aceptado$', 'm'));
  assert.match(r.salida, /^subido al eje compartido: 1 registro$/m);
  // VG lo baja: el registro es de Core, firmado por Core, con las reglas enteras (sincronizar valida cada evento).
  await sincronizarVG();
  const yo = cuenta.cuenta.identidad;
  const eje = cuenta.eje;
  propuestaIkisai = eje.sobre(ids.agram, motor.FABRICA).find((e) => e.autor === 'core');
  assert.ok(propuestaIkisai, 'la propuesta de Core cuelga de la fábrica (el 4) del proyecto');
  assert.deepEqual([propuestaIkisai.firmante, propuestaIkisai.payload[0], propuestaIkisai.payload[1], propuestaIkisai.payload[3], propuestaIkisai.payload[4]], ['core', ['Ikisai'], ['el ecosistema de apps'], ['core', yo], ['propose']]);
  // La regla general (R8): ocupa la fábrica del proyecto, pero no entra en lo de VG (no es elegible) hasta que VG lo admite.
  assert.equal(EL.elegibles(eje, ids.agram).autores.has('core'), false);
  assert.ok(EL.ocupantesElegibles(eje, ids.agram, [4]).noElegibles >= 1);
  // VG la acepta con el mecanismo general: nombra a «core» en el 2.3 del proyecto («criterio · con quién»), una corrección
  // suya que src/elegibles.js ya lee. Admite lo que core escriba sobre ese registro (preacepta), no una propuesta suelta.
  await salida.escribirDesde(eje, { modo: 'sequenced', autor: yo, sobre: ids.agram, en: direccion([2, 3]), payload: ['core'], t: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z') }, cuenta.privada);
  assert.equal(EL.elegibles(eje, ids.agram).autores.has('core'), true);
  await sincronizarVG();
  const v = await be('identidad', '--config', cfgCore);
  assert.match(v.salida, /^escrito en lo ajeno: 1$/m);
  assert.match(v.salida, new RegExp('^  ' + propuestaIkisai.id.slice(0, 8) + ' «Ikisai» sobre ' + ids.agram.slice(0, 8) + ' «AGRAM» en 4000000000 · aceptado \\(' + yo + ' admite a core en el 2.3\\)$', 'm'));
  // El coste de escribir (VG 12-11, decisión 7): la regla de la época, un minuto por posición de la propuesta.
  const coste = propuestaIkisai.movimientos.find((m) => m.token === 'T' && m.de === 'core' && m.a === null).cantidad;
  assert.equal(coste, costeT(propuestaIkisai.payload));
  assert.match(v.salida, new RegExp('^T de minuto: ' + (60 - coste) + '$', 'm'), 'la propuesta le cuesta lo que exige de lo que le dio VG');
});

test('dónde se ve Core en lo de VG: su alta en el 1.4 del alta de VG, su propuesta en el 4 del proyecto y su nombre en el 2.3; hoy no en el grupo «equipo» (3.4)', () => {
  const eje = cuenta.eje;
  const altaCore = eje.alta('core').id;
  // 1.4 (recursos × fábrica: lo que se hace con los recursos, quién actúa): el alta de Core, que VG escribió ahí.
  assert.deepEqual(C2.ocupantes(eje, cuenta.cuenta.alta, '1.4').ocupantes, [{ ref: altaCore }]);
  // El 4 del proyecto: la propuesta de Core, con su autor.
  assert.ok(C2.ocupantes(eje, ids.agram, 4).ocupantes.some((o) => o.ref === propuestaIkisai.id));
  // El 2 del proyecto: el criterio de VG que admite a Core (su 2.3, «con quién»).
  assert.ok(C2.ocupantes(eje, ids.agram, '2.3').ocupantes.some((o) => o.ref && JSON.stringify(eje.obtener(o.ref).payload) === '["core"]'));
  // Lo que el núcleo no coloca solo (se apunta, no se fuerza): Core no está en el grupo «equipo» (zona 4) de la atención
  // de VG: eso lo pone VG anclando en el 3.4.3 de su alta.
  const ctx = new ContextoEje(eje, { epoch: EPOCA_0_BTML, me: cuenta.cuenta.identidad });
  const r = evaluar('=count (nth 4 ("' + cuenta.cuenta.identidad + '").3).3', ctx, {});
  assert.deepEqual([r.estado, r.valor], ['RESUELTO', [0]]);
});

test('escribir: una acción del aro con --valores y un payload BTML con --archivo, firmados por Core; en lo suyo, en lo aceptado y en lo no aceptado, por la misma regla', async () => {
  const yo = cuenta.cuenta.identidad;
  const nota = await be('escribir', 'anchor here', '--sobre', propuestaIkisai.id.slice(0, 8), '--valores', JSON.stringify({ título: 'Nota de Core', content: 'el detalle' }), '--config', cfgCore);
  assert.equal(nota.codigo, 0, nota.error);
  assert.match(nota.salida, new RegExp('^escrito: [0-9a-f]{8} «Nota de Core» · anchor here · por core · sobre ' + propuestaIkisai.id.slice(0, 8)));
  assert.match(nota.salida, /^estado: en lo suyo$/m);
  assert.match(nota.salida, /^subido al eje compartido: 1 registro$/m);
  const archivo = join(carpeta, 'payload.json');
  writeFileSync(archivo, JSON.stringify(['Idea de Core', 'escrita como un formulario']));
  const libre = await be('escribir', '--archivo', archivo, '--sobre', 'AGRAM', '--en', '6', '--config', cfgCore);
  assert.equal(libre.codigo, 0, libre.error);
  assert.match(libre.salida, /^escrito: [0-9a-f]{8} «Idea de Core» · payload \(sequenced\) · por core · sobre [0-9a-f]{8} «AGRAM» en 6000000000$/m);
  assert.match(libre.salida, new RegExp('^estado: aceptado \\(' + yo + ' admite a core en el 2.3\\)$', 'm'));
  // En un registro de VG que no admite a Core (el menú): se escribe igual, pero queda pendiente.
  const menu = await be('escribir', 'anchor here', '--sobre', ids.menu.slice(0, 8), '--valores', JSON.stringify({ title: 'Sugerencia de Core' }), '--config', cfgCore);
  assert.equal(menu.codigo, 0, menu.error);
  assert.match(menu.salida, new RegExp('^estado: pendiente: ' + yo + ' no lo ha aceptado$', 'm'));
  const conEn = await be('escribir', 'anchor here', '--sobre', 'AGRAM', '--en', '1', '--config', cfgCore);
  assert.equal(conEn.codigo, 1);
  assert.match(conEn.error, /--en solo va con --archivo/);
  const raro = await be('escribir', 'anchor here', '--sobre', 'AGRAM', '--valores', JSON.stringify({ nada: 1 }), '--config', cfgCore);
  assert.equal(raro.codigo, 1);
  assert.match(raro.error, /«nada» no es un parámetro de «anchor here»/);
  // VG lo baja con las reglas enteras: todo de Core, firmado por Core.
  await sincronizarVG();
  const deCore = cuenta.eje.orden.map((id) => cuenta.eje.obtener(id)).filter((e) => e.autor === 'core');
  assert.equal(deCore.length, 4);
  assert.ok(deCore.every((e) => e.firmante === 'core'));
  assert.equal(servidor.almacen.filas('vg').length, cuenta.eje.orden.length);
  assert.equal((await conCfg('estado')).codigo, 0); // la caché de lectura al día para la prueba sin red
});

test('admitir es darle R (encargo equipo, VG 11-11 noche): pendientes lista lo que falta; «admit someone» sobre el registro lo admite por la regla general (el 3); dar R por UN escrito aún no lo acepta; y lo que derivan las lecturas sin anclarlo (1.3, 1.3.4, 1.4, 3.4)', async () => {
  const yo = cuenta.cuenta.identidad;
  const eje = cuenta.eje;
  const firmar = Q.firmarCon(cuenta.privada);
  // Lo pendiente de Core, por registro: la sugerencia en el menú de VG (lo del proyecto ya lo admite su 2.3).
  const p = await be('pendientes', '--config', cfgCore);
  assert.equal(p.codigo, 0, p.error);
  assert.match(p.salida, /^pendiente de aceptación: 1 escrito en 1 registro$/m);
  assert.match(p.salida, new RegExp('^' + ids.menu.slice(0, 8) + ' «Menú del día» · de ' + yo + ' · 1$', 'm'));
  assert.match(p.salida, /^  [0-9a-f]{8} «Sugerencia de Core» en 0000000000 · \d{4}-/m);
  const sugerencia = eje.sobre(ids.menu).find((e) => e.autor === 'core');
  assert.ok(sugerencia);
  // Aceptar UN escrito dándole R por ese trabajo: «give own R» sobre el escrito ya existe (PV3) y mueve R de VG a Core,
  // pero la regla de elegibles (R8) no lo lee: el escrito sigue pendiente (lo que falta, en CONTRATO §12.2 y en el informe).
  assert.ok(acciones.acciones(eje, sugerencia.id, 3, yo).some((a) => a.nombre === 'give own R'));
  const dar = await C.enviar(eje, sugerencia.id, 'give own R', { amount: 1 }, yo, firmar);
  assert.equal(dar.ok, true, JSON.stringify(dar.motivos));
  assert.equal(eje.saldo('core', 'R:' + yo), 1);
  assert.equal(EL.elegibles(eje, ids.menu).autores.has('core'), false, 'dar R por un escrito aún no lo acepta');
  // «admit someone» (PV3 de un registro mío): a quién, con las identidades del eje como opciones (como las pide la carta).
  const admitir = acciones.acciones(eje, ids.menu, 3, yo).find((a) => a.nombre === 'admit someone');
  assert.ok(admitir, 'el aro de VG ofrece «admit someone» en el 3 de su menú');
  const whom = admitir.parametros.find((x) => x.nombre === 'whom');
  assert.equal(whom.falta, true);
  assert.ok(C2.opciones(eje, ids.menu, null, { yo, parametro: whom }).some((o) => o.valor === 'core'));
  assert.equal(acciones.acciones(eje, ids.menu, 3, 'core').some((a) => a.nombre === 'admit someone'), false, 'solo el dueño admite en lo suyo');
  // Admitir es un intercambio de tokens: R de VG para Core (la comunicación) y T (el trabajo; a una cosa suya, que la regla
  // «T only goes to things» deja), y ancla en el 3 del registro, «con quién», como «give own R».
  const minutos = eje.saldoT('core', 'minuto');
  const ad = await C.enviar(eje, ids.menu, 'admit someone', { whom: 'core', minutes: 5 }, yo, firmar);
  assert.equal(ad.ok, true, JSON.stringify(ad.motivos));
  // (la R que le falta en mano la acuña antes, como «give own R»: la dio entera por la sugerencia)
  assert.deepEqual(ad.asentado.movimientos.map((m) => [m.token, m.cantidad, m.de, m.a]), [['T', costeT(ad.asentado.payload), yo, null], ['R', 1, null, yo], ['R', 1, yo, 'core'], ['T', 5, yo, 'core']]); // el coste de escribir, por posición (VG 12-11, decisión 7)
  assert.deepEqual([ad.asentado.sobre, ad.asentado.en, ad.asentado.payload[3]], [ids.menu, '3000000000', [[yo], ['core']]]);
  assert.deepEqual([eje.saldo('core', 'R:' + yo), eje.saldoT('core', 'minuto')], [2, minutos + 5]);
  // A una persona no se le da T: lo dicen las reglas, no la plantilla.
  const persona = await acciones.transaccion(eje, 'admit someone', { X: ids.menu, whom: yo, minutes: 1 }, yo, { firmar });
  assert.equal(persona.ok, false, 'ni a sí mismo');
  // La regla general (R8) ya lo lee: lo que el dueño nombra en el 3 del registro (sin lista en su 2.3) admite a su autor.
  const el = EL.elegibles(eje, ids.menu);
  assert.deepEqual([el.autores.has('core'), el.origen], [true, 'defecto']);
  await sincronizarVG();
  const q = await be('pendientes', '--config', cfgCore);
  assert.match(q.salida, /^pendiente de aceptación: 0 escritos en 0 registros$/m);
  const v = await be('identidad', '--config', cfgCore);
  assert.ok(v.salida.split('\n').some((l) => l.includes('«Sugerencia de Core» sobre ' + ids.menu.slice(0, 8)) && l.endsWith('· aceptado (' + yo + ' admite a core en su 3)')), v.salida);
  // Lo anclado no cambia (no se fuerza con anclas): Core no está anclado en el 1.3 (ni el 1.3.4) del alta de VG, ni sus
  // trabajos en el 1.4 ni en el 4 del menú, ni Core en el grupo «equipo» (3.4) de la atención de VG (contrato.ocupantes).
  const nombra = (lista, quien) => lista.some((o) => o === quien || (o?.ref && JSON.stringify(eje.obtener(o.ref)?.payload ?? '').includes('"' + quien + '"')));
  const alta = cuenta.cuenta.alta;
  assert.equal(nombra(C2.ocupantes(eje, alta, '1.3').ocupantes, 'core'), false, '1.3 del alta de VG: hoy no');
  assert.equal(nombra(C2.ocupantes(eje, alta, '1.3.4').ocupantes, 'core'), false, '1.3.4: hoy no');
  assert.equal(C2.ocupantes(eje, ids.menu, '1.4').ocupantes.some((o) => o?.ref === sugerencia.id), false, '1.4 del menú: hoy no');
  assert.equal(C2.ocupantes(eje, ids.menu, 4).ocupantes.some((o) => o?.ref === sugerencia.id), false, '4 del menú: hoy no');
  const ctx = new ContextoEje(eje, { epoch: EPOCA_0_BTML, me: yo });
  assert.deepEqual(evaluar('=count (nth 4 ("' + yo + '").3).3', ctx, {}).valor, [0], 'el grupo «equipo» (3.4): hoy no');
  // Lo derivan de esos movimientos las lecturas de los puntos de vista (encargo «lecturas», issue #12: contrato.leerRuta).
  assert.ok(C2.leerRuta(eje, alta, [1, 3]).derivado.some((x) => x.valor === 'core'), '1.3 del alta de VG: derivado');
  assert.ok(C2.leerRuta(eje, alta, [1, 3, 4]).derivado.some((x) => x.valor === 'core'), '1.3.4: derivado');
  assert.ok(C2.leerRuta(eje, ids.menu, [1, 4]).derivado.some((x) => x.valor?.ref === sugerencia.id), '1.4 del menú: derivado');
  assert.ok(C2.leer(eje, ids.menu, 4).derivado.some((x) => x.valor?.ref === sugerencia.id), '4 del menú: derivado');
  assert.ok(C2.leerRuta(eje, alta, [3, 4]).derivado.some((x) => x.valor === 'core'), '3.4: derivado');
  // Sí está, por lo que mueve: Core tiene R de VG (la lente de quien la mire) y T que le dio VG.
  assert.equal(eje.saldo('core', 'R:' + yo), 2);
});

test('el 3 por tema (encargo pv3, VG 11/12-11): Core admitido con R y T está en el 3.4; con R sola, en el 3.3; un desconocido con su R, en el 3.0; admitir en un registro admite en lo que cuelga; quitar lo saca; vetar gana', async () => {
  const yo = cuenta.cuenta.identidad;
  const eje = cuenta.eje;
  const firmar = Q.firmarCon(cuenta.privada);
  const alta = cuenta.cuenta.alta;
  const cajaDe = (X, quien) => C2.gruposDelTres(eje, X).find((c) => c.personas.some((p) => p.identidad === quien))?.caja ?? null;
  // Admitido en el menú con R y 5 minutos de T (la prueba de antes): en el 3 del alta de VG y en el del menú, la caja 4.
  assert.equal(cajaDe(alta, 'core'), 4);
  assert.equal(cajaDe(ids.menu, 'core'), 4);
  const core4 = C2.gruposDelTres(eje, alta)[4].personas.find((p) => p.identidad === 'core');
  assert.deepEqual([core4.doy, core4.recibo, core4.porque], [eje.saldo('core', 'R:' + yo), 0, 'tema']);
  // Admitido en AGRAM con R sola (sin T): mirado desde AGRAM (el elemento en foco filtra), la caja 3, cercanos.
  const soloR = await C.enviar(eje, ids.agram, 'admit someone', { whom: 'core', amount: 1, minutes: 0 }, yo, firmar);
  assert.equal(soloR.ok, true, JSON.stringify(soloR.motivos));
  assert.equal(soloR.asentado.en, '3000000000');
  assert.ok(!soloR.asentado.movimientos.some((m) => m.token === 'T' && m.a === 'core'), 'sin T para Core');
  assert.equal(cajaDe(ids.agram, 'core'), 3);
  // La admisión baja por el árbol: un registro de VG bajo el menú admite a Core sin nombrarlo (subiendo por «sobre»).
  const plato = await acciones.transaccion(eje, 'anchor here', { X: ids.menu, title: 'Plato del día' }, yo, { firmar });
  assert.equal(plato.ok, true, JSON.stringify(plato.motivos));
  const platoId = (await eje.anadir(plato.evento)).id;
  const el = EL.elegibles(eje, platoId);
  assert.deepEqual([el.autores.has('core'), el.heredados.has('core')], [true, true]);
  // Quitar a Core del menú (la corrección del dueño en el mismo sitio, «remove someone»): ni en el menú ni en lo de debajo;
  // y la lectura del 3 ya no lo coloca por esa admisión (en el menú queda por la R que VG le dio por su sugerencia: 3.3).
  const quitar = await C.enviar(eje, ids.menu, 'remove someone', { whom: 'core' }, yo, firmar);
  assert.equal(quitar.ok, true, JSON.stringify(quitar.motivos));
  assert.deepEqual([EL.elegibles(eje, ids.menu).autores.has('core'), EL.elegibles(eje, platoId).autores.has('core')], [false, false]);
  assert.equal(cajaDe(ids.menu, 'core'), 3);
  // Vetar gana sobre cualquier R: Core sigue en el 2.3 de AGRAM y con R de VG, pero vetado no es elegible y está en el 3.5.
  const veto = await C.enviar(eje, eje.alta('core').id, 'veto someone', {}, yo, firmar);
  assert.equal(veto.ok, true, JSON.stringify(veto.motivos));
  assert.deepEqual([veto.asentado.sobre, veto.asentado.en], [alta, '3530000000']);
  assert.equal(EL.elegibles(eje, ids.agram).autores.has('core'), false, 'el veto gana sobre la lista del 2.3');
  assert.equal(cajaDe(alta, 'core'), 5);
  // Un desconocido con su R, en el 3.0 (un libro aparte: una persona a la que invitó otra escribe a la casa con su R).
  const { eje: e2 } = await ejemploCompra();
  await entrarPorInvitacion(e2, { por: 'huesped', quien: 'ana', t: '2026-11-08T10:00:00Z' });
  const escrito = await acciones.transaccion(e2, 'write to X', { X: e2.alta('casa').id, text: 'hola, casa' }, 'ana', { t: '2026-11-08T10:01:00Z' });
  assert.equal(escrito.ok, true, JSON.stringify(escrito.motivos));
  await e2.anadir(escrito.evento);
  const ana = C2.gruposDelTres(e2, e2.alta('casa').id)[0].personas.find((p) => p.identidad === 'ana');
  assert.deepEqual([ana.caja, ana.recibo, ana.doy, ana.porque], [0, 1, 0, 'bandeja']);
  // Lo escrito aquí sube al eje compartido, y la caché de lectura de Be se pone al día (para la prueba sin red).
  await sincronizarVG();
  assert.equal((await conCfg('estado')).codigo, 0);
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
