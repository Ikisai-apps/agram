// Escritura: el registro de salida según el modo. Se anida sobre el contenido
// del foco (sobre + en) y respeta la proporción de cada modo: Pointed un
// terminal; Sequenced una hilera de hasta diez posiciones; Mapped una décupla
// por PV cuyas celdas vacías se heredan del foco por referencia (las
// referencias no copian), porque un array BTML no admite huecos.
// Coste de cartón piedra: cada posición escrita mueve un minuto de T del autor.

import { ARIDAD, esReferencia, esTerminal, direccion } from './btml.js';
import { cabeEscritura, contarPosiciones, escritura } from './modos.js';
import { RAIZ } from './evento.js';

/** Resuelve un prefijo de id («@25ddaa89») a un id completo del eje. Único o error. */
export function resolverRef(eje, prefijo) {
  const p = prefijo.replace(/^@/, '').toLowerCase();
  if (p.length < 4) throw new Error('referencia demasiado corta: ' + prefijo);
  const ids = eje.orden.filter((id) => id.startsWith(p));
  if (ids.length === 0) throw new Error('referencia desconocida: ' + prefijo);
  if (ids.length > 1) throw new Error('referencia ambigua: ' + prefijo);
  return { ref: ids[0] };
}

/** Un ítem de entrada: texto («@id» es referencia; «@id:1200000000» con subposición) o número. */
export function item(eje, texto) {
  const t = String(texto).trim();
  if (!t) throw new Error('ítem vacío');
  const m = /^@([0-9a-f]{4,64})(?::([0-9]{10}))?$/i.exec(t);
  if (m) return m[2] ? { ...resolverRef(eje, m[1]), dir: m[2] } : resolverRef(eje, m[1]);
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  return t;
}

/** Pointed: un terminal. */
export function desdePointed(eje, texto) {
  const i = item(eje, texto);
  if (!esTerminal(i)) throw new Error('Pointed escribe un terminal');
  return i;
}

/** Sequenced: una hilera de uno a diez ítems, sin huecos. */
export function desdeSequenced(eje, textos) {
  const limpios = textos.map((t) => String(t ?? '').trim());
  while (limpios.length && !limpios[limpios.length - 1]) limpios.pop();
  if (!limpios.length) throw new Error('la hilera está vacía');
  if (limpios.length > ARIDAD) throw new Error('la hilera tiene más de ' + ARIDAD + ' posiciones');
  const hueco = limpios.findIndex((t) => !t);
  if (hueco >= 0) throw new Error('hueco en la posición ' + hueco + ': rellénala o quita las siguientes');
  return limpios.map((t) => item(eje, t));
}

/**
 * Mapped: una décupla por PV. celdas = diez listas de textos (una por PV).
 * Las celdas vacías anteriores a la última escrita se heredan del foco por
 * referencia si el foco tiene esa posición; si no, es un hueco y se rechaza.
 */
export function desdeMapped(eje, celdas, foco, camino = []) {
  const ev = eje.obtener(foco);
  if (!ev) throw new Error('foco desconocido: ' + foco);
  let base = ev.payload;
  for (const i of camino) base = Array.isArray(base) ? base[i] : undefined;
  const listas = Array.from({ length: ARIDAD }, (_, i) => (celdas[i] ?? []).map((t) => String(t ?? '').trim()).filter(Boolean));
  let ultima = -1;
  listas.forEach((l, i) => { if (l.length) ultima = i; });
  if (ultima < 0) throw new Error('la décupla está vacía');
  const payload = [];
  const heredadas = [];
  for (let i = 0; i <= ultima; i++) {
    if (listas[i].length) {
      const items = listas[i].map((t) => item(eje, t));
      payload.push(items.length === 1 ? items[0] : items);
    } else if (Array.isArray(base) ? base[i] !== undefined : i === 0 && base !== undefined) {
      // [X] decidir VG (mapa §13): un foco terminal hereda su raíz en la posición 0,
      // como en main, aunque un terminal no tenga posición 0 en la décupla ni en el mapa (mapa §12).
      payload.push({ ref: foco, dir: direccion([...camino, i]) });
      heredadas.push(i);
    } else {
      throw new Error('hueco en ' + i + ': el foco no tiene esa posición; rellénala o quita las siguientes');
    }
  }
  return { payload, heredadas };
}

/** Minutos de T que mueve un registro: uno por posición escrita. */
export function costeT(payload) {
  return contarPosiciones(payload);
}

/**
 * Escribe el registro de salida de un modo sobre el foco. Comprueba la
 * proporción del modo y mueve T del autor: un minuto por posición.
 */
export async function escribirDesde(eje, { modo, autor, sobre, en = RAIZ, payload, t = new Date().toISOString(), contexto = {} }, privada) {
  if (!cabeEscritura(payload, modo)) {
    const [, max] = escritura(modo);
    throw new Error(modo + ' escribe como mucho ' + max + ' posiciones; este registro tiene ' + contarPosiciones(payload));
  }
  const minutos = costeT(payload);
  return eje.escribir({
    autor,
    sobre,
    en,
    t,
    movimientos: [{ token: 'T', escala: 'minuto', cantidad: minutos, de: autor, a: null }],
    payload,
    contexto: { ...contexto, modo },
  }, privada);
}

export { esReferencia };
