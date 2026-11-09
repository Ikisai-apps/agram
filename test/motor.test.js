import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejemploCompra, ejemploCuenta } from '../ejemplos/ikisai/compra-food.mjs';
import { descubrir, consolidar, registrar, cerrado, siguiente, propuestas, FABRICA, ANUNCIO, capacidadDe, tramoDe, ocupacion, registrosEn, CRITERIO_CAPACIDAD } from '../src/motor.js';
import { evaluar } from '../src/bql.js';
import { Eje } from '../src/eje.js';
import { entrarPorInvitacion } from '../ejemplos/ikisai/altas.mjs';

const minuto = (de, cantidad = 1) => ({ token: 'T', escala: 'minuto', cantidad, de, a: null });
/** Un movimiento anunciado en el 4.1 de X por su dueño: [[serie], [cuánto], [qué], [[de], [a]]] (motor.ANUNCIO). */
const anuncio = (serie, cantidad, que, de, a) => [[serie], [cantidad], [que], [[de], [a]]];

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

// VG, 8-11 (mapa §15 [D] «Una sola operación: registrar»): «tú vas planteando cosas y registras y ejecutas». Se retira
// el guion consolidar → autorizar → ejecutar: consolidar es registrar una propuesta en la fábrica, cada parte registra su
// propio movimiento y «cerrado» es una lectura (la plantilla de cerrado del dueño, por defecto la de la época).
test('ciclo: consolidar registra la propuesta; cada parte registra su movimiento; cerrado y siguiente son lecturas', async () => {
  const { eje, compra } = await ejemploCompra();
  const cuenta = await ejemploCuenta(eje, compra);
  const d = descubrir(eje, compra.id);
  const c = await consolidar(eje, {
    autor: 'huesped', foco: compra.id, t: T, titulo: 'Pago del menú',
    elecciones: { 1: { candidato: d[0].candidatos[3] }, 2: 'sin lactosa', 4: 'pagar 14 EUR' },
  });
  assert.equal(c.en, FABRICA);
  assert.equal(c.contexto.fase, undefined); // la fábrica no tiene fases fijas
  assert.equal(c.contexto.motor, 'fabrica');
  assert.deepEqual(c.contexto.fuentes, [cuenta.id]);
  assert.equal(c.payload[0], 'Pago del menú');
  assert.deepEqual(c.payload[1], { ref: cuenta.id, dir: '0000000000' });
  assert.equal(c.payload[2], 'sin lactosa');
  assert.deepEqual(c.payload[3], { ref: compra.id, dir: '3000000000' }); // hueco heredado del foco
  assert.equal(c.payload[4], 'pagar 14 EUR');
  // Sin nada anunciado, no le falta nada: cerrada.
  assert.equal(cerrado(eje, c.id).cerrado, true);
  assert.deepEqual(propuestas(eje, compra.id).map((x) => [x.id, x.cerrado]), [[c.id, true]]);

  // La huésped anuncia en el 4.1 de su propuesta lo que va a mover: abierta hasta que pase.
  await registrar(eje, { autor: 'huesped', sobre: c.id, en: ANUNCIO, t: T, movimientos: [minuto('huesped')], payload: anuncio('E:casa/EUR', 14, 'pagar', 'huesped', 'cocina') });
  assert.equal(cerrado(eje, c.id).cerrado, false);
  assert.equal(cerrado(eje, c.id).plantilla, 'all announced movements happened');
  const deCocina = siguiente(eje, c.id, 'cocina');
  assert.deepEqual([deCocina.faltaDeMi.length, deCocina.espera.map((x) => x.de)], [0, ['huesped']]);
  const deHuesped = siguiente(eje, c.id, 'huesped');
  assert.equal(deHuesped.faltaDeMi.length, 1);
  const tx = deHuesped.faltaDeMi[0].transaccion;
  assert.deepEqual(tx.movimientos[1], { token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 14, de: 'huesped', a: 'cocina' });

  const antesCocina = eje.saldo('cocina', 'E:casa/EUR');
  const pago = await registrar(eje, { ...tx, t: T });
  assert.equal(eje.saldo('cocina', 'E:casa/EUR'), antesCocina + 14);
  assert.equal(cerrado(eje, c.id).cerrado, true);
  assert.deepEqual(siguiente(eje, c.id, 'huesped'), { cerrado: true, faltaDeMi: [], espera: [] });
  // La cadena es el hilo: pago → propuesta → compra → menú → …
  assert.deepEqual(eje.hilo(pago.id).slice(0, 3).map((x) => x.id), [pago.id, c.id, compra.id]);
});

