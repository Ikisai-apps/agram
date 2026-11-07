// Mapped: la matriz 3×3 de puntos de vista sobre el foco.
//   1 8 2
//   6 5 7   (0 es la lente sobre el 5: el centro)
//   3 9 4
// Lectura segura, de la cruz a la X: el eje 6·5·7 es el hilo (pasado a la
// izquierda, foco en el centro, lo escrito después a la derecha); 8 es la
// lectura del 8 (ocho(): la base escrita en el 8 que resume la cohorte del
// foco, o el respaldo al vuelo declarado «sin base escrita»); 9 el camino
// recorrido; las esquinas 1–4 son la capa donde va la mano.

import { ARIDAD, esReferencia, direccion } from './btml.js';
import { EPOCA_0, epocaDe, nombreEnNodo } from './epocas.js';
import { MODOS, alcanceDe } from './modos.js';
import { MEDIDAS, situar } from './bases.js';

export const MATRIZ = Object.freeze([
  [1, 8, 2],
  [6, 5, 7],
  [3, 9, 4],
]);

function payloadEn(ev, camino) {
  let p = ev.payload;
  for (const i of camino) p = Array.isArray(p) ? p[i] : undefined;
  return p;
}

/**
 * Mapa del foco: una celda por PV con su contenido en la profundidad del
 * camino y cuántos registros se han escrito en esa posición; el eje (hilo
 * hacia atrás y escritos sobre el foco); y unos recuentos del foco para la vista (no son la medida del 8: esa es bases.medir, y la celda 8 la lee ocho()). La época va
 * por objeto o por nombre, como en leerDireccion. `alcance` da los tres
 * números del modo (VG, 7-11 noche): lo conseguido en posiciones (cada
 * registro traído, el foco, su hilo y sus hijos, es una décupla y cuenta
 * diez, como lectura()), el mínimo (100) y el máximo (1000).
 */
export function mapa(eje, id, { camino = [], epoca = EPOCA_0, maximo = MODOS.sequenced.decuplas } = {}) {
  const ev = eje.obtener(id);
  if (!ev) throw new Error('foco desconocido: ' + id);
  const e = epocaDe(epoca);
  const p = payloadEn(ev, camino);
  const celdas = [];
  for (let i = 0; i < ARIDAD; i++) {
    celdas.push({
      indice: i,
      // Bajo una posición, un array es la lista de sus ocupantes por llegada, sin PV (VG, 7-11 noche):
      // 'ocupante k' y `ocupante`; lo que no ocupa, subposiciones por dirección con su regla corta.
      ...nombreEnNodo(p, camino.length, i, e),
      contenido: Array.isArray(p) ? p[i] : undefined, // un terminal no tiene posición 0: va aparte, en `terminal`
      escritos: eje.sobre(id, direccion([...camino, i])).length,
    });
  }
  const hilo = eje.hilo(id).slice(1, maximo + 1); // sin el propio foco
  const hijos = eje.sobre(id).slice(0, maximo);
  const identidades = new Set();
  for (const m of ev.movimientos) {
    if (m.de) identidades.add(m.de);
    if (m.a) identidades.add(m.a);
  }
  const medidas = {
    profundidadHilo: eje.hilo(id).length - 1,
    escritos: eje.sobre(id).length,
    movimientos: ev.movimientos.length,
    identidades: identidades.size,
    posicionesDesarrolladas: celdas.filter((c) => c.contenido !== undefined).length,
  };
  const terminal = Array.isArray(p) ? undefined : p;
  const traidos = new Set([id, ...hilo.map((e) => e.id), ...hijos.map((e) => e.id)]);
  const alcance = alcanceDe(traidos.size * ARIDAD, 'mapped');
  return { foco: id, autor: ev.autor, t: ev.t, sobre: ev.sobre, en: ev.en, camino: [...camino], terminal, celdas, hilo, hijos, medidas, alcance };
}

