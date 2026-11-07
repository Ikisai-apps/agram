import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejemploReserva, confirmarReserva, EN_RESERVA, SIN_DESARROLLAR } from '../ejemplos/ikisai/reserva-booking.mjs';
import { decupla, render } from '../src/pointed.js';
import { resolver, indicesDe } from '../src/btml.js';
import { evaluar, consultar } from '../src/bql.js';
import { ocupantes, arbol, colisiones } from '../src/encaje.js';
import { descubrir, consolidar, autorizar, ejecutar, estadoDe, consolidaciones, FABRICA } from '../src/motor.js';
import { ejeTemporal } from '../src/tiempo.js';
import { generarClaves } from '../src/autoridad.js';
import { serializar, restaurar } from '../src/persistencia.js';

const T = '2026-11-09T09:00:00Z';
const gastaT = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });

test('ejemplo Ikisai: una reserva de alojamiento recorre el eje entero (saldos, poderes e hilo)', async () => {
  const { eje, alta, disponibilidad, delegacion, reserva, consolidacion, autorizacion, ejecucion } = await ejemploReserva();
  assert.deepEqual(eje.identidades(), ['casa', 'recepcion', 'huesped']);
  assert.equal(eje.orden.length, 8); // génesis, altas, disponibilidad, delegación, reserva, consolidación, autorización, ejecución
  // Dinero: la casa dio 300 a la persona huésped y cobró 165 al ejecutar.
  assert.equal(eje.saldo('casa', 'E:EUR'), 365);
  assert.equal(eje.saldo('huesped', 'E:EUR'), 135);
  assert.equal(eje.saldo('recepcion', 'E:EUR'), 0);
  // Poder: siempre con ámbito. La casa lo tiene sobre todo el eje (génesis) y delegó 3 a recepción
  // sobre la disponibilidad, en un evento propio escrito después de publicarla.
  assert.deepEqual(eje.poderes('casa'), [{ ambito: 'genesis', cantidad: 7 }]);
  assert.deepEqual(eje.poderes('recepcion'), [{ ambito: disponibilidad.id, cantidad: 3 }]);
  assert.deepEqual(eje.poderes('huesped'), []);
  assert.equal(delegacion.sobre, disponibilidad.id);
  assert.deepEqual(delegacion.movimientos[1], { token: 'P', cantidad: 3, ambito: disponibilidad.id, de: 'casa', a: 'recepcion' });
  // El ámbito mínimo: recepción puede sobre la reserva (cuelga de la disponibilidad), no sobre las altas ni el génesis.
  assert.equal(eje.poderSobre('recepcion', reserva.id), 3);
  assert.equal(eje.poderSobre('recepcion', disponibilidad.id), 3);
  assert.equal(eje.poderSobre('recepcion', alta.id), 0);
  assert.equal(eje.poderSobre('recepcion', eje.genesisId), 0);
  assert.equal(eje.poderSobre('casa', reserva.id), 7);
  // Tiempo, en minutos: cada registro gasta T de su autor.
  assert.equal(eje.saldoT('casa', 'minuto'), 60000 - 1 - 10 - 1 - 40 * 60 - 72 * 60); // altas, disponibilidad, delegación
  assert.equal(eje.saldoT('recepcion', 'minuto'), 40 * 60 - 1); // la autorización
  assert.equal(eje.saldoT('huesped', 'minuto'), 72 * 60 - 15 - 5 - 1); // reserva, consolidación (5 posiciones), ejecución
  // El hilo es la evidencia: ejecución → consolidación → reserva → disponibilidad → altas → génesis. La delegación es una rama hermana.
  assert.deepEqual(eje.hilo(ejecucion.id).map((x) => x.id), [ejecucion.id, consolidacion.id, reserva.id, disponibilidad.id, alta.id, eje.genesisId]);
  assert.deepEqual(eje.hilo(ejecucion.id).map((x) => x.autor), ['huesped', 'huesped', 'huesped', 'casa', 'casa', 'casa']);
  assert.deepEqual(eje.sobre(disponibilidad.id).map((x) => x.id), [delegacion.id, reserva.id]);
  assert.equal(autorizacion.autor, 'recepcion');
  assert.equal(reserva.sobre, disponibilidad.id);
  assert.equal(reserva.en, EN_RESERVA);
  const texto = render(decupla(reserva));
  assert.match(texto, /^1 recursos\s+\[5 posiciones\]$/m);
  assert.match(texto, /^4 fábrica\s+—$/m); // la fábrica de la reserva está vacía: lo consolidado se escribe sobre ella
});

