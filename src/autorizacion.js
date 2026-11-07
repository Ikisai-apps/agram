// Autorizar es bloquear P sobre el registro del recurso, con el umbral del
// dueño (VG, 7-11 noche: «La segunda»; R5 de docs/notas/NEUTRALIDAD_IDENTIDAD.md).
//
// Una consolidación queda AUTORIZADA cuando el P bloqueado con salida = esa
// consolidación, de cualquiera (el autor incluido: ya no hace falta «no ser el
// autor»), alcanza el umbral, medido como FRACCIÓN de lo emitido de esa serie
// de P. Pesa la cantidad, no las cabezas: repartir el mismo P entre diez
// identidades no da ni más ni menos.
//
// Módulo puro: no importa el eje. Lee a través de un «lector», de modo que el
// motor (con el eje de ahora), las reglas del ciclo (src/ciclo.js, con el eje
// de justo antes de un evento) y las capas de validez (src/validez.js, con el
// libro de justo antes de un registro) dicen lo mismo:
//
//   lector.obtener(id)            el registro con ese id, si existe en ese momento
//   lector.genesisId              el id del génesis
//   lector.emitido(clave)         lo emitido de una serie en ese momento
//   lector.bloqueadoCon(clave, s) lo bloqueado de esa serie con la salida s, sumando titulares
//   lector.sobre(id, en)          los registros escritos sobre id en la dirección en, en ese momento

import { esDireccion, indicesDe } from './btml.js';
import { AMBITO_GENESIS } from './tokens.js';

// Autorizar y ejecutar se escriben en FABRICA, sin camino: la celda 4.0.0
// (docs/MOTOR.md §4).
export const FABRICA = '4000000000';

/**
 * Qué es una consolidación: un registro que escribió consolidar, es decir,
 * con fase 'consolidado', motor 'fabrica' y anclado en la fábrica (la
 * posición 4) de un camino de su foco. La fase es un metadato y se puede
 * declarar a mano; el anclaje no se fía de ella (MAPA §11). Un solo criterio
 * para el motor, el ciclo y la validez (auditoría de ajuste 2).
 */
export function esConsolidacion(ev) {
  if (!ev || ev.contexto?.fase !== 'consolidado' || ev.contexto?.motor !== 'fabrica') return false;
  if (!ev.sobre || !esDireccion(ev.en)) return false;
  const indices = indicesDe(ev.en);
  return indices.length > 0 && indices[indices.length - 1] === 4;
}

/** El lector de un eje tal como está ahora. */
export function lectorDelEje(eje) {
  return {
    obtener: (id) => eje.obtener(id),
    genesisId: eje.genesisId,
    emitido: (clave) => eje.serie(clave).emitido,
    bloqueadoCon: (clave, salida) => eje.bloqueadoCon(clave, salida),
    sobre: (id, en) => eje.sobre(id, en),
  };
}

/**
 * X, el REGISTRO DEL RECURSO de una consolidación: el registro raíz del
 * dominio donde se consolida, es decir, el registro de su hilo que cuelga
 * directamente del génesis. Si se consolida sobre el génesis, X es el génesis.
 * Nunca es la consolidación ni un subregistro que escribió su autor dentro del
 * dominio de otro (la reserva de quien reserva, el subregistro de un títere):
 * subir hasta la raíz los salta todos. Si la raíz la escribió el propio autor
 * de la consolidación, el dominio es suyo y X es esa raíz.
 *
 * [X] confirmar VG. Había dos lecturas:
 * (a) subir desde el foco hasta el primer registro que NO escribió el autor
 *     de la consolidación;
 * (b) la raíz del dominio (la que se implementa).
 * Con (a), la entrega de la casa en Booking, consolidada sobre la reserva que
 * escribió quien reserva, la autorizaría el P de quien reserva sobre su
 * reserva: justo el apaño de la #62 que esta regla deshace. Con (b) las dos
 * partes de Booking caen en el Alojamiento de la casa. El precio de (b): un
 * subdominio con P propio dentro de otro (p. ej. el plato de la cocina dentro
 * del menú de la casa) no decide por sí mismo; decide la raíz.
 */
export function recursoDe(lector, consolidacion) {
  const g = lector.genesisId;
  const c = typeof consolidacion === 'string' ? lector.obtener(consolidacion) : consolidacion;
  if (!c || c.sobre === null || c.sobre === undefined || c.sobre === g) return g;
  let x = lector.obtener(c.sobre);
  if (!x) return undefined;
  while (x.sobre !== null && x.sobre !== g) {
    const padre = lector.obtener(x.sobre);
    if (!padre) return undefined;
    x = padre;
  }
  return x.sobre === null ? g : x.id;
}

/**
 * Qué P cuenta para autorizar sobre X: { claves, emitido, ambito, delEje }.
 * Si X tiene P propio emitido (la serie P:X, que solo emite su autor), cuenta
 * SOLO P:X, medido sobre lo emitido de P:X: el P del génesis no cuenta. Si no
 * lo tiene (o X es el génesis), cuenta el P sobre todo el eje: P:genesis y
 * P:<id del génesis>, que es el mismo ámbito, medido sobre lo emitido de los
 * dos (propuesta de Core aceptada por VG, 7-11 noche; [X] si VG quiere otra
 * cosa). El P estrechado hacia X desde un ámbito más amplio (P:X que no viene
 * de la emisión de X) no cuenta mientras X no tenga P propio: quien quiera
 * autorizar con el P del eje lo bloquea sin estrechar.
 */
