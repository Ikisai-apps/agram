// El punto de vista 3 por tema (encargo pv3, VG 11/12-11, issues #31-#37): con quién, en seis cajas numeradas 0-5
// como los PV. La regla corta: 3.d = «con quién» sobre d. No hay «grupo» como dato: la caja de cada persona la deciden
// de qué habla cada mensaje (su ancla) y lo que mueve; el dueño puede arrastrarla a otra («move to group») y vetarla
// (el 5, que gana sobre cualquier R). Lo que queda por caja son mínimos opcionales, datos del propio nodo X.3.d (su 1 la
// cantidad mínima, su 8 el rango mínimo), vacíos por defecto: lo que no alcanza cae al 3.0.
//
// Un mensaje (o un movimiento) es de la conversación del dueño O con una persona P si cuelga, por su hilo, de la
// posición 3 (o 3.d) de algo y lo escribe O o lo de O; su tema, en este orden:
//   1. el segundo token entre los dos (además de la R, que es el precio universal): E → 1, P → 2, T → 4;
//   2. la subposición del 3 donde se ancla (3.1 … 3.4) → ese dígito;
//   3. el registro del que habla (el «about» del mensaje o donde se ancla): uno anclado en un 1, 2 o 4 → ese dígito;
//      uno con una serie de E atada → 1 (un recurso);
//   4. solo R: la mía que doy (admitir, dar R) → 3 (cercanos); la suya que me trae (escribirme) → 0 (la bandeja).
// La caja de la persona: 5 si el dueño la vetó; si no, el último grupo al que el dueño la arrastró; si no, el tema del
// último mensaje con tema (≠ 0); si no, 0. Quitar («remove someone») saca lo admitido antes en ese registro y lo de
// debajo. Todo es lectura del libro: no se escribe nada aquí.

import { direccion, indicesDe, esReferencia, ARIDAD } from './btml.js';
import { estadoDePaquete } from './lente.js';
import { HITOS } from './bases.js';

/** Las seis cajas del 3 (0-5, como los PV) y lo que significa cada una. */
export const CAJAS_DEL_TRES = Object.freeze([0, 1, 2, 3, 4, 5]);
/** La caja del veto: gana sobre cualquier R. */
export const VETADOS = 5;
/** La bandeja: sin tema (el ruido, los desconocidos que escriben con su R). */
export const BANDEJA = 0;
/** Dónde se lee el mínimo de cantidad y el de rango de una caja: el 1 y el 8 del nodo X.3.d. */
export const MINIMO = Object.freeze({ cantidad: 1, rango: 8 });
/** El nombre de la acción que quita a alguien (la corrección del dueño, inversa de «admit someone»). */
export const QUITAR = 'remove someone';
/** El nombre de la acción que admite (lo que quitar deshace). */
export const ADMITIR = 'admit someone';
/** Los tres estados del botón de cada caja: doy (tienen R mía), recibo (tengo R suya) y todos. */
export const FILTROS = Object.freeze(['todos', 'doy', 'recibo']);

const esId = (x) => typeof x === 'string' && /^[0-9a-f]{64}$/.test(x);
const hojas = (x) => (x === undefined || x === null ? [] : Array.isArray(x) ? x : [x]);
const primerDigito = (en) => (typeof en === 'string' && en.length ? Number(en[0]) : null);

/** Los textos de un nodo del payload, a cualquier profundidad (las referencias no se siguen). */
function textosDe(nodo, salida = [], k = 0) {
  if (typeof nodo === 'string') salida.push(nodo);
  else if (Array.isArray(nodo) && k < ARIDAD) for (const h of nodo) textosDe(h, salida, k + 1);
  return salida;
}

/** La primera hoja numérica de un payload, o null. */
function primerNumero(nodo, k = 0) {
  if (typeof nodo === 'number') return nodo;
  if (Array.isArray(nodo) && k < ARIDAD) for (const h of nodo) { const n = primerNumero(h, k + 1); if (n !== null) return n; }
  return null;
}

