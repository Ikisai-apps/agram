// Paridad Supabase ↔ simulación del exterior (issue #60, decisión #58 de VG; docs/CONTRATO.md §4.4 y §16.2 bis, servidor/LEEME.md
// «Elegir Supabase o la simulación»). La MISMA secuencia (crear la cuenta, escribir, adjuntar un archivo, sincronizar, bajar en
// un segundo dispositivo) se hace dos veces contra dos «exteriores», elegidos solo por la configuración de la cuenta:
//
//   · Supabase: el servidor de prueba de AGRAM (servidor/prueba/, el mismo contrato que las funciones de Supabase) en «sync url»,
//     sin los ajustes del exterior. La función de Supabase no sirve /eventos/recibo (lo contesta como 405) ni hay sello: el
//     libro solo trae el reloj 6.8.0.
//   · Simulación: la misma cuenta con «exterior settings» (relay url y blossom url → el transporte simulado de AARPIA, seal url →
//     el servicio de sello simulado de StateArk): vuelven los tres relojes (6.8.0, 6.8.1 con el relé, 6.8.2 con el bloque) y el
//     registro queda «verificado».
//
// Lo que debe ser igual: los registros (id, autor, cuerpo y orden relativo en el servidor), el reloj 6.8.0, el archivo y su id.
// Lo que debe cambiar: 6.8.1, 6.8.2 y `verificado`, solo en la simulación. Nada se inventa: lo que el exterior no da, queda vacío.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { arrancar as arrancarPrueba } from '../servidor/prueba/servidor.mjs';
import { arrancar as arrancarTransporte } from '../servidor/sim/aarpia/servidor.mjs';
import { Rele } from '../servidor/sim/aarpia/src/rele.js';
import { crearServidor as crearServidorDeSello } from '../servidor/sim/stateark/servidor.js';
import { Simulacion } from '../servidor/sim/stateark/index.js';
import { contrato, salida, sincronia, sello, exterior } from '../src/index.js';
import { referenciaDeArchivo } from '../src/modelos.js';
import { Eje } from '../src/eje.js';
import { canonico } from '../src/evento.js';
import { generarClaves } from '../src/autoridad.js';
import { evaluar } from '../src/bqlm.js';
import { ContextoEje } from '../src/contexto-eje.js';
import { EPOCA_0_BTML } from '../src/epocas.js';
import { preferencias } from '../carta/carta.js';
import * as G from '../carta/guia.js';
import { Archivos, destinoDe } from '../carta/archivos.js';

const T = (m) => '2026-11-10T10:' + String(m).padStart(2, '0') + ':00Z';
const minuto = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });
const AHORA_DEL_RELE = '2026-11-10T10:20:00Z';
const AHORA_DE_LA_CADENA = '2026-11-10T10:30:00Z';
const NOMBRE_DEL_EJE = 'paridad-exterior';
const HTML = new TextEncoder().encode('<!doctype html><title>adjunto</title><p>el mismo archivo por los dos exteriores</p>');

let prueba;
let transporte;
let stateark;
let servidorDeSello;
before(async () => {
  prueba = await arrancarPrueba({ puerto: 0, secreto: 'prueba', ahora: () => new Date(AHORA_DEL_RELE) });
  const ahora = () => new Date(AHORA_DEL_RELE);
  transporte = await arrancarTransporte({ puerto: 0, secreto: 'prueba', rele: new Rele({ ahora }), ahora });
  // El sello de StateArk simulado: la cadena empieza en el mismo instante en que va su reloj (el bloque 1 sale 10 minutos después).
  stateark = await Simulacion.crear({ inicio: AHORA_DE_LA_CADENA, reloj: () => Date.parse(AHORA_DE_LA_CADENA) });
  const { servidor } = await crearServidorDeSello({ simulacion: stateark });
  servidorDeSello = servidor;
  await new Promise((r) => servidorDeSello.listen(0, '127.0.0.1', r));
});
after(async () => {
  await prueba.cerrar();
  await transporte.cerrar();
  await new Promise((r) => servidorDeSello.close(r));
});

