// Los hilos en la app. mundos/hilos.js dibuja; aquí solo se engancha, como
// los módulos de ui/: app.js llama una vez a instalarHilos() y, después de
// pintar, a trasPintarHilos().
// - El botón «animado» alterna los dos renders de la misma lectura: sobrio
//   (las listas de siempre) y animado.
// - En animado, las celdas 6 y 7 de Mapped llevan el dibujo encima de sus
//   botones. El dibujo es una imagen (role="img"): se navega con los botones
//   del sobrio, que se quedan, con el teclado y con el dedo.
// - «ver los hilos» abre debajo de la matriz la vista completa, con las
//   carteras y lo nuevo en sobrio.
//
// [X] decidir VG: cómo se entra en un mundo. Los hilos no son un modo: entran
// con Mapped (mapa §10.2 [A]: «los mundos entran con Mapped»), aquí desde las
// celdas 6 y 7, y la vista completa se abre bajo la matriz. Pointed y
// Sequenced, que «muestran la misma pieza a escala pequeña», no la dibujan
// todavía.

import { datosHilos, svgHilos, htmlHilos, memoria } from './hilos.js';

/** Estado de los hilos en la app: el render elegido, si la vista completa está abierta y qué eventos ya se vieron. */
export function crearUi() {
  return { render: 'sobrio', vista: false, memoria: memoria() };
}

/**
 * Lo que se pone en la página, como texto (sin DOM): el dibujo de las celdas
 * 6 y 7 y, si está abierta, la vista completa. null si no toca: en sobrio o
 * fuera de Mapped. Cada llamada cuenta como una mirada (memoria): lo nuevo se
 * anima una vez.
 */
export function piezasHilos(estado, ui, { ahora } = {}) {
  if (ui.render !== 'animado' || estado.modo !== 'mapped' || !estado.eje || !estado.foco) return null;
  const datos = datosHilos(estado.eje, estado.foco, { camino: estado.camino ?? [], ...(ahora ? { ahora } : {}) });
  const nuevos = ui.memoria.nuevos(estado.eje);
  const boton = `<button class="ver-hilos" data-hilos-vista aria-expanded="${ui.vista}">${ui.vista ? 'cerrar los hilos' : 'ver los hilos'}</button>`;
  return {
    celda6: svgHilos(datos, { ventana: 'pasado', compacto: true, nuevos }) + boton,
    celda7: svgHilos(datos, { ventana: 'futuro', compacto: true, nuevos }) + boton,
    vista: ui.vista ? `<section class="hilos-completo" aria-label="Hilos del foco: 6 pasado y 7 futuro">${htmlHilos(datos, { nuevos })}</section>` : null,
  };
}

const ui = crearUi();

/** Una vez, al cargar: los botones «animado» y «ver los hilos». Los demás botones siguen en app.js. */
export function instalarHilos({ pintar }) {
  if (typeof document === 'undefined') return;
  document.addEventListener('click', (e) => {
    const b = e.target.closest?.('button[data-render], button[data-hilos-vista]');
    if (!b) return;
    if (b.dataset.render !== undefined) ui.render = ui.render === 'animado' ? 'sobrio' : 'animado';
    else ui.vista = !ui.vista;
    pintar();
  });
}

/** Después de cada pintado: el estado del botón y, en animado, los hilos en las celdas 6 y 7 y la vista completa. */
export function trasPintarHilos(estado) {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('button[data-render]').forEach((b) => b.setAttribute('aria-pressed', String(ui.render === 'animado')));
  const p = piezasHilos(estado, ui);
  if (!p) return;
  document.querySelector('.matriz .celda.c6 .pvn')?.insertAdjacentHTML('afterend', p.celda6);
  document.querySelector('.matriz .celda.c7 .pvn')?.insertAdjacentHTML('afterend', p.celda7);
  if (p.vista) document.querySelector('.matriz')?.insertAdjacentHTML('afterend', p.vista);
}
