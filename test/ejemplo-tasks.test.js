import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ejemploTarea, decuplaTarea, movimientosDeEjecucion, tiempoPrevisto,
  FECHA_LIMITE, PARTIDAS, DIR_COSTE, DIR_TIEMPO,
} from '../ejemplos/ikisai/tarea-tasks.mjs';
import { Eje } from '../src/eje.js';
import { resolver, indicesDe, esReferencia } from '../src/btml.js';
import { evaluar, consultar } from '../src/bql.js';
import { ocupantes } from '../src/encaje.js';
import { proponer, consolidar, autorizar, ejecutar, estadoDe, consolidaciones } from '../src/motor.js';
import { escribirDesde } from '../src/escritura.js';
import { ejeTemporal } from '../src/tiempo.js';
import { situar } from '../src/bases.js';
import { generarClaves } from '../src/autoridad.js';

/** La serie de E de una partida: la emite la casa, que la respalda. */
const serie = (concepto) => 'E:casa/' + concepto;

/** Un presupuesto donde la tarea dice que busca (su 5), como lo escribe el proveedor (o cualquiera). */
const presupuesto = (eje, tarea, t, payload, autor = 'proveedor') =>
  escribirDesde(eje, { modo: 'sequenced', autor, sobre: tarea.id, en: tarea.payload[5], t, payload });

/** Cuántos presupuestos (escritos) colisionan en los recursos: una consulta; no ocupa posición en la tarea. */
const recibidos = (eje, tarea) => consultar(eje, tarea.id, [9], 'CONTAR(FILTRAR(BUSCAR(1), ORIGEN() = "escrito"))').texto;

/** Los presupuestos que caben en coste y en plazo: la fórmula del 9 sin su ELEGIR. */
const CABEN = 'FILTRAR(FILTRAR(BUSCAR(1), ORIGEN() = "escrito"), Y(ACTUAL(1) <= LOCAL(1, 1), ACTUAL(2) <= LOCAL(2, 1)))';

test('ejemplo Tasks: saldos por serie; escribir cuesta minutos y solo quien trabaja consume horas', async () => {
  const { eje, tarea, entrega } = await ejemploTarea();
  assert.deepEqual(eje.identidades(), ['casa', 'organizadora', 'proveedor']);
  // E por serie de la casa, una por partida. El pago sale de las de la carpa; la tarima sigue en la casa.
  const E = (id) => PARTIDAS.map(([concepto]) => eje.saldo(id, serie(concepto)));
  assert.deepEqual(E('casa'), [0, 0, 0, 120]);
  assert.deepEqual(E('organizadora'), [0, 0, 40, 0]);
  assert.deepEqual(E('proveedor'), [250, 60, 0, 0]);
  // P por ámbito: la casa conserva su poder sobre todo el eje. Autorizar no lo gasta: lo bloquea, y ejecutada la
  // tarea la casa lo libera (VG, 7-11 noche: autorizar = bloquear P con el umbral del dueño).
  assert.deepEqual(eje.poderes('casa'), [{ ambito: 'genesis', cantidad: 10 }]);
  assert.deepEqual(eje.bloqueos('casa'), []);
  assert.deepEqual(eje.poderes('organizadora'), []);
  assert.deepEqual(eje.poderes('proveedor'), []);
  // T por escala: minutos para escribir, horas para trabajar.
  const T = (id) => [eje.saldoT(id, 'minuto'), eje.saldoT(id, 'hora')];
  assert.deepEqual(T('casa'), [405, 140]); // la liberación de su P, un minuto más
  // Integración 7-11: con #42 ejecutar cuesta un minuto por posición escrita (3: título, consolidación y autorización), no uno fijo.
  assert.deepEqual(T('organizadora'), [74, 40]);
  assert.deepEqual(T('proveedor'), [50, 14]);
  // Todo registro tras el génesis cuesta minutos a su autor; solo la entrega consume horas, y son del proveedor.
  for (const id of eje.orden.slice(1)) {
    const ev = eje.obtener(id);
    assert.ok(ev.movimientos.some((m) => m.token === 'T' && m.escala === 'minuto' && m.de === ev.autor && m.a === null), 'sin minutos: ' + id.slice(0, 8));
  }
  const consumoHoras = eje.orden.map((id) => eje.obtener(id)).filter((ev) => ev.movimientos.some((m) => m.token === 'T' && m.escala === 'hora' && m.a === null));
  assert.deepEqual(consumoHoras.map((ev) => [ev.id, ev.autor]), [[entrega.id, 'proveedor']]);
  // Los minutos no se pagan con horas: al proveedor le quedan 50 minutos y 14 horas, y un registro de 80 minutos se rechaza.
  await assert.rejects(
    eje.escribir({
      autor: 'proveedor',
      sobre: tarea.id,
      t: '2026-11-13T19:00:00Z',
      movimientos: [{ token: 'T', escala: 'minuto', cantidad: 80, de: 'proveedor', a: null }],
      payload: 'ochenta minutos',
    }),
    /saldo insuficiente de T:minuto en proveedor/,
  );
});

