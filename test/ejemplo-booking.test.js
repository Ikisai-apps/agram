import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejemploReserva, confirmarReserva, reservar, plaza, precioDe, PLAZAS, HABITACION } from '../ejemplos/ikisai/reserva-booking.mjs';
import { decupla, render } from '../src/pointed.js';
import { resolver, indicesDe } from '../src/btml.js';
import { evaluar, consultar } from '../src/bql.js';
import { ocupantes, arbol, colisiones } from '../src/encaje.js';
import { descubrir, consolidar, autorizar, ejecutar, estadoDe, consolidaciones, ocupacion, tramoDe, FABRICA } from '../src/motor.js';
import { ejeTemporal } from '../src/tiempo.js';
import { generarClaves } from '../src/autoridad.js';
import { serializar, restaurar } from '../src/persistencia.js';

const T = '2026-11-09T09:00:00Z';
const EUR = 'E:casa/EUR';
const pago = (cantidad, de) => ({ token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad, de, a: 'casa' });

/** Otra persona huésped, con dinero y tiempo, dada de alta por la casa. */
async function altaHuesped(eje, id, { eur = 200, t = '2026-11-08T08:00:00Z' } = {}) {
  return eje.escribir({
    autor: 'casa',
    sobre: eje.genesisId,
    t,
    movimientos: [
      { token: 'T', escala: 'minuto', cantidad: 1, de: 'casa', a: null },
      { token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: eur, de: 'casa', a: id },
      { token: 'T', escala: 'minuto', cantidad: 300, de: 'casa', a: id },
    ],
    payload: ['Alta de otra persona huésped', [id]],
    contexto: { tipos: { [id]: 'persona' } },
  });
}

test('ejemplo Ikisai: una reserva de alojamiento recorre el eje entero (saldos, poderes, tipos e hilo)', async () => {
  const { eje, alta, alojamiento, delegacion, habitacion, reserva, consolidacion, autorizacion, ejecucion } = await ejemploReserva();
  assert.deepEqual(eje.identidades(), ['casa', 'recepcion', 'huesped']);
  assert.deepEqual(['casa', 'recepcion', 'huesped'].map((id) => eje.tipo(id)), ['grupo', 'persona', 'persona']);
  assert.equal(eje.orden.length, 9); // génesis, altas, alojamiento, delegación, habitación, reserva, consolidación, autorización, ejecución
  // Dinero, de la serie de la casa: dio 300 a la persona huésped y cobró 165 al ejecutar.
  assert.equal(eje.saldo('casa', EUR), 365);
  assert.equal(eje.saldo('huesped', EUR), 135);
  assert.deepEqual(eje.recursos('recepcion'), []);
  // Poder: siempre con ámbito. La casa lo tiene sobre todo el eje y delegó 3 a recepción con el ámbito del dominio «Alojamiento».
  assert.deepEqual(eje.poderes('casa'), [{ ambito: 'genesis', cantidad: 7 }]);
  assert.deepEqual(eje.poderes('recepcion'), [{ ambito: alojamiento.id, cantidad: 3 }]);
  assert.deepEqual(eje.poderes('huesped'), []);
  assert.equal(alojamiento.payload, 'Alojamiento');
  assert.equal(delegacion.sobre, alojamiento.id);
  assert.deepEqual(delegacion.movimientos[1], { token: 'P', cantidad: 3, ambito: alojamiento.id, de: 'casa', a: 'recepcion' });
  // Recepción autoriza lo que cuelga del Alojamiento (habitación, reserva), no las altas ni el génesis.
  for (const id of [alojamiento.id, habitacion.id, reserva.id]) assert.equal(eje.poderSobre('recepcion', id), 3);
  assert.equal(eje.poderSobre('recepcion', alta.id), 0);
  assert.equal(eje.poderSobre('recepcion', eje.genesisId), 0);
  // Tiempo, por escala: cada registro gasta minutos de su autor; las horas solo se reparten.
  assert.equal(eje.saldoT('casa', 'hora'), 1000 - 40 - 72);
  assert.equal(eje.saldoT('casa', 'minuto'), 5000 - 1 - 600 - 600 - 1 - 1 - 10); // altas, alojamiento, delegación, habitación
  assert.equal(eje.saldoT('recepcion', 'minuto'), 600 - autorizacion.movimientos[0].cantidad);
  assert.equal(eje.saldoT('huesped', 'minuto'), 600 - 15 - consolidacion.movimientos[0].cantidad - 1); // reserva, consolidación, ejecución
  // El hilo es la evidencia: ejecución → consolidación → reserva → habitación → alojamiento → génesis.
  assert.deepEqual(eje.hilo(ejecucion.id).map((x) => x.id), [ejecucion.id, consolidacion.id, reserva.id, habitacion.id, alojamiento.id, eje.genesisId]);
  assert.deepEqual(eje.hilo(ejecucion.id).map((x) => x.autor), ['huesped', 'huesped', 'huesped', 'casa', 'casa', 'casa']);
  assert.deepEqual(eje.sobre(alojamiento.id).map((x) => x.id), [delegacion.id, habitacion.id]);
  assert.equal(autorizacion.autor, 'recepcion');
  assert.equal(ejecucion.payload[0], 'Pagada y válida');
  const texto = render(decupla(reserva));
  assert.match(texto, /^1 recursos\s+\[5 posiciones\]$/m);
  assert.match(texto, /^7 futuro\s+\[2 posiciones\]$/m);
});

