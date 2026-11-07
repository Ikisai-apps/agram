// Bases del 8: una sola verdad, la ESCRITA (VG, 7-11 noche, mapa §14.2 y §12
// [D] «Una sola verdad del 8»). Las estadísticas son REGISTROS escritos en la
// posición 8 (el cielo) del registro que resumen, con referencias a lo medido
// y «hasta» (el último hijo que cubren); no hay base de datos aparte.
//
//   - medir(eje, id) es la ÚNICA medida de un registro (este módulo): recuentos
//     por PV (con su procedencia), terminales, escritos, movimientos (también
//     por serie de token), identidades, profundidad del hilo y fórmulas
//     resueltas y pendientes. tiempo.js ya no mide.
//   - Lo medido es FUNDIBLE: por medida y por serie, n, suma, mínimo, máximo y
//     diez cajas (fundir suma caja a caja: O(1) respecto a lo medido; es
//     asociativo y conmutativo, con la estadística vacía como neutro).
//   - Cortes de las cajas = regla de la época: epoca.cortes(medida). La época
//     0 trae la escala provisional 1 2 3 4 6 10 16 26 42 (decisión 2 de VG,
//     7-11 noche); cada base guarda con qué cortes se escribió. Las diez
//     etiquetas de caja (HITOS) son texto informativo, nunca un juicio.
//   - La base de un registro X = el fundido de las medidas de sus hijos (los
//     hermanos entre sí) y el de su subárbol (X más la base vigente del 8 de
//     cada hijo, sin releer registros: el 8 del proyecto funde las bases de sus
//     hijos; el del génesis, las de los proyectos). La escribe en el 8 de X la
//     propia cosa X (su identidad, si la tiene) o quien tiene P sobre X,
//     firmando y gastando su T (COSTE_BASE). Corregir = escribir otra; la
//     anterior queda como colisión en el 8.
//   - Las tres cohortes (ALCANCES) se LEEN del 8 del padre (hermanos), del
//     proyecto o del génesis (situar), nunca recorriendo el eje.
//   - confluir() queda solo como respaldo declarado: calcula al vuelo, con las
//     mismas funciones (medir, unitaria, fundir), lo que leería el 8 si cada
//     registro tuviera su base al día, y lo dice (frescura: «sin base escrita»).
//     Se retira comparar() de tiempo.js y su puntuación con pesos.
//   - BASES(), CAJA() y FRESCURA() en BQL leen esto (src/bql.js) con el gancho
//     puedeLeer y el presupuesto de la fórmula.
//
// Lo que el mapa no decide va marcado «[X] decidir VG».

import { ARIDAD, esReferencia, indicesDe } from './btml.js';
import { EPOCA_0, epocaDe } from './epocas.js';
import { AMBITO_GENESIS, claveToken, cantidadBase, partirClave } from './tokens.js';
import { ocupantes } from './encaje.js';
// bql.js importa este módulo (BASES, CAJA, FRESCURA): la importación es
// circular, así que de bql.js solo se usa dentro de funciones, nunca al cargar.
import { esFormula, evaluar } from './bql.js';

/** La posición 8 (el cielo) en la raíz del registro: ahí se anclan sus bases. */
export const CIELO = '8000000000';

/** Representación (posición 0) del payload de una base. */
export const TITULO = 'Bases del 8';

/** Las dos estadísticas de una base: los hijos del registro y su subárbol (él incluido). */
export const SECCIONES = Object.freeze(['hijos', 'subarbol']);

/** Lo que dice una lectura del 8 cuando no hay base escrita y se calcula al vuelo (respaldo). */
export const SIN_BASE_ESCRITA = 'sin base escrita';

/**
 * Coste de escribir una base: un minuto de T de quien la escribe, como la ejecución.
 * [X] decidir VG: el coste de una base (con la regla de escritura, un minuto
 * por posición, serían cientos de minutos: una base ocupa cientos de posiciones).
 */
export const COSTE_BASE = Object.freeze({ token: 'T', escala: 'minuto', cantidad: 1 });

/**
 * Las diez etiquetas de caja del 8 (índice → nivel.grado), literales del mapa
 * (§2.2 [D20]; auditoría C32). Texto informativo de la caja, nunca un juicio
 * (decisión 2 de VG, 7-11 noche): nada asigna nivel ni grado al foco.
 */
export const HITOS = Object.freeze([
  { indice: 0, nivel: '0.3', nombre: 'idea' },
  { indice: 1, nivel: '1.1', nombre: 'aprendizaje' },
  { indice: 2, nivel: '2.1', nombre: 'avanzado' },
  { indice: 3, nivel: '3.1', nombre: 'aprendizaje profesional' },
  { indice: 4, nivel: '3.2', nombre: 'resolución profesional' },
  { indice: 5, nivel: '4.1', nombre: 'aprendizaje superior' },
  { indice: 6, nivel: '4.2', nombre: 'solución profesional avanzada' },
  { indice: 7, nivel: '5.1', nombre: 'investigación' },
  { indice: 8, nivel: '5.2', nombre: 'trabajo maestro' },
  { indice: 9, nivel: '5.3', nombre: 'resolución experimental muy avanzada' },
]);

