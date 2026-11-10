// «Opinar» (carta/opinar.js), las funciones puras: clasificar un elemento a partir de un árbol de atributos simulado
// (sin DOM), la opinión con su contexto, la serialización y la exportación, la lista en un almacén, y que dom.js pinta
// los atributos data-nodo que la clasificación lee.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clasificar, entornoDe, nuevaOpinion, serializar, exportar, versionDeSw, legible, leerOpiniones, anadirOpinion, borrarUltima, vaciarOpiniones, leerActivo, guardarActivo, estadoDe, CLAVES } from '../carta/opinar.js';
import { html } from '../carta/dom.js';
import { arbol } from '../carta/carta.js';
import { ejemploCompra } from '../ejemplos/ikisai/compra-food.mjs';

/** Un elemento simulado: dataset, hijos y texto; `padre` lo enlaza. */
const el = (dataset, textContent = '', padre = null) => ({ dataset, textContent, parentElement: padre });
const almacenFalso = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
};

/** carta > pv (bloque) > ul sin nodo > ocupante (referencia) */
function ocupanteEnBloque() {
  const carta = el({ nodo: 'carta', x: 'X-FOCO', nodoModo: 'apilada', nodoAncho: '400', nodoAlto: '700', nodoRender: 'sobrio', nodoX0: 'Pedido 12' });
  const escena = el({}, '', carta);
  const pv = el({ nodo: 'pv', pv: '3', x: 'X-FOCO', nivel: '3', nodoTam: 'bloque', nodoRep: 'texto:hoja@3' }, 'Productos …', escena);
  const ul = el({}, '', pv);
  const ocupante = el({ nodo: 'ocupante', x: 'X-HIJO', nodoX0: 'Tomates', nodoRep: 'texto@0' }, '  Tomates \n  del huerto  ', ul);
  const texto = el({}, 'Tomates', ocupante);
  return { carta, pv, ocupante, texto };
}

test('clasificar: un ocupante dentro de un PV en bloque lleva tipo, pv, X, X0, tamaño y ruta', () => {
  const { ocupante, texto } = ocupanteEnBloque();
  for (const tocado of [ocupante, texto]) {
    const n = clasificar(tocado);
    assert.equal(n.tipo, 'ocupante');
    assert.equal(n.pv, 3);
    assert.equal(n.X, 'X-HIJO');
    assert.equal(n.X0, 'Tomates');
    assert.equal(n.d, null);
    assert.equal(n.tamano, 'bloque');
    assert.equal(n.representacion, 'texto@0');
    assert.equal(n.texto, 'Tomates del huerto');
    assert.deepEqual(n.ruta, ['carta', 'pv']);
  }
});

test('clasificar: un campo lleva su posición d, en el 0 del foco; un elemento sin data-nodo cae en su ancestro; sin ninguno es «otro»', () => {
  const carta = el({ nodo: 'carta', x: 'X1', nodoX0: 'Uno' });
  const foco = el({ nodo: 'foco', centro: '0', x: 'X1', nodoTam: 'foco', nodoCara: 'anverso' }, 'Uno', carta);
  const campo = el({ nodo: 'campo', nodoD: '4' }, 'Precio', foco);
  const etiqueta = el({}, 'Precio', campo);
  const n = clasificar(etiqueta);
  assert.deepEqual([n.tipo, n.pv, n.X, n.X0, n.d, n.tamano], ['campo', 0, 'X1', 'Uno', 4, 'foco']);
  assert.deepEqual(n.ruta, ['carta', 'foco']);
  assert.equal(clasificar(foco).cara, 'anverso');
  const suelto = clasificar(el({}, 'nada'));
  assert.deepEqual([suelto.tipo, suelto.pv, suelto.X, suelto.ruta], ['otro', null, null, []]);
});

test('clasificar: el 0 del registro no se toma de otro registro', () => {
  const carta = el({ nodo: 'carta', x: 'X1', nodoX0: 'Uno' });
  const ocu = el({ nodo: 'ocupante', x: 'X2' }, 'sin 0', el({ nodo: 'pv', pv: '8', x: 'X1' }, '', carta));
  const n = clasificar(ocu);
  assert.equal(n.X, 'X2');
  assert.equal(n.X0, null);
});

test('entornoDe: modo, tamaño de pantalla, render y foco salen de la raíz', () => {
  const { texto } = ocupanteEnBloque();
  assert.deepEqual(entornoDe(texto), { modo: 'apilada', ancho: 400, alto: 700, render: 'sobrio', foco: { X: 'X-FOCO', X0: 'Pedido 12' } });
  assert.equal(legible(clasificar(texto), entornoDe(texto)).includes('Sequenced'), true);
});

