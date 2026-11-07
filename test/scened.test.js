import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejemploCompra, ejemploCuenta } from '../ejemplos/ikisai/compra-food.mjs';
import { escena, escenaDe, render, TOPE, ALCANCES } from '../src/scened.js';
import { mapa } from '../src/mapped.js';
import { ejeTemporal } from '../src/tiempo.js';
import { lectura } from '../src/modos.js';
import { Eje } from '../src/eje.js';
import * as agram from '../src/index.js';

const AHORA = '2026-11-07T15:00:00Z';
const gastaT = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });
const corto = (id) => id.slice(0, 8);

/** La compra del ejemplo y dos compras hermanas más del mismo menú (datos inventados). */
async function comprasHermanas() {
  const base = await ejemploCompra();
  const { eje, menu } = base;
  const otra = (t, titulo, raciones) =>
    eje.escribir({
      autor: 'huesped',
      sobre: menu.id,
      t,
      movimientos: [gastaT('huesped'), { token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 12 * raciones, de: 'huesped', a: 'cocina' }],
      payload: [titulo, [{ ref: menu.id, dir: '1000000000' }, raciones, 'EUR ' + 12 * raciones], [{ ref: menu.id, dir: '2200000000' }]],
    });
  const c2 = await otra('2026-11-07T13:40:00Z', 'Segunda compra del menú', 1);
  const c3 = await otra('2026-11-07T13:50:00Z', 'Tercera compra del menú', 2);
  return { ...base, c2, c3 };
}

test('Scened: el tope es lo que lee de una vez, diez mil posiciones', () => {
  assert.equal(TOPE, 10000);
  assert.equal(TOPE, lectura('scened'));
  assert.deepEqual(ALCANCES, ['hermanos', 'hilo']);
  assert.equal(typeof agram.scened.escena, 'function');
  assert.equal(typeof agram.scened.render, 'function');
});

test('escena de la compra y el menú: marco común, aristas y recuentos', async () => {
  const { eje, menu, compra, alta } = await ejemploCompra();
  const e = escena(eje, [compra.id, menu.id], { ahora: AHORA });
  assert.equal(e.modo, 'scened');
  assert.equal(e.comun, menu.id); // el menú es antecesor de la compra: es el común
  assert.deepEqual(e.focos.map((f) => f.id), [menu.id, compra.id]); // el antecesor antes, aunque se pidiera después
  assert.deepEqual(e.focos.map((f) => f.nivel), [0, 1]);
  assert.deepEqual(e.focos.map((f) => f.posicion), [0, 1]);
  // Cada foco lleva su mapa y su eje temporal tal cual: la escena compone, no recalcula a su manera.
  assert.deepEqual(e.focos[1].mapa, mapa(eje, compra.id));
  assert.deepEqual(e.focos[1].tiempo, ejeTemporal(eje, compra.id, { ahora: AHORA }));
  assert.equal(e.focos[1].representacion, 'Compra del menú del día');
  // Aristas: el hilo (la compra está escrita sobre el menú, en su raíz) y las dos referencias que no copian.
  assert.deepEqual(e.aristas, [
    { tipo: 'hilo', de: 1, a: 0, deId: compra.id, aId: menu.id, saltos: 1, en: '0000000000' },
    { tipo: 'referencia', de: 1, a: 0, deId: compra.id, aId: menu.id, camino: [1, 0], dir: '1000000000' },
    { tipo: 'referencia', de: 1, a: 0, deId: compra.id, aId: menu.id, camino: [2, 0], dir: '2000000000' },
  ]);
  assert.equal(e.focos[0].entran, 3);
  assert.equal(e.focos[1].salen.length, 3);
  // Se leen el génesis, las altas, el menú y la compra: cuatro décuplas, cada una una vez.
  assert.ok(eje.obtener(alta.id));
  assert.equal(e.recuentos.decuplasLeidas, 4);
  assert.equal(e.recuentos.posicionesLeidas, 40);
  assert.deepEqual(e.recuentos.aristas, { hilo: 1, referencia: 2, formula: 0 });
  assert.equal(e.recuentos.referenciasFuera, 0);
  assert.equal(e.recuentos.grupos, 2);
  assert.equal(e.recuentos.pedidos, 2);
  assert.equal(e.recuentos.enEscena, 2);
  assert.equal(e.recuentos.fuera, 0);
  assert.equal(e.recuentos.movimientos, 3); // uno del menú, dos de la compra
  assert.equal(e.corte, null);
  assert.deepEqual(e.avisos, []);
});

