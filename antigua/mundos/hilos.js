// Mundo de los hilos (PV6 y PV7): el primer render animado.
//
// Sobrio y animado son dos renders de la misma operación (mapa §10.3 [D]) y
// leen la misma lista: el catálogo de efectos (src/efectos.js, docs/EFECTOS.md;
// mapa §12 [D]: «Antes de animar: catálogo de efectos»). Este módulo no
// tiene tabla de nombres propia: cada cosa que se dibuja es un efecto de
// efectosDe(), se nombra como la ve el mundo donde se dibuja (verEn) y su
// texto es el render sobrio de ese mismo efecto. Si una animación no sale de
// un efecto, no se dibuja (docs/EFECTOS.md). El dibujo es el eje temporal que
// el sobrio pinta como listas (tiempo.ejeTemporal), sobre eventos reales del
// eje (mapa §10.2 [D]: nada simulado sobre datos falsos).
//
// Qué se ve:
// - el presente en el centro, con el foco encima: es la costura;
// - a la izquierda (mundo 6), los registros del pasado como nodos
//   encadenados por referencia (`sobre`) hasta el génesis;
// - a la derecha (mundo 7), las proyecciones, las propuestas de la fábrica
//   sin cerrar y lo declarado en la posición 7, como arcos que salen del foco;
// - las bandas de tiempo (segundo … año y «más»), comprimidas hacia lo lejano;
// - debajo (vista completa), las carteras: los tokens de cada evento nuevo
//   que se ve van como puntos de `de` a `a`, con el nombre de su mundo (1–4).
//
// Qué se anima: solo lo nuevo para quien mira (memoria()), y solo si el
// mundo donde se dibuja nombra su efecto (verEn) o es su propio mundo. Lo que
// ese mundo no nombra se dibuja quieto, con el nombre de su mundo
// (data-nombre-de) y la marca del catálogo (SIN_NOMBRE). Con el catálogo de
// la PR #45:
// - un registro nuevo entra por la izquierda (6) y su hilo se traza;
// - una proyección o una propuesta traza su arco al futuro (7);
// - el registro que cierra una propuesta ancla (encargo 3b: no hay paso de
//   ejecutar; cada parte registra su movimiento y la plantilla de cerrado del
//   dueño lo lee): en el 7 se suelta el arco real de la propuesta (el mismo,
//   en el mismo sitio) y en el 6 cae el ancla;
// - los tokens de un evento nuevo que se ve van de `de` a `a`.
// Cada elemento lleva data-evento, data-efecto, data-mundo y data-decision.
// Qué propuesta está cerrada lo dice el motor (motor.cerrado, la plantilla
// del dueño), no una regla copiada aquí.
//
// [X] decidir VG (abierto en este mundo):
// 1. una propuesta sin cerrar no tiene fecha futura (es futuro
//    subjetivo): va a la derecha, a la distancia que le da
//    tiempo.ejeTemporal, que es lo que lleva pendiente;
// 2. una propuesta sin cerrar sale también en el pasado, porque
//    tiempo.ejeTemporal la lista como registro escrito (el sobrio igual):
//    aquí se dibuja quieta en el 6 (el catálogo no nombra consolidar en los
//    hilos del pasado) y solo se anima su arco en el 7 (corpus V4, PV7: no
//    convertir plan en hecho);
// 3. lo que cae dentro del primer segundo se dibuja junto al foco, a
//    `minimo` unidades del presente, no encima;
// 4. lo que no cabe en su carril se agrega en un contador por banda («lo
//    lejano, contadores agregados»), sin desplegar. Lo nuevo que cae en un
//    contador no se anima ni mueve sus tokens: el contador dice cuántos
//    nuevos lleva y la vista completa los lista en sobrio;
// 5. el ∅ de las carteras (emitir y consumir) se dibuja en el presente;
// 6. cada banda más lejana ocupa RAZON = 2/3 de la interior (corpus V3
//    §10.2: «más espacio cerca del presente»; propuesta de composición, no
//    cociente rígido);
// 7. dentro de cada banda la distancia es logarítmica entre sus límites (en
//    la del segundo, lineal);
// 8. la banda «más» acaba en TOPE_MAS años: lo más lejano, en su borde;
// 9. como mucho MAXIMO_PUNTOS movimientos por vista; los demás se cuentan en
//    «+N movimientos»;
// 10. la forma de cada animación (deslizar, trazar, proyectar, soltar, caer,
//    viajar) es del render, no del catálogo;
// 11. los colores por familia de tokens (mundos/hilos.css) siguen los
//    moduladores del catálogo (familias), tentativos;
// 12. cómo se entra en este mundo desde la app (mundos/hilos-ui.js).
//
// Sin DOM: datosHilos(), svgHilos() y htmlHilos() son funciones puras que
// devuelven datos o texto, para el navegador y para las pruebas de Node.

