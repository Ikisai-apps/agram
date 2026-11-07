// Bases del 8: las estadísticas son REGISTROS escritos en la posición 8 (el
// cielo) del registro que resumen, con referencias a lo medido; no hay base
// de datos aparte (VG, 7-11, mapa §12 «Cohortes y bases del 8»).
//
//   - Medidas FUNDIBLES: recuentos por registro; por medida, n, suma, mínimo,
//     máximo y un histograma de diez cajas: una décupla de recuentos cuyas
//     diez posiciones son los diez niveles/hitos del 8 (HITOS, solo como
//     etiquetas de caja: nada asigna nivel ni grado al foco).
//   - Fundir dos bases es sumar caja a caja: O(1) respecto a lo medido.
//   - El 8 del padre guarda la base de sus hijos (los hermanos entre sí); el
//     8 del proyecto funde las bases de sus hijos; el del génesis, las de los
//     proyectos. Fundir hacia arriba no relee registros.
//   - Corregir es escribir otra base: la anterior queda como colisión en el 8.
//   - La base lleva fecha (la del evento) y frescura (cuántos hijos han
//     llegado desde el último medido, «hasta»).
//   - El foco se sitúa en su caja, por medida, en cada cohorte: hermanos (el
//     8 del padre), proyecto (el 8 del proyecto) y general (el 8 del génesis).
//
// Lo que el mapa no decide va marcado «[X] decidir VG».

import { ARIDAD, esReferencia } from './btml.js';
import { claveToken } from './tokens.js';
import { contarPosiciones } from './modos.js';
import { esFormula, evaluar } from './bql.js';
import { HITOS } from './tiempo.js';

/** La posición 8 (el cielo) en la raíz del registro: ahí se anclan sus bases. */
export const CIELO = '8000000000';

/** Representación (posición 0) del payload de una base. */
export const TITULO = 'Bases del 8';

/** Las tres cohortes útiles (VG, 7-11): elementos similares, dónde estoy, el ámbito. */
export const COHORTES = Object.freeze(['hermanos', 'proyecto', 'general']);

/**
 * Etiquetas de las diez cajas: los diez hitos heredados del 8. Solo etiquetas.
 * Se reexporta el enlace (no se copia al cargar): bql.js importa este módulo
 * y tiempo.js importa bql.js, así que HITOS puede no existir aún cuando esto
 * se carga; las funciones lo leen al llamarse.
 */
export { HITOS as ETIQUETAS };

/**
 * Coste de escribir una base: un minuto de T del autor, como la ejecución.
 * [X] decidir VG: el coste de una base (con la regla de escritura, un minuto
 * por posición, serían cientos de minutos: cada medida ocupa trece posiciones).
 */
export const COSTE_BASE = Object.freeze({ token: 'T', escala: 'minuto', cantidad: 1 });

// Cortes: nueve umbrales crecientes parten los valores en diez cajas. La caja
// k reúne los valores v con cortes[k-1] <= v < cortes[k]; la 0, lo que queda
// por debajo del primero; la 9, desde el último.
const LINEAL = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9]);
const RECUENTOS = Object.freeze([1, 2, 3, 4, 6, 10, 16, 26, 42]);

/** Medidas de la estructura: posiciones desarrolladas en cada PV (raíz del payload). */
export const MEDIDAS_PV = Object.freeze([...Array(ARIDAD).keys()].map((k) => 'posiciones.' + k));

/** Medidas del registro: posiciones del payload entero, escritos encima, identidades, profundidad del hilo y fórmulas. */
export const MEDIDAS_REGISTRO = Object.freeze(['posiciones', 'escritos', 'identidades', 'profundidad', 'formulas.resueltas', 'formulas.pendientes']);

/** Medidas fijas de toda base. Además, una 'movimientos.<clave de serie>' por cada serie de token movida (T:hora, E:casa/EUR…). */
export const MEDIDAS = Object.freeze([...MEDIDAS_PV, ...MEDIDAS_REGISTRO]);

