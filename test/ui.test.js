// Frontend sobrio (ui/): las piezas que no tocan el DOM se prueban en Node
// con el ejemplo de la compra. Lo que se monta en la página (selectores,
// conmutador, botones) se comprueba en el navegador.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import * as nucleo from '../src/index.js';
import { ejemploCompra, ejemploCuenta } from '../ejemplos/ikisai/compra-food.mjs';
import { epocasDisponibles, epocaActual, elegirEpoca, nombrePV, nombresPV, leerDireccion } from '../ui/epocas.js';
import { listaOcupantes, elegirOrden, ordenOcupantes, procedenciaCorta, lineaEncaje } from '../ui/encaje.js';
import { valoresPropuestos, proponerAhora, cajaPropuesta, contextoConsolidacion, quitarPropuesta, propuestaEnCurso, propuestaVigente } from '../ui/fabrica.js';
import { familiasDe, htmlSaldos, enCarteras, nombreSerie } from '../ui/saldos.js';
import { EJEMPLOS, crearEjemplo, elegirEjemplo, ejemploElegido, cargarModulo, motivoAusente, restaurarEjemplo, etiquetaOpcion } from '../ui/ejemplos.js';
import { dirCorta, vectorCorto, escapar } from '../ui/comun.js';

const { motor, encaje, PV, EPOCA_0 } = nucleo;

async function compra() {
  const { eje, compra: c } = await ejemploCompra();
  const cuenta = await ejemploCuenta(eje, c);
  return { eje, compra: c, cuenta };
}

// ---------- comun ----------

