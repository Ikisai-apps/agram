// La fábrica y la matriz 10×10×10 (VG, 7-11 tarde): el registro de salida
// emite solo las celdas modificadas; la tercera dimensión es la clase de
// modificación (los diez PV como tercer dígito); topes duros por modo; lo
// lejano sin base en el foco se ancla en su posición en vez de rechazarse.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejemploCompra } from '../ejemplos/ikisai/compra-food.mjs';
import { desdeMapped, escribirDesde, escribirSalida, ubicar, claseDe, CLASES } from '../src/escritura.js';
import { MODOS, tope, cabeTope, proporcion, contarPosiciones, lectura } from '../src/modos.js';
import { consolidar, autorizar, ejecutar } from '../src/motor.js';
import { resolver, direccion } from '../src/btml.js';
import { ocupantes } from '../src/encaje.js';
import { Eje } from '../src/eje.js';

const T = '2026-11-07T18:00:00Z';
const ref = (id, dir) => ({ ref: id, dir });

test('las diez clases de modificación son los diez PV como tercer dígito', () => {
  assert.equal(CLASES.length, 10);
  assert.equal(CLASES[0], 'ver/sustituir');
  assert.equal(CLASES[1], 'impulso de recursos');
  assert.equal(CLASES[4], 'acción');
  assert.equal(CLASES[9], 'camino');
  assert.equal(claseDe('1240000000'), 4);
  assert.equal(claseDe('1200000000'), 0);
  assert.equal(claseDe(direccion([2, 0, 1])), 1);
});

test('compra del menú: ver el precio es clase 0 y ya emite algo', async () => {
  const { eje, compra } = await ejemploCompra();
  // Ver la celda [1][2] (el precio) sin escribir nada: se emite una referencia a lo visto.
  const { payload, heredadas, anclados } = desdeMapped(eje, [{ i: 1, j: 2, k: 0 }], compra.id);
  assert.deepEqual(anclados, []);
  assert.ok(contarPosiciones(payload) > 0);
  assert.deepEqual(payload, [
    ref(compra.id, '0000000000'),
    [ref(compra.id, '1000000000'), ref(compra.id, '1100000000'), ref(compra.id, '1200000000')],
  ]);
  assert.deepEqual(heredadas, [0, '1.0', '1.1']); // lo no modificado anterior a lo visto, por referencia
  // La dirección 1.2.0 (colisiona con 1.2) alcanza el precio de la compra sin copiarlo.
  const visto = resolver(payload, direccion([1, 2, 0]));
  assert.equal(resolver(eje.obtener(compra.id).payload, visto.dir), 'EUR 12');
  const ev = await escribirDesde(eje, { modo: 'mapped', autor: 'huesped', sobre: compra.id, payload, t: T });
  assert.equal(ev.movimientos[0].cantidad, 4);
  // Sin ver nada no hay nada que emitir.
  assert.throws(() => desdeMapped(eje, [], compra.id), /vacía/);
});

test('compra del menú: pagar el precio es [1][2][4]', async () => {
  const { eje, compra } = await ejemploCompra();
  const { payload, heredadas, anclados } = desdeMapped(eje, [{ i: 1, j: 2, k: 4, contenido: 'pagar 12 EUR' }], compra.id);
  assert.deepEqual(anclados, []);
  assert.equal(payload[1][2][4], 'pagar 12 EUR');
  // Las clases 0–3 de la celda no se modificaron: se heredan del foco por referencia (la 0 es la propia celda).
  assert.deepEqual(payload[1][2].slice(0, 4), ['1200000000', '1210000000', '1220000000', '1230000000'].map((d) => ref(compra.id, d)));
  assert.deepEqual(heredadas, [0, '1.0', '1.1', '1.2.0', '1.2.1', '1.2.2', '1.2.3']);
  assert.equal(contarPosiciones(payload), 8);
  // La misma celda por líneas: «2.4 texto» fija subposición 2 y clase 4.
  const lineas = [];
  lineas[1] = ['2.4 pagar 12 EUR'];
  assert.deepEqual(desdeMapped(eje, lineas, compra.id).payload, payload);
  // escribirDesde con la celda objetivo envuelve el contenido dentro del registro.
  const ev = await escribirDesde(eje, { modo: 'mapped', autor: 'huesped', sobre: compra.id, celda: [1, 2, 4], payload: 'pagar 12 EUR', t: T });
  assert.deepEqual(ev.payload, payload);
  assert.equal(ev.en, '0000000000');
});

