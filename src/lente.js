// La lente de R (R6 del estudio de neutralidad, docs/notas/NEUTRALIDAD_IDENTIDAD.md
// §4; decidido por VG, 7-11 noche; mapa §12 [D] «Resto de la lista del estudio»).
//
// R (reputación) no tiene un valor propio en el eje: lo tiene ante quien la
// lee, y solo con la LENTE que ese lector ha firmado. La lente dice el PESO
// que el lector da a cada emisor de R. Recibir R de alguien nunca mete a ese
// emisor en la lente del receptor, y un emisor que el lector no nombra pesa
// 0: una identidad nueva que se autoemite mucha R no vale nada para nadie que
// no la nombre, y N identidades falsas que se emiten R entre sí no cambian el
// valor que un lector da a nadie.
//
// Este es el ÚNICO sitio del repositorio que junta R de emisores distintos, y
// solo multiplicada por el peso que el lector eligió; nada cuenta emisores
// (prueba estática en test/lente.test.js).
//
// Tres piezas:
//
// 1. La lente. Un acto firmado del lector: un evento suyo anclado en la
//    posición 3 («con quién», POSICION_LENTE) de su registro de alta o de un
//    registro «lente» suyo (uno que escribió él con `contexto.lente: true`).
//    Su payload es una décupla de pares [emisor, peso], con el peso entre 0 y
//    1: [["asociacion-norte", 1], ["asociacion-sur", 0.5]]. Hasta diez pares
//    por evento; con más emisores, más eventos. La última declaración de cada
//    emisor manda (peso 0 lo quita). Un par mal formado se ignora y se dice
//    (`ignorados`); un evento de otro anclado ahí no cuenta.
//
// 2. El valor. valor(eje, lector, titular) = Σ, sobre los emisores X que la
//    lente nombra (X distinto del titular), de peso(X) × la participación del
//    titular en R:X. La participación es saldo ÷ emitido, pero el emitido de
//    cada tenencia es el de cuando LLEGÓ: si X le da 10 a ana con 100
//    emitidos, ana tiene 0,1 de R:X, y aunque X amplíe después a 1000, lo de
//    ana sigue valiendo 0,1 (ampliar R:X no diluye a quien ya la tiene; lo
//    nuevo vale menos). Al devolver parte, la participación baja en
//    proporción (a prorrata de lo que tenía). [X] decidir VG: valorar «sobre
//    lo emitido hasta la llegada de cada tenencia» (lo implementado) o por
//    tramos de emisión. La R propia (R:X en manos de X) no vale nada ante
//    nadie: no es que otro responda por él.
//
// 3. Emitir R exige colateral (reglasDeR, que aplican eje.validar y las capas
//    4 y 5 de validez). Para emitir R:Y (Y = el autor, o un grupo a cuyo
//    nombre emite) el autor ha de tener R:<autor> BLOQUEADA con la salida =
//    'R:Y', al menos COLATERAL_R (una décima parte, [X] decidir VG) de lo
//    emitido de R:Y tras el evento. En la primera emisión basta con bloquear
//    parte de lo que se emite en el mismo evento. «R propia en juego» del
//    escalonado (src/ciclo.js: emitir P o E) es exactamente eso:
//    rPropiaEnJuego. El colateral se libera citando la misma salida, pero
//    nunca por debajo de esa décima parte, y nunca mientras haya
//    DEVOLUCIONES sin atender: un tenedor devuelve R:Y a Y para «pedir
//    atención» (src/tokens.js), y Y la ATIENDE escribiendo un evento con
//    `contexto.atiende` = el id de la devolución (o una lista de ids). Si Y no
//    atiende, el colateral queda bloqueado; no hay castigo automático ([X]
//    VG si quiere más).

import { claveToken, validarMovimiento } from './tokens.js';

/** La posición 3 de la décupla («con quién»): donde el lector ancla su lente. */
export const POSICION_LENTE = '3000000000';

