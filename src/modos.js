// Modos de representación: cuántos datos representa cada uno y cuántos
// emite. La unidad de cuenta es la posición CON CONTENIDO (VG, 7-11 noche,
// decisión 10.1: «lo leído se cuenta por lo que hay»): un terminal cuenta
// una, cada ocupante de una lista uno, y una décupla cuenta sus posiciones
// con contenido, no diez. Es contenido(payload).
//
// Mínimo y máximo por modo (VG, 7-11 noche): «A él le llegan los datos
// empezando por un único dato. En Pointed hablábamos de 10, en Sequenced de
// 100, en Mapped de 1000, en Scened de 10.000 y en Be, como que dice todos,
// porque no tiene interfaz gráfica como tal. Ese es el máximo de datos que
// se pueden representar. Después tenemos la cantidad de información mínima
// que cada interfaz quiere intentar representar. […] Pointed 1, Sequenced
// 10, Mapped 100, Scened 1000. Ahí tendremos tres números: el que consigue
// (que a lo mejor es menor), el mínimo y el máximo. Y eso corresponde con
// los que emite […], porque todo lo que no se pueda representar realmente
// no se puede alterar y por lo tanto no tiene sentido emitirlo.»
// Así que:
// - el máximo es duro, y es el mismo para representar (leer) y para emitir:
//   Pointed 10, Sequenced 100, Mapped 1000 (la matriz 10×10×10 de la
//   fábrica), Scened 10000, Be todos (Infinity);
// - todos cortan duro en su máximo (VG, 7-11 noche, decisión 10.2: «todos
//   cortan duro, Pointed también»), con el mismo aviso que Scened: «Trae X
//   de Y posiciones» (avisoCorte). Be no corta: representa todos;
// - el mínimo es lo que el modo intenta representar (y emitir): Pointed 1,
//   Sequenced 10, Mapped 100, Scened 1000. No llegar no es error: es
//   información (`alcance`). Be no tiene mínimo propio (VG, 7-11 noche,
//   decisión 10.4): responde exactamente lo que se le pide;
// - cada lectura y cada emisión dicen los tres números con alcanceDe:
//   { conseguido, minimo, maximo, alMinimo }, con conseguido = contenido.
// Órdenes de magnitud (VG, 7-11 noche, «T, corregido por VG», punto 4): el
// tamaño de un árbol se mide en órdenes; el orden n va de 10^(n−1) a 10^n
// posiciones. Es una medida general, no algo de las UI: los modos nombran
// los cuatro primeros (Pointed 1, Sequenced 2, Mapped 3, Scened 4) y Be,
// del quinto en adelante; las siete escalas de T nombran siete
// (ordenDeEscala, informativa).
// La proporción de Scened y de Be no está fijada: null es «sin propuesta».
// Proporción de escritura sobre lectura (VG, 6-11-2026): Pointed un décimo;
// Sequenced entre un quinto y un décimo; Mapped entre un cuarto y un tercio;
// Scened y Be sin fijar. Scened tiene render sobrio y no tiene formulario
// de escritura; Be no tiene interfaz gráfica.
// La proporción propone, el máximo manda (VG, 7-11 noche, decisión 10.3):
// la proporción ya no es tope; es lo que la fábrica PROPONE por defecto, el
// tamaño normal de lo escrito respecto de lo leído (`propuesta`). La
// escritura (src/escritura.js) solo rechaza por el máximo del modo, sobre
// lo EMITIDO (lo heredado por referencia no se emite: `cabeTope`, la regla
// dura). Lo que se sale de la proporción se escribe y se avisa
// (`proporcionDe(...).aviso`), nunca es error; el mínimo del modo, también
// solo se informa. `cabeTope` descuenta las heredadas que se le digan;
// `cabeEscritura`, `proporcion` y `proporcionDe` cuentan todas las
// posiciones del registro, lo heredado incluido, y solo informan.

import { esTerminal } from './btml.js';

// ---------- órdenes de magnitud ----------

/**
 * Orden de magnitud de unas posiciones: el n tal que 10^(n−1) < posiciones
 * ≤ 10^n. 0 posiciones son orden 0; 1, orden 1 (de 1 a 10). Medida general
 * del tamaño de un árbol (VG, 7-11 noche).
 */
