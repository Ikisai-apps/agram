// El sello de tiempo (el tercer reloj, X.6.8.2): un adaptador con la interfaz del §3 del contrato AGRAM ↔ exterior,
//
//   sello.sellar(ids)               → { lote, pendiente: true, ids }
//   sello.prueba(id)                → { altura, hash, instante, lote, prueba } | { pendiente: true, lote } | null
//   sello.verificar(evento, prueba) → { ok, motivo, altura?, hash?, instante? }
//
// todo asíncrono. Lo que se sella son SOLO ids (SHA-256 del cuerpo canónico): el evento no sale de aquí. El bloque
// dice que el lote existía como muy tarde en su instante (una cota superior: no la hora del evento).
//
// Hay dos vías, con la misma forma, y este módulo no conoce ninguna simulación (TOK-74: fuera quedan AARPIA, Nostr y
// Bitcoin; ningún import de src/ las nombra):
//   · inyectada: `selloCon(sellador)` envuelve un objeto con sellar/prueba/verificar (y, si lo tiene, minar) que da
//     quien llama. La SIMULACIÓN de StateArk (servidor/sim/stateark/) entra así, desde servidor/sim/sello-agram.js
//     (`selloSimulado`, solo en Node), que es quien la importa; se sustituirá por StateArk real.
//   · HTTP: un servicio con POST /sellar, GET /prueba/:id (202 si pendiente, 404 si nunca se selló), POST /verificar
//     (la forma de servidor/sim/stateark/servidor.js, que sirve también de servicio de prueba). Es la del navegador: su
//     dirección es el ajuste «seal url» de «exterior settings» (ver `destino`); sin ella, en el navegador, nada se sella.
//
// El resultado se escribe en el eje con `eje.marcarSello(id, prueba)` (src/eje.js): una vista del libro, fuera del
// cuerpo firmado y del id (src/sincronia.js lo hace tras asentar eventos nuevos). Este módulo no toca ningún evento.
// Con el sello va la PRUEBA COPIADA (`decuplaDeSello`, la décupla del SIP 0): la comprueba la regla «sealed» de la
// época (X.6.8.5; encargo «verificado-regla», #67), sin salir del libro; `verificar` de aquí ya no decide nada.

import { AJUSTES, exterior } from './exterior.js';

/** La clave de la configuración («exterior settings», docs/CONTRATO.md §16.2 bis) que dice dónde está el servicio de sello. */
export const CONFIGURACION = Object.freeze({ url: AJUSTES.sello });

/** La dirección del servicio de sello de `yo` («seal url» de «exterior settings»; http o https, sin la barra final), o null si no la ha dicho o no es una url. */
export function destino(eje, yo, opciones = {}) {
  return exterior(eje, yo, opciones).sello;
}

/**
 * El sello por un sellador que se inyecta (la simulación, una prueba, otro servicio): un objeto con `sellar(ids)`,
 * `prueba(id)` y `verificar(evento, prueba)`, síncronos o asíncronos, y, si lo tiene, `minar()` (solo una simulación).
 * El adaptador lo da todo asíncrono; `via` es la del sellador o «inyectado».
 */
