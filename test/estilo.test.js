// Los dos estilos como datos (VG, 10-11 noche): el estilo propio de un registro es su 0.9 (representación · cómo) y el de
// los de abajo su 5.0 (estructura · qué es), ambos un texto CSS. contrato.estilo da la cascada (gana lo más cercano:
// el registro, su padre, su plantilla, la época) y contrato.cssSeguro sanea el texto: el libro es compartido y de un
// dato nunca se ejecuta JavaScript ni se carga un recurso de fuera. La carta emite el CSS ya saneado en un <style>.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../src/contrato.js';
import { arbol } from '../carta/carta.js';
import { html, htmlEstilos } from '../carta/dom.js';
import { EPOCA_0_BTML, cargarEpocaBtml, REGISTROS_DE_MODELOS } from '../src/epocas.js';
import { EPOCA_0_BTML_DATOS, REGLAS_DE_EPOCA_DATOS, PLANTILLAS_DE_EPOCA_DATOS, CORRECCIONES_DE_EPOCA_DATOS } from '../datos/epocas/epocas.js';
import { ejemploCompra } from '../ejemplos/ikisai/compra-food.mjs';
import { poner } from './ayudas-division.js';

const GRANDE = { ancho: 1920, alto: 1080 };
const T = [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'huesped', a: null }];

function epocaCon(cambiar) {
  const e = JSON.parse(JSON.stringify(EPOCA_0_BTML_DATOS));
  const plantillas = JSON.parse(JSON.stringify(PLANTILLAS_DE_EPOCA_DATOS));
  cambiar(e, plantillas);
  return cargarEpocaBtml(e, { registros: [...REGLAS_DE_EPOCA_DATOS, ...REGISTROS_DE_MODELOS], plantillas, correcciones: CORRECCIONES_DE_EPOCA_DATOS, id: EPOCA_0_BTML.id });
}

/** La plantilla «purchase» (la de la compra) en una copia de los datos de la época. */
const compraPlantilla = (e) => e[9][2][1];

let reloj = 0;
const escribe = (eje, sobre, en, payload) => eje.escribir({ autor: 'huesped', sobre, en, t: new Date(Date.UTC(2026, 10, 10, 9, reloj++)).toISOString(), movimientos: T, payload });
const estilo = (eje, X, de, opciones = {}) => C.estilo(eje, X, { de, ...opciones });

test('cssSeguro acepta declaraciones corrientes y variables, y las devuelve normalizadas', () => {
  assert.equal(C.cssSeguro('color: red'), 'color: red;');
  assert.equal(C.cssSeguro('color:red;background:#fff;margin:0   4px;'), 'color: red; background: #fff; margin: 0 4px;');
  assert.equal(C.cssSeguro('--hueco: 1fr; --radio: 6px'), '--hueco: 1fr; --radio: 6px;');
  assert.equal(C.cssSeguro('grid-template-columns: repeat(3, minmax(0, 1fr)); gap: calc(4px + 1%)'), 'grid-template-columns: repeat(3, minmax(0, 1fr)); gap: calc(4px + 1%);');
  assert.equal(C.cssSeguro('font-family: "Fira Sans", sans-serif; background: linear-gradient(red, blue)'), 'font-family: "Fira Sans", sans-serif; background: linear-gradient(red, blue);');
  assert.equal(C.cssSeguro('COLOR: Red;\n  padding: 2px\n'), 'color: Red; padding: 2px;');
  assert.equal(C.cssSeguro(''), '');
  assert.equal(C.cssSeguro('-'), '', 'el «-» de la época no es un estilo');
});

