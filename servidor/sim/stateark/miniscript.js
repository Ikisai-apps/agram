// Bloqueos: BTML → Miniscript → Script (VG, 12-11, #69). SIMULADO en el sentido de que no firma ni
// difunde nada; los Script que produce son los de Bitcoin, comprobados contra rust-miniscript 12.3.7.
//
// Solo el subconjunto que el SIP necesita, en contexto Taproot (claves x-only, como AGRAM):
//   pk(K)            <K> OP_CHECKSIG
//   v:pk(K)          <K> OP_CHECKSIGVERIFY
//   sha256(H)        OP_SIZE <32> OP_EQUALVERIFY OP_SHA256 <H> OP_EQUAL
//   hash160(H)       OP_SIZE <32> OP_EQUALVERIFY OP_HASH160 <H> OP_EQUAL
//   after(n)         <n> OP_CHECKLOCKTIMEVERIFY          (altura absoluta; vencimientos en altura, H11)
//   older(n)         <n> OP_CHECKSEQUENCEVERIFY          (relativo, como la escalera BIP68 del R-VTXO)
//   and_v(v:X, Y)    X Y
//   multi_a(k, K…)   <K1> OP_CHECKSIG <K2> OP_CHECKSIGADD … <k> OP_NUMEQUAL
// y el árbol Taproot de hojas (BIP-341): TapLeaf, TapBranch y, con la curva inyectada, la clave de salida.
//
// El SIP fija la miniscript de cada forma (no la deja al optimizador de un compilador de políticas), así
// que el Script queda determinado byte a byte.

import { esId, sha256 } from './hash.js';

/** La clave interna sin camino por clave de BIP-341 (H = lift_x(SHA-256 del generador sin comprimir)). */
export const NUMS = '50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0';

const OP = Object.freeze({
  CHECKSIG: 'ac', CHECKSIGVERIFY: 'ad', CHECKSIGADD: 'ba', NUMEQUAL: '9c',
  SIZE: '82', EQUALVERIFY: '88', EQUAL: '87', SHA256: 'a8', HASH160: 'a9',
  CHECKLOCKTIMEVERIFY: 'b1', CHECKSEQUENCEVERIFY: 'b2', '0': '00',
});

const aBytes = (h) => Uint8Array.from(h.match(/../g) ?? [], (x) => parseInt(x, 16));
const aHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

export class ErrorMiniscript extends Error {}
const error = (m) => new ErrorMiniscript(m);

/** Empuja unos bytes (hasta 75: todo lo que el SIP necesita). */
function empujar(hex) {
  const n = hex.length / 2;
  if (n < 1 || n > 75) throw error(`empujar ${n} bytes no está en el subconjunto del SIP`);
  return n.toString(16).padStart(2, '0') + hex;
}

/** Un número de Script mínimo (CScriptNum): OP_0, OP_1…OP_16, o sus bytes little-endian con signo. */
export function numero(n) {
  if (!Number.isSafeInteger(n) || n < 0) throw error(`número de Script inválido: ${n}`);
  if (n === 0) return OP['0'];
  if (n <= 16) return (0x50 + n).toString(16);
  const bytes = [];
  let x = n;
  while (x > 0) { bytes.push(x & 0xff); x = Math.floor(x / 256); }
  if (bytes[bytes.length - 1] & 0x80) bytes.push(0); // el bit alto es el signo
  return empujar(aHex(bytes));
}

const clave = (k) => {
  if (!esId(k)) throw error(`no es una clave x-only (64 hex): ${k}`);
  return k;
};

// Fragmentos: cada uno da { ms, script } (la miniscript como texto y el Script en hex).
export const pk = (k) => ({ ms: `pk(${clave(k)})`, script: empujar(clave(k)) + OP.CHECKSIG });
export const vpk = (k) => ({ ms: `v:pk(${clave(k)})`, script: empujar(clave(k)) + OP.CHECKSIGVERIFY });
export const sha256Frag = (h) => {
  if (!esId(h)) throw error('sha256 necesita un hash de 32 bytes');
  return { ms: `sha256(${h})`, script: OP.SIZE + numero(32) + OP.EQUALVERIFY + OP.SHA256 + empujar(h) + OP.EQUAL };
};
export const hash160Frag = (h) => {
  if (!/^[0-9a-f]{40}$/.test(h)) throw error('hash160 necesita un hash de 20 bytes');
  return { ms: `hash160(${h})`, script: OP.SIZE + numero(32) + OP.EQUALVERIFY + OP.HASH160 + empujar(h) + OP.EQUAL };
};
export const after = (n) => {
  if (!Number.isSafeInteger(n) || n < 1 || n >= 500_000_000) throw error('after: una altura de bloque (1 … 499 999 999)');
  return { ms: `after(${n})`, script: numero(n) + OP.CHECKLOCKTIMEVERIFY };
};
export const older = (n) => {
  if (!Number.isSafeInteger(n) || n < 1 || n > 0xffff) throw error('older: un número de bloques (1 … 65535)');
  return { ms: `older(${n})`, script: numero(n) + OP.CHECKSEQUENCEVERIFY };
};
export const andV = (x, y) => {
  if (!x.ms.startsWith('v:')) throw error('and_v: el primero ha de ser una v:');
  return { ms: `and_v(${x.ms},${y.ms})`, script: x.script + y.script };
};
export const multiA = (k, claves) => {
  if (!Number.isSafeInteger(k) || k < 1 || k > claves.length) throw error('multi_a: 1 ≤ k ≤ número de claves');
  const s = claves.map((c, i) => empujar(clave(c)) + (i === 0 ? OP.CHECKSIG : OP.CHECKSIGADD)).join('');
  return { ms: `multi_a(${k},${claves.join(',')})`, script: s + numero(k) + OP.NUMEQUAL };
};

