import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejemploCompra, ejemploCuenta } from '../ejemplos/ikisai/compra-food.mjs';
import { ejemploReserva } from '../ejemplos/ikisai/reserva-booking.mjs';
import { consolidar, registrar, siguiente, descubrir, ANUNCIO } from '../src/motor.js';
import { memoria, partir, nombreEn, ritmo, PASO, ORDEN_X, descendientes } from '../antigua/mundos/comun.js';
import { datosFabrica, svgFabrica, lineasFabrica, hayPuesto, ESTACIONES } from '../antigua/mundos/fabrica.js';
import { claseRelativa } from '../src/efectos.js';
import { claseDe } from '../src/escritura.js';
import { datosCiudad, svgCiudad, lineasCiudad, etiquetaSerie } from '../antigua/mundos/ciudad.js';
import { datosJardin, svgJardin, lineasJardin, formaDe } from '../antigua/mundos/jardin.js';
import { datosParque, svgParque, lineasParque, aguaDe, actoDe } from '../antigua/mundos/parque.js';
import { datosLente, svgLente, lineasLente, esHTML, textoPlano, marcoHTML } from '../antigua/mundos/lente.js';
import { MUNDOS, datosX, svgMundo, htmlX, sobrioX } from '../antigua/mundos/x.js';
import { crearUi as crearUiX, piezasX } from '../antigua/mundos/x-ui.js';
import { renderActual } from '../antigua/mundos/hilos-ui.js';
import { readFileSync } from 'node:fs';

const gastaT = (de, cantidad = 1) => ({ token: 'T', escala: 'minuto', cantidad, de, a: null });
const eur = (cantidad, de, a) => ({ token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad, de, a });

/** Etiquetas de apertura de los elementos animados (los que llevan x-nuevo). */
const animados = (svg) => [...svg.matchAll(/<[a-z]+ [^>]*class="[^"]*\bx-nuevo\b[^"]*"[^>]*>/g)].map((m) => m[0]);
const attr = (etiqueta, nombre) => new RegExp(`${nombre}="([^"]*)"`).exec(etiqueta)?.[1];
/** Los elementos animados que produce un evento. */
const deEvento = (svg, id) => animados(svg).filter((e) => attr(e, 'data-evento') === id);

/** Cada animación es el efecto de un evento real y nuevo, y dice qué efecto es. */
function soloTransicionesReales(svg, eje, nuevos) {
  for (const e of animados(svg)) {
    const id = attr(e, 'data-evento');
    assert.ok(id, 'animación sin evento: ' + e);
    assert.ok(eje.obtener(id), 'el evento existe en el eje: ' + id);
    assert.ok(nuevos.has(id), 'solo se anima lo nuevo: ' + id);
    assert.ok(attr(e, 'data-efecto'), 'animación sin efecto: ' + e);
    assert.match(attr(e, 'style') ?? '', /--retardo:[0-9.]+s/);
  }
}

/** Un movimiento anunciado en el 4.1 de una propuesta por su dueño: [[serie], [cuánto], [qué], [[de], [a]]] (motor.ANUNCIO). */
const anuncio = (serie, cantidad, que, de, a) => [[serie], [cantidad], [que], [[de], [a]]];

// Encargo 3b (VG, 8-11; mapa §15 [D] «Una sola operación: registrar»; N6: «los mundos animan registros anclados y
// movimientos; las fases las nombra el proceso»): no hay autorizar ni ejecutar. Una propuesta está abierta mientras le
// falta algo de lo que su dueño anunció en su 4.1 y cerrada cuando ha pasado (motor.cerrado, N5); cada parte registra
// su propio movimiento. La fábrica tiene dos estaciones (abierta y cerrada) y lo que cierra una propuesta es un
// registro con su movimiento, no una fase «ejecutado».

/**
 * La compra con su cuenta y tres propuestas de la huésped: una cerrada (anunció el pago y lo hizo: `ejec`), otra
 * abierta que espera a la casa y otra abierta con su propio pago anunciado.
 */
async function ciclo() {
  const { eje, compra, menu, alta } = await ejemploCompra();
  const cuenta = await ejemploCuenta(eje, compra);
  const d = descubrir(eje, compra.id);
  const criterio = d.find((p) => p.posicion === 2).candidatos.find((c) => c.tipo === 'referencia');
  const hecha = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: '2026-11-07T14:20:00Z', elecciones: { 1: 'dos menús', 2: { candidato: criterio } }, titulo: 'Pedir dos' });
  const anunciado = await registrar(eje, { autor: 'huesped', sobre: hecha.id, en: ANUNCIO, t: '2026-11-07T14:25:00Z', movimientos: [gastaT('huesped')], payload: anuncio('E:casa/EUR', 12, 'pagar', 'huesped', 'cocina') });
  const ejec = await registrar(eje, { ...siguiente(eje, hecha.id, 'huesped').faltaDeMi[0].transaccion, t: '2026-11-07T14:40:00Z' });
  const espera = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: '2026-11-07T14:50:00Z', elecciones: { 1: 'agua' }, titulo: 'Agua' });
  const anuncioEspera = await registrar(eje, { autor: 'huesped', sobre: espera.id, en: ANUNCIO, t: '2026-11-07T14:55:00Z', movimientos: [gastaT('huesped')], payload: anuncio('E:casa/EUR', 1, 'devolver', 'casa', 'huesped') });
  const pendiente = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: '2026-11-07T14:58:00Z', elecciones: { 1: 'postre <y> "café"' }, titulo: 'Postre & <café>' });
  await registrar(eje, { autor: 'huesped', sobre: pendiente.id, en: ANUNCIO, t: '2026-11-07T14:59:00Z', movimientos: [gastaT('huesped')], payload: anuncio('E:casa/EUR', 3, 'pagar', 'huesped', 'cocina') });
  return { eje, compra, menu, alta, cuenta, criterio, hecha, anunciado, ejec, espera, anuncioEspera, pendiente };
}

