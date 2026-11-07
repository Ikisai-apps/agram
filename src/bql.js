// BQL V0: fórmulas dentro de un slot BTML. Convención: una cadena que empieza
// por «=» es fórmula; «==» escapa un texto que empieza por «=». No hay árbol
// BQL aparte: la posición del slot da el significado. Las consultas no tienen
// efectos. Evaluación segura: pila de dependencias (ciclos), límites de
// cálculo (presupuesto, profundidad, candidatos) y gancho de autorización.
//
//   =LOCAL(n, ...)          lee la décupla anfitriona: posición n (índices anidados opcionales)
//   =REF(id, dir?)          lee otro evento (id o prefijo), subposición de diez dígitos opcional
//   = 12 EUR + 2 EUR        magnitudes: misma unidad se suma conservando el desglose
//   = 12 EUR + 5 min        unidades distintas: composición heterogénea, operandos preservados
//   =BUSCAR(n, ...)         candidatos del camino n del anfitrión (un número es índice: camino exacto, relativo al anfitrión)
//   =BUSCAR("2000000000")   candidatos de esa dirección del registro (un texto de diez dígitos es dirección: absoluta, la colisión entera)
//   =FILTRAR(col, cond)     cond se evalúa por candidato; dentro, ACTUAL es el candidato y LOCAL sigue siendo el anfitrión
//   =ORDENAR(col, expr, "desc"?)   ordena por expr evaluada en cada candidato (claves escalares de un mismo tipo)
//   =ELEGIR(col, k?)        los k primeros (1 por defecto); no publica nada
//   =ACTUAL(pv, cantidad?)  fuera de FILTRAR: la colección activa de la posición pv, limitada a cantidad (1 por defecto);
//                           dentro: la posición pv del candidato. cantidad nunca es profundidad
//   =ORIGEN()               dentro de FILTRAR/ORDENAR: procedencia del candidato («propio», «referencia», «escrito»)
//   =ACUERDO() =DESPLAZAMIENTO() =SIGNO() =FALTAS() =EXCEDENTES()   el encaje del candidato: profundidades de acuerdo, suma de distancias, signo (exacto/completar/reducir/mixto), faltas y excedentes
//   =CONTAR(col) =SUMAR(col)
//   comparaciones  = <> < > <= >=   solo entre el mismo tipo escalar (y la misma unidad)   y   Y(a, b)  O(a, b)  NO(a)
//
// Estados: RESUELTO; PENDIENTE (falta un dato, un evento que no ha llegado o
// un ámbito); INCOMPATIBLE (tipos o unidades que no operan); ERROR (sintaxis,
// función desconocida, ciclo, argumento mal formado). PENDIENTE tiene dos
// subtipos: PENDIENTE DE AUTORIZACIÓN (una lectura que el gancho opcional
// puedeLeer(evId, dir, indices) no autoriza, por lectura, por ocupante y por
// salto de referencia; sin gancho todo se lee) y PENDIENTE POR LÍMITE
// (presupuesto, profundidad o candidatos agotados; `parcial` dice cuánto se
// examinó cuando se sabe).
//
// Opciones de evaluar/consultar: { puedeLeer(evId, dir, indices) → boolean, limites: { presupuesto, profundidad, candidatos } }.

import { ARIDAD, esReferencia, esDireccion, indicesDe, direccion } from './btml.js';
import { ocupantes } from './encaje.js';

/** Los cuatro estados de cálculo (corpus V4). */
export const ESTADOS = Object.freeze(['RESUELTO', 'PENDIENTE', 'INCOMPATIBLE', 'ERROR']);
/** Subtipos de PENDIENTE (mapa §2.3): esperas explicadas, no fallos. */
export const SUBTIPOS_PENDIENTE = Object.freeze(['PENDIENTE DE AUTORIZACIÓN', 'PENDIENTE POR LÍMITE']);
/** Límites de cálculo de una evaluación (valores V0; las opciones pueden cambiarlos). */
export const LIMITES = Object.freeze({ presupuesto: 2000, profundidad: 100, candidatos: 1000 });
const PEREZOSAS = Object.freeze({ FILTRAR: [1], ORDENAR: [1] }); // argumentos que se evalúan por candidato
const SOLO_DENTRO = Object.freeze(['ORIGEN', 'SIGNO', 'FALTAS', 'EXCEDENTES', 'ACUERDO', 'DESPLAZAMIENTO']);

