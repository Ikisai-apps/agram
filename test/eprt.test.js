import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Eje } from '../src/eje.js';
import { consolidar, autorizar, puedeAutorizar } from '../src/motor.js';

const T0 = '2026-11-07T10:00:00Z';
const gastaT = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });

async function mundo() {
  const eje = await Eje.genesis({
    identidad: 'casa',
    emision: [
      { token: 'T', escala: 'hora', cantidad: 100 },
      { token: 'T', escala: 'minuto', cantidad: 100 }, // escribir cuesta minutos: otro token
      { token: 'P', cantidad: 5, ambito: 'genesis' },
      { token: 'R', cantidad: 20, emisor: 'casa' }, // la casa nace con reputación propia que puede repartir
    ],
    foco: 'Casa',
    t: T0,
  });
  const g = eje.genesisId;
  const alta = await eje.escribir({ autor: 'casa', sobre: g, t: T0, movimientos: [gastaT('casa'), { token: 'T', escala: 'minuto', cantidad: 20, de: 'casa', a: 'cocina' }, { token: 'T', escala: 'minuto', cantidad: 20, de: 'casa', a: 'sala' }], payload: ['altas', ['cocina', 'sala']] });
  const menu = await eje.escribir({ autor: 'cocina', sobre: alta.id, t: T0, movimientos: [gastaT('cocina')], payload: 'menú' });
  const evento = await eje.escribir({ autor: 'sala', sobre: alta.id, t: T0, movimientos: [gastaT('sala')], payload: 'boda' });
  return { eje, g, alta, menu, evento };
}

test('P con ámbito: el poder cubre el subárbol del registro, no el eje entero', async () => {
  const { eje, g, menu, evento } = await mundo();
  // La casa da a cocina poder sobre el menú (y lo que cuelgue de él), no sobre la boda.
  await eje.escribir({ autor: 'casa', sobre: g, t: T0, movimientos: [gastaT('casa'), { token: 'P', cantidad: 2, ambito: menu.id, de: 'casa', a: 'cocina' }], payload: 'poder de cocina' });
  assert.deepEqual(eje.poderes('cocina'), [{ ambito: menu.id, cantidad: 2 }]);
  const plato = await eje.escribir({ autor: 'cocina', sobre: menu.id, t: T0, movimientos: [gastaT('cocina')], payload: 'guiso' });
  assert.equal(eje.poderSobre('cocina', plato.id), 2);
  assert.equal(eje.poderSobre('cocina', evento.id), 0);
  assert.equal(eje.poderSobre('casa', evento.id), 3); // génesis cubre todo; delegó 2 de sus 5
  // Y no existe un P total: pedir P sin ámbito se rechaza.
  await assert.rejects(eje.escribir({ autor: 'casa', sobre: g, t: T0, movimientos: [gastaT('casa'), { token: 'P', cantidad: 1, de: 'casa', a: 'sala' }], payload: 'x' }), /ámbito/);
});

test('delegar poder estrecha el ámbito: se debita del ámbito que lo cubre; sin poder no se delega', async () => {
  const { eje, g, menu, alta } = await mundo();
  await eje.escribir({ autor: 'casa', sobre: g, t: T0, movimientos: [gastaT('casa'), { token: 'P', cantidad: 2, ambito: menu.id, de: 'casa', a: 'cocina' }], payload: 'delegación' });
  assert.equal(eje.saldo('casa', 'P:genesis'), 3); // 5 − 2: salió del ámbito amplio
  assert.deepEqual(eje.poderes('cocina'), [{ ambito: menu.id, cantidad: 2 }]);
  // Sala no tiene poder: no puede delegar.
  await assert.rejects(eje.escribir({ autor: 'sala', sobre: alta.id, t: T0, movimientos: [gastaT('sala'), { token: 'P', cantidad: 1, ambito: menu.id, de: 'sala', a: 'cocina' }], payload: 'x' }), /saldo insuficiente de P sobre/);
  // Cocina puede volver a delegar dentro de su ámbito (un plato del menú), no fuera.
  const plato = await eje.escribir({ autor: 'cocina', sobre: menu.id, t: T0, movimientos: [gastaT('cocina')], payload: 'guiso' });
  await eje.escribir({ autor: 'cocina', sobre: plato.id, t: T0, movimientos: [gastaT('cocina'), { token: 'P', cantidad: 1, ambito: plato.id, de: 'cocina', a: 'sala' }], payload: 'ayuda en el guiso' });
  assert.deepEqual(eje.poderes('sala'), [{ ambito: plato.id, cantidad: 1 }]);
  await assert.rejects(eje.escribir({ autor: 'cocina', sobre: alta.id, t: T0, movimientos: [gastaT('cocina'), { token: 'P', cantidad: 1, ambito: alta.id, de: 'cocina', a: 'sala' }], payload: 'x' }), /saldo insuficiente de P sobre/);
  // Un ámbito que no es un registro se rechaza.
  await assert.rejects(eje.escribir({ autor: 'casa', sobre: g, t: T0, movimientos: [gastaT('casa'), { token: 'P', cantidad: 1, ambito: 'nadie', de: 'casa', a: 'cocina' }], payload: 'x' }), /ámbito desconocido/);
});

