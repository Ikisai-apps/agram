// BQL mínimo (BQLM): expresiones sobre posiciones BTML, con un léxico corto en
// inglés (VG, 9-11, mapa §16 [D] «Molde de regla y léxico mínimo de BQL»). No
// sustituye todavía a src/bql.js: es el módulo que después evaluará las
// condiciones de las reglas de la época (el 2 de cada regla, src/epocas.js).
// Gramática, semántica y ejemplos: docs/BQLM.md.
//
// Léxico, exacto y nada más:
//   posiciones      X.d.d…  (X = ev, epoch, before, it, it2…, o una expresión entre paréntesis)
//   índice por valor X.(expr)  (un dígito 0-9 es esa posición; un texto, los ocupantes que se llaman así)
//   listas          first M · last M · nth k M (desde 0) · M each d.d… · M where cond (it, it2… es el elemento)
//   árbol           up X · down X · path X (padre por el ancla 6.5, hijos anclados, hilo hasta la raíz; tope 10)
//   recuento        count · sum · max · min
//   aritmética      + - * / floor
//   comparación     = != < <= > >=
//   lógica          and or not in
//   literales       números, "texto", y los símbolos mint transfer lock release burn y E P R T (valen su nombre)
// Cualquier otro nombre es ERROR «no es BQL mínimo».
//
// Semántica: toda expresión vale una LISTA de ocupantes. Una posición da sus
// ocupantes por llegada; una lista de uno se usa como su elemento en la
// aritmética y en las comparaciones (decisión G3); comparar una lista de más de
// uno es ERROR; and y or son perezosos. Tres estados, como el BQL actual:
// RESUELTO, PENDIENTE (falta algo que resolver: una posición vacía donde hace
// falta un valor, una referencia a un evento que no ha llegado, un límite) y
// ERROR (sintaxis, un nombre que no es del léxico, tipos que no operan).
//
// El evaluador no sabe nada del eje: pregunta a un CONTEXTO. Interfaz:
//
//   contexto.nombre(n)              el nodo de 'ev' (la transacción candidata), 'epoch' (el registro de la
//                                   época) o 'before' (el libro de antes); undefined si no lo hay
//   contexto.ocupantes(nodo, camino) los ocupantes de la posición `camino` (dígitos 0-9) del nodo, por
//                                   llegada; puede lanzar una Parada PENDIENTE
//   contexto.padre(nodo)            el registro padre (por el ancla 6.5), null en la raíz, undefined si el
//                                   nodo no es un registro
//   contexto.hijos(nodo)            los registros anclados sobre él, por llegada; undefined si no es un registro
//   contexto.valor(nodo)            el escalar de un nodo que no es número ni texto (el id de un registro),
//                                   o undefined (una décupla no tiene valor)
//   contexto.texto(nodo)            (opcional) cómo se escribe el nodo en un mensaje
//
// Los ocupantes son números, textos o nodos opacos del contexto. Hay una
// implementación sobre el eje en src/contexto-eje.js.

export const ESTADOS = Object.freeze(['RESUELTO', 'PENDIENTE', 'ERROR']);

/** Las cinco primitivas de la capa de transacciones (VG, 9-11, mapa §16 [D]): símbolos que valen su nombre. */
export const PRIMITIVAS = Object.freeze(['mint', 'transfer', 'lock', 'release', 'burn']);

/** Las cuatro familias de tokens, como símbolos. */
export const SIMBOLOS_FAMILIA = Object.freeze(['E', 'P', 'R', 'T']);

/** Los nombres fijos que el contexto resuelve. */
export const NOMBRES = Object.freeze(['ev', 'epoch', 'before']);

/** Las palabras del léxico (sin los nombres, los símbolos ni it, it2…). */
export const PALABRAS = Object.freeze(['first', 'last', 'nth', 'each', 'where', 'up', 'down', 'path', 'count', 'sum', 'max', 'min', 'floor', 'and', 'or', 'not', 'in']);

/** Límites de cálculo: pasos de una evaluación, anidamiento de la expresión y niveles de un hilo (`path`). */
export const LIMITES = Object.freeze({ pasos: 100000, anidamiento: 100, hilo: 10 });

/** Una parada de la evaluación: PENDIENTE o ERROR, con su motivo. */
export class Parada extends Error {
  constructor(estado, motivo) {
    super(motivo);
    this.estado = estado;
  }
}

