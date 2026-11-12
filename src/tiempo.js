// Eje temporal (PV6 y PV7). El presente es la costura: a la izquierda los
// registros, a la derecha las proyecciones. Las bandas son las siete escalas
// del tiempo; lo cercano con detalle, lo lejano comprimido.
//
// La comparabilidad (PV8) ya no se calcula aquí: la verdad del 8 es la base
// ESCRITA en el 8 del registro que resume (src/bases.js: medir, fundir,
// situar, leerBase; VG, 7-11 noche, mapa §14.2). Se retiran comparar() y su
// puntuación con pesos (posiciones + 2 × escritos + movimientos) y la medida
// simple medir() de este módulo: queda una sola medida, bases.medir. Lo del 8
// que se sigue exportando desde aquí (cohortes, confluir como respaldo
// declarado, etiquetas) es lo de src/bases.js, por compatibilidad.

import { SEGUNDOS, ESCALAS_REALES } from './tokens.js';
import { direccion, resolver } from './btml.js';
import { propuestas } from './motor.js';
import { MODOS, orden, ORDENES_DE_ESCALA } from './modos.js';

export { HITOS, ALCANCES, MEDIDAS, etiquetaClave, proyectoDe, comparables, confluir, SIN_BASE_ESCRITA } from './bases.js';

/** Banda de una distancia temporal en segundos: la escala más pequeña que la contiene. */
export function banda(deltaSegundos) {
  const d = Math.abs(deltaSegundos);
  for (const e of ESCALAS_REALES) if (d < SEGUNDOS[e]) return e;
  return 'mas';
}

const seg = (iso) => Date.parse(iso) / 1000;

/**
 * Eje temporal del foco: pasado (hilo hacia atrás y escritos ya ocurridos,
 * el más cercano primero) y futuro (escritos con fecha posterior al ahora,
 * propuestas de la fábrica sin cerrar como futuro subjetivo, y lo declarado en la
 * posición 7). Cada entrada lleva su distancia y su banda.
 */
export function ejeTemporal(eje, foco, { ahora = new Date().toISOString(), maximo = MODOS.sequenced.decuplas, camino = [] } = {}) {
  const ev = eje.obtener(foco);
  if (!ev) throw new Error('foco desconocido: ' + foco);
  const t0 = seg(ahora);
  const entrada = (e, tipo) => ({ id: e.id, autor: e.autor, t: e.t, tipo, delta: seg(e.t) - t0, banda: banda(seg(e.t) - t0) });
  const pasado = [];
  for (const h of eje.hilo(foco).slice(1)) pasado.push(entrada(h, 'registro'));
  const futuro = [];
  for (const h of eje.sobre(foco)) {
    if (seg(h.t) > t0) futuro.push(entrada(h, 'proyeccion'));
    else pasado.push(entrada(h, 'registro'));
  }
  for (const c of propuestas(eje, foco, camino)) {
    // Una propuesta de la fábrica que su plantilla de cerrado no da por cerrada (encargo 3b: los estados son lecturas).
    if (c.cerrado !== true) futuro.push({ id: c.id, autor: c.autor, t: c.t, tipo: 'consolidacion', cerrado: c.cerrado, delta: seg(c.t) - t0, banda: banda(seg(c.t) - t0) });
  }
  const declarado = resolver(ev.payload, direccion([...camino, 7]));
  if (declarado !== undefined) futuro.push({ id: foco, autor: ev.autor, t: ev.t, tipo: 'declarado', contenido: declarado, delta: 0, banda: 'segundo' });
  pasado.sort((a, b) => b.delta - a.delta); // el más cercano al presente primero (delta negativo mayor)
  futuro.sort((a, b) => a.delta - b.delta);
  const vistos = new Set();
  const unico = (l) => l.filter((x) => !vistos.has(x.id + x.tipo) && vistos.add(x.id + x.tipo));
  return { foco, ahora, pasado: unico(pasado).slice(0, maximo), futuro: unico(futuro).slice(0, maximo), totalPasado: pasado.length, totalFuturo: futuro.length };
}

// ---------- la escala que cubre lo emitido (utilidad del 4) ----------

/**
 * La escala del calendario que cubre un número de posiciones: la más pequeña
 * cuyo orden de magnitud (modos.ordenDeEscala: segundo 1-10 posiciones,
 * minuto 10-100, hora 100-1000, día 1000-10000, semana 10^4-10^5, ciclo
 * 10^5-10^6, año 10^6-10^7) alcanza el de lo emitido (modos.orden); la mayor
 * si se pasa de todas. 0 posiciones y 1-10 caen en el segundo.
 *
 * Es la utilidad con la que el 4 (quien ejecuta) propone la denominación de T
 * de un registro a partir de lo emitido (VG 12-11, #65; docs/notas/
 * DECISIONES_2026-11-12.md, tema 4). Ya no hay «incongruencia de escala»: la
 * escala no la declara el autor a ojo, la propone el 4, así que el desajuste
 * solo sería un fallo del propio 4 (cosa de una prueba, no de una marca).
 */
export function escalaQueCubre(posiciones) {
  const n = orden(posiciones);
  return ESCALAS_REALES.find((e) => ORDENES_DE_ESCALA[e] >= n) ?? ESCALAS_REALES[ESCALAS_REALES.length - 1];
}
