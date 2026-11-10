// El pintado de la carta: convierte el árbol de carta/carta.js en HTML. Aquí no se decide nada: cada nodo trae ya
// su etiqueta, su tamaño, su representación, sus ocupantes, su pieza, y todo texto que viene de la época llega ya en
// el idioma de quien mira (contrato.texto, contrato.legible). Solo se escribe el marcado con los atributos data-*
// que carta/gestos.js lee; los textos propios de la interfaz (botones, títulos) salen de carta/textos.js. Sobrio por
// defecto: formas y texto; en animado, las piezas con recurso van como <img> (svg, imagen) o como un contenedor
// Lottie que trasPintar() rellena con lottie-web si está cargado. El animado entero (etapa 5): cada PV lleva su
// escenario (el fondo detrás, la etapa, el personaje, los efectos superpuestos) dentro de su marco; los ocupantes, su
// elemento; nunca más de N animaciones a la vez (data-animaciones, un dato de la configuración), primero lo nuevo y
// lo enfocado; las que salen de pantalla se pausan.

import { NIVEL, LATERALES, ANIMAR, GEOMETRIA } from './carta.js';
import { t } from './textos.js';

export const escapar = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const corto = (id) => String(id ?? '').slice(0, 8);
const attr = (s) => escapar(s).replace(/'/g, '&#39;');

/**
 * Los atributos de clasificación de un elemento (para el botón «opinar», carta/opinar.js clasificar): data-nodo es el
 * tipo (carta, barra, control, foco, pv, ocupante, campo, aro, hueco, accion, camino, paso, roseton, diario,
 * formulario, configuracion, copia) y data-nodo-* lo que lo sitúa y aún no dicen los data-* de la carta (data-x,
 * data-pv, data-centro, data-roseton): x0 (el texto del 0 del registro), d (la posición de un campo), tam (oculto,
 * comprimido, tarjeta, bloque o foco), rep (la representación elegida), cara, modo, ancho, alto. Solo se escriben
 * los que hay.
 */
const NOMBRE_NIVEL = Object.freeze(Object.fromEntries(Object.entries(NIVEL).map(([k, v]) => [v, k])));
const repDe = (r) => (r ? `${r.recurso ? 'imagen' : 'texto'}${r.formato ? ':' + r.formato : ''}${r.tamano !== undefined ? '@' + r.tamano : ''}` : 'ninguna');
const nodo = (tipo, campos = {}) => ` data-nodo="${tipo}"` + Object.entries(campos).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => ` data-nodo-${k}="${attr(v)}"`).join('');

/**
 * La pieza de un modelo como HTML: en sobrio una forma (una clase), en animado un <img> o un hueco Lottie fijado en
 * su fotograma. `animar`: no (parada en su fotograma), bucle, o una vez (ANIMAR; true vale por bucle); `prioridad`
 * ordena quién se reproduce cuando hay más de las que caben (0 lo nuevo, 1 lo enfocado, 2 el resto); `clase`, el
 * papel de la pieza en el escenario (fondo, etapa, personaje, efecto, marco, elemento); `oculta`, en un efecto, que
 * al acabar oculte la pieza real a la que se superpone.
 */
export function htmlPieza(pieza, { paso, animar = false, alt = '', clase = '', prioridad = 2, oculta = false } = {}) {
  if (!pieza) return '';
  const clases = ['pieza', ...(clase ? [clase] : [])];
  if (pieza.recurso && pieza.formato) {
    const fotogramas = pieza.fotogramas ?? 0;
    const k = paso && typeof paso.k === 'number' && paso.de ? Math.min(paso.k, paso.de) : 0;
    const de = paso && paso.de ? paso.de : 10;
    const fotograma = fotogramas ? Math.round((k * fotogramas) / de) : 0;
    if (pieza.animado || pieza.bucle) {
      const modo = animar === true ? ANIMAR.bucle : animar || ANIMAR.no;
      const bucle = modo === ANIMAR.una ? 0 : modo === ANIMAR.bucle ? 1 : pieza.bucle ? 1 : 0;
      return `<div class="${clases.concat('pieza-lottie').join(' ')}" data-lottie="${attr(pieza.recurso)}" data-fotograma="${fotograma}" data-animar="${modo === ANIMAR.no ? 0 : 1}" data-bucle="${bucle}" data-prioridad="${prioridad}"${oculta ? ' data-oculta="1"' : ''} role="img" aria-label="${attr(alt || pieza.tipo)}"></div>`;
    }
    return `<img class="${clases.concat('pieza-imagen').join(' ')}" src="./${attr(pieza.recurso)}" alt="${attr(alt || pieza.tipo)}" loading="lazy" decoding="async">`;
  }
  return `<span class="${clases.concat('forma', 'forma-' + attr(pieza.forma ?? 'texto')).join(' ')}" aria-hidden="true"></span>`;
}

/**
 * El escenario de un PV en animado: el fondo detrás (solo con recurso), la etapa (la pieza grande del mundo), el
 * personaje con su acción (en bucle, una vez o parado) y, superpuestos y una sola vez, los efectos de lo nuevo. Si lo
 * nuevo consume la pieza (consumido), el efecto la oculta al acabar. Vacío si el nodo no trae etapa ni personaje.
 */
function htmlEscenario(n, { paso, etiqueta = '' } = {}) {
  if (!n.etapa?.recurso && !n.personaje && !n.fondo && !n.nuevos?.efectos?.length) return '';
  const fondo = n.fondo?.recurso ? htmlPieza(n.fondo, { clase: 'pieza-fondo', alt: '' }) : '';
  const etapa = n.etapa?.recurso ? htmlPieza(n.etapa, { clase: 'pieza-etapa', alt: etiqueta }) : '';
  const personaje = n.personaje?.pieza?.recurso
    ? htmlPieza(n.personaje.pieza, { paso, animar: n.personaje.animar, clase: 'pieza-personaje accion-' + attr(n.personaje.accion), prioridad: n.personaje.animar === ANIMAR.una ? 0 : 1, alt: n.personaje.rol ?? n.personaje.accion })
    : '';
  const efectos = (n.nuevos?.efectos ?? []).map((e) => htmlPieza(e.pieza, { animar: ANIMAR.una, clase: 'pieza-efecto efecto-' + attr(e.clave), prioridad: 0, oculta: Boolean(n.consumido), alt: e.clave })).join('');
  return `<div class="escenario${n.consumido ? ' consumido' : ''}" data-escenario>${fondo}${etapa}${personaje}${efectos}</div>`;
}

/** El marco de un PV o del centro, superpuesto al borde (solo con recurso). */
const htmlMarco = (marco) => (marco?.recurso ? htmlPieza(marco, { clase: 'pieza-marco', alt: '' }) : '');

/** Una representación del 0 como HTML: texto, o la imagen que cabe (solo llega con recurso en animado). */
function htmlRepresentacion(rep, { clase = 'rep' } = {}) {
  if (!rep) return `<span class="${clase} rep-vacia">—</span>`;
  if (rep.recurso && typeof rep.recurso === 'string') return `<img class="${clase} rep-imagen" src="./${attr(rep.recurso)}" alt="${attr(rep.texto ?? '')}" loading="lazy">`;
  return `<span class="${clase}">${escapar(rep.texto ?? '—')}</span>`;
}

/**
 * Los colores de la época como variables CSS: --pv-N (el hex) y --pv-N-rgb («r g b», para los navegadores sin
 * color-mix, que mezclan con rgb(var(--pv-N-rgb) / alfa)). Nada de hex en las hojas de estilo: salen de epoch.9.5.4.
 */
export function variablesDeColor(colores = {}) {
  const fuera = {};
  for (const [pv, hex] of Object.entries(colores)) {
    const m = /^#([0-9a-f]{6})$/i.exec(hex);
    if (!m) continue;
    fuera[`--pv-${pv}`] = hex;
    fuera[`--pv-${pv}-rgb`] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)).join(' ');
  }
  return fuera;
}

/** Un ocupante: una hoja, su texto; una referencia, un botón que entra en el registro; una décupla, sus hojas. En animado, delante, su elemento (la pieza suelta del mundo). */
function htmlOcupante(o) {
  const dentro = o.anidados?.length ? o.anidados.map((g) => `<ul class="ocupantes anidados" data-anidado="${g.pv}">${g.lista.map((x) => `<li>${htmlOcupante(x)}</li>`).join('')}</ul>`).join('') : '';
  return htmlOcupanteSolo(o) + dentro;
}

function htmlOcupanteSolo(o) {
  const elemento = o.elemento?.recurso ? htmlPieza(o.elemento, { clase: 'pieza-elemento', alt: '' }) : '';
  if (o.tipo === 'referencia' && o.X) {
    const rep = o.representacion?.recurso ? htmlRepresentacion(o.representacion, { clase: 'rep-mini' }) : elemento;
    return `<button type="button" class="ocupante ocupante-ref"${nodo('ocupante', { x0: o.texto, rep: repDe(o.representacion) })}${o.pv !== null && o.pv !== undefined ? ` data-pv="${o.pv}"` : ''} data-abrir="${o.X}" data-x="${o.X}" title="${attr(t('entrarEn', { que: o.texto }))}">${rep}<span class="texto">${escapar(o.texto)}</span>${o.autor ? `<small class="quien">${escapar(o.autor)}</small>` : ''}</button>`;
  }
  if (o.tipo === 'decupla') return `<span class="ocupante ocupante-decupla"${nodo('ocupante')}>${elemento}${o.hojas.map((h) => `<span class="hoja">${escapar(h)}</span>`).join('')}</span>`;
  return `<span class="ocupante ocupante-hoja"${nodo('ocupante')}>${elemento}${escapar(o.texto)}</span>`;
}

