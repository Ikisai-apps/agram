// El pintado de la carta: convierte el árbol de carta/carta.js en HTML. Aquí no se decide nada: cada nodo trae ya
// su etiqueta, su tamaño, su representación, sus ocupantes, su pieza, y todo texto que viene de la época llega ya en
// el idioma de quien mira (contrato.texto, contrato.legible). Solo se escribe el marcado con los atributos data-*
// que carta/gestos.js lee; los textos propios de la interfaz (botones, títulos) salen de carta/textos.js. Sobrio por
// defecto: formas y texto; en animado, las piezas con recurso van como <img> (svg, imagen) o como un contenedor
// Lottie que trasPintar() rellena con lottie-web si está cargado. El animado entero (etapa 5): cada PV lleva su
// escenario (el fondo detrás, la etapa, el personaje, los efectos superpuestos) dentro de su marco; los ocupantes, su
// elemento; nunca más de N animaciones a la vez (data-animaciones, un dato de la configuración), primero lo nuevo y
// lo enfocado; las que salen de pantalla se pausan.

import { NIVEL, LATERALES, ANIMAR } from './carta.js';
import { t } from './textos.js';

export const escapar = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const corto = (id) => String(id ?? '').slice(0, 8);
const attr = (s) => escapar(s).replace(/'/g, '&#39;');

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

/** Un ocupante: una hoja, su texto; una referencia, un botón que entra en el registro; una décupla, sus hojas. En animado, delante, su elemento (la pieza suelta del mundo). */
function htmlOcupante(o) {
  const elemento = o.elemento?.recurso ? htmlPieza(o.elemento, { clase: 'pieza-elemento', alt: '' }) : '';
  if (o.tipo === 'referencia' && o.X) {
    const rep = o.representacion?.recurso ? htmlRepresentacion(o.representacion, { clase: 'rep-mini' }) : elemento;
    return `<button type="button" class="ocupante ocupante-ref" data-abrir="${o.X}" data-x="${o.X}" title="${attr(t('entrarEn', { que: o.texto }))}">${rep}<span class="texto">${escapar(o.texto)}</span>${o.autor ? `<small class="quien">${escapar(o.autor)}</small>` : ''}</button>`;
  }
  if (o.tipo === 'decupla') return `<span class="ocupante ocupante-decupla">${elemento}${o.hojas.map((h) => `<span class="hoja">${escapar(h)}</span>`).join('')}</span>`;
  return `<span class="ocupante ocupante-hoja">${elemento}${escapar(o.texto)}</span>`;
}

/** La lista o la matriz de ocupantes de un PV, con «cargar más» al final si hay más. */
function htmlOcupantes(oc, { pv, disposicion } = {}) {
  if (!oc) return '';
  const lista = oc.lista.length ? oc.lista.map((o) => `<li>${htmlOcupante(o)}</li>`).join('') : `<li class="nada">${t('nada')}</li>`;
  const mas = oc.cargarMas ? `<li class="cargar-mas"><button type="button" data-cargar-mas="${pv}">${escapar(t('cargarMas', { cuantos: oc.total - oc.lista.length }))}</button></li>` : '';
  return `<ul class="ocupantes ${disposicion ? 'disposicion-' + attr(disposicion) : ''}" data-total="${oc.total}">${lista}${mas}</ul>`;
}

/** El diario (lo llegado bajo X), como lista. */
function htmlDiario(d) {
  if (!d) return '';
  const filas = d.entradas.map((e) => `<li><time datetime="${attr(e.t)}">${escapar(e.t.replace('T', ' ').replace('Z', ''))}</time> · <b>${escapar(e.autor)}</b> · <button type="button" class="enlace" data-abrir="${e.id}">${corto(e.id)}</button><small>${escapar(e.movimientos.join(', '))}</small></li>`).join('');
  return `<section class="diario"><h4>${d.total} ${t(d.total === 1 ? 'transaccion' : 'transacciones')}</h4><ol>${filas || `<li class="nada">${t('nada')}</li>`}</ol></section>`;
}

/** El camino: cada paso, mío (lanzable, por el id de su plantilla), de espera (marcado) o hecho; los niveles si la madurez es 0; «seguir». */
export function htmlCamino(c, { X } = {}) {
  if (!c) return '';
  const pasos = c.pasos.map((p, i) => {
    const clase = p.hecho ? 'hecho' : p.espera ? 'espera' : p.mio ? 'mio' : 'otro';
    const cuerpo = `<span class="fuente">${escapar(p.fuente)}</span> <span class="falta">${escapar(p.falta ?? '')}</span>`;
    const marca = p.hecho ? `<span class="marca">${t('hecho')}</span>` : p.espera ? `<span class="marca">${escapar(t('esperaA', { quien: p.espera }))}</span>` : '';
    return p.mio
      ? `<li class="paso ${clase}"><button type="button" data-paso="${i}" data-x="${attr(p.hacer?.X ?? X ?? '')}" data-lanzar="${attr(p.hacer.id)}">${escapar(p.hacer.nombre)}</button> ${cuerpo}</li>`
      : `<li class="paso ${clase}">${cuerpo} ${marca}</li>`;
  }).join('');
  const niveles = c.niveles ? `<p class="niveles">${t('paraUbicarse')} ${c.niveles.map((n) => `<span>${escapar(n)}</span>`).join(' → ')}</p>` : '';
  const seguir = c.pasos.some((p) => p.mio && !p.hacer?.lectura) ? `<button type="button" class="seguir" data-seguir>${t('seguir')}</button>` : '';
  return `<section class="camino" aria-label="${attr(t('camino'))}">${niveles}<ol>${pasos || `<li class="nada">${t('nadaQueHacerAqui')}</li>`}</ol>${seguir}</section>`;
}

/** Un PV lateral en su nivel: comprimido (un dato), tarjeta (etiqueta y lo que cabe), bloque (la lista o la matriz). */
function htmlLateral(n, arbol) {
  const clases = ['pv', `pv-${n.pv}`, `grupo-${n.grupo}`, `lado-${n.lado ?? ''}`, `fila-${n.fila ?? ''}`, `nivel-${n.nivel}`].join(' ');
  if (n.nivel === NIVEL.oculto) return `<div class="${clases}" data-pv="${n.pv}" data-x="${n.X}" hidden></div>`;
  // En comprimido, la etapa en sello (si el modelo la trae) o el elemento; en tarjeta y bloque, el escenario entero.
  const sello = n.etapa?.recurso ? htmlPieza(n.etapa, { clase: 'pieza-etapa', alt: n.etiqueta }) : htmlPieza(n.pieza, { paso: n.paso, alt: n.etiqueta });
  const efectos = n.nivel === NIVEL.comprimido && n.nuevos?.efectos?.length ? htmlEscenario({ nuevos: n.nuevos, consumido: n.consumido }) : '';
  const dato = `<span class="dato" title="${attr(n.comprimido.que ?? '')}">${escapar(n.comprimido.dato)}${n.comprimido.de ? `<small>/${escapar(n.comprimido.de)}</small>` : ''}</span>`;
  const cabeza = `<header class="pv-cabeza"><span class="numero">${n.pv}</span><span class="etiqueta">${escapar(n.etiqueta)}</span>${dato}</header>`;
  const marco = htmlMarco(n.marco);
  let cuerpo = '';
  if (n.nivel === NIVEL.comprimido) cuerpo = `<div class="comprimido" title="${attr(n.etiqueta)}: ${attr(n.ayuda ?? '')}"><span class="numero">${n.pv}</span>${sello || dato}${sello ? dato : ''}${efectos}${marco}</div>`;
  else {
    const camino = n.grupo === 'cruz' && n.fila === 'abajo' ? htmlCamino(arbol.camino, { X: n.X }) : '';
    const escenario = htmlEscenario(n, { paso: n.paso, etiqueta: n.etiqueta }) || (n.pieza ? htmlPieza(n.pieza, { paso: n.paso, alt: n.etiqueta }) : '');
    cuerpo = cabeza + escenario + htmlOcupantes(n.ocupantes, { pv: n.pv, disposicion: n.disposicion }) + (n.nivel >= NIVEL.bloque ? htmlDiario(n.diario) : '') + camino
      + `<footer class="pv-pie"><button type="button" class="entrar" data-foco-pv="${n.pv}" data-x="${n.X}">${t('entrar')}</button><small class="ayuda">${escapar(n.ayuda ?? '')}</small></footer>` + marco;
  }
  return `<section class="${clases}" data-pv="${n.pv}" data-x="${n.X}" data-nivel="${n.nivel}" aria-label="${attr(n.etiqueta)}" tabindex="0">${cuerpo}</section>`;
}

/** Los campos del anverso: cada PV lateral con su etiqueta y un input (editar escribe un ocupante nuevo, nunca en sitio). */
function htmlCampos(campos, X) {
  return `<dl class="campos">${campos.map((c) => `<div class="campo campo-${c.pv}"><dt><label for="campo-${c.pv}" title="${attr(c.ayuda ?? '')}">${escapar(c.etiqueta)}${c.total > 1 ? ` <small>· ${c.total}</small>` : ''}</label></dt><dd><input id="campo-${c.pv}" class="campo-input" data-campo="${c.pv}" data-x="${X}" value="${attr(c.valor)}" placeholder="${attr((c.marcador ?? []).join(' · '))}" title="${attr(c.ayuda ?? '')}" autocomplete="off"></dd></div>`).join('')}</dl>`;
}

/** El centro: el anverso (0), el reverso (5) o un PV abierto como foco. */
function htmlCentro(c, arbol, { leidoTexto } = {}) {
  const voltear = `<button type="button" class="voltear" data-voltear aria-label="${attr(t('voltear'))} (${attr(t(c.cara === 'anverso' ? 'voltearAnverso' : 'voltearReverso'))})" title="${attr(t('voltear'))}">⟲</button>`;
  const leido = `<div class="leido"><button type="button" class="leido-boton" data-leido aria-pressed="${c.leido}" title="${attr(t(c.leido ? 'leidoOcultar' : 'leidoVer'))}">${t('leido')}</button>${c.leido && leidoTexto !== undefined ? `<pre class="leido-texto" tabindex="0">${escapar(leidoTexto)}</pre>` : ''}</div>`;
  const madurez = c.madurez?.nombre ? `<span class="madurez" title="${attr(t('madurezTitulo', { nivel: c.madurez.nivel, de: c.madurez.de }))}">${escapar(c.madurez.nombre)} <small>${c.madurez.nivel}/${c.madurez.de}</small></span>` : '';
  const quien = `<span class="quien">${escapar(c.autor ?? '')}</span>`;
  const marco = htmlMarco(c.marco);
  const efectos = c.nuevos?.efectos?.length ? htmlEscenario({ nuevos: c.nuevos, consumido: c.consumido }) : '';
  if (c.cara === 'anverso') {
    return `<section class="nucleo anverso tamano-${c.tamano?.tamano ?? 1}" data-centro="${c.pv}" data-x="${c.X}" aria-label="${attr(c.etiqueta)}">
      <header class="nucleo-cabeza"><span class="etiqueta">${escapar(c.etiqueta)}</span>${madurez}${quien}${voltear}</header>
      <h1 class="representacion">${htmlRepresentacion(c.representacion)}${efectos}</h1>
      <label class="campo campo-0"><span class="etiqueta-0">${escapar(c.etiqueta)}</span><input class="campo-input" data-campo="${c.pv}" data-x="${c.X}" value="" placeholder="${attr(c.representacion?.texto ?? '')}" title="${attr(c.ayuda ?? '')}" autocomplete="off"></label>
      ${htmlCampos(c.campos, c.X)}
      ${leido}${marco}
    </section>`;
  }
  if (c.cara === 'reverso') {
    const ancla = c.ancla ? `<p class="ancla">${t('sobre')} <button type="button" class="enlace" data-abrir="${attr(c.ancla.sobre ?? '')}" ${c.ancla.sobre ? '' : 'disabled'}>${escapar(c.ancla.sobreTexto ?? t('laRaiz'))}</button>${c.ancla.en ? ` · ${t('en')} ${escapar(c.ancla.en)}` : ''}</p>` : '';
    const pasos = c.pasos ? `<ul class="pasos">${Object.values(c.pasos.porPv).concat(c.pasos.comun ? [c.pasos.comun] : []).map((p) => `<li><b>${escapar(p.nombre)}</b> ${p.k === null ? '—' : escapar(p.k)}${p.de ? `<small>/${escapar(p.de)}</small>` : ''}</li>`).join('')}</ul>` : '';
    const validacion = c.validacion?.length ? `<ul class="motivos">${c.validacion.map((v) => `<li>${escapar(v.motivo)}</li>`).join('')}</ul>` : '';
    return `<section class="nucleo reverso tamano-${c.tamano?.tamano ?? 1}" data-centro="${c.pv}" data-x="${c.X}" aria-label="${attr(c.etiqueta)}">
      <header class="nucleo-cabeza"><span class="etiqueta">${escapar(c.etiqueta)}</span>${madurez}${quien}${voltear}</header>
      <p class="tipo">${c.plantilla ? `${t('plantilla')} <b>${escapar(c.plantilla)}</b>` : t('sinPlantilla')}${c.t ? ` · <time>${escapar(c.t)}</time>` : ''}</p>
      ${ancla}
      ${htmlOcupantes(c.ocupantes, { pv: c.pv })}
      <label class="campo campo-5"><span class="etiqueta-0">${escapar(c.etiqueta)}</span><input class="campo-input" data-campo="${c.pv}" data-x="${c.X}" value="" placeholder="${attr(c.plantilla ?? '')}" title="${attr(c.ayuda ?? '')}" autocomplete="off"></label>
      ${pasos}${validacion}${efectos}${marco}
    </section>`;
  }
  return `<section class="nucleo abierto tamano-${c.tamano?.tamano ?? 1}" data-centro="${c.pv}" data-x="${c.X}" aria-label="${attr(c.etiqueta)}">
    <header class="nucleo-cabeza"><span class="numero">${c.pv}</span><span class="etiqueta">${escapar(c.etiqueta)}</span>${quien}<button type="button" class="volver" data-foco-pv="0" data-x="${c.X}" title="${attr(t('volverAl0'))}">0</button></header>
    ${htmlEscenario(c, { paso: c.pasos?.porPv?.[c.pv] ?? null, etiqueta: c.etiqueta })}
    ${htmlOcupantes(c.ocupantes, { pv: c.pv, disposicion: c.disposicion })}
    <p class="ayuda">${escapar(c.ayuda ?? '')}</p>${htmlMarco(c.marco)}
  </section>`;
}

/** Los rosetones de identidad: ocho mosaicos muy comprimidos de mi foco, en las esquinas y los lados. */
function htmlRosetones(lista) {
  if (!lista.length) return '';
  return `<nav class="rosetones" aria-label="${attr(t('miFoco'))}">${lista.map((r) => `<button type="button" class="roseton grupo-${r.grupo} lado-${r.lado ?? ''} fila-${r.fila ?? ''} nivel-${r.nivel}" data-roseton="${r.pv}" data-x="${r.X}" title="${attr(t('deMiAlta', { que: r.etiqueta }))}">
    <span class="numero">${r.pv}</span><span class="dato">${escapar(r.comprimido.dato)}</span>
    ${r.nivel >= NIVEL.tarjeta && r.ocupantes ? `<span class="etiqueta">${escapar(r.etiqueta)}</span><ul>${r.ocupantes.lista.slice(0, 4).map((o) => `<li>${escapar(o.texto)}</li>`).join('') || `<li class="nada">${t('nada')}</li>`}</ul>` : ''}
  </button>`).join('')}</nav>`;
}

/** El aro: ocho huecos alrededor, uno por PV lateral, con la acción por defecto (lanzada por el id de su plantilla); un segundo toque despliega las demás. */
function htmlAro(aro) {
  if (!aro) return '';
  const huecos = aro.huecos.map((h) => {
    const defecto = h.accion ? `<button type="button" class="accion por-defecto" data-lanzar="${attr(h.accion.id)}" data-x="${aro.X}" title="${attr(h.etiqueta)}: ${attr(h.accion.nombre)}">${h.icono?.recurso ? htmlPieza(h.icono, { alt: h.etiqueta }) : ''}<span>${escapar(h.accion.nombre)}</span>${h.accion.faltan.length ? `<small>[${escapar(h.accion.faltan.join(', '))}]</small>` : ''}</button>` : `<span class="accion vacia" title="${attr(h.etiqueta)}: ${attr(t('nadaQueHacer'))}">—</span>`;
    const otras = h.otras.length ? `<button type="button" class="mas" data-aro-hueco="${h.pv}" aria-expanded="${h.abierto}" title="${attr(t('lasDemasAcciones', { que: h.etiqueta }))}">+${h.otras.length}</button>` : '';
    const lista = h.abierto && h.otras.length ? `<ul class="otras">${h.otras.map((a) => `<li><button type="button" data-lanzar="${attr(a.id)}" data-x="${aro.X}">${escapar(a.nombre)}${a.faltan.length ? ` <small>[${escapar(a.faltan.join(', '))}]</small>` : ''}</button></li>`).join('')}</ul>` : '';
    return `<li class="hueco hueco-${h.pv} lado-${h.lado ?? ''}" data-pv="${h.pv}"><span class="numero">${h.pv}</span><span class="etiqueta">${escapar(h.etiqueta)}</span>${defecto}${otras}${lista}</li>`;
  }).join('');
  return `<div class="aro-fondo" data-cerrar><div class="aro" role="dialog" aria-label="${attr(t('aroDe', { que: aro.texto }))}"><p class="aro-centro"><b>${escapar(aro.texto)}</b><button type="button" class="cerrar" data-cerrar aria-label="${attr(t('cerrar'))}">×</button></p><ul>${huecos}</ul></div></div>`;
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
  const campos = f.campos.map((c) => {
    const id = 'param-' + c.nombre.replace(/\W+/g, '-');
    const tipoInput = c.tipo === 'number' ? 'number' : c.tipo === 'instant' ? 'datetime-local' : 'text';
    const valor = valorDeInput(c);
    const crudo = c.valor === null || c.valor === undefined ? '' : JSON.stringify(c.valor);
    const btml = crudo ? `<details class="btml"><summary>${t('verEnBtml')}</summary><code>${escapar(crudo)}</code></details>` : '';
    return `<div class="campo ${c.falta ? 'falta' : ''}"><label for="${id}">${escapar(c.etiqueta)}${c.requerido ? ` <abbr title="${attr(t('requerido'))}">*</abbr>` : ''} <small class="tipo">${escapar(c.tipo)}</small></label>
      <input id="${id}" name="${attr(c.nombre)}" type="${tipoInput}" ${tipoInput === 'number' ? 'step="any"' : ''} value="${attr(valor)}" ${c.requerido ? 'required' : ''} data-tipo="${attr(c.tipo)}" data-etiqueta="${attr(c.etiqueta)}" data-simple="${c.simple ? 1 : 0}" data-crudo="${attr(crudo)}" data-legible="${attr(valor)}" data-validacion="${attr(c.validacion ?? '')}" title="${attr(c.ayuda)}" autocomplete="off">
      <small class="ayuda">${escapar(c.ayuda)}${c.validacion ? ` <code>${escapar(c.validacion)}</code>` : ''}</small>${btml}</div>`;
  }).join('');
  const motivos = f.motivos?.length ? `<ul class="motivos" role="alert">${f.motivos.map((m) => `<li>${escapar(m.mensaje)}</li>`).join('')}</ul>` : '';
  const resultado = f.resultado ? `<p class="exito" role="status">${escapar(f.resultado)}</p>` : '';
  return `<div class="formulario-fondo" data-cerrar><form class="formulario" data-formulario data-x="${f.X}" data-accion="${attr(f.accion)}" aria-label="${attr(f.nombre)}">
    <header><h2>${escapar(f.nombre)}</h2><button type="button" class="cerrar" data-cerrar aria-label="${attr(t('cerrar'))}">×</button></header>
    ${f.ofrecida ? '' : `<p class="aviso">${t('noSeOfrece')}</p>`}
    ${campos}${motivos}${resultado}
    <footer><button type="submit">${t(f.lectura ? 'leer' : f.camino ? 'darElPaso' : 'lanzar')}</button></footer>
  </form></div>`;
}

/** El formulario de la configuración, generado desde la plantilla «preferences»: cada campo por su clave, con su etiqueta en el idioma. */
function htmlConfiguracion(p, { motivos = [] } = {}) {
  if (!p) return '';
  const campos = p.campos.map((c) => `<div class="campo"><label for="pref-${c.pv}">${escapar(c.etiqueta)}</label><input id="pref-${c.pv}" name="${attr(c.clave)}" type="text" value="${attr(valorInput(Array.isArray(c.valor) ? c.valor.join(' ') : c.valor))}" placeholder="${attr(c.marcador.join(' '))}" title="${attr(c.ayuda)}" autocomplete="off"><small class="ayuda">${escapar(c.ayuda)}</small></div>`).join('');
  return `<div class="formulario-fondo" data-cerrar><form class="formulario configuracion" data-configuracion aria-label="${attr(t('configuracion'))}">
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
  return `<label class="ajuste">${t('soy')} <select data-quien>${mias}${ejemplo}${nuevas}</select></label>`;
}

/** La barra: quién soy, el ejemplo, el tiempo de hoy, «guardar este rato», la configuración, la copia de seguridad (en una cuenta) o reiniciar (en un ejemplo). */
function htmlBarra(arbol, { ejemplos = [], ejemplo = null, guardado = '', cuentas = [], cuenta = null } = {}) {
  const quien = htmlSoy(arbol, { cuentas, cuenta });
  const ej = !cuenta && ejemplos.length ? `<label class="ajuste">${t('ejemplo')} <select data-ejemplo>${ejemplos.map((e) => `<option value="${attr(e.id)}" ${e.id === ejemplo ? 'selected' : ''}>${escapar(e.etiqueta)}</option>`).join('')}</select></label>` : '';
  const tiempo = arbol.tiempo ? Object.entries(arbol.tiempo).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${k}`).join(' · ') : '';
  const local = arbol.local ? `<span class="tiempo" title="${attr(t('tiempoLocalTitulo', { serie: arbol.local.serie }))}">${escapar(t('hoy', { segundos: arbol.local.gastadoHoy }))}${tiempo ? ' · ' + escapar(tiempo) : ''}</span><button type="button" class="englobar" data-englobar ${arbol.local.pendientes ? '' : 'disabled'} title="${attr(t('englobarTitulo', { cuantas: arbol.local.pendientes }))}">${t('englobar')}${arbol.local.pendientes ? ` · ${arbol.local.pendientes}` : ''}</button>` : '';
  const propios = cuenta
    ? `<button type="button" data-copia title="${attr(t('copiaTitulo'))}">${t('copiaDeSeguridad')}</button><button type="button" data-olvidar title="${attr(t('olvidarTitulo'))}">${t('olvidar')}</button>`
    : `<button type="button" data-reiniciar title="${attr(t('reiniciarTitulo'))}">${t('reiniciar')}</button>`;
  return `<header class="barra">${quien}${ej}${local}<button type="button" data-config title="${attr(t('configuracionTitulo'))}">${t('configuracion')}</button>${propios}<small class="guardado">${escapar(guardado)}</small></header>`;
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
  return sobreCarta ? `<div class="formulario-fondo arranque" data-cerrar>${cuerpo}</div>` : `<div class="arranque-pantalla arranque">${cuerpo}</div>`;
}

