import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Eje } from '../src/eje.js';
import { secuencia, render } from '../src/sequenced.js';
import { ejemploCompra } from '../ejemplos/ikisai/compra-food.mjs';

const T0 = '2026-11-06T20:00:00Z';
const gastaT = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });

async function cadena(n) {
  const eje = await Eje.genesis({ identidad: 'raiz', emision: [{ token: 'T', escala: 'minuto', cantidad: 600 }], foco: 'g', t: T0 });
  let sobre = eje.genesisId;
  for (let i = 1; i <= n; i++) {
    const ev = await eje.escribir({ autor: 'raiz', sobre, t: T0, movimientos: [gastaT('raiz')], payload: 'paso ' + i });
    sobre = ev.id;
  }
  return { eje, ultimo: sobre };
}

test('hilo del ejemplo: cuatro décuplas, la más cercana primero', async () => {
  const { eje, compra } = await ejemploCompra();
  const seq = secuencia(eje, compra.id);
  assert.equal(seq.sentido, 'hilo');
  assert.equal(seq.total, 4);
  assert.deepEqual(
    seq.decuplas.map((d) => d.terminal ?? d.posiciones[0].contenido), // el génesis del ejemplo es un terminal
    ['Compra del menú del día', 'Menú del día', 'Altas del fin de semana', 'Casa de ejemplo'],
  );
});

test('hijos del génesis del ejemplo', async () => {
  const { eje, alta } = await ejemploCompra();
  const seq = secuencia(eje, eje.genesisId, { sentido: 'hijos' });
  assert.equal(seq.total, 1);
  assert.equal(seq.decuplas[0].id, alta.id);
});

test('la hilera se corta en diez aunque el hilo sea más largo', async () => {
  const { eje, ultimo } = await cadena(12);
  const seq = secuencia(eje, ultimo);
  assert.equal(seq.total, 13);
  assert.equal(seq.decuplas.length, 10);
  assert.equal(seq.decuplas[0].terminal, 'paso 12');
  assert.equal(seq.decuplas[9].terminal, 'paso 3');
  assert.equal(secuencia(eje, ultimo, { maximo: 3 }).decuplas.length, 3);
});

test('render sobrio: cabecera y una línea por décupla', async () => {
  const { eje, compra } = await ejemploCompra();
  const texto = render(secuencia(eje, compra.id));
  const lineas = texto.split('\n');
  assert.equal(lineas.length, 5);
  assert.match(lineas[0], /^hilo de [0-9a-f]{8} · 4 de 4$/);
  assert.match(lineas[1], /^0 [0-9a-f]{8} huesped · 0 Compra del menú del día · 1 \[3\] · 2 \[1\] · 3 \[2\] · 4 \[2\]$/);
  assert.match(lineas[4], /^3 [0-9a-f]{8} casa · Casa de ejemplo$/); // un terminal, sin posición 0
  assert.throws(() => render(secuencia(eje, compra.id), 'animado'), /no disponible/);
});

test('rechazos: foco desconocido, sentido desconocido', async () => {
  const { eje, compra } = await ejemploCompra();
  assert.throws(() => secuencia(eje, 'nadie'), /foco desconocido/);
  assert.throws(() => secuencia(eje, compra.id, { sentido: 'lado' }), /sentido desconocido/);
});

test('secuencia: alcance con los tres números de Sequenced; mínimo no conseguido es información (VG, 7-11 noche)', async () => {
  const { eje, ultimo } = await cadena(15);
  // El hilo tiene 16 décuplas; se traen diez: 100 posiciones, el máximo.
  const hilo = secuencia(eje, ultimo);
  assert.equal(hilo.total, 16);
  assert.deepEqual(hilo.alcance, { conseguido: 100, minimo: 10, maximo: 100, alMinimo: true });
  // Nada escrito sobre el último: no llega al mínimo, y no es error.
  assert.deepEqual(secuencia(eje, ultimo, { sentido: 'hijos' }).alcance, { conseguido: 0, minimo: 10, maximo: 100, alMinimo: false });
  assert.equal(secuencia(eje, ultimo, { maximo: 3 }).alcance.conseguido, 30);
});
