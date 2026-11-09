// Vista clasificar (ui/clasificar.js): la lista de una posición como piezas
// por clasificar y la cruceta como diez huecos (VG, 7-11 noche: por hojas).
// Lo que no toca el DOM se prueba en Node con un eje real (el ejemplo de la
// compra, datos inventados); el arrastre y los toques se comprueban en el
// navegador.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { ejemploCompra, ejemploCuenta } from '../ejemplos/ikisai/compra-food.mjs';
import { EPOCA_0, PV, mapped } from '../src/index.js';
import {
  modeloClasificar, htmlClasificar, vistaClasificar, posicionDe, posicionesDe, escribirColocacion, elementoDe,
  colocarEnLente, quitarDeLente, lenteDe, elegirModoClasificar, modoClasificar, huecoDe, colocacionDe, claveDe, MODOS_CLASIFICAR,
} from '../antigua/ui/clasificar.js';

const T = '2026-11-07T16:00:00Z';

async function compra() {
  const base = await ejemploCompra();
  const cuenta = await ejemploCuenta(base.eje, base.compra);
  return { ...base, cuenta };
}

const piezasHtml = (html) => [...html.matchAll(/data-pieza="([^"]+)"/g)].map((m) => m[1]);
const huecosHtml = (html) => [...html.matchAll(/data-hueco="(\d)"/g)].map((m) => Number(m[1]));

// Por hojas, la materia prima es la lista de la posición: una décupla es una pieza; cada elemento de una
// lista (un array solo de hojas), una pieza aparte, con su índice en la clave ('id#3[1]').

test('clasificar: la lista de la posición como piezas por llegada y la cruceta como diez huecos', async () => {
  const { eje, compra: c, cuenta } = await compra();
  // compra 3 = ['huesped', 'cocina']: una lista, dos piezas con la misma llegada y en su orden.
  const m = modeloClasificar(eje, c.id, [3]);
  assert.deepEqual(m.piezas.map((p) => [p.clave, p.n, p.llegada, p.texto]), [[c.id + '#3[0]', 1, 0, 'huesped'], [c.id + '#3[1]', 2, 0, 'cocina']]);
  // compra 1 = [[menú], [1], ['EUR 12']]: una décupla, una sola pieza; la cuenta, escrita encima, la segunda.
  const uno = modeloClasificar(eje, c.id, [1]);
  assert.deepEqual(uno.piezas.map((p) => p.clave), [c.id + '#1', cuenta.id + '#']);
  assert.match(uno.piezas[0].texto, /^→ [0-9a-f]{8} · \[3\]$/); // la décupla se nombra por su 0: la referencia al menú
  // Diez huecos: las subposiciones 3.d, nombradas por la regla corta de la profundidad 1, con el PV de la cruceta.
  assert.deepEqual(m.huecos.map((h) => h.nombre), PV.map((_, d) => EPOCA_0.reglaCorta(1, d)));
  assert.deepEqual(m.huecos.map((h) => h.pv), [...PV]);
  assert.deepEqual(m.huecos.map((h) => h.dir), ['3000000000', '3100000000', '3200000000', '3300000000', '3400000000', '3500000000', '3600000000', '3700000000', '3800000000', '3900000000']);
  assert.equal(m.nombre, '3 comunicación');
  const html = htmlClasificar(m, { modo: 'lente', elegida: null });
  assert.deepEqual(piezasHtml(html), m.piezas.map((p) => p.clave));
  assert.match(html, /<span class="cl-n">2<\/span><span class="cl-t">cocina · en lista<\/span>/);
  assert.deepEqual(huecosHtml(html), [...mapped.MATRIZ.flat(), 0]); // la cruceta como la matriz de Mapped, con el 0 debajo
  assert.match(html, /aria-label="Ver con esta lente: 2 con qué condición, criterios \(3200000000\)"/);
  assert.match(html, /data-modo-clasificar="lente" aria-pressed="true"/);
  assert.match(html, /role="status" aria-live="polite"/);
  // En la raíz, los huecos son la cruceta con los nombres de la profundidad 0 y sin subtítulo.
  const raiz = modeloClasificar(eje, c.id, []);
  assert.deepEqual(raiz.huecos.map((h) => h.nombre), [...PV]);
  assert.ok(raiz.huecos.every((h) => h.pv === null));
  assert.equal(raiz.nombre, 'raíz del foco');
});

