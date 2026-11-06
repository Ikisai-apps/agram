// Modos de representación y su capacidad. Las cantidades son capacidad
// representativa, no cifras obligatorias. La unidad de cuenta es la posición.
// Proporción de escritura sobre lectura (VG, 6-11-2026): Pointed un décimo;
// Sequenced entre un quinto y un décimo; Mapped entre un cuarto y un tercio.

import { ARIDAD, esTerminal } from './btml.js';

export const MODOS = Object.freeze({
  pointed: Object.freeze({ decuplas: 1, proporcion: [1 / 10, 1 / 10] }),
  sequenced: Object.freeze({ decuplas: 10, proporcion: [1 / 10, 1 / 5] }),
  mapped: Object.freeze({ decuplas: 100, proporcion: [1 / 4, 1 / 3] }),
  scened: Object.freeze({ decuplas: 1000, proporcion: null }), // sin fijar
});

/** Posiciones que un modo lee de una vez. */
export function lectura(modo) {
  return MODOS[modo].decuplas * ARIDAD;
}

/** Posiciones que un modo escribe de una vez: [mínimo, máximo]. */
export function escritura(modo) {
  const m = MODOS[modo];
  if (!m.proporcion) return null;
  const l = lectura(modo);
  return [Math.floor(l * m.proporcion[0]), Math.floor(l * m.proporcion[1])];
}

/** Posiciones desarrolladas de un payload: cada terminal cuenta una. */
export function contarPosiciones(payload) {
  if (esTerminal(payload)) return 1;
  if (Array.isArray(payload)) return payload.reduce((n, h) => n + contarPosiciones(h), 0);
  return 0;
}

/** Si un payload cabe como registro de salida de un modo. */
export function cabeEscritura(payload, modo) {
  const e = escritura(modo);
  return e === null ? true : contarPosiciones(payload) <= e[1];
}
