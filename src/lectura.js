// Lectura humana de BTML (VG, 8-11: «es muy difícil de leer para una
// persona, incluido para mí; por eso es muy difícil evaluarlo sin lentes»).
// Un payload se imprime como un esquema de texto plano: una línea por
// posición con contenido, `<dígito> · <nombre de la regla corta>: <contenido>`,
// con dos espacios de sangría por nivel. Una hoja da su texto; una
// referencia, `→ <id corto>` (y, con el eje, el texto de lo que alcanza en su
// posición 0); una lista, sus ocupantes separados por ` · ` y, si son más de
// uno, cuántos; una décupla, sus posiciones una sangría más adentro. Las
// posiciones vacías no se imprimen. Sin colores ni HTML: lo mismo vale para
// la consola, los documentos y un <pre> en la app.
//
// Vive aparte de src/btml.js para que BTML siga sin depender de las épocas
// (que importan btml.js): los nombres de cada dígito son regla de la época,
// fuera del dato. Nada de esto cambia el dato: solo lo enseña.

import { ARIDAD, esReferencia, esTerminal, esLista, indicesDe, nodoEn } from './btml.js';
import { epocaDe, EPOCA_0 } from './epocas.js';
import { seguir, ocupantes } from './encaje.js';

const SANGRIA = '  ';
const RAIZ = '0000000000';

/** Nombre corto de un id: el de `nombres` (Map, objeto o función id → nombre) si lo trae, o sus ocho primeros caracteres. */
function nombreDeId(id, nombres) {
  const propio = typeof nombres === 'function' ? nombres(id)
    : nombres instanceof Map ? nombres.get(id)
      : nombres && typeof nombres === 'object' && Object.hasOwn(nombres, id) ? nombres[id] : undefined;
  return typeof propio === 'string' && propio ? propio : String(id).slice(0, 8);
}

/** Dirección en corto: los dígitos con sentido separados por puntos ('1200000000' → '1.2'); la raíz, vacía. */
function dirCorta(dir) {
  return indicesDe(dir).join('.');
}

/** Texto de una hoja sin seguir referencias: el número o la cadena tal cual; una referencia, → id corto[:dirección]. */
function textoHoja(x, nombres) {
  if (esReferencia(x)) {
    const dir = x.dir ?? RAIZ;
    return '→ ' + nombreDeId(x.ref, nombres) + (dir === RAIZ ? '' : ':' + dirCorta(dir));
  }
  return String(x);
}

/**
 * Lo que dice en una línea un nodo cualquiera: una hoja, su texto; una
 * lista, sus ocupantes unidos por « · »; una décupla (o una raíz), lo que
 * dice su posición 0 (qué es). Las referencias no se siguen aquí.
 */
function resumen(nodo, nombres, raiz = false) {
  if (nodo === undefined || nodo === null) return '';
  if (esTerminal(nodo)) return textoHoja(nodo, nombres);
  if (!Array.isArray(nodo) || nodo.length === 0) return '';
  if (!raiz && esLista(nodo)) return nodo.map((x) => textoHoja(x, nombres)).join(' · ');
  return resumen(nodo[0], nombres);
}

/**
 * Lo que alcanza una referencia, en una línea: el texto de su posición 0
 * (la del payload entero si la referencia no lleva dirección; la de la
 * décupla que alcanza; la lista entera si alcanza una lista; la hoja si
 * alcanza una hoja). Una referencia a un evento ausente se dice pendiente;
 * una a una posición sin desarrollar, sin desarrollar.
 */
function alcance(eje, ref, nombres) {
  const s = seguir(eje, ref);
  if (s.rota) return s.contenido === undefined && s.motivo ? 'pendiente: ' + s.motivo : 'referencia rota';
  if (s.contenido === undefined) return 'sin desarrollar';
  return resumen(s.contenido, nombres, indicesDe(s.dir).length === 0);
}

/** Texto de una hoja en su línea: con eje, una referencia lleva entre paréntesis lo que alcanza. */
function contenidoHoja(x, ctx) {
  const t = textoHoja(x, ctx.nombres);
  if (!esReferencia(x) || !ctx.eje) return t;
  const a = alcance(ctx.eje, x, ctx.nombres);
  return a ? t + ' (' + a + ')' : t;
}

