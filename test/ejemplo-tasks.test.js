import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ejemploTarea, decuplaTarea, movimientosDeEjecucion, tiempoPrevisto,
  FECHA_LIMITE, PARTIDAS, DIR_COSTE, DIR_TIEMPO, CERRADO,
} from '../ejemplos/ikisai/tarea-tasks.mjs';
import { Eje } from '../src/eje.js';
import { resolver, indicesDe, esReferencia } from '../src/btml.js';
import { evaluar, consultar } from '../src/bql.js';
import { ocupantes } from '../src/encaje.js';
import { proponer, consolidar, registrar, cerrado, siguiente, FABRICA, ANUNCIO } from '../src/motor.js';
import { escribirDesde } from '../src/escritura.js';
import { ejeTemporal } from '../src/tiempo.js';
import { situar } from '../src/bases.js';
import { generarClaves } from '../src/autoridad.js';

// Encargo 3b (mapa §15 [D] «Una sola operación: registrar»): ya no hay autorizar, ejecutar ni estados del motor. La
// fábrica consolida la elección (un registro más), la organizadora anuncia en la tarea lo que va a pagar (su 4.1), el
// proveedor entrega y consume sus horas, y la organizadora paga con su propio movimiento. motor.cerrado y
// motor.siguiente leen lo que falta. El P no se acuña ni autoriza: se obtiene al escribir y al recibir E o R
// (mapa §15 [D] «P como peso de criterio», N1, N2).

/** La serie de E de una partida: la emite la casa, que la respalda. */
const serie = (concepto) => 'E:casa/' + concepto;

/** Un presupuesto donde la tarea dice que busca (su 5), como lo escribe el proveedor (o cualquiera). */
const presupuesto = (eje, tarea, t, payload, autor = 'proveedor') =>
  escribirDesde(eje, { modo: 'sequenced', autor, sobre: tarea.id, en: tarea.payload[5], t, payload });

/** Cuántos presupuestos (escritos) colisionan en los recursos: una consulta; no ocupa posición en la tarea. */
const recibidos = (eje, tarea) => consultar(eje, tarea.id, [9], 'CONTAR(FILTRAR(BUSCAR(1), ORIGEN() = "escrito"))').texto;

/** Los presupuestos que caben en coste y en plazo: la fórmula del 9 sin su ELEGIR. */
const CABEN = 'FILTRAR(FILTRAR(BUSCAR(1), ORIGEN() = "escrito"), Y(ACTUAL(1) <= LOCAL(1, 1), ACTUAL(2) <= LOCAL(2, 1)))';

const minuto = (de, cantidad = 1) => ({ token: 'T', escala: 'minuto', cantidad, de, a: null });

/** El pago de la organizadora: lo que a la tarea le falta de ella (motor.siguiente), en un registro suyo sobre la tarea. */
const pagar = (eje, tarea, t, payload = 'Carpa montada y pagada') => {
  const { faltaDeMi } = siguiente(eje, tarea.id, 'organizadora');
  return registrar(eje, { autor: 'organizadora', sobre: tarea.id, t, movimientos: [minuto('organizadora'), ...faltaDeMi.map((x) => x.transaccion.movimientos[1])], payload });
};