test('comun: direcciones, vectores y escape en corto', () => {
  assert.equal(dirCorta('1200000000'), '1.2');
  assert.equal(dirCorta('0000000000'), 'raíz');
  assert.equal(vectorCorto([0, 0, 0, 0, 2, -1, 0, 0, 0, 0]), '+2 en 4 · −1 en 5');
  assert.equal(vectorCorto([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), '');
  assert.equal(escapar('<a href="x">&'), '&lt;a href=&quot;x&quot;&gt;&amp;');
});

// ---------- épocas ----------

test('épocas: sin EPOCAS en el núcleo solo está la época 0; con EPOCAS, todas, la 0 primero', () => {
  assert.deepEqual(epocasDisponibles({ EPOCA_0 }), [EPOCA_0]);
  const otra = { nombre: 'época de prueba', reglaCorta: () => 'x' };
  assert.deepEqual(epocasDisponibles({ EPOCA_0, EPOCAS: { 'época 0': EPOCA_0, 'época de prueba': otra } }), [EPOCA_0, otra]);
  assert.deepEqual(epocasDisponibles({ EPOCA_0, EPOCAS: { 'época de prueba': otra } }), [EPOCA_0, otra]);
});

test('épocas: los nombres de las posiciones salen de la época elegida, profundidad a profundidad', () => {
  for (const e of epocasDisponibles()) {
    assert.equal(elegirEpoca(e.nombre), e);
    assert.equal(epocaActual(), e);
    for (let p = 0; p < 3; p++) assert.deepEqual(nombresPV(p), PV.map((n, d) => e.reglaCorta(p, d) ?? n));
    assert.deepEqual(leerDireccion('1410000000'), nucleo.leerDireccion('1410000000', e)); // la dirección «en», leída con la elegida
  }
  assert.equal(elegirEpoca('época que no existe'), EPOCA_0);
  assert.deepEqual(nombresPV(0), [...PV]);
  assert.equal(nombrePV(4, 2), PV[4]); // época 0: dígito = PV en todas las profundidades
});

// ---------- encaje en Pointed ----------

test('encaje: cada ocupante enseña su camino, su procedencia, su acuerdo y su signo', async () => {
  const { eje, compra: c, cuenta } = await compra();
  elegirOrden('encaje');
  const html = listaOcupantes(eje, c.id, [1]);
  const oc = encaje.ocupantes(eje, c.id, [1]);
  assert.equal(oc.length, 4);
  assert.equal((html.match(/class="oc-fila"/g) ?? []).length, 4);
  assert.match(html, /camino 1 · acuerdo 10 de 10 · signo exacto/);
  assert.match(html, /camino 1\.0 · acuerdo 10 de 10 · signo exacto/); // la colisión por ceros, con su camino exacto
  assert.ok(html.includes('procedencia ' + c.id.slice(0, 8) + '·1#1.0 → ' + c.payload[1][0].ref.slice(0, 8) + '·1')); // la referencia, con su cadena
  assert.ok(html.includes('procedencia ' + cuenta.id.slice(0, 8) + '·raíz')); // el escrito anclado en el 1
  assert.match(html, /data-orden-ocupantes="encaje" aria-pressed="true"/);
});

test('encaje: el conmutador pasa al orden de llegada sin quitar ocupantes', async () => {
  const { eje, compra: c } = await compra();
  const ids = (html) => [...html.matchAll(/data-ir="([0-9a-f]{64})"/g)].map((m) => m[1]);
  assert.equal(elegirOrden('llegada'), 'llegada');
  const llegada = listaOcupantes(eje, c.id, [1]);
  assert.deepEqual(ids(llegada), encaje.ocupantes(eje, c.id, [1], { orden: 'llegada' }).map((o) => o.evento));
  assert.match(llegada, /data-orden-ocupantes="llegada" aria-pressed="true"/);
  elegirOrden('encaje');
  assert.deepEqual(ids(listaOcupantes(eje, c.id, [1])), encaje.ocupantes(eje, c.id, [1]).map((o) => o.evento));
  assert.equal(elegirOrden('cualquiera'), 'encaje');
  assert.equal(ordenOcupantes(), 'encaje');
  assert.equal(listaOcupantes(eje, c.id, [7]), '<div class="nada">sin ocupantes</div>');
});

test('encaje: un ocupante que no encaja exacto enseña su vector; la procedencia va en corto', () => {
  const o = { camino: [2, 1], acuerdo: 1, signo: 'mixto', vector: [0, 2, -1, 0, 0, 0, 0, 0, 0, 0] };
  assert.equal(lineaEncaje(o), 'camino 2.1 · acuerdo 1 de 10 · signo mixto · vector +2 en 1 · −1 en 2');
  assert.equal(procedenciaCorta(['a'.repeat(64) + ':1000000000#1.0', 'b'.repeat(64) + ':0000000000']), 'aaaaaaaa·1#1.0 → bbbbbbbb·raíz');
});

// ---------- fábrica en Mapped ----------

test('fábrica: proponer rellena el formulario con candidatos de la lista, referencias escritas o terminales', () => {
  const foco = 'f'.repeat(64);
  const otro = 'b'.repeat(64);
  const desc = [
    { posicion: 1, candidatos: [{ tipo: 'propio', evento: foco, dir: '1000000000', camino: [1] }, { tipo: 'propio', evento: foco, dir: '1000000000', camino: [1, 0] }] },
    { posicion: 2, candidatos: [{ tipo: 'escrito', evento: otro, dir: '0000000000', camino: [] }] },
    { posicion: 3, candidatos: [] },
    { posicion: 4, candidatos: [] },
  ];
  const prop = {
    elecciones: {
      1: { ref: foco, dir: '1000000000' }, // contenido literal del foco: su primer camino
      2: { candidato: { evento: otro, dir: '0000000000', tipo: 'escrito' } }, // el escrito de la lista
      3: { candidato: { evento: otro, dir: '2000000000', tipo: 'propio' } }, // de otra posición: referencia escrita
      4: 14, // una fórmula que da un valor: terminal nuevo
      9: 'fuera',
    },
  };
  const { valores, fuera } = valoresPropuestos(desc, prop);
  assert.deepEqual(valores[1], { valor: 'c0', texto: '', como: 'candidato' });
  assert.deepEqual(valores[2], { valor: 'c0', texto: '', como: 'candidato' });
  assert.deepEqual(valores[3], { valor: 'nuevo', texto: '@bbbbbbbb:2000000000', como: 'referencia' });
  assert.deepEqual(valores[4], { valor: 'nuevo', texto: '14', como: 'terminal' });
  assert.deepEqual(fuera, [9]);
  assert.deepEqual(valoresPropuestos(desc, { elecciones: {} }).valores[1], { valor: '', texto: '', como: 'nada' });
});

test('fábrica: la propuesta de la compra elige en el formulario lo que consolidaría proponer, y se retira al consolidar', async () => {
  const { eje, compra: c } = await compra();
  quitarPropuesta();
  assert.equal(cajaPropuesta(eje, c.id, []), '');
  const p = proponerAhora(eje, c.id, []);
  assert.deepEqual(Object.keys(p.prop.elecciones), ['1', '2', '3', '4']);
  for (const i of [1, 2, 3, 4]) assert.equal(p.valores[i].valor, 'c0');
  const caja = cajaPropuesta(eje, c.id, []);
  assert.match(caja, /Propuesta · orígenes y pendientes/);
  assert.match(caja, /<b>1 recursos<\/b> ← del foco/);
  assert.equal(cajaPropuesta(eje, c.id, [1]), ''); // otra profundidad, otra propuesta
  // Lo que el formulario consolidaría con esos valores es lo mismo que consolida la propuesta.
  const desc = motor.descubrir(eje, c.id);
  const elecciones = Object.fromEntries(desc.map((d) => [d.posicion, { candidato: d.candidatos[Number(p.valores[d.posicion].valor.slice(1))] }]));
  const cons = await motor.consolidar(eje, { autor: 'huesped', foco: c.id, elecciones, titulo: 'Desde el formulario', t: '2026-11-07T15:00:00Z' });
  assert.deepEqual(cons.payload.slice(1), Object.values(p.prop.elecciones));
  assert.equal(cajaPropuesta(eje, c.id, []), ''); // ya se usó
  assert.equal(propuestaEnCurso(), null);
});

test('fábrica: si el eje crece después de proponer, la propuesta se recalcula; si el eje es otro, se retira', async () => {
  const { eje, compra: c } = await compra();
  quitarPropuesta();
  const antes = proponerAhora(eje, c.id, []);
  assert.equal(antes.registros, eje.orden.length);
  assert.equal(propuestaVigente(eje, c.id, []), antes); // nada ha cambiado: la misma
  assert.doesNotMatch(cajaPropuesta(eje, c.id, []), /recalculada/);
  // Un escrito nuevo en el 2 del foco: cambian los candidatos de 2 y lo que el formulario debe marcar sale de ahora, no de cuando se pidió.
  await eje.escribir({ autor: 'cocina', sobre: c.id, en: '2000000000', t: '2026-11-07T14:20:00Z', movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'cocina', a: null }], payload: ['Otro criterio'] });
  assert.equal(motor.descubrir(eje, c.id)[1].candidatos.length, motor.descubrir(eje, c.id)[1].candidatos.filter((x) => x.tipo !== 'escrito').length + 1);
  const ahora = propuestaVigente(eje, c.id, []);
  assert.ok(ahora && ahora.recalculada);
  assert.equal(ahora.registros, eje.orden.length);
  assert.deepEqual(ahora.valores, valoresPropuestos(motor.descubrir(eje, c.id), motor.proponer(eje, c.id)).valores);
  assert.deepEqual(ahora.prop, motor.proponer(eje, c.id));
  assert.match(cajaPropuesta(eje, c.id, []), /recalculada: el eje ha cambiado desde que se pidió/);
  // Otro eje (otro ejemplo, un reinicio), aunque el foco se llame igual: la propuesta no es suya.
  const { eje: otro } = await compra();
  assert.equal(propuestaVigente(otro, c.id, []), null);
  assert.equal(propuestaEnCurso(), null);
});

