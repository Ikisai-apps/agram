// Ciclo de vida de E/P/R/T (VG, 7-11 noche). Cada regla con su caso que pasa
// y el que no, y al final un ciclo completo T → R → P → E y vuelta.
//
// «Todos son emitidos por una persona individualmente. Siempre es X persona
// respalda Y recurso concreto, poder de decisión sobre algo, reputación
// cedida a otros para requerir atención, o tiempo usado por alguien en algo.»
// Encargo 3b (VG, 8-11 tarde, mapa §15 [D] N3): «dos secuencias, no dos
// escalones»: emitir E exige P, emitir P exige R, emitir R exige T; y P no se
// acuña a mano: se obtiene al escribir, al conseguir E y al recibir R.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Eje, caducada } from '../src/eje.js';
import { crearEvento, hash, canonico, cuerpo } from '../src/evento.js';
import { msUTC, esInstante } from '../src/instante.js';
import { ADELANTO_MAXIMO_MS } from '../src/ciclo.js';
import { validarMovimiento } from '../src/tokens.js';
import { serializar, restaurar } from '../src/persistencia.js';
import { validez } from '../src/validez.js';
import { generarClaves } from '../src/autoridad.js';
import { recuento } from '../src/motor.js';
import { entrarPorInvitacion } from '../ejemplos/ikisai/altas.mjs';

const T0 = '2026-11-07T10:00:00Z';
/**
 * Un mes antes de T0: el mundo nace aquí salvo que la prueba mire el reloj del alta. Cada persona escribe con su
 * asignación de T del día (VG, 8-11: asignación diaria).
 */
const ALTA = '2026-10-08T10:00:00Z';
const gasta = (de, cantidad = 1) => ({ token: 'T', escala: 'minuto', cantidad, de, a: null });
const daT = (de, a, cantidad) => ({ token: 'T', escala: 'minuto', cantidad, de, a });
/** Ceder minutos a otro (VG, 7-11 noche: T no cruza de persona): E de la serie de tiempo de `emisor`. */
const cedeT = (de, a, cantidad, emisor = de) => ({ token: 'E', emisor, denominacion: 'minuto', cantidad, de, a });
const emiteR = (persona, cantidad) => ({ token: 'R', emisor: persona, cantidad, de: null, a: persona });
const mueveR = (emisor, cantidad, de, a) => ({ token: 'R', emisor, cantidad, de, a });
const emiteP = (persona, ambito, cantidad = 1) => ({ token: 'P', ambito, cantidad, de: null, a: persona });
const emiteE = (emisor, denominacion, cantidad, extra = {}) => ({ token: 'E', emisor, denominacion, cantidad, de: null, a: emisor, ...extra });
const mueveE = (emisor, denominacion, cantidad, de, a) => ({ token: 'E', emisor, denominacion, cantidad, de, a });
/** Un T que no es real (pasado): paga la escritura, pero no cuenta para el escalonado (VG, 8-11). */
const deMemoria = (de) => ({ token: 'T', escala: 'pasado', cantidad: 1, de, a: null, refiere: '2026-01-01T00:00:00Z' });

/**
 * La raíz (una persona, la primera identidad: escribe el génesis) emite su R y sus minutos; invita a ana y a bea, que
 * aceptan (su alta, encargo 3b; personas, VG 10-11 B1); la raíz les cede minutos y da de alta a la sala (una cosa). No
 * hay identidades de grupo (VG, 8-11).
 */
/** El registro de las altas de cada mundo: lo escribe raiz sobre su génesis y las personas cuelgan de él lo suyo. */
const ALTAS = new WeakMap();

async function mundo({ t = ALTA } = {}) {
  const eje = await Eje.genesis({
    demostracion: true,
    identidad: 'raiz',
    emision: [{ token: 'R', cantidad: 10 }, { token: 'E', denominacion: 'minuto', cantidad: 1e6 }],
    foco: 'Mundo de ejemplo',
    t,
  });
  const g = eje.genesisId;
  for (const id of ['ana', 'bea']) await entrarPorInvitacion(eje, { por: 'raiz', quien: id, t });
  const alta = await eje.escribir({ autor: 'raiz', sobre: g, t, payload: 'altas',
    movimientos: [gasta('raiz'), ...['ana', 'bea', 'sala'].map((a) => cedeT('raiz', a, 60))] });
  ALTAS.set(eje, alta.id);
  return { eje, g, alta };
}

/**
 * Un registro de una persona (diez P sobre él por escribirlo: mapa §15 [D] N1) y, sobre él, su R: emite 10 (con T
 * real, sin colateral: VG, 9-11) y da una a bea (o a quien se diga).
 */
// Revisión de seguridad (encargo 3b): escribir sobre el alta de otra identidad (el génesis es el alta de raiz) tiene el
// precio de su atención; por omisión el taller cuelga del registro de las altas, que no es el alta de nadie que escriba.
async function taller(eje, persona, { sobre = ALTAS.get(eje) ?? eje.genesisId, t = T0, ante = 'bea', payload = 'taller de ' + persona } = {}) {
  const reg = await eje.escribir({ autor: persona, sobre, t, payload, movimientos: [gasta(persona)] });
  await eje.escribir({ autor: persona, sobre: reg.id, t, payload: 'reputación en ' + payload,
    movimientos: [gasta(persona), emiteR(persona, 10), mueveR(persona, 1, persona, ante)] });
  return reg;
}

// ---------- 1 · solo emiten personas ----------

test('solo emiten personas: una cosa (su alta la escribió otro, B1) no emite', async () => {
  const { eje, alta } = await mundo();
  await eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'mi reputación', movimientos: [gasta('ana'), emiteR('ana', 5)] });
  assert.deepEqual(eje.serie('R:ana'), { emisor: 'ana', emitido: 5 });
  await assert.rejects(eje.escribir({ autor: 'sala', sobre: alta.id, t: T0, payload: 'x', movimientos: [gasta('sala'), emiteR('sala', 1)] }), /only persons mint: sala is a thing \(its alta was written by raiz\)/);
  // El autor del génesis escribe su propia alta: es una persona. No hay tipo que declarar (B1), tampoco grupo.
  await assert.rejects(Eje.genesis({ demostracion: true, identidad: 'x', tipo: 'cosa', emision: [], foco: 'g', t: T0 }), /no hay tipo/);
  assert.equal((await Eje.genesis({ demostracion: true, identidad: 'x', emision: [], foco: 'g', t: T0 })).esPersona('x'), true);
});

test('no hay identidades de grupo (VG, 8-11): el alta de tipo grupo se rechaza; un grupo es un registro con P delegado, y nadie emite ni mueve por cuenta de otro', async () => {
  // VG, 8-11: «lo único que tenemos de grupo es la delegación: yo te delego T, P, R, E para que tú lo uses; es la
  // persona la que hace el registro». Antes (SEG-06, SEG-08) una persona con P sobre el alta de un grupo emitía y
  // movía a su nombre; eso se retira.
  const { eje, alta } = await mundo();
  const altaClub = { autor: 'raiz', sobre: alta.id, t: T0, payload: 'el club', contexto: { tipos: { club: 'grupo' } }, movimientos: [gasta('raiz'), cedeT('raiz', 'club', 5)] };
  const sinGrupos = /no hay tipo en el alta \(VG, 10-11, B1\)/;
  await assert.rejects(eje.escribir(altaClub), sinGrupos);
  const v = await validez(eje, { ...altaClub, en: '0000000000', id: 'c' });
  assert.equal(v.permiso.estado, 'falla');
  assert.match(v.permiso.motivos.join(' '), sinGrupos);
  // El club es un registro de ana: tiene P sobre él por escribirlo y lo delega a bea (pertenecer es tener ese P).
  const club = await taller(eje, 'ana', { payload: 'Club' });
  await eje.escribir({ autor: 'ana', sobre: club.id, t: T0, payload: 'bea entra en el club', movimientos: [gasta('ana'), { token: 'P', ambito: club.id, cantidad: 1, de: 'ana', a: 'bea' }] });
  assert.equal(eje.poderSobre('bea', club.id), 1);
  // Con ese P bea pone su R y su P, no los de ana ni los del club: nadie emite a nombre de otro.
  await assert.rejects(eje.escribir({ autor: 'bea', sobre: club.id, t: T0, payload: 'x', movimientos: [gasta('bea'), emiteR('ana', 1)] }),
    /(E is minted by and to|R is minted by) its issuer/);
  await eje.escribir({ autor: 'bea', sobre: club.id, t: T0, payload: 'mi reputación en el club', movimientos: [gasta('bea'), emiteR('bea', 10)] });
  assert.deepEqual(eje.serie('R:bea'), { emisor: 'bea', emitido: 10 });
  // Ni mueve lo de otro, diga lo que diga el contexto (contexto.porCuenta ya no existe).
  const ajeno = { autor: 'bea', sobre: club.id, t: T0, payload: 'x', contexto: { porCuenta: 'ana' }, movimientos: [gasta('bea'), cedeT('ana', 'bea', 1)] };
  await assert.rejects(eje.escribir(ajeno), /nobody moves tokens of others/);
  const va = await validez(eje, { ...ajeno, en: '0000000000', id: 'a' });
  assert.match(va.permiso.motivos.join(' '), /nobody moves tokens of others/);
});

