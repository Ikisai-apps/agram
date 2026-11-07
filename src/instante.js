// Instantes: el `t` de un evento y la caducidad de una serie de E.
//
// Un instante es ISO-8601 estricto con zona explícita:
//   AAAA-MM-DDThh:mm[:ss[.fff]](Z | ±hh:mm)
// con fecha y hora reales (sin 31 de febrero ni hora 24) y de 1 a 3 decimales
// de segundo. No valen las formas ambiguas: «2026-11-07» (sin hora),
// «2026-11-07 10:00» (sin T), «2026-11-07T10:00:00» (sin zona). Se compara
// siempre en milisegundos UTC calculados aquí, sin depender de lo que acepte
// Date.parse en cada motor (revisión de seguridad, 7-11 noche).

const ISO = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(?:Z|([+-])(\d{2}):(\d{2}))$/;

/** Milisegundos UTC de un instante ISO estricto; NaN si no lo es. */
export function msUTC(s) {
  if (typeof s !== 'string') return NaN;
  const m = ISO.exec(s);
  if (!m) return NaN;
  const [, a, me, d, h, mi, se = '0', fr = '', signo, oh = '0', om = '0'] = m;
  const [anio, mes, dia, hora, minuto, segundo] = [a, me, d, h, mi, se].map(Number);
  const ms = Number((fr + '00').slice(0, 3));
  if (mes < 1 || mes > 12 || hora > 23 || minuto > 59 || segundo > 59 || Number(oh) > 23 || Number(om) > 59) return NaN;
  const base = Date.UTC(anio, mes - 1, dia, hora, minuto, segundo, ms);
  const comprobada = new Date(base);
  if (anio < 100) comprobada.setUTCFullYear(anio); // Date.UTC lleva 0–99 a 1900–1999
  const real = comprobada.getTime();
  if (comprobada.getUTCFullYear() !== anio || comprobada.getUTCMonth() !== mes - 1 || comprobada.getUTCDate() !== dia) return NaN;
  const desfase = signo ? (signo === '-' ? -1 : 1) * (Number(oh) * 60 + Number(om)) * 60000 : 0;
  return real - desfase;
}

/** ¿Es un instante ISO-8601 estricto con zona explícita? */
export function esInstante(s) {
  return !Number.isNaN(msUTC(s));
}

/**
 * Milisegundos UTC de un `t` ya guardado en el eje: estricto si lo es; si no,
 * Date.parse, solo para los eventos de un eje de la versión 2, que se
 * guardaron cuando bastaba con que Date.parse lo leyera.
 */
export function msDeGuardado(s) {
  const ms = msUTC(s);
  return Number.isNaN(ms) ? Date.parse(s) : ms;
}