test('etapas: «hasta» detiene el ejemplo en su último registro', async () => {
  for (const [hasta, ultima, siguiente] of [
    ['tarea', 'limite', 'presupuestos'],
    ['presupuestos', 'presupuestos', 'consolidacion'],
    ['consolidada', 'consolidacion', 'autorizacion'],
    ['autorizada', 'autorizacion', 'entrega'],
    ['entregada', 'entrega', 'ejecucion'],
  ]) {
    const r = await ejemploTarea({ hasta });
    assert.equal(r[siguiente], undefined, hasta + ': sobra ' + siguiente);
    assert.equal(r.eje.orden.at(-1), [r[ultima]].flat().at(-1).id, hasta + ': el eje no acaba en ' + ultima);
  }
  await assert.rejects(ejemploTarea({ hasta: 'otra' }), /etapa desconocida/);
});

test('partidas: cada una es una posición con capacidad respaldada por una serie limitada de E de quien la escribe', async () => {
  const { eje, partidas, tarea } = await ejemploTarea({ hasta: 'tarea' });
  PARTIDAS.forEach((_, k) => {
    // Del registro: el concepto (1.k.0) da la denominación y el importe (1.k.1), la capacidad.
    const concepto = evaluar(eje, partidas.id, [1, k + 1, 0]).valor.valor;
    const importe = evaluar(eje, partidas.id, [1, k + 1, 1]).valor;
    assert.equal(importe.unidad, 'EUR');
    // Del eje: la serie es de quien escribe las partidas, y lleva emitido tanto como la capacidad.
    assert.deepEqual(eje.serie('E:' + partidas.autor + '/' + concepto), { emisor: 'casa', emitido: importe.cantidad });
    // R2 (VG, 7-11 noche): las emite el génesis, así que van atadas a él; el importe de la partida es capacidad de
    // una POSICIÓN (la del motor, que solo informa), no de un registro: sin tope en el eje, deuda del emisor.
    const s = eje.series().find((x) => x.clave === 'E:casa/' + concepto);
    assert.deepEqual([s.registro, s.tope, s.nota], [eje.genesisId, null, 'sin capacidad declarada: deuda del emisor']);
  });
  // La organizadora tiene en E exactamente el coste total de su tarea: las series de sus partidas y nada más.
  const coste = evaluar(eje, tarea.id, indicesDe(DIR_COSTE)).valor;
  const suyo = eje.recursos('organizadora');
  assert.ok(suyo.every((x) => x.emisor === 'casa'));
  assert.deepEqual([suyo.reduce((s, x) => s + x.cantidad, 0), coste.unidad], [coste.cantidad, 'EUR']);
});