test('el elemento habitación: sus plazas son posiciones 1.k con nombre, precio y capacidad', async () => {
  const { eje, habitacion } = await ejemploReserva({ confirmar: false });
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
});

test('las referencias no copian: plaza y precio son un solo nodo, y las fórmulas BQL calculan el total y lo componen con el tiempo', async () => {
  const { eje, habitacion, reserva, consolidacion } = await ejemploReserva();
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
  assert.equal(consolidacion.payload[4], '=REF("' + reserva.id + '", "1300000000")');
  assert.equal(evaluar(eje, consolidacion.id, [4]).texto, '165 EUR');
  // 4–6 de la reserva tienen contenido propio, sin marcas de relleno: lo que prepara, la plaza que ocupa y el hilo de donde viene.
  assert.deepEqual(reserva.payload[4], ['pagar', 'ocupar']);
  assert.deepEqual(reserva.payload[5], { ref: habitacion.id, dir: '1100000000' });
  assert.deepEqual(reserva.payload[6], { ref: habitacion.id });
  assert.deepEqual(reserva.payload[7], ['2026-11-20', '2026-11-23']);
});

test('encaje de la dirección 1 de la reserva: colisiones por ceros, lo alcanzado por la referencia y su procedencia', async () => {
  const { eje, habitacion, reserva, consolidacion } = await ejemploReserva();
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
  // En 4, lo propio (lo que prepara) y la consolidación escrita encima, anclada justo ahí.
  const oc4 = ocupantes(eje, reserva.id, [4]);
  assert.deepEqual(oc4.map((o) => o.origen), ['propio', 'propio', 'escrito']);
  assert.equal(oc4[2].evento, consolidacion.id);
  assert.equal(oc4[2].signo, 'exacto');
  // Descubrir muestra lo alcanzado por su representación: la plaza se lee «cama individual».
  const d = descubrir(eje, reserva.id);
  assert.equal(d[0].candidatos.find((c) => c.origen === 'referencia').texto, 'cama individual');
  const c = colisiones(arbol(eje, reserva.id));
  assert.equal(c.find((x) => x.dir === '1000000000').ocupantes.length, 3);
  assert.equal(c.find((x) => x.dir === '2000000000').ocupantes.length, 3);
  assert.equal(consultar(eje, reserva.id, [1], 'CONTAR(BUSCAR(1))').texto, '3');
  assert.equal(consultar(eje, reserva.id, [1], 'CONTAR(FILTRAR(BUSCAR(1), SIGNO() = "exacto"))').texto, '2');
  // La consolidación guarda el encaje de sus fuentes: de dónde vino cada elección y dónde se colocó.
  const e = consolidacion.contexto.encaje;
  assert.deepEqual(e.map((x) => [x.posicion, x.evento, x.origen, x.destino]), [[1, habitacion.id, '1100000000', '1000000000'], [2, habitacion.id, '2100000000', '2000000000']]);
  assert.deepEqual(consolidacion.contexto.fuentes, [habitacion.id]);
});

