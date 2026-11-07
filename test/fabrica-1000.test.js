// La fábrica y la matriz 10×10×10 (VG, 7-11 tarde): el registro de salida
// emite solo las celdas modificadas; la tercera dimensión es la clase de
// modificación (los diez PV); la matriz es relativa al camino: bajo un
// camino de profundidad n, la celda i.j.k cae en direccion([...c, i, j, k])
// y su clase es el dígito n + 2 (claseDe(dir, camino)); topes duros por modo
// sobre lo emitido, además de la proporción (que rechaza como antes y se
// mira primero: [X] decidir VG); lo heredado alcanza siempre algo del foco
// (la raíz de un foco terminal hereda su posición 0, como en main: [X]); lo
// lejano sin base en el foco se ancla en su posición en vez de rechazarse;
// ubicar tiene en cuenta los límites del modo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejemploCompra } from '../ejemplos/ikisai/compra-food.mjs';
import { desdeMapped, escribirDesde, escribirSalida, ubicar, claseDe, CLASES } from '../src/escritura.js';
import { MODOS, tope, cabeTope, cabeEscritura, proporcion, proporcionDe, contarPosiciones, lectura } from '../src/modos.js';
import { consolidar, autorizar, ejecutar, FABRICA } from '../src/motor.js';
import { resolver, direccion } from '../src/btml.js';
import { ocupantes } from '../src/encaje.js';
import { Eje } from '../src/eje.js';

const T = '2026-11-07T18:00:00Z';
const ref = (id, dir) => ({ ref: id, dir });
const gastaT = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });

/** Lo que hay en el payload bajo una etiqueta de heredada (3, '1.2', '1.2.3'). */
// Por hojas (VG, 7-11 noche): bajo la raíz, la salida envuelve el 0 de una décupla solo de hojas ([[ref], ref…]); la heredada es su único ocupante.
const en = (payload, h) => {
  const n = String(h).split('.').map(Number).reduce((x, k) => x[k], payload);
  return Array.isArray(n) && n.length === 1 && String(h).includes('.') ? n[0] : n;
};

/** Un eje propio con mucho T, para escribir registros grandes. */
const ejeGrande = (minutos) => Eje.genesis({ demostracion: true, identidad: 'casa', emision: [{ token: 'T', escala: 'minuto', cantidad: minutos }], foco: 'Casa de ejemplo', t: T });

/**
 * Una ficha cuyo precio [1][2] desarrolla las clases 0–3. VG, 7-11 noche: por hojas: el precio es una
 * décupla porque su 0 va envuelto (['EUR 12']); con solo hojas sería una lista de cuatro ocupantes.
 */
const escribirFicha = (eje) => eje.escribir({ autor: 'huesped', sobre: eje.genesisId, t: T, movimientos: [gastaT('huesped')], payload: ['Ficha', ['menú', 1, [['EUR 12'], 'de huesped', 'precio fijo', 'aviso a cocina']]] });

test('clases de modificación: VG nombró 0–4; las 5–9 están sin decidir; la clase es el dígito n+2 bajo el camino', () => {
  assert.equal(CLASES.length, 10);
  assert.deepEqual(CLASES.slice(0, 5), ['ver/sustituir', 'impulso de recursos', 'criterio', 'comunicación', 'acción']);
  assert.deepEqual(CLASES.slice(5), [null, null, null, null, null]); // [X] decidir VG
  // Sin camino, el tercer dígito.
  assert.equal(claseDe('1240000000'), 4);
  assert.equal(claseDe('1200000000'), 0);
  assert.equal(claseDe(direccion([2, 0, 1])), 1);
  // La misma dirección, desde otro camino, es otra celda con otra clase.
  assert.equal(claseDe('1734000000'), 3); // 1.7.3 desde la raíz
  assert.equal(claseDe('1734000000', [1]), 4); // 7.3.4 bajo [1]
  assert.equal(claseDe('1734000000', [1, 7]), 0); // 3.4.0 bajo [1, 7]
  assert.equal(claseDe('1010000000', [1]), 0); // 0.1.0 bajo [1]: no la 1 del tercer dígito
  assert.equal(claseDe('1010000000'), 1); // 1.0.1 desde la raíz
  for (const camino of [[], [1], [1, 2], [1, 2, 3, 4, 5, 6, 7]]) {
    for (let k = 0; k < 10; k++) assert.equal(claseDe(direccion([...camino, 5, 6, k]), camino), k);
  }
  // La dirección ha de estar bajo el camino, y el camino ha de dejar sitio a la clase.
  assert.throws(() => claseDe('2000000000', [1]), /^Error: la dirección 2000000000 no está bajo el camino 1$/);
  assert.throws(() => claseDe('1234567890', [1, 2, 3, 4, 5, 6, 7, 8]), /no cabe la clase/);
  assert.throws(() => claseDe('12', []), /dirección no válida/);
});

