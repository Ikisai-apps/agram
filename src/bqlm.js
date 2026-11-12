// BQL mínimo (BQLM): expresiones sobre posiciones BTML, con un léxico corto en
// inglés (VG, 9-11, mapa §16 [D] «Molde de regla y léxico mínimo de BQL»). No
// sustituye todavía a src/bql.js: es el módulo que después evaluará las
// condiciones de las reglas de la época (el 2 de cada regla, src/epocas.js).
// Gramática, semántica y ejemplos: docs/BQLM.md.
//
// Léxico, exacto y nada más:
//   posiciones      X.d.d…  (X = ev, epoch, before, it, it2…, o una expresión entre paréntesis)
//   índice por valor X.(expr)  (un dígito 0-9 es esa posición; un texto, los ocupantes que se llaman así)
//   listas          first M · last M · nth k M (desde 0) · M each d.d… · M where cond (it, it2… es el elemento;
//                   en una lectura, regla con «read» en su 4, it es lo que se lee y el primer where da it2)
//   árbol           up X · down X · path X (padre por el ancla 6.5, hijos anclados, hilo hasta la raíz; tope 10)
//                   · under X (X y todo lo que cuelga de él, a cualquier profundidad, por llegada; el presupuesto es el tope)
//   libro           moves X (los asientos del libro de X, por llegada: de un registro, lo que asentó su transacción,
//                   también lo que añade el libro; de una identidad, donde es de o a; de una serie, todos los suyos)
//   orden           M by e (M ordenado por e, de menor a mayor; los empates, por llegada; como where, da it2…)
//   recuento        count · sum · max · min
//   aritmética      + - * / floor
//   comparación     = != < <= > >=
//   lógica          and or not in
//   literales       números, "texto", y los símbolos mint transfer lock release burn y E P R T (valen su nombre)
//   series          la serie como posición de su familia (VG 12-11, decisión 5 del estudio BQL-transacciones):
//                   T.d (la escala d: T.1 el minuto, T.8 el futuro) · R.(emisor) · E.(emisor).(denominación)[.(registro)]
//                   · P.(ámbito)[.(origen)]; vale la clave de la serie (el contexto la da como serie, D-SERIE)
//   mover           (solo en una plantilla de transacción: invariante del núcleo, decisión 6) los cinco símbolos como
//                   verbos: mint q S to A [price Pr] [when F] · transfer q S from A to B [exit E] [when F]
//                   · lock q S from A exit E · release q S from A exit E · burn q S from A [when F]; y en una
//                   plantilla, put v at A.1.(S).1 (el nivel en mano: acuña lo que falte). Cada verbo vale verdadero
//                   (el condicional es «cond and verbo», con and perezoso); lo que vale cero o nada no se mueve.
//                   memo es el payload de la candidata, sin movimientos ni metadatos
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
//   contexto.ocupantes(nodo, camino, presupuesto)
//                                   los ocupantes de la posición `camino` (dígitos 0-9) del nodo, por
//                                   llegada; gasta del Presupuesto de la evaluación cada ocupante que
//                                   expande; puede lanzar una Parada PENDIENTE (o POR LÍMITE)
//   contexto.padre(nodo)            el registro padre (por el ancla 6.5), null en la raíz, undefined si el
//                                   nodo no es un registro
//   contexto.hijos(nodo)            los registros anclados sobre él, por llegada; undefined si no es un registro
//   contexto.subarbol(nodo, pres.)  (opcional) el nodo y todo lo que cuelga de él, por llegada; undefined si no es un
//                                   registro. Sin él, under recorre hijos en profundidad
//   contexto.asientos(nodo, pres.)  (opcional) los asientos del libro de un registro, una identidad o una serie, como
//                                   ocupantes con su D-MOV; undefined si el nodo no tiene libro. Sin él, moves es ERROR
//   contexto.valor(nodo)            el escalar de un nodo que no es número ni texto (el id de un registro),
//                                   o undefined (una décupla no tiene valor)
//   contexto.texto(nodo)            (opcional) cómo se escribe el nodo en un mensaje
//   contexto.serie(familia, partes) (opcional) la serie que nombran T.d, R.(x), E.(x).(y)[.(z)] y P.(x)[.(y)]: un nodo
//                                   cuyo valor es su clave, o undefined si las partes no hacen una serie. Sin él,
//                                   construir una serie es ERROR
//
// Mover (VG 12-11, decisiones 5 y 6): un verbo solo se evalúa con opciones.mover (evaluarPlantilla: las sentencias del
// 4 de una plantilla de transacción, que construye la candidata y que firma quien la lanza); en cualquier otra
// evaluación (una condición, una lectura, una regla que escribe, el 2 de una plantilla) una fórmula con un verbo es
// ERROR aunque el verbo no se llegue a evaluar. `put` solo vale en una regla que escribe (opciones.escribir: el libro
// acuña por su cuenta hasta un nivel, solo en los destinos de DESTINOS_DE_PUT) o en una plantilla (el nivel en mano).
//
// Primitivas de verificación (Core AGRAM 12-11, #67; docs/BQLM.md §12): bytes hex utf8 hash sha256 sha256d cat slice
// reverse le below merkle ots cabecera tx signed, escritas como llamadas, nombre(a, b…). Son PURAS: solo leen sus
// argumentos (nada del contexto ni de fuera), nunca firman ni ven claves privadas, y cuentan en el presupuesto por byte
// procesado (LIMITES.bytes). Traen un tipo nuevo, los BYTES (esBytes), distinto de texto y número: en los datos BTML
// viajan como texto hex y se convierten con bytes(…); se leen en hex. cabecera(…) y tx(…) dan una décupla pura, que se
// lee por posiciones como cualquier otra. Una regla que las usa sigue solo leyendo.
//
// Los ocupantes son números, textos o nodos opacos del contexto (y, de las primitivas de verificación, bytes y décuplas
// puras). Hay una implementación sobre el eje en src/contexto-eje.js.

import { canonico } from './evento.js';
import { sha256, sha256d, hashEtiquetado, concatenar, deHex, aHex, igualesBytes, menor, enteroLe, leerCabecera, leerTx, raizMerkle, aplicarOts, verificarBip340 } from './cripto.js';

export const ESTADOS = Object.freeze(['RESUELTO', 'PENDIENTE', 'ERROR']);

/** Las cinco primitivas de la capa de transacciones (VG, 9-11, mapa §16 [D]): símbolos que valen su nombre. */
export const PRIMITIVAS = Object.freeze(['mint', 'transfer', 'lock', 'release', 'burn']);

/** Las cuatro familias de tokens, como símbolos. */
export const SIMBOLOS_FAMILIA = Object.freeze(['E', 'P', 'R', 'T']);

/**
 * Los nombres fijos que el contexto resuelve: la transacción candidata, el registro de la época, el libro de antes y,
 * desde el encargo 3c-2a (las acciones del aro), `me`: la identidad que mira (sus vistas: me.1 la cartera, me.2 el
 * criterio, me.3 los grupos de atención…), lo que una plantilla de transacción lee en su 2 para decidir si se ofrece.
 */
export const NOMBRES = Object.freeze(['ev', 'epoch', 'before', 'me', 'memo']);

/** Las palabras de enlace de un verbo (VG 12-11, decisión 5): de quién, a quién, la salida, la fecha y el precio. */
export const ENLACES = Object.freeze(['from', 'to', 'exit', 'when', 'price']);

/**
 * Las palabras del léxico (sin los nombres, los símbolos ni it, it2…). `put v at X.d.(k)` es colocar (mapa §16 [D]:
 * «put v at X.d, colocar, solo reglas que escriben»; encargo 3b): vale verdadero y anota una escritura, que solo
 * evalúa una regla con «put» en su 4 (evaluarEscritura) o, el nivel en mano, una plantilla (evaluarPlantilla).
 */
export const PALABRAS = Object.freeze(['first', 'last', 'nth', 'each', 'where', 'by', 'up', 'down', 'path', 'under', 'moves', 'count', 'sum', 'max', 'min', 'floor', 'and', 'or', 'not', 'in', 'put', 'at', ...ENLACES]);

