// T consumido y anotado en el registro que soporta (VG, 7-11 noche, mapa §12
// [D] «T, corregido por VG»; revisión de seguridad de Core, 8-11):
//   1. escribir CONSUME T del autor (de = autor, a = null) y el consumo se
//      anota en el registro `sobre` (eje.tiempoSobre, eje.tiempoBajo; el 8 lo
//      funde por escala);
//   2. T se ve desde fuera y no afecta mecánicamente a terceros: ni autorizar,
//      ni topes de E, ni elegibilidad, ni orden de candidatos;
//   3. T no cruza de persona: de una persona a otra se rechaza y se transforma
//      en E; una persona sí da su T a una cosa (la máquina gasta el de su
//      dueño); un grupo no recibe T;
//   4. la escala del T consumido declara el orden de magnitud de lo emitido;
//      si no casa, es una incongruencia que se enseña, nunca un rechazo.
// Acuñar al gastar es azúcar de emitir y consumir en el mismo evento: solo
// una persona, y lo acuñado cuenta contra el tope del reloj.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Eje } from '../src/eje.js';
import { direccion } from '../src/btml.js';
import { evaluar } from '../src/bql.js';
import * as motor from '../src/motor.js';
import { elegibles } from '../src/elegibles.js';
import { ocupantes } from '../src/encaje.js';
import { incongruenciaDe } from '../src/tiempo.js';
import { validez } from '../src/validez.js';
import { colateral } from '../src/lente.js';

const AYER = '2026-11-07T10:00:00Z';
const T0 = '2026-11-08T10:00:00Z';
const SEMILLA = 20261108;

function prng(semilla) {
  let a = semilla;
  const r = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { int: (x, y) => x + Math.floor(r() * (y - x + 1)), pick: (xs) => xs[Math.floor(r() * xs.length)] };
}

const gasta = (de, cantidad = 1, escala = 'minuto') => ({ token: 'T', escala, cantidad, de, a: null });
const daT = (de, a, cantidad, escala = 'minuto') => ({ token: 'T', escala, cantidad, de, a });
const cedeE = (de, a, cantidad) => ({ token: 'E', emisor: 'g', denominacion: 'minuto', cantidad, de, a });

/** g (persona) da de alta a personas, una cosa y un grupo el día antes de T0. */
async function mundo() {
  const eje = await Eje.genesis({
    demostracion: true, identidad: 'g', tipo: 'persona', t: AYER, foco: ['raíz'],
    emision: [{ token: 'T', escala: 'minuto', cantidad: 1e6 }, { token: 'E', denominacion: 'minuto', cantidad: 1e6 }, { token: 'P', ambito: 'genesis', cantidad: 10 }],
  });
  const alta = await eje.escribir({
    autor: 'g', sobre: eje.genesisId, t: AYER, payload: 'altas',
    contexto: { tipos: { ana: 'persona', bea: 'persona', robot: 'cosa', club: 'grupo' } },
    movimientos: [gasta('g'), cedeE('g', 'ana', 10), cedeE('g', 'bea', 10), daT('g', 'robot', 30), cedeE('g', 'club', 10)],
  });
  return { eje, g: eje.genesisId, alta };
}

// ---------- 1 · consumir y anotar ----------

