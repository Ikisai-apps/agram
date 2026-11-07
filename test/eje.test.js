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
  assert.equal(eje.saldo('raiz', 'E:EUR'), 50);
  assert.deepEqual(eje.identidades(), ['raiz']);
  // Las series del génesis quedan a nombre de su autor.
  assert.deepEqual(eje.serie('EUR'), { emisor: 'raiz', emitido: 50 });
  assert.equal(g.movimientos[1].emisor, 'raiz');
  assert.deepEqual(eje.series().map((s) => s.clave + ' ' + s.emisor + ' ' + s.emitido), ['T:hora raiz 100', 'E:EUR raiz 50']);
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

test('E: una identidad emite una serie limitada de una denominación que ella respalda', async () => {
  const eje = await ejeBase();
  const g = eje.genesisId;
  const alta = await eje.escribir({ autor: 'raiz', sobre: g, t: T0, payload: 'altas',
    movimientos: [gastaT('raiz'), { token: 'T', escala: 'hora', cantidad: 5, de: 'raiz', a: 'casa' }, { token: 'T', escala: 'hora', cantidad: 5, de: 'raiz', a: 'bea' }] });
  // La casa emite un token por plaza y noche: dos camas el 13-11. La denominación es nueva y queda a su nombre.
  const plazas = await eje.escribir({ autor: 'casa', sobre: alta.id, t: T0, payload: 'plazas del 13-11',
    movimientos: [gastaT('casa'), { token: 'E', denominacion: 'cama@2026-11-13', cantidad: 2, de: null, a: 'casa', emisor: 'casa' }] });
  assert.equal(eje.emisores.get('cama@2026-11-13'), 'casa');
  assert.deepEqual(eje.serie('cama@2026-11-13'), { emisor: 'casa', emitido: 2 });
  assert.equal(eje.saldo('casa', 'E:cama@2026-11-13'), 2);
  assert.deepEqual(eje.recursos('casa'), [{ denominacion: 'cama@2026-11-13', cantidad: 2 }]);
  // Nadie emite una denominación ajena: ni bea las camas de la casa, ni la casa los EUR de raiz.
  await assert.rejects(eje.escribir({ autor: 'bea', sobre: plazas.id, t: T0, payload: 'x',
    movimientos: [gastaT('bea'), { token: 'E', denominacion: 'cama@2026-11-13', cantidad: 1, de: null, a: 'bea', emisor: 'bea' }] }), /denominación ajena: cama@2026-11-13 la emite casa/);
  await assert.rejects(eje.escribir({ autor: 'casa', sobre: plazas.id, t: T0, payload: 'x',
    movimientos: [gastaT('casa'), { token: 'E', denominacion: 'EUR', cantidad: 1, de: null, a: 'casa', emisor: 'casa' }] }), /denominación ajena: EUR la emite raiz/);
  // Ni en nombre de otro.
  await assert.rejects(eje.escribir({ autor: 'bea', sobre: plazas.id, t: T0, payload: 'x',
    movimientos: [gastaT('bea'), { token: 'E', denominacion: 'cama@2026-11-14', cantidad: 1, de: null, a: 'bea', emisor: 'casa' }] }), /nadie emite en nombre de otro: casa no es el autor/);
  // Solo el emisor amplía su serie, y puede emitir directamente a quien diga.
  await eje.escribir({ autor: 'casa', sobre: plazas.id, t: T0, payload: 'una cama más',
    movimientos: [gastaT('casa'), { token: 'E', denominacion: 'cama@2026-11-13', cantidad: 1, de: null, a: 'bea', emisor: 'casa' }] });
  assert.deepEqual(eje.serie('cama@2026-11-13'), { emisor: 'casa', emitido: 3 });
  assert.equal(eje.saldo('bea', 'E:cama@2026-11-13'), 1);
  // La serie es limitada: pasar más plazas de las que hay se rechaza.
  await eje.escribir({ autor: 'casa', sobre: plazas.id, t: T0, payload: 'reserva',
    movimientos: [gastaT('casa'), { token: 'E', denominacion: 'cama@2026-11-13', cantidad: 2, de: 'casa', a: 'bea' }] });
  await assert.rejects(eje.escribir({ autor: 'casa', sobre: plazas.id, t: T0, payload: 'reserva solapada',
    movimientos: [gastaT('casa'), { token: 'E', denominacion: 'cama@2026-11-13', cantidad: 1, de: 'casa', a: 'raiz' }] }), /saldo insuficiente de E:cama@2026-11-13 en casa/);
  // Las demás familias siguen sin emitirse fuera del génesis.
  await assert.rejects(eje.escribir({ autor: 'casa', sobre: plazas.id, t: T0, payload: 'x',
    movimientos: [gastaT('casa'), { token: 'R', cantidad: 1, emisor: 'casa', de: null, a: 'casa' }] }), /solo el génesis emite R/);
  assert.deepEqual(eje.serie('nadie'), { emisor: null, emitido: 0 });
  assert.deepEqual(eje.series().map((s) => s.clave), ['T:hora', 'E:EUR', 'E:cama@2026-11-13']);
  // Al restaurar, el registro de emisores se reconstruye desde los eventos.
  const otro = await restaurar(JSON.parse(JSON.stringify(serializar(eje))));
  assert.deepEqual(otro.serie('cama@2026-11-13'), { emisor: 'casa', emitido: 3 });
  assert.equal(otro.emisores.get('EUR'), 'raiz');
});

test('el génesis emite a su autor y sus series de E quedan a su nombre', async () => {
  await assert.rejects(Eje.genesis({ identidad: 'raiz', emision: [{ token: 'T', escala: 'hora', cantidad: 1 }, { token: 'E', denominacion: 'EUR', cantidad: 1, emisor: 'otra' }], foco: 'g', t: T0 }), /en el génesis emite su autor/);
  const eje = await ejeBase();
  const datos = JSON.parse(JSON.stringify(serializar(eje)));
  const g = datos.eventos[0];
  delete g.movimientos[1].emisor; // un génesis antiguo, sin emisor en E
  await assert.rejects(restaurar(datos), /emisión de E exige emisor/);
});
