import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ejemploReserva, confirmarReserva, reservar, nochesDe, nochesEntre, plaza, precioDe, denominacionPlaza, seriePlaza, libres,
  PLAZAS, HABITACION, TEMPORADA, CASA, EUR, P_ALOJAMIENTO, P_RECEPCION,
} from '../ejemplos/ikisai/reserva-booking.mjs';
import { decupla, render } from '../src/pointed.js';
import { resolver, indicesDe } from '../src/btml.js';
import { evaluar, consultar } from '../src/bql.js';
import { ocupantes, arbol, colisiones } from '../src/encaje.js';
import { descubrir, consolidar, autorizar, ejecutar, liberar, recursoDe, estadoDe, consolidaciones, ocupacion, tramoDe, registrosEn, FABRICA } from '../src/motor.js';
import { ejeTemporal } from '../src/tiempo.js';
import { generarClaves } from '../src/autoridad.js';
import { serializar, restaurar } from '../src/persistencia.js';

const T = '2026-11-09T09:00:00Z';
const SIETE = '7000000000';
const pago = (cantidad, de) => ({ token: 'E', emisor: CASA, denominacion: 'EUR', cantidad, de, a: CASA });
const minutos = (de, cantidad = 1) => ({ token: 'T', escala: 'minuto', cantidad, de, a: null });

/** Otra persona huésped, con dinero y tiempo, dada de alta por la casa. */
async function altaHuesped(eje, id, { eur = 200, t = '2026-11-08T08:00:00Z' } = {}) {
  return eje.escribir({
    autor: CASA,
    sobre: eje.genesisId,
    t,
    movimientos: [minutos(CASA), { token: 'E', emisor: CASA, denominacion: 'EUR', cantidad: eur, de: CASA, a: id }, { token: 'T', escala: 'minuto', cantidad: 300, de: CASA, a: id }],
    payload: ['Alta de otra persona huésped', [id]],
    contexto: { tipos: { [id]: 'persona' } },
  });
}

/** Tokens de plaza que tiene una identidad: { '<plaza>@<noche>': cantidad } sin el id de la habitación. */
function plazasDe(eje, id, habitacion) {
  return Object.fromEntries(eje.recursos(id).filter((r) => r.denominacion.includes('@')).map((r) => [r.denominacion.slice(habitacion.id.length + 1), r.cantidad]));
}

