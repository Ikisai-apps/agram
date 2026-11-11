// El contrato HTTP de la guía del PV9, como una función (Request) → Response de la API Fetch, igual en Deno (index.ts
// la sirve con Deno.serve) y en Node (servidor/prueba/servidor.mjs la sirve con un eco, sin llamar a nada). Sin
// dependencias; la carpeta es autónoma (se despliega sola). docs/CONTRATO.md §16.
//
//   POST {url}/guia   { eje, modelo?, mensajes: [{ role, content }…], contexto, instrucciones? }
//                     con X-Clave-Lectura (la del libro compartido del eje)
//                     → 200 { texto, uso: { entrada, salida } }
//                     400 forma; 401 clave de lectura; 404 eje; 413 contexto o cuerpo demasiado grandes;
//                     429 más de 30 preguntas por minuto en el eje o cuota del proveedor; 502 el proveedor falla.
//   OPTIONS           CORS (los mismos orígenes que la función `eventos`).
//
// `instrucciones` son las de la época (la guía las lee de datos y las manda); `contexto`, lo que hay en pantalla.
// El servidor junta las dos como el «system» de la llamada y no sabe nada de AGRAM. `llamar` es lo único que cambia
// entre el despliegue (api.anthropic.com con ANTHROPIC_API_KEY, index.ts) y la prueba (un eco).

/** Orígenes admitidos por CORS: la carta publicada y el desarrollo local (los de la función `eventos`). */
export const ORIGENES = Object.freeze(['https://agram.ikisai.com', 'https://beta.agram.ikisai.com', 'https://agram-beta.pages.dev', /^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/]);
export const PREGUNTAS_POR_MINUTO = 30;
export const LIMITE_CONTEXTO = 8000;
export const LIMITE_INSTRUCCIONES = 8000;
export const LIMITE_MENSAJES = 24;
export const LIMITE_MENSAJE = 2000;
export const LIMITE_CUERPO = 64 * 1024;
export const MODELO_POR_DEFECTO = 'claude-sonnet-5-5';
export const MAX_TOKENS = 800;
export const NOMBRE_EJE = /^[a-z0-9][a-z0-9._-]{0,63}$/;

/** SHA-256 en hexadecimal (el hash que guarda la tabla `ejes` de la clave de lectura). */
async function hash(texto) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Un error del proveedor con el estado HTTP que la guía le devuelve a la carta. */
export class ErrorDelProveedor extends Error {
  constructor(estado, mensaje) {
    super(mensaje);
    this.estado = estado;
  }
}

/**
 * Llama a la API de mensajes de Anthropic. `clave` (ANTHROPIC_API_KEY) viene del entorno de quien despliega; `fetch`
 * se puede cambiar. → { texto, uso: { entrada, salida } }. Lanza ErrorDelProveedor (429 cuota, 502 lo demás).
 */
export function llamarAAnthropic({ clave, fetch = globalThis.fetch, url = 'https://api.anthropic.com/v1/messages' }) {
  return async ({ modelo, sistema, mensajes }) => {
    let r;
    try {
      r = await fetch(url, {
        method: 'POST',
        headers: { 'x-api-key': clave, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: modelo, max_tokens: MAX_TOKENS, system: sistema, messages: mensajes }),
      });
    } catch (e) {
      throw new ErrorDelProveedor(502, 'sin conexión con el proveedor: ' + (e?.message ?? e));
    }
    const cuerpo = await r.json().catch(() => ({}));
    if (!r.ok) {
      const motivo = cuerpo?.error?.message ?? 'HTTP ' + r.status;
      throw new ErrorDelProveedor(r.status === 429 ? 429 : 502, r.status === 401 || r.status === 403 ? 'la clave del proveedor en el servidor no vale: ' + motivo : motivo);
    }
    const texto = (cuerpo.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
    return { texto, uso: { entrada: cuerpo.usage?.input_tokens ?? 0, salida: cuerpo.usage?.output_tokens ?? 0 } };
  };
}

/**
 * Construye el manejador. `almacen.eje(nombre)` → { clave_lectura_hash } | null (la misma tabla `ejes`); `llamar` es
 * `async ({ modelo, sistema, mensajes, contexto, instrucciones }) → { texto, uso }`.
 */
