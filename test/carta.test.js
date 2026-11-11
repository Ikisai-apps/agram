// La carta, versión 1 (carta/carta.js): el árbol de la carta sin navegador, sobre los ejemplos. Comprueba que la carta
// no decide nada: lo que pinta sale del contrato (la división, las etiquetas, los tamaños, la madurez), del aro
// (acciones), del camino, del libro local y de la época; cambiar la tabla de división o los niveles en una copia de la
// época cambia el árbol, y en el módulo no hay escrita ninguna palabra de la época.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { arbol, formulario, enviar, preferencias, escalaDeTamanos, NIVEL, LATERALES, CENTROS, GEOMETRIA, ANIMAR } from '../carta/carta.js';
import { html, htmlPieza, variablesDeColor } from '../carta/dom.js';
import * as C from '../src/contrato.js';
import * as A from '../src/acciones.js';
import * as modelos from '../src/modelos.js';
import { tabla as tablaDePasos } from '../src/pasos.js';
import { LibroLocal, ESCALA_REGISTRO } from '../src/local.js';
import { EPOCA_0_BTML, cargarEpocaBtml, REGISTROS_DE_MODELOS } from '../src/epocas.js';
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
  return cargarEpocaBtml(e, { registros: [...REGLAS_DE_EPOCA_DATOS, ...REGISTROS_DE_MODELOS], plantillas, correcciones: CORRECCIONES_DE_EPOCA_DATOS, id: EPOCA_0_BTML.id });
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
  // Cada lateral, comprimido por defecto (su fila cerrada): un dato (el paso del PV si lo hay, si no cuántos ocupantes), la
  // etiqueta y su lado; los del hilo (el pasado y el futuro), en bloque: van encima y debajo de la tarjeta.
  for (const n of a.laterales) {
    assert.equal(n.nivel, n.hilo ? NIVEL.bloque : NIVEL.comprimido);
    assert.equal(n.etiqueta, C.etiqueta(eje, X.id, n.pv));
    assert.equal(typeof n.comprimido.dato, 'number');
    assert.equal(n.lado, modelos.cabecera().variantes[GEOMETRIA[n.pv].lado]);
    assert.equal(n.pieza, null, 'en sobrio no hay piezas');
  }
  const orden = a.laterales.find((n) => n.pv === 1);
  assert.equal(orden.comprimido.dato, C.ocupantes(eje, X.id, 1).total);
  const cuota = a.laterales.find((n) => n.pv === 8);
  assert.equal(cuota.comprimido.dato, 9, 'el paso «cuota» del PV8 es el dato comprimido');
  // Mi foco: diez rosetones de mi alta, uno por PV (el 0 y el 5 incluidos), en el ordenador; en el móvil en vertical, ninguno.
  assert.deepEqual(b.rosetones.map((r) => r.pv), [1, 2, 0, 3, 4, 6, 7, 5, 8, 9]);
  assert.ok(b.rosetones.every((r) => r.X === eje.alta('huesped').id));
  assert.deepEqual(a.rosetones, []);
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

