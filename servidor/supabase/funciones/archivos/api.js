// El contrato HTTP de los archivos adjuntos (issues #21, #22: la representación HTML del PV0, adjuntar un archivo),
// como una función (Request) → Response de la API Fetch, igual en Deno (index.ts la sirve con Deno.serve sobre
// Supabase Storage) y en Node (servidor/prueba/servidor.mjs la sirve sobre un almacén en memoria). Sin dependencias;
// la carpeta es autónoma (se despliega sola). docs/CONTRATO.md §2.1.
//
//   POST {url}/archivos?eje=…        con X-Clave-Lectura (la del libro compartido del eje), Content-Type uno de TIPOS y
//                                    el cuerpo binario (tope 2 MB) → 201 { id, tipo, bytes } (200 si ya estaba:
//                                    idempotente, el id es el SHA-256 del contenido). 400 eje, cuerpo vacío o contenido
//                                    que no es del tipo; 401 clave (o eje que no existe: la misma respuesta, #106); 413 más de 2 MB; 415 tipo no admitido;
//                                    429 más de 30 subidas por minuto en el eje.
//   GET  {url}/archivos/<id>?eje=…   con X-Clave-Lectura → 200 el archivo con su Content-Type; 404 si no está.
//   OPTIONS                          CORS (los mismos orígenes que la función `eventos`).
//
// El registro guarda la referencia como texto `archivo:<id>` (docs/CONTRATO.md §2.1); la carta la resuelve a esta
// función con la clave de lectura que ya tiene. Nada de lo que se sirve se ejecuta: la carta pinta el HTML solo dentro
// de un <iframe sandbox> sin scripts, y la respuesta lleva además `Content-Security-Policy: sandbox` (si alguien abre
// la URL a mano, el navegador lo trata igual: sin scripts, sin formularios, origen opaco), `nosniff` y
// `Content-Disposition: inline`. Los archivos van a un bucket PRIVADO (`agram-archivos`) bajo `<eje>/<id>`.

/** Orígenes admitidos por CORS: la carta publicada y el desarrollo local (los de la función `eventos`). */
export const ORIGENES = Object.freeze(['https://agram.ikisai.com', 'https://beta.agram.ikisai.com', 'https://agram-beta.pages.dev', /^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/]);
/** Tope de un archivo, en bytes. */
export const LIMITE_ARCHIVO = 2 * 1024 * 1024;
/** Los tipos que se admiten (application/json: una animación Lottie). */
export const TIPOS = Object.freeze(['text/html', 'image/png', 'image/jpeg', 'image/svg+xml', 'application/json']);
/** Subidas admitidas por eje y minuto. */
export const SUBIDAS_POR_MINUTO = 30;
/** El bucket privado de Supabase Storage donde viven. */
export const BUCKET = 'agram-archivos';
export const NOMBRE_EJE = /^[a-z0-9][a-z0-9._-]{0,63}$/;
export const RE_ID = /^[0-9a-f]{64}$/;

/** La política de lo que se sirve: nada se ejecuta ni se envía, aunque se abra fuera de la carta. */
export const POLITICA = "sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; media-src data:";

const hex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
/** SHA-256 en hexadecimal: de un texto (la clave de lectura, como la guarda la tabla `ejes`) o de bytes (el id de un archivo). */
export async function sha256(datos) {
  const bytes = typeof datos === 'string' ? new TextEncoder().encode(datos) : datos;
  return hex(await globalThis.crypto.subtle.digest('SHA-256', bytes));
}

/** El tipo de una cabecera Content-Type sin sus parámetros («text/html; charset=utf-8» → «text/html»). */
export const tipoDe = (cabecera) => String(cabecera ?? '').split(';')[0].trim().toLowerCase();

/**
 * ¿Es el contenido de verdad del tipo que dice? Lo mínimo para no guardar otra cosa con otra etiqueta: PNG y JPEG por
 * su firma; JSON que se lee; HTML y SVG, texto UTF-8 válido (el SVG, con su etiqueta). → null si vale, o el motivo.
 */
export function contenidoDelTipo(tipo, bytes) {
  const empieza = (...firma) => firma.every((b, i) => bytes[i] === b);
  if (tipo === 'image/png') return empieza(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a) ? null : 'no es un PNG';
  if (tipo === 'image/jpeg') return empieza(0xff, 0xd8, 0xff) ? null : 'no es un JPEG';
  let texto;
  try {
    texto = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return 'no es texto UTF-8';
  }
  if (tipo === 'application/json') {
    try { JSON.parse(texto); } catch { return 'no es JSON'; }
    return null;
  }
  if (tipo === 'image/svg+xml') return /<svg[\s>]/i.test(texto) ? null : 'no es un SVG';
  return null; // text/html: cualquier texto (se pinta sin ejecutar nada)
}

/**
 * El tipo de un contenido por sí mismo (para el almacén que no conserva el Content-Type: Supabase Storage puede guardar
 * el HTML como text/plain): PNG y JPEG por su firma, SVG si empieza por su etiqueta (o la declaración XML), JSON si se
 * lee, y si no, HTML. → uno de TIPOS.
 */