/** PENDIENTE o uno de sus subtipos. */
export function esPendiente(estado) {
  return estado === 'PENDIENTE' || SUBTIPOS_PENDIENTE.includes(estado);
}

/** Una cadena es fórmula si empieza por un solo «=». */
export function esFormula(x) {
  return typeof x === 'string' && x.startsWith('=') && !x.startsWith('==');
}

/** Texto escapado: «==hola» es el texto «=hola». */
export function desescapar(x) {
  return typeof x === 'string' && x.startsWith('==') ? x.slice(1) : x;
}

// ---------- paradas ----------

class Parada extends Error {
  constructor(estado, motivo, parcial) {
    super(motivo);
    this.estado = estado;
    if (parcial !== undefined) this.parcial = parcial;
  }
}

const limite = (motivo, parcial) => new Parada('PENDIENTE POR LÍMITE', motivo, parcial);

/** Si la parada es por límite y aún no dice cuánto se examinó, se lo añade. */
function conParcial(e, parcial) {
  if (e instanceof Parada && e.estado === 'PENDIENTE POR LÍMITE' && e.parcial === undefined) e.parcial = parcial;
  return e;
}

// ---------- léxico y sintaxis ----------

// Letras de cualquier alfabeto en identificadores y unidades: «día» y «año» son unidades de T.
const RE_TOKEN = /\s*(?:(\d+(?:\.\d+)?)|("(?:[^"\\]|\\.)*")|([\p{L}_][\p{L}\p{N}_€$%]*|[€$%])|(<>|<=|>=|[()+\-*/,=<>]))/uy;

function tokenizar(src) {
  const tokens = [];
  let pos = 0;
  while (pos < src.length) {
    RE_TOKEN.lastIndex = pos;
    const m = RE_TOKEN.exec(src);
    if (!m) {
      if (/^\s*$/.test(src.slice(pos))) break;
      throw new SyntaxError('carácter inesperado en ' + pos + ': ' + src.slice(pos, pos + 8));
    }
    pos = RE_TOKEN.lastIndex;
    if (m[1] !== undefined) tokens.push({ t: 'num', v: Number(m[1]) });
    else if (m[2] !== undefined) tokens.push({ t: 'str', v: JSON.parse(m[2]) });
    else if (m[3] !== undefined) tokens.push({ t: 'id', v: m[3] });
    else tokens.push({ t: 'op', v: m[4] });
  }
  return tokens;
}

/**
 * Analiza la fórmula (sin el «=») y devuelve un árbol. Lanza SyntaxError; si
 * la anidación (paréntesis, funciones, signos) pasa de `profundidad` niveles,
 * lanza un Error con estado «PENDIENTE POR LÍMITE».
 */
export function analizar(src, { profundidad = LIMITES.profundidad } = {}) {
  const tokens = tokenizar(src);
  let i = 0;
  let nivel = 0;
  const entrar = () => { if (++nivel > profundidad) throw limite('fórmula anidada más de ' + profundidad + ' niveles'); };
  const salir = () => { nivel--; };
  const mirar = () => tokens[i];
  const esOp = (...vs) => mirar() && mirar().t === 'op' && vs.includes(mirar().v);
  const tomar = (t, v) => {
    const k = tokens[i];
    if (!k || k.t !== t || (v !== undefined && k.v !== v)) throw new SyntaxError('se esperaba ' + (v ?? t) + ' en el token ' + i);
    i++;
    return k;
  };
  function comparacion() {
    const izq = expr();
    if (esOp('=', '<>', '<', '>', '<=', '>=')) {
      const op = tomar('op').v;
      return { tipo: 'cmp', op, izq, der: expr() };
    }
    return izq;
  }
  function expr() {
    let izq = termino();
    while (esOp('+', '-')) {
      const op = tomar('op').v;
      izq = { tipo: 'bin', op, izq, der: termino() };
    }
    return izq;
  }
  function termino() {
    let izq = factor();
    while (esOp('*', '/')) {
      const op = tomar('op').v;
      izq = { tipo: 'bin', op, izq, der: factor() };
    }
    return izq;
  }
  function factor() {
    const k = mirar();
    if (!k) throw new SyntaxError('fórmula incompleta');
    if (k.t === 'op' && k.v === '-') { tomar('op'); entrar(); const e = { tipo: 'neg', arg: factor() }; salir(); return e; }
    if (k.t === 'op' && k.v === '(') { tomar('op'); entrar(); const e = comparacion(); salir(); tomar('op', ')'); return e; }
    if (k.t === 'num') {
      tomar('num');
      const u = mirar();
      if (u && u.t === 'id' && !(tokens[i + 1] && tokens[i + 1].t === 'op' && tokens[i + 1].v === '(')) {
        tomar('id');
        return { tipo: 'mag', cantidad: k.v, unidad: u.v };
      }
      return { tipo: 'num', v: k.v };
    }
    if (k.t === 'str') { tomar('str'); return { tipo: 'str', v: k.v }; }
    if (k.t === 'id') {
      tomar('id');
      if (esOp('(')) {
        tomar('op');
        entrar();
        const args = [];
        if (!esOp(')')) {
          args.push(comparacion());
          while (esOp(',')) { tomar('op'); args.push(comparacion()); }
        }
        salir();
        tomar('op', ')');
        return { tipo: 'fn', nombre: k.v.toUpperCase(), args };
      }
      throw new SyntaxError('identificador suelto: ' + k.v);
    }
    throw new SyntaxError('token inesperado: ' + k.v);
  }
  const arbol = comparacion();
  if (i < tokens.length) throw new SyntaxError('sobra: ' + tokens[i].v);
  return arbol;
}