/** En Mapped, sin scroll: la página que se ve de un PV, con «anterior» y «siguiente» (data-pagina, data-delta). */
function htmlPagina(p, pv) {
  if (!p || p.de <= 1) return '';
  const boton = (delta, simbolo, titulo, apagado) => `<button type="button"${nodo('control')} data-pagina="${pv}" data-delta="${delta}" title="${attr(t(titulo))}" aria-label="${attr(t(titulo))}"${apagado ? ' disabled' : ''}>${simbolo}</button>`;
  return `<li class="pagina">${boton(-1, '‹', 'paginaAnterior', p.actual <= 1)}<small>${escapar(t('pagina', p))}</small>${boton(1, '›', 'paginaSiguiente', p.actual >= p.de)}</li>`;
}

/** La medida de una carta, pequeña y en su fila de arriba: el paso propio del PV (el ciclo en el 4) o la madurez. */
const htmlMedida = (m) => (m ? `<span class="medida" title="${attr(m.nombre)} ${attr(m.k)}${m.de ? ' / ' + attr(m.de) : ''}">${escapar(m.nombre)} ${escapar(m.k)}${m.de ? `<small>/${escapar(m.de)}</small>` : ''}</span>` : '');

/** Un elemento de una banda: un ocupante (como siempre) o una entrada del diario (su hora y lo que movió). */
function htmlElementoDeBanda(o) {
  if (o.tipo !== 'entrada') return htmlOcupanteSolo(o);
  return `<button type="button" class="ocupante ocupante-ref ocupante-entrada"${nodo('ocupante')} data-pv="${o.pv}" data-abrir="${attr(o.ref)}" data-x="${attr(o.ref)}" title="${attr(o.t)}"><span class="texto">${escapar(o.texto)}</span><small class="quien">${escapar(o.t.replace('T', ' ').replace('Z', ''))}</small></button>`;
}

/** Una celda de la rejilla de un mundo: su ocupante; si se puede entrar, un clic baja un nivel (data-celda) y un botoncito abre el registro. */
function htmlCeldaDeRejilla(c) {
  const o = c.ocupante;
  let dentro = '';
  if (o && c.entra) {
    dentro = `<button type="button" class="ocupante ocupante-ref ocupante-celda"${nodo('ocupante', { x0: o.texto })} data-pv="${o.pv}" data-celda="${o.X}" data-x="${o.X}" title="${attr(t('entrarEnCelda', { que: o.texto }))}"><span class="texto">${escapar(o.texto)}</span>${o.autor ? `<small class="quien">${escapar(o.autor)}</small>` : ''}</button><button type="button" class="celda-abrir"${nodo('control')} data-abrir="${o.X}" data-x="${o.X}" title="${attr(t('abrirEnCelda', { que: o.texto }))}" aria-label="${attr(t('abrirEnCelda', { que: o.texto }))}">↗</button>`;
  } else if (o) dentro = htmlOcupanteSolo(o);
  return `<div class="rejilla-celda${o ? '' : ' vacia'}" data-color="${c.pv}" data-fila="${c.fila}" data-columna="${c.columna}">${dentro}</div>`;
}

/** Una banda: su nombre (la escala de T) o su número (la caja de la cuota), y lo que cae en ella. */
function htmlBandaDeRejilla(b, pasos) {
  const nombre = b.nombre ?? (pasos ? t('pasoDelCamino', { n: b.indice + 1 }) : String(b.indice));
  let cuerpo;
  if (pasos) cuerpo = b.nivel !== undefined ? `<span class="ocupante ocupante-hoja${b.actual ? ' actual' : ''}">${escapar(b.nivel)}</span>` : `<span class="paso ${b.hecho ? 'hecho' : b.espera ? 'espera' : b.mio ? 'mio' : 'otro'}"><span class="falta">${escapar(b.falta ?? '')}</span></span>`;
  else cuerpo = b.items.map(htmlElementoDeBanda).join('') + (b.mas ? `<small class="mas-banda">${escapar(t('masEnBanda', { n: b.mas }))}</small>` : '');
  return `<div class="rejilla-banda${(b.items?.length ?? 1) ? '' : ' vacia'}" data-banda="${b.indice}"><span class="banda-nombre">${escapar(nombre)}</span><div class="banda-cuerpo">${cuerpo}</div></div>`;
}

/**
 * La rejilla de un mundo (epoch.8.7): columnas × filas de celdas, cada una con el color del PV de cuyo contenido es
 * (en el 2 y el 3, las de dentro son del PV que hereda); o, si la época da bandas, una banda por escala o por caja. Con
 * niveles de profundidad, la cabecera dice dónde se está y «subir» vuelve un nivel; abajo, «‹ n de m ›» por rejillas
 * enteras. En un bloque, la misma rejilla sin cabecera.
 */
function htmlRejilla(r, { completa = false } = {}) {
  if (!r) return '';
  const cabeza = completa && r.niveles > 1 ? `<div class="rejilla-cabeza"><span class="nivel-rejilla">${escapar(t('rejillaNivel', { nivel: r.nivel, niveles: r.niveles }))}</span>${r.texto ? `<span class="ruta-rejilla">${escapar(r.texto)}</span>` : ''}${r.ruta.length ? `<button type="button" class="subir"${nodo('control')} data-subir="${r.pv}" title="${attr(t('subirTitulo'))}">↑ ${t('subir')}</button>` : ''}</div>` : '';
  const sin = r.sinBanda?.length ? `<div class="rejilla-sin" title="${attr(t('sinBandaTitulo'))}">${r.sinBanda.map(htmlElementoDeBanda).join('')}</div>` : '';
  const cuerpo = r.bandas
    ? `<div class="rejilla-bandas" style="--filas:${r.bandas.length}">${r.bandas.map((b) => htmlBandaDeRejilla(b, r.pasos)).join('')}</div>${sin}`
    : `<div class="rejilla-celdas" style="--columnas:${r.columnas};--filas:${r.filas}">${r.celdas.map(htmlCeldaDeRejilla).join('')}</div>`;
  const paginas = r.pagina && r.pagina.de > 1 ? `<ul class="ocupantes rejilla-paginas">${htmlPagina(r.pagina, r.pv)}</ul>` : '';
  return `<div class="rejilla${completa ? ' rejilla-completa' : ''}" data-rejilla="${r.pv}" data-nivel="${r.nivel}" data-niveles="${r.niveles}" data-columnas="${r.columnas}" data-filas="${r.filas}">${cabeza}${cuerpo}${paginas}</div>`;
}

/** La lista o la matriz de ocupantes de un PV, con «cargar más» al final si hay más. */
function htmlOcupantes(oc, { pv, disposicion } = {}) {
  if (!oc) return '';
  const lista = oc.lista.length ? oc.lista.map((o) => `<li>${htmlOcupante(o)}</li>`).join('') : `<li class="nada">${t('nada')}</li>`;
  const mas = oc.cargarMas ? `<li class="cargar-mas"><button type="button"${nodo('control')} data-cargar-mas="${pv}">${escapar(t('cargarMas', { cuantos: oc.total - oc.lista.length }))}</button></li>` : htmlPagina(oc.pagina, pv);
  return `<ul class="ocupantes ${disposicion ? 'disposicion-' + attr(disposicion) : ''}" data-total="${oc.total}">${lista}${mas}</ul>`;
}

/** El diario (lo llegado bajo X), como lista. */
function htmlDiario(d) {
  if (!d) return '';
  const filas = d.entradas.map((e) => `<li><time datetime="${attr(e.t)}">${escapar(e.t.replace('T', ' ').replace('Z', ''))}</time> · <b>${escapar(e.autor)}</b> · <button type="button" class="enlace" data-abrir="${e.id}">${corto(e.id)}</button><small>${escapar(e.movimientos.join(', '))}</small></li>`).join('');
  return `<section class="diario"${nodo('diario')}><h4>${d.total} ${t(d.total === 1 ? 'transaccion' : 'transacciones')}</h4><ol>${filas || `<li class="nada">${t('nada')}</li>`}</ol></section>`;
}

/**
 * Una propuesta importada (carta/externa.js) como paso de la tercera fuente: lo que propone, su «porque», si ahora pasa
 * las reglas y los tres botones (aceptar: lanzarla; modificar: el formulario con los parámetros; rechazar: descartarla).
 * Una que no se entiende sale como inválida, con su motivo y solo «rechazar».
 */
function htmlPropuesta(p) {
  const id = attr(p.propuesta);
  const porque = p.porque ? `<span class="porque"><b>${t('propuestaPorque')}</b> ${escapar(p.porque)}</span>` : '';
  const rechazar = `<button type="button"${nodo('control')} data-propuesta-rechazar="${id}" title="${attr(t('propuestaRechazarTitulo'))}">${t('propuestaRechazar')}</button>`;
  if (p.invalida) {
    return `<li class="paso propuesta invalida"${nodo('paso')} data-propuesta="${id}"><span class="fuente">${escapar(p.fuente)}</span> <b>${t('propuestaInvalida')}</b> <span class="falta">${escapar(p.falta ?? '')}</span> <span class="motivo">${escapar(p.invalida)}</span> ${porque}<span class="propuesta-botones">${rechazar}</span></li>`;
  }
  const noPasa = p.pasa === false && p.motivos?.length ? `<small class="motivos" role="status">${escapar(t('propuestaNoPasa', { motivos: p.motivos.map((m) => m.mensaje).join('; ') }))}</small>` : '';
  return `<li class="paso propuesta mio${p.pasa === false ? ' no-pasa' : ''}"${nodo('paso')} data-propuesta="${id}"><button type="button" class="propuesta-nombre" data-propuesta-modificar="${id}" title="${attr(t('propuestaModificarTitulo'))}">${escapar(p.hacer?.nombre ?? '')}</button> <span class="fuente">${escapar(p.fuente)}</span> ${porque}${noPasa}
    <span class="propuesta-botones"><button type="button"${nodo('control')} data-propuesta-aceptar="${id}" title="${attr(t('propuestaAceptarTitulo'))}">${t('propuestaAceptar')}</button><button type="button"${nodo('control')} data-propuesta-modificar="${id}" title="${attr(t('propuestaModificarTitulo'))}">${t('propuestaModificar')}</button>${rechazar}</span></li>`;
}

