// El sello de AGRAM por la SIMULACIÓN de StateArk (servidor/sim/stateark/, copia sin cambios del paquete de Core
// StateArk: por eso este puente vive fuera de esa carpeta). src/sello.js no conoce ninguna simulación (TOK-74): recibe
// el sellador inyectado (`selloCon`) y esto se lo da. Solo en Node; en el navegador, hace falta «seal url».
//
// Desde el commit 8fe065f de la simulación (H9), la prueba trae la cabecera de 80 bytes, los pasos OTS y la firma del
// observador de cabeceras: con ella la regla «sealed» de la época (X.6.8.5) da VERDADERO si la cuenta raíz del eje
// declara la clave del observador (`claveObservador`) en «exterior settings».6. El observador firma aquí con BIP-340
// real (la noble de src/vendor), que es lo que comprueba `signed` del BQL mínimo; la simulación, sola, firmaría con su
// esquema simulado, que ninguna regla da por bueno.

import { selloCon } from '../../src/sello.js';
import { schnorr } from '../../src/vendor/noble-secp256k1.js';
import { crearSellador, Custodia, esquemaNoble } from './stateark/index.js';

/** Un observador de cabeceras que firma con BIP-340 real: { custodia, nombre }, para `opciones.observador`. */
export async function observadorBip340(nombre = 'observador') {
  const custodia = new Custodia({ esquema: esquemaNoble(schnorr) });
  await custodia.crearClave('nostr', nombre);
  return { custodia, nombre };
}

/**
 * El sello por la simulación de StateArk. Cada llamada crea un sellador propio, con su cadena: `opciones` son las de
 * `crearSellador` ({ inicio, intervalo, reloj, observador, observadores }); sin `observador`, uno con BIP-340 real
 * (observadorBip340). Además de la interfaz de src/sello.js, `minar()` mete lo pendiente en un bloque (solo en la
 * simulación), `sellador` da el sellador de dentro (para guardar y restaurar la cadena) y `claveObservador()` la clave
 * x-only del observador, la que la cuenta raíz declara en «exterior settings» (posición 6, «observer keys»).
 */
export function selloSimulado(opciones = {}) {
  let dentro = null;
  const sim = () => (dentro ??= (async () => crearSellador({ ...opciones, observador: opciones.observador ?? (await observadorBip340()) }))());
  const sello = selloCon({
    via: 'simulado',
    sellar: async (ids) => (await sim()).sellar(ids),
    prueba: async (id) => (await sim()).prueba(id),
    verificar: async (evento, prueba) => (await sim()).verificar(evento, prueba),
    minar: async () => (await sim()).minar(),
  });
  Object.defineProperty(sello, 'claveObservador', { value: async () => (await sim()).claveObservador, enumerable: false });
  return Object.defineProperty(sello, 'sellador', { get: sim, enumerable: false });
}
