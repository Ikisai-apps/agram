import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Eje } from '../src/eje.js';
import { crearEvento } from '../src/evento.js';
import { serializar, restaurar } from '../src/persistencia.js';

const T0 = '2026-11-06T20:00:00Z';

async function ejeBase() {
  return Eje.genesis({
    identidad: 'raiz',
    emision: [
      { token: 'T', escala: 'hora', cantidad: 100 },
      { token: 'E', denominacion: 'EUR', cantidad: 50 },
    ],
    foco: 'mundo de prueba',
    t: T0,
  });
}

const gastaT = (de, cantidad = 1) => ({ token: 'T', escala: 'hora', cantidad, de, a: null });

test('génesis: emite a la primera identidad y fija el foco raíz', async () => {
  const eje = await ejeBase();
  const g = eje.obtener(eje.genesisId);
  assert.equal(g.sobre, null);
  assert.equal(g.contexto.genesis, true);
  assert.equal(g.payload, 'mundo de prueba');
  assert.equal(eje.saldoT('raiz', 'hora'), 100);
  assert.equal(eje.saldo('raiz', 'T:hora'), 100);
  assert.equal(eje.saldo('raiz', 'E:raiz/EUR'), 50);
  assert.deepEqual(eje.identidades(), ['raiz']);
  // Las series del génesis quedan a nombre de su autor; la de E lleva su emisor en la clave.
  assert.deepEqual(eje.serie('E:raiz/EUR'), { emisor: 'raiz', emitido: 50 });
  assert.equal(g.movimientos[1].emisor, 'raiz');
  assert.deepEqual(eje.series().map((s) => s.clave + ' ' + s.emisor + ' ' + s.emitido), ['T:hora raiz 100', 'E:raiz/EUR raiz 50']);
});

test('escribir sobre el foco mueve tokens y crea identidades al recibir', async () => {
  const eje = await ejeBase();
  const ev = await eje.escribir({
    autor: 'raiz',
    sobre: eje.genesisId,
    t: T0,
    movimientos: [gastaT('raiz'), { token: 'T', escala: 'hora', cantidad: 10, de: 'raiz', a: 'cocina' }],
    payload: ['alta de cocina'],
  });
  assert.equal(eje.saldoT('raiz', 'hora'), 89);
  assert.equal(eje.saldoT('cocina', 'hora'), 10);
  assert.equal(eje.saldoT('cocina', 'minuto'), 0); // una hora no son sesenta minutos: son tokens distintos
  assert.deepEqual(eje.identidades(), ['raiz', 'cocina']);
  assert.deepEqual(eje.hilo(ev.id).map((e) => e.id), [ev.id, eje.genesisId]);
  assert.equal(eje.sobre(eje.genesisId).length, 1);
});

test('rechazos: foco desconocido, autor desconocido, emisión, saldo, duplicado', async () => {
  const eje = await ejeBase();
  const base = { autor: 'raiz', sobre: eje.genesisId, t: T0, payload: 'x' };
  await assert.rejects(eje.escribir({ ...base, sobre: 'nadie', movimientos: [gastaT('raiz')] }), /foco desconocido/);
  await assert.rejects(eje.escribir({ ...base, autor: 'bea', movimientos: [gastaT('bea')] }), /autor desconocido/);
  await assert.rejects(
    eje.escribir({ ...base, movimientos: [gastaT('raiz'), { token: 'T', escala: 'hora', cantidad: 1, de: null, a: 'raiz' }] }),
    /solo el génesis emite T/,
  );
  await assert.rejects(eje.escribir({ ...base, movimientos: [gastaT('raiz', 1000)] }), /saldo insuficiente/);
  await assert.rejects(eje.escribir({ ...base, movimientos: [{ token: 'T', escala: 'hora', cantidad: 1, de: 'raiz', a: 'raiz' }, gastaT('raiz')] }).then(() => eje.escribir({ ...base, movimientos: [{ token: 'T', escala: 'hora', cantidad: 1, de: 'raiz', a: 'raiz' }, gastaT('raiz')] })), /ya registrado/);
});

