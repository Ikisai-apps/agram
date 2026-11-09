import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Eje } from '../src/eje.js';
import { consolidar, autorizar, puedeAutorizar, recursoDe, estadoDe } from '../src/motor.js';

const T0 = '2026-11-07T10:00:00Z';
const gastaT = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });

async function mundo() {
  const eje = await Eje.genesis({
    demostracion: true,
    identidad: 'casa',
    // da T a sus cosas, la cocina y la sala (Core, 8-11: T no cruza de persona, pero una persona sí lo da a una cosa)
    emision: [
      { token: 'P', cantidad: 5, ambito: 'genesis' },
      { token: 'R', cantidad: 20, emisor: 'casa' }, // la casa nace con reputación propia que puede repartir
    ],
    foco: 'Casa',
    t: T0,
  });
  const g = eje.genesisId;
  const alta = await eje.escribir({ autor: 'casa', sobre: g, t: T0, movimientos: [gastaT('casa'), { token: 'T', escala: 'minuto', cantidad: 20, de: 'casa', a: 'cocina' }, { token: 'T', escala: 'minuto', cantidad: 20, de: 'casa', a: 'sala' }], payload: ['altas', ['cocina', 'sala']] }); // dos cosas: su alta la escribe la casa (B1)
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

// VG, 7-11 noche: autorizar = bloquear P sobre el registro del recurso, con el umbral del dueño. Antes autorizaba
// cualquier P que cubriera el registro de la consolidación. VG, 8-11: el registro del recurso es el más cercano del
// hilo con P propio emitido; si no hay ninguno, el génesis.
test('autoriza el P sobre el registro del recurso: el más cercano con P propio emitido, o el del eje si no hay ninguno', async () => {
  const { eje, g, alta, menu, evento } = await mundo();
  await eje.escribir({ autor: 'casa', sobre: g, t: T0, movimientos: [gastaT('casa'), { token: 'P', cantidad: 2, ambito: menu.id, de: 'casa', a: 'cocina' }], payload: 'poder de cocina' });
  const cMenu = await consolidar(eje, { autor: 'sala', foco: menu.id, t: T0, elecciones: { 1: 'dos menús' } });
  const cBoda = await consolidar(eje, { autor: 'sala', foco: evento.id, t: T0, elecciones: { 1: 'catering' } });
  // Las dos cuelgan de las altas de la casa, y nadie en su hilo tiene P propio emitido (el de cocina sobre el menú es
  // estrechado, no emitido): manda el génesis, con el P sobre todo el eje.
  assert.deepEqual([recursoDe(eje, cMenu.id), recursoDe(eje, cBoda.id)], [g, g]);
  void alta;
  assert.equal(puedeAutorizar(eje, 'cocina', cMenu.id), false); // su P estrechado al menú no es el del recurso
  assert.equal(puedeAutorizar(eje, 'casa', cBoda.id), true); // el del eje, sí
  await assert.rejects(autorizar(eje, { autorizante: 'cocina', consolidacion: cMenu.id, t: T0 }), /cocina no tiene P que cuente para autorizar: cuenta el P sobre el registro del recurso .*, que no tiene P propio emitido: el P sobre todo el eje/);
  // A la casa le quedan 3 de los 5 P:genesis: más de la mitad.
  const a = await autorizar(eje, { autorizante: 'casa', consolidacion: cMenu.id, t: T0 });
  assert.deepEqual([a.autor, a.contexto.autoridad.bloquea], ['casa', [{ clave: 'P:genesis', cantidad: 3 }]]);
  assert.equal(estadoDe(eje, cMenu.id), 'AUTORIZADO');
  // Bloqueado por el menú, no le queda P para la boda hasta que lo libere.
  assert.equal(puedeAutorizar(eje, 'casa', cBoda.id), false);
});

test('P por delegación desde un registro de dominio (VG, 7-11): la casa delega, recepción autoriza lo que cuelga y delega hacia abajo', async () => {
  const { eje, g, alta } = await mundo();
  const dominio = await eje.escribir({ autor: 'casa', sobre: g, t: T0, movimientos: [gastaT('casa')], payload: 'Alojamiento' });
  await eje.escribir({ autor: 'casa', sobre: dominio.id, t: T0, payload: 'recepción',
    // la recepción, una cosa de la casa (B1: su alta la escribe la casa): escribe con el T que le da
    movimientos: [gastaT('casa'), { token: 'T', escala: 'minuto', cantidad: 10, de: 'casa', a: 'recepcion' }, { token: 'P', cantidad: 2, ambito: dominio.id, de: 'casa', a: 'recepcion' }] });
  const reserva = await eje.escribir({ autor: 'sala', sobre: dominio.id, t: T0, movimientos: [gastaT('sala')], payload: 'reserva' });
  assert.equal(eje.poderSobre('recepcion', reserva.id), 2); // autoriza lo que cuelga del dominio
  assert.equal(eje.poderSobre('recepcion', alta.id), 0); // y nada fuera
  await eje.escribir({ autor: 'recepcion', sobre: reserva.id, t: T0, payload: 'turno de noche',
    movimientos: [gastaT('recepcion'), { token: 'P', cantidad: 1, ambito: reserva.id, de: 'recepcion', a: 'sala' }] });
  assert.deepEqual(eje.poderes('sala'), [{ ambito: reserva.id, cantidad: 1 }]);
  // VG, 7-11 noche: P ya se emite fuera del génesis, pero solo una persona, sobre un registro suyo y con su R en juego.
  // La casa no pone R en juego: no lo emite (antes: «solo el génesis emite P»).
  await assert.rejects(eje.escribir({ autor: 'casa', sobre: dominio.id, t: T0, payload: 'x',
    movimientos: [gastaT('casa'), { token: 'P', cantidad: 1, ambito: dominio.id, de: null, a: 'casa' }] }), /emitir P exige R propia en juego/);
});

test('P y R encajan en la constante: familia, clave de serie, quién la emite', async () => {
  const { eje } = await mundo();
  // P se emite por ámbito (el génesis, sobre todo el eje); R por emisor (la casa, la suya). T no se emite (VG, 8-11:
  // no hay T acumulable): su serie aparece al gastarse, con emitido 0.
  assert.deepEqual(eje.series().map((s) => [s.token, s.serie, s.emisor, s.emitido]), [
    ['P', 'genesis', 'casa', 5],
    ['R', 'casa', 'casa', 20],
    ['T', 'minuto', 'casa', 0],
  ]);
  assert.deepEqual(eje.poderes('casa'), [{ ambito: 'genesis', cantidad: 5 }]);
  assert.deepEqual(eje.reputaciones('casa'), [{ emisor: 'casa', cantidad: 20 }]);
  assert.deepEqual(eje.tiempos('cocina'), [{ escala: 'minuto', cantidad: 19 }]);
});
