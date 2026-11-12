import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Eje } from '../src/eje.js';
import { secuencia, render } from '../src/sequenced.js';
import { ejemploCompra } from '../ejemplos/ikisai/compra-food.mjs';
import { pagaElCoste } from './ayudas-coste.js';

const T0 = '2026-11-06T20:00:00Z';
const gastaT = (de) => pagaElCoste(de);

async function cadena(n) {
  const eje = await Eje.genesis({ demostracion: true, identidad: 'raiz', emision: [], foco: 'g', t: T0 });
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
  // Encargo 3b: la emisión inicial de la casa, su invitación a la huésped (anclada en el 3 de su alta, el génesis) y las
  // altas de la casa. El alta de la huésped cuelga de la invitación que acepta (mapa §16 [D], «El árbol mínimo es la
  // invitación»), no del génesis.
  assert.equal(seq.total, 3);
  const invitacion = eje.obtener(eje.alta('huesped').id).sobre;
  assert.equal(eje.obtener(invitacion).sobre, eje.genesisId);
  assert.deepEqual(seq.decuplas.map((d) => d.id).sort(), [alta.id, invitacion, eje.sobre(eje.genesisId)[0].id].sort());
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
  assert.match(lineas[1], /^0 [0-9a-f]{8} huesped · 0 Compra del menú del día · 1 \[3\] · 2 \[2\] · 3 \[2\] · 4 \[2\] · 5 \[1\]$/); // 2: los criterios del menú y la plantilla de cerrado (encargo 3b); 5: su plantilla (encargo 3c-1)
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
  // VG, 7-11 noche (10.1): lo leído se cuenta por lo que hay. El hilo tiene 16 registros; se traen diez, un terminal cada uno: 10.
  const hilo = secuencia(eje, ultimo);
  assert.equal(hilo.total, 16);
  assert.deepEqual(hilo.alcance, { conseguido: 10, minimo: 10, maximo: 100, alMinimo: true });
  assert.equal(hilo.corte, null);
  assert.deepEqual(hilo.avisos, []);
  // Nada escrito sobre el último: no llega al mínimo, y no es error.
  assert.deepEqual(secuencia(eje, ultimo, { sentido: 'hijos' }).alcance, { conseguido: 0, minimo: 10, maximo: 100, alMinimo: false });
  assert.equal(secuencia(eje, ultimo, { maximo: 3 }).alcance.conseguido, 3);
  // El ejemplo: compra 10 (encargo 3b: su 2 nombra también la plantilla de cerrado), menú 6, altas 3 y el génesis, un
  // terminal, 1.
  const { eje: ej, compra } = await ejemploCompra();
  assert.equal(secuencia(ej, compra.id).alcance.conseguido, 21); // (encargo 3c-1: su 5 nombra su plantilla, «purchase»)
});

// VG, 7-11 noche (10.2): todos cortan duro, también Sequenced, con el aviso de Scened.
test('secuencia: corta duro en 100 posiciones por llegada, con aviso; pedir más registros del máximo es un error', async () => {
  const eje = await Eje.genesis({ demostracion: true, identidad: 'raiz', emision: [], foco: 'g', t: T0 });
  // Doce hijos de diez posiciones cada uno: 120 > 100.
  const hijos = [];
  for (let i = 0; i < 12; i++) {
    hijos.push(await eje.escribir({ autor: 'raiz', sobre: eje.genesisId, t: T0, movimientos: [gastaT('raiz')], payload: ['hijo ' + i, ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']] }));
  }
  const s = secuencia(eje, eje.genesisId, { sentido: 'hijos', maximo: 12 });
  assert.equal(s.total, 12);
  assert.deepEqual(s.decuplas.map((d) => d.id), hijos.slice(0, 10).map((h) => h.id)); // por llegada: los diez primeros
  assert.deepEqual(s.alcance, { conseguido: 100, minimo: 10, maximo: 100, alMinimo: true });
  assert.deepEqual(s.corte, { maximo: 100, conseguido: 100, necesario: 120, fuera: [hijos[10].id, hijos[11].id] });
  assert.match(s.avisos[0], /^Sequenced corta en su máximo \(100 posiciones\): entran 10 de 12 registros por llegada y quedan fuera 2: [0-9a-f]{8} [0-9a-f]{8}\. Trae 100 de 120 posiciones\.$/);
  // La décupla de cada registro admitido va entera: el corte es de Sequenced, no de Pointed.
  assert.deepEqual(s.decuplas[0].posiciones[1].contenido, ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']);
  // El aviso, arriba y abajo en el render.
  const lineas = render(s).split('\n');
  assert.equal(lineas[1], 'aviso: ' + s.avisos[0]);
  assert.equal(lineas.at(-1), 'aviso: ' + s.avisos[0]);
  // Lo que cabe no se corta: con los diez primeros, sin aviso.
  assert.equal(secuencia(eje, eje.genesisId, { sentido: 'hijos', maximo: 10 }).corte, null);
  // Pedir más registros que el máximo de posiciones (cada uno trae al menos una) es pedir más del máximo.
  assert.equal(secuencia(eje, eje.genesisId, { sentido: 'hijos', maximo: 100 }).decuplas.length, 10);
  for (const maximo of [101, Infinity]) assert.throws(() => secuencia(eje, eje.genesisId, { maximo }), /maximo inválido: .* el máximo de Sequenced es duro; se puede pedir menos, nunca más/);
  for (const maximo of [-1, 1.5, '3', NaN]) assert.throws(() => secuencia(eje, eje.genesisId, { maximo }), /maximo inválido/);
});