test('escribir consume T del autor y el consumo se anota en el registro que soporta (tiempoSobre, tiempoBajo, series)', async () => {
  const { eje, g, alta } = await mundo();
  const a = await eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'a', movimientos: [gasta('ana', 3)] });
  await eje.escribir({ autor: 'bea', sobre: a.id, t: T0, payload: 'b', movimientos: [gasta('bea', 2), gasta('bea', 1, 'hora')] });
  await eje.escribir({ autor: 'robot', sobre: a.id, t: T0, payload: 'c', movimientos: [gasta('robot', 4)] });
  // Lo de cada registro: lo consumido por quienes escriben encima.
  assert.deepEqual(eje.tiempoSobre(g), { minuto: 1 });
  assert.deepEqual(eje.tiempoSobre(alta.id), { minuto: 3 });
  assert.deepEqual(eje.tiempoSobre(a.id), { minuto: 6, hora: 1 });
  assert.deepEqual(eje.tiempoSobre('nadie'), {});
  // Y lo que cuelga de él.
  assert.deepEqual(eje.tiempoBajo(alta.id), { minuto: 9, hora: 1 });
  assert.deepEqual(eje.tiempoBajo(g), { minuto: 10, hora: 1 });
  // En las series de T: lo consumido y lo acuñado al gastarlo (ana y bea no tenían T; el robot gastó el suyo).
  const serie = (k) => eje.series().find((s) => s.clave === k);
  assert.deepEqual([serie('T:minuto').consumido, serie('T:minuto').acunado], [10, 5]);
  assert.deepEqual([serie('T:hora').emitido, serie('T:hora').consumido, serie('T:hora').acunado], [1, 1, 1]);
  assert.equal(eje.saldoT('robot', 'minuto'), 26);
  // Los ocupantes lo enseñan (solo se ve: nada lo lee para conceder).
  assert.deepEqual(ocupantes(eje, a.id, [0], { orden: 'llegada' }).filter((o) => o.tipo === 'escrito').map((o) => [o.autor, o.tiempo]),
    [['bea', { minuto: 2, hora: 1 }], ['robot', { minuto: 4 }]]);
  // Restaurar rehace lo anotado desde los eventos.
  const otro = await Eje.desde(eje.orden.map((id) => eje.obtener(id)));
  assert.deepEqual([otro.tiempoSobre(a.id), otro.tiempoBajo(g)], [eje.tiempoSobre(a.id), eje.tiempoBajo(g)]);
});

test('dárselo a uno mismo, bloquearlo o liberarlo no es consumir: no paga la escritura', async () => {
  const { eje, alta } = await mundo();
  for (const m of [daT('g', 'g', 1), { ...daT('g', 'g', 1), estado: 'bloqueo', salida: 's' }]) {
    await assert.rejects(eje.escribir({ autor: 'g', sobre: alta.id, t: T0, payload: 'gratis', movimientos: [m] }), /escribir consume T del autor/);
  }
  assert.deepEqual(eje.tiempoSobre(alta.id), {});
});

// ---------- 3 · T no cruza de persona ----------

test('T no cruza de persona: a otra persona o a un grupo se rechaza; a una cosa, sí; dar tiempo a otra persona es E', async () => {
  const { eje, alta } = await mundo();
  await assert.rejects(eje.escribir({ autor: 'g', sobre: alta.id, t: T0, payload: 'x', movimientos: [gasta('g'), daT('g', 'ana', 5)] }),
    /T no cruza de persona: ana no es el autor; dar tiempo a otro es emitir E de la serie del que lo da, denominada en su tiempo \(E:g\/minuto\)/);
  await assert.rejects(eje.escribir({ autor: 'g', sobre: alta.id, t: T0, payload: 'x', movimientos: [gasta('g'), daT('g', 'club', 5)] }), /T no cruza de persona: club/);
  // Una cosa tampoco se lo pasa a una persona.
  await assert.rejects(eje.escribir({ autor: 'robot', sobre: alta.id, t: T0, payload: 'x', movimientos: [gasta('robot'), daT('robot', 'ana', 1)] }), /T no cruza de persona: ana/);
  // A una cosa, sí: la máquina gasta el T de su dueño; y una cosa a otra cosa nueva, también.
  await eje.escribir({ autor: 'g', sobre: alta.id, t: T0, payload: 'más T para el robot', movimientos: [gasta('g'), daT('g', 'robot', 5)] });
  await eje.escribir({ autor: 'robot', sobre: alta.id, t: T0, payload: 'un brazo', contexto: { tipos: { brazo: 'cosa' } }, movimientos: [gasta('robot'), daT('robot', 'brazo', 3)] });
  assert.deepEqual([eje.saldoT('robot', 'minuto'), eje.saldoT('brazo', 'minuto')], [31, 3]);
  // Lo que vale entre personas: E de la serie del que da, en su tiempo.
  await eje.escribir({ autor: 'g', sobre: alta.id, t: T0, payload: 'cinco minutos para ana', movimientos: [gasta('g'), cedeE('g', 'ana', 5)] });
  assert.equal(eje.saldo('ana', 'E:g/minuto'), 15);
  assert.equal(eje.saldoT('ana', 'minuto'), 0);
});

// ---------- acuñar al gastar: azúcar, solo personas, dentro del tope ----------

