// BQL V0: fórmulas dentro de un slot BTML. Convención: una cadena que empieza
// por «=» es fórmula; «==» escapa un texto que empieza por «=». No hay árbol
// BQL aparte: la posición del slot da el significado. Las consultas no tienen
// efectos. Evaluación segura: pila de dependencias (ciclos), presupuesto.
//
//   =LOCAL(n, ...)        lee la décupla anfitriona: posición n (índices anidados opcionales)
//   =REF(id, dir?)        lee otro evento (id o prefijo), subposición de diez dígitos opcional
//   = 12 EUR + 2 EUR      magnitudes: misma unidad se suman conservando el desglose
//   = 12 EUR + 5 min      unidades distintas: composición heterogénea, operandos preservados
//
// Estados: RESUELTO, PENDIENTE (falta algo por desarrollar), INCOMPATIBLE
// (tipos que no operan), ERROR (sintaxis, función desconocida, ciclo, presupuesto).

import { esReferencia, esDireccion, indicesDe, direccion } from './btml.js';

export const ESTADOS = Object.freeze(['RESUELTO', 'PENDIENTE', 'INCOMPATIBLE', 'ERROR']);
const PRESUPUESTO = 200;

/** Una cadena es fórmula si empieza por un solo «=». */
export function esFormula(x) {
  return typeof x === 'string' && x.startsWith('=') && !x.startsWith('==');
}

/** Texto escapado: «==hola» es el texto «=hola». */
export function desescapar(x) {
  return typeof x === 'string' && x.startsWith('==') ? x.slice(1) : x;
}

// ---------- léxico y sintaxis ----------

const RE_TOKEN = /\s*(?:(\d+(?:\.\d+)?)|("(?:[^"\\]|\\.)*")|([A-Za-z_][\w€$%]*|[€$%])|([()+\-*/,]))/y;

function tokenizar(src) {
  const tokens = [];
  RE_TOKEN.lastIndex = 0;
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
  const tomar = (t, v) => {
    const k = tokens[i];
    if (!k || k.t !== t || (v !== undefined && k.v !== v)) throw new SyntaxError('se esperaba ' + (v ?? t) + ' en el token ' + i);
    i++;
    return k;
  };
  function expr() {
    let izq = termino();
    while (mirar() && mirar().t === 'op' && (mirar().v === '+' || mirar().v === '-')) {
      const op = tomar('op').v;
      izq = { tipo: 'bin', op, izq, der: termino() };
    }
    return izq;
  }
  function termino() {
    let izq = factor();
    while (mirar() && mirar().t === 'op' && (mirar().v === '*' || mirar().v === '/')) {
      const op = tomar('op').v;
      izq = { tipo: 'bin', op, izq, der: factor() };
    }
    return izq;
  }
  function factor() {
    const k = mirar();
    if (!k) throw new SyntaxError('fórmula incompleta');
    if (k.t === 'op' && k.v === '-') { tomar('op'); return { tipo: 'neg', arg: factor() }; }
    if (k.t === 'op' && k.v === '(') { tomar('op'); const e = expr(); tomar('op', ')'); return e; }
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
      if (mirar() && mirar().t === 'op' && mirar().v === '(') {
        tomar('op');
        const args = [];
        if (!(mirar() && mirar().t === 'op' && mirar().v === ')')) {
          args.push(expr());
          while (mirar() && mirar().t === 'op' && mirar().v === ',') { tomar('op'); args.push(expr()); }
        }
        tomar('op', ')');
        return { tipo: 'fn', nombre: k.v.toUpperCase(), args };
      }
      // Unidad suelta o identificador: como magnitud 1 de esa unidad no tiene sentido; error.
      throw new SyntaxError('identificador suelto: ' + k.v);
    }
    throw new SyntaxError('token inesperado: ' + k.v);
  }
  const arbol = expr();
  if (i < tokens.length) throw new SyntaxError('sobra: ' + tokens[i].v);
  return arbol;
}