test('nadie puede fingir un segundo génesis', async () => {
  const eje = await ejeBase();
  await assert.rejects(
    eje.escribir({ autor: 'bea', sobre: eje.genesisId, t: T0, payload: 'x', contexto: { genesis: true },
      movimientos: [{ token: 'T', escala: 'hora', cantidad: 1, de: 'raiz', a: 'bea' }] }),
    /ya hay génesis/,
  );
});

test('un evento con id manipulado se rechaza', async () => {
  const eje = await ejeBase();
  const ev = await crearEvento({ autor: 'raiz', sobre: eje.genesisId, t: T0, movimientos: [gastaT('raiz')], payload: 'x' });
  const falso = { ...ev, payload: 'y' };
  await assert.rejects(eje.anadir(falso), /id no corresponde/);
});

test('hilo encadenado por referencia, no por orden temporal', async () => {
  const eje = await ejeBase();
  const a = await eje.escribir({ autor: 'raiz', sobre: eje.genesisId, t: T0, movimientos: [gastaT('raiz')], payload: 'a' });
  const b = await eje.escribir({ autor: 'raiz', sobre: eje.genesisId, t: T0, movimientos: [gastaT('raiz')], payload: 'b' });
  const c = await eje.escribir({ autor: 'raiz', sobre: a.id, t: T0, movimientos: [gastaT('raiz')], payload: 'c' });
  assert.deepEqual(eje.hilo(c.id).map((e) => e.payload), ['c', 'a', 'mundo de prueba']);
  assert.deepEqual(eje.hilo(b.id).map((e) => e.payload), ['b', 'mundo de prueba']);
});

test('T por escala: sin conversión; el evento mínimo mueve T de cualquier escala', async () => {
  const eje = await Eje.genesis({
    identidad: 'raiz',
    emision: [{ token: 'T', escala: 'hora', cantidad: 2 }, { token: 'T', escala: 'dia', cantidad: 1 }],
    foco: 'g',
    t: T0,
  });
  const base = { autor: 'raiz', sobre: eje.genesisId, t: T0, payload: 'x' };
  // Con horas no se pagan minutos.
  await assert.rejects(eje.escribir({ ...base, movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'raiz', a: null }] }), /saldo insuficiente de T:minuto en raiz/);
  // Cualquier escala vale para el evento mínimo.
  await eje.escribir({ ...base, movimientos: [{ token: 'T', escala: 'dia', cantidad: 1, de: 'raiz', a: null }] });
  assert.equal(eje.saldoT('raiz', 'dia'), 0);
  assert.equal(eje.saldoT('raiz', 'hora'), 2);
  assert.deepEqual(eje.tiempos('raiz'), [{ escala: 'hora', cantidad: 2 }]);
  assert.throws(() => eje.saldoT('raiz', 'mes'), /escala T inválida/);
  assert.throws(() => eje.saldoT('raiz'), /escala T inválida/);
});

// Altas con tipo: la casa es un grupo, bea una persona, la habitación una cosa.
async function conAltas() {
  const eje = await ejeBase();
  const alta = await eje.escribir({ autor: 'raiz', sobre: eje.genesisId, t: T0, payload: 'altas',
    contexto: { tipos: { casa: 'grupo', bea: 'persona', 'habitacion-2': 'cosa' } },
    movimientos: [gastaT('raiz'), ...['casa', 'bea', 'habitacion-2'].map((a) => ({ token: 'T', escala: 'hora', cantidad: 5, de: 'raiz', a }))] });
  return { eje, alta };
}

const emite = (emisor, denominacion, cantidad) => ({ token: 'E', emisor, denominacion, cantidad, de: null, a: emisor });
const mueveE = (emisor, denominacion, cantidad, de, a) => ({ token: 'E', emisor, denominacion, cantidad, de, a });

