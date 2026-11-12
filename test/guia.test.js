// La guía del PV9 (carta/guia.js, servidor/supabase/funciones/guia): el contexto exacto de la pantalla, las instrucciones
// que son dato de la época, el cuerpo de la petición, las dos vías de llamada (servidor de prueba y directo, con un
// fetch simulado: nada sale de la máquina), los ajustes como registro y la función del servidor. docs/CONTRATO.md §16.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { arrancar } from '../servidor/prueba/servidor.mjs';
import { crearGuia, llamarAAnthropic, LIMITE_CONTEXTO, PREGUNTAS_POR_MINUTO, MAX_TOKENS, MODELO_POR_DEFECTO } from '../servidor/supabase/funciones/guia/api.js';
import { hashDeClave, generarClaveLectura } from '../servidor/supabase/funciones/eventos/api.js';
import * as G from '../carta/guia.js';
import { contrato, salida, direccion } from '../src/index.js';
import { crearEvento } from '../src/evento.js';
import { ejemploCompra } from '../ejemplos/ikisai/compra-food.mjs';
import { pagaElCoste } from './ayudas-coste.js';

const minuto = (de) => pagaElCoste(de);
const almacenFalso = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
};
const estadoDe = (X, pv = 0) => ({ foco: { X, pv }, niveles: {} });

let servidor;
before(async () => { servidor = await arrancar({ puerto: 0, secreto: 'prueba' }); });
after(async () => servidor.cerrar());

