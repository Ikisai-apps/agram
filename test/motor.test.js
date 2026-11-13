import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejemploCompra, ejemploCuenta } from '../ejemplos/ikisai/compra-food.mjs';
import { descubrir, consolidar, registrar, cerrado, siguiente, propuestas, FABRICA, ANUNCIO, capacidadDe, tramoDe, ocupacion, registrosEn, CRITERIO_CAPACIDAD } from '../src/motor.js';
import { evaluar } from '../src/bql.js';
import { Eje } from '../src/eje.js';
import { entrarPorInvitacion } from '../ejemplos/ikisai/altas.mjs';
import { pagaElCoste } from './ayudas-coste.js';
import * as A from '../src/acciones.js';

const minuto = (de, cantidad) => (cantidad === undefined ? pagaElCoste(de) : { token: 'T', escala: 'minuto', cantidad, de, a: null });
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
  // La cadena es el hilo: pago → su anuncio (VG 12-11, decisión 8: lo cumple lo que se ancla sobre él) → propuesta → compra → …
  assert.deepEqual(eje.hilo(pago.id).slice(0, 4).map((x) => x.id), [pago.id, tx.sobre, c.id, compra.id]);
  assert.deepEqual(eje.sobre(c.id, ANUNCIO).map((a) => a.id), [tx.sobre]);
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
  const gasta = (de, cantidad) => (cantidad === undefined ? pagaElCoste(de) : { token: 'T', escala: 'minuto', cantidad, de, a: null });
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


// VG 12-11 (estudio BQL-transacciones, decisión 8; #48): el anuncio es un movimiento anunciado del libro, y un anuncio puede
// llevar varios. Lo cumple lo que se ancla sobre él: siguiente propone a cada parte un registro anclado sobre el anuncio
// con todo lo suyo, cerrado espera a que cada movimiento anunciado lo mueva alguien así, y cierre da el último que lo hizo.
test('el anuncio como movimientos anunciados: cada parte cumple lo suyo con un registro anclado sobre el anuncio; cerrado cuando se ha movido todo', async () => {
  const { eje, compra, menu } = await ejemploCompra();
  const c = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: T, elecciones: { 1: 'dos menús' } });
  const anunciado = (m) => ({ ...m, estado: 'anunciado' });
  const pagar = { token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 5, de: 'huesped', a: 'cocina' };
  const devolver = { token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 1, de: 'cocina', a: 'huesped' };
  const saldo = eje.saldo('huesped', 'E:casa/EUR');
  const a = await registrar(eje, { autor: 'huesped', sobre: c.id, en: ANUNCIO, t: T, movimientos: [minuto('huesped'), anunciado(pagar), anunciado(devolver)], payload: 'pagar y devolver' });
  assert.equal(eje.saldo('huesped', 'E:casa/EUR'), saldo, 'anunciar no mueve');
  assert.equal(cerrado(eje, c.id).cerrado, false);
  const deHuesped = siguiente(eje, c.id, 'huesped');
  assert.deepEqual(deHuesped.faltaDeMi.map((x) => [x.anuncio, x.transaccion.sobre, x.transaccion.en, x.transaccion.movimientos.slice(1)]), [[a.id, a.id, FABRICA, [pagar]]]);
  assert.deepEqual(deHuesped.espera.map((x) => [x.anuncio, x.de]), [[a.id, 'cocina']]);
  // Lo de la huésped, sobre el anuncio: aún abierta (falta lo de la cocina) y a ella ya no le falta nada.
  await registrar(eje, { ...deHuesped.faltaDeMi[0].transaccion, t: T });
  assert.deepEqual([cerrado(eje, c.id).cerrado, siguiente(eje, c.id, 'huesped').faltaDeMi], [false, []]);
  // Un pago suelto de la cocina en la propuesta (no sobre el anuncio) no lo cumple (#48: se casaba por existencia).
  await registrar(eje, { autor: 'cocina', sobre: c.id, t: T, movimientos: [minuto('cocina'), devolver], payload: 'suelto' });
  assert.equal(cerrado(eje, c.id).cerrado, false);
  const [{ transaccion }] = siguiente(eje, c.id, 'cocina').faltaDeMi;
  const ultimo = await registrar(eje, { ...transaccion, t: T });
  assert.equal(cerrado(eje, c.id).cerrado, true);
  const { cierre } = await import('../src/motor.js');
  assert.equal(cierre(eje, c.id).id, ultimo.id, 'el registro que lo cerró cuelga del anuncio');
  void menu;
});

// ---------- los otros dos finales de un proceso (VG 12-11, #71.2; CONVERGENCIA de AARPIA §2.1) ----------

/**
 * La casa (persona, dueña) abre un encargo con un anuncio pendiente: la cocina (una cosa suya) le debe 7 EUR para el 10-11.
 * La huésped es otra persona. Devuelve { eje, encargo, anuncio }.
 */
