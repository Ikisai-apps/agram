import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ejemploReserva, confirmarReserva, reservar, nochesDe, nochesEntre, plaza, precioDe, denominacionPlaza, seriePlaza, libres,
  tokenPlaza, familiaPlaza, caducaNoche, ALOJAMIENTO, PLAZAS, PLAZAS_POR_NOCHE, HABITACION, TEMPORADA, CASA, EUR, CERRADO, RESPALDA_RECEPCION,
} from '../ejemplos/ikisai/reserva-booking.mjs';
import { entrarPorInvitacion } from '../ejemplos/ikisai/altas.mjs';
import { decupla, render } from '../src/pointed.js';
import { resolver, indicesDe } from '../src/btml.js';
import { evaluar, consultar } from '../src/bql.js';
import { ocupantes, arbol, colisiones } from '../src/encaje.js';
import { descubrir, registrar, cerrado, siguiente, ocupacion, tramoDe, registrosEn, ANUNCIO } from '../src/motor.js';
import { ejeTemporal } from '../src/tiempo.js';
import { generarClaves } from '../src/autoridad.js';
import { serializar, restaurar } from '../src/persistencia.js';

// Encargo 3b (mapa §15 [D] «Una sola operación: registrar»): ya no hay consolidar, autorizar, ejecutar ni estados
// del motor en el ciclo de la reserva. Cada parte escribe su propio movimiento sobre la reserva (la casa entrega sus
// plazas, la huésped paga sus euros) y motor.cerrado / motor.siguiente leen lo que falta. El P no se acuña ni se
// delega: se obtiene al escribir (N1) y al recibir E o R (N2) (mapa §15 [D] «P como peso de criterio»).

const T = '2026-11-09T09:00:00Z';
const SIETE = '7000000000';
const minutos = (de, cantidad = 1) => ({ token: 'T', escala: 'minuto', cantidad, de, a: null });

/**
 * Otra persona huésped: la casa la invita y ella acepta (su alta; mapa §16 [D] «El árbol mínimo es la invitación»),
 * y después la casa le da dinero.
 */
async function altaHuesped(eje, id, { eur = 200, t } = {}) {
  // Revisión de seguridad (encargo 3b): la aceptación no se fecha antes del último t del libro.
  t ??= new Date(Math.max(Date.parse('2026-11-08T08:00:00Z'), eje.tMaximo())).toISOString();
  await entrarPorInvitacion(eje, { por: CASA, quien: id, t });
  return eje.escribir({
    autor: CASA,
    sobre: eje.genesisId,
    t,
    // T no cruza de persona (VG, 7-11 noche): la persona huésped escribe con su asignación del día (VG, 8-11).
    movimientos: [minutos(CASA), { token: 'E', emisor: CASA, denominacion: 'EUR', cantidad: eur, de: CASA, a: id }],
    payload: ['Alta de otra persona huésped', [id]],
  });
}

/** Tokens de plaza que tiene una identidad: { '<plaza>@<noche>': cantidad }, de las series atadas a la habitación. */
function plazasDe(eje, id, habitacion) {
  return Object.fromEntries(eje.recursos(id).filter((r) => r.registro === habitacion.id).map((r) => [r.denominacion, r.cantidad]));
}

/** Las reservas de una lista que están cerradas (su criterio de cerrado se cumple). */
const cerradas = (eje, reservas) => reservas.map((r) => cerrado(eje, r.id).cerrado);