const urlDelSello = () => 'http://127.0.0.1:' + servidorDeSello.address().port;

/** Lo que haría la función de Supabase de hoy: no sirve /eventos/recibo (lo contesta como un método que no admite). */
const fetchDeSupabase = (url, op) => (String(url).includes('/eventos/recibo')
  ? Promise.resolve(new Response(JSON.stringify({ error: 'solo GET y POST' }), { status: 405, headers: { 'Content-Type': 'application/json' } }))
  : fetch(url, op));

async function crearEje(url, nombre) {
  const r = await fetch(url + '/eventos/ejes', { method: 'POST', headers: { 'X-Crear-Ejes': 'prueba', 'Content-Type': 'application/json' }, body: JSON.stringify({ eje: nombre }) });
  assert.equal(r.status, 201);
  return (await r.json()).claveLectura;
}

/** La misma cuenta en los dos exteriores: mismas claves y mismo génesis, así los registros tienen los mismos ids. */
let cuentaComun;
before(async () => {
  cuentaComun = await generarClaves();
});

/** Un dispositivo de la cuenta: su eje con la configuración dada (preferencias y, si hay, ajustes del exterior). */
async function dispositivo({ syncUrl, ajustesDelExterior }) {
  const cuenta = cuentaComun;
  const eje = await Eje.genesis({ identidad: 'vg', foco: ['mi eje'], t: T(0), clave: cuenta.publica, privada: cuenta.privada, exigirFirmas: true });
  const p = preferencias(eje, 'vg', { 'sync url': [syncUrl], 'sync ledger': [NOMBRE_DEL_EJE] });
  await salida.escribirDesde(eje, { modo: 'sequenced', autor: 'vg', sobre: p.sobre, en: p.en, payload: p.payload, t: T(1) }, cuenta.privada);
  if (ajustesDelExterior) {
    const a = G.ajustesEditablesDe(exterior.AJUSTES.plantilla, eje, 'vg', ajustesDelExterior);
    await salida.escribirDesde(eje, { modo: 'sequenced', autor: 'vg', sobre: a.sobre, en: a.en, payload: a.payload, t: T(2) }, cuenta.privada);
  }
  return { cuenta, eje };
}

/** La sincronía de la cuenta como la abre la carta (carta/sincronia.js abrir): el destino y el sello salen de la configuración. */
function abrirSincronia(eje, claveLectura, fetchDe) {
  const d = sincronia.destino(eje, 'vg');
  return new sincronia.Sincronia({ url: d.url, eje: d.eje, claveLectura, fetch: fetchDe, sello: sello.deConfiguracion(eje, 'vg', { fetch: fetchDe }), ahora: () => Date.parse(AHORA_DEL_RELE) });
}

const ctxDe = (eje) => new ContextoEje(eje, { epoch: EPOCA_0_BTML });
const relojes = (eje, id) => {
  const v = (expr) => evaluar(expr, ctxDe(eje), { sujeto: id }).valor;
  return { libro: v('=(first (first it.6).8.0).0'), nostr: v('=count (first it.6).8.1')[0], bitcoin: v('=count (first it.6).8.2')[0] };
};

/** Lo que baja del servidor, sin lo que depende de su reloj ni de la firma: [{ id, autor, cuerpo }] en el orden del servidor. */
async function delServidor(url, claveLectura) {
  const r = await fetch(url + '/eventos?eje=' + NOMBRE_DEL_EJE + '&desde=0', { headers: { 'X-Clave-Lectura': claveLectura } });
  assert.equal(r.status, 200);
  // (la firma BIP-340 lleva un dato al azar: cada firma es distinta aunque el cuerpo y el id sean los mismos; se comprueba que valga, no que coincida)
  return (await r.json()).eventos.map((x) => { const { firma, ...cuerpo } = x.evento; assert.match(firma, /^[0-9a-f]{128}$/); return { id: x.evento.id, autor: x.evento.autor, cuerpo: canonico(cuerpo) }; });
}

