// El sello de tiempo (el tercer reloj, X.6.8.2): src/sello.js contra la SIMULACIÓN de StateArk
// (servidor/sim/stateark/), y su paso al eje por src/sincronia.js. Paridad: un evento real, creado con src/evento.js y
// firmado, sellado y minado por la simulación, sale en el eje con 6.8.2 relleno sin que cambie su cuerpo, su id ni su
// firma; «clocks out of order» (X.6.9, márgenes en epoch.7.3) da falso con los instantes en orden y verdadero si el
// bloque es anterior al t del libro más allá del margen.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { arrancar } from '../servidor/prueba/servidor.mjs';
import { crearServidor } from '../servidor/sim/stateark/servidor.js';
import { selloSimulado, selloHttp, crearSello, destino, deConfiguracion, ErrorDeSello } from '../src/sello.js';
import { Sincronia } from '../src/sincronia.js';
import { Eje } from '../src/eje.js';
import { verificarId, canonico } from '../src/evento.js';
import { generarClaves, verificar as verificarFirma } from '../src/autoridad.js';
import { evaluar } from '../src/bqlm.js';
import { ContextoEje } from '../src/contexto-eje.js';
import { relojesFueraDeOrden } from '../src/contrato.js';
import { EPOCA_0_BTML } from '../src/epocas.js';
import * as agram from '../src/index.js';

const T = (m) => '2026-11-10T10:' + String(m).padStart(2, '0') + ':00Z';
const minuto = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });
const conSujeto = (expr, ctx, sujeto) => evaluar(expr, ctx, { sujeto });
const ctxDe = (eje) => new ContextoEje(eje, { epoch: EPOCA_0_BTML });

/** Un eje con un evento firmado y real (src/evento.js): { eje, ev, cuenta }. */
async function ejeConUnEvento() {
  const cuenta = await generarClaves();
  const eje = await Eje.genesis({ identidad: 'vg', foco: ['mi eje'], t: T(0), clave: cuenta.publica, privada: cuenta.privada, exigirFirmas: true });
  const ev = await eje.escribir({ autor: 'vg', sobre: eje.genesisId, t: T(1), movimientos: [minuto('vg')], payload: ['uno'] }, cuenta.privada);
  return { eje, ev, cuenta };
}

/** Un sello simulado cuya cadena empieza en `inicio` y cuyo reloj marca ese mismo instante: el bloque 1 sale 10 minutos después. */
const selloEn = (inicio) => selloSimulado({ inicio, reloj: () => Date.parse(inicio) });

test('paridad: sellar, minar y escribir el resultado en 6.8.2 no toca el evento (cuerpo, id, firma); 6.8.2 trae instante, altura y hash', async () => {
  const { eje, ev, cuenta } = await ejeConUnEvento();
  const antes = canonico(ev);
  const sello = selloEn('2026-11-10T10:30:00Z'); // el bloque llega después del t del libro: en orden

  // Vacío antes de sellar.
  assert.deepEqual(conSujeto('=count (first it.6).8.2', ctxDe(eje), ev.id).valor, [0]);
  assert.equal(eje.sello(ev.id), null);

  const r = await sello.sellar([ev.id]);
  assert.equal(r.pendiente, true);
  assert.equal((await sello.prueba(ev.id)).pendiente, true, 'hasta que no se mina, pendiente');
  assert.equal(eje.marcarSello(ev.id, await sello.prueba(ev.id)), false, 'lo pendiente no entra en el eje');
  const bloque = await sello.minar();
  const p = await sello.prueba(ev.id);
  assert.equal(p.altura, bloque.altura);
  assert.equal(p.instante, '2026-11-10T10:40:00.000Z');
  assert.equal((await sello.verificar(ev, p)).ok, true);
  assert.equal(eje.marcarSello(ev.id, p), true);

  // Relleno: el instante primero (se despliega como fecha, como el 6.8.0), después la altura y el hash.
  const c = ctxDe(eje);
  assert.deepEqual(conSujeto('=(first it.6).8.2', c, ev.id).valor, [p.instante, p.altura, p.hash]);
  assert.deepEqual(conSujeto('=first (first it.6).8.2.0', c, ev.id).valor, [Date.parse(p.instante) / 1000]);
  assert.deepEqual(conSujeto('=first (first it.6).8.0.0', c, ev.id).valor, [Date.parse(ev.t) / 1000]);
  assert.deepEqual(conSujeto('=count (first it.6).8.1', c, ev.id).valor, [0], 'Nostr, vacío (aún no hay transporte)');
  assert.deepEqual(eje.sello(ev.id), { altura: p.altura, hash: p.hash, instante: p.instante, verificado: false });

  // El evento, intacto: mismo cuerpo, mismo id, misma firma y sigue siendo del eje.
  assert.equal(canonico(eje.obtener(ev.id)), antes);
  assert.equal(await verificarId(eje.obtener(ev.id)), true);
  assert.equal(await verificarFirma(eje.obtener(ev.id), cuenta.publica), true);
  assert.equal(eje.obtener(ev.id), ev);

  // Un sello mal formado o de otro registro no entra; el más antiguo se queda.
  assert.equal(eje.marcarSello('0'.repeat(64), p), false);
  assert.equal(eje.marcarSello(ev.id, { altura: -1, hash: p.hash, instante: p.instante }), false);
  assert.equal(eje.marcarSello(ev.id, { altura: 9, hash: p.hash, instante: '2027-01-01T00:00:00.000Z' }), false);
  assert.equal(eje.sello(ev.id).altura, p.altura);
});

