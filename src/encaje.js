// Encaje: una dirección puede tener varios ocupantes, y las colisiones se
// quieren, no se evitan. Una dirección de diez dígitos con ceros finales
// nombra a la vez la posición «1», la «1.0», la «1.0.0»…: todas ocupan el
// mismo lugar. Ocupan también lo que alcanza una referencia (sin copiar) y
// lo que otros han escrito en esa dirección. Se ordenan sin borrar
// alternativas; cada ocupante lleva su procedencia y su camino exacto de
// índices. El árbol lógico se reconstruye desde los eventos; no se guarda.

import { ARIDAD, esReferencia, direccion, indicesDe, resolver } from './btml.js';

const MAX_SALTOS = 20;

/**
 * Caminos de índices que una dirección nombra dentro de un payload: el
 * camino base (ceros finales fuera) y, mientras el nodo sea un array con
 * posición 0, los caminos con un cero más. Todos colisionan en la dirección.
 */
export function caminosDe(payload, dir) {
  const base = indicesDe(dir);
  const caminos = [];
  let nodo = payload;
  for (const i of base) {
    if (!Array.isArray(nodo) || nodo[i] === undefined) return caminos;
    nodo = nodo[i];
  }
  const camino = [...base];
  for (;;) {
    caminos.push({ indices: [...camino], contenido: nodo });
    if (!Array.isArray(nodo) || nodo[0] === undefined || camino.length >= ARIDAD) break;
    nodo = nodo[0];
    camino.push(0);
  }
  return caminos;
}

/**
 * Ocupantes de la dirección que nombran `indices` en el registro `id`, en orden:
 * 1. propio: cada camino del payload que colisiona en esa dirección;
 * 2. referencia: tras cada propio que es una referencia, lo que alcanza (con la cadena de procedencia);
 * 3. escritos: los registros anclados en esa dirección (`sobre` + `en`), por orden de entrada.
 */
export function ocupantes(eje, id, indices) {
  const ev = eje.obtener(id);
  if (!ev) throw new Error('registro desconocido: ' + id);
  const dir = direccion(indices);
  const lista = [];
  for (const c of caminosDe(ev.payload, dir)) {
    lista.push({ origen: 'propio', evento: id, dir, camino: c.indices, contenido: c.contenido, procedencia: [id + ':' + dir + '#' + c.indices.join('.')] });
    if (esReferencia(c.contenido)) lista.push(seguir(eje, c.contenido, [id + ':' + dir + '#' + c.indices.join('.')]));
  }
  for (const h of eje.sobre(id, dir)) {
    lista.push({ origen: 'escrito', evento: h.id, dir: '0000000000', camino: [], contenido: h.payload, autor: h.autor, t: h.t, procedencia: [h.id + ':0000000000'] });
  }
  return lista;
}

/** Sigue una referencia hasta un contenido que no sea referencia. Conserva la procedencia. */
export function seguir(eje, ref, procedencia = []) {
  let actual = ref;
  const cadena = [...procedencia];
  for (let salto = 0; salto < MAX_SALTOS; salto++) {
    const ev = eje.obtener(actual.ref);
    const dir = actual.dir ?? '0000000000';
    if (!ev) return { origen: 'referencia', evento: actual.ref, dir, camino: indicesDe(dir), contenido: undefined, procedencia: cadena, rota: true };
    cadena.push(actual.ref + ':' + dir);
    const contenido = resolver(ev.payload, dir);
    if (!esReferencia(contenido)) return { origen: 'referencia', evento: actual.ref, dir, camino: indicesDe(dir), contenido, procedencia: cadena };
    actual = contenido;
  }
  const dir = actual.dir ?? '0000000000';
  return { origen: 'referencia', evento: actual.ref, dir, camino: indicesDe(dir), contenido: undefined, procedencia: cadena, rota: true };
}

/**
 * Árbol lógico del registro `id`: por cada dirección desarrollada (hasta
 * diez profundidades) sus ocupantes, colisiones incluidas. Devuelve un Map
 * dir → ocupantes. Incluye las direcciones donde solo hay escritos.
 */
export function arbol(eje, id, { profundidad = ARIDAD } = {}) {
  const ev = eje.obtener(id);
  if (!ev) throw new Error('registro desconocido: ' + id);
  const mapa = new Map();
  const visitar = (indices, nodo) => {
    if (indices.length > profundidad) return;
    const dir = direccion(indices);
    if (!mapa.has(dir)) mapa.set(dir, ocupantes(eje, id, indices));
    if (Array.isArray(nodo)) nodo.forEach((hijo, i) => visitar([...indices, i], hijo));
  };
  visitar([], ev.payload);
  for (const h of eje.sobre(id)) {
    if (!mapa.has(h.en)) mapa.set(h.en, ocupantes(eje, id, indicesDe(h.en)));
  }
  return mapa;
}

/** Direcciones con más de un ocupante: las colisiones del árbol. */
export function colisiones(mapa) {
  return [...mapa.entries()].filter(([, oc]) => oc.length > 1).map(([dir, oc]) => ({ dir, ocupantes: oc }));
}

/** Texto de un ocupante para mostrarlo: su representación si es array, su valor si es terminal. */
export function caminoDe(o) {
  return o.camino ?? indicesDe(o.dir);
}