/** Prefijo de las medidas por serie de token. */
export const MOVIMIENTOS = 'movimientos.';

/**
 * Cortes de caja fijos por medida. Las de movimientos comparten los de
 * 'movimientos'. [X] decidir VG: cortes = regla de la época (aquí, una
 * constante de la época 0 que la época aún no declara).
 */
export const CORTES = Object.freeze({
  ...Object.fromEntries(MEDIDAS_PV.map((m) => [m, RECUENTOS])),
  posiciones: RECUENTOS,
  escritos: RECUENTOS,
  identidades: LINEAL,
  profundidad: LINEAL,
  'formulas.resueltas': LINEAL,
  'formulas.pendientes': LINEAL,
  movimientos: LINEAL,
});

/** Versión de los cortes: va en cada base escrita; no se funden bases con cortes distintos (no se inventa escala puente). */
export const VERSION_CORTES = 'cortes-0';

/** Cortes de una medida. */
export function cortesDe(medida) {
  const c = medida.startsWith(MOVIMIENTOS) ? CORTES.movimientos : CORTES[medida];
  if (!c) throw new Error('medida desconocida: ' + medida);
  return c;
}

/** Caja (0–9) en la que cae un valor de una medida. */
export function caja(medida, valor) {
  const c = cortesDe(medida);
  let k = 0;
  while (k < c.length && valor >= c[k]) k++;
  return k;
}

/** Si un evento se presenta como base: anclado en el 8 (CIELO) con contexto.bases. Que sea válida lo dice leerBase. */
export function esBase(ev) {
  return ev?.contexto?.bases === true && ev.en === CIELO;
}

/** Hijos de un registro sin sus bases: las bases no son hermanas de lo que miden. Orden de llegada. */
export function hijos(eje, id) {
  return eje.sobre(id).filter((e) => !esBase(e));
}

/**
 * Medidas fundibles de un registro (recuentos):
 * - 'posiciones.k': posiciones desarrolladas (terminales) bajo la posición k
 *   de la raíz, k = 0…9. Un payload terminal no tiene posición 0: suma 1 en
 *   'posiciones' y 0 en cada PV.
 * - 'posiciones': las del payload entero; 'escritos': registros escritos
 *   encima, sin contar bases; 'identidades': distintas entre el autor y los
 *   movimientos; 'profundidad': del hilo (génesis = 0).
 * - 'formulas.resueltas' y 'formulas.pendientes': fórmulas BQL del payload,
 *   evaluadas ahora; pendiente = no resuelta (PENDIENTE, INCOMPATIBLE o
 *   ERROR). [X] decidir VG: si INCOMPATIBLE y ERROR cuentan aparte.
 * - 'movimientos.<clave>': movimientos de cada serie de token
 *   ('movimientos.T:hora', 'movimientos.E:casa/EUR'…); sin conversión ni
 *   suma entre series.
 */
export function medir(eje, id) {
  const ev = eje.obtener(id);
  if (!ev) throw new Error('registro desconocido: ' + id);
  const p = ev.payload;
  const m = {};
  for (let k = 0; k < ARIDAD; k++) m[MEDIDAS_PV[k]] = Array.isArray(p) && p[k] !== undefined ? contarPosiciones(p[k]) : 0;
  m.posiciones = contarPosiciones(p);
  m.escritos = hijos(eje, id).length;
  const ids = new Set([ev.autor]);
  for (const mv of ev.movimientos) {
    if (mv.de) ids.add(mv.de);
    if (mv.a) ids.add(mv.a);
  }
  m.identidades = ids.size;
  m.profundidad = eje.hilo(id).length - 1;
  const f = { resueltas: 0, pendientes: 0 };
  const visitar = (nodo, indices) => {
    if (Array.isArray(nodo)) return nodo.forEach((h, i) => visitar(h, [...indices, i]));
    if (!esFormula(nodo)) return;
    let estado;
    try {
      estado = evaluar(eje, id, indices).estado;
    } catch {
      estado = 'ERROR';
    }
    if (estado === 'RESUELTO') f.resueltas++;
    else f.pendientes++;
  };
  visitar(p, []);
  m['formulas.resueltas'] = f.resueltas;
  m['formulas.pendientes'] = f.pendientes;
  for (const mv of ev.movimientos) {
    const k = MOVIMIENTOS + claveToken(mv);
    m[k] = (m[k] ?? 0) + 1;
  }
  return m;
}

