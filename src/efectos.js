// Catálogo de efectos: cada operación dice qué cambió, de qué clase y cómo se
// ve en su mundo. Sobrio y animado son dos renders de la misma operación
// (FUNDAMENTOS): los dos leen esta lista.
//
// Un efecto se deriva SOLO del evento, sin estado aparte: de su payload, de
// sus movimientos y de su contexto. Lo único que se mira fuera es su foco (el
// registro al que apunta `sobre`), para saber si una celda ya tenía algo.
// Tres fuentes, en este orden:
// - cada celda emitida: posición i, subposición j y clase k son los tres
//   dígitos que siguen al anclaje `en` (mapa §13 [D]: la matriz 10×10×10 es
//   relativa al camino; la clase es el dígito en la profundidad n+2). Las
//   referencias al foco son herencia, no efecto, salvo que el registro las
//   marque como vistas;
// - cada movimiento de tokens: serie, cantidad, de y a;
// - la fase del motor que registra el evento (contexto.fase).
// Cada efecto: { mundo: el PV de su posición (época 0), celda: dirección de
// diez dígitos, clase, tipo, nombre } y, para leer, metáfora, fuente y, si
// el corpus no lo nombra, «[X] decidir VG». Los nombres viven en
// datos/efectos.json (por mundo y por tipo); datos/efectos.js es su copia
// importable, generada.

import { ARIDAD, esReferencia, esDireccion, indicesDe, direccion } from './btml.js';
import { claveToken } from './tokens.js';
import { RAIZ } from './evento.js';
import { CATALOGO_EFECTOS } from '../datos/efectos.js';

function congelar(x) {
  if (x && typeof x === 'object' && !Object.isFrozen(x)) {
    Object.freeze(x);
    for (const v of Object.values(x)) congelar(v);
  }
  return x;
}

/** El catálogo entero (datos/efectos.json), congelado. */
export const CATALOGO = congelar(CATALOGO_EFECTOS);

/** Tipos de efecto. Los seis primeros son de celda; token y fase, del evento. */
export const TIPOS = Object.freeze(['ver', 'sustituir', 'escrito', 'anclado', 'impulso', 'modificar', 'token', 'fase']);

/** Fases del motor con efecto: las del catálogo, que una prueba mantiene iguales a las de src/motor.js. */
export const FASES = Object.freeze(Object.keys(CATALOGO.tipos.fase.generico));

/** Marca de lo que el catálogo no nombra en un mundo. */
export const SIN_NOMBRE = '[X] decidir VG: el corpus no nombra este efecto en este mundo';

/** Nombre corto del mundo de un PV: «lente», «ciudad», «hilos del pasado»… */
export function nombreMundo(pv) {
  const m = Number.isInteger(pv) ? CATALOGO.mundos[pv] : undefined;
  if (!m) throw new RangeError('mundo fuera de 0–9: ' + pv);
  return m.nombre;
}

/** Clase de una celda relativa al anclaje: el dígito en la profundidad n+2, con n la del anclaje (mapa §13). */
export function claseRelativa(celda, en = RAIZ) {
  if (!esDireccion(celda) || !esDireccion(en)) throw new TypeError('celda y anclaje son direcciones de diez dígitos');
  const n = indicesDe(en).length;
  return n + 2 < ARIDAD ? Number(celda[n + 2]) : 0;
}

// ---------- celdas ----------

const etiqueta = (ruta) => ruta.join('.');

/** Etiqueta normalizada a tres dígitos: 2 → «2.0.0», «2.1» → «2.1.0». */
function normal(e) {
  const r = String(e).split('.');
  while (r.length < 3) r.push('0');
  return r.join('.');
}

function marcas(lista) {
  return Array.isArray(lista) ? new Set(lista.map(normal)) : null;
}

function nodoEn(payload, camino) {
  let nodo = payload;
  for (const x of camino) {
    if (!Array.isArray(nodo)) return undefined;
    nodo = nodo[x];
  }
  return nodo;
}

/**
 * Si un payload tiene algo en un camino exacto, sin seguir referencias. Los
 * ceros finales nombran la colisión (mapa §12): 4.0 alcanza la posición 4.
 */
function tieneContenido(payload, camino) {
  const c = [...camino];
  while (c.length && c[c.length - 1] === 0) c.pop();
  return nodoEn(payload, c) !== undefined;
}