test('clasificar, modo lente: colocar solo cambia cómo se ve; el eje no cambia', async () => {
  const { eje, compra: c } = await compra();
  const antes = eje.orden.length;
  quitarDeLente(c.id, [3]);
  const clave = c.id + '#3[1]';
  assert.deepEqual(colocarEnLente(c.id, [3], clave, 3), { [clave]: 3 });
  const m = modeloClasificar(eje, c.id, [3], { lenteLocal: lenteDe(c.id, [3]) });
  assert.deepEqual(m.huecos[3].lente.map((p) => p.clave), [clave]);
  assert.equal(m.piezas.length, 2); // sigue en la lista: la lente no clasifica
  const html = htmlClasificar(m, { modo: 'lente' });
  assert.ok(!piezasHtml(html).includes(clave)); // ya no está suelta en la vista…
  assert.match(html, /cocina<\/span> <i>visto como con quién \(comunicación\)<\/i>/); // …sino interpretada en su hueco
  assert.match(html, /data-quitar-lente=""/);
  // En «crear», la lente no cuenta: la pieza sigue por clasificar.
  assert.ok(piezasHtml(htmlClasificar(m, { modo: 'crear' })).includes(clave));
  assert.equal(eje.orden.length, antes);
  assert.deepEqual(quitarDeLente(c.id, [3], clave), {});
  assert.throws(() => colocarEnLente(c.id, [3], clave, 10), /hueco 0–9/);
});

test('clasificar, modo crear: colocar escribe un evento real con su `en`, mueve T y la pieza sale de por clasificar', async () => {
  const { eje, compra: c } = await compra();
  const antes = eje.orden.length;
  const minutos = eje.tiempoSobre(c.id).minuto ?? 0; // lo gastado sobre la compra (VG, 7-11 noche)
  const clave = c.id + '#3[0]';
  const ev = await escribirColocacion(eje, { foco: c.id, posicion: [3], clave, hueco: 3, autor: 'huesped', t: T });
  assert.equal(eje.orden.length, antes + 1);
  assert.equal(eje.obtener(ev.id), ev);
  assert.equal(ev.sobre, c.id);
  assert.equal(ev.en, '3300000000'); // la subposición 3.3 por dirección: ahí sí hay PV (con quién)
  assert.equal(ev.payload, 'huesped'); // el elemento de la lista, tal cual
  assert.deepEqual(ev.contexto.clasifica, { posicion: [3], evento: c.id, camino: [3], indice: 0 });
  assert.equal(ev.contexto.modo, 'pointed');
  assert.equal(eje.tiempoSobre(c.id).minuto, minutos + 1); // un minuto de T, como cualquier escrito de Pointed, anotado en la compra
  const m = modeloClasificar(eje, c.id, [3]);
  assert.deepEqual(m.piezas.map((p) => p.clave), [c.id + '#3[1]']);
  assert.deepEqual(m.clasificadas.map((p) => p.clave), [clave]);
  assert.deepEqual(m.huecos[3].escritos.map((x) => [x.evento, x.colocacion, x.texto]), [[ev.id, true, 'huesped']]);
  assert.ok(!piezasHtml(htmlClasificar(m, { modo: 'crear' })).includes(clave));
  await assert.rejects(escribirColocacion(eje, { foco: c.id, posicion: [3], clave, hueco: 2, autor: 'huesped', t: T }), /ya está clasificada/);
  await assert.rejects(escribirColocacion(eje, { foco: c.id, posicion: [3], clave: 'nada#', hueco: 2, autor: 'huesped', t: T }), /no está en la lista/);
});

test('clasificar, modo crear: un escrito va por referencia; el hueco 0 cae en la posición y no vuelve como pieza', async () => {
  const { eje, compra: c, cuenta } = await compra();
  const ev = await escribirColocacion(eje, { foco: c.id, posicion: [1], clave: cuenta.id + '#', hueco: 0, autor: 'cocina', t: T });
  assert.deepEqual(ev.payload, { ref: cuenta.id }); // las referencias no copian
  assert.equal(ev.en, '1000000000'); // 1.0 es la dirección de la 1: colisiona con ella
  assert.equal(huecoDe(ev.en, [1]), 0);
  const m = modeloClasificar(eje, c.id, [1]);
  assert.deepEqual(m.piezas.map((p) => p.clave), [c.id + '#1']); // ni la cuenta ni su colocación
  assert.deepEqual(m.huecos[0].escritos.map((x) => x.evento), [ev.id]);
  assert.match(m.huecos[0].escritos[0].texto, /^→ [0-9a-f]{8} = \[4\]$/); // la cuenta entera, alcanzada por la referencia
  // La décupla de la compra se coloca por referencia a su camino.
  const dec = await escribirColocacion(eje, { foco: c.id, posicion: [1], clave: c.id + '#1', hueco: 9, autor: 'huesped', t: T });
  assert.deepEqual(dec.payload, { ref: c.id, dir: '1000000000' });
});