/** El camino: cada paso, mío (lanzable, por el id de su plantilla), de espera (marcado) o hecho; los niveles si la madurez es 0; «seguir». */
export function htmlCamino(c, { X } = {}) {
  if (!c) return '';
  const pasos = c.pasos.map((p, i) => {
    if (p.propuesta !== null && p.propuesta !== undefined) return htmlPropuesta(p);
    const clase = p.hecho ? 'hecho' : p.espera ? 'espera' : p.mio ? 'mio' : 'otro';
    const cuerpo = `<span class="fuente">${escapar(p.fuente)}</span> <span class="falta">${escapar(p.falta ?? '')}</span>`;
    const marca = p.hecho ? `<span class="marca">${t('hecho')}</span>` : p.espera ? `<span class="marca">${escapar(t('esperaA', { quien: p.espera }))}</span>` : '';
    return p.mio
      ? `<li class="paso ${clase}"${nodo('paso')}><button type="button" data-paso="${i}" data-x="${attr(p.hacer?.X ?? X ?? '')}" data-lanzar="${attr(p.hacer.id)}">${escapar(p.hacer.nombre)}</button> ${cuerpo}</li>`
      : `<li class="paso ${clase}"${nodo('paso')}>${cuerpo} ${marca}</li>`;
  }).join('');
  const niveles = c.niveles ? `<p class="niveles">${t('paraUbicarse')} ${c.niveles.map((n) => `<span>${escapar(n)}</span>`).join(' → ')}</p>` : '';
  const seguir = c.pasos.some((p) => p.mio && !p.hacer?.lectura && (p.propuesta === null || p.propuesta === undefined)) ? `<button type="button" class="seguir" data-seguir>${t('seguir')}</button>` : '';
  return `<section class="camino"${nodo('camino')} aria-label="${attr(t('camino'))}">${niveles}<ol>${pasos || `<li class="nada">${t('nadaQueHacerAqui')}</li>`}</ol>${seguir}</section>`;
}

/**
 * Las propuestas importadas que no están en el camino de este registro: las que tratan de otro (con «ir al registro») y
 * las que no se entienden (con su motivo); cada una se puede rechazar. `p`: { fuera: [evaluación de carta/externa.js],
 * aqui } o nada.
 */
function htmlPropuestasFuera(p) {
  if (!p || (!p.fuera.length && !p.aqui)) return '';
  const fila = (e) => `<li class="propuesta${e.valida ? '' : ' invalida'}"${nodo('paso')} data-propuesta="${attr(e.id)}"><b>${escapar(e.valida ? e.nombre : t('propuestaInvalida'))}</b> ${e.valida ? `<small>${escapar(t('propuestaSobre', { sobre: e.sobreTexto ?? corto(e.sobre) }))}</small>` : `<span class="falta">${escapar(e.accion)}</span> <span class="motivo">${escapar(e.motivo)}</span>`}${e.porque ? ` <span class="porque"><b>${t('propuestaPorque')}</b> ${escapar(e.porque)}</span>` : ''}
    <span class="propuesta-botones">${e.valida ? `<button type="button"${nodo('control')} data-abrir="${attr(e.sobre)}">${t('propuestaAbrir')}</button>` : ''}<button type="button"${nodo('control')} data-propuesta-rechazar="${attr(e.id)}" title="${attr(t('propuestaRechazarTitulo'))}">${t('propuestaRechazar')}</button></span></li>`;
  return `<div class="propuestas"${nodo('propuestas')}><h5>${t('propuestasPendientes', { cuantas: p.fuera.length + p.aqui })}</h5>${p.aqui ? `<small class="ayuda">${t('propuestaAqui', { cuantas: p.aqui })}</small>` : ''}<ul>${p.fuera.map(fila).join('')}</ul></div>`;
}

/** Las opiniones ancladas en un registro (el proyecto donde yo las ancla), con cuántas respuestas lleva cada una. */
function htmlOpiniones(o) {
  if (!o?.length) return '';
  const filas = o.map((x) => `<li><time datetime="${attr(x.t)}">${escapar(x.t.replace('T', ' ').replace('Z', ''))}</time> · <b>${escapar(x.autor)}</b> · <button type="button" class="enlace" data-abrir="${x.id}">${corto(x.id)}</button> ${escapar(x.texto)}<small>${escapar(x.clasificacion.join(' · '))}${x.respuestas ? ' · ' + escapar(t('opinionesRespuestas', { cuantas: x.respuestas })) : ''}</small></li>`).join('');
  return `<section class="opiniones"${nodo('opiniones')}><h4>${t('opiniones')} · ${o.length}</h4><ol>${filas}</ol></section>`;
}

/**
 * La guía del PV9 (carta/guia.js; solo lectura): la conversación guardada, «pensando…» mientras contesta, el error tal
 * cual, las preguntas hechas de la época como botones, el campo de pregunta y «preguntar». `g`: { historial, pensando,
 * pendiente, error, borrador, preguntas, via }; sin `g` (no hay eje) no se pinta. La app repinta solo esta sección.
 */
export function htmlGuia(g) {
  if (!g) return '';
  const turnos = g.historial.map((m) => `<li class="guia-${m.role === 'user' ? 'yo' : 'claude'}"><b>${t(m.role === 'user' ? 'guiaYo' : 'guiaClaude')}</b> ${escapar(m.content)}</li>`).join('')
    + (g.pensando ? `<li class="guia-yo"><b>${t('guiaYo')}</b> ${escapar(g.pendiente ?? '')}</li><li class="guia-pensando" role="status">${t('guiaPensando')}</li>` : '');
  const rapidas = g.preguntas.map((q, i) => `<button type="button"${nodo('control')} data-guia-rapida="${i}"${g.pensando ? ' disabled' : ''}>${escapar(q)}</button>`).join('');
  return `<section class="guia"${nodo('guia')} data-guia aria-label="${attr(t('guia'))}">
    <header class="guia-cabeza"><h4>${t('guia')}</h4><small class="ayuda">${escapar(t(g.via === 'direct' ? 'guiaViaDirecta' : 'guiaViaServidor'))}</small>${g.historial.length ? `<button type="button"${nodo('control')} data-guia-vaciar title="${attr(t('guiaVaciarTitulo'))}">${t('guiaVaciar')}</button>` : ''}</header>
    <ol class="guia-historial" aria-live="polite">${turnos || `<li class="nada">${t('guiaVacia')}</li>`}</ol>
    ${g.error ? `<p class="aviso" role="alert">${escapar(g.error)}</p>` : ''}
    <div class="guia-rapidas">${rapidas}</div>
    <div class="guia-externa"><button type="button"${nodo('control')} data-guia-exportar title="${attr(t('exportarContextoTitulo'))}">${t('exportarContexto')}</button><button type="button"${nodo('control')} data-guia-importar title="${attr(t('importarPropuestasTitulo'))}">${t('importarPropuestas')}</button><input type="file" accept=".json,.md,.markdown,.txt,application/json,text/markdown,text/plain" data-guia-archivo hidden aria-label="${attr(t('importarPropuestas'))}"></div>
    ${htmlPropuestasFuera(g.propuestas)}
    <form class="guia-form" data-guia-form><input type="text" name="pregunta" data-guia-pregunta value="${attr(g.borrador ?? '')}" placeholder="${attr(t('guiaPregunta'))}" aria-label="${attr(t('guiaPregunta'))}" autocomplete="off"${g.pensando ? ' disabled' : ''}><button type="submit"${g.pensando ? ' disabled' : ''}>${t('guiaPreguntar')}</button></form>
    <small class="ayuda">${escapar(t('guiaAyuda'))}</small>
  </section>`;
}