import { ejeTemporal, banda } from '../../src/tiempo.js';
import { SEGUNDOS, ESCALAS_REALES as ESCALAS_T, partirClave } from '../../src/tokens.js';
import { propuestas, cierre } from '../../src/motor.js';
import { esReferencia } from '../../src/btml.js';
import { efectosDe, verEn, render, SIN_NOMBRE } from '../../src/efectos.js';

/** Mundo de los hilos del pasado y del futuro. */
export const PASADO = 6;
export const FUTURO = 7;

/** Bandas del eje, de la más cercana al presente a la más lejana: las siete escalas reales de T y «más». */
export const BANDAS = Object.freeze([...ESCALAS_T, 'mas']);

/** [X] 6: cada banda más lejana ocupa esta fracción de la interior. */
export const RAZON = 2 / 3;

/** [X] 8: la banda «más» acaba aquí, en años. */
export const TOPE_MAS = 10;

/** [X] 9: movimientos de tokens que se dibujan en una vista. */
export const MAXIMO_PUNTOS = 24;

/** Marcas de lo que decide este render (las de cada efecto vienen del catálogo). */
export const DECISIONES = Object.freeze({
  bandas: `[X] decidir VG: cada banda ocupa 2/3 de la interior, logarítmica dentro, y la banda «más» acaba en ${TOPE_MAS} años`,
  contador: '[X] decidir VG: lo que no cabe en su carril se agrega en un contador por banda; lo nuevo que cae en él no se anima ni mueve sus tokens',
  puntos: `[X] decidir VG: se dibujan como mucho ${MAXIMO_PUNTOS} movimientos de tokens por vista; los demás se cuentan`,
  vacio: '[X] decidir VG: el ∅ de las carteras (emitir y consumir) se dibuja en el presente',
});

const CORTA = Object.freeze({ segundo: 's', minuto: 'min', hora: 'h', dia: 'd', semana: 'sem', ciclo: 'cic', anio: 'a', mas: '+' });

// ---------- los efectos, del catálogo ----------

/**
 * El efecto con el que un registro está en el eje: la fase que el motor
 * reconoce (o su ruido, si la marca y no cuenta) o, si no es del motor, el
 * registro entero. Sale de efectosDe(): nada se decide aquí.
 */
export function efectoDelRegistro(efectos) {
  return efectos.find((e) => e.tipo === 'fase' || e.tipo === 'ruido')
    ?? efectos.find((e) => e.tipo !== 'token' && e.ruta.length === 0)
    ?? null;
}

/**
 * Cómo ve un mundo un efecto: el nombre que le da ese mundo (verEn) y que
 * se anima. Si ese mundo no lo nombra y no es el suyo, el nombre de su
 * propio mundo, quieto, con la marca SIN_NOMBRE del catálogo.
 */
export function enMundo(efecto, mundo) {
  const v = verEn(efecto, mundo);
  if (v) return { mundo, nombre: v.nombre, decision: v.decisiones[0], anima: true };
  if (efecto.mundo === mundo) return { mundo, nombre: efecto.nombre, decision: efecto.decisiones[0], anima: true };
  return { mundo, nombre: efecto.nombre, nombreDe: efecto.mundo, decision: SIN_NOMBRE, anima: false };
}

/** Lo declarado en la posición 7 del foco es una celda suya: el efecto de esa celda o, si el catálogo no la separa, el del foco. */
function efectoDeclarado(efectos, camino) {
  const k = camino.length;
  const bajo7 = (e) => e.tipo !== 'token' && e.tipo !== 'fase' && e.ruta.length > k
    && camino.every((x, j) => e.ruta[j] === x) && e.ruta[k] === FUTURO;
  return efectos.find(bajo7) ?? efectoDelRegistro(efectos);
}

/** Rótulo de un movimiento: cantidad y serie (T por escala, E emisor/denominación, P por ámbito, R por emisor; mapa §12 [D]). */
export function rotuloToken(efecto) {
  const p = partirClave(efecto.serie);
  return efecto.cantidad + ' ' + p.token + ':' + (p.token === 'P' ? corto(p.ambito) + (p.origen ? '/' + p.origen : '') : p.serie);
}

// ---------- geometría: bandas comprimidas ----------

/** Ancho de cada banda en una mitad del eje: la primera w0 y cada una RAZON de la anterior; suman la mitad. */
export function anchosDeBanda(mitad, razon = RAZON) {
  const n = BANDAS.length;
  const w0 = (mitad * (1 - razon)) / (1 - razon ** n);
  return BANDAS.map((_, i) => w0 * razon ** i);
}

/**
 * Distancia al presente, en unidades del dibujo, de algo que está a `delta`
 * segundos (pasado o futuro: cuenta el valor absoluto). Dentro de su banda,
 * logarítmica entre los límites de la banda ([X] 7); la primera, lineal; la
 * banda «más» acaba en TOPE_MAS años ([X] 8).
 */
