// Forma canónica para las huellas: JSON con las claves ordenadas, sin espacios. Dos objetos iguales
// dan los mismos bytes. (La de stateark-app es la de sus structs en Rust; esta simulación no
// pretende coincidir byte a byte con ella.)

import { sha256, sha256Texto } from './hash.js';

export function canonico(valor) {
  if (valor === null || typeof valor !== 'object') {
    if (typeof valor === 'number' && !Number.isFinite(valor)) throw new TypeError('número no finito en la forma canónica');
    return JSON.stringify(valor);
  }
  if (Array.isArray(valor)) return `[${valor.map(canonico).join(',')}]`;
  const claves = Object.keys(valor).filter((k) => valor[k] !== undefined).sort();
  return `{${claves.map((k) => `${JSON.stringify(k)}:${canonico(valor[k])}`).join(',')}}`;
}

/** SHA-256 de la forma canónica, en hex. */
export function huella(valor) {
  return sha256Texto(canonico(valor));
}

/** Hash etiquetado de BIP-340: SHA-256(SHA-256(etiqueta) ‖ SHA-256(etiqueta) ‖ mensaje UTF-8). */
export async function hashEtiquetado(etiqueta, texto) {
  const enc = new TextEncoder();
  const t = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', enc.encode(etiqueta)));
  const m = enc.encode(texto);
  const todo = new Uint8Array(64 + m.length);
  todo.set(t, 0);
  todo.set(t, 32);
  todo.set(m, 64);
  return sha256(todo);
}