// --- Bases en memoria ------------------------------------------------------
// base = { cortes, n, medidas: { <medida>: { cajas: [10], suma, minimo, maximo } } }
// Toda medida cubre los n registros: una serie que no aparece en una base
// vale cero en sus n registros (así fundir es exacto).

function bloqueCeros(medida, n) {
  const cajas = Array(ARIDAD).fill(0);
  cajas[caja(medida, 0)] = n;
  return { cajas, suma: 0, minimo: n ? 0 : null, maximo: n ? 0 : null };
}

function fundirBloques(x, y) {
  const extremo = (a, b, f) => (a === null ? b : b === null ? a : f(a, b));
  return {
    cajas: x.cajas.map((c, k) => c + y.cajas[k]),
    suma: x.suma + y.suma,
    minimo: extremo(x.minimo, y.minimo, Math.min),
    maximo: extremo(x.maximo, y.maximo, Math.max),
  };
}

/** Base vacía: el neutro de fundir. */
export function baseVacia() {
  return { cortes: VERSION_CORTES, n: 0, medidas: Object.fromEntries(MEDIDAS.map((m) => [m, bloqueCeros(m, 0)])) };
}

/** Base de un solo registro a partir de sus medidas: n = 1, una caja ocupada por medida. */
export function baseUnitaria(medidas) {
  const base = baseVacia();
  base.n = 1;
  for (const [m, v] of Object.entries(medidas)) {
    const b = bloqueCeros(m, 0);
    b.cajas[caja(m, v)] = 1;
    base.medidas[m] = { cajas: b.cajas, suma: v, minimo: v, maximo: v };
  }
  return base;
}

/**
 * Funde dos bases: suma caja a caja, suma las sumas y n, toma mínimo y
 * máximo. O(1) respecto a lo medido (dieciséis medidas fijas más las series).
 * No funde bases con cortes distintos ni de profundidades distintas.
 * Devuelve solo la estadística (sin referencias ni metadatos de registro).
 */
export function fundir(a, b) {
  if (a.cortes !== b.cortes) throw new Error('bases con cortes distintos (' + a.cortes + ', ' + b.cortes + '): no se inventa escala puente');
  if (a.profundidad !== undefined && b.profundidad !== undefined && a.profundidad !== b.profundidad) {
    throw new Error('bases de profundidades distintas (' + a.profundidad + ', ' + b.profundidad + '): miden cosas distintas');
  }
  const nombres = [...new Set([...Object.keys(a.medidas), ...Object.keys(b.medidas)])];
  const medidas = {};
  for (const m of nombres) medidas[m] = fundirBloques(a.medidas[m] ?? bloqueCeros(m, a.n), b.medidas[m] ?? bloqueCeros(m, b.n));
  const profundidad = a.profundidad ?? b.profundidad;
  return { cortes: a.cortes, n: a.n + b.n, medidas, ...(profundidad !== undefined ? { profundidad } : {}) };
}

/** Bloque de una medida en una base, aunque la base no la nombre (serie ausente = ceros). */
export function bloqueDe(base, medida) {
  return base.medidas[medida] ?? bloqueCeros(medida, base.n);
}

/** Las diez cajas de una medida con su etiqueta: [{ caja, nivel, nombre, cuenta }]. Etiquetas, no grados. */
export function cajasEtiquetadas(base, medida) {
  return bloqueDe(base, medida).cajas.map((cuenta, k) => ({ caja: k, nivel: HITOS[k].nivel, nombre: HITOS[k].nombre, cuenta }));
}

