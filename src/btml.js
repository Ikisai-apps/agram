// BTML: payload de un evento. Un terminal o un array posicional de hasta diez
// posiciones, sin nulos ni huecos. Las posiciones contienen terminales,
// subarrays o referencias a otros eventos. Las referencias no copian.

export const ARIDAD = 10;

/**
 * Referencia a otro evento: exactamente { ref } o { ref, dir }, como claves
 * propias, con dir una dirección de diez dígitos. Nada más viaja dentro: las
 * referencias no copian.
 */
export function esReferencia(x) {
  if (x === null || typeof x !== 'object' || Array.isArray(x)) return false;
  const claves = Object.keys(x);
  if (!claves.includes('ref') || !claves.every((k) => k === 'ref' || k === 'dir')) return false;
  return typeof x.ref === 'string' && x.ref.length > 0 && (!claves.includes('dir') || esDireccion(x.dir));
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
 * Un array debe tener entre 1 y 10 posiciones, ninguna nula ni vacía. Una
 * posición ausente (un array disperso de JavaScript, como ['a', , 'c'])
 * también es un hueco, igual que null: si se usa el índice 3, los índices 0,
 * 1 y 2 tienen contenido real. Un array vacío o de más de diez se rechaza sin
 * mirar dentro, así que el coste nunca pasa de diez posiciones por nivel y
 * una ruta no se confunde: '10' es siempre la posición 1, subposición 0. Un
 * array que se contiene a sí mismo no es un árbol: «ciclo».
 */
export function validarPayload(payload, ruta = '', ancestros = new Set()) {
  const errores = [];
  const aqui = ruta || 'raíz';
  if (esTerminal(payload)) return { ok: true, errores };
  if (!Array.isArray(payload)) {
    errores.push(aqui + ': ni terminal ni array');
    return { ok: false, errores };
  }
  if (ancestros.has(payload)) {
    errores.push(aqui + ': ciclo');
    return { ok: false, errores };
  }
  // La longitud primero, y se sale: un array disperso puede declarar una
  // longitud enorme sin contenido, y no se recorre.
  if (payload.length === 0) {
    errores.push(aqui + ': array vacío');
    return { ok: false, errores };
  }
  if (payload.length > ARIDAD) {
    errores.push(aqui + ': más de ' + ARIDAD + ' posiciones');
    return { ok: false, errores };
  }
  ancestros.add(payload);
  // Un for hasta ARIDAD como mucho, no forEach: forEach se salta las
  // posiciones ausentes y las daría por buenas.
  for (let i = 0; i < payload.length; i++) {
    const r = ruta + i;
    if (!(i in payload) || payload[i] === null || payload[i] === undefined) {
      errores.push(r + ': hueco');
      continue;
    }
    errores.push(...validarPayload(payload[i], r, ancestros).errores);
  }
  ancestros.delete(payload);
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