/** Parada PENDIENTE (para los contextos: falta algo que puede llegar). */
export const pendiente = (motivo) => new Parada('PENDIENTE', motivo);
const fallo = (motivo) => new Parada('ERROR', motivo);

const PREFIJAS = new Set(['first', 'last', 'count', 'sum', 'max', 'min', 'floor', 'up', 'down', 'path']);
const COMPARACIONES = new Set(['=', '!=', '<', '<=', '>', '>=']);
const RESERVADAS = new Set([...PALABRAS, ...NOMBRES, ...PRIMITIVAS, ...SIMBOLOS_FAMILIA]);

// ---------- léxico ----------

const RE_ESPACIO = /\s+/y;
const RE_NUMERO = /\d+(?:\.\d+)?/y;
const RE_DIGITOS = /\d+/y;
const RE_TEXTO = /"(?:[^"\\]|\\.)*"/y;
const RE_NOMBRE = /[\p{L}_][\p{L}\p{N}_]*/uy;
// La coma no es del léxico: se lee para que «FILTRAR(a, b)» diga qué nombre no es BQL mínimo.
const RE_OPERADOR = /!=|<=|>=|[()+\-*/=<>.,]/y;

/** Tokens de una expresión: { t: 'num' | 'dig' | 'txt' | 'id' | 'op', v, pos }. Tras «.» o «each», las cifras son dígitos de posición. */
function tokenizar(src) {
  const tokens = [];
  let pos = 0;
  const prueba = (re) => {
    re.lastIndex = pos;
    const m = re.exec(src);
    if (m) pos = re.lastIndex;
    return m;
  };
  while (pos < src.length) {
    if (prueba(RE_ESPACIO)) continue;
    const previo = tokens[tokens.length - 1];
    const tras = previo && ((previo.t === 'op' && previo.v === '.') || (previo.t === 'id' && previo.v === 'each'));
    const inicio = pos;
    let m;
    if (tras && (m = prueba(RE_DIGITOS))) tokens.push({ t: 'dig', v: m[0], pos: inicio });
    else if ((m = prueba(RE_NUMERO))) tokens.push({ t: 'num', v: Number(m[0]), pos: inicio });
    else if ((m = prueba(RE_TEXTO))) {
      let v;
      try {
        v = JSON.parse(m[0]);
      } catch {
        throw fallo('sintaxis: texto mal escrito en ' + inicio + ': ' + m[0]);
      }
      tokens.push({ t: 'txt', v, pos: inicio });
    } else if ((m = prueba(RE_NOMBRE))) tokens.push({ t: 'id', v: m[0], pos: inicio });
    else if ((m = prueba(RE_OPERADOR))) tokens.push({ t: 'op', v: m[0], pos: inicio });
    else throw fallo('sintaxis: carácter inesperado en ' + pos + ': «' + src.slice(pos, pos + 8) + '»');
  }
  return tokens;
}

// ---------- sintaxis ----------

const NIVEL_IT = /^it([2-9]|[1-9]\d+)?$/;

/**
 * Analiza una expresión de BQL mínimo (sin el «=» de fórmula, o con él) y
 * devuelve su árbol. Lanza una Parada ERROR con el motivo (sintaxis o «no es
 * BQL mínimo»).
 */
