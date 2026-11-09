// Común a los mundos de la X (fábrica 4, ciudad 1, jardín 2, parque 3 y
// lente 0): memoria de quien mira, nombres del catálogo de efectos, ritmo de
// las animaciones y utilidades de texto. Sin DOM: todo son funciones puras.
//
// Las reglas son las de los hilos (PR #50): cada animación es el efecto de un
// evento real del eje (mapa §10.2 [D]) y solo se anima lo que es nuevo para
// quien mira; cada elemento animado lleva data-evento (el id del evento que lo
// produce), data-efecto (su nombre en el catálogo de la PR #45) y, si el
// catálogo no lo nombra, data-decision con «[X] decidir VG».

import { ARIDAD, esReferencia } from '../../src/btml.js';
import { CATALOGO, SIN_NOMBRE, verEn } from '../../src/efectos.js';

/** Orden de la X (mapa §12 [D]): la fábrica (confluencia de 7 y 9), la ciudad, el jardín, el parque y la lente. */
export const ORDEN_X = Object.freeze([4, 1, 2, 3, 0]);

/** Segundos entre un evento nuevo y el siguiente: el mismo paso que los hilos, para que la X y la cruz lleguen a la vez. */
export const PASO = 0.55;

/**
 * Memoria de quien mira: qué eventos del eje ya ha visto. Solo lo nuevo se
 * anima; la primera vez que se mira, o con otro eje, nada. `reproducir`
 * vuelve a contar como nuevo todo el eje, para ver llegar cada registro en su
 * orden real. La misma regla que memoria() de los hilos, con su propio estado.
 */
export function memoria() {
  let ejeVisto = null;
  let conocidos = null;
  return {
    nuevos(eje, { reproducir = false } = {}) {
      const ids = eje.orden;
      let n;
      if (reproducir) n = new Set(ids);
      else if (ejeVisto !== eje || !conocidos) n = new Set();
      else n = new Set(ids.filter((id) => !conocidos.has(id)));
      ejeVisto = eje;
      conocidos = new Set(ids);
      return n;
    },
  };
}

// ---------- texto ----------

