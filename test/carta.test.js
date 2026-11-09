// La carta, versión 1 (carta/carta.js): el árbol de la carta sin navegador, sobre los ejemplos. Comprueba que la carta
// no decide nada: lo que pinta sale del contrato (la división, las etiquetas, los tamaños, la madurez), del aro
// (acciones), del camino, del libro local y de la época; cambiar la tabla de división o los niveles en una copia de la
// época cambia el árbol, y en el módulo no hay escrita ninguna palabra de la época.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { arbol, formulario, enviar, preferencias, NIVEL, LATERALES, CENTROS, GEOMETRIA } from '../carta/carta.js';
import { html } from '../carta/dom.js';
import * as C from '../src/contrato.js';
import * as A from '../src/acciones.js';
import * as modelos from '../src/modelos.js';
import { tabla as tablaDePasos } from '../src/pasos.js';
import { LibroLocal, ESCALA_REGISTRO } from '../src/local.js';
import { EPOCA_0_BTML, cargarEpocaBtml } from '../src/epocas.js';
import { EPOCA_0_BTML_DATOS, REGLAS_DE_EPOCA_DATOS, PLANTILLAS_DE_EPOCA_DATOS, CORRECCIONES_DE_EPOCA_DATOS } from '../datos/epocas/epocas.js';
import { ejemploCompra, ejemploCuenta } from '../ejemplos/ikisai/compra-food.mjs';
import { ejemploReserva } from '../ejemplos/ikisai/reserva-booking.mjs';
import { ejemploTarea } from '../ejemplos/ikisai/tarea-tasks.mjs';

const T1 = '2026-11-08T10:00:00Z';
const MOVIL = { ancho: 400, alto: 700 };
const ORDENADOR = { ancho: 1200, alto: 800 };
const minuto = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });

/** Una copia de la época 0 con un cambio, cargada como la original (misma id: los ejemplos la referencian). */
function epocaCon(cambiar) {
  const e = JSON.parse(JSON.stringify(EPOCA_0_BTML_DATOS));
  const plantillas = JSON.parse(JSON.stringify(PLANTILLAS_DE_EPOCA_DATOS));
  cambiar(e, plantillas);
  return cargarEpocaBtml(e, { registros: REGLAS_DE_EPOCA_DATOS, plantillas, correcciones: CORRECCIONES_DE_EPOCA_DATOS, id: EPOCA_0_BTML.id });
}

async function compra() {
  const c = await ejemploCompra();
  c.cuenta = await ejemploCuenta(c.eje, c.compra);
  return c;
}

