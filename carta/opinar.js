// «Opinar»: el feedback clasificado para quien desarrolla la carta. Con el conmutador activo, tocar cualquier cosa de la
// pantalla no hace lo suyo sino que abre una cajita junto a ella con una línea de contexto (qué es, en qué punto de
// vista, de qué registro, en qué tamaño y modo) y un cuadro de texto; lo escrito se guarda con esa clasificación, ya
// hecha, para que nadie tenga que describir dónde estaba. Las opiniones viven solo en este navegador (localStorage
// `agram.opiniones`); nunca van al eje ni se sincronizan: se exportan a un archivo o al portapapeles para pasarlas.
//
// El módulo tiene dos mitades. La pura (sin DOM: clasificar, entornoDe, nuevaOpinion, serializar, exportar, y la
// lista en un almacén tipo localStorage) trabaja sobre «elementos» que solo necesitan `dataset`, `parentElement` y
// `textContent`, así que se prueba sin navegador (test/opinar.test.js). La del navegador (instalar) engancha el
// conmutador, la cajita y los botones de exportar. Los atributos data-nodo* los escribe carta/dom.js.

import { t } from './textos.js';

export const CLAVES = Object.freeze({ activo: 'agram.opinar', opiniones: 'agram.opiniones' });
/** Cuántos caracteres del texto visible del elemento se guardan. */
export const TEXTO_MAXIMO = 80;

const recortar = (s, n = TEXTO_MAXIMO) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const hay = (v) => v !== undefined && v !== null && v !== '';

/** El elemento y sus ancestros, del más cercano al más lejano. */
function cadena(el) {
  const c = [];
  for (let e = el; e; e = e.parentElement) c.push(e);
  return c;
}

/** El primer valor de `clave` (o de las alternativas) del dataset que haya subiendo desde `el`. */
const primero = (c, ...claves) => {
  for (const e of c) for (const k of claves) if (hay(e.dataset?.[k])) return { e, valor: e.dataset[k] };
  return null;
};

const numero = (v) => (hay(v) && Number.isFinite(Number(v)) ? Number(v) : null);

/**
 * La clasificación de un elemento, leída de él y de sus ancestros (el más cercano con data-nodo es «el nodo»).
 * → { tipo, pv, X, X0, d, tamano, representacion, texto, ruta }
 *   tipo           data-nodo del nodo más cercano ('otro' si no hay ninguno)
 *   pv             data-nodo-pv, data-pv, data-centro o data-roseton del más cercano que lo diga (0-9)
 *   X              data-x del más cercano (el registro)
 *   X0             el texto del 0 de ese registro (data-nodo-x0 en el mismo registro)
 *   d              la posición de un campo (data-nodo-d)
 *   tamano         oculto, comprimido, tarjeta, bloque o foco (data-nodo-tam del más cercano)
 *   representacion la elegida (data-nodo-rep del más cercano)
 *   texto          lo visible del nodo, recortado a 80
 *   ruta           los tipos de sus ancestros con data-nodo, del más lejano al más cercano
 * Los campos que no se saben van a null; `cara` (anverso, reverso, abierto) solo si el nodo es un foco.
 */
export function clasificar(el) {
  const c = cadena(el);
  const nodos = c.filter((e) => hay(e.dataset?.nodo));
  const nodoEl = nodos[0] ?? el;
  const desde = c.slice(Math.max(0, c.indexOf(nodoEl)));
  const x = primero(desde, 'nodoX', 'x');
  const X = x?.valor ?? null;
  // El 0 del registro: del mismo elemento que dijo X, o del más cercano que lo traiga para ese mismo X.
  const x0 = X === null ? null : desde.find((e) => hay(e.dataset?.nodoX0) && (!hay(e.dataset.nodoX ?? e.dataset.x) || (e.dataset.nodoX ?? e.dataset.x) === X));
  const pv = primero(desde, 'nodoPv', 'pv', 'centro', 'roseton');
  const d = primero([nodoEl], 'nodoD');
  const nodo = {
    tipo: nodoEl.dataset?.nodo ?? 'otro',
    pv: numero(pv?.valor),
    X,
    X0: x0?.dataset.nodoX0 ?? null,
    d: numero(d?.valor),
    tamano: primero(desde, 'nodoTam')?.valor ?? null,
    representacion: primero(desde, 'nodoRep')?.valor ?? null,
    texto: recortar(nodoEl.textContent),
    ruta: nodos.slice(1).reverse().map((e) => e.dataset.nodo),
  };
  if (nodo.tipo === 'foco' && hay(nodoEl.dataset.nodoCara)) nodo.cara = nodoEl.dataset.nodoCara;
  return nodo;
}