/**
 * Base de los hijos de un registro (hermanos entre sí), midiéndolos uno a
 * uno: { cortes, n, medidas, profundidad: 1, desde: 'hijos', registro,
 * hasta (id del último hijo medido o null), refs (ids medidos, en orden) }.
 * Las bases escritas sobre el registro no cuentan como hijos.
 * [X] decidir VG: si la cohorte de hermanos distingue la posición `en`
 * (hoy no, como `comparar`).
 */
export function baseDe(eje, padre) {
  if (!eje.obtener(padre)) throw new Error('registro desconocido: ' + padre);
  const lista = hijos(eje, padre);
  let base = baseVacia();
  for (const h of lista) base = fundir(base, baseUnitaria(medir(eje, h.id)));
  return { ...base, profundidad: 1, desde: 'hijos', registro: padre, hasta: lista.at(-1)?.id ?? null, refs: lista.map((h) => h.id) };
}

/**
 * Base de un registro a partir de las bases escritas en el 8 de sus hijos,
 * sin releer registros. `profundidad` es a cuántas generaciones por debajo
 * del registro están los registros medidos: los hijos aportan su base de
 * profundidad - 1. Sin `profundidad`, se toma la última base de cada hijo y
 * todas deben ser de la misma profundidad. Devuelve como `baseDe`, con
 * desde: 'bases', refs = ids de las bases fundidas, sinBase = hijos con
 * descendencia y sin base a esa profundidad (no cuentan: hay que escribirla
 * antes) y vacios = hijos sin descendencia.
 */
export function fundirHaciaArriba(eje, id, { profundidad } = {}) {
  if (!eje.obtener(id)) throw new Error('registro desconocido: ' + id);
  if (profundidad !== undefined && !(Number.isInteger(profundidad) && profundidad >= 2)) {
    throw new Error('fundir hacia arriba mide nietos o más abajo: profundidad >= 2 (la de los hijos es baseDe)');
  }
  const lista = hijos(eje, id);
  let p = profundidad;
  let encontradas;
  if (p === undefined) {
    encontradas = lista.map((h) => ultimaBase(eje, h.id));
    const ps = [...new Set(encontradas.filter(Boolean).map((b) => b.profundidad))];
    if (ps.length > 1) throw new Error('los hijos tienen bases de profundidades distintas (' + ps.join(', ') + '): indica { profundidad }');
    p = (ps[0] ?? 1) + 1;
  } else {
    encontradas = lista.map((h) => ultimaBase(eje, h.id, { profundidad: p - 1 }));
  }
  let base = baseVacia();
  const refs = [];
  const sinBase = [];
  const vacios = [];
  lista.forEach((h, i) => {
    const b = encontradas[i];
    if (b) {
      base = fundir(base, { cortes: b.cortes, n: b.n, medidas: b.medidas });
      refs.push(b.id);
    } else if (hijos(eje, h.id).length) sinBase.push(h.id);
    else vacios.push(h.id);
  });
  return { ...base, profundidad: p, desde: 'bases', registro: id, hasta: lista.at(-1)?.id ?? null, refs, sinBase, vacios };
}

// --- La base como payload BTML ---------------------------------------------
// [0] TITULO
// [1] n
// [2] décupla de bloques de MEDIDAS_PV (posiciones.0 … posiciones.9)
// [3] bloques de MEDIDAS_REGISTRO, en su orden
// [4] series: pares [clave de serie, bloque], por clave; en décuplas anidadas si pasan de diez
// [5] referencias {ref} a lo medido (o a las bases fundidas), en orden; anidadas si pasan de diez
// bloque = [cajas (diez recuentos), suma, mínimo, máximo]
// [X] decidir VG: la disposición del payload (aquí, una lista; podría ir por PV).

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

const bloqueAPayload = (b) => [[...b.cajas], b.suma, b.minimo, b.maximo];

