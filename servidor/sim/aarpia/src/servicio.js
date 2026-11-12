// El servicio HTTP fino: la MISMA API que la función `eventos` de AGRAM
// (servidor/supabase/funciones/eventos/api.js, la de AGRAM, importada sin tocar), con el almacén cambiado:
// en vez de Postgres, el relé Nostr (en memoria aquí; uno real mañana).
//
//   POST /eventos/ejes · POST /eventos · GET /eventos?eje&desde&cuantos   → idénticos a AGRAM
//   GET  /eventos/recibo?eje=…&id=<id AGRAM>                            → el reloj X.6.8.1 (nuevo, no rompe nada)
//        errores con { error, codigo }: 404 eje-desconocido · 404 sin-recibo · 401 clave · 405 metodo (los textos no cambian)
//
// Diferencias con la función de Supabase, todas internas:
//   - `recibido` es el instante del recibo 7701 que firma el relé (no la hora de Postgres);
//   - cada evento se publica como 7700 firmado con la CLAVE DE TRANSPORTE del servicio
//     (la carta no manda su clave privada; cuando publique ella misma, firmará el autor: contrato §1);
//   - `orden` es el orden de llegada al relé dentro del eje.

import { crearApi, hashDeClave } from '../../../supabase/funciones/eventos/api.js';
import * as verificar from '../../../supabase/funciones/eventos/verificar.js';
import { Rele, relojDeRecibo } from './rele.js';
import { envolver, desenvolver } from './sobre.js';
import { generarClaves } from './nostr.js';
import { crearArchivos } from '../../../supabase/funciones/archivos/api.js';
import { crearBlossom } from './blossom.js';
import { almacenArchivos } from './archivos.js';

/**
 * El almacén que espera api.js, sobre un relé. Los ejes (nombre y hash de la
 * clave de lectura) viven aquí: un relé no sabe de ejes; solo los etiqueta (h).
 */
export function almacenRele({ rele, privadaTransporte, ahora = () => new Date() }) {
  const ejes = new Map(); // nombre → { eje, clave_lectura_hash, creado }
  const indices = new Map(); // eje → [{ orden, id, nostr, recibido }] por llegada
  const lista = (eje) => indices.get(eje) ?? [];
  const eventoDe = (fila) => desenvolver(rele.consultar({ ids: [fila.nostr] })[0]);

  const almacen = {
    async crearEje(eje, claveHash) {
      if (ejes.has(eje)) return null;
      const fila = { eje, clave_lectura_hash: claveHash, creado: ahora().toISOString() };
      ejes.set(eje, fila);
      indices.set(eje, []);
      return { creado: fila.creado };
    },
    async eje(eje) {
      return ejes.has(eje) ? { ...ejes.get(eje) } : null;
    },
    async vacio(eje) {
      return lista(eje).length === 0;
    },
    async claveDe(eje, autor) {
      // El alta: el primer evento del eje que declara la clave del autor en contexto.claves.
      for (const fila of lista(eje)) {
        const ev = eventoDe(fila);
        if (Object.hasOwn(ev?.contexto?.claves ?? {}, autor)) return ev.contexto.claves[autor];
      }
      return undefined;
    },
    async obtener(eje, id) {
      const f = lista(eje).find((x) => x.id === id);
      return f ? { orden: f.orden, recibido: f.recibido } : null;
    },
    async insertar(eje, { id, cuerpo }) {
      if (lista(eje).some((x) => x.id === id)) return null;
      const sobre = await envolver({ evento: cuerpo, eje, privada: privadaTransporte, claveDe: (n) => almacen.claveDe(eje, n), ahora: ahora() });
      const r = await rele.publicar(sobre);
      if (!r.ok) throw new Error('el relé no aceptó el evento: ' + r.motivo);
      const fila = { orden: lista(eje).length + 1, id, nostr: sobre.id, recibido: relojDeRecibo(r.recibo).instante };
      indices.get(eje).push(fila);
      return { orden: fila.orden, recibido: fila.recibido };
    },
    async listar(eje, desde, cuantos) {
      return lista(eje).filter((f) => f.orden > desde).slice(0, cuantos).map((f) => ({ orden: f.orden, recibido: f.recibido, cuerpo: eventoDe(f) }));
    },
    /** El reloj X.6.8.1 de un evento AGRAM del eje, o null. */
    async recibo(eje, id) {
      const f = lista(eje).find((x) => x.id === id);
      const recibo = f && rele.reciboDe(f.nostr);
      return recibo ? relojDeRecibo(recibo) : null;
    },
  };
  return almacen;
}

/**
 * El manejador (Request) → Response. Devuelve { manejar, rele, almacen, transporte }.
 * `crearEjes` como en AGRAM: { secreto } (cabecera X-Crear-Ejes) o { servicio } (Bearer).
 */
export function crearServicio({ rele = new Rele(), privadaTransporte = generarClaves().privada, crearEjes = { secreto: 'prueba' }, ahora = () => new Date(), blossom = crearBlossom({ ahora }), ...opciones } = {}) {
  const almacen = almacenRele({ rele, privadaTransporte, ahora });
  const api = crearApi({ almacen, cripto: verificar, crearEjes, ahora, ...opciones });
  const archivos = almacenArchivos({ blossom, privadaTransporte, eje: (n) => almacen.eje(n), ahora });
  const apiArchivos = crearArchivos({ almacen: archivos, ahora });

  async function manejar(request) {
    const url = new URL(request.url);
    // La función `archivos` de AGRAM: …/archivos y …/archivos/<id>.
    if (/\/archivos(\/[^/]+)?\/?$/.test(url.pathname)) return apiArchivos(request);
    // El Blossom mismo, para verlo desde fuera: /blossom/<sha256>, /blossom/upload.
    if (url.pathname.startsWith('/blossom/')) {
      const dentro = new URL(url);
      dentro.pathname = url.pathname.slice('/blossom'.length);
      return blossom(new Request(dentro, request));
    }
    if (url.pathname.replace(/\/+$/, '').endsWith('/recibo') && request.method !== 'OPTIONS') {
      const responder = (estado, cuerpo) => new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
      if (request.method !== 'GET') return responder(405, { error: 'solo GET', codigo: 'metodo' });
      // La misma autorización que GET /eventos: la clave de lectura del eje.
      const nombre = url.searchParams.get('eje') ?? '';
      const fila = await almacen.eje(nombre);
      if (!fila) return responder(404, { error: 'eje desconocido: ' + nombre, codigo: 'eje-desconocido' });
      const clave = request.headers.get('x-clave-lectura');
      if (!clave || (await hashDeClave(clave)) !== fila.clave_lectura_hash) return responder(401, { error: 'clave de lectura ausente o incorrecta', codigo: 'clave' });
      const reloj = await almacen.recibo(nombre, url.searchParams.get('id') ?? '');
      return reloj ? responder(200, reloj) : responder(404, { error: 'sin recibo para ese id en ese eje', codigo: 'sin-recibo' });
    }
    return api(request);
  }
  return { manejar, rele, almacen, archivos, blossom, transporte: privadaTransporte };
}