// ---------- valores ----------

const num = (v) => ({ tipo: 'numero', valor: v });
const mag = (cantidad, unidad, desglose) => ({ tipo: 'magnitud', cantidad, unidad, desglose: desglose ?? [{ cantidad, unidad }] });
const texto = (v) => ({ tipo: 'texto', valor: v });
const comp = (partes) => ({ tipo: 'composicion', partes });

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

function describir(v) {
  return v.tipo === 'magnitud' ? 'magnitud en ' + v.unidad : v.tipo;
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
    const clave = evId + ':' + direccion(indices);
    if (ctx.pila.has(clave)) throw new Parada('ERROR', 'ciclo en ' + evId.slice(0, 8) + ':' + direccion(indices));
    ctx.pila.add(clave);
    try {
      const r = evaluarArbol(ctx, analizar(contenido.slice(1)), evId, indices);
      ctx.dependencias.add(clave);
      return r;
    } finally {
      ctx.pila.delete(clave);
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
    case 'fn': {
      const args = nodo.args.map((a) => evaluarArbol(ctx, a, evId, base));
      if (nodo.nombre === 'LOCAL') {
        if (!args.length || args.some((a) => a.tipo !== 'numero' || !Number.isInteger(a.valor) || a.valor < 0 || a.valor > 9)) {
          throw new Parada('ERROR', 'LOCAL espera índices 0–9');
        }
        // LOCAL lee la décupla anfitriona: la del slot en su profundidad.
        const anfitrion = base.slice(0, -1);
        return leerSlot(ctx, evId, [...anfitrion, ...args.map((a) => a.valor)]);
      }
      if (nodo.nombre === 'REF') {
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
      throw new Parada('ERROR', 'función desconocida: ' + nodo.nombre);
    }
    default:
      throw new Parada('ERROR', 'nodo desconocido');
  }
}

/**
 * Evalúa el slot (evId, dir) del eje. Siempre devuelve
 * { estado, valor?, motivo?, texto, dependencias }. Nunca tiene efectos.
 */
export function evaluar(eje, evId, dir) {
  const indices = Array.isArray(dir) ? dir : indicesDe(dir);
  const ctx = { eje, pila: new Set(), dependencias: new Set(), presupuesto: PRESUPUESTO };
  try {
    const contenido = leerPosicion(ctx, evId, indices);
    if (!esFormula(contenido)) return { estado: 'RESUELTO', valor: valorDe(contenido), texto: formato(valorDe(contenido)), dependencias: [] };
    const valor = leerSlot(ctx, evId, indices);
    return { estado: 'RESUELTO', valor, texto: formato(valor), dependencias: [...ctx.dependencias] };
  } catch (e) {
    if (e instanceof Parada) return { estado: e.estado, motivo: e.message, texto: e.estado + ': ' + e.message, dependencias: [...ctx.dependencias] };
    if (e instanceof SyntaxError) return { estado: 'ERROR', motivo: e.message, texto: 'ERROR: ' + e.message, dependencias: [] };
    throw e;
  }
}

const redondear = (n) => Math.round(n * 1000) / 1000;

/** Texto de un valor: «250 m», «200 m + 5 EUR», «14 EUR (12 EUR + 2 EUR)». */
export function formato(v) {
  switch (v.tipo) {
    case 'numero': return String(redondear(v.valor));
    case 'texto': return v.valor;
    case 'magnitud': {
      const base = redondear(v.cantidad) + ' ' + v.unidad;
      const d = v.desglose ?? [];
      return d.length > 1 ? base + ' (' + d.map((x) => redondear(x.cantidad) + ' ' + x.unidad).join(' + ') + ')' : base;
    }
    case 'composicion': return v.partes.map(formato).join(' + ');
    case 'array': return '[' + v.valor.length + ' posiciones]';
    case 'referencia': return '→ ' + v.valor.ref.slice(0, 8);
    default: return '?';
  }
}
