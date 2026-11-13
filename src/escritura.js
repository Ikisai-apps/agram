// Escritura: el registro de salida según el modo. Se anida sobre el contenido
// del foco (sobre + en). Pointed escribe un terminal; Sequenced una hilera de
// hasta diez posiciones; Mapped la matriz de la fábrica.
//
// La fábrica (PV4) parte de la matriz de 100 del foco (10 posiciones × 10
// subposiciones), que ya está y no se emite. El registro de salida emite
// SOLO las celdas modificadas, en una matriz 10×10×10: posición ×
// subposición × CLASE de modificación (los diez PV). La matriz es RELATIVA
// al camino (VG, 7-11 tarde): desde donde esté el foco (un camino de
// profundidad n), los tres dígitos siguientes son posición, subposición y
// clase. La celda i.j.k bajo el camino c se escribe en payload[i][j][k] del
// registro que va en direccion(c), así que cae en direccion([...c, i, j, k]),
// y su clase es el dígito en la profundidad n + 2 (claseDe(dir, c)); sin
// camino, el tercero. La clase sale de la dirección y del camino, nunca de
// un campo de contexto. Ver ya es una modificación (clase 0), así que
// siempre se emite algo; solo se ve lo que el foco tiene.
//
// Lo no modificado anterior a lo modificado se hereda del foco por
// referencia, y solo si el foco tiene contenido en ese camino exacto, de
// modo que una referencia heredada siempre alcanza algo. La raíz de un foco
// terminal hereda su posición 0, como antes de la matriz: su dirección
// (direccion([...c, 0])) alcanza el terminal por la colisión de ceros
// finales. [X] decidir VG: el mapa §12 dice «un terminal no tiene posición
// 0 (PENDIENTE)»; hasta que lo decida se conserva lo que había. Si falta la
// base, la celda es lejana y se ancla en su posición (`en`) en vez de
// rechazarse. El registro dice qué heredó (contexto.heredadas): lo demás se
// vio o se escribió.
//
// Límites por modo (src/modos.js). La proporción propone, el máximo manda
// (VG, 7-11 noche, decisión 10.3):
// - solo rechaza el máximo del modo, tope duro (Pointed 10, Sequenced 100,
//   Mapped 1000, Scened 10000), que cuenta el contenido EMITIDO: lo heredado
//   no se emite y no cuenta. Es el mismo máximo que el de representar: lo
//   que no se puede representar no se puede alterar, y no se emite;
// - la proporción (Pointed 1, Sequenced 10-20, Mapped 250-333, sobre las
//   posiciones del registro, lo heredado incluido) es lo que la fábrica
//   propone por defecto: lo que se sale de ella se escribe igual y se
//   avisa (modos.proporcionDe(...).aviso; escribirSalida lo devuelve en
//   `proporcion` y en `avisos`), nunca es error.
// El mínimo del modo (Pointed 1, Sequenced 10, Mapped 100, Scened 1000) no
// rechaza: lo emitido por debajo se admite y se informa con los tres
// números, { conseguido, minimo, maximo, alMinimo } (modos.alcanceDe), como
// en la lectura: escribirSalida los devuelve en `alcance`; escribirDesde
// devuelve el evento tal como queda en el eje (congelado y firmado), así que
// sus tres números se leen con alcanceDeRegistro(evento).
// `ubicar` con el modo (y escribirDesde con una celda) los tiene en cuenta:
// una celda con base va dentro solo si el registro, con su relleno, cabe; si
// no, se ancla sola. desdeMapped, que conforma varias celdas a la vez, ubica
// solo por la base; escribirSalida mide la salida entera y, si no cabe, la
// rechaza sin anclar nada ([X] decidir VG si desdeMapped también ancla por
// límites, y qué celdas).
// El coste de escribir (VG 12-11, decisión 7 del estudio BQL-transacciones): una sola regla de la época, «the cost
// of writing» (una lectura de su 2 con it = la candidata), que dice lo que el registro exige en T por posición: hoy un
// minuto del calendario por posición del payload (A3), la heredada también, como antes ([X] decidir VG si el relleno
// se cobra). Lo usan escribirDesde (costeT) y las plantillas de transacción (src/acciones.js, transaccion): el minuto
// fijo de las plantillas era un sucedáneo.

import { ARIDAD, esDireccion, esReferencia, esTerminal, esLista, direccion, validarPayload } from './btml.js';
import { contarPosiciones, nombreModo, tope, proporcionDe, alcanceDe } from './modos.js';
import { EPOCA_0_BTML } from './epocas.js';
import { ContextoEje } from './contexto-eje.js';
import { leerRegla, nombreDeRegla } from './bqlm.js';
import { SEGUNDOS, ESCALAS_REALES } from './tokens.js';

/**
 * Las clases de modificación: los diez PV como dígito de clase (VG,
 * 7-11-2026), el tercero desde el camino. VG nombró las cinco primeras. Las
 * 5–9 son los PV 5–9 (estructura, pasado, futuro, comparabilidad, camino),
 * pero su nombre como clase de modificación no está decidido: valen null
 * ([X] decidir VG).
 */