test('las referencias no copian: habitación y precio son un solo nodo, y las fórmulas BQL calculan el total y lo componen con el tiempo', async () => {
  const { eje, disponibilidad, reserva, consolidacion } = await ejemploReserva();
  const habitacion = reserva.payload[1][0];
  const precio = reserva.payload[1][2];
  assert.equal(habitacion.ref, disponibilidad.id);
  // La habitación es una subdécupla [nombre, precio]; el precio cuelga de su dirección (1.0.1 → 1.0.1.1), no de un array paralelo.
  assert.deepEqual(resolver(eje.obtener(habitacion.ref).payload, habitacion.dir), ['individual', 'EUR 55']);
  assert.equal(resolver(eje.obtener(precio.ref).payload, precio.dir), 'EUR 55');
  assert.deepEqual(indicesDe(habitacion.dir), [1, 0, 1]);
  assert.deepEqual(indicesDe(precio.dir), [1, 0, 1, 1]);
  // 1.3: precio por noche (por referencia) × noches; LOCAL lee la décupla anidada a su profundidad.
  const total = evaluar(eje, reserva.id, [1, 3]);
  assert.equal(total.estado, 'RESUELTO');
  assert.equal(total.texto, '165 EUR');
  assert.ok(total.dependencias.includes(disponibilidad.id + ':1011000000'));
  // 1.4: el total compuesto con el tiempo que ocupa; composición heterogénea, operandos preservados.
  const conTiempo = evaluar(eje, reserva.id, [1, 4]);
  assert.equal(conTiempo.texto, '165 EUR + 3 dia');
  assert.equal(conTiempo.valor.tipo, 'composicion');
  assert.ok(conTiempo.dependencias.includes(reserva.id + ':1300000000'));
  // La fábrica consolidó lo que se paga como fórmula que lee el total de la reserva, con el id completo.
  assert.equal(consolidacion.payload[4], '=REF("' + reserva.id + '", "1300000000")');
  assert.equal(evaluar(eje, consolidacion.id, [4]).texto, '165 EUR');
  // El relleno de 3–6 de la disponibilidad es honesto: 5 y 6 dicen que no están desarrollados (texto llano, sin semántica inventada).
  assert.equal(disponibilidad.payload[5], SIN_DESARROLLAR);
  assert.equal(disponibilidad.payload[6], SIN_DESARROLLAR);
  assert.equal(evaluar(eje, disponibilidad.id, [5]).texto, 'sin desarrollar');
  assert.equal(evaluar(eje, disponibilidad.id, [6]).valor.tipo, 'texto');
});