async function encargoConPlazo() {
  const { eje, menu } = await ejemploCompra();
  const t0 = '2026-11-08T12:00:00Z';
  const encargo = await eje.escribir({ autor: 'casa', sobre: menu.id, t: t0, payload: ['Encargo de la casa', ['x'], ['all announced movements happened'], ['casa']], movimientos: [minuto('casa')] });
  const anunciado = { token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 7, de: 'cocina', a: 'casa', estado: 'anunciado', refiere: '2026-11-10T10:00:00Z' };
  const anuncio = await registrar(eje, { autor: 'casa', sobre: encargo.id, en: ANUNCIO, t: t0, payload: 'pagar el género', movimientos: [minuto('casa'), anunciado] });
  return { eje, encargo, anuncio };
}

test('cerrado con error: un registro del dueño anclado en el 4 con su causa cierra el proceso sin cumplirlo; cerrado lo lee distinto, siguiente y el camino callan, lo ajeno no cuenta y sin causa no pasa', async () => {
  const { eje, encargo } = await encargoConPlazo();
  const t = '2026-11-08T13:00:00Z';
  assert.deepEqual([cerrado(eje, encargo.id).cerrado, cerrado(eje, encargo.id).fin], [false, null]);
  assert.equal(siguiente(eje, encargo.id, 'cocina').espera.length + siguiente(eje, encargo.id, 'cocina').faltaDeMi.length, 1, 'abierto: la cocina debe 7 EUR');
  assert.deepEqual(A.acciones(eje, encargo.id, 4, 'casa').map((a) => a.nombre).filter((n) => n === 'close with error'), ['close with error']);
  assert.deepEqual(A.acciones(eje, encargo.id, 4, 'huesped').map((a) => a.nombre).filter((n) => n === 'close with error'), [], 'solo el dueño');
  // Sin causa no pasa: la plantilla la pide con texto (`=it != ""`) y un texto vacío no se escribe a mano (la forma).
  const sin = await A.transaccion(eje, 'close with error', { X: encargo.id, cause: '' }, 'casa', { t, idioma: 'en' });
  assert.deepEqual([sin.ok, sin.motivos.map((m) => m.regla)], [false, ['cause']]);
  await assert.rejects(registrar(eje, { autor: 'casa', sobre: encargo.id, en: FABRICA, t, payload: [[''], ['x'], ['closed with error'], ['casa'], ['close with error']], movimientos: [minuto('casa')] }), /payload 00: ni terminal ni array/, 'un texto vacío no se escribe: ni la causa');
  // Lo de quien no es el dueño (la huésped) se escribe, pero no cierra nada: cerrado solo lee el del dueño (o el de una cosa suya).
  await registrar(eje, { autor: 'huesped', sobre: encargo.id, en: FABRICA, t, payload: [['me lo quito de encima'], ['x'], ['closed with error'], ['huesped'], ['close with error']], movimientos: [minuto('huesped')] });
  assert.equal(cerrado(eje, encargo.id).fin, null, 'la huésped no es la dueña');
  // El dueño lo cierra con la plantilla de la época: la causa es texto obligatorio.
  const r = await A.transaccion(eje, 'close with error', { X: encargo.id, cause: 'el proveedor no repartió' }, 'casa', { t });
  assert.deepEqual([r.ok, r.modo, r.evento.en, r.evento.payload[0], r.evento.payload[4]], [true, 'person', FABRICA, ['el proveedor no repartió'], ['close with error']], JSON.stringify(r.motivos));
  await eje.anadir(r.evento);
  const c = cerrado(eje, encargo.id);
  assert.deepEqual([c.cerrado, c.fin, c.plantilla, c.causa, c.registro], [true, 'error', 'closed with error', 'el proveedor no repartió', r.evento.id]);
  assert.notEqual(c.plantilla, 'all announced movements happened', 'distinto de lo cumplido');
  // Deja de pedir pasos: siguiente de la cocina y de la casa, y el camino, ya no esperan nada.
  assert.deepEqual(siguiente(eje, encargo.id, 'cocina'), { cerrado: true, fin: 'error', causa: 'el proveedor no repartió', faltaDeMi: [], espera: [] });
  assert.deepEqual(siguiente(eje, encargo.id, 'casa').faltaDeMi, []);
  assert.deepEqual((await A.camino(eje, encargo.id, 'cocina', { t })).pasos.filter((p) => p.regla === 'stage'), []);
  // Ya cerrado, no se ofrece otro cierre.
  assert.deepEqual(A.acciones(eje, encargo.id, 4, 'casa').map((a) => a.nombre).filter((n) => ['close with error', 'expire'].includes(n)), []);
});

