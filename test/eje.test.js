import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Eje } from '../src/eje.js';
import { crearEvento } from '../src/evento.js';
import { serializar, restaurar } from '../src/persistencia.js';
import { colateral } from '../src/lente.js';

const T0 = '2026-11-06T20:00:00Z';

async function ejeBase(t = T0) {
  return Eje.genesis({
    demostracion: true,
    identidad: 'raiz',
    emision: [
      { token: 'E', denominacion: 'EUR', cantidad: 50 },
      // T no cruza de persona (VG, 7-11 noche): el tiempo que la raíz cede a otros es E de su serie, en horas.
      { token: 'E', denominacion: 'hora', cantidad: 100 },
    ],
    foco: 'mundo de prueba',
    t,
  });
}

/** Un mes antes de T0 (ya no hace falta: cada persona escribe con su asignación de T del día (VG, 8-11)). */
const ALTA = '2026-10-06T20:00:00Z';

const gastaT = (de, cantidad = 1) => ({ token: 'T', escala: 'hora', cantidad, de, a: null });

test('génesis: emite a la primera identidad y fija el foco raíz', async () => {
  const eje = await ejeBase();
  const g = eje.obtener(eje.genesisId);
  assert.equal(g.sobre, null);
  assert.equal(g.contexto.genesis, true);
  assert.equal(g.payload, 'mundo de prueba');
  // El génesis no emite T (VG, 8-11: no hay T acumulable): su autor, una persona, vive de su asignación del día.
  assert.equal(eje.saldoT('raiz', 'hora'), 24);
  assert.equal(eje.saldo('raiz', 'T:hora'), 0);
  assert.equal(eje.saldo('raiz', 'E:raiz/EUR'), 50);
  assert.deepEqual(eje.identidades(), ['raiz']);
  // Las series del génesis quedan a nombre de su autor; la de E lleva su emisor en la clave.
  assert.deepEqual(eje.serie('E:raiz/EUR'), { emisor: 'raiz', emitido: 50 });
  assert.equal(g.movimientos[0].emisor, 'raiz');
  assert.deepEqual(eje.series().map((s) => s.clave + ' ' + s.emisor + ' ' + s.emitido), ['E:raiz/EUR raiz 50', 'E:raiz/hora raiz 100']);
});

test('escribir sobre el foco mueve tokens y crea identidades al recibir', async () => {
  const eje = await ejeBase();
  const ev = await eje.escribir({
    autor: 'raiz',
    sobre: eje.genesisId,
    t: T0,
    movimientos: [gastaT('raiz'), { token: 'E', emisor: 'raiz', denominacion: 'hora', cantidad: 10, de: 'raiz', a: 'cocina' }],
    payload: ['alta de cocina'],
  });
  // T no cruza de persona (VG, 7-11 noche): la raíz cede diez horas de su tiempo como E:raiz/hora; su T solo se consume.
  assert.equal(eje.saldoT('raiz', 'hora'), 23);
  assert.equal(eje.saldo('cocina', 'E:raiz/hora'), 10);
  assert.deepEqual([eje.saldoT('cocina', 'hora'), eje.saldoT('cocina', 'minuto')], [0, 0]);
  // El consumo queda anotado en el registro que soporta el escrito: aquí, el génesis.
  assert.deepEqual(eje.tiempoSobre(eje.genesisId), { hora: 1 });
  // La cocina es una cosa (B1: su alta la escribió la raíz): la raíz, una persona, sí le da T. A una persona, no.
  assert.equal(eje.esPersona('cocina'), false);
  await eje.entrar({ identidad: 'bea', t: T0 });
  await assert.rejects(eje.escribir({ autor: 'raiz', sobre: eje.genesisId, t: T0, movimientos: [gastaT('raiz'), { token: 'T', escala: 'hora', cantidad: 10, de: 'raiz', a: 'bea' }], payload: 'x' }), /T only goes to things/);
  await eje.escribir({ autor: 'raiz', sobre: eje.genesisId, t: T0, movimientos: [gastaT('raiz'), { token: 'T', escala: 'hora', cantidad: 10, de: 'raiz', a: 'cocina' }], payload: 'x' });
  assert.deepEqual(eje.identidades(), ['raiz', 'cocina', 'bea']);
  assert.deepEqual(eje.hilo(ev.id).map((e) => e.id), [ev.id, eje.genesisId]);
  assert.equal(eje.sobre(eje.genesisId).length, 3);
});

