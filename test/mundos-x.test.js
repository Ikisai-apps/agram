import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejemploCompra, ejemploCuenta } from '../ejemplos/ikisai/compra-food.mjs';
import { ejemploReserva } from '../ejemplos/ikisai/reserva-booking.mjs';
import { consolidar, autorizar, ejecutar, descubrir } from '../src/motor.js';
import { memoria, partir, nombreEn, ritmo, PASO, ORDEN_X, descendientes } from '../mundos/comun.js';
import { datosFabrica, svgFabrica, lineasFabrica, relativa, hayPuesto, ESTACIONES } from '../mundos/fabrica.js';
import { datosCiudad, svgCiudad, lineasCiudad, etiquetaSerie } from '../mundos/ciudad.js';
import { datosJardin, svgJardin, lineasJardin, formaDe } from '../mundos/jardin.js';
import { datosParque, svgParque, lineasParque, aguaDe, actoDe } from '../mundos/parque.js';
import { datosLente, svgLente, lineasLente, esHTML, textoPlano, marcoHTML } from '../mundos/lente.js';
import { MUNDOS, datosX, svgMundo, htmlX, sobrioX } from '../mundos/x.js';

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

/** La compra con su cuenta y el ciclo del motor: una ejecutada, una autorizada, una pendiente. */
async function ciclo() {
  const { eje, compra, menu, alta } = await ejemploCompra();
  const cuenta = await ejemploCuenta(eje, compra);
  const d = descubrir(eje, compra.id);
  const criterio = d.find((p) => p.posicion === 2).candidatos.find((c) => c.tipo === 'referencia');
  const hecha = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: '2026-11-07T14:20:00Z', elecciones: { 1: 'dos menús', 2: { candidato: criterio } }, titulo: 'Pedir dos' });
  const aut = await autorizar(eje, { autorizante: 'casa', consolidacion: hecha.id, t: '2026-11-07T14:25:00Z' });
  const ejec = await ejecutar(eje, { autor: 'huesped', consolidacion: hecha.id, t: '2026-11-07T14:40:00Z', movimientos: [eur(12, 'huesped', 'cocina')] });
  const autorizada = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: '2026-11-07T14:50:00Z', elecciones: { 1: 'agua' }, titulo: 'Agua' });
  const aut2 = await autorizar(eje, { autorizante: 'casa', consolidacion: autorizada.id, t: '2026-11-07T14:55:00Z' });
  const pendiente = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: '2026-11-07T14:58:00Z', elecciones: { 1: 'postre <y> "café"' }, titulo: 'Postre & <café>' });
  return { eje, compra, menu, alta, cuenta, criterio, hecha, aut, ejec, autorizada, aut2, pendiente };
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

test('fábrica: la celda vista desde el camino (como claseDe de la PR #40) y los puestos por colisión de ceros', () => {
  assert.deepEqual(relativa('1734000000', [1]), { i: 7, j: 3, k: 4 });
  assert.deepEqual(relativa('1734000000', []), { i: 1, j: 7, k: 3 });
  assert.equal(relativa('2734000000', [1]), null); // no está bajo el camino
  assert.equal(relativa('1734000000', [1, 7, 3, 4, 0, 0, 0, 0]), null); // no cabe la clase
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
  const { eje, compra, cuenta, hecha, autorizada, pendiente, aut, ejec, aut2 } = await ciclo();
  const d = datosFabrica(eje, compra.id);
  assert.equal(d.lineas.length, 10);
  assert.deepEqual(d.lineas.map((l) => l.puestos), [[0], [0, 1, 2], [0], [0, 1], [0, 1], [], [], [], [], []]);
  // La cuenta, anclada en 1, modifica 1.0 … 1.3: cuatro piezas en la línea 1, de clase 0.
  const deCuenta = d.lineas[1].piezas.filter((p) => p.evento === cuenta.id);
  assert.deepEqual(deCuenta.map((p) => `${p.i}.${p.j}.${p.k}`), ['1.0.0', '1.1.0', '1.2.0', '1.3.0']);
  assert.ok(deCuenta.every((p) => p.clase === 0 && p.forma === 'circulo' && p.nombre));
  // Las consolidaciones, ancladas en 4, ponen sus piezas en la línea 4.
  assert.ok(d.lineas[4].piezas.some((p) => p.evento === hecha.id && p.j === 0));
  // Cada caja en la estación de su estado, con su autorización y su ejecución.
  const caja = (id) => d.cajas.find((c) => c.consolidacion === id);
  assert.equal(caja(hecha.id).estacion, 2);
  assert.equal(caja(hecha.id).autorizacion.id, aut.id);
  assert.equal(caja(hecha.id).ejecucion.id, ejec.id);
  assert.deepEqual(caja(hecha.id).ejecucion.movimientos.map((m) => m.token + m.cantidad), ['E12']);
  assert.equal(caja(autorizada.id).estacion, 1);
  assert.equal(caja(autorizada.id).autorizacion.id, aut2.id);
  assert.equal(caja(pendiente.id).estacion, 0);
  assert.equal(caja(pendiente.id).autorizacion, null);
  assert.deepEqual(ESTACIONES.map((e) => e.nombre), ['consolidar', 'autorizar', 'ejecutar']);
  assert.equal(d.efectosEstacion.autorizar.nombre, 'autorizar');
  const sobrio = lineasFabrica(d).join('\n');
  assert.match(sobrio, /línea 1 ciudad: 3 puestos del foco · piezas: /);
  assert.match(sobrio, /consolidar: Postre & <café> \(huesped\)/);
});