test('E: una persona o un grupo emite una serie limitada que respalda, a sí mismo, y solo él la amplía', async () => {
  const { eje, alta } = await conAltas();
  assert.equal(eje.tipo('casa'), 'grupo');
  assert.equal(eje.tipo('raiz'), null);
  // La casa emite un token por plaza y noche: dos camas el 13-11. La serie es suya: E:casa/cama@2026-11-13.
  const plazas = await eje.escribir({ autor: 'casa', sobre: alta.id, t: T0, payload: 'plazas del 13-11',
    movimientos: [gastaT('casa'), emite('casa', 'cama@2026-11-13', 2)] });
  assert.deepEqual(eje.serie('E:casa/cama@2026-11-13'), { emisor: 'casa', emitido: 2 });
  assert.equal(eje.saldo('casa', 'E:casa/cama@2026-11-13'), 2);
  assert.deepEqual(eje.recursos('casa'), [{ emisor: 'casa', denominacion: 'cama@2026-11-13', cantidad: 2 }]);
  // Nadie emite en nombre de otro, ni a otro: la serie nace en la cartera de su emisor.
  await assert.rejects(eje.escribir({ autor: 'bea', sobre: plazas.id, t: T0, payload: 'x',
    movimientos: [gastaT('bea'), emite('casa', 'cama@2026-11-13', 1)] }), /nadie emite en nombre de otro: casa no es el autor/);
  await assert.rejects(eje.escribir({ autor: 'casa', sobre: plazas.id, t: T0, payload: 'x',
    movimientos: [gastaT('casa'), { ...emite('casa', 'cama@2026-11-13', 1), a: 'bea' }] }), /emisión de E va a su propio emisor/);
  // Solo el emisor amplía su serie; puede emitir y dar en el mismo evento (lo emitido entra en la vista).
  await eje.escribir({ autor: 'casa', sobre: plazas.id, t: T0, payload: 'una cama más, para bea',
    movimientos: [gastaT('casa'), emite('casa', 'cama@2026-11-13', 1), mueveE('casa', 'cama@2026-11-13', 1, 'casa', 'bea')] });
  assert.deepEqual(eje.serie('E:casa/cama@2026-11-13'), { emisor: 'casa', emitido: 3 });
  assert.equal(eje.saldo('bea', 'E:casa/cama@2026-11-13'), 1);
  assert.equal(eje.saldo('casa', 'E:casa/cama@2026-11-13'), 2);
  // La serie es limitada: pasar más plazas de las que hay se rechaza (la reserva solapada no se ejecuta).
  await eje.escribir({ autor: 'casa', sobre: plazas.id, t: T0, payload: 'reserva',
    movimientos: [gastaT('casa'), mueveE('casa', 'cama@2026-11-13', 2, 'casa', 'bea')] });
  await assert.rejects(eje.escribir({ autor: 'casa', sobre: plazas.id, t: T0, payload: 'reserva solapada',
    movimientos: [gastaT('casa'), mueveE('casa', 'cama@2026-11-13', 1, 'casa', 'raiz')] }), /saldo insuficiente de E:casa\/cama@2026-11-13 en casa/);
  // E es fungible dentro de su serie: bea pasa una plaza de la casa a quien quiera.
  await eje.escribir({ autor: 'bea', sobre: plazas.id, t: T0, payload: 'cedo una plaza',
    movimientos: [gastaT('bea'), mueveE('casa', 'cama@2026-11-13', 1, 'bea', 'raiz')] });
  assert.equal(eje.saldo('raiz', 'E:casa/cama@2026-11-13'), 1);
  // T y P siguen sin emitirse fuera del génesis.
  await assert.rejects(eje.escribir({ autor: 'casa', sobre: plazas.id, t: T0, payload: 'x',
    movimientos: [gastaT('casa'), { token: 'P', cantidad: 1, ambito: 'genesis', de: null, a: 'casa' }] }), /solo el génesis emite P/);
  assert.deepEqual(eje.serie('E:nadie/x'), { emisor: null, emitido: 0 });
  assert.deepEqual(eje.series().map((s) => s.clave), ['T:hora', 'E:raiz/EUR', 'E:casa/cama@2026-11-13']);
  // Al restaurar, las series y los tipos se reconstruyen desde los eventos.
  const otro = await restaurar(JSON.parse(JSON.stringify(serializar(eje))));
  assert.deepEqual(otro.serie('E:casa/cama@2026-11-13'), { emisor: 'casa', emitido: 3 });
  assert.deepEqual(otro.series(), eje.series());
  assert.equal(otro.tipo('habitacion-2'), 'cosa');
});

