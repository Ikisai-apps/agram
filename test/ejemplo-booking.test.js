import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejemploReserva, confirmarReserva, EN_RESERVA } from '../ejemplos/ikisai/reserva-booking.mjs';
import { decupla, render } from '../src/pointed.js';
import { resolver } from '../src/btml.js';
import { evaluar, consultar } from '../src/bql.js';
import { ocupantes, arbol, colisiones } from '../src/encaje.js';
import { descubrir, consolidar, autorizar, ejecutar, estadoDe, consolidaciones, FABRICA } from '../src/motor.js';
import { ejeTemporal } from '../src/tiempo.js';
import { generarClaves } from '../src/autoridad.js';
import { serializar, restaurar } from '../src/persistencia.js';

const T = '2026-11-09T09:00:00Z';

test('ejemplo Ikisai: una reserva de alojamiento recorre el eje entero (saldos e hilo)', async () => {
  const { eje, alta, disponibilidad, reserva, consolidacion, autorizacion, ejecucion } = await ejemploReserva();
  assert.deepEqual(eje.identidades(), ['casa', 'recepcion', 'huesped']);
  assert.equal(eje.orden.length, 7);
  // Dinero: la casa dio 300 a la persona huésped y cobró 165 al ejecutar; poder: 3 de los 10 fueron a recepción.
  assert.equal(eje.saldo('casa', 'E:EUR'), 365);
  assert.equal(eje.saldo('huesped', 'E:EUR'), 135);
  assert.equal(eje.saldo('recepcion', 'E:EUR'), 0);
  assert.equal(eje.saldo('casa', 'P'), 7);
  assert.equal(eje.saldo('recepcion', 'P'), 3);
  assert.equal(eje.saldo('huesped', 'P'), 0);
  // Tiempo, en minutos: cada registro gasta T de su autor.
  assert.equal(eje.saldoT('casa', 'minuto'), 60000 - 1 - 10 - 40 * 60 - 72 * 60);
  assert.equal(eje.saldoT('recepcion', 'minuto'), 40 * 60 - 1); // la autorización
  assert.equal(eje.saldoT('huesped', 'minuto'), 72 * 60 - 15 - 5 - 1); // reserva, consolidación (5 posiciones), ejecución
  // El hilo es la evidencia: ejecución → consolidación → reserva → disponibilidad → altas → génesis.
  assert.deepEqual(eje.hilo(ejecucion.id).map((x) => x.id), [ejecucion.id, consolidacion.id, reserva.id, disponibilidad.id, alta.id, eje.genesisId]);
  assert.deepEqual(eje.hilo(ejecucion.id).map((x) => x.autor), ['huesped', 'huesped', 'huesped', 'casa', 'casa', 'casa']);
  assert.equal(autorizacion.autor, 'recepcion');
  assert.equal(reserva.sobre, disponibilidad.id);
  assert.equal(reserva.en, EN_RESERVA);
  const texto = render(decupla(reserva));
  assert.match(texto, /^1 recursos\s+\[5 posiciones\]$/m);
  assert.match(texto, /^4 fábrica\s+—$/m); // la fábrica de la reserva está vacía: lo consolidado se escribe sobre ella
});

test('las referencias no copian y las fórmulas BQL calculan el total y lo componen con el tiempo', async () => {
  const { eje, disponibilidad, reserva, consolidacion } = await ejemploReserva();
  const habitacion = reserva.payload[1][0];
  const precio = reserva.payload[1][2];
  assert.equal(habitacion.ref, disponibilidad.id);
  assert.equal(resolver(eje.obtener(habitacion.ref).payload, habitacion.dir), 'individual');
  assert.equal(resolver(eje.obtener(precio.ref).payload, precio.dir), 'EUR 55');
  // 1.3: precio por noche (por referencia) × noches; LOCAL lee la décupla anidada a su profundidad.
  const total = evaluar(eje, reserva.id, [1, 3]);
  assert.equal(total.estado, 'RESUELTO');
  assert.equal(total.texto, '165 EUR');
  assert.ok(total.dependencias.includes(disponibilidad.id + ':1210000000'));
  // 1.4: el total compuesto con el tiempo que ocupa; composición heterogénea, operandos preservados.
  const conTiempo = evaluar(eje, reserva.id, [1, 4]);
  assert.equal(conTiempo.texto, '165 EUR + 3 dia');
  assert.equal(conTiempo.valor.tipo, 'composicion');
  assert.ok(conTiempo.dependencias.includes(reserva.id + ':1300000000'));
  // La fábrica consolidó lo que se paga como fórmula que lee el total de la reserva.
  assert.equal(evaluar(eje, consolidacion.id, [4]).texto, '165 EUR');
  // Consultar no tiene efectos.
  const antes = eje.orden.length;
  const saldo = eje.saldo('huesped', 'E:EUR');
  evaluar(eje, reserva.id, [1, 4]);
  assert.equal(eje.orden.length, antes);
  assert.equal(eje.saldo('huesped', 'E:EUR'), saldo);
});

