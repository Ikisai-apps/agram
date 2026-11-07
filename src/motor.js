// Motor AGRAM, ciclo mínimo: descubrir → elegir/crear → consolidar en la
// fábrica (PV4) → autorizar → ejecutar con evidencia. Consolidar no es
// ejecutar. Todo son eventos: la consolidación, la autorización y la
// ejecución son registros anclados a la fábrica del foco, encadenados por
// referencia, de modo que la evidencia es el propio hilo.
//
// Estados de una consolidación: PENDIENTE DE AUTORIZACIÓN → AUTORIZADO → EJECUTADO.

import { direccion, esReferencia } from './btml.js';
import { ocupantes, vector, signo, caminosDe } from './encaje.js';
import { evaluar } from './bql.js';
import { escribirDesde } from './escritura.js';

export const FABRICA = '4000000000';

/** Camino que se muestra de un ocupante: su posición 0 si es un array (su representación), si no él mismo. */
export function caminoVisible(o) {
  const base = o.camino ?? [];
  return Array.isArray(o.contenido) && o.contenido[0] !== undefined ? [...base, 0] : base;
}
export const FASES = Object.freeze(['consolidado', 'autorizado', 'ejecutado']);

/**
 * Operadores del ciclo (C3-G): Q interroga (descubrir), B construye la
 * propuesta (proponer), C consolida (consolidar). El orden importa.
 */
export const OPERADORES = Object.freeze({ Q: 'descubrir', B: 'proponer', C: 'consolidar' });

/**
 * Proponer (operador B): construye las elecciones de una consolidación a
 * partir de lo que dicen las posiciones del foco. Una posición con fórmula
 * BQL propone: si resuelve a una colección, su primer candidato (el mejor
 * encaje, salvo que la fórmula ORDENE otra cosa) es la elección; si
 * resuelve a un valor, ese valor es un terminal nuevo. Una posición con
 * contenido literal propone ese contenido por referencia al foco. Las
 * posiciones sin desarrollar no proponen. No escribe nada.
 */
export function proponer(eje, foco, { camino = [], posiciones = [1, 2, 3, 4] } = {}) {
  const ev = eje.obtener(foco);
  if (!ev) throw new Error('foco desconocido: ' + foco);
  const elecciones = {};
  const origenes = [];
  const pendientes = [];
  for (const i of posiciones) {
    const indices = [...camino, i];
    const crudo = resolverCrudo(ev.payload, indices);
    if (crudo === undefined) continue; // sin desarrollar: no propone
    const r = evaluar(eje, foco, indices);
    if (r.estado !== 'RESUELTO') { pendientes.push({ posicion: i, motivo: r.texto }); continue; }
    const v = r.valor;
    const esFormula = typeof crudo === 'string' && crudo.startsWith('=') && !crudo.startsWith('==');
    if (v.tipo === 'coleccion') {
      const primero = v.items[0];
      if (!primero) { pendientes.push({ posicion: i, motivo: 'sin candidatos' }); continue; }
      const candidato = { evento: primero.evento, dir: direccion(primero.indices ?? []), tipo: primero.origen, origenDir: primero.origenDir, vector: primero.vector, signo: primero.signo };
      elecciones[i] = { candidato };
      origenes.push({ posicion: i, desde: 'formula', texto: r.texto });
    } else if (esFormula) {
      elecciones[i] = v.tipo === 'numero' ? v.valor : r.texto;
      origenes.push({ posicion: i, desde: 'formula', texto: r.texto });
    } else {
      elecciones[i] = { ref: foco, dir: direccion(indices) };
      origenes.push({ posicion: i, desde: 'foco', texto: r.texto });
    }
  }
  return { foco, elecciones, origenes, pendientes };
}

function resolverCrudo(payload, indices) {
  let nodo = payload;
  for (const i of indices) {
    if (!Array.isArray(nodo)) return undefined;
    nodo = nodo[i];
  }
  return nodo;
}

