// Condiciones de identidad y autoridad (inventario §2, «Identidades, claves y
// tipos» y «Génesis»): quien tiene clave firma (ID-5), sin clave no se actúa
// (ID-4, R9), las claves y los tipos se declaran en el alta (ID-2, ID-3,
// ID-6), nadie mueve tokens ajenos (ID-8) y el génesis (GN-1, GN-2). Mismo
// texto y mismo orden que tenían en src/eje.js; ahora son condiciones de
// validez de la transacción (VG, 9-11: la capa cero).

import { claveToken, cantidadBase, AMBITO_GENESIS } from '../tokens.js';
import { motivoTipo, EMITEN_V2, T_NO_SE_EMITE, SIN_TIPO } from '../ciclo.js';
import { verificar, verificarPosesion, clavePublicaValida } from '../autoridad.js';

const enEnteros = (k) => 'la serie ' + k + ' va en enteros: no se declaró divisible (divisible: true en su primera emisión)';
const objetos = (ev) => (Array.isArray(ev.movimientos) ? ev.movimientos.filter((m) => m && typeof m === 'object') : []);

/**
 * Suelo: la firma verifica (criptografía, src/autoridad.js), y la bandera exigirFirmas del eje. Quién firma (el
 * firmante es el autor si tiene clave: ID-5) y que sin clave no se actúa (ID-4, R9) son reglas de la época, «who has
 * a key signs» y «without a key nobody acts», que leen la clave y el firmante como posiciones (B4; encargo 3a, paso
 * 9: retiradas de aquí). En el prefijo de la versión 2, las de entonces.
 */
export const FIRMA = Object.freeze({
  nombre: 'suelo:firma',
  filas: Object.freeze([]),
  familia: 'identidad',
  evaluar: async (tx, libro, ctx) => {
    const ev = ctx.evento;
    // B1: quien aún no tiene cuenta escribe su propia alta, y la clave que declara en ella para sí es la suya: la
    // firma de este registro con esa clave es su prueba de posesión.
    const clave = ctx.clave(ev.autor) ?? (libro.tiene(ev.autor) ? undefined : ev.contexto?.claves?.[ev.autor]);
    if (clave) {
      // Sin firma, o firmada por otro: lo dice la regla (o, en la versión 2, esto).
      if (!ev.firma || ev.firmante !== ev.autor) {
        if (ctx.reglas !== 2) return null;
        return !ev.firma ? 'firma ausente de ' + ev.autor : 'el firmante debe ser el autor';
      }
      if (!(await verificar(ev, clave))) return 'firma inválida de ' + ev.autor;
      return null;
    }
    if (ctx.exigirFirmas) return 'autor sin clave: ' + ev.autor;
    return null;
  },
});

/**
 * ID-2, ID-6. Las claves que declara el evento solo pueden ser de
 * identidades nuevas (que reciben tokens en él), y llegan con su prueba de
 * posesión (R9): la clave nueva firma el id del alta.
 */
export const CLAVES = Object.freeze({
  nombre: 'suelo:claves',
  filas: Object.freeze([]),
  familia: 'identidad',
  // Suelo: la clave es una clave pública válida y su prueba de posesión verifica (criptografía). Que se declare en
  // el alta, de quien no tiene cuenta (ID-2, ID-6), y que llegue con su prueba son reglas de la época, «a key is
  // declared at its alta» y «a declared key comes with its proof» (B4; encargo 3a, paso 9: retiradas de aquí). En
  // el prefijo de la versión 2, las de entonces.
  evaluar: async (tx, libro, ctx) => {
    const ev = ctx.evento;
    const movimientos = objetos(ev);
    const errores = [];
    const declaradas = ev.contexto?.claves ?? {};
    const v2 = ctx.reglas === 2;
    for (const [id, jwk] of Object.entries(declaradas)) {
      // B1: quien escribe su propia alta declara su clave (su firma es la prueba de posesión); para otra identidad,
      // la que recibe tokens en este alta (una cosa), con su prueba de posesión.
      const propia = id === ev.autor;
      if (v2 && (ctx.tieneClave(id) || libro.tiene(id))) errores.push('no se puede cambiar la clave de ' + id);
      else if (v2 && !propia && !movimientos.some((m) => m.a === id)) errores.push('clave declarada para ' + id + ' sin darle tokens');
      else if (!(await clavePublicaValida(jwk))) errores.push('clave inválida para ' + id);
      else if (!Object.hasOwn(ev.posesion ?? {}, id)) continue;
      else if (!(await verificarPosesion(ev, id, jwk))) errores.push('prueba de posesión inválida para ' + id + ': no la firma la clave que se declara');
    }
    for (const id of Object.keys(ev.posesion ?? {})) {
      if (!Object.hasOwn(declaradas, id)) errores.push('prueba de posesión de ' + id + ' sin clave declarada para él en este evento');
    }
    return errores;
  },
});