/**
 * [X] decidir VG: el colateral mínimo de una serie R:Y, como fracción de lo
 * emitido: una décima parte. Se compara en enteros (bloqueado × den ≥
 * emitido × num) con un margen de coma flotante.
 */
export const COLATERAL_R = Object.freeze({ num: 1, den: 10 });

/** Tope de pares por declaración: una décupla. */
export const PARES_POR_DECLARACION = 10;

const MARGEN = 1e-9;
const corto = (x) => String(x).slice(0, 8);
const redondear = (n) => Math.round(n * 1e6) / 1e6;

/** Clave de la serie R de un emisor. */
export function claveR(emisor) {
  return 'R:' + emisor;
}

/** Colateral mínimo para lo emitido de una serie R (COLATERAL_R). */
export function colateralMinimo(emitido) {
  return (emitido * COLATERAL_R.num) / COLATERAL_R.den;
}

/** ¿Cubre `bloqueado` el colateral de una serie con `emitido`? */
export function cubre(bloqueado, emitido) {
  return bloqueado * COLATERAL_R.den + MARGEN >= emitido * COLATERAL_R.num;
}

/** ¿Es `salida` la de un colateral, es decir, la clave de una serie R ('R:<emisor>')? */
export function esSalidaDeColateral(salida) {
  return typeof salida === 'string' && salida.startsWith('R:') && salida.length > 2 && !/[|:/]/.test(salida.slice(2));
}

/** Movimiento que bloquea `cantidad` de R:<persona> como colateral de R:<emisor> (por defecto, la suya). */
export function colateral(persona, cantidad, emisor = persona) {
  return { token: 'R', emisor: persona, cantidad, de: persona, a: persona, estado: 'bloqueo', salida: claveR(emisor) };
}

/**
 * «R propia en juego» del escalonado (src/ciclo.js; VG, 7-11 noche: emitir P
 * exige T y R propia en juego, y E también): el autor tiene R:<autor>
 * bloqueada como colateral de su propia serie (salida 'R:<autor>'), al menos
 * COLATERAL_R de lo emitido, contando lo que bloquea, libera o emite en el
 * propio evento. `movimientos` son los del evento, ya bien formados; `ctx`
 * da `bloqueado(id, clave, salida)` y `serie(clave)` del eje de antes.
 */
export function rPropiaEnJuego(autor, movimientos, ctx) {
  const k = claveR(autor);
  let bloqueado = typeof ctx.bloqueado === 'function' ? ctx.bloqueado(autor, k, k) : 0;
  let emitido = ctx.serie(k)?.emitido ?? 0;
  for (const m of movimientos) {
    if (m.token !== 'R' || m.emisor !== autor) continue;
    if (m.de === null) emitido += m.cantidad;
    else if (m.de === autor && m.salida === k) bloqueado += m.estado === 'bloqueo' ? m.cantidad : m.estado === 'liberacion' ? -m.cantidad : 0;
  }
  return bloqueado > 0 && cubre(bloqueado, emitido);
}

// ---------- la declaración de la lente ----------

/**
 * Pares [emisor, peso] de un payload de lente: la raíz es una décupla y cada
 * posición, un par [emisor (texto no vacío), peso (número de 0 a 1)].
 * Devuelve { pares, ignorados } con los pares bien formados y, de los demás,
 * por qué no cuentan.
 */
export function paresDeLente(payload) {
  if (!Array.isArray(payload)) return { pares: [], ignorados: ['el payload de una lente es una décupla de pares [emisor, peso]'] };
  const pares = [];
  const ignorados = [];
  payload.forEach((x, i) => {
    const bien = Array.isArray(x) && x.length === 2 && typeof x[0] === 'string' && x[0].length > 0 && !/[|:/]/.test(x[0])
      && typeof x[1] === 'number' && Number.isFinite(x[1]) && x[1] >= 0 && x[1] <= 1;
    if (bien) pares.push([x[0], x[1]]);
    else ignorados.push('posición ' + i + ': no es un par [emisor, peso de 0 a 1]');
  });
  return { pares, ignorados };
}

