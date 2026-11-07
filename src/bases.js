// Bases del 8: las estadísticas son REGISTROS escritos en la posición 8 (el
// cielo) del registro que resumen, con referencias a lo medido; no hay base
// de datos aparte (VG, 7-11, mapa §12 «Cohortes y bases del 8»).
//
//   - Lo que se mide, las cohortes, la caja y cómo se funde una medida son
//     los de la confluencia del 8 (src/tiempo.js: medidasDe, comparables,
//     cajaDe, fundir, proyectoDe): una sola verdad. Una base es lo fundible
//     de confluir() sobre una cohorte, escrito en el 8 y fundible hacia arriba.
//   - La escribe la propia cosa, con su clave y gastando su T (§12 [D]):
//     solo cuenta como base lo que firma la identidad del registro resumido.
//     Lo demás escrito en el 8 es un escrito más (un hijo).
//   - Medidas FUNDIBLES: por medida y por serie de token, n, suma, mínimo,
//     máximo y un histograma de diez cajas: una décupla de recuentos cuyas
//     diez posiciones son los diez niveles/hitos del 8 (HITOS, solo como
//     etiquetas de caja: nada asigna nivel ni grado al foco); por posición
//     0–9, cuántos la tienen desarrollada y por qué procedencia.
//   - Cortes de las cajas = regla de la época (§12 [D]): se leen del gancho
//     epoca.cortes(clave), como en confluir(); la época 0 aún no los declara.
//   - Fundir dos bases es sumar caja a caja: O(1) respecto a lo medido.
//   - Una sola base por 8, con dos estadísticas: la de los HIJOS del registro
//     (los hermanos entre sí) y la de su SUBÁRBOL (el registro y todo lo que
//     cuelga de él). La del subárbol funde las bases de los hijos sin releer
//     registros: el 8 del proyecto funde las bases de sus hijos; el del
//     génesis, las de los proyectos.
//   - Corregir es escribir otra base: la anterior queda como colisión en el 8.
//   - El foco se sitúa en su caja, por medida, en cada cohorte (ALCANCES):
//     hermanos (los hijos del 8 del padre), proyecto (el subárbol del 8 del
//     proyecto) y general (el subárbol del 8 del génesis).
//   - BASES() en BQL lee estas bases (valorDeBases; src/bql.js).
//
// Lo que el mapa no decide va marcado «[X] decidir VG».
// [X] decidir VG: confluir() calcula al vuelo lo mismo que aquí se lee del 8.
// Si la interfaz y BQL deben leer solo las bases escritas (y retirar
// comparar() y el cálculo al vuelo, auditoría C18) o conservar las dos
// lecturas, una fresca y otra escrita.

import { ARIDAD, esReferencia } from './btml.js';
import { EPOCA_0 } from './epocas.js';
// tiempo.js importa este módulo (filtra las bases de sus hermanos): la
// importación es circular, así que de tiempo.js solo se lee dentro de funciones.
import { HITOS, ALCANCES, MEDIDAS as MEDIDAS_CONFLUENCIA, medidasDe, cajaDe, fundir as fundirMedida, proyectoDe, etiquetaClave } from './tiempo.js';

/** Etiquetas de las diez cajas: los diez hitos del 8 (tiempo.HITOS). Solo etiquetas. */
export { HITOS as ETIQUETAS } from './tiempo.js';

/** La posición 8 (el cielo) en la raíz del registro: ahí se anclan sus bases. */
export const CIELO = '8000000000';

/** Representación (posición 0) del payload de una base. */
export const TITULO = 'Bases del 8';

/** Las dos estadísticas de una base: los hijos del registro y su subárbol (él incluido). */
export const SECCIONES = Object.freeze(['hijos', 'subarbol']);

/**
 * Coste de escribir una base: un minuto de T de la cosa, como la ejecución.
 * [X] decidir VG: el coste de una base (con la regla de escritura, un minuto
 * por posición, serían cientos de minutos: una base ocupa cientos de posiciones).
 */
export const COSTE_BASE = Object.freeze({ token: 'T', escala: 'minuto', cantidad: 1 });

/** Las claves de las medidas de la confluencia (tiempo.MEDIDAS), en su orden. */
export function clavesDeMedidas() {
  return MEDIDAS_CONFLUENCIA.map((m) => m.clave);
}

/** Clave de una serie de token (claveToken): T:<escala>, E:<emisor>/<denominación>, P:<ámbito>, R:<emisor>. */
const esClaveToken = (clave) => typeof clave === 'string' && /^[TEPR]:./.test(clave);

function esMedida(clave) {
  return clavesDeMedidas().includes(clave) || esClaveToken(clave);
}

// --- Cortes: regla de la época --------------------------------------------
// Nueve umbrales crecientes parten los valores en diez cajas (tiempo.cajaDe):
// la caja k reúne los valores v con cortes[k-1] <= v < cortes[k]; la 0, lo
// que queda por debajo del primero; la 9, desde el último.

const LINEAL = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9]);
const RECUENTOS = Object.freeze([1, 2, 3, 4, 6, 10, 16, 26, 42]);

/**
 * Cortes provisionales, solo mientras la época no los declara (la época 0
 * no los tiene). Que los cortes son regla de la época está decidido (§12).
 * confluir(), sin cortes de la época, los saca de cada cohorte; una base no
 * puede: sus cajas han de fundirse con las de otras bases, así que usa
 * estos, fijos.
 * [X] decidir VG: sus valores (terminales, escritos y cantidades de token:
 * 1 2 3 4 6 10 16 26 42; el resto: 1 … 9).
 */
