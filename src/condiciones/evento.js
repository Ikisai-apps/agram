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

/** Suelo: solo hay un génesis (el primer registro, el único sin foco). */
export const UN_GENESIS = Object.freeze({
  nombre: 'suelo:un-genesis',
  filas: Object.freeze([]),
  familia: 'evento',
  evaluar: (tx, libro, ctx) => (ctx.evento.contexto?.genesis ? 'ya hay génesis' : null),
});

/** El anclaje: todo registro, salvo el génesis, se ancla sobre uno que está en el eje. */
export const ANCLA = Object.freeze({
  nombre: 'ancla',
  filas: Object.freeze([]),
  familia: 'evento',
  evaluar: (tx, libro, ctx) => {
    const ev = ctx.evento;
    if (ev.sobre === null) return 'solo el génesis carece de foco';
    return ctx.registro(ev.sobre) ? null : 'foco desconocido: ' + ev.sobre;
  },
});

/** ID-1: una identidad existe cuando tiene cuenta en el libro (recibió tokens: su alta). */
export const AUTOR_CON_ALTA = Object.freeze({
  nombre: 'ID-1',
  filas: Object.freeze(['ID-1']),
  familia: 'identidad',
  evaluar: (tx, libro, ctx) => (libro.tiene(ctx.evento.autor) ? null : 'autor desconocido: ' + ctx.evento.autor),
});
