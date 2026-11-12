// Un servidor Blossom en memoria (BUD-01 y BUD-02), con lo que el contrato §4 pide:
//
//   PUT    /upload        cuerpo binario + `Authorization: Nostr <base64 de un 24242>` → 201 { url, sha256, size, type, uploaded }
//   GET    /<sha256>[.ext] → los bytes, con las cabeceras que pondría el proxy de AARPIA (nada se ejecuta)
//   HEAD   /<sha256>       → 200/404 sin cuerpo
//   DELETE /<sha256>       → con su 24242 (t=delete), lo retira de ESTE servidor
//
// El 24242 debe: ir firmado, ser kind 24242, llevar t=upload|delete, x=<sha256 del cuerpo> y una
// expiración futura. Blossom es PÚBLICO por diseño: quien tenga el sha256 descarga. Por eso
// lo privado se cifra antes de subir (src/archivos.js).

import { verificar, firmar, valores, aHex } from './nostr.js';

export const KIND_AUTORIZACION = 24242;
export const POLITICA = "sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; media-src data:";
export const LIMITE = 2 * 1024 * 1024 + 64; // 2 MB más la cabecera del cifrado

const sha256 = async (bytes) => aHex(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes)));
const b64 = (texto) => btoa(String.fromCharCode(...new TextEncoder().encode(texto)));
const deB64 = (s) => new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));

/** La cabecera Authorization de BUD-01 para `accion` sobre `sha`, firmada con `privada`. */
export async function autorizacion({ accion, sha, privada, ahora = new Date(), vigencia = 300 }) {
  const t = Math.floor(ahora.getTime() / 1000);
  const ev = await firmar({ kind: KIND_AUTORIZACION, created_at: t, tags: [['t', accion], ['x', sha], ['expiration', String(t + vigencia)]], content: accion + ' ' + sha }, privada);
  return 'Nostr ' + b64(JSON.stringify(ev));
}

export function crearBlossom({ base = 'http://blossom.local', limite = LIMITE, ahora = () => new Date(), autorizados } = {}) {
  const blobs = new Map(); // sha → { bytes, tipo, subido, dueños: Set<pubkey> }
  const respuesta = (estado, cuerpo, cabeceras = {}) => new Response(cuerpo === undefined ? null : JSON.stringify(cuerpo), { status: estado, headers: { 'Content-Type': 'application/json', ...cabeceras } });
  const razon = (estado, texto) => new Response(null, { status: estado, headers: { 'X-Reason': texto } });

  /** El 24242 de la petición, comprobado para `accion` y `sha` → { pubkey } o { error }. */
  async function autor(request, accion, sha) {
    const h = request.headers.get('authorization') ?? '';
    if (!h.startsWith('Nostr ')) return { error: 'falta Authorization: Nostr' };
    let ev;
    try { ev = JSON.parse(deB64(h.slice(6).trim())); } catch { return { error: 'autorización ilegible' }; }
    if (ev.kind !== KIND_AUTORIZACION || !(await verificar(ev))) return { error: 'autorización inválida' };
    if (!valores(ev, 't').includes(accion)) return { error: 'la autorización no es para ' + accion };
    if (!valores(ev, 'x').includes(sha)) return { error: 'la autorización no es para este blob' };
    const caduca = Number(valores(ev, 'expiration')[0]);
    if (!(caduca > ahora().getTime() / 1000)) return { error: 'autorización caducada' };
    if (autorizados && !autorizados.includes(ev.pubkey)) return { error: 'clave no autorizada en este servidor' };
    return { pubkey: ev.pubkey };
  }

  async function subir(request) {
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (!bytes.length) return razon(400, 'cuerpo vacío');
    if (bytes.length > limite) return razon(413, 'demasiado grande');
    const sha = await sha256(bytes);
    const a = await autor(request, 'upload', sha);
    if (a.error) return razon(401, a.error);
    const tipo = (request.headers.get('content-type') ?? 'application/octet-stream').split(';')[0].trim();
    let b = blobs.get(sha);
    const nuevo = !b;
    if (!b) blobs.set(sha, (b = { bytes, tipo, subido: Math.floor(ahora().getTime() / 1000), duenos: new Set() }));
    b.duenos.add(a.pubkey);
    return respuesta(nuevo ? 201 : 200, { url: base + '/' + sha, sha256: sha, size: bytes.length, type: b.tipo, uploaded: b.subido });
  }

  return async function manejar(request) {
    const camino = new URL(request.url).pathname;
    if (camino === '/upload') return request.method === 'PUT' ? subir(request) : razon(405, 'solo PUT');
    const m = /^\/([0-9a-f]{64})(\.[a-z0-9]+)?$/.exec(camino);
    if (!m) return razon(404, 'ruta desconocida');
    const sha = m[1];
    const b = blobs.get(sha);
    if (request.method === 'DELETE') {
      if (!b) return razon(404, 'no está');
      const a = await autor(request, 'delete', sha);
      if (a.error) return razon(401, a.error);
      b.duenos.delete(a.pubkey);
      if (!b.duenos.size) blobs.delete(sha);
      return respuesta(200, { borrado: sha });
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') return razon(405, 'GET, HEAD, PUT o DELETE');
    if (!b) return razon(404, 'no está');
    const cabeceras = {
      'Content-Type': b.tipo,
      'Content-Length': String(b.bytes.length),
      'Content-Security-Policy': POLITICA,
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': b.tipo.startsWith('image/') && b.tipo !== 'image/svg+xml' ? 'inline' : 'attachment',
      'Cache-Control': 'public, max-age=31536000, immutable',
    };
    return new Response(request.method === 'HEAD' ? null : b.bytes, { status: 200, headers: cabeceras });
  };
}
