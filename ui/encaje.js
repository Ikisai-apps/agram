// Encaje visible en Pointed. La lista de ocupantes de una posición enseña,
// por cada ocupante, lo que el núcleo ya calcula (src/encaje.js): su camino
// exacto de índices, su procedencia (la cadena de registros y direcciones de
// donde viene), su acuerdo (cuántas profundidades coinciden desde la 0) y su
// signo (exacto, completar, reducir o mixto), más el vector cuando no es
// exacto. Orden por defecto: por encaje (acuerdo de ruta y, en las
// profundidades que la época haga ordinales, distancia; empates por
// llegada). Un conmutador lo pasa al orden de llegada. Nada se borra: los
// dos órdenes enseñan los mismos ocupantes.

import { encaje, bql, motor, RAIZ, ARIDAD } from '../src/index.js';
import { escapar, corto, dirCorta, caminoCorto, vectorCorto } from './comun.js';

export const ORDENES = Object.freeze(['encaje', 'llegada']);
let orden = 'encaje';

export function ordenOcupantes() {
  return orden;
}

export function elegirOrden(o) {
  orden = ORDENES.includes(o) ? o : 'encaje';
  return orden;
}

/** Procedencia en corto: cada eslabón 'id:dir#camino' como id8·dir#camino, unidos por flechas. */
export function procedenciaCorta(procedencia = []) {
  return procedencia.map((p) => {
    const [ref, resto = ''] = String(p).split(':');
    const [dir, camino] = resto.split('#');
    return corto(ref) + '·' + dirCorta(dir) + (camino !== undefined ? '#' + (camino || 'raíz') : '');
  }).join(' → ');
}

/** Una línea de encaje: acuerdo, signo y, si no es exacto, el vector. */
export function lineaEncaje(o) {
  const v = vectorCorto(o.vector);
  const partes = [
    'camino ' + caminoCorto(o.camino),
    'acuerdo ' + o.acuerdo + ' de ' + ARIDAD,
    'signo ' + o.signo,
  ];
  if (v) partes.push('vector ' + v);
  if (o.empate) partes.push('empata con ' + o.empatados + ': decide la llegada');
  if (o.rota) partes.push('referencia rota');
  return partes.join(' · ');
}

/**
 * HTML de la lista de ocupantes de `indices` en el registro `foco`, con el
 * conmutador de orden. `epoca` (opcional) es la que decide qué
 * profundidades son ordinales en el orden por encaje.
 */
export function listaOcupantes(eje, foco, indices, { epoca } = {}) {
  const oc = encaje.ocupantes(eje, foco, indices, { orden, epoca });
  if (!oc.length) return '<div class="nada">sin ocupantes</div>';
  const boton = (o) => `<button type="button" class="orden-oc" data-orden-ocupantes="${o}" aria-pressed="${o === orden}">${o}</button>`;
  const cabecera = `<div class="oc-cab"><span>${oc.length} ocupantes · orden</span>${ORDENES.map(boton).join('')}</div>`;
  const filas = oc.map((o) => {
    const r = o.contenido === undefined && o.rota ? { texto: o.motivo ?? 'referencia rota' } : bql.evaluar(eje, o.evento, motor.caminoVisible(o));
    const quien = o.autor ? ' · ' + escapar(o.autor) : '';
    const ir = `data-ir="${o.evento}" ${o.tipo !== 'escrito' && o.dir !== RAIZ ? `data-dir="${o.dir}"` : ''}`;
    const titulo = o.justificacion ? ` title="${escapar(o.justificacion)}"` : '';
    return `<div class="oc-fila"${titulo}>
      <button class="chip" ${ir}><i>${escapar(o.tipo)}</i> <b>${corto(o.evento)}</b>${quien} · ${escapar(r.texto)}</button>
      <div class="oc-encaje">${escapar(lineaEncaje(o))}</div>
      <div class="oc-proc">procedencia ${escapar(procedenciaCorta(o.procedencia))}</div>
    </div>`;
  }).join('');
  return `<div class="ocupantes">${cabecera}${filas}</div>`;
}

/** El conmutador de orden: cambia y repinta. */
export function instalarEncaje({ pintar }) {
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-orden-ocupantes]');
    if (!b) return;
    elegirOrden(b.dataset.ordenOcupantes);
    pintar();
  });
}
