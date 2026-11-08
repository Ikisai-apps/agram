// Mapped: la matriz 3×3 de puntos de vista sobre el foco.
//   1 8 2
//   6 5 7   (0 es la lente sobre el 5: el centro)
//   3 9 4
// Lectura segura, de la cruz a la X: el eje 6·5·7 es el hilo (pasado a la
// izquierda, foco en el centro, lo escrito después a la derecha); 8 es la
// lectura del 8 (ocho(): la base escrita en el 8 que resume la cohorte del
// foco, o el respaldo al vuelo declarado «sin base escrita»); 9 el camino
// recorrido; las esquinas 1–4 son la capa donde va la mano.
//
// Medidas perezosas (VG, 8-11: «bien a ambos»): las medidas que enseñan las
// vistas son la medida única del 8 (bases.medir), y se calculan solo cuando
// se piden: al pintar la celda 8 (ocho) o con mapa(…, { medidas: true }).
// mapa() sin la opción no mide, porque Scened pide un mapa por cada foco.

import { ARIDAD, esReferencia, esLista, direccion } from './btml.js';
import { EPOCA_0, epocaDe, nombreEnNodo } from './epocas.js';
import { MODOS, alcanceDe, maximo as maximoDe, contenido, recortar, admitir, avisoCorte } from './modos.js';
import { ALCANCES, MEDIDAS, situar, medir } from './bases.js';

/** Las tres cohortes de la celda 8, en su orden: hermanos (por defecto), proyecto y todo el eje (general). */
export const COHORTES = ALCANCES;

/**
 * Recuentos del foco que la celda 8 enseña como información, en una segunda
 * línea (VG, 8-11; mapa §12, R7: el 8 solo funde cantidades y sitúa por
 * cuota; los recuentos son informativos, fuera de cortes y criterios). Son
 * valores de la medida única (bases.medir), sin caja.
 */
export const RECUENTOS = Object.freeze([
  Object.freeze({ clave: 'profundidadHilo', etiqueta: 'hilo' }),
  Object.freeze({ clave: 'escritos', etiqueta: 'escritos' }),
  Object.freeze({ clave: 'movimientos', etiqueta: 'movimientos' }),
  Object.freeze({ clave: 'posiciones', etiqueta: 'posiciones' }),
  Object.freeze({ clave: 'identidades', etiqueta: 'identidades' }),
]);

let mediciones = 0;

/**
 * Cuántas veces Mapped y Scened han pedido la medida del 8 de un registro
 * (medidasDe) desde que se cargó el módulo. Es el contador que comprueba que
 * la medida es perezosa: mapa() sin { medidas: true } no lo mueve.
 */
export function medicionesPedidas() {
  return mediciones;
}

/**
 * La medida de un registro tal como la enseñan las vistas: la del 8, la
 * única (bases.medir), con sus medidas (MEDIDAS) y sus tokens por serie, sin
 * el detalle por posición. Cuesta lo que cuesta medir (ocupantes de las diez
 * posiciones y fórmulas del payload): por eso solo se pide bajo demanda.
 */
export function medidasDe(eje, id) {
  mediciones++;
  const m = medir(eje, id);
  const r = {};
  for (const { clave } of MEDIDAS) r[clave] = m[clave];
  r.tokens = { ...m.tokens };
  return r;
}

export const MATRIZ = Object.freeze([
  [1, 8, 2],
  [6, 5, 7],
  [3, 9, 4],
]);

function payloadEn(ev, camino) {
  let p = ev.payload;
  for (const i of camino) p = Array.isArray(p) ? p[i] : undefined;
  return p;
}

/**
 * Registros de hilo y de hijos que se pueden pedir como mucho: el foco, 499
 * de hilo y 499 hijos son 999 registros, cada uno con al menos una posición
 * con contenido; más ya no cabría nunca en el máximo de Mapped (1000).
 */
export const MAXIMO_REGISTROS = Math.floor((maximoDe('mapped') - 1) / 2);