// ---------- común ----------

test('común: la memoria solo da por nuevo lo que llega después de mirar; reproducir lo cuenta todo', async () => {
  const { eje, compra } = await ejemploCompra();
  const m = memoria();
  assert.equal(m.nuevos(eje).size, 0); // la primera vez no se anima nada
  const cuenta = await ejemploCuenta(eje, compra);
  assert.deepEqual([...m.nuevos(eje)], [cuenta.id]);
  assert.equal(m.nuevos(eje).size, 0);
  assert.equal(m.nuevos(eje, { reproducir: true }).size, eje.orden.length);
  const otro = (await ejemploCompra()).eje;
  assert.equal(m.nuevos(otro).size, 0); // otro eje: se empieza de nuevo
});

test('común: el ritmo sigue el orden de entrada en el eje, con el mismo paso que los hilos', async () => {
  const { eje, compra } = await ejemploCompra();
  const orden = Object.fromEntries(eje.orden.map((id, i) => [id, i]));
  const r = ritmo(orden, new Set([compra.id, eje.genesisId]));
  assert.equal(r.segundos(eje.genesisId), 0);
  assert.equal(r.segundos(compra.id), PASO);
  assert.equal(r.estilo(compra.id, 0.2), `--retardo:${Math.round((PASO + 0.2) * 100) / 100}s`);
  assert.equal(r.es(compra.id), true);
  assert.equal(r.es('otro'), false);
});

test('común: los nombres salen del catálogo de efectos, y lo que no nombra lleva [X]', () => {
  assert.equal(nombreEn({ tipo: 'fase', fase: 'consolidado' }, 4).nombre, 'consolidar');
  assert.equal(nombreEn({ tipo: 'fase', fase: 'ejecutado' }, 4).nombre, 'ejecutar');
  assert.equal(nombreEn({ tipo: 'token', movimiento: 'emitir', token: 'E' }, 1).nombre, 'abrir vía');
  assert.equal(nombreEn({ tipo: 'token', movimiento: 'mover', token: 'E' }, 1).nombre, 'mercancía que fluye');
  assert.equal(nombreEn({ tipo: 'escrito' }, 2).nombre, 'brotar');
  assert.equal(nombreEn({ tipo: 'ver' }, 3).nombre, 'escuchar');
  assert.equal(nombreEn({ tipo: 'escrito' }, 0).nombre, 'mostrar');
  const sin = nombreEn({ tipo: 'token', movimiento: 'consumir', token: 'E' }, 1);
  assert.equal(sin.nombre, 'consumir E');
  assert.match(sin.decision, /\[X\] decidir VG/);
  assert.deepEqual(ORDEN_X, [4, 1, 2, 3, 0]); // la X: fábrica, ciudad, jardín, parque y lente
});

test('común: partir el texto en líneas sin pasarse del ancho', () => {
  assert.deepEqual(partir('Compra del menú del día', 10, 3), ['Compra del', 'menú del', 'día']);
  const corto = partir('una dos tres cuatro cinco seis siete', 8, 2);
  assert.equal(corto.length, 2);
  assert.ok(corto[1].endsWith('…'));
  assert.ok(partir('supercalifragilístico', 6, 2)[0].length <= 6);
  assert.deepEqual(partir('', 10, 3), []);
});

// ---------- fábrica ----------

test('fábrica: los puestos por colisión de ceros', () => {
  const base = ['título', ['a', 'b'], 'c'];
  assert.equal(hayPuesto(base, 0, 0), true); // 0.0 alcanza la posición 0
  assert.equal(hayPuesto(base, 1, 1), true);
  assert.equal(hayPuesto(base, 1, 2), false);
  assert.equal(hayPuesto(base, 2, 0), true); // 2.0 alcanza la posición 2, aunque sea un terminal
  assert.equal(hayPuesto(base, 2, 1), false);
  assert.equal(hayPuesto('terminal', 0, 0), true);
  assert.equal(hayPuesto('terminal', 0, 1), false);
});