test('consolidar registra la clase de cada elección (tercer dígito) y ejecutar es clase 4', async () => {
  const { eje, compra } = await ejemploCompra();
  // En la raíz del foco toda elección cae en la subposición 0 con clase 0.
  const raiz = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: T, elecciones: { 1: ref(compra.id, '1200000000'), 4: 'pagar' } });
  assert.deepEqual(raiz.contexto.encaje.map((e) => [e.posicion, e.destino, e.clase]), [[1, '1000000000', 0], [4, '4000000000', 0]]);
  assert.equal(raiz.contexto.encaje[1].tipo, 'nuevo'); // un terminal nuevo lleva su clase, sin origen ni vector
  // Bajo la celda del precio [1][2], la posición elegida es la clase: 4 = pagar.
  const precio = await consolidar(eje, {
    autor: 'huesped', foco: compra.id, t: T, camino: [1, 2], titulo: 'Pago del precio',
    elecciones: { 1: '12 EUR de huesped', 2: 'precio del menú', 3: 'aviso a cocina', 4: 'pagar 12 EUR' },
  });
  assert.equal(precio.en, '1240000000');
  assert.deepEqual(precio.contexto.encaje.map((e) => [e.destino, e.clase]), [['1210000000', 1], ['1220000000', 2], ['1230000000', 3], ['1240000000', 4]]);
  await autorizar(eje, { autorizante: 'casa', consolidacion: precio.id, t: T });
  const e = await ejecutar(eje, { autor: 'huesped', consolidacion: precio.id, t: T, movimientos: [{ token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 12, de: 'huesped', a: 'cocina' }] });
  assert.equal(e.contexto.clase, 4);
});

test('topes duros por modo: Pointed 10, Sequenced 100, Mapped 1000, Scened 10000', () => {
  assert.deepEqual(Object.keys(MODOS), ['pointed', 'sequenced', 'mapped', 'scened']);
  assert.deepEqual(Object.keys(MODOS).map(tope), [10, 100, 1000, 10000]);
  for (const m of Object.keys(MODOS)) assert.equal(tope(m), lectura(m)); // no se emite más de lo que se lee
  const de = (n) => Array.from({ length: n }, (_, x) => 'x' + x);
  assert.equal(cabeTope(de(10), 'pointed'), true);
  assert.equal(cabeTope([de(10), 'y'], 'pointed'), false);
  const diezMil = Array(10).fill(Array(10).fill(Array(10).fill(Array(10).fill('z'))));
  assert.equal(cabeTope(diezMil, 'scened'), true);
  assert.equal(cabeTope([diezMil, 'y'], 'scened'), false);
  assert.throws(() => tope('otro'), /modo desconocido: otro/);
});

