// Pointed: una décupla a la vez. La décupla es el payload del registro en foco
// desarrollado en sus diez posiciones. Sobrio y animado son dos renders de la
// misma décupla; aquí solo existe el sobrio.
//
// Lo leído se cuenta por lo que hay (VG, 7-11 noche, decisión 10.1): la
// décupla consigue sus posiciones con contenido (modos.contenido), no diez.
// Y Pointed corta duro en su máximo, 10 (decisión 10.2): si el payload trae
// más contenido (una lista larga, posiciones con subposiciones), entran sus
// diez primeras posiciones con contenido por índice (modos.recortar) y el
// aviso lo dice: «Trae X de Y posiciones».

import { ARIDAD, esReferencia, esLista } from './btml.js';
import { EPOCA_0, epocaDe, nombreEnNodo } from './epocas.js';
import { alcanceDe, maximo, recortar, avisoCorte } from './modos.js';

/** La décupla de un payload, sin cortar ni contar: la comparten decupla y decuplaEntera. */
function armar(ev, p, e, profundidad) {
  const posiciones = [];
  for (let i = 0; i < ARIDAD; i++) {
    // Un array es la décupla (regla corta por profundidad); una lista explícita, sus ocupantes por llegada (VG, 7-11 noche).
    posiciones.push({ indice: i, ...nombreEnNodo(p, profundidad, i, e), contenido: Array.isArray(p) ? p[i] : undefined });
  }
  const lista = profundidad > 0 && esLista(p) ? p : undefined;
  return { id: ev.id, autor: ev.autor, t: ev.t, sobre: ev.sobre, en: ev.en, terminal: Array.isArray(p) ? undefined : p, ...(lista ? { lista } : {}), posiciones };
}

/**
 * Décupla de un evento: diez posiciones { indice, significado, contenido }.
 * Una décupla (la raíz, o bajo una posición un array con algún array) lleva
 * en cada índice la regla corta de la profundidad. Por hojas (VG, 7-11
 * noche): bajo una posición (profundidad ≥ 1), un array solo de hojas es una
 * lista y se pinta como lista: sus elementos llevan `ocupante` (su lugar por
 * llegada) y significado 'ocupante k', y `lista` trae los elementos que
 * entran. Lo no desarrollado queda sin contenido (undefined). Un terminal no
 * tiene posición 0 (MAPA §12: se retira la convención de la
 * representación): un payload terminal no se reparte en posiciones y va
 * aparte, en `terminal`. La época va por objeto o por nombre ('época 0'),
 * como en leerDireccion.
 * `alcance` da los tres números del modo (VG, 7-11 noche): lo conseguido
 * (las posiciones con contenido que trae: un terminal, una; cada ocupante de
 * una lista, uno), el mínimo (1) y el máximo (10).
 * Corte duro (decisión 10.2): con más de diez posiciones con contenido,
 * entran las diez primeras por índice (modos.recortar); las posiciones que
 * pierden algo llevan `cortada: true` (su `contenido` es lo que entra, o
 * undefined si no entra nada), `corte` dice { maximo, conseguido,
 * necesario, cortadas } y `avisos[0]`, «… Trae X de Y posiciones.». Sin
 * corte, `corte` es null y `avisos`, [].
 */
export function decupla(ev, epoca = EPOCA_0, profundidad = 0) {
  const e = epocaDe(epoca);
  const max = maximo('pointed');
  const r = recortar(ev.payload, max);
  const d = armar(ev, r.payload, e, profundidad);
  let corte = null;
  const avisos = [];
  if (r.cortado) {
    const original = ev.payload;
    const cortadas = [];
    for (const pos of d.posiciones) {
      const antes = Array.isArray(original) ? original[pos.indice] : undefined;
      if (antes !== pos.contenido) {
        pos.cortada = true;
        cortadas.push(pos.indice);
      }
    }
    corte = { maximo: max, conseguido: r.conseguido, necesario: r.necesario, cortadas };
    const detalle = 'entran sus ' + max + ' primeras posiciones con contenido, por índice; ' + (cortadas.length
      ? (cortadas.length === 1 ? 'queda cortada la ' : 'quedan cortadas las ') + cortadas.join(', ')
      : 'la lista trae ' + r.necesario + ' ocupantes y entran los ' + max + ' primeros por llegada'); // sin posición cortada: una lista de más de diez
    avisos.push(avisoCorte('pointed', r.conseguido, r.necesario, detalle));
  }
  return { ...d, alcance: alcanceDe(r.conseguido, 'pointed'), corte, avisos };
}

/**
 * La décupla entera de un registro que otro modo ya ha admitido (Sequenced):
 * sin corte ni cifras. El corte, las cifras y el aviso son del modo que la
 * trae, que cuenta el contenido del registro entero contra su propio máximo.
 */
export function decuplaEntera(ev, epoca = EPOCA_0, profundidad = 0) {
  return armar(ev, ev.payload, epocaDe(epoca), profundidad);
}

function textoDe(contenido) {
  if (contenido === undefined) return '—';
  // Bajo la raíz, un array solo de hojas es una lista (por hojas); con algún array, una décupla.
  if (esLista(contenido)) return 'lista de ' + contenido.length + ': ' + contenido.map(textoDe).join(' · ');
  if (Array.isArray(contenido)) return '[' + contenido.length + ' posiciones]';
  if (esReferencia(contenido)) return '→ ' + contenido.ref.slice(0, 8) + (contenido.dir ? ':' + contenido.dir : '');
  return String(contenido);
}

/**
 * Render sobrio: una línea por posición; si el payload es un terminal, va en
 * su propia línea antes de las posiciones; si es una lista, una línea que lo
 * dice y, si pasa de diez, los ocupantes que no caben en las diez líneas.
 * Una posición cortada lo dice al final de su línea, y el aviso de corte va
 * arriba y abajo.
 */
export function sobrio(d) {
  const cab = d.id.slice(0, 8) + ' · ' + d.autor + ' · ' + d.t;
  const terminal = d.terminal === undefined ? [] : ['terminal ' + textoDe(d.terminal)];
  if (d.lista) terminal.push('lista de ' + d.lista.length + ' ocupantes, por llegada' + (d.lista.length > ARIDAD ? ' (y ' + d.lista.slice(ARIDAD).map(textoDe).join(' · ') + ')' : ''));
  const lineas = d.posiciones.map((pos) => pos.indice + ' ' + pos.significado.padEnd(15) + ' ' + textoDe(pos.contenido) + (pos.cortada ? ' (cortada)' : ''));
  const avisos = (d.avisos ?? []).map((a) => 'aviso: ' + a);
  return [cab, ...avisos, ...terminal, ...lineas, ...avisos].join('\n');
}

export const RENDERS = Object.freeze({ sobrio });

/** Render por nombre. El animado aún no existe: se dice, no se simula. */
export function render(d, nombre = 'sobrio') {
  const r = RENDERS[nombre];
  if (!r) throw new Error('render no disponible: ' + nombre);
  return r(d);
}
