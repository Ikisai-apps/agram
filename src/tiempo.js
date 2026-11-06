// Eje temporal (PV6 y PV7) y comparabilidad (PV8). El presente es la costura:
// a la izquierda los registros, a la derecha las proyecciones. Las bandas
// son las siete escalas del tiempo; lo cercano con detalle, lo lejano
// comprimido. PV8 es comparabilidad relativa entre comparables accesibles
// (los hermanos del foco); las estrellas no son verdad.

import { SEGUNDOS, ESCALAS_T } from './tokens.js';
import { direccion, resolver } from './btml.js';
import { consolidaciones } from './motor.js';
import { MODOS } from './modos.js';

/** Banda de una distancia temporal en segundos: la escala más pequeña que la contiene. */
export function banda(deltaSegundos) {
  const d = Math.abs(deltaSegundos);
  for (const e of ESCALAS_T) if (d < SEGUNDOS[e]) return e;
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

/** Diez hitos heredados (índice → nivel.grado). Etiquetas provisionales; sin algoritmo que los asigne. */
export const HITOS = Object.freeze([
  { indice: 0, nivel: '0.3', nombre: 'idea' },
  { indice: 1, nivel: '1.1', nombre: 'aprendizaje' },
  { indice: 2, nivel: '2.1', nombre: 'aprendizaje avanzado' },
  { indice: 3, nivel: '3.1', nombre: 'aprendizaje profesional' },
  { indice: 4, nivel: '3.2', nombre: 'resolución profesional' },
  { indice: 5, nivel: '4.1', nombre: 'aprendizaje superior' },
  { indice: 6, nivel: '4.2', nombre: 'solución profesional avanzada' },
  { indice: 7, nivel: '5.1', nombre: 'investigación' },
  { indice: 8, nivel: '5.2', nombre: 'trabajo maestro' },
  { indice: 9, nivel: '5.3', nombre: 'resolución experimental' },
]);

/** Medida simple de un registro: posiciones desarrolladas, escritos encima, movimientos. */
export function medir(eje, id) {
  const ev = eje.obtener(id);
  const contar = (p) => (Array.isArray(p) ? p.reduce((n, h) => n + contar(h), 0) : 1);
  return { posiciones: contar(ev.payload), escritos: eje.sobre(id).length, movimientos: ev.movimientos.length };
}

/**
 * Comparabilidad relativa (PV8): el foco frente a sus comparables accesibles,
 * los registros escritos sobre el mismo padre. Devuelve la posición del foco
 * (1 = más medido) y la lista ordenada. No asigna nivel ni grado: eso queda
 * sin algoritmo, como en la herencia.
 */
export function comparar(eje, foco) {
  const ev = eje.obtener(foco);
  if (!ev) throw new Error('foco desconocido: ' + foco);
  const hermanos = ev.sobre === null ? [ev] : eje.sobre(ev.sobre);
  const lista = hermanos.map((h) => {
    const m = medir(eje, h.id);
    return { id: h.id, autor: h.autor, ...m, puntuacion: m.posiciones + 2 * m.escritos + m.movimientos };
  });
  lista.sort((a, b) => b.puntuacion - a.puntuacion);
  const posicion = lista.findIndex((x) => x.id === foco) + 1;
  return { foco, posicion, de: lista.length, comparables: lista, hitos: HITOS };
}
