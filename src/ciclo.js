// Ciclo de vida de E/P/R/T (VG, 7-11 noche): quién emite y en qué orden.
//
// «Todos son emitidos por una persona individualmente. Siempre es X persona
// respalda Y recurso concreto, poder de decisión sobre algo, reputación
// cedida a otros para requerir atención, o tiempo usado por alguien en algo.»
// Y la emisión es escalonada: «normalmente será T + (opc) R; si T + R + (opc)
// P; si T+R+P + (opc) E».
//
// Lo que queda aquí de las reglas de emisión de un evento que no es el génesis:
// la caducidad de una serie de E (EE-9), que no cabe en una regla (docs/BQLM.md
// §10.3), y las reglas de la versión 2 (suelo de persistencia). El encargo 3b
// (mapa §15, «P como peso de criterio») retiró el P acuñado por el autor
// (PP-2, PP-3, R3), el estrechamiento de P (PP-5) y el escalonado en JS (ES-1):
// son reglas de la época (src/condiciones/reglas.js), como el reloj, quién
// emite, que T no se emita, no se bloquee ni cruce de persona y el T del día.
// Las usan el eje (src/eje.js, al validar) y las capas de validez
// (src/validez.js, con el libro de justo antes del registro), así que las dos
// dicen lo mismo. No simulan saldos: eso lo hace cada uno con su vista. Solo
// leen el contexto de antes del evento y los movimientos del propio evento.
//
// Los eventos que se guardaron con la versión 2 (src/persistencia.js) se
// vuelven a validar con las reglas de entonces (`ctx.reglas === 2`): T y P
// solo los emite el génesis; E y R, su emisor a sí mismo, si es persona o
// grupo; sin escalonado ni regla del reloj. Las reglas nuevas rigen los
// eventos nuevos.

import { ESCALAS_INFORMATIVAS, SEGUNDOS, claveToken, validarMovimiento } from './tokens.js';
import { msDeGuardado, segundosUTC } from './instante.js';

/** Quién emitía en la versión 2 (antes del 7-11 noche): personas y grupos. Solo para eventos guardados con ella. */
/** VG, 8-11: «no hay un tipo de T que se acumule». Nadie emite T, ni el génesis. */
export const T_NO_SE_EMITE = 'T no se emite: ni el génesis; cada persona tiene su asignación del día';

/** VG, 8-11: no hay T acumulable, así que T no se bloquea ni se libera; bloquear es de E, P y R. */
export const T_NO_SE_BLOQUEA = 'T no se bloquea ni se libera (VG, 8-11: no hay T acumulable): bloquear es de E, P y R';

export const EMITEN_V2 = Object.freeze(['persona', 'grupo']);

/** [X] confirmar VG: cuánto puede ir un evento por delante del mayor t del eje (un anio, en milisegundos). */
export const ADELANTO_MAXIMO_MS = SEGUNDOS.anio * 1000;
/** Lo mismo en segundos: el reloj compara en segundos (VG, 10-11, C2). */
export const ADELANTO_MAXIMO_S = SEGUNDOS.anio;

const corto = (x) => String(x).slice(0, 8);

/** Los tipos que admitía la versión 2 (con grupo). Solo para eventos guardados con ella. */
export const TIPOS_V2 = Object.freeze(['persona', 'grupo', 'cosa']);

/**
 * Por qué no vale declarar `tipo` para `id` en un alta (null si vale). Solo en
 * el prefijo de la versión 2 (suelo de persistencia: sus reglas): fuera no hay
 * tipo (VG, 10-11, B1), y persona o cosa se lee de quién escribe el alta.
 */
export function motivoTipo(id, tipo) {
  if (TIPOS_V2.includes(tipo)) return null;
  return 'tipo inválido para ' + id + ': ' + tipo;
}

/** Fuera del prefijo de la versión 2 no hay tipo (VG, 10-11, B1): el motivo para un alta que lo declara. */
export const SIN_TIPO = 'no hay tipo en el alta (VG, 10-11, B1): persona o cosa se lee de quién escribe el alta; persona es quien escribe la suya';

/** El motivo de rechazo cuando alguien mueve lo de otro: nadie mueve tokens ajenos (ni por cuenta de nadie). */
export function motivoAjenos(de) {
  return 'nadie mueve tokens ajenos: ' + de + ' no es el autor';
}

/** Dos caducidades son la misma si faltan las dos o nombran el mismo instante en UTC (no el mismo texto). */
export function mismaCaducidad(a, b) {
  if (a === null || b === null) return a === b;
  return segundosUTC(a) === segundosUTC(b); // en segundos (VG, 10-11, C2)
}