// ---------- valores ----------

const num = (v) => ({ tipo: 'numero', valor: v });
const mag = (cantidad, unidad, desglose) => ({ tipo: 'magnitud', cantidad, unidad, desglose: desglose ?? [{ cantidad, unidad }] });
const texto = (v) => ({ tipo: 'texto', valor: v });
const bool = (v) => ({ tipo: 'booleano', valor: v });
const comp = (partes) => ({ tipo: 'composicion', partes });
const col = (items) => ({ tipo: 'coleccion', items });

const ESCALARES = Object.freeze(['numero', 'magnitud', 'texto', 'booleano']);
const RE_MAGNITUD_SLOT = /^(?:(-?\d+(?:\.\d+)?)\s*([\p{L}€$%][\p{L}\p{N}_€$%]*)|([\p{L}€$%][\p{L}\p{N}_€$%]*)\s*(-?\d+(?:\.\d+)?))$/u;

/** Convierte el contenido crudo de un slot en valor BQL. */
function valorDe(contenido) {
  if (contenido === undefined) throw new Parada('PENDIENTE', 'posición sin desarrollar');
  if (typeof contenido === 'number') return num(contenido);
  if (Array.isArray(contenido)) return { tipo: 'array', valor: contenido };
  if (esReferencia(contenido)) return { tipo: 'referencia', valor: contenido };
  const s = desescapar(contenido);
  if (esDireccion(s)) return texto(s); // un texto de diez dígitos es una dirección, no un número
  const m = RE_MAGNITUD_SLOT.exec(s.trim());
  if (m) return m[1] !== undefined ? mag(Number(m[1]), m[2]) : mag(Number(m[4]), m[3]);
  if (/^-?\d+(?:\.\d+)?$/.test(s.trim())) return num(Number(s));
  return texto(s);
}

function describir(v) {
  return v.tipo === 'magnitud' ? 'magnitud en ' + v.unidad : v.tipo;
}

/**
 * Suma (o resta, con signo -1). Misma unidad: una magnitud con el desglose
 * de los DOS operandos, sumando a sumando; unidades distintas: composición.
 * Los dos lados se tratan igual: el derecho conserva su desglose como el
 * izquierdo (al restar, cada sumando del derecho cambia de signo).
 */
function sumar(a, b, signo = 1) {
  if (a.tipo === 'numero' && b.tipo === 'numero') return num(a.valor + signo * b.valor);
  const partesDe = (v) => (v.tipo === 'composicion' ? v.partes : v.tipo === 'magnitud' ? [v] : null);
  const pa = partesDe(a);
  const pb = partesDe(b);
  if (pa && pb) {
    const desgloseDe = (p, s) => (p.desglose ?? [{ cantidad: p.cantidad, unidad: p.unidad }]).map((d) => ({ cantidad: s * d.cantidad, unidad: d.unidad }));
    const partes = pa.map((p) => ({ ...p, desglose: desgloseDe(p, 1) }));
    for (const q of pb) {
      const sumandos = desgloseDe(q, signo);
      const misma = partes.find((p) => p.unidad === q.unidad);
      if (misma) {
        misma.cantidad += signo * q.cantidad;
        misma.desglose.push(...sumandos);
      } else {
        partes.push(mag(signo * q.cantidad, q.unidad, sumandos));
      }
    }
    return partes.length === 1 ? partes[0] : comp(partes);
  }
  throw new Parada('INCOMPATIBLE', describir(a) + ' y ' + describir(b) + ' no se suman');
}

