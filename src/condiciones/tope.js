// Condiciones de la E atada al recurso (VG, 7-11 noche: «Me parece bien
// todo»; R2 de docs/notas/NEUTRALIDAD_IDENTIDAD.md). Antes vivían al final
// de src/eje.js (reglasDelTope, que se sigue exportando desde allí); ahora
// son condiciones de validez de una transacción (VG, 9-11: la capa cero),
// por secciones con las filas del inventario (docs/notas/INVENTARIO_REGLAS.md
// §2, «Recursos (E)»). Mismo texto, mismo orden, mismo comportamiento.

import { claveToken, partirClave, validarMovimiento, franjaDe, familiaDe, TODAS_LAS_FRANJAS, AMBITO_GENESIS } from '../tokens.js';
import { esInstante, msUTC, segundosUTC, segundosDe } from '../instante.js';

/** Lo que dice series() de una serie de E cuyo registro no declara capacidad ni la hereda. */
export const SIN_CAPACIDAD = 'sin capacidad declarada: deuda del emisor';

/** Margen para comparar cantidades de E y cuotas (las series divisibles van en coma flotante). */
const MARGEN = 1e-9;

const corto = (x) => String(x).slice(0, 8);
const enEnteros = (k) => 'la serie ' + k + ' va en enteros: no se declaró divisible (divisible: true en su primera emisión)';
const mismoConjunto = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

/**
 * El contrato de una serie de E que fija su primera emisión: caducidad,
 * registro (el que nombra o, si no nombra ninguno, `registroEmisor`: el alta
 * de su emisor), si es divisible y quiénes la emiten juntos (null si la
 * emite solo su emisor). Y lo consumido, que empieza en 0.
 */
export function contratoE(m, registroEmisor) {
  return {
    caduca: m.caduca ?? null,
    registro: m.registro ?? registroEmisor ?? null,
    divisible: m.divisible === true,
    emisores: m.emisores ? [...m.emisores].sort() : null,
    consumido: 0,
  };
}

/** El génesis y los no-eventos no pasan por aquí; los movimientos mal formados ya los cuenta validarForma. */
const validosDe = (ev) => (Array.isArray(ev.movimientos) ? ev.movimientos : [])
  .map((m, i) => ({ m, i }))
  .filter(({ m }) => m && typeof m === 'object' && !validarMovimiento(m).length);

