// Tokens de base de datos. Cuatro familias, y cada familia es una SERIE
// (VG, 7-11: «las series de tokens son una constante y se estandarizan»).
// La serie es limitada y la emite quien la respalda; la clave de saldo dice
// de qué serie es cada token.
//
//   familia: clave de serie              : quién la emite
//   T  tiempo:      T:<escala>           : cada persona, para sí misma, con el tope del reloj (y el génesis); PROVISIONAL [X]
//   E  recursos:    E:<emisor>/<denom.>  : una persona, a su nombre o al de un grupo sobre el que tiene P
//   P  poder:       P:<ambito>           : el génesis, y una persona sobre un registro que escribió ella (quien solo tiene P lo transfiere, no lo acuña)
//   R  reputación:  R:<emisor>           : una persona, a su nombre o al de un grupo sobre el que tiene P
//
// VG, 7-11 noche: «todos son emitidos por una persona individualmente.
// Siempre es X persona respalda Y recurso concreto, poder de decisión sobre
// algo, reputación cedida a otros para requerir atención, o tiempo usado por
// alguien en algo». Emitir (iniciar una serie o ampliarla) es solo de
// PERSONAS; un grupo es un registro con P delegado (lo que «emite el grupo» lo
// emite una persona con P sobre él), y las COSAS reciben, conservan y mueven
// tokens como cualquiera. La emisión es escalonada (src/ciclo.js): «normalmente
// será T + (opc) R; si T + R + (opc) P; si T+R+P + (opc) E».
// Todo evento mueve tokens; el evento mínimo mueve T (cualquier escala).
// Sin conversión entre series: una hora NO son sesenta minutos, son tokens
// distintos (como un euro no es un bitcoin, y los EUR de la casa no son los de otro).

import { esInstante, msDeGuardado } from './instante.js';

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

/**
 * Quien puede emitir (iniciar o ampliar una serie): solo las personas (VG,
 * 7-11 noche: «todos son emitidos por una persona individualmente»). Lo que
 * se emite a nombre de un grupo lo emite y lo firma una persona con P sobre
 * el registro del grupo.
 */
export const EMITEN = Object.freeze(['persona']);

/**
 * Estados de un movimiento que no cambia de titular (VG, 7-11 noche): bloquear
 * pasa tokens del disponible al bloqueado de quien los tiene; liberar los
 * devuelve al disponible. Los dos exigen `salida`, la condición de liberación
 * (corpus V10: «LOCK exige salida verificable explícita»). Hoy es una salida
 * DECLARADA, no verificable todavía: es texto libre y el propio titular libera
 * cuando quiere. [X] decidir VG qué la hace verificable (p. ej. que la
 * liberación cite un evento de otra identidad).
 */
export const ESTADOS = Object.freeze(['bloqueo', 'liberacion']);

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

// PROVISIONAL [X] (VG, 7-11 noche): «emitir desde dos fuentes es igual de
// válido que emitir el doble desde una única fuente; no da más». El T por
// identidad y reloj de abajo es justo lo que una identidad falsa multiplica
// (y el mínimo da un token por escala a cada alta), así que la regla final
// saldrá del estudio de neutralidad ante agrupación y división.

/**
 * [X] regla de la época, PROVISIONAL (ver arriba): el mínimo del tope de T. Una persona puede emitir,
 * por escala y en total, tantos tokens de T como unidades de esa escala han
 * pasado desde su alta, redondeando hacia arriba, y nunca menos que este
 * mínimo: el reloj marca el tope (VG, 7-11 noche).
 */
export const TOPE_T_MINIMO = 1;

/**
 * [X] regla de la época, PROVISIONAL (neutralidad ante agrupación y división). Tope de T que una persona puede llevar emitido en una
 * escala en el instante `t`: ⌈(t − alta) / SEGUNDOS[escala]⌉, con un mínimo de
 * TOPE_T_MINIMO. `alta` es el instante del evento que la dio de alta (el
 * génesis cuenta como alta de su autor). Lo emitido en el génesis no cuenta.
 * El alta toma el t del evento que la hace, y ese t no es anterior al de su
 * foco ni al alta de su autor ([X] confirmar VG, src/ciclo.js): un alta no se
 * retrofecha para ganar T. Fechar a futuro da más T, pero como mucho un año
 * por delante del mayor t del eje ([X] confirmar VG, src/ciclo.js).
 * Los instantes se comparan en milisegundos UTC (src/instante.js).
 */
export function topeT(alta, t, escala) {
  const ms = msDeGuardado(t) - msDeGuardado(alta);
  const unidades = Number.isFinite(ms) ? Math.ceil(ms / (SEGUNDOS[escala] * 1000)) : 0;
  return Math.max(TOPE_T_MINIMO, unidades);
}

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
 * Movimiento: { token, cantidad, de, a, escala (T), denominacion, emisor y caduca (E), ambito (P), emisor (R), estado y salida }.
 * de = null es emisión: nace en la cartera de quien la emite (en E y R, su
 * emisor; quién puede emitir lo dice el eje). a = null es consumo.
 * estado ('bloqueo' | 'liberacion') no cambia de titular (de = a) y exige salida.
 * caduca (ISO) solo en la emisión de E: es un campo del contrato de la serie y
 * no se ejecuta solo.
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
    // Regla nueva, [X] confirmar VG: quien tiene R de otro solo puede devolvérsela a su emisor (pedirle
    // atención). Antes no podía moverla en absoluto; la devolución sale de la «reputación cedida a otros
    // para requerir atención» de VG, 7-11 noche, pero VG no la ha decidido así.
    else if (m.de !== null && m.de !== m.emisor && m.a !== m.emisor) errores.push('R no es fungible: solo la mueve su emisor ' + m.emisor + '; quien la tiene solo puede devolvérsela');
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
  if (m.estado !== undefined) {
    if (!ESTADOS.includes(m.estado)) errores.push('estado inválido: ' + m.estado + ' (bloqueo o liberacion)');
    else {
      if (m.de === null || m.a !== m.de) errores.push(m.estado + ': de y a son el mismo titular (no cambia de manos)');
      if (!texto(m.salida)) errores.push(m.estado + ' exige salida: la condición de liberación, declarada (no verificable todavía)');
    }
  } else if (m.salida !== undefined) errores.push('salida solo con estado (bloqueo o liberacion)');
  if (m.caduca !== undefined) {
    if (m.token !== 'E' || m.de !== null) errores.push('caduca solo en la emisión de E');
    else if (!esInstante(m.caduca)) errores.push('caduca debe ser instante ISO-8601 con zona explícita');
  }
  return errores;
}
