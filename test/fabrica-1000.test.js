// La fábrica y la matriz 10×10×10 (VG, 7-11 tarde): el registro de salida
// emite solo las celdas modificadas; la tercera dimensión es la clase de
// modificación (los diez PV como tercer dígito); topes duros por modo sobre
// lo emitido; lo heredado alcanza siempre algo del foco; lo lejano sin base
// en el foco se ancla en su posición en vez de rechazarse.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejemploCompra } from '../ejemplos/ikisai/compra-food.mjs';
import { desdeMapped, escribirDesde, escribirSalida, ubicar, claseDe, CLASES } from '../src/escritura.js';
import { MODOS, tope, cabeTope, proporcion, proporcionDe, contarPosiciones, lectura } from '../src/modos.js';
import { consolidar, autorizar, ejecutar, FABRICA } from '../src/motor.js';
import { resolver, direccion } from '../src/btml.js';
import { ocupantes } from '../src/encaje.js';
import { Eje } from '../src/eje.js';

const T = '2026-11-07T18:00:00Z';
const ref = (id, dir) => ({ ref: id, dir });
const gastaT = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });

/** Lo que hay en el payload bajo una etiqueta de heredada (3, '1.2', '1.2.3'). */
const en = (payload, h) => String(h).split('.').map(Number).reduce((n, x) => n[x], payload);

test('clases de modificación: VG nombró 0–4; las 5–9 están sin decidir', () => {
  assert.equal(CLASES.length, 10);
  assert.deepEqual(CLASES.slice(0, 5), ['ver/sustituir', 'impulso de recursos', 'criterio', 'comunicación', 'acción']);
  assert.deepEqual(CLASES.slice(5), [null, null, null, null, null]); // [X] decidir VG
  assert.equal(claseDe('1240000000'), 4);
  assert.equal(claseDe('1200000000'), 0);
  assert.equal(claseDe(direccion([2, 0, 1])), 1);
});

test('ver es clase 0, emite una referencia a lo visto y solo ve lo que el foco tiene', async () => {
  const { eje, compra } = await ejemploCompra();
  // Ver la celda [1][2] (el precio) sin escribir nada: se emite una referencia a lo visto.
  const salida = desdeMapped(eje, [{ i: 1, j: 2, k: 0 }], compra.id);
  assert.deepEqual(salida.anclados, []);
  assert.deepEqual(salida.payload, [
    ref(compra.id, '0000000000'),
    [ref(compra.id, '1000000000'), ref(compra.id, '1100000000'), ref(compra.id, '1200000000')],
  ]);
  assert.deepEqual(salida.heredadas, [0, '1.0', '1.1']); // lo no modificado anterior a lo visto, por referencia
  assert.deepEqual(salida.vistas, ['1.2']);
  assert.equal(resolver(compra.payload, resolver(salida.payload, direccion([1, 2, 0])).dir), 'EUR 12');
  // No se ve lo que el foco no tiene: la compra no tiene 0.5 (su 0 es un terminal) ni 2.3.
  assert.throws(() => desdeMapped(eje, [{ i: 0, j: 5 }], compra.id), /^Error: no hay nada que ver en 0\.5: el foco no tiene esa celda$/);
  assert.throws(() => desdeMapped(eje, [{ i: 2, j: 3 }], compra.id), /no hay nada que ver en 2\.3/);
  assert.throws(() => desdeMapped(eje, [], compra.id), /vacía/);
  // El registro dice qué heredó; lo demás se vio. Ver 1.0 y 1.2 da el mismo payload que ver solo 1.2, no las mismas heredadas.
  const dos = desdeMapped(eje, [{ i: 1, j: 0 }, { i: 1, j: 2 }], compra.id);
  assert.deepEqual(dos.payload, salida.payload);
  assert.deepEqual(dos.heredadas, [0, '1.1']);
  assert.deepEqual(dos.vistas, ['1.0', '1.2']);
  const antes = eje.saldoT('huesped', 'minuto');
  const { registro } = await escribirSalida(eje, { autor: 'huesped', sobre: compra.id, salida, t: T });
  assert.deepEqual(registro.contexto.heredadas, [0, '1.0', '1.1']);
  assert.equal(antes - eje.saldoT('huesped', 'minuto'), 4); // el coste cuenta las posiciones del registro, heredadas incluidas
  const { registro: otro } = await escribirSalida(eje, { autor: 'huesped', sobre: compra.id, salida: dos, t: T });
  assert.deepEqual(otro.contexto.heredadas, [0, '1.1']);
  // [X] decidir VG: ver la subposición 0 da una dirección con ceros finales, que nombra la colisión con la posición.
  const cero = desdeMapped(eje, [{ i: 4, j: 0 }], compra.id);
  assert.deepEqual(cero.payload[4], ref(compra.id, '4000000000'));
  assert.deepEqual(resolver(compra.payload, '4000000000'), ['pagar', 'servir']); // no solo 'pagar'
});