test('hilo y fórmulas: las partidas se referencian, no se copian; coste, tiempo y composición', async () => {
  const { eje, alta, partidas, tarea, consolidacion, ejecucion } = await ejemploTarea();
  assert.deepEqual(eje.hilo(ejecucion.id).map((e) => e.id), [ejecucion.id, consolidacion.id, tarea.id, partidas.id, alta.id, eje.genesisId]);
  // 1.0: las partidas de la tarea son referencias; su importe vive en el registro de partidas.
  const refs = tarea.payload[1][0].slice(1);
  assert.ok(refs.every((x) => esReferencia(x) && x.ref === partidas.id));
  assert.deepEqual(refs.map((x) => resolver(eje.obtener(x.ref).payload, x.dir)), ['250 EUR', '60 EUR', '40 EUR']);
  // 1.1 coste total = suma de las partidas, con su desglose y sus dependencias.
  const coste = evaluar(eje, tarea.id, indicesDe(DIR_COSTE));
  assert.equal(coste.texto, '350 EUR (250 EUR + 60 EUR + 40 EUR)');
  assert.ok(coste.dependencias.includes(partidas.id + ':1110000000'));
  // 4.1 tiempo previsto = suma de los pasos en horas.
  assert.equal(tiempoPrevisto(eje, tarea.id).texto, '7 h (1 h + 2 h + 3 h + 1 h)');
  // 8 composición «EUR + horas»: dos partes que no se funden.
  const comp = evaluar(eje, tarea.id, [8]);
  assert.equal(comp.valor.tipo, 'composicion');
  assert.deepEqual(comp.valor.partes.map((p) => [p.cantidad, p.unidad]), [[350, 'EUR'], [7, 'h']]);
  assert.equal(comp.valor.partes[0].desglose.length, 3);
  // El defecto de BQL que esta prueba fijaba (el operando derecho perdía su desglose) lo corrigió #36: cada valor sumado conserva el suyo.
  assert.deepEqual(comp.valor.partes[1].desglose, [{ cantidad: 1, unidad: 'h' }, { cantidad: 2, unidad: 'h' }, { cantidad: 3, unidad: 'h' }, { cantidad: 1, unidad: 'h' }]);
  assert.equal(comp.texto, '350 EUR (250 EUR + 60 EUR + 40 EUR) + 7 h (1 h + 2 h + 3 h + 1 h)');
  assert.equal(consultar(eje, tarea.id, [8], '(1 EUR + 2 EUR) + (3 EUR + 4 EUR)').texto, '10 EUR (1 EUR + 2 EUR + 3 EUR + 4 EUR)');
});

test('encaje de la dirección 1: lo propio y los presupuestos colisionan; corregir es añadir un ocupante', async () => {
  const { eje, tarea, presupuestos: [caro, corregido] } = await ejemploTarea({ hasta: 'presupuestos' });
  const oc = ocupantes(eje, tarea.id, [1]);
  // VG, 7-11 noche: por hojas. 1.0 = ['Partidas', ref, ref, ref] es una lista: cada elemento es un ocupante
  // propio en el camino de la lista (1 y 1.0 son el mismo lugar), con su índice; lo que alcanzan las tres
  // referencias (los importes, en 1.k.1 de las partidas) va al final, porque no encaja exacto.
  assert.deepEqual(oc.map((o) => o.origen), ['propio', 'propio', 'propio', 'propio', 'propio', 'escrito', 'escrito', 'referencia', 'referencia', 'referencia']);
  assert.deepEqual(oc.slice(0, 7).map((o) => o.camino), [[1], [1, 0], [1, 0], [1, 0], [1, 0], [], []]);
  assert.deepEqual(oc.slice(1, 5).map((o) => [o.enLista, o.indice]), [[true, 0], [true, 1], [true, 2], [true, 3]]);
  assert.deepEqual(oc.slice(7).map((o) => o.contenido), ['250 EUR', '60 EUR', '40 EUR']);
  // La corrección no sustituye al original: los dos quedan, por orden de llegada.
  assert.deepEqual(oc.slice(5, 7).map((o) => o.evento), [caro.id, corregido.id]);
  // Lo propio y lo escrito, exactos, con diez profundidades de acuerdo: entre los escritos ordena la llegada.
  assert.ok(oc.slice(0, 7).every((o) => o.signo === 'exacto' && o.acuerdo === 10));
  assert.equal(recibidos(eje, tarea), '2');
  // El 9 se queda con el primero que cabe: el caro (420 EUR > 350 EUR) sigue ahí, pero no cabe.
  assert.deepEqual(evaluar(eje, tarea.id, [9]).valor.items.map((i) => i.evento), [corregido.id]);
  // Sin el criterio de coste y plazo, decide la llegada: el caro primero.
  assert.equal(consultar(eje, tarea.id, [9], 'ELEGIR(FILTRAR(BUSCAR(1), ORIGEN() = "escrito"))').valor.items[0].evento, caro.id);
});

