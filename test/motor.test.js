import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejemploCompra, ejemploCuenta } from '../ejemplos/ikisai/compra-food.mjs';
import { descubrir, consolidar, autorizar, ejecutar, estadoDe, consolidaciones, FABRICA, capacidadDe, tramoDe, ocupacion, registrosEn, CRITERIO_CAPACIDAD } from '../src/motor.js';
import { evaluar } from '../src/bql.js';
import { Eje } from '../src/eje.js';

const T = '2026-11-07T16:00:00Z';

test('descubrir: candidatos por posición de interacción, con fórmulas resueltas', async () => {
  const { eje, compra } = await ejemploCompra();
  const cuenta = await ejemploCuenta(eje, compra);
  const d = descubrir(eje, compra.id);
  assert.deepEqual(d.map((x) => x.posicion), [1, 2, 3, 4]);
  const p1 = d[0];
  assert.deepEqual(p1.candidatos.map((c) => c.origen), ['propio', 'propio', 'referencia', 'escrito']);
  assert.equal(p1.candidatos[3].evento, cuenta.id);
  assert.equal(p1.candidatos[3].etiqueta, 'Cuenta del menú'); // la etiqueta es su PV0; el estado, el del camino exacto
  assert.equal(d[3].candidatos.length, 2); // [4] y [4.0] colisionan
});

test('ciclo completo: consolidar → PENDIENTE DE AUTORIZACIÓN → autorizar → ejecutar con evidencia', async () => {
  const { eje, compra, menu } = await ejemploCompra();
  const cuenta = await ejemploCuenta(eje, compra);
  const d = descubrir(eje, compra.id);
  const c = await consolidar(eje, {
    autor: 'huesped', foco: compra.id, t: T, titulo: 'Pago del menú',
    elecciones: { 1: { candidato: d[0].candidatos[3] }, 2: 'sin lactosa', 4: 'pagar 14 EUR' },
  });
  assert.equal(c.en, FABRICA);
  assert.equal(c.contexto.fase, 'consolidado');
  assert.deepEqual(c.contexto.fuentes, [cuenta.id]);
  assert.equal(c.payload[0], 'Pago del menú');
  assert.deepEqual(c.payload[1], { ref: cuenta.id, dir: '0000000000' });
  assert.equal(c.payload[2], 'sin lactosa');
  assert.deepEqual(c.payload[3], { ref: compra.id, dir: '3000000000' }); // hueco heredado del foco
  assert.equal(c.payload[4], 'pagar 14 EUR');
  assert.equal(estadoDe(eje, c.id), 'PENDIENTE DE AUTORIZACIÓN');
  assert.equal(consolidaciones(eje, compra.id)[0].estado, 'PENDIENTE DE AUTORIZACIÓN');

  // Ejecutar sin autorización se rechaza.
  await assert.rejects(ejecutar(eje, { autor: 'huesped', consolidacion: c.id, t: T }), /PENDIENTE DE AUTORIZACIÓN/);

  const a = await autorizar(eje, { autorizante: 'casa', consolidacion: c.id, t: T });
  assert.equal(a.payload, '==autorizo');
  assert.equal(estadoDe(eje, c.id), 'AUTORIZADO');
  await assert.rejects(autorizar(eje, { autorizante: 'casa', consolidacion: c.id, t: T }), /ya está autorizado/);

  const antesCocina = eje.saldo('cocina', 'E:casa/EUR');
  const e = await ejecutar(eje, {
    autor: 'huesped', consolidacion: c.id, t: T,
    movimientos: [{ token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 14, de: 'huesped', a: 'cocina' }],
  });
  assert.equal(estadoDe(eje, c.id), 'EJECUTADO');
  assert.equal(eje.saldo('cocina', 'E:casa/EUR'), antesCocina + 14);
  assert.deepEqual(e.contexto.evidencia, [c.id, a.id]);
  assert.deepEqual(e.payload[1], { ref: c.id });
  // La evidencia es el hilo: ejecución → consolidación → compra → menú → …
  assert.deepEqual(eje.hilo(e.id).slice(0, 3).map((x) => x.id), [e.id, c.id, compra.id]);
  await assert.rejects(ejecutar(eje, { autor: 'huesped', consolidacion: c.id, t: T }), /ya ejecutado/);
  void menu;
});