/** Payload BTML de una base con n >= 1. */
export function payloadDeBase(base) {
  if (!(base.n >= 1)) throw new Error('una base escrita mide al menos un registro');
  const series = Object.keys(base.medidas).filter((m) => m.startsWith(MOVIMIENTOS)).sort();
  if (!series.length || !base.refs?.length) throw new Error('una base escrita lleva sus series y sus referencias');
  return [
    TITULO,
    base.n,
    MEDIDAS_PV.map((m) => bloqueAPayload(bloqueDe(base, m))),
    MEDIDAS_REGISTRO.map((m) => bloqueAPayload(bloqueDe(base, m))),
    empaquetar(series.map((m) => [m.slice(MOVIMIENTOS.length), bloqueAPayload(base.medidas[m])])),
    empaquetar(base.refs.map((id) => ({ ref: id }))),
  ];
}

function bloqueDePayload(x, n) {
  if (!Array.isArray(x) || x.length !== 4 || !Array.isArray(x[0]) || x[0].length !== ARIDAD) return null;
  const [cajas, suma, minimo, maximo] = x;
  if (!cajas.every((c) => Number.isSafeInteger(c) && c >= 0)) return null;
  if (cajas.reduce((s, c) => s + c, 0) !== n) return null;
  if (![suma, minimo, maximo].every(Number.isFinite) || minimo > maximo) return null;
  return { cajas: [...cajas], suma, minimo, maximo };
}

/** Lee la estadística y las referencias de un payload de base: { n, medidas, refs } o null si no es una base bien formada. */
export function baseDePayload(payload) {
  if (!Array.isArray(payload) || payload.length !== 6 || payload[0] !== TITULO) return null;
  const n = payload[1];
  if (!Number.isSafeInteger(n) || n < 1) return null;
  const [, , pv, reg, series, refs] = payload;
  if (!Array.isArray(pv) || pv.length !== MEDIDAS_PV.length || !Array.isArray(reg) || reg.length !== MEDIDAS_REGISTRO.length) return null;
  const medidas = {};
  for (const [lista, nombres] of [[pv, MEDIDAS_PV], [reg, MEDIDAS_REGISTRO]]) {
    for (let k = 0; k < nombres.length; k++) {
      const b = bloqueDePayload(lista[k], n);
      if (!b) return null;
      medidas[nombres[k]] = b;
    }
  }
  const pares = [];
  const aplanarPares = (nodo) => {
    if (!Array.isArray(nodo)) return false;
    if (typeof nodo[0] === 'string') return pares.push(nodo) && nodo.length === 2;
    return nodo.every(aplanarPares);
  };
  if (!aplanarPares(series) || !pares.length) return null;
  for (const [clave, x] of pares) {
    const b = bloqueDePayload(x, n);
    if (!b || medidas[MOVIMIENTOS + clave]) return null;
    medidas[MOVIMIENTOS + clave] = b;
  }
  const ids = [];
  const aplanarRefs = (nodo) => (esReferencia(nodo) ? ids.push(nodo.ref) > 0 : Array.isArray(nodo) && nodo.every(aplanarRefs));
  if (!aplanarRefs(refs) || !ids.length) return null;
  return { n, medidas, refs: ids };
}

// --- Escribir y leer el 8 ----------------------------------------------------

/**
 * Escribe la base de un registro como evento anclado en su 8 (sobre: padre,
 * en: CIELO), con contexto { bases: true, n, hasta, profundidad, desde,
 * cortes }. desde 'hijos' (por defecto) mide los hijos (baseDe); desde
 * 'bases' funde las bases de los hijos (fundirHaciaArriba, con
 * `profundidad` opcional). La escribe una identidad con clave, firmando, y
 * gasta su T (COSTE_BASE). Corregir = volver a escribir: la anterior queda.
 * [X] decidir VG: debería escribirla la propia cosa (el registro resumido,
 * como identidad con su clave); en los ejemplos la escribe la casa. Y quién
 * puede escribir bases (hoy, cualquiera con clave y T; es de AARPIA).
 */
