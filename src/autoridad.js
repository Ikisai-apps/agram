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

// Claves públicas ya importadas, por el objeto JWK. Importar cuesta casi lo
// mismo que verificar (docs/notas/RENDIMIENTO.md), y el eje verifica muchas
// veces con la misma clave: la que guarda congelada desde el alta. Solo se
// recuerdan las JWK congeladas. Object.isFrozen mira solo el primer nivel:
// el material de la clave (kty, crv, x, y) son textos de ese nivel y no
// cambian; un array key_ops de dentro sí podría, y solo decide si la clave se
// puede importar para verificar. El eje congela entera la copia que guarda,
// así que con sus claves el resultado es el mismo que importar cada vez. Una
// importación fallida no se recuerda.
const importadas = new WeakMap();

function importarVerificadora(jwk) {
  if (!jwk || typeof jwk !== 'object' || !Object.isFrozen(jwk)) return importarPublica(jwk);
  let promesa = importadas.get(jwk);
  if (!promesa) {
    promesa = importarPublica(jwk);
    importadas.set(jwk, promesa);
    promesa.catch(() => importadas.delete(jwk));
  }
  return promesa;
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

/**
 * Comprueba la firma de un evento con la clave pública (JWK) de su firmante.
 * La firma debe estar en base64url canónico, tal como la escribe `firmar`:
 * sin relleno, sin espacios y sin bits sobrantes distintos de cero, para que
 * unos bytes manipulados no pasen por la misma firma.
 */
export async function verificar(ev, publica) {
  return verificarFirma(ev.firma, ev.id, publica);
}

/** Una firma (base64url canónico) del id con la clave pública (JWK). */
async function verificarFirma(firma, id, publica) {
  if (typeof firma !== 'string' || !/^[A-Za-z0-9_-]+$/.test(firma) || !id) return false;
  try {
    const bytes = deBase64url(firma);
    if (aBase64url(bytes) !== firma) return false;
    return await subtle().verify(FIRMA, await importarVerificadora(publica), bytes, aBytes(id));
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
  const firma = aBase64url(await subtle().sign(FIRMA, privada, aBytes(ev.id)));
  return Object.freeze({ ...ev, posesion: { ...(ev.posesion ?? {}), [identidad]: firma } });
}

/** ¿Firma `posesion[identidad]` el id del evento con la clave pública declarada para ella? */
export async function verificarPosesion(ev, identidad, publica) {
  const p = ev.posesion;
  const firma = p && typeof p === 'object' && !Array.isArray(p) && Object.hasOwn(p, identidad) ? p[identidad] : undefined;
  return verificarFirma(firma, ev.id, publica);
}

/**
 * Una clave pública declarable: JWK EC P-256 con x e y, sin parte privada
 * (`d`: las claves privadas nunca entran en el eje) y que Web Crypto pueda
 * importar para verificar. Si no, la identidad quedaría muda para siempre.
 */
export async function clavePublicaValida(jwk) {
  if (!jwk || typeof jwk !== 'object' || Array.isArray(jwk)) return false;
  if (jwk.kty !== 'EC' || jwk.crv !== 'P-256' || typeof jwk.x !== 'string' || typeof jwk.y !== 'string' || 'd' in jwk) return false;
  try {
    await importarPublica(jwk);
    return true;
  } catch {
    return false;
  }
}

/** Huella corta de una clave pública, para mostrarla. */
export function huella(publica) {
  return (publica.x ?? '').slice(0, 8);
}