export const CORTES_PROVISIONALES = Object.freeze({
  posiciones: LINEAL,
  terminales: RECUENTOS,
  escritos: RECUENTOS,
  movimientos: LINEAL,
  identidades: LINEAL,
  profundidadHilo: LINEAL,
  formulasResueltas: LINEAL,
  formulasPendientes: LINEAL,
  tokens: RECUENTOS,
});

function sonCortes(c) {
  return Array.isArray(c) && c.length === ARIDAD - 1 && c.every(Number.isFinite) && c.every((x, k) => k === 0 || x > c[k - 1]);
}

/**
 * Cortes de una medida o serie bajo una época: { cortes, origen }. Los del
 * gancho epoca.cortes(clave) si lo tiene y da algo (origen 'epoca'), con la
 * misma clave que usa confluir(); si no, los provisionales (origen
 * 'provisional'). Los de la época han de ser nueve umbrales crecientes.
 */
export function cortesDe(clave, epoca = EPOCA_0) {
  if (!esMedida(clave)) throw new Error('medida desconocida: ' + clave);
  const deEpoca = typeof epoca?.cortes === 'function' ? epoca.cortes(clave) : undefined;
  if (deEpoca !== undefined && deEpoca !== null) {
    if (!sonCortes(deEpoca)) throw new Error((epoca.nombre ?? 'la época') + ': los cortes de ' + clave + ' han de ser nueve umbrales crecientes');
    return { cortes: [...deEpoca], origen: 'epoca' };
  }
  return { cortes: [...(esClaveToken(clave) ? CORTES_PROVISIONALES.tokens : CORTES_PROVISIONALES[clave])], origen: 'provisional' };
}

// --- Identidad del registro y clasificación de su 8 --------------------------

/**
 * Identidad propia de un registro: la que puede escribir sus bases (§12: «la
 * escribe la propia cosa con su clave»). Hoy: la única cosa (tipo 'cosa',
 * con clave) a la que el propio registro da de alta en su contexto; la del
 * génesis, su autor, si tiene clave (el génesis solo declara a su autor).
 * Si no hay exactamente una, null: ese registro no escribe bases.
 * [X] decidir VG: cómo se identifica un registro con una identidad (AARPIA).
 */
export function identidadDe(eje, id) {
  const ev = eje.obtener(id);
  if (!ev) return null;
  if (ev.sobre === null) return eje.clave(ev.autor) ? ev.autor : null;
  const cosas = Object.entries(ev.contexto?.tipos ?? {})
    .filter(([nombre, tipo]) => tipo === 'cosa' && ev.contexto?.claves?.[nombre] && eje.clave(nombre))
    .map(([nombre]) => nombre);
  return cosas.length === 1 ? cosas[0] : null;
}

// Lo que hay sobre cada registro, partido en hijos y bases válidas, en orden
// de llegada. El eje solo añade y la validez de una base depende solo de lo
// llegado antes que ella, así que la partición se guarda y se amplía con lo
// nuevo (por eje, sin tocar el eje).
const PARTICIONES = new WeakMap();

function particion(eje, id) {
  let porEje = PARTICIONES.get(eje);
  if (!porEje) PARTICIONES.set(eje, (porEje = new Map()));
  let p = porEje.get(id);
  if (!p) porEje.set(id, (p = { vistos: 0, hijos: [], bases: [], ocupada: false }));
  const todos = eje.sobre(id);
  if (p.vistos === todos.length) return p;
  if (p.ocupada) throw new Error('bases: lectura circular del 8 de ' + id.slice(0, 8));
  p.ocupada = true;
  try {
    for (; p.vistos < todos.length; p.vistos++) {
      const ev = todos[p.vistos];
      const base = leerSiEsBase(eje, ev, p.hijos);
      if (base) p.bases.push(base);
      else p.hijos.push(ev);
    }
  } finally {
    p.ocupada = false;
  }
  return p;
}

/** Hijos de un registro sin sus bases válidas: las bases no son hermanas ni escritos de lo que miden. Orden de llegada. */
export function hijos(eje, id) {
  return [...particion(eje, id).hijos];
}

/** Si un evento es una base válida del 8 de su registro. Que lo parezca (contexto.bases) no basta. */
export function esBase(eje, ev) {
  return ev?.sobre != null && particion(eje, ev.sobre).bases.some((b) => b.id === ev.id);
}

/** Bases válidas escritas en el 8 de un registro, en orden de llegada. */
export function basesEn(eje, id) {
  return [...particion(eje, id).bases];
}

/** La base válida con ese id, leída, o null. */
export function basePorId(eje, id) {
  const ev = eje.obtener(id);
  if (!ev || ev.sobre === null) return null;
  return particion(eje, ev.sobre).bases.find((b) => b.id === id) ?? null;
}

function ultimaBase(eje, id) {
  return particion(eje, id).bases.at(-1) ?? null;
}

// --- Medir -----------------------------------------------------------------

// Registros que se están midiendo: BASES() dentro de uno de ellos no vuelve a
// medirlo (sería un ciclo); queda PENDIENTE y cuenta como fórmula pendiente.
const MIDIENDO = new Set();

/**
 * Medidas de un registro: las de la confluencia (tiempo.medidasDe), con un
 * guarda para que BASES() dentro del propio registro no lo vuelva a medir.
 */
