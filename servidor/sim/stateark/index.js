// stateark-sim: StateArk fingido para que AGRAM funcione hoy «como si» StateArk existiera.
// Primera pieza: el §3 del contrato (sello de tiempo en Bitcoin → X.6.8.2). SIMULADO: nada de esto
// toca Bitcoin.
//
//   import { sellar, prueba, verificar, minar } from './src/index.js';
//
// Las funciones sueltas usan un sellador por defecto, en memoria. Para varios independientes, o para
// guardar y restaurar, usa `crearSellador` y `Sellador.importar`.

import { Sellador } from './sello.js';

export { Sellador, VIA } from './sello.js';
export { Cadena, RED } from './cadena.js';
export { esId } from './hash.js';

export const SIMULADO = true;

let porDefecto = null;
async function sellador() {
  porDefecto ??= Sellador.crear();
  return porDefecto;
}

/** Un sellador nuevo con su propia cadena. Opciones: { inicio, intervalo, reloj } (ver cadena.js). */
export function crearSellador(opciones) {
  return Sellador.crear(opciones);
}

export async function sellar(ids) {
  return (await sellador()).sellar(ids);
}

export async function prueba(id) {
  return (await sellador()).prueba(id);
}

export async function verificar(evento, p) {
  return (await sellador()).verificar(evento, p);
}

/** Solo en la simulación: mete los lotes pendientes en un bloque nuevo. */
export async function minar() {
  return (await sellador()).minar();
}
