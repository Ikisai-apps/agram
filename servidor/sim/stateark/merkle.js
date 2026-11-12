// Árbol de Merkle sobre ids de AGRAM.
//
// - Hoja: SHA-256(0x00 ‖ id). Nodo: SHA-256(0x01 ‖ izquierda ‖ derecha). Separar hoja y nodo impide
//   presentar un nodo interno como si fuera un id.
// - Si un nivel tiene un número impar de nodos, el último sube tal cual (no se duplica: duplicarlo
//   permite dos listas distintas con la misma raíz).
// - El camino va de la hoja a la raíz: cada paso es [lado, hermano], con lado "i" si el hermano va a
//   la izquierda y "d" si va a la derecha.

import { sha256Etiquetado } from './hash.js';

const HOJA = 0x00;
const NODO = 0x01;

export const hoja = (id) => sha256Etiquetado(HOJA, id);
const nodo = (izq, der) => sha256Etiquetado(NODO, izq, der);

/** Construye el árbol de una lista de ids (ya ordenada y sin repetidos). Devuelve { raiz, caminos: Map id → camino }. */
export async function arbol(ids) {
  if (ids.length === 0) throw new RangeError('un lote vacío no tiene raíz');
  let nivel = await Promise.all(ids.map(hoja));
  // indices[k] = posición en el nivel actual de la hoja k
  const indices = ids.map((_, k) => k);
  const caminos = ids.map(() => []);
  while (nivel.length > 1) {
    const siguiente = [];
    for (let p = 0; p < nivel.length; p += 2) {
      if (p + 1 < nivel.length) siguiente.push(await nodo(nivel[p], nivel[p + 1]));
      else siguiente.push(nivel[p]);
    }
    for (let k = 0; k < ids.length; k++) {
      const pos = indices[k];
      const par = pos ^ 1;
      if (par < nivel.length) caminos[k].push(pos % 2 === 0 ? ['d', nivel[par]] : ['i', nivel[par]]);
      indices[k] = pos >> 1;
    }
    nivel = siguiente;
  }
  return { raiz: nivel[0], caminos: new Map(ids.map((id, k) => [id, caminos[k]])) };
}

/** Recalcula la raíz desde un id y su camino. Devuelve null si el camino está mal formado. */
export async function raizDesde(id, camino) {
  if (!Array.isArray(camino)) return null;
  let actual = await hoja(id);
  for (const paso of camino) {
    if (!Array.isArray(paso) || paso.length !== 2) return null;
    const [lado, hermano] = paso;
    if (typeof hermano !== 'string' || !/^[0-9a-f]{64}$/.test(hermano)) return null;
    if (lado === 'i') actual = await nodo(hermano, actual);
    else if (lado === 'd') actual = await nodo(actual, hermano);
    else return null;
  }
  return actual;
}