test('ejemplo Ikisai: una reserva de alojamiento recorre el eje entero (saldos, plazas, poderes, tipos e hilo)', async () => {
  const { eje, alta, alojamiento, delegacion, habitacion, temporada, reserva, entrega, pago: pagada } = await ejemploReserva();
  assert.deepEqual(eje.identidades(), [CASA, 'recepcion', 'huesped']);
  // VG, 7-11 noche: la casa que emite plazas es una persona (antes, un grupo).
  assert.deepEqual([CASA, 'recepcion', 'huesped'].map((id) => eje.tipo(id)), ['persona', 'persona', 'persona']);
  // génesis, altas, alojamiento, delegación, habitación, temporada, reserva, sus noches; entrega y pago (consolidación,
  // autorización, ejecución y la liberación del P que recepción bloqueó, cada una)
  assert.equal(eje.orden.length, 16);
  // Dinero, de la serie de la casa: dio 300 a la persona huésped y cobró 165 al ejecutar.
  assert.equal(eje.saldo(CASA, EUR), 365);
  assert.equal(eje.saldo('huesped', EUR), 135);
  assert.deepEqual(eje.recursos('recepcion'), []);
  // Plazas: la ejecución movió de la casa a la persona huésped un token por noche (20, 21 y 22; la noche de salida no).
  assert.deepEqual(plazasDe(eje, 'huesped', habitacion), { '1100000000@2026-11-20': 1, '1100000000@2026-11-21': 1, '1100000000@2026-11-22': 1 });
  assert.deepEqual(['2026-11-19', '2026-11-20', '2026-11-22', '2026-11-23'].map((n) => libres(eje, habitacion.id, PLAZAS.individual, n)), [1, 0, 0, 1]);
  assert.deepEqual(entrega.ejecucion.movimientos.slice(1).map((m) => [m.denominacion, m.de, m.a]), ['2026-11-20', '2026-11-21', '2026-11-22'].map((n) => [denominacionPlaza(habitacion.id, PLAZAS.individual, n), CASA, 'huesped']));
  // Poder: siempre con ámbito. La casa lo tiene sobre todo el eje, emitió 10 P:Alojamiento (su dominio) y delegó 6 a
  // recepción. La persona huésped no acuña P sobre su reserva (VG, 7-11 noche: autorizar = bloquear P sobre el
  // registro del recurso, el Alojamiento; deshace el apaño de la #62).
  assert.deepEqual(eje.poderes(CASA), [{ ambito: 'genesis', cantidad: 10 }, { ambito: alojamiento.id, cantidad: P_ALOJAMIENTO - P_RECEPCION }]);
  assert.deepEqual(eje.poderes('recepcion'), [{ ambito: alojamiento.id, cantidad: P_RECEPCION }]);
  assert.deepEqual(eje.poderes('huesped'), []);
  assert.deepEqual(eje.serie('P:' + alojamiento.id), { emisor: CASA, emitido: P_ALOJAMIENTO });
  assert.equal(alojamiento.payload, 'Alojamiento');
  assert.equal(delegacion.sobre, alojamiento.id);
  assert.deepEqual(delegacion.movimientos[3], { token: 'P', cantidad: P_RECEPCION, ambito: alojamiento.id, de: CASA, a: 'recepcion' });
  // Recepción tiene P sobre lo que cuelga del Alojamiento (la disponibilidad, la reserva), no las altas ni el génesis.
  for (const id of [alojamiento.id, habitacion.id, reserva.id]) assert.equal(eje.poderSobre('recepcion', id), P_RECEPCION);
  assert.equal(eje.poderSobre('recepcion', alta.id), 0);
  assert.equal(eje.poderSobre('recepcion', eje.genesisId), 0);
  // El recurso de las dos partes es el Alojamiento, y recepción, con más de la mitad, las autorizó; ejecutadas, liberó su P.
  assert.deepEqual([entrega, pagada].map((x) => recursoDe(eje, x.consolidacion.id)), [alojamiento.id, alojamiento.id]);
  assert.deepEqual(eje.bloqueos('recepcion'), []);
  // Tiempo, por escala: cada registro gasta minutos de su autor; las horas solo se reparten.
  assert.equal(eje.saldoT(CASA, 'hora'), 1000 - 40 - 72);
  // altas, alojamiento, delegación, habitación, temporada, consolidación y ejecución de la entrega
  // Integración 7-11: con #42 la ejecución cuesta un minuto por posición escrita (3), no uno fijo; se lee de su movimiento.
  assert.equal(entrega.ejecucion.movimientos[0].cantidad, 3);
  assert.equal(eje.saldoT(CASA, 'minuto'), 5000 - 1 - 600 - 600 - 1 - 1 - 10 - 1 - entrega.consolidacion.movimientos[0].cantidad - entrega.ejecucion.movimientos[0].cantidad);
  const liberaciones = eje.orden.map((id) => eje.obtener(id)).filter((e) => e.autor === 'recepcion' && e.contexto?.libera);
  assert.equal(liberaciones.length, 2);
  assert.equal(eje.saldoT('recepcion', 'minuto'), 600 - entrega.autorizacion.movimientos[0].cantidad - pagada.autorizacion.movimientos[0].cantidad - liberaciones.reduce((s, e) => s + e.movimientos[0].cantidad, 0));
  // reserva (11 posiciones), sus noches (2), consolidación y ejecución del pago
  assert.equal(eje.saldoT('huesped', 'minuto'), 600 - 11 - 2 - pagada.consolidacion.movimientos[0].cantidad - pagada.ejecucion.movimientos[0].cantidad);
  // El hilo es la evidencia: ejecución → consolidación → reserva → habitación → alojamiento → génesis.
  assert.deepEqual(eje.hilo(pagada.ejecucion.id).map((x) => x.id), [pagada.ejecucion.id, pagada.consolidacion.id, reserva.id, habitacion.id, alojamiento.id, eje.genesisId]);
  assert.deepEqual(eje.hilo(entrega.ejecucion.id).map((x) => x.autor), [CASA, CASA, 'huesped', CASA, CASA, CASA]);
  assert.deepEqual(eje.sobre(alojamiento.id).map((x) => x.id), [delegacion.id, habitacion.id]);
  assert.deepEqual(eje.sobre(habitacion.id).map((x) => x.id), [temporada.id, reserva.id]);
  assert.deepEqual([entrega.autorizacion.autor, pagada.autorizacion.autor], ['recepcion', 'recepcion']);
  assert.deepEqual([entrega.ejecucion.payload[0], pagada.ejecucion.payload[0]], ['Plaza entregada', 'Pagada']);
  const texto = render(decupla(reserva));
  assert.match(texto, /^1 recursos\s+\[5 posiciones\]$/m);
  assert.match(texto, /^4 fábrica\s+\[2 posiciones\]$/m);
});

test('la disponibilidad: sus plazas son posiciones 1.k con nombre, precio y capacidad, y la casa emite su serie por plaza y noche', async () => {
  const { eje, habitacion, temporada } = await ejemploReserva({ confirmar: false });
  assert.deepEqual(habitacion.payload, HABITACION); // una copia: el evento no comparte arrays con la constante
  assert.notEqual(habitacion.payload, HABITACION);
  assert.deepEqual(PLAZAS, { matrimonio: 0, individual: 1, litera: 2 });
  assert.equal(plaza(PLAZAS.individual), '1100000000');
  assert.equal(precioDe(PLAZAS.litera), '1210000000');
  assert.deepEqual(resolver(habitacion.payload, plaza(PLAZAS.individual)), ['cama individual', 'EUR 55', 1]);
  assert.deepEqual(resolver(habitacion.payload, plaza(PLAZAS.litera)), ['litera', 'EUR 25', 2]);
  assert.equal(resolver(habitacion.payload, precioDe(PLAZAS.litera)), 'EUR 25');
  // Límite conocido de los ceros finales: la primera plaza colisiona con la posición 1 entera y con su nombre.
  assert.deepEqual(ocupantes(eje, habitacion.id, [1, 0]).map((o) => o.camino), [[1], [1, 0], [1, 0, 0]]);
  // La temporada: un token por plaza y noche, tantos como capacidad; la serie es de la casa y solo ella la emite.
  const noches = nochesEntre(...TEMPORADA);
  assert.equal(noches.length, 14);
  assert.deepEqual([noches[0], noches[13]], ['2026-11-16', '2026-11-29']);
  assert.equal(temporada.autor, CASA);
  assert.equal(temporada.sobre, habitacion.id);
  assert.equal(temporada.movimientos.length, 2 + 3 * 14); // VG, 7-11 noche: T, R de la casa en juego y las plazas
  assert.equal(seriePlaza(habitacion.id, PLAZAS.litera, '2026-11-20'), 'E:casa/' + habitacion.id + '.1200000000@2026-11-20');
  for (const [k, capacidad] of [[PLAZAS.matrimonio, 1], [PLAZAS.individual, 1], [PLAZAS.litera, 2]]) {
    for (const n of noches) {
      assert.deepEqual(eje.serie(seriePlaza(habitacion.id, k, n)), { emisor: CASA, emitido: capacidad });
      assert.equal(libres(eje, habitacion.id, k, n), capacidad);
    }
  }
  assert.equal(libres(eje, habitacion.id, PLAZAS.individual, '2026-11-30'), 0); // fuera de la temporada no hay plaza
  // Nadie emite la serie de otro: la persona huésped no puede fabricarse plazas de la casa.
  const falsa = { token: 'E', emisor: CASA, denominacion: denominacionPlaza(habitacion.id, PLAZAS.individual, '2026-11-20'), cantidad: 1, de: null, a: CASA };
  await assert.rejects(eje.escribir({ autor: 'huesped', sobre: habitacion.id, t: T, movimientos: [minutos('huesped'), falsa], payload: 'plazas' }), /nadie emite en nombre de otro/);
});