test('proponer: sin presupuestos el 9 no propone; el caro no cabe en coste, el lento no cabe en plazo; el corregido sí', async () => {
  const { eje, tarea } = await ejemploTarea({ hasta: 'tarea' });
  const vacia = proponer(eje, tarea.id, { posiciones: [1, 2, 3, 4, 8, 9] });
  assert.deepEqual(vacia.pendientes, [{ posicion: 9, motivo: 'sin candidatos' }]);
  assert.deepEqual(Object.keys(vacia.elecciones).map(Number), [1, 2, 3, 4, 8]);
  assert.deepEqual(vacia.elecciones[1], { ref: tarea.id, dir: '1000000000' }); // lo literal, por referencia al foco
  // Solo el caro: el 9 sigue sin candidatos.
  await presupuesto(eje, tarea, '2026-11-07T17:00:00Z', ['Presupuesto: carpa con suelo de madera', '420 EUR', '5 h', 'proveedor']);
  assert.deepEqual(proponer(eje, tarea.id, { posiciones: [9] }).pendientes, [{ posicion: 9, motivo: 'sin candidatos' }]);
  // El plazo también decide: uno barato que tarda 9 h no cabe en las 8 h de la tarea.
  await presupuesto(eje, tarea, '2026-11-07T18:00:00Z', ['Presupuesto: sin prisa', '200 EUR', '9 h', 'proveedor']);
  assert.deepEqual(evaluar(eje, tarea.id, [9]).valor.items, []);
  assert.equal(recibidos(eje, tarea), '2');

  const r = await ejemploTarea({ hasta: 'consolidada' });
  const p = r.propuesta;
  assert.deepEqual(p.origenes.map((o) => [o.posicion, o.desde]), [[1, 'foco'], [2, 'foco'], [3, 'foco'], [4, 'foco'], [8, 'formula'], [9, 'formula']]);
  assert.equal(p.elecciones[9].candidato.evento, r.presupuestos[1].id);
  assert.equal(typeof p.elecciones[8], 'string'); // la composición entra como terminal
  assert.deepEqual(p.pendientes, []);
});

test('[X] decidir VG: preferir la corrección; si el original también cabe, el 9 elige por llegada el original', async () => {
  // Con ORIGEN y la llegada, la fórmula solo puede quedarse con el primero que cabe:
  // BQL no lee ni el autor ni la llegada de un candidato, ni toma el último de una colección.
  const { eje, tarea } = await ejemploTarea({ hasta: 'tarea' });
  const original = await presupuesto(eje, tarea, '2026-11-07T17:00:00Z', ['Presupuesto: carpa con suelo de madera', '340 EUR', '5 h', 'proveedor']);
  const corregido = await presupuesto(eje, tarea, '2026-11-08T09:30:00Z', ['Presupuesto corregido: carpa sin suelo', '310 EUR', '6 h', 'proveedor']);
  // Los dos caben en coste y en plazo, por orden de llegada, y el 9 elige el original.
  assert.deepEqual(consultar(eje, tarea.id, [9], CABEN).valor.items.map((i) => i.evento), [original.id, corregido.id]);
  assert.deepEqual(evaluar(eje, tarea.id, [9]).valor.items.map((i) => i.evento), [original.id]);
});

