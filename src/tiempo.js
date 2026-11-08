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
import { consolidaciones } from './motor.js';
import { MODOS, orden, ordenDeEscala, contarPosiciones } from './modos.js';
import { esConsumoT } from './evento.js';

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
 * consolidaciones pendientes como futuro subjetivo, y lo declarado en la
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
  for (const c of consolidaciones(eje, foco, camino)) {
    if (c.estado !== 'EJECUTADO') futuro.push({ id: c.id, autor: c.autor, t: c.t, tipo: 'consolidacion', estado: c.estado, delta: seg(c.t) - t0, banda: banda(seg(c.t) - t0) });
  }
  const declarado = resolver(ev.payload, direccion([...camino, 7]));
  if (declarado !== undefined) futuro.push({ id: foco, autor: ev.autor, t: ev.t, tipo: 'declarado', contenido: declarado, delta: 0, banda: 'segundo' });
  pasado.sort((a, b) => b.delta - a.delta); // el más cercano al presente primero (delta negativo mayor)
  futuro.sort((a, b) => a.delta - b.delta);
  const vistos = new Set();
  const unico = (l) => l.filter((x) => !vistos.has(x.id + x.tipo) && vistos.add(x.id + x.tipo));
  return { foco, ahora, pasado: unico(pasado).slice(0, maximo), futuro: unico(futuro).slice(0, maximo), totalPasado: pasado.length, totalFuturo: futuro.length };
}

// ---------- la escala de T frente al tamaño de lo emitido ----------

/**
 * Incongruencia entre la escala del T que consume un evento y el tamaño de lo
 * que emite (VG, 7-11 noche, «T, corregido por VG», punto 4: «que un T de
 * segundo sea un árbol de información más pequeño que el que se emite, y un T
 * de hora o de día un árbol más grande»). La escala declara el orden de
 * magnitud esperado (modos.ordenDeEscala: segundo 1-10 posiciones, minuto
 * 10-100, hora 100-1000, día 1000-10000, semana 10^4-10^5, ciclo 10^5-10^6,
 * año 10^6-10^7) y lo emitido se mide igual (modos.orden sobre
 * modos.contarPosiciones del payload). Si el evento consume varias escalas,
 * manda la mayor: es la que declara el árbol más grande. Devuelve null si
 * casan, si el evento no consume T de su autor o si es el génesis; si no,
 * { escala, ordenEsperado, ordenEmitido, posiciones }. Se ENSEÑA (validez,
 * capa de interpretación), nunca se rechaza: falsear T solo da incongruencias
 * ([X] decidir VG si quiere rechazo).
 */
export function incongruenciaDe(ev) {
  if (!ev || typeof ev !== 'object' || ev.contexto?.genesis === true || !Array.isArray(ev.movimientos)) return null;
  // Solo las escalas reales tienen orden: las informativas (pasado, futuro, inventado) no (VG, 8-11).
  const escalas = ev.movimientos.filter((m) => esConsumoT(m, ev.autor) && ESCALAS_REALES.includes(m.escala)).map((m) => m.escala);
  if (!escalas.length) return null;
  const escala = escalas.reduce((a, b) => (ESCALAS_REALES.indexOf(b) > ESCALAS_REALES.indexOf(a) ? b : a));
  const posiciones = contarPosiciones(ev.payload);
  const ordenEsperado = ordenDeEscala(escala);
  const ordenEmitido = orden(posiciones);
  return ordenEmitido === ordenEsperado ? null : { escala, ordenEsperado, ordenEmitido, posiciones };
}