export async function escribirBase(eje, { autor, padre, privada, t = new Date().toISOString(), desde = 'hijos', profundidad }) {
  if (!eje.obtener(padre)) throw new Error('registro desconocido: ' + padre);
  if (!eje.clave(autor)) throw new Error('una base la escribe una identidad con clave: ' + autor + ' no tiene');
  if (!privada) throw new Error('una base va firmada: falta la clave privada de ' + autor);
  let base;
  if (desde === 'hijos') {
    if (profundidad !== undefined && profundidad !== 1) throw new Error('la base de los hijos es de profundidad 1');
    base = baseDe(eje, padre);
  } else if (desde === 'bases') base = fundirHaciaArriba(eje, padre, { profundidad });
  else throw new Error('desde: hijos o bases');
  if (base.n === 0) {
    throw new Error(desde === 'hijos' ? 'nada que medir: ' + padre.slice(0, 8) + ' no tiene hijos' : 'nada que fundir: ningún hijo de ' + padre.slice(0, 8) + ' tiene base');
  }
  return eje.escribir({
    autor,
    sobre: padre,
    en: CIELO,
    t,
    movimientos: [{ ...COSTE_BASE, de: autor, a: null }],
    payload: payloadDeBase(base),
    contexto: { bases: true, n: base.n, hasta: base.hasta, profundidad: base.profundidad, desde: base.desde, cortes: base.cortes },
  }, privada);
}

/** Bases válidas escritas en el 8 de un registro, en orden de llegada (firmadas por una identidad con clave y bien formadas). */
function basesEn(eje, id, { profundidad, autor } = {}) {
  const lista = [];
  for (const ev of eje.sobre(id, CIELO)) {
    if (!esBase(ev) || !ev.firma || !eje.clave(ev.autor)) continue;
    if (autor !== undefined && ev.autor !== autor) continue;
    const p = ev.contexto.profundidad ?? 1;
    if (profundidad !== undefined && p !== profundidad) continue;
    const leida = baseDePayload(ev.payload);
    if (!leida || leida.n !== ev.contexto.n || (ev.contexto.cortes ?? VERSION_CORTES) !== VERSION_CORTES) continue;
    lista.push({
      id: ev.id,
      autor: ev.autor,
      t: ev.t,
      registro: id,
      cortes: ev.contexto.cortes ?? VERSION_CORTES,
      profundidad: p,
      desde: ev.contexto.desde ?? 'hijos',
      hasta: ev.contexto.hasta ?? null,
      ...leida,
    });
  }
  return lista;
}

function ultimaBase(eje, id, filtro) {
  return basesEn(eje, id, filtro).at(-1) ?? null;
}

/**
 * Frescura de una base leída: hijosNuevos = hijos del registro llegados
 * después de «hasta»; basesNuevas (solo las fundidas) = hijos hasta «hasta»
 * cuya base vigente no es la que se fundió. alDia si ambas son cero.
 */
export function frescura(eje, base) {
  const lista = hijos(eje, base.registro);
  const i = base.hasta === null ? -1 : lista.findIndex((h) => h.id === base.hasta);
  const hijosNuevos = lista.length - 1 - i;
  let basesNuevas = 0;
  if (base.desde === 'bases') {
    const fundidas = new Set(base.refs);
    for (const h of lista.slice(0, i + 1)) {
      const vigente = ultimaBase(eje, h.id, { profundidad: base.profundidad - 1 });
      if (vigente && !fundidas.has(vigente.id)) basesNuevas++;
    }
  }
  return { t: base.t, hijosNuevos, basesNuevas, alDia: hijosNuevos === 0 && basesNuevas === 0 };
}

/**
 * La base más reciente (por llegada) escrita en el 8 de `id`, o null:
 * { id, autor, t, registro, cortes, profundidad, desde, hasta, n, medidas,
 * refs, anteriores (bases válidas anteriores en ese 8: colisiones), frescura }.
 * Filtros: `profundidad` y `autor`. Solo cuentan bases firmadas por una
 * identidad con clave y bien formadas; lo demás escrito en el 8 se ignora.
 */
export function leerBase(eje, id, filtro = {}) {
  if (!eje.obtener(id)) throw new Error('registro desconocido: ' + id);
  const lista = basesEn(eje, id, filtro);
  const base = lista.at(-1);
  if (!base) return null;
  return { ...base, anteriores: lista.length - 1, frescura: frescura(eje, base) };
}