export function medir(eje, id) {
  const propio = !MIDIENDO.has(id);
  if (propio) MIDIENDO.add(id);
  try {
    return medidasDe(eje, id);
  } finally {
    if (propio) MIDIENDO.delete(id);
  }
}

// --- Estadísticas en memoria ---------------------------------------------
// estadística = { n, medidas: { <clave>: bloque }, tokens: { <clave de serie>: bloque },
//   posiciones: [diez { comparables, propias, referencias, escritas }], raiz }
// bloque = { n, suma, minimo, maximo, cortes, origenCortes, cajas }: lo
// fundible de tiempo.distribucion. Una serie que una estadística no nombra
// vale cero en sus n registros (así fundir es exacto); cada bloque lleva los
// cortes con que se hizo.

function bloqueCeros(n, { cortes, origen }) {
  const cajas = Array(ARIDAD).fill(0);
  cajas[cajaDe(0, cortes)] = n;
  return { n, suma: 0, minimo: n ? 0 : null, maximo: n ? 0 : null, cortes: [...cortes], origenCortes: origen, cajas };
}

function bloqueDeValor(v, corte) {
  const b = bloqueCeros(0, corte);
  b.cajas[cajaDe(v, corte.cortes)] = 1;
  return { ...b, n: 1, suma: v, minimo: v, maximo: v };
}

const posicionVacia = () => ({ comparables: 0, propias: 0, referencias: 0, escritas: 0 });

/** Estadística vacía: el neutro de fundir. */
export function estadisticaVacia() {
  return { n: 0, medidas: {}, tokens: {}, posiciones: Array.from({ length: ARIDAD }, posicionVacia), raiz: 0 };
}

/** Estadística de un solo registro a partir de sus medidas (medir): n = 1, una caja ocupada por medida, con los cortes de la época. */
export function unitaria(m, epoca = EPOCA_0) {
  const est = estadisticaVacia();
  est.n = 1;
  for (const clave of clavesDeMedidas()) est.medidas[clave] = bloqueDeValor(m[clave], cortesDe(clave, epoca));
  for (const [clave, v] of Object.entries(m.tokens)) est.tokens[clave] = bloqueDeValor(v, cortesDe(clave, epoca));
  est.posiciones = m.procedencias.map((p) => ({ comparables: +p.tiene, propias: +p.propia, referencias: +p.referencia, escritas: +p.escrita }));
  est.raiz = +m.raiz.escrita;
  return est;
}

/** Orígenes de los cortes de un bloque: de la época, provisionales o, al fundir los mismos cortes de los dos orígenes, mixto. */
export const ORIGENES_CORTES = Object.freeze(['epoca', 'provisional', 'mixto']);

function fundirBloques(clave, x, y) {
  const f = fundirMedida(x, y);
  if (f.cajas === null) throw new Error('bases con cortes distintos en ' + clave + ': no se inventa escala puente');
  return { ...f, origenCortes: f.origenCortes ?? 'mixto' };
}

/**
 * Funde dos estadísticas: cada medida y cada serie con tiempo.fundir (suma
 * caja a caja, suma n y sumas, toma mínimo y máximo); las posiciones y la
 * raíz, sumando. O(1) respecto a lo medido. No funde cajas con cortes distintos.
 */
export function fundir(a, b) {
  const unir = (x, y, nx, ny) => {
    const r = {};
    for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) {
      const corte = (bl) => ({ cortes: bl.cortes, origen: bl.origenCortes });
      r[k] = fundirBloques(k, x[k] ?? bloqueCeros(nx, corte(y[k])), y[k] ?? bloqueCeros(ny, corte(x[k])));
    }
    return r;
  };
  return {
    n: a.n + b.n,
    medidas: unir(a.medidas, b.medidas, a.n, b.n),
    tokens: unir(a.tokens, b.tokens, a.n, b.n),
    posiciones: a.posiciones.map((p, i) => ({
      comparables: p.comparables + b.posiciones[i].comparables,
      propias: p.propias + b.posiciones[i].propias,
      referencias: p.referencias + b.posiciones[i].referencias,
      escritas: p.escritas + b.posiciones[i].escritas,
    })),
    raiz: a.raiz + b.raiz,
  };
}

/** Bloque de una medida o serie en una estadística, aunque no la nombre (serie ausente = ceros con los cortes de la época). */
export function bloqueDe(est, clave, epoca = EPOCA_0) {
  return est.medidas[clave] ?? est.tokens[clave] ?? bloqueCeros(est.n, cortesDe(clave, epoca));
}

/** Las diez cajas de una medida con su etiqueta: [{ caja, nivel, nombre, cuenta }]. Etiquetas, no grados. */
export function cajasEtiquetadas(est, clave, epoca = EPOCA_0) {
  return bloqueDe(est, clave, epoca).cajas.map((cuenta, k) => ({ caja: k, nivel: HITOS[k].nivel, nombre: HITOS[k].nombre, cuenta }));
}

/**
 * Calcula, sin escribirla, la base de un registro (lo que escribirBase
 * escribe en su 8):
 * - hijos: sus hijos medidos uno a uno (los hermanos entre sí);
 * - subarbol: el propio registro, más cada hijo por su subárbol, leído de la
 *   base vigente del 8 de ese hijo, sin releer lo que cuelga de él. Un hijo
 *   sin base cuenta por sí mismo; si además tiene descendencia, esa
 *   descendencia no cuenta y el hijo queda en sinBase.
 *   [X] decidir VG: cómo se completa lo que cuelga de un hijo sin base (hoy
 *   no cuenta y se dice; releerlo rompería «fundir es O(1)»).
 * Devuelve { registro, epoca, hijos, subarbol, refsHijos, refsBases, hasta, sinBase }.
 */