/**
 * Mapa del foco: una celda por PV con su contenido en la profundidad del
 * camino y cuántos registros se han escrito en esa posición; y el eje (hilo
 * hacia atrás y escritos sobre el foco). `medidas` es null salvo que se
 * pidan con { medidas: true }: entonces es la medida única del 8 del foco
 * (medidasDe, es decir, bases.medir), no unos recuentos propios de la vista.
 * La celda 8 no la necesita: lee ocho(). La época va
 * por objeto o por nombre, como en leerDireccion. `maximo`: registros de
 * hilo y de hijos que se piden (por defecto 10 de cada); un entero de 0 a
 * MAXIMO_REGISTROS: pedir más es pedir más del máximo, y lanza.
 * `alcance` da los tres números del modo (VG, 7-11 noche): lo conseguido
 * (decisión 10.1: el contenido real de cada registro traído, el foco, su
 * hilo y sus hijos, cada uno una vez), el mínimo (100) y el máximo (1000).
 * Corte duro (decisión 10.2), en este orden: el foco, su hilo (el más
 * cercano primero) y sus hijos (por llegada); el primero que no cabe y los
 * que vienen detrás quedan fuera, nada entra a medias. Si el foco solo ya
 * pasa del máximo, entra recortado por índice, como en Pointed, y nada más.
 * `corte` es null o { maximo, conseguido, necesario, foco: 'entero' |
 * 'recortado', fuera: [ids] }, y `avisos[0]` dice «… Trae X de Y
 * posiciones.».
 */
export function mapa(eje, id, { camino = [], epoca = EPOCA_0, maximo = MODOS.sequenced.decuplas, medidas: pedirMedidas = false } = {}) {
  const original = eje.obtener(id);
  if (!original) throw new Error('foco desconocido: ' + id);
  if (!(Number.isInteger(maximo) && maximo >= 0 && maximo <= MAXIMO_REGISTROS)) {
    throw new Error('maximo inválido: ' + maximo + ' (un entero de 0 a ' + MAXIMO_REGISTROS + ' registros de hilo y de hijos: el foco y dos veces ' + MAXIMO_REGISTROS + ' ya son ' + (1 + 2 * MAXIMO_REGISTROS) + ', y el máximo de Mapped es duro; se puede pedir menos, nunca más)');
  }
  const e = epocaDe(epoca);
  // Corte duro: el foco, el hilo y los hijos, en ese orden, mientras quepan.
  const max = maximoDe('mapped');
  const pedidosHilo = eje.hilo(id).slice(1, maximo + 1); // sin el propio foco
  const pedidosHijos = eje.sobre(id).slice(0, maximo);
  const r = recortar(original.payload, max);
  const ev = r.cortado ? { ...original, payload: r.payload } : original;
  const resto = r.cortado ? [] : [...pedidosHilo, ...pedidosHijos];
  const a = admitir(resto.map((x) => contenido(x.payload)), max - r.conseguido);
  const entran = new Set(resto.slice(0, a.entran).map((x) => x.id));
  const hilo = pedidosHilo.filter((x) => entran.has(x.id));
  const hijos = pedidosHijos.filter((x) => entran.has(x.id));
  const conseguido = r.conseguido + a.conseguido;
  const necesario = r.necesario + [...pedidosHilo, ...pedidosHijos].reduce((s, x) => s + contenido(x.payload), 0);
  let corte = null;
  const avisos = [];
  if (r.cortado || a.cortado) {
    const fuera = [...pedidosHilo, ...pedidosHijos].filter((x) => !entran.has(x.id)).map((x) => x.id);
    corte = { maximo: max, conseguido, necesario, foco: r.cortado ? 'recortado' : 'entero', fuera };
    const detalle = (r.cortado ? 'el foco solo ya pasa del máximo y entra recortado por índice; ' : 'entran el foco, su hilo y sus hijos, por ese orden, mientras caben; ')
      + (fuera.length === 1 ? 'queda fuera 1 registro: ' : 'quedan fuera ' + fuera.length + ' registros' + (fuera.length ? ': ' : ''))
      + fuera.slice(0, 10).map((x) => x.slice(0, 8)).join(' ') + (fuera.length > 10 ? ' …' : '');
    avisos.push(avisoCorte('mapped', conseguido, necesario, detalle));
  }
  const p = payloadEn(ev, camino);
  const celdas = [];
  for (let i = 0; i < ARIDAD; i++) {
    celdas.push({
      indice: i,
      // Por hojas (VG, 7-11 noche): una décupla lleva la regla corta por profundidad; bajo una posición,
      // un array solo de hojas es una lista y se pinta como lista: 'ocupante k' y `ocupante`, por llegada.
      ...nombreEnNodo(p, camino.length, i, e),
      contenido: Array.isArray(p) ? p[i] : undefined, // un terminal no tiene posición 0: va aparte, en `terminal`
      escritos: eje.sobre(id, direccion([...camino, i])).length,
    });
  }
  const medidas = pedirMedidas ? medidasDe(eje, id) : null; // perezosa: solo si se pide
  const lista = camino.length > 0 && esLista(p) ? p : undefined;
  const terminal = Array.isArray(p) ? undefined : p;
  const alcance = alcanceDe(conseguido, 'mapped');
  return { foco: id, autor: ev.autor, t: ev.t, sobre: ev.sobre, en: ev.en, camino: [...camino], terminal, ...(lista ? { lista } : {}), celdas, hilo, hijos, medidas, alcance, corte, avisos };
}

