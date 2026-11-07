// Motor AGRAM, ciclo mínimo: descubrir → elegir/crear → consolidar en la
// fábrica (PV4) → autorizar → ejecutar con evidencia. Consolidar no es
// ejecutar. Todo son eventos: la consolidación, la autorización y la
// ejecución son registros anclados a la fábrica del foco, encadenados por
// referencia, de modo que la evidencia es el propio hilo.
//
// Estados de una consolidación: PENDIENTE DE AUTORIZACIÓN → AUTORIZADO → EJECUTADO.

import { direccion, esReferencia } from './btml.js';
import { ocupantes, vector, sentido } from './encaje.js';
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
      encaje.push({ posicion: i, evento: c.evento, tipo: c.tipo ?? c.origen, origen, destino, vector: c.vector ?? vector(origen, destino), sentido: c.sentido ?? sentido(c.vector ?? vector(origen, destino)) });
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
  return Boolean(c) && identidad !== c.autor && eje.saldo(identidad, 'P') > 0;
}

/**
 * Autorizar: un registro de quien autoriza, anclado a la consolidación.
 * Solo cuenta si quien lo escribe puede autorizar (poder y no ser el autor).
 */
export async function autorizar(eje, { autorizante, consolidacion, t, nota = 'autorizo' }, privada) {
  const c = eje.obtener(consolidacion);
  if (!c || c.contexto?.fase !== 'consolidado') throw new Error('no es una consolidación: ' + String(consolidacion).slice(0, 8));
  if (!puedeAutorizar(eje, autorizante, consolidacion)) {
    throw new Error(autorizante === c.autor ? 'el autor no se autoriza a sí mismo' : autorizante + ' no tiene poder (P) para autorizar');
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