export function calcularBase(eje, registro, { epoca = EPOCA_0 } = {}) {
  if (!eje.obtener(registro)) throw new Error('registro desconocido: ' + registro);
  const lista = hijos(eje, registro);
  const unidades = lista.map((h) => unitaria(medir(eje, h.id), epoca));
  const deHijos = unidades.reduce((a, b) => fundir(a, b), estadisticaVacia());
  let subarbol = unitaria(medir(eje, registro), epoca);
  const refsBases = [];
  const sinBase = [];
  lista.forEach((h, i) => {
    const b = ultimaBase(eje, h.id);
    if (b) {
      subarbol = fundir(subarbol, b.subarbol);
      refsBases.push(b.id);
    } else {
      subarbol = fundir(subarbol, unidades[i]);
      if (hijos(eje, h.id).length) sinBase.push(h.id);
    }
  });
  return {
    registro,
    epoca: epoca?.nombre ?? 'época sin nombre',
    hijos: deHijos,
    subarbol,
    refsHijos: lista.map((h) => h.id),
    refsBases,
    hasta: lista.at(-1)?.id ?? null,
    sinBase,
  };
}

// --- La base como payload BTML ---------------------------------------------
// [0] TITULO
// [1] [n de los hijos, n del subárbol]
// [2] estadística de los hijos: [bloques de las medidas (tiempo.MEDIDAS, en su orden), series, posiciones, raíz]
// [3] estadística del subárbol: igual
// [4] referencias {ref} a los hijos medidos, en orden
// [5] referencias {ref} a las bases fundidas de los hijos, en orden, o NINGUNA
// series = pares [clave de serie, bloque], por clave, o NINGUNA
// posiciones = décupla de [comparables, propias, referencias, escritas]
// bloque = [cajas (diez recuentos), suma, mínimo, máximo, cortes (nueve umbrales), origen de los cortes]
// Las listas de más de diez se anidan en décuplas (empaquetar).
// [X] decidir VG: la disposición del payload (aquí, una lista; podría ir por PV).

/** Marca de una lista vacía en el payload (BTML no admite arrays vacíos). */
export const NINGUNA = 'ninguna';

/** Agrupa una lista en décuplas anidadas (ningún array pasa de diez posiciones), conservando el orden. */
export function empaquetar(items) {
  if (items.length <= ARIDAD) return [...items];
  let tam = 1;
  while (Math.ceil(items.length / tam) > ARIDAD) tam *= ARIDAD;
  const grupos = [];
  for (let i = 0; i < items.length; i += tam) {
    const g = items.slice(i, i + tam);
    grupos.push(g.length === 1 ? g[0] : empaquetar(g));
  }
  return grupos;
}

const bloqueAPayload = (b) => [[...b.cajas], b.suma, b.minimo, b.maximo, [...b.cortes], b.origenCortes];

function estadisticaAPayload(est) {
  const series = Object.keys(est.tokens).sort();
  return [
    clavesDeMedidas().map((clave) => bloqueAPayload(est.medidas[clave])),
    series.length ? empaquetar(series.map((clave) => [clave, bloqueAPayload(est.tokens[clave])])) : NINGUNA,
    est.posiciones.map((p) => [p.comparables, p.propias, p.referencias, p.escritas]),
    est.raiz,
  ];
}

/** Payload BTML de una base calculada (calcularBase) con al menos un hijo. */
export function payloadDeBase(calculada) {
  if (!(calculada.hijos.n >= 1)) throw new Error('una base escrita mide al menos un hijo');
  const refs = (ids) => (ids.length ? empaquetar(ids.map((id) => ({ ref: id }))) : NINGUNA);
  return [
    TITULO,
    [calculada.hijos.n, calculada.subarbol.n],
    estadisticaAPayload(calculada.hijos),
    estadisticaAPayload(calculada.subarbol),
    refs(calculada.refsHijos),
    refs(calculada.refsBases),
  ];
}

const esCuenta = (x, n) => Number.isSafeInteger(x) && x >= 0 && x <= n;

// Un bloque bien formado y coherente: cajas que suman n, cortes crecientes,
// extremos y suma compatibles entre sí y con las cajas ocupadas.
function bloqueDePayload(x, n) {
  if (!Array.isArray(x) || x.length !== 6 || !Array.isArray(x[0]) || x[0].length !== ARIDAD) return null;
  const [cajas, suma, minimo, maximo, cortes, origen] = x;
  if (!sonCortes(cortes) || !ORIGENES_CORTES.includes(origen)) return null;
  if (!cajas.every((c) => esCuenta(c, n)) || cajas.reduce((s, c) => s + c, 0) !== n) return null;
  if (![suma, minimo, maximo].every(Number.isFinite) || minimo > maximo) return null;
  if (suma < n * minimo || suma > n * maximo) return null;
  const ocupadas = cajas.flatMap((c, k) => (c > 0 ? [k] : []));
  if (ocupadas[0] !== cajaDe(minimo, cortes) || ocupadas.at(-1) !== cajaDe(maximo, cortes)) return null;
  return { n, suma, minimo, maximo, cortes: [...cortes], origenCortes: origen, cajas: [...cajas] };
}

