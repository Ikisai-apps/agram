// El coste de escribir en los ejemplos (VG 12-11, #64 b): un registro paga lo que la regla «the cost of writing» dice
// de su payload, un minuto del calendario por posición, y el libro no acepta otra tarifa. Quien escribe a mano no
// pone «un minuto» a ojo: marca la quema con `pagaElCoste(de)` y `escribirPagando` la sustituye por lo que calcula
// src/escritura.js (`quemaDelCoste`, la misma cuenta que las plantillas de transacción y escribirDesde) con el payload
// del registro. Los movimientos que se escriben con su cantidad (horas, minutos dados a una cosa) se quedan como están.

import { quemaDelCoste, escalaQueAlcanza } from '../../src/escritura.js';

/** La marca de «esta quema es la del coste de este registro»: una propiedad propia que no entra en el evento. */
export const PAGA_EL_COSTE = Symbol.for('agram.paga-el-coste');

/**
 * La quema del coste de escribir de `de`, por calcular con el payload del registro, en minutos o en la escala que se
 * diga; con 'auto', en la primera, empezando por el minuto, en la que a `de` le alcanza (escalaQueAlcanza).
 */
export const pagaElCoste = (de, escala = 'minuto') => ({ token: 'T', escala: escala === 'auto' ? 'minuto' : escala, cantidad: 1, de, a: null, [PAGA_EL_COSTE]: escala });

/** Los datos de un registro con cada quema marcada sustituida por lo que exige la regla para su payload. */
export function conCoste(eje, datos) {
  const paga = (m) => m && m[PAGA_EL_COSTE] && m.a === null; // un `{ ...pagaElCoste(x), a: 'otro' }` es un regalo de un minuto, no la quema del registro
  if (!datos.movimientos?.some(paga)) return datos;
  return {
    ...datos,
    movimientos: datos.movimientos.map((m) => (paga(m) ? (quemaDelCoste(m.de, datos.payload, m[PAGA_EL_COSTE] === 'auto' ? escalaQueAlcanza(eje, m.de, datos.payload, datos.t) : m[PAGA_EL_COSTE], { eje }) ?? { token: 'T', escala: 'minuto', cantidad: 1, de: m.de, a: null }) : m)),
  };
}

/** eje.escribir con la quema del coste calculada por el payload. */
export const escribirPagando = (eje, datos, privada, posesion) => eje.escribir(conCoste(eje, datos), privada, posesion);