test('anclaje: la reserva vive en la plaza (1.1) de la habitación, con las noches en su propio 7', async () => {
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
  // El tramo es el 7 de la propia reserva; el eje temporal de la reserva lo muestra como declarado.
  const tramo = tramoDe(reserva);
  assert.equal(tramo.inicio, Date.parse('2026-11-20'));
  assert.equal(tramo.fin, Date.parse('2026-11-23'));
  const et = ejeTemporal(eje, reserva.id, { ahora: '2026-11-08T19:00:00Z' });
  assert.deepEqual(et.futuro.find((x) => x.tipo === 'declarado').contenido, ['2026-11-20', '2026-11-23']);
  // La plaza tiene capacidad 1 y esta reserva, ya ejecutada, no cuenta contra sí misma.
  assert.deepEqual(ocupacion(eje, reserva.id).map((o) => [o.dir, o.camino, o.capacidad, o.aLaVez, o.cabe]), [['1100000000', [1, 1], 1, 0, true]]);
});

test('estado del ciclo: consolidar → PENDIENTE DE AUTORIZACIÓN → recepción autoriza con P sobre el Alojamiento → huésped ejecuta con el pago E', async () => {
  const { eje, habitacion, reserva } = await ejemploReserva({ confirmar: false });
  assert.equal(eje.orden.length, 6);
  assert.deepEqual(consolidaciones(eje, reserva.id), []);
  const d = descubrir(eje, reserva.id);
  const laPlaza = d[0].candidatos.find((c) => c.origen === 'referencia');
  assert.equal(laPlaza.texto, 'cama individual');
  const c = await consolidar(eje, { autor: 'huesped', foco: reserva.id, t: T, titulo: 'Reserva en firme', elecciones: { 1: { candidato: laPlaza }, 4: 'pagar 165 EUR' } });
  assert.equal(c.en, FABRICA);
  assert.equal(estadoDe(eje, c.id), 'PENDIENTE DE AUTORIZACIÓN');
  assert.deepEqual(c.payload[1], { ref: habitacion.id, dir: '1100000000' });
  assert.deepEqual(c.payload[2], { ref: reserva.id, dir: '2000000000' }); // hueco heredado del foco por referencia
  assert.equal(eje.saldo('huesped', EUR), 300); // consolidar no es pagar
  await assert.rejects(ejecutar(eje, { autor: 'huesped', consolidacion: c.id, t: T }), /PENDIENTE DE AUTORIZACIÓN/);
  await assert.rejects(autorizar(eje, { autorizante: 'huesped', consolidacion: c.id, t: T }), /no se autoriza a sí mismo/);
  const a = await autorizar(eje, { autorizante: 'recepcion', consolidacion: c.id, t: T, nota: 'confirmada' });
  assert.equal(a.payload, '==confirmada');
  assert.equal(estadoDe(eje, c.id), 'AUTORIZADO');
  await assert.rejects(ejecutar(eje, { autor: 'recepcion', consolidacion: c.id, t: T }), /ejecuta el autor/);
  const e = await ejecutar(eje, { autor: 'huesped', consolidacion: c.id, t: T, movimientos: [pago(165, 'huesped')] });
  assert.equal(estadoDe(eje, c.id), 'EJECUTADO');
  assert.deepEqual(e.contexto.evidencia, [c.id, a.id]);
  assert.equal(eje.saldo('huesped', EUR), 135);
  assert.equal(eje.saldo('casa', EUR), 365);
  // Sin poder sobre el hilo no se autoriza: recepción no puede con una consolidación sobre las altas.
  const { eje: otroEje, alta } = await ejemploReserva({ confirmar: false });
  const fuera = await consolidar(otroEje, { autor: 'huesped', foco: alta.id, t: T, elecciones: { 1: 'otra cosa' } });
  await assert.rejects(autorizar(otroEje, { autorizante: 'recepcion', consolidacion: fuera.id, t: T }), /no tiene poder \(P\) sobre este registro/);
  // La confirmación del ejemplo hace lo mismo y deja la evidencia en su hilo.
  const otra = await ejemploReserva({ confirmar: false });
  const { consolidacion, autorizacion, ejecucion, yaConfirmada } = await confirmarReserva(otra.eje, otra.reserva);
  assert.equal(yaConfirmada, undefined);
  assert.equal(consolidacion.contexto.fase, 'consolidado');
  assert.equal(autorizacion.contexto.fase, 'autorizado');
  assert.equal(ejecucion.contexto.fase, 'ejecutado');
  assert.deepEqual(ejecucion.payload.slice(1), [{ ref: consolidacion.id }, { ref: autorizacion.id }]);
  assert.deepEqual(ejecucion.movimientos[1], pago(165, 'huesped'));
  assert.equal(consolidaciones(otra.eje, otra.reserva.id)[0].estado, 'EJECUTADO');
});

