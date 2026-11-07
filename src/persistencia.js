// Persistencia: el eje se guarda como la lista de sus eventos y se
// reconstruye volviéndolos a validar uno a uno (ids, firmas, saldos). El
// árbol lógico no se guarda: se reconstruye. En el navegador, localStorage
// es una comodidad por visor; la base de datos y el anclaje vendrán después.
//
// Versión 2 (7-11): series de tokens (T por escala, E ligada a su emisor,
// tipos en el alta). Un eje de la versión 1 no se restaura: se aparta.
// Versión 3 (7-11 noche): ciclo de vida de E/P/R/T (solo emiten personas,
// emisión escalonada, bloqueo y liberación, caducidad de E, el t de un evento
// no es anterior al de su foco ni al alta de su autor). Lo guardado sigue
// siendo la lista de eventos, y lo bloqueado se reconstruye al revalidarlos.
//
// La migración desde la 2 NO es trivial: un eje de la versión 2 puede tener
// eventos que las reglas nuevas rechazan (un génesis de grupo, E o R emitidos
// fuera del génesis sin el escalonado, eventos fechados antes que su foco).
// Por eso sus eventos se revalidan con las reglas de la versión 2
// (`eventosV2` = cuántos eventos del principio son de entonces; src/ciclo.js)
// y las reglas nuevas rigen solo los eventos que se añadan después. Al volver
// a guardar, `eventosV2` se conserva. Lo que ni las reglas de la versión 2
// admiten tampoco se restaura.
// [X] confirmar VG: unos datos de la versión 3 pueden declarar `eventosV2` a
// mano y pasar con las reglas viejas eventos que nunca fueron de la versión 2;
// es lo mismo que presentarlos como versión 2, que también se admite.

import { Eje } from './eje.js';

export const VERSION = 3;

/** Versiones anteriores que se migran al restaurar: de cada una, la función que lleva sus datos a la siguiente. */
const MIGRACIONES = Object.freeze({
  // Todos los eventos de un eje v2 se validan con las reglas de la v2.
  2: (datos) => ({ ...datos, version: 3, eventosV2: Array.isArray(datos.eventos) ? datos.eventos.length : 0 }),
});

/** Forma guardable del eje: los eventos, en orden, y cuántos del principio son de la versión 2 (si alguno lo es). */
export function serializar(eje) {
  return {
    version: VERSION,
    exigirFirmas: eje.exigirFirmas,
    ...(eje.eventosV2 > 0 ? { eventosV2: eje.eventosV2 } : {}),
    eventos: eje.orden.map((id) => eje.obtener(id)),
  };
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
  return Eje.desde(datos.eventos, { exigirFirmas: Boolean(datos.exigirFirmas), eventosV2: datos.eventosV2 ?? 0 });
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
