// Autoridad mínima: cada identidad puede tener una clave pública; quien la
// tiene firma sus eventos y el eje lo comprueba. Nadie mueve tokens ajenos:
// todo movimiento sale del autor. Firmas Schnorr sobre secp256k1 según
// BIP-340 (como Nostr y Taproot), con la librería vendorizada en
// src/vendor/noble-secp256k1.js (src/vendor/LEEME.md; docs/notas/FIRMAS_BIP340.md):
// el mismo archivo en Node, en el navegador y en Deno. Las claves privadas
// nunca entran en el eje.
//
// Formato (todo en hexadecimal en minúsculas, una sola escritura por valor):
//   clave pública  32 bytes, x-only (64 caracteres)
//   clave privada  32 bytes, 0 < d < n (64 caracteres)
//   firma          64 bytes (128 caracteres), del id del evento (los 32 bytes del SHA-256 del cuerpo canónico)

import { schnorr } from './vendor/noble-secp256k1.js';

const HEX32 = /^[0-9a-f]{64}$/;
const HEX64 = /^[0-9a-f]{128}$/;

const aBytes = (hex) => Uint8Array.from(hex.match(/.{2}/g), (h) => parseInt(h, 16));
const aHex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
const aleatorio = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));

/** La clave pública (x-only, hex) de una clave privada (hex). Lanza si la privada no vale. */
export function publicaDe(privada) {
  if (typeof privada !== 'string' || !HEX32.test(privada)) throw new Error('clave privada inválida: 32 bytes en hexadecimal (minúsculas)');
  return aHex(schnorr.getPublicKey(aBytes(privada)));
}

/** Genera un par de claves con el azar de Web Crypto. Devuelve { publica, privada }, las dos en hexadecimal. */
export async function generarClaves() {
  const privada = aHex(schnorr.utils.randomSecretKey());
  return { publica: publicaDe(privada), privada };
}

/**
 * La clave privada como se guarda en local (o se cifra en la copia): el mismo texto hexadecimal. importarPrivada la
 * comprueba (32 bytes, 0 < d < n) y la devuelve; lanza si no vale.
 */
export async function exportarPrivada(privada) {
  publicaDe(privada);
  return privada;
}

export async function importarPrivada(privada) {
  publicaDe(privada);
  return privada;
}

/** La firma BIP-340 (hex) del id con la privada; el azar auxiliar (aux_rand) sale de Web Crypto. */
function firmarId(id, privada) {
  if (typeof id !== 'string' || !HEX32.test(id)) throw new Error('el evento no tiene id');
  publicaDe(privada);
  return aHex(schnorr.sign(aBytes(id), aBytes(privada), aleatorio(32)));
}

/** Firma el id de un evento (el hash de su cuerpo). Devuelve el evento con firmante y firma. */
export async function firmar(ev, privada, firmante = ev.autor) {
  if (!ev.id) throw new Error('el evento no tiene id');
  return Object.freeze({ ...ev, firmante, firma: firmarId(ev.id, privada) });
}

/**
 * Comprueba la firma de un evento con la clave pública (x-only, hex) de su firmante. La firma debe ir en
 * hexadecimal en minúsculas, 64 bytes, tal como la escribe `firmar`: una sola escritura por firma.
 */
export async function verificar(ev, publica) {
  return verificarFirma(ev.firma, ev.id, publica);
}

/** Una firma (hex) del id con la clave pública (hex). false ante cualquier cosa rara, sin lanzar. */
function verificarFirma(firma, id, publica) {
  if (typeof firma !== 'string' || !HEX64.test(firma) || typeof id !== 'string' || !HEX32.test(id)) return false;
  if (typeof publica !== 'string' || !HEX32.test(publica)) return false;
  try {
    return schnorr.verify(aBytes(firma), aBytes(id), aBytes(publica));
  } catch {
    return false;
  }
}

/**
 * Prueba de posesión (R9, docs/notas/NEUTRALIDAD_IDENTIDAD.md §4): la clave
 * que un alta declara para `identidad` firma el id del propio evento del
 * alta. Va en `posesion` ({ identidad: firma }), fuera del cuerpo como la
 * firma del autor, así que no cambia el id. Devuelve el evento con la prueba.
 */
export async function firmarPosesion(ev, identidad, privada) {
  if (!ev.id) throw new Error('el evento no tiene id');
  const firma = firmarId(ev.id, privada);
  return Object.freeze({ ...ev, posesion: { ...(ev.posesion ?? {}), [identidad]: firma } });
}

/** ¿Firma `posesion[identidad]` el id del evento con la clave pública declarada para ella? */
export async function verificarPosesion(ev, identidad, publica) {
  const p = ev.posesion;
  const firma = p && typeof p === 'object' && !Array.isArray(p) && Object.hasOwn(p, identidad) ? p[identidad] : undefined;
  return verificarFirma(firma, ev.id, publica);
}

/**
 * Una clave pública declarable: 32 bytes x-only en hexadecimal (minúsculas) cuya x es la de un punto de la curva
 * (lift_x de BIP-340). Si no, la identidad quedaría muda para siempre.
 */
export function clavePublicaValida(publica) {
  if (typeof publica !== 'string' || !HEX32.test(publica)) return false;
  try {
    schnorr.utils.lift_x(BigInt('0x' + publica));
    return true;
  } catch {
    return false;
  }
}

/** Huella corta de una clave pública, para mostrarla: sus ocho primeros caracteres. */
export function huella(publica) {
  return typeof publica === 'string' ? publica.slice(0, 8) : '';
}
