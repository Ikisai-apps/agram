// Tokens de base de datos. Cuatro familias, y cada familia es una SERIE
// (VG, 7-11: «las series de tokens son una constante y se estandarizan»).
// La serie es limitada y la emite quien la respalda; la clave de saldo dice
// de qué serie es cada token.
//
//   familia: clave de serie              : quién la emite
//   T  tiempo:      T:<escala>           : nadie lo emite: cada persona recibe su asignación diaria (VG, 8-11); el génesis, explícito; no cruza de persona (a una cosa, sí)
//   E  recursos:    E:<emisor>/<denom.>[@<registro>] : una persona, a su nombre; atada al registro del recurso
//   P  poder:       P:<ambito>/<origen>  : nadie lo emite: lo obtiene una identidad (su origen) al escribir un registro, conseguir E o recibir R; delegarlo no cambia el origen.
//                                          El ámbito es un registro r, o una MIRADA de él, r.d (VG, tras 3b-bis: P por mirada): el P sobre r.d pesa solo en lo que
//                                          se decide sobre la mirada d (1 su E, 2 su P, 3 su R, 4 su T, 5 su encaje); el P sobre r entero pesa en todo lo de r
//   R  reputación:  R:<emisor>           : una persona, a su nombre
//
// VG, 7-11 noche: «todos son emitidos por una persona individualmente.
// Siempre es X persona respalda Y recurso concreto, poder de decisión sobre
// algo, reputación cedida a otros para requerir atención, o tiempo usado por
// alguien en algo». Emitir (iniciar una serie o ampliarla) es solo de
// PERSONAS, en su propio nombre; no hay identidades de grupo (VG, 8-11: «lo
// único que tenemos de grupo es la delegación»): un grupo es un registro, su
// autor emite P sobre él y lo delega, y las COSAS reciben, conservan y mueven
// tokens como cualquiera. La emisión es escalonada (src/ciclo.js): «normalmente
// será T + (opc) R; si T + R + (opc) P; si T+R+P + (opc) E».
// Todo evento mueve tokens; el evento mínimo CONSUME T del autor (cualquier escala), y el consumo se anota
// en el registro que soporta (VG, 7-11 noche; src/evento.js, src/eje.js tiempoSobre).
// Sin conversión entre series: una hora NO son sesenta minutos, son tokens
// distintos (como un euro no es un bitcoin, y los EUR de la casa no son los de otro).

import { esInstante, msDeGuardado } from './instante.js';
import { EPOCA_0_BTML_DATOS } from '../datos/epocas/epocas.js';

// Los datos del mundo viven en la época (VG, 10-11, A3): los segundos de cada
// escala (epoch.7.0, el calendario), la asignación diaria y las partes en que
// se dan las escalas grandes (epoch.1.3.1). SEGUNDOS, ASIGNACION_T y PARTES_T
// se leen de ahí, por el dígito de cada escala: una sola verdad.
const T_DE_LA_EPOCA = EPOCA_0_BTML_DATOS[1][3][1]; // k → [[nombre], [asignación diaria], [en partes de]]
const CALENDARIO = EPOCA_0_BTML_DATOS[7][0]; // k → [[nombre], [segundos], …], solo las escalas que se miden

/** Ámbito reservado de P: el génesis del eje, es decir, todo el eje. */
export const AMBITO_GENESIS = 'genesis';

export const FAMILIAS = Object.freeze(['E', 'P', 'R', 'T']);

/**
 * La constante: los campos del movimiento que nombran la serie dentro de cada
 * familia. La clave de saldo es familia + ':' + esos campos unidos por '/'.
 * En E la serie es del emisor (como en R): dos emisores con la misma
 * denominación son dos series distintas. Y E lleva además el REGISTRO del
 * recurso (VG, 7-11 noche, R2 del estudio de neutralidad): el id del evento
 * donde vive lo que respalda (la casa, el menú, la plaza). Va al final, tras
 * SEPARADOR_REGISTRO y no tras '/': 'E:casa/cama-2@2026-11-13@<id>'. Es
 * opcional: sin él, la serie queda atada al registro del propio emisor (su
 * alta; el génesis para quien lo escribió), que es como eran todas antes
 * ('E:casa/EUR'). [X] decidir VG si se vuelve obligatorio fuera del génesis.
 */