export function tipoPorContenido(bytes) {
  if (!contenidoDelTipo('image/png', bytes)) return 'image/png';
  if (!contenidoDelTipo('image/jpeg', bytes)) return 'image/jpeg';
  let texto = '';
  try { texto = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return 'application/octet-stream'; }
  const inicio = texto.replace(/^﻿/, '').trimStart();
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE svg[^>]*>\s*)?<svg[\s>]/i.test(inicio)) return 'image/svg+xml';
  if (/^[[{]/.test(inicio) && !contenidoDelTipo('application/json', bytes)) return 'application/json';
  return 'text/html';
}

/**
 * Construye el manejador. `almacen` ofrece, todas async:
 *   eje(nombre) → { clave_lectura_hash } | null      (la tabla `ejes` del libro compartido)
 *   guardar(eje, id, tipo, bytes) → { nuevo }        (idempotente: el mismo id, el mismo contenido)
 *   leer(eje, id) → { tipo, bytes } | null
 */
export function crearArchivos({ almacen, origenes = ORIGENES, limite = LIMITE_ARCHIVO, tipos = TIPOS, subidasPorMinuto = SUBIDAS_POR_MINUTO, ahora = () => new Date() }) {
  const ventanas = new Map();

  const cors = (request) => {
    const origen = request.headers.get('origin');
    const cabeceras = { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Clave-Lectura, Authorization', 'Access-Control-Max-Age': '86400' };
    if (origen && origenes.some((o) => (o instanceof RegExp ? o.test(origen) : o === origen))) {
      cabeceras['Access-Control-Allow-Origin'] = origen;
      cabeceras.Vary = 'Origin';
    }
    return cabeceras;
  };
  const json = (request, estado, cuerpo) => new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(request) } });
  const error = (request, estado, texto) => json(request, estado, { error: texto });

  async function abrirEje(request, nombre) {
    if (typeof nombre !== 'string' || !NOMBRE_EJE.test(nombre)) return { respuesta: error(request, 400, 'eje: nombre inválido') };
    const fila = await almacen.eje(nombre);
    // Eje inexistente y clave mala: la misma respuesta (401), para no revelar qué ejes existen (#106).
    const clave = request.headers.get('x-clave-lectura');
    const hash = clave ? await sha256(clave) : null;
    if (!fila || !hash || hash !== fila.clave_lectura_hash) return { respuesta: error(request, 401, 'clave de lectura ausente o incorrecta') };
    return { eje: fila };
  }

  function pasaElLimite(eje) {
    const minuto = Math.floor(ahora().getTime() / 60000);
    const v = ventanas.get(eje);
    if (!v || v.minuto !== minuto) {
      ventanas.set(eje, { minuto, n: 1 });
      return true;
    }
    v.n += 1;
    return v.n <= subidasPorMinuto;
  }

  async function subir(request, url) {
    const nombre = url.searchParams.get('eje') ?? '';
    const tipo = tipoDe(request.headers.get('content-type'));
    const declarado = Number(request.headers.get('content-length'));
    if (Number.isFinite(declarado) && declarado > limite) return error(request, 413, 'archivo demasiado grande (tope ' + limite + ' bytes)');
    const abierto = await abrirEje(request, nombre);
    if (abierto.respuesta) return abierto.respuesta;
    if (!tipos.includes(tipo)) return error(request, 415, 'tipo no admitido: ' + (tipo || '(ninguno)') + ' (admitidos: ' + tipos.join(', ') + ')');
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.length > limite) return error(request, 413, 'archivo demasiado grande (tope ' + limite + ' bytes)');
    if (!bytes.length) return error(request, 400, 'cuerpo vacío');
    const motivo = contenidoDelTipo(tipo, bytes);
    if (motivo) return error(request, 400, motivo + ' (' + tipo + ')');
    if (!pasaElLimite(nombre)) return error(request, 429, 'más de ' + subidasPorMinuto + ' subidas por minuto en el eje ' + nombre);
    const id = await sha256(bytes);
    const r = await almacen.guardar(nombre, id, tipo, bytes);
    return json(request, r.nuevo ? 201 : 200, { id, tipo, bytes: bytes.length });
  }

  async function bajar(request, url, id) {
    if (!RE_ID.test(id)) return error(request, 400, 'id: el SHA-256 del archivo, 64 caracteres hexadecimales');
    const nombre = url.searchParams.get('eje') ?? '';
    const abierto = await abrirEje(request, nombre);
    if (abierto.respuesta) return abierto.respuesta;
    const a = await almacen.leer(nombre, id);
    if (!a) return error(request, 404, 'archivo desconocido: ' + id);
    const tipo = tipos.includes(a.tipo) ? a.tipo : tipoPorContenido(a.bytes);
    return new Response(a.bytes, {
      status: 200,
      headers: {
        'Content-Type': tipo + (tipo.startsWith('text/') || tipo.endsWith('+xml') || tipo.endsWith('/json') ? '; charset=utf-8' : ''),
        'Content-Length': String(a.bytes.length),
        'Content-Disposition': 'inline',
        'Content-Security-Policy': POLITICA,
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Cache-Control': 'private, max-age=31536000, immutable', // el id es el hash del contenido: no cambia nunca
        ...cors(request),
      },
    });
  }

  return async function manejar(request) {
    const url = new URL(request.url);
    const camino = url.pathname.replace(/\/+$/, '');
    // …/archivos (subir) o …/archivos/<id> (bajar), con cualquier prefijo (/functions/v1/archivos en Supabase).
    const m = /\/archivos(?:\/([^/]+))?$/.exec(camino);
    try {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(request) });
      if (!m) return error(request, 404, 'ruta desconocida');
      if (m[1] === undefined) return request.method === 'POST' ? await subir(request, url) : error(request, 405, 'solo POST en /archivos');
      return request.method === 'GET' ? await bajar(request, url, m[1]) : error(request, 405, 'solo GET en /archivos/<id>');
    } catch (e) {
      return error(request, 500, 'error del servidor: ' + (e?.message ?? String(e)));
    }
  };
}
