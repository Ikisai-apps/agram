// La X en la app. mundos/x.js dibuja; aquí solo se engancha, como los hilos
// (mundos/hilos-ui.js) y los módulos de ui/: app.js llama una vez a
// instalarX() y, después de pintar (y de trasPintarCruz), a trasPintarX().
// - El render (sobrio o animado) es el de los hilos: un solo botón «animado»
//   para los dos (renderActual de mundos/hilos-ui.js).
// - En animado, las celdas 1–4 de Mapped llevan su mundo encima de su
//   contenido (fábrica 4, ciudad 1, jardín 2, parque 3) y la del centro, la
//   lente 0 en lugar del texto de la portada. El dibujo es una imagen
//   (role="img"): la celda sigue siendo el botón del sobrio (escribir aquí,
//   entrar o ir), con el teclado y con el dedo.
// - «ver la X», en la celda del centro, abre debajo de la matriz la vista
//   completa: los cinco mundos con su leyenda, «reproducir la llegada» y la
//   misma lectura en sobrio. En la vista, los elementos del SVG que llevan
//   data-ir llevan a su registro.
//
// [X] decidir VG: cómo se entra en un mundo (como en los hilos: entran con
// Mapped, mapa §10.2 [A]); la X no es un modo y Pointed y Sequenced no la
// dibujan todavía.

import { datosX, svgMundo, htmlX, sobrioX, memoria } from './x.js';
import { renderActual } from './hilos-ui.js';

/** Celdas de Mapped que dibuja la X: las cuatro esquinas de la cruz y el centro (0 sobre 5). */
export const CELDAS_X = Object.freeze([4, 1, 2, 3, 0]);

/** Estado de la X en la app: si la vista completa está abierta, si se reproduce la llegada y qué eventos ya se vieron. */
export function crearUi() {
  return { vista: false, reproducir: false, memoria: memoria() };
}

/**
 * Lo que se pone en la página, como texto (sin DOM): el SVG compacto de cada
 * celda (por PV: 1–4 y 0) y, si está abierta, la vista completa. null si no
 * toca: en sobrio o fuera de Mapped. Cada llamada cuenta como una mirada
 * (memoria): lo nuevo se anima una vez; «reproducir» lo cuenta todo como
 * nuevo una sola vez.
 */
export function piezasX(estado, ui, { render = 'sobrio' } = {}) {
  if (render !== 'animado' || estado.modo !== 'mapped' || !estado.eje || !estado.foco) return null;
  const datos = datosX(estado.eje, estado.foco, { camino: estado.camino ?? [] });
  const nuevos = ui.memoria.nuevos(estado.eje, { reproducir: ui.reproducir });
  ui.reproducir = false;
  const celdas = Object.fromEntries(CELDAS_X.map((pv) => [pv, svgMundo(pv, datos[pv], { compacto: true, nuevos })]));
  const boton = `<button class="ver-x" data-x-vista aria-expanded="${ui.vista}">${ui.vista ? 'cerrar la X' : 'ver la X'}</button>`;
  const vista = ui.vista
    ? `<section class="x-completo" aria-label="La X del foco: fábrica 4, ciudad 1, jardín 2, parque 3 y lente 0">${htmlX(datos, { nuevos })}`
      + `<details class="x-en-sobrio"><summary>la misma lectura en sobrio</summary>${sobrioX(datos)}</details></section>`
    : null;
  return { celdas, boton, vista };
}

const ui = crearUi();

/** Una vez, al cargar: «ver la X», «reproducir la llegada» y los elementos del SVG con data-ir en la vista. */
export function instalarX({ pintar, irA }) {
  if (typeof document === 'undefined') return;
  document.addEventListener('click', (e) => {
    const b = e.target.closest?.('button[data-x-vista], button[data-reproducir], .x-completo svg [data-ir]');
    if (!b) return;
    if (b.dataset.xVista !== undefined) { ui.vista = !ui.vista; pintar(); }
    else if (b.dataset.reproducir !== undefined) { ui.reproducir = true; pintar(); }
    else irA(b.dataset.ir);
  });
}

/** Después de cada pintado (y después de los hilos): en animado, la X en las celdas 1–4 y 0 de Mapped y la vista completa. */
export function trasPintarX(estado) {
  if (typeof document === 'undefined') return;
  const p = piezasX(estado, ui, { render: renderActual() });
  if (!p) return;
  for (const pv of [1, 2, 3, 4]) {
    const celda = document.querySelector(`.matriz .celda.c${pv}`);
    if (!celda) continue;
    celda.classList.add('x-celda');
    celda.querySelector('.pvn')?.insertAdjacentHTML('afterend', p.celdas[pv]);
  }
  const centro = document.querySelector('.matriz .celda.c5');
  if (centro) {
    centro.classList.add('x-celda');
    const lente = centro.querySelector('.lente');
    if (lente) lente.outerHTML = p.celdas[0] + p.boton;
    else centro.querySelector('.pvn')?.insertAdjacentHTML('afterend', p.celdas[0] + p.boton);
  }
  // Debajo de la matriz y, si están abiertas, de los hilos y de la cruz (mundos/cruz-ui.js), que pintan antes.
  if (p.vista) (document.querySelector('.cruz-completa') ?? document.querySelector('.hilos-completo') ?? document.querySelector('.matriz'))?.insertAdjacentHTML('afterend', p.vista);
}