test('ver es clase 0, emite una referencia a lo visto y solo ve lo que el foco tiene', async () => {
  const { eje, compra } = await ejemploCompra();
  // Ver la celda [1][2] (el precio) sin escribir nada: se emite una referencia a lo visto.
  const salida = desdeMapped(eje, [{ i: 1, j: 2, k: 0 }], compra.id);
  assert.deepEqual(salida.anclados, []);
  assert.deepEqual(salida.payload, [
    ref(compra.id, '0000000000'),
    [[ref(compra.id, '1000000000')], ref(compra.id, '1100000000'), ref(compra.id, '1200000000')], // por hojas: el 0 envuelto, para que sea décupla
  ]);
  assert.deepEqual(salida.heredadas, [0, '1.0', '1.1']); // lo no modificado anterior a lo visto, por referencia
  assert.deepEqual(salida.vistas, ['1.2']);
  assert.equal(resolver(compra.payload, resolver(salida.payload, direccion([1, 2, 0])).dir), 'EUR 12');
  // No se ve lo que el foco no tiene: la compra no tiene 0.5 (su 0 es un terminal) ni 2.3.
  assert.throws(() => desdeMapped(eje, [{ i: 0, j: 5 }], compra.id), /^Error: no hay nada que ver en 0\.5: el foco no tiene esa celda$/);
  assert.throws(() => desdeMapped(eje, [{ i: 2, j: 3 }], compra.id), /no hay nada que ver en 2\.3/);
  assert.throws(() => desdeMapped(eje, [], compra.id), /vacía/);
  // Se ve una celda si y solo si su dirección alcanza algo en el foco: lo visto nunca cuelga.
  for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) {
    let visto = true;
    try { desdeMapped(eje, [{ i, j }], compra.id); } catch (e) { assert.match(e.message, /no hay nada que ver/); visto = false; }
    assert.equal(visto, resolver(compra.payload, direccion([i, j])) !== undefined, 'ver ' + i + '.' + j);
  }
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
  assert.equal(dentro, 9); // VG, 7-11 noche: por hojas. Las posiciones 2, 3 y 4 de la compra son listas: sin subposiciones que heredar
  // Lo mismo bajo un camino y sobre un foco terminal (el génesis, que hereda su posición 0 como en main): nada cuelga.
  for (const foco of [compra, eje.obtener(eje.genesisId)]) {
    for (const camino of [[], [1], [1, 2]]) {
      for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) for (const k of [0, 1, 4]) {
        const s = desdeMapped(eje, [{ i, j, k, contenido: 'x' }], foco.id, camino);
        for (const h of s.heredadas) {
          const r = en(s.payload, h);
          assert.equal(r.dir, direccion([...camino, ...String(h).split('.').map(Number)]));
          assert.notEqual(resolver(foco.payload, r.dir), undefined, 'heredada colgante ' + h + ' bajo ' + camino.join('.') + ' al escribir ' + [i, j, k].join('.'));
        }
        for (const a of s.anclados) assert.equal(a.en, direccion([...camino, i, j, k]));
      }
    }
  }
  // Pagar el precio de la compra ([1][2][4]): el precio es un terminal, no tiene clases que heredar; se ancla en 1240000000.
  assert.deepEqual(ubicar(eje, compra.id, [1, 2, 4]), { ubicacion: 'anclado', en: '1240000000', dir: '1240000000', faltan: ['1.2.0', '1.2.1', '1.2.2', '1.2.3'] });
  const pagar = desdeMapped(eje, [{ i: 1, j: 2, k: 4, contenido: 'pagar 12 EUR' }], compra.id);
  assert.equal(pagar.payload, null);
  assert.deepEqual(pagar.anclados, [{ celda: [1, 2, 4], en: '1240000000', payload: 'pagar 12 EUR', faltan: ['1.2.0', '1.2.1', '1.2.2', '1.2.3'] }]);
  const r = await escribirSalida(eje, { autor: 'huesped', sobre: compra.id, salida: pagar, t: T });
  assert.equal(r.anclados[0].en, '1240000000');
  assert.equal(r.anclados[0].movimientos[0].cantidad, 1);
  // Lo que se declara heredado al escribir también ha de alcanzar algo: la compra no tiene 1.3.
  const colgante = [ref(compra.id, '0000000000'), [ref(compra.id, '1000000000'), ref(compra.id, '1100000000'), ref(compra.id, '1200000000'), ref(compra.id, '1300000000'), 'x']];
  await assert.rejects(
    escribirDesde(eje, { modo: 'mapped', autor: 'huesped', sobre: compra.id, payload: colgante, heredadas: [0, '1.0', '1.1', '1.2', '1.3'], t: T }),
    /^Error: la heredada 1\.3 no alcanza nada en el foco: solo se hereda lo que el foco tiene$/,
  );
});

test('la raíz de un foco terminal hereda su posición 0, como en main ([X] decidir VG); su dirección se puede ver', async () => {
  const { eje, compra } = await ejemploCompra();
  const g = eje.genesisId; // payload 'Casa de ejemplo', un terminal
  // Como en main (el mapa §12 lo deja PENDIENTE): escribir en la 1 de un foco terminal hereda su 0,
  // y esa referencia alcanza el terminal por la colisión de ceros finales.
  const lineas = [];
  lineas[1] = ['algo'];
  const s = desdeMapped(eje, lineas, g);
  assert.deepEqual(s.payload, [ref(g, '0000000000'), 'algo']);
  assert.deepEqual(s.heredadas, [0]);
  assert.deepEqual(s.anclados, []);
  assert.equal(resolver(eje.obtener(g).payload, s.payload[0].dir), 'Casa de ejemplo');
  // Así escribe app.js (escribirDesde con el payload de desdeMapped): ya no falla.
  const app = await escribirDesde(eje, { modo: 'mapped', autor: 'huesped', sobre: g, payload: s.payload, t: T });
  assert.deepEqual(app.payload, [ref(g, '0000000000'), 'algo']);
  const { registro } = await escribirSalida(eje, { autor: 'huesped', sobre: g, salida: s, t: T });
  assert.deepEqual(registro.contexto.heredadas, [0]);
  // Lo mismo con un camino que lleva a un terminal: el precio de la compra, bajo [1, 2].
  const bajo = desdeMapped(eje, lineas, compra.id, [1, 2]);
  assert.deepEqual(bajo.payload, [ref(compra.id, '1200000000'), 'algo']);
  assert.equal(resolver(compra.payload, bajo.payload[0].dir), 'EUR 12');
  assert.equal(ubicar(eje, compra.id, [1, 0, 0], { camino: [1, 2] }).ubicacion, 'dentro');
  // Solo la posición 0 de la raíz: lo demás que cuelga de un terminal no tiene base y se ancla.
  assert.deepEqual(desdeMapped(eje, [{ i: 0, j: 1, k: 0, contenido: 'x' }], g).anclados, [{ celda: [0, 1, 0], en: '0100000000', payload: 'x', faltan: ['0.0'] }]);
  assert.deepEqual(desdeMapped(eje, [{ i: 2, contenido: 'x' }], g).anclados, [{ celda: [2, 0, 0], en: '2000000000', payload: 'x', faltan: ['1'] }]);
  // Ver 0.0 es ver la dirección 0000000000, que alcanza el terminal: los ceros finales nombran la colisión.
  const ver = desdeMapped(eje, [{ i: 0 }], g);
  assert.deepEqual(ver.payload, [ref(g, '0000000000')]);
  assert.deepEqual(ver.vistas, ['0.0']);
  assert.throws(() => desdeMapped(eje, [{ i: 1 }], g), /no hay nada que ver en 1\.0/);
});

