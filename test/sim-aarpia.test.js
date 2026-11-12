// Pruebas del transporte simulado de AARPIA (servidor/sim/aarpia/), copiadas del d282161 de
// InTheState/aarpia/transporte con las rutas adaptadas: ayuda.js, rele.test.js, servicio.test.js y archivos.test.js
// en un solo archivo. vendor.test.js (las copias de AGRAM) ya no hace falta: la simulación importa directamente las de
// este repo.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { canonico, cuerpo, hash, RAIZ } from '../servidor/supabase/funciones/eventos/verificar.js';
import { schnorr } from '../servidor/supabase/funciones/eventos/noble-secp256k1.js';
import { Rele, KIND_EVENTO, KIND_RECIBO, pasaFiltro, relojDeRecibo } from '../servidor/sim/aarpia/src/rele.js';
import { firmar, verificar, generarClaves, valores, serializar, aBytes, aHex } from '../servidor/sim/aarpia/src/nostr.js';
import { envolver, desenvolver, destinatarios } from '../servidor/sim/aarpia/src/sobre.js';
import { crearBlossom, autorizacion, POLITICA } from '../servidor/sim/aarpia/src/blossom.js';
import { crearServicio } from '../servidor/sim/aarpia/src/servicio.js';
import { arrancar } from '../servidor/sim/aarpia/servidor.mjs';
import { crearArchivos } from '../servidor/supabase/funciones/archivos/api.js';
import { crearApi } from '../servidor/supabase/funciones/eventos/api.js';
import { almacenEnMemoria } from '../servidor/prueba/servidor.mjs';

/** Un evento AGRAM firmado por `autor` con `privada`. */
async function eventoAgram({ autor, privada, sobre = null, en = RAIZ, t = '2026-11-12T12:00:00+01:00', movimientos = [], payload = [], contexto = {} }) {
  const ev = { autor, sobre, en, t, movimientos, payload, contexto };
  ev.id = await hash(canonico(cuerpo(ev)));
  ev.firmante = autor;
  ev.firma = aHex(schnorr.sign(aBytes(ev.id), aBytes(privada)));
  return ev;
}

/** Un eje de prueba: el génesis de `vg` y el alta de `huesped`, con sus claves. */
async function ejeDePrueba() {
  const vg = generarClaves();
  const huesped = generarClaves();
  const genesis = await eventoAgram({ autor: 'vg', privada: vg.privada, contexto: { genesis: true, claves: { vg: vg.publica } } });
  const alta = await eventoAgram({ autor: 'vg', privada: vg.privada, sobre: genesis.id, contexto: { claves: { huesped: huesped.publica } } });
  return { vg, huesped, genesis, alta };
}

/** Un movimiento de T de `de` a `a`. */
const mover = (de, a, cantidad = 1) => ({ token: 'T', escala: 'minuto', cantidad, de, a });