function estadisticaDePayload(x, n) {
  if (!Array.isArray(x) || x.length !== 4) return null;
  const [bloques, series, posiciones, raiz] = x;
  const claves = clavesDeMedidas();
  if (!Array.isArray(bloques) || bloques.length !== claves.length) return null;
  const est = { n, medidas: {}, tokens: {}, posiciones: [], raiz };
  for (let k = 0; k < claves.length; k++) {
    const b = bloqueDePayload(bloques[k], n);
    if (!b) return null;
    est.medidas[claves[k]] = b;
  }
  if (series !== NINGUNA) {
    const pares = [];
    const aplanar = (nodo) => {
      if (!Array.isArray(nodo)) return false;
      if (typeof nodo[0] === 'string') return nodo.length === 2 && pares.push(nodo) > 0;
      return nodo.every(aplanar);
    };
    if (!aplanar(series)) return null;
    for (const [clave, x2] of pares) {
      const b = bloqueDePayload(x2, n);
      if (!b || !esClaveToken(clave) || est.tokens[clave]) return null;
      est.tokens[clave] = b;
    }
  }
  if (!Array.isArray(posiciones) || posiciones.length !== ARIDAD) return null;
  for (const p of posiciones) {
    if (!Array.isArray(p) || p.length !== 4 || !p.every((c) => esCuenta(c, n))) return null;
    const [comparables, propias, referencias, escritas] = p;
    if (comparables < Math.max(propias, referencias, escritas) || comparables > propias + referencias + escritas) return null;
    est.posiciones.push({ comparables, propias, referencias, escritas });
  }
  if (!esCuenta(raiz, est.posiciones[0].escritas)) return null; // lo escrito en la raíz colisiona con la 0
  return est;
}

function refsDePayload(x) {
  if (x === NINGUNA) return [];
  const ids = [];
  const aplanar = (nodo) => (esReferencia(nodo) ? !nodo.dir && ids.push(nodo.ref) > 0 : Array.isArray(nodo) && nodo.every(aplanar));
  return aplanar(x) && ids.length ? ids : null;
}

/** Lee un payload de base: { hijos, subarbol, refsHijos, refsBases } o null si no está bien formado. */
export function baseDePayload(payload) {
  if (!Array.isArray(payload) || payload.length !== 6 || payload[0] !== TITULO) return null;
  const ns = payload[1];
  if (!Array.isArray(ns) || ns.length !== 2 || !ns.every((n) => Number.isSafeInteger(n) && n >= 1)) return null;
  const deHijos = estadisticaDePayload(payload[2], ns[0]);
  const subarbol = estadisticaDePayload(payload[3], ns[1]);
  const refsHijos = refsDePayload(payload[4]);
  const refsBases = refsDePayload(payload[5]);
  if (!deHijos || !subarbol || !refsHijos || !refsBases || !refsHijos.length) return null;
  return { hijos: deHijos, subarbol, refsHijos, refsBases };
}

const CLAVES_CONTEXTO = 'bases,epoca,hasta,n,nSubarbol,sinBase';

/**
 * Lee un evento como base válida del 8 de su registro, o null. `previos` son
 * los hijos del registro llegados antes que él. Es base si:
 * - está en el 8 (CIELO) con contexto.bases, y lo firma la identidad propia
 *   del registro (identidadDe), que gasta T en él;
 * - su contexto es exactamente { bases, n, nSubarbol, hasta, epoca, sinBase },
 *   con tipos válidos, y casa con el payload, que está bien formado;
 * - mide exactamente los hijos del registro hasta «hasta», en orden;
 * - funde bases válidas del 8 de hijos medidos (como mucho una por hijo), y
 *   el n del subárbol es 1 + lo que aporta cada hijo (su subárbol o él).
 */
function leerSiEsBase(eje, ev, previos) {
  if (ev.en !== CIELO || ev.contexto?.bases !== true) return null;
  const autor = identidadDe(eje, ev.sobre);
  if (!autor || ev.autor !== autor || !eje.clave(autor) || !ev.firma || ev.firmante !== autor) return null;
  if (!ev.movimientos.some((m) => m.token === 'T' && m.de === autor && m.a === null)) return null;
  const c = ev.contexto;
  if (Object.keys(c).sort().join(',') !== CLAVES_CONTEXTO) return null;
  if (!Number.isSafeInteger(c.n) || !Number.isSafeInteger(c.nSubarbol) || !Number.isSafeInteger(c.sinBase) || c.sinBase < 0) return null;
  if (typeof c.hasta !== 'string' || typeof c.epoca !== 'string' || !c.epoca) return null;
  const leida = baseDePayload(ev.payload);
  if (!leida || leida.hijos.n !== c.n || leida.subarbol.n !== c.nSubarbol) return null;
  const { refsHijos, refsBases } = leida;
  if (refsHijos.length !== c.n || refsHijos.at(-1) !== c.hasta) return null;
  if (previos.length < c.n || refsHijos.some((id, i) => previos[i].id !== id)) return null;
  const fundidas = new Map();
  for (const id of refsBases) {
    const evB = eje.obtener(id);
    if (!evB || !refsHijos.includes(evB.sobre) || fundidas.has(evB.sobre)) return null;
    const b = particion(eje, evB.sobre).bases.find((x) => x.id === id);
    if (!b) return null;
    fundidas.set(evB.sobre, b);
  }
  if (leida.subarbol.n !== 1 + refsHijos.reduce((s, h) => s + (fundidas.get(h)?.subarbol.n ?? 1), 0)) return null;
  if (c.sinBase > refsHijos.length - fundidas.size) return null;
  return Object.freeze({
    id: ev.id,
    autor,
    t: ev.t,
    registro: ev.sobre,
    epoca: c.epoca,
    hasta: c.hasta,
    sinBase: c.sinBase,
    hijos: leida.hijos,
    subarbol: leida.subarbol,
    refsHijos,
    refsBases,
  });
}