/** Payload de una declaración de lente desde { emisor: peso }: [[emisor, peso], …], en el orden dado. */
export function payloadDeLente(pesos) {
  const pares = Object.entries(pesos);
  if (!pares.length || pares.length > PARES_POR_DECLARACION) throw new Error('una declaración de lente lleva de 1 a ' + PARES_POR_DECLARACION + ' pares [emisor, peso]');
  const { ignorados } = paresDeLente(pares);
  if (ignorados.length) throw new Error('lente mal formada: ' + ignorados.join('; '));
  return pares.map(([e, p]) => [e, p]);
}

/**
 * Escribe la lente de `lector`: un evento suyo en la posición 3 de su
 * registro de alta (o de `ancla`, un registro «lente» suyo), con los pares
 * de `pesos` ({ emisor: peso de 0 a 1 }). Gasta un minuto de su T. Firma con
 * `privada` si se da.
 */
export async function declararLente(eje, { lector, pesos, t, ancla, privada }) {
  const sobre = ancla ?? eje.alta(lector)?.id;
  if (!sobre) throw new Error(lector + ' no tiene registro de alta: no puede anclar su lente');
  return eje.escribir({
    autor: lector,
    sobre,
    en: POSICION_LENTE,
    t,
    payload: payloadDeLente(pesos),
    movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: lector, a: null }],
  }, privada);
}

// ---------- el índice: lentes, tenencias y devoluciones ----------
//
// Se construye leyendo el eje en orden, una vez, y avanza con él (los eventos
// solo se añaden). Lo usan la lente (valor, peso) y las reglas de R del eje
// (devoluciones pendientes).

const INDICES = new WeakMap();

function nuevoIndice() {
  return {
    hasta: 0,
    emitido: new Map(), // clave R → emitido hasta aquí
    tenencias: new Map(), // clave R → Map(titular → { saldo, parte, eventos })
    devoluciones: new Map(), // emisor → Map(id del evento → { id, clave, de, cantidad, atencion })
    devueltasEn: new Map(), // id del evento → Set(emisores a los que devuelve R)
    anclas: new Map(), // lector → Set(ids de sus registros «lente»)
    lentes: new Map(), // lector → [{ id, pares, ignorados }]
  };
}

/** Anota un evento en el índice. `altaDe(id)` da el id del registro de alta de una identidad. */
function anotar(ix, ev, altaDe) {
  const autor = ev.autor;
  // Un registro «lente» del autor: donde también puede anclar su lente.
  if (ev.contexto?.lente === true) {
    if (!ix.anclas.has(autor)) ix.anclas.set(autor, new Set());
    ix.anclas.get(autor).add(ev.id);
  }
  // Una declaración de lente: del lector, en la posición 3 de su alta o de un registro «lente» suyo.
  if (ev.en === POSICION_LENTE && ev.sobre && (ev.sobre === altaDe(autor) || ix.anclas.get(autor)?.has(ev.sobre))) {
    if (!ix.lentes.has(autor)) ix.lentes.set(autor, []);
    ix.lentes.get(autor).push({ id: ev.id, ...paresDeLente(ev.payload) });
  }
  // Atender: el emisor cita la devolución.
  const atiende = ev.contexto?.atiende;
  for (const id of Array.isArray(atiende) ? atiende : atiende === undefined ? [] : [atiende]) {
    const d = ix.devoluciones.get(autor)?.get(id);
    if (d && d.atencion === null) d.atencion = ev.id;
  }
  for (const m of Array.isArray(ev.movimientos) ? ev.movimientos : []) {
    if (!m || m.token !== 'R' || m.estado !== undefined || validarMovimiento(m).length) continue;
    const k = claveToken(m);
    const c = m.cantidad;
    if (m.de === null) {
      ix.emitido.set(k, (ix.emitido.get(k) ?? 0) + c);
    } else if (m.de !== m.emisor) {
      // El tenedor la devuelve a su emisor: «pedir atención». Su participación baja a prorrata.
      const t = tenenciaEn(ix, k, m.de);
      t.parte = t.saldo > 0 ? t.parte * Math.max(0, 1 - c / t.saldo) : 0;
      t.saldo = Math.max(0, t.saldo - c);
      t.eventos.push(ev.id);
      if (m.a === m.emisor) {
        if (!ix.devoluciones.has(m.emisor)) ix.devoluciones.set(m.emisor, new Map());
        const porId = ix.devoluciones.get(m.emisor);
        const d = porId.get(ev.id) ?? { id: ev.id, clave: k, de: m.de, cantidad: 0, atencion: null };
        d.cantidad += c;
        porId.set(ev.id, d);
        if (!ix.devueltasEn.has(ev.id)) ix.devueltasEn.set(ev.id, new Set());
        ix.devueltasEn.get(ev.id).add(m.emisor);
      }
    }
    if (m.a !== null && m.a !== m.emisor) {
      // Llega a un tenedor: su participación crece con lo emitido de AHORA (ampliar después no la diluye).
      const t = tenenciaEn(ix, k, m.a);
      const emitido = ix.emitido.get(k) ?? 0;
      if (emitido > 0) t.parte += c / emitido;
      t.saldo += c;
      t.eventos.push(ev.id);
    }
  }
}

