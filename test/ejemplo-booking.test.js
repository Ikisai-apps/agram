import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ejemploReserva, confirmarReserva, reservar, nochesDe, nochesEntre, plaza, precioDe, denominacionPlaza, seriePlaza, libres,
  abrirTemporada, tokenPlaza, familiaPlaza, caducaNoche, ALOJAMIENTO, PLAZAS, PLAZAS_POR_NOCHE, HABITACION, TEMPORADA, CASA, EUR, P_ALOJAMIENTO, P_RECEPCION,
} from '../ejemplos/ikisai/reserva-booking.mjs';
import { decupla, render } from '../src/pointed.js';
import { resolver, indicesDe } from '../src/btml.js';
import { evaluar, consultar } from '../src/bql.js';
import { ocupantes, arbol, colisiones } from '../src/encaje.js';
import { descubrir, consolidar, autorizar, ejecutar, liberar, recursoDe, estadoDe, consolidaciones, ocupacion, tramoDe, registrosEn, FABRICA } from '../src/motor.js';
import { ejeTemporal } from '../src/tiempo.js';
import { generarClaves } from '../src/autoridad.js';
import { serializar, restaurar } from '../src/persistencia.js';
import { colateral } from '../src/lente.js';

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
    // T no cruza de persona (VG, 7-11 noche): la persona huésped escribe con su propio T, que acuña al gastarlo.
    movimientos: [minutos(CASA), { token: 'E', emisor: CASA, denominacion: 'EUR', cantidad: eur, de: CASA, a: id }],
    payload: ['Alta de otra persona huésped', [id]],
    contexto: { tipos: { [id]: 'persona' } },
  });
}

/** Tokens de plaza que tiene una identidad: { '<plaza>@<noche>': cantidad }, de las series atadas a la habitación. */
function plazasDe(eje, id, habitacion) {
  return Object.fromEntries(eje.recursos(id).filter((r) => r.registro === habitacion.id).map((r) => [r.denominacion, r.cantidad]));
}