test('ejemplo Ikisai: una reserva de alojamiento recorre el eje entero (saldos, plazas, poderes, tipos e hilo)', async () => {
  const { eje, alojamiento, atiende, habitacion, abierta, respaldo, temporada, reserva, entrega, pago: pagada } = await ejemploReserva();
  assert.deepEqual(eje.identidades(), [CASA, 'recepcion', 'huesped']);
  // VG, 7-11 noche: la casa que emite plazas es una persona (antes, un grupo).
  assert.deepEqual([CASA, 'recepcion', 'huesped'].map((id) => eje.esPersona(id)), [true, true, true]); // B1: cada una escribe su propia alta
  // Génesis (sin movimientos) y emisión de la casa; invitación y alta de recepción y de la huésped (mapa §16 [D]); la
  // casa les da lo suyo; alojamiento (la raíz del dominio); recepción escribe que lo atiende; habitación; su oferta
  // pública («cualquiera» en su 2.3, R8); el respaldo de recepción; temporada; reserva, sus noches y sus cuatro
  // anuncios en 4.1 (tres noches y el pago); la entrega de la casa y el pago de la huésped, cada uno un registro.
  assert.equal(eje.orden.length, 21);
  // Dinero, de la serie de la casa: dio 300 a la persona huésped y cobró 165 cuando ella escribió su pago.
  assert.equal(eje.saldo(CASA, EUR), 365);
  assert.equal(eje.saldo('huesped', EUR), 135);
  // Recepción no tiene dinero: solo las 40 horas que la casa le cedió de su tiempo (E:casa/hora; T no cruza de persona).
  assert.deepEqual(eje.recursos('recepcion'), [{ emisor: CASA, denominacion: 'hora', cantidad: 40 }]);
  // Plazas: la entrega movió de la casa a la persona huésped un token por noche (20, 21 y 22; la noche de salida no).
  assert.deepEqual(plazasDe(eje, 'huesped', habitacion), { '1100000000@2026-11-20': 1, '1100000000@2026-11-21': 1, '1100000000@2026-11-22': 1 });
  assert.deepEqual(['2026-11-19', '2026-11-20', '2026-11-22', '2026-11-23'].map((n) => libres(eje, habitacion.id, PLAZAS.individual, n)), [1, 0, 0, 1]);
  // Cada parte mueve lo suyo (mapa §15 [D] «Una sola operación: registrar»): la casa, sus tres tokens de plaza; la
  // huésped, sus 165 EUR. Las dos sobre la reserva.
  assert.deepEqual([entrega.autor, entrega.sobre, entrega.payload], [CASA, reserva.id, 'Plaza entregada']);
  assert.deepEqual(entrega.movimientos.slice(1).map((m) => [m.denominacion, m.registro, m.cantidad, m.de, m.a]), ['2026-11-20', '2026-11-21', '2026-11-22'].map((n) => [denominacionPlaza(PLAZAS.individual, n), habitacion.id, 1, CASA, 'huesped']));
  assert.deepEqual([pagada.autor, pagada.sobre, pagada.payload], ['huesped', reserva.id, 'Pagada']);
  assert.deepEqual(pagada.movimientos.slice(1).map((m) => [m.token, m.emisor, m.denominacion, m.cantidad, m.de, m.a]), [['E', CASA, 'EUR', 165, 'huesped', CASA]]);
  assert.deepEqual(cerrado(eje, reserva.id), { ...cerrado(eje, reserva.id), cerrado: true, plantilla: CERRADO });
  assert.deepEqual(siguiente(eje, reserva.id, CASA), { cerrado: true, faltaDeMi: [], espera: [] });
  // El P se obtiene (mapa §15 [D] «P como peso de criterio», N1): quien escribe un registro, diez sobre él. La casa
  // tiene P sobre el Alojamiento porque lo escribió; recepción, sobre su registro «atiende», que cuelga de él.
  assert.equal(alojamiento.sobre, eje.genesisId);
  assert.deepEqual([atiende.autor, atiende.sobre], ['recepcion', alojamiento.id]);
  assert.deepEqual([eje.poderSobre(CASA, alojamiento.id), eje.poderSobre('recepcion', atiende.id)], [10, 10]);
  // Libre, diez menos lo comprometido con las plazas (1 la casa, 3 recepción).
  const libre = (id, ambito) => eje.poderes(id).find((p) => p.ambito === ambito)?.cantidad;
  assert.deepEqual([libre(CASA, alojamiento.id), libre('recepcion', atiende.id)], [9, 7]);
  assert.equal(eje.poderSobre('recepcion', alojamiento.id), 0); // ya no hay P delegado por la casa
  // N2: quien consigue E obtiene P sobre el registro de su serie. La huésped recibió en la entrega sus noches de plaza,
  // atadas a la habitación: diez P sobre ella, una sola vez aunque sus noches sean tres series (revisión de seguridad
  // del encargo 3b: una obtención por receptor y registro, sea cual sea la serie). No escribió la habitación ni nadie le dio P (antes de la entrega no tenía
  // ninguno; lo comprueba el test del ciclo).
  assert.equal(eje.poderSobre('huesped', habitacion.id), 10);
  assert.deepEqual(eje.bloqueos('huesped'), []);
  // El alojamiento declara su capacidad (R2): 4 plazas, que el eje cuenta por noche (la franja).
  assert.deepEqual(alojamiento.payload, ['Alojamiento', ['plazas por noche'], 4]);
  assert.deepEqual(ALOJAMIENTO, alojamiento.payload);
  // El P comprometido con cada plaza (todas las noches): la casa la de matrimonio (1, sobre su Alojamiento) y
  // recepción la individual (1) y la litera (2), sobre su registro.
  const kCasa = 'P:' + alojamiento.id;
  const kRecepcion = 'P:' + atiende.id;
  const porPlaza = (id, k) => [PLAZAS.matrimonio, PLAZAS.individual, PLAZAS.litera].map((p) => eje.bloqueado(id, k, familiaPlaza(habitacion.id, p)));
  assert.deepEqual([porPlaza(CASA, kCasa), porPlaza('recepcion', kRecepcion)], [[1, 0, 0], [0, 1, 2]]);
  assert.equal(familiaPlaza(habitacion.id, PLAZAS.litera), 'E:casa/1200000000@*@' + habitacion.id);
  assert.deepEqual(respaldo.movimientos.slice(1).map((m) => [m.de, m.estado, m.cantidad, m.ambito, m.salida]), Object.entries(RESPALDA_RECEPCION).map(([k, n]) => ['recepcion', 'bloqueo', n, atiende.id, familiaPlaza(habitacion.id, Number(k))]));
  // La cuota (VG, 9-11, D1): el P que comprometen los emisores de cada plaza frente a todo el comprometido con las
  // plazas del Alojamiento (4), por su capacidad (4), da justo la capacidad de cada plaza: 1, 1 y 2.
  const comprometido = [PLAZAS.matrimonio, PLAZAS.individual, PLAZAS.litera].map((p) => eje.bloqueosCon(familiaPlaza(habitacion.id, p)).filter((b) => b.clave.startsWith('P:')).reduce((s, b) => s + b.cantidad, 0));
  const total = comprometido.reduce((s, x) => s + x, 0);
  assert.deepEqual(comprometido.map((c) => (c / total) * PLAZAS_POR_NOCHE), HABITACION[1].map((p) => p[2][0]));
  // Entregadas, el P comprometido sigue respaldando las plazas: nada se libera.
  assert.deepEqual(eje.bloqueos('recepcion').map((b) => [b.clave, b.cantidad]), [[kRecepcion, 1], [kRecepcion, 2]]);
  // Tiempo, por escala: cada registro gasta minutos de su autor; las horas solo se reparten.
  // T no cruza de persona (VG, 7-11 noche): las horas que la casa cede son E:casa/hora. Y no tiene T explícito:
  // el génesis no emite T (VG, 8-11: no hay T acumulable).
  assert.equal(eje.saldo(CASA, 'T:hora'), 0);
  // VG, 8-11: asignación diaria. Cada persona gasta su asignación del día; ningún T se acumula.
  const consumido = (id) => eje.orden.map((x) => eje.obtener(x)).filter((e) => e.autor === id && e.contexto?.genesis !== true)
    .reduce((s, e) => s + e.movimientos.filter((m) => m.token === 'T' && m.escala === 'minuto' && m.de === id && m.a === null).reduce((x, m) => x + m.cantidad, 0), 0);
  assert.equal(eje.saldo(CASA, 'T:minuto'), 0);
  // La casa: su emisión (1), las dos invitaciones (1 cada una), las altas de la temporada (1), alojamiento (1),
  // habitación (10), su oferta pública (1), temporada (1) y la entrega (1).
  assert.equal(consumido(CASA), 1 + 2 + 1 + 1 + habitacion.movimientos[0].cantidad + 1 + 1 + entrega.movimientos[0].cantidad);
  assert.equal(consumido(CASA), 18);
  // Recepción y la persona huésped no recibieron T: escriben con su asignación del día y no tienen T explícito.
  assert.deepEqual([eje.saldo('recepcion', 'T:minuto'), eje.saldo('huesped', 'T:minuto')], [0, 0]);
  // Recepción: su alta (1, B1), «atiende» (1) y su respaldo (1). Ya no autoriza nada.
  assert.equal(consumido('recepcion'), 1 + 1 + 1);
  // La huésped: su alta (1), la reserva (12 posiciones), sus noches (2), los cuatro anuncios (5 cada uno) y el pago (1).
  const anuncios = eje.sobre(reserva.id, ANUNCIO);
  assert.equal(anuncios.length, 4);
  assert.equal(consumido('huesped'), 1 + reserva.movimientos[0].cantidad + 2 + anuncios.reduce((s, a) => s + a.movimientos[0].cantidad, 0) + pagada.movimientos[0].cantidad);
  assert.equal(consumido('huesped'), 36);
  // El hilo es la evidencia: pago → reserva → habitación → alojamiento → génesis.
  assert.deepEqual(eje.hilo(pagada.id).map((x) => x.id), [pagada.id, reserva.id, habitacion.id, alojamiento.id, eje.genesisId]);
  assert.deepEqual(eje.hilo(entrega.id).map((x) => x.autor), [CASA, 'huesped', CASA, CASA, CASA]);
  assert.deepEqual(eje.sobre(alojamiento.id).map((x) => x.id), [atiende.id, habitacion.id, respaldo.id]);
  assert.deepEqual(eje.sobre(habitacion.id).map((x) => x.id), [abierta.id, temporada.id, reserva.id]);
  const texto = render(decupla(reserva));
  assert.match(texto, /^1 recursos\s+\[5 posiciones\]$/m);
  // VG, 7-11 noche: por hojas, la 4 es [['pagar'], ['ocupar']]. Pointed corta duro en 10 (decisión 10.2): la reserva
  // tiene 12 posiciones con contenido (el criterio es ahora una lista de dos: los de la habitación y la plantilla de
  // cerrado), así que las dos de la 4, las últimas por índice, quedan fuera y se avisa.
  assert.match(texto, /^2 criterios\s+lista de 2: .* · all announced movements happened$/m);
  assert.match(texto, /^4 fábrica\s+— \(cortada\)$/m);
  assert.match(texto, /^aviso: Pointed corta en su máximo \(10 posiciones\): .*queda cortada la 4\. Trae 10 de 12 posiciones\.$/m);
  assert.deepEqual(reserva.payload[4], [['pagar'], ['ocupar']]); // leer no muta el registro
});