/**
 * Cuota del foco frente a su padre, por serie (VG, 8-11: «la cuota del foco
 * frente a su padre», suma del foco ÷ suma del padre). Se lee del 8 del
 * padre, la base de sus hijos (bases.situar con alcance 'hermanos'), y si no
 * la hay, del mismo respaldo al vuelo, dicho. Por cada serie (T por escala, E
 * por emisor y denominación, P por ámbito, R por emisor) que mueven el foco o
 * los hijos del padre: lo que mueve el foco, lo que mueven entre todos los
 * hijos del padre y el cociente (null si el padre no mueve nada en esa
 * serie). Nada se suma entre series.
 * Es la `cuota` que da bases.situar entre hermanos (R7: el valor ÷ la suma de
 * la cohorte, que aquí es el padre); si una serie no la trajera, se calcula
 * igual con su suma.
 * Si la base escrita no mide al foco (llegó después), `incluido` es false y
 * la cuota puede pasar de 1: la frescura lo dice.
 * [X] Para decidir VG: si la suma del foco es solo el foco (hoy) o su
 * subárbol, y si el denominador son los hijos del padre (hoy) o su subárbol.
 * `lectura`: la de situar con alcance 'hermanos', si ya se tiene (no se lee
 * dos veces). Devuelve null sin padre (el génesis), o { padre, escrita, base,
 * frescura, incluido, series: [{ clave, etiqueta, foco, padre, cuota }] }.
 */
export function cuota(eje, foco, { epoca = EPOCA_0, lectura } = {}) {
  const ev = eje.obtener(foco);
  if (!ev) throw new Error('foco desconocido: ' + foco);
  if (ev.sobre === null) return null;
  const s = lectura ?? situar(eje, foco, { alcance: 'hermanos', epoca: epocaDe(epoca), respaldo: true });
  if (s.estado !== 'RESUELTO') return null;
  const series = Object.keys(s.tokens).sort().map((clave) => {
    const x = s.tokens[clave];
    const c = 'cuota' in x ? x.cuota : x.suma ? x.foco / x.suma : null;
    return { clave, etiqueta: x.etiqueta, foco: x.foco, padre: x.suma, cuota: c };
  });
  const incluido = s.escrita ? s.incluido : s.comparables.some((f) => f.id === foco);
  return { padre: ev.sobre, escrita: s.escrita, base: s.escrita ? s.base : null, frescura: s.frescura, incluido, series };
}

// Una cantidad situada, sin el hito: la caja es un tramo de valores, no un nivel.
const cantidad = (clave, x) => ({
  clave, etiqueta: x.etiqueta, foco: x.foco, caja: x.caja, cuota: x.cuota ?? null, cajaCuota: x.cajaCuota ?? null,
  debajo: x.debajo, enCaja: x.enCaja, encima: x.encima,
  n: x.n, suma: x.suma, minimo: x.minimo, maximo: x.maximo, media: x.media, cortes: [...x.cortes], cajas: [...x.cajas],
});