// ---------- 2 · T: la asignación diaria de cada persona (VG, 8-11) ----------
// PROVISIONAL [X] (VG, 7-11 noche): «emitir desde dos fuentes es igual de válido que emitir el doble desde una
// única fuente; no da más». El T por identidad y reloj es lo que una identidad falsa multiplica: estas pruebas
// fijan la regla de hoy, y la final saldrá del estudio de neutralidad ante agrupación y división.

test('T: nadie lo emite fuera del génesis; cada persona escribe con su asignación del día (VG, 8-11: asignación diaria)', async () => {
  const { eje, alta } = await mundo({ t: T0 });
  // B1: el alta de ana la escribe ella misma.
  assert.deepEqual([eje.obtener(eje.alta('ana').id).autor, eje.alta('ana').t], ['ana', T0]);
  // En el mismo instante del alta, ana ya tiene el día (menos el minuto de escribirla): no hace falta emitir.
  assert.deepEqual(['minuto', 'hora', 'dia'].map((e) => eje.saldoT('ana', e, T0)), [1439, 24, 1]);
  await eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'mi minuto', movimientos: [gasta('ana')] });
  assert.equal(eje.saldoT('ana', 'minuto', T0), 1438); // y el de su alta
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'x', movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: null, a: 'ana' }, gasta('ana')] }),
    /nobody mints T/);
  // T no cruza de persona (VG, 7-11 noche): ana no da su hora a bea; darla es emitir E de su serie, en horas.
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'una hora para bea', movimientos: [gasta('ana'), { token: 'T', escala: 'hora', cantidad: 1, de: 'ana', a: 'bea' }] }),
    /T only goes to things/);
  assert.equal(eje.saldoT('bea', 'hora', T0), 24);
  // Una cosa no emite su tiempo ni tiene asignación.
  await assert.rejects(eje.escribir({ autor: 'sala', sobre: alta.id, t: T0, payload: 'x', movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: null, a: 'sala' }, gasta('sala')] }), /only persons mint/);
  assert.equal(eje.saldoT('sala', 'minuto', T0), 0);
});

test('el génesis no emite T (VG, 8-11: no hay T acumulable): es la época 0 y el alta de su autor, que vive de su asignación del día', async () => {
  // Encargo 3b: el génesis no mueve nada; lo que su autor emite va después, por las reglas.
  await assert.rejects(Eje.genesis({ demostracion: true, identidad: 'raiz', emision: [{ token: 'T', escala: 'minuto', cantidad: 600 }], foco: 'g', t: T0 }),
    /nobody mints T/);
  // Puede no emitir nada: su autor es una persona y tiene ya su día.
  const vacio = await Eje.genesis({ demostracion: true, identidad: 'raiz', emision: [], foco: 'g', t: T0 });
  assert.deepEqual([vacio.esPersona('raiz'), vacio.alta('raiz'), vacio.saldoT('raiz', 'minuto', T0)], [true, { id: vacio.genesisId, t: T0 }, 1440]);
  assert.deepEqual(vacio.obtener(vacio.genesisId).movimientos, []);
  const { eje, g } = await mundo({ t: T0 });
  assert.equal(eje.serie('T:minuto').emitido, 0);
  assert.deepEqual(eje.alta('raiz'), { id: g, t: T0 });
  // Su emisión, sus dos invitaciones y las altas gastaron cuatro minutos de la asignación del día; no hay T explícito.
  assert.equal(eje.saldo('raiz', 'T:minuto'), 0);
  assert.equal(eje.saldoT('raiz', 'minuto', T0), 1436);
  await assert.rejects(eje.escribir({ autor: 'raiz', sobre: g, t: T0, payload: 'mi minuto', movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: null, a: 'raiz' }, gasta('raiz')] }), /nobody mints T/);
  assert.equal(eje.serie('T:minuto').emisor, 'raiz'); // en T, quien la consumió primero: la raíz, en su emisión
});

test('T no se bloquea ni se libera (VG, 8-11: no hay T acumulable): bloquear sigue para E, P y R', async () => {
  const { eje, alta } = await mundo({ t: T0 });
  const bloqueaT = (de) => ({ ...gasta(de), a: de, estado: 'bloqueo', salida: 's' });
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'x', movimientos: [gasta('ana'), bloqueaT('ana')] }), /T is not locked/);
  // Tampoco una cosa, que sí conserva el T que le dio su persona.
  await eje.escribir({ autor: 'raiz', sobre: alta.id, t: T0, payload: 'T para la sala', movimientos: [gasta('raiz'), daT('raiz', 'sala', 5)] });
  await assert.rejects(eje.escribir({ autor: 'sala', sobre: alta.id, t: T0, payload: 'x', movimientos: [gasta('sala'), bloqueaT('sala')] }), /T is not locked/);
  assert.equal(eje.saldoT('sala', 'minuto', T0), 5);
  // R sí se bloquea (con una salida cualquiera; el colateral de R6 se retiró: VG, 9-11).
  await eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'mi R', movimientos: [gasta('ana'), emiteR('ana', 10), { ...mueveR('ana', 1, 'ana', 'ana'), estado: 'bloqueo', salida: 'mañana' }] });
  assert.equal(eje.bloqueado('ana', 'R:ana', 'mañana'), 1);
});

// ---------- 3 · emisión escalonada (VG, 8-11 tarde, mapa §15 [D] N3: R exige T, E exige P y R) ----------

test('escalonado: emitir R exige T real del autor en la misma transacción («minting R needs real T»)', async () => {
  const { eje, alta } = await mundo();
  // Pagar la escritura con T informativo vale, pero no cuenta para emitir R.
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'x', movimientos: [deMemoria('ana'), emiteR('ana', 1)] }), /minting R needs real T: ana mints R without burning real T/);
  await eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'de memoria', movimientos: [deMemoria('ana')] });
  // Con un minuto real, sí; y sin colateral (VG, 9-11: se retira el colateral de la #75).
  await eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'mi R', movimientos: [gasta('ana'), emiteR('ana', 1)] });
  assert.deepEqual(eje.serie('R:ana'), { emisor: 'ana', emitido: 1 });
  // T que no cuesta nada (dárselo a sí misma, bloquearlo y liberarlo) no paga la escritura: lo rechaza la forma.
  const salida = 'cuando quiera';
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'x', movimientos: [daT('ana', 'ana', 1), emiteR('ana', 1)] }), /escribir consume T del autor/);
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'x', movimientos: [
    { ...daT('ana', 'ana', 1), estado: 'bloqueo', salida }, { ...daT('ana', 'ana', 1), estado: 'liberacion', salida }, emiteR('ana', 1)] }), /escribir consume T del autor/);
  // La validez lo dice igual.
  const v = await validez(eje, await crearEvento({ autor: 'bea', sobre: alta.id, t: T0, payload: 'x', movimientos: [deMemoria('bea'), emiteR('bea', 1)] }));
  assert.match(v.permiso.motivos.join(' '), /minting R needs real T/);
});