/**
 * Invariante del núcleo (VG 12-11, decisión 6): los destinos de un `put` en una regla que escribe, lista cerrada.
 * El libro, por su cuenta (sin firma), solo acuña hasta un nivel aquí: hoy, `A.2.1` (el P posicionado, la obtención).
 */
export const DESTINOS_DE_PUT = Object.freeze([Object.freeze([2, 1])]);

/** Cuántas partes lleva la serie de cada familia: [mínimo, máximo] (T.d · R.(emisor) · E.(emisor).(denominación)[.(registro)] · P.(ámbito)[.(origen)]). */
const PARTES_DE_FAMILIA = Object.freeze({ T: [1, 1], R: [1, 1], E: [2, 3], P: [1, 2] });

/** Cómo se escribe cada verbo (los mensajes de sintaxis). */
const FORMAS = Object.freeze({
  mint: 'mint q S to A [price Pr] [when F]',
  transfer: 'transfer q S from A to B [exit E] [when F]',
  lock: 'lock q S from A exit E',
  release: 'release q S from A exit E',
  burn: 'burn q S from A [when F]',
});

/**
 * Límites de cálculo: pasos de una evaluación, ocupantes que el contexto puede
 * expandir en una evaluación (el máximo de Scened, 10000), anidamiento de la
 * expresión y niveles de un hilo (`path`). Pasarse es PENDIENTE POR LÍMITE.
 */
export const LIMITES = Object.freeze({ pasos: 100000, ocupantes: 10000, anidamiento: 100, hilo: 10, bytes: 2000000 });

/**
 * Las primitivas de verificación (Core AGRAM 12-11, #67; docs/BQLM.md §12): su forma y cuántos argumentos llevan
 * ([mínimo, máximo]). Puras: sin efectos, sin contexto, sin firmar.
 */
export const VERIFICACION = Object.freeze({
  bytes: Object.freeze({ forma: 'bytes(hex)', aridad: [1, 1] }),
  hex: Object.freeze({ forma: 'hex(b)', aridad: [1, 1] }),
  utf8: Object.freeze({ forma: 'utf8(texto)', aridad: [1, 1] }),
  hash: Object.freeze({ forma: 'hash(x) o hash(x, etiqueta)', aridad: [1, 2] }),
  sha256: Object.freeze({ forma: 'sha256(b)', aridad: [1, 1] }),
  sha256d: Object.freeze({ forma: 'sha256d(b)', aridad: [1, 1] }),
  cat: Object.freeze({ forma: 'cat(b1, b2, …)', aridad: [1, Infinity] }),
  slice: Object.freeze({ forma: 'slice(b, desde, hasta)', aridad: [3, 3] }),
  reverse: Object.freeze({ forma: 'reverse(b)', aridad: [1, 1] }),
  le: Object.freeze({ forma: 'le(b)', aridad: [1, 1] }),
  below: Object.freeze({ forma: 'below(a, b)', aridad: [2, 2] }),
  merkle: Object.freeze({ forma: 'merkle(hoja, camino, esquema)', aridad: [3, 3] }),
  ots: Object.freeze({ forma: 'ots(raiz, pasos)', aridad: [2, 2] }),
  cabecera: Object.freeze({ forma: 'cabecera(b)', aridad: [1, 1] }),
  tx: Object.freeze({ forma: 'tx(b)', aridad: [1, 1] }),
  signed: Object.freeze({ forma: 'signed(firma, mensaje, clave)', aridad: [3, 3] }),
});

/** Lo que cuesta verificar una firma BIP-340, en bytes del presupuesto (una verificación cuesta como hashear ~64 KB). */
export const COSTE_FIRMA = 65536;

/** El subtipo de PENDIENTE cuando se agota un límite de cálculo (como en BQL V0). */
export const POR_LIMITE = 'PENDIENTE POR LÍMITE';

/** Una parada de la evaluación: PENDIENTE (con su subtipo, si lo hay) o ERROR, con su motivo. */
export class Parada extends Error {
  constructor(estado, motivo, subtipo) {
    super(motivo);
    this.estado = estado;
    if (subtipo) this.subtipo = subtipo;
  }
}

/** Parada PENDIENTE (para los contextos: falta algo que puede llegar). */
export const pendiente = (motivo) => new Parada('PENDIENTE', motivo);
/** Parada PENDIENTE POR LÍMITE: se agotó un límite de cálculo. */
export const porLimite = (motivo) => new Parada('PENDIENTE', 'límite de cálculo: ' + motivo, POR_LIMITE);
const fallo = (motivo) => new Parada('ERROR', motivo);

/**
 * Los símbolos: las cinco primitivas, las cuatro familias y «nadie» (el otro
 * lado de una emisión o de un consumo). Son objetos propios, congelados, que
 * solo produce el contexto desde el libro (la primitiva y la familia de un
 * movimiento real) y el analizador desde un literal: un texto del payload
 * «burn» no es igual al símbolo `burn`, así que el payload no puede fabricar
 * un movimiento (revisión de seguridad, SEG-09) ni hacerse pasar por «nadie»
 * (SEG-11). Se leen por su nombre.
 */
const MARCA = new WeakSet();
function simbolo(nombre) {
  const s = Object.freeze({ simbolo: nombre });
  MARCA.add(s);
  return s;
}
export const SIMBOLOS = Object.freeze(Object.fromEntries([...PRIMITIVAS, ...SIMBOLOS_FAMILIA, 'nadie'].map((n) => [n, simbolo(n)])));
/** Quien está al otro lado de una emisión (de = null) o de un consumo (a = null): un símbolo, nunca un texto. */
export const NADIE = SIMBOLOS.nadie;
/** ¿Es `o` uno de los símbolos de BQLM? */
export const esSimbolo = (o) => MARCA.has(o);

/**
 * El presupuesto compartido de una evaluación: cuántos ocupantes puede
 * expandir el contexto (cada uno cuenta, también cada salto de referencia) y
 * la memoria de las referencias ya seguidas, por (ref, dir). El evaluador lo
 * pasa al contexto en cada llamada a ocupantes.
 */
export class Presupuesto {
  constructor(tope = LIMITES.ocupantes, topeBytes = LIMITES.bytes) {
    this.tope = tope;
    this.usados = 0;
    this.memo = new Map();
    // Los bytes que procesan las primitivas de verificación (§12): cada una paga lo que lee o produce antes de hacerlo.
    this.topeBytes = topeBytes;
    this.bytes = 0;
  }

  gastar(n = 1) {
    this.usados += n;
    if (this.usados > this.tope) throw porLimite('más de ' + this.tope + ' ocupantes expandidos');
  }

  gastarBytes(n) {
    this.bytes += n;
    if (this.bytes > this.topeBytes) throw porLimite('más de ' + this.topeBytes + ' bytes procesados por las primitivas de verificación');
  }
}

/**
 * Los bytes (§12): un valor propio, congelado, distinto de texto y número, que solo producen las primitivas de
 * verificación. Se leen en hex; dos bytes son iguales si lo son byte a byte. Un texto hex del payload no es bytes hasta
 * que pasa por bytes(…).
 */
const BYTES = new WeakSet();
function aBytesBql(u8) {
  const o = Object.freeze({ b: u8 });
  BYTES.add(o);
  return o;
}
/** ¿Es `o` un valor de bytes del BQL mínimo? */
export const esBytes = (o) => BYTES.has(o);
/** El hex de un valor de bytes (o undefined si no lo es). */
export const hexDe = (o) => (BYTES.has(o) ? aHex(o.b) : undefined);

/** Una décupla pura (la de cabecera(…) o tx(…)): pos[d] es la lista de ocupantes de su posición d. */
const PURAS = new WeakSet();
function pura(posiciones) {
  const pos = Array.from({ length: 10 }, (_, d) => Object.freeze(posiciones[d] ?? []));
  const o = Object.freeze({ pos: Object.freeze(pos) });
  PURAS.add(o);
  return o;
}
const esPura = (o) => PURAS.has(o);