function multiplicar(a, b, op) {
  if (a.tipo === 'numero' && b.tipo === 'numero') return num(op === '*' ? a.valor * b.valor : a.valor / b.valor);
  if (op === '*' && a.tipo === 'numero' && b.tipo === 'magnitud') return mag(a.valor * b.cantidad, b.unidad);
  if (a.tipo === 'magnitud' && b.tipo === 'numero') return mag(op === '*' ? a.cantidad * b.valor : a.cantidad / b.valor, a.unidad);
  throw new Parada('INCOMPATIBLE', describir(a) + ' y ' + describir(b) + ' no se ' + (op === '*' ? 'multiplican' : 'dividen'));
}

/**
 * Compara dos escalares del mismo tipo (y, si son magnitudes, de la misma
 * unidad). Cualquier otra pareja es INCOMPATIBLE, también con «=» y «<>»:
 * antes de operar se validan tipos y dimensiones.
 */
function comparar(a, b, op) {
  if (a.tipo !== b.tipo || !ESCALARES.includes(a.tipo) || (a.tipo === 'magnitud' && a.unidad !== b.unidad)) {
    throw new Parada('INCOMPATIBLE', describir(a) + ' y ' + describir(b) + ' no se comparan');
  }
  const x = a.tipo === 'magnitud' ? a.cantidad : a.valor;
  const y = b.tipo === 'magnitud' ? b.cantidad : b.valor;
  switch (op) {
    case '=': return bool(x === y);
    case '<>': return bool(x !== y);
    case '<': return bool(x < y);
    case '>': return bool(x > y);
    case '<=': return bool(x <= y);
    case '>=': return bool(x >= y);
    default: throw new Parada('ERROR', 'comparación desconocida');
  }
}

function exigirBool(v, donde) {
  if (!v) throw new Parada('ERROR', donde + ' espera un argumento');
  if (v.tipo !== 'booleano') throw new Parada('INCOMPATIBLE', donde + ' espera verdadero o falso, no ' + describir(v));
  return v.valor;
}

function exigirColeccion(v, donde) {
  if (!v) throw new Parada('ERROR', donde + ' espera una colección');
  if (v.tipo !== 'coleccion') throw new Parada('INCOMPATIBLE', donde + ' espera una colección, no ' + describir(v));
  return v;
}

/** Cantidad máxima de candidatos: entero ≥ 1, 1 si falta. Nunca es profundidad. */
function cantidadDe(arg, nombre) {
  if (arg === undefined) return 1;
  if (arg.tipo !== 'numero' || !Number.isInteger(arg.valor) || arg.valor < 1) throw new Parada('ERROR', nombre + ' espera una cantidad entera ≥ 1');
  return arg.valor;
}

// ---------- evaluación ----------

function contexto(eje, opciones = {}) {
  const limites = { ...LIMITES, ...(opciones.limites ?? {}) };
  return {
    eje,
    pila: new Set(),
    dependencias: new Set(),
    limites,
    presupuesto: limites.presupuesto,
    actual: null,
    puedeLeer: typeof opciones.puedeLeer === 'function' ? opciones.puedeLeer : null,
  };
}

/**
 * El gancho de autorización, si lo hay, decide cada lectura: recibe el id,
 * la dirección de diez dígitos y el camino exacto de índices (la dirección
 * sola no distingue la raíz [] de la posición [0]). Sin gancho, todo se lee.
 * `que` sustituye la descripción del motivo cuando nombrar el id expondría
 * lo que no se ha autorizado (un escrito ajeno).
 */
function autorizar(ctx, evId, indices, que) {
  if (!ctx.puedeLeer) return;
  const dir = direccion(indices);
  if (!ctx.puedeLeer(evId, dir, [...indices])) {
    const lugar = que ?? 'leer ' + evId.slice(0, 8) + ':' + dir + ' (camino ' + (indices.length ? indices.join('.') : 'raíz') + ')';
    throw new Parada('PENDIENTE DE AUTORIZACIÓN', lugar + ' exige una autorización que no hay');
  }
}