test('ejemplo Ikisai: una reserva de alojamiento recorre el eje entero (saldos, plazas, poderes, tipos e hilo)', async () => {
  const { eje, alta, alojamiento, delegacion, habitacion, abierta, respaldo, temporada, reserva, entrega, pago: pagada } = await ejemploReserva();
  assert.deepEqual(eje.identidades(), [CASA, 'recepcion', 'huesped']);
  // VG, 7-11 noche: la casa que emite plazas es una persona (antes, un grupo).
  assert.deepEqual([CASA, 'recepcion', 'huesped'].map((id) => eje.tipo(id)), ['persona', 'persona', 'persona']);
  // génesis, altas, alojamiento (la raíz del dominio), delegación, habitación, su oferta pública («cualquiera» en su 2.3,
  // R8), el respaldo de recepción, temporada, reserva, sus noches; entrega y pago (consolidación, autorización con el P que
  // ya respalda las plazas y ejecución, cada una: no hay P que liberar, VG 8-11)
  assert.equal(eje.orden.length, 16);
  // Dinero, de la serie de la casa: dio 300 a la persona huésped y cobró 165 al ejecutar.
  assert.equal(eje.saldo(CASA, EUR), 365);
  assert.equal(eje.saldo('huesped', EUR), 135);
  // Recepción no tiene dinero: solo las 40 horas que la casa le cedió de su tiempo (E:casa/hora; T no cruza de persona).
  assert.deepEqual(eje.recursos('recepcion'), [{ emisor: CASA, denominacion: 'hora', cantidad: 40 }]);
  // Plazas: la ejecución movió de la casa a la persona huésped un token por noche (20, 21 y 22; la noche de salida no).
  assert.deepEqual(plazasDe(eje, 'huesped', habitacion), { '1100000000@2026-11-20': 1, '1100000000@2026-11-21': 1, '1100000000@2026-11-22': 1 });
  assert.deepEqual(['2026-11-19', '2026-11-20', '2026-11-22', '2026-11-23'].map((n) => libres(eje, habitacion.id, PLAZAS.individual, n)), [1, 0, 0, 1]);
  assert.deepEqual(entrega.ejecucion.movimientos.slice(1).map((m) => [m.denominacion, m.registro, m.de, m.a]), ['2026-11-20', '2026-11-21', '2026-11-22'].map((n) => [denominacionPlaza(PLAZAS.individual, n), habitacion.id, CASA, 'huesped']));
  // Poder: siempre con ámbito. La casa lo tiene sobre todo el eje, emitió 4 P:Alojamiento (la raíz de su dominio) y delegó
  // 3 a recepción. La persona huésped no acuña P sobre su reserva (VG, 7-11 noche: autorizar = bloquear P sobre el
  // registro del recurso, el Alojamiento; deshace el apaño de la #62). Ya no hay «Reservas» aparte (VG, 8-11).
  const kp = 'P:' + alojamiento.id;
  assert.equal(alojamiento.sobre, eje.genesisId);
  assert.deepEqual(eje.serie(kp), { emisor: CASA, emitido: P_ALOJAMIENTO });
  assert.equal(delegacion.sobre, alojamiento.id);
  assert.deepEqual(delegacion.movimientos[3], { token: 'P', cantidad: P_RECEPCION, ambito: alojamiento.id, de: CASA, a: 'recepcion' });
  // El alojamiento declara su capacidad (R2): 4 plazas, que el eje cuenta por noche (la franja).
  assert.deepEqual(alojamiento.payload, ['Alojamiento', ['plazas por noche'], 4]);
  assert.deepEqual(ALOJAMIENTO, alojamiento.payload);
  // Todo el P:Alojamiento respalda plazas, para todas las noches: la casa la de matrimonio (1), recepción la individual
  // (1) y la litera (2). No queda P:Alojamiento disponible: el que decide es el mismo que respalda.
  const porPlaza = (id) => [PLAZAS.matrimonio, PLAZAS.individual, PLAZAS.litera].map((k) => eje.bloqueado(id, kp, familiaPlaza(habitacion.id, k)));
  assert.deepEqual([porPlaza(CASA), porPlaza('recepcion')], [[1, 0, 0], [0, 1, 2]]);
  assert.equal(familiaPlaza(habitacion.id, PLAZAS.litera), 'E:casa/1200000000@*@' + habitacion.id);
  assert.deepEqual(eje.poderes(CASA), [{ ambito: 'genesis', cantidad: 10 }]);
  assert.deepEqual(eje.poderes('recepcion'), []);
  assert.deepEqual(eje.poderes('huesped'), []);
  assert.deepEqual(respaldo.movimientos.slice(1).map((m) => [m.de, m.estado, m.cantidad, m.salida]), [['recepcion', 'bloqueo', 1, familiaPlaza(habitacion.id, PLAZAS.individual)], ['recepcion', 'bloqueo', 2, familiaPlaza(habitacion.id, PLAZAS.litera)]]);
  // El recurso de las dos partes es el Alojamiento (el más cercano del hilo con P propio emitido, VG 8-11), y recepción, con 3 de 4 respaldando plazas (más de la mitad), las
  // autorizó diciéndolo, sin bloquear nada más; ejecutadas, ese P sigue respaldando las plazas (VG, 8-11).
  assert.deepEqual([entrega, pagada].map((x) => recursoDe(eje, x.consolidacion.id)), [alojamiento.id, alojamiento.id]);
  assert.deepEqual([entrega, pagada].map((x) => [x.autorizacion.movimientos.length, x.autorizacion.contexto.autoridad.respaldo, x.autorizacion.contexto.autoridad.bloquea]), [[1, true, []], [1, true, []]]);
  assert.deepEqual(porPlaza('recepcion'), [0, 1, 2]);
  assert.equal(eje.bloqueos('recepcion').length, 2);
  // Tiempo, por escala: cada registro gasta minutos de su autor; las horas solo se reparten.
  // T no cruza de persona (VG, 7-11 noche): las horas que la casa cede son E:casa/hora; su T:hora queda entero.
  assert.equal(eje.saldoT(CASA, 'hora'), 1000);
  // altas, alojamiento, delegación, habitación, su oferta pública (1), temporada, consolidación y ejecución de la entrega
  // Integración 7-11: con #42 la ejecución cuesta un minuto por posición escrita (3), no uno fijo; se lee de su movimiento.
  assert.equal(entrega.ejecucion.movimientos[0].cantidad, 3);
  assert.equal(eje.saldoT(CASA, 'minuto'), 5000 - 1 - 1 - 1 - 10 - 1 - 1 - entrega.consolidacion.movimientos[0].cantidad - entrega.ejecucion.movimientos[0].cantidad);
  const liberaciones = eje.orden.map((id) => eje.obtener(id)).filter((e) => e.autor === 'recepcion' && e.contexto?.libera);
  assert.equal(liberaciones.length, 0);
  // Recepción y la persona huésped no recibieron T: el que gastan lo acuñan al gastarlo (cuenta contra su reloj) y
  // no les queda saldo; lo que gastaron se ve en lo que consumieron (y en el registro que soporta cada escrito).
  const consumido = (id) => eje.orden.map((x) => eje.obtener(x)).filter((e) => e.autor === id && e.contexto?.genesis !== true)
    .reduce((s, e) => s + e.movimientos.filter((m) => m.token === 'T' && m.escala === 'minuto' && m.de === id && m.a === null).reduce((x, m) => x + m.cantidad, 0), 0);
  assert.deepEqual([eje.saldoT('recepcion', 'minuto'), eje.saldoT('huesped', 'minuto')], [0, 0]);
  // Recepción: su respaldo (1) y sus dos autorizaciones.
  assert.equal(consumido('recepcion'), 1 + entrega.autorizacion.movimientos[0].cantidad + pagada.autorizacion.movimientos[0].cantidad);
  // reserva (11 posiciones), sus noches (2), consolidación y ejecución del pago
  assert.equal(consumido('huesped'), 11 + 2 + pagada.consolidacion.movimientos[0].cantidad + pagada.ejecucion.movimientos[0].cantidad);
  assert.equal(eje.emitidoT('huesped', 'minuto'), consumido('huesped')); // lo acuñado cuenta como emitido (Core, 8-11)
  // El hilo es la evidencia: ejecución → consolidación → reserva → habitación → alojamiento → génesis.
  assert.deepEqual(eje.hilo(pagada.ejecucion.id).map((x) => x.id), [pagada.ejecucion.id, pagada.consolidacion.id, reserva.id, habitacion.id, alojamiento.id, eje.genesisId]);
  assert.deepEqual(eje.hilo(entrega.ejecucion.id).map((x) => x.autor), [CASA, CASA, 'huesped', CASA, CASA, CASA]);
  assert.deepEqual(eje.sobre(alojamiento.id).map((x) => x.id), [delegacion.id, habitacion.id, respaldo.id]);
  assert.deepEqual(entrega.ejecucion.contexto.evidencia, [entrega.consolidacion.id, entrega.autorizacion.id]);
  assert.deepEqual(eje.sobre(habitacion.id).map((x) => x.id), [abierta.id, temporada.id, reserva.id]);
  assert.deepEqual([entrega.autorizacion.autor, pagada.autorizacion.autor], ['recepcion', 'recepcion']);
  assert.deepEqual([entrega.ejecucion.payload[0], pagada.ejecucion.payload[0]], ['Plaza entregada', 'Pagada']);
  const texto = render(decupla(reserva));
  assert.match(texto, /^1 recursos\s+\[5 posiciones\]$/m);
  // VG, 7-11 noche: por hojas, la 4 es [['pagar'], ['ocupar']], una décupla (la entrega elige 4.1). Y Pointed corta duro en 10
  // (decisión 10.2): la reserva tiene 11 posiciones con contenido, así que 'ocupar', la última por índice, queda fuera y se avisa.
  assert.match(texto, /^4 fábrica\s+\[1 posiciones\] \(cortada\)$/m);
  assert.match(texto, /^aviso: Pointed corta en su máximo \(10 posiciones\): .*queda cortada la 4\. Trae 10 de 11 posiciones\.$/m);
  assert.deepEqual(reserva.payload[4], [['pagar'], ['ocupar']]); // leer no muta el registro
});