// VG, 8-11 (mapa §15 [D] «P como peso de criterio»): se retira «el autor de X acuña P:X» y el P del génesis; nadie emite P
// a mano: se obtiene (N1, N2) y se reposiciona por el árbol. Lo de R6 («emitir P exige R propia en juego») cae con él.
test('P no se acuña a mano: escribir un registro da diez P sobre él; quien solo tiene P lo transfiere', async () => {
  const { eje } = await mundo();
  const reg = await taller(eje, 'ana');
  assert.equal(eje.poderSobre('ana', reg.id), 10);
  const aMano = /P is repositioned one step at a time/;
  // Ni sobre un registro propio, ni sobre uno ajeno, ni sobre todo el eje.
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: reg.id, t: T0, payload: 'x', movimientos: [gasta('ana'), emiteP('ana', reg.id)] }), aMano);
  await assert.rejects(eje.escribir({ autor: 'bea', sobre: reg.id, t: T0, payload: 'x', movimientos: [gasta('bea'), emiteP('bea', reg.id)] }), aMano);
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: reg.id, t: T0, payload: 'x', movimientos: [gasta('ana'), emiteP('ana', 'genesis')] }), /P moves within a known scope/);
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: reg.id, t: T0, payload: 'x', movimientos: [gasta('ana'), emiteP('ana', 'f'.repeat(64))] }), /P moves within a known scope/);
  // Ana delega P en bea; bea transfiere el que tiene, conservando la cantidad y su origen (ana), y no más.
  await eje.escribir({ autor: 'ana', sobre: reg.id, t: T0, payload: 'bea ayuda', movimientos: [gasta('ana'), { token: 'P', ambito: reg.id, cantidad: 1, de: 'ana', a: 'bea' }] });
  await assert.rejects(eje.escribir({ autor: 'bea', sobre: reg.id, t: T0, payload: 'x', movimientos: [gasta('bea'), { token: 'P', ambito: reg.id, origen: 'ana', cantidad: 2, de: 'bea', a: 'raiz' }] }), /saldo insuficiente de P/);
  // Sin decir el origen, bea movería P suyo, que no tiene (encargo 3b-bis).
  await assert.rejects(eje.escribir({ autor: 'bea', sobre: reg.id, t: T0, payload: 'x', movimientos: [gasta('bea'), { token: 'P', ambito: reg.id, cantidad: 1, de: 'bea', a: 'raiz' }] }), /saldo insuficiente de P/);
  await eje.escribir({ autor: 'bea', sobre: reg.id, t: T0, payload: 'bea delega', movimientos: [gasta('bea'), { token: 'P', ambito: reg.id, origen: 'ana', cantidad: 1, de: 'bea', a: 'raiz' }] });
  assert.deepEqual([eje.poderSobre('raiz', reg.id), eje.poderSobre('bea', reg.id), eje.poderSobre('ana', reg.id), eje.poderSobre('raiz', reg.id, 'ana')], [1, 0, 9, 1]);
});

test('escalonado: emitir E exige P de quien acuña sobre el registro de la serie y R propia emitida (D2), sin colateral', async () => {
  const { eje, alta } = await mundo();
  const reg = await taller(eje, 'ana');
  // Con todo: sobre el taller, donde tiene P, y con su R emitida.
  await eje.escribir({ autor: 'ana', sobre: reg.id, t: T0, payload: 'clases', movimientos: [gasta('ana'), emiteE('ana', 'clase', 3, { registro: reg.id })] });
  assert.equal(eje.saldo('ana', 'E:ana/clase@' + reg.id), 3);
  // Sin R propia emitida, no: bea tiene P delegado sobre el taller, pero no ha emitido R.
  await eje.escribir({ autor: 'ana', sobre: reg.id, t: T0, payload: 'bea ayuda', movimientos: [gasta('ana'), { token: 'P', ambito: reg.id, cantidad: 1, de: 'ana', a: 'bea' }] });
  await assert.rejects(eje.escribir({ autor: 'bea', sobre: reg.id, t: T0, payload: 'x', movimientos: [gasta('bea'), emiteE('bea', 'clase', 1, { registro: reg.id })] }), /minting E needs own R issued: bea mints E and has never issued R of its own/);
  // Atada a las altas de la raíz, donde ana no tiene P: no.
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: reg.id, t: T0, payload: 'x', movimientos: [gasta('ana'), emiteE('ana', 'clase', 1, { registro: alta.id })] }),
    /minting E needs P on its record: ana mints E on a record where it has no P/);
  // Sin registro nombrado, la serie va atada a su alta, donde tiene P por escribirla.
  await eje.escribir({ autor: 'ana', sobre: reg.id, t: T0, payload: 'bonos', movimientos: [gasta('ana'), emiteE('ana', 'bono', 1)] });
  assert.equal(eje.registroDe('E:ana/bono'), eje.alta('ana').id);
  // El escalonado se cuenta en validez igual que en el eje.
  const borrador = await crearEvento({ autor: 'bea', sobre: reg.id, t: T0, payload: 'x', movimientos: [gasta('bea'), emiteE('bea', 'clase', 1, { registro: reg.id })] });
  const v = await validez(eje, borrador);
  assert.equal(v.permiso.estado, 'falla');
  assert.match(v.permiso.motivos.join(' '), /minting E needs own R issued/);
});

// ---------- 4 · bloquear y liberar ----------

test('movimiento con estado: bloqueo y liberacion exigen el mismo titular y una salida', () => {
  const base = { token: 'T', escala: 'minuto', cantidad: 1, de: 'ana', a: 'ana' };
  assert.deepEqual(validarMovimiento({ ...base, estado: 'bloqueo', salida: 'cuando bea confirme' }), []);
  assert.deepEqual(validarMovimiento({ ...base, estado: 'liberacion', salida: 'cuando bea confirme' }), []);
  // La salida es DECLARADA, no verificable todavía ([X] decidir VG qué la hace verificable).
  assert.ok(validarMovimiento({ ...base, estado: 'bloqueo' }).some((e) => /bloqueo exige salida: la condición de liberación, declarada \(no verificable todavía\)/.test(e)));
  assert.ok(validarMovimiento({ ...base, estado: 'bloqueo', salida: '' }).some((e) => /bloqueo exige salida/.test(e)));
  assert.ok(validarMovimiento({ ...base, a: 'bea', estado: 'bloqueo', salida: 's' }).some((e) => /de y a son el mismo titular/.test(e)));
  assert.ok(validarMovimiento({ ...base, de: null, estado: 'liberacion', salida: 's' }).some((e) => /de y a son el mismo titular/.test(e)));
  assert.ok(validarMovimiento({ ...base, estado: 'bloqueado', salida: 's' }).some((e) => /estado inválido: bloqueado/.test(e)));
  assert.ok(validarMovimiento({ ...base, a: null, salida: 's' }).some((e) => /salida solo con estado/.test(e)));
});

test('bloquear y liberar: del disponible al bloqueado con su salida, y vuelta; solo se gasta lo disponible', async () => {
  // Con E: los 60 minutos que la raíz cedió a ana (E:raiz/minuto). T ya no se bloquea para escribir: se consume
  // (VG, 7-11 noche), y bloquearlo no cuenta como escribir.
  const { eje, alta } = await mundo();
  const salida = 'cuando bea confirme la reserva del 13-11';
  const K = 'E:raiz/minuto';
  const bloqueo = (cantidad, s = salida) => ({ ...cedeT('ana', 'ana', cantidad, 'raiz'), estado: 'bloqueo', salida: s });
  const liberacion = (cantidad, s = salida) => ({ ...bloqueo(cantidad, s), estado: 'liberacion' });
  const ev = await eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'reservo mi tiempo', movimientos: [gasta('ana'), bloqueo(10)] });
  assert.equal(eje.saldo('ana', K), 50); // 60 − 10: el saldo es lo disponible
  assert.equal(eje.bloqueado('ana', K), 10);
  assert.equal(eje.bloqueado('ana', K, salida), 10);
  assert.deepEqual(eje.bloqueos('ana'), [{ clave: K, token: 'E', serie: 'raiz/minuto', emisor: 'raiz', denominacion: 'minuto', salida, cantidad: 10 }]);
  assert.equal(eje.series().find((s) => s.clave === K).bloqueado, 10);
  assert.deepEqual(eje.recursos('ana'), [{ emisor: 'raiz', denominacion: 'minuto', cantidad: 50 }]);
  assert.deepEqual((await validez(eje, ev.id)).capas.map((c) => c.estado), ['ok', 'ok', 'ok', 'ok', 'ok']);
  // Consumir o transferir sale solo del disponible.
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'x', movimientos: [gasta('ana'), cedeT('ana', 'bea', 51, 'raiz')] }), /saldo insuficiente de E:raiz\/minuto en ana/);
  const gastoBloqueado = await crearEvento({ autor: 'ana', sobre: alta.id, t: T0, payload: 'x', movimientos: [gasta('ana'), cedeT('ana', 'bea', 51, 'raiz')] });
  assert.equal((await validez(eje, gastoBloqueado)).acreditacion.estado, 'falla');
  // No se bloquea lo que no está disponible, ni se bloquea lo ajeno.
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'x', movimientos: [gasta('ana'), bloqueo(51)] }), /saldo disponible insuficiente para bloquear E:raiz\/minuto en ana/);
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'x', movimientos: [gasta('ana'), { ...bloqueo(1), de: 'bea', a: 'bea' }] }), /nobody moves tokens of others/);
  await assert.rejects(crearEvento({ autor: 'ana', sobre: alta.id, t: T0, payload: 'x', movimientos: [gasta('ana'), { ...bloqueo(1), salida: undefined }] }), /bloqueo exige salida/);
  // Liberar exige la misma salida y no más de lo bloqueado con ella.
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'x', movimientos: [gasta('ana'), liberacion(5, 'otra cosa')] }), /no hay 5 de E:raiz\/minuto bloqueado en ana con la salida «otra cosa»/);
  await eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'bea confirmó en parte', movimientos: [gasta('ana'), liberacion(4)] });
  assert.deepEqual([eje.saldo('ana', K), eje.bloqueado('ana', K)], [54, 6]);
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'x', movimientos: [gasta('ana'), liberacion(7)] }), /no hay 7 de E:raiz\/minuto bloqueado/);
  // Restaurar rehace lo bloqueado desde los eventos.
  const otro = await restaurar(JSON.parse(JSON.stringify(serializar(eje))));
  assert.equal(otro.bloqueado('ana', K, salida), 6);
  assert.deepEqual(otro.series(), eje.series());
  assert.deepEqual(otro.bloqueos('ana'), eje.bloqueos('ana'));
});

