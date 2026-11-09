// Las condiciones de validez de una transacción (VG, 9-11: «registrar es
// hacer una transacción»; las reglas de economía pasan a ser condiciones de
// validez). En este paso son las reglas de siempre ENVUELTAS tal cual, en el
// mismo orden en que las aplicaba eje.validar, así que el eje dice lo mismo
// que antes. Cada una es { nombre, filas, familia, evaluar(tx, libroAntes,
// ctx) } y cita las filas de docs/notas/INVENTARIO_REGLAS.md §2 que cubre; la
// correspondencia completa está en docs/notas/CAPA_CERO.md.
//
// Las condiciones con motivos de PASO (`paso`: ID-8, PP-4) rechazan un
// movimiento concreto: el libro no lo simula y su motivo va en su sitio
// entre los fallos de la aritmética (src/libro.js, probar).

import { FORMA, ID, NUEVO, UN_GENESIS, ANCLA, REFERENCIAS, AUTOR_CON_ALTA } from './evento.js';
import { FIRMA, CLAVES, TIPOS, AJENOS, GENESIS, FIRMA_GENESIS } from './identidad.js';
import { CONDICIONES_DEL_CICLO, AMBITO_P } from './ciclo.js';
import { CONDICIONES_DEL_TOPE } from './tope.js';
import { CONDICIONES_DE_R } from './r.js';

export { FORMA, ID, NUEVO, UN_GENESIS, ANCLA, REFERENCIAS, AUTOR_CON_ALTA } from './evento.js';
export { FIRMA, CLAVES, TIPOS, AJENOS, GENESIS, FIRMA_GENESIS, erroresGenesis, erroresFirmaGenesis } from './identidad.js';
export { CONDICIONES_DEL_CICLO, AMBITO_P } from './ciclo.js';
export { CONDICIONES_DEL_TOPE, reglasDelTope, SIN_CAPACIDAD, contratoE } from './tope.js';
export { CONDICIONES_DE_R } from './r.js';

/** Las condiciones de un evento que no es el génesis, en el orden de eje.validar. */
export const CONDICIONES = Object.freeze([
  FORMA, ID, NUEVO, UN_GENESIS, ANCLA, REFERENCIAS, AUTOR_CON_ALTA,
  FIRMA, CLAVES, TIPOS,
  ...CONDICIONES_DEL_CICLO,
  ...CONDICIONES_DEL_TOPE,
  ...CONDICIONES_DE_R,
  AJENOS, AMBITO_P,
]);

/** Al crear un eje (Eje.genesis): lo que emite y declara el génesis, y su firma. */
export const CONDICIONES_GENESIS = Object.freeze([GENESIS, FIRMA_GENESIS]);

/** Al restaurar un eje (Eje.desde): la forma, lo del génesis, su id y, si todo eso pasa, su firma. */
export const CONDICIONES_GENESIS_GUARDADO = Object.freeze([
  FORMA,
  GENESIS,
  Object.freeze({ ...ID, evaluar: async (tx, libro, ctx) => ((await ID.evaluar(tx, libro, ctx)) ? 'id del génesis no corresponde' : null) }),
  Object.freeze({ ...FIRMA_GENESIS, soloSiValida: true }),
]);

/**
 * Evalúa en orden unas condiciones síncronas (sin la simulación del libro) y
 * devuelve sus motivos, con el nombre de la condición: lo que usan las capas
 * de validez (src/validez.js) con las del ciclo y las de R, sobre el eje de
 * justo antes del registro. Una sola verdad: las mismas condiciones que el eje.
 */
export function motivosDe(condiciones, tx, libro, ctx) {
  const motivos = [];
  for (const c of condiciones) {
    const r = c.evaluar(tx, libro, ctx);
    for (const m of r === null || r === undefined ? [] : Array.isArray(r) ? r : [r]) {
      motivos.push(typeof m === 'string' ? { texto: m, condicion: c.nombre } : { condicion: c.nombre, ...m });
    }
  }
  return motivos;
}

/** Todas las condiciones con nombre, una vez cada una: [{ nombre, filas, familia }] (lo que lista docs/notas/CAPA_CERO.md). */
export function catalogo() {
  const vistas = new Set();
  return [...CONDICIONES_GENESIS, ...CONDICIONES].filter((c) => !vistas.has(c) && vistas.add(c))
    .map(({ nombre, filas, familia }) => ({ nombre, filas: [...filas], familia }));
}
