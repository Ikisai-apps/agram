// Elegibilidad antes que límites (R8, docs/notas/NEUTRALIDAD_IDENTIDAD.md §4;
// mapa §12 [D] «Quién ocupa una posición ajena», VG 7-11 noche; regla madre
// de la neutralidad aceptada por VG). Colisionar es libre: cualquiera escribe
// en una posición ajena y queda como ocupante, con su autor y su fecha. Ser
// ELEGIBLE lo decide el criterio del dueño del registro (su autor), en su
// posición 2; si no dice nada, son elegibles los ocupantes del propio autor y
// los de quien aparece en su posición 3.
//
// Primero se filtran los elegibles y después se aplican el límite de
// candidatos de BQL (PENDIENTE POR LÍMITE), el primer candidato de proponer y
// los topes de las vistas. Lo que queda fuera no se borra ni se esconde del
// eje: se resume en un recuento (`noElegibles`) que no puntúa. Así el ruido
// ajeno no bloquea el BUSCAR del dueño ni le tapa las vistas, y N identidades
// falsas no consiguen nada que no consiga una.
//
// Lectura mínima del criterio del dueño, sin lenguaje de criterios nuevo:
// - lista explícita: la subposición 3 de su criterio, 2.3 («criterio · con
//   quién», época 0): un nombre o una lista de nombres. Con ella, los
//   elegibles son el autor y esos nombres. [X] decidir VG: si el autor sigue
//   siendo elegible cuando su lista no lo nombra (aquí, sí), y cómo dice el
//   dueño «cualquiera» (aquí no se puede: no se inventa un comodín).
// - por defecto (2.3 no es un nombre ni una lista de nombres): el autor y las
//   identidades que aparecen en su posición 3 (los textos del 3, a cualquier
//   profundidad, que son identidades con alta en el eje; una fórmula no).
// - un grupo nombrado cuenta como UN ocupante: entran sus escritos, no los de
//   sus miembros (tener P sobre el registro del grupo no hace elegible a
//   nadie). [X] anotado en la nota (C14), pendiente de VG.
// - lo propio del registro (su payload) y lo que alcanzan sus referencias lo
//   puso el autor: siempre es elegible.
// Solo se lee el payload del registro: un escrito anclado en su 2.3 o en su 3
// no cambia los elegibles. [X] decidir VG si las correcciones del dueño
// ancladas ahí cuentan.

import { ARIDAD, direccion, indicesDe } from './btml.js';
import { ocupantes } from './encaje.js';

/** Dónde lee la lista explícita: posición 2 (criterio), subposición 3 (con quién). */
export const LISTA = Object.freeze([2, 3]);
/** Dónde lee el defecto: posición 3 (con quién). */
export const CON_QUIEN = 3;

const esNombre = (x) => typeof x === 'string' && x.length > 0 && !x.startsWith('=');

/** Nombres de la lista explícita (2.3), o null si no hay lista: un nombre, o un array que solo lleva nombres. */
function listaExplicita(payload) {
  const criterio = Array.isArray(payload) ? payload[LISTA[0]] : undefined;
  const x = Array.isArray(criterio) ? criterio[LISTA[1]] : undefined;
  if (esNombre(x)) return [x];
  if (Array.isArray(x) && x.every(esNombre)) return x;
  return null;
}

/** Textos del nodo, a cualquier profundidad dentro de la aridad (las referencias no se siguen). */
function textos(nodo, salida = [], profundidad = 0) {
  if (esNombre(nodo)) salida.push(nodo);
  else if (Array.isArray(nodo) && profundidad < ARIDAD) for (const h of nodo.slice(0, ARIDAD)) textos(h, salida, profundidad + 1);
  return salida;
}

/** ¿Tiene alta en el eje? (ha recibido tokens). */
const conAlta = (eje, x) => (typeof eje.alta === 'function' ? eje.alta(x) !== null : eje.saldos?.has(x) ?? false);

/**
 * Elegibles del registro `id`: { dueno, autores (Set), origen: 'lista' | 'defecto' }.
 * `autores` son las identidades cuyos escritos son elegibles en cualquier
 * posición del registro. Lo propio del registro es siempre elegible.
 */
export function elegibles(eje, id) {
  const ev = eje.obtener(id);
  if (!ev) throw new Error('registro desconocido: ' + id);
  const lista = listaExplicita(ev.payload);
  if (lista) return { dueno: ev.autor, autores: new Set([ev.autor, ...lista]), origen: 'lista' };
  const delTres = Array.isArray(ev.payload) ? textos(ev.payload[CON_QUIEN]).filter((x) => conAlta(eje, x)) : [];
  return { dueno: ev.autor, autores: new Set([ev.autor, ...delTres]), origen: 'defecto' };
}

/** ¿Es elegible un ocupante (de ocupantes) del registro? Lo que no es un escrito es del payload del dueño. */
export function esElegible(o, { autores }) {
  return o.tipo !== 'escrito' || autores.has(o.autor);
}

/**
 * Ocupantes ELEGIBLES de una posición del registro (como encaje.ocupantes,
 * con sus mismas opciones), y cuántos escritos se quedan fuera por no serlo:
 * { lista, noElegibles, elegibles }. Los escritos se toman del índice por
 * autor del eje (Eje.sobreDe): el ruido ajeno no se recorre.
 */
export function ocupantesElegibles(eje, id, indices, opciones = {}) {
  const el = elegibles(eje, id);
  const lista = ocupantes(eje, id, indices, { ...opciones, autores: el.autores });
  const dir = direccion(indices);
  const camino = indicesDe(dir);
  // Los escritos entran como en ocupantes: por dirección, todos; por índice (exacto), si la dirección es ese camino.
  const entran = !opciones.exacto || (camino.length === indices.length && camino.every((x, k) => x === indices[k]));
  const escritos = !entran ? 0 : typeof eje.cuantosSobre === 'function' ? eje.cuantosSobre(id, dir) : eje.sobre(id, dir).length;
  const noElegibles = escritos - lista.filter((o) => o.tipo === 'escrito').length;
  return { lista, noElegibles, elegibles: el };
}

/**
 * Hijos de un registro (lo escrito sobre él, en cualquier posición) partidos
 * en elegibles, en orden de entrada, y el recuento de los que no lo son.
 * Para las vistas con tope (Sequenced): el tope se aplica a los elegibles.
 */
export function hijosElegibles(eje, id) {
  const el = elegibles(eje, id);
  const todos = eje.sobre(id);
  const lista = todos.filter((h) => el.autores.has(h.autor));
  return { lista, noElegibles: todos.length - lista.length, elegibles: el };
}