test('las referencias no copian: plaza y precio son un solo nodo, y las fórmulas BQL calculan el total y lo componen con el tiempo', async () => {
  const { eje, habitacion, reserva, pago: pagada } = await ejemploReserva();
  const laPlaza = reserva.payload[1][0];
  const precio = reserva.payload[1][2];
  assert.equal(laPlaza.ref, habitacion.id);
  assert.deepEqual(resolver(eje.obtener(laPlaza.ref).payload, laPlaza.dir), ['cama individual', 'EUR 55', 1]);
  assert.equal(resolver(eje.obtener(precio.ref).payload, precio.dir), 'EUR 55');
  assert.deepEqual(indicesDe(laPlaza.dir), [1, 1]);
  assert.deepEqual(indicesDe(precio.dir), [1, 1, 1]); // el precio cuelga de la plaza
  // 1.3: precio por noche (por referencia) × noches; LOCAL lee la décupla anidada a su profundidad.
  const total = evaluar(eje, reserva.id, [1, 3]);
  assert.equal(total.estado, 'RESUELTO');
  assert.equal(total.texto, '165 EUR');
  assert.ok(total.dependencias.includes(habitacion.id + ':1110000000'));
  // 1.4: el total compuesto con el tiempo que ocupa; composición heterogénea, operandos preservados.
  const conTiempo = evaluar(eje, reserva.id, [1, 4]);
  assert.equal(conTiempo.texto, '165 EUR + 3 dia');
  assert.equal(conTiempo.valor.tipo, 'composicion');
  // La fábrica consolidó lo que se paga como fórmula que lee el total de la reserva, con el id completo.
  assert.equal(pagada.consolidacion.payload[4], '=REF("' + reserva.id + '", "1300000000")');
  assert.equal(evaluar(eje, pagada.consolidacion.id, [4]).texto, '165 EUR');
  // Prefijo denso, sin relleno: de 0 a 4 (4 es lo que prepara: las dos partes de la ejecución); ni 5 ni 6.
  assert.equal(reserva.payload.length, 5);
  assert.deepEqual(reserva.payload[4], ['pagar', 'ocupar']);
  // Lo lejano, por anclaje: las noches en el 7 de la propia reserva, escritas por quien reserva.
  const [noches] = eje.sobre(reserva.id, SIETE);
  assert.deepEqual([noches.autor, noches.payload], ['huesped', ['2026-11-20', '2026-11-23']]);
});