test('cssSeguro rechaza lo que carga un recurso, ejecuta código o se sale de su regla', () => {
  const malos = [
    'background: url(http://malo.example/x.png)',
    'background:URL( "x" )',
    'color: red; background-image: url(data:image/svg+xml;base64,AAAA)',
    '@import "malo.css";',
    '@import url(malo.css)',
    '<script>alert(1)</script>',
    'color: red; </style><script>alert(1)</script>',
    'color: red } body { display: none',
    'color: red; } * { color: blue',
    'a { color: red }',
    'width: expression(alert(1))',
    'background: javascript:alert(1)',
    'behavior: url(x.htc)',
    '-moz-binding: url(x.xml#y)',
    'background: image-set("x" 1x)',
    'content: "\\75rl(x)"',
    'color: red /* url(x) */',
    'color: red' + String.fromCharCode(0) + '; background: url(x)',
    'color: red;' + String.fromCharCode(0x2028) + 'background: u' + String.fromCharCode(0x200b) + 'rl(x)',
    'color: red; x: <b>',
    'color: red; y: a>b',
  ];
  for (const m of malos) assert.equal(C.cssSeguro(m), '', 'se rechaza: ' + JSON.stringify(m));
  assert.equal(C.cssSeguro('color: red; ' + 'a'.repeat(2000)), '', 'más de 2000 caracteres');
  assert.equal(C.cssSeguro('--x: ' + 'a'.repeat(1990) + ';').length > 0, true, 'justo por debajo del tope, vale');
  for (const noTexto of [undefined, null, 5, {}, ['color: red']]) assert.equal(C.cssSeguro(noTexto), '');
});

test('cssSeguro descarta las declaraciones que no son de la lista blanca y conserva las demás', () => {
  assert.equal(C.cssSeguro('position: fixed; color: red; z-index: 9999; top: 0'), 'color: red;', 'nada que saque un elemento de su sitio');
  assert.equal(C.cssSeguro('color: red; cursor: pointer; transition: all 1s; animation: x 1s; content: "hola"; transform: scale(9)'), 'color: red;');
  assert.equal(C.cssSeguro('pointer-events: none; visibility: hidden; filter: blur(9px); color: blue'), 'color: blue;');
  assert.equal(C.cssSeguro('color'), '');
  assert.equal(C.cssSeguro('color: ; margin: 1px'), 'margin: 1px;');
  assert.equal(C.cssSeguro('color: red !important; margin: 1px'), 'margin: 1px;', 'sin !important: la carta manda en lo suyo');
  assert.equal(C.cssSeguro('width: calc(1px + (2px; height: 3px'), 'height: 3px;', 'paréntesis sin cerrar');
  assert.equal(C.cssSeguro('--1 x: 3; --ok-1: 4'), '--ok-1: 4;');
});

test('el estilo propio es X.0.9: el del registro gana a la plantilla y la época no dice nada del propio', async () => {
  const { eje, compra, menu } = await ejemploCompra();
  assert.deepEqual(estilo(eje, menu.id, 'propio'), { css: '', origen: null }, 'sin 0.9 ni plantilla: nada');
  assert.deepEqual(estilo(eje, compra.id, 'propio'), { css: '', origen: null }, 'la fila de epoch.8.7 es de los de abajo, no del propio');
  const conPlantilla = epocaCon((e) => { compraPlantilla(e)[0][9] = ['color: teal; font-weight: 600']; });
  assert.deepEqual(estilo(eje, compra.id, 'propio', { epoca: conPlantilla }), { css: 'color: teal; font-weight: 600;', origen: 'plantilla' });
  assert.deepEqual(estilo(eje, menu.id, 'propio', { epoca: conPlantilla }), { css: '', origen: null }, 'el menú no tiene esa plantilla');
  await escribe(eje, compra.id, '0900000000', 'color: red');
  assert.deepEqual(estilo(eje, compra.id, 'propio'), { css: 'color: red;', origen: 'registro' });
  assert.deepEqual(estilo(eje, compra.id, 'propio', { epoca: conPlantilla }), { css: 'color: red;', origen: 'registro' }, 'el registro gana a la plantilla');
  // lo último escrito manda; un texto inseguro no cuenta (se queda el anterior) y no se cuela
  await escribe(eje, compra.id, '0900000000', 'color: green');
  assert.equal(estilo(eje, compra.id, 'propio').css, 'color: green;');
  await escribe(eje, compra.id, '0900000000', 'color: pink; background: url(http://malo.example/x.png)');
  assert.deepEqual(estilo(eje, compra.id, 'propio'), { css: 'color: green;', origen: 'registro' });
  assert.deepEqual(estilo(eje, menu.id, 'propio'), { css: '', origen: null }, 'el estilo de uno no es el de otro');
});