function tenenciaEn(ix, k, titular) {
  if (!ix.tenencias.has(k)) ix.tenencias.set(k, new Map());
  const porTitular = ix.tenencias.get(k);
  if (!porTitular.has(titular)) porTitular.set(titular, { saldo: 0, parte: 0, eventos: [] });
  return porTitular.get(titular);
}

/** El índice del eje, al día. */
function indice(eje) {
  let ix = INDICES.get(eje);
  if (!ix) {
    ix = nuevoIndice();
    INDICES.set(eje, ix);
  }
  const altaDe = (id) => eje.alta(id)?.id;
  while (ix.hasta < eje.orden.length) {
    anotar(ix, eje.obtener(eje.orden[ix.hasta]), altaDe);
    ix.hasta++;
  }
  return ix;
}

/**
 * Las devoluciones de una lista de eventos (en orden): lo que leen las
 * reglas de R desde un punto del eje que no es el final (las capas de
 * validez, con el libro de justo antes de un registro).
 * Devuelve { pendientes(emisor), devolucion(id, emisor) } como `devolucionesDe`.
 */
export function devolucionesEn(eventos) {
  const ix = nuevoIndice();
  for (const ev of eventos) anotar(ix, ev, () => undefined);
  return consultasDeDevoluciones(ix);
}

function consultasDeDevoluciones(ix) {
  return {
    pendientes: (emisor) => [...(ix.devoluciones.get(emisor)?.values() ?? [])].filter((d) => d.atencion === null).map((d) => d.id),
    devolucion: (id, emisor) => ix.devueltasEn.get(id)?.has(emisor) === true,
  };
}

/** Lo mismo que devolucionesEn, para el eje entero (con su índice). */
export function devolucionesDe(eje) {
  return consultasDeDevoluciones(indice(eje));
}

/**
 * Devoluciones de R:<emisor> hechas por sus tenedores, en orden:
 * [{ id, clave, de, cantidad, atencion }], con `atencion` = el id del evento
 * en que el emisor la atendió, o null.
 */
export function devoluciones(eje, emisor) {
  return [...(indice(eje).devoluciones.get(emisor)?.values() ?? [])].map((d) => ({ ...d }));
}

/** Ids de las devoluciones de R:<emisor> sin atender: mientras haya alguna, su colateral no se libera. */
export function pendientes(eje, emisor) {
  return devolucionesDe(eje).pendientes(emisor);
}

/** Colateral de R:<persona> bloqueado para la serie R:<emisor> (por defecto, la suya). */
export function colateralDe(eje, persona, emisor = persona) {
  return eje.bloqueado(persona, claveR(persona), claveR(emisor));
}

// ---------- la lente y el valor ----------