export const CLASES = Object.freeze([
  'ver/sustituir', // 0
  'impulso de recursos', // 1
  'criterio', // 2
  'comunicación', // 3
  'acción', // 4
  null, null, null, null, null, // 5–9: [X] decidir VG
]);

/**
 * Clase de modificación de una dirección vista desde un camino del foco: la
 * matriz es relativa al camino (VG, 7-11 tarde), así que bajo un camino de
 * profundidad n la clase es el dígito en la profundidad n + 2 (el tercero
 * desde el camino; sin camino, el tercero de la dirección). La misma
 * dirección tiene otra clase desde otro camino: 1734000000 es 7.3.4 bajo
 * [1] (clase 4) y 1.7.3 desde la raíz (clase 3). La dirección ha de estar
 * bajo el camino, y el camino ha de dejar sitio a la clase (n ≤ 7).
 */
export function claseDe(dir, camino = []) {
  const d = String(dir);
  if (!esDireccion(d)) throw new Error('dirección no válida: ' + dir);
  if (!Array.isArray(camino)) throw new Error('el camino es una lista de índices');
  const n = camino.length;
  if (n + 2 >= ARIDAD) throw new Error('bajo un camino de ' + n + ' profundidades no cabe la clase: la matriz necesita tres dígitos tras el camino');
  if (d.slice(0, n) !== direccion(camino).slice(0, n)) throw new Error('la dirección ' + d + ' no está bajo el camino ' + (etiqueta(camino) || '(raíz)'));
  return Number(d[n + 2]);
}

/** Resuelve un prefijo de id («@25ddaa89») a un id completo del eje. Único o error. */
export function resolverRef(eje, prefijo) {
  const p = prefijo.replace(/^@/, '').toLowerCase();
  if (p.length < 4) throw new Error('referencia demasiado corta: ' + prefijo);
  const ids = typeof eje.conPrefijo === 'function' ? eje.conPrefijo(p) : eje.orden.filter((id) => id.startsWith(p)); // índice del eje, mismo resultado
  if (ids.length === 0) throw new Error('referencia desconocida: ' + prefijo);
  if (ids.length > 1) throw new Error('referencia ambigua: ' + prefijo);
  return { ref: ids[0] };
}

/** Un ítem de entrada: texto («@id» es referencia; «@id:1200000000» con subposición; diez dígitos, dirección) o número. */
export function item(eje, texto) {
  const t = String(texto).trim();
  if (!t) throw new Error('ítem vacío');
  const m = /^@([0-9a-f]{4,64})(?::([0-9]{10}))?$/i.exec(t);
  if (m) return m[2] ? { ...resolverRef(eje, m[1]), dir: m[2] } : resolverRef(eje, m[1]);
  // Un texto de diez dígitos es una dirección (MAPA §2.1 y §12): se queda
  // como texto, igual que lo lee BQL (esDireccion), y no pierde su cero.
  if (esDireccion(t)) return t;
  // [X] decidir VG: un número que no se representa exacto (String(Number(t))
  // distinto de t: «0034», «12345678901234567890») se convierte igual; si
  // se conserva como texto o se rechaza lo decide VG (auditoría de ajuste 2).
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  return t;
}

/** Pointed: un terminal. */
export function desdePointed(eje, texto) {
  const i = item(eje, texto);
  if (!esTerminal(i)) throw new Error('Pointed escribe un terminal');
  return i;
}

/** Sequenced: una hilera de uno a diez ítems, sin huecos. */
export function desdeSequenced(eje, textos) {
  const limpios = textos.map((t) => String(t ?? '').trim());
  while (limpios.length && !limpios[limpios.length - 1]) limpios.pop();
  if (!limpios.length) throw new Error('la hilera está vacía');
  if (limpios.length > ARIDAD) throw new Error('la hilera tiene más de ' + ARIDAD + ' posiciones');
  const hueco = limpios.findIndex((t) => !t);
  if (hueco >= 0) throw new Error('hueco en la posición ' + hueco + ': rellénala o quita las siguientes');
  return limpios.map((t) => item(eje, t));
}

// ---------- límites del modo ----------

/**
 * Si unas posiciones caben en el modo: el tope duro (el máximo del modo)
 * sobre lo emitido. La proporción ya no rechaza (VG, 7-11 noche, decisión
 * 10.3: la proporción propone, el máximo manda): lo que se sale de ella se
 * avisa con proporcionDe. → null si caben; si no, el motivo.
 */
function fueraDeLimite({ emitidas }, modo, que) {
  const max = tope(modo);
  if (emitidas > max) return nombreModo(modo) + ' emite como mucho ' + max + ' posiciones; ' + que + ' tiene ' + emitidas;
  return null;
}

function comprobarLimites(cuenta, modo, que) {
  const motivo = fueraDeLimite(cuenta, modo, que);
  if (motivo) throw new Error(motivo);
}

// ---------- la matriz 10×10×10 ----------

const etiqueta = (indices) => indices.join('.');

/** Nodo del foco bajo un camino (sin seguir referencias). */
function baseDe(payload, camino) {
  let base = payload;
  for (const i of camino) base = Array.isArray(base) ? base[i] : undefined;
  return base;
}

