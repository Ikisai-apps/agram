// Una carta de texto (encargo 3c-1): pinta un registro X con un tamaño, SIN LÓGICA PROPIA. Solo importa el contrato
// (src/contrato.js); todo lo que decide algo (qué puntos de vista caben, cómo se llama cada posición, en qué orden van
// los ocupantes, qué nivel tiene el registro, qué representación cabe) lo pide al núcleo. Es la prueba de que la
// mitad de datos del contrato basta para pintar: test/contrato.test.js comprueba sus imports y sus salidas.

import { tamanos, representaciones, division, etiqueta, ocupantes, madurez, diario, paso } from '../src/contrato.js';

const corto = (id) => String(id).slice(0, 8);

/** Un ocupante en una línea: una hoja, su texto; una referencia, → id corto[:posición]; una décupla, sus posiciones entre corchetes. */
function textoDe(o) {
  if (o === null || o === undefined) return '∅';
  if (typeof o === 'object' && !Array.isArray(o)) return '→ ' + corto(o.ref) + (o.dir && o.dir !== '0000000000' ? ':' + o.dir.replace(/0+$/, '').split('').join('.') : '');
  if (Array.isArray(o)) return '[' + o.map(textoDe).join(', ') + ']';
  return String(o);
}

/** La forma del hueco que la carta tiene para cada tamaño: solo geometría (ancho y alto); el núcleo decide lista o matriz. */
const HUECO = { 1: { ancho: 6, alto: 1 }, 2: { ancho: 3, alto: 4 }, 3: { ancho: 4, alto: 3 } };

/**
 * Pinta X en el tamaño pedido (1 el hueco mínimo, 2 la tarjeta, 3 la pantalla), como texto. Devuelve las líneas unidas.
 * `opciones` se pasa tal cual al contrato (la época que se lee).
 */
export function pintar(eje, X, tamano, opciones = {}) {
  const medida = tamanos(opciones).find((t) => t.tamano === tamano);
  if (!medida) throw new Error('tamaño desconocido: ' + tamano);
  const lineas = [];
  // La representación que cabe: la primera cuyo tamaño mínimo no pasa del hueco.
  const rep = representaciones(eje, X, opciones).find((r) => r.tamano <= tamano);
  const cabecera = rep ? (rep.texto ?? textoDe(rep.recurso)) + (rep.formato !== representaciones(eje, X, opciones)[0]?.formato || rep.recurso ? ' (' + rep.formato + ')' : '') : '(sin representación)';
  const { pvs, disposicion } = division(eje, X, { datos: medida.datos, forma: HUECO[tamano], ...opciones });
  lineas.push('[' + medida.nombre + ' · ' + disposicion + '] ' + cabecera);
  if (medida.datos === 1) return lineas.join('\n');
  const nivel = madurez(eje, X, opciones);
  if (nivel && nivel.nombre) lineas.push('  nivel ' + nivel.nivel + '/' + nivel.de + ' · ' + nivel.nombre + ' (' + nivel.medida.posiciones + ' posiciones, ' + nivel.medida.profundidad + ' de profundidad, ' + nivel.medida.cantidad + ' unidades)');
  for (const pv of pvs) {
    const { total, ocupantes: lista, orden } = ocupantes(eje, X, pv, 0, paso(opciones), opciones);
    const cuerpo = lista.length ? lista.map(textoDe).join(' · ') + (total > lista.length ? ' · … ' + total + ' en total' : '') : '∅';
    lineas.push('  ' + pv + ' · ' + etiqueta(eje, X, pv, opciones) + (total > 1 ? ' (' + orden + ')' : '') + ': ' + cuerpo);
  }
  if (tamano >= 3) {
    const d = diario(eje, X, 0, paso(opciones), opciones);
    lineas.push('  diario · ' + d.total + ' transacciones');
    for (const e of d.entradas) lineas.push('    ' + e.t + ' · ' + e.autor + ' · ' + corto(e.id) + ' · ' + e.movimientos.map((m) => m.primitiva + ' ' + m.cantidad + ' ' + (m.serie.startsWith('P:') ? 'P:' + corto(m.serie.slice(2)) + m.serie.slice(m.serie.indexOf('/')) : m.serie)).join(', '));
  }
  return lineas.join('\n');
}
