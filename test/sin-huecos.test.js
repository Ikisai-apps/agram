// Sin huecos ni rellenos (VG 13-11, #77; regla general de BTML en las tres casas): ninguna posición vacía ni rellena con
// «-»; cada objeto ocupa posiciones seguidas desde el 0, todas con contenido; nada de tuplas [campo, valor] dentro de una
// décupla: lo nombrado va como una décupla de CLAVES y otra paralela de VALORES (solo las que existen, en el mismo orden).
// Esta prueba mira los datos de la época (la época, las reglas, las plantillas, la guía y los modelos), todo lo que escriben
// los ejemplos y lo que escribe la carta (configuración, ajustes de la guía y del exterior, opiniones).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { EPOCA_0_BTML_DATOS } from '../datos/epocas/epocas.js';
import { contrato, exterior } from '../src/index.js';
import * as A from '../src/acciones.js';
import { ejemploCompra, ejemploCuenta, ejemploJardinYParque, ejemploFabrica, ejemploFuturoYCohorte, ejemploComprasVecinas } from '../ejemplos/ikisai/compra-food.mjs';
import { ejemploReserva } from '../ejemplos/ikisai/reserva-booking.mjs';
import { ejemploTarea } from '../ejemplos/ikisai/tarea-tasks.mjs';
import { ejemploComprasHermanas } from '../ejemplos/ikisai/compras-hermanas.mjs';
import { ejemploLente } from '../ejemplos/ikisai/lente-booking.mjs';
import { preferencias } from '../carta/carta.js';
import * as G from '../carta/guia.js';
import { parametrosDeOpinion } from '../carta/externa.js';
import { generarClaves } from '../src/autoridad.js';
import { Eje } from '../src/eje.js';

const CARPETA = new URL('../datos/epocas/', import.meta.url);

/** Las rutas de los «-» (un relleno) y de las posiciones vacías o con hueco de un valor BTML. */
function rellenos(x, ruta = 'raíz') {
  if (x === '-') return [ruta + ' («-»)'];
  if (!Array.isArray(x)) return [];
  if (x.length === 0) return [ruta + ' (vacía)'];
  const fuera = [];
  for (let i = 0; i < x.length; i++) {
    if (!(i in x) || x[i] === null || x[i] === undefined) fuera.push(ruta + '.' + i + ' (hueco)');
    else fuera.push(...rellenos(x[i], ruta + '.' + i));
  }
  return fuera;
}

const jsonDe = (carpeta) => (existsSync(new URL(carpeta, CARPETA)) ? readdirSync(new URL(carpeta, CARPETA)).filter((f) => f.endsWith('.json')).map((f) => [carpeta + f, JSON.parse(readFileSync(new URL(carpeta + f, CARPETA), 'utf8'))]) : []);

test('los datos de la época no tienen ningún «-» ni ninguna posición vacía: la época, las reglas, las plantillas, la guía, los modelos y las correcciones', () => {
  assert.deepEqual(rellenos(EPOCA_0_BTML_DATOS), []);
  const archivos = [['epoca-0.btml.json', JSON.parse(readFileSync(new URL('epoca-0.btml.json', CARPETA), 'utf8'))], ...['reglas/', 'plantillas/', 'guia/', 'modelos/', 'correcciones/'].flatMap(jsonDe)];
  assert.ok(archivos.length > 100, 'las reglas y las plantillas están: ' + archivos.length);
  for (const [nombre, datos] of archivos) assert.deepEqual(rellenos(datos), [], nombre);
});

test('la fila de epoch.8.7 y el registro de ajustes son claves y valores en paralelo, sin tuplas: lo nombrado va en una décupla de claves y otra de valores', () => {
  for (const fila of EPOCA_0_BTML_DATOS[8][7][1]) {
    assert.equal(fila.length, 5);
    const [, , , claves, valores] = fila;
    assert.equal(claves.length, valores.length, 'una clave por valor: ' + JSON.stringify(fila[0]));
    assert.ok(claves.every((k) => typeof k === 'string') && valores.every((v) => typeof v === 'string' || typeof v === 'number'), 'hojas, nunca tuplas [campo, valor]');
  }
  const p = contrato.registroDeAjustes('exterior settings', { 'relay url': 'https://relay.ejemplo', confirmations: 6 }, { quien: 'ana' });
  assert.deepEqual(p.slice(0, 3), [['exterior settings'], ['relay url', 'confirmations'], ['https://relay.ejemplo', 6]]);
  assert.deepEqual(rellenos(p), []);
  assert.equal(contrato.registroDeAjustes('exterior settings', {}, { quien: 'ana' }), null, 'sin ningún ajuste no hay registro: ni hueco ni relleno');
});

/** Todos los registros de un eje: sus payloads, sin «-» ni posiciones vacías. */
function sinRellenos(eje, que) {
  const malos = [];
  for (const id of eje.orden) {
    const ev = eje.obtener(id);
    const r = rellenos(ev.payload, 'payload');
    if (r.length) malos.push(que + ' ' + id.slice(0, 8) + ' ' + JSON.stringify(ev.payload).slice(0, 80) + ' → ' + r.join(', '));
  }
  return malos;
}

