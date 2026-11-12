// El recibo de llegada (el segundo reloj, X.6.8.1): src/sincronia.js contra el TRANSPORTE SIMULADO de AARPIA
// (servidor/sim/aarpia/, arrancado en un puerto libre), y su paso al eje por eje.marcarRecibo. Paridad: un evento real,
// creado con src/evento.js y firmado, subido al transporte sale en el eje con 6.8.1 relleno (instante y clave del relé) sin
// que cambie su cuerpo, su id ni su firma; «clocks out of order» (X.6.9, márgenes en epoch.7.3) da falso con los tres
// relojes en orden (libro → recibo → sello simulado) y verdadero si el recibo va antes del t del libro más del margen de
// 600 s. Un servidor sin la ruta (la función de Supabase) no rompe nada. Al final, la paridad de los archivos adjuntos:
// subir y bajar por el transporte simulado da lo mismo que por el servidor de prueba de AGRAM.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { arrancar as arrancarTransporte } from '../servidor/sim/aarpia/servidor.mjs';
import { Rele } from '../servidor/sim/aarpia/src/rele.js';
import { arrancar as arrancarPrueba, almacenEnMemoria } from '../servidor/prueba/servidor.mjs';
import { crearApi } from '../servidor/supabase/funciones/eventos/api.js';
import { selloSimulado } from '../src/sello.js';
import { Sincronia, RECIBOS_POR_PASADA } from '../src/sincronia.js';
import { Eje } from '../src/eje.js';
import { verificarId, canonico } from '../src/evento.js';
import { generarClaves, verificar as verificarFirma } from '../src/autoridad.js';
import { evaluar } from '../src/bqlm.js';
import { ContextoEje } from '../src/contexto-eje.js';
import { relojesFueraDeOrden } from '../src/contrato.js';
import { EPOCA_0_BTML } from '../src/epocas.js';
import { Archivos } from '../carta/archivos.js';

const T = (m) => '2026-11-10T10:' + String(m).padStart(2, '0') + ':00Z';
const minuto = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });
const conSujeto = (expr, ctx, sujeto) => evaluar(expr, ctx, { sujeto });
const ctxDe = (eje) => new ContextoEje(eje, { epoch: EPOCA_0_BTML });

// El transporte simulado, con el reloj del relé en nuestras manos (es el instante que firma en el recibo).
let relojRele = Date.parse('2026-11-10T10:20:00Z');
let transporte;
before(async () => {
  const ahora = () => new Date(relojRele);
  transporte = await arrancarTransporte({ puerto: 0, secreto: 'prueba', rele: new Rele({ ahora }), ahora });
});
after(async () => transporte.cerrar());

async function crearEje(url, nombre) {
  const r = await fetch(url + '/eventos/ejes', { method: 'POST', headers: { 'X-Crear-Ejes': 'prueba', 'Content-Type': 'application/json' }, body: JSON.stringify({ eje: nombre }) });
  return (await r.json()).claveLectura;
}

/** Un eje con un evento firmado y real (src/evento.js): { eje, ev, cuenta }. */
async function ejeConUnEvento() {
  const cuenta = await generarClaves();
  const eje = await Eje.genesis({ identidad: 'vg', foco: ['mi eje'], t: T(0), clave: cuenta.publica, privada: cuenta.privada, exigirFirmas: true });
  const ev = await eje.escribir({ autor: 'vg', sobre: eje.genesisId, t: T(1), movimientos: [minuto('vg')], payload: ['uno'] }, cuenta.privada);
  return { eje, ev, cuenta };
}

/** Sube un eje con un evento al transporte (con el relé marcando `hora`): { eje, ev, cuenta, S, informe, claveLectura }. */
async function subirAlTransporte(nombre, hora, opciones = {}) {
  relojRele = Date.parse(hora);
  const claveLectura = await crearEje(transporte.url, nombre);
  const { eje, ev, cuenta } = await ejeConUnEvento();
  const S = new Sincronia({ url: transporte.url, eje: nombre, claveLectura, ...opciones });
  const informe = await S.sincronizar(eje);
  return { eje, ev, cuenta, S, informe, claveLectura };
}