/**
 * Reglas de la E atada al recurso. Errores [{ i, capa, texto }] como los de
 * reglasDelCiclo: `i` es el movimiento (null si es del evento), capa 4 si
 * falta respaldo y 5 si falta permiso. No miran saldos (eso lo hace la
 * simulación del libro); leen el eje de antes del evento (`ctx`) y simulan
 * solo lo que el propio evento emite, consume, bloquea y libera.
 *
 * 1. El registro (EE-1). La serie de E lleva el id del evento donde vive el
 *    recurso (`registro`, en la clave tras la última '@'); ha de existir en
 *    el eje. Sin él, la serie queda atada al registro de su emisor (su alta).
 * 2. El tope compartido, POR FRANJA (EE-3, EE-5, EE-6, EE-11, RL-4). La
 *    franja es lo que va tras la última '@' de la denominación
 *    (tokens.franjaDe: `cama-2@2026-11-13` → `2026-11-13`); texto opaco que
 *    el eje no interpreta y cuya granularidad elige quien respalda el
 *    recurso; sin '@', una sola franja, ''. Para cada registro del hilo del
 *    de la serie (él incluido) que declara capacidad (tokens.capacidadDe
 *    sobre su payload raíz), el E vivo en el t del evento (emitido −
 *    consumido, y nada si la serie caducó; la caducidad, con el reloj del
 *    eje: el menor entre el t del evento y el mayor t aceptado antes de él,
 *    SEG-03 [X] confirmar VG) de ese registro y de todos sus descendientes,
 *    sumando todas las denominaciones y todos los emisores DE LA MISMA
 *    FRANJA, no pasa de esa capacidad: una casa de 4 plazas tiene 4 por
 *    noche (VG, 7-11 noche). Se miran TODOS los que la declaran, no solo el
 *    más cercano: así un subregistro que declare más capacidad no esquiva el
 *    tope de su ancestro. Sin ninguno no hay tope: deuda del emisor
 *    (SIN_CAPACIDAD).
 * 3. La cuota por P bloqueado, por serie (EE-7). Con tope, para cada
 *    registro A que lo declara, el E vivo de la serie no pasa de ⌊P
 *    bloqueado ÷ P emitido × capacidad⌋, donde el P es P:A si A tiene P
 *    propio emitido y, si no, P:genesis («el génesis solo manda donde nadie
 *    ha emitido P», VG), y el bloqueado es el de los emisores de la serie con
 *    la salida = la clave de la serie o la de su FAMILIA (tokens.familiaDe:
 *    la franja cambiada por «*»): [X] un mismo bloqueo respalda así la misma
 *    cama todas las noches, porque la capacidad se repite en cada franja.
 * 4. Ese bloqueo no se libera (EE-8): un P bloqueado con la salida = la clave
 *    de una serie de E no se libera mientras quede E vivo de esa serie, ni
 *    con la de una familia mientras quede E vivo en alguna de sus franjas.
 * 5. El redondeo y la emisión conjunta (EE-9, EE-10). Fracciones solo en las
 *    series declaradas divisibles (`divisible: true` en la primera emisión;
 *    las ampliaciones coinciden, como `caduca`); en ellas la cuota no se
 *    redondea. Cuando la unidad no se parte (una cama), la emisión conjunta:
 *    `emisores: [...]`, el emisor entre ellos, suman el P que cada uno tiene
 *    bloqueado para la serie. El eje lleva una sola firma por evento, así
 *    que [X] la firma de cada coemisor es su propio bloqueo, escrito y
 *    firmado por él antes: quien aparece en `emisores` sin P bloqueado para
 *    la serie no la respalda y se rechaza. Los emisores son del contrato de
 *    la serie: las ampliaciones coinciden.
 *
 * Un evento guardado con la versión 2 no conoce registro, divisible ni
 * emisores (VA-3). El génesis no pasa por aquí (GN-1, src/condiciones/identidad.js).
 *
 * ctx, todo de antes del evento:
 *   reglas                     2 si el evento se guardó con la versión 2
 *   tMaximo(excluidos)         el mayor t aceptado antes del evento entre los eventos de identidades que no están en
 *                              `excluidos`, en milisegundos UTC (el reloj de la caducidad); -Infinity si no hay ninguno
 *   registro(id)               el evento con ese id, o undefined
 *   alta(id)                   { id, t } del alta, o null
 *   serie(clave)               { emisor, emitido, consumido, caduca, registro, divisible, emisores } (E) o { emisor, emitido } (P), o null
 *   seriesE()                  [[clave, serie]] de todas las series de E
 *   topes(registro)            [{ id, capacidad }]: los registros de su hilo que declaran capacidad
 *   dentro(registro, ancestro) si `ancestro` está en el hilo de `registro`
 *   bloqueado(id, clave, salida)
 *   bloqueadoP(id, salida)     P de cualquier ámbito que `id` tiene bloqueado con esa salida
 */
export function reglasDelTope(ev, ctx) {
  if (!ev || typeof ev !== 'object' || ev.contexto?.genesis === true) return [];
  if (ctx.reglas === 2) return reglasDelTopeV2(ev, ctx);
  const a = analizar(ev, ctx);
  return SECCIONES_DEL_TOPE.flatMap((s) => s.evaluar(ev, ctx, a));
}

/** VA-3: en el prefijo de la versión 2 no caben registro, divisible ni emisores. */
export function reglasDelTopeV2(ev, ctx) {
  if (!ev || typeof ev !== 'object' || ev.contexto?.genesis === true || ctx.reglas !== 2) return [];
  const errores = [];
  for (const { m, i } of validosDe(ev)) {
    if (m.token === 'E' && (m.registro !== undefined || m.divisible !== undefined || m.emisores !== undefined)) {
      errores.push({ i, capa: 5, texto: 'registro, divisible y emisores no existían en la versión 2: no caben en su prefijo' });
    }
  }
  return errores;
}

// El análisis del evento lo comparten las cuatro secciones: reglasDelTope lo hace una vez y se lo pasa a cada una;
// las condiciones (src/condiciones/index.js), una vez por contexto (analisisDelTope).
const ANALISIS = new WeakMap(); // ctx → { ev, a }