/** El nodo (elemento) que clasifica a `el`: el más cercano con data-nodo, o el propio `el`. */
export const nodoDe = (el) => cadena(el).find((e) => hay(e.dataset?.nodo)) ?? el;

/** Lo de la carta entera que vive en su raíz: modo (apilada o matriz), ancho y alto de la pantalla, sobrio o animado, y el foco. */
export function entornoDe(el) {
  const raiz = cadena(el).find((e) => e.dataset?.nodo === 'carta');
  const d = raiz?.dataset ?? {};
  return {
    modo: d.nodoModo ?? null,
    ancho: numero(d.nodoAncho),
    alto: numero(d.nodoAlto),
    render: d.nodoRender ?? null,
    foco: { X: d.x ?? null, X0: d.nodoX0 ?? null },
  };
}

/** La línea de contexto de la cajita: qué es, en qué punto de vista, de qué registro, tamaño y modo. */
export function legible(nodo, entorno = {}) {
  const partes = [nodo.tipo];
  if (nodo.cara) partes.push(nodo.cara);
  if (nodo.pv !== null && nodo.pv !== undefined) partes.push(t('opinarPv', { pv: nodo.pv }));
  if (nodo.d !== null && nodo.d !== undefined) partes.push(t('opinarPosicion', { d: nodo.d }));
  if (nodo.X) partes.push(`${String(nodo.X).slice(0, 8)}${nodo.X0 ? ` «${recortar(nodo.X0, 24)}»` : ''}`);
  if (nodo.tamano) partes.push(nodo.tamano);
  if (nodo.representacion && nodo.representacion !== 'ninguna') partes.push(nodo.representacion);
  if (entorno.modo) partes.push(entorno.modo === 'apilada' ? 'Sequenced' : entorno.modo === 'matriz' ? 'Mapped' : entorno.modo);
  return partes.join(' · ');
}

/**
 * Una opinión: { fecha (ISO), version, cuenta, modo, ancho, alto, render, foco: { X, X0 }, nodo, texto }.
 * `contexto`: { nodo (lo de clasificar), entorno (lo de entornoDe) o los campos sueltos, version, cuenta, ahora }.
 */
export function nuevaOpinion(contexto, texto) {
  const e = { ...(contexto.entorno ?? {}), ...Object.fromEntries(['modo', 'ancho', 'alto', 'render', 'foco'].filter((k) => k in contexto).map((k) => [k, contexto[k]])) };
  return {
    fecha: new Date(contexto.ahora ?? Date.now()).toISOString(),
    version: contexto.version ?? 'desconocida',
    cuenta: contexto.cuenta ?? 'ejemplo',
    modo: e.modo ?? null,
    ancho: e.ancho ?? null,
    alto: e.alto ?? null,
    render: e.render ?? null,
    foco: e.foco ?? { X: null, X0: null },
    nodo: contexto.nodo,
    texto: String(texto ?? '').trim(),
  };
}

/** La lista como JSON bonito. */
export const serializar = (lista) => JSON.stringify(lista, null, 2);

/** El archivo a descargar: agram-opiniones-<fecha>.json con la lista entera. */
export function exportar(lista, ahora = Date.now()) {
  const dia = new Date(ahora).toISOString().slice(0, 10);
  return { nombre: `agram-opiniones-${dia}.json`, tipo: 'application/json', contenido: serializar(lista) + '\n' };
}

/** La versión de la carta que dice un sw.js (su VERSION), o null. */
export const versionDeSw = (texto) => /\bVERSION\s*=\s*'([^']+)'/.exec(String(texto ?? ''))?.[1] ?? null;

// ---------- el almacén (localStorage o algo igual; todo en try/catch: sin almacenamiento, no se guarda) ----------

export function leerOpiniones(almacen) {
  try {
    const l = JSON.parse(almacen?.getItem(CLAVES.opiniones) ?? '[]');
    return Array.isArray(l) ? l : [];
  } catch { return []; }
}
function escribirOpiniones(almacen, lista) {
  try { almacen.setItem(CLAVES.opiniones, JSON.stringify(lista)); return true; } catch { return false; }
}
/** Añade una opinión al final; true si se pudo guardar. */
export const anadirOpinion = (almacen, opinion) => escribirOpiniones(almacen, [...leerOpiniones(almacen), opinion]);
/** Quita la última; devuelve la quitada o null. */
export function borrarUltima(almacen) {
  const l = leerOpiniones(almacen);
  const ultima = l.pop() ?? null;
  if (ultima) escribirOpiniones(almacen, l);
  return ultima;
}
export const vaciarOpiniones = (almacen) => escribirOpiniones(almacen, []);
export function leerActivo(almacen) {
  try { return almacen?.getItem(CLAVES.activo) === '1'; } catch { return false; }
}
export function guardarActivo(almacen, activo) {
  try { almacen?.setItem(CLAVES.activo, activo ? '1' : '0'); } catch { /* sin almacenamiento: no se recuerda */ }
}

