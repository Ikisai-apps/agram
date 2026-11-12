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
 * Los pasos de un camino de Merkle de Bitcoin (por nivel: «append» o «prepend» del hermano y dos «sha256», los que da la
 * simulación de StateArk) como dos listas hermanas, lados («d» si se añade detrás: el hermano va a la derecha; «i» si se
 * antepone) y hermanos. null si los pasos no son eso.
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
 * La prueba de un sello (la de `prueba(id)`: { altura, hash, instante, lote, prueba: { camino, via, taproot: { tx, vout,
 * interna, hermanos }, pasos, cabecera, observador: { clave, firma, altura_le } } }) como la décupla BTML del sello de
 * tiempo del SIP 0 (0a445b2: sin huecos, sin relleno y sin tuplas, VG 12-11 y 13-11; el sello ancla por Taproot, VG 13-11),
 * la que va copiada en X.6.8.2 del registro sellado y lee la regla «sealed» (docs/CONTRATO.md §4.4):
 *   0 ["sello de tiempo", "SIP 0"], 1 altura, 2 hash (orden interno: el doble SHA-256 de la cabecera), 3 raíz del lote,
 *   4 el id (la hoja), 5 instante, 6 vía («taproot»),
 *   7 lo observado, SIEMPRE una décupla: [[cabecera (80 bytes hex)], [firma del observador], [altura en 4 bytes LE],
 *     [su clave] y, si los hay, los lados y los hermanos del camino «bitcoin» de la transacción de anclaje a la raíz de
 *     Merkle de la cabecera],
 *   8 el anclaje, SIEMPRE una décupla: [[transacción de anclaje (hex, serializada como Bitcoin)], [vout], [clave interna
 *     x-only] y, si los hay, los hermanos de la hoja de compromiso del lote en el árbol Taproot],
 *   9 el camino «sip» del id a la raíz del lote, si lo hay: [lados, hermanos].
 * Cada hoja suelta de 7 y 8 va entre corchetes (la forma canónica de BTML): una décupla de solo hojas sería una lista, sin
 * posiciones 7.0, 7.1… que leer. Lo opcional, al final; sin «-». Un sello sin cabecera, firma, altura LE o clave del
 * observador no lleva 7 (ni 8 ni 9, que no pueden ir sin el 7), y uno sin la transacción, el vout o la clave interna no
 * lleva 8 (ni 9): la regla dice PENDIENTE, nunca verdadero. Es la forma de `selloComoDecupla` de la simulación de
 * StateArk (0ddd6e7; test/verificado-regla.test.js lo comprueba), escrita aquí porque src/ no importa ninguna simulación
 * (TOK-74); dónde va cada cosa lo dice POSICIONES_DEL_SELLO. null si la prueba no tiene altura, hash, instante y lote.
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
  d.push([...observado.map((x) => [x]), ...(bitcoin ? [bitcoin.lados, bitcoin.hermanos] : [])]);
  const t = p.taproot && typeof p.taproot === 'object' ? p.taproot : {};
  const tx = typeof t.tx === 'string' && t.tx.length >= 20 && /^(?:[0-9a-f]{2})+$/.test(t.tx) ? t.tx : null;
  if (!tx || !Number.isSafeInteger(t.vout) || t.vout < 0 || !hexO(t.interna, 64)) return d;
  const hermanosTaproot = (Array.isArray(t.hermanos) ? t.hermanos : []).filter((h) => hexO(h, 64));
  d.push([[tx], [t.vout], [t.interna], ...(hermanosTaproot.length ? [hermanosTaproot] : [])]);
  if (camino.length) d.push([camino.map(([l]) => l), camino.map(([, h]) => h)]);
  return d;
}

/**
 * EL MAPA DE POSICIONES DEL SELLO (encargos «verificado-regla» y «taproot»): dónde va cada parte de la prueba copiada en
 * la décupla del sello de tiempo del SIP 0 (0a445b2, la forma de `selloComoDecupla` de la simulación de StateArk 0ddd6e7).
 * Es el ÚNICO sitio que hay que tocar cuando StateArk cambie la forma: se cambia aquí, se cambia `decuplaDeSello` para que
 * construya esa forma y se reescribe la fórmula de la regla «sealed» con `formulaDeSellado()` (y `npm run epocas`):
 *   node -e "import('./src/sello.js').then(m => console.log(m.formulaDeSellado()))"
 * (test/verificado-regla.test.js comprueba que datos/epocas/reglas/sealed.json lleva exactamente esa fórmula y que
 * `decuplaDeSello` pone cada parte donde dice el mapa). `marca` es lo que el 0 del sello lleva para reconocerlo; `taproot`,
 * la vía que la fórmula exige en el 6; `compromiso`, el principio del script de la hoja de compromiso (OP_RETURN y el
 * empuje de 32 bytes: la plantilla de Script «compromiso» del SIP 0); `p2tr`, el de una salida P2TR (OP_1 y 32 bytes).
 */