/**
 * Si el foco tiene contenido en un camino exacto (sin seguir referencias),
 * desde su nodo bajo el camino (`base`). Lo que cuelga de un terminal no
 * tiene base, salvo la posición 0 de la raíz cuando el foco es un terminal:
 * se hereda como antes de la matriz (la referencia a direccion([...c, 0])
 * alcanza el terminal por la colisión de ceros finales). [X] decidir VG:
 * el mapa §12 dice «un terminal no tiene posición 0 (PENDIENTE)».
 */
function hayContenido(base, indices, raiz = false) {
  if (base !== undefined && !Array.isArray(base) && indices.length === 1 && indices[0] === 0) return true;
  let nodo = base;
  for (let p = 0; p < indices.length; p++) {
    // Por hojas (VG, 7-11 noche): una lista (fuera de la raíz) no tiene subposiciones; sus elementos son ocupantes.
    if (!Array.isArray(nodo) || (!(raiz && p === 0) && esLista(nodo))) return false;
    nodo = nodo[indices[p]];
  }
  return nodo !== undefined;
}

/**
 * Si hay algo que ver en la celda [i][j]: si su dirección alcanza algo en
 * el foco. Los ceros finales nombran la colisión (mapa §12): 4.0 alcanza la
 * posición 4 y 0.0, la raíz, también cuando son terminales ([X] decidir VG
 * la huella de ver una subposición 0).
 */
function hayQueVer(base, i, j, raiz = false) {
  const camino = [i, j];
  while (camino.length && camino[camino.length - 1] === 0) camino.pop();
  return hayContenido(base, camino, raiz);
}

function comprobarCelda(celda, camino) {
  if (!Array.isArray(celda) || celda.length < 1 || celda.length > 3) throw new Error('una celda es [i], [i, j] o [i, j, k]');
  if (!celda.every((x) => Number.isInteger(x) && x >= 0 && x <= 9)) throw new Error('celda fuera de la matriz: ' + etiqueta(celda));
  if (camino.length + celda.length > ARIDAD) throw new Error('la celda ' + etiqueta(celda) + ' no cabe bajo un camino de ' + camino.length + ' profundidades');
}

/**
 * Dónde va una celda objetivo [i, j, k] (bajo `camino` del foco): «dentro»
 * del registro de salida si cada hueco anterior en su ruta (posiciones
 * antes de i, subposiciones antes de j, clases antes de k) ya está escrito
 * en el mismo registro (`escritas`) o el foco tiene contenido en ese camino
 * exacto para heredarlo por referencia; si no, «anclado en la posición»: un
 * registro aparte en la dirección de la celda. Lo lejano no se rechaza.
 * `en` es donde va el registro: dentro, la dirección del camino; anclado, la
 * de la celda. En los dos casos la celda cae en `dir` = direccion([...camino,
 * ...celda]), y su clase es claseDe(dir, camino): la k de la celda.
 * Con `modo`, tiene en cuenta sus límites con `contenido` (lo que se escribe
 * en la celda; un terminal si falta; cada una de `escritas` cuenta una
 * posición): va dentro solo si el registro, con su relleno heredado, cabe;
 * si no, se ancla sola y `motivo` dice por qué. Si ni sola cabe, error.
 * → { ubicacion: 'dentro' | 'anclado', en, dir, faltan: ['5', '6', …], motivo? }
 */
export function ubicar(eje, foco, celda, { camino = [], escritas = [], modo, contenido } = {}) {
  const ev = eje.obtener(foco);
  if (!ev) throw new Error('foco desconocido: ' + foco);
  comprobarCelda(celda, camino);
  for (const e of escritas) comprobarCelda(e, camino);
  const cubiertos = new Set();
  for (const e of escritas) cubrir(cubiertos, e);
  const u = ubicarSobre(baseDe(ev.payload, camino), celda, camino, cubiertos);
  if (modo === undefined) return u;
  const valor = contenido === undefined ? 'x' : contenido;
  const sola = contarPosiciones(valor);
  comprobarLimites({ emitidas: sola, posiciones: sola }, modo, 'esta celda');
  if (u.ubicacion === 'anclado') return u;
  const registro = construir(foco, camino, [...escritas.map((e) => ({ indices: e, valor: 'x' })), { indices: celda, valor }], []);
  const motivo = fueraDeLimite({ emitidas: escritas.length + sola, posiciones: contarPosiciones(registro) }, modo, 'dentro, el registro');
  return motivo ? { ubicacion: 'anclado', en: u.dir, dir: u.dir, faltan: [], motivo } : u;
}

/** Marca como escritos los prefijos de una celda que va dentro. */
function cubrir(cubiertos, celda) {
  for (let n = 1; n <= celda.length; n++) cubiertos.add(etiqueta(celda.slice(0, n)));
}