/**
 * Lo que lee la celda 8 de Mapped (VG, 7-11 noche: una sola verdad del 8, la
 * escrita): la base escrita en el 8 que resume la cohorte del foco
 * (bases.situar) o, si no la hay, el respaldo al vuelo declarado
 * (bases.confluir), con frescura «sin base escrita». La cohorte (VG, 8-11):
 * 'hermanos' por defecto (el 8 del padre), 'proyecto' o 'general' (todo el
 * eje). Es la única lectura del 8 de las vistas: la celda sobria y el cielo
 * animado (mundos/cielo.js, datosCielo) leen de aquí. Se calcula al pintar
 * la celda 8, nunca por cada registro de una escena: mapa() no la llama.
 * Por cantidades (R7, VG 7-11 noche; integra lo que daba
 * bases.ochoPorCantidades): primero lo que decide las cajas, las CANTIDADES
 * por serie (su caja, su cuota en la cohorte y la caja de esa cuota) y la
 * CUOTA del foco frente a su padre (cuota()); después, como información, los
 * RECUENTOS de bases.MEDIDAS (valor del foco y lo fundido, sin caja; la celda
 * enseña los de RECUENTOS). `posiciones` es la décupla de la cohorte. Sin
 * puesto ni puntuación.
 * Devuelve { alcance, foco, estado, motivo?, escrita, base (id o null),
 * registro, seccion, n, frescura, cantidades: [{ clave, etiqueta, foco, caja,
 * cuota, cajaCuota, debajo, enCaja, encima, n, suma, minimo, maximo, media,
 * cortes, cajas }], cuota (la de cuota(), o null), recuentos: [{ clave,
 * etiqueta, foco, n, suma, minimo, maximo, media, recuento: true }],
 * posiciones, incluido, cambiadas }.
 */
export function ocho(eje, foco, { alcance = 'hermanos', epoca = EPOCA_0 } = {}) {
  if (!COHORTES.includes(alcance)) throw new Error('cohorte desconocida: ' + alcance + ' (' + COHORTES.join(', ') + ')');
  const e = epocaDe(epoca);
  const s = situar(eje, foco, { alcance, epoca: e, respaldo: true });
  if (s.estado !== 'RESUELTO') {
    return {
      alcance, foco, estado: s.estado, motivo: s.motivo, escrita: false, base: null, registro: s.registro, seccion: s.seccion ?? null, n: 0, frescura: null,
      cantidades: [], cuota: null, recuentos: [], posiciones: [], incluido: null, cambiadas: [],
    };
  }
  return {
    alcance,
    foco,
    estado: 'RESUELTO',
    escrita: s.escrita,
    base: s.escrita ? s.base : null,
    registro: s.registro,
    seccion: s.seccion,
    n: s.n,
    frescura: s.frescura,
    cantidades: Object.keys(s.tokens).sort().map((clave) => cantidad(clave, s.tokens[clave])),
    cuota: cuota(eje, foco, { epoca: e, lectura: alcance === 'hermanos' ? s : undefined }),
    recuentos: MEDIDAS.map(({ clave, etiqueta }) => {
      const x = s.medidas[clave];
      return { clave, etiqueta, foco: x.foco, n: x.n, suma: x.suma, minimo: x.minimo, maximo: x.maximo, media: x.media, recuento: true };
    }),
    posiciones: s.posiciones.map((p) => ({ ...p, delFoco: { ...p.delFoco } })),
    incluido: s.escrita ? s.incluido : s.comparables.some((f) => f.id === foco),
    cambiadas: s.escrita ? [...s.cambiadas] : [],
  };
}

/** Los recuentos que enseña la celda (RECUENTOS), con su nombre corto y el valor del foco, de una lectura de ocho(). */
export function recuentosDeCelda(o) {
  return RECUENTOS.map(({ clave, etiqueta }) => ({ clave, etiqueta, valor: o.recuentos.find((r) => r.clave === clave)?.foco }));
}