const crearEje = async (nombre) => (await fetch(servidor.url + '/ejes', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Crear-Ejes': 'prueba' }, body: JSON.stringify({ eje: nombre }) })).json();

// ---------- la época: las instrucciones son dato ----------

test('la época trae el registro de la guía en el 9.9, con el papel, el resumen, las normas y las preguntas, en es y en en', () => {
  const en = contrato.guia(null, 'en');
  const es = contrato.guia(null, 'es');
  assert.equal(en.nombre, 'guide');
  assert.match(en.papel, /guide for the person looking at the screen/);
  assert.match(es.papel, /guía de AGRAM/);
  assert.notEqual(es.resumen, en.resumen);
  for (const x of [en, es]) {
    assert.ok(x.resumen.split('\n').length >= 10 && x.resumen.split('\n').length <= 30, 'un resumen de unas 25 líneas');
    assert.match(x.resumen, /PV0/); assert.match(x.resumen, /PV9/);
    assert.match(x.resumen, /\bE\b.*\bP\b.*\bR\b.*\bT\b/s);
    assert.equal(x.preguntas.length, 3);
  }
  assert.deepEqual(es.preguntas, ['¿Qué estoy viendo?', '¿Qué viene ahora?', '¿Qué significa esta posición?']);
  // Un idioma sin traducción cae al inglés del propio registro.
  assert.equal(contrato.guia(null, 'fr').papel, en.papel);
  // El registro es un registro de la época (con su id) referenciado desde el 9.9.
  assert.match(en.id, /^[0-9a-f]{64}$/);
});

test('los ajustes de la guía son una plantilla de la época con sus defectos, y un registro propio los cambia', async () => {
  const { eje } = await ejemploCompra();
  assert.deepEqual(contrato.configuracionGuia(eje, 'huesped'), { 'guide model': 'claude-sonnet-5-5', 'guide via': 'server', 'guide history': 20, 'guide context': 6000, de: null });
  assert.deepEqual(G.ajustes(eje, 'huesped'), { modelo: 'claude-sonnet-5-5', via: 'server', historial: 20, contexto: 6000, de: null });
  const a = G.ajustesEditables(eje, 'huesped', { 'guide via': 'direct', 'guide context': '3000' }, { idioma: 'en' });
  assert.equal(a.cambiado, true);
  assert.deepEqual(a.campos.map((c) => c.clave), ['guide model', 'guide via', 'guide history', 'guide context', 'opinions anchor']);
  assert.equal(a.campos[1].etiqueta, 'guide via', 'en el idioma de la configuración (en): la etiqueta canónica');
  assert.equal(G.ajustesEditables(eje, 'huesped', {}, { idioma: 'es' }).campos[1].etiqueta, 'vía de la guía');
  const sinCambios = G.ajustesEditables(eje, 'huesped', {});
  assert.equal(sinCambios.cambiado, false);
  assert.equal(G.ajustesEditables(eje, 'huesped', { 'guide via': 'server' }).cambiado, false);
  await salida.escribirDesde(eje, { modo: 'sequenced', autor: 'huesped', sobre: a.sobre, en: a.en, payload: a.payload });
  assert.deepEqual(G.ajustes(eje, 'huesped'), { modelo: 'claude-sonnet-5-5', via: 'direct', historial: 20, contexto: 3000, de: G.ajustes(eje, 'huesped').de });
  assert.ok(G.ajustes(eje, 'huesped').de);
  // Un valor que la plantilla no admite lo dice su validación (la de la época), no la guía.
  const mala = G.ajustesEditables(eje, 'huesped', { 'guide via': 'por paloma' });
  const escrita = await salida.escribirDesde(eje, { modo: 'sequenced', autor: 'huesped', sobre: mala.sobre, en: mala.en, payload: mala.payload });
  assert.ok(contrato.validar(eje, escrita.id).length > 0);
  assert.equal(G.ajustes(eje, 'huesped').via, 'server', 'un valor desconocido cae a la vía por defecto');
});

test('carta/guia.js no lleva escrito nada de lo que dice la guía: lo lee de la época', () => {
  const fuente = readFileSync(new URL('../carta/guia.js', import.meta.url), 'utf8');
  for (const idioma of ['en', 'es']) {
    const g = contrato.guia(null, idioma);
    for (const texto of [g.papel, g.resumen, g.normas, ...g.preguntas]) {
      for (const frase of texto.split(/[.\n]/).map((x) => x.trim()).filter((x) => x.length >= 20)) assert.ok(!fuente.includes(frase), 'guia.js repite «' + frase + '»');
    }
  }
  assert.ok(!/semilla|sprout|water park|parque acuático|kingdom/i.test(fuente));
  // Tampoco la clave de ninguna API ni una URL real de servidor propio.
  assert.ok(!/sk-ant|sb_secret|supabase\.co/.test(fuente));
});

// ---------- el contexto ----------

test('contexto() sobre la compra: modo y ancho, quién soy, el foco con su lectura y su madurez, la carta de texto, el camino, las acciones del aro y el diario', async () => {
  const { eje, compra } = await ejemploCompra();
  const c400 = await G.contexto(estadoDe(compra.id), eje, 'huesped', { ancho: 400, alto: 800, idioma: 'en' });
  assert.match(c400, /400×800 px/);
  assert.match(c400, /franjas apiladas/);
  assert.match(c400, /huesped \(persona\)/);
  assert.match(c400, /en un ejemplo/);
  assert.ok(c400.includes(compra.id.slice(0, 8)), 'el foco, por su id corto');
  assert.match(c400, /madurez: nivel \d+ de \d+/);
  assert.match(c400, /lectura del registro:/);
  assert.match(c400, /Compra del menú del día/, 'la lectura humana');
  assert.match(c400, /carta de texto del foco:\n\[screen/);
  assert.match(c400, /camino: \d+ pasos/);
  assert.match(c400, /acciones del aro/);
  assert.match(c400, /PV9: follow the path\*/);
  assert.match(c400, /últimas entradas del diario:\n- 2026-11-07T13:30:00Z/);
  assert.match(c400, /idioma en/);
  assert.match(c400, /language: es/, 'la configuración dice es: el idioma por defecto de la época');
  assert.ok(c400.length <= 6000);
  const c1200 = await G.contexto(estadoDe(compra.id), eje, 'huesped', { ancho: 1200, alto: 700, cuenta: true });
  assert.match(c1200, /1200×700 px/);
  assert.match(c1200, /mapa de celdas/);
  assert.match(c1200, /en su cuenta/);
  assert.ok(!c400.includes('sync url') && !c400.includes('guide'), 'nada de dónde se comparte el eje ni de los ajustes');
});

test('contexto() respeta el tope: recorta por el final de cada bloque y lo dice', async () => {
  const { eje, compra } = await ejemploCompra();
  const ancho = await G.contexto(estadoDe(compra.id), eje, 'huesped', { tope: 8000 }); // el aro del 3 trae más acciones (encargo pv3: quitar, vetar, llevar a un grupo)
  const justo = await G.contexto(estadoDe(compra.id), eje, 'huesped', { tope: 1200 });
  assert.ok(justo.length <= 1200, 'longitud ' + justo.length);
  assert.ok(justo.length < ancho.length);
  assert.match(justo, /\[recortado por el tope de 1200 caracteres: .*foco/);
  assert.match(justo, /…/);
  assert.ok(!/recortado por el tope/.test(ancho), 'a 8000 la compra cabe entera');
  // Los ajustes mandan el tope por defecto.
  assert.ok((await G.contexto(estadoDe(compra.id), eje, 'huesped', {})).length <= 6000);
});

// ---------- las instrucciones: 9 de la época → 9 de la plantilla → 9 del registro ----------

test('las instrucciones son el texto de la época y, detrás, lo escrito en el 9 del foco (no la configuración)', async () => {
  const { eje, compra } = await ejemploCompra();
  const base = contrato.guia(eje, 'en');
  const sola = G.instrucciones(eje, compra.id, 'huesped', { idioma: 'en' });
  assert.ok(sola.startsWith(base.papel));
  assert.ok(sola.includes(base.resumen) && sola.includes(base.normas));
  assert.ok(!sola.includes('Instrucciones del 9'), 'sin nada en el 9, nada más que el texto base');
  // Una instrucción propia del registro, escrita en su 9 por su dueño.
  await eje.anadir(await crearEvento({ autor: 'huesped', sobre: compra.id, en: direccion([9]), t: '2026-11-08T10:00:00Z', movimientos: [minuto('huesped')], payload: 'Si preguntan por el pago, explica que ya está hecho.' }));
  const con = G.instrucciones(eje, compra.id, 'huesped', { idioma: 'en' });
  assert.ok(con.startsWith(sola));
  assert.match(con, /Instrucciones del 9 de este registro:\nSi preguntan por el pago, explica que ya está hecho\./);
  // El registro de configuración (el 9 de un alta) no se manda: puede llevar dónde se comparte el eje.
  const alta = eje.alta('huesped').id;
  const p = (await import('../carta/carta.js')).preferencias(eje, 'huesped', { 'sync url': 'http://127.0.0.1:1', 'sync ledger': 'x' });
  await salida.escribirDesde(eje, { modo: 'sequenced', autor: 'huesped', sobre: p.sobre, en: p.en, payload: p.payload });
  assert.ok(!G.instrucciones(eje, alta, 'huesped').includes('127.0.0.1'));
});

// ---------- el cuerpo de la petición ----------

test('el cuerpo se construye con las instrucciones de la época y el historial recortado, alternando y empezando por el usuario', async () => {
  const { eje, compra } = await ejemploCompra();
  const instr = G.instrucciones(eje, compra.id, 'huesped');
  const historial = [];
  for (let i = 0; i < 30; i++) historial.push({ role: 'user', content: 'p' + i }, { role: 'assistant', content: 'r' + i });
  const s = G.cuerpoDe({ via: 'server', eje: 'vg', modelo: 'm', instrucciones: instr, contexto: 'CTX', historial, pregunta: '¿y ahora?', maximo: 20 });
  assert.deepEqual(Object.keys(s), ['eje', 'modelo', 'mensajes', 'contexto', 'instrucciones']);
  assert.equal(s.instrucciones, instr);
  assert.equal(s.contexto, 'CTX');
  assert.ok(s.mensajes.length <= 21 && s.mensajes.length % 2 === 1);
  assert.equal(s.mensajes[0].role, 'user');
  assert.deepEqual(s.mensajes.at(-1), { role: 'user', content: '¿y ahora?' });
  assert.equal(s.mensajes.at(-2).content, 'r29', 'se conserva lo último');
  s.mensajes.forEach((m, i) => assert.equal(m.role, i % 2 === 0 ? 'user' : 'assistant'));
  // Un historial que empieza por la respuesta o con restos que no alternan se limpia.
  assert.deepEqual(G.mensajesDe([{ role: 'assistant', content: 'a' }, { role: 'user', content: 'u' }, { role: 'user', content: 'u2' }, { role: 'assistant', content: 'b' }], 'q').map((m) => m.role), ['user', 'assistant', 'user']);
  const largo = G.mensajesDe([{ role: 'user', content: 'x'.repeat(5000) }, { role: 'assistant', content: 'ok' }], 'q');
  assert.ok(largo[0].content.length <= 1500);
  // La vía directa manda lo mismo al proveedor: system = instrucciones + contexto.
  const d = G.cuerpoDe({ via: 'direct', eje: 'vg', modelo: 'm', instrucciones: instr, contexto: 'CTX', historial: [], pregunta: 'hola' });
  assert.deepEqual(d, { model: 'm', max_tokens: 800, system: instr + '\n\nCTX', messages: [{ role: 'user', content: 'hola' }] });
});

// ---------- la vía servidor, contra el servidor de prueba ----------

test('vía servidor: POST {sync url}/guia con la clave de lectura devuelve el eco de prueba con las primeras líneas del contexto', async () => {
  const { claveLectura } = await crearEje('guia-uno');
  const { eje, compra } = await ejemploCompra();
  const contexto = await G.contexto(estadoDe(compra.id), eje, 'huesped', {});
  const r = await G.preguntar({ via: 'server', url: servidor.url, ejeCompartido: 'guia-uno', claveLectura, modelo: 'modelo-x', instrucciones: G.instrucciones(eje, compra.id, 'huesped'), contexto, historial: [], pregunta: '¿qué estoy viendo?' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.match(r.texto, /^\(guía de prueba\) ¿qué estoy viendo\? \[modelo-x\]\n/);
  assert.ok(r.texto.includes(contexto.split('\n')[0]), 'las primeras líneas del contexto');
  assert.ok(r.uso.entrada > 0);
  // Mala clave: 401 con su motivo; eje que no existe: 404.
  const mala = await G.preguntar({ via: 'server', url: servidor.url, ejeCompartido: 'guia-uno', claveLectura: 'otra', modelo: 'm', instrucciones: '', contexto: '', historial: [], pregunta: 'x' });
  assert.equal(mala.ok, false);
  assert.equal(mala.estado, 401);
  assert.match(mala.motivo, /clave de lectura/);
  const sinEje = await G.preguntar({ via: 'server', url: servidor.url, ejeCompartido: 'no-existe', claveLectura, modelo: 'm', instrucciones: '', contexto: '', historial: [], pregunta: 'x' });
  assert.equal(sinEje.estado, 404);
});

test('vía servidor sin servidor, eje o clave de lectura: motivo y no llama', async () => {
  let llamadas = 0;
  const fetch = async () => { llamadas++; throw new Error('no debía llamar'); };
  for (const falta of [{ url: undefined }, { ejeCompartido: undefined }, { claveLectura: undefined }]) {
    const r = await G.preguntar({ via: 'server', url: 'http://x', ejeCompartido: 'e', claveLectura: 'k', ...falta, historial: [], pregunta: 'hola', fetch });
    assert.equal(r.ok, false);
    assert.match(r.motivo, /servidor, eje compartido y clave de lectura/);
  }
  assert.equal(llamadas, 0);
});

test('vía servidor sin red: el motivo, sin lanzar', async () => {
  const r = await G.preguntar({ via: 'server', url: 'http://127.0.0.1:1', ejeCompartido: 'e', claveLectura: 'k', historial: [], pregunta: 'hola' });
  assert.equal(r.ok, false);
  assert.match(r.motivo, /sin red/);
});

// ---------- la vía directa ----------

test('vía directa sin clave: motivo y no llama; con clave, las cabeceras del proveedor y la respuesta', async () => {
  let llamadas = [];
  const fetch = async (url, init) => {
    llamadas.push({ url, init });
    return new Response(JSON.stringify({ content: [{ type: 'text', text: 'Estás viendo una compra.' }], usage: { input_tokens: 10, output_tokens: 5 } }), { status: 200 });
  };
  const sin = await G.preguntar({ via: 'direct', claveIa: null, modelo: 'm', instrucciones: 'I', contexto: 'C', historial: [], pregunta: 'hola', fetch });
  assert.equal(sin.ok, false);
  assert.match(sin.motivo, /clave de Anthropic/);
  assert.equal(llamadas.length, 0);
  const r = await G.preguntar({ via: 'direct', claveIa: 'clave-de-prueba', modelo: 'm', instrucciones: 'I', contexto: 'C', historial: [{ role: 'user', content: 'antes' }, { role: 'assistant', content: 'vale' }], pregunta: 'hola', fetch, urlDirecta: 'http://127.0.0.1:9/v1/messages' });
  assert.deepEqual(r, { ok: true, texto: 'Estás viendo una compra.', uso: { entrada: 10, salida: 5 } });
  assert.equal(llamadas.length, 1);
  const { init } = llamadas[0];
  assert.equal(init.headers['x-api-key'], 'clave-de-prueba');
  assert.equal(init.headers['anthropic-version'], '2023-06-01');
  assert.equal(init.headers['anthropic-dangerous-direct-browser-access'], 'true');
  const cuerpo = JSON.parse(init.body);
  assert.equal(cuerpo.system, 'I\n\nC');
  assert.equal(cuerpo.messages.length, 3);
  assert.equal(cuerpo.max_tokens, 800);
  // Los errores, tal cual: 401 la clave, 429 la cuota.
  const e401 = await G.preguntar({ via: 'direct', claveIa: 'k', modelo: 'm', historial: [], pregunta: 'x', fetch: async () => new Response('{"error":{"message":"invalid x-api-key"}}', { status: 401 }) });
  assert.equal(e401.estado, 401);
  assert.match(e401.motivo, /clave de Anthropic no vale \(401\)/);
  const e429 = await G.preguntar({ via: 'direct', claveIa: 'k', modelo: 'm', historial: [], pregunta: 'x', fetch: async () => new Response('{}', { status: 429 }) });
  assert.match(e429.motivo, /429/);
});

// ---------- la conversación y la clave, en el almacén local ----------

test('la conversación guarda solo los últimos 20 turnos por alta, se puede vaciar, y la clave de la API vive aparte', () => {
  const a = almacenFalso();
  const h = [];
  for (let i = 0; i < 15; i++) h.push({ role: 'user', content: 'p' + i }, { role: 'assistant', content: 'r' + i });
  assert.equal(G.guardarHistorial(a, 'ALTA1', h), true);
  const leido = G.cargarHistorial(a, 'ALTA1');
  assert.equal(leido.length, 20);
  assert.equal(leido.at(-1).content, 'r14');
  assert.deepEqual(G.cargarHistorial(a, 'OTRA'), []);
  assert.ok(a.m.has('agram.guia.ALTA1'));
  G.vaciarHistorial(a, 'ALTA1');
  assert.deepEqual(G.cargarHistorial(a, 'ALTA1'), []);
  // Roto o sin almacén: vacío, sin lanzar.
  a.setItem('agram.guia.X', '{no es json');
  assert.deepEqual(G.cargarHistorial(a, 'X'), []);
  assert.deepEqual(G.cargarHistorial(undefined, 'X'), []);
  // La clave de la API: por alta, en agram.ia.<alta>.
  assert.equal(G.claveIa(a, 'ALTA1'), null);
  G.guardarClaveIa(a, 'ALTA1', '  clave-de-prueba ');
  assert.equal(a.getItem('agram.ia.ALTA1'), 'clave-de-prueba');
  assert.equal(G.claveIa(a, 'ALTA1'), 'clave-de-prueba');
  assert.equal(G.claveIa(a, 'OTRA'), null);
  G.guardarClaveIa(a, 'ALTA1', '');
  assert.equal(G.claveIa(a, 'ALTA1'), null);
});

test('la clave de la API nunca entra en el eje: ni los ajustes ni el contexto ni las instrucciones la llevan', async () => {
  const { eje, compra } = await ejemploCompra();
  const a = G.ajustesEditables(eje, 'huesped', { 'guide via': 'direct' });
  assert.ok(!JSON.stringify(a.payload).includes('clave'));
  assert.deepEqual(a.campos.map((c) => c.clave), ['guide model', 'guide via', 'guide history', 'guide context', 'opinions anchor']);
  const alm = almacenFalso();
  G.guardarClaveIa(alm, eje.alta('huesped').id, 'SECRETO-123');
  assert.ok(!(await G.contexto(estadoDe(compra.id), eje, 'huesped', {})).includes('SECRETO-123'));
  assert.ok(!G.instrucciones(eje, compra.id, 'huesped').includes('SECRETO-123'));
});

// ---------- la función del servidor ----------

const almacenDeEjes = (ejes) => ({ eje: async (n) => ejes[n] ?? null });
async function funcion({ llamar, ...resto } = {}) {
  const clave = generarClaveLectura();
  const manejar = crearGuia({ almacen: almacenDeEjes({ uno: { clave_lectura_hash: await hashDeClave(clave) } }), llamar: llamar ?? (async ({ modelo, sistema, mensajes }) => ({ texto: modelo + '|' + sistema + '|' + mensajes.length, uso: { entrada: 3, salida: 4 } })), ...resto });
  const pedir = (cuerpo, cabeceras = {}, metodo = 'POST') => manejar(new Request('http://x/guia', { method: metodo, headers: { 'content-type': 'application/json', 'x-clave-lectura': clave, ...cabeceras }, body: metodo === 'POST' ? JSON.stringify(cuerpo) : undefined }));
  return { pedir, clave };
}
const valido = { eje: 'uno', mensajes: [{ role: 'user', content: 'hola' }], contexto: 'ctx', instrucciones: 'ins' };

test('la función /guia: comprueba la clave de lectura contra el hash del eje, la forma, los topes y el límite por minuto', async () => {
  const { pedir } = await funcion();
  let r = await pedir(valido);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { texto: MODELO_POR_DEFECTO + '|ins\n\nctx|1', uso: { entrada: 3, salida: 4 } });
  r = await pedir({ ...valido, modelo: 'otro' });
  assert.equal((await r.json()).texto.split('|')[0], 'otro');
  assert.equal((await pedir(valido, { 'x-clave-lectura': 'otra' })).status, 401);
  assert.equal((await pedir(valido, { 'x-clave-lectura': '' })).status, 401);
  assert.equal((await pedir({ ...valido, eje: 'dos' })).status, 404);
  assert.equal((await pedir({ ...valido, eje: 'MAL NOMBRE' })).status, 400);
  assert.equal((await pedir({ ...valido, contexto: 'x'.repeat(LIMITE_CONTEXTO + 1) })).status, 413);
  assert.equal((await pedir({ ...valido, contexto: 'x'.repeat(LIMITE_CONTEXTO) })).status, 200);
  assert.equal((await pedir({ ...valido, mensajes: [] })).status, 400);
  assert.equal((await pedir({ ...valido, mensajes: [{ role: 'assistant', content: 'a' }] })).status, 400);
  assert.equal((await pedir({ ...valido, mensajes: [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }] })).status, 400, 'el último es del usuario');
  assert.equal((await pedir({ ...valido, modelo: 'con espacios y ;' })).status, 400);
  assert.equal((await pedir(valido, {}, 'GET')).status, 405);
  const o = await pedir(null, { origin: 'https://agram.ikisai.com' }, 'OPTIONS');
  assert.equal(o.status, 204);
  assert.equal(o.headers.get('access-control-allow-origin'), 'https://agram.ikisai.com');
  assert.equal((await pedir(null, { origin: 'https://otro.example' }, 'OPTIONS')).headers.get('access-control-allow-origin'), null);
});

test('la función /guia limita a 30 preguntas por minuto y eje', async () => {
  let ahora = Date.parse('2026-11-10T12:00:00Z');
  const { pedir } = await funcion({ ahora: () => new Date(ahora) });
  for (let i = 0; i < PREGUNTAS_POR_MINUTO; i++) assert.equal((await pedir(valido)).status, 200, 'pregunta ' + i);
  assert.equal((await pedir(valido)).status, 429);
  ahora += 61000;
  assert.equal((await pedir(valido)).status, 200);
});

test('la función /guia traduce los fallos del proveedor y llamarAAnthropic manda lo que debe (sin red)', async () => {
  const { ErrorDelProveedor } = await import('../servidor/supabase/funciones/guia/api.js');
  const { pedir } = await funcion({ llamar: async () => { throw new ErrorDelProveedor(429, 'cuota'); } });
  const r = await pedir(valido);
  assert.equal(r.status, 429);
  assert.deepEqual(await r.json(), { error: 'cuota' });
  const { pedir: pedir2 } = await funcion({ llamar: async () => { throw new Error('boom'); } });
  assert.equal((await pedir2(valido)).status, 500);
  // La llamada al proveedor: cabeceras, modelo, max_tokens, system, mensajes.
  let visto;
  const llamar = llamarAAnthropic({ clave: 'clave-de-prueba', url: 'http://127.0.0.1:9/v1/messages', fetch: async (url, init) => { visto = { url, init }; return new Response(JSON.stringify({ content: [{ type: 'text', text: 'hola' }, { type: 'tool_use' }], usage: { input_tokens: 7, output_tokens: 2 } }), { status: 200 }); } });
  const s = await llamar({ modelo: 'claude-sonnet-5-5', sistema: 'S', mensajes: [{ role: 'user', content: 'q' }] });
  assert.deepEqual(s, { texto: 'hola', uso: { entrada: 7, salida: 2 } });
  assert.equal(visto.init.headers['x-api-key'], 'clave-de-prueba');
  assert.equal(visto.init.headers['anthropic-version'], '2023-06-01');
  assert.deepEqual(JSON.parse(visto.init.body), { model: 'claude-sonnet-5-5', max_tokens: MAX_TOKENS, system: 'S', messages: [{ role: 'user', content: 'q' }] });
  const e401 = llamarAAnthropic({ clave: 'k', fetch: async () => new Response('{"error":{"message":"invalid"}}', { status: 401 }) });
  await assert.rejects(() => e401({ modelo: 'm', sistema: '', mensajes: [] }), (e) => e.estado === 502 && /no vale/.test(e.message));
  const e429 = llamarAAnthropic({ clave: 'k', fetch: async () => new Response('{}', { status: 429 }) });
  await assert.rejects(() => e429({ modelo: 'm', sistema: '', mensajes: [] }), (e) => e.estado === 429);
});

test('la función de Deno no lleva secretos: la clave del proveedor sale de Deno.env y el modelo por defecto es el pedido', () => {
  const ts = readFileSync(new URL('../servidor/supabase/funciones/guia/index.ts', import.meta.url), 'utf8');
  assert.match(ts, /Deno\.env\.get\('ANTHROPIC_API_KEY'\)/);
  assert.ok(!/sk-ant-[A-Za-z0-9]/.test(ts + readFileSync(new URL('../servidor/supabase/funciones/guia/api.js', import.meta.url), 'utf8')));
  assert.equal(MODELO_POR_DEFECTO, 'claude-sonnet-5-5');
  assert.equal(MAX_TOKENS, 800);
});
