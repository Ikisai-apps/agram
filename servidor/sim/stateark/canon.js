// Forma canónica para las huellas: JSON con las claves ordenadas, sin espacios. Dos objetos iguales
// dan los mismos bytes. (La de stateark-app es la de sus structs en Rust; esta simulación no
// pretende coincidir byte a byte con ella.)

import { sha256, sha256Texto } from './hash.js';

// La MISMA que `canonico` de AGRAM (src/evento.js): primero se pasa por JSON (una clave con undefined no
// está, un undefined en una lista es null, NaN es null, toJSON se respeta) y luego se ordenan las claves.
// Así un recibo o una prueba dan el mismo id en AGRAM, en AARPIA y aquí (test/canon.test.js lo coteja).
export function canonico(valor) {
  const texto = JSON.stringify(valor);
  return ordenado(texto === undefined ? null : JSON.parse(texto));
}

function ordenado(valor) {
  if (Array.isArray(valor)) return '[' + valor.map(ordenado).join(',') + ']';
  if (valor !== null && typeof valor === 'object') {
    const claves = Object.keys(valor).sort();
    return '{' + claves.map((k) => JSON.stringify(k) + ':' + ordenado(valor[k])).join(',') + '}';
  }
  return JSON.stringify(valor);
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