/**
 * Descubrir: qué hay en las posiciones de interacción (1–4) del foco, con
 * sus candidatos (encaje) y las fórmulas resueltas. No escribe.
 */
export function descubrir(eje, foco, { camino = [], posiciones = [1, 2, 3, 4] } = {}) {
  const ev = eje.obtener(foco);
  if (!ev) throw new Error('foco desconocido: ' + foco);
  return posiciones.map((i) => {
    const indices = [...camino, i];
    const candidatos = ocupantes(eje, foco, indices).map((o) => {
      const r = evaluar(eje, o.evento, caminoVisible(o));
      return { ...o, estado: r.estado, texto: r.texto };
    });
    return { posicion: i, dir: direccion(indices), candidatos };
  });
}

/**
 * Consolidar: la fábrica finaliza UNA acción de registro. Las elecciones
 * (por posición: un candidato elegido como referencia, o un terminal nuevo)
 * se funden en un array consolidado con referencias a sus fuentes y se
 * registran como evento anclado a la fábrica del foco. No ejecuta nada.
 */
export async function consolidar(eje, { autor, foco, elecciones, titulo = 'Consolidación', t, camino = [] }, privada) {
  if (!elecciones || !Object.keys(elecciones).length) throw new Error('nada que consolidar');
  const payload = [titulo];
  const fuentes = [];
  const encaje = []; // de dónde vino cada elección, cuánto se desplazó y en qué sentido
  const indicesElegidos = Object.keys(elecciones).map(Number).sort((a, b) => a - b);
  const ultimo = indicesElegidos[indicesElegidos.length - 1];
  if (indicesElegidos.some((i) => !Number.isInteger(i) || i < 1 || i > 9)) throw new Error('las elecciones van en posiciones 1–9');
  for (let i = 1; i <= ultimo; i++) {
    const e = elecciones[i];
    if (e === undefined) {
      // Hueco: se hereda del foco por referencia si existe; si no, se rechaza.
      const hay = ocupantes(eje, foco, [...camino, i]).length > 0;
      if (!hay) throw new Error('hueco en ' + i + ': elige algo o quita las posiciones siguientes');
      payload.push({ ref: foco, dir: direccion([...camino, i]) });
      continue;
    }
    if (esReferencia(e)) {
      if (!eje.obtener(e.ref)) throw new Error('fuente desconocida en ' + i);
      payload.push(e);
      fuentes.push(e.ref);
      encaje.push({ posicion: i, evento: e.ref, origen: e.dir ?? '0000000000', destino: direccion([...camino, i]), vector: vector(e.dir ?? '0000000000', direccion([...camino, i])) });
    } else if (e && typeof e === 'object' && e.candidato) {
      const c = e.candidato;
      payload.push({ ref: c.evento, dir: c.dir ?? '0000000000' });
      fuentes.push(c.evento);
      const origen = c.origenDir ?? c.dir ?? '0000000000';
      const destino = direccion([...camino, i]);
      const v = c.vector ?? vector(origen, destino);
      encaje.push({ posicion: i, evento: c.evento, tipo: c.tipo ?? c.origen, origen, destino, vector: v, signo: c.signo ?? signo(v) });
    } else {
      payload.push(e); // terminal nuevo
    }
  }
  return escribirDesde(eje, {
    modo: 'mapped',
    autor,
    sobre: foco,
    en: direccion([...camino, 4]),
    payload,
    t,
    contexto: { motor: 'fabrica', fase: 'consolidado', fuentes: [...new Set(fuentes)], encaje },
  }, privada);
}

/**
 * Quién puede autorizar (regla V0, por defecto hasta que VG decida otra):
 * una identidad con poder (saldo de P > 0) distinta del autor de la
 * consolidación. Quién ejecuta: el autor de la consolidación.
 */
