import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ejemploTarea, decuplaTarea, movimientosDeEjecucion, tiempoPrevisto,
  FECHA_LIMITE, EN_PRESUPUESTO, ETAPAS,
} from '../ejemplos/ikisai/tarea-tasks.mjs';
import { Eje } from '../src/eje.js';
import { resolver } from '../src/btml.js';
import { evaluar, consultar } from '../src/bql.js';
import { ocupantes, arbol, colisiones } from '../src/encaje.js';
import { proponer, autorizar, ejecutar, estadoDe, consolidaciones, FABRICA } from '../src/motor.js';
import { escribirDesde } from '../src/escritura.js';
import { ejeTemporal, comparar } from '../src/tiempo.js';
import { generarClaves } from '../src/autoridad.js';

/**
 * Serie de T de una escala, leída del libro de movimientos: T son siete
 * tokens, uno por escala y sin conversión (VG, 7-11). Hoy el núcleo guarda
 * T en segundos (eje.saldoT mezcla minutos y horas); el libro no.
 */
function seriesT(eje) {
  const s = new Map();
  const mover = (id, escala, d) => s.set(id + '|' + escala, (s.get(id + '|' + escala) ?? 0) + d);
  const negativas = [];
  for (const id of eje.orden) {
    const ev = eje.obtener(id);
    for (const m of ev.movimientos.filter((x) => x.token === 'T')) {
      if (m.de !== null) mover(m.de, m.escala, -m.cantidad);
      if (m.a !== null) mover(m.a, m.escala, m.cantidad);
    }
    for (const [k, v] of s) if (v < 0) negativas.push(k + ' tras ' + id.slice(0, 8));
  }
  return { de: (id, escala) => s.get(id + '|' + escala) ?? 0, negativas };
}

test('ejemplo Tasks: saldos por serie; escribir cuesta minutos y nadie paga minutos con horas', async () => {
  const { eje, ejecucion } = await ejemploTarea();
  assert.deepEqual(eje.identidades(), ['casa', 'organizadora', 'proveedor']);
  // E por denominación: el fondo de la organizadora paga el presupuesto elegido.
  assert.equal(eje.saldo('casa', 'E:EUR'), 600);
  assert.equal(eje.saldo('organizadora', 'E:EUR'), 90);
  assert.equal(eje.saldo('proveedor', 'E:EUR'), 310);
  // P por ámbito: la casa conserva su poder sobre todo el eje; autorizar no lo gasta.
  assert.deepEqual(eje.poderes('casa'), [{ ambito: 'genesis', cantidad: 10 }]);
  assert.deepEqual(eje.poderes('organizadora'), []);
  assert.deepEqual(eje.poderes('proveedor'), []);
  // T por escala: minutos para escribir, horas para trabajar.
  const t = seriesT(eje);
  assert.deepEqual(t.negativas, []);
  assert.deepEqual(['minuto', 'hora'].map((e) => t.de('casa', e)), [406, 140]);
  assert.deepEqual(['minuto', 'hora'].map((e) => t.de('organizadora', e)), [79, 33]);
  assert.deepEqual(['minuto', 'hora'].map((e) => t.de('proveedor', e)), [52, 20]);
  // Todo registro tras el génesis cuesta minutos a su autor; solo la ejecución consume horas.
  for (const id of eje.orden.slice(1)) {
    const ev = eje.obtener(id);
    assert.ok(ev.movimientos.some((m) => m.token === 'T' && m.escala === 'minuto' && m.de === ev.autor && m.a === null), 'sin minutos: ' + id.slice(0, 8));
  }
  const consumoHoras = eje.orden.map((id) => eje.obtener(id)).filter((ev) => ev.movimientos.some((m) => m.token === 'T' && m.escala === 'hora' && m.a === null));
  assert.deepEqual(consumoHoras.map((ev) => ev.id), [ejecucion.id]);
  await assert.rejects(ejemploTarea({ hasta: 'otra' }), /etapa desconocida/);
  assert.deepEqual(ETAPAS, ['tarea', 'presupuestos', 'consolidada', 'autorizada', 'ejecutada']);
});

