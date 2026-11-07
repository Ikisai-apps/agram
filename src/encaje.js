// Encaje: una dirección puede tener varios ocupantes, y las colisiones se
// quieren, no se evitan. Una dirección de diez dígitos con ceros finales
// nombra a la vez la posición «1», la «1.0», la «1.0.0»…: todas ocupan el
// mismo lugar. Ocupan también lo que alcanza una referencia (sin copiar) y
// lo que otros han escrito en esa dirección. Se ordenan sin borrar
// alternativas; cada ocupante lleva su procedencia y su camino exacto de
// índices. El árbol lógico se reconstruye desde los eventos; no se guarda.
// La lista de una posición (lista()) son esos ocupantes por llegada, fuera
// del árbol: un array dentro de una posición son sus ocupantes, no dígitos
// con PV (VG, 7-11 noche, mapa §12 [D]).

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
  const porEncaje = comparadorEncaje({ epoca });
  return lista
    .map((o, i) => ({ o, i }))
    .sort((a, b) => porEncaje(a.o, b.o) || (a.i - b.i))
    .map((x) => x.o);
}

/** Hasta cuántos ocupantes marcarEmpates compara cada par (medido en el banco: por debajo de ~12, por pares es más rápido). */
const POR_PARES = 12;

/** Profundidades que la época declara ordinales (ninguna sin época o sin el gancho). */
function ordinalesDe(epoca) {
  return epoca && typeof epoca.ordinal === 'function' ? [...Array(ARIDAD).keys()].filter((k) => epoca.ordinal(k)) : [];
}

/** El criterio del encaje sin la llegada: negativo si a va antes que b; 0 si el encaje no los separa. */
function comparadorEncaje({ epoca } = {}) {
  const ordinales = ordinalesDe(epoca);
  const porDistancia = (va, vb) => {
    for (const k of ordinales) {
      const d = Math.abs(va[k]) - Math.abs(vb[k]);
      if (d !== 0) return d;
    }
    return 0;
  };
  return (a, b) => (acuerdo(b.vector) - acuerdo(a.vector)) || porDistancia(a.vector, b.vector);
}

/**
 * Empate (paso 5 del encaje, corpus V4: «entregar candidatos,
 * justificaciones, diferencias, faltas/excedentes y empate»): cada ocupante
 * lleva `empate: true` si el encaje no lo separa de otro (mismo acuerdo de
 * prefijo y, en las profundidades que la época declare ordinales, misma
 * distancia), y `empatados`, con cuántos. Entre ellos solo decide la llegada.
 * Coste lineal (banco de rendimiento, docs/notas/RENDIMIENTO.md): en vez de
 * comparar cada par, cada ocupante lleva la clave de lo que el comparador
 * mira (el acuerdo y, en cada profundidad ordinal, la distancia) y se cuentan
 * las claves iguales. Dos ocupantes empatan si y solo si sus claves son
 * iguales; una distancia que no es un número finito no empata con nada,
 * igual que en la comparación (NaN o Infinity − Infinity no dan 0). Hasta
 * POR_PARES ocupantes se compara cada par, que ahí sale más barato.
 */
export function marcarEmpates(lista, { epoca } = {}) {
  // Con pocos ocupantes (lo normal) comparar cada par es más barato que montar las claves; el resultado es el mismo.
  if (lista.length <= POR_PARES) {
    const porEncaje = comparadorEncaje({ epoca });
    return lista.map((o) => {
      const empatados = lista.filter((p) => p !== o && porEncaje(o, p) === 0).length;
      return { ...o, empate: empatados > 0, empatados };
    });
  }
  // Cuántas veces está cada objeto: uno no empata consigo mismo (`p !== o`).
  const veces = new Map();
  for (const o of lista) veces.set(o, (veces.get(o) ?? 0) + 1);
  // Sin dos objetos distintos no hay nada que comparar (y no se lee ningún vector).
  if (veces.size < 2) return lista.map((o) => ({ ...o, empate: false, empatados: 0 }));
  const ordinales = ordinalesDe(epoca);
  let unica = 0;
  const claveDe = (o) => {
    const partes = [acuerdo(o.vector)];
    for (const k of ordinales) {
      const d = Math.abs(o.vector[k]);
      if (!Number.isFinite(d)) return '#' + unica++; // no empata con nadie
      partes.push(d);
    }
    return partes.join(',');
  };
  const claves = new Map(); // una clave por objeto, aunque esté repetido
  const cuenta = new Map(); // clave → cuántos de la lista la tienen
  for (const [o, n] of veces) {
    const k = claveDe(o);
    claves.set(o, k);
    cuenta.set(k, (cuenta.get(k) ?? 0) + n);
  }
  return lista.map((o) => {
    const empatados = cuenta.get(claves.get(o)) - veces.get(o);
    return { ...o, empate: empatados > 0, empatados };
  });
}