test('por cuenta de un grupo: una persona con P exacto sobre su alta mueve, bloquea y libera lo del grupo; sin P o sin decirlo, no (Core, 8-11, [X] confirmar VG)', async () => {
  const { eje, alta } = await mundo();
  const k = 'E:g/minuto';
  // g, que escribió el alta, le da a ana P exactamente sobre ella (P:<alta>, estrechado desde su P del eje); bea no tiene P.
  await eje.escribir({ autor: 'g', sobre: alta.id, t: AYER, payload: 'P a ana', movimientos: [gasta('g'), { token: 'P', ambito: alta.id, cantidad: 1, de: 'g', a: 'ana' }] });
  assert.equal(eje.saldo('ana', 'P:' + alta.id), 1);
  const porClub = { porCuenta: 'club' };
  // Positivo: ana mueve E del club a bea, con su firma y su T.
  await eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'el club paga a bea', contexto: porClub, movimientos: [gasta('ana'), cedeE('club', 'bea', 3)] });
  assert.equal(eje.saldo('club', k), 7);
  assert.equal(eje.saldo('bea', k), 13);
  // Bloquear y liberar lo del grupo, también por su cuenta.
  await eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'reserva', contexto: porClub, movimientos: [gasta('ana'), { ...cedeE('club', 'club', 2), estado: 'bloqueo', salida: 'R:g' }] });
  assert.equal(eje.saldo('club', k), 5);
  await eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'suelta', contexto: porClub, movimientos: [gasta('ana'), { ...cedeE('club', 'club', 2), estado: 'liberacion', salida: 'R:g' }] });
  assert.equal(eje.saldo('club', k), 7);
  // Negativos: bea no tiene P sobre el alta del club; ana sin decir porCuenta; porCuenta de una cosa no vale.
  const deBea = { autor: 'bea', sobre: alta.id, t: T0, payload: 'x', contexto: porClub, movimientos: [gasta('bea'), cedeE('club', 'bea', 1)] };
  await assert.rejects(eje.escribir(deBea), /nadie mueve tokens ajenos: club no es el autor \(por cuenta del grupo club mueve una persona con P exacto sobre su alta: bea no tiene P:[0-9a-f]+/);
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'x', movimientos: [gasta('ana'), cedeE('club', 'ana', 1)] }), /nadie mueve tokens ajenos: club no es el autor$/);
  await assert.rejects(eje.escribir({ autor: 'g', sobre: alta.id, t: T0, payload: 'x', contexto: { porCuenta: 'robot' }, movimientos: [gasta('g'), daT('robot', 'robot', 1)] }), /nadie mueve tokens ajenos: robot no es el autor/);
  assert.equal(eje.saldo('club', k), 7);
  // Las capas de validez dicen lo mismo que el eje.
  const vNo = await validez(eje, { ...deBea, en: '0000000000', id: 'x' });
  assert.equal(vNo.permiso.estado, 'falla');
  assert.match(vNo.permiso.motivos.join(' '), /nadie mueve tokens ajenos: club no es el autor/);
  const vSi = await validez(eje, { autor: 'ana', sobre: alta.id, t: T0, payload: 'y', contexto: porClub, movimientos: [gasta('ana'), cedeE('club', 'bea', 1)], en: '0000000000', id: 'y' });
  assert.equal(vSi.permiso.libro.estado, 'ok');
});

