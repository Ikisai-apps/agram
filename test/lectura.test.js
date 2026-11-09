// Lectura humana de BTML (src/lectura.js, VG 8-11): una línea por posición
// con contenido, `<dígito> · <nombre>: <contenido>`, dos espacios por nivel.
// Datos inventados: el eje de ejemplo de la compra.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { leer, leerEvento } from '../src/lectura.js';
import * as agram from '../src/index.js';
import { cargarEpoca, EPOCA_0 } from '../src/epocas.js';
import { ejemploCompra, ejemploCuenta } from '../ejemplos/ikisai/compra-food.mjs';
import { leidos } from '../ejemplos/ikisai/leer.mjs';
import { htmlLeido, alternarLeido, leidoAbierto } from '../ui/leido.js';
import { vistaClasificar } from '../ui/clasificar.js';

test('las dos líneas de VG, leídas: el menú (una lista) y la compra (una décupla), salida exacta', async () => {
  const { eje, menu } = await ejemploCompra();
  const menú = { ref: menu.id };
  assert.equal(leer(['Menú del día', ['ensalada', 'guiso', 'fruta']]), [
    '0 · representación: Menú del día',
    '1 · recursos: ensalada · guiso · fruta · 3 ocupantes',
  ].join('\n'));
  assert.equal(leer(['Compra', [[menú], [1]]], { eje, nombres: { [menu.id]: 'menú' } }), [
    '0 · representación: Compra',
    '1 · recursos:',
    '  0 · qué es: → menú (Menú del día)',
    '  1 · cuánto: 1',
  ].join('\n'));
  // Sin envolver, la 1 es una lista de dos ocupantes, en una sola línea.
  assert.equal(leer(['Compra', [menú, 1]], { eje, nombres: { [menu.id]: 'menú' } }), [
    '0 · representación: Compra',
    '1 · recursos: → menú (Menú del día) · 1 · 2 ocupantes',
  ].join('\n'));
  // Por el índice, en plano, como el resto de BTML.
  assert.equal(agram.leer, leer);
  assert.equal(agram.leerEvento, leerEvento);
});

test('una lista de doce: sus ocupantes en una línea y cuántos son (sin tope de diez)', () => {
  const invitados = Array.from({ length: 12 }, (_, k) => 'invitado ' + (k + 1));
  const texto = leer(['Mesa', invitados]);
  assert.equal(texto, '0 · representación: Mesa\n1 · recursos: ' + invitados.join(' · ') + ' · 12 ocupantes');
  // Una lista de uno no dice «1 ocupantes».
  assert.equal(leer(['Mesa', ['sola']]), '0 · representación: Mesa\n1 · recursos: sola');
});

test('una referencia: sin eje, su destino; con eje, lo que alcanza en su posición 0', async () => {
  const { eje, menu } = await ejemploCompra();
  const p = ['Compra', { ref: menu.id }, { ref: menu.id, dir: '1000000000' }, [{ ref: 'f'.repeat(64) }]];
  assert.equal(leer(p), [
    '0 · representación: Compra',
    '1 · recursos: → ' + menu.id.slice(0, 8),
    '2 · criterios: → ' + menu.id.slice(0, 8) + ':1',
    '3 · comunicación: → ffffffff',
  ].join('\n'));
  const nombres = new Map([[menu.id, 'menú']]); // también un Map
  assert.equal(leer(p, { eje, nombres }), [
    '0 · representación: Compra',
    '1 · recursos: → menú (Menú del día)',
    '2 · criterios: → menú:1 (ensalada · guiso · fruta)',
    '3 · comunicación: → ffffffff (pendiente: evento ausente del eje: ffffffff)',
  ].join('\n'));
  // Una referencia a una posición sin desarrollar lo dice; una función también vale como nombres.
  assert.equal(leer(['x', { ref: menu.id, dir: '7000000000' }], { eje, nombres: (id) => (id === menu.id ? 'menú' : undefined) }),
    '0 · representación: x\n1 · recursos: → menú:7 (sin desarrollar)');
});