// ---------- 5 · R: obligación del emisor, transferible y quemable (VG, 9-11, mapa §15 [D] «R según el corpus») ----------

test('R: la obligación del emisor es su R en manos ajenas; se pasa entre tenedores, se devuelve (pedir atención) y se perdona (quemar)', async () => {
  const { eje, alta } = await mundo();
  await eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'mi reputación', movimientos: [gasta('ana'), emiteR('ana', 5)] });
  assert.equal(eje.obligaciones('ana'), 0); // en su cartera no obliga a nada
  await eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'confío en bea', movimientos: [gasta('ana'), mueveR('ana', 2, 'ana', 'bea')] });
  assert.equal(eje.obligaciones('ana'), 2);
  // Bea la pasa a la sala (se corrige la #62: sin sustituir al emisor); la obligación de ana no cambia.
  await eje.escribir({ autor: 'bea', sobre: alta.id, t: T0, payload: 'una para la sala', movimientos: [gasta('bea'), mueveR('ana', 1, 'bea', 'sala')] });
  assert.deepEqual([eje.saldo('bea', 'R:ana'), eje.saldo('sala', 'R:ana'), eje.obligaciones('ana')], [1, 1, 2]);
  // Un mensaje no emite R: escribir solo mueve T.
  await eje.escribir({ autor: 'bea', sobre: alta.id, t: T0, payload: 'ana, ¿me atiendes?', movimientos: [gasta('bea')] });
  assert.equal(eje.serie('R:ana').emitido, 5);
  // Pedir atención: bea le devuelve su R a ana. La obligación baja.
  await eje.escribir({ autor: 'bea', sobre: alta.id, t: T0, payload: 'te pido atención', movimientos: [gasta('bea'), mueveR('ana', 1, 'bea', 'ana')] });
  assert.equal(eje.obligaciones('ana'), 1);
  // Perdonar (VG, 9-11, «R, últimas dos»): la sala (una cosa: escribe con el T que le da la raíz) quema la suya sin
  // devolverla; la obligación se extingue.
  await eje.escribir({ autor: 'raiz', sobre: alta.id, t: T0, payload: 'T para la sala', movimientos: [gasta('raiz'), daT('raiz', 'sala', 5)] });
  await eje.escribir({ autor: 'sala', sobre: alta.id, t: T0, payload: 'te la perdono', movimientos: [gasta('sala'), mueveR('ana', 1, 'sala', null)] });
  assert.equal(eje.obligaciones('ana'), 0);
  assert.deepEqual([eje.saldo('ana', 'R:ana'), eje.saldo('bea', 'R:ana')], [4, 0]);
  // El emisor también puede consumir la suya.
  await eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'retiro una', movimientos: [gasta('ana'), mueveR('ana', 1, 'ana', null)] });
  assert.equal(eje.saldo('ana', 'R:ana'), 3);
  assert.deepEqual(validarMovimiento(mueveR('ana', 1, 'bea', 'sala')), []);
});

// ---------- 6 · caducidad de E ----------

test('caducidad: un campo del contrato de la serie de E, que fija su primera emisión y nada ejecuta solo', async () => {
  const { eje } = await mundo();
  const reg = await taller(eje, 'ana');
  const caduca = '2026-11-30T00:00:00Z';
  const emite = (extra, payload = 'bonos') => eje.escribir({ autor: 'ana', sobre: reg.id, t: T0, payload, movimientos: [gasta('ana'), mueveR('ana', 1, 'ana', 'bea'), emiteE('ana', 'bono', 2, extra)] });
  await emite({ caduca });
  assert.deepEqual(eje.serie('E:ana/bono'), { emisor: 'ana', emitido: 2, caduca });
  assert.equal(eje.series().find((s) => s.clave === 'E:ana/bono').caduca, caduca);
  // Las ampliaciones coinciden: ni sin caducidad ni con otra.
  await assert.rejects(emite({}), /la serie E:ana\/bono caduca el 2026-11-30T00:00:00Z: una ampliación no cambia su caducidad/);
  await assert.rejects(emite({ caduca: '2026-12-31T00:00:00Z' }), /una ampliación no cambia su caducidad/);
  await emite({ caduca }, 'más bonos');
  assert.equal(eje.serie('E:ana/bono').emitido, 4);
  // Se compara el instante, no el texto (revisión, m3): el mismo instante escrito de otra forma coincide.
  await emite({ caduca: '2026-11-30T01:00:00+01:00' }, 'bonos, con la caducidad en hora de Madrid');
  assert.equal(eje.serie('E:ana/bono').emitido, 6);
  assert.equal(eje.serie('E:ana/bono').caduca, caduca); // la de la primera emisión
  // Una serie sin caducidad no la gana después.
  await eje.escribir({ autor: 'ana', sobre: reg.id, t: T0, payload: 'clases', movimientos: [gasta('ana'), mueveR('ana', 1, 'ana', 'bea'), emiteE('ana', 'clase', 1)] });
  assert.equal(eje.series().find((s) => s.clave === 'E:ana/clase').caduca, null);
  assert.deepEqual(eje.serie('E:ana/clase'), { emisor: 'ana', emitido: 1 });
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: reg.id, t: T0, payload: 'x', movimientos: [gasta('ana'), mueveR('ana', 1, 'ana', 'bea'), emiteE('ana', 'clase', 1, { caduca })] }), /la serie E:ana\/clase no caduca: una ampliación no cambia su caducidad/);
  // caducada() solo lee.
  assert.equal(caducada(eje, 'E:ana/bono', '2026-11-29T23:59:59Z'), false);
  assert.equal(caducada(eje, 'E:ana/bono', caduca), true);
  assert.equal(caducada(eje, 'E:ana/clase', '2030-01-01T00:00:00Z'), false);
  assert.equal(caducada(eje, 'T:minuto', '2030-01-01T00:00:00Z'), false);
  assert.throws(() => caducada(eje, 'E:ana/bono', 'mañana'), /t debe ser instante ISO/);
  // Nada se ejecuta solo: caducada la serie, sus tokens se siguen moviendo.
  await eje.escribir({ autor: 'ana', sobre: reg.id, t: '2026-12-01T10:00:00Z', payload: 'un bono para bea', movimientos: [gasta('ana'), mueveE('ana', 'bono', 1, 'ana', 'bea')] });
  assert.equal(eje.saldo('bea', 'E:ana/bono'), 1);
  // caduca solo va en la emisión de E, y es un instante.
  assert.ok(validarMovimiento({ ...mueveE('ana', 'bono', 1, 'ana', 'bea'), caduca }).some((e) => /caduca solo en la emisión de E/.test(e)));
  assert.ok(validarMovimiento({ ...emiteR('ana', 1), caduca }).some((e) => /caduca solo en la emisión de E/.test(e)));
  assert.ok(validarMovimiento(emiteE('ana', 'bono', 1, { caduca: 'el mes que viene' })).some((e) => /caduca debe ser instante ISO/.test(e)));
});

// ---------- 7 · el ciclo completo ----------

