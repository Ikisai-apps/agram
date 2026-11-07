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
 * Vector de diez diferencias con signo: destino menos origen, dígito a
 * dígito. Todo ceros = encaje exacto. El signo es la dirección del flujo en
 * la cruceta: negativo, el candidato viene leyendo (de la cruz a la X);
 * positivo, viene escribiendo (de la X a la cruz). El cero de orientación es
 * el tercer cero: ninguna diferencia en esa profundidad.
 */
export function vector(origen, destino) {
  const o = indicesCompletos(origen);
  const d = indicesCompletos(destino);
  return d.map((x, k) => x - o[k]);
}

function indicesCompletos(dir) {
  if (!/^[0-9]{10}$/.test(dir)) throw new TypeError('dirección de diez dígitos');
  return dir.split('').map(Number);
}

/** Profundidades de acuerdo: cuántos ceros seguidos desde la profundidad 0. */
export function acuerdo(v) {
  let n = 0;
  while (n < v.length && v[n] === 0) n++;
  return n;
}

/** Suma de los valores absolutos: cuánto se desplaza en total. */
export function norma(v) {
  return v.reduce((s, x) => s + Math.abs(x), 0);
}

/** Sentido del flujo: exacto, lectura (cruz → X) o escritura (X → cruz), por la primera diferencia. */
export function sentido(v) {
  const primera = v.find((x) => x !== 0);
  return primera === undefined ? 'exacto' : primera < 0 ? 'lectura' : 'escritura';
}

/**
 * Orden por encaje, sin borrar nada: exactos primero; luego más profundidades
 * de acuerdo; luego menor desplazamiento; los empates conservan la llegada.
 * El sentido no ordena: agrupa, y el criterio (PV2) puede tratarlo distinto.
 */
export function ordenarPorEncaje(lista) {
  return lista
    .map((o, i) => ({ o, i }))
    .sort((a, b) => (acuerdo(b.o.vector) - acuerdo(a.o.vector)) || (norma(a.o.vector) - norma(b.o.vector)) || (a.i - b.i))
    .map((x) => x.o);
}

function conEncaje(o, destino) {
  // Para un ocupante por referencia, el origen es la dirección alcanzada en el otro registro.
  const origenDir = o.tipo === 'referencia' ? o.dir : o.origen;
  const v = vector(origenDir, destino);
  return { ...o, origenDir, destino, vector: v, acuerdo: acuerdo(v), sentido: sentido(v) };
}

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
 * Ocupantes de la dirección que nombran `indices` en el registro `id`:
 * 1. propio: cada camino del payload que colisiona en esa dirección;
 * 2. referencia: tras cada propio que es una referencia, lo que alcanza (con la cadena de procedencia);
 * 3. escritos: los registros anclados en esa dirección (`sobre` + `en`).
 * Cada ocupante lleva su origen (la dirección de donde viene), su destino
 * (la dirección donde se le coloca), el vector de diferencias, las
 * profundidades de acuerdo y el sentido. Orden por defecto: por encaje;
 * con { orden: 'llegada' }, el de llegada. Nada se borra.
 */
export function ocupantes(eje, id, indices, { orden = 'encaje' } = {}) {
  const ev = eje.obtener(id);
  if (!ev) throw new Error('registro desconocido: ' + id);
  const dir = direccion(indices);
  const lista = [];
  for (const c of caminosDe(ev.payload, dir)) {
    lista.push(conEncaje({ tipo: 'propio', evento: id, dir, camino: c.indices, contenido: c.contenido, origen: dir, procedencia: [id + ':' + dir + '#' + c.indices.join('.')] }, dir));
    if (esReferencia(c.contenido)) lista.push(conEncaje(seguir(eje, c.contenido, [id + ':' + dir + '#' + c.indices.join('.')]), dir));
  }
  for (const h of eje.sobre(id, dir)) {
    lista.push(conEncaje({ tipo: 'escrito', evento: h.id, dir: '0000000000', camino: [], contenido: h.payload, autor: h.autor, t: h.t, origen: '0000000000', procedencia: [h.id + ':0000000000'] }, dir));
  }
  const conOrigen = lista.map((o) => ({ ...o, origen: o.tipo }));
  return orden === 'llegada' ? conOrigen : ordenarPorEncaje(conOrigen);
}

/** Sigue una referencia hasta un contenido que no sea referencia. Conserva la procedencia. */
export function seguir(eje, ref, procedencia = []) {
  let actual = ref;
  const cadena = [...procedencia];
  for (let salto = 0; salto < MAX_SALTOS; salto++) {
    const ev = eje.obtener(actual.ref);
    const dir = actual.dir ?? '0000000000';
    if (!ev) return { tipo: 'referencia', origen: 'referencia', evento: actual.ref, dir, camino: indicesDe(dir), contenido: undefined, procedencia: cadena, rota: true };
    cadena.push(actual.ref + ':' + dir);
    const contenido = resolver(ev.payload, dir);
    if (!esReferencia(contenido)) return { tipo: 'referencia', origen: 'referencia', evento: actual.ref, dir, camino: indicesDe(dir), contenido, procedencia: cadena };
    actual = contenido;
  }
  const dir = actual.dir ?? '0000000000';
  return { tipo: 'referencia', origen: 'referencia', evento: actual.ref, dir, camino: indicesDe(dir), contenido: undefined, procedencia: cadena, rota: true };
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