test('las posiciones vacías no se imprimen; la sangría es de dos espacios por nivel', () => {
  // Solo 0 y 1: nada de «2 · criterios», ni de las otras ocho.
  assert.equal(leer(['Compra', 1]), '0 · representación: Compra\n1 · recursos: 1');
  // Una posición nula o ausente (un payload mal formado) tampoco se imprime.
  assert.equal(leer(['a', null, 'c']), '0 · representación: a\n2 · criterios: c');
  // Tres niveles: la cruceta, las preguntas de la 1 y las de la 2.
  const texto = leer(['Viaje', [['tren'], [['ida'], 'vuelta'], 'EUR 40']]);
  assert.equal(texto, [
    '0 · representación: Viaje',
    '1 · recursos:',
    '  0 · qué es: tren',
    '  1 · cuánto:',
    '    0 · qué es: ida',
    '    1 · cuánto: vuelta',
    '  2 · con qué condición: EUR 40',
  ].join('\n'));
  for (const l of texto.split('\n')) assert.match(l, /^(  )*\d · [^:]+:( .+)?$/);
  // Un terminal es su texto; en una profundidad n ≥ 1, un array solo de hojas es una lista.
  assert.equal(leer('Casa de ejemplo'), 'Casa de ejemplo');
  assert.equal(leer(['a', 'b'], { profundidad: 1 }), 'a · b · 2 ocupantes');
  assert.equal(leer([['a'], 'b'], { profundidad: 1 }), '0 · qué es: a\n1 · cuánto: b');
  // En la 0 el mismo array es la cruceta.
  assert.equal(leer(['a', 'b']), '0 · representación: a\n1 · recursos: b');
});

test('los nombres son los de la época: una regla larga gana a la corta en su ruta', () => {
  const epoca = cargarEpoca({ nombre: 'época de prueba', reglas: [{ ruta: '11', nombre: 'precio' }] }, { respaldo: EPOCA_0 });
  assert.equal(leer(['Compra', [['menú'], 12]], { epoca }), '0 · representación: Compra\n1 · recursos:\n  0 · qué es: menú\n  1 · precio: 12');
  assert.equal(leer(['Compra', 1], { epoca: 'época 0' }), '0 · representación: Compra\n1 · recursos: 1');
});

test('leerEvento: cabecera, payload y los ocupantes anclados bajo su posición, por llegada', async () => {
  const { eje, menu, compra } = await ejemploCompra();
  await ejemploCuenta(eje, compra);
  // Otro escrito en la 3 (una lista de dos: los propios son los ocupantes 1 y 2) y uno en la raíz.
  await eje.escribir({ autor: 'cocina', sobre: compra.id, en: '3000000000', t: '2026-11-07T14:20:00Z', movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'cocina', a: null }], payload: 'avisar al servir' });
  await eje.escribir({ autor: 'huesped', sobre: compra.id, t: '2026-11-07T14:30:00Z', movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'huesped', a: null }], payload: ['Gracias', 'muy rico'] });
  const nombres = { [menu.id]: 'menú', [compra.id]: 'compra' };
  assert.equal(leerEvento(eje, compra.id, { nombres }), [
    'compra · huesped · 2026-11-07T13:30:00Z · sobre menú en 0000000000',
    '0 · representación: Compra del menú del día',
    '1 · recursos:',
    '  0 · qué es: → menú:1 (ensalada · guiso · fruta)',
    '  1 · cuánto: 1',
    '  2 · con qué condición: EUR 12',
    '  ↳ ocupante 2 · cocina · Cuenta del menú',
    '2 · criterios: → menú:2 (sin gluten · vegetariano)',
    '3 · comunicación: huesped · cocina · 2 ocupantes',
    '  ↳ ocupante 3 · cocina · avisar al servir',
    '4 · fábrica: pagar · servir · 2 ocupantes',
    '↳ ocupante 1 · huesped · Gracias',
  ].join('\n'));
  // Con camino, solo esa posición (lo que enseña Clasificar).
  assert.equal(leerEvento(eje, compra.id, { nombres, camino: [3] }), [
    'compra · huesped · 2026-11-07T13:30:00Z · sobre menú en 0000000000 · posición 3',
    '3 · comunicación: huesped · cocina · 2 ocupantes',
    '  ↳ ocupante 3 · cocina · avisar al servir',
  ].join('\n'));
  assert.match(leerEvento(eje, compra.id, { camino: [8] }), /posición 8\n\(posición vacía\)$/);
  // El génesis: sin «sobre», y su payload terminal en una línea.
  assert.match(leerEvento(eje, eje.genesisId), /^[0-9a-f]{8} · casa · 2026-11-07T09:00:00Z · génesis\nCasa de ejemplo\n↳ ocupante 1 · huesped · alta de huesped\n↳ ocupante 2 · casa · Altas del fin de semana$/);
  assert.throws(() => leerEvento(eje, 'f'.repeat(64)), /registro desconocido/);
});