test('ciclo completo: T → R → P → E y E → P → R → T (liquidación)', async () => {
  const { eje, alta } = await mundo();
  const mediodia = '2026-11-07T12:00:00Z';
  // T: ana y bea tienen su asignación del día (VG, 8-11): no emiten nada.
  // T + R: ana respalda su reputación (sin colateral: VG, 9-11).
  const rep = await eje.escribir({ autor: 'ana', sobre: alta.id, t: mediodia, payload: 'mi reputación', movimientos: [gasta('ana'), emiteR('ana', 10)] });
  // T + R + P: escribe su taller (diez P sobre él: mapa §15 [D] N1) y cede un R a bea para que pueda requerir su atención.
  const tallerAna = await eje.escribir({ autor: 'ana', sobre: rep.id, t: mediodia, payload: 'Taller de cerámica', movimientos: [gasta('ana')] });
  await eje.escribir({ autor: 'ana', sobre: tallerAna.id, t: mediodia, payload: 'decido sobre mi taller', movimientos: [gasta('ana'), mueveR('ana', 1, 'ana', 'bea')] });
  // T + R + P + E: respalda tres plazas de clase, que caducan a fin de mes.
  await eje.escribir({ autor: 'ana', sobre: tallerAna.id, t: mediodia, payload: 'tres plazas de clase',
    movimientos: [gasta('ana'), mueveR('ana', 1, 'ana', 'bea'), emiteE('ana', 'clase', 3, { caduca: '2026-11-30T00:00:00Z' })] });
  assert.deepEqual([eje.saldo('ana', 'E:ana/clase'), eje.poderSobre('ana', tallerAna.id), eje.obligaciones('ana')], [3, 10, 2]);

  // Vuelta. E: bea toma una plaza y paga con tiempo. T no cruza de persona (VG, 7-11 noche: «recibir T solo es un
  // registro de una cantidad de tiempo; podemos hacer que se transforme en E»): paga con E en minutos, los que la
  // raíz le cedió (E:raiz/minuto), y su T:hora se queda con ella.
  await eje.escribir({ autor: 'ana', sobre: tallerAna.id, t: mediodia, payload: 'plaza para bea', movimientos: [gasta('ana'), mueveE('ana', 'clase', 1, 'ana', 'bea')] });
  await assert.rejects(eje.escribir({ autor: 'bea', sobre: tallerAna.id, t: mediodia, payload: 'pago la plaza', movimientos: [gasta('bea'), { token: 'T', escala: 'hora', cantidad: 1, de: 'bea', a: 'ana' }] }), /T only goes to things/);
  await eje.escribir({ autor: 'bea', sobre: tallerAna.id, t: mediodia, payload: 'pago la plaza', movimientos: [gasta('bea'), cedeT('bea', 'ana', 30, 'raiz')] });
  assert.deepEqual([eje.saldoT('ana', 'hora', mediodia), eje.saldoT('bea', 'hora', mediodia)], [24, 24]);
  assert.deepEqual([eje.saldo('ana', 'E:raiz/minuto'), eje.saldo('bea', 'E:raiz/minuto')], [90, 30]);
  // Bea bloquea su plaza hasta la clase, la libera cuando se da y la consume.
  const salida = 'clase del jueves 12-11 impartida';
  await eje.escribir({ autor: 'bea', sobre: tallerAna.id, t: mediodia, payload: 'reservo la plaza', movimientos: [gasta('bea'), { ...mueveE('ana', 'clase', 1, 'bea', 'bea'), estado: 'bloqueo', salida }] });
  assert.deepEqual([eje.saldo('bea', 'E:ana/clase'), eje.bloqueado('bea', 'E:ana/clase')], [0, 1]);
  await eje.escribir({ autor: 'bea', sobre: tallerAna.id, t: '2026-11-12T19:00:00Z', payload: 'clase recibida',
    movimientos: [gasta('bea'), { ...mueveE('ana', 'clase', 1, 'bea', 'bea'), estado: 'liberacion', salida }, mueveE('ana', 'clase', 1, 'bea', null)] });
  assert.deepEqual([eje.saldo('bea', 'E:ana/clase'), eje.bloqueado('bea', 'E:ana/clase')], [0, 0]);
  // P: ana delega en bea poder sobre su taller (los criterios de ese recurso).
  await eje.escribir({ autor: 'ana', sobre: tallerAna.id, t: '2026-11-12T20:00:00Z', payload: 'bea opina sobre las clases', movimientos: [gasta('ana'), { token: 'P', ambito: tallerAna.id, cantidad: 1, de: 'ana', a: 'bea' }] });
  assert.equal(eje.poderSobre('bea', tallerAna.id), 1);
  // R: bea devuelve sus dos R a ana para pedirle atención; la obligación de ana vuelve a cero.
  await eje.escribir({ autor: 'bea', sobre: tallerAna.id, t: '2026-11-12T20:30:00Z', payload: 'te pido atención', movimientos: [gasta('bea'), mueveR('ana', 2, 'bea', 'ana')] });
  assert.equal(eje.obligaciones('ana'), 0);
  // El eje entero se restaura igual.
  const otro = await restaurar(JSON.parse(JSON.stringify(serializar(eje))));
  assert.deepEqual(otro.series(), eje.series());
  assert.equal(otro.obligaciones('ana'), 0);
});

// ---------- 8 · bloquear P ----------

test('bloquear P: de la clave exacta, solo lo disponible y propio; bloqueado con la salida = una decisión, es comprometerse (mapa §15 [D] (5))', async () => {
  const { eje } = await mundo();
  const reg = await taller(eje, 'ana');
  const salida = 'hasta que bea entregue el inventario';
  const bloqueoP = (de, cantidad, s = salida) => ({ token: 'P', ambito: reg.id, cantidad, de, a: de, estado: 'bloqueo', salida: s });
  // La raíz no tiene P sobre el taller de ana (ya no hay P del génesis que lo cubra).
  assert.equal(eje.poderSobre('raiz', reg.id), 0);
  await assert.rejects(eje.escribir({ autor: 'raiz', sobre: reg.id, t: T0, payload: 'x', movimientos: [gasta('raiz'), bloqueoP('raiz', 1)] }),
    /saldo disponible insuficiente para bloquear P:[0-9a-f]{64}\/raiz en raiz/);
  // Ni más de lo que tiene, ni lo de otra.
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: reg.id, t: T0, payload: 'x', movimientos: [gasta('ana'), bloqueoP('ana', 11)] }), /saldo disponible insuficiente para bloquear/);
  await assert.rejects(eje.escribir({ autor: 'bea', sobre: reg.id, t: T0, payload: 'x', movimientos: [gasta('bea'), bloqueoP('ana', 1)] }), /nobody moves tokens of others/);
  // Bloqueado, el P sigue posicionado allí, pero no se da hasta liberarlo.
  await eje.escribir({ autor: 'ana', sobre: reg.id, t: T0, payload: 'reservo mi poder', movimientos: [gasta('ana'), bloqueoP('ana', 10)] });
  assert.deepEqual([eje.saldo('ana', 'P:' + reg.id + '/ana'), eje.bloqueado('ana', 'P:' + reg.id + '/ana', salida), eje.poderSobre('ana', reg.id)], [0, 10, 10]);
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: reg.id, t: T0, payload: 'x', movimientos: [gasta('ana'), { token: 'P', ambito: reg.id, cantidad: 1, de: 'ana', a: 'bea' }] }), /saldo insuficiente de P/);
  // Liberar exige la misma salida (declarada, no verificable todavía: [X] decidir VG).
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: reg.id, t: T0, payload: 'x', movimientos: [gasta('ana'), { ...bloqueoP('ana', 1, 'otra'), estado: 'liberacion' }] }), /no hay 1 de P:[0-9a-f]{64}\/ana bloqueado en ana con la salida «otra»/);
  await eje.escribir({ autor: 'ana', sobre: reg.id, t: T0, payload: 'inventario entregado', movimientos: [gasta('ana'), { ...bloqueoP('ana', 10), estado: 'liberacion' }] });
  // Comprometerse con una decisión (sobre su taller, con su criterio por defecto: solo cuenta la dueña) es bloquear con su id.
  const decision = await eje.escribir({ autor: 'ana', sobre: reg.id, t: T0, payload: '¿abro los sábados?', movimientos: [gasta('ana')] });
  assert.equal(recuento(eje, decision.id).pasa, false);
  await eje.escribir({ autor: 'ana', sobre: decision.id, t: T0, payload: 'sí', movimientos: [gasta('ana'), bloqueoP('ana', 5, decision.id)] });
  assert.equal(recuento(eje, decision.id).pasa, true);
});

// ---------- 9 · el reloj: ningún evento antes que su foco ni que el alta de su autor ----------

test('el t de un evento no es anterior al de su foco ni al alta de su autor ([X] confirmar VG)', async () => {
  const { eje, alta } = await mundo();
  const tarde = '2026-11-07T11:00:00Z';
  const nota = await eje.escribir({ autor: 'ana', sobre: alta.id, t: tarde, payload: 'nota', movimientos: [gasta('ana')] });
  // Sobre la nota (11:00), a las 10:30, no.
  await assert.rejects(eje.escribir({ autor: 'bea', sobre: nota.id, t: '2026-11-07T10:30:00Z', payload: 'x', movimientos: [gasta('bea')] }),
    /not before its focus/);
  // El alta toma el t del evento que la hace: cris entra a las 11:00 y no escribe antes, ni sobre un foco más antiguo.
  // Encargo 3b: la persona escribe su propia alta aceptando la invitación de la raíz.
  await entrarPorInvitacion(eje, { por: 'raiz', quien: 'cris', t: tarde });
  await eje.escribir({ autor: 'raiz', sobre: alta.id, t: tarde, payload: 'alta de cris', movimientos: [gasta('raiz'), cedeT('raiz', 'cris', 10)] });
  assert.equal(eje.alta('cris').t, tarde);
  await assert.rejects(eje.escribir({ autor: 'cris', sobre: alta.id, t: '2026-11-07T10:30:00Z', payload: 'x', movimientos: [gasta('cris')] }),
    /not before the writer joined: cris writes at 2026-11-07T10:30:00Z, before joining \(2026-11-07T11:00:00Z\)/);
  // El mismo instante sí vale, y después también.
  await eje.escribir({ autor: 'cris', sobre: alta.id, t: tarde, payload: 'hola', movimientos: [gasta('cris')] });
  // validez lo dice en la capa 4, como el eje.
  const borrador = await crearEvento({ autor: 'bea', sobre: nota.id, t: '2026-11-07T10:30:00Z', payload: 'x', movimientos: [gasta('bea')] });
  const v = await validez(eje, borrador);
  assert.equal(v.acreditacion.estado, 'falla');
  assert.match(v.acreditacion.motivos.join(' '), /not before its focus/);
});