/** Contenido de una línea, o undefined si la posición es una décupla (va en las líneas de debajo) o está vacía. */
function contenidoLinea(x, ctx) {
  if (esTerminal(x)) return contenidoHoja(x, ctx);
  if (esLista(x)) return x.map((h) => contenidoHoja(h, ctx)).join(' · ') + (x.length > 1 ? ' · ' + x.length + ' ocupantes' : '');
  return undefined;
}

const clave = (camino) => camino.join('.');

/** Nombre de la posición `digito` a `profundidad`: la regla larga de su ruta (si se conoce el camino desde la raíz) o la corta. */
function nombrePosicion(ctx, profundidad, digito, camino) {
  const e = ctx.epoca;
  if (ctx.desdeRaiz && camino.length > 1 && typeof e.reglaLarga === 'function') {
    const larga = e.reglaLarga(camino.join(''));
    if (larga !== undefined) return larga;
  }
  return e.reglaCorta(profundidad, digito) ?? 'sin regla';
}

/** Dígitos que se leen bajo un nodo: sus posiciones con contenido (raíz o décupla) y las de los ocupantes anclados más abajo. */
function digitosBajo(nodo, camino, ctx, raiz) {
  const ds = new Set();
  if (Array.isArray(nodo) && (raiz || !esLista(nodo))) {
    for (let i = 0; i < Math.min(nodo.length, ARIDAD); i++) if (nodo[i] !== null && nodo[i] !== undefined) ds.add(i);
  }
  for (const k of ctx.anclados.keys()) {
    const p = k === '' ? [] : k.split('.').map(Number);
    if (p.length > camino.length && camino.every((x, j) => p[j] === x)) ds.add(p[camino.length]);
  }
  return [...ds].sort((a, b) => a - b);
}

/** Líneas de los ocupantes anclados en un camino, con su sangría. */
function lineasAnclados(camino, nivel, ctx, salida) {
  for (const o of ctx.anclados.get(clave(camino)) ?? []) {
    salida.push(SANGRIA.repeat(nivel) + '↳ ocupante ' + o.k + ' · ' + o.autor + ' · ' + o.texto);
  }
}

/** Las líneas de las posiciones bajo `nodo` (en `camino`, a `profundidad`), con `nivel` de sangría. */
function lineasBajo(nodo, camino, profundidad, nivel, ctx, salida, raiz = false, solo) {
  for (const d of digitosBajo(nodo, camino, ctx, raiz)) {
    if (solo !== undefined && d !== solo) continue;
    const aqui = [...camino, d];
    const x = Array.isArray(nodo) && (raiz || !esLista(nodo)) ? nodo[d] : undefined;
    const contenido = x === undefined || x === null ? undefined : contenidoLinea(x, ctx);
    const cabeza = SANGRIA.repeat(nivel) + d + ' · ' + nombrePosicion(ctx, profundidad, d, aqui) + ':';
    salida.push(contenido === undefined ? cabeza : cabeza + ' ' + contenido);
    lineasBajo(x, aqui, profundidad + 1, nivel + 1, ctx, salida);
    lineasAnclados(aqui, nivel + 1, ctx, salida);
  }
}

function contexto({ epoca = EPOCA_0, eje, nombres, anclados = new Map(), desdeRaiz = false } = {}) {
  return { epoca: epocaDe(epoca), eje, nombres, anclados, desdeRaiz };
}

/**
 * Lectura humana de un payload BTML: texto plano, una línea por posición con
 * contenido, `<dígito> · <nombre>: <contenido>`, con dos espacios de
 * sangría por nivel. Los nombres son las reglas cortas de la época (por
 * defecto la 0) en cada profundidad: en la 0, la cruceta (representación,
 * recursos, criterios…); en toda n ≥ 1, las preguntas (qué es, cuánto, con
 * qué condición…).
 *
 * - `profundidad` (0 por defecto): la del nodo que se lee. En la 0 el
 *   payload es la cruceta aunque sean solo hojas; en una n ≥ 1, un array
 *   solo de hojas es una lista y se lee en una línea.
 * - `eje` (opcional): una referencia lleva entre paréntesis el texto de lo
 *   que alcanza en su posición 0 (`→ menú (Menú del día)`).
 * - `nombres` (opcional): Map, objeto o función id → nombre corto, para
 *   decir `menú` en vez de los ocho primeros caracteres del id.
 *
 * Un payload terminal (sin posiciones) se lee como su texto, en una línea.
 */