test('[X] decidir VG: quién puede ocupar una posición de recursos ajena; el 9 no lo mira, el pago del ejemplo sí', async () => {
  const { eje, tarea } = await ejemploTarea({ hasta: 'tarea' });
  // La casa escribe un «presupuesto» en los recursos de la tarea de la organizadora: cabe y llega primero.
  const ajeno = await presupuesto(eje, tarea, '2026-11-07T16:00:00Z', ['yo mismo', '349 EUR', '1 h', 'casa'], 'casa');
  await presupuesto(eje, tarea, '2026-11-08T09:30:00Z', ['Presupuesto corregido: carpa sin suelo', '310 EUR', '6 h', 'proveedor']);
  const p = proponer(eje, tarea.id, { posiciones: [1, 2, 3, 4, 8, 9] });
  assert.equal(p.elecciones[9].candidato.evento, ajeno.id);
  const c = await consolidar(eje, { autor: 'organizadora', foco: tarea.id, t: '2026-11-08T10:00:00Z', elecciones: p.elecciones });
  // La casa autoriza una consolidación cuya fuente es suya: la regla V0 solo mira el autor de la consolidación.
  await autorizar(eje, { autorizante: 'casa', consolidacion: c.id, t: '2026-11-08T11:00:00Z' });
  assert.equal(estadoDe(eje, c.id), 'AUTORIZADO');
  // El ejemplo no paga a quien no está en el 3 de la tarea.
  assert.throws(() => movimientosDeEjecucion(eje, c.id, tarea.id), /casa no cobra/);
  // A mano, el núcleo sí acepta el pago a quien autoriza.
  await ejecutar(eje, { autor: 'organizadora', consolidacion: c.id, t: '2026-11-13T18:00:00Z', movimientos: [{ token: 'E', emisor: 'casa', denominacion: PARTIDAS[0][0], cantidad: 250, de: 'organizadora', a: 'casa' }] });
  assert.equal(estadoDe(eje, c.id), 'EJECUTADO');
});

test('[X] decidir VG: una nota terminal en 1 deja la elección PENDIENTE', async () => {
  // Cualquiera con minutos puede escribir en los recursos de la tarea. Un
  // terminal no tiene posición 1, ACTUAL(1) para la consulta entera y el 9
  // deja de proponer: falta una política de candidatos pendientes.
  const { eje, tarea } = await ejemploTarea({ hasta: 'presupuestos' });
  await escribirDesde(eje, { modo: 'pointed', autor: 'proveedor', sobre: tarea.id, en: tarea.payload[5], t: '2026-11-08T09:40:00Z', payload: 'llamadme antes de las 9' });
  assert.equal(recibidos(eje, tarea), '3');
  assert.equal(evaluar(eje, tarea.id, [9]).estado, 'PENDIENTE');
  assert.deepEqual(proponer(eje, tarea.id, { posiciones: [9] }).pendientes.map((x) => x.posicion), [9]);
});

