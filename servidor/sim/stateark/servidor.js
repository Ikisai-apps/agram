// Servicio HTTP local y fino sobre el sellador: solo expone las llamadas del §3, más `minar` (que
// solo existe en la simulación). Solo Node (node:http). Escucha en 127.0.0.1.
//
//   POST /sellar     { ids: [...] }              → 200 { lote, pendiente, ids }
//   GET  /prueba/:id                             → 200 { altura, hash, instante, lote, prueba } | 202 { pendiente, lote } | 404
//   POST /verificar  { evento | id, prueba }     → 200 { ok, motivo, ... }
//   POST /minar                                  → 200 { altura, hash, instante, lotes }
//   GET  /                                       → 200 { servicio, simulado: true, altura }
//
// Opción `minarCada` (ms): mina solo cada tanto, como haría un calendario.

import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { Sellador } from './sello.js';

const TOPE = 1 << 20; // 1 MB por petición

function responder(res, estado, cuerpo) {
  const datos = JSON.stringify(cuerpo);
  res.writeHead(estado, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*', // la beta de AGRAM corre en el navegador; esto solo escucha en local
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
  });
  res.end(datos);
}

function leerJSON(req) {
  return new Promise((resolver, rechazar) => {
    let n = 0;
    const trozos = [];
    req.on('data', (t) => {
      n += t.length;
      if (n > TOPE) { rechazar(Object.assign(new Error('petición demasiado grande'), { estado: 413 })); req.destroy(); return; }
      trozos.push(t);
    });
    req.on('end', () => {
      try { resolver(trozos.length ? JSON.parse(Buffer.concat(trozos).toString('utf8')) : {}); }
      catch { rechazar(Object.assign(new Error('el cuerpo no es JSON'), { estado: 400 })); }
    });
    req.on('error', rechazar);
  });
}

/**
 * @param {object} [opciones]
 * @param {Sellador} [opciones.sellador]
 * @param {number} [opciones.minarCada] ms entre bloques automáticos (sin ella, solo POST /minar)
 */
export async function crearServidor(opciones = {}) {
  const sellador = opciones.sellador ?? (await Sellador.crear());
  const servidor = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://local');
      if (req.method === 'OPTIONS') return responder(res, 204, {});
      if (req.method === 'GET' && url.pathname === '/') {
        return responder(res, 200, { servicio: 'stateark-sim §3', simulado: true, altura: sellador.cadena.altura });
      }
      if (req.method === 'POST' && url.pathname === '/sellar') {
        const { ids } = await leerJSON(req);
        return responder(res, 200, await sellador.sellar(ids));
      }
      const m = url.pathname.match(/^\/prueba\/([^/]+)$/);
      if (req.method === 'GET' && m) {
        const p = sellador.prueba(m[1]);
        if (p === null) return responder(res, 404, { error: 'ese id no se ha sellado' });
        return responder(res, p.pendiente ? 202 : 200, p);
      }
      if (req.method === 'POST' && url.pathname === '/verificar') {
        const cuerpo = await leerJSON(req);
        return responder(res, 200, await sellador.verificar(cuerpo.evento ?? cuerpo.id, cuerpo.prueba));
      }
      if (req.method === 'POST' && url.pathname === '/minar') {
        return responder(res, 200, await sellador.minar());
      }
      return responder(res, 404, { error: 'no existe esa llamada' });
    } catch (e) {
      const estado = e.estado ?? (e instanceof TypeError || e instanceof RangeError ? 400 : 500);
      return responder(res, estado, { error: e.message });
    }
  });
  let temporizador = null;
  if (opciones.minarCada) {
    temporizador = setInterval(() => {
      if (sellador.pendientes.length) sellador.minar().catch((e) => console.error('minar falló:', e));
    }, opciones.minarCada);
    temporizador.unref?.();
  }
  servidor.on('close', () => clearInterval(temporizador));
  return { servidor, sellador };
}

// Arranque directo: node src/servidor.js [puerto] [minarCada_ms]
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const puerto = Number(process.argv[2] ?? 8787);
  const minarCada = process.argv[3] ? Number(process.argv[3]) : undefined;
  const { servidor } = await crearServidor({ minarCada });
  servidor.listen(puerto, '127.0.0.1', () => {
    console.log(`stateark-sim §3 (SIMULADO) en http://127.0.0.1:${puerto}${minarCada ? `, un bloque cada ${minarCada} ms` : ''}`);
  });
}