test('el reloj por arriba: un evento no va más de un año (anio) por delante del mayor t del eje ([X] confirmar VG)', async () => {
  // Revisión de seguridad: fechar a futuro inflaba el tope de T. Sin reloj externo, se acota con lo que hay en el eje.
  const { eje, alta } = await mundo({ t: T0 });
  assert.equal(ADELANTO_MAXIMO_MS, 365 * 86400 * 1000);
  assert.equal(eje.tMaximo(), msUTC(T0));
  const limite = new Date(msUTC(T0) + ADELANTO_MAXIMO_MS).toISOString();
  const pasado = new Date(msUTC(T0) + ADELANTO_MAXIMO_MS + 1000).toISOString();
  // Un segundo de más: rechazado, también para emitir T, y validez lo dice en la capa 4.
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: alta.id, t: pasado, payload: 'x', movimientos: [gasta('ana')] }),
    /at most a year ahead/);
  const v = await validez(eje, await crearEvento({ autor: 'ana', sobre: alta.id, t: pasado, payload: 'x', movimientos: [gasta('ana')] }));
  assert.match(v.acreditacion.motivos.join(' '), /at most a year ahead: 2027-11-07T10:00:01.000Z is more than a year after/);
  // Justo en el límite, sí; y el límite avanza con el mayor t aceptado.
  await eje.escribir({ autor: 'ana', sobre: alta.id, t: limite, payload: 'dentro de un año', movimientos: [gasta('ana')] });
  assert.equal(eje.tMaximo(), msUTC(limite));
  await eje.escribir({ autor: 'bea', sobre: alta.id, t: pasado, payload: 'ya cabe', movimientos: [gasta('bea')] });
});

test('t es un instante ISO-8601 estricto con zona explícita, y se compara en UTC', async () => {
  // Revisión de seguridad: Date.parse es laxo y depende del motor.
  for (const malo of ['2026-11-07', '2026-11-07 10:00', '2026-11-07T10:00:00', '2026-11-07T10:00', '2026-02-30T10:00:00Z', '2026-11-07T24:00:00Z',
    '2026-11-07T10:00:00.1234Z', '2026-11-07T10:00:00+0100', 'Sat, 07 Nov 2026 10:00:00 GMT', 'mañana']) {
    assert.equal(esInstante(malo), false, malo);
    await assert.rejects(crearEvento({ autor: 'raiz', sobre: null, t: malo, payload: 'g', movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: null, a: 'raiz' }], contexto: { genesis: true } }),
      /t debe ser instante ISO-8601 con zona explícita/, malo);
  }
  for (const bueno of ['2026-11-07T10:00:00Z', '2026-11-07T10:00Z', '2026-11-07T10:00:00.5Z', '2026-11-07T11:00:00+01:00', '2024-02-29T00:00:00-05:30']) assert.equal(esInstante(bueno), true, bueno);
  assert.equal(msUTC('2026-11-07T11:00:00+01:00'), msUTC('2026-11-07T10:00:00Z'));
  assert.equal(msUTC('2026-11-07T10:00:00.5Z') - msUTC('2026-11-07T10:00:00Z'), 500);
  // Comparar en UTC: las 10:20 en Madrid (+01:00) son las 9:20 UTC, antes que un foco de las 10:00 UTC.
  const { eje, alta } = await mundo({ t: T0 });
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: alta.id, t: '2026-11-07T10:20:00+01:00', payload: 'x', movimientos: [gasta('ana')] }), /not before its focus/);
  await eje.escribir({ autor: 'ana', sobre: alta.id, t: '2026-11-07T11:20:00+01:00', payload: 'bien', movimientos: [gasta('ana')] });
  // Y la caducidad, igual de estricta (caducada() también: ver la prueba de la caducidad).
  assert.ok(validarMovimiento(emiteE('ana', 'bono', 1, { caduca: '2026-11-30' })).some((e) => /caduca debe ser instante ISO-8601 con zona explícita/.test(e)));
});

// ---------- 10 · los cuatro ataques de la revisión adversarial (neutralidad ante identidades) ----------

/** Ana da de alta a un títere: una persona que controla ella. */
async function conTitere(eje, alta, { minutos = 10, t = T0 } = {}) {
  // Encargo 3b: ana invita al títere y él acepta (su alta: es una persona); después ana le cede minutos.
  await entrarPorInvitacion(eje, { por: 'ana', quien: 'titere', t });
  await eje.escribir({ autor: 'ana', sobre: alta.id, t, payload: 'minutos para un títere', movimientos: [gasta('ana'), cedeT('ana', 'titere', minutos, 'raiz')] });
}

test('NEU-01 (revisión de la #62) alta gratis: sigue abierta, la decide el estudio de neutralidad (PROVISIONAL [X])', async () => {
  // No se añade coste por alta (lo decide el estudio de neutralidad ante agrupación y división). Antes, el títere
  // emitía su mínimo de T en cada escala y se lo pasaba a ana. Con T que no cruza de persona (VG, 7-11 noche) el
  // alta gratis ya no da nada a nadie: el T del títere se queda en el títere, que es su medidor propio.
  const { eje, alta } = await mundo();
  await conTitere(eje, alta, { minutos: 1 });
  const antes = eje.saldoT('ana', 'minuto');
  // Con la asignación diaria (VG, 8-11) el títere tiene su día, como todos, y no se lo puede pasar a ana.
  await assert.rejects(eje.escribir({ autor: 'titere', sobre: alta.id, t: T0, payload: 'mi tiempo', movimientos: [gasta('titere'), daT('titere', 'ana', 2)] }), /T only goes to things/);
  await eje.escribir({ autor: 'titere', sobre: alta.id, t: T0, payload: 'mi tiempo', movimientos: [gasta('titere')] });
  assert.equal(eje.saldoT('ana', 'minuto'), antes); // ana no gana nada
  assert.equal(eje.saldoT('titere', 'minuto', T0), 1438); // su alta y «mi tiempo»
});

test('NEU-02 (revisión de la #62) alta retrofechada: cerrada, ningún evento es anterior a su foco ni al alta de su autor', async () => {
  const { eje, alta } = await mundo();
  // El ataque: dar de alta a un títere en un evento fechado en 1900 para que el reloj le diera ~4e9 T:segundo.
  const viejo = '1900-01-01T00:00:00Z';
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: alta.id, t: viejo, payload: 'alta antigua', movimientos: [gasta('ana'), cedeT('ana', 'titere', 1, 'raiz')] }),
    /not before its focus.*not before the writer joined: ana/);
  assert.equal(eje.alta('titere'), null);
  // Con el alta de hoy, el títere tiene su día y nada más (VG, 8-11), y tampoco escribe antes de su alta.
  await conTitere(eje, alta);
  await assert.rejects(eje.escribir({ autor: 'titere', sobre: alta.id, t: T0, payload: 'x', movimientos: [gasta('titere'), { token: 'T', escala: 'segundo', cantidad: 4e9, de: 'titere', a: null }] }),
    /writing burns today's T/);
  await assert.rejects(eje.escribir({ autor: 'titere', sobre: eje.genesisId, t: viejo, payload: 'x', movimientos: [gasta('titere')] }), /not before the writer joined: titere/);
});