/**
 * Celdas de un registro, relativas a su anclaje. Un array DESARROLLA la
 * posición `en`: cada nodo del payload a profundidad 3 (o un terminal antes)
 * es la celda i.j.k bajo `en`, y lo que cuelgue debajo es contenido de esa
 * celda. Un terminal OCUPA la posición `en`: lo escrito va en el PV donde se
 * escribe (VG, 6-11), así que su celda es la propia `en`, su posición su
 * último dígito (la raíz, 0) y su clase 0.
 */
function celdasDe(ev, en) {
  const anclaje = indicesDe(en);
  if (!Array.isArray(ev.payload)) {
    const i = anclaje.length ? anclaje[anclaje.length - 1] : 0;
    return [{ ruta: [], i, j: 0, k: 0, nodo: ev.payload, absoluta: anclaje, celda: en }];
  }
  const celdas = [];
  const recorrer = (nodo, ruta) => {
    if (Array.isArray(nodo) && ruta.length < 3 && anclaje.length + ruta.length < ARIDAD) {
      nodo.forEach((h, x) => recorrer(h, [...ruta, x]));
      return;
    }
    const [i = 0, j = 0, k = 0] = ruta;
    const absoluta = [...anclaje, ...ruta];
    celdas.push({ ruta, i, j, k, nodo, absoluta, celda: direccion(absoluta) });
  };
  recorrer(ev.payload, []);
  return celdas;
}

/**
 * Tipo de una celda, o null si es herencia (no es efecto).
 * 1. Referencia al foco: herencia, salvo que el registro la marque como vista
 *    (contexto.vistas; o fuera de contexto.heredadas si las lista; o porque
 *    el registro entero es esa referencia). Ver es clase 0.
 * 2. Clase 1: impulso. Clases 2–9: modificar.
 * 3. Clase 0 con contenido: sustituir si el foco ya tiene algo en la celda;
 *    anclado si el foco no tiene nada donde se ancla el registro (lo lejano);
 *    escrito si no (una hoja nueva de una rama que existe). Sin foco
 *    (génesis), escrito.
 */
function tipoDe(ev, c, foco, anclaje, vistas, heredadas) {
  if (esReferencia(c.nodo) && c.nodo.ref === ev.sobre) {
    if (c.k !== 0) return null;
    const e = normal(etiqueta(c.ruta.length ? c.ruta : [0]));
    if (vistas?.has(e)) return 'ver';
    if (heredadas && !heredadas.has(e)) return 'ver';
    if (!c.ruta.length) return 'ver';
    return null;
  }
  if (c.k === 1) return 'impulso';
  if (c.k >= 2) return 'modificar';
  if (!foco) return 'escrito';
  if (tieneContenido(foco.payload, c.absoluta)) return 'sustituir';
  if (!tieneContenido(foco.payload, anclaje)) return 'anclado';
  return 'escrito';
}

// ---------- nombres ----------

function claves(ef) {
  if (ef.tipo === 'token') return ['token.' + ef.movimiento, '*'];
  if (ef.tipo === 'fase') return ['fase.' + ef.fase, '*'];
  if (ef.tipo === 'modificar') return ['modificar.' + ef.clase, 'modificar', '*'];
  return [ef.tipo, '*'];
}

function entrada(mundo, ef) {
  const efectos = CATALOGO.mundos[mundo]?.efectos ?? {};
  for (const k of claves(ef)) if (Object.hasOwn(efectos, k)) return efectos[k];
  return null;
}

function generico(ef) {
  if (ef.tipo === 'token') return CATALOGO.tipos.token.generico[ef.movimiento] + ' ' + ef.token;
  if (ef.tipo === 'fase') return CATALOGO.tipos.fase.generico[ef.fase];
  if (ef.tipo === 'modificar') {
    const n = CATALOGO.clases[ef.clase]?.nombre;
    return 'modificar (' + (n ?? 'clase ' + ef.clase) + ')';
  }
  return CATALOGO.tipos[ef.tipo].generico;
}

function lectura(e) {
  return { nombre: e.nombre, metafora: e.metafora, fuente: e.fuente, ...(e.decision ? { decision: e.decision } : {}) };
}

