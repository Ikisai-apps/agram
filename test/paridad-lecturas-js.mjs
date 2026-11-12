// Las lecturas que estaban en JavaScript y cayeron a BQL (VG 12-11, estudio BQL-transacciones, encargo bql-lectura),
// copiadas tal cual del núcleo de antes (src/contrato.js en `beta`, 3cfe6ef) para la red de equivalencia de
// test/lecturas.test.js: cada lectura BQL se compara con su JavaScript de antes en los mismos libros. No es código del
// núcleo: solo lo usan las pruebas.

import { esInstante, msUTC, msDeGuardado } from '../src/instante.js';
import { claveToken } from '../src/tokens.js';
import { EPOCA_0_BTML } from '../src/epocas.js';

const raiz = () => EPOCA_0_BTML.registro;
const relojDe = (eje, t) => t ?? (Number.isFinite(eje?.tMaximo?.()) ? new Date(eje.tMaximo()).toISOString() : null);
/** Lo que no contaba como cantidad de un nodo en el 1 (la asignación del día, el T informativo y la obtención de P). */
const SIN_CANTIDAD = new Set(['asignacion', 'informativo', 'obtencion']);

function porInstante(lista, tDe) {
  const ms = (x) => { const v = msDeGuardado(tDe(x)); return Number.isNaN(v) ? Infinity : v; };
  return lista.map((x, i) => ({ x, i, ms: ms(x) })).sort((a, b) => a.ms - b.ms || a.i - b.i).map((e) => e.x);
}

/** contrato.diario de antes: los ids del subárbol por llegada (o por instante) y los asientos de cada uno. */
export function diarioJS(eje, X, { instante = false, t } = {}) {
  const ev = eje.obtener(X);
  if (!ev) return [];
  const vistos = new Set([ev.id]);
  const frente = [ev.id];
  while (frente.length) {
    const id = frente.shift();
    for (const h of eje.sobre(id)) if (!vistos.has(h.id)) { vistos.add(h.id); frente.push(h.id); }
  }
  let ids = eje.orden.filter((id) => vistos.has(id));
  if (instante) ids = porInstante(ids, (id) => eje.obtener(id)?.t);
  const asientosDe = (e) => (e.sobre ? eje.libro.asientos({ registro: e.sobre }) : eje.libro.asientos()).filter((a) => a.tx?.id === e.id)
    .map(({ primitiva, serie, de, a, cantidad, salida, clase, etiqueta }) => ({ primitiva, serie, de, a, cantidad, ...(salida !== undefined && salida !== null ? { salida } : {}), ...(clase ? { clase } : {}), ...(etiqueta !== undefined && etiqueta !== null ? { etiqueta } : {}) }));
  return ids.map((id) => { const e = eje.obtener(id); return { id, t: e.t, autor: e.autor, movimientos: asientosDe(e), estado: estadoJS(eje, id, t) }; });
}

/** contrato.estadoDeEntrada de antes. */
export function estadoJS(eje, id, t) {
  const ev = eje.obtener(id);
  if (!ev || !Array.isArray(ev.movimientos)) return null;
  const futuro = raiz()[1][3][1][8][0][0];
  const ahora = msUTC(relojDe(eje, t) ?? '');
  const serieDe = (m) => { try { return claveToken(m); } catch { return null; } };
  for (const m of ev.movimientos) {
    if (!m || typeof m !== 'object') continue;
    // VG 12-11 (#64 c): el anuncio de T con fecha (lo que escribe «declare future T») está previsto como el T futuro de antes.
    if (m.token === 'T' && (m.escala === futuro || m.estado === 'anunciado') && esInstante(m.refiere)) return { tipo: 'previsto', fecha: m.refiere, cantidad: m.cantidad };
    if (m.estado === 'bloqueo' && esInstante(m.salida)) {
      const serie = serieDe(m);
      const sigue = serie !== null && eje.bloqueado(m.de, serie, m.salida) > 0;
      return { tipo: sigue ? 'bloqueado' : 'liberado', fecha: m.salida, serie, cantidad: m.cantidad };
    }
    if (m.token === 'E' && m.de === null && esInstante(m.caduca)) return { tipo: msUTC(m.caduca) <= ahora ? 'caducado' : 'caduca', fecha: m.caduca, serie: serieDe(m), cantidad: m.cantidad };
    if (m.token === 'E' && m.a === null && m.de !== null && m.de === m.emisor) return { tipo: 'caducado', fecha: ev.t, serie: serieDe(m), cantidad: m.cantidad };
  }
  return null;
}

/** contrato.escalaDeFecha de antes («when scale»): el dígito de la escala del calendario a esa distancia del reloj. */
export function escalaJS(eje, fecha, t) {
  const ms = msUTC(typeof fecha === 'string' ? fecha : '');
  const ahora = msUTC(relojDe(eje, t) ?? '');
  if (!Number.isFinite(ms) || !Number.isFinite(ahora)) return null;
  const r = raiz();
  const segundos = new Map(r[7][0].map((f) => [f[0][0], f[1][0]]));
  const escalas = r[1][3][1].map((f, escala) => ({ escala, nombre: f[0][0] })).filter((e) => segundos.has(e.nombre)).map((e) => ({ ...e, segundos: segundos.get(e.nombre) })).sort((a, b) => a.segundos - b.segundos);
  const distancia = Math.abs(ms - ahora) / 1000;
  return (escalas.find((e) => distancia < e.segundos) ?? escalas[escalas.length - 1]).escala;
}

/** «when scale» de antes: la escala de la fecha del estado de su futuro, o null. */
export function cuandoJS(eje, id, t) {
  const e = estadoJS(eje, id, t);
  return e?.fecha ? escalaJS(eje, e.fecha, t) : null;
}

/** «js flujo» de antes (el 1): los registros del subárbol que mueven algo con alguien que no es `me`. */
export function flujoJS(eje, nodo, me) {
  return diarioJS(eje, nodo).filter((e) => e.movimientos.some((m) => !SIN_CANTIDAD.has(m.clase) && ((m.de && m.de !== me) || (m.a && m.a !== me)))).map((e) => e.id);
}

/**
 * El 1 con lo decidido por VG el 12-11 (#44), en JavaScript, para la paridad: también lo que el dueño se mueve a sí
 * mismo (acuñar es crear), sin la asignación, el T informativo, la obtención ni el T que el dueño quema al escribir.
 */
export function flujoPropioJS(eje, nodo, me) {
  return diarioJS(eje, nodo).filter((e) => e.movimientos.some((m) => !SIN_CANTIDAD.has(m.clase) && !(m.primitiva === 'quemar' && m.serie.startsWith('T:') && m.de === me))).map((e) => e.id);
}

/** «js futuro» de antes (el 7): lo del subárbol con estado del futuro, por su fecha (a igual fecha, por llegada). */
export function futuroJS(eje, nodo, t) {
  return porInstante(diarioJS(eje, nodo, { t }).filter((e) => e.estado?.fecha), (e) => e.estado.fecha).map((e) => e.id);
}
