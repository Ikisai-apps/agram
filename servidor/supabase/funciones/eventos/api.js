// El contrato HTTP del libro compartido, como una función (Request) → Response
// de la API Fetch, igual en Deno (index.ts la sirve con Deno.serve sobre
// PostgREST) y en Node (servidor/prueba/servidor.mjs la sirve con node:http
// sobre un almacén en memoria). Sin dependencias. docs/CONTRATO.md, «El libro
// compartido».
//
//   POST {url}/ejes            crea un eje: { eje } → 201 { eje, claveLectura, creado }; la clave se devuelve UNA vez
//                              (solo se guarda su hash). Protegido: Authorization: Bearer <clave de servicio> o
//                              X-Crear-Ejes: <AGRAM_CREAR_EJES>. 409 si ya existe; 503 si no está habilitado.
//   POST {url}/eventos         { eje, evento } → 201 { orden, recibido } (200 y duplicado: true si ya estaba: idempotente).
//                              400 forma, id o firma; 403 autor sin alta en el eje; 404 eje; 401 sin clave de lectura;
//                              413 cuerpo > 256 KB; 429 más de 60 escrituras por minuto en el eje.
//   GET  {url}/eventos?eje=…&desde=<orden>&cuantos=<≤500>
//                              → { eventos: [{ orden, recibido, evento }], siguiente } con orden > desde, por llegada;
//                              siguiente es el desde de la página siguiente, o null si no hay más.
//   OPTIONS                    CORS: https://agram.ikisai.com y http://localhost:*.
//
// Las dos rutas cuelgan de la función `eventos` desplegada en Supabase
// (/functions/v1/eventos y /functions/v1/eventos/ejes); se reconocen por el
// final del camino, así que valen con cualquier prefijo.
//
// El almacén (`almacen`) es lo único que cambia entre el despliegue y la
// prueba: ejes y eventos como filas, con el orden de llegada y la hora del
// servidor. La criptografía (`cripto.comprobar`) es verificar.js en la función
// y el núcleo en el servidor de prueba (la paridad la comprueba
// test/paridad-funcion.test.js).

import * as verificar from './verificar.js';

/** Orígenes admitidos por CORS: la carta publicada y el desarrollo local. */
export const ORIGENES = Object.freeze(['https://agram.ikisai.com', /^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/]);
/** Tope del cuerpo de una petición, en bytes. */
export const LIMITE_CUERPO = 256 * 1024;
/** Escrituras admitidas por eje y minuto. */
export const ESCRITURAS_POR_MINUTO = 60;
/** Tope de eventos por página. */
export const PAGINA = 500;
/** Nombres de eje admitidos (los mismos que la tabla). */
export const NOMBRE_EJE = /^[a-z0-9][a-z0-9._-]{0,63}$/;

const aBase64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Una clave de lectura nueva: 32 bytes al azar en base64url. */
export function generarClaveLectura() {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return aBase64url(bytes);
}

/** El hash que se guarda de una clave de lectura (SHA-256 en hexadecimal). */
export const hashDeClave = (clave) => verificar.hash(clave);

/**
 * Construye el manejador. `almacen` ofrece, todas async:
 *   crearEje(eje, claveHash) → { creado } | null si ya existía
 *   eje(eje) → { eje, clave_lectura_hash, creado } | null
 *   vacio(eje) → boolean
 *   claveDe(eje, autor) → JWK | undefined (la declarada en el primer evento del eje que la lleva: el alta)
 *   obtener(eje, id) → { orden, recibido } | null
 *   insertar(eje, { id, autor, firma, cuerpo }) → { orden, recibido } | null si el id ya estaba
 *   listar(eje, desde, cuantos) → [{ orden, recibido, cuerpo }] con orden > desde, por orden
 * `crearEjes` es { servicio, secreto }: lo que autoriza POST /ejes (cualquiera de los dos; ninguno, deshabilitado).
 */