/** Las etiquetas de las diez cajas: los HITOS. Solo etiquetas. */
export const ETIQUETAS = HITOS;

/** Diez cajas por medida: las diez posiciones de su décupla. */
export const CAJAS = ARIDAD;

/**
 * Cohortes (VG, 7-11 tarde): hermanos = elementos similares (los hijos del
 * padre: se leen del 8 del padre); proyecto = dónde estoy (el subárbol del
 * proyecto: su 8); general = el ámbito (el subárbol del génesis: su 8).
 * [X] decidir VG: qué registro del hilo es el proyecto (aquí, el que cuelga
 * del génesis) y si los hermanos exigen además la misma posición `en` (hoy
 * solo el mismo padre).
 */
export const ALCANCES = Object.freeze(['hermanos', 'proyecto', 'general']);

/**
 * Medidas que se funden, con su etiqueta para mostrarlas. Ninguna es un nivel
 * ni un grado. Los tokens van aparte, por serie (clavesDe): no existe un P
 * total ni una R fungible.
 * [X] decidir VG: esta lista es la mínima que las piezas existentes permiten
 * medir sin inventar; el mapa (§9) solo dice «mediciones cuantitativas».
 */
export const MEDIDAS = Object.freeze([
  { clave: 'posiciones', etiqueta: 'posiciones desarrolladas (0–9)' },
  { clave: 'terminales', etiqueta: 'terminales del payload' },
  { clave: 'escritos', etiqueta: 'escritos encima' },
  { clave: 'movimientos', etiqueta: 'movimientos' },
  { clave: 'identidades', etiqueta: 'identidades distintas' },
  { clave: 'profundidadHilo', etiqueta: 'profundidad del hilo' },
  { clave: 'formulasResueltas', etiqueta: 'fórmulas resueltas' },
  { clave: 'formulasPendientes', etiqueta: 'fórmulas pendientes' },
]);

/** Las claves de las medidas (MEDIDAS), en su orden. */
export function clavesDeMedidas() {
  return MEDIDAS.map((m) => m.clave);
}

/** Clave de una serie de token (claveToken): T:<escala>, E:<emisor>/<denominación>, P:<ámbito>, R:<emisor>. */
const esClaveToken = (clave) => typeof clave === 'string' && /^[TEPR]:./.test(clave);

function esMedida(clave) {
  return clavesDeMedidas().includes(clave) || esClaveToken(clave);
}

/**
 * Etiqueta de una serie de token para mostrar su base. Cada serie es la suya:
 * T:<escala>, E:<emisor>/<denominación>, P:<ámbito>, R:<emisor>. Nada se
 * convierte ni se suma entre series.
 */
export function etiquetaClave(clave) {
  const s = partirClave(clave);
  if (s.token === 'T') return 'T movido en ' + s.escala;
  if (s.token === 'E') return 'E movido (' + s.denominacion + ' de ' + s.emisor + ')';
  if (s.token === 'P') return 'P movido sobre ' + (s.ambito === AMBITO_GENESIS ? 'el eje' : s.ambito.slice(0, 8));
  if (s.token === 'R') return 'R movida de ' + s.emisor;
  return clave;
}

// --- Cortes: regla de la época ----------------------------------------------
// Nueve umbrales crecientes parten los valores en diez cajas: la caja k reúne
// los valores v con cortes[k-1] <= v < cortes[k]; la 0, lo que queda por
// debajo del primero; la 9, desde el último.

/** Orígenes de los cortes de un bloque: de la época, de la época 0 (respaldo de una época que no los da) o, al fundir los mismos cortes de los dos, mixto. */
export const ORIGENES_CORTES = Object.freeze(['epoca', 'respaldo', 'mixto']);

function sonCortes(c) {
  return Array.isArray(c) && c.length === ARIDAD - 1 && c.every(Number.isFinite) && c.every((x, k) => k === 0 || x > c[k - 1]);
}

/**
 * Cortes de una medida o serie bajo una época: { cortes, origen }. Los del
 * gancho epoca.cortes(clave) (origen 'epoca'); si la época no lo tiene o no
 * da nada para esa clave, los de la época 0, que es el respaldo (origen
 * 'respaldo'). Han de ser nueve umbrales crecientes.
 * La época 0 trae la escala provisional 1 2 3 4 6 10 16 26 42 para todas las
 * medidas (datos/epocas/epoca-0.json, «cortes»; VG, 7-11 noche: «sin más
 * pretensión, se cambiará con datos reales»). [X] decidir VG: sus valores.
 */
