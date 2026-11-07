// La cruz en la app: el cielo del 8, el camino del 9 y la cruz entera con el
// 5 en el centro. mundos/cielo.js, camino.js y cruz.js dibujan; aquí solo se
// engancha, como en mundos/hilos-ui.js: app.js llama una vez a
// instalarCruz() y, después de pintar y de trasPintarHilos(), a
// trasPintarCruz().
// - Los mundos entran con Mapped (mapa §10.2 [A]), como los hilos: la cruz
//   no es un modo.
// - En animado, las celdas 8 y 9 de Mapped llevan el cielo y la senda encima
//   de su contenido sobrio, que se queda. El cielo de la celda pasa de
//   cohorte con su botón; tocar una piedra de la senda abre su
//   previsualización en la cruz.
// - «ver la cruz» (celdas 8 y 9, en los dos renders) abre debajo de la
//   matriz la cruz entera: el cielo arriba, los hilos 6 y 7 a los lados del
//   5, el camino abajo; en sobrio, las listas, la tabla de medidas y los
//   pasos; en animado, los dibujos encima de lo mismo.
// - Una sola verdad del render: el botón «animado», que lleva hilos-ui.js.
//   trasPintarHilos() pone al día su aria-pressed justo antes de
//   trasPintarCruz(), que lo lee.
// - Lo nuevo se anima una vez, con su propia memoria (hilos.memoria): los
//   cuatro brazos ven lo mismo que los hilos de las celdas 6 y 7.
// - Una previsualización vale para el eje sobre el que se hizo: si se
//   escribe algo (desde cualquier modo, la fábrica o la propia cruz), cambia
//   el foco, el camino o quien mira, se descarta.
//
// [X] decidir VG: cómo se entra en la cruz. Como los hilos (hilos-ui.js):
// entra con Mapped, desde las celdas 8 y 9, y se abre bajo la matriz.
// Pointed y Sequenced no la dibujan todavía.

import * as motor from '../src/motor.js';
import { ejeTemporal } from '../src/tiempo.js';
import { datosHilos, svgHilos, memoria } from './hilos.js';
import * as cielo from './cielo.js';
import * as camino from './camino.js';
import { htmlCentro, htmlCruz, lenteDe } from './cruz.js';