test('fábrica: diez líneas con la matriz de 100 del foco; las piezas son las celdas que modifican lo escrito sobre él', async () => {
  const { eje, compra, cuenta, hecha, anunciado, ejec, espera, anuncioEspera, pendiente } = await ciclo();
  const d = datosFabrica(eje, compra.id);
  assert.equal(d.lineas.length, 10);
  // Encargo 3b: la 2 de la compra lleva además la plantilla de cerrado (mapa §15 [D] N5): [→ menú:2, 'all announced
  // movements happened'], así que 2.1 es un puesto.
  assert.deepEqual(d.lineas.map((l) => l.puestos), [[0], [0, 1, 2], [0, 1], [0, 1], [0, 1], [0], [], [], [], []]); // 5: su plantilla (encargo 3c-1)
  // La cuenta, anclada en 1, modifica 1.0 … 1.3: cuatro piezas en la línea 1, de clase 0.
  const deCuenta = d.lineas[1].piezas.filter((p) => p.evento === cuenta.id);
  assert.deepEqual(deCuenta.map((p) => `${p.i}.${p.j}.${p.k}`), ['1.0.0', '1.1.0', '1.2.0', '1.3.0']);
  assert.ok(deCuenta.every((p) => p.clase === 0 && p.forma === 'circulo' && p.nombre));
  // Los registros del motor no son piezas (el catálogo no los lee celda a celda): son las cajas de las estaciones.
  // Encargo 3b: los registros del motor son las propuestas (contexto.motor = fabrica); ya no hay fases escritas.
  const delMotor = new Set(eje.orden.filter((id) => eje.obtener(id).contexto?.motor === 'fabrica'));
  assert.equal(delMotor.size, 3);
  assert.ok(d.lineas.every((l) => l.piezas.every((p) => !delMotor.has(p.evento))));
  assert.ok(d.cajas.some((c) => c.consolidacion === hecha.id));
  // Cada caja en la estación de su lectura de cerrado (antes: consolidar, autorizar, ejecutar; encargo 3b, mapa §15
  // [D]: abierta y cerrada), con sus partes: lo registrado sobre la propuesta (el anuncio y el pago que lo cumple).
  const caja = (id) => d.cajas.find((c) => c.consolidacion === id);
  assert.deepEqual([caja(hecha.id).estacion, caja(hecha.id).estado, caja(hecha.id).cerrado], [1, 'cerrada', true]);
  assert.deepEqual(caja(hecha.id).partes.map((p) => p.id), [anunciado.id, ejec.id]);
  assert.equal(caja(hecha.id).ultima.id, ejec.id);
  assert.deepEqual(caja(hecha.id).ultima.movimientos.map((m) => m.token + m.cantidad), ['E12'], 'sin el T de escribir');
  assert.deepEqual([caja(espera.id).estacion, caja(espera.id).estado, caja(espera.id).cerrado], [0, 'abierta', false]);
  assert.deepEqual(caja(espera.id).partes.map((p) => p.id), [anuncioEspera.id]);
  assert.deepEqual([caja(pendiente.id).estacion, caja(pendiente.id).estado], [0, 'abierta']);
  assert.deepEqual(ESTACIONES.map((e) => e.nombre), ['abierta', 'cerrada']);
  // Las dos estaciones son lecturas de la misma fase (N6: las fases las nombra el proceso): el catálogo las nombra igual.
  assert.equal(d.efectosEstacion.cerrada.nombre, nombreEn({ tipo: 'fase', fase: 'consolidado' }, 4).nombre);
  const sobrio = lineasFabrica(d).join('\n');
  assert.match(sobrio, /línea 1 ciudad: 3 puestos del foco · piezas: /);
  assert.match(sobrio, /abierta: Agua \(huesped\), Postre & <café> \(huesped\)/);
  assert.match(sobrio, /cerrada: Pedir dos \(huesped\)/);
});

test('fábrica: la matriz es relativa al camino', async () => {
  const { eje, compra } = await ejemploCompra();
  // Un registro anclado en la posición 1 de la compra, escrito como lo escribe la fábrica bajo el camino [1]: [i][j][k].
  const bajo = await eje.escribir({ autor: 'huesped', sobre: compra.id, en: '1000000000', t: '2026-11-07T14:00:00Z', movimientos: [gastaT('huesped', 4)], payload: [{ ref: compra.id, dir: '1000000000' }, [{ ref: compra.id, dir: '1100000000' }, [['ver'], ['impulso']]]] });
  const raiz = datosFabrica(eje, compra.id);
  const enUno = datosFabrica(eje, compra.id, { camino: [1] });
  // Desde la raíz, todo cae en la línea 1; desde [1], en las líneas 0 y 1 de la matriz de la posición 1, con la clase en el tercer dígito.
  assert.ok(raiz.lineas[1].piezas.every((p) => p.evento === bajo.id));
  const piezas = enUno.lineas.flatMap((l) => l.piezas).map((p) => `${p.i}.${p.j}.${p.k}:${p.forma}`);
  assert.ok(piezas.includes('1.1.1:rombo'), piezas.join(' ')); // clase 1: impulso de recursos
  // La posición, subposición y clase son las del efecto, leído con el camino como marco: claseRelativa y claseDe dan lo mismo.
  for (const p of enUno.lineas.flatMap((l) => l.piezas)) {
    assert.equal(p.clase, claseRelativa(p.celda, [1]));
    assert.equal(p.clase, claseDe(p.celda, [1]));
  }
  assert.deepEqual(enUno.lineas[1].puestos, [0]); // la posición 1 de la compra es [ref, 1, 'EUR 12']: 1.1 es un terminal y 1.1.0 lo alcanza (ceros finales)
  assert.deepEqual(enUno.lineas[0].puestos, [0]);
});