test('ubicar tiene en cuenta los límites del modo: dentro solo si el registro, con su relleno, cabe', async () => {
  const { eje, compra } = await ejemploCompra();
  // Sin modo, solo la base: [2][0][0] tiene base (la compra tiene 0 y 1) y va dentro.
  assert.deepEqual(ubicar(eje, compra.id, [2, 0, 0]), { ubicacion: 'dentro', en: '0000000000', dir: '2000000000', faltan: [] });
  assert.deepEqual(ubicar(eje, compra.id, [2, 0, 0], { modo: 'mapped' }), { ubicacion: 'dentro', en: '0000000000', dir: '2000000000', faltan: [] });
  // En Pointed (proporción: 1 posición), dentro serían 3 (dos heredadas y la celda): se ancla sola.
  assert.deepEqual(ubicar(eje, compra.id, [2, 0, 0], { modo: 'pointed' }), {
    ubicacion: 'anclado', en: '2000000000', dir: '2000000000', faltan: [], motivo: 'pointed escribe como mucho 1 posiciones; dentro, el registro tiene 3',
  });
  // Sin relleno, cabe dentro también en Pointed.
  assert.equal(ubicar(eje, compra.id, [0, 0, 0], { modo: 'pointed' }).ubicacion, 'dentro');
  // Lo que no cabe ni solo es un error.
  assert.throws(() => ubicar(eje, compra.id, [2, 0, 0], { modo: 'pointed', contenido: ['a', 'b'] }), /^Error: pointed escribe como mucho 1 posiciones; esta celda tiene 2$/);
  // La proporción se mira primero (el mensaje de siempre); el tope decide donde no hay proporción (Scened).
  assert.throws(() => ubicar(eje, compra.id, [2, 0, 0], { modo: 'pointed', contenido: Array(11).fill('x') }), /^Error: pointed escribe como mucho 1 posiciones; esta celda tiene 11$/);
  const diezMilUno = [Array(10).fill(Array(10).fill(Array(10).fill(Array(10).fill('z')))), 'una más'];
  assert.throws(() => ubicar(eje, compra.id, [2, 0, 0], { modo: 'scened', contenido: diezMilUno }), /^Error: Scened emite como mucho 10000 posiciones; esta celda tiene 10001$/);
  // escribirDesde con celda usa lo mismo: en Pointed, la celda [2][0][0] se escribe anclada, una posición, un minuto.
  const ev = await escribirDesde(eje, { modo: 'pointed', autor: 'huesped', sobre: compra.id, celda: [2, 0, 0], payload: 'sin lactosa', t: T });
  assert.equal(ev.en, '2000000000');
  assert.equal(ev.payload, 'sin lactosa');
  assert.equal(ev.movimientos[0].cantidad, 1);
  assert.equal(ev.contexto.heredadas, undefined);
});

test('pagar dentro: cuando el foco desarrolla las clases de la celda, se heredan y alcanzan', async () => {
  const { eje } = await ejemploCompra();
  const ficha = await escribirFicha(eje);
  const salida = desdeMapped(eje, [{ i: 1, j: 2, k: 4, contenido: 'pagar 12 EUR' }], ficha.id);
  assert.deepEqual(salida.anclados, []);
  assert.equal(salida.payload[1][2][4], 'pagar 12 EUR');
  assert.deepEqual(salida.heredadas, [0, '1.0', '1.1', '1.2.0', '1.2.1', '1.2.2', '1.2.3']);
  assert.deepEqual(['1.2.1', '1.2.2', '1.2.3'].map((h) => resolver(ficha.payload, en(salida.payload, h).dir)), ['de huesped', 'precio fijo', 'aviso a cocina']);
  // 1.2.0 nombra la colisión con 1.2 (ceros finales): alcanza la celda entera.
  assert.deepEqual(resolver(ficha.payload, en(salida.payload, '1.2.0').dir), [['EUR 12'], 'de huesped', 'precio fijo', 'aviso a cocina']);
  // En Mapped, la celda va dentro: una sola emitida, siete heredadas; el registro va en la raíz, donde dice ubicar.
  const u = ubicar(eje, ficha.id, [1, 2, 4], { modo: 'mapped' });
  const ev = await escribirDesde(eje, { modo: 'mapped', autor: 'huesped', sobre: ficha.id, celda: [1, 2, 4], payload: 'pagar 12 EUR', t: T });
  assert.equal(ev.en, u.en);
  assert.deepEqual(ev.payload, salida.payload);
  assert.deepEqual(ev.contexto.heredadas, salida.heredadas);
  assert.equal(ev.movimientos[0].cantidad, 8); // el coste sí cuenta el relleno ([X] decidir VG)
  // En Pointed, dentro serían 8 posiciones: ubicar la ancla en 1240000000, una posición, un minuto.
  const p = await escribirDesde(eje, { modo: 'pointed', autor: 'huesped', sobre: ficha.id, celda: [1, 2, 4], payload: 'pagar 12 EUR', t: T });
  assert.equal(p.en, '1240000000');
  assert.equal(p.payload, 'pagar 12 EUR');
  assert.equal(p.movimientos[0].cantidad, 1);
});