export function escapar(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const n1 = (x) => Math.round(x * 10) / 10;
export const corto = (id) => String(id ?? '').slice(0, 8);
export const recorte = (s, n) => {
  const t = String(s ?? '');
  return t.length > n ? t.slice(0, Math.max(1, n - 1)) + '…' : t;
};

/** Texto corto de un contenido BTML: el terminal, la posición 0 de un array o la flecha de una referencia. */
export function textoCorto(c) {
  if (c === undefined || c === null) return '';
  if (Array.isArray(c)) return c.length ? textoCorto(c[0]) : '[ ]';
  if (esReferencia(c)) return '→ ' + corto(c.ref);
  const s = String(c);
  return s.startsWith('==') ? s.slice(1) : s;
}

/** Parte un texto en líneas de hasta `ancho` caracteres, como mucho `lineas`; la última lleva «…» si no cabe. */
export function partir(texto, ancho, lineas) {
  const palabras = String(texto ?? '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const out = [];
  let actual = '';
  for (const p of palabras) {
    const pieza = p.length > ancho ? p.slice(0, ancho - 1) + '…' : p;
    if (!actual) actual = pieza;
    else if ((actual + ' ' + pieza).length <= ancho) actual += ' ' + pieza;
    else { out.push(actual); actual = pieza; }
  }
  if (actual) out.push(actual);
  if (out.length > lineas) {
    const resto = out.slice(0, lineas);
    resto[lineas - 1] = recorte(resto[lineas - 1] + ' …', ancho);
    if (!resto[lineas - 1].endsWith('…')) resto[lineas - 1] = recorte(resto[lineas - 1], ancho - 1) + '…';
    return resto;
  }
  return out;
}

// ---------- eje ----------

/** Nodo del foco bajo un camino (sin seguir referencias). */
export function baseDe(payload, camino = []) {
  let base = payload;
  for (const i of camino) base = Array.isArray(base) ? base[i] : undefined;
  return base;
}

/** Lo escrito sobre el foco y sobre lo escrito sobre él, en orden de entrada, hasta `maximo` registros (sin el foco). */
export function descendientes(eje, foco, maximo = 200) {
  const vistos = new Set([foco]);
  const cola = [foco];
  const lista = [];
  while (cola.length && lista.length < maximo) {
    for (const h of eje.sobre(cola.shift())) {
      if (vistos.has(h.id)) continue;
      vistos.add(h.id);
      lista.push(h);
      cola.push(h.id);
      if (lista.length >= maximo) break;
    }
  }
  const orden = ordenDelEje(eje);
  return lista.sort((a, b) => orden.get(a.id) - orden.get(b.id));
}

/** Posición de cada evento en el eje (orden de entrada). */
export function ordenDelEje(eje) {
  const m = new Map();
  eje.orden.forEach((id, i) => m.set(id, i));
  return m;
}

// ---------- nombres del catálogo ----------

function generico(efecto) {
  const t = CATALOGO.tipos[efecto.tipo];
  if (!t) return efecto.tipo;
  if (efecto.tipo === 'token') return t.generico[efecto.movimiento] + ' ' + efecto.token;
  if (efecto.tipo === 'fase') return t.generico[efecto.fase];
  if (efecto.tipo === 'modificar') {
    const n = CATALOGO.clases[efecto.clase]?.nombre;
    return 'modificar (' + (n ?? 'clase ' + efecto.clase) + ')';
  }
  return t.generico;
}

/**
 * Nombre de un efecto visto desde un mundo, del catálogo (verEn); si ese mundo
 * no lo nombra, el genérico de la operación con «[X] decidir VG».
 * efecto: { tipo, movimiento?, token?, fase?, clase? }.
 */
export function nombreEn(efecto, mundo) {
  const v = verEn({ clase: 0, ...efecto }, mundo);
  if (v) return { nombre: v.nombre, ...(v.decision ? { decision: v.decision } : {}) };
  return { nombre: generico({ clase: 0, ...efecto }), decision: SIN_NOMBRE };
}

/** Lo que el catálogo dice que un mundo aún no tiene operación que lo produzca (sinOperacion). */
export function sinOperacion(mundo, nombre) {
  return (CATALOGO.mundos[mundo]?.sinOperacion ?? []).find((s) => s.nombre === nombre) ?? null;
}

/** Nombre corto de un mundo (lente, ciudad, jardín, parque, fábrica…). */
export function nombreMundo(pv) {
  return CATALOGO.mundos[pv]?.nombre ?? String(pv);
}

// ---------- ritmo y atributos ----------

/** Orden de entrada de todo el eje como objeto plano { id: índice }: lo guardan los datos de cada mundo para el ritmo. */
export function ordenPlano(eje) {
  const o = {};
  eje.orden.forEach((id, i) => { o[id] = i; });
  return o;
}

/**
 * Ritmo de los nuevos: cada evento nuevo empieza PASO segundos después del
 * anterior, en su orden de entrada en el eje (`orden`: { id: índice }, el de
 * ordenPlano). → { es(id), segundos(id, mas), estilo(id, mas) }.
 */
export function ritmo(ordenObj, nuevos = new Set()) {
  const orden = new Map(Object.entries(ordenObj ?? {}));
  const enOrden = [...nuevos].filter((id) => orden.has(id)).sort((a, b) => orden.get(a) - orden.get(b));
  const indice = new Map(enOrden.map((id, i) => [id, i]));
  const segundos = (id, mas = 0) => Math.round(((indice.get(id) ?? 0) * PASO + mas) * 100) / 100;
  return {
    es: (id) => nuevos.has(id),
    segundos,
    estilo: (id, mas = 0) => `--retardo:${segundos(id, mas)}s`,
  };
}

/**
 * Atributos de un elemento que corresponde a una transición real: el evento,
 * el efecto con su nombre y su mundo y, si hace falta, la decisión abierta.
 */
export function atributos(evento, efecto, mundo, extra = '') {
  return `data-evento="${escapar(evento)}" data-efecto="${escapar(efecto.nombre)}" data-mundo="${mundo}"`
    + (efecto.decision ? ` data-decision="${escapar(efecto.decision)}"` : '') + extra;
}

/** Profundidades de un payload que caben en la matriz relativa a un camino: hacen falta tres dígitos tras él. */
export function cabeLaMatriz(camino) {
  return camino.length + 2 < ARIDAD;
}