test('fábrica: solo se anima lo nuevo; la caja recorre las estaciones con sus eventos reales', async () => {
  const { eje, compra, hecha, ejec, pendiente } = await ciclo();
  const d = datosFabrica(eje, compra.id);
  assert.equal(animados(svgFabrica(d)).length, 0);
  // Una propuesta nueva: entra en «abierta».
  let nuevos = new Set([pendiente.id]);
  let svg = svgFabrica(d, { nuevos });
  soloTransicionesReales(svg, eje, nuevos);
  const entra = deEvento(svg, pendiente.id).find((e) => e.includes('x-entra'));
  assert.equal(attr(entra, 'data-efecto'), 'consolidar');
  // Reproducir: la caja cerrada entra en «abierta» y pasa a «cerrada» con el registro que la cierra (antes pasaba por
  // autorizar y salía por ejecutar; encargo 3b, mapa §15 [D] «Una sola operación: registrar»).
  nuevos = new Set(eje.orden);
  svg = svgFabrica(d, { nuevos });
  soloTransicionesReales(svg, eje, nuevos);
  assert.equal(attr(deEvento(svg, ejec.id).find((e) => e.includes('x-pasa')), 'data-efecto'), d.efectosEstacion.cerrada.nombre);
  assert.ok(!/autorizar|ejecutar/.test(svg.replace(/<title>[^<]*<\/title>/g, '')), 'sin estaciones de autorizar ni de ejecutar');
  assert.ok(deEvento(svg, hecha.id).some((e) => e.includes('x-entra')));
  // Las piezas nuevas avanzan desde el principio de su línea.
  const avanza = animados(svg).filter((e) => e.includes('x-avanza'));
  assert.ok(avanza.length >= 4);
  assert.ok(avanza.every((e) => /--dx:-?[0-9.]+px/.test(attr(e, 'style'))));
  // Texto escapado: el título de la consolidación lleva < y &.
  assert.ok(!svg.includes('<café>'));
  assert.ok(svg.includes('&lt;café&gt;'));
  // Compacto: la celda 4 de Mapped.
  const compacto = svgFabrica(d, { compacto: true, nuevos });
  assert.match(compacto, /viewBox="0 0 120 96"/);
  assert.ok(!compacto.includes('x-estacion-nombre'));
  soloTransicionesReales(compacto, eje, nuevos);
});

// ---------- ciudad ----------

test('ciudad: la manzana de la posición 1, los otros ocupantes y la vía de los EUR', async () => {
  const { eje, compra, cuenta, ejec } = await ciclo();
  const d = datosCiudad(eje, compra.id);
  // VG, 7-11 noche: por hojas: la 1.0 de la compra es la lista de uno [ref menú:1] (cada posición entre corchetes); la tienda
  // la lee por su único ocupante, la referencia al menú, con su enlace.
  const alMenu = compra.payload[1][0][0].ref;
  assert.deepEqual(d.tiendas.filter((t) => !t.vacia).map((t) => [t.j, t.tipo, t.texto]), [[0, 'referencia', '→ ' + alMenu.slice(0, 8)], [1, 'propio', '1'], [2, 'propio', 'EUR 12']]);
  assert.ok(d.otros.some((o) => o.tipo === 'escrito' && o.evento === cuenta.id && o.texto === 'Cuenta del menú'));
  assert.ok(d.otros.some((o) => o.tipo === 'referencia' && o.texto === 'ensalada'));
  const v = d.vias.find((x) => x.clave === 'E:casa/EUR');
  assert.ok(v.abierta);
  assert.equal(v.emitido, 500);
  assert.ok(v.movimientos.some((m) => m.evento === ejec.id && m.de === 'huesped' && m.a === 'cocina' && m.cantidad === 12));
  assert.ok(d.casas.includes('huesped') && d.casas.includes('cocina'));
  // La ejecución nueva: mercancía de la casa de huesped a la de cocina.
  const nuevos = new Set([ejec.id, cuenta.id]);
  const svg = svgCiudad(d, { nuevos });
  soloTransicionesReales(svg, eje, nuevos);
  const fluye = deEvento(svg, ejec.id).find((e) => e.includes('x-mercancia'));
  assert.equal(attr(fluye, 'data-efecto'), 'mercancía que fluye');
  assert.equal(attr(fluye, 'data-de'), 'huesped');
  assert.equal(attr(fluye, 'data-a'), 'cocina');
  assert.equal(attr(deEvento(svg, cuenta.id).find((e) => e.includes('x-levanta')), 'data-efecto'), 'abrir tienda');
  assert.match(lineasCiudad(d).join('\n'), /vía EUR de casa: abierta/);
});

test('ciudad: emitir una serie abre su vía; sin saldo del emisor, la vía se cierra', async () => {
  const { eje, compra } = await ejemploCompra();
  // VG, 7-11 noche: emitir E es el último escalón (T + R + P + E): la casa gasta su T, pone en juego un R propio
  // ante la persona huésped y tiene P sobre la compra (el suyo cubre todo el eje).
  const rEnJuego = [{ token: 'R', emisor: 'casa', cantidad: 2, de: null, a: 'casa' }, { token: 'R', emisor: 'casa', cantidad: 0.5, de: 'casa', a: 'casa', estado: 'bloqueo', salida: 'R:casa' }, { token: 'R', emisor: 'casa', cantidad: 1, de: 'casa', a: 'huesped' }];
  const abre = await eje.escribir({ autor: 'casa', sobre: compra.id, t: '2026-11-07T15:00:00Z', movimientos: [gastaT('casa'), ...rEnJuego, { token: 'E', emisor: 'casa', denominacion: 'vales', cantidad: 5, de: null, a: 'casa' }], payload: 'Vales de bebida' });
  let d = datosCiudad(eje, compra.id);
  let v = d.vias.find((x) => x.clave === 'E:casa/vales');
  assert.ok(v.abierta);
  assert.equal(v.cierre, null);
  let nuevos = new Set([abre.id]);
  let svg = svgCiudad(d, { nuevos });
  soloTransicionesReales(svg, eje, nuevos);
  assert.equal(attr(deEvento(svg, abre.id).find((e) => e.includes('x-abre')), 'data-efecto'), 'abrir vía');
  // La casa da los cinco vales: se queda sin saldo y la vía se cierra; cae la barrera con el evento que la dejó a cero.
  const cierra = await eje.escribir({ autor: 'casa', sobre: abre.id, t: '2026-11-07T15:05:00Z', movimientos: [gastaT('casa'), { token: 'E', emisor: 'casa', denominacion: 'vales', cantidad: 5, de: 'casa', a: 'huesped' }], payload: 'Vales a la persona huésped' });
  d = datosCiudad(eje, compra.id);
  v = d.vias.find((x) => x.clave === 'E:casa/vales');
  assert.equal(v.abierta, false);
  assert.equal(v.saldoEmisor, 0);
  assert.equal(v.cierre, cierra.id);
  assert.deepEqual(v.titulares, [{ id: 'huesped', cantidad: 5 }]);
  nuevos = new Set([cierra.id]);
  svg = svgCiudad(d, { nuevos });
  soloTransicionesReales(svg, eje, nuevos);
  const barrera = deEvento(svg, cierra.id).find((e) => e.includes('x-cae'));
  assert.equal(attr(barrera, 'data-efecto'), 'cerrar vía');
  assert.match(attr(barrera, 'data-decision'), /\[X\] decidir VG/);
  assert.equal(attr(barrera, 'data-decision').match(/\[X\] decidir VG/g).length, 1); // la marca, una sola vez
  assert.ok(deEvento(svg, cierra.id).some((e) => e.includes('x-mercancia') && attr(e, 'data-a') === 'huesped'));
});