test('«clocks out of order» (X.6.9): falso con los instantes en orden y dentro del margen; verdadero con un bloque anterior al t del libro más allá de epoch.7.3', async () => {
  const { eje, ev } = await ejeConUnEvento();
  const sinSello = (await conSujeto('=first (first it.6).9', ctxDe(eje), ev.id)).valor[0];
  assert.equal(sinSello, false, 'sin 6.8.2, nunca');

  // En orden: el bloque (10:40) va detrás del t del libro (10:01).
  let sello = selloEn('2026-11-10T10:30:00Z');
  await sello.sellar([ev.id]);
  await sello.minar();
  eje.marcarSello(ev.id, await sello.prueba(ev.id));
  assert.equal(conSujeto('=first (first it.6).9', ctxDe(eje), ev.id).valor[0], false);
  assert.equal(relojesFueraDeOrden(eje, ev.id), false);

  // Dentro del margen (epoch.7.3.1 = 7200 s): un bloque 1 h antes del t del libro no es una cuenta rara.
  const e2 = (await ejeConUnEvento()).eje;
  const ev2 = e2.obtener(e2.orden[1]);
  sello = selloEn('2026-11-10T08:51:00Z'); // el bloque 1 sale a las 09:01: una hora antes de 10:01
  await sello.sellar([ev2.id]);
  await sello.minar();
  e2.marcarSello(ev2.id, await sello.prueba(ev2.id));
  assert.equal(relojesFueraDeOrden(e2, ev2.id), false);

  // Más allá del margen: un instante de bloque muy anterior al t del libro (forzado) es la cuenta rara.
  const e3 = (await ejeConUnEvento()).eje;
  const ev3 = e3.obtener(e3.orden[1]);
  sello = selloEn('2026-11-10T04:00:00Z'); // el bloque 1 sale a las 04:10, casi seis horas antes del t del libro
  await sello.sellar([ev3.id]);
  await sello.minar();
  const p3 = await sello.prueba(ev3.id);
  assert.equal((await sello.verificar(ev3, p3)).ok, true, 'la prueba vale: es la comparación de relojes la que lo marca');
  e3.marcarSello(ev3.id, p3);
  assert.equal(conSujeto('=first (first it.6).9', ctxDe(e3), ev3.id).valor[0], true);
  assert.equal(relojesFueraDeOrden(e3, ev3.id), true);
  // El resto de registros del eje, sin sello, siguen en orden.
  assert.equal(relojesFueraDeOrden(e3, e3.genesisId), false);
});

test('reordenar el eje conserva los sellos (son del libro, no de un orden)', async () => {
  const { eje, ev } = await ejeConUnEvento();
  const sello = selloEn('2026-11-10T10:30:00Z');
  await sello.sellar([ev.id]);
  await sello.minar();
  eje.marcarSello(ev.id, await sello.prueba(ev.id));
  const { rechazados } = await eje.reordenar([...eje.orden]);
  assert.deepEqual(rechazados, []);
  assert.equal(eje.sello(ev.id).altura, 1);
});

