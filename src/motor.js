// Motor AGRAM, ciclo mínimo: descubrir → elegir/crear → consolidar en la
// fábrica (PV4) → autorizar → ejecutar con evidencia. Consolidar no es
// ejecutar. Todo son eventos: la consolidación, la autorización y la
// ejecución son registros anclados a la fábrica del foco, encadenados por
// referencia, de modo que la evidencia es el propio hilo.
//
// Estados de una consolidación: PENDIENTE DE AUTORIZACIÓN → AUTORIZADO → EJECUTADO.

import { direccion, esReferencia } from './btml.js';
import { ocupantes } from './encaje.js';
import { evaluar } from './bql.js';
import { escribirDesde } from './escritura.js';

export const FABRICA = '4000000000';
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
      const r = o.origen === 'escrito' ? evaluar(eje, o.evento, [0]) : evaluar(eje, o.evento, o.dir);
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
export async function consolidar(eje, { autor, foco, elecciones, titulo = 'Consolidación', t, camino = [] }) {
  if (!elecciones || !Object.keys(elecciones).length) throw new Error('nada que consolidar');
  const payload = [titulo];
  const fuentes = [];
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
    } else if (e && typeof e === 'object' && e.candidato) {
      const c = e.candidato;
      payload.push({ ref: c.evento, dir: c.dir ?? '0000000000' });
      fuentes.push(c.evento);
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
    contexto: { motor: 'fabrica', fase: 'consolidado', fuentes: [...new Set(fuentes)] },
  });
}

/**
 * Autorizar: un registro de quien autoriza, anclado a la consolidación.
 * Quién puede autorizar lo decide la autoridad (paso siguiente); aquí se
 * exige que sea una identidad conocida y distinta de «nadie».
 */
export async function autorizar(eje, { autorizante, consolidacion, t, nota = 'autorizo' }) {
  const c = eje.obtener(consolidacion);
  if (!c || c.contexto?.fase !== 'consolidado') throw new Error('no es una consolidación: ' + String(consolidacion).slice(0, 8));
  if (estadoDe(eje, consolidacion) !== 'PENDIENTE DE AUTORIZACIÓN') throw new Error('ya está ' + estadoDe(eje, consolidacion).toLowerCase());
  return escribirDesde(eje, {
    modo: 'pointed',
    autor: autorizante,
    sobre: consolidacion,
    en: FABRICA,
    payload: '==' + nota,
    t,
    contexto: { motor: 'fabrica', fase: 'autorizado' },
  });
}

/**
 * Ejecutar: con la consolidación autorizada, el evento final mueve los
 * tokens reales (además del T del autor) y deja la evidencia: referencia a
 * la consolidación y a su autorización.
 */
export async function ejecutar(eje, { autor, consolidacion, movimientos = [], t, titulo = 'Ejecutado' }) {
  const c = eje.obtener(consolidacion);
  if (!c || c.contexto?.fase !== 'consolidado') throw new Error('no es una consolidación: ' + String(consolidacion).slice(0, 8));
  const estado = estadoDe(eje, consolidacion);
  if (estado === 'PENDIENTE DE AUTORIZACIÓN') throw new Error('PENDIENTE DE AUTORIZACIÓN');
  if (estado === 'EJECUTADO') throw new Error('ya ejecutado');
  const autorizacion = eje.sobre(consolidacion, FABRICA).find((e) => e.contexto?.fase === 'autorizado');
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
  });
}

/** Estado de una consolidación según lo escrito sobre ella en la fábrica. */
export function estadoDe(eje, consolidacion) {
  const fases = eje.sobre(consolidacion, FABRICA).map((e) => e.contexto?.fase);
  if (fases.includes('ejecutado')) return 'EJECUTADO';
  if (fases.includes('autorizado')) return 'AUTORIZADO';
  return 'PENDIENTE DE AUTORIZACIÓN';
}

/** Consolidaciones de un foco con su estado. */
export function consolidaciones(eje, foco, camino = []) {
  return eje.sobre(foco, direccion([...camino, 4]))
    .filter((e) => e.contexto?.fase === 'consolidado')
    .map((e) => ({ id: e.id, autor: e.autor, t: e.t, titulo: e.payload[0], estado: estadoDe(eje, e.id), fuentes: e.contexto.fuentes ?? [] }));
}