// VG, 8-11 (mapa §15 [D]): «el consentimiento no necesita paso de autorizar, porque cada uno solo mueve lo suyo». Lo que
// no cuenta: lo ajeno (la regla «nobody moves tokens of others»), lo que anuncia quien no es el dueño y las «fases»
// escritas a mano.
test('nadie autoriza lo ajeno: cada uno mueve lo suyo; ni las fases a mano ni lo que anuncia otro cambian la lectura', async () => {
  const { eje, compra } = await ejemploCompra();
  const c = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: T, elecciones: { 1: 'dos menús' } });
  await registrar(eje, { autor: 'huesped', sobre: c.id, en: ANUNCIO, t: T, movimientos: [minuto('huesped')], payload: anuncio('E:casa/EUR', 12, 'pagar', 'huesped', 'cocina') });
  // La cocina no puede pagar por la huésped.
  await assert.rejects(
    registrar(eje, { autor: 'cocina', sobre: c.id, t: T, movimientos: [minuto('cocina'), { token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 12, de: 'huesped', a: 'cocina' }], payload: 'cobro' }),
    /nobody moves tokens of others/,
  );
  // Un «autorizado» o un «ejecutado» escrito a mano no son nada: la lectura sigue abierta.
  await eje.escribir({ autor: 'cocina', sobre: c.id, en: FABRICA, t: T, movimientos: [minuto('cocina')], payload: '==autorizo', contexto: { fase: 'autorizado' } });
  await eje.escribir({ autor: 'cocina', sobre: c.id, en: FABRICA, t: T, movimientos: [minuto('cocina')], payload: 'falso', contexto: { fase: 'ejecutado' } });
  assert.equal(cerrado(eje, c.id).cerrado, false);
  // Lo que anuncia quien no es el dueño de la propuesta no cuenta.
  await registrar(eje, { autor: 'cocina', sobre: c.id, en: ANUNCIO, t: T, movimientos: [minuto('cocina')], payload: anuncio('E:casa/EUR', 99, 'pagar', 'cocina', 'huesped') });
  assert.equal(siguiente(eje, c.id, 'cocina').faltaDeMi.length, 0);
  // Pagar un movimiento de otra serie o de menos no cierra.
  await registrar(eje, { autor: 'huesped', sobre: c.id, t: T, movimientos: [minuto('huesped'), { token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 11, de: 'huesped', a: 'cocina' }], payload: 'de menos' });
  assert.equal(cerrado(eje, c.id).cerrado, false);
  await registrar(eje, { ...siguiente(eje, c.id, 'huesped').faltaDeMi[0].transaccion, t: T });
  assert.equal(cerrado(eje, c.id).cerrado, true);
});