test('caducado: un registro anclado en el 4 con el plazo vencido (la fecha de un anuncio pendiente) que el libro comprueba con su reloj; lo escribe el dueño o una cosa suya (modo agent), cerrado lo lee caducado y siguiente calla', async () => {
  const { eje, encargo } = await encargoConPlazo();
  const despues = '2026-11-11T09:00:00Z';
  const ofrece = (yo) => A.acciones(eje, encargo.id, 4, yo).map((a) => a.nombre).includes('expire');
  assert.deepEqual([ofrece('casa'), ofrece('cocina')], [false, false], 'sin plazo vencido no se ofrece');
  // Antes de que venza para el libro, lo rechaza aunque quien escribe lo fechara tarde: lo que cuenta es el reloj del libro (8-11).
  const pronto = await A.transaccion(eje, 'expire', { X: encargo.id, deadline: '2026-11-10T10:00:00Z' }, 'cocina', { t: despues });
  assert.equal(pronto.ok, false);
  // El reloj del libro pasa del plazo: lo mueve un registro cualquiera.
  await eje.escribir({ autor: 'casa', sobre: encargo.id, t: despues, payload: ['un latido'], movimientos: [minuto('casa')] });
  assert.deepEqual([ofrece('casa'), ofrece('cocina'), ofrece('huesped')], [true, true, false], 'vencido: lo ofrecen el dueño y su cosa; no la huésped');
  assert.equal(A.acciones(eje, encargo.id, 4, 'cocina').find((a) => a.nombre === 'expire').parametros.find((p) => p.nombre === 'deadline').valor, '2026-11-10T10:00:00Z', 'el plazo por defecto es el del anuncio pendiente vencido');
  // La regla comprueba que es la fecha de un anuncio pendiente y que de verdad venció: otra fecha no vale.
  const otra = await A.transaccion(eje, 'expire', { X: encargo.id, deadline: '2026-11-09T10:00:00Z' }, 'cocina', { t: despues, idioma: 'en' });
  assert.deepEqual([otra.ok, otra.motivos.map((m) => m.regla)], [false, ['an expiry has expired']]);
  assert.match(otra.motivos[0].mensaje, /^an expiry has expired: 2026-11-09T10:00:00Z is not the date of a pending announcement of /);
  // La huésped lo escribe a mano (el libro lo acepta: el plazo es de verdad) pero no es la dueña ni una cosa suya: no cierra.
  await registrar(eje, { autor: 'huesped', sobre: encargo.id, en: FABRICA, t: despues, payload: [['caduca'], ['x'], [['expired'], ['2026-11-10T10:00:00Z']], ['huesped'], ['expire']], movimientos: [minuto('huesped')] });
  assert.equal(cerrado(eje, encargo.id).fin, null, 'lo que no es del dueño ni de una cosa suya no cierra');
  // La cocina (una cosa de la casa) lo lanza: «expire» es de modo agent, el del programador de AARPIA.
  const r = await A.transaccion(eje, 'expire', { X: encargo.id }, 'cocina', { t: despues });
  assert.equal(r.ok, true, JSON.stringify(r.motivos));
  assert.deepEqual([r.ok, r.modo, r.evento.en, r.evento.payload[2], r.evento.payload[4]], [true, 'agent', FABRICA, [['expired'], ['2026-11-10T10:00:00Z']], ['expire']], JSON.stringify(r.motivos));
  await eje.anadir(r.evento);
  const c = cerrado(eje, encargo.id);
  assert.deepEqual([c.cerrado, c.fin, c.plantilla, c.plazo, c.registro], [true, 'caducado', 'expired', '2026-11-10T10:00:00Z', r.evento.id]);
  assert.deepEqual(siguiente(eje, encargo.id, 'cocina'), { cerrado: true, fin: 'caducado', plazo: '2026-11-10T10:00:00Z', faltaDeMi: [], espera: [] });
  assert.deepEqual([ofrece('casa'), ofrece('cocina')], [false, false], 'ya cerrado, no se ofrece');
});

test('los finales: lo cumplido sigue siendo «cumplido» (fin) y con error gana a caducado', async () => {
  const { eje, compra } = await ejemploCompra();
  const c = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: T, elecciones: { 1: 'dos menús' } });
  assert.deepEqual([cerrado(eje, c.id).cerrado, cerrado(eje, c.id).fin], [true, 'cumplido'], 'no anuncia nada: cumplido');
  const { eje: e2, encargo } = await encargoConPlazo();
  await e2.escribir({ autor: 'casa', sobre: encargo.id, t: '2026-11-11T09:00:00Z', payload: ['un latido'], movimientos: [minuto('casa')] });
  const t = '2026-11-11T10:00:00Z';
  const caduca = await A.transaccion(e2, 'expire', { X: encargo.id }, 'casa', { t });
  await e2.anadir(caduca.evento);
  assert.equal(cerrado(e2, encargo.id).fin, 'caducado');
  // Un cierre con error escrito después (a mano: la plantilla ya no se ofrece) tiene prioridad.
  await registrar(e2, { autor: 'casa', sobre: encargo.id, en: FABRICA, t, payload: [['falló'], ['x'], ['closed with error'], ['casa'], ['close with error']], movimientos: [minuto('casa')] });
  assert.deepEqual([cerrado(e2, encargo.id).fin, cerrado(e2, encargo.id).causa], ['error', 'falló']);
});