test('un escrito anclado donde el payload no tiene nada abre su posición vacía', async () => {
  const { eje, compra } = await ejemploCompra();
  await eje.escribir({ autor: 'cocina', sobre: compra.id, en: '7200000000', t: '2026-11-07T15:00:00Z', movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'cocina', a: null }], payload: 'a las tres' });
  const texto = leerEvento(eje, compra.id);
  assert.match(texto, /\n7 · futuro:\n  2 · con qué condición:\n    ↳ ocupante 1 · cocina · a las tres$/);
});

test('el ejemplo leer.mjs imprime la compra, el menú y la reserva', async () => {
  const texto = await leidos();
  const bloques = texto.split('\n\n');
  assert.equal(bloques.length, 3);
  assert.match(bloques[0], /^compra · huesped · .* · sobre menú en 0000000000\n0 · representación: Compra del menú del día/);
  assert.match(bloques[1], /^menú · cocina · .*\n0 · representación: Menú del día\n1 · recursos: ensalada · guiso · fruta · 3 ocupantes/);
  assert.match(bloques[2], /^reserva · huesped · .* · sobre habitación en 1100000000\n0 · representación: Reserva de la cama individual/);
});

test('la UI pinta el conmutador «leído» y, abierto, el registro en un <pre> que envuelve', async () => {
  const { eje, menu, compra } = await ejemploCompra();
  const cerrado = htmlLeido(eje, compra.id, { abierto: false });
  assert.match(cerrado, /<button type="button" class="leido-boton" data-leido aria-pressed="false" aria-expanded="false" aria-controls="leido-foco"/);
  assert.doesNotMatch(cerrado, /<pre/);
  const abierto = htmlLeido(eje, compra.id, { abierto: true, nombres: { [menu.id]: 'menú' } });
  assert.match(abierto, /aria-pressed="true"/);
  assert.match(abierto, /<pre id="leido-foco" class="leido-texto"[^>]*>[^<]*0 · representación: Compra del menú del día\n1 · recursos:\n {2}0 · qué es: → menú:1/);
  // El texto va escapado: un < del payload no abre HTML.
  const raro = await eje.escribir({ autor: 'cocina', sobre: compra.id, t: '2026-11-07T15:00:00Z', movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'cocina', a: null }], payload: ['<b>negrita</b>'] });
  assert.match(htmlLeido(eje, raro.id, { abierto: true }), /&lt;b&gt;negrita&lt;\/b&gt;/);
  // El conmutador alterna (y en Node, sin almacenamiento, no pasa nada).
  const antes = leidoAbierto();
  assert.equal(alternarLeido(), !antes);
  assert.equal(alternarLeido(antes), antes);
  // El CSS del <pre> envuelve las líneas: sin scroll horizontal a 400 px.
  const { readFileSync } = await import('node:fs');
  const css = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(css, /\.leido-texto\{[^}]*white-space:pre-wrap[^}]*overflow-wrap:anywhere/);
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(app, /htmlLeido\(estado\.eje, estado\.foco/);
  assert.match(app, /instalarLeido\(\{ pintar \}\)/);
});

test('Clasificar pinta «leído» de la posición en foco', async () => {
  const { eje, compra } = await ejemploCompra();
  alternarLeido(true);
  try {
    const html = vistaClasificar({ eje, foco: compra.id, camino: [], en: '1', identidad: 'huesped' });
    assert.match(html, /aria-controls="leido-clasificar"/);
    assert.match(html, /<pre id="leido-clasificar"[^>]*>[^<]*· posición 1\n1 · recursos:\n {2}0 · qué es: → [0-9a-f]{8}:1/);
    assert.doesNotMatch(html, /<pre id="leido-clasificar"[^>]*>[^<]*2 · criterios/);
  } finally {
    alternarLeido(false);
  }
  assert.doesNotMatch(vistaClasificar({ eje, foco: compra.id, camino: [], en: '1', identidad: 'huesped' }), /<pre id="leido-clasificar"/);
});