/** Las altas del libro, id → identidad (memo por eje y por cuántos registros tiene). */
const ALTAS = new WeakMap();
function altasDe(eje) {
  const n = eje.orden?.length ?? 0;
  const memo = ALTAS.get(eje);
  if (memo && memo.n === n) return memo.mapa;
  const mapa = new Map();
  for (const i of eje.identidades?.() ?? []) { const a = eje.alta?.(i)?.id; if (a) mapa.set(a, i); }
  ALTAS.set(eje, { n, mapa });
  return mapa;
}

/** La identidad cuya alta es el registro `id`, o null. */
const identidadDeAlta = (eje, id) => altasDe(eje).get(id) ?? null;

/** Una persona dada por su identidad o por su alta (la carta entra en ella por su alta): su identidad, o null. */
export function personaDe(eje, x) {
  if (typeof x !== 'string') return null;
  if (eje?.obtener?.(x)) return identidadDeAlta(eje, x);
  return eje?.alta?.(x) ? x : null;
}

/**
 * De quién es el 3 que se mira: si X es el alta de una identidad, esa identidad (una cosa mira su propio 3, aunque su
 * alta la escribiera su dueño); si no, el autor de X. → { dueno, alta, esAlta } o null si X no está en el libro.
 */
export function duenoDelTres(eje, X) {
  const ev = typeof X === 'string' ? eje?.obtener(X) : null;
  if (!ev) return null;
  const deAlta = identidadDeAlta(eje, ev.id);
  const dueno = deAlta ?? ev.autor;
  return { dueno, alta: eje.alta?.(dueno)?.id ?? null, esAlta: Boolean(deAlta), X: ev.id };
}

/** El paso por el 3 más cercano del hilo de W: { S (el registro en cuyo 3 cuelga), en, desde (el registro anclado ahí) } o null. */
function pasoPorElTres(eje, W) {
  let e = W;
  while (e && typeof e.sobre === 'string') {
    if (primerDigito(e.en) === 3) return { S: e.sobre, en: e.en, desde: e.id };
    e = eje.obtener(e.sobre);
  }
  return null;
}

/** ¿Cuelga W (o es) del registro X? */
const cuelgaDe = (eje, W, X) => eje.hilo(W.id).some((e) => e.id === X);

/** ¿Es el registro un alta (de alguien)? */
const esAltaDe = (eje, id) => identidadDeAlta(eje, id) !== null;

/** El tema de un registro del que se habla: 1, 2 o 4 por donde está anclado; 1 si tiene una serie de E atada; si no, null. */
function temaDeRegistro(eje, id, seriesE) {
  const r = eje.obtener(id);
  if (!r || esAltaDe(eje, id)) return null;
  const d = primerDigito(r.en);
  if (d === 1 || d === 2 || d === 4) return d;
  if (seriesE.has(id)) return 1;
  return null;
}

/** El registro del que habla W: el primero del libro nombrado en su 1 o su 2 («about»), que no sea un alta; null si ninguno. */
function deQueHabla(eje, W) {
  if (!Array.isArray(W.payload)) return null;
  for (const k of [2, 1]) {
    for (const x of hojas(W.payload[k]).flat(2)) {
      const id = esReferencia(x) ? x.ref : esId(x) ? x : null;
      if (id && eje.obtener(id) && !esAltaDe(eje, id)) return id;
    }
  }
  return null;
}

/** El segundo token entre O y P en los movimientos de W (además de la R): E → 1, P → 2, T → 4 (lo primero que aparezca en ese orden); null si no hay. */
function segundoToken(W, O, P) {
  const entre = (W.movimientos ?? []).filter((m) => m && m.de !== null && m.a !== null && m.de !== m.a && [O, P].includes(m.de) && [O, P].includes(m.a));
  for (const [token, caja] of [['E', 1], ['P', 2], ['T', 4]]) if (entre.some((m) => m.token === token)) return caja;
  return null;
}