export function analizar(src) {
  if (typeof src !== 'string') throw fallo('sintaxis: una expresión es un texto');
  const cuerpo = src.startsWith('=') && !src.startsWith('==') ? src.slice(1) : src;
  const tokens = tokenizar(cuerpo);
  let i = 0;
  let nivelWhere = 0;
  let anidamiento = 0;
  const ver = () => tokens[i];
  const es = (t, v) => tokens[i]?.t === t && (v === undefined || tokens[i].v === v);
  const donde = () => (tokens[i] ? 'en ' + tokens[i].pos + ' («' + tokens[i].v + '»)' : 'al final');
  const entrar = () => {
    if (++anidamiento > LIMITES.anidamiento) throw pendiente('límite de cálculo: expresión anidada más de ' + LIMITES.anidamiento + ' niveles');
  };
  const salir = () => { anidamiento--; };
  const esperar = (t, v) => {
    if (!es(t, v)) throw fallo('sintaxis: se esperaba «' + v + '» ' + donde());
    i++;
  };

  function expresion() {
    entrar();
    let base = disyuncion();
    while (es('id', 'where')) {
      i++;
      nivelWhere++;
      const cond = disyuncion();
      base = { n: 'where', base, cond, nivel: nivelWhere };
      nivelWhere--;
    }
    salir();
    return base;
  }
  function disyuncion() {
    let a = conjuncion();
    while (es('id', 'or')) { i++; a = { n: 'or', a, b: conjuncion() }; }
    return a;
  }
  function conjuncion() {
    let a = negacion();
    while (es('id', 'and')) { i++; a = { n: 'and', a, b: negacion() }; }
    return a;
  }
  function negacion() {
    if (es('id', 'not')) {
      i++;
      entrar();
      const a = negacion();
      salir();
      return { n: 'not', a };
    }
    return comparacion();
  }
  function esComparacion() {
    return (es('op') && COMPARACIONES.has(ver().v)) || es('id', 'in');
  }
  function comparacion() {
    const a = suma();
    if (!esComparacion()) return a;
    const op = ver().v;
    i++;
    const b = suma();
    if (esComparacion()) throw fallo('sintaxis: comparaciones encadenadas ' + donde() + ': únelas con and');
    return { n: 'cmp', op, a, b };
  }
  function suma() {
    let a = producto();
    while (es('op', '+') || es('op', '-')) { const op = ver().v; i++; a = { n: 'bin', op, a, b: producto() }; }
    return a;
  }
  function producto() {
    let a = prefija();
    while (es('op', '*') || es('op', '/')) { const op = ver().v; i++; a = { n: 'bin', op, a, b: prefija() }; }
    return a;
  }
  function prefija() {
    if (es('id') && PREFIJAS.has(ver().v)) {
      const op = ver().v;
      i++;
      entrar();
      const arg = prefija();
      salir();
      return { n: 'pref', op, arg };
    }
    if (es('id', 'nth')) {
      i++;
      entrar();
      const k = prefija();
      const arg = prefija();
      salir();
      return { n: 'nth', k, arg };
    }
    if (es('op', '-')) {
      i++;
      entrar();
      const arg = prefija();
      salir();
      return { n: 'pref', op: 'neg', arg };
    }
    return posfija();
  }
  function digitos() {
    const lista = [];
    for (;;) {
      if (!es('dig')) throw fallo('sintaxis: se esperaba un dígito de posición ' + donde());
      if (ver().v.length !== 1) throw fallo('sintaxis: una posición es un solo dígito (0-9), no «' + ver().v + '»: escribe ' + ver().v.split('').join('.'));
      lista.push(Number(ver().v));
      i++;
      // Sigue el camino mientras venga «.» y otro dígito.
      if (es('op', '.') && tokens[i + 1]?.t === 'dig') { i++; continue; }
      return lista;
    }
  }
  function posfija() {
    let base = primaria();
    for (;;) {
      if (es('op', '.')) {
        if (!base.posicionable) throw fallo('sintaxis: una posición se lee de ev, epoch, before, it… o de una expresión entre paréntesis ' + donde());
        i++;
        if (es('op', '(')) {
          i++;
          const expr = expresion();
          esperar('op', ')');
          base = { n: 'clave', base, expr, posicionable: true };
        } else base = { n: 'paso', base, digitos: digitos(), posicionable: true };
      } else if (es('id', 'each')) {
        i++;
        base = { n: 'paso', base, digitos: digitos(), posicionable: true, each: true };
      } else return base;
    }
  }
  function primaria() {
    const tk = ver();
    if (!tk) throw fallo('sintaxis: falta una expresión al final');
    if (tk.t === 'num') { i++; return { n: 'lit', v: tk.v }; }
    if (tk.t === 'txt') { i++; return { n: 'lit', v: tk.v }; }
    if (tk.t === 'op' && tk.v === '(') {
      i++;
      const e = expresion();
      esperar('op', ')');
      return { n: 'paren', e, posicionable: true };
    }
    if (tk.t === 'id') {
      i++;
      if (NOMBRES.includes(tk.v)) return { n: 'nombre', v: tk.v, posicionable: true };
      if (PRIMITIVAS.includes(tk.v) || SIMBOLOS_FAMILIA.includes(tk.v)) return { n: 'lit', v: tk.v };
      const it = NIVEL_IT.exec(tk.v);
      if (it) {
        const nivel = it[1] ? Number(it[1]) : 1;
        if (nivel > nivelWhere) {
          throw fallo(nivel === 1 ? 'sintaxis: it solo vale dentro de where' : 'sintaxis: ' + tk.v + ' solo vale dentro de un where anidado ' + nivel + ' veces');
        }
        return { n: 'it', nivel, posicionable: true };
      }
      if (RESERVADAS.has(tk.v)) throw fallo('sintaxis: «' + tk.v + '» fuera de sitio en ' + tk.pos);
      const llamada = es('op', '(') ? ' (no hay funciones con nombre)' : '';
      throw fallo('no es BQL mínimo: «' + tk.v + '»' + llamada);
    }
    throw fallo('sintaxis: «' + tk.v + '» inesperado en ' + tk.pos);
  }

  if (!tokens.length) throw fallo('sintaxis: expresión vacía');
  const arbol = expresion();
  if (i < tokens.length) throw fallo('sintaxis: sobra ' + donde());
  return arbol;
}