// ── Taproot (BIP-341) ──────────────────────────────────────────────────────────────────────────

async function hashEtiquetadoBytes(etiqueta, bytes) {
  const t = await sha256(new TextEncoder().encode(etiqueta));
  const tb = aBytes(t);
  const todo = new Uint8Array(64 + bytes.length);
  todo.set(tb, 0);
  todo.set(tb, 32);
  todo.set(bytes, 64);
  return sha256(todo);
}

function tamanoCompacto(n) {
  if (n < 0xfd) return n.toString(16).padStart(2, '0');
  if (n <= 0xffff) return 'fd' + aHex([n & 0xff, n >> 8]);
  throw error('script demasiado largo para el subconjunto del SIP');
}

/** TapLeaf hash de un Script de hoja (versión 0xc0, tapscript). */
export function hoja(scriptHex) {
  return hashEtiquetadoBytes('TapLeaf', aBytes('c0' + tamanoCompacto(scriptHex.length / 2) + scriptHex));
}

/** TapBranch de dos hijos: se ordenan como bytes antes de hashear. */
export function rama(a, b) {
  const [x, y] = a < b ? [a, b] : [b, a];
  return hashEtiquetadoBytes('TapBranch', aBytes(x + y));
}

/**
 * La clave de salida y el scriptPubKey (OP_1 <Q>) de tr(interna, árbol con raíz `raiz`).
 * Necesita la curva: el `schnorr` de noble-secp256k1 (el que AGRAM incluye en src/vendor).
 */
export async function salidaTaproot(interna, raiz, schnorr) {
  if (!schnorr?.Point || !schnorr?.utils?.lift_x) throw error('salidaTaproot necesita el schnorr de noble (Point, utils.lift_x)');
  const t = await hashEtiquetadoBytes('TapTweak', aBytes(interna + (raiz ?? '')));
  const { Point } = schnorr;
  const P = schnorr.utils.lift_x(BigInt('0x' + interna));
  const Q = P.add(Point.BASE.multiply(BigInt('0x' + t))).toAffine();
  const clave = Q.x.toString(16).padStart(64, '0');
  return { clave, scriptPubKey: '5120' + clave, paridad: Number(Q.y & 1n) };
}

// ── El candado del §8 ───────────────────────────────────────────────────────────────────────────

/**
 * La política del candado por hash y su transcripción fija:
 *   política   or(and(pk(cobra),sha256(H)),and(pk(reembolso),after(vence)))
 *   descriptor tr(NUMS,{and_v(v:pk(cobra),sha256(H)),and_v(v:pk(reembolso),after(vence))})
 * Dos hojas Taproot y la clave interna NUMS: nadie gasta por clave; o cobra quien tiene la clave «cobra» y la
 * preimagen, o, desde la altura «vence», recupera quien tiene la clave «reembolso».
 */
export async function politicaCandado({ cobra, reembolso, hash, vence }) {
  const cobro = andV(vpk(cobra), sha256Frag(hash));
  const devolucion = andV(vpk(reembolso), after(vence));
  const hojas = [];
  for (const f of [cobro, devolucion]) hojas.push({ miniscript: f.ms, script: f.script, hoja: await hoja(f.script) });
  const raiz = await rama(hojas[0].hoja, hojas[1].hoja);
  return {
    politica: `or(and(pk(${cobra}),sha256(${hash})),and(pk(${reembolso}),after(${vence})))`,
    descriptor: `tr(${NUMS},{${cobro.ms},${devolucion.ms}})`,
    interna: NUMS,
    hojas,
    raiz,
  };
}
