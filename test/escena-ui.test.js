import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejemploCompra, ejemploCuenta } from '../ejemplos/ikisai/compra-food.mjs';
import { ALCANCES_VISTA, focosDe, escenaVista, htmlEscena, vistaEscena } from '../ui/escena.js';
import { escenaDe, TOPE } from '../src/scened.js';
import { comparables, proyectoDe } from '../src/tiempo.js';

const AHORA = '2026-11-07T15:00:00Z';
const gastaT = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });
const corto = (id) => id.slice(0, 8);

/** La compra con su cuenta y dos compras hermanas más del mismo menú (datos inventados). */
async function escenario() {
  const base = await ejemploCompra();
  const { eje, menu, compra } = base;
  const cuenta = await ejemploCuenta(eje, compra);
  const otra = (t, titulo) => eje.escribir({ autor: 'huesped', sobre: menu.id, t, movimientos: [gastaT('huesped')], payload: [titulo, [{ ref: menu.id, dir: '1000000000' }, 1]] });
  const c2 = await otra('2026-11-07T13:40:00Z', 'Segunda compra');
  const c3 = await otra('2026-11-07T13:50:00Z', 'Tercera compra');
  return { ...base, cuenta, c2, c3 };
}

/** Las filas del HTML: [posición, id corto, es centro]. */
function filas(html) {
  return [...html.matchAll(/<li class="pieza( centro)?" id="escena-(\d+)"[^>]*>\s*<div class="pieza-fila">\s*<button class="abrir" data-ir="([0-9a-f]+)"/g)].map((m) => [Number(m[2]), corto(m[3]), Boolean(m[1])]);
}

test('vista Scened: cuatro alcances; hermanos e hilo son los de escenaDe; proyecto y general, las cohortes del 8', async () => {
  const { eje, alta, menu, compra, cuenta, c2, c3 } = await escenario();
  assert.deepEqual(ALCANCES_VISTA.map((a) => a.alcance), ['hermanos', 'hilo', 'proyecto', 'general']);
  assert.deepEqual(focosDe(eje, c2.id, 'hermanos'), [c2.id, compra.id, c3.id]); // el foco primero; los demás, por llegada
  assert.deepEqual(focosDe(eje, compra.id, 'hilo'), [compra.id, menu.id, alta.id, eje.genesisId]);
  assert.equal(proyectoDe(eje, compra.id).id, alta.id); // el registro del hilo que cuelga del génesis
  assert.deepEqual(focosDe(eje, compra.id, 'proyecto'), [compra.id, alta.id, menu.id, cuenta.id, c2.id, c3.id]);
  assert.deepEqual(focosDe(eje, compra.id, 'general'), [compra.id, ...eje.orden.filter((id) => id !== compra.id)]);
  assert.deepEqual(new Set(focosDe(eje, compra.id, 'general')), new Set(comparables(eje, compra.id, 'general').map((e) => e.id)));
  assert.throws(() => focosDe(eje, compra.id, 'todo'), /alcance desconocido: todo/);
  // hermanos e hilo: la escena es la de escenaDe, tal cual.
  for (const alcance of ['hermanos', 'hilo']) {
    assert.deepEqual(escenaVista(eje, c2.id, { alcance, ahora: AHORA }), escenaDe(eje, c2.id, { alcance, ahora: AHORA }));
  }
  const g = escenaVista(eje, compra.id, { alcance: 'general', ahora: AHORA });
  assert.equal(g.alcance, 'general');
  assert.equal(g.recuentos.enEscena, eje.orden.length);
  assert.deepEqual(g.focos.filter((f) => f.centro).map((f) => f.id), [compra.id]);
  assert.equal(g.comun, eje.genesisId);
});

