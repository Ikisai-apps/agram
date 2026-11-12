// El sello de AGRAM por la SIMULACIÓN de StateArk (servidor/sim/stateark/, copia sin cambios del paquete de Core
// StateArk: por eso este puente vive fuera de esa carpeta). src/sello.js no conoce ninguna simulación (TOK-74): recibe
// el sellador inyectado (`selloCon`) y esto se lo da. Solo en Node; en el navegador, hace falta «seal url».

import { selloCon } from '../../src/sello.js';
import { crearSellador } from './stateark/index.js';

/**
 * El sello por la simulación de StateArk. Cada llamada crea un sellador propio, con su cadena: `opciones` son las de
 * `crearSellador` ({ inicio, intervalo, reloj }). Además de la interfaz de src/sello.js, `minar()` mete lo pendiente en
 * un bloque (solo en la simulación) y `sellador` da el sellador de dentro (para guardar y restaurar la cadena).
 */
export function selloSimulado(opciones) {
  let dentro = null;
  const sim = () => (dentro ??= crearSellador(opciones));
  const sello = selloCon({
    via: 'simulado',
    sellar: async (ids) => (await sim()).sellar(ids),
    prueba: async (id) => (await sim()).prueba(id),
    verificar: async (evento, prueba) => (await sim()).verificar(evento, prueba),
    minar: async () => (await sim()).minar(),
  });
  return Object.defineProperty(sello, 'sellador', { get: sim, enumerable: false });
}