const PREFIJAS = new Set(['first', 'last', 'count', 'sum', 'max', 'min', 'floor', 'up', 'down', 'path', 'under', 'moves']);
const COMPARACIONES = new Set(['=', '!=', '<', '<=', '>', '>=']);
const RESERVADAS = new Set([...PALABRAS, ...NOMBRES, ...PRIMITIVAS, ...SIMBOLOS_FAMILIA, ...Object.keys(VERIFICACION)]);
// Tras un símbolo de primitiva, ¿empieza un operando? Entonces es un verbo (mint 3 R.(me) to me); si no, el símbolo
// (burn in it.4, it.4 = burn).
const EMPIEZA_OPERANDO = new Set([...NOMBRES, ...PREFIJAS, 'nth', ...SIMBOLOS_FAMILIA]);

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
export function analizar(src, { sujeto = false } = {}) {
  if (typeof src !== 'string') throw fallo('sintaxis: una expresión es un texto');
  const cuerpo = src.startsWith('=') && !src.startsWith('==') ? src.slice(1) : src;
  const tokens = tokenizar(cuerpo);
  let i = 0;
  // Con sujeto (una lectura, B5), it ya es lo que se lee: el primer where da it2.
  let nivelWhere = sujeto ? 1 : 0;
  let anidamiento = 0;
  const ver = () => tokens[i];
  const es = (t, v) => tokens[i]?.t === t && (v === undefined || tokens[i].v === v);
  const donde = () => (tokens[i] ? 'en ' + tokens[i].pos + ' («' + tokens[i].v + '»)' : 'al final');
  const entrar = () => {
    if (++anidamiento > LIMITES.anidamiento) throw porLimite('expresión anidada más de ' + LIMITES.anidamiento + ' niveles');
  };
  const salir = () => { anidamiento--; };
  const esperar = (t, v) => {
    if (!es(t, v)) throw fallo('sintaxis: se esperaba «' + v + '» ' + donde());
    i++;
  };

  function expresion() {
    entrar();
    let base = disyuncion();
    // where y by (VG 12-11, decisión 2 del estudio BQL-transacciones): los dos dan el siguiente it al elemento.
    while (es('id', 'where') || es('id', 'by')) {
      const n = ver().v;
      i++;
      nivelWhere++;
      const cond = disyuncion();
      base = n === 'where' ? { n, base, cond, nivel: nivelWhere } : { n, base, clave: cond, nivel: nivelWhere };
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
    if (es('id', 'put')) {
      // put v at B.d….(k): el valor es una suma; el destino, una posición de B con el índice por valor al final.
      i++;
      entrar();
      const v = suma();
      if (!es('id', 'at')) throw fallo('sintaxis: put v at X.d.(k): falta «at» ' + donde());
      i++;
      const t = posfija();
      salir();
      // Tras el índice por valor puede seguir un camino de dígitos (encargo 3c-2a, P por mirada): put v at X.d.(k).e
      // coloca en la posición e de la entrada k (el P sobre la mirada e del registro k).
      const clave = t.n === 'paso' && !t.each && t.base?.n === 'clave' ? t.base : t;
      if (clave.n !== 'clave' || clave.base?.n !== 'paso' || clave.base.each) throw fallo('sintaxis: put coloca en una posición con su índice por valor: put v at X.d.(k) o put v at X.d.(k).e');
      return { n: 'put', v, t: clave, ...(clave !== t ? { sub: t.digitos } : {}) };
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
  /** La serie como posición de su familia (VG 12-11, decisión 5): T.d, R.(x), E.(x).(y)[.(z)], P.(x)[.(y)]. */
  function serieDeFamilia(familia) {
    const partes = [];
    while (es('op', '.')) {
      i++;
      if (es('op', '(')) {
        i++;
        partes.push(expresion());
        esperar('op', ')');
      } else if (es('dig')) {
        for (const d of digitos()) partes.push({ n: 'lit', v: d });
      } else throw fallo('sintaxis: la serie de ' + familia + ' se escribe con sus partes, ' + familia + '.d o ' + familia + '.(…) ' + donde());
    }
    const [min, max] = PARTES_DE_FAMILIA[familia];
    if (partes.length < min || partes.length > max) {
      throw fallo('sintaxis: la serie de ' + familia + ' lleva ' + (min === max ? min : min + ' o ' + max) + (max === 1 ? ' parte' : ' partes') + ' (T.d · R.(emisor) · E.(emisor).(denominación)[.(registro)] · P.(ámbito)[.(origen)]), no ' + partes.length);
    }
    return { n: 'serie', familia, partes };
  }
  function posfija() {
    let base = primaria();
    for (;;) {
      if (base.familia && es('op', '.')) {
        base = serieDeFamilia(base.familia);
        continue;
      }
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
      if (PRIMITIVAS.includes(tk.v) && empiezaOperando()) return verbo(tk.v);
      if (PRIMITIVAS.includes(tk.v)) return { n: 'lit', v: SIMBOLOS[tk.v] };
      if (SIMBOLOS_FAMILIA.includes(tk.v)) return { n: 'lit', v: SIMBOLOS[tk.v], familia: tk.v };
      const it = NIVEL_IT.exec(tk.v);
      if (it) {
        const nivel = it[1] ? Number(it[1]) : 1;
        if (nivel > nivelWhere) {
          throw fallo(nivel === 1 ? 'sintaxis: it solo vale dentro de where' : 'sintaxis: ' + tk.v + ' solo vale dentro de un where anidado ' + nivel + ' veces');
        }
        return { n: 'it', nivel, posicionable: true };
      }
      if (Object.hasOwn(VERIFICACION, tk.v)) {
        if (!es('op', '(')) throw fallo('sintaxis: ' + tk.v + ' es una primitiva de verificación y se escribe con sus argumentos entre paréntesis: ' + VERIFICACION[tk.v].forma);
        return llamadaPura(tk.v);
      }
      if (RESERVADAS.has(tk.v)) throw fallo('sintaxis: «' + tk.v + '» fuera de sitio en ' + tk.pos);
      const llamada = es('op', '(') ? ' (no hay funciones con nombre)' : '';
      throw fallo('no es BQL mínimo: «' + tk.v + '»' + llamada);
    }
    throw fallo('sintaxis: «' + tk.v + '» inesperado en ' + tk.pos);
  }
  /** Una primitiva de verificación (§12): f(a, b…), con su número de argumentos. */
  function llamadaPura(f) {
    i++; // «(»
    entrar();
    const args = [];
    if (!es('op', ')')) {
      for (;;) {
        args.push(expresion());
        if (!es('op', ',')) break;
        i++;
      }
    }
    esperar('op', ')');
    salir();
    const { forma, aridad: [min, max] } = VERIFICACION[f];
    if (args.length < min || args.length > max) {
      throw fallo('sintaxis: ' + forma + ' lleva ' + (min === max ? min : max === Infinity ? 'al menos ' + min : min + ' o ' + max) + (min === 1 && max === 1 ? ' argumento' : ' argumentos') + ', no ' + args.length);
    }
    return { n: 'llamada', f, args, posicionable: true };
  }
  /** ¿Empieza un operando en el token de ahora? (tras un símbolo de primitiva: entonces es un verbo). */
  function empiezaOperando() {
    const tk = ver();
    if (!tk) return false;
    if (tk.t === 'num' || tk.t === 'txt') return true;
    if (tk.t === 'op') return tk.v === '(';
    return tk.t === 'id' && (EMPIEZA_OPERANDO.has(tk.v) || NIVEL_IT.test(tk.v));
  }
  /**
   * Un verbo (VG 12-11, decisión 5): «v q S» y sus enlaces (from to exit when price), en cualquier orden y una vez
   * cada uno. q es una suma; S, una expresión prefija (la serie: T.1, R.(me), before.4.(…), (first …)).
   */
  function verbo(v) {
    entrar();
    const q = suma();
    if (!empiezaOperando()) throw fallo('sintaxis: ' + v + ' q S…: falta la serie ' + donde());
    const s = prefija();
    const enlaces = {};
    while (es('id') && ENLACES.includes(ver().v)) {
      const k = ver().v;
      i++;
      if (enlaces[k]) throw fallo('sintaxis: «' + k + '» dos veces en un ' + v);
      enlaces[k] = suma();
    }
    salir();
    const pide = { mint: ['to'], transfer: ['from', 'to'], lock: ['from', 'exit'], release: ['from', 'exit'], burn: ['from'] }[v];
    const admite = { mint: ['to', 'price', 'when'], transfer: ['from', 'to', 'exit', 'when'], lock: ['from', 'exit'], release: ['from', 'exit'], burn: ['from', 'when'] }[v];
    for (const k of pide) if (!enlaces[k]) throw fallo('sintaxis: ' + v + ' lleva «' + k + '»: ' + FORMAS[v]);
    for (const k of Object.keys(enlaces)) if (!admite.includes(k)) throw fallo('sintaxis: ' + v + ' no lleva «' + k + '»: ' + FORMAS[v]);
    return { n: 'verbo', v, q, s, ...enlaces };
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
 * No lanza. opciones.limites cambia LIMITES.pasos y LIMITES.ocupantes; un
 * límite agotado da PENDIENTE con subtipo «PENDIENTE POR LÍMITE».
 */
export function evaluar(src, contexto, opciones = {}) {
  try {
    const conSujeto = Object.hasOwn(opciones, 'sujeto');
    const arbol = typeof src === 'string' ? analizar(src, { sujeto: conSujeto }) : src;
    // Invariante del núcleo (VG 12-11, decisión 6): mover es de las plantillas; las reglas solo leen. Se mira el árbol
    // entero, no lo que se llega a evaluar: un verbo detrás de un and que da falso también es ERROR.
    const { verbo, put } = queMueve(arbol);
    if (verbo && !opciones.mover) throw fallo(verbo + ': solo una plantilla de transacción mueve (la firma quien la lanza); una regla solo lee (invariante del núcleo)');
    if (put && !opciones.mover && !opciones.escribir) throw fallo('put: solo en una regla que escribe (put en su 4) o en una plantilla de transacción');
    const st = {
      ctx: contexto, its: conSujeto ? [opciones.sujeto] : [], pasos: 0, tope: opciones.limites?.pasos ?? LIMITES.pasos, presupuesto: opciones.presupuesto instanceof Presupuesto ? opciones.presupuesto : new Presupuesto(opciones.limites?.ocupantes ?? LIMITES.ocupantes, opciones.limites?.bytes ?? LIMITES.bytes),
      escrituras: opciones.escribir && !opciones.mover ? [] : null, movimientos: opciones.mover ? [] : null,
    };
    const valor = calcular(arbol, st);
    return { estado: 'RESUELTO', valor, texto: textoDe(valor, contexto), ...(st.escrituras ? { escrituras: st.escrituras } : {}), ...(st.movimientos ? { movimientos: st.movimientos } : {}) };
  } catch (e) {
    if (e instanceof Parada) return { estado: e.estado, ...(e.subtipo ? { subtipo: e.subtipo } : {}), motivo: e.message };
    return { estado: 'ERROR', motivo: 'fallo al evaluar: ' + e.message };
  }
}

const MUEVE = new WeakMap();
/**
 * Lo que mueve una expresión (su árbol de analizar): { verbo: el primer verbo que lleva, o null; put: si lleva un put }.
 * Mira el árbol entero, también lo que no se llegaría a evaluar. Es la prueba del invariante (decisión 6).
 */
export function queMueve(arbol) {
  if (typeof arbol === 'string') arbol = analizar(arbol, { sujeto: true });
  if (!arbol || typeof arbol !== 'object') return { verbo: null, put: false };
  if (MUEVE.has(arbol)) return MUEVE.get(arbol);
  const fuera = { verbo: null, put: false };
  const pila = [arbol];
  while (pila.length) {
    const n = pila.pop();
    if (!n || typeof n !== 'object' || esSimbolo(n)) continue;
    if (n.n === 'verbo' && !fuera.verbo) fuera.verbo = n.v;
    if (n.n === 'put') fuera.put = true;
    for (const k of Object.keys(n)) {
      const x = n[k];
      if (Array.isArray(x)) pila.push(...x);
      else if (x && typeof x === 'object' && typeof x.n === 'string') pila.push(x);
    }
  }
  MUEVE.set(arbol, fuera);
  return fuera;
}

function paso(st, n = 1) {
  st.pasos += n;
  if (st.pasos > st.tope) throw porLimite('más de ' + st.tope + ' pasos');
}

function valorDe(o, ctx) {
  if (typeof o === 'number' || typeof o === 'string' || typeof o === 'boolean' || esSimbolo(o) || esBytes(o)) return o;
  if (esPura(o)) return undefined;
  return esNodo(o) ? ctx.valor?.(o) : undefined;
}

/** ¿Son el mismo valor? Los bytes, byte a byte; lo demás, idéntico. */
function mismo(a, b) {
  if (esBytes(a) || esBytes(b)) return esBytes(a) && esBytes(b) && igualesBytes(a.b, b.b);
  return a === b;
}

function leer(o, ctx) {
  if (typeof o === 'string') return o;
  if (typeof o === 'number' || typeof o === 'boolean') return String(o);
  if (esSimbolo(o)) return o.simbolo;
  if (esBytes(o)) return aHex(o.b);
  if (esPura(o)) return '«décupla»';
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
  return bajar(o, [0], st).map((x) => valorDe(x, st.ctx)).filter((x) => x !== undefined);
}

function igual(A, B, ctx) {
  if (A.length === 0 || B.length === 0) return A.length === 0 && B.length === 0;
  const a = valorDe(uno(A, 'comparar', ctx), ctx);
  const b = valorDe(uno(B, 'comparar', ctx), ctx);
  if (a === undefined || b === undefined) throw fallo('comparar: una décupla no tiene valor; lee una de sus posiciones');
  return mismo(a, b);
}

/**
 * Los ocupantes de la posición `digitos` de un ocupante: los del contexto o, si es una décupla pura (§12), los suyos.
 * Los bytes no tienen posiciones (se cortan con slice); un número tampoco.
 */
function bajar(o, digitos, st) {
  if (!esPura(o) && !esBytes(o)) return st.ctx.ocupantes(o, digitos, st.presupuesto);
  let actual = [o];
  for (const d of digitos) {
    actual = actual.flatMap((x) => {
      if (esBytes(x)) throw fallo('los bytes no tienen posiciones: córtalos con slice(b, desde, hasta)');
      if (esPura(x)) return x.pos[d];
      if (typeof x === 'number' || typeof x === 'boolean') return [];
      return st.ctx.ocupantes(x, [d], st.presupuesto);
    });
    st.presupuesto.gastar(actual.length);
  }
  return actual;
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
      return base.flatMap((o) => bajar(o, nodo.digitos, st));
    }
    case 'clave': {
      const base = calcular(nodo.base, st);
      const v = valorDe(uno(calcular(nodo.expr, st), 'la posición entre paréntesis', ctx), ctx);
      if (typeof v === 'number') {
        if (!Number.isInteger(v) || v < 0 || v > 9) throw fallo('una posición es un dígito 0-9, no ' + v);
        paso(st, base.length || 1);
        return base.flatMap((o) => bajar(o, [v], st));
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
    case 'by': {
      // Ordenar (VG 12-11): por la clave de cada elemento (un número o un texto, todas del mismo tipo), de menor a mayor;
      // los empates, en el orden en que llegan. Una clave vacía es PENDIENTE; una lista de más de uno, ERROR (como G3).
      const base = calcular(nodo.base, st);
      const antes = st.its[nodo.nivel - 1];
      const claves = [];
      try {
        for (const o of base) {
          paso(st);
          st.its[nodo.nivel - 1] = o;
          const x = uno(calcular(nodo.clave, st), 'by', ctx);
          const v = valorDe(x, ctx);
          if (typeof v !== 'number' && typeof v !== 'string') throw fallo('by ordena por un número o un texto, no «' + leer(x, ctx) + '»');
          claves.push(v);
        }
      } finally {
        st.its[nodo.nivel - 1] = antes;
      }
      if (new Set(claves.map((v) => typeof v)).size > 1) throw fallo('by: las claves mezclan números y textos');
      return base.map((o, k) => ({ o, k, v: claves[k] })).sort((a, b) => (a.v < b.v ? -1 : a.v > b.v ? 1 : a.k - b.k)).map((x) => x.o);
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
        return [calcular(nodo.b, st).some((o) => mismo(valorDe(o, ctx), v))];
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
    case 'serie': {
      // La serie como posición de su familia (VG 12-11, decisión 5): una parte vacía no hace serie (nada); la serie la
      // da el contexto (D-SERIE), exista ya o no: construir su clave no concede nada (lo deciden las reglas).
      const partes = [];
      for (const p of nodo.partes) {
        const l = calcular(p, st);
        if (!l.length) return [];
        partes.push(valorDe(uno(l, nodo.familia + '.(…)', ctx), ctx));
      }
      if (typeof ctx.serie !== 'function') throw fallo(nodo.familia + '.…: este contexto no construye series');
      const s = ctx.serie(nodo.familia, partes);
      return s === undefined || s === null ? [] : [s];
    }
    case 'verbo':
      return mover(nodo, st);
    case 'llamada':
      return verificar(nodo, st);
    case 'put': {
      // En una plantilla (evaluarPlantilla): el nivel en mano, put v at A.1.(S).1 acuña lo que falte.
      if (st.movimientos) return nivelEnMano(nodo, st);
      // Colocar (mapa §16 [D]): anota { sujeto, camino, clave, valor } por cada sujeto de la base del destino y vale
      // verdadero. El destino no se lee: es dónde se escribe. Solo en una regla que escribe (evaluarEscritura), y solo
      // en los destinos de la lista cerrada (invariante del núcleo, decisión 6): el libro acuña sin firma.
      if (!st.escrituras) throw fallo('put: solo en una regla que escribe (put en su 4)');
      if (!DESTINOS_DE_PUT.some((d) => d.length === nodo.t.base.digitos.length && d.every((x, k) => x === nodo.t.base.digitos[k]))) {
        throw fallo('put: una regla que escribe solo coloca en ' + DESTINOS_DE_PUT.map((d) => 'A.' + d.join('.')).join(', ') + ' (el libro, por su cuenta, solo acuña hasta un nivel en una lista cerrada), no en X.' + nodo.t.base.digitos.join('.'));
      }
      const valor = numero(calcular(nodo.v, st), 'put', ctx);
      const sujetos = calcular(nodo.t.base.base, st);
      const clave = valorDe(uno(calcular(nodo.t.expr, st), 'put: la clave', ctx), ctx);
      if (clave === undefined || esSimbolo(clave) || esBytes(clave)) throw fallo('put: la clave del destino es un valor (un id o un texto)');
      paso(st, sujetos.length || 1);
      // `desde`: el elemento del where en que se coloca (el movimiento, en las reglas que recorren ev.1), si lo hay: con
      // él, quien asienta sabe de qué serie viene la colocación (el tope por serie de la obtención, src/eje.js).
      const desde = st.its.filter((x) => x !== undefined).at(-1); // un where anidado ya cerrado deja su hueco en its
      for (const s of sujetos) {
        const sujeto = valorDe(s, ctx);
        if (sujeto === undefined || esSimbolo(sujeto)) continue; // nadie no recibe
        st.escrituras.push({ sujeto, camino: [...nodo.t.base.digitos], clave, valor, ...(nodo.sub ? { posicion: [...nodo.sub] } : {}), ...(desde !== undefined ? { desde } : {}) });
      }
      return [true];
    }
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
    case 'under':
      // Todo lo que cuelga (VG 12-11): el nodo y sus descendientes a cualquier profundidad, por llegada si el contexto
      // lo sabe (subarbol); si no, en profundidad por hijos. Cada nodo cuesta del presupuesto: ese es el tope.
      return lista.flatMap((o) => {
        paso(st);
        if (typeof ctx.subarbol === 'function') {
          const todos = ctx.subarbol(o, st.presupuesto);
          if (todos === undefined) throw fallo('under: «' + leer(o, ctx) + '» no es un registro');
          paso(st, todos.length);
          return todos;
        }
        if (ctx.hijos(o) === undefined) throw fallo('under: «' + leer(o, ctx) + '» no es un registro');
        const fuera = [];
        const pila = [o];
        while (pila.length) {
          const x = pila.pop();
          paso(st);
          st.presupuesto.gastar(1);
          fuera.push(x);
          const h = ctx.hijos(x) ?? [];
          for (let k = h.length - 1; k >= 0; k--) pila.push(h[k]);
        }
        return fuera;
      });
    case 'moves':
      // Leer el libro (VG 12-11, decisión 1): los asientos de cada nodo, con su D-MOV (docs/BQLM.md §3).
      return lista.flatMap((o) => {
        paso(st);
        const a = typeof ctx.asientos === 'function' ? ctx.asientos(o, st.presupuesto) : undefined;
        if (a === undefined) throw fallo('moves: «' + leer(o, ctx) + '» no es un registro, una identidad ni una serie del libro');
        paso(st, a.length);
        return a;
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

// ---------- primitivas de verificación (§12) ----------

const ORDINAL = ['primer', 'segundo', 'tercer', 'cuarto', 'quinto', 'sexto', 'séptimo', 'octavo', 'noveno', 'décimo'];
const ordinal = (k) => (ORDINAL[k] ?? k + 1 + '.º') + ' argumento';

/** Lo que una primitiva paga antes de procesar n bytes: un paso y n bytes del presupuesto. */
function pagar(st, n) {
  paso(st);
  st.presupuesto.gastarBytes(n);
}

/** El valor del k-ésimo argumento: uno solo (vacío → PENDIENTE; de más de uno → ERROR, como G3). */
function argumento(nodo, k, st) {
  const o = uno(calcular(nodo.args[k], st), nodo.f + ': el ' + ordinal(k), st.ctx);
  return valorDe(o, st.ctx);
}

function argBytes(nodo, k, st) {
  const v = argumento(nodo, k, st);
  if (!esBytes(v)) throw fallo(nodo.f + ': el ' + ordinal(k) + ' son bytes, no «' + leer(v, st.ctx) + '»: un texto hex se convierte con bytes(…) y uno legible con utf8(…)');
  return v.b;
}

function argTexto(nodo, k, st) {
  const v = argumento(nodo, k, st);
  if (typeof v !== 'string') throw fallo(nodo.f + ': el ' + ordinal(k) + ' es un texto, no «' + leer(v, st.ctx) + '»');
  return v;
}

function argEntero(nodo, k, st) {
  const v = argumento(nodo, k, st);
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) throw fallo(nodo.f + ': el ' + ordinal(k) + ' es un entero ≥ 0, no «' + leer(v, st.ctx) + '»');
  return v;
}

/**
 * Un camino o unos pasos como secuencia de valores (los hermanos de un camino de Merkle, los pasos de OpenTimestamps):
 * lo que viene en una lista se toma en orden; una décupla (la del dato BTML, [[lado, hermano], …], o una pura) se lee
 * posición a posición, 0 a 9, y se aplana. Así vale tanto la forma de SIP-0.md (una décupla de pares) como una lista
 * plana (lado, hermano, lado, hermano…), que no tiene el tope de diez de una décupla.
 */
function secuencia(lista, st, nivel = 0) {
  const fuera = [];
  for (const o of lista) {
    paso(st);
    const v = valorDe(o, st.ctx);
    if (v !== undefined) {
      fuera.push(v);
      continue;
    }
    if (nivel >= 3) throw fallo('el camino está anidado más de tres niveles');
    for (let d = 0; d <= 9; d++) fuera.push(...secuencia(bajar(o, [d], st), st, nivel + 1));
  }
  return fuera;
}

/** Bytes de un hermano o de un argumento de ots: bytes, o el texto hex en que viajan en los datos. */
function bytesDeDato(v, donde, st) {
  if (esBytes(v)) return v.b;
  const b = typeof v === 'string' ? deHex(v) : null;
  if (!b) throw fallo(donde + ': espera bytes o su texto hex, no «' + leer(v, st.ctx) + '»');
  return b;
}

/**
 * Evalúa una primitiva de verificación. Pura: solo lee sus argumentos; nunca llama al contexto más que para leerlos (los
 * evalúa calcular, como cualquier subexpresión) y no firma. Cada una paga en el presupuesto lo que procesa ANTES de
 * hacerlo, así que una entrada desmesurada se corta (PENDIENTE POR LÍMITE) sin llegar a procesarse.
 */
function verificar(nodo, st) {
  try {
    return calcularPrimitiva(nodo, st);
  } catch (e) {
    if (e instanceof Parada) throw e;
    throw fallo(e.message);
  }
}

function calcularPrimitiva(nodo, st) {
  const { ctx } = st;
  const f = nodo.f;
  switch (f) {
    case 'bytes': {
      const t = argumento(nodo, 0, st);
      if (typeof t !== 'string') throw fallo('bytes: convierte un texto hex, no «' + leer(t, ctx) + '»');
      pagar(st, Math.ceil(t.length / 2));
      const b = deHex(t);
      if (!b) throw fallo('bytes: «' + (t.length > 24 ? t.slice(0, 24) + '…' : t) + '» no es hex (cifras 0-9 y a-f, en número par)');
      return [aBytesBql(b)];
    }
    case 'hex': {
      const b = argBytes(nodo, 0, st);
      pagar(st, b.length);
      return [aHex(b)];
    }
    case 'utf8': {
      const t = argTexto(nodo, 0, st);
      pagar(st, t.length * 3);
      return [aBytesBql(new TextEncoder().encode(t))];
    }
    case 'hash': {
      const x = argumento(nodo, 0, st);
      let m;
      if (esBytes(x)) m = x.b;
      else if (typeof x === 'string' || typeof x === 'number') {
        pagar(st, typeof x === 'string' ? x.length * 3 : 32);
        m = new TextEncoder().encode(canonico(x));
      } else throw fallo('hash: hashea un texto, un número o bytes (la serialización canónica BTML de un valor), no «' + leer(x, ctx) + '»' + (x === undefined ? ': una décupla no tiene valor; hashea una de sus posiciones' : ''));
      if (nodo.args.length === 2) {
        const etiqueta = argTexto(nodo, 1, st);
        pagar(st, m.length + 64 + etiqueta.length * 3);
        return [aBytesBql(hashEtiquetado(etiqueta, m))];
      }
      pagar(st, m.length);
      return [aBytesBql(sha256(m))];
    }
    case 'sha256':
    case 'sha256d': {
      const b = argBytes(nodo, 0, st);
      pagar(st, b.length + (f === 'sha256d' ? 32 : 0));
      return [aBytesBql(f === 'sha256' ? sha256(b) : sha256d(b))];
    }
    case 'cat': {
      const partes = nodo.args.map((_, k) => argBytes(nodo, k, st));
      pagar(st, partes.reduce((n, p) => n + p.length, 0));
      return [aBytesBql(concatenar(...partes))];
    }
    case 'slice': {
      const b = argBytes(nodo, 0, st);
      const desde = argEntero(nodo, 1, st);
      const hasta = argEntero(nodo, 2, st);
      if (desde > hasta || hasta > b.length) throw fallo('slice: corta de ' + desde + ' a ' + hasta + ' (fin excluido) en ' + b.length + ' bytes: ha de ser 0 ≤ desde ≤ hasta ≤ ' + b.length);
      pagar(st, hasta - desde);
      return [aBytesBql(b.slice(desde, hasta))];
    }
    case 'reverse': {
      const b = argBytes(nodo, 0, st);
      pagar(st, b.length);
      return [aBytesBql(b.slice().reverse())];
    }
    case 'le': {
      const b = argBytes(nodo, 0, st);
      pagar(st, b.length);
      return [enteroLe(b)];
    }
    case 'below': {
      const a = argBytes(nodo, 0, st);
      const b = argBytes(nodo, 1, st);
      if (a.length !== b.length) throw fallo('below: compara bytes de la misma longitud, no ' + a.length + ' y ' + b.length);
      pagar(st, a.length);
      return [menor(a, b)];
    }
    case 'merkle': {
      const hoja = argBytes(nodo, 0, st);
      const esquema = argTexto(nodo, 2, st);
      if (esquema !== 'bitcoin' && esquema !== 'sip') throw fallo('merkle: el esquema es «bitcoin» o «sip», no «' + esquema + '»');
      const plano = secuencia(calcular(nodo.args[1], st), st);
      if (plano.length % 2) throw fallo('merkle: el camino son pares [lado, hermano], y aquí hay ' + plano.length + ' valores');
      const pasos = [];
      for (let k = 0; k < plano.length; k += 2) {
        const lado = plano[k];
        if (lado !== 'i' && lado !== 'd') throw fallo('merkle: el lado de un paso es «i» (el hermano a la izquierda) o «d» (a la derecha), no «' + leer(lado, ctx) + '»');
        pasos.push([lado, bytesDeDato(plano[k + 1], 'merkle: el hermano del paso ' + k / 2, st)]);
      }
      pagar(st, 65 + pasos.length * (esquema === 'sip' ? 65 : 96));
      return [aBytesBql(raizMerkle(hoja, pasos, esquema))];
    }
    case 'ots': {
      const inicio = argBytes(nodo, 0, st);
      let largo = inicio.length;
      const plano = secuencia(calcular(nodo.args[1], st), st);
      const pasos = [];
      for (let k = 0; k < plano.length; k++) {
        const op = plano[k];
        if (op === 'sha256') {
          pagar(st, largo);
          largo = 32;
          pasos.push([op]);
        } else if (op === 'prepend' || op === 'append') {
          if (k + 1 >= plano.length) throw fallo('ots: «' + op + '» lleva sus bytes detrás');
          const arg = bytesDeDato(plano[++k], 'ots: ' + op, st);
          largo += arg.length;
          pagar(st, largo);
          pasos.push([op, arg]);
        } else throw fallo('ots: paso desconocido «' + leer(op, ctx) + '» (prepend, append o sha256)');
      }
      return [aBytesBql(aplicarOts(inicio, pasos))];
    }
    case 'cabecera': {
      const b = argBytes(nodo, 0, st);
      pagar(st, 160);
      const c = leerCabecera(b);
      return [pura({ 1: [c.version], 2: [aBytesBql(c.anterior)], 3: [aBytesBql(c.raiz)], 4: [c.hora], 5: [c.bits], 6: [c.nonce], 7: [aBytesBql(c.hash)], 8: [aBytesBql(c.objetivo)] })];
    }
    case 'tx': {
      const b = argBytes(nodo, 0, st);
      pagar(st, 2 * b.length);
      const t = leerTx(b);
      paso(st, t.entradas.length + t.salidas.length);
      return [pura({
        1: t.entradas.map((e) => pura({ 0: [aBytesBql(e.txid)], 1: [e.vout], 2: [aBytesBql(e.script)], 3: [e.secuencia] })),
        2: t.salidas.map((s) => pura({ 0: [s.sats], 1: [aBytesBql(s.script)] })),
        3: t.testigos.map((pila) => pura({ 0: pila.map(aBytesBql) })),
        4: [t.locktime],
        5: [aBytesBql(t.txid)],
      })];
    }
    case 'signed': {
      const firma = argBytes(nodo, 0, st);
      const mensaje = argBytes(nodo, 1, st);
      const clave = argBytes(nodo, 2, st);
      pagar(st, COSTE_FIRMA);
      return [verificarBip340(firma, mensaje, clave)];
    }
    default:
      throw fallo('primitiva desconocida: ' + f);
  }
}

// ---------- mover (solo en una plantilla) ----------

/** Lo que vale una expresión que puede quedar PENDIENTE (falta un valor): la lista, o [] si queda pendiente sin ser por límite. */
function oNada(nodo, st) {
  try {
    return calcular(nodo, st);
  } catch (e) {
    if (e instanceof Parada && e.estado === 'PENDIENTE' && !e.subtipo) return [];
    throw e;
  }
}

/**
 * La serie de un verbo: un nodo del contexto (o una serie de su familia) cuyo valor es su clave; null si no hay
 * ninguna (se mueve con serie null: quien construye dice «no series»). Un texto o un número no la fabrican (SEG-09).
 */
function serieDeVerbo(lista, v, ctx) {
  if (!lista.length) return null;
  if (lista.length > 1) throw fallo(v + ': la serie es una lista de ' + lista.length + ' (' + textoDe(lista.slice(0, 3), ctx) + '); usa first o last');
  const o = lista[0];
  if (typeof o === 'string' || typeof o === 'number' || typeof o === 'boolean' || esSimbolo(o)) {
    throw fallo(v + ': la serie se nombra por su familia (R.(me), T.8, E.(me).("EUR")…) o se lee del libro (before.4.(…), me.1 each 0), no con «' + leer(o, ctx) + '»: un texto no fabrica una serie');
  }
  const clave = valorDe(o, ctx);
  if (typeof clave !== 'string') throw fallo(v + ': «' + leer(o, ctx) + '» no es una serie');
  return clave;
}

/** Una identidad de un enlace (from, to): su valor; «nadie» es null. */
function identidadDe(nodo, k, v, st) {
  const x = valorDe(uno(calcular(nodo, st), v + ' ' + k, st.ctx), st.ctx);
  if (x === NADIE) return null;
  if (typeof x !== 'string' || !x) throw fallo(v + ' ' + k + ': espera una identidad, no «' + leer(x, st.ctx) + '»');
  return x;
}

/**
 * Un verbo (VG 12-11, decisión 5) en una plantilla: anota el movimiento { verbo, serie, cantidad, de, a, salida?,
 * cuando?, precio? } y vale verdadero. Lo que vale cero o nada (una cantidad que falta) no se mueve: no anota nada y
 * vale verdadero igual. `precio` es el ocupante tal cual (una décupla [[serie], [cuánto]]); lo demás, valores.
 */
function mover(nodo, st) {
  const { ctx } = st;
  const v = nodo.v;
  if (!st.movimientos) throw fallo(v + ': solo una plantilla de transacción mueve (la firma quien la lanza); una regla solo lee (invariante del núcleo)');
  const q = oNada(nodo.q, st);
  if (!q.length) return [true];
  const cantidad = numero(q, v, ctx);
  if (!(cantidad > 1e-12)) return [true];
  const serie = serieDeVerbo(calcular(nodo.s, st), v, ctx);
  const m = { verbo: v, serie, cantidad, de: v === 'mint' ? null : identidadDe(nodo.from, 'from', v, st), a: v === 'burn' ? null : v === 'lock' || v === 'release' ? undefined : identidadDe(nodo.to, 'to', v, st) };
  if (m.a === undefined) m.a = m.de;
  if (nodo.exit) {
    const e = calcular(nodo.exit, st);
    if (e.length) {
      const x = valorDe(uno(e, v + ' exit', ctx), ctx);
      if (x === undefined || esSimbolo(x) || esBytes(x)) throw fallo(v + ' exit: la salida es un valor (un id, una identidad o un instante)');
      m.salida = String(x);
    }
  }
  if (nodo.when) {
    const w = calcular(nodo.when, st);
    if (w.length) {
      const x = valorDe(uno(w, v + ' when', ctx), ctx);
      if (typeof x !== 'string') throw fallo(v + ' when: la fecha es un instante, no «' + leer(x, ctx) + '»');
      m.cuando = x;
    }
  }
  if (nodo.price) {
    const p = calcular(nodo.price, st);
    if (p.length) {
      m.precio = uno(p, v + ' price', ctx);
      if (esBytes(m.precio) || esPura(m.precio)) throw fallo(v + ' price: el precio es [[serie], [cuánto]], no bytes');
    }
  }
  paso(st);
  st.movimientos.push(m);
  return [true];
}

/**
 * put v at A.1.(S).1 en una plantilla: el nivel en mano (estudio §4b). Lo que A tiene disponible de S ha de llegar al
 * menos a v: se acuña lo que falte (mint a A). Si ya llega, nada. Solo ese destino: la cartera, el disponible.
 */
function nivelEnMano(nodo, st) {
  const { ctx } = st;
  const destino = nodo.t;
  if (destino.base.digitos.length !== 1 || destino.base.digitos[0] !== 1 || !nodo.sub || nodo.sub.length !== 1 || nodo.sub[0] !== 1) {
    throw fallo('put: en una plantilla solo coloca el nivel en mano, put v at A.1.(S).1');
  }
  const v = oNada(nodo.v, st);
  if (!v.length) return [true];
  const nivel = numero(v, 'put', ctx);
  const A = identidadDe(destino.base.base, 'at', 'put', st);
  const serie = serieDeVerbo(calcular(destino.expr, st), 'put', ctx);
  const hay = serie === null ? 0 : calcular({ n: 'paso', base: destino, digitos: [1] }, st).reduce((s, o) => s + numeroDe(o, 'put', ctx), 0);
  const falta = nivel - hay;
  if (!(falta > 1e-12)) return [true];
  paso(st);
  st.movimientos.push({ verbo: 'mint', serie, cantidad: falta, de: null, a: A });
  return [true];
}

// ---------- reglas ----------

/**
 * Lo que vale en una posición de una regla en forma canónica: su último
 * ocupante. Una regla no se cambia en sitio: corregirla es añadir un ocupante
 * a su registro (VG, 10-11, A1), y manda el último (src/epocas.js).
 */
const ultimo = (x) => (Array.isArray(x) ? x[x.length - 1] : x);

/** El nombre de una regla: el primer ocupante de su 0. */
export const nombreDeRegla = (regla) => (Array.isArray(regla) ? (Array.isArray(regla[0]) ? regla[0][0] : regla[0]) : undefined);

// Las condiciones ya analizadas, por su texto (y si llevan sujeto): una regla se analiza una vez.
const ANALIZADAS = new Map();
function analizada(src, sujeto = false) {
  const clave = (sujeto ? 'L' : 'C') + src;
  if (!ANALIZADAS.has(clave)) {
    let arbol;
    try {
      arbol = analizar(src, { sujeto });
    } catch (e) {
      arbol = e;
    }
    ANALIZADAS.set(clave, arbol);
  }
  const a = ANALIZADAS.get(clave);
  if (a instanceof Error) throw a;
  return a;
}

/**
 * ¿Es una lectura? (VG, 10-11, B5): una regla de la época con «read» en su 4.
 * No es una condición: no se cuelga de las transacciones; da un valor de lo que
 * lee (`it`) y el contexto lo pone en la posición que dice su 3 (docs/BQLM.md §5).
 */
export const esLectura = (regla) => Array.isArray(regla) && Array.isArray(regla[4]) && regla[4].includes('read');

/**
 * ¿Es una regla que escribe? (encargo 3b: la obtención de P, mapa §15 N1, N2, N3): una regla de la época con «put»
 * en su 4. No es una condición: se evalúa sobre la transacción que ya pasó las condiciones y lo que coloca
 * (`put v at A.2.1.(r)`: P posicionado en r) lo asienta el libro en la misma transacción (src/eje.js).
 */
export const esEscritura = (regla) => Array.isArray(regla) && Array.isArray(regla[4]) && regla[4].includes('put');

/**
 * ¿Es la lectura de un punto de vista? (encargo «lecturas», issue #12, VG 11-11 noche): una regla de la época con
 * «point of view» en su 4, «qué lee el PV d aplicado a un nodo», d su 3. No es una condición ni una lectura que el
 * contexto materialice: la aplica el contrato (contrato.leer, contrato.leerRuta) con it = el nodo. Cada ocupante de su
 * 2 es una fórmula «=…» o «js <nombre>», una lectura del núcleo en JavaScript que el contrato nombra (docs/CONTRATO.md §4.4).
 */
export const esLecturaDePv = (regla) => Array.isArray(regla) && Array.isArray(regla[4]) && regla[4].includes('point of view');

/** Dónde se materializa una lectura: el último ocupante de su 3, como «X.6.1» (de un registro) o «A.8.1» (de una identidad). */
export const posicionDeLectura = (regla) => (esLectura(regla) ? ultimo(regla[3]) : undefined);

/**
 * Lee una lectura (B5) de un sujeto: evalúa el último ocupante de su 2 con
 * `it` = el sujeto (un registro, la candidata o una identidad) en el contexto.
 * Devuelve lo que `evaluar`: { estado: 'RESUELTO', valor, texto } o { estado, motivo }.
 */
export function leerRegla(regla, sujeto, contexto, opciones = {}) {
  const nombre = nombreDeRegla(regla);
  if (!esLectura(regla)) return { estado: 'ERROR', motivo: (nombre ?? 'regla') + ': no es una lectura (su 4 no dice read)' };
  const formula = ultimo(regla[2]);
  if (typeof formula !== 'string' || !formula.startsWith('=') || formula.startsWith('==')) {
    return { estado: 'ERROR', motivo: (nombre ?? 'regla') + ': su 2 no es una fórmula «=…»' };
  }
  let arbol;
  try {
    arbol = analizada(formula, true);
  } catch (e) {
    return { estado: e.estado ?? 'ERROR', motivo: nombre + ': ' + e.message };
  }
  const r = evaluar(arbol, contexto, { ...opciones, sujeto });
  return r.estado === 'RESUELTO' ? r : { ...r, motivo: nombre + ': ' + r.motivo };
}

/**
 * Evalúa una regla de la época (una décupla del molde, mapa §16 [D]: 0 nombre,
 * 1 constantes, 2 condición, 3 a quién, 4 primitiva, 5 dónde cuelga, 6 de dónde
 * viene, 7 desde qué época, 8 orden, 9 mensaje). Lee la condición del 2 (una
 * fórmula «=…», el último ocupante: una corrección se añade detrás) y la
 * evalúa en el contexto. Devuelve { pasa, estado, motivo }:
 * pasa solo si la condición da verdadero; si da falso, motivo es el mensaje del
 * 9 con cada {expresión} rellena con lo que vale; si queda PENDIENTE o da
 * ERROR, no pasa y motivo lo dice. No mira el 3, el 4 ni el 5: quién cuelga las
 * reglas de cada transacción es trabajo de después.
 */
export function evaluarRegla(regla, contexto, opciones = {}) {
  const nombre = nombreDeRegla(regla);
  if (esLectura(regla)) return { pasa: false, estado: 'ERROR', motivo: nombre + ': es una lectura (read en su 4), no una condición: se lee con leerRegla' };
  if (esEscritura(regla)) return { pasa: false, estado: 'ERROR', motivo: nombre + ': es una regla que escribe (put en su 4), no una condición: se evalúa con evaluarEscritura' };
  const condicion = Array.isArray(regla) ? ultimo(regla[2]) : undefined;
  if (typeof condicion !== 'string' || !condicion.startsWith('=') || condicion.startsWith('==')) {
    return { pasa: false, estado: 'ERROR', motivo: (nombre ?? 'regla') + ': su 2 no es una condición «=…»' };
  }
  let arbol;
  try {
    arbol = analizada(condicion);
  } catch (e) {
    return { pasa: false, estado: e.estado ?? 'ERROR', motivo: nombre + ': ' + (e.estado ?? 'ERROR') + ': ' + e.message };
  }
  const r = evaluar(arbol, contexto, opciones);
  if (r.estado !== 'RESUELTO') return { pasa: false, estado: r.estado, motivo: nombre + ': ' + r.estado + ': ' + r.motivo };
  if (r.valor.length !== 1 || typeof r.valor[0] !== 'boolean') {
    return { pasa: false, estado: 'ERROR', motivo: nombre + ': la condición no da verdadero o falso, da «' + r.texto + '»' };
  }
  if (r.valor[0]) return { pasa: true, estado: 'RESUELTO', motivo: null };
  const mensaje = ultimo(regla[9]);
  return { pasa: false, estado: 'RESUELTO', motivo: typeof mensaje === 'string' ? rellenar(mensaje, contexto, opciones) : nombre + ': no se cumple' };
}

/**
 * Evalúa una regla que escribe (esEscritura: «put» en su 4) sobre la candidata del contexto y devuelve
 * { estado, escrituras, motivo }: las colocaciones que anota su 2, [{ sujeto, camino, clave, valor }], si la fórmula
 * se resuelve; si no, ninguna y el motivo. Lo que vale la fórmula no cuenta: cuenta lo que coloca.
 */
export function evaluarEscritura(regla, contexto, opciones = {}) {
  const nombre = nombreDeRegla(regla);
  if (!esEscritura(regla)) return { estado: 'ERROR', escrituras: [], motivo: (nombre ?? 'regla') + ': no escribe (su 4 no dice put)' };
  const formula = ultimo(regla[2]);
  if (typeof formula !== 'string' || !formula.startsWith('=') || formula.startsWith('==')) return { estado: 'ERROR', escrituras: [], motivo: nombre + ': su 2 no es una fórmula «=…»' };
  let arbol;
  try {
    arbol = analizada(formula);
  } catch (e) {
    return { estado: e.estado ?? 'ERROR', escrituras: [], motivo: nombre + ': ' + e.message };
  }
  const r = evaluar(arbol, contexto, { ...opciones, escribir: true });
  if (r.estado !== 'RESUELTO') return { estado: r.estado, escrituras: [], motivo: nombre + ': ' + r.estado + ': ' + r.motivo };
  return { estado: 'RESUELTO', escrituras: r.escrituras, motivo: null };
}

/**
 * Las sentencias del 4 de una plantilla de transacción (VG 12-11, decisiones 5 y 6): cada una, una fórmula «=…» con
 * it = X (el sujeto), me = quien la lanza, ev y memo = la candidata; se evalúan en orden, con los verbos y el nivel en
 * mano (put v at A.1.(S).1), y gastan del mismo presupuesto (SEG-10). Devuelve { estado, movimientos, motivo }: los
 * movimientos que anotan, en orden ([{ verbo, serie, cantidad, de, a, salida?, cuando?, precio? }]), si todas se
 * resuelven; si una no, ninguno y su motivo. Lo que valen las sentencias no cuenta: cuenta lo que mueven. Es la única
 * evaluación que mueve: la candidata la firma quien la lanza, y después la validan las reglas, que solo leen.
 */
export function evaluarPlantilla(sentencias, contexto, opciones = {}) {
  const presupuesto = new Presupuesto(opciones.limites?.ocupantes ?? LIMITES.ocupantes, opciones.limites?.bytes ?? LIMITES.bytes);
  const movimientos = [];
  for (const src of Array.isArray(sentencias) ? sentencias : [sentencias]) {
    if (typeof src !== 'string' || !src.startsWith('=') || src.startsWith('==')) return { estado: 'ERROR', movimientos: [], motivo: 'una sentencia de plantilla es una fórmula «=…»' };
    let arbol;
    try {
      arbol = analizada(src, true);
    } catch (e) {
      return { estado: e.estado ?? 'ERROR', movimientos: [], motivo: e.message };
    }
    const r = evaluar(arbol, contexto, { ...opciones, mover: true, presupuesto });
    if (r.estado !== 'RESUELTO') return { estado: r.estado, ...(r.subtipo ? { subtipo: r.subtipo } : {}), movimientos: [], motivo: r.motivo };
    movimientos.push(...r.movimientos);
  }
  return { estado: 'RESUELTO', movimientos, motivo: null };
}

/** Rellena cada {expresión} de un mensaje con lo que vale en el contexto (o con su estado, si no se resuelve). */
export function rellenar(mensaje, contexto, opciones = {}) {
  return mensaje.replace(/\{([^{}]+)\}/g, (_, expr) => {
    let r;
    try {
      // Con sujeto (el 9 de una plantilla de transacción, con it = X), `it` vale fuera de where (encargo 3c-2a).
      r = evaluar(analizada(expr, Object.hasOwn(opciones, 'sujeto')), contexto, opciones);
    } catch (e) {
      r = { estado: e.estado ?? 'ERROR' };
    }
    return r.estado === 'RESUELTO' ? r.texto : '{' + expr + ': ' + r.estado + '}';
  });
}