/**
 * ID-2, ID-3. No hay tipo (VG, 10-11, B1): fuera del prefijo de la versión 2,
 * un alta no declara persona ni cosa (se lee de quién la escribe). En el
 * prefijo de la versión 2 (suelo de persistencia), las reglas de entonces: los
 * tipos se declaraban en el alta, como la clave, y no cambiaban.
 */
export const TIPOS = Object.freeze({
  nombre: 'ID-3',
  filas: Object.freeze(['ID-2', 'ID-3']),
  familia: 'identidad',
  evaluar: (tx, libro, ctx) => {
    const ev = ctx.evento;
    const tipos = ev.contexto?.tipos;
    if (ctx.reglas !== 2) return tipos !== undefined ? SIN_TIPO : null;
    const movimientos = objetos(ev);
    const errores = [];
    for (const [id, tipo] of Object.entries(tipos ?? {})) {
      const mal = motivoTipo(id, tipo);
      if (mal) errores.push(mal);
      else if (ctx.tipoV2Declarado(id) || libro.tiene(id)) errores.push('no se puede cambiar el tipo de ' + id);
      else if (!movimientos.some((m) => m.a === id)) errores.push('tipo declarado para ' + id + ' sin darle tokens');
    }
    return errores;
  },
});

// ID-8 (nadie mueve tokens ajenos) es la regla de la época «nobody moves tokens of others» (encargo 3a, paso 9: la
// condición de paso AJENOS se retiró; su código vive en test/condiciones-retiradas.mjs como red de equivalencia).

// ---------- el génesis ----------

/**
 * GN-1, GN-2 (sin la firma). El génesis emite a su autor, sus series de E y
 * R quedan a su nombre, su P es sobre todo el eje («genesis»: aún no existe
 * ningún otro registro) y solo declara la clave de su autor. Su autor escribe
 * su propia alta: es una persona (VG, 10-11, B1: no hay tipo). Con las reglas
 * de la versión 2 (`reglas` = 2: un eje guardado con ella), declara el tipo de
 * su autor, persona o grupo (lo que había entonces).
 */