test('rechazos: foco desconocido, emisión, saldo, duplicado; quien no tiene cuenta escribe su propia alta (B1)', async () => {
  const eje = await ejeBase();
  const base = { autor: 'raiz', sobre: eje.genesisId, t: T0, payload: 'x' };
  await assert.rejects(eje.escribir({ ...base, sobre: 'nadie', movimientos: [gastaT('raiz')] }), /every record hangs on a record of the ledger/);
  // VG, 10-11, B1: quien aún no tiene cuenta y escribe, escribe su propia alta: es una persona (en una demostración, sin clave).
  await eje.escribir({ ...base, autor: 'bea', movimientos: [gastaT('bea')] });
  assert.equal(eje.esPersona('bea'), true);
  // VG, 8-11: no hay T acumulable; nadie emite T, ni el génesis.
  await assert.rejects(
    eje.escribir({ ...base, movimientos: [gastaT('raiz'), { token: 'T', escala: 'hora', cantidad: 1, de: null, a: 'raiz' }] }),
    /nobody mints T/,
  );
  await assert.rejects(eje.escribir({ ...base, movimientos: [gastaT('raiz'), { token: 'E', emisor: 'raiz', denominacion: 'EUR', cantidad: 1000, de: 'raiz', a: null }] }), /saldo insuficiente/);
  await assert.rejects(eje.escribir({ ...base, movimientos: [gastaT('raiz')] }).then(() => eje.escribir({ ...base, movimientos: [gastaT('raiz')] })), /ya registrado/);
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
    emision: [],
    foco: 'g',
    t: T0,
  });
  const base = { autor: 'raiz', sobre: eje.genesisId, t: T0, payload: 'x' };
  // Cada escala, su asignación del día (VG, 8-11): las horas no pagan minutos ni días.
  await assert.rejects(eje.escribir({ ...base, movimientos: [{ token: 'T', escala: 'dia', cantidad: 2, de: 'raiz', a: null }] }), /writing burns today's T/);
  assert.deepEqual([eje.saldoT('raiz', 'minuto'), eje.saldoT('raiz', 'hora')], [1440, 24]);
  // Cualquier escala vale para el evento mínimo.
  await eje.escribir({ ...base, movimientos: [{ token: 'T', escala: 'dia', cantidad: 1, de: 'raiz', a: null }] });
  assert.equal(eje.saldoT('raiz', 'dia'), 0);
  assert.equal(eje.saldoT('raiz', 'hora'), 24);
  assert.deepEqual(eje.tiempos('raiz'), []); // sin T explícito: ningún T se acumula (VG, 8-11)
  assert.deepEqual(eje.tiempoSobre(eje.genesisId), { dia: 1 });
  assert.throws(() => eje.saldoT('raiz', 'mes'), /escala T inválida/);
  assert.throws(() => eje.saldoT('raiz'), /escala T inválida/);
});

// Altas: la casa y bea escriben la suya y son personas; a la habitación la da de alta la raíz y es una cosa (VG, 10-11,
// B1: no hay tipo; no hay identidades de grupo: VG, 8-11). VG, 7-11 noche: solo emiten personas, así que la casa que
// emite plazas es una persona (antes, un grupo).
async function conAltas() {
  const eje = await ejeBase(ALTA);
  for (const id of ['casa', 'bea']) await eje.entrar({ identidad: id, t: ALTA });
  const alta = await eje.escribir({ autor: 'raiz', sobre: eje.genesisId, t: ALTA, payload: 'altas',
    movimientos: [gastaT('raiz'), ...['casa', 'bea', 'habitacion-2'].map((a) => ({ token: 'E', emisor: 'raiz', denominacion: 'hora', cantidad: 20, de: 'raiz', a }))] });
  return { eje, alta };
}

const emite = (emisor, denominacion, cantidad) => ({ token: 'E', emisor, denominacion, cantidad, de: null, a: emisor });
const mueveE = (emisor, denominacion, cantidad, de, a) => ({ token: 'E', emisor, denominacion, cantidad, de, a });
/** Da uno de su R a otra. La R propia en juego (VG, 7-11 noche: la exigen P y E) es el colateral que bloquea al emitirla (R6, escalonE). */
const enJuego = (persona, a = 'raiz') => ({ token: 'R', emisor: persona, cantidad: 1, de: persona, a });

