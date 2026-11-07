// Escritura: el registro de salida según el modo. Se anida sobre el contenido
// del foco (sobre + en). Pointed escribe un terminal; Sequenced una hilera de
// hasta diez posiciones; Mapped la matriz de la fábrica.
//
// La fábrica (PV4) parte de la matriz de 100 del foco (10 posiciones × 10
// subposiciones), que ya está y no se emite. El registro de salida emite
// SOLO las celdas modificadas, en una matriz 10×10×10: posición ×
// subposición × CLASE de modificación. La clase es el tercer dígito bajo la
// época 0 (los diez PV): una modificación de clase k sobre la celda [i][j]
// se escribe en payload[i][j][k]. Ver ya es una modificación (clase 0), así
// que siempre se emite algo; solo se ve lo que el foco tiene.
//
// Lo no modificado anterior a lo modificado se hereda del foco por
// referencia, y solo si el foco tiene contenido en ese camino exacto (un
// terminal no tiene posiciones, tampoco la 0: mapa §12). Así una referencia
// heredada siempre alcanza algo. Si falta esa base, la celda es lejana y se
// ancla en su posición (`en`) en vez de rechazarse. El registro dice qué
// heredó (contexto.heredadas): lo demás se vio o se escribió.
//
// Topes duros por modo (src/modos.js): Pointed 10, Sequenced 100, Mapped
// 1000, Scened 10000 posiciones emitidas. Lo heredado no se emite y no
// cuenta para el tope. Provisional, [X] decidir VG: la proporción informa y
// no rechaza (el mapa §12 dice «además de la proporción»; ver src/modos.js).
// Coste de cartón piedra: cada posición del registro mueve un minuto de T
// del autor, la heredada también ([X] decidir VG si el relleno se cobra).

import { ARIDAD, esReferencia, esTerminal, direccion, validarPayload } from './btml.js';
import { contarPosiciones, nombreModo, tope, proporcionDe } from './modos.js';

/**
 * Las clases de modificación: los diez PV como tercer dígito (VG, 7-11-2026).
 * VG nombró las cinco primeras. Las 5–9 son los PV 5–9 (estructura, pasado,
 * futuro, comparabilidad, camino), pero su nombre como clase de
 * modificación no está decidido: valen null ([X] decidir VG).
 */
export const CLASES = Object.freeze([
  'ver/sustituir', // 0
  'impulso de recursos', // 1
  'criterio', // 2
  'comunicación', // 3
  'acción', // 4
  null, null, null, null, null, // 5–9: [X] decidir VG
]);

/** Clase de modificación de una dirección: su tercer dígito. */
export function claseDe(dir) {
  return Number(String(dir)[2]);
}

/** Resuelve un prefijo de id («@25ddaa89») a un id completo del eje. Único o error. */
export function resolverRef(eje, prefijo) {
  const p = prefijo.replace(/^@/, '').toLowerCase();
  if (p.length < 4) throw new Error('referencia demasiado corta: ' + prefijo);
  const ids = eje.orden.filter((id) => id.startsWith(p));
  if (ids.length === 0) throw new Error('referencia desconocida: ' + prefijo);
  if (ids.length > 1) throw new Error('referencia ambigua: ' + prefijo);
  return { ref: ids[0] };
}

