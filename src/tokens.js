// Tokens de base de datos. Cuatro familias y siete escalas de tiempo.
// Todo evento mueve tokens; el evento mínimo mueve T.
//   E  recursos: por denominación (EUR, kg…), fungible.
//   P  poder/criterio: SIEMPRE con ámbito (el registro cuyo subárbol cubre;
//      «genesis» = todo el eje). No existe un P total.
//   R  reputación: por emisor y no fungible: solo el emisor la mueve; quien la
//      recibe no puede pasarla. Se cuenta como «R de X» en quien la tiene.
//   T  tiempo: un solo token en segundos; la escala es la unidad del movimiento.

/** Ámbito reservado de P: el génesis del eje, es decir, todo el eje. */
export const AMBITO_GENESIS = 'genesis';

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

/** Clave de saldo: T un solo token; E por denominación; P por ámbito; R por emisor. */
export function claveToken(m) {
  if (m.token === 'T') return 'T';
  if (m.token === 'P') return 'P:' + m.ambito;
  if (m.token === 'R') return 'R:' + m.emisor;
  return m.denominacion ? 'E:' + m.denominacion : 'E';
}

/** Cantidad del movimiento en su unidad de saldo: T pasa a segundos. */
export function cantidadBase(m) {
  return m.token === 'T' ? m.cantidad * SEGUNDOS[m.escala] : m.cantidad;
}

/**
 * Movimiento: { token, cantidad, de, a, escala? (T), denominacion? (E), ambito (P), emisor (R) }.
 * de = null es emisión (solo génesis). a = null es consumo.
 */
export function validarMovimiento(m) {
  const errores = [];
  if (!m || typeof m !== 'object') return ['movimiento no es objeto'];
  if (!FAMILIAS.includes(m.token)) errores.push('token desconocido: ' + m.token);
  if (!(Number.isFinite(m.cantidad) && m.cantidad > 0)) errores.push('cantidad debe ser > 0');
  if (m.token === 'T' && !ESCALAS_T.includes(m.escala)) errores.push('escala T inválida: ' + m.escala);
  if (m.token !== 'T' && m.escala !== undefined) errores.push('escala solo en T');
  if (m.token === 'P' && !(typeof m.ambito === 'string' && m.ambito)) errores.push('P exige ámbito: no hay poder total');
  if (m.token === 'R') {
    if (!(typeof m.emisor === 'string' && m.emisor)) errores.push('R exige emisor');
    else if (m.de !== null && m.de !== m.emisor) errores.push('R no es fungible: solo la mueve su emisor ' + m.emisor);
    else if (m.de === null && m.a !== m.emisor) errores.push('la emisión de R va a su propio emisor');
  }
  if (m.token !== 'P' && m.ambito !== undefined) errores.push('ámbito solo en P');
  if (m.token !== 'R' && m.emisor !== undefined) errores.push('emisor solo en R');
  if (m.de === undefined || m.a === undefined) errores.push('de y a son obligatorios (null permitido)');
  if (m.de !== null && typeof m.de !== 'string') errores.push('de debe ser identidad o null');
  if (m.a !== null && typeof m.a !== 'string') errores.push('a debe ser identidad o null');
  if (m.de === null && m.a === null) errores.push('movimiento sin origen ni destino');
  return errores;
}
