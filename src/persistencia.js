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
// fuera del génesis sin el escalonado, eventos fechados antes que su foco o
// con un t que solo Date.parse lee). Por eso sus eventos se revalidan con las
// reglas de la versión 2 (src/ciclo.js) y las nuevas rigen solo lo que se
// añada después. Lo que ni las reglas de la versión 2 admiten no se restaura.
//
// La marca del prefijo (revisión de seguridad, 7-11 noche): solo `migrar`,
// desde unos datos de la versión 2, la pone: `v2: { eventos: n, ultimo: id }`,
// con el id del último evento de la versión 2, que `restaurar` comprueba (los
// ids son el hash de cada evento y se vuelven a verificar). Un guardado de la
// versión 3 solo la lleva si viene de esa migración (`serializar` la
// conserva); un `eventosV2` suelto se rechaza. En el prefijo no vale nada que
// la versión 2 no conocía (estado, salida, caduca, devolver R), y el alta de
// quien entró en él cuenta, para el reloj y el tope de T, desde el primer
// evento de la versión 3 (src/ciclo.js, acotarAltaV2).
// Lo que no es: una firma. Quien escribe el archivo puede escribir también la
// marca, igual que podría presentar sus eventos como versión 2, que también
// se admite; no gana nada que la versión 2 no diera ya. [X] confirmar VG.

import { Eje } from './eje.js';

export const VERSION = 3;

/** La marca del prefijo de la versión 2: cuántos eventos y el id del último. */
function marcaV2(eventos) {
  if (!Array.isArray(eventos) || !eventos.length) return undefined;
  return { eventos: eventos.length, ultimo: eventos[eventos.length - 1]?.id };
}

/** Versiones anteriores que se migran al restaurar: de cada una, la función que lleva sus datos a la siguiente. */
const MIGRACIONES = Object.freeze({
  // Todos los eventos de un eje v2 se validan con las reglas de la v2; lo que traiga de marca, se descarta.
  2: ({ eventosV2: _cuenta, v2: _marca, ...datos }) => {
    const marca = marcaV2(datos.eventos);
    return { ...datos, version: 3, ...(marca ? { v2: marca } : {}) };
  },
});

/** Forma guardable del eje: los eventos, en orden, y la marca del prefijo de la versión 2 si viene de una migración. */
export function serializar(eje) {
  return {
    version: VERSION,
    exigirFirmas: eje.exigirFirmas,
    ...(eje.eventosV2 > 0 ? { v2: { eventos: eje.eventosV2, ultimo: eje.orden[eje.eventosV2 - 1] } } : {}),
    eventos: eje.orden.map((id) => eje.obtener(id)),
  };
}

/** Lleva datos guardados a la versión actual; los de una versión sin migración se devuelven tal cual. */
export function migrar(datos) {
  let d = datos;
  while (d && Number.isInteger(d.version) && MIGRACIONES[d.version]) d = MIGRACIONES[d.version](d);
  return d;
}

/** Cuántos eventos del principio se validan con las reglas de la 2, comprobando la marca; lanza si no cuadra. */
function prefijoV2(datos) {
  if (Object.hasOwn(datos, 'eventosV2')) throw new Error('eventosV2 no se declara en un guardado: el prefijo de la versión 2 solo lo marca migrar');
  if (datos.v2 === undefined) return 0;
  const { eventos: n, ultimo } = datos.v2 ?? {};
  if (!Number.isSafeInteger(n) || n < 1 || n > datos.eventos.length || typeof ultimo !== 'string' || datos.eventos[n - 1]?.id !== ultimo) {
    throw new Error('la marca de la versión 2 no corresponde a sus eventos');
  }
  return n;
}

/** Reconstruye un eje validando cada evento (tras migrar los datos de una versión anterior). Lanza si algo no cuadra. */
export async function restaurar(guardados) {
  const datos = migrar(guardados);
  if (datos && Number.isInteger(datos.version) && datos.version !== VERSION) throw new Error('eje de la versión ' + datos.version + '; esta es la ' + VERSION);
  if (!datos || datos.version !== VERSION || !Array.isArray(datos.eventos) || !datos.eventos.length) throw new Error('datos de eje inválidos');
  return Eje.desde(datos.eventos, { exigirFirmas: Boolean(datos.exigirFirmas), eventosV2: prefijoV2(datos) });
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