/** Un ítem de entrada: texto («@id» es referencia; «@id:1200000000» con subposición) o número. */
export function item(eje, texto) {
  const t = String(texto).trim();
  if (!t) throw new Error('ítem vacío');
  const m = /^@([0-9a-f]{4,64})(?::([0-9]{10}))?$/i.exec(t);
  if (m) return m[2] ? { ...resolverRef(eje, m[1]), dir: m[2] } : resolverRef(eje, m[1]);
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

// ---------- la matriz 10×10×10 ----------

const etiqueta = (indices) => indices.join('.');

/** Nodo del foco bajo un camino (sin seguir referencias). */
function baseDe(payload, camino) {
  let base = payload;
  for (const i of camino) base = Array.isArray(base) ? base[i] : undefined;
  return base;
}

/**
 * Si el foco tiene contenido en un camino exacto (sin seguir referencias).
 * Un terminal no tiene posiciones, tampoco la 0 (mapa §12): lo que cuelga
 * de un terminal no tiene base.
 */
function hayContenido(nodo, indices) {
  for (const x of indices) {
    if (!Array.isArray(nodo)) return false;
    nodo = nodo[x];
  }
  return nodo !== undefined;
}

/**
 * Si hay algo que ver en la celda [i][j]: si su dirección alcanza algo en
 * el foco. Los ceros finales nombran la colisión (mapa §12): 4.0 alcanza la
 * posición 4 y 0.0, la raíz, también cuando son terminales.
 */
function hayQueVer(base, i, j) {
  const camino = [i, j];
  while (camino.length && camino[camino.length - 1] === 0) camino.pop();
  return hayContenido(base, camino);
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
 * registro aparte con `en` = la dirección de la celda. Lo lejano no se
 * rechaza. Dentro, el registro va en la dirección del camino, de modo que la
 * celda cae en `dir` igual que anclada.
 * → { ubicacion: 'dentro' | 'anclado', dir, en (solo anclado), faltan: ['5', '6', …] }
 */
export function ubicar(eje, foco, celda, { camino = [], escritas = [] } = {}) {
  const ev = eje.obtener(foco);
  if (!ev) throw new Error('foco desconocido: ' + foco);
  comprobarCelda(celda, camino);
  const cubiertos = new Set();
  for (const e of escritas) cubrir(cubiertos, e);
  return ubicarSobre(baseDe(ev.payload, camino), celda, camino, cubiertos);
}

/** Marca como escritos los prefijos de una celda que va dentro. */
function cubrir(cubiertos, celda) {
  for (let n = 1; n <= celda.length; n++) cubiertos.add(etiqueta(celda.slice(0, n)));
}

function ubicarSobre(base, celda, camino, cubiertos) {
  const faltan = [];
  for (let n = 0; n < celda.length; n++) {
    for (let s = 0; s < celda[n]; s++) {
      const hueco = [...celda.slice(0, n), s];
      if (!cubiertos.has(etiqueta(hueco)) && !hayContenido(base, hueco)) faltan.push(etiqueta(hueco));
    }
  }
  const dir = direccion([...camino, ...celda]);
  return faltan.length ? { ubicacion: 'anclado', en: dir, dir, faltan } : { ubicacion: 'dentro', dir, faltan };
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
    return d > 0 && arr.length === 1 && esTerminal(arr[0]) ? arr[0] : arr;
  };
  return nivel([], celdas);
}

// Payloads de desdeMapped que dejan celdas ancladas aparte: escribir solo el
// payload las perdería, así que escribirDesde lo impide (ver escribirSalida).
const PENDIENTES = new WeakMap();

const PREFIJO = /^([0-9])\.([0-9])\s+(\S.*)$/;

/**
 * Líneas por posición → celdas. Cada línea es texto y va con clase 0 a la
 * subposición siguiente libre (la décupla de siempre). Solo con `prefijo`,
 * una línea «j.k texto» fija subposición y clase.
 */
function celdasDeLineas(listas, prefijo) {
  const celdas = [];
  listas.forEach((lista, i) => {
    const lineas = (lista ?? []).map((t) => String(t ?? '').trim()).filter(Boolean);
    if (!lineas.length) return;
    if (i >= ARIDAD) throw new Error('la décupla tiene más de ' + ARIDAD + ' posiciones');
    const sueltas = [];
    for (const t of lineas) {
      const m = prefijo ? PREFIJO.exec(t) : null;
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
 * una referencia a la celda del foco, que tiene que existir.
 */
function valorDe(eje, c, foco, camino, base) {
  const { contenido } = c;
  if (sinContenido(contenido)) {
    if (c.k !== 0) throw new Error('falta el contenido de ' + etiqueta([c.i, c.j, c.k]) + ': solo ver (clase 0) va sin contenido');
    if (!hayQueVer(base, c.i, c.j)) throw new Error('no hay nada que ver en ' + etiqueta([c.i, c.j]) + ': el foco no tiene esa celda');
    return { ref: foco, dir: direccion([...camino, c.i, c.j]) };
  }
  if (typeof contenido === 'string') return item(eje, contenido);
  const v = validarPayload(contenido);
  if (!v.ok) throw new Error('contenido no válido en ' + etiqueta([c.i, c.j, c.k]) + ': ' + v.errores.join('; '));
  return contenido;
}

/** Entrada de Mapped → celdas [{ indices: [i, j, k], valor, ve }] en orden de dirección, sin repetir. */
function celdasDeEntrada(eje, entrada, foco, camino, base, prefijo) {
  if (!Array.isArray(entrada)) throw new Error('Mapped recibe diez listas de líneas o una lista de celdas { i, j, k, contenido }');
  const presentes = entrada.filter((e) => e !== undefined && e !== null);
  const sonLineas = presentes.every((e) => Array.isArray(e));
  if (!sonLineas && !presentes.every((e) => typeof e === 'object' && !Array.isArray(e))) {
    throw new Error('mezcla de líneas y celdas: usa diez listas de líneas o una lista de celdas { i, j, k, contenido }');
  }
  const crudas = sonLineas ? celdasDeLineas(entrada, prefijo) : presentes.map(({ i, j = 0, k = 0, contenido }) => ({ i, j, k, contenido }));
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
 * entrada = diez listas de líneas (una por posición: cada línea es texto y
 * va con clase 0 a la subposición siguiente libre, la décupla de siempre;
 * con { prefijo: true }, «j.k texto» fija subposición y clase) o una lista
 * de celdas { i, j = 0, k = 0, contenido } (sin contenido y con clase 0 =
 * ver: una referencia a la celda del foco, que tiene que existir). Cada
 * celda se ubica con `ubicar`: dentro del registro, con lo no modificado
 * anterior heredado del foco por referencia, o anclada aparte en su
 * posición si el foco no tiene base.
 * → { payload (null si todo se ancla), heredadas, vistas, anclados: [{ celda, en, payload, faltan }], camino }
 * heredadas: posiciones heredadas (número) y subposiciones o clases («i.j», «i.j.k»).
 * vistas: las celdas vistas («i.j»). El registro va en direccion(camino).
 */
export function desdeMapped(eje, entrada, foco, camino = [], { prefijo = false } = {}) {
  const ev = eje.obtener(foco);
  if (!ev) throw new Error('foco desconocido: ' + foco);
  const base = baseDe(ev.payload, camino);
  const celdas = celdasDeEntrada(eje, entrada, foco, camino, base, prefijo);
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

/** Minutos de T que mueve un registro: uno por posición del registro (las heredadas también). */
export function costeT(payload) {
  return contarPosiciones(payload);
}

function comprobarTope(posiciones, modo, que) {
  const max = tope(modo);
  if (posiciones > max) throw new Error(nombreModo(modo) + ' emite como mucho ' + max + ' posiciones; ' + que + ' tiene ' + posiciones);
}

/**
 * Cada heredada ha de ser una referencia al foco en su propia dirección
 * (bajo `camino`): solo así es relleno y no se emite.
 */
function comprobarHeredadas(payload, heredadas, foco, camino) {
  if (!Array.isArray(heredadas)) throw new Error('heredadas es una lista');
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
    const dir = direccion([...camino, ...indices]);
    if (!esReferencia(nodo) || nodo.ref !== foco || nodo.dir !== dir) {
      throw new Error('la heredada ' + clave + ' no es una referencia al foco en ' + dir);
    }
  }
}

/**
 * Escribe un registro de salida de un modo sobre el foco (`sobre` + `en`;
 * `en` vale por defecto la dirección de `camino`, la raíz sin camino).
 * Comprueba el tope duro del modo sobre lo emitido: las `heredadas`, si se
 * dan, no cuentan (cada una ha de ser una referencia al foco en su
 * dirección, y quedan en contexto.heredadas). Mueve T del autor: un minuto
 * por posición del registro.
 * Con `celda` ([i, j, k] bajo `camino`), `payload` es el contenido de esa
 * celda y se ubica con `ubicar`: dentro, se envuelve en la matriz con lo
 * anterior heredado del foco y el registro va en la dirección del camino;
 * anclado, se escribe tal cual en la dirección de la celda. En los dos
 * casos la celda cae en la dirección que da `ubicar`; otro `en` se rechaza.
 */
export async function escribirDesde(eje, { modo, autor, sobre, en, payload, t = new Date().toISOString(), contexto = {}, celda, camino = [], heredadas = [] }, privada) {
  if (payload === undefined || payload === null) throw new Error('nada que escribir en el registro (si todo se ancla, escribe la salida con escribirSalida)');
  const pendientes = PENDIENTES.get(payload);
  if (pendientes) {
    const n = pendientes.length;
    throw new Error(n + (n === 1 ? ' celda sin base en el foco se ancla' : ' celdas sin base en el foco se anclan') + ' aparte ('
      + pendientes.map((a) => etiqueta(a.celda) + ' en ' + a.en).join(', ') + '): escribe la salida entera con escribirSalida');
  }
  let destino = en ?? direccion(camino);
  let cuerpo = payload;
  let relleno = heredadas;
  if (celda !== undefined) {
    if (heredadas.length) throw new Error('con celda, lo heredado lo pone la escritura');
    const u = ubicar(eje, sobre, celda, { camino });
    const sitio = u.ubicacion === 'anclado' ? u.en : direccion(camino);
    if (en !== undefined && en !== sitio) throw new Error('la celda ' + etiqueta(celda) + ' cae en ' + u.dir + ': el registro va en ' + sitio + ', no en ' + en);
    destino = sitio;
    relleno = [];
    if (u.ubicacion === 'dentro') cuerpo = construir(sobre, camino, [{ indices: celda, valor: payload }], relleno);
  }
  comprobarHeredadas(cuerpo, relleno, sobre, camino);
  const emitidas = contarPosiciones(cuerpo) - relleno.length;
  if (emitidas < 1) throw new Error('nada que emitir: todo el registro es herencia del foco');
  comprobarTope(emitidas, modo, 'este registro');
  return eje.escribir({
    autor,
    sobre,
    en: destino,
    t,
    movimientos: [{ token: 'T', escala: 'minuto', cantidad: costeT(cuerpo), de: autor, a: null }],
    payload: cuerpo,
    contexto: { ...contexto, modo, ...(relleno.length ? { heredadas: [...relleno] } : {}) },
  }, privada);
}

/**
 * Escribe la salida entera de desdeMapped: el registro (si hay algo dentro)
 * en la dirección de su camino, con sus heredadas, y cada celda anclada en
 * su posición. El tope del modo cuenta lo emitido por la salida entera (lo
 * heredado no), antes de escribir nada. No es atómica: si el eje rechaza un
 * anclado, lo anterior queda escrito.
 * → { registro: evento | null, anclados: [evento], proporcion }
 * proporcion: dónde queda lo emitido respecto de la proporción del modo
 * (informa, no rechaza: [X] decidir VG).
 */
export async function escribirSalida(eje, { modo = 'mapped', autor, sobre, salida, t = new Date().toISOString(), contexto = {} }, privada) {
  const payload = salida?.payload ?? null;
  const anclados = salida?.anclados ?? [];
  const heredadas = salida?.heredadas ?? [];
  const camino = salida?.camino ?? [];
  if (payload === null && !anclados.length) throw new Error('nada que escribir');
  if (payload !== null) comprobarHeredadas(payload, heredadas, sobre, camino);
  const emitidas = (payload === null ? 0 : contarPosiciones(payload) - heredadas.length) + anclados.reduce((n, a) => n + contarPosiciones(a.payload), 0);
  comprobarTope(emitidas, modo, 'esta salida');
  if (payload !== null) PENDIENTES.delete(payload);
  const registro = payload === null ? null : await escribirDesde(eje, { modo, autor, sobre, camino, payload, heredadas, t, contexto }, privada);
  const escritos = [];
  for (const a of anclados) escritos.push(await escribirDesde(eje, { modo, autor, sobre, en: a.en, payload: a.payload, t, contexto }, privada));
  return { registro, anclados: escritos, proporcion: proporcionDe(emitidas, modo) };
}

export { esReferencia };