test('el tope cuenta lo emitido, no las referencias de relleno', async () => {
  const { eje, compra } = await ejemploCompra();
  // [4][1] es 'servir', un terminal: la celda [4][1][5] se ancla y cuesta una posición.
  const solo = await escribirDesde(eje, { modo: 'pointed', autor: 'huesped', sobre: compra.id, celda: [4, 1, 5], payload: 'x', t: T });
  assert.equal(solo.en, '4150000000');
  assert.equal(solo.movimientos[0].cantidad, 1);
  // Scened no tiene proporción: solo rechaza su tope. Diez mil posiciones emitidas y una heredada caben si se dice qué es heredado.
  const grande = await ejeGrande(30000);
  const foco = await grande.escribir({ autor: 'casa', sobre: grande.genesisId, t: T, movimientos: [gastaT('casa')], payload: ['algo'] });
  const diezMil = Array(10).fill(Array(10).fill(Array(10).fill(Array(10).fill('z'))));
  const payload = [ref(foco.id, '0000000000'), diezMil];
  assert.equal(contarPosiciones(payload), 10001);
  await assert.rejects(
    escribirDesde(grande, { modo: 'scened', autor: 'casa', sobre: foco.id, payload, t: T }),
    /^Error: Scened emite como mucho 10000 posiciones; este registro tiene 10001$/,
  );
  const ev = await escribirDesde(grande, { modo: 'scened', autor: 'casa', sobre: foco.id, payload, heredadas: [0], t: T });
  assert.deepEqual(ev.contexto.heredadas, [0]);
  assert.equal(ev.movimientos[0].cantidad, 10001); // el coste sí cuenta el relleno ([X] decidir VG)
  // Lo que se declara heredado ha de ser una referencia al foco en su dirección.
  const { payload: diez } = desdeMapped(eje, [{ i: 1, j: 0, k: 0, contenido: 'a' }], compra.id);
  await assert.rejects(escribirDesde(eje, { modo: 'mapped', autor: 'huesped', sobre: compra.id, payload: diez, heredadas: [1], t: T }), /la heredada 1 no es una referencia al foco en 1000000000/);
  await assert.rejects(escribirDesde(eje, { modo: 'mapped', autor: 'huesped', sobre: compra.id, payload: [ref(compra.id, '0000000000')], heredadas: [0], t: T }), /nada que emitir/);
  await assert.rejects(escribirDesde(eje, { modo: 'mapped', autor: 'huesped', sobre: compra.id, payload: diez, heredadas: ['x'], t: T }), /heredada no válida: x/);
  // Con heredadas, el registro va en la dirección de su camino (como con celda): en otra, ese relleno no sería el de su sitio.
  const raiz = desdeMapped(eje, [{ i: 2, contenido: 'x' }], compra.id);
  await assert.rejects(
    escribirDesde(eje, { modo: 'mapped', autor: 'huesped', sobre: compra.id, en: '4000000000', payload: raiz.payload, heredadas: raiz.heredadas, t: T }),
    /^Error: con heredadas, el registro va en 0000000000 \(la dirección de su camino\), no en 4000000000$/,
  );
  const bajo = desdeMapped(eje, [{ i: 3, contenido: 'postre' }], compra.id, [1]);
  await assert.rejects(
    escribirDesde(eje, { modo: 'mapped', autor: 'huesped', sobre: compra.id, en: '1400000000', camino: [1], payload: bajo.payload, heredadas: bajo.heredadas, t: T }),
    /^Error: con heredadas, el registro va en 1000000000 \(la dirección de su camino\), no en 1400000000$/,
  );
  const enSuSitio = await escribirDesde(eje, { modo: 'mapped', autor: 'huesped', sobre: compra.id, en: '1000000000', camino: [1], payload: bajo.payload, heredadas: bajo.heredadas, t: T });
  assert.deepEqual(enSuSitio.contexto.heredadas, [0, 1, 2]);
});

