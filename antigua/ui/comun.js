// Piezas comunes del frontend sobrio (ui/): escapar texto, acortar ids y
// direcciones, leer y guardar comodidades del visor en el navegador, y la
// franja de ajustes (ejemplo, época) bajo los botones de modo. Nada de esto
// toca el núcleo: solo lo enseña.

import { indicesDe } from '../../src/btml.js';
import { recomendacionDeEscala } from '../../src/tiempo.js';

export function escapar(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

export function corto(id) {
  return String(id ?? '').slice(0, 8);
}

/** Dirección legible: los dígitos con sentido separados por puntos ('1200000000' → '1.2'); la de todo ceros es la raíz. */
export function dirCorta(dir) {
  try {
    const i = indicesDe(dir);
    return i.length ? i.join('.') : 'raíz';
  } catch {
    return String(dir ?? '—');
  }
}

/** Camino exacto de índices ([1, 0] → '1.0'); el vacío es la raíz del registro. */
export function caminoCorto(camino) {
  return camino && camino.length ? camino.join('.') : 'raíz';
}

/** Vector de diferencias en corto: solo las profundidades que no coinciden ('+2 en 4 · −1 en 5'); vacío si es exacto. */
export function vectorCorto(v) {
  if (!Array.isArray(v)) return '';
  return v.map((x, k) => (x === 0 ? '' : (x > 0 ? '+' + x : '−' + -x) + ' en ' + k)).filter(Boolean).join(' · ');
}

/** localStorage como comodidad del visor: puede no existir o fallar, y entonces no pasa nada. */
export function leerLocal(clave) {
  try {
    return globalThis.localStorage?.getItem(clave) ?? null;
  } catch {
    return null;
  }
}

export function guardarLocal(clave, valor) {
  try {
    globalThis.localStorage?.setItem(clave, valor);
    return true;
  } catch {
    return false;
  }
}

/** La franja de ajustes, bajo los botones de modo; se crea la primera vez que alguien la pide. */
export function franjaAjustes() {
  let franja = document.querySelector('.ajustes');
  if (franja) return franja;
  franja = document.createElement('div');
  franja.className = 'ajustes';
  const modos = document.querySelector('.modos');
  if (modos) modos.after(franja);
  else document.querySelector('main')?.prepend(franja);
  return franja;
}

/**
 * Los tres números de un modo en una lectura (VG, 7-11 noche), en corto:
 * lo conseguido, el mínimo que intenta y el máximo, en posiciones:
 * «7 · mín 10 · máx 100». Be no tiene mínimo propio (VG, 7-11 noche:
 * responde exactamente lo que se le pide): dice lo pedido, «pedido 5», y su
 * máximo sin tope, «máx todos».
 */
export function textoCifras(alcance) {
  const { conseguido, minimo, maximo } = alcance;
  const abajo = 'pedido' in alcance ? 'pedido ' + alcance.pedido : 'mín ' + (minimo === null ? 'sin fijar' : minimo);
  return conseguido + ' · ' + abajo + ' · máx ' + (maximo === Infinity ? 'todos' : maximo);
}

/** Las tres cifras junto al nombre del modo, discretas: «Sequenced · 7 · mín 10 · máx 100». */
export function htmlCifras(nombre, alcance) {
  const bajo = alcance.alMinimo === false ? ' bajo' : '';
  const titulo = 'posiciones con contenido: las que trae esta vista · el mínimo que intenta el modo · el máximo que puede representar y emitir'
    + (alcance.alMinimo === false ? ' (no llega al mínimo: no hay más información)' : '');
  return `<span class="cifras${bajo}" title="${escapar(titulo)}">${escapar(nombre)} · ${escapar(textoCifras(alcance))}</span>`;
}

/**
 * La recomendación de escala de T de un registro recién escrito (VG, 8-11:
 * si lo emitido se sale del orden de la escala gastada, se recomienda la de
 * orden superior; nunca se rechaza): una línea discreta, o nada.
 */
export function htmlRecomendacionT(ev) {
  const r = recomendacionDeEscala(ev);
  return r ? `<div class="pista recomendacion-t">${escapar(r.texto[0].toUpperCase() + r.texto.slice(1))}.</div>` : '';
}

/**
 * Los avisos de corte de una vista (VG, 7-11 noche, decisión 10.2: todos
 * cortan duro con el aviso de Scened, «Trae X de Y posiciones»), como en
 * Scened: la vista los pone arriba y abajo de lo que trae. Sin avisos, nada.
 */
export function htmlAvisos(avisos) {
  return (avisos ?? []).map((a) => `<div class="aviso">${escapar(a)}</div>`).join('');
}
