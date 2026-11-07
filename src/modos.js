// Modos de representación y su capacidad. Las cantidades son capacidad
// representativa, no cifras obligatorias. La unidad de cuenta es la posición.
// Proporción de escritura sobre lectura (VG, 6-11-2026): Pointed un décimo;
// Sequenced entre un quinto y un décimo; Mapped entre un cuarto y un tercio.
// Es el estándar: informa, no rechaza.
// Topes duros de posiciones emitidas (VG, 7-11-2026): Pointed 10, Sequenced
// 100, Mapped 1000 (la matriz 10×10×10 de la fábrica), Scened 10000. Son lo
// único que rechaza una escritura. Scened no tiene render todavía.

import { ARIDAD, esTerminal } from './btml.js';

export const MODOS = Object.freeze({
  pointed: Object.freeze({ nombre: 'Pointed', decuplas: 1, proporcion: [1 / 10, 1 / 10], tope: 10 }),
  sequenced: Object.freeze({ nombre: 'Sequenced', decuplas: 10, proporcion: [1 / 10, 1 / 5], tope: 100 }),
  mapped: Object.freeze({ nombre: 'Mapped', decuplas: 100, proporcion: [1 / 4, 1 / 3], tope: 1000 }),
  scened: Object.freeze({ nombre: 'Scened', decuplas: 1000, proporcion: null, tope: 10000 }), // proporción sin fijar; sin render
});

function modoDe(modo) {
  const m = Object.hasOwn(MODOS, modo) ? MODOS[modo] : undefined;
  if (!m) throw new Error('modo desconocido: ' + modo);
  return m;
}

/** Nombre del modo para leer: «Pointed», «Sequenced», «Mapped», «Scened». */
export function nombreModo(modo) {
  return modoDe(modo).nombre;
}

/** Posiciones que un modo lee de una vez. */
export function lectura(modo) {
  return modoDe(modo).decuplas * ARIDAD;
}

/** Posiciones que un modo escribe de una vez según la proporción: [mínimo, máximo], o null si no está fijada. */
export function escritura(modo) {
  const m = modoDe(modo);
  if (!m.proporcion) return null;
  const l = lectura(modo);
  return [Math.floor(l * m.proporcion[0]), Math.floor(l * m.proporcion[1])];
}

/** Tope duro: cuántas posiciones puede emitir el modo de una vez. */
export function tope(modo) {
  return modoDe(modo).tope;
}

/** Posiciones desarrolladas de un payload: cada terminal cuenta una. */
export function contarPosiciones(payload) {
  if (esTerminal(payload)) return 1;
  if (Array.isArray(payload)) return payload.reduce((n, h) => n + contarPosiciones(h), 0);
  return 0;
}

/** Si un payload cabe en el tope duro del modo. */
export function cabeTope(payload, modo) {
  return contarPosiciones(payload) <= tope(modo);
}

/** Si un payload cabe en el máximo de la proporción del modo (el estándar; ya no rechaza). */
export function cabeEscritura(payload, modo) {
  const e = escritura(modo);
  return e === null ? true : contarPosiciones(payload) <= e[1];
}

/**
 * Dónde queda un payload respecto de la proporción del modo:
 * { posiciones, rango: [mín, máx] | null, estado: 'por debajo' | 'dentro' | 'por encima' | 'sin fijar' }.
 */
export function proporcion(payload, modo) {
  const posiciones = contarPosiciones(payload);
  const rango = escritura(modo);
  if (!rango) return { posiciones, rango: null, estado: 'sin fijar' };
  const estado = posiciones < rango[0] ? 'por debajo' : posiciones > rango[1] ? 'por encima' : 'dentro';
  return { posiciones, rango, estado };
}
