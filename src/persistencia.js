// Persistencia: el eje se guarda como la lista de sus eventos y se
// reconstruye volviéndolos a validar uno a uno (ids, firmas, saldos). El
// árbol lógico no se guarda: se reconstruye. En el navegador, localStorage
// es una comodidad por visor; la base de datos y el anclaje vendrán después.
//
// Versión 2 (7-11): series de tokens (T por escala, E ligada a su emisor,
// tipos en el alta). Un eje de la versión 1 no se restaura: se aparta.
// Versión 3 (7-11 noche): ciclo de vida de E/P/R/T (solo emiten personas,
// emisión escalonada, bloqueo y liberación, caducidad de E). Lo guardado sigue
// siendo la lista de eventos, y lo bloqueado se reconstruye al revalidarlos,
// así que la migración desde la 2 es trivial: cambia el número y se revalida
// todo con las reglas nuevas (lo que ya no las cumple no se restaura).

import { Eje } from './eje.js';

export const VERSION = 3;

/** Versiones anteriores que se migran al restaurar: de cada una, la función que lleva sus datos a la siguiente. */
const MIGRACIONES = Object.freeze({
  2: (datos) => ({ ...datos, version: 3 }),
});

/** Forma guardable del eje: solo los eventos, en orden. */
export function serializar(eje) {
  return { version: VERSION, exigirFirmas: eje.exigirFirmas, eventos: eje.orden.map((id) => eje.obtener(id)) };
}

/** Lleva datos guardados a la versión actual; los de una versión sin migración se devuelven tal cual. */
export function migrar(datos) {
  let d = datos;
  while (d && Number.isInteger(d.version) && MIGRACIONES[d.version]) d = MIGRACIONES[d.version](d);
  return d;
}

/** Reconstruye un eje validando cada evento (tras migrar los datos de una versión anterior). Lanza si algo no cuadra. */
export async function restaurar(guardados) {
  const datos = migrar(guardados);
  if (datos && Number.isInteger(datos.version) && datos.version !== VERSION) throw new Error('eje de la versión ' + datos.version + '; esta es la ' + VERSION);
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

/**
 * Aparta lo guardado en `clave` a `destino` sin borrar nada, para no perderlo
 * cuando no se puede restaurar (versión antigua, claves de otra sesión).
 * Devuelve true si había algo que apartar.
 */
export function apartarLocal(clave = 'agram.eje', destino = clave + '.anterior') {
  try {
    const texto = globalThis.localStorage?.getItem(clave);
    if (!texto) return false;
    globalThis.localStorage.setItem(destino, texto);
    return true;
  } catch {
    return false;
  }
}

export function borrarLocal(clave = 'agram.eje') {
  try {
    globalThis.localStorage?.removeItem(clave);
  } catch {
    /* sin almacenamiento */
  }
}
