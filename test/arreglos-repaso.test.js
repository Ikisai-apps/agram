// Los arreglos mecánicos del repaso de la beta (13-11): cada uno con su prueba de lo que se puede comprobar sin navegador.
// Lo visual (tablas que caben, etiquetas que parten, el aro en el borde) se comprueba en el CSS y, en Playwright, con las
// capturas de MUELA/equipo/agram/mockups/capturas/beta-arreglos.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as C from '../src/contrato.js';
import { ejemploCompra } from '../ejemplos/ikisai/compra-food.mjs';
import * as opinar from '../carta/opinar.js';
import { prefijoComunDePasos, htmlCamino, marcadorLegible } from '../carta/dom.js';
import { avisosDeAjustes } from '../carta/guia.js';
import { t } from '../carta/textos.js';

const css = readFileSync(new URL('../carta/estilo.css', import.meta.url), 'utf8');
const regla = (selector) => css.split('\n').find((l) => l.startsWith(selector)) ?? '';

/** Un documento de mentira para opinar.instalar: guarda los oyentes y deja disparar eventos. */
function documentoDeMentira(almacen) {
  const oyentes = [];
  const clases = new Set();
  const ventana = { innerWidth: 1366, innerHeight: 768, setTimeout: () => 0, navigator: {}, fetch: async () => ({ text: async () => '' }) };
  const doc = {
    defaultView: ventana,
    documentElement: { classList: { toggle: (c, on) => (on ? clases.add(c) : clases.delete(c)), contains: (c) => clases.has(c) } },
    body: { append() {} },
    addEventListener: (tipo, f) => oyentes.push([tipo, f]),
    removeEventListener() {},
    createElement: () => ({ classList: { add() {}, remove() {} }, append() {}, setAttribute() {}, addEventListener() {}, remove() {}, focus() {}, style: {}, offsetHeight: 100 }),
  };
  const raiz = { ownerDocument: doc, contains: () => true };
  const disparar = (tipo, e) => { for (const [t, f] of oyentes) if (t === tipo) f(e); };
  return { doc, raiz, clases, disparar, almacen };
}

const almacenDeMentira = (inicial = {}) => {
  const d = { ...inicial };
  return { getItem: (k) => d[k] ?? null, setItem: (k, v) => { d[k] = String(v); }, d };
};

test('#1 opinar arranca siempre apagado: el modo guardado de otra sesión no deja la carta interceptada sin indicador', () => {
  const almacen = almacenDeMentira({ [opinar.CLAVES.activo]: '1' });
  const { raiz, clases } = documentoDeMentira(almacen);
  const o = opinar.instalar({ raiz, almacen });
  assert.equal(o.activo(), false);
  assert.equal(clases.has('opinando'), false, 'sin la marca de «opinando» en la página');
  assert.equal(opinar.leerActivo(almacen), false, 'y apagado también en lo guardado: no vuelve a encenderse al recargar');
  o.quitar();
});

test('#1 con opinar activo, el «?» del personaje del 0 sigue llegando a la carta (y lo demás se intercepta)', () => {
  const almacen = almacenDeMentira();
  const { raiz, clases, disparar } = documentoDeMentira(almacen);
  const o = opinar.instalar({ raiz, almacen });
  // lo enciende el conmutador de la cruceta
  const ctl = { closest: (sel) => (sel === '[data-opinar-ctl]' ? { dataset: { opinarCtl: 'alternar' } } : null) };
  let prevenido = 0;
  disparar('click', { type: 'click', target: ctl, preventDefault: () => { prevenido++; }, stopPropagation() {}, stopImmediatePropagation() {} });
  return Promise.resolve().then(() => {
    assert.equal(o.activo(), true);
    assert.equal(clases.has('opinando'), true);
    const llega = (cierra) => {
      let detenido = 0;
      const objetivo = { closest: cierra, dataset: {}, parentElement: null, textContent: 'algo', classList: { add() {}, remove() {} }, getBoundingClientRect: () => ({ left: 0, top: 0, bottom: 10 }) };
      disparar('click', { type: 'click', target: objetivo, preventDefault() {}, stopPropagation: () => { detenido++; }, stopImmediatePropagation: () => { detenido++; } });
      return detenido === 0;
    };
    assert.equal(llega((sel) => (sel.includes('.sitio-interrogante[data-sitio-general]') ? {} : null)), true, 'el «?» del 0 no se detiene');
    assert.equal(llega(() => null), false, 'cualquier otra cosa sí: abre la cajita');
    o.quitar();
  });
});

