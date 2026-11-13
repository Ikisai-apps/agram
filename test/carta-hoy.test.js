// La cruceta del sitio y la configuración, de cara al usuario (VG 14-11, repaso de la beta #9, #14, #15, #20, #28):
//   #85 cada celda de la cruceta del sitio enseña el 0 de su nodo y su valor; tocarla es configurar esa posición
//   #86 «soy» solo en el modo ejemplo, como «ver como»
//   #88 una caja vacía del 3 dice qué la llena (dato de la época, es/en) y el botón dice lo que filtra
//   #92 la configuración se separa por posición: 2 = mis criterios y preferencias, 9 = guía y exterior
//   #95 «guardar este rato»: la celda «qué es» enseña el 0 del registro en llano, nunca el volcado
// Lo visual está en las capturas de MUELA/equipo/agram/mockups/capturas/beta-cartahoy.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { arbol, preferencias } from '../carta/carta.js';
import { html, htmlConfiguracion } from '../carta/dom.js';
import { instalar } from '../carta/gestos.js';
import { TEXTOS, t } from '../carta/textos.js';
import * as C from '../src/contrato.js';
import { direccion } from '../src/btml.js';
import { LibroLocal } from '../src/local.js';
import { ejemploCompra } from '../ejemplos/ikisai/compra-food.mjs';
import { pagaElCoste } from './ayudas-coste.js';

const GRANDE = { ancho: 1920, alto: 1080 };
const T1 = '2026-11-08T10:00:00Z';
const APP = readFileSync(new URL('../carta/app.js', import.meta.url), 'utf8');

/** El HTML de una posición de la cruceta (de `<div class="sitio-posicion…" data-posicion="k"` hasta la siguiente). */
const posicionDe = (h, k) => (h.match(new RegExp(`<div class="sitio-posicion[^"]*" data-posicion="${k}"[^]*?(?=<div class="sitio-posicion[^"]*" data-posicion=|</ol>)`)) ?? [''])[0];
const sitioAbierto = (eje, X, lugar, extra = {}) => ({ foco: { X, pv: 3 }, sitio: { X, lugar }, ...extra });

// ---------- #85 ----------

test('#85 cada celda de la cruceta de un sitio enseña el nombre de su posición (o su 0 escrito) y su valor, o «sin configurar»; tocarla es configurar esa posición', async () => {
  const { eje, compra } = await ejemploCompra();
  const a = await arbol(sitioAbierto(eje, compra.id, '3.1'), eje, 'huesped', GRANDE);
  assert.deepEqual(a.sitio.posiciones.map((p) => p.posicion), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(a.sitio.posiciones.map((p) => p.nombre), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => C.etiqueta(eje, null, [3, 1, k], { idioma: 'es' })), 'el nombre de la fila de la época, en el idioma de la cuenta');
  assert.ok(a.sitio.posiciones.every((p) => p.valor === ''), 'sin valor');
  const h = html(a);
  assert.equal((h.match(/class="sitio-posicion[ "]/g) ?? []).length, 10);
  assert.equal((h.match(/sin configurar/g) ?? []).length, 10, 'las diez dicen «sin configurar»');
  // tocar la celda: el botón ocupa la celda (término + valor) y es el único de la posición; no hay un «configurar el sitio» repetido
  const uno = posicionDe(h, 1);
  assert.match(uno, /<button type="button" class="sitio-tocar"[^>]*data-sitio-lanzar="[^"]+" data-x="[0-9a-f]{64}"[^>]*><span class="nombre">cuánto<\/span><span class="valor sin-configurar">sin configurar<\/span><\/button>/);
  assert.equal((uno.match(/<button/g) ?? []).length, 1);
  assert.doesNotMatch(h, /class="accion"/, 'el botón repetido ya no existe');
  assert.doesNotMatch(h, /<span class="valor">—<\/span>/, 'sin el «—»');
});

test('#85 el valor actual lleva el nombre de lo que se escribe («cantidad: 2», «rango: 3.1»)', async () => {
  const { eje, compra } = await ejemploCompra();
  // el dueño del nodo es quien escribió el registro (huesped): su mínimo en la caja 1 (lo escrito en X.3.1.1 es el 0 de ese nodo: su valor)
  await eje.escribir({ autor: 'huesped', sobre: compra.id, en: direccion([3, 1, 1]), t: T1, movimientos: [pagaElCoste('huesped')], payload: [[2]] });
  const a = await arbol(sitioAbierto(eje, compra.id, '3.1'), eje, 'huesped', GRANDE);
  const p = a.sitio.posiciones[1];
  assert.deepEqual([p.nombre, p.valor], ['cuánto', 'cantidad: 2']);
  const uno = posicionDe(html(a), 1);
  assert.match(uno, /<span class="nombre">cuánto<\/span><span class="valor">cantidad: 2<\/span>/);
});

