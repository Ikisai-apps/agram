// El sello de tiempo (el tercer reloj, X.6.8.2): un adaptador con la interfaz del §3 del contrato AGRAM ↔ exterior,
//
//   sello.sellar(ids)               → { lote, pendiente: true, ids }
//   sello.prueba(id)                → { altura, hash, instante, lote, prueba } | { pendiente: true, lote } | null
//   sello.verificar(evento, prueba) → { ok, motivo, altura?, hash?, instante? }
//
// todo asíncrono. Lo que se sella son SOLO ids (SHA-256 del cuerpo canónico): el evento no sale de aquí. El bloque
// dice que el lote existía como muy tarde en su instante (una cota superior: no la hora del evento).
//
// Hay dos vías, con la misma forma:
//   · simulada: la SIMULACIÓN de StateArk (servidor/sim/stateark/, ver su LEEME.md), en memoria y solo en Node. Lo
//     pendiente entra en un bloque cuando alguien llama a `minar()` (solo existe aquí). Se sustituirá por StateArk real.
//   · HTTP: un servicio con POST /sellar, GET /prueba/:id (202 si pendiente, 404 si nunca se selló), POST /verificar
//     (la forma de servidor/sim/stateark/servidor.js, que sirve también de servicio de prueba). Es la del navegador: su
//     dirección es el ajuste «seal url» de «exterior settings» (ver `destino`); sin ella, en el navegador, nada se sella.
//
// El resultado se escribe en el eje con `eje.marcarSello(id, prueba)` (src/eje.js): una vista del libro, fuera del
// cuerpo firmado y del id (src/sincronia.js lo hace tras asentar eventos nuevos). Este módulo no toca ningún evento.

import { AJUSTES, exterior } from './exterior.js';

/** La clave de la configuración («exterior settings», docs/CONTRATO.md §16.2 bis) que dice dónde está el servicio de sello. */
export const CONFIGURACION = Object.freeze({ url: AJUSTES.sello });

/** La dirección del servicio de sello de `yo` («seal url» de «exterior settings»; http o https, sin la barra final), o null si no la ha dicho o no es una url. */
export function destino(eje, yo, opciones = {}) {
  return exterior(eje, yo, opciones).sello;
}

const enNode = () => typeof process !== 'undefined' && !!process.versions?.node;

/**
 * El sello por la simulación de StateArk (solo Node). Cada llamada crea un sellador propio, con su cadena: `opciones` son
 * las de `crearSellador` ({ inicio, intervalo, reloj }). Además de la interfaz, `minar()` mete lo pendiente en un
 * bloque (solo en la simulación) y `sellador` da el sellador de dentro (para guardar y restaurar la cadena).
 */
export function selloSimulado(opciones) {
  if (!enNode()) throw new Error('sello: la simulación de StateArk solo corre en Node; en el navegador, hace falta «seal url»');
  let dentro = null;
  const sim = async () => {
    dentro ??= (async () => {
      const m = await import('../servidor/sim/stateark/index.js');
      return m.crearSellador(opciones);
    })();
    return dentro;
  };
  return {
    via: 'simulado',
    sellar: async (ids) => (await sim()).sellar(ids),
    prueba: async (id) => (await sim()).prueba(id),
    verificar: async (evento, prueba) => (await sim()).verificar(evento, prueba),
    minar: async () => (await sim()).minar(),
    get sellador() {
      return sim();
    },
  };
}

/** No hubo respuesta del servicio de sello, o contestó con un error (estado HTTP y su texto). */
export class ErrorDeSello extends Error {
  constructor(mensaje, estado) {
    super(mensaje);
    this.name = 'ErrorDeSello';
    this.estado = estado;
  }
}

/**
 * El sello por un servicio HTTP en `url` (la base: …/sellar, …/prueba/:id, …/verificar cuelgan de ella). Solo salen los
 * ids: a verificar se manda el id del evento, no el evento. Lanza ErrorDeSello si no hay red o el servicio contesta mal.
 */
export function selloHttp({ url, fetch = globalThis.fetch?.bind(globalThis) } = {}) {
  if (typeof url !== 'string' || !url) throw new TypeError('sello: hace falta la url del servicio');
  if (typeof fetch !== 'function') throw new Error('sello: no hay fetch');
  const base = url.replace(/\/+$/, '');
  const pedir = async (camino, cuerpo) => {
    let r;
    try {
      r = await fetch(base + camino, cuerpo === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
    } catch (e) {
      throw new ErrorDeSello('sin red hacia el sello: ' + (e?.message ?? String(e)));
    }
    let datos = null;
    try {
      datos = await r.json();
    } catch {
      datos = null;
    }
    return { estado: r.status, ok: r.ok, datos };
  };
  const sinError = ({ estado, ok, datos }) => {
    if (!ok) throw new ErrorDeSello('sello ' + estado + ': ' + (datos?.error ?? 'sin detalle'), estado);
    return datos;
  };
  return {
    via: 'http',
    url: base,
    sellar: async (ids) => sinError(await pedir('/sellar', { ids })),
    prueba: async (id) => {
      const r = await pedir('/prueba/' + encodeURIComponent(id));
      if (r.estado === 404) return null;
      return sinError(r); // 200 la prueba; 202 { pendiente: true, lote }
    },
    verificar: async (evento, prueba) => sinError(await pedir('/verificar', { id: typeof evento === 'string' ? evento : evento?.id, prueba })),
  };
}

/**
 * El adaptador que toca: con `url`, el servicio HTTP; sin ella, la simulación si se corre en Node (`simulado: false` la
 * apaga); en el navegador sin url, null: nada se sella.
 */
export function crearSello({ url, fetch, simulado = true, ...opciones } = {}) {
  if (typeof url === 'string' && url.trim()) return selloHttp({ url: url.trim(), fetch });
  return simulado && enNode() ? selloSimulado(opciones) : null;
}

/**
 * El adaptador de la configuración de `yo` (su «seal url» de «exterior settings»): el servicio HTTP si lo ha dicho; si no,
 * null (la carta, en el navegador, no sella sin dirección; en Node, `crearSello()` da la simulación).
 */
export function deConfiguracion(eje, yo, { fetch, ...opciones } = {}) {
  const url = destino(eje, yo, opciones);
  return url ? selloHttp({ url, fetch }) : null;
}