test('ciclo: consolidar → la casa autoriza con P → ejecutar paga en las series de las partidas, sin pasar del coste', async () => {
  const { eje, tarea, presupuestos: [caro, corregido], consolidacion: c } = await ejemploTarea({ hasta: 'consolidada' });
  assert.deepEqual(c.contexto.fuentes, [tarea.id, corregido.id]);
  assert.deepEqual(c.payload.slice(1, 8), [1, 2, 3, 4, 5, 6, 7].map((i) => ({ ref: tarea.id, dir: i + '000000000' }))); // 5–7 heredadas
  assert.deepEqual(c.payload[9], { ref: corregido.id, dir: '0000000000' });
  assert.deepEqual(consolidaciones(eje, tarea.id).map((x) => x.estado), ['PENDIENTE DE AUTORIZACIÓN']);
  // [X] decidir VG: el encaje del 9 guarda el vector de la búsqueda (todo ceros) aunque el presupuesto viene del 1 y se coloca en el 9.
  const e9 = c.contexto.encaje.find((x) => x.posicion === 9);
  assert.deepEqual([e9.origen, e9.destino, e9.signo], ['1000000000', '9000000000', 'exacto']);
  // [X] decidir VG: la composición consolidada es texto; BQL ya no la lee como composición.
  assert.equal(evaluar(eje, c.id, [8]).valor.tipo, 'texto');

  const T = '2026-11-08T11:00:00Z';
  await assert.rejects(ejecutar(eje, { autor: 'organizadora', consolidacion: c.id, t: T }), /PENDIENTE DE AUTORIZACIÓN/);
  // Autoriza el P sobre el registro del recurso (aquí, el del eje: la raíz no tiene P propio); ni la organizadora ni el
  // proveedor lo tienen. La casa bloquea los 10 que tiene: más de la mitad.
  await assert.rejects(autorizar(eje, { autorizante: 'organizadora', consolidacion: c.id, t: T }), /organizadora no tiene P que cuente para autorizar/);
  await assert.rejects(autorizar(eje, { autorizante: 'proveedor', consolidacion: c.id, t: T }), /proveedor no tiene P que cuente para autorizar/);
  const a = await autorizar(eje, { autorizante: 'casa', consolidacion: c.id, t: T });
  assert.deepEqual(a.contexto.autoridad.bloquea, [{ clave: 'P:genesis', cantidad: 10 }]);
  assert.equal(estadoDe(eje, c.id), 'AUTORIZADO');

  // El pago sale de BQL: el precio elegido (310 EUR), repartido por orden en las series de la casa de las partidas de la tarea.
  const mov = movimientosDeEjecucion(eje, c.id, tarea.id);
  assert.deepEqual(mov, [
    { token: 'E', emisor: 'casa', denominacion: 'alquiler de la carpa', cantidad: 250, de: 'organizadora', a: 'proveedor' },
    { token: 'E', emisor: 'casa', denominacion: 'transporte', cantidad: 60, de: 'organizadora', a: 'proveedor' },
  ]);
  // Ni el ejemplo ni el núcleo dejan pagar más que el coste total (350 EUR).
  const otra = await consolidar(eje, { autor: 'organizadora', foco: tarea.id, t: T, titulo: 'Encargo a mano', elecciones: { 9: { candidato: { evento: caro.id } } } });
  assert.deepEqual(otra.payload[9], { ref: caro.id, dir: '0000000000' }); // consolidar acepta cualquier elección en cualquier posición
  assert.throws(() => movimientosDeEjecucion(eje, otra.id, tarea.id), /pasa del coste de las partidas en 70 EUR/);
  const pagar = (denominacion, cantidad) => ({ token: 'E', emisor: 'casa', denominacion, cantidad, de: 'organizadora', a: 'proveedor' });
  const de390 = [...PARTIDAS.slice(0, 3).map(([concepto, importe]) => pagar(concepto, importe)), pagar(PARTIDAS[3][0], 40)];
  await assert.rejects(ejecutar(eje, { autor: 'organizadora', consolidacion: c.id, t: T, movimientos: de390 }), /saldo insuficiente de E:casa\/tarima del escenario/);

  await assert.rejects(ejecutar(eje, { autor: 'proveedor', consolidacion: c.id, t: T, movimientos: [] }), /ejecuta el autor/);
  const e = await ejecutar(eje, { autor: 'organizadora', consolidacion: c.id, t: '2026-11-13T18:00:00Z', movimientos: mov });
  assert.equal(estadoDe(eje, c.id), 'EJECUTADO');
  assert.deepEqual(e.contexto.evidencia, [c.id, a.id]);
  assert.deepEqual(eje.hilo(e.id).slice(0, 3).map((x) => x.id), [e.id, c.id, tarea.id]);
  assert.equal(eje.saldo('proveedor', serie('alquiler de la carpa')), 250);
  await assert.rejects(ejecutar(eje, { autor: 'organizadora', consolidacion: c.id, t: T, movimientos: mov }), /ya ejecutado/);
});

