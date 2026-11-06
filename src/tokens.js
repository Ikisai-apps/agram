// Tokens de base de datos. Cuatro familias y siete escalas de tiempo.
// Todo evento mueve tokens; el evento mínimo mueve T.

export const FAMILIAS = Object.freeze(['E', 'P', 'R', 'T']);

export const ESCALAS_T = Object.freeze([
  'segundo', 'minuto', 'hora', 'dia', 'semana', 'ciclo', 'anio',
]);

/** Segundos por escala. Año = 13 ciclos de 28 días + 1. */
export const SEGUNDOS = Object.freeze({
  segundo: 1,
  minuto: 60,
  hora: 3600,
  dia: 86400,
  semana: 7 * 86400,
  ciclo: 28 * 86400,
  anio: (13 * 28 + 1) * 86400,
});

/** Clave de saldo: T es un solo token (en segundos); E, P y R por denominación. */
export function claveToken(m) {
  if (m.token === 'T') return 'T';
  return m.denominacion ? m.token + ':' + m.denominacion : m.token;
}

/** Cantidad del movimiento en su unidad de saldo: T pasa a segundos. */
export function cantidadBase(m) {
  return m.token === 'T' ? m.cantidad * SEGUNDOS[m.escala] : m.cantidad;
}

/**
 * Movimiento: { token, cantidad, de, a, escala?, denominacion? }.
 * de = null es emisión (solo génesis). a = null es consumo.
 */
export function validarMovimiento(m) {
  const errores = [];
  if (!m || typeof m !== 'object') return ['movimiento no es objeto'];
  if (!FAMILIAS.includes(m.token)) errores.push('token desconocido: ' + m.token);
  if (!(Number.isFinite(m.cantidad) && m.cantidad > 0)) errores.push('cantidad debe ser > 0');
  if (m.token === 'T' && !ESCALAS_T.includes(m.escala)) errores.push('escala T inválida: ' + m.escala);
  if (m.token !== 'T' && m.escala !== undefined) errores.push('escala solo en T');
  if (m.de === undefined || m.a === undefined) errores.push('de y a son obligatorios (null permitido)');
  if (m.de !== null && typeof m.de !== 'string') errores.push('de debe ser identidad o null');
  if (m.a !== null && typeof m.a !== 'string') errores.push('a debe ser identidad o null');
  if (m.de === null && m.a === null) errores.push('movimiento sin origen ni destino');
  return errores;
}
