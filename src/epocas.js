// Épocas: convención PARALELA, fuera del dato. Un dato se puede leer desde
// cualquier época. La regla corta dice qué significa cada dígito en cada
// profundidad: diez profundidades por diez dígitos, cien reglas cortas.
// Época 0 (decidida por VG, 7-11 noche): las cien reglas cortas. Profundidad
// 0 = la cruceta, los diez PV sobre el registro en foco; en toda profundidad
// n ≥ 1 el dígito es el PV aplicado al nodo de arriba (0 qué es, 1 cuánto,
// 2 con qué condición, 3 con quién, 4 qué se hace, 5 dónde encaja, 6 de dónde
// viene, 7 para cuándo, 8 frente a otros, 9 cómo). Esas reglas nombran
// subposiciones escritas por dirección (`en`), no los índices de una lista:
// un array dentro de una posición son sus ocupantes por llegada, fuera del
// árbol (VG, 7-11 noche; leerCamino y nombreEnNodo). Las reglas largas, que
// especializan rutas completas, son lo que pulen las épocas futuras: se cargan
// con la misma función, en el mismo JSON. Las épocas viven como datos en
// datos/epocas/*.json; datos/epocas/epocas.js es su copia generada para
// importarlas sin fetch.

import { ARIDAD, indicesDe } from './btml.js';
import { EPOCA_0_DATOS } from '../datos/epocas/epocas.js';

export const PV = Object.freeze([
  'representación', // 0 · PV0, lente libre
  'recursos', // 1 · reino / ciudad
  'criterios', // 2 · jardín / bosque
  'comunicación', // 3 · parque acuático
  'fábrica', // 4 · producción, futuro subjetivo
  'estructura', // 5 · registro en foco, inspección
  'pasado', // 6 · hilos del pasado
  'futuro', // 7 · hilos del futuro
  'comparabilidad', // 8 · cielo
  'camino', // 9 · guía
]);

/** Valor de `profundidad` de una regla que vale en todas las profundidades. */
export const TODAS = 'todas';

const esIndice = (x) => Number.isInteger(x) && x >= 0 && x < ARIDAD;
const esRuta = (x) => typeof x === 'string' && /^[0-9]{2,10}$/.test(x);

/**
 * Carga una época desde sus datos: { nombre, estado, principios, ordinales?,
 * reglas, dudas }. Una regla corta es { profundidad, digito, nombre,
 * significado, ejemplo }, con profundidad 0–9 o 'todas'. Las cien
 * combinaciones profundidad × dígito tienen que quedar cubiertas: por una regla
 * de esa profundidad, por una de 'todas' o por la época de respaldo.
 * Una regla larga es { ruta, nombre, significado, ejemplo }, con `ruta` de
 * dos a diez dígitos (el prefijo que especializa) en lugar de profundidad y
 * dígito: al leer esa ruta exacta gana a las cortas. No hace falta cubrir
 * nada con ellas. Con respaldo, las largas de la propia época mandan y las del
 * respaldo valen donde la propia no dice nada.
 * `ordinales` son las profundidades donde el dígito es orden y no un nombre:
 * da el gancho epoca.ordinal(profundidad) que usa el encaje.
 * `cortes` (opcional) son los cortes de las diez cajas del 8 por medida o
 * serie: { <clave>: [nueve umbrales crecientes] }. Son regla de la época
 * (MAPA §12: «Cortes de las cajas = regla de la época»): da el gancho
 * epoca.cortes(clave) que leen confluir() y las bases; undefined si la
 * época no los trae para esa clave.
 */