test('encaje de la dirección 1 de la reserva: colisiones por ceros, lo alcanzado por la referencia y su procedencia', async () => {
  const { eje, disponibilidad, reserva, consolidacion } = await ejemploReserva();
  const oc = ocupantes(eje, reserva.id, [1]);
  // [1] y [1.0] colisionan en 1000000000 (rutas que coinciden: exactos); lo que alcanza la referencia viene de 1010000000 de la disponibilidad.
  assert.deepEqual(oc.map((o) => o.origen), ['propio', 'propio', 'referencia']);
  assert.deepEqual(oc.map((o) => o.camino), [[1], [1, 0], [1, 0, 1]]);
  assert.ok(oc.slice(0, 2).every((o) => o.signo === 'exacto' && o.acuerdo === 10));
  assert.deepEqual(oc[2].contenido, ['individual', 'EUR 55']);
  assert.equal(oc[2].evento, disponibilidad.id);
  assert.equal(oc[2].origenDir, '1010000000');
  assert.equal(oc[2].destino, '1000000000');
  assert.deepEqual(oc[2].procedencia, [reserva.id + ':1000000000#1.0', disponibilidad.id + ':1010000000']);
  assert.ok(Array.isArray(oc[2].vector) && oc[2].vector.length === 10); // el vector es información; no ordena
  // Lo mismo en 2 (el criterio elegido, 2100000000 → 2000000000).
  const oc2 = ocupantes(eje, reserva.id, [2]);
  assert.deepEqual(oc2.map((o) => o.origen), ['propio', 'propio', 'referencia']);
  assert.equal(oc2[2].contenido, 'con desayuno');
  assert.equal(oc2[2].origenDir, '2100000000');
  // En 4, la consolidación escrita: anclada justo ahí, su ruta coincide entera.
  const oc4 = ocupantes(eje, reserva.id, [4]);
  assert.deepEqual(oc4.map((o) => [o.origen, o.evento, o.signo]), [['escrito', consolidacion.id, 'exacto']]);
  // Descubrir muestra lo alcanzado por su representación: la habitación se lee «individual».
  const d = descubrir(eje, reserva.id);
  assert.equal(d[0].candidatos.find((c) => c.origen === 'referencia').texto, 'individual');
  // El árbol lógico de la reserva: colisiones en 1 y 2 (tres ocupantes cada una).
  const c = colisiones(arbol(eje, reserva.id));
  assert.equal(c.find((x) => x.dir === '1000000000').ocupantes.length, 3);
  assert.equal(c.find((x) => x.dir === '2000000000').ocupantes.length, 3);
  // BQL ve lo mismo: BUSCAR sale por encaje y el signo es consultable.
  assert.equal(consultar(eje, reserva.id, [1], 'CONTAR(BUSCAR(1))').texto, '3');
  assert.equal(consultar(eje, reserva.id, [1], 'CONTAR(FILTRAR(BUSCAR(1), SIGNO() = "exacto"))').texto, '2');
  // La consolidación guarda el encaje de sus fuentes: de dónde vino cada elección y dónde se colocó.
  const e = consolidacion.contexto.encaje;
  assert.deepEqual(e.map((x) => [x.posicion, x.evento, x.origen, x.destino]), [[1, disponibilidad.id, '1010000000', '1000000000'], [2, disponibilidad.id, '2100000000', '2000000000']]);
  assert.deepEqual(consolidacion.contexto.fuentes, [disponibilidad.id]);
  // Límite conocido de los ceros finales, documentado: la primera habitación (1.0.0, «doble») no se puede
  // nombrar con precisión; 1000000000 nombra a la vez [1], [1.0], [1.0.0] y [1.0.0.0]. Por eso la reserva elige 1.0.1.
  assert.deepEqual(ocupantes(eje, disponibilidad.id, [1]).map((o) => o.camino), [[1], [1, 0], [1, 0, 0], [1, 0, 0, 0]]);
  assert.equal(resolver(disponibilidad.payload, '1000000000').length, 2);
  assert.equal(resolver(disponibilidad.payload, '1000000000')[0].length, 3);
});

test('anclaje: la reserva vive en el futuro (7) de la disponibilidad, junto a las fechas', async () => {
  const { eje, disponibilidad, delegacion, reserva } = await ejemploReserva();
  assert.deepEqual(eje.sobre(disponibilidad.id, EN_RESERVA).map((x) => x.id), [reserva.id]);
  const oc = ocupantes(eje, disponibilidad.id, [7]);
  assert.deepEqual(oc.map((o) => o.origen), ['propio', 'propio', 'escrito']);
  assert.equal(oc[1].contenido, '2026-11-20');
  assert.equal(oc[2].evento, reserva.id);
  // En el eje temporal de la disponibilidad: las fechas declaradas en 7 y la reserva como proyección; la delegación, en el pasado.
  const et = ejeTemporal(eje, disponibilidad.id, { ahora: '2026-11-07T12:00:00Z' });
  assert.deepEqual(et.futuro.map((x) => x.tipo), ['declarado', 'proyeccion']);
  assert.deepEqual(et.futuro[0].contenido, ['2026-11-20', '2026-11-23']);
  assert.equal(et.futuro[1].id, reserva.id);
  assert.equal(et.futuro[1].banda, 'semana');
  assert.ok(et.pasado.some((x) => x.id === delegacion.id && x.tipo === 'registro'));
});

