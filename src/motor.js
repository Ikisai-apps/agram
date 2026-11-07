// Motor AGRAM, ciclo mínimo: descubrir → elegir/crear → consolidar en la
// fábrica (PV4) → autorizar → ejecutar con evidencia. Consolidar no es
// ejecutar. Todo son eventos: la consolidación, la autorización y la
// ejecución son registros anclados a la fábrica del foco, encadenados por
// referencia, de modo que la evidencia es el propio hilo.
//
// Estados de una consolidación: PENDIENTE DE AUTORIZACIÓN → AUTORIZADO → EJECUTADO.

import { direccion, esReferencia } from './btml.js';
import { ocupantes, vector, signo } from './encaje.js';
import { evaluar } from './bql.js';
import { escribirDesde } from './escritura.js';
import { contarPosiciones } from './modos.js';
import { AMBITO_GENESIS } from './tokens.js';

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
 * sus candidatos (encaje: vector, empate y justificación) y las fórmulas
 * resueltas. No escribe. La época se elige al leer (`epoca`) y ordena los
 * candidatos. `maximo` limita cuántos se entregan por posición sin
 * esconder el resto: cada posición dice su `total` y si va `limitada`.
 * Una referencia a un evento ausente es un candidato PENDIENTE, no un ERROR.
 */
export function descubrir(eje, foco, { camino = [], posiciones = [1, 2, 3, 4], epoca, maximo = Infinity } = {}) {
  const ev = eje.obtener(foco);
  if (!ev) throw new Error('foco desconocido: ' + foco);
  return posiciones.map((i) => {
    const indices = [...camino, i];
    const todos = ocupantes(eje, foco, indices, { epoca });
    const candidatos = todos.slice(0, maximo).map((o) => {
      // Lo que el encaje ya sabe pendiente (una referencia ausente) no se evalúa: no hay nada que leer.
      const r = o.estado ? { estado: o.estado, texto: o.estado + ': ' + o.motivo } : evaluar(eje, o.evento, caminoVisible(o));
      return { ...o, estado: r.estado, texto: r.texto };
    });
    return { posicion: i, dir: direccion(indices), candidatos, total: todos.length, limitada: candidatos.length < todos.length };
  });
}

/**
 * Consolidar: la fábrica finaliza UNA acción de registro. Las elecciones
 * (por posición: un candidato elegido como referencia, o un terminal nuevo;
 * o varias en un array, que se combinan en la misma posición) se funden en
 * un array consolidado con referencias a sus fuentes y se registran como
 * evento anclado a la fábrica del foco. No ejecuta nada.
 */
