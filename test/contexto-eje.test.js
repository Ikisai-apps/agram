// El contexto del BQL mínimo sobre el eje (src/contexto-eje.js): los
// despliegues (D-META, D-MOV, D-SERIE, D-FECHA, D-VALOR) y las vistas del
// libro como posiciones (A.1, A.7.e, X.1), sin tocar el eje.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluar, SIMBOLOS } from '../src/bqlm.js';
import { ContextoEje, NADIE, primitivaDe, desplegarFecha, desplegarSerie, desplegarValor } from '../src/contexto-eje.js';
import { EPOCA_0_BTML } from '../src/epocas.js';
import { ESCALAS_T, SEGUNDOS, diaCivil } from '../src/tokens.js';
import { crearEvento } from '../src/evento.js';
import { ejemploCompra, ejemploCuenta } from '../ejemplos/ikisai/compra-food.mjs';
import { ejemploReserva, seriePlaza } from '../ejemplos/ikisai/reserva-booking.mjs';

const val = (src, c) => {
  const r = evaluar(src, c);
  assert.equal(r.estado, 'RESUELTO', src + ': ' + r.motivo);
  return r.valor;
};
const uno = (src, c) => {
  const v = val(src, c);
  assert.equal(v.length, 1, src + ' da ' + v.length + ': ' + evaluar(src, c).texto);
  return v[0];
};

const T_PRUEBA = '2026-11-09T10:30:00Z';

test('D-FECHA: un instante es una décupla por escala, desde 1970-01-01T00:00Z en UTC', () => {
  const s = Date.parse(T_PRUEBA) / 1000;
  const d = desplegarFecha(T_PRUEBA);
  assert.deepEqual(d[0], [s]);
  assert.deepEqual(d[1], [Math.floor(s / 60)]);
  assert.deepEqual(d[2], [Math.floor(s / 3600)]);
  assert.deepEqual(d[3], [diaCivil(T_PRUEBA)], 'el 3 es el día civil de tokens.diaCivil');
  assert.deepEqual(d[4], [Math.floor(s / SEGUNDOS.semana)]);
  assert.deepEqual(d[5], [Math.floor(s / SEGUNDOS.ciclo)]);
  assert.deepEqual(d[6], [Math.floor(s / ((13 * 28 + 1) * 86400))], 'el año, de 364 + 1 días');
  assert.equal(d[7], undefined);
  // La misma hora con otra zona es el mismo instante.
  assert.deepEqual(desplegarFecha('2026-11-09T12:30:00+02:00'), d);
  assert.equal(desplegarFecha('2026-11-09'), null, 'sin hora no es un instante');
  const ctx = new ContextoEje(null, { epoch: [[T_PRUEBA]] });
  assert.equal(uno('epoch.0.3', ctx), diaCivil(T_PRUEBA));
  assert.equal(uno('epoch.0 = "' + T_PRUEBA + '"', ctx), true, 'el instante sigue valiendo su texto');
});

test('D-SERIE: una clave de serie es una décupla (familia, escala o emisor o ámbito, denominación, registro, franja)', () => {
  ESCALAS_T.forEach((e, k) => assert.deepEqual(desplegarSerie('T:' + e), { 0: ['T'], 1: [k] }, e));
  assert.equal(desplegarSerie('T:quincena'), null);
  assert.deepEqual(desplegarSerie('P:genesis'), { 0: ['P'], 1: ['genesis'] });
  assert.deepEqual(desplegarSerie('R:casa'), { 0: ['R'], 1: ['casa'] });
  assert.deepEqual(desplegarSerie('E:casa/EUR'), { 0: ['E'], 1: ['casa'], 2: ['EUR'] });
  const id = 'a'.repeat(64);
  assert.deepEqual(desplegarSerie('E:casa/cama-2@2026-11-13@' + id), { 0: ['E'], 1: ['casa'], 2: ['cama-2@2026-11-13'], 5: [id], 7: ['2026-11-13'] });
  assert.deepEqual(desplegarSerie('E:casa/EUR', () => id)[5], [id], 'sin registro en la clave, el que dice el eje');
  assert.equal(desplegarSerie('E:sinbarra'), null);
  assert.equal(desplegarSerie('X:algo'), null);
});