/**
 * La secuencia: escribir dos registros (el segundo cita un archivo adjunto), adjuntarlo, sincronizar, minar el sello (si hay) y
 * volver a sincronizar; un segundo dispositivo baja el eje y también lee el archivo.
 */
async function secuencia({ url, fetchDe, ajustesDelExterior, minarElSello }) {
  const claveLectura = await crearEje(url, NOMBRE_DEL_EJE);
  const { cuenta, eje } = await dispositivo({ syncUrl: prueba.url, ajustesDelExterior });
  const destino = () => destinoDe(eje, 'vg', claveLectura);
  const archivos = new Archivos({ destino, fetch: fetchDe });
  const adjunto = await archivos.adjuntar({ nombre: 'adjunto.html', tipo: 'text/html', bytes: HTML });
  assert.equal(adjunto.subido, true);
  const e1 = await eje.escribir({ autor: 'vg', sobre: eje.genesisId, t: T(3), movimientos: [minuto('vg')], payload: ['uno'] }, cuenta.privada);
  const e2 = await eje.escribir({ autor: 'vg', sobre: e1.id, t: T(4), movimientos: [minuto('vg')], payload: [['dos', referenciaDeArchivo(adjunto.id)]] }, cuenta.privada);

  const A = abrirSincronia(eje, claveLectura, fetchDe);
  let informe = await A.sincronizar(eje);
  assert.deepEqual(informe.errores, []);
  assert.ok(informe.subidos.includes(e1.id) && informe.subidos.includes(e2.id));
  if (minarElSello) {
    const r = await fetch(urlDelSello() + '/minar', { method: 'POST' });
    assert.equal(r.status, 200);
    informe = await A.sincronizar(eje);
    assert.deepEqual(informe.errores, []);
  }

  // Un segundo dispositivo: la misma cuenta, sin eje local; baja del servidor y lee el archivo.
  const configuracion = await dispositivo({ syncUrl: prueba.url, ajustesDelExterior });
  const B = abrirSincronia(configuracion.eje, claveLectura, fetchDe);
  const bajado = await B.sincronizar(null);
  const ejeB = bajado.eje;
  assert.ok(ejeB.eventos.has(e1.id) && ejeB.eventos.has(e2.id));
  if (minarElSello) {
    await fetch(urlDelSello() + '/minar', { method: 'POST' });
    await B.sincronizar(ejeB);
  } else {
    await B.sincronizar(ejeB);
  }
  const archivosB = new Archivos({ destino, fetch: fetchDe });
  const leido = await archivosB.bajar(adjunto.id, destino());
  return { eje, ejeB, e1, e2, adjunto, leido, claveLectura, servidor: await delServidor(url, claveLectura) };
}