// VG, 8-11 (mapa §15 [D] «P como peso de criterio»): se retira autorizar con umbral (autorizacion.js), el registro del
// recurso y la salvedad del autor. Lo que se conserva es la neutralidad: «solo cuenta el P de quien el dueño nombra,
// ponderado por él». El títere no cuenta en lo ajeno, y lo que ana hace en lo suyo es suyo. Encargo 3b-bis: lo que ana le
// pasa al títere sigue siendo de origen ana: el títere lo compromete diciendo su origen, y cuenta como de ana.
test('NEU-03 (revisión de la #62) el títere que decide: en el recuento de la raíz solo cuenta quien ella nombra', async () => {
  const { eje, alta } = await mundo();
  await conTitere(eje, alta, { minutos: 30, t: ALTA }); // un mes antes: el reloj del títere le da para escribir
  // En el dominio de la raíz (sus altas), ana escribe un registro suyo (diez P) y le pasa P al títere.
  const suyo = await eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'lo mío', movimientos: [gasta('ana')] });
  await eje.escribir({ autor: 'ana', sobre: suyo.id, t: T0, payload: 'para el títere', movimientos: [gasta('ana'), { token: 'P', ambito: suyo.id, cantidad: 5, de: 'ana', a: 'titere' }] });
  assert.equal(eje.poderSobre('titere', suyo.id), 5);
  // Una decisión de la raíz sobre sus altas, con su criterio: cuenta ella sola (por defecto) o a quien nombre.
  const decision = await eje.escribir({ autor: 'raiz', sobre: alta.id, t: T0, payload: ['¿Ampliamos?', ['x'], [['decidir'], ['x'], ['threshold'], ['raiz']]], movimientos: [gasta('raiz')] });
  for (const quien of ['ana', 'titere']) {
    await eje.escribir({ autor: quien, sobre: decision.id, t: T0, payload: 'sí', movimientos: [gasta(quien), { token: 'P', ambito: suyo.id, origen: 'ana', cantidad: 5, de: quien, a: quien, estado: 'bloqueo', salida: decision.id }] });
  }
  assert.deepEqual([recuento(eje, decision.id).valor, recuento(eje, decision.id).pasa], [0, false]);
  // Lo positivo: la raíz compromete su P sobre la decisión (diez, por escribirla).
  await eje.escribir({ autor: 'raiz', sobre: decision.id, t: T0, payload: 'sí', movimientos: [gasta('raiz'), { token: 'P', ambito: decision.id, cantidad: 10, de: 'raiz', a: 'raiz', estado: 'bloqueo', salida: decision.id }] });
  assert.equal(recuento(eje, decision.id).pasa, true);
  // En lo suyo, ana decide con su criterio: su propia decisión, sin lista, la cuenta a ella.
  const propia = await eje.escribir({ autor: 'ana', sobre: suyo.id, t: T0, payload: 'lo decido yo', movimientos: [gasta('ana')] });
  await eje.escribir({ autor: 'ana', sobre: propia.id, t: T0, payload: 'sí', movimientos: [gasta('ana'), { token: 'P', ambito: propia.id, cantidad: 10, de: 'ana', a: 'ana', estado: 'bloqueo', salida: propia.id }] });
  assert.equal(recuento(eje, propia.id).pasa, true);
});

test('NEU-04 (revisión de la #62) el delegado que acuña: quien solo tiene P lo transfiere; no lo acuña ni hay P del eje que estrechar', async () => {
  const { eje } = await mundo();
  const reg = await taller(eje, 'ana');
  const g = eje.genesisId;
  // La raíz delega en bea P sobre su génesis (el suyo, por escribirlo): es P sobre ese registro, no sobre todo el eje.
  await eje.escribir({ autor: 'raiz', sobre: g, t: T0, payload: 'bea ayuda', movimientos: [gasta('raiz'), { token: 'P', ambito: g, cantidad: 1, de: 'raiz', a: 'bea' }] });
  assert.equal(eje.poderSobre('bea', reg.id), 0);
  const aMano = /P is repositioned one step at a time/;
  // Acuñar con él, en ningún sitio.
  for (const ambito of [g, reg.id]) {
    await assert.rejects(eje.escribir({ autor: 'bea', sobre: reg.id, t: T0, payload: 'x', movimientos: [gasta('bea'), emiteR('bea', 2), emiteP('bea', ambito)] }), aMano);
  }
  await assert.rejects(eje.escribir({ autor: 'bea', sobre: reg.id, t: T0, payload: 'x', movimientos: [gasta('bea'), emiteP('bea', 'genesis')] }), /P moves within a known scope/);
  // «Estrechar» ya no existe (mapa §15 [D] N7: solo subir y bajar): el P del génesis no se transfiere como P del taller.
  await assert.rejects(eje.escribir({ autor: 'bea', sobre: reg.id, t: T0, payload: 'paso mi poder', movimientos: [gasta('bea'), { token: 'P', ambito: reg.id, cantidad: 1, de: 'bea', a: 'sala' }] }), /saldo insuficiente de P sobre/);
  // Reposicionar sí: bajar un paso, del génesis a las altas, deja una décima más.
  // (Bea ya tenía P sobre el génesis: el de la R y los minutos de la raíz que recibió, mapa §15 [D] N2.)
  const altas = eje.sobre(g).find((x) => x.payload === 'altas');
  const antes = eje.poderSobre('bea', g);
  // Sobre el registro de las altas: sobre el génesis (el alta de raiz) tendría el precio de su atención (revisión de
  // seguridad, encargo 3b).
  // P por mirada (encargo 3c-2a): el P propio de bea por la R y los minutos está en las miradas 3 y 1 del génesis; el que
  // baja un paso al registro de las altas es el que le delegó la raíz (de origen raiz, que se conserva).
  await eje.escribir({ autor: 'bea', sobre: altas.id, t: T0, payload: 'bajo', movimientos: [gasta('bea'), { token: 'P', ambito: g, origen: 'raiz', cantidad: 1, de: 'bea', a: null }, { ...emiteP('bea', altas.id, 1.1), origen: 'raiz' }] });
  assert.deepEqual([antes - eje.poderSobre('bea', g), eje.poderSobre('bea', altas.id)], [1, 1.1]);
});

// Se retiran «R3: P:X la emite una sola vez su autor; ampliarla es ejecutar una consolidación AUTORIZADA», SEG-01 y SEG-04
// (la ampliación de P por consolidación): VG, 8-11, mapa §15 [D] «Desaparece: el autor de X acuña P:X; P del génesis
// sobre todo el eje; el motor con autorizar/ejecutar como pasos». No hay serie P:X cerrada que ampliar: el P se obtiene
// al escribir, al conseguir E y al recibir R, y se reposiciona (src/ciclo.js ya no lleva PP-2, PP-3, PP-5 ni R3).

// ---------- SEG-02 (revisión de main 7-11 noche) ----------

test('SEG-02 (revisión de main 7-11 noche) un eje migrado de la versión 2 no es de demostración: la exención de clave vale solo en su prefijo', async () => {
  const g = await crearEvento({ autor: 'raiz', sobre: null, t: T0, payload: 'Viejo',
    movimientos: [{ token: 'T', escala: 'minuto', cantidad: 100, de: null, a: 'raiz' }, { token: 'E', emisor: 'raiz', denominacion: 'minuto', cantidad: 100, de: null, a: 'raiz' }], contexto: { genesis: true, tipos: { raiz: 'persona' } } });
  // La versión 2 daba T a otros (hoy T no cruza de persona: crearEvento ya no lo deja): se escribe sin crearEvento.
  const altaCuerpo = { autor: 'raiz', sobre: g.id, en: '0000000000', t: T0, payload: 'alta de ana sin clave',
    movimientos: [gasta('raiz'), daT('raiz', 'ana', 10)], contexto: { tipos: { ana: 'persona' } } };
  const alta = { ...altaCuerpo, id: await hash(canonico(cuerpo(altaCuerpo))) };
  const eje = await restaurar(JSON.parse(JSON.stringify({ version: 2, eventos: [g, alta] })));
  // El prefijo se restaura entero, sin claves.
  assert.deepEqual([eje.orden.length, eje.eventosV2, eje.demostracion], [2, 2, false]);
  for (const id of eje.orden) assert.equal((await validez(eje, id)).capas[2].estado, 'ok');
  // Lo nuevo, no: sin clave no se actúa (antes el eje entero pasaba por demostración).
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'nuevo', movimientos: [gasta('ana')] }), /without a key nobody acts: ana has no key/);
  await assert.rejects(eje.escribir({ autor: 'raiz', sobre: alta.id, t: T0, payload: 'nuevo', movimientos: [gasta('raiz')] }), /without a key nobody acts: raiz has no key/);
  // Ni dando de alta a otra con su clave sin prueba de posesión.
  const otra = await generarClaves();
  await assert.rejects(eje.escribir({ autor: 'raiz', sobre: alta.id, t: T0, payload: 'alta de bea', contexto: { claves: { bea: otra.publica } }, movimientos: [gasta('raiz'), cedeT('raiz', 'bea', 1)] }),
    /without a key nobody acts: raiz has no key/);
  // Con la bandera firmada en su génesis, sí es de demostración, venga de la versión que venga.
  const gDemo = await crearEvento({ autor: 'raiz', sobre: null, t: T0, payload: 'Viejo de demostración',
    movimientos: [{ token: 'T', escala: 'minuto', cantidad: 100, de: null, a: 'raiz' }], contexto: { genesis: true, demostracion: true, tipos: { raiz: 'persona' } } });
  const demo = await restaurar(JSON.parse(JSON.stringify({ version: 2, eventos: [gDemo] })));
  assert.equal(demo.demostracion, true);
  await demo.escribir({ autor: 'raiz', sobre: gDemo.id, t: T0, payload: 'nuevo', movimientos: [gasta('raiz')] });
});