test('el adaptador HTTP habla con el servicio de la simulación: sellar, 202 pendiente, minar, prueba, verificar, 404 sin sellar; solo salen ids', async () => {
  const { servidor, sellador } = await crearServidor();
  await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${servidor.address().port}`;
  const visto = [];
  const fetchEspia = (url, op) => { visto.push([url, op?.body]); return fetch(url, op); };
  try {
    const { ev } = await ejeConUnEvento();
    const sello = selloHttp({ url: base + '/', fetch: fetchEspia });
    assert.equal(await sello.prueba(ev.id), null, 'nunca sellado');
    const r = await sello.sellar([ev.id]);
    assert.equal(r.pendiente, true);
    assert.equal((await sello.prueba(ev.id)).pendiente, true);
    await sellador.minar();
    const p = await sello.prueba(ev.id);
    assert.equal(p.altura, 1);
    assert.equal((await sello.verificar(ev, p)).ok, true);
    assert.equal((await sello.verificar(ev, { ...p, hash: '0'.repeat(64) })).ok, false);
    // Al servicio solo llegan ids: nunca el evento (ni su payload).
    for (const [, cuerpo] of visto) assert.ok(cuerpo === undefined || !String(cuerpo).includes('"payload"'));
    await assert.rejects(sello.sellar(['no es un id']), (e) => e instanceof ErrorDeSello && e.estado === 400);
  } finally {
    await new Promise((r) => servidor.close(r));
  }
  await assert.rejects(selloHttp({ url: base }).sellar(['0'.repeat(64)]), ErrorDeSello, 'sin red');
});

test('destino y crearSello: la url sale de la configuración «seal url» de «exterior settings» (opcional); sin url, la simulación en Node; la sincronía y el índice la exponen', async () => {
  const { eje } = await ejeConUnEvento();
  assert.equal(destino(eje, 'vg'), null, 'sin «seal url» en la configuración, ninguno');
  assert.equal(deConfiguracion(eje, 'vg'), null);
  assert.equal(crearSello({ url: 'http://127.0.0.1:1/' }).via, 'http');
  assert.equal(crearSello({ url: '' }).via, 'simulado', 'en Node, sin url, la simulación');
  assert.equal(crearSello({ simulado: false }), null);
  assert.equal(agram.sello.crearSello, crearSello);
});

// --- Por la sincronía: tras asentar eventos nuevos, al subir o al recibir ---

let servidor;
let reloj = Date.parse('2026-11-10T12:00:00Z');
before(async () => {
  servidor = await arrancar({ puerto: 0, secreto: 'prueba', ahora: () => new Date(reloj) });
});
after(async () => servidor.cerrar());

async function crearEje(nombre) {
  const r = await fetch(servidor.url + '/ejes', { method: 'POST', headers: { 'X-Crear-Ejes': 'prueba', 'Content-Type': 'application/json' }, body: JSON.stringify({ eje: nombre }) });
  return (await r.json()).claveLectura;
}

test('la sincronía sella lo que sube y lo que baja: pendiente hasta el bloque, luego 6.8.2 en el eje sin tocar el evento; se guarda y se restaura; un fallo del sello no rompe la sincronización', async () => {
  const claveLectura = await crearEje('sello');
  const cuenta = await generarClaves();
  const ejeA = await Eje.genesis({ identidad: 'vg', foco: ['mi eje'], t: T(0), clave: cuenta.publica, privada: cuenta.privada, exigirFirmas: true });
  const selloA = selloEn('2026-11-10T10:30:00Z');
  const selloB = selloEn('2026-11-10T10:30:00Z'); // otro servicio de sello: los lotes de cada uno son suyos
  const A = new Sincronia({ url: servidor.url, eje: 'sello', claveLectura, sello: selloA, ahora: () => reloj });
  const B = new Sincronia({ url: servidor.url, eje: 'sello', claveLectura, sello: selloB, ahora: () => reloj });

  const e1 = await ejeA.escribir({ autor: 'vg', sobre: ejeA.genesisId, t: T(1), movimientos: [minuto('vg')], payload: ['uno'] }, cuenta.privada);
  const cuerpo1 = canonico(e1);
  let informe = await A.sincronizar(ejeA);
  assert.deepEqual(informe.subidos, [ejeA.genesisId, e1.id]);
  assert.deepEqual(informe.sellos.sellados, []);
  assert.equal(informe.sellos.pendientes, 2, 'en un lote, sin bloque');
  assert.equal(A.estadoDeSello(e1.id), 'pendiente');
  assert.equal(ejeA.sello(e1.id), null);

  await selloA.minar();
  informe = await A.sincronizar(ejeA);
  assert.deepEqual(informe.sellos.sellados.sort(), [ejeA.genesisId, e1.id].sort());
  assert.equal(informe.sellos.pendientes, 0);
  assert.deepEqual(conSujeto('=count (first it.6).8.2', ctxDe(ejeA), e1.id).valor, [3]);
  assert.equal(ejeA.sello(e1.id).verificado, true, 'el gancho de «verificado»: lo que dio verificar');
  assert.equal(canonico(ejeA.obtener(e1.id)), cuerpo1, 'el evento, intacto');
  assert.equal(await verificarFirma(ejeA.obtener(e1.id), cuenta.publica), true);
  assert.equal(relojesFueraDeOrden(ejeA, e1.id), false);

  // B baja el eje y sella lo recibido.
  const ejeB = (await B.sincronizar(null)).eje;
  assert.ok(ejeB.eventos.has(e1.id));
  assert.equal(B.estadoDeSello(e1.id), 'pendiente', 'lo recibido también se sella');
  await selloB.minar();
  informe = await B.sincronizar(ejeB);
  assert.equal(ejeB.sello(e1.id)?.altura, 1);

  // Guardar y restaurar: el estado del sello vuelve; marcarSellos lo pone en un eje nuevo (como marcarReloj).
  const guardado = JSON.parse(JSON.stringify(A.serializar()));
  const A2 = Sincronia.restaurar(guardado, { claveLectura });
  assert.equal(A2.estadoDeSello(e1.id).hash, ejeA.sello(e1.id).hash);
  const ejeA2 = await Eje.desde([...ejeA.orden].map((id) => ejeA.obtener(id)), { exigirFirmas: true });
  assert.equal(ejeA2.sello(e1.id), null);
  assert.equal(A2.marcarSellos(ejeA2), 2);
  assert.equal(ejeA2.sello(e1.id).altura, 1);

  // Un servicio de sello caído no rompe la sincronización: queda en el informe y se reintenta.
  const caido = { sellar: async () => { throw new ErrorDeSello('sin red hacia el sello: caído'); }, prueba: async () => null, verificar: async () => ({ ok: false }) };
  const C = new Sincronia({ url: servidor.url, eje: 'sello', claveLectura, sello: caido, ahora: () => reloj });
  const e2 = await ejeA.escribir({ autor: 'vg', sobre: e1.id, t: T(2), movimientos: [minuto('vg')], payload: ['dos'] }, cuenta.privada);
  await A.sincronizar(ejeA);
  const ejeC = (await C.sincronizar(null)).eje;
  assert.ok(ejeC.eventos.has(e2.id));
  informe = await C.sincronizar(ejeC);
  assert.deepEqual(informe.errores, []);
  assert.match(informe.sellos.errores[0].motivo, /caído/);
  assert.equal(ejeC.sello(e2.id), null);
  assert.equal(C.estadoDeSello(e2.id), 'por sellar', 'se reintenta en la próxima');

  // Sin adaptador, nada se sella y el informe no cambia de forma.
  const D = new Sincronia({ url: servidor.url, eje: 'sello', claveLectura, ahora: () => reloj });
  informe = await D.sincronizar(null);
  assert.equal(informe.sellos, undefined);
  assert.equal(informe.eje.sello(e1.id), null);
});

test('una prueba que no verifica no entra en el eje', async () => {
  const claveLectura = await crearEje('sello-malo');
  const cuenta = await generarClaves();
  const eje = await Eje.genesis({ identidad: 'vg', foco: ['mi eje'], t: T(0), clave: cuenta.publica, privada: cuenta.privada, exigirFirmas: true });
  const buena = selloEn('2026-11-10T10:30:00Z');
  const falso = {
    sellar: (ids) => buena.sellar(ids),
    prueba: async (id) => ({ ...(await buena.prueba(id)), hash: 'f'.repeat(64) }),
    verificar: (ev, p) => buena.verificar(ev, p),
  };
  const S = new Sincronia({ url: servidor.url, eje: 'sello-malo', claveLectura, sello: falso, ahora: () => reloj });
  await S.sincronizar(eje);
  await buena.minar();
  const informe = await S.sincronizar(eje);
  assert.deepEqual(informe.sellos.sellados, []);
  assert.match(informe.sellos.errores[0].motivo, /hash/);
  assert.equal(eje.sello(eje.genesisId), null);
});