test('encaje de la dirección 1 de la reserva: colisiones por ceros, lo alcanzado por la referencia y su procedencia', async () => {
  const { eje, habitacion, reserva, entrega, pago: pagada } = await ejemploReserva();
  const oc = ocupantes(eje, reserva.id, [1]);
  // [1] y [1.0] colisionan en 1000000000 (rutas que coinciden: exactos); lo alcanzado viene de la plaza 1100000000 de la habitación.
  assert.deepEqual(oc.map((o) => o.origen), ['propio', 'propio', 'referencia']);
  assert.deepEqual(oc.map((o) => o.camino), [[1], [1, 0], [1, 1]]);
  assert.ok(oc.slice(0, 2).every((o) => o.signo === 'exacto' && o.acuerdo === 10));
  assert.deepEqual(oc[2].contenido, ['cama individual', 'EUR 55', 1]);
  assert.equal(oc[2].evento, habitacion.id);
  assert.equal(oc[2].origenDir, '1100000000');
  assert.equal(oc[2].destino, '1000000000');
  assert.deepEqual(oc[2].procedencia, [reserva.id + ':1000000000#1.0', habitacion.id + ':1100000000']);
  assert.ok(Array.isArray(oc[2].vector) && oc[2].vector.length === 10); // el vector es información; no ordena
  const oc2 = ocupantes(eje, reserva.id, [2]);
  assert.deepEqual(oc2.map((o) => o.origen), ['propio', 'propio', 'referencia']);
  assert.equal(oc2[2].contenido, 'con desayuno');
  // En 4, lo propio (lo que prepara) y las dos consolidaciones escritas encima, ancladas justo ahí, por llegada.
  const oc4 = ocupantes(eje, reserva.id, [4]);
  assert.deepEqual(oc4.map((o) => o.origen), ['propio', 'propio', 'escrito', 'escrito']);
  assert.deepEqual(oc4.slice(2).map((o) => o.evento), [entrega.consolidacion.id, pagada.consolidacion.id]);
  assert.ok(oc4.slice(2).every((o) => o.signo === 'exacto'));
  // Descubrir etiqueta lo alcanzado con su posición 0: la plaza se lee «cama individual» (la etiqueta no decide el estado).
  const d = descubrir(eje, reserva.id);
  assert.equal(d[0].candidatos.find((c) => c.origen === 'referencia').etiqueta, 'cama individual');
  const c = colisiones(arbol(eje, reserva.id));
  assert.equal(c.find((x) => x.dir === '1000000000').ocupantes.length, 3);
  assert.equal(c.find((x) => x.dir === '2000000000').ocupantes.length, 3);
  // Integración 7-11: con #36 la colisión entera se pide por dirección; por índice, BUSCAR(1) es el camino exacto (solo [1]).
  assert.equal(consultar(eje, reserva.id, [1], 'CONTAR(BUSCAR("1000000000"))').texto, '3');
  assert.equal(consultar(eje, reserva.id, [1], 'CONTAR(FILTRAR(BUSCAR("1000000000"), SIGNO() = "exacto"))').texto, '2');
  assert.equal(consultar(eje, reserva.id, [1], 'CONTAR(BUSCAR(1))').texto, '1');
  // Cada consolidación guarda el encaje de sus fuentes: de dónde vino cada elección y dónde se colocó.
  const e = pagada.consolidacion.contexto.encaje;
  assert.deepEqual(e.map((x) => [x.posicion, x.evento, x.origen, x.destino]), [[1, habitacion.id, '1100000000', '1000000000'], [2, habitacion.id, '2100000000', '2000000000']]);
  assert.deepEqual(pagada.consolidacion.contexto.fuentes, [habitacion.id]);
  // La de la casa elige la plaza y, por referencia, la acción «ocupar» de lo que prepara la reserva (4.1).
  assert.deepEqual(entrega.consolidacion.payload[4], { ref: reserva.id, dir: '4100000000' });
  assert.equal(ocupantes(eje, entrega.consolidacion.id, [4]).find((o) => o.origen === 'referencia').contenido, 'ocupar');
  assert.deepEqual(entrega.consolidacion.contexto.fuentes, [habitacion.id, reserva.id]);
});

test('anclaje: la reserva vive en la plaza (1.1) de la habitación, con las noches ancladas en su propio 7', async () => {
  const { eje, habitacion, reserva } = await ejemploReserva();
  assert.equal(reserva.sobre, habitacion.id);
  assert.equal(reserva.en, plaza(PLAZAS.individual));
  assert.deepEqual(eje.sobre(habitacion.id, plaza(PLAZAS.individual)).map((x) => x.id), [reserva.id]);
  // En la plaza: ella misma, su nombre (colisión por ceros) y la reserva escrita encima.
  const oc = ocupantes(eje, habitacion.id, [1, 1]);
  assert.deepEqual(oc.map((o) => o.origen), ['propio', 'propio', 'escrito']);
  assert.equal(oc[2].evento, reserva.id);
  // El motor la ve desde la habitación bajando a sus recursos: descubrir con camino [1] mira las plazas.
  const d = descubrir(eje, habitacion.id, { camino: [1], posiciones: [1] });
  assert.ok(d[0].candidatos.some((c) => c.origen === 'escrito' && c.evento === reserva.id));
  // El tramo sale del 7 de la reserva: lo anclado ahí por su autora.
  const [noches] = eje.sobre(reserva.id, SIETE);
  const tramo = tramoDe(eje, reserva.id);
  assert.deepEqual([tramo.inicio, tramo.fin, tramo.extremos, tramo.desde], [Date.parse('2026-11-20'), Date.parse('2026-11-23'), ['2026-11-20', '2026-11-23'], noches.id]);
  assert.deepEqual(ocupantes(eje, reserva.id, [7]).map((o) => [o.origen, o.evento]), [['escrito', noches.id]]);
  // En el eje temporal de la reserva, las noches aparecen como un escrito sobre ella (no como fechas: hallazgo anotado).
  const et = ejeTemporal(eje, reserva.id, { ahora: '2026-11-08T19:00:00Z' });
  assert.ok(et.pasado.some((x) => x.id === noches.id));
  // Las noches que se entregan: comprobadas contra 1.1 y contra la plaza referenciada.
  assert.deepEqual(nochesDe(eje, reserva).noches, ['2026-11-20', '2026-11-21', '2026-11-22']);
  // El contador del motor solo informa: la plaza tiene capacidad 1 y esta reserva, ya válida, no cuenta contra sí misma.
  assert.deepEqual(ocupacion(eje, reserva.id).map((o) => [o.dir, o.camino, o.capacidad, o.aLaVez, o.cabe]), [['1100000000', [1, 1], 1, 0, true]]);
});