// ---------- 11 · un eje de la versión 2 se restaura con sus reglas ----------

test('un eje de la versión 2 se restaura con las reglas de entonces; lo nuevo, con las de ahora', async () => {
  // Un eje v2 que las reglas nuevas rechazan: génesis de un grupo, E emitido fuera del génesis sin escalonado y un
  // evento fechado antes que su foco. Se escribe a mano, como lo guardó la versión 2. Ana entra con su clave (la
  // versión 2 ya las declaraba, sin prueba de posesión): un eje migrado no es de demostración (SEG-02), y lo nuevo
  // lo escribe quien tiene clave.
  const llaves = await generarClaves();
  const g = await crearEvento({ autor: 'club', sobre: null, t: T0, payload: 'Club',
    movimientos: [{ token: 'T', escala: 'minuto', cantidad: 100, de: null, a: 'club' }, { token: 'E', emisor: 'club', denominacion: 'vale', cantidad: 10, de: null, a: 'club' }],
    contexto: { genesis: true, tipos: { club: 'grupo' } } });
  // La versión 2 daba T a otros (hoy T no cruza de persona: crearEvento ya no lo deja): se escribe sin crearEvento.
  const viejoCuerpo = { autor: 'club', sobre: g.id, en: '0000000000', t: '2026-11-06T09:00:00Z', payload: 'más vales y un alta',
    movimientos: [gasta('club'), emiteE('club', 'vale', 5), daT('club', 'ana', 10)], contexto: { tipos: { ana: 'persona' }, claves: { ana: llaves.publica } } };
  const viejo = { ...viejoCuerpo, id: await hash(canonico(cuerpo(viejoCuerpo))) };
  // Y uno con un t que solo Date.parse lee (sin T ni zona), como admitía la versión 2: se escribe sin crearEvento.
  const laxoCuerpo = { autor: 'club', sobre: viejo.id, en: '0000000000', t: '2026-11-06 10:00', movimientos: [gasta('club')], payload: 'nota', contexto: {} };
  const laxo = { ...laxoCuerpo, id: await hash(canonico(cuerpo(laxoCuerpo))) };
  const v2 = JSON.parse(JSON.stringify({ version: 2, exigirFirmas: false, eventos: [g, viejo, laxo] }));
  // Con las reglas nuevas no entraría.
  await assert.rejects(restaurar({ ...v2, version: 3 }), /génesis rechazado: el génesis no mueve nada/); // encargo 3b: es la época 0
  const eje = await restaurar(v2);
  assert.equal(eje.eventosV2, 3);
  assert.equal(eje.esDeV2(laxo.id), true);
  assert.deepEqual(eje.serie('E:club/vale'), { emisor: 'club', emitido: 15 });
  for (const id of eje.orden) assert.deepEqual((await validez(eje, id)).capas.map((c) => c.estado), ['ok', 'ok', 'ok', 'ok', 'ok']);
  // Lo nuevo ya va con las reglas de ahora: el grupo no emite, ni se escribe antes del foco.
  await assert.rejects(eje.escribir({ autor: 'club', sobre: viejo.id, t: T0, payload: 'x', movimientos: [gasta('club'), emiteE('club', 'vale', 1)] }), /solo las personas emiten: club es grupo \(lo declaró su alta, de la versión 2\)/);
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: viejo.id, t: '2026-11-06T08:00:00Z', payload: 'x', movimientos: [gasta('ana')] }), /not before its focus/);
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: viejo.id, t: T0, payload: 'x', movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: null, a: 'ana' }, gasta('ana')] }, llaves.privada), /nobody mints T/);
  // Ana escribe con su asignación del día (VG, 8-11), aunque su alta sea del prefijo.
  assert.equal(eje.alta('ana').t, '2026-11-06T09:00:00Z');
  await eje.escribir({ autor: 'ana', sobre: viejo.id, t: T0, payload: 'mi tiempo', movimientos: [gasta('ana')] }, llaves.privada);
  await eje.escribir({ autor: 'ana', sobre: viejo.id, t: '2026-11-07T11:00:00Z', payload: 'mi hora', movimientos: [gasta('ana', 59)] }, llaves.privada);
  assert.equal(eje.saldoT('ana', 'minuto', T0), 1440 - 60 + 10); // y los 10 explícitos que le dio la versión 2
  // Al guardar, la marca se conserva y el eje se vuelve a restaurar igual.
  const datos = JSON.parse(JSON.stringify(serializar(eje)));
  assert.deepEqual([datos.version, datos.v2, datos.eventosV2, datos.eventos.length], [3, { eventos: 3, ultimo: laxo.id }, undefined, 5]);
  const otro = await restaurar(datos);
  assert.deepEqual(otro.series(), eje.series());
  assert.equal(otro.saldoT('ana', 'minuto', T0), 1440 - 60 + 10);
  // En el prefijo no cabe lo que la versión 2 no conocía (bloquear, caducidad, devolver R).
  const conBloqueo = await crearEvento({ autor: 'club', sobre: g.id, t: T0, payload: 'x', movimientos: [gasta('club'), { ...gasta('club'), a: 'club', estado: 'bloqueo', salida: 's' }] });
  await assert.rejects(restaurar(JSON.parse(JSON.stringify({ version: 2, eventos: [g, conBloqueo] }))), /estado, salida y caduca no existían en la versión 2/);
});
// VG 12-11 (estudio BQL-transacciones, decisión 8): un movimiento anunciado no toca saldos ni emite: el libro no lo
// aplica, las reglas del ciclo no lo ven como emisión ni como movimiento de nadie, y se guarda y se restaura con su registro.
test('lo anunciado no emite ni mueve: ni saldo, ni serie nueva, ni emisión ajena; su forma la valida validarMovimiento', async () => {
  const { ejemploCompra } = await import('../ejemplos/ikisai/compra-food.mjs');
  const { eje, compra } = await ejemploCompra();
  // La forma: con estado «anunciado», refiere es la fecha para la que se anuncia; sin salida; el T informativo no se anuncia.
  const e = { token: 'E', emisor: 'casa', denominacion: 'vale', cantidad: 3, de: null, a: 'casa' };
  assert.deepEqual(validarMovimiento({ ...e, estado: 'anunciado', refiere: '2026-12-01T00:00:00Z' }), []);
  assert.match(validarMovimiento({ ...e, estado: 'anunciado', refiere: 'mañana' }).join(), /refiere debe ser instante/);
  assert.match(validarMovimiento({ token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 1, de: 'casa', a: 'huesped', estado: 'anunciado', salida: 'x' }).join(), /no lleva salida/);
  assert.match(validarMovimiento({ token: 'T', escala: 'futuro', cantidad: 1, de: 'huesped', a: null, estado: 'anunciado', refiere: '2026-12-01T00:00:00Z' }).join(), /no se anuncia/);
  assert.match(validarMovimiento({ ...e, refiere: '2026-12-01T00:00:00Z' }).join(), /refiere solo en T pasado, futuro o inventado, o en un movimiento anunciado/);
  // La huésped anuncia que la casa emitirá vales y le dará euros: ni la casa los emite ni le da nada todavía.
  const antes = eje.saldo('huesped', 'E:casa/EUR');
  const anuncio = await eje.escribir({ autor: 'huesped', sobre: compra.id, en: '4100000000', t: '2026-11-07T15:00:00Z', movimientos: [gasta('huesped'), { ...e, estado: 'anunciado' }, { token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 4, de: 'casa', a: 'huesped', estado: 'anunciado' }], payload: 'vales y euros' });
  assert.deepEqual([eje.saldo('huesped', 'E:casa/EUR'), eje.series().some((s) => s.clave === 'E:casa/vale'), eje.saldo('casa', 'E:casa/vale')], [antes, false, 0]);
  const v = await validez(eje, anuncio.id);
  assert.notEqual(v.permiso.estado, 'falla', 'nadie emite lo ajeno: lo anunciado no es una emisión');
  assert.ok(Object.values(v).every((x) => !x || typeof x !== 'object' || x.estado !== 'falla'), 'ninguna capa falla: el respaldo no se pide para lo anunciado');
  const otro = await restaurar(serializar(eje));
  assert.deepEqual(otro.obtener(anuncio.id).movimientos.slice(1).map((m) => m.estado), ['anunciado', 'anunciado']);
});