/**
 * Antes de exponer un ocupante de BUSCAR (su id, autor, t y procedencia), el
 * gancho decide por su camino exacto; si llega por referencia, por cada
 * salto de la cadena. Un escrito ajeno no autorizado no se nombra.
 */
function autorizarOcupante(ctx, o, evId, dir) {
  if (!ctx.puedeLeer) return;
  if (o.origen === 'propio') return autorizar(ctx, o.evento, o.camino);
  if (o.origen === 'escrito') return autorizar(ctx, o.evento, [], 'leer un escrito anclado en ' + evId.slice(0, 8) + ':' + dir);
  for (const s of o.saltos ?? []) autorizar(ctx, s.evento, s.indices);
}

/** Contenido crudo de una posición. Evento que no está en el eje → PENDIENTE (puede llegar). */
function leerPosicion(ctx, evId, indices) {
  const ev = ctx.eje.obtener(evId);
  if (!ev) throw new Parada('PENDIENTE', 'evento ausente del eje: ' + evId.slice(0, 8));
  autorizar(ctx, evId, indices);
  let nodo = ev.payload;
  for (const i of indices) {
    if (!Array.isArray(nodo)) return undefined;
    nodo = nodo[i];
  }
  return nodo;
}

/**
 * Lee un slot como valor. Si contiene una fórmula la evalúa; si contiene una
 * referencia la sigue. Toda lectura queda en las dependencias, también la de
 * un literal. Fórmulas y referencias entran en la pila: volver a un slot que
 * se está leyendo es un ciclo (ERROR); más de `limites.profundidad` lecturas
 * encadenadas es PENDIENTE POR LÍMITE.
 */
function leerSlot(ctx, evId, indices) {
  if (indices.length > ARIDAD) throw new Parada('PENDIENTE', 'posición sin desarrollar: más de diez profundidades');
  const clave = evId + ':' + direccion(indices);
  ctx.dependencias.add(clave);
  const contenido = leerPosicion(ctx, evId, indices);
  if (!esFormula(contenido) && !esReferencia(contenido)) return valorDe(contenido);
  if (ctx.pila.has(clave)) throw new Parada('ERROR', 'ciclo en ' + evId.slice(0, 8) + ':' + direccion(indices));
  if (ctx.pila.size >= ctx.limites.profundidad) throw limite('más de ' + ctx.limites.profundidad + ' lecturas encadenadas');
  ctx.pila.add(clave);
  const actualGuardado = ctx.actual;
  ctx.actual = null; // una fórmula ajena no hereda nuestro candidato
  try {
    if (esReferencia(contenido)) return leerSlot(ctx, contenido.ref, contenido.dir ? indicesDe(contenido.dir) : []);
    return evaluarArbol(ctx, analizar(contenido.slice(1), ctx.limites), evId, indices);
  } finally {
    ctx.pila.delete(clave);
    ctx.actual = actualGuardado;
  }
}

/** Id de un evento a partir de un id o prefijo. Ninguno → PENDIENTE (puede llegar); varios o mal formado → ERROR. */
function resolverId(ctx, v) {
  const p = String(v.valor ?? v).replace(/^@/, '').toLowerCase();
  if (!/^[0-9a-f]+$/.test(p)) throw new Parada('ERROR', 'referencia mal formada: ' + p);
  const ids = ctx.eje.orden.filter((id) => id.startsWith(p));
  if (ids.length === 1) return ids[0];
  if (ids.length > 1) throw new Parada('ERROR', 'referencia ambigua: ' + p);
  throw new Parada('PENDIENTE', 'referencia ausente del eje: ' + p);
}

/**
 * Candidatos que ocupan una posición del registro, como colección BQL. Con
 * `exacto` (un índice), solo los del camino exacto; sin él (una dirección),
 * la colisión entera (mapa §12 [D]). Cada ocupante pasa por el gancho de
 * autorización antes de exponerse. Más de `limites.candidatos` → PENDIENTE
 * POR LÍMITE: no se presenta como completo lo que no se examinó entero.
 */