// [X] decidir VG: si las clases sin modificar de una celda que el foco no
// desarrolla se heredan por referencia a la celda i.j en vez de anclar (hoy
// se ancla); y si un registro bajo un camino que acaba en 0 necesita otra
// dirección que la de su padre (hoy, direccion(camino): la colisión).
function ubicarSobre(base, celda, camino, cubiertos) {
  const faltan = [];
  for (let n = 0; n < celda.length; n++) {
    for (let s = 0; s < celda[n]; s++) {
      const hueco = [...celda.slice(0, n), s];
      if (!cubiertos.has(etiqueta(hueco)) && !hayContenido(base, hueco, camino.length === 0)) faltan.push(etiqueta(hueco));
    }
  }
  const dir = direccion([...camino, ...celda]);
  return faltan.length ? { ubicacion: 'anclado', en: dir, dir, faltan } : { ubicacion: 'dentro', en: direccion(camino), dir, faltan };
}

/**
 * Construye el registro de salida con las celdas que van dentro: por cada
 * nivel, de 0 hasta la última modificada; lo no modificado se hereda del
 * foco por referencia y se apunta en `heredadas`. Un array de un solo
 * terminal bajo la raíz se compacta en el terminal (una línea sola en su
 * posición se guarda como antes de la matriz): la dirección 2000000000
 * nombra a la vez [2], [2][0] y [2][0][0] (colisión de ceros finales).
 */
function construir(foco, camino, celdas, heredadas) {
  const nivel = (prefijo, grupo) => {
    const hoja = grupo.find((c) => c.indices.length === prefijo.length);
    if (hoja) return hoja.valor;
    const d = prefijo.length;
    const ultimo = Math.max(...grupo.map((c) => c.indices[d]));
    const arr = [];
    for (let s = 0; s <= ultimo; s++) {
      const sub = grupo.filter((c) => c.indices[d] === s);
      if (sub.length) {
        arr.push(nivel([...prefijo, s], sub));
      } else {
        const hueco = [...prefijo, s];
        arr.push({ ref: foco, dir: direccion([...camino, ...hueco]) });
        heredadas.push(hueco.length === 1 ? s : etiqueta(hueco));
      }
    }
    if (d > 0 && arr.length === 1 && esTerminal(arr[0])) return arr[0];
    // Forma canónica (VG, 8-11): bajo la raíz, un array solo de hojas sería una lista; la salida es una
    // décupla, así que cada posición va entre corchetes: [[ref 1.0], [ref 1.1], …].
    return d > 0 && esLista(arr) ? arr.map((x) => [x]) : arr;
  };
  return nivel([], celdas);
}

// Payloads de desdeMapped que dejan celdas ancladas aparte: escribir solo el
// payload las perdería, así que escribirDesde lo impide; escribirSalida
// borra la marca solo cuando ha escrito la salida entera. La marca va con el
// objeto: una copia del payload no la lleva.
const PENDIENTES = new WeakMap();

/**
 * Marca de celda en una línea del formulario: «@:j.k texto». Propuesta,
 * [X] decidir VG. Solo una línea con esa forma exacta es una celda marcada;
 * cualquier otra línea, también una que empiece por «@:» sin esa forma
 * («@:) gracias»), es texto, como antes de la matriz. Lo que deja de poder
 * escribirse como texto es una línea con la forma exacta («@:1.2 algo»): no
 * hay escape ([X] decidir VG). Sin texto, «@:j.0» es ver la celda j.
 */
const CELDA_MARCADA = /^@:([0-9])\.([0-9])(?:\s+(\S.*))?$/;

/**
 * Líneas por posición → celdas. Una línea sin marca es texto y va con
 * clase 0 a la subposición siguiente libre (la décupla de siempre). Una
 * línea «@:j.k texto» fija subposición y clase.
 */
function celdasDeLineas(listas) {
  const celdas = [];
  listas.forEach((lista, i) => {
    const lineas = (lista ?? []).map((t) => String(t ?? '').trim()).filter(Boolean);
    if (!lineas.length) return;
    if (i >= ARIDAD) throw new Error('la décupla tiene más de ' + ARIDAD + ' posiciones');
    const sueltas = [];
    for (const t of lineas) {
      const m = CELDA_MARCADA.exec(t);
      if (m) celdas.push({ i, j: Number(m[1]), k: Number(m[2]), contenido: m[3] });
      else sueltas.push(t);
    }
    const ocupadas = new Set(celdas.filter((c) => c.i === i).map((c) => c.j));
    let j = 0;
    for (const t of sueltas) {
      while (ocupadas.has(j)) j++;
      if (j >= ARIDAD) throw new Error('la posición ' + i + ' no admite más de ' + ARIDAD + ' subposiciones');
      celdas.push({ i, j, k: 0, contenido: t });
      ocupadas.add(j);
    }
  });
  return celdas;
}

const sinContenido = (contenido) => contenido === undefined || contenido === null || (typeof contenido === 'string' && !contenido.trim());

/**
 * Valor BTML de una celda: texto → ítem; sin contenido en clase 0 → ver,
 * una referencia a la celda del foco, que tiene que existir. En el payload,
 * ver y heredar dan el mismo valor; los distingue contexto.heredadas ([X]
 * decidir VG si ver necesita una marca propia).
 */
