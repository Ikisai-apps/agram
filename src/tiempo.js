// Eje temporal (PV6 y PV7) y comparabilidad (PV8). El presente es la costura:
// a la izquierda los registros, a la derecha las proyecciones. Las bandas
// son las siete escalas del tiempo; lo cercano con detalle, lo lejano
// comprimido. PV8 es comparabilidad relativa entre comparables accesibles;
// las estrellas no son verdad. Cuando hay muchos registros, confluyen hacia
// arriba en el 8: las «bases» (distribuciones por medida y por posición)
// sobre las que el foco se sitúa sin recibir nivel ni grado.

import { SEGUNDOS, ESCALAS_T, FAMILIAS, cantidadBase } from './tokens.js';
import { direccion, resolver } from './btml.js';
import { consolidaciones } from './motor.js';
import { MODOS } from './modos.js';
import { esFormula, evaluar } from './bql.js';
import { EPOCA_0 } from './epocas.js';

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

// ---------- confluencia del 8: las bases ----------

/**
 * Alcances de comparación, anidados: los hermanos del foco (escritos sobre
 * el mismo padre) ⊂ el hilo (el foco, sus antepasados hasta el génesis y lo
 * escrito directamente sobre cada uno de ellos) ⊂ todo el eje.
 * [X] decidir VG: la cohorte de comparación sigue abierta en el mapa; estos
 * tres alcances son el mínimo para que el 8 tenga comparables reales.
 */
export const ALCANCES = Object.freeze(['hermanos', 'hilo', 'todo']);

/** Medidas que confluyen, con su etiqueta para mostrarlas. Ninguna es un nivel ni un grado. */
export const MEDIDAS = Object.freeze([
  { clave: 'posiciones', etiqueta: 'posiciones desarrolladas' },
  { clave: 'escritos', etiqueta: 'escritos encima' },
  { clave: 'movimientos', etiqueta: 'movimientos' },
  { clave: 'E', etiqueta: 'E movido (recursos)' },
  { clave: 'P', etiqueta: 'P movido (poder)' },
  { clave: 'R', etiqueta: 'R movido (reputación)' },
  { clave: 'T', etiqueta: 'T movido (segundos)' },
  { clave: 'identidades', etiqueta: 'identidades distintas' },
  { clave: 'profundidadHilo', etiqueta: 'profundidad del hilo' },
  { clave: 'formulasResueltas', etiqueta: 'fórmulas resueltas' },
  { clave: 'formulasPendientes', etiqueta: 'fórmulas pendientes' },
]);

/** Comparables accesibles del foco según el alcance, en orden de llegada al eje. El foco siempre está. */
export function comparables(eje, foco, alcance = 'hermanos') {
  const ev = eje.obtener(foco);
  if (!ev) throw new Error('foco desconocido: ' + foco);
  if (!ALCANCES.includes(alcance)) throw new Error('alcance desconocido: ' + alcance);
  const ids = new Set([foco]);
  if (alcance === 'todo') {
    for (const id of eje.orden) ids.add(id);
  } else if (alcance === 'hilo') {
    for (const h of eje.hilo(foco)) {
      ids.add(h.id);
      for (const e of eje.sobre(h.id)) ids.add(e.id);
    }
  } else if (ev.sobre !== null) {
    for (const e of eje.sobre(ev.sobre)) ids.add(e.id);
  }
  return eje.orden.filter((id) => ids.has(id)).map((id) => eje.obtener(id));
}

/**
 * Medidas de un registro para la confluencia: las de medir() más los tokens
 * movidos por familia (en su unidad de saldo: T en segundos; E, P y R sin
 * distinguir denominación), las identidades distintas que tocan sus
 * movimientos, la profundidad del hilo y las fórmulas de su payload
 * resueltas frente a las no resueltas (PENDIENTE, INCOMPATIBLE o ERROR
 * cuentan como pendientes).
 */
