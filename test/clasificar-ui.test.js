// Vista clasificar (ui/clasificar.js): la lista de una posición como piezas
// por clasificar y la cruceta como diez huecos. Lo que no toca el DOM se
// prueba en Node con un eje real (el ejemplo de la compra, datos
// inventados); el arrastre y los toques se comprueban en el navegador.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { ejemploCompra, ejemploCuenta } from '../ejemplos/ikisai/compra-food.mjs';
import { EPOCA_0, PV, mapped } from '../src/index.js';
import {
  modeloClasificar, htmlClasificar, vistaClasificar, posicionDe, posicionesDe, escribirColocacion, elementoDe,
  colocarEnLente, quitarDeLente, lenteDe, elegirModoClasificar, modoClasificar, huecoDe, colocacionDe, claveDe, MODOS_CLASIFICAR,
} from '../ui/clasificar.js';

const T = '2026-11-07T16:00:00Z';

async function compra() {
  const base = await ejemploCompra();
  const cuenta = await ejemploCuenta(base.eje, base.compra);
  return { ...base, cuenta };
}

const piezasHtml = (html) => [...html.matchAll(/data-pieza="([^"]+)"/g)].map((m) => m[1]);
const huecosHtml = (html) => [...html.matchAll(/data-hueco="(\d)"/g)].map((m) => Number(m[1]));

test('clasificar: la lista de la posición como piezas por llegada y la cruceta como diez huecos', async () => {
  const { eje, compra: c, cuenta } = await compra();
  const m = modeloClasificar(eje, c.id, [1]);
  assert.deepEqual(m.piezas.map((p) => p.llegada), [0, 1, 2, 3]);
  assert.deepEqual(m.piezas.map((p) => p.clave), [c.id + '#1.0', c.id + '#1.1', c.id + '#1.2', cuenta.id + '#']);
  assert.deepEqual(m.piezas.map((p) => p.texto).slice(1, 3), ['1', 'EUR 12']);
  assert.match(m.piezas[0].texto, /^→ [0-9a-f]{8} = \[3\]$/); // la referencia al menú, con lo que alcanza
  // Diez huecos: las subposiciones 1.d, nombradas por la regla corta de la profundidad 1, con el PV de la cruceta.
  assert.deepEqual(m.huecos.map((h) => h.nombre), PV.map((_, d) => EPOCA_0.reglaCorta(1, d)));
  assert.deepEqual(m.huecos.map((h) => h.pv), [...PV]);
  assert.deepEqual(m.huecos.map((h) => h.dir), ['1000000000', '1100000000', '1200000000', '1300000000', '1400000000', '1500000000', '1600000000', '1700000000', '1800000000', '1900000000']);
  assert.equal(m.nombre, '1 recursos');
  const html = htmlClasificar(m, { modo: 'lente', elegida: null });
  assert.deepEqual(piezasHtml(html), m.piezas.map((p) => p.clave));
  assert.deepEqual(huecosHtml(html), [...mapped.MATRIZ.flat(), 0]); // la cruceta como la matriz de Mapped, con el 0 debajo
  assert.match(html, /aria-label="Ver con esta lente: 2 con qué condición, criterios \(1200000000\)"/);
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
  quitarDeLente(c.id, [1]);
  const clave = c.id + '#1.2';
  assert.deepEqual(colocarEnLente(c.id, [1], clave, 2), { [clave]: 2 });
  const m = modeloClasificar(eje, c.id, [1], { lenteLocal: lenteDe(c.id, [1]) });
  assert.deepEqual(m.huecos[2].lente.map((p) => p.clave), [clave]);
  assert.equal(m.piezas.length, 4); // sigue en la lista: la lente no clasifica
  const html = htmlClasificar(m, { modo: 'lente' });
  assert.ok(!piezasHtml(html).includes(clave)); // ya no está suelta en la vista…
  assert.match(html, /EUR 12<\/span> <i>visto como con qué condición \(criterios\)<\/i>/); // …sino interpretada en su hueco
  assert.match(html, /data-quitar-lente=""/);
  // En «crear», la lente no cuenta: la pieza sigue por clasificar.
  assert.ok(piezasHtml(htmlClasificar(m, { modo: 'crear' })).includes(clave));
  assert.equal(eje.orden.length, antes);
  assert.deepEqual(quitarDeLente(c.id, [1], clave), {});
  assert.throws(() => colocarEnLente(c.id, [1], clave, 10), /hueco 0–9/);
});