test('entrega: el proveedor consume las horas de su presupuesto; las previstas no se consumen', async () => {
  const { eje, tarea, consolidacion: c, entrega } = await ejemploTarea({ hasta: 'entregada' });
  // Lo que consume se lee a través de la referencia de su 1: las 6 h del presupuesto elegido, no las 7 h de la tarea.
  assert.equal(consultar(eje, entrega.id, [0], 'LOCAL(1)').texto, '6 h');
  assert.deepEqual(entrega.movimientos.filter((m) => m.escala === 'hora'), [{ token: 'T', escala: 'hora', cantidad: 6, de: 'proveedor', a: null }]);
  assert.equal(tiempoPrevisto(eje, tarea.id).valor.cantidad, 7);
  // No es un registro del motor: no cambia el estado ni entra en la evidencia (recibos de terceros, docs/MOTOR.md §12).
  assert.equal(estadoDe(eje, c.id), 'AUTORIZADO');
  // Nadie más consume las horas del proveedor.
  await assert.rejects(
    eje.escribir({
      autor: 'organizadora',
      sobre: c.id,
      t: '2026-11-13T16:30:00Z',
      movimientos: [
        { token: 'T', escala: 'minuto', cantidad: 1, de: 'organizadora', a: null },
        { token: 'T', escala: 'hora', cantidad: 6, de: 'proveedor', a: null },
      ],
      payload: 'la carpa la montó el proveedor',
    }),
    /nadie mueve tokens ajenos/,
  );
});

test('eje temporal: la fecha límite es una proyección; lo declarado en 7 no lleva distancia', async () => {
  const { eje, tarea, limite, presupuestos: [caro, corregido], consolidacion: c } = await ejemploTarea({ hasta: 'consolidada' });
  const ahora = '2026-11-08T10:30:00Z';
  const e = ejeTemporal(eje, tarea.id, { ahora });
  assert.deepEqual(e.futuro.map((x) => x.tipo), ['consolidacion', 'declarado', 'proyeccion']);
  assert.equal(e.futuro[0].estado, 'PENDIENTE DE AUTORIZACIÓN');
  assert.deepEqual([e.futuro[1].contenido, e.futuro[1].delta], [FECHA_LIMITE, 0]); // la fecha del 7 es texto: sin distancia
  assert.deepEqual([e.futuro[2].id, e.futuro[2].delta, e.futuro[2].banda], [limite.id, (Date.parse(FECHA_LIMITE) - Date.parse(ahora)) / 1000, 'semana']);
  assert.deepEqual(e.pasado.slice(0, 3).map((x) => x.id), [c.id, corregido.id, caro.id]); // lo más cercano primero
  // La víspera por la tarde la fecha límite cae en la banda del día.
  assert.equal(ejeTemporal(eje, tarea.id, { ahora: '2026-11-13T20:00:00Z' }).futuro.find((x) => x.tipo === 'proyeccion').banda, 'dia');

  // A la hora de ejecutar, la proyección de la fecha límite aún es futuro: se lee del eje.
  const r = await ejemploTarea();
  const alEjecutar = ejeTemporal(r.eje, r.tarea.id, { ahora: r.ejecucion.t }).futuro.find((x) => x.id === r.limite.id);
  assert.equal(alEjecutar.tipo, 'proyeccion');
  assert.ok(alEjecutar.delta > 0);
  // [X] decidir VG: el estado no depende de «ahora»: el 8 a las 10:30 la consolidación ya no es futuro,
  // porque su ejecución (fechada el 13) ya está en el eje.
  assert.deepEqual(ejeTemporal(r.eje, r.tarea.id, { ahora }).futuro.map((x) => x.tipo), ['declarado', 'proyeccion']);

  // Nada impide ejecutar después de la fecha límite (docs/MOTOR.md §12: proyecciones reales en PV7, comprobar `t`).
  const tarde = await ejemploTarea({ hasta: 'entregada' });
  const fuera = await ejecutar(tarde.eje, { autor: 'organizadora', consolidacion: tarde.consolidacion.id, t: '2026-11-15T10:00:00Z', movimientos: movimientosDeEjecucion(tarde.eje, tarde.consolidacion.id, tarde.tarea.id) });
  assert.equal(estadoDe(tarde.eje, tarde.consolidacion.id), 'EJECUTADO');
  assert.ok(ejeTemporal(tarde.eje, tarde.tarea.id, { ahora: fuera.t }).pasado.some((x) => x.id === tarde.limite.id));
});