test('#10 concordancia de la T: «69 minutos», «1 minuto», «0 minutos» (es y en)', async () => {
  const { eje } = await ejemploCompra();
  for (const idioma of ['es', 'en']) {
    const dice = (n) => C.legible(eje, { serie: 'T:minuto', cantidad: n }, null, { idioma }).texto;
    assert.equal(dice(69), '69 minutos');
    assert.equal(dice(1), '1 minuto');
    assert.equal(dice(0), '0 minutos');
    assert.equal(C.legible(eje, { serie: 'T:hora', cantidad: 2 }, null, { idioma }).texto, '2 horas');
  }
  assert.equal(C.pluralDeEscala('minuto'), 'minutos');
  assert.equal(C.pluralDeEscala('dia'), 'dias');
  assert.equal(C.pluralDeEscala('mes'), 'mes', 'ya acaba en s: no se toca');
  // el «hoy: …» de la barra del 0, en la carta: un nombre por cantidad
  for (const k of ['segundo', 'minuto', 'hora', 'dia', 'semana', 'ciclo', 'anio']) {
    assert.notEqual(t('escalaUna_' + k), 'escalaUna_' + k, k + ': singular');
    assert.notEqual(t('escala_' + k), 'escala_' + k, k + ': plural');
  }
});

test('#2 los pasos del camino no dicen «→ null» y lo que repiten (el «stage: …») sale una sola vez', async () => {
  const pasos = [
    { fuente: 'reglas', falta: 'stage: lo anunciado · servir 1 T:hora huesped → cocina', hecho: false, espera: null },
    { fuente: 'reglas', falta: 'stage: lo anunciado · Repetir el menú 1 T:minuto huesped', hecho: false, espera: null },
    { fuente: 'reglas', falta: 'stage: lo anunciado · Cena 2 T:minuto huesped', hecho: false, espera: null },
    { fuente: 'tutorial', falta: 'algo distinto', hecho: false, espera: null },
  ];
  assert.equal(prefijoComunDePasos(pasos), 'stage: lo anunciado');
  assert.equal(prefijoComunDePasos([pasos[0], pasos[3]]), '', 'con uno solo no hay nada que compartir');
  const h = htmlCamino({ pasos, niveles: null, previa: null });
  assert.equal(h.split('stage: lo anunciado').length - 1, 1, 'una vez, no tres');
  assert.match(h, /<p class="camino-comun">stage: lo anunciado<\/p>/);
  assert.match(h, /<span class="falta">servir 1 T:hora huesped → cocina<\/span>/);
  assert.doesNotMatch(h, /null/);
  // y en el núcleo: un destino sin resolver (a: null) no imprime la flecha
  const fuente = readFileSync(new URL('../src/acciones.js', import.meta.url), 'utf8');
  assert.match(fuente, /m\.de \+ \(m\.a \? ' → ' \+ m\.a : ''\)/);
});