function valorDe(eje, c, foco, camino, base) {
  const { contenido } = c;
  if (sinContenido(contenido)) {
    if (c.k !== 0) throw new Error('falta el contenido de ' + etiqueta([c.i, c.j, c.k]) + ': solo ver (clase 0) va sin contenido');
    if (!hayQueVer(base, c.i, c.j, camino.length === 0)) throw new Error('no hay nada que ver en ' + etiqueta([c.i, c.j]) + ': el foco no tiene esa celda');
    return { ref: foco, dir: direccion([...camino, c.i, c.j]) };
  }
  if (typeof contenido === 'string') return item(eje, contenido);
  const v = validarPayload(contenido);
  if (!v.ok) throw new Error('contenido no válido en ' + etiqueta([c.i, c.j, c.k]) + ': ' + v.errores.join('; '));
  return contenido;
}

/** Entrada de Mapped → celdas [{ indices: [i, j, k], valor, ve }] en orden de dirección, sin repetir. */
function celdasDeEntrada(eje, entrada, foco, camino, base) {
  if (!Array.isArray(entrada)) throw new Error('Mapped recibe diez listas de líneas o una lista de celdas { i, j, k, contenido }');
  const presentes = entrada.filter((e) => e !== undefined && e !== null);
  const sonLineas = presentes.every((e) => Array.isArray(e));
  if (!sonLineas && !presentes.every((e) => typeof e === 'object' && !Array.isArray(e))) {
    throw new Error('mezcla de líneas y celdas: usa diez listas de líneas o una lista de celdas { i, j, k, contenido }');
  }
  const crudas = sonLineas ? celdasDeLineas(entrada) : presentes.map(({ i, j = 0, k = 0, contenido }) => ({ i, j, k, contenido }));
  const repetidas = new Set();
  const celdas = crudas.map((c) => {
    const indices = [c.i, c.j, c.k];
    comprobarCelda(indices, camino);
    const clave = etiqueta(indices);
    if (repetidas.has(clave)) throw new Error('la celda ' + clave + ' está dos veces');
    repetidas.add(clave);
    return { indices, valor: valorDe(eje, c, foco, camino, base), ve: sinContenido(c.contenido) };
  });
  const orden = (a, b) => a.indices[0] - b.indices[0] || a.indices[1] - b.indices[1] || a.indices[2] - b.indices[2];
  return celdas.sort(orden);
}

/**
 * Mapped: el registro de salida de la fábrica, la matriz 10×10×10.
 * entrada = diez listas de líneas (una por posición: una línea sin marca es
 * texto y va con clase 0 a la subposición siguiente libre, la décupla de
 * siempre; «@:j.k texto» fija subposición y clase) o una lista de celdas
 * { i, j = 0, k = 0, contenido } (sin contenido y con clase 0 = ver: una
 * referencia a la celda del foco, que tiene que existir). Las celdas son
 * relativas al camino: i.j.k cae en direccion([...camino, i, j, k]) y su
 * clase es claseDe(esa dirección, camino) = k. Cada celda se ubica por su
 * base, como `ubicar` sin modo: dentro del registro, con lo no modificado
 * anterior heredado del foco por referencia, o anclada aparte en su
 * posición si el foco no tiene base. A diferencia de `ubicar` con modo, no
 * ancla por límites: los del modo cuentan la salida entera y se comprueban
 * al escribirla (escribirSalida rechaza la que no cabe; [X] decidir VG si
 * desdeMapped también ancla por límites).
 * → { payload (null si todo se ancla), heredadas, vistas, anclados: [{ celda, en, payload, faltan }], camino }
 * heredadas: posiciones heredadas (número) y subposiciones o clases («i.j», «i.j.k»).
 * vistas: las celdas vistas («i.j»). El registro va en direccion(camino).
 */
export function desdeMapped(eje, entrada, foco, camino = []) {
  const ev = eje.obtener(foco);
  if (!ev) throw new Error('foco desconocido: ' + foco);
  const base = baseDe(ev.payload, camino);
  const celdas = celdasDeEntrada(eje, entrada, foco, camino, base);
  if (!celdas.length) throw new Error('la décupla está vacía: ver ya es una modificación (clase 0); escribe o ve al menos una celda');
  const cubiertos = new Set();
  const dentro = [];
  const anclados = [];
  for (const c of celdas) {
    const u = ubicarSobre(base, c.indices, camino, cubiertos);
    if (u.ubicacion === 'dentro') {
      dentro.push(c);
      cubrir(cubiertos, c.indices);
    } else {
      anclados.push({ celda: c.indices, en: u.en, payload: c.valor, faltan: u.faltan });
    }
  }
  const heredadas = [];
  const payload = dentro.length ? construir(foco, camino, dentro, heredadas) : null;
  if (payload && anclados.length) PENDIENTES.set(payload, anclados);
  const vistas = dentro.filter((c) => c.ve).map((c) => etiqueta(c.indices.slice(0, 2)));
  return { payload, heredadas, vistas, anclados, camino: [...camino] };
}

/** El nombre de la regla del coste de escribir (VG 12-11, decisión 7): una lectura de la época, it = la candidata. */
export const REGLA_DEL_COSTE = 'the cost of writing';