test('la disponibilidad: sus plazas son posiciones 1.k con nombre, precio y capacidad, y la casa emite su serie por plaza y noche', async () => {
  const { eje, habitacion, temporada, alojamiento } = await ejemploReserva({ confirmar: false });
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
  // T, el P que la casa compromete con la plaza que respalda ella sola (la de matrimonio; las otras dos ya las
  // comprometió recepción) y las plazas por noche. Ya no hay colateral de R (encargo 3b).
  assert.equal(temporada.movimientos.length, 1 + 1 + 3 * 14);
  assert.deepEqual(temporada.movimientos[1], { token: 'P', ambito: alojamiento.id, cantidad: 1, de: CASA, a: CASA, estado: 'bloqueo', salida: familiaPlaza(habitacion.id, PLAZAS.matrimonio) });
  assert.equal(seriePlaza(habitacion.id, PLAZAS.litera, '2026-11-20'), 'E:casa/1200000000@2026-11-20@' + habitacion.id);
  // La de matrimonio la emite la casa sola; la individual y la litera, con recepción de coemisora (emisión conjunta: su
  // firma es su P comprometido).
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
  await assert.rejects(eje.escribir({ autor: 'huesped', sobre: habitacion.id, t: T, movimientos: [minutos('huesped'), falsa], payload: 'plazas' }), /(E is minted by and to|R is minted by) its issuer/);
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
  // Lo que se paga lo anuncia la reserva en su 4.1 con la cantidad de su fórmula 1.3 (encargo 3b; antes lo copiaba la
  // consolidación como fórmula), y el pago mueve exactamente eso.
  const [aPagar] = eje.sobre(reserva.id, ANUNCIO).filter((a) => a.payload[0][0] === EUR);
  assert.deepEqual(aPagar.payload, [[EUR], [total.valor.cantidad], ['pagar'], [['huesped'], [CASA]]]);
  assert.equal(pagada.movimientos[1].cantidad, aPagar.payload[1][0]);
  // Prefijo denso, sin relleno: de 0 a 4 (4 es lo que prepara: pagar y ocupar); ni 5 ni 6.
  assert.equal(reserva.payload.length, 5);
  assert.deepEqual(reserva.payload[4], [['pagar'], ['ocupar']]); // por hojas: una décupla, cada posición entre corchetes
  // Su criterio (2): los de la habitación, por referencia, y la plantilla de cerrado que nombra su dueña (encargo 3b).
  assert.deepEqual(reserva.payload[2], [{ ref: habitacion.id, dir: '2000000000' }, CERRADO]);
  // Lo lejano, por anclaje: las noches en el 7 de la propia reserva, escritas por quien reserva.
  const [noches] = eje.sobre(reserva.id, SIETE);
  assert.deepEqual([noches.autor, noches.payload], ['huesped', [['2026-11-20'], ['2026-11-23']]]);
});