test('con celda y camino, el registro va donde dice ubicar', async () => {
  const { eje, compra } = await ejemploCompra();
  // Bajo la posición 1 de la compra ([menú, 1, 'EUR 12']), la celda [3][0][0] va dentro: el registro en 1000000000 y la celda cae en 1300000000.
  const u = ubicar(eje, compra.id, [3, 0, 0], { camino: [1], modo: 'mapped' });
  assert.deepEqual(u, { ubicacion: 'dentro', en: '1000000000', dir: '1300000000', faltan: [] });
  const ev = await escribirDesde(eje, { modo: 'mapped', autor: 'huesped', sobre: compra.id, celda: [3, 0, 0], camino: [1], payload: 'postre', t: T });
  assert.equal(ev.en, u.en);
  assert.deepEqual(ev.payload, [ref(compra.id, '1000000000'), ref(compra.id, '1100000000'), ref(compra.id, '1200000000'), 'postre']);
  assert.equal(resolver(ev.payload, '3000000000'), 'postre'); // [3] del registro, que va en 1: la celda cae en 1.3
  assert.deepEqual(ev.contexto.heredadas, [0, 1, 2]);
  await assert.rejects(
    escribirDesde(eje, { modo: 'mapped', autor: 'huesped', sobre: compra.id, celda: [3, 0, 0], camino: [1], en: '4000000000', payload: 'postre', t: T }),
    /^Error: la celda 3\.0\.0 cae en 1300000000: el registro va en 1000000000, no en 4000000000$/,
  );
  // En Pointed la misma celda no cabe dentro (4 posiciones): se ancla en su dirección absoluta, la que da ubicar.
  const up = ubicar(eje, compra.id, [3, 0, 0], { camino: [1], modo: 'pointed' });
  const p = await escribirDesde(eje, { modo: 'pointed', autor: 'huesped', sobre: compra.id, celda: [3, 0, 0], camino: [1], payload: 'postre', t: T });
  assert.equal(p.en, up.en);
  assert.equal(p.en, '1300000000');
  // Anclada por falta de base: su dirección absoluta, la misma que da ubicar.
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
  // VG, 7-11 noche: se añade Be («todos»: sin tope) y el tope es el máximo del modo, el mismo para leer y para emitir.
  assert.deepEqual(Object.keys(MODOS), ['pointed', 'sequenced', 'mapped', 'scened', 'be']);
  assert.deepEqual(Object.keys(MODOS).map(tope), [10, 100, 1000, 10000, Infinity]);
  for (const m of Object.keys(MODOS)) assert.equal(tope(m), lectura(m)); // no se emite más de lo que se lee
  const de = (n) => Array.from({ length: n }, (_, x) => 'x' + x);
  assert.equal(cabeTope(de(10), 'pointed'), true);
  assert.equal(cabeTope([de(10), 'y'], 'pointed'), false);
  const diezMil = Array(10).fill(Array(10).fill(Array(10).fill(Array(10).fill('z'))));
  assert.equal(cabeTope(diezMil, 'scened'), true);
  assert.equal(cabeTope([diezMil, 'y'], 'scened'), false);
  // El tope cuenta lo emitido, como la escritura: las heredadas que se le digan no cuentan.
  const conRelleno = [ref('foco', '0000000000'), de(10)];
  assert.equal(contarPosiciones(conRelleno), 11);
  assert.equal(cabeTope(conRelleno, 'pointed'), false);
  assert.equal(cabeTope(conRelleno, 'pointed', [0]), true);
  assert.throws(() => cabeTope(conRelleno, 'pointed', 1), /heredadas es una lista/);
  // La proporción cuenta todas las posiciones del registro, lo heredado incluido.
  assert.equal(cabeEscritura(conRelleno, 'sequenced'), true);
  assert.deepEqual(proporcion(conRelleno, 'sequenced'), { posiciones: 11, rango: [10, 20], estado: 'dentro' });
  assert.throws(() => tope('otro'), /modo desconocido: otro/);
});

test('la matriz de 1000: el tope de Mapped la admite, la proporción no ([X] decidir VG)', async () => {
  // Escribir mil posiciones cuesta mil minutos: un eje propio cuyo génesis los emite.
  const eje = await ejeGrande(3000);
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
  // La proporción (de 250 a 333 en Mapped) rechaza, como antes del 7-11: con las dos, la matriz entera no cabe en Mapped.
  assert.equal(cabeEscritura(payload, 'mapped'), false);
  assert.deepEqual(proporcion(payload, 'mapped'), { posiciones: 1000, rango: [250, 333], estado: 'por encima' });
  assert.deepEqual(proporcion(['a'], 'pointed'), { posiciones: 1, rango: [1, 1], estado: 'dentro' });
  assert.deepEqual(proporcion(['a'], 'scened'), { posiciones: 1, rango: null, estado: 'sin fijar' });
  assert.deepEqual(proporcionDe(5, 'sequenced'), { posiciones: 5, rango: [10, 20], estado: 'por debajo' });
  await assert.rejects(
    escribirSalida(eje, { modo: 'mapped', autor: 'casa', sobre: foco, salida, t: T }),
    /^Error: mapped escribe como mucho 333 posiciones; esta salida tiene 1000$/,
  );
  // La proporción se mira primero: aunque también se pase el tope, el mensaje es el de siempre.
  await assert.rejects(
    escribirDesde(eje, { modo: 'sequenced', autor: 'casa', sobre: foco, payload, t: T }),
    /^Error: sequenced escribe como mucho 20 posiciones; este registro tiene 1000$/,
  );
  await assert.rejects(
    escribirDesde(eje, { modo: 'mapped', autor: 'casa', sobre: foco, payload: [...payload.slice(0, 9), [payload[9], 'una más']], t: T }),
    /^Error: mapped escribe como mucho 333 posiciones; este registro tiene 1001$/,
  );
  assert.equal(eje.sobre(foco).length, 0); // nada se escribió
  // Scened no tiene proporción: la matriz entera se escribe.
  const r = await escribirSalida(eje, { modo: 'scened', autor: 'casa', sobre: foco, salida, t: T });
  assert.equal(r.registro.movimientos[0].cantidad, 1000);
  assert.deepEqual(r.proporcion, { posiciones: 1000, rango: null, estado: 'sin fijar' });
});