test('comparar entre tareas hermanas: misma décupla, mismas direcciones', async () => {
  const { eje, partidas, tarea } = await ejemploTarea();
  const escenario = await escribirDesde(eje, {
    modo: 'mapped',
    autor: 'organizadora',
    sobre: partidas.id,
    t: '2026-11-07T11:00:00Z',
    payload: decuplaTarea({
      titulo: 'Montar el escenario',
      partidas: [{ ref: partidas.id, dir: '1410000000' }],
      materiales: ['tarima', 'focos'],
      plazo: '4 h',
      calidad: 'nivelada y firme',
      quien: ['organizadora'],
      pasos: [['colocar la tarima', '2 h'], ['instalar los focos', '1 h']],
      origen: { ref: partidas.id },
      fechaLimite: FECHA_LIMITE,
    }),
  });
  assert.equal(evaluar(eje, escenario.id, indicesDe(DIR_COSTE)).texto, '120 EUR');
  assert.equal(tiempoPrevisto(eje, escenario.id).texto, '3 h (2 h + 1 h)');
  // VG, 7-11 noche: se retira comparar(); sin base escrita en el 8 de las partidas, el respaldo al vuelo lo dice.
  const c = situar(eje, tarea.id, { respaldo: true });
  assert.deepEqual([c.n, c.escrita, c.frescura], [2, false, 'sin base escrita']);
  assert.equal(c.comparables[1].id, escenario.id);
  assert.ok(!('posicion' in c));
  // Misma estructura, mismas direcciones: el coste y el tiempo de una hermana se leen donde están los propios,
  // aunque una tenga cuatro pasos y la otra dos.
  const id = escenario.id.slice(0, 12);
  assert.equal(consultar(eje, tarea.id, [8], 'REF("' + id + '", "' + DIR_COSTE + '") < LOCAL(1, 1)').texto, 'verdadero');
  assert.equal(consultar(eje, tarea.id, [8], 'REF("' + id + '", "' + DIR_TIEMPO + '") < LOCAL(4, 1)').texto, 'verdadero');
  // [X] decidir VG: dos composiciones «EUR + horas» no se comparan; hay que ir parte a parte.
  assert.equal(consultar(eje, tarea.id, [8], 'REF("' + id + '", "8000000000") < LOCAL(8)').estado, 'INCOMPATIBLE');
});

test('con claves: cada identidad firma lo suyo y el eje se reconstruye exigiendo firmas', async () => {
  const claves = {};
  for (const id of ['casa', 'organizadora', 'proveedor']) claves[id] = await generarClaves();
  const { eje, consolidacion, entrega, ejecucion } = await ejemploTarea({ claves });
  assert.equal(eje.obtener(ejecucion.id).firmante, 'organizadora');
  assert.equal(eje.obtener(entrega.id).firmante, 'proveedor');
  for (const id of eje.orden) assert.ok(eje.obtener(id).firma, 'sin firma: ' + id.slice(0, 8));
  const copia = await Eje.desde(eje.orden.map((id) => eje.obtener(id)), { exigirFirmas: true });
  assert.equal(copia.orden.length, eje.orden.length);
  assert.equal(copia.saldo('proveedor', serie('alquiler de la carpa')), 250);
  assert.equal(estadoDe(copia, consolidacion.id), 'EJECUTADO');
});