test('ciudad: en Booking, las plazas entregadas cierran su vía: una venta, no un fallo', async () => {
  const r = await ejemploReserva();
  const d = datosCiudad(r.eje, r.reserva.id);
  const plazas = d.vias.filter((v) => v.denominacion.includes('@'));
  assert.equal(plazas.length, 3); // tres noches de la cama individual
  // Encargo 3b (mapa §15 [D]): la entrega es el registro de la casa con su movimiento, no la ejecución de una consolidación.
  assert.ok(plazas.every((v) => !v.abierta && v.saldoEmisor === 0 && v.cierre === r.entrega.id));
  assert.ok(plazas.every((v) => v.titulares.length === 1 && v.titulares[0].id === 'huesped'));
  // El rótulo dice lo que pasó: la casa ya dio la plaza; nada de «saldo insuficiente».
  const reserva = svgCiudad(d) + lineasCiudad(d).join(' · ');
  assert.ok(!/saldo insuficiente/.test(reserva));
  assert.match(reserva, /ya dio todo lo que emitió/);
  assert.match(reserva, /cerrada \(el emisor ya lo dio todo\)/);
  assert.ok(d.vias.find((v) => v.clave === 'E:casa/EUR').abierta);
  // R2: la habitación ya no va en la denominación sino en el registro de la serie; el rótulo la lleva tras «@».
  assert.equal(plazas[0].registro, r.habitacion.id);
  assert.equal(plazas[0].etiqueta, '1100000000@2026-11-20@' + r.habitacion.id.slice(0, 8));
  assert.equal(etiquetaSerie('x.' + 'a'.repeat(64)), 'x.aaaaaaaa');
  // La habitación: la temporada emite 42 series; se dibujan seis y el resto se cuenta.
  const h = datosCiudad(r.eje, r.habitacion.id);
  assert.equal(h.vias.length, 6);
  assert.equal(h.vias.length + h.masVias, 43); // 42 series de plaza y noche, y los EUR del pago
  assert.match(svgCiudad(h), /\+37 vías/);
});

// ---------- jardín ----------

test('jardín: una planta por ocupante de la posición 2; hierba si encaja exacto, arbusto si el acuerdo es parcial', async () => {
  assert.equal(formaDe(10), 'hierba');
  assert.equal(formaDe(1), 'arbusto');
  const { eje, compra } = await ejemploCompra();
  const d = datosJardin(eje, compra.id);
  // VG, 7-11 noche: por hojas: la 2 es [ref menú:2, …], sin 2.0: su elemento y lo que alcanza. Encargo 3b: además la
  // plantilla de cerrado que nombra la compra (mapa §15 [D] N5), un terminal propio: tres plantas.
  assert.equal(d.plantas.length, 3);
  assert.ok(d.plantas.every((p) => p.forma === 'hierba'));
  assert.ok(d.plantas.some((p) => p.tipo === 'referencia' && p.texto === 'sin gluten'));
  assert.ok(d.plantas.some((p) => p.tipo === 'propio' && p.texto === 'all announced movements happened'));
  // Booking: VG, 7-11 noche: por hojas: la reserva apunta a la 2 entera de la habitación (una dirección no entra en su
  // lista de criterios), en la misma dirección: encaja exacto, hierba. Antes llevaba flor y fruto de «Reserva en
  // firme»; encargo 3b (mapa §15 [D] «Una sola operación: registrar»): la reserva se confirma con los registros de cada
  // parte sobre ella, sin consolidación que elija el criterio, así que no hay flor ni fruto (los cubre la prueba
  // siguiente, con una propuesta real que lo elige y se cierra).
  const r = await ejemploReserva();
  const j = datosJardin(r.eje, r.reserva.id);
  const criterio = j.plantas.find((p) => p.tipo === 'referencia');
  assert.deepEqual([criterio.forma, criterio.texto, criterio.acuerdo], ['hierba', 'sin humo', 10]);
  assert.deepEqual([criterio.flores.length, criterio.frutos.length], [0, 0]);
  assert.match(lineasJardin(j).join('\n'), /hierba · sin humo · referencia · exacto$/m);
  // El criterio alcanzado en otra dirección (la 2.1 de una décupla, cada posición entre corchetes) es un arbusto: acuerdo 1.
  const fuente = await eje.escribir({ autor: 'casa', sobre: compra.id, t: '2026-11-07T15:00:00Z', movimientos: [gastaT('casa')], payload: ['Criterios', 'x', [['sin humo'], ['con desayuno']]] });
  const pide = await eje.escribir({ autor: 'casa', sobre: compra.id, t: '2026-11-07T15:01:00Z', movimientos: [gastaT('casa')], payload: ['Pide', 'y', [{ ref: fuente.id, dir: '2100000000' }]] });
  const p = datosJardin(eje, pide.id);
  const arbusto = p.plantas.find((x) => x.forma === 'arbusto');
  assert.deepEqual([arbusto.tipo, arbusto.texto, arbusto.acuerdo], ['referencia', 'con desayuno', 1]);
  assert.match(lineasJardin(p).join('\n'), /arbusto · con desayuno · referencia · acuerdo 1\/10/);
});