export const SERIE = Object.freeze({
  T: Object.freeze(['escala']),
  E: Object.freeze(['emisor', 'denominacion', 'registro']),
  // El P guarda su origen como la R guarda su emisor (VG, 10-11, encargo 3b-bis): quien lo obtuvo. Transferirlo
  // (delegar) o reposicionarlo no lo cambia, así que el 100 % de cada persona por dominio se cuenta sobre el P de su
  // origen, esté en la mano que esté.
  P: Object.freeze(['ambito', 'origen']),
  R: Object.freeze(['emisor']),
});

/**
 * Separador del registro en la clave de E: la ÚLTIMA '@', seguida de un id de
 * evento (64 hexadecimales en minúscula) y de nada más. La denominación puede
 * llevar '@' (cama-2@2026-11-13), pero no puede acabar en '@<id>': así la
 * clave se parte sin ambigüedad, lleve registro o no.
 */
export const SEPARADOR_REGISTRO = '@';

/** Forma del id de un evento: el hash SHA-256 de su cuerpo, en hexadecimal (src/evento.js). */
const ID_EVENTO = /^[0-9a-f]{64}$/;
const COLA_REGISTRO = /@([0-9a-f]{64})$/;
/** El ámbito de P con mirada: «<id del registro>.<dígito>» (VG, tras 3b-bis: P por mirada). */
const AMBITO_CON_MIRADA = /^([0-9a-f]{64})\.([0-9])$/;

/**
 * El registro de un ámbito de P: el mismo ámbito si es un registro entero, o el registro de una mirada «r.d». Lo que
 * pesa en todo lo de r es el P sobre r; el P sobre r.d, solo en lo que se decide sobre la mirada d.
 */
export function raizDeAmbito(ambito) {
  const m = typeof ambito === 'string' ? AMBITO_CON_MIRADA.exec(ambito) : null;
  return m ? m[1] : ambito;
}

/** La mirada de un ámbito de P («r.d» → d, un dígito), o undefined si es un registro entero. */
export function miradaDeAmbito(ambito) {
  const m = typeof ambito === 'string' ? AMBITO_CON_MIRADA.exec(ambito) : null;
  return m ? Number(m[2]) : undefined;
}

/** El ámbito de P de una mirada de un registro: «r.d»; sin mirada, el registro entero. */
export function ambitoDe(registro, mirada) {
  return mirada === undefined || mirada === null ? registro : registro + '.' + mirada;
}

/**
 * La FRANJA de una denominación de E (VG, 7-11 noche: «capacidad = serie
 * limitada de E (cama-2@noche) emitida por la casa»; una casa de 4 plazas
 * tiene 4 POR NOCHE): lo que va tras su última '@' (`cama-2@2026-11-13` →
 * `2026-11-13`). El tope compartido de un registro se cuenta por franja. Es
 * texto opaco: el eje no interpreta fechas ni ordena franjas; quien respalda
 * el recurso elige su granularidad (una noche, un turno, un día, nada). Las
 * denominaciones sin '@' forman una sola franja, la de siempre: ''.
 */
export function franjaDe(denominacion) {
  const i = typeof denominacion === 'string' ? denominacion.lastIndexOf('@') : -1;
  return i < 0 ? '' : denominacion.slice(i + 1);
}

/**
 * Franja reservada: «todas las franjas». Bloquear P con la salida = la clave
 * de la serie con esta franja (`familiaDe`) respalda a la vez todas las
 * franjas de esa denominación (la cama de matrimonio, todas las noches).
 * Ninguna denominación acaba en '@*'.
 */
export const TODAS_LAS_FRANJAS = '*';

