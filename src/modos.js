// Modos de representación: cuántos datos representa cada uno y cuántos
// emite. La unidad de cuenta es la posición (una décupla = diez).
//
// Mínimo y máximo por modo (VG, 7-11 noche): «A él le llegan los datos
// empezando por un único dato. En Pointed hablábamos de 10, en Sequenced de
// 100, en Mapped de 1000, en Scened de 10.000 y en Be, como que dice todos,
// porque no tiene interfaz gráfica como tal. Ese es el máximo de datos que
// se pueden representar. Después tenemos la cantidad de información mínima
// que cada interfaz quiere intentar representar. […] Pointed 1, Sequenced
// 10, Mapped 100, Scened 1000. Ahí tendremos tres números: el que consigue
// (que a lo mejor es menor), el mínimo y el máximo. Y eso corresponde con
// los que emite […], porque todo lo que no se pueda representar realmente
// no se puede alterar y por lo tanto no tiene sentido emitirlo.»
// Así que:
// - el máximo es duro, y es el mismo para representar (leer) y para emitir:
//   Pointed 10, Sequenced 100, Mapped 1000 (la matriz 10×10×10 de la
//   fábrica), Scened 10000, Be todos (Infinity). `lectura` y `tope` son ya
//   la misma cifra que `maximo`;
// - el mínimo es lo que el modo intenta representar (y emitir): Pointed 1,
//   Sequenced 10, Mapped 100, Scened 1000. No llegar no es error: es
//   información (`alcance`). El de Be no está fijado ([X] decidir VG);
// - cada lectura y cada emisión dicen los tres números con alcanceDe:
//   { conseguido, minimo, maximo, alMinimo }.
// Proporción de escritura sobre lectura (VG, 6-11-2026): Pointed un décimo;
// Sequenced entre un quinto y un décimo; Mapped entre un cuarto y un tercio;
// Scened y Be sin fijar. Scened tiene render sobrio y no tiene formulario
// de escritura; Be no tiene interfaz gráfica.
// La escritura (src/escritura.js) comprueba, en este orden: el máximo de la
// proporción sobre las posiciones del registro (lo heredado incluido), que
// rechaza como antes del 7-11 y con el mismo mensaje, y el máximo del modo
// sobre lo EMITIDO (lo heredado por referencia no se emite); el mínimo del
// modo solo se informa. [X] decidir VG si la proporción rechaza o solo
// informa: el mapa no lo decide, y con las dos rechazando la proporción (1,
// 20, 333) se alcanza antes que el máximo, así que la matriz de 1000 no
// cabe en Mapped y el máximo solo decide en Scened. Estas funciones cuentan
// igual: `cabeTope` descuenta las heredadas que se le digan; `cabeEscritura`,
// `proporcion` y `proporcionDe` cuentan todas las posiciones del registro.

import { ARIDAD, esTerminal } from './btml.js';

export const MODOS = Object.freeze({
  pointed: Object.freeze({ nombre: 'Pointed', decuplas: 1, proporcion: [1 / 10, 1 / 10], minimo: 1, maximo: 10 }),
  sequenced: Object.freeze({ nombre: 'Sequenced', decuplas: 10, proporcion: [1 / 10, 1 / 5], minimo: 10, maximo: 100 }),
  mapped: Object.freeze({ nombre: 'Mapped', decuplas: 100, proporcion: [1 / 4, 1 / 3], minimo: 100, maximo: 1000 }),
  scened: Object.freeze({ nombre: 'Scened', decuplas: 1000, proporcion: null, minimo: 1000, maximo: 10000 }), // proporción sin fijar; sin formulario de escritura
  // Be: sin interfaz gráfica; representa «todos» (VG, 7-11 noche). Mínimo y
  // proporción sin fijar: null ([X] decidir VG). No tiene décuplas propias.
  be: Object.freeze({ nombre: 'Be', decuplas: null, proporcion: null, minimo: null, maximo: Infinity }),
});

function modoDe(modo) {
  const m = Object.hasOwn(MODOS, modo) ? MODOS[modo] : undefined;
  if (!m) throw new Error('modo desconocido: ' + modo);
  return m;
}