test('SEG-06 (revisión de seguridad de main, 8-11) por cuenta de un grupo: solo el P exacto sobre su alta, disponible o bloqueado hacia él; el alta de varios grupos no habilita a ninguno', async () => {
  const { eje, alta } = await mundo();
  const porClub = { porCuenta: 'club' };
  const kAlta = 'P:' + alta.id;
  const mueveClub = (autor, payload) => ({ autor, sobre: alta.id, t: T0, payload, contexto: porClub, movimientos: [gasta(autor), cedeE('club', 'bea', 1)] });
  const daP = (a, ambito, cantidad = 1) => ({ token: 'P', ambito, cantidad, de: 'g', a });
  const sinP = (quien) => new RegExp('nadie mueve tokens ajenos: club no es el autor \\(por cuenta del grupo club mueve una persona con P exacto sobre su alta: ' + quien + ' no tiene P:[0-9a-f]+');

  // 1. El P heredado del génesis no basta: cubre el alta del club, pero también todo el eje.
  await eje.escribir({ autor: 'g', sobre: alta.id, t: AYER, payload: 'P del eje a ana', movimientos: [gasta('g'), daP('ana', 'genesis')] });
  assert.equal(eje.poderSobre('ana', alta.id), 1);
  await assert.rejects(eje.escribir(mueveClub('ana', 'el club paga')), sinP('ana'));
  // Ni el heredado de un ancestro que no es el génesis: el coro tiene su alta debajo de un dominio de g, y bea tiene
  // P sobre el dominio (que cubre el alta del coro), no sobre el alta.
  const dominio = await eje.escribir({ autor: 'g', sobre: eje.genesisId, t: AYER, payload: 'dominio', movimientos: [gasta('g')] });
  const altaCoro = await eje.escribir({ autor: 'g', sobre: dominio.id, t: AYER, payload: 'alta del coro', contexto: { tipos: { coro: 'grupo' } }, movimientos: [gasta('g'), cedeE('g', 'coro', 5)] });
  await eje.escribir({ autor: 'g', sobre: dominio.id, t: AYER, payload: 'P del dominio a bea', movimientos: [gasta('g'), daP('bea', dominio.id)] });
  assert.equal(eje.poderSobre('bea', altaCoro.id), 1);
  await assert.rejects(eje.escribir({ autor: 'bea', sobre: altaCoro.id, t: T0, payload: 'x', contexto: { porCuenta: 'coro' }, movimientos: [gasta('bea'), cedeE('coro', 'bea', 1)] }),
    /nadie mueve tokens ajenos: coro no es el autor \(por cuenta del grupo coro mueve una persona con P exacto sobre su alta: bea no tiene P:[0-9a-f]+/);

  // 2. P exacto, pero bloqueado para otra cosa (otra salida): no cuenta.
  await eje.escribir({ autor: 'g', sobre: alta.id, t: AYER, payload: 'P exacto a bea', movimientos: [gasta('g'), daP('bea', alta.id)] });
  await eje.escribir({ autor: 'bea', sobre: alta.id, t: T0, payload: 'lo comprometo en otra cosa', movimientos: [gasta('bea'), { token: 'P', ambito: alta.id, cantidad: 1, de: 'bea', a: 'bea', estado: 'bloqueo', salida: 'otra-cosa' }] });
  assert.deepEqual([eje.saldo('bea', kAlta), eje.bloqueado('bea', kAlta, 'otra-cosa')], [0, 1]);
  await assert.rejects(eje.escribir(mueveClub('bea', 'x')), sinP('bea'));
  // Liberado y bloqueado hacia el grupo (salida = una serie que emite el grupo, o el propio grupo), sí cuenta.
  await eje.escribir({ autor: 'bea', sobre: alta.id, t: T0, payload: 'lo suelto y lo comprometo con el club', movimientos: [gasta('bea'),
    { token: 'P', ambito: alta.id, cantidad: 1, de: 'bea', a: 'bea', estado: 'liberacion', salida: 'otra-cosa' },
    { token: 'P', ambito: alta.id, cantidad: 1, de: 'bea', a: 'bea', estado: 'bloqueo', salida: 'R:club' }] });
  assert.deepEqual([eje.saldo('bea', kAlta), eje.bloqueado('bea', kAlta, 'R:club')], [0, 1]);
  await eje.escribir(mueveClub('bea', 'el club paga, con el P de bea comprometido con él'));

  // 3. Un alta que dio de alta a dos grupos no habilita a mover lo de ninguno, ni con P exacto sobre ella.
  const altaDoble = await eje.escribir({ autor: 'g', sobre: eje.genesisId, t: AYER, payload: 'dos grupos', contexto: { tipos: { norte: 'grupo', sur: 'grupo' } }, movimientos: [gasta('g'), cedeE('g', 'norte', 5), cedeE('g', 'sur', 5)] });
  await eje.escribir({ autor: 'g', sobre: altaDoble.id, t: AYER, payload: 'P exacto a ana', movimientos: [gasta('g'), daP('ana', altaDoble.id)] });
  assert.equal(eje.saldo('ana', 'P:' + altaDoble.id), 1);
  for (const grupo of ['norte', 'sur']) {
    await assert.rejects(eje.escribir({ autor: 'ana', sobre: altaDoble.id, t: T0, payload: 'x', contexto: { porCuenta: grupo }, movimientos: [gasta('ana'), cedeE(grupo, 'ana', 1)] }),
      new RegExp('nadie mueve tokens ajenos: ' + grupo + ' no es el autor \\(por cuenta del grupo ' + grupo + ' mueve una persona con P exacto sobre su alta: su alta \\([0-9a-f]{8}\\) dio de alta a varios grupos \\(norte, sur\\): el P sobre ella no habilita a ninguno; cada grupo, su propio alta\\)'));
  }

  // 4. Lo positivo: el alta propia del grupo y P:<alta> exacto y disponible.
  await eje.escribir({ autor: 'g', sobre: alta.id, t: AYER, payload: 'P exacto a ana', movimientos: [gasta('g'), daP('ana', alta.id)] });
  const antes = eje.saldo('club', 'E:g/minuto');
  await eje.escribir(mueveClub('ana', 'el club paga, por ana'));
  assert.equal(eje.saldo('club', 'E:g/minuto'), antes - 1);

  // Las capas de validez dicen lo mismo que el eje (con el libro de ahora: ana con P:<alta>, el doble no habilita).
  const vSi = await validez(eje, { ...mueveClub('ana', 'otra vez'), en: '0000000000', id: 'si' });
  assert.equal(vSi.permiso.libro.estado, 'ok');
  const vDoble = await validez(eje, { autor: 'ana', sobre: altaDoble.id, t: T0, payload: 'x', contexto: { porCuenta: 'norte' }, movimientos: [gasta('ana'), cedeE('norte', 'ana', 1)], en: '0000000000', id: 'doble' });
  assert.equal(vDoble.permiso.estado, 'falla');
  assert.match(vDoble.permiso.motivos.join(' '), /dio de alta a varios grupos \(norte, sur\)/);
  const vCoro = await validez(eje, { autor: 'bea', sobre: altaCoro.id, t: T0, payload: 'x', contexto: { porCuenta: 'coro' }, movimientos: [gasta('bea'), cedeE('coro', 'bea', 1)], en: '0000000000', id: 'coro' });
  assert.equal(vCoro.permiso.estado, 'falla');
  assert.match(vCoro.permiso.motivos.join(' '), /bea no tiene P:[0-9a-f]+ \(el P exacto sobre el alta del grupo/);
});

test('acuñar al gastar: solo una persona, y lo acuñado cuenta contra el tope del reloj (Core, 8-11)', async () => {
  const { eje, alta } = await mundo();
  // ana entró hace un día: a T0 su reloj le da 1440 minutos y 24 horas.
  await eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'mucho', movimientos: [gasta('ana', 1400)] });
  assert.equal(eje.emitidoT('ana', 'minuto'), 1400); // cuenta igual que una emisión explícita
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'demasiado', movimientos: [gasta('ana', 41)] }),
    /saldo insuficiente de T:minuto en ana: acuñar al gastar los 41 que faltan llevaría 1441 emitido y el reloj da 1440 desde su alta/);
  // Ni emitiendo después: el tope es el mismo para lo acuñado y lo emitido.
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'x', movimientos: [{ token: 'T', escala: 'minuto', cantidad: 41, de: null, a: 'ana' }, gasta('ana')] }), /tope de T:minuto para ana/);
  await eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'lo justo', movimientos: [gasta('ana', 40)] });
  // Una cosa no acuña: gasta el T que le dieron. Un grupo no tiene T: lo suyo lo escribe una persona con P sobre él.
  await assert.rejects(eje.escribir({ autor: 'robot', sobre: alta.id, t: T0, payload: 'x', movimientos: [gasta('robot', 31)] }),
    /saldo insuficiente de T:minuto en robot: tiene 30 y gasta 31; solo una persona acuña su T al gastarlo \(robot es cosa\)/);
  await assert.rejects(eje.escribir({ autor: 'club', sobre: alta.id, t: T0, payload: 'x', movimientos: [gasta('club')] }), /solo una persona acuña su T al gastarlo \(club es grupo\)/);
  // Con el saldo que tiene, primero lo suyo: la raíz gasta de su saldo y no acuña nada.
  const antes = eje.emitidoT('g', 'minuto');
  await eje.escribir({ autor: 'g', sobre: alta.id, t: T0, payload: 'del saldo', movimientos: [gasta('g', 100)] });
  assert.equal(eje.emitidoT('g', 'minuto'), antes);
  // Las capas de validez dicen lo mismo que el eje.
  const v = await validez(eje, { autor: 'ana', sobre: alta.id, t: T0, payload: 'y', movimientos: [gasta('ana', 1)], contexto: {}, en: '0000000000', id: 'x' });
  assert.equal(v.acreditacion.estado, 'falla');
  assert.match(v.acreditacion.motivos.join(' '), /saldo insuficiente de T:minuto en ana/);
});

