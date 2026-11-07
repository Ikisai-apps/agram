// Autorizar es bloquear P sobre el registro del recurso, con el umbral del
// dueño (VG, 7-11 noche: «La segunda»; R5 de docs/notas/NEUTRALIDAD_IDENTIDAD.md).
//
// Una consolidación queda AUTORIZADA cuando el P bloqueado con salida = esa
// consolidación, de cualquiera (el autor incluido: ya no hace falta «no ser el
// autor»), alcanza el umbral, medido como FRACCIÓN de lo emitido de esa serie
// de P. Pesa la cantidad, no las cabezas: repartir el mismo P entre diez
// identidades no da ni más ni menos.
//
// El P que respalda E cuenta también (VG, 8-11 madrugada, textual: «P
// bloqueado respaldando la E de un registro cuente también para autorizar
// sobre ese registro: inmovilizar poder en un recurso es ya el compromiso, y
// vale para las dos cosas»). El P que cuenta sobre X, bloqueado con salida =
// una serie de E atada a X o a un registro que cuelga de X (o su familia
// «@*»), con E vivo, suma en el umbral como si estuviera bloqueado con salida
// = la consolidación, sin volver a bloquearlo, SOLO si su titular lo dice: el
// acto de voluntad es su registro de autorización en la fábrica de la
// consolidación con `contexto.autoridad.respaldo: true` (motor.autorizar lo
// escribe; mueve el T de escribirlo, como todo registro, y ningún P). Lo
// retira su registro de liberar (`contexto.libera`). Sin ese acto no cuenta:
// respaldar plazas no autoriza sin querer cualquier consolidación ajena ([X]
// confirmar VG esa salvedad).
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
//   lector.bloqueosDe(id)         los bloqueos de esa identidad: [{ clave, salida, cantidad }]
//   lector.respaldoE(salida)      si la salida es una serie de E (o una familia «@*») emitida: { registro, vivo }; si no, null

import { esDireccion, indicesDe } from './btml.js';
import { AMBITO_GENESIS, TODAS_LAS_FRANJAS, partirClave, franjaDe } from './tokens.js';

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
    bloqueosDe: (identidad) => eje.bloqueos(identidad).map(({ clave, salida, cantidad }) => ({ clave, salida, cantidad })),
    respaldoE: (salida) => {
      if (!esSalidaE(salida)) return null;
      if (esFamilia(salida)) {
        const vivo = eje.vivo(salida);
        return vivo > 0 ? { registro: registroDeFamilia(salida, (e) => eje.alta(e)?.id), vivo } : null;
      }
      if (!(eje.serie(salida).emitido > 0)) return null;
      return { registro: eje.registroDe(salida), vivo: eje.vivo(salida) };
    },
  };
}

/** ¿Es `salida` la clave de una serie de E (o de su familia)? */
export const esSalidaE = (salida) => typeof salida === 'string' && salida.startsWith('E:');

/** ¿Es `salida` la clave de una familia de E (la franja «*»: todas sus franjas)? */
export const esFamilia = (salida) => esSalidaE(salida) && franjaDe(partirClave(salida).denominacion) === TODAS_LAS_FRANJAS;

/**
 * El registro al que está atada una familia de E: el que nombra su clave o, si
 * no nombra ninguno, el alta de su emisor (`altaDe(emisor)`), como sus series.
 */
export function registroDeFamilia(familia, altaDe) {
  const p = partirClave(familia);
  return p.registro ?? altaDe(p.emisor) ?? null;
}

/**
 * X, el REGISTRO DEL RECURSO de una consolidación (VG, 8-11): el registro MÁS
 * CERCANO del hilo de su foco (el foco incluido) que tenga P propio emitido
 * (la serie P:X, que solo emite el autor de X, R3). Manda el más concreto con
 * poder emitido, escalón a escalón: la raíz del dominio solo manda donde nadie
 * ha emitido P por debajo de ella, y el génesis solo donde nadie ha emitido P.
 * Así un ancestro intermedio con P propio (una habitación que la casa gobierna
 * aparte) es el que manda sobre lo que cuelga de él. Nunca es la consolidación
 * (se sube desde su foco). Sustituye «X = la raíz del dominio» (7-11 noche).
 *
 * [X] decidir VG: quien escribe un registro puede acuñar P sobre él (R3), así
 * que con esta regla decide lo que se consolide encima de su registro; p. ej.
 * si quien reserva acuñara P sobre su reserva, la entrega de la casa
 * consolidada sobre ella la autorizaría quien reserva, no recepción.
 */
export function recursoDe(lector, consolidacion) {
  const g = lector.genesisId;
  const c = typeof consolidacion === 'string' ? lector.obtener(consolidacion) : consolidacion;
  if (!c || c.sobre === null || c.sobre === undefined || c.sobre === g) return g;
  let x = lector.obtener(c.sobre);
  if (!x) return undefined;
  while (x.sobre !== null && x.id !== g) {
    if (lector.emitido('P:' + x.id) > 0) return x.id;
    const padre = lector.obtener(x.sobre);
    if (!padre) return undefined;
    x = padre;
  }
  return g;
}

