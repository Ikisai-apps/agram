import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Eje } from '../src/eje.js';
import { recuento, peso } from '../src/motor.js';

const T0 = '2026-11-07T10:00:00Z';
const gastaT = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });

async function mundo() {
  const eje = await Eje.genesis({
    demostracion: true,
    identidad: 'casa',
    // Encargo 3b: el génesis no mueve nada; la casa emite su R después (VG, 8-11, mapa §15: P no se emite a mano).
    emision: [
      { token: 'R', cantidad: 20, emisor: 'casa' }, // la casa nace con reputación propia que puede repartir
    ],
    foco: 'Casa',
    t: T0,
  });
  const g = eje.genesisId;
  // da T a sus cosas, la cocina y la sala (Core, 8-11: T no cruza de persona, pero una persona sí lo da a una cosa)
  const alta = await eje.escribir({ autor: 'casa', sobre: g, t: T0, movimientos: [gastaT('casa'), { token: 'T', escala: 'minuto', cantidad: 20, de: 'casa', a: 'cocina' }, { token: 'T', escala: 'minuto', cantidad: 20, de: 'casa', a: 'sala' }], payload: ['altas', ['cocina', 'sala']] }); // dos cosas: su alta la escribe la casa (B1)
  const menu = await eje.escribir({ autor: 'cocina', sobre: alta.id, t: T0, movimientos: [gastaT('cocina')], payload: 'menú' });
  const evento = await eje.escribir({ autor: 'sala', sobre: alta.id, t: T0, movimientos: [gastaT('sala')], payload: 'boda' });
  return { eje, g, alta, menu, evento };
}

// VG, 8-11 (mapa §15 [D] «P como peso de criterio»): P son unidades acuñadas y posicionadas en registros; escribir un
// registro propio da diez (N1). El P de un registro es criterio sobre él: ya no cubre lo que cuelga de él ni hay P del
// génesis sobre todo el eje.
test('P posicionado: quien escribe un registro obtiene diez P sobre él; no cubre lo de debajo ni lo de al lado', async () => {
  const { eje, menu, evento, alta } = await mundo();
  assert.equal(eje.poderSobre('cocina', menu.id), 10);
  assert.equal(eje.poderSobre('casa', alta.id), 10);
  const plato = await eje.escribir({ autor: 'cocina', sobre: menu.id, t: T0, movimientos: [gastaT('cocina')], payload: 'guiso' });
  assert.equal(eje.poderSobre('cocina', plato.id), 10); // el del plato, por escribirlo; no el del menú
  assert.equal(eje.poderSobre('cocina', evento.id), 0);
  assert.equal(eje.poderSobre('casa', menu.id), 0); // la casa no escribió el menú
  // Y no existe un P total: pedir P sin ámbito se rechaza.
  await assert.rejects(eje.escribir({ autor: 'casa', sobre: alta.id, t: T0, movimientos: [gastaT('casa'), { token: 'P', cantidad: 1, de: 'casa', a: 'sala' }], payload: 'x' }), /ámbito/);
});

test('dar P es transferir el que se tiene en ese registro; sin P no se da; el ámbito es un registro del libro', async () => {
  const { eje, menu, alta } = await mundo();
  await eje.escribir({ autor: 'casa', sobre: alta.id, t: T0, movimientos: [gastaT('casa'), { token: 'P', cantidad: 2, ambito: alta.id, de: 'casa', a: 'cocina' }], payload: 'delegación' });
  assert.equal(eje.saldo('casa', 'P:' + alta.id + '/casa'), 8); // 10 − 2, del mismo registro
  assert.equal(eje.saldo('cocina', 'P:' + alta.id + '/casa'), 2); // de origen casa: delegar no cambia el origen (encargo 3b-bis)
  // Sala no tiene P sobre el menú: no lo da.
  await assert.rejects(eje.escribir({ autor: 'sala', sobre: alta.id, t: T0, movimientos: [gastaT('sala'), { token: 'P', cantidad: 1, ambito: menu.id, de: 'sala', a: 'cocina' }], payload: 'x' }), /saldo insuficiente de P sobre/);
  // Un ámbito que no es un registro se rechaza, y «genesis» ya no es un ámbito (mapa §15: se retira el P del génesis).
  await assert.rejects(eje.escribir({ autor: 'casa', sobre: alta.id, t: T0, movimientos: [gastaT('casa'), { token: 'P', cantidad: 1, ambito: 'nadie', de: 'casa', a: 'cocina' }], payload: 'x' }), /P moves within a known scope/);
  await assert.rejects(eje.escribir({ autor: 'casa', sobre: alta.id, t: T0, movimientos: [gastaT('casa'), { token: 'P', cantidad: 1, ambito: 'genesis', de: 'casa', a: 'cocina' }], payload: 'x' }), /P moves within a known scope/);
});

