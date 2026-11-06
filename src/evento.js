// Evento: la unidad de información. Es una transición de tokens con un payload
// BTML encima. Se anida sobre el registro en foco (hijo → padre); los hilos son
// cadenas de eventos encadenados por esa referencia.

import { validarPayload, esDireccion } from './btml.js';
import { validarMovimiento } from './tokens.js';

/** Posición raíz del foco: el registro entero. */
export const RAIZ = '0000000000';

/** JSON canónico: claves ordenadas, sin espacios. */
export function canonico(valor) {
  if (Array.isArray(valor)) return '[' + valor.map(canonico).join(',') + ']';
  if (valor !== null && typeof valor === 'object') {
    const claves = Object.keys(valor).sort();
    return '{' + claves.map((k) => JSON.stringify(k) + ':' + canonico(valor[k])).join(',') + '}';
  }
  return JSON.stringify(valor);
}

/** SHA-256 en hexadecimal, igual en Node y en el navegador. */
export async function hash(texto) {
  const bytes = new TextEncoder().encode(texto);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Cuerpo del evento sin su id: lo que se firma y lo que se hashea. */
export function cuerpo(ev) {
  return {
    autor: ev.autor,
    sobre: ev.sobre,
    en: ev.en ?? RAIZ,
    t: ev.t,
    movimientos: ev.movimientos,
    payload: ev.payload,
    contexto: ev.contexto ?? {},
  };
}

/**
 * Crea un evento con su id = hash del cuerpo canónico.
 * autor: identidad que escribe. sobre: id del registro en foco (null solo en génesis).
 * en: posición del foco donde se anida lo escrito (dirección de diez dígitos; raíz por defecto).
 * Lo escrito va en el PV donde se escribe (VG, 6-11-2026).
 * t: instante ISO. movimientos: lista de movimientos de tokens. payload: BTML.
 */
export async function crearEvento({ autor, sobre = null, en = RAIZ, t, movimientos, payload, contexto = {} }) {
  const ev = { autor, sobre, en, t, movimientos, payload, contexto };
  const errores = validarForma(ev);
  if (errores.length) throw new Error('evento mal formado: ' + errores.join('; '));
  ev.id = await hash(canonico(cuerpo(ev)));
  return Object.freeze(ev);
}

/** Validación de forma, sin mirar el eje. */
export function validarForma(ev) {
  const errores = [];
  if (typeof ev.autor !== 'string' || !ev.autor) errores.push('autor obligatorio');
  if (ev.sobre !== null && typeof ev.sobre !== 'string') errores.push('sobre debe ser id o null');
  if (ev.en !== undefined && !esDireccion(ev.en)) errores.push('en debe ser una dirección de diez dígitos');
  if (ev.sobre === null && ev.en !== undefined && ev.en !== RAIZ) errores.push('el génesis solo se anida en la raíz');
  if (typeof ev.t !== 'string' || Number.isNaN(Date.parse(ev.t))) errores.push('t debe ser instante ISO');
  if (!Array.isArray(ev.movimientos) || ev.movimientos.length === 0) {
    errores.push('todo evento mueve tokens');
  } else {
    ev.movimientos.forEach((m, i) => validarMovimiento(m).forEach((e) => errores.push('movimiento ' + i + ': ' + e)));
    // El evento mínimo mueve T. En el génesis el autor lo recibe; después lo gasta.
    const esGenesis = ev.contexto?.genesis === true;
    const mueveT = ev.movimientos.some((m) => m.token === 'T' && (esGenesis ? m.a === ev.autor : m.de === ev.autor));
    if (!mueveT) errores.push(esGenesis ? 'el génesis debe emitir T al autor' : 'el autor debe mover T');
  }
  const p = validarPayload(ev.payload);
  if (!p.ok) errores.push(...p.errores.map((e) => 'payload ' + e));
  return errores;
}

/** Comprueba que el id corresponde al cuerpo. */
export async function verificarId(ev) {
  return ev.id === (await hash(canonico(cuerpo(ev))));
}