test('estado del ciclo: consolidar → PENDIENTE DE AUTORIZACIÓN → recepción autoriza con P sobre la disponibilidad → huésped ejecuta con el pago E', async () => {
  const { eje, disponibilidad, reserva } = await ejemploReserva({ confirmar: false });
  assert.equal(eje.orden.length, 5);
  assert.deepEqual(consolidaciones(eje, reserva.id), []);
  const d = descubrir(eje, reserva.id);
  const habitacion = d[0].candidatos.find((c) => c.origen === 'referencia');
  assert.equal(habitacion.texto, 'individual');
  const c = await consolidar(eje, { autor: 'huesped', foco: reserva.id, t: T, titulo: 'Reserva en firme', elecciones: { 1: { candidato: habitacion }, 4: 'pagar 165 EUR' } });
  assert.equal(c.en, FABRICA);
  assert.equal(estadoDe(eje, c.id), 'PENDIENTE DE AUTORIZACIÓN');
  assert.deepEqual(c.payload[1], { ref: disponibilidad.id, dir: '1010000000' });
  assert.deepEqual(c.payload[2], { ref: reserva.id, dir: '2000000000' }); // hueco heredado del foco por referencia
  assert.equal(eje.saldo('huesped', 'E:EUR'), 300); // consolidar no es pagar
  await assert.rejects(ejecutar(eje, { autor: 'huesped', consolidacion: c.id, t: T }), /PENDIENTE DE AUTORIZACIÓN/);
  await assert.rejects(autorizar(eje, { autorizante: 'huesped', consolidacion: c.id, t: T }), /no se autoriza a sí mismo/);
  const a = await autorizar(eje, { autorizante: 'recepcion', consolidacion: c.id, t: T, nota: 'confirmada' });
  assert.equal(a.payload, '==confirmada');
  assert.equal(estadoDe(eje, c.id), 'AUTORIZADO');
  await assert.rejects(ejecutar(eje, { autor: 'recepcion', consolidacion: c.id, t: T }), /ejecuta el autor/);
  const e = await ejecutar(eje, { autor: 'huesped', consolidacion: c.id, t: T, movimientos: [{ token: 'E', denominacion: 'EUR', cantidad: 165, de: 'huesped', a: 'casa' }] });
  assert.equal(estadoDe(eje, c.id), 'EJECUTADO');
  assert.deepEqual(e.contexto.evidencia, [c.id, a.id]);
  assert.equal(eje.saldo('huesped', 'E:EUR'), 135);
  assert.equal(eje.saldo('casa', 'E:EUR'), 365);
  // Sin poder sobre el hilo no se autoriza: recepción no puede con una consolidación sobre las altas.
  const { eje: otroEje, alta } = await ejemploReserva({ confirmar: false });
  const fuera = await consolidar(otroEje, { autor: 'huesped', foco: alta.id, t: T, elecciones: { 1: 'otra cosa' } });
  await assert.rejects(autorizar(otroEje, { autorizante: 'recepcion', consolidacion: fuera.id, t: T }), /no tiene poder \(P\) sobre este registro/);
  // La confirmación del ejemplo hace lo mismo y deja la evidencia en su hilo; el título dice solo lo que hay: pagada.
  const otra = await ejemploReserva({ confirmar: false });
  const { consolidacion, autorizacion, ejecucion, yaConfirmada } = await confirmarReserva(otra.eje, otra.reserva);
  assert.equal(yaConfirmada, undefined);
  assert.equal(consolidacion.contexto.fase, 'consolidado');
  assert.equal(autorizacion.contexto.fase, 'autorizado');
  assert.equal(ejecucion.contexto.fase, 'ejecutado');
  assert.equal(ejecucion.payload[0], 'Pagada');
  assert.deepEqual(ejecucion.payload.slice(1), [{ ref: consolidacion.id }, { ref: autorizacion.id }]);
  assert.deepEqual(ejecucion.movimientos[1], { token: 'E', denominacion: 'EUR', cantidad: 165, de: 'huesped', a: 'casa' });
  assert.equal(consolidaciones(otra.eje, otra.reserva.id)[0].estado, 'EJECUTADO');
});

test('confirmar es idempotente: una reserva ya pagada devuelve su confirmación y no se cobra dos veces', async () => {
  const primera = await ejemploReserva();
  const { eje, reserva } = primera;
  // La casa da más dinero a la persona huésped: si se volviera a cobrar, habría saldo para ello.
  await eje.escribir({ autor: 'casa', sobre: eje.genesisId, t: '2026-11-10T08:00:00Z', movimientos: [gastaT('casa'), { token: 'E', denominacion: 'EUR', cantidad: 200, de: 'casa', a: 'huesped' }], payload: 'Más saldo' });
  const antes = eje.orden.length;
  const otra = await confirmarReserva(eje, reserva, { t: '2026-11-10T09:00:00Z' });
  assert.equal(otra.yaConfirmada, true);
  assert.equal(otra.consolidacion.id, primera.consolidacion.id);
  assert.equal(otra.autorizacion.id, primera.autorizacion.id);
  assert.equal(otra.ejecucion.id, primera.ejecucion.id);
  assert.equal(eje.orden.length, antes); // nada nuevo en el eje
  assert.equal(consolidaciones(eje, reserva.id).length, 1);
  assert.equal(eje.saldo('huesped', 'E:EUR'), 135 + 200);
  assert.equal(eje.saldo('casa', 'E:EUR'), 365 - 200);
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
  assert.equal(otro.saldo('casa', 'E:EUR'), 365);
  assert.equal(otro.poderSobre('recepcion', reserva.id), 3);
  assert.equal(evaluar(otro, reserva.id, [1, 3]).texto, '165 EUR');
});
