// Evento: la unidad de información. Es una transición de tokens con un payload
// BTML encima. Se anida sobre el registro en foco (hijo → padre); los hilos son
// cadenas de eventos encadenados por esa referencia.

import { ARIDAD, validarPayload, esDireccion, esHoja } from './btml.js';
import { validarMovimiento, ESCALAS_INFORMATIVAS } from './tokens.js';
import { esInstante } from './instante.js';

/** Posición raíz del foco: el registro entero. */
export const RAIZ = '0000000000';

/**
 * JSON canónico: claves ordenadas, sin espacios, con la semántica de JSON
 * (lo que se hashea es lo que se guarda): una clave con undefined o con una
 * función no está, un undefined en un array es null y toJSON se respeta. Así
 * el id de un evento no cambia al pasar por JSON.
 */
export function canonico(valor) {
  return ordenado(aJSON(valor));
}

function ordenado(valor) {
  if (Array.isArray(valor)) return '[' + valor.map(ordenado).join(',') + ']';
  if (valor !== null && typeof valor === 'object') {
    const claves = Object.keys(valor).sort();
    return '{' + claves.map((k) => JSON.stringify(k) + ':' + ordenado(valor[k])).join(',') + '}';
  }
  return JSON.stringify(valor);
}

/** El valor tal como queda tras guardarlo en JSON. Lanza si no cabe en JSON (ciclos, BigInt). */
export function aJSON(valor) {
  const texto = JSON.stringify(valor);
  return texto === undefined ? null : JSON.parse(texto);
}

/**
 * Congela en profundidad un valor JSON propio (una copia: no toca lo que pasó
 * quien escribe): payload, movimientos y contexto incluidos. No existe
 * modificar en sitio: corregir es añadir un ocupante, también en memoria.
 * Devuelve el mismo objeto.
 */
export function congelar(x) {
  if (x !== null && typeof x === 'object') {
    for (const v of Object.values(x)) congelar(v);
    Object.freeze(x);
  }
  return x;
}

/**
 * Copia de un evento tal como se guarda: solo sus campos (los del cuerpo, el
 * id y, si va firmado, firmante y firma; en un alta, las pruebas de posesión
 * de las claves que declara, `posesion`), con `en` y `contexto` por defecto,
 * pasada por JSON y congelada en profundidad. El eje guarda esta copia y no
 * el objeto que le pasan: lo que llegue de más no entra, y mutar lo pasado
 * después no cambia nada. Lanza si no cabe en JSON.
 */