export function medidasDe(eje, id) {
  const ev = eje.obtener(id);
  if (!ev) throw new Error('registro desconocido: ' + id);
  const m = { ...medir(eje, id), E: 0, P: 0, R: 0, T: 0, identidades: 0, profundidadHilo: eje.hilo(id).length - 1, formulasResueltas: 0, formulasPendientes: 0 };
  const identidades = new Set();
  for (const mov of ev.movimientos) {
    if (FAMILIAS.includes(mov.token)) m[mov.token] += cantidadBase(mov);
    if (mov.de) identidades.add(mov.de);
    if (mov.a) identidades.add(mov.a);
  }
  m.identidades = identidades.size;
  const recorrer = (nodo, indices) => {
    if (Array.isArray(nodo)) {
      nodo.forEach((hijo, i) => recorrer(hijo, [...indices, i]));
      return;
    }
    if (!esFormula(nodo)) return;
    if (evaluar(eje, id, indices).estado === 'RESUELTO') m.formulasResueltas++;
    else m.formulasPendientes++;
  };
  recorrer(ev.payload, []);
  return m;
}

function mediana(valores) {
  const v = [...valores].sort((a, b) => a - b);
  const k = v.length >> 1;
  return v.length % 2 ? v[k] : (v[k - 1] + v[k]) / 2;
}

/**
 * Distribución de una medida entre los comparables (foco incluido) y dónde
 * cae el foco: cuantil entre 0 y 1 frente a los demás (proporción de los
 * otros comparables con menos, contando los empates a medias; null si el
 * foco está solo), y cuántos otros tienen menos, lo mismo o más.
 */
export function distribucion(valores, valorFoco) {
  const otros = valores.length - 1;
  let menores = 0;
  let iguales = 0;
  let mayores = 0;
  for (const v of valores) {
    if (v < valorFoco) menores++;
    else if (v > valorFoco) mayores++;
    else iguales++;
  }
  iguales--; // el propio foco no se compara consigo mismo
  return {
    foco: valorFoco,
    minimo: Math.min(...valores),
    mediana: mediana(valores),
    maximo: Math.max(...valores),
    cuantil: otros ? (menores + iguales / 2) / otros : null,
    menores,
    iguales,
    mayores,
  };
}

/**
 * Confluencia del 8: las «bases» del foco frente a sus comparables
 * accesibles. Por cada medida, su distribución y dónde cae el foco; por
 * cada posición 0–9, cuántos comparables la tienen desarrollada (propia en
 * el payload o escrita encima) y si el foco la tiene. Límite conocido: lo
 * escrito en la raíz (en = 0000000000) colisiona con la posición 0, así que
 * cuenta como escrito en ella; por eso propias y escritas van separadas.
 * No asigna nivel ni grado: los HITOS se devuelven solo como tabla.
 * Consulta sin efectos.
 */
export function confluir(eje, foco, { alcance = 'hermanos', epoca = EPOCA_0 } = {}) {
  const lista = comparables(eje, foco, alcance);
  const filas = lista.map((e) => ({ id: e.id, autor: e.autor, t: e.t, ...medidasDe(eje, e.id) }));
  const delFoco = filas.find((f) => f.id === foco);
  const medidas = {};
  for (const { clave } of MEDIDAS) medidas[clave] = distribucion(filas.map((f) => f[clave]), delFoco[clave]);
  const posiciones = [];
  for (let i = 0; i < 10; i++) {
    const dir = direccion([i]);
    const tiene = (e) => ({ propia: Array.isArray(e.payload) && e.payload[i] !== undefined, escrita: eje.sobre(e.id, dir).length > 0 });
    let propias = 0;
    let escritas = 0;
    let desarrolladas = 0;
    for (const e of lista) {
      const t = tiene(e);
      if (t.propia) propias++;
      if (t.escrita) escritas++;
      if (t.propia || t.escrita) desarrolladas++;
    }
    const f = tiene(eje.obtener(foco));
    posiciones.push({ indice: i, significado: epoca.reglaCorta(0, i), comparables: desarrolladas, propias, escritas, proporcion: desarrolladas / lista.length, foco: f.propia || f.escrita });
  }
  return { foco, alcance, n: lista.length, comparables: filas, medidas, posiciones, hitos: HITOS };
}