test('consolidar rechaza huecos no heredables y no consolida nada vacío', async () => {
  const { eje, compra } = await ejemploCompra();
  await assert.rejects(consolidar(eje, { autor: 'casa', foco: compra.id, t: T, elecciones: {} }), /nada que consolidar/);
  await assert.rejects(consolidar(eje, { autor: 'casa', foco: compra.id, t: T, elecciones: { 7: 'más tarde' } }), /hueco en 6/);
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
  // VG, 7-11 noche: por hojas: la décupla lleva cada posición entre corchetes ([['sitio'], ['precio'], …]); solo hojas sería una lista.
  assert.equal(CRITERIO_CAPACIDAD, 2);
  assert.equal(capacidadDe([['sitio'], ['precio'], [3]]), 3);
  for (const nodo of ['sitio', [['sitio'], ['precio']], [['sitio'], ['precio'], ['3']], [['sitio'], ['precio'], [0]], [['sitio'], ['precio'], [1.5]], [['sitio'], 'precio', ['x']]]) assert.equal(capacidadDe(nodo), undefined);

  // Un elemento neutro: su posición 1 declara capacidad 1; su posición 2 no declara nada.
  const t = '2026-12-01T09:00:00Z';
  const gasta = (de, cantidad = 1) => ({ token: 'T', escala: 'minuto', cantidad, de, a: null });
  // VG, 7-11 noche: lo emite una persona; encargo 3b: el génesis no mueve nada, su autor emite después (R antes que E).
  const eje = await Eje.genesis({ demostracion: true, identidad: 'g', emision: [{ token: 'R', cantidad: 5 }, { token: 'E', denominacion: 'minuto', cantidad: 300 }], foco: 'raíz', t });
  // T no cruza de persona (VG, 7-11 noche): el alta les cede minutos de g como E (E:g/minuto); cada una escribe con su propio T.
  const dar = ['ana', 'beto', 'carla'].map((a) => ({ token: 'E', emisor: 'g', denominacion: 'minuto', cantidad: 100, de: 'g', a }));
  for (const id of ['ana', 'beto', 'carla']) await entrarPorInvitacion(eje, { por: 'g', quien: id, t }); // encargo 3b: su alta acepta la invitación de g
  await eje.escribir({ autor: 'g', sobre: eje.genesisId, t, movimientos: [gasta('g'), ...dar], payload: 'altas' });
  const elemento = await eje.escribir({ autor: 'g', sobre: eje.genesisId, t, movimientos: [gasta('g')], payload: ['elemento', [['sitio'], ['precio'], [1]], [['otro sitio'], ['precio']]] }); // por hojas: 1 y 2 son décuplas
  let minuto = 10;
  /**
   * Un ocupante: el registro, si se da su tramo anclado en su 7 por quien lo escribe («lo lejano = anclaje») y lo que
   * anuncia en su 4.1 (pagar un minuto de g): abierto hasta que lo pague (encargo 3b: válido es cerrado).
   */
  const ocupar = async (autor, { en = '1000000000', tramo, payload = 'ocupo', sobre = elemento.id } = {}) => {
    const tt = '2026-12-01T10:' + minuto++ + ':00Z';
    const r = await eje.escribir({ autor, sobre, en, t: tt, movimientos: [gasta(autor)], payload });
    if (tramo) await eje.escribir({ autor, sobre: r.id, en: '7000000000', t: tt, movimientos: [gasta(autor, 2)], payload: tramo });
    await eje.escribir({ autor, sobre: r.id, en: ANUNCIO, t: tt, movimientos: [gasta(autor)], payload: anuncio('E:g/minuto', 1, 'pagar', autor, 'g') });
    return r;
  };
  // Después de los ocupantes (10:10, 10:11…): el t de un evento no es anterior al de su foco ([X] confirmar VG, src/ciclo.js).
  const tarde = '2026-12-01T12:00:00Z';
  // Validar es que quien ocupa registre lo que anunció (VG, 8-11, mapa §15 [D]: una sola operación, registrar).
  const validar = async (r) => {
    await registrar(eje, { ...siguiente(eje, r.id, r.autor).faltaDeMi[0].transaccion, t: tarde });
    return cerrado(eje, r.id).cerrado;
  };

  // El tramo: el 7 como colisión, [inicio, fin) en ISO. Vale lo propio o lo que el autor ancle en su 7; lo de otro, no.
  const propio = await ocupar('ana', { en: '2000000000', payload: ['r', 'a', 'b', 'c', 'd', 'e', 'f', [['2026-12-01'], ['2026-12-03']]] });
  // VG, 7-11 noche: por hojas. Un tramo es una décupla [[inicio], [fin]] (cada posición entre corchetes): ['2026-12-01', '2026-12-03'] sería una lista de dos ocupantes (abajo).
  assert.deepEqual(tramoDe(eje, propio.id).extremos, ['2026-12-01', '2026-12-03']);
  const anclado = await ocupar('ana', { en: '2000000000', tramo: [['2026-12-05'], ['2026-12-06']] });
  assert.deepEqual(tramoDe(eje, anclado.id).extremos, ['2026-12-05', '2026-12-06']);
  assert.equal(tramoDe(eje, anclado.id).desde, eje.sobre(anclado.id, '7000000000')[0].id);
  const deOtro = await ocupar('ana', { en: '2000000000' });
  await eje.escribir({ autor: 'beto', sobre: deOtro.id, en: '7000000000', t: tarde, movimientos: [gasta('beto', 2)], payload: [['2026-12-01'], ['2026-12-09']] });
  assert.throws(() => tramoDe(eje, deOtro.id), /sin tramo en el 7/);
  // Acotado y legible: sin 7, al revés o sin fechas, error.
  const [sinSiete, alReves, sinFechas] = [await ocupar('ana', { en: '2000000000' }), await ocupar('ana', { en: '2000000000', tramo: [['2026-12-03'], ['2026-12-01']] }), await ocupar('ana', { en: '2000000000', tramo: 'mañana' })];
  assert.throws(() => tramoDe(eje, sinSiete.id), /sin tramo en el 7/);
  assert.throws(() => tramoDe(eje, alReves.id), /tramo ilegible/);
  assert.throws(() => tramoDe(eje, sinFechas.id), /tramo ilegible/);

  // Dos ocupantes solapados en la posición con capacidad 1: el contador dice que no cabría, pero la fábrica
  // no lo consulta (el límite es una serie de tokens que cada parte mueve, como en Booking) y los dos se cierran.
  const primero = await ocupar('ana', { tramo: [['2026-12-01'], ['2026-12-03']] });
  assert.equal(await validar(primero), true);
  const segundo = await ocupar('beto', { tramo: [['2026-12-02'], ['2026-12-04']] });
  assert.deepEqual(ocupacion(eje, segundo.id).map((o) => [o.camino, o.capacidad, o.aLaVez, o.cabe]), [[[1], 1, 1, false]]);
  assert.equal(await validar(segundo), true);
  // Con capacidad, el tramo es obligatorio para contar.
  const sinTramo = await ocupar('carla');
  assert.throws(() => ocupacion(eje, sinTramo.id), /sin tramo en el 7/);
  // Cuenta también lo que referencia la posición desde otro anclaje (aquí, sobre el alta de carla: sobre el génesis,
  // el alta de g, tendría el precio de su atención; revisión de seguridad, encargo 3b).
  const fuera = await ocupar('carla', { sobre: eje.alta('carla').id, en: '0000000000', payload: ['fuera', { ref: elemento.id, dir: '1000000000' }], tramo: [['2026-12-10'], ['2026-12-12']] });
  assert.equal(await validar(fuera), true);
  assert.ok(registrosEn(eje, elemento.id, '1000000000').some((r) => r.id === fuera.id));
  const tercero = await ocupar('beto', { tramo: [['2026-12-11'], ['2026-12-13']] });
  assert.deepEqual(ocupacion(eje, tercero.id)[0].validos.map((v) => [v.id, v.anclado]), [[fuera.id, false]]);
  // Donde no hay capacidad declarada, no hay nada que contar.
  assert.deepEqual(ocupacion(eje, propio.id), []);
});