test('paridad: subir un evento real al transporte simulado rellena X.6.8.1 (instante y relé) sin tocar el evento (cuerpo, id, firma)', async () => {
  const { eje, ev, cuenta } = await ejeConUnEvento();
  const antes = canonico(ev);
  assert.deepEqual(conSujeto('=count (first it.6).8.1', ctxDe(eje), ev.id).valor, [0], 'vacío antes del transporte');
  assert.equal(eje.recibo(ev.id), null);

  relojRele = Date.parse('2026-11-10T10:20:00Z');
  const claveLectura = await crearEje(transporte.url, 'paridad');
  const S = new Sincronia({ url: transporte.url, eje: 'paridad', claveLectura });
  const informe = await S.sincronizar(eje);
  assert.deepEqual(informe.errores, []);
  assert.deepEqual(informe.subidos, [eje.genesisId, ev.id]);
  assert.deepEqual(informe.recibos.recibidos, [eje.genesisId, ev.id]);
  assert.deepEqual([informe.recibos.pendientes, informe.recibos.errores], [0, []]);

  // El recibo es el del relé: su instante es el `recibido` del servidor y su clave, la del relé del transporte.
  const r = eje.recibo(ev.id);
  assert.equal(r.rele, transporte.servicio.rele.publica);
  assert.equal(r.instante, S.recibido(ev.id));
  assert.equal(r.instante, '2026-11-10T10:20:00.000Z');
  assert.match(r.firma, /^[0-9a-f]{128}$/);
  assert.deepEqual(S.estadoDeRecibo(ev.id), r);

  // 6.8.1 relleno (el instante primero, se despliega como fecha; después la clave del relé); 6.8.0 y 6.8.2 como antes.
  const c = ctxDe(eje);
  assert.deepEqual(conSujeto('=(first it.6).8.1', c, ev.id).valor, [r.instante, r.rele]);
  assert.deepEqual(conSujeto('=first (first it.6).8.1.0', c, ev.id).valor, [Date.parse(r.instante) / 1000]);
  assert.deepEqual(conSujeto('=first (first it.6).8.0.0', c, ev.id).valor, [Date.parse(ev.t) / 1000]);
  assert.deepEqual(conSujeto('=count (first it.6).8.2', c, ev.id).valor, [0], 'el sello, vacío: es otro reloj');

  // El evento, intacto: mismo cuerpo, mismo id, misma firma y sigue siendo del eje.
  assert.equal(canonico(eje.obtener(ev.id)), antes);
  assert.equal(await verificarId(eje.obtener(ev.id)), true);
  assert.equal(await verificarFirma(eje.obtener(ev.id), cuenta.publica), true);
  assert.equal(eje.obtener(ev.id), ev);

  // Lo que dio el transporte, tal cual: GET /eventos/recibo (con la clave de lectura).
  const directo = await fetch(transporte.url + '/eventos/recibo?eje=paridad&id=' + ev.id, { headers: { 'X-Clave-Lectura': claveLectura } }).then((x) => x.json());
  assert.deepEqual([directo.instante, directo.rele, directo.firma], [r.instante, r.rele, r.firma]);
  assert.equal(r.recibo, directo.recibo);

  // Un recibo mal formado o de otro registro no entra; el más antiguo se queda.
  assert.equal(eje.marcarRecibo('0'.repeat(64), r), false);
  assert.equal(eje.marcarRecibo(ev.id, { instante: r.instante, rele: 'x', firma: r.firma }), false);
  assert.equal(eje.marcarRecibo(ev.id, { instante: r.instante, rele: r.rele, firma: 'abc' }), false);
  assert.equal(eje.marcarRecibo(ev.id, { instante: '2027-01-01T00:00:00.000Z', rele: r.rele, firma: r.firma }), false);
  assert.equal(eje.recibo(ev.id).instante, r.instante);
  assert.equal(eje.marcarRecibo(ev.id, { instante: '2026-11-10T10:10:00.000Z', rele: r.rele, firma: r.firma }), true, 'uno anterior gana');
  assert.equal(eje.recibo(ev.id).instante, '2026-11-10T10:10:00.000Z');

  // Segunda pasada: nada nuevo que pedir.
  assert.equal((await S.sincronizar(eje)).recibos, undefined);
});

