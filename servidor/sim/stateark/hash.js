// SHA-256 y hexadecimal, sin dependencias: el mismo código en Node, el navegador y Deno
// (todos tienen globalThis.crypto.subtle).

const HEX64 = /^[0-9a-f]{64}$/;

/** ¿Es un id de AGRAM (SHA-256 del cuerpo canónico, 64 hex en minúsculas)? */
export function esId(valor) {
  return typeof valor === 'string' && HEX64.test(valor);
}

export function aBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(2 * i, 2 * i + 2), 16);
  return out;
}

export function aHex(bytes) {
  let s = '';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return s;
}

/** SHA-256 de unos bytes, en hex. */
export async function sha256(bytes) {
  return aHex(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes)));
}

/** SHA-256 de un texto UTF-8, en hex. */
export async function sha256Texto(texto) {
  return sha256(new TextEncoder().encode(texto));
}

/** SHA-256 de un prefijo de un byte seguido de varios hashes en hex (separación de dominio hoja/nodo). */
export async function sha256Etiquetado(prefijo, ...hexes) {
  const partes = hexes.map(aBytes);
  const total = new Uint8Array(1 + partes.reduce((n, p) => n + p.length, 0));
  total[0] = prefijo;
  let k = 1;
  for (const p of partes) { total.set(p, k); k += p.length; }
  return sha256(total);
}