test('estado del ciclo: la casa entrega la plaza y la persona huésped paga, cada parte con su consolidación autorizada por recepción', async () => {
  const { eje, habitacion, reserva } = await ejemploReserva({ confirmar: false });
  assert.equal(eje.orden.length, 8);
  assert.deepEqual(consolidaciones(eje, reserva.id), []);
  const d = descubrir(eje, reserva.id);
  const laPlaza = d[0].candidatos.find((c) => c.origen === 'referencia');
  assert.equal(laPlaza.etiqueta, 'cama individual');
  // Pagar: la persona huésped consolida, recepción autoriza, ella ejecuta con el pago E.
  const c = await consolidar(eje, { autor: 'huesped', foco: reserva.id, t: T, titulo: 'Reserva en firme', elecciones: { 1: { candidato: laPlaza }, 4: 'pagar 165 EUR' } });
  assert.equal(c.en, FABRICA);
  assert.equal(estadoDe(eje, c.id), 'PENDIENTE DE AUTORIZACIÓN');
  assert.deepEqual(c.payload[1], { ref: habitacion.id, dir: '1100000000' });
  assert.deepEqual(c.payload[2], { ref: reserva.id, dir: '2000000000' }); // hueco heredado del foco por referencia
  assert.equal(eje.saldo('huesped', EUR), 300); // consolidar no es pagar
  await assert.rejects(ejecutar(eje, { autor: 'huesped', consolidacion: c.id, t: T }), /PENDIENTE DE AUTORIZACIÓN/);
  // Quien reserva no tiene P sobre el Alojamiento (el registro del recurso): no autoriza nada (VG, 7-11 noche).
  await assert.rejects(autorizar(eje, { autorizante: 'huesped', consolidacion: c.id, t: T }), /huesped no tiene P que cuente para autorizar: cuenta el P sobre el registro del recurso/);
  const a = await autorizar(eje, { autorizante: 'recepcion', consolidacion: c.id, t: T, nota: 'confirmada' });
  assert.equal(a.payload, '==confirmada');
  assert.deepEqual(a.movimientos[1], { token: 'P', ambito: recursoDe(eje, c.id), cantidad: P_RECEPCION, de: 'recepcion', a: 'recepcion', estado: 'bloqueo', salida: c.id });
  assert.equal(estadoDe(eje, c.id), 'AUTORIZADO');
  await assert.rejects(ejecutar(eje, { autor: 'recepcion', consolidacion: c.id, t: T }), /ejecuta el autor/);
  // Los tokens de plaza son de la casa: la persona huésped no se los lleva en su propia ejecución.
  const robo = { token: 'E', emisor: CASA, denominacion: denominacionPlaza(habitacion.id, PLAZAS.individual, '2026-11-20'), cantidad: 1, de: CASA, a: 'huesped' };
  await assert.rejects(ejecutar(eje, { autor: 'huesped', consolidacion: c.id, t: T, movimientos: [pago(165, 'huesped'), robo] }), /nadie mueve tokens ajenos/);
  const e = await ejecutar(eje, { autor: 'huesped', consolidacion: c.id, t: T, movimientos: [pago(165, 'huesped')] });
  assert.equal(estadoDe(eje, c.id), 'EJECUTADO');
  assert.deepEqual(e.contexto.evidencia, [c.id, a.id]);
  assert.equal(eje.saldo('huesped', EUR), 135);
  assert.equal(eje.saldo(CASA, EUR), 365);
  // Ejecutada, el P de recepción queda liberable: solo ella lo libera (nadie mueve tokens ajenos).
  assert.equal(eje.bloqueado('recepcion', 'P:' + recursoDe(eje, c.id), c.id), P_RECEPCION);
  await liberar(eje, { titular: 'recepcion', consolidacion: c.id, t: T });
  assert.deepEqual([eje.bloqueos('recepcion'), eje.saldo('recepcion', 'P:' + recursoDe(eje, c.id))], [[], P_RECEPCION]);
  assert.equal(estadoDe(eje, c.id), 'EJECUTADO');
  // Ocupar: la confirmación del ejemplo sigue desde lo hecho (el pago no se repite) y la casa entrega las plazas.
  const { entrega, pago: pagada, yaConfirmada } = await confirmarReserva(eje, reserva);
  assert.equal(yaConfirmada, undefined);
  assert.equal(pagada.consolidacion.id, c.id);
  assert.equal(pagada.ejecucion.id, e.id);
  assert.deepEqual([entrega.consolidacion.autor, entrega.autorizacion.autor, entrega.ejecucion.autor], [CASA, 'recepcion', CASA]);
  assert.deepEqual(entrega.ejecucion.payload.slice(1), [{ ref: entrega.consolidacion.id }, { ref: entrega.autorizacion.id }]);
  assert.equal(eje.saldo('huesped', EUR), 135); // sin segundo cobro
  assert.equal(Object.keys(plazasDe(eje, 'huesped', habitacion)).length, 3);
  assert.deepEqual(consolidaciones(eje, reserva.id).map((x) => [x.autor, x.estado]), [['huesped', 'EJECUTADO'], [CASA, 'EJECUTADO']]);
  // Sin P sobre el registro del recurso no se autoriza: recepción no puede con una consolidación sobre las altas
  // (otro dominio de la casa, sin P propio: ahí cuenta el P del eje, que tiene la casa).
  const { eje: otroEje, alta } = await ejemploReserva({ confirmar: false });
  const fuera = await consolidar(otroEje, { autor: 'huesped', foco: alta.id, t: T, elecciones: { 1: 'otra cosa' } });
  await assert.rejects(autorizar(otroEje, { autorizante: 'recepcion', consolidacion: fuera.id, t: T }), /recepcion no tiene P que cuente para autorizar: .*el P sobre todo el eje/);
  await autorizar(otroEje, { autorizante: CASA, consolidacion: fuera.id, t: T });
  assert.equal(estadoDe(otroEje, fuera.id), 'AUTORIZADO');
});

