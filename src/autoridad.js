// Autoridad mínima: cada identidad puede tener una clave pública; quien la
// tiene firma sus eventos y el eje lo comprueba. Nadie mueve tokens ajenos:
// todo movimiento sale del autor. ECDSA P-256 con Web Crypto, igual en Node
// y en el navegador. Las claves privadas nunca entran en el eje.

const ALG = { name: 'ECDSA', namedCurve: 'P-256' };
const FIRMA = { name: 'ECDSA', hash: 'SHA-256' };
const subtle = () => globalThis.crypto.subtle;

/** Genera un par de claves. Devuelve { publica (JWK exportable), privada (CryptoKey) }. */
export async function generarClaves() {
  const par = await subtle().generateKey(ALG, true, ['sign', 'verify']);
  const publica = await subtle().exportKey('jwk', par.publicKey);
  return { publica: { kty: publica.kty, crv: publica.crv, x: publica.x, y: publica.y }, privada: par.privateKey };
}

/** Exporta la clave privada como JWK (para guardarla en local); importarPrivada la recupera. */
export async function exportarPrivada(privada) {
  return subtle().exportKey('jwk', privada);
}

export async function importarPrivada(jwk) {
  return subtle().importKey('jwk', jwk, ALG, true, ['sign']);
}

async function importarPublica(jwk) {
  return subtle().importKey('jwk', { ...jwk, ext: true }, ALG, true, ['verify']);
}

const aBytes = (hex) => Uint8Array.from(hex.match(/.{2}/g), (h) => parseInt(h, 16));
const aBase64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deBase64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0));

/** Firma el id de un evento (el hash de su cuerpo). Devuelve el evento con firmante y firma. */
export async function firmar(ev, privada, firmante = ev.autor) {
  if (!ev.id) throw new Error('el evento no tiene id');
  const firma = aBase64url(await subtle().sign(FIRMA, privada, aBytes(ev.id)));
  return Object.freeze({ ...ev, firmante, firma });
}

/** Comprueba la firma de un evento con la clave pública (JWK) de su firmante. */
export async function verificar(ev, publica) {
  if (!ev.firma || !ev.id) return false;
  try {
    return await subtle().verify(FIRMA, await importarPublica(publica), deBase64url(ev.firma), aBytes(ev.id));
  } catch {
    return false;
  }
}

/** Huella corta de una clave pública, para mostrarla. */
export function huella(publica) {
  return (publica.x ?? '').slice(0, 8);
}
