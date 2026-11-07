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
//   =BUSCAR(n)              la lista de la posición n del anfitrión (un número es índice: camino exacto, relativo al anfitrión);
//                           por hojas, cada elemento de una lista (un array solo de hojas bajo la raíz) es un candidato aparte
//   =BUSCAR(n, ..., k)      el ocupante k (desde 0) de esa lista, por llegada: el último número es el índice en la lista,
//                           los anteriores, el camino (VG, 7-11 noche: la lista está fuera de los dígitos)
//   =BUSCAR("2000000000")   candidatos de esa dirección del registro (un texto de diez dígitos es dirección: absoluta, la colisión entera)
//   =FILTRAR(col, cond)     cond se evalúa por candidato; dentro, ACTUAL es el candidato y LOCAL sigue siendo el anfitrión
//   =ORDENAR(col, expr, "desc"?)   ordena por expr evaluada en cada candidato (claves escalares de un mismo tipo)
//   =ELEGIR(col, k?)        los k primeros (1 por defecto); no publica nada
//   =ACTUAL(pv, cantidad?)  fuera de FILTRAR: la colección activa de la posición pv, limitada a cantidad (1 por defecto);
//                           dentro: la posición pv del candidato. cantidad nunca es profundidad
//   =ORIGEN()               dentro de FILTRAR/ORDENAR: procedencia del candidato («propio», «referencia», «escrito»)
//   =ACUERDO() =DESPLAZAMIENTO() =SIGNO() =FALTAS() =EXCEDENTES()   el encaje del candidato: profundidades de acuerdo, suma de distancias, signo (exacto/completar/reducir/mixto), faltas y excedentes
//   =CONTAR(col) =SUMAR(col)
//   =BASES(alcance?, medida?, k | campo?)   lee las bases del 8 (src/bases.js, valorDeBases): n, la caja del anfitrión o un dato de la base
//   =CAJA(medida, alcance?)  la caja (0–9) del anfitrión en esa medida (= BASES(alcance, medida)); alcance "hermanos" por defecto
//   =FRESCURA(alcance?)      llegadas desde la base que lee ese alcance (0 = ninguna llegada; no ve cambios en lo ya medido)
//   =VALOR_R("titular")     el valor de la R que tiene titular, con la lente firmada del lector que consulta (src/lente.js, R6)
//   =LENTE("emisor")        el peso (0–1) que el lector que consulta da a ese emisor en su lente; 0 si no lo nombra
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
// BASES, CAJA y FRESCURA leen el 8 y no escriben nada: sin base escrita, PENDIENTE
// con el modo de escribirla; si leer la base cuesta más que el presupuesto
// que queda, PENDIENTE POR LÍMITE (docs/BQL.md §7.14).
//
// VALOR_R y LENTE leen la lente de R del LECTOR que consulta (opciones.lector):
// sin lector, o si el lector no ha declarado lente, PENDIENTE (sin lente, R no
// vale nada). Leer la lente y las tenencias pasa por el gancho y cuesta
// presupuesto: un paso por cada declaración de la lente y por cada evento que
// movió esa R al titular o desde él (docs/BQL.md §7.15).
//
// Opciones de evaluar/consultar: { puedeLeer(evId, dir, indices) → boolean, limites: { presupuesto, profundidad, candidatos }, lector }.