test('lo que baja otro dispositivo también lleva su recibo; reordenar el eje lo conserva; se guarda, se restaura y marcarRecibos lo repone', async () => {
  const { eje: ejeA, ev, S: A, claveLectura } = await subirAlTransporte('baja', '2026-11-10T10:20:00Z');
  const B = new Sincronia({ url: transporte.url, eje: 'baja', claveLectura });
  const informe = await B.sincronizar(null);
  const ejeB = informe.eje;
  assert.deepEqual(informe.recibos.recibidos.sort(), [ejeA.genesisId, ev.id].sort());
  assert.deepEqual(ejeB.recibo(ev.id), ejeA.recibo(ev.id));

  const { rechazados } = await ejeA.reordenar([...ejeA.orden]);
  assert.deepEqual(rechazados, []);
  assert.equal(ejeA.recibo(ev.id).instante, '2026-11-10T10:20:00.000Z');

  // Guardar y restaurar: el estado vuelve; marcarRecibos lo pone en un eje nuevo (como marcarReloj y marcarSellos).
  const guardado = JSON.parse(JSON.stringify(A.serializar()));
  assert.equal(guardado.recibos.length, 2);
  const A2 = Sincronia.restaurar(guardado, { claveLectura });
  assert.deepEqual(A2.estadoDeRecibo(ev.id), ejeA.recibo(ev.id));
  const ejeA2 = await Eje.desde([...ejeA.orden].map((id) => ejeA.obtener(id)), { exigirFirmas: true });
  assert.equal(ejeA2.recibo(ev.id), null);
  assert.equal(A2.marcarRecibos(ejeA2), 2);
  assert.deepEqual(ejeA2.recibo(ev.id), ejeA.recibo(ev.id));
});

test('«clocks out of order» (X.6.9): falso con los tres relojes en orden (libro → recibo → sello) y dentro del margen; verdadero si el recibo va antes del t del libro más de 600 s', async () => {
  const sellar = async (eje, ev, inicio) => {
    const sello = selloSimulado({ inicio, reloj: () => Date.parse(inicio) }); // el bloque 1 sale 10 minutos después
    await sello.sellar([ev.id]);
    await sello.minar();
    eje.marcarSello(ev.id, await sello.prueba(ev.id));
  };
  const rara = (eje, ev) => conSujeto('=first (first it.6).9', ctxDe(eje), ev.id).valor[0];

  // En orden: libro 10:01 → recibo 10:20 → sello 10:40.
  let { eje, ev } = await subirAlTransporte('orden', '2026-11-10T10:20:00Z');
  assert.equal(rara(eje, ev), false, 'solo con el recibo, en orden');
  await sellar(eje, ev, '2026-11-10T10:30:00Z');
  const [libro, recibo, sello] = [Date.parse(ev.t), Date.parse(eje.recibo(ev.id).instante), Date.parse(eje.sello(ev.id).instante)];
  assert.ok(libro < recibo && recibo < sello, 'los tres relojes en orden');
  assert.equal(rara(eje, ev), false);
  assert.equal(relojesFueraDeOrden(eje, ev.id), false);

  // Dentro del margen (epoch.7.3.0 = 600 s): el recibo 6 minutos antes del t del libro no es una cuenta rara.
  ({ eje, ev } = await subirAlTransporte('margen', '2026-11-10T09:55:00Z'));
  assert.equal(rara(eje, ev), false);
  assert.equal(relojesFueraDeOrden(eje, ev.id), false);

  // Más allá del margen: el recibo 21 minutos antes del t del libro es la cuenta rara (aunque la prueba de llegada valga).
  ({ eje, ev } = await subirAlTransporte('fuera', '2026-11-10T09:40:00Z'));
  assert.equal(rara(eje, ev), true);
  assert.equal(relojesFueraDeOrden(eje, ev.id), true);
  // Y entre el recibo y el sello: un sello anterior al recibo más del margen del bloque (7.3.1) también lo es.
  ({ eje, ev } = await subirAlTransporte('recibo-sello', '2026-11-10T14:00:00Z'));
  assert.equal(relojesFueraDeOrden(eje, ev.id), false);
  await sellar(eje, ev, '2026-11-10T10:30:00Z'); // el bloque, a las 10:40; el recibo, a las 14:00: más de 7200 s después
  assert.equal(relojesFueraDeOrden(eje, ev.id), true, 'el sello va antes que el recibo');
});