/** El análisis de `ev` con `ctx`, hecho una sola vez para ese contexto (las condiciones de una misma transacción lo comparten). */
export function analisisDelTope(ev, ctx) {
  const hecho = ANALISIS.get(ctx);
  if (hecho && hecho.ev === ev) return hecho.a;
  const a = analizar(ev, ctx);
  ANALISIS.set(ctx, { ev, a });
  return a;
}

/** Recorre los movimientos del evento: el contrato de lo que emite (sección 1, con sus errores) y lo que consume, bloquea y libera. */
function analizar(ev, ctx) {
  const errores = [];
  const falla = (i, capa, texto) => errores.push({ i, capa, texto });
  // Vista de las series de E tras el evento: su contrato, lo emitido y lo consumido.
  const vistas = new Map();
  const estado = (k) => {
    if (!vistas.has(k)) {
      const s = ctx.serie(k);
      vistas.set(k, s ? { ...s } : null);
    }
    return vistas.get(k);
  };
  const pEmitido = new Map(); // clave de P → emitido tras el evento
  const verP = (k) => pEmitido.get(k) ?? ctx.serie(k)?.emitido ?? 0;
  const bloqueos = new Map(); // JSON [id, clave, salida] → delta del evento
  const verB = (id, k, salida) => ctx.bloqueado(id, k, salida) + (bloqueos.get(JSON.stringify([id, k, salida])) ?? 0);
  const emitidas = new Map(); // clave de E → índice de su primera emisión en el evento
  const conjuntas = []; // [{ i, clave, emisores }]
  const liberaciones = []; // [{ i, salida }]
  const validos = validosDe(ev);

  for (const { m, i } of validos) {
    const k = claveToken(m);
    if (m.token === 'E') {
      if (m.de === null) {
        if (m.registro !== undefined && !ctx.registro(m.registro)) { falla(i, 4, 'registro desconocido de la serie ' + k + ': ' + corto(m.registro) + ' (la E se ata a un registro del eje)'); continue; }
        let s = estado(k);
        if (!s) {
          s = { emisor: m.emisor, emitido: 0, ...contratoE(m, ctx.alta(m.emisor)?.id) };
          vistas.set(k, s);
        } else {
          if ((m.divisible === true) !== Boolean(s.divisible)) falla(i, 4, 'la serie ' + k + (s.divisible ? ' es' : ' no es') + ' divisible: una ampliación no cambia su contrato');
          const tiene = s.emisores ?? [s.emisor];
          if (!mismoConjunto(tiene, m.emisores ?? [m.emisor])) falla(i, 4, 'la serie ' + k + ' la emiten ' + tiene.join(', ') + ': una ampliación no cambia sus emisores');
        }
        if (!s.divisible && !Number.isInteger(m.cantidad)) falla(i, 4, enEnteros(k));
        s.emitido += m.cantidad;
        if (!emitidas.has(k)) emitidas.set(k, i);
        if (m.emisores) conjuntas.push({ i, clave: k, emisores: m.emisores });
        continue;
      }
      const s = estado(k);
      if (!s) continue; // sin serie no hay saldo: lo rechaza la simulación del libro
      if (!s.divisible && !Number.isInteger(m.cantidad)) falla(i, 4, enEnteros(k));
      if (m.a === null && m.estado === undefined) s.consumido += m.cantidad;
      continue;
    }
    if (m.token !== 'P') continue;
    if (m.de === null) { pEmitido.set(k, verP(k) + m.cantidad); continue; }
    if (m.estado === 'bloqueo' || m.estado === 'liberacion') {
      const llave = JSON.stringify([m.de, k, m.salida]);
      bloqueos.set(llave, (bloqueos.get(llave) ?? 0) + (m.estado === 'bloqueo' ? m.cantidad : -m.cantidad));
      if (m.estado === 'liberacion') liberaciones.push({ i, salida: m.salida });
    }
  }

  // La caducidad solo RELAJA (la E caducada no cuenta para el tope, la cuota ni el P que la respalda), así que se
  // mira con el reloj del eje, no con el del autor (SEG-03, [X] confirmar VG): el menor entre el t del evento y el
  // mayor t aceptado ANTES de él. Fechar a futuro no hace caducar la E viva en beneficio propio.
  // Y el reloj lo marcan los demás (SEG-05, [X] confirmar VG; RL-4): ese mayor t se toma solo de los eventos de
  // identidades distintas del autor y de los emisores de la E que este evento emite (a quienes beneficia que caduque).
  // Sin ninguno, no hay reloj y nada caduca: el E vivo cuenta entero. Si no, quien escribe antes un evento suyo fechado
  // a futuro adelanta el reloj para sí.
  let tReloj;
  const reloj = () => {
    if (tReloj !== undefined) return tReloj;
    const excluidos = new Set([ev.autor]);
    for (const { m } of validos) {
      if (m.token !== 'E' || m.de !== null) continue;
      excluidos.add(m.emisor);
      for (const e of Array.isArray(m.emisores) ? m.emisores : []) excluidos.add(e);
    }
    const tMax = ctx.tMaximo?.([...excluidos]) ?? -Infinity;
    tReloj = esInstante(ev.t) ? Math.min(msUTC(ev.t), tMax) : NaN;
    return tReloj;
  };
  // En segundos (VG, 10-11, C2), como D-FECHA en las reglas.
  const caducaYa = (s) => Boolean(s.caduca) && !Number.isNaN(reloj()) && segundosDe(reloj()) >= segundosUTC(s.caduca);
  const vivoDe = (s) => (!s || caducaYa(s) ? 0 : s.emitido - s.consumido);

  // Todas las series de E tras el evento, con su franja; calculado una vez.
  let todas = null;
  const series = () => {
    if (todas) return todas;
    const vistas2 = new Map(ctx.seriesE());
    for (const [k, s] of vistas) if (s) vistas2.set(k, s);
    todas = [...vistas2].map(([k, s]) => [k, s, franjaDe(partirClave(k).denominacion)]);
    return todas;
  };
  return { errores, estado, verP, verB, bloqueos, emitidas, conjuntas, liberaciones, vivoDe, series };
}