export function orden(posiciones) {
  if (!(Number.isSafeInteger(posiciones) && posiciones >= 0)) throw new Error('posiciones inválidas: ' + posiciones + ' (un entero ≥ 0)');
  if (posiciones === 0) return 0;
  let n = 1;
  for (let techo = 10; posiciones > techo; techo *= 10) n++;
  return n;
}

function comprobarOrden(n) {
  if (!(Number.isInteger(n) && n >= 0 && n <= 15)) throw new Error('orden inválido: ' + n + ' (un entero de 0 a 15)');
}

/** Mínimo del orden n: 10^(n−1) posiciones (la frontera de abajo); el orden 0, 0. */
export function minimoDe(n) {
  comprobarOrden(n);
  return n === 0 ? 0 : 10 ** (n - 1);
}

/** Máximo del orden n: 10^n posiciones; el orden 0, 0. */
export function maximoDe(n) {
  comprobarOrden(n);
  return n === 0 ? 0 : 10 ** n;
}

/**
 * Orden de cada escala de T (VG, 7-11 noche, «T, corregido por VG», punto
 * 4): segundo 1 (1-10 posiciones), minuto 2, hora 3, día 4, semana 5, ciclo
 * 6, año 7 (10^6-10^7). Los nombres son los de tokens.ESCALAS_T.
 */
export const ORDENES_DE_ESCALA = Object.freeze({ segundo: 1, minuto: 2, hora: 3, dia: 4, semana: 5, ciclo: 6, anio: 7 });

/**
 * Orden de magnitud que declara una escala de T: el tamaño esperado del
 * árbol que se emite gastándola («que un T de segundo sea un árbol de
 * información más pequeño que el que se emite, y un T de hora o de día uno
 * más grande»). SOLO informativa: nadie la aplica todavía; si lo emitido se
 * sale del orden, será una incongruencia que se enseña, no un rechazo ([X]
 * si VG quiere rechazo).
 */
export function ordenDeEscala(escala) {
  if (!Object.hasOwn(ORDENES_DE_ESCALA, escala)) throw new Error('escala T desconocida: ' + escala + ' (' + Object.keys(ORDENES_DE_ESCALA).join(', ') + ')');
  return ORDENES_DE_ESCALA[escala];
}

// ---------- los modos ----------

/** Un modo a partir de su orden de magnitud: mínimo 10^(orden−1), máximo 10^orden. */
function modo(nombre, ordenModo, proporcion) {
  return Object.freeze({ nombre, orden: ordenModo, decuplas: maximoDe(ordenModo) / 10, proporcion, minimo: minimoDe(ordenModo), maximo: maximoDe(ordenModo) });
}

export const MODOS = Object.freeze({
  pointed: modo('Pointed', 1, [1 / 10, 1 / 10]),
  sequenced: modo('Sequenced', 2, [1 / 10, 1 / 5]),
  mapped: modo('Mapped', 3, [1 / 4, 1 / 3]),
  scened: modo('Scened', 4, null), // proporción sin fijar; sin formulario de escritura
  // Be: sin interfaz gráfica; representa «todos» (VG, 7-11 noche) y no corta.
  // Cubre los órdenes del quinto en adelante, por encima de Scened (`orden` 5
  // es el primero de ellos). No tiene mínimo propio (VG, 7-11 noche, decisión
  // 10.4): responde exactamente lo que se le pide, así que `minimo` es null
  // porque no aplica, y sus tres números son conseguido, pedido y máximo
  // (alcanceDe). Proporción sin fijar: null, «sin propuesta» ([X] decidir
  // VG). No tiene décuplas propias.
  be: Object.freeze({ nombre: 'Be', orden: 5, decuplas: null, proporcion: null, minimo: null, maximo: Infinity }),
});

function modoDe(m) {
  const x = Object.hasOwn(MODOS, m) ? MODOS[m] : undefined;
  if (!x) throw new Error('modo desconocido: ' + m);
  return x;
}

/** Nombre del modo para leer: «Pointed», «Sequenced», «Mapped», «Scened», «Be». */
export function nombreModo(m) {
  return modoDe(m).nombre;
}

/** Máximo duro del modo en posiciones: lo más que representa y lo más que emite de una vez (VG, 7-11 noche). Be: Infinity («todos»). */
export function maximo(m) {
  return modoDe(m).maximo;
}

/** Mínimo del modo en posiciones: lo que intenta representar y emitir; no llegar se informa, no se rechaza. Be: null, porque no aplica (VG, 7-11 noche: Be responde exactamente lo que se le pide). */
export function minimo(m) {
  return modoDe(m).minimo;
}

