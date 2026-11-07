// Sequenced: unas cuantas décuplas en hilera. La hilera sale del eje: el hilo
// del foco (pasado, hijo → padre) o lo escrito sobre el foco (hijos). Igual
// que en Pointed, sobrio y animado son renders de la misma secuencia.
//
// Lo leído se cuenta por lo que hay (VG, 7-11 noche, decisión 10.1): cada
// registro traído cuenta su contenido (modos.contenido), no diez. Y
// Sequenced corta duro en su máximo, 100 (decisión 10.2): los registros
// entran por llegada (el hilo, el más cercano primero; los hijos, en orden
// de entrada) mientras quepan; el primero que no cabe y los que vienen
// detrás quedan fuera, nada entra a medias, y el aviso lo dice: «Trae X de
// Y posiciones».

import { decuplaEntera } from './pointed.js';
import { esReferencia } from './btml.js';
import { EPOCA_0, epocaDe } from './epocas.js';
import { MODOS, alcanceDe, maximo as maximoDe, contenido, admitir, avisoCorte } from './modos.js';

/**
 * Registros que se pueden pedir como mucho: cada registro trae al menos una
 * posición con contenido, así que más registros que el máximo de Sequenced
 * (100) nunca caben.
 */
export const MAXIMO_REGISTROS = maximoDe('sequenced');

/**
 * Secuencia de décuplas a partir de un foco.
 * sentido 'hilo': el foco y sus antecesores, el más cercano primero.
 * sentido 'hijos': los eventos escritos sobre el foco, en orden de entrada.
 * maximo: registros que se piden (por defecto 10, como antes del 7-11); un
 * entero de 0 a MAXIMO_REGISTROS: pedir más es pedir más del máximo, y
 * lanza.
 * La época va por objeto o por nombre, como en leerDireccion.
 * `alcance` da los tres números del modo (VG, 7-11 noche): lo conseguido
 * (el contenido de los registros que entran), el mínimo (10) y el máximo
 * (100). No llegar al mínimo no es error: se dice. `total` son los
 * registros que hay en ese sentido; `corte` es null o { maximo, conseguido,
 * necesario, fuera: [ids] }, con necesario = el contenido de los registros
 * pedidos; y `avisos[0]` dice el corte.
 */
export function secuencia(eje, id, { sentido = 'hilo', maximo = MODOS.sequenced.decuplas, epoca = EPOCA_0 } = {}) {
  if (!eje.obtener(id)) throw new Error('foco desconocido: ' + id);
  if (sentido !== 'hilo' && sentido !== 'hijos') throw new Error('sentido desconocido: ' + sentido);
  if (!(Number.isInteger(maximo) && maximo >= 0 && maximo <= MAXIMO_REGISTROS)) {
    throw new Error('maximo inválido: ' + maximo + ' (un entero de 0 a ' + MAXIMO_REGISTROS + ' registros: cada uno trae al menos una posición y el máximo de Sequenced es duro; se puede pedir menos, nunca más)');
  }
  const e = epocaDe(epoca);
  const eventos = sentido === 'hilo' ? eje.hilo(id) : eje.sobre(id);
  const total = eventos.length;
  const pedidos = eventos.slice(0, maximo);
  const a = admitir(pedidos.map((ev) => contenido(ev.payload)), maximoDe('sequenced'));
  const decuplas = pedidos.slice(0, a.entran).map((ev) => decuplaEntera(ev, e));
  let corte = null;
  const avisos = [];
  if (a.cortado) {
    const fuera = pedidos.slice(a.entran).map((ev) => ev.id);
    corte = { maximo: maximoDe('sequenced'), conseguido: a.conseguido, necesario: a.necesario, fuera };
    const detalle = 'entran ' + a.entran + ' de ' + pedidos.length + ' registros por llegada y ' + (fuera.length === 1 ? 'queda fuera 1: ' : 'quedan fuera ' + fuera.length + ': ') + fuera.slice(0, 10).map((x) => x.slice(0, 8)).join(' ') + (fuera.length > 10 ? ' …' : '');
    avisos.push(avisoCorte('sequenced', a.conseguido, a.necesario, detalle));
  }
  return { foco: id, sentido, total, decuplas, alcance: alcanceDe(a.conseguido, 'sequenced'), corte, avisos };
}

function breve(contenido) {
  if (Array.isArray(contenido)) return '[' + contenido.length + ']';
  if (esReferencia(contenido)) return '→' + contenido.ref.slice(0, 8);
  return String(contenido);
}

/** Render sobrio: una línea por décupla con solo sus posiciones desarrolladas; el aviso de corte, arriba y abajo. */
export function sobrio(seq) {
  const cab = seq.sentido + ' de ' + seq.foco.slice(0, 8) + ' · ' + seq.decuplas.length + ' de ' + seq.total;
  const lineas = seq.decuplas.map((d, i) => {
    const partes = d.terminal !== undefined
      ? [breve(d.terminal)] // un terminal no tiene posiciones
      : d.posiciones.filter((p) => p.contenido !== undefined).map((p) => p.indice + ' ' + breve(p.contenido));
    return i + ' ' + d.id.slice(0, 8) + ' ' + d.autor + ' · ' + partes.join(' · ');
  });
  const avisos = (seq.avisos ?? []).map((a) => 'aviso: ' + a);
  return [cab, ...avisos, ...lineas, ...avisos].join('\n');
}

export const RENDERS = Object.freeze({ sobrio });

export function render(seq, nombre = 'sobrio') {
  const r = RENDERS[nombre];
  if (!r) throw new Error('render no disponible: ' + nombre);
  return r(seq);
}