test('las filas del móvil: cerrada (comprimido) → abierta (bloque, con el segundo nivel del PV) → el PV como foco; el diario va en el pasado', async () => {
  const { eje, compra: X, cuenta } = await compra();
  const a = await arbol({ foco: { X: X.id, pv: 0 }, niveles: { 1: NIVEL.bloque, 2: NIVEL.tarjeta } }, eje, 'huesped', MOVIL);
  const tamanos = C.tamanos();
  const fila = (pv) => a.secuencia.filas.find((f) => f.pv === pv);
  const uno = fila(1).nodo;
  assert.equal(fila(1).abierta, true);
  assert.equal(uno.nivel, NIVEL.bloque);
  assert.equal(uno.tamano.tamano, tamanos[2].tamano);
  assert.equal(uno.ocupantes.cuantos, C.paso(), 'abierta, pide el paso de la configuración');
  assert.equal(uno.ocupantes.lista.length, 2);
  assert.equal(uno.ocupantes.lista[1].tipo, 'referencia');
  assert.equal(uno.ocupantes.lista[1].X, cuenta.id);
  assert.equal(uno.ocupantes.lista[1].texto, 'Cuenta del menú');
  assert.equal(uno.ocupantes.orden, C.ocupantes(eje, X.id, 1).orden);
  // Lo que se ve dentro es el segundo nivel del PV, como en Mapped: la forma de su mundo (epoch.8.7) con sus hijos.
  assert.equal(uno.rejilla.forma, C.divisionDelMundo(eje, 1).forma);
  assert.deepEqual(uno.rejilla.celdas.map((c) => c.nombre), C.hijosDe(eje, X.id, 1, { nivel: 1, cuantos: 0 }).map((h) => h.nombre));
  // La tarjeta (un paso de antes) también cuenta como abierta; las demás, cerradas.
  assert.equal(fila(2).abierta, true);
  assert.equal(fila(2).nodo.nivel, NIVEL.bloque);
  assert.equal(fila(3).abierta, false);
  assert.equal(a.secuencia.pasado.diario.total, C.diario(eje, X.id).total, 'el diario de lo llegado va en el pasado');
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
  // Todas las preferencias de la época, también las que no tienen defecto (el servidor y el eje compartido, etapa 3).
  assert.deepEqual(p.campos.map((c) => c.etiqueta), C.clavesDeConfiguracion().map((c) => c.clave));
  assert.ok(Object.keys(C.configuracion(eje, null)).filter((k) => k !== 'de').every((k) => p.campos.some((c) => c.clave === k)));
  assert.equal(p.payload.length, 8, 'sin servidor ni eje compartido, el registro acaba en el 7: BTML no tiene posiciones vacías');
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

/** La huésped pide el animado con el modelo de la fase 2 (ikisai) en sus preferencias. */
async function animadoConIkisai(eje, quien = 'huesped', mas = {}) {
  const p = preferencias(eje, quien, { render: 'animated', model: 'ikisai', ...mas });
  await eje.escribir({ autor: quien, sobre: p.sobre, en: p.en, t: T1, movimientos: [minuto(quien)], payload: p.payload });
}

test('el animado entero (etapa 5): cada PV lleva su etapa por madurez y orientación, su marco, en bloque su fondo y su personaje del rol por defecto; los ocupantes, su elemento; el aro, los iconos en sello', async () => {
  const { eje, compra: X, menu, cuenta } = await compra();
  await animadoConIkisai(eje);
  const todos = Object.fromEntries(LATERALES.map((pv) => [pv, NIVEL.bloque]));
  const a = await arbol({ foco: { X: X.id, pv: 0 }, niveles: { ...todos, 2: NIVEL.tarjeta, 3: NIVEL.comprimido }, nuevos: new Set() }, eje, 'huesped', ORDENADOR);
  assert.equal(a.animado, true);
  assert.equal(a.limite, 10, 'el tope de animaciones, el defecto de la época (la preferencia «animations»)');
  const madurez = C.madurez(eje, X.id);
  const c = modelos.cabecera();
  const cadena = modelos.modelo(eje, 'huesped');
  for (const n of a.laterales) {
    const lado = GEOMETRIA[n.pv].lado;
    // La etapa: la del modelo para «madurez.nivel de madurez.de», con la orientación de su lado (la cruz solo tiene centro: la de respaldo).
    const esperada = modelos.pieza(cadena, 'etapa', n.pv, madurez.nivel, c.variantes[lado], { tamano: n.tamano.tamano, de: madurez.de });
    assert.equal(n.etapa.recurso, esperada.recurso, 'etapa del PV ' + n.pv);
    assert.equal(n.etapa.clave, 8, 'la madurez 11 de 15 reescalada a las diez etapas');
    assert.equal(n.etapa.variante, GEOMETRIA[n.pv].grupo === 'x' ? c.variantes[lado] : c.variantes[0]);
    assert.equal(n.etapa.tamano, n.nivel === NIVEL.comprimido ? 1 : 2, 'el sello en comprimido, el intermedio en tarjeta y bloque');
    assert.ok(n.etapa.recurso.includes('/etapa/etapa-08-'), n.etapa.recurso);
    // El marco: el del mundo del PV, en el 5 del modelo.
    assert.equal(n.marco.recurso, modelos.pieza(cadena, 'marco', 5, n.pv, c.variantes[0], { tamano: n.tamano.tamano }).recurso);
    assert.equal(n.marco.clave, n.pv);
    if (n.nivel >= NIVEL.bloque) {
      // El fondo (la etapa 5, la inferior más cercana a la 8) y el personaje del rol por defecto del mundo, esperando en bucle.
      assert.ok(n.fondo.recurso.includes('/fondo/fondo-05-'), 'fondo del PV ' + n.pv);
      assert.deepEqual([n.personaje.rol, n.personaje.accion, n.personaje.animar], [modelos.rolPorDefecto(c, 'munequito', n.pv), 'esperar', ANIMAR.bucle]);
      assert.equal(n.personaje.pieza.rol, n.personaje.rol);
      assert.equal(n.personaje.pieza.formato, 'lottie');
      assert.equal(n.munequito, n.personaje.pieza);
    } else if (n.nivel === NIVEL.tarjeta) {
      assert.equal(n.fondo, undefined, 'sin fondo en tarjeta');
      assert.equal(n.personaje.animar, ANIMAR.no, 'en tarjeta el personaje está parado');
    } else {
      assert.equal(n.personaje, undefined, 'en comprimido no hay personaje');
    }
    assert.equal(n.nuevos, null, 'nada nuevo: sin efectos');
  }
  // Los ocupantes: el elemento del mundo; un registro referenciado, por su madurez; una hoja, la comodín.
  const uno = a.laterales.find((n) => n.pv === 1);
  const ref = uno.ocupantes.lista.find((o) => o.tipo === 'referencia' && o.X === cuenta.id);
  assert.ok(ref.elemento?.recurso.includes('/ciudad/elemento/'), JSON.stringify(ref.elemento));
  assert.equal(ref.elemento.tamano, 2);
  // El centro: el marco neutro (la comodín del 5).
  assert.equal(a.centro.marco.clave, modelos.CUALQUIERA);
  assert.ok(a.centro.marco.recurso.includes('/comun/marco/'));
  // El aro: el icono de cada mundo en sello.
  const b = await arbol({ foco: { X: menu.id, pv: 0 }, aro: { X: menu.id, pv: null } }, eje, 'huesped', MOVIL);
  for (const h of b.aro.huecos) {
    assert.equal(h.icono.clave, h.pv, 'icono del hueco ' + h.pv);
    assert.equal(h.icono.tamano, 1);
    assert.ok(h.icono.recurso.endsWith('-sello.svg'));
  }
  // El HTML: el escenario con su fondo, su etapa, su personaje, el marco, el elemento del ocupante, el tope de animaciones.
  const h = html(a);
  assert.match(h, /data-animaciones="10"/);
  assert.match(h, /<div class="escenario" data-escenario><img class="pieza pieza-fondo pieza-imagen"[^>]*><img class="pieza pieza-etapa pieza-imagen"[^>]*><div class="pieza pieza-personaje accion-esperar pieza-lottie" data-lottie="arte\/fase2\/bloque-2\/[^"]+" data-fotograma="\d+" data-animar="1" data-bucle="1" data-prioridad="1"/);
  assert.match(h, /<img class="pieza pieza-marco pieza-imagen" src="\.\/arte\/fase2\/bloque-5\/biblioteca\/ciudad\/marco\/marco-centro-intermedio\.svg"/);
  assert.match(h, /pieza-elemento/);
  assert.doesNotMatch(h, /undefined|\[object Object\]/);
  // Un PV abierto como foco lleva su escenario entero.
  const f = await arbol({ foco: { X: X.id, pv: 4 }, nuevos: new Set() }, eje, 'huesped', MOVIL);
  assert.equal(f.centro.cara, 'pv');
  assert.equal(f.centro.etapa.clave, 8);
  assert.ok(f.centro.fondo.recurso && f.centro.personaje.animar === ANIMAR.bucle);
  assert.match(html(f), /<section class="nucleo abierto[^>]*>\s*<header[^]*?<div class="escenario"/);
});

test('el animado anima lo que pasa: un movimiento nuevo del diario reproduce una vez el efecto de su primitiva (la correspondencia de la cabecera) y el personaje actúa; el ciclo que se cierra celebra; el tope de animaciones es un dato', async () => {
  const { eje, menu } = await compra();
  await animadoConIkisai(eje);
  // La huésped aplica un recurso al menú: la transacción cuelga del 0 del menú → en la carta del menú, el centro.
  const r = await enviar(eje, menu.id, 'apply a resource', { quantity: 1, price: [['E:casa/EUR'], [12]] }, 'huesped', undefined, { t: T1 });
  assert.equal(r.ok, true);
  const c = modelos.cabecera();
  const a = await arbol({ foco: { X: menu.id, pv: 0 }, nuevos: new Set([r.asentado.id]) }, eje, 'huesped', ORDENADOR);
  assert.deepEqual(a.centro.nuevos.entradas, [r.asentado.id]);
  // Lo que la transacción hace: transferir los euros (el T que cuesta escribir y la obtención de P no son efectos).
  assert.deepEqual(a.centro.nuevos.efectos.map((e) => [e.primitiva, e.clave]), [['transferir', modelos.corresponde(c, 'movimiento', 'transferir', 1)]]);
  assert.ok(a.centro.nuevos.efectos[0].pieza.recurso.endsWith('/transferir-centro-intermedio.json'));
  assert.equal(a.centro.consumido, false);
  assert.match(html(a), /<div class="pieza pieza-efecto efecto-transferir pieza-lottie" data-lottie="[^"]+" data-fotograma="0" data-animar="1" data-bucle="0" data-prioridad="0"/);
  // Sin marcarla como nueva, nada se anima.
  const b = await arbol({ foco: { X: menu.id, pv: 0 }, nuevos: new Set() }, eje, 'huesped', ORDENADOR);
  assert.equal(b.centro.nuevos, null);
  // Una emisión de E por la casa sobre su alta: acuñar → crear-abajo en la X, crear-pasado si el mundo es el pasado (la correspondencia por mundo).
  assert.equal(modelos.corresponde(c, 'movimiento', 'acunar', 1), 'crear-abajo');
  assert.equal(modelos.corresponde(c, 'movimiento', 'acunar', 6), 'crear-pasado');
  // Una escritura en el PV 3 del menú (cuelga de su 3): el personaje del 3 actúa una vez; lo demás sigue esperando.
  const ev = await eje.escribir({ autor: 'huesped', sobre: menu.id, en: '3000000000', t: T1, movimientos: [minuto('huesped')], payload: ['nota'] });
  const d = await arbol({ foco: { X: menu.id, pv: 0 }, niveles: { 3: NIVEL.bloque, 4: NIVEL.bloque }, nuevos: new Set([ev.id]) }, eje, 'huesped', ORDENADOR);
  const tres = d.laterales.find((n) => n.pv === 3);
  assert.deepEqual([tres.personaje.accion, tres.personaje.animar], ['actuar', ANIMAR.una]);
  assert.ok(tres.personaje.pieza.recurso.includes('-actuar-centro-'));
  assert.deepEqual(tres.nuevos.entradas, [ev.id]);
  assert.deepEqual(tres.nuevos.efectos, [], 'solo quema el T de escribir: ningún efecto');
  assert.equal(d.laterales.find((n) => n.pv === 4).personaje.accion, 'esperar');
  // La reserva confirmada: el ciclo del PV 4 llega a su «de» (4 de 4) → celebra una vez.
  const { eje: b2, reserva } = await ejemploReserva();
  await animadoConIkisai(b2);
  const e = await arbol({ foco: { X: reserva.id, pv: 0 }, niveles: { 4: NIVEL.bloque, 1: NIVEL.bloque }, nuevos: new Set() }, b2, 'huesped', MOVIL);
  const cuatro = e.laterales.find((n) => n.pv === 4);
  assert.deepEqual([cuatro.paso.k, cuatro.paso.de], [4, 4]);
  assert.deepEqual([cuatro.personaje.accion, cuatro.personaje.animar, cuatro.personaje.rol], ['celebrar', ANIMAR.una, modelos.rolPorDefecto(c, 'munequito', 4)]);
  assert.equal(e.laterales.find((n) => n.pv === 1).personaje.accion, 'esperar');
  assert.match(html(e), /pieza-personaje accion-celebrar pieza-lottie" data-lottie="[^"]+" data-fotograma="\d+" data-animar="1" data-bucle="0" data-prioridad="0"/);
  // El tope: la preferencia «animations» de quien mira.
  await animadoConIkisai(b2, 'huesped', { animations: '3' });
  const f = await arbol({ foco: { X: reserva.id, pv: 0 } }, b2, 'huesped', MOVIL);
  assert.equal(f.limite, 3);
  assert.match(html(f), /data-animaciones="3"/);
  // htmlPieza: parada, en bucle o una vez; una forma sobria sigue siendo una forma.
  const pieza = cuatro.personaje.pieza;
  assert.match(htmlPieza(pieza, { animar: ANIMAR.no }), /data-animar="0" data-bucle="0"/);
  assert.match(htmlPieza(pieza, { animar: ANIMAR.bucle }), /data-animar="1" data-bucle="1"/);
  assert.match(htmlPieza(pieza, { animar: true, prioridad: 1 }), /data-animar="1" data-bucle="1" data-prioridad="1"/);
  assert.match(htmlPieza({ tipo: 'fondo', forma: 'rectangulo' }), /class="pieza forma forma-rectangulo"/);
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
  // Otro paso de paginación: las filas abiertas y el hilo piden lo que dice la época.
  const otroPaso = epocaCon((e) => { e[8][3][3][1] = [3]; });
  const f = await arbol({ foco: { X: X.id, pv: 0 }, niveles: { 1: NIVEL.tarjeta, 2: NIVEL.bloque } }, eje, 'huesped', MOVIL, { epoca: otroPaso });
  assert.equal(f.laterales.find((n) => n.pv === 1).ocupantes.cuantos, 3);
  assert.equal(f.laterales.find((n) => n.pv === 2).ocupantes.cuantos, 3);
  assert.equal(f.secuencia.futuro.ocupantes.cuantos, 3);
  // Otro rol por defecto de la ciudad en una copia de la cabecera (epoch.9.7.0.4): el personaje del PV 1 cambia de rol.
  await animadoConIkisai(eje);
  const otroRol = epocaCon((e) => { e[9][7][0][4][1][2][0] = [[1], ['comprador']]; });
  const g = await arbol({ foco: { X: X.id, pv: 0 }, niveles: { 1: NIVEL.bloque } }, eje, 'huesped', ORDENADOR, { epoca: otroRol });
  const h = await arbol({ foco: { X: X.id, pv: 0 }, niveles: { 1: NIVEL.bloque } }, eje, 'huesped', ORDENADOR);
  assert.deepEqual([h.laterales.find((n) => n.pv === 1).personaje.rol, g.laterales.find((n) => n.pv === 1).personaje.rol], ['vendedor', 'comprador']);
  assert.ok(g.laterales.find((n) => n.pv === 1).personaje.pieza.recurso.includes('/comprador-esperar-'));
  // Otro tope de animaciones por defecto en la época (9.3.7): la carta lo sigue.
  const otroTope = epocaCon((e) => { e[9][3][7][9][0] = 4; });
  assert.equal((await arbol({ foco: { X: X.id, pv: 0 } }, eje, 'casa', ORDENADOR, { epoca: otroTope })).limite, 4, 'quien no ha escrito preferencias sigue el defecto de la época');
  assert.equal((await arbol({ foco: { X: X.id, pv: 0 } }, eje, 'huesped', ORDENADOR, { epoca: otroTope })).limite, 10, 'quien las escribió, las suyas');
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

// ---------- el color por punto de vista (VG, 10-11: también en sobrio, como pincelada) ----------

const nav = (h, clase) => { const i = h.indexOf('<nav class="rosetones ' + clase + '"'); return i < 0 ? '' : h.slice(i, h.indexOf('</nav>', i)); };
const pvsDe = (trozo) => [...trozo.matchAll(/data-roseton="(\d)"/g)].map((m) => Number(m[1]));

test('los colores de los PV son datos de la época (epoch.9.5.4): la carta los lee, los pasa a variables CSS y cambiarlos en una copia los cambia', async () => {
  const { eje, compra: X } = await compra();
  const oficial = { 0: '#FFFFFF', 1: '#FFC91D', 2: '#65BF4D', 3: '#40CCD9', 4: '#EF5353', 5: '#161A24', 6: '#D58D4E', 7: '#9762D8', 8: '#17396F', 9: '#AE7447' };
  assert.deepEqual(C.colores(), oficial);
  const a = await arbol({ foco: { X: X.id, pv: 0 } }, eje, 'huesped', MOVIL);
  assert.deepEqual(a.colores, oficial);
  const v = variablesDeColor(a.colores);
  assert.equal(v['--pv-1'], '#FFC91D');
  assert.equal(v['--pv-1-rgb'], '255 201 29');
  assert.equal(Object.keys(v).length, 20);
  // Cambiar el 2 en una copia de la época cambia la variable; sin paleta, no hay color (y no se rompe nada).
  const otra = epocaCon((e) => { e[9][5][4][2] = [[2], ['#123456']]; });
  assert.equal(C.colores({ epoca: otra })[2], '#123456');
  const b = await arbol({ foco: { X: X.id, pv: 0 } }, eje, 'huesped', MOVIL, { epoca: otra });
  assert.equal(variablesDeColor(b.colores)['--pv-2'], '#123456');
  const sin = epocaCon((e) => { e[9][5].length = 4; });
  assert.deepEqual(C.colores({ epoca: sin }), {});
  assert.doesNotMatch(html(await arbol({ foco: { X: X.id, pv: 0 } }, eje, 'huesped', MOVIL, { epoca: sin })), /undefined|\[object Object\]/);
  // Nada de hex en la hoja de estilo ni en el pintado: los colores salen de la época.
  for (const f of ['../carta/estilo.css', '../carta/dom.js']) {
    const fuente = readFileSync(new URL(f, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const hex = fuente.match(/#[0-9a-fA-F]{6}/g) ?? [];
    if (f.endsWith('.css')) assert.ok(hex.every((h) => !Object.values(oficial).includes(h.toUpperCase())), 'la paleta no está en ' + f + ': ' + hex);
    else assert.deepEqual(hex, [], f);
  }
});

test('cada ocupante que es una referencia lleva el data-pv del dígito de su posición en su padre, a cualquier profundidad (1 → 4 → 2…); el foco es el 0 y su reverso el 5', async () => {
  const c = await ejemploTarea();
  // En Mapped, cada PV en el primer paso con espacio (la tarjeta: la lista de sus ocupantes con sus anidados).
  const niveles = Object.fromEntries(LATERALES.map((pv) => [pv, escalaDeTamanos().conEspacio]));
  const a = await arbol({ foco: { X: c.tarea.id, pv: 0 }, niveles, anidar: 4 }, c.eje, 'huesped', ORDENADOR);
  // El árbol: cada referencia anidada trae el dígito del grupo que la contiene; se reúnen las cadenas.
  const cadenas = [];
  const refs = [];
  const recorrer = (o, camino) => {
    if (o.tipo !== 'referencia') return;
    const aqui = [...camino, o.pv];
    cadenas.push(aqui);
    refs.push(o.pv);
    for (const g of o.anidados) for (const x of g.lista) { if (x.tipo === 'referencia') assert.equal(x.pv, g.pv, 'una referencia lleva el dígito de su grupo'); recorrer(x, aqui); }
  };
  for (const n of a.laterales) for (const o of n.ocupantes?.lista ?? []) { assert.equal(o.pv, n.pv, 'en su PV, el ocupante ocupa el PV que lo lista'); recorrer(o, []); }
  const larga = cadenas.reduce((m, x) => (x.length > m.length ? x : m), []);
  assert.ok(larga.length >= 3, 'hay un anidamiento de al menos tres niveles: ' + larga.join('→'));
  // El HTML: cada referencia pintada lleva su data-pv (cuenta por dígito igual que el árbol), también las anidadas.
  const h = html(a);
  const porDigito = (xs) => xs.reduce((m, d) => ({ ...m, [d]: (m[d] ?? 0) + 1 }), {});
  const pintados = [...h.matchAll(/class="ocupante ocupante-ref"[^>]*? data-pv="(\d)"/g)].map((m) => Number(m[1]));
  assert.deepEqual(porDigito(pintados), porDigito(refs));
  assert.ok(larga.slice(1).some((d, i) => d !== larga[i]), 'la cadena cambia de dígito al anidar: ' + larga.join('→'));
  // El foco: el anverso es el 0 y el reverso el 5 (data-centro, que el CSS pinta).
  assert.match(h, /class="nucleo anverso[^"]*"[^>]* data-centro="0"/);
  const r = html(await arbol({ foco: { X: c.tarea.id, pv: 5 } }, c.eje, 'huesped', MOVIL));
  assert.match(r, /class="nucleo reverso[^"]*"[^>]* data-centro="5"/);
  // Un PV (cualquier tamaño) lleva el suyo; y la época decide el color de cada uno (no hay hex aquí).
  for (const n of a.laterales) assert.match(h, new RegExp(`<section class="pv pv-${n.pv} [^>]*data-pv="${n.pv}"`));
  assert.doesNotMatch(h, /#[0-9a-fA-F]{6}/);
});

// ---------- Sequenced: el móvil en vertical (VG, 11-11: «el hilo es el scroll, la tarjeta es un acordeón») ----------

const trozoDe = (h, inicio, fin) => { const i = h.indexOf(inicio); return i < 0 ? '' : h.slice(i, fin ? h.indexOf(fin, i) : undefined); };

test('Sequenced: el árbol apilado trae las diez filas con su PV, cerradas por defecto, en el orden de sus dígitos; las del hilo no se abren', async () => {
  const { eje, compra: X } = await compra();
  const a = await arbol({ foco: { X: X.id, pv: 0 } }, eje, 'huesped', MOVIL);
  assert.deepEqual(a.secuencia.filas.map((f) => f.pv), [...a.pvs].sort((p, q) => p - q));
  assert.deepEqual(a.secuencia.filas.map((f) => f.pv), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  for (const f of a.secuencia.filas) {
    assert.equal(f.etiqueta, C.etiqueta(eje, X.id, f.pv), 'la etiqueta del ' + f.pv);
    assert.equal(f.total, C.ocupantes(eje, X.id, f.pv).total);
    assert.equal(f.abierta, false, 'cerrada por defecto: ' + f.pv);
    if (f.hilo) assert.equal(f.nodo, null);
    else assert.equal(f.nodo.nivel, NIVEL.comprimido);
  }
  assert.deepEqual(a.secuencia.filas.filter((f) => f.hilo).map((f) => [f.pv, f.hilo]), [[6, 'antes'], [7, 'despues']]);
  // Abrir una que es del hilo no la abre: el 6 y el 7 llevan al pasado y al futuro.
  const b = await arbol({ foco: { X: X.id, pv: 0 }, niveles: { 6: NIVEL.bloque, 7: NIVEL.bloque } }, eje, 'huesped', MOVIL);
  assert.ok(b.secuencia.filas.filter((f) => f.hilo).every((f) => !f.abierta));
  // El HTML: la tarjeta con sus filas (cada cabeza abre la suya, data-fila) y el campo de cada PV; sin contenido abierto.
  const h = html(a);
  const filas = trozoDe(h, '<ol class="filas">', '</ol>');
  assert.deepEqual([...filas.matchAll(/data-fila="(\d)"/g)].map((m) => Number(m[1])), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.match(filas, /data-fila="1" data-x="[^"]+" aria-expanded="false"/);
  assert.match(filas, /data-fila="6" data-x="[^"]+" data-hilo="antes"/);
  assert.match(filas, /data-campo="1"/);
  assert.doesNotMatch(h, /class="fila-contenido"/);
  // Otra época sin la cruz: menos filas, sin hilo.
  const sinCruz = epocaCon((e) => { e[8][3][1].find((f) => f[0][0] === 10)[1] = [1, 2, 3, 4, 0, 5]; });
  const c = await arbol({ foco: { X: X.id, pv: 0 } }, eje, 'huesped', MOVIL, { epoca: sinCruz });
  assert.deepEqual(c.secuencia.filas.map((f) => f.pv), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual([c.secuencia.pasado, c.secuencia.futuro], [null, null]);
});

test('Sequenced: abrir una fila (NIVEL.bloque) trae debajo el segundo nivel del PV, con la regla del vacío; nunca la lista cruda con ∅', async () => {
  const { eje, alta } = await compra();
  // Un foco con 1-8 vacíos (el alta del fin de semana, de la casa): lo que se ve son los hijos con su nombre y «escribir aquí».
  const abiertas = { 0: NIVEL.bloque, 1: NIVEL.bloque, 2: NIVEL.bloque, 3: NIVEL.bloque, 4: NIVEL.bloque, 5: NIVEL.bloque, 8: NIVEL.bloque, 9: NIVEL.bloque };
  const a = await arbol({ foco: { X: alta.id, pv: 0 }, niveles: abiertas }, eje, 'casa', MOVIL);
  const fila = (pv) => a.secuencia.filas.find((f) => f.pv === pv);
  for (const pv of [1, 2, 3, 4, 8, 9]) {
    const n = fila(pv).nodo;
    assert.equal(fila(pv).abierta, true);
    assert.equal(n.nivel, NIVEL.bloque);
    assert.equal(n.rejilla.forma, C.divisionDelMundo(eje, pv).forma, 'la forma del mundo del ' + pv);
  }
  // La cruceta del 1: los cuatro hijos en una columna (no caben a lo ancho) y la tarjeta del elemento pulsado.
  const uno = fila(1).nodo.rejilla;
  assert.equal(uno.enColumna, true);
  assert.ok(uno.flotante && uno.flotante.X === alta.id);
  assert.ok(uno.celdas.some((c) => c.vacio && c.escribir?.nombre), 'un hijo vacío con su paso del camino');
  // El 8 y el 9: las diez cajas nivel.grado (la cuota y el camino).
  assert.equal(fila(8).nodo.rejilla.bandas.length, 10);
  assert.equal(fila(9).nodo.rejilla.camino, true);
  // El 5 (sin división de mundo) y vacío: la regla del vacío, no la lista.
  assert.equal(fila(5).nodo.rejilla ?? null, null);
  assert.equal(fila(5).nodo.vacio, true);
  const h = html(a);
  const dentro = [...h.matchAll(/<div class="fila-contenido"[^>]*>/g)].length;
  assert.equal(dentro, 8);
  assert.match(h, /escribir aquí · /);
  assert.match(h, /class="rejilla rejilla-apilada en-columna" data-rejilla="1" data-forma="cruceta"/);
  assert.match(trozoDe(h, 'data-rejilla="1"'), /^[^]*?<div class="centro-flotante"[^]*?<div class="rejilla-celdas rejilla-cruceta" style="--columnas:1;/, 'la tarjeta del pulsado, arriba de los hijos');
  assert.doesNotMatch(trozoDe(h, '<ol class="filas">'), /class="nada">∅/, 'sin la lista cruda vacía');
  // El 9 abierto: las posiciones, el camino y la guía (solo lectura) dentro de la fila.
  const nueve = trozoDe(h, 'id="fila-9-contenido"', '</li>');
  assert.match(nueve, /data-forma="camino"/);
  assert.match(nueve, /<section class="camino"/);
  assert.doesNotMatch(h, /undefined|\[object Object\]/);
  // Entrar en un hijo (estado.profundidad) y subir, como en Mapped.
  const { eje: e2, compra: X } = await compra();
  const r1 = (await arbol({ foco: { X: X.id, pv: 0 }, niveles: { 1: NIVEL.bloque } }, e2, 'huesped', MOVIL)).secuencia.filas.find((f) => f.pv === 1).nodo.rejilla;
  const hijo = r1.celdas.flatMap((c) => c.ocupantes).find((o) => o.entra);
  assert.ok(hijo, 'algo en lo que entrar en el 1');
  const b = await arbol({ foco: { X: X.id, pv: 0 }, niveles: { 1: NIVEL.bloque }, profundidad: { 1: [hijo.X] } }, e2, 'huesped', MOVIL);
  const r2 = b.secuencia.filas.find((f) => f.pv === 1).nodo.rejilla;
  assert.deepEqual([r2.nivel, r2.X], [2, hijo.X]);
  assert.match(html(b), /data-subir="1"/);
  assert.match(html(await arbol({ foco: { X: X.id, pv: 0 }, niveles: { 1: NIVEL.bloque } }, e2, 'huesped', MOVIL)), new RegExp(`data-celda="${hijo.X}"`));
});

test('Sequenced: el pasado encima de la tarjeta y el futuro debajo, por páginas con el paso de la configuración («cargar más»)', async () => {
  const { eje, compra: X } = await compra();
  // Tres escritos en el 6 y tres en el 7 de la compra.
  for (const [en, n] of [['6000000000', 3], ['7000000000', 3]]) for (let i = 0; i < n; i++) await eje.escribir({ autor: 'huesped', sobre: X.id, en, t: T1, movimientos: [minuto('huesped')], payload: ['nota ' + en[0] + '.' + i] });
  const paso1 = epocaCon((e) => { e[8][3][3][1] = [1]; });
  const a = await arbol({ foco: { X: X.id, pv: 0 } }, eje, 'huesped', MOVIL, { epoca: paso1 });
  const { pasado, futuro } = a.secuencia;
  assert.deepEqual([pasado.pv, pasado.hilo, futuro.pv, futuro.hilo], [6, 'antes', 7, 'despues']);
  assert.equal(pasado.ocupantes.total, 3);
  assert.equal(pasado.ocupantes.lista.length, 1, 'una página: el paso de la época');
  assert.equal(futuro.ocupantes.lista.length, 1);
  assert.ok(pasado.cargarMas && futuro.cargarMas);
  assert.equal(futuro.faltan, 2);
  // Una página más (estado.paginas, lo que hace «cargar más»).
  const b = await arbol({ foco: { X: X.id, pv: 0 }, paginas: { 6: 2, 7: 3 } }, eje, 'huesped', MOVIL, { epoca: paso1 });
  assert.equal(b.secuencia.pasado.ocupantes.lista.length, 2);
  assert.equal(b.secuencia.futuro.ocupantes.lista.length, 3);
  assert.equal(b.secuencia.futuro.cargarMas, false);
  // El HTML: el pasado, la tarjeta y el futuro, en ese orden; «cargar más» arriba del pasado y abajo del futuro.
  const h = html(a);
  const sec = trozoDe(h, '<div class="secuencia"');
  const [p, n, f] = [sec.indexOf('data-hilo-zona="6"'), sec.indexOf('class="nucleo anverso'), sec.indexOf('data-hilo-zona="7"')];
  assert.ok(p > 0 && p < n && n < f, 'pasado, tarjeta, futuro');
  const zonaP = trozoDe(sec, 'data-hilo-zona="6"', '</section>');
  assert.ok(zonaP.indexOf('data-cargar-mas="6"') < zonaP.indexOf('class="pv-cabeza hilo-cabeza"'), 'en el pasado, cargar más arriba y la cabeza junto a la tarjeta');
  const zonaF = trozoDe(sec, 'data-hilo-zona="7"', '</section>');
  assert.ok(zonaF.indexOf('class="pv-cabeza hilo-cabeza"') < zonaF.indexOf('data-cargar-mas="7"'), 'en el futuro, la cabeza junto a la tarjeta y cargar más abajo');
});

test('Sequenced: sin rosetones ni franja de comprimidos; la fila fija de los diez dígitos; la barra en una línea con «menú»; Mapped no cambia', async () => {
  const { eje, compra: X } = await compra();
  const a = await arbol({ foco: { X: X.id, pv: 0 } }, eje, 'huesped', MOVIL);
  const m = html(a, { ejemplos: [{ id: 'compra', etiqueta: 'la compra' }], ejemplo: 'compra' });
  assert.deepEqual(a.rosetones, []);
  assert.doesNotMatch(m, /class="rosetones|data-roseton=/);
  assert.doesNotMatch(m, /class="franja|data-franja|class="comprimido"/);
  // Los dígitos: los diez, en su orden y su color.
  assert.deepEqual(a.secuencia.digitos.map((d) => d.pv), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const digitos = trozoDe(m, '<nav class="digitos"', '</nav>');
  assert.deepEqual([...digitos.matchAll(/data-digito="(\d)" data-color="(\d)"/g)].map((x) => [Number(x[1]), Number(x[2])]), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => [d, d]));
  // La barra: quién soy, el interruptor y «menú» en una línea; lo demás dentro del menú, oculto hasta abrirlo.
  const barra = trozoDe(m, '<header class="barra barra-compacta"', '</header>');
  const linea = trozoDe(barra, '<div class="barra-linea">', '<div class="barra-menu"');
  assert.match(linea, /data-quien/);
  assert.match(linea, /class="interruptor"/);
  assert.match(linea, /data-menu aria-expanded="false"/);
  assert.doesNotMatch(linea, /data-ejemplo|data-config|data-reiniciar/);
  assert.match(barra, /<div class="barra-menu" id="barra-menu" hidden>[^]*data-ejemplo[^]*data-config[^]*data-reiniciar/);
  assert.match(html(a, { menu: true }), /data-menu aria-expanded="true"[^]*<div class="barra-menu" id="barra-menu">/);
  // Mapped: ni la secuencia ni los dígitos ni el menú; sus rosetones en su sitio.
  const b = await arbol({ foco: { X: X.id, pv: 0 } }, eje, 'huesped', ORDENADOR);
  assert.equal(b.secuencia, undefined);
  const g = html(b);
  assert.doesNotMatch(g, /class="digitos"|data-menu|class="secuencia"|class="filas"/);
  assert.match(g, /<nav class="rosetones rosetones-mapa"/);
});
