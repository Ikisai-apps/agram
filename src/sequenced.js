// Sequenced: hasta diez décuplas en hilera. La hilera sale del eje: el hilo
// del foco (pasado, hijo → padre) o lo escrito sobre el foco (hijos). Igual
// que en Pointed, sobrio y animado son renders de la misma secuencia.

import { decupla } from './pointed.js';
import { esReferencia } from './btml.js';
import { EPOCA_0 } from './epocas.js';
import { MODOS } from './modos.js';

/**
 * Secuencia de décuplas a partir de un foco.
 * sentido 'hilo': el foco y sus antecesores, el más cercano primero.
 * sentido 'hijos': los eventos escritos sobre el foco, en orden de entrada.
 */
export function secuencia(eje, id, { sentido = 'hilo', maximo = MODOS.sequenced.decuplas, epoca = EPOCA_0 } = {}) {
  if (!eje.obtener(id)) throw new Error('foco desconocido: ' + id);
  if (sentido !== 'hilo' && sentido !== 'hijos') throw new Error('sentido desconocido: ' + sentido);
  const eventos = sentido === 'hilo' ? eje.hilo(id) : eje.sobre(id);
  const total = eventos.length;
  const decuplas = eventos.slice(0, maximo).map((ev) => decupla(ev, epoca));
  return { foco: id, sentido, total, decuplas };
}

function breve(contenido) {
  if (Array.isArray(contenido)) return '[' + contenido.length + ']';
  if (esReferencia(contenido)) return '→' + contenido.ref.slice(0, 8);
  return String(contenido);
}

/** Render sobrio: una línea por décupla con solo sus posiciones desarrolladas. */
export function sobrio(seq) {
  const cab = seq.sentido + ' de ' + seq.foco.slice(0, 8) + ' · ' + seq.decuplas.length + ' de ' + seq.total;
  const lineas = seq.decuplas.map((d, i) => {
    const partes = d.terminal !== undefined
      ? [breve(d.terminal)] // un terminal no tiene posiciones
      : d.posiciones.filter((p) => p.contenido !== undefined).map((p) => p.indice + ' ' + breve(p.contenido));
    return i + ' ' + d.id.slice(0, 8) + ' ' + d.autor + ' · ' + partes.join(' · ');
  });
  return [cab, ...lineas].join('\n');
}

export const RENDERS = Object.freeze({ sobrio });

export function render(seq, nombre = 'sobrio') {
  const r = RENDERS[nombre];
  if (!r) throw new Error('render no disponible: ' + nombre);
  return r(seq);
}