test('fábrica: la matriz es relativa al camino', async () => {
  const { eje, compra } = await ejemploCompra();
  // Un registro anclado en la posición 1 de la compra, escrito como lo escribe la fábrica bajo el camino [1]: [i][j][k].
  const bajo = await eje.escribir({ autor: 'huesped', sobre: compra.id, en: '1000000000', t: '2026-11-07T14:00:00Z', movimientos: [gastaT('huesped', 4)], payload: [{ ref: compra.id, dir: '1000000000' }, [{ ref: compra.id, dir: '1100000000' }, ['ver', 'impulso']]] });
  const raiz = datosFabrica(eje, compra.id);
  const enUno = datosFabrica(eje, compra.id, { camino: [1] });
  // Desde la raíz, todo cae en la línea 1; desde [1], en las líneas 0 y 1 de la matriz de la posición 1, con la clase en el tercer dígito.
  assert.ok(raiz.lineas[1].piezas.every((p) => p.evento === bajo.id));
  const piezas = enUno.lineas.flatMap((l) => l.piezas).map((p) => `${p.i}.${p.j}.${p.k}:${p.forma}`);
  assert.ok(piezas.includes('1.1.1:rombo'), piezas.join(' ')); // clase 1: impulso de recursos
  assert.deepEqual(enUno.lineas[1].puestos, [0]); // la posición 1 de la compra es [ref, 1, 'EUR 12']: 1.1 es un terminal y 1.1.0 lo alcanza (ceros finales)
  assert.deepEqual(enUno.lineas[0].puestos, [0]);
});

test('fábrica: solo se anima lo nuevo; la caja recorre las estaciones con sus eventos reales', async () => {
  const { eje, compra, hecha, aut, ejec, pendiente } = await ciclo();
  const d = datosFabrica(eje, compra.id);
  assert.equal(animados(svgFabrica(d)).length, 0);
  // Una consolidación nueva: entra en «consolidar».
  let nuevos = new Set([pendiente.id]);
  let svg = svgFabrica(d, { nuevos });
  soloTransicionesReales(svg, eje, nuevos);
  const entra = deEvento(svg, pendiente.id).find((e) => e.includes('x-entra'));
  assert.equal(attr(entra, 'data-efecto'), 'consolidar');
  // Reproducir: la caja ejecutada entra, pasa por autorizar (su autorización) y sale por ejecutar (su ejecución).
  nuevos = new Set(eje.orden);
  svg = svgFabrica(d, { nuevos });
  soloTransicionesReales(svg, eje, nuevos);
  assert.equal(attr(deEvento(svg, aut.id).find((e) => e.includes('x-pasa')), 'data-efecto'), 'autorizar');
  assert.equal(attr(deEvento(svg, ejec.id).find((e) => e.includes('x-pasa')), 'data-efecto'), 'ejecutar');
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
  assert.deepEqual(d.tiendas.filter((t) => !t.vacia).map((t) => [t.j, t.tipo, t.texto]), [[0, 'referencia', '→ ' + d.tiendas[0].ref.slice(0, 8)], [1, 'propio', '1'], [2, 'propio', 'EUR 12']]);
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
  const abre = await eje.escribir({ autor: 'casa', sobre: compra.id, t: '2026-11-07T15:00:00Z', movimientos: [gastaT('casa'), { token: 'E', emisor: 'casa', denominacion: 'vales', cantidad: 5, de: null, a: 'casa' }], payload: 'Vales de bebida' });
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
  assert.ok(deEvento(svg, cierra.id).some((e) => e.includes('x-mercancia') && attr(e, 'data-a') === 'huesped'));
});