test('encaje de la dirección 1 de la reserva: colisiones por ceros, lo alcanzado por la referencia y su procedencia', async () => {
  const { eje, habitacion, reserva } = await ejemploReserva();
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
  // La 2 es una lista: la referencia a los criterios de la habitación (su elemento es un ocupante propio, y lo
  // alcanzado es esa lista) y la plantilla de cerrado (encargo 3b), otro ocupante propio.
  const oc2 = ocupantes(eje, reserva.id, [2]);
  assert.deepEqual(oc2.map((o) => o.origen), ['propio', 'referencia', 'propio']);
  assert.deepEqual(oc2[1].contenido, ['sin humo', 'con desayuno']);
  assert.equal(oc2[2].contenido, CERRADO);
  // En 4, solo lo propio (lo que prepara): ya no se escriben consolidaciones en la fábrica (mapa §15 [D] «Una sola
  // operación: registrar»). Lo que se va a mover se anuncia en 4.1: un registro por movimiento, por llegada.
  const oc4 = ocupantes(eje, reserva.id, [4]);
  assert.deepEqual(oc4.map((o) => o.origen), ['propio', 'propio']);
  const oc41 = ocupantes(eje, reserva.id, [4, 1]);
  assert.deepEqual(oc41.map((o) => o.origen), ['propio', 'escrito', 'escrito', 'escrito', 'escrito']);
  assert.deepEqual(oc41.slice(1).map((o) => o.evento), eje.sobre(reserva.id, ANUNCIO).map((a) => a.id));
  assert.ok(oc41.slice(1).every((o) => o.signo === 'exacto'));
  // Descubrir etiqueta lo alcanzado con su posición 0: la plaza se lee «cama individual» (la etiqueta no decide el estado).
  const d = descubrir(eje, reserva.id);
  assert.equal(d[0].candidatos.find((c) => c.origen === 'referencia').etiqueta, 'cama individual');
  const c = colisiones(arbol(eje, reserva.id));
  assert.equal(c.find((x) => x.dir === '1000000000').ocupantes.length, 3);
  assert.equal(c.find((x) => x.dir === '2000000000').ocupantes.length, 3); // el elemento, lo que alcanza y la plantilla
  assert.equal(c.find((x) => x.dir === ANUNCIO).ocupantes.length, 5); // 'ocupar' y los cuatro anuncios
  // Integración 7-11: con #36 la colisión entera se pide por dirección; por índice, BUSCAR(1) es el camino exacto (solo [1]).
  assert.equal(consultar(eje, reserva.id, [1], 'CONTAR(BUSCAR("1000000000"))').texto, '3');
  assert.equal(consultar(eje, reserva.id, [1], 'CONTAR(FILTRAR(BUSCAR("1000000000"), SIGNO() = "exacto"))').texto, '2');
  assert.equal(consultar(eje, reserva.id, [1], 'CONTAR(BUSCAR(1))').texto, '1');
  // Ya no hay consolidación que guarde el encaje de sus fuentes (retirada, mapa §15 [D]): lo que cada parte mueve lo
  // dicen los anuncios, y cada uno nombra la serie, la cantidad, para qué y de quién a quién.
  assert.deepEqual(eje.sobre(reserva.id, ANUNCIO).map((a) => [a.payload[1][0], a.payload[2][0], a.payload[3][0][0], a.payload[3][1][0]]), [[1, 'ocupar', CASA, 'huesped'], [1, 'ocupar', CASA, 'huesped'], [1, 'ocupar', CASA, 'huesped'], [165, 'pagar', 'huesped', CASA]]);
  assert.deepEqual(eje.sobre(reserva.id, ANUNCIO).slice(0, 3).map((a) => a.payload[0][0]), ['2026-11-20', '2026-11-21', '2026-11-22'].map((n) => seriePlaza(habitacion.id, PLAZAS.individual, n)));
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
  // El contador del motor solo informa: la plaza tiene capacidad 1 y esta reserva, ya cerrada, no cuenta contra sí misma.
  assert.deepEqual(ocupacion(eje, reserva.id).map((o) => [o.dir, o.camino, o.capacidad, o.aLaVez, o.cabe]), [['1100000000', [1, 1], 1, 0, true]]);
});