test('confirmar es idempotente: una reserva ya pagada devuelve su confirmación y no se cobra dos veces', async () => {
  const primera = await ejemploReserva();
  const { eje, reserva } = primera;
  // La casa da más dinero a la persona huésped: si se volviera a cobrar, habría saldo para ello.
  await eje.escribir({ autor: 'casa', sobre: eje.genesisId, t: '2026-11-10T08:00:00Z', movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'casa', a: null }, { token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 200, de: 'casa', a: 'huesped' }], payload: 'Más saldo' });
  const antes = eje.orden.length;
  const otra = await confirmarReserva(eje, reserva, { t: '2026-11-10T09:00:00Z' });
  assert.equal(otra.yaConfirmada, true);
  assert.equal(otra.consolidacion.id, primera.consolidacion.id);
  assert.equal(otra.autorizacion.id, primera.autorizacion.id);
  assert.equal(otra.ejecucion.id, primera.ejecucion.id);
  assert.equal(eje.orden.length, antes); // nada nuevo en el eje
  assert.equal(consolidaciones(eje, reserva.id).length, 1);
  assert.equal(eje.saldo('huesped', EUR), 135 + 200);
  assert.equal(eje.saldo('casa', EUR), 365 - 200);
});

test('capacidad: dos reservas solapadas de la cama individual colisionan en la plaza, y la fábrica no ejecuta la segunda', async () => {
  const { eje, habitacion, reserva } = await ejemploReserva(); // la primera, del 20 al 23, ya es válida
  await altaHuesped(eje, 'huesped2');
  const segunda = await reservar(eje, { autor: 'huesped2', habitacion, plaza: PLAZAS.individual, noches: ['2026-11-22', '2026-11-24'], t: '2026-11-08T20:00:00Z' });
  // Escribirla no reserva nada: se escribe y colisiona con la primera en la plaza; se ven las dos.
  assert.deepEqual(ocupantes(eje, habitacion.id, [1, 1]).filter((o) => o.origen === 'escrito').map((o) => o.evento), [reserva.id, segunda.id]);
  const [o] = ocupacion(eje, segunda.id);
  assert.deepEqual([o.capacidad, o.aLaVez, o.cabe], [1, 1, false]);
  assert.deepEqual(o.validos.map((v) => v.id), [reserva.id]);
  // Consolidar y autorizar sí; ejecutar no: la plaza ya tiene una reserva válida la noche del 22.
  await assert.rejects(confirmarReserva(eje, segunda, { t: '2026-11-09T10:00:00Z' }), (e) => {
    assert.match(e.message, /^capacidad agotada en 1100000000 de /);
    assert.match(e.message, /1 de 1 ya válidas a la vez en el tramo 2026-11-22 – 2026-11-24/);
    assert.ok(e.message.includes(reserva.id.slice(0, 8)));
    return true;
  });
  const [c] = consolidaciones(eje, segunda.id);
  assert.equal(c.estado, 'AUTORIZADO'); // autorizada pero no válida
  assert.equal(eje.saldo('huesped2', EUR), 200); // sin cobro
  assert.equal(eje.saldo('casa', EUR), 365 - 200);
  // La primera sigue siendo la única válida en la plaza.
  assert.deepEqual(eje.sobre(habitacion.id, plaza(PLAZAS.individual)).filter((r) => consolidaciones(eje, r.id).some((x) => x.estado === 'EJECUTADO')).map((r) => r.id), [reserva.id]);
});