// ---------- evaluación ----------

const esNodo = (o) => o !== null && typeof o === 'object';

/**
 * Evalúa una expresión (texto, con o sin «=», o el árbol de analizar) en un
 * contexto. Devuelve { estado: 'RESUELTO', valor, texto } (valor: la lista de
 * ocupantes; texto: cómo se lee) o { estado: 'PENDIENTE' | 'ERROR', motivo }.
 * No lanza. opciones.limites cambia LIMITES.pasos.
 */
export function evaluar(src, contexto, opciones = {}) {
  try {
    const arbol = typeof src === 'string' ? analizar(src) : src;
    const st = { ctx: contexto, its: [], pasos: 0, tope: opciones.limites?.pasos ?? LIMITES.pasos };
    const valor = calcular(arbol, st);
    return { estado: 'RESUELTO', valor, texto: textoDe(valor, contexto) };
  } catch (e) {
    if (e instanceof Parada) return { estado: e.estado, motivo: e.message };
    return { estado: 'ERROR', motivo: 'fallo al evaluar: ' + e.message };
  }
}

function paso(st, n = 1) {
  st.pasos += n;
  if (st.pasos > st.tope) throw pendiente('límite de cálculo: más de ' + st.tope + ' pasos');
}

function valorDe(o, ctx) {
  if (typeof o === 'number' || typeof o === 'string' || typeof o === 'boolean') return o;
  return esNodo(o) ? ctx.valor?.(o) : undefined;
}

function leer(o, ctx) {
  if (typeof o === 'string') return o;
  if (typeof o === 'number' || typeof o === 'boolean') return String(o);
  return ctx?.texto?.(o) ?? (valorDe(o, ctx) !== undefined ? String(valorDe(o, ctx)) : '«décupla»');
}

/** Cómo se lee una lista de ocupantes: sus textos separados por comas; vacía, «∅». */
export function textoDe(lista, contexto) {
  return lista.length ? lista.map((o) => leer(o, contexto)).join(', ') : '∅';
}

/** El único elemento de una lista: vacía → PENDIENTE; de más de uno → ERROR (decisión G3). */
function uno(lista, donde, ctx) {
  if (lista.length === 0) throw pendiente(donde + ': la posición está vacía, falta un valor');
  if (lista.length > 1) throw fallo(donde + ': es una lista de ' + lista.length + ' (' + textoDe(lista.slice(0, 3), ctx) + (lista.length > 3 ? '…' : '') + '); usa first, last, nth, count o sum');
  return lista[0];
}

function numero(lista, donde, ctx) {
  const v = valorDe(uno(lista, donde, ctx), ctx);
  if (typeof v !== 'number') throw fallo(donde + ' espera un número, no «' + leer(lista[0], ctx) + '»');
  return v;
}

function booleano(lista, donde, ctx) {
  if (lista.length !== 1 || typeof lista[0] !== 'boolean') throw fallo(donde + ' espera verdadero o falso, no «' + textoDe(lista, ctx) + '»');
  return lista[0];
}

/** Los nombres de un ocupante, para el índice por valor: su valor, o los valores de su 0. */
function nombresDe(o, st) {
  const v = valorDe(o, st.ctx);
  if (v !== undefined) return [v];
  paso(st);
  return st.ctx.ocupantes(o, [0]).map((x) => valorDe(x, st.ctx)).filter((x) => x !== undefined);
}

function igual(A, B, ctx) {
  if (A.length === 0 || B.length === 0) return A.length === 0 && B.length === 0;
  const a = valorDe(uno(A, 'comparar', ctx), ctx);
  const b = valorDe(uno(B, 'comparar', ctx), ctx);
  if (a === undefined || b === undefined) throw fallo('comparar: una décupla no tiene valor; lee una de sus posiciones');
  return a === b;
}

