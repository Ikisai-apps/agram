// El pintado de la carta: convierte el árbol de carta/carta.js en HTML. Aquí no se decide nada: cada nodo trae ya
// su etiqueta, su tamaño, su representación, sus ocupantes, su pieza. Solo se escribe el marcado con los atributos
// data-* que carta/gestos.js lee. Sobrio por defecto: formas y texto; en animado, las piezas con recurso van como
// <img> (svg, imagen) o como un contenedor Lottie que trasPintar() rellena con lottie-web si está cargado.

import { NIVEL, LATERALES } from './carta.js';

export const escapar = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const corto = (id) => String(id ?? '').slice(0, 8);
const attr = (s) => escapar(s).replace(/'/g, '&#39;');

/** La pieza de un modelo como HTML: en sobrio una forma (una clase), en animado un <img> o un hueco Lottie fijado en su fotograma. */
export function htmlPieza(pieza, { paso, animar = false, alt = '' } = {}) {
  if (!pieza) return '';
  if (pieza.recurso && pieza.formato) {
    const fotogramas = pieza.fotogramas ?? 0;
    const k = paso && typeof paso.k === 'number' && paso.de ? Math.min(paso.k, paso.de) : 0;
    const de = paso && paso.de ? paso.de : 10;
    const fotograma = fotogramas ? Math.round((k * fotogramas) / de) : 0;
    if (pieza.animado || pieza.bucle) {
      return `<div class="pieza pieza-lottie" data-lottie="${attr(pieza.recurso)}" data-fotograma="${fotograma}" data-animar="${animar ? 1 : 0}" data-bucle="${attr(pieza.bucle ?? '')}" role="img" aria-label="${attr(alt || pieza.tipo)}"></div>`;
    }
    return `<img class="pieza pieza-imagen" src="./${attr(pieza.recurso)}" alt="${attr(alt || pieza.tipo)}" loading="lazy" decoding="async">`;
  }
  return `<span class="pieza forma forma-${attr(pieza.forma ?? 'texto')}" aria-hidden="true"></span>`;
}

/** Una representación del 0 como HTML: texto, o la imagen que cabe (solo llega con recurso en animado). */
function htmlRepresentacion(rep, { clase = 'rep' } = {}) {
  if (!rep) return `<span class="${clase} rep-vacia">—</span>`;
  if (rep.recurso && typeof rep.recurso === 'string') return `<img class="${clase} rep-imagen" src="./${attr(rep.recurso)}" alt="${attr(rep.texto ?? '')}" loading="lazy">`;
  return `<span class="${clase}">${escapar(rep.texto ?? '—')}</span>`;
}

/** Un ocupante: una hoja, su texto; una referencia, un botón que entra en el registro; una décupla, sus hojas. */
function htmlOcupante(o, { tamano } = {}) {
  if (o.tipo === 'referencia' && o.X) {
    const rep = o.representacion?.recurso ? htmlRepresentacion(o.representacion, { clase: 'rep-mini' }) : '';
    return `<button type="button" class="ocupante ocupante-ref" data-abrir="${o.X}" data-x="${o.X}" title="entrar en ${attr(o.texto)}">${rep}<span class="texto">${escapar(o.texto)}</span>${o.autor ? `<small class="quien">${escapar(o.autor)}</small>` : ''}</button>`;
  }
  if (o.tipo === 'decupla') return `<span class="ocupante ocupante-decupla">${o.hojas.map((h) => `<span class="hoja">${escapar(h)}</span>`).join('')}</span>`;
  return `<span class="ocupante ocupante-hoja">${escapar(o.texto)}</span>`;
}

/** La lista o la matriz de ocupantes de un PV, con «cargar más» al final si hay más. */
function htmlOcupantes(oc, { pv, disposicion } = {}) {
  if (!oc) return '';
  const lista = oc.lista.length ? oc.lista.map((o) => `<li>${htmlOcupante(o)}</li>`).join('') : '<li class="nada">∅</li>';
  const mas = oc.cargarMas ? `<li class="cargar-mas"><button type="button" data-cargar-mas="${pv}">cargar más · ${oc.total - oc.lista.length} más</button></li>` : '';
  return `<ul class="ocupantes ${disposicion ? 'disposicion-' + attr(disposicion) : ''}" data-total="${oc.total}">${lista}${mas}</ul>`;
}

/** El diario (lo llegado bajo X), como lista. */
function htmlDiario(d) {
  if (!d) return '';
  const filas = d.entradas.map((e) => `<li><time datetime="${attr(e.t)}">${escapar(e.t.replace('T', ' ').replace('Z', ''))}</time> · <b>${escapar(e.autor)}</b> · <button type="button" class="enlace" data-abrir="${e.id}">${corto(e.id)}</button><small>${escapar(e.movimientos.join(', '))}</small></li>`).join('');
  return `<section class="diario"><h4>${d.total} ${d.total === 1 ? 'transacción' : 'transacciones'}</h4><ol>${filas || '<li class="nada">∅</li>'}</ol></section>`;
}

/** El camino: cada paso, mío (lanzable), de espera (marcado) o hecho; los niveles si la madurez es 0; «seguir». */
export function htmlCamino(c, { X } = {}) {
  if (!c) return '';
  const pasos = c.pasos.map((p, i) => {
    const clase = p.hecho ? 'hecho' : p.espera ? 'espera' : p.mio ? 'mio' : 'otro';
    const cuerpo = `<span class="fuente">${escapar(p.fuente)}</span> <span class="falta">${escapar(p.falta ?? '')}</span>`;
    const marca = p.hecho ? '<span class="marca">hecho</span>' : p.espera ? `<span class="marca">espera a ${escapar(p.espera)}</span>` : '';
    return p.mio
      ? `<li class="paso ${clase}"><button type="button" data-paso="${i}" data-x="${attr(p.hacer?.X ?? X ?? '')}" data-lanzar="${attr(p.hacer.plantilla)}">${escapar(p.hacer.plantilla)}</button> ${cuerpo}</li>`
      : `<li class="paso ${clase}">${cuerpo} ${marca}</li>`;
  }).join('');
  const niveles = c.niveles ? `<p class="niveles">para ubicarse: ${c.niveles.map((n) => `<span>${escapar(n)}</span>`).join(' → ')}</p>` : '';
  const seguir = c.pasos.some((p) => p.mio && !p.hacer?.lectura) ? `<button type="button" class="seguir" data-seguir>seguir</button>` : '';
  return `<section class="camino" aria-label="camino">${niveles}<ol>${pasos || '<li class="nada">nada que hacer aquí</li>'}</ol>${seguir}</section>`;
}

/** Un PV lateral en su nivel: comprimido (un dato), tarjeta (etiqueta y lo que cabe), bloque (la lista o la matriz). */
function htmlLateral(n, arbol) {
  const clases = ['pv', `pv-${n.pv}`, `grupo-${n.grupo}`, `lado-${n.lado ?? ''}`, `fila-${n.fila ?? ''}`, `nivel-${n.nivel}`].join(' ');
  if (n.nivel === NIVEL.oculto) return `<div class="${clases}" data-pv="${n.pv}" data-x="${n.X}" hidden></div>`;
  const animar = Boolean(arbol.animado && arbol.estadoAnimacion?.nuevos?.has?.(n.X));
  const pieza = htmlPieza(n.pieza, { paso: n.paso, animar, alt: n.etiqueta });
  const dato = `<span class="dato" title="${attr(n.comprimido.que ?? '')}">${escapar(n.comprimido.dato)}${n.comprimido.de ? `<small>/${escapar(n.comprimido.de)}</small>` : ''}</span>`;
  const cabeza = `<header class="pv-cabeza"><span class="numero">${n.pv}</span><span class="etiqueta">${escapar(n.etiqueta)}</span>${dato}</header>`;
  let cuerpo = '';
  if (n.nivel === NIVEL.comprimido) cuerpo = `<div class="comprimido" title="${attr(n.etiqueta)}: ${attr(n.ayuda ?? '')}"><span class="numero">${n.pv}</span>${pieza || dato}${pieza ? dato : ''}</div>`;
  else {
    const camino = n.grupo === 'cruz' && n.fila === 'abajo' ? htmlCamino(arbol.camino, { X: n.X }) : '';
    cuerpo = cabeza + pieza + htmlOcupantes(n.ocupantes, { pv: n.pv, disposicion: n.disposicion }) + (n.nivel >= NIVEL.bloque ? htmlDiario(n.diario) : '') + camino
      + (n.munequito ? htmlPieza(n.munequito, { paso: n.paso, animar: arbol.animado }) : '')
      + `<footer class="pv-pie"><button type="button" class="entrar" data-foco-pv="${n.pv}" data-x="${n.X}">entrar</button><small class="ayuda">${escapar(n.ayuda ?? '')}</small></footer>`;
  }
  return `<section class="${clases}" data-pv="${n.pv}" data-x="${n.X}" data-nivel="${n.nivel}" aria-label="${attr(n.etiqueta)}" tabindex="0">${cuerpo}</section>`;
}

/** Los campos del anverso: cada PV lateral con su etiqueta y un input (editar escribe un ocupante nuevo, nunca en sitio). */
function htmlCampos(campos, X) {
  return `<dl class="campos">${campos.map((c) => `<div class="campo campo-${c.pv}"><dt><label for="campo-${c.pv}" title="${attr(c.ayuda ?? '')}">${escapar(c.etiqueta)}${c.total > 1 ? ` <small>· ${c.total}</small>` : ''}</label></dt><dd><input id="campo-${c.pv}" class="campo-input" data-campo="${c.pv}" data-x="${X}" value="${attr(c.valor)}" placeholder="${attr((c.marcador ?? []).join(' · '))}" title="${attr(c.ayuda ?? '')}" autocomplete="off"></dd></div>`).join('')}</dl>`;
}

/** El centro: el anverso (0), el reverso (5) o un PV abierto como foco. */
function htmlCentro(c, arbol, { leidoTexto } = {}) {
  const voltear = `<button type="button" class="voltear" data-voltear aria-label="dar la vuelta (${c.cara === 'anverso' ? 'ver cómo encaja' : 'ver la representación'})" title="dar la vuelta">⟲</button>`;
  const leido = `<div class="leido"><button type="button" class="leido-boton" data-leido aria-pressed="${c.leido}" title="${c.leido ? 'ocultar' : 'ver'} el registro como texto, una línea por posición">leído</button>${c.leido && leidoTexto !== undefined ? `<pre class="leido-texto" tabindex="0">${escapar(leidoTexto)}</pre>` : ''}</div>`;
  const madurez = c.madurez?.nombre ? `<span class="madurez" title="madurez: nivel ${c.madurez.nivel} de ${c.madurez.de}">${escapar(c.madurez.nombre)} <small>${c.madurez.nivel}/${c.madurez.de}</small></span>` : '';
  const quien = `<span class="quien">${escapar(c.autor ?? '')}</span>`;
  if (c.cara === 'anverso') {
    return `<section class="nucleo anverso tamano-${c.tamano?.tamano ?? 1}" data-centro="${c.pv}" data-x="${c.X}" aria-label="${attr(c.etiqueta)}">
      <header class="nucleo-cabeza"><span class="etiqueta">${escapar(c.etiqueta)}</span>${madurez}${quien}${voltear}</header>
      <h1 class="representacion">${htmlRepresentacion(c.representacion)}</h1>
      <label class="campo campo-0"><span class="etiqueta-0">${escapar(c.etiqueta)}</span><input class="campo-input" data-campo="${c.pv}" data-x="${c.X}" value="" placeholder="${attr(c.representacion?.texto ?? '')}" title="${attr(c.ayuda ?? '')}" autocomplete="off"></label>
      ${htmlCampos(c.campos, c.X)}
      ${leido}
    </section>`;
  }
  if (c.cara === 'reverso') {
    const ancla = c.ancla ? `<p class="ancla">sobre <button type="button" class="enlace" data-abrir="${attr(c.ancla.sobre ?? '')}" ${c.ancla.sobre ? '' : 'disabled'}>${escapar(c.ancla.sobreTexto ?? 'la raíz')}</button>${c.ancla.en ? ` · en ${escapar(c.ancla.en)}` : ''}</p>` : '';
    const pasos = c.pasos ? `<ul class="pasos">${Object.values(c.pasos.porPv).concat(c.pasos.comun ? [c.pasos.comun] : []).map((p) => `<li><b>${escapar(p.nombre)}</b> ${p.k === null ? '—' : escapar(p.k)}${p.de ? `<small>/${escapar(p.de)}</small>` : ''}</li>`).join('')}</ul>` : '';
    const validacion = c.validacion?.length ? `<ul class="motivos">${c.validacion.map((v) => `<li>${escapar(v.motivo)}</li>`).join('')}</ul>` : '';
    return `<section class="nucleo reverso tamano-${c.tamano?.tamano ?? 1}" data-centro="${c.pv}" data-x="${c.X}" aria-label="${attr(c.etiqueta)}">
      <header class="nucleo-cabeza"><span class="etiqueta">${escapar(c.etiqueta)}</span>${madurez}${quien}${voltear}</header>
      <p class="tipo">${c.plantilla ? `plantilla <b>${escapar(c.plantilla)}</b>` : 'sin plantilla'}${c.t ? ` · <time>${escapar(c.t)}</time>` : ''}</p>
      ${ancla}
      ${htmlOcupantes(c.ocupantes, { pv: c.pv })}
      <label class="campo campo-5"><span class="etiqueta-0">${escapar(c.etiqueta)}</span><input class="campo-input" data-campo="${c.pv}" data-x="${c.X}" value="" placeholder="${attr(c.plantilla ?? '')}" title="${attr(c.ayuda ?? '')}" autocomplete="off"></label>
      ${pasos}${validacion}
    </section>`;
  }
  return `<section class="nucleo abierto tamano-${c.tamano?.tamano ?? 1}" data-centro="${c.pv}" data-x="${c.X}" aria-label="${attr(c.etiqueta)}">
    <header class="nucleo-cabeza"><span class="numero">${c.pv}</span><span class="etiqueta">${escapar(c.etiqueta)}</span>${quien}<button type="button" class="volver" data-foco-pv="0" data-x="${c.X}" title="volver al 0">0</button></header>
    ${htmlOcupantes(c.ocupantes, { pv: c.pv, disposicion: c.disposicion })}
    <p class="ayuda">${escapar(c.ayuda ?? '')}</p>
  </section>`;
}

/** Los rosetones de identidad: ocho mosaicos muy comprimidos de mi foco, en las esquinas y los lados. */
function htmlRosetones(lista) {
  if (!lista.length) return '';
  return `<nav class="rosetones" aria-label="mi foco">${lista.map((r) => `<button type="button" class="roseton grupo-${r.grupo} lado-${r.lado ?? ''} fila-${r.fila ?? ''} nivel-${r.nivel}" data-roseton="${r.pv}" data-x="${r.X}" title="${attr(r.etiqueta)} de mi alta">
    <span class="numero">${r.pv}</span><span class="dato">${escapar(r.comprimido.dato)}</span>
    ${r.nivel >= NIVEL.tarjeta && r.ocupantes ? `<span class="etiqueta">${escapar(r.etiqueta)}</span><ul>${r.ocupantes.lista.slice(0, 4).map((o) => `<li>${escapar(o.texto)}</li>`).join('') || '<li class="nada">∅</li>'}</ul>` : ''}
  </button>`).join('')}</nav>`;
}

/** El aro: ocho huecos alrededor, uno por PV lateral, con la acción por defecto; un segundo toque despliega las demás. */
function htmlAro(aro) {
  if (!aro) return '';
  const huecos = aro.huecos.map((h) => {
    const defecto = h.accion ? `<button type="button" class="accion por-defecto" data-lanzar="${attr(h.accion.nombre)}" data-x="${aro.X}" title="${attr(h.etiqueta)}: ${attr(h.accion.nombre)}">${h.icono?.recurso ? htmlPieza(h.icono, { alt: h.etiqueta }) : ''}<span>${escapar(h.accion.nombre)}</span>${h.accion.faltan.length ? `<small>[${escapar(h.accion.faltan.join(', '))}]</small>` : ''}</button>` : `<span class="accion vacia" title="${attr(h.etiqueta)}: nada que hacer">—</span>`;
    const otras = h.otras.length ? `<button type="button" class="mas" data-aro-hueco="${h.pv}" aria-expanded="${h.abierto}" title="las demás acciones de ${attr(h.etiqueta)}">+${h.otras.length}</button>` : '';
    const lista = h.abierto && h.otras.length ? `<ul class="otras">${h.otras.map((a) => `<li><button type="button" data-lanzar="${attr(a.nombre)}" data-x="${aro.X}">${escapar(a.nombre)}${a.faltan.length ? ` <small>[${escapar(a.faltan.join(', '))}]</small>` : ''}</button></li>`).join('')}</ul>` : '';
    return `<li class="hueco hueco-${h.pv} lado-${h.lado ?? ''}" data-pv="${h.pv}"><span class="numero">${h.pv}</span><span class="etiqueta">${escapar(h.etiqueta)}</span>${defecto}${otras}${lista}</li>`;
  }).join('');
  return `<div class="aro-fondo" data-cerrar><div class="aro" role="dialog" aria-label="aro de ${attr(aro.texto)}"><p class="aro-centro"><b>${escapar(aro.texto)}</b><button type="button" class="cerrar" data-cerrar aria-label="cerrar">×</button></p><ul>${huecos}</ul></div></div>`;
}

/** Un valor de parámetro como texto de input (una lista o una décupla, en JSON). */
const valorInput = (v) => (v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));

