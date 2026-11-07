// La X animada (mapa §12 [D], orden de los mundos: tras la cruz, la X): la
// fábrica 4 como confluencia de 7 y 9, la ciudad 1, el jardín 2, el parque 3
// y la lente 0. Este módulo reúne los cinco mundos para la vista «X» y para
// las celdas 1–4 y 0 de Mapped. Sobrio y animado son dos renders de la misma
// lectura (mapa §10.3 [D]): datosX() lee el eje una vez y los dos la pintan.
// Funciones puras: sin DOM.

import { ORDEN_X, escapar, nombreMundo } from './comun.js';
import { datosFabrica, svgFabrica, lineasFabrica } from './fabrica.js';
import { datosCiudad, svgCiudad, lineasCiudad } from './ciudad.js';
import { datosJardin, svgJardin, lineasJardin } from './jardin.js';
import { datosParque, svgParque, lineasParque } from './parque.js';
import { datosLente, svgLente, lineasLente, marcoHTML } from './lente.js';

export { ORDEN_X, memoria } from './comun.js';

/** Los cinco mundos de la X, por PV: cómo se leen, cómo se pintan y qué dice su leyenda. */
export const MUNDOS = Object.freeze({
  4: Object.freeze({ datos: datosFabrica, svg: svgFabrica, lineas: lineasFabrica, leyenda: ['puesto: la matriz de 100 del foco', 'pieza: celda modificada i.j.k (forma = clase)', 'caja: consolidación en su estación'] }),
  1: Object.freeze({ datos: datosCiudad, svg: svgCiudad, lineas: lineasCiudad, leyenda: ['tienda: subposición de 1', 'vía: serie de E (cerrada: su emisor sin saldo)', 'mercancía: E de → a'] }),
  2: Object.freeze({ datos: datosJardin, svg: svgJardin, lineas: lineasJardin, leyenda: ['hierba: encaje exacto', 'arbusto: acuerdo parcial', 'flor: elegido al consolidar', 'fruto: ejecutado'] }),
  3: Object.freeze({ datos: datosParque, svg: svgParque, lineas: lineasParque, leyenda: ['piscina: grupo', 'bañera: persona', 'gota: hablar · onda: escuchar', 'paquete: lleva tokens'] }),
  0: Object.freeze({ datos: datosLente, svg: svgLente, lineas: lineasLente, leyenda: ['portada: la posición 0 del foco', 'detrás: portadas de otros', 'PV0 no promete verdad'] }),
});

/** Lee el eje para los cinco mundos de la X sobre un foco (y su camino). No escribe nada. */
export function datosX(eje, foco, { camino = [] } = {}) {
  return Object.fromEntries(ORDEN_X.map((pv) => [pv, MUNDOS[pv].datos(eje, foco, { camino })]));
}

/** El SVG de un mundo de la X: compacto para su celda de Mapped, completo para la vista X. */
export function svgMundo(pv, datos, opciones = {}) {
  const m = MUNDOS[pv];
  if (!m) throw new RangeError('la X tiene los mundos 4, 1, 2, 3 y 0: ' + pv);
  return m.svg(datos, opciones);
}

/** La vista «X» animada: los cinco mundos en su orden, cada uno con su leyenda; el HTML de la lente aparte. */
export function htmlX(datos, { nuevos = new Set() } = {}) {
  const figuras = ORDEN_X.map((pv) => {
    const m = MUNDOS[pv];
    const extra = pv === 0 ? marcoHTML(datos[0]) : '';
    return `<figure class="x-mundo" data-pv="${pv}"><figcaption class="x-cabeza"><b>${pv}</b> ${escapar(nombreMundo(pv))}</figcaption>`
      + m.svg(datos[pv], { compacto: false, nuevos }) + extra
      + `<div class="x-leyenda">${m.leyenda.map((t) => `<span>${escapar(t)}</span>`).join('')}</div></figure>`;
  }).join('');
  return `<section class="x-vista">${figuras}<button class="x-reproducir" data-reproducir title="vuelve a contar como nuevo todo el eje: cada registro llega en su orden real a los cinco mundos">reproducir la llegada</button></section>`;
}

/** La vista «X» sobria: la misma lectura, en listas. */
export function sobrioX(datos) {
  return `<section class="x-sobrio">${ORDEN_X.map((pv) => `<div class="x-bloque"><div class="x-cabeza"><b>${pv}</b> ${escapar(nombreMundo(pv))}</div><ul>${MUNDOS[pv].lineas(datos[pv]).map((l) => `<li>${escapar(l)}</li>`).join('')}</ul></div>`).join('')}</section>`;
}
