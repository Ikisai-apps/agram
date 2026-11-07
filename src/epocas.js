// Épocas: convención PARALELA, fuera del dato. Un dato se puede leer desde
// cualquier época. La regla corta dice qué significa cada dígito en cada
// profundidad: diez profundidades por diez dígitos, cien reglas cortas.
// Época 0 (decidida por VG, 7-11 noche): las cien reglas cortas. Profundidad
// 0 = la cruceta, los diez PV sobre el registro en foco; en toda profundidad
// n ≥ 1 el dígito es el PV aplicado al nodo de arriba (0 qué es, 1 cuánto,
// 2 con qué condición, 3 con quién, 4 qué se hace, 5 dónde encaja, 6 de dónde
// viene, 7 para cuándo, 8 frente a otros, 9 cómo). Esas reglas nombran las
// subposiciones de las décuplas: cada índice de una décupla es un dígito
// con su PV (la regla corta de la PR #58). Por hojas (VG, 7-11 noche): un
// array solo de hojas dentro de una posición es una lista; sus elementos no
// son dígitos: son ocupantes por llegada, fuera del árbol, y se nombran
// «ocupante k» (leerCamino y nombreEnNodo). Las reglas largas, que
// especializan rutas completas, son lo que pulen las épocas futuras: se cargan
// con la misma función, en el mismo JSON. Las épocas viven como datos en
// datos/epocas/*.json; datos/epocas/epocas.js es su copia generada para
// importarlas sin fetch.
// Los cortes de las diez cajas del 8 también son regla de la época (VG, 7-11
// noche, decisión 2): `cortes` en el JSON, leídos con epoca.cortes(medida).

import { ARIDAD, indicesDe, esLista } from './btml.js';
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

/** Escala provisional de las diez cajas del 8 (nueve umbrales crecientes a saltos, VG, 7-11 noche: «sin más pretensión, se cambiará con datos reales»). Vale solo si ninguna época de la cadena trae cortes. [X] decidir VG: sus valores. */
export const CORTES_PROVISIONALES = Object.freeze([1, 2, 3, 4, 6, 10, 16, 26, 42]);

const sonCortes = (c) => Array.isArray(c) && c.length === ARIDAD - 1 && c.every(Number.isFinite) && c.every((x, k) => k === 0 || x > c[k - 1]);

/**
 * Reduce el campo `cortes` de una época a su escala única, o undefined si no
 * trae ninguna: una lista de nueve umbrales, o (forma por medida, EN DESUSO)
 * un objeto cuya escala es la de la clave `*`, `todas` o `por defecto`, o si
 * no la de la primera medida; `decision` es texto, no una escala.
 */
function escalaDeCortes(cortes, nombre) {
  if (cortes === undefined || cortes === null) return undefined;
  let lista = cortes;
  if (!Array.isArray(cortes)) {
    if (typeof cortes !== 'object') throw new TypeError(nombre + ': cortes es una lista de nueve umbrales crecientes (o, en desuso, un objeto por medida)');
    const claves = Object.keys(cortes).filter((k) => k !== 'decision');
    const clave = ['*', 'todas', 'por defecto'].find((k) => claves.includes(k)) ?? claves[0];
    if (clave === undefined) return undefined;
    lista = cortes[clave];
    if (!sonCortes(lista)) throw new TypeError(nombre + ': los cortes de ' + clave + ' han de ser nueve umbrales crecientes');
  } else if (!sonCortes(lista)) {
    throw new TypeError(nombre + ': los cortes han de ser nueve umbrales crecientes');
  }
  return { cortes: lista, origen: 'epoca' };
}

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
 * `cortes` (opcional) es UNA SOLA escala de nueve umbrales crecientes para las
 * diez cajas del 8 y para todas las medidas (VG, 8-11: las cajas se calculan
 * sobre cantidades y cuotas, no sobre recuentos; antes, VG 7-11 noche, decisión
 * 2: son regla de la época, MAPA §12 «Cortes de las cajas = regla de la época»;
 * la época 0 trae 1 2 3 4 6 10 16 26 42). Va como una lista de nueve números;
 * por compatibilidad se admite un objeto por medida { <clave>: [...], todas?:
 * [...], decision?: texto }, pero esa forma queda EN DESUSO: se reduce a la
 * escala única (la clave `*`, `todas` o `por defecto`, o si no la primera) y
 * ya no hay una escala por medida. Una época sin `cortes` HEREDA los de su
 * respaldo (recursivo), igual que hereda las reglas cortas (VG, 8-11); si
 * nadie los trae, vale CORTES_PROVISIONALES. Da el gancho epoca.cortes(clave),
 * que devuelve siempre esa escala única (la clave solo se acepta por
 * compatibilidad con quien lee por medida: src/bases.js), y
 * epoca.cortesConOrigen(), { cortes, origen }, con origen 'epoca' (los trae la
 * época o su respaldo) o 'provisional' (nadie los trae).
 */