test('jardín: brota lo nuevo, florece lo elegido al consolidar y da fruto al cerrarse', async () => {
  const { eje, compra, hecha, ejec, criterio } = await ciclo();
  const brote = await eje.escribir({ autor: 'cocina', sobre: compra.id, en: '2000000000', t: '2026-11-07T15:10:00Z', movimientos: [gastaT('cocina', 2)], payload: ['Criterio de cocina', 'sin picante'] });
  const d = datosJardin(eje, compra.id);
  const elegida = d.plantas.find((p) => p.evento === criterio.evento && p.tipo === 'referencia');
  assert.deepEqual(elegida.flores.map((f) => f.consolidacion), [hecha.id]);
  assert.deepEqual(elegida.frutos.map((f) => f.ejecucion), [ejec.id]);
  assert.ok(d.plantas.some((p) => p.evento === brote.id && p.tipo === 'escrito'));
  assert.equal(animados(svgJardin(d)).length, 0);
  const nuevos = new Set([brote.id, hecha.id, ejec.id]);
  const svg = svgJardin(d, { nuevos });
  soloTransicionesReales(svg, eje, nuevos);
  assert.equal(attr(deEvento(svg, brote.id).find((e) => e.includes('x-brota')), 'data-efecto'), 'brotar');
  // Cada dibujo lleva el nombre que el catálogo da a SU operación en el jardín, y la marca de por qué se dibuja así.
  const flor = deEvento(svg, hecha.id).find((e) => e.includes('x-abre-flor'));
  assert.equal(attr(flor, 'data-efecto'), 'fructificar'); // fase.consolidado en el jardín
  assert.match(attr(flor, 'data-decision'), /se dibuja como flor/);
  const fruto = deEvento(svg, ejec.id).find((e) => e.includes('x-cuaja'));
  // El fruto es el registro que cierra la propuesta (encargo 3b); su nombre sigue siendo el genérico de la fase
  // «ejecutado» del catálogo (mundos/jardin.js), que el jardín no nombra.
  assert.equal(attr(fruto, 'data-efecto'), 'ejecutar');
  assert.match(attr(fruto, 'data-decision'), /no nombra el cierre en el jardín/);
});

// ---------- parque ----------

test('parque: piscinas de grupo, bañeras de persona y quién habla con quién según los escritos', async () => {
  assert.equal(aguaDe('grupo'), 'piscina');
  assert.equal(aguaDe('persona'), 'banera');
  assert.equal(aguaDe('cosa'), 'muelle');
  assert.equal(aguaDe(null), 'sin-tipo');
  const { eje, compra, cuenta, espera } = await ciclo();
  // Antes, la casa hablaba a la huésped con sus autorizaciones. Encargo 3b (mapa §15 [D]: cada uno mueve lo suyo):
  // la casa le habla registrando lo que la propuesta «Agua» espera de ella (devolverle un euro).
  const devuelve = await registrar(eje, { ...siguiente(eje, espera.id, 'casa').faltaDeMi[0].transaccion, t: '2026-11-07T14:57:00Z' });
  const d = datosParque(eje, compra.id);
  assert.deepEqual(d.declarados, ['huesped', 'cocina']);
  const agua = (id) => d.aguas.find((a) => a.id === id);
  assert.equal(agua('cocina').forma, 'muelle'); // la cocina es una cosa de la casa (Core, 8-11: un grupo no recibe T ni escribe)
  assert.equal(agua('huesped').forma, 'banera');
  assert.ok(agua('huesped').declarado && agua('cocina').declarado && !agua('casa').declarado);
  const m = (de, a) => d.mensajes.filter((x) => x.de === de && x.a === a);
  assert.equal(m('huesped', 'cocina')[0].que, 'hablar'); // la cocina es una cosa (Core, 8-11); la compra, escrita sobre el menú de cocina
  assert.equal(m('cocina', 'huesped')[0].evento, cuenta.id); // la cuenta, escrita sobre la compra de huesped
  assert.equal(m('cocina', 'huesped')[0].que, 'hablar a una persona');
  assert.deepEqual(m('casa', 'huesped').map((x) => [x.evento, x.que]), [[devuelve.id, 'hablar a una persona']]);
  assert.equal(m('huesped', 'huesped').length, 0); // escribir sobre lo propio no es hablar con nadie
  assert.match(lineasParque(d).join('\n'), /huesped → cocina: hablar · 1/);
});