test('capacidad: dos reservas que no se solapan (la salida de una es la entrada de la otra) se ejecutan las dos', async () => {
  const { eje, habitacion, reserva } = await ejemploReserva(); // del 20 al 23
  await altaHuesped(eje, 'huesped2');
  const despues = await reservar(eje, { autor: 'huesped2', habitacion, plaza: PLAZAS.individual, noches: ['2026-11-23', '2026-11-25'], t: '2026-11-08T20:00:00Z' });
  assert.deepEqual(ocupacion(eje, despues.id).map((o) => [o.aLaVez, o.cabe]), [[0, true]]); // la noche de salida no se ocupa
  const { ejecucion } = await confirmarReserva(eje, despues, { t: '2026-11-09T10:00:00Z' });
  assert.equal(ejecucion.payload[0], 'Pagada y válida');
  assert.equal(consolidaciones(eje, despues.id)[0].estado, 'EJECUTADO');
  assert.equal(consolidaciones(eje, reserva.id)[0].estado, 'EJECUTADO');
  assert.equal(eje.saldo('huesped2', EUR), 200 - 110);
  assert.equal(eje.saldo('casa', EUR), 365 - 200 + 110);
  // La capacidad es de cada plaza: la cama de matrimonio en las mismas noches que la primera también cabe.
  const otra = await reservar(eje, { autor: 'huesped2', habitacion, plaza: PLAZAS.matrimonio, noches: ['2026-11-20', '2026-11-21'], t: '2026-11-08T21:00:00Z' });
  assert.equal(otra.en, '1000000000'); // la primera plaza: colisión con la posición 1 entera
  assert.deepEqual(ocupacion(eje, otra.id).map((o) => [o.camino, o.capacidad, o.cabe]), [[[1, 0], 1, true]]); // solo la plaza declara capacidad
  await confirmarReserva(eje, otra, { t: '2026-11-09T11:00:00Z' });
  assert.equal(consolidaciones(eje, otra.id)[0].estado, 'EJECUTADO');
});

test('capacidad 2: la litera admite dos a la vez por noche; la que cruza dos estancias encadenadas cabe, y una tercera a la vez no', async () => {
  const { eje, habitacion } = await ejemploReserva({ confirmar: false });
  const litera = (noches, minuto) => reservar(eje, { autor: 'huesped', habitacion, plaza: PLAZAS.litera, noches, t: '2026-11-08T19:' + minuto + ':00Z' });
  const confirmar = (r, minuto) => confirmarReserva(eje, r, { t: '2026-11-09T10:' + minuto + ':00Z' });
  const a = await litera(['2026-11-20', '2026-11-22'], 10);
  const b = await litera(['2026-11-22', '2026-11-24'], 11);
  await confirmar(a, 10);
  await confirmar(b, 11);
  // C cruza a las dos, pero cada noche solo coincide con una de ellas: caben dos por noche.
  const c = await litera(['2026-11-21', '2026-11-23'], 12);
  const [oc] = ocupacion(eje, c.id);
  assert.deepEqual([oc.capacidad, oc.validos.length, oc.aLaVez, oc.cabe], [2, 2, 1, true]);
  await confirmar(c, 12);
  // D, la noche del 21: ya están A y C. No cabe.
  const d = await litera(['2026-11-21', '2026-11-22'], 13);
  assert.deepEqual(ocupacion(eje, d.id).map((o) => [o.aLaVez, o.cabe]), [[2, false]]);
  await assert.rejects(confirmar(d, 13), /capacidad agotada en 1200000000 de .*: 2 de 2 ya válidas a la vez/);
  assert.deepEqual([a, b, c, d].map((r) => consolidaciones(eje, r.id)[0].estado), ['EJECUTADO', 'EJECUTADO', 'EJECUTADO', 'AUTORIZADO']);
  assert.equal(eje.saldo('huesped', EUR), 300 - 3 * 50); // tres estancias de dos noches a 25 EUR; la cuarta no se cobra
});

test('con claves, cada identidad firma lo suyo y el eje se reconstruye verificando todo', async () => {
  const claves = { casa: await generarClaves(), recepcion: await generarClaves(), huesped: await generarClaves() };
  const { eje, reserva } = await ejemploReserva({ claves });
  for (const id of eje.orden) {
    const ev = eje.obtener(id);
    assert.ok(ev.firma, 'sin firma: ' + ev.autor);
    assert.equal(ev.firmante, ev.autor);
  }
  assert.deepEqual(eje.clave('recepcion'), claves.recepcion.publica);
  const datos = JSON.parse(JSON.stringify(serializar(eje)));
  const otro = await restaurar({ ...datos, exigirFirmas: true });
  assert.deepEqual(otro.orden, eje.orden);
  assert.equal(otro.saldo('casa', EUR), 365);
  assert.equal(otro.poderSobre('recepcion', reserva.id), 3);
  assert.equal(evaluar(otro, reserva.id, [1, 3]).texto, '165 EUR');
  assert.deepEqual(ocupacion(otro, reserva.id).map((o) => o.cabe), [true]);
});