test('encaje de la dirección 1 de la reserva: colisiones por ceros, lo alcanzado por la referencia y su vector', async () => {
  const { eje, disponibilidad, reserva, consolidacion } = await ejemploReserva();
  const oc = ocupantes(eje, reserva.id, [1]);
  // [1] y [1.0] colisionan en 1000000000 (exactos); lo que alcanza la referencia viene de 1010000000 de la disponibilidad.
  assert.deepEqual(oc.map((o) => o.origen), ['propio', 'propio', 'referencia']);
  assert.deepEqual(oc.map((o) => o.camino), [[1], [1, 0], [1, 0, 1]]);
  assert.ok(oc.slice(0, 2).every((o) => o.signo === 'exacto' && o.acuerdo === 10));
  assert.equal(oc[2].contenido, 'individual');
  assert.equal(oc[2].evento, disponibilidad.id);
  assert.deepEqual(oc[2].procedencia, [reserva.id + ':1000000000#1.0', disponibilidad.id + ':1010000000']);
  assert.deepEqual(oc[2].vector, [0, 0, -1, 0, 0, 0, 0, 0, 0, 0]); // le sobra una profundidad: reducir
  assert.equal(oc[2].signo, 'reducir');
  assert.equal(oc[2].acuerdo, 2);
  assert.equal(oc[2].excedentes, 1);
  assert.equal(oc[2].faltas, 0);
  // Lo mismo en 2 (el criterio elegido, 2100000000 → 2000000000) y en 4 (la consolidación escrita: completar).
  const oc2 = ocupantes(eje, reserva.id, [2]);
  assert.equal(oc2[2].contenido, 'con desayuno');
  assert.deepEqual(oc2[2].vector, [0, -1, 0, 0, 0, 0, 0, 0, 0, 0]);
  const oc4 = ocupantes(eje, reserva.id, [4]);
  assert.deepEqual(oc4.map((o) => [o.origen, o.evento, o.signo]), [['escrito', consolidacion.id, 'completar']]);
  assert.equal(oc4[0].vector[0], 4);
  // El árbol lógico de la reserva: colisiones en 1 y 2 (tres ocupantes cada una).
  const c = colisiones(arbol(eje, reserva.id));
  assert.equal(c.find((x) => x.dir === '1000000000').ocupantes.length, 3);
  assert.equal(c.find((x) => x.dir === '2000000000').ocupantes.length, 3);
  // BQL ve lo mismo: BUSCAR sale por encaje y el signo es consultable.
  assert.equal(consultar(eje, reserva.id, [1], 'CONTAR(BUSCAR(1))').texto, '3');
  assert.equal(consultar(eje, reserva.id, [1], 'CONTAR(FILTRAR(BUSCAR(1), SIGNO() = "reducir"))').texto, '1');
  // La consolidación guarda el encaje de sus fuentes.
  const e = consolidacion.contexto.encaje;
  assert.deepEqual(e.map((x) => [x.posicion, x.origen, x.destino, x.signo]), [[1, '1010000000', '1000000000', 'reducir'], [2, '2100000000', '2000000000', 'reducir']]);
  assert.deepEqual(consolidacion.contexto.fuentes, [disponibilidad.id]);
  // Límite conocido de los ceros finales, documentado: la primera habitación (1.0.0, «doble») no se puede
  // nombrar con precisión; 1000000000 nombra a la vez [1], [1.0] y [1.0.0]. Por eso la reserva elige 1.0.1.
  assert.deepEqual(ocupantes(eje, disponibilidad.id, [1]).map((o) => o.camino), [[1], [1, 0], [1, 0, 0]]);
  assert.equal(resolver(disponibilidad.payload, '1000000000').length, 3);
});

test('anclaje: la reserva vive en el futuro (7) de la disponibilidad, junto a las fechas', async () => {
  const { eje, disponibilidad, reserva } = await ejemploReserva();
  assert.deepEqual(eje.sobre(disponibilidad.id, '7000000000').map((x) => x.id), [reserva.id]);
  const oc = ocupantes(eje, disponibilidad.id, [7]);
  assert.deepEqual(oc.map((o) => o.origen), ['propio', 'propio', 'escrito']);
  assert.equal(oc[1].contenido, '2026-11-20');
  assert.equal(oc[2].evento, reserva.id);
  // En el eje temporal de la disponibilidad: las fechas declaradas en 7 y la reserva como proyección.
  const et = ejeTemporal(eje, disponibilidad.id, { ahora: '2026-11-07T12:00:00Z' });
  assert.deepEqual(et.futuro.map((x) => x.tipo), ['declarado', 'proyeccion']);
  assert.deepEqual(et.futuro[0].contenido, ['2026-11-20', '2026-11-23']);
  assert.equal(et.futuro[1].id, reserva.id);
  assert.equal(et.futuro[1].banda, 'semana');
});

test('estado del ciclo: consolidar → PENDIENTE DE AUTORIZACIÓN → recepción autoriza con P → huésped ejecuta con el pago E', async () => {
  const { eje, disponibilidad, reserva } = await ejemploReserva({ confirmar: false });
  assert.equal(eje.orden.length, 4);
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
  // La confirmación del ejemplo hace lo mismo y deja la evidencia en su hilo.
  const otra = await ejemploReserva({ confirmar: false });
  const { consolidacion, autorizacion, ejecucion } = await confirmarReserva(otra.eje, otra.reserva);
  assert.equal(consolidacion.contexto.fase, 'consolidado');
  assert.equal(autorizacion.contexto.fase, 'autorizado');
  assert.equal(ejecucion.contexto.fase, 'ejecutado');
  assert.deepEqual(ejecucion.payload.slice(1), [{ ref: consolidacion.id }, { ref: autorizacion.id }]);
  assert.deepEqual(ejecucion.movimientos[1], { token: 'E', denominacion: 'EUR', cantidad: 165, de: 'huesped', a: 'casa' });
  assert.equal(consolidaciones(otra.eje, otra.reserva.id)[0].estado, 'EJECUTADO');
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
  assert.equal(evaluar(otro, reserva.id, [1, 3]).texto, '165 EUR');
});