describe('sim aarpia: relé Nostr', () => {
  const reloj = (iso) => {
    let t = Date.parse(iso);
    return () => new Date((t += 1500));
  };

  test('nostr: firmar y verificar; tocar el contenido rompe el id', async () => {
    const k = generarClaves();
    const ev = await firmar({ kind: 1, created_at: 1700000000, tags: [['t', 'x']], content: 'hola' }, k.privada);
    assert.equal(ev.pubkey, k.publica);
    assert.equal(await verificar(ev), true);
    assert.equal(await verificar({ ...ev, content: 'adiós' }), false);
    assert.equal(await verificar({ ...ev, sig: '0'.repeat(128) }), false);
    assert.equal(serializar(ev), JSON.stringify([0, ev.pubkey, 1700000000, 1, [['t', 'x']], 'hola']));
  });

  test('sobre: etiquetas g, s, p (resueltas por el alta, sin el autor), h, u; ida y vuelta', async () => {
    const { vg, huesped, genesis } = await ejeDePrueba();
    const ev = await eventoAgram({ autor: 'vg', privada: vg.privada, sobre: genesis.id, movimientos: [mover('vg', 'huesped'), mover('vg', 'vg'), mover('vg', 'huesped')] });
    assert.deepEqual(destinatarios(ev), ['huesped']);
    const claves = { huesped: huesped.publica };
    const s = await envolver({ evento: ev, eje: 'prueba', privada: vg.privada, claveDe: async (n) => claves[n] });
    assert.equal(s.kind, KIND_EVENTO);
    assert.equal(s.pubkey, vg.publica, 'el sobre lo firma el autor');
    assert.deepEqual(valores(s, 'g'), [ev.id]);
    assert.deepEqual(valores(s, 's'), [genesis.id]);
    assert.deepEqual(valores(s, 'p'), [huesped.publica]);
    assert.deepEqual(valores(s, 'h'), ['prueba']);
    assert.deepEqual(valores(s, 'u'), ['vg']);
    assert.deepEqual(desenvolver(s), ev, 'el evento AGRAM viaja sin tocar');
    assert.throws(() => desenvolver({ ...s, tags: [['g', 'f'.repeat(64)]] }));
  });

  test('relé: acepta, rechaza lo mal firmado o de otro kind, y es idempotente', async () => {
    const rele = new Rele();
    const k = generarClaves();
    const ev = await firmar({ kind: KIND_EVENTO, created_at: 1, tags: [['g', 'a'.repeat(64)]], content: '{}' }, k.privada);
    assert.equal((await rele.publicar(ev)).ok, true);
    const otra = await rele.publicar(ev);
    assert.equal(otra.ok, true);
    assert.equal(otra.duplicado, true);
    assert.equal((await rele.publicar({ ...ev, id: 'b'.repeat(64) })).ok, false);
    const nota = await firmar({ kind: 1, created_at: 1, tags: [], content: '' }, k.privada);
    assert.match((await rele.publicar(nota)).motivo, /^blocked/);
  });

  test('relé: el recibo 7701 lo firma el relé, lleva e/g/h y el instante de llegada (X.6.8.1)', async () => {
    const rele = new Rele({ ahora: () => new Date('2026-11-12T11:00:05.250Z') });
    const { vg, genesis } = await ejeDePrueba();
    const s = await envolver({ evento: genesis, eje: 'prueba', privada: vg.privada, ahora: new Date('2026-11-12T10:59:00Z') });
    const { recibo } = await rele.publicar(s);
    assert.equal(recibo.kind, KIND_RECIBO);
    assert.equal(recibo.pubkey, rele.publica);
    assert.equal(await verificar(recibo), true);
    assert.deepEqual(valores(recibo, 'e'), [s.id]);
    assert.deepEqual(valores(recibo, 'g'), [genesis.id]);
    assert.deepEqual(valores(recibo, 'h'), ['prueba']);
    assert.equal(recibo.created_at, Date.parse('2026-11-12T11:00:05Z') / 1000);
    assert.deepEqual(relojDeRecibo(recibo), { instante: '2026-11-12T11:00:05.250Z', rele: rele.publica, firma: recibo.sig, recibo: recibo.id });
    assert.equal(rele.reciboDe(s.id).id, recibo.id);
    // Un 'ms' que no cuadra con created_at no se cree: vale el segundo firmado.
    const falso = { ...recibo, tags: [['ms', '2030-01-01T00:00:00.000Z']] };
    assert.equal(relojDeRecibo(falso).instante, '2026-11-12T11:00:05.000Z');
  });

  test('relé: filtros #s (todo lo que cuelga de X), #p (mi diario por tokens), #h, #u, authors, kinds, since/until, limit', async () => {
    const rele = new Rele({ ahora: reloj('2026-11-12T11:00:00Z') });
    const { vg, huesped, genesis, alta } = await ejeDePrueba();
    const claves = { vg: vg.publica, huesped: huesped.publica };
    const claveDe = async (n) => claves[n];
    const pago = await eventoAgram({ autor: 'vg', privada: vg.privada, sobre: alta.id, movimientos: [mover('vg', 'huesped', 3)] });
    const respuesta = await eventoAgram({ autor: 'huesped', privada: huesped.privada, sobre: pago.id, movimientos: [mover('huesped', 'vg')] });
    const sobres = [];
    let t = 1000;
    for (const [ev, priv] of [[genesis, vg.privada], [alta, vg.privada], [pago, vg.privada], [respuesta, huesped.privada]]) {
      const s = await envolver({ evento: ev, eje: 'prueba', privada: priv, claveDe, ahora: new Date((t += 10) * 1000) });
      sobres.push(s);
      assert.equal((await rele.publicar(s)).ok, true);
    }
    const ag = (lista) => lista.map((s) => desenvolver(s).id);
    assert.deepEqual(ag(rele.consultar({ kinds: [KIND_EVENTO], '#s': [genesis.id] })), [alta.id]);
    assert.deepEqual(ag(rele.consultar({ kinds: [KIND_EVENTO], '#p': [huesped.publica] })), [pago.id]);
    assert.deepEqual(ag(rele.consultar({ kinds: [KIND_EVENTO], '#p': [vg.publica] })), [respuesta.id]);
    assert.equal(rele.consultar({ kinds: [KIND_EVENTO], '#h': ['prueba'] }).length, 4);
    assert.equal(rele.consultar({ kinds: [KIND_EVENTO], '#h': ['otro'] }).length, 0);
    assert.deepEqual(ag(rele.consultar({ kinds: [KIND_EVENTO], '#u': ['huesped'] })), [respuesta.id]);
    assert.deepEqual(ag(rele.consultar({ kinds: [KIND_EVENTO], authors: [huesped.publica] })), [respuesta.id]);
    assert.equal(rele.consultar({ kinds: [KIND_RECIBO] }).length, 4);
    assert.deepEqual(ag(rele.consultar({ kinds: [KIND_EVENTO], since: 1030 })), [respuesta.id, pago.id], 'más reciente primero');
    assert.deepEqual(ag(rele.consultar({ kinds: [KIND_EVENTO], until: 1010 })), [genesis.id]);
    assert.deepEqual(ag(rele.consultar({ kinds: [KIND_EVENTO], limit: 1 })), [respuesta.id]);
    assert.equal(pasaFiltro(sobres[0], { '#g': [genesis.id], kinds: [KIND_EVENTO] }), true);
  });

  test('relé: una suscripción a mi #p recibe lo guardado, el EOSE y lo nuevo, y deja de recibir al cerrar', async () => {
    const rele = new Rele();
    const { vg, huesped, genesis } = await ejeDePrueba();
    const claveDe = async (n) => ({ huesped: huesped.publica })[n];
    const llegan = [];
    let eose = 0;
    const env = async (cantidad) => {
      const ev = await eventoAgram({ autor: 'vg', privada: vg.privada, sobre: genesis.id, movimientos: [mover('vg', 'huesped', cantidad)] });
      await rele.publicar(await envolver({ evento: ev, eje: 'prueba', privada: vg.privada, claveDe }));
      return ev.id;
    };
    const antes = await env(1);
    const cerrar = rele.suscribir([{ kinds: [KIND_EVENTO], '#p': [huesped.publica] }], (s) => llegan.push(desenvolver(s).id), () => eose++);
    assert.deepEqual(llegan, [antes]);
    assert.equal(eose, 1);
    const despues = await env(2);
    assert.deepEqual(llegan, [antes, despues]);
    cerrar();
    await env(3);
    assert.equal(llegan.length, 2);
  });
});