// ---------- 2 · T se ve y no concede nada a terceros ----------

/**
 * Un mercado de casa (una persona) con criterio BUSCAR y a ana en su 3 (elegible), ofertas de ana, bea y el robot
 * con el T que diga `gastos` (uno por escrito), un alojamiento con capacidad 4 y E atada a él, y una consolidación
 * sobre el mercado que casa autoriza bloqueando su P. Devuelve lo que se concede o se enseña a terceros, con los
 * ids por su orden de llegada (los gastos cambian los ids).
 */
async function mercado(gastos) {
  const { eje, alta } = await mundo();
  let k = 0;
  const g = () => gastos[k++ % gastos.length];
  await eje.escribir({ autor: 'g', sobre: alta.id, t: AYER, payload: 'alta de casa', contexto: { tipos: { casa: 'persona' } }, movimientos: [gasta('g'), cedeE('g', 'casa', 10), { token: 'R', emisor: 'g', cantidad: 0.5, de: null, a: 'g' }, colateral('g', 0.05)] }); // R6: R propia en juego
  const X = await eje.escribir({ autor: 'casa', sobre: eje.genesisId, t: T0, payload: ['mercado', 'ofertas', '=BUSCAR(1)', 'ana'], movimientos: [gasta('casa', g())] });
  for (const [autor, texto] of [['bea', 'ruido'], ['ana', 'oferta de ana'], ['robot', 'oferta del robot'], ['casa', 'oferta de casa']]) {
    await eje.escribir({ autor, sobre: X.id, en: direccion([1]), t: T0, payload: texto, movimientos: [gasta(autor, g())] });
  }
  // P sobre el mercado (R en juego) y E atada a un alojamiento con capacidad 4, bloqueando P.
  await eje.escribir({ autor: 'casa', sobre: X.id, t: T0, payload: 'poder', movimientos: [gasta('casa', g()), { token: 'R', emisor: 'casa', cantidad: 10, de: null, a: 'casa' }, colateral('casa', 1), { token: 'R', emisor: 'casa', cantidad: 1, de: 'casa', a: 'g' }, { token: 'P', ambito: X.id, cantidad: 4, de: null, a: 'casa' }] });
  const H = await eje.escribir({ autor: 'casa', sobre: X.id, t: T0, payload: ['alojamiento', ['plazas'], 4], movimientos: [gasta('casa', g())] });
  const clave = 'E:casa/cama@n1@' + H.id;
  await eje.escribir({ autor: 'casa', sobre: H.id, t: T0, payload: 'camas', movimientos: [gasta('casa', g()), { token: 'R', emisor: 'casa', cantidad: 1, de: 'casa', a: 'g' },
    { token: 'P', ambito: H.id, cantidad: 4, de: null, a: 'casa' }, { token: 'P', ambito: H.id, cantidad: 2, de: 'casa', a: 'casa', estado: 'bloqueo', salida: 'E:casa/cama@*@' + H.id },
    { token: 'E', emisor: 'casa', denominacion: 'cama@n1', registro: H.id, cantidad: 2, de: null, a: 'casa' }] });
  const c = await motor.consolidar(eje, { autor: 'ana', foco: X.id, t: T0, elecciones: { 1: 'algo' } });
  await motor.autorizar(eje, { autorizante: 'casa', consolidacion: c.id, t: T0 });
  const indice = (id) => eje.orden.indexOf(id);
  const r = evaluar(eje, X.id, [2], { limites: { candidatos: 3 } });
  return {
    estado: motor.estadoDe(eje, c.id),
    autorizan: ['ana', 'bea', 'robot', 'casa', 'g'].map((id) => motor.puedeAutorizar(eje, id, c.id)),
    topes: eje.topes(H.id, T0).map((x) => [indice(x.registro), x.capacidad, x.franja, x.vivo, x.libre]),
    vivo: eje.vivo(clave, T0),
    elegibles: [...elegibles(eje, X.id).autores].sort(),
    candidatos: [r.estado, ...(r.valor?.items ?? []).map((i) => [i.origen, i.autor ?? null, i.contenido ?? null]), r.valor?.noElegibles ?? 0],
    propuesta: motor.proponer(eje, X.id, { posiciones: [2] }).elecciones[2]?.candidato?.autor ?? null,
    tiempo: eje.tiempoBajo(eje.genesisId),
  };
}

