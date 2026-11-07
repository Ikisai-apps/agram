// La cruz: el 5 en el centro, rodeado por los cuatro mundos de la cruz
// (hilos 6 y 7 a los lados, cielo 8 arriba, camino 9 abajo), como en la
// matriz de Mapped. Es el tetraedro B completo del orden de los mundos
// animados (mapa §12 [D]: «primero la cruz entera: hilos 6 y 7, luego cielo
// 8 y camino 9, con el 5 en el centro»).
//
// El 5 es la estructura: el registro en foco como JSON plegable, para
// inspeccionar (catálogo de efectos, mundo 5: «inspeccionar»). Cada objeto y
// cada lista es un <details>; las referencias y los ids del eje llevan a su
// registro. Sin DOM: texto HTML para el navegador y para las pruebas.

import { esReferencia } from '../src/btml.js';
import { desescapar } from '../src/bql.js';
import { verEn, nombreMundo } from '../src/efectos.js';

/** Cómo se ve el registro desde el 5, según el catálogo. */
export const INSPECCIONAR = verEn({ tipo: 'escrito' }, 5)?.nombre ?? 'inspeccionar';

function escapar(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const ID = /^[0-9a-f]{64}$/;
const LARGO = 72;

function hoja(v, existe) {
  if (v === null) return '<span class="js-nulo">null</span>';
  if (typeof v === 'number') return `<span class="js-numero">${v}</span>`;
  if (typeof v === 'boolean') return `<span class="js-bool">${v}</span>`;
  const s = String(v);
  if (ID.test(s) && existe(s)) return `<button class="js-ref" data-ir="${s}" title="ir a ${s}">"${s.slice(0, 8)}…"</button>`;
  if (s.length > LARGO) return `<span class="js-texto" title="${escapar(s)}">${escapar(JSON.stringify(s.slice(0, LARGO - 1) + '…'))}</span>`;
  return `<span class="js-texto">${escapar(JSON.stringify(s))}</span>`;
}

function nodo(clave, v, abiertos, ruta, existe) {
  const k = `<span class="js-clave">${escapar(clave)}</span>`;
  if (esReferencia(v)) {
    const texto = `{ref: "${String(v.ref).slice(0, 8)}…"${v.dir ? `, dir: "${v.dir}"` : ''}}`;
    const boton = existe(v.ref)
      ? `<button class="js-ref" data-ir="${escapar(v.ref)}"${v.dir ? ` data-dir="${escapar(v.dir)}"` : ''} title="ir a ${escapar(v.ref)}">${escapar(texto)}</button>`
      : `<span class="js-texto">${escapar(texto)}</span>`;
    return `<div class="js-hoja">${k}${boton}</div>`;
  }
  if (v && typeof v === 'object') {
    const entradas = Array.isArray(v) ? v.map((x, i) => [String(i), x]) : Object.entries(v);
    if (!entradas.length) return `<div class="js-hoja">${k}<span class="js-vacio">${Array.isArray(v) ? '[ ]' : '{ }'}</span></div>`;
    const resumen = Array.isArray(v) ? `[${v.length}]` : `{${entradas.length}}`;
    const abierto = abiertos.has(ruta) ? ' open' : '';
    return `<details class="js-nodo"${abierto}><summary>${k}<span class="js-resumen">${resumen}</span></summary>`
      + `<div class="js-hijos">${entradas.map(([c, x]) => nodo(c, x, abiertos, ruta + '.' + c, existe)).join('')}</div></details>`;
  }
  return `<div class="js-hoja">${k}${hoja(v, existe)}</div>`;
}

/**
 * El registro como estructura plegable (JSON), en el orden de sus campos:
 * id, autor, firmante, sobre, en, t, movimientos, contexto, payload, firma.
 *   abiertos: rutas que empiezan desplegadas (por defecto, el registro y su payload).
 *   existe(id): si un id del eje se puede abrir (los botones llevan data-ir).
 */
export function htmlEstructura(ev, { abiertos = ['registro', 'registro.payload'], existe = () => false } = {}) {
  const campos = ['id', 'autor', 'firmante', 'sobre', 'en', 't', 'movimientos', 'contexto', 'payload', 'firma'];
  const registro = {};
  for (const c of campos) if (ev[c] !== undefined) registro[c] = ev[c];
  return `<div class="js-arbol">${nodo('registro', registro, new Set(abiertos), 'registro', existe)}</div>`;
}

/** La lente del foco: su posición 0 en el camino (o el terminal), como texto corto; lo mismo que la celda 5 de Mapped. */
export function lenteDe(ev, camino = []) {
  let p = ev.payload;
  for (const i of camino) p = Array.isArray(p) ? p[i] : undefined;
  const c = Array.isArray(p) ? p[0] : p;
  if (c === undefined) return '—';
  if (Array.isArray(c)) return '[' + c.length + ']';
  if (esReferencia(c)) return '→' + String(c.ref).slice(0, 8);
  return desescapar(String(c));
}

/** El 5 de la cruz: la lente del foco (su representación) y su estructura plegable. */
export function htmlCentro(ev, { lente = '', existe } = {}) {
  return `<div class="centro5" data-mundo="5" data-efecto="${escapar(INSPECCIONAR)}">`
    + `<div class="lente">${escapar(lente)}</div><div class="quien">${escapar(String(ev.id).slice(0, 8))} · ${escapar(ev.autor)}</div>`
    + htmlEstructura(ev, { existe }) + '</div>';
}

/**
 * La cruz: cada parte ya pintada (HTML) en su brazo. El cielo arriba,
 * los hilos del pasado y del futuro a los lados del 5, el camino abajo.
 */
export function htmlCruz({ c8 = '', c6 = '', c5 = '', c7 = '', c9 = '' } = {}) {
  const brazo = (pv, html, extra = '') => `<div class="brazo b${pv}" data-mundo="${pv}"${extra}><div class="brazo-cab">${pv} ${escapar(nombreMundo(pv))}</div>${html}</div>`;
  return '<section class="cruz" aria-label="la cruz: hilos 6 y 7, cielo 8 y camino 9 alrededor del 5">'
    + brazo(8, c8) + brazo(6, c6) + brazo(5, c5) + brazo(7, c7) + brazo(9, c9) + '</section>';
}