/** Las otras partes de W para el dueño O: quien lo escribe, si no es O; si es O, a quién mueve tokens o, si no, a quién nombra en su 3. */
function contrapartes(eje, W, O, S) {
  if (W.autor !== O) return [W.autor];
  const movidas = new Set();
  // con quién mueve tokens (y de quién es la R que mueve: perdonar quema la R de otro)
  for (const m of W.movimientos ?? []) for (const x of [m?.de, m?.a, m?.token === 'R' ? m.emisor : null]) if (typeof x === 'string' && x !== O && eje.alta?.(x)) movidas.add(x);
  if (movidas.size) return [...movidas];
  const nombradas = textosDe(W.payload).filter((x) => x !== O && eje.alta?.(x));
  if (nombradas.length) return [...new Set(nombradas)];
  const deS = eje.obtener(S)?.autor;
  return deS && deS !== O ? [deS] : [];
}

/** El tema de W en la conversación de O con P (arriba, la regla). */
function temaDe(eje, W, O, P, paso, seriesE) {
  const t = segundoToken(W, O, P);
  if (t !== null) return t;
  const sub = indicesDe(paso.en)[1];
  if (Number.isInteger(sub) && sub >= 1 && sub <= 4) return sub;
  const habla = deQueHabla(eje, W) ?? (paso.S && !esAltaDe(eje, paso.S) ? paso.S : null);
  const deTema = habla ? temaDeRegistro(eje, habla, seriesE) : null;
  if (deTema !== null) return deTema;
  const mia = (W.movimientos ?? []).some((m) => m?.token === 'R' && m.emisor === O && m.de === O && m.a === P);
  return mia ? 3 : BANDEJA;
}

/** El estado de un mensaje (su paquete): el de la lente si es una petición o una R perdonada; si trae la R de su autor, atendido si le respondió el dueño, perdonado si la quemó; si no, pendiente. */
function estadoDeMensaje(eje, W, O) {
  const viejo = estadoDePaquete(eje, W.id);
  if (viejo) return viejo;
  const trae = (W.movimientos ?? []).some((m) => m?.token === 'R' && m.de === W.autor && m.a === O && m.de !== O);
  if (!trae) return null;
  const encima = eje.sobre(W.id).filter((h) => h.autor === O);
  if (encima.some((h) => (h.movimientos ?? []).some((m) => m?.token === 'R' && m.emisor === W.autor && m.de === O && m.a === null))) return 'perdonado';
  return encima.length ? 'atendido' : 'pendiente';
}

/** Lo que el dueño ancla en el nodo X.3.d.k (el último suyo, exactamente ahí): su payload, o undefined. */
function delNodo(eje, X, O, camino) {
  const lista = eje.sobreDe?.(X, direccion(camino), new Set([O])) ?? eje.sobre(X, direccion(camino)).filter((e) => e.autor === O);
  return lista.length ? lista[lista.length - 1].payload : undefined;
}

/** Los mínimos de la caja d del 3 de X (datos del nodo X.3.d: su 1 y su 8), vacíos por defecto: { cantidad, rango, modo }. */
export function minimosDeCaja(eje, X, O, d) {
  const cantidad = primerNumero(delNodo(eje, X, O, [3, d, MINIMO.cantidad]));
  const r = delNodo(eje, X, O, [3, d, MINIMO.rango]);
  const textos = r === undefined ? [] : textosDe(r);
  const rango = textos.find((x) => HITOS.some((h) => h.nivel === x)) ?? null;
  const modo = textos.find((x) => ['only', 'up', 'down'].includes(x)) ?? (rango ? 'up' : null);
  return { cantidad: cantidad ?? null, rango, modo };
}

/** ¿Pasa un rango el mínimo (nivel.grado, por el orden de los HITOS) con su modo? */
function pasaRango(rango, minimo, modo) {
  const i = HITOS.findIndex((h) => h.nivel === rango);
  const j = HITOS.findIndex((h) => h.nivel === minimo);
  if (i < 0 || j < 0) return true;
  return modo === 'only' ? i === j : modo === 'down' ? i <= j : i >= j;
}

/**
 * Las conversaciones del dueño de X: { dueno, alta, esAlta, items: [{ id, persona, caja, t, autor }], grupos:
 * [{ persona, caja, t, id }], quitados: [{ persona, S, t }] }. Si X no es el alta del dueño, solo lo que cuelga de X (el
 * elemento en foco filtra).
 */