/** Un PV lateral en su nivel: comprimido (un dato), tarjeta (etiqueta y lo que cabe), bloque (la lista o la matriz). */
function htmlLateral(n, arbol) {
  const clases = ['pv', `pv-${n.pv}`, `grupo-${n.grupo}`, `lado-${n.lado ?? ''}`, `fila-${n.fila ?? ''}`, `nivel-${n.nivel}`].join(' ');
  if (n.nivel === NIVEL.oculto) return `<div class="${clases}"${nodo('pv', { tam: NOMBRE_NIVEL[n.nivel] })} data-pv="${n.pv}" data-x="${n.X}" hidden></div>`;
  // En comprimido, la etapa en sello (si el modelo la trae) o el elemento; en tarjeta y bloque, el escenario entero.
  const sello = n.etapa?.recurso ? htmlPieza(n.etapa, { clase: 'pieza-etapa', alt: n.etiqueta }) : htmlPieza(n.pieza, { paso: n.paso, alt: n.etiqueta });
  const efectos = n.nivel === NIVEL.comprimido && n.nuevos?.efectos?.length ? htmlEscenario({ nuevos: n.nuevos, consumido: n.consumido }) : '';
  const dato = `<span class="dato" title="${attr(n.comprimido.que ?? '')}">${escapar(n.comprimido.dato)}${n.comprimido.de ? `<small>/${escapar(n.comprimido.de)}</small>` : ''}</span>`;
  const cabeza = `<header class="pv-cabeza"><span class="numero">${n.pv}</span><span class="etiqueta">${escapar(n.etiqueta)}</span>${n.medida ? htmlMedida(n.medida) : dato}</header>`;
  const marco = htmlMarco(n.marco);
  let cuerpo = '';
  if (n.nivel === NIVEL.comprimido) cuerpo = `<div class="comprimido" title="${attr(n.etiqueta)}: ${attr(n.ayuda ?? '')}"><span class="numero">${n.pv}</span>${sello || dato}${sello ? dato : ''}${efectos}${marco}</div>`;
  else {
    const camino = n.grupo === 'cruz' && n.fila === 'abajo' ? htmlCamino(arbol.camino, { X: n.X }) + (arbol.centro?.pv !== n.pv && (arbol.apilada || n.nivel >= NIVEL.bloque) ? htmlGuia(arbol.guia) : '') : '';
    const escenario = htmlEscenario(n, { paso: n.paso, etiqueta: n.etiqueta }) || (n.pieza ? htmlPieza(n.pieza, { paso: n.paso, alt: n.etiqueta }) : '');
    cuerpo = cabeza + escenario + (n.rejilla ? htmlRejilla(n.rejilla) : htmlOcupantes(n.ocupantes, { pv: n.pv, disposicion: n.disposicion })) + (n.nivel >= NIVEL.bloque ? htmlDiario(n.diario) + htmlOpiniones(n.opiniones) : '') + camino
      + `<footer class="pv-pie"><button type="button" class="entrar" data-foco-pv="${n.pv}" data-x="${n.X}">${t('entrar')}</button><small class="ayuda">${escapar(n.ayuda ?? '')}</small></footer>` + marco;
  }
  return `<section class="${clases}"${nodo('pv', { tam: n.pasoDeTamano?.nombre ?? NOMBRE_NIVEL[n.nivel], rep: repDe(n.representacion) })} data-pv="${n.pv}" data-x="${n.X}" data-nivel="${n.nivel}" aria-label="${attr(n.etiqueta)}" tabindex="0">${cuerpo}</section>`;
}

/** Los campos del anverso: cada PV lateral con su etiqueta y un input (editar escribe un ocupante nuevo, nunca en sitio). */
function htmlCampos(campos, X) {
  return `<dl class="campos">${campos.map((c) => `<div class="campo campo-${c.pv}"${nodo('campo', { d: c.pv })}><dt><label for="campo-${c.pv}" title="${attr(c.ayuda ?? '')}">${escapar(c.etiqueta)}${c.total > 1 ? ` <small>· ${c.total}</small>` : ''}</label></dt><dd><input id="campo-${c.pv}" class="campo-input" data-campo="${c.pv}" data-x="${X}" value="${attr(c.valor)}" placeholder="${attr((c.marcador ?? []).join(' · '))}" title="${attr(c.ayuda ?? '')}" autocomplete="off"></dd></div>`).join('')}</dl>`;
}

/** El centro: el anverso (0), el reverso (5) o un PV abierto como foco. */
function htmlCentro(c, arbol, { leidoTexto } = {}) {
  const voltear = `<button type="button" class="voltear" data-voltear aria-label="${attr(t('voltear'))} (${attr(t(c.cara === 'anverso' ? 'voltearAnverso' : 'voltearReverso'))})" title="${attr(t('voltear'))}">⟲</button>`;
  const leido = `<div class="leido"><button type="button" class="leido-boton" data-leido aria-pressed="${c.leido}" title="${attr(t(c.leido ? 'leidoOcultar' : 'leidoVer'))}">${t('leido')}</button>${c.leido && leidoTexto !== undefined ? `<pre class="leido-texto" tabindex="0">${escapar(leidoTexto)}</pre>` : ''}</div>`;
  const puntos = htmlPuntos(arbol.mapa?.puntos, c.X);
  const madurez = c.madurez?.nombre ? `<span class="madurez medida" title="${attr(t('madurezTitulo', { nivel: c.madurez.nivel, de: c.madurez.de }))}">${escapar(c.madurez.nombre)} <small>${c.madurez.nivel}/${c.madurez.de}</small></span>` : '';
  const quien = `<span class="quien">${escapar(c.autor ?? '')}</span>`;
  const marco = htmlMarco(c.marco);
  const efectos = c.nuevos?.efectos?.length ? htmlEscenario({ nuevos: c.nuevos, consumido: c.consumido }) : '';
  if (c.cara === 'anverso') {
    return `<section class="nucleo anverso tamano-${c.tamano?.tamano ?? 1}"${nodo('foco', { tam: 'foco', cara: 'anverso', rep: repDe(c.representacion) })} data-centro="${c.pv}" data-x="${c.X}" aria-label="${attr(c.etiqueta)}">
      <header class="nucleo-cabeza"><span class="etiqueta">${escapar(c.etiqueta)}</span>${madurez}${quien}${voltear}</header>
      ${puntos}
      <h1 class="representacion">${htmlRepresentacion(c.representacion)}${efectos}</h1>
      <label class="campo campo-0"${nodo('campo', { d: 0 })}><span class="etiqueta-0">${escapar(c.etiqueta)}</span><input class="campo-input" data-campo="${c.pv}" data-x="${c.X}" value="" placeholder="${attr(c.representacion?.texto ?? '')}" title="${attr(c.ayuda ?? '')}" autocomplete="off"></label>
      ${htmlCampos(c.campos, c.X)}
      ${leido}${marco}
    </section>`;
  }
  if (c.cara === 'reverso') {
    const ancla = c.ancla ? `<p class="ancla">${t('sobre')} <button type="button" class="enlace" data-abrir="${attr(c.ancla.sobre ?? '')}" ${c.ancla.sobre ? '' : 'disabled'}>${escapar(c.ancla.sobreTexto ?? t('laRaiz'))}</button>${c.ancla.en ? ` · ${t('en')} ${escapar(c.ancla.en)}` : ''}</p>` : '';
    const pasos = c.pasos ? `<ul class="pasos">${Object.values(c.pasos.porPv).concat(c.pasos.comun ? [c.pasos.comun] : []).map((p) => `<li><b>${escapar(p.nombre)}</b> ${p.k === null ? '—' : escapar(p.k)}${p.de ? `<small>/${escapar(p.de)}</small>` : ''}</li>`).join('')}</ul>` : '';
    const validacion = c.validacion?.length ? `<ul class="motivos">${c.validacion.map((v) => `<li>${escapar(v.motivo)}</li>`).join('')}</ul>` : '';
    return `<section class="nucleo reverso tamano-${c.tamano?.tamano ?? 1}"${nodo('foco', { tam: 'foco', cara: 'reverso', rep: repDe(c.representacion) })} data-centro="${c.pv}" data-x="${c.X}" aria-label="${attr(c.etiqueta)}">
      <header class="nucleo-cabeza"><span class="etiqueta">${escapar(c.etiqueta)}</span>${madurez}${quien}${voltear}</header>
      ${puntos}
      <p class="tipo">${c.plantilla ? `${t('plantilla')} <b>${escapar(c.plantilla)}</b>` : t('sinPlantilla')}${c.t ? ` · <time>${escapar(c.t)}</time>` : ''}</p>
      ${ancla}
      ${htmlOcupantes(c.ocupantes, { pv: c.pv })}
      <label class="campo campo-5"${nodo('campo', { d: 5 })}><span class="etiqueta-0">${escapar(c.etiqueta)}</span><input class="campo-input" data-campo="${c.pv}" data-x="${c.X}" value="" placeholder="${attr(c.plantilla ?? '')}" title="${attr(c.ayuda ?? '')}" autocomplete="off"></label>
      ${pasos}${validacion}${efectos}${marco}
    </section>`;
  }
  return `<section class="nucleo abierto tamano-${c.tamano?.tamano ?? 1}"${nodo('foco', { tam: 'foco', cara: 'abierto', rep: repDe(c.representacion) })} data-centro="${c.pv}" data-x="${c.X}" aria-label="${attr(c.etiqueta)}">
    <header class="nucleo-cabeza"><span class="numero">${c.pv}</span><span class="etiqueta">${escapar(c.etiqueta)}</span>${htmlMedida(c.medida)}${quien}${arbol.mapa?.completa ? `<button type="button" class="volver volver-claro"${nodo('control')} ${c.rejilla?.ruta?.length ? `data-subir="${c.pv}"` : `data-foco-pv="${arbol.mapa.completa.volver}"`} data-x="${c.X}" title="${attr(t('volverTitulo'))}">← ${t('volver')}</button>` : `<button type="button" class="volver" data-foco-pv="0" data-x="${c.X}" title="${attr(t('volverAl0'))}">0</button>`}</header>
    ${htmlEscenario(c, { paso: c.pasos?.porPv?.[c.pv] ?? null, etiqueta: c.etiqueta })}
    ${c.rejilla ? htmlRejilla(c.rejilla, { completa: true }) : htmlOcupantes(c.ocupantes, { pv: c.pv, disposicion: c.disposicion })}
    <p class="ayuda">${escapar(c.ayuda ?? '')}</p>${GEOMETRIA[c.pv]?.grupo === 'cruz' && GEOMETRIA[c.pv]?.fila === 'abajo' ? htmlGuia(arbol.guia) : ''}${htmlMarco(c.marco)}
  </section>`;
}

/**
 * Los rosetones de identidad: diez mosaicos muy comprimidos de mi foco, uno por PV (el 0 y el 5 incluidos). En la
 * matriz, una barra fija abajo; apilada (el móvil), dos tiras: arriba el tetraedro de la X con su centro, abajo la cruz
 * con el suyo (las que traza la geometría: la X son los PV 1-4, la cruz 6-9, y el 0 y el 5 el centro de cada una).
 */