export function puedeAutorizar(eje, identidad, consolidacion) {
  const c = eje.obtener(consolidacion);
  return Boolean(c) && identidad !== c.autor && eje.poderSobre(identidad, consolidacion) > 0;
}

/**
 * Autorizar: un registro de quien autoriza, anclado a la consolidación.
 * Solo cuenta si quien lo escribe puede autorizar (poder y no ser el autor).
 */
export async function autorizar(eje, { autorizante, consolidacion, t, nota = 'autorizo' }, privada) {
  const c = eje.obtener(consolidacion);
  if (!c || c.contexto?.fase !== 'consolidado') throw new Error('no es una consolidación: ' + String(consolidacion).slice(0, 8));
  if (!puedeAutorizar(eje, autorizante, consolidacion)) {
    throw new Error(autorizante === c.autor ? 'el autor no se autoriza a sí mismo' : autorizante + ' no tiene poder (P) sobre este registro');
  }
  if (estadoDe(eje, consolidacion) !== 'PENDIENTE DE AUTORIZACIÓN') throw new Error('ya está ' + estadoDe(eje, consolidacion).toLowerCase());
  return escribirDesde(eje, {
    modo: 'pointed',
    autor: autorizante,
    sobre: consolidacion,
    en: FABRICA,
    payload: '==' + nota,
    t,
    contexto: { motor: 'fabrica', fase: 'autorizado' },
  }, privada);
}

/**
 * Ejecutar: con la consolidación autorizada, el evento final mueve los
 * tokens reales (además del T del autor) y deja la evidencia: referencia a
 * la consolidación y a su autorización. La capacidad de una posición no se
 * cuenta aquí: la limita una serie de tokens que la ejecución mueve (si quien
 * ejecuta ya no los tiene, el eje la rechaza por saldo insuficiente); el
 * contador de ocupacion() es solo informativo.
 */
export async function ejecutar(eje, { autor, consolidacion, movimientos = [], t, titulo = 'Ejecutado' }, privada) {
  const c = eje.obtener(consolidacion);
  if (!c || c.contexto?.fase !== 'consolidado') throw new Error('no es una consolidación: ' + String(consolidacion).slice(0, 8));
  if (autor !== c.autor) throw new Error('ejecuta el autor de la consolidación: ' + c.autor);
  const estado = estadoDe(eje, consolidacion);
  if (estado === 'PENDIENTE DE AUTORIZACIÓN') throw new Error('PENDIENTE DE AUTORIZACIÓN');
  if (estado === 'EJECUTADO') throw new Error('ya ejecutado');
  const autorizacion = autorizacionesValidas(eje, consolidacion)[0];
  const payload = [titulo, { ref: consolidacion }, { ref: autorizacion.id }];
  const mov = [{ token: 'T', escala: 'minuto', cantidad: 1, de: autor, a: null }, ...movimientos];
  return eje.escribir({
    autor,
    sobre: consolidacion,
    en: FABRICA,
    t: t ?? new Date().toISOString(),
    movimientos: mov,
    payload,
    contexto: { motor: 'fabrica', fase: 'ejecutado', evidencia: [consolidacion, autorizacion.id] },
  }, privada);
}

/** Autorizaciones que cuentan: escritas por quien puede autorizar. Lo demás es ruido. */
export function autorizacionesValidas(eje, consolidacion) {
  return eje.sobre(consolidacion, FABRICA).filter((e) => e.contexto?.fase === 'autorizado' && puedeAutorizar(eje, e.autor, consolidacion));
}

/** Estado de una consolidación según lo escrito sobre ella en la fábrica por quien puede. */
export function estadoDe(eje, consolidacion) {
  const c = eje.obtener(consolidacion);
  if (!c) return undefined;
  const escritos = eje.sobre(consolidacion, FABRICA);
  if (escritos.some((e) => e.contexto?.fase === 'ejecutado' && e.autor === c.autor && (e.contexto.evidencia ?? []).every((id) => eje.obtener(id)))) return 'EJECUTADO';
  if (autorizacionesValidas(eje, consolidacion).length) return 'AUTORIZADO';
  return 'PENDIENTE DE AUTORIZACIÓN';
}