test('la disponibilidad: sus plazas son posiciones 1.k con nombre, precio y capacidad, y la casa emite su serie por plaza y noche', async () => {
  const { eje, habitacion, temporada } = await ejemploReserva({ confirmar: false });
  assert.deepEqual(habitacion.payload, HABITACION); // una copia: el evento no comparte arrays con la constante
  assert.notEqual(habitacion.payload, HABITACION);
  assert.deepEqual(PLAZAS, { matrimonio: 0, individual: 1, litera: 2 });
  assert.equal(plaza(PLAZAS.individual), '1100000000');
  assert.equal(precioDe(PLAZAS.litera), '1210000000');
  // VG, 7-11 noche: por hojas: la plaza es una décupla con cada posición entre corchetes (1.k.0 es una lista de uno).
  assert.deepEqual(resolver(habitacion.payload, plaza(PLAZAS.individual)), [['cama individual'], ['EUR 55'], [1]]);
  assert.deepEqual(resolver(habitacion.payload, plaza(PLAZAS.litera)), [['litera'], ['EUR 25'], [2]]);
  assert.deepEqual(resolver(habitacion.payload, precioDe(PLAZAS.litera)), ['EUR 25']); // 1.2.1: la lista de un ocupante
  // Límite conocido de los ceros finales: la primera plaza colisiona con la posición 1 entera y con su nombre.
  assert.deepEqual(ocupantes(eje, habitacion.id, [1, 0]).map((o) => o.camino), [[1], [1, 0], [1, 0, 0]]);
  // La temporada: un token por plaza y noche, tantos como capacidad; la serie es de la casa y solo ella la emite.
  const noches = nochesEntre(...TEMPORADA);
  assert.equal(noches.length, 14);
  assert.deepEqual([noches[0], noches[13]], ['2026-11-16', '2026-11-29']);
  assert.equal(temporada.autor, CASA);
  assert.equal(temporada.sobre, habitacion.id);
  // VG, 7-11 noche: T y el bloqueo del P de la casa para la plaza que respalda ella sola (R2; las otras dos las respalda
  // recepción, que bloqueó antes su P), y las plazas por noche. La R de la casa ya está en juego: su colateral (R6),
  // bloqueado al emitir P sobre el alojamiento.
  assert.equal(temporada.movimientos.length, 1 + 1 + 3 * 14);
  assert.equal(seriePlaza(habitacion.id, PLAZAS.litera, '2026-11-20'), 'E:casa/1200000000@2026-11-20@' + habitacion.id);
  // La de matrimonio la emite la casa sola; la individual y la litera, con recepción de coemisora (emisión conjunta: su
  // firma es su bloqueo).
  for (const [k, capacidad, conjunta] of [[PLAZAS.matrimonio, 1, {}], [PLAZAS.individual, 1, { emisores: [CASA, 'recepcion'] }], [PLAZAS.litera, 2, { emisores: [CASA, 'recepcion'] }]]) {
    for (const n of noches) {
      const clave = seriePlaza(habitacion.id, k, n);
      assert.deepEqual(eje.serie(clave), { emisor: CASA, emitido: capacidad, caduca: caducaNoche(n), ...conjunta });
      assert.equal(eje.registroDe(clave), habitacion.id);
      assert.equal(libres(eje, habitacion.id, k, n), capacidad);
    }
  }
  assert.equal(caducaNoche('2026-11-20'), '2026-11-21T12:00:00Z');
  assert.equal(libres(eje, habitacion.id, PLAZAS.individual, '2026-11-30'), 0); // fuera de la temporada no hay plaza
  // La habitación hereda el tope del alojamiento, por noche: catorce noches de 4, y en ninguna cabe una más.
  const topes = eje.topes(habitacion.id, T);
  assert.deepEqual(topes.map((x) => x.franja), noches);
  assert.ok(topes.every((x) => x.registro === eje.obtener(habitacion.sobre).id && x.capacidad === PLAZAS_POR_NOCHE && x.vivo === 4 && x.libre === 0));
  assert.deepEqual(eje.topes(habitacion.id, T, '2026-11-30').map((x) => [x.franja, x.vivo, x.libre]), [['2026-11-30', 0, 4]]);
  // Nadie emite la serie de otro: la persona huésped no puede fabricarse plazas de la casa.
  const falsa = { ...tokenPlaza(habitacion.id, PLAZAS.individual, '2026-11-20', 1, null, CASA) };
  await assert.rejects(eje.escribir({ autor: 'huesped', sobre: habitacion.id, t: T, movimientos: [minutos('huesped'), falsa], payload: 'plazas' }), /nadie emite en nombre de otro/);
});