test('autoriza quien tiene poder y no es el autor; ejecuta el autor; lo demás no cuenta', async () => {
  const { eje, compra } = await ejemploCompra();
  const c = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: T, elecciones: { 1: 'dos menús' } });
  await assert.rejects(autorizar(eje, { autorizante: 'huesped', consolidacion: c.id, t: T }), /no se autoriza a sí mismo/);
  await assert.rejects(autorizar(eje, { autorizante: 'cocina', consolidacion: c.id, t: T }), /no tiene poder/);
  // Un «autorizado» escrito a mano por quien no puede no cambia el estado.
  await eje.escribir({ autor: 'cocina', sobre: c.id, en: FABRICA, t: T, movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'cocina', a: null }], payload: '==autorizo', contexto: { fase: 'autorizado' } });
  assert.equal(estadoDe(eje, c.id), 'PENDIENTE DE AUTORIZACIÓN');
  await autorizar(eje, { autorizante: 'casa', consolidacion: c.id, t: T });
  assert.equal(estadoDe(eje, c.id), 'AUTORIZADO');
  await assert.rejects(ejecutar(eje, { autor: 'casa', consolidacion: c.id, t: T }), /ejecuta el autor/);
  // Un «ejecutado» escrito por otro no cuenta.
  await eje.escribir({ autor: 'cocina', sobre: c.id, en: FABRICA, t: T, movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'cocina', a: null }], payload: 'falso', contexto: { fase: 'ejecutado' } });
  assert.equal(estadoDe(eje, c.id), 'AUTORIZADO');
  await ejecutar(eje, { autor: 'huesped', consolidacion: c.id, t: T });
  assert.equal(estadoDe(eje, c.id), 'EJECUTADO');
});

test('consolidar rechaza huecos no heredables y no consolida nada vacío', async () => {
  const { eje, compra } = await ejemploCompra();
  await assert.rejects(consolidar(eje, { autor: 'casa', foco: compra.id, t: T, elecciones: {} }), /nada que consolidar/);
  await assert.rejects(consolidar(eje, { autor: 'casa', foco: compra.id, t: T, elecciones: { 7: 'más tarde' } }), /hueco en 5/);
  await assert.rejects(consolidar(eje, { autor: 'casa', foco: compra.id, t: T, elecciones: { 0: 'x' } }), /1–9/);
});

test('consolidar no ejecuta: no mueve E, solo el T de escribir', async () => {
  const { eje, compra } = await ejemploCompra();
  const antes = eje.saldo('huesped', 'E:casa/EUR');
  const c = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: T, elecciones: { 1: 'dos menús' } });
  assert.equal(eje.saldo('huesped', 'E:casa/EUR'), antes);
  assert.equal(c.movimientos.length, 1);
  assert.equal(c.movimientos[0].token, 'T');
  assert.equal(evaluar(eje, c.id, [1]).texto, 'dos menús');
});