export async function consolidar(eje, { autor, foco, elecciones, titulo = 'Consolidación', t, camino = [] }, privada) {
  if (!elecciones || !Object.keys(elecciones).length) throw new Error('nada que consolidar');
  const payload = [titulo];
  const fuentes = [];
  const encaje = []; // de dónde vino cada elección, cuánto se desplazó y en qué sentido
  const indicesElegidos = Object.keys(elecciones).map(Number).sort((a, b) => a - b);
  const ultimo = indicesElegidos[indicesElegidos.length - 1];
  if (indicesElegidos.some((i) => !Number.isInteger(i) || i < 1 || i > 9)) throw new Error('las elecciones van en posiciones 1–9');
  /** Una elección hecha contenido: una referencia a su fuente, un terminal nuevo o, si es un array, la combinación de varias. */
  const contenido = (e, i) => {
    const destino = direccion([...camino, i]);
    if (Array.isArray(e)) return e.map((x) => contenido(x, i)); // combinar: varias elecciones en la misma posición
    if (esReferencia(e)) {
      if (!eje.obtener(e.ref)) throw new Error('fuente desconocida en ' + i);
      fuentes.push(e.ref);
      encaje.push({ posicion: i, evento: e.ref, origen: e.dir ?? '0000000000', destino, vector: vector(e.dir ?? '0000000000', destino) });
      return e;
    }
    if (e && typeof e === 'object' && e.candidato) {
      const c = e.candidato;
      fuentes.push(c.evento);
      const origen = c.origenDir ?? c.dir ?? '0000000000';
      const v = c.vector ?? vector(origen, destino);
      encaje.push({ posicion: i, evento: c.evento, tipo: c.tipo ?? c.origen, origen, destino, vector: v, signo: c.signo ?? signo(v) });
      return { ref: c.evento, dir: c.dir ?? '0000000000' };
    }
    return e; // terminal nuevo
  };
  for (let i = 1; i <= ultimo; i++) {
    const e = elecciones[i];
    if (e === undefined) {
      // Hueco: se hereda del foco por referencia si existe; si no, se rechaza.
      const hay = ocupantes(eje, foco, [...camino, i]).length > 0;
      if (!hay) throw new Error('hueco en ' + i + ': elige algo o quita las posiciones siguientes');
      payload.push({ ref: foco, dir: direccion([...camino, i]) });
      continue;
    }
    payload.push(contenido(e, i));
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

/** La regla de autorización que se aplica hoy: un hueco provisional hasta AARPIA (MAPA §12). */
export const REGLA_AUTORIZAR = 'V0 provisional hasta AARPIA: autoriza quien tiene P > 0 sobre el registro y no es su autor; ejecuta el autor';

/**
 * Autorizar: un registro de quien autoriza, anclado a la consolidación.
 * Solo cuenta si quien lo escribe puede autorizar (poder y no ser el autor).
 * El registro lleva en sus metadatos (contexto.autoridad) en qué se apoya:
 * la regla y el poder con el que se autoriza, ámbito a ámbito. Es una
 * declaración, como cualquier metadato: el estado se vuelve a calcular con
 * el eje, no se fía de ella.
 */
export async function autorizar(eje, { autorizante, consolidacion, t, nota = 'autorizo' }, privada) {
  const c = eje.obtener(consolidacion);
  if (!c || c.contexto?.fase !== 'consolidado') throw new Error('no es una consolidación: ' + String(consolidacion).slice(0, 8));
  if (!puedeAutorizar(eje, autorizante, consolidacion)) {
    throw new Error(autorizante === c.autor ? 'el autor no se autoriza a sí mismo' : autorizante + ' no tiene poder (P) sobre este registro');
  }
  if (estadoDe(eje, consolidacion) !== 'PENDIENTE DE AUTORIZACIÓN') throw new Error('ya está ' + estadoDe(eje, consolidacion).toLowerCase());
  const hilo = new Set(eje.hilo(consolidacion).map((e) => e.id));
  const poderes = eje.poderes(autorizante).filter((p) => p.ambito === AMBITO_GENESIS || hilo.has(p.ambito));
  return escribirDesde(eje, {
    modo: 'pointed',
    autor: autorizante,
    sobre: consolidacion,
    en: FABRICA,
    payload: '==' + nota,
    t,
    contexto: { motor: 'fabrica', fase: 'autorizado', autoridad: { regla: REGLA_AUTORIZAR, poderes } },
  }, privada);
}

/**
 * Ejecutar: con la consolidación autorizada, el evento final mueve los
 * tokens reales (además del T del autor) y deja la evidencia: referencia a
 * la consolidación y a su autorización.
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
  // Cartón piedra, como todo registro de salida: un minuto de T por posición escrita.
  const mov = [{ token: 'T', escala: 'minuto', cantidad: contarPosiciones(payload), de: autor, a: null }, ...movimientos];
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

/**
 * Estado de una consolidación según lo escrito sobre ella en la fábrica por
 * quien puede. Solo las consolidaciones tienen este ciclo: cualquier otro
 * registro no tiene estado (undefined), tampoco el génesis.
 */
export function estadoDe(eje, consolidacion) {
  const c = eje.obtener(consolidacion);
  if (!c || c.contexto?.fase !== 'consolidado') return undefined;
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