// VG, 8-11 (mapa §15 [D] (2) y N7): reposicionar por el árbol, solo subiendo y bajando; subir deja una décima, bajar
// añade una décima (10 → 1 → 1,1). Nadie acuña P a mano.
test('reposicionar: subir al padre deja una décima, bajar a un hijo añade una décima; a mano no se acuña', async () => {
  const { eje, alta, menu } = await mundo();
  // Reposiciona una persona (la casa). Una cosa no puede: «only persons mint» también para en la reposición (ver el informe del 3b).
  const seccion = await eje.escribir({ autor: 'casa', sobre: alta.id, t: T0, movimientos: [gastaT('casa')], payload: 'sección' });
  await eje.escribir({ autor: 'casa', sobre: alta.id, t: T0, payload: 'sube', movimientos: [gastaT('casa'), { token: 'P', ambito: seccion.id, cantidad: 10, de: 'casa', a: null }, { token: 'P', ambito: alta.id, cantidad: 1, de: null, a: 'casa' }] });
  assert.deepEqual([eje.poderSobre('casa', seccion.id), eje.poderSobre('casa', alta.id)], [0, 11]);
  await eje.escribir({ autor: 'casa', sobre: alta.id, t: T0, payload: 'baja', movimientos: [gastaT('casa'), { token: 'P', ambito: alta.id, cantidad: 1, de: 'casa', a: null }, { token: 'P', ambito: seccion.id, cantidad: 1.1, de: null, a: 'casa' }] });
  assert.deepEqual([eje.poderSobre('casa', seccion.id), eje.poderSobre('casa', alta.id)], [1.1, 10]);
  const repos = /P is repositioned one step at a time/;
  // Con otro factor, a un registro que no es padre ni hijo, o sin quemar nada: no.
  await assert.rejects(eje.escribir({ autor: 'casa', sobre: alta.id, t: T0, payload: 'x', movimientos: [gastaT('casa'), { token: 'P', ambito: alta.id, cantidad: 1, de: 'casa', a: null }, { token: 'P', ambito: seccion.id, cantidad: 2, de: null, a: 'casa' }] }), repos);
  await assert.rejects(eje.escribir({ autor: 'casa', sobre: alta.id, t: T0, payload: 'x', movimientos: [gastaT('casa'), { token: 'P', ambito: seccion.id, cantidad: 1, de: 'casa', a: null }, { token: 'P', ambito: menu.id, cantidad: 1.1, de: null, a: 'casa' }] }), repos);
  await assert.rejects(eje.escribir({ autor: 'casa', sobre: alta.id, t: T0, payload: 'x', movimientos: [gastaT('casa'), { token: 'P', ambito: alta.id, cantidad: 1, de: null, a: 'casa' }] }), repos);
});