test('el estilo de los de abajo es X.5.0: el registro, si no su padre, si no su plantilla, si no la fila de epoch.8.7 del mundo', async () => {
  const { eje, compra, menu } = await ejemploCompra();
  // Con la época sola: la fila del mundo (hoy, un ejemplo mínimo en el 1); sin mundo, nada.
  assert.deepEqual(estilo(eje, compra.id, 'hijos', { pv: 1 }), { css: '--hueco: 1fr;', origen: 'epoca' });
  assert.deepEqual(estilo(eje, compra.id, 'hijos', { pv: 2 }), { css: '', origen: null });
  assert.deepEqual(estilo(eje, compra.id, 'hijos'), { css: '', origen: null });
  const otraEpoca = epocaCon((e) => { poner(e[8][7][1].find((f) => f[0][0] === 2), 'style', ['gap: 3px']); });
  assert.deepEqual(estilo(eje, compra.id, 'hijos', { pv: 2, epoca: otraEpoca }), { css: 'gap: 3px;', origen: 'epoca' });
  // La plantilla de X gana a la época.
  const conPlantilla = epocaCon((e) => { compraPlantilla(e)[5] = [['gap: 4px']]; });
  assert.deepEqual(estilo(eje, compra.id, 'hijos', { pv: 1, epoca: conPlantilla }), { css: 'gap: 4px;', origen: 'plantilla' });
  assert.deepEqual(estilo(eje, menu.id, 'hijos', { pv: 1, epoca: conPlantilla }), { css: '--hueco: 1fr;', origen: 'epoca' }, 'el menú no tiene esa plantilla');
  // El padre de X (el registro sobre el que se escribió: el menú es el de la compra) gana a la plantilla.
  await escribe(eje, menu.id, '5000000000', 'gap: 9px');
  assert.deepEqual(estilo(eje, compra.id, 'hijos', { pv: 1, epoca: conPlantilla }), { css: 'gap: 9px;', origen: 'padre' });
  assert.deepEqual(estilo(eje, menu.id, 'hijos', { pv: 1 }), { css: 'gap: 9px;', origen: 'registro' }, 'para el menú es el suyo');
  // El suyo propio gana a todo.
  await escribe(eje, compra.id, '5000000000', 'gap: 1px; padding: 2px');
  assert.deepEqual(estilo(eje, compra.id, 'hijos', { pv: 1, epoca: conPlantilla }), { css: 'gap: 1px; padding: 2px;', origen: 'registro' });
  // Lo que se escribió en el 5.0 es del 5.0: no toca el estilo propio.
  assert.deepEqual(estilo(eje, compra.id, 'propio'), { css: '', origen: null });
  // Un valor inseguro en el 5.0 no cuenta: manda lo siguiente de la cascada.
  const { eje: e2, compra: c2, menu: m2 } = await ejemploCompra();
  await escribe(e2, m2.id, '5000000000', '@import "malo.css"');
  await escribe(e2, c2.id, '5000000000', 'background: url(x)');
  assert.deepEqual(estilo(e2, c2.id, 'hijos', { pv: 1 }), { css: '--hueco: 1fr;', origen: 'epoca' });
  assert.throws(() => estilo(e2, c2.id, 'otro'), /propio.*hijos/);
});

