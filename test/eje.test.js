import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Eje } from '../src/eje.js';
import { crearEvento } from '../src/evento.js';
import { serializar, restaurar } from '../src/persistencia.js';

const T0 = '2026-11-06T20:00:00Z';

async function ejeBase() {
  return Eje.genesis({
    demostracion: true,
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
  // VG, 7-11 noche: T ya no es solo del génesis; lo emite cada persona para sí misma, y raiz no declaró que lo sea.
  await assert.rejects(
    eje.escribir({ ...base, movimientos: [gastaT('raiz'), { token: 'T', escala: 'hora', cantidad: 1, de: null, a: 'raiz' }] }),
    /solo las personas emiten: raiz no declaró tipo en su alta/,
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
    demostracion: true,
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

// Altas con tipo: la casa y bea son personas, el club un grupo, la habitación una cosa.
// VG, 7-11 noche: solo emiten personas, así que la casa que emite plazas es una persona (antes, un grupo).
async function conAltas() {
  const eje = await ejeBase();
  const alta = await eje.escribir({ autor: 'raiz', sobre: eje.genesisId, t: T0, payload: 'altas',
    contexto: { tipos: { casa: 'persona', bea: 'persona', 'habitacion-2': 'cosa', club: 'grupo' } },
    movimientos: [gastaT('raiz'), ...['casa', 'bea', 'habitacion-2', 'club'].map((a) => ({ token: 'T', escala: 'hora', cantidad: 20, de: 'raiz', a }))] });
  return { eje, alta };
}

const emite = (emisor, denominacion, cantidad) => ({ token: 'E', emisor, denominacion, cantidad, de: null, a: emisor });
const mueveE = (emisor, denominacion, cantidad, de, a) => ({ token: 'E', emisor, denominacion, cantidad, de, a });
/** R propia en juego: la persona pone uno de su R en manos de otra (VG, 7-11 noche: lo exigen P y E). */
const enJuego = (persona, a = 'raiz') => ({ token: 'R', emisor: persona, cantidad: 1, de: persona, a });

/**
 * VG, 7-11 noche: E es el último escalón (T + R + P). Prepara a una persona
 * para emitir E: emite su R (T + R), escribe su dominio y emite P sobre él
 * poniendo su R en juego (T + R + P). Devuelve el dominio, sobre el que ya
 * puede emitir E.
 */
async function escalonE(eje, persona) {
  const r = await eje.escribir({ autor: persona, sobre: eje.genesisId, t: T0, payload: 'reputación de ' + persona,
    movimientos: [gastaT(persona), { token: 'R', cantidad: 10, emisor: persona, de: null, a: persona }] });
  const dominio = await eje.escribir({ autor: persona, sobre: r.id, t: T0, payload: 'dominio de ' + persona, movimientos: [gastaT(persona)] });
  await eje.escribir({ autor: persona, sobre: dominio.id, t: T0, payload: 'poder sobre mi dominio',
    movimientos: [gastaT(persona), enJuego(persona), { token: 'P', ambito: dominio.id, cantidad: 1, de: null, a: persona }] });
  return dominio;
}

test('E: una persona emite una serie limitada que respalda, a sí misma, y solo ella la amplía', async () => {
  const { eje } = await conAltas();
  assert.equal(eje.tipo('casa'), 'persona');
  assert.equal(eje.tipo('raiz'), null);
  const dominio = await escalonE(eje, 'casa');
  // La casa emite un token por plaza y noche: dos camas el 13-11. La serie es suya: E:casa/cama@2026-11-13.
  const plazas = await eje.escribir({ autor: 'casa', sobre: dominio.id, t: T0, payload: 'plazas del 13-11',
    movimientos: [gastaT('casa'), enJuego('casa'), emite('casa', 'cama@2026-11-13', 2)] });
  assert.deepEqual(eje.serie('E:casa/cama@2026-11-13'), { emisor: 'casa', emitido: 2 });
  assert.equal(eje.saldo('casa', 'E:casa/cama@2026-11-13'), 2);
  assert.deepEqual(eje.recursos('casa'), [{ emisor: 'casa', denominacion: 'cama@2026-11-13', cantidad: 2 }]);
  // Nadie emite en nombre de otro, ni a otro: la serie nace en la cartera de su emisor.
  await assert.rejects(eje.escribir({ autor: 'bea', sobre: plazas.id, t: T0, payload: 'x',
    movimientos: [gastaT('bea'), emite('casa', 'cama@2026-11-13', 1)] }), /nadie emite en nombre de otro: casa no es el autor/);
  await assert.rejects(eje.escribir({ autor: 'casa', sobre: plazas.id, t: T0, payload: 'x',
    movimientos: [gastaT('casa'), enJuego('casa'), { ...emite('casa', 'cama@2026-11-13', 1), a: 'bea' }] }), /emisión de E va a su propio emisor/);
  // Solo el emisor amplía su serie; puede emitir y dar en el mismo evento (lo emitido entra en la vista).
  await eje.escribir({ autor: 'casa', sobre: plazas.id, t: T0, payload: 'una cama más, para bea',
    movimientos: [gastaT('casa'), enJuego('casa'), emite('casa', 'cama@2026-11-13', 1), mueveE('casa', 'cama@2026-11-13', 1, 'casa', 'bea')] });
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
  // VG, 7-11 noche: P se emite fuera del génesis sobre un registro, nunca sobre todo el eje.
  await assert.rejects(eje.escribir({ autor: 'casa', sobre: plazas.id, t: T0, payload: 'x',
    movimientos: [gastaT('casa'), enJuego('casa'), { token: 'P', cantidad: 1, ambito: 'genesis', de: null, a: 'casa' }] }), /P sobre todo el eje \(«genesis»\) solo lo emite el génesis/);
  assert.deepEqual(eje.serie('E:nadie/x'), { emisor: null, emitido: 0 });
  assert.deepEqual(eje.series().map((s) => s.clave), ['T:hora', 'E:raiz/EUR', 'R:casa', 'P:' + dominio.id, 'E:casa/cama@2026-11-13']);
  // Al restaurar, las series y los tipos se reconstruyen desde los eventos.
  const otro = await restaurar(JSON.parse(JSON.stringify(serializar(eje))));
  assert.deepEqual(otro.serie('E:casa/cama@2026-11-13'), { emisor: 'casa', emitido: 3 });
  assert.deepEqual(otro.series(), eje.series());
  assert.equal(otro.tipo('habitacion-2'), 'cosa');
});

test('E ligada al emisor como R: nadie se queda un nombre; la misma denominación de otro es otra serie', async () => {
  const { eje } = await conAltas();
  const deBea = await escalonE(eje, 'bea');
  const deCasa = await escalonE(eje, 'casa');
  // bea llega antes que la casa a la denominación de una noche: no se la quita a nadie.
  await eje.escribir({ autor: 'bea', sobre: deBea.id, t: T0, payload: 'mi cama',
    movimientos: [gastaT('bea'), enJuego('bea'), emite('bea', 'cama@2026-11-14', 1)] });
  await eje.escribir({ autor: 'casa', sobre: deCasa.id, t: T0, payload: 'plazas del 14-11',
    movimientos: [gastaT('casa'), enJuego('casa'), emite('casa', 'cama@2026-11-14', 2)] });
  assert.deepEqual(eje.serie('E:bea/cama@2026-11-14'), { emisor: 'bea', emitido: 1 });
  assert.deepEqual(eje.serie('E:casa/cama@2026-11-14'), { emisor: 'casa', emitido: 2 });
  // Los EUR que emite la casa no son los EUR de raiz: emitirlos no infla la serie de raiz.
  await eje.escribir({ autor: 'casa', sobre: deCasa.id, t: T0, payload: 'vales de la casa',
    movimientos: [gastaT('casa'), enJuego('casa'), emite('casa', 'EUR', 1e9)] });
  assert.deepEqual(eje.serie('E:raiz/EUR'), { emisor: 'raiz', emitido: 50 });
  assert.deepEqual(eje.serie('E:casa/EUR'), { emisor: 'casa', emitido: 1e9 });
  assert.equal(eje.saldo('casa', 'E:raiz/EUR'), 0);
  // Y nadie paga con EUR de raiz que no tiene, aunque tenga EUR propios.
  await assert.rejects(eje.escribir({ autor: 'casa', sobre: deCasa.id, t: T0, payload: 'x',
    movimientos: [gastaT('casa'), mueveE('raiz', 'EUR', 1, 'casa', 'bea')] }), /saldo insuficiente de E:raiz\/EUR en casa/);
  assert.deepEqual(eje.recursos('casa').map((r) => r.emisor + '/' + r.denominacion + ' ' + r.cantidad), ['casa/cama@2026-11-14 2', 'casa/EUR 1000000000']);
});

test('emitir es solo de personas (VG, 7-11 noche); los grupos y las cosas reciben, conservan y mueven tokens', async () => {
  const { eje } = await conAltas();
  const dominio = await escalonE(eje, 'casa');
  // La casa emite las plazas de la habitación y se las da en el mismo evento.
  const plazas = await eje.escribir({ autor: 'casa', sobre: dominio.id, t: T0, payload: 'plazas de la habitación 2',
    movimientos: [gastaT('casa'), enJuego('casa'), emite('casa', 'plaza@2026-11-13', 2), mueveE('casa', 'plaza@2026-11-13', 2, 'casa', 'habitacion-2')] });
  assert.equal(eje.saldo('habitacion-2', 'E:casa/plaza@2026-11-13'), 2);
  // La habitación las maneja: cede una a bea.
  await eje.escribir({ autor: 'habitacion-2', sobre: plazas.id, t: T0, payload: 'reserva de bea',
    movimientos: [gastaT('habitacion-2'), mueveE('casa', 'plaza@2026-11-13', 1, 'habitacion-2', 'bea')] });
  assert.equal(eje.saldo('bea', 'E:casa/plaza@2026-11-13'), 1);
  // Pero no emite: ni E ni R.
  await assert.rejects(eje.escribir({ autor: 'habitacion-2', sobre: plazas.id, t: T0, payload: 'x',
    movimientos: [gastaT('habitacion-2'), emite('habitacion-2', 'plaza@2026-11-13', 1)] }), /solo las personas emiten: habitacion-2 es cosa/);
  await assert.rejects(eje.escribir({ autor: 'habitacion-2', sobre: plazas.id, t: T0, payload: 'x',
    movimientos: [gastaT('habitacion-2'), { token: 'R', cantidad: 1, emisor: 'habitacion-2', de: null, a: 'habitacion-2' }] }), /solo las personas emiten: habitacion-2 es cosa/);
  // VG, 7-11 noche: un grupo tampoco emite por sí mismo (antes sí); lo que emite a su nombre lo emite una persona con P sobre su registro.
  await assert.rejects(eje.escribir({ autor: 'club', sobre: plazas.id, t: T0, payload: 'x',
    movimientos: [gastaT('club'), { token: 'R', cantidad: 1, emisor: 'club', de: null, a: 'club' }] }), /solo las personas emiten: club es grupo/);
  await assert.rejects(eje.escribir({ autor: 'casa', sobre: plazas.id, t: T0, payload: 'x',
    movimientos: [gastaT('casa'), { token: 'R', cantidad: 1, emisor: 'club', de: null, a: 'club' }] }), /emitir a nombre del grupo club exige P sobre su registro/);
  // Quien no declaró tipo en su alta tampoco emite (raiz nació en un génesis sin tipo).
  await assert.rejects(eje.escribir({ autor: 'raiz', sobre: plazas.id, t: T0, payload: 'x',
    movimientos: [gastaT('raiz'), emite('raiz', 'EUR', 1)] }), /solo las personas emiten: raiz no declaró tipo en su alta/);
  // El tipo se declara en el alta, con tokens, y no cambia.
  const alta = eje.obtener(eje.alta('bea').id); // el alta de bea es el registro de altas
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
  const { eje } = await conAltas();
  const dominio = await escalonE(eje, 'bea');
  const base = { autor: 'bea', sobre: dominio.id, t: T0, payload: 'x' };
  await assert.rejects(eje.escribir({ ...base, movimientos: [gastaT('bea'), enJuego('bea'), emite('bea', 'BTC', 1.7e308), emite('bea', 'BTC', 1.7e308)] }), /la serie E:bea\/BTC no admite tanto/);
  await eje.escribir({ ...base, movimientos: [gastaT('bea'), enJuego('bea'), emite('bea', 'BTC', 1.7e308)] });
  await assert.rejects(eje.escribir({ ...base, movimientos: [gastaT('bea'), enJuego('bea'), emite('bea', 'BTC', 1.7e308)] }), /no admite tanto/);
  assert.equal(eje.serie('E:bea/BTC').emitido, 1.7e308);
  await assert.rejects(Eje.genesis({ demostracion: true, identidad: 'raiz', emision: [{ token: 'T', escala: 'hora', cantidad: 1 }, { token: 'E', denominacion: 'X', cantidad: 1.7e308 }, { token: 'E', denominacion: 'X', cantidad: 1.7e308 }], foco: 'g', t: T0 }), /no admite tanto/);
});

test('T en enteros: sin fracciones no hay error de coma flotante', async () => {
  await assert.rejects(Eje.genesis({ demostracion: true, identidad: 'raiz', emision: [{ token: 'T', escala: 'hora', cantidad: 0.3 }], foco: 'g', t: T0 }), /T va en enteros/);
  const eje = await Eje.genesis({ demostracion: true, identidad: 'raiz', emision: [{ token: 'T', escala: 'minuto', cantidad: 18 }], foco: 'g', t: T0 });
  const base = { autor: 'raiz', sobre: eje.genesisId, t: T0, payload: 'x' };
  await eje.escribir({ ...base, movimientos: [{ token: 'T', escala: 'minuto', cantidad: 6, de: 'raiz', a: null }] });
  await eje.escribir({ ...base, payload: 'y', movimientos: [{ token: 'T', escala: 'minuto', cantidad: 12, de: 'raiz', a: null }] });
  assert.equal(eje.saldoT('raiz', 'minuto'), 0);
});

test('el génesis emite a su autor; sus series de E y R quedan a su nombre; su autor es una persona', async () => {
  await assert.rejects(Eje.genesis({ demostracion: true, identidad: 'raiz', emision: [{ token: 'T', escala: 'hora', cantidad: 1 }, { token: 'E', denominacion: 'EUR', cantidad: 1, emisor: 'otra' }], foco: 'g', t: T0 }), /emisión de E va a su propio emisor/);
  await assert.rejects(Eje.genesis({ demostracion: true, identidad: 'raiz', tipo: 'cosa', emision: [{ token: 'T', escala: 'hora', cantidad: 1 }], foco: 'g', t: T0 }), /el génesis lo emite una persona: su autor no puede ser cosa/);
  // VG, 7-11 noche: «todos son emitidos por una persona individualmente»; un grupo ya no firma el génesis.
  await assert.rejects(Eje.genesis({ demostracion: true, identidad: 'raiz', tipo: 'grupo', emision: [{ token: 'T', escala: 'hora', cantidad: 1 }], foco: 'g', t: T0 }), /el génesis lo emite una persona: su autor no puede ser grupo/);
  const g = await Eje.genesis({ demostracion: true, identidad: 'raiz', tipo: 'persona', emision: [{ token: 'T', escala: 'hora', cantidad: 1 }, { token: 'R', cantidad: 3 }], foco: 'g', t: T0 });
  assert.equal(g.tipo('raiz'), 'persona');
  assert.deepEqual(g.serie('R:raiz'), { emisor: 'raiz', emitido: 3 });
  const eje = await ejeBase();
  const datos = JSON.parse(JSON.stringify(serializar(eje)));
  const gen = datos.eventos[0];
  delete gen.movimientos[1].emisor; // un génesis antiguo, sin emisor en E
  await assert.rejects(restaurar(datos), /E exige emisor/);
});