test('confirmar es idempotente: una reserva ya confirmada devuelve su confirmación, no cobra dos veces ni entrega otra plaza', async () => {
  const primera = await ejemploReserva();
  const { eje, habitacion, reserva } = primera;
  // La casa da más dinero a la persona huésped: si se volviera a cobrar, habría saldo para ello.
  await eje.escribir({ autor: CASA, sobre: eje.genesisId, t: '2026-11-10T08:00:00Z', movimientos: [minutos(CASA), { token: 'E', emisor: CASA, denominacion: 'EUR', cantidad: 200, de: CASA, a: 'huesped' }], payload: 'Más saldo' });
  const antes = eje.orden.length;
  const otra = await confirmarReserva(eje, reserva, { t: '2026-11-10T09:00:00Z' });
  assert.equal(otra.yaConfirmada, true);
  for (const parte of ['entrega', 'pago']) {
    for (const paso of ['consolidacion', 'autorizacion', 'ejecucion']) assert.equal(otra[parte][paso].id, primera[parte][paso].id);
  }
  assert.equal(eje.orden.length, antes); // nada nuevo en el eje
  assert.equal(consolidaciones(eje, reserva.id).length, 2);
  assert.equal(eje.saldo('huesped', EUR), 135 + 200);
  assert.equal(eje.saldo(CASA, EUR), 365 - 200);
  assert.equal(Object.keys(plazasDe(eje, 'huesped', habitacion)).length, 3);
});

test('capacidad: dos reservas solapadas de la cama individual colisionan en la plaza, y la segunda no se ejecuta por saldo insuficiente', async () => {
  const { eje, habitacion, reserva } = await ejemploReserva(); // la primera, del 20 al 23, ya es válida
  await altaHuesped(eje, 'huesped2');
  const segunda = await reservar(eje, { autor: 'huesped2', habitacion, plaza: PLAZAS.individual, noches: ['2026-11-22', '2026-11-24'], t: '2026-11-08T20:00:00Z' });
  // Escribirla no reserva nada: se escribe y colisiona con la primera en la plaza; se ven las dos.
  assert.deepEqual(ocupantes(eje, habitacion.id, [1, 1]).filter((o) => o.origen === 'escrito').map((o) => o.evento), [reserva.id, segunda.id]);
  // El contador informa de que no cabría; quien decide es el saldo de la casa: la noche del 22 ya no tiene token.
  const [o] = ocupacion(eje, segunda.id);
  assert.deepEqual([o.capacidad, o.aLaVez, o.cabe], [1, 1, false]);
  assert.deepEqual(o.validos.map((v) => [v.id, v.anclado]), [[reserva.id, true]]);
  assert.deepEqual(['2026-11-22', '2026-11-23'].map((n) => libres(eje, habitacion.id, PLAZAS.individual, n)), [0, 1]);
  await assert.rejects(confirmarReserva(eje, segunda, { t: '2026-11-09T10:00:00Z' }), (e) => {
    assert.match(e.message, /saldo insuficiente de E:casa\/[0-9a-f]{64}\.1100000000@2026-11-22 en casa/);
    assert.doesNotMatch(e.message, /@2026-11-23/); // la del 23 sí estaba
    return true;
  });
  // La entrega quedó consolidada y autorizada, pero no ejecutada; el pago, ni empezado: sin cobro y sin plazas movidas.
  assert.deepEqual(consolidaciones(eje, segunda.id).map((c) => [c.autor, c.estado]), [[CASA, 'AUTORIZADO']]);
  assert.equal(eje.saldo('huesped2', EUR), 200);
  assert.deepEqual(plazasDe(eje, 'huesped2', habitacion), {});
  assert.equal(libres(eje, habitacion.id, PLAZAS.individual, '2026-11-23'), 1);
  // Reintentar no escribe otra consolidación: sigue desde la que había, y vuelve a fallar.
  await assert.rejects(confirmarReserva(eje, segunda, { t: '2026-11-09T11:00:00Z' }), /saldo insuficiente/);
  assert.equal(consolidaciones(eje, segunda.id).length, 1);
  // La primera sigue siendo la única válida en la plaza.
  assert.deepEqual(eje.sobre(habitacion.id, plaza(PLAZAS.individual)).filter((r) => consolidaciones(eje, r.id).some((x) => x.estado === 'EJECUTADO')).map((r) => r.id), [reserva.id]);
});

test('capacidad: dos reservas que no se solapan (la salida de una es la entrada de la otra) se ejecutan las dos', async () => {
  const { eje, habitacion, reserva } = await ejemploReserva(); // del 20 al 23
  await altaHuesped(eje, 'huesped2');
  const despues = await reservar(eje, { autor: 'huesped2', habitacion, plaza: PLAZAS.individual, noches: ['2026-11-23', '2026-11-25'], t: '2026-11-08T20:00:00Z' });
  assert.deepEqual(ocupacion(eje, despues.id).map((o) => [o.aLaVez, o.cabe]), [[0, true]]); // la noche de salida no se ocupa
  const { entrega, pago: pagada } = await confirmarReserva(eje, despues, { t: '2026-11-09T10:00:00Z' });
  assert.deepEqual([entrega.ejecucion.payload[0], pagada.ejecucion.payload[0]], ['Plaza entregada', 'Pagada']);
  assert.deepEqual(plazasDe(eje, 'huesped2', habitacion), { '1100000000@2026-11-23': 1, '1100000000@2026-11-24': 1 });
  assert.equal(eje.saldo('huesped2', EUR), 200 - 110);
  assert.equal(eje.saldo(CASA, EUR), 365 - 200 + 110);
  assert.ok([reserva, despues].every((r) => consolidaciones(eje, r.id).every((c) => c.estado === 'EJECUTADO')));
  // La capacidad es de cada plaza: la cama de matrimonio en las mismas noches que la primera también cabe.
  const otra = await reservar(eje, { autor: 'huesped2', habitacion, plaza: PLAZAS.matrimonio, noches: ['2026-11-20', '2026-11-21'], t: '2026-11-08T21:00:00Z' });
  assert.equal(otra.en, '1000000000'); // la primera plaza: colisión con la posición 1 entera
  assert.deepEqual(ocupacion(eje, otra.id).map((o) => [o.camino, o.capacidad, o.cabe]), [[[1, 0], 1, true]]); // solo la plaza declara capacidad
  await confirmarReserva(eje, otra, { t: '2026-11-09T11:00:00Z' });
  assert.equal(libres(eje, habitacion.id, PLAZAS.matrimonio, '2026-11-20'), 0);
  assert.ok(consolidaciones(eje, otra.id).every((c) => c.estado === 'EJECUTADO'));
});