// --- Un servidor sin la ruta, o con fallos: nada se rompe ---

/** Una `fetch` que cuenta las peticiones a /eventos/recibo y deja a `alRecibo` contestar (o seguir al servidor real). */
function fetchConRecibo(base, alRecibo = null) {
  const espia = { llamadas: 0 };
  espia.fetch = async (url, op) => {
    if (String(url).includes('/eventos/recibo')) {
      espia.llamadas += 1;
      const r = await alRecibo?.(url, op, espia.llamadas);
      if (r) return r;
    }
    return base(url, op);
  };
  return espia;
}
const json = (estado, cuerpo) => new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'Content-Type': 'application/json' } });
let base = fetch;

/** Un eje en el servidor de prueba de AGRAM (que sirve /eventos/recibo en memoria) o en una función sin la ruta. */
async function conServidorSinRuta() {
  const manejar = crearApi({ almacen: almacenEnMemoria(), crearEjes: { secreto: 'prueba' } }); // como la función de Supabase: sin /recibo
  const antes = base;
  base = (url, op) => manejar(new Request(url, op));
  const claveLectura = (await (await base('http://f/functions/v1/eventos/ejes', { method: 'POST', headers: { 'X-Crear-Ejes': 'prueba' }, body: JSON.stringify({ eje: 'sin-ruta' }) })).json()).claveLectura;
  return { claveLectura, restaurar: () => { base = antes; } };
}

test('un servidor sin la ruta (la función de Supabase, 404 o 405) no rompe nada: se detecta una vez por sesión y no se insiste', async () => {
  const variantes = [
    ['la función de Supabase (lo toma por una lectura de eventos)', null],
    ['404', () => json(404, { error: 'no encontrado' })],
    ['405', () => json(405, { error: 'solo GET y POST' })],
  ];
  for (const [nombre, alRecibo] of variantes) {
    const s = await conServidorSinRuta();
    try {
      const espia = fetchConRecibo(base, alRecibo);
      const { eje, ev, cuenta } = await ejeConUnEvento();
      const S = new Sincronia({ url: 'http://f/functions/v1', eje: 'sin-ruta', claveLectura: s.claveLectura, fetch: espia.fetch });
      let informe = await S.sincronizar(eje);
      assert.deepEqual(informe.subidos, [eje.genesisId, ev.id], nombre);
      assert.deepEqual(informe.errores, [], nombre);
      assert.equal(informe.recibos, undefined, nombre + ': sin informe de recibos');
      assert.equal(eje.recibo(ev.id), null, nombre);
      assert.equal(espia.llamadas, 1, nombre + ': una sola petición');
      assert.equal(S.estadoDeRecibo(ev.id), undefined, nombre + ': nada que guardar');
      // Más eventos, más pasadas: no se insiste.
      await eje.escribir({ autor: 'vg', sobre: ev.id, t: T(2), movimientos: [minuto('vg')], payload: ['dos'] }, cuenta.privada);
      informe = await S.sincronizar(eje);
      assert.equal(informe.subidos.length, 1, nombre);
      assert.equal(informe.recibos, undefined, nombre);
      assert.equal(espia.llamadas, 1, nombre + ': no insiste');
      assert.equal(S.serializar().recibos, undefined);
    } finally {
      s.restaurar();
    }
  }
});

