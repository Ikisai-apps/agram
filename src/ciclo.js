// Ciclo de vida de E/P/R/T (VG, 7-11 noche): quién emite y en qué orden.
//
// «Todos son emitidos por una persona individualmente. Siempre es X persona
// respalda Y recurso concreto, poder de decisión sobre algo, reputación
// cedida a otros para requerir atención, o tiempo usado por alguien en algo.»
// Y la emisión es escalonada: «normalmente será T + (opc) R; si T + R + (opc)
// P; si T+R+P + (opc) E».
//
// Lo que queda aquí de las reglas de emisión de un evento que no es el génesis
// (encargo 3a, paso 9): el P acuñado (PP-2, PP-3) y el escalonado (ES-1), que son
// del 3b, el estrechamiento de P (PP-5) y la caducidad de una serie de E (EE-9).
// El reloj, quién emite, T no se emite, no se bloquea ni cruza de persona y el T
// del día son reglas de la época (src/condiciones/reglas.js).
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

import { AMBITO_GENESIS, ESCALAS_INFORMATIVAS, SEGUNDOS, asignacionT, claveToken, validarMovimiento } from './tokens.js';
import { msDeGuardado, segundosUTC } from './instante.js';
import { esConsolidacion, FABRICA } from './autorizacion.js';
import { esConsumoT } from './evento.js';
import { rPropiaEnJuego } from './lente.js';

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
 *   tipo(id)                 'persona' | 'cosa' | null ('grupo' solo en el prefijo de la versión 2)
 *   alta(id)                 { id, t } del evento que la dio de alta, o null (acotada si es del prefijo v2)
 *   tMaximo()                el mayor t aceptado en el eje, en milisegundos UTC
 *   gastadoT(id, e, periodo) T de la asignación de esa persona gastado en esa escala ese día (tokens.asignacionT)
 *   serie(clave)             { emisor, emitido, caduca } o null
 *   registro(id)             el evento con ese id, o undefined
 *   ambitosQueCubren(ambito) los ámbitos de P que cubren un registro
 *   saldo(id, clave)         saldo disponible
 *   reglas                   2 si el evento se guardó con la versión 2; si no, las de ahora
 *   genesisId                el id del génesis
 *   autorizada(id)           true si la consolidación id está AUTORIZADA (y sin ejecutar) justo antes del evento
 *                            (src/autorizacion.js: estadoPorPeso con el lector de ese momento)
 *   ampliada(id)             true si la consolidación id ya respaldó una ampliación de P (consolidacionQueAmplia, que lee este mismo contexto)
 *   bloqueado(id, k, salida) lo bloqueado de esa serie por esa identidad con esa salida (la R propia en juego, R6)
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

// Lo que comparten varias secciones: el P del autor sobre un registro y lo emitido de una serie P.

/** P del autor sobre un registro antes del evento: saldo disponible en un ámbito que lo cubre. */
export const poderAntesDe = (ev, ctx) => (registro) => ctx.ambitosQueCubren(registro).reduce((s, a) => s + Math.max(0, ctx.saldo(ev.autor, 'P:' + a)), 0);

/** Lo emitido de la serie P de un registro antes del evento (sobre el génesis, P:genesis y P:<id> juntas). */
export const emitidoAntesDe = (ctx) => (ambito) => clavesDeSerieP(ambito, ctx.genesisId).reduce((s, k) => s + (ctx.serie(k)?.emitido ?? 0), 0);

/**
 * PP-2, PP-3, EE-9 (caducidad): lo que queda en JS de quién emite (encargo 3a, paso 9). Que solo las personas
 * emitan, en su propio nombre, y que T no se emita son reglas de la época («only persons mint», «E is minted by and
 * to its issuer», «R is minted by its issuer», «nobody mints T»), conectadas al eje (src/condiciones/reglas.js).
 * Queda el P acuñado, que es del 3b (el mapa §15 lo cambia: lo acuña quien escribió el registro, una vez; R3), y la
 * caducidad de una serie de E, que la fija su primera emisión. Un solo motivo por movimiento: el primero que falla.
 */