test('una matriz de 1000 posiciones cabe en Mapped y no en Sequenced', async () => {
  // Escribir mil posiciones cuesta mil minutos: un eje propio cuyo génesis los emite.
  const eje = await Eje.genesis({ identidad: 'casa', emision: [{ token: 'T', escala: 'minuto', cantidad: 2000 }], foco: 'Casa de ejemplo', t: T });
  const foco = eje.genesisId;
  const celdas = [];
  for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) for (let k = 0; k < 10; k++) celdas.push({ i, j, k, contenido: i + '.' + j + '.' + k });
  const { payload, heredadas, anclados } = desdeMapped(eje, celdas, foco);
  assert.deepEqual(heredadas, []);
  assert.deepEqual(anclados, []);
  assert.equal(contarPosiciones(payload), 1000);
  assert.equal(payload[1][2][4], '1.2.4');
  assert.equal(cabeTope(payload, 'mapped'), true);
  assert.equal(cabeTope(payload, 'sequenced'), false);
  // La proporción es el estándar (de 250 a 333 en Mapped): informa, no rechaza.
  assert.deepEqual(proporcion(payload, 'mapped'), { posiciones: 1000, rango: [250, 333], estado: 'por encima' });
  assert.deepEqual(proporcion(['a'], 'pointed'), { posiciones: 1, rango: [1, 1], estado: 'dentro' });
  assert.deepEqual(proporcion(['a'], 'scened'), { posiciones: 1, rango: null, estado: 'sin fijar' });
  await assert.rejects(
    escribirDesde(eje, { modo: 'sequenced', autor: 'casa', sobre: foco, payload, t: T }),
    /^Error: Sequenced emite como mucho 100 posiciones; este registro tiene 1000$/,
  );
  const ev = await escribirDesde(eje, { modo: 'mapped', autor: 'casa', sobre: foco, payload, t: T });
  assert.equal(ev.movimientos[0].cantidad, 1000);
  await assert.rejects(
    escribirDesde(eje, { modo: 'mapped', autor: 'casa', sobre: foco, payload: [...payload.slice(0, 9), [payload[9], 'una más']], t: T }),
    /Mapped emite como mucho 1000 posiciones; este registro tiene 1001/,
  );
});

test('lo lejano sin base en el foco se ancla en su posición en vez de rechazarse', async () => {
  const { eje, compra } = await ejemploCompra();
  // La compra desarrolla las posiciones 0–4: la 7 queda lejos (sin 5 ni 6 que heredar).
  assert.deepEqual(ubicar(eje, compra.id, [7, 0, 0]), { ubicacion: 'anclado', en: '7000000000', dir: '7000000000', faltan: ['5', '6'] });
  assert.deepEqual(ubicar(eje, compra.id, [1, 2, 4]), { ubicacion: 'dentro', dir: '1240000000', faltan: [] });
  // Una subposición lejana dentro de una posición que existe también se ancla.
  assert.deepEqual(ubicar(eje, compra.id, [1, 5, 0]).faltan, ['1.3', '1.4']);
  // Lo ya escrito en el mismo registro cuenta como base.
  assert.equal(ubicar(eje, compra.id, [7, 0, 0], { escritas: [[5, 0, 0], [6, 0, 0]] }).ubicacion, 'dentro');

  const lineas = [];
  lineas[2] = ['sin lactosa'];
  lineas[7] = ['repetir el sábado'];
  const salida = desdeMapped(eje, lineas, compra.id);
  assert.deepEqual(salida.payload, [ref(compra.id, '0000000000'), ref(compra.id, '1000000000'), 'sin lactosa']);
  assert.deepEqual(salida.anclados, [{ celda: [7, 0, 0], en: '7000000000', payload: 'repetir el sábado', faltan: ['5', '6'] }]);
  // Escribir solo el payload perdería lo anclado: se avisa.
  await assert.rejects(escribirDesde(eje, { modo: 'mapped', autor: 'huesped', sobre: compra.id, payload: salida.payload, t: T }), /se ancla aparte \(7\.0\.0 en 7000000000\)/);
  const antes = eje.saldoT('huesped', 'minuto');
  const { registro, anclados } = await escribirSalida(eje, { modo: 'mapped', autor: 'huesped', sobre: compra.id, salida, t: T });
  assert.equal(registro.en, '0000000000');
  assert.equal(anclados.length, 1);
  assert.equal(anclados[0].en, '7000000000');
  assert.equal(anclados[0].sobre, compra.id);
  assert.equal(anclados[0].payload, 'repetir el sábado');
  assert.equal(antes - eje.saldoT('huesped', 'minuto'), 4); // tres posiciones dentro, una anclada
  // Lo anclado es un ocupante escrito de la posición lejana.
  assert.deepEqual(ocupantes(eje, compra.id, [7]).map((o) => o.evento), [anclados[0].id]);

  // escribirDesde con una celda lejana la ancla; todo anclado se escribe con escribirSalida.
  const solo = await escribirDesde(eje, { modo: 'pointed', autor: 'huesped', sobre: compra.id, celda: [9, 0, 0], payload: 'volver', t: T });
  assert.equal(solo.en, '9000000000');
  assert.equal(solo.payload, 'volver');
  const lejos = [];
  lejos[8] = ['la mejor del mes'];
  const todo = desdeMapped(eje, lejos, compra.id);
  assert.equal(todo.payload, null);
  await assert.rejects(escribirDesde(eje, { modo: 'mapped', autor: 'huesped', sobre: compra.id, payload: todo.payload, t: T }), /nada que escribir/);
  const r = await escribirSalida(eje, { modo: 'mapped', autor: 'huesped', sobre: compra.id, salida: todo, t: T });
  assert.equal(r.registro, null);
  assert.equal(r.anclados[0].en, '8000000000');
});

