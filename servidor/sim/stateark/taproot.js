// Sello por Taproot (VG, 13-11: «en Taproot podemos meter de todo»), sustituye a OpenTimestamps.
//
// Las raíces de lote se comprometen como HOJAS de un árbol Taproot (MAST) de una salida nuestra:
//   hoja de compromiso = el Script «OP_RETURN <raíz del lote>» (6a 20 <32 bytes>): no se puede gastar, solo dice
//                        el hash. Es una PLANTILLA DE SCRIPT CON NOMBRE del SIP («compromiso»), porque Miniscript
//                        no expresa OP_RETURN.
//   árbol             = TapBranch de BIP-341, que ordena sus hijos: el camino de una hoja son solo sus HERMANOS
//                        (sin lados, sin tuplas).
//   clave de salida   = TapTweak(clave interna, raíz del árbol). En la sim la interna es NUMS (nadie gasta por
//                        clave: no hay dinero); en la aplicación real será la clave de la cartera, para que la
//                        salida sea la vuelta de un pago que se hace igual.
// La transacción que lleva esa salida es una transacción Bitcoin de verdad en su forma (serializada como
// tal, su txid es su doble SHA-256), para que AGRAM la lea con `tx(b)`.

import { hoja, rama, NUMS } from './miniscript.js';
import { ajustar } from './secp.js';
import { hashEtiquetadoBytes, aBytes, leHex, sha256d } from './hash.js';

export const VIA_TAPROOT = 'taproot';

/** El Script de la hoja de compromiso: OP_RETURN <32 bytes>. */
export function scriptDeCompromiso(raizHex) {
  if (!/^[0-9a-f]{64}$/.test(raizHex)) throw new TypeError('un compromiso son 32 bytes en hex');
  return '6a20' + raizHex;
}

/** Árbol Taproot de unas hojas (hashes TapLeaf), en el orden dado: la raíz y los hermanos de cada hoja. */
export async function arbolTaproot(hojas) {
  if (!hojas.length) throw new RangeError('un árbol Taproot necesita al menos una hoja');
  let nivel = hojas.map((h, i) => ({ h, indices: [i] }));
  const hermanos = hojas.map(() => []);
  while (nivel.length > 1) {
    const siguiente = [];
    for (let i = 0; i < nivel.length; i += 2) {
      const a = nivel[i];
      const b = nivel[i + 1];
      if (!b) { siguiente.push(a); continue; } // el impar sube tal cual
      for (const k of a.indices) hermanos[k].push(b.h);
      for (const k of b.indices) hermanos[k].push(a.h);
      siguiente.push({ h: await rama(a.h, b.h), indices: [...a.indices, ...b.indices] });
    }
    nivel = siguiente;
  }
  return { raiz: nivel[0].h, hermanos };
}

/** Raíz del árbol desde una hoja y sus hermanos (TapBranch ordena: no hacen falta lados). */
export async function raizDesdeHermanos(hojaHash, hermanos) {
  let x = hojaHash;
  for (const h of hermanos ?? []) x = await rama(x, h);
  return x;
}

/** TapTweak de BIP-341: la clave de salida x-only de tr(interna, raíz). */
export async function claveDeSalida(interna, raiz) {
  const t = await hashEtiquetadoBytes('TapTweak', aBytes(interna + raiz));
  return ajustar(interna, t).clave;
}

/**
 * La transacción de anclaje, serializada como Bitcoin (sin testigo): una entrada (la de `previa`, vout 0) y una
 * salida P2TR de `sat` a la clave de salida. Devuelve { tx (hex), txid (orden interno), script }.
 */
export async function transaccionDeAnclaje({ clave, previa, sat = 330 }) {
  const script = '5120' + clave;
  const tx = '02000000' // versión 2
    + '01' + previa + '00000000' + '00' + 'fdffffff' // una entrada: previa:0, sin scriptSig, secuencia
    + '01' + leHex(sat, 8) + '22' + script // una salida P2TR (34 bytes de script)
    + '00000000'; // locktime
  return { tx, txid: await sha256d(tx), script };
}

/** Ancla unas raíces de lote: hojas de compromiso → árbol → clave de salida → transacción. */
export async function anclar(raices, { interna = NUMS, previa }) {
  const hojas = await Promise.all(raices.map((r) => hoja(scriptDeCompromiso(r))));
  const { raiz, hermanos } = await arbolTaproot(hojas);
  const clave = await claveDeSalida(interna, raiz);
  const t = await transaccionDeAnclaje({ clave, previa });
  return { ...t, interna, raizTaproot: raiz, clave, hermanos: new Map(raices.map((r, i) => [r, hermanos[i]])) };
}

/** Lee lo mínimo de la transacción de anclaje (una entrada sin testigo): el script de su salida `vout`. */
export function scriptDeSalida(txHex, vout) {
  // versión (8) + nº entradas (2) + entrada (32+8+2+8 hex) = 68 hex; luego nº de salidas
  let i = 8;
  const nIn = parseInt(txHex.slice(i, i + 2), 16); i += 2;
  for (let k = 0; k < nIn; k++) { i += 72; const l = parseInt(txHex.slice(i, i + 2), 16); i += 2 + 2 * l + 8; }
  const nOut = parseInt(txHex.slice(i, i + 2), 16); i += 2;
  for (let k = 0; k < nOut; k++) {
    i += 16;
    const l = parseInt(txHex.slice(i, i + 2), 16); i += 2;
    const s = txHex.slice(i, i + 2 * l); i += 2 * l;
    if (k === vout) return s;
  }
  return null;
}