test('D-VALOR: «12 EUR» y «EUR 12» dan 1 cuánto y 2 unidad; un nombre con cifra no es una magnitud', () => {
  assert.deepEqual(desplegarValor('12 EUR'), { 1: [12], 2: ['EUR'] });
  assert.deepEqual(desplegarValor('EUR 12'), { 1: [12], 2: ['EUR'] });
  assert.deepEqual(desplegarValor('2.5 h'), { 1: [2.5], 2: ['h'] });
  assert.equal(desplegarValor('huesped2'), null);
  assert.equal(desplegarValor('12'), null);
  const ctx = new ContextoEje(null, { epoch: [['EUR 12']] });
  assert.equal(uno('epoch.0.1 * 2', ctx), 24);
  assert.equal(uno('epoch.0.2', ctx), 'EUR');
});

test('D-MOV: cada movimiento es una décupla con su primitiva', async () => {
  const id = 'b'.repeat(64);
  const ev = await crearEvento({
    autor: 'ana',
    sobre: id,
    t: T_PRUEBA,
    movimientos: [
      { token: 'T', escala: 'minuto', cantidad: 2, de: 'ana', a: null },
      { token: 'E', emisor: 'ana', denominacion: 'cama@2026-11-13', registro: id, cantidad: 4, de: null, a: 'ana', caduca: '2026-11-14T12:00:00Z' },
      { token: 'E', emisor: 'ana', denominacion: 'cama@2026-11-13', registro: id, cantidad: 1, de: 'ana', a: 'bea' },
      { token: 'P', ambito: id, cantidad: 3, de: 'ana', a: 'ana', estado: 'bloqueo', salida: 'la cama' },
      { token: 'P', ambito: id, cantidad: 1, de: 'ana', a: 'ana', estado: 'liberacion', salida: 'la cama' },
      { token: 'T', escala: 'pasado', cantidad: 1, de: 'ana', a: null, refiere: '2025-11-09T10:00:00Z', nota: 'lo hice el año pasado' },
    ],
    payload: ['Movimientos de prueba'],
  });
  assert.deepEqual(ev.movimientos.map(primitivaDe), ['burn', 'mint', 'transfer', 'lock', 'release', 'burn']);
  const ctx = new ContextoEje(null, { ev });
  assert.deepEqual(val('ev.1.4', ctx), ['burn', 'mint', 'transfer', 'lock', 'release', 'burn'].map((p) => SIMBOLOS[p]));
  assert.deepEqual(val('ev.1.1', ctx), [2, 4, 1, 3, 1, 1]);
  // B3: el 0 de un movimiento es su serie, un registro: su 0 es la clave legible (0.0 familia, 0.1 escala o emisor o ámbito).
  assert.deepEqual(val('ev.1.0.0.0', ctx), ['T', 'E', 'E', 'P', 'P', 'T'].map((f) => SIMBOLOS[f]));
  assert.deepEqual(evaluar('ev.1.0.0', ctx).texto, 'T:minuto, E:ana/cama@2026-11-13@' + id + ', E:ana/cama@2026-11-13@' + id + ', P:' + id + '/ana, P:' + id + '/ana, T:pasado', 'la clave legible vale la clave (P: registro y origen)');
  assert.deepEqual(val('ev.1.3.0', ctx), ['ana', NADIE, 'ana', 'ana', 'ana', 'ana']);
  assert.deepEqual(val('ev.1.3.1', ctx), [NADIE, 'ana', 'bea', 'ana', 'ana', NADIE]);
  assert.deepEqual(evaluar('(ev.1 where it.4 = lock) each 2', ctx).texto, 'bloqueo, la cama');
  assert.deepEqual(val('(ev.1 where it.4 = mint) each 2', ctx), ['2026-11-14T12:00:00Z'], 'la caducidad es condición');
  // B3: el 7 se parte: 7.0 la caducidad, 7.1 la fecha a la que se refiere.
  assert.deepEqual(val('(ev.1 where it.4 = mint) each 7.0', ctx), ['2026-11-14T12:00:00Z'], 'y es para cuándo: 7.0');
  assert.deepEqual(val('(ev.1 where it.4 = mint) each 7.1', ctx), []);
  assert.deepEqual(val('ev.1.5', ctx), [id, id], 'el registro de la serie de E');
  assert.deepEqual(val('(ev.1 where it.0.0.1 = 7) each 7.1', ctx), ['2025-11-09T10:00:00Z'], 'el T pasado lleva la fecha a la que se refiere: 7.1');
  assert.deepEqual(val('(ev.1 where it.0.0.1 = 7) each 7.0', ctx), []);
  assert.deepEqual(val('ev.1.9', ctx), ['lo hice el año pasado']);
  assert.deepEqual(val('(ev.1 where it.4 = mint) each 0.7', ctx), ['2026-11-13'], 'la franja de la serie');
  // La serie como registro: 1.0 emitido y 1.1 consumido (antes de ev), 2 su contrato, 3 sus emisores, 5 su registro.
  assert.deepEqual(val('(ev.1 where it.4 = mint) each 0.1.0', ctx), [0], 'nace en la candidata: nada emitido antes');
  assert.deepEqual(val('(ev.1 where it.4 = mint) each 0.2.7', ctx), ['2026-11-14T12:00:00Z'], 'su caducidad es del contrato');
  assert.deepEqual(val('(ev.1 where it.4 = mint) each 0.2.0', ctx), [], 'no es divisible');
  assert.deepEqual(val('(ev.1 where it.4 = mint) each 0.3', ctx), ['ana'], 'la emite ana');
  assert.deepEqual(val('(ev.1 where it.4 = mint) each 0.5', ctx), [id]);
  // Una clave escrita como texto ya no se despliega: la serie es un registro al que se llega desde el libro.
  assert.deepEqual(val('("E:ana/vale").0', new ContextoEje(null, { epoch: [['x']] })), []);
});