/** Consolidaciones de un foco con su estado. */
export function consolidaciones(eje, foco, camino = []) {
  return eje.sobre(foco, direccion([...camino, 4]))
    .filter((e) => e.contexto?.fase === 'consolidado')
    .map((e) => ({ id: e.id, autor: e.autor, t: e.t, titulo: e.payload[0], estado: estadoDe(eje, e.id), fuentes: e.contexto.fuentes ?? [] }));
}

// ---------- capacidad: un contador informativo; el límite es una serie de tokens ----------

/**
 * Capacidad de una posición (VG, 7-11). Una posición admite muchos
 * ocupantes (colisiones: se escriben y se ven todos), y puede declarar
 * cuántos de ellos pueden ser VÁLIDOS a la vez en un mismo tramo. Lo que lo
 * hace cumplir no es este contador sino una SERIE LIMITADA de tokens E que
 * emite quien respalda la posición (en Booking, la casa: un token por plaza
 * y noche, tantos como capacidad): ejecutar mueve esos tokens y, sin saldo,
 * el eje no ejecuta. El contador (ocupacion) queda INFORMATIVO: para la
 * interfaz y para saber cuántos tokens emitir; no bloquea nada.
 * [X] decidir VG: cómo declara una posición su capacidad. V0: la décupla de
 * la posición lleva en su criterio (subposición 2: «cuántos caben a la vez»)
 * un entero positivo, como una plaza [nombre, precio, capacidad] bajo la
 * época 0 (0 representación, 1 recursos, 2 criterios). Alternativa: en sus
 * recursos (1), junto al precio. Sin ese entero, la posición no declara nada.
 */
export const CRITERIO_CAPACIDAD = 2;

/** Capacidad que declara el contenido de una posición, o undefined si no declara ninguna. */
export function capacidadDe(nodo) {
  if (!Array.isArray(nodo)) return undefined;
  const c = nodo[CRITERIO_CAPACIDAD];
  return Number.isSafeInteger(c) && c > 0 ? c : undefined;
}

const SIETE = direccion([7]);

/**
 * Tramo de un registro: su futuro (posición 7) como [inicio, fin), dos
 * fechas o instantes ISO; el fin no cuenta (la noche de la salida no se
 * ocupa). El 7 es una colisión: vale lo propio (payload[7], o lo que alcance
 * si es una referencia) y lo que el AUTOR del registro ancle en su 7 («lo
 * lejano = anclaje»: se llega al 7 sin rellenar 5 y 6); manda el primero en
 * el orden de encaje (exactos, luego la llegada). Un tramo es acotado: sin
 * 7 o ilegible, error.
 * [X] decidir VG: la forma del tramo en el 7 (dos fechas, fin excluido) y
 * que solo el autor del registro ancle su tramo.
 */
export function tramoDe(eje, id) {
  const ev = eje.obtener(id);
  if (!ev) throw new Error('registro desconocido: ' + id);
  const [primero] = ocupantes(eje, id, [7])
    .filter((o) => (o.origen === 'escrito' ? o.autor === ev.autor : !esReferencia(o.contenido)));
  if (!primero) throw new Error('sin tramo en el 7 de ' + id.slice(0, 8) + ': hace falta [inicio, fin] en ISO, propio o anclado en ' + SIETE + ' por su autor');
  const [a, b] = Array.isArray(primero.contenido) ? primero.contenido : [];
  const inicio = typeof a === 'string' ? Date.parse(a) : NaN;
  const fin = typeof b === 'string' ? Date.parse(b) : NaN;
  if (!(inicio < fin)) throw new Error('tramo ilegible en el 7 de ' + id.slice(0, 8) + ': hacen falta [inicio, fin] en ISO, con inicio antes que fin');
  return { inicio, fin, extremos: [a, b], texto: a + ' – ' + b, desde: primero.evento };
}