function buscar(ctx, evId, indices, { exacto }) {
  if (!ctx.eje.obtener(evId)) throw new Parada('PENDIENTE', 'evento ausente del eje: ' + evId.slice(0, 8));
  if (indices.length > ARIDAD) throw new Parada('PENDIENTE', 'posición sin desarrollar: más de diez profundidades');
  const dir = direccion(indices);
  autorizar(ctx, evId, indices);
  // Orden por defecto: el del encaje (coincidencias de ruta, luego llegada). ORDENAR lo discute.
  const lista = ocupantes(ctx.eje, evId, indices, { exacto });
  for (const o of lista) autorizarOcupante(ctx, o, evId, dir);
  const items = lista.map((o) => ({
    origen: o.origen, evento: o.evento, indices: o.camino ?? indicesDe(o.dir), procedencia: o.procedencia, autor: o.autor, t: o.t,
    vector: o.vector, distancia: o.distancia, acuerdo: o.acuerdo, signo: o.signo, faltas: o.faltas, excedentes: o.excedentes, origenDir: o.origenDir, destino: o.destino,
  }));
  const tope = ctx.limites.candidatos;
  if (items.length > tope) throw limite('más de ' + tope + ' candidatos en ' + evId.slice(0, 8) + ':' + dir, { examinados: tope, de: items.length });
  return col(items);
}

/** Valor de un candidato, o de su subposición k... (leyendo fórmulas si las hay). */
function valorCandidato(ctx, item, sub = []) {
  return leerSlot(ctx, item.evento, [...item.indices, ...sub]);
}

/** Evalúa fn con el candidato como ámbito de ACTUAL y lo restituye al salir. */
function conCandidato(ctx, item, fn) {
  const guardado = ctx.actual;
  ctx.actual = item;
  try { return fn(); } finally { ctx.actual = guardado; }
}

/** Recorre los candidatos; si uno agota un límite, la parada dice cuántos se examinaron. */
function porCandidato(c, fn) {
  c.items.forEach((item, k) => {
    try { fn(item); } catch (e) { throw conParcial(e, { examinados: k, de: c.items.length }); }
  });
}

function indicesDeArgs(args, nombre) {
  if (args.some((a) => a.tipo !== 'numero' || !Number.isInteger(a.valor) || a.valor < 0 || a.valor > 9)) {
    throw new Parada('ERROR', nombre + ' espera índices 0–9');
  }
  return args.map((a) => a.valor);
}

function evaluarArbol(ctx, nodo, evId, base) {
  if (--ctx.presupuesto < 0) throw limite('presupuesto de cálculo agotado: más de ' + ctx.limites.presupuesto + ' pasos');
  switch (nodo.tipo) {
    case 'num': return num(nodo.v);
    case 'str': return texto(nodo.v);
    case 'mag': return mag(nodo.cantidad, nodo.unidad);
    case 'neg': {
      const v = evaluarArbol(ctx, nodo.arg, evId, base);
      if (v.tipo === 'numero') return num(-v.valor);
      if (v.tipo === 'magnitud') return mag(-v.cantidad, v.unidad);
      throw new Parada('INCOMPATIBLE', 'no se niega ' + describir(v));
    }
    case 'bin': {
      const a = evaluarArbol(ctx, nodo.izq, evId, base);
      const b = evaluarArbol(ctx, nodo.der, evId, base);
      if (nodo.op === '+') return sumar(a, b, 1);
      if (nodo.op === '-') return sumar(a, b, -1);
      return multiplicar(a, b, nodo.op);
    }
    case 'cmp': return comparar(evaluarArbol(ctx, nodo.izq, evId, base), evaluarArbol(ctx, nodo.der, evId, base), nodo.op);
    case 'fn': return funcion(ctx, nodo, evId, base);
    default: throw new Parada('ERROR', 'nodo desconocido');
  }
}