export function cortesDe(clave, epoca = EPOCA_0) {
  if (!esMedida(clave)) throw new Error('medida desconocida: ' + clave);
  if (typeof epoca === 'string') epoca = epocaDe(epoca); // por nombre, como los modos
  const leer = (e) => (typeof e?.cortes === 'function' ? e.cortes(clave) : undefined);
  const propios = leer(epoca);
  const [cortes, origen, quien] = propios !== undefined && propios !== null
    ? [propios, 'epoca', epoca]
    : [leer(EPOCA_0), 'respaldo', EPOCA_0];
  if (!sonCortes(cortes)) throw new Error((quien?.nombre ?? 'la época') + ': los cortes de ' + clave + ' han de ser nueve umbrales crecientes');
  return { cortes: [...cortes], origen };
}

/** Caja de un valor: cuántos cortes deja por debajo o en él (0–9). */
export function cajaDe(valor, cortes) {
  let k = 0;
  while (k < cortes.length && valor >= cortes[k]) k++;
  return k;
}

// --- Cohortes -----------------------------------------------------------------

/** El proyecto del foco: el registro de su hilo que cuelga del génesis; el de un proyecto, él mismo; el del génesis, el génesis. */
export function proyectoDe(eje, foco) {
  const hilo = eje.hilo(foco);
  if (!hilo.length) throw new Error('foco desconocido: ' + foco);
  return hilo[Math.max(0, hilo.length - 2)];
}

/**
 * Los registros de una cohorte RECORRIENDO el eje, en orden de llegada (el
 * foco siempre está): los hijos del padre; el subárbol del proyecto, por el
 * índice de hijos; o todo el eje. Sin bases del 8. Solo para el respaldo
 * (confluir) y para las vistas que enseñan registros (Scened): la verdad del 8
 * se lee de las bases escritas (situar), no de aquí.
 */
export function comparables(eje, foco, alcance = 'hermanos') {
  const ev = eje.obtener(foco);
  if (!ev) throw new Error('foco desconocido: ' + foco);
  if (!ALCANCES.includes(alcance)) throw new Error('alcance desconocido: ' + alcance);
  if (esBase(eje, ev)) return [ev]; // una base del 8 solo se compara consigo misma
  if (alcance === 'hermanos') return ev.sobre === null ? [ev] : hijos(eje, ev.sobre);
  if (alcance === 'general') return eje.orden.map((id) => eje.obtener(id)).filter((e) => !esBase(eje, e));
  const ids = new Set();
  const pendientes = [proyectoDe(eje, foco).id];
  while (pendientes.length) {
    const id = pendientes.pop();
    ids.add(id);
    for (const h of hijos(eje, id)) pendientes.push(h.id);
  }
  return eje.orden.filter((id) => ids.has(id)).map((id) => eje.obtener(id));
}

// El registro cuyo 8 resume la cohorte del foco, y qué estadística de su base se lee.
function cohorteDe(eje, foco, alcance) {
  if (!ALCANCES.includes(alcance)) throw new Error('alcance desconocido: ' + alcance + ' (' + ALCANCES.join(', ') + ')');
  if (alcance === 'hermanos') return { registro: eje.obtener(foco).sobre, seccion: 'hijos' };
  return { registro: alcance === 'proyecto' ? proyectoDe(eje, foco).id : eje.genesisId, seccion: 'subarbol' };
}

// --- Quién escribe la base de un registro --------------------------------------

/**
 * Identidad propia de un registro: la propia cosa, que puede escribir sus
 * bases sin más (§12: «la escribe la propia cosa con su clave»). Hoy: la única
 * cosa (tipo 'cosa', con clave) a la que el propio registro da de alta en su
 * contexto; la del génesis, su autor, si tiene clave. Si no hay exactamente
 * una, null.
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

/**
 * Poder (P) de una identidad sobre un registro con lo llegado ANTES de un
 * evento, no con el de hoy: la validez de una base no cambia porque después
 * se delegue o se gaste el poder. Repite el débito del eje (src/eje.js: del
 * ámbito exacto a los que lo cubren) sobre los movimientos de P anteriores, y
 * suma, como eje.poderSobre, los ámbitos que cubren el registro (el eje entero
 * o un registro de su hilo).
 * [X] decidir VG: el poder se mira al escribir la base (aquí) y no hoy (como
 * mira el motor para autorizar).
 */
function poderAntes(eje, identidad, registro, evId) {
  const saldo = new Map();
  for (const id of eje.orden) {
    if (id === evId) break;
    for (const m of eje.obtener(id).movimientos) {
      if (m.token !== 'P') continue;
      if (m.de === identidad) {
        let resta = m.cantidad;
        for (const a of eje.ambitosQueCubren(m.ambito)) {
          const hay = saldo.get(a) ?? 0;
          if (hay <= 0) continue;
          const usa = Math.min(hay, resta);
          saldo.set(a, hay - usa);
          resta -= usa;
          if (resta <= 0) break;
        }
      }
      if (m.a === identidad) saldo.set(m.ambito, (saldo.get(m.ambito) ?? 0) + cantidadBase(m));
    }
  }
  const hilo = new Set(eje.hilo(registro).map((e) => e.id));
  let total = 0;
  for (const [a, c] of saldo) if (c > 0 && (a === AMBITO_GENESIS || hilo.has(a))) total += c;
  return total;
}