test('el árbol lleva el estilo de cada nodo y la carta lo emite como CSS acotado a su data-id, ya saneado', async () => {
  const { eje, compra } = await ejemploCompra();
  await escribe(eje, compra.id, '0900000000', 'color: red; position: fixed');
  const a = await arbol({ foco: { X: compra.id, pv: 1 } }, eje, 'huesped', GRANDE);
  assert.deepEqual(a.centro.estilo.propio, { css: 'color: red;', origen: 'registro' });
  assert.deepEqual(a.centro.estilo.hijos, { css: '--hueco: 1fr;', origen: 'epoca' });
  assert.deepEqual(a.centro.rejilla.estilo, a.centro.estilo, 'la rejilla del registro lleva los mismos');
  const h = html(a);
  assert.match(h, /<style data-estilos>/);
  assert.ok(h.includes(`[data-id="${compra.id}"]{color: red;}`), 'el propio, sobre el registro');
  assert.ok(h.includes(`[data-id="${compra.id}"] .hijo{--hueco: 1fr;}`), 'el de los de abajo, sobre sus hijos');
  assert.doesNotMatch(h, /position/);
  assert.match(h, new RegExp(`class="rejilla rejilla-completa" data-rejilla="1"[^>]*data-id="${compra.id}"`), 'la rejilla lleva el data-id al que se aplica');
  assert.match(h, /class="rejilla-celda hijo/, 'y sus celdas la clase hijo');
  // Los ocupantes que son registros llevan su propio estilo y su data-id (a ellos se aplica el suyo).
  const { eje: e2, compra: c2, menu: m2 } = await ejemploCompra();
  await escribe(e2, m2.id, '0900000000', 'border-radius: 8px');
  const celdas = (await arbol({ foco: { X: c2.id, pv: 3 } }, e2, 'huesped', GRANDE)).centro.rejilla.celdas;
  assert.ok(celdas.every((c) => c.ocupantes.every((o) => o.tipo !== 'referencia' || o.estilo)));
  // Sin ningún estilo (ni de la época para ese mundo), no hay <style>.
  const { eje: e3, compra: c3 } = await ejemploCompra();
  const sin = html(await arbol({ foco: { X: c3.id, pv: 2 } }, e3, 'huesped', GRANDE));
  assert.doesNotMatch(sin, /<style/);
});

test('lo que llega al <style> está saneado aunque el árbol venga de otro sitio: nada de recursos, de etiquetas ni de llaves', () => {
  const arbolMalo = {
    X: 'abc123',
    centro: {
      estilo: { propio: { css: 'color: red; } </style><script>alert(1)</script>', origen: 'registro' }, hijos: { css: 'gap: 2px; background: url(http://malo.example/x)', origen: 'registro' } },
      rejilla: {
        X: 'def456', estilo: { propio: { css: 'color: blue' }, hijos: { css: 'padding: 1px; @import "x"' } },
        celdas: [{ ocupantes: [{ X: 'ghi789', estilo: { propio: { css: '--x: 3px' }, hijos: { css: '' } } }, { X: 'a" onmouseover="x', estilo: { propio: { css: 'color: red' }, hijos: { css: '' } } }, { X: '</style>', estilo: { propio: { css: 'color: red' }, hijos: { css: '' } } }] }],
      },
    },
    laterales: [],
  };
  const css = htmlEstilos(arbolMalo);
  assert.equal(css, '<style data-estilos>[data-id="def456"]{color: blue;}[data-id="ghi789"]{--x: 3px;}</style>', 'solo lo seguro: el de arriba se rechaza entero, los ids raros se omiten');
  for (const prohibido of ['url(', '@import', '<script', 'onmouseover', '</style>alert', 'malo.example']) assert.ok(!css.includes(prohibido), 'no debe llevar ' + prohibido);
  // Un árbol sin estilos no emite nada.
  assert.equal(htmlEstilos({ X: 'abc', centro: {}, laterales: [] }), '');
  assert.equal(htmlEstilos({ X: 'abc', centro: { estilo: { propio: { css: '' }, hijos: { css: '' } } } }), '');
});