function funcion(ctx, nodo, evId, base) {
  if (SOLO_DENTRO.includes(nodo.nombre) && !ctx.actual) throw new Parada('ERROR', nodo.nombre + ' solo dentro de FILTRAR u ORDENAR');
  const perezosos = PEREZOSAS[nodo.nombre] ?? [];
  const args = nodo.args.map((a, k) => (perezosos.includes(k) ? a : evaluarArbol(ctx, a, evId, base)));
  const anfitrion = base.slice(0, -1); // la décupla del slot, en su profundidad
  switch (nodo.nombre) {
    case 'LOCAL': {
      if (!args.length) throw new Parada('ERROR', 'LOCAL espera al menos un índice');
      return leerSlot(ctx, evId, [...anfitrion, ...indicesDeArgs(args, 'LOCAL')]);
    }
    case 'REF': {
      if (!args.length || args[0].tipo !== 'texto') throw new Parada('ERROR', 'REF espera un id entre comillas');
      let idx = [];
      if (args[1]) {
        if (args[1].tipo !== 'texto' || !esDireccion(args[1].valor)) throw new Parada('ERROR', 'REF espera una dirección de diez dígitos');
        idx = indicesDe(args[1].valor);
      }
      return leerSlot(ctx, resolverId(ctx, args[0]), idx);
    }
    case 'BUSCAR': {
      if (!args.length) throw new Parada('ERROR', 'BUSCAR espera una posición');
      // Un texto de diez dígitos es dirección (absoluta en el registro); números, índices relativos al anfitrión.
      if (args[0].tipo === 'texto') {
        if (args.length > 1 || !esDireccion(args[0].valor)) throw new Parada('ERROR', 'BUSCAR espera índices 0–9 o una dirección de diez dígitos');
        return buscar(ctx, evId, indicesDe(args[0].valor), { exacto: false }); // dirección: la colisión entera
      }
      return buscar(ctx, evId, [...anfitrion, ...indicesDeArgs(args, 'BUSCAR')], { exacto: true }); // índice: camino exacto
    }
    case 'ACTUAL': {
      if (args.length > 2) throw new Parada('ERROR', 'ACTUAL espera una posición y, si acaso, una cantidad');
      const cantidad = cantidadDe(args[1], 'ACTUAL');
      if (ctx.actual) {
        if (!args.length) return valorCandidato(ctx, ctx.actual);
        const [pv] = indicesDeArgs([args[0]], 'ACTUAL');
        if (cantidad > 1) throw new Parada('PENDIENTE', 'ACTUAL(' + pv + ', ' + cantidad + ') dentro de FILTRAR u ORDENAR: la cantidad mayor que 1 en un ámbito de un solo candidato no está definida');
        return valorCandidato(ctx, ctx.actual, [pv]);
      }
      if (!args.length) throw new Parada('PENDIENTE', 'ACTUAL sin ámbito activo: no hay candidato ni posición de la que leer');
      const c = buscar(ctx, evId, [...anfitrion, ...indicesDeArgs([args[0]], 'ACTUAL')], { exacto: true });
      if (!c.items.length) throw new Parada('PENDIENTE', 'sin candidatos en la posición ' + args[0].valor);
      return cantidad === 1 ? valorCandidato(ctx, c.items[0]) : col(c.items.slice(0, cantidad));
    }
    case 'FILTRAR': {
      const c = exigirColeccion(args[0], 'FILTRAR');
      if (!nodo.args[1]) throw new Parada('ERROR', 'FILTRAR espera una condición');
      const items = [];
      porCandidato(c, (item) => {
        if (conCandidato(ctx, item, () => exigirBool(evaluarArbol(ctx, nodo.args[1], evId, base), 'FILTRAR'))) items.push(item);
      });
      return col(items);
    }
    case 'ORDENAR': {
      const c = exigirColeccion(args[0], 'ORDENAR');
      if (!nodo.args[1]) throw new Parada('ERROR', 'ORDENAR espera una expresión');
      const desc = args[2] && args[2].tipo === 'texto' && args[2].valor.toLowerCase() === 'desc';
      const claves = [];
      porCandidato(c, (item) => {
        const v = conCandidato(ctx, item, () => evaluarArbol(ctx, nodo.args[1], evId, base));
        if (!ESCALARES.includes(v.tipo)) throw new Parada('INCOMPATIBLE', 'ORDENAR no ordena por ' + describir(v));
        claves.push({ item, k: v.tipo === 'magnitud' ? v.cantidad : v.valor, firma: describir(v) });
      });
      const firmas = [...new Set(claves.map((x) => x.firma))];
      if (firmas.length > 1) throw new Parada('INCOMPATIBLE', 'ORDENAR con claves de tipos distintos: ' + firmas.join(', '));
      claves.sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0) * (desc ? -1 : 1));
      return col(claves.map((x) => x.item));
    }
    case 'ELEGIR': {
      const c = exigirColeccion(args[0], 'ELEGIR');
      return col(c.items.slice(0, cantidadDe(args[1], 'ELEGIR')));
    }
    case 'ORIGEN': return texto(ctx.actual.origen);
    case 'SIGNO': return texto(ctx.actual.signo ?? 'exacto');
    case 'FALTAS': return num(ctx.actual.faltas ?? 0);
    case 'EXCEDENTES': return num(ctx.actual.excedentes ?? 0);
    case 'ACUERDO': return num(ctx.actual.acuerdo ?? 10);
    case 'DESPLAZAMIENTO': return num((ctx.actual.vector ?? []).reduce((s, x) => s + Math.abs(x), 0));
    case 'CONTAR': return num(exigirColeccion(args[0], 'CONTAR').items.length);
    case 'SUMAR': {
      const c = exigirColeccion(args[0], 'SUMAR');
      let acc = null;
      porCandidato(c, (item) => {
        const v = valorCandidato(ctx, item);
        acc = acc === null ? v : sumar(acc, v);
      });
      return acc ?? num(0);
    }
    case 'Y': return bool(args.every((a) => exigirBool(a, 'Y')));
    case 'O': return bool(args.some((a) => exigirBool(a, 'O')));
    case 'NO': return bool(!exigirBool(args[0], 'NO'));
    default: throw new Parada('ERROR', 'función desconocida: ' + nodo.nombre);
  }
}