test('ejemplo Tasks: saldos por serie; escribir cuesta minutos y solo quien trabaja consume horas', async () => {
  const { eje, tarea, entrega } = await ejemploTarea();
  assert.deepEqual(eje.identidades(), ['casa', 'organizadora', 'proveedor']);
  // E por serie de la casa, una por partida. El pago sale de las de la carpa; la tarima sigue en la casa.
  const E = (id) => PARTIDAS.map(([concepto]) => eje.saldo(id, serie(concepto)));
  assert.deepEqual(E('casa'), [0, 0, 0, 120]);
  assert.deepEqual(E('organizadora'), [0, 0, 40, 0]);
  assert.deepEqual(E('proveedor'), [250, 60, 0, 0]);
  // P posicionado en registros (mapa §15 [D] «P como peso de criterio»): nadie lo acuña a mano ni lo bloquea para
  // autorizar (retirado). N1: quien escribe un registro obtiene diez sobre él. N2: la organizadora y el proveedor
  // recibieron R de la casa (su invitación) y E de series atadas al génesis: su P sobre el génesis.
  const escritos = (id) => eje.orden.filter((x) => eje.obtener(x).autor === id);
  const poder = (id) => Object.fromEntries(eje.poderes(id).map((p) => [p.ambito, p.cantidad]));
  assert.deepEqual(poder('casa'), Object.fromEntries(escritos('casa').map((x) => [x, 10])));
  // Sobre el génesis: diez por cada unidad de R y de E atada a él que reciben de su emisor, la casa (encargo 3b-bis: la
  // obtención es por cantidad, no por cabeza ni por serie).
  const seriesE = (id) => new Set(eje.orden.flatMap((x) => eje.obtener(x).movimientos).filter((m) => m.token === 'E' && m.a === id && m.de !== null && m.de !== id && m.estado === undefined).map((m) => m.emisor + '/' + m.denominacion)).size;
  assert.deepEqual(['organizadora', 'proveedor'].map(seriesE), [3, 3]);
  // P por mirada (VG, tras 3b-bis): la E recibida de su emisor da P sobre la mirada 1 del registro de la serie (el génesis), y la R sobre el 3 del alta del emisor (el génesis también).
  const deLaCasa = (id, token) => eje.orden.flatMap((x) => eje.obtener(x).movimientos).filter((m) => m.token === token && m.emisor === 'casa' && m.de === 'casa' && m.a === id && m.estado === undefined).reduce((s, m) => s + m.cantidad, 0);
  for (const id of ['organizadora', 'proveedor']) {
    assert.deepEqual(poder(id), { ...Object.fromEntries(escritos(id).map((x) => [x, 10])), [eje.genesisId + '.3']: 10 * deLaCasa(id, 'R'), [eje.genesisId + '.1']: 10 * deLaCasa(id, 'E') });
  }
  for (const id of eje.identidades()) assert.deepEqual(eje.bloqueos(id), []);
  // T por escala: minutos para escribir, horas para trabajar. T no cruza de persona (VG, 7-11 noche): la casa no
  // reparte su T (cede al proveedor 20 horas de su tiempo como E:casa/hora), y cada una gasta su asignación del
  // día (VG, 8-11): la organizadora y el proveedor no tienen T explícito, y lo que gastaron se ve consumido.
  const T = (id) => [eje.saldo(id, 'T:minuto'), eje.saldo(id, 'T:hora')];
  const consumido = (id) => ['minuto', 'hora'].map((escala) => eje.orden.map((x) => eje.obtener(x)).filter((e) => e.autor === id && e.contexto?.genesis !== true)
    .reduce((s, e) => s + e.movimientos.filter((m) => m.token === 'T' && m.escala === escala && m.de === id && m.a === null).reduce((x, m) => x + m.cantidad, 0), 0));
  // La casa: su emisión (1), las dos invitaciones (1 cada una), las altas (3) y las partidas (10). Sin T explícito
  // (VG, 8-11: no hay T acumulable). Ya no libera P al acabar.
  assert.deepEqual([T('casa'), consumido('casa')], [[0, 0], [1 + 2 + 3 + 10, 0]]);
  assert.deepEqual(eje.recursos('proveedor').filter((r) => r.denominacion === 'hora'), [{ emisor: 'casa', denominacion: 'hora', cantidad: 20 }]);
  // La organizadora: su alta (1), la tarea (33), la fecha límite (1), la consolidación (10), dos anuncios (5 cada uno)
  // y el pago (1).
  assert.deepEqual([T('organizadora'), consumido('organizadora')], [[0, 0], [1 + 33 + 1 + 10 + 2 * 5 + 1, 0]]);
  // El proveedor: su alta (1), dos presupuestos (4 cada uno) y la entrega (2), y las 6 horas que trabaja.
  assert.deepEqual([T('proveedor'), consumido('proveedor')], [[0, 0], [1 + 2 * 4 + 2, 6]]);
  // Todo registro tras el génesis cuesta minutos a su autor; solo la entrega consume horas, y son del proveedor.
  for (const id of eje.orden.slice(1)) {
    const ev = eje.obtener(id);
    assert.ok(ev.movimientos.some((m) => m.token === 'T' && m.escala === 'minuto' && m.de === ev.autor && m.a === null), 'sin minutos: ' + id.slice(0, 8));
  }
  const consumoHoras = eje.orden.map((id) => eje.obtener(id)).filter((ev) => ev.movimientos.some((m) => m.token === 'T' && m.escala === 'hora' && m.a === null));
  assert.deepEqual(consumoHoras.map((ev) => [ev.id, ev.autor]), [[entrega.id, 'proveedor']]);
  // Los minutos no se pagan con horas: un registro de 80 minutos del proveedor gasta 80 minutos (de su
  // asignación del día) y ninguna hora, y queda anotado en la tarea, el registro que lo soporta.
  const antes = eje.tiempoSobre(tarea.id);
  await eje.escribir({
    autor: 'proveedor',
    sobre: tarea.id,
    t: '2026-11-13T19:00:00Z',
    movimientos: [minuto('proveedor', 80)],
    payload: 'ochenta minutos',
  });
  assert.deepEqual(consumido('proveedor'), [11 + 80, 6]);
  assert.deepEqual(eje.tiempoSobre(tarea.id), { ...antes, minuto: (antes.minuto ?? 0) + 80 });
});