export function selloCon(sellador) {
  if (!sellador || ['sellar', 'prueba', 'verificar'].some((k) => typeof sellador[k] !== 'function')) throw new TypeError('sello: el sellador ha de tener sellar, prueba y verificar');
  return {
    via: typeof sellador.via === 'string' ? sellador.via : 'inyectado',
    sellar: async (ids) => sellador.sellar(ids),
    prueba: async (id) => sellador.prueba(id),
    verificar: async (evento, prueba) => sellador.verificar(evento, prueba),
    ...(typeof sellador.minar === 'function' ? { minar: async () => sellador.minar() } : {}),
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
 * El adaptador que toca: con `url`, el servicio HTTP; sin ella, el sellador inyectado (`sellador`, ver selloCon); sin
 * ninguno de los dos, null: nada se sella.
 */
export function crearSello({ url, fetch, sellador } = {}) {
  if (typeof url === 'string' && url.trim()) return selloHttp({ url: url.trim(), fetch });
  return sellador ? selloCon(sellador) : null;
}

/**
 * El adaptador de la configuración de `yo`: el servicio HTTP de su «seal url» («exterior settings») si lo ha dicho; si
 * no, el sellador inyectado (`opciones.sellador`); si no, null (la carta, en el navegador, no sella sin dirección).
 */
export function deConfiguracion(eje, yo, { fetch, sellador, ...opciones } = {}) {
  const url = destino(eje, yo, opciones);
  if (url) return selloHttp({ url, fetch });
  return sellador ? selloCon(sellador) : null;
}

/** Un texto hex en minúsculas de la longitud dada (en caracteres), o null. */
const hexO = (x, n) => (typeof x === 'string' && new RegExp('^[0-9a-f]{' + n + '}$').test(x) ? x : null);

/**
 * Los pasos OpenTimestamps de un camino de Merkle de Bitcoin (por nivel: «append» o «prepend» del hermano y dos
 * «sha256», los que da la simulación de StateArk) como dos listas hermanas, lados («d» si se añade detrás: el hermano va a
 * la derecha; «i» si se antepone) y hermanos. null si los pasos no son eso.
 */
function caminoBitcoin(pasos) {
  const lados = [];
  const hermanos = [];
  for (let k = 0; k < pasos.length; k += 3) {
    const [op, x] = pasos[k] ?? [];
    if (!(op === 'append' || op === 'prepend') || !hexO(x, 64) || pasos[k + 1]?.[0] !== 'sha256' || pasos[k + 2]?.[0] !== 'sha256') return null;
    lados.push(op === 'append' ? 'd' : 'i');
    hermanos.push(x);
  }
  return { lados, hermanos };
}

/**
 * La prueba de un sello (la de `prueba(id)`: { altura, hash, instante, lote, prueba: { camino, pasos, via, cabecera,
 * observador: { clave, firma, altura_le } } }) como la décupla BTML del sello de tiempo del SIP 0 (b052690: sin huecos,
 * sin relleno y sin tuplas, VG 12-11 y 13-11), la que va copiada en X.6.8.2 del registro sellado y lee la regla «sealed»
 * (docs/CONTRATO.md §4.4): 0 ["sello de tiempo", "SIP 0"], 1 altura, 2 hash (orden interno: el doble SHA-256 de la
 * cabecera), 3 raíz del lote, 4 el id (la hoja), 5 instante, 6 vía, 7 lo observado [cabecera (80 bytes hex), firma del
 * observador, altura en 4 bytes LE, su clave y, si los hay, los lados y los hermanos del camino «bitcoin» del lote a la
 * raíz de Merkle de la cabecera], 8 los lados y 9 los hermanos del camino «sip» del id a la raíz del lote, si lo hay. Lo
 * opcional va al final; sin «-». Un sello sin cabecera, firma, altura LE o clave del observador (el de antes de H9) no
 * lleva 7 (ni 8 y 9, que no pueden ir sin el 7): la regla dice PENDIENTE, nunca verdadero. Es la forma de
 * `selloComoDecupla` de la simulación de StateArk (9be12c3; test/verificado-regla.test.js lo comprueba) con una
 * diferencia: sin camino «bitcoin», las cuatro partes de lo observado van cada una en una lista de uno, para que el 7 sea
 * una décupla (una lista de hojas, como la de la simulación, es en BTML una lista: sus elementos son ocupantes del 7, no
 * posiciones 7.0…7.3). Escrita aquí porque src/ no importa ninguna simulación (TOK-74); dónde va cada cosa lo dice
 * POSICIONES_DEL_SELLO. null si la prueba no tiene altura, hash, instante y lote.
 */
export function decuplaDeSello(prueba, id) {
  if (!prueba || prueba.pendiente || !Number.isSafeInteger(prueba.altura) || !/^[0-9a-f]{64}$/.test(prueba.hash ?? '') || typeof prueba.instante !== 'string' || !/^[0-9a-f]{64}$/.test(prueba.lote ?? '') || !/^[0-9a-f]{64}$/.test(id ?? '')) return null;
  const p = prueba.prueba && typeof prueba.prueba === 'object' ? prueba.prueba : {};
  const camino = (Array.isArray(p.camino) ? p.camino : []).filter((x) => Array.isArray(x) && (x[0] === 'i' || x[0] === 'd') && hexO(x[1], 64));
  const o = p.observador && typeof p.observador === 'object' ? p.observador : {};
  const d = [['sello de tiempo', 'SIP 0'], prueba.altura, prueba.hash, prueba.lote, id, prueba.instante, typeof p.via === 'string' && p.via ? p.via : 'desconocida'];
  const observado = [hexO(p.cabecera, 160), hexO(o.firma, 128), hexO(o.altura_le, 8), hexO(o.clave, 64)];
  if (!observado.every(Boolean)) return d;
  const bitcoin = Array.isArray(p.pasos) && p.pasos.length ? caminoBitcoin(p.pasos) : null;
  d.push(bitcoin ? [...observado, bitcoin.lados, bitcoin.hermanos] : observado.map((x) => [x]));
  if (camino.length) d.push(camino.map(([l]) => l), camino.map(([, h]) => h));
  return d;
}

/**
 * EL MAPA DE POSICIONES DEL SELLO (encargo «verificado-regla»): dónde va cada parte de la prueba copiada en la décupla
 * del sello de tiempo del SIP 0 (b052690, la forma de `selloComoDecupla` de la simulación de StateArk 9be12c3). Es el
 * ÚNICO sitio que hay que tocar cuando StateArk cambie la forma: se cambia aquí, se cambia `decuplaDeSello` para que
 * construya esa forma y se reescribe la fórmula de la regla «sealed» con `formulaDeSellado()` (y `npm run epocas`):
 *   node -e "import('./src/sello.js').then(m => console.log(m.formulaDeSellado()))"
 * (test/verificado-regla.test.js comprueba que datos/epocas/reglas/sealed.json lleva exactamente esa fórmula y que
 * `decuplaDeSello` pone cada parte donde dice el mapa). `marca` es lo que el 0 del sello lleva para reconocerlo.
 */
export const POSICIONES_DEL_SELLO = Object.freeze({
  marca: 'sello de tiempo', clase: '0', altura: '1', hash: '2', lote: '3', id: '4', instante: '5', via: '6',
  cabecera: '7.0', firma: '7.1', alturaLe: '7.2', clave: '7.3', ladosBitcoin: '7.4', hermanosBitcoin: '7.5',
  lados: '8', hermanos: '9',
});

/** La etiqueta del hash que firma el observador de cabeceras (SIP 0, H9): cabecera ‖ altura LE. */
export const ETIQUETA_DEL_OBSERVADOR = 'StateArk/Observador/Cabecera/v1';

/**
 * La fórmula del 2 de la regla «sealed» (X.6.8.5) escrita con el mapa de posiciones: it = el registro; S el sello copiado
 * en lo que el núcleo lee de su 6.8.2, C su cabecera. Comprueba la hoja (el id del sello es el del registro), que el id
 * con el camino «sip» (ninguno en un lote de un solo id) da la raíz del lote, que la raíz del lote con el camino
 * «bitcoin» (ninguno si el bloque tiene un solo compromiso) da la raíz de Merkle de la cabecera, el hash y la prueba de
 * trabajo de la cabecera, la altura firmada, la firma del observador y que su clave esté en before.8.6 (las «observer
 * keys» de la cuenta raíz). Lo que falta (la cabecera, la firma, la clave) deja PENDIENTE: bytes de nada.
 */
export function formulaDeSellado(p = POSICIONES_DEL_SELLO) {
  const S = '(first ((first it.6).8.2 where "' + p.marca + '" in it2.' + p.clase + '))';
  const en = (k) => S + '.' + p[k];
  const C = '(first cabecera(bytes(first ' + en('cabecera') + ')))';
  return '=bytes(first ' + en('id') + ') = bytes(first it.5)'
    + ' and hex(merkle(bytes(first it.5), ' + en('lados') + ', ' + en('hermanos') + ', "sip")) = first ' + en('lote')
    + ' and merkle(bytes(first ' + en('lote') + '), ' + en('ladosBitcoin') + ', ' + en('hermanosBitcoin') + ', "bitcoin") = first ' + C + '.3'
    + ' and hex(first ' + C + '.7) = first ' + en('hash')
    + ' and below(reverse(first ' + C + '.7), first ' + C + '.8)'
    + ' and le(bytes(first ' + en('alturaLe') + ')) = first ' + en('altura')
    + ' and signed(bytes(first ' + en('firma') + '), hash(cat(bytes(first ' + en('cabecera') + '), bytes(first ' + en('alturaLe') + ')), "' + ETIQUETA_DEL_OBSERVADOR + '"), bytes(first ' + en('clave') + '))'
    + ' and first ' + en('clave') + ' in before.8.6';
}
