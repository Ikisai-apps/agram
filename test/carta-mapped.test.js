// Mapped en el ordenador (VG, 10-11, tanda 3): sin scroll nunca; los pasos de tamaño de cada PV son datos de la época
// (epoch.8.6); los puntitos del foco suben un paso a todos y el clic sobre un PV solo a ese; un PV a pantalla completa
// con flechas a sus vecinos y «volver»; los rosetones cada uno en su esquina o lateral; el interruptor sobrio/animado
// escribe la preferencia; el formulario enseña lo obligatorio y lo demás tras «más»; el criterio por defecto, traducido.

import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { arbol, formulario, preferencias, ampliar, ampliarTodos, escalaDeTamanos, repartir, medidasDePantalla, MEDIDAS, ALTO_BAJO, LATERALES, CENTROS, GEOMETRIA, NIVEL } from '../carta/carta.js';
import { html } from '../carta/dom.js';
import * as C from '../src/contrato.js';
import * as A from '../src/acciones.js';
import * as modelos from '../src/modelos.js';
import { instalar } from '../carta/gestos.js';
import { EPOCA_0_BTML, cargarEpocaBtml, REGISTROS_DE_MODELOS } from '../src/epocas.js';
import { EPOCA_0_BTML_DATOS, REGLAS_DE_EPOCA_DATOS, PLANTILLAS_DE_EPOCA_DATOS, CORRECCIONES_DE_EPOCA_DATOS } from '../datos/epocas/epocas.js';
import { ejemploCompra } from '../ejemplos/ikisai/compra-food.mjs';
import { ejemploReserva } from '../ejemplos/ikisai/reserva-booking.mjs';
import { ejemploComprasHermanas } from '../ejemplos/ikisai/compras-hermanas.mjs';
import { pagaElCoste } from './ayudas-coste.js';

const T1 = '2026-11-08T10:00:00Z';
const ORDENADOR = { ancho: 1200, alto: 800 };
const GRANDE = { ancho: 1920, alto: 1080 };
const MOVIL = { ancho: 400, alto: 700 };
const minuto = (de) => pagaElCoste(de);
const CASI = 1e-9;

function epocaCon(cambiar) {
  const e = JSON.parse(JSON.stringify(EPOCA_0_BTML_DATOS));
  const plantillas = JSON.parse(JSON.stringify(PLANTILLAS_DE_EPOCA_DATOS));
  cambiar(e, plantillas);
  return cargarEpocaBtml(e, { registros: [...REGLAS_DE_EPOCA_DATOS, ...REGISTROS_DE_MODELOS], plantillas, correcciones: CORRECCIONES_DE_EPOCA_DATOS, id: EPOCA_0_BTML.id });
}

/** La suma de una lista de fracciones. */
const suma = (l) => l.reduce((a, b) => a + b, 0);

/** Comprueba que el árbol no pide más del 100 % de la pantalla en ningún eje y que cada caja cabe en ella. */
function sinScroll(a, que = '') {
  assert.ok(a.mapa, 'en Mapped el árbol trae el reparto ' + que);
  assert.ok(suma(a.mapa.columnas) <= 1 + CASI, 'columnas ' + a.mapa.columnas + ' ' + que);
  assert.ok(suma(a.mapa.filas) <= 1 + CASI, 'filas ' + a.mapa.filas + ' ' + que);
  for (const caja of [a.mapa.centro, ...a.laterales.map((n) => n.caja).filter(Boolean)]) {
    assert.ok(caja.x >= -CASI && caja.y >= -CASI && caja.ancho >= 0 && caja.alto >= 0, JSON.stringify(caja));
    assert.ok(caja.x + caja.ancho <= 1 + CASI && caja.y + caja.alto <= 1 + CASI, 'la caja se sale: ' + JSON.stringify(caja) + ' ' + que);
  }
  // Las cajas de los PV no se pisan entre sí ni con la del foco.
  const cajas = [a.mapa.centro, ...a.laterales.map((n) => n.caja).filter(Boolean)];
  for (let i = 0; i < cajas.length; i++) for (let j = i + 1; j < cajas.length; j++) {
    const p = cajas[i];
    const q = cajas[j];
    const pisan = p.x + p.ancho > q.x + CASI && q.x + q.ancho > p.x + CASI && p.y + p.alto > q.y + CASI && q.y + q.alto > p.y + CASI;
    assert.ok(!pisan, 'se pisan ' + JSON.stringify(p) + ' y ' + JSON.stringify(q) + ' ' + que);
  }
}

test('los pasos de tamaño de Mapped son datos de la época (epoch.8.6): nombres, fracciones de esquina y de lado y datos que caben, con su procedencia', () => {
  const fila = EPOCA_0_BTML.registro[8][6];
  assert.equal(fila[0][0], 'size steps');
  assert.match(fila[2][0], /^VG, 10-11/);
  const pasos = C.pasosDeTamano();
  assert.deepEqual(pasos.map((p) => p.nombre), fila[1].map((p) => p[0][0]));
  assert.deepEqual(pasos.map((p) => [p.esquina, p.lado]), [[0, 0], [0, 0], [1 / 16, 1 / 16], [1 / 4, 1 / 9], [1, 1]]);
  assert.deepEqual(pasos.map((p) => p.datos), [0, 1, 9, 10, 1000]);
  // En español, por la clave «size <nombre>».
  assert.deepEqual(C.pasosDeTamano({ idioma: 'es' }).map((p) => p.texto), ['oculto', 'punto', 'grupo', 'bloque', 'pantalla completa']);
  // Lo que la carta deduce de la tabla, sin nombres: el de partida (el punto), el primero con espacio (el grupo), el tope (el bloque) y la pantalla completa.
  const e = escalaDeTamanos();
  assert.deepEqual([e.partida, e.conEspacio, e.tope, e.completa], [1, 2, 3, 4]);
});

