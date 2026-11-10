// Función de borde de Supabase (Deno) de la guía del PV9: contesta preguntas sobre lo que hay en pantalla llamando a
// la API de mensajes de Anthropic. El contrato está en api.js (el mismo que sirve el servidor de prueba, con un eco).
// Sin dependencias. Nada de secretos aquí: todo por Deno.env.
//
// Variables de entorno (las dos primeras las inyecta Supabase en toda función):
//   SUPABASE_URL                la URL del proyecto (https://<ref>.supabase.co)
//   SUPABASE_SERVICE_ROLE_KEY   la clave de servicio: con ella la función lee la tabla `ejes` (la clave de lectura)
//   ANTHROPIC_API_KEY           la clave de la API de Anthropic: `supabase secrets set ANTHROPIC_API_KEY=…`
//
// Desplegar con --no-verify-jwt (la función lleva su propia autorización: la clave de lectura del eje, la misma del
// libro compartido). Cómo desplegarla: servidor/LEEME.md.

// deno-lint-ignore-file no-explicit-any
import { crearGuia, llamarAAnthropic } from './api.js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const ANTHROPIC = Deno.env.get('ANTHROPIC_API_KEY');
if (!SUPABASE_URL || !SERVICIO) throw new Error('faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno de la función');
if (!ANTHROPIC) throw new Error('falta ANTHROPIC_API_KEY: supabase secrets set ANTHROPIC_API_KEY=…');

/** El almacén mínimo: la fila de `ejes` por PostgREST (la misma tabla que la función `eventos`). */
const almacen = {
  async eje(eje: string) {
    const q = new URLSearchParams({ select: 'eje,clave_lectura_hash', eje: 'eq.' + eje, limit: '1' });
    const r = await fetch(SUPABASE_URL!.replace(/\/+$/, '') + '/rest/v1/ejes?' + q.toString(), { headers: { apikey: SERVICIO!, Authorization: 'Bearer ' + SERVICIO } });
    if (!r.ok) throw new Error('PostgREST ' + r.status + ' al leer ejes');
    const [fila] = (await r.json()) as Record<string, any>[];
    return fila ? { eje: fila.eje, clave_lectura_hash: fila.clave_lectura_hash } : null;
  },
};

Deno.serve(crearGuia({ almacen, llamar: llamarAAnthropic({ clave: ANTHROPIC }) }));