export function cargarEpoca(datos, { respaldo } = {}) {
  if (!datos || typeof datos !== 'object') throw new TypeError('época: faltan los datos');
  if (typeof datos.nombre !== 'string' || !datos.nombre) throw new TypeError('época: falta el nombre');
  if (!Array.isArray(datos.reglas)) throw new TypeError(datos.nombre + ': faltan las reglas');
  const ordinales = datos.ordinales ?? [];
  if (!Array.isArray(ordinales) || !ordinales.every(esIndice)) throw new TypeError(datos.nombre + ': ordinales son profundidades 0–9');
  const cortes = datos.cortes ?? {};
  if (!cortes || typeof cortes !== 'object' || Array.isArray(cortes)) throw new TypeError(datos.nombre + ': cortes es { clave: [nueve umbrales] }');
  for (const [clave, c] of Object.entries(cortes)) {
    const ok = Array.isArray(c) && c.length === ARIDAD - 1 && c.every(Number.isFinite) && c.every((x, k) => k === 0 || x > c[k - 1]);
    if (!ok) throw new TypeError(datos.nombre + ': los cortes de ' + clave + ' han de ser nueve umbrales crecientes');
  }
  const tablaCortes = new Map(Object.entries(cortes).map(([clave, c]) => [clave, Object.freeze([...c])]));

  const propias = new Map(); // 'p.d' → regla
  const generales = new Map(); // d → regla de todas las profundidades
  const largas = new Map(); // ruta → regla larga
  for (const r of datos.reglas) {
    if (r?.ruta !== undefined) {
      const donde = datos.nombre + ' ruta ' + r.ruta;
      if (!esRuta(r.ruta)) throw new TypeError(donde + ': la ruta de una regla larga son de dos a diez dígitos');
      if (r.profundidad !== undefined || r.digito !== undefined) throw new TypeError(donde + ': una regla larga lleva ruta, no profundidad ni dígito');
      if (typeof r.nombre !== 'string' || !r.nombre) throw new TypeError(donde + ': falta el nombre');
      if (largas.has(r.ruta)) throw new Error(donde + ': regla larga repetida');
      largas.set(r.ruta, r);
      continue;
    }
    const donde = datos.nombre + ' ' + r?.profundidad + '.' + r?.digito;
    if (!esIndice(r?.digito)) throw new TypeError(donde + ': dígito 0–9');
    if (r.profundidad !== TODAS && !esIndice(r.profundidad)) throw new TypeError(donde + ': profundidad 0–9 o «todas»');
    if (typeof r.nombre !== 'string' || !r.nombre) throw new TypeError(donde + ': falta el nombre');
    const tabla = r.profundidad === TODAS ? generales : propias;
    const clave = r.profundidad === TODAS ? r.digito : r.profundidad + '.' + r.digito;
    if (tabla.has(clave)) throw new Error(donde + ': regla repetida');
    tabla.set(clave, r);
  }

  const fijar = (r, profundidad, digito) => Object.freeze({
    profundidad, digito, nombre: r.nombre, significado: r.significado ?? '', ejemplo: r.ejemplo ?? '',
  });
  const reglas = [];
  for (let p = 0; p < ARIDAD; p++) {
    for (let d = 0; d < ARIDAD; d++) {
      const r = propias.get(p + '.' + d) ?? generales.get(d) ?? respaldo?.regla(p, d);
      if (!r) throw new Error(datos.nombre + ': falta la regla corta ' + p + '.' + d);
      reglas.push(fijar(r, p, d));
    }
  }
  const esOrdinal = new Set(ordinales);

  const fijarLarga = (r) => Object.freeze({
    ruta: r.ruta, nombre: r.nombre, significado: r.significado ?? '', ejemplo: r.ejemplo ?? '',
  });
  const largasFijas = [...largas.values()].map(fijarLarga);
  const largaPorRuta = new Map(largasFijas.map((r) => [r.ruta, r]));

  /** Regla completa de un dígito en una profundidad, o undefined. */
  function regla(profundidad, digito) {
    if (!esIndice(digito)) return undefined;
    if (esIndice(profundidad)) return reglas[profundidad * ARIDAD + digito];
    // Fuera de las diez profundidades solo valen las reglas de todas las profundidades.
    const g = generales.get(digito);
    return g ? fijar(g, profundidad, digito) : undefined;
  }

  /** Regla larga completa de una ruta exacta (cadena de dos a diez dígitos), o undefined. */
  function larga(ruta) {
    return largaPorRuta.get(ruta) ?? respaldo?.larga?.(ruta);
  }

  return Object.freeze({
    nombre: datos.nombre,
    estado: datos.estado ?? '',
    principios: Object.freeze([...(datos.principios ?? [])]),
    dudas: Object.freeze([...(datos.dudas ?? [])]),
    reglas: Object.freeze(reglas),
    largas: Object.freeze(largasFijas),
    regla,
    larga,
    /** Regla corta: el nombre de un dígito en una profundidad. */
    reglaCorta(profundidad, digito) {
      return regla(profundidad, digito)?.nombre;
    },
    /** Regla larga: el nombre que da a una ruta exacta, o undefined si no la especializa. */
    reglaLarga(ruta) {
      return larga(ruta)?.nombre;
    },
    /** ¿El dígito es orden (y no un nombre) en esa profundidad? */
    ordinal(profundidad) {
      return esOrdinal.has(profundidad);
    },
    /** Cortes de las cajas del 8 para una medida o serie, o undefined si la época no los trae. */
    cortes(clave) {
      const c = tablaCortes.get(clave);
      return c ? [...c] : undefined;
    },
  });
}

/**
 * Época 0, decidida por VG: las cien reglas cortas. Profundidad 0 = los diez
 * PV sobre el registro en foco; en toda profundidad n ≥ 1, el dígito es el PV
 * aplicado al nodo de arriba.
 */
export const EPOCA_0 = cargarEpoca(EPOCA_0_DATOS);
if (!PV.every((n, d) => EPOCA_0.reglaCorta(0, d) === n)) throw new Error('época 0: los datos no coinciden con los diez PV');