test('fábrica: cada consolidación enseña de dónde vino cada fuente y, si existen, sus terminales nuevos', async () => {
  const { eje, compra: c } = await compra();
  const p = motor.proponer(eje, c.id);
  const cons = await motor.consolidar(eje, { autor: 'huesped', foco: c.id, elecciones: p.elecciones, t: '2026-11-07T15:00:00Z' });
  const html = contextoConsolidacion(eje, cons.id);
  assert.match(html, /de dónde vino cada fuente/);
  for (const i of [1, 2, 3, 4]) assert.ok(html.includes(`<b>${i}</b> ← referencia <button class="enlace" data-ir="${c.id}">${c.id.slice(0, 8)}</button> desde ${i} a ${i} · exacto`));
  const conNuevos = { obtener: () => ({ contexto: { encaje: [{ posicion: 1, evento: c.id, tipo: 'propio', origen: '1200000000', destino: '1000000000', vector: [0, 2, 0, 0, 0, 0, 0, 0, 0, 0] }], nuevos: [{ posicion: 2, destino: '2000000000' }] } }) };
  const otro = contextoConsolidacion(conNuevos, 'x');
  assert.match(otro, /de dónde vino cada fuente · y lo nuevo/);
  assert.match(otro, /desde 1\.2 a 1 · reducir · vector \+2 en 1/);
  assert.match(otro, /<b>2<\/b> terminal nuevo, sin fuente · a 2/);
  assert.match(contextoConsolidacion({ obtener: () => ({ contexto: {} }) }, 'x'), /sin fuentes en su contexto/);
});