test('clasificar: lo escrito por dirección en una subposición se ve en su hueco; la pieza de la lista es otra cosa', async () => {
  const { eje, compra: c } = await compra();
  const nota = await eje.escribir({ autor: 'huesped', sobre: c.id, en: '3700000000', t: T, movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'huesped', a: null }], payload: 'para las 14:00' });
  const m = modeloClasificar(eje, c.id, [3]);
  assert.deepEqual(m.huecos[7].escritos.map((x) => [x.evento, x.colocacion]), [[nota.id, false]]);
  assert.equal(m.piezas.length, 2);
  // Bajar al hueco: la subposición 3.7 tiene su propia lista (lo escrito ahí) y sus huecos de la profundidad 2.
  const sub = modeloClasificar(eje, c.id, [3, 7]);
  assert.deepEqual(sub.piezas.map((p) => p.evento), [nota.id]);
  assert.equal(sub.nombre, '3 comunicación › 7 para cuándo');
  assert.equal(sub.huecos[3].nombre, EPOCA_0.reglaCorta(2, 3));
});

test('clasificar: el elemento que se escribe; lo que no se puede nombrar por dirección se dice', () => {
  const f = 'f'.repeat(64);
  assert.equal(elementoDe({ tipo: 'propio', enLista: true, indice: 1, evento: f, camino: [3], contenido: 'cocina' }), 'cocina');
  assert.deepEqual(elementoDe({ tipo: 'propio', enLista: true, indice: 0, evento: f, camino: [1, 0], contenido: { ref: 'a'.repeat(64) } }), { ref: 'a'.repeat(64) });
  assert.throws(() => elementoDe({ tipo: 'propio', enLista: true, indice: 2, evento: f, camino: [1], contenido: '=LOCAL(1) + 2 EUR' }), /ocupante 3 de una lista no se puede nombrar por dirección/);
  assert.equal(elementoDe({ tipo: 'propio', evento: f, camino: [1, 2], contenido: 'EUR 12' }), 'EUR 12');
  assert.deepEqual(elementoDe({ tipo: 'propio', evento: f, camino: [1, 2], contenido: '=LOCAL(1) + 2 EUR' }), { ref: f, dir: '1200000000' });
  assert.deepEqual(elementoDe({ tipo: 'propio', evento: f, camino: [1], contenido: [['a'], ['b']] }), { ref: f, dir: '1000000000' });
  assert.throws(() => elementoDe({ tipo: 'propio', evento: f, camino: [1, 0], contenido: [['a'], ['b']] }), /no se puede nombrar por dirección/);
  assert.deepEqual(elementoDe({ tipo: 'escrito', evento: f, camino: [], contenido: 'x' }), { ref: f });
  assert.equal(claveDe({ evento: f, camino: [] }), f + '#');
  assert.equal(claveDe({ evento: f, camino: [3], indice: 1 }), f + '#3[1]');
  assert.equal(colocacionDe({ contexto: {} }), null);
});

test('clasificar: posición en foco, posiciones con su número de ocupantes, modos y vista entera', async () => {
  const { eje, compra: c } = await compra();
  assert.deepEqual(posicionDe({ camino: [], en: '' }), []);
  assert.deepEqual(posicionDe({ camino: [1], en: '4' }), [1, 4]);
  const pos = posicionesDe(eje, c.id, [], '3');
  // La raíz (solo escritos), 0 el título, 1 la décupla y la cuenta, 2, 3 y 4 listas de dos (encargo 3b: el 2 nombra
  // también la plantilla de cerrado, mapa §15 [D] N5).
  assert.deepEqual(pos.map((x) => x.n), [0, 1, 2, 2, 2, 2, 1, 0, 0, 0, 0]); // 5: su plantilla (encargo 3c-1)
  assert.deepEqual(pos.filter((x) => x.actual).map((x) => x.valor), ['3']);
  assert.deepEqual([...MODOS_CLASIFICAR], ['lente', 'crear']);
  assert.equal(elegirModoClasificar('crear'), 'crear');
  const html = vistaClasificar({ eje, foco: c.id, camino: [], en: '3', identidad: 'cocina' });
  assert.match(html, /data-modo-clasificar="crear" aria-pressed="true"/);
  assert.match(html, /<select name="identidad">/);
  assert.match(html, /data-pos-clasificar="3" aria-pressed="true"/);
  assert.equal(piezasHtml(html).length, 2);
  assert.equal(elegirModoClasificar('cualquiera'), 'lente');
  assert.equal(modoClasificar(), 'lente');
});

test('clasificar: el botón en index.html, el gancho en app.js y los estilos en ui/ui.css', () => {
  const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8');
  assert.match(leer('../antigua/index.html'), /<button data-modo="clasificar"/);
  const app = leer('../antigua/app.js');
  assert.ok(app.includes("from './ui/clasificar.js'"));
  assert.ok(app.includes('instalarClasificar('));
  assert.ok(app.includes("estado.modo === 'clasificar'"));
  const css = leer('../antigua/ui/ui.css');
  for (const sel of ['.clasificar', '.cl-pieza', '.cl-cruceta', '.cl-hueco', '.cl-destino']) assert.ok(css.includes(sel), 'falta ' + sel);
});