// --- Escribir y leer el 8 ----------------------------------------------------

/**
 * Escribe la base de un registro en su 8 (sobre: registro, en: CIELO). La
 * escribe la propia cosa (identidadDe), firmando con su clave privada, y
 * gasta su T (COSTE_BASE). Contexto { bases: true, n, nSubarbol, hasta,
 * epoca, sinBase }; el payload lleva las dos estadísticas y las referencias
 * a lo medido. Corregir = volver a escribir: la anterior queda en el 8.
 */
export async function escribirBase(eje, { registro, privada, t = new Date().toISOString(), epoca = EPOCA_0 }) {
  if (!eje.obtener(registro)) throw new Error('registro desconocido: ' + registro);
  const autor = identidadDe(eje, registro);
  if (!autor) throw new Error('la base la escribe la propia cosa: ' + registro.slice(0, 8) + ' no tiene identidad propia con clave');
  if (!privada) throw new Error('una base va firmada: falta la clave privada de ' + autor);
  const calculada = calcularBase(eje, registro, { epoca });
  if (calculada.hijos.n === 0) throw new Error('nada que medir: ' + registro.slice(0, 8) + ' no tiene hijos');
  return eje.escribir({
    autor,
    sobre: registro,
    en: CIELO,
    t,
    movimientos: [{ ...COSTE_BASE, de: autor, a: null }],
    payload: payloadDeBase(calculada),
    contexto: {
      bases: true,
      n: calculada.hijos.n,
      nSubarbol: calculada.subarbol.n,
      hasta: calculada.hasta,
      epoca: calculada.epoca,
      sinBase: calculada.sinBase.length,
    },
  }, privada);
}

/**
 * Frescura de una base leída, sin releer registros: lo LLEGADO desde que se
 * escribió. hijosNuevos = hijos del registro llegados después de «hasta»;
 * basesNuevas = hijos medidos cuya base vigente ya no es la fundida (o que
 * no la tenían); debajo = lo mismo, sumado, en las bases fundidas que siguen
 * vigentes, a cualquier altura. sinNovedades si todo es cero.
 * No ve cambios en lo ya medido (escritos sobre un hijo sin base, fórmulas
 * que se resuelven): eso lo dice comprobar(), que recalcula.
 * [X] decidir VG: qué es la frescura de una base (el mapa solo dice que la
 * lleva); aquí, sus llegadas, y aparte la comprobación.
 */
export function frescura(eje, base) {
  const lista = hijos(eje, base.registro);
  const i = lista.findIndex((h) => h.id === base.hasta);
  const hijosNuevos = lista.length - 1 - i;
  const fundidas = new Map(base.refsBases.map((id) => [eje.obtener(id).sobre, id]));
  let basesNuevas = 0;
  let debajo = 0;
  for (const h of lista.slice(0, i + 1)) {
    const vigente = ultimaBase(eje, h.id);
    if (!vigente) continue;
    if (vigente.id !== fundidas.get(h.id)) basesNuevas++;
    else {
      const f = frescura(eje, vigente);
      debajo += f.hijosNuevos + f.basesNuevas + f.debajo;
    }
  }
  return { t: base.t, hijosNuevos, basesNuevas, debajo, sinNovedades: hijosNuevos + basesNuevas + debajo === 0 };
}

const distintasEntre = (a, b) => {
  const fuera = [];
  if (a.n !== b.n) fuera.push('n');
  for (const grupo of ['medidas', 'tokens']) {
    for (const k of [...new Set([...Object.keys(a[grupo]), ...Object.keys(b[grupo])])].sort()) {
      if (JSON.stringify(a[grupo][k] ?? null) !== JSON.stringify(b[grupo][k] ?? null)) fuera.push(k);
    }
  }
  if (JSON.stringify(a.posiciones) !== JSON.stringify(b.posiciones)) fuera.push('posiciones por PV');
  if (a.raiz !== b.raiz) fuera.push('raiz');
  return fuera;
};

/**
 * Comprueba una base contra lo que hay ahora: recalcula la base del registro
 * (calcularBase, con la época dada) y la compara, y baja a las bases
 * fundidas que siguen vigentes. Relee registros: es la comprobación, no la
 * lectura. Lo que cuelga de un hijo sin base no se comprueba (no se midió).
 * Devuelve { alDia, diferencias: [{ registro, base, refs, hijos, subarbol }] },
 * con lo que difiere en cada estadística.
 */
export function comprobar(eje, base, { epoca = EPOCA_0 } = {}) {
  const diferencias = [];
  const revisar = (b) => {
    const ahora = calcularBase(eje, b.registro, { epoca });
    const iguales = (x, y) => x.length === y.length && x.every((v, k) => v === y[k]);
    const refs = !iguales(b.refsHijos, ahora.refsHijos) || !iguales(b.refsBases, ahora.refsBases);
    const d = { hijos: distintasEntre(b.hijos, ahora.hijos), subarbol: distintasEntre(b.subarbol, ahora.subarbol) };
    if (refs || d.hijos.length || d.subarbol.length) diferencias.push({ registro: b.registro, base: b.id, refs, ...d });
    for (const id of b.refsBases) {
      const fundida = basePorId(eje, id);
      if (ultimaBase(eje, fundida.registro)?.id === id) revisar(fundida);
    }
  };
  revisar(base);
  return { alDia: diferencias.length === 0, diferencias };
}