test('el ciclo: cada parte escribe su propio movimiento sobre la reserva (la casa entrega la plaza, la huésped paga) y nadie mueve lo ajeno', async () => {
  const { eje, habitacion, reserva } = await ejemploReserva({ confirmar: false });
  assert.equal(eje.orden.length, 19); // hasta la reserva, sus noches y sus cuatro anuncios
  // Sin movimientos, no está cerrada (la plantilla que nombra: «all announced movements happened»).
  assert.deepEqual([cerrado(eje, reserva.id).cerrado, cerrado(eje, reserva.id).plantilla], [false, CERRADO]);
  const d = descubrir(eje, reserva.id);
  assert.equal(d[0].candidatos.find((c) => c.origen === 'referencia').etiqueta, 'cama individual');
  // motor.siguiente dice a cada parte lo que le falta de ella: a la casa, un token de plaza por noche; a la huésped, el
  // pago, que espera a la vez lo de la casa.
  const deLaCasa = siguiente(eje, reserva.id, CASA);
  assert.deepEqual(deLaCasa.faltaDeMi.map((x) => x.que), ['2026-11-20', '2026-11-21', '2026-11-22'].map((n) => 'mover 1 ' + seriePlaza(habitacion.id, PLAZAS.individual, n) + ' de casa a huesped'));
  const deLaHuesped = siguiente(eje, reserva.id, 'huesped');
  assert.deepEqual(deLaHuesped.faltaDeMi.map((x) => [x.que, x.plantilla]), [['mover 165 ' + EUR + ' de huesped a casa', 'move what was announced']]);
  assert.equal(deLaHuesped.espera.length, 3);
  // Recepción no tiene nada que mover en esta reserva.
  assert.deepEqual(siguiente(eje, reserva.id, 'recepcion').faltaDeMi, []);
  // Los tokens de plaza son de la casa: ni la huésped ni recepción los mueven por ella (mapa §15 [D] «Una sola
  // operación: registrar»: cada parte mueve lo suyo; ya no hay autorización de lo ajeno).
  const robo = tokenPlaza(habitacion.id, PLAZAS.individual, '2026-11-20', 1, CASA, 'huesped');
  for (const autor of ['huesped', 'recepcion']) {
    await assert.rejects(registrar(eje, { autor, sobre: reserva.id, t: T, movimientos: [minutos(autor), robo], payload: 'Plaza entregada' }), /nobody moves tokens of others/);
  }
  // Pagar: la huésped escribe la transacción que le propone siguiente, con su T y su pago.
  const tx = deLaHuesped.faltaDeMi[0].transaccion;
  assert.deepEqual([tx.autor, tx.sobre], ['huesped', reserva.id]);
  const pagada = await registrar(eje, { ...tx, t: T, payload: 'Pagada' });
  assert.equal(eje.saldo('huesped', EUR), 135);
  assert.equal(eje.saldo(CASA, EUR), 365);
  // Pagada pero sin plazas, sigue abierta: a la huésped ya no le falta nada; a la casa, sus tres entregas.
  assert.equal(cerrado(eje, reserva.id).cerrado, false);
  assert.deepEqual(siguiente(eje, reserva.id, 'huesped').faltaDeMi, []);
  assert.equal(siguiente(eje, reserva.id, CASA).faltaDeMi.length, 3);
  // Confirmar sigue desde lo hecho: el pago no se repite y la casa entrega las plazas.
  const { entrega, pago, yaConfirmada } = await confirmarReserva(eje, reserva);
  assert.equal(yaConfirmada, undefined);
  assert.equal(pago.id, pagada.id);
  assert.deepEqual([entrega.autor, entrega.sobre, entrega.payload], [CASA, reserva.id, 'Plaza entregada']);
  assert.equal(eje.saldo('huesped', EUR), 135); // sin segundo cobro
  assert.equal(Object.keys(plazasDe(eje, 'huesped', habitacion)).length, 3);
  assert.equal(cerrado(eje, reserva.id).cerrado, true);
  assert.deepEqual(siguiente(eje, reserva.id, 'huesped'), { cerrado: true, faltaDeMi: [], espera: [] });
});

test('P obtenido (mapa §15 [D] N2): la huésped no tiene P sobre la habitación hasta que recibe sus noches de plaza', async () => {
  const { eje, habitacion, reserva } = await ejemploReserva({ confirmar: false });
  assert.equal(eje.poderSobre('huesped', habitacion.id), 0);
  // N1: por escribir la reserva, diez sobre ella.
  assert.equal(eje.poderSobre('huesped', reserva.id), 10);
  await confirmarReserva(eje, reserva);
  assert.equal(eje.poderSobre('huesped', habitacion.id), 10); // diez, una vez, aunque sus noches sean tres series (revisión de seguridad)
});

test('confirmar es idempotente: una reserva ya confirmada devuelve su confirmación, no cobra dos veces ni entrega otra plaza', async () => {
  const primera = await ejemploReserva();
  const { eje, habitacion, reserva } = primera;
  // La casa da más dinero a la persona huésped: si se volviera a cobrar, habría saldo para ello.
  await eje.escribir({ autor: CASA, sobre: eje.genesisId, t: '2026-11-10T08:00:00Z', movimientos: [minutos(CASA), { token: 'E', emisor: CASA, denominacion: 'EUR', cantidad: 200, de: CASA, a: 'huesped' }], payload: 'Más saldo' });
  const antes = eje.orden.length;
  const otra = await confirmarReserva(eje, reserva, { t: '2026-11-10T09:00:00Z' });
  assert.equal(otra.yaConfirmada, true);
  for (const parte of ['entrega', 'pago']) assert.equal(otra[parte].id, primera[parte].id);
  assert.equal(eje.orden.length, antes); // nada nuevo en el eje
  // Sobre la reserva, lo mismo que antes: sus noches, los cuatro anuncios, la entrega y el pago.
  assert.equal(eje.sobre(reserva.id).length, 1 + 4 + 2);
  assert.equal(eje.saldo('huesped', EUR), 135 + 200);
  assert.equal(eje.saldo(CASA, EUR), 365 - 200);
  assert.equal(Object.keys(plazasDe(eje, 'huesped', habitacion)).length, 3);
});

