// Primitivas PURAS de verificación (Core AGRAM, 12-11, #67; docs/BQLM.md §12): lo que el BQL mínimo necesita para
// comprobar, sin salir del libro, las pruebas que un registro trae copiadas (un sello de tiempo, un recibo de pago, un
// candado por hash, una firma). Todo síncrono, sin efectos ni entrada/salida, y SOLO de verificación: aquí no hay firmar
// ni claves privadas (de la librería vendorizada solo se usan `schnorr.verify` y, para el TapTweak, la aritmética
// pública de la curva).
//
//   sha256(u8)                    SHA-256 de unos bytes: el de noble, exportado desde src/vendor/noble-secp256k1.js
//                                 (la única librería admitida); test/bqlm-cripto.test.js lo cruza con node:crypto.
//   hashEtiquetado(tag, u8)       el de BIP-340: sha256(sha256(tag) ‖ sha256(tag) ‖ m)
//   leerCabecera(u8)              una cabecera de bloque de Bitcoin (80 bytes)
//   leerTx(u8)                    una transacción cruda de Bitcoin, con o sin testigo
//   raizMerkle(hoja, pasos, e)    la raíz de un camino de Merkle, esquema "bitcoin" o "sip" (SIP-0.md, normativo)
//   aplicarOts(u8, pasos)         los pasos OpenTimestamps prepend / append / sha256
//   verificarBip340(f, m, k)      BIP-340 (schnorr.verify)
//   tapleaf(script)               el hash TapLeaf de BIP-341 de una hoja Tapscript (versión 0xc0)
//   taptweak(interna, hoja, h)    la clave de salida x-only de BIP-341: TapBranch ordenado y TapTweak (H20, 13-11)
//
// Lanzan Error con un motivo en español; quien las llama (src/bqlm.js) lo convierte en una Parada ERROR. La librería
// vendorizada solo se usa para verificar: `schnorr.verify`, y para el TapTweak la aritmética pública de la curva que
// `schnorr` ya expone (`schnorr.utils.lift_x`, `schnorr.Point`: sumar un punto y multiplicar el generador), sin claves
// privadas.

import { schnorr, sha256 as nobleSha256 } from './vendor/noble-secp256k1.js';

// ---------- SHA-256 ----------


/** SHA-256 de unos bytes (Uint8Array) → 32 bytes: el de noble (la única librería admitida, vendida en src/vendor). */
export const sha256 = (m) => nobleSha256(m);

/** Doble SHA-256 (el de Bitcoin). */
export const sha256d = (m) => sha256(sha256(m));

/** Concatena bytes. */
export function concatenar(...partes) {
  const out = new Uint8Array(partes.reduce((n, p) => n + p.length, 0));
  let k = 0;
  for (const p of partes) { out.set(p, k); k += p.length; }
  return out;
}

/** Hash etiquetado de BIP-340: sha256(sha256(etiqueta) ‖ sha256(etiqueta) ‖ m), la etiqueta en UTF-8. */
export function hashEtiquetado(etiqueta, m) {
  const t = sha256(new TextEncoder().encode(etiqueta));
  return sha256(concatenar(t, t, m));
}

// ---------- hex ----------

const RE_HEX = /^(?:[0-9a-fA-F]{2})*$/;