test('toda referencia heredada alcanza algo en el foco: lo que no tiene base se ancla', async () => {
  const { eje, compra } = await ejemploCompra();
  let dentro = 0;
  for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) for (let k = 0; k < 10; k++) {
    const s = desdeMapped(eje, [{ i, j, k, contenido: 'x' }], compra.id);
    if (s.payload) dentro++;
    for (const h of s.heredadas) {
      const r = en(s.payload, h);
      assert.equal(r.ref, compra.id);
      assert.notEqual(resolver(compra.payload, r.dir), undefined, 'heredada colgante ' + h + ' al escribir ' + [i, j, k].join('.'));
    }
  }
  assert.equal(dentro, 14);
  // Pagar el precio de la compra ([1][2][4]): el precio es un terminal, no tiene clases que heredar; se ancla en 1240000000.
  assert.deepEqual(ubicar(eje, compra.id, [1, 2, 4]), { ubicacion: 'anclado', en: '1240000000', dir: '1240000000', faltan: ['1.2.0', '1.2.1', '1.2.2', '1.2.3'] });
  const pagar = desdeMapped(eje, [{ i: 1, j: 2, k: 4, contenido: 'pagar 12 EUR' }], compra.id);
  assert.equal(pagar.payload, null);
  assert.deepEqual(pagar.anclados, [{ celda: [1, 2, 4], en: '1240000000', payload: 'pagar 12 EUR', faltan: ['1.2.0', '1.2.1', '1.2.2', '1.2.3'] }]);
  const r = await escribirSalida(eje, { autor: 'huesped', sobre: compra.id, salida: pagar, t: T });
  assert.equal(r.anclados[0].en, '1240000000');
  assert.equal(r.anclados[0].movimientos[0].cantidad, 1);
});

test('un terminal no tiene posiciones que heredar, pero su dirección se puede ver', async () => {
  const { eje } = await ejemploCompra();
  const g = eje.genesisId; // payload 'Casa de ejemplo', un terminal
  // Mapa §12: un terminal no tiene posición 0. Escribir en la 1 de un foco terminal no hereda la 0: se ancla.
  const lineas = [];
  lineas[1] = ['algo'];
  const s = desdeMapped(eje, lineas, g);
  assert.equal(s.payload, null);
  assert.deepEqual(s.anclados, [{ celda: [1, 0, 0], en: '1000000000', payload: 'algo', faltan: ['0'] }]);
  // Ver 0.0 es ver la dirección 0000000000, que alcanza el terminal: los ceros finales nombran la colisión.
  const ver = desdeMapped(eje, [{ i: 0 }], g);
  assert.deepEqual(ver.payload, [ref(g, '0000000000')]);
  assert.deepEqual(ver.vistas, ['0.0']);
  assert.throws(() => desdeMapped(eje, [{ i: 1 }], g), /no hay nada que ver en 1\.0/);
});