export const POSICIONES_DEL_SELLO = Object.freeze({
  marca: 'sello de tiempo', taproot: 'taproot', compromiso: '6a20', p2tr: '5120',
  clase: '0', altura: '1', hash: '2', lote: '3', id: '4', instante: '5', via: '6',
  cabecera: '7.0', firma: '7.1', alturaLe: '7.2', clave: '7.3', ladosBitcoin: '7.4', hermanosBitcoin: '7.5',
  tx: '8.0', vout: '8.1', interna: '8.2', hermanosTaproot: '8.3',
  lados: '9.0', hermanos: '9.1',
});

/** La etiqueta del hash que firma el observador de cabeceras (SIP 0, H9): cabecera ‖ altura LE. */
export const ETIQUETA_DEL_OBSERVADOR = 'StateArk/Observador/Cabecera/v1';

/**
 * La fórmula del 2 de la regla «sealed» (X.6.8.5) escrita con el mapa de posiciones: it = el registro; S el sello copiado
 * en lo que el núcleo lee de su 6.8.2, T la transacción de anclaje y C la cabecera. La cadena entera, sin salir del libro:
 *   la hoja del sello es el propio registro (S.4 = it.5);
 *   la hoja de compromiso OP_RETURN <raíz del lote> (tapleaf), con la clave interna (S.8.2) y sus hermanos en el árbol
 *   Taproot (S.8.3; ninguno si el lote es el único del anclaje), da por TapTweak (taptweak) la clave de salida que paga la
 *   salida S.8.1 de la transacción S.8.0 (su script es 5120 ‖ clave);
 *   el txid de esa transacción, con el camino «bitcoin» (S.7.4, S.7.5; ninguno si es la única del bloque), da la raíz de
 *   Merkle de la cabecera S.7.0, que da el hash del sello y cumple su prueba de trabajo;
 *   la altura firmada (S.7.2) es la del sello, el observador firmó cabecera ‖ altura y su clave está en before.8.6 (las
 *   «observer keys» de la cuenta raíz);
 *   el id del registro con el camino «sip» (S.9.0, S.9.1; ninguno en un lote de un solo id) da la raíz del lote;
 *   y la vía es «taproot».
 * El orden importa: lo que lee la transacción, la interna y la cabecera va antes que lo que podría dar falso sin ellas
 * (el camino «sip», la vía), para que un sello al que le falta algo (la cabecera, la transacción, la interna, la firma o
 * la clave: bytes de nada) quede PENDIENTE y nunca falso ni verdadero.
 */
export function formulaDeSellado(p = POSICIONES_DEL_SELLO) {
  const S = '(first ((first it.6).8.2 where "' + p.marca + '" in it2.' + p.clase + '))';
  const en = (k) => S + '.' + p[k];
  const T = '(first tx(bytes(first ' + en('tx') + ')))';
  const C = '(first cabecera(bytes(first ' + en('cabecera') + ')))';
  return '=bytes(first ' + en('id') + ') = bytes(first it.5)'
    + ' and cat(bytes("' + p.p2tr + '"), taptweak(bytes(first ' + en('interna') + '), tapleaf(cat(bytes("' + p.compromiso + '"), bytes(first ' + en('lote') + '))), ' + en('hermanosTaproot') + ')) = first (nth (first ' + en('vout') + ') ' + T + '.2).1'
    + ' and merkle(first ' + T + '.5, ' + en('ladosBitcoin') + ', ' + en('hermanosBitcoin') + ', "bitcoin") = first ' + C + '.3'
    + ' and hex(first ' + C + '.7) = first ' + en('hash')
    + ' and below(reverse(first ' + C + '.7), first ' + C + '.8)'
    + ' and le(bytes(first ' + en('alturaLe') + ')) = first ' + en('altura')
    + ' and signed(bytes(first ' + en('firma') + '), hash(cat(bytes(first ' + en('cabecera') + '), bytes(first ' + en('alturaLe') + ')), "' + ETIQUETA_DEL_OBSERVADOR + '"), bytes(first ' + en('clave') + '))'
    + ' and first ' + en('clave') + ' in before.8.6'
    + ' and hex(merkle(bytes(first it.5), ' + en('lados') + ', ' + en('hermanos') + ', "sip")) = first ' + en('lote')
    + ' and "' + p.taproot + '" in ' + en('via');
}

