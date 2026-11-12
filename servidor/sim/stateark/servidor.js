// Servicio HTTP local y fino sobre la simulación: solo expone las llamadas del contrato, más `minar` y
// `acunar` (que solo existen en la simulación). Solo Node (node:http). Escucha en 127.0.0.1.
//
// §3 sello de tiempo
//   POST /sellar     { ids: [...] }              → 200 { lote, pendiente, ids }
//   GET  /prueba/:id                             → 200 { altura, hash, instante, lote, prueba } | 202 { pendiente, lote } | 404
//   POST /verificar  { evento | id, prueba }     → 200 { ok, motivo, ... }
// §5 pagos y fondos en sats
//   POST /pagos/cartera          { nombre, titular }                         → 200 { nombre, titular }
//   POST /pagos/direccion        { nombre }                                  → 200 { direccion }
//   POST /pagos/preparar         { nombre, instruccion }                     → 200 plan
//   POST /pagos/autorizar        { plan, titular, firma }                    → 200 autorizacion
//   POST /pagos/ejecutar         { nombre, instruccion, plan, autorizacion } → 200 recibo
//   GET  /pagos/recibo/:txid                                                 → 200 recibo | 404
//   POST /pagos/verificar-recibo { recibo, confirmaciones? }                 → 200 { ok, motivo, ... }
//   POST /pagos/verificar-fondos { serie, recibo }                           → 200 { ok, motivo, sat? }
// §8 candado por hash (la pata de pago)
//   POST /pagos/reclamar { nombre, hash, preimagen } · /pagos/reembolsar { nombre, hash } → 200 { txid, pendiente }
//   GET  /pagos/candado/:hash   → 200 recibo de candado | 404
//   GET  /pagos/preimagen/:hash → 200 { preimagen, txid, altura } | 404
//   POST /pagos/verificar-candado { recibo } → 200 { ok, motivo, … }
//   POST /pagos/secreto → 200 { preimagen, hash } (simulación: lo hace quien cobra)
//   Un rechazo del carril responde 422 { error, codigo } (codigo fijo: expired, amount_invalid…).
// Solo simulación
//   POST /minar                                  → 200 { altura, hash, instante, lotes, pagos }
//   POST /pagos/acunar { direccion, sat }        → 200 { txid, pendiente }
//   GET  /                                       → 200 { servicio, simulado: true, altura }
//
// Opción `minarCada` (ms): mina solo cada tanto, como haría la red.

import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { Simulacion } from './index.js';
import { RechazoPago, nuevoSecreto } from './pagos.js';

const TOPE = 1 << 20; // 1 MB por petición

function responder(res, estado, cuerpo) {
  res.writeHead(estado, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*', // la beta de AGRAM corre en el navegador; esto solo escucha en local
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
  });
  res.end(JSON.stringify(cuerpo));
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
 * @param {Simulacion} [opciones.simulacion]
 * @param {number} [opciones.minarCada] ms entre bloques automáticos (sin ella, solo POST /minar)
 */
export async function crearServidor(opciones = {}) {
  const simulacion = opciones.simulacion ?? (await Simulacion.crear());
  const { sellador, carril } = simulacion;

  const post = {
    '/sellar': (b) => sellador.sellar(b.ids),
    '/verificar': (b) => sellador.verificar(b.evento ?? b.id, b.prueba),
    '/minar': () => simulacion.minar(),
    '/pagos/cartera': (b) => carril.crearCartera(b.nombre, { titular: b.titular }),
    '/pagos/direccion': async (b) => ({ direccion: await carril.direccion(b.nombre) }),
    '/pagos/acunar': (b) => carril.acunar(b.direccion, b.sat),
    '/pagos/preparar': (b) => carril.preparar(b.nombre, b.instruccion),
    '/pagos/autorizar': (b) => carril.autorizar(b.plan, { titular: b.titular, firma: b.firma }),
    '/pagos/ejecutar': (b) => carril.ejecutar(b.nombre, b.instruccion, b.plan, b.autorizacion),
    '/pagos/verificar-recibo': (b) => carril.verificarRecibo(b.recibo, { confirmaciones: b.confirmaciones ?? 1 }),
    '/pagos/verificar-fondos': (b) => carril.verificarFondos(b.serie, b.recibo),
    '/pagos/secreto': () => nuevoSecreto(),
    '/pagos/reclamar': (b) => carril.reclamar(b.nombre, b.hash, b.preimagen),
    '/pagos/reembolsar': (b) => carril.reembolsar(b.nombre, b.hash),
    '/pagos/verificar-candado': (b) => carril.verificarCandado(b.recibo),
  };

  const servidor = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://local');
      if (req.method === 'OPTIONS') return responder(res, 204, {});
      if (req.method === 'GET' && url.pathname === '/') {
        return responder(res, 200, { servicio: 'stateark-sim §3 §5 §8', simulado: true, altura: simulacion.cadena.altura });
      }
      if (req.method === 'POST' && post[url.pathname]) {
        return responder(res, 200, await post[url.pathname](await leerJSON(req)));
      }
      let m = url.pathname.match(/^\/prueba\/([^/]+)$/);
      if (req.method === 'GET' && m) {
        const p = sellador.prueba(m[1]);
        if (p === null) return responder(res, 404, { error: 'ese id no se ha sellado' });
        return responder(res, p.pendiente ? 202 : 200, p);
      }
      m = url.pathname.match(/^\/pagos\/candado\/([^/]+)$/);
      if (req.method === 'GET' && m) {
        const rc = carril.reciboCandado(m[1]);
        return rc ? responder(res, 200, rc) : responder(res, 404, { error: 'no hay ningún candado con ese hash' });
      }
      m = url.pathname.match(/^\/pagos\/preimagen\/([^/]+)$/);
      if (req.method === 'GET' && m) {
        const p = await carril.preimagenDe(m[1]);
        return p ? responder(res, 200, p) : responder(res, 404, { error: 'esa preimagen aún no se ha revelado en un bloque' });
      }
      m = url.pathname.match(/^\/pagos\/recibo\/([^/]+)$/);
      if (req.method === 'GET' && m) {
        const r = carril.recibo(m[1]);
        return r ? responder(res, 200, r) : responder(res, 404, { error: 'no hay ningún pago con ese txid' });
      }
      return responder(res, 404, { error: 'no existe esa llamada' });
    } catch (e) {
      if (e instanceof RechazoPago) return responder(res, 422, { error: e.message, codigo: e.codigo });
      const estado = e.estado ?? (e instanceof TypeError || e instanceof RangeError ? 400 : 500);
      return responder(res, estado, { error: e.message });
    }
  });
  let temporizador = null;
  if (opciones.minarCada) {
    temporizador = setInterval(() => {
      if (sellador.pendientes.length || carril.pendientes.length) simulacion.minar().catch((e) => console.error('minar falló:', e));
    }, opciones.minarCada);
    temporizador.unref?.();
  }
  servidor.on('close', () => clearInterval(temporizador));
  return { servidor, simulacion, sellador, carril };
}

// Arranque directo: node src/servidor.js [puerto] [minarCada_ms]
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const puerto = Number(process.argv[2] ?? 8787);
  const minarCada = process.argv[3] ? Number(process.argv[3]) : undefined;
  const { servidor } = await crearServidor({ minarCada });
  servidor.listen(puerto, '127.0.0.1', () => {
    console.log(`stateark-sim (SIMULADO, §3 §5 §8) en http://127.0.0.1:${puerto}${minarCada ? `, un bloque cada ${minarCada} ms` : ''}`);
  });
}