/**
 * VG, 7-11 noche: E es el último escalón (T + R + P). Prepara a una persona
 * para emitir E: emite su R (T + R), escribe su dominio y emite P sobre él
 * poniendo su R en juego (T + R + P). Devuelve el dominio, sobre el que ya
 * puede emitir E.
 */
async function escalonE(eje, persona) {
  const r = await eje.escribir({ autor: persona, sobre: eje.genesisId, t: T0, payload: 'reputación de ' + persona,
    movimientos: [gastaT(persona), { token: 'R', cantidad: 10, emisor: persona, de: null, a: persona }, colateral(persona, 1)] });
  const dominio = await eje.escribir({ autor: persona, sobre: r.id, t: T0, payload: 'dominio de ' + persona, movimientos: [gastaT(persona)] });
  await eje.escribir({ autor: persona, sobre: dominio.id, t: T0, payload: 'poder sobre mi dominio',
    movimientos: [gastaT(persona), enJuego(persona), { token: 'P', ambito: dominio.id, cantidad: 1, de: null, a: persona }] });
  return dominio;
}

test('E: una persona emite una serie limitada que respalda, a sí misma, y solo ella la amplía', async () => {
  const { eje } = await conAltas();
  assert.equal(eje.esPersona('casa'), true);
  assert.equal(eje.esPersona('raiz'), true); // el autor del génesis escribe su propia alta: es una persona (B1)
  assert.equal(eje.esPersona('habitacion-2'), false); // su alta la escribió la raíz: es una cosa
  const dominio = await escalonE(eje, 'casa');
  // La casa emite un token por plaza y noche: dos camas el 13-11. La serie es suya: E:casa/cama@2026-11-13.
  const plazas = await eje.escribir({ autor: 'casa', sobre: dominio.id, t: T0, payload: 'plazas del 13-11',
    movimientos: [gastaT('casa'), enJuego('casa'), emite('casa', 'cama@2026-11-13', 2)] });
  assert.deepEqual(eje.serie('E:casa/cama@2026-11-13'), { emisor: 'casa', emitido: 2 });
  assert.equal(eje.saldo('casa', 'E:casa/cama@2026-11-13'), 2);
  // Con las horas que la raíz le cedió en su alta (E:raiz/hora; T no cruza de persona, VG 7-11 noche).
  assert.deepEqual(eje.recursos('casa'), [{ emisor: 'raiz', denominacion: 'hora', cantidad: 20 }, { emisor: 'casa', denominacion: 'cama@2026-11-13', cantidad: 2 }]);
  // Nadie emite en nombre de otro, ni a otro: la serie nace en la cartera de su emisor.
  await assert.rejects(eje.escribir({ autor: 'bea', sobre: plazas.id, t: T0, payload: 'x',
    movimientos: [gastaT('bea'), emite('casa', 'cama@2026-11-13', 1)] }), /(E is minted by and to|R is minted by) its issuer/);
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
  assert.deepEqual(eje.series().map((s) => s.clave), ['E:raiz/EUR', 'E:raiz/hora', 'T:minuto', 'T:hora', 'R:casa', 'P:' + dominio.id, 'E:casa/cama@2026-11-13']);
  // Al restaurar, las series y quién es persona o cosa se reconstruyen desde los eventos.
  const otro = await restaurar(JSON.parse(JSON.stringify(serializar(eje))));
  assert.deepEqual(otro.serie('E:casa/cama@2026-11-13'), { emisor: 'casa', emitido: 3 });
  assert.deepEqual(otro.series(), eje.series());
  assert.equal(otro.esPersona('habitacion-2'), false);
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
  assert.deepEqual(eje.recursos('casa').map((r) => r.emisor + '/' + r.denominacion + ' ' + r.cantidad), ['raiz/hora 20', 'casa/cama@2026-11-14 2', 'casa/EUR 1000000000']);
});

