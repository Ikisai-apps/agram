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
import { cssSeguro } from '../src/contrato.js';

export const escapar = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const corto = (id) => String(id ?? '').slice(0, 8);
const attr = (s) => escapar(s).replace(/'/g, '&#39;');

/**
 * Los atributos de clasificación de un elemento (para el botón «opinar», carta/opinar.js clasificar): data-nodo es el
 * tipo (carta, sitio, control, foco, pv, ocupante, campo, aro, hueco, accion, camino, paso, roseton, diario,
 * formulario, configuracion, copia) y data-nodo-* lo que lo sitúa y aún no dicen los data-* de la carta (data-x,
 * data-pv, data-centro, data-roseton): x0 (el texto del 0 del registro), d (la posición de un campo), tam (oculto,
 * comprimido, tarjeta, bloque o foco), rep (la representación elegida), cara, modo, ancho, alto. Solo se escriben
 * los que hay.
 */
const NOMBRE_NIVEL = Object.freeze(Object.fromEntries(Object.entries(NIVEL).map(([k, v]) => [v, k])));
const repDe = (r) => (r ? `${r.recurso ? 'imagen' : 'texto'}${r.formato ? ':' + r.formato : ''}${r.tamano !== undefined ? '@' + r.tamano : ''}` : 'ninguna');
const nodo = (tipo, campos = {}) => ` data-nodo="${tipo}"` + Object.entries(campos).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => ` data-nodo-${k}="${attr(v)}"`).join('');

/** Quién convierte un adjunto «archivo:<sha256>» en su URL (#22, #25): lo instala la app (resolverArchivos); sin él, null. */
let resolverDeArchivos = null;
/** La app instala aquí cómo se sirve un adjunto por su hash (la función `archivos` con la clave del eje que tiene en local). */
export function resolverArchivos(fn) {
  resolverDeArchivos = typeof fn === 'function' ? fn : null;
}
const RE_ARCHIVO = /^archivo:[0-9a-f]{64}$/;
/**
 * La dirección con que se pide el recurso de una pieza: una URL http(s) tal cual (las del eje ya pasaron la lista blanca
 * de la época, modelos.recursoAdmitido), un adjunto «archivo:<sha256>» por el resolutor de la app (sin él, null: no se
 * pinta) y una ruta del repositorio relativa a la página.
 */