export function distanciaAlPresente(delta, mitad, razon = RAZON) {
  const d = Math.abs(delta);
  if (!Number.isFinite(d)) return mitad;
  const anchos = anchosDeBanda(mitad, razon);
  const i = BANDAS.indexOf(banda(d));
  const inicio = anchos.slice(0, i).reduce((a, b) => a + b, 0);
  const lo = i === 0 ? 0 : SEGUNDOS[BANDAS[i - 1]];
  const hi = i < ESCALAS_T.length ? SEGUNDOS[BANDAS[i]] : lo * TOPE_MAS;
  const frac = i === 0 ? d / hi : Math.min(1, Math.log(d / lo) / Math.log(hi / lo));
  return inicio + frac * anchos[i];
}

// ---------- datos: del eje a una lista plana ----------

const seg = (iso) => Date.parse(iso) / 1000;

function textoCorto(c) {
  if (c === undefined || c === null) return '';
  if (Array.isArray(c)) return c.length ? textoCorto(c[0]) : '[ ]';
  if (esReferencia(c)) return '→ ' + String(c.ref).slice(0, 8);
  const s = String(c);
  return s.startsWith('==') ? s.slice(1) : s;
}

/** Título de un registro: su posición 0 (su representación) o el terminal. */
export function titulo(ev) {
  return textoCorto(ev?.payload);
}

/**
 * Lo que dibujan los hilos de un foco, sacado del eje: el eje temporal de
 * tiempo.ejeTemporal (el mismo que pinta el sobrio) y, por cada evento, sus
 * efectos del catálogo (efectosDe): el principal (`efecto`), sus tokens y la
 * lista entera en `efectos`, para el render sobrio. Además, a qué apunta cada
 * registro (`sobre`), qué registro cerró cada propuesta (el ancla) y cómo
 * estaba esa propuesta en el futuro justo antes (`antes`), y el orden de
 * entrada en el eje. No escribe nada.
 */
export function datosHilos(eje, foco, { ahora = new Date().toISOString(), camino = [], maximo } = {}) {
  const ev = eje.obtener(foco);
  if (!ev) throw new Error('foco desconocido: ' + foco);
  const e = ejeTemporal(eje, foco, { ahora, camino, ...(maximo ? { maximo } : {}) });
  const t0 = seg(ahora);
  const situar = (t) => ({ delta: seg(t) - t0, banda: banda(seg(t) - t0) });
  const ancestros = new Set(eje.hilo(foco).slice(1).map((x) => x.id));
  const efectos = {};
  const de = (id) => (efectos[id] ??= efectosDe(eje, id));
  const tokens = (id) => de(id).filter((x) => x.tipo === 'token');

  const pasado = e.pasado.map((x) => {
    const r = eje.obtener(x.id);
    const efecto = efectoDelRegistro(de(x.id));
    return {
      id: x.id, autor: x.autor, t: x.t, delta: x.delta, banda: x.banda,
      sobre: r.sobre, hilo: ancestros.has(x.id), genesis: r.sobre === null,
      fase: efecto.tipo === 'fase' ? efecto.fase : null, titulo: titulo(r), efecto, tokens: tokens(x.id),
    };
  });

  const futuro = e.futuro.map((x) => {
    const base = { id: x.id, tipo: x.tipo, autor: x.autor, t: x.t, delta: x.delta, banda: x.banda };
    if (x.tipo === 'declarado') return { ...base, titulo: textoCorto(x.contenido), efecto: efectoDeclarado(de(foco), camino), tokens: [] };
    const f = { ...base, titulo: titulo(eje.obtener(x.id)), efecto: efectoDelRegistro(de(x.id)), tokens: tokens(x.id) };
    if (x.tipo === 'consolidacion') f.cerrado = x.cerrado;
    return f;
  });

  const anclas = [];
  for (const c of propuestas(eje, foco, camino)) {
    if (c.cerrado !== true) continue;
    // El registro que la cerró: el último escrito sobre ella que mueve lo anunciado (motor.cierre).
    const x = cierre(eje, c.id);
    if (!x) continue;
    anclas.push({
      id: x.id, consolidacion: c.id, autorizacion: null,
      titulo: textoCorto(c.titulo), autor: x.autor, t: x.t, ...situar(x.t),
      efecto: efectoDelRegistro(de(x.id)), tokens: tokens(x.id),
      // La propuesta tal como estaba a la derecha antes de cerrarse: lo que se suelta es ese arco.
      antes: {
        id: c.id, tipo: 'consolidacion', cerrado: false,
        autor: c.autor, t: c.t, ...situar(c.t), titulo: titulo(eje.obtener(c.id)),
        efecto: efectoDelRegistro(de(c.id)), tokens: tokens(c.id),
      },
    });
  }

  const focoEfecto = efectoDelRegistro(de(foco));
  const orden = {};
  eje.orden.forEach((id, i) => { if (Object.hasOwn(efectos, id)) orden[id] = i; });
  const ultimas = anclas.slice(-(maximo ?? 10));

  return {
    foco: { id: ev.id, autor: ev.autor, t: ev.t, sobre: ev.sobre, titulo: titulo(ev), efecto: focoEfecto, ...situar(ev.t) },
    ahora, camino: [...camino], pasado, futuro, anclas: ultimas,
    identidades: eje.identidades(), totalPasado: e.totalPasado, totalFuturo: e.totalFuturo, totalAnclas: anclas.length,
    orden, efectos,
  };
}