test('parque: hablar deja una gota en el agua de quien recibe, un paquete si lleva tokens; escuchar hace onda', async () => {
  const { eje, compra } = await ejemploCompra();
  const habla = await eje.escribir({ autor: 'cocina', sobre: compra.id, t: '2026-11-07T15:00:00Z', movimientos: [gastaT('cocina')], payload: 'Sale en cinco minutos' });
  const paquete = await eje.escribir({ autor: 'cocina', sobre: compra.id, t: '2026-11-07T15:01:00Z', movimientos: [gastaT('cocina'), eur(2, 'cocina', 'huesped')], payload: 'Devolución del cambio' });
  const escucha = await eje.escribir({ autor: 'casa', sobre: compra.id, t: '2026-11-07T15:02:00Z', movimientos: [gastaT('casa')], payload: { ref: compra.id } });
  assert.equal(actoDe(eje.obtener(escucha.id), eje.obtener(compra.id)), 'escuchar');
  assert.equal(actoDe(eje.obtener(habla.id), eje.obtener(compra.id)), 'hablar');
  const d = datosParque(eje, compra.id);
  const nuevos = new Set([habla.id, paquete.id, escucha.id]);
  const svg = svgParque(d, { nuevos });
  soloTransicionesReales(svg, eje, nuevos);
  const gota = deEvento(svg, habla.id).find((e) => e.includes('x-viaje'));
  assert.equal(attr(gota, 'data-efecto'), 'hablar a una persona');
  assert.equal(attr(gota, 'data-de'), 'cocina');
  assert.equal(attr(gota, 'data-a'), 'huesped');
  assert.ok(deEvento(svg, habla.id).some((e) => e.includes('x-llega')));
  // El paquete se nombra con el movimiento que lo dispara (E de cocina a huesped: mover = «subir el agua»), con la marca de su forma.
  const caja = deEvento(svg, paquete.id).find((e) => e.includes('x-viaje'));
  assert.equal(attr(caja, 'data-efecto'), 'subir el agua');
  assert.match(attr(caja, 'data-decision'), /se dibuja como paquete/);
  assert.ok(svg.includes('x-paquete'));
  const onda = deEvento(svg, escucha.id).find((e) => e.includes('x-escucha'));
  assert.equal(attr(onda, 'data-efecto'), 'escuchar');
  assert.equal(attr(onda, 'data-de'), 'casa');
});

// ---------- lente ----------

test('lente: la portada es la posición 0 del foco (o su terminal); lo escrito por otros en 0 se apila detrás', async () => {
  const { eje, compra } = await ejemploCompra();
  const d = datosLente(eje, compra.id);
  assert.equal(d.texto, 'Compra del menú del día');
  assert.equal(d.autor, 'huesped');
  assert.equal(d.terminal, false);
  const g = datosLente(eje, eje.genesisId);
  assert.equal(g.terminal, true);
  assert.equal(g.texto, 'Casa de ejemplo');
  assert.ok(g.otras.length >= 1); // lo escrito en la raíz del génesis colisiona con su posición 0
  const svg = svgLente(d);
  assert.match(svg, /Compra del menú/);
  assert.match(svg, /PV0 no promete verdad/);
  assert.equal(animados(svg).length, 0);
  const nuevos = new Set([compra.id]);
  const animado = svgLente(d, { nuevos });
  soloTransicionesReales(animado, eje, nuevos);
  assert.equal(attr(deEvento(animado, compra.id)[0], 'data-efecto'), 'mostrar');
  assert.deepEqual(lineasLente(d), ['«Compra del menú del día» · huesped', 'PV0 no promete verdad']);
});

test('lente: HTML como portada: el SVG enseña su texto y el marco no tiene permisos', async () => {
  assert.equal(esHTML('<p>Hola</p>'), true);
  assert.equal(esHTML('hola <b>x</b>'), false);
  assert.equal(textoPlano('<p>Hola <b>mundo</b><script>alert(1)</script></p>'), 'Hola mundo');
  const { eje, compra } = await ejemploCompra();
  const html = '<h1 style="color:red">Menú <em>de hoy</em></h1><script>alert("x")</script>';
  const portada = await eje.escribir({ autor: 'cocina', sobre: compra.id, t: '2026-11-07T15:00:00Z', movimientos: [gastaT('cocina', 2)], payload: [html, 'nota'] });
  const d = datosLente(eje, portada.id);
  assert.equal(d.html, html);
  assert.equal(d.texto, 'Menú de hoy');
  const svg = svgLente(d);
  assert.ok(!svg.includes('<script'));
  assert.ok(!svg.includes('<h1'));
  assert.match(svg, />HTML</);
  const marco = marcoHTML(d);
  assert.match(marco, /<iframe class="x-marco" sandbox=""/);
  assert.ok(!marco.includes('<script'));
  assert.ok(marco.includes('&lt;script&gt;'));
  assert.equal(marcoHTML(datosLente(eje, compra.id)), '');
});

// ---------- la X ----------

test('X: los cinco mundos en su orden, puros y deterministas; sobrio y animado leen lo mismo', async () => {
  const { eje, compra } = await ciclo();
  const antes = eje.orden.length;
  const d = datosX(eje, compra.id);
  assert.deepEqual(Object.keys(MUNDOS).map(Number).sort(), [0, 1, 2, 3, 4]);
  assert.equal(eje.orden.length, antes); // leer no escribe
  const copia = JSON.stringify(d);
  const nuevos = new Set(eje.orden);
  const html = htmlX(d, { nuevos });
  assert.equal(JSON.stringify(d), copia); // pintar no toca los datos
  assert.equal(htmlX(d, { nuevos }), html); // determinista
  const orden = [...html.matchAll(/data-pv="(\d)"/g)].map((m) => Number(m[1]));
  assert.deepEqual(orden, [4, 1, 2, 3, 0]);
  soloTransicionesReales(html, eje, nuevos);
  assert.match(html, /data-reproducir/);
  for (const pv of [4, 1, 2, 3, 0]) {
    const svg = svgMundo(pv, d[pv], { compacto: true });
    assert.match(svg, new RegExp(`data-mundo="${pv}"`));
    assert.match(svg, /viewBox="0 0 120 96"/);
    assert.equal(animados(svg).length, 0);
  }
  assert.throws(() => svgMundo(5, d[4]), /la X tiene los mundos/);
  const sobrio = sobrioX(d);
  assert.deepEqual([...sobrio.matchAll(/<b>(\d)<\/b>/g)].map((m) => Number(m[1])), [4, 1, 2, 3, 0]);
  assert.ok(!sobrio.includes('<café>'));
});