/**
 * La base más reciente (por llegada) escrita en el 8 de `id`, o null:
 * { id, autor, t, registro, epoca, hasta, sinBase, hijos, subarbol,
 * refsHijos, refsBases, anteriores (bases válidas anteriores en ese 8:
 * colisiones), frescura }. Solo cuentan las bases válidas (leerSiEsBase):
 * las que firma la propia cosa; lo demás escrito en el 8 es un hijo más.
 * [X] decidir VG: «más reciente» por llegada, no por t.
 */
export function leerBase(eje, id) {
  if (!eje.obtener(id)) throw new Error('registro desconocido: ' + id);
  const lista = particion(eje, id).bases;
  const base = lista.at(-1);
  if (!base) return null;
  return { ...base, anteriores: lista.length - 1, frescura: frescura(eje, base) };
}

// Si la base mide al foco: en los hijos, si es uno de ellos; en el subárbol,
// bajando por el hilo del foco a través de las bases fundidas.
function incluidoEn(eje, base, seccion, foco) {
  if (seccion === 'hijos') return base.refsHijos.includes(foco);
  if (foco === base.registro) return true;
  const camino = eje.hilo(foco).map((e) => e.id).reverse();
  const i = camino.indexOf(base.registro);
  const siguiente = camino[i + 1];
  if (i < 0 || !base.refsHijos.includes(siguiente)) return false;
  if (siguiente === foco) return true;
  const fundida = base.refsBases.map((id) => basePorId(eje, id)).find((b) => b.registro === siguiente);
  return fundida ? incluidoEn(eje, fundida, 'subarbol', foco) : false;
}

// El registro cuyo 8 resume la cohorte del foco, y qué estadística de su base se lee.
function cohorteDe(eje, foco, alcance) {
  if (!ALCANCES.includes(alcance)) throw new Error('alcance desconocido: ' + alcance + ' (' + ALCANCES.join(', ') + ')');
  if (alcance === 'hermanos') return { registro: eje.obtener(foco).sobre, seccion: 'hijos' };
  return { registro: alcance === 'proyecto' ? proyectoDe(eje, foco).id : eje.genesisId, seccion: 'subarbol' };
}

// Un bloque de la base con el foco situado en él (como tiempo.distribucion, más lo que la caja deja alrededor).
function situado(bloque, valor) {
  const k = cajaDe(valor, bloque.cortes);
  const suma = (l) => l.reduce((s, c) => s + c, 0);
  return {
    ...bloque,
    cortes: [...bloque.cortes],
    cajas: [...bloque.cajas],
    foco: valor,
    caja: k,
    hito: HITOS[k],
    enCaja: bloque.cajas[k],
    debajo: suma(bloque.cajas.slice(0, k)),
    encima: suma(bloque.cajas.slice(k + 1)),
    media: bloque.n ? bloque.suma / bloque.n : null,
  };
}

/**
 * Sitúa el foco en una cohorte leyendo el 8 que la resume, con la forma de
 * tiempo.confluir(): hermanos → los hijos del 8 del padre; proyecto → el
 * subárbol del 8 del proyecto (tiempo.proyectoDe); general → el subárbol del
 * 8 del génesis. Cada medida del foco se coloca con los cortes guardados en
 * la base.
 * Devuelve { alcance, foco, registro, seccion, estado, ... }: estado
 * 'RESUELTO' con base, n, frescura, incluido (si la base mide al foco),
 * cambiadas (medidas en las que el foco, medido ahora, cae en una caja vacía
 * aunque la base lo incluya: ha cambiado desde entonces), medidas y tokens
 * ({ <clave>: { n, suma, minimo, maximo, cortes, origenCortes, cajas, foco,
 * caja, hito, enCaja, debajo, encima, media } }, los tokens con su
 * etiqueta), posiciones (por PV: comparables, propias, referencias,
 * escritas, proporcion, foco, delFoco) y raiz; o 'PENDIENTE' con motivo
 * (sin cohorte o sin base). No asigna nivel ni grado: el hito es la
 * etiqueta de la caja.
 */
export function situar(eje, foco, { alcance = 'hermanos', epoca = EPOCA_0 } = {}) {
  if (!eje.obtener(foco)) throw new Error('registro desconocido: ' + foco);
  const { registro, seccion } = cohorteDe(eje, foco, alcance);
  const comun = { alcance, foco, registro, seccion };
  if (registro === null) return { ...comun, estado: 'PENDIENTE', motivo: 'sin cohorte: el génesis no tiene padre' };
  const base = leerBase(eje, registro);
  if (!base) return { ...comun, estado: 'PENDIENTE', motivo: 'sin base en el 8 de ' + registro.slice(0, 8) };
  const est = base[seccion];
  const m = medir(eje, foco);
  const medidas = {};
  for (const clave of clavesDeMedidas()) medidas[clave] = situado(est.medidas[clave], m[clave]);
  const tokens = {};
  for (const clave of [...new Set([...Object.keys(est.tokens), ...Object.keys(m.tokens)])].sort()) {
    tokens[clave] = { etiqueta: etiquetaClave(clave), ...situado(bloqueDe(est, clave, epoca), m.tokens[clave] ?? 0) };
  }
  const posiciones = est.posiciones.map((p, i) => {
    const { propia, referencia, escrita, tiene } = m.procedencias[i];
    return { indice: i, significado: epoca.reglaCorta(0, i), ...p, proporcion: p.comparables / est.n, foco: tiene, delFoco: { propia, referencia, escrita } };
  });
  const incluido = incluidoEn(eje, base, seccion, foco);
  const cambiadas = incluido ? [...Object.entries(medidas), ...Object.entries(tokens)].filter(([, x]) => x.enCaja === 0).map(([k]) => k) : [];
  return {
    ...comun,
    estado: 'RESUELTO',
    base: base.id,
    n: est.n,
    frescura: base.frescura,
    incluido,
    cambiadas,
    medidas,
    tokens,
    posiciones,
    raiz: { comparables: est.raiz, proporcion: est.raiz / est.n, foco: m.raiz.escrita },
  };
}