export function conversaciones(eje, X) {
  const d = duenoDelTres(eje, X);
  if (!d) return null;
  const O = d.dueno;
  const seriesE = new Set((eje.series?.() ?? []).filter((s) => s.token === 'E' && s.registro).map((s) => s.registro));
  const items = [];
  const grupos = [];
  const quitados = [];
  for (const id of eje.orden ?? []) {
    const W = eje.obtener(id);
    if (!W || id === d.alta) continue;
    // Arrastrar y vetar: lo que el dueño ancla en el 3.k.3 de su alta (los quiénes del grupo k), con la identidad en su 0.
    if (W.autor === O && d.alta && W.sobre === d.alta) {
      const [a, k, b] = indicesDe(W.en);
      if (a === 3 && Number.isInteger(k) && k <= VETADOS && b === 3) {
        const persona = hojas(Array.isArray(W.payload) ? W.payload[0] : W.payload).flat(2).find((x) => typeof x === 'string' && x !== O && eje.alta?.(x));
        if (persona) grupos.push({ persona, caja: k, t: W.t, id });
        continue;
      }
      if (a === 3 && Number.isInteger(k) && Number.isInteger(b)) continue; // la configuración de un nodo X.3.k.b
    }
    const paso = pasoPorElTres(eje, W);
    if (!paso) continue;
    const S = eje.obtener(paso.S);
    if (!S) continue;
    if (W.autor !== O && S.autor !== O && paso.S !== d.alta) continue;
    // El elemento en foco filtra: lo que cuelga de él, o lo que habla de él (un mensaje anclado en el alta sobre X).
    if (!d.esAlta && !cuelgaDe(eje, W, d.X)) {
      const habla = deQueHabla(eje, W);
      if (!habla || !cuelgaDe(eje, eje.obtener(habla), d.X)) continue;
    }
    // La configuración del nodo X.3.d (sus mínimos, su guía…): no es conversación.
    if (W.autor === O && W.sobre === d.X && indicesDe(W.en).length >= 3) continue;
    if (W.autor === O && Array.isArray(W.payload) && hojas(W.payload[4]).flat(2).includes(QUITAR)) {
      for (const persona of textosDe(W.payload[3]).filter((x) => x !== O && eje.alta?.(x))) quitados.push({ persona, S: W.sobre, t: W.t });
      continue;
    }
    for (const P of contrapartes(eje, W, O, paso.S)) items.push({ id, persona: P, caja: temaDe(eje, W, O, P, paso, seriesE), t: W.t, autor: W.autor });
  }
  // Quitar saca lo que el dueño admitió antes en ese registro o en lo que cuelga de él (sus admisiones: lo que la nombra
  // en su 3 o es «admit someone»; no lo demás que se dijeron).
  const admite = (W, P) => Array.isArray(W.payload) && (hojas(W.payload[4]).flat(2).includes(ADMITIR) || textosDe(W.payload[3]).includes(P));
  const vivos = items.filter((it) => !quitados.some((q) => {
    const W = eje.obtener(it.id);
    return q.persona === it.persona && it.autor === O && it.t <= q.t && admite(W, it.persona) && cuelgaDe(eje, W, q.S);
  }));
  return { ...d, items: vivos, grupos, quitados };
}

/**
 * Las seis cajas del 3 de X para su dueño (contrato.gruposDelTres): [{ caja, nombre, personas, total, filtro, minimo,
 * fuera, rangoPendiente }], cada persona { identidad, alta, doy, recibo, caja, porque, ultimo, mensajes }. `doy` es la
 * R mía que tiene; `recibo`, la suya que tengo yo (el canal de R de la pareja). Orden: primero quienes tienen R mía, luego
 * quienes usan la suya. `filtros` ({ [caja]: 'doy' | 'recibo' | 'todos' }) es el botón de cada caja; `rangoDe(persona)`,
 * la lectura del rango de una persona sobre el foco (del 8, #39): sin ella el filtro de rango no deja a nadie fuera.
 */