test('propiedad: cambiar el T gastado no cambia autorizaciones, topes de E, elegibles ni el orden de los candidatos', async () => {
  const p = prng(SEMILLA);
  const base = await mercado([1]);
  assert.equal(base.estado, 'AUTORIZADO');
  assert.deepEqual(base.elegibles, ['ana', 'casa']);
  assert.equal(base.vivo, 2);
  for (let caso = 0; caso < 12; caso++) {
    const gastos = Array.from({ length: p.int(1, 7) }, () => p.pick([1, 2, 3, 5, 8, 13, 30]));
    const otro = await mercado(gastos);
    assert.notDeepEqual(otro.tiempo, base.tiempo, 'caso ' + caso + ': el T sí cambia (se ve)');
    const { tiempo: _a, ...sinT } = otro;
    const { tiempo: _b, ...baseSinT } = base;
    assert.deepEqual(sinT, baseSinT, 'caso ' + caso + ' (' + gastos + ')');
  }
});

// ---------- 4 · escala de T frente al tamaño de lo emitido ----------

test('incongruenciaDe: la escala del T gastado declara el orden de lo emitido; si no casa, se enseña y no se rechaza', async () => {
  const ev = (movimientos, payload) => ({ autor: 'ana', movimientos, payload });
  const decena = Array.from({ length: 10 }, (_, i) => 'p' + i);
  const cien = Array.from({ length: 10 }, () => [...decena]);
  // Un segundo para una nota: casa (orden 1); un minuto para cien posiciones, también (orden 2).
  assert.equal(incongruenciaDe(ev([gasta('ana', 1, 'segundo')], 'nota')), null);
  assert.equal(incongruenciaDe(ev([gasta('ana', 1, 'minuto')], cien)), null);
  // Un minuto para una nota: lo emitido es más pequeño de lo que declara su escala.
  assert.deepEqual(incongruenciaDe(ev([gasta('ana', 1, 'minuto')], 'nota')), { escala: 'minuto', ordenEsperado: 2, ordenEmitido: 1, posiciones: 1 });
  // Con varias escalas manda la mayor; un segundo para cien posiciones es demasiado poco.
  assert.deepEqual(incongruenciaDe(ev([gasta('ana', 1, 'minuto'), gasta('ana', 1, 'hora')], cien)), { escala: 'hora', ordenEsperado: 3, ordenEmitido: 2, posiciones: 100 });
  assert.deepEqual(incongruenciaDe(ev([gasta('ana', 1, 'segundo')], cien)), { escala: 'segundo', ordenEsperado: 1, ordenEmitido: 2, posiciones: 100 });
  // Sin consumo del autor, o en el génesis, no hay nada que comparar.
  assert.equal(incongruenciaDe(ev([gasta('bea', 1, 'hora')], 'nota')), null);
  assert.equal(incongruenciaDe({ ...ev([{ token: 'T', escala: 'hora', cantidad: 1, de: null, a: 'ana' }], 'g'), contexto: { genesis: true } }), null);
  // El eje no la rechaza; la capa de interpretación la enseña.
  const { eje, alta } = await mundo();
  const nota = await eje.escribir({ autor: 'g', sobre: alta.id, t: T0, payload: 'nota', movimientos: [gasta('g', 1, 'minuto')] });
  const v = await validez(eje, nota.id);
  assert.equal(v.interpretacion.estado, 'ok');
  assert.deepEqual(v.interpretacion.incongruenciaT, { escala: 'minuto', ordenEsperado: 2, ordenEmitido: 1, posiciones: 1 });
  const bien = await eje.escribir({ autor: 'g', sobre: alta.id, t: T0, payload: 'otra nota', movimientos: [gasta('g', 1, 'segundo')] });
  assert.equal((await validez(eje, bien.id)).interpretacion.incongruenciaT, null);
});
