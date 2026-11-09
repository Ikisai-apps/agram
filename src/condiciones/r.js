// Condiciones de R (src/lente.js, reglasDeR; R6, VG 7-11 noche): el
// colateral al emitir y al liberar, y atender las devoluciones. Cada sección
// es una condición con su fila del inventario (docs/notas/INVENTARIO_REGLAS.md
// §2, «Reputación (R)»), en el mismo orden (VG, 9-11: la capa cero). Leen
// `ctx.r`, el contexto de las reglas de R del eje de antes del evento.

import { SECCIONES_DE_R, analizarR } from '../lente.js';

const aplica = (ev, ctx) => Boolean(ev) && typeof ev === 'object' && ev.contexto?.genesis !== true && ctx.reglas !== 2;

// El análisis del evento lo comparten las tres secciones: una vez por contexto.
const ANALISIS = new WeakMap(); // ctx.r → { ev, a }
function analisis(ev, ctx) {
  const hecho = ANALISIS.get(ctx);
  if (hecho && hecho.ev === ev) return hecho.a;
  const a = analizarR(ev, ctx);
  ANALISIS.set(ctx, { ev, a });
  return a;
}

const deSeccion = (s) => Object.freeze({
  nombre: s.nombre,
  filas: s.filas,
  familia: 'R',
  evaluar: (tx, libro, ctx) => {
    const ev = ctx.evento;
    if (!aplica(ev, ctx.r)) return null;
    return s.evaluar(ev, ctx.r, analisis(ev, ctx.r));
  },
});

/** Las condiciones de R, en el orden de reglasDeR (RR-3, RR-4, RR-5). */
export const CONDICIONES_DE_R = Object.freeze(SECCIONES_DE_R.map(deSeccion));
