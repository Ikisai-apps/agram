// Pointed: una décupla a la vez. La décupla es el payload del registro en foco
// desarrollado en sus diez posiciones. Sobrio y animado son dos renders de la
// misma décupla; aquí solo existe el sobrio.

import { ARIDAD, esReferencia } from './btml.js';
import { EPOCA_0, epocaDe } from './epocas.js';
import { alcanceDe } from './modos.js';

/**
 * Décupla de un evento: diez posiciones { indice, significado, contenido }.
 * Lo no desarrollado queda sin contenido (undefined). Un terminal no tiene
 * posición 0 (MAPA §12: se retira la convención de la representación): un
 * payload terminal no se reparte en posiciones y va aparte, en `terminal`.
 * La época va por objeto o por nombre ('época 0', 'época 1 (propuesta)'),
 * como en leerDireccion. `alcance` da los tres números del modo (VG, 7-11
 * noche): lo conseguido en posiciones (una décupla = diez, como lectura()),
 * el mínimo (1) y el máximo (10).
 */
export function decupla(ev, epoca = EPOCA_0, profundidad = 0) {
  const e = epocaDe(epoca);
  const p = ev.payload;
  const posiciones = [];
  for (let i = 0; i < ARIDAD; i++) {
    posiciones.push({ indice: i, significado: e.reglaCorta(profundidad, i), contenido: Array.isArray(p) ? p[i] : undefined });
  }
  return { id: ev.id, autor: ev.autor, t: ev.t, sobre: ev.sobre, en: ev.en, terminal: Array.isArray(p) ? undefined : p, posiciones, alcance: alcanceDe(ARIDAD, 'pointed') };
}

function textoDe(contenido) {
  if (contenido === undefined) return '—';
  if (Array.isArray(contenido)) return '[' + contenido.length + ' posiciones]';
  if (esReferencia(contenido)) return '→ ' + contenido.ref.slice(0, 8) + (contenido.dir ? ':' + contenido.dir : '');
  return String(contenido);
}

/** Render sobrio: una línea por posición; si el payload es un terminal, va en su propia línea antes de las posiciones. */
export function sobrio(d) {
  const cab = d.id.slice(0, 8) + ' · ' + d.autor + ' · ' + d.t;
  const terminal = d.terminal === undefined ? [] : ['terminal ' + textoDe(d.terminal)];
  const lineas = d.posiciones.map((pos) => pos.indice + ' ' + pos.significado.padEnd(15) + ' ' + textoDe(pos.contenido));
  return [cab, ...terminal, ...lineas].join('\n');
}

export const RENDERS = Object.freeze({ sobrio });

/** Render por nombre. El animado aún no existe: se dice, no se simula. */
export function render(d, nombre = 'sobrio') {
  const r = RENDERS[nombre];
  if (!r) throw new Error('render no disponible: ' + nombre);
  return r(d);
}
