// «Leído»: la lectura humana de un registro (src/lectura.js) en un <pre>,
// detrás de un conmutador discreto (VG, 8-11: «es muy difícil de leer para
// una persona, incluido para mí»). En Pointed enseña el registro en foco
// entero; en Clasificar, la posición en foco. El texto envuelve sus líneas
// (sin scroll horizontal a 400 px). Abierto o cerrado se recuerda solo en
// este navegador, como comodidad. Sin librerías.

import { leerEvento } from '../src/lectura.js';
import { escapar, leerLocal, guardarLocal } from './comun.js';

const CLAVE_LEIDO = 'agram.leido';
let abierto = leerLocal(CLAVE_LEIDO) === 'si';

/** Si el leído está abierto. */
export function leidoAbierto() {
  return abierto;
}

/** Abre o cierra el leído (sin argumento, alterna). */
export function alternarLeido(valor = !abierto) {
  abierto = Boolean(valor);
  guardarLocal(CLAVE_LEIDO, abierto ? 'si' : 'no');
  return abierto;
}

/**
 * HTML del conmutador «leído» y, si está abierto, del <pre> con la lectura
 * del registro `id` (leerEvento) o, con `camino`, de su posición en ese
 * camino. `id` del <pre> para aria-controls: `donde` lo distingue entre
 * vistas.
 */
export function htmlLeido(eje, id, { epoca, camino = [], abierto: ver = abierto, donde = 'foco', nombres } = {}) {
  const idPre = 'leido-' + donde;
  const que = camino.length ? 'la posición ' + camino.join('.') : 'el registro';
  const boton = `<button type="button" class="leido-boton" data-leido aria-pressed="${ver}" aria-expanded="${ver}" aria-controls="${idPre}" title="${ver ? 'ocultar' : 'ver'} ${que} como texto, una línea por posición">leído</button>`;
  if (!ver) return `<div class="leido">${boton}</div>`;
  let texto;
  try {
    texto = leerEvento(eje, id, { epoca, camino, nombres });
  } catch (e) {
    texto = 'no se puede leer: ' + (e.message ?? e);
  }
  return `<div class="leido">${boton}<pre id="${idPre}" class="leido-texto" tabindex="0" aria-label="${escapar(que)} leído">${escapar(texto)}</pre></div>`;
}

/** Engancha el conmutador: alterna y repinta. */
export function instalarLeido({ pintar }) {
  document.addEventListener('click', (e) => {
    const b = e.target.closest?.('[data-leido]');
    if (!b) return;
    alternarLeido();
    pintar();
  });
}