/**
 * Registros donde `lector` puede anclar su lente: su registro de alta y sus
 * registros «lente» (contexto.lente: true), en ese orden.
 */
export function anclasDeLente(eje, lector) {
  const alta = eje.alta(lector)?.id;
  return [...(alta ? [alta] : []), ...(indice(eje).anclas.get(lector) ?? [])];
}

/**
 * La lente de `lector`, o null si no ha declarado ninguna:
 * { lector, pesos: Map(emisor → peso), declaraciones: [ids], ignorados: [textos] }.
 * La última declaración de cada emisor manda.
 */
export function lenteDe(eje, lector) {
  const decl = indice(eje).lentes.get(lector);
  if (!decl?.length) return null;
  const pesos = new Map();
  const ignorados = [];
  for (const d of decl) {
    for (const [e, p] of d.pares) pesos.set(e, p);
    for (const x of d.ignorados) ignorados.push(corto(d.id) + ' ' + x);
  }
  return { lector, pesos, declaraciones: decl.map((d) => d.id), ignorados };
}

/** Peso que `lector` da a `emisor`: el de su lente, 0 si no lo nombra, null si no tiene lente. */
export function peso(eje, lector, emisor) {
  const l = lenteDe(eje, lector);
  return l ? l.pesos.get(emisor) ?? 0 : null;
}

/**
 * La tenencia de `titular` en R:<emisor>: { saldo, parte, eventos }. `parte`
 * es su participación (cada tenencia sobre lo emitido cuando llegó); la R
 * propia no participa (parte 0). `eventos`, los que movieron esa R a o desde
 * el titular.
 */
export function tenencia(eje, titular, emisor) {
  const t = indice(eje).tenencias.get(claveR(emisor))?.get(titular);
  if (!t || titular === emisor) return { saldo: titular === emisor ? eje.saldo(titular, claveR(emisor)) : 0, parte: 0, eventos: [] };
  return { saldo: t.saldo, parte: t.parte, eventos: [...t.eventos] };
}

/**
 * El valor de la R que tiene `titular`, visto con la lente de `lector`, con
 * su detalle: { valor, porEmisor: [{ emisor, peso, saldo, parte, aporte }],
 * eventos }, solo de los emisores que la lente nombra con peso > 0; o null
 * si el lector no tiene lente (sin lente, R no vale nada).
 */
export function detalleValor(eje, lector, titular) {
  const l = lenteDe(eje, lector);
  if (!l) return null;
  let valor = 0;
  const porEmisor = [];
  const eventos = new Set();
  for (const [emisor, p] of l.pesos) {
    if (!(p > 0) || emisor === titular) continue;
    const t = tenencia(eje, titular, emisor);
    const aporte = p * t.parte;
    valor += aporte;
    porEmisor.push({ emisor, peso: p, saldo: t.saldo, parte: t.parte, aporte });
    for (const id of t.eventos) eventos.add(id);
  }
  return { valor: redondear(valor), porEmisor, eventos: [...eventos] };
}

/** valor(eje, lector, titular): Σ peso × participación sobre los emisores de la lente; null sin lente. */
export function valor(eje, lector, titular) {
  return detalleValor(eje, lector, titular)?.valor ?? null;
}

// ---------- las reglas de R en el eje ----------

/**
 * Errores de las reglas de R de un evento que no es el génesis ni del prefijo
 * de la versión 2: [{ i, capa, texto }], como reglasDelCiclo. Capa 4 si falta
 * respaldo (el colateral), 5 si falta permiso (liberar con devoluciones sin
 * atender, atender lo que no es suyo).
 *
 * ctx, todo de antes del evento:
 *   reglas                     2 si el evento se guardó con la versión 2
 *   serie(clave)               { emitido } o null
 *   bloqueado(id, clave, salida)
 *   pendientes(emisor)         ids de las devoluciones de R:<emisor> sin atender
 *   devolucion(id, emisor)     ¿es `id` un evento que devuelve R:<emisor> a su emisor?
 */