export function crearGuia({ almacen, llamar, origenes = ORIGENES, ahora = () => new Date(), preguntasPorMinuto = PREGUNTAS_POR_MINUTO }) {
  const ventanas = new Map();

  const cors = (request) => {
    const origen = request.headers.get('origin');
    const cabeceras = { 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Clave-Lectura, Authorization', 'Access-Control-Max-Age': '86400' };
    if (origen && origenes.some((o) => (o instanceof RegExp ? o.test(origen) : o === origen))) {
      cabeceras['Access-Control-Allow-Origin'] = origen;
      cabeceras.Vary = 'Origin';
    }
    return cabeceras;
  };
  const json = (request, estado, cuerpo) => new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(request) } });
  const error = (request, estado, texto) => json(request, estado, { error: texto });

  function pasaElLimite(eje) {
    const minuto = Math.floor(ahora().getTime() / 60000);
    const v = ventanas.get(eje);
    if (!v || v.minuto !== minuto) { ventanas.set(eje, { minuto, n: 1 }); return true; }
    v.n += 1;
    return v.n <= preguntasPorMinuto;
  }

  /** Los mensajes de la conversación: alternan, empiezan por el usuario y acaban en una pregunta suya. */
  function mensajesValidos(m) {
    if (!Array.isArray(m) || m.length === 0 || m.length > LIMITE_MENSAJES) return 'mensajes: de 1 a ' + LIMITE_MENSAJES;
    for (let i = 0; i < m.length; i++) {
      const x = m[i];
      if (!x || (x.role !== 'user' && x.role !== 'assistant') || typeof x.content !== 'string' || !x.content.trim()) return 'mensajes: cada uno { role: user|assistant, content: texto }';
      if (x.content.length > LIMITE_MENSAJE) return 'mensajes: cada uno de hasta ' + LIMITE_MENSAJE + ' caracteres';
      if (x.role !== (i % 2 === 0 ? 'user' : 'assistant')) return 'mensajes: empiezan por user y se alternan';
    }
    return m.length % 2 === 1 ? null : 'mensajes: el último es del usuario';
  }

  return async function manejar(request) {
    try {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(request) });
      if (request.method !== 'POST') return error(request, 405, 'solo POST');
      const texto = await request.text();
      if (new TextEncoder().encode(texto).length > LIMITE_CUERPO) return error(request, 413, 'cuerpo demasiado grande');
      let datos;
      try { datos = JSON.parse(texto); } catch { datos = null; }
      if (!datos || typeof datos !== 'object' || Array.isArray(datos)) return error(request, 400, 'el cuerpo debe ser un objeto JSON { eje, modelo, mensajes, contexto }');
      const { eje, modelo, mensajes, contexto, instrucciones = '' } = datos;
      if (typeof eje !== 'string' || !NOMBRE_EJE.test(eje)) return error(request, 400, 'eje: nombre inválido');
      const fila = await almacen.eje(eje);
      if (!fila) return error(request, 404, 'eje desconocido: ' + eje);
      const clave = request.headers.get('x-clave-lectura');
      if (!clave || (await hash(clave)) !== fila.clave_lectura_hash) return error(request, 401, 'clave de lectura ausente o incorrecta');
      if (modelo !== undefined && (typeof modelo !== 'string' || !/^[A-Za-z0-9._-]{1,80}$/.test(modelo))) return error(request, 400, 'modelo: nombre inválido');
      if (typeof contexto !== 'string') return error(request, 400, 'contexto: texto');
      if (typeof instrucciones !== 'string') return error(request, 400, 'instrucciones: texto');
      if (contexto.length > LIMITE_CONTEXTO) return error(request, 413, 'contexto de más de ' + LIMITE_CONTEXTO + ' caracteres');
      if (instrucciones.length > LIMITE_INSTRUCCIONES) return error(request, 413, 'instrucciones de más de ' + LIMITE_INSTRUCCIONES + ' caracteres');
      const motivo = mensajesValidos(mensajes);
      if (motivo) return error(request, 400, motivo);
      if (!pasaElLimite(eje)) return error(request, 429, 'más de ' + preguntasPorMinuto + ' preguntas por minuto en el eje ' + eje);
      const sistema = [instrucciones, contexto].filter(Boolean).join('\n\n');
      const r = await llamar({ modelo: modelo ?? MODELO_POR_DEFECTO, sistema, mensajes, contexto, instrucciones });
      return json(request, 200, { texto: r.texto, uso: { entrada: r.uso?.entrada ?? 0, salida: r.uso?.salida ?? 0 } });
    } catch (e) {
      if (e instanceof ErrorDelProveedor) return error(request, e.estado, e.message);
      return error(request, 500, 'error del servidor: ' + (e?.message ?? String(e)));
    }
  };
}
