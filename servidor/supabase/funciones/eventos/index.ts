// Función de borde de Supabase (Deno) del libro compartido: sirve el contrato
// de api.js sobre las tablas de migraciones/0001_eventos.sql a través de la
// API REST de PostgREST, con fetch y el rol de servicio. Sin dependencias:
// ni supabase-js ni la std de Deno. Nada de secretos aquí: todo por Deno.env.
//
// Variables de entorno (las dos primeras las inyecta Supabase en toda función):
//   SUPABASE_URL                la URL del proyecto (https://<ref>.supabase.co)
//   SUPABASE_SERVICE_ROLE_KEY   la clave de servicio: con ella la función lee y escribe las tablas (RLS no la frena);
//                               también autoriza POST /ejes como `Authorization: Bearer <clave de servicio>`
//   AGRAM_CREAR_EJES            (opcional) un secreto propio para POST /ejes como cabecera X-Crear-Ejes, para no
//                               manejar la clave de servicio desde fuera; si no está, solo vale la de servicio
//
// Desplegar con --no-verify-jwt: la función lleva su propia autorización (la
// clave de lectura del eje y las firmas de los eventos), y así la carta no
// necesita la clave anónima. Cómo probarla a mano: LEEME.md en esta carpeta.

// deno-lint-ignore-file no-explicit-any
import { crearApi } from './api.js';

type Fila = Record<string, any>;

/** El almacén sobre PostgREST (api.js dice qué ofrece cada método). */
function almacenPostgrest(url: string, servicio: string) {
  const base = url.replace(/\/+$/, '') + '/rest/v1/';
  const cabeceras = { apikey: servicio, Authorization: 'Bearer ' + servicio, 'Content-Type': 'application/json' };

  async function consultar(tabla: string, parametros: Record<string, string>): Promise<Fila[]> {
    const q = new URLSearchParams(parametros);
    const r = await fetch(base + tabla + '?' + q.toString(), { headers: cabeceras });
    if (!r.ok) throw new Error('PostgREST ' + r.status + ' al leer ' + tabla + ': ' + (await r.text()));
    return (await r.json()) as Fila[];
  }

  /** Inserta y devuelve la fila; null si chocó con la clave primaria (duplicado). */
  async function insertar(tabla: string, fila: Fila): Promise<Fila | null> {
    const r = await fetch(base + tabla, { method: 'POST', headers: { ...cabeceras, Prefer: 'return=representation' }, body: JSON.stringify(fila) });
    if (r.status === 409) return null;
    if (!r.ok) throw new Error('PostgREST ' + r.status + ' al insertar en ' + tabla + ': ' + (await r.text()));
    const filas = (await r.json()) as Fila[];
    return filas[0] ?? null;
  }

  const iso = (x: string) => new Date(x).toISOString();
  const eq = (x: string) => 'eq.' + x;

  return {
    async crearEje(eje: string, claveHash: string) {
      const fila = await insertar('ejes', { eje, clave_lectura_hash: claveHash });
      return fila ? { creado: iso(fila.creado) } : null;
    },
    async eje(eje: string) {
      const [fila] = await consultar('ejes', { select: 'eje,clave_lectura_hash,creado', eje: eq(eje), limit: '1' });
      return fila ? { eje: fila.eje, clave_lectura_hash: fila.clave_lectura_hash, creado: iso(fila.creado) } : null;
    },
    async vacio(eje: string) {
      const filas = await consultar('eventos', { select: 'orden', eje: eq(eje), limit: '1' });
      return filas.length === 0;
    },
    async claveDe(eje: string, autor: string) {
      // El alta del autor: el primer evento del eje cuyo contexto.claves declara su clave (contención jsonb).
      const contiene = JSON.stringify({ contexto: { claves: { [autor]: {} } } });
      const [fila] = await consultar('eventos', { select: 'cuerpo', eje: eq(eje), cuerpo: 'cs.' + contiene, order: 'orden.asc', limit: '1' });
      return fila?.cuerpo?.contexto?.claves?.[autor];
    },
    async obtener(eje: string, id: string) {
      const [fila] = await consultar('eventos', { select: 'orden,recibido', eje: eq(eje), id: eq(id), limit: '1' });
      return fila ? { orden: Number(fila.orden), recibido: iso(fila.recibido) } : null;
    },
    async insertar(eje: string, { id, autor, firma, cuerpo }: Fila) {
      const fila = await insertar('eventos', { eje, id, autor, firma, cuerpo });
      return fila ? { orden: Number(fila.orden), recibido: iso(fila.recibido) } : null;
    },
    async listar(eje: string, desde: number, cuantos: number) {
      const filas = await consultar('eventos', { select: 'orden,recibido,cuerpo', eje: eq(eje), orden: 'gt.' + desde, order: 'orden.asc', limit: String(cuantos) });
      return filas.map((f) => ({ orden: Number(f.orden), recibido: iso(f.recibido), cuerpo: f.cuerpo }));
    },
  };
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!SUPABASE_URL || !SERVICIO) throw new Error('faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno de la función');

const manejar = crearApi({
  almacen: almacenPostgrest(SUPABASE_URL, SERVICIO),
  crearEjes: { servicio: SERVICIO, secreto: Deno.env.get('AGRAM_CREAR_EJES') },
});

Deno.serve(manejar);