/** El diálogo de la copia de seguridad: la frase (dos veces) y «descargar»; el eje exportado es una foto. */
export function htmlCopia(c) {
  if (!c) return '';
  const motivos = c.motivos?.length ? `<ul class="motivos" role="alert">${c.motivos.map((m) => `<li>${escapar(m.mensaje ?? m)}</li>`).join('')}</ul>` : '';
  return `<div class="formulario-fondo" data-cerrar><form class="formulario copia" data-copia-form aria-label="${attr(t('copiaDeSeguridad'))}">
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
 * crear, restaurar o probar, sola si no hay eje y como diálogo si lo hay) y `copia` (el diálogo de la copia de seguridad).
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
    : `<div class="matriz">${[1, 8, 2, 6, 0, 7, 3, 9, 4].map((pv) => (pv === 0 ? htmlCentro(a.centro, a, extra) : de(pv) || `<div class="pv hueco-vacio"></div>`)).join('')}</div>`;
  return `<div class="${clase}" data-x="${a.X}" data-disposicion="${attr(a.disposicion)}" data-animaciones="${Number(a.limite) || 0}">
    ${htmlBarra(a, extra)}
    ${avisos.length ? `<p class="aviso" role="alert">${avisos.map(escapar).join(' · ')}</p>` : ''}
    ${extra.exito ? `<p class="exito" role="status">${escapar(extra.exito)}</p>` : ''}
    <div class="escena">${escena}</div>
    ${htmlRosetones(a.rosetones)}
    ${htmlAro(a.aro)}
    ${htmlFormulario(a.formulario)}
    ${extra.preferencias ? htmlConfiguracion(extra.preferencias, { motivos: extra.motivosPreferencias }) : ''}
    ${extra.arranque ? htmlArranque(extra.arranque, { cuentas: extra.cuentas, sobreCarta: true }) : ''}
    ${htmlCopia(extra.copia)}
  </div>`;
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
