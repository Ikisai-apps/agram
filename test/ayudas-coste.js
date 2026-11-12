// Ayuda de las pruebas para el coste de escribir (VG 12-11, #64 b): la condición «writing burns today's T» exige lo
// que la regla «the cost of writing» calcula para el payload (un minuto por posición), así que una prueba que escribe
// con `minuto('x')` o `gastaT('x')` no pone «un minuto» a ojo: la quema se marca con `pagaElCoste(de)` y Eje.escribir
// (solo en las pruebas que importan esto) la sustituye por lo que calcula src/escritura.js (`quemaDelCoste`) con el
// payload del registro: la misma cuenta que las plantillas y escribirDesde. Una prueba que quiere una quema fija (más
// corta, para afirmar el rechazo; más larga) la escribe con su cantidad y no se toca. Quien crea el evento a mano con
// crearEvento (sin pasar por Eje.escribir) no tiene este cálculo: lleva su cantidad.

import { Eje } from '../src/eje.js';
import { pagaElCoste, conCoste } from '../ejemplos/ikisai/coste.mjs';

export { pagaElCoste, conCoste };

const escribirOriginal = Eje.prototype.escribir;
if (!Eje.prototype.escribir.pagaElCoste) {
  const escribir = function escribir(datos, ...resto) {
    return escribirOriginal.call(this, conCoste(this, datos), ...resto);
  };
  escribir.pagaElCoste = true;
  Eje.prototype.escribir = escribir;
}
