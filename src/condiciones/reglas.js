// Las reglas de la época, conectadas al eje (encargo 3a, paso 9; VG, 10-11, A1).
//
// Cada regla del 2 de la época (src/epocas.js, EPOCA_0_BTML.condiciones: las lecturas, «read» en su 4, no) es
// una condición de validez de la transacción, evaluada con el BQL mínimo (src/bqlm.js, evaluarRegla) sobre el eje
// de antes (src/contexto-eje.js, ContextoEje). Rechaza con el mensaje de su 9, relleno con lo que vale en la
// candidata. Las condiciones JS que estas reglas sustituyen, verificadas por equivalencia
// (test/reglas-bqlm.test.js), se retiraron de src/condiciones/; lo que queda en JS es suelo o es del 3b
// (docs/notas/CAPA_CERO.md).
//
// Cuándo no se evalúan: en el prefijo de la versión 2 (suelo de persistencia: sus eventos se validan con las
// reglas de entonces), en un evento mal formado (la forma es suelo: las reglas leen eventos bien formados) y en uno
// con una referencia a un evento que el eje no tiene (el suelo lo rechaza: VG, 10-11, C1).
//
// PENDIENTE: una regla que no se resuelve no pasa. Si alguna regla falla con un veredicto (RESUELTO), solo cuentan
// esas; si no, la primera que queda PENDIENTE, en el orden del 8, rechaza con su estado y su motivo (lo que no se
// sabe no se acepta). Por eso «every record hangs on a record of the ledger» va la segunda: un foco que no está deja
// PENDIENTE a las que suben por él, y es ella la que lo dice.

import { evaluarRegla, nombreDeRegla } from '../bqlm.js';
import { EPOCA_0_BTML } from '../epocas.js';
import { validarForma } from '../evento.js';
import { referenciasAusentes } from './evento.js';

/** Las filas del inventario (docs/notas/INVENTARIO_REGLAS.md §2) que cita la procedencia (el 6) de una regla. */
export function filasDeRegla(regla) {
  const filas = new Set();
  for (const linea of Array.isArray(regla?.[6]) ? regla[6] : []) {
    for (const [f] of String(linea).matchAll(/\b[A-Z]{2}-\d+\b/g)) filas.add(f);
  }
  return Object.freeze([...filas]);
}

// Los veredictos de las reglas de la época para una transacción, uno por contexto de validación (ctx).
const VEREDICTOS = new WeakMap();

/**
 * Los veredictos de las reglas de `epoca` sobre la candidata de `ctx` (el contexto de eje.contexto(ev), con
 * `contextoBqlm`): Map nombre → { regla, pasa, estado, motivo }, o null si no se evalúan (versión 2, mal formado,
 * sin contexto del BQL mínimo).
 */
export function veredictosDe(ctx, epoca = EPOCA_0_BTML) {
  if (ctx && VEREDICTOS.has(ctx)) return VEREDICTOS.get(ctx);
  const ev = ctx?.evento;
  let v = null;
  if (ctx && ctx.reglas !== 2 && typeof ctx.contextoBqlm === 'function' && ev && typeof ev === 'object' && !validarForma(ev, { tLaxo: ctx.tLaxo }).length && !referenciasAusentes(ctx).length) {
    const c = ctx.contextoBqlm(epoca);
    v = new Map(epoca.condiciones.map((r) => {
      let x;
      try {
        x = evaluarRegla(r, c);
      } catch (e) {
        x = { pasa: false, estado: 'ERROR', motivo: nombreDeRegla(r) + ': ERROR: ' + e.message };
      }
      return [nombreDeRegla(r), { regla: r, ...x }];
    }));
  }
  if (ctx) VEREDICTOS.set(ctx, v);
  return v;
}

/** El motivo con que la regla `nombre` rechaza la candidata de `ctx`, o null si pasa (o no cuenta: ver arriba). */
export function motivoDeRegla(nombre, ctx, epoca = EPOCA_0_BTML) {
  const v = veredictosDe(ctx, epoca);
  const r = v?.get(nombre);
  if (!r || r.pasa) return null;
  if (r.estado === 'RESUELTO') return r.motivo;
  for (const x of v.values()) if (!x.pasa && x.estado === 'RESUELTO') return null;
  for (const [n, x] of v) if (!x.pasa) return n === nombre ? r.motivo : null;
  return null;
}

/**
 * En qué capa de la validez (src/validez.js, docs/VALIDEZ.md) cae lo que rechaza cada regla: 3 criptografía y
 * procedencia (la clave, el firmante, el foco), 4 el respaldo (el T del día, el reloj, la E viva) y 5 el permiso
 * (quién emite, quién mueve qué). Las de forma solo fallan en un evento que la forma (capa 1) ya rechaza.
 */
export const CAPA_DE_REGLA = Object.freeze({
  'who has a key signs': 3,
  'without a key nobody acts': 3,
  'a key is declared at its alta': 3,
  'a declared key comes with its proof': 3,
  'every record hangs on a record of the ledger': 3,
  "writing burns today's T": 4,
  'not before its focus': 4,
  'not before the writer joined': 4,
  'at most a year ahead': 4,
  'E is tied to a record that exists': 4,
  'locked P backing live E is not released': 4,
  'P moves within a known scope': 4,
});

/**
 * Los motivos de las reglas de la época para la validez: [{ i: null, capa, texto, condicion, pendiente }], uno por
 * regla que rechaza la candidata de `ctx` (los mismos que da el eje). `pendiente` si no se resolvió.
 */
export function motivosDeReglas(ctx, epoca = EPOCA_0_BTML) {
  const v = veredictosDe(ctx, epoca);
  if (!v) return [];
  const fuera = [];
  for (const [nombre, r] of v) {
    const texto = motivoDeRegla(nombre, ctx, epoca);
    if (texto) fuera.push({ i: null, capa: CAPA_DE_REGLA[nombre] ?? 5, texto, condicion: nombre, pendiente: r.estado === 'PENDIENTE' });
  }
  return fuera;
}

/** Una regla de la época como condición de la transacción: { nombre, filas, familia, evaluar }. */
export const condicionDeRegla = (regla, epoca = EPOCA_0_BTML) => Object.freeze({
  nombre: nombreDeRegla(regla),
  filas: filasDeRegla(regla),
  familia: 'epoca',
  regla,
  evaluar: (tx, libro, ctx) => motivoDeRegla(nombreDeRegla(regla), ctx, epoca),
});

/** Las reglas de la época 0 como condiciones, en el orden de su 8. */
export const CONDICIONES_DE_LA_EPOCA = Object.freeze(EPOCA_0_BTML.condiciones.map((r) => condicionDeRegla(r)));