/**
 * Proyecto de un registro: el del hilo que cuelga del génesis (un proyecto
 * es su propio proyecto; el génesis no tiene). [X] decidir VG: qué registro
 * es «el proyecto».
 */
export function proyectoDe(eje, id) {
  const hilo = eje.hilo(id);
  return hilo.length >= 2 ? hilo[hilo.length - 2].id : null;
}

/**
 * Sitúa el foco en las cajas de una cohorte, leyendo el 8 que la resume:
 * hermanos → el 8 del padre (profundidad 1); proyecto → el 8 del proyecto
 * (o del registro `proyecto` dado, que ha de estar en el hilo); general → el
 * 8 del génesis. La profundidad es la distancia del foco a ese registro, así
 * que la cohorte son los registros a la misma altura que el foco.
 * Devuelve { cohorte, foco, registro, profundidad, estado, ... }:
 * estado 'RESUELTO' con base, n, frescura, incluido (si la base de hermanos
 * mide al foco; null en las fundidas) y medidas: { <medida>: { valor, caja,
 * etiqueta, enCaja, debajo, encima, minimo, maximo, media } }; o 'PENDIENTE'
 * con motivo (sin cohorte o sin base). No asigna nivel ni grado: la etiqueta
 * es la de la caja.
 */
export function situar(eje, foco, { cohorte = 'hermanos', proyecto, autor } = {}) {
  const ev = eje.obtener(foco);
  if (!ev) throw new Error('registro desconocido: ' + foco);
  if (!COHORTES.includes(cohorte)) throw new Error('cohorte desconocida: ' + cohorte + ' (' + COHORTES.join(', ') + ')');
  const hilo = eje.hilo(foco).map((e) => e.id);
  let registro = null;
  if (cohorte === 'hermanos') registro = ev.sobre;
  else if (cohorte === 'general') registro = eje.genesisId;
  else {
    registro = proyecto ?? proyectoDe(eje, foco);
    if (proyecto !== undefined && !hilo.includes(proyecto)) throw new Error('el proyecto no está en el hilo del foco');
  }
  const profundidad = registro === null ? 0 : hilo.indexOf(registro);
  const comun = { cohorte, foco, registro, profundidad };
  if (registro === null || profundidad < 1) {
    return { ...comun, estado: 'PENDIENTE', motivo: 'sin cohorte: ' + (registro === null ? 'el foco no tiene ' + (cohorte === 'hermanos' ? 'padre' : 'proyecto') : 'el foco es el propio registro') };
  }
  const base = leerBase(eje, registro, { profundidad, ...(autor !== undefined ? { autor } : {}) });
  if (!base) return { ...comun, estado: 'PENDIENTE', motivo: 'sin base en el 8 de ' + registro.slice(0, 8) + ' a profundidad ' + profundidad };
  const valores = medir(eje, foco);
  const series = [...new Set([...Object.keys(base.medidas), ...Object.keys(valores)].filter((m) => m.startsWith(MOVIMIENTOS)))].sort();
  const medidas = {};
  for (const m of [...MEDIDAS, ...series]) {
    const b = bloqueDe(base, m);
    const valor = valores[m] ?? 0;
    const k = caja(m, valor);
    const suma = (l) => l.reduce((s, c) => s + c, 0);
    medidas[m] = {
      valor,
      caja: k,
      etiqueta: HITOS[k],
      enCaja: b.cajas[k],
      debajo: suma(b.cajas.slice(0, k)),
      encima: suma(b.cajas.slice(k + 1)),
      minimo: b.minimo,
      maximo: b.maximo,
      media: b.suma / base.n,
    };
  }
  return {
    ...comun,
    estado: 'RESUELTO',
    base: base.id,
    n: base.n,
    frescura: base.frescura,
    incluido: base.desde === 'hijos' ? base.refs.includes(foco) : null,
    medidas,
  };
}
