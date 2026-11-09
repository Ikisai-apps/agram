import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejemploCompra, ejemploCuenta } from '../ejemplos/ikisai/compra-food.mjs';
import { ALCANCES_VISTA, htmlEscena, vistaEscena, representacion } from '../antigua/ui/escena.js';
import { escenaDe, CAPACIDAD, ALCANCES } from '../src/scened.js';

const AHORA = '2026-11-07T15:00:00Z';
const gastaT = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });

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

/** Las filas del HTML: [posición, id, es centro]. */
function filas(html) {
  return [...html.matchAll(/<li class="pieza( centro)?" id="escena-([0-9a-f]+)"[^>]*>\s*<div class="pieza-fila">\s*<button class="abrir" data-ir="([0-9a-f]+)"[^>]*><span class="n">(\d+)<\/span>/g)].map((m) => {
    assert.equal(m[2], m[3]); // el ancla de la fila es el id de su foco
    return [Number(m[4]), m[3], Boolean(m[1])];
  });
}

test('vista Scened: los cuatro alcances de escenaDe, en su orden, y la vista los usa tal cual', async () => {
  const { eje, compra, c2 } = await escenario();
  assert.deepEqual(ALCANCES_VISTA.map((a) => a.alcance), [...ALCANCES]);
  for (const alcance of ALCANCES) {
    const e = escenaDe(eje, c2.id, { alcance, ahora: AHORA });
    assert.equal(e.alcance, alcance);
    const html = htmlEscena(e);
    assert.deepEqual(filas(html).map(([, id]) => id), e.focos.map((f) => f.id));
    assert.match(html, new RegExp(`data-alcance="${alcance}" aria-pressed="true"`));
  }
  const g = escenaDe(eje, compra.id, { alcance: 'general', ahora: AHORA });
  assert.equal(g.recuentos.enEscena, eje.orden.length);
  assert.deepEqual(g.focos.filter((f) => f.centro).map((f) => f.id), [compra.id]);
  assert.equal(g.comun, eje.genesisId);
});

test('vista Scened: una fila por foco, en el orden del marco común, y cada arista enlaza con la fila de su destino por id', async () => {
  const { eje, menu, compra, cuenta, c2, c3 } = await escenario();
  const e = escenaDe(eje, compra.id, { alcance: 'proyecto', ahora: AHORA });
  const html = htmlEscena(e);
  assert.deepEqual(filas(html).map(([p]) => p), e.focos.map((f) => f.posicion));
  assert.deepEqual(filas(html).filter(([, , centro]) => centro).map(([, id]) => id), [compra.id]);
  // Todas las aristas de la escena están en el HTML y apuntan, por id, a una fila que existe.
  const enlaces = [...html.matchAll(/<a class="arista a-(hilo|referencia|formula)" href="#escena-([0-9a-f]+)"/g)];
  assert.equal(enlaces.length, e.aristas.length);
  assert.deepEqual(enlaces.map((m) => m[2]), e.focos.flatMap((f) => f.salen.map((x) => x.aId)));
  const ids = new Set(filas(html).map(([, id]) => id));
  assert.ok(enlaces.every((m) => ids.has(m[2])));
  assert.deepEqual(Object.fromEntries(['hilo', 'referencia', 'formula'].map((t) => [t, enlaces.filter((m) => m[1] === t).length])), e.recuentos.aristas);
  // La cuenta lee con REF la 1.2 de la compra: arista de fórmula a la fila de la compra.
  const pc = e.focos.find((f) => f.id === compra.id).posicion;
  assert.match(html, new RegExp(`<a class="arista a-formula" href="#escena-${compra.id}"[^>]*>fórmula 1 → ${pc} : 1200000000</a>`));
  // Las compras hermanas apuntan por referencia al menú.
  assert.ok(html.includes(`href="#escena-${menu.id}"`));
  assert.ok([c2.id, c3.id, cuenta.id].every((id) => html.includes(`data-escena-mapped="${id}"`)));
  // Recentrar no cambia el ancla del destino: la fila del menú sigue siendo #escena-<id del menú>.
  const otra = htmlEscena(escenaDe(eje, c3.id, { alcance: 'proyecto', ahora: AHORA }));
  assert.ok(otra.includes(`id="escena-${menu.id}"`));
  // Sin corte: ni aviso ni foco fuera; la lectura frente al máximo, que es tope duro (VG, 7-11 noche).
  assert.equal(e.corte, null);
  assert.ok(!html.includes('class="aviso"'));
  assert.ok(html.includes(`${e.recuentos.posicionesEnEscena} de ${CAPACIDAD} posiciones en escena · máximo de Scened (10000, tope duro)`));
  assert.ok(!/tope duro de Scened/.test(html));
  assert.match(html, /aria-valuemax="10000"/);
});

