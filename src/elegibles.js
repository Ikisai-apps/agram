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
// - un registro nombrado cuenta como UN ocupante: entran sus escritos, no los
//   de quienes tienen P sobre él (tener P sobre un registro no hace elegible a
//   nadie). Un grupo es un registro (VG, 8-11: no hay identidades de grupo).
// - lo propio del registro (su payload) y lo que alcanzan sus referencias lo
//   puso el autor: siempre es elegible.
//
// Encargo pv3 (VG, 11/12-11, issues #31 y #32): admitir es una transacción de R (y T) del dueño con la identidad, que
// ancla en el 3 del registro («admit someone»), y la admisión BAJA POR EL ÁRBOL: admitido en un registro es admitido en
// todo lo que cuelga de él mientras el dueño sea el mismo (se sube por `sobre`; admitir en el alta vale para todo lo
// suyo). Dejar de admitir es QUITAR («remove someone»: una corrección del dueño en el mismo sitio, el 3, que quita a la
// identidad de ahí y de lo de debajo, hasta que la vuelva a admitir). Vetar (el grupo 5 del 3: lo que el dueño ancla en
// el 3.5.3 de su alta) gana sobre cualquier R: el vetado no es elegible en nada del dueño, ni con `cualquiera`.

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

/** La acción que quita (la inversa de admitir, encargo pv3): un registro del dueño en el 3 que la nombra en su 4. */
export const QUITAR = 'remove someone';
/** Dónde ancla el dueño a quien veta: el 3.5.3 de su alta (los quiénes del grupo 5 de su atención). */
export const VETO = Object.freeze([3, 5, 3]);

const esQuitar = (e) => Array.isArray(e.payload) && textos(e.payload[4]).includes(QUITAR);

/**
 * Lo que un registro admite por su 3 sobre `antes` (lo que trae de arriba): los nombrados en su payload 3 y, en orden
 * de llegada, las correcciones del dueño en su 3: admitir (nombrar, «admit someone») añade; quitar («remove someone»)
 * saca. Con `soloQuitar`, solo lo segundo (con una lista en el 2.3, lo del 3 no admite, pero quitar sigue quitando).
 */
function porSuTres(eje, ev, antes, { soloQuitar = false } = {}) {
  const fuera = new Set(antes);
  const nombra = (n) => textos(n).filter((x) => x !== ev.autor && conAlta(eje, x));
  if (!soloQuitar) for (const x of nombra(Array.isArray(ev.payload) ? ev.payload[CON_QUIEN] : undefined)) fuera.add(x);
  for (const e of delDueno(eje, ev.id, [CON_QUIEN], ev.autor)) {
    if (esQuitar(e)) for (const x of nombra(e.payload[CON_QUIEN])) fuera.delete(x);
    else if (!soloQuitar) for (const x of nombra(e.payload)) fuera.add(x);
  }
  return fuera;
}

/** Lo admitido arriba: subiendo por `sobre` mientras el dueño sea el mismo, de lo más alto hacia abajo (sin el propio registro). */
function heredado(eje, ev) {
  const arriba = [];
  for (let e = typeof ev.sobre === 'string' ? eje.obtener(ev.sobre) : null; e && e.autor === ev.autor; e = typeof e.sobre === 'string' ? eje.obtener(e.sobre) : null) arriba.push(e);
  return arriba.reverse().reduce((s, e) => porSuTres(eje, e, s), new Set());
}

/** Los vetados del dueño: lo que ancla en el 3.5.3 de su alta (la identidad en su 0, o una lista de nombres). */
export function vetadosDe(eje, dueno) {
  const alta = typeof eje.alta === 'function' ? eje.alta(dueno) : null;
  if (!alta) return new Set();
  return new Set(delDueno(eje, alta.id, VETO, dueno).flatMap((e) => textos(Array.isArray(e.payload) && e.payload.some(Array.isArray) ? e.payload[0] : e.payload)).filter((x) => x !== dueno && conAlta(eje, x)));
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
  // Lo admitido arriba (la admisión baja por el árbol) y los vetados del dueño (ganan sobre todo).
  const arriba = heredado(eje, ev);
  const vetados = vetadosDe(eje, ev.autor);
  const sin = (s) => { for (const v of vetados) s.delete(v); return s; };
  if (propias.length) {
    const lista = propias.flat();
    if (lista.includes(CUALQUIERA)) return { dueno: ev.autor, todos: true, autores: null, origen: 'lista', vetados };
    const heredados = sin(porSuTres(eje, ev, arriba, { soloQuitar: true }));
    return { dueno: ev.autor, todos: false, autores: sin(new Set([ev.autor, ...lista, ...heredados])), origen: 'lista', heredados, vetados };
  }
  const propiosDelTres = porSuTres(eje, ev, new Set());
  const admitidos = porSuTres(eje, ev, arriba);
  const heredados = sin(new Set([...admitidos].filter((x) => arriba.has(x) && !propiosDelTres.has(x))));
  return { dueno: ev.autor, todos: false, autores: sin(new Set([ev.autor, ...admitidos])), origen: 'defecto', heredados, vetados };
}

/** ¿Es elegible un ocupante (de ocupantes) del registro? Lo que no es un escrito es del payload del dueño; un vetado, nunca. */
export function esElegible(o, { todos, autores, vetados }) {
  if (o.tipo === 'escrito' && vetados?.has(o.autor)) return false;
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
  if (el.todos && !el.vetados?.size) return { lista: ocupantes(eje, id, indices, opciones), noElegibles: 0, elegibles: el };
  if (el.todos) {
    // Con «cualquiera», todos menos los vetados del dueño.
    const todos = ocupantes(eje, id, indices, opciones);
    const lista = todos.filter((o) => esElegible(o, el));
    return { lista, noElegibles: todos.length - lista.length, elegibles: el };
  }
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
  const vale = (h) => !el.vetados?.has(h.autor) && (el.todos || el.autores.has(h.autor));
  const si = todos.filter(vale);
  const no = todos.filter((h) => !vale(h));
  return { lista: [...si, ...no], elegiblesN: si.length, noElegibles: no.length, elegibles: el };
}
