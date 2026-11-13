// El PERSONAJE es la configuración del sitio (VG, 12-11, issue #38): cada cuadrante (un PV de la 3 × 3, la pantalla completa
// de un PV con sus sub-PV, una fila de Sequenced) tiene su responsable: en animado el muñeco, en sobrio el interrogante en
// el MISMO botón; pulsarlo abre la cruceta del propio nodo X.<lugar> (acciones.sitio). La barra superior desaparece: lo que
// hacía es el personaje del 0 (el 0 de mi alta) con las opciones como posiciones de su cruceta, y arriba de la columna de
// Sequenced. Aquí, el DOM de cada cuadrante y que cada acción de la barra tiene su sitio nuevo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { arbol, preferencias, escalaDeTamanos, LATERALES, NIVEL } from '../carta/carta.js';
import { html } from '../carta/dom.js';
import { instalar } from '../carta/gestos.js';
import { ejemploCompra } from '../ejemplos/ikisai/compra-food.mjs';
import { pagaElCoste } from './ayudas-coste.js';

const T1 = '2026-11-08T10:00:00Z';
const ORDENADOR = { ancho: 1200, alto: 800 };
const GRANDE = { ancho: 1920, alto: 1080 };
const MOVIL = { ancho: 400, alto: 700 };
const MUNDOS = [1, 2, 3, 4, 6, 7, 8, 9];
const minuto = (de) => pagaElCoste(de);
const CSS = readFileSync(new URL('../carta/estilo.css', import.meta.url), 'utf8');
const APP = readFileSync(new URL('../carta/app.js', import.meta.url), 'utf8');