export function normalizarEvento(ev) {
  if (!ev || typeof ev !== 'object') return ev;
  const { autor, sobre, en, t, movimientos, payload, contexto, id, firmante, firma, posesion } = ev;
  // El mismo orden de campos que crearEvento y firmar: guardar y restaurar da los mismos bytes.
  return congelar(aJSON({ autor, sobre, en: en === undefined ? RAIZ : en, t, movimientos, payload, contexto: contexto ?? {}, id, firmante, firma, posesion }));
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
 * Ruta y motivo del primer array del payload que no cabe, o null. Mira la
 * longitud sin recorrerla ni pasar por JSON: JSON.stringify recorre la
 * longitud entera, y un array disperso puede declarar 2^32 − 1 posiciones
 * vacías. La raíz y las décuplas tienen como mucho diez posiciones; una
 * lista (fuera de la raíz, solo hojas: VG, 7-11 noche, por hojas) puede
 * pasar de diez, pero sin huecos: se cuentan sus claves presentes, que no
 * cuestan más que su contenido real. Solo baja por las posiciones presentes
 * de los arrays que caben.
 */
function arrayDemasiadoLargo(x, ruta = '', ancestros = new Set()) {
  if (!Array.isArray(x) || ancestros.has(x)) return null;
  if (x.length > ARIDAD) {
    const aqui = ruta || 'raíz';
    if (!ruta) return aqui + ': más de ' + ARIDAD + ' posiciones';
    if (Object.keys(x).length !== x.length || x.some((h) => h === null || h === undefined)) return aqui + ': hueco en la lista';
    return x.every(esHoja) ? null : aqui + ': más de ' + ARIDAD + ' posiciones';
  }
  ancestros.add(x);
  for (let i = 0; i < x.length; i++) {
    if (!(i in x)) continue;
    const r = arrayDemasiadoLargo(x[i], ruta + i, ancestros);
    if (r !== null) return r;
  }
  ancestros.delete(x);
  return null;
}

/**
 * Crea un evento con su id = hash del cuerpo canónico.
 * autor: identidad que escribe. sobre: id del registro en foco (null solo en génesis).
 * en: posición del foco donde se anida lo escrito (dirección de diez dígitos; raíz por defecto).
 * Lo escrito va en el PV donde se escribe (VG, 6-11-2026).
 * t: instante ISO. movimientos: lista de movimientos de tokens. payload: BTML.
 * Se valida, se hashea y se devuelve la copia en JSON de lo pasado (lo que se
 * guardará), congelada en profundidad: quien lo crea puede seguir usando sus
 * arrays, y el evento no cambia. Un array de más de diez posiciones en el
 * payload (salvo una lista de hojas) se rechaza antes de copiar, sin
 * recorrer su longitud.
 */
export async function crearEvento({ autor, sobre = null, en = RAIZ, t, movimientos, payload, contexto = {} }) {
  const largo = arrayDemasiadoLargo(payload);
  if (largo !== null) throw new Error('evento mal formado: payload ' + largo);
  let ev;
  try {
    ev = aJSON({ autor, sobre, en, t, movimientos, payload, contexto });
  } catch (e) {
    throw new Error('evento mal formado: no cabe en JSON (' + e.message + ')');
  }
  const errores = validarForma(ev);
  if (errores.length) throw new Error('evento mal formado: ' + errores.join('; '));
  ev.id = await hash(canonico(cuerpo(ev)));
  return congelar(ev);
}

/**
 * Validación de forma, sin mirar el eje. `t` es un instante ISO-8601 estricto
 * con zona explícita (src/instante.js). Con `tLaxo` basta con que Date.parse
 * lo lea: solo para los eventos de un eje guardado con la versión 2, que se
 * validan con las reglas de entonces (`v2`, que por defecto sigue a `tLaxo`:
 * entonces bastaba con que el autor moviese T, y T se daba a otros).
 */
export function validarForma(ev, { tLaxo = false, v2 = tLaxo } = {}) {
  if (!ev || typeof ev !== 'object') return ['evento no es objeto'];
  const errores = [];
  if (typeof ev.autor !== 'string' || !ev.autor) errores.push('autor obligatorio');
  if (ev.sobre !== null && typeof ev.sobre !== 'string') errores.push('sobre debe ser id o null');
  if (ev.en !== undefined && !esDireccion(ev.en)) errores.push('en debe ser una dirección de diez dígitos');
  if (ev.sobre === null && ev.en !== undefined && ev.en !== RAIZ) errores.push('el génesis solo se anida en la raíz');
  if (tLaxo ? typeof ev.t !== 'string' || Number.isNaN(Date.parse(ev.t)) : !esInstante(ev.t)) {
    errores.push('t debe ser instante ISO-8601 con zona explícita (AAAA-MM-DDThh:mm[:ss[.fff]] y Z o ±hh:mm)');
  }
  if (!Array.isArray(ev.movimientos) || (ev.movimientos.length === 0 && !(ev.contexto?.genesis === true && !v2))) {
    // El génesis puede no emitir nada (VG, 8-11: no emite T; E, P y R, si quiere).
    errores.push('todo evento mueve tokens');
  } else {
    ev.movimientos.forEach((m, i) => validarMovimiento(m).forEach((e) => errores.push('movimiento ' + i + ': ' + e)));
    // El evento mínimo mueve T: lo CONSUME (VG, 7-11 noche): de = autor, a =
    // null, sin estado. Ni dárselo a uno mismo cuenta como escribir: no cuesta
    // nada. El consumo queda anotado en el registro que soporta, `sobre`
    // (eje.tiempoSobre). El génesis no emite T (VG, 8-11: no hay T
    // acumulable): su autor vive de su asignación del día; solo en la versión
    // 2 el génesis tenía que emitir T a su autor.
    const esGenesis = ev.contexto?.genesis === true;
    // La FORMA solo pide un consumo de T del autor (cualquiera); que sea T real y llegue al coste lo exige la condición
    // «writing burns today's T» de la época (VG, 13-11, #76): el T informativo (pasado, futuro, inventado) ya no paga la
    // escritura, es contenido del registro. Aquí no se distingue (la forma no sabe de la época).
    const cuenta = (m) => (esGenesis ? m.a === ev.autor : v2 ? m.de === ev.autor : esConsumoT(m, ev.autor));
    const mueveT = ev.movimientos.some((m) => m && m.token === 'T' && cuenta(m));
    if (!mueveT && !(esGenesis && !v2)) {
      errores.push(esGenesis ? 'el génesis debe emitir T al autor'
        : v2 ? 'el autor debe mover T' : 'escribir consume T del autor: un movimiento de T con de = ' + ev.autor + ' y a = null (VG, 7-11 noche)');
    }
    // T no cruza de persona (VG, 7-11 noche) lo comprueban las reglas del
    // ciclo (src/ciclo.js), que saben de qué tipo es quien lo recibe: una
    // persona sí puede dar su T a una cosa (Core, 8-11).
  }
  if (ev.contexto !== undefined && ev.contexto !== null && (typeof ev.contexto !== 'object' || Array.isArray(ev.contexto))) {
    errores.push('contexto debe ser un objeto');
  }
  // Pruebas de posesión de un alta (R9): { identidad: firma de su clave nueva sobre el id }.
  if (ev.posesion !== undefined && (ev.posesion === null || typeof ev.posesion !== 'object' || Array.isArray(ev.posesion)
    || Object.values(ev.posesion).some((f) => typeof f !== 'string'))) {
    errores.push('posesion debe ser un objeto { identidad: firma }');
  }
  const p = validarPayload(ev.payload);
  if (!p.ok) errores.push(...p.errores.map((e) => 'payload ' + e));
  return errores;
}

/**
 * ¿Es `m` un consumo de T de `autor`? De = autor, a = null y sin estado: lo
 * único que cuenta como «escribir consume T» (VG, 7-11 noche).
 */
export function esConsumoT(m, autor) {
  return Boolean(m) && m.token === 'T' && m.de === autor && m.a === null && m.estado === undefined;
}

/**
 * ¿Es `ev` un registro presente? Sí si su autor consume T real (una escala no
 * informativa) o si es el génesis. Un evento que solo quemara T informativo
 * (pasado, futuro, inventado) no es presente (VG, 8-11). Desde VG 13-11 (#76: «recordar
 * algo o planear algo consume tiempo en el presente») la época 0 ya no admite uno
 * así: la condición «writing burns today's T» exige el coste en T real de hoy a todo
 * registro, así que todo registro del libro es presente; la función queda como la
 * lectura pura del evento. Se deriva del evento, no se guarda: no cambia su id.
 */
export function esPresente(ev) {
  if (!ev || typeof ev !== 'object' || ev.contexto?.genesis === true) return true;
  return (Array.isArray(ev.movimientos) ? ev.movimientos : []).some((m) => esConsumoT(m, ev.autor) && !ESCALAS_INFORMATIVAS.includes(m.escala));
}

/** Comprueba que el id corresponde al cuerpo. */
export async function verificarId(ev) {
  return ev.id === (await hash(canonico(cuerpo(ev))));
}