// ---------- saldos ----------

test('saldos: las series de cada identidad en corto y las series emitidas con lo que queda en carteras', async () => {
  const { eje } = await compra();
  const casa = familiasDe(eje, 'casa');
  assert.deepEqual(casa.E, ['440 €']);
  assert.deepEqual(casa.P, ['10 sobre eje']);
  assert.equal(casa.T.length, 2);
  assert.match(casa.T[0], / h$/); // de la escala mayor a la menor
  assert.deepEqual(familiasDe(eje, 'cocina').E, ['12 € de casa']);
  assert.deepEqual(familiasDe(eje, 'huesped').R, []);
  const minutos = eje.identidades().reduce((s, id) => s + eje.saldoT(id, 'minuto'), 0);
  assert.equal(enCarteras(eje, 'T:minuto'), minutos);
  assert.ok(minutos < eje.serie('T:minuto').emitido); // escribir consume minutos
  assert.equal(nombreSerie(eje.series().find((s) => s.token === 'E')), 'casa/€');
  const html = htmlSaldos(eje);
  assert.match(html, /<details class="series-emitidas" data-plegado="series" open>/);
  assert.match(html, /Series emitidas · 4 \(T 2 · E 1 · P 1\)/);
  assert.equal((html.match(/class="cartera"/g) ?? []).length, 3);
  assert.ok(html.includes(`<td><b>T</b> minuto</td><td>casa</td><td>1000</td><td>${minutos}</td>`));
  assert.ok(html.indexOf('<b>T</b> hora') < html.indexOf('<b>T</b> minuto'));
});

test('saldos: muchas series no alargan la pantalla: ids en corto, el resto plegado', () => {
  const id = 'a'.repeat(64);
  const series = Array.from({ length: 12 }, (_, k) => ({ clave: 'E:casa/' + id + '.1000000000@2026-11-' + (10 + k), token: 'E', serie: 'casa/x', emisor: 'casa', denominacion: id + '.1000000000@2026-11-' + (10 + k), emitido: 1 }));
  const eje = {
    identidades: () => ['casa'],
    tiempos: () => [],
    recursos: () => series.map((x) => ({ emisor: 'casa', denominacion: x.denominacion, cantidad: 1 })),
    poderes: () => [],
    reputaciones: () => [],
    clave: () => null,
    tipo: () => 'grupo',
    saldo: () => 1,
    series: () => series,
  };
  const html = htmlSaldos(eje);
  assert.ok(!html.includes(id));
  assert.ok(html.includes('1 aaaaaaaa.1000000000@2026-11-10'));
  assert.match(html, /<summary>\+9 de E<\/summary>/);
  assert.match(html, /<details class="series-emitidas" data-plegado="series" >/); // doce series: la tabla empieza plegada
});

// ---------- ejemplos ----------

const RAIZ_UI = new URL('../ui/ejemplos.js', import.meta.url);
const importarDesdeUI = (ruta) => import(new URL(ruta, RAIZ_UI).href);

test('ejemplos: comida, reserva y tarea, cada uno con sus identidades', () => {
  assert.deepEqual(EJEMPLOS.map((x) => [x.id, x.etiqueta]), [['compra', 'comida'], ['reserva', 'reserva'], ['tarea', 'tarea']]);
  for (const x of EJEMPLOS) assert.ok(x.identidades.includes(x.identidad));
});