/**
 * Clave de la familia de una serie de E: la misma clave con la franja
 * cambiada por TODAS_LAS_FRANJAS ('E:casa/cama@2026-11-13@<id>' →
 * 'E:casa/cama@*@<id>'; sin franja, 'E:casa/EUR' → 'E:casa/EUR@*').
 */
export function familiaDe(clave) {
  const p = partirClave(clave);
  if (p.token !== 'E') return clave;
  const i = p.denominacion.lastIndexOf('@');
  const base = i < 0 ? p.denominacion : p.denominacion.slice(0, i);
  return claveToken({ token: 'E', emisor: p.emisor, denominacion: base + '@' + TODAS_LAS_FRANJAS, registro: p.registro });
}

/** ¿Tiene `x` la forma del id de un evento (lo que nombra el registro de una serie de E)? */
export function esIdRegistro(x) {
  return typeof x === 'string' && ID_EVENTO.test(x);
}

/**
 * Capacidad (VG, 7-11). Una décupla declara cuántos caben con un entero
 * positivo en su criterio, la posición 2: una plaza [[nombre], [precio],
 * [capacidad]] bajo la época 0 (0 representación, 1 recursos, 2 criterios).
 * La leen el motor, para el contador informativo de una posición
 * (motor.ocupacion), y el eje, para el TOPE de E de un registro: la capacidad
 * de un registro es la que declara su payload raíz en la posición 2.
 * [X] decidir VG: cómo se declara la capacidad (alternativa: en los recursos, 1).
 */
export const CRITERIO_CAPACIDAD = 2;

/** Capacidad que declara una décupla (el contenido de una posición o el payload de un registro), o undefined. */
export function capacidadDe(nodo) {
  if (!Array.isArray(nodo)) return undefined;
  // Forma canónica (VG, 8-11): cada posición entre corchetes; [2] es la lista de un ocupante, y una hoja suelta es lo mismo.
  const p = nodo[CRITERIO_CAPACIDAD];
  const c = Array.isArray(p) && p.length === 1 ? p[0] : p;
  return Number.isSafeInteger(c) && c > 0 ? c : undefined;
}

/** Las siete escalas reales de T: tiempo que se mide (SEGUNDOS) y tiene orden (modos.ordenDeEscala). */
export const ESCALAS_REALES = Object.freeze([
  'segundo', 'minuto', 'hora', 'dia', 'semana', 'ciclo', 'anio',
]);

/**
 * Tres escalas informativas (VG, 8-11): T PASADO (tiempo que no se registró
 * en su momento y se registra ahora), T FUTURO (el que se quiere
 * pre-registrar) y T INVENTADO. Son ILIMITADAS: «pondría uno, pero si lo
 * gastas te vuelve a salir uno»; gastarlas no agota nada y no se rechazan por
 * saldo. Lo que importa es que QUEDA REGISTRADO como tal: «tal persona, en tal
 * día, dijo que un año antes había hecho tal cosa; no lo registró en ese
 * momento». Por eso solo se consumen (a = null), y el movimiento lleva la
 * fecha a la que se refiere (`refiere`, instante ISO con zona: obligatoria en
 * pasado y futuro, opcional en inventado) además del t real del evento, y
 * una `nota` opcional (texto). No miden: SEGUNDOS no las convierte (null), no
 * tienen orden y se enseñan aparte de las reales (eje.tiempoInformativo).
 * No cuentan como el T que consume escribir ([X] Core: si contasen, escribir
 * saldría gratis).
 */
export const ESCALAS_INFORMATIVAS = Object.freeze(['pasado', 'futuro', 'inventado']);

/** Diez escalas de T, cada una un token distinto: las siete reales y las tres informativas. */
export const ESCALAS_T = Object.freeze([...ESCALAS_REALES, ...ESCALAS_INFORMATIVAS]);

/** Tope de escalas de T (VG, 7-11: «a lo mejor creamos alguna más para llegar hasta diez»). */
export const MAXIMO_ESCALAS_T = 10;
if (ESCALAS_T.length > MAXIMO_ESCALAS_T) throw new Error('T admite como mucho ' + MAXIMO_ESCALAS_T + ' escalas');

