// Condiciones del evento como registro: su forma, su id, que no esté ya, su
// anclaje y que su autor tenga cuenta en el libro. Son las comprobaciones con
// que empezaba eje.validar, en el mismo orden y con el mismo texto, ahora
// como condiciones de validez de la transacción (VG, 9-11: la capa cero).
// Las filas son las del inventario (docs/notas/INVENTARIO_REGLAS.md §2); lo
// que el inventario llama suelo (hash, forma BTML) se nombra «suelo».
//
// Cada condición es { nombre, filas, familia, evaluar(tx, libroAntes, ctx) }
// y devuelve null o sus motivos. `ctx` es el de eje.contexto(ev): `evento`
// es el registro que la transacción asienta.

import { validarForma, verificarId } from '../evento.js';
import { esReferencia } from '../btml.js';
import { EPOCA_0_BTML } from '../epocas.js';

/** EV-1, EV-2, EV-3, TT-5, TT-7, PP-1, BL-1, RR-1 y la forma BTML (suelo): validarForma, sin mirar el eje. */
export const FORMA = Object.freeze({
  nombre: 'EV-1',
  filas: Object.freeze(['EV-1', 'EV-2', 'EV-3', 'TT-5', 'TT-7', 'PP-1', 'BL-1', 'RR-1']),
  familia: 'evento',
  evaluar: (tx, libro, ctx) => validarForma(ctx.evento, { tLaxo: ctx.tLaxo }),
});

/** Suelo: el id es el hash del cuerpo canónico. */
export const ID = Object.freeze({
  nombre: 'suelo:id',
  filas: Object.freeze([]),
  familia: 'evento',
  evaluar: async (tx, libro, ctx) => {
    const ev = ctx.evento;
    return typeof ev.id !== 'string' || !(await verificarId(ev)) ? 'id no corresponde al cuerpo' : null;
  },
});

/** Suelo: un evento entra una vez. */
export const NUEVO = Object.freeze({
  nombre: 'suelo:nuevo',
  filas: Object.freeze([]),
  familia: 'evento',
  evaluar: (tx, libro, ctx) => (ctx.registrado(ctx.evento.id) ? 'evento ya registrado' : null),
});

/**
 * Suelo: solo hay un génesis, el primer registro, y es el único sin foco. Que el foco de los demás sea un registro
 * del eje lo dice la regla de la época «every record hangs on a record of the ledger» (encargo 3a, paso 9: la
 * condición «ancla» se retiró), sin excepción: el génesis no pasa por las reglas (es la época 0 en el eje, encargo 3b).
 */
export const UN_GENESIS = Object.freeze({
  nombre: 'suelo:un-genesis',
  filas: Object.freeze([]),
  familia: 'evento',
  evaluar: (tx, libro, ctx) => {
    const ev = ctx.evento;
    const motivos = [];
    if (ev.contexto?.genesis) motivos.push('ya hay génesis');
    if (ev.sobre === null) motivos.push('solo el génesis carece de foco');
    return motivos;
  },
});

/** Las referencias de un payload ({ ref } o { ref, dir }), en orden. */
export function referenciasDe(nodo, fuera = []) {
  if (esReferencia(nodo)) fuera.push(nodo.ref);
  else if (Array.isArray(nodo)) for (const x of nodo) referenciasDe(x, fuera);
  return fuera;
}

/**
 * Suelo (VG, 10-11, C1): una referencia del payload a un evento que no está en el eje se rechaza al entrar,
 * mientras el eje es local; con red, «si no lo tienes lo buscas»: se resuelve antes de aceptar. Así ninguna regla
 * se queda PENDIENTE por una referencia ausente (D-META-1, D-META-3). El prefijo de la versión 2 no se toca.
 */
export const REFERENCIAS = Object.freeze({
  nombre: 'suelo:referencias',
  filas: Object.freeze([]),
  familia: 'evento',
  evaluar: (tx, libro, ctx) => referenciasAusentes(ctx).map((id) => 'referencia a un evento que no está en el eje: ' + id.slice(0, 8) + ' (mientras el eje es local; con red, se resuelve antes de aceptar)'),
});

/** Las referencias del payload de la candidata de `ctx` a eventos que el eje no tiene (en el génesis, todas). */
export function referenciasAusentes(ctx) {
  if (ctx.reglas === 2 || !ctx.evento || typeof ctx.evento !== 'object') return [];
  // La época y los registros de sus reglas se resuelven siempre (encargo 3b: una invitación referencia la época 0).
  const deLaEpoca = (id) => id === EPOCA_0_BTML.id || EPOCA_0_BTML.registros.has(id);
  const tiene = typeof ctx.registro === 'function' ? (id) => deLaEpoca(id) || Boolean(ctx.registro(id)) : deLaEpoca;
  return [...new Set(referenciasDe(ctx.evento.payload))].filter((id) => !tiene(id));
}

/** ID-1: una identidad existe cuando tiene cuenta en el libro (recibió tokens: su alta). */
export const AUTOR_CON_ALTA = Object.freeze({
  nombre: 'ID-1',
  filas: Object.freeze(['ID-1']),
  familia: 'identidad',
  // B1 (VG, 10-11): quien aún no tiene cuenta y escribe, escribe su propia alta (es una persona; sin clave no
  // actúa fuera de una demostración, ID-5). Solo en el prefijo de la versión 2 (suelo de persistencia) una identidad
  // existía únicamente al recibir tokens.
  evaluar: (tx, libro, ctx) => (ctx.reglas !== 2 || libro.tiene(ctx.evento.autor) ? null : 'autor desconocido: ' + ctx.evento.autor),
});