export function cajasDelTres(eje, X, { nombres = [], filtros = {}, rangoDe = null } = {}) {
  const c = conversaciones(eje, X);
  if (!c) return [];
  const O = c.dueno;
  const porPersona = new Map();
  const de = (P) => porPersona.get(P) ?? porPersona.set(P, { identidad: P, items: [], grupo: null, veto: false }).get(P);
  for (const it of c.items) de(it.persona).items.push(it);
  for (const g of c.grupos) {
    const p = de(g.persona);
    if (g.caja === VETADOS) p.veto = true;
    else if (!p.grupo || p.grupo.t <= g.t) p.grupo = g;
  }
  const minimos = new Map(CAJAS_DEL_TRES.map((k) => [k, k === BANDEJA || k === VETADOS ? { cantidad: null, rango: null, modo: null } : minimosDeCaja(eje, X, O, k)]));
  const fuera = new Map(CAJAS_DEL_TRES.map((k) => [k, 0]));
  const personas = [];
  for (const p of porPersona.values()) {
    const conTema = p.items.filter((x) => x.caja !== BANDEJA);
    const ultimoConTema = conTema.reduce((a, b) => (!a || a.t <= b.t ? b : a), null);
    let caja = p.veto ? VETADOS : p.grupo ? p.grupo.caja : ultimoConTema ? ultimoConTema.caja : BANDEJA;
    const porque = p.veto ? 'veto' : p.grupo ? 'arrastre' : ultimoConTema ? 'tema' : 'bandeja';
    const doy = eje.saldo(p.identidad, 'R:' + O) ?? 0;
    const recibo = eje.saldo(O, 'R:' + p.identidad) ?? 0;
    // Los mínimos de la caja (no en la bandeja ni en el veto): lo que no alcanza cae al 3.0.
    const m = minimos.get(caja);
    let cae = null;
    if (m && typeof m.cantidad === 'number' && doy + recibo < m.cantidad) cae = 'cantidad';
    const rango = m?.rango && typeof rangoDe === 'function' ? rangoDe(p.identidad) : null;
    if (!cae && m?.rango && rango && !pasaRango(rango, m.rango, m.modo)) cae = 'rango';
    if (cae) { fuera.set(caja, fuera.get(caja) + 1); caja = BANDEJA; }
    const ultimo = p.items.reduce((a, b) => (a && a > b.t ? a : b.t), p.grupo?.t ?? null);
    personas.push({ identidad: p.identidad, alta: eje.alta?.(p.identidad)?.id ?? null, doy, recibo, caja, porque, ...(cae ? { cae } : {}), ultimo, mensajes: p.items.length });
  }
  const orden = (a, b) => (b.doy > 0) - (a.doy > 0) || b.doy - a.doy || (b.recibo > 0) - (a.recibo > 0) || b.recibo - a.recibo || String(b.ultimo ?? '').localeCompare(String(a.ultimo ?? '')) || a.identidad.localeCompare(b.identidad);
  return CAJAS_DEL_TRES.map((k) => {
    const todas = personas.filter((p) => p.caja === k).sort(orden);
    const filtro = FILTROS.includes(filtros?.[k]) ? filtros[k] : 'todos';
    const lista = filtro === 'doy' ? todas.filter((p) => p.doy > 0) : filtro === 'recibo' ? todas.filter((p) => p.recibo > 0) : todas;
    const m = minimos.get(k);
    return { caja: k, nombre: nombres[k] ?? null, personas: lista, total: todas.length, filtro, minimo: m, fuera: fuera.get(k), rangoPendiente: Boolean(m.rango && typeof rangoDe !== 'function') };
  });
}

/** Las capas de la conversación con una persona en la caja d: 0 el chat y, acumulativo del 4 hacia el 1, las de su caja hasta el 4. */
export function capasDe(caja) {
  if (!Number.isInteger(caja) || caja <= BANDEJA || caja >= VETADOS) return [BANDEJA];
  const capas = [BANDEJA];
  for (let k = caja; k <= 4; k++) capas.push(k);
  return capas;
}