/**
 * Los tres números de una lectura o una emisión: lo conseguido (posiciones
 * con contenido), el mínimo y el máximo del modo, y si llega al mínimo. No
 * corta ni rechaza nada: solo lo dice.
 * Be (VG, 7-11 noche, decisión 10.4) no tiene mínimo propio: responde
 * exactamente lo que se le pide. Sus tres números son { conseguido, pedido,
 * maximo: Infinity }, con `pedido` (por defecto, lo conseguido) en lugar del
 * mínimo, y `alMinimo` siempre true: no hay mínimo que alcanzar.
 */
export function alcanceDe(conseguido, m, { pedido } = {}) {
  if (!(Number.isInteger(conseguido) && conseguido >= 0)) throw new Error('conseguido inválido: ' + conseguido + ' (un entero ≥ 0)');
  if (m === 'be') {
    const p = pedido ?? conseguido;
    if (!(Number.isInteger(p) && p >= 0)) throw new Error('pedido inválido: ' + p + ' (un entero ≥ 0)');
    return { conseguido, pedido: p, maximo: Infinity, alMinimo: true };
  }
  const min = minimo(m);
  return { conseguido, minimo: min, maximo: maximo(m), alMinimo: min === null ? null : conseguido >= min };
}

/**
 * Capacidad representativa del modo: sus décuplas × 10, que es su máximo.
 * No es lo que una lectura trae (eso es lo conseguido, que cuenta contenido
 * real): es la base sobre la que se calcula la proporción de escritura.
 */
export function lectura(m) {
  return maximo(m);
}

/**
 * Posiciones que la fábrica propone escribir de una vez en el modo, según
 * la proporción: [mínimo, máximo], o null, «sin propuesta», si no está
 * fijada (Scened, Be; [X] decidir VG).
 * Es una propuesta, no un tope (VG, 7-11 noche, decisión 10.3: la
 * proporción propone, el máximo manda).
 */
export function escritura(m) {
  const x = modoDe(m);
  if (!x.proporcion) return null;
  const l = lectura(m);
  return [Math.floor(l * x.proporcion[0]), Math.floor(l * x.proporcion[1])];
}

/** Alias de escritura con el nombre de la decisión 10.3: el tamaño que la fábrica propone escribir, [mín, máx] o null. */
export function propuesta(m) {
  return escritura(m);
}

/** Tope duro de emisión. Alias de maximo: lo que no se puede representar no se puede alterar, y no se emite (VG, 7-11 noche). */
export function tope(m) {
  return maximo(m);
}

// ---------- lo que hay ----------

/**
 * Contenido real de un payload (VG, 7-11 noche, decisión 10.1): cada
 * terminal cuenta una posición (una referencia también), cada ocupante de
 * una lista uno, y una décupla la suma de sus posiciones con contenido (no
 * diez). Lo que no es BTML cuenta 0. Es la medida de lo leído y de lo
 * emitido en todos los modos.
 */
export function contenido(payload) {
  if (esTerminal(payload)) return 1;
  if (!Array.isArray(payload)) return 0;
  let n = 0;
  for (const h of payload) n += contenido(h);
  return n;
}

/** Alias de contenido (el nombre de antes del 7-11): cada terminal cuenta una. */
export function contarPosiciones(payload) {
  return contenido(payload);
}

/**
 * Un payload recortado a `max` posiciones con contenido, por índice: se
 * recorren sus terminales en orden de dirección (la posición 0 y lo que
 * cuelga de ella antes que la 1; en una lista, sus ocupantes por llegada) y
 * entran los primeros `max`. Lo que queda es un prefijo del árbol: sin
 * huecos ni arrays vacíos. → { payload (undefined si no entra nada),
 * conseguido, necesario, cortado }.
 */
export function recortar(payload, max) {
  if (!(max === Infinity || (Number.isInteger(max) && max >= 0))) throw new Error('máximo inválido: ' + max + ' (un entero ≥ 0)');
  const necesario = contenido(payload);
  if (necesario <= max) return { payload, conseguido: necesario, necesario, cortado: false };
  let quedan = max;
  const podar = (nodo) => {
    if (quedan === 0) return undefined;
    if (!Array.isArray(nodo)) {
      if (!esTerminal(nodo)) return undefined;
      quedan--;
      return nodo;
    }
    const suyo = contenido(nodo);
    if (suyo <= quedan) { // cabe entero: el mismo nodo, sin copiarlo
      quedan -= suyo;
      return nodo;
    }
    const fuera = [];
    for (const h of nodo) {
      const x = podar(h);
      if (x === undefined) break;
      fuera.push(x);
    }
    return fuera.length ? fuera : undefined;
  };
  const recortado = podar(payload);
  return { payload: recortado, conseguido: max - quedan, necesario, cortado: true };
}