/** Un ocupante ya válido sin tramo legible no se descarta: para contar, ocupa todo el tiempo. */
function tramoOTodo(eje, id) {
  try { return tramoDe(eje, id); } catch { return { inicio: -Infinity, fin: Infinity, texto: 'todo el tiempo' }; }
}

/** Si un payload lleva, a cualquier profundidad, una referencia a la dirección `dir` de `id`. */
function referencia(payload, id, dir) {
  if (esReferencia(payload)) return payload.ref === id && (payload.dir ?? '0000000000') === dir;
  return Array.isArray(payload) && payload.some((h) => referencia(h, id, dir));
}

/**
 * Registros que ocupan una posición: los anclados en ella (`sobre` + `en`) y
 * los que la REFERENCIAN desde donde estén anclados, sin repetir, por orden
 * de llegada. Así ningún ocupante escapa al contador por elegir otro `en`.
 */
export function registrosEn(eje, sobre, dir) {
  const anclados = new Set(eje.sobre(sobre, dir).map((e) => e.id));
  return eje.orden
    .map((id) => eje.obtener(id))
    .filter((e) => anclados.has(e.id) || (e.id !== sobre && referencia(e.payload, sobre, dir)));
}

/** Cuántos tramos coinciden a la vez, como mucho, dentro de otro (barrido por los inicios). */
function maximoALaVez(tramos, dentro) {
  const puntos = [dentro.inicio, ...tramos.map((x) => x.inicio).filter((p) => p > dentro.inicio && p < dentro.fin)];
  let maximo = 0;
  for (const p of puntos) maximo = Math.max(maximo, tramos.filter((x) => x.inicio <= p && p < x.fin).length);
  return maximo;
}

/**
 * Ocupación de las posiciones con capacidad donde está anclado un registro.
 * Solo INFORMA: la fábrica no la consulta. La dirección `en` nombra la
 * colisión entera (§12: «1» y «1.0» son el mismo lugar), así que mira cada
 * camino que la dirección nombra y que declara capacidad. Si hay alguno, el
 * registro ha de tener un tramo acotado (tramoDe; si no, error). Por cada
 * uno: la capacidad, el tramo, los OTROS registros de esa posición ya
 * válidos (con consolidación EJECUTADA; anclados en ella o que la
 * referencian desde otro sitio) que se solapan con el tramo, cuántos
 * coinciden a la vez como mucho (con capacidad 2 caben dos estancias
 * encadenadas y una tercera que las cruza) y si cabría uno más. Consulta sin
 * efectos.
 */
export function ocupacion(eje, id) {
  const ev = eje.obtener(id);
  if (!ev) throw new Error('registro desconocido: ' + id);
  if (ev.sobre === null) return [];
  const padre = eje.obtener(ev.sobre);
  const conCapacidad = caminosDe(padre.payload, ev.en).filter((c) => capacidadDe(c.contenido) !== undefined);
  if (!conCapacidad.length) return [];
  const tramo = tramoDe(eje, id);
  const validos = registrosEn(eje, ev.sobre, ev.en)
    .filter((o) => o.id !== id && consolidaciones(eje, o.id).some((c) => c.estado === 'EJECUTADO'))
    .map((o) => ({ id: o.id, autor: o.autor, anclado: o.sobre === ev.sobre && o.en === ev.en, tramo: tramoOTodo(eje, o.id) }))
    .filter((o) => o.tramo.inicio < tramo.fin && tramo.inicio < o.tramo.fin);
  const aLaVez = maximoALaVez(validos.map((o) => o.tramo), tramo);
  return conCapacidad.map((c) => {
    const capacidad = capacidadDe(c.contenido);
    return { sobre: ev.sobre, dir: ev.en, camino: c.indices, capacidad, tramo, validos, aLaVez, cabe: aLaVez < capacidad };
  });
}