export function leer(payload, { epoca = EPOCA_0, profundidad = 0, eje, nombres } = {}) {
  return lineas(payload, contexto({ epoca, eje, nombres, desdeRaiz: profundidad === 0 }), profundidad).join('\n');
}

function lineas(payload, ctx, profundidad = 0) {
  const salida = [];
  const raiz = profundidad === 0;
  if (payload === undefined || payload === null) return salida;
  if (esTerminal(payload)) salida.push(contenidoHoja(payload, ctx));
  else if (!raiz && esLista(payload)) salida.push(contenidoLinea(payload, ctx));
  lineasBajo(payload, [], profundidad, 0, ctx, salida, Array.isArray(payload) && (raiz || !esLista(payload)));
  return salida;
}

/** Cuántos propios tiene la lista de una posición: una lista, uno por elemento; una décupla o una hoja, uno; la raíz o nada, ninguno. */
function propiosEn(payload, camino) {
  if (!camino.length) return 0;
  const nodo = nodoEn(payload, camino);
  if (nodo === undefined || nodo === null) return 0;
  return esLista(nodo) ? nodo.length : 1;
}

/**
 * Lectura humana de un registro del eje: una cabecera
 * `<id corto> · <autor> · <t> · sobre <id corto> en <dirección>` (el génesis
 * dice «génesis») y, debajo, `leer(payload)` con el eje (las referencias
 * dicen lo que alcanzan). Bajo cada posición, los ocupantes escritos
 * anclados en ella (de encaje.ocupantes, camino exacto, por llegada), una
 * línea cada uno: `↳ ocupante k · <autor> · <texto>`, con k su lugar en la
 * lista de la posición (los propios primero, como encaje.lista) y el texto
 * lo que dice su posición 0. Los anclados en la raíz van al final, sin
 * sangría. `nombres` como en leer.
 *
 * Con `camino` (un camino de índices no vacío), solo la posición en ese
 * camino: su línea, lo de debajo y sus ocupantes anclados (la vista
 * Clasificar, para la posición en foco).
 */
export function leerEvento(eje, id, { epoca = EPOCA_0, nombres, camino: enfoque = [] } = {}) {
  const ev = eje.obtener(id);
  if (!ev) throw new Error('registro desconocido: ' + id);
  const anclados = new Map();
  const caminos = new Map();
  for (const h of eje.sobre(id)) {
    const camino = indicesDe(h.en ?? RAIZ);
    caminos.set(clave(camino), camino);
  }
  for (const [k, camino] of caminos) {
    const escritos = ocupantes(eje, id, camino, { orden: 'llegada', exacto: true, epoca }).filter((o) => o.tipo === 'escrito');
    const base = propiosEn(ev.payload, camino);
    anclados.set(k, escritos.map((o, j) => ({ k: base + j + 1, autor: o.autor, texto: resumen(o.contenido, nombres, true) })));
  }
  const ctx = contexto({ epoca, eje, nombres, anclados, desdeRaiz: true });
  const cabecera = nombreDeId(ev.id, nombres) + ' · ' + ev.autor + ' · ' + ev.t
    + (ev.sobre ? ' · sobre ' + nombreDeId(ev.sobre, nombres) + ' en ' + (ev.en ?? RAIZ) : ' · génesis');
  if (enfoque.length) {
    const padre = enfoque.slice(0, -1);
    const cuerpo = [];
    lineasBajo(nodoEn(ev.payload, padre), padre, padre.length, 0, ctx, cuerpo, padre.length === 0, enfoque[enfoque.length - 1]);
    return [cabecera + ' · posición ' + enfoque.join('.'), ...(cuerpo.length ? cuerpo : ['(posición vacía)'])].join('\n');
  }
  const cuerpo = lineas(ev.payload, ctx);
  lineasAnclados([], 0, ctx, cuerpo);
  return [cabecera, ...cuerpo].join('\n');
}