test('emitir es solo de personas (VG, 7-11 noche); las cosas reciben, conservan y mueven tokens', async () => {
  const { eje } = await conAltas();
  const dominio = await escalonE(eje, 'casa');
  // La casa emite las plazas de la habitación y se las da en el mismo evento, con dos horas de su T del día para que
  // la habitación (una cosa) escriba: T no cruza de persona, pero una persona sí lo da a una cosa (Core, 8-11).
  const plazas = await eje.escribir({ autor: 'casa', sobre: dominio.id, t: T0, payload: 'plazas de la habitación 2',
    movimientos: [gastaT('casa'), enJuego('casa'), emite('casa', 'plaza@2026-11-13', 2), mueveE('casa', 'plaza@2026-11-13', 2, 'casa', 'habitacion-2'),
      { token: 'T', escala: 'hora', cantidad: 2, de: 'casa', a: 'habitacion-2' }] });
  assert.equal(eje.saldo('habitacion-2', 'E:casa/plaza@2026-11-13'), 2);
  // La habitación las maneja: cede una a bea.
  await eje.escribir({ autor: 'habitacion-2', sobre: plazas.id, t: T0, payload: 'reserva de bea',
    movimientos: [gastaT('habitacion-2'), mueveE('casa', 'plaza@2026-11-13', 1, 'habitacion-2', 'bea')] });
  assert.equal(eje.saldo('bea', 'E:casa/plaza@2026-11-13'), 1);
  // Pero no emite: ni E ni R.
  await assert.rejects(eje.escribir({ autor: 'habitacion-2', sobre: plazas.id, t: T0, payload: 'x',
    movimientos: [gastaT('habitacion-2'), emite('habitacion-2', 'plaza@2026-11-13', 1)] }), /only persons mint: habitacion-2 is a thing \(its alta was written by raiz\)/);
  await assert.rejects(eje.escribir({ autor: 'habitacion-2', sobre: plazas.id, t: T0, payload: 'x',
    movimientos: [gastaT('habitacion-2'), { token: 'R', cantidad: 1, emisor: 'habitacion-2', de: null, a: 'habitacion-2' }] }), /only persons mint/);
  // VG, 8-11: cada persona emite a su nombre; nadie emite en el de otro (no hay grupos a cuyo nombre emitir).
  await assert.rejects(eje.escribir({ autor: 'casa', sobre: plazas.id, t: T0, payload: 'x',
    movimientos: [gastaT('casa'), { token: 'R', cantidad: 1, emisor: 'bea', de: null, a: 'bea' }] }), /(E is minted by and to|R is minted by) its issuer/);
  // No hay tipo (VG, 10-11, B1): un alta no declara persona, cosa ni grupo; lo dice quién la escribe. Un grupo es un
  // registro; su autor emite P sobre él y lo delega (VG, 8-11).
  const base = { autor: 'raiz', sobre: eje.genesisId, t: T0, payload: 'x' };
  for (const tipo of ['cosa', 'grupo', 'persona', 'robot']) {
    await assert.rejects(eje.escribir({ ...base, contexto: { tipos: { dani: tipo } }, movimientos: [gastaT('raiz'), { token: 'E', emisor: 'raiz', denominacion: 'hora', cantidad: 1, de: 'raiz', a: 'dani' }] }), /no hay tipo en el alta/);
  }
});

test('R: su emisor la declara y la amplía fuera del génesis, con rastro visible; nadie más', async () => {
  const { eje, alta } = await conAltas();
  const r = await eje.escribir({ autor: 'casa', sobre: alta.id, t: T0, payload: 'reputación de la casa',
    movimientos: [gastaT('casa'), { token: 'R', cantidad: 10, emisor: 'casa', de: null, a: 'casa' }, colateral('casa', 1)] });
  await eje.escribir({ autor: 'casa', sobre: r.id, t: T0, payload: 'buen trato',
    movimientos: [gastaT('casa'), { token: 'R', cantidad: 5, emisor: 'casa', de: null, a: 'casa' }, colateral('casa', 0.5), { token: 'R', cantidad: 2, emisor: 'casa', de: 'casa', a: 'bea' }] });
  assert.deepEqual(eje.serie('R:casa'), { emisor: 'casa', emitido: 15 });
  assert.deepEqual(eje.reputaciones('bea'), [{ emisor: 'casa', cantidad: 2 }]);
  // El rastro: cada ampliación es un evento del eje, de su emisor.
  const ampliaciones = eje.orden.map((id) => eje.obtener(id)).filter((e) => e.movimientos.some((m) => m.token === 'R' && m.de === null));
  assert.deepEqual(ampliaciones.map((e) => e.autor + ' ' + e.movimientos.find((m) => m.token === 'R' && m.de === null).cantidad), ['casa 10', 'casa 5']);
  // Nadie amplía la reputación de otro.
  await assert.rejects(eje.escribir({ autor: 'bea', sobre: r.id, t: T0, payload: 'x',
    movimientos: [gastaT('bea'), { token: 'R', cantidad: 1, emisor: 'casa', de: null, a: 'casa' }] }), /emisión de R va a su propio emisor|R is minted by its issuer/);
});