test('varias compras hermanas: juntas, por orden de llegada, cada una con su hilo y sus referencias', async () => {
  const { eje, menu, compra, c2, c3 } = await comprasHermanas();
  const e = escena(eje, [c3.id, menu.id, compra.id, c2.id], { ahora: AHORA });
  assert.deepEqual(e.focos.map((f) => f.id), [menu.id, compra.id, c2.id, c3.id]);
  assert.deepEqual(e.focos.slice(1).map((f) => f.hermano), [{ indice: 1, de: 3 }, { indice: 2, de: 3 }, { indice: 3, de: 3 }]);
  assert.ok(e.focos.slice(1).every((f) => f.sobre === menu.id && f.nivel === 1 && f.hermanosEnEje === 3));
  assert.equal(e.recuentos.aristas.hilo, 3);
  assert.equal(e.recuentos.aristas.referencia, 6); // dos por compra, todas al menú
  assert.ok(e.aristas.every((x) => x.a === 0));
  assert.deepEqual(e.focos[3].salen.map((x) => x.tipo + ':' + (x.dir ?? x.en)), ['hilo:0000000000', 'referencia:1000000000', 'referencia:2200000000']);
  assert.equal(e.focos[0].entran, 9);
  // Sin el menú en escena, el común sigue siendo el menú, pero no hay hilo entre focos y las referencias salen fuera.
  const s = escena(eje, [c2.id, compra.id, c3.id], { ahora: AHORA });
  assert.equal(s.comun, menu.id);
  assert.deepEqual(s.focos.map((f) => f.id), [compra.id, c2.id, c3.id]);
  assert.deepEqual(s.focos.map((f) => f.nivel), [1, 1, 1]);
  assert.deepEqual(s.aristas, []);
  assert.equal(s.recuentos.referenciasFuera, 6);
  assert.equal(s.recuentos.grupos, 1);
});

test('escenaDe: los hermanos del foco o su hilo, con el foco como centro', async () => {
  const { eje, alta, menu, compra, c2, c3 } = await comprasHermanas();
  const h = escenaDe(eje, c2.id, { ahora: AHORA });
  assert.equal(h.alcance, 'hermanos');
  assert.deepEqual(h.focos.map((f) => f.id), [compra.id, c2.id, c3.id]);
  assert.deepEqual(h.focos.map((f) => f.centro), [false, true, false]);
  assert.match(render(h).split('\n')[2], /^1\*n1 /);
  const hilo = escenaDe(eje, compra.id, { alcance: 'hilo', ahora: AHORA });
  assert.deepEqual(hilo.focos.map((f) => f.id), [eje.genesisId, alta.id, menu.id, compra.id]);
  assert.equal(hilo.comun, eje.genesisId);
  assert.deepEqual(hilo.focos.map((f) => f.nivel), [0, 1, 2, 3]);
  // El génesis de ejemplo es un terminal: sin posición 0 (mapa §12), su representación es el propio terminal.
  assert.equal(hilo.focos[0].representacion, 'Casa de ejemplo');
  assert.deepEqual(hilo.aristas.filter((x) => x.tipo === 'hilo').map((x) => [x.de, x.a, x.saltos]), [[1, 0, 1], [2, 1, 1], [3, 2, 1]]);
  assert.equal(hilo.focos[3].hermanosEnEje, 3); // la compra tiene dos hermanas fuera de esta escena
  assert.deepEqual(escenaDe(eje, eje.genesisId, { ahora: AHORA }).focos.map((f) => f.id), [eje.genesisId]);
  assert.throws(() => escenaDe(eje, compra.id, { alcance: 'todo' }), /alcance desconocido/);
  assert.throws(() => escenaDe(eje, 'nada'), /foco desconocido/);
});