/** Los botones de sitio de un HTML: [{ lugar, x, general, muneco }] por orden. */
function sitios(h) {
  return [...h.matchAll(/<button type="button" class="sitio-interrogante[^"]*"[^>]*data-sitio="([\d.]+)" data-sitio-x="([0-9a-f]{64})"( data-sitio-general)?[^>]*>\?((?:<span class="capa capa-sitio"[^]*?<\/span>)?)<\/button>/g)]
    .map((m) => ({ lugar: m[1], x: m[2], general: Boolean(m[3]), muneco: m[4] !== '' }));
}

/** La huésped en animado con el modelo de la fase 2 (general). */
async function animado(eje, quien = 'huesped') {
  const p = preferencias(eje, quien, { render: 'animated', model: 'general' });
  await eje.escribir({ autor: quien, sobre: p.sobre, en: p.en, t: T1, movimientos: [minuto(quien)], payload: p.payload });
}

const abiertaCero = (eje, X, extra = {}) => ({ foco: { X, pv: 0 }, sitio: { X: eje.alta('huesped').id, lugar: '0', general: true }, ...extra });

test('Mapped, la 3 × 3: cada uno de los ocho PV lleva su interrogante en la cabecera (el nodo X.<pv>), y el foco el del 0 de mi alta', async () => {
  const { eje, compra } = await ejemploCompra();
  const tope = escalaDeTamanos().tope;
  const a = await arbol({ foco: { X: compra.id, pv: 0 }, niveles: Object.fromEntries(LATERALES.map((pv) => [pv, tope])) }, eje, 'huesped', GRANDE);
  const altaYo = eje.alta('huesped').id;
  const h = html(a);
  for (const n of a.laterales) {
    assert.deepEqual(n.sitio, { X: compra.id, lugar: String(n.pv) }, 'el sitio del PV ' + n.pv);
    assert.match(h, new RegExp(`<header class="pv-cabeza">(?:(?!</header>)[^])*<button type="button" class="sitio-interrogante"[^>]*data-sitio="${n.pv}" data-sitio-x="${compra.id}"`), 'en la cabecera del ' + n.pv);
  }
  // un botón por PV (y, dentro de los PV en bloque, uno por sub-PV: X.<pv>.<dígito>)
  assert.deepEqual(sitios(h).filter((s) => !s.general && !s.lugar.includes('.')).map((s) => s.lugar).sort(), LATERALES.map(String).sort(), 'ni uno más ni uno menos');
  assert.ok(sitios(h).some((s) => /^\d\.\d$/.test(s.lugar)), 'y los sub-PV de los PV en bloque');
  // el del 0: la configuración general, el 0 de MI alta (no el del foco)
  assert.deepEqual(a.centro.sitio, { X: altaYo, lugar: '0', general: true });
  assert.deepEqual(sitios(h).filter((s) => s.general), [{ lugar: '0', x: altaYo, general: true, muneco: false }]);
  assert.match(h, /<header class="nucleo-cabeza">(?:(?!<\/header>)[^])*class="sitio-interrogante sitio-centro"/, 'en la cabecera del foco');
  assert.doesNotMatch(h, /class="barra|data-menu|data-quien|data-config|data-reiniciar|data-preferencia/, 'sin barra y sin sus controles fuera de la cruceta del 0');
});

test('Mapped, la pantalla completa de cada PV: el interrogante del PV en la cabecera y uno por cada celda (sub-PV) de su rejilla, en el nodo X.<pv>.<dígito>', async () => {
  const { eje, compra } = await ejemploCompra();
  for (const pv of MUNDOS) {
    const a = await arbol({ foco: { X: compra.id, pv } }, eje, 'huesped', GRANDE);
    const r = a.centro.rejilla;
    const h = html(a);
    const s = sitios(h);
    assert.deepEqual(a.centro.sitio, { X: compra.id, lugar: String(pv) });
    assert.ok(s.some((x) => x.lugar === String(pv) && x.x === compra.id), 'el sitio del PV ' + pv);
    for (const c of r.celdas ?? []) {
      if (!c.sitio) continue;
      assert.equal(c.sitio.lugar, `${pv}.${c.pv}`, `el sitio de la celda ${c.pv} del ${pv}`);
      assert.ok(s.some((x) => x.lugar === c.sitio.lugar && x.x === c.sitio.X), `el botón de la celda ${pv}.${c.pv}`);
    }
    // (la matriz del 4 es otra cosa: sus celdas son oficio × ejecución, no sub-PV, y su botón es de otro encargo)
    if (r.celdas?.length && r.forma !== 'matriz' && !r.celdas.some((c) => c.sitio)) assert.fail('las celdas del ' + pv + ' no traen su sitio');
  }
  // las cajas del 3 también (con su botón de doy/recibo/todos al lado)
  const tres = html(await arbol({ foco: { X: compra.id, pv: 3 } }, eje, 'huesped', GRANDE));
  for (let d = 0; d <= 5; d++) assert.match(tres, new RegExp(`data-sitio="3.${d}" data-sitio-x="${compra.id}"`));
});

test('Sequenced: cada fila de la tarjeta (los diez dígitos) lleva su interrogante junto a su cabeza y, arriba de la columna, el personaje del 0 en lugar de la barra', async () => {
  const { eje, compra } = await ejemploCompra();
  const a = await arbol({ foco: { X: compra.id, pv: 0 } }, eje, 'huesped', MOVIL);
  const altaYo = eje.alta('huesped').id;
  const h = html(a);
  assert.deepEqual(a.secuencia.filas.map((f) => f.sitio.lugar), ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
  for (const f of a.secuencia.filas) {
    assert.match(h, new RegExp(`<li class="fila[^"]*"[^>]*data-fila-pv="${f.pv}">(?:(?!</li>)[^])*?<button type="button" class="sitio-interrogante sitio-fila"[^>]*data-sitio="${f.pv}" data-sitio-x="${compra.id}"`), 'la fila ' + f.pv);
  }
  // arriba de la columna, antes que la secuencia: el personaje del 0 de mi alta; la tarjeta no lo repite en su cabecera
  assert.match(h, new RegExp(`<div class="cero-columna"[^>]*data-cero><button type="button" class="sitio-interrogante sitio-cero"[^>]*data-sitio="0" data-sitio-x="${altaYo}" data-sitio-general[^]*?<div class="secuencia"`));
  assert.equal((h.match(/data-sitio-general/g) ?? []).length, 1, 'un solo personaje del 0');
  assert.doesNotMatch(h, /class="barra|data-menu|barra-menu|data-quien|data-config|data-reiniciar|data-preferencia/);
  // el 6 y el 7 (las filas del hilo) y el 5 también tienen su responsable
  assert.ok(a.secuencia.filas.filter((f) => f.hilo).every((f) => f.sitio?.X === compra.id));
});

test('animado: el muñeco es el mismo botón que el interrogante (una capa), con el arte del modelo general cuando el nodo no tiene el suyo; quitar las capas da el sobrio', async () => {
  const { eje, compra } = await ejemploCompra();
  const tope = escalaDeTamanos().tope;
  const estado = { foco: { X: compra.id, pv: 0 }, niveles: Object.fromEntries(LATERALES.map((pv) => [pv, tope])) };
  const sobrio = await arbol(estado, eje, 'huesped', GRANDE);
  assert.equal(sobrio.animado, false);
  const hs = html(sobrio);
  assert.doesNotMatch(hs, /capa-sitio/, 'en sobrio, el interrogante a secas');
  await animado(eje);
  const anim = await arbol(estado, eje, 'huesped', GRANDE);
  assert.equal(anim.animado, true);
  const ha = html(anim);
  // los ocho PV tienen muñeco (el modelo general trae un muñequito por mundo) y es del rol por defecto del mundo
  const conMuneco = sitios(ha).filter((s) => !s.general && !s.lugar.includes('.') && s.muneco).map((s) => s.lugar).sort();
  assert.deepEqual(conMuneco, LATERALES.map(String).sort());
  for (const n of anim.laterales) {
    assert.ok(n.sitio.personaje?.pieza?.recurso, 'el muñeco del ' + n.pv);
    assert.equal(n.sitio.personaje.accion, 'esperar');
  }
  // misma acción y mismo sitio: el mismo botón con los mismos data-sitio
  assert.deepEqual(sitios(ha).map((s) => [s.lugar, s.x, s.general]), sitios(hs).map((s) => [s.lugar, s.x, s.general]));
  // el muñeco no es un personaje del mundo (el del hueco de la pantalla completa) ni recibe el ratón
  assert.doesNotMatch(ha, /class="[^"]*pieza-personaje[^"]*"[^>]*accion-esperar[^>]*>[^]*?data-sitio/);
  assert.match(CSS, /\.capa\{pointer-events:none\}/);
  // pantalla completa: el muñeco de cada celda, en su botón; y el del hueco abre el sitio de la rejilla
  const completa = await arbol({ foco: { X: compra.id, pv: 3 } }, eje, 'huesped', GRANDE);
  const hc = html(completa);
  const celdas = completa.centro.rejilla.celdas.filter((c) => c.sitio);
  assert.ok(celdas.length > 0 && celdas.every((c) => c.sitio.personaje?.pieza?.recurso), 'cada celda con su muñeco');
  assert.ok(celdas.every((c) => sitios(hc).some((s) => s.lugar === c.sitio.lugar && s.muneco)));
  assert.match(hc, new RegExp(`<div class="capa capa-personaje"[^>]*data-sitio="3" data-sitio-x="${compra.id}"`), 'el muñeco del hueco abre el sitio del PV');
  assert.match(CSS, /\.capa-personaje\[data-sitio\]\{pointer-events:auto/);
  // Sequenced: el muñeco de cada fila con arte (el 0 y el 5 no tienen muñeco en el modelo general: se quedan con el interrogante)
  const movil = html(await arbol({ foco: { X: compra.id, pv: 0 } }, eje, 'huesped', MOVIL));
  assert.deepEqual(sitios(movil).filter((s) => !s.general && s.muneco).map((s) => s.lugar).sort(), MUNDOS.map(String).sort());
});

test('la barra no existe: cada acción de la barra tiene su sitio en la cruceta del 0 de mi alta (Mapped y Sequenced) y lo que no está abierto no se pinta', async () => {
  const { eje, compra } = await ejemploCompra();
  const extra = { ejemplos: [{ id: 'compra', etiqueta: 'la compra' }], ejemplo: 'compra', guardado: 'guardado en este navegador · 31 registros', sincronia: { partes: ['3 por subir'], errores: [], rechazados: [] }, opinar: { activo: false, cuantas: 1 } };
  for (const medidas of [GRANDE, MOVIL]) {
    const cerrada = html(await arbol({ foco: { X: compra.id, pv: 0 } }, eje, 'huesped', medidas), extra);
    for (const c of ['data-quien', 'data-ejemplo', 'data-englobar', 'data-config', 'data-reiniciar', 'data-copia', 'data-olvidar', 'data-preferencia', 'data-opinar-ctl', 'data-sincronia', 'class="guardado"']) assert.ok(!cerrada.includes(c), 'cerrada, sin ' + c);
    const a = await arbol(abiertaCero(eje, compra.id), eje, 'huesped', medidas);
    assert.equal(a.sitio.general, true);
    const h = html(a, extra);
    assert.match(h, /<div class="sitio-cruceta"[^>]*data-sitio-de="0" data-sitio-general/);
    const pos = (k) => (h.match(new RegExp(`<div class="sitio-posicion[^"]*" data-posicion="${k}"[^]*?(?=<div class="sitio-posicion[^"]*" data-posicion=|</ol>)`)) ?? [''])[0];
    // 0 quién soy (y el ejemplo) · 1 hoy y «guardar este rato» · 2 la configuración · 4 lo que se hace con la cuenta ·
    // 5 el estilo (sobrio o animado) · 8 opinar · 9 cómo: los ajustes de la guía y del exterior, lo guardado y la sincronía
    assert.match(pos(0), /data-quien[^]*data-ejemplo/);
    assert.match(pos(2), /data-config="2"/);
    assert.match(pos(4), /data-reiniciar/);
    assert.match(pos(5), /class="interruptor"[^]*data-preferencia="render"/);
    assert.match(pos(8), /data-opinar-ctl="alternar"/);
    assert.match(pos(9), /data-config="9"[^]*class="guardado">guardado en este navegador[^]*data-sincronia/);
    assert.equal((h.match(/data-quien/g) ?? []).length, 1);
    // las demás posiciones siguen siendo las del nodo: su acción de configurar el sitio
    assert.equal((h.match(/class="sitio-posicion[ "]/g) ?? []).length, 10);
    assert.match(pos(3), /data-sitio-lanzar/);
  }
  // con el tiempo local, el 1 lleva «hoy» y «guardar este rato»
  const { LibroLocal } = await import('../src/index.js').then((m) => ({ LibroLocal: m.local?.LibroLocal ?? m.LibroLocal }));
  if (LibroLocal) {
    const libro = new LibroLocal(eje, 'huesped');
    libro.ver(compra.id, { t: T1 });
    const h = html(await arbol(abiertaCero(eje, compra.id, { local: libro }), eje, 'huesped', GRANDE, { t: T1 }), extra);
    assert.match(h, /data-posicion="1"[^]*?class="tiempo"[^]*?data-englobar[^]*?guardar este rato/);
  }
  // una cuenta: en el 4, la copia de seguridad y olvidar en lugar de reiniciar
  const conCuenta = html(await arbol(abiertaCero(eje, compra.id), eje, 'huesped', GRANDE), { ...extra, ejemplos: [], cuenta: { nombre: 'yo', alta: eje.alta('huesped').id, identidad: 'huesped' }, cuentas: [] });
  assert.match(conCuenta, /data-posicion="4"[^]*?data-copia[^]*?data-olvidar/);
  assert.doesNotMatch(conCuenta, /data-reiniciar|data-ejemplo|data-quien/, 'en una cuenta no hay «soy» (VG 14-11, #86)');
});

test('gestos y app: el personaje del 0 abre la cruceta del 0 de mi alta (general); los controles de la barra siguen con sus manejadores', () => {
  const oyentes = [];
  const documento = { defaultView: { innerWidth: 1366, innerHeight: 768 }, addEventListener: (t, f) => oyentes.push([t, f]), removeEventListener() {} };
  const raiz = { ownerDocument: documento, addEventListener: (t, f) => oyentes.push([t, f]), removeEventListener() {}, querySelector: () => null };
  const llamadas = [];
  instalar(raiz, new Proxy({}, { get: (_, nombre) => (...args) => { llamadas.push([nombre, ...args]); } }));
  const objetivo = (respuestas) => ({ closest: (sel) => { for (const [trozo, v] of Object.entries(respuestas)) if (sel.includes(trozo)) return v; return null; } });
  const clic = (e) => { for (const [t, f] of oyentes) if (t === 'click') f(e); };
  clic({ target: objetivo({ '[data-sitio]': { dataset: { sitio: '0', sitioX: 'ALTA', sitioGeneral: '' } } }), preventDefault() {} });
  clic({ target: objetivo({ '[data-sitio]': { dataset: { sitio: '3.4', sitioX: 'X1' } } }), preventDefault() {} });
  assert.deepEqual(llamadas, [['sitio', 'ALTA', '0', { general: true }], ['sitio', 'X1', '3.4', { general: false }]]);
  // los controles reubicados siguen enganchados a su manejador (por su data-*)
  const gestos = readFileSync(new URL('../carta/gestos.js', import.meta.url), 'utf8');
  for (const [d, m] of [['data-config', 'configurar'], ['data-reiniciar', 'reiniciar'], ['data-copia', 'copia'], ['data-olvidar', 'olvidar'], ['data-englobar', 'englobar'], ['data-preferencia', 'preferencia'], ['data-quien', 'quien'], ['data-ejemplo', 'ejemplo']]) {
    assert.match(gestos, new RegExp(`${d}[^\\n]*m\\.${m}\\?\\.\\(`), `${d} → ${m}`);
  }
  assert.doesNotMatch(gestos, /data-menu|m\.menu/);
  // la app: sin barra ni menú; la escena es la ventana entera; la cruceta se cierra al abrir la configuración o la copia y al cambiar de identidad
  assert.doesNotMatch(APP, /estado\.menu|\.barra'/);
  assert.match(APP, /sitio\(X, lugar, \{ general = false \} = \{\}\)/);
  assert.match(APP, /estado\.config = parte === '9' \? '9' : '2';[^\n]*estado\.sitio = null/);
  assert.match(APP, /raiz\.querySelector\('\.sitio-cruceta\[data-sitio-general\] \.guardado'\)/);
  assert.match(CSS, /\.cero-columna\{position:sticky;top:0/);
});