/** Épocas por nombre. Hoy solo hay la época 0; las futuras se añaden aquí al cargarlas. */
export const EPOCAS = Object.freeze({ [EPOCA_0.nombre]: EPOCA_0 });

/** Una época por objeto o por nombre ('época 0'). */
export function epocaDe(epoca = EPOCA_0) {
  const e = typeof epoca === 'string' ? EPOCAS[epoca] : epoca;
  if (!e || typeof e.reglaCorta !== 'function') throw new TypeError('época desconocida: ' + (typeof epoca === 'string' ? epoca : typeof epoca));
  return e;
}

/**
 * Lee una dirección bajo una época (objeto o nombre): una entrada por
 * profundidad real. Si la época tiene una regla larga para el prefijo exacto
 * que llega hasta esa profundidad (la ruta de los dígitos hasta ahí), gana a
 * la corta y la entrada lleva además `larga: ruta`.
 *
 * Con `{ payload }` (el del registro que se lee), la lista de una posición
 * no lleva PV (VG, 7-11 noche, mapa §12 [D]: «la lista de la posición son
 * colisiones fuera del árbol»): donde el camino cae en un índice de un array
 * que está DENTRO de una posición (profundidad ≥ 1), ese dígito es la
 * llegada de un ocupante y no una regla corta. Ver leerCamino. Sin payload,
 * la dirección se lee como subposiciones escritas por dirección (`en`), y
 * ahí la regla corta sigue.
 */
export function leerDireccion(dir, epoca = EPOCA_0, opciones = {}) {
  return leerCamino(indicesDe(dir), epoca, opciones);
}

/** Texto de un ocupante de una lista: «ocupante 3 de la posición 1»; anidado, «ocupante 1 del ocupante 3 de la posición 1». */
function nombreOcupante(llegada, anterior, posicion) {
  return 'ocupante ' + (llegada + 1) + (anterior?.ocupante !== undefined ? ' del ' + anterior.significado : ' de la posición ' + posicion);
}

/**
 * Como leerDireccion, pero sobre un camino de índices (un índice 0 final
 * cuenta: [1, 0] es el ocupante 1 de la posición 1, cosa que una dirección
 * no puede nombrar). Con `{ payload }`, cada dígito que cae en un índice
 * existente de un array dentro de una posición da
 * { profundidad, digito, ocupante: llegada, posicion: '1', significado: 'ocupante k de la posición 1' }
 * sin regla corta ni larga: la lista está fuera del árbol («en la
 * profundidad 11»). La profundidad 0 es siempre la cruceta (el payload raíz
 * no es una lista). Donde el payload no llega (subposiciones escritas por
 * dirección), la regla corta sigue.
 */
export function leerCamino(indices, epoca = EPOCA_0, { payload } = {}) {
  const e = epocaDe(epoca);
  if (!Array.isArray(indices) || indices.length > ARIDAD || !indices.every(esIndice)) throw new TypeError('un camino de 0 a 10 índices 0–9');
  let nodo = payload;
  const entradas = [];
  indices.forEach((digito, profundidad) => {
    const padre = nodo;
    nodo = Array.isArray(padre) ? padre[digito] : undefined;
    if (profundidad > 0 && Array.isArray(padre) && digito < padre.length) {
      const posicion = indices.slice(0, profundidad).join('.');
      entradas.push({ profundidad, digito, ocupante: digito, posicion, significado: nombreOcupante(digito, entradas.at(-1), posicion) });
      return;
    }
    const entrada = { profundidad, digito, significado: e.reglaCorta(profundidad, digito) };
    if (profundidad > 0 && typeof e.reglaLarga === 'function') {
      const ruta = indices.slice(0, profundidad + 1).join('');
      const nombre = e.reglaLarga(ruta);
      if (nombre !== undefined) {
        entradas.push({ ...entrada, significado: nombre, larga: ruta });
        return;
      }
    }
    entradas.push(entrada);
  });
  return entradas;
}

/**
 * Nombre de la posición `digito` de un nodo del payload que está a
 * `profundidad` (la décupla de Pointed, las celdas de Mapped): si el nodo es
 * un array dentro de una posición (profundidad ≥ 1) y el dígito cae en él,
 * { ocupante: llegada, significado: 'ocupante k' }; si no, la regla corta
 * de esa profundidad (una subposición por dirección).
 */
export function nombreEnNodo(nodo, profundidad, digito, epoca = EPOCA_0) {
  if (profundidad > 0 && Array.isArray(nodo) && digito < nodo.length) return { ocupante: digito, significado: 'ocupante ' + (digito + 1) };
  return { significado: epocaDe(epoca).reglaCorta(profundidad, digito) };
}
