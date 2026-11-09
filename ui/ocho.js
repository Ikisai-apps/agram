// La celda 8 de Mapped en sobrio (VG, 8-11: «bien a ambos»). Lee el 8 con
// mapped.ocho, la misma función que el cielo animado (mundos/cielo.js), y
// solo al pintarse: la medida del foco se pide aquí, no en mapa().
//
// - Cohorte: «hermanos» por defecto, y un toque pasa a «proyecto» o a «todo
//   el eje» (general): tres botones con aria-pressed. La elegida se recuerda
//   en este navegador solo como comodidad (si no hay almacenamiento, vuelve
//   a «hermanos» y no pasa nada).
// - Primero lo que decide las cajas: por serie (T por escala, E por emisor y
//   denominación, P por ámbito, R por emisor), la cantidad del foco, su caja
//   en la cohorte y su cuota frente al padre.
// - Después, en una línea más discreta y marcada como información, los
//   recuentos del foco (hilo, escritos, movimientos, posiciones,
//   identidades): no deciden cajas ni criterios.
// - Sin base escrita, lo dice: «sin base escrita (respaldo al vuelo)».
// El texto envuelve sus líneas: sin scroll horizontal a 400 px. Sin DOM salvo
// instalarOcho; lo demás devuelve texto y se prueba en Node.

import { ocho, recuentosDeCelda, COHORTES, textoCuota, cuotaDe } from '../src/mapped.js';
import { escapar, leerLocal, guardarLocal } from './comun.js';

/** Dónde se recuerda la cohorte de la celda 8 en este navegador. */
export const CLAVE_COHORTE = 'agram.ocho.cohorte';

/** Las tres cohortes de la celda 8, en el orden de mapped.COHORTES, con su nombre en el botón y cómo se dice dónde se lee. */
export const COHORTES_VISTA = Object.freeze([
  Object.freeze({ alcance: 'hermanos', nombre: 'hermanos', donde: 'entre hermanos', pista: 'el foco frente a lo escrito sobre su mismo padre: se lee del 8 del padre' }),
  Object.freeze({ alcance: 'proyecto', nombre: 'proyecto', donde: 'en el proyecto', pista: 'el foco frente a todo lo que cuelga de su proyecto: se lee del 8 del proyecto' }),
  Object.freeze({ alcance: 'general', nombre: 'todo el eje', donde: 'en todo el eje', pista: 'el foco frente a todos los registros del eje: se lee del 8 del génesis' }),
]);

const valida = (c) => (COHORTES.includes(c) ? c : 'hermanos');
let cohorte = valida(leerLocal(CLAVE_COHORTE));

/** La cohorte que enseña la celda 8 ahora. */
export function cohorteOcho() {
  return cohorte;
}

/** Elige la cohorte de la celda 8 (una que no existe vuelve a «hermanos») y la recuerda, como comodidad. */
export function elegirCohorteOcho(c) {
  cohorte = valida(c);
  guardarLocal(CLAVE_COHORTE, cohorte);
  return cohorte;
}

// Una serie en corto para la celda: el ámbito de un P (un id) en ocho caracteres; lo demás
// (T, E, R y el T consumido sobre el registro, «tiempo:<escala>»), tal cual.
function serieCorta(clave) {
  const p = /^P:([0-9a-f]{64})(\/.*)?$/.exec(clave);
  return p ? 'P:' + p[1].slice(0, 8) + (p[2] ?? '') : clave;
}

/** De dónde lee la celda: la base escrita (con su frescura) o el respaldo al vuelo, dicho. */
export function lecturaOcho(o) {
  if (o.estado !== 'RESUELTO') return o.motivo;
  if (!o.escrita) return 'sin base escrita (respaldo al vuelo)';
  return 'base ' + o.base.slice(0, 8) + (o.frescura.sinNovedades ? ' · sin novedades' : ' · con novedades');
}

/**
 * El HTML de dentro de la celda 8 (sin el marco de la celda): los botones de
 * cohorte, de dónde se lee, las cantidades por serie con su caja y su cuota
 * frente al padre, y los recuentos como información. Llama a mapped.ocho:
 * es aquí, al pintar la celda, donde se mide el foco. Si algo falla, lo dice.
 */
export function htmlOcho(eje, foco, { alcance = cohorte, epoca } = {}) {
  const botones = COHORTES_VISTA.map((c) => `<button type="button" data-ocho-cohorte="${c.alcance}" aria-pressed="${c.alcance === alcance}" title="${escapar(c.pista)}">${escapar(c.nombre)}</button>`).join('');
  const selector = `<div class="ocho-cohortes" role="group" aria-label="cohorte de la celda 8">${botones}</div>`;
  let o;
  try {
    o = ocho(eje, foco, { alcance, epoca });
  } catch (err) {
    return selector + `<div class="aviso">No se puede leer el 8: ${escapar(err.message ?? err)}</div>`;
  }
  const { donde: dondeSe } = COHORTES_VISTA.find((c) => c.alcance === alcance);
  const donde = `<div class="ocho-donde">${escapar(dondeSe)} · <b>${escapar(lecturaOcho(o))}</b>${o.estado === 'RESUELTO' ? ' · n ' + o.n : ''}</div>`;
  if (o.estado !== 'RESUELTO') return selector + donde;
  const filas = o.cantidades.length
    ? o.cantidades.map((x) => `<li><span class="serie" title="${escapar(x.etiqueta)}">${escapar(serieCorta(x.clave))}</span> <b>${x.foco}</b> · caja ${x.caja} · <span class="cuota">cuota ${escapar(textoCuota(cuotaDe(o, x.clave)))}</span>${alcance === 'hermanos' ? '' : ` · <span class="cuota">${escapar(textoCuota(x.cuota))} ${escapar(dondeSe)}</span>`}</li>`).join('')
    : '<li class="nada">ninguna serie movida en la cohorte</li>';
  const sinMedir = o.cuota && !o.cuota.incluido ? ' (la base del padre aún no mide al foco)' : '';
  const cantidades = `<ul class="ocho-cantidades" aria-label="cantidades por serie: lo que decide las cajas">${filas}</ul>`
    + `<div class="ocho-donde">${o.cuota ? 'cuota: la del foco frente a su padre, ' + escapar(o.cuota.padre.slice(0, 8)) + escapar(sinMedir) : 'sin padre: sin cuota'}</div>`;
  const recuentos = `<div class="ocho-recuentos" title="información: los recuentos no deciden cajas ni criterios"><span class="marca">información</span> ${recuentosDeCelda(o).map((r) => escapar(r.etiqueta) + ' ' + r.valor).join(' · ')}</div>`;
  return selector + donde + cantidades + recuentos;
}

let instalada = false;

/** Engancha los botones de cohorte de la celda 8, una sola vez: eligen y repintan. */
export function instalarOcho({ pintar }) {
  if (instalada) return;
  instalada = true;
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest?.('[data-ocho-cohorte]');
    if (!b) return;
    elegirCohorteOcho(b.dataset.ochoCohorte);
    pintar();
  });
}

// Comprobación: las cohortes de la vista son las de mapped.COHORTES, en su orden.
if (COHORTES_VISTA.map((c) => c.alcance).join() !== COHORTES.join()) throw new Error('ui/ocho.js: las cohortes de la vista no son las de src/mapped.js');