test('hilo y fórmulas: las partidas se referencian, no se copian; coste, tiempo y composición', async () => {
  const { eje, alta, partidas, tarea, consolidacion, ejecucion } = await ejemploTarea();
  assert.deepEqual(eje.hilo(ejecucion.id).map((e) => e.id), [ejecucion.id, consolidacion.id, tarea.id, partidas.id, alta.id, eje.genesisId]);
  assert.equal(eje.hilo(tarea.id).length, 4);
  // 1.0: el presupuesto son referencias a los importes de las partidas.
  const [, carpa, transporte, imprevistos] = tarea.payload[1][0];
  assert.deepEqual([carpa.dir, transporte.dir, imprevistos.dir], ['1110000000', '1210000000', '1310000000']);
  assert.equal(resolver(eje.obtener(carpa.ref).payload, carpa.dir), '250 EUR');
  // 1.2 coste total = suma de las partidas, con su desglose y sus dependencias.
  const coste = evaluar(eje, tarea.id, [1, 2]);
  assert.equal(coste.texto, '350 EUR (250 EUR + 60 EUR + 40 EUR)');
  assert.ok(coste.dependencias.includes(partidas.id + ':1110000000'));
  // 4.5 tiempo previsto = suma de los pasos en horas.
  assert.equal(tiempoPrevisto(eje, tarea.id).texto, '7 h (1 h + 2 h + 3 h + 1 h)');
  assert.equal(evaluar(eje, tarea.id, [4, 5]).texto, '7 h (1 h + 2 h + 3 h + 1 h)');
  // 8 composición «EUR + horas»: dos partes que no se funden.
  const comp = evaluar(eje, tarea.id, [8]);
  assert.equal(comp.valor.tipo, 'composicion');
  assert.deepEqual(comp.valor.partes.map((p) => [p.cantidad, p.unidad]), [[350, 'EUR'], [7, 'h']]);
  assert.equal(comp.valor.partes[0].desglose.length, 3);
  // 6 pasado: referencia a las partidas; 7 futuro: la fecha límite como texto.
  assert.deepEqual(tarea.payload[6], { ref: partidas.id });
  assert.equal(evaluar(eje, tarea.id, [7]).texto, FECHA_LIMITE);
});

test('encaje de la dirección 1: lo propio y los presupuestos colisionan y nada se borra', async () => {
  const { eje, tarea, presupuestos: [caro, corregido] } = await ejemploTarea({ hasta: 'presupuestos' });
  assert.deepEqual([caro.en, corregido.en], [EN_PRESUPUESTO, EN_PRESUPUESTO]);
  const oc = ocupantes(eje, tarea.id, [1]);
  assert.deepEqual(oc.map((o) => o.origen), ['propio', 'propio', 'propio', 'escrito', 'escrito']);
  assert.deepEqual(oc.map((o) => o.camino), [[1], [1, 0], [1, 0, 0], [], []]); // 1, 1.0 y 1.0.0 son el mismo lugar
  assert.deepEqual(oc.slice(3).map((o) => o.evento), [caro.id, corregido.id]); // corregir es añadir un ocupante
  assert.ok(oc.every((o) => o.signo === 'exacto' && o.acuerdo === 10));
  const mapa = colisiones(arbol(eje, tarea.id));
  assert.equal(mapa.find((c) => c.dir === '1000000000').ocupantes.length, 5);
  // BQL ve la misma colisión: cinco candidatos, dos escritos; el 5 los cuenta.
  assert.equal(consultar(eje, tarea.id, [5], 'CONTAR(BUSCAR(1))').texto, '5');
  assert.equal(evaluar(eje, tarea.id, [5]).texto, '2');
  // El 9 elige por encaje el que cabe: el caro (420 EUR > 350 EUR) se queda, pero no encaja.
  const eleccion = evaluar(eje, tarea.id, [9]);
  assert.deepEqual(eleccion.valor.items.map((i) => i.evento), [corregido.id]);
  assert.equal(consultar(eje, tarea.id, [9], 'CONTAR(FILTRAR(BUSCAR(1), ORIGEN() = "escrito"))').texto, '2');
  // Sin el criterio, el orden de encaje (todos exactos) es el de llegada: el caro primero.
  assert.equal(consultar(eje, tarea.id, [9], 'ELEGIR(FILTRAR(BUSCAR(1), ORIGEN() = "escrito"))').valor.items[0].evento, caro.id);
});