function escapar(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Estado de la cruz en la app: si está abierta, la cohorte del cielo, la que se deja, la previsualización y qué eventos ya se vieron. */
export function crearUi() {
  return { vista: false, cohorte: 'hermanos', cieloAnterior: null, previa: null, memoria: memoria() };
}

/** Sobre qué se hizo una previsualización: el eje (y cuántos registros tenía), el foco, el camino y quien miraba. */
export function marcaDe(estado) {
  return { eje: estado.eje, n: estado.eje.orden.length, foco: estado.foco, camino: (estado.camino ?? []).join('.'), identidad: estado.identidad };
}

/** La previsualización guardada si sigue valiendo para lo que se mira; si no, se descarta (null). */
export function previaVigente(ui, estado) {
  const m = ui.previa?.marca;
  if (!m) { ui.previa = null; return null; }
  const ahora = marcaDe(estado);
  if (m.eje !== ahora.eje || m.n !== ahora.n || m.foco !== ahora.foco || m.camino !== ahora.camino || m.identidad !== ahora.identidad) ui.previa = null;
  return ui.previa;
}

/** Lo que el camino lee desde quien mira. */
export function datosCaminoDe(estado) {
  return camino.datosCamino(estado.eje, estado.foco, { camino: estado.camino ?? [], identidad: estado.identidad });
}

const chipSimple = (x) => `<button class="chip" data-ir="${escapar(x.id)}"><b>${escapar(String(x.id).slice(0, 8))}</b> <small>${escapar(x.banda)}</small></button>`;

const botonCruz = (abierta) => `<button class="ver-hilos" data-cruz-vista aria-expanded="${abierta}">${abierta ? 'cerrar la cruz' : 'ver la cruz'}</button>`;

/**
 * Lo que se pone en la página, como texto (sin DOM): lo de las celdas 8 y 9
 * de Mapped y, si está abierta, la cruz entera. null fuera de Mapped. En
 * animado, cada llamada cuenta como una mirada (memoria): lo nuevo se anima
 * una vez; la recomposición del cielo (al cambiar de cohorte) también.
 *   animado: el render del botón «animado».
 *   chip(x): cómo se pinta un registro del eje temporal en las listas del sobrio (app.js da el suyo).
 *   mensajes(): avisos y éxitos de la app, encima de la cruz.
 */
export function piezasCruz(estado, ui, { animado = false, ahora, chip = chipSimple, mensajes = () => '' } = {}) {
  if (estado.modo !== 'mapped' || !estado.eje || !estado.foco) return null;
  const caminoFoco = estado.camino ?? [];
  const previa = previaVigente(ui, estado);
  const nuevos = animado ? ui.memoria.nuevos(estado.eje) : new Set();
  const anterior = animado ? ui.cieloAnterior : null;
  ui.cieloAnterior = null;
  const dCielo = cielo.datosCielo(estado.eje, estado.foco, { cohorte: ui.cohorte });
  const dCamino = datosCaminoDe(estado);
  const boton = botonCruz(ui.vista);
  let celda8 = boton;
  let celda9 = boton;
  let hilos = null;
  if (animado) {
    const siguiente = cielo.COHORTES[(cielo.COHORTES.indexOf(ui.cohorte) + 1) % cielo.COHORTES.length];
    const nota = `<div class="nota-celda">${escapar(ui.cohorte)}${dCielo.estado !== 'RESUELTO' ? ' · sin cohorte' : dCielo.escrita ? '' : ' · sin escribir'}</div>`;
    celda8 = nota + cielo.svgCielo(dCielo, { compacto: true, anterior, nuevos })
      + `<div class="botones-celda"><button class="ver-hilos" data-cohorte="${siguiente}" title="cohorte: ${cielo.COHORTES.join(', ')}">→ ${siguiente}</button>${boton}</div>`;
    celda9 = `<div class="nota-celda">${dCamino.pasos.length} paso${dCamino.pasos.length === 1 ? '' : 's'} hacia la acción</div>`
      + camino.svgCamino(dCamino, { compacto: true, nuevos, previsto: previa?.clave ?? null }) + boton;
    hilos = datosHilos(estado.eje, estado.foco, { camino: caminoFoco, ...(ahora ? { ahora } : {}) });
  }
  let vista = null;
  if (ui.vista) {
    const ev = estado.eje.obtener(estado.foco);
    const lista = (l, vacio) => `<div class="chips">${l.length ? l.map(chip).join('') : `<span class="nada">${vacio}</span>`}</div>`;
    const e = animado ? null : ejeTemporal(estado.eje, estado.foco, { camino: caminoFoco });
    const partes = {
      c8: animado ? cielo.htmlCielo(dCielo, { anterior, nuevos }) : cielo.htmlCieloSobrio(dCielo),
      c6: animado ? svgHilos(hilos, { ventana: 'pasado', compacto: true, nuevos }) : lista(e.pasado, 'génesis'),
      c5: htmlCentro(ev, { lente: lenteDe(ev, caminoFoco), existe: (id) => Boolean(estado.eje.obtener(id)) }),
      c7: animado ? svgHilos(hilos, { ventana: 'futuro', compacto: true, nuevos }) : lista(e.futuro, 'nada proyectado'),
      c9: camino.htmlCamino(dCamino, { animado, nuevos, previa, identidades: estado.eje.identidades() }),
    };
    vista = `<section class="cruz-completa" aria-label="La cruz del foco: cielo 8, hilos 6 y 7, el 5 en el centro y camino 9">`
      + `<div class="cruz-cab"><span class="pista">La cruz del foco · render ${animado ? 'animado' : 'sobrio'} · el 5 en el centro; cielo, hilos y camino leen el mismo eje</span>${botonCruz(true)}</div>`
      + mensajes() + htmlCruz(partes) + '</section>';
  }
  return { celda8, celda9, vista };
}

// ---------- en el navegador ----------

const ui = crearUi();
let app = null;

/** El render elegido: el del botón «animado» (mundos/hilos-ui.js), que trasPintarHilos() acaba de poner al día. */
function animadoAhora() {
  return document.querySelector('button[data-render]')?.getAttribute('aria-pressed') === 'true';
}

function cambiarCohorte(cohorte) {
  const { estado } = app;
  if (cohorte === ui.cohorte || !cielo.COHORTES.includes(cohorte)) return;
  try { ui.cieloAnterior = cielo.datosCielo(estado.eje, estado.foco, { cohorte: ui.cohorte }); } catch { ui.cieloAnterior = null; }
  ui.cohorte = cohorte;
  app.pintar();
}

/** Previsualiza un paso: la operación real sobre una copia del eje (camino.previsualizar); no escribe. Abre la cruz en ese paso. */
async function previsualizarPaso(clave) {
  const { estado } = app;
  if (previaVigente(ui, estado)?.clave === clave && ui.vista) { ui.previa = null; app.pintar(); return; }
  try {
    const p = await camino.previsualizar(estado.eje, datosCaminoDe(estado), clave, { identidad: estado.identidad, privadaDe: app.privadaDe });
    ui.previa = { ...p, marca: marcaDe(estado) };
    estado.aviso = '';
  } catch (e) {
    ui.previa = null;
    estado.aviso = String(e.message ?? e);
  }
  estado.exito = '';
  ui.vista = true;
  app.pintar();
  document.querySelector(`.cruz-completa .paso-c[data-clave="${CSS.escape(clave)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

/** Consolida lo que propone el camino (motor.proponer), como quien mira: lo mismo que enseña su previsualización. */
async function consolidarPropuesta() {
  const { estado } = app;
  try {
    const { elecciones } = motor.proponer(estado.eje, estado.foco, { camino: estado.camino });
    const titulo = camino.tituloPropuesta(estado.eje, estado.foco, estado.camino);
    const c = await motor.consolidar(estado.eje, { autor: estado.identidad, foco: estado.foco, camino: estado.camino, elecciones, titulo }, app.privadaDe(estado.identidad));
    app.guardar();
    estado.aviso = '';
    estado.exito = 'Consolidado ' + c.id.slice(0, 8) + ' desde la propuesta del camino · ' + motor.estadoDe(estado.eje, c.id).toLowerCase() + '. Autoriza quien tiene poder y no es el autor.';
    app.pintar();
  } catch (e) { app.fallo(e); }
}

/**
 * Una vez, al cargar: «ver la cruz», el cambio de cohorte, previsualizar,
 * consolidar la propuesta y las piedras de la senda que llevan a su
 * registro. Los demás botones (autorizar, ejecutar, escribir aquí, los
 * enlaces) los atiende app.js.
 *   deps: { estado, pintar, irA, privadaDe, guardar, fallo, chip, mensajes } de app.js.
 */
export function instalarCruz(deps) {
  app = deps;
  if (typeof document === 'undefined') return;
  document.addEventListener('click', (e) => {
    const b = e.target.closest?.('button[data-cruz-vista], button[data-cohorte], [data-previsualizar], button[data-consolidar-propuesta], svg.camino [data-ir]');
    if (!b) return;
    if (b.dataset.cruzVista !== undefined) { ui.vista = !ui.vista; app.pintar(); }
    else if (b.dataset.cohorte) cambiarCohorte(b.dataset.cohorte);
    else if (b.dataset.previsualizar) previsualizarPaso(b.dataset.previsualizar);
    else if (b.dataset.consolidarPropuesta !== undefined) consolidarPropuesta();
    else if (b.dataset.ir) app.irA(b.dataset.ir);
  });
}

/** Después de cada pintado (y de trasPintarHilos): lo de las celdas 8 y 9 y, si está abierta, la cruz debajo de la matriz. */
export function trasPintarCruz(estado) {
  if (typeof document === 'undefined' || !app) return;
  const animado = animadoAhora();
  const p = piezasCruz(estado, ui, { animado, chip: app.chip, mensajes: app.mensajes });
  if (!p) return;
  const donde = animado ? 'afterend' : null;
  for (const [pv, html] of [[8, p.celda8], [9, p.celda9]]) {
    if (donde) document.querySelector(`.matriz .celda.c${pv} .pvn`)?.insertAdjacentHTML(donde, html);
    else document.querySelector(`.matriz .celda.c${pv}`)?.insertAdjacentHTML('beforeend', html);
  }
  if (p.vista) (document.querySelector('.hilos-completo') ?? document.querySelector('.matriz'))?.insertAdjacentHTML('afterend', p.vista);
}