export function reglasDeR(ev, ctx) {
  if (!ev || typeof ev !== 'object' || ev.contexto?.genesis === true || ctx.reglas === 2) return [];
  const autor = ev.autor;
  const propia = claveR(autor);
  const errores = [];
  const falla = (i, capa, texto) => errores.push({ i, capa, texto });
  const validos = (Array.isArray(ev.movimientos) ? ev.movimientos : [])
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => m && typeof m === 'object' && m.token === 'R' && !validarMovimiento(m).length);

  const delta = new Map(); // salida → lo que el autor bloquea (+) o libera (−) de R:<autor> en el evento
  const emitidas = new Map(); // clave R → { i, cantidad } emitido en el evento
  const liberaciones = [];
  for (const { m, i } of validos) {
    if (m.de === null) {
      const k = claveToken(m);
      const e = emitidas.get(k) ?? { i, cantidad: 0 };
      e.cantidad += m.cantidad;
      emitidas.set(k, e);
    } else if (m.estado !== undefined && m.de === autor && m.emisor === autor) {
      delta.set(m.salida, (delta.get(m.salida) ?? 0) + (m.estado === 'bloqueo' ? m.cantidad : -m.cantidad));
      if (m.estado === 'liberacion' && esSalidaDeColateral(m.salida)) liberaciones.push({ i, salida: m.salida });
    }
  }
  const colateralTras = (salida) => ctx.bloqueado(autor, propia, salida) + (delta.get(salida) ?? 0);
  const emitidoTras = (k) => (ctx.serie(k)?.emitido ?? 0) + (emitidas.get(k)?.cantidad ?? 0);
  const texto = (n) => String(redondear(n));

  // Emitir R exige colateral: R:<autor> bloqueada con la salida = la serie, al menos la décima parte de lo emitido.
  for (const [k, { i }] of emitidas) {
    const tiene = colateralTras(k);
    const emitido = emitidoTras(k);
    if (!cubre(tiene, emitido)) {
      falla(i, 4, 'emitir ' + k + ' exige colateral: ' + propia + ' bloqueada con la salida «' + k + '», al menos ' + texto(colateralMinimo(emitido))
        + ' (' + COLATERAL_R.num + '/' + COLATERAL_R.den + ' de lo emitido, ' + texto(emitido) + '); hay ' + texto(tiene) + ' (R6)');
    }
  }
  // Liberar el colateral: nunca con devoluciones sin atender, ni por debajo del mínimo.
  for (const { i, salida } of liberaciones) {
    const emisor = salida.slice(2);
    const sin = ctx.pendientes(emisor);
    if (sin.length) {
      falla(i, 5, 'el colateral de ' + salida + ' no se libera mientras haya devoluciones sin atender (' + sin.map(corto).join(', ')
        + '): atender es escribir un evento de ' + emisor + ' con contexto.atiende = el id de la devolución (R6)');
    }
    const emitido = emitidoTras(salida);
    const queda = colateralTras(salida);
    if (emitido > 0 && !cubre(queda, emitido)) {
      falla(i, 4, 'el colateral de ' + salida + ' no baja de ' + texto(colateralMinimo(emitido)) + ' (' + COLATERAL_R.num + '/' + COLATERAL_R.den
        + ' de lo emitido, ' + texto(emitido) + '); quedarían ' + texto(queda) + ' (R6)');
    }
  }
  // Atender: el emisor cita devoluciones de su R.
  const atiende = ev.contexto?.atiende;
  if (atiende !== undefined) {
    const ids = Array.isArray(atiende) ? atiende : [atiende];
    if (!ids.length || ids.some((x) => typeof x !== 'string')) falla(null, 5, 'contexto.atiende es el id de una devolución, o una lista de ids');
    else {
      for (const id of ids) {
        if (!ctx.devolucion(id, autor)) falla(null, 5, 'contexto.atiende cita ' + corto(id) + ', que no es una devolución de ' + propia + ': solo el emisor atiende las devoluciones de su R (R6)');
      }
    }
  }
  return errores;
}