test('pagar dentro: cuando el foco desarrolla las clases de la celda, se heredan y alcanzan', async () => {
  const { eje } = await ejemploCompra();
  // Una ficha cuyo precio [1][2] desarrolla las clases 0–3.
  const ficha = await eje.escribir({ autor: 'huesped', sobre: eje.genesisId, t: T, movimientos: [gastaT('huesped')], payload: ['Ficha', ['menú', 1, ['EUR 12', 'de huesped', 'precio fijo', 'aviso a cocina']]] });
  const salida = desdeMapped(eje, [{ i: 1, j: 2, k: 4, contenido: 'pagar 12 EUR' }], ficha.id);
  assert.deepEqual(salida.anclados, []);
  assert.equal(salida.payload[1][2][4], 'pagar 12 EUR');
  assert.deepEqual(salida.heredadas, [0, '1.0', '1.1', '1.2.0', '1.2.1', '1.2.2', '1.2.3']);
  assert.deepEqual(['1.2.1', '1.2.2', '1.2.3'].map((h) => resolver(ficha.payload, en(salida.payload, h).dir)), ['de huesped', 'precio fijo', 'aviso a cocina']);
  // 1.2.0 nombra la colisión con 1.2 (ceros finales): alcanza la celda entera.
  assert.deepEqual(resolver(ficha.payload, en(salida.payload, '1.2.0').dir), ['EUR 12', 'de huesped', 'precio fijo', 'aviso a cocina']);
  // Una sola modificación: el tope cuenta lo emitido (1), no las siete heredadas. Cabe en Pointed.
  const ev = await escribirDesde(eje, { modo: 'pointed', autor: 'huesped', sobre: ficha.id, celda: [1, 2, 4], payload: 'pagar 12 EUR', t: T });
  assert.deepEqual(ev.payload, salida.payload);
  assert.equal(ev.en, '0000000000');
  assert.deepEqual(ev.contexto.heredadas, salida.heredadas);
  assert.equal(ev.movimientos[0].cantidad, 8); // el coste sí cuenta el relleno ([X] decidir VG)
});

test('el tope cuenta lo emitido, no las referencias de relleno', async () => {
  const { eje, compra } = await ejemploCompra();
  // [4][1] es 'servir', un terminal: la celda [4][1][5] se ancla y cuesta una posición.
  const solo = await escribirDesde(eje, { modo: 'pointed', autor: 'huesped', sobre: compra.id, celda: [4, 1, 5], payload: 'x', t: T });
  assert.equal(solo.en, '4150000000');
  assert.equal(solo.movimientos[0].cantidad, 1);
  // Un registro con diez posiciones escritas y una heredada cabe en Pointed si se dice qué es heredado.
  const lineas = [];
  lineas[1] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
  const s = desdeMapped(eje, lineas, compra.id);
  assert.equal(contarPosiciones(s.payload), 11);
  await assert.rejects(escribirDesde(eje, { modo: 'pointed', autor: 'huesped', sobre: compra.id, payload: s.payload, t: T }), /Pointed emite como mucho 10 posiciones; este registro tiene 11/);
  const ev = await escribirDesde(eje, { modo: 'pointed', autor: 'huesped', sobre: compra.id, payload: s.payload, heredadas: s.heredadas, t: T });
  assert.deepEqual(ev.contexto.heredadas, [0]);
  // Lo que se declara heredado ha de ser una referencia al foco en su dirección.
  await assert.rejects(escribirDesde(eje, { modo: 'pointed', autor: 'huesped', sobre: compra.id, payload: s.payload, heredadas: [1], t: T }), /la heredada 1 no es una referencia al foco en 1000000000/);
  await assert.rejects(escribirDesde(eje, { modo: 'pointed', autor: 'huesped', sobre: compra.id, payload: [ref(compra.id, '0000000000')], heredadas: [0], t: T }), /nada que emitir/);
  await assert.rejects(escribirDesde(eje, { modo: 'pointed', autor: 'huesped', sobre: compra.id, payload: s.payload, heredadas: ['x'], t: T }), /heredada no válida: x/);
});

