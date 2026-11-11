// Todo lo que la carta pide al núcleo por clave (contrato.texto) tiene su texto en español en epoch.9.4: que no vuelva a
// colarse el inglés. La lista la saca docs/sin-traducir.mjs (node docs/sin-traducir.mjs, para verla por tipos).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clavesPedidas, clavesDelIdioma, sinTraducir } from '../docs/sin-traducir.mjs';

test('traducciones: ninguna clave que la carta pide queda sin traducir al español', () => {
  const faltan = sinTraducir('es');
  assert.deepEqual(faltan.map((f) => f.tipo + ' · ' + f.clave + ' ← ' + JSON.stringify(f.original)), [], 'faltan en es (epoch.9.4); añadirlas en datos/epocas/epoca-0.btml.json y npm run epocas');
});

test('traducciones: la lista de lo pedido cubre cada tipo de texto de la época (si un tipo se vacía, el recorrido se ha roto)', () => {
  const pedidas = clavesPedidas();
  const tipos = new Set(pedidas.map((c) => c.tipo));
  for (const t of ['acción', 'parámetro de acción', 'mensaje de acción', 'plantilla', 'posición de plantilla', 'plantilla de cerrado', 'estado', 'nivel de madurez', 'orden', 'tamaño', 'formato legible', 'motivo (regla)', 'guía', 'opción de preferencia']) assert.ok(tipos.has(t), 'sin claves de tipo «' + t + '»');
  assert.equal(pedidas.filter((c) => c.tipo === 'acción').length, 33, 'las 33 plantillas de transacción');
  assert.equal(new Set(pedidas.map((c) => c.clave)).size, pedidas.length, 'sin claves repetidas');
});

test('traducciones: el recorrido detecta lo que falta (un idioma sin registro lo tiene todo sin traducir)', () => {
  assert.equal(clavesDelIdioma('fr').size, 0);
  assert.equal(sinTraducir('fr').length, clavesPedidas().length);
});