/**
 * Quién puede escribir hoy la base de un registro: la propia cosa
 * (identidadDe) o quien tiene P sobre él (eje.poderSobre), siempre con clave
 * (una base va firmada). Devuelve { puede, por: 'identidad' | 'poder' | null, motivo }.
 */
export function puedeEscribirBase(eje, autor, registro) {
  if (!eje.obtener(registro)) return { puede: false, por: null, motivo: 'registro desconocido: ' + registro };
  const id8 = registro.slice(0, 8);
  const por = autor && autor === identidadDe(eje, registro) ? 'identidad' : autor && eje.poderSobre(autor, registro) > 0 ? 'poder' : null;
  if (!por) return { puede: false, por, motivo: 'nadie sin P sobre ' + id8 + ' escribe su base: ' + autor + ' no es su identidad propia ni tiene poder (P) sobre él' };
  if (!eje.clave(autor)) return { puede: false, por, motivo: 'una base va firmada: ' + autor + ' no tiene clave' };
  return { puede: true, por, motivo: '' };
}

// --- Lo escrito sobre un registro, partido en hijos y bases -----------------------
// Lo que hay sobre cada registro, partido en hijos y bases válidas, en orden
// de llegada. El eje solo añade y la validez de una base depende solo de lo
// llegado antes que ella (también el poder de quien la escribe), así que la
// partición se guarda y se amplía con lo nuevo (por eje, sin tocar el eje).
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

// --- Medir: la única medida de un registro -------------------------------------

/**
 * Las diez posiciones de profundidad 0 de un registro, leídas de sus
 * ocupantes (encaje.ocupantes; §12: el 8 compara ocupantes). Los ocupantes
 * de la posición k son los de su dirección: los caminos del payload que
 * colisionan en ella (k, k.0, k.0.0…), lo que alcanzan las referencias y lo
 * escrito anclado ahí. Una posición está desarrollada si tiene alguno, y se
 * dice por qué procedencia: propia (un camino del payload que no es una
 * referencia), referencia (un camino que es una referencia: alcanzada, no
 * propia, porque las referencias no copian) o escrita (un registro anclado
 * ahí o más hondo: `en` 1.2 desarrolla la 1). Una base del 8 no desarrolla
 * nada. El registro entero (camino vacío) no es una posición: un terminal no
 * tiene posición 0. Lo escrito en la raíz colisiona con la 0 (§12) y cuenta
 * en ella; además se devuelve aparte como `raiz`.
 * [X] decidir VG (§10.6): si lo escrito sin posición se anida en la raíz o
 * siempre en una posición concreta; mientras tanto, la raíz es ruido en la 0.
 */
export function posicionesDe(eje, id) {
  if (!eje.obtener(id)) throw new Error('registro desconocido: ' + id);
  const posiciones = Array.from({ length: ARIDAD }, (_, indice) => ({ indice, propia: false, referencia: false, escrita: false, tiene: false }));
  const raiz = { escrita: false };
  for (const p of posiciones) {
    for (const o of ocupantes(eje, id, [p.indice], { orden: 'llegada' })) {
      if (o.tipo === 'propio') {
        if (o.camino.length === 0) continue; // el registro entero, no una posición
        p[esReferencia(o.contenido) ? 'referencia' : 'propia'] = true;
      } else if (o.tipo === 'escrito') {
        if (esBase(eje, eje.obtener(o.evento))) continue; // la base del 8 no desarrolla lo que mide
        p.escrita = true;
        if (p.indice === 0) raiz.escrita = true; // la dirección de la 0 es la de la raíz
      }
      // Un ocupante por referencia nace siempre de un propio que es la referencia: ya está contado.
    }
  }
  for (const h of hijos(eje, id)) {
    const indices = indicesDe(h.en);
    if (indices.length > 1) posiciones[indices[0]].escrita = true; // más hondo que la posición: la desarrolla
  }
  for (const p of posiciones) p.tiene = p.propia || p.referencia || p.escrita;
  return { posiciones, raiz, desarrolladas: posiciones.filter((p) => p.tiene).length };
}

/** Tokens movidos por un evento, por serie (T:escala, E:emisor/denominación, P:ámbito, R:emisor), en su unidad de saldo. */
export function clavesDe(ev) {
  const porClave = {};
  for (const mov of ev.movimientos) {
    const k = claveToken(mov);
    porClave[k] = (porClave[k] ?? 0) + cantidadBase(mov);
  }
  return porClave;
}