test('E ligada al emisor como R: nadie se queda un nombre; la misma denominación de otro es otra serie', async () => {
  const { eje, alta } = await conAltas();
  // bea llega antes que la casa a la denominación de una noche: no se la quita a nadie.
  await eje.escribir({ autor: 'bea', sobre: alta.id, t: T0, payload: 'mi cama',
    movimientos: [gastaT('bea'), emite('bea', 'cama@2026-11-14', 1)] });
  await eje.escribir({ autor: 'casa', sobre: alta.id, t: T0, payload: 'plazas del 14-11',
    movimientos: [gastaT('casa'), emite('casa', 'cama@2026-11-14', 2)] });
  assert.deepEqual(eje.serie('E:bea/cama@2026-11-14'), { emisor: 'bea', emitido: 1 });
  assert.deepEqual(eje.serie('E:casa/cama@2026-11-14'), { emisor: 'casa', emitido: 2 });
  // Los EUR que emite la casa no son los EUR de raiz: emitirlos no infla la serie de raiz.
  await eje.escribir({ autor: 'casa', sobre: alta.id, t: T0, payload: 'vales de la casa',
    movimientos: [gastaT('casa'), emite('casa', 'EUR', 1e9)] });
  assert.deepEqual(eje.serie('E:raiz/EUR'), { emisor: 'raiz', emitido: 50 });
  assert.deepEqual(eje.serie('E:casa/EUR'), { emisor: 'casa', emitido: 1e9 });
  assert.equal(eje.saldo('casa', 'E:raiz/EUR'), 0);
  // Y nadie paga con EUR de raiz que no tiene, aunque tenga EUR propios.
  await assert.rejects(eje.escribir({ autor: 'casa', sobre: alta.id, t: T0, payload: 'x',
    movimientos: [gastaT('casa'), mueveE('raiz', 'EUR', 1, 'casa', 'bea')] }), /saldo insuficiente de E:raiz\/EUR en casa/);
  assert.deepEqual(eje.recursos('casa').map((r) => r.emisor + '/' + r.denominacion + ' ' + r.cantidad), ['casa/cama@2026-11-14 2', 'casa/EUR 1000000000']);
});