test('vista Scened: una fila por foco, en el orden del marco común, y cada arista enlaza con la fila de su destino', async () => {
  const { eje, menu, compra, cuenta, c2, c3 } = await escenario();
  const e = escenaVista(eje, compra.id, { alcance: 'proyecto', ahora: AHORA });
  const html = htmlEscena(e);
  assert.deepEqual(filas(html).map(([p]) => p), e.focos.map((f) => f.posicion));
  assert.deepEqual(filas(html).map(([, id]) => id), e.focos.map((f) => corto(f.id)));
  assert.deepEqual(filas(html).filter(([, , centro]) => centro).map(([, id]) => id), [corto(compra.id)]);
  // Todas las aristas de la escena están en el HTML y apuntan a una fila que existe.
  const enlaces = [...html.matchAll(/<a class="arista a-(hilo|referencia|formula)" href="#escena-(\d+)"/g)];
  assert.equal(enlaces.length, e.aristas.length);
  const ids = new Set(filas(html).map(([p]) => p));
  assert.ok(enlaces.every((m) => ids.has(Number(m[2]))));
  assert.deepEqual(Object.fromEntries(['hilo', 'referencia', 'formula'].map((t) => [t, enlaces.filter((m) => m[1] === t).length])), e.recuentos.aristas);
  // La cuenta lee con REF la 1.2 de la compra: arista de fórmula a la fila de la compra.
  const pc = e.focos.find((f) => f.id === compra.id).posicion;
  assert.match(html, new RegExp(`<a class="arista a-formula" href="#escena-${pc}"[^>]*>fórmula 1 → ${pc} : 1200000000</a>`));
  // Las compras hermanas apuntan por referencia al menú.
  const pm = e.focos.find((f) => f.id === menu.id).posicion;
  assert.ok(html.includes(`href="#escena-${pm}"`));
  assert.ok([c2.id, c3.id, cuenta.id].every((id) => html.includes(`data-escena-mapped="${id}"`)));
  // Sin corte: ni aviso ni foco fuera; la lectura frente al tope duro de Scened.
  assert.equal(e.corte, null);
  assert.ok(!html.includes('class="aviso"'));
  assert.match(html, new RegExp(`${e.recuentos.posicionesLeidas} de ${TOPE} posiciones leídas · tope duro de Scened`));
  assert.match(html, /aria-valuemax="10000"/);
  assert.match(html, /data-alcance="proyecto" aria-pressed="true"/);
  assert.match(html, /data-alcance="hermanos" aria-pressed="false"/);
});

test('vista Scened: si el tope corta la escena, el aviso sale arriba y abajo de la lista', async () => {
  const { eje, compra, c2, c3 } = await escenario();
  // La compra lee 5 décuplas (ella, el menú, las altas, el génesis y la cuenta escrita encima); c2 añade una; c3 pasaría de 60.
  const e = escenaVista(eje, compra.id, { alcance: 'hermanos', ahora: AHORA, tope: 60 });
  assert.deepEqual(e.focos.map((f) => f.id), [compra.id, c2.id]);
  assert.deepEqual(e.corte.fuera, [c3.id]);
  const html = htmlEscena(e);
  const avisos = [...html.matchAll(/<div class="aviso">([^<]*)<\/div>/g)].map((m) => m[1]);
  assert.equal(avisos.length, 2);
  assert.equal(avisos[0], avisos[1]);
  assert.match(avisos[0], /^tope de Scened: 60 posiciones leídas\. El foco [0-9a-f]{8} \(3º de 3\) llevaría la lectura a 70; la escena se corta ahí y quedan fuera 1 foco: /);
  const lista = html.indexOf('<ol class="piezas">');
  assert.ok(html.indexOf('class="aviso"') < lista && html.lastIndexOf('class="aviso"') > html.indexOf('</ol>'));
  assert.match(html, /60 de 60 posiciones leídas · tope rebajado · 1 foco fuera/);
  assert.match(html, /class="barra llena"/);
  // Si no cabe ni el foco, la vista lo dice en vez de quedar vacía.
  const vacia = htmlEscena(escenaVista(eje, compra.id, { ahora: AHORA, tope: 10 }));
  assert.match(vacia, /ningún foco cabe en la escena/);
  assert.match(vacia, /class="aviso">tope de Scened: 10 posiciones leídas/);
  // El tope de Scened no se sube desde la vista.
  assert.throws(() => escenaVista(eje, compra.id, { tope: TOPE + 1 }), /el tope de Scened es 10000/);
});

