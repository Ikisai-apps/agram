// BQL V0: fórmulas dentro de un slot BTML. Convención: una cadena que empieza
// por «=» es fórmula; «==» escapa un texto que empieza por «=». No hay árbol
// BQL aparte: la posición del slot da el significado. Las consultas no tienen
// efectos. Evaluación segura: pila de dependencias (ciclos), presupuesto.
//
//   =LOCAL(n, ...)          lee la décupla anfitriona: posición n (índices anidados opcionales)
//   =REF(id, dir?)          lee otro evento (id o prefijo), subposición de diez dígitos opcional
//   = 12 EUR + 2 EUR        magnitudes: misma unidad se suma conservando el desglose
//   = 12 EUR + 5 min        unidades distintas: composición heterogénea, operandos preservados
//   =BUSCAR(n)              candidatos que ocupan la posición n del anfitrión (encaje), sin registrar ganador
//   =FILTRAR(col, cond)     cond se evalúa por candidato; dentro, ACTUAL es el candidato y LOCAL sigue siendo el anfitrión
//   =ORDENAR(col, expr, "desc"?)   ordena por expr evaluada en cada candidato
//   =ELEGIR(col, k?)        los k primeros (1 por defecto); no publica nada
//   =ACTUAL(pv, cantidad?)  fuera de FILTRAR: la colección activa de la posición pv, limitada a cantidad (1 por defecto)
//   =ORIGEN()               dentro de FILTRAR/ORDENAR: procedencia del candidato («propio», «referencia», «escrito»)
//   =ACUERDO() =DESPLAZAMIENTO() =SIGNO() =FALTAS() =EXCEDENTES()   el encaje del candidato: profundidades de acuerdo, suma de distancias, signo (exacto/completar/reducir/mixto), faltas y excedentes
//   =CONTAR(col) =SUMAR(col)
//   comparaciones  = <> < > <= >=   y   Y(a, b)  O(a, b)  NO(a)
//
// Estados: RESUELTO, PENDIENTE (falta algo por desarrollar), INCOMPATIBLE
// (tipos que no operan), ERROR (sintaxis, función desconocida, ciclo, presupuesto).

import { ARIDAD, esReferencia, esDireccion, indicesDe, direccion } from './btml.js';
import { ocupantes } from './encaje.js';

export const ESTADOS = Object.freeze(['RESUELTO', 'PENDIENTE', 'INCOMPATIBLE', 'ERROR']);
const PRESUPUESTO = 2000;
const PEREZOSAS = Object.freeze({ FILTRAR: [1], ORDENAR: [1] }); // argumentos que se evalúan por candidato

/** Una cadena es fórmula si empieza por un solo «=». */
export function esFormula(x) {
  return typeof x === 'string' && x.startsWith('=') && !x.startsWith('==');
}

/** Texto escapado: «==hola» es el texto «=hola». */
export function desescapar(x) {
  return typeof x === 'string' && x.startsWith('==') ? x.slice(1) : x;
}

// ---------- léxico y sintaxis ----------

const RE_TOKEN = /\s*(?:(\d+(?:\.\d+)?)|("(?:[^"\\]|\\.)*")|([A-Za-z_][\w€$%]*|[€$%])|(<>|<=|>=|[()+\-*/,=<>]))/y;

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