/** El formulario generado desde la plantilla de transacción: cada parámetro con su etiqueta, ayuda, tipo y validación. */
function htmlFormulario(f) {
  if (!f) return '';
  const campos = f.campos.map((c) => {
    const id = 'param-' + c.nombre.replace(/\W+/g, '-');
    const tipoInput = c.tipo === 'number' ? 'number' : c.tipo === 'instant' ? 'datetime-local' : 'text';
    const valor = valorInput(c.valor);
    return `<div class="campo ${c.falta ? 'falta' : ''}"><label for="${id}">${escapar(c.etiqueta)}${c.requerido ? ' <abbr title="requerido">*</abbr>' : ''} <small class="tipo">${escapar(c.tipo)}</small></label>
      <input id="${id}" name="${attr(c.nombre)}" type="${tipoInput}" ${tipoInput === 'number' ? 'step="any"' : ''} value="${attr(valor)}" ${c.requerido ? 'required' : ''} data-tipo="${attr(c.tipo)}" data-validacion="${attr(c.validacion ?? '')}" title="${attr(c.ayuda)}" autocomplete="off">
      <small class="ayuda">${escapar(c.ayuda)}${c.validacion ? ` <code>${escapar(c.validacion)}</code>` : ''}</small></div>`;
  }).join('');
  const motivos = f.motivos?.length ? `<ul class="motivos" role="alert">${f.motivos.map((m) => `<li>${escapar(m.mensaje)}</li>`).join('')}</ul>` : '';
  const resultado = f.resultado ? `<p class="exito" role="status">${escapar(f.resultado)}</p>` : '';
  return `<div class="formulario-fondo" data-cerrar><form class="formulario" data-formulario data-x="${f.X}" data-accion="${attr(f.accion)}" aria-label="${attr(f.accion)}">
    <header><h2>${escapar(f.accion)}</h2><button type="button" class="cerrar" data-cerrar aria-label="cerrar">×</button></header>
    ${f.ofrecida ? '' : '<p class="aviso">esta acción no se ofrece ahora sobre este registro; se puede intentar igual</p>'}
    ${campos}${motivos}${resultado}
    <footer><button type="submit">${f.lectura ? 'leer' : f.camino ? 'dar el paso' : 'lanzar'}</button></footer>
  </form></div>`;
}

