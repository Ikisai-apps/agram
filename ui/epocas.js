// Selector de época. La época está fuera del dato: el mismo eje se lee desde
// cualquier época, y la regla corta de cada una nombra cada dígito en cada
// profundidad. Aquí se elige con qué época se nombran las posiciones en los
// tres modos. Las épocas disponibles son las que exporte src/epocas.js
// (EPOCAS): hoy solo la época 0, con las cien reglas cortas (profundidad 0 =
// los diez PV; en toda profundidad n ≥ 1, el PV aplicado al nodo de arriba);
// las épocas futuras traerán reglas largas. Se importa el espacio de nombres
// entero para no romper si EPOCAS faltara.
//
// Con qué profundidad se nombra cada cosa en la pantalla:
// - la décupla del foco, la posición «en» y los pasos del 9: la profundidad
//   real de cada dígito (el camino);
// - las celdas de la décupla de Mapped y de la consolidación: la del foco
//   (el camino), porque cada celda refleja la posición [camino, i] del foco
//   (se hereda de ahí, y ahí apunta el destino del vector);
// - la hilera de Sequenced: la profundidad 0 del registro nuevo;
// - al bajar dentro de una posición, los índices de un array NO llevan regla
//   corta: son la lista de la posición, sus ocupantes por llegada, fuera del
//   árbol («ocupante k»; VG, 7-11 noche). La regla corta sigue en las
//   subposiciones escritas por dirección (la posición «en», los huecos de
//   Clasificar).
// [X] decidir VG: si lo que se escribe se nombra siempre desde la
// profundidad 0 del registro nuevo (como se leerá después) o desde la del foco.

import * as nucleo from '../src/index.js';
import { escapar, leerLocal, guardarLocal, franjaAjustes } from './comun.js';

const CLAVE = 'agram.epoca';

/** Épocas que hay en el núcleo, en orden: [EPOCA_0, …]. */
export function epocasDisponibles(n = nucleo) {
  const lista = n.EPOCAS ? Object.values(n.EPOCAS) : [];
  const validas = lista.filter((e) => e && typeof e.reglaCorta === 'function');
  if (!validas.includes(n.EPOCA_0)) validas.unshift(n.EPOCA_0);
  return validas;
}

let actual = nucleo.EPOCA_0;

/** La época con la que se nombran ahora las posiciones. */
export function epocaActual() {
  return actual;
}

/** Elige una época por nombre; si no existe, se queda la época 0. Devuelve la elegida. */
export function elegirEpoca(nombre) {
  actual = epocasDisponibles().find((e) => e.nombre === nombre) ?? nucleo.EPOCA_0;
  guardarLocal(CLAVE, actual.nombre);
  return actual;
}

/**
 * Nombre de un dígito en una profundidad bajo la época elegida. Si la época
 * no nombra ese dígito ahí, se lee con la época 0 (el respaldo).
 */
export function nombrePV(digito, profundidad = 0) {
  return actual.reglaCorta(profundidad, digito) ?? nucleo.PV[digito];
}

/** Los diez nombres de una profundidad, del 0 al 9. */
export function nombresPV(profundidad = 0) {
  return nucleo.PV.map((_, d) => nombrePV(d, profundidad));
}

/** Lee una dirección con la época elegida (la del núcleo lee por defecto con la época 0). */
export function leerDireccion(dir, epoca = actual) {
  return nucleo.leerDireccion(dir, epoca);
}

function selector() {
  const lista = epocasDisponibles();
  const solo = lista.length < 2;
  const opciones = lista.map((e) => `<option value="${escapar(e.nombre)}" ${e === actual ? 'selected' : ''}>${escapar(e.nombre)}${e.estado && e.estado !== 'decidida' ? ' · ' + escapar(e.estado) : ''}</option>`).join('');
  const titulo = solo ? 'solo hay época 0 en este núcleo; las épocas futuras pulirán sus reglas con reglas largas' : 'la época nombra las posiciones; el dato no cambia';
  return `<label class="ajuste" title="${escapar(titulo)}">época <select name="epoca" ${solo ? 'disabled' : ''}>${opciones}</select></label>`;
}

/** Pone el selector en la franja de ajustes y repinta al cambiar de época. */
export function instalarEpocas({ pintar }) {
  const guardada = leerLocal(CLAVE);
  if (guardada) actual = epocasDisponibles().find((e) => e.nombre === guardada) ?? nucleo.EPOCA_0;
  const caja = document.createElement('span');
  caja.className = 'ajuste-epoca';
  caja.innerHTML = selector();
  franjaAjustes().append(caja);
  document.addEventListener('change', (e) => {
    if (e.target.name !== 'epoca' || !e.target.closest('.ajustes')) return;
    elegirEpoca(e.target.value);
    pintar();
  });
}

/** Tras cada pintado: la leyenda de los diez nombres de la raíz, con la época elegida. */
export function trasPintarEpocas() {
  const pv = document.querySelector('#pv');
  if (pv) pv.textContent = actual.nombre + ' · ' + nombresPV(0).map((n, i) => i + ' ' + n).join(' · ');
}