/**
 * Lo que un registro exige en T por escribirlo, en segundos: la regla «the cost of writing» de la época leída sobre
 * la candidata (su payload; it = ev): la suma de lo que exige cada posición (A3: un minuto del calendario por
 * posición, epoch.7.0.1). Una época sin esa regla cobra lo de A3 tal cual. Con `eje`, las referencias del payload se
 * siguen en él (la medida del 8 las alcanza).
 */
export function exigido(payload, { epoca = EPOCA_0_BTML, eje = null } = {}) {
  const regla = (epoca?.lecturas ?? []).find((r) => nombreDeRegla(r) === REGLA_DEL_COSTE);
  if (!regla) return contarPosiciones(payload) * SEGUNDOS.minuto;
  const ctx = new ContextoEje(eje, { ev: { autor: null, payload, movimientos: [] }, epoch: epoca });
  const r = leerRegla(regla, ctx.nombre('ev'), ctx);
  if (r.estado !== 'RESUELTO' || r.valor.length !== 1 || typeof r.valor[0] !== 'number') throw new Error(REGLA_DEL_COSTE + ': ' + (r.motivo ?? 'no da un número: ' + r.texto));
  return r.valor[0];
}

/** Minutos de T que mueve un registro: lo que exige la regla del coste (uno por posición del registro, las heredadas también). */
export function costeT(payload, opciones) {
  return Math.ceil(exigido(payload, opciones) / SEGUNDOS.minuto - 1e-9);
}

/**
 * La quema que exige escribir un registro (VG 12-11, #64 b): el movimiento de T de `autor` que paga lo que la regla
 * «the cost of writing» calcula para el payload, en la escala pedida (una real; por defecto el minuto, la de A3) y
 * redondeado hacia arriba a unidades enteras. La condición «writing burns today's T» exige al menos esto: una sola
 * tarifa, venga el registro de una plantilla, de escribirDesde, de un ejemplo o de una prueba. Todo lo que se escribe
 * a mano lo calcula aquí y no con un minuto fijo. → { token, escala, cantidad, de, a }; null si el payload no exige
 * nada. Con `opciones` ({ eje, epoca }) se leen las referencias del payload y la regla de esa época.
 */
export function quemaDelCoste(autor, payload, escala = 'minuto', opciones) {
  if (!ESCALAS_REALES.includes(escala)) throw new Error('la quema del coste va en una escala real (' + ESCALAS_REALES.join(', ') + '), no «' + escala + '»');
  const segundos = exigido(payload, opciones);
  if (!(segundos > 0)) return null;
  return { token: 'T', escala, cantidad: Math.ceil(segundos / SEGUNDOS[escala] - 1e-9), de: autor, a: null };
}

/** El orden en que se busca la escala que alcanza: la del minuto (la de A3) primero. */
const ESCALAS_A_PROBAR = Object.freeze(['minuto', 'segundo', 'hora', 'dia', 'semana', 'ciclo', 'anio']);

/**
 * La escala en que `autor` puede pagar el coste de escribir `payload` el día de `t` (VG 12-11, #64 b): la primera, empezando
 * por el minuto, en la que su saldo de T cubre lo exigido (`eje.saldoT`); el minuto si en ninguna. Para quien no pide
 * escala (las bases, las pruebas); el ajuste fino por escalas (1 h 11 min) es de la carta.
 */
export function escalaQueAlcanza(eje, autor, payload, t, opciones, extra = 0) {
  for (const escala of ESCALAS_A_PROBAR) {
    // extra: segundos de más que se queman junto al coste (la autorización prepagada, VG 14-11, #70 (3)).
    const quema = extra > 0 ? tDelCoste(exigido(payload, { ...opciones, eje }) + extra, escala) : quemaDelCoste(autor, payload, escala, { ...opciones, eje });
    if (quema && eje.saldoT(autor, escala, t) >= quema.cantidad) return escala;
  }
  return 'minuto';
}

/** Las escalas en que se propone el coste sin escala pedida (las de semana, ciclo y año van en partes diarias). */
const ESCALAS_DEL_COSTE = Object.freeze(['dia', 'hora', 'minuto', 'segundo']);

/**
 * La T que cubre lo exigido (VG 12-11, decisión 7): en la escala pedida (una real), las unidades que lo cubren; sin
 * pedirla, la menor cantidad que lo cubre sin pagar de más: la escala más gruesa cuya unidad cabe un número entero de
 * veces en lo exigido (con un minuto por posición, el minuto). → { escala, cantidad }, o null si no exige nada. El
 * ajuste fino por escalas (1 h 11 min) es de la carta.
 */