test('capacidad 2: la litera tiene dos tokens por noche; la que cruza dos estancias encadenadas cabe, y una tercera a la vez no', async () => {
  const { eje, habitacion } = await ejemploReserva({ confirmar: false });
  const litera = (noches, minuto) => reservar(eje, { autor: 'huesped', habitacion, plaza: PLAZAS.litera, noches, t: '2026-11-08T19:' + minuto + ':00Z' });
  const confirmar = (r, minuto) => confirmarReserva(eje, r, { t: '2026-11-09T10:' + minuto + ':00Z' });
  const a = await litera(['2026-11-20', '2026-11-22'], 10);
  const b = await litera(['2026-11-22', '2026-11-24'], 11);
  await confirmar(a, 10);
  await confirmar(b, 11);
  // C cruza a las dos, pero cada noche solo coincide con una de ellas: queda un token el 21 y otro el 22.
  const c = await litera(['2026-11-21', '2026-11-23'], 12);
  assert.deepEqual(['2026-11-21', '2026-11-22'].map((n) => libres(eje, habitacion.id, PLAZAS.litera, n)), [1, 1]);
  const [oc] = ocupacion(eje, c.id);
  assert.deepEqual([oc.capacidad, oc.validos.length, oc.aLaVez, oc.cabe], [2, 2, 1, true]);
  await confirmar(c, 12);
  // D, la noche del 21: ya están A y C, y la casa no tiene token de esa noche.
  const d = await litera(['2026-11-21', '2026-11-22'], 13);
  assert.deepEqual(ocupacion(eje, d.id).map((o) => [o.aLaVez, o.cabe]), [[2, false]]);
  await assert.rejects(confirmar(d, 13), /saldo insuficiente de E:casa\/[0-9a-f]{64}\.1200000000@2026-11-21 en casa/);
  assert.deepEqual([a, b, c, d].map((r) => consolidaciones(eje, r.id).map((x) => x.estado)), [['EJECUTADO', 'EJECUTADO'], ['EJECUTADO', 'EJECUTADO'], ['EJECUTADO', 'EJECUTADO'], ['AUTORIZADO']]);
  assert.equal(eje.saldo('huesped', EUR), 300 - 3 * 50); // tres estancias de dos noches a 25 EUR; la cuarta no se cobra
  assert.equal(plazasDe(eje, 'huesped', habitacion)['1200000000@2026-11-21'], 2);
});

test('antes de mover nada: la reserva ha de estar anclada en la plaza que referencia, con tramo acotado y 1.1 igual a sus noches', async () => {
  const { eje, habitacion } = await ejemploReserva({ confirmar: false });
  let minuto = 10;
  // Después de las reservas a mano (21:10, 21:11…): el t de un evento no es anterior al de su foco ([X] confirmar VG, src/ciclo.js).
  const t = '2026-11-08T22:00:00Z';
  const escribir = async ({ en = plaza(PLAZAS.individual), refPlaza = plaza(PLAZAS.individual), noches = 3, tramo = ['2026-11-20', '2026-11-23'] } = {}) => {
    const t = '2026-11-08T21:' + minuto++ + ':00Z'; // cada reserva a mano es un registro distinto
    const r = await eje.escribir({
      autor: 'huesped', sobre: habitacion.id, en, t, movimientos: [minutos('huesped', 11)],
      payload: ['Reserva a mano', [{ ref: habitacion.id, dir: refPlaza }, noches, { ref: habitacion.id, dir: precioDe(indicesDe(refPlaza)[1] ?? 0) }, '=LOCAL(2) * LOCAL(1)'], ['con desayuno'], ['huesped', 'recepcion'], ['pagar', 'ocupar']],
    });
    if (tramo) await eje.escribir({ autor: 'huesped', sobre: r.id, en: SIETE, t, movimientos: [minutos('huesped', 2)], payload: tramo });
    return r;
  };
  const sinNada = async (r, patron) => {
    const antes = eje.orden.length;
    await assert.rejects(confirmarReserva(eje, r), patron);
    assert.equal(eje.orden.length, antes); // no se escribió nada: ni consolidación ni cobro
  };
  // 1.1 dice 2 noches y el 7 tiene 3: se cobrarían 2 y se ocuparían 3.
  await sinNada(await escribir({ noches: 2 }), /las noches de 1\.1 \(2\) no coinciden con el tramo del 7 \(2026-11-20 – 2026-11-23: 3\)/);
  // Anclada en la litera (la barata) pero referenciando la cama individual: no se acepta.
  await sinNada(await escribir({ en: plaza(PLAZAS.litera) }), /no está anclada en la plaza que referencia: anclada en 1200000000, referencia 1100000000/);
  // Sin tramo en el 7, o ilegible: un tramo es acotado.
  await sinNada(await escribir({ tramo: null }), /sin tramo en el 7/);
  await sinNada(await escribir({ tramo: ['2026-11-23', '2026-11-20'] }), /tramo ilegible en el 7/);
  // Por horas no: las noches van por fecha.
  await sinNada(await escribir({ tramo: ['2026-11-20T15:00:00Z', '2026-11-23T11:00:00Z'] }), /las noches van por fecha/);
  // Un tramo anclado por otra identidad no es el de la reserva.
  const ajena = await escribir({ tramo: null });
  await eje.escribir({ autor: 'recepcion', sobre: ajena.id, en: SIETE, t, movimientos: [minutos('recepcion', 2)], payload: ['2026-11-20', '2026-11-23'] });
  assert.throws(() => tramoDe(eje, ajena.id), /sin tramo en el 7/);
  // Sin saldo para pagar, la casa no entrega la plaza.
  await altaHuesped(eje, 'pobre', { eur: 10 });
  const cara = await reservar(eje, { autor: 'pobre', habitacion, plaza: PLAZAS.matrimonio, noches: ['2026-11-20', '2026-11-22'], t });
  await sinNada(cara, /sin saldo para pagar 160 EUR: no se entrega la plaza/);
  assert.equal(libres(eje, habitacion.id, PLAZAS.matrimonio, '2026-11-20'), 1);
});