// Registros que se están midiendo: BASES() dentro de uno de ellos no vuelve a
// medirlo (sería un ciclo); queda PENDIENTE y cuenta como fórmula pendiente.
const MIDIENDO = new Set();

/**
 * La medida de un registro, la única (mapa §14.2 a): las posiciones
 * desarrolladas (posicionesDe, con sus procedencias por PV), los terminales
 * del payload, los escritos encima (sin sus bases del 8), los movimientos y
 * los tokens movidos por serie (clavesDe), las identidades distintas que tocan
 * sus movimientos, la profundidad del hilo y las fórmulas de su payload
 * resueltas frente a las no resueltas. Se funde con unitaria() y fundir().
 * [X] decidir VG: PENDIENTE, INCOMPATIBLE y ERROR cuentan juntas como
 * «pendientes»; el mapa no dice si una fórmula rota es lo mismo que una que
 * espera.
 */
export function medir(eje, id) {
  const ev = eje.obtener(id);
  if (!ev) throw new Error('registro desconocido: ' + id);
  const propio = !MIDIENDO.has(id);
  if (propio) MIDIENDO.add(id);
  try {
    const contar = (p) => (Array.isArray(p) ? p.reduce((n, h) => n + contar(h), 0) : 1);
    const p = posicionesDe(eje, id);
    const identidades = new Set();
    for (const mov of ev.movimientos) {
      if (mov.de) identidades.add(mov.de);
      if (mov.a) identidades.add(mov.a);
    }
    const m = {
      posiciones: p.desarrolladas,
      terminales: contar(ev.payload),
      escritos: hijos(eje, id).length,
      movimientos: ev.movimientos.length,
      identidades: identidades.size,
      profundidadHilo: eje.hilo(id).length - 1,
      formulasResueltas: 0,
      formulasPendientes: 0,
      tokens: clavesDe(ev),
      procedencias: p.posiciones,
      raiz: p.raiz,
    };
    const recorrer = (nodo, indices) => {
      if (Array.isArray(nodo)) {
        nodo.forEach((h, i) => recorrer(h, [...indices, i]));
        return;
      }
      if (!esFormula(nodo)) return;
      if (evaluar(eje, id, indices).estado === 'RESUELTO') m.formulasResueltas++;
      else m.formulasPendientes++;
    };
    recorrer(ev.payload, []);
    return m;
  } finally {
    if (propio) MIDIENDO.delete(id);
  }
}

// --- Estadísticas en memoria ---------------------------------------------
// estadística = { n, medidas: { <clave>: bloque }, tokens: { <clave de serie>: bloque },
//   posiciones: [diez { comparables, propias, referencias, escritas }], raiz }
// bloque = { n, suma, minimo, maximo, cortes, origenCortes, cajas }. Una serie
// que una estadística no nombra vale cero en sus n registros (así fundir es
// exacto); cada bloque lleva los cortes con que se hizo. Lo no fundible
// (medianas exactas, cuantiles, correlaciones) no está.

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

/** Estadística de un solo registro a partir de su medida (medir): n = 1, una caja ocupada por medida, con los cortes de la época. */
export function unitaria(m, epoca = EPOCA_0) {
  const est = estadisticaVacia();
  est.n = 1;
  for (const clave of clavesDeMedidas()) est.medidas[clave] = bloqueDeValor(m[clave], cortesDe(clave, epoca));
  for (const [clave, v] of Object.entries(m.tokens)) est.tokens[clave] = bloqueDeValor(v, cortesDe(clave, epoca));
  est.posiciones = m.procedencias.map((p) => ({ comparables: +p.tiene, propias: +p.propia, referencias: +p.referencia, escritas: +p.escrita }));
  est.raiz = +m.raiz.escrita;
  return est;
}

// Funde dos bloques de la misma medida: n y sumas se suman, mínimo y máximo se
// combinan, las cajas se suman una a una. Con cortes distintos no se funde: no
// se inventa escala puente.
function fundirBloques(clave, a, b) {
  if (a.cortes.length !== b.cortes.length || a.cortes.some((c, i) => c !== b.cortes[i])) {
    throw new Error('bases con cortes distintos en ' + clave + ': no se inventa escala puente');
  }
  const extremo = (f, x, y) => (x === null ? y : y === null ? x : f(x, y));
  return {
    n: a.n + b.n,
    suma: a.suma + b.suma,
    minimo: extremo(Math.min, a.minimo, b.minimo),
    maximo: extremo(Math.max, a.maximo, b.maximo),
    cortes: [...a.cortes],
    origenCortes: a.origenCortes === b.origenCortes ? a.origenCortes : 'mixto',
    cajas: a.cajas.map((x, i) => x + b.cajas[i]),
  };
}