function emision(ev, ctx, validos) {
  const errores = [];
  const falla = (i, capa, texto) => errores.push({ i, capa, texto });
  const autor = ev.autor;
  const emitidoAntes = emitidoAntesDe(ctx);
  const caducas = new Map(); // clave → caducidad fijada en este evento
  // Suelo de persistencia (VG, 10-11, A4 y B1): quien entró en el prefijo de la versión 2 es lo que declaró su alta
  // entonces, y solo las personas emiten. Fuera de él, persona o cosa por autoría: la regla «only persons mint».
  const tipoV2 = ctx.tipo?.(autor);

  for (const { m, i } of validos) {
    if (m.de !== null) continue;
    if (tipoV2 && tipoV2 !== 'persona') { falla(i, 5, 'solo las personas emiten: ' + autor + ' es ' + tipoV2 + ' (lo declaró su alta, de la versión 2)'); continue; }
    if (m.token === 'P') {
      // 3b. Acuñar P es solo de quien escribió el registro (sobre el eje entero, del génesis). Quien solo TIENE P lo
      // transfiere (delegar estrecha el ámbito y conserva la cantidad), pero no lo acuña.
      if (m.a !== autor) { falla(i, 5, 'la emisión de P va a quien la emite: ' + autor); continue; }
      const registro = m.ambito === AMBITO_GENESIS ? undefined : ctx.registro(m.ambito);
      if (!registro) {
        falla(i, 4, m.ambito === AMBITO_GENESIS
          ? 'P sobre todo el eje («' + AMBITO_GENESIS + '») solo lo emite el génesis'
          : 'P fuera del génesis va sobre un registro existente: ámbito desconocido ' + corto(m.ambito));
        continue;
      }
      if (registro.autor !== autor) {
        falla(i, 5, 'P sobre ' + corto(m.ambito) + ' lo acuña solo quien escribió el registro (' + registro.autor + '): ' + autor + ' puede transferir el P que tenga, no acuñarlo');
        continue;
      }
      // R3 (VG, 7-11 noche): P:X es una serie cerrada; ampliarla es ejecutar una consolidación AUTORIZADA sobre X.
      const noAmplia = emitidoAntes(m.ambito) > 0 ? porQueNoAmplia(ev, m.ambito, ctx) : null;
      if (noAmplia) {
        falla(i, 5, 'P:' + corto(m.ambito) + ' es una serie cerrada: ya la emitió su autor, y ampliarla es ejecutar una consolidación sobre ' + corto(m.ambito) + ' que esté AUTORIZADA (R3): ' + noAmplia);
      }
    }
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
 * PP-5. R3 (VG, 7-11 noche): quien recibe P solo lo delega (repartiendo: el
 * eje debita del ámbito exacto y, si no alcanza, de los que lo cubren) o lo
 * bloquea. Delegar con el ámbito de un registro X tomando de un ámbito más
 * amplio (estrechar) crea P:X que no viene de la emisión de X, así que: hacia
 * una serie cerrada (P:X ya emitida) no se estrecha; y hacia la raíz de un
 * dominio (un registro sobre el génesis, el que decide al autorizar:
 * src/autorizacion.js) solo estrecha su autor ([X] confirmar VG). Si no,
 * quien tiene P del eje lo convertiría en P de la raíz antes de que su autor
 * emita, y el P del génesis contaría donde la raíz tiene P propio. Estrechar
 * hacia un registro que no es raíz sigue libre: ese P no autoriza nada.
 */
function estrechar(ev, ctx, validos) {
  const errores = [];
  const autor = ev.autor;
  const emitidoAntes = emitidoAntesDe(ctx);
  const exacto = new Map(); // ámbito → P:ámbito exacto disponible del autor, durante el evento
  const verExacto = (a) => (exacto.has(a) ? exacto.get(a) : Math.max(0, ctx.saldo(autor, 'P:' + a)));
  const emitidaAqui = new Set(); // ámbitos de P emitidos en este evento
  for (const { m, i } of validos) {
    if (m.token !== 'P') continue;
    const a = m.ambito;
    if (m.de === null) {
      emitidaAqui.add(a);
      if (m.a === autor) exacto.set(a, verExacto(a) + m.cantidad);
      continue;
    }
    if (m.de !== autor) continue;
    if (m.estado === 'liberacion') { exacto.set(a, verExacto(a) + m.cantidad); continue; }
    const hay = verExacto(a);
    exacto.set(a, Math.max(0, hay - m.cantidad));
    if (m.estado === undefined && m.a === autor) exacto.set(a, exacto.get(a) + m.cantidad);
    if (m.estado !== undefined || hay >= m.cantidad || a === AMBITO_GENESIS || a === ctx.genesisId) continue;
    const registro = ctx.registro(a);
    if (!registro) continue; // el ámbito desconocido lo rechaza el eje
    if (emitidoAntes(a) > 0 || emitidaAqui.has(a)) {
      errores.push({ i, capa: 5, texto: 'P:' + corto(a) + ' es una serie cerrada: se delega el P:' + corto(a) + ' que se tiene (' + hay + '); estrecharlo desde un ámbito más amplio la ampliaría (R3)' });
    } else if (registro.sobre === ctx.genesisId && registro.autor !== autor) {
      errores.push({ i, capa: 5, texto: 'estrechar P hacia ' + corto(a) + ', la raíz de un dominio, es solo de quien la escribió (' + registro.autor + '): ' + autor + ' delega el P que tiene con su ámbito (R3)' });
    }
  }
  return errores;
}

/**
 * ES-1, ES-2, ES-3. Escalonado: R exige T; P exige T y R propia en juego; E
 * exige T, R propia en juego y P sobre el registro.
 */
function escalonado(ev, ctx, validos) {
  const errores = [];
  const falla = (texto) => errores.push({ i: null, capa: 5, texto });
  const autor = ev.autor;
  const emitidas = new Set(validos.filter(({ m }) => m.de === null).map(({ m }) => m.token));
  if (!emitidas.size) return errores;
  const poderAntes = poderAntesDe(ev, ctx);
  // P del autor sobre un registro: saldo disponible en un ámbito que lo cubre, o P que mueve o recibe en este evento con ese ámbito.
  const pEnEvento = (registro) => {
    const cubren = new Set(ctx.ambitosQueCubren(registro));
    return validos.some(({ m }) => m.token === 'P' && (m.de === autor || m.a === autor) && cubren.has(m.ambito));
  };
  const tienePoder = (registro) => poderAntes(registro) > 0 || pEnEvento(registro);
  // «Mover T» es CONSUMIR T del autor (VG, 7-11 noche): de = autor, a =
  // null. Bloquearlo, liberarlo o dárselo a uno mismo no cuesta nada, y T no
  // cruza de persona, así que solo cuenta el consumo.
  const mueveT = validos.some(({ m }) => esConsumoT(m, autor) && !ESCALAS_INFORMATIVAS.includes(m.escala));
  // «R propia en juego» (R6, VG 7-11 noche): R:<autor> bloqueada como colateral de su serie (src/lente.js).
  const rEnJuego = rPropiaEnJuego(autor, validos.map(({ m }) => m), ctx);
  for (const token of ['R', 'P', 'E']) {
    if (!emitidas.has(token)) continue;
    if (!mueveT) falla('emitir ' + token + ' exige consumir T del autor en el mismo evento (de = ' + autor + ', a = null; VG, 7-11 noche)');
    if (token !== 'R' && !rEnJuego) {
      falla('emitir ' + token + ' exige R propia en juego: R:' + autor + ' bloqueada como colateral (salida «R:' + autor + '»), al menos la décima parte de lo emitido de R:' + autor + ', antes o en el mismo evento (R6)');
    }
    if (token === 'E' && ctx.registro(ev.sobre) && !tienePoder(ev.sobre)) {
      falla('emitir E exige P del autor sobre el registro ' + corto(ev.sobre) + ' (saldo o movimiento de P en el mismo evento)');
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
  // código JS, retirado, vive solo en test/condiciones-retiradas.mjs como red de equivalencia.
  Object.freeze({ nombre: 'PP-2', filas: Object.freeze(['PP-2', 'PP-3', 'EE-9']), evaluar: emision }),
  Object.freeze({ nombre: 'PP-5', filas: Object.freeze(['PP-5']), evaluar: estrechar }),
  Object.freeze({ nombre: 'ES-1', filas: Object.freeze(['ES-1', 'ES-2', 'ES-3']), evaluar: escalonado }),
]);

/** Las claves de la serie P de un ámbito: sobre el génesis, P:genesis y P:<id del génesis>, que son la misma. */
function clavesDeSerieP(ambito, genesisId) {
  return ambito === AMBITO_GENESIS || ambito === genesisId ? ['P:' + AMBITO_GENESIS, ...(genesisId ? ['P:' + genesisId] : [])] : ['P:' + ambito];
}

/**
 * La consolidación que `ev` usó para ampliar una serie P ya emitida, o null.
 * El eje y las capas de validez la marcan como usada al aplicar el evento: una
 * consolidación respalda UNA ampliación de P. Solo la usa el evento que amplía
 * de verdad (SEG-04, revisión de la #73): su foco es una consolidación de su
 * mismo autor y emite P sobre el registro que ella amplía (sobre el génesis,
 * P:genesis o P:<id del génesis>), en una serie que ya estaba emitida antes del
 * evento, por el camino en que `porQueNoAmplia` no puso pega. Una ejecución
 * que emite P por primera vez sobre otro registro (o un evento de otra
 * identidad en la fábrica) no la consume: si no, bastaría con él para negar
 * la ampliación legítima.
 *
 * `contexto` es el de las reglas del ciclo (reglasDelCiclo) de justo antes de
 * `ev`, o una función que lo da: solo se pide si `ev` está en la fábrica y
 * dice `fase: 'ejecutado'`.
 */
export function consolidacionQueAmplia(ev, contexto) {
  if (!ev || ev.en !== FABRICA || ev.contexto?.fase !== 'ejecutado' || typeof ev.sobre !== 'string') return null;
  const ctx = typeof contexto === 'function' ? contexto() : contexto;
  if (!ctx || ctx.reglas === 2) return null;
  const c = ctx.registro(ev.sobre);
  if (!esConsolidacion(c) || c.autor !== ev.autor) return null;
  const emitidoAntes = (ambito) => clavesDeSerieP(ambito, ctx.genesisId).reduce((s, k) => s + (ctx.serie(k)?.emitido ?? 0), 0);
  const amplia = (Array.isArray(ev.movimientos) ? ev.movimientos : []).some((m) =>
    m && typeof m === 'object' && !validarMovimiento(m).length && m.token === 'P' && m.de === null && m.a === ev.autor &&
    m.ambito !== AMBITO_GENESIS && ctx.registro(m.ambito)?.autor === ev.autor &&
    emitidoAntes(m.ambito) > 0 && porQueNoAmplia(ev, m.ambito, ctx) === null);
  return amplia ? c.id : null;
}

/**
 * Por qué `ev` no amplía la serie P:`ambito`, o null si la amplía: ha de ser la
 * ejecución REAL de una consolidación sobre el registro `ambito` que está
 * AUTORIZADA justo antes (y aún sin ejecutar), y que no haya respaldado ya otra
 * ampliación. Es lo único que amplía una serie P:X ya emitida (R3). La ejecuta
 * su autor (ejecutar en el motor; aquí, el autor de la consolidación, que ha
 * de ser quien emite: el autor de X). Real (SEG-01, revisión de main 7-11
 * noche): no basta con decir `fase: 'ejecutado'`; lleva la evidencia que deja
 * motor.ejecutar, no vacía, con el id de la consolidación, y todas sus
 * referencias son eventos del eje.
 */
export function porQueNoAmplia(ev, ambito, ctx) {
  const c = ctx.registro(ev.sobre);
  if (!esConsolidacion(c) || ev.en !== FABRICA || ev.contexto?.fase !== 'ejecutado') return 'no es la ejecución de una consolidación';
  if (c.autor !== ev.autor) return 'la ejecuta el autor de la consolidación (' + c.autor + ')';
  const sobreElGenesis = ambito === AMBITO_GENESIS || ambito === ctx.genesisId;
  if (sobreElGenesis ? c.sobre !== ctx.genesisId : c.sobre !== ambito) return 'la consolidación ' + corto(c.id) + ' no es sobre ' + corto(ambito);
  const evidencia = ev.contexto?.evidencia;
  if (!Array.isArray(evidencia) || !evidencia.length) return 'una ejecución lleva su evidencia (contexto.evidencia), y esta no la lleva';
  if (!evidencia.includes(c.id)) return 'la evidencia no cita la consolidación ' + corto(c.id);
  const rota = evidencia.find((id) => typeof id !== 'string' || !ctx.registro(id));
  if (rota !== undefined) return 'la evidencia cita ' + corto(rota) + ', que no está en el eje';
  if (ctx.ampliada?.(c.id) === true) return 'la consolidación ' + corto(c.id) + ' ya respaldó una ampliación: respalda una sola';
  if (ctx.autorizada?.(c.id) !== true) return 'la consolidación ' + corto(c.id) + ' no está AUTORIZADA (o ya se ejecutó)';
  return null;
}

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