function htmlRoseton(r, { enSuSitio = false } = {}) {
  const sitio = enSuSitio && r.sitio ? ` sitio-f${r.sitio.fila} sitio-c${r.sitio.columna}${r.sitio.centro ? ' sitio-centro' : ''}` : '';
  return `<button type="button" class="roseton grupo-${r.grupo} lado-${r.lado ?? ''} fila-${r.fila ?? ''} nivel-${r.nivel}${sitio}"${nodo('roseton', { tam: NOMBRE_NIVEL[r.nivel] })} data-roseton="${r.pv}" data-x="${r.X}" title="${attr(t('deMiAlta', { que: r.etiqueta }))}">
    <span class="numero">${r.pv}</span><span class="dato">${escapar(r.comprimido.dato)}</span>
    ${r.nivel >= NIVEL.tarjeta && r.ocupantes ? `<span class="etiqueta">${escapar(r.etiqueta)}</span><ul>${r.ocupantes.lista.slice(0, 4).map((o) => `<li>${escapar(o.texto)}</li>`).join('') || `<li class="nada">${t('nada')}</li>`}</ul>` : ''}
  </button>`;
}
const nav = (lista, clase, enSuSitio = false) => `<nav class="rosetones ${clase}"${nodo('rosetones')} aria-label="${attr(t('miFoco'))}">${lista.map((r) => htmlRoseton(r, { enSuSitio })).join('')}</nav>`;
const ARRIBA = [1, 2, 0, 3, 4];
function htmlRosetones(lista, { apilada = false, parte } = {}) {
  if (!lista?.length) return '';
  // En el ordenador, cada uno en su esquina o lateral, por encima de los bloques (dentro de la escena: htmlMapa).
  if (!apilada) return parte === 'mapa' ? nav(lista, 'rosetones-mapa', true) : '';
  const mias = lista.filter((r) => (ARRIBA.includes(r.pv) ? 'arriba' : 'abajo') === parte);
  return mias.length ? nav(mias, `rosetones-${parte}`) : '';
}

/** El aro: ocho huecos alrededor, uno por PV lateral, con la acción por defecto (lanzada por el id de su plantilla); un segundo toque despliega las demás. */
function htmlAro(aro) {
  if (!aro) return '';
  const huecos = aro.huecos.map((h) => {
    const defecto = h.accion ? `<button type="button" class="accion por-defecto"${nodo('accion')} data-lanzar="${attr(h.accion.id)}" data-x="${aro.X}" title="${attr(h.etiqueta)}: ${attr(h.accion.nombre)}">${h.icono?.recurso ? htmlPieza(h.icono, { alt: h.etiqueta }) : ''}<span>${escapar(h.accion.nombre)}</span>${h.accion.faltan.length ? `<small>[${escapar(h.accion.faltan.join(', '))}]</small>` : ''}</button>` : `<span class="accion vacia" title="${attr(h.etiqueta)}: ${attr(t('nadaQueHacer'))}">—</span>`;
    const otras = h.otras.length ? `<button type="button" class="mas" data-aro-hueco="${h.pv}" aria-expanded="${h.abierto}" title="${attr(t('lasDemasAcciones', { que: h.etiqueta }))}">+${h.otras.length}</button>` : '';
    const lista = h.abierto && h.otras.length ? `<ul class="otras">${h.otras.map((a) => `<li><button type="button"${nodo('accion')} data-lanzar="${attr(a.id)}" data-x="${aro.X}">${escapar(a.nombre)}${a.faltan.length ? ` <small>[${escapar(a.faltan.join(', '))}]</small>` : ''}</button></li>`).join('')}</ul>` : '';
    return `<li class="hueco hueco-${h.pv} lado-${h.lado ?? ''}"${nodo('hueco')} data-pv="${h.pv}"><span class="numero">${h.pv}</span><span class="etiqueta">${escapar(h.etiqueta)}</span>${defecto}${otras}${lista}</li>`;
  }).join('');
  return `<div class="aro-fondo" data-cerrar><div class="aro"${nodo('aro')} role="dialog" aria-label="${attr(t('aroDe', { que: aro.texto }))}"><p class="aro-centro"><b>${escapar(aro.texto)}</b><button type="button" class="cerrar" data-cerrar aria-label="${attr(t('cerrar'))}">×</button></p><ul>${huecos}</ul></div></div>`;
}

/** Un valor en crudo como texto de input (una lista o una décupla, en JSON). */
const valorInput = (v) => (v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));

/** El valor que enseña el input de un parámetro: el legible; un instante, en la forma que entiende un input de fecha y hora. */
function valorDeInput(c) {
  if (c.valor === null || c.valor === undefined) return '';
  if (c.tipo === 'instant' && typeof c.valor === 'string') return c.valor.slice(0, 16);
  return c.legible ?? valorInput(c.valor);
}

/**
 * El formulario generado desde la plantilla de transacción: cada parámetro con su etiqueta, ayuda, tipo y validación.
 * El input enseña el valor legible (el crudo va en data-crudo, y en un desplegable «ver en BTML»); al enviar, la app lee
 * lo escrito con contrato.desdeLegible en los tipos simples (data-simple) y, si no se tocó, manda el crudo.
 */
function htmlFormulario(f) {
  if (!f) return '';
  const campo = (c) => {
    const id = 'param-' + c.nombre.replace(/\W+/g, '-');
    const tipoInput = c.tipo === 'number' ? 'number' : c.tipo === 'instant' ? 'datetime-local' : 'text';
    const valor = valorDeInput(c);
    const crudo = c.valor === null || c.valor === undefined ? '' : JSON.stringify(c.valor);
    const btml = crudo ? `<details class="btml"><summary>${t('verEnBtml')}</summary><code>${escapar(crudo)}</code></details>` : '';
    return `<div class="campo ${c.falta ? 'falta' : ''}"><label for="${id}">${escapar(c.etiqueta)}${c.requerido ? ` <abbr title="${attr(t('requerido'))}">*</abbr>` : ''} <small class="tipo">${escapar(c.tipo)}</small></label>
      <input id="${id}" name="${attr(c.nombre)}" type="${tipoInput}" ${tipoInput === 'number' ? 'step="any"' : ''} value="${attr(valor)}" ${c.requerido ? 'required' : ''} data-tipo="${attr(c.tipo)}" data-etiqueta="${attr(c.etiqueta)}" data-simple="${c.simple ? 1 : 0}" data-crudo="${attr(crudo)}" data-legible="${attr(valor)}" data-validacion="${attr(c.validacion ?? '')}" title="${attr(c.ayuda)}" autocomplete="off">
      <small class="ayuda">${escapar(c.ayuda)}${c.validacion ? ` <code>${escapar(c.validacion)}</code>` : ''}</small>${btml}</div>`;
  };
  // A la vista, solo lo obligatorio; lo opcional, tras «más».
  const opcionales = f.campos.filter((c) => !c.requerido);
  const campos = f.campos.filter((c) => c.requerido).map(campo).join('')
    + (opcionales.length ? `<details class="mas-parametros"><summary title="${attr(t('masParametrosTitulo'))}">${t('masParametros')} · ${opcionales.length}</summary>${opcionales.map(campo).join('')}</details>` : '');
  const motivos = f.motivos?.length ? `<ul class="motivos" role="alert">${f.motivos.map((m) => `<li>${escapar(m.mensaje)}</li>`).join('')}</ul>` : '';
  const resultado = f.resultado ? `<p class="exito" role="status">${escapar(f.resultado)}</p>` : '';
  return `<div class="formulario-fondo" data-cerrar><form class="formulario" data-formulario${nodo('formulario')} data-x="${f.X}" data-accion="${attr(f.accion)}" aria-label="${attr(f.nombre)}">
    <header><h2>${escapar(f.nombre)}</h2><button type="button" class="cerrar" data-cerrar aria-label="${attr(t('cerrar'))}">×</button></header>
    ${f.ofrecida ? '' : `<p class="aviso">${t('noSeOfrece')}</p>`}
    ${campos}${motivos}${resultado}
    <footer><button type="submit">${t(f.lectura ? 'leer' : f.camino ? 'darElPaso' : 'lanzar')}</button></footer>
  </form></div>`;
}

/**
 * Los ajustes de la guía dentro del formulario de la configuración: los campos de la plantilla de ajustes de la época
 * (sin `name`: la app los lee por data-guia-campo y los escribe como su propio registro en el 9 del alta) y, aparte, la
 * clave de la API (data-clave-ia: solo para la vía directa; vive en este navegador, nunca en el eje).
 */
function htmlAjustesGuia(g) {
  if (!g) return '';
  const campos = g.campos.map((c) => `<div class="campo"${nodo('control')}><label for="guia-${c.pv}">${escapar(c.etiqueta)}</label><input id="guia-${c.pv}" data-guia-campo="${attr(c.clave)}" type="text" value="${attr(c.valor)}" placeholder="${attr(c.marcador)}" title="${attr(c.ayuda)}" autocomplete="off"><small class="ayuda">${escapar(c.ayuda)}</small></div>`).join('');
  const clave = `<div class="campo"${nodo('control')}><label for="guia-clave-ia">${t('guiaClaveIa')}</label><input id="guia-clave-ia" data-clave-ia type="password" value="${attr(g.claveIa ?? '')}" title="${attr(t('guiaClaveIaAyuda'))}" autocomplete="off" spellcheck="false"><small class="ayuda">${escapar(t('guiaClaveIaAyuda'))}</small></div>`;
  return `<fieldset class="guia-ajustes"><legend>${t('guiaAjustes')}</legend>${campos}${clave}</fieldset>`;
}

/**
 * El formulario de la configuración, generado desde la plantilla «preferences»: cada campo por su clave, con su
 * etiqueta en el idioma. En una cuenta (`claveLectura` es una cadena, quizá vacía), además el campo aparte de la clave
 * de lectura del libro compartido: sin `name` (no entra en el registro de preferencias: la app lo lee por
 * data-clave-lectura y lo guarda en el almacén local de la cuenta, nunca en el eje).
 */