test('#13 la configuración avisa de lo mal escrito en vez de guardarlo o volver al defecto en silencio', () => {
  const campos = [
    { clave: 'guide history', etiqueta: 'turnos de la guía', numero: true },
    { clave: 'observer keys', etiqueta: 'claves del observador', numero: false },
    { clave: 'relay url', etiqueta: 'relé', numero: false },
  ];
  const bien = 'ab'.repeat(32);
  assert.deepEqual(avisosDeAjustes(campos, { 'guide history': '20', 'observer keys': bien + ' ' + bien.toUpperCase(), 'relay url': 'lo que sea' }), []);
  assert.deepEqual(avisosDeAjustes(campos, { 'guide history': '', 'observer keys': '' }), [], 'vacío: quita el ajuste, sin aviso');
  const mal = avisosDeAjustes(campos, { 'guide history': 'abc', 'observer keys': 'nohex ' + bien });
  assert.equal(mal.length, 2);
  assert.match(mal[0], /turnos de la guía.*abc.*número mayor que 0/);
  assert.match(mal[1], /claves del observador.*nohex.*64 caracteres/);
  assert.doesNotMatch(mal[1], new RegExp(bien), 'solo cita lo que está mal');
  assert.equal(avisosDeAjustes(campos, { 'guide history': '0' }).length, 1, '0 o negativo, fuera de rango');
  assert.equal(avisosDeAjustes(campos, { 'guide history': '-3' }).length, 1);
  // una lista de números (los tamaños) vale si cada uno lo es; sin exigir positivos en las preferencias
  const tam = [{ clave: 'sizes', etiqueta: 'tamaños', numero: true }];
  assert.deepEqual(avisosDeAjustes(tam, { sizes: '1 2 3' }), []);
  assert.deepEqual(avisosDeAjustes(tam, { sizes: '0 2' }, { positivo: false }), []);
  assert.equal(avisosDeAjustes(tam, { sizes: '1 x 3' }, { positivo: false }).length, 1);
});

test('#25 bis el marcador de una fila de Sequenced no enseña notas internas del corpus: pone la etiqueta legible', () => {
  assert.equal(marcadorLegible(["Décupla del corpus V4: 9 = 'Confirmar la elección antes de registrar'."], 'camino'), 'camino');
  assert.equal(marcadorLegible([], 'camino'), 'camino');
  assert.equal(marcadorLegible(['menú', '1', 'EUR 12'], 'pedido'), 'menú · 1 · EUR 12', 'un ejemplo de verdad se conserva');
});

test('#3 #4 la tabla de una celda cabe en su celda: el texto parte y no ensancha', () => {
  assert.match(regla('.hijo-tabla{'), /max-width:100%/);
  assert.match(regla('.hijo-tabla td{min-width:0'), /overflow-wrap:anywhere/);
  assert.match(regla('.hijo-tabla .ocupante-ref .texto'), /white-space:normal/);
});

test('#6 #8 #16 #17 #25 el CSS de los textos largos: franja de mandos, elipsis con title, aro con ancla numérica, medida en su línea', () => {
  assert.match(css, /\.mapa:not\(\.completa\) \.mapa-celdas>\.celda>\.pv:is\(\.nivel-2,\.nivel-3\)\{padding-bottom:30px\}/);
  assert.match(regla('.hueco .accion .nombre'), /-webkit-line-clamp:2/);
  assert.match(regla('.aro.anclado.aro-nuevo'), /--centro-ancho:240px/, 'el aro de un hueco en el borde mide un número: situarAro no lee min()');
  assert.match(regla('.fila-cabeza .medida'), /flex:1 0 100%/);
  assert.ok(css.includes('.fila-cabeza{flex-wrap:wrap}'));
  assert.match(regla('.rejilla-matriz .matriz-columna'), /white-space:normal/);
  assert.match(regla('.caja-tres .hijo-cabeza'), /flex-wrap:wrap/);
});

test('#7 #19 palabras enteras, títulos equilibrados y un cero que se lee como cero', () => {
  assert.match(regla('.ocupante{'), /overflow-wrap:break-word/);
  assert.doesNotMatch(regla('.ocupante{').split('/*')[0], /anywhere/);
  assert.match(regla('.ocupante{'), /hyphens:auto/);
  assert.match(regla('.representacion{'), /text-wrap:balance/);
  assert.match(regla('.hijo-cabeza .numero,'), /font-family:var\(--sans\)/);
  assert.match(readFileSync(new URL('../index.html', import.meta.url), 'utf8'), /<html lang="es">/, 'hyphens:auto necesita el idioma');
});
