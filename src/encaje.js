// Encaje: una posición puede tener varios ocupantes. Lo propio del registro,
// lo que alcanza una referencia (sin copiar) y lo que otros han escrito en
// esa posición. Se ordenan sin borrar alternativas; las colisiones se
// conservan con su procedencia. El árbol lógico se reconstruye desde los
// eventos; no se guarda.

import { ARIDAD, esReferencia, direccion, indicesDe, resolver, representacion } from './btml.js';

const MAX_SALTOS = 20;

/**
 * Ocupantes de la posición `indices` del registro `id`, en orden:
 * 1. propio: el contenido del propio payload (si está desarrollado);
 * 2. referencia: si lo propio es una referencia, lo que alcanza (con la cadena de procedencia);
 * 3. escritos: los registros anclados en esa posición (`sobre` + `en`), por orden de entrada.
 */
export function ocupantes(eje, id, indices) {
  const ev = eje.obtener(id);
  if (!ev) throw new Error('registro desconocido: ' + id);
  const dir = direccion(indices);
  const lista = [];
  const propio = resolver(ev.payload, dir);
  if (propio !== undefined) {
    lista.push({ origen: 'propio', evento: id, dir, contenido: propio, procedencia: [id + ':' + dir] });
    // Si el nodo, o su representación (posición 0), es una referencia, lo que alcanza también ocupa el lugar.
    const rep = representacion(propio);
    if (esReferencia(rep)) lista.push(seguir(eje, rep, [id + ':' + dir]));
  }
  for (const h of eje.sobre(id, dir)) {
    lista.push({ origen: 'escrito', evento: h.id, dir: '0000000000', contenido: h.payload, autor: h.autor, t: h.t, procedencia: [h.id + ':0000000000'] });
  }
  return lista;
}

/** Sigue una referencia hasta un contenido que no sea referencia. Conserva la procedencia. */
export function seguir(eje, ref, procedencia = []) {
  let actual = ref;
  const cadena = [...procedencia];
  for (let salto = 0; salto < MAX_SALTOS; salto++) {
    const ev = eje.obtener(actual.ref);
    if (!ev) return { origen: 'referencia', evento: actual.ref, dir: actual.dir ?? '0000000000', contenido: undefined, procedencia: cadena, rota: true };
    const dir = actual.dir ?? '0000000000';
    cadena.push(actual.ref + ':' + dir);
    const contenido = resolver(ev.payload, dir);
    if (!esReferencia(contenido)) return { origen: 'referencia', evento: actual.ref, dir, contenido, procedencia: cadena };
    actual = contenido;
  }
  return { origen: 'referencia', evento: actual.ref, dir: actual.dir ?? '0000000000', contenido: undefined, procedencia: cadena, rota: true };
}

/**
 * Árbol lógico del registro `id`: por cada posición desarrollada (hasta
 * diez profundidades) sus ocupantes. Devuelve un Map dir → ocupantes.
 * Incluye las posiciones donde solo hay escritos (sin contenido propio).
 */
export function arbol(eje, id, { profundidad = ARIDAD } = {}) {
  const ev = eje.obtener(id);
  if (!ev) throw new Error('registro desconocido: ' + id);
  const mapa = new Map();
  const escritosPorDir = new Map();
  for (const h of eje.sobre(id)) {
    if (!escritosPorDir.has(h.en)) escritosPorDir.set(h.en, []);
    escritosPorDir.get(h.en).push(h);
  }
  const visitar = (indices, nodo) => {
    if (indices.length > profundidad) return;
    // La posición 0 es la representación del nodo padre: la nombra la misma dirección.
    if (indices.length && indices[indices.length - 1] !== 0) mapa.set(direccion(indices), ocupantes(eje, id, indices));
    if (Array.isArray(nodo)) nodo.forEach((hijo, i) => visitar([...indices, i], hijo));
  };
  visitar([], ev.payload);
  for (const dir of escritosPorDir.keys()) {
    if (!mapa.has(dir) && dir !== '0000000000') mapa.set(dir, ocupantes(eje, id, indicesDe(dir)));
  }
  return mapa;
}

/** Posiciones con más de un ocupante: las colisiones del árbol. */
export function colisiones(mapa) {
  return [...mapa.entries()].filter(([, oc]) => oc.length > 1).map(([dir, oc]) => ({ dir, ocupantes: oc }));
}