/**
 * Memoria de quien mira: qué eventos del eje ya ha visto en los hilos. Solo
 * lo nuevo se anima (un cambio real del eje); la primera vez que se miran
 * los hilos, o con otro eje, nada se anima.
 */
export function memoria() {
  let ejeVisto = null;
  let conocidos = null;
  return {
    nuevos(eje) {
      const ids = eje.orden;
      const n = ejeVisto === eje && conocidos ? new Set(ids.filter((id) => !conocidos.has(id))) : new Set();
      ejeVisto = eje;
      conocidos = new Set(ids);
      return n;
    },
  };
}

// ---------- render: SVG como texto ----------

function escapar(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const n1 = (x) => Math.round(x * 10) / 10;
function corto(id) {
  return String(id).slice(0, 8);
}
const recorte = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

function haceCuanto(delta, b) {
  const d = Math.abs(delta);
  const u = [['anio', 'año'], ['ciclo', 'ciclo'], ['semana', 'semana'], ['dia', 'día'], ['hora', 'h'], ['minuto', 'min']];
  let txt = Math.round(d) + ' s';
  for (const [k, nombre] of u) {
    if (d >= SEGUNDOS[k]) { txt = Math.round(d / SEGUNDOS[k]) + ' ' + nombre; break; }
  }
  return (delta <= 0 ? 'hace ' : 'dentro de ') + txt + ' · banda ' + b;
}

const W = 400;
const CX = W / 2;

/** Medidas del dibujo. Las celdas de Mapped (compacto) miden unos 110 px de ancho en un móvil: nodos y bloques más grandes. */
export function geometria(compacto) {
  return compacto
    ? { H: 128, eje: 64, r: 9, margen: 6, minimo: 24, carrilesPasado: [0, -26, 26, -50, 50], carrilesFuturo: [-26, 26, -50, 50, 0], bloque: [22, 14] }
    : { H: 286, eje: 132, r: 6, margen: 12, minimo: 18, carrilesPasado: [0, -26, 26, -52, 52, -78], carrilesFuturo: [-28, 28, -56, 56, -84, 0], bloque: [18, 12], carteras: 258 };
}

/** Coloca en carriles: cada nodo en el primer carril donde no pisa al anterior; lo que no cabe, al contador de su banda. */
function encarrilar(items, carriles, separacion, preferente = () => false) {
  const ultimo = new Map();
  const colocados = [];
  const sobran = new Map();
  const orden = [...items.filter(preferente), ...items.filter((x) => !preferente(x))];
  for (const it of orden) {
    const lista = preferente(it) ? carriles : [...carriles.slice(1), carriles[0]];
    const c = lista.find((k) => !ultimo.has(k) || Math.abs(ultimo.get(k) - it.x) >= separacion);
    if (c === undefined) { sobran.set(it.banda, [...(sobran.get(it.banda) ?? []), it]); continue; }
    ultimo.set(c, it.x);
    colocados.push({ ...it, carril: c });
  }
  return { colocados, sobran };
}

/**
 * El SVG de los hilos, como texto. Función pura: no toca el DOM ni el eje.
 *   datos: lo que devuelve datosHilos().
 *   ventana: 'todo' (vista completa), 'pasado' (celda 6) o 'futuro' (celda 7).
 *   compacto: sin rótulos ni carteras, para las celdas de Mapped.
 *   nuevos: Set de ids de evento nuevos para quien mira (memoria().nuevos).
 *   maximoPuntos: movimientos de tokens que se dibujan ([X] 9).
 * Es una imagen (role="img"): se navega con los botones del sobrio.
 */
export function svgHilos(datos, { ventana = 'todo', compacto = false, nuevos = new Set(), maximoPuntos = MAXIMO_PUNTOS } = {}) {
  if (!['todo', 'pasado', 'futuro'].includes(ventana)) throw new Error('ventana desconocida: ' + ventana);
  const g = geometria(compacto);
  const mitad = CX - g.margen;
  const verPasado = ventana !== 'futuro';
  const verFuturo = ventana !== 'pasado';
  const xPasado = (delta) => CX - Math.max(distanciaAlPresente(delta, mitad), g.minimo);
  const xFuturo = (delta) => CX + Math.max(distanciaAlPresente(delta, mitad), g.minimo);

  // Retardo por evento: los nuevos llegan en su orden de entrada en el eje.
  const nuevosEnOrden = [...nuevos].filter((id) => datos.orden[id] !== undefined).sort((a, b) => datos.orden[a] - datos.orden[b]);
  const PASO = 0.55;
  const retardo = (id, mas = 0) => `--retardo:${Math.round((Math.max(0, nuevosEnOrden.indexOf(id)) * PASO + mas) * 100) / 100}s`;
  const origen = `transform-origin:${CX}px ${g.eje}px`;
  const anima = (id, efecto, mundo) => nuevos.has(id) && enMundo(efecto, mundo).anima;
  const atributos = (id, efecto, mundo, extra = '') => {
    const v = enMundo(efecto, mundo);
    return `data-evento="${escapar(id)}" data-efecto="${escapar(v.nombre)}" data-mundo="${mundo}"`
      + (v.nombreDe !== undefined ? ` data-nombre-de="${v.nombreDe}"` : '') + ` data-decision="${escapar(v.decision)}"${extra}`;
  };
  // El texto de cada elemento: qué es y el render sobrio del mismo efecto.
  const describir = (texto, efecto) => `<title>${escapar(texto + ' · ' + render([efecto], 'sobrio'))}</title>`;
  const dibujados = new Set();

  const capas = { bandas: [], hilos: [], nodos: [], futuro: [], anclas: [], carteras: [], puntos: [] };

  // Rótulos: solo en la vista completa, y uno por carril cada 50 unidades (el más cercano al presente primero).
  const rotulados = new Map();
  const rotular = (carril, x) => {
    if (compacto || Math.abs((rotulados.get(carril) ?? -Infinity) - x) < 50) return false;
    rotulados.set(carril, x);
    return true;
  };

  // Bandas: franjas alternas a cada lado, con su rótulo si cabe.
  const anchos = anchosDeBanda(mitad);
  let acumulado = 0;
  anchos.forEach((w, i) => {
    const lados = [...(verPasado ? [CX - acumulado - w] : []), ...(verFuturo ? [CX + acumulado] : [])];
    for (const x of lados) {
      capas.bandas.push(`<rect class="banda b${i % 2}" x="${n1(x)}" y="${compacto ? 4 : 18}" width="${n1(w)}" height="${g.H - (compacto ? 8 : 52)}"><title>${BANDAS[i]}</title></rect>`);
      if (!compacto && w >= 14) capas.bandas.push(`<text class="rotulo-banda" x="${n1(x + w / 2)}" y="13">${CORTA[BANDAS[i]]}</text>`);
    }
    acumulado += w;
  });
  const eje = `<line class="eje" x1="${verPasado ? g.margen : CX}" y1="${g.eje}" x2="${verFuturo ? W - g.margen : CX}" y2="${g.eje}"/>`
    + `<line class="presente" x1="${CX}" y1="${compacto ? 4 : 18}" x2="${CX}" y2="${g.H - (compacto ? 4 : 34)}"/>`
    + (compacto ? '' : `<text class="rotulo-presente" x="${CX}" y="13">ahora</text>`);

  // Contador de lo que no cabe en su carril ([X] 4): qué eventos lleva y cuántos son nuevos.
  const contador = (b, lista, lado, que) => {
    const i = BANDAS.indexOf(b);
    const x = CX + lado * (anchos.slice(0, i).reduce((s, w) => s + w, 0) + anchos[i] / 2);
    const k = lista.filter((it) => nuevos.has(it.id)).length;
    return `<g class="contador" transform="translate(${n1(x)} ${compacto ? 12 : 28})" data-eventos="${escapar(lista.map((it) => it.id).join(' '))}" data-nuevos="${k}" data-decision="${escapar(DECISIONES.contador)}">`
      + `<title>${escapar(`${lista.length} ${que} más en la banda ${b}` + (k ? ` · ${k} nuevos, sin animar` : ''))}</title><text class="rotulo-contador">+${lista.length}</text></g>`;
  };

  // Pasado: nodos en carriles; el hilo hacia el génesis va en el carril del eje.
  const sep = 2 * g.r + 4;
  const { colocados: pasado, sobran } = encarrilar(
    datos.pasado.map((p) => ({ ...p, x: xPasado(p.delta) })),
    g.carrilesPasado, sep, (p) => p.hilo,
  );
  const posicion = new Map([[datos.foco.id, { x: CX, y: g.eje }]]);
  for (const p of pasado) posicion.set(p.id, { x: p.x, y: g.eje + p.carril });

  const enlace = (a, b) => {
    const mx = n1((a.x + b.x) / 2);
    return `M${n1(a.x)} ${n1(a.y)} C${mx} ${n1(a.y)} ${mx} ${n1(b.y)} ${n1(b.x)} ${n1(b.y)}`;
  };
  if (verPasado) {
    // Hilos: cada registro unido a aquello sobre lo que se escribió (la referencia `sobre`).
    for (const p of [...pasado, { ...datos.foco, x: CX, carril: 0 }]) {
      const destino = p.sobre ? posicion.get(p.sobre) : undefined;
      if (!destino) continue;
      const a = p.id !== datos.foco.id && anima(p.id, p.efecto, PASADO);
      capas.hilos.push(`<path class="hilo${a ? ' nuevo traza' : ''}" pathLength="1" d="${enlace({ x: p.x, y: g.eje + p.carril }, destino)}" ${atributos(p.id, p.efecto, PASADO, a ? ` style="${retardo(p.id, 0.25)}"` : '')}/>`);
    }
    for (const p of pasado) {
      dibujados.add(p.id);
      const a = anima(p.id, p.efecto, PASADO);
      const clase = ['nodo', p.hilo ? 'en-hilo' : 'escrito', p.genesis ? 'genesis' : '', p.fase ? 'fase-' + p.fase : '', a ? 'nuevo entra' : ''].filter(Boolean).join(' ');
      const forma = p.genesis
        ? `<rect class="marca" x="${-g.r}" y="${-g.r}" width="${2 * g.r}" height="${2 * g.r}" rx="2"/>`
        : `<circle class="marca" r="${g.r}"/>`;
      const rotulo = rotular(p.carril, p.x) ? `<text class="rotulo" y="${p.carril < 0 ? -g.r - 4 : g.r + 10}">${escapar(recorte(p.titulo, 12))}</text>` : '';
      const que = p.fase === 'consolidado' ? 'consolidación (su arco está en el 7)' : 'registro';
      capas.nodos.push(`<g transform="translate(${n1(p.x)} ${n1(g.eje + p.carril)})"><g class="${clase}" ${atributos(p.id, p.efecto, PASADO, a ? ` style="${retardo(p.id)}"` : '')}>`
        + describir(`${que} ${corto(p.id)} · ${p.autor} · ${p.titulo} · ${haceCuanto(p.delta, p.banda)}`, p.efecto) + `${forma}${rotulo}</g></g>`);
    }
    for (const [b, lista] of sobran) capas.nodos.push(contador(b, lista, -1, 'registros'));
  }

  // Foco: el registro en el presente, en la costura. No es un efecto: es donde se mira.
  const foco = `<g class="foco" transform="translate(${CX} ${g.eje})" data-evento="${escapar(datos.foco.id)}" data-foco=""><title>${escapar(`foco ${corto(datos.foco.id)} · ${datos.foco.autor} · ${datos.foco.titulo} · escrito ${haceCuanto(datos.foco.delta, datos.foco.banda)}`)}</title>`
    + `<circle class="anillo" r="${g.r + 4}"/><circle class="marca" r="${g.r - 1}"/>`
    + (compacto ? '' : `<text class="rotulo-foco" y="${g.r + 18}">${escapar(recorte(datos.foco.titulo, 22))}</text>`) + '</g>';

  // Futuro: arcos que salen del foco hacia sus bloques. Una consolidación
  // cuya ejecución es nueva se coloca como estaba antes (`antes`), en el mismo
  // orden y con los mismos carriles: el arco que se suelta es el que había.
  const [bw, bh] = g.bloque;
  const arco = (x2, y2, curva = -22) => `M${CX} ${g.eje} Q${n1((CX + x2) / 2)} ${n1(Math.min(g.eje, y2) + curva)} ${n1(x2)} ${n1(y2)}`;
  const soltando = datos.anclas.filter((a) => a.antes && anima(a.id, a.efecto, FUTURO));
  const enFuturo = [...datos.futuro, ...soltando.map((a) => ({ ...a.antes, suelta: a }))].sort((a, b) => a.delta - b.delta);
  const { colocados: futuro, sobran: sobranF } = encarrilar(enFuturo.map((f) => ({ ...f, x: xFuturo(f.delta) })), g.carrilesFuturo, bw + 4);

  const dibujarFuturo = (f, quieto) => {
    const y = g.eje + f.carril;
    const estado = f.tipo === 'consolidacion' ? ' abierta' : '';
    const a = !quieto && anima(f.id, f.efecto, FUTURO);
    const desc = f.tipo === 'consolidacion' ? `propuesta ${corto(f.id)} · ${f.autor} · ${f.titulo} · abierta`
      : f.tipo === 'declarado' ? `declarado en la posición 7 del foco · ${f.titulo}`
        : `proyección ${corto(f.id)} · ${f.autor} · ${f.titulo} · ${haceCuanto(f.delta, f.banda)}`;
    const rotulo = !rotular('f' + f.carril, f.x) ? '' : `<text class="rotulo" x="${n1(f.x + bw / 2)}" y="${n1(y + (f.carril < 0 ? -bh / 2 - 4 : bh / 2 + 10))}">${escapar(recorte(f.titulo, 12))}</text>`;
    const nudo = '';
    return `<g class="futuro ${f.tipo}${estado}${a ? ' nuevo proyecta' : ''}" ${atributos(f.id, f.efecto, FUTURO, ` style="${origen}${a ? ';' + retardo(f.id, 0.2) : ''}"`)}>`
      + describir(desc, f.efecto) + `<path class="arco" pathLength="1" d="${arco(f.x, y)}"/>`
      + `<rect class="bloque" x="${n1(f.x)}" y="${n1(y - bh / 2)}" width="${bw}" height="${bh}" rx="2"/>${rotulo}</g>${nudo}`;
  };
  if (verFuturo) {
    for (const f of futuro) {
      if (!f.suelta) {
        dibujados.add(f.id);
        capas.futuro.push(dibujarFuturo(f, false));
        continue;
      }
      // El registro que la cierra suelta el arco de su propuesta: el mismo, donde estaba, y cae al presente.
      const s = f.suelta;
      dibujados.add(s.id);
      capas.futuro.push(`<g class="suelta nuevo" ${atributos(s.id, s.efecto, FUTURO, ` data-consolidacion="${escapar(f.id)}" style="${origen};${retardo(s.id)}"`)}>`
        + describir(`cerrada por ${corto(s.id)}: se suelta el arco de ${corto(f.id)}`, s.efecto) + dibujarFuturo(f, true) + '</g>');
    }
    for (const [b, lista] of sobranF) capas.futuro.push(contador(b, lista, 1, 'en el futuro'));
  }

  // Anclas: el registro que cierra una propuesta ancla en el hilo del pasado lo que era proyecto.
  if (verPasado) {
    for (const a of datos.anclas) {
      dibujados.add(a.id);
      const an = anima(a.id, a.efecto, PASADO);
      const ax = xPasado(a.delta);
      const desc = `cerrada por ${corto(a.id)} · ${a.autor} · ${a.titulo} · ${haceCuanto(a.delta, a.banda)}`;
      capas.anclas.push(`<g class="ancla${an ? ' nuevo ancla-cae' : ''}" ${atributos(a.id, a.efecto, PASADO, ` data-consolidacion="${escapar(a.consolidacion)}" style="${origen}${an ? ';' + retardo(a.id, 0.5) : ''}"`)}>`
        + describir(desc, a.efecto)
        + `<path class="arco-anclado" pathLength="1" d="M${CX} ${g.eje} Q${n1((CX + ax) / 2)} ${n1(g.eje + (compacto ? 22 : 30))} ${n1(ax)} ${g.eje}"/>`
        + `<g transform="translate(${n1(ax)} ${g.eje})${compacto ? ' scale(1.6)' : ''}"><path class="simbolo-ancla" d="M0 -6V5M-4.5 1.5Q0 8 4.5 1.5M-2.5 -3.5H2.5"/></g></g>`);
    }
  }

  // Carteras y tokens (vista completa): cada movimiento de un evento nuevo que
  // se ve, un punto de `de` a `a`, con el nombre que le da su mundo.
  if (!compacto && ventana === 'todo') {
    const porEvento = new Map();
    const anotar = (id, lista, mas) => { if (!porEvento.has(id)) porEvento.set(id, { lista, mas }); };
    for (const p of datos.pasado) anotar(p.id, p.tokens, 0.6);
    for (const f of datos.futuro) {
      anotar(f.id, f.tokens, 0.6);
    }
    for (const a of datos.anclas) anotar(a.id, a.tokens, 1.3);
    const movimientos = [];
    for (const id of nuevosEnOrden) {
      if (!dibujados.has(id) || !porEvento.has(id)) continue;
      const { lista, mas } = porEvento.get(id);
      lista.forEach((t, k) => movimientos.push({ id, t, retraso: mas + k * 0.22 }));
    }
    const visibles = movimientos.slice(0, Math.max(0, maximoPuntos));
    const sinDibujar = movimientos.length - visibles.length;

    // Carteras: las identidades del eje y cualquier otra que mueva tokens aquí.
    const ids = [...datos.identidades];
    for (const { t } of visibles) for (const q of [t.de, t.a]) if (q !== null && !ids.includes(q)) ids.push(q);
    const izq = Math.ceil(ids.length / 2);
    const der = ids.length - izq;
    const sitio = new Map([[null, CX]]);
    ids.forEach((id, k) => {
      const x = k < izq
        ? g.margen + 18 + (izq === 1 ? (CX - 40 - g.margen - 18) / 2 : (k * (CX - 40 - g.margen - 18)) / (izq - 1))
        : CX + 40 + (der === 1 ? (W - g.margen - 18 - CX - 40) / 2 : ((k - izq) * (W - g.margen - 18 - CX - 40)) / (der - 1));
      sitio.set(id, x);
    });
    const y = g.carteras;
    for (const [id, x] of sitio) {
      const vacio = id === null;
      capas.carteras.push(`<g class="cartera${vacio ? ' vacio' : ''}" transform="translate(${n1(x)} ${y})"${vacio ? ` data-decision="${escapar(DECISIONES.vacio)}"` : ''}><title>${escapar(vacio ? '∅: emitir (de nadie) o consumir (a nadie)' : 'cartera de ' + id)}</title><circle r="4"/><text class="rotulo" y="16">${escapar(vacio ? '∅' : recorte(id, 10))}</text></g>`);
    }
    for (const { id, t, retraso } of visibles) {
      const x1 = sitio.get(t.de);
      const dx = sitio.get(t.a) - x1;
      capas.puntos.push(`<g transform="translate(${n1(x1)} ${y})"><g class="punto nuevo token-${escapar(t.token)}" ${atributos(id, t, t.mundo, ` data-serie="${escapar(t.serie)}" data-de="${escapar(t.de ?? '∅')}" data-a="${escapar(t.a ?? '∅')}" style="--dx:${n1(dx)}px;${retardo(id, retraso)}"`)}>`
        + describir(`${t.cantidad} ${t.serie} · ${t.de ?? '∅'} → ${t.a ?? '∅'}`, t)
        + `<g class="sube"><circle r="4"/><text class="rotulo-punto" y="-7">${escapar(recorte(rotuloToken(t), 22))}</text></g></g></g>`);
    }
    if (sinDibujar > 0) {
      capas.puntos.push(`<g class="contador-tokens" transform="translate(${W - g.margen} ${y - 22})" data-sin-dibujar="${sinDibujar}" data-decision="${escapar(DECISIONES.puntos)}"><title>${sinDibujar} movimientos de tokens más, sin dibujar</title><text class="rotulo-contador fin">+${sinDibujar} movimientos</text></g>`);
    }
  }

  const caja = ventana === 'todo' ? `0 0 ${W} ${g.H}` : ventana === 'pasado' ? `0 0 ${CX} ${g.H}` : `${CX} 0 ${CX} ${g.H}`;
  const etiqueta = ventana === 'futuro'
    ? `Hilos del futuro: ${datos.totalFuturo} entre proyecciones, consolidaciones sin ejecutar y lo declarado`
    : ventana === 'pasado' ? `Hilos del pasado: ${datos.totalPasado} registros` : `Hilos de ${corto(datos.foco.id)}: ${datos.totalPasado} en el pasado, ${datos.totalFuturo} en el futuro`;
  return `<svg class="hilos${compacto ? ' compacto' : ''}" viewBox="${caja}" role="img" aria-label="${escapar(etiqueta)}" data-ventana="${ventana}" xmlns="http://www.w3.org/2000/svg">`
    + `<g class="capa-bandas" data-decision="${escapar(DECISIONES.bandas)}">${capas.bandas.join('')}</g>${eje}`
    + `<g class="capa-hilos">${capas.hilos.join('')}</g><g class="capa-anclas">${capas.anclas.join('')}</g>`
    + `<g class="capa-futuro">${capas.futuro.join('')}</g><g class="capa-nodos">${capas.nodos.join('')}</g>${foco}`
    + `<g class="capa-carteras">${capas.carteras.join('')}</g><g class="capa-puntos">${capas.puntos.join('')}</g></svg>`;
}

/** Los efectos de los eventos nuevos de estos hilos, en orden de entrada: la lista que leen los dos renders. */
export function efectosNuevos(datos, nuevos) {
  return Object.keys(datos.efectos)
    .filter((id) => nuevos.has(id))
    .sort((a, b) => datos.orden[a] - datos.orden[b])
    .flatMap((id) => datos.efectos[id]);
}

/**
 * La vista completa: el SVG, la leyenda (con los nombres del catálogo) y lo
 * nuevo desde la última mirada en render sobrio: la misma lista de efectos
 * que se anima, también lo que cae en un contador.
 */
export function htmlHilos(datos, { nuevos = new Set(), maximoPuntos } = {}) {
  const nombre = (efecto, mundo) => verEn(efecto, mundo)?.nombre;
  const leyenda = [
    ['nodo', 'registro: ' + nombre({ tipo: 'escrito' }, PASADO)],
    ['hilo', 'hilo: aquello sobre lo que se escribió'],
    ['arco', 'proyección o propuesta sin cerrar: ' + nombre({ tipo: 'fase', fase: 'consolidado' }, FUTURO)],
    ['ancla', 'cerrada: el registro que la cierra, ' + nombre({ tipo: 'escrito' }, PASADO)],
    ['punto', 'tokens de → a, con el nombre de su mundo'],
  ];
  const lista = efectosNuevos(datos, nuevos);
  const sobrio = lista.length
    ? `<div class="titulo">Lo nuevo desde la última mirada, en sobrio: los mismos efectos que se animan</div><pre>${escapar(render(lista, 'sobrio'))}</pre>`
    : '<div class="titulo">Nada nuevo desde la última mirada</div>';
  return `<figure class="hilos-vista">${svgHilos(datos, { nuevos, ventana: 'todo', compacto: false, ...(maximoPuntos !== undefined ? { maximoPuntos } : {}) })}`
    + `<figcaption class="hilos-leyenda">${leyenda.map(([c, t]) => `<span class="ley ley-${c}">${escapar(t)}</span>`).join('')}</figcaption>`
    + `<div class="hilos-sobrio" aria-live="polite">${sobrio}</div></figure>`;
}
