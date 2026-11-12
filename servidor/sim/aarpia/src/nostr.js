// Eventos Nostr (NIP-01): serializar, calcular el id, firmar y verificar.
// Misma curva y mismo esquema que AGRAM (Schnorr BIP-340 sobre secp256k1,
// claves x-only de 32 bytes en hex); la única dependencia es la copia de
// noble-secp256k1 que AGRAM ya trae (servidor/supabase/funciones/eventos).

import { schnorr } from '../../../supabase/funciones/eventos/noble-secp256k1.js';

const HEX64 = /^[0-9a-f]{64}$/;
const HEX128 = /^[0-9a-f]{128}$/;

export const aBytes = (hex) => Uint8Array.from(hex.match(/.{2}/g) ?? [], (h) => parseInt(h, 16));
export const aHex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

/** SHA-256 en hex de un texto UTF-8. */
export async function sha256Hex(texto) {
  const d = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return aHex(new Uint8Array(d));
}

/** La serialización de NIP-01 sobre la que se calcula el id. */
export const serializar = (ev) => JSON.stringify([0, ev.pubkey, ev.created_at, ev.kind, ev.tags, ev.content]);

/** El id de NIP-01 de un evento (hex). */
export const idDe = (ev) => sha256Hex(serializar(ev));

/** Una clave privada nueva y su pública x-only, en hex. */
export function generarClaves() {
  const privada = schnorr.utils.randomSecretKey();
  return { privada: aHex(privada), publica: aHex(schnorr.getPublicKey(privada)) };
}

/** La clave pública x-only (hex) de una privada (hex). */
export const publicaDe = (privada) => aHex(schnorr.getPublicKey(aBytes(privada)));

/**
 * Firma un evento sin firmar `{ kind, created_at, tags, content }` con `privada`
 * (hex). Devuelve el evento completo `{ id, pubkey, created_at, kind, tags, content, sig }`.
 */
export async function firmar(sinFirmar, privada) {
  const ev = {
    pubkey: publicaDe(privada),
    created_at: sinFirmar.created_at,
    kind: sinFirmar.kind,
    tags: sinFirmar.tags ?? [],
    content: sinFirmar.content ?? '',
  };
  ev.id = await idDe(ev);
  ev.sig = aHex(schnorr.sign(aBytes(ev.id), aBytes(privada)));
  return ev;
}

/** Errores de forma de un evento Nostr (vacío si vale). */
export function erroresDeForma(ev) {
  if (!ev || typeof ev !== 'object' || Array.isArray(ev)) return ['no es un objeto'];
  const e = [];
  if (!HEX64.test(ev.id ?? '')) e.push('id');
  if (!HEX64.test(ev.pubkey ?? '')) e.push('pubkey');
  if (!HEX128.test(ev.sig ?? '')) e.push('sig');
  if (!Number.isSafeInteger(ev.created_at) || ev.created_at < 0) e.push('created_at');
  if (!Number.isSafeInteger(ev.kind) || ev.kind < 0 || ev.kind > 65535) e.push('kind');
  if (!Array.isArray(ev.tags) || ev.tags.some((t) => !Array.isArray(t) || t.some((x) => typeof x !== 'string'))) e.push('tags');
  if (typeof ev.content !== 'string') e.push('content');
  return e;
}

/** ¿Es el evento válido: forma, id y firma? No lanza. */
export async function verificar(ev) {
  if (erroresDeForma(ev).length) return false;
  if ((await idDe(ev)) !== ev.id) return false;
  try {
    return schnorr.verify(aBytes(ev.sig), aBytes(ev.id), aBytes(ev.pubkey));
  } catch {
    return false;
  }
}

/** Los valores de las etiquetas `nombre` de un evento. */
export const valores = (ev, nombre) => ev.tags.filter((t) => t[0] === nombre).map((t) => t[1]);