test('una serie limitada no llega a infinito', async () => {
  const { eje } = await conAltas();
  const dominio = await escalonE(eje, 'bea');
  const base = { autor: 'bea', sobre: dominio.id, t: T0, payload: 'x' };
  await assert.rejects(eje.escribir({ ...base, movimientos: [gastaT('bea'), enJuego('bea'), emite('bea', 'BTC', 1.7e308), emite('bea', 'BTC', 1.7e308)] }), /la serie E:bea\/BTC no admite tanto/);
  await eje.escribir({ ...base, movimientos: [gastaT('bea'), enJuego('bea'), emite('bea', 'BTC', 1.7e308)] });
  await assert.rejects(eje.escribir({ ...base, movimientos: [gastaT('bea'), enJuego('bea'), emite('bea', 'BTC', 1.7e308)] }), /no admite tanto/);
  assert.equal(eje.serie('E:bea/BTC').emitido, 1.7e308);
  await assert.rejects(Eje.genesis({ demostracion: true, identidad: 'raiz', emision: [{ token: 'E', denominacion: 'X', cantidad: 1.7e308 }, { token: 'E', denominacion: 'X', cantidad: 1.7e308 }], foco: 'g', t: T0 }), /no admite tanto/);
});

test('T en enteros: sin fracciones no hay error de coma flotante', async () => {
  const eje = await Eje.genesis({ demostracion: true, identidad: 'raiz', emision: [], foco: 'g', t: T0 });
  const base = { autor: 'raiz', sobre: eje.genesisId, t: T0, payload: 'x' };
  await assert.rejects(eje.escribir({ ...base, movimientos: [{ token: 'T', escala: 'hora', cantidad: 0.3, de: 'raiz', a: null }] }), /T va en enteros/);
  await eje.escribir({ ...base, movimientos: [{ token: 'T', escala: 'minuto', cantidad: 6, de: 'raiz', a: null }] });
  await eje.escribir({ ...base, payload: 'y', movimientos: [{ token: 'T', escala: 'minuto', cantidad: 12, de: 'raiz', a: null }] });
  assert.equal(eje.saldoT('raiz', 'minuto'), 1440 - 18);
});

test('el génesis emite a su autor; sus series de E y R quedan a su nombre; su autor es una persona', async () => {
  await assert.rejects(Eje.genesis({ demostracion: true, identidad: 'raiz', emision: [{ token: 'E', denominacion: 'EUR', cantidad: 1, emisor: 'otra' }], foco: 'g', t: T0 }), /emisión de E va a su propio emisor/);
  // VG, 10-11, B1: no hay tipo; el autor del génesis escribe su propia alta y es una persona.
  await assert.rejects(Eje.genesis({ demostracion: true, identidad: 'raiz', tipo: 'cosa', emision: [], foco: 'g', t: T0 }), /no hay tipo/);
  const g = await Eje.genesis({ demostracion: true, identidad: 'raiz', emision: [{ token: 'R', cantidad: 3 }], foco: 'g', t: T0 });
  assert.equal(g.esPersona('raiz'), true);
  assert.deepEqual(g.serie('R:raiz'), { emisor: 'raiz', emitido: 3 });
  const eje = await ejeBase();
  const datos = JSON.parse(JSON.stringify(serializar(eje)));
  const gen = datos.eventos[0];
  delete gen.movimientos[1].emisor; // un génesis antiguo, sin emisor en E
  await assert.rejects(restaurar(datos), /E exige emisor/);
});