test('el contador informativo cuenta también lo que referencia la plaza desde otro anclaje', async () => {
  const { eje, habitacion, alojamiento, reserva } = await ejemploReserva();
  const t = '2026-11-09T12:00:00Z';
  // Un registro anclado fuera de la plaza (en el dominio) que la referencia, con su tramo y validado por el motor a mano.
  const fuera = await eje.escribir({ autor: 'huesped', sobre: alojamiento.id, t, movimientos: [minutos('huesped', 2)], payload: ['Estancia apuntada en el dominio', { ref: habitacion.id, dir: plaza(PLAZAS.individual) }] });
  await eje.escribir({ autor: 'huesped', sobre: fuera.id, en: SIETE, t, movimientos: [minutos('huesped', 2)], payload: ['2026-11-25', '2026-11-27'] });
  const c = await consolidar(eje, { autor: 'huesped', foco: fuera.id, t, elecciones: { 1: { ref: habitacion.id, dir: plaza(PLAZAS.individual) } } });
  await autorizar(eje, { autorizante: 'recepcion', consolidacion: c.id, t });
  await ejecutar(eje, { autor: 'huesped', consolidacion: c.id, t });
  await liberar(eje, { titular: 'recepcion', consolidacion: c.id, t }); // recupera su P para la siguiente
  // Los registros de la plaza, por llegada: la reserva anclada, las consolidaciones que la nombran (no son válidas: no tienen
  // ejecución propia) y el de fuera.
  const enLaPlaza = registrosEn(eje, habitacion.id, plaza(PLAZAS.individual));
  assert.equal(enLaPlaza[0].id, reserva.id);
  assert.ok(enLaPlaza.some((r) => r.id === fuera.id));
  assert.ok(enLaPlaza.filter((r) => r.id !== reserva.id && r.id !== fuera.id).every((r) => r.contexto?.fase === 'consolidado'));
  // Otra reserva del 26 al 28 se cruza con el de fuera: el contador lo cuenta, aunque esté anclado en otro sitio.
  await altaHuesped(eje, 'huesped2');
  const otra = await reservar(eje, { autor: 'huesped2', habitacion, plaza: PLAZAS.individual, noches: ['2026-11-26', '2026-11-28'], t });
  const [o] = ocupacion(eje, otra.id);
  assert.deepEqual(o.validos.map((v) => [v.id, v.anclado]), [[fuera.id, false]]);
  assert.deepEqual([o.aLaVez, o.cabe], [1, false]);
  // Solo informa: lo que decide es el saldo de la casa, que el de fuera no tocó (no movió tokens), así que esta sí se entrega.
  await confirmarReserva(eje, otra, { t });
  assert.ok(consolidaciones(eje, otra.id).every((x) => x.estado === 'EJECUTADO'));
});

test('con claves, cada identidad firma lo suyo y el eje se reconstruye verificando todo', async () => {
  const claves = { casa: await generarClaves(), recepcion: await generarClaves(), huesped: await generarClaves() };
  const { eje, habitacion, reserva } = await ejemploReserva({ claves });
  for (const id of eje.orden) {
    const ev = eje.obtener(id);
    assert.ok(ev.firma, 'sin firma: ' + ev.autor);
    assert.equal(ev.firmante, ev.autor);
  }
  assert.deepEqual(eje.clave('recepcion'), claves.recepcion.publica);
  const datos = JSON.parse(JSON.stringify(serializar(eje)));
  const otro = await restaurar({ ...datos, exigirFirmas: true });
  assert.deepEqual(otro.orden, eje.orden);
  assert.equal(otro.saldo(CASA, EUR), 365);
  assert.equal(libres(otro, habitacion.id, PLAZAS.individual, '2026-11-21'), 0);
  assert.equal(otro.poderSobre('recepcion', reserva.id), P_RECEPCION); // su P:Alojamiento, liberado tras las dos ejecuciones
  assert.equal(evaluar(otro, reserva.id, [1, 3]).texto, '165 EUR');
  assert.deepEqual(ocupacion(otro, reserva.id).map((o) => o.cabe), [true]);
});