/** Texto hex (longitud par, mayúsculas o minúsculas) → bytes; null si no es hex. */
export function deHex(texto) {
  if (typeof texto !== 'string' || !RE_HEX.test(texto)) return null;
  const out = new Uint8Array(texto.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(texto.slice(2 * i, 2 * i + 2), 16);
  return out;
}

/** Bytes → texto hex en minúsculas. */
export function aHex(u8) {
  let s = '';
  for (const b of u8) s += (b < 16 ? '0' : '') + b.toString(16);
  return s;
}

/** Iguales byte a byte. */
export function igualesBytes(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** a < b como enteros sin signo big-endian (el primer byte es el más significativo); igual longitud. */
export function menor(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
}

/** Entero sin signo little-endian de 1 a 8 bytes → número (error si pasa de Number.MAX_SAFE_INTEGER). */
export function enteroLe(u8) {
  if (u8.length < 1 || u8.length > 8) throw new Error('le: un entero little-endian lleva de 1 a 8 bytes, no ' + u8.length);
  let n = 0n;
  for (let i = u8.length - 1; i >= 0; i--) n = (n << 8n) | BigInt(u8[i]);
  if (n > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('le: ' + n + ' no cabe en un número exacto');
  return Number(n);
}

// ---------- Bitcoin: cabecera y transacción ----------

/** El objetivo de prueba de trabajo desde los «bits» compactos: 32 bytes big-endian. */
export function objetivoDeBits(bits) {
  const exp = bits >>> 24;
  const mant = bits & 0x007fffff;
  if (bits & 0x00800000) throw new Error('cabecera: los bits dan un objetivo negativo');
  const out = new Uint8Array(32);
  const m = [(mant >>> 16) & 0xff, (mant >>> 8) & 0xff, mant & 0xff];
  // objetivo = mant · 256^(exp − 3): los tres bytes de la mantisa acaban en la posición 32 − exp + 3.
  for (let k = 0; k < 3; k++) {
    const pos = 32 - exp + k;
    if (pos >= 32) continue; // exp < 3: lo que cae a la derecha se pierde (desplazamiento)
    if (pos < 0) {
      if (m[k] !== 0) throw new Error('cabecera: los bits dan un objetivo de más de 256 bits');
      continue;
    }
    out[pos] = m[k];
  }
  return out;
}

/**
 * Una cabecera de bloque (80 bytes): { version, anterior, raiz, hora, bits, nonce, hash, objetivo }. anterior, raiz y
 * hash en el orden interno de bytes (el que se hashea; un explorador los enseña al revés); objetivo, big-endian.
 */
export function leerCabecera(u8) {
  if (u8.length !== 80) throw new Error('cabecera: una cabecera de bloque son 80 bytes, no ' + u8.length);
  const dv = new DataView(u8.buffer, u8.byteOffset, 80);
  const bits = dv.getUint32(72, true);
  return {
    version: dv.getInt32(0, true),
    anterior: u8.slice(4, 36),
    raiz: u8.slice(36, 68),
    hora: dv.getUint32(68, true),
    bits,
    nonce: dv.getUint32(76, true),
    hash: sha256d(u8),
    objetivo: objetivoDeBits(bits),
  };
}

/**
 * Una transacción cruda (con o sin testigo, BIP-144): { entradas: [{ txid, vout, script, secuencia }], salidas:
 * [{ sats, script }], testigos: [[bytes…] por entrada] (vacío sin testigo), locktime, txid, segwit }. txid en el orden
 * interno (sha256d de la serialización sin testigo). Error si sobra o falta algo.
 */
export function leerTx(u8) {
  let p = 0;
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.length);
  const falta = (n) => {
    if (p + n > u8.length) throw new Error('tx: la transacción se acaba antes de tiempo (byte ' + p + ')');
  };
  const leer = (n) => { falta(n); const b = u8.slice(p, p + n); p += n; return b; };
  const u32 = () => { falta(4); const v = dv.getUint32(p, true); p += 4; return v; };
  const u64 = () => { falta(8); const v = dv.getBigUint64(p, true); p += 8; if (v > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('tx: un importe no cabe en un número exacto'); return Number(v); };
  const varint = () => {
    falta(1);
    const b = u8[p++];
    if (b < 0xfd) return b;
    if (b === 0xfd) { falta(2); const v = dv.getUint16(p, true); p += 2; return v; }
    if (b === 0xfe) return u32();
    return u64();
  };
  // Una cuenta no puede pedir más elementos que bytes quedan (cada uno ocupa al menos uno): así un varint enorme no
  // reserva memoria.
  const cuenta = (minimo) => {
    const n = varint();
    if (n * minimo > u8.length - p) throw new Error('tx: la cuenta ' + n + ' no cabe en lo que queda');
    return n;
  };
  const version = leer(4);
  let segwit = false;
  if (u8.length > p + 1 && u8[p] === 0x00 && u8[p + 1] === 0x01) { segwit = true; p += 2; }
  const iniEntradas = p;
  const nIn = cuenta(41);
  if (nIn === 0) throw new Error('tx: sin entradas');
  const entradas = [];
  for (let i = 0; i < nIn; i++) {
    const txid = leer(32);
    const vout = u32();
    const script = leer(cuenta(1));
    const secuencia = u32();
    entradas.push({ txid, vout, script, secuencia });
  }
  const nOut = cuenta(9);
  const salidas = [];
  for (let i = 0; i < nOut; i++) {
    const sats = u64();
    const script = leer(cuenta(1));
    salidas.push({ sats, script });
  }
  const finSalidas = p;
  const testigos = [];
  if (segwit) {
    for (let i = 0; i < nIn; i++) {
      const n = cuenta(1);
      const pila = [];
      for (let k = 0; k < n; k++) pila.push(leer(cuenta(1)));
      testigos.push(pila);
    }
  }
  const locktime = u32();
  if (p !== u8.length) throw new Error('tx: sobran ' + (u8.length - p) + ' bytes tras el locktime');
  const sinTestigo = concatenar(version, u8.subarray(iniEntradas, finSalidas), u8.subarray(p - 4, p));
  return { entradas, salidas, testigos, locktime, txid: sha256d(sinTestigo), segwit };
}

// ---------- Merkle y OpenTimestamps ----------

/**
 * La raíz desde una hoja y su camino ([lado, hermano], de la hoja a la raíz; lado «i» si el hermano va a la izquierda,
 * «d» si va a la derecha). Esquemas: «sip» (SIP-0.md, normativo; servidor/sim/stateark/merkle.js): hoja =
 * SHA-256(0x00 ‖ id), nodo = SHA-256(0x01 ‖ izq ‖ der), el impar sube sin duplicarse (no añade paso); «bitcoin»: la
 * hoja es el txid (orden interno) tal cual, nodo = sha256d(izq ‖ der), el impar se duplica (el hermano es él mismo).
 */
export function raizMerkle(hoja, pasos, esquema) {
  if (esquema !== 'sip' && esquema !== 'bitcoin') throw new Error('merkle: el esquema es «bitcoin» o «sip», no «' + esquema + '»');
  if (hoja.length !== 32) throw new Error('merkle: la hoja son 32 bytes, no ' + hoja.length);
  let actual = esquema === 'sip' ? sha256(concatenar(Uint8Array.of(0x00), hoja)) : hoja;
  const nodo = esquema === 'sip' ? (i, d) => sha256(concatenar(Uint8Array.of(0x01), i, d)) : (i, d) => sha256d(concatenar(i, d));
  for (const [lado, hermano] of pasos) {
    if (hermano.length !== 32) throw new Error('merkle: cada hermano son 32 bytes, no ' + hermano.length);
    if (lado === 'i') actual = nodo(hermano, actual);
    else if (lado === 'd') actual = nodo(actual, hermano);
    else throw new Error('merkle: el lado de un paso es «i» (el hermano a la izquierda) o «d» (a la derecha), no «' + lado + '»');
  }
  return actual;
}

/** Los pasos de OpenTimestamps sobre unos bytes: [['prepend', u8] | ['append', u8] | ['sha256']] → lo que llega. */
export function aplicarOts(inicio, pasos) {
  let actual = inicio;
  for (const [op, arg] of pasos) {
    if (op === 'prepend') actual = concatenar(arg, actual);
    else if (op === 'append') actual = concatenar(actual, arg);
    else if (op === 'sha256') actual = sha256(actual);
    else throw new Error('ots: paso desconocido «' + op + '» (prepend, append o sha256)');
  }
  return actual;
}

// ---------- BIP-340 ----------

/** ¿Es `firma` (64 bytes) la firma BIP-340 de `mensaje` (32 bytes) con la clave x-only `clave` (32 bytes)? Solo verifica. */
export function verificarBip340(firma, mensaje, clave) {
  if (firma.length !== 64 || mensaje.length !== 32 || clave.length !== 32) return false;
  try {
    return schnorr.verify(firma, mensaje, clave) === true;
  } catch {
    return false;
  }
}

// ---------- Taproot (BIP-341; H20 del SIP 0, VG 13-11: el sello ancla por Taproot) ----------

/** El compact size de Bitcoin (la longitud que precede a un script): 1, 3, 5 o 9 bytes. */
function compactSize(n) {
  if (n < 0xfd) return Uint8Array.of(n);
  if (n <= 0xffff) return Uint8Array.of(0xfd, n & 0xff, n >>> 8);
  if (n <= 0xffffffff) return Uint8Array.of(0xfe, n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, n >>> 24);
  throw new Error('tapleaf: un script de más de 4 GB');
}

/** La versión de hoja de Tapscript (BIP-342). */
export const VERSION_TAPSCRIPT = 0xc0;

/** El hash TapLeaf de BIP-341 de un script: hashEtiquetado("TapLeaf", 0xc0 ‖ compact_size(largo) ‖ script) → 32 bytes. */
export function tapleaf(script) {
  return hashEtiquetado('TapLeaf', concatenar(Uint8Array.of(VERSION_TAPSCRIPT), compactSize(script.length), script));
}

/** TapBranch de BIP-341: hashEtiquetado("TapBranch", menor ‖ mayor), los dos hijos en orden lexicográfico. */
export function tapbranch(a, b) {
  if (a.length !== 32 || b.length !== 32) throw new Error('taptweak: cada nodo del árbol Taproot son 32 bytes, no ' + (a.length !== 32 ? a.length : b.length));
  return hashEtiquetado('TapBranch', menor(b, a) ? concatenar(b, a) : concatenar(a, b));
}

const entero = (u8) => u8.reduce((n, b) => (n << 8n) | BigInt(b), 0n);
const N_SECP = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;

/**
 * La clave de salida x-only de una salida P2TR (BIP-341, taproot_tweak_pubkey): la raíz del árbol desde la hoja y sus
 * hermanos (TapBranch ordena sus hijos: el camino son solo los hermanos, de la hoja a la raíz; sin hermanos, la hoja es
 * la raíz), t = hashEtiquetado("TapTweak", interna ‖ raíz) y Q = lift_x(interna) + t·G; da la x de Q (32 bytes). Error si
 * la interna no es la x de un punto de la curva, si t no es un escalar (t ≥ n) o si Q es el infinito. Solo aritmética
 * pública, sin secretos: la de `schnorr` de noble, la librería vendorizada.
 */
export function taptweak(interna, hoja, hermanos = []) {
  if (interna.length !== 32) throw new Error('taptweak: la clave interna es x-only, 32 bytes, no ' + interna.length);
  if (hoja.length !== 32) throw new Error('taptweak: la hoja es un hash TapLeaf, 32 bytes, no ' + hoja.length);
  let raiz = hoja;
  for (const h of hermanos) raiz = tapbranch(raiz, h);
  const t = entero(hashEtiquetado('TapTweak', concatenar(interna, raiz)));
  if (t >= N_SECP) throw new Error('taptweak: el ajuste no es un escalar de la curva');
  let p;
  try {
    p = schnorr.utils.lift_x(entero(interna));
  } catch {
    throw new Error('taptweak: la clave interna no es la x de un punto de secp256k1');
  }
  const q = p.add(schnorr.Point.BASE.multiplyUnsafe(t));
  if (q.is0()) throw new Error('taptweak: el ajuste da el punto del infinito');
  const x = q.toAffine().x;
  return Uint8Array.from({ length: 32 }, (_, k) => Number((x >> BigInt(8 * (31 - k))) & 0xffn));
}