export function htmlConfiguracion(p, { motivos = [], claveLectura, guia } = {}) {
  if (!p) return '';
  const campos = p.campos.map((c) => `<div class="campo"><label for="pref-${c.pv}">${escapar(c.etiqueta)}</label><input id="pref-${c.pv}" name="${attr(c.clave)}" type="text" value="${attr(valorInput(Array.isArray(c.valor) ? c.valor.join(' ') : c.valor))}" placeholder="${attr(c.marcador.join(' '))}" title="${attr(c.ayuda)}" autocomplete="off"><small class="ayuda">${escapar(c.ayuda)}</small></div>`).join('')
    + (typeof claveLectura === 'string' ? `<div class="campo"><label for="pref-clave-lectura">${t('claveLectura')}</label><input id="pref-clave-lectura" data-clave-lectura type="password" value="${attr(claveLectura)}" title="${attr(t('claveLecturaAyuda'))}" autocomplete="off" spellcheck="false"><small class="ayuda">${escapar(t('claveLecturaAyuda'))}</small></div>` : '')
    + htmlAjustesGuia(guia);
  return `<div class="formulario-fondo" data-cerrar><form class="formulario configuracion"${nodo('configuracion')} data-configuracion aria-label="${attr(t('configuracion'))}">
    <header><h2>${t('miConfiguracion')}</h2><button type="button" class="cerrar" data-cerrar aria-label="${attr(t('cerrar'))}">×</button></header>
    <p class="ayuda">${escapar(t('configuracionAyuda', { plantilla: p.nombre }))}</p>
    ${campos}${motivos.length ? `<ul class="motivos" role="alert">${motivos.map((m) => `<li>${escapar(m.mensaje ?? m)}</li>`).join('')}</ul>` : ''}
    <footer><button type="submit">${t('guardar')}</button></footer>
  </form></div>`;
}

/**
 * El selector «soy»: mis cuentas (por su nombre, `cuenta:<alta>`), aparte las identidades del ejemplo (en una cuenta,
 * solo la opción de probar con un ejemplo), y crear o restaurar una cuenta. La app lee el valor elegido.
 */
function htmlSoy(arbol, { cuentas = [], cuenta = null } = {}) {
  const mias = cuentas.length ? `<optgroup label="${attr(t('misCuentas'))}">${cuentas.map((c) => `<option value="cuenta:${attr(c.alta)}" ${cuenta && c.alta === cuenta.alta ? 'selected' : ''}>${escapar(c.nombre)}</option>`).join('')}</optgroup>` : '';
  const ejemplo = cuenta
    ? `<optgroup label="${attr(t('ejemplos'))}"><option value="ejemplo">${t('probarConEjemplo')}</option></optgroup>`
    : `<optgroup label="${attr(t('ejemplos'))}">${arbol.identidades.map((i) => `<option value="${attr(i.id)}" ${i.id === arbol.yo ? 'selected' : ''}>${escapar(i.id)}${i.persona ? '' : ' ' + t('cosa')}</option>`).join('')}</optgroup>`;
  const nuevas = `<optgroup label="${attr(t('cuenta'))}"><option value="nueva">${t('crearMiCuenta')}…</option><option value="restaurar">${t('restaurarUnaCuenta')}…</option></optgroup>`;
  return `<label class="ajuste"${nodo('control')}>${t('soy')} <select data-quien>${mias}${ejemplo}${nuevas}</select></label>`;
}

/**
 * La línea del libro compartido, junto a «guardado en este navegador» (carta/sincronia.js lineaDeEstado): lo que falta
 * por subir, sin red, el orden que cambió o «al día»; los errores tal cual; y lo que no entró, en un desplegable con el
 * id corto, el motivo y de dónde viene. Sin sincronía (un ejemplo, o una cuenta sin servidor), nada.
 */
export function htmlSincronia(s) {
  if (!s) return '';
  const errores = s.errores?.length ? ` <span class="error" role="alert">${s.errores.map(escapar).join(' · ')}</span>` : '';
  const rechazados = s.rechazados?.length
    ? `<details class="rechazados"><summary>${escapar(s.titulo)}</summary><ul>${s.rechazados.map((r) => `<li><code>${escapar(r.id)}</code> ${escapar(r.motivo)} <small>(${escapar(r.deTexto)})</small></li>`).join('')}</ul></details>`
    : '';
  return `<small class="sincronia" data-sincronia role="status" title="${attr(t('sincroniaTitulo'))}">${(s.partes ?? []).map(escapar).join(' · ')}${errores}${rechazados}</small>`;
}

/** La barra: quién soy, el ejemplo, el tiempo de hoy, «guardar este rato», la configuración, la copia de seguridad (en una cuenta) o reiniciar (en un ejemplo); debajo, lo guardado y el libro compartido. */
/** Los controles de «opinar» (carta/opinar.js): el conmutador con su contador y, si hay opiniones, exportar, copiar y borrar la última. */
export function htmlOpinar(o) {
  if (!o) return '';
  const conmutador = `<button type="button" class="opinar-boton" data-opinar-ctl="alternar" aria-pressed="${Boolean(o.activo)}" title="${attr(t('opinarTitulo'))}">${t('opinar')}${o.cuantas ? ` · ${o.cuantas}` : ''}</button>`;
  if (!o.cuantas) return conmutador;
  return conmutador + `<span class="opinar-menu"><button type="button" data-opinar-ctl="exportar" title="${attr(t('opinarExportarTitulo'))}">${t('opinarExportar')}</button><button type="button" data-opinar-ctl="copiar" title="${attr(t('opinarCopiarTitulo'))}">${t('opinarCopiar')}</button><button type="button" data-opinar-ctl="borrar" title="${attr(t('opinarBorrarTitulo'))}">${t('opinarBorrar')}</button></span>`;
}

/**
 * Un interruptor de la barra (una preferencia de dos valores: el pintado, sobrio o animado): las dos palabras, la que
 * rige pulsada; tocar la otra escribe la preferencia (data-preferencia, data-valor) y repinta.
 */
function htmlInterruptor(i) {
  const botones = i.opciones.map((o) => `<button type="button" data-preferencia="${attr(i.clave)}" data-valor="${attr(o.valor)}" aria-pressed="${o.valor === i.valor}">${escapar(o.texto)}</button>`).join('');
  return `<span class="interruptor"${nodo('control')} role="group" aria-label="${attr(i.etiqueta)}" title="${attr(i.etiqueta)}">${botones}</span>`;
}