// ---------- el navegador ----------

let versionCache = null;
/** La versión de lo que se está usando: la VERSION de sw.js (que sube con cada cambio de la web). */
async function versionDeLaWeb(ventana) {
  if (!versionCache) {
    versionCache = ventana.fetch('./sw.js', { cache: 'no-cache' }).then((r) => r.text()).then(versionDeSw).catch(() => null);
  }
  return (await versionCache) ?? 'desconocida';
}

/** El estado para pintar los controles de la barra (dom.js htmlOpinar): { activo, cuantas }. */
export const estadoDe = (almacen) => ({ activo: leerActivo(almacen), cuantas: leerOpiniones(almacen).length });

/**
 * Engancha «opinar» en la carta. `raiz`: el elemento de la carta; `cuenta()`: el nombre de la cuenta (o «ejemplo»);
 * `alCambiar()`: lo que hay que repintar cuando cambia el conmutador o la lista (la barra lleva el contador).
 * `alGuardar(opinion)`: opcional, async; lo que se hace además con cada opinión guardada (anclarla como registro en el
 * proyecto AGRAM, carta/externa.js). Devuelve { ok, id } o { ok: false, motivo } (o { sinAncla: true }: nada que decir);
 * la cajita lo cuenta: la opinión siempre queda en local, también si falla.
 * Con el conmutador activo, los clics, toques y gestos sobre la carta se detienen en fase de captura (no llegan a
 * carta/gestos.js) y abren la cajita. Devuelve { quitar, activo }.
 */