test('D-META: el evento como registro: 3 autor (y firmante), 5 id, 6.0 t, 6.5 sobre y en, 1 movimientos que colisionan con el payload', async () => {
  const { eje, menu, compra } = await ejemploCompra();
  const ctx = new ContextoEje(eje, { ev: compra });
  assert.deepEqual(val('ev.3', ctx), ['huesped', NADIE, 'huesped', 'cocina'], 'el autor, el firmante («nadie»: no va firmado) y luego lo que el payload tiene en su 3');
  assert.equal(uno('first ev.3', ctx), 'huesped');
  assert.equal(uno('ev.5', ctx), compra.id);
  assert.equal(uno('ev.6.0', ctx), '2026-11-07T13:30:00Z');
  assert.equal(uno('ev.6.0.3', ctx), diaCivil('2026-11-07T13:30:00Z'));
  assert.deepEqual(val('ev.6.5', ctx), [menu.id, '0000000000']);
  assert.equal(uno('count ev.1', ctx), 3, 'dos movimientos y la décupla del payload');
  assert.deepEqual(val('ev.1.4', ctx), [SIMBOLOS.burn, SIMBOLOS.transfer]);
  // La décupla del payload: 1.0 sigue la referencia al 1 del menú (sus tres platos), 1.2 es una magnitud.
  assert.equal(evaluar('ev.1.0', ctx).texto, 'T:hora, E:casa/EUR, ensalada, guiso, fruta');
  assert.equal(uno('first ev.1.0 = "T:hora"', ctx), true, 'la serie vale su clave');
  assert.deepEqual(val('ev.1.2.1', ctx), [12]);
  // Un registro del eje se lee igual, y su texto (el id) también es el registro.
  assert.equal(uno('("' + compra.id + '").5', ctx), compra.id);
  assert.equal(uno('first ("' + menu.id + '").3', ctx), 'cocina');
  // Un evento firmado lleva el firmante en el 3.
  const firmado = { ...compra, firmante: 'huesped', firma: 'x' };
  assert.deepEqual(val('ev.3', new ContextoEje(eje, { ev: firmado })), ['huesped', 'huesped', 'huesped', 'cocina']);
});