import { ARIDAD, esReferencia, esLista, esDireccion, indicesDe, direccion } from './btml.js';
import { ocupantesElegibles } from './elegibles.js';
// BASES, CAJA y FRESCURA. Ciclo de importación (bases.js importa este módulo
// para medir fórmulas): lo importado aquí solo se usa dentro de funciones.
import {
  CIELO, COSTE_BASE, SIN_BASE_ESCRITA, ALCANCES, basesEn, clavesDeMedidas, identidadDe, leerBase, proyectoDe, valorDeBases, erroresDeBases,
} from './bases.js';
import { ESCALAS_T, AMBITO_GENESIS } from './tokens.js';
import { lenteDe, detalleValor, anclasDeLente, POSICION_LENTE } from './lente.js';

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
function valorDe(contenido, indices = []) {
  // Por hojas (VG, 7-11 noche): bajo la raíz, un array solo de hojas es una lista; sus ocupantes, con BUSCAR.
  if (indices.length > 0 && esLista(contenido)) return { tipo: 'lista', valor: contenido };
  if (contenido === undefined) throw new Parada('PENDIENTE', 'posición sin desarrollar');
  if (typeof contenido === 'number') return num(contenido);
  if (Array.isArray(contenido)) return { tipo: 'array', valor: contenido };
  if (esReferencia(contenido)) return { tipo: 'referencia', valor: contenido };
  const s = desescapar(contenido);
  if (esDireccion(s)) return texto(s); // un texto de diez dígitos es una dirección, no un número
  const m = RE_MAGNITUD_SLOT.exec(s.trim());
  // [X] decidir VG: cómo se escribe una magnitud en BTML («12 EUR», un par u
  // otra forma). V0 lee como magnitud un texto «número palabra» o «palabra
  // número»; el mapa y el corpus no lo deciden (auditoría de ajuste 2).
  if (m) return m[1] !== undefined ? mag(Number(m[1]), m[2]) : mag(Number(m[4]), m[3]);
  // Una cadena de cifras es una cadena literal (corpus 03: «Número literal:
  // `120`; cadena literal: `"Yogur"`»): el número lo da el JSON. Así «0034»
  // no pierde sus ceros y «120» = "120" compara como texto.
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
    lector: typeof opciones.lector === 'string' && opciones.lector ? opciones.lector : null, // quien lee: su lente valora la R (R6)
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

/**
 * Contenido crudo de una posición. Evento que no está en el eje → PENDIENTE
 * (puede llegar). Por hojas (VG, 7-11 noche), una lista (bajo la raíz, un
 * array solo de hojas) se alcanza por índice y nunca por dirección: con
 * índices (LOCAL, un candidato de BUSCAR, evaluar con un camino) el número
 * siguiente es el lugar en la lista; con una dirección (`porDireccion`: REF,
 * una referencia BTML, evaluar con diez dígitos) seguir dentro de la lista
 * no existe: PENDIENTE, como una posición sin desarrollar, y el motivo lo
 * dice.
 */
function leerPosicion(ctx, evId, indices, { porDireccion = false } = {}) {
  const ev = ctx.eje.obtener(evId);
  if (!ev) throw new Parada('PENDIENTE', 'evento ausente del eje: ' + evId.slice(0, 8));
  autorizar(ctx, evId, indices);
  let nodo = ev.payload;
  for (let p = 0; p < indices.length; p++) {
    if (porDireccion && p > 0 && esLista(nodo)) {
      throw new Parada('PENDIENTE', 'posición sin desarrollar: ' + direccion(indices) + ' cae dentro de la lista de la ' + indices.slice(0, p).join('.') + '; una dirección no nombra ocupantes de una lista (se leen por índice: BUSCAR o LOCAL)');
    }
    if (!Array.isArray(nodo)) return undefined;
    nodo = nodo[indices[p]];
  }
  return nodo;
}

/** El elemento `lista` de la lista que hay en `contenido` y, si se pide, su subposición `sub` (un elemento es una hoja: no tiene). */
function elementoDeLista(contenido, { lista, sub = [] }) {
  let nodo = esLista(contenido) ? contenido[lista] : undefined;
  for (const i of sub) nodo = Array.isArray(nodo) ? nodo[i] : undefined;
  return nodo;
}

/**
 * Lee un slot como valor. Si contiene una fórmula la evalúa; si contiene una
 * referencia la sigue. Toda lectura queda en las dependencias, también la de
 * un literal. Fórmulas y referencias entran en la pila: volver a un slot que
 * se está leyendo es un ciclo (ERROR); más de `limites.profundidad` lecturas
 * encadenadas es PENDIENTE POR LÍMITE.
 */
function leerSlot(ctx, evId, indices, { elemento, porDireccion = false } = {}) {
  if (indices.length > ARIDAD) throw new Parada('PENDIENTE', 'posición sin desarrollar: más de diez profundidades');
  // Un elemento de una lista depende de la posición de la lista; en la pila va aparte, con su índice en ella.
  const lugar = evId + ':' + direccion(indices);
  const clave = elemento ? lugar + '[' + elemento.lista + ']' + (elemento.sub?.length ? '.' + elemento.sub.join('.') : '') : lugar;
  ctx.dependencias.add(lugar);
  const enPosicion = leerPosicion(ctx, evId, indices, { porDireccion });
  const contenido = elemento ? elementoDeLista(enPosicion, elemento) : enPosicion;
  if (!esFormula(contenido) && !esReferencia(contenido)) return valorDe(contenido, elemento ? [] : indices);
  if (ctx.pila.has(clave)) throw new Parada('ERROR', 'ciclo en ' + evId.slice(0, 8) + ':' + direccion(indices));
  if (ctx.pila.size >= ctx.limites.profundidad) throw limite('más de ' + ctx.limites.profundidad + ' lecturas encadenadas');
  ctx.pila.add(clave);
  const actualGuardado = ctx.actual;
  ctx.actual = null; // una fórmula ajena no hereda nuestro candidato
  try {
    if (esReferencia(contenido)) return leerSlot(ctx, contenido.ref, contenido.dir ? indicesDe(contenido.dir) : [], { porDireccion: true });
    // Una fórmula dentro de una lista se evalúa desde la posición de la lista: LOCAL lee su décupla anfitriona.
    return evaluarArbol(ctx, analizar(contenido.slice(1), ctx.limites), evId, indices);
  } finally {
    ctx.pila.delete(clave);
    ctx.actual = actualGuardado;
  }
}

/** Ids del eje que empiezan por p, en orden de entrada: por su índice (Eje.conPrefijo) o, si el eje no lo tiene, recorriéndolo. */
const conPrefijo = (eje, p) => (typeof eje.conPrefijo === 'function' ? eje.conPrefijo(p) : eje.orden.filter((id) => id.startsWith(p)));

/** Id de un evento a partir de un id o prefijo. Ninguno → PENDIENTE (puede llegar); varios o mal formado → ERROR. */
function resolverId(ctx, v) {
  const p = String(v.valor ?? v).replace(/^@/, '').toLowerCase();
  if (!/^[0-9a-f]+$/.test(p)) throw new Parada('ERROR', 'referencia mal formada: ' + p);
  const ids = conPrefijo(ctx.eje, p);
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
 * Elegibilidad antes que límites (R8, src/elegibles.js): solo entran los
 * ocupantes elegibles según el criterio del dueño del registro, y el límite
 * se aplica a ellos. Los escritos que no lo son quedan en `noElegibles`, un
 * recuento informativo de la colección que no entra en CONTAR ni en nada.
 */
function buscar(ctx, evId, indices, { exacto, llegada }) {
  if (!ctx.eje.obtener(evId)) throw new Parada('PENDIENTE', 'evento ausente del eje: ' + evId.slice(0, 8));
  if (indices.length > ARIDAD) throw new Parada('PENDIENTE', 'posición sin desarrollar: más de diez profundidades');
  const dir = direccion(indices);
  autorizar(ctx, evId, indices);
  // Orden por defecto: el del encaje (coincidencias de ruta, luego llegada). ORDENAR lo discute.
  const elegidos = ocupantesElegibles(ctx.eje, evId, indices, { exacto, ...(llegada === undefined ? {} : { orden: 'llegada' }) });
  const { noElegibles } = elegidos;
  let lista = elegidos.lista;
  if (llegada !== undefined) {
    // El ocupante k por llegada (VG, 7-11 noche): cada propio, elemento de lista o escrito es uno; lo que
    // alcanza una referencia va con ella, detrás, como en BUSCAR(n).
    const porLlegada = [];
    for (const o of lista) {
      if (o.tipo === 'referencia' && porLlegada.length) porLlegada.at(-1).push(o);
      else porLlegada.push([o]);
    }
    lista = porLlegada[llegada] ?? [];
  }
  for (const o of lista) autorizarOcupante(ctx, o, evId, dir);
  const items = lista.map((o) => ({
    origen: o.origen, evento: o.evento, indices: o.camino ?? indicesDe(o.dir), ...(o.enLista ? { lista: o.indice } : {}), procedencia: o.procedencia, autor: o.autor, t: o.t,
    vector: o.vector, distancia: o.distancia, acuerdo: o.acuerdo, signo: o.signo, faltas: o.faltas, excedentes: o.excedentes, origenDir: o.origenDir, destino: o.destino,
  }));
  const tope = ctx.limites.candidatos;
  if (items.length > tope) throw limite('más de ' + tope + ' candidatos en ' + evId.slice(0, 8) + ':' + dir, { examinados: tope, de: items.length });
  return noElegibles > 0 ? { ...col(items), noElegibles } : col(items);
}

/** Valor de un candidato, o de su subposición k... (leyendo fórmulas si las hay). Un elemento de lista se lee dentro de su lista. */
function valorCandidato(ctx, item, sub = []) {
  if (item.lista !== undefined) return leerSlot(ctx, item.evento, item.indices, { elemento: { lista: item.lista, sub } });
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
      return leerSlot(ctx, resolverId(ctx, args[0]), idx, { porDireccion: true }); // una dirección nunca entra en una lista
    }
    case 'BUSCAR': {
      if (!args.length) throw new Parada('ERROR', 'BUSCAR espera una posición');
      // Un texto de diez dígitos es dirección (absoluta en el registro); números, índices relativos al anfitrión.
      if (args[0].tipo === 'texto') {
        if (args.length > 1 || !esDireccion(args[0].valor)) throw new Parada('ERROR', 'BUSCAR espera índices 0–9 o una dirección de diez dígitos');
        return buscar(ctx, evId, indicesDe(args[0].valor), { exacto: false }); // dirección: la colisión entera
      }
      if (args.length === 1) return buscar(ctx, evId, [...anfitrion, ...indicesDeArgs(args, 'BUSCAR')], { exacto: true }); // índice: camino exacto
      // Con dos o más números, el último es el índice en la lista de la posición (por llegada, desde 0, sin tope de diez).
      const k = args.at(-1);
      if (k.tipo !== 'numero' || !Number.isInteger(k.valor) || k.valor < 0) throw new Parada('ERROR', 'BUSCAR espera como último número el índice en la lista, entero ≥ 0');
      return buscar(ctx, evId, [...anfitrion, ...indicesDeArgs(args.slice(0, -1), 'BUSCAR')], { exacto: true, llegada: k.valor });
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
    case 'BASES': {
      // Como CAJA y FRESCURA (mapa §12 [D] «Una sola verdad del 8»: BASES/CAJA/FRESCURA heredan puedeLeer y
      // presupuesto): primero se valida, luego se lee (y se cobra y se autoriza) el 8; situar al anfitrión es
      // leerlo entero, y la medida evalúa sus fórmulas sin el gancho, así que con gancho no se cuentan.
      const crudos = args.map((a) => (a.tipo === 'numero' || a.tipo === 'texto' ? a.valor : null));
      const mal = erroresDeBases(crudos);
      if (mal) throw new Parada('ERROR', mal);
      leerCohorte(ctx, evId, crudos.length ? crudos[0] : PROPIO);
      const r = valorDeBases(ctx.eje, evId, crudos);
      if (r.mideAnfitrion) {
        autorizar(ctx, evId, []);
        if (ctx.puedeLeer && MEDIDAS_FORMULAS.includes(crudos[1])) throw sinGanchoEnFormulas(evId);
        ctx.dependencias.add(evId + ':' + direccion([]));
      }
      if (r.estado !== 'RESUELTO') throw new Parada(r.estado, r.motivo);
      return num(r.valor);
    }
    case 'CAJA': {
      if (!args.length || args.length > 2) throw new Parada('ERROR', 'CAJA espera una medida y, si acaso, un alcance');
      const medida = medidaDe(args[0]);
      return num(cajaDelFoco(ctx, evId, medida, alcanceDe(args[1], 'CAJA')));
    }
    case 'FRESCURA': {
      if (args.length > 1) throw new Parada('ERROR', 'FRESCURA espera, si acaso, un alcance');
      const { frescura: f } = leerCohorte(ctx, evId, alcanceDe(args[0], 'FRESCURA')).base;
      return num(f.hijosNuevos + f.basesNuevas + f.debajo);
    }
    case 'VALOR_R': {
      if (args.length !== 1 || args[0].tipo !== 'texto' || !args[0].valor) throw new Parada('ERROR', 'VALOR_R espera el nombre del titular entre comillas');
      return num(valorConLente(ctx, args[0].valor));
    }
    case 'LENTE': {
      if (args.length !== 1 || args[0].tipo !== 'texto' || !args[0].valor) throw new Parada('ERROR', 'LENTE espera el nombre de un emisor de R entre comillas');
      return num(lenteDelLector(ctx, 'LENTE').pesos.get(args[0].valor) ?? 0);
    }
    case 'Y': return bool(args.every((a) => exigirBool(a, 'Y')));
    case 'O': return bool(args.some((a) => exigirBool(a, 'O')));
    case 'NO': return bool(!exigirBool(args[0], 'NO'));
    default: throw new Parada('ERROR', 'función desconocida: ' + nodo.nombre);
  }
}

// ---------- BASES, CAJA y FRESCURA: leen el 8 ----------
// El foco es el anfitrión (el registro de la fórmula), como en BASES. El
// alcance elige qué 8 se lee: el del padre (hermanos), el del proyecto o el
// del génesis (mapa §12 [D] «Cohortes y bases del 8»). La lectura la hace
// src/bases.js (basesEn, leerBase, valorDeBases); aquí no se escribe nada.

const MEDIDAS_FORMULAS = Object.freeze(['formulasResueltas', 'formulasPendientes']);

/** Con gancho, las medidas de fórmulas del anfitrión no se dan (CAJA y BASES): medirlas evalúa sus fórmulas sin el gancho. */
function sinGanchoEnFormulas(foco) {
  return new Parada('PENDIENTE DE AUTORIZACIÓN', 'contar las fórmulas de ' + foco.slice(0, 8) + ' las evalúa sin el gancho de autorización: con gancho no se cuentan');
}
const FORMAS_SERIE = 'T:<escala>, E:<emisor>/<denominación>, P:<ámbito> o R:<emisor>';

function alcanceDe(arg, nombre) {
  if (arg === undefined) return 'hermanos';
  if (arg.tipo !== 'texto' || !ALCANCES.includes(arg.valor)) throw new Parada('ERROR', nombre + ': el alcance es ' + ALCANCES.join(', '));
  return arg.valor;
}

/** Clave de serie bien formada: T con una escala que existe; E con emisor y denominación; P y R con un solo campo. */
function esSerie(clave) {
  const r = /^([TEPR]):(.+)$/.exec(clave);
  if (!r) return false;
  const [, token, serie] = r;
  if (token === 'T') return ESCALAS_T.includes(serie);
  const barra = serie.indexOf('/');
  if (token === 'E') return barra > 0 && barra < serie.length - 1;
  return barra < 0;
}

/** Una medida de bases.MEDIDAS o una serie de token bien formada; otro nombre es ERROR, aunque no haya base. */
function medidaDe(arg) {
  if (arg.tipo !== 'texto') throw new Parada('ERROR', 'CAJA espera el nombre de una medida entre comillas, no ' + describir(arg));
  if (clavesDeMedidas().includes(arg.valor) || esSerie(arg.valor)) return arg.valor;
  throw new Parada('ERROR', 'CAJA: medida desconocida: ' + arg.valor + ' (' + clavesDeMedidas().join(', ') + ' o una serie ' + FORMAS_SERIE + ')');
}

/**
 * Una serie bien formada que el eje no tiene (E, R o T sin emitir; P de un
 * ámbito que no es un registro) no se lee como «caja 0»: PENDIENTE (la
 * emisión puede llegar), con las series que hay, para ver la errata.
 */
function exigirSerie(eje, clave) {
  if (clavesDeMedidas().includes(clave)) return;
  const [token, serie] = [clave[0], clave.slice(2)];
  if (token === 'P' ? serie === AMBITO_GENESIS || eje.obtener(serie) : eje.serie(clave).emitido > 0) return;
  const hay = eje.series().map((s) => s.clave);
  const lista = hay.slice(0, 10).join(', ') + (hay.length > 10 ? '…' : '');
  const que = token === 'P' ? 'el ámbito de ' + clave + ' no es un registro del eje' : 'la serie ' + clave + ' no se ha emitido en el eje';
  throw new Parada('PENDIENTE', 'CAJA: ' + que + ' (series emitidas: ' + lista + ')');
}

/**
 * Cómo escribir la base que falta (el motivo de PENDIENTE lo dice): la
 * escribe la propia cosa o quien tiene P sobre el registro, con clave. La
 * cosa (que sale del contexto del registro) se nombra solo si el gancho deja
 * leer el registro; quienes tienen P (que salen de los saldos del eje), siempre.
 */
function comoEscribirla(ctx, registro, alcance) {
  const { eje } = ctx;
  const id8 = registro.slice(0, 8);
  const cosa = identidadDe(eje, registro);
  const conPoder = eje.identidades().filter((x) => x !== cosa && eje.clave(x) && eje.poderSobre(x, registro) > 0).sort();
  if (!cosa && !conPoder.length) {
    return id8 + ' no tiene identidad propia con clave (identidadDe) y nadie con clave tiene poder (P) sobre él: nadie puede escribir su base.';
  }
  const nombrarCosa = Boolean(cosa) && (!ctx.puedeLeer || ctx.puedeLeer(registro, direccion([]), []));
  const quien = [...(cosa ? [nombrarCosa ? cosa + ' (su identidad propia)' : 'su identidad propia'] : []), ...conPoder.map((x) => x + ' (con P sobre él)')].join(' o ');
  const que = alcance === 'hermanos' || alcance === PROPIO
    ? 'mide sus hijos'
    : 'mide sus hijos y funde la base vigente del 8 de cada uno (se escriben antes, de abajo arriba; un hijo sin base cuenta solo por sí mismo)';
  return 'Para escribirla: escribirBase(eje, { registro, autor, privada }) con registro = ' + id8 + ', firmada por ' + quien
    + '; ' + que + ' y gasta ' + COSTE_BASE.cantidad + ' ' + COSTE_BASE.escala + ' de su ' + COSTE_BASE.token + '.';
}

/** Alcance interno de BASES() sin argumentos: el 8 del propio anfitrión. */
const PROPIO = 'propio';

/**
 * La base vigente del 8 que resume el alcance del foco (leerBase, con su
 * frescura), autorizada y cobrada. Se cobra lo que la lectura examina,
 * contado mientras se examina y antes de medir nada: 1 por la base; los
 * escritos sobre el registro (entre ellos se busca la base y se cuentan los
 * hijos nuevos); y, como hace la frescura, los escritos sobre cada hijo
 * medido (su 8) y, bajando por las bases fundidas que siguen vigentes, lo
 * mismo en cada una. En cuanto no cabe, PENDIENTE POR LÍMITE, «al menos»
 * (se deja de contar). Sin base escrita, PENDIENTE con el modo de escribirla:
 * BQL nunca calcula al vuelo. El alcance PROPIO (BASES() sin argumentos) lee
 * el 8 del propio foco.
 */
function leerCohorte(ctx, foco, alcance) {
  const { eje } = ctx;
  const ev = eje.obtener(foco);
  if (!ev) throw new Parada('PENDIENTE', 'evento ausente del eje: ' + foco.slice(0, 8));
  const registro = alcance === PROPIO ? foco : alcance === 'hermanos' ? ev.sobre : alcance === 'proyecto' ? proyectoDe(eje, foco).id : eje.genesisId;
  if (registro === null) throw new Parada('PENDIENTE', 'sin cohorte: el génesis no tiene padre');
  ctx.dependencias.add(registro + ':' + CIELO); // el 8 leído: una base que llegue cambia el resultado
  const quedan = Math.max(ctx.presupuesto, 0);
  let coste = 1 + eje.sobre(registro).length;
  const noCabe = () => limite(
    'el alcance ' + alcance + ' (8 de ' + registro.slice(0, 8) + ') exige examinar al menos ' + coste + ' registros y quedan ' + quedan + ' pasos de presupuesto',
    { examinados: 0, de: coste },
  );
  if (coste > quedan) throw noCabe();
  const vigente = (id) => basesEn(eje, id).at(-1) ?? null;
  const base = vigente(registro);
  if (!base) {
    ctx.presupuesto -= coste;
    const donde = alcance === PROPIO ? 'su propio 8' : 'alcance ' + alcance;
    throw new Parada('PENDIENTE', SIN_BASE_ESCRITA + ' en el 8 de ' + registro.slice(0, 8) + ' (' + donde + '). ' + comoEscribirla(ctx, registro, alcance));
  }
  const porVisitar = [base];
  while (porVisitar.length) {
    const b = porVisitar.pop();
    const fundidas = new Set(b.refsBases);
    for (const h of b.refsHijos) {
      coste += eje.sobre(h).length;
      if (coste > quedan) throw noCabe();
      const v = vigente(h);
      if (v && fundidas.has(v.id)) porVisitar.push(v);
    }
  }
  ctx.presupuesto -= coste;
  autorizar(ctx, base.id, [], 'leer la base del 8 de ' + registro.slice(0, 8));
  ctx.dependencias.add(base.id + ':' + direccion([]));
  return { registro, base: leerBase(eje, registro) };
}

/**
 * Caja (0–9) del foco en una medida y un alcance: la de BASES(alcance,
 * medida) (valorDeBases). Primero la base (sin base, el foco no se mide);
 * después el foco: situarlo es medirlo y medirlo es leerlo entero. Con
 * gancho, las fórmulas del foco no se cuentan: la medida las evalúa sin él.
 */
function cajaDelFoco(ctx, foco, medida, alcance) {
  exigirSerie(ctx.eje, medida);
  leerCohorte(ctx, foco, alcance);
  autorizar(ctx, foco, []);
  if (ctx.puedeLeer && MEDIDAS_FORMULAS.includes(medida)) throw sinGanchoEnFormulas(foco);
  ctx.dependencias.add(foco + ':' + direccion([]));
  const r = valorDeBases(ctx.eje, foco, [alcance, medida]);
  if (r.estado !== 'RESUELTO') throw new Parada(r.estado, r.motivo.replace(/^BASES/, 'CAJA'));
  return r.valor;
}

// ---------- VALOR_R y LENTE: la lente de R (R6) ----------
// R vale solo ante quien la lee, con la lente que ese lector firmó
// (src/lente.js). Aquí no se suma nada: la suma ponderada es de
// lente.detalleValor.

/** Cobra `coste` pasos del presupuesto; si no caben, PENDIENTE POR LÍMITE sin haber leído nada. */
function cobrar(ctx, coste, que) {
  const quedan = Math.max(ctx.presupuesto, 0);
  if (coste > quedan) throw limite(que + ' exige examinar ' + coste + ' registros y quedan ' + quedan + ' pasos de presupuesto', { examinados: 0, de: coste });
  ctx.presupuesto -= coste;
}

/**
 * La lente del lector que consulta, leída con el gancho y cobrada (un paso
 * por declaración). Sin lector o sin lente, PENDIENTE: puede llegar una
 * declaración (por eso el resultado depende de la posición 3 de cada ancla).
 */
function lenteDelLector(ctx, nombre) {
  if (!ctx.lector) throw new Parada('PENDIENTE', nombre + ': sin lector no hay lente, y sin lente R no vale nada (opciones.lector)');
  for (const a of anclasDeLente(ctx.eje, ctx.lector)) ctx.dependencias.add(a + ':' + POSICION_LENTE);
  const lente = lenteDe(ctx.eje, ctx.lector);
  if (!lente) {
    throw new Parada('PENDIENTE', nombre + ': ' + ctx.lector + ' no ha declarado su lente de R (un evento suyo en la posición 3 de su alta, con pares [emisor, peso]); sin lente, R no vale nada');
  }
  cobrar(ctx, lente.declaraciones.length, nombre + ' (la lente de ' + ctx.lector + ')');
  for (const id of lente.declaraciones) {
    autorizar(ctx, id, [], 'leer la lente de ' + ctx.lector);
    ctx.dependencias.add(id + ':' + direccion([]));
  }
  return lente;
}

/** VALOR_R(titular): Σ peso × participación sobre los emisores de la lente (lente.detalleValor), con el gancho y el presupuesto. */
function valorConLente(ctx, titular) {
  lenteDelLector(ctx, 'VALOR_R');
  const d = detalleValor(ctx.eje, ctx.lector, titular);
  cobrar(ctx, d.eventos.length, 'VALOR_R (las tenencias de R de ' + titular + ')');
  for (const id of d.eventos) {
    autorizar(ctx, id, [], 'leer una tenencia de R de ' + titular);
    ctx.dependencias.add(id + ':' + direccion([]));
  }
  return d.valor;
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
    // Diez dígitos son una dirección (no entra en una lista); un camino de índices, sí.
    const porDireccion = !Array.isArray(dir);
    const contenido = leerPosicion(ctx, evId, indices, { porDireccion });
    return esFormula(contenido) ? leerSlot(ctx, evId, indices, { porDireccion }) : valorDe(contenido, indices);
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
    // Una lista (por hojas) se escribe con sus ocupantes, en su orden: 'ensalada · guiso · fruta'.
    case 'lista': return v.valor.map((x) => (esReferencia(x) ? '→ ' + x.ref.slice(0, 8) : typeof x === 'string' ? desescapar(x) : String(x))).join(' · ');
    case 'referencia': return '→ ' + v.valor.ref.slice(0, 8);
    case 'coleccion': return v.items.length + (v.items.length === 1 ? ' candidato' : ' candidatos') + (v.items.length ? ': ' + v.items.map((i) => i.origen + ' ' + i.evento.slice(0, 8)).join(' · ') : '')
      + (v.noElegibles ? ' (y ' + v.noElegibles + ' no elegibles, sin contar)' : '');
    default: return '?';
  }
}
