// Mapped en el ordenador (VG, 10-11, tanda 3): sin scroll nunca; los pasos de tamaño de cada PV son datos de la época
// (epoch.8.6); los puntitos del foco suben un paso a todos y el clic sobre un PV solo a ese; un PV a pantalla completa
// con flechas a sus vecinos y «volver»; los rosetones cada uno en su esquina o lateral; el interruptor sobrio/animado
// escribe la preferencia; el formulario enseña lo obligatorio y lo demás tras «más»; el criterio por defecto, traducido.

import { test } from 'node:test';
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

const T1 = '2026-11-08T10:00:00Z';
const ORDENADOR = { ancho: 1200, alto: 800 };
const GRANDE = { ancho: 1920, alto: 1080 };
const MOVIL = { ancho: 400, alto: 700 };
const minuto = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });
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

test('el interruptor sobrio/animado de la barra es la preferencia de dos valores: tocarlo escribe «render» como la configuración y el árbol pasa a animado', async () => {
  const { eje, compra } = await ejemploCompra();
  const a = await arbol({ foco: { X: compra.id, pv: 0 } }, eje, 'huesped', ORDENADOR);
  assert.equal(a.interruptores.length, 1);
  const i = a.interruptores[0];
  const conf = C.configuracion(eje, 'huesped');
  assert.equal(i.valor, conf[i.clave]);
  assert.deepEqual(i.opciones.map((o) => o.valor), C.clavesDeConfiguracion().find((c) => c.clave === i.clave).valores);
  const h = html(a);
  assert.match(h, new RegExp(`<span class="interruptor"[^>]*>.*data-preferencia="${i.clave}" data-valor="${i.opciones[1].valor}" aria-pressed="false"`));
  // Tocar la otra palabra: la app escribe la candidata de preferencias() con esa clave (como guarda la configuración).
  const otra = i.opciones.find((o) => o.valor !== i.valor).valor;
  const p = preferencias(eje, 'huesped', { [i.clave]: otra });
  await eje.escribir({ autor: 'huesped', sobre: p.sobre, en: p.en, t: T1, movimientos: [minuto('huesped')], payload: p.payload });
  assert.equal(C.configuracion(eje, 'huesped')[i.clave], otra);
  const b = await arbol({ foco: { X: compra.id, pv: 0 } }, eje, 'huesped', ORDENADOR);
  assert.equal(b.animado, true);
  assert.equal(b.interruptores[0].valor, otra);
  // En español, las dos palabras traducidas.
  const q = preferencias(eje, 'huesped', { language: 'es' });
  await eje.escribir({ autor: 'huesped', sobre: q.sobre, en: q.en, t: T1, movimientos: [minuto('huesped')], payload: q.payload });
  const c = await arbol({ foco: { X: compra.id, pv: 0 } }, eje, 'huesped', ORDENADOR);
  assert.deepEqual(c.interruptores[0].opciones.map((o) => o.texto), ['sobrio', 'animado']);
  // La app lo pinta y lo lanza por data-preferencia (la tecla la toca gestos.js; la escritura, app.js como la configuración).
  const app = readFileSync(new URL('../carta/app.js', import.meta.url), 'utf8');
  assert.match(app, /async preferencia\(clave, valor\)[\s\S]*?escribirPreferencias\(\{ \[clave\]: valor \}\)/);
});

