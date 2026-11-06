// BTML: payload de un evento. Un terminal o un array posicional de hasta diez
// posiciones, sin nulos ni huecos. Las posiciones contienen terminales,
// subarrays o referencias a otros eventos. Las referencias no copian.

export const ARIDAD = 10;

/** Referencia a otro evento, con subposición opcional de diez dígitos. */
export function esReferencia(x) {
  return (
    x !== null &&
    typeof x === 'object' &&
    !Array.isArray(x) &&
    typeof x.ref === 'string' &&
    x.ref.length > 0 &&
    (x.dir === undefined || esDireccion(x.dir))
  );
}

/** Terminal: número finito, cadena no vacía o referencia. */
export function esTerminal(x) {
  if (typeof x === 'number') return Number.isFinite(x);
  if (typeof x === 'string') return x.length > 0;
  return esReferencia(x);
}

/** Dirección BTML: siempre una cadena de exactamente diez dígitos. */
export function esDireccion(s) {
  return typeof s === 'string' && /^[0-9]{10}$/.test(s);
}

/**
 * Valida un payload. Devuelve { ok, errores } con rutas legibles.
 * Un array debe tener entre 1 y 10 posiciones, ninguna nula ni vacía.
 */
export function validarPayload(payload, ruta = '') {
  const errores = [];
  const aqui = ruta || 'raíz';
  if (esTerminal(payload)) return { ok: true, errores };
  if (!Array.isArray(payload)) {
    errores.push(aqui + ': ni terminal ni array');
    return { ok: false, errores };
  }
  if (payload.length === 0) errores.push(aqui + ': array vacío');
  if (payload.length > ARIDAD) errores.push(aqui + ': más de ' + ARIDAD + ' posiciones');
  payload.forEach((hijo, i) => {
    const r = ruta + i;
    if (hijo === null || hijo === undefined) {
      errores.push(r + ': hueco');
      return;
    }
    errores.push(...validarPayload(hijo, r).errores);
  });
  return { ok: errores.length === 0, errores };
}

/**
 * Construye una dirección de diez dígitos a partir de índices de profundidad.
 * Los ceros finales marcan que no se ha descendido más.
 */
export function direccion(indices) {
  if (!Array.isArray(indices) || indices.length > ARIDAD) {
    throw new RangeError('entre 0 y 10 índices');
  }
  for (const i of indices) {
    if (!Number.isInteger(i) || i < 0 || i > 9) throw new RangeError('índice inválido: ' + i);
  }
  return indices.join('').padEnd(ARIDAD, '0');
}

/**
 * Índices reales de una dirección. Convención del cartón piedra: los ceros
 * FINALES son de representación (no se ha descendido más); un cero seguido de
 * otro dígito es el índice real 0. Punto abierto conocido: con esta convención
 * no se puede nombrar un índice 0 real que sea el último del camino.
 */
export function indicesDe(dir) {
  if (!esDireccion(dir)) throw new TypeError('dirección de diez dígitos');
  return dir.replace(/0+$/, '').split('').map(Number);
}

/**
 * Resuelve una dirección sobre un payload descendiendo por los índices reales.
 * Devuelve undefined si el camino atraviesa un terminal o una posición ausente.
 */
export function resolver(payload, dir) {
  let nodo = payload;
  for (const i of indicesDe(dir)) {
    if (!Array.isArray(nodo) || i >= nodo.length) return undefined;
    nodo = nodo[i];
  }
  return nodo;
}
