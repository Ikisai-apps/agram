// Tokens de base de datos. Cuatro familias, y cada familia es una SERIE de
// denominaciones (VG, 7-11: «las series de tokens son una constante y se
// estandarizan»). La serie es limitada y la emite quien la respalda.
//
//   familia: clave de serie            : quién la emite
//   T  tiempo:      T:<escala>         : el génesis (siete escalas, hasta diez)
//   E  recursos:    E:<denominacion>   : su emisor registrado (el primero que la emite)
//   P  poder:       P:<ambito>         : el génesis, sobre todo el eje; delegar estrecha el ámbito
//   R  reputación:  R:<emisor>         : su emisor; no fungible, solo él la mueve
//
// Todo evento mueve tokens; el evento mínimo mueve T (cualquier escala).
// Sin conversión entre denominaciones: una hora NO son sesenta minutos, son
// tokens distintos (como un euro no es un bitcoin).

/** Ámbito reservado de P: el génesis del eje, es decir, todo el eje. */
export const AMBITO_GENESIS = 'genesis';

export const FAMILIAS = Object.freeze(['E', 'P', 'R', 'T']);

/**
 * La constante: el campo del movimiento que nombra la serie dentro de cada
 * familia. La clave de saldo es familia + ':' + ese campo.
 */
export const SERIE = Object.freeze({ T: 'escala', E: 'denominacion', P: 'ambito', R: 'emisor' });

/** Siete escalas de T, cada una un token distinto. Ampliable hasta MAXIMO_ESCALAS_T. */
export const ESCALAS_T = Object.freeze([
  'segundo', 'minuto', 'hora', 'dia', 'semana', 'ciclo', 'anio',
]);

/** Tope de escalas de T (VG, 7-11: «a lo mejor creamos alguna más para llegar hasta diez»). */
export const MAXIMO_ESCALAS_T = 10;

/**
 * Duración de cada escala en segundos, para MEDIR distancias de tiempo (las
 * bandas del eje temporal). No convierte tokens: los saldos de T no se
 * suman entre escalas. Año = 13 ciclos de 28 días + 1.
 */
export const SEGUNDOS = Object.freeze({
  segundo: 1,
  minuto: 60,
  hora: 3600,
  dia: 86400,
  semana: 7 * 86400,
  ciclo: 28 * 86400,
  anio: (13 * 28 + 1) * 86400,
});

/** Clave de saldo: familia + ':' + su serie (T:hora, E:EUR, P:<ámbito>, R:<emisor>). */
export function claveToken(m) {
  return m.token + ':' + m[SERIE[m.token]];
}

/** Parte una clave de saldo en { token, serie }: 'T:hora' → { token: 'T', serie: 'hora' }. */
export function partirClave(clave) {
  const i = clave.indexOf(':');
  return { token: clave.slice(0, i), serie: clave.slice(i + 1) };
}

/** Cantidad del movimiento en su saldo: la misma, sin conversión (cada escala de T es su propio token). */
export function cantidadBase(m) {
  return m.cantidad;
}

const texto = (x) => typeof x === 'string' && x.length > 0;

/**
 * Movimiento: { token, cantidad, de, a, escala (T), denominacion (E), ambito (P), emisor (R y emisión de E) }.
 * de = null es emisión: el génesis emite; después solo se emiten series de E,
 * y las emite su emisor. a = null es consumo.
 */
export function validarMovimiento(m) {
  const errores = [];
  if (!m || typeof m !== 'object') return ['movimiento no es objeto'];
  if (!FAMILIAS.includes(m.token)) errores.push('token desconocido: ' + m.token);
  if (!(Number.isFinite(m.cantidad) && m.cantidad > 0)) errores.push('cantidad debe ser > 0');
  if (m.token === 'T' && !ESCALAS_T.includes(m.escala)) errores.push('escala T inválida: ' + m.escala);
  if (m.token !== 'T' && m.escala !== undefined) errores.push('escala solo en T');
  if (m.token === 'E') {
    if (!texto(m.denominacion)) errores.push('E exige denominación');
    if (m.de === null && !texto(m.emisor)) errores.push('la emisión de E exige emisor');
    if (m.de !== null && m.emisor !== undefined) errores.push('emisor en E solo al emitir');
  }
  if (m.token !== 'E' && m.denominacion !== undefined) errores.push('denominación solo en E');
  if (m.token === 'P' && !texto(m.ambito)) errores.push('P exige ámbito: no hay poder total');
  if (m.token === 'R') {
    if (!texto(m.emisor)) errores.push('R exige emisor');
    else if (m.de !== null && m.de !== m.emisor) errores.push('R no es fungible: solo la mueve su emisor ' + m.emisor);
    else if (m.de === null && m.a !== m.emisor) errores.push('la emisión de R va a su propio emisor');
  }
  if (m.token !== 'P' && m.ambito !== undefined) errores.push('ámbito solo en P');
  if (m.token !== 'R' && m.token !== 'E' && m.emisor !== undefined) errores.push('emisor solo en R y en la emisión de E');
  if (m.de === undefined || m.a === undefined) errores.push('de y a son obligatorios (null permitido)');
  if (m.de !== null && typeof m.de !== 'string') errores.push('de debe ser identidad o null');
  if (m.a !== null && typeof m.a !== 'string') errores.push('a debe ser identidad o null');
  if (m.de === null && m.a === null) errores.push('movimiento sin origen ni destino');
  return errores;
}