export function clavesDeP(lector, X) {
  const g = lector.genesisId;
  if (X !== g && X !== AMBITO_GENESIS) {
    const k = 'P:' + X;
    const emitido = lector.emitido(k);
    if (emitido > 0) return { claves: [k], emitido, ambito: X, delEje: false };
  }
  const claves = ['P:' + AMBITO_GENESIS, ...(g ? ['P:' + g] : [])];
  return { claves, emitido: claves.reduce((s, k) => s + lector.emitido(k), 0), ambito: AMBITO_GENESIS, delEje: true };
}

/** El umbral por defecto: MÁS DE LA MITAD del P emitido (estrictamente mayor que 1/2). */
export const UMBRAL_POR_DEFECTO = Object.freeze({ num: 1, den: 2, valor: 0.5, estricto: true, declarado: false, texto: 'más de la mitad' });

/**
 * Forma del umbral que fija el dueño de X en su posición 2 (su criterio): un
 * terminal «umbral a/b» (una fracción de enteros) o «umbral 0.x» (un decimal),
 * entre 0 (excluido) y 1. Con umbral declarado basta ALCANZARLO (≥); sin él,
 * rige más de la mitad (>). No es un lenguaje de criterios: es la única forma
 * que se lee.
 */
const FORMA_UMBRAL = /^umbral\s+(?:(\d+)\s*\/\s*(\d+)|(\d*\.\d+|\d+))$/;

/** Lee un terminal de umbral: { num, den, valor, texto } o null si no es uno legible. */
export function leerUmbral(texto) {
  if (typeof texto !== 'string') return null;
  const m = FORMA_UMBRAL.exec(texto.trim());
  if (!m) return null;
  const [num, den] = m[3] !== undefined ? [Number(m[3]), 1] : [Number(m[1]), Number(m[2])];
  const valor = num / den;
  if (!Number.isFinite(valor) || !(valor > 0) || valor > 1) return null;
  return { num, den, valor, texto: texto.trim() };
}

/**
 * El umbral de X: lo que el dueño de X dejó en su posición 2 (el contenido de
 * X: su 2 si es un terminal, o un terminal de su 2.k si el 2 es un array; el
 * primero que empiece por «umbral»). Lo escrito por otros en el 2 de X no
 * cuenta: es el criterio del dueño. Un «umbral …» ilegible no se adivina:
 * rige el de por defecto y se avisa.
 */
export function umbralDe(lector, X) {
  const ev = lector.obtener(X);
  const dos = Array.isArray(ev?.payload) ? ev.payload[2] : undefined;
  const terminales = Array.isArray(dos) ? dos : [dos];
  const texto = terminales.find((t) => typeof t === 'string' && /^\s*umbral\b/.test(t));
  if (texto === undefined) return UMBRAL_POR_DEFECTO;
  const u = leerUmbral(texto);
  if (!u) return { ...UMBRAL_POR_DEFECTO, aviso: 'umbral ilegible en el 2 de ' + String(X).slice(0, 8) + ' («' + texto + '»): rige más de la mitad' };
  return { ...u, estricto: false, declarado: true };
}

/** ¿Alcanza `bloqueado` el umbral sobre `emitido`? Sin nada emitido, nadie autoriza. */
export function alcanzaUmbral(bloqueado, emitido, umbral) {
  if (!(emitido > 0)) return false;
  return umbral.estricto ? bloqueado * umbral.den > umbral.num * emitido : bloqueado * umbral.den >= umbral.num * emitido;
}

/**
 * El peso de la autorización de una consolidación: { recurso, ambito, claves,
 * delEje, emitido, bloqueado, umbral, necesario, alcanza }. `bloqueado` suma
 * el P de las claves que cuentan bloqueado con salida = la consolidación, de
 * cualquier titular y desde cualquier registro.
 */
export function pesoDe(lector, consolidacion) {
  const c = typeof consolidacion === 'string' ? lector.obtener(consolidacion) : consolidacion;
  const recurso = recursoDe(lector, c);
  const { claves, emitido, ambito, delEje } = clavesDeP(lector, recurso);
  const bloqueado = c?.id ? claves.reduce((s, k) => s + lector.bloqueadoCon(k, c.id), 0) : 0;
  const umbral = umbralDe(lector, recurso);
  return { recurso, ambito, claves, delEje, emitido, bloqueado, umbral, necesario: (umbral.num / umbral.den) * emitido, alcanza: alcanzaUmbral(bloqueado, emitido, umbral) };
}

/** Una ejecución que cuenta: en la fábrica de la consolidación, de su autor, con la evidencia en el eje. */
export function ejecucionesDe(lector, c) {
  return lector.sobre(c.id, FABRICA).filter((e) => e.contexto?.fase === 'ejecutado' && e.autor === c.autor && (e.contexto.evidencia ?? []).every((id) => lector.obtener(id)));
}

/**
 * Estado de una consolidación: EJECUTADO si tiene una ejecución que cuenta;
 * si no, AUTORIZADO si el P bloqueado alcanza el umbral; si no, PENDIENTE DE
 * AUTORIZACIÓN. Cualquier otro registro no tiene estado (undefined).
 */
export function estadoPorPeso(lector, id) {
  const c = lector.obtener(id);
  if (!esConsolidacion(c)) return undefined;
  if (ejecucionesDe(lector, c).length) return 'EJECUTADO';
  return pesoDe(lector, c).alcanza ? 'AUTORIZADO' : 'PENDIENTE DE AUTORIZACIÓN';
}
