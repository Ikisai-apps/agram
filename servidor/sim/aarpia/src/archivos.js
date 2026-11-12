// El almacén que espera la función `archivos` de AGRAM (servidor/supabase/funciones/archivos/api.js,
// sin tocar), sobre el Blossom simulado, CIFRANDO ANTES DE SUBIR (acordado con Core AGRAM, §4):
//
//   - la carta sigue usando `archivo:<sha256 del original>` y la misma API;
//   - a Blossom sube solo el cifrado: AES-256-GCM con una clave por eje y un nonce al azar;
//     el blob público es [12 bytes de nonce | cifrado+etiqueta] y su sha256 no dice nada del original;
//   - el índice (eje, sha original) → (sha del cifrado, tipo) vive aquí, como las claves por eje.
//
// En esta simulación cifra el servicio, porque la carta no cambia. En el sistema real
// cifrará la carta, con una clave que no sale del eje: el servidor no debería ver el original.

import { autorizacion } from './blossom.js';
import { aHex } from './nostr.js';

const sha256 = async (bytes) => aHex(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes)));

/**
 * @param {object} o
 * @param {(request: Request) => Promise<Response>} o.blossom  el manejador del servidor Blossom
 * @param {string} o.privadaTransporte   la clave que firma las autorizaciones 24242
 * @param {(nombre: string) => Promise<object|null>} o.eje   la tabla de ejes (la del libro compartido)
 */
export function almacenArchivos({ blossom, privadaTransporte, eje, ahora = () => new Date() }) {
  const claves = new Map(); // eje → CryptoKey AES-GCM
  const indice = new Map(); // «eje/sha original» → { blob, tipo }

  async function claveDe(nombre) {
    if (!claves.has(nombre)) claves.set(nombre, await globalThis.crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']));
    return claves.get(nombre);
  }

  return {
    eje,
    async guardar(nombre, id, tipo, bytes) {
      if (indice.has(nombre + '/' + id)) return { nuevo: false };
      const nonce = globalThis.crypto.getRandomValues(new Uint8Array(12));
      const cifrado = new Uint8Array(await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, await claveDe(nombre), bytes));
      const blob = new Uint8Array(12 + cifrado.length);
      blob.set(nonce);
      blob.set(cifrado, 12);
      const sha = await sha256(blob);
      const r = await blossom(new Request('http://blossom.local/upload', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream', Authorization: await autorizacion({ accion: 'upload', sha, privada: privadaTransporte, ahora: ahora() }) },
        body: blob,
      }));
      if (r.status !== 201 && r.status !== 200) throw new Error('Blossom no aceptó el archivo: ' + r.status + ' ' + (r.headers.get('x-reason') ?? ''));
      indice.set(nombre + '/' + id, { blob: sha, tipo });
      return { nuevo: true };
    },
    async leer(nombre, id) {
      const entrada = indice.get(nombre + '/' + id);
      if (!entrada) return null;
      const r = await blossom(new Request('http://blossom.local/' + entrada.blob));
      if (r.status !== 200) return null;
      const blob = new Uint8Array(await r.arrayBuffer());
      const claro = new Uint8Array(await globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv: blob.slice(0, 12) }, await claveDe(nombre), blob.slice(12)));
      if ((await sha256(claro)) !== id) return null; // lo que vuelve debe ser lo que se pidió
      return { tipo: entrada.tipo, bytes: claro };
    },
    /** Solo para pruebas: el sha del blob cifrado que guarda Blossom para un archivo. */
    blobDe(nombre, id) {
      return indice.get(nombre + '/' + id)?.blob;
    },
  };
}
