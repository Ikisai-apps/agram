// Épocas: convención PARALELA, fuera del dato. Un dato se puede leer desde
// cualquier época. La regla corta dice qué significa cada dígito en cada
// profundidad. Época 0: cada dígito es uno de los diez puntos de vista.

import { indicesDe } from './btml.js';

export const PV = Object.freeze([
  'representación', // 0 · PV0, lente libre
  'recursos', // 1 · reino / ciudad
  'criterios', // 2 · jardín / bosque
  'comunicación', // 3 · parque acuático
  'fábrica', // 4 · producción, futuro subjetivo
  'estructura', // 5 · registro en foco, inspección
  'pasado', // 6 · hilos del pasado
  'futuro', // 7 · hilos del futuro
  'comparabilidad', // 8 · cielo
  'camino', // 9 · guía
]);

export const EPOCA_0 = Object.freeze({
  nombre: 'época 0',
  /** Regla corta: significado de un dígito en una profundidad. */
  reglaCorta(profundidad, digito) {
    return PV[digito];
  },
});

/** Lee una dirección bajo una época: una entrada por profundidad real. */
export function leerDireccion(dir, epoca = EPOCA_0) {
  return indicesDe(dir).map((digito, profundidad) => ({
    profundidad,
    digito,
    significado: epoca.reglaCorta(profundidad, digito),
  }));
}
