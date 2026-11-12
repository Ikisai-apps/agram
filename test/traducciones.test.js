// Todo lo que la carta pide al núcleo por clave (contrato.texto) tiene su texto en español en epoch.9.4: que no vuelva a
// colarse el inglés. La lista la saca docs/sin-traducir.mjs (node docs/sin-traducir.mjs, para verla por tipos).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as contrato from '../src/contrato.js';
import * as acciones from '../src/acciones.js';
import { ejemploCompra } from '../ejemplos/ikisai/compra-food.mjs';
import { clavesPedidas, clavesDelIdioma, sinTraducir } from '../docs/sin-traducir.mjs';

test('traducciones: ninguna clave que la carta pide queda sin traducir al español', () => {
  const faltan = sinTraducir('es');
  assert.deepEqual(faltan.map((f) => f.tipo + ' · ' + f.clave + ' ← ' + JSON.stringify(f.original)), [], 'faltan en es (epoch.9.4); añadirlas en datos/epocas/epoca-0.btml.json y npm run epocas');
});

test('traducciones: la lista de lo pedido cubre cada tipo de texto de la época (si un tipo se vacía, el recorrido se ha roto)', () => {
  const pedidas = clavesPedidas();
  const tipos = new Set(pedidas.map((c) => c.tipo));
  for (const t of ['acción', 'parámetro de acción', 'mensaje de acción', 'plantilla', 'posición de plantilla', 'plantilla de cerrado', 'estado', 'nivel de madurez', 'orden', 'tamaño', 'formato legible', 'motivo (regla)', 'motivo (acción)', 'guía', 'opción de preferencia']) assert.ok(tipos.has(t), 'sin claves de tipo «' + t + '»');
  assert.equal(pedidas.filter((c) => c.tipo === 'acción').length, 42, 'las 42 plantillas de transacción');
  assert.equal(new Set(pedidas.map((c) => c.clave)).size, pedidas.length, 'sin claves repetidas');
});

test('traducciones: el recorrido detecta lo que falta (un idioma sin registro lo tiene todo sin traducir)', () => {
  assert.equal(clavesDelIdioma('fr').size, 0);
  assert.equal(sinTraducir('fr').length, clavesPedidas().length);
});

test('traducciones: los motivos fijos de las acciones tienen su canónico en inglés y su español con los mismos huecos, y salen en el idioma de quien lanza', async () => {
  const huecos = (s) => [...String(s).matchAll(/\{([^{}]+)\}/g)].map((m) => m[1]).sort();
  for (const q of contrato.MOTIVOS) {
    const clave = contrato.claves.motivo(q);
    const en = contrato.texto(null, clave, 'en');
    const es = contrato.texto(null, clave, 'es');
    assert.ok(en && es, 'falta «' + clave + '»');
    assert.notEqual(es, en, 'sin traducir: «' + clave + '»');
    assert.deepEqual(huecos(es), huecos(en), clave + ': los mismos huecos');
  }
  const { eje, menu } = await ejemploCompra();
  const T1 = '2026-11-08T10:00:00Z';
  const por = async (idioma, cual, X = menu.id, yo = 'huesped') => (await acciones.transaccion(eje, cual, { X }, yo, { t: T1, idioma })).motivos[0].mensaje;
  assert.equal(await por('en', 'fly'), 'unknown transaction template: fly');
  assert.equal(await por('es', 'fly'), 'plantilla de transacción desconocida: fly');
  assert.equal(await por('en', 'apply a resource', 'f'.repeat(64)), 'apply a resource: X is not a record of the ledger');
  assert.equal(await por('es', 'apply a resource', 'f'.repeat(64)), 'apply a resource: X no es un registro del libro');
  assert.equal(await por('es', 'apply a resource', menu.id, ''), 'apply a resource: quien la lanza (yo) tiene que ser una identidad');
});

test('traducciones: lo nuevo del 3 por tema (encargo pv3): las seis plantillas (quitar, vetar, llevar a un grupo, los dos mínimos y configurar el sitio) con su canónico en inglés y su español, los mismos huecos; y los textos de la carta para las cajas, la conversación y el personaje del sitio', async () => {
  const { t, TEXTOS } = await import('../carta/textos.js');
  const huecos = (s) => [...String(s).matchAll(/{([^{}]+)}/g)].map((m) => m[1]).sort();
  for (const nombre of ['remove someone', 'veto someone', 'move to group', 'set a minimum', 'set a minimum rank', 'configure a place']) {
    const p = acciones.plantillaDeTransaccion(nombre);
    assert.ok(p, nombre);
    for (const clave of [contrato.claves.plantilla(nombre), contrato.claves.mensaje(nombre)]) {
      const en = clave === contrato.claves.plantilla(nombre) ? nombre : (p.plantilla ?? p)[9].at(-1); // el canónico: su nombre y su mensaje (su 9)
      const es = contrato.texto(null, clave, 'es');
      assert.ok(es && es !== en, 'sin traducir: «' + clave + '»');
      assert.deepEqual(huecos(es), huecos(en), clave + ': los mismos huecos');
    }
    for (const prm of acciones.parametros(p.plantilla ?? p, { idioma: 'es' })) assert.ok(prm.etiqueta && prm.ayuda && !/^the /.test(prm.ayuda), nombre + ' · ' + prm.nombre + ': su etiqueta y su ayuda en español');
  }
  for (const k of ['filtro_todos', 'filtro_doy', 'filtro_recibo', 'filtroTitulo', 'marcadorDoy', 'marcadorRecibo', 'personaTitulo', 'cajaVacia', 'cajaMinimo', 'cajaFuera', 'capaChat', 'capaRecursos', 'capaCriterios', 'capaFavoritos', 'capaTrabajo', 'sitioTitulo', 'sitioDe', 'conversacionCon']) assert.ok(TEXTOS.es[k] && t(k) !== k, 'la carta: ' + k);
  assert.equal(t('marcadorDoy', { n: 2 }), '2 de mi R la tiene esta persona');
});