/**
 * Lo que lee la celda 8 de Mapped (VG, 7-11 noche: una sola verdad del 8, la
 * escrita): la base escrita en el 8 que resume la cohorte del foco
 * (bases.situar; por defecto los hermanos, el 8 del padre) o, si no la hay,
 * el respaldo al vuelo declarado (bases.confluir), con frescura «sin base
 * escrita». Sin puesto ni puntuación: por medida, el valor del foco, su caja
 * y cuántos quedan debajo, en ella y encima. Aparte de mapa(): mapa() se
 * pide por cada registro de una escena y esto lee el 8.
 * Devuelve { alcance, foco, estado, motivo?, escrita, base (id o null),
 * registro, n, frescura, medidas: [{ clave, etiqueta, foco, caja, debajo,
 * enCaja, encima }] }.
 */
export function ocho(eje, foco, { alcance = 'hermanos', epoca = EPOCA_0 } = {}) {
  const s = situar(eje, foco, { alcance, epoca: epocaDe(epoca), respaldo: true });
  if (s.estado !== 'RESUELTO') {
    return { alcance, foco, estado: s.estado, motivo: s.motivo, escrita: false, base: null, registro: s.registro, n: 0, frescura: null, medidas: [] };
  }
  const medidas = MEDIDAS.map(({ clave, etiqueta }) => {
    const x = s.medidas[clave];
    return { clave, etiqueta, foco: x.foco, caja: x.caja, debajo: x.debajo, enCaja: x.enCaja, encima: x.encima };
  });
  return { alcance, foco, estado: 'RESUELTO', escrita: s.escrita, base: s.escrita ? s.base : null, registro: s.registro, n: s.n, frescura: s.frescura, medidas };
}

/** Texto de la celda 8 (render sobrio): de dónde se lee, su frescura y, por medida, la caja del foco. */
export function textoOcho(o) {
  if (o.estado !== 'RESUELTO') return '8 · ' + o.alcance + ' · ' + o.motivo;
  const frescura = o.escrita ? (o.frescura.sinNovedades ? 'sin novedades' : 'con novedades') : o.frescura;
  const donde = o.escrita ? 'base ' + o.base.slice(0, 8) + ' (' + frescura + ')' : frescura + ' (respaldo al vuelo)';
  const filas = o.medidas.map((m) => m.clave + ' ' + m.foco + ': caja ' + m.caja + ' · ' + m.debajo + ' debajo · ' + m.enCaja + ' en su caja · ' + m.encima + ' encima');
  return ['8 · ' + o.alcance + ' · ' + donde + ' · n ' + o.n, ...filas].join('\n');
}

function breve(c) {
  if (c === undefined) return '—';
  if (Array.isArray(c)) return '[' + c.length + ']';
  if (esReferencia(c)) return '→' + c.ref.slice(0, 8);
  return String(c);
}

/** Render sobrio: tres filas de tres celdas, luego el eje y las medidas. */
export function sobrio(m) {
  const celda = (i) => {
    const c = m.celdas[i];
    const texto = i === 5 ? m.foco.slice(0, 8) + (m.terminal === undefined ? '' : ' ' + breve(m.terminal)) : breve(c.contenido);
    return (i + ' ' + c.significado).padEnd(17) + texto.padEnd(14) + (c.escritos ? '↳' + c.escritos : '').padEnd(4);
  };
  const filas = MATRIZ.map((fila) => fila.map(celda).join(' | '));
  const eje = 'eje: ' + [...m.hilo].reverse().map((e) => e.id.slice(0, 8)).join(' ← ') + ' ← [' + m.foco.slice(0, 8) + '] → ' + m.hijos.map((e) => e.id.slice(0, 8)).join(' · ');
  const med = 'medidas: hilo ' + m.medidas.profundidadHilo + ' · escritos ' + m.medidas.escritos + ' · movimientos ' + m.medidas.movimientos + ' · identidades ' + m.medidas.identidades + ' · posiciones ' + m.medidas.posicionesDesarrolladas;
  return [...filas, eje, med].join('\n');
}

export const RENDERS = Object.freeze({ sobrio });

export function render(m, nombre = 'sobrio') {
  const r = RENDERS[nombre];
  if (!r) throw new Error('render no disponible: ' + nombre);
  return r(m);
}