describe('sim aarpia: servicio HTTP', () => {
  const BASE = 'http://prueba.local/functions/v1/eventos';
  const json = (r) => r.json();

  /** Recorre el contrato con `manejar` y devuelve lo que contesta cada paso (sin los instantes). */
  async function recorrido(manejar, ev) {
    const pasos = [];
    const pedir = async (nombre, url, init = {}) => {
      const r = await manejar(new Request(url, init));
      const cuerpo = await r.json();
      pasos.push({ nombre, estado: r.status, cuerpo });
      return cuerpo;
    };
    const { claveLectura } = await pedir('crear eje', BASE + '/ejes', { method: 'POST', headers: { 'X-Crear-Ejes': 'prueba', 'Content-Type': 'application/json' }, body: JSON.stringify({ eje: 'vg' }) });
    const h = { 'X-Clave-Lectura': claveLectura, 'Content-Type': 'application/json' };
    const subir = (nombre, evento, cab = h) => pedir(nombre, BASE, { method: 'POST', headers: cab, body: JSON.stringify({ eje: 'vg', evento }) });
    await pedir('eje repetido', BASE + '/ejes', { method: 'POST', headers: { 'X-Crear-Ejes': 'prueba' }, body: JSON.stringify({ eje: 'vg' }) });
    await subir('no génesis en eje vacío', ev.alta);
    await subir('génesis', ev.genesis);
    await subir('génesis repetido', ev.genesis);
    await subir('sin clave', ev.alta, { 'Content-Type': 'application/json' });
    await subir('alta', ev.alta);
    await subir('firma tocada', { ...ev.pago, firma: 'f'.repeat(128) });
    await subir('autor sin alta', ev.extrano);
    await subir('pago', ev.pago);
    await pedir('bajar', BASE + '?eje=vg&desde=0', { headers: h });
    await pedir('bajar desde 2', BASE + '?eje=vg&desde=2&cuantos=1', { headers: h });
    await pedir('eje desconocido', BASE + '?eje=nadie', { headers: h });
    await pedir('clave mala', BASE + '?eje=vg', { headers: { 'X-Clave-Lectura': 'x' } });
    return { pasos, claveLectura };
  }

  async function eventos() {
    const base = await ejeDePrueba();
    const pago = await eventoAgram({ autor: 'vg', privada: base.vg.privada, sobre: base.alta.id, movimientos: [mover('vg', 'huesped', 2)] });
    const extrano = await eventoAgram({ autor: 'nadie', privada: base.huesped.privada, sobre: base.genesis.id });
    return { ...base, pago, extrano };
  }

  /** Quita los instantes y la clave de lectura (cambian en cada corrida). */
  const sinVariables = (pasos) => JSON.parse(JSON.stringify(pasos, (k, v) => (['recibido', 'creado', 'claveLectura'].includes(k) ? '·' : v)));

  test('servicio: el recorrido del contrato de `eventos`', async () => {
    const ev = await eventos();
    const s = crearServicio();
    const { pasos, claveLectura } = await recorrido(s.manejar, ev);
    const estados = Object.fromEntries(pasos.map((p) => [p.nombre, p.estado]));
    assert.deepEqual(estados, {
      'crear eje': 201, 'eje repetido': 409, 'no génesis en eje vacío': 400, 'génesis': 201, 'génesis repetido': 200, 'sin clave': 401,
      'alta': 201, 'firma tocada': 400, 'autor sin alta': 403, 'pago': 201, 'bajar': 200, 'bajar desde 2': 200, 'eje desconocido': 404, 'clave mala': 401,
    });
    const bajar = pasos.find((p) => p.nombre === 'bajar').cuerpo;
    assert.deepEqual(bajar.eventos.map((e) => [e.orden, e.evento.id]), [[1, ev.genesis.id], [2, ev.alta.id], [3, ev.pago.id]]);
    assert.deepEqual(bajar.eventos[2].evento, ev.pago, 'el evento vuelve tal cual');
    assert.equal(pasos.find((p) => p.nombre === 'bajar desde 2').cuerpo.siguiente, null);

    // Lo que ha pasado por debajo: tres 7700 firmados con la clave de transporte, con su p resuelto por el alta.
    const sobres = s.rele.consultar({ kinds: [KIND_EVENTO], '#h': ['vg'] });
    assert.equal(sobres.length, 3);
    const delPago = s.rele.consultar({ kinds: [KIND_EVENTO], '#g': [ev.pago.id] })[0];
    assert.deepEqual(valores(delPago, 'p'), [ev.huesped.publica]);

    // El reloj X.6.8.1: el `recibido` de bajar es el instante del recibo firmado por el relé.
    const r = await s.manejar(new Request(BASE + '/recibo?eje=vg&id=' + ev.pago.id, { headers: { 'X-Clave-Lectura': claveLectura } }));
    assert.equal(r.status, 200);
    const reloj = await r.json();
    assert.equal(reloj.rele, s.rele.publica);
    assert.equal(reloj.instante, bajar.eventos[2].recibido);
    assert.equal((await s.manejar(new Request(BASE + '/recibo?eje=vg&id=' + ev.pago.id, { headers: { 'X-Clave-Lectura': 'x' } }))).status, 401);
    const sin = await s.manejar(new Request(BASE + '/recibo?eje=vg&id=' + 'e'.repeat(64), { headers: { 'X-Clave-Lectura': claveLectura } }));
    assert.equal(sin.status, 404);
    assert.deepEqual(await sin.json(), { error: 'sin recibo para ese id en ese eje', codigo: 'sin-recibo' });
    const nadie = await s.manejar(new Request(BASE + '/recibo?eje=nadie&id=' + ev.pago.id, { headers: { 'X-Clave-Lectura': claveLectura } }));
    assert.deepEqual([nadie.status, (await nadie.json()).codigo], [404, 'eje-desconocido']);
  });

  test('paridad con el servidor de prueba de AGRAM ', async () => {
    const ev = await eventos();
    const deAgram = crearApi({ almacen: almacenEnMemoria(), crearEjes: { secreto: 'prueba' } });
    const nuestro = crearServicio();
    const a = sinVariables((await recorrido(deAgram, ev)).pasos);
    const b = sinVariables((await recorrido(nuestro.manejar, ev)).pasos);
    assert.deepEqual(b, a);
  });

  test('servidor HTTP: arranca, crea un eje y sube el génesis por red', async () => {
    const ev = await ejeDePrueba();
    const s = await arrancar();
    try {
      const c = await fetch(s.url + '/eventos/ejes', { method: 'POST', headers: { 'X-Crear-Ejes': 'prueba' }, body: JSON.stringify({ eje: 'red' }) }).then(json);
      const r = await fetch(s.url + '/eventos', { method: 'POST', headers: { 'X-Clave-Lectura': c.claveLectura, 'Content-Type': 'application/json' }, body: JSON.stringify({ eje: 'red', evento: ev.genesis }) });
      assert.equal(r.status, 201);
      const b = await fetch(s.url + '/eventos?eje=red&desde=0', { headers: { 'X-Clave-Lectura': c.claveLectura } }).then(json);
      assert.equal(b.eventos[0].evento.id, ev.genesis.id);
    } finally {
      await s.cerrar();
    }
  });
});