test('ciudad: en Booking, las plazas entregadas cierran su vía (saldo insuficiente para otra reserva)', async () => {
  const r = await ejemploReserva();
  const d = datosCiudad(r.eje, r.reserva.id);
  const plazas = d.vias.filter((v) => v.denominacion.includes('@'));
  assert.equal(plazas.length, 3); // tres noches de la cama individual
  assert.ok(plazas.every((v) => !v.abierta && v.saldoEmisor === 0 && v.cierre === r.entrega.ejecucion.id));
  assert.ok(plazas.every((v) => v.titulares.length === 1 && v.titulares[0].id === 'huesped'));
  assert.ok(d.vias.find((v) => v.clave === 'E:casa/EUR').abierta);
  assert.equal(etiquetaSerie(plazas[0].denominacion), r.habitacion.id.slice(0, 8) + '.1100000000@2026-11-20');
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
  assert.equal(d.plantas.length, 3); // el propio [2], su colisión 2.0 y lo que alcanza por referencia
  assert.ok(d.plantas.every((p) => p.forma === 'hierba'));
  assert.ok(d.plantas.some((p) => p.tipo === 'referencia' && p.texto === 'sin gluten'));
  // Booking: el criterio alcanzado en otra dirección de la habitación es un arbusto, con flor (elegido) y fruto (ejecutado).
  const r = await ejemploReserva();
  const j = datosJardin(r.eje, r.reserva.id);
  const arbusto = j.plantas.find((p) => p.forma === 'arbusto');
  assert.equal(arbusto.texto, 'con desayuno');
  assert.equal(arbusto.acuerdo, 1);
  assert.equal(arbusto.flores.length, 1);
  assert.equal(arbusto.frutos.length, 1);
  assert.match(lineasJardin(j).join('\n'), /arbusto · con desayuno · referencia · acuerdo 1\/10 · flor \(Reserva en firme\) · fruto/);
});

test('jardín: brota lo nuevo, florece lo elegido al consolidar y da fruto al ejecutar', async () => {
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
  assert.equal(attr(deEvento(svg, hecha.id).find((e) => e.includes('x-abre-flor')), 'data-efecto'), 'florecer');
  const fruto = deEvento(svg, ejec.id).find((e) => e.includes('x-cuaja'));
  assert.equal(attr(fruto, 'data-efecto'), 'fructificar');
  assert.match(attr(fruto, 'data-decision'), /\[X\] decidir VG/);
});

// ---------- parque ----------

test('parque: piscinas de grupo, bañeras de persona y quién habla con quién según los escritos', async () => {
  assert.equal(aguaDe('grupo'), 'piscina');
  assert.equal(aguaDe('persona'), 'banera');
  assert.equal(aguaDe('cosa'), 'muelle');
  assert.equal(aguaDe(null), 'sin-tipo');
  const { eje, compra, cuenta } = await ciclo();
  const d = datosParque(eje, compra.id);
  assert.deepEqual(d.declarados, ['huesped', 'cocina']);
  const agua = (id) => d.aguas.find((a) => a.id === id);
  assert.equal(agua('cocina').forma, 'piscina');
  assert.equal(agua('huesped').forma, 'banera');
  assert.ok(agua('huesped').declarado && agua('cocina').declarado && !agua('casa').declarado);
  const m = (de, a) => d.mensajes.filter((x) => x.de === de && x.a === a);
  assert.equal(m('huesped', 'cocina')[0].que, 'hablar a un grupo'); // la compra, escrita sobre el menú de cocina
  assert.equal(m('cocina', 'huesped')[0].evento, cuenta.id); // la cuenta, escrita sobre la compra de huesped
  assert.equal(m('cocina', 'huesped')[0].que, 'hablar a una persona');
  assert.ok(m('casa', 'huesped').length >= 2); // las autorizaciones de la casa sobre las consolidaciones de huesped
  assert.equal(m('huesped', 'huesped').length, 0); // escribir sobre lo propio no es hablar con nadie
  assert.match(lineasParque(d).join('\n'), /huesped → cocina: hablar a un grupo · 1/);
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
  assert.equal(attr(deEvento(svg, paquete.id).find((e) => e.includes('x-viaje')), 'data-efecto'), 'paquete');
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
