// Tokens de base de datos. Cuatro familias, y cada familia es una SERIE
// (VG, 7-11: «las series de tokens son una constante y se estandarizan»).
// La serie es limitada y la emite quien la respalda; la clave de saldo dice
// de qué serie es cada token.
//
//   familia: clave de serie              : quién la emite
//   T  tiempo:      T:<escala>           : el génesis (siete escalas, hasta diez)
//   E  recursos:    E:<emisor>/<denom.>  : su emisor, en su propio espacio de nombres (como R)
//   P  poder:       P:<ambito>           : el génesis, sobre todo el eje; llega a los demás por delegación
//   R  reputación:  R:<emisor>           : su emisor, ampliable solo por él; no fungible
//
// Emitir (iniciar una serie o ampliarla) es lo único reservado a PERSONAS y
// GRUPOS; las COSAS reciben, conservan y mueven tokens como cualquiera (VG, 7-11).
// Todo evento mueve tokens; el evento mínimo mueve T (cualquier escala).
// Sin conversión entre series: una hora NO son sesenta minutos, son tokens
// distintos (como un euro no es un bitcoin, y los EUR de la casa no son los de otro).

/** Ámbito reservado de P: el génesis del eje, es decir, todo el eje. */
export const AMBITO_GENESIS = 'genesis';

export const FAMILIAS = Object.freeze(['E', 'P', 'R', 'T']);

/**
 * La constante: los campos del movimiento que nombran la serie dentro de cada
 * familia. La clave de saldo es familia + ':' + esos campos unidos por '/'.
 * En E la serie es del emisor (como en R): dos emisores con la misma
 * denominación son dos series distintas.
 */
export const SERIE = Object.freeze({
  T: Object.freeze(['escala']),
  E: Object.freeze(['emisor', 'denominacion']),
  P: Object.freeze(['ambito']),
  R: Object.freeze(['emisor']),
});

/** Siete escalas de T, cada una un token distinto. Ampliable hasta MAXIMO_ESCALAS_T. */
export const ESCALAS_T = Object.freeze([
  'segundo', 'minuto', 'hora', 'dia', 'semana', 'ciclo', 'anio',
]);

/** Tope de escalas de T (VG, 7-11: «a lo mejor creamos alguna más para llegar hasta diez»). */
export const MAXIMO_ESCALAS_T = 10;
if (ESCALAS_T.length > MAXIMO_ESCALAS_T) throw new Error('T admite como mucho ' + MAXIMO_ESCALAS_T + ' escalas');

/** Tipos de identidad que se declaran en el alta. Solo sirven para saber quién emite. */
export const TIPOS = Object.freeze(['persona', 'grupo', 'cosa']);

/** Quien puede emitir (iniciar o ampliar una serie): personas y grupos (VG, 7-11). */
export const EMITEN = Object.freeze(['persona', 'grupo']);

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

/** Clave de saldo: familia + ':' + su serie (T:hora, E:casa/EUR, P:<ámbito>, R:<emisor>). */
export function claveToken(m) {
  return m.token + ':' + (SERIE[m.token] ?? []).map((campo) => m[campo]).join('/');
}

/**
 * Parte una clave de saldo en la familia, la serie y sus campos:
 * 'T:hora' → { token: 'T', serie: 'hora', escala: 'hora' };
 * 'E:casa/EUR' → { token: 'E', serie: 'casa/EUR', emisor: 'casa', denominacion: 'EUR' }.
 * El emisor de E no lleva '/', así que la primera '/' separa sin ambigüedad.
 */
export function partirClave(clave) {
  const i = clave.indexOf(':');
  const token = clave.slice(0, i);
  const serie = clave.slice(i + 1);
  const campos = SERIE[token] ?? [];
  if (campos.length === 1) return { token, serie, [campos[0]]: serie };
  const j = serie.indexOf('/');
  return { token, serie, [campos[0]]: serie.slice(0, j), [campos[1]]: serie.slice(j + 1) };
}

/** Cantidad del movimiento en su saldo: la misma, sin conversión (cada escala de T es su propio token). */
export function cantidadBase(m) {
  return m.cantidad;
}

const texto = (x) => typeof x === 'string' && x.length > 0;

/**
 * Movimiento: { token, cantidad, de, a, escala (T), denominacion y emisor (E), ambito (P), emisor (R) }.
 * de = null es emisión: el génesis emite; después emiten su serie de E o de R
 * su emisor, a sí mismo. a = null es consumo.
 */
export function validarMovimiento(m) {
  const errores = [];
  if (!m || typeof m !== 'object') return ['movimiento no es objeto'];
  if (!FAMILIAS.includes(m.token)) errores.push('token desconocido: ' + m.token);
  if (!(Number.isFinite(m.cantidad) && m.cantidad > 0)) errores.push('cantidad debe ser > 0');
  if (m.token === 'T') {
    if (!ESCALAS_T.includes(m.escala)) errores.push('escala T inválida: ' + m.escala);
    // Cada escala es un token: no hay medias horas (serían minutos), y los enteros no acumulan error.
    if (Number.isFinite(m.cantidad) && !Number.isSafeInteger(m.cantidad)) errores.push('T va en enteros: cada escala es un token');
  }
  if (m.token !== 'T' && m.escala !== undefined) errores.push('escala solo en T');
  if (m.token === 'E') {
    if (!texto(m.denominacion)) errores.push('E exige denominación');
    if (!texto(m.emisor)) errores.push('E exige emisor: la serie es de quien la emite');
    else if (m.emisor.includes('/')) errores.push('el emisor de E no lleva «/»');
  }
  if (m.token !== 'E' && m.denominacion !== undefined) errores.push('denominación solo en E');
  if (m.token === 'P' && !texto(m.ambito)) errores.push('P exige ámbito: no hay poder total');
  if (m.token === 'R') {
    if (!texto(m.emisor)) errores.push('R exige emisor');
    else if (m.de !== null && m.de !== m.emisor) errores.push('R no es fungible: solo la mueve su emisor ' + m.emisor);
  }
  // Una serie nace en la cartera de su emisor (E y R); de ahí se mueve.
  if ((m.token === 'E' || m.token === 'R') && texto(m.emisor) && m.de === null && m.a !== m.emisor) {
    errores.push('la emisión de ' + m.token + ' va a su propio emisor');
  }
  if (m.token !== 'P' && m.ambito !== undefined) errores.push('ámbito solo en P');
  if (m.token !== 'R' && m.token !== 'E' && m.emisor !== undefined) errores.push('emisor solo en E y en R');
  // Los separadores de las claves de serie están reservados: ni identidades ni denominaciones los llevan.
  for (const campo of ['de', 'a', 'emisor', 'denominacion', 'ambito', 'escala']) {
    if (typeof m[campo] === 'string' && /[|:/]/.test(m[campo])) errores.push(campo + ' no puede llevar | : ni /');
  }
  if (m.de === undefined || m.a === undefined) errores.push('de y a son obligatorios (null permitido)');
  // Una identidad es una cadena no vacía, como el autor: '' no podría escribir nunca.
  if (m.de !== null && !texto(m.de)) errores.push('de debe ser identidad o null');
  if (m.a !== null && !texto(m.a)) errores.push('a debe ser identidad o null');
  if (m.de === null && m.a === null) errores.push('movimiento sin origen ni destino');
  return errores;
}