// ---------- el cuarto fin: cerrado por decisión (VG 14-11, #80; APPS_PARA_AGRAM.md de Core AARPIA) ----------

test('cerrado por decisión: «close by decision» (modo person, solo el dueño, causa opcional) cierra el proceso sin cumplirlo ni fracasar; fin = decidido, siguiente y el camino callan', async () => {
  const { eje, encargo } = await encargoConPlazo();
  const t = '2026-11-08T13:00:00Z';
  const ofrece = (yo) => A.acciones(eje, encargo.id, 4, yo).map((a) => a.nombre).filter((n) => n === 'close by decision');
  assert.deepEqual([ofrece('casa'), ofrece('huesped'), ofrece('cocina')], [['close by decision'], [], []], 'solo el dueño');
  assert.equal(A.modoDeEjecucion(eje, 'close by decision').modo, 'person');
  assert.equal(cerrado(eje, encargo.id).fin, null);
  // La causa es opcional: sin ella, el texto por defecto en su 0.
  const sin = await A.transaccion(eje, 'close by decision', { X: encargo.id }, 'casa', { t });
  assert.deepEqual([sin.ok, sin.modo, sin.evento.en, sin.evento.payload[0], sin.evento.payload[4]], [true, 'person', FABRICA, ['closed by decision'], ['close by decision']], JSON.stringify(sin.motivos));
  // Lo de quien no es el dueño se escribe, pero no cierra nada.
  await registrar(eje, { autor: 'huesped', sobre: encargo.id, en: FABRICA, t, payload: [['no lo quiero'], ['x'], ['closed by decision'], ['huesped'], ['close by decision']], movimientos: [minuto('huesped')] });
  assert.equal(cerrado(eje, encargo.id).fin, null, 'la huésped no es la dueña');
  // Con causa: el dueño la escribe y queda en el cierre.
  const r = await A.transaccion(eje, 'close by decision', { X: encargo.id, cause: 'retirada de la oferta' }, 'casa', { t });
  assert.deepEqual([r.ok, r.evento.payload[0]], [true, ['retirada de la oferta']], JSON.stringify(r.motivos));
  await eje.anadir(r.evento);
  const c = cerrado(eje, encargo.id);
  assert.deepEqual([c.cerrado, c.fin, c.plantilla, c.causa, c.registro], [true, 'decidido', 'closed by decision', 'retirada de la oferta', r.evento.id]);
  assert.notEqual(c.fin, 'cumplido');
  assert.notEqual(c.fin, 'error');
  // Deja de pedir pasos, aunque lo anunciado siga pendiente; el camino tampoco lo lista; ya cerrado, no se ofrece otro cierre.
  assert.deepEqual(siguiente(eje, encargo.id, 'cocina'), { cerrado: true, fin: 'decidido', causa: 'retirada de la oferta', faltaDeMi: [], espera: [] });
  assert.deepEqual((await A.camino(eje, encargo.id, 'cocina', { t })).pasos.filter((p) => p.regla === 'stage'), []);
  assert.deepEqual(A.acciones(eje, encargo.id, 4, 'casa').map((a) => a.nombre).filter((n) => ['close with error', 'expire', 'close by decision'].includes(n)), []);
  // Lo cumplido no se deshace: un proceso ya cumplido sigue «cumplido» aunque su dueño escriba el cierre a mano; y con error gana.
  const { eje: e2, compra } = await ejemploCompra();
  const k = await consolidar(e2, { autor: 'huesped', foco: compra.id, t: T, elecciones: { 1: 'dos menús' } });
  await registrar(e2, { autor: 'huesped', sobre: k.id, en: FABRICA, t: T, payload: [['archivado'], ['x'], ['closed by decision'], ['huesped'], ['close by decision']], movimientos: [minuto('huesped')] });
  assert.equal(cerrado(e2, k.id).fin, 'cumplido', 'el cierre por decisión no deshace lo cumplido');
  await registrar(eje, { autor: 'casa', sobre: encargo.id, en: FABRICA, t, payload: [['falló'], ['x'], ['closed with error'], ['casa'], ['close with error']], movimientos: [minuto('casa')] });
  assert.equal(cerrado(eje, encargo.id).fin, 'error', 'con error gana a decidido');
});