/** EE-1, EE-9 (divisible y emisores): el registro de la serie y su contrato. */
function contrato(ev, ctx, a) {
  return a.errores;
}

/** EE-8: el P que respalda E vivo no se libera, el de una serie o el de una familia (todas sus franjas). */
function respaldoVivo(ev, ctx, a) {
  const { liberaciones, series, vivoDe, estado } = a;
  const errores = [];
  for (const { i, salida } of liberaciones) {
    if (typeof salida !== 'string' || !salida.startsWith('E:')) continue;
    const familia = franjaDe(partirClave(salida).denominacion) === TODAS_LAS_FRANJAS;
    const vivo = familia
      ? series().filter(([k]) => familiaDe(k) === salida).reduce((suma, [, s]) => suma + vivoDe(s), 0)
      : vivoDe(estado(salida));
    if (vivo > MARGEN) errores.push({ i, capa: 4, texto: 'el P bloqueado con la salida «' + salida + '» respalda ' + vivo + ' de E vivo: no se libera mientras viva' });
  }
  return errores;
}

/** EE-10: la emisión conjunta; cada coemisor la firma con su propio bloqueo de P para la serie (o para su familia). */
function conjunta(ev, ctx, a) {
  const { conjuntas, bloqueos } = a;
  const errores = [];
  for (const { i, clave, emisores } of conjuntas) {
    const salidas = [clave, familiaDe(clave)];
    for (const e of emisores) {
      if (e === ev.autor) continue;
      let suyo = salidas.reduce((suma, x) => suma + ctx.bloqueadoP(e, x), 0);
      for (const [llave, d] of bloqueos) {
        const [id, kp, salida] = JSON.parse(llave);
        if (id === e && kp.startsWith('P:') && salidas.includes(salida)) suyo += d;
      }
      if (!(suyo > 0)) errores.push({ i, capa: 5, texto: 'emisión conjunta de ' + clave + ': ' + e + ' no tiene P bloqueado para la serie (su firma es ese bloqueo, con la salida = la clave de la serie o de su familia)' });
    }
  }
  return errores;
}