/**
 * EL MAPA DE POSICIONES DEL RECIBO DE PAGO copiado en X.6.8.3 (encargo «taproot», Core AGRAM 13-11; eje.marcarPago): 0-4
 * la décupla del recibo único de StateArk de clase «pago» tal cual (SIP 0 0a445b2, B19; `Carril.reciboPago` de la
 * simulación 0ddd6e7): 0 ["recibo", "pago"], 1 el sujeto (el txid, orden interno), 2 las claves y 3 los valores, en
 * paralelo (destino: el script de la salida en hex; bloque: su hash, orden interno; altura; orden; universo; cuánto, como
 * «61000 sat»; no afirma…), 4 la evidencia, SIEMPRE una décupla: [[transacción cruda], [cabecera], lados, hermanos del
 * camino «bitcoin» si los hay]; y detrás lo del sobre que hace falta para la firma: 5 el emisor (clave x-only), 6 su t,
 * 7 el id del sobre (SHA-256 de canonico({ schema, emisor, t, recibo }): lo recalcula el núcleo al guardarlo) y 8 la
 * firma BIP-340 del emisor sobre ese id. La regla «paid» (X.6.8.6) se escribe con `formulaDePago()`.
 */
export const POSICIONES_DEL_PAGO = Object.freeze({
  marca: 'pago', unidad: 'sat',
  clase: '0', sujeto: '1', claves: '2', valores: '3',
  tx: '4.0', cabecera: '4.1', lados: '4.2', hermanos: '4.3',
  emisor: '5', t: '6', id: '7', firma: '8',
});

/**
 * La fórmula del 2 de la regla «paid» (X.6.8.6) con el mapa del recibo de pago: R el recibo copiado en el 6.8.3 del
 * registro, T su transacción cruda y C la cabecera de su bloque. Comprueba, sin salir del libro y sin fiarse de quien
 * pagó: la firma del emisor sobre el id del recibo; que es un recibo de pago; que la transacción es la del sujeto (su
 * txid); que su txid, con el camino «bitcoin» (ninguno si es la única del bloque), da la raíz de Merkle de la cabecera;
 * que la cabecera da el bloque que el recibo afirma y cumple su prueba de trabajo; y que una salida de la transacción
 * paga exactamente «cuánto» (en sat) al script «destino». La firma va primero: sin recibo (o sin su evidencia, como el
 * de un pago aún sin bloque) queda PENDIENTE, nunca verdadera ni falsa.
 */
export function formulaDePago(p = POSICIONES_DEL_PAGO) {
  const R = '(first (first it.6).8.3)';
  const en = (k) => R + '.' + p[k];
  const valor = (clave) => 'lookup(' + en('claves') + ', ' + en('valores') + ', "' + clave + '")';
  const T = '(first tx(bytes(first ' + en('tx') + ')))';
  const C = '(first cabecera(bytes(first ' + en('cabecera') + ')))';
  return '=signed(bytes(first ' + en('firma') + '), bytes(first ' + en('id') + '), bytes(first ' + en('emisor') + '))'
    + ' and "' + p.marca + '" in ' + en('clase')
    + ' and hex(first ' + T + '.5) in ' + en('sujeto')
    + ' and merkle(first ' + T + '.5, ' + en('lados') + ', ' + en('hermanos') + ', "bitcoin") = first ' + C + '.3'
    + ' and hex(first ' + C + '.7) = first ' + valor('bloque')
    + ' and below(reverse(first ' + C + '.7), first ' + C + '.8)'
    + ' and "' + p.unidad + '" in (first ' + valor('cuánto') + ').2'
    + ' and count (' + T + '.2 where first it2.0 = first (first ' + valor('cuánto') + ').1 and hex(first it2.1) = first ' + valor('destino') + ') >= 1';
}