export function tDelCoste(segundos, escala) {
  if (!(segundos > 0)) return null;
  if (escala !== undefined && escala !== null) {
    if (!ESCALAS_REALES.includes(escala)) throw new Error('la T del coste va en una escala real (' + ESCALAS_REALES.join(', ') + '), no «' + escala + '»');
    return { escala, cantidad: Math.ceil(segundos / SEGUNDOS[escala] - 1e-9) };
  }
  const exacta = ESCALAS_DEL_COSTE.find((e) => Math.abs(segundos / SEGUNDOS[e] - Math.round(segundos / SEGUNDOS[e])) < 1e-9);
  return exacta ? { escala: exacta, cantidad: Math.round(segundos / SEGUNDOS[exacta]) } : { escala: 'segundo', cantidad: Math.ceil(segundos) };
}

/**
 * Cada heredada ha de ser una referencia al foco en su propia dirección
 * (bajo `camino`), y el foco ha de tener contenido en ese camino exacto:
 * solo así es relleno, no se emite y alcanza algo.
 */
function comprobarHeredadas(eje, payload, heredadas, foco, camino) {
  if (!Array.isArray(heredadas)) throw new Error('heredadas es una lista');
  if (!heredadas.length) return;
  const ev = eje.obtener(foco);
  if (!ev) throw new Error('foco desconocido: ' + foco);
  const base = baseDe(ev.payload, camino);
  const repetidas = new Set();
  for (const h of heredadas) {
    if (!/^[0-9](\.[0-9])*$/.test(String(h))) throw new Error('heredada no válida: ' + h);
    const indices = String(h).split('.').map(Number);
    if (camino.length + indices.length > ARIDAD) throw new Error('heredada no válida: ' + h);
    const clave = etiqueta(indices);
    if (repetidas.has(clave)) throw new Error('la heredada ' + clave + ' está dos veces');
    repetidas.add(clave);
    let nodo = payload;
    for (const x of indices) nodo = Array.isArray(nodo) ? nodo[x] : undefined;
    if (indices.length > 1 && esLista(nodo) && nodo.length === 1) nodo = nodo[0]; // el 0 envuelto de una décupla (construir)
    const dir = direccion([...camino, ...indices]);
    if (!esReferencia(nodo) || nodo.ref !== foco || nodo.dir !== dir) {
      throw new Error('la heredada ' + clave + ' no es una referencia al foco en ' + dir);
    }
    if (!hayContenido(base, indices, camino.length === 0)) throw new Error('la heredada ' + clave + ' no alcanza nada en el foco: solo se hereda lo que el foco tiene');
  }
}

/**
 * Escribe un registro de salida de un modo sobre el foco (`sobre` + `en`;
 * `en` vale por defecto la dirección de `camino`, la raíz sin camino).
 * Comprueba el límite del modo: su máximo (tope duro) sobre lo emitido; la
 * proporción no rechaza (decisión 10.3: se lee con
 * proporcionDeRegistro(evento)) (las `heredadas`, si se dan, no cuentan: cada una ha de ser una referencia
 * al foco en su dirección que alcance algo, y quedan en contexto.heredadas;
 * con ellas, el registro va en la dirección de `camino`, y otro `en` se
 * rechaza). Mueve T del autor: un minuto por posición del registro.
 * Con `celda` ([i, j, k] bajo `camino`), `payload` es el contenido de esa
 * celda y se ubica con `ubicar` con el modo: dentro, se envuelve en la
 * matriz con lo anterior heredado del foco; anclado (sin base, o porque
 * dentro no cabría), se escribe tal cual. El registro va en el `en` que da
 * `ubicar`, y la celda cae en su `dir`; otro `en` se rechaza.
 * Por debajo del mínimo del modo se escribe igual: devuelve el evento del
 * eje, y alcanceDeRegistro(evento) da los tres números (VG, 7-11 noche).
 */
export async function escribirDesde(eje, opciones, privada) {
  const { payload } = opciones;
  if (payload === undefined || payload === null) throw new Error('nada que escribir en el registro (si todo se ancla, escribe la salida con escribirSalida)');
  const pendientes = PENDIENTES.get(payload);
  if (pendientes) {
    const n = pendientes.length;
    throw new Error(n + (n === 1 ? ' celda sin base en el foco se ancla' : ' celdas sin base en el foco se anclan') + ' aparte ('
      + pendientes.map((a) => etiqueta(a.celda) + ' en ' + a.en).join(', ') + '): escribe la salida entera con escribirSalida');
  }
  return escribirRegistro(eje, opciones, privada);
}