test('árbol: up, down y path por el ancla 6.5; lo escrito anclado es ocupante de su posición; referencias ausentes, PENDIENTE', async () => {
  const { eje, alta, menu, compra } = await ejemploCompra();
  const cuenta = await ejemploCuenta(eje, compra);
  const ctx = new ContextoEje(eje, { ev: cuenta });
  assert.deepEqual(val('up ev', ctx), [{ k: 'reg', id: compra.id }]);
  assert.deepEqual(val('path ev', ctx).map((o) => ctx.valor(o) ?? o.k), [cuenta.id, compra.id, menu.id, alta.id, eje.genesisId]);
  assert.deepEqual(val('up up up up up ev', ctx), [], 'el génesis no tiene padre');
  assert.deepEqual(val('down (up ev)', ctx).map((o) => o.id), [cuenta.id]);
  assert.equal(uno('count down ev', ctx), 0);
  // La cuenta está anclada en el 1 de la compra: es ocupante de compra.1, tras sus movimientos y su payload.
  assert.equal(uno('count (up ev).1', ctx), 4);
  assert.equal(uno('last (up ev).1', ctx).id, cuenta.id);
  assert.equal(uno('(last (up ev).1).0', ctx), 'Cuenta del menú');
  assert.equal(uno('count (up ev).1.0', ctx), 6, 'compra.1.0: dos series, tres platos y el 0 de la cuenta');
  // up de algo que no es un registro.
  assert.equal(evaluar('up "hola"', ctx).estado, 'ERROR');
  // Una referencia a un evento que no está.
  const ausente = { autor: 'huesped', t: '2026-11-07T15:00:00Z', sobre: compra.id, movimientos: [], payload: ['x', [{ ref: 'f'.repeat(64), dir: '1000000000' }]] };
  const r = evaluar('ev.1', new ContextoEje(eje, { ev: ausente }));
  assert.equal(r.estado, 'PENDIENTE');
  assert.match(r.motivo, /ausente del eje/);
});

test('path: el hilo tiene un tope de diez niveles; más, PENDIENTE', async () => {
  const { eje, menu } = await ejemploCompra();
  let foco = menu;
  for (let k = 0; k < 8; k++) {
    foco = await eje.escribir({ autor: 'cocina', sobre: foco.id, t: '2026-11-07T15:00:00Z', movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'cocina', a: null }], payload: ['nivel ' + k] });
  }
  const ctx = new ContextoEje(eje, { ev: { autor: 'cocina', sobre: foco.id, t: '2026-11-07T15:00:00Z', movimientos: [], payload: ['hoja'] } });
  const r = evaluar('count path ev', ctx);
  assert.equal(r.estado, 'PENDIENTE');
  assert.match(r.motivo, /pasa de 10 niveles/);
  assert.equal(uno('count path up up ev', ctx), 10);
});

test('vistas: A.1 es la cartera por serie (1 disponible, 2 bloqueado por salida); A.7.e lo gastado hoy de T', async () => {
  const { eje, compra } = await ejemploCompra();
  const ctx = new ContextoEje(eje, { ev: { autor: 'huesped', sobre: compra.id, t: '2026-11-07T18:00:00Z', movimientos: [], payload: ['después'] } });
  // Encargo 3b: la cartera trae la R que le guardó la invitación de la casa y el P que obtuvo (mapa §15 [D] N1, N2):
  // sobre su alta, sobre el génesis (la raíz de la casa: por la R recibida y por los EUR, que están atados a él) y
  // sobre la compra.
  const altaH = eje.alta('huesped').id;
  assert.deepEqual(val('("huesped").1', ctx).map((o) => o.clave), ['R:casa', 'P:' + altaH + '/huesped', 'P:' + eje.genesisId + '/huesped', 'E:casa/EUR', 'P:' + compra.id + '/huesped']);
  assert.equal(uno('("huesped").1.("E:casa/EUR").1', ctx), 48);
  assert.equal(uno('("huesped").1.("E:casa/EUR").0.0.0', ctx), SIMBOLOS.E, 'el 0 de cada entrada es la serie, un registro: su 0.0 es la familia');
  assert.equal(uno('("huesped").1.("E:casa/EUR").0.1.0', ctx), 500, 'y su 1.0, lo emitido');
  assert.deepEqual(val('("huesped").1.("E:casa/EUR").0.3', ctx), ['casa'], 'y su 3, quien la emite');
  // El 2 de una identidad es su criterio: 2.1 su P posicionado, una entrada por registro (0 el registro, 1 cuánto).
  assert.deepEqual(val('("huesped").2.1 each 0', ctx), [altaH, eje.genesisId, compra.id]);
  // Sobre el génesis, diez por la R de la invitación y diez por cada uno de los 60 EUR que le dio la casa (encargo 3b-bis: la obtención es por cantidad).
  assert.deepEqual(val('("huesped").2.1 each 1', ctx), [10, 610, 10]);
  // Su 6, los orígenes de lo que tiene (encargo 3b-bis): todo es suyo; y A.2.6, lo que obtuvo, esté donde esté.
  assert.deepEqual(val('("huesped").2.1 each 6.3', ctx), ['huesped', 'huesped', 'huesped']);
  assert.deepEqual(val('("huesped").2.6 each 0', ctx), [altaH, eje.genesisId, compra.id]);
  assert.equal(uno('("cocina").1.("T:hora").1', ctx), 18, 'la cosa conserva el T que le dio su persona');
  assert.equal(uno('("huesped").7.2', ctx), 1, 'una hora gastada el día de la compra');
  assert.equal(uno('("huesped").7.1', ctx), 1, 'el minuto de escribir su propia alta (B1)');
  assert.equal(uno('("casa").7.1', ctx), 243, 'la casa gastó 3 minutos escribiendo (su emisión inicial, la invitación y las altas) y dio 240 a la cocina');
  assert.deepEqual(val('("huesped").7.8', ctx), [], 'las informativas no se gastan de ninguna asignación');
  // Al día siguiente, la asignación empieza entera: lo gastado vuelve a 0.
  const mañana = new ContextoEje(eje, { ev: { autor: 'huesped', sobre: compra.id, t: '2026-11-08T09:00:00Z', movimientos: [], payload: ['mañana'] } });
  assert.equal(uno('(first ev.3).7.2', mañana), 0);
  // Sin transacción no hay fecha: A.7 queda pendiente.
  const r = evaluar('("huesped").7.2', new ContextoEje(eje));
  assert.equal(r.estado, 'PENDIENTE');
  assert.match(r.motivo, /fecha de la transacción/);
  // Lo que no es una identidad no tiene cartera.
  assert.deepEqual(val('("nadie conocido").1', ctx), []);
});