test('el tope cuenta la salida entera: registro y anclados', async () => {
  const { eje, compra } = await ejemploCompra();
  const lineas = [];
  lineas[1] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
  lineas[7] = ['lejos'];
  const salida = desdeMapped(eje, lineas, compra.id);
  assert.equal(contarPosiciones(salida.payload), 10);
  await assert.rejects(
    escribirSalida(eje, { modo: 'pointed', autor: 'huesped', sobre: compra.id, salida, t: T }),
    /Pointed emite como mucho 10 posiciones; esta salida tiene 11/,
  );
  assert.equal(eje.sobre(compra.id).length, 0); // nada se escribió
});

test('líneas de Mapped: sin clase van a la subposición siguiente libre con clase 0; «j.k texto» fija ambas', async () => {
  const { eje, compra } = await ejemploCompra();
  const lineas = [];
  lineas[4] = ['pagado', '0.1 con tarjeta', 'servido'];
  const { payload, heredadas } = desdeMapped(eje, lineas, compra.id);
  // «0.1» ocupa la subposición 0 (clase 1): «pagado» y «servido» van a las libres 1 y 2 con clase 0.
  assert.deepEqual(payload[4], [[ref(compra.id, '4000000000'), 'con tarjeta'], 'pagado', 'servido']);
  assert.deepEqual(heredadas, [0, 1, 2, 3, '4.0.0']);
  // Para escribir tal cual un texto que empieza por «d.d », se le pone delante su celda.
  const kilo = [];
  kilo[1] = ['0.0 1.5 kg'];
  assert.equal(desdeMapped(eje, kilo, compra.id).payload[1], '1.5 kg');
  const repetida = [];
  repetida[2] = ['0.0 uno', '0.0 dos'];
  assert.throws(() => desdeMapped(eje, repetida, compra.id), /la celda 2\.0\.0 está dos veces/);
  assert.throws(() => desdeMapped(eje, [{ i: 1, j: 2, k: 4 }], compra.id), /falta el contenido de 1\.2\.4/);
  assert.throws(() => desdeMapped(eje, [{ i: 1, j: 10, k: 0, contenido: 'x' }], compra.id), /fuera de la matriz/);
  assert.throws(() => desdeMapped(eje, [['a'], { i: 1, j: 0, k: 0, contenido: 'x' }], compra.id), /mezcla/);
  const once = [];
  once[3] = Array.from({ length: 11 }, (_, x) => 'x' + x);
  assert.throws(() => desdeMapped(eje, once, compra.id), /más de 10 subposiciones/);
});