test('emitir es de personas y grupos; las cosas reciben, conservan y mueven tokens', async () => {
  const { eje, alta } = await conAltas();
  // La casa emite las plazas de la habitación y se las da en el mismo evento.
  const plazas = await eje.escribir({ autor: 'casa', sobre: alta.id, t: T0, payload: 'plazas de la habitación 2',
    movimientos: [gastaT('casa'), emite('casa', 'plaza@2026-11-13', 2), mueveE('casa', 'plaza@2026-11-13', 2, 'casa', 'habitacion-2')] });
  assert.equal(eje.saldo('habitacion-2', 'E:casa/plaza@2026-11-13'), 2);
  // La habitación las maneja: cede una a bea.
  await eje.escribir({ autor: 'habitacion-2', sobre: plazas.id, t: T0, payload: 'reserva de bea',
    movimientos: [gastaT('habitacion-2'), mueveE('casa', 'plaza@2026-11-13', 1, 'habitacion-2', 'bea')] });
  assert.equal(eje.saldo('bea', 'E:casa/plaza@2026-11-13'), 1);
  // Pero no emite: ni E ni R.
  await assert.rejects(eje.escribir({ autor: 'habitacion-2', sobre: plazas.id, t: T0, payload: 'x',
    movimientos: [gastaT('habitacion-2'), emite('habitacion-2', 'plaza@2026-11-13', 1)] }), /solo personas y grupos emiten: habitacion-2 es cosa/);
  await assert.rejects(eje.escribir({ autor: 'habitacion-2', sobre: plazas.id, t: T0, payload: 'x',
    movimientos: [gastaT('habitacion-2'), { token: 'R', cantidad: 1, emisor: 'habitacion-2', de: null, a: 'habitacion-2' }] }), /solo personas y grupos emiten: habitacion-2 es cosa/);
  // Quien no declaró tipo en su alta tampoco emite (raiz nació en un génesis sin tipo).
  await assert.rejects(eje.escribir({ autor: 'raiz', sobre: plazas.id, t: T0, payload: 'x',
    movimientos: [gastaT('raiz'), emite('raiz', 'EUR', 1)] }), /solo personas y grupos emiten: raiz no declaró tipo en su alta/);
  // El tipo se declara en el alta, con tokens, y no cambia.
  const base = { autor: 'raiz', sobre: alta.id, t: T0, payload: 'x' };
  await assert.rejects(eje.escribir({ ...base, contexto: { tipos: { bea: 'grupo' } }, movimientos: [gastaT('raiz'), { token: 'T', escala: 'hora', cantidad: 1, de: 'raiz', a: 'bea' }] }), /no se puede cambiar el tipo de bea/);
  await assert.rejects(eje.escribir({ ...base, contexto: { tipos: { dani: 'persona' } }, movimientos: [gastaT('raiz')] }), /tipo declarado para dani sin darle tokens/);
  await assert.rejects(eje.escribir({ ...base, contexto: { tipos: { dani: 'robot' } }, movimientos: [gastaT('raiz'), { token: 'T', escala: 'hora', cantidad: 1, de: 'raiz', a: 'dani' }] }), /tipo inválido para dani: robot/);
});

test('R: su emisor la declara y la amplía fuera del génesis, con rastro visible; nadie más', async () => {
  const { eje, alta } = await conAltas();
  const r = await eje.escribir({ autor: 'casa', sobre: alta.id, t: T0, payload: 'reputación de la casa',
    movimientos: [gastaT('casa'), { token: 'R', cantidad: 10, emisor: 'casa', de: null, a: 'casa' }] });
  await eje.escribir({ autor: 'casa', sobre: r.id, t: T0, payload: 'buen trato',
    movimientos: [gastaT('casa'), { token: 'R', cantidad: 5, emisor: 'casa', de: null, a: 'casa' }, { token: 'R', cantidad: 2, emisor: 'casa', de: 'casa', a: 'bea' }] });
  assert.deepEqual(eje.serie('R:casa'), { emisor: 'casa', emitido: 15 });
  assert.deepEqual(eje.reputaciones('bea'), [{ emisor: 'casa', cantidad: 2 }]);
  // El rastro: cada ampliación es un evento del eje, de su emisor.
  const ampliaciones = eje.orden.map((id) => eje.obtener(id)).filter((e) => e.movimientos.some((m) => m.token === 'R' && m.de === null));
  assert.deepEqual(ampliaciones.map((e) => e.autor + ' ' + e.movimientos.find((m) => m.token === 'R' && m.de === null).cantidad), ['casa 10', 'casa 5']);
  // Nadie amplía la reputación de otro.
  await assert.rejects(eje.escribir({ autor: 'bea', sobre: r.id, t: T0, payload: 'x',
    movimientos: [gastaT('bea'), { token: 'R', cantidad: 1, emisor: 'casa', de: null, a: 'casa' }] }), /emisión de R va a su propio emisor|nadie emite en nombre de otro/);
});

