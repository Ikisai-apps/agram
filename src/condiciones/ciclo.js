// Condiciones del ciclo de vida de E/P/R/T (src/ciclo.js): quién emite y en
// qué orden, el T del día, el reloj, el P. Cada sección de reglasDelCiclo es
// una condición con las filas del inventario (docs/notas/INVENTARIO_REGLAS.md
// §2) que cubre; se evalúan en el mismo orden que antes, así que dicen lo
// mismo (VG, 9-11: la capa cero; las reglas, envueltas tal cual). Leen
// `ctx.ciclo`, el contexto de las reglas del ciclo del eje de antes del
// evento (eje.contexto(ev).ciclo).

import { SECCIONES_DEL_CICLO, reglasDelCicloV2, validosDe } from '../ciclo.js';

/** ¿Pasa `ev` por las reglas del ciclo? No el génesis (emite por convención: GN-1). */
const aplica = (ev) => Boolean(ev) && typeof ev === 'object' && ev.contexto?.genesis !== true;

/** Una sección de reglasDelCiclo como condición: solo con las reglas de ahora (las de la versión 2 son VA-3). */
const deSeccion = (s) => Object.freeze({
  nombre: s.nombre,
  filas: s.filas,
  familia: 'ciclo',
  evaluar: (tx, libro, ctx) => {
    const ev = ctx.evento;
    if (!aplica(ev) || ctx.ciclo.reglas === 2) return null;
    return s.evaluar(ev, ctx.ciclo, ctx.validos ?? validosDe(ev));
  },
});

/** VA-3: un evento guardado con la versión 2 se valida con las reglas de emisión de entonces. */
export const CICLO_V2 = Object.freeze({
  nombre: 'VA-3',
  filas: Object.freeze(['VA-3']),
  familia: 'ciclo',
  evaluar: (tx, libro, ctx) => reglasDelCicloV2(ctx.evento, ctx.ciclo),
});

/** Las secciones de reglasDelCiclo como condiciones, en su orden (PP-2, PP-5, ES-1: lo demás son reglas de la época). */
export const SECCIONES = Object.freeze(SECCIONES_DEL_CICLO.map(deSeccion));

/** Todas las condiciones del ciclo, en el orden de reglasDelCiclo: lo que leen el eje y las capas de validez. */
export const CONDICIONES_DEL_CICLO = Object.freeze([CICLO_V2, ...SECCIONES]);

// PP-4 (P se mueve dentro de un ámbito que existe) es la regla de la época «P moves within a known scope»
// (encargo 3a, paso 9: la condición de paso AMBITO_P se retiró; su código vive en test/condiciones-retiradas.mjs).