/** Justificación en texto de un ocupante: de dónde viene, cómo encaja y si empata. Solo informa. */
export function justificar(o) {
  const de = o.tipo === 'escrito'
    ? 'escrito por ' + o.autor + ', anclado en ' + o.destino
    : o.tipo === 'referencia'
      ? (o.estado ? 'referencia a ' + o.evento.slice(0, 8) + ': ' + o.estado + ', ' + o.motivo : 'alcanzado por referencia en ' + o.evento.slice(0, 8) + ':' + o.origenDir)
      : 'propio del registro, camino ' + (o.camino.length ? o.camino.join('.') : 'raíz');
  const como = o.acuerdo === ARIDAD
    ? 'encaje exacto'
    : o.acuerdo + ' de ' + ARIDAD + ' profundidades de acuerdo; ' + o.signo + ' (' + o.faltas + ' por completar, ' + o.excedentes + ' por reducir: el signo informa, no ordena)';
  const empate = o.empate ? '; empata con ' + o.empatados + ' (decide la llegada)' : '';
  return de + '; ' + como + empate;
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
 *    si el evento referido no está en el eje, el ocupante sigue ahí: rota, estado PENDIENTE y su motivo;
 * 3. escritos: los registros anclados en esa dirección (`sobre` + `en`).
 * Cada ocupante lleva su origen (la dirección de donde viene), su destino
 * (la dirección donde se le coloca), el vector de diferencias, la distancia,
 * las profundidades de acuerdo, el signo, el empate y una justificación en
 * texto. Orden por defecto: por encaje; con { orden: 'llegada' }, el de
 * llegada. Nada se borra.
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
  const ordenados = orden === 'llegada' ? conOrigen : ordenarPorEncaje(conOrigen, { epoca });
  return marcarEmpates(ordenados, { epoca }).map((o) => ({ ...o, justificacion: justificar(o) }));
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
    // Referencia ausente → PENDIENTE (puede llegar), no ERROR; sin dato inventado (corpus V4).
    if (!ev) return { tipo: 'referencia', origen: 'referencia', evento: actual.ref, dir, camino: indicesDe(dir), contenido: undefined, procedencia: cadena, saltos, rota: true, estado: 'PENDIENTE', motivo: 'evento ausente del eje: ' + actual.ref.slice(0, 8) };
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
 * dir → ocupantes. Incluye las direcciones donde solo hay escritos. Se
 * reconstruye bajo la época que se elige al leer (`epoca`); hoy la época
 * decide el orden de los ocupantes (sus profundidades ordinales).
 */
export function arbol(eje, id, { profundidad = ARIDAD, epoca } = {}) {
  const ev = eje.obtener(id);
  if (!ev) throw new Error('registro desconocido: ' + id);
  const mapa = new Map();
  const visitar = (indices, nodo) => {
    if (indices.length > profundidad) return;
    const dir = direccion(indices);
    if (!mapa.has(dir)) mapa.set(dir, ocupantes(eje, id, indices, { epoca }));
    if (Array.isArray(nodo)) nodo.forEach((hijo, i) => visitar([...indices, i], hijo));
  };
  visitar([], ev.payload);
  for (const h of eje.sobre(id)) {
    if (!mapa.has(h.en)) mapa.set(h.en, ocupantes(eje, id, indicesDe(h.en), { epoca }));
  }
  return mapa;
}

/**
 * La lista de una posición (VG, 7-11 noche, mapa §12 [D]): los ocupantes que
 * hay en ella, por LLEGADA. La lista no está en el árbol («en la profundidad
 * 11»): no corresponde a los puntos de vista y su índice es de llegada, no un
 * dígito; los PV de un elemento solo existen cuando se escribe en una
 * subposición por dirección (`en`). Es de n: el límite de diez es por evento
 * (por payload), no por posición.
 *
 * - Posición de la cruceta (`[p]`): primero el contenido propio del payload
 *   en p (si es un array, cada elemento es un ocupante, en el orden del
 *   array; si es un terminal o una referencia, uno solo), luego los escritos
 *   anclados en su dirección, en orden de entrada en el eje.
 * - Raíz (`[]`): el payload raíz es la cruceta, no una lista: solo los
 *   escritos anclados en la raíz.
 * - Subposición escrita por dirección (`[p, d, …]`): solo los escritos
 *   anclados en esa dirección. El índice d de un array del payload no es la
 *   subposición d: es un ocupante de la lista de p.
 *
 * Cada ocupante: { llegada, tipo: 'propio' | 'escrito', evento, camino,
 * contenido, autor?, t?, en?, alcanza? }, con `camino` el camino exacto en
 * el registro `evento` ([] para un escrito: su raíz) y `alcanza`, si el
 * contenido es una referencia, lo que alcanza (seguir, con su procedencia).
 * Nada se borra ni se ordena por encaje: la llegada manda.
 */
export function lista(eje, id, indices) {
  const ev = eje.obtener(id);
  if (!ev) throw new Error('registro desconocido: ' + id);
  const dir = direccion(indices);
  const propios = [];
  if (indices.length === 1) {
    const nodo = Array.isArray(ev.payload) ? ev.payload[indices[0]] : undefined;
    if (Array.isArray(nodo)) nodo.forEach((c, k) => propios.push({ camino: [...indices, k], contenido: c }));
    else if (nodo !== undefined) propios.push({ camino: [...indices], contenido: nodo });
  }
  const conAlcance = (o) => (esReferencia(o.contenido) ? { ...o, alcanza: seguir(eje, o.contenido, [o.evento + ':' + o.camino.join('.')]) } : o);
  const salida = propios.map((p, k) => conAlcance({ llegada: k, tipo: 'propio', evento: id, camino: p.camino, contenido: p.contenido }));
  for (const h of eje.sobre(id, dir)) {
    salida.push(conAlcance({ llegada: salida.length, tipo: 'escrito', evento: h.id, camino: [], contenido: h.payload, autor: h.autor, t: h.t, en: h.en }));
  }
  return salida;
}

/** Direcciones con más de un ocupante: las colisiones del árbol. */
export function colisiones(mapa) {
  return [...mapa.entries()].filter(([, oc]) => oc.length > 1).map(([dir, oc]) => ({ dir, ocupantes: oc }));
}

/** Texto de un ocupante para mostrarlo: su representación si es array, su valor si es terminal. */
export function caminoDe(o) {
  return o.camino ?? indicesDe(o.dir);
}