test('clasificar, modo crear: colocar escribe un evento real con su `en`, mueve T y la pieza sale de por clasificar', async () => {
  const { eje, compra: c } = await compra();
  const antes = eje.orden.length;
  const minutos = eje.saldoT('huesped', 'minuto');
  const ev = await escribirColocacion(eje, { foco: c.id, posicion: [1], clave: c.id + '#1.1', hueco: 1, autor: 'huesped', t: T });
  assert.equal(eje.orden.length, antes + 1);
  assert.equal(eje.obtener(ev.id), ev);
  assert.equal(ev.sobre, c.id);
  assert.equal(ev.en, '1100000000'); // la subposición 1.1 por dirección: ahí sí hay PV (cuánto)
  assert.equal(ev.payload, 1); // el elemento, tal cual
  assert.deepEqual(ev.contexto.clasifica, { posicion: [1], evento: c.id, camino: [1, 1] });
  assert.equal(ev.contexto.modo, 'pointed');
  assert.equal(eje.saldoT('huesped', 'minuto'), minutos - 1); // un minuto de T, como cualquier escrito de Pointed
  const m = modeloClasificar(eje, c.id, [1]);
  assert.ok(!m.piezas.some((p) => p.clave === c.id + '#1.1'));
  assert.deepEqual(m.clasificadas.map((p) => p.clave), [c.id + '#1.1']);
  assert.deepEqual(m.huecos[1].escritos.map((x) => [x.evento, x.colocacion, x.texto]), [[ev.id, true, '1']]);
  assert.ok(!piezasHtml(htmlClasificar(m, { modo: 'crear' })).includes(c.id + '#1.1'));
  await assert.rejects(escribirColocacion(eje, { foco: c.id, posicion: [1], clave: c.id + '#1.1', hueco: 2, autor: 'huesped', t: T }), /ya está clasificada/);
  await assert.rejects(escribirColocacion(eje, { foco: c.id, posicion: [1], clave: 'nada#', hueco: 2, autor: 'huesped', t: T }), /no está en la lista/);
});

test('clasificar, modo crear: un escrito va por referencia; el hueco 0 cae en la posición y no vuelve como pieza', async () => {
  const { eje, compra: c, cuenta } = await compra();
  const ev = await escribirColocacion(eje, { foco: c.id, posicion: [1], clave: cuenta.id + '#', hueco: 0, autor: 'cocina', t: T });
  assert.deepEqual(ev.payload, { ref: cuenta.id }); // las referencias no copian
  assert.equal(ev.en, '1000000000'); // 1.0 es la dirección de la 1: colisiona con ella
  assert.equal(huecoDe(ev.en, [1]), 0);
  const m = modeloClasificar(eje, c.id, [1]);
  assert.deepEqual(m.piezas.map((p) => p.clave), [c.id + '#1.0', c.id + '#1.1', c.id + '#1.2']); // ni la cuenta ni su colocación
  assert.deepEqual(m.huecos[0].escritos.map((x) => x.evento), [ev.id]);
  assert.match(m.huecos[0].escritos[0].texto, /^→ [0-9a-f]{8} = \[4\]$/); // la cuenta entera, alcanzada por la referencia
});