function calcular(nodo, st) {
  const { ctx } = st;
  switch (nodo.n) {
    case 'lit':
      return [nodo.v];
    case 'nombre': {
      const x = ctx.nombre(nodo.v);
      if (x === undefined) throw pendiente('no hay ' + nodo.v + ' en este contexto');
      return [x];
    }
    case 'it':
      return [st.its[nodo.nivel - 1]];
    case 'paren':
      return calcular(nodo.e, st);
    case 'paso': {
      const base = calcular(nodo.base, st);
      paso(st, base.length || 1);
      return base.flatMap((o) => ctx.ocupantes(o, nodo.digitos));
    }
    case 'clave': {
      const base = calcular(nodo.base, st);
      const v = valorDe(uno(calcular(nodo.expr, st), 'la posición entre paréntesis', ctx), ctx);
      if (typeof v === 'number') {
        if (!Number.isInteger(v) || v < 0 || v > 9) throw fallo('una posición es un dígito 0-9, no ' + v);
        paso(st, base.length || 1);
        return base.flatMap((o) => ctx.ocupantes(o, [v]));
      }
      if (typeof v !== 'string') throw fallo('una posición por valor es un dígito o un texto, no «' + v + '»');
      return base.filter((o) => nombresDe(o, st).includes(v));
    }
    case 'where': {
      const base = calcular(nodo.base, st);
      const antes = st.its[nodo.nivel - 1];
      const fuera = [];
      try {
        for (const o of base) {
          paso(st);
          st.its[nodo.nivel - 1] = o;
          if (booleano(calcular(nodo.cond, st), 'where', ctx)) fuera.push(o);
        }
      } finally {
        st.its[nodo.nivel - 1] = antes;
      }
      return fuera;
    }
    case 'pref':
      return prefija(nodo.op, calcular(nodo.arg, st), st);
    case 'nth': {
      const k = numero(calcular(nodo.k, st), 'nth', ctx);
      if (!Number.isInteger(k) || k < 0) throw fallo('nth espera un índice entero ≥ 0 (desde 0), no ' + k);
      return calcular(nodo.arg, st).slice(k, k + 1);
    }
    case 'bin': {
      const a = numero(calcular(nodo.a, st), nodo.op, ctx);
      const b = numero(calcular(nodo.b, st), nodo.op, ctx);
      if (nodo.op === '+') return [a + b];
      if (nodo.op === '-') return [a - b];
      if (nodo.op === '*') return [a * b];
      if (b === 0) throw fallo('división por cero');
      return [a / b];
    }
    case 'cmp': {
      if (nodo.op === '=' || nodo.op === '!=') {
        const r = igual(calcular(nodo.a, st), calcular(nodo.b, st), ctx);
        return [nodo.op === '=' ? r : !r];
      }
      if (nodo.op === 'in') {
        const x = calcular(nodo.a, st);
        if (x.length === 0) return [false];
        const v = valorDe(uno(x, 'in', ctx), ctx);
        if (v === undefined) throw fallo('in: una décupla no tiene valor; lee una de sus posiciones');
        return [calcular(nodo.b, st).some((o) => valorDe(o, ctx) === v)];
      }
      const a = numero(calcular(nodo.a, st), nodo.op, ctx);
      const b = numero(calcular(nodo.b, st), nodo.op, ctx);
      if (nodo.op === '<') return [a < b];
      if (nodo.op === '<=') return [a <= b];
      if (nodo.op === '>') return [a > b];
      return [a >= b];
    }
    case 'and':
      if (!booleano(calcular(nodo.a, st), 'and', ctx)) return [false];
      return [booleano(calcular(nodo.b, st), 'and', ctx)];
    case 'or':
      if (booleano(calcular(nodo.a, st), 'or', ctx)) return [true];
      return [booleano(calcular(nodo.b, st), 'or', ctx)];
    case 'not':
      return [!booleano(calcular(nodo.a, st), 'not', ctx)];
    default:
      throw fallo('nodo desconocido: ' + nodo.n);
  }
}