test('#85 las opciones del 0 de mi alta se muestran con su nombre en su celda (y esa celda no es un botón)', async () => {
  const { eje, compra } = await ejemploCompra();
  const alta = eje.alta('huesped').id;
  const extra = { ejemplos: [{ id: 'compra', etiqueta: 'la compra' }], ejemplo: 'compra', guardado: 'guardado', opinar: { activo: false, cuantas: 0 } };
  const h = html(await arbol({ foco: { X: compra.id, pv: 0 }, sitio: { X: alta, lugar: '0', general: true } }, eje, 'huesped', GRANDE), extra);
  for (const k of [2, 8, 9]) assert.doesNotMatch(posicionDe(h, k), /sitio-tocar/, 'la ' + k + ' trae sus controles');
  assert.match(posicionDe(h, 2), /<span class="nombre">con qué condición<\/span>[^]*data-config="2"[^>]*>mis criterios y preferencias</);
  assert.match(posicionDe(h, 9), /data-config="9"[^>]*>guía y exterior</);
  assert.match(posicionDe(h, 3), /<button type="button" class="sitio-tocar"/, 'las demás son tocables');
});

// ---------- #86 ----------

test('#86 «soy» es del modo ejemplo («ver como»); en una cuenta real no está', async () => {
  const { eje, compra } = await ejemploCompra();
  const alta = eje.alta('huesped').id;
  const a = await arbol({ foco: { X: compra.id, pv: 0 }, sitio: { X: alta, lugar: '0', general: true } }, eje, 'huesped', GRANDE);
  const ejemplo = html(a, { ejemplos: [{ id: 'compra', etiqueta: 'la compra' }], ejemplo: 'compra' });
  assert.match(posicionDe(ejemplo, 0), /ver como <select data-quien>/);
  assert.doesNotMatch(ejemplo, />soy </);
  const cuenta = html(a, { cuenta: { nombre: 'yo', alta, identidad: 'huesped' }, cuentas: [{ nombre: 'yo', alta }] });
  assert.doesNotMatch(cuenta, /data-quien|ver como|data-ejemplo/);
  assert.equal(TEXTOS.es.verComo, 'ver como');
});

// ---------- #88 ----------

test('#88 la época trae una frase por caja del 3, en es y en en; una caja vacía la dice y el botón dice lo que filtra, con su flecha', async () => {
  const { eje, compra } = await ejemploCompra();
  const es = C.gruposDelTres(eje, compra.id, { idioma: 'es' });
  assert.deepEqual(es.map((c) => c.llena), ['aquí entra quien te escribe', 'quien compra o vende contigo', 'quien opina sobre tus criterios', 'a quien das tu R', 'con quien trabajas', 'a quien has vetado']);
  assert.deepEqual(C.gruposDelTres(eje, compra.id, { idioma: 'en' }).map((c) => c.llena).slice(0, 2), ['whoever writes to you comes in here', 'who buys or sells with you']);
  assert.equal(C.gruposDelTres(eje, compra.id, { idioma: 'fr' })[1].llena, 'who buys or sells with you', 'sin su idioma, la del canónico');
  const a = await arbol({ foco: { X: compra.id, pv: 3 } }, eje, 'huesped', GRANDE);
  const h = html(a);
  const cajas = a.centro.rejilla.celdas.filter((c) => c.caja !== undefined);
  assert.deepEqual(cajas.map((c) => c.llena), es.map((c) => c.llena), 'el árbol las trae');
  for (const c of cajas.filter((x) => x.vacio)) assert.ok(h.includes(`<span class="hijo-vacio">${c.llena}</span>`), 'la caja ' + c.caja + ' dice qué la llena');
  assert.doesNotMatch(h, /<span class="hijo-vacio">nadie<\/span>/);
  assert.deepEqual([t('filtro_todos'), t('filtro_doy'), t('filtro_recibo')], ['↔ todo', '→ lo que doy', '← lo que recibo']);
  assert.match(h, /data-filtro="todos"[^>]*>↔ todo<\/button>/);
});

// ---------- #92 ----------