export function crearApi({ almacen, cripto = verificar, crearEjes = {}, origenes = ORIGENES, limiteCuerpo = LIMITE_CUERPO, escriturasPorMinuto = ESCRITURAS_POR_MINUTO, ahora = () => new Date() }) {
  const ventanas = new Map(); // eje → { minuto, n }: el contador simple en memoria de las escrituras

  const cors = (request) => {
    const origen = request.headers.get('origin');
    const cabeceras = { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Clave-Lectura, X-Crear-Ejes, Authorization', 'Access-Control-Max-Age': '86400' };
    if (origen && origenes.some((o) => (o instanceof RegExp ? o.test(origen) : o === origen))) {
      cabeceras['Access-Control-Allow-Origin'] = origen;
      cabeceras.Vary = 'Origin';
    }
    return cabeceras;
  };

  const json = (request, estado, cuerpo) => new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(request) } });
  const error = (request, estado, texto) => json(request, estado, { error: texto });

  async function leerCuerpo(request) {
    const declarado = Number(request.headers.get('content-length'));
    if (Number.isFinite(declarado) && declarado > limiteCuerpo) return { error: 413 };
    const texto = await request.text();
    if (new TextEncoder().encode(texto).length > limiteCuerpo) return { error: 413 };
    try {
      const datos = JSON.parse(texto);
      return datos && typeof datos === 'object' && !Array.isArray(datos) ? { datos } : { error: 400 };
    } catch {
      return { error: 400 };
    }
  }

  /** El eje y su clave de lectura: { eje } o { respuesta } con el error. */
  async function abrirEje(request, nombre) {
    if (typeof nombre !== 'string' || !NOMBRE_EJE.test(nombre)) return { respuesta: error(request, 400, 'eje: nombre inválido') };
    const fila = await almacen.eje(nombre);
    if (!fila) return { respuesta: error(request, 404, 'eje desconocido: ' + nombre) };
    const clave = request.headers.get('x-clave-lectura');
    if (!clave || (await hashDeClave(clave)) !== fila.clave_lectura_hash) return { respuesta: error(request, 401, 'clave de lectura ausente o incorrecta') };
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
    return v.n <= escriturasPorMinuto;
  }

  async function crearEje(request) {
    const auth = request.headers.get('authorization') ?? '';
    const portador = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    const secreto = request.headers.get('x-crear-ejes') ?? '';
    const { servicio, secreto: esperado } = crearEjes;
    if (!servicio && !esperado) return error(request, 503, 'crear ejes no está habilitado: falta AGRAM_CREAR_EJES o la clave de servicio');
    const autorizado = (servicio && portador === servicio) || (esperado && secreto === esperado);
    if (!autorizado) return error(request, 401, 'crear ejes exige la clave de servicio (Authorization: Bearer) o X-Crear-Ejes');
    const leido = await leerCuerpo(request);
    if (leido.error) return error(request, leido.error, leido.error === 413 ? 'cuerpo demasiado grande' : 'el cuerpo debe ser un objeto JSON');
    const nombre = leido.datos.eje;
    if (typeof nombre !== 'string' || !NOMBRE_EJE.test(nombre)) return error(request, 400, 'eje: nombre inválido (minúsculas, dígitos, punto, guion y guion bajo; hasta 64)');
    const claveLectura = generarClaveLectura();
    const creado = await almacen.crearEje(nombre, await hashDeClave(claveLectura));
    if (!creado) return error(request, 409, 'el eje ya existe: ' + nombre);
    return json(request, 201, { eje: nombre, claveLectura, creado: creado.creado });
  }

  async function subir(request) {
    const leido = await leerCuerpo(request);
    if (leido.error) return error(request, leido.error, leido.error === 413 ? 'cuerpo demasiado grande (tope ' + limiteCuerpo + ' bytes)' : 'el cuerpo debe ser un objeto JSON { eje, evento }');
    const { eje: nombre, evento } = leido.datos;
    const abierto = await abrirEje(request, nombre);
    if (abierto.respuesta) return abierto.respuesta;
    if (!pasaElLimite(nombre)) return error(request, 429, 'más de ' + escriturasPorMinuto + ' escrituras por minuto en el eje ' + nombre);
    // Idempotente: el mismo id (ya verificado cuando entró) devuelve su orden sin volver a comprobar nada.
    const previo = evento && verificar.esHash(evento.id) ? await almacen.obtener(nombre, evento.id) : null;
    if (previo) return json(request, 200, { orden: previo.orden, recibido: previo.recibido, duplicado: true });
    const r = await cripto.comprobar(evento, { vacio: await almacen.vacio(nombre), claveDelAutor: (autor) => almacen.claveDe(nombre, autor) });
    if (!r.ok) return error(request, r.estado, r.error);
    const ev = r.evento;
    const fila = await almacen.insertar(nombre, { id: ev.id, autor: ev.autor, firma: ev.firma, cuerpo: ev });
    if (fila) return json(request, 201, { orden: fila.orden, recibido: fila.recibido });
    const otra = await almacen.obtener(nombre, ev.id); // llegó dos veces a la vez: la primera ganó
    return otra ? json(request, 200, { orden: otra.orden, recibido: otra.recibido, duplicado: true }) : error(request, 500, 'no se pudo guardar');
  }

  async function bajar(request, url) {
    const abierto = await abrirEje(request, url.searchParams.get('eje') ?? '');
    if (abierto.respuesta) return abierto.respuesta;
    const nombre = abierto.eje.eje;
    const desde = url.searchParams.has('desde') ? Number(url.searchParams.get('desde')) : 0;
    const cuantos = url.searchParams.has('cuantos') ? Number(url.searchParams.get('cuantos')) : PAGINA;
    if (!Number.isSafeInteger(desde) || desde < 0) return error(request, 400, 'desde debe ser un orden (entero ≥ 0)');
    if (!Number.isSafeInteger(cuantos) || cuantos < 1 || cuantos > PAGINA) return error(request, 400, 'cuantos debe estar entre 1 y ' + PAGINA);
    const filas = await almacen.listar(nombre, desde, cuantos + 1);
    const pagina = filas.slice(0, cuantos);
    const siguiente = filas.length > cuantos ? pagina[pagina.length - 1].orden : null;
    return json(request, 200, { eventos: pagina.map((f) => ({ orden: f.orden, recibido: f.recibido, evento: f.cuerpo })), siguiente });
  }

  return async function manejar(request) {
    const url = new URL(request.url);
    const camino = url.pathname.replace(/\/+$/, '');
    const ruta = camino.endsWith('/ejes') ? 'ejes' : 'eventos';
    try {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(request) });
      if (ruta === 'ejes') return request.method === 'POST' ? await crearEje(request) : error(request, 405, 'solo POST');
      if (request.method === 'POST') return await subir(request);
      if (request.method === 'GET') return await bajar(request, url);
      return error(request, 405, 'solo GET y POST');
    } catch (e) {
      return error(request, 500, 'error del servidor: ' + (e?.message ?? String(e)));
    }
  };
}