/** escribirDesde sin el aviso de lo anclado: lo usa escribirSalida, que escribe también lo anclado. */
async function escribirRegistro(eje, { modo, autor, sobre, en, payload, t = new Date().toISOString(), contexto = {}, celda, camino = [], heredadas = [] }, privada) {
  let destino = en ?? direccion(camino);
  let cuerpo = payload;
  let relleno = heredadas;
  if (celda !== undefined) {
    if (heredadas.length) throw new Error('con celda, lo heredado lo pone la escritura');
    const u = ubicar(eje, sobre, celda, { camino, modo, contenido: payload });
    if (en !== undefined && en !== u.en) throw new Error('la celda ' + etiqueta(celda) + ' cae en ' + u.dir + ': el registro va en ' + u.en + ', no en ' + en);
    destino = u.en;
    relleno = [];
    if (u.ubicacion === 'dentro') cuerpo = construir(sobre, camino, [{ indices: celda, valor: payload }], relleno);
  } else if (Array.isArray(heredadas) && heredadas.length && destino !== direccion(camino)) {
    throw new Error('con heredadas, el registro va en ' + direccion(camino) + ' (la dirección de su camino), no en ' + destino);
  }
  comprobarHeredadas(eje, cuerpo, relleno, sobre, camino);
  const posiciones = contarPosiciones(cuerpo);
  const emitidas = posiciones - relleno.length;
  if (emitidas < 1) throw new Error('nada que emitir: todo el registro es herencia del foco');
  comprobarLimites({ emitidas, posiciones }, modo, 'este registro');
  return eje.escribir({
    autor,
    sobre,
    en: destino,
    t,
    movimientos: [quemaDelCoste(autor, cuerpo, 'minuto', { eje })],
    payload: cuerpo,
    contexto: { ...contexto, modo, ...(relleno.length ? { heredadas: [...relleno] } : {}) },
  }, privada);
}

/**
 * Los tres números de lo que un registro de salida emitió (VG, 7-11 noche):
 * { conseguido, minimo, maximo, alMinimo }, con conseguido = posiciones
 * emitidas (las del registro menos las heredadas de contexto.heredadas) y
 * el mínimo y el máximo de su modo (contexto.modo). Por debajo del mínimo
 * no es error: se dice. Un registro sin modo no salió de un modo: error.
 */
export function alcanceDeRegistro(ev) {
  const modo = ev?.contexto?.modo;
  if (modo === undefined) throw new Error('el registro no dice desde qué modo se escribió (contexto.modo)');
  const heredadas = Array.isArray(ev.contexto.heredadas) ? ev.contexto.heredadas.length : 0;
  return alcanceDe(contarPosiciones(ev.payload) - heredadas, modo);
}

/**
 * Dónde queda un registro de salida respecto de la proporción de su modo
 * (contexto.modo), lo que la fábrica propone (VG, 7-11 noche, decisión
 * 10.3): modos.proporcionDe con todas sus posiciones, lo heredado incluido.
 * Fuera de la proporción, `aviso` lo dice; nunca es error.
 */
export function proporcionDeRegistro(ev) {
  const modo = ev?.contexto?.modo;
  if (modo === undefined) throw new Error('el registro no dice desde qué modo se escribió (contexto.modo)');
  return proporcionDe(contarPosiciones(ev.payload), modo);
}

/**
 * Escribe la salida entera de desdeMapped: el registro (si hay algo dentro)
 * en la dirección de su camino, con sus heredadas, y cada celda anclada en
 * su posición. El máximo del modo cuenta lo emitido por la salida entera
 * antes de escribir nada: si no cabe, la rechaza entera, no ancla celdas
 * por límites como `ubicar` con modo ([X] decidir VG). No es atómica: si el
 * eje rechaza un anclado, lo anterior queda escrito. La marca que impide
 * escribir el payload solo (sin lo anclado) se borra cuando todo se ha
 * escrito.
 * → { registro: evento | null, anclados: [evento], proporcion, alcance, avisos }
 * proporcion: dónde quedan las posiciones de la salida (todas, lo heredado
 * incluido) respecto de la proporción del modo, lo que la fábrica propone
 * (decisión 10.3: la proporción propone, el máximo manda): por debajo o por
 * encima se escribe igual, con su `aviso`.
 * avisos: los textos que la vista enseña (hoy, el de la proporción, si lo hay).
 * alcance: los tres números de lo emitido por la salida entera (VG, 7-11
 * noche): { conseguido, minimo, maximo, alMinimo }; por debajo del mínimo
 * se escribe igual y se dice (alMinimo false).
 */
export async function escribirSalida(eje, { modo = 'mapped', autor, sobre, salida, t = new Date().toISOString(), contexto = {} }, privada) {
  const payload = salida?.payload ?? null;
  const anclados = salida?.anclados ?? [];
  const heredadas = salida?.heredadas ?? [];
  const camino = salida?.camino ?? [];
  if (payload === null && !anclados.length) throw new Error('nada que escribir');
  if (payload !== null) comprobarHeredadas(eje, payload, heredadas, sobre, camino);
  const posiciones = (payload === null ? 0 : contarPosiciones(payload)) + anclados.reduce((n, a) => n + contarPosiciones(a.payload), 0);
  const emitidas = posiciones - (payload === null ? 0 : heredadas.length);
  comprobarLimites({ emitidas, posiciones }, modo, 'esta salida');
  const registro = payload === null ? null : await escribirRegistro(eje, { modo, autor, sobre, camino, payload, heredadas, t, contexto }, privada);
  const escritos = [];
  for (const a of anclados) escritos.push(await escribirRegistro(eje, { modo, autor, sobre, en: a.en, payload: a.payload, t, contexto }, privada));
  if (payload !== null) PENDIENTES.delete(payload);
  const proporcion = proporcionDe(posiciones, modo);
  return { registro, anclados: escritos, proporcion, alcance: alcanceDe(emitidas, modo), avisos: proporcion.aviso ? [proporcion.aviso] : [] };
}

export { esReferencia };