/**
 * El alta de quien entró en el prefijo de la versión 2 (con las reglas viejas,
 * que no ataban el t) cuenta, para el reloj y el tope de T, desde el primer
 * evento de la versión 3 (`tPrimeroV3`) si este es posterior.
 */
export function acotarAltaV2(alta, tPrimeroV3) {
  return msDeGuardado(alta.t) >= msDeGuardado(tPrimeroV3) ? alta : { id: alta.id, t: tPrimeroV3 };
}

/**
 * ¿Gasta este movimiento de la asignación diaria de T de su autor (VG, 8-11)?
 * Un movimiento de T de una persona (`persona`: su autor escribió su alta o
 * la escribe ahora, VG 10-11, B1), suyo, sin estado, que sale de sus manos
 * (consumo o a otra identidad), en una escala real (las informativas son
 * ilimitadas: esInformativoT). Lo usan el eje y las capas de validez al
 * aplicar, como reglasDelCiclo al validar.
 */
export function gastaAsignacion(m, autor, persona) {
  return Boolean(m) && m.token === 'T' && !ESCALAS_INFORMATIVAS.includes(m.escala) && persona === true && m.de === autor && m.a !== autor && m.estado === undefined;
}

/**
 * ¿Escribe `autor` como persona, según el contexto de las reglas del ciclo?
 * (VG, 10-11, B1: persona = quien escribió su propia alta.) Sí si lo es, o si
 * aún no tiene alta: entonces lo que escribe es su alta.
 */
export function escribePersona(autor, ctx) {
  const p = ctx.persona?.(autor);
  return p === null || p === undefined ? true : p;
}

/** ¿Es `id` una cosa? (B1: su alta la escribió otra identidad; o la recibe ahora, en un alta que escribe otro.) */
export function esCosa(id, autor, ctx) {
  const p = ctx.persona?.(id);
  return p === false || ((p === null || p === undefined) && id !== autor);
}

/**
 * ¿Es `m` un consumo de T informativo (pasado, futuro, inventado; VG, 8-11)?
 * Ilimitado: no toca saldos ni asignación; solo queda registrado.
 */
export function esInformativoT(m) {
  return Boolean(m) && m.token === 'T' && ESCALAS_INFORMATIVAS.includes(m.escala) && m.de !== null && m.a === null && m.estado === undefined;
}

/**
 * Reparte el gasto `cantidad` de T: { asignacion, explicito }, lo que sale de
 * lo que queda de la asignación (`queda`) y lo que sale del T explícito.
 */
export function repartirGastoT(queda, cantidad) {
  const asignacion = Math.min(Math.max(0, queda), cantidad);
  return { asignacion, explicito: cantidad - asignacion };
}

/**
 * Errores de las reglas de emisión de `ev`: [{ i, capa, texto }]. `i` es el
 * índice del movimiento (null si es del evento entero); `capa` es 4 si falta
 * respaldo (el T del día, el t del evento, un ámbito que no existe, la
 * caducidad de la serie) y 5 si falta permiso (quién emite, el escalonado).
 * El génesis no pasa por aquí: emite por convención (src/eje.js,
 * erroresGenesis).
 *
 * ctx, todo de antes del evento:
 *   tipo(id)                 el tipo que declaró el alta en el prefijo de la versión 2, o null
 *   serie(clave)             { emisor, emitido, caduca } o null
 *   reglas                   2 si el evento se guardó con la versión 2; si no, las de ahora
 */
export function reglasDelCiclo(ev, ctx) {
  if (!ev || typeof ev !== 'object' || ev.contexto?.genesis === true) return [];
  const validos = validosDe(ev);
  if (ctx.reglas === 2) return reglasV2(ev.autor, validos, ctx);
  return SECCIONES_DEL_CICLO.flatMap((s) => s.evaluar(ev, ctx, validos));
}

/** Los movimientos bien formados de `ev`, con su índice: [{ m, i }]. Lo mal formado ya lo cuenta validarForma. */
export function validosDe(ev) {
  return (Array.isArray(ev.movimientos) ? ev.movimientos : [])
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => m && typeof m === 'object' && !validarMovimiento(m).length);
}

/** Las reglas de emisión de la versión 2 (VA-3), para los eventos guardados con ella. Lista de errores como reglasDelCiclo. */
export function reglasDelCicloV2(ev, ctx) {
  if (!ev || typeof ev !== 'object' || ev.contexto?.genesis === true || ctx.reglas !== 2) return [];
  return reglasV2(ev.autor, validosDe(ev), ctx);
}