test('capacidad: un tramo es una décupla [[inicio], [fin]]; una lista de dos hojas en el 7 son dos ocupantes, no un tramo', async () => {
  const t = '2026-12-01T09:00:00Z';
  const eje = await Eje.genesis({ demostracion: true, identidad: 'g', emision: [], foco: 'raíz', t });
  const gasta = (cantidad) => ({ token: 'T', escala: 'minuto', cantidad, de: 'g', a: null });
  const escribir = (payload, extra = {}) => eje.escribir({ autor: 'g', sobre: eje.genesisId, t, movimientos: [gasta(9)], payload, ...extra });
  const propio = await escribir(['r', 'a', 'b', 'c', 'd', 'e', 'f', [['2026-12-01'], ['2026-12-03']]]);
  assert.deepEqual(tramoDe(eje, propio.id), { inicio: Date.parse('2026-12-01'), fin: Date.parse('2026-12-03'), extremos: ['2026-12-01', '2026-12-03'], texto: '2026-12-01 – 2026-12-03', desde: propio.id });
  // La lista de dos hojas no es un tramo: son dos ocupantes del 7, y el motivo lo dice.
  const lista = await escribir(['r', 'a', 'b', 'c', 'd', 'e', 'f', ['2026-12-01', '2026-12-03']]);
  assert.throws(() => tramoDe(eje, lista.id), /tramo ilegible en el 7 de \w{8}: el 7 es una lista de ocupantes.*\[\[inicio\], \[fin\]\]/);
  // Igual si la lista de hojas es lo que ancla su autor.
  const anclada = await escribir('x');
  await eje.escribir({ autor: 'g', sobre: anclada.id, en: '7000000000', t, movimientos: [gasta(2)], payload: ['2026-12-01', '2026-12-03'] });
  assert.throws(() => tramoDe(eje, anclada.id), /una lista de hojas es una lista de ocupantes, no un tramo/);
});

test('descubrir: cada elemento de una lista muestra su propio valor, no el de la lista entera', async () => {
  const { eje, menu } = await ejemploCompra();
  const [p1] = descubrir(eje, menu.id, { posiciones: [1] });
  const platos = p1.candidatos.filter((c) => c.enLista);
  assert.deepEqual(platos.map((c) => [c.indice, c.contenido, c.texto, c.etiqueta, c.estado]), [
    [0, 'ensalada', 'ensalada', 'ensalada', 'RESUELTO'],
    [1, 'guiso', 'guiso', 'guiso', 'RESUELTO'],
    [2, 'fruta', 'fruta', 'fruta', 'RESUELTO'],
  ]);
});