function htmlBarra(arbol, { ejemplos = [], ejemplo = null, guardado = '', cuentas = [], cuenta = null, sincronia = null, opinar = null } = {}) {
  const quien = htmlSoy(arbol, { cuentas, cuenta });
  const ej = !cuenta && ejemplos.length ? `<label class="ajuste"${nodo('control')}>${t('ejemplo')} <select data-ejemplo>${ejemplos.map((e) => `<option value="${attr(e.id)}" ${e.id === ejemplo ? 'selected' : ''}>${escapar(e.etiqueta)}</option>`).join('')}</select></label>` : '';
  const tiempo = arbol.tiempo ? Object.entries(arbol.tiempo).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${k}`).join(' · ') : '';
  const local = arbol.local ? `<span class="tiempo" title="${attr(t('tiempoLocalTitulo', { serie: arbol.local.serie }))}">${escapar(t('hoy', { segundos: arbol.local.gastadoHoy }))}${tiempo ? ' · ' + escapar(tiempo) : ''}</span><button type="button" class="englobar"${nodo('control')} data-englobar ${arbol.local.pendientes ? '' : 'disabled'} title="${attr(t('englobarTitulo', { cuantas: arbol.local.pendientes }))}">${t('englobar')}${arbol.local.pendientes ? ` · ${arbol.local.pendientes}` : ''}</button>` : '';
  const propios = cuenta
    ? `<button type="button"${nodo('control')} data-copia title="${attr(t('copiaTitulo'))}">${t('copiaDeSeguridad')}</button><button type="button"${nodo('control')} data-olvidar title="${attr(t('olvidarTitulo'))}">${t('olvidar')}</button>`
    : `<button type="button"${nodo('control')} data-reiniciar title="${attr(t('reiniciarTitulo'))}">${t('reiniciar')}</button>`;
  return `<header class="barra"${nodo('barra')}>${quien}${ej}${local}${(arbol.interruptores ?? []).map(htmlInterruptor).join('')}<button type="button"${nodo('control')} data-config title="${attr(t('configuracionTitulo'))}">${t('configuracion')}</button>${propios}${htmlOpinar(opinar)}<small class="guardado">${escapar(guardado)}</small>${htmlSincronia(sincronia)}</header>`;
}

/**
 * La pantalla de arranque (o el diálogo, sobre la carta): crear mi cuenta, restaurar una cuenta desde su copia, o
 * probar con un ejemplo; y, si hay cuentas en este navegador, entrar en una. `ar`: { modo: 'menu' | 'crear' |
 * 'restaurar', campos (los del alta, del núcleo), valores, motivos, ocupado }. El formulario de crear se genera de los
 * campos que da cuentas.camposDelAlta (etiquetas y ayudas del núcleo); el de restaurar pide el archivo y la frase.
 */
export function htmlArranque(ar, { cuentas = [], sobreCarta = false } = {}) {
  if (!ar) return '';
  const motivos = ar.motivos?.length ? `<ul class="motivos" role="alert">${ar.motivos.map((m) => `<li>${escapar(m.mensaje ?? m)}</li>`).join('')}</ul>` : '';
  const volver = sobreCarta ? `<button type="button" class="cerrar" data-cerrar aria-label="${attr(t('cerrar'))}">×</button>` : (ar.modo !== 'menu' ? `<button type="button" class="volver-arranque" data-arranque="menu">${t('volver')}</button>` : '');
  let cuerpo = '';
  if (ar.modo === 'crear') {
    const campos = (ar.campos ?? []).map((c) => {
      const id = 'alta-' + c.nombre;
      const valor = ar.valores?.[c.nombre] ?? c.valor ?? '';
      const control = c.opciones
        ? `<select id="${id}" name="${attr(c.nombre)}">${c.opciones.map((o) => `<option value="${attr(o)}" ${o === valor ? 'selected' : ''}>${escapar(o)}</option>`).join('')}</select>`
        : `<input id="${id}" name="${attr(c.nombre)}" type="text" value="${attr(valor)}" required autocomplete="${c.nombre === 'nombre' ? 'name' : 'off'}" placeholder="${attr((c.marcador ?? []).join(' · '))}" title="${attr(c.ayuda ?? '')}">`;
      return `<div class="campo"><label for="${id}">${escapar(c.etiqueta)} <small class="numero">${c.pv}</small></label>${control}<small class="ayuda">${escapar(c.ayuda ?? '')}</small></div>`;
    }).join('');
    cuerpo = `<form class="formulario arranque-form" data-crear aria-label="${attr(t('crearMiCuenta'))}">
      <header><h2>${t('crearMiCuenta')}</h2>${volver}</header>
      <p class="ayuda">${escapar(t('crearAyuda'))}</p>
      ${campos}${motivos}
      <footer><button type="submit" ${ar.ocupado ? 'disabled' : ''}>${t(ar.ocupado ? 'creando' : 'crear')}</button></footer>
    </form>`;
  } else if (ar.modo === 'restaurar') {
    cuerpo = `<form class="formulario arranque-form" data-restaurar aria-label="${attr(t('restaurarUnaCuenta'))}">
      <header><h2>${t('restaurarUnaCuenta')}</h2>${volver}</header>
      <p class="ayuda">${escapar(t('restaurarAyuda'))}</p>
      <div class="campo"><label for="copia-archivo">${t('archivoDeCopia')}</label><input id="copia-archivo" name="archivo" type="file" accept="application/json,.json" required></div>
      <div class="campo"><label for="copia-frase">${t('frase')}</label><input id="copia-frase" name="frase" type="password" autocomplete="off" required></div>
      ${motivos}
      <footer><button type="submit" ${ar.ocupado ? 'disabled' : ''}>${t(ar.ocupado ? 'restaurando' : 'restaurar')}</button></footer>
    </form>`;
  } else {
    const entrar = cuentas.length ? `<ul class="cuentas-lista">${cuentas.map((c) => `<li><button type="button" data-arranque="cuenta:${attr(c.alta)}">${escapar(t('entrarComo', { nombre: c.nombre }))}</button></li>`).join('')}</ul>` : '';
    cuerpo = `<div class="formulario arranque-menu" role="dialog" aria-label="${attr(t('arranqueTitulo'))}">
      <header><h2>${t('arranqueTitulo')}</h2>${volver}</header>
      <p class="ayuda">${escapar(t('arranqueIntro'))}</p>
      ${entrar}${motivos}
      <div class="opciones">
        <button type="button" class="principal" data-arranque="crear">${t('crearMiCuenta')}</button>
        <button type="button" data-arranque="restaurar">${t('restaurarUnaCuenta')}</button>
        <button type="button" data-arranque="ejemplo">${t('probarConEjemplo')}</button>
      </div>
    </div>`;
  }
  return sobreCarta ? `<div class="formulario-fondo arranque"${nodo('arranque')} data-cerrar>${cuerpo}</div>` : `<div class="arranque-pantalla arranque"${nodo('arranque')}>${cuerpo}</div>`;
}

/** El diálogo de la copia de seguridad: la frase (dos veces) y «descargar»; el eje exportado es una foto. */
export function htmlCopia(c) {
  if (!c) return '';
  const motivos = c.motivos?.length ? `<ul class="motivos" role="alert">${c.motivos.map((m) => `<li>${escapar(m.mensaje ?? m)}</li>`).join('')}</ul>` : '';
  return `<div class="formulario-fondo" data-cerrar><form class="formulario copia"${nodo('copia')} data-copia-form aria-label="${attr(t('copiaDeSeguridad'))}">
    <header><h2>${t('copiaDeSeguridad')}</h2><button type="button" class="cerrar" data-cerrar aria-label="${attr(t('cerrar'))}">×</button></header>
    <p class="ayuda">${escapar(t('copiaAyuda', { archivo: c.archivo ?? '' }))}</p>
    <p class="aviso">${escapar(t('copiaEsFoto'))}</p>
    <div class="campo"><label for="copia-frase-1">${t('frase')}</label><input id="copia-frase-1" name="frase" type="password" autocomplete="new-password" required minlength="${Number(c.minimo) || 0}"><small class="ayuda">${escapar(t('fraseAyuda', { minimo: c.minimo }))}</small></div>
    <div class="campo"><label for="copia-frase-2">${t('repetirFrase')}</label><input id="copia-frase-2" name="frase2" type="password" autocomplete="new-password" required></div>
    ${motivos}${c.hecho ? `<p class="exito" role="status">${escapar(c.hecho)}</p>` : ''}
    <footer><button type="submit" ${c.ocupado ? 'disabled' : ''}>${t(c.ocupado ? 'cifrando' : 'descargar')}</button></footer>
  </form></div>`;
}

/**
 * La carta entera como HTML. `extra`: lo que la carta no decide y la app sabe: `leidoTexto` (la lectura humana del 0,
 * src/lectura.js), `ejemplos` y `ejemplo` (el selector), `guardado`, `aviso`, `exito`, `preferencias` (el formulario
 * de configuración si está abierto), `nuevos` (los ids llegados por el diario desde la última vez: los que se animan),
 * `cuentas` y `cuenta` (mis cuentas en este navegador y la abierta, o null en un ejemplo), `arranque` (la pantalla de
 * crear, restaurar o probar, sola si no hay eje y como diálogo si lo hay), `copia` (el diálogo de la copia de seguridad),
 * `sincronia` (la línea del libro compartido, o null) y `claveLectura` (en una cuenta, la de este navegador o '').
 */
export function html(arbol, extra = {}) {
  // Sin eje (nadie ha elegido aún cuenta ni ejemplo): la pantalla de arranque entera.
  if (extra.arranque && (!arbol || arbol.vacio)) return `<div class="carta vacia">${extra.aviso ? `<p class="aviso" role="alert">${escapar(extra.aviso)}</p>` : ''}${htmlArranque(extra.arranque, { cuentas: extra.cuentas, sobreCarta: false })}</div>`;
  if (!arbol || arbol.vacio) return `<div class="carta vacia"><p class="aviso">${escapar(arbol?.avisos?.join(' · ') ?? t('sinRegistro'))}</p></div>`;
  const a = { ...arbol };
  const clase = ['carta', a.apilada ? 'carta-apilada' : 'carta-matriz', a.animado ? 'animado' : 'sobrio', `disposicion-${a.disposicion}`].join(' ');
  const laterales = Object.fromEntries(a.laterales.map((n) => [n.pv, htmlLateral(n, a)]));
  const de = (pv) => laterales[pv] ?? '';
  // La franja de la cruz se lee como la cruz: el lado del PV1 (6), arriba (8), abajo (9) y el lado del PV2 (7).
  const ordenCruz = (n) => (n.fila === 'arriba' ? 1 : n.fila === 'abajo' ? 2 : n.lado === a.laterales.find((l) => l.pv === 1)?.lado ? 0 : 3);
  const cruz = a.laterales.filter((n) => n.grupo === 'cruz').sort((p, q) => ordenCruz(p) - ordenCruz(q)).map((n) => n.pv);
  const x = LATERALES.filter((pv) => a.laterales.find((n) => n.pv === pv)?.grupo === 'x');
  const avisos = [...(a.avisos ?? []), ...(extra.aviso ? [extra.aviso] : [])];
  const escena = a.apilada
    ? `<div class="franja franja-cruz" data-franja="cruz">${cruz.map(de).join('')}</div>${htmlCentro(a.centro, a, extra)}<div class="franja franja-x" data-franja="x">${x.map(de).join('')}</div>`
    : htmlMapa(a, extra, laterales);
  return `<div class="${clase}"${nodo('carta', { modo: a.apilada ? 'apilada' : 'matriz', render: a.animado ? 'animado' : 'sobrio', ancho: a.medidas?.ancho, alto: a.medidas?.alto, x0: a.centro?.representacion?.texto ?? '' })} data-x="${a.X}" data-disposicion="${attr(a.disposicion)}" data-animaciones="${Number(a.limite) || 0}">
    ${htmlBarra(a, extra)}
    ${avisos.length ? `<p class="aviso" role="alert">${avisos.map(escapar).join(' · ')}</p>` : ''}
    ${extra.exito ? `<p class="exito" role="status">${escapar(extra.exito)}</p>` : ''}
    ${htmlRosetones(a.rosetones, { apilada: a.apilada, parte: 'arriba' })}
    <div class="escena">${escena}</div>
    ${htmlRosetones(a.rosetones, { apilada: a.apilada, parte: 'abajo' })}
    ${htmlAro(a.aro)}
    ${htmlFormulario(a.formulario)}
    ${extra.preferencias ? htmlConfiguracion(extra.preferencias, { motivos: extra.motivosPreferencias, claveLectura: extra.claveLectura, guia: extra.guiaAjustes }) : ''}
    ${extra.arranque ? htmlArranque(extra.arranque, { cuentas: extra.cuentas, sobreCarta: true }) : ''}
    ${htmlCopia(extra.copia)}
  </div>`;
}

/** Una caja de fracciones de la pantalla como estilo en tantos por ciento (lo único que el pintado hace con ella). */
/** La flecha de cada sitio de la matriz 3×3 hacia fuera (la de un vecino en la pantalla completa), por [fila][columna]. */
const FLECHAS = [['↖', '↑', '↗'], ['←', '', '→'], ['↙', '↓', '↘']];
const pct = (f) =>`${Math.round(f * 100000) / 1000}%`;
const estiloCaja = (c) => `left:${pct(c.x)};top:${pct(c.y)};width:${pct(c.ancho)};height:${pct(c.alto)}`;

/**
 * Los puntitos del foco (Mapped): los diez PV en su paso, junto a la información del foco; tocar cualquiera amplía un
 * paso todos los PV (data-todos="1"); al lado, el mando para bajarlos todos un paso (data-todos="-1").
 */
function htmlPuntos(p, X) {
  if (!p) return '';
  const punto = (q) => `<button type="button" class="punto${q.paso ? '' : ' centro'}"${nodo('control')} data-todos="1" data-color="${q.pv}" style="--lleno:${Math.round(Math.sqrt(q.paso?.fraccion ?? 0) * 1000) / 1000}" title="${attr(q.pv + ' · ' + q.etiqueta + (q.paso ? ' · ' + q.paso.texto : ''))}"${p.sube ? '' : ' aria-disabled="true"'}><span>${q.pv}</span></button>`;
  return `<div class="puntos" role="group" aria-label="${attr(t('puntosTitulo'))}" title="${attr(t('puntosTitulo'))}">${p.lista.map(punto).join('')}<button type="button" class="todos-menos"${nodo('control')} data-todos="-1" data-x="${attr(X)}" title="${attr(t('todosMenosTitulo'))}" aria-label="${attr(t('todosMenosTitulo'))}"${p.baja ? '' : ' disabled'}>−</button></div>`;
}

/**
 * Un PV en el mapa: su caja (en fracciones de la pantalla), la carta de siempre dentro, los botoncitos de ampliar y
 * reducir en la esquina que mira al centro y el asa para arrastrar desde ella (data-asa; la dirección en que crece,
 * data-dx y data-dy, es la que va de su esquina o lado hacia el centro).
 */
function htmlCeldaMapa(n, pintado) {
  const [f, c] = n.celda;
  const que = n.pv + ' · ' + n.etiqueta;
  const menos = n.mengua ? `<button type="button" class="tamano menos"${nodo('control')} data-tamano="-1" data-pv="${n.pv}" data-x="${n.X}" title="${attr(t('reducirTitulo', { que }))}" aria-label="${attr(t('reducirTitulo', { que }))}">−</button>` : '';
  const mas = n.crece ? `<button type="button" class="tamano mas"${nodo('control')} data-tamano="1" data-pv="${n.pv}" data-x="${n.X}" title="${attr(t('ampliarTitulo', { que }))}" aria-label="${attr(t('ampliarTitulo', { que }))}">+</button>` : '';
  const asa = `<span class="asa" data-asa="${n.pv}" data-x="${n.X}" data-dx="${1 - c}" data-dy="${1 - f}" title="${attr(t('asaTitulo', { que }))}"></span>`;
  return `<div class="celda fila-${f} columna-${c}${n.relleno ? ' relleno' : ''}" data-paso="${attr(n.pasoDeTamano?.nombre ?? '')}" style="${estiloCaja(n.caja)}">${pintado}<span class="mandos fila-${f} columna-${c}">${menos}${mas}${asa}</span></div>`;
}

/**
 * Mapped (VG, 10-11): la escena ocupa la ventana entera y nunca se desborda; cada PV en su caja (el árbol la trae en
 * fracciones de la pantalla), el foco en la suya con sus puntitos, y los rosetones de mi foco en su esquina o lateral,
 * por encima. Con un PV a pantalla completa: solo él, flechas a sus vecinos en su sitio de la geometría (el 0 y el 5
 * en el centro) y «volver»; sin rosetones.
 */
function htmlMapa(a, extra, laterales) {
  const centro = `<div class="celda celda-centro" style="${estiloCaja(a.mapa.centro)}">${htmlCentro(a.centro, a, extra)}</div>`;
  if (a.mapa.completa) {
    const flecha = (v) => `<button type="button" class="vecino fila-${v.fila} columna-${v.columna}${v.centro ? ' vecino-centro' : ''}"${nodo('control')} data-foco-pv="${v.pv}" data-x="${a.X}" data-color="${v.pv}" title="${attr(t('irAlPv', { pv: v.pv, que: v.etiqueta }))}" aria-label="${attr(t('irAlPv', { pv: v.pv, que: v.etiqueta }))}">${v.centro ? '' : FLECHAS[v.fila][v.columna] + ' '}${v.pv}</button>`;
    const centros = a.mapa.completa.vecinos.filter((v) => v.centro);
    return `<div class="mapa completa" data-completa="${a.mapa.completa.pv}"><div class="mapa-celdas">${centro}</div><nav class="vecinos" aria-label="${attr(t('pantallaCompleta', { que: a.centro.etiqueta }))}">${a.mapa.completa.vecinos.filter((v) => !v.centro).map(flecha).join('')}${centros.length ? `<span class="vecinos-centro">${centros.map(flecha).join('')}</span>` : ''}</nav></div>`;
  }
  const celdas = a.laterales.filter((n) => n.caja).map((n) => htmlCeldaMapa(n, laterales[n.pv] ?? '')).join('');
  return `<div class="mapa${a.mapa.matriz ? ' en-matriz' : ''}"><div class="mapa-celdas">${centro}${celdas}</div>${htmlRosetones(a.rosetones, { apilada: false, parte: 'mapa' })}</div>`;
}

/**
 * Tras pintar: los huecos Lottie se rellenan con lottie-web (si `lottie` está cargado), cada uno fijado en su
 * fotograma; solo los marcados data-animar="1" se reproducen, y nunca más de `limite` a la vez (data-animaciones de
 * la carta: la preferencia «animations»): por prioridad (data-prioridad: 0 lo nuevo y los efectos, 1 lo enfocado, 2
 * el resto) y, dentro de ella, por orden en el documento; el resto espera en su fotograma y entra cuando un efecto
 * acaba. Un efecto (data-bucle="0") se reproduce una vez y al acabar se retira; si lleva data-oculta, oculta
 * también la pieza real de su escenario (lo consumido). Los que salen de pantalla se pausan (IntersectionObserver).
 * Devuelve una función que destruye lo creado (para el siguiente pintado), con `vivas()` (cuántas se reproducen).
 */
export function trasPintar(raiz, { lottie = globalThis.lottie, limite } = {}) {
  const huecos = [...raiz.querySelectorAll('[data-lottie]')];
  const nada = Object.assign(() => {}, { vivas: () => 0 });
  if (!huecos.length) return nada;
  if (!lottie) {
    for (const h of huecos) h.classList.add('sin-lottie');
    return nada;
  }
  const tope = Number(limite ?? raiz.querySelector('[data-animaciones]')?.dataset.animaciones) || Infinity;
  const vivas = [];
  let obs = null;
  const cache = new Map();
  const datos = async (ruta) => {
    if (!cache.has(ruta)) cache.set(ruta, fetch(ruta).then((r) => (r.ok ? r.json() : null)).catch(() => null));
    const d = await cache.get(ruta);
    return d ? JSON.parse(JSON.stringify(d)) : null;
  };
  // Quién se reproduce: las que piden animarse, por prioridad y orden; las primeras `tope` tienen sitio.
  const candidatas = huecos.filter((h) => h.dataset.animar === '1').map((h, k) => ({ h, k, p: Number(h.dataset.prioridad) || 0 })).sort((a, b) => a.p - b.p || a.k - b.k).map((x) => x.h);
  const conSitio = new Set(candidatas.slice(0, Number.isFinite(tope) ? tope : candidatas.length));
  const enEspera = candidatas.slice(conSitio.size);
  const reproduciendo = () => vivas.filter((a) => !a.isPaused && !a.__acabada).length;
  const arrancar = (h) => { if (h.__anim && h.__cargada && conSitio.has(h) && h.__visible !== false && !h.__anim.__acabada) h.__anim.play(); };
  const darSitio = () => { while (enEspera.length && reproduciendo() < tope) { const h = enEspera.shift(); conSitio.add(h); arrancar(h); } };
  if ('IntersectionObserver' in globalThis) {
    obs = new IntersectionObserver((entradas) => {
      for (const e of entradas) {
        const a = e.target.__anim;
        if (!a) continue;
        e.target.__visible = e.isIntersecting;
        if (e.isIntersecting) arrancar(e.target);
        else if (!a.isPaused) a.pause();
      }
    }, { rootMargin: '50px' });
  }
  for (const h of huecos) {
    datos('./' + h.dataset.lottie).then((animationData) => {
      if (!animationData || !h.isConnected) return;
      const unaVez = h.dataset.bucle === '0';
      const anim = lottie.loadAnimation({ container: h, renderer: 'svg', loop: !unaVez, autoplay: false, animationData, rendererSettings: { preserveAspectRatio: 'xMidYMid meet' } });
      h.__anim = anim;
      vivas.push(anim);
      const f = Number(h.dataset.fotograma) || 0;
      anim.addEventListener('DOMLoaded', () => {
        anim.goToAndStop(Math.min(f, Math.max(0, anim.totalFrames - 1)), true);
        h.__cargada = true;
        arrancar(h);
      });
      if (unaVez) {
        anim.addEventListener('complete', () => {
          anim.__acabada = true;
          if (h.classList.contains('pieza-efecto')) {
            h.classList.add('acabado');
            if (h.dataset.oculta === '1') h.closest('[data-escenario]')?.classList.add('consumida');
          }
          darSitio();
        });
      }
      if (obs) obs.observe(h);
    });
  }
  return Object.assign(() => {
    if (obs) obs.disconnect();
    for (const a of vivas) a.destroy();
  }, { vivas: reproduciendo });
}
