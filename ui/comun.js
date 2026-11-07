// Piezas comunes del frontend sobrio (ui/): escapar texto, acortar ids y
// direcciones, leer y guardar comodidades del visor en el navegador, y la
// franja de ajustes (ejemplo, época) bajo los botones de modo. Nada de esto
// toca el núcleo: solo lo enseña.

import { indicesDe } from '../src/btml.js';

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