describe('sim aarpia: Blossom y archivos', () => {
  const sha = async (b) => aHex(new Uint8Array(await crypto.subtle.digest('SHA-256', b)));
  const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
  const HTML = new TextEncoder().encode('<p>hola <script>alert(1)</script></p>');

  test('blossom: subir con 24242, bajar por sha con cabeceras que no dejan ejecutar, HEAD y DELETE', async () => {
    const b = crearBlossom();
    const k = generarClaves();
    const x = await sha(HTML);
    const put = (cuerpo, auth) => b(new Request('http://b/upload', { method: 'PUT', headers: { 'Content-Type': 'text/html', ...(auth ? { Authorization: auth } : {}) }, body: cuerpo }));
    assert.equal((await put(HTML)).status, 401, 'sin autorización');
    assert.equal((await put(HTML, await autorizacion({ accion: 'upload', sha: 'a'.repeat(64), privada: k.privada }))).status, 401, 'autorización de otro blob');
    assert.equal((await put(HTML, await autorizacion({ accion: 'upload', sha: x, privada: k.privada, ahora: new Date(Date.now() - 3600e3) }))).status, 401, 'caducada');
    const r = await put(HTML, await autorizacion({ accion: 'upload', sha: x, privada: k.privada }));
    assert.equal(r.status, 201);
    assert.equal((await r.json()).sha256, x);
    assert.equal((await put(HTML, await autorizacion({ accion: 'upload', sha: x, privada: k.privada }))).status, 200, 'idempotente');
    const g = await b(new Request('http://b/' + x + '.html'));
    assert.equal(g.status, 200);
    assert.deepEqual(new Uint8Array(await g.arrayBuffer()), HTML);
    assert.equal(g.headers.get('content-security-policy'), POLITICA);
    assert.equal(g.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(g.headers.get('content-disposition'), 'attachment', 'el HTML no se pinta suelto');
    assert.equal((await b(new Request('http://b/' + x, { method: 'HEAD' }))).status, 200);
    const otro = generarClaves();
    assert.equal((await b(new Request('http://b/' + x, { method: 'DELETE', headers: { Authorization: await autorizacion({ accion: 'upload', sha: x, privada: k.privada }) } }))).status, 401, 'upload no vale para delete');
    assert.equal((await b(new Request('http://b/' + x, { method: 'DELETE', headers: { Authorization: await autorizacion({ accion: 'delete', sha: x, privada: otro.privada }) } }))).status, 200);
    assert.equal((await b(new Request('http://b/' + x))).status, 200, 'quien no lo subió no lo borra del todo');
    await b(new Request('http://b/' + x, { method: 'DELETE', headers: { Authorization: await autorizacion({ accion: 'delete', sha: x, privada: k.privada }) } }));
    assert.equal((await b(new Request('http://b/' + x))).status, 404);
  });

  /** Crea un eje en el servicio y devuelve su clave de lectura. */
  async function eje(s, nombre = 'vg') {
    const r = await s.manejar(new Request('http://p/functions/v1/eventos/ejes', { method: 'POST', headers: { 'X-Crear-Ejes': 'prueba' }, body: JSON.stringify({ eje: nombre }) }));
    return (await r.json()).claveLectura;
  }

  /** El recorrido del contrato de `archivos`: lo que contesta cada paso, sin los cuerpos binarios. */
  async function recorrido(manejar, clave) {
    const pasos = [];
    const pedir = async (nombre, url, init = {}) => {
      const r = await manejar(new Request('http://p/functions/v1' + url, init));
      const tipo = r.headers.get('content-type') ?? '';
      const cuerpo = tipo.startsWith('application/json') && !url.includes('/archivos/') ? await r.json() : (await r.arrayBuffer()).byteLength;
      pasos.push({ nombre, estado: r.status, tipo, cuerpo });
    };
    const h = (tipo) => ({ 'X-Clave-Lectura': clave, 'Content-Type': tipo });
    await pedir('subir png', '/archivos?eje=vg', { method: 'POST', headers: h('image/png'), body: PNG });
    await pedir('subir png otra vez', '/archivos?eje=vg', { method: 'POST', headers: h('image/png'), body: PNG });
    await pedir('subir html', '/archivos?eje=vg', { method: 'POST', headers: h('text/html'), body: HTML });
    await pedir('png que no es png', '/archivos?eje=vg', { method: 'POST', headers: h('image/png'), body: HTML });
    await pedir('tipo no admitido', '/archivos?eje=vg', { method: 'POST', headers: h('application/pdf'), body: HTML });
    await pedir('sin clave', '/archivos?eje=vg', { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: PNG });
    await pedir('eje desconocido', '/archivos?eje=nadie', { method: 'POST', headers: h('image/png'), body: PNG });
    await pedir('bajar png', '/archivos/' + (await sha(PNG)) + '?eje=vg', { headers: h('') });
    await pedir('bajar html', '/archivos/' + (await sha(HTML)) + '?eje=vg', { headers: h('') });
    await pedir('bajar desconocido', '/archivos/' + 'e'.repeat(64) + '?eje=vg', { headers: h('') });
    return pasos;
  }

  test('archivos: la API de AGRAM sobre Blossom, cifrando antes de subir', async () => {
    const s = crearServicio();
    const clave = await eje(s);
    const pasos = await recorrido(s.manejar, clave);
    assert.deepEqual(Object.fromEntries(pasos.map((p) => [p.nombre, p.estado])), {
      'subir png': 201, 'subir png otra vez': 200, 'subir html': 201, 'png que no es png': 400, 'tipo no admitido': 415,
      'sin clave': 401, 'eje desconocido': 404, 'bajar png': 200, 'bajar html': 200, 'bajar desconocido': 404,
    });
    // Lo que vuelve es el original, con su tipo y la política de AGRAM.
    const r = await s.manejar(new Request('http://p/archivos/' + (await sha(HTML)) + '?eje=vg', { headers: { 'X-Clave-Lectura': clave } }));
    assert.deepEqual(new Uint8Array(await r.arrayBuffer()), HTML);
    assert.match(r.headers.get('content-type'), /^text\/html/);
    assert.match(r.headers.get('content-security-policy'), /^sandbox/);
    // Lo que guarda Blossom es otra cosa: el cifrado, con otro sha, sin el original dentro.
    const blob = s.archivos.blobDe('vg', await sha(HTML));
    assert.notEqual(blob, await sha(HTML));
    assert.equal((await s.manejar(new Request('http://p/blossom/' + (await sha(HTML))))).status, 404, 'el original no está en Blossom');
    const publico = new Uint8Array(await (await s.manejar(new Request('http://p/blossom/' + blob))).arrayBuffer());
    assert.equal(await sha(publico), blob);
    assert.equal(new TextDecoder('utf-8', { fatal: false }).decode(publico).includes('hola'), false, 'el texto no se ve en el blob');
    // Otro eje no lee los archivos de este.
    const otra = await eje(s, 'otro');
    assert.equal((await s.manejar(new Request('http://p/archivos/' + (await sha(HTML)) + '?eje=otro', { headers: { 'X-Clave-Lectura': otra } }))).status, 404);
  });

  test('archivos: paridad con el servidor de prueba de AGRAM ', async () => {
    const almacen = almacenEnMemoria();
    const eventos = crearApi({ almacen, crearEjes: { secreto: 'prueba' } });
    const archivos = crearArchivos({ almacen });
    const deAgram = (req) => (new URL(req.url).pathname.includes('/archivos') ? archivos(req) : eventos(req));
    const claveA = await eje({ manejar: deAgram });
    const nuestro = crearServicio();
    const claveB = await eje(nuestro);
    assert.deepEqual(await recorrido(nuestro.manejar, claveB), await recorrido(deAgram, claveA));
  });
});