test('la misma secuencia da los mismos registros, el mismo reloj 6.8.0 y el mismo archivo por Supabase (servidor de prueba) y por la simulación (AARPIA + StateArk); 6.8.1, 6.8.2 y «verificado» solo en la simulación', async () => {
  const supa = await secuencia({ url: prueba.url, fetchDe: fetchDeSupabase, ajustesDelExterior: null, minarElSello: false });
  const sim = await secuencia({
    url: transporte.url,
    fetchDe: fetch,
    ajustesDelExterior: { 'relay url': transporte.url, 'blossom url': transporte.url, 'seal url': urlDelSello() },
    minarElSello: true,
  });

  // 1. Los mismos registros: ids, autores y cuerpos canónicos de los dos que escribimos, y su orden relativo en el servidor.
  assert.equal(supa.e1.id, sim.e1.id, 'mismo cuerpo, mismo id');
  assert.equal(supa.e2.id, sim.e2.id);
  const nuestros = (servidor) => servidor.filter((x) => [supa.e1.id, supa.e2.id].includes(x.id));
  assert.deepEqual(nuestros(supa.servidor), nuestros(sim.servidor), 'los mismos registros, en el mismo orden relativo');
  assert.deepEqual(nuestros(sim.servidor).map((x) => x.id), [supa.e1.id, supa.e2.id]);

  // 2. El reloj 6.8.0 (el t del libro) es el mismo; 6.8.1 y 6.8.2, solo en la simulación.
  for (const id of [supa.e1.id, supa.e2.id]) {
    for (const dispositivoDe of ['eje', 'ejeB']) {
      const s = relojes(supa[dispositivoDe], id);
      const m = relojes(sim[dispositivoDe], id);
      assert.deepEqual(s.libro, m.libro, '6.8.0 igual (' + dispositivoDe + ')');
      assert.deepEqual([s.nostr, s.bitcoin], [0, 0], 'Supabase: solo 6.8.0');
      assert.deepEqual([m.nostr, m.bitcoin], [2, 3], 'simulación: 6.8.1 (instante y relé) y 6.8.2 (instante, altura, hash)');
      assert.equal(supa[dispositivoDe].recibo(id), null);
      assert.equal(supa[dispositivoDe].sello(id), null);
      assert.equal(sim[dispositivoDe].recibo(id).rele, transporte.servicio.rele.publica);
      assert.equal(sim[dispositivoDe].recibo(id).instante, new Date(AHORA_DEL_RELE).toISOString());
      assert.equal(sim[dispositivoDe].sello(id).verificado, true);
      assert.equal(sim[dispositivoDe].sello(id).instante, new Date(Date.parse(AHORA_DE_LA_CADENA) + 10 * 60 * 1000).toISOString());
    }
  }

  // 3. «Verificado» como lectura: solo en la simulación (sello verificado + recibo del relé + relojes en orden).
  for (const id of [supa.e1.id, supa.e2.id]) {
    assert.deepEqual(contrato.verificado(supa.eje, id), { ok: false, sello: false, recibo: null, relojes: true }, 'Supabase: sin sello no hay verificado, y sin transporte de recibos no se exige');
    assert.deepEqual(contrato.verificado(sim.eje, id), { ok: true, sello: true, recibo: true, relojes: true });
    assert.deepEqual(contrato.verificado(sim.ejeB, id), { ok: true, sello: true, recibo: true, relojes: true });
    assert.equal(contrato.leer(sim.eje, id, 5).verificado.ok, true);
    assert.equal(contrato.leer(supa.eje, id, 5).verificado.ok, false);
  }

  // 4. El mismo archivo: el id (SHA-256 de los bytes) y lo que baja, por el servidor de prueba y por el Blossom simulado.
  assert.equal(supa.adjunto.id, sim.adjunto.id);
  assert.equal(supa.leido.estado, 'listo');
  assert.equal(sim.leido.estado, 'listo');
  assert.equal(supa.leido.tipo, 'text/html');
  assert.equal(sim.leido.tipo, 'text/html');
  assert.equal(sim.leido.texto, supa.leido.texto);
  assert.equal(sim.leido.texto, new TextDecoder().decode(HTML));

  // 5. Lo que sale de dónde: la simulación fue por el relé, el Blossom y el sello de la configuración; Supabase, por «sync url».
  assert.equal(sincronia.destino(sim.eje, 'vg').url, transporte.url);
  assert.equal(sincronia.destinoDeArchivos(sim.eje, 'vg').url, transporte.url);
  assert.equal(sello.destino(sim.eje, 'vg'), urlDelSello());
  assert.equal(sincronia.destino(supa.eje, 'vg').url, prueba.url);
  assert.equal(sello.deConfiguracion(supa.eje, 'vg'), null);
});
