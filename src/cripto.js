// Primitivas PURAS de verificación (Core AGRAM, 12-11, #67; docs/BQLM.md §12): lo que el BQL mínimo necesita para
// comprobar, sin salir del libro, las pruebas que un registro trae copiadas (un sello de tiempo, un recibo de pago, un
// candado por hash, una firma). Todo síncrono, sin efectos ni entrada/salida, y SOLO de verificación: aquí no hay firmar
// ni claves privadas (la única llamada a la librería vendorizada es `schnorr.verify`).
//
//   sha256(u8)                    SHA-256 (FIPS 180-4) de unos bytes. Es código propio y no una librería: el SHA-256
//                                 de src/vendor/noble-secp256k1.js va dentro y no se exporta (solo `schnorr`), y Web
//                                 Crypto es asíncrono. test/bqlm-cripto.test.js lo cruza con node:crypto y con el hash
//                                 etiquetado de noble (`schnorr.utils.taggedHash`).
//   hashEtiquetado(tag, u8)       el de BIP-340: sha256(sha256(tag) ‖ sha256(tag) ‖ m)
//   leerCabecera(u8)              una cabecera de bloque de Bitcoin (80 bytes)
//   leerTx(u8)                    una transacción cruda de Bitcoin, con o sin testigo
//   raizMerkle(hoja, pasos, e)    la raíz de un camino de Merkle, esquema "bitcoin" o "sip" (SIP-0.md, normativo)
//   aplicarOts(u8, pasos)         los pasos OpenTimestamps prepend / append / sha256
//   verificarBip340(f, m, k)      BIP-340 (schnorr.verify)
//
// Lanzan Error con un motivo en español; quien las llama (src/bqlm.js) lo convierte en una Parada ERROR.

import { schnorr } from './vendor/noble-secp256k1.js';

// ---------- SHA-256 ----------

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
const H0 = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];

/** SHA-256 de unos bytes (Uint8Array) → 32 bytes. */
export function sha256(m) {
  const largo = m.length;
  const total = (((largo + 9 + 63) >> 6) << 6);
  const x = new Uint8Array(total);
  x.set(m);
  x[largo] = 0x80;
  const bits = largo * 8;
  const dv = new DataView(x.buffer);
  dv.setUint32(total - 8, Math.floor(bits / 0x100000000));
  dv.setUint32(total - 4, bits >>> 0);
  const h = H0.slice();
  const w = new Uint32Array(64);
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + 4 * i);
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15], b = w[i - 2];
      const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
      const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
  }
  const out = new Uint8Array(32);
  const ov = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) ov.setUint32(4 * i, h[i]);
  return out;
}

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