test('vista Scened: si la capacidad corta la escena, el aviso sale arriba y abajo de la lista', async () => {
  const { eje, compra, c2, c3 } = await escenario();
  // VG, 7-11 noche (10.1): lo que hay. La compra trae 24 (ella 10, con la plantilla de cerrado en su 2, encargo 3b; el
  // menú 6, las altas 3, el génesis 1 y la cuenta escrita encima 4); c2 añade 3; c3 pasaría de 28.
  const e = escenaDe(eje, compra.id, { alcance: 'hermanos', ahora: AHORA, capacidad: 28 });
  assert.deepEqual(e.focos.map((f) => f.id), [compra.id, c2.id]);
  assert.deepEqual(e.corte.fuera, [c3.id]);
  const html = htmlEscena(e);
  const avisos = [...html.matchAll(/<div class="aviso">([^<]*)<\/div>/g)].map((m) => m[1]);
  assert.equal(avisos.length, 2);
  assert.equal(avisos[0], avisos[1]);
  assert.match(avisos[0], /^capacidad de la escena: 28 posiciones\. El foco [0-9a-f]{8} \(3º de 3\) la llevaría a 31; la escena se corta ahí y quedan fuera 1 foco: /);
  const lista = html.indexOf('<ol class="piezas">');
  assert.ok(html.indexOf('class="aviso"') < lista && html.lastIndexOf('class="aviso"') > html.indexOf('</ol>'));
  assert.match(html, /28 de 28 posiciones en escena · capacidad bajada \(máximo 10000\) · 1 foco fuera/); // la compra trae una posición más (su 5, encargo 3c-1)
  assert.match(html, /class="barra llena"/);
  // Si no cabe ni el foco, la vista lo dice en vez de quedar vacía.
  const vacia = htmlEscena(escenaDe(eje, compra.id, { ahora: AHORA, capacidad: 10 }));
  assert.match(vacia, /ningún foco cabe en la escena/);
  assert.match(vacia, /class="aviso">capacidad de la escena: 10 posiciones/);
  // El máximo es duro (VG, 7-11 noche): no se puede quitar ni subir.
  assert.throws(() => escenaDe(eje, compra.id, { alcance: 'general', ahora: AHORA, capacidad: Infinity }), /máximo de Scened es duro/);
});

test('vista Scened: todo el eje con más de mil registros llega a la capacidad de 10000 y lo dice', async () => {
  const { Eje } = await import('../src/eje.js');
  // VG, 7-11 noche: el génesis lo emite una persona (antes, un grupo).
  const eje = await Eje.genesis({ demostracion: true, identidad: 'casa', emision: [], foco: 'Casa de prueba', t: '2026-11-07T09:00:00Z' });
  // VG, 7-11 noche (10.1): se cuenta lo que hay. El génesis es un terminal (1) y el menú trae 9.
  const menu = await eje.escribir({ autor: 'casa', sobre: eje.genesisId, t: '2026-11-07T09:00:00Z', movimientos: [gastaT('casa')], payload: ['Menú', ['sopa', 'pan', 'agua', 'fruta', 'café', 'vino', 'postre', 'pan sin gluten']] });
  for (let i = 0; i < 1000; i++) {
    // Cada compra, diez posiciones con contenido: su título y una lista de nueve.
    await eje.escribir({ autor: 'casa', sobre: menu.id, t: '2026-11-07T13:30:00Z', movimientos: [gastaT('casa')], payload: ['Compra ' + i, [{ ref: menu.id, dir: '1000000000' }, 1, 'sopa', 'pan', 'agua', 'fruta', 'café', 'mesa 4', 'sin prisa']] });
  }
  // 1002 registros: el génesis y el menú (10) y 999 compras de diez llenan las 10000; la última queda fuera.
  const e = escenaDe(eje, menu.id, { alcance: 'general', ahora: AHORA });
  assert.equal(e.recuentos.pedidos, 1002);
  assert.equal(e.recuentos.posicionesEnEscena, CAPACIDAD);
  assert.equal(e.recuentos.enEscena, 1001);
  assert.deepEqual(e.corte.fuera, eje.orden.slice(-1));
  const html = htmlEscena(e);
  assert.equal(filas(html).length, 1001);
  const avisos = [...html.matchAll(/<div class="aviso">([^<]*)<\/div>/g)].map((m) => m[1]);
  assert.equal(avisos.length, 2);
  assert.match(avisos[0], /^capacidad de la escena: 10000 posiciones\. El foco [0-9a-f]{8} \(1002º de 1002\) la llevaría a 10010; la escena se corta ahí y quedan fuera 1 foco: /);
  assert.ok(html.includes('10000 de 10000 posiciones en escena · máximo de Scened (10000, tope duro) · 1 foco fuera'));
});

test('vista Scened: un foco terminal se representa por su terminal, y el texto se escapa', async () => {
  const { eje, compra } = await escenario();
  const hilo = escenaDe(eje, compra.id, { alcance: 'hilo', ahora: AHORA });
  assert.equal(hilo.focos[0].id, eje.genesisId);
  assert.equal(representacion(hilo.focos[0]), 'Casa de ejemplo'); // el génesis es un terminal: no tiene posición 0
  assert.match(htmlEscena(hilo), /<span class="rep">Casa de ejemplo<\/span>/);
  assert.ok(!/<span class="rep">—<\/span>/.test(htmlEscena(hilo)));
  const raro = await eje.escribir({ autor: 'huesped', sobre: compra.id, en: '3000000000', t: '2026-11-07T14:30:00Z', movimientos: [gastaT('huesped')], payload: ['<b>"hola"</b> & ==adiós', 'nota'] });
  const html = htmlEscena(escenaDe(eje, raro.id, { alcance: 'hilo', ahora: AHORA }));
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
