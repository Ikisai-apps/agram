// Persistencia: el eje se guarda como la lista de sus eventos y se
// reconstruye volviéndolos a validar uno a uno (ids, firmas, saldos). El
// árbol lógico no se guarda: se reconstruye. En el navegador, localStorage
// es una comodidad por visor; la base de datos y el anclaje vendrán después.

import { Eje } from './eje.js';

export const VERSION = 1;

/** Forma guardable del eje: solo los eventos, en orden. */
export function serializar(eje) {
  return { version: VERSION, exigirFirmas: eje.exigirFirmas, eventos: eje.orden.map((id) => eje.obtener(id)) };
}

/** Reconstruye un eje validando cada evento. Lanza si algo no cuadra. */
export async function restaurar(datos) {
  if (!datos || datos.version !== VERSION || !Array.isArray(datos.eventos) || !datos.eventos.length) throw new Error('datos de eje inválidos');
  return Eje.desde(datos.eventos, { exigirFirmas: Boolean(datos.exigirFirmas) });
}

/** Guarda en localStorage si existe; devuelve false si no se pudo. */
export function guardarLocal(eje, clave = 'agram.eje') {
  try {
    globalThis.localStorage?.setItem(clave, JSON.stringify(serializar(eje)));
    return true;
  } catch {
    return false;
  }
}

/** Carga de localStorage; null si no hay nada o no se pudo. */
export async function cargarLocal(clave = 'agram.eje') {
  try {
    const texto = globalThis.localStorage?.getItem(clave);
    return texto ? await restaurar(JSON.parse(texto)) : null;
  } catch {
    return null;
  }
}

export function borrarLocal(clave = 'agram.eje') {
  try {
    globalThis.localStorage?.removeItem(clave);
  } catch {
    /* sin almacenamiento */
  }
}
