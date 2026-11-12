// H11 (VG, 12-11): lo que depende de Bitcoin se mide en bloques, también hacia atrás.
//
//   profundidad = altura actual − altura del bloque que ancla + 1   (= confirmaciones, convención de Bitcoin:
//                                                                     un bloque recién minado ya tiene 1)
//   madurez     = "pendiente"           si aún no hay bloque
//                 "con fondos en sats"  si el bloque existe (profundidad ≥ 1)
//                 "en firme"            si profundidad ≥ N
//
// N lo declara cada despliegue (posición 6 «confirmations» de «exterior settings», propuesta) con 6 por defecto.

export const CONFIRMACIONES_POR_DEFECTO = 6;

export function profundidad(alturaActual, alturaAncla) {
  if (alturaAncla === null || alturaAncla === undefined) return 0;
  if (!Number.isSafeInteger(alturaActual) || !Number.isSafeInteger(alturaAncla)) throw new TypeError('las alturas son enteros');
  if (alturaAncla > alturaActual) return 0; // un ancla por delante de lo que se conoce no cuenta
  return alturaActual - alturaAncla + 1;
}

export function madurez(alturaActual, alturaAncla, n = CONFIRMACIONES_POR_DEFECTO) {
  if (!Number.isSafeInteger(n) || n < 1) throw new TypeError('N es un entero ≥ 1');
  const p = profundidad(alturaActual, alturaAncla);
  return { profundidad: p, madurez: p === 0 ? 'pendiente' : p >= n ? 'en firme' : 'con fondos en sats', n };
}