/** El formulario de la configuración, generado desde la plantilla «preferences». */
function htmlConfiguracion(p, { motivos = [] } = {}) {
  if (!p) return '';
  const campos = p.campos.map((c) => `<div class="campo"><label for="pref-${c.pv}">${escapar(c.etiqueta)}</label><input id="pref-${c.pv}" name="${attr(c.etiqueta)}" type="text" value="${attr(valorInput(Array.isArray(c.valor) ? c.valor.join(' ') : c.valor))}" placeholder="${attr(c.marcador.join(' '))}" title="${attr(c.ayuda)}" autocomplete="off"><small class="ayuda">${escapar(c.ayuda)}</small></div>`).join('');
  return `<div class="formulario-fondo" data-cerrar><form class="formulario configuracion" data-configuracion aria-label="configuración">
    <header><h2>mi configuración</h2><button type="button" class="cerrar" data-cerrar aria-label="cerrar">×</button></header>
    <p class="ayuda">es un registro de mi alta (plantilla «preferences»): se escribe como cualquier otro</p>
    ${campos}${motivos.length ? `<ul class="motivos" role="alert">${motivos.map((m) => `<li>${escapar(m.mensaje ?? m)}</li>`).join('')}</ul>` : ''}
    <footer><button type="submit">guardar</button></footer>
  </form></div>`;
}

