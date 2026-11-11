// Los archivos adjuntos en la carta (issues #21, #22; docs/CONTRATO.md §2.1): subir uno a la función `archivos` del
// libro compartido, bajarlo con la clave de lectura que la carta ya tiene, y lo de esta pestaña (lo bajado y lo que
// espera a subirse). Sin DOM, para probarlo con el servidor de prueba (test/archivos.test.js).
//
// El registro guarda solo la referencia `archivo:<sha256>` (modelos.referenciaDeArchivo). El id se calcula AQUÍ antes
// de subir (el mismo SHA-256 que calcula el servidor), así que la transacción se puede escribir aunque no haya red: el
// archivo se queda en esta pestaña y se sube en la siguiente sincronización (como la cola de eventos de sincronia.js);
// si la pestaña se cierra antes, se pierde y el registro apunta a un archivo que no está (se pinta «no disponible»).
// Sin servidor (un ejemplo, o una cuenta sin `sync url`, `sync ledger` o clave de lectura) no cabe encolarlo: se rechaza.
//
//   tipoDeArchivo(nombre, tipo)            → el tipo admitido (por su tipo o su extensión) o null
//   formatoDeTipo(tipo, opciones)          → el formato de la época (epoch.9.5.1) con que se representa, o null
//   new Archivos({ destino, fetch, alCambiar })
//     .preparar({ nombre, tipo, bytes })   → { id, tipo, bytes, referencia } (o lanza con el motivo)
//     .adjuntar(archivo)                   → { id, tipo, referencia, subido, sinRed } (o lanza): prepara, guarda y sube
//     .subirPendientes()                   → cuántos quedan por subir
//     .contenido(id)                       → lo que hay de un archivo en esta pestaña: { estado, tipo, texto?, url? }

import * as contrato from '../src/contrato.js';
import { referenciaDeArchivo } from '../src/modelos.js';
import { t } from './textos.js';

/** Tope de un archivo (el de la función). */
export const LIMITE = 2 * 1024 * 1024;
/** Tope de lo que la carta pinta como HTML en el iframe (srcdoc). */
export const LIMITE_HTML = 1024 * 1024;
/**
 * Los tipos que admite la función y el formato de la época (epoch.9.5.1) con que se representa cada uno: el contrato
 * de la función (servidor/supabase/funciones/archivos/api.js, TIPOS), no un dato del dominio. La palabra del formato
 * solo vale si la época la tiene (formatoDeTipo).
 */