test('la carta de la compra en una pantalla alta (400×700) se apila y en una ancha (1200×800) es una matriz; los PV son los de la época', async () => {
  const { eje, compra: X } = await compra();
  const a = await arbol({ foco: { X: X.id, pv: 0 } }, eje, 'huesped', MOVIL);
  const b = await arbol({ foco: { X: X.id, pv: 0 } }, eje, 'huesped', ORDENADOR);
  // La disposición la decide la época por la forma del hueco (epoch.8.3.2): apilada en el móvil, matriz en el ordenador.
  const disposiciones = EPOCA_0_BTML.registro[8][3][2].map((d) => d[0][0]);
  assert.deepEqual([a.disposicion, b.disposicion], disposiciones);
  assert.equal(a.apilada, true);
  assert.equal(b.apilada, false);
  // Los diez puntos de vista de la fila de diez datos (epoch.8.3.1), los laterales en el orden de la época.
  const diez = EPOCA_0_BTML.registro[8][3][1].find((f) => f[0][0] === 10)[1];
  assert.deepEqual(a.pvs, diez);
  assert.deepEqual(a.laterales.map((n) => n.pv), diez.filter((pv) => LATERALES.includes(pv)));
  assert.deepEqual(a.centros, diez.filter((pv) => CENTROS.includes(pv)));
  // El centro: el anverso, con la representación que cabe y un campo por PV lateral con la etiqueta de la plantilla «purchase».
  assert.equal(a.centro.cara, 'anverso');
  assert.equal(a.centro.representacion.texto, 'Compra del menú del día');
  assert.equal(a.centro.etiqueta, C.etiqueta(eje, X.id, 0));
  assert.deepEqual(a.centro.campos.map((c) => c.etiqueta), LATERALES.map((pv) => C.etiqueta(eje, X.id, pv)));
  assert.equal(a.centro.madurez.nombre, C.madurez(eje, X.id).nombre);
  // Cada lateral, comprimido por defecto: un dato (el paso del PV si lo hay, si no cuántos ocupantes), la etiqueta y su lado.
  for (const n of a.laterales) {
    assert.equal(n.nivel, NIVEL.comprimido);
    assert.equal(n.etiqueta, C.etiqueta(eje, X.id, n.pv));
    assert.equal(typeof n.comprimido.dato, 'number');
    assert.equal(n.lado, modelos.cabecera().variantes[GEOMETRIA[n.pv].lado]);
    assert.equal(n.pieza, null, 'en sobrio no hay piezas');
  }
  const orden = a.laterales.find((n) => n.pv === 1);
  assert.equal(orden.comprimido.dato, C.ocupantes(eje, X.id, 1).total);
  const cuota = a.laterales.find((n) => n.pv === 8);
  assert.equal(cuota.comprimido.dato, 9, 'el paso «cuota» del PV8 es el dato comprimido');
  // Mi foco: ocho rosetones de mi alta.
  assert.equal(a.rosetones.length, LATERALES.length);
  assert.ok(a.rosetones.every((r) => r.X === eje.alta('huesped').id));
  // Las identidades y la configuración (los defectos) van en el árbol; sin aro ni formulario abiertos.
  assert.deepEqual(a.identidades.map((i) => i.id), eje.identidades());
  assert.equal(a.configuracion.de, null);
  assert.equal(a.animado, false);
  assert.equal(a.aro, null);
  assert.equal(a.formulario, null);
  // El HTML sale del árbol sin fallar y lleva los dos modos como clase.
  assert.match(html(a), /class="carta carta-apilada sobrio/);
  assert.match(html(b), /class="carta carta-matriz sobrio/);
});

test('los pasos de tamaño: comprimido → tarjeta (los datos que caben) → bloque (la lista o la matriz según la época) → el PV como foco', async () => {
  const { eje, compra: X, cuenta } = await compra();
  const a = await arbol({ foco: { X: X.id, pv: 0 }, niveles: { 1: NIVEL.tarjeta, 2: NIVEL.bloque, 6: NIVEL.bloque, 9: NIVEL.oculto } }, eje, 'huesped', MOVIL);
  const tamanos = C.tamanos();
  const uno = a.laterales.find((n) => n.pv === 1);
  assert.equal(uno.tamano.tamano, tamanos[1].tamano);
  assert.equal(uno.ocupantes.cuantos, tamanos[1].datos, 'la tarjeta pide los datos que caben en ella');
  assert.equal(uno.ocupantes.lista.length, 2);
  assert.equal(uno.ocupantes.lista[1].tipo, 'referencia');
  assert.equal(uno.ocupantes.lista[1].X, cuenta.id);
  assert.equal(uno.ocupantes.lista[1].texto, 'Cuenta del menú');
  assert.equal(uno.ocupantes.orden, C.ocupantes(eje, X.id, 1).orden);
  const dos = a.laterales.find((n) => n.pv === 2);
  assert.equal(dos.tamano.tamano, tamanos[2].tamano);
  assert.ok(C.division(eje, X.id, { datos: 1, forma: { ancho: 400, alto: 350 } }).disposicion === dos.disposicion);
  const seis = a.laterales.find((n) => n.pv === 6);
  assert.equal(seis.diario.total, C.diario(eje, X.id).total, 'el diario de lo llegado va en el PV del pasado');
  assert.equal(a.laterales.find((n) => n.pv === 9).nivel, NIVEL.oculto);
  // Entrar en el PV 1 como foco: el centro es esa posición, paginada, con la disposición que dice la época.
  const b = await arbol({ foco: { X: X.id, pv: 1 } }, eje, 'huesped', MOVIL);
  assert.equal(b.centro.cara, 'pv');
  assert.equal(b.centro.pv, 1);
  assert.equal(b.centro.ocupantes.total, 2);
  assert.ok(C.division(eje, X.id, { datos: 2 }).disposicion !== undefined && b.centro.disposicion);
  // El reverso: cómo encaja (la plantilla, el ancla, lo que valida).
  const c = await arbol({ foco: { X: X.id, pv: CENTROS[1] } }, eje, 'huesped', MOVIL);
  assert.equal(c.centro.cara, 'reverso');
  assert.equal(c.centro.plantilla, 'purchase');
  assert.equal(c.centro.ancla.sobre, X.sobre);
  assert.deepEqual(c.centro.validacion, C.validar(eje, X.id));
});

test('el aro: el de la huésped sobre el menú trae «apply a resource» y «write to X»; el de la casa sobre sus altas, «issue E»; el 0 y el 5 no están', async () => {
  const { eje, menu, alta } = await compra();
  const a = await arbol({ foco: { X: menu.id, pv: 0 }, aro: { X: menu.id, pv: null } }, eje, 'huesped', MOVIL);
  assert.equal(a.aro.X, menu.id);
  assert.deepEqual(a.aro.huecos.map((h) => h.pv), LATERALES);
  const hueco = (pv) => a.aro.huecos.find((h) => h.pv === pv);
  assert.equal(hueco(1).accion.nombre, 'apply a resource');
  assert.ok([hueco(3).accion, ...hueco(3).otras].some((x) => x?.nombre === 'write to X'));
  assert.equal(hueco(1).etiqueta, C.etiqueta(eje, menu.id, 1));
  // Lo que ofrece cada hueco es exactamente lo que da el núcleo, en su orden.
  for (const h of a.aro.huecos) {
    const lista = A.acciones(eje, menu.id, h.pv, 'huesped');
    assert.deepEqual([h.accion?.nombre ?? null, ...h.otras.map((o) => o.nombre)].filter(Boolean), lista.map((x) => x.nombre));
  }
  const b = await arbol({ foco: { X: alta.id, pv: 0 }, aro: { X: alta.id, pv: 1 } }, eje, 'casa', MOVIL);
  const uno = b.aro.huecos.find((h) => h.pv === 1);
  assert.ok([uno.accion, ...uno.otras].some((x) => x?.nombre === 'issue E tied to X'));
  assert.equal(uno.abierto, true, 'el segundo toque despliega las demás');
  // Sobre el menú, la casa no emite (no tiene P sobre él).
  const c = await arbol({ foco: { X: menu.id, pv: 0 }, aro: { X: menu.id, pv: null } }, eje, 'casa', MOVIL);
  assert.ok(!c.aro.huecos.some((h) => [h.accion, ...h.otras].some((x) => x?.nombre === 'issue E tied to X')));
  // La carta lanza por el id de la plantilla (el nombre canónico no va en el marcado: en otro idioma se enseña traducido).
  assert.match(html(a), new RegExp('data-lanzar="' + A.plantillasDeTransaccion().find((p) => p.nombre === 'apply a resource').id + '"'));
  assert.doesNotMatch(html(a), /data-lanzar="apply a resource"/);
});

test('el formulario de «apply a resource» trae la etiqueta, la ayuda, el tipo y la validación de cada parámetro de la plantilla, con los defectos rellenos', async () => {
  const { eje, menu } = await compra();
  const f = formulario(eje, menu.id, 'apply a resource', 'huesped');
  const plantilla = A.plantillaDeTransaccion('apply a resource');
  assert.equal(f.accion, A.plantillasDeTransaccion().find((p) => p.plantilla === plantilla).id, 'la acción, por el id de su plantilla');
  assert.equal(f.nombre, 'apply a resource', 'y su nombre en el idioma de quien mira (en: el canónico)');
  assert.equal(f.pv, 1);
  assert.deepEqual(f.campos.map((c) => c.nombre), A.parametros(plantilla).map((p) => p.nombre));
  const cantidad = f.campos.find((c) => c.nombre === 'quantity');
  assert.deepEqual([cantidad.etiqueta, cantidad.tipo, cantidad.requerido, cantidad.ayuda, cantidad.validacion, cantidad.valor], ['quantity', 'number', true, 'how many units', '=it > 0', 1]);
  const precio = f.campos.find((c) => c.nombre === 'price');
  assert.equal(precio.falta, true, 'el menú no tiene serie: el precio lo da quien lanza');
  assert.deepEqual(f.campos.find((c) => c.nombre === 'what').valor, { ref: menu.id });
  // Con un valor dado, el campo lo lleva; el árbol pinta el formulario con sus motivos.
  const g = formulario(eje, menu.id, 'apply a resource', 'huesped', { quantity: 3 });
  assert.equal(g.campos.find((c) => c.nombre === 'quantity').valor, 3);
  const a = await arbol({ foco: { X: menu.id, pv: 0 }, formulario: { X: menu.id, accion: 'apply a resource', valores: { quantity: 3 }, motivos: [{ regla: 'price', mensaje: 'price: falta' }] } }, eje, 'huesped', MOVIL);
  assert.equal(a.formulario.campos.find((c) => c.nombre === 'quantity').valor, 3);
  assert.deepEqual(a.formulario.motivos, [{ regla: 'price', mensaje: 'price: falta' }]);
  assert.match(html(a), /<form class="formulario" data-formulario/);
  assert.match(html(a), /how many units/);
  assert.equal(formulario(eje, menu.id, 'no existe', 'huesped'), null);
});

test('enviar: una transacción mal formada devuelve los motivos sin asentar nada, en español si la configuración dice language es; una buena se firma y se asienta', async () => {
  const { eje, menu } = await compra();
  const antes = eje.orden.length;
  const mal = await enviar(eje, menu.id, 'apply a resource', { quantity: 0, price: [['E:casa/EUR'], [12]] }, 'huesped', undefined, { t: T1 });
  assert.deepEqual([mal.ok, mal.asentado, mal.motivos.map((m) => m.regla)], [false, null, ['quantity']]);
  assert.equal(eje.orden.length, antes);
  // La cocina pide español en su configuración (un registro «preferences» en el 9 de su alta): los motivos de las reglas llegan traducidos.
  await eje.escribir({ autor: 'cocina', sobre: eje.alta('cocina').id, en: '9000000000', t: T1, movimientos: [minuto('cocina')], payload: ['preferences', 10, 'sober', 'es', [1, 2, 3], 'preferences'] });
  assert.equal(C.configuracion(eje, 'cocina').language, 'es');
  const es = await enviar(eje, menu.id, 'issue E tied to X', { denomination: 'racion', quantity: 5 }, 'cocina', undefined, { t: T1 });
  assert.equal(es.ok, false);
  assert.ok(es.motivos.some((m) => m.regla === 'only persons mint' && m.mensaje === 'only persons mint: cocina es una cosa (su alta la escribió casa), y solo acuñan las personas'), JSON.stringify(es.motivos));
  // Una buena: la huésped da E al menú; «firmar» recibe el evento (aquí lo marca) y el eje lo guarda.
  let firmado = null;
  const bien = await enviar(eje, menu.id, 'apply a resource', { quantity: 1, price: [['E:casa/EUR'], [12]] }, 'huesped', async (ev) => { firmado = ev; return ev; }, { t: T1 });
  assert.equal(bien.ok, true, JSON.stringify(bien.motivos));
  assert.ok(firmado && bien.asentado && eje.obtener(bien.asentado.id));
  assert.equal(eje.orden.length, antes + 2);
  assert.deepEqual(bien.asentado.payload[5], ['purchase']);
});

test('el camino de la compra es el que da el núcleo: cada paso con su fuente, mío o de espera; la reserva abierta tiene pasos míos y de espera', async () => {
  const { eje, compra: X } = await compra();
  const a = await arbol({ foco: { X: X.id, pv: 0 } }, eje, 'huesped', MOVIL);
  const c = await A.camino(eje, X.id, 'huesped');
  assert.equal(a.camino.pasos.length, c.pasos.length);
  assert.deepEqual(a.camino.pasos.map((p) => p.falta), c.pasos.map((p) => p.falta));
  assert.equal(a.camino.niveles, c.niveles ?? null);
  const { eje: b, reserva } = await ejemploReserva({ confirmar: false });
  const r = await arbol({ foco: { X: reserva.id, pv: 0 }, niveles: { 9: NIVEL.bloque } }, b, 'huesped', ORDENADOR);
  assert.ok(r.camino.pasos.some((p) => p.mio), 'la huésped tiene algo que hacer (pagar)');
  assert.ok(r.camino.pasos.some((p) => p.espera), 'y algo que esperar (la casa entrega)');
  const h = html(r);
  assert.match(h, /<section class="camino"/);
  assert.match(h, /data-seguir/);
});

test('el libro local: ver quema un T de segundo y englobar asienta un minuto en el eje; el árbol enseña lo gastado hoy', async () => {
  const { eje, menu, compra: X } = await compra();
  const libro = new LibroLocal(eje, 'huesped');
  const v = libro.ver(menu.id, { t: T1 });
  assert.equal(v.ok, true);
  assert.equal(v.queda, libro.quedaHoy(T1));
  assert.equal(libro.gastadoHoy(T1), 1);
  libro.tocar(X.id, 'nivel 1 2', { t: T1 });
  const a = await arbol({ foco: { X: X.id, pv: 0 }, local: libro }, eje, 'huesped', MOVIL, { t: T1 });
  assert.deepEqual([a.local.gastadoHoy, a.local.pendientes], [2, 2]);
  assert.equal(typeof a.tiempo, 'object');
  const antes = eje.orden.length;
  const ev = await libro.englobar(undefined, { nota: 'un rato en la carta' });
  assert.equal(eje.orden.length, antes + 1);
  assert.deepEqual(ev.payload[7], [ESCALA_REGISTRO]);
  assert.ok(ev.movimientos.some((m) => m.token === 'T' && m.escala === ESCALA_REGISTRO && m.cantidad === 1));
  assert.equal(libro.recorrido().length, 0);
  const b = await arbol({ foco: { X: X.id, pv: 0 }, local: libro }, eje, 'huesped', MOVIL, { t: T1 });
  assert.deepEqual([b.local.pendientes, b.local.anterior], [0, ev.id]);
  assert.match(html(b), /guardar este rato/);
});

test('las preferencias se editan como un registro más: la candidata sale de la plantilla «preferences» y la configuración la lee', async () => {
  const { eje } = await compra();
  const p = preferencias(eje, 'huesped', { language: 'es', step: '5' });
  assert.equal(p.sobre, eje.alta('huesped').id);
  assert.deepEqual(p.campos.map((c) => c.etiqueta), Object.keys(C.configuracion(eje, null)).filter((k) => k !== 'de'));
  await eje.escribir({ autor: 'huesped', sobre: p.sobre, en: p.en, t: T1, movimientos: [minuto('huesped')], payload: p.payload });
  const conf = C.configuracion(eje, 'huesped');
  assert.deepEqual([conf.language, conf.step], ['es', 5]);
  assert.ok(conf.de);
  // Pedir animado: el árbol lo dice y pide piezas a la cadena de modelos (en animado hay pieza; con la cadena sobria, su forma).
  const q = preferencias(eje, 'huesped', { render: 'animated', model: 'animado-generico' });
  await eje.escribir({ autor: 'huesped', sobre: q.sobre, en: q.en, t: T1, movimientos: [minuto('huesped')], payload: q.payload });
  const foco = eje.orden.find((id) => eje.obtener(id).payload?.[0] === 'Compra del menú del día');
  const a = await arbol({ foco: { X: foco, pv: 0 }, niveles: { 1: NIVEL.tarjeta } }, eje, 'huesped', ORDENADOR);
  assert.equal(a.animado, true);
  const uno = a.laterales.find((n) => n.pv === 1);
  assert.ok(uno.pieza && uno.pieza.modelo === 'animado-generico' && uno.pieza.recurso, JSON.stringify(uno.pieza));
  assert.equal(uno.pieza.variante, modelos.cabecera().variantes[GEOMETRIA[1].lado]);
  assert.match(html(a), /pieza-imagen/);
});

test('la carta no lleva constantes de negocio: cambiar la tabla de división o los niveles en una copia de la época cambia el árbol, y en el módulo no hay palabras de la época', async () => {
  const { eje, compra: X } = await compra();
  const base = await arbol({ foco: { X: X.id, pv: 0 } }, eje, 'huesped', MOVIL);
  // La fila de diez datos solo con la X y los dos centros: desaparece la cruz.
  const sinCruz = epocaCon((e) => { e[8][3][1].find((f) => f[0][0] === 10)[1] = [1, 2, 3, 4, 0, 5]; });
  const a = await arbol({ foco: { X: X.id, pv: 0 } }, eje, 'huesped', MOVIL, { epoca: sinCruz });
  assert.deepEqual(a.pvs, [1, 2, 3, 4, 0, 5]);
  assert.deepEqual(a.laterales.map((n) => n.pv), [1, 2, 3, 4]);
  assert.notDeepEqual(a.laterales.map((n) => n.pv), base.laterales.map((n) => n.pv));
  // El umbral de lista frente a matriz al revés: la misma pantalla alta ya no se apila.
  const alReves = epocaCon((e) => { e[8][3][2][0][2] = [100]; e[8][3][2][1][2] = [100]; });
  const b = await arbol({ foco: { X: X.id, pv: 0 } }, eje, 'huesped', MOVIL, { epoca: alReves });
  assert.equal(b.apilada, false);
  // Los niveles con otros nombres: la madurez del centro cambia de nombre.
  const otrosNiveles = epocaCon((e) => { e[8][4][2] = e[8][4][2].map((n) => 'nivel-' + n); e[8][4][4] = e[8][4][4].map((n) => 'nivel-' + n); });
  const c = await arbol({ foco: { X: X.id, pv: 0 } }, eje, 'huesped', MOVIL, { epoca: otrosNiveles });
  assert.equal(c.centro.madurez.nombre, 'nivel-' + base.centro.madurez.nombre);
  // Otras etiquetas en la plantilla «purchase»: el centro y los laterales las siguen.
  const otrasEtiquetas = epocaCon((e) => { e[9][2][1][1][0] = ['pedido']; }); // la plantilla «purchase» de epoch.9.2.1, su 1.0
  const d = await arbol({ foco: { X: X.id, pv: 0 } }, eje, 'huesped', MOVIL, { epoca: otrasEtiquetas });
  assert.equal(d.laterales.find((n) => n.pv === 1).etiqueta, 'pedido');
  assert.equal(d.centro.campos.find((f) => f.pv === 1).etiqueta, 'pedido');
  // Otro paso de paginación y otros tamaños: el bloque y la tarjeta piden lo que dice la época.
  const otroPaso = epocaCon((e) => { e[8][3][3][1] = [3]; e[9][5][2][1][2] = [2]; });
  const f = await arbol({ foco: { X: X.id, pv: 0 }, niveles: { 1: NIVEL.tarjeta, 2: NIVEL.bloque } }, eje, 'huesped', MOVIL, { epoca: otroPaso });
  assert.equal(f.laterales.find((n) => n.pv === 1).ocupantes.cuantos, 2);
  assert.equal(f.laterales.find((n) => n.pv === 2).ocupantes.cuantos, 3);
  // El módulo no lleva escrita ninguna etiqueta, nivel, orden, disposición, tamaño, formato, modo, orientación ni paso de la época.
  const fuente = readFileSync(new URL('../carta/carta.js', import.meta.url), 'utf8');
  const literales = new Set([...fuente.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1]));
  const raiz = EPOCA_0_BTML.registro;
  const palabras = [
    ...raiz[5][0].map((r) => r[0][0]), ...raiz[5][1].map((r) => r[0][0]),
    ...C.niveles(), ...C.ordenes().map((x) => x.nombre), ...raiz[8][3][2].map((x) => x[0][0]), ...C.tamanos().map((t) => t.nombre),
    ...C.plantillas(eje).flatMap((p) => p.registro.filter(Array.isArray).map((d) => d[0]?.[0]).filter((x) => typeof x === 'string')),
    ...raiz[9][5][1].filter((x) => x !== 'ref'), ...C.modos().map((m) => m.nombre), ...modelos.cabecera().variantes, ...modelos.cabecera().niveles,
    ...tablaDePasos().map((f) => f.nombre), ...A.plantillasDeTransaccion().map((p) => p.nombre),
  ];
  for (const p of palabras) assert.ok(!literales.has(p), 'carta/carta.js lleva escrito «' + p + '»');
});

test('los tres ejemplos pintan en los dos modos sin fallar (compra, reserva, tarea), con quien mira en cada uno', async () => {
  const casos = [
    [await compra(), 'compra', 'huesped'],
    [await ejemploReserva(), 'reserva', 'huesped'],
    [await ejemploTarea(), 'tarea', 'organizadora'],
  ];
  for (const [r, clave, yo] of casos) {
    const X = r[clave].id;
    for (const medidas of [MOVIL, ORDENADOR]) {
      const a = await arbol({ foco: { X, pv: 0 }, niveles: Object.fromEntries(LATERALES.map((pv) => [pv, NIVEL.bloque])), aro: { X, pv: null } }, r.eje, yo, medidas);
      assert.equal(a.X, X);
      assert.ok(a.centro.representacion?.texto, clave);
      assert.ok(a.laterales.length >= 4);
      assert.equal(a.aro.huecos.length, LATERALES.length);
      const h = html(a, { leidoTexto: 'x' });
      assert.ok(h.length > 1000);
      assert.doesNotMatch(h, /undefined|\[object Object\]/, clave + ' en ' + medidas.ancho);
    }
  }
});