test('las referencias no copian: plaza y precio son un solo nodo, y las fórmulas BQL calculan el total y lo componen con el tiempo', async () => {
  const { eje, habitacion, reserva, pago: pagada } = await ejemploReserva();
  const laPlaza = reserva.payload[1][0][0]; // VG, 7-11 noche: por hojas: la 1.0 es una lista de uno, la referencia
  const precio = reserva.payload[1][2][0]; // 1.2 entre corchetes: la lista de un ocupante, la referencia
  assert.equal(laPlaza.ref, habitacion.id);
  assert.deepEqual(resolver(eje.obtener(laPlaza.ref).payload, laPlaza.dir), [['cama individual'], ['EUR 55'], [1]]);
  assert.deepEqual(resolver(eje.obtener(precio.ref).payload, precio.dir), ['EUR 55']);
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
  assert.deepEqual(reserva.payload[4], [['pagar'], ['ocupar']]); // por hojas: una décupla, cada posición entre corchetes
  // Lo lejano, por anclaje: las noches en el 7 de la propia reserva, escritas por quien reserva.
  const [noches] = eje.sobre(reserva.id, SIETE);
  assert.deepEqual([noches.autor, noches.payload], ['huesped', [['2026-11-20'], ['2026-11-23']]]);
});

test('encaje de la dirección 1 de la reserva: colisiones por ceros, lo alcanzado por la referencia y su procedencia', async () => {
  const { eje, habitacion, reserva, entrega, pago: pagada } = await ejemploReserva();
  const oc = ocupantes(eje, reserva.id, [1]);
  // [1] y [1.0] colisionan en 1000000000 (rutas que coinciden: exactos); lo alcanzado viene de la plaza 1100000000 de la habitación.
  assert.deepEqual(oc.map((o) => o.origen), ['propio', 'propio', 'referencia']);
  assert.deepEqual(oc.map((o) => o.camino), [[1], [1, 0], [1, 1]]);
  assert.ok(oc.slice(0, 2).every((o) => o.signo === 'exacto' && o.acuerdo === 10));
  assert.deepEqual(oc[2].contenido, [['cama individual'], ['EUR 55'], [1]]); // VG, 7-11 noche: por hojas: cada posición de la plaza va entre corchetes
  assert.equal(oc[2].evento, habitacion.id);
  assert.equal(oc[2].origenDir, '1100000000');
  assert.equal(oc[2].destino, '1000000000');
  // VG, 7-11 noche: por hojas: la referencia es el elemento 0 de la lista de la 1.0, y su procedencia lo dice.
  assert.deepEqual(oc[2].procedencia, [reserva.id + ':1000000000#1.0[0]', habitacion.id + ':1100000000']);
  assert.ok(Array.isArray(oc[2].vector) && oc[2].vector.length === 10); // el vector es información; no ordena
  // VG, 7-11 noche: por hojas: la 2 es una lista de una referencia (a la lista entera de criterios de la
  // habitación): su elemento es el ocupante propio, y lo alcanzado es esa lista.
  const oc2 = ocupantes(eje, reserva.id, [2]);
  assert.deepEqual(oc2.map((o) => o.origen), ['propio', 'referencia']);
  assert.deepEqual(oc2[1].contenido, ['sin humo', 'con desayuno']);
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
  assert.equal(c.find((x) => x.dir === '2000000000').ocupantes.length, 2); // VG, 7-11 noche: por hojas: el elemento y lo que alcanza
  // Integración 7-11: con #36 la colisión entera se pide por dirección; por índice, BUSCAR(1) es el camino exacto (solo [1]).
  assert.equal(consultar(eje, reserva.id, [1], 'CONTAR(BUSCAR("1000000000"))').texto, '3');
  assert.equal(consultar(eje, reserva.id, [1], 'CONTAR(FILTRAR(BUSCAR("1000000000"), SIGNO() = "exacto"))').texto, '2');
  assert.equal(consultar(eje, reserva.id, [1], 'CONTAR(BUSCAR(1))').texto, '1');
  // Cada consolidación guarda el encaje de sus fuentes: de dónde vino cada elección y dónde se colocó.
  const e = pagada.consolidacion.contexto.encaje;
  // VG, 7-11 noche: por hojas: el criterio de la reserva referencia la lista entera (2000000000), no un elemento.
  assert.deepEqual(e.map((x) => [x.posicion, x.evento, x.origen, x.destino]), [[1, habitacion.id, '1100000000', '1000000000'], [2, habitacion.id, '2000000000', '2000000000']]);
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
  // El motor la ve desde la habitación bajando a sus recursos: descubrir con camino [1] mira las plazas. Es
  // elegible porque la habitación declara en su 2.3 que `cualquiera` puede reservar (R8, src/elegibles.js).
  const d = descubrir(eje, habitacion.id, { camino: [1], posiciones: [1] });
  assert.ok(d[0].candidatos.some((c) => c.origen === 'escrito' && c.evento === reserva.id));
  assert.equal(d[0].noElegibles, 0);
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
  assert.equal(eje.orden.length, 10); // con la oferta pública (R8) y el respaldo de recepción
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
  // La casa, con 1 de 4 respaldando la cama de matrimonio, lo dice, pero no basta (más de la mitad).
  const deLaCasa = await autorizar(eje, { autorizante: CASA, consolidacion: c.id, t: T });
  assert.deepEqual([deLaCasa.movimientos.length, deLaCasa.contexto.autoridad.respaldo, estadoDe(eje, c.id)], [1, true, 'PENDIENTE DE AUTORIZACIÓN']);
  // Recepción autoriza con el P que ya respalda la individual y la litera (3): lo dice, sin bloquear nada más (VG, 8-11).
  const a = await autorizar(eje, { autorizante: 'recepcion', consolidacion: c.id, t: T, nota: 'confirmada' });
  assert.equal(a.payload, '==confirmada');
  assert.equal(a.movimientos.length, 1); // el T de escribirlo: ningún P se mueve
  assert.deepEqual(a.contexto.autoridad.respalda.map((b) => [b.salida, b.cantidad]), [[familiaPlaza(habitacion.id, PLAZAS.individual), 1], [familiaPlaza(habitacion.id, PLAZAS.litera), 2]]);
  assert.equal(estadoDe(eje, c.id), 'AUTORIZADO');
  await assert.rejects(ejecutar(eje, { autor: 'recepcion', consolidacion: c.id, t: T }), /ejecuta el autor/);
  // Los tokens de plaza son de la casa: la persona huésped no se los lleva en su propia ejecución.
  const robo = { token: 'E', emisor: CASA, denominacion: denominacionPlaza(PLAZAS.individual, '2026-11-20'), registro: habitacion.id, cantidad: 1, de: CASA, a: 'huesped' };
  await assert.rejects(ejecutar(eje, { autor: 'huesped', consolidacion: c.id, t: T, movimientos: [pago(165, 'huesped'), robo] }), /nadie mueve tokens ajenos/);
  const e = await ejecutar(eje, { autor: 'huesped', consolidacion: c.id, t: T, movimientos: [pago(165, 'huesped')] });
  assert.equal(estadoDe(eje, c.id), 'EJECUTADO');
  assert.deepEqual(e.contexto.evidencia, [c.id, deLaCasa.id, a.id]);
  assert.equal(eje.saldo('huesped', EUR), 135);
  assert.equal(eje.saldo(CASA, EUR), 365);
  // Ejecutada, nada se libera: el P de recepción no estaba bloqueado por la consolidación, sigue respaldando las plazas.
  const kp = 'P:' + recursoDe(eje, c.id);
  assert.equal(eje.bloqueado('recepcion', kp, c.id), 0);
  assert.deepEqual([eje.bloqueado('recepcion', kp), eje.saldo('recepcion', kp)], [P_RECEPCION, 0]);
  assert.ok(!e.movimientos.some((m) => m.estado === 'liberacion'));
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
    assert.match(e.message, /saldo insuficiente de E:casa\/1100000000@2026-11-22@[0-9a-f]{64} en casa/);
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
  await assert.rejects(confirmar(d, 13), /saldo insuficiente de E:casa\/1200000000@2026-11-21@[0-9a-f]{64} en casa/);
  assert.deepEqual([a, b, c, d].map((r) => consolidaciones(eje, r.id).map((x) => x.estado)), [['EJECUTADO', 'EJECUTADO'], ['EJECUTADO', 'EJECUTADO'], ['EJECUTADO', 'EJECUTADO'], ['AUTORIZADO']]);
  assert.equal(eje.saldo('huesped', EUR), 300 - 3 * 50); // tres estancias de dos noches a 25 EUR; la cuarta no se cobra
  assert.equal(plazasDe(eje, 'huesped', habitacion)['1200000000@2026-11-21'], 2);
});