/**
 * Admite piezas en orden mientras quepan en `max`: `cantidades` es el
 * contenido de cada pieza; se corta en la primera que no cabe y todas las
 * que vienen detrás quedan fuera (nada entra a medias, como en Scened).
 * → { entran, conseguido, necesario, cortado }.
 */
export function admitir(cantidades, max) {
  let conseguido = 0;
  let entran = cantidades.length;
  for (let k = 0; k < cantidades.length; k++) {
    if (conseguido + cantidades[k] > max) { entran = k; break; }
    conseguido += cantidades[k];
  }
  const necesario = cantidades.reduce((s, n) => s + n, 0);
  return { entran, conseguido, necesario, cortado: entran < cantidades.length };
}

/**
 * Aviso de corte de un modo, el mismo en todos (VG, 7-11 noche, decisión
 * 10.2): «<Modo> corta en su máximo (<max> posiciones)<: detalle>. Trae X
 * de Y posiciones.». Be no corta: pedirle el aviso es un error.
 */
export function avisoCorte(m, conseguido, necesario, detalle = '') {
  const max = maximo(m);
  if (max === Infinity) throw new Error(nombreModo(m) + ' no corta: representa todos');
  return nombreModo(m) + ' corta en su máximo (' + max + ' posiciones)' + (detalle ? ': ' + detalle : '') + '. Trae ' + conseguido + ' de ' + necesario + ' posiciones.';
}

/**
 * Si un payload cabe en el máximo (tope duro) del modo. Cuenta lo EMITIDO,
 * por su contenido real: las `heredadas` (la lista de desdeMapped: una
 * posición de relleno por entrada, que no se emite) se descuentan. Sin
 * ellas, todo cuenta como emitido, como en escribirDesde sin heredadas. No
 * comprueba que sean referencias al foco: eso lo hace la escritura.
 */
export function cabeTope(payload, m, heredadas = []) {
  if (!Array.isArray(heredadas)) throw new Error('heredadas es una lista');
  return contenido(payload) - heredadas.length <= tope(m);
}

/**
 * Si un payload cabe en el máximo de la propuesta (la proporción) del modo.
 * Cuenta todas las posiciones con contenido, lo heredado incluido. Solo
 * informa: desde la decisión 10.3 nadie rechaza con ella (la regla dura es
 * cabeTope).
 */
export function cabeEscritura(payload, m) {
  const e = escritura(m);
  return e === null ? true : contenido(payload) <= e[1];
}

/**
 * Dónde quedan unas posiciones respecto de la proporción del modo, que es
 * lo que la fábrica propone (decisión 10.3). Son las posiciones del registro
 * (o de la salida), lo heredado incluido, como las cuenta la proporción (no
 * solo las emitidas):
 * { posiciones, rango: [mín, máx] | null, estado: 'por debajo' | 'dentro' | 'por encima' | 'sin fijar', aviso }.
 * `aviso` es null dentro de la proporción o sin fijar; fuera, un texto que
 * lo dice. Nunca es error: si cabe en el máximo del modo, se escribe.
 */
export function proporcionDe(posiciones, m) {
  const rango = escritura(m);
  if (!rango) return { posiciones, rango: null, estado: 'sin fijar', aviso: null };
  const estado = posiciones < rango[0] ? 'por debajo' : posiciones > rango[1] ? 'por encima' : 'dentro';
  const aviso = estado === 'dentro' ? null
    : nombreModo(m) + ' propone escribir ' + (rango[0] === rango[1] ? rango[0] : 'de ' + rango[0] + ' a ' + rango[1]) + (rango[1] === 1 ? ' posición' : ' posiciones')
      + ' (la proporción sobre lo leído); esto tiene ' + posiciones + ', ' + estado + '. No es error: la proporción propone, el máximo (' + maximo(m) + ') manda.';
  return { posiciones, rango, estado, aviso };
}

/** proporcionDe con el contenido de un payload: todo, lo heredado incluido, como lo cuenta la proporción. */
export function proporcion(payload, m) {
  return proporcionDe(contenido(payload), m);
}