/** EE-5, EE-6, EE-7, EE-11, RL-4: el tope compartido, por franja, y la cuota, por serie, para cada serie que el evento emite. */
function topeYCuota(ev, ctx, a) {
  const { emitidas, estado, series, vivoDe, verP, verB } = a;
  const errores = [];
  for (const [k, i] of emitidas) {
    const s = estado(k);
    const topes = ctx.topes(s.registro);
    if (!topes.length) continue; // sin capacidad declarada: deuda del emisor
    const vivoSerie = vivoDe(s);
    const franja = franjaDe(partirClave(k).denominacion);
    for (const { id: A, capacidad } of topes) {
      let vivo = 0;
      for (const [, otra, f] of series()) if (f === franja && ctx.dentro(otra.registro, A)) vivo += vivoDe(otra);
      if (vivo > capacidad + MARGEN) {
        errores.push({ i, capa: 4, texto: 'tope de E del registro ' + corto(A) + ' en la franja «' + franja + '»: su E vivo (con sus descendientes, todas las denominaciones y todos los emisores de esa franja) llegaría a ' + vivo + ' y su capacidad es ' + capacidad });
      }
      const kp = verP('P:' + A) > 0 ? 'P:' + A : 'P:' + AMBITO_GENESIS;
      const emitidoP = verP(kp);
      const emisores = s.emisores ?? [s.emisor];
      const familia = familiaDe(k);
      const bloqueado = emisores.reduce((suma, e) => suma + verB(e, kp, k) + verB(e, kp, familia), 0);
      const exacta = emitidoP > 0 ? (bloqueado * capacidad) / emitidoP : 0;
      const cuota = s.divisible ? exacta : Math.floor(exacta + MARGEN);
      if (vivoSerie > cuota + MARGEN) {
        errores.push({ i, capa: 4, texto: 'cuota de ' + k + ' en el registro ' + corto(A) + ': ' + emisores.join(' + ') + ' bloquea' + (emisores.length > 1 ? 'n ' : ' ') + bloqueado + ' de ' + kp + ' con la salida de la serie, de ' + emitidoP +
          ' emitido; da ' + cuota + ' de ' + capacidad + (s.divisible ? '' : ' (hacia abajo)') + ' y el E vivo de la serie llegaría a ' + vivoSerie });
      }
    }
  }
  return errores;
}

/** Las secciones de reglasDelTope, en su orden, con las filas del inventario que cubren. Cada una es (ev, ctx, análisis) → [{ i, capa, texto }]. */
export const SECCIONES_DEL_TOPE = Object.freeze([
  Object.freeze({ nombre: 'EE-1', filas: Object.freeze(['EE-1', 'EE-9']), evaluar: contrato }),
  Object.freeze({ nombre: 'EE-8', filas: Object.freeze(['EE-8']), evaluar: respaldoVivo }),
  Object.freeze({ nombre: 'EE-10', filas: Object.freeze(['EE-10']), evaluar: conjunta }),
  Object.freeze({ nombre: 'EE-5', filas: Object.freeze(['EE-3', 'EE-4', 'EE-5', 'EE-6', 'EE-7', 'EE-11', 'RL-4']), evaluar: topeYCuota }),
]);

// ---------- como condiciones de la transacción ----------

const aplica = (ev) => Boolean(ev) && typeof ev === 'object' && ev.contexto?.genesis !== true;

/** VA-3: en el prefijo de la versión 2, la E no lleva registro, divisible ni emisores. */
export const TOPE_V2 = Object.freeze({
  nombre: 'VA-3',
  filas: Object.freeze(['VA-3']),
  familia: 'E',
  evaluar: (tx, libro, ctx) => reglasDelTopeV2(ctx.evento, ctx.tope),
});

const deSeccion = (s) => Object.freeze({
  nombre: s.nombre,
  filas: s.filas,
  familia: 'E',
  evaluar: (tx, libro, ctx) => {
    const ev = ctx.evento;
    if (!aplica(ev) || ctx.tope.reglas === 2) return null;
    return s.evaluar(ev, ctx.tope, analisisDelTope(ev, ctx.tope));
  },
});

/** Las condiciones de la E atada al recurso, en el orden de reglasDelTope (VA-3, EE-1, EE-8, EE-10, EE-5). */
export const CONDICIONES_DEL_TOPE = Object.freeze([TOPE_V2, ...SECCIONES_DEL_TOPE.map(deSeccion)]);