/**
 * EE-9 (la caducidad de una serie de E la fija su primera emisión) y, en el prefijo de la versión 2, que solo las
 * personas declaradas emiten: lo que queda en JS de quién emite. Que solo las personas emitan, en su propio nombre, y
 * que T no se emita son reglas de la época; el P ya no se acuña a mano (encargo 3b, mapa §15: lo obtiene quien
 * escribe, consigue E o recibe R, y se reposiciona por el árbol: reglas de la época). Un solo motivo por movimiento.
 */
function emision(ev, ctx, validos) {
  const errores = [];
  const falla = (i, capa, texto) => errores.push({ i, capa, texto });
  const autor = ev.autor;
  const caducas = new Map(); // clave → caducidad fijada en este evento
  // Suelo de persistencia (VG, 10-11, A4 y B1): quien entró en el prefijo de la versión 2 es lo que declaró su alta
  // entonces, y solo las personas emiten. Fuera de él, persona o cosa por autoría: la regla «only persons mint».
  const tipoV2 = ctx.tipo?.(autor);

  for (const { m, i } of validos) {
    if (m.de !== null) continue;
    if (tipoV2 && tipoV2 !== 'persona') { falla(i, 5, 'solo las personas emiten: ' + autor + ' es ' + tipoV2 + ' (lo declaró su alta, de la versión 2)'); continue; }
    if (m.token === 'E') {
      // La caducidad es del contrato de la serie: la fija la primera emisión y las ampliaciones coinciden (como instante).
      const k = claveToken(m);
      const s = ctx.serie(k);
      const fijada = caducas.has(k) ? caducas.get(k) : s && s.emitido > 0 ? (s.caduca ?? null) : undefined;
      const esta = m.caduca ?? null;
      if (fijada === undefined) caducas.set(k, esta);
      else if (!mismaCaducidad(fijada, esta)) falla(i, 4, 'la serie ' + k + (fijada ? ' caduca el ' + fijada : ' no caduca') + ': una ampliación no cambia su caducidad');
    }
  }
  return errores;
}

/**
 * Las secciones de las reglas del ciclo, en el orden en que se evalúan, con
 * las filas del inventario (docs/notas/INVENTARIO_REGLAS.md §2) que cubren.
 * Cada una es (ev, ctx, validos) → [{ i, capa, texto }]. reglasDelCiclo las
 * concatena; src/condiciones/ciclo.js las envuelve como condiciones de una
 * transacción (VG, 9-11: la capa cero).
 */
export const SECCIONES_DEL_CICLO = Object.freeze([
  // Encargo 3a, paso 9: RL-1 (el reloj), ID-9, ID-10 y TT-1 (quién emite), TT-6 (T no se bloquea), TT-4 (el T del
  // día) y TT-8 (T no cruza de persona) son reglas de la época conectadas al eje (src/condiciones/reglas.js); su
  // código JS, retirado, vive solo en test/condiciones-retiradas.mjs como red de equivalencia. Encargo 3b: PP-2 y
  // PP-3 (el P acuñado, R3), PP-5 (estrechar P) y ES-1 (el escalonado) también son reglas de la época (mapa §15).
  Object.freeze({ nombre: 'EE-9', filas: Object.freeze(['EE-9']), evaluar: emision }),
]);

/** Las reglas de emisión de la versión 2, para los eventos guardados con ella. */
function reglasV2(autor, validos, ctx) {
  const errores = [];
  const tipo = ctx.tipo(autor);
  for (const { m, i } of validos) {
    // Lo que la versión 2 no conocía no cabe en su prefijo.
    if (m.estado !== undefined || m.salida !== undefined || m.caduca !== undefined) {
      errores.push({ i, capa: 5, texto: 'estado, salida y caduca no existían en la versión 2: no caben en su prefijo' });
      continue;
    }
    if (m.token === 'R' && m.de !== null && m.de !== m.emisor) {
      errores.push({ i, capa: 5, texto: 'R no es fungible: solo la mueve su emisor ' + m.emisor + ' (reglas de la versión 2: tampoco se devolvía)' });
      continue;
    }
    if (m.de !== null) continue;
    if (m.token === 'T' || m.token === 'P') errores.push({ i, capa: 5, texto: 'solo el génesis emite ' + m.token + ' (reglas de la versión 2)' });
    else if (m.emisor !== autor) errores.push({ i, capa: 5, texto: 'nadie emite en nombre de otro: ' + m.emisor + ' no es el autor (reglas de la versión 2)' });
    else if (!EMITEN_V2.includes(tipo)) errores.push({ i, capa: 5, texto: 'solo personas y grupos emiten: ' + autor + (tipo ? ' es ' + tipo : ' no declaró tipo en su alta') + ' (reglas de la versión 2)' });
  }
  return errores;
}