export const TIPOS = Object.freeze({ 'text/html': 'html', 'image/png': 'image', 'image/jpeg': 'image', 'image/svg+xml': 'svg', 'application/json': 'lottie' });
const POR_EXTENSION = Object.freeze({ html: 'text/html', htm: 'text/html', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml', json: 'application/json' });

/** El tipo admitido de un archivo: el que dice el navegador si es uno de TIPOS, si no el de su extensión; null si no se admite. */
export function tipoDeArchivo(nombre, tipo) {
  const dicho = String(tipo ?? '').split(';')[0].trim().toLowerCase();
  if (Object.hasOwn(TIPOS, dicho)) return dicho;
  const ext = /\.([a-z0-9]+)$/i.exec(String(nombre ?? ''))?.[1]?.toLowerCase();
  return ext && Object.hasOwn(POR_EXTENSION, ext) ? POR_EXTENSION[ext] : null;
}

/** El formato de la época para un tipo admitido, si la época lo tiene entre los formatos de las representaciones. */
export function formatoDeTipo(tipo, opciones = {}) {
  const f = TIPOS[tipo];
  return f && contrato.formatos(opciones).includes(f) ? f : null;
}

/** Tras un fallo al bajar un archivo (sin red, el servidor), cuándo se vuelve a pedir. */
const REINTENTO_MS = 30 * 1000;

const hex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
/** SHA-256 en hexadecimal de unos bytes (el id del archivo, el mismo que calcula la función). */
export async function sha256(bytes) {
  return hex(await globalThis.crypto.subtle.digest('SHA-256', bytes));
}

/** Lo que espera la función: la base (`sync url`) sin barra final. */
const base = (url) => String(url).replace(/\/+$/, '');

/**
 * Los archivos de esta pestaña. `destino()` → { url, eje, claveLectura } o null (sin servidor no se sube ni se baja);
 * `alCambiar()` se llama cuando llega un archivo pedido (la app repinta).
 */
export class Archivos {
  constructor({ destino = () => null, fetch = globalThis.fetch?.bind(globalThis), alCambiar = () => {} } = {}) {
    this.destino = destino;
    this.fetch = fetch;
    this.alCambiar = alCambiar;
    this.cache = new Map(); // id → { estado: 'listo' | 'cargando' | 'falta' | 'error', tipo, bytes, texto, url, motivo }
    this.pendientes = new Map(); // id → { tipo, bytes }: lo adjuntado sin red, por subir
  }

  /** Lee y comprueba un archivo ({ nombre, tipo, bytes } o un File del navegador) y calcula su id. Lanza con el motivo si no vale. */
  async preparar(archivo) {
    const nombre = archivo?.name ?? archivo?.nombre ?? '';
    const tipo = tipoDeArchivo(nombre, archivo?.type ?? archivo?.tipo);
    if (!tipo) throw new Error(t('archivoTipoNo', { nombre, tipos: Object.keys(TIPOS).join(', ') }));
    // { bytes } (Node, las pruebas) o un File del navegador (que también tiene un método bytes(): no es lo mismo)
    const bytes = ArrayBuffer.isView(archivo?.bytes) || archivo?.bytes instanceof ArrayBuffer ? new Uint8Array(archivo.bytes) : new Uint8Array(await archivo.arrayBuffer());
    if (!bytes.length) throw new Error(t('archivoVacio', { nombre }));
    if (bytes.length > LIMITE) throw new Error(t('archivoGrande', { nombre, tope: Math.round(LIMITE / 1024 / 1024) }));
    const id = await sha256(bytes);
    return { id, tipo, bytes, referencia: referenciaDeArchivo(id) };
  }

  /** Lo que hay de un archivo ya leído (lo que se pinta): el texto del HTML (si cabe) o una URL local de la imagen. */
  listo(id, tipo, bytes) {
    const e = { estado: 'listo', tipo, bytes };
    if (tipo === 'text/html') {
      if (bytes.length > LIMITE_HTML) Object.assign(e, { estado: 'error', motivo: t('archivoHtmlGrande', { tope: Math.round(LIMITE_HTML / 1024) }) });
      else e.texto = new TextDecoder('utf-8').decode(bytes);
    } else if (tipo === 'image/svg+xml') {
      // Un SVG en <img> no ejecuta nada, pero una URL blob es del MISMO ORIGEN que la carta: abierta directamente
      // (clic derecho, arrastrar a la barra) ejecutaría sus scripts con acceso al almacén local (la clave de lectura,
      // las claves de la cuenta). Un data: URL es de origen opaco al navegarlo: solo sirve para <img> (SEG-15).
      e.url = 'data:image/svg+xml;base64,' + aBase64(bytes);
    } else if (Object.hasOwn(TIPOS, tipo) && typeof URL.createObjectURL === 'function') {
      // una imagen de píxeles o una animación Lottie (su JSON, para lottie-web): una URL local; ninguna de las dos ejecuta nada al navegarla
      e.url = URL.createObjectURL(new Blob([bytes], { type: tipo }));
    }
    this.cache.set(id, e);
    return e;
  }

  /**
   * Adjunta: prepara, lo deja en esta pestaña y lo sube. Sin servidor, lanza (no cabe encolarlo); si el servidor lo
   * rechaza (clave, tipo, tamaño), lanza con su motivo; sin red, queda pendiente (`sinRed`) y se sube después.
   */
  async adjuntar(archivo) {
    const d = this.destino();
    if (!d) throw new Error(t('archivoSinServidor'));
    const p = await this.preparar(archivo);
    const r = await this.subir(p.id, p.tipo, p.bytes, d);
    if (r.motivo) throw new Error(r.motivo);
    this.listo(p.id, p.tipo, p.bytes);
    if (r.sinRed) this.pendientes.set(p.id, { tipo: p.tipo, bytes: p.bytes });
    return { id: p.id, tipo: p.tipo, referencia: p.referencia, subido: !r.sinRed, sinRed: Boolean(r.sinRed) };
  }

  /** Sube unos bytes. → { ok } | { sinRed } | { motivo } (el error del servidor tal cual). */
  async subir(id, tipo, bytes, d = this.destino()) {
    if (!d) return { sinRed: true };
    let r;
    try {
      r = await this.fetch(base(d.url) + '/archivos?eje=' + encodeURIComponent(d.eje), { method: 'POST', headers: { 'Content-Type': tipo, 'X-Clave-Lectura': d.claveLectura }, body: bytes });
    } catch {
      return { sinRed: true };
    }
    const cuerpo = await r.json().catch(() => ({}));
    if (!r.ok) return { motivo: t('archivoRechazado', { estado: r.status, motivo: cuerpo.error ?? '' }) };
    if (cuerpo.id !== id) return { motivo: t('archivoOtroId') };
    return { ok: true };
  }

  /** Sube lo que quedó pendiente (lo llama la sincronización). → cuántos quedan. */
  async subirPendientes() {
    for (const [id, { tipo, bytes }] of [...this.pendientes]) {
      const r = await this.subir(id, tipo, bytes);
      if (r.sinRed) break;
      this.pendientes.delete(id); // subido, o rechazado por el servidor (no se reintenta un rechazo)
    }
    return this.pendientes.size;
  }

  /**
   * Lo que hay de un archivo en esta pestaña; si no está, lo pide (una vez) y, al llegar, llama a alCambiar. → la entrada
   * de la caché ({ estado, tipo, texto?, url?, motivo? }); sin servidor y sin tenerlo, { estado: 'falta' }.
   */
  contenido(id) {
    const e = this.cache.get(id);
    if (e && !(e.estado === 'error' && e.reintentar && Date.now() >= e.reintentar)) return e;
    const d = this.destino();
    if (!d) return { estado: 'falta' };
    const cargando = { estado: 'cargando' };
    this.cache.set(id, cargando);
    void this.bajar(id, d).then(() => this.alCambiar());
    return cargando;
  }

  async bajar(id, d = this.destino()) {
    try {
      const r = await this.fetch(base(d.url) + '/archivos/' + id + '?eje=' + encodeURIComponent(d.eje), { headers: { 'X-Clave-Lectura': d.claveLectura } });
      if (!r.ok) {
        // 404: no está (se pinta «no disponible»); otro fallo del servidor, se vuelve a pedir pasado un rato.
        const motivo = (await r.json().catch(() => ({}))).error ?? 'HTTP ' + r.status;
        this.cache.set(id, r.status === 404 ? { estado: 'falta' } : { estado: 'error', motivo, reintentar: Date.now() + REINTENTO_MS });
        return this.cache.get(id);
      }
      const tipo = (r.headers.get('content-type') ?? '').split(';')[0].trim();
      return this.listo(id, Object.hasOwn(TIPOS, tipo) ? tipo : 'application/octet-stream', new Uint8Array(await r.arrayBuffer()));
    } catch {
      this.cache.set(id, { estado: 'error', motivo: t('sinRed'), reintentar: Date.now() + REINTENTO_MS }); // sin red: se vuelve a pedir pasado un rato
      return this.cache.get(id);
    }
  }
}

/** Bytes → base64 (Node y navegador), para el data: URL de los SVG. */
function aBase64(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (typeof globalThis.Buffer === 'function') return globalThis.Buffer.from(b).toString('base64');
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
}