test('ningún registro que escriben los ejemplos lleva «-» ni posiciones vacías', async () => {
  const malos = [];
  const compra = await ejemploCompra();
  malos.push(...sinRellenos(compra.eje, 'compra'));
  await ejemploCuenta(compra.eje, compra.compra);
  const vecinas = await ejemploComprasVecinas(compra.eje, compra);
  assert.ok(vecinas);
  const jardin = await ejemploJardinYParque(compra.eje, compra);
  assert.ok(jardin);
  const fabrica = await ejemploFabrica(compra.eje, compra);
  assert.ok(fabrica);
  const futuro = await ejemploFuturoYCohorte(compra.eje, compra);
  assert.ok(futuro);
  malos.push(...sinRellenos(compra.eje, 'compra entera'));
  malos.push(...sinRellenos((await ejemploReserva()).eje, 'reserva'));
  malos.push(...sinRellenos((await ejemploTarea()).eje, 'tarea'));
  malos.push(...sinRellenos((await ejemploComprasHermanas()).eje, 'hermanas'));
  malos.push(...sinRellenos((await ejemploLente()).eje, 'lente'));
  assert.deepEqual(malos, []);
});

test('lo que escribe la carta no deja huecos: la configuración, los ajustes de la guía y los del exterior son registros de claves y valores; y las opiniones, lo opcional al final', async () => {
  const cuenta = await generarClaves();
  const eje = await Eje.genesis({ identidad: 'vg', foco: ['mi eje'], t: '2026-11-13T09:00:00Z', clave: cuenta.publica, privada: cuenta.privada });
  // las preferencias: todas las que tienen valor, también con servidor y eje compartido dados
  for (const valores of [{}, { 'sync url': ['http://127.0.0.1:8787'] }, { 'sync url': ['http://127.0.0.1:8787'], 'sync ledger': ['eje'] }, { 'sync ledger': ['eje'] }]) {
    const p = preferencias(eje, 'vg', valores);
    assert.deepEqual(rellenos(p.payload), [], JSON.stringify(valores));
    assert.equal(p.payload.length, 6, 'el nombre, las claves, los valores, quién, su ayuda y el tipo');
    assert.equal(p.payload[1].length, p.payload[2].length, 'una clave por valor');
    assert.equal('sync url' in valores, p.payload[1].includes('sync url'), 'solo está lo que se dijo');
  }
  // los ajustes de la guía y los del exterior, con y sin url
  for (const nombre of [contrato.ajustesDeLaGuia(), exterior.AJUSTES.plantilla]) {
    for (const valores of [{}, { 'relay url': 'http://127.0.0.1:8788', 'seal url': '', 'guide model': 'otro' }, { 'observer keys': 'a'.repeat(64), confirmations: '12', 'opinions anchor': 'AGRAM' }]) {
      const a = G.ajustesEditablesDe(nombre, eje, 'vg', valores);
      if (a.payload === null) continue;
      assert.deepEqual(rellenos(a.payload), [], nombre + ' ' + JSON.stringify(valores));
      assert.equal(a.payload.length, 6);
      assert.equal(a.payload[1].length, a.payload[2].length);
    }
  }
  // las opiniones: lo opcional va al final y cada posición lleva contenido real (nada de «-»); lo que falta corta lo de detrás
  const base = { fecha: '2026-11-13T09:00:00Z', cuenta: 'vg', modo: 'apilada', ancho: 400, alto: 800, render: 'sobrio', foco: { X: eje.genesisId, X0: 'mi eje' }, texto: 'un texto' };
  for (const nodo of [
    { tipo: 'ocupante', pv: 3, X: eje.genesisId, texto: 'Menú', ruta: ['carta', 'pv'] },
    { tipo: 'ocupante', pv: 3, X: eje.genesisId, texto: '', ruta: ['carta', 'pv'] },
    { tipo: 'ocupante', pv: 3, X: eje.genesisId, texto: 'Menú', ruta: [] },
    { tipo: 'barra', pv: null, X: null, texto: '', ruta: [] },
  ]) {
    for (const version of ['v-prueba', undefined]) {
      const op = parametrosDeOpinion(eje, { ...base, version, nodo });
      assert.deepEqual(rellenos(Object.values(op.parametros)), [], JSON.stringify(nodo) + ' ' + version);
      const dados = new Set(A.parametros(A.plantillaDeTransaccion(op.accion)).filter((p) => p.posicion !== null && op.parametros[p.nombre] !== undefined).map((p) => Number(p.posicion.split('.')[0])));
      for (const d of dados) if (d >= 7) assert.ok(dados.has(d - 1), 'la posición ' + d + ' sin la ' + (d - 1) + ': ' + JSON.stringify(nodo) + ' ' + version);
    }
  }
});
