// Función de borde de Supabase (Deno) de los archivos adjuntos: sirve el contrato de api.js sobre un bucket PRIVADO de
// Supabase Storage (`agram-archivos`, migraciones/0002_archivos.sql) y la tabla `ejes` del libro compartido (la clave
// de lectura), por fetch a las APIs REST de Storage y PostgREST con el rol de servicio. Sin dependencias (ni
// supabase-js ni la std de Deno). Nada de secretos aquí: todo por Deno.env.
//
// Variables de entorno (las inyecta Supabase en toda función):
//   SUPABASE_URL                la URL del proyecto (https://<ref>.supabase.co)
//   SUPABASE_SERVICE_ROLE_KEY   la clave de servicio: lee `ejes` y lee y escribe el bucket (que no tiene políticas
//                               para anon ni authenticated: solo esta función llega a él)
//
// Desplegar con --no-verify-jwt (la función lleva su propia autorización: la clave de lectura del eje, la misma del
// libro compartido). Cómo desplegarla: servidor/LEEME.md, «Los archivos adjuntos».

// deno-lint-ignore-file no-explicit-any
import { crearArchivos, BUCKET } from './api.js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!SUPABASE_URL || !SERVICIO) throw new Error('faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno de la función');

const BASE = SUPABASE_URL.replace(/\/+$/, '');
const AUTORIZACION = { apikey: SERVICIO, Authorization: 'Bearer ' + SERVICIO };
/** La ruta de un archivo dentro del bucket: <eje>/<sha256> (el eje ya validado por NOMBRE_EJE, el id por RE_ID). */
const objeto = (eje: string, id: string) => BASE + '/storage/v1/object/' + BUCKET + '/' + encodeURIComponent(eje) + '/' + id;

const almacen = {
  async eje(eje: string) {
    const q = new URLSearchParams({ select: 'eje,clave_lectura_hash', eje: 'eq.' + eje, limit: '1' });
    const r = await fetch(BASE + '/rest/v1/ejes?' + q.toString(), { headers: AUTORIZACION });
    if (!r.ok) throw new Error('PostgREST ' + r.status + ' al leer ejes');
    const [fila] = (await r.json()) as Record<string, any>[];
    return fila ? { eje: fila.eje, clave_lectura_hash: fila.clave_lectura_hash } : null;
  },
  /** Sube sin sobrescribir (x-upsert: false): si ya está, es el mismo contenido (el nombre es su hash). */
  async guardar(eje: string, id: string, tipo: string, bytes: Uint8Array) {
    const r = await fetch(objeto(eje, id), { method: 'POST', headers: { ...AUTORIZACION, 'Content-Type': tipo, 'x-upsert': 'false', 'Cache-Control': 'max-age=31536000' }, body: bytes });
    if (r.ok) return { nuevo: true };
    const texto = await r.text();
    // Storage responde 400 o 409 con «Duplicate» / «already exists» si el objeto ya estaba.
    if (r.status === 409 || /duplicate|already exists/i.test(texto)) return { nuevo: false };
    throw new Error('Storage ' + r.status + ' al subir: ' + texto);
  },
  async leer(eje: string, id: string) {
    const r = await fetch(objeto(eje, id), { headers: AUTORIZACION });
    if (r.status === 400 || r.status === 404) return null;
    if (!r.ok) throw new Error('Storage ' + r.status + ' al leer: ' + (await r.text()));
    return { tipo: (r.headers.get('content-type') ?? '').split(';')[0].trim(), bytes: new Uint8Array(await r.arrayBuffer()) };
  },
};

Deno.serve(crearArchivos({ almacen }));