export function instalar({ raiz, cuenta = () => 'ejemplo', alCambiar = () => {}, alGuardar = null, almacen = globalThis.localStorage }) {
  const doc = raiz.ownerDocument;
  const ventana = doc.defaultView;
  let activo = leerActivo(almacen);
  let caja = null;
  let aviso = null;
  const marcar = () => doc.documentElement.classList.toggle('opinando', activo);
  marcar();

  const cerrar = () => {
    caja?.marcado?.classList.remove('opinar-marcado');
    caja?.el.remove();
    caja = null;
  };

  const decir = (texto) => {
    aviso?.remove();
    aviso = doc.createElement('div');
    aviso.className = 'opinar-aviso';
    aviso.setAttribute('role', 'status');
    aviso.textContent = texto;
    doc.body.append(aviso);
    const este = aviso;
    ventana.setTimeout(() => { if (aviso === este) { este.remove(); aviso = null; } }, texto.length > 90 ? 7000 : 3000);
  };

  const colocar = (el, marcado) => {
    const vw = ventana.innerWidth;
    const vh = ventana.innerHeight;
    if (vw < 600) { el.classList.add('opinar-abajo'); return; }
    const r = marcado.getBoundingClientRect();
    const ancho = Math.min(360, vw - 16);
    const alto = el.offsetHeight || 200;
    const arriba = r.bottom + 8 + alto <= vh ? r.bottom + 8 : r.top - alto - 8 >= 8 ? r.top - alto - 8 : vh - alto - 8;
    el.style.width = `${ancho}px`;
    el.style.left = `${Math.min(Math.max(8, r.left), vw - ancho - 8)}px`;
    el.style.top = `${Math.max(8, arriba)}px`;
  };

  const abrir = (tocado) => {
    cerrar();
    const marcado = nodoDe(tocado);
    const nodo = clasificar(tocado);
    const entorno = entornoDe(tocado);
    const el = doc.createElement('div');
    el.className = 'opinar-caja';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', t('opinar'));
    const linea = doc.createElement('p');
    linea.className = 'opinar-contexto';
    linea.textContent = legible(nodo, entorno);
    const texto = doc.createElement('textarea');
    texto.rows = 3;
    texto.placeholder = t('opinarPlaceholder');
    texto.setAttribute('aria-label', t('opinarPlaceholder'));
    const botones = doc.createElement('div');
    botones.className = 'opinar-botones';
    const guardar = doc.createElement('button');
    guardar.type = 'button';
    guardar.className = 'opinar-guardar';
    guardar.textContent = t('opinarGuardar');
    const cancelar = doc.createElement('button');
    cancelar.type = 'button';
    cancelar.className = 'opinar-cancelar';
    cancelar.textContent = t('opinarCancelar');
    botones.append(guardar, cancelar);
    el.append(linea, texto, botones);
    doc.body.append(el);
    marcado.classList.add('opinar-marcado');
    caja = { el, marcado, nodo, entorno };
    colocar(el, marcado);
    texto.focus({ preventScroll: true });
    cancelar.addEventListener('click', cerrar);
    const guardarYa = async () => {
      if (!texto.value.trim()) { texto.focus(); return; }
      const version = await versionDeLaWeb(ventana);
      const op = nuevaOpinion({ nodo, entorno, version, cuenta: cuenta(), ahora: Date.now() }, texto.value);
      const ok = anadirOpinion(almacen, op);
      cerrar();
      let anclada = null;
      try { anclada = alGuardar ? await alGuardar(op) : null; } catch (e) { anclada = { ok: false, motivo: String(e?.message ?? e) }; }
      const lista = ok ? t('opinarGuardada', { cuantas: leerOpiniones(almacen).length }) : t('sinAlmacenamiento');
      decir(anclada?.ok ? lista + ' · ' + t('opinarAnclada', { id: String(anclada.id).slice(0, 8) }) : anclada && !anclada.sinAncla ? lista + ' · ' + t('opinarSoloLocal', { motivo: anclada.motivo ?? '' }) : lista);
      alCambiar();
    };
    guardar.addEventListener('click', guardarYa);
    texto.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); guardarYa(); } });
  };

  const copiarTexto = async (contenido) => {
    try { await ventana.navigator.clipboard.writeText(contenido); return true; } catch { /* sin permiso: el plan B */ }
    try {
      const ta = doc.createElement('textarea');
      ta.value = contenido;
      ta.style.cssText = 'position:fixed;left:-9999px;top:0';
      doc.body.append(ta);
      ta.select();
      const ok = doc.execCommand('copy');
      ta.remove();
      return ok;
    } catch { return false; }
  };

  const descargar = ({ nombre, tipo, contenido }) => {
    const url = ventana.URL.createObjectURL(new ventana.Blob([contenido], { type: tipo }));
    const a = doc.createElement('a');
    a.href = url;
    a.download = nombre;
    doc.body.append(a);
    a.click();
    a.remove();
    ventana.setTimeout(() => ventana.URL.revokeObjectURL(url), 10000);
  };

  const control = async (que) => {
    const lista = leerOpiniones(almacen);
    if (que === 'alternar') {
      activo = !activo;
      guardarActivo(almacen, activo);
      marcar();
      cerrar();
    } else if (que === 'exportar' && lista.length) {
      const archivo = exportar(lista);
      descargar(archivo);
      decir(t('opinarExportada', { archivo: archivo.nombre }));
      if (ventana.confirm(t('opinarVaciarConfirmar', { cuantas: lista.length }))) vaciarOpiniones(almacen);
    } else if (que === 'copiar' && lista.length) {
      decir(t((await copiarTexto(serializar(lista))) ? 'opinarCopiada' : 'opinarNoCopiada', { cuantas: lista.length }));
    } else if (que === 'borrar') {
      const quitada = borrarUltima(almacen);
      if (quitada) decir(t('opinarBorrada', { texto: recortar(quitada.texto, 40) }));
    }
    alCambiar();
  };

  // En fase de captura sobre el documento: lo primero que ve cada evento. Los controles de opinar y la cajita se
  // atienden aparte; con «opinar» activo, todo lo que caiga en la carta se detiene y abre la cajita.
  const detener = (e) => { e.stopPropagation(); e.stopImmediatePropagation?.(); };
  const alEvento = (e) => {
    const objetivo = e.target;
    if (!objetivo?.closest) return;
    if (objetivo.closest('.opinar-caja')) return;
    const ctl = objetivo.closest('[data-opinar-ctl]');
    if (ctl) {
      if (e.type === 'click') { e.preventDefault(); detener(e); void control(ctl.dataset.opinarCtl); }
      return;
    }
    if (!activo || !raiz.contains(objetivo)) return;
    detener(e);
    if (e.type === 'click') { e.preventDefault(); abrir(objetivo); }
    else if (e.type === 'mousedown' || e.type === 'contextmenu' || e.type === 'dblclick') e.preventDefault();
  };
  const alTeclado = (e) => {
    if (e.key === 'Escape' && caja) { e.preventDefault(); detener(e); cerrar(); }
  };
  const tipos = ['click', 'dblclick', 'contextmenu', 'mousedown', 'pointerdown', 'pointerup', 'pointermove', 'pointercancel'];
  for (const tipo of tipos) doc.addEventListener(tipo, alEvento, true);
  doc.addEventListener('keydown', alTeclado, true);

  return {
    activo: () => activo,
    quitar() {
      for (const tipo of tipos) doc.removeEventListener(tipo, alEvento, true);
      doc.removeEventListener('keydown', alTeclado, true);
      cerrar();
      aviso?.remove();
    },
  };
}