function prefija(op, lista, st) {
  const { ctx } = st;
  switch (op) {
    case 'first': return lista.slice(0, 1);
    case 'last': return lista.slice(-1);
    case 'count': return [lista.length];
    case 'sum': return [lista.reduce((s, o) => s + numeroDe(o, 'sum', ctx), 0)];
    case 'max':
    case 'min': {
      if (!lista.length) return [];
      const ns = lista.map((o) => numeroDe(o, op, ctx));
      return [op === 'max' ? Math.max(...ns) : Math.min(...ns)];
    }
    case 'floor': return [Math.floor(numero(lista, 'floor', ctx))];
    case 'neg': return [-numero(lista, '-', ctx)];
    case 'up':
      return lista.flatMap((o) => {
        paso(st);
        const p = ctx.padre(o);
        if (p === undefined) throw fallo('up: «' + leer(o, ctx) + '» no es un registro');
        return p === null ? [] : [p];
      });
    case 'down':
      return lista.flatMap((o) => {
        paso(st);
        const h = ctx.hijos(o);
        if (h === undefined) throw fallo('down: «' + leer(o, ctx) + '» no es un registro');
        return h;
      });
    case 'path':
      return lista.flatMap((o) => {
        const hilo = [];
        let x = o;
        while (x !== null) {
          if (hilo.length === LIMITES.hilo) throw pendiente('path: el hilo pasa de ' + LIMITES.hilo + ' niveles');
          paso(st);
          hilo.push(x);
          x = ctx.padre(x);
          if (x === undefined) throw fallo('path: «' + leer(hilo[hilo.length - 1], ctx) + '» no es un registro');
        }
        return hilo;
      });
    default:
      throw fallo('operación desconocida: ' + op);
  }
}

function numeroDe(o, donde, ctx) {
  const v = valorDe(o, ctx);
  if (typeof v !== 'number') throw fallo(donde + ' espera números, no «' + leer(o, ctx) + '»');
  return v;
}

// ---------- reglas ----------

/** Lo que hay en una posición de una regla en forma canónica: la lista de uno se lee como su ocupante. */
const hoja = (x) => (Array.isArray(x) && x.length === 1 ? x[0] : x);

/**
 * Evalúa una regla de la época (una décupla del molde, mapa §16 [D]: 0 nombre,
 * 1 constantes, 2 condición, 3 a quién, 4 primitiva, 5 dónde cuelga, 6 de dónde
 * viene, 7 desde qué época, 8 orden, 9 mensaje). Lee la condición del 2 (una
 * fórmula «=…») y la evalúa en el contexto. Devuelve { pasa, estado, motivo }:
 * pasa solo si la condición da verdadero; si da falso, motivo es el mensaje del
 * 9 con cada {expresión} rellena con lo que vale; si queda PENDIENTE o da
 * ERROR, no pasa y motivo lo dice. No mira el 3, el 4 ni el 5: quién cuelga las
 * reglas de cada transacción es trabajo de después.
 */
export function evaluarRegla(regla, contexto, opciones = {}) {
  const nombre = Array.isArray(regla) ? hoja(regla[0]) : undefined;
  const condicion = Array.isArray(regla) ? hoja(regla[2]) : undefined;
  if (typeof condicion !== 'string' || !condicion.startsWith('=') || condicion.startsWith('==')) {
    return { pasa: false, estado: 'ERROR', motivo: (nombre ?? 'regla') + ': su 2 no es una condición «=…»' };
  }
  const r = evaluar(condicion, contexto, opciones);
  if (r.estado !== 'RESUELTO') return { pasa: false, estado: r.estado, motivo: nombre + ': ' + r.estado + ': ' + r.motivo };
  if (r.valor.length !== 1 || typeof r.valor[0] !== 'boolean') {
    return { pasa: false, estado: 'ERROR', motivo: nombre + ': la condición no da verdadero o falso, da «' + r.texto + '»' };
  }
  if (r.valor[0]) return { pasa: true, estado: 'RESUELTO', motivo: null };
  const mensaje = hoja(regla[9]);
  return { pasa: false, estado: 'RESUELTO', motivo: typeof mensaje === 'string' ? rellenar(mensaje, contexto, opciones) : nombre + ': no se cumple' };
}

/** Rellena cada {expresión} de un mensaje con lo que vale en el contexto (o con su estado, si no se resuelve). */
export function rellenar(mensaje, contexto, opciones = {}) {
  return mensaje.replace(/\{([^{}]+)\}/g, (_, expr) => {
    const r = evaluar(expr, contexto, opciones);
    return r.estado === 'RESUELTO' ? r.texto : '{' + expr + ': ' + r.estado + '}';
  });
}
