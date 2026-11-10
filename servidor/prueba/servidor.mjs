// El servidor de prueba del libro compartido: el MISMO contrato que la función
// de Supabase (servidor/supabase/funciones/eventos/api.js, que se importa tal
// cual) servido con node:http, sin dependencias, sobre un almacén en memoria
// que puede volcarse a un archivo JSON. Sirve para las pruebas
// (test/sincronia.test.js, test/servidor-prueba.test.js) y para desarrollar la
// carta sin Supabase.
//
//   node servidor/prueba/servidor.mjs [--puerto 8787] [--archivo eje.json] [--secreto prueba]
//
// Diferencias con la función de Deno: ninguna de contrato. Cambian el almacén
// (memoria o un JSON, en vez de PostgREST), la criptografía (el núcleo,
// src/evento.js y src/autoridad.js, en vez de la reimplementación de
// verificar.js: test/paridad-funcion.test.js las compara) y que aquí POST /ejes
// se autoriza con --secreto (X-Crear-Ejes) o AGRAM_CREAR_EJES, no con una
// clave de servicio. El servidor también responde en /ejes, además de en
// /eventos/ejes, para probarlo a mano.

import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { crearApi } from '../supabase/funciones/eventos/api.js';
import * as criptoNucleo from './cripto-nucleo.mjs';
import { crearGuia } from '../supabase/funciones/guia/api.js';

/** El «proveedor» de la guía en la prueba: un eco fijo (nada sale de la máquina): la pregunta y las primeras líneas del contexto. */
export const ecoDeLaGuia = async ({ mensajes, contexto, modelo }) => {
  const pregunta = mensajes[mensajes.length - 1].content;
  const lineas = contexto.split('\n').slice(0, 3).join('\n');
  return { texto: '(guía de prueba) ' + pregunta + ' [' + modelo + ']\n' + lineas, uso: { entrada: contexto.length, salida: 0 } };
};

/**
 * El almacén en memoria (api.js dice qué ofrece cada método). `archivo`
 * (opcional) lo carga al empezar y lo vuelca tras cada escritura. `ahora` da
 * el reloj del servidor.
 */
export function almacenEnMemoria({ archivo, ahora = () => new Date() } = {}) {
  let datos = { ejes: {}, eventos: {}, siguienteOrden: 1 };
  if (archivo) {
    try {
      datos = JSON.parse(readFileSync(archivo, 'utf8'));
    } catch {
      /* archivo nuevo */
    }
  }
  const volcar = () => {
    if (archivo) writeFileSync(archivo, JSON.stringify(datos));
  };
  const lista = (eje) => datos.eventos[eje] ?? [];
  return {
    async crearEje(eje, claveHash) {
      if (datos.ejes[eje]) return null;
      datos.ejes[eje] = { eje, clave_lectura_hash: claveHash, creado: ahora().toISOString() };
      datos.eventos[eje] = [];
      volcar();
      return { creado: datos.ejes[eje].creado };
    },
    async eje(eje) {
      return datos.ejes[eje] ? { ...datos.ejes[eje] } : null;
    },
    async vacio(eje) {
      return lista(eje).length === 0;
    },
    async claveDe(eje, autor) {
      const alta = lista(eje).find((f) => Object.hasOwn(f.cuerpo?.contexto?.claves ?? {}, autor));
      return alta?.cuerpo.contexto.claves[autor];
    },
    async obtener(eje, id) {
      const f = lista(eje).find((x) => x.id === id);
      return f ? { orden: f.orden, recibido: f.recibido } : null;
    },
    async insertar(eje, { id, autor, firma, cuerpo }) {
      if (lista(eje).some((x) => x.id === id)) return null;
      const fila = { eje, id, orden: datos.siguienteOrden++, recibido: ahora().toISOString(), autor, firma, cuerpo };
      datos.eventos[eje].push(fila);
      volcar();
      return { orden: fila.orden, recibido: fila.recibido };
    },
    async listar(eje, desde, cuantos) {
      return lista(eje).filter((f) => f.orden > desde).slice(0, cuantos).map((f) => ({ orden: f.orden, recibido: f.recibido, cuerpo: f.cuerpo }));
    },
    /** Solo para las pruebas: las filas de un eje, por llegada. */
    filas(eje) {
      return lista(eje).map((f) => ({ ...f }));
    },
  };
}

/** Pasa una petición de node:http a una Request de la API Fetch. */
async function aRequest(req, base) {
  const trozos = [];
  for await (const t of req) trozos.push(t);
  const cuerpo = Buffer.concat(trozos);
  const cabeceras = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') cabeceras.set(k, v);
  return new Request(base + req.url, { method: req.method, headers: cabeceras, body: req.method === 'GET' || req.method === 'HEAD' ? undefined : cuerpo });
}

/**
 * Arranca el servidor en `puerto` (0: uno libre). Devuelve { url, puerto, cerrar, almacen, manejar }. `secreto`
 * autoriza POST /ejes (X-Crear-Ejes); `archivo` persiste el almacén; `ahora` es el reloj del servidor.
 */
export async function arrancar({ puerto = 0, archivo, secreto = process.env.AGRAM_CREAR_EJES ?? 'prueba', ahora = () => new Date(), ...opciones } = {}) {
  const almacen = almacenEnMemoria({ archivo, ahora });
  const manejarEjes = crearApi({ almacen, cripto: criptoNucleo, crearEjes: { secreto }, ahora, ...opciones });
  const manejarGuia = crearGuia({ almacen, llamar: ecoDeLaGuia, ahora, ...(opciones.preguntasPorMinuto ? { preguntasPorMinuto: opciones.preguntasPorMinuto } : {}) });
  // /guia (la función `guia` de Supabase) responde con el eco; todo lo demás, el libro compartido.
  const manejar = (request) => (new URL(request.url).pathname.replace(/\/+$/, '').endsWith('/guia') ? manejarGuia(request) : manejarEjes(request));
  const servidor = createServer(async (req, res) => {
    const base = 'http://' + (req.headers.host ?? 'localhost');
    const respuesta = await manejar(await aRequest(req, base));
    res.writeHead(respuesta.status, Object.fromEntries(respuesta.headers.entries()));
    res.end(respuesta.status === 204 ? undefined : Buffer.from(await respuesta.arrayBuffer()));
  });
  await new Promise((resolver) => servidor.listen(puerto, '127.0.0.1', resolver));
  const p = servidor.address().port;
  return {
    url: 'http://127.0.0.1:' + p,
    puerto: p,
    almacen,
    manejar,
    cerrar: () => new Promise((resolver) => servidor.close(resolver)),
  };
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1].replace(/\\/g, '/').replace(/^([A-Za-z]):/, '/$1:')).href) {
  const arg = (nombre, defecto) => {
    const i = process.argv.indexOf('--' + nombre);
    return i > 0 ? process.argv[i + 1] : defecto;
  };
  const { url } = await arrancar({ puerto: Number(arg('puerto', 8787)), archivo: arg('archivo'), secreto: arg('secreto', process.env.AGRAM_CREAR_EJES ?? 'prueba') });
  console.log('libro compartido de prueba en ' + url + ' (POST /ejes con X-Crear-Ejes, POST y GET /eventos)');
}