test('capacidad: una posición declara cuántos ocupantes pueden ser válidos a la vez; el contador solo informa y la fábrica no lo consulta', async () => {
  // La declaración: un entero positivo en el criterio (2) de la décupla de la posición.
  assert.equal(CRITERIO_CAPACIDAD, 2);
  assert.equal(capacidadDe(['sitio', 'precio', 3]), 3);
  for (const nodo of ['sitio', ['sitio', 'precio'], ['sitio', 'precio', '3'], ['sitio', 'precio', 0], ['sitio', 'precio', 1.5], ['sitio', 'precio', ['x']]]) assert.equal(capacidadDe(nodo), undefined);

  // Un elemento neutro: su posición 1 declara capacidad 1; su posición 2 no declara nada.
  const t = '2026-12-01T09:00:00Z';
  const gasta = (de, cantidad = 1) => ({ token: 'T', escala: 'minuto', cantidad, de, a: null });
  const eje = await Eje.genesis({ identidad: 'g', tipo: 'grupo', emision: [{ token: 'T', escala: 'minuto', cantidad: 900 }, { token: 'P', cantidad: 5, ambito: 'genesis' }], foco: 'raíz', t });
  const dar = ['ana', 'beto', 'carla'].map((a) => ({ token: 'T', escala: 'minuto', cantidad: 100, de: 'g', a }));
  await eje.escribir({ autor: 'g', sobre: eje.genesisId, t, movimientos: [gasta('g'), ...dar], payload: 'altas', contexto: { tipos: { ana: 'persona', beto: 'persona', carla: 'persona' } } });
  const elemento = await eje.escribir({ autor: 'g', sobre: eje.genesisId, t, movimientos: [gasta('g')], payload: ['elemento', ['sitio', 'precio', 1], ['otro sitio', 'precio']] });
  let minuto = 10;
  /** Un ocupante: el registro y, si se da, su tramo anclado en su 7 por quien lo escribe («lo lejano = anclaje»). */
  const ocupar = async (autor, { en = '1000000000', tramo, payload = 'ocupo', sobre = elemento.id } = {}) => {
    const tt = '2026-12-01T10:' + minuto++ + ':00Z';
    const r = await eje.escribir({ autor, sobre, en, t: tt, movimientos: [gasta(autor)], payload });
    if (tramo) await eje.escribir({ autor, sobre: r.id, en: '7000000000', t: tt, movimientos: [gasta(autor, 2)], payload: tramo });
    return r;
  };
  const validar = async (r) => {
    const c = await consolidar(eje, { autor: r.autor, foco: r.id, t, elecciones: { 1: 'lo ocupo' } });
    await autorizar(eje, { autorizante: 'g', consolidacion: c.id, t });
    await ejecutar(eje, { autor: r.autor, consolidacion: c.id, t });
    return estadoDe(eje, c.id);
  };

  // El tramo: el 7 como colisión, [inicio, fin) en ISO. Vale lo propio o lo que el autor ancle en su 7; lo de otro, no.
  const propio = await ocupar('ana', { en: '2000000000', payload: ['r', 'a', 'b', 'c', 'd', 'e', 'f', ['2026-12-01', '2026-12-03']] });
  assert.deepEqual(tramoDe(eje, propio.id), { inicio: Date.parse('2026-12-01'), fin: Date.parse('2026-12-03'), extremos: ['2026-12-01', '2026-12-03'], texto: '2026-12-01 – 2026-12-03', desde: propio.id });
  const anclado = await ocupar('ana', { en: '2000000000', tramo: ['2026-12-05', '2026-12-06'] });
  assert.deepEqual(tramoDe(eje, anclado.id).extremos, ['2026-12-05', '2026-12-06']);
  assert.equal(tramoDe(eje, anclado.id).desde, eje.sobre(anclado.id, '7000000000')[0].id);
  const deOtro = await ocupar('ana', { en: '2000000000' });
  await eje.escribir({ autor: 'beto', sobre: deOtro.id, en: '7000000000', t, movimientos: [gasta('beto', 2)], payload: ['2026-12-01', '2026-12-09'] });
  assert.throws(() => tramoDe(eje, deOtro.id), /sin tramo en el 7/);
  // Acotado y legible: sin 7, al revés o sin fechas, error.
  const [sinSiete, alReves, sinFechas] = [await ocupar('ana', { en: '2000000000' }), await ocupar('ana', { en: '2000000000', tramo: ['2026-12-03', '2026-12-01'] }), await ocupar('ana', { en: '2000000000', tramo: 'mañana' })];
  assert.throws(() => tramoDe(eje, sinSiete.id), /sin tramo en el 7/);
  assert.throws(() => tramoDe(eje, alReves.id), /tramo ilegible/);
  assert.throws(() => tramoDe(eje, sinFechas.id), /tramo ilegible/);

  // Dos ocupantes solapados en la posición con capacidad 1: el contador dice que no cabría, pero la fábrica
  // no lo consulta (el límite es una serie de tokens que la ejecución mueve, como en Booking) y ejecuta los dos.
  const primero = await ocupar('ana', { tramo: ['2026-12-01', '2026-12-03'] });
  assert.equal(await validar(primero), 'EJECUTADO');
  const segundo = await ocupar('beto', { tramo: ['2026-12-02', '2026-12-04'] });
  assert.deepEqual(ocupacion(eje, segundo.id).map((o) => [o.camino, o.capacidad, o.aLaVez, o.cabe]), [[[1], 1, 1, false]]);
  assert.equal(await validar(segundo), 'EJECUTADO');
  // Con capacidad, el tramo es obligatorio para contar.
  const sinTramo = await ocupar('carla');
  assert.throws(() => ocupacion(eje, sinTramo.id), /sin tramo en el 7/);
  // Cuenta también lo que referencia la posición desde otro anclaje (aquí, sobre el génesis).
  const fuera = await ocupar('carla', { sobre: eje.genesisId, en: '0000000000', payload: ['fuera', { ref: elemento.id, dir: '1000000000' }], tramo: ['2026-12-10', '2026-12-12'] });
  assert.equal(await validar(fuera), 'EJECUTADO');
  assert.ok(registrosEn(eje, elemento.id, '1000000000').some((r) => r.id === fuera.id));
  const tercero = await ocupar('beto', { tramo: ['2026-12-11', '2026-12-13'] });
  assert.deepEqual(ocupacion(eje, tercero.id)[0].validos.map((v) => [v.id, v.anclado]), [[fuera.id, false]]);
  // Donde no hay capacidad declarada, no hay nada que contar.
  assert.deepEqual(ocupacion(eje, propio.id), []);
});