export function cargarEpoca(datos, { respaldo } = {}) {
  if (!datos || typeof datos !== 'object') throw new TypeError('época: faltan los datos');
  if (typeof datos.nombre !== 'string' || !datos.nombre) throw new TypeError('época: falta el nombre');
  if (!Array.isArray(datos.reglas)) throw new TypeError(datos.nombre + ': faltan las reglas');
  const ordinales = datos.ordinales ?? [];
  if (!Array.isArray(ordinales) || !ordinales.every(esIndice)) throw new TypeError(datos.nombre + ': ordinales son profundidades 0–9');
  const escalaPropia = escalaDeCortes(datos.cortes, datos.nombre);
  const escala = escalaPropia
    ?? (typeof respaldo?.cortesConOrigen === 'function' ? respaldo.cortesConOrigen() : undefined)
    ?? { cortes: CORTES_PROVISIONALES, origen: 'provisional' };
  const origenCortes = escalaPropia ? 'epoca' : escala.origen;
  const cortesFijos = Object.freeze([...(escalaPropia ?? escala).cortes]);

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
    /** La escala única de cortes de las cajas del 8 (VG, 8-11): la misma para toda medida o serie, así que `clave` no cambia nada. La propia, la heredada del respaldo o la provisional. */
    cortes(clave) { // eslint-disable-line no-unused-vars
      return [...cortesFijos];
    },
    /** { cortes, origen } de la escala única: origen 'epoca' (propia o heredada del respaldo) o 'provisional' (nadie la trae). */
    cortesConOrigen() {
      return { cortes: [...cortesFijos], origen: origenCortes };
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
 * la corta y la entrada lleva además `larga: ruta`. Una dirección solo
 * nombra subposiciones de la décupla (VG, 7-11 noche): cada dígito se lee
 * con su regla, sin mirar ningún payload; nunca nombra un ocupante de una
 * lista explícita.
 */
export function leerDireccion(dir, epoca = EPOCA_0) {
  return leerCamino(indicesDe(dir), epoca);
}

/**
 * Como leerDireccion, pero sobre un camino de índices (un índice 0 final
 * cuenta). En una décupla, cada índice es un dígito con su regla corta (o
 * larga). Con `{ payload }` (el del registro que se lee), un índice que cae
 * en una lista del payload (por hojas: fuera de la raíz, un array solo de
 * hojas) no es un dígito: es la llegada de un ocupante, y da
 * { profundidad, digito, ocupante: k, posicion: '1', significado: 'ocupante k+1 de la posición 1' }
 * sin regla corta ni larga: la lista está fuera del árbol («profundidad
 * 11»). Lo que siga bajo un elemento que sea una décupla vuelve a la regla
 * corta de su profundidad.
 */
export function leerCamino(indices, epoca = EPOCA_0, { payload } = {}) {
  const e = epocaDe(epoca);
  if (!Array.isArray(indices) || indices.length > ARIDAD || !indices.every(esIndice)) throw new TypeError('un camino de 0 a 10 índices 0–9');
  let nodo = payload;
  return indices.map((digito, profundidad) => {
    const padre = nodo;
    if (profundidad > 0 && esLista(padre) && digito < padre.length) {
      nodo = padre[digito];
      const posicion = indices.slice(0, profundidad).join('.');
      return { profundidad, digito, ocupante: digito, posicion, significado: 'ocupante ' + (digito + 1) + ' de la posición ' + posicion };
    }
    nodo = Array.isArray(padre) ? padre[digito] : undefined;
    const entrada = { profundidad, digito, significado: e.reglaCorta(profundidad, digito) };
    if (profundidad > 0 && typeof e.reglaLarga === 'function') {
      const ruta = indices.slice(0, profundidad + 1).join('');
      const nombre = e.reglaLarga(ruta);
      if (nombre !== undefined) return { ...entrada, significado: nombre, larga: ruta };
    }
    return entrada;
  });
}

/**
 * Nombre de la posición `digito` de un nodo del payload que está a
 * `profundidad` (la décupla de Pointed, las celdas de Mapped): si el nodo es
 * una lista (por hojas: bajo una posición, profundidad ≥ 1, un array solo de
 * hojas) y el dígito cae en ella, { ocupante: k, significado: 'ocupante
 * k+1' }; si no (una décupla, la raíz, un terminal o nada), la regla corta
 * de esa profundidad.
 */
export function nombreEnNodo(nodo, profundidad, digito, epoca = EPOCA_0) {
  if (profundidad > 0 && esLista(nodo) && digito < nodo.length) return { ocupante: digito, significado: 'ocupante ' + (digito + 1) };
  return { significado: epocaDe(epoca).reglaCorta(profundidad, digito) };
}