test('la cuenta enlaza con la compra por una fórmula BQL, y lo que sale de la escena se cuenta', async () => {
  const { eje, compra } = await ejemploCompra();
  const cuenta = await ejemploCuenta(eje, compra);
  const e = escena(eje, [cuenta.id, compra.id], { ahora: AHORA });
  assert.deepEqual(e.focos.map((f) => f.id), [compra.id, cuenta.id]);
  const deLaCuenta = e.focos[1].salen;
  assert.deepEqual(deLaCuenta[0], { tipo: 'hilo', de: 1, a: 0, deId: cuenta.id, aId: compra.id, saltos: 1, en: '1000000000' });
  assert.deepEqual(deLaCuenta[1], { tipo: 'formula', de: 1, a: 0, deId: cuenta.id, aId: compra.id, camino: [1], dir: '1200000000' });
  assert.equal(deLaCuenta.length, 2); // «=LOCAL(1) + 15 min» y el texto escapado no son referencias
  assert.equal(e.recuentos.referenciasFuera, 2); // las de la compra al menú, que no está en escena
  const texto = render(e);
  assert.match(texto, /hilo→0 en 1000000000 · fórmula 1→0:1200000000/);
  assert.equal(escena(eje, [cuenta.id], { ahora: AHORA }).recuentos.referenciasFuera, 1);
  // Lectura estática de REF: anidado cuenta; desconocido, mal formado o ilegible, no (lo dirá BQL al evaluar).
  const c = corto(compra.id);
  const notas = await eje.escribir({
    autor: 'cocina', sobre: compra.id, t: '2026-11-07T14:20:00Z', movimientos: [gastaT('cocina')],
    payload: ['Notas', '=REF("ffffffff")', '=((', '=REF("' + c + '", "12")', '=SUMAR(FILTRAR(BUSCAR(1), REF("' + c + '", "1200000000") > 3))'],
  });
  const n = escena(eje, [compra.id, notas.id], { ahora: AHORA });
  assert.deepEqual(n.focos[1].salen.map((x) => [x.tipo, x.camino, x.dir ?? x.en]), [['hilo', undefined, '0000000000'], ['formula', [4], '1200000000']]);
});

test('el tope corta la escena con un aviso explícito, nunca en silencio', async () => {
  const { eje, menu, compra, c2, c3 } = await comprasHermanas();
  // La compra lee 4 décuplas (ella, el menú, las altas y el génesis); c2 añade una; c3 pasaría de 50.
  const e = escena(eje, [compra.id, c2.id, c3.id, menu.id], { ahora: AHORA, tope: 50 });
  assert.deepEqual(e.focos.map((f) => f.id), [compra.id, c2.id]);
  assert.equal(e.recuentos.posicionesLeidas, 50);
  assert.equal(e.recuentos.enEscena, 2);
  assert.equal(e.recuentos.fuera, 2);
  assert.deepEqual(e.corte, { tope: 50, posicionesLeidas: 50, necesitaba: 60, foco: c3.id, fuera: [c3.id, menu.id] });
  assert.match(e.avisos[0], /^tope de Scened: 50 posiciones leídas\. El foco [0-9a-f]{8} \(3º de 4\) llevaría la lectura a 60; la escena se corta ahí y quedan fuera 2 focos: /);
  assert.ok(e.avisos[0].includes(corto(c3.id) + ' ' + corto(menu.id)));
  const lineas = render(e).split('\n');
  assert.match(lineas[0], /^escena · 2 de 4 focos · .* · 50 de 50 posiciones leídas$/);
  assert.match(lineas.at(-1), /^aviso: tope de Scened: 50/);
  // Un tope tan bajo que no cabe ni el primero: escena vacía, con aviso.
  const vacia = escena(eje, [compra.id], { ahora: AHORA, tope: 10 });
  assert.equal(vacia.focos.length, 0);
  assert.equal(vacia.comun, null);
  assert.match(render(vacia), /aviso: tope de Scened: 10 posiciones leídas/);
  // El tope de Scened no se sube.
  assert.throws(() => escena(eje, [compra.id], { tope: TOPE + 1 }), /el tope de Scened es 10000/);
  assert.throws(() => escena(eje, [compra.id], { tope: 0 }), /tope inválido/);
});