function nombrar(ef) {
  const e = entrada(ef.mundo, ef);
  return e ? lectura(e) : { nombre: generico(ef), metafora: null, fuente: null, decision: SIN_NOMBRE };
}

/**
 * Cómo se ve un efecto desde otro mundo (los hilos ven entrar lo escrito por
 * la izquierda; el camino previsualiza una consolidación…); null si ese
 * mundo no lo declara.
 */
export function verEn(efecto, mundo) {
  const e = entrada(mundo, efecto);
  return e ? { mundo, ...lectura(e) } : null;
}

// ---------- efectos ----------

/**
 * Efectos de un evento (o de su id): las celdas emitidas, los movimientos de
 * tokens y la fase del motor, en ese orden. No escribe ni guarda nada.
 */
export function efectosDe(eje, evento) {
  const ev = typeof evento === 'string' ? eje?.obtener(evento) : evento;
  if (!ev || typeof ev !== 'object') throw new Error('evento desconocido: ' + String(evento).slice(0, 8));
  const en = ev.en ?? RAIZ;
  if (!esDireccion(en)) throw new Error('anclaje inválido: ' + en);
  let foco = null;
  if (ev.sobre !== null && ev.sobre !== undefined) {
    foco = eje?.obtener(ev.sobre);
    if (!foco) throw new Error('foco desconocido: ' + String(ev.sobre).slice(0, 8));
  }
  const anclaje = indicesDe(en);
  const vistas = marcas(ev.contexto?.vistas);
  const heredadas = marcas(ev.contexto?.heredadas);
  const efectos = [];
  const anadir = (ef) => efectos.push({ evento: ev.id, ...ef, ...nombrar(ef) });

  for (const c of celdasDe(ev, en)) {
    const tipo = tipoDe(ev, c, foco, anclaje, vistas, heredadas);
    if (tipo) anadir({ tipo, mundo: c.i, celda: c.celda, clase: c.k, posicion: c.i, subposicion: c.j, etiqueta: [c.i, c.j, c.k].join('.') });
  }

  for (const m of ev.movimientos ?? []) {
    const familia = CATALOGO.familias[m.token];
    if (!familia) throw new Error('familia de token sin mundo: ' + m.token);
    const movimiento = m.de === null ? 'emitir' : m.a === null ? 'consumir' : 'mover';
    anadir({ tipo: 'token', mundo: familia.mundo, celda: en, clase: familia.clase, movimiento, token: m.token, serie: claveToken(m), cantidad: m.cantidad, de: m.de, a: m.a });
  }

  const fase = ev.contexto?.fase;
  if (FASES.includes(fase)) {
    // La fase está donde se ancla el registro, leída como un terminal: su
    // clase sale 0, como en la fábrica de la PR #40 ([X] decidir VG).
    anadir({ tipo: 'fase', mundo: anclaje.length ? anclaje[anclaje.length - 1] : 0, celda: en, clase: 0, fase });
  }
  return efectos;
}

/** Efectos de todo el eje, evento a evento en orden de entrada. */
export function efectosDelEje(eje) {
  return eje.orden.flatMap((id) => efectosDe(eje, id));
}

// ---------- renders ----------

function detalleDe(e) {
  if (e.tipo === 'token') return e.serie + ' ' + e.cantidad + ' ' + (e.de ?? '∅') + '→' + (e.a ?? '∅');
  if (e.tipo === 'fase') return e.fase;
  return e.etiqueta + ' ' + e.tipo;
}

/**
 * Render sobrio: una línea por efecto, «mundo · efecto · celda». Con
 * `detalle`, añade qué fue: la celda relativa y su tipo, la serie con su
 * cantidad y su sentido, o la fase.
 */
export function sobrio(efectos, { detalle = false } = {}) {
  return efectos.map((e) => [nombreMundo(e.mundo), e.nombre, e.celda, ...(detalle ? [detalleDe(e)] : [])].join(' · ')).join('\n');
}

/** El animado llega con los mundos (big picture §6, tandas 4 a 6): leerá esta misma lista. */
export const RENDERS = Object.freeze({ sobrio });

export function render(efectos, nombre = 'sobrio', opciones) {
  const r = Object.hasOwn(RENDERS, nombre) ? RENDERS[nombre] : undefined;
  if (!r) throw new Error('render no disponible: ' + nombre);
  return r(efectos, opciones);
}