export function srcDeRecurso(recurso) {
  if (typeof recurso !== 'string' || !recurso) return null;
  if (RE_ARCHIVO.test(recurso)) {
    const url = resolverDeArchivos?.(recurso.slice('archivo:'.length));
    return typeof url === 'string' && /^(https?:|blob:)/.test(url) ? url : null;
  }
  if (/^https?:\/\//.test(recurso)) return recurso;
  return './' + recurso;
}

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
    const src = srcDeRecurso(pieza.recurso);
    if (!src) return ''; // un adjunto sin resolutor (o sin red): no se pinta
    const fotogramas = pieza.fotogramas ?? 0;
    const k = paso && typeof paso.k === 'number' && paso.de ? Math.min(paso.k, paso.de) : 0;
    const de = paso && paso.de ? paso.de : 10;
    const fotograma = fotogramas ? Math.round((k * fotogramas) / de) : 0;
    if (pieza.animado || pieza.bucle) {
      const modo = animar === true ? ANIMAR.bucle : animar || ANIMAR.no;
      const bucle = modo === ANIMAR.una ? 0 : modo === ANIMAR.bucle ? 1 : pieza.bucle ? 1 : 0;
      return `<div class="${clases.concat('pieza-lottie').join(' ')}" data-lottie="${attr(pieza.recurso)}" data-fotograma="${fotograma}" data-animar="${modo === ANIMAR.no ? 0 : 1}" data-bucle="${bucle}" data-prioridad="${prioridad}"${oculta ? ' data-oculta="1"' : ''} role="img" aria-label="${attr(alt || pieza.tipo)}"></div>`;
    }
    return `<img class="${clases.concat('pieza-imagen').join(' ')}" src="${attr(src)}" alt="${attr(alt || pieza.tipo)}" loading="lazy" decoding="async">`;
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

/** El marco de un PV comprimido (una celda diminuta), estirado a su caja (solo con recurso); en los demás tamaños, htmlMarcoCapa. */
const htmlMarco = (marco) => (marco?.recurso ? htmlPieza(marco, { clase: 'pieza-marco', alt: '' }) : '');

// ---------- El animado a pantalla completa: capas sobre el sobrio (VG, 11-11) ----------
// «El animado es el sobrio añadiéndole las imágenes animadas y los fondos»: la rejilla de un mundo es la misma en los
// dos modos y el animado solo AÑADE nodos, todos con la clase `capa`; quitarlos devuelve el HTML sobrio exacto. Nada
// de lo que añaden ocupa sitio (todo es absoluto: dónde va cada uno lo dice estilo.css, por `data-forma`).

/** Una pieza como capa: la de htmlPieza con la clase `capa` y la de su papel. */
const capaPieza = (pieza, { clase = '', ...op } = {}) => (pieza?.recurso ? htmlPieza(pieza, { alt: '', ...op, clase: 'capa ' + clase }) : '');

/**
 * El dibujo del mundo dentro de un hijo (celda.capa o banda.capa): el del hijo (o el del vacío), uno por ocupante y el
 * sello de lo hecho, detrás de su texto; su tamaño escala con la cifra del hijo (--total, solo CSS). Los ocupantes, si
 * se dan, sustituyen a los de la capa (los de las bandas, que los lleva cada ocupante).
 */
function htmlDibujo(capa, ocupantes = capa?.ocupantes ?? []) {
  if (!capa || (!capa.hijo && !ocupantes.length && !capa.hecho)) return '';
  const hijo = capa.hijo?.recurso ? htmlPieza(capa.hijo, { clase: 'dibujo-hijo', alt: '' }) : '';
  const unos = ocupantes.filter((p) => p?.recurso).map((p) => htmlPieza(p, { clase: 'dibujo-ocupante', alt: '' })).join('');
  const hecho = capa.hecho?.recurso ? htmlPieza(capa.hecho, { clase: 'dibujo-hecho', alt: '' }) : '';
  return `<div class="capa capa-dibujo${capa.hijo ? '' : ' sin-hijo'}" style="--total:${Number(capa.total) || 0}" aria-hidden="true">${hijo}${unos ? `<span class="dibujo-ocupantes">${unos}</span>` : ''}${hecho}</div>`;
}

/** Los efectos de lo nuevo sobre un hijo o sobre el centro del mundo: una vez, sin caja, sin recibir el ratón. */
function htmlEfectosCapa(n, clase = '') {
  const efectos = (n?.efectos ?? []).filter((e) => e.pieza?.recurso);
  if (!efectos.length) return '';
  return `<div class="capa capa-efectos${clase ? ' ' + clase : ''}" aria-hidden="true">${efectos.map((e) => htmlPieza(e.pieza, { animar: ANIMAR.una, clase: 'pieza-efecto efecto-' + attr(e.clave), prioridad: 0, alt: e.clave })).join('')}</div>`;
}

/** El dibujo de un ocupante dentro de su propia forma (la bola de una cuenta, la estrella del cielo). */
const htmlDibujoDeOcupante = (o) => (o?.dibujo?.recurso ? htmlPieza(o.dibujo, { clase: 'capa capa-ocupante', alt: '' }) : '');

/** Las cuatro esquinas del marco, por dónde se recorta el dibujo (CSS: .marco-esquina.<esquina>). */
const ESQUINAS = Object.freeze(['arriba-izquierda', 'arriba-derecha', 'abajo-izquierda', 'abajo-derecha']);

/**
 * El marco del mundo alrededor de la rejilla entera. El dibujo del marco es un cuadrado (sus trazos son cuadrados,
 * redondos o hexagonales) y la rejilla no: para rodearla sin deformarlo, cada esquina enseña la esquina del dibujo
 * (el mismo <img>, recortado) y una línea del color del mundo las une (CSS).
 */
function htmlMarcoCapa(marco) {
  const src = srcDeRecurso(marco?.recurso);
  if (!src) return '';
  const img = `<img src="${attr(src)}" alt="" loading="lazy" decoding="async">`;
  return `<div class="capa capa-marco" aria-hidden="true">${ESQUINAS.map((e) => `<span class="marco-esquina ${e}">${img}</span>`).join('')}</div>`;
}

/** El personaje del mundo en el hueco entre celdas (dónde, por data-forma en CSS); detrás, su dibujo quieto por si Lottie no carga. */
function htmlPersonajeCapa(k, r) {
  const p = k?.personaje;
  if (!p?.pieza?.recurso) return '';
  const hoy = r.forma === 'franjas' && r.bandas?.length ? (r.bandas.findIndex((b) => b.ahora) === 0 ? 'inicio' : 'fin') : '';
  const quieto = p.pieza.animado && k.respaldo?.recurso ? htmlPieza(k.respaldo, { clase: 'respaldo', alt: p.rol ?? '' }) : '';
  const vivo = htmlPieza(p.pieza, { animar: p.animar, clase: 'pieza-personaje accion-' + attr(p.accion), prioridad: p.animar === ANIMAR.una ? 0 : 1, alt: p.rol ?? p.accion });
  const sitio = r.sitio?.X ? ` data-sitio="${attr(r.sitio.lugar)}" data-sitio-x="${attr(r.sitio.X)}" title="${attr(t('sitioTitulo', { lugar: r.sitio.lugar }))}"` : '';
  return `<div class="capa capa-personaje" style="--columnas:${Number(r.columnas) || 1};--filas:${Number(r.filas) || 1}"${hoy ? ` data-hoy="${hoy}"` : ''}${sitio}>${quieto}${vivo}</div>`;
}

/**
 * Lo que la app sabe de los archivos adjuntos de esta pestaña (extra.archivo: id → { estado, texto?, url?, motivo? },
 * carta/archivos.js); html() lo fija en cada pintado. Sin él, un archivo se pinta como «no disponible».
 */
let archivoDe = () => null;

/**
 * La política que lleva delante el HTML aislado (además del sandbox): nada se pide fuera (sin red, sin referer), solo
 * lo incrustado (data:) y los estilos propios. Va tras el doctype, si lo hay, para no cambiar el modo del documento.
 */
const POLITICA_AISLADA = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; media-src data:">`;
const conPolitica = (html) => {
  const m = /^\uFEFF?\s*<!doctype[^>]*>/i.exec(html);
  return m ? m[0] + POLITICA_AISLADA + html.slice(m[0].length) : POLITICA_AISLADA + html;
};

/**
 * Una representación que se pinta aislada (rep.aislada: el HTML adjunto, issue #21, SEG-14): SOLO dentro de un
 * <iframe sandbox=""> (sin allow-scripts ni allow-same-origin: no ejecuta nada, origen opaco, sin formularios ni
 * ventanas), sin referer, con su contenido en srcdoc escapado como atributo y la política de arriba; la carta no lo lee
 * ni lo cambia. Mientras llega, o si no está (o pasa del tope), un hueco con su estado.
 */
function htmlAislada(rep, clase) {
  const a = rep.archivo ? archivoDe(rep.archivo) : null;
  if (typeof a?.texto === 'string') {
    return `<iframe class="${clase} rep-aislada" sandbox="" referrerpolicy="no-referrer" title="${attr(t('archivoTitulo', { que: rep.texto ?? '' }))}" data-archivo="${attr(rep.archivo)}" srcdoc="${attr(conPolitica(a.texto))}"></iframe>`;
  }
  const estado = a?.estado === 'cargando' ? t('archivoCargando') : a?.motivo ?? t('archivoNoDisponible');
  return `<span class="${clase} rep-aislada rep-pendiente" data-archivo="${attr(rep.archivo ?? '')}" role="status">${escapar(estado)}</span>`;
}

/** Una representación del 0 como HTML: texto, la imagen que cabe (solo llega con recurso en animado), la de un archivo adjunto (su URL local) o el HTML aislado. */
function htmlRepresentacion(rep, { clase = 'rep' } = {}) {
  if (!rep) return `<span class="${clase} rep-vacia">—</span>`;
  if (rep.aislada) return htmlAislada(rep, clase);
  if (rep.archivo) {
    const url = archivoDe(rep.archivo)?.url;
    return typeof url === 'string' && url.startsWith('blob:')
      ? `<img class="${clase} rep-imagen" src="${attr(url)}" alt="${attr(rep.texto ?? '')}" loading="lazy">`
      : `<span class="${clase} rep-pendiente" data-archivo="${attr(rep.archivo)}">${escapar(rep.texto ?? t('archivoNoDisponible'))}</span>`;
  }
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

/**
 * Un ocupante: una hoja, su texto; una referencia, un botón que entra en el registro; una décupla, sus hojas. En animado,
 * delante, su elemento (la pieza suelta del mundo); con `capa` (Mapped, #16), el elemento (o la imagen de su
 * representación) es una capa al final, absoluta, y el ocupante queda como en sobrio.
 */
function htmlOcupante(o, { capa = false } = {}) {
  const dentro = o.anidados?.length ? o.anidados.map((g) => `<ul class="ocupantes anidados" data-anidado="${g.pv}">${g.lista.map((x) => `<li>${htmlOcupante(x, { capa })}</li>`).join('')}</ul>`).join('') : '';
  return htmlOcupanteSolo(o, { capa }) + dentro;
}

/** El data-id de un ocupante que es un registro con estilo (el de la rejilla): a él se aplica `[data-id="…"]` (htmlEstilos). */
const dataId = (o) => (o?.estilo && o.X ? ` data-id="${attr(o.X)}"` : '');

function htmlOcupanteSolo(o, { capa = false } = {}) {
  if (capa) {
    // Mapped (#16): el dibujo, una capa detrás de lo que se lee; el ocupante, el del sobrio (sin el dato de su representación).
    const dibujo = o.tipo === 'referencia' && o.representacion?.recurso && typeof o.representacion.recurso === 'string' ? o.representacion : o.elemento;
    const img = capaPieza(dibujo, { clase: 'capa-elemento' });
    const sobrio = htmlOcupanteSolo({ ...o, elemento: null, representacion: o.representacion?.recurso ? null : o.representacion });
    return img ? sobrio.replace(/<\/(button|span)>$/, `${img}</$1>`) : sobrio;
  }
  const elemento = o.elemento?.recurso ? htmlPieza(o.elemento, { clase: 'pieza-elemento', alt: '' }) : '';
  if (o.tipo === 'referencia' && o.X) {
    const rep = o.representacion?.recurso ? htmlRepresentacion(o.representacion, { clase: 'rep-mini' }) : elemento;
    return `<button type="button" class="ocupante ocupante-ref"${nodo('ocupante', { x0: o.texto, rep: repDe(o.representacion) })}${o.pv !== null && o.pv !== undefined ? ` data-pv="${o.pv}"` : ''}${dataId(o)} data-abrir="${o.X}" data-x="${o.X}" title="${attr(t('entrarEn', { que: o.texto }))}">${rep}<span class="texto">${escapar(o.texto)}</span>${o.autor ? `<small class="quien">${escapar(o.autor)}</small>` : ''}</button>`;
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
  if (o.arriba) return htmlCuenta(o); // el hilo hacia arriba del 6 (#45), con su marca, también sin franja
  if (o.tipo !== 'entrada') return htmlOcupanteSolo(o);
  return `<button type="button" class="ocupante ocupante-ref ocupante-entrada"${nodo('ocupante')} data-pv="${o.pv}" data-abrir="${attr(o.ref)}" data-x="${attr(o.ref)}" title="${attr(o.t)}"><span class="texto">${escapar(o.texto)}</span><small class="quien">${escapar(o.t.replace('T', ' ').replace('Z', ''))}</small></button>`;
}

/** Un ocupante de una celda de la rejilla: si se puede entrar, un clic baja un nivel (data-celda) y un botoncito abre el registro. */
function htmlOcupanteDeCelda(o) {
  if (o.entra) {
    return `<button type="button" class="ocupante ocupante-ref ocupante-celda"${nodo('ocupante', { x0: o.texto })} data-pv="${o.pv}"${dataId(o)} data-celda="${o.X}" data-x="${o.X}" title="${attr(t('entrarEnCelda', { que: o.texto }))}"><span class="texto">${escapar(o.texto)}</span>${o.autor ? `<small class="quien">${escapar(o.autor)}</small>` : ''}</button><button type="button" class="celda-abrir"${nodo('control')} data-abrir="${o.X}" data-x="${o.X}" title="${attr(t('abrirEnCelda', { que: o.texto }))}" aria-label="${attr(t('abrirEnCelda', { que: o.texto }))}">↗</button>`;
  }
  return htmlOcupanteSolo(o);
}

/** Una hora del libro en corto: «2026-11-07 13:30». */
const fecha = (s) => String(s ?? '').replace('T', ' ').replace(/(:\d\d)?(\.\d+)?Z$/, '');

/**
 * Un hueco vacío donde se puede crear un elemento (issue #22): la posición `pv` de R. Mantenerlo pulsado abre el aro
 * con un input nuevo (gestos.js, data-hueco-x y data-hueco-pv). En la rejilla, el registro que se divide va en el
 * contenedor (data-hueco-x) y la posición es el dígito de cada hijo (su data-pv); a pantalla completa, el espacio libre
 * del contenedor es el propio mundo (data-hueco-pv).
 */
const htmlHueco = (R, pv) => (R && Number.isInteger(pv) ? ` data-hueco-x="${attr(R)}" data-hueco-pv="${pv}" title="${attr(t('huecoVacioTitulo'))}"` : '');

/** El paso del camino de un hueco vacío (la regla del vacío): «escribir aquí · <acción por defecto de su PV>»; `antes`, lo que va delante («vacía»). */
const htmlEscribir = (e, antes = '') => `<span class="hijo-vacio">${escapar((antes ? antes + ' · ' : '') + (e?.nombre ? t('escribirAquiAccion', { accion: e.nombre }) : t('escribirAqui')))}</span>`;

/** Una fila de la tabla de una esquina de la cruceta: una décupla, una columna por hoja; lo demás, el ocupante en una celda. */
function htmlFilaDeTabla(o) {
  if (o.tipo === 'decupla') return `<tr${nodo('ocupante')}${marcaDerivado(o)}>${o.hojas.map((h) => `<td>${escapar(h)}</td>`).join('')}</tr>`;
  return `<tr${marcaDerivado(o)}><td colspan="10">${htmlOcupanteDeCelda(o)}</td></tr>`;
}

/** Lo derivado del libro en una celda (encargo «lecturas»): solo una clase y el porqué en el title, sin cambiar la forma; con su relación (VG 12-11: directo, heredado o del hilo), otra clase y su texto. */
const RELACION_DERIVADA = Object.freeze({ arriba: 'derivadoArriba', directo: 'derivadoDirecto', heredado: 'derivadoHeredado' });
const marcaDerivado = (o) => (o?.derivado ? ` class="derivado${RELACION_DERIVADA[o.relacion] ? ' ' + o.relacion : ''}" title="${attr([t('derivadoPor', { por: o.por ?? '' }), RELACION_DERIVADA[o.relacion] ? t(RELACION_DERIVADA[o.relacion]) : ''].filter(Boolean).join(' · '))}"` : '');

/** Un mensaje de la conversación: el ocupante con su autor y su hora (como una entrada del diario, ocupante-entrada); si se puede entrar, baja un nivel. */
function htmlMensaje(o) {
  const pie = [o.autor, o.t ? fecha(o.t) : ''].filter(Boolean).join(' · ');
  const estado = o.estado ? `<small class="paquete" data-estado="${attr(o.estado)}">${escapar(t('paquete' + o.estado.charAt(0).toUpperCase() + o.estado.slice(1)))}</small>` : '';
  const quien = (pie ? `<small class="quien">${escapar(pie)}</small>` : '') + estado;
  if (o.tipo === 'referencia' && o.X) {
    const accion = o.entra ? `data-celda="${o.X}" title="${attr(t('entrarEnCelda', { que: o.texto }))}"` : `data-abrir="${o.X}" title="${attr(t('entrarEn', { que: o.texto }))}"`;
    return `<button type="button" class="ocupante ocupante-ref ocupante-entrada mensaje"${nodo('ocupante', { x0: o.texto })} data-pv="${o.pv}"${dataId(o)} ${accion} data-x="${o.X}"><span class="texto">${escapar(o.texto)}</span>${quien}</button>`;
  }
  return `<span class="ocupante ocupante-hoja ocupante-entrada mensaje"${nodo('ocupante')}><span class="texto">${escapar(o.texto)}</span></span>`;
}

/** El nivel siguiente dentro de una columna del 2: por cada ocupante que es un registro, sus hijos (nombre y cuántos; los vacíos, con su paso del camino). */
function htmlSiguiente(s) {
  if (!s?.length) return '';
  const hijo = (h, X) => `<li class="siguiente-hijo${h.vacio ? ' vacia' : ''}" data-color="${h.digito}"${h.vacio ? ' data-vacio' + htmlHueco(X, h.digito) : ''}><span class="numero">${h.digito}</span><span class="siguiente-nombre">${escapar(h.nombre ?? '')}</span>${h.vacio ? htmlEscribir(h.escribir) : `<span class="siguiente-cifra">${escapar(h.total)}</span>`}</li>`;
  return `<div class="siguiente"><h5 class="siguiente-titulo">${t('siguienteNivel')}</h5>${s.map((r) => `<div class="siguiente-de" data-x="${attr(r.X)}"><span class="siguiente-texto">${escapar(r.texto)}</span><ol class="siguiente-hijos">${r.hijos.map((h) => hijo(h, r.X)).join('')}</ol></div>`).join('')}</div>`;
}

/** Lo de dentro de un hijo con ocupantes, según la forma de su mundo: la tabla de la cruceta, la conversación, la lista (con el nivel siguiente en las columnas). */
function cuerpoDeHijo(c, forma) {
  const lista = [...(c.ocupantes ?? (c.ocupante ? [c.ocupante] : [])), ...(c.derivados ?? [])];
  if (!lista.length && Number.isInteger(c.capaDelTres)) return `<span class="hijo-vacio">${escapar(t('capaVacia'))}</span>`; // una capa de la conversación del 3 (encargo pv3): nada que escribir ahí
  if (!lista.length) return c.vacio ? htmlEscribir(c.escribir) : '';
  if (forma === 'cruceta') return `<table class="hijo-tabla"><tbody>${lista.map(htmlFilaDeTabla).join('')}</tbody></table>`;
  if (forma === 'conversacion') return `<ol class="conversacion">${lista.map((o) => `<li${marcaDerivado(o)}>${htmlMensaje(o)}</li>`).join('')}</ol>`;
  return `<ul class="hijo-lista">${lista.map((o) => `<li${marcaDerivado(o)}>${htmlOcupanteDeCelda(o)}</li>`).join('')}</ul>${forma === 'columnas' ? htmlSiguiente(c.siguiente) : ''}`;
}

/**
 * Una celda de la rejilla de un mundo: la de un hijo (su dígito en data-pv, de él el color), con los ganchos del
 * animado: `.hijo-nombre`, `.hijo-cifra` (cuántos tiene) y `.hijo-cuerpo` (lo de dentro, según la forma). Un hijo sin
 * ocupantes lleva data-vacio: el nombre apagado, el paso del camino que lo llenaría y nada que entrar. En la escalera,
 * cada peldaño su escalón (--peldano).
 */
function htmlCeldaDeRejilla(c, forma) {
  if (c.personas) return htmlCajaDelTres(c);
  const lista = [...(c.ocupantes ?? (c.ocupante ? [c.ocupante] : [])), ...(c.derivados ?? [])];
  const peldano = forma === 'escalera' ? ` style="--peldano:${c.fila}"` : '';
  const cifra = c.vacio || c.total === undefined ? '' : escapar(c.total + (c.totalDerivados ?? 0));
  return `<div class="rejilla-celda hijo${lista.length ? '' : ' vacia'}" data-color="${c.pv}" data-pv="${c.pv}" data-fila="${c.fila}" data-columna="${c.columna}"${c.vacio ? ' data-vacio' : ''}${peldano}><header class="hijo-cabeza"><span class="numero">${c.pv}</span><span class="hijo-nombre">${escapar(c.nombre ?? '')}</span><span class="hijo-cifra">${cifra}</span>${htmlInterrogante(c.sitio)}</header><div class="hijo-cuerpo">${cuerpoDeHijo(c, forma)}${htmlDibujo(c.capa)}</div>${htmlMedidaDeHijo(c)}${htmlEfectosCapa(c.capa?.efectos)}${Number.isInteger(c.bajar) ? `<button type="button" class="bajar"${nodo('control')} data-bajar="${c.bajar}" title="${attr(t('bajarTitulo', { d: c.bajar }))}" aria-label="${attr(t('bajarTitulo', { d: c.bajar }))}">↘</button>` : ''}</div>`;
}

/**
 * El personaje de un sitio (VG, 12-11, issue #38): el interrogante en sobrio y, en animado, el muñeco en el MISMO botón
 * (una capa: quitarla da el sobrio exacto); pulsarlo abre la cruceta del propio nodo X.<lugar> como menú de configuración
 * (data-sitio, data-sitio-x). El del 0 de mi alta (`general`, data-sitio-general) lleva además las opciones de lo que era la barra.
 */
function htmlInterrogante(s, { clase = '' } = {}) {
  if (!s?.X) return '';
  const titulo = attr(s.general ? t('sitioCero') : t('sitioTitulo', { lugar: s.lugar }));
  const muneco = s.personaje?.pieza?.recurso
    ? `<span class="capa capa-sitio" aria-hidden="true">${htmlPieza(s.personaje.pieza, { animar: ANIMAR.no, clase: 'pieza-sitio accion-' + attr(s.personaje.accion), prioridad: 2, alt: s.personaje.rol ?? '' })}</span>`
    : '';
  return `<button type="button" class="sitio-interrogante${clase ? ' ' + clase : ''}"${nodo('control')} data-sitio="${attr(s.lugar)}" data-sitio-x="${attr(s.X)}"${s.general ? ' data-sitio-general' : ''} title="${titulo}" aria-label="${titulo}">?${muneco}</button>`;
}

/**
 * Una persona en una caja del 3 (encargo pv3): su nombre y el marcador pequeño del canal de R (doy: la R mía que tiene;
 * recibo: la suya que tengo yo). Un clic entra en su conversación (data-celda, su alta); mantener abre el aro de su alta;
 * arrastrarla a otra caja la reclasifica (data-persona, data-caja: gestos.js).
 */
function htmlPersona(p) {
  const marca = (clase, n, titulo) => (n > 0 ? `<small class="${clase}" title="${attr(t(titulo, { n }))}">${escapar(n)}</small>` : '');
  const marcador = `<span class="marcador">${marca('doy', p.doy, 'marcadorDoy')}${marca('recibo', p.recibo, 'marcadorRecibo')}</span>`;
  const entrar = p.entra ? ` data-celda="${attr(p.X)}"` : '';
  const titulo = t(p.cae ? 'personaCae' : 'personaTitulo', { que: p.texto });
  return `<button type="button" class="ocupante persona"${nodo('ocupante', { x0: p.texto })} data-persona="${attr(p.identidad)}" data-caja="${p.caja}" data-pv="${p.caja}"${p.X ? ` data-x="${attr(p.X)}"` : ''}${entrar} data-porque="${attr(p.porque ?? '')}" title="${attr(titulo)}"><span class="texto">${escapar(p.texto)}</span>${marcador}</button>`;
}

/**
 * Una caja del 3 por tema (encargo pv3): su número y su grupo, cuántos tiene, el botón que cicla doy / recibo / todos
 * (data-filtro-caja) y el interrogante de su nodo; dentro, sus personas; al pie, sus mínimos y cuántos cayeron al 0. Es
 * donde se suelta a alguien al arrastrarlo (data-caja).
 */
function htmlCajaDelTres(c) {
  const filtro = `<button type="button" class="filtro-caja"${nodo('control')} data-filtro-caja="${c.caja}" data-filtro="${attr(c.filtro)}" title="${attr(t('filtroTitulo'))}">${escapar(t('filtro_' + c.filtro))}</button>`;
  const cuerpo = c.personas.length ? `<ul class="personas">${c.personas.map((p) => `<li>${htmlPersona(p)}</li>`).join('')}</ul>` : `<span class="hijo-vacio">${escapar(t(c.total ? 'cajaFiltrada' : 'cajaVacia'))}</span>`;
  const m = c.minimo ?? {};
  const pie = [
    typeof m.cantidad === 'number' ? t('cajaMinimo', { n: m.cantidad }) : '',
    m.rango ? t(c.rangoPendiente ? 'cajaRangoPendiente' : 'cajaRango', { rango: m.rango }) : '',
    c.fuera ? t('cajaFuera', { n: c.fuera }) : '',
  ].filter(Boolean);
  return `<div class="rejilla-celda hijo caja-tres${c.total ? '' : ' vacia'}" data-color="${c.pv}" data-pv="${c.pv}" data-caja="${c.caja}" data-fila="${c.fila}" data-columna="${c.columna}"${c.vacio ? ' data-vacio' : ''}><header class="hijo-cabeza"><span class="numero">${c.pv}</span><span class="hijo-nombre">${escapar(c.nombre ?? '')}</span><span class="hijo-cifra">${c.total ? escapar(c.total) : ''}</span>${filtro}${htmlInterrogante(c.sitio)}</header><div class="hijo-cuerpo">${cuerpo}${htmlDibujo(c.capa)}</div>${pie.length ? `<footer class="hijo-pie"><p class="hijo-minimo">${escapar(pie.join(' · '))}</p></footer>` : ''}</div>`;
}

/**
 * La cruceta del propio nodo de un sitio (encargo pv3, #38): sus diez posiciones en la geometría de la cruz (1-4 las
 * esquinas, 6-9 la cruz, 0 y 5 en el centro), cada una con su nombre, su valor y, si quien mira es el dueño, el botón
 * de la acción que la pone (data-sitio-lanzar, con los parámetros del sitio en data-valores: el formulario del aro).
 */
function htmlSitio(s, arbol = null, extra = {}) {
  if (!s) return '';
  const controles = s.general && arbol ? controlesDelCero(arbol, extra) : {};
  const celdas = new Map();
  for (const p of s.posiciones) {
    const k = p.celda.join(',');
    celdas.set(k, [...(celdas.get(k) ?? []), p]);
  }
  const posicion = (p) => `<div class="sitio-posicion" data-posicion="${p.posicion}" data-color="${p.posicion}"><span class="numero">${p.posicion}</span><span class="nombre">${escapar(p.nombre ?? '')}</span><span class="valor">${escapar(p.valor || '—')}</span>${controles[p.posicion] ? `<div class="sitio-controles"${nodo('sitio-controles', { posicion: p.posicion })}>${controles[p.posicion]}</div>` : ''}${p.accion ? `<button type="button" class="accion"${nodo('accion')} data-sitio-lanzar="${attr(p.accion.id)}" data-x="${attr(s.X)}" data-valores="${attr(JSON.stringify(p.accion.valores ?? {}))}" title="${attr(p.accion.etiqueta)}">${escapar(p.accion.etiqueta)}</button>` : ''}</div>`;
  const cuerpo = [...celdas.entries()].map(([k, ps]) => { const [f, c] = k.split(','); return `<li class="sitio-celda" style="--fila:${Number(f) + 1};--columna:${Number(c) + 1}">${ps.map(posicion).join('')}</li>`; }).join('');
  return `<div class="sitio-fondo" data-cerrar><div class="sitio-cruceta"${nodo('sitio', { lugar: s.lugar })} data-x="${attr(s.X)}" data-sitio-de="${attr(s.lugar)}"${s.general ? ' data-sitio-general' : ''} role="dialog" aria-label="${attr(t('sitioDe', { lugar: s.lugar, que: s.texto }))}"><header><h2><span class="sitio-icono" aria-hidden="true">?</span> ${escapar(t(s.general ? 'sitioCeroDe' : 'sitioDe', { lugar: s.lugar, que: s.texto }))}</h2><button type="button" class="cerrar" data-cerrar aria-label="${attr(t('cerrar'))}">×</button></header><ol class="sitio-posiciones">${cuerpo}</ol></div></div>`;
}

/** Una fracción entre 0 y 1 con tres decimales, para una variable de CSS (solo un número: nada del dato llega al estilo). */
const fraccionCss = (x) => (Number.isFinite(x) ? Math.round(Math.min(1, Math.max(0, x)) * 1000) / 1000 : 0);

/**
 * Lo que el núcleo mide de un hijo, pequeño, debajo de su cuerpo (encargo «datos», issue #11): en el 2, la línea
 * «umbral n · faltan m» (si el criterio del dueño dice esa mirada) y los votos (P comprometido y reposicionable sobre
 * esa mirada), con una barra: hacia el umbral si lo hay; si no, la parte comprometida de los votos. En el 3, el grupo de
 * atención y su precio.
 */
function htmlMedidaDeHijo(c) {
  const partes = [];
  if (c.meta) partes.push(t('hijoUmbral', { umbral: c.meta.umbral, faltan: c.meta.faltan }));
  if (c.votos) partes.push(t('hijoVotos', { comprometidos: c.votos.comprometidos, reposicionables: c.votos.reposicionables }));
  let barra = '';
  if (c.meta && c.meta.umbral > 0) barra = `<span class="hijo-barra" data-de="umbral"${c.meta.pasa ? ' data-pasa' : ''} style="--lleno:${fraccionCss(c.meta.valor / c.meta.umbral)}" title="${attr(t('hijoBarraUmbral', { valor: c.meta.valor, umbral: c.meta.umbral }))}"><span></span></span>`;
  else if (c.votos) barra = `<span class="hijo-barra" data-de="votos" style="--lleno:${fraccionCss(c.votos.comprometidos / (c.votos.comprometidos + c.votos.reposicionables))}" title="${attr(partes[partes.length - 1])}"><span></span></span>`;
  const medida = partes.length ? `<p class="hijo-medida">${escapar(partes.join(' · '))}</p>${barra}` : '';
  const precio = c.precio ? `<p class="hijo-precio" data-zona="${escapar(c.precio.zona)}"><b>${escapar(c.precio.grupo ?? '')}</b> · ${escapar(c.precio.texto ?? '')}</p>` : '';
  const recursos = htmlRecursosDeHijo(c);
  return medida || precio || recursos ? `<footer class="hijo-pie">${medida}${precio}${recursos}</footer>` : '';
}

/** Cuántas series caben en la tabla pequeña del pie de un hijo del 1; las demás, contadas. */
const SERIES_EN_EL_PIE = 4;

/**
 * Lo que el núcleo mide de un hijo del 1 (encargo «datos2», issue #11): el coste («coste EUR 12»), la capacidad con la
 * barra «disponible / capacidad» (y lo comprometido y su franja en el title) y una tabla pequeña de lo que entra y sale
 * por serie (las primeras; las demás, contadas).
 */
function htmlRecursosDeHijo(c) {
  const coste = c.coste ? `<p class="hijo-coste">${escapar(t('hijoCoste', { coste: c.coste.texto }))}</p>` : '';
  let capacidad = '';
  if (c.capacidad) {
    const k = c.capacidad;
    const titulo = t(k.franja ? 'hijoCapacidadFranja' : 'hijoCapacidadTitulo', { disponible: k.disponible, capacidad: k.capacidad, comprometido: k.comprometido, franja: k.franja });
    capacidad = `<p class="hijo-capacidad">${escapar(t('hijoDisponible', { disponible: k.disponible, capacidad: k.capacidad }))}</p><span class="hijo-barra" data-de="capacidad"${k.disponible > 0 ? '' : ' data-agotada'} style="--lleno:${fraccionCss(k.capacidad > 0 ? k.disponible / k.capacidad : 0)}" title="${attr(titulo)}"><span></span></span>`;
  }
  let flujo = '';
  if (c.flujo?.length) {
    const filas = c.flujo.slice(0, SERIES_EN_EL_PIE).map((f) => `<tr><th scope="row" title="${attr(f.serie)}">${escapar(f.texto)}</th><td>${f.entra ? escapar(f.entra) : ''}</td><td>${f.sale ? escapar(f.sale) : ''}</td></tr>`).join('');
    const mas = c.flujo.length > SERIES_EN_EL_PIE ? `<tr class="hijo-flujo-mas"><td colspan="3">${escapar(t('hijoFlujoMas', { n: c.flujo.length - SERIES_EN_EL_PIE }))}</td></tr>` : '';
    flujo = `<table class="hijo-flujo"><thead><tr><th scope="col">${escapar(t('hijoFlujoSerie'))}</th><th scope="col">${escapar(t('hijoFlujoEntra'))}</th><th scope="col">${escapar(t('hijoFlujoSale'))}</th></tr></thead><tbody>${filas}${mas}</tbody></table>`;
  }
  return coste + capacidad + flujo;
}

/** La tarjeta central flotante de la cruceta: cara 0 (nombre, medida y su barra si tiene «de») y cara 5 (plantilla, ancla, pasos); ↻ la gira (data-girar). */
function htmlFlotante(f, etapa = null) {
  if (!f) return '';
  const girar = `<button type="button" class="girar"${nodo('control')} data-girar title="${attr(t('girarTitulo'))}" aria-label="${attr(t('girar'))}">↻</button>`;
  const cabeza = (n) => `<header class="flotante-cabeza"><span class="numero">${f.pv}</span><span class="etiqueta">${escapar(f.etiqueta ?? '')}</span><small class="cara-n">${escapar(t('cara', { n }))}</small>${girar}</header>`;
  const m = f.medida;
  const lleno = m && typeof m.de === 'number' && m.de > 0 ? Math.min(1, Math.max(0, m.k / m.de)) : null;
  const medida = m ? `<p class="flotante-cifra"><b>${escapar(m.k)}</b>${m.de ? `<small>/${escapar(m.de)}</small>` : ''} <span>${escapar(m.nombre)}</span></p>${lleno !== null ? `<span class="flotante-barra" style="--lleno:${Math.round(lleno * 1000) / 1000}" title="${attr(m.k + ' / ' + m.de)}"><span></span></span>` : ''}` : '';
  const ancla = f.ancla ? `<p class="ancla">${t('sobre')} <button type="button" class="enlace" data-abrir="${attr(f.ancla.sobre ?? '')}"${f.ancla.sobre ? '' : ' disabled'}>${escapar(f.ancla.sobreTexto ?? t('laRaiz'))}</button>${f.ancla.en ? ` · ${t('en')} ${escapar(f.ancla.en)}` : ''}</p>` : '';
  const pasos = f.pasos?.length ? `<ul class="pasos">${f.pasos.map((p) => `<li><b>${escapar(p.nombre)}</b> ${p.k === null || p.k === undefined ? '—' : escapar(p.k)}${p.de ? `<small>/${escapar(p.de)}</small>` : ''}</li>`).join('')}</ul>` : '';
  return `<div class="centro-flotante" data-color="${f.pv}" data-x="${attr(f.X)}"><div class="flotante-giro">`
    + `<section class="flotante-cara cara-0">${cabeza(0)}<p class="flotante-nombre">${escapar(f.texto ?? '')}</p>${medida}${capaPieza(etapa, { clase: 'pieza-etapa capa-etapa', alt: f.etiqueta ?? '' })}</section>`
    + `<section class="flotante-cara cara-5" aria-hidden="true">${cabeza(5)}<p class="tipo">${f.plantilla ? `${t('plantilla')} <b>${escapar(f.plantilla)}</b>` : t('sinPlantilla')}</p>${ancla}${pasos}</section>`
    + `</div></div>`;
}

/** Las ejecuciones que se ven en una celda de la matriz; las demás, contadas («+n»). */
const EJECUCIONES_EN_CELDA = 3;

/** El nombre de una estación de la fábrica (propuesta, autorizada, ejecutada), en el idioma de la interfaz. */
const textoEstacion = (estado) => t({ ejecutada: 'estadoEjecutada', autorizada: 'estadoAutorizada' }[estado] ?? 'estadoPropuesta');

/** El texto de la marca de verificado: «verificado», «verificado · N confirmaciones» si se conoce la profundidad, «en firme» si ya las tiene todas. */
const textoVerificado = (o) => (o.enFirme ? t('enFirme') : o.confirmaciones === 1 ? t('verificadoUnaConfirmacion') : o.confirmaciones > 1 ? t('verificadoConfirmaciones', { n: o.confirmaciones }) : t('verificado'));
const tituloVerificado = (o) => (o.enFirme ? t('enFirmeTitulo', { n: o.confirmaciones, minimas: o.minimas }) : t('verificadoTitulo'));
const htmlVerificado = (o) => `<small class="verificado"${o.enFirme ? ' data-en-firme' : ''}${o.confirmaciones ? ` data-confirmaciones="${attr(o.confirmaciones)}"` : ''} title="${attr(tituloVerificado(o))}">◆ ${escapar(textoVerificado(o))}</small>`;
const marcaVerificado = (o) => (o?.verificado ? htmlVerificado(o) : '');

/**
 * Lo de dentro de una celda de la matriz (encargo «datos2», issue #11: la celda es la lista de ejecuciones): cada una
 * con su estación si la tiene (su color y, si está ejecutada, su sello), las primeras y las demás contadas.
 */
function htmlEjecuciones(lista) {
  if (!lista.length) return '';
  const items = lista.slice(0, EJECUCIONES_EN_CELDA).map((o) => `<li class="ejecucion"${o.estado ? ` data-estado="${attr(o.estado)}" title="${attr(textoEstacion(o.estado))}"` : ''}>${htmlOcupanteDeCelda(o)}${o.estado ? `<small class="estacion-nombre">${escapar(textoEstacion(o.estado))}</small>` : ''}${marcaVerificado(o)}</li>`).join('');
  const mas = lista.length > EJECUCIONES_EN_CELDA ? `<li class="ejecucion-mas">${escapar(t('matrizMas', { n: lista.length - EJECUCIONES_EN_CELDA }))}</li>` : '';
  return `<ul class="ejecuciones">${items}${mas}</ul>`;
}

/** La fila aparte de la matriz: lo que el núcleo no sabe colocar (sin tipo de interacción o sin posición), sin inventar celda. */
function htmlSinPosicion(r) {
  if (!r.sinPosicion?.length) return '';
  const items = r.sinPosicion.map((o) => `<li class="ejecucion"${o.estado ? ` data-estado="${attr(o.estado)}"` : ''}>${htmlOcupanteDeCelda(o)}</li>`).join('');
  return `<div class="matriz-sin-posicion" title="${attr(t('matrizSinPosicionTitulo'))}"><span class="matriz-eje">${escapar(t('matrizSinPosicion'))}</span><ul class="ejecuciones en-fila">${items}</ul></div>`;
}

/** La cifra de una celda de la matriz: su estación si todas dicen la misma; si no, cuántas ejecuciones tiene. */
const cifraDeCelda = (c) => (c.estado ? textoEstacion(c.estado) : (c.ocupantes?.length ?? 0) > 1 ? String(c.ocupantes.length) : '');

/** El rótulo de un peldaño de la escalera dulce en su celda de la matriz del 4 (encargo «el4»): «3.2». */
const htmlEscalon = (e) => (e ? `<small class="matriz-escalon" title="${attr(t('matrizEscalonTitulo', { nivel: `${e.nivel}.${e.grado}`, nombre: e.nombre ?? '', direccion: e.direccion ?? '' }))}">${escapar(`${e.nivel}.${e.grado}`)}</small>` : '');

/**
 * La celda abierta de la matriz del 4 (encargo «el4», VG 12-11, #49.8): encima de la matriz, su oficio y su ejecución
 * (y su peldaño si es de la escalera), la lista de sus movimientos hasta diez, cada uno con el color de su estación y su
 * nombre, y cuántos más; ✕ (o pulsar la celda otra vez, o Esc) la cierra.
 */
function htmlCeldaAbierta(a) {
  if (!a) return '';
  const titulo = t('matrizCelda', { oficio: a.oficio ?? a.fila, ejecucion: a.ejecucion ?? a.columna });
  const items = a.lista.map((o) => `<li class="ejecucion"${o.estado ? ` data-estado="${attr(o.estado)}" title="${attr(textoEstacion(o.estado))}"` : ''}>${htmlOcupanteSolo(o)}${o.estado ? `<small class="estacion-nombre">${escapar(textoEstacion(o.estado))}</small>` : ''}${marcaVerificado(o)}</li>`).join('');
  const mas = a.mas ? `<li class="ejecucion-mas">${escapar(t('matrizMas', { n: a.mas }))}</li>` : '';
  return `<section class="matriz-abierta" data-color="${a.columna}" data-fila="${a.fila}" data-columna="${a.columna}" role="dialog" aria-label="${attr(titulo)}"><header class="matriz-abierta-cabeza"><b>${escapar(titulo)}</b>${htmlEscalon(a.escalon)}<button type="button" class="cerrar"${nodo('control')} data-celda-matriz-cerrar title="${attr(t('cerrar'))}" aria-label="${attr(t('cerrar'))}">✕</button></header>${htmlValorDeCelda(a.valor)}<ol class="ejecuciones abiertas">${items}${mas}</ol>${htmlEjecutarEnCelda(a)}</section>`;
}

// ---------- ejecutar desde el 4 (VG 12-11, decisión 7 de #49) ----------

/** Una cantidad de T en segundos, por escalas, como se lee («1 h 11 min»; «0 min» si nada). */
function textoDeSegundos(segundos) {
  const escalas = [['dia', 86400], ['hora', 3600], ['minuto', 60], ['segundo', 1]];
  let resto = Math.max(0, Math.round(Number(segundos) || 0));
  const partes = [];
  for (const [escala, s] of escalas) {
    const n = Math.floor(resto / s);
    if (n > 0) { partes.push(t('tPieza_' + escala, { n })); resto -= n * s; }
  }
  return partes.length ? partes.join(' ') : t('tPieza_minuto', { n: 0 });
}
/** Las piezas de una denominación ([{ escala, cantidad }]) como se leen: «1 h 11 min». */
const textoDePiezas = (piezas) => (piezas?.length ? piezas.map((p) => t('tPieza_' + p.escala, { n: p.cantidad })).join(' ') : t('tPieza_minuto', { n: 0 }));

/** La suma de una celda abierta del 4 (contrato.valorDeCelda): el valor de sus registros crece con sus transacciones. */
function htmlValorDeCelda(v) {
  if (!v) return '';
  return `<p class="celda-valor" data-segundos="${Number(v.segundos) || 0}" title="${attr(t('celdaValorTitulo'))}">${escapar(t('celdaValor', { t: textoDeSegundos(v.segundos), n: v.transacciones }))}</p>`;
}

/** Los estados del botón de ejecutar por el rango (contrato.botonDeEjecutar): la clase, el data-boton y su título. */
function atributosDelBoton(b) {
  const estado = b?.estado ?? 'apagado';
  const rango = b && b.nivel !== null && b.nivel !== undefined ? `${b.nivel}.${b.grado}` : '-';
  return ` class="ejecutar boton-${attr(estado)}" data-boton="${attr(estado)}"${b?.peldano !== null && b?.peldano !== undefined ? ` data-peldano="${b.peldano}"` : ''}${b?.subida ? ` data-subida="${b.subida}"` : ''} title="${attr(t('botonEjecutar_' + estado, { rango }))}"`;
}

/** Lo que se ejecuta desde una celda abierta: las plantillas de su oficio, cada una abre el formulario en modo ejecutar. */
function htmlEjecutarEnCelda(a) {
  if (!a.ejecutar?.length) return '';
  const botones = a.ejecutar.map((x) => `<button type="button"${nodo('control')}${atributosDelBoton(a.boton)} data-lanzar="${attr(x.id)}" data-ejecutar>${escapar(x.nombre)}</button>`).join('');
  return `<div class="celda-ejecutar"><small>${escapar(t('celdaEjecutar'))}</small>${botones}</div>`;
}

/**
 * Ejecutar en el formulario (VG 12-11, decisión 7): lo que cada parte exige en T (el coste por posición, lo que mueve la
 * plantilla) y la suma; la denominación propuesta o la que sale de la escala elegida (el desplegable: las escalas del
 * calendario, menores o mayores), si cubre lo exigido y si el saldo de hoy la alcanza.
 */
function htmlEjecucion(e) {
  if (!e) return '';
  const [coste, plantilla] = e.partes;
  const partes = [`<li data-parte="coste">${escapar(t('exigidoCoste', { n: coste.posiciones, t: textoDeSegundos(coste.segundos) }))}</li>`]
    .concat(plantilla?.segundos > 0 ? [`<li data-parte="plantilla">${escapar(t('exigidoPlantilla', { t: textoDeSegundos(plantilla.segundos) }))}</li>`] : [])
    .concat(plantilla?.anunciado > 0 ? [`<li data-parte="anunciado">${escapar(t('exigidoAnunciado', { t: textoDeSegundos(plantilla.anunciado) }))}</li>`] : [])
    .concat([`<li data-parte="total"><b>${escapar(t('exigidoTotal', { t: textoDeSegundos(e.exigido) }))}</b></li>`]);
  const opciones = e.escalas.map((x) => `<option value="${attr(x)}"${x === e.escala ? ' selected' : ''}>${escapar(t('escala_' + x))}${x === e.propuesta.desde ? ' ' + escapar(t('escalaPropuesta')) : ''}</option>`).join('');
  const avisos = (e.incompleto ? `<small class="aviso">${escapar(t('exigidoIncompleto'))}</small>` : '') + (e.cubre ? '' : `<small class="aviso">${escapar(t('denominacionNoCubre'))}</small>`) + (e.alcanza ? '' : `<small class="aviso">${escapar(t('denominacionNoAlcanza'))}</small>`);
  return `<section class="ejecucion-t" aria-label="${attr(t('ejecucionTitulo'))}"><h3>${escapar(t('ejecucionTitulo'))}</h3><ul class="exigido">${partes.join('')}</ul>
      <p class="denominacion"><label>${escapar(t(e.elegida ? 'denominacionElegida' : 'denominacionPropuesta'))} <select data-denominacion aria-label="${attr(t('denominacionEscala'))}">${opciones}</select></label> <b class="piezas" data-piezas="${attr(JSON.stringify(e.denominacion))}">${escapar(textoDePiezas(e.denominacion))}</b>${avisos}</p></section>`;
}

/** La matriz del 4: la esquina, la ejecución arriba (o los diez tipos de interacción), y cada fila con su oficio (o su posición) delante; la diagonal (la escalera) marcada con su peldaño; cada celda con ocupante, una estación con su estado (y su sello si está ejecutada, solo CSS), que se abre al pulsarla; encima, la abierta; debajo, lo que no tiene celda. */
function htmlMatriz(r) {
  const celda = (c) => `<div class="rejilla-celda hijo${c.ocupante ? ' estacion' : ' vacia'}${c.diagonal ? ' diagonal' : ''}${r.abierta && r.abierta.fila === c.fila && r.abierta.columna === c.columna ? ' abierta' : ''}" data-color="${c.pv}" data-pv="${c.pv}" data-fila="${c.fila}" data-columna="${c.columna}"${c.estado ? ` data-estado="${attr(c.estado)}"` : ''}${c.abrir ? ` data-celda-matriz="${attr(c.abrir)}" title="${attr(t('matrizAbrir'))}"` : ''}${c.escalon ? ` data-peldano="${c.escalon.peldano}"` : ''}><span class="hijo-nombre">${htmlEscalon(c.escalon)}</span><span class="hijo-cifra">${escapar(cifraDeCelda(c))}</span><div class="hijo-cuerpo">${htmlEjecuciones(c.ocupantes ?? (c.ocupante ? [c.ocupante] : []))}${htmlDibujo(c.capa)}</div></div>`;
  const ejes = r.ejes ?? { columnas: [], filas: [] };
  const esquina = ejes.oficios ? ['matrizEsquinaOficios', 'matrizEjesTituloOficios'] : ['matrizEsquina', 'matrizEjesTitulo'];
  const cabeza = `<span class="matriz-esquina" title="${attr(t(esquina[1]))}">${escapar(t(esquina[0]))}</span>` + ejes.columnas.map((c) => `<span class="matriz-eje matriz-columna" data-color="${c.pv}" title="${attr(c.pv + ' · ' + (c.etiqueta ?? ''))}"><b>${c.pv}</b> ${escapar(c.etiqueta ?? '')}</span>`).join('');
  // las filas en el orden de los ejes (0 … 9); las columnas de cada una, en el de los ejes (1 … 9 y el 0 al final): las celdas ya vienen en ese orden
  const filas = Array.from({ length: r.filas }, (_, i) => {
    const f = ejes.filas[i];
    return `<span class="matriz-eje matriz-fila" title="${attr(f ? f.digito + ' · ' + (f.nombre ?? '') : '')}">${f ? `<b>${f.digito}</b> ${escapar(f.nombre ?? '')}` : ''}</span>` + r.celdas.filter((c) => c.fila === (f ? f.digito : i)).map(celda).join('');
  }).join('');
  return `<div class="rejilla-celdas rejilla-matriz${ejes.oficios ? ' por-oficios' : ''}" style="--columnas:${r.columnas};--filas:${r.filas}">${cabeza}${filas}</div>${htmlCeldaAbierta(r.abierta)}${htmlSinPosicion(r)}`;
}

/**
 * La matriz del 4 cuando no cabe a lo ancho (Sequenced): las celdas con algo, una debajo de otra, cada una con sus dos
 * ejes (el tipo de interacción y la posición que modifica) y su estado, y lo que no tiene celda aparte; sin nada, el
 * paso del camino que la llenaría.
 */
function htmlMatrizEnColumna(r) {
  const ejes = r.ejes ?? { columnas: [], filas: [] };
  const llenas = r.celdas.filter((c) => c.ocupante);
  if (!llenas.length && !r.sinPosicion?.length) return `<div class="rejilla-celdas rejilla-matriz-columna vacia">${htmlEscribir(r.escribir, t('vacia'))}</div>`;
  const celda = (c) => {
    const col = ejes.columnas.find((k) => k.pv === c.columna);
    const fila = ejes.filas.find((k) => k.digito === c.fila);
    const nombre = [col ? `${col.pv} ${col.etiqueta ?? ''}` : '', fila ? `${fila.digito} ${fila.nombre ?? ''}` : ''].filter(Boolean).join(' · ');
    return `<div class="rejilla-celda hijo estacion${c.diagonal ? ' diagonal' : ''}" data-color="${c.pv}" data-pv="${c.pv}" data-fila="${c.fila}" data-columna="${c.columna}"${c.estado ? ` data-estado="${attr(c.estado)}"` : ''}><header class="hijo-cabeza"><span class="hijo-nombre">${escapar(nombre)}</span><span class="hijo-cifra">${escapar(cifraDeCelda(c))}</span></header><div class="hijo-cuerpo">${htmlEjecuciones(c.ocupantes ?? [c.ocupante])}${htmlDibujo(c.capa)}</div></div>`;
  };
  return `<div class="rejilla-celdas rejilla-matriz-columna" style="--columnas:1;--filas:${Math.max(1, llenas.length)}">${llenas.map(celda).join('')}</div>${htmlSinPosicion(r)}`;
}

/** Una cuenta ensartada en un hilo (un ocupante o una entrada del diario): la bola con el color del hilo, la fecha y el nombre; los dos, también en el title. */
function htmlCuenta(o) {
  const cuando = o.t ? fecha(o.t) : '';
  const destino = o.tipo === 'entrada' ? o.ref : o.X;
  const estado = o.estado ? t(ESTADOS_DE_CUENTA[o.estado.tipo] ?? 'estadoPrevisto', { fecha: o.estado.fecha ? fecha(o.estado.fecha) : '' }) : '';
  const rara = o.rara ? t('cuentaRara') : '';
  const titulo = [o.texto, cuando, estado, rara, o.hiloSupuesto ? t('hiloSupuesto') : '', o.arriba ? t('derivadoArriba') : ''].filter(Boolean).join(' · ');
  return `<button type="button" class="ocupante cuenta${o.hiloSupuesto ? ' supuesta' : ''}${o.rara ? ' cuenta-rara' : ''}${o.arriba ? ' cuenta-arriba' : ''}"${nodo('ocupante', { x0: o.texto })}${o.hilo !== null && o.hilo !== undefined ? ` data-color="${o.hilo}"` : ''}${o.estado ? ` data-estado="${attr(o.estado.tipo)}"` : ''}${dataId(o)}${destino ? ` data-abrir="${attr(destino)}" data-x="${attr(destino)}"` : ''} title="${attr(titulo)}"><span class="cuenta-bola" aria-hidden="true">${htmlDibujoDeOcupante(o)}</span><span class="cuenta-texto">${estado ? `<small class="cuenta-estado">${escapar(estado)}</small> ` : cuando ? `<small>${escapar(cuando)}</small> ` : ''}${escapar(o.texto)}</span></button>`;
}

/** El texto de cada estado del futuro de una cuenta (contrato.estadoDeEntrada), por su nombre. */
const ESTADOS_DE_CUENTA = Object.freeze({ previsto: 'estadoPrevisto', bloqueado: 'estadoBloqueado', liberado: 'estadoLiberado', caduca: 'estadoCaduca', caducado: 'estadoCaducado' });

/**
 * Las franjas del 6 y el 7: una franja vertical por escala (la más cercana a ahora, más ancha) y los hilos horizontales
 * que las atraviesan; en cada cruce, sus cuentas y, si no caben, una cuenta mayor con el número. Franjas, hilos y
 * cruces comparten la misma rejilla (los hilos pasan por encima de las franjas, las cuentas encima de los hilos).
 */
function htmlFranjas(r) {
  const n = r.bandas.length;
  const hilos = r.hilos?.length ? r.hilos : [{ pv: null, etiqueta: '' }];
  const ahora = Math.max(0, r.bandas.findIndex((b) => b.ahora));
  const peso = (i) => (n > 1 ? Math.round((1 + (n - 1 - Math.abs(i - ahora)) / (n - 1)) * 100) / 100 : 1);
  const columnas = `var(--ancho-hilo) ${r.bandas.map((_, i) => `minmax(0,${peso(i)}fr)`).join(' ')}`;
  const cuantas = (b) => b.items.length + (b.mas ?? 0);
  const franjas = r.bandas.map((b, i) => `<div class="rejilla-banda hijo franja-tiempo${b.ahora ? ' ahora' : ''}${cuantas(b) ? '' : ' vacia'}" data-banda="${b.indice}" style="grid-column:${i + 2};grid-row:1 / -1"><header class="hijo-cabeza"><span class="hijo-nombre banda-nombre">${escapar(b.nombre ?? '')}</span><span class="hijo-cifra">${cuantas(b) || ''}</span></header><div class="hijo-cuerpo">${htmlDibujo(b.capa)}</div></div>`).join('');
  const lineas = hilos.map((h, j) => `<div class="hilo" data-hilo="${h.pv ?? ''}"${h.pv !== null ? ` data-color="${h.pv}"` : ''} style="grid-column:1 / -1;grid-row:${j + 2}"><span class="hilo-nombre">${h.pv !== null ? `<b>${h.pv}</b> ` : ''}${escapar(h.etiqueta ?? '')}</span></div>`).join('');
  const cruces = r.bandas.map((b, i) => (b.cruces ?? []).map((c, j) => (c.items.length || c.mas
    ? `<div class="cruce" data-banda="${b.indice}" data-hilo="${c.hilo ?? ''}" style="grid-column:${i + 2};grid-row:${j + 2}">${c.items.map(htmlCuenta).join('')}${c.mas ? `<span class="cuenta cuenta-mayor"${c.hilo !== null ? ` data-color="${c.hilo}"` : ''} title="${attr(t('masEnCruce', { n: c.mas }))}">${c.mas}</span>` : ''}</div>`
    : '')).join('')).join('');
  return `<div class="rejilla-bandas rejilla-franjas" style="--franjas:${n};--hilos:${hilos.length};grid-template-columns:${columnas};grid-template-rows:var(--cabeza-franja) repeat(${hilos.length},minmax(0,1fr))">${franjas}${lineas}${cruces}</div>`;
}

/** Una caja nivel.grado (el cielo del 8 y las posiciones del camino del 9): su rótulo y su nombre arriba; dentro, `cuerpo`. */
const htmlCaja = (b, clase, cuerpo, cifra = '', dibujo = '', atributos = '') => `<div class="rejilla-banda hijo ${clase}" data-banda="${b.indice}" data-nivel="${b.nivel}" data-grado="${b.grado}"${b.direccion ? ` data-direccion="${attr(b.direccion)}"` : ''}${atributos} style="--nivel:${Number(b.nivel) || 0}"><header class="hijo-cabeza"><span class="hijo-nombre"><b class="rotulo">${escapar(b.nivel + '.' + b.grado)}</b> ${escapar(b.nombre ?? '')}</span><span class="hijo-cifra">${cifra}</span></header><div class="hijo-cuerpo">${cuerpo}${dibujo}</div></div>`;

/** Un comparable en el cielo: su estrella (intensidad por el nivel de la caja, borde con el grado 2, halo con el 3: solo CSS) y su nombre. */
function htmlEstrella(o) {
  const destino = o.tipo === 'entrada' ? o.ref : o.X;
  return `<button type="button" class="ocupante estrella${o.foco ? ' foco' : ''}"${nodo('ocupante', { x0: o.texto })}${dataId(o)}${destino ? ` data-abrir="${attr(destino)}" data-x="${attr(destino)}"` : ''}${typeof o.rango === 'number' ? ` data-rango="${o.rango}"` : ''} title="${attr(o.texto)}"><span class="estrella-forma" aria-hidden="true">★${htmlDibujoDeOcupante(o)}</span><span class="texto">${escapar(o.texto)}</span></button>`;
}

/**
 * El cielo del 8: el panel pequeño (el del astrónomo: la cohorte, con su selector si hay más de una, quién escribió la
 * base o «sin base escrita», la cuota del foco y las posiciones que tiene escritas) y las diez cajas en dos filas; la
 * vacía, apagada con su paso del camino. Sin base escrita, el cielo lleva el borde discontinuo (`sin-base`).
 */
function htmlCielo(r) {
  const cajaDe = (k) => r.bandas.find((b) => (b.escala ?? b.indice) === k);
  const partes = [];
  if (r.cohorte) {
    const elegir = r.cohorte.opciones?.length
      ? `<span class="cohortes" role="group" aria-label="${attr(t('cohorte'))}">${r.cohorte.opciones.map((o) => `<button type="button" class="cohorte${o.actual ? ' actual' : ''}"${nodo('control')} data-cohorte="${attr(o.valor)}" aria-pressed="${o.actual ? 'true' : 'false'}" title="${attr(t('cohorteElegir', { cohorte: o.texto }) + (o.valor === r.cohorte.elegida ? ' · ' + t('cohorteDelDueno') : ''))}">${escapar(o.texto)}</button>`).join('')}</span>`
      : `<b class="cohorte actual">${escapar(r.cohorte.texto ?? r.cohorte.valor)}</b>`;
    partes.push(`${escapar(t('cohorte'))} ${elegir}`);
  } else partes.push(escapar(t('sinCohorte')));
  if (r.base) partes.push(`<span class="cielo-base">${escapar(r.base.escrita ? t('baseEscritaPor', { autor: r.base.autor ?? '', cuando: r.base.t ? fecha(r.base.t) : '' }) : t('sinBaseEscrita'))}</span>`);
  if (r.rango) partes.push(`<b class="cielo-rango">${escapar(t('rangoDelFoco', { nivel: `${r.rango.nivel}.${r.rango.grado}`, nombre: r.rango.nombre ?? '' }))}</b>`);
  if (r.cuota) { const c = cajaDe(r.cuota.k); partes.push(escapar(t('cieloCuota', { paso: r.cuota.nombre, k: c ? `${c.nivel}.${c.grado}` : r.cuota.k }))); }
  if (r.enElFoco?.length) partes.push(escapar(t('enElFoco', { posiciones: r.enElFoco.join(' ') })));
  const panel = partes.length ? `<p class="cielo-panel">${partes.join(' · ')}</p>` : '';
  const cajas = r.bandas.map((b) => {
    const llena = b.items.length || b.mas;
    const cuerpo = llena ? b.items.map(htmlEstrella).join('') + (b.mas ? `<span class="estrella estrella-mas" title="${attr(t('masEnBanda', { n: b.mas }))}">${escapar(t('masEnBanda', { n: b.mas }))}</span>` : '') : b.foco ? `<span class="cielo-foco">${escapar(t('cieloFoco'))}</span>` : htmlEscribir(b.escribir, t('vacia'));
    return htmlCaja(b, `caja-cielo${llena || b.foco ? '' : ' vacia'}${b.foco ? ' foco' : ''}`, cuerpo, llena ? b.items.length + b.mas : '', htmlDibujo(b.capa));
  }).join('');
  return `${panel}<div class="rejilla-bandas rejilla-cielo${r.base && !r.base.escrita ? ' sin-base' : ''}" style="--columnas:${r.columnas};--filas:${r.filas}">${cajas}</div>`;
}

/**
 * El camino del 9: primero las diez posiciones nivel.grado para situarse (sin ocupantes: apagadas, con el paso del
 * camino), con la madurez del foco encima; debajo, a pantalla completa, los pasos del camino y la guía, plegables
 * (los de siempre: htmlCamino y htmlGuia, reorganizados aquí).
 */
function htmlCaminoDeRejilla(r, arbol) {
  // Encargo «el4» (#39): el rango del foco (el del 8) y, en cada posición, si la deja disponible (y cuál es la suya).
  const rango = r.rango ? `<span class="camino-rango">${escapar(t('rangoDelFoco', { nivel: `${r.rango.nivel}.${r.rango.grado}`, nombre: r.rango.nombre ?? '' }))} · ${escapar(t('caminoDisponibles', { n: r.rango.disponibles.length }))}</span>` : '';
  const madurez = r.madurez || rango ? `<p class="camino-madurez">${r.madurez ? escapar(t('madurezDelFoco', r.madurez)) : ''}${r.madurez && rango ? ' · ' : ''}${rango}</p>` : '';
  const marca = (b) => (b.disponible === undefined ? '' : b.actual ? ' disponible actual' : b.disponible ? ' disponible' : ' no-disponible');
  const atributos = (b) => (b.disponible === undefined ? '' : ` data-disponible="${b.disponible ? 'si' : 'no'}"${b.actual ? ` data-actual title="${attr(t('caminoActual'))}"` : ''}`);
  const posiciones = r.bandas.map((b) => htmlCaja(b, `posicion${b.items.length ? '' : ' vacia'}${marca(b)}`, b.items.length ? b.items.map(htmlElementoDeBanda).join('') : b.actual ? `<span class="camino-aqui">${escapar(t('caminoActual'))}</span>` : htmlEscribir(b.escribir), '', htmlDibujo(b.capa, b.items.map((o) => o.dibujo)), atributos(b))).join('');
  const mensajes = arbol
    ? `<div class="camino-mensajes"><details class="plegable" open><summary>${escapar(t('caminoPasos', { n: arbol.camino?.pasos?.length ?? 0 }))}</summary>${htmlCamino(arbol.camino, { X: arbol.X })}</details>${arbol.guia ? `<details class="plegable" open><summary>${t('guia')}</summary>${htmlGuia(arbol.guia)}</details>` : ''}</div>`
    : '';
  return `${madurez}<div class="rejilla-bandas rejilla-posiciones" style="--columnas:${r.columnas};--filas:${r.filas}" aria-label="${attr(t('caminoPosiciones'))}">${posiciones}</div>${mensajes}`;
}

/** Una banda de una forma sin pintor propio: su nombre y lo que cae en ella. */
function htmlBandaDeRejilla(b) {
  const nombre = b.nombre ?? String(b.indice);
  const cuerpo = (b.items ?? []).map(htmlElementoDeBanda).join('') + (b.mas ? `<small class="mas-banda">${escapar(t('masEnBanda', { n: b.mas }))}</small>` : '');
  return `<div class="rejilla-banda hijo${b.items?.length ? '' : ' vacia'}" data-banda="${b.indice}"><span class="hijo-nombre banda-nombre">${escapar(nombre)}</span><div class="hijo-cuerpo banda-cuerpo">${cuerpo}${htmlDibujo(b.capa, (b.items ?? []).map((o) => o.dibujo))}</div></div>`;
}

/**
 * La rejilla de un mundo (epoch.8.7) en su forma sobria (VG, mockup del segundo nivel v3): la cruceta con la tarjeta
 * central flotante, la escalera, las columnas con el nivel siguiente dentro, la rejilla 3 × 2, la conversación, la
 * matriz con sus ejes, las franjas con sus hilos, el cielo y el camino. Con niveles de profundidad, la cabecera dice
 * dónde se está y «subir» vuelve un nivel; la matriz pagina («‹ n de m ›»). El contenedor (`.rejilla-completa`,
 * data-forma, posicionado y aislado para que el animado añada capas detrás y alrededor) lleva data-id (el registro que
 * se divide) y cada hijo la clase `hijo`: a ellos se aplican los dos estilos del registro (htmlEstilos); los huecos
 * entre hijos salen de `--hueco`. En un bloque, la misma rejilla sin cabecera, sin tarjeta flotante y sin la guía.
 */
function htmlRejilla(r, { completa = false, arbol = null, apilada = false } = {}) {
  if (!r) return '';
  const cabeza = (completa || apilada) && r.niveles > 1 ? `<div class="rejilla-cabeza"><span class="nivel-rejilla">${escapar(t('rejillaNivel', { nivel: r.nivel, niveles: r.niveles }))}</span>${r.ruta.length ? htmlInterrogante(r.sitio) : ''}${r.persona ? `<span class="ruta-rejilla persona-rejilla">${escapar(t('conversacionCon', { que: r.persona.texto, caja: r.persona.caja, grupo: r.persona.nombre ?? '' }))}</span>` : r.texto ? `<span class="ruta-rejilla">${escapar(r.texto)}</span>` : ''}${r.direccion && r.nivel > 1 ? `<span class="direccion-rejilla">${escapar(r.direccion)}</span>` : ''}${r.ruta.length ? `<button type="button" class="subir"${nodo('control')} data-subir="${r.pv}" title="${attr(t('subirTitulo'))}">↑ ${t('subir')}</button>` : ''}</div>` : '';
  const sin = r.sinBanda?.length ? `<div class="rejilla-sin" title="${attr(t('sinBandaTitulo'))}">${r.sinBanda.map(htmlElementoDeBanda).join('')}</div>` : '';
  let cuerpo;
  if (r.forma === 'franjas' && r.bandas) cuerpo = htmlFranjas(r) + sin;
  else if (r.forma === 'cielo' && r.bandas) cuerpo = htmlCielo(r) + sin;
  else if (r.forma === 'camino' && r.bandas) cuerpo = htmlCaminoDeRejilla(r, completa ? arbol : null);
  else if (r.forma === 'matriz' && r.celdas) cuerpo = apilada && r.enColumna ? htmlMatrizEnColumna(r) : htmlMatriz(r);
  else if (r.bandas) cuerpo = `<div class="rejilla-bandas" style="--filas:${r.bandas.length}">${r.bandas.map(htmlBandaDeRejilla).join('')}</div>${sin}`;
  else if (apilada) cuerpo = `${htmlFlotante(r.flotante)}<div class="rejilla-celdas rejilla-${attr(r.forma ?? '')}" style="--columnas:${r.enColumna ? 1 : r.columnas};--filas:${r.enColumna ? r.celdas.length : r.filas}">${r.celdas.map((c) => htmlCeldaDeRejilla(c, r.forma)).join('')}</div>`; // Sequenced: la tarjeta del elemento pulsado arriba, sin flotar
  else cuerpo = `<div class="rejilla-celdas rejilla-${attr(r.forma ?? '')}" style="--columnas:${r.columnas};--filas:${r.filas}">${r.celdas.map((c) => htmlCeldaDeRejilla(c, r.forma)).join('')}${completa ? htmlFlotante(r.flotante, r.capas?.etapa) : ''}</div>`;
  const paginas = r.pagina && r.pagina.de > 1 ? `<ul class="ocupantes rejilla-paginas">${htmlPagina(r.pagina, r.pv)}</ul>` : '';
  // En animado y a pantalla completa, las capas (r.capas): el fondo del mundo debajo de todo; encima, el personaje en el hueco, lo nuevo sin hijo y el marco.
  const k = completa ? r.capas : null;
  const debajo = k ? capaPieza(k.fondo, { clase: 'pieza-fondo capa-fondo' }) : '';
  const encima = k ? htmlPersonajeCapa(k, r) + htmlEfectosCapa(k.efectos, 'capa-efectos-centro') + htmlMarcoCapa(k.marco) : '';
  return `<div class="rejilla${completa ? ' rejilla-completa' : ''}${apilada ? ' rejilla-apilada' : ''}${apilada && r.enColumna ? ' en-columna' : ''}" data-rejilla="${r.pv}" data-forma="${attr(r.forma ?? '')}" data-nivel="${r.nivel}" data-niveles="${r.niveles}" data-columnas="${r.columnas}" data-filas="${r.filas}"${r.estilo && r.X ? ` data-id="${attr(r.X)}"` : ''}${r.vacia ? ' data-vacia' : ''}${r.X ? ` data-hueco-x="${attr(r.X)}"${completa ? ` data-hueco-pv="${r.pv}"` : ''}${r.base?.length ? ` data-hueco-en="${r.base.join('.')}"` : ''}` : ''}>${debajo}${cabeza}${cuerpo}${paginas}${encima}</div>`;
}

/** La lista o la matriz de ocupantes de un PV, con «cargar más» al final si hay más. */
function htmlOcupantes(oc, { pv, disposicion, capa = false } = {}) {
  if (!oc) return '';
  const lista = oc.lista.length ? oc.lista.map((o) => `<li>${htmlOcupante(o, { capa })}</li>`).join('') : `<li class="nada">${t('nada')}</li>`;
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

/** Lo que daría un paso previsualizado (carta.previsualizar): si pasaría y con qué movimientos, o por qué no. */
function htmlPrevia(v) {
  const texto = v.ok ? (v.movimientos?.length ? t('previaPasa', { movimientos: v.movimientos.join(' · ') }) : t('previaPasaSinMovimientos')) : t('previaNoPasa', { motivos: (v.motivos ?? []).map((m) => m.mensaje).join('; ') });
  return `<small class="previa${v.ok ? ' pasa' : ' no-pasa'}" role="status">${escapar(texto)}</small>`;
}

/** El camino: cada paso, mío (lanzable, por el id de su plantilla, y con «previsualizar»), de espera (marcado) o hecho; los niveles si la madurez es 0; «seguir». */
export function htmlCamino(c, { X } = {}) {
  if (!c) return '';
  const pasos = c.pasos.map((p, i) => {
    if (p.propuesta !== null && p.propuesta !== undefined) return htmlPropuesta(p);
    const clase = p.hecho ? 'hecho' : p.espera ? 'espera' : p.mio ? 'mio' : 'otro';
    const cuerpo = `<span class="fuente">${escapar(p.fuente)}</span> <span class="falta">${escapar(p.falta ?? '')}</span>`;
    const marca = p.hecho ? `<span class="marca">${t('hecho')}</span>` : p.espera ? `<span class="marca">${escapar(t('esperaA', { quien: p.espera }))}</span>` : '';
    // Previsualizar (encargo «datos3»): construye y valida el paso sin escribir; lo que daría, debajo.
    const previa = c.previa?.paso === i ? htmlPrevia(c.previa) : '';
    const ver = p.hacer && !p.hacer.lectura ? ` <button type="button" class="previsualizar"${nodo('control')} data-previsualizar="${i}" data-x="${attr(p.hacer?.X ?? X ?? '')}" data-accion="${attr(p.hacer.id)}" title="${attr(t('previsualizarTitulo'))}">${t('previsualizar')}</button>` : '';
    return p.mio
      ? `<li class="paso ${clase}"${nodo('paso')}><button type="button" data-paso="${i}" data-x="${attr(p.hacer?.X ?? X ?? '')}" data-lanzar="${attr(p.hacer.id)}">${escapar(p.hacer.nombre)}</button>${ver} ${cuerpo}${previa}</li>`
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

/**
 * Un PV lateral en su nivel: comprimido (un dato), tarjeta (etiqueta y lo que cabe), bloque (la lista o la matriz). En una
 * fila abierta de Sequenced (`enFila`), el bloque sin su cabeza (la lleva la fila) y con la rejilla apilada; sin rejilla
 * ni ocupantes, la regla del vacío («escribir aquí · acción»).
 */
function htmlLateral(n, arbol, { enFila = false } = {}) {
  const clases = ['pv', `pv-${n.pv}`, `grupo-${n.grupo}`, `lado-${n.lado ?? ''}`, `fila-${n.fila ?? ''}`, `nivel-${n.nivel}`].join(' ');
  if (n.nivel === NIVEL.oculto) return `<div class="${clases}"${nodo('pv', { tam: NOMBRE_NIVEL[n.nivel] })} data-pv="${n.pv}" data-x="${n.X}" hidden></div>`;
  // En comprimido, la etapa en sello (si el modelo la trae) o el elemento; en tarjeta y bloque, el escenario entero.
  const sello = n.etapa?.recurso ? htmlPieza(n.etapa, { clase: 'pieza-etapa', alt: n.etiqueta }) : htmlPieza(n.pieza, { paso: n.paso, alt: n.etiqueta });
  const efectos = n.nivel === NIVEL.comprimido && n.nuevos?.efectos?.length ? htmlEscenario({ nuevos: n.nuevos, consumido: n.consumido }) : '';
  const dato = `<span class="dato" title="${attr(n.comprimido.que ?? '')}">${escapar(n.comprimido.dato)}${n.comprimido.de ? `<small>/${escapar(n.comprimido.de)}</small>` : ''}</span>`;
  // Mapped, en tarjeta y en bloque (VG, 11-11, #16): el animado es el sobrio más capas, como a pantalla completa. El
  // fondo del mundo atenuado detrás de todo, la etapa pequeña en la cabecera, el dibujo del mundo en cada hijo de la
  // rejilla (o en cada ocupante de la lista), lo nuevo encima y el marco abrazando el borde (sus esquinas y una línea);
  // sin personaje (solo a pantalla completa). En la fila abierta de Sequenced (VG, 11-11, #7: «menos sobrecargado, pero
  // algo»), las mismas capas pero más ligeras: el fondo atenuado detrás y el dibujo del mundo en cada hijo u ocupante; la
  // etapa va junto al nombre de la fila (htmlFilas); sin marco (la tarjeta del foco ya lleva el suyo), sin muñequito y
  // sin movimientos.
  const enCapas = arbol?.animado && n.nivel >= NIVEL.tarjeta;
  const capas = enCapas && arbol.mapa && !arbol.apilada && !enFila;
  const ligera = enCapas && enFila;
  const etapaEnCabeza = capas ? capaPieza(n.etapa, { clase: 'pieza-etapa capa-etapa capa-etapa-pv', alt: n.etiqueta }) : '';
  const cabeza = `<header class="pv-cabeza"><span class="numero">${n.pv}</span><span class="etiqueta">${escapar(n.etiqueta)}${etapaEnCabeza}</span>${n.medida ? htmlMedida(n.medida) : dato}${enFila ? '' : htmlInterrogante(n.sitio)}</header>`;
  // El marco, siempre como capa (las cuatro esquinas del dibujo y una línea, nunca el dibujo estirado en medio del texto):
  // en tarjeta y bloque, en Mapped y en cualquier otro sitio; solo el comprimido (una celda de un dato) lo estira.
  const marco = n.nivel === NIVEL.comprimido ? htmlMarco(n.marco) : ligera ? '' : htmlMarcoCapa(n.marco);
  let cuerpo = '';
  if (n.nivel === NIVEL.comprimido) cuerpo = `<div class="comprimido" title="${attr(n.etiqueta)}: ${attr(n.ayuda ?? '')}"><span class="numero">${n.pv}</span>${sello || dato}${sello ? dato : ''}${efectos}${marco}</div>`;
  else {
    const camino = n.grupo === 'cruz' && n.fila === 'abajo' ? htmlCamino(arbol.camino, { X: n.X }) + (arbol.centro?.pv !== n.pv && (arbol.apilada || n.nivel >= NIVEL.bloque) ? htmlGuia(arbol.guia) : '') : '';
    const escenario = capas || ligera ? '' : htmlEscenario(n, { paso: n.paso, etiqueta: n.etiqueta }) || (n.pieza ? htmlPieza(n.pieza, { paso: n.paso, alt: n.etiqueta }) : '');
    const fondo = capas || ligera ? capaPieza(n.fondo, { clase: 'pieza-fondo capa-fondo' }) : '';
    const nuevo = capas ? htmlEfectosCapa(n.nuevos) : '';
    const lista = n.vacio ? `<p class="vacio-pv"${htmlHueco(n.X, n.pv)}>${htmlEscribir(n.escribir)}</p>` : htmlOcupantes(n.ocupantes, { pv: n.pv, disposicion: n.disposicion, capa: capas || ligera });
    cuerpo = fondo + (enFila ? '' : cabeza) + escenario + (n.rejilla ? htmlRejilla(n.rejilla, { apilada: enFila }) : lista) + (n.nivel >= NIVEL.bloque ? htmlDiario(n.diario) + htmlOpiniones(n.opiniones) : '') + camino
      + `<footer class="pv-pie"><button type="button" class="entrar" data-foco-pv="${n.pv}" data-x="${n.X}">${t('entrar')}</button><small class="ayuda">${escapar(n.ayuda ?? '')}</small></footer>` + nuevo + marco;
  }
  return `<section class="${clases}"${nodo('pv', { tam: n.pasoDeTamano?.nombre ?? NOMBRE_NIVEL[n.nivel], rep: repDe(n.representacion) })} data-pv="${n.pv}" data-x="${n.X}" data-nivel="${n.nivel}" aria-label="${attr(n.etiqueta)}" tabindex="0">${cuerpo}</section>`;
}

/**
 * Sequenced: las filas de la tarjeta del foco, una por PV en el orden de sus dígitos. Cada una, su cabeza (el número, la
 * etiqueta, cuántos tiene y su medida) que la abre o la cierra (data-fila) y su campo para escribir; abierta, debajo, el
 * segundo nivel del PV (htmlLateral en bloque). Las del hilo (el pasado y el futuro) no se abren: llevan a su zona.
 */
function htmlFilas(arbol, c) {
  const fila = (f) => {
    const campo = c.campos.find((x) => x.pv === f.pv);
    const etiqueta = escapar(f.etiqueta ?? '');
    const input = f.pv === c.pv
      ? `<input class="campo-input" data-campo="${c.pv}" data-x="${c.X}" value="" placeholder="${attr(t('nuevoAquiMarcador', { que: c.textoDelFoco ?? c.representacion?.texto ?? '' }))}" title="${attr(c.ayuda ?? '')}" aria-label="${attr(f.etiqueta ?? '')}" autocomplete="off">`
      : campo ? `<input class="campo-input" data-campo="${f.pv}" data-x="${c.X}" value="${attr(campo.valor)}" placeholder="${attr((campo.marcador ?? []).join(' · '))}" title="${attr(campo.ayuda ?? '')}" aria-label="${attr(f.etiqueta ?? '')}" autocomplete="off">` : '';
    const marca = f.hilo ? (f.hilo === 'antes' ? '↑' : '↓') : f.abierta ? '▾' : '▸';
    const titulo = f.hilo ? t(f.hilo === 'antes' ? 'irAlPasado' : 'irAlFuturo') : t(f.abierta ? 'filaCerrar' : 'filaAbrir', { que: f.etiqueta ?? '' });
    // En animado, la fila abierta lleva la etapa de su mundo pequeña junto al nombre (una capa: no ocupa sitio, #7).
    const etapa = arbol.animado && f.abierta ? capaPieza(f.nodo?.etapa, { clase: 'pieza-etapa capa-etapa capa-etapa-fila', alt: f.etiqueta ?? '' }) : '';
    const cabeza = `<button type="button" class="fila-cabeza"${nodo('control')} data-fila="${f.pv}" data-x="${c.X}"${f.hilo ? ` data-hilo="${attr(f.hilo)}"` : ` aria-expanded="${f.abierta}" aria-controls="fila-${f.pv}-contenido"`} title="${attr(titulo)}"><span class="numero">${f.pv}</span><span class="etiqueta">${etiqueta}${f.total ? ` <small>· ${escapar(f.total)}</small>` : ''}${etapa}</span>${f.medida?.propio ? htmlMedida(f.medida) : ''}<span class="fila-marca" aria-hidden="true">${marca}</span></button>`;
    const contenido = f.abierta && f.nodo ? `<div class="fila-contenido" id="fila-${f.pv}-contenido">${htmlLateral(f.nodo, arbol, { enFila: true })}</div>` : '';
    return `<li class="fila${f.abierta ? ' abierta' : ''}${f.hilo ? ' fila-hilo' : ''}"${nodo('campo', { d: f.pv })} data-color="${f.pv}" data-fila-pv="${f.pv}">${cabeza}${htmlInterrogante(f.sitio, { clase: 'sitio-fila' })}${input}${contenido}</li>`;
  };
  return `<ol class="filas">${arbol.secuencia.filas.map(fila).join('')}</ol>`;
}

/**
 * Sequenced: una zona del hilo, encima (el pasado) o debajo (el futuro) de la tarjeta: lo que pinta su PV en bloque (sus
 * ocupantes y, en el pasado, el diario de lo llegado y las opiniones) como tarjetas apiladas de arriba abajo en el orden
 * que da el núcleo (VG, 11-11, #18: lo más cercano al presente arriba; el orden lo declara la época para cada mundo,
 * epoch.8.7, y aquí no se reordena); «cargar más» al final, por páginas (el paso de la configuración). Vacía, la regla
 * del vacío. En animado (`capa`), el elemento de cada ocupante es una capa, como en las filas.
 */
function htmlHilo(n, { capa = false } = {}) {
  if (!n) return '';
  const pasado = n.hilo === 'antes';
  const entrada = (e) => `<li class="hilo-carta hilo-entrada"><time datetime="${attr(e.t)}">${escapar(fecha(e.t))}</time> · <b>${escapar(e.autor)}</b> · <button type="button" class="enlace" data-abrir="${attr(e.id)}">${corto(e.id)}</button><small>${escapar(e.movimientos.join(', '))}</small></li>`;
  const cartas = [...(n.ocupantes?.lista ?? []).map((o) => `<li class="hilo-carta">${htmlOcupante(o, { capa })}</li>`), ...(n.diario?.entradas ?? []).map(entrada)];
  const vacio = cartas.length ? '' : `<li class="hilo-vacio"${htmlHueco(n.X, n.pv)}>${htmlEscribir(n.escribir)}</li>`;
  const mas = n.cargarMas ? `<li class="cargar-mas"><button type="button"${nodo('control')} data-cargar-mas="${n.pv}">${escapar(t('cargarMas', { cuantos: n.faltan }))}</button></li>` : '';
  const total = (n.ocupantes?.total ?? 0) + (n.diario?.total ?? 0);
  const cabeza = `<header class="pv-cabeza hilo-cabeza"><span class="numero">${n.pv}</span><span class="etiqueta">${escapar(n.etiqueta)}</span><small>${escapar(t(pasado ? 'hiloPasado' : 'hiloFuturo', { n: total }))}</small></header>`;
  const lista = `<ol class="hilo-cartas">${vacio}${cartas.join('')}${mas}</ol>`;
  const clases = ['pv', `pv-${n.pv}`, 'zona-hilo', `zona-${n.hilo}`, `grupo-${n.grupo}`, `lado-${n.lado ?? ''}`, `nivel-${n.nivel}`].join(' ');
  return `<section class="${clases}"${nodo('pv', { tam: NOMBRE_NIVEL[n.nivel] })} data-pv="${n.pv}" data-x="${n.X}" data-nivel="${n.nivel}" data-hilo-zona="${n.pv}" aria-label="${attr(n.etiqueta)}">${pasado ? htmlOpiniones(n.opiniones) + lista + cabeza : cabeza + lista}</section>`;
}

/** Sequenced: la fila fina y fija de abajo con los diez dígitos en su color; tocar uno lleva a su fila y la abre (los del hilo, a su zona). */
function htmlDigitos(s) {
  if (!s?.digitos?.length) return '';
  return `<nav class="digitos"${nodo('control')} aria-label="${attr(t('digitosTitulo'))}">${s.digitos.map((d) => `<button type="button" class="digito" data-digito="${d.pv}" data-color="${d.pv}" title="${attr(d.pv + ' · ' + (d.etiqueta ?? ''))}" aria-label="${attr(d.pv + ' · ' + (d.etiqueta ?? ''))}">${d.pv}</button>`).join('')}</nav>`;
}

/** El centro: el anverso (0), el reverso (5) o un PV abierto como foco. */
function htmlCentro(c, arbol, { leidoTexto } = {}) {
  const voltear = `<button type="button" class="voltear" data-voltear aria-label="${attr(t('voltear'))} (${attr(t(c.cara === 'anverso' ? 'voltearAnverso' : 'voltearReverso'))})" title="${attr(t('voltear'))}">⟲</button>`;
  const leido = `<div class="leido"><button type="button" class="leido-boton" data-leido aria-pressed="${c.leido}" title="${attr(t(c.leido ? 'leidoOcultar' : 'leidoVer'))}">${t('leido')}</button>${c.leido && leidoTexto !== undefined ? `<pre class="leido-texto" tabindex="0">${escapar(leidoTexto)}</pre>` : ''}</div>`;
  const puntos = htmlPuntos(arbol.mapa?.puntos, c.X);
  const madurez = c.madurez?.nombre ? `<span class="madurez medida" title="${attr(t('madurezTitulo', { nivel: c.madurez.nivel, de: c.madurez.de }))}">${escapar(c.madurez.nombre)} <small>${c.madurez.nivel}/${c.madurez.de}</small></span>` : '';
  const quien = `<span class="quien">${escapar(c.autor ?? '')}</span>`;
  // El personaje del centro (VG, 12-11, #38): el del 0 es la configuración general; en Sequenced va arriba de la columna (htmlCeroColumna), no aquí.
  const cero = arbol.apilada && c.cara === 'anverso' ? '' : htmlInterrogante(c.sitio, { clase: 'sitio-centro' });
  const marco = htmlMarcoCapa(c.marco); // el marco del mundo abrazando el borde del centro (sus esquinas y una línea), nunca encima
  // En el móvil en vertical (Sequenced), la tarjeta del foco sin movimientos encima (VG, 11-11, #7): nada flota.
  const efectos = c.nuevos?.efectos?.length && !(arbol.secuencia && c.cara === 'anverso') ? htmlEscenario({ nuevos: c.nuevos, consumido: c.consumido }) : '';
  if (c.cara === 'anverso') {
    return `<section class="nucleo anverso tamano-${c.tamano?.tamano ?? 1}"${nodo('foco', { tam: 'foco', cara: 'anverso', rep: repDe(c.representacion) })} data-centro="${c.pv}" data-x="${c.X}" aria-label="${attr(c.etiqueta)}">
      <header class="nucleo-cabeza"><span class="etiqueta">${escapar(c.etiqueta)}</span>${madurez}${quien}${cero}${voltear}</header>
      ${puntos}
      <h1 class="representacion${c.representacion?.aislada ? ' con-aislada' : ''}">${htmlRepresentacion(c.representacion)}${efectos}</h1>
      ${arbol.secuencia ? htmlFilas(arbol, c) : `<label class="campo campo-0 campo-unico"${nodo('campo', { d: 0 })}><span class="etiqueta-0">${escapar(c.etiqueta)}</span><input class="campo-input" data-campo="${c.pv}" data-x="${c.X}" value="" placeholder="${attr(t('nuevoAquiMarcador', { que: c.textoDelFoco ?? c.representacion?.texto ?? '' }))}" title="${attr(c.ayuda ?? '')}" autocomplete="off"></label>`}
      ${leido}${marco}
    </section>`;
  }
  if (c.cara === 'reverso') {
    const ancla = c.ancla ? `<p class="ancla">${t('sobre')} <button type="button" class="enlace" data-abrir="${attr(c.ancla.sobre ?? '')}" ${c.ancla.sobre ? '' : 'disabled'}>${escapar(c.ancla.sobreTexto ?? t('laRaiz'))}</button>${c.ancla.en ? ` · ${t('en')} ${escapar(c.ancla.en)}` : ''}</p>` : '';
    const pasos = c.pasos ? `<ul class="pasos">${Object.values(c.pasos.porPv).concat(c.pasos.comun ? [c.pasos.comun] : []).map((p) => `<li><b>${escapar(p.nombre)}</b> ${p.k === null ? '—' : escapar(p.k)}${p.de ? `<small>/${escapar(p.de)}</small>` : ''}</li>`).join('')}</ul>` : '';
    const validacion = c.validacion?.length ? `<ul class="motivos">${c.validacion.map((v) => `<li>${escapar(v.motivo)}</li>`).join('')}</ul>` : '';
    return `<section class="nucleo reverso tamano-${c.tamano?.tamano ?? 1}"${nodo('foco', { tam: 'foco', cara: 'reverso', rep: repDe(c.representacion) })} data-centro="${c.pv}" data-x="${c.X}" aria-label="${attr(c.etiqueta)}">
      <header class="nucleo-cabeza"><span class="etiqueta">${escapar(c.etiqueta)}</span>${madurez}${quien}${cero}${voltear}</header>
      ${puntos}
      <p class="tipo">${c.plantilla ? `${t('plantilla')} <b>${escapar(c.plantilla)}</b>` : t('sinPlantilla')}${c.t ? ` · <time>${escapar(c.t)}</time>` : ''}</p>
      ${ancla}${c.verificado ? `<p class="verificado-linea">${htmlVerificado(c)}</p>` : ''}
      ${htmlOcupantes(c.ocupantes, { pv: c.pv })}
      <label class="campo campo-5"${nodo('campo', { d: 5 })}><span class="etiqueta-0">${escapar(c.etiqueta)}</span><input class="campo-input" data-campo="${c.pv}" data-x="${c.X}" value="" placeholder="${attr(c.plantilla ?? '')}" title="${attr(c.ayuda ?? '')}" autocomplete="off"></label>
      ${pasos}${validacion}${efectos}${marco}
    </section>`;
  }
  // A pantalla completa, el escenario y el marco del centro son capas de la rejilla (htmlRejilla); sin tarjeta central, la etapa va en la cabecera.
  const capas = c.rejilla?.capas ?? null;
  const etapaEnCabeza = capas && !c.rejilla.flotante ? capaPieza(capas.etapa, { clase: 'pieza-etapa capa-etapa capa-etapa-cabeza', alt: c.etiqueta }) : '';
  const quienConEtapa = etapaEnCabeza ? quien.replace('</span>', etapaEnCabeza + '</span>') : quien;
  return `<section class="nucleo abierto tamano-${c.tamano?.tamano ?? 1}"${nodo('foco', { tam: 'foco', cara: 'abierto', rep: repDe(c.representacion) })} data-centro="${c.pv}" data-x="${c.X}"${c.estilo && !c.rejilla ? ` data-id="${attr(c.X)}"` : ''} aria-label="${attr(c.etiqueta)}">
    <header class="nucleo-cabeza"><span class="numero">${c.pv}</span><span class="etiqueta">${escapar(c.etiqueta)}</span>${htmlMedida(c.medida)}${quienConEtapa}${cero}${arbol.mapa?.completa ? `<button type="button" class="volver volver-claro"${nodo('control')} ${c.rejilla?.ruta?.length ? `data-subir="${c.pv}"` : `data-foco-pv="${arbol.mapa.completa.volver}"`} data-x="${c.X}" title="${attr(t('volverTitulo'))}">← ${t('volver')}</button>` : `<button type="button" class="volver" data-foco-pv="0" data-x="${c.X}" title="${attr(t('volverAl0'))}">0</button>`}</header>
    ${c.rejilla ? '' : htmlEscenario(c, { paso: c.pasos?.porPv?.[c.pv] ?? null, etiqueta: c.etiqueta })}
    ${c.rejilla ? htmlRejilla(c.rejilla, { completa: true, arbol }) : htmlOcupantes(c.ocupantes, { pv: c.pv, disposicion: c.disposicion })}
    <p class="ayuda">${escapar(c.ayuda ?? '')}</p>${GEOMETRIA[c.pv]?.grupo === 'cruz' && GEOMETRIA[c.pv]?.fila === 'abajo' && !c.rejilla?.camino ? htmlGuia(arbol.guia) : ''}${c.rejilla ? '' : htmlMarcoCapa(c.marco)}
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

/** Una lista de valores posibles (contrato.opciones) para escribir en la posición pv de X: cada uno, un botón (data-opcion, data-valor). */
const htmlOpciones = (lista, pv, X, clase = 'opciones') => (lista?.length ? `<ul class="${clase}" data-opciones="${pv}">${lista.map((o) => `<li><button type="button" class="opcion"${nodo('opcion')} data-opcion="${pv}" data-valor="${attr(o.valor)}" data-x="${attr(X)}" title="${attr(o.texto)}">${escapar(o.texto)}</button></li>`).join('')}</ul>` : '');

/**
 * El aro: ocho sitios alrededor del elemento, en la matriz 3 × 3 sin centro (data-fila y data-columna de cada sitio; el CSS los
 * pone en su celda), cada uno en el color de su PV (data-pv) con su acción por defecto (lanzada por el id de su plantilla: un clic).
 * El clic mantenido (o el derecho) sobre un sitio despliega su lista, pegada al chip: las demás acciones y los valores posibles de
 * su posición para escribirlos. Un sitio sin acciones ni valores va apagado y sin lista. El centro es el propio elemento (su 0):
 * un clic entra en él y el clic mantenido lo edita: el input con su valor, la lista del 0 debajo y la del 5 (su reverso) encima.
 * Sin botones extra: Esc o un clic fuera cierra. Dónde cae en la pantalla lo decide la app (carta/app.js), no el árbol.
 */
function htmlAro(aro) {
  if (!aro) return '';
  const huecos = aro.huecos.map((h) => {
    const a = h.accionPorDefecto ?? h.accion;
    const alternativas = h.alternativas ?? h.otras ?? [];
    const opciones = h.opciones ?? [];
    const conLista = alternativas.length > 0 || opciones.length > 0;
    const nombre = a ? `${escapar(a.nombre)}${a.faltan.length ? ` <small>[${escapar(a.faltan.join(', '))}]</small>` : ''}` : '';
    const cuantas = conLista ? ` <small class="cuantas" aria-hidden="true">${alternativas.length + opciones.length}</small>` : '';
    const defecto = a
      ? `<button type="button" class="accion por-defecto"${nodo('accion')} data-lanzar="${attr(a.id)}" data-x="${aro.X}" title="${attr(h.etiqueta)}: ${attr(a.nombre)}"><span class="numero">${h.pv}</span>${h.icono?.recurso ? htmlPieza(h.icono, { alt: h.etiqueta }) : ''}<span class="nombre">${nombre}</span>${cuantas}</button>`
      : `<span class="accion vacia" title="${attr(h.etiqueta)}: ${attr(t(conLista ? 'aroMantenerLista' : 'nadaQueHacer'))}"><span class="numero">${h.pv}</span><span class="nombre">${conLista ? escapar(h.etiqueta) : '—'}</span>${cuantas}</span>`;
    const lista = h.abierto && conLista
      ? `<ul class="otras"><li class="otras-titulo">${escapar(h.etiqueta)}</li>${alternativas.map((x) => `<li><button type="button"${nodo('accion')} data-lanzar="${attr(x.id)}" data-x="${aro.X}">${escapar(x.nombre)}${x.faltan.length ? ` <small>[${escapar(x.faltan.join(', '))}]</small>` : ''}</button></li>`).join('')}${opciones.length ? `<li class="otras-titulo otras-valores">${escapar(t('aroEscribir'))}</li>${opciones.map((o) => `<li><button type="button" class="opcion"${nodo('opcion')} data-opcion="${h.pv}" data-valor="${attr(o.valor)}" data-x="${aro.X}" title="${attr(o.texto)}">${escapar(o.texto)}</button></li>`).join('')}` : ''}</ul>`
      : '';
    return `<li class="hueco hueco-${h.pv} lado-${h.lado ?? ''}${a || conLista ? '' : ' apagado'}${h.abierto ? ' desplegado' : ''}"${nodo('hueco')} data-pv="${h.pv}" data-fila="${h.celda[0]}" data-columna="${h.celda[1]}"${conLista ? ' data-con-lista' : ''}><span class="sitio">${defecto}</span>${lista}</li>`;
  }).join('');
  const c = aro.centro;
  if (c?.nuevo) {
    // Sobre un hueco vacío (issue #22): solo el centro, con un input nuevo y, debajo, los valores posibles de esa posición.
    const input = `<input class="campo-input campo-nuevo" data-campo="${c.pv}" data-x="${aro.X}" data-nuevo value="" placeholder="${attr(t('aroNuevoMarcador', { que: c.etiqueta ?? '' }))}" title="${attr(t('aroNuevoTitulo', { que: c.etiqueta ?? '' }))}" aria-label="${attr(aro.texto)}" autocomplete="off">`;
    return `<div class="aro-fondo" data-cerrar><div class="aro aro-nuevo editando"${nodo('aro', { nuevo: c.pv })} data-x="${aro.X}" data-nuevo="${c.pv}" role="dialog" aria-label="${attr(aro.texto)}"><ul></ul><div class="aro-centro" data-aro-centro data-x="${aro.X}"><b><span class="numero">${c.pv}</span> ${escapar(c.etiqueta ?? '')}</b><div class="aro-edicion">${input}${htmlOpciones(c.opciones0, c.pv, aro.X, 'opciones opciones-abajo')}</div></div></div></div>`;
  }
  const edicion = c?.editando
    ? `<div class="aro-edicion">${htmlOpciones(c.opciones5, c.pv5, aro.X, 'opciones opciones-arriba')}<input class="campo-input" data-campo="${c.pv}" data-x="${aro.X}" value="${attr(c.valor ?? '')}" aria-label="${attr(c.etiqueta ?? '')}" autocomplete="off">${htmlOpciones(c.opciones0, c.pv, aro.X, 'opciones opciones-abajo')}</div>`
    : '';
  return `<div class="aro-fondo" data-cerrar><div class="aro${c?.editando ? ' editando' : ''}"${nodo('aro')} data-x="${aro.X}" role="dialog" aria-label="${attr(t('aroDe', { que: aro.texto }))}"><ul>${huecos}</ul><div class="aro-centro" data-aro-centro data-x="${aro.X}" title="${attr(t('aroCentroTitulo'))}"><b>${escapar(aro.texto)}</b>${edicion}</div></div></div>`;
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
 * lo escrito con contrato.desdeLegible en los tipos simples (data-simple) y, si no se tocó, manda el crudo. Un parámetro con
 * valores posibles (sus `opciones`, de contrato.opciones) lleva delante un <select> con ellos y «otro…»: elegir uno lo pone
 * en el input (oculto); «otro…» lo destapa para escribir (gestos.js, data-otro-de).
 */
function htmlFormulario(f) {
  if (!f) return '';
  const campo = (c) => {
    const id = 'param-' + c.nombre.replace(/\W+/g, '-');
    const tipoInput = c.tipo === 'number' ? 'number' : c.tipo === 'instant' ? 'datetime-local' : 'text';
    const valor = valorDeInput(c);
    const crudo = c.valor === null || c.valor === undefined ? '' : JSON.stringify(c.valor);
    const btml = crudo ? `<details class="btml"><summary>${t('verEnBtml')}</summary><code>${escapar(crudo)}</code></details>` : '';
    // Con valores posibles (contrato.opciones), un desplegable; «otro…» destapa el input (que es el que se envía).
    const opciones = c.opciones ?? [];
    const crudoTexto = c.valor === null || c.valor === undefined || typeof c.valor === 'object' ? null : String(c.valor);
    const elegida = opciones.find((o) => o.valor === crudoTexto || o.valor === valor) ?? null;
    const otro = !elegida && valor !== '';
    // Sin valor, una opción en blanco (elegida); lo requerido lo pide el desplegable (el input, oculto, no se puede enfocar).
    const select = opciones.length
      ? `<select class="param-opciones" data-otro-de="${id}" aria-label="${attr(c.etiqueta)}"${c.requerido ? ' required' : ''}>${elegida || otro ? '' : '<option value="" selected></option>'}${opciones.map((o) => `<option value="${attr(o.valor)}"${o === elegida ? ' selected' : ''}>${escapar(o.texto)}</option>`).join('')}<option value="${attr(t('otro'))}" data-otro${otro ? ' selected' : ''}>${escapar(t('otro'))}</option></select>`
      : '';
    const valorDelInput = valor; // el legible, como siempre (el crudo en data-crudo); elegir otra opción pone su valor
    return `<div class="campo ${c.falta ? 'falta' : ''}"><label for="${id}">${escapar(c.etiqueta)}${c.requerido ? ` <abbr title="${attr(t('requerido'))}">*</abbr>` : ''} <small class="tipo">${escapar(c.tipo)}</small></label>
      ${select}<input id="${id}" name="${attr(c.nombre)}" type="${tipoInput}" ${tipoInput === 'number' ? 'step="any"' : ''} value="${attr(valorDelInput)}" ${c.requerido && !opciones.length ? 'required' : ''} data-tipo="${attr(c.tipo)}" data-etiqueta="${attr(c.etiqueta)}" data-simple="${c.simple ? 1 : 0}" data-crudo="${attr(crudo)}" data-legible="${attr(valorDelInput)}" data-validacion="${attr(c.validacion ?? '')}" title="${attr(c.ayuda)}" autocomplete="off"${opciones.length && !otro ? ' hidden' : ''}>
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
    ${campos}${htmlEjecucion(f.ejecucion)}${motivos}${resultado}
    <footer>${f.ejecucion ? `<button type="submit"${atributosDelBoton(f.ejecucion.boton)}>${f.animado && f.ejecucion.boton?.estado === 'efectos' ? '<span class="capa capa-efectos capa-ejecutar" aria-hidden="true"></span>' : ''}${t('ejecutar')}</button>` : `<button type="submit">${t(f.lectura ? 'leer' : f.camino ? 'darElPaso' : 'lanzar')}</button>`}</footer>
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
 * Los ajustes del exterior dentro del formulario de la configuración (docs/CONTRATO.md §16.2 bis, decisión #58): los campos de
 * la plantilla «exterior settings» de la época (relé, archivos, sello; sin `name`: la app los lee por data-exterior-campo y los
 * escribe como su propio registro en el 9 del alta), en un desplegable como el de la guía. Una dirección vacía deja ese camino
 * sin usar; `-` quita la que había.
 */
function htmlAjustesExterior(g) {
  if (!g) return '';
  const campos = g.campos.map((c) => `<div class="campo"${nodo('control')}><label for="exterior-${c.pv}">${escapar(c.etiqueta)}</label><input id="exterior-${c.pv}" data-exterior-campo="${attr(c.clave)}" type="text" value="${attr(c.valor)}" placeholder="${attr(c.marcador)}" title="${attr(c.ayuda)}" autocomplete="off" spellcheck="false"><small class="ayuda">${escapar(c.ayuda)}</small></div>`).join('');
  return `<details class="exterior-ajustes"${nodo('control')}${g.campos.some((c) => c.valor) ? ' open' : ''}><summary>${t('exteriorAjustes')}</summary><fieldset class="guia-ajustes">${campos}</fieldset></details>`;
}

/**
 * El formulario de la configuración, generado desde la plantilla «preferences»: cada campo por su clave, con su
 * etiqueta en el idioma. En una cuenta (`claveLectura` es una cadena, quizá vacía), además el campo aparte de la clave
 * de lectura del libro compartido: sin `name` (no entra en el registro de preferencias: la app lo lee por
 * data-clave-lectura y lo guarda en el almacén local de la cuenta, nunca en el eje).
 */
export function htmlConfiguracion(p, { motivos = [], claveLectura, guia, exterior } = {}) {
  if (!p) return '';
  // Un campo con opciones (el modelo, #4) es un desplegable con ellas; los demás, texto.
  const control = (c) => (c.opciones
    ? `<select id="pref-${c.pv}" name="${attr(c.clave)}" title="${attr(c.ayuda)}">${c.opciones.map((o) => `<option value="${attr(o.valor)}"${o.valor === c.valor ? ' selected' : ''}>${escapar(o.texto)}</option>`).join('')}</select>`
    : `<input id="pref-${c.pv}" name="${attr(c.clave)}" type="text" value="${attr(valorInput(Array.isArray(c.valor) ? c.valor.join(' ') : c.valor))}" placeholder="${attr(c.marcador.join(' '))}" title="${attr(c.ayuda)}" autocomplete="off">`);
  const campos = p.campos.map((c) => `<div class="campo"><label for="pref-${c.pv}">${escapar(c.etiqueta)}</label>${control(c)}<small class="ayuda">${escapar(c.ayuda)}</small></div>`).join('')
    + (typeof claveLectura === 'string' ? `<div class="campo"><label for="pref-clave-lectura">${t('claveLectura')}</label><input id="pref-clave-lectura" data-clave-lectura type="password" value="${attr(claveLectura)}" title="${attr(t('claveLecturaAyuda'))}" autocomplete="off" spellcheck="false"><small class="ayuda">${escapar(t('claveLecturaAyuda'))}</small></div>` : '')
    + htmlAjustesGuia(guia)
    + htmlAjustesExterior(exterior);
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

/**
 * Lo que era la barra superior, ahora las posiciones del 0 de mi alta (VG, 12-11, #38: «la barra desaparece; la
 * configuración general es el personaje del 0»): 0 quién soy (y el ejemplo), 1 cuánto (hoy y «guardar este rato»),
 * 2 la configuración (con qué condición), 4 lo que se hace con la cuenta (la copia de seguridad, olvidar o reiniciar),
 * 5 el estilo (sobrio o animado), 8 opinar (frente a otros) y 9 cómo: lo guardado, el libro compartido y los ajustes de la guía y del exterior.
 * Cada control conserva su data-* de siempre (data-quien, data-ejemplo, data-englobar, data-config, data-copia,
 * data-olvidar, data-reiniciar, data-preferencia, data-opinar-ctl, data-sincronia). → { [posición]: html }.
 */
function controlesDelCero(arbol, { ejemplos = [], ejemplo = null, guardado = '', cuentas = [], cuenta = null, sincronia = null, opinar = null } = {}) {
  const quien = htmlSoy(arbol, { cuentas, cuenta });
  const ej = !cuenta && ejemplos.length ? `<label class="ajuste"${nodo('control')}>${t('ejemplo')} <select data-ejemplo>${ejemplos.map((e) => `<option value="${attr(e.id)}" ${e.id === ejemplo ? 'selected' : ''}>${escapar(e.etiqueta)}</option>`).join('')}</select></label>` : '';
  const tiempo = arbol.tiempo ? Object.entries(arbol.tiempo).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${k}`).join(' · ') : '';
  const local = arbol.local ? `<span class="tiempo" title="${attr(t('tiempoLocalTitulo', { serie: arbol.local.serie }))}">${escapar(t('hoy', { segundos: arbol.local.gastadoHoy }))}${tiempo ? ' · ' + escapar(tiempo) : ''}</span><button type="button" class="englobar"${nodo('control')} data-englobar ${arbol.local.pendientes ? '' : 'disabled'} title="${attr(t('englobarTitulo', { cuantas: arbol.local.pendientes }))}">${t('englobar')}${arbol.local.pendientes ? ` · ${arbol.local.pendientes}` : ''}</button>` : '';
  const propios = cuenta
    ? `<button type="button"${nodo('control')} data-copia title="${attr(t('copiaTitulo'))}">${t('copiaDeSeguridad')}</button><button type="button"${nodo('control')} data-olvidar title="${attr(t('olvidarTitulo'))}">${t('olvidar')}</button>`
    : `<button type="button"${nodo('control')} data-reiniciar title="${attr(t('reiniciarTitulo'))}">${t('reiniciar')}</button>`;
  const config = `<button type="button"${nodo('control')} data-config title="${attr(t('configuracionTitulo'))}">${t('configuracion')}</button>`;
  const ajustes = `<button type="button"${nodo('control')} data-config title="${attr(t('ajustesGuiaExteriorTitulo'))}">${t('ajustesGuiaExterior')}</button>`;
  return {
    0: quien + ej,
    1: local,
    2: config,
    4: propios,
    5: (arbol.interruptores ?? []).map(htmlInterruptor).join(''),
    8: htmlOpinar(opinar),
    9: `${ajustes}<small class="guardado">${escapar(guardado)}</small>${htmlSincronia(sincronia)}`,
  };
}

/** Sequenced (el móvil en vertical): el personaje del 0 arriba de la columna, en lugar de la barra de una línea y su menú. */
const htmlCeroColumna = (s) => (s?.X ? `<div class="cero-columna"${nodo('control')} data-cero>${htmlInterrogante(s, { clase: 'sitio-cero' })}<span class="cero-etiqueta">${escapar(t('ceroColumna'))}</span></div>` : '');

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
  archivoDe = typeof extra.archivo === 'function' ? extra.archivo : () => null; // los archivos adjuntos de esta pestaña (htmlRepresentacion)
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
  // Sequenced (el móvil en vertical): una columna, el pasado encima de la tarjeta del foco y el futuro debajo (sin
  // árbol de la secuencia, las franjas de antes).
  const escena = a.apilada
    ? (a.secuencia
      ? `<div class="secuencia" data-secuencia>${htmlHilo(a.secuencia.pasado, { capa: a.animado })}<div class="secuencia-ahora">${htmlCentro(a.centro, a, extra)}${htmlHilo(a.secuencia.futuro, { capa: a.animado })}</div></div>`
      : `<div class="franja franja-cruz" data-franja="cruz">${cruz.map(de).join('')}</div>${htmlCentro(a.centro, a, extra)}<div class="franja franja-x" data-franja="x">${x.map(de).join('')}</div>`)
    : htmlMapa(a, extra, laterales);
  const estilos = htmlEstilos(a);
  return `<div class="${clase}"${nodo('carta', { modo: a.apilada ? 'apilada' : 'matriz', render: a.animado ? 'animado' : 'sobrio', ancho: a.medidas?.ancho, alto: a.medidas?.alto, x0: a.centro?.representacion?.texto ?? '' })} data-x="${a.X}" data-disposicion="${attr(a.disposicion)}" data-animaciones="${Number(a.limite) || 0}">
    ${estilos}
    ${a.apilada ? htmlCeroColumna(a.centro?.sitio) : ''}
    ${avisos.length ? `<p class="aviso" role="alert">${avisos.map(escapar).join(' · ')}</p>` : ''}
    ${extra.exito ? `<p class="exito" role="status">${escapar(extra.exito)}</p>` : ''}
    ${htmlRosetones(a.rosetones, { apilada: a.apilada, parte: 'arriba' })}
    <div class="escena">${escena}</div>
    ${htmlRosetones(a.rosetones, { apilada: a.apilada, parte: 'abajo' })}
    ${a.apilada ? htmlDigitos(a.secuencia) : ''}
    ${htmlAro(a.aro)}
    ${htmlSitio(a.sitio, a, extra)}
    ${htmlFormulario(a.formulario)}
    ${extra.preferencias ? htmlConfiguracion(extra.preferencias, { motivos: extra.motivosPreferencias, claveLectura: extra.claveLectura, guia: extra.guiaAjustes, exterior: extra.exteriorAjustes }) : ''}
    ${extra.arranque ? htmlArranque(extra.arranque, { cuentas: extra.cuentas, sobreCarta: true }) : ''}
    ${htmlCopia(extra.copia)}
  </div>`;
}

/**
 * Los dos estilos de lo que se pinta (el propio, X.0.9, y el de los de abajo, X.5.0; contrato.estilo), como CSS acotado a
 * su registro: `[data-id="<id>"] { … }` y `[data-id="<id>"] .hijo { … }`. Cada texto vuelve a pasar por cssSeguro aquí
 * (el árbol podría llegar de otro sitio) y solo se emite si el id es un identificador sin más: nada que no sea una
 * declaración corriente llega al <style>, y sin `<` ni `}` en ella no puede cerrarlo ni salir de su regla.
 */
export function htmlEstilos(a) {
  const vistos = new Map();
  const ver = (id, estilo) => { if (typeof id === 'string' && /^[0-9A-Za-z_-]{1,128}$/.test(id) && estilo && !vistos.has(id)) vistos.set(id, estilo); };
  ver(a.X, a.centro?.estilo);
  ver(a.centro?.rejilla?.X, a.centro?.rejilla?.estilo);
  for (const n of [a.centro?.rejilla, ...(a.laterales ?? []).map((l) => l.rejilla)]) {
    for (const c of n?.celdas ?? []) for (const o of c.ocupantes ?? []) ver(o.X, o.estilo);
    for (const b of n?.bandas ?? []) for (const o of b.items ?? []) ver(o.X, o.estilo);
  }
  const reglas = [];
  for (const [id, e] of vistos) {
    const propio = cssSeguro(e.propio?.css);
    const hijos = cssSeguro(e.hijos?.css);
    if (propio) reglas.push(`[data-id="${id}"]{${propio}}`);
    if (hijos) reglas.push(`[data-id="${id}"] .hijo{${hijos}}`);
  }
  return reglas.length ? `<style data-estilos>${reglas.join('')}</style>` : '';
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
  // Quién se reproduce: las que piden animarse, por prioridad y orden; las primeras `tope` tienen sitio. Con
  // «reducir movimiento» en el sistema, ninguna: cada una se queda en su fotograma.
  const quieto = typeof globalThis.matchMedia === 'function' && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const candidatas = huecos.filter((h) => h.dataset.animar === '1' && !quieto).map((h, k) => ({ h, k, p: Number(h.dataset.prioridad) || 0 })).sort((a, b) => a.p - b.p || a.k - b.k).map((x) => x.h);
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
    const src = srcDeRecurso(h.dataset.lottie);
    if (!src) continue;
    datos(src).then((animationData) => {
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