test('capacidad: dos reservas solapadas de la cama individual colisionan en la plaza, y la segunda no se entrega por saldo insuficiente', async () => {
  const { eje, habitacion, reserva } = await ejemploReserva(); // la primera, del 20 al 23, ya está cerrada
  await altaHuesped(eje, 'huesped2');
  const segunda = await reservar(eje, { autor: 'huesped2', habitacion, plaza: PLAZAS.individual, noches: ['2026-11-22', '2026-11-24'], t: '2026-11-09T09:30:00Z' });
  // Escribirla no reserva nada: se escribe y colisiona con la primera en la plaza; se ven las dos.
  assert.deepEqual(ocupantes(eje, habitacion.id, [1, 1]).filter((o) => o.origen === 'escrito').map((o) => o.evento), [reserva.id, segunda.id]);
  // El contador informa de que no cabría; quien decide es el saldo de la casa: la noche del 22 ya no tiene token.
  const [o] = ocupacion(eje, segunda.id);
  assert.deepEqual([o.capacidad, o.aLaVez, o.cabe], [1, 1, false]);
  assert.deepEqual(o.validos.map((v) => [v.id, v.anclado]), [[reserva.id, true]]);
  assert.deepEqual(['2026-11-22', '2026-11-23'].map((n) => libres(eje, habitacion.id, PLAZAS.individual, n)), [0, 1]);
  const antes = eje.orden.length;
  await assert.rejects(confirmarReserva(eje, segunda, { t: '2026-11-09T10:00:00Z' }), (e) => {
    assert.match(e.message, /saldo insuficiente de E:casa\/1100000000@2026-11-22@[0-9a-f]{64} en casa/);
    assert.doesNotMatch(e.message, /@2026-11-23/); // la del 23 sí estaba
    return true;
  });
  // La entrega es una sola transacción de la casa: rechazada entera, no mueve ni la noche del 23; y el pago va después,
  // así que ni empezó: sin cobro y sin plazas movidas. La reserva queda escrita y abierta.
  assert.equal(eje.orden.length, antes);
  assert.equal(eje.saldo('huesped2', EUR), 200);
  assert.deepEqual(plazasDe(eje, 'huesped2', habitacion), {});
  assert.equal(libres(eje, habitacion.id, PLAZAS.individual, '2026-11-23'), 1);
  assert.equal(cerrado(eje, segunda.id).cerrado, false);
  assert.equal(siguiente(eje, segunda.id, CASA).faltaDeMi.length, 2);
  // Reintentar no escribe nada a medias: vuelve a fallar igual.
  await assert.rejects(confirmarReserva(eje, segunda, { t: '2026-11-09T11:00:00Z' }), /saldo insuficiente/);
  assert.equal(eje.orden.length, antes);
  // La primera sigue siendo la única cerrada en la plaza.
  assert.deepEqual(eje.sobre(habitacion.id, plaza(PLAZAS.individual)).filter((r) => cerrado(eje, r.id).cerrado).map((r) => r.id), [reserva.id]);
});