test('proponer: sin presupuestos el 9 no propone; el caro no cabe; el corregido sí', async () => {
  const { eje, tarea } = await ejemploTarea({ hasta: 'tarea' });
  const vacia = proponer(eje, tarea.id, { posiciones: [1, 2, 3, 4, 8, 9] });
  assert.deepEqual(vacia.pendientes, [{ posicion: 9, motivo: 'sin candidatos' }]);
  assert.deepEqual(Object.keys(vacia.elecciones).map(Number), [1, 2, 3, 4, 8]);
  assert.deepEqual(vacia.elecciones[1], { ref: tarea.id, dir: '1000000000' }); // lo literal, por referencia al foco
  // Solo el caro: el 5 lo cuenta, el 9 sigue sin candidatos.
  await escribirDesde(eje, { modo: 'sequenced', autor: 'proveedor', sobre: tarea.id, en: EN_PRESUPUESTO, t: '2026-11-07T17:00:00Z', payload: ['Presupuesto: carpa con suelo de madera', '420 EUR', '5 h', 'proveedor'] });
  assert.equal(evaluar(eje, tarea.id, [5]).texto, '1');
  assert.deepEqual(proponer(eje, tarea.id, { posiciones: [9] }).pendientes, [{ posicion: 9, motivo: 'sin candidatos' }]);

  const r = await ejemploTarea({ hasta: 'consolidada' });
  const p = r.propuesta;
  assert.deepEqual(p.origenes.map((o) => [o.posicion, o.desde]), [[1, 'foco'], [2, 'foco'], [3, 'foco'], [4, 'foco'], [8, 'formula'], [9, 'formula']]);
  assert.equal(p.elecciones[9].candidato.evento, r.presupuestos[1].id);
  assert.equal(p.elecciones[9].candidato.tipo, 'escrito');
  assert.equal(typeof p.elecciones[8], 'string'); // la composición entra como terminal
  assert.deepEqual(p.pendientes, []);
  assert.equal(r.descubierto[0].candidatos.length, 5);
});

test('[X] decidir VG: una nota terminal en 1 deja la elección PENDIENTE', async () => {
  // Cualquiera con minutos puede escribir en los recursos de la tarea. Un
  // terminal no tiene posición 1, ACTUAL(1) para la consulta entera y el 9
  // deja de proponer: falta una política de candidatos pendientes.
  const { eje, tarea } = await ejemploTarea({ hasta: 'presupuestos' });
  await escribirDesde(eje, { modo: 'pointed', autor: 'proveedor', sobre: tarea.id, en: EN_PRESUPUESTO, t: '2026-11-08T09:40:00Z', payload: 'llamadme antes de las 9' });
  assert.equal(evaluar(eje, tarea.id, [9]).estado, 'PENDIENTE');
  assert.equal(evaluar(eje, tarea.id, [5]).texto, '3');
  assert.deepEqual(proponer(eje, tarea.id, { posiciones: [9] }).pendientes.map((x) => x.posicion), [9]);
});