export function erroresGenesis(g, reglas = 3) {
  const errores = [];
  // Encargo 3b (VG, 10-11, A2; mapa §16 [D]): el génesis es la época 0, «registro con id conocido, sin movimientos»;
  // lleva la referencia a la época (contexto.epoca). Solo en el prefijo de la versión 2 emitía.
  if (reglas !== 2 && Array.isArray(g.movimientos) && g.movimientos.length) errores.push('el génesis no mueve nada: es la época 0 (encargo 3b); lo que su autor emita va en una transacción suya después');
  const totales = new Map();
  const divisibles = new Map(); // clave de E → divisible, fijado por su primera emisión
  const movimientos = objetos(g);
  for (const m of movimientos) {
    if (m.de !== null || m.a !== g.autor) errores.push('el génesis solo emite a su autor');
    else if (m.token === 'T' && reglas !== 2) errores.push(T_NO_SE_EMITE); // VG, 8-11: no hay T acumulable
    else if ((m.token === 'E' || m.token === 'R') && m.emisor !== g.autor) errores.push('en el génesis emite su autor: ' + m.emisor);
    else if (m.token === 'P' && reglas !== 2) errores.push('el génesis no acuña P: nadie acuña P a mano (mapa §15 [D], «P como peso de criterio»: se retira «P del génesis sobre todo el eje»)');
    else if (m.token === 'P' && m.ambito !== AMBITO_GENESIS) errores.push('el P del génesis es sobre todo el eje: ámbito «' + AMBITO_GENESIS + '»');
    else if (m.token === 'E' && reglas === 2 && (m.registro !== undefined || m.divisible !== undefined || m.emisores !== undefined)) {
      errores.push('registro, divisible y emisores no existían en la versión 2');
    } else if (m.token === 'E' && m.registro !== undefined) {
      errores.push('en el génesis no hay registro que nombrar: su E queda atada al génesis');
    } else if (m.token === 'E' && m.emisores !== undefined) {
      errores.push('en el génesis emite solo su autor: sin emisión conjunta');
    } else {
      const k = claveToken(m);
      totales.set(k, (totales.get(k) ?? 0) + cantidadBase(m));
      if (!Number.isFinite(totales.get(k))) errores.push('la serie ' + k + ' no admite tanto');
      if (m.token === 'E' && reglas !== 2) {
        // Fracciones solo en las series declaradas divisibles (R2, VG 7-11 noche).
        const divisible = m.divisible === true;
        if (!divisibles.has(k)) divisibles.set(k, divisible);
        else if (divisibles.get(k) !== divisible) errores.push('la serie ' + k + (divisibles.get(k) ? ' es' : ' no es') + ' divisible: una ampliación no cambia su contrato');
        if (!divisibles.get(k) && Number.isFinite(m.cantidad) && !Number.isInteger(m.cantidad)) errores.push(enEnteros(k));
      }
    }
  }
  // B1: no hay tipo; el autor del génesis escribe su propia alta: es una persona. Solo un génesis guardado con la
  // versión 2 declara el tipo de su autor (suelo de persistencia: las reglas de entonces).
  if (reglas !== 2 && g.contexto?.tipos !== undefined) errores.push(SIN_TIPO);
  for (const [id, tipo] of Object.entries(reglas === 2 ? g.contexto?.tipos ?? {} : {})) {
    if (id !== g.autor) errores.push('el génesis solo declara el tipo de su autor');
    else if (motivoTipo(id, tipo)) errores.push(motivoTipo(id, tipo));
    else if (!EMITEN_V2.includes(tipo)) errores.push('el génesis lo emite una persona: su autor no puede ser ' + tipo);
  }
  for (const id of Object.keys(g.contexto?.claves ?? {})) {
    if (id !== g.autor) errores.push('el génesis solo declara la clave de su autor');
  }
  // R9: sin clave no se actúa. Fuera de la demostración, el génesis declara la clave de su autor (y va firmado
  // con ella: erroresFirmaGenesis, que es su prueba de posesión). Un eje guardado con la versión 2 no la conocía.
  const demo = g.contexto?.demostracion;
  if (demo !== undefined && demo !== true) errores.push('demostracion va como true o no va');
  if (reglas !== 2 && demo !== true && !g.contexto?.claves?.[g.autor]) {
    errores.push('sin clave no se actúa: el génesis declara la clave de su autor y va firmado con ella (o se crea como demostración, { demostracion: true })');
  }
  return errores;
}

/**
 * GN-2 (la firma). Si el génesis declara la clave de su autor, la clave es
 * pública e importable y el génesis va firmado con ella por su autor. Es la
 * misma regla al crear el eje y al restaurarlo.
 */
export async function erroresFirmaGenesis(g) {
  const clave = g.contexto?.claves?.[g.autor];
  if (!clave) return [];
  if (!(await clavePublicaValida(clave))) return ['clave inválida para ' + g.autor];
  if (!g.firma) return ['el génesis con clave debe ir firmado con ella'];
  if (g.firmante !== g.autor) return ['el firmante del génesis debe ser su autor'];
  if (!(await verificar(g, clave))) return ['firma del génesis inválida: debe ir firmado con la clave de su autor'];
  return [];
}

/** GN-1, GN-2: lo que emite y declara el génesis (ctx.reglas: 2 en un eje guardado con la versión 2). */
export const GENESIS = Object.freeze({
  nombre: 'GN-1',
  filas: Object.freeze(['GN-1', 'GN-2', 'TT-1']),
  familia: 'genesis',
  evaluar: (tx, libro, ctx) => erroresGenesis(ctx.evento, ctx.reglas),
});

/** GN-2: el génesis con clave va firmado con ella por su autor. */
export const FIRMA_GENESIS = Object.freeze({
  nombre: 'GN-2',
  filas: Object.freeze(['GN-2', 'ID-5', 'ID-7']),
  familia: 'genesis',
  evaluar: (tx, libro, ctx) => erroresFirmaGenesis(ctx.evento),
});