test('ejemplos: la comida se construye con claves para quien firma', async () => {
  elegirEjemplo('compra');
  const estado = { claves: {}, identidad: 'huesped', aviso: '' };
  const { eje, foco } = await crearEjemplo(estado, { importar: importarDesdeUI });
  assert.equal(eje.obtener(foco).payload[0], 'Compra del menú del día');
  assert.deepEqual(Object.keys(estado.claves).sort(), ['casa', 'cocina', 'huesped']);
  assert.equal(estado.identidad, 'huesped');
  assert.equal(estado.aviso, '');
  assert.ok(eje.obtener(foco).firma);
});

test('ejemplos: si el módulo de un ejemplo falta, se avisa y sigue la comida; nada se rompe', async () => {
  elegirEjemplo('tarea');
  const estado = { claves: {}, identidad: 'huesped', aviso: '' };
  const noEsta = () => Promise.reject(Object.assign(new Error('Cannot find module'), { code: 'ERR_MODULE_NOT_FOUND' }));
  const sinTarea = (ruta) => (ruta.includes('tarea') ? noEsta() : importarDesdeUI(ruta));
  const { eje, foco } = await crearEjemplo(estado, { importar: sinTarea });
  assert.equal(eje.obtener(foco).payload[0], 'Compra del menú del día');
  assert.equal(ejemploElegido(), 'compra');
  assert.match(estado.aviso, /«tarea» aún no está en este repositorio \(llega con la PR #34\)\. Sigue la comida\./);
  assert.equal(await cargarModulo(EJEMPLOS[1], () => Promise.reject(new TypeError('Failed to fetch dynamically imported module'))), null);
  assert.match(motivoAusente('reserva'), /aún no está en este repositorio \(llega con la PR #21\)/);
  // Un módulo que está pero pide al núcleo algo que aún no tiene: se dice el motivo real.
  assert.equal(await cargarModulo(EJEMPLOS[1], () => Promise.reject(new SyntaxError("does not provide an export named 'capacidadDe'"))), null);
  assert.match(motivoAusente('reserva'), /no carga con este núcleo: .*capacidadDe/);
  assert.equal(elegirEjemplo('desconocido'), 'compra');
});

test('ejemplos: la opción dice de qué PR llega antes de pedirla; si no estaba, «no disponible»; si cargó, solo su nombre', async () => {
  assert.equal(etiquetaOpcion(EJEMPLOS[0]), 'comida');
  const def = { ...EJEMPLOS[2], id: 'prueba-opcion' }; // un ejemplo aún sin pedir en esta sesión
  assert.equal(etiquetaOpcion(def), 'tarea (PR #34)');
  assert.equal(await cargarModulo(def, () => Promise.reject(new TypeError('Failed to fetch dynamically imported module'))), null);
  assert.equal(etiquetaOpcion(def), 'tarea (no disponible)');
  assert.ok(await cargarModulo(def, () => Promise.resolve({})));
  assert.equal(etiquetaOpcion(def), 'tarea');
});

test('ejemplos: al abrir un eje guardado, una identidad que exista en él', async () => {
  const { eje } = await compra();
  const estado = { identidad: 'organizadora' };
  elegirEjemplo('compra');
  restaurarEjemplo(eje, estado);
  assert.equal(estado.identidad, 'huesped');
});

for (const x of EJEMPLOS.slice(1)) {
  const ruta = fileURLToPath(new URL(x.modulo, RAIZ_UI));
  test('ejemplos: «' + x.etiqueta + '» se construye si su módulo está en el repositorio', { skip: existsSync(ruta) ? false : 'llega con la PR #' + x.pr }, async () => {
    elegirEjemplo(x.id);
    const estado = { claves: {}, identidad: 'huesped', aviso: '' };
    const { eje, foco } = await crearEjemplo(estado, { importar: importarDesdeUI });
    assert.equal(estado.aviso, '');
    assert.equal(ejemploElegido(), x.id);
    assert.ok(eje.obtener(foco));
    for (const id of x.identidades) assert.ok(eje.identidades().includes(id), id);
    assert.ok(eje.identidades().includes(estado.identidad));
    elegirEjemplo('compra');
  });
}
