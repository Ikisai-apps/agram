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

/** Doble SHA-256 de unos bytes en hex (el de Bitcoin), en hex y en orden interno. */
export async function sha256d(hex) {
  return sha256(aBytes(await sha256(aBytes(hex))));
}

/** Hash etiquetado de BIP-340 sobre bytes: SHA-256(SHA-256(etiqueta) ‖ SHA-256(etiqueta) ‖ bytes). */
export async function hashEtiquetadoBytes(etiqueta, bytes) {
  const t = aBytes(await sha256Texto(etiqueta));
  const todo = new Uint8Array(64 + bytes.length);
  todo.set(t, 0);
  todo.set(t, 32);
  todo.set(bytes, 64);
  return sha256(todo);
}

/** Entero sin signo de n bytes, little-endian, en hex. */
export function leHex(numero, n) {
  let s = '';
  let x = BigInt(numero);
  for (let i = 0; i < n; i++) { s += Number(x & 0xffn).toString(16).padStart(2, '0'); x >>= 8n; }
  if (x !== 0n) throw new RangeError(`${numero} no cabe en ${n} bytes`);
  return s;
}

/** Lee un entero little-endian de unos bytes en hex. */
export function deLe(hex) {
  let x = 0n;
  for (let i = hex.length - 2; i >= 0; i -= 2) x = (x << 8n) | BigInt(parseInt(hex.slice(i, i + 2), 16));
  return x;
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