test('capacidad: dos reservas que no se solapan (la salida de una es la entrada de la otra) se cierran las dos', async () => {
  const { eje, habitacion, reserva } = await ejemploReserva(); // del 20 al 23
  await altaHuesped(eje, 'huesped2');
  const despues = await reservar(eje, { autor: 'huesped2', habitacion, plaza: PLAZAS.individual, noches: ['2026-11-23', '2026-11-25'], t: '2026-11-09T09:30:00Z' });
  assert.deepEqual(ocupacion(eje, despues.id).map((o) => [o.aLaVez, o.cabe]), [[0, true]]); // la noche de salida no se ocupa
  const { entrega, pago: pagada } = await confirmarReserva(eje, despues, { t: '2026-11-09T10:00:00Z' });
  assert.deepEqual([entrega.payload, pagada.payload], ['Plaza entregada', 'Pagada']);
  assert.deepEqual(plazasDe(eje, 'huesped2', habitacion), { '1100000000@2026-11-23': 1, '1100000000@2026-11-24': 1 });
  assert.equal(eje.saldo('huesped2', EUR), 200 - 110);
  assert.equal(eje.saldo(CASA, EUR), 365 - 200 + 110);
  assert.deepEqual(cerradas(eje, [reserva, despues]), [true, true]);
  // La capacidad es de cada plaza: la cama de matrimonio en las mismas noches que la primera también cabe.
  const otra = await reservar(eje, { autor: 'huesped2', habitacion, plaza: PLAZAS.matrimonio, noches: ['2026-11-20', '2026-11-21'], t: '2026-11-09T10:30:00Z' });
  assert.equal(otra.en, '1000000000'); // la primera plaza: colisión con la posición 1 entera
  assert.deepEqual(ocupacion(eje, otra.id).map((o) => [o.camino, o.capacidad, o.cabe]), [[[1, 0], 1, true]]); // solo la plaza declara capacidad
  await confirmarReserva(eje, otra, { t: '2026-11-09T11:00:00Z' });
  assert.equal(libres(eje, habitacion.id, PLAZAS.matrimonio, '2026-11-20'), 0);
  assert.deepEqual(cerradas(eje, [otra]), [true]);
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
  assert.deepEqual(cerradas(eje, [a, b, c, d]), [true, true, true, false]);
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
    // Un movimiento anunciado en su 4.1 (el pago): sin ninguno, su criterio de cerrado se cumpliría de vacío y
    // confirmar la daría por confirmada sin mirar sus noches.
    await eje.escribir({ autor: 'huesped', sobre: r.id, en: ANUNCIO, t, movimientos: [minutos('huesped', 5)], payload: [[EUR], [165], ['pagar'], [['huesped'], [CASA]]] });
    return r;
  };
  const sinNada = async (r, patron) => {
    const antes = eje.orden.length;
    await assert.rejects(confirmarReserva(eje, r), patron);
    assert.equal(eje.orden.length, antes); // no se escribió nada: ni entrega ni pago
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

// Una reserva escrita sin anuncios en su 4.1 cumple de vacío la plantilla «all announced movements happened»; aun así,
// confirmarla comprueba sus noches y su anclaje, y sin entrega ni pago anunciados no la da por confirmada.
test('EJEMPLO-1: confirmar una reserva sin anuncios comprueba sus noches antes de darla por confirmada', async () => {
  const { eje, habitacion } = await ejemploReserva({ confirmar: false });
  const t = '2026-11-08T21:00:00Z';
  const r = await eje.escribir({
    autor: 'huesped', sobre: habitacion.id, en: plaza(PLAZAS.litera), t, movimientos: [minutos('huesped', 11)],
    payload: ['Reserva a mano', [[{ ref: habitacion.id, dir: plaza(PLAZAS.individual) }], [3], [{ ref: habitacion.id, dir: precioDe(PLAZAS.individual) }], ['=LOCAL(2) * LOCAL(1)']], ['con desayuno'], ['huesped', 'recepcion'], [['pagar'], ['ocupar']]],
  });
  await assert.rejects(confirmarReserva(eje, r), /no está anclada en la plaza que referencia/);
});

test('el contador informativo cuenta también lo que referencia la plaza desde otro anclaje', async () => {
  const { eje, habitacion, alojamiento, reserva } = await ejemploReserva();
  const t = '2026-11-09T12:00:00Z';
  // Un registro anclado fuera de la plaza (en el dominio) que la referencia, con su tramo. No anuncia movimientos, así
  // que su criterio de cerrado (la plantilla por defecto) ya se cumple: cuenta como válido. Antes había que
  // consolidarlo, autorizarlo y ejecutarlo a mano; eso se retiró (mapa §15 [D] «Una sola operación: registrar»).
  const fuera = await eje.escribir({ autor: 'huesped', sobre: alojamiento.id, t, movimientos: [minutos('huesped', 2)], payload: ['Estancia apuntada en el dominio', { ref: habitacion.id, dir: plaza(PLAZAS.individual) }] });
  await eje.escribir({ autor: 'huesped', sobre: fuera.id, en: SIETE, t, movimientos: [minutos('huesped', 2)], payload: ['2026-11-25', '2026-11-27'] });
  assert.deepEqual([cerrado(eje, fuera.id).cerrado, cerrado(eje, fuera.id).plantilla], [true, CERRADO]);
  // Los registros de la plaza, por llegada: la reserva anclada y el de fuera (ya no hay consolidaciones que la nombren).
  assert.deepEqual(registrosEn(eje, habitacion.id, plaza(PLAZAS.individual)).map((r) => r.id), [reserva.id, fuera.id]);
  // Otra reserva del 26 al 28 se cruza con el de fuera: el contador lo cuenta, aunque esté anclado en otro sitio.
  await altaHuesped(eje, 'huesped2');
  const otra = await reservar(eje, { autor: 'huesped2', habitacion, plaza: PLAZAS.individual, noches: ['2026-11-26', '2026-11-28'], t });
  const [o] = ocupacion(eje, otra.id);
  assert.deepEqual(o.validos.map((v) => [v.id, v.anclado]), [[fuera.id, false]]);
  assert.deepEqual([o.aLaVez, o.cabe], [1, false]);
  // Solo informa: lo que decide es el saldo de la casa, que el de fuera no tocó (no movió tokens), así que esta sí se entrega.
  const { entrega, pago } = await confirmarReserva(eje, otra, { t });
  assert.deepEqual([entrega.payload, pago.payload], ['Plaza entregada', 'Pagada']);
  assert.equal(cerrado(eje, otra.id).cerrado, true);
});

test('E atada al recurso (R2): 4 plazas por noche; un segundo emisor no añade una quinta esa noche, sí en otra; la cuota (D1); el E vivo baja al pasar la noche', async () => {
  const { eje, alojamiento, atiende, habitacion } = await ejemploReserva({ confirmar: false });
  // La casa y recepción respaldan las catorce noches de 4, una unidad de P comprometido por cama.
  assert.equal(alojamiento.payload[2], 4);
  assert.deepEqual(eje.topes(habitacion.id, T, '2026-11-20').map((x) => [x.registro, x.capacidad, x.vivo, x.libre]), [[alojamiento.id, 4, 4, 0]]);
  // Emitir E exige P sobre su registro: recepción no escribió la habitación y no tiene P sobre ella. Ya no hay P
  // cerrado que ampliar ni delegar (retirado, mapa §15 [D] «P como peso de criterio»): lo obtiene al recibir E de una
  // serie atada a la habitación (N2). La casa le da una noche de litera, y con ella diez P sobre la habitación.
  assert.equal(eje.poderSobre('recepcion', habitacion.id), 0);
  await eje.escribir({ autor: CASA, sobre: habitacion.id, t: T, payload: 'una noche de litera para recepción', movimientos: [minutos(CASA), tokenPlaza(habitacion.id, PLAZAS.litera, '2026-11-29', 1, CASA, 'recepcion')] });
  assert.equal(eje.poderSobre('recepcion', habitacion.id), 10);
  // Y su R propia (emitir E exige R propia emitida, VG 9-11, D2).
  await eje.escribir({ autor: 'recepcion', sobre: atiende.id, t: T, payload: 'R de recepción', movimientos: [minutos('recepcion'), { token: 'R', emisor: 'recepcion', cantidad: 5, de: null, a: 'recepcion' }] });
  // Recepción emite su propia litera de una noche, comprometiendo con ella P de su registro.
  const otra = (noche, { t = T, cantidad = 1 } = {}) => {
    const denominacion = denominacionPlaza(PLAZAS.litera, noche);
    return {
      autor: 'recepcion', sobre: habitacion.id, t, payload: 'otra litera el ' + noche,
      movimientos: [
        minutos('recepcion'),
        { token: 'P', ambito: atiende.id, cantidad: 2, de: 'recepcion', a: 'recepcion', estado: 'bloqueo', salida: 'E:recepcion/' + denominacion + '@' + habitacion.id },
        { token: 'E', emisor: 'recepcion', denominacion, registro: habitacion.id, cantidad, de: null, a: 'recepcion' },
      ],
    };
  };
  // El tope es del alojamiento en esa noche, sumando emisores y plazas.
  await assert.rejects(eje.escribir(otra('2026-11-20')), /tope de E del registro .* en la franja «2026-11-20».*llegaría a 5 y su capacidad es 4/);
  // La cuota (VG, 9-11, D1): recepción compromete 2 de P con su serie, de 6 comprometidos con las series del
  // Alojamiento; por la capacidad (4), da 1. Tres en una noche fuera de la temporada no caben, aunque el tope sí.
  await assert.rejects(eje.escribir(otra('2026-11-30', { cantidad: 3 })), /cuota de E:recepcion\/1200000000@2026-11-30@[0-9a-f]{64} en el registro .*: recepcion compromete 2 de P con la salida de la serie, de 6 comprometido .* da 1 de 4 \(hacia abajo\) y el E vivo de la serie llegaría a 3/);
  // Otra noche (fuera de la temporada de la casa) tiene sus propias 4 plazas: ahí una sí cabe.
  await eje.escribir(otra('2026-11-30'));
  assert.deepEqual(eje.topes(habitacion.id, T, '2026-11-30').map((x) => [x.vivo, x.libre]), [[1, 3]]);
  assert.deepEqual(eje.serie('E:recepcion/' + denominacionPlaza(PLAZAS.litera, '2026-11-30') + '@' + habitacion.id), { emisor: 'recepcion', emitido: 1 });
  // Pasada la noche del 20 (sale a las 12:00 del 21), su E deja de estar vivo y esa noche vuelve a tener sitio.
  const despues = caducaNoche('2026-11-20');
  assert.deepEqual(eje.topes(habitacion.id, despues, '2026-11-20').map((x) => x.vivo), [0]);
  assert.deepEqual(eje.topes(habitacion.id, despues, '2026-11-21').map((x) => x.vivo), [4]);
  // El eje lo ve pasar cuando llega ahí y el reloj lo marcan los demás (SEG-03, SEG-05): fechar la emisión después no
  // basta; un registro de la casa con ese t, sí.
  await assert.rejects(eje.escribir(otra('2026-11-20', { t: despues })), /en la franja «2026-11-20».*llegaría a 5 y su capacidad es 4/);
  await eje.escribir({ autor: CASA, sobre: alojamiento.id, t: despues, payload: 'pasó la noche del 20', movimientos: [minutos(CASA)] });
  await eje.escribir(otra('2026-11-20', { t: despues }));
  // El P de la casa respalda todas las noches de cada cama: no se suelta mientras viva alguna (del 21 al 29).
  const suelta = { token: 'P', ambito: alojamiento.id, cantidad: 1, de: CASA, a: CASA, estado: 'liberacion', salida: familiaPlaza(habitacion.id, PLAZAS.matrimonio) };
  await assert.rejects(eje.escribir({ autor: CASA, sobre: alojamiento.id, t: despues, payload: 'suelta', movimientos: [minutos(CASA), suelta] }), /respalda 9 de E vivo: no se libera mientras viva/);
});

test('con claves, cada identidad firma lo suyo y el eje se reconstruye verificando todo', async () => {
  const claves = { casa: await generarClaves(), recepcion: await generarClaves(), huesped: await generarClaves() };
  const { eje, habitacion, atiende, reserva } = await ejemploReserva({ claves });
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
  // El P de recepción sobre su registro «atiende», comprometido aún con las plazas (1 + 2).
  assert.equal(otro.bloqueado('recepcion', 'P:' + atiende.id), 3);
  assert.equal(cerrado(otro, reserva.id).cerrado, true);
  assert.equal(evaluar(otro, reserva.id, [1, 3]).texto, '165 EUR');
  assert.deepEqual(ocupacion(otro, reserva.id).map((o) => o.cabe), [true]);
});