test('R: por emisor y no fungible; quien la recibe no puede pasarla', async () => {
  const { eje, g, alta } = await mundo();
  assert.deepEqual(eje.reputaciones('casa'), [{ emisor: 'casa', cantidad: 20 }]);
  await eje.escribir({ autor: 'casa', sobre: alta.id, t: T0, movimientos: [gastaT('casa'), { token: 'R', cantidad: 3, emisor: 'casa', de: 'casa', a: 'cocina' }], payload: 'buen servicio' });
  assert.deepEqual(eje.reputaciones('cocina'), [{ emisor: 'casa', cantidad: 3 }]);
  assert.equal(eje.saldo('casa', 'R:casa'), 17);
  // Cocina no puede mover la reputación que le dio la casa.
  await assert.rejects(eje.escribir({ autor: 'cocina', sobre: alta.id, t: T0, movimientos: [gastaT('cocina'), { token: 'R', cantidad: 1, emisor: 'casa', de: 'cocina', a: 'sala' }], payload: 'x' }), /no es fungible/);
  // Ni inventar reputación ajena.
  await assert.rejects(eje.escribir({ autor: 'cocina', sobre: alta.id, t: T0, movimientos: [gastaT('cocina'), { token: 'R', cantidad: 1, emisor: 'cocina', de: 'cocina', a: 'sala' }], payload: 'x' }), /saldo insuficiente de R:cocina/);
  void g;
});

test('autoriza quien tiene poder sobre el registro de la consolidación', async () => {
  const { eje, g, menu, evento } = await mundo();
  await eje.escribir({ autor: 'casa', sobre: g, t: T0, movimientos: [gastaT('casa'), { token: 'P', cantidad: 2, ambito: menu.id, de: 'casa', a: 'cocina' }], payload: 'poder de cocina' });
  const cMenu = await consolidar(eje, { autor: 'sala', foco: menu.id, t: T0, elecciones: { 1: 'dos menús' } });
  const cBoda = await consolidar(eje, { autor: 'sala', foco: evento.id, t: T0, elecciones: { 1: 'catering' } });
  assert.equal(puedeAutorizar(eje, 'cocina', cMenu.id), true); // su poder cubre el menú y lo que cuelga de él
  assert.equal(puedeAutorizar(eje, 'cocina', cBoda.id), false); // la boda no está en su ámbito
  assert.equal(puedeAutorizar(eje, 'casa', cBoda.id), true); // el génesis cubre todo
  await assert.rejects(autorizar(eje, { autorizante: 'cocina', consolidacion: cBoda.id, t: T0 }), /no tiene poder \(P\) sobre este registro/);
  const a = await autorizar(eje, { autorizante: 'cocina', consolidacion: cMenu.id, t: T0 });
  assert.equal(a.autor, 'cocina');
});

test('P y R encajan en la constante: familia, clave de serie, quién la emite', async () => {
  const { eje } = await mundo();
  // P se emite por ámbito (el génesis, sobre todo el eje); R por emisor (la casa, la suya).
  assert.deepEqual(eje.series().map((s) => [s.token, s.serie, s.emisor, s.emitido]), [
    ['T', 'hora', 'casa', 100],
    ['T', 'minuto', 'casa', 100],
    ['P', 'genesis', 'casa', 5],
    ['R', 'casa', 'casa', 20],
  ]);
  assert.deepEqual(eje.poderes('casa'), [{ ambito: 'genesis', cantidad: 5 }]);
  assert.deepEqual(eje.reputaciones('casa'), [{ emisor: 'casa', cantidad: 20 }]);
  assert.deepEqual(eje.tiempos('cocina'), [{ escala: 'minuto', cantidad: 19 }]);
});