// VG, 9-11 (mapa §15 [D] «R según el corpus»): R se transfiere libremente entre tenedores sin cambiar de emisor (se
// corrige la #62) y el tenedor puede perdonarla quemándola («R, últimas dos»); nadie la acuña por otro.
test('R: por emisor, transferible entre tenedores y quemable por quien la tiene; nadie la inventa', async () => {
  const { eje, alta } = await mundo();
  assert.deepEqual(eje.reputaciones('casa'), [{ emisor: 'casa', cantidad: 20 }]);
  await eje.escribir({ autor: 'casa', sobre: alta.id, t: T0, movimientos: [gastaT('casa'), { token: 'R', cantidad: 3, emisor: 'casa', de: 'casa', a: 'cocina' }], payload: 'buen servicio' });
  assert.deepEqual(eje.reputaciones('cocina'), [{ emisor: 'casa', cantidad: 3 }]);
  assert.equal(eje.saldo('casa', 'R:casa'), 17);
  await eje.escribir({ autor: 'cocina', sobre: alta.id, t: T0, movimientos: [gastaT('cocina'), { token: 'R', cantidad: 1, emisor: 'casa', de: 'cocina', a: 'sala' }], payload: 'te la paso' });
  assert.deepEqual(eje.reputaciones('sala'), [{ emisor: 'casa', cantidad: 1 }]);
  await eje.escribir({ autor: 'sala', sobre: alta.id, t: T0, movimientos: [gastaT('sala'), { token: 'R', cantidad: 1, emisor: 'casa', de: 'sala', a: null }], payload: 'te la perdono' });
  assert.deepEqual([eje.reputaciones('sala'), eje.obligaciones('casa')], [[], 2]);
  // Ni inventar reputación ajena.
  await assert.rejects(eje.escribir({ autor: 'cocina', sobre: alta.id, t: T0, movimientos: [gastaT('cocina'), { token: 'R', cantidad: 1, emisor: 'cocina', de: 'cocina', a: 'sala' }], payload: 'x' }), /saldo insuficiente de R:cocina/);
});

// VG, 8-11 (mapa §15 [D] (4) y N4): cómo se cuenta lo fija el dueño en su PV2 (a quién cuenta y con qué presión);
// por defecto solo cuenta el dueño. Sustituye a «autorizar = bloquear P con el umbral del dueño» (autorizacion.js,
// retirado): comprometer P es bloquearlo con la salida = la decisión (§15 [D] (5)).
test('recuento: cuenta el P que comprometen las personas que nombra el dueño, con su presión; los demás no cuentan', async () => {
  const { eje, alta, menu } = await mundo();
  const decision = await eje.escribir({ autor: 'casa', sobre: alta.id, t: T0, movimientos: [gastaT('casa')], payload: ['¿Ampliamos el menú?', ['x'], [['decidir'], ['x'], ['threshold'], ['cocina']]] });
  assert.deepEqual([recuento(eje, decision.id).plantilla, recuento(eje, decision.id).pasa], ['threshold', false]);
  // La sala compromete, pero no está en la lista del dueño: no cuenta.
  const nota = await eje.escribir({ autor: 'sala', sobre: alta.id, t: T0, movimientos: [gastaT('sala')], payload: 'opino' });
  await eje.escribir({ autor: 'sala', sobre: decision.id, t: T0, payload: 'sí', movimientos: [gastaT('sala'), { token: 'P', ambito: nota.id, cantidad: 10, de: 'sala', a: 'sala', estado: 'bloqueo', salida: decision.id }] });
  assert.equal(recuento(eje, decision.id).valor, 0);
  // La cocina, sí: su P del menú bloqueado con la salida = la decisión.
  await eje.escribir({ autor: 'cocina', sobre: decision.id, t: T0, payload: 'sí', movimientos: [gastaT('cocina'), { token: 'P', ambito: menu.id, cantidad: 10, de: 'cocina', a: 'cocina', estado: 'bloqueo', salida: decision.id }] });
  const r = recuento(eje, decision.id);
  assert.ok(r.valor > 0 && r.pasa, JSON.stringify(r));
  // El peso de la cocina sobre el menú: su P allí entre su P en el dominio (su 100 %).
  assert.ok(peso(eje, 'cocina', menu.id) > 0 && peso(eje, 'cocina', menu.id) <= 1);
});