/**
 * Qué P cuenta para autorizar sobre X: { claves, emitido, ambito, delEje }.
 * Si X tiene P propio emitido (la serie P:X, que solo emite su autor), cuenta
 * SOLO P:X, medido sobre lo emitido de P:X: el P del génesis no cuenta. Si no
 * lo tiene (con recursoDe, solo cuando X es el génesis: VG, 8-11, nadie en el
 * hilo ha emitido P), cuenta el P sobre todo el eje: P:genesis y
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

/** ¿Cuelga el registro `registro` de X (X incluido)? Del génesis cuelga todo registro del eje. */
function cuelgaDe(lector, registro, X) {
  let r = registro ? lector.obtener(registro) : undefined;
  if (!r) return false;
  if (X === lector.genesisId || X === AMBITO_GENESIS) return true;
  while (r) {
    if (r.id === X) return true;
    if (r.sobre === null || r.sobre === undefined) return false;
    r = lector.obtener(r.sobre);
  }
  return false;
}

/**
 * El P que `identidad` tiene bloqueado respaldando E del recurso X y que
 * contaría para autorizar sobre X: [{ clave, salida, cantidad }]. Es el P de
 * las claves que cuentan sobre X (`claves`, de clavesDeP) bloqueado con salida
 * = una serie de E (o su familia «@*») atada a X o a un registro que cuelga de
 * X, con E vivo (emitido − consumido). El E vivo es lo que lo inmoviliza (el
 * eje no deja liberar el P que respalda E vivo: src/eje.js, reglasDelTope §4);
 * sin E vivo ese bloqueo se suelta cuando se quiera y no es compromiso.
 * [X] confirmar VG: la caducidad de la E no se mira aquí (el estado de una
 * consolidación no depende del reloj); la E caducada deja de inmovilizar su P,
 * y en cuanto su titular lo libera deja de contar.
 */
export function respaldoDe(lector, identidad, X, claves) {
  if (typeof lector.bloqueosDe !== 'function' || typeof lector.respaldoE !== 'function') return [];
  const cuentan = new Set(claves);
  return lector.bloqueosDe(identidad).filter((b) => {
    if (!(b.cantidad > 0) || !cuentan.has(b.clave) || !esSalidaE(b.salida)) return false;
    const e = lector.respaldoE(b.salida);
    return Boolean(e) && e.vivo > 0 && cuelgaDe(lector, e.registro, X);
  });
}

/**
 * ¿Es `ev` el acto de voluntad de su autor de autorizar la consolidación `cId`
 * con el P que ya respalda E? Su registro de autorización en la fábrica de la
 * consolidación, con `contexto.autoridad.respaldo: true`.
 */
export function esActoDeRespaldo(ev, cId) {
  return Boolean(ev) && ev.sobre === cId && ev.en === FABRICA && ev.contexto?.fase === 'autorizado' && ev.contexto?.autoridad?.respaldo === true;
}

/**
 * Quiénes tienen en pie el acto de voluntad sobre la consolidación `c`: los
 * autores de un acto de respaldo (esActoDeRespaldo) que no lo retiraron
 * después con un registro de liberar (`contexto.libera` = la consolidación) en
 * su fábrica. Por orden de llegada: el último de cada uno manda.
 */
export function conActoDeRespaldo(lector, c) {
  const id = typeof c === 'string' ? c : c?.id;
  const vivos = new Set();
  if (!id) return vivos;
  for (const e of lector.sobre(id, FABRICA)) {
    if (esActoDeRespaldo(e, id)) vivos.add(e.autor);
    else if (e.contexto?.libera === id) vivos.delete(e.autor);
  }
  return vivos;
}

/**
 * El peso de la autorización de una consolidación: { recurso, ambito, claves,
 * delEje, emitido, bloqueado, directo, respaldo, respaldan, umbral, necesario,
 * alcanza }. `directo` suma el P de las claves que cuentan bloqueado con
 * salida = la consolidación, de cualquier titular y desde cualquier registro;
 * `respaldo`, el P de esas claves que respalda E del recurso, de quienes
 * tienen en pie su acto de voluntad (`respaldan`: [{ identidad, cantidad }]);
 * `bloqueado` es la suma de los dos, lo que se compara con el umbral.
 */
export function pesoDe(lector, consolidacion) {
  const c = typeof consolidacion === 'string' ? lector.obtener(consolidacion) : consolidacion;
  const recurso = recursoDe(lector, c);
  const { claves, emitido, ambito, delEje } = clavesDeP(lector, recurso);
  const directo = c?.id ? claves.reduce((s, k) => s + lector.bloqueadoCon(k, c.id), 0) : 0;
  const respaldan = c?.id
    ? [...conActoDeRespaldo(lector, c)]
      .map((identidad) => ({ identidad, cantidad: respaldoDe(lector, identidad, recurso, claves).reduce((s, b) => s + b.cantidad, 0) }))
      .filter((r) => r.cantidad > 0)
    : [];
  const respaldo = respaldan.reduce((s, r) => s + r.cantidad, 0);
  const bloqueado = directo + respaldo;
  const umbral = umbralDe(lector, recurso);
  return { recurso, ambito, claves, delEje, emitido, bloqueado, directo, respaldo, respaldan, umbral, necesario: (umbral.num / umbral.den) * emitido, alcanza: alcanzaUmbral(bloqueado, emitido, umbral) };
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