/**
 * Funde dos estadísticas: cada medida y cada serie, caja a caja (suma n y
 * sumas, toma mínimo y máximo); las posiciones y la raíz, sumando. O(1)
 * respecto a lo medido; asociativa y conmutativa, con estadisticaVacia() como
 * neutro. No funde cajas con cortes distintos.
 */
export function fundir(a, b) {
  const unir = (x, y, nx, ny) => {
    const r = {};
    for (const k of [...new Set([...Object.keys(x), ...Object.keys(y)])].sort()) {
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
 * - hijos: el fundido de las medidas de sus hijos (los hermanos entre sí);
 * - subarbol: el propio registro, más cada hijo por su subárbol, leído de la
 *   base vigente del 8 de ese hijo, sin releer lo que cuelga de él. Un hijo
 *   sin base cuenta por sí mismo; si además tiene descendencia, esa
 *   descendencia no cuenta y el hijo queda en sinBase.
 *   [X] decidir VG: cómo se completa lo que cuelga de un hijo sin base (hoy
 *   no cuenta y se dice; releerlo rompería «fundir es O(1)»).
 * Devuelve { registro, epoca, hijos, subarbol, refsHijos, refsBases, hasta, sinBase }.
 */
export function calcularBase(eje, registro, { epoca: pedida = EPOCA_0 } = {}) {
  const epoca = epocaDe(pedida); // por objeto o por nombre
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
// [2] estadística de los hijos: [bloques de las medidas (MEDIDAS, en su orden), series, posiciones, raíz]
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
 * - está en el 8 (CIELO) con contexto.bases, y lo escribe y firma (con su
 *   clave) la identidad propia del registro (identidadDe) o quien tenía P
 *   sobre él al escribirla (poderAntes), que gasta T en él;
 * - su contexto es exactamente { bases, n, nSubarbol, hasta, epoca, sinBase },
 *   con tipos válidos, y casa con el payload, que está bien formado;
 * - mide exactamente los hijos del registro hasta «hasta», en orden;
 * - funde bases válidas del 8 de hijos medidos (como mucho una por hijo), y
 *   el n del subárbol es 1 + lo que aporta cada hijo (su subárbol o él).
 */
function leerSiEsBase(eje, ev, previos) {
  if (ev.en !== CIELO || ev.contexto?.bases !== true) return null;
  const autor = ev.autor;
  if (!eje.clave(autor) || !ev.firma || ev.firmante !== autor) return null;
  const por = autor === identidadDe(eje, ev.sobre) ? 'identidad' : poderAntes(eje, autor, ev.sobre, ev.id) > 0 ? 'poder' : null;
  if (!por) return null;
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
    por,
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
 * escribe `autor`: por defecto la propia cosa (identidadDe); si se da otro,
 * ha de tener P sobre el registro. Firma con su clave privada y gasta su T
 * (COSTE_BASE). Contexto { bases: true, n, nSubarbol, hasta, epoca, sinBase };
 * el payload lleva las dos estadísticas y las referencias a lo medido.
 * Corregir = volver a escribir: la anterior queda en el 8.
 */
export async function escribirBase(eje, { registro, privada, autor, t = new Date().toISOString(), epoca = EPOCA_0 }) {
  if (!eje.obtener(registro)) throw new Error('registro desconocido: ' + registro);
  const quien = autor ?? identidadDe(eje, registro);
  if (!quien) {
    throw new Error('la base la escribe la propia cosa o quien tiene P sobre ella: ' + registro.slice(0, 8) + ' no tiene identidad propia con clave; indica el autor (con P sobre el registro)');
  }
  const permiso = puedeEscribirBase(eje, quien, registro);
  if (!permiso.puede) throw new Error(permiso.motivo);
  if (!privada) throw new Error('una base va firmada: falta la clave privada de ' + quien);
  const calculada = calcularBase(eje, registro, { epoca });
  if (calculada.hijos.n === 0) throw new Error('nada que medir: ' + registro.slice(0, 8) + ' no tiene hijos');
  return eje.escribir({
    autor: quien,
    sobre: registro,
    en: CIELO,
    t,
    movimientos: [{ ...COSTE_BASE, de: quien, a: null }],
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
 * Sin base escrita no hay frescura: la lectura lo dice (SIN_BASE_ESCRITA).
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
 * { id, autor, por ('identidad' | 'poder'), t, registro, epoca, hasta,
 * sinBase, hijos, subarbol, refsHijos, refsBases, anteriores (bases válidas
 * anteriores en ese 8: colisiones), frescura }. Solo cuentan las bases
 * válidas (leerSiEsBase); lo demás escrito en el 8 es un hijo más.
 * [X] decidir VG: «más reciente» por llegada, no por t.
 */
export function leerBase(eje, id) {
  if (!eje.obtener(id)) throw new Error('registro desconocido: ' + id);
  const lista = particion(eje, id).bases;
  const base = lista.at(-1);
  if (!base) return null;
  return { ...base, anteriores: lista.length - 1, frescura: frescura(eje, base) };
}

// --- Situar: leer la cohorte del 8 ----------------------------------------------

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

// Un bloque con el foco situado en él: su caja, su etiqueta y lo que la caja deja alrededor.
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

// La medida de un foco situada en una estadística: por medida y por serie, su
// bloque situado; por posición, cuántos la tienen y si el foco la tiene; la raíz.
function situarEn(est, m, epoca) {
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
  return { medidas, tokens, posiciones, raiz: { comparables: est.raiz, proporcion: est.raiz / est.n, foco: m.raiz.escrita } };
}

/**
 * Sitúa el foco en una cohorte LEYENDO el 8 que la resume (la verdad
 * escrita): hermanos → los hijos del 8 del padre; proyecto → el subárbol del 8
 * del proyecto (proyectoDe); general → el subárbol del 8 del génesis. Cada
 * medida del foco se coloca con los cortes guardados en la base.
 * Devuelve { alcance, foco, registro, seccion, estado, ... }: estado
 * 'RESUELTO' con escrita: true, base, autor, n, frescura, incluido (si la base
 * mide al foco), cambiadas (medidas en las que el foco, medido ahora, cae en
 * una caja vacía aunque la base lo incluya: ha cambiado desde entonces),
 * medidas y tokens ({ <clave>: { n, suma, minimo, maximo, cortes,
 * origenCortes, cajas, foco, caja, hito, enCaja, debajo, encima, media } },
 * los tokens con su etiqueta), posiciones (por PV: comparables, propias,
 * referencias, escritas, proporcion, foco, delFoco) y raiz. Sin cohorte (el
 * génesis no tiene padre), 'PENDIENTE' con su motivo. Sin base escrita,
 * 'PENDIENTE' con frescura SIN_BASE_ESCRITA; con { respaldo: true }, el
 * cálculo al vuelo de confluir(), que lo declara (escrita: false, frescura:
 * SIN_BASE_ESCRITA). No asigna nivel ni grado: el hito es la etiqueta de la caja.
 */
export function situar(eje, foco, { alcance = 'hermanos', epoca: pedida = EPOCA_0, respaldo = false } = {}) {
  const epoca = epocaDe(pedida); // por objeto o por nombre, como los modos
  if (!eje.obtener(foco)) throw new Error('registro desconocido: ' + foco);
  const { registro, seccion } = cohorteDe(eje, foco, alcance);
  const comun = { alcance, foco, registro, seccion };
  if (registro === null) return { ...comun, estado: 'PENDIENTE', motivo: 'sin cohorte: el génesis no tiene padre' };
  const base = leerBase(eje, registro);
  if (!base) {
    if (respaldo) return confluir(eje, foco, { alcance, epoca });
    return { ...comun, estado: 'PENDIENTE', escrita: false, frescura: SIN_BASE_ESCRITA, motivo: SIN_BASE_ESCRITA + ' en el 8 de ' + registro.slice(0, 8) };
  }
  const est = base[seccion];
  const situada = situarEn(est, medir(eje, foco), epoca);
  const incluido = incluidoEn(eje, base, seccion, foco);
  const cambiadas = incluido ? [...Object.entries(situada.medidas), ...Object.entries(situada.tokens)].filter(([, x]) => x.enCaja === 0).map(([k]) => k) : [];
  return {
    ...comun,
    estado: 'RESUELTO',
    escrita: true,
    base: base.id,
    autor: base.autor,
    n: est.n,
    frescura: base.frescura,
    incluido,
    cambiadas,
    ...situada,
  };
}

/**
 * Respaldo declarado (mapa §14.2 e): calcula AL VUELO lo que leería del 8 la
 * cohorte del foco si cada registro tuviera su base al día, recorriendo el eje
 * (comparables) y fundiendo con las mismas funciones que las bases (medir,
 * unitaria, fundir, con los cortes de la época). No escribe nada y lo dice:
 * escrita: false, respaldo: true y frescura SIN_BASE_ESCRITA si el 8 de la
 * cohorte no tiene base; si la tiene, frescura 'calculada al vuelo' y
 * baseEscrita con su id (léase con situar). Misma forma que situar, más
 * comparables (los registros medidos, con su medida) y hitos (la tabla de
 * etiquetas). Con base escrita al día y sin hijos sin base, coincide con lo
 * leído del 8. No asigna nivel ni grado ni puntúa.
 */
export function confluir(eje, foco, { alcance = 'hermanos', epoca: pedida = EPOCA_0 } = {}) {
  const epoca = epocaDe(pedida); // por objeto o por nombre, como los modos
  const lista = comparables(eje, foco, alcance);
  const filas = lista.map((e) => ({ id: e.id, autor: e.autor, t: e.t, ...medir(eje, e.id) }));
  const est = filas.reduce((a, f) => fundir(a, unitaria(f, epoca)), estadisticaVacia());
  const { registro, seccion } = cohorteDe(eje, foco, alcance);
  const baseEscrita = registro === null ? null : leerBase(eje, registro)?.id ?? null;
  return {
    foco,
    alcance,
    registro,
    seccion,
    estado: 'RESUELTO',
    escrita: false,
    respaldo: true,
    baseEscrita,
    frescura: baseEscrita ? 'calculada al vuelo' : SIN_BASE_ESCRITA,
    n: est.n,
    comparables: filas,
    ...situarEn(est, filas.find((f) => f.id === foco), epoca),
    hitos: HITOS,
  };
}

// --- BASES() en BQL -----------------------------------------------------------

/** Lo que BASES(alcance, medida, campo) puede pedir de la base, además de una caja 0–9. */
export const CAMPOS_BASE = Object.freeze(['suma', 'minimo', 'maximo', 'media']);

/** Lo que BASES(alcance, medida, campo) puede pedir del anfitrión situado en la cohorte. */
export const CAMPOS_FOCO = Object.freeze(['foco', 'caja', 'enCaja', 'debajo', 'encima']);

/** Por qué unos argumentos de BASES() no valen, sin leer nada (null si valen). */
export function erroresDeBases(args = []) {
  if (args.length === 0) return null;
  const [alcance, medida, campo] = args;
  if (args.length > 3) return 'BASES: como mucho tres argumentos';
  if (!ALCANCES.includes(alcance)) return 'BASES: el alcance es ' + ALCANCES.join(', ');
  if (medida !== undefined && !esMedida(medida)) return 'BASES: medida desconocida: ' + medida;
  const esCaja = Number.isInteger(campo) && campo >= 0 && campo < ARIDAD;
  if (campo !== undefined && !esCaja && !CAMPOS_BASE.includes(campo) && !CAMPOS_FOCO.includes(campo)) {
    return 'BASES: pide una caja 0–9 o ' + [...CAMPOS_BASE, ...CAMPOS_FOCO].join(', ');
  }
  return null;
}

/**
 * Valor de BASES() en BQL para el registro anfitrión `id` (src/bql.js lo
 * llama con los argumentos ya evaluados, números o textos, después de cobrar
 * y autorizar la lectura del 8):
 *   BASES()                          n de la base vigente del 8 del anfitrión (sus hijos)
 *   BASES(alcance)                   n de la cohorte (hermanos, proyecto o general)
 *   BASES(alcance, medida)           la caja (0–9) del anfitrión en esa cohorte
 *   BASES(alcance, medida, k)        cuántos hay en la caja k (0–9)
 *   BASES(alcance, medida, campo)    suma, minimo, maximo, media (de la base) o
 *                                    foco, caja, enCaja, debajo, encima (del anfitrión)
 * La medida es una de MEDIDAS o una clave de serie de token ("T:hora").
 * Solo lee bases escritas: sin base, PENDIENTE (SIN_BASE_ESCRITA); nunca
 * calcula al vuelo. Devuelve { estado, valor?, motivo?, base?, registro?,
 * mideAnfitrion }: RESUELTO con un número; PENDIENTE sin cohorte o sin base;
 * ERROR con argumentos que no valen. `base` es el id de la base leída (la
 * dependencia de la fórmula) y `registro` el de su 8; mideAnfitrion, si hubo
 * que medir al anfitrión. Dentro de su propia medida queda PENDIENTE (no se
 * mide a sí mismo).
 * [X] decidir VG: la firma de BASES() (el mapa solo la nombra).
 */
export function valorDeBases(eje, id, args = []) {
  const error = (motivo) => ({ estado: 'ERROR', motivo, mideAnfitrion: false });
  if (!eje.obtener(id)) return error('BASES: registro desconocido');
  const mal = erroresDeBases(args);
  if (mal) return error(mal);
  const sinBase = (registro) => ({ estado: 'PENDIENTE', motivo: SIN_BASE_ESCRITA + ' en el 8 de ' + registro.slice(0, 8), mideAnfitrion: false });
  if (args.length === 0) {
    const b = leerBase(eje, id);
    if (!b) return sinBase(id);
    return { estado: 'RESUELTO', valor: b.hijos.n, base: b.id, registro: id, mideAnfitrion: false };
  }
  const [alcance, medida, campo] = args;
  const esCaja = Number.isInteger(campo) && campo >= 0 && campo < ARIDAD;
  const mideAnfitrion = medida !== undefined && !esCaja && !CAMPOS_BASE.includes(campo);
  const { registro, seccion } = cohorteDe(eje, id, alcance);
  if (registro === null) return { estado: 'PENDIENTE', motivo: 'sin cohorte: el génesis no tiene padre', mideAnfitrion: false };
  const base = leerBase(eje, registro);
  if (!base) return sinBase(registro);
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