test('vistas: lo bloqueado por salida en A.1.(serie).2, y las series atadas vivas en el 1 de un registro de recurso', async () => {
  const { eje, habitacion } = await ejemploReserva({ confirmar: false });
  const ctx = new ContextoEje(eje, { ev: { autor: 'casa', sobre: habitacion.id, t: '2026-11-08T10:00:00Z', movimientos: [], payload: ['mirar'] } });
  const bloqueos = eje.bloqueos('casa').filter((b) => b.token === 'P');
  assert.ok(bloqueos.length > 0);
  const { clave, salida, cantidad } = bloqueos[0];
  assert.equal(uno('("casa").1.("' + clave + '").2.("' + salida + '").1', ctx), cantidad);
  assert.equal(uno('sum (("casa").1.("' + clave + '").2 each 1)', ctx), eje.bloqueado('casa', clave));
  // El 1 de la habitación: sus series de plaza vivas, cada una con lo vivo en su 1.
  const k = seriePlaza(habitacion.id, 0, '2026-11-16');
  assert.equal(uno('("' + habitacion.id + '").1.("' + k + '").1', ctx), eje.vivo(k, '2026-11-08T10:00:00Z'));
  assert.equal(uno('("' + habitacion.id + '").1.("' + k + '").0.5', ctx), habitacion.id, 'la serie está atada a la habitación');
  // Lo vivo caduca con el reloj de los demás (B6; SEG-03, SEG-05): la casa, fechando a futuro, no la hace caducar.
  const tarde = () => new ContextoEje(eje, { ev: { autor: 'casa', sobre: habitacion.id, t: '2026-11-18T10:00:00Z', movimientos: [], payload: ['tarde'] } });
  assert.equal(uno('("' + habitacion.id + '").1.("' + k + '").1', tarde()), eje.vivo(k));
  // Cuando otro escribe pasada esa noche, ya no está viva.
  await eje.escribir({ autor: 'huesped', sobre: habitacion.id, t: '2026-11-18T09:00:00Z', payload: ['de vuelta'], movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'huesped', a: null }] });
  assert.deepEqual(val('("' + habitacion.id + '").1.("' + k + '")', tarde()), []);
  assert.equal(uno('before.6.3', tarde()), '2026-11-18T09:00:00.000Z', 'el reloj de los demás');
});