test('vista Scened: todo el eje con más de mil registros llega al tope duro de 10000 y lo dice', async () => {
  const { Eje } = await import('../src/eje.js');
  const eje = await Eje.genesis({ identidad: 'casa', tipo: 'grupo', emision: [{ token: 'T', escala: 'minuto', cantidad: 2000 }], foco: 'Casa de prueba', t: '2026-11-07T09:00:00Z' });
  const menu = await eje.escribir({ autor: 'casa', sobre: eje.genesisId, t: '2026-11-07T09:00:00Z', movimientos: [gastaT('casa')], payload: ['Menú', ['sopa', 'pan']] });
  for (let i = 0; i < 1000; i++) {
    await eje.escribir({ autor: 'casa', sobre: menu.id, t: '2026-11-07T13:30:00Z', movimientos: [gastaT('casa')], payload: ['Compra ' + i, [{ ref: menu.id, dir: '1000000000' }, 1]] });
  }
  // 1002 registros, uno por décupla: entran 1000 (el génesis, el menú y 998 compras) y quedan fuera los dos últimos.
  const e = escenaVista(eje, menu.id, { alcance: 'general', ahora: AHORA });
  assert.equal(e.recuentos.pedidos, 1002);
  assert.equal(e.recuentos.posicionesLeidas, TOPE);
  assert.equal(e.recuentos.enEscena, 1000);
  assert.deepEqual(e.corte.fuera, eje.orden.slice(-2));
  const html = htmlEscena(e);
  assert.equal(filas(html).length, 1000);
  const avisos = [...html.matchAll(/<div class="aviso">([^<]*)<\/div>/g)].map((m) => m[1]);
  assert.equal(avisos.length, 2);
  assert.match(avisos[0], /^tope de Scened: 10000 posiciones leídas\. El foco [0-9a-f]{8} \(1001º de 1002\) llevaría la lectura a 10010; la escena se corta ahí y quedan fuera 2 focos: /);
  assert.match(html, /10000 de 10000 posiciones leídas · tope duro de Scened · 2 focos fuera/);
});

test('vista Scened: un foco terminal se representa por su terminal, y el texto se escapa', async () => {
  const { eje, compra } = await escenario();
  const hilo = escenaVista(eje, compra.id, { alcance: 'hilo', ahora: AHORA });
  assert.equal(hilo.focos[0].id, eje.genesisId);
  assert.equal(hilo.focos[0].representacion, 'Casa de ejemplo'); // el génesis es un terminal: no tiene posición 0
  assert.match(htmlEscena(hilo), /<span class="rep">Casa de ejemplo<\/span>/);
  const raro = await eje.escribir({ autor: 'huesped', sobre: compra.id, en: '3000000000', t: '2026-11-07T14:30:00Z', movimientos: [gastaT('huesped')], payload: ['<b>"hola"</b> & ==adiós', 'nota'] });
  const html = htmlEscena(escenaVista(eje, raro.id, { alcance: 'hilo', ahora: AHORA }));
  assert.ok(html.includes('&lt;b&gt;&quot;hola&quot;&lt;/b&gt; &amp; ==adiós'));
  assert.ok(!html.includes('<b>"hola"</b>'));
  assert.match(html, /hilo → \d en 3000000000/);
});

test('vista Scened: solo lee, y un foco que no existe se dice en la vista', async () => {
  const { eje, compra } = await escenario();
  const antes = eje.orden.length;
  for (const { alcance } of ALCANCES_VISTA) vistaEscena(eje, compra.id, { alcance });
  assert.equal(eje.orden.length, antes);
  assert.match(vistaEscena(eje, 'nada', { alcance: 'general' }), /^<div class="aviso">No se puede componer la escena: foco desconocido: nada<\/div>$/);
});