// --- BASES() en BQL -----------------------------------------------------------

/** Lo que BASES(alcance, medida, campo) puede pedir de la base, además de una caja 0–9. */
export const CAMPOS_BASE = Object.freeze(['suma', 'minimo', 'maximo', 'media']);

/** Lo que BASES(alcance, medida, campo) puede pedir del anfitrión situado en la cohorte. */
export const CAMPOS_FOCO = Object.freeze(['foco', 'caja', 'enCaja', 'debajo', 'encima']);

/**
 * Valor de BASES() en BQL para el registro anfitrión `id` (src/bql.js lo
 * llama con los argumentos ya evaluados, números o textos):
 *   BASES()                          n de la base vigente del 8 del anfitrión (sus hijos)
 *   BASES(alcance)                   n de la cohorte (hermanos, proyecto o general)
 *   BASES(alcance, medida)           la caja (0–9) del anfitrión en esa cohorte
 *   BASES(alcance, medida, k)        cuántos hay en la caja k (0–9)
 *   BASES(alcance, medida, campo)    suma, minimo, maximo, media (de la base) o
 *                                    foco, caja, enCaja, debajo, encima (del anfitrión)
 * La medida es una de tiempo.MEDIDAS o una clave de serie de token ("T:hora").
 * Devuelve { estado, valor?, motivo?, base?, registro?, mideAnfitrion }:
 * RESUELTO con un número; PENDIENTE sin cohorte o sin base; ERROR con
 * argumentos que no valen. `base` es el id de la base leída (la dependencia
 * de la fórmula) y `registro` el de su 8; mideAnfitrion, si hubo que medir
 * al anfitrión. Dentro de su propia medida queda PENDIENTE (no se mide a sí
 * mismo).
 * [X] decidir VG: la firma de BASES() (el mapa solo la nombra).
 */
export function valorDeBases(eje, id, args = []) {
  const error = (motivo) => ({ estado: 'ERROR', motivo: 'BASES: ' + motivo, mideAnfitrion: false });
  if (!eje.obtener(id)) return error('registro desconocido');
  if (args.length === 0) {
    const b = leerBase(eje, id);
    if (!b) return { estado: 'PENDIENTE', motivo: 'sin base en el 8 de ' + id.slice(0, 8), mideAnfitrion: false };
    return { estado: 'RESUELTO', valor: b.hijos.n, base: b.id, registro: id, mideAnfitrion: false };
  }
  const [alcance, medida, campo] = args;
  if (args.length > 3) return error('como mucho tres argumentos');
  if (!ALCANCES.includes(alcance)) return error('el alcance es ' + ALCANCES.join(', '));
  if (medida !== undefined && !esMedida(medida)) return error('medida desconocida: ' + medida);
  const esCaja = Number.isInteger(campo) && campo >= 0 && campo < ARIDAD;
  if (campo !== undefined && !esCaja && !CAMPOS_BASE.includes(campo) && !CAMPOS_FOCO.includes(campo)) {
    return error('pide una caja 0–9 o ' + [...CAMPOS_BASE, ...CAMPOS_FOCO].join(', '));
  }
  const mideAnfitrion = medida !== undefined && !esCaja && !CAMPOS_BASE.includes(campo);
  const { registro, seccion } = cohorteDe(eje, id, alcance);
  if (registro === null) return { estado: 'PENDIENTE', motivo: 'sin cohorte: el génesis no tiene padre', mideAnfitrion: false };
  const base = leerBase(eje, registro);
  if (!base) return { estado: 'PENDIENTE', motivo: 'sin base en el 8 de ' + registro.slice(0, 8), mideAnfitrion: false };
  const est = base[seccion];
  const con = (r) => ({ ...r, base: base.id, registro, mideAnfitrion });
  if (medida === undefined) return con({ estado: 'RESUELTO', valor: est.n });
  const bloque = bloqueDe(est, medida);
  if (esCaja) return con({ estado: 'RESUELTO', valor: bloque.cajas[campo] });
  if (campo === 'media') return con({ estado: 'RESUELTO', valor: bloque.suma / bloque.n });
  if (CAMPOS_BASE.includes(campo)) return con({ estado: 'RESUELTO', valor: bloque[campo] });
  if (MIDIENDO.has(id)) return con({ estado: 'PENDIENTE', motivo: 'BASES no se evalúa mientras se mide su propio registro' });
  const m = medir(eje, id);
  const valor = esClaveToken(medida) ? m.tokens[medida] ?? 0 : m[medida];
  return con({ estado: 'RESUELTO', valor: situado(bloque, valor)[campo ?? 'caja'] });
}