test('B6: el reloj de los demás (before.6.3), las series vivas del subárbol (X.7.1), lo bloqueado por salida de todos (before.2) y el orden del movimiento (nth en ev.1)', async () => {
  const { eje, alojamiento, habitacion } = await ejemploReserva({ confirmar: false });
  const ev = { autor: 'casa', sobre: habitacion.id, t: '2026-11-09T10:00:00Z', movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'casa', a: null }, { token: 'T', escala: 'hora', cantidad: 1, de: 'casa', a: null }], payload: ['mirar'] };
  const ctx = new ContextoEje(eje, { ev });
  // El reloj de los demás: el mayor t de las identidades que no son el autor de la candidata.
  assert.equal(uno('before.6.3', ctx), new Date(eje.tMaximo(['casa'])).toISOString());
  assert.equal(uno('before.6.0', ctx), new Date(eje.tMaximo()).toISOString());
  // X.7.1: las series de E vivas de todo el subárbol; el alojamiento ve las de su habitación, que cuelga de él.
  const vivasDe = (id) => eje.series().filter((s) => s.token === 'E' && s.registro && eje.hilo(s.registro).some((x) => x.id === id) && eje.vivo(s.clave) > 0).map((s) => s.clave);
  assert.ok(vivasDe(habitacion.id).length > 0);
  assert.deepEqual(val('("' + habitacion.id + '").7.1 each 0', ctx).map((n) => ctx.valor(n)), vivasDe(habitacion.id));
  assert.deepEqual(val('("' + alojamiento.id + '").7.1 each 0', ctx).map((n) => ctx.valor(n)), vivasDe(alojamiento.id));
  assert.deepEqual(val('("' + alojamiento.id + '").1', ctx).filter((n) => n?.k === 'viva'), [], 'en su 1, solo lo atado al propio registro');
  assert.equal(uno('sum (("' + alojamiento.id + '").7.1 each 1)', ctx), vivasDe(alojamiento.id).reduce((n, k) => n + eje.vivo(k), 0));
  // before.2: por salida y serie, lo bloqueado sumado sobre todos los titulares (BL-3); vale su salida.
  const { salida, clave } = eje.bloqueos('casa').find((b) => b.token === 'P');
  const total = eje.bloqueosCon(salida).filter((b) => b.clave === clave).reduce((n, b) => n + b.cantidad, 0);
  assert.equal(uno('sum ((before.2.("' + salida + '") where it.0 = "' + clave + '") each 1)', ctx), total);
  assert.deepEqual(val('first (before.2.("' + salida + '") where it.0 = "' + clave + '") .3', ctx), eje.bloqueosCon(salida).filter((b) => b.clave === clave).map((b) => b.identidad));
  // El orden de un movimiento es su lugar en ev.1: los movimientos van primero, por orden (nth, desde 0).
  assert.equal(uno('(nth 1 ev.1).0.0.1', ctx), 2, 'el segundo movimiento es el de la hora (escala 2)');
  assert.equal(uno('(nth 0 ev.1).0.0.1', ctx), 1);
});

test('before: el libro de antes: 3 las identidades, 5 el génesis, 6.0 el mayor t', async () => {
  const { eje } = await ejemploCompra();
  const ctx = new ContextoEje(eje, { epoch: EPOCA_0_BTML });
  assert.deepEqual(val('before.3', ctx), ['casa', 'huesped', 'cocina']);
  assert.equal(uno('before.5', ctx), eje.genesisId);
  assert.equal(uno('before.6.0', ctx), '2026-11-07T13:30:00.000Z');
  assert.equal(uno('before.3.("cocina").1.("T:hora").1', ctx), 18);
});

test('el contexto no cambia el eje: leer todas las vistas deja los saldos y los eventos como estaban', async () => {
  const { eje, compra } = await ejemploCompra();
  const antes = JSON.stringify([...eje.saldos].map(([k, v]) => [k, [...v]])) + eje.orden.join();
  const ctx = new ContextoEje(eje, { ev: compra, epoch: EPOCA_0_BTML });
  for (const src of ['ev.1', 'path ev', '(first ev.3).1', '(first ev.3).7.2', 'before.3', 'down before.5', 'epoch.2.0.2']) evaluar(src, ctx);
  assert.equal(JSON.stringify([...eje.saldos].map(([k, v]) => [k, [...v]])) + eje.orden.join(), antes);
});
