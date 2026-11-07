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
// Lectura mínima del criterio del dueño, sin lenguaje de criterios nuevo
// (decidido con VG, 7-11 noche):
// - lista explícita: la subposición 3 de su criterio, 2.3 («criterio · con
//   quién», época 0): un nombre o una lista de nombres. Con ella, los
//   elegibles son el autor (siempre) y esos nombres.
// - `cualquiera`: el terminal CUALQUIERA en esa lista abre la elegibilidad a
//   todos los ocupantes. Es la oferta pública (el menú, las plazas de un
//   alojamiento). Lo declara el dueño y no cuenta cabezas: elegible no es
//   elegido.
// - por defecto (sin lista): el autor y las identidades que aparecen en su
//   posición 3 (los textos del 3, a cualquier profundidad, que son
//   identidades con alta en el eje; una fórmula no).
// - las correcciones del dueño cuentan: lo que el propio autor ancla después
//   en su 2.3 (un nombre, una lista de nombres o `cualquiera`) se añade a la
//   lista, y lo que ancla en su 3, a quien aparece en su 3. Corregir es
//   añadir un ocupante: se añade, no se quita a nadie. Lo que anclan otros
//   ahí no cuenta.
// - un grupo nombrado cuenta como UN ocupante: entran sus escritos, no los de
//   sus miembros (tener P sobre el registro del grupo no hace elegible a
//   nadie).
// - lo propio del registro (su payload) y lo que alcanzan sus referencias lo
//   puso el autor: siempre es elegible.

import { ARIDAD, direccion, indicesDe, esDecupla } from './btml.js';
import { ocupantes } from './encaje.js';

/** Dónde lee la lista explícita: posición 2 (criterio), subposición 3 (con quién). */
export const LISTA = Object.freeze([2, 3]);
/** Dónde lee el defecto: posición 3 (con quién). */
export const CON_QUIEN = 3;
/** El terminal que, en la lista del 2.3, abre la elegibilidad a todos los ocupantes. */
export const CUALQUIERA = 'cualquiera';

const esNombre = (x) => typeof x === 'string' && x.length > 0 && !x.startsWith('=');

/** Nombres de una lista: un nombre, o un array que solo lleva nombres; si no, null. */
function nombresDe(x) {
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

/** Lo que el propio autor `autor` ha anclado en (id, indices): sus correcciones. */
function delDueno(eje, id, indices, autor) {
  const dir = direccion(indices);
  return typeof eje.sobreDe === 'function' ? eje.sobreDe(id, dir, new Set([autor])) : eje.sobre(id, dir).filter((e) => e.autor === autor);
}

/**
 * Elegibles del registro `id`: { dueno, todos, autores (Set, o null si todos), origen: 'lista' | 'defecto' }.
 * `autores` son las identidades cuyos escritos son elegibles en cualquier
 * posición del registro; con `todos`, lo son los de cualquiera. Lo propio
 * del registro es siempre elegible.
 */
export function elegibles(eje, id) {
  const ev = eje.obtener(id);
  if (!ev) throw new Error('registro desconocido: ' + id);
  const criterio = Array.isArray(ev.payload) ? ev.payload[LISTA[0]] : undefined;
  // Solo una décupla tiene subposiciones (por hojas, VG 7-11 noche): un criterio que es una lista no tiene 2.3.
  const propias = [nombresDe(esDecupla(criterio) ? criterio[LISTA[1]] : undefined), ...delDueno(eje, id, LISTA, ev.autor).map((e) => nombresDe(e.payload))].filter(Boolean);
  if (propias.length) {
    const lista = propias.flat();
    if (lista.includes(CUALQUIERA)) return { dueno: ev.autor, todos: true, autores: null, origen: 'lista' };
    return { dueno: ev.autor, todos: false, autores: new Set([ev.autor, ...lista]), origen: 'lista' };
  }
  const enTres = [Array.isArray(ev.payload) ? ev.payload[CON_QUIEN] : undefined, ...delDueno(eje, id, [CON_QUIEN], ev.autor).map((e) => e.payload)];
  const nombrados = enTres.flatMap((n) => textos(n)).filter((x) => conAlta(eje, x));
  return { dueno: ev.autor, todos: false, autores: new Set([ev.autor, ...nombrados]), origen: 'defecto' };
}

/** ¿Es elegible un ocupante (de ocupantes) del registro? Lo que no es un escrito es del payload del dueño. */
export function esElegible(o, { todos, autores }) {
  return todos || o.tipo !== 'escrito' || autores.has(o.autor);
}

/**
 * Ocupantes ELEGIBLES de una posición del registro (como encaje.ocupantes,
 * con sus mismas opciones), y cuántos escritos se quedan fuera por no serlo:
 * { lista, noElegibles, elegibles }. Los escritos se toman del índice por
 * autor del eje (Eje.sobreDe): el ruido ajeno no se recorre.
 */
export function ocupantesElegibles(eje, id, indices, opciones = {}) {
  const el = elegibles(eje, id);
  if (el.todos) return { lista: ocupantes(eje, id, indices, opciones), noElegibles: 0, elegibles: el };
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
 * Hijos de un registro (lo escrito sobre él, en cualquier posición), con los
 * elegibles delante, cada grupo en orden de entrada, y el recuento de los que
 * no lo son: { lista, elegiblesN, noElegibles, elegibles }. Para las vistas
 * con tope (Sequenced): el tope corta después de los elegibles, así que el
 * ruido ajeno no tapa lo del dueño; lo que no es elegible solo ocupa el
 * sitio que sobra (la vista es para navegar, no concede nada).
 */
export function hijosElegibles(eje, id) {
  const el = elegibles(eje, id);
  const todos = eje.sobre(id);
  const si = el.todos ? todos : todos.filter((h) => el.autores.has(h.autor));
  const no = el.todos ? [] : todos.filter((h) => !el.autores.has(h.autor));
  return { lista: [...si, ...no], elegiblesN: si.length, noElegibles: no.length, elegibles: el };
}
