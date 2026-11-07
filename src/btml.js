// BTML: payload de un evento. Un terminal o un array posicional de hasta diez
// posiciones, sin nulos ni huecos. Las posiciones contienen terminales,
// subarrays o referencias a otros eventos. Las referencias no copian.
//
// Décupla y lista, POR HOJAS (VG, 7-11 noche: por hojas). Una hoja es un
// terminal o una referencia. Dentro de una posición:
// - un array cuyos elementos son TODOS hojas es una LISTA: cada elemento es
//   un ocupante de esa posición, con la llegada y el encaje del evento y en
//   el orden de la lista; sin tope de diez (el tope por evento lo pone el
//   modo, que cuenta cada elemento). Se alcanza por índice (encaje.lista,
//   BUSCAR(n, k), LOCAL), nunca por dirección: la lista está fuera de los
//   dígitos («profundidad 11»);
// - un array con al menos un array dentro es una DÉCUPLA: sus índices 0–9
//   son las subposiciones (los PV aplicados al nodo de arriba) y una
//   dirección las nombra dígito a dígito. Dentro de una décupla, una hoja
//   suelta es UN solo ocupante de esa subposición.
// El payload RAÍZ es siempre la décupla de lo escrito (la cruceta), aunque
// sean solo hojas. Para que un grupo de hojas sea décupla se envuelve su
// posición 0 (qué es): compra 1 = [[menú], 1, 'EUR 12'] → 1.0 qué es (la
// lista de uno [menú]), 1.1 cuánto, 1.2 con qué condición; [menú, 1] sería
// una lista de dos ocupantes.

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

/** Hoja: un terminal o una referencia (esTerminal ya incluye las referencias). */
export function esHoja(x) {
  return esTerminal(x);
}

/**
 * Lista, fuera de la raíz (VG, 7-11 noche: por hojas): un array no vacío
 * cuyos elementos son todos hojas. En la raíz, el mismo array es la décupla
 * de lo escrito (la cruceta): quien lee sabe en qué profundidad está.
 */
export function esLista(x) {
  return Array.isArray(x) && x.length > 0 && x.every(esHoja);
}

/** Décupla: un array con al menos un array dentro (fuera de la raíz; la raíz siempre lo es). */
export function esDecupla(x) {
  return Array.isArray(x) && x.some((h) => Array.isArray(h));
}

/** Dirección BTML: siempre una cadena de exactamente diez dígitos. */
export function esDireccion(s) {
  return typeof s === 'string' && /^[0-9]{10}$/.test(s);
}

/**
 * Valida un payload. Devuelve { ok, errores } con rutas legibles.
 * Un array debe tener al menos una posición, ninguna nula ni vacía. Una
 * posición ausente (un array disperso de JavaScript, como ['a', , 'c'])
 * también es un hueco, igual que null: si se usa el índice 3, los índices 0,
 * 1 y 2 tienen contenido real. Un array que se contiene a sí mismo no es un
 * árbol: «ciclo».
 *
 * Por hojas (VG, 7-11 noche): la raíz y toda décupla (un array con algún
 * array dentro) tienen como mucho diez posiciones, y una ruta no se
 * confunde: '10' es siempre la posición 1, subposición 0. Una lista (fuera
 * de la raíz, un array solo de hojas) no tiene tope de diez: el tope por
 * evento lo pone el modo (modos.cabeTope cuenta cada elemento). Un array de
 * más de diez que no es una lista se rechaza sin recorrerlo entero, y uno
 * disperso, sin recorrer su longitud (se cuentan sus claves presentes).
 * Dentro de una lista no hay listas: es solo de hojas.
 */
export function validarPayload(payload, ruta = '', ancestros = new Set(), raiz = true) {
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
    // Solo una lista (fuera de la raíz) pasa de diez. Las claves presentes no
    // cuestan más que el contenido real: un disperso se para aquí.
    if (raiz) errores.push(aqui + ': más de ' + ARIDAD + ' posiciones');
    else if (Object.keys(payload).length !== payload.length || payload.some((h) => h === null || h === undefined)) errores.push(aqui + ': hueco en la lista');
    else if (!payload.every(esHoja)) errores.push(aqui + ': más de ' + ARIDAD + ' posiciones (una décupla; solo una lista de hojas pasa de diez)');
    return { ok: errores.length === 0, errores };
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
    errores.push(...validarPayload(payload[i], r, ancestros, false).errores);
  }
  ancestros.delete(payload);
  return { ok: errores.length === 0, errores };
}

/**
 * Construye una dirección de diez dígitos a partir de índices de profundidad.
 * Los ceros finales marcan que no se ha descendido más. Los índices son
 * dígitos de décuplas: una dirección nunca nombra un elemento de una lista
 * (que va por índice de llegada, fuera de los dígitos).
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
 * no se puede nombrar un índice 0 real que sea el último del camino. Son
 * subposiciones de décuplas, nunca elementos de una lista.
 */
export function indicesDe(dir) {
  if (!esDireccion(dir)) throw new TypeError('dirección de diez dígitos');
  return dir.replace(/0+$/, '').split('').map(Number);
}

/**
 * Resuelve una dirección sobre un payload descendiendo por los índices reales.
 * Devuelve undefined si el camino atraviesa un terminal o una posición ausente.
 * Por hojas (VG, 7-11 noche): una lista (fuera de la raíz) se devuelve entera
 * en su propia dirección; una dirección que siga DENTRO de ella no existe y
 * da undefined, lo mismo que una posición vacía: las direcciones nunca
 * nombran ocupantes de una lista (dentroDeLista dice si es el caso).
 */
export function resolver(payload, dir) {
  let nodo = payload;
  const indices = indicesDe(dir);
  for (let p = 0; p < indices.length; p++) {
    if (!Array.isArray(nodo) || indices[p] >= nodo.length || (p > 0 && esLista(nodo))) return undefined;
    nodo = nodo[indices[p]];
  }
  return nodo;
}

/**
 * Si un camino de dígitos (una dirección o sus índices) entra en una lista
 * del payload: devuelve el camino de la posición que tiene la lista (p. ej.
 * [1] para la 1.2 si la 1 es una lista), o null si no pasa por ninguna. La
 * raíz no es una lista, y la propia posición de la lista no cuenta: ahí la
 * dirección nombra la lista entera.
 */
export function dentroDeLista(payload, dirOIndices) {
  const indices = Array.isArray(dirOIndices) ? dirOIndices : indicesDe(dirOIndices);
  let nodo = payload;
  for (let p = 0; p < indices.length; p++) {
    if (p > 0 && esLista(nodo)) return indices.slice(0, p);
    if (!Array.isArray(nodo)) return null;
    nodo = nodo[indices[p]];
  }
  return null;
}

/** Nodo del payload en un camino de dígitos, bajando solo por la raíz y por décuplas (undefined si se sale o entra en una lista). */
export function nodoEn(payload, indices) {
  let nodo = payload;
  for (let p = 0; p < indices.length; p++) {
    if (!Array.isArray(nodo) || (p > 0 && esLista(nodo))) return undefined;
    nodo = nodo[indices[p]];
  }
  return nodo;
}