test('la pantalla inicial: el foco (el 0) ocupa toda la pantalla con sus diez puntitos y nada más; ningún PV tiene caja', async () => {
  const { eje, compra } = await ejemploCompra();
  for (const medidas of [ORDENADOR, GRANDE]) {
    const a = await arbol({ foco: { X: compra.id, pv: 0 } }, eje, 'huesped', medidas);
    assert.equal(a.apilada, false);
    assert.deepEqual(a.mapa.centro, { x: 0, y: 0, ancho: 1, alto: 1 });
    assert.ok(a.laterales.every((n) => n.caja === null && n.pasoDeTamano.nombre === 'dot'));
    assert.deepEqual(a.mapa.puntos.lista.map((p) => p.pv), a.pvs, 'los diez puntitos, los PV de la división');
    assert.equal(a.mapa.puntos.sube, true);
    assert.equal(a.mapa.puntos.baja, false);
    sinScroll(a, 'inicial');
    const h = html(a);
    assert.equal((h.match(/class="punto[^"]*"[^>]*data-todos="1"/g) ?? []).length, a.pvs.length);
    assert.match(h, /data-todos="-1"[^>]* disabled/);
    assert.doesNotMatch(h, /class="celda fila/, 'sin cajas de PV');
  }
});

test('los puntitos suben un paso a todos a la vez hasta el 3×3 (otra pulsación no hace nada) y su mando los baja; la cruz va en proporción', async () => {
  const { eje, compra } = await ejemploCompra();
  const e = escalaDeTamanos();
  let estado = { foco: { X: compra.id, pv: 0 } };
  const pasos = [];
  for (let i = 0; i < 3; i++) {
    estado = { ...estado, ...ampliarTodos(estado, +1) };
    pasos.push(LATERALES.map((pv) => estado.niveles[pv]));
  }
  assert.deepEqual(pasos[0], LATERALES.map(() => e.partida + 1));
  assert.deepEqual(pasos[1], LATERALES.map(() => e.tope));
  assert.deepEqual(pasos[2], pasos[1], 'en el tope, otra pulsación no hace nada');
  assert.deepEqual(estado.recientes, []);
  const a = await arbol(estado, eje, 'huesped', ORDENADOR);
  assert.equal(a.mapa.matriz, true);
  assert.ok(a.laterales.every((n) => n.caja && n.relleno && n.nivel === NIVEL.bloque));
  // Las esquinas querrían medio lado (un cuarto) y la cruz un tercio (un noveno): todo en proporción, sin pasar de 1.
  const [izq, centro, der] = a.mapa.columnas;
  assert.ok(Math.abs(izq - der) < CASI && izq > centro, 'la X más ancha que la cruz: ' + a.mapa.columnas);
  assert.ok(Math.abs(izq / centro - (1 / 2) / (1 / 3)) < 1e-6, 'en proporción a lo que quieren');
  sinScroll(a, 'tres pulsaciones');
  // Tras el primer paso (el grupo): cada PV en una dieciseisava parte, pegado a su esquina o a su lado.
  const g = await arbol({ ...estado, ...ampliarTodos({}, +1) }, eje, 'huesped', ORDENADOR);
  for (const n of g.laterales) {
    assert.ok(Math.abs(n.caja.ancho * n.caja.alto - 1 / 16) < 1e-9, 'pv ' + n.pv + ' ' + JSON.stringify(n.caja));
    const [f, c] = GEOMETRIA[n.pv].celda;
    if (c === 0) assert.equal(n.caja.x, 0);
    if (c === 2) assert.ok(Math.abs(n.caja.x + n.caja.ancho - 1) < CASI);
    if (f === 0) assert.equal(n.caja.y, 0);
    if (f === 2) assert.ok(Math.abs(n.caja.y + n.caja.alto - 1) < CASI);
  }
  sinScroll(g, 'grupo');
  // Bajar: un paso a todos, nunca por debajo del de partida.
  const abajo = ampliarTodos(ampliarTodos(estado, -1), -5);
  assert.ok(LATERALES.every((pv) => abajo.niveles[pv] === e.partida));
});

test('el clic sobre un PV sube un paso solo a ese PV; en el tope, el siguiente lo pone a pantalla completa; sus botoncitos y el asa están en el HTML', async () => {
  const { eje, compra } = await ejemploCompra();
  const e = escalaDeTamanos();
  let estado = { foco: { X: compra.id, pv: 0 }, ...ampliarTodos({}, +1) };
  const r = ampliar(estado, 1, +1);
  assert.equal(r.niveles[1], e.tope);
  assert.ok(LATERALES.filter((pv) => pv !== 1).every((pv) => r.niveles[pv] === estado.niveles[pv]), 'los demás no cambian');
  assert.deepEqual(r.recientes, [1]);
  assert.equal(r.completa, false);
  estado = { ...estado, ...r };
  const a = await arbol(estado, eje, 'huesped', ORDENADOR);
  const uno = a.laterales.find((n) => n.pv === 1);
  assert.equal(uno.pasoDeTamano.nombre, 'block');
  // El más reciente se queda lo suyo: un cuarto de pantalla (medio lado en cada eje).
  assert.ok(Math.abs(uno.caja.ancho - 0.5) < 1e-9 && Math.abs(uno.caja.alto - 0.5) < 1e-9, JSON.stringify(uno.caja));
  assert.equal(a.mapa.reciente, 1);
  sinScroll(a, 'un PV en bloque');
  const h = html(a);
  assert.match(h, /data-tamano="1" data-pv="1"/);
  assert.match(h, /data-tamano="-1" data-pv="1"/);
  assert.match(h, /data-asa="1"[^>]*data-dx="1" data-dy="1"/, 'el asa del 1 crece hacia abajo a la derecha (hacia el centro)');
  assert.match(h, /data-asa="9"[^>]*data-dx="0" data-dy="-1"/, 'la del 9, hacia arriba');
  // Uno más: la pantalla completa.
  const s = ampliar(estado, 1, +1);
  assert.equal(s.completa, true);
  // Bajar uno solo y no por debajo del de partida.
  assert.equal(ampliar(estado, 1, -10).niveles[1], e.partida);
});

test('#17: ir a la pantalla completa del 7 y volver no vacía el 4, ni al revés; el 3×3 vuelve como estaba (entrar no es un toque de tamaño)', async () => {
  const { eje, compra } = await ejemploCompra();
  const m = medidasDePantalla(1366, 728); // 1366 × 768 sin la barra
  // Foco en el 0 y todos en bloque (los puntitos, dos veces).
  let estado = { foco: { X: compra.id, pv: 0 }, ...ampliarTodos(ampliarTodos({}, +1), +1) };
  const foto = async () => {
    const a = await arbol(estado, eje, 'huesped', m);
    sinScroll(a, 'tras volver');
    const h = html(a);
    return { a, h, por: Object.fromEntries(a.laterales.map((n) => [n.pv, { nivel: n.nivel, caja: n.caja, rejilla: Boolean(n.rejilla), ocupantes: n.ocupantes?.lista.length ?? 0 }])) };
  };
  const antes = await foto();
  assert.ok(antes.a.mapa.matriz && antes.a.laterales.every((n) => n.nivel === NIVEL.bloque));
  for (const orden of [[7, 4], [4, 7]]) {
    for (const pv of orden) {
      // Un clic más sobre el PV ya en el tope (su «+»): la pantalla completa; la app pone el foco en él (estado.foco.pv).
      const r = ampliar(estado, pv, +1);
      assert.equal(r.completa, true);
      estado = { ...estado, niveles: r.niveles, recientes: r.recientes, foco: { X: compra.id, pv } };
      const dentro = await arbol(estado, eje, 'huesped', m);
      assert.equal(dentro.mapa.completa.pv, pv);
      // «volver»: el foco al 0 (data-foco-pv="0"), el mismo registro: la app no toca niveles ni recientes.
      estado = { ...estado, foco: { X: compra.id, pv: 0 } };
      const tras = await foto();
      assert.deepEqual(tras.por, antes.por, `tras ir al ${pv} y volver (${orden.join(' → ')}), cada PV con su nivel, su caja y su contenido`);
      assert.deepEqual(tras.a.mapa.columnas, antes.a.mapa.columnas);
      assert.deepEqual(tras.a.mapa.filas, antes.a.mapa.filas);
      for (const otro of [4, 7]) assert.deepEqual(tras.por[otro], antes.por[otro], `el ${otro} tras volver del ${pv}`);
    }
  }
  // Lo mismo si el PV se agranda antes uno a uno: entrar y volver deja los tamaños y los recientes como estaban.
  const uno = { foco: { X: compra.id, pv: 0 }, ...ampliar(ampliarTodos({}, +1), 7, +1) };
  const r = ampliar(uno, 7, +1);
  assert.equal(r.completa, true);
  assert.deepEqual([r.niveles, r.recientes], [uno.niveles, uno.recientes]);
});

test('la competición: si dos tocados uno a uno no caben en su fila o su columna, gana el más reciente y el otro baja un paso', () => {
  const e = escalaDeTamanos();
  let estado = {};
  for (const pv of [1, 1]) estado = { ...estado, ...ampliar(estado, pv, +1) };
  assert.equal(estado.niveles[1], e.tope);
  // El 2 comparte fila con el 1: en bloque los dos no caben a lo ancho (medio + medio + el centro).
  for (const pv of [2, 2]) estado = { ...estado, ...ampliar(estado, pv, +1) };
  assert.equal(estado.niveles[2], e.tope);
  assert.equal(estado.niveles[1], e.tope - 1, 'el 1, más antiguo, baja un paso');
  assert.deepEqual(estado.recientes, [1, 2]);
  const r = repartir(estado.niveles, LATERALES, e, { recientes: estado.recientes });
  assert.ok(Math.abs(r.columnas[2] - 0.5) < 1e-9, 'el 2 se queda su medio ancho: ' + r.columnas);
  assert.ok(Math.abs(suma(r.columnas) - 1) < 1e-9 && Math.abs(suma(r.filas) - 1) < 1e-9);
  // El 3 no compite con el 2 (ni fila ni columna): el 1 sí (misma columna) y vuelve a bajar.
  const t = ampliar(ampliar(estado, 3, +1), 3, +1);
  assert.equal(t.niveles[2], e.tope);
  assert.ok(t.niveles[1] <= e.tope - 1);
});

test('sin scroll en ningún estado: el árbol nunca pide más del 100 % de la pantalla en ningún eje (todas las combinaciones de dos pasos y recientes)', async () => {
  const { eje, compra } = await ejemploCompra();
  const e = escalaDeTamanos();
  const opciones = [e.partida, e.conEspacio, e.tope];
  let k = 0;
  for (const p1 of opciones) for (const p8 of opciones) for (const p7 of opciones) for (const resto of opciones) {
    const niveles = Object.fromEntries(LATERALES.map((pv) => [pv, resto]));
    Object.assign(niveles, { 1: p1, 8: p8, 7: p7 });
    for (const recientes of [[], [1], [8, 7], [7, 1]]) {
      const r = repartir(niveles, LATERALES, e, { recientes });
      assert.ok(Math.abs(suma(r.columnas) - 1) < 1e-9 && Math.abs(suma(r.filas) - 1) < 1e-9, JSON.stringify({ niveles, recientes, r }));
      assert.ok([...r.columnas, ...r.filas].every((f) => f >= 0));
      k++;
    }
  }
  assert.ok(k > 300);
  for (const medidas of [ORDENADOR, GRANDE]) {
    const a = await arbol({ foco: { X: compra.id, pv: 0 }, niveles: { 1: e.tope, 2: e.conEspacio, 9: e.tope, 6: e.conEspacio }, recientes: [9, 1] }, eje, 'huesped', medidas);
    sinScroll(a, 'mezcla ' + medidas.ancho);
  }
});

test('la pantalla completa de un PV: solo ese PV (sin rosetones), flechas a sus vecinos en su sitio de la geometría, el 0 y el 5 en el centro y «volver»; dentro, la división de la época con el máximo de datos de Mapped', async () => {
  const { eje, compra } = await ejemploCompra();
  const a = await arbol({ foco: { X: compra.id, pv: 4 } }, eje, 'huesped', ORDENADOR);
  assert.equal(a.mapa.completa.pv, 4);
  assert.equal(a.centro.pv, 4);
  assert.deepEqual(a.mapa.centro, { x: 0, y: 0, ancho: 1, alto: 1 });
  assert.deepEqual(a.laterales, [], 'un solo PV');
  assert.deepEqual(a.rosetones, [], 'sin rosetones');
  const vecinos = a.mapa.completa.vecinos;
  assert.deepEqual(vecinos.map((v) => v.pv).sort(), a.pvs.filter((pv) => pv !== 4).sort());
  for (const v of vecinos) assert.deepEqual([v.fila, v.columna], GEOMETRIA[v.pv].celda);
  assert.deepEqual(vecinos.filter((v) => v.centro).map((v) => v.pv), CENTROS);
  assert.equal(a.mapa.completa.volver, CENTROS[0]);
  // La división de la época con los datos del paso de pantalla completa (el máximo de Mapped, epoch.8.2).
  const maximo = C.modos().find((m) => m.maximo === C.pasosDeTamano()[escalaDeTamanos().completa].datos);
  assert.ok(maximo, 'los datos de la pantalla completa son el máximo de un modo de la época');
  assert.deepEqual(a.centro.division, (({ pvs, datos, cargarMas }) => ({ pvs, datos, cargarMas }))(C.division(eje, compra.id, { datos: maximo.maximo, forma: ORDENADOR })));
  // La medida del PV4 es su paso (el ciclo), no la genérica.
  assert.equal(a.centro.medida.nombre, 'ciclo');
  assert.equal(a.centro.medida.propio, true);
  const h = html(a);
  assert.match(h, /class="mapa completa" data-completa="4"/);
  assert.equal((h.match(/class="vecino /g) ?? []).length, vecinos.length);
  assert.match(h, /class="volver volver-claro"[^>]*data-foco-pv="0"/);
  assert.doesNotMatch(h, /data-roseton=/);
  assert.match(h, /class="vecino fila-0 columna-0[^"]*"[^>]*data-foco-pv="1"/, 'el 1, arriba a la izquierda');
  assert.match(h, /class="vecino fila-2 columna-1[^"]*"[^>]*data-foco-pv="9"/, 'el 9, abajo');
});

test('los rosetones en el ordenador: cada uno en su esquina o lateral (el 0 arriba y el 5 abajo, al centro), una sola vez; en el móvil en vertical, ninguno (VG, 11-11: Sequenced)', async () => {
  const { eje, compra } = await ejemploCompra();
  for (const estado of [{}, ampliarTodos({}, 1), ampliarTodos(ampliarTodos({}, 1), 1)]) {
    const a = await arbol({ foco: { X: compra.id, pv: 0 }, ...estado }, eje, 'huesped', ORDENADOR);
    const h = html(a);
    const pvs = [...h.matchAll(/data-roseton="(\d)"/g)].map((m) => Number(m[1]));
    assert.deepEqual([...pvs].sort(), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 'los diez, una sola vez');
    for (const r of a.rosetones) {
      const sitio = GEOMETRIA[r.pv].borde ?? GEOMETRIA[r.pv].celda;
      assert.deepEqual([r.sitio.fila, r.sitio.columna], sitio);
      assert.match(h, new RegExp(`class="roseton [^"]*sitio-f${sitio[0]} sitio-c${sitio[1]}[^"]*"[^>]*data-roseton="${r.pv}"`));
    }
    assert.deepEqual(a.rosetones.filter((r) => r.sitio.centro).map((r) => [r.pv, r.sitio.fila]), [[0, 0], [5, 2]]);
    assert.match(h, /<nav class="rosetones rosetones-mapa"/);
    assert.doesNotMatch(h, /rosetones-barra|rosetones-arriba|rosetones-abajo/);
  }
  const m = html(await arbol({ foco: { X: compra.id, pv: 0 } }, eje, 'huesped', MOVIL));
  assert.doesNotMatch(m, /rosetones-arriba|rosetones-abajo/);
  assert.doesNotMatch(m, /rosetones-mapa/);
});

test('cambiar la tabla de pasos en una copia de la época cambia el árbol: las fracciones, lo que cabe y hasta dónde llegan los puntitos', async () => {
  const { eje, compra } = await ejemploCompra();
  // El grupo, en una novena parte y con dos datos: la caja crece y caben menos.
  const otra = epocaCon((e) => { e[8][6][1][2] = [['group'], [1, 9], [1, 9], [2]]; });
  const base = await arbol({ foco: { X: compra.id, pv: 0 }, ...ampliarTodos({}, 1) }, eje, 'huesped', ORDENADOR);
  const b = await arbol({ foco: { X: compra.id, pv: 0 }, ...ampliarTodos({}, 1, { epoca: otra }) }, eje, 'huesped', ORDENADOR, { epoca: otra });
  const uno = (a) => a.laterales.find((n) => n.pv === 1);
  assert.ok(Math.abs(uno(b).caja.ancho - 1 / 3) < 1e-9 && Math.abs(uno(base).caja.ancho - 1 / 4) < 1e-9);
  assert.equal(uno(b).pasoDeTamano.fraccion, 1 / 9);
  assert.ok(uno(b).ocupantes.cuantos <= 2);
  // Sin el paso «bloque» la escala se acorta: el tope es el grupo y los puntitos se paran ahí.
  const corta = epocaCon((e) => { e[8][6][1].splice(3, 1); });
  const e = escalaDeTamanos({ epoca: corta });
  assert.deepEqual([e.tope, e.completa], [2, 3]);
  const t = ampliarTodos(ampliarTodos({}, 1, { epoca: corta }), 1, { epoca: corta });
  assert.ok(LATERALES.every((pv) => t.niveles[pv] === 2));
  // La carta no lleva escritos los nombres de los pasos.
  const fuente = readFileSync(new URL('../carta/carta.js', import.meta.url), 'utf8');
  const literales = new Set([...fuente.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1]));
  for (const p of C.pasosDeTamano()) assert.ok(!literales.has(p.nombre), 'carta/carta.js lleva escrito «' + p.nombre + '»');
});

test('el interruptor sobrio/propio/todo (el 5 del 0 de mi alta, antes la barra) es la enumeración del pintado (#25): tocarlo escribe «render» como la configuración y el árbol pasa a animado', async () => {
  const { eje, compra } = await ejemploCompra();
  const a = await arbol({ foco: { X: compra.id, pv: 0 } }, eje, 'huesped', ORDENADOR);
  assert.equal(a.interruptores.length, 1);
  const i = a.interruptores[0];
  const conf = C.configuracion(eje, 'huesped');
  assert.equal(i.valor, conf[i.clave]);
  assert.deepEqual(i.opciones.map((o) => o.valor), C.clavesDeConfiguracion().find((c) => c.clave === i.clave).valores);
  // La barra ya no existe (#38): el interruptor es una opción del 5 del 0 de mi alta, que se ve con su cruceta abierta.
  assert.doesNotMatch(html(a), /class="barra|data-preferencia/);
  const abierta = await arbol({ foco: { X: compra.id, pv: 0 }, sitio: { X: eje.alta('huesped').id, lugar: '0', general: true } }, eje, 'huesped', ORDENADOR);
  const h = html(abierta);
  assert.match(h, new RegExp(`data-posicion="5"[^]*?<span class="interruptor"[^>]*>.*data-preferencia="${i.clave}" data-valor="${i.opciones[1].valor}" aria-pressed="false"`));
  // Tres posiciones, en el orden de la época (epoch.9.3.2): sobrio, propio, todo.
  assert.equal(i.opciones.length, 3);
  // Tocar «todo» (la última): la app escribe la candidata de preferencias() con esa clave (como guarda la configuración).
  const otra = i.opciones[i.opciones.length - 1].valor;
  const p = preferencias(eje, 'huesped', { [i.clave]: otra });
  await eje.escribir({ autor: 'huesped', sobre: p.sobre, en: p.en, t: T1, movimientos: [minuto('huesped')], payload: p.payload });
  assert.equal(C.configuracion(eje, 'huesped')[i.clave], otra);
  const b = await arbol({ foco: { X: compra.id, pv: 0 } }, eje, 'huesped', ORDENADOR);
  assert.equal(b.animado, true);
  assert.equal(b.interruptores[0].valor, otra);
  // En español (el idioma de la época), las dos palabras traducidas; en inglés, las canónicas.
  assert.deepEqual(b.interruptores[0].opciones.map((o) => o.texto), ['sobrio', 'propio', 'todo']);
  // La configuración ofrece el pintado como desplegable con los mismos tres valores (salen de los datos).
  const campo = preferencias(eje, 'huesped').campos.find((x) => x.clave === i.clave);
  assert.deepEqual(campo.opciones.map((o) => [o.valor, o.texto]), i.opciones.map((o) => [o.valor, o.texto]));
  assert.equal(campo.valor, otra);
  assert.match(html(b, { preferencias: preferencias(eje, 'huesped') }), new RegExp(`<select id="pref-\\d+" name="${i.clave}"[^>]*>(<option [^>]*>[^<]*</option>){3}</select>`));
  const q = preferencias(eje, 'huesped', { language: 'en' });
  await eje.escribir({ autor: 'huesped', sobre: q.sobre, en: q.en, t: T1, movimientos: [minuto('huesped')], payload: q.payload });
  const c = await arbol({ foco: { X: compra.id, pv: 0 } }, eje, 'huesped', ORDENADOR);
  assert.deepEqual(c.interruptores[0].opciones.map((o) => o.texto), ['sober', 'own', 'all']);
  // La app lo pinta y lo lanza por data-preferencia (la tecla la toca gestos.js; la escritura, app.js como la configuración).
  const app = readFileSync(new URL('../carta/app.js', import.meta.url), 'utf8');
  assert.match(app, /async preferencia\(clave, valor\)[\s\S]*?escribirPreferencias\(\{ \[clave\]: valor \}\)/);
});

test('#4: en la configuración, «modelo» es un desplegable con los modelos de la época que tienen recursos (sin el sobrio), general preseleccionado; con uno solo, no se pregunta', async () => {
  const { eje } = await ejemploCompra();
  const conRecursos = modelos.modelosDeLaEpoca().filter(modelos.conRecursos).map((m) => m.nombre);
  assert.deepEqual([...conRecursos].sort(), ['animado-generico', 'general'], 'hoy, dos paquetes de arte');
  const p = preferencias(eje, 'huesped');
  const campo = p.campos.find((c) => c.clave === 'model');
  assert.deepEqual(campo.opciones.map((o) => o.valor), ['general', 'animado-generico'], 'las opciones salen de los datos, en el orden de la cadena; el sobrio no está');
  assert.equal(campo.valor, 'general', 'sin preferencia, general');
  const h = html(await arbol({ foco: { X: eje.alta('huesped').id, pv: 0 } }, eje, 'huesped', ORDENADOR), { preferencias: p });
  assert.match(h, /<select id="pref-\d+" name="model"[^>]*><option value="general" selected>general<\/option><option value="animado-generico">animado-generico<\/option><\/select>/);
  assert.doesNotMatch(h, /<input[^>]*name="model"/);
  // La cuenta de VG: con «sobrio» guardado, el desplegable propone general (el sobrio no se elige) y al guardar queda general.
  const q = preferencias(eje, 'huesped', { model: 'sobrio' });
  assert.equal(q.campos.find((c) => c.clave === 'model').valor, 'general');
  assert.ok(q.payload.some((x) => Array.isArray(x) && x[0] === 'general'));
  // Elegir el genérico lo guarda.
  const g = preferencias(eje, 'huesped', { model: 'animado-generico' });
  assert.equal(g.campos.find((c) => c.clave === 'model').valor, 'animado-generico');
  // Una época con un solo paquete de arte (sin el genérico): el campo no se enseña y se guarda el que hay.
  const una = epocaCon((e) => { e[9][7].splice(1, 1); });
  assert.deepEqual(modelos.eleccionDeModelo({ epoca: una }).modelos.map((m) => m.nombre), ['general']);
  const u = preferencias(eje, 'huesped', { model: 'sobrio' }, { epoca: una });
  assert.equal(u.campos.find((c) => c.clave === 'model'), undefined, 'con uno solo, no se pregunta');
  assert.ok(u.payload.some((x) => Array.isArray(x) && x[0] === 'general'), 'y se guarda el que hay');
  assert.doesNotMatch(html(await arbol({ foco: { X: eje.alta('huesped').id, pv: 0 } }, eje, 'huesped', ORDENADOR), { preferencias: u }), /name="model"/);
});

test('el formulario de una acción: a la vista solo lo obligatorio; lo opcional tras «más»', async () => {
  const { eje, menu } = await ejemploCompra();
  const f = formulario(eje, menu.id, 'anchor here', 'huesped');
  const opcionales = f.campos.filter((c) => !c.requerido);
  assert.ok(opcionales.length >= 1, 'anchor here tiene parámetros opcionales');
  const a = await arbol({ foco: { X: menu.id, pv: 0 }, formulario: { X: menu.id, accion: 'anchor here', valores: {} } }, eje, 'huesped', ORDENADOR);
  const h = html(a);
  const i = h.indexOf('<details class="mas-parametros">');
  assert.ok(i > 0, 'el «más»');
  const fuera = h.slice(h.indexOf('<form class="formulario"'), i);
  const dentro = h.slice(i, h.indexOf('</details>', i));
  for (const c of f.campos) {
    const marca = `name="${c.nombre}"`;
    assert.ok((c.requerido ? fuera : dentro).includes(marca), c.nombre + (c.requerido ? ' a la vista' : ' tras «más»'));
  }
  // Sin opcionales, no hay «más».
  const b = await arbol({ foco: { X: menu.id, pv: 0 }, formulario: { X: menu.id, accion: 'apply a resource', valores: {} } }, eje, 'huesped', ORDENADOR);
  assert.doesNotMatch(html(b), /mas-parametros/);
});

test('en español, el criterio por defecto de una acción sale traducido (contrato.texto, como las acciones) y al enviar vuelve al canónico', async () => {
  const { eje, menu } = await ejemploCompra();
  const p = preferencias(eje, 'huesped', { language: 'es' });
  await eje.escribir({ autor: 'huesped', sobre: p.sobre, en: p.en, t: T1, movimientos: [minuto('huesped')], payload: p.payload });
  const f = formulario(eje, menu.id, 'apply a resource', 'huesped');
  const criterio = f.campos.find((c) => c.nombre === 'criteria');
  assert.equal(criterio.valor, 'all announced movements happened', 'el valor sigue siendo el canónico (lo que se envía: data-crudo)');
  assert.equal(criterio.legible, 'todos los movimientos anunciados ocurrieron');
  assert.equal(f.campos.find((c) => c.nombre === 'actions').legible, 'aplicar un recurso');
  // Ningún defecto de texto queda en inglés en crudo: los que la época sabe nombrar salen traducidos.
  for (const c of f.campos.filter((x) => typeof x.valor === 'string' && x.tipo === 'text')) assert.notEqual(c.legible, c.valor, c.nombre);
  // Si quien lo escribe deja la traducción (o la vuelve a escribir), se lee el canónico.
  assert.deepEqual(C.desdeLegible('todos los movimientos anunciados ocurrieron', 'text', { eje, idioma: 'es' }), { valor: 'all announced movements happened' });
  const h = html(await arbol({ foco: { X: menu.id, pv: 0 }, formulario: { X: menu.id, accion: 'apply a resource', valores: {} } }, eje, 'huesped', ORDENADOR));
  assert.match(h, /name="criteria"[^>]*value="todos los movimientos anunciados ocurrieron"[^>]*data-crudo="&quot;all announced movements happened&quot;"/);
});

test('la medida de cada carta va pequeña en su fila de arriba: la del PV4 es su paso (el ciclo), la de un PV sin paso propio, la madurez', async () => {
  const { eje: b, reserva } = await ejemploReserva();
  const a = await arbol({ foco: { X: reserva.id, pv: 0 }, ...ampliarTodos(ampliarTodos({}, 1), 1) }, b, 'huesped', ORDENADOR);
  const cuatro = a.laterales.find((n) => n.pv === 4);
  // Dos anuncios (VG 12-11, decisión 8: las noches de la casa en uno, el pago en otro), los dos cumplidos.
  assert.deepEqual([cuatro.medida.nombre, cuatro.medida.k, cuatro.medida.de, cuatro.medida.propio], ['ciclo', 2, 2, true]);
  const uno = a.laterales.find((n) => n.pv === 1);
  assert.deepEqual([uno.medida.nombre, uno.medida.propio], ['madurez', false]);
  const h = html(a);
  assert.match(h, /<section class="pv pv-4 [^>]*><header class="pv-cabeza"><span class="numero">4<\/span><span class="etiqueta">[^<]*<\/span><span class="medida"[^>]*>ciclo 2<small>\/2<\/small>/);
});

test('el segundo nivel a pantalla completa (las formas sobrias de cada mundo): sin scroll a 1920 × 1080 ni a 1366 × 768, con flechas a los vecinos y «volver»; el nivel 2 del 1 y del 2, también', async () => {
  const { eje, compra } = await ejemploCompra();
  const PORTATIL = { ancho: 1366, alto: 768 };
  const formas = { 1: 'cruceta', 2: 'escalera', 3: 'rejilla', 4: 'matriz', 6: 'franjas', 7: 'franjas', 8: 'cielo', 9: 'camino' };
  for (const medidas of [GRANDE, PORTATIL]) {
    for (const pv of LATERALES) {
      const a = await arbol({ foco: { X: compra.id, pv } }, eje, 'huesped', medidas);
      sinScroll(a, 'pantalla completa del ' + pv + ' a ' + medidas.ancho);
      assert.equal(a.centro.rejilla.forma, formas[pv]);
      const h = html(a);
      assert.match(h, new RegExp(`class="rejilla rejilla-completa" data-rejilla="${pv}" data-forma="${formas[pv]}"`));
      assert.equal((h.match(/class="vecino /g) ?? []).length, a.mapa.completa.vecinos.length);
      assert.match(h, /class="volver volver-claro"/);
    }
    // el nivel 2: se entra por un ocupante que es un registro con algo dentro (el que lleva data-celda)
    for (const [pv, forma] of [[1, 'cruceta'], [2, 'columnas']]) {
      const r1 = (await arbol({ foco: { X: compra.id, pv } }, eje, 'huesped', medidas)).centro.rejilla;
      const dentro = r1.celdas.flatMap((c) => c.ocupantes).find((o) => o.entra);
      assert.ok(dentro, 'algo en lo que entrar en el ' + pv);
      const a = await arbol({ foco: { X: compra.id, pv }, profundidad: { [pv]: [dentro.X] } }, eje, 'huesped', medidas);
      sinScroll(a, 'nivel 2 del ' + pv);
      assert.deepEqual([a.centro.rejilla.nivel, a.centro.rejilla.forma, a.centro.rejilla.X], [2, forma, dentro.X]);
      assert.match(html(a), new RegExp(`class="volver volver-claro"[^>]*data-subir="${pv}"`));
    }
  }
  // en el móvil (apilada) nada de esto: el centro abierto sigue sin rejilla
  const movil = await arbol({ foco: { X: compra.id, pv: 1 } }, eje, 'huesped', MOVIL);
  assert.equal(movil.apilada, true);
  assert.equal(movil.centro.rejilla ?? null, null);
  assert.doesNotMatch(html(movil), /rejilla-completa/);
});

// ---------- el aro: ocho sitios en 3 × 3 alrededor del elemento (VG, mockup v3) ----------

test('el aro trae ocho sitios con su pv y su celda de la matriz 3 × 3 (sin centro), la acción por defecto de cada mundo y, si se despliega, las alternativas; un sitio sin acciones va apagado', async () => {
  const { eje, compra, menu } = await ejemploCompra();
  const a = await arbol({ foco: { X: menu.id, pv: 0 }, aro: { X: menu.id, pv: null } }, eje, 'huesped', GRANDE);
  assert.deepEqual(a.aro.huecos.map((h) => h.pv), LATERALES);
  assert.equal(a.aro.huecos.length, 8);
  // la matriz 3 × 3 sin el centro: ocho celdas distintas, las de GEOMETRIA
  const celdas = a.aro.huecos.map((h) => h.celda.join(','));
  assert.equal(new Set(celdas).size, 8);
  assert.ok(!celdas.includes('1,1'), 'el centro es el propio elemento');
  assert.deepEqual(a.aro.huecos.map((h) => [h.pv, h.celda]), LATERALES.map((pv) => [pv, GEOMETRIA[pv].celda]));
  assert.deepEqual([1, 8, 2, 6, 7, 3, 9, 4].map((pv) => GEOMETRIA[pv].celda.join('')), ['00', '01', '02', '10', '12', '20', '21', '22'], 'arriba izquierda, arriba, arriba derecha, izquierda, derecha, abajo izquierda, abajo, abajo derecha');
  // la acción por defecto sale de acciones.acciones (las plantillas de la época), no de la carta; las demás son las alternativas
  for (const h of a.aro.huecos) {
    const lista = A.acciones(eje, menu.id, h.pv, 'huesped');
    const porDefecto = lista.find((x) => x.porDefecto) ?? lista[0] ?? null;
    assert.equal(h.accion?.id ?? null, porDefecto?.id ?? null, 'la acción por defecto del sitio ' + h.pv);
    assert.deepEqual(h.otras.map((o) => o.id), lista.filter((x) => x !== porDefecto).map((x) => x.id));
  }
  // el DOM: cada sitio lleva su pv (el color --pv-N) y su fila y columna; el árbol no trae píxeles
  const h = html(a);
  for (const g of a.aro.huecos) assert.match(h, new RegExp(`<li class="hueco hueco-${g.pv}[^"]*"[^>]* data-pv="${g.pv}" data-fila="${g.celda[0]}" data-columna="${g.celda[1]}"`));
  assert.doesNotMatch(JSON.stringify(a.aro), /"(left|top|style|ancla|x|y|ancho|alto)"/, 'el árbol del aro no sabe de píxeles');
  assert.doesNotMatch(h, /<ul class="otras"/, 'sin desplegar, no hay alternativas');
  // volver a pulsar un sitio (estado.aro.pv) despliega las alternativas de ese mundo, y solo las de ese
  const d = await arbol({ foco: { X: menu.id, pv: 0 }, aro: { X: menu.id, pv: 6 } }, eje, 'huesped', GRANDE);
  const seis = d.aro.huecos.find((g) => g.pv === 6);
  assert.equal(seis.abierto, true);
  assert.ok(seis.otras.length >= 1);
  assert.equal(d.aro.huecos.filter((g) => g.abierto).length, 1);
  const hd = html(d);
  assert.equal((hd.match(/<ul class="otras"/g) ?? []).length, 1);
  for (const o of seis.otras) assert.match(hd, new RegExp(`<ul class="otras">[^]*data-lanzar="${o.id}"`));
  // en la compra, que es suya, el 3 ofrece a la huésped «admitir a alguien» (encargo equipo: darle R mía) y los valores que
  // escribir (las identidades: contrato.opciones), que despliega el clic mantenido
  const c = await arbol({ foco: { X: compra.id, pv: 0 }, aro: { X: compra.id, pv: null } }, eje, 'huesped', GRANDE);
  const tres = c.aro.huecos.find((g) => g.pv === 3);
  assert.equal(tres.accion?.nombre, 'admitir a alguien');
  assert.deepEqual(tres.opciones.map((o) => o.valor), eje.identidades());
  const sitioTres = (a) => html(a).match(/<li class="hueco hueco-3[^]*?<\/li>/)[0];
  // un sitio sin acciones no tiene clic, pero sí su lista de valores; sin acciones ni valores, apagado y sin lista
  const sinAcciones = { ...c, aro: { ...c.aro, huecos: c.aro.huecos.map((g) => (g.pv === 3 ? { ...g, accion: null, accionPorDefecto: null, otras: [], alternativas: [] } : g)) } };
  assert.doesNotMatch(sitioTres(sinAcciones), /apagado|data-lanzar/);
  assert.match(sitioTres(sinAcciones), /<span class="accion vacia"[^]*data-con-lista|data-con-lista[^]*<span class="accion vacia"/);
  const sinNada = { ...sinAcciones, aro: { ...sinAcciones.aro, huecos: sinAcciones.aro.huecos.map((g) => (g.pv === 3 ? { ...g, opciones: [] } : g)) } };
  assert.match(sitioTres(sinNada), /<li class="hueco hueco-3[^"]* apagado"/);
  assert.doesNotMatch(sitioTres(sinNada), /data-lanzar|data-con-lista/);
});

test('el aro (VG, 11-11, #5): cada sitio trae su acción por defecto, sus alternativas y los valores de su posición (contrato.opciones); el centro, su valor, la lista del 0 y la del 5; sin botones extra', async () => {
  const H = await ejemploComprasHermanas();
  const X = H.fruta.id;
  const a = await arbol({ foco: { X, pv: 0 }, aro: { X, pv: 3 } }, H.eje, 'huesped', GRANDE);
  const comoTexto = (l) => l.map((o) => o.texto);
  for (const h of a.aro.huecos) {
    const lista = A.acciones(H.eje, X, h.pv, 'huesped');
    const porDefecto = lista.find((x) => x.porDefecto) ?? lista[0] ?? null;
    assert.equal(h.accionPorDefecto?.id ?? null, porDefecto?.id ?? null, 'el clic del sitio ' + h.pv);
    assert.deepEqual(h.alternativas.map((x) => x.id), lista.filter((x) => x !== porDefecto).map((x) => x.id));
    assert.deepEqual(comoTexto(h.opciones), comoTexto(C.opciones(H.eje, X, h.pv, { yo: 'huesped', idioma: a.idioma })), 'los valores del sitio ' + h.pv);
  }
  const c = a.aro.centro;
  assert.equal(c.valor, a.aro.texto);
  assert.deepEqual(comoTexto(c.opciones0), comoTexto(C.opciones(H.eje, X, 0, { idioma: a.idioma })));
  assert.ok(c.opciones0.length >= 1, 'el 0 de las compras hermanas');
  assert.deepEqual(comoTexto(c.opciones5), comoTexto(C.opciones(H.eje, X, 5, { idioma: a.idioma })));
  assert.ok(c.opciones5.some((o) => o.valor === 'purchase'), 'el 5: las plantillas');
  assert.equal(c.editando, false);
  const h = html(a);
  // desplegado el 3 (como lo deja el clic mantenido): sus alternativas y, aparte, los valores para escribir
  const tres = a.aro.huecos.find((g) => g.pv === 3);
  const lista3 = h.match(/<li class="hueco hueco-3[^]*?<\/ul><\/li>/)[0];
  for (const o of tres.alternativas) assert.match(lista3, new RegExp(`data-lanzar="${o.id}"`));
  for (const o of tres.opciones) assert.match(lista3, new RegExp(`data-opcion="3" data-valor="${o.valor}"`));
  // sin botones extra: ni «+N», ni ×, ni play; el centro es pulsable (data-aro-centro) y no está en edición
  assert.doesNotMatch(h, /data-aro-hueco|class="mas"|class="cerrar"[^>]*>×<\/button><\/p><\/div><\/div>/);
  assert.doesNotMatch(h.slice(h.indexOf('<div class="aro-fondo"')), /class="cerrar"/);
  assert.match(h, /<div class="aro-centro" data-aro-centro data-x="[0-9a-f]{64}"/);
  assert.doesNotMatch(h, /aro-edicion/);
  // mantener el centro (estado.aro.editar): el input con su valor, la lista del 5 encima y la del 0 debajo
  const e = await arbol({ foco: { X, pv: 0 }, aro: { X, pv: null, editar: true } }, H.eje, 'huesped', GRANDE);
  assert.equal(e.aro.centro.editando, true);
  const he = html(e);
  assert.match(he, /<div class="aro editando"/);
  const edicion = he.match(/<div class="aro-edicion">[^]*?<\/div>/)[0];
  assert.match(edicion, /^<div class="aro-edicion"><ul class="opciones opciones-arriba" data-opciones="5">[^]*<\/ul><input class="campo-input" data-campo="0" data-x="[0-9a-f]{64}" value="[^"]+"[^>]*><ul class="opciones opciones-abajo" data-opciones="0">/);
  for (const o of e.aro.centro.opciones0) assert.match(edicion, new RegExp(`data-opcion="0" data-valor="${o.valor}"`));
});

test('el formulario (#5): un parámetro con valores posibles es un <select> con «otro…» que destapa el input; sin valores, el input libre', async () => {
  const { eje, compra } = await ejemploCompra();
  const f = formulario(eje, compra.id, 'write to X', 'huesped');
  const quien = f.campos.find((c) => c.nombre === 'who');
  assert.deepEqual(quien.opciones.map((o) => o.valor), eje.identidades());
  assert.deepEqual(f.campos.find((c) => c.nombre === 'text').opciones, []);
  const pintar = async (valores) => html(await arbol({ foco: { X: compra.id, pv: 0 }, formulario: { X: compra.id, accion: 'write to X', valores } }, eje, 'huesped', ORDENADOR));
  const h = await pintar({});
  assert.match(h, /<select class="param-opciones" data-otro-de="param-who" aria-label="[^"]*" required><option value="" selected><\/option><option value="casa">[^]*?<option value="otro…" data-otro>otro…<\/option><\/select><input id="param-who" name="who"[^>]* hidden>/, 'sin valor, en blanco; lo requerido lo pide el desplegable');
  assert.doesNotMatch(h.match(/<input id="param-who"[^>]*>/)[0], / required/);
  assert.match(h, /<input id="param-text" name="text"[^>]* required/, 'sin valores, el input libre de siempre');
  assert.doesNotMatch(h, /data-otro-de="param-text"/);
  const dado = await pintar({ who: 'huesped' });
  assert.match(dado, /<option value="huesped" selected>[^]*?<input id="param-who" name="who"[^>]*value="Alta de huesped"[^>]* hidden>/, 'el valor dado, elegido; el input (su legible, como siempre), oculto');
  const otro = await pintar({ who: 'nadie' });
  assert.match(otro, /<option value="otro…" data-otro selected>otro…<\/option><\/select><input id="param-who" name="who"[^>]*value="nadie"[^>]*>/);
  assert.doesNotMatch(otro.match(/<input id="param-who"[^>]*>/)[0], / hidden/, 'un valor fuera de la lista: «otro…» y el input a la vista');
  // gestos.js: elegir un valor lo pone en el input (oculto); «otro…» lo destapa vacío
  const g = gestosDeMentira();
  const input = { hidden: true, value: 'huesped', focus() { this.enfocado = true; } };
  const select = (value, esOtro) => ({ matches: (sel) => sel === '[data-otro-de]', dataset: { otroDe: 'param-who' }, value, selectedOptions: [{ hasAttribute: (a) => a === 'data-otro' && esOtro }], ownerDocument: { getElementById: (id) => (id === 'param-who' ? input : null) } });
  g.disparar('change', { target: select('casa', false) });
  assert.deepEqual([input.hidden, input.value], [true, 'casa']);
  g.disparar('change', { target: select('', true) });
  assert.deepEqual([input.hidden, input.value, input.enfocado], [false, '', true]);
  assert.deepEqual(g.llamadas, [], 'es cosa de la pantalla: la app no se entera hasta enviar');
});

test('la cadena de la época empieza por general y el modelo por defecto la devuelve en ese orden (el interruptor «animado» enseña el arte sin tocar Configuración)', async () => {
  const { eje } = await ejemploCompra();
  assert.deepEqual(modelos.cabecera().cadena, ['general', 'animado-generico', 'sobrio']);
  assert.deepEqual(modelos.modelo(eje, 'huesped').map((m) => m.nombre), ['general', 'animado-generico', 'sobrio']);
  assert.equal(C.configuracion(eje, 'huesped').render, 'sober', 'lo que se pinta lo manda render; el modelo solo ordena la cadena');
});

/** Una raíz de mentira para gestos.js: guarda los oyentes y deja disparar eventos con un objetivo hecho a mano. */
function gestosDeMentira({ ventana = { innerWidth: 1920, innerHeight: 1080 }, aroAbierto = false } = {}) {
  const oyentes = [];
  const documento = { defaultView: ventana, addEventListener: (t, f) => oyentes.push([t, f]), removeEventListener() {} };
  const raiz = { ownerDocument: documento, addEventListener: (t, f) => oyentes.push([t, f]), removeEventListener() {}, querySelector: (sel) => (sel === '.aro' && aroAbierto ? {} : null) };
  const llamadas = [];
  const m = new Proxy({}, { get: (_, nombre) => (...args) => { llamadas.push([nombre, ...args]); } });
  instalar(raiz, m);
  const disparar = (tipo, evento) => { for (const [t, f] of oyentes) if (t === tipo) f(evento); };
  return { disparar, llamadas };
}

/** Un objetivo de mentira: `closest` responde por un trozo del selector pedido. */
const objetivo = (respuestas) => ({ closest: (sel) => { for (const [trozo, v] of Object.entries(respuestas)) if (sel.includes(trozo)) return v; return null; } });

test('gestos: el clic derecho sobre un elemento abre el aro con la caja del elemento (getBoundingClientRect) como ancla; si es enorme, una caja en el puntero', () => {
  const caja = (left, top, width, height) => ({ dataset: { x: 'X1' }, getBoundingClientRect: () => ({ left, top, width, height }) });
  const g = gestosDeMentira();
  let prevenido = 0;
  g.disparar('contextmenu', { target: objetivo({ '.ocupante': caja(300, 200, 180, 40), '[data-x]': caja(300, 200, 180, 40) }), clientX: 320, clientY: 210, preventDefault: () => { prevenido++; } });
  assert.equal(prevenido, 1);
  assert.deepEqual(g.llamadas[0], ['aro', 'X1', null, { ancla: { x: 300, y: 200, ancho: 180, alto: 40 } }]);
  const g2 = gestosDeMentira();
  g2.disparar('contextmenu', { target: objetivo({ '.ocupante': caja(0, 0, 1900, 1000), '[data-x]': caja(0, 0, 1900, 1000) }), clientX: 500, clientY: 400, preventDefault() {} });
  assert.deepEqual(g2.llamadas[0], ['aro', 'X1', null, { ancla: { x: 440, y: 382, ancho: 120, alto: 36 } }], 'un elemento que ocupa media ventana no sirve de ancla');
});

test('gestos: dentro del aro, el clic derecho (mantener) sobre un sitio con lista la despliega y sobre el centro lo edita; un clic en un valor lo escribe y en el centro entra; con el aro abierto, las teclas 1-4 y 6-9 son del aro y Esc cierra', () => {
  const g = gestosDeMentira({ aroAbierto: true });
  const aro = { dataset: { x: 'X1' } };
  const conLista = { dataset: { pv: '7', conLista: '' } };
  g.disparar('contextmenu', { target: objetivo({ '.aro': aro, '.hueco': conLista }), preventDefault() {} });
  assert.deepEqual(g.llamadas[0], ['aro', 'X1', 7, { desplegar: true }]);
  // un sitio sin lista (apagado o solo con su acción por defecto): mantenerlo no hace nada
  const h0 = gestosDeMentira({ aroAbierto: true });
  h0.disparar('contextmenu', { target: objetivo({ '.aro': aro, '.hueco': { dataset: { pv: '3' } } }), preventDefault() {} });
  assert.deepEqual(h0.llamadas, []);
  const c = gestosDeMentira({ aroAbierto: true });
  c.disparar('contextmenu', { target: objetivo({ '.aro': aro, '[data-aro-centro]': { dataset: { x: 'X1' } } }), preventDefault() {} });
  assert.deepEqual(c.llamadas, [['editarAro']]);
  const k = gestosDeMentira({ aroAbierto: true });
  k.disparar('click', { target: objetivo({ '[data-opcion]': { dataset: { opcion: '3', valor: 'huesped', x: 'X1' } } }), preventDefault() {} });
  k.disparar('click', { target: objetivo({ '[data-aro-centro]': { dataset: { x: 'X1' } } }), preventDefault() {} });
  assert.deepEqual(k.llamadas, [['opcion', 'X1', 3, 'huesped'], ['aroEntrar', 'X1']]);
  const tecla = (key) => g.disparar('keydown', { key, target: objetivo({}), preventDefault() {}, ctrlKey: false, metaKey: false, altKey: false });
  tecla('4');
  tecla('0');
  tecla('Escape');
  assert.deepEqual(g.llamadas.slice(1), [['aroTecla', 4], ['aroTecla', 0], ['cerrar']]);
  // sin aro abierto, las teclas siguen saltando de mundo
  const h = gestosDeMentira();
  h.disparar('keydown', { key: '4', target: objetivo({}), preventDefault() {}, ctrlKey: false, metaKey: false, altKey: false });
  assert.deepEqual(h.llamadas, [['saltar', 4]]);
});

test('gestos: un clic entra en profundidad (una celda, un registro) y mantener medio segundo abre el aro sobre el elemento, anclado a él; el clic que llega al soltar no cuenta; mantener un campo abre el aro con su lista; moverse cancela', () => {
  mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 10_000_000 });
  try {
    const caja = { dataset: { x: 'R1', abrir: 'R1' }, getBoundingClientRect: () => ({ left: 300, top: 200, width: 180, height: 40 }) };
    const ocupante = objetivo({ '[data-abrir]': caja, '.ocupante': caja, '[data-x]': caja });
    const g = gestosDeMentira();
    const pulsar = (target, ms, { mover = 0 } = {}) => {
      g.disparar('pointerdown', { pointerId: 1, clientX: 320, clientY: 210, button: 0, target });
      if (mover) g.disparar('pointermove', { pointerId: 1, clientX: 320 + mover, clientY: 210, target });
      mock.timers.tick(ms);
      g.disparar('pointerup', { pointerId: 1, clientX: 320 + mover, clientY: 210, target });
      g.disparar('click', { target, preventDefault() {} });
    };
    pulsar(ocupante, 120);
    assert.deepEqual(g.llamadas, [['foco', 'R1', 0]], 'un clic entra en el registro');
    pulsar(ocupante, 520);
    assert.deepEqual(g.llamadas.slice(1), [['aro', 'R1', null, { ancla: { x: 300, y: 200, ancho: 180, alto: 40 } }]], 'mantener abre el aro y el clic de soltar no entra');
    mock.timers.tick(1000);
    const celda = objetivo({ '[data-celda]': { dataset: { celda: 'R2', pv: '2', x: 'R2' }, closest: () => ({ dataset: { rejilla: '1' } }) }, '[data-x]': { dataset: { x: 'R2' } } });
    pulsar(celda, 80);
    assert.deepEqual(g.llamadas.slice(2), [['celda', 1, 'R2']], 'un clic en una celda baja un nivel');
    pulsar(celda, 600, { mover: 30 });
    assert.deepEqual(g.llamadas.slice(3), [['celda', 1, 'R2']], 'moverse más de unos píxeles no es mantener: al soltar es un clic');
    mock.timers.tick(1000);
    // un campo del anverso: mantenerlo abre el aro sobre su registro con la lista de ese campo desplegada
    const input = { dataset: { campo: '3', x: 'X1' } };
    const campo = objetivo({ input, '[data-campo]': input, '[data-x]': input });
    g.disparar('pointerdown', { pointerId: 2, clientX: 50, clientY: 60, button: 0, target: campo });
    mock.timers.tick(520);
    assert.deepEqual(g.llamadas.at(-1), ['aro', 'X1', 3, { desplegar: true, ancla: { x: -10, y: 42, ancho: 120, alto: 36 } }]);
    // el clic derecho no arranca el mantener (va por contextmenu)
    const n = g.llamadas.length;
    g.disparar('pointerdown', { pointerId: 3, clientX: 50, clientY: 60, button: 2, target: ocupante });
    mock.timers.tick(600);
    assert.equal(g.llamadas.length, n);
  } finally {
    mock.timers.reset();
  }
});

test('gestos: un clic en una celda de la rejilla o en la acción de un sitio del aro entra o lanza aunque su contenedor lleve data-fila (su fila en la cuadrícula); solo la cabeza de una fila de Sequenced (un botón) abre la fila', () => {
  // un objetivo que responde como el DOM: [data-fila] lo lleva el contenedor (una celda, un sitio), no un botón
  const enContenedorConFila = (propio, clave) => ({ closest: (sel) => (sel === clave ? propio : sel === '[data-fila]' ? { dataset: { fila: '0' } } : null) });
  const g = gestosDeMentira();
  g.disparar('click', { target: enContenedorConFila({ dataset: { celda: 'R2', pv: '1' }, closest: () => ({ dataset: { rejilla: '1' } }) }, '[data-celda]'), preventDefault() {} });
  g.disparar('click', { target: enContenedorConFila({ dataset: { lanzar: 'A1', x: 'X1' } }, '[data-lanzar]'), preventDefault() {} });
  g.disparar('click', { target: { closest: (sel) => (sel === 'button[data-fila]' ? { dataset: { fila: '3' } } : null) }, preventDefault() {} });
  assert.deepEqual(g.llamadas, [['celda', 1, 'R2'], ['lanzar', 'X1', 'A1', null], ['fila', 3]]);
});

test('gestos: el doble clic (o doble toque) pone como foco lo que había bajo el primer clic, aunque el primero ya entrara y repintara (#23); sobre el centro sigue editando; dentro del aro no hace nada; el clic y el mantener no cambian', () => {
  mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 20_000_000 });
  try {
    const celda = objetivo({ '[data-celda]': { dataset: { celda: 'R2', pv: '2', x: 'R2' }, closest: () => ({ dataset: { rejilla: '1' } }) }, '[data-x]': { dataset: { x: 'R2' } } });
    const otro = objetivo({ '[data-x]': { dataset: { x: 'R9' } } }); // lo que queda bajo el puntero tras repintar
    const g = gestosDeMentira();
    g.disparar('click', { target: celda, preventDefault() {} });
    mock.timers.tick(150);
    g.disparar('click', { target: otro, preventDefault() {} });
    g.disparar('dblclick', { target: otro, preventDefault() {} });
    assert.deepEqual(g.llamadas, [['celda', 1, 'R2'], ['foco', 'R2', 0]], 'un clic entra (la celda); el doble clic enfoca el elemento del primer clic, no lo que quedó debajo');
    // Un doble clic suelto (sin clic registrado antes, o pasado el rato): el elemento que tiene debajo.
    mock.timers.tick(2000);
    const h = gestosDeMentira();
    h.disparar('dblclick', { target: otro, preventDefault() {} });
    assert.deepEqual(h.llamadas, [['foco', 'R9', 0]]);
    // Sobre el centro (ya es el foco): editar, como antes.
    const centro = objetivo({ '[data-centro]': { dataset: { x: 'F', centro: '0' } }, '[data-x]': { dataset: { x: 'F' } } });
    const c = gestosDeMentira();
    c.disparar('click', { target: centro, preventDefault() {} });
    c.disparar('dblclick', { target: centro, preventDefault() {} });
    assert.deepEqual(c.llamadas.at(-1), ['editar', 'F', 0]);
    // Dentro del aro o de un diálogo, nada.
    const a = gestosDeMentira({ aroAbierto: true });
    a.disparar('dblclick', { target: objetivo({ '.aro': { dataset: { x: 'X1' } }, '[data-x]': { dataset: { x: 'X1' } } }), preventDefault() {} });
    assert.deepEqual(a.llamadas, []);
  } finally {
    mock.timers.reset();
  }
});

test('la app ancla el aro al elemento en Mapped con position:fixed (en app.js, no en el árbol), recortado a la ventana; el móvil apilado lo deja centrado', () => {
  const app = readFileSync(new URL('../carta/app.js', import.meta.url), 'utf8');
  assert.match(app, /function situarAro\(\)/);
  assert.match(app, /if \(!aro \|\| !ancla \|\| !enMapped\(\)\) return;/, 'solo en Mapped y con ancla: el apilado queda centrado');
  assert.match(app, /aro\.style\.left = dentro\(/);
  const css = readFileSync(new URL('../carta/estilo.css', import.meta.url), 'utf8');
  assert.match(css, /\.aro\.anclado\{position:fixed/);
  assert.match(css, /\.hueco\[data-fila="2"\] \.otras\{top:auto;bottom/, 'las alternativas de la fila de abajo crecen hacia arriba');
  const carta = readFileSync(new URL('../carta/carta.js', import.meta.url), 'utf8');
  assert.doesNotMatch(carta.slice(carta.indexOf('function nodoAro'), carta.indexOf('/** El idioma de quien mira')), /getBoundingClientRect|innerWidth|style/);
});

// ---------- el móvil apaisado (VG, 11-11): vertical Sequenced, apaisado Mapped, todo sin scroll ----------

// Las ventanas de los móviles girados, con la barra del navegador ya restada (alto de la ventana) y, de ese alto, lo que ocupa la barra de la
// carta (39 px en una fila compacta; 80 si por error se pintara en dos filas): lo que llega a arbol() es lo que queda para la escena.
const APAISADOS = [[844, 390], [915, 412], [740, 360]];
const BARRA_DE_LA_CARTA = [39, 80];

test('las medidas por pantalla (carta.js medidasDePantalla): en apaisado y bajo el hueco, la tarjeta y la línea se reducen en proporción al alto útil, con un mínimo; en vertical y en el ordenador, las de siempre', () => {
  // el ordenador y el móvil en vertical no cambian
  for (const [ancho, alto] of [[1366, 768], [1920, 1080], [400, 700], [390, 844], [1200, 800]]) {
    assert.deepEqual(medidasDePantalla(ancho, alto), { ancho, alto }, ancho + ' × ' + alto + ' lleva las medidas de siempre (MEDIDAS)');
  }
  assert.ok(ALTO_BAJO > 390 && ALTO_BAJO <= 500);
  const chico = medidasDePantalla(844, 351);
  assert.deepEqual([chico.ancho, chico.alto], [844, 351]);
  assert.ok(chico.hueco < MEDIDAS.hueco && chico.tarjeta < MEDIDAS.tarjeta && chico.linea < MEDIDAS.linea, JSON.stringify(chico));
  assert.ok(chico.hueco >= 28 && chico.tarjeta >= 90 && chico.linea >= 17, 'no se encogen más de la cuenta: ' + JSON.stringify(chico));
  // cuanto más bajo, más pequeño (hasta el mínimo), y nunca más que lo de siempre
  let antes = Infinity;
  for (const alto of [499, 450, 400, 351, 320]) {
    const m = medidasDePantalla(900, alto);
    assert.ok(m.hueco <= antes && m.hueco <= MEDIDAS.hueco && m.tarjeta <= MEDIDAS.tarjeta && m.linea <= MEDIDAS.linea);
    antes = m.hueco;
  }
  // una ventana más alta que ancha no se reduce aunque sea baja (el teclado del móvil en vertical)
  assert.deepEqual(medidasDePantalla(280, 300), { ancho: 280, alto: 320 });
});

test('el móvil apaisado (844 × 390, 915 × 412, 740 × 360, sin la barra del navegador ni la de la carta) es Mapped y no apilado: el foco, un PV en bloque, todos en el grupo y la pantalla completa de los ocho mundos, sin scroll', async () => {
  const { eje: ejeCompra, compra: laCompra } = await ejemploCompra();
  const { eje: ejeReserva, reserva } = await ejemploReserva();
  for (const [eje, compra] of [[ejeCompra, laCompra], [ejeReserva, reserva]]) for (const [ancho, alto] of APAISADOS) {
    for (const barra of BARRA_DE_LA_CARTA) {
      const medidas = medidasDePantalla(ancho, alto - barra);
      const donde = ancho + ' × ' + alto + ' (útil ' + medidas.alto + ')';
      // el foco (la pantalla inicial)
      const foco = await arbol({ foco: { X: compra.id, pv: 0 } }, eje, 'huesped', medidas);
      assert.equal(foco.apilada, false, 'Mapped y no apilada: ' + donde);
      assert.ok(foco.mapa && foco.mapa.completa === null, donde);
      sinScroll(foco, 'foco ' + donde);
      // todos un paso (el grupo) y dos pasos (la matriz 3 × 3 en bloque)
      let estado = { foco: { X: compra.id, pv: 0 } };
      for (const paso of ['grupo', 'bloque']) {
        estado = { ...estado, ...ampliarTodos(estado, +1) };
        const a = await arbol(estado, eje, 'huesped', medidas);
        assert.equal(a.apilada, false, paso + ' ' + donde);
        sinScroll(a, paso + ' ' + donde);
        if (paso === 'bloque') assert.ok(a.mapa.matriz && a.laterales.every((n) => n.caja && n.nivel === NIVEL.bloque), 'la matriz 3 × 3 en bloque ' + donde);
      }
      // un PV en bloque y los demás en punto (el clic sobre un PV sube un paso a ese solo)
      const base = { foco: { X: compra.id, pv: 0 }, ...ampliarTodos({}, +1) };
      for (const pv of [1, 8]) {
        const unPv = await arbol({ ...base, ...ampliar(base, pv, +1) }, eje, 'huesped', medidas);
        assert.equal(unPv.apilada, false);
        sinScroll(unPv, 'el PV ' + pv + ' en bloque ' + donde);
      }
      // la pantalla completa de cada mundo
      for (const pv of LATERALES) {
        const a = await arbol({ foco: { X: compra.id, pv } }, eje, 'huesped', medidas);
        assert.equal(a.apilada, false, 'pantalla completa del ' + pv + ' ' + donde);
        assert.equal(a.mapa.completa.pv, pv);
        sinScroll(a, 'pantalla completa del ' + pv + ' ' + donde);
        const h = html(a);
        assert.match(h, /class="volver volver-claro"/);
        assert.equal((h.match(/class="vecino /g) ?? []).length, a.mapa.completa.vecinos.length);
      }
    }
  }
});

test('el móvil en vertical (400 × 700, 390 × 844) sigue apilado (Sequenced) y gira a Mapped con el mismo foco; la medida del apilado no cambia', async () => {
  const { eje, compra } = await ejemploCompra();
  for (const [ancho, alto] of [[400, 700], [390, 844], [360, 640]]) {
    const medidas = medidasDePantalla(ancho, alto - 80);
    assert.deepEqual(medidas, { ancho, alto: alto - 80 }, 'el vertical lleva las medidas de siempre');
    const a = await arbol({ foco: { X: compra.id, pv: 0 } }, eje, 'huesped', medidas);
    assert.equal(a.apilada, true, ancho + ' × ' + alto);
    assert.equal(a.mapa, null);
    // el mismo móvil girado: la proporción alto/ancho lo decide la época
    const girado = await arbol({ foco: { X: compra.id, pv: 0 } }, eje, 'huesped', medidasDePantalla(alto, ancho - 39));
    assert.equal(girado.apilada, false, 'girado: ' + alto + ' × ' + ancho);
    assert.ok(girado.mapa);
  }
  // y el umbral es de la época, no del código: ni carta.js ni app.js comparan alto y ancho para decidir
  const carta = readFileSync(new URL('../carta/carta.js', import.meta.url), 'utf8');
  assert.match(carta, /const apilada = d\.disposicion !== disposiciones;/);
});

test('el móvil apaisado, en CSS y en app.js: las medidas las manda app.js por el tamaño de la ventana; el personaje de cada sitio y los rosetones de 32 px son solo CSS por alto y orientación', () => {
  const app = readFileSync(new URL('../carta/app.js', import.meta.url), 'utf8');
  // Sin barra (#38): la escena mide la ventana entera.
  assert.match(app, /medidasDePantalla\(window\.innerWidth, window\.innerHeight\)/);
  assert.doesNotMatch(app, /querySelector\('\.barra'\)/);
  const css = readFileSync(new URL('../carta/estilo.css', import.meta.url), 'utf8');
  const bloque = css.slice(css.indexOf('@media (orientation:landscape) and (max-height:500px){'));
  assert.ok(bloque.length > 200, 'hay un bloque CSS para el móvil apaisado');
  assert.doesNotMatch(css, /\.barra[\s{,.:>-]/, 'la barra superior ya no tiene estilos');
  assert.match(bloque, /\.sitio-interrogante\{width:32px;height:32px/, 'el personaje del sitio, objetivo táctil de 32 px');
  assert.match(bloque, /\.rosetones-mapa \.roseton[^{]*\{width:32px;height:32px/, 'los rosetones, objetivos de 32 px');
  assert.match(bloque, /\.punto,\.punto\.centro,\.todos-menos\{width:32px;height:32px/, 'los puntitos del foco, de 32 px');
  assert.match(bloque, /\.vecino\{height:32px;min-width:32px/, 'las flechas a los vecinos, de 32 px');
  // el aro anclado lee sus medidas del CSS ya anclado (antes eran min(...) y salían a 0): la clase va antes de getComputedStyle
  const situar = app.slice(app.indexOf('function situarAro()'));
  assert.ok(situar.indexOf("aro.classList.add('anclado')") > 0 && situar.indexOf("aro.classList.add('anclado')") < situar.indexOf('getComputedStyle(aro)'));
  // lo que repinta al girar sigue ahí: cambia el ancho y no hay un campo con el foco
  assert.match(app, /window\.innerWidth === anchoAnterior\) return;/);
  assert.match(app, /const editando = \/\^\(INPUT\|TEXTAREA\|SELECT\)\$\/\.test\(document\.activeElement\?\.tagName/);
});

// ---------- el 3 por tema: el orden y el botón que cicla, el personaje del sitio y arrastrar (encargo pv3, VG 12-11) ----------

/** La casa con dos personas en su caja 3: la huésped (a quien invitó: tiene R de la casa) y ana (escribe con su R y la casa la lleva al 3). */
async function tresDeLaCasa() {
  const { entrarPorInvitacion } = await import('../ejemplos/ikisai/altas.mjs');
  const c = await ejemploCompra();
  const alta = c.eje.alta('casa').id;
  await entrarPorInvitacion(c.eje, { por: 'huesped', quien: 'ana', t: T1 });
  const lanzar = async (nombre, X, valores, yo, m) => {
    const r = await A.transaccion(c.eje, nombre, { X, ...valores }, yo, { t: '2026-11-08T10:0' + m + ':00Z' });
    assert.equal(r.ok, true, nombre + ': ' + JSON.stringify(r.motivos));
    return c.eje.anadir(r.evento);
  };
  await lanzar('write to X', alta, { text: 'hola, casa' }, 'ana', 1);
  await lanzar('move to group', c.eje.alta('ana').id, { zone: 3 }, 'casa', 2);
  return { ...c, alta, lanzar };
}

test('el 3 por tema: en cada caja, primero quienes tienen R mía (doy) y luego quienes usan la suya (recibo), con su marcador; el botón de la caja cicla todos → doy → recibo y filtra', async () => {
  const { eje, alta } = await tresDeLaCasa();
  const caja = async (filtro) => (await arbol({ foco: { X: alta, pv: 3 }, filtrosDelTres: filtro ? { 3: filtro } : {} }, eje, 'casa', GRANDE)).centro.rejilla.celdas.find((c) => c.caja === 3);
  const todos = await caja();
  assert.deepEqual(todos.personas.map((p) => [p.identidad, p.doy, p.recibo]), [['huesped', eje.saldo('huesped', 'R:casa'), 0], ['ana', 0, 1]], 'la huésped tiene R de la casa: delante');
  assert.equal(todos.filtro, 'todos');
  assert.deepEqual((await caja('doy')).personas.map((p) => p.identidad), ['huesped']);
  assert.deepEqual((await caja('recibo')).personas.map((p) => p.identidad), ['ana']);
  // en la pantalla: el botón dice su estado y cada persona su marcador (↑ lo que doy, ↓ lo que recibo; solo CSS)
  const h = html(await arbol({ foco: { X: alta, pv: 3 }, filtrosDelTres: { 3: 'recibo' } }, eje, 'casa', GRANDE));
  assert.match(h, /data-filtro-caja="3" data-filtro="recibo"[^>]*>recibo<\/button>/);
  assert.match(h, /data-persona="ana" data-caja="3"[^>]*>[\s\S]*?<small class="recibo"[^>]*>1<\/small>/);
  assert.match(html(await arbol({ foco: { X: alta, pv: 3 } }, eje, 'casa', GRANDE)), /data-persona="huesped" data-caja="3"[^>]*>[\s\S]*?<small class="doy"/);
  // gestos.js: un clic en el botón llama a filtroCaja con su caja (la app cicla: carta/app.js)
  const g = gestosDeMentira();
  g.disparar('click', { target: objetivo({ '[data-filtro-caja]': { dataset: { filtroCaja: '3', filtro: 'todos' } } }), preventDefault() {} });
  assert.deepEqual(g.llamadas, [['filtroCaja', 3]]);
  const app = readFileSync(new URL('../carta/app.js', import.meta.url), 'utf8');
  assert.match(app, /filtroCaja\(caja\) \{[\s\S]*?\['todos', 'doy', 'recibo'\]/);
});

test('el personaje del sitio (#38): el interrogante de cada caja del 3 (y del 3 entero) abre la cruceta del propio nodo, sus diez posiciones con su nombre, su valor y su acción con los parámetros del sitio', async () => {
  const { eje, alta, lanzar } = await tresDeLaCasa();
  await lanzar('set a minimum', alta, { box: 3, amount: 1 }, 'casa', 3);
  const a = await arbol({ foco: { X: alta, pv: 3 } }, eje, 'casa', GRANDE);
  const h = html(a);
  for (const d of [0, 1, 2, 3, 4, 5]) assert.match(h, new RegExp(`class="sitio-interrogante"[^>]*data-sitio="3.${d}" data-sitio-x="${alta}"`));
  assert.match(h, new RegExp(`class="sitio-interrogante sitio-centro"[^>]*data-sitio="3" data-sitio-x="${alta}"`));
  // pulsarlo: gestos → sitio(X, lugar); la app pone estado.sitio y el árbol trae la cruceta del nodo 3.3
  const g = gestosDeMentira();
  g.disparar('click', { target: objetivo({ '[data-sitio]': { dataset: { sitio: '3.3', sitioX: alta } } }), preventDefault() {} });
  assert.deepEqual(g.llamadas, [['sitio', alta, '3.3', { general: false }]]);
  const b = await arbol({ foco: { X: alta, pv: 3 }, sitio: { X: alta, lugar: '3.3' } }, eje, 'casa', GRANDE);
  assert.deepEqual(b.sitio.posiciones.map((p) => p.posicion), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const uno = b.sitio.posiciones[1];
  assert.deepEqual([uno.nombre, uno.valor, uno.accion.nombre, uno.accion.valores], ['cuánto', '1', 'set a minimum', { box: 3 }]);
  assert.deepEqual(b.sitio.posiciones[5].accion.valores, { place: '3.3', position: 5 }, 'el 5, el estilo de lo de abajo (X.3.3.5.0), ya tiene dónde tocarse');
  const hb = html(b);
  assert.equal((hb.match(/class="sitio-posicion"/g) ?? []).length, 10);
  assert.match(hb, new RegExp(`data-sitio-lanzar="${uno.accion.id}" data-x="${alta}" data-valores="\\{&quot;box&quot;:3\\}"`));
  // una posición: gestos → lanzarCon(X, acción, valores) → el formulario de siempre con los parámetros del sitio
  const k = gestosDeMentira();
  k.disparar('click', { target: objetivo({ '[data-sitio-lanzar]': { dataset: { sitioLanzar: uno.accion.id, x: alta, valores: '{"box":3}' } } }), preventDefault() {} });
  assert.deepEqual(k.llamadas, [['lanzarCon', alta, uno.accion.id, { box: 3 }]]);
  const f = await arbol({ foco: { X: alta, pv: 3 }, sitio: { X: alta, lugar: '3.3' }, formulario: { X: alta, accion: uno.accion.id, valores: { box: 3 } } }, eje, 'casa', GRANDE);
  assert.deepEqual([f.sitio, f.formulario.campos.find((c) => c.nombre === 'box').valor], [null, 3], 'el formulario encima; la cruceta vuelve al cerrarlo');
  // quien no es el dueño la ve, pero sin acciones; el mínimo se lee en su caja
  assert.ok((await arbol({ foco: { X: alta, pv: 3 }, sitio: { X: alta, lugar: '3.3' } }, eje, 'huesped', GRANDE)).sitio.posiciones.every((p) => p.accion === null));
  assert.deepEqual(a.centro.rejilla.celdas.find((c) => c.caja === 3).minimo.cantidad, 1);
});

test('arrastrar a alguien de una caja del 3 a otra reclasifica la conversación (al 5, vetar), en Mapped y en Sequenced: gestos → reclasificar → «move to group»', async () => {
  const { eje, alta } = await tresDeLaCasa();
  // gestos.js: pulsar una persona, moverla más que el umbral y soltarla sobre otra caja
  const g = gestosDeMentira();
  const persona = { dataset: { persona: 'ana', caja: '3', x: eje.alta('ana').id }, classList: { add() {}, remove() {} } };
  g.disparar('pointerdown', { pointerId: 1, clientX: 100, clientY: 100, button: 0, target: objetivo({ '[data-persona]': persona, '[data-x]': persona }) });
  g.disparar('pointermove', { pointerId: 1, clientX: 160, clientY: 140, target: objetivo({}), preventDefault() {} });
  g.disparar('pointerup', { pointerId: 1, clientX: 160, clientY: 140, target: objetivo({ '[data-caja]': { dataset: { caja: '5' } } }) });
  g.disparar('click', { target: objetivo({ '[data-celda]': { dataset: { celda: 'x' } } }), preventDefault() {} });
  assert.deepEqual(g.llamadas, [['reclasificar', 'ana', 5]], 'reclasifica, y el clic de soltar no entra');
  // soltarla en su misma caja no reclasifica
  const h = gestosDeMentira();
  h.disparar('pointerdown', { pointerId: 2, clientX: 0, clientY: 0, button: 0, target: objetivo({ '[data-persona]': persona }) });
  h.disparar('pointermove', { pointerId: 2, clientX: 40, clientY: 0, target: objetivo({}), preventDefault() {} });
  h.disparar('pointerup', { pointerId: 2, clientX: 40, clientY: 0, target: objetivo({ '[data-caja]': { dataset: { caja: '3' } } }) });
  assert.deepEqual(h.llamadas, []);
  // lo que hace la app (carta/app.js): «move to group» sobre su alta, con la persona y la caja
  const app = readFileSync(new URL('../carta/app.js', import.meta.url), 'utf8');
  assert.match(app, /async reclasificar\(persona, caja\) \{[\s\S]*?enviar\(estado\.eje, alta, 'move to group', valores/);
  const r = await A.transaccion(eje, 'move to group', { X: eje.alta('ana').id, whom: 'ana', zone: 5 }, 'casa', { t: '2026-11-08T10:09:00Z' });
  assert.equal(r.ok, true, JSON.stringify(r.motivos));
  await eje.anadir(r.evento);
  const tres = (await arbol({ foco: { X: alta, pv: 3 } }, eje, 'casa', GRANDE)).centro.rejilla;
  assert.deepEqual([3, 5].map((k) => tres.celdas.find((c) => c.caja === k).personas.map((p) => p.identidad)), [['huesped'], ['ana']]);
  // en Sequenced (el móvil en vertical), la fila abierta del 3 lleva las mismas cajas y personas que se arrastran
  const movil = html(await arbol({ foco: { X: alta, pv: 0 }, niveles: { 3: NIVEL.bloque } }, eje, 'casa', MOVIL));
  assert.match(movil, /class="rejilla rejilla-apilada[^"]*"[^>]*data-rejilla="3"[\s\S]*?data-persona="ana" data-caja="5"/);
  const css = readFileSync(new URL('../carta/estilo.css', import.meta.url), 'utf8');
  assert.match(css, /\.persona\{[^}]*touch-action:none/, 'mantener y arrastrar en el móvil: el navegador no se lleva el gesto');
});

// ---------- encargo «el4»: la celda de la matriz del 4 que se abre y arrastrar al centro (VG 12-11, #41, #49.8, #23) ----------

test('la matriz del 4 a pantalla completa: pulsar una celda la abre y enseña su lista de movimientos (hasta diez) con el color de su estación; pulsarla otra vez, ✕ o Esc la cierran', async () => {
  const { ejemploFabrica } = await import('../ejemplos/ikisai/compra-food.mjs');
  const { eje, compra, ...c } = await ejemploCompra();
  const f = await ejemploFabrica(eje, { compra, ...c });
  // doce anuncios más de T (hacer · T): la celda 4 · 4 con trece movimientos
  for (let k = 0; k < 12; k++) await eje.escribir({ autor: 'huesped', sobre: compra.id, en: '4100000000', t: '2026-11-07T17:' + String(k).padStart(2, '0') + ':00Z', movimientos: [minuto('huesped')], payload: [['T:hora'], [1], ['servir ' + k], [['huesped'], ['cocina']]] });
  const estado = { foco: { X: compra.id, pv: 4 } };
  const cerrada = (await arbol(estado, eje, 'huesped', GRANDE)).centro.rejilla;
  const llenas = cerrada.celdas.filter((x) => x.total);
  assert.ok(llenas.length && llenas.every((x) => x.abrir === `${x.fila}.${x.columna}`), 'cada celda con algo se puede abrir');
  assert.equal('abierta' in cerrada, false);
  const a = await arbol({ ...estado, celdaMatriz: { X: compra.id, celda: '4.4' } }, eje, 'huesped', GRANDE);
  const r = a.centro.rejilla;
  assert.deepEqual([r.abierta.fila, r.abierta.columna, r.abierta.oficio, r.abierta.ejecucion], [4, 4, 'hacer', 'T']);
  assert.equal(r.abierta.lista.length, 10, 'hasta diez');
  assert.equal(r.abierta.mas, 3);
  assert.deepEqual(r.abierta.lista[0].X, f.servir.id);
  assert.deepEqual(r.abierta.lista.map((o) => o.estado), ['autorizada', ...Array(9).fill('propuesta')], 'la estación de cada uno, del núcleo (acciones.estaciones)');
  const h = html(a);
  assert.match(h, /<section class="matriz-abierta" data-color="4" data-fila="4" data-columna="4" role="dialog" aria-label="hacer · T">/);
  assert.equal((h.match(/<ol class="ejecuciones abiertas">/g) ?? []).length, 1);
  const lista = h.slice(h.indexOf('<ol class="ejecuciones abiertas">'), h.indexOf('</ol>', h.indexOf('<ol class="ejecuciones abiertas">')));
  assert.equal((lista.match(/<li class="ejecucion" data-estado="propuesta"/g) ?? []).length, 9);
  assert.equal((lista.match(/<li class="ejecucion" data-estado="autorizada"/g) ?? []).length, 1);
  assert.ok(lista.includes('<li class="ejecucion-mas">+3 más</li>'));
  assert.match(h, /class="rejilla-celda hijo estacion abierta" data-color="4" data-pv="4" data-fila="4" data-columna="4" data-celda-matriz="4\.4"/);
  assert.match(h, /data-celda-matriz-cerrar/);
  // otra X: la celda abierta es de su registro, no se arrastra a otro
  assert.equal('abierta' in (await arbol({ ...estado, celdaMatriz: { X: f.pagar.id, celda: '4.4' } }, eje, 'huesped', GRANDE)).centro.rejilla, false);
  // los gestos: pulsar la celda (o algo dentro de ella) la abre; ✕ la cierra; dentro de la abierta, lo de dentro se abre como siempre
  const g = gestosDeMentira();
  const rejilla = { dataset: { rejilla: '4', huecoX: compra.id } };
  const celda = { dataset: { celdaMatriz: '4.4' }, closest: (sel) => (sel === '[data-rejilla]' ? rejilla : null) };
  g.disparar('click', { target: objetivo({ '[data-celda-matriz]': celda, '[data-abrir]': { dataset: { abrir: 'R1' } } }), preventDefault() {} });
  g.disparar('click', { target: objetivo({ '[data-celda-matriz-cerrar]': { closest: () => rejilla } }), preventDefault() {} });
  g.disparar('click', { target: objetivo({ '.matriz-abierta': {}, '[data-celda-matriz]': celda, '[data-abrir]': { dataset: { abrir: 'R1' } } }), preventDefault() {} });
  assert.deepEqual(g.llamadas, [['celdaMatriz', compra.id, '4.4'], ['celdaMatriz', compra.id, null], ['foco', 'R1', 0]]);
  // la app: abrir, volver a pulsar la misma cierra, Esc cierra antes de subir de nivel
  const app = readFileSync(new URL('../carta/app.js', import.meta.url), 'utf8');
  assert.match(app, /celdaMatriz\(X, celda\) \{\n    const misma = /);
  assert.match(app, /else if \(estado\.celdaMatriz\) estado\.celdaMatriz = null;/);
});

// ---------- ejecutar desde el 4 (VG 12-11, decisión 7 de #49): la celda, el formulario y el botón por rango ----------

/** Una cadena de n registros anidados desde X (cada uno anclado en el anterior) con los movimientos de `mov(k)`. */
async function cadenaDeEjecuciones(eje, X, n, { autor, en, mov, desde = 0 }) {
  let sobre = X;
  for (let k = 0; k < n; k++) sobre = (await eje.escribir({ autor, sobre, en, t: '2026-11-08T10:' + String(desde + k).padStart(2, '0') + ':00Z', movimientos: mov(k), payload: [['Paso ' + (k + 1)]] })).id;
}

test('ejecutar desde el 4 (VG 12-11, decisión 7): la celda abierta enseña la suma de sus transacciones y lo que se ejecuta desde ella; el formulario en modo ejecutar enseña lo exigido, la denominación propuesta (ajustable por escalas) y el botón, que cambia con el rango', async () => {
  const { ejemploFabrica } = await import('../ejemplos/ikisai/compra-food.mjs');
  const { eje, compra, ...c } = await ejemploCompra();
  await ejemploFabrica(eje, { compra, ...c });
  const foco = { X: compra.id, pv: 4 };
  // la celda abierta: su suma (contrato.valorDeCelda) y las plantillas de su oficio que escriben
  const a = await arbol({ foco, celdaMatriz: { X: compra.id, celda: '4.4' } }, eje, 'huesped', GRANDE);
  const ab = a.centro.rejilla.abierta;
  assert.deepEqual(ab.valor, C.valorDeCelda(eje, ab.lista.map((o) => o.X).filter(Boolean)));
  assert.ok(ab.valor.segundos > 0 && ab.valor.transacciones > 0, 'todas suman');
  assert.deepEqual(ab.ejecutar.map((x) => x.id), A.acciones(eje, compra.id, 4, 'huesped').filter((x) => !x.lectura && !x.camino).map((x) => x.id));
  assert.deepEqual([ab.boton.estado, ab.boton.peldano], ['apagado', 0]);
  const h = html(a);
  assert.match(h, new RegExp(`<p class="celda-valor" data-segundos="${ab.valor.segundos}"`));
  assert.match(h, /<div class="celda-ejecutar"><small>[^<]+<\/small><button type="button" data-nodo="control" class="ejecutar boton-apagado" data-boton="apagado" data-peldano="0" title="[^"]+" data-lanzar="[^"]+" data-ejecutar>/);
  // el formulario en modo ejecutar: lo exigido por partes, la denominación propuesta y el botón por rango
  const valores = { what: 'servir', when: '2026-12-01T10:00:00Z' };
  const conForm = (extra) => arbol({ foco, formulario: { X: compra.id, accion: 'declare future T', valores, ...extra } }, eje, 'huesped', GRANDE);
  const f = (await conForm({ ejecutar: true })).formulario;
  const e = A.ejecucion(eje, 'declare future T', { X: compra.id, ...valores }, 'huesped');
  assert.deepEqual([f.ejecucion.exigido, f.ejecucion.denominacion, f.ejecucion.escala, f.ejecucion.elegida, f.ejecucion.boton.estado], [e.exigido, e.propuesta.piezas, e.propuesta.desde, false, 'apagado']);
  const hf = html(await conForm({ ejecutar: true }));
  assert.match(hf, /<section class="ejecucion-t" aria-label="[^"]+"><h3>/);
  assert.match(hf, new RegExp(`<li data-parte="coste">[^<]*${e.posiciones} posiciones`));
  assert.match(hf, new RegExp(`<option value="${e.propuesta.desde}" selected>[^<]+ \\(propuesta\\)</option>`));
  assert.match(hf, /<select data-denominacion aria-label="[^"]+">/);
  assert.match(hf, /<footer><button type="submit" class="ejecutar boton-apagado" data-boton="apagado" data-peldano="0" title="[^"]+">ejecutar<\/button><\/footer>/);
  // ajustada a una escala mayor: una hora
  const fh = (await conForm({ ejecutar: true, escala: 'hora' })).formulario;
  assert.deepEqual([fh.ejecucion.denominacion, fh.ejecucion.elegida, fh.ejecucion.cubre], [[{ escala: 'hora', cantidad: 1 }], true, true]);
  assert.match(html(await conForm({ ejecutar: true, escala: 'hora' })), /<b class="piezas" data-piezas="[^"]+">1 h<\/b>/);
  // sin modo ejecutar (el aro: interactuar), el formulario de siempre
  const sin = html(await conForm({}));
  assert.ok(!sin.includes('ejecucion-t') && sin.includes('<footer><button type="submit">lanzar</button></footer>'));
  // el botón en tres rangos: marcado al llegar al 3 (3.1), efectos al subir (4.2), y en animado la capa de efectos
  await cadenaDeEjecuciones(eje, compra.id, 4, { autor: 'huesped', en: '2000000000', mov: () => [minuto('huesped'), { token: 'R', emisor: 'huesped', cantidad: 1, de: null, a: 'huesped' }] });
  const marcado = await conForm({ ejecutar: true });
  assert.equal(marcado.formulario.ejecucion.boton.estado, 'marcado');
  assert.match(html(marcado), /class="ejecutar boton-marcado" data-boton="marcado" data-peldano="3"/);
  await cadenaDeEjecuciones(eje, compra.id, 1, { autor: 'cocina', en: '6000000000', desde: 30, mov: () => [minuto('cocina'), { token: 'T', escala: 'futuro', cantidad: 1, de: 'cocina', a: null, refiere: '2026-12-02T10:00:00Z' }] });
  const efectos = await conForm({ ejecutar: true });
  assert.equal(efectos.formulario.ejecucion.boton.estado, 'efectos');
  assert.match(html(efectos), /class="ejecutar boton-efectos" data-boton="efectos" data-peldano="6" data-subida="3"/);
  assert.ok(!html(efectos).includes('capa-ejecutar'), 'en sobrio, solo la clase');
  assert.match(html({ ...efectos, formulario: { ...efectos.formulario, animado: true } }), /<button type="submit" class="ejecutar boton-efectos"[^>]*><span class="capa capa-efectos capa-ejecutar" aria-hidden="true"><\/span>ejecutar<\/button>/);
  const css = readFileSync(new URL('../carta/estilo.css', import.meta.url), 'utf8');
  for (const sel of ['button.ejecutar.boton-apagado,', 'button.ejecutar.boton-marcado,', 'button.ejecutar.boton-efectos,', 'button.ejecutar .capa-ejecutar{', '.ejecucion-t{', '.matriz-abierta .celda-valor{']) assert.ok(css.includes(sel), sel);
  // los gestos: lanzar desde la celda abre en modo ejecutar; el desplegable de la escala recalcula
  const g = gestosDeMentira();
  g.disparar('click', { target: objetivo({ '[data-lanzar]': { dataset: { x: compra.id, lanzar: 'deliver', ejecutar: '' } } }), preventDefault() {} });
  const form = {};
  g.disparar('change', { target: { matches: (sel) => sel === '[data-denominacion]', value: 'hora', form } });
  assert.deepEqual(g.llamadas, [['lanzar', compra.id, 'deliver', null, { ejecutar: true }], ['denominacion', 'hora', form]]);
  // la app: el modo ejecutar desde la celda o desde un paso del camino, y la denominación al enviar
  const app = readFileSync(new URL('../carta/app.js', import.meta.url), 'utf8');
  assert.match(app, /ejecutar: Boolean\(ejecutar\) \|\| \(paso !== null && paso !== undefined\)/);
  assert.match(app, /denominacion \? \{ denominacion \} : \{\}/);
  assert.match(app, /const delPaso = paso !== null && paso !== undefined \? ultimo\?\.camino\?\.pasos\?\.\[paso\]\?\.hacer : null;/, 'un paso del camino abre el formulario con sus parámetros');
});

test('gestos: arrastrar un elemento y soltarlo sobre el centro lo pone como foco (#23), solo en Mapped; en Sequenced, sobre el propio foco o sin llegar al centro, nada; el clic que sigue no cuenta', () => {
  mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 30_000_000 });
  try {
    const elemento = objetivo({ '[data-x]': { dataset: { x: 'R1' } } });
    const centroEn = (modo, x = 'F') => objetivo({ '[data-centro]': { dataset: { x, centro: '0' }, closest: (sel) => (sel === '.carta-matriz' && modo === 'mapped' ? {} : null) } });
    const arrastrar = (g, hasta, { dx = 200, dy = 120 } = {}) => {
      g.disparar('pointerdown', { pointerId: 1, clientX: 100, clientY: 100, button: 0, target: elemento });
      g.disparar('pointermove', { pointerId: 1, clientX: 100 + dx / 2, clientY: 100 + dy / 2, target: elemento });
      g.disparar('pointerup', { pointerId: 1, clientX: 100 + dx, clientY: 100 + dy, target: hasta });
      g.disparar('click', { target: hasta, preventDefault() {} });
    };
    const g = gestosDeMentira();
    arrastrar(g, centroEn('mapped'));
    assert.deepEqual(g.llamadas, [['foco', 'R1', 0]], 'soltado sobre el centro: foco; el clic de soltar no cuenta');
    mock.timers.tick(1000);
    const s = gestosDeMentira();
    arrastrar(s, centroEn('sequenced'));
    assert.equal(s.llamadas.some((l) => l[0] === 'foco' && l[1] === 'R1'), false, 'en Sequenced no');
    mock.timers.tick(1000);
    const mismo = gestosDeMentira();
    arrastrar(mismo, centroEn('mapped', 'R1'));
    assert.equal(mismo.llamadas.some((l) => l[0] === 'foco'), false, 'sobre sí mismo (ya es el foco), nada');
    mock.timers.tick(1000);
    const corto = gestosDeMentira();
    arrastrar(corto, centroEn('mapped'), { dx: 10, dy: 5 });
    assert.equal(corto.llamadas.filter((l) => l[0] === 'foco').length, 0, 'sin moverse lo bastante no es arrastrar');
    // el CSS marca el centro bajo lo arrastrado
    const css = readFileSync(new URL('../carta/estilo.css', import.meta.url), 'utf8');
    assert.ok(css.includes('.carta-matriz [data-centro].soltar-aqui{'));
  } finally {
    mock.timers.reset();
  }
});