test('un fallo del recibo (sin red, 500) queda en informe.recibos.errores, no rompe la sincronización y se reintenta; un id sin recibo no se vuelve a pedir', async () => {
  base = fetch;
  relojRele = Date.parse('2026-11-10T10:20:00Z');
  const claveLectura = await crearEje(transporte.url, 'fallos');
  const { eje, ev, cuenta } = await ejeConUnEvento();
  let modo = 'sin red';
  const espia = fetchConRecibo(fetch, () => {
    if (modo === 'sin red') throw new TypeError('fetch failed');
    if (modo === '500') return json(500, { error: 'se cayó' });
    if (modo === 'sin recibo') return json(404, { error: 'sin recibo para ese id en ese eje' });
    return null;
  });
  const S = new Sincronia({ url: transporte.url, eje: 'fallos', claveLectura, fetch: espia.fetch });
  let informe = await S.sincronizar(eje);
  assert.deepEqual(informe.subidos, [eje.genesisId, ev.id], 'la sincronización sube igual');
  assert.deepEqual(informe.errores, []);
  assert.deepEqual([informe.recibos.recibidos, informe.recibos.pendientes], [[], 2]);
  assert.match(informe.recibos.errores[0].motivo, /sin red/);
  assert.equal(S.estadoDeRecibo(ev.id), 'por pedir');
  assert.equal(eje.recibo(ev.id), null);

  modo = '500';
  informe = await S.sincronizar(eje);
  assert.match(informe.recibos.errores[0].motivo, /500/);
  assert.deepEqual(informe.errores, []);
  assert.equal(S.estadoDeRecibo(ev.id), 'por pedir');

  modo = 'bien';
  informe = await S.sincronizar(eje);
  assert.deepEqual(informe.recibos.recibidos, [eje.genesisId, ev.id]);
  assert.deepEqual(informe.recibos.errores, []);
  assert.ok(eje.recibo(ev.id));

  // La ruta existe pero ese id no tiene recibo: «sin recibo», y no se insiste.
  modo = 'sin recibo';
  const e2 = await eje.escribir({ autor: 'vg', sobre: ev.id, t: T(2), movimientos: [minuto('vg')], payload: ['dos'] }, cuenta.privada);
  informe = await S.sincronizar(eje);
  assert.deepEqual(informe.recibos.errores, []);
  assert.equal(S.estadoDeRecibo(e2.id), 'sin recibo');
  const llamadas = espia.llamadas;
  assert.equal((await S.sincronizar(eje)).recibos, undefined);
  assert.equal(espia.llamadas, llamadas, 'no se vuelve a pedir');
  assert.equal(JSON.parse(JSON.stringify(S.serializar())).recibos.find(([id]) => id === e2.id)[1], 'sin recibo');
});