/** Analiza la fórmula (sin el «=») y devuelve un árbol. */
export function analizar(src) {
  const tokens = tokenizar(src);
  let i = 0;
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
    if (k.t === 'op' && k.v === '-') { tomar('op'); return { tipo: 'neg', arg: factor() }; }
    if (k.t === 'op' && k.v === '(') { tomar('op'); const e = comparacion(); tomar('op', ')'); return e; }
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
        const args = [];
        if (!esOp(')')) {
          args.push(comparacion());
          while (esOp(',')) { tomar('op'); args.push(comparacion()); }
        }
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

class Parada extends Error {
  constructor(estado, motivo) { super(motivo); this.estado = estado; }
}

/** Convierte el contenido crudo de un slot en valor BQL. */
function valorDe(contenido) {
  if (contenido === undefined) throw new Parada('PENDIENTE', 'posición sin desarrollar');
  if (typeof contenido === 'number') return num(contenido);
  if (Array.isArray(contenido)) return { tipo: 'array', valor: contenido };
  if (esReferencia(contenido)) return { tipo: 'referencia', valor: contenido };
  const s = desescapar(contenido);
  const m = /^(?:(-?\d+(?:\.\d+)?)\s*([A-Za-z€$%][\w€$%]*)|([A-Za-z€$%][\w€$%]*)\s*(-?\d+(?:\.\d+)?))$/.exec(s.trim());
  if (m) return m[1] !== undefined ? mag(Number(m[1]), m[2]) : mag(Number(m[4]), m[3]);
  if (/^-?\d+(?:\.\d+)?$/.test(s.trim())) return num(Number(s));
  return texto(s);
}

function describir(v) {
  return v.tipo === 'magnitud' ? 'magnitud en ' + v.unidad : v.tipo;
}

function sumar(a, b, signo = 1) {
  if (a.tipo === 'numero' && b.tipo === 'numero') return num(a.valor + signo * b.valor);
  const partesDe = (v) => (v.tipo === 'composicion' ? v.partes : v.tipo === 'magnitud' ? [v] : null);
  const pa = partesDe(a);
  const pb = partesDe(b);
  if (pa && pb) {
    const partes = pa.map((p) => ({ ...p, desglose: [...(p.desglose ?? [{ cantidad: p.cantidad, unidad: p.unidad }])] }));
    for (const q of pb) {
      const qq = { cantidad: signo * q.cantidad, unidad: q.unidad };
      const misma = partes.find((p) => p.unidad === q.unidad);
      if (misma) {
        misma.cantidad += qq.cantidad;
        misma.desglose.push(qq);
      } else {
        partes.push(mag(qq.cantidad, qq.unidad));
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

function comparar(a, b, op) {
  let x;
  let y;
  if (a.tipo === 'numero' && b.tipo === 'numero') { x = a.valor; y = b.valor; }
  else if (a.tipo === 'magnitud' && b.tipo === 'magnitud' && a.unidad === b.unidad) { x = a.cantidad; y = b.cantidad; }
  else if (a.tipo === 'texto' && b.tipo === 'texto') { x = a.valor; y = b.valor; }
  else if (a.tipo === 'booleano' && b.tipo === 'booleano') { x = a.valor; y = b.valor; }
  else if (op === '=' || op === '<>') { const iguales = formato(a) === formato(b); return bool(op === '=' ? iguales : !iguales); }
  else throw new Parada('INCOMPATIBLE', describir(a) + ' y ' + describir(b) + ' no se comparan');
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
  if (v === undefined) throw new Parada('ERROR', donde + ' espera un argumento');
  if (v.tipo !== 'booleano') throw new Parada('INCOMPATIBLE', donde + ' espera verdadero o falso, no ' + describir(v));
  return v.valor;
}

function exigirColeccion(v, donde) {
  if (v === undefined) throw new Parada('ERROR', donde + ' espera un argumento');
  if (v.tipo !== 'coleccion') throw new Parada('INCOMPATIBLE', donde + ' espera una colección, no ' + describir(v));
  return v;
}

// ---------- evaluación ----------

function leerPosicion(ctx, evId, indices) {
  const ev = ctx.eje.obtener(evId);
  if (!ev) throw new Parada('ERROR', 'evento desconocido: ' + evId.slice(0, 8));
  let nodo = ev.payload;
  for (const i of indices) {
    if (!Array.isArray(nodo)) return undefined;
    nodo = nodo[i];
  }
  return nodo;
}

/** Lee un slot como valor; si contiene una fórmula, la evalúa (con pila de ciclos). */
function leerSlot(ctx, evId, indices) {
  const contenido = leerPosicion(ctx, evId, indices);
  if (esFormula(contenido)) {
    exigirDireccion(indices);
    const clave = evId + ':' + direccion(indices);
    if (ctx.pila.has(clave)) throw new Parada('ERROR', 'ciclo en ' + evId.slice(0, 8) + ':' + direccion(indices));
    ctx.pila.add(clave);
    const actualGuardado = ctx.actual;
    ctx.actual = null; // una fórmula ajena no hereda nuestro candidato
    try {
      const r = evaluarArbol(ctx, analizar(contenido.slice(1)), evId, indices);
      ctx.dependencias.add(clave);
      return r;
    } finally {
      ctx.pila.delete(clave);
      ctx.actual = actualGuardado;
    }
  }
  if (esReferencia(contenido)) {
    const idx = contenido.dir ? indicesDe(contenido.dir) : [];
    ctx.dependencias.add(contenido.ref + ':' + direccion(idx));
    return leerSlot(ctx, contenido.ref, idx);
  }
  return valorDe(contenido);
}

function resolverId(ctx, v) {
  const p = String(v.valor ?? v).replace(/^@/, '');
  const ids = ctx.eje.orden.filter((id) => id.startsWith(p));
  if (ids.length === 1) return ids[0];
  throw new Parada('ERROR', ids.length ? 'referencia ambigua: ' + p : 'referencia desconocida: ' + p);
}

/**
 * Una posición con más de diez profundidades no tiene dirección (no se
 * concatena un undécimo dígito): ni se busca en ella ni se evalúa una fórmula
 * que esté allí. Es un ERROR del slot, no una excepción.
 */
function exigirDireccion(indices) {
  if (indices.length > ARIDAD) throw new Parada('ERROR', 'más de ' + ARIDAD + ' profundidades: la posición no tiene dirección');
}

/** Candidatos que ocupan una posición del anfitrión, como colección BQL. */
function buscar(ctx, evId, indices) {
  exigirDireccion(indices);
  // Orden por defecto: el del encaje (exactos, luego acuerdo, luego desplazamiento). ORDENAR lo discute.
  const items = ocupantes(ctx.eje, evId, indices).map((o) => ({
    origen: o.origen, evento: o.evento, indices: o.camino ?? indicesDe(o.dir), procedencia: o.procedencia, autor: o.autor, t: o.t,
    vector: o.vector, distancia: o.distancia, acuerdo: o.acuerdo, signo: o.signo, faltas: o.faltas, excedentes: o.excedentes, origenDir: o.origenDir, destino: o.destino,
  }));
  return col(items);
}

/** Valor de un candidato, o de su subposición k... (leyendo fórmulas si las hay). */
function valorCandidato(ctx, item, sub = []) {
  return leerSlot(ctx, item.evento, [...item.indices, ...sub]);
}

function indicesDeArgs(args, nombre) {
  if (args.some((a) => a.tipo !== 'numero' || !Number.isInteger(a.valor) || a.valor < 0 || a.valor > 9)) {
    throw new Parada('ERROR', nombre + ' espera índices 0–9');
  }
  return args.map((a) => a.valor);
}

function evaluarArbol(ctx, nodo, evId, base) {
  if (--ctx.presupuesto < 0) throw new Parada('ERROR', 'presupuesto agotado');
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
      const id = resolverId(ctx, args[0]);
      let idx = [];
      if (args[1]) {
        if (args[1].tipo !== 'texto' || !esDireccion(args[1].valor)) throw new Parada('ERROR', 'REF espera una dirección de diez dígitos');
        idx = indicesDe(args[1].valor);
      }
      ctx.dependencias.add(id + ':' + direccion(idx));
      return leerSlot(ctx, id, idx);
    }
    case 'BUSCAR': {
      if (!args.length) throw new Parada('ERROR', 'BUSCAR espera una posición');
      return buscar(ctx, evId, [...anfitrion, ...indicesDeArgs(args, 'BUSCAR')]);
    }
    case 'ACTUAL': {
      if (ctx.actual) return valorCandidato(ctx, ctx.actual, args.length ? indicesDeArgs(args, 'ACTUAL') : []);
      if (!args.length) throw new Parada('ERROR', 'ACTUAL fuera de FILTRAR espera una posición');
      const cantidad = args.length > 1 ? args[1].valor : 1;
      if (!(Number.isInteger(cantidad) && cantidad >= 1)) throw new Parada('ERROR', 'ACTUAL espera una cantidad entera ≥ 1');
      const c = buscar(ctx, evId, [...anfitrion, ...indicesDeArgs([args[0]], 'ACTUAL')]);
      if (!c.items.length) throw new Parada('PENDIENTE', 'sin candidatos en la posición ' + args[0].valor);
      return cantidad === 1 ? valorCandidato(ctx, c.items[0]) : col(c.items.slice(0, cantidad));
    }
    case 'FILTRAR': {
      const c = exigirColeccion(args[0], 'FILTRAR');
      if (!nodo.args[1]) throw new Parada('ERROR', 'FILTRAR espera una condición');
      const items = c.items.filter((item) => {
        const guardado = ctx.actual;
        ctx.actual = item;
        try { return exigirBool(evaluarArbol(ctx, nodo.args[1], evId, base), 'FILTRAR'); } finally { ctx.actual = guardado; }
      });
      return col(items);
    }
    case 'ORDENAR': {
      const c = exigirColeccion(args[0], 'ORDENAR');
      if (!nodo.args[1]) throw new Parada('ERROR', 'ORDENAR espera una expresión');
      const desc = args[2] && args[2].tipo === 'texto' && args[2].valor.toLowerCase() === 'desc';
      const claves = c.items.map((item) => {
        const guardado = ctx.actual;
        ctx.actual = item;
        try {
          const v = evaluarArbol(ctx, nodo.args[1], evId, base);
          const k = v.tipo === 'numero' ? v.valor : v.tipo === 'magnitud' ? v.cantidad : v.tipo === 'texto' ? v.valor : formato(v);
          return { item, k };
        } finally { ctx.actual = guardado; }
      });
      claves.sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0) * (desc ? -1 : 1));
      return col(claves.map((x) => x.item));
    }
    case 'ELEGIR': {
      const c = exigirColeccion(args[0], 'ELEGIR');
      const k = args[1] ? args[1].valor : 1;
      if (!(Number.isInteger(k) && k >= 1)) throw new Parada('ERROR', 'ELEGIR espera una cantidad entera ≥ 1');
      return col(c.items.slice(0, k));
    }
    case 'ORIGEN': {
      if (!ctx.actual) throw new Parada('ERROR', 'ORIGEN solo dentro de FILTRAR u ORDENAR');
      return texto(ctx.actual.origen);
    }
    case 'SIGNO': {
      if (!ctx.actual) throw new Parada('ERROR', 'SIGNO solo dentro de FILTRAR u ORDENAR');
      return texto(ctx.actual.signo ?? 'exacto');
    }
    case 'FALTAS': {
      if (!ctx.actual) throw new Parada('ERROR', 'FALTAS solo dentro de FILTRAR u ORDENAR');
      return num(ctx.actual.faltas ?? 0);
    }
    case 'EXCEDENTES': {
      if (!ctx.actual) throw new Parada('ERROR', 'EXCEDENTES solo dentro de FILTRAR u ORDENAR');
      return num(ctx.actual.excedentes ?? 0);
    }
    case 'ACUERDO': {
      if (!ctx.actual) throw new Parada('ERROR', 'ACUERDO solo dentro de FILTRAR u ORDENAR');
      return num(ctx.actual.acuerdo ?? 10);
    }
    case 'DESPLAZAMIENTO': {
      if (!ctx.actual) throw new Parada('ERROR', 'DESPLAZAMIENTO solo dentro de FILTRAR u ORDENAR');
      return num((ctx.actual.vector ?? []).reduce((s, x) => s + Math.abs(x), 0));
    }
    case 'CONTAR': return num(exigirColeccion(args[0], 'CONTAR').items.length);
    case 'SUMAR': {
      const c = exigirColeccion(args[0], 'SUMAR');
      let acc = null;
      for (const item of c.items) {
        const v = valorCandidato(ctx, item);
        acc = acc === null ? v : sumar(acc, v);
      }
      return acc ?? num(0);
    }
    case 'Y': return bool(args.every((a) => exigirBool(a, 'Y')));
    case 'O': return bool(args.some((a) => exigirBool(a, 'O')));
    case 'NO': return bool(!exigirBool(args[0], 'NO'));
    default: throw new Parada('ERROR', 'función desconocida: ' + nodo.nombre);
  }
}

/**
 * Evalúa el slot (evId, dir) del eje. Siempre devuelve
 * { estado, valor?, motivo?, texto, dependencias }. Nunca tiene efectos.
 */
export function evaluar(eje, evId, dir) {
  const indices = Array.isArray(dir) ? dir : indicesDe(dir);
  const ctx = { eje, pila: new Set(), dependencias: new Set(), presupuesto: PRESUPUESTO, actual: null };
  try {
    const contenido = leerPosicion(ctx, evId, indices);
    if (!esFormula(contenido)) return { estado: 'RESUELTO', valor: valorDe(contenido), texto: formato(valorDe(contenido)), dependencias: [] };
    const valor = leerSlot(ctx, evId, indices);
    return { estado: 'RESUELTO', valor, texto: formato(valor), dependencias: [...ctx.dependencias] };
  } catch (e) {
    return estadoDeError(e, ctx);
  }
}

/**
 * Lo que para una evaluación es un estado del slot, no una excepción: una
 * Parada, un error de sintaxis o la pila agotada por una fórmula anidada
 * miles de veces (RangeError), que cuenta como presupuesto agotado.
 */
function estadoDeError(e, ctx) {
  if (e instanceof Parada) return { estado: e.estado, motivo: e.message, texto: e.estado + ': ' + e.message, dependencias: [...ctx.dependencias] };
  if (e instanceof SyntaxError) return { estado: 'ERROR', motivo: e.message, texto: 'ERROR: ' + e.message, dependencias: [] };
  if (e instanceof RangeError) {
    const motivo = 'presupuesto agotado: ' + (/call stack/i.test(e.message) ? 'anidamiento demasiado profundo' : e.message);
    return { estado: 'ERROR', motivo, texto: 'ERROR: ' + motivo, dependencias: [...ctx.dependencias] };
  }
  throw e;
}

/** Evalúa una fórmula suelta (sin «=») en el contexto de un slot. Para consultas desde fuera. */
export function consultar(eje, evId, dir, formula) {
  const indices = Array.isArray(dir) ? dir : indicesDe(dir);
  const ctx = { eje, pila: new Set(), dependencias: new Set(), presupuesto: PRESUPUESTO, actual: null };
  try {
    const valor = evaluarArbol(ctx, analizar(formula.replace(/^=/, '')), evId, indices);
    return { estado: 'RESUELTO', valor, texto: formato(valor), dependencias: [...ctx.dependencias] };
  } catch (e) {
    return estadoDeError(e, ctx);
  }
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