test('ciclo: consolidar → la casa autoriza con P → ejecutar paga al proveedor y consume las horas', async () => {
  const { eje, tarea, presupuestos: [, corregido], consolidacion: c } = await ejemploTarea({ hasta: 'consolidada' });
  assert.equal(c.en, FABRICA);
  assert.equal(c.contexto.fase, 'consolidado');
  assert.deepEqual(c.contexto.fuentes, [tarea.id, corregido.id]);
  assert.equal(c.payload.length, 10);
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
  await assert.rejects(autorizar(eje, { autorizante: 'organizadora', consolidacion: c.id, t: T }), /no se autoriza a sí mismo/);
  await assert.rejects(autorizar(eje, { autorizante: 'proveedor', consolidacion: c.id, t: T }), /no tiene poder/);
  const a = await autorizar(eje, { autorizante: 'casa', consolidacion: c.id, t: T });
  assert.equal(estadoDe(eje, c.id), 'AUTORIZADO');

  // Lo que se mueve sale de BQL: el precio elegido (E) y el tiempo previsto (T en horas).
  const mov = movimientosDeEjecucion(eje, c.id, tarea.id);
  assert.deepEqual(mov, [
    { token: 'E', denominacion: 'EUR', cantidad: 310, de: 'organizadora', a: 'proveedor' },
    { token: 'T', escala: 'hora', cantidad: 7, de: 'organizadora', a: null },
  ]);
  await assert.rejects(ejecutar(eje, { autor: 'proveedor', consolidacion: c.id, t: T, movimientos: [] }), /ejecuta el autor/);
  const e = await ejecutar(eje, { autor: 'organizadora', consolidacion: c.id, t: '2026-11-13T18:00:00Z', movimientos: mov });
  assert.equal(estadoDe(eje, c.id), 'EJECUTADO');
  assert.deepEqual(e.contexto.evidencia, [c.id, a.id]);
  assert.deepEqual(e.payload.slice(1), [{ ref: c.id }, { ref: a.id }]);
  assert.deepEqual(eje.hilo(e.id).slice(0, 3).map((x) => x.id), [e.id, c.id, tarea.id]);
  assert.equal(eje.saldo('proveedor', 'E:EUR'), 310);
  await assert.rejects(ejecutar(eje, { autor: 'organizadora', consolidacion: c.id, t: T, movimientos: mov }), /ya ejecutado/);
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
  assert.equal(e.pasado[0].banda, 'hora');
  // La víspera por la tarde la fecha límite cae en la banda del día.
  assert.equal(ejeTemporal(eje, tarea.id, { ahora: '2026-11-13T20:00:00Z' }).futuro.find((x) => x.tipo === 'proyeccion').banda, 'dia');

  const r = await ejemploTarea();
  assert.ok(Date.parse(r.ejecucion.t) < Date.parse(FECHA_LIMITE)); // ejecutada antes de la fecha límite
  // [X] decidir VG: el estado no depende de «ahora»: el 8 a las 10:30 la consolidación ya no es futuro,
  // porque su ejecución (fechada el 13) ya está en el eje.
  assert.deepEqual(ejeTemporal(r.eje, r.tarea.id, { ahora }).futuro.map((x) => x.tipo), ['declarado', 'proyeccion']);
});

test('comparar entre tareas hermanas: misma décupla, mismas posiciones', async () => {
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
  assert.equal(evaluar(eje, escenario.id, [1, 2]).texto, '120 EUR');
  assert.equal(tiempoPrevisto(eje, escenario.id).texto, '3 h (2 h + 1 h)');
  const c = comparar(eje, tarea.id);
  assert.deepEqual([c.posicion, c.de], [1, 2]);
  assert.equal(c.comparables[1].id, escenario.id);
  // Misma estructura, mismas direcciones: el coste de una hermana se lee donde está el propio.
  const id = escenario.id.slice(0, 12);
  assert.equal(consultar(eje, tarea.id, [8], 'REF("' + id + '", "1200000000") < LOCAL(1, 2)').texto, 'verdadero');
  assert.equal(consultar(eje, tarea.id, [8], 'REF("' + id + '", "4300000000") < LOCAL(4, 5)').texto, 'verdadero');
  // [X] decidir VG: dos composiciones «EUR + horas» no se comparan; hay que ir parte a parte.
  assert.equal(consultar(eje, tarea.id, [8], 'REF("' + id + '", "8000000000") < LOCAL(8)').estado, 'INCOMPATIBLE');
});

test('con claves: cada identidad firma lo suyo y el eje se reconstruye exigiendo firmas', async () => {
  const claves = {};
  for (const id of ['casa', 'organizadora', 'proveedor']) claves[id] = await generarClaves();
  const { eje, consolidacion, ejecucion } = await ejemploTarea({ claves });
  assert.equal(eje.obtener(ejecucion.id).firmante, 'organizadora');
  for (const id of eje.orden) assert.ok(eje.obtener(id).firma, 'sin firma: ' + id.slice(0, 8));
  const copia = await Eje.desde(eje.orden.map((id) => eje.obtener(id)), { exigirFirmas: true });
  assert.equal(copia.orden.length, eje.orden.length);
  assert.equal(copia.saldo('proveedor', 'E:EUR'), 310);
  assert.equal(estadoDe(copia, consolidacion.id), 'EJECUTADO');
});