test('X: Booking entero reproducido, cada animación sale de un evento real', async () => {
  const r = await ejemploReserva();
  const nuevos = new Set(r.eje.orden);
  for (const foco of [r.reserva.id, r.habitacion.id, r.eje.genesisId, r.alojamiento.id]) {
    const d = datosX(r.eje, foco);
    const html = htmlX(d, { nuevos });
    soloTransicionesReales(html, r.eje, nuevos);
    for (const pv of [4, 1, 2, 3, 0]) soloTransicionesReales(svgMundo(pv, d[pv], { compacto: true, nuevos }), r.eje, nuevos);
  }
  // Los descendientes van en orden de entrada y sin el foco.
  const ds = descendientes(r.eje, r.reserva.id);
  assert.ok(!ds.some((e) => e.id === r.reserva.id));
  const pos = ds.map((e) => r.eje.orden.indexOf(e.id));
  assert.deepEqual(pos, [...pos].sort((a, b) => a - b));
});

test('X: un foco terminal y un camino hondo no rompen ningún mundo', async () => {
  const { eje, compra } = await ejemploCompra();
  for (const [foco, camino] of [[eje.genesisId, []], [compra.id, [1]], [compra.id, [1, 0]], [compra.id, [9, 9, 9, 9, 9, 9, 9, 9]]]) {
    const d = datosX(eje, foco, { camino });
    const html = htmlX(d, { nuevos: new Set(eje.orden) });
    assert.match(html, /<svg class="mundo mundo-fabrica/);
    for (const pv of ORDEN_X) assert.ok(MUNDOS[pv].lineas(d[pv]).length >= 1);
  }
  assert.equal(datosFabrica(eje, compra.id, { camino: [9, 9, 9, 9, 9, 9, 9, 9] }).cabe, false);
});

// ---------- la X en la app (mundos/x-ui.js) ----------

test('X en la app: solo en animado y en Mapped; celdas 1–4 y 0, la vista con «ver la X» y lo nuevo una vez', async () => {
  const { eje, compra } = await ejemploCompra();
  const ui = crearUiX();
  const estado = { eje, foco: compra.id, camino: [], modo: 'mapped' };
  assert.equal(piezasX(estado, ui, { render: 'sobrio' }), null, 'en sobrio no se dibuja');
  assert.equal(piezasX({ ...estado, modo: 'pointed' }, ui, { render: 'animado' }), null, 'fuera de Mapped tampoco');
  assert.equal(renderActual(), 'sobrio'); // el botón «animado» de los hilos manda en los dos
  let p = piezasX(estado, ui, { render: 'animado' });
  assert.deepEqual(Object.keys(p.celdas).map(Number).sort(), [0, 1, 2, 3, 4]);
  assert.match(p.celdas[4], /viewBox="0 0 120 96"/); // compacto
  assert.match(p.boton, /data-x-vista aria-expanded="false">ver la X</);
  assert.equal(p.vista, null);
  assert.equal(animados(Object.values(p.celdas).join('')).length, 0); // la primera mirada no anima
  // Lo que llega después se anima una vez, con su evento.
  const cuenta = await ejemploCuenta(eje, compra);
  ui.vista = true;
  p = piezasX(estado, ui, { render: 'animado' });
  const nuevos = new Set([cuenta.id]);
  soloTransicionesReales(Object.values(p.celdas).join('') + p.vista, eje, nuevos);
  assert.ok(animados(p.vista).length > 0);
  assert.match(p.boton, /cerrar la X/);
  assert.match(p.vista, /class="x-completo"/);
  assert.match(p.vista, /la misma lectura en sobrio/);
  assert.equal(animados(Object.values(piezasX(estado, ui, { render: 'animado' }).celdas).join('')).length, 0);
  // «reproducir la llegada»: todo el eje cuenta como nuevo una sola vez.
  ui.reproducir = true;
  p = piezasX(estado, ui, { render: 'animado' });
  soloTransicionesReales(p.vista, eje, new Set(eje.orden));
  assert.ok(animados(p.vista).length > animados(htmlX(datosX(eje, compra.id), { nuevos })).length);
  assert.equal(ui.reproducir, false);
});

test('X: con menos movimiento, lo que solo viaja no se queda quieto en la salida', () => {
  const css = readFileSync(new URL('../antigua/mundos/x.css', import.meta.url), 'utf8');
  for (const clase of ['x-mercancia', 'x-viaje']) {
    assert.match(css, new RegExp(`\\.mundo \\.${clase}\\{opacity:0;animation:`), clase + ' parte invisible');
  }
  const reducido = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.match(reducido, /\.mundo \.x-mercancia,\.mundo \.x-viaje,\.mundo \.x-onda\{display:none!important;opacity:0!important\}/);
});
