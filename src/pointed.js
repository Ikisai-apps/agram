// Pointed: una décupla a la vez. La décupla es el payload del registro en foco
// desarrollado en sus diez posiciones. Sobrio y animado son dos renders de la
// misma décupla; aquí solo existe el sobrio.

import { ARIDAD, esReferencia } from './btml.js';
import { EPOCA_0, epocaDe } from './epocas.js';

/**
 * Décupla de un evento: diez posiciones { indice, significado, contenido }.
 * Un payload terminal ocupa la posición 0 (representación); el resto no está
 * desarrollado (contenido undefined). La época va por objeto o por nombre
 * ('época 0', 'época 1 (propuesta)'), como en leerDireccion.
 */
export function decupla(ev, epoca = EPOCA_0, profundidad = 0) {
  const e = epocaDe(epoca);
  const p = ev.payload;
  const posiciones = [];
  for (let i = 0; i < ARIDAD; i++) {
    let contenido;
    if (Array.isArray(p)) contenido = p[i];
    else if (i === 0) contenido = p;
    posiciones.push({ indice: i, significado: e.reglaCorta(profundidad, i), contenido });
  }
  return { id: ev.id, autor: ev.autor, t: ev.t, sobre: ev.sobre, en: ev.en, posiciones };
}

function textoDe(contenido) {
  if (contenido === undefined) return '—';
  if (Array.isArray(contenido)) return '[' + contenido.length + ' posiciones]';
  if (esReferencia(contenido)) return '→ ' + contenido.ref.slice(0, 8) + (contenido.dir ? ':' + contenido.dir : '');
  return String(contenido);
}

/** Render sobrio: una línea por posición. */
export function sobrio(d) {
  const cab = d.id.slice(0, 8) + ' · ' + d.autor + ' · ' + d.t;
  const lineas = d.posiciones.map((pos) => pos.indice + ' ' + pos.significado.padEnd(15) + ' ' + textoDe(pos.contenido));
  return [cab, ...lineas].join('\n');
}

export const RENDERS = Object.freeze({ sobrio });

/** Render por nombre. El animado aún no existe: se dice, no se simula. */
export function render(d, nombre = 'sobrio') {
  const r = RENDERS[nombre];
  if (!r) throw new Error('render no disponible: ' + nombre);
  return r(d);
}