test('los recibos se piden en tandas (500 por pasada; aquí 5 para que sea rápido): el resto, en la pasada siguiente', async () => {
  assert.equal(RECIBOS_POR_PASADA, 500);
  const { eje, cuenta } = await ejeConUnEvento();
  const tanda = 5;
  const ids = [];
  for (let k = 0; k < tanda + 3; k++) ids.push((await eje.escribir({ autor: 'vg', sobre: eje.genesisId, t: T(2), movimientos: [minuto('vg')], payload: ['n' + k] }, cuenta.privada)).id);
  const forma = { instante: '2026-11-10T10:20:00.000Z', rele: 'a'.repeat(64), firma: 'b'.repeat(128) };
  const espia = fetchConRecibo(fetch, () => json(200, forma));
  const guardado = { version: 1, url: 'http://x', eje: 'tandas', recibos: ids.map((id) => [id, 'por pedir']) };
  const S = Sincronia.restaurar(guardado, { claveLectura: 'k', fetch: espia.fetch, recibosPorPasada: tanda });
  let informe = await S.sincronizar(eje, { bajar: false, subir: false });
  assert.equal(informe.recibos.recibidos.length, tanda);
  assert.equal(informe.recibos.pendientes, 3);
  assert.equal(espia.llamadas, tanda);
  informe = await S.sincronizar(eje, { bajar: false, subir: false });
  assert.equal(informe.recibos.recibidos.length, 3);
  assert.equal(informe.recibos.pendientes, 0);
  assert.equal((await S.sincronizar(eje, { bajar: false, subir: false })).recibos, undefined);
});

// --- Los archivos adjuntos: el servicio simulado da lo mismo que el servidor de prueba de AGRAM ---

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const HTML = new TextEncoder().encode('<!doctype html><html><head><title>landing</title></head><body><h1>AGRAM</h1><script>alert(1)</script></body></html>');
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82]);
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4"/></svg>');

test('archivos: subir y bajar por el transporte simulado (cifrando por debajo) da lo mismo que por el servidor de prueba de AGRAM: archivo:<sha256 del original>', async () => {
  const prueba = await arrancarPrueba({ puerto: 0, secreto: 'prueba' });
  try {
    const recorrido = async (url, eje) => {
      const claveLectura = await crearEje(url, eje);
      const destino = () => ({ url, eje, claveLectura });
      const a = new Archivos({ destino });
      const subidos = [];
      for (const [nombre, bytes] of [['landing.html', HTML], ['x.png', PNG], ['x.svg', SVG]]) subidos.push(await a.adjuntar({ nombre, bytes }));
      // Otra pestaña, sin caché: lo baja del servidor.
      const b = new Archivos({ destino });
      const bajados = [];
      for (const s of subidos) {
        const e = await b.bajar(s.id);
        bajados.push({ estado: e.estado, tipo: e.tipo, bytes: Array.from(e.bytes) });
      }
      // Y a mano: la respuesta HTTP (tipo y política de lo que se sirve), la repetición (idempotente) y lo que no está.
      const crudo = await fetch(url + '/archivos/' + sha(HTML) + '?eje=' + eje, { headers: { 'X-Clave-Lectura': claveLectura } });
      const cabeceras = [crudo.status, crudo.headers.get('content-type'), crudo.headers.get('content-security-policy'), crudo.headers.get('x-content-type-options')];
      const otra = await fetch(url + '/archivos?eje=' + eje, { method: 'POST', headers: { 'Content-Type': 'text/html', 'X-Clave-Lectura': claveLectura }, body: HTML });
      const faltan = await fetch(url + '/archivos/' + 'e'.repeat(64) + '?eje=' + eje, { headers: { 'X-Clave-Lectura': claveLectura } });
      return { subidos, bajados, cabeceras, repetido: [otra.status, (await otra.json()).id], falta: faltan.status };
    };
    const simulado = await recorrido(transporte.url, 'arch');
    const deAgram = await recorrido(prueba.url, 'arch');
    assert.deepEqual(simulado, deAgram);
    assert.deepEqual(simulado.subidos.map((s) => s.referencia), [HTML, PNG, SVG].map((b) => 'archivo:' + sha(b)), 'la referencia es el SHA-256 del ORIGINAL');
    assert.deepEqual(simulado.bajados.map((x) => x.bytes), [HTML, PNG, SVG].map((b) => Array.from(b)), 'vuelve el original, no el cifrado');
    assert.deepEqual(simulado.repetido, [200, sha(HTML)]);
    assert.equal(simulado.falta, 404);
  } finally {
    await prueba.cerrar();
  }
});