/** La barra: quién soy, el ejemplo, el tiempo de hoy, «guardar este rato», la configuración, reiniciar. */
function htmlBarra(arbol, { ejemplos = [], ejemplo = null, guardado = '' } = {}) {
  const quien = `<label class="ajuste">soy <select data-quien>${arbol.identidades.map((i) => `<option value="${attr(i.id)}" ${i.id === arbol.yo ? 'selected' : ''}>${escapar(i.id)}${i.persona ? '' : ' (cosa)'}</option>`).join('')}</select></label>`;
  const ej = ejemplos.length ? `<label class="ajuste">ejemplo <select data-ejemplo>${ejemplos.map((e) => `<option value="${attr(e.id)}" ${e.id === ejemplo ? 'selected' : ''}>${escapar(e.etiqueta)}</option>`).join('')}</select></label>` : '';
  const tiempo = arbol.tiempo ? Object.entries(arbol.tiempo).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${k}`).join(' · ') : '';
  const local = arbol.local ? `<span class="tiempo" title="T de ${attr(arbol.local.serie)} gastado hoy en este navegador (libro local), y lo gastado hoy en el eje">hoy: ${arbol.local.gastadoHoy} s${tiempo ? ' · ' + escapar(tiempo) : ''}</span><button type="button" class="englobar" data-englobar ${arbol.local.pendientes ? '' : 'disabled'} title="englobar las ${arbol.local.pendientes} interacciones de este rato en un minuto y asentarlo en el eje">guardar este rato${arbol.local.pendientes ? ` · ${arbol.local.pendientes}` : ''}</button>` : '';
  return `<header class="barra">${quien}${ej}${local}<button type="button" data-config title="sobrio o animado, paso, tamaños, modelo, idioma: un registro de mi alta">configuración</button><button type="button" data-reiniciar title="borra lo guardado en este navegador y vuelve al ejemplo">reiniciar</button><small class="guardado">${escapar(guardado)}</small></header>`;
}

/**
 * La carta entera como HTML. `extra`: lo que la carta no decide y la app sabe: `leidoTexto` (la lectura humana del 0,
 * src/lectura.js), `ejemplos` y `ejemplo` (el selector), `guardado`, `aviso`, `exito`, `preferencias` (el formulario
 * de configuración si está abierto) y `nuevos` (los ids llegados por el diario desde la última vez: los que se animan).
 */
export function html(arbol, extra = {}) {
  if (!arbol || arbol.vacio) return `<div class="carta vacia"><p class="aviso">${escapar(arbol?.avisos?.join(' · ') ?? 'sin registro')}</p></div>`;
  const a = { ...arbol, estadoAnimacion: { nuevos: new Set(extra.nuevos ?? []) } };
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
  return `<div class="${clase}" data-x="${a.X}" data-disposicion="${attr(a.disposicion)}">
    ${htmlBarra(a, extra)}
    ${avisos.length ? `<p class="aviso" role="alert">${avisos.map(escapar).join(' · ')}</p>` : ''}
    ${extra.exito ? `<p class="exito" role="status">${escapar(extra.exito)}</p>` : ''}
    <div class="escena">${escena}</div>
    ${htmlRosetones(a.rosetones)}
    ${htmlAro(a.aro)}
    ${htmlFormulario(a.formulario)}
    ${extra.preferencias ? htmlConfiguracion(extra.preferencias, { motivos: extra.motivosPreferencias }) : ''}
  </div>`;
}

/**
 * Tras pintar: los huecos Lottie se rellenan con lottie-web (si `lottie` está cargado), cada uno fijado en su
 * fotograma; solo los marcados data-animar="1" se reproducen; los que salen de pantalla se pausan
 * (IntersectionObserver). Devuelve una función que destruye lo creado (para el siguiente pintado).
 */
export function trasPintar(raiz, { lottie = globalThis.lottie } = {}) {
  const huecos = [...raiz.querySelectorAll('[data-lottie]')];
  if (!huecos.length) return () => {};
  if (!lottie) {
    for (const h of huecos) h.classList.add('sin-lottie');
    return () => {};
  }
  const vivas = [];
  let obs = null;
  const cache = new Map();
  const datos = async (ruta) => {
    if (!cache.has(ruta)) cache.set(ruta, fetch(ruta).then((r) => (r.ok ? r.json() : null)).catch(() => null));
    const d = await cache.get(ruta);
    return d ? JSON.parse(JSON.stringify(d)) : null;
  };
  if ('IntersectionObserver' in globalThis) {
    obs = new IntersectionObserver((entradas) => {
      for (const e of entradas) {
        const a = e.target.__anim;
        if (!a) continue;
        e.target.__visible = e.isIntersecting;
        if (e.isIntersecting && e.target.dataset.animar === '1') a.play();
        else if (!e.isIntersecting && !a.isPaused) a.pause();
      }
    }, { rootMargin: '50px' });
  }
  for (const h of huecos) {
    datos('./' + h.dataset.lottie).then((animationData) => {
      if (!animationData || !h.isConnected) return;
      const anim = lottie.loadAnimation({ container: h, renderer: 'svg', loop: h.dataset.bucle !== 'once', autoplay: false, animationData, rendererSettings: { preserveAspectRatio: 'xMidYMid meet' } });
      h.__anim = anim;
      vivas.push(anim);
      const f = Number(h.dataset.fotograma) || 0;
      anim.addEventListener('DOMLoaded', () => {
        anim.goToAndStop(Math.min(f, Math.max(0, anim.totalFrames - 1)), true);
        if (h.dataset.animar === '1' && h.__visible !== false) anim.play();
      });
      if (obs) obs.observe(h);
    });
  }
  return () => {
    if (obs) obs.disconnect();
    for (const a of vivas) a.destroy();
  };
}