test('#92 la configuración se separa: el 2 abre mis criterios y preferencias; el 9, la guía y el exterior; cada una con sus campos', async () => {
  const { eje } = await ejemploCompra();
  const p = preferencias(eje, 'huesped');
  const guia = { campos: [{ pv: 1, clave: 'guide model', etiqueta: 'modelo de la guía', valor: '', marcador: '', ayuda: '' }], claveIa: '' };
  const exterior = { campos: [{ pv: 1, clave: 'relay url', etiqueta: 'relé', valor: '', marcador: '', ayuda: '' }] };
  const segundoFactor = { criterios: [], campos: [{ nombre: 'family', etiqueta: 'familia', tipo: 'text', ayuda: '', valor: '' }], titulares: [] };
  const etiquetas = (h) => [...h.matchAll(/<label for="[^"]+">([^<]+)<\/label>/g)].map((m) => m[1]);
  const dos = htmlConfiguracion(p, { claveLectura: '', guia, exterior, segundoFactor, parte: '2' });
  const nueve = htmlConfiguracion(p, { claveLectura: '', guia, exterior, segundoFactor, parte: '9' });
  assert.deepEqual(etiquetas(dos), ['paso', 'pintado', 'idioma', 'tamaños', 'modelo', 'animaciones', 'familia']);
  assert.deepEqual(etiquetas(nueve), ['servidor', 'eje compartido', 'clave de lectura', 'modelo de la guía', 'clave de Anthropic (vía directa)', 'relé']);
  assert.match(dos, /data-parte="2"[^>]*>[^]*<h2><span class="numero">2<\/span> mis criterios y preferencias<\/h2>/);
  assert.match(nueve, /data-parte="9"[^>]*>[^]*<h2><span class="numero">9<\/span> guía y exterior<\/h2>/);
  assert.doesNotMatch(dos, /data-clave-lectura|data-guia-campo|data-exterior-campo|data-clave-ia/);
  assert.doesNotMatch(nueve, /data-segundo-factor-campo|name="render"|name="language"|name="sizes"/);
  assert.equal(htmlConfiguracion(p, { parte: undefined }).includes('data-parte="2"'), true, 'por defecto, el 2');
});

test('#92 gestos y app: cada botón abre solo su parte; guardar lee los campos de su formulario (también los desplegables)', () => {
  const oyentes = [];
  const documento = { defaultView: { innerWidth: 1366, innerHeight: 768 }, addEventListener: (x, f) => oyentes.push([x, f]), removeEventListener() {} };
  const raiz = { ownerDocument: documento, addEventListener: (x, f) => oyentes.push([x, f]), removeEventListener() {}, querySelector: () => null };
  const llamadas = [];
  instalar(raiz, new Proxy({}, { get: (_, nombre) => (...args) => { llamadas.push([nombre, ...args]); } }));
  const clic = (e) => { for (const [x, f] of oyentes) if (x === 'click') f(e); };
  const boton = (valor) => ({ closest: (sel) => (sel.includes('[data-config]') ? { dataset: { config: valor } } : null) });
  clic({ target: boton('2'), preventDefault() {} });
  clic({ target: boton('9'), preventDefault() {} });
  assert.deepEqual(llamadas, [['configurar', null, '2'], ['configurar', null, '9']]);
  assert.match(APP, /async configurar\(form, parte\) \{\n    if \(!form\) \{ estado\.config = parte === '9' \? '9' : '2';/);
  assert.match(APP, /querySelectorAll\('input\[name\], select\[name\]'\)/);
  assert.match(APP, /parteConfiguracion: estado\.config \|\| undefined/);
});

// ---------- #95 ----------

test('#95 «guardar este rato»: la celda «qué es» enseña el 0 del registro en llano (nota, minutos, hora), nunca el volcado', async () => {
  const { eje, compra } = await ejemploCompra();
  const alta = eje.alta('huesped').id;
  const libro = new LibroLocal(eje, 'huesped');
  libro.ver(compra.id, { t: '2026-11-08T10:12:00Z' });
  libro.tocar(compra.id, 'nivel 1 2', { t: '2026-11-08T10:14:00Z' });
  const ev = await libro.englobar(undefined, { nota: 'un rato en la carta' });
  assert.ok(ev);
  const a = await arbol({ foco: { X: compra.id, pv: 0 }, local: libro, sitio: { X: alta, lugar: '0', general: true } }, eje, 'huesped', GRANDE, { t: T1 });
  const cero = a.sitio.posiciones[0];
  assert.match(cero.valor, /^un rato en la carta · 2 min · (hoy \d\d:\d\d|\d\d\/\d\d \d\d:\d\d)$/);
  assert.doesNotMatch(cero.valor, /[0-9a-f]{16}|T\d\d:\d\d:\d\dZ|huesped/, 'sin el hash, las fechas ISO ni los autores del volcado');
  const h = html(a, { cuenta: { nombre: 'yo', alta, identidad: 'huesped' }, cuentas: [] });
  assert.ok(posicionDe(h, 0).includes(cero.valor));
  assert.ok(posicionDe(h, 0).length < 600, 'la celda no se hincha con el volcado');
  // el volcado entero sigue siendo del 5 (el editor de BTML): el registro lo trae completo
  assert.equal(eje.obtener(ev.id).payload.length, 8);
});