/** Nombre del modo para leer: «Pointed», «Sequenced», «Mapped», «Scened», «Be». */
export function nombreModo(modo) {
  return modoDe(modo).nombre;
}

/** Máximo duro del modo en posiciones: lo más que representa y lo más que emite de una vez (VG, 7-11 noche). Be: Infinity («todos»). */
export function maximo(modo) {
  return modoDe(modo).maximo;
}

/** Mínimo del modo en posiciones: lo que intenta representar y emitir; no llegar se informa, no se rechaza. Be: null (sin fijar, [X] decidir VG). */
export function minimo(modo) {
  return modoDe(modo).minimo;
}

/**
 * Los tres números de una lectura o una emisión: lo conseguido (en
 * posiciones), el mínimo y el máximo del modo, y si llega al mínimo (null si
 * el mínimo no está fijado). No corta ni rechaza nada: solo lo dice.
 */
export function alcanceDe(conseguido, modo) {
  if (!(Number.isInteger(conseguido) && conseguido >= 0)) throw new Error('conseguido inválido: ' + conseguido + ' (un entero ≥ 0)');
  const min = minimo(modo);
  return { conseguido, minimo: min, maximo: maximo(modo), alMinimo: min === null ? null : conseguido >= min };
}

/** Posiciones que un modo lee de una vez. Alias de maximo: representar y emitir comparten el máximo (VG, 7-11 noche). */
export function lectura(modo) {
  return maximo(modo);
}

/** Posiciones que un modo escribe de una vez según la proporción: [mínimo, máximo], o null si no está fijada (Scened, Be). */
export function escritura(modo) {
  const m = modoDe(modo);
  if (!m.proporcion) return null;
  const l = lectura(modo);
  return [Math.floor(l * m.proporcion[0]), Math.floor(l * m.proporcion[1])];
}

/** Tope duro de emisión. Alias de maximo: lo que no se puede representar no se puede alterar, y no se emite (VG, 7-11 noche). */
export function tope(modo) {
  return maximo(modo);
}

/** Posiciones desarrolladas de un payload: cada terminal cuenta una. */
export function contarPosiciones(payload) {
  if (esTerminal(payload)) return 1;
  if (Array.isArray(payload)) return payload.reduce((n, h) => n + contarPosiciones(h), 0);
  return 0;
}

/**
 * Si un payload cabe en el máximo (tope duro) del modo. Cuenta lo EMITIDO:
 * las `heredadas` (la lista de desdeMapped: una posición de relleno por
 * entrada, que no se emite) se descuentan. Sin ellas, todo cuenta como
 * emitido, como en escribirDesde sin heredadas. No comprueba que sean
 * referencias al foco: eso lo hace la escritura.
 */
export function cabeTope(payload, modo, heredadas = []) {
  if (!Array.isArray(heredadas)) throw new Error('heredadas es una lista');
  return contarPosiciones(payload) - heredadas.length <= tope(modo);
}

/**
 * Si un payload cabe en el máximo de la proporción del modo. Cuenta todas
 * las posiciones, lo heredado incluido, como antes del 7-11 (rechaza: [X]
 * decidir VG).
 */
export function cabeEscritura(payload, modo) {
  const e = escritura(modo);
  return e === null ? true : contarPosiciones(payload) <= e[1];
}

/**
 * Dónde quedan unas posiciones respecto de la proporción del modo. Son las
 * posiciones del registro (o de la salida), lo heredado incluido, como las
 * cuenta la proporción (no solo las emitidas):
 * { posiciones, rango: [mín, máx] | null, estado: 'por debajo' | 'dentro' | 'por encima' | 'sin fijar' }.
 */
export function proporcionDe(posiciones, modo) {
  const rango = escritura(modo);
  if (!rango) return { posiciones, rango: null, estado: 'sin fijar' };
  const estado = posiciones < rango[0] ? 'por debajo' : posiciones > rango[1] ? 'por encima' : 'dentro';
  return { posiciones, rango, estado };
}

/** proporcionDe con las posiciones de un payload: todas, lo heredado incluido, como las cuenta la proporción. */
export function proporcion(payload, modo) {
  return proporcionDe(contarPosiciones(payload), modo);
}