test('clasificar: lo escrito por dirección en una subposición se ve en su hueco; la pieza de la lista es otra cosa', async () => {
  const { eje, compra: c } = await compra();
  const nota = await eje.escribir({ autor: 'huesped', sobre: c.id, en: '1700000000', t: T, movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'huesped', a: null }], payload: 'para las 14:00' });
  const m = modeloClasificar(eje, c.id, [1]);
  assert.deepEqual(m.huecos[7].escritos.map((x) => [x.evento, x.colocacion]), [[nota.id, false]]);
  assert.equal(m.piezas.length, 4);
  // Bajar al hueco: la subposición 1.7 tiene su propia lista (lo escrito ahí) y sus huecos de la profundidad 2.
  const sub = modeloClasificar(eje, c.id, [1, 7]);
  assert.deepEqual(sub.piezas.map((p) => p.evento), [nota.id]);
  assert.equal(sub.nombre, '1 recursos › 7 para cuándo');
  assert.equal(sub.huecos[3].nombre, EPOCA_0.reglaCorta(2, 3));
});

test('clasificar: el elemento que se escribe; un ocupante 1 que no se puede nombrar por dirección se dice', () => {
  const f = 'f'.repeat(64);
  assert.equal(elementoDe({ tipo: 'propio', evento: f, camino: [1, 2], contenido: 'EUR 12' }), 'EUR 12');
  assert.deepEqual(elementoDe({ tipo: 'propio', evento: f, camino: [1, 0], contenido: { ref: 'a'.repeat(64) } }), { ref: 'a'.repeat(64) });
  assert.deepEqual(elementoDe({ tipo: 'propio', evento: f, camino: [1, 2], contenido: '=LOCAL(1) + 2 EUR' }), { ref: f, dir: '1200000000' });
  assert.deepEqual(elementoDe({ tipo: 'propio', evento: f, camino: [1, 2], contenido: ['a', 'b'] }), { ref: f, dir: '1200000000' });
  assert.throws(() => elementoDe({ tipo: 'propio', evento: f, camino: [1, 0], contenido: ['a', 'b'] }), /no se puede nombrar por dirección/);
  assert.deepEqual(elementoDe({ tipo: 'escrito', evento: f, camino: [], contenido: 'x' }), { ref: f });
  assert.equal(claveDe({ evento: f, camino: [] }), f + '#');
  assert.equal(colocacionDe({ contexto: {} }), null);
});

test('clasificar: posición en foco, posiciones con su número de ocupantes, modos y vista entera', async () => {
  const { eje, compra: c } = await compra();
  assert.deepEqual(posicionDe({ camino: [], en: '' }), []);
  assert.deepEqual(posicionDe({ camino: [1], en: '4' }), [1, 4]);
  const pos = posicionesDe(eje, c.id, [], '1');
  assert.deepEqual(pos.map((x) => x.n), [0, 1, 4, 1, 2, 2, 0, 0, 0, 0, 0]);
  assert.deepEqual(pos.filter((x) => x.actual).map((x) => x.valor), ['1']);
  assert.deepEqual([...MODOS_CLASIFICAR], ['lente', 'crear']);
  assert.equal(elegirModoClasificar('crear'), 'crear');
  const html = vistaClasificar({ eje, foco: c.id, camino: [], en: '1', identidad: 'cocina' });
  assert.match(html, /data-modo-clasificar="crear" aria-pressed="true"/);
  assert.match(html, /<select name="identidad">/);
  assert.match(html, /data-pos-clasificar="1" aria-pressed="true"/);
  assert.equal(piezasHtml(html).length, 4);
  assert.equal(elegirModoClasificar('cualquiera'), 'lente');
  assert.equal(modoClasificar(), 'lente');
});

test('clasificar: el botón en index.html, el gancho en app.js y los estilos en ui/ui.css', () => {
  const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8');
  assert.match(leer('../index.html'), /<button data-modo="clasificar"/);
  const app = leer('../app.js');
  assert.ok(app.includes("from './ui/clasificar.js'"));
  assert.ok(app.includes('instalarClasificar('));
  assert.ok(app.includes("estado.modo === 'clasificar'"));
  const css = leer('../ui/ui.css');
  for (const sel of ['.clasificar', '.cl-pieza', '.cl-cruceta', '.cl-hueco', '.cl-destino']) assert.ok(css.includes(sel), 'falta ' + sel);
});