test('lo lejano sin base en el foco se ancla en su posición en vez de rechazarse', async () => {
  const { eje, compra } = await ejemploCompra();
  // La compra desarrolla las posiciones 0–4: la 7 queda lejos (sin 5 ni 6 que heredar).
  assert.deepEqual(ubicar(eje, compra.id, [7, 0, 0]), { ubicacion: 'anclado', en: '7000000000', dir: '7000000000', faltan: ['5', '6'] });
  assert.deepEqual(ubicar(eje, compra.id, [2, 0, 0]), { ubicacion: 'dentro', en: '0000000000', dir: '2000000000', faltan: [] });
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
  // Si escribirSalida falla al escribir (aquí, un autor sin T), el aviso sigue: el payload solo aún no se puede escribir.
  await assert.rejects(escribirSalida(eje, { modo: 'mapped', autor: 'nadie', sobre: compra.id, salida, t: T }), /evento rechazado/);
  assert.equal(eje.sobre(compra.id).length, 0);
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
  assert.deepEqual(p, { posiciones: 4, rango: [250, 333], estado: 'por debajo' }); // la proporción cuenta todas las posiciones de la salida
  // Lo anclado es un ocupante escrito de la posición lejana.
  assert.deepEqual(ocupantes(eje, compra.id, [7]).map((o) => o.evento), [anclados[0].id]);
  // Con la salida entera escrita, el aviso se retira.
  const otraVez = await escribirDesde(eje, { modo: 'mapped', autor: 'huesped', sobre: compra.id, payload: salida.payload, t: T });
  assert.deepEqual(otraVez.payload, salida.payload);

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

test('los límites cuentan la salida entera: registro y anclados', async () => {
  const { eje, compra } = await ejemploCompra();
  const lineas = [];
  lineas[1] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
  lineas[7] = ['lejos'];
  const salida = desdeMapped(eje, lineas, compra.id);
  assert.equal(contarPosiciones(salida.payload), 11); // diez escritas y la 0 heredada
  // Pointed: la proporción, que se mira primero, cuenta todas las posiciones de la salida (once dentro, la heredada incluida, y una anclada);
  // el tope contaría lo emitido (diez dentro y una anclada).
  await assert.rejects(
    escribirSalida(eje, { modo: 'pointed', autor: 'huesped', sobre: compra.id, salida, t: T }),
    /^Error: pointed escribe como mucho 1 posiciones; esta salida tiene 12$/,
  );
  // Proporción: todas las posiciones (doce, con la heredada) superan las 20 de Sequenced solo si son más.
  const veinte = [];
  veinte[1] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
  veinte[2] = ['k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't'];
  veinte[8] = ['lejos'];
  const grande = desdeMapped(eje, veinte, compra.id);
  await assert.rejects(
    escribirSalida(eje, { modo: 'sequenced', autor: 'huesped', sobre: compra.id, salida: grande, t: T }),
    /^Error: sequenced escribe como mucho 20 posiciones; esta salida tiene 22$/,
  );
  assert.equal(eje.sobre(compra.id).length, 0); // nada se escribió
  const ok = await escribirSalida(eje, { modo: 'sequenced', autor: 'huesped', sobre: compra.id, salida, t: T });
  assert.deepEqual(ok.proporcion, { posiciones: 12, rango: [10, 20], estado: 'dentro' });
  // Una salida que no es de este foco no pasa: sus heredadas no son referencias a él.
  const otra = await eje.escribir({ autor: 'huesped', sobre: compra.id, t: T, movimientos: [gastaT('huesped')], payload: ['otra', 'cosa', 'más'] });
  const ajena = desdeMapped(eje, [{ i: 2, j: 0, k: 0, contenido: 'x' }], otra.id);
  await assert.rejects(escribirSalida(eje, { autor: 'huesped', sobre: compra.id, salida: ajena, t: T }), /la heredada 0 no es una referencia al foco/);
});

test('líneas de Mapped: sin marca, texto como antes; con «@:j.k», la celda', async () => {
  const { eje, compra } = await ejemploCompra();
  // Una línea que empieza por «d.d » es texto: el sentido de siempre.
  const kilo = [];
  kilo[1] = ['1.5 kg de harina'];
  assert.deepEqual(desdeMapped(eje, kilo, compra.id).payload, [ref(compra.id, '0000000000'), '1.5 kg de harina']);
  const horas = [];
  horas[0] = ['2.5 horas de cocina'];
  assert.deepEqual(desdeMapped(eje, horas, compra.id).payload, ['2.5 horas de cocina']);
  const lineas = [];
  lineas[4] = ['pagado', '0.1 con tarjeta', 'servido'];
  const llano = desdeMapped(eje, lineas, compra.id);
  assert.deepEqual(llano.payload[4], [['pagado'], '0.1 con tarjeta', 'servido']); // por hojas: la salida es una décupla, su 0 va envuelto
  assert.deepEqual(llano.heredadas, [0, 1, 2, 3]);
  // Con la marca «@:j.k» (propuesta, [X] decidir VG), la línea fija subposición y clase; las demás van a las subposiciones libres con clase 0.
  const marcadas = [];
  marcadas[4] = ['pagado', '@:0.1 con tarjeta', 'servido'];
  const conMarca = desdeMapped(eje, marcadas, compra.id);
  // VG, 7-11 noche: por hojas. La 4 de la compra, ['pagar', 'servir'], es una lista: no tiene subposiciones que
  // heredar, así que cada celda se ancla en su dirección y no queda nada dentro.
  assert.equal(conMarca.payload, null);
  assert.deepEqual(conMarca.anclados, [
    { celda: [4, 0, 1], en: '4010000000', payload: 'con tarjeta', faltan: ['4.0.0'] },
    { celda: [4, 1, 0], en: '4100000000', payload: 'pagado', faltan: ['4.0'] },
    { celda: [4, 2, 0], en: '4200000000', payload: 'servido', faltan: ['4.0', '4.1'] },
  ]);
  const pagar = [];
  pagar[1] = ['@:2.4 pagar 12 EUR'];
  assert.deepEqual(desdeMapped(eje, pagar, compra.id).anclados, desdeMapped(eje, [{ i: 1, j: 2, k: 4, contenido: 'pagar 12 EUR' }], compra.id).anclados);
  // Sin texto y con clase 0, la marca es ver.
  const ver = [];
  ver[1] = ['@:2.0'];
  assert.deepEqual(desdeMapped(eje, ver, compra.id).vistas, ['1.2']);
  const sinTexto = [];
  sinTexto[1] = ['@:2.4'];
  assert.throws(() => desdeMapped(eje, sinTexto, compra.id), /falta el contenido de 1\.2\.4/);
  // Una línea que empieza por «@:» sin la forma exacta es texto, como antes de la matriz ([X] decidir VG:
  // una línea con la forma exacta, «@:1.2 algo», no tiene escape para escribirse como texto).
  for (const texto of ['@:) gracias', '@:1.2x', '@:12 x', '@:a.b c', '@:']) {
    const l = [];
    l[2] = [texto];
    assert.deepEqual(desdeMapped(eje, l, compra.id).payload[2], texto);
  }
  const mezcla = [];
  mezcla[2] = ['@:) gracias', '@:0.1 con tarjeta'];
  assert.deepEqual(desdeMapped(eje, mezcla, compra.id).anclados.map((a) => a.celda), [[2, 0, 1], [2, 1, 0]]); // la 2 es una lista de uno: sin 2.0 que heredar
  const repetida = [];
  repetida[2] = ['@:0.0 uno', '@:0.0 dos'];
  assert.throws(() => desdeMapped(eje, repetida, compra.id), /la celda 2\.0\.0 está dos veces/);
  const sinMarca = [];
  sinMarca[2] = ['0.0 uno', '0.0 dos'];
  assert.deepEqual(desdeMapped(eje, sinMarca, compra.id).payload[2], [['0.0 uno'], '0.0 dos']);
  // Una referencia sigue siendo una referencia: «@» seguido del id.
  const conRef = [];
  conRef[2] = ['@' + compra.id.slice(0, 8)];
  assert.deepEqual(desdeMapped(eje, conRef, compra.id).payload[2], { ref: compra.id });
  assert.throws(() => desdeMapped(eje, [{ i: 1, j: 2, k: 4 }], compra.id), /falta el contenido de 1\.2\.4/);
  assert.throws(() => desdeMapped(eje, [{ i: 1, j: 10, k: 0, contenido: 'x' }], compra.id), /fuera de la matriz/);
  assert.throws(() => desdeMapped(eje, [['a'], { i: 1, j: 0, k: 0, contenido: 'x' }], compra.id), /mezcla/);
  const once = [];
  once[3] = Array.from({ length: 11 }, (_, x) => 'x' + x);
  assert.throws(() => desdeMapped(eje, once, compra.id), /más de 10 subposiciones/);
});

test('el motor no guarda clase; el encaje dice de dónde vino cada elección y los terminales nuevos van aparte', async () => {
  const { eje, compra } = await ejemploCompra();
  const c = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: T, elecciones: { 1: ref(compra.id, '1200000000'), 2: ['dos', 'menús'], 4: 'pagar' } });
  // Solo las fuentes llevan encaje, con su evento, origen y vector.
  assert.deepEqual(c.contexto.encaje.map((e) => e.posicion), [1]);
  assert.equal(c.contexto.encaje[0].evento, compra.id);
  assert.equal(c.contexto.encaje[0].origen, '1200000000');
  assert.ok(Array.isArray(c.contexto.encaje[0].vector));
  assert.equal(c.contexto.encaje[0].clase, undefined);
  // Los terminales nuevos, aparte: dónde va cada uno.
  assert.deepEqual(c.contexto.nuevos, [{ posicion: 2, destino: '2000000000' }, { posicion: 4, destino: '4000000000' }]);
  // La clase se lee al leer, desde el camino de la consolidación: sin camino, la elección i es la celda i.0.0.
  assert.equal(claseDe(c.contexto.encaje[0].destino, []), 0);
  assert.deepEqual(c.contexto.nuevos.map((n) => claseDe(n.destino, [])), [0, 0]);
  // Bajo el camino [1, 2], la elección 4 va en 1.2.4. La matriz es relativa al camino: desde [1, 2] es la celda 4.0.0,
  // de clase 0 (ver/sustituir); el tercer dígito absoluto (4) es su clase solo vista desde la raíz, como celda 1.2.4.
  // [X] decidir VG: si la clase de una elección es la de su destino o la 4 de la fábrica donde se ancla.
  const ficha = await escribirFicha(eje);
  const bajo = await consolidar(eje, { autor: 'huesped', foco: ficha.id, t: T, camino: [1, 2], elecciones: { 4: 'pagar 12 EUR' } });
  assert.deepEqual(bajo.contexto.encaje, []);
  assert.deepEqual(bajo.contexto.nuevos, [{ posicion: 4, destino: '1240000000' }]);
  assert.equal(claseDe(bajo.contexto.nuevos[0].destino, [1, 2]), 0);
  assert.equal(claseDe(bajo.contexto.nuevos[0].destino), 4);
  for (const camino of [[], [1], [1, 2]]) {
    const k = await consolidar(eje, { autor: 'huesped', foco: ficha.id, t: T, camino, elecciones: { 1: 'uno' } });
    assert.equal(k.en, direccion([...camino, 4]));
    assert.deepEqual(k.contexto.nuevos, [{ posicion: 1, destino: direccion([...camino, 1]) }]);
    assert.equal(claseDe(k.contexto.nuevos[0].destino, camino), 0);
  }
  await autorizar(eje, { autorizante: 'casa', consolidacion: c.id, t: T });
  const e = await ejecutar(eje, { autor: 'huesped', consolidacion: c.id, t: T });
  assert.equal(e.contexto.clase, undefined);
  assert.equal(e.en, FABRICA);
  assert.equal(claseDe(e.en, []), 0); // [X] decidir VG: la ejecución es acción, pero FABRICA, sin camino, es la celda 4.0.0
});

/** Lo que hay en la celda [i, j, k] de un registro: un terminal compactado ocupa también sus ceros finales (colisión). */
const enCelda = (payload, indices) => indices.reduce((n, x) => (Array.isArray(n) ? n[x] : x === 0 ? n : undefined), payload);

test('la matriz es relativa al camino: celda, dirección y clase coinciden en toda la cadena (caminos [], [1] y [1, 2])', async () => {
  // Lo que encontró la revisión: con camino [1], la celda 0.1.0 (clase 0) cae en 1010000000, y su clase bajo [1] es 0, no la 1 del tercer dígito.
  const base = await ejemploCompra();
  assert.equal(ubicar(base.eje, base.compra.id, [0, 1, 0], { camino: [1] }).dir, '1010000000');
  assert.equal(claseDe('1010000000', [1]), 0);
  const u734 = ubicar(base.eje, base.compra.id, [7, 3, 4], { camino: [1] });
  assert.equal(u734.dir, '1734000000');
  assert.equal(claseDe(u734.dir, [1]), 4);
  const p = await escribirDesde(base.eje, { modo: 'mapped', autor: 'huesped', sobre: base.compra.id, celda: [0, 1, 0], camino: [1], payload: 'x', t: T });
  assert.equal(claseDe(p.en, [1]), 0);
  // La cadena entera, sobre la compra y sobre la ficha (que desarrolla el precio), con mucho T.
  const eje = await ejeGrande(100000);
  const compra = await eje.escribir({ autor: 'casa', sobre: eje.genesisId, t: T, movimientos: [gastaT('casa')], payload: base.compra.payload });
  const ficha = await eje.escribir({ autor: 'casa', sobre: eje.genesisId, t: T, movimientos: [gastaT('casa')], payload: ['Ficha', ['menú', 1, [['EUR 12'], 'de huesped', 'precio fijo', 'aviso a cocina']]] }); // VG, 7-11 noche: por hojas (como escribirFicha)
  const celdas = [[0, 0, 0], [0, 1, 0], [1, 0, 1], [2, 0, 4], [3, 0, 0], [3, 2, 1], [7, 3, 4], [9, 9, 9]];
  const vistos = { dentro: 0, anclado: 0 };
  let n = 0;
  const tn = () => new Date(Date.parse(T) + ++n * 1000).toISOString(); // cada registro, su instante: si no, el mismo id
  for (const foco of [compra, ficha]) {
    for (const camino of [[], [1], [1, 2]]) {
      for (const celda of celdas) {
        const k = celda[2];
        const dir = direccion([...camino, ...celda]);
        // ubicar: la celda cae en direccion([...camino, i, j, k]) y su clase, desde el camino, es k.
        for (const modo of [undefined, 'mapped', 'pointed']) {
          const u = ubicar(eje, foco.id, celda, { camino, modo });
          assert.equal(u.dir, dir);
          assert.equal(claseDe(u.dir, camino), k);
          assert.equal(u.en, u.ubicacion === 'dentro' ? direccion(camino) : dir);
        }
        // escribirDesde con celda y camino: el registro va donde dice ubicar y la celda cae en su dirección.
        const u = ubicar(eje, foco.id, celda, { camino, modo: 'mapped' });
        vistos[u.ubicacion]++;
        const ev = await escribirDesde(eje, { modo: 'mapped', autor: 'casa', sobre: foco.id, celda, camino, payload: 'x', t: tn() });
        assert.equal(ev.en, u.en);
        if (u.ubicacion === 'dentro') assert.equal(enCelda(ev.payload, celda), 'x');
        else assert.equal(ev.payload, 'x');
        // desdeMapped + escribirSalida: lo mismo, con la celda como entrada (y como línea marcada «@:j.k»).
        const lineas = [];
        lineas[celda[0]] = ['@:' + celda[1] + '.' + k + ' y'];
        const salida = desdeMapped(eje, lineas, foco.id, camino);
        assert.deepEqual(salida, desdeMapped(eje, [{ i: celda[0], j: celda[1], k, contenido: 'y' }], foco.id, camino));
        const r = await escribirSalida(eje, { autor: 'casa', sobre: foco.id, salida, t: tn() });
        if (r.registro) {
          assert.equal(r.registro.en, direccion(camino));
          assert.equal(enCelda(r.registro.payload, celda), 'y');
          for (const h of r.registro.contexto.heredadas ?? []) assert.notEqual(resolver(foco.payload, en(r.registro.payload, h).dir), undefined);
        } else {
          assert.equal(r.anclados[0].en, dir);
          assert.equal(claseDe(r.anclados[0].en, camino), k);
        }
      }
    }
  }
  assert.ok(vistos.dentro > 0 && vistos.anclado > 0, JSON.stringify(vistos));
});