test('una serie limitada no llega a infinito', async () => {
  const { eje, alta } = await conAltas();
  await assert.rejects(eje.escribir({ autor: 'bea', sobre: alta.id, t: T0, payload: 'x',
    movimientos: [gastaT('bea'), emite('bea', 'BTC', 1.7e308), emite('bea', 'BTC', 1.7e308)] }), /la serie E:bea\/BTC no admite tanto/);
  await eje.escribir({ autor: 'bea', sobre: alta.id, t: T0, payload: 'x', movimientos: [gastaT('bea'), emite('bea', 'BTC', 1.7e308)] });
  await assert.rejects(eje.escribir({ autor: 'bea', sobre: alta.id, t: T0, payload: 'x', movimientos: [gastaT('bea'), emite('bea', 'BTC', 1.7e308)] }), /no admite tanto/);
  assert.equal(eje.serie('E:bea/BTC').emitido, 1.7e308);
  await assert.rejects(Eje.genesis({ identidad: 'raiz', emision: [{ token: 'T', escala: 'hora', cantidad: 1 }, { token: 'E', denominacion: 'X', cantidad: 1.7e308 }, { token: 'E', denominacion: 'X', cantidad: 1.7e308 }], foco: 'g', t: T0 }), /no admite tanto/);
});

test('T en enteros: sin fracciones no hay error de coma flotante', async () => {
  await assert.rejects(Eje.genesis({ identidad: 'raiz', emision: [{ token: 'T', escala: 'hora', cantidad: 0.3 }], foco: 'g', t: T0 }), /T va en enteros/);
  const eje = await Eje.genesis({ identidad: 'raiz', emision: [{ token: 'T', escala: 'minuto', cantidad: 18 }], foco: 'g', t: T0 });
  const base = { autor: 'raiz', sobre: eje.genesisId, t: T0, payload: 'x' };
  await eje.escribir({ ...base, movimientos: [{ token: 'T', escala: 'minuto', cantidad: 6, de: 'raiz', a: null }] });
  await eje.escribir({ ...base, payload: 'y', movimientos: [{ token: 'T', escala: 'minuto', cantidad: 12, de: 'raiz', a: null }] });
  assert.equal(eje.saldoT('raiz', 'minuto'), 0);
});

test('el génesis emite a su autor; sus series de E y R quedan a su nombre; su autor no es una cosa', async () => {
  await assert.rejects(Eje.genesis({ identidad: 'raiz', emision: [{ token: 'T', escala: 'hora', cantidad: 1 }, { token: 'E', denominacion: 'EUR', cantidad: 1, emisor: 'otra' }], foco: 'g', t: T0 }), /emisión de E va a su propio emisor/);
  await assert.rejects(Eje.genesis({ identidad: 'raiz', tipo: 'cosa', emision: [{ token: 'T', escala: 'hora', cantidad: 1 }], foco: 'g', t: T0 }), /su autor es persona o grupo, no cosa/);
  const g = await Eje.genesis({ identidad: 'raiz', tipo: 'grupo', emision: [{ token: 'T', escala: 'hora', cantidad: 1 }, { token: 'R', cantidad: 3 }], foco: 'g', t: T0 });
  assert.equal(g.tipo('raiz'), 'grupo');
  assert.deepEqual(g.serie('R:raiz'), { emisor: 'raiz', emitido: 3 });
  const eje = await ejeBase();
  const datos = JSON.parse(JSON.stringify(serializar(eje)));
  const gen = datos.eventos[0];
  delete gen.movimientos[1].emisor; // un génesis antiguo, sin emisor en E
  await assert.rejects(restaurar(datos), /E exige emisor/);
});