test('antes de mover nada: la reserva ha de estar anclada en la plaza que referencia, con tramo acotado y 1.1 igual a sus noches', async () => {
  const { eje, habitacion } = await ejemploReserva({ confirmar: false });
  let minuto = 10;
  // Después de las reservas a mano (21:10, 21:11…): el t de un evento no es anterior al de su foco ([X] confirmar VG, src/ciclo.js).
  const t = '2026-11-08T22:00:00Z';
  const escribir = async ({ en = plaza(PLAZAS.individual), refPlaza = plaza(PLAZAS.individual), noches = 3, tramo = [['2026-11-20'], ['2026-11-23']] } = {}) => {
    const t = '2026-11-08T21:' + minuto++ + ':00Z'; // cada reserva a mano es un registro distinto
    const r = await eje.escribir({
      autor: 'huesped', sobre: habitacion.id, en, t, movimientos: [minutos('huesped', 11)],
      // Forma canónica (VG, 8-11): cada posición de la 1 (y de la 4) entre corchetes.
      payload: ['Reserva a mano', [[{ ref: habitacion.id, dir: refPlaza }], [noches], [{ ref: habitacion.id, dir: precioDe(indicesDe(refPlaza)[1] ?? 0) }], ['=LOCAL(2) * LOCAL(1)']], ['con desayuno'], ['huesped', 'recepcion'], [['pagar'], ['ocupar']]],
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
  await sinNada(await escribir({ tramo: [['2026-11-23'], ['2026-11-20']] }), /tramo ilegible en el 7/);
  // Por horas no: las noches van por fecha.
  await sinNada(await escribir({ tramo: [['2026-11-20T15:00:00Z'], ['2026-11-23T11:00:00Z']] }), /las noches van por fecha/);
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
  // Retira su autorización: ya ejecutada, nada cambia, y su P sigue respaldando las plazas (no lo mueve).
  const retiro = await liberar(eje, { titular: 'recepcion', consolidacion: c.id, t });
  assert.deepEqual([retiro.movimientos.length, estadoDe(eje, c.id), eje.bloqueado('recepcion', 'P:' + alojamiento.id)], [1, 'EJECUTADO', P_RECEPCION]);
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

test('E atada al recurso (R2): 4 plazas por noche; un segundo emisor no añade una quinta esa noche, sí en otra; el E vivo baja al pasar la noche', async () => {
  const { eje, alojamiento, habitacion } = await ejemploReserva({ confirmar: false });
  // La casa y recepción respaldan las catorce noches de 4 con los 4 P:Alojamiento (uno por cama, para todas las noches).
  assert.equal(alojamiento.payload[2], 4);
  assert.deepEqual(eje.topes(habitacion.id, T, '2026-11-20').map((x) => [x.registro, x.capacidad, x.vivo, x.libre]), [[alojamiento.id, 4, 4, 0]]);
  // P:Alojamiento es una serie cerrada (R3, VG 7-11 noche) y está bloqueada entera por las plazas: para que recepción
  // respalde más, la casa la amplía con una consolidación sobre el alojamiento que autoriza recepción con el P que ya
  // respalda las plazas (VG, 8-11), y al ejecutarla emite 4 más y se los da.
  await assert.rejects(eje.escribir({ autor: CASA, sobre: alojamiento.id, t: T, payload: 'más P', movimientos: [minutos(CASA), { token: 'R', emisor: CASA, cantidad: 1, de: CASA, a: 'recepcion' }, { token: 'P', ambito: alojamiento.id, cantidad: 4, de: null, a: CASA }] }), /es una serie cerrada/);
  const amplia = await consolidar(eje, { autor: CASA, foco: alojamiento.id, t: T, titulo: 'Cuatro P más para recepción', elecciones: { 1: 'P para recepción' } });
  await autorizar(eje, { autorizante: 'recepcion', consolidacion: amplia.id, t: T });
  await ejecutar(eje, { autor: CASA, consolidacion: amplia.id, t: T, movimientos: [{ token: 'R', emisor: CASA, cantidad: 1, de: CASA, a: 'recepcion' }, { token: 'P', ambito: alojamiento.id, cantidad: 4, de: null, a: CASA }, { token: 'P', ambito: alojamiento.id, cantidad: 4, de: CASA, a: 'recepcion' }] });
  assert.deepEqual([eje.serie('P:' + alojamiento.id).emitido, eje.saldo('recepcion', 'P:' + alojamiento.id), eje.bloqueado('recepcion', 'P:' + alojamiento.id)], [8, 4, P_RECEPCION]);
  // Recepción quiere respaldar una litera más: con 2 de 8 bloqueados su cuota da 1, pero el tope es del alojamiento en
  // esa noche, sumando emisores y plazas.
  await eje.escribir({ autor: 'recepcion', sobre: eje.genesisId, t: T, payload: 'R de recepción', movimientos: [minutos('recepcion'), { token: 'R', emisor: 'recepcion', cantidad: 5, de: null, a: 'recepcion' }, colateral('recepcion', 1)] });
  const otra = (noche, t = T) => {
    const denominacion = denominacionPlaza(PLAZAS.litera, noche);
    return {
      autor: 'recepcion', sobre: habitacion.id, t, payload: 'otra litera el ' + noche,
      movimientos: [
        minutos('recepcion'), { token: 'R', emisor: 'recepcion', cantidad: 1, de: 'recepcion', a: CASA },
        { token: 'P', ambito: alojamiento.id, cantidad: 2, de: 'recepcion', a: 'recepcion', estado: 'bloqueo', salida: 'E:recepcion/' + denominacion + '@' + habitacion.id },
        { token: 'E', emisor: 'recepcion', denominacion, registro: habitacion.id, cantidad: 1, de: null, a: 'recepcion' },
      ],
    };
  };
  await assert.rejects(eje.escribir(otra('2026-11-20')), /tope de E del registro .* en la franja «2026-11-20».*llegaría a 5 y su capacidad es 4/);
  // Otra noche (fuera de la temporada de la casa) tiene sus propias 4 plazas: ahí sí cabe.
  await eje.escribir(otra('2026-11-30'));
  assert.deepEqual(eje.topes(habitacion.id, T, '2026-11-30').map((x) => [x.vivo, x.libre]), [[1, 3]]);
  // Pasada la noche del 20 (sale a las 12:00 del 21), su E deja de estar vivo y esa noche vuelve a tener sitio.
  const despues = caducaNoche('2026-11-20');
  assert.deepEqual(eje.topes(habitacion.id, despues, '2026-11-20').map((x) => x.vivo), [0]);
  assert.deepEqual(eje.topes(habitacion.id, despues, '2026-11-21').map((x) => x.vivo), [4]);
  // El eje lo ve pasar cuando llega ahí (SEG-03): fechar la emisión después no basta; un registro de la casa con ese t, sí.
  await assert.rejects(eje.escribir(otra('2026-11-20', despues)), /en la franja «2026-11-20».*llegaría a 5 y su capacidad es 4/);
  await eje.escribir({ autor: CASA, sobre: alojamiento.id, t: despues, payload: 'pasó la noche del 20', movimientos: [minutos(CASA)] });
  await eje.escribir(otra('2026-11-20', despues));
  // El P de la casa respalda todas las noches de cada cama: no se suelta mientras viva alguna.
  const suelta = { token: 'P', ambito: alojamiento.id, cantidad: 1, de: CASA, a: CASA, estado: 'liberacion', salida: familiaPlaza(habitacion.id, PLAZAS.matrimonio) };
  await assert.rejects(eje.escribir({ autor: CASA, sobre: alojamiento.id, t: despues, payload: 'suelta', movimientos: [minutos(CASA), suelta] }), /respalda 9 de E vivo: no se libera mientras viva/); // del 21 al 29
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
  assert.equal(otro.bloqueado('recepcion', 'P:' + habitacion.sobre), P_RECEPCION); // su P:Alojamiento, respaldando aún las plazas
  assert.deepEqual(consolidaciones(otro, reserva.id).map((c) => c.estado), ['EJECUTADO', 'EJECUTADO']);
  assert.equal(evaluar(otro, reserva.id, [1, 3]).texto, '165 EUR');
  assert.deepEqual(ocupacion(otro, reserva.id).map((o) => o.cabe), [true]);
});
