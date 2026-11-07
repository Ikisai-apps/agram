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
 * Vector de diez diferencias con signo (corpus V4): candidato menos buscado,
 * dígito a dígito, un dígito por componente (el ejemplo del corpus: «+2 en el
 * quinto dígito»). Todo ceros = encaje exacto. Positivo: al candidato le
 * sobra en esa profundidad (reducir); negativo: le falta (completar). El
 * signo solo cuenta si la regla corta de esa profundidad hace ordinal al
 * dígito; en la época 0 los dígitos son nominales (cada uno es un PV), así
 * que ni el signo ni la distancia por dígito ordenan: son información.
 * El corpus prohíbe «puntuar por cercanía ciega» y «descartar por mera
 * distancia numérica». Lo que ordena son las coincidencias de ruta (el
 * acuerdo de prefijo) y la llegada. El cero de orientación es el tercer cero.
 * Opción B de docs/notas/SIGNO_DEL_VECTOR.md, decidida por VG el 7-11 por la
 * tarde (mapa §12 [D]).
 */
export function vector(candidato, buscado) {
  const c = indicesCompletos(candidato);
  const b = indicesCompletos(buscado);
  return c.map((x, k) => x - b[k]);
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

/** Distancia por profundidad: los valores absolutos, siempre positivos. */
export function distancia(v) {
  return v.map((x) => Math.abs(x));
}

/** Suma de las distancias: una medida de consulta, no el criterio de orden. */
export function norma(v) {
  return v.reduce((s, x) => s + Math.abs(x), 0);
}

/** Faltas: profundidades donde al candidato le falta (diferencia negativa: completar). */
export function faltas(v) {
  return v.filter((x) => x < 0).length;
}

/** Excedentes: profundidades donde al candidato le sobra (diferencia positiva: reducir). */
export function excedentes(v) {
  return v.filter((x) => x > 0).length;
}

/** Signo global, solo informativo: exacto, completar, reducir o mixto. */
export function signo(v) {
  const f = faltas(v);
  const e = excedentes(v);
  return f === 0 && e === 0 ? 'exacto' : e === 0 ? 'completar' : f === 0 ? 'reducir' : 'mixto';
}

/**
 * Orden por encaje, sin borrar nada: más coincidencias de ruta primero (el
 * acuerdo de prefijo: los exactos tienen diez); después, solo en las
 * profundidades que la época declare ordinales (epoca.ordinal(profundidad)),
 * menor distancia; y los empates conservan la llegada. Sin época, o con la
 * época 0 (dígitos nominales), ni el signo ni la distancia ordenan (corpus:
 * «no puntuar por cercanía ciega»). La regla de la dimensión vive en la época.
 */
export function ordenarPorEncaje(lista, { epoca } = {}) {
  const ordinales = epoca && typeof epoca.ordinal === 'function' ? [...Array(ARIDAD).keys()].filter((k) => epoca.ordinal(k)) : [];
  const porDistancia = (va, vb) => {
    for (const k of ordinales) {
      const d = Math.abs(va[k]) - Math.abs(vb[k]);
      if (d !== 0) return d;
    }
    return 0;
  };
  return lista
    .map((o, i) => ({ o, i }))
    .sort((a, b) => (acuerdo(b.o.vector) - acuerdo(a.o.vector)) || porDistancia(a.o.vector, b.o.vector) || (a.i - b.i))
    .map((x) => x.o);
}

function conEncaje(o, destino) {
  // Para un ocupante por referencia, el origen es la dirección alcanzada en el otro registro.
  const origenDir = o.tipo === 'referencia' ? o.dir : o.origen;
  const v = vector(origenDir, destino);
  return { ...o, origenDir, destino, vector: v, distancia: distancia(v), acuerdo: acuerdo(v), signo: signo(v), faltas: faltas(v), excedentes: excedentes(v) };
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
 * (la dirección donde se le coloca), el vector de diferencias, la distancia,
 * las profundidades de acuerdo y el signo. Orden por defecto: por encaje;
 * con { orden: 'llegada' }, el de llegada. Nada se borra.
 *
 * Con { exacto: true } (un índice, mapa §12 [D]: «un número es índice,
 * camino exacto»), solo el camino `indices` tal cual: el propio de ese
 * camino, lo que alcanza si es referencia, y los escritos cuya dirección de
 * anclaje, sin ceros finales (indicesDe, como se lee toda dirección), es ese
 * camino. Sin él (una dirección: «nombra la colisión entera»), todos.
 */
export function ocupantes(eje, id, indices, { orden = 'encaje', epoca, exacto = false } = {}) {
  const ev = eje.obtener(id);
  if (!ev) throw new Error('registro desconocido: ' + id);
  const dir = direccion(indices);
  const esEse = (camino) => camino.length === indices.length && camino.every((x, k) => x === indices[k]);
  const lista = [];
  for (const c of caminosDe(ev.payload, dir)) {
    if (exacto && !esEse(c.indices)) continue;
    lista.push(conEncaje({ tipo: 'propio', evento: id, dir, camino: c.indices, contenido: c.contenido, origen: dir, procedencia: [id + ':' + dir + '#' + c.indices.join('.')] }, dir));
    if (esReferencia(c.contenido)) lista.push(conEncaje(seguir(eje, c.contenido, [id + ':' + dir + '#' + c.indices.join('.')]), dir));
  }
  for (const h of exacto && !esEse(indicesDe(dir)) ? [] : eje.sobre(id, dir)) {
    // Un escrito está anclado exactamente en la dirección buscada: su ruta coincide entera.
    lista.push(conEncaje({ tipo: 'escrito', evento: h.id, dir: '0000000000', camino: [], contenido: h.payload, autor: h.autor, t: h.t, origen: dir, procedencia: [h.id + ':0000000000'] }, dir));
  }
  const conOrigen = lista.map((o) => ({ ...o, origen: o.tipo }));
  return orden === 'llegada' ? conOrigen : ordenarPorEncaje(conOrigen, { epoca });
}

/**
 * Sigue una referencia hasta un contenido que no sea referencia. Conserva la
 * procedencia y, en `saltos`, cada lugar leído por el camino ({ evento,
 * indices }, en orden): lo que un gancho de autorización tiene que ver.
 */
export function seguir(eje, ref, procedencia = []) {
  let actual = ref;
  const cadena = [...procedencia];
  const saltos = [];
  for (let salto = 0; salto < MAX_SALTOS; salto++) {
    const ev = eje.obtener(actual.ref);
    const dir = actual.dir ?? '0000000000';
    if (!ev) return { tipo: 'referencia', origen: 'referencia', evento: actual.ref, dir, camino: indicesDe(dir), contenido: undefined, procedencia: cadena, saltos, rota: true };
    cadena.push(actual.ref + ':' + dir);
    saltos.push({ evento: actual.ref, indices: indicesDe(dir) });
    const contenido = resolver(ev.payload, dir);
    if (!esReferencia(contenido)) return { tipo: 'referencia', origen: 'referencia', evento: actual.ref, dir, camino: indicesDe(dir), contenido, procedencia: cadena, saltos };
    actual = contenido;
  }
  const dir = actual.dir ?? '0000000000';
  return { tipo: 'referencia', origen: 'referencia', evento: actual.ref, dir, camino: indicesDe(dir), contenido: undefined, procedencia: cadena, saltos, rota: true };
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