test('mil compras hermanas: la escena llega a las diez mil posiciones y lo dice', async () => {
  const eje = await Eje.genesis({ identidad: 'casa', tipo: 'grupo', emision: [{ token: 'T', escala: 'minuto', cantidad: 2000 }], foco: 'Casa de prueba', t: '2026-11-07T09:00:00Z' });
  const menu = await eje.escribir({ autor: 'casa', sobre: eje.genesisId, t: '2026-11-07T09:00:00Z', movimientos: [gastaT('casa')], payload: ['Menú', ['sopa', 'pan']] });
  const compras = [];
  for (let i = 0; i < 1000; i++) {
    compras.push(await eje.escribir({ autor: 'casa', sobre: menu.id, t: '2026-11-07T13:30:00Z', movimientos: [gastaT('casa')], payload: ['Compra ' + i, [{ ref: menu.id, dir: '1000000000' }, 1]] }));
  }
  const e = escenaDe(eje, compras[0].id, { ahora: AHORA });
  // Cada compra lee su décupla; el menú y el génesis se leen una vez: 2 + 998 = 1000 décuplas.
  assert.equal(e.recuentos.pedidos, 1000);
  assert.equal(e.recuentos.enEscena, 998);
  assert.equal(e.recuentos.posicionesLeidas, TOPE);
  assert.equal(e.recuentos.fuera, 2);
  assert.deepEqual(e.corte.fuera, [compras[998].id, compras[999].id]);
  assert.equal(e.focos[0].centro, true);
  assert.equal(e.focos[997].hermano.de, 998);
  assert.equal(e.focos[997].hermanosEnEje, 1000);
  assert.equal(e.recuentos.referenciasFuera, 998); // el menú no está en escena
  const lineas = render(e).split('\n');
  assert.equal(lineas.length, 1 + 998 + 2 + 1);
  assert.match(lineas.at(-1), /^aviso: tope de Scened: 10000 posiciones leídas\. El foco [0-9a-f]{8} \(999º de 1000\)/);
});

test('camino y época: todos los focos se miran desde el mismo sitio y bajo la misma época', async () => {
  const { eje, menu, compra } = await ejemploCompra();
  const epoca = { nombre: 'época de prueba', reglaCorta: (p, d) => 'p' + p + 'd' + d };
  const e = escena(eje, [menu.id, compra.id], { ahora: AHORA, camino: [1], epoca });
  assert.deepEqual(e.camino, [1]);
  assert.equal(e.epoca, 'época de prueba');
  assert.equal(e.focos[0].representacion, 'ensalada'); // la posición 1.0 del menú
  assert.deepEqual(e.focos[1].representacion, { ref: menu.id, dir: '1000000000' }); // la 1.0 de la compra es una referencia
  assert.equal(e.focos[0].mapa.celdas[2].significado, 'p1d2');
  assert.deepEqual(e.focos[0].mapa, mapa(eje, menu.id, { camino: [1], epoca }));
  assert.match(render(e).split('\n')[0], /· época de prueba · camino 1 ·/);
  assert.match(render(e).split('\n')[2], / →[0-9a-f]{8} · /);
});

test('leer una escena no muta nada; repetidos y errores se dicen', async () => {
  const { eje, menu, compra } = await ejemploCompra();
  const antes = { eventos: eje.orden.length, saldo: eje.saldo('huesped', 'E:casa/EUR'), minutos: eje.saldoT('huesped', 'minuto') };
  const e = escena(eje, [compra.id, menu.id, compra.id], { ahora: AHORA });
  render(e);
  assert.deepEqual({ eventos: eje.orden.length, saldo: eje.saldo('huesped', 'E:casa/EUR'), minutos: eje.saldoT('huesped', 'minuto') }, antes);
  assert.equal(e.recuentos.pedidos, 2);
  assert.deepEqual(e.avisos, ['foco repetido: ' + corto(compra.id) + ' (cuenta una vez)']);
  assert.match(render(e), /\naviso: foco repetido: /);
  assert.throws(() => escena(eje, []), /al menos un foco/);
  assert.throws(() => escena(eje, ['nada']), /foco desconocido/);
  assert.throws(() => escena(eje, [compra.id], { centro: menu.id }), /centro no está entre los focos/);
  assert.throws(() => render(e, 'animado'), /no disponible/);
});