test('con celda y camino, la celda cae donde dice ubicar', async () => {
  const { eje, compra } = await ejemploCompra();
  // Bajo la posición 1 de la compra ([menú, 1, 'EUR 12']), la celda [3][0][0] va dentro y cae en 1300000000.
  assert.deepEqual(ubicar(eje, compra.id, [3, 0, 0], { camino: [1] }), { ubicacion: 'dentro', dir: '1300000000', faltan: [] });
  const ev = await escribirDesde(eje, { modo: 'mapped', autor: 'huesped', sobre: compra.id, celda: [3, 0, 0], camino: [1], payload: 'postre', t: T });
  assert.equal(ev.en, '1000000000'); // el registro va en la dirección del camino
  assert.deepEqual(ev.payload, [ref(compra.id, '1000000000'), ref(compra.id, '1100000000'), ref(compra.id, '1200000000'), 'postre']);
  assert.deepEqual(ev.contexto.heredadas, [0, 1, 2]);
  await assert.rejects(
    escribirDesde(eje, { modo: 'mapped', autor: 'huesped', sobre: compra.id, celda: [3, 0, 0], camino: [1], en: '4000000000', payload: 'postre', t: T }),
    /^Error: la celda 3\.0\.0 cae en 1300000000: el registro va en 1000000000, no en 4000000000$/,
  );
  // Anclada: su dirección absoluta, la misma que da ubicar.
  assert.deepEqual(ubicar(eje, compra.id, [0, 1, 0], { camino: [1] }), { ubicacion: 'anclado', en: '1010000000', dir: '1010000000', faltan: ['0.0'] });
  const anclada = await escribirDesde(eje, { modo: 'mapped', autor: 'huesped', sobre: compra.id, celda: [0, 1, 0], camino: [1], payload: 'dentro', t: T });
  assert.equal(anclada.en, '1010000000');
  assert.equal(anclada.payload, 'dentro');
  const lejos = await escribirDesde(eje, { modo: 'mapped', autor: 'huesped', sobre: compra.id, celda: [7, 0, 0], camino: [1], payload: 'lejos', t: T });
  assert.equal(lejos.en, '1700000000');
  // escribirSalida toma el camino de la salida: el registro va en 1000000000 y lo anclado en su dirección.
  const lineas = [];
  lineas[3] = ['flan'];
  lineas[8] = ['muy lejos'];
  const salida = desdeMapped(eje, lineas, compra.id, [1]);
  assert.deepEqual(salida.camino, [1]);
  const r = await escribirSalida(eje, { autor: 'huesped', sobre: compra.id, salida, t: T });
  assert.equal(r.registro.en, '1000000000');
  assert.equal(r.registro.payload[3], 'flan');
  assert.equal(r.anclados[0].en, '1800000000');
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

test('una matriz de 1000 posiciones cabe en Mapped y no en Sequenced; la proporción informa', async () => {
  // Escribir mil posiciones cuesta mil minutos: un eje propio cuyo génesis los emite.
  const eje = await Eje.genesis({ identidad: 'casa', emision: [{ token: 'T', escala: 'minuto', cantidad: 3000 }], foco: 'Casa de ejemplo', t: T });
  const foco = eje.genesisId;
  const celdas = [];
  for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) for (let k = 0; k < 10; k++) celdas.push({ i, j, k, contenido: i + '.' + j + '.' + k });
  const salida = desdeMapped(eje, celdas, foco);
  assert.deepEqual(salida.heredadas, []);
  assert.deepEqual(salida.anclados, []);
  const { payload } = salida;
  assert.equal(contarPosiciones(payload), 1000);
  assert.equal(payload[1][2][4], '1.2.4');
  assert.equal(cabeTope(payload, 'mapped'), true);
  assert.equal(cabeTope(payload, 'sequenced'), false);
  // La proporción es el estándar (de 250 a 333 en Mapped): hoy informa, no rechaza ([X] decidir VG).
  assert.deepEqual(proporcion(payload, 'mapped'), { posiciones: 1000, rango: [250, 333], estado: 'por encima' });
  assert.deepEqual(proporcion(['a'], 'pointed'), { posiciones: 1, rango: [1, 1], estado: 'dentro' });
  assert.deepEqual(proporcion(['a'], 'scened'), { posiciones: 1, rango: null, estado: 'sin fijar' });
  assert.deepEqual(proporcionDe(5, 'sequenced'), { posiciones: 5, rango: [10, 20], estado: 'por debajo' });
  await assert.rejects(
    escribirDesde(eje, { modo: 'sequenced', autor: 'casa', sobre: foco, payload, t: T }),
    /^Error: Sequenced emite como mucho 100 posiciones; este registro tiene 1000$/,
  );
  const r = await escribirSalida(eje, { modo: 'mapped', autor: 'casa', sobre: foco, salida, t: T });
  assert.equal(r.registro.movimientos[0].cantidad, 1000);
  assert.deepEqual(r.proporcion, { posiciones: 1000, rango: [250, 333], estado: 'por encima' }); // la escritura informa
  await assert.rejects(
    escribirDesde(eje, { modo: 'mapped', autor: 'casa', sobre: foco, payload: [...payload.slice(0, 9), [payload[9], 'una más']], t: T }),
    /Mapped emite como mucho 1000 posiciones; este registro tiene 1001/,
  );
});

test('lo lejano sin base en el foco se ancla en su posición en vez de rechazarse', async () => {
  const { eje, compra } = await ejemploCompra();
  // La compra desarrolla las posiciones 0–4: la 7 queda lejos (sin 5 ni 6 que heredar).
  assert.deepEqual(ubicar(eje, compra.id, [7, 0, 0]), { ubicacion: 'anclado', en: '7000000000', dir: '7000000000', faltan: ['5', '6'] });
  assert.deepEqual(ubicar(eje, compra.id, [2, 0, 0]), { ubicacion: 'dentro', dir: '2000000000', faltan: [] });
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
  const { registro, anclados, proporcion: p } = await escribirSalida(eje, { modo: 'mapped', autor: 'huesped', sobre: compra.id, salida, t: T });
  assert.equal(registro.en, '0000000000');
  assert.deepEqual(registro.contexto.heredadas, [0, 1]);
  assert.equal(anclados.length, 1);
  assert.equal(anclados[0].en, '7000000000');
  assert.equal(anclados[0].sobre, compra.id);
  assert.equal(anclados[0].payload, 'repetir el sábado');
  assert.equal(anclados[0].contexto.heredadas, undefined);
  assert.equal(antes - eje.saldoT('huesped', 'minuto'), 4); // tres posiciones dentro, una anclada
  assert.equal(p.posiciones, 2); // emitidas: lo escrito, no lo heredado
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

test('el tope cuenta lo emitido por la salida entera: registro y anclados', async () => {
  const { eje, compra } = await ejemploCompra();
  const lineas = [];
  lineas[1] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
  lineas[7] = ['lejos'];
  const salida = desdeMapped(eje, lineas, compra.id);
  assert.equal(contarPosiciones(salida.payload), 11); // diez escritas y la 0 heredada
  await assert.rejects(
    escribirSalida(eje, { modo: 'pointed', autor: 'huesped', sobre: compra.id, salida, t: T }),
    /Pointed emite como mucho 10 posiciones; esta salida tiene 11/,
  );
  assert.equal(eje.sobre(compra.id).length, 0); // nada se escribió
  // Una salida que no es de este foco no pasa: sus heredadas no son referencias a él.
  const otra = await eje.escribir({ autor: 'huesped', sobre: compra.id, t: T, movimientos: [gastaT('huesped')], payload: ['otra', 'cosa', 'más'] });
  const ajena = desdeMapped(eje, [{ i: 2, j: 0, k: 0, contenido: 'x' }], otra.id);
  await assert.rejects(escribirSalida(eje, { autor: 'huesped', sobre: compra.id, salida: ajena, t: T }), /la heredada 0 no es una referencia al foco/);
});

test('líneas de Mapped: cada línea es texto, como antes; el prefijo de celda solo si se pide', async () => {
  const { eje, compra } = await ejemploCompra();
  // Sin pedirlo, una línea que empieza por «d.d » es texto: el sentido de siempre.
  const kilo = [];
  kilo[1] = ['1.5 kg de harina'];
  assert.deepEqual(desdeMapped(eje, kilo, compra.id).payload, [ref(compra.id, '0000000000'), '1.5 kg de harina']);
  const horas = [];
  horas[0] = ['2.5 horas de cocina'];
  assert.deepEqual(desdeMapped(eje, horas, compra.id).payload, ['2.5 horas de cocina']);
  const lineas = [];
  lineas[4] = ['pagado', '0.1 con tarjeta', 'servido'];
  const llano = desdeMapped(eje, lineas, compra.id);
  assert.deepEqual(llano.payload[4], ['pagado', '0.1 con tarjeta', 'servido']);
  assert.deepEqual(llano.heredadas, [0, 1, 2, 3]);
  // Con { prefijo: true }, «j.k texto» fija subposición y clase; las demás van a las subposiciones libres con clase 0.
  const conPrefijo = desdeMapped(eje, lineas, compra.id, [], { prefijo: true });
  assert.deepEqual(conPrefijo.payload[4], [ref(compra.id, '4000000000'), 'pagado', 'servido']);
  // [4][0] es 'pagar', un terminal: la clase 1 de 4.0 no tiene base y se ancla.
  assert.deepEqual(conPrefijo.anclados, [{ celda: [4, 0, 1], en: '4010000000', payload: 'con tarjeta', faltan: ['4.0.0'] }]);
  const pagar = [];
  pagar[1] = ['2.4 pagar 12 EUR'];
  assert.deepEqual(desdeMapped(eje, pagar, compra.id, [], { prefijo: true }).anclados, desdeMapped(eje, [{ i: 1, j: 2, k: 4, contenido: 'pagar 12 EUR' }], compra.id).anclados);
  const repetida = [];
  repetida[2] = ['0.0 uno', '0.0 dos'];
  assert.throws(() => desdeMapped(eje, repetida, compra.id, [], { prefijo: true }), /la celda 2\.0\.0 está dos veces/);
  assert.deepEqual(desdeMapped(eje, repetida, compra.id).payload[2], ['0.0 uno', '0.0 dos']);
  assert.throws(() => desdeMapped(eje, [{ i: 1, j: 2, k: 4 }], compra.id), /falta el contenido de 1\.2\.4/);
  assert.throws(() => desdeMapped(eje, [{ i: 1, j: 10, k: 0, contenido: 'x' }], compra.id), /fuera de la matriz/);
  assert.throws(() => desdeMapped(eje, [['a'], { i: 1, j: 0, k: 0, contenido: 'x' }], compra.id), /mezcla/);
  const once = [];
  once[3] = Array.from({ length: 11 }, (_, x) => 'x' + x);
  assert.throws(() => desdeMapped(eje, once, compra.id), /más de 10 subposiciones/);
});

test('el motor no guarda clase: consolidar y ejecutar quedan como estaban; la clase se lee de la dirección', async () => {
  const { eje, compra } = await ejemploCompra();
  const c = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: T, elecciones: { 1: ref(compra.id, '1200000000'), 4: 'pagar' } });
  // Solo las fuentes llevan encaje; un terminal nuevo no.
  assert.deepEqual(c.contexto.encaje.map((e) => e.posicion), [1]);
  assert.equal(c.contexto.encaje[0].clase, undefined);
  assert.equal(claseDe(c.contexto.encaje[0].destino), 0); // al leer, el tercer dígito del destino
  await autorizar(eje, { autorizante: 'casa', consolidacion: c.id, t: T });
  const e = await ejecutar(eje, { autor: 'huesped', consolidacion: c.id, t: T });
  assert.equal(e.contexto.clase, undefined);
  assert.equal(e.en, FABRICA);
  assert.equal(claseDe(e.en), 0); // [X] decidir VG: la ejecución es acción, pero FABRICA tiene tercer dígito 0
});