// Mapa §15 [D] (6): delegar mi P para una decisión concreta (el vecino que delega el voto) es una transferencia con
// salida: llega bloqueado con esa salida a quien lo recibe. Encargo 3b-bis (VG, 10-11): el P guarda su origen, así que
// lo delegado cuenta como de quien lo obtuvo, con su presión. Y P no se emite a mano.
test('delegar: el P comprometido con una decisión se pasa con su salida, conserva su origen y cuenta como de quien lo obtuvo', async () => {
  const { eje, g, alta } = await mundo();
  const dominio = await eje.escribir({ autor: 'casa', sobre: g, t: T0, movimientos: [gastaT('casa'), { token: 'T', escala: 'minuto', cantidad: 10, de: 'casa', a: 'recepcion' }], payload: 'Alojamiento' });
  const decide = (quien) => eje.escribir({ autor: 'casa', sobre: dominio.id, t: T0, movimientos: [gastaT('casa')], payload: ['¿Abrimos? (' + quien + ')', ['x'], [['decidir'], ['x'], ['threshold'], [quien]]] });
  const delega = (decision) => eje.escribir({ autor: 'casa', sobre: decision.id, t: T0, payload: 'delego',
    movimientos: [gastaT('casa'), { token: 'P', ambito: dominio.id, cantidad: 2, de: 'casa', a: 'casa', estado: 'bloqueo', salida: decision.id }, { token: 'P', ambito: dominio.id, cantidad: 2, de: 'casa', a: 'recepcion', salida: decision.id }] });
  const decision = await decide('casa');
  await delega(decision);
  const deCasa = 'P:' + dominio.id + '/casa';
  assert.deepEqual([eje.bloqueado('recepcion', deCasa, decision.id), eje.bloqueado('casa', deCasa, decision.id)], [2, 0]);
  assert.equal(recuento(eje, decision.id).pasa, true, 'lo comprometido en manos de recepción cuenta como de la casa, que está nombrada');
  // Si el dueño nombra solo a recepción, lo que le delegó la casa no cuenta: recepción no obtuvo ese P.
  const otra = await decide('recepcion');
  await delega(otra);
  assert.deepEqual([recuento(eje, otra.id).valor, recuento(eje, otra.id).pasa], [0, false]);
  // P no se acuña a mano (antes: «solo una persona, sobre un registro suyo y con su R en juego»).
  await assert.rejects(eje.escribir({ autor: 'casa', sobre: dominio.id, t: T0, payload: 'x',
    movimientos: [gastaT('casa'), { token: 'P', cantidad: 1, ambito: dominio.id, de: null, a: 'casa' }] }), /P is repositioned one step at a time/);
  void alta;
});

test('P y R encajan en la constante: familia, clave de serie, quién la emite', async () => {
  const { eje, alta } = await mundo();
  // R por emisor (la casa, la suya). T no se emite (VG, 8-11: no hay T acumulable): su serie aparece al gastarse, con
  // emitido 0. P no se acuña a mano: se obtiene (mapa §15), y su serie es la de un registro del eje y un origen
  // (encargo 3b-bis), con 10 por obtención.
  const series = eje.series().map((s) => [s.token, s.serie, s.emisor, s.emitido]);
  assert.deepEqual(series.filter((x) => x[0] !== 'P'), [
    ['T', 'minuto', 'casa', 0],
    ['R', 'casa', 'casa', 20],
  ]);
  const deP = series.filter((x) => x[0] === 'P');
  assert.ok(deP.length > 0 && deP.every(([, serie, emisor, emitido]) => Boolean(eje.obtener(serie.split('/')[0])) && serie.endsWith('/' + emisor) && emitido % 10 === 0));
  assert.ok(deP.some(([, serie]) => serie === alta.id + '/casa'));
  assert.ok(eje.poderes('casa').some((p) => p.ambito === alta.id && p.cantidad === 10));
  assert.ok(eje.poderes('casa').every((p) => p.ambito !== 'genesis'));
  assert.deepEqual(eje.reputaciones('casa'), [{ emisor: 'casa', cantidad: 20 }]);
  assert.deepEqual(eje.tiempos('cocina'), [{ escala: 'minuto', cantidad: 19 }]);
});