test('#4: en la configuración, «modelo» es un desplegable con los modelos de la época que tienen recursos (sin el sobrio), ikisai preseleccionado; con uno solo, no se pregunta', async () => {
  const { eje } = await ejemploCompra();
  const conRecursos = modelos.modelosDeLaEpoca().filter(modelos.conRecursos).map((m) => m.nombre);
  assert.deepEqual([...conRecursos].sort(), ['animado-generico', 'ikisai'], 'hoy, dos paquetes de arte');
  const p = preferencias(eje, 'huesped');
  const campo = p.campos.find((c) => c.clave === 'model');
  assert.deepEqual(campo.opciones.map((o) => o.valor), ['ikisai', 'animado-generico'], 'las opciones salen de los datos, en el orden de la cadena; el sobrio no está');
  assert.equal(campo.valor, 'ikisai', 'sin preferencia, ikisai');
  const h = html(await arbol({ foco: { X: eje.alta('huesped').id, pv: 0 } }, eje, 'huesped', ORDENADOR), { preferencias: p });
  assert.match(h, /<select id="pref-\d+" name="model"[^>]*><option value="ikisai" selected>ikisai<\/option><option value="animado-generico">animado-generico<\/option><\/select>/);
  assert.doesNotMatch(h, /<input[^>]*name="model"/);
  // La cuenta de VG: con «sobrio» guardado, el desplegable propone ikisai (el sobrio no se elige) y al guardar queda ikisai.
  const q = preferencias(eje, 'huesped', { model: 'sobrio' });
  assert.equal(q.campos.find((c) => c.clave === 'model').valor, 'ikisai');
  assert.ok(q.payload.some((x) => Array.isArray(x) && x[0] === 'ikisai'));
  // Elegir el genérico lo guarda.
  const g = preferencias(eje, 'huesped', { model: 'animado-generico' });
  assert.equal(g.campos.find((c) => c.clave === 'model').valor, 'animado-generico');
  // Una época con un solo paquete de arte (sin el genérico): el campo no se enseña y se guarda el que hay.
  const una = epocaCon((e) => { e[9][7].splice(1, 1); });
  assert.deepEqual(modelos.eleccionDeModelo({ epoca: una }).modelos.map((m) => m.nombre), ['ikisai']);
  const u = preferencias(eje, 'huesped', { model: 'sobrio' }, { epoca: una });
  assert.equal(u.campos.find((c) => c.clave === 'model'), undefined, 'con uno solo, no se pregunta');
  assert.ok(u.payload.some((x) => Array.isArray(x) && x[0] === 'ikisai'), 'y se guarda el que hay');
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
  assert.deepEqual([cuatro.medida.nombre, cuatro.medida.k, cuatro.medida.de, cuatro.medida.propio], ['ciclo', 4, 4, true]);
  const uno = a.laterales.find((n) => n.pv === 1);
  assert.deepEqual([uno.medida.nombre, uno.medida.propio], ['madurez', false]);
  const h = html(a);
  assert.match(h, /<section class="pv pv-4 [^>]*><header class="pv-cabeza"><span class="numero">4<\/span><span class="etiqueta">[^<]*<\/span><span class="medida"[^>]*>ciclo 4<small>\/4<\/small>/);
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
  // un sitio sin acciones se pinta apagado y sin botón (en la compra, el 3 no ofrece nada a la huésped)
  const c = await arbol({ foco: { X: compra.id, pv: 0 }, aro: { X: compra.id, pv: null } }, eje, 'huesped', GRANDE);
  const tres = c.aro.huecos.find((g) => g.pv === 3);
  assert.equal(tres.accion, null);
  assert.match(html(c), /<li class="hueco hueco-3[^"]* apagado"/);
  assert.match(html(c), /<span class="accion vacia"/);
  assert.doesNotMatch(html(c).match(/<li class="hueco hueco-3[^]*?<\/li>/)[0], /data-lanzar/);
});

test('la cadena de la época empieza por ikisai y el modelo por defecto la devuelve en ese orden (el interruptor «animado» enseña el arte sin tocar Configuración)', async () => {
  const { eje } = await ejemploCompra();
  assert.deepEqual(modelos.cabecera().cadena, ['ikisai', 'animado-generico', 'sobrio']);
  assert.deepEqual(modelos.modelo(eje, 'huesped').map((m) => m.nombre), ['ikisai', 'animado-generico', 'sobrio']);
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

test('gestos: clic derecho sobre un sitio del aro despliega sus alternativas; con el aro abierto, las teclas 1-4 y 6-9 son del aro y Esc cierra', () => {
  const g = gestosDeMentira({ aroAbierto: true });
  const sitio = { dataset: { pv: '7' }, closest: () => ({ dataset: { x: 'X1' } }) };
  g.disparar('contextmenu', { target: objetivo({ '.aro .hueco': sitio }), preventDefault() {} });
  assert.deepEqual(g.llamadas[0], ['aro', 'X1', 7, { desplegar: true }]);
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

test('el móvil apaisado, en CSS y en app.js: las medidas las manda app.js por el tamaño de la ventana; la barra de una fila y los rosetones de 32 px son solo CSS por alto y orientación', () => {
  const app = readFileSync(new URL('../carta/app.js', import.meta.url), 'utf8');
  assert.match(app, /medidasDePantalla\(window\.innerWidth, window\.innerHeight - barra\)/);
  const css = readFileSync(new URL('../carta/estilo.css', import.meta.url), 'utf8');
  const bloque = css.slice(css.indexOf('@media (orientation:landscape) and (max-height:500px){'));
  assert.ok(bloque.length > 200, 'hay un bloque CSS para el móvil apaisado');
  assert.match(bloque, /\.barra,\.carta-matriz \.barra\{flex-wrap:nowrap/, 'la barra en una sola fila');
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