// No hay tipos de identidad (VG, 10-11, B1): una persona es la identidad que
// escribe su propia alta; una cosa, la que da de alta otra identidad, su
// dueño (src/eje.js, esPersona). Solo emiten las personas (VG, 7-11 noche:
// «todos son emitidos por una persona individualmente»), en su propio nombre;
// lo dice una regla de la época que lee quién escribió el alta.

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
 * El movimiento ANUNCIADO (VG 12-11, decisión 8 del estudio BQL-transacciones; resuelve #48): un movimiento del
 * registro que no toca saldos y dice lo que se moverá (de quién, a quién, qué serie, cuánto) y, si lo lleva, para
 * cuándo (`refiere`, la fecha a la que se refiere: su D-MOV 7.1). El libro no lo aplica (src/eje.js: un paso vacío);
 * lo lee `moves` con la clase «anuncio» y lo cumple el registro que se ancla sobre él moviendo lo mismo (la lectura
 * «stage»). Las estaciones por las que pasa (propuesta, autorizada, ejecutada, verificada) son datos de la época.
 * El T informativo ya es lo anunciado del T (T futuro con fecha): no se anuncia otra vez.
 */
export const ANUNCIADO = 'anunciado';

/** ¿Es un movimiento anunciado (no toca saldos)? */
export const esAnunciado = (m) => Boolean(m) && typeof m === 'object' && m.estado === ANUNCIADO;

/** Los movimientos de un evento que tocan saldos: los declarados menos los anunciados. */
export const movimientosReales = (ev) => (Array.isArray(ev?.movimientos) ? ev.movimientos : []).filter((m) => !esAnunciado(m));

/**
 * Duración de cada escala en segundos, para MEDIR distancias de tiempo (las
 * bandas del eje temporal), solo de las escalas reales. No convierte tokens: los saldos de T no se
 * suman entre escalas. Año = 13 ciclos de 28 días + 1. De la época: el 1 de
 * cada escala del calendario (epoch.7.0.k.1).
 */
export const SEGUNDOS = Object.freeze(Object.fromEntries(ESCALAS_T.map((e, k) => [
  e,
  // Las informativas no miden tiempo (el calendario no las lleva): nada las convierte a segundos.
  ESCALAS_REALES.includes(e) ? CALENDARIO[k][1][0] : null,
])));

// T como asignación diaria (VG, 8-11): «como en los videojuegos: llega a las
// 12 de la noche y te da todo el T del día siguiente, todos los segundos,
// todos los minutos, las horas, el día, el proporcional de la semana, de los
// 28 días y del año. Te lo gastas como quieras, no te puedes gastar más. Es
// suficiente para que no sea limitante». Sustituye al tope del reloj
// acumulado desde el alta y a acuñar al gastar («VG, 8-11: asignación diaria»).

/**
 * Partes en que se dan, cada día, las escalas grandes (VG, 8-11: «tú
 * diariamente tienes la posibilidad de poner uno partido de 7, 28 o 364 para
 * que ese día decidas»): la persona recibe cada día 1/7 de semana, 1/28 de
 * ciclo y 1/364 de año. Por eso la `cantidad` de T en estas tres escalas va
 * en esas partes, enteras: 1 es un día de semana (1/7), y una semana entera
 * son 7. Así T sigue en enteros y nada acumula error; se lee como fracción
 * (textoT: «3/7 semana», «1 semana»). De la época: el 2 de cada escala de T
 * (epoch.1.3.1.k.2), cuando es más de una.
 */
export const PARTES_T = Object.freeze(Object.fromEntries(ESCALAS_REALES.map((e, k) => [e, T_DE_LA_EPOCA[k][2][0]]).filter(([, n]) => n > 1)));

/**
 * Asignación diaria de T de una persona, por escala (en las grandes, en sus
 * partes: un día de semana, de ciclo, de año). Las tres informativas no
 * tienen asignación: son ilimitadas (siempre queda 1). Se renueva cada día civil de su propio reloj (el
 * t de sus eventos, en UTC); lo no gastado NO se acumula ([X] confirmar VG).
 * De la época: el 1 de cada escala de T (epoch.1.3.1.k.1).
 */
export const ASIGNACION_T = Object.freeze(Object.fromEntries(ESCALAS_REALES.map((e, k) => [e, T_DE_LA_EPOCA[k][1][0]])));

const MS_DIA = 86400 * 1000;
const msDe = (x) => (typeof x === 'number' ? x : msDeGuardado(x));

/** Día civil (UTC) de un instante: días enteros desde 1970-01-01. NaN si no es un instante. */
export function diaCivil(t) {
  const ms = msDe(t);
  return Number.isFinite(ms) ? Math.floor(ms / MS_DIA) : NaN;
}

/**
 * Asignación de T de una persona en la escala `escala` para el instante `t`:
 * { periodo, cantidad }. `periodo` es el día civil de `t`: lo gastado se
 * cuenta por día y, al cambiar de día, la asignación es la nueva entera.
 */
export function asignacionT(t, escala) {
  const dia = diaCivil(t);
  if (!Number.isFinite(dia) || !Object.hasOwn(ASIGNACION_T, escala)) return { periodo: null, cantidad: 0 };
  return { periodo: dia, cantidad: ASIGNACION_T[escala] };
}

/**
 * Cantidad de T para leer: en las escalas grandes, como fracción de sus
 * partes o como entero cuando cuadra (textoT('semana', 3) → «3/7 semana»,
 * textoT('semana', 7) → «1 semana»); en las demás, el número y la escala.
 */
export function textoT(escala, cantidad) {
  const n = PARTES_T[escala];
  if (!n || cantidad % n === 0) return (n ? cantidad / n : cantidad) + ' ' + escala;
  return cantidad + '/' + n + ' ' + escala;
}

/**
 * El origen de un movimiento de P (encargo 3b-bis): el que lleva o, si no lo dice, quien lo mueve (`de`) o, al
 * acuñarlo, quien lo recibe (`a`): el P propio. Mover P de otro origen (el delegado que lo pasa o lo compromete)
 * exige decirlo. Así los movimientos de P escritos antes del origen se leen igual (src/persistencia.js).
 */
export function origenDe(m) {
  return m.origen ?? m.de ?? m.a;
}

/**
 * Clave de saldo: familia + ':' + su serie (T:hora, E:casa/EUR,
 * E:casa/cama@2026-11-13@<registro>, P:<ámbito>/<origen>, R:<emisor>).
 */
export function claveToken(m) {
  if (m.token === 'E') return 'E:' + m.emisor + '/' + m.denominacion + (m.registro === undefined ? '' : SEPARADOR_REGISTRO + m.registro);
  if (m.token === 'P') return 'P:' + m.ambito + (origenDe(m) == null ? '' : '/' + origenDe(m));
  return m.token + ':' + (SERIE[m.token] ?? []).map((campo) => m[campo]).join('/');
}

/**
 * Parte una clave de saldo en la familia, la serie y sus campos:
 * 'T:hora' → { token: 'T', serie: 'hora', escala: 'hora' };
 * 'E:casa/EUR' → { token: 'E', serie: 'casa/EUR', emisor: 'casa', denominacion: 'EUR' };
 * 'E:casa/cama@2026-11-13@<id>' → { …, denominacion: 'cama@2026-11-13', registro: '<id>' };
 * 'P:<id>/ana' → { token: 'P', serie: '<id>/ana', ambito: '<id>', origen: 'ana' }.
 * El emisor de E y el ámbito de P no llevan '/', así que la primera '/' separa sin ambigüedad;
 * el registro es la cola '@<id>' (SEPARADOR_REGISTRO), que ninguna
 * denominación puede llevar. Sin registro, la clave no lleva el campo.
 */
export function partirClave(clave) {
  const i = clave.indexOf(':');
  const token = clave.slice(0, i);
  const serie = clave.slice(i + 1);
  const campos = SERIE[token] ?? [];
  const j = serie.indexOf('/');
  if (campos.length === 1 || j < 0) {
    if (token === 'P') {
      const mirada = miradaDeAmbito(serie);
      return { token, serie, ambito: serie, raiz: raizDeAmbito(serie), ...(mirada === undefined ? {} : { mirada }) };
    }
    return { token, serie, [campos[0]]: serie };
  }
  const resto = serie.slice(j + 1);
  const cola = token === 'E' ? COLA_REGISTRO.exec(resto) : null;
  // P por mirada (VG, tras 3b-bis): el ámbito «r.d» se parte en su registro (`raiz`) y su mirada; un ámbito entero no lleva mirada.
  if (token === 'P') {
    const ambito = serie.slice(0, j);
    const mirada = miradaDeAmbito(ambito);
    return { token, serie, ambito, origen: resto, raiz: raizDeAmbito(ambito), ...(mirada === undefined ? {} : { mirada }) };
  }
  if (!cola) return { token, serie, [campos[0]]: serie.slice(0, j), [campos[1]]: resto };
  return { token, serie, [campos[0]]: serie.slice(0, j), [campos[1]]: resto.slice(0, cola.index), registro: cola[1] };
}

/** Cantidad del movimiento en su saldo: la misma, sin conversión (cada escala de T es su propio token). */
export function cantidadBase(m) {
  return m.cantidad;
}

const texto = (x) => typeof x === 'string' && x.length > 0;

/** Nombres que no valen como salida ni como parte de una serie (SEG-12): los del prototipo de JavaScript. */
export const RESERVADOS = Object.freeze(['__proto__', 'constructor', 'prototype']);

/**
 * Movimiento: { token, cantidad, de, a, escala (T), denominacion, emisor, registro, caduca, divisible y emisores (E), ambito y origen (P), emisor (R), estado y salida }.
 * El origen de P es opcional: sin él, el de quien lo mueve o, al acuñarlo, el de quien lo recibe (origenDe).
 * de = null es emisión: nace en la cartera de quien la emite (en E y R, su
 * emisor; quién puede emitir lo dice el eje). a = null es consumo.
 * estado ('bloqueo' | 'liberacion') no cambia de titular (de = a) y exige salida.
 * caduca (ISO) solo en la emisión de E: es un campo del contrato de la serie y
 * no se ejecuta solo. Del mismo contrato, y también solo en la emisión de E:
 * divisible (true: la serie admite fracciones; sin él, va en enteros) y
 * emisores (la emisión conjunta: dos o más identidades, el emisor entre
 * ellas, que suman el P que tienen bloqueado para la serie). registro (el id
 * del evento donde vive el recurso) es parte de la serie: va en todo
 * movimiento de ella. Lo que exige el contrato lo comprueba el eje.
 */
export function validarMovimiento(m) {
  const errores = [];
  if (!m || typeof m !== 'object') return ['movimiento no es objeto'];
  if (!FAMILIAS.includes(m.token)) errores.push('token desconocido: ' + m.token);
  if (!(Number.isFinite(m.cantidad) && m.cantidad > 0)) errores.push('cantidad debe ser > 0');
  if (m.token === 'T') {
    if (!ESCALAS_T.includes(m.escala)) errores.push('escala T inválida: ' + m.escala);
    // Cada escala es un token: no hay medias horas (serían minutos), y los enteros no acumulan error.
    // Semana, ciclo y año van en sus partes diarias (PARTES_T): también enteras.
    if (Number.isFinite(m.cantidad) && !Number.isSafeInteger(m.cantidad)) errores.push('T va en enteros: cada escala es un token');
  }
  if (m.token !== 'T' && m.escala !== undefined) errores.push('escala solo en T');
  // El T informativo (VG, 8-11) queda registrado como tal: se consume, con la fecha a la que se refiere y una nota.
  const informativa = m.token === 'T' && ESCALAS_INFORMATIVAS.includes(m.escala);
  if (informativa) {
    if (m.a !== null || m.estado !== undefined) errores.push('T ' + m.escala + ' solo se consume (a = null): se registra, no se da ni se bloquea');
    if (m.refiere === undefined) { if (m.escala !== 'inventado') errores.push('T ' + m.escala + ' exige refiere: la fecha a la que se refiere (instante ISO-8601 con zona)'); }
    else if (!esInstante(m.refiere)) errores.push('refiere debe ser instante ISO-8601 con zona explícita');
    if (m.nota !== undefined && !texto(m.nota)) errores.push('la nota es texto');
  } else {
    if (m.nota !== undefined) errores.push('nota solo en T pasado, futuro o inventado');
    if (m.refiere !== undefined && m.estado !== ANUNCIADO) errores.push('refiere solo en T pasado, futuro o inventado, o en un movimiento anunciado');
    else if (m.refiere !== undefined && !esInstante(m.refiere)) errores.push('refiere debe ser instante ISO-8601 con zona explícita');
  }
  if (m.token === 'E') {
    if (!texto(m.denominacion)) errores.push('E exige denominación');
    if (!texto(m.emisor)) errores.push('E exige emisor: la serie es de quien la emite');
    else if (m.emisor.includes('/')) errores.push('el emisor de E no lleva «/»');
    // La cola '@<id>' es la del registro: una denominación que acabase así no se distinguiría de él.
    if (texto(m.denominacion) && COLA_REGISTRO.test(m.denominacion)) errores.push('la denominación de E no acaba en «@<id de evento>»: esa cola es la del registro');
    if (texto(m.denominacion) && franjaDe(m.denominacion) === TODAS_LAS_FRANJAS) errores.push('la denominación de E no acaba en «@*»: es la franja reservada a «todas las franjas»');
    if (m.registro !== undefined && !esIdRegistro(m.registro)) errores.push('el registro de E es el id de un evento (64 hexadecimales en minúscula)');
    if (m.divisible !== undefined && m.divisible !== true) errores.push('divisible solo admite true (sin él, la serie va en enteros)');
    if (m.emisores !== undefined) {
      const lista = Array.isArray(m.emisores) && m.emisores.length >= 2 && m.emisores.every(texto) && new Set(m.emisores).size === m.emisores.length;
      if (!lista) errores.push('emisores es la emisión conjunta: dos o más identidades distintas');
      else if (m.emisores.some((x) => /[|:/]/.test(x))) errores.push('emisores no puede llevar | : ni /');
      else if (!m.emisores.includes(m.emisor)) errores.push('emisores incluye al emisor de la serie: ' + m.emisor);
    }
    if (m.de !== null && (m.divisible !== undefined || m.emisores !== undefined || m.precio !== undefined || m.precios !== undefined)) errores.push('divisible, emisores y precio solo en la emisión de E: son del contrato de la serie');
    // El precio de la serie (VG, tras 3b-bis: la orientación de una E es el token que la paga): el principal, `precio`
    // = [<serie o familia con que se paga>, <cantidad por unidad>], y los aceptados, `precios`, una lista de pares.
    const pares = [...(m.precio === undefined ? [] : [['precio', m.precio]]), ...(m.precios === undefined ? [] : Array.isArray(m.precios) ? m.precios.map((p) => ['precios', p]) : [['precios', null]])];
    for (const [campo, par] of pares) {
      if (!Array.isArray(par) || par.length !== 2 || !texto(par[0]) || !(Number.isFinite(par[1]) && par[1] >= 0)) errores.push(campo + ' de E es [<serie o familia con que se paga>, <cantidad por unidad>] (en precios, una lista de pares)');
    }
  } else {
    for (const campo of ['registro', 'divisible', 'emisores', 'precio', 'precios']) if (m[campo] !== undefined) errores.push(campo + ' solo en E');
  }
  if (m.token !== 'E' && m.denominacion !== undefined) errores.push('denominación solo en E');
  if (m.token === 'P' && !texto(m.ambito)) errores.push('P exige ámbito: no hay poder total');
  if (m.token === 'P' && m.origen !== undefined && !texto(m.origen)) errores.push('el origen de P es la identidad que lo obtuvo (texto)');
  if (m.token !== 'P' && m.origen !== undefined) errores.push('origen solo en P');
  // R se transfiere libremente entre tenedores sin cambiar de emisor (VG, 9-11, mapa §15 [D] «R según el corpus»: se
  // corrige la #62, que solo dejaba devolverla) y el tenedor puede perdonarla quemándola («R, últimas dos»).
  if (m.token === 'R' && !texto(m.emisor)) errores.push('R exige emisor');
  // Una serie nace en la cartera de su emisor (E y R); de ahí se mueve.
  if ((m.token === 'E' || m.token === 'R') && texto(m.emisor) && m.de === null && m.a !== m.emisor) {
    errores.push('la emisión de ' + m.token + ' va a su propio emisor');
  }
  if (m.token !== 'P' && m.ambito !== undefined) errores.push('ámbito solo en P');
  if (m.token !== 'R' && m.token !== 'E' && m.emisor !== undefined) errores.push('emisor solo en E y en R');
  // Los separadores de las claves de serie están reservados: ni identidades ni denominaciones los llevan.
  for (const campo of ['de', 'a', 'emisor', 'denominacion', 'ambito', 'origen', 'escala']) {
    if (typeof m[campo] === 'string' && /[|:/]/.test(m[campo])) errores.push(campo + ' no puede llevar | : ni /');
  }
  // SEG-12: la salida y las partes de una serie son textos de fuera que indexan diccionarios; los nombres del
  // prototipo de JavaScript no valen como ninguno de ellos.
  for (const campo of ['salida', 'emisor', 'denominacion', 'ambito', 'origen']) {
    if (RESERVADOS.includes(m[campo])) errores.push(campo + ' no puede llamarse «' + m[campo] + '»: es un nombre reservado (' + RESERVADOS.join(', ') + ')');
  }
  if (m.de === undefined || m.a === undefined) errores.push('de y a son obligatorios (null permitido)');
  // Una identidad es una cadena no vacía, como el autor: '' no podría escribir nunca.
  if (m.de !== null && !texto(m.de)) errores.push('de debe ser identidad o null');
  if (m.a !== null && !texto(m.a)) errores.push('a debe ser identidad o null');
  if (m.de === null && m.a === null) errores.push('movimiento sin origen ni destino');
  if (m.estado === ANUNCIADO) {
    if (informativa) errores.push('el T ' + m.escala + ' no se anuncia: ya es lo anunciado (se consume con la fecha a la que se refiere)');
    if (m.salida !== undefined) errores.push('un movimiento anunciado no lleva salida: no se mueve todavía');
  } else if (m.estado !== undefined) {
    if (!ESTADOS.includes(m.estado)) errores.push('estado inválido: ' + m.estado + ' (bloqueo, liberacion o anunciado)');
    else {
      if (m.de === null || m.a !== m.de) errores.push(m.estado + ': de y a son el mismo titular (no cambia de manos)');
      if (!texto(m.salida)) errores.push(m.estado + ' exige salida: la condición de liberación, declarada (no verificable todavía)');
    }
  } else if (m.salida !== undefined) {
    // Transferir con salida (mapa §15, delegar: «transferencia con salida»; §16, la invitación: «lo que te doy»):
    // las unidades salen de lo bloqueado de `de` con esa salida y llegan a `a` bloqueadas con ella, o libres si la
    // salida nombra a quien las recibe. Solo en una transferencia: acuñar y quemar no llevan salida.
    if (m.de === null || m.a === null) errores.push('salida solo con estado (bloqueo o liberacion) o en una transferencia (de y a)');
    else if (m.de === m.a) errores.push('una transferencia con salida cambia de manos: de y a son distintos');
    else if (!texto(m.salida)) errores.push('la salida es texto');
  }
  if (m.caduca !== undefined) {
    if (m.token !== 'E' || m.de !== null) errores.push('caduca solo en la emisión de E');
    else if (!esInstante(m.caduca)) errores.push('caduca debe ser instante ISO-8601 con zona explícita');
  }
  return errores;
}