test('etapas: «hasta» detiene el ejemplo en su último registro', async () => {
  // Sin autorización ni ejecución (encargo 3b): tras consolidar, la organizadora anuncia el pago, el proveedor
  // entrega y la organizadora paga.
  for (const [hasta, ultima, siguienteEtapa] of [
    ['tarea', 'limite', 'presupuestos'],
    ['presupuestos', 'presupuestos', 'consolidacion'],
    ['consolidada', 'consolidacion', 'anuncios'],
    ['anunciada', 'anuncios', 'entrega'],
    ['entregada', 'entrega', 'pago'],
  ]) {
    const r = await ejemploTarea({ hasta });
    assert.equal(r[siguienteEtapa], undefined, hasta + ': sobra ' + siguienteEtapa);
    assert.equal(r.eje.orden.at(-1), [r[ultima]].flat().at(-1).id, hasta + ': el eje no acaba en ' + ultima);
  }
  const todo = await ejemploTarea();
  assert.equal(todo.eje.orden.at(-1), todo.pago.id);
  await assert.rejects(ejemploTarea({ hasta: 'otra' }), /etapa desconocida/);
  await assert.rejects(ejemploTarea({ hasta: 'autorizada' }), /etapa desconocida/); // retirada con autorizar
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
  const { eje, alta, partidas, tarea, pago } = await ejemploTarea();
  // El pago se escribe sobre la tarea (ya no sobre una consolidación ejecutada).
  assert.deepEqual(eje.hilo(pago.id).map((e) => e.id), [pago.id, tarea.id, partidas.id, alta.id, eje.genesisId]);
  // 1.0: las partidas de la tarea son referencias; su importe vive en el registro de partidas.
  const refs = tarea.payload[1][0].slice(1);
  assert.ok(refs.every((x) => esReferencia(x) && x.ref === partidas.id));
  assert.deepEqual(refs.map((x) => resolver(eje.obtener(x.ref).payload, x.dir)), [['250 EUR'], ['60 EUR'], ['40 EUR']]);
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
  // Su criterio (2) nombra la plantilla de cerrado de la época (encargo 3b), en 2.3.
  assert.deepEqual(tarea.payload[2], ['Criterios', '8 h', 'anclada, tensada y sin goteras', CERRADO]);
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

test('quién ocupa una posición ajena (mapa §12 [D], R8): la casa escribe en los recursos de la tarea, colisiona y no es elegible; el 9 elige al proveedor', async () => {
  const { eje, tarea } = await ejemploTarea({ hasta: 'tarea' });
  // La casa escribe un «presupuesto» en los recursos de la tarea de la organizadora: cabe y llega primero. Colisionar
  // es libre (queda como ocupante), pero la tarea solo nombra en su 3 a la organizadora y al proveedor.
  const ajeno = await presupuesto(eje, tarea, '2026-11-07T16:00:00Z', ['yo mismo', '349 EUR', '1 h', 'casa'], 'casa');
  const delProveedor = await presupuesto(eje, tarea, '2026-11-08T09:30:00Z', ['Presupuesto corregido: carpa sin suelo', '310 EUR', '6 h', 'proveedor']);
  assert.ok(ocupantes(eje, tarea.id, [1]).some((o) => o.evento === ajeno.id));
  const buscados = consultar(eje, tarea.id, [9], 'BUSCAR(LOCAL(5))');
  assert.deepEqual([buscados.valor.items.some((i) => i.evento === ajeno.id), buscados.valor.noElegibles], [false, 1]);
  const p = proponer(eje, tarea.id, { posiciones: [1, 2, 3, 4, 8, 9] });
  assert.equal(p.elecciones[9].candidato.evento, delProveedor.id);
  const c = await consolidar(eje, { autor: 'organizadora', foco: tarea.id, t: '2026-11-08T10:00:00Z', elecciones: p.elecciones });
  // Ya no hay autorización de la casa (mapa §15 [D] «Una sola operación: registrar»). El pago va a quien está en el
  // 3 de la tarea.
  assert.deepEqual(c.payload[9], { ref: delProveedor.id, dir: '0000000000' });
  assert.equal(movimientosDeEjecucion(eje, c.id, tarea.id).some((m) => m.a === 'proveedor'), true);
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

test('ciclo: consolidar → la organizadora anuncia el pago → lo paga con su propio movimiento en las series de las partidas, sin pasar del coste', async () => {
  const { eje, tarea, presupuestos: [caro, corregido], consolidacion: c, anuncios } = await ejemploTarea({ hasta: 'anunciada' });
  // La consolidación: un registro de la fábrica, sin fases ni estados.
  assert.deepEqual([c.sobre, c.en, c.autor], [tarea.id, FABRICA, 'organizadora']);
  assert.deepEqual(c.contexto.fuentes, [tarea.id, corregido.id]);
  assert.deepEqual(c.payload.slice(1, 8), [1, 2, 3, 4, 5, 6, 7].map((i) => ({ ref: tarea.id, dir: i + '000000000' }))); // 5–7 heredadas
  assert.deepEqual(c.payload[9], { ref: corregido.id, dir: '0000000000' });
  // [X] decidir VG: el encaje del 9 guarda el vector de la búsqueda (todo ceros) aunque el presupuesto viene del 1 y se coloca en el 9.
  const e9 = c.contexto.encaje.find((x) => x.posicion === 9);
  assert.deepEqual([e9.origen, e9.destino, e9.signo], ['1000000000', '9000000000', 'exacto']);
  // [X] decidir VG: la composición consolidada es texto; BQL ya no la lee como composición.
  assert.equal(evaluar(eje, c.id, [8]).valor.tipo, 'texto');

  // El pago sale de BQL: el precio elegido (310 EUR), repartido por orden en las series de la casa de las partidas de la tarea.
  const mov = movimientosDeEjecucion(eje, c.id, tarea.id);
  assert.deepEqual(mov, [
    { token: 'E', emisor: 'casa', denominacion: 'alquiler de la carpa', cantidad: 250, de: 'organizadora', a: 'proveedor' },
    { token: 'E', emisor: 'casa', denominacion: 'transporte', cantidad: 60, de: 'organizadora', a: 'proveedor' },
  ]);
  // Y es lo que la organizadora anunció en la 4.1 de la tarea, un registro por movimiento.
  assert.deepEqual(eje.sobre(tarea.id, ANUNCIO).map((a) => a.id), anuncios.map((a) => a.id));
  assert.deepEqual(anuncios.map((a) => a.payload), mov.map((m) => [[serie(m.denominacion)], [m.cantidad], ['pagar'], [[m.de], [m.a]]]));
  // Anunciado y sin pagar, la tarea está abierta: a la organizadora le falta pagar; al proveedor, nada.
  assert.deepEqual([cerrado(eje, tarea.id).cerrado, cerrado(eje, tarea.id).plantilla], [false, CERRADO]);
  assert.deepEqual(siguiente(eje, tarea.id, 'organizadora').faltaDeMi.map((x) => x.que), [
    'mover 250 E:casa/alquiler de la carpa de organizadora a proveedor',
    'mover 60 E:casa/transporte de organizadora a proveedor',
  ]);
  assert.deepEqual(siguiente(eje, tarea.id, 'proveedor').faltaDeMi, []);

  const T = '2026-11-08T11:00:00Z';
  // Cada parte mueve lo suyo (mapa §15 [D] «Una sola operación: registrar»; antes, «ejecuta el autor»): el proveedor
  // no se cobra a sí mismo con los tokens de la organizadora.
  await assert.rejects(registrar(eje, { autor: 'proveedor', sobre: tarea.id, t: T, movimientos: [minuto('proveedor'), mov[0]], payload: 'me cobro' }), /nobody moves tokens of others/);
  // Ni el ejemplo ni el núcleo dejan pagar más que el coste total (350 EUR).
  const otra = await consolidar(eje, { autor: 'organizadora', foco: tarea.id, t: T, titulo: 'Encargo a mano', elecciones: { 9: { candidato: { evento: caro.id } } } });
  assert.deepEqual(otra.payload[9], { ref: caro.id, dir: '0000000000' }); // consolidar acepta cualquier elección en cualquier posición
  assert.throws(() => movimientosDeEjecucion(eje, otra.id, tarea.id), /pasa del coste de las partidas en 70 EUR/);
  const aMano = (denominacion, cantidad) => ({ token: 'E', emisor: 'casa', denominacion, cantidad, de: 'organizadora', a: 'proveedor' });
  const de390 = [...PARTIDAS.slice(0, 3).map(([concepto, importe]) => aMano(concepto, importe)), aMano(PARTIDAS[3][0], 40)];
  await assert.rejects(registrar(eje, { autor: 'organizadora', sobre: tarea.id, t: T, movimientos: [minuto('organizadora'), ...de390], payload: 'pago de más' }), /saldo insuficiente de E:casa\/tarima del escenario/);

  const pago = await pagar(eje, tarea, '2026-11-13T18:00:00Z');
  assert.deepEqual(pago.movimientos.slice(1), mov);
  assert.deepEqual(eje.hilo(pago.id).slice(0, 2).map((x) => x.id), [pago.id, tarea.id]);
  assert.equal(eje.saldo('proveedor', serie('alquiler de la carpa')), 250);
  // Pagado, cerrado: no queda nada que mover (antes, «ya ejecutado»).
  assert.equal(cerrado(eje, tarea.id).cerrado, true);
  assert.deepEqual(siguiente(eje, tarea.id, 'organizadora'), { cerrado: true, faltaDeMi: [], espera: [] });
});

test('entrega: el proveedor consume las horas de su presupuesto; las previstas no se consumen', async () => {
  const { eje, tarea, consolidacion: c, entrega } = await ejemploTarea({ hasta: 'entregada' });
  assert.deepEqual([entrega.sobre, entrega.en], [c.id, FABRICA]);
  // Lo que consume se lee a través de la referencia de su 1: las 6 h del presupuesto elegido, no las 7 h de la tarea.
  assert.equal(consultar(eje, entrega.id, [0], 'LOCAL(1)').texto, '6 h');
  assert.deepEqual(entrega.movimientos.filter((m) => m.escala === 'hora'), [{ token: 'T', escala: 'hora', cantidad: 6, de: 'proveedor', a: null }]);
  assert.equal(tiempoPrevisto(eje, tarea.id).valor.cantidad, 7);
  // La entrega no cierra la tarea: lo anunciado es el pago, y aún falta (recibos de terceros, docs/MOTOR.md §12).
  assert.equal(cerrado(eje, tarea.id).cerrado, false);
  assert.equal(siguiente(eje, tarea.id, 'organizadora').faltaDeMi.length, 2);
  // Nadie más consume las horas del proveedor.
  await assert.rejects(
    eje.escribir({
      autor: 'organizadora',
      sobre: c.id,
      t: '2026-11-13T16:30:00Z',
      movimientos: [
        minuto('organizadora'),
        { token: 'T', escala: 'hora', cantidad: 6, de: 'proveedor', a: null },
      ],
      payload: 'la carpa la montó el proveedor',
    }),
    /nobody moves tokens of others/,
  );
});

test('eje temporal: la fecha límite es una proyección; lo declarado en 7 no lleva distancia', async () => {
  const { eje, tarea, limite, presupuestos: [caro, corregido], consolidacion: c } = await ejemploTarea({ hasta: 'consolidada' });
  const ahora = '2026-11-08T10:30:00Z';
  const e = ejeTemporal(eje, tarea.id, { ahora });
  // La consolidación ya no es futuro con un estado pendiente (no hay estados del motor, encargo 3b): es un registro
  // del pasado.
  assert.deepEqual(e.futuro.map((x) => x.tipo), ['declarado', 'proyeccion']);
  assert.deepEqual([e.futuro[0].contenido, e.futuro[0].delta], [FECHA_LIMITE, 0]); // la fecha del 7 es texto: sin distancia
  assert.deepEqual([e.futuro[1].id, e.futuro[1].delta, e.futuro[1].banda], [limite.id, (Date.parse(FECHA_LIMITE) - Date.parse(ahora)) / 1000, 'semana']);
  assert.deepEqual(e.pasado.slice(0, 3).map((x) => x.id), [c.id, corregido.id, caro.id]); // lo más cercano primero
  // La víspera por la tarde la fecha límite cae en la banda del día.
  assert.equal(ejeTemporal(eje, tarea.id, { ahora: '2026-11-13T20:00:00Z' }).futuro.find((x) => x.tipo === 'proyeccion').banda, 'dia');

  // A la hora de pagar, la proyección de la fecha límite aún es futuro: se lee del eje.
  const r = await ejemploTarea();
  const alPagar = ejeTemporal(r.eje, r.tarea.id, { ahora: r.pago.t }).futuro.find((x) => x.id === r.limite.id);
  assert.equal(alPagar.tipo, 'proyeccion');
  assert.ok(alPagar.delta > 0);
  // [X] decidir VG: el pago, fechado el 13, es un registro sobre la tarea; leído el 8 a las 10:30 aparece como
  // proyección, antes que la fecha límite (antes se leía como el estado de la consolidación).
  assert.deepEqual(ejeTemporal(r.eje, r.tarea.id, { ahora }).futuro.map((x) => [x.tipo, x.id]), [['declarado', r.tarea.id], ['proyeccion', r.pago.id], ['proyeccion', r.limite.id]]);

  // Nada impide pagar después de la fecha límite (docs/MOTOR.md §12: proyecciones reales en PV7, comprobar `t`).
  const tarde = await ejemploTarea({ hasta: 'entregada' });
  const fuera = await pagar(tarde.eje, tarde.tarea, '2026-11-15T10:00:00Z', 'pagada tarde');
  assert.equal(cerrado(tarde.eje, tarde.tarea.id).cerrado, true);
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
  const { eje, tarea, entrega, pago } = await ejemploTarea({ claves });
  assert.equal(eje.obtener(pago.id).firmante, 'organizadora');
  assert.equal(eje.obtener(entrega.id).firmante, 'proveedor');
  for (const id of eje.orden) assert.ok(eje.obtener(id).firma, 'sin firma: ' + id.slice(0, 8));
  const copia = await Eje.desde(eje.orden.map((id) => eje.obtener(id)), { exigirFirmas: true });
  assert.equal(copia.orden.length, eje.orden.length);
  assert.equal(copia.saldo('proveedor', serie('alquiler de la carpa')), 250);
  assert.equal(cerrado(copia, tarea.id).cerrado, true);
});