/** Una cuota como porcentaje en español, con coma y como mucho un decimal («33,3 %»); «—» si no hay. */
export function textoCuota(c) {
  if (c === null || c === undefined || !Number.isFinite(c)) return '—';
  return String(Math.round(c * 1000) / 10).replace('.', ',') + ' %';
}

/** La cuota de una serie del foco frente a su padre, en una lectura de ocho(): un número o null. */
export function cuotaDe(o, clave) {
  return o.cuota?.series.find((x) => x.clave === clave)?.cuota ?? null;
}

/**
 * Texto de la celda 8 (render sobrio): de dónde se lee y su frescura; luego,
 * una línea por serie con la cantidad del foco, su caja, su cuota frente al
 * padre y, fuera de hermanos, su cuota en la cohorte; y al final, aparte,
 * los recuentos marcados como información.
 */
export function textoOcho(o) {
  if (o.estado !== 'RESUELTO') return '8 · ' + o.alcance + ' · ' + o.motivo;
  const frescura = o.escrita ? (o.frescura.sinNovedades ? 'sin novedades' : 'con novedades') : o.frescura;
  const donde = o.escrita ? 'base ' + o.base.slice(0, 8) + ' (' + frescura + ')' : frescura + ' (respaldo al vuelo)';
  const filas = o.cantidades.length
    ? o.cantidades.map((m) => m.clave + ' ' + m.foco + ': caja ' + m.caja + ' · cuota frente al padre ' + textoCuota(cuotaDe(o, m.clave))
      + (o.alcance === 'hermanos' ? '' : ' · en la cohorte ' + textoCuota(m.cuota)))
    : ['ninguna serie movida en la cohorte'];
  const recuentos = 'recuentos (información): ' + recuentosDeCelda(o).map((r) => r.etiqueta + ' ' + r.valor).join(' · ');
  return ['8 · ' + o.alcance + ' · ' + donde + ' · n ' + o.n, ...filas, recuentos].join('\n');
}

function breve(c) {
  if (c === undefined) return '—';
  if (esLista(c)) return '{' + c.length + ' en lista}'; // bajo la raíz, por hojas
  if (Array.isArray(c)) return '[' + c.length + ']';
  if (esReferencia(c)) return '→' + c.ref.slice(0, 8);
  return String(c);
}

/** Render sobrio: tres filas de tres celdas, luego el eje y las medidas del 8 (o que se piden bajo demanda); si hay corte, su aviso arriba y abajo. */
export function sobrio(m) {
  const celda = (i) => {
    const c = m.celdas[i];
    const texto = i === 5 ? m.foco.slice(0, 8) + (m.terminal === undefined ? '' : ' ' + breve(m.terminal)) : breve(c.contenido);
    return (i + ' ' + c.significado).padEnd(17) + texto.padEnd(14) + (c.escritos ? '↳' + c.escritos : '').padEnd(4);
  };
  const filas = MATRIZ.map((fila) => fila.map(celda).join(' | '));
  const eje = 'eje: ' + [...m.hilo].reverse().map((e) => e.id.slice(0, 8)).join(' ← ') + ' ← [' + m.foco.slice(0, 8) + '] → ' + m.hijos.map((e) => e.id.slice(0, 8)).join(' · ');
  const med = m.medidas
    ? 'medidas del 8: hilo ' + m.medidas.profundidadHilo + ' · escritos ' + m.medidas.escritos + ' · movimientos ' + m.medidas.movimientos + ' · identidades ' + m.medidas.identidades + ' · posiciones ' + m.medidas.posiciones
    : 'medidas del 8: bajo demanda (la celda 8, o mapa con { medidas: true })';
  const avisos = (m.avisos ?? []).map((a) => 'aviso: ' + a); // el corte, arriba y abajo
  return [...avisos, ...filas, eje, med, ...avisos].join('\n');
}

export const RENDERS = Object.freeze({ sobrio });

export function render(m, nombre = 'sobrio') {
  const r = RENDERS[nombre];
  if (!r) throw new Error('render no disponible: ' + nombre);
  return r(m);
}
