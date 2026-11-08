// Consola: la compra, el menú y la reserva leídos (src/lectura.js), una
// línea por posición y dos espacios por nivel, con los ocupantes escritos en
// cada posición. Datos inventados. `node ejemplos/ikisai/leer.mjs`; también
// lo imprime `node ejemplos/ikisai/correr.mjs`.

import { pathToFileURL } from 'node:url';
import { leerEvento } from '../../src/lectura.js';
import { ejemploCompra, ejemploCuenta } from './compra-food.mjs';
import { ejemploReserva } from './reserva-booking.mjs';

/** Las tres lecturas, separadas por una línea en blanco. */
export async function leidos() {
  const { eje, alta, menu, compra } = await ejemploCompra();
  const cuenta = await ejemploCuenta(eje, compra);
  const nombres = { [eje.genesisId]: 'génesis', [alta.id]: 'alta', [menu.id]: 'menú', [compra.id]: 'compra', [cuenta.id]: 'cuenta' };
  const r = await ejemploReserva();
  const nombresReserva = { [r.eje.genesisId]: 'génesis', [r.alojamiento.id]: 'alojamiento', [r.habitacion.id]: 'habitación', [r.reserva.id]: 'reserva' };
  return [
    leerEvento(eje, compra.id, { nombres }),
    leerEvento(eje, menu.id, { nombres }),
    leerEvento(r.eje, r.reserva.id, { nombres: nombresReserva }),
  ].join('\n\n');
}

// Solo si se ejecuta este archivo (correr.mjs lo importa y lo imprime él).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(await leidos());
}