/**
 * La conversación del dueño de X con una persona (contrato.conversacionDelTres): { dueno, persona, caja, capas: [{ capa,
 * items: [{ ref, autor, t, estado? }] }] }. 0 el chat (sus mensajes, en orden); 4 el trabajo (lo que uno escribe en lo
 * del otro y el T que se mueven); 3 los favoritos (lo del otro por lo que se dio R); 2 los criterios (lo anclado en un 2,
 * del uno en lo del otro, y los del otro si el dueño los tomó prestados); 1 los recursos compartidos (los registros con
 * E de uno que tiene el otro). Acumulativo del 4 hacia el 1 y filtrado por el elemento en foco (si X no es el alta).
 * Sin `caja`, la de la persona.
 */
export function conversacionDelTres(eje, X, persona, { caja } = {}) {
  const c = conversaciones(eje, X);
  const P = personaDe(eje, persona);
  if (!c || !P) return null;
  const O = c.dueno;
  const enCaja = Number.isInteger(caja) ? caja : cajasDelTres(eje, X).find((k) => k.personas.some((p) => p.identidad === P))?.caja ?? BANDEJA;
  const enFoco = (id) => c.esAlta || cuelgaDe(eje, eje.obtener(id), c.X);
  const vistos = new Set();
  const item = (id) => {
    const r = eje.obtener(id);
    return { ref: id, autor: r.autor, t: r.t };
  };
  const tomar = (ids) => ids.filter((id) => !vistos.has(id) && enFoco(id) && vistos.add(id)).map(item);
  const todos = (eje.orden ?? []).map((id) => eje.obtener(id)).filter(Boolean);
  const capas = capasDe(enCaja).map((capa) => {
    let ids = [];
    if (capa === BANDEJA) {
      ids = c.items.filter((x) => x.persona === P).sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0)).map((x) => x.id);
      const lista = tomar([...new Set(ids)]).map((x) => ({ ...x, estado: estadoDeMensaje(eje, eje.obtener(x.ref), O) }));
      return { capa, items: lista };
    }
    if (capa === 4) {
      const enLoDelOtro = (W) => !pasoPorElTres(eje, W) && W.sobre && ((W.autor === P && eje.obtener(W.sobre)?.autor === O) || (W.autor === O && eje.obtener(W.sobre)?.autor === P));
      const conT = (W) => (W.movimientos ?? []).some((m) => m?.token === 'T' && m.de !== null && m.a !== null && [O, P].includes(m.de) && [O, P].includes(m.a) && m.de !== m.a);
      ids = todos.filter((W) => enLoDelOtro(W) || conT(W)).map((W) => W.id);
    } else if (capa === 3) {
      const darR = (W, de, a) => W.autor === de && (W.movimientos ?? []).some((m) => m?.token === 'R' && m.emisor === de && m.de === de && m.a === a);
      ids = todos.filter((W) => W.sobre && ((darR(W, O, P) && eje.obtener(W.sobre)?.autor === P) || (darR(W, P, O) && eje.obtener(W.sobre)?.autor === O))).map((W) => W.sobre);
    } else if (capa === 2) {
      const prestado = c.alta ? (eje.sobreDe?.(c.alta, direccion([2, 3]), new Set([O])) ?? []).some((e) => textosDe(e.payload).includes(P)) : false;
      ids = todos.filter((W) => primerDigito(W.en) === 2 && W.sobre && ((W.autor === P && (prestado || eje.obtener(W.sobre)?.autor === O)) || (W.autor === O && eje.obtener(W.sobre)?.autor === P))).map((W) => W.id);
    } else if (capa === 1) {
      for (const s of eje.series?.() ?? []) {
        if (s.token !== 'E' || !s.registro || ![O, P].includes(s.emisor)) continue;
        const otro = s.emisor === O ? P : O;
        if ((eje.saldo(otro, s.clave) ?? 0) > 0 || (eje.libro?.vista?.(otro)?.[s.clave])) ids.push(s.registro);
      }
    }
    return { capa, items: tomar([...new Set(ids)]) };
  });
  return { dueno: O, persona: P, caja: enCaja, capas };
}