test('nuevaOpinion: guarda fecha ISO, modo, cuenta, foco, nodo y el texto recortado', () => {
  const { ocupante } = ocupanteEnBloque();
  const op = nuevaOpinion({ nodo: clasificar(ocupante), entorno: entornoDe(ocupante), version: 'agram-carta-v5', cuenta: 'Víctor', ahora: Date.parse('2026-11-10T09:30:00Z') }, '  demasiado pequeño  ');
  assert.equal(op.fecha, '2026-11-10T09:30:00.000Z');
  assert.equal(op.version, 'agram-carta-v5');
  assert.equal(op.cuenta, 'Víctor');
  assert.equal(op.modo, 'apilada');
  assert.deepEqual([op.ancho, op.alto, op.render], [400, 700, 'sobrio']);
  assert.deepEqual(op.foco, { X: 'X-FOCO', X0: 'Pedido 12' });
  assert.equal(op.nodo.tipo, 'ocupante');
  assert.equal(op.texto, 'demasiado pequeño');
  assert.equal(nuevaOpinion({ nodo: op.nodo }, 'x').cuenta, 'ejemplo');
});

test('el texto visible del nodo se recorta a 80 caracteres', () => {
  assert.equal(clasificar(el({ nodo: 'pv' }, 'a'.repeat(200))).texto.length, 80);
});

test('serializar y exportar: JSON válido con todas las opiniones y un nombre con la fecha', () => {
  const { ocupante } = ocupanteEnBloque();
  const lista = ['una', 'dos', 'tres'].map((x) => nuevaOpinion({ nodo: clasificar(ocupante), entorno: entornoDe(ocupante) }, x));
  const a = exportar(lista, Date.parse('2026-11-10T23:59:00Z'));
  assert.equal(a.nombre, 'agram-opiniones-2026-11-10.json');
  assert.deepEqual(JSON.parse(a.contenido), JSON.parse(serializar(lista)));
  assert.deepEqual(JSON.parse(a.contenido).map((o) => o.texto), ['una', 'dos', 'tres']);
  assert.match(a.contenido, /\n  \{/); // bonito
});

test('la lista vive en el almacén: añadir, contar, borrar la última, vaciar; el conmutador se recuerda', () => {
  const al = almacenFalso();
  assert.deepEqual(estadoDe(al), { activo: false, cuantas: 0 });
  anadirOpinion(al, { texto: 'a' });
  anadirOpinion(al, { texto: 'b' });
  assert.equal(estadoDe(al).cuantas, 2);
  assert.equal(borrarUltima(al).texto, 'b');
  assert.deepEqual(leerOpiniones(al), [{ texto: 'a' }]);
  guardarActivo(al, true);
  assert.equal(al.getItem(CLAVES.activo), '1');
  assert.equal(leerActivo(al), true);
  vaciarOpiniones(al);
  assert.deepEqual(leerOpiniones(al), []);
  assert.equal(borrarUltima(al), null);
  // un almacén roto no rompe nada
  const roto = { getItem() { throw new Error('no'); }, setItem() { throw new Error('no'); } };
  assert.deepEqual(leerOpiniones(roto), []);
  assert.equal(anadirOpinion(roto, { texto: 'x' }), false);
  assert.equal(leerActivo(roto), false);
  guardarActivo(roto, true);
  assert.equal(CLAVES.opiniones, 'agram.opiniones');
});

test('versionDeSw lee la VERSION de sw.js', () => {
  assert.equal(versionDeSw("const VERSION = 'agram-carta-v5';"), 'agram-carta-v5');
  assert.equal(versionDeSw('nada'), null);
});

test('dom.js pinta data-nodo en cada pieza de la carta y la raíz lleva modo, ancho, alto y render', async () => {
  const c = await ejemploCompra();
  const a = await arbol({ foco: { X: c.compra, pv: 0 }, niveles: { 3: 3 } }, c.eje, c.yo ?? c.eje.identidades()[0], { ancho: 400, alto: 700, hueco: 48, tarjeta: 160 });
  const h = html(a, { opinar: { activo: true, cuantas: 2 } });
  const tipos = new Set([...h.matchAll(/data-nodo="([a-z]+)"/g)].map((m) => m[1]));
  for (const t of ['carta', 'barra', 'control', 'foco', 'pv', 'campo']) assert.ok(tipos.has(t), `falta data-nodo="${t}"`);
  assert.match(h, /data-nodo="carta" data-nodo-modo="apilada" data-nodo-render="sobrio" data-nodo-ancho="400" data-nodo-alto="700"/);
  assert.match(h, /data-nodo="pv" data-nodo-tam="bloque"/);
  assert.match(h, /data-opinar-ctl="alternar" aria-pressed="true"[^>]*>opinar · 2</);
  for (const k of ['exportar', 'copiar', 'borrar']) assert.match(h, new RegExp(`data-opinar-ctl="${k}"`));
  // sin opiniones solo está el conmutador
  assert.doesNotMatch(html(a, { opinar: { activo: false, cuantas: 0 } }), /data-opinar-ctl="exportar"/);
});