/** Ejecuta fn y lo convierte en Resultado. Una parada, un error de sintaxis o la pila de JavaScript agotada no se escapan. */
function resultado(ctx, fn) {
  try {
    const valor = fn();
    return { estado: 'RESUELTO', valor, texto: formato(valor), dependencias: [...ctx.dependencias] };
  } catch (e) {
    const parada = (estado, motivo, parcial) => ({ estado, motivo, ...(parcial !== undefined ? { parcial } : {}), texto: estado + ': ' + motivo, dependencias: [...ctx.dependencias] });
    if (e instanceof Parada) return parada(e.estado, e.message, e.parcial);
    if (e instanceof SyntaxError) return { ...parada('ERROR', e.message), dependencias: [] };
    if (e instanceof RangeError && /call stack/i.test(e.message)) return parada('PENDIENTE POR LÍMITE', 'profundidad de cálculo agotada');
    throw e;
  }
}

/**
 * Evalúa el slot (evId, dir) del eje. Siempre devuelve
 * { estado, valor?, motivo?, parcial?, texto, dependencias }. Nunca tiene efectos.
 * opciones: { puedeLeer(evId, dir, indices) → boolean, limites: { presupuesto, profundidad, candidatos } }.
 */
export function evaluar(eje, evId, dir, opciones) {
  const indices = Array.isArray(dir) ? dir : indicesDe(dir);
  const ctx = contexto(eje, opciones);
  return resultado(ctx, () => {
    if (indices.length > ARIDAD) throw new Parada('PENDIENTE', 'posición sin desarrollar: más de diez profundidades');
    const contenido = leerPosicion(ctx, evId, indices);
    return esFormula(contenido) ? leerSlot(ctx, evId, indices) : valorDe(contenido);
  });
}

/** Evalúa una fórmula suelta (con o sin «=») en el contexto de un slot. Para consultas desde fuera. Mismas opciones que evaluar. */
export function consultar(eje, evId, dir, formula, opciones) {
  const indices = Array.isArray(dir) ? dir : indicesDe(dir);
  const ctx = contexto(eje, opciones);
  return resultado(ctx, () => evaluarArbol(ctx, analizar(String(formula).replace(/^=/, ''), ctx.limites), evId, indices));
}

const redondear = (n) => Math.round(n * 1000) / 1000;

/** Texto de un valor: «250 m», «200 m + 5 EUR», «14 EUR (12 EUR + 2 EUR)», «3 candidatos». */
export function formato(v) {
  switch (v.tipo) {
    case 'numero': return String(redondear(v.valor));
    case 'texto': return v.valor;
    case 'booleano': return v.valor ? 'verdadero' : 'falso';
    case 'magnitud': {
      const base = redondear(v.cantidad) + ' ' + v.unidad;
      const d = v.desglose ?? [];
      return d.length > 1 ? base + ' (' + d.map((x) => redondear(x.cantidad) + ' ' + x.unidad).join(' + ') + ')' : base;
    }
    case 'composicion': return v.partes.map(formato).join(' + ');
    case 'array': return '[' + v.valor.length + ' posiciones]';
    case 'referencia': return '→ ' + v.valor.ref.slice(0, 8);
    case 'coleccion': return v.items.length + (v.items.length === 1 ? ' candidato' : ' candidatos') + (v.items.length ? ': ' + v.items.map((i) => i.origen + ' ' + i.evento.slice(0, 8)).join(' · ') : '');
    default: return '?';
  }
}
