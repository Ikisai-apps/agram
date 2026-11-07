// Pointed: una décupla a la vez. La décupla es el payload del registro en foco
// desarrollado en sus diez posiciones. Sobrio y animado son dos renders de la
// misma décupla; aquí solo existe el sobrio.

import { ARIDAD, esReferencia, esLista } from './btml.js';
import { EPOCA_0, epocaDe, nombreEnNodo } from './epocas.js';
import { alcanceDe } from './modos.js';

/**
 * Décupla de un evento: diez posiciones { indice, significado, contenido }.
 * Una décupla (la raíz, o bajo una posición un array con algún array) lleva
 * en cada índice la regla corta de la profundidad. Por hojas (VG, 7-11
 * noche): bajo una posición (profundidad ≥ 1), un array solo de hojas es una
 * lista y se pinta como lista: sus elementos llevan `ocupante` (su lugar por
 * llegada) y significado 'ocupante k', y `lista` trae los elementos enteros
 * (pueden ser más de diez). Lo no desarrollado queda sin contenido
 * (undefined). Un terminal no tiene
 * posición 0 (MAPA §12: se retira la convención de la representación): un
 * payload terminal no se reparte en posiciones y va aparte, en `terminal`.
 * La época va por objeto o por nombre ('época 0'), como en
 * leerDireccion. `alcance` da los tres números del modo (VG, 7-11 noche):
 * lo conseguido en posiciones (una décupla = diez, como lectura()), el
 * mínimo (1) y el máximo (10).
 */
export function decupla(ev, epoca = EPOCA_0, profundidad = 0) {
  const e = epocaDe(epoca);
  const p = ev.payload;
  const posiciones = [];
  for (let i = 0; i < ARIDAD; i++) {
    // Un array es la décupla (regla corta por profundidad); una lista explícita, sus ocupantes por llegada (VG, 7-11 noche).
    posiciones.push({ indice: i, ...nombreEnNodo(p, profundidad, i, e), contenido: Array.isArray(p) ? p[i] : undefined });
  }
  const lista = profundidad > 0 && esLista(p) ? p : undefined;
  return { id: ev.id, autor: ev.autor, t: ev.t, sobre: ev.sobre, en: ev.en, terminal: Array.isArray(p) ? undefined : p, ...(lista ? { lista } : {}), posiciones, alcance: alcanceDe(ARIDAD, 'pointed') };
}

function textoDe(contenido) {
  if (contenido === undefined) return '—';
  // Bajo la raíz, un array solo de hojas es una lista (por hojas); con algún array, una décupla.
  if (esLista(contenido)) return 'lista de ' + contenido.length + ': ' + contenido.map(textoDe).join(' · ');
  if (Array.isArray(contenido)) return '[' + contenido.length + ' posiciones]';
  if (esReferencia(contenido)) return '→ ' + contenido.ref.slice(0, 8) + (contenido.dir ? ':' + contenido.dir : '');
  return String(contenido);
}

/**
 * Render sobrio: una línea por posición; si el payload es un terminal, va en
 * su propia línea antes de las posiciones; si es una lista, una línea que lo
 * dice y, si pasa de diez, los ocupantes que no caben en las diez líneas.
 */
export function sobrio(d) {
  const cab = d.id.slice(0, 8) + ' · ' + d.autor + ' · ' + d.t;
  const terminal = d.terminal === undefined ? [] : ['terminal ' + textoDe(d.terminal)];
  if (d.lista) terminal.push('lista de ' + d.lista.length + ' ocupantes, por llegada' + (d.lista.length > ARIDAD ? ' (y ' + d.lista.slice(ARIDAD).map(textoDe).join(' · ') + ')' : ''));
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
