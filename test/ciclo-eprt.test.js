// Ciclo de vida de E/P/R/T (VG, 7-11 noche). Cada regla con su caso que pasa
// y el que no, y al final un ciclo completo T → R → P → E y vuelta.
//
// «Todos son emitidos por una persona individualmente. Siempre es X persona
// respalda Y recurso concreto, poder de decisión sobre algo, reputación
// cedida a otros para requerir atención, o tiempo usado por alguien en algo.»
// «Normalmente será T + (opc) R; si T + R + (opc) P; si T+R+P + (opc) E.»

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Eje, caducada } from '../src/eje.js';
import { crearEvento, hash, canonico, cuerpo } from '../src/evento.js';
import { msUTC, esInstante } from '../src/instante.js';
import { ADELANTO_MAXIMO_MS } from '../src/ciclo.js';
import { reglasDelCiclo } from '../src/ciclo.js';
import { validarMovimiento, topeT, TOPE_T_MINIMO, EMITEN } from '../src/tokens.js';
import { serializar, restaurar } from '../src/persistencia.js';
import { validez } from '../src/validez.js';
import { generarClaves } from '../src/autoridad.js';
import { consolidar, autorizar, ejecutar, liberar, estadoDe, puedeAutorizar, recursoDe, FABRICA } from '../src/motor.js';

const T0 = '2026-11-07T10:00:00Z';
const gasta = (de, cantidad = 1) => ({ token: 'T', escala: 'minuto', cantidad, de, a: null });
const daT = (de, a, cantidad) => ({ token: 'T', escala: 'minuto', cantidad, de, a });
const emiteR = (persona, cantidad) => ({ token: 'R', emisor: persona, cantidad, de: null, a: persona });
const mueveR = (emisor, cantidad, de, a) => ({ token: 'R', emisor, cantidad, de, a });
const emiteP = (persona, ambito, cantidad = 1) => ({ token: 'P', ambito, cantidad, de: null, a: persona });
const emiteE = (emisor, denominacion, cantidad, extra = {}) => ({ token: 'E', emisor, denominacion, cantidad, de: null, a: emisor, ...extra });
const mueveE = (emisor, denominacion, cantidad, de, a) => ({ token: 'E', emisor, denominacion, cantidad, de, a });

/**
 * La raíz (una persona, con P sobre todo el eje y R propia) da de alta a ana
 * y bea (personas), al club (un grupo) y a la sala (una cosa).
 */
async function mundo() {
  const eje = await Eje.genesis({
    demostracion: true,
    identidad: 'raiz',
    tipo: 'persona',
    emision: [{ token: 'T', escala: 'minuto', cantidad: 600 }, { token: 'P', cantidad: 5, ambito: 'genesis' }, { token: 'R', cantidad: 10 }],
    foco: 'Mundo de ejemplo',
    t: T0,
  });
  const g = eje.genesisId;
  const alta = await eje.escribir({ autor: 'raiz', sobre: g, t: T0, payload: 'altas',
    contexto: { tipos: { ana: 'persona', bea: 'persona', club: 'grupo', sala: 'cosa' } },
    movimientos: [gasta('raiz'), ...['ana', 'bea', 'club', 'sala'].map((a) => daT('raiz', a, 60))] });
  return { eje, g, alta };
}

/** Un registro de una persona sobre el que emite su P con su R en juego ante bea (o ante quien se diga): T + R + P. */
async function taller(eje, persona, { sobre = eje.genesisId, t = T0, ante = 'bea', payload = 'taller de ' + persona } = {}) {
  const reg = await eje.escribir({ autor: persona, sobre, t, payload, movimientos: [gasta(persona)] });
  await eje.escribir({ autor: persona, sobre: reg.id, t, payload: 'poder sobre ' + payload,
    movimientos: [gasta(persona), emiteR(persona, 10), mueveR(persona, 1, persona, ante), emiteP(persona, reg.id)] });
  return reg;
}

/** El contexto que leen las reglas del ciclo, desde el eje público. */
const contexto = (eje) => ({
  tipo: (id) => eje.tipo(id),
  alta: (id) => eje.alta(id),
  emitidoT: (id, escala) => eje.emitidoT(id, escala),
  serie: (k) => eje.serie(k),
  registro: (id) => eje.obtener(id),
  ambitosQueCubren: (a) => eje.ambitosQueCubren(a),
  saldo: (id, k) => eje.saldo(id, k),
  genesisId: eje.genesisId,
  autorizada: (id) => estadoDe(eje, id) === 'AUTORIZADO',
});

// ---------- 1 · solo emiten personas ----------

test('solo emiten personas: un grupo, una cosa o quien no declaró tipo no emiten', async () => {
  assert.deepEqual(EMITEN, ['persona']);
  const { eje, alta } = await mundo();
  await eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'mi reputación', movimientos: [gasta('ana'), emiteR('ana', 5)] });
  assert.deepEqual(eje.serie('R:ana'), { emisor: 'ana', emitido: 5 });
  await assert.rejects(eje.escribir({ autor: 'club', sobre: alta.id, t: T0, payload: 'x', movimientos: [gasta('club'), emiteR('club', 1)] }), /solo las personas emiten: club es grupo/);
  await assert.rejects(eje.escribir({ autor: 'sala', sobre: alta.id, t: T0, payload: 'x', movimientos: [gasta('sala'), emiteR('sala', 1)] }), /solo las personas emiten: sala es cosa/);
  // El génesis lo emite una persona (o quien no declara tipo, como antes): ni un grupo ni una cosa.
  await assert.rejects(Eje.genesis({ demostracion: true, identidad: 'x', tipo: 'grupo', emision: [{ token: 'T', escala: 'hora', cantidad: 1 }], foco: 'g', t: T0 }), /el génesis lo emite una persona: su autor no puede ser grupo/);
  const sinTipo = await Eje.genesis({ demostracion: true, identidad: 'x', emision: [{ token: 'T', escala: 'minuto', cantidad: 5 }], foco: 'g', t: T0 });
  await assert.rejects(sinTipo.escribir({ autor: 'x', sobre: sinTipo.genesisId, t: T0, payload: 'x', movimientos: [gasta('x'), emiteR('x', 1)] }), /solo las personas emiten: x no declaró tipo en su alta/);
});

test('a nombre de un grupo emite una persona con P sobre el registro del grupo (su alta), con su firma', async () => {
  const { eje, alta } = await mundo();
  assert.equal(eje.alta('club').id, alta.id); // el registro del grupo es el de su alta
  // Sin P sobre ese registro, no.
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'x', movimientos: [gasta('ana'), emiteR('club', 1)] }),
    /emitir a nombre del grupo club exige P sobre su registro \([0-9a-f]{8}\): ana no lo tiene/);
  // La raíz le delega P sobre el alta del club; desde ahí ana emite a nombre del club. El autor es ella.
  await eje.escribir({ autor: 'raiz', sobre: alta.id, t: T0, payload: 'ana lleva el club', movimientos: [gasta('raiz'), { token: 'P', ambito: alta.id, cantidad: 1, de: 'raiz', a: 'ana' }] });
  const r = await eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'reputación del club', movimientos: [gasta('ana'), emiteR('club', 3)] });
  assert.equal(r.autor, 'ana');
  assert.deepEqual(eje.serie('R:club'), { emisor: 'club', emitido: 3 });
  assert.equal(eje.saldo('club', 'R:club'), 3); // nace en la cartera del grupo
  // E a nombre del club: el último escalón, con su R (la de ana) en juego y P sobre el registro.
  await eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'vales del club',
    movimientos: [gasta('ana'), emiteR('ana', 2), mueveR('ana', 1, 'ana', 'bea'), emiteE('club', 'vale', 4)] });
  assert.equal(eje.saldo('club', 'E:club/vale'), 4);
  // Nadie emite a nombre de otra persona, ni sin P a nombre del grupo.
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'x', movimientos: [gasta('ana'), emiteR('bea', 1)] }), /nadie emite en nombre de otro: bea no es el autor/);
  await assert.rejects(eje.escribir({ autor: 'bea', sobre: alta.id, t: T0, payload: 'x', movimientos: [gasta('bea'), emiteR('club', 1)] }), /emitir a nombre del grupo club exige P/);
  // El grupo no emite por sí mismo, aunque firme.
  await assert.rejects(eje.escribir({ autor: 'club', sobre: alta.id, t: T0, payload: 'x', movimientos: [gasta('club'), emiteR('club', 1)] }), /solo las personas emiten: club es grupo/);
});

// ---------- 2 · T: cada persona, con el tope del reloj ----------
// PROVISIONAL [X] (VG, 7-11 noche): «emitir desde dos fuentes es igual de válido que emitir el doble desde una
// única fuente; no da más». El T por identidad y reloj es lo que una identidad falsa multiplica: estas pruebas
// fijan la regla de hoy, y la final saldrá del estudio de neutralidad ante agrupación y división.

test('el tope de T: ⌈(t − alta) / escala⌉, con un mínimo de uno', () => {
  assert.equal(TOPE_T_MINIMO, 1);
  assert.equal(topeT(T0, T0, 'hora'), 1);
  assert.equal(topeT(T0, '2026-11-07T10:00:01Z', 'hora'), 1);
  assert.equal(topeT(T0, '2026-11-07T11:00:01Z', 'hora'), 2);
  assert.equal(topeT(T0, '2026-11-07T11:30:00Z', 'minuto'), 90);
  assert.equal(topeT(T0, '2026-11-07T09:00:00Z', 'minuto'), 1); // antes del alta: el mínimo
});

test('T: cada persona emite el suyo, para sí misma, sin pasar del reloj desde su alta', async () => {
  const { eje, alta } = await mundo();
  assert.deepEqual(eje.alta('ana'), { id: alta.id, t: T0 });
  // En el mismo instante del alta, el reloj da el mínimo: un minuto.
  await eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'mi minuto', movimientos: [gasta('ana'), { token: 'T', escala: 'minuto', cantidad: 1, de: null, a: 'ana' }] });
  assert.equal(eje.emitidoT('ana', 'minuto'), 1);
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'x', movimientos: [gasta('ana'), { token: 'T', escala: 'minuto', cantidad: 1, de: null, a: 'ana' }] }),
    /tope de T:minuto para ana: llevaría 2 emitido y el reloj da 1 desde su alta \(2026-11-07T10:00:00Z\)/);
  // Hora y media después: noventa minutos y dos horas en total.
  const t = '2026-11-07T11:30:00Z';
  await eje.escribir({ autor: 'ana', sobre: alta.id, t, payload: 'mi tiempo', movimientos: [gasta('ana'), { token: 'T', escala: 'minuto', cantidad: 89, de: null, a: 'ana' }, { token: 'T', escala: 'hora', cantidad: 2, de: null, a: 'ana' }] });
  assert.deepEqual([eje.emitidoT('ana', 'minuto'), eje.emitidoT('ana', 'hora')], [90, 2]);
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: alta.id, t, payload: 'x', movimientos: [gasta('ana'), { token: 'T', escala: 'hora', cantidad: 1, de: null, a: 'ana' }] }), /tope de T:hora para ana/);
  // Para sí misma: no se emite T a otro.
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: alta.id, t: '2026-11-08T10:00:00Z', payload: 'x', movimientos: [gasta('ana'), { token: 'T', escala: 'hora', cantidad: 1, de: null, a: 'bea' }] }),
    /T lo emite cada persona para sí misma: a debe ser ana/);
  // La serie es constante, sin emisor en la clave: el T de ana y el de la raíz se intercambian.
  assert.equal(eje.serie('T:hora').emitido, 2);
  await eje.escribir({ autor: 'ana', sobre: alta.id, t, payload: 'una hora para bea', movimientos: [gasta('ana'), { token: 'T', escala: 'hora', cantidad: 1, de: 'ana', a: 'bea' }] });
  assert.equal(eje.saldoT('bea', 'hora'), 1);
  // Un grupo no emite su tiempo.
  await assert.rejects(eje.escribir({ autor: 'club', sobre: alta.id, t, payload: 'x', movimientos: [gasta('club'), { token: 'T', escala: 'minuto', cantidad: 1, de: null, a: 'club' }] }), /solo las personas emiten: club es grupo/);
});

test('el génesis sigue emitiendo T, eso no cuenta para el tope, y es el alta de su autor', async () => {
  const { eje, g } = await mundo();
  assert.equal(eje.serie('T:minuto').emitido, 600);
  assert.deepEqual(eje.alta('raiz'), { id: g, t: T0 });
  assert.equal(eje.emitidoT('raiz', 'minuto'), 0);
  await eje.escribir({ autor: 'raiz', sobre: g, t: T0, payload: 'mi minuto', movimientos: [gasta('raiz'), { token: 'T', escala: 'minuto', cantidad: 1, de: null, a: 'raiz' }] });
  assert.equal(eje.emitidoT('raiz', 'minuto'), 1);
  assert.equal(eje.serie('T:minuto').emitido, 601);
  assert.equal(eje.serie('T:minuto').emisor, 'raiz'); // en T, quien la emitió primero
});

// ---------- 3 · emisión escalonada ----------

test('escalonado: emitir R exige mover T del autor en el mismo evento', async () => {
  const { eje, alta } = await mundo();
  // Todo evento mueve T (validarForma), así que la regla se comprueba sobre el contexto, con un evento que no lo haría.
  const sinT = { autor: 'ana', sobre: alta.id, t: T0, movimientos: [emiteR('ana', 1)] };
  assert.deepEqual(reglasDelCiclo(sinT, contexto(eje)).map((e) => e.texto), ['emitir R exige mover T del autor en el mismo evento: consumirlo o darlo a otra identidad']);
  const conT = { ...sinT, movimientos: [gasta('ana'), emiteR('ana', 1)] };
  assert.deepEqual(reglasDelCiclo(conT, contexto(eje)), []);
  assert.deepEqual(reglasDelCiclo({ ...sinT, movimientos: [daT('ana', 'bea', 1), emiteR('ana', 1)] }, contexto(eje)), []); // darlo a otra identidad
  // T que recibe no es T que mueve.
  const recibeT = { ...sinT, movimientos: [daT('raiz', 'ana', 1), emiteR('ana', 1)] };
  assert.match(reglasDelCiclo(recibeT, contexto(eje)).map((e) => e.texto).join(' '), /emitir R exige mover T del autor/);
  // Ni T que no cuesta nada: dárselo a sí misma, o bloquearlo y liberarlo en el mismo evento (revisión, m1).
  const aSiMisma = { ...sinT, movimientos: [daT('ana', 'ana', 1), emiteR('ana', 1)] };
  assert.match(reglasDelCiclo(aSiMisma, contexto(eje)).map((e) => e.texto).join(' '), /emitir R exige mover T del autor/);
  const salida = 'cuando quiera';
  const bloqueaYLibera = { ...sinT, movimientos: [
    { ...daT('ana', 'ana', 1), estado: 'bloqueo', salida }, { ...daT('ana', 'ana', 1), estado: 'liberacion', salida }, emiteR('ana', 1)] };
  assert.match(reglasDelCiclo(bloqueaYLibera, contexto(eje)).map((e) => e.texto).join(' '), /emitir R exige mover T del autor/);
  await assert.rejects(eje.escribir({ ...bloqueaYLibera, payload: 'x' }), /emitir R exige mover T del autor en el mismo evento: consumirlo o darlo a otra identidad/);
  // El génesis no pasa por el escalonado.
  assert.deepEqual(reglasDelCiclo(eje.obtener(eje.genesisId), contexto(eje)), []);
});

test('escalonado: emitir P exige R propia en juego hacia otra identidad o hacia el registro', async () => {
  const { eje } = await mundo();
  const reg = await eje.escribir({ autor: 'ana', sobre: eje.genesisId, t: T0, payload: 'taller', movimientos: [gasta('ana'), emiteR('ana', 10)] });
  const intento = (movimientos) => eje.escribir({ autor: 'ana', sobre: reg.id, t: T0, payload: 'poder', movimientos: [gasta('ana'), ...movimientos, emiteP('ana', reg.id)] });
  await assert.rejects(intento([]), /emitir P exige R propia en juego en el mismo evento: mover R:ana de ana a otra identidad o al registro/);
  await assert.rejects(intento([mueveR('ana', 1, 'ana', 'ana')]), /emitir P exige R propia en juego/); // a sí misma no está en juego
  await assert.rejects(intento([{ ...mueveR('ana', 1, 'ana', 'ana'), estado: 'bloqueo', salida: 'nunca' }]), /emitir P exige R propia en juego/); // bloquearla tampoco
  await assert.rejects(intento([mueveR('ana', 1, 'ana', null)]), /emitir P exige R propia en juego/); // consumirla tampoco
  // R ajena no es propia: devolverle a la raíz la suya no pone en juego la de ana.
  await eje.escribir({ autor: 'raiz', sobre: reg.id, t: T0, payload: 'confío en ana', movimientos: [gasta('raiz'), mueveR('raiz', 1, 'raiz', 'ana')] });
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: reg.id, t: T0, payload: 'x', movimientos: [gasta('ana'), mueveR('raiz', 1, 'ana', 'raiz'), emiteP('ana', reg.id)] }), /emitir P exige R propia en juego/);
  await intento([mueveR('ana', 1, 'ana', reg.id)]); // hacia el registro
  assert.equal(eje.poderSobre('ana', reg.id), 1);
  assert.equal(eje.saldo(reg.id, 'R:ana'), 1);
  // Hacia alguien también vale, en otro registro suyo: sobre el mismo, P:taller ya es una serie cerrada (R3).
  const otro = await eje.escribir({ autor: 'ana', sobre: eje.genesisId, t: T0, payload: 'otro taller', movimientos: [gasta('ana')] });
  await eje.escribir({ autor: 'ana', sobre: otro.id, t: T0, payload: 'poder', movimientos: [gasta('ana'), mueveR('ana', 1, 'ana', 'bea'), emiteP('ana', otro.id)] });
  assert.equal(eje.poderSobre('ana', otro.id), 1);
});

test('P fuera del génesis: lo acuña solo quien escribió el registro; quien solo tiene P lo transfiere', async () => {
  const { eje, alta } = await mundo();
  const reg = await taller(eje, 'ana');
  assert.equal(eje.poderSobre('ana', reg.id), 1);
  assert.equal(eje.serie('P:' + reg.id).emisor, 'ana');
  // Sobre un registro ajeno, no.
  await assert.rejects(eje.escribir({ autor: 'bea', sobre: reg.id, t: T0, payload: 'x', movimientos: [gasta('bea'), emiteR('bea', 2), mueveR('bea', 1, 'bea', 'ana'), emiteP('bea', reg.id)] }),
    /P sobre [0-9a-f]{8} lo acuña solo quien escribió el registro \(ana\): bea puede transferir el P que tenga, no acuñarlo/);
  // Ni sobre todo el eje ni sobre un ámbito que no existe.
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: reg.id, t: T0, payload: 'x', movimientos: [gasta('ana'), mueveR('ana', 1, 'ana', 'bea'), emiteP('ana', 'genesis')] }), /P sobre todo el eje \(«genesis»\) solo lo emite el génesis/);
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: reg.id, t: T0, payload: 'x', movimientos: [gasta('ana'), mueveR('ana', 1, 'ana', 'bea'), emiteP('ana', 'f'.repeat(64))] }), /P fuera del génesis va sobre un registro existente: ámbito desconocido ffffffff/);
  // La emisión de P va a quien la emite; para darla, se mueve después.
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: reg.id, t: T0, payload: 'x', movimientos: [gasta('ana'), mueveR('ana', 1, 'ana', 'bea'), { ...emiteP('ana', reg.id), a: 'bea' }] }), /la emisión de P va a quien la emite: ana/);
  // Ana delega P en bea; bea no acuña más con él (revisión, M1: con 1 P delegado acuñaba sin límite), pero puede
  // transferir el que tiene, conservando la cantidad.
  await eje.escribir({ autor: 'ana', sobre: reg.id, t: T0, payload: 'bea ayuda', movimientos: [gasta('ana'), { token: 'P', ambito: reg.id, cantidad: 1, de: 'ana', a: 'bea' }] });
  await assert.rejects(eje.escribir({ autor: 'bea', sobre: reg.id, t: T0, payload: 'x', movimientos: [gasta('bea'), emiteR('bea', 2), mueveR('bea', 1, 'bea', 'ana'), emiteP('bea', reg.id)] }),
    /P sobre [0-9a-f]{8} lo acuña solo quien escribió el registro \(ana\): bea puede transferir el P que tenga, no acuñarlo/);
  await assert.rejects(eje.escribir({ autor: 'bea', sobre: reg.id, t: T0, payload: 'x', movimientos: [gasta('bea'), { token: 'P', ambito: reg.id, cantidad: 2, de: 'bea', a: 'raiz' }] }), /saldo insuficiente de P/);
  await eje.escribir({ autor: 'bea', sobre: reg.id, t: T0, payload: 'bea delega', movimientos: [gasta('bea'), { token: 'P', ambito: reg.id, cantidad: 1, de: 'bea', a: 'raiz' }] });
  assert.equal(eje.poderSobre('raiz', reg.id), 6); // 5 del génesis + 1 que le pasó bea
  assert.equal(eje.poderSobre('bea', reg.id), 0);
  assert.equal(eje.serie('P:' + reg.id).emitido, 1); // lo emitido no crece al transferir
  void alta;
});

test('escalonado: emitir E exige T, R propia en juego y P del autor sobre el registro del evento', async () => {
  const { eje } = await mundo();
  const reg = await taller(eje, 'ana');
  const mesa = await eje.escribir({ autor: 'ana', sobre: eje.genesisId, t: T0, payload: 'mesa', movimientos: [gasta('ana')] });
  // Con todo: sobre el taller, donde tiene P.
  await eje.escribir({ autor: 'ana', sobre: reg.id, t: T0, payload: 'clases', movimientos: [gasta('ana'), mueveR('ana', 1, 'ana', 'bea'), emiteE('ana', 'clase', 3)] });
  assert.equal(eje.saldo('ana', 'E:ana/clase'), 3);
  // Sin R propia en juego, no.
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: reg.id, t: T0, payload: 'x', movimientos: [gasta('ana'), emiteE('ana', 'clase', 1)] }), /emitir E exige R propia en juego en el mismo evento/);
  // Sobre la mesa no tiene P: no.
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: mesa.id, t: T0, payload: 'x', movimientos: [gasta('ana'), mueveR('ana', 1, 'ana', 'bea'), emiteE('ana', 'clase', 1)] }),
    /emitir E exige P del autor sobre el registro [0-9a-f]{8} \(saldo o movimiento de P en el mismo evento\)/);
  // Con P en juego en el mismo evento (lo emite sobre la mesa, que es suya), sí.
  await eje.escribir({ autor: 'ana', sobre: mesa.id, t: T0, payload: 'clases en la mesa', movimientos: [gasta('ana'), mueveR('ana', 1, 'ana', 'bea'), emiteP('ana', mesa.id), emiteE('ana', 'clase', 1)] });
  assert.equal(eje.serie('E:ana/clase').emitido, 4);
  // El escalonado se cuenta en validez igual que en el eje.
  const borrador = await crearEvento({ autor: 'ana', sobre: reg.id, t: T0, payload: 'x', movimientos: [gasta('ana'), emiteE('ana', 'clase', 1)] });
  const v = await validez(eje, borrador);
  assert.equal(v.permiso.estado, 'falla');
  assert.match(v.permiso.motivos.join(' '), /emitir E exige R propia en juego/);
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
  const { eje, alta } = await mundo();
  const salida = 'cuando bea confirme la reserva del 13-11';
  const bloqueo = (cantidad, s = salida) => ({ token: 'T', escala: 'minuto', cantidad, de: 'ana', a: 'ana', estado: 'bloqueo', salida: s });
  const liberacion = (cantidad, s = salida) => ({ ...bloqueo(cantidad, s), estado: 'liberacion' });
  const ev = await eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'reservo mi tiempo', movimientos: [gasta('ana'), bloqueo(10)] });
  assert.equal(eje.saldo('ana', 'T:minuto'), 49); // 60 − 1 − 10: el saldo es lo disponible
  assert.equal(eje.bloqueado('ana', 'T:minuto'), 10);
  assert.equal(eje.bloqueado('ana', 'T:minuto', salida), 10);
  assert.deepEqual(eje.bloqueos('ana'), [{ clave: 'T:minuto', token: 'T', serie: 'minuto', escala: 'minuto', salida, cantidad: 10 }]);
  assert.equal(eje.series().find((s) => s.clave === 'T:minuto').bloqueado, 10);
  assert.deepEqual(eje.tiempos('ana'), [{ escala: 'minuto', cantidad: 49 }]);
  assert.deepEqual((await validez(eje, ev.id)).capas.map((c) => c.estado), ['ok', 'ok', 'ok', 'ok', 'ok']);
  // Consumir o transferir sale solo del disponible.
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'x', movimientos: [gasta('ana', 50)] }), /saldo insuficiente de T:minuto en ana/);
  const gastoBloqueado = await crearEvento({ autor: 'ana', sobre: alta.id, t: T0, payload: 'x', movimientos: [gasta('ana'), daT('ana', 'bea', 49)] });
  assert.equal((await validez(eje, gastoBloqueado)).acreditacion.estado, 'falla');
  // No se bloquea lo que no está disponible, ni se bloquea lo ajeno.
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'x', movimientos: [gasta('ana'), bloqueo(49)] }), /saldo disponible insuficiente para bloquear T:minuto en ana/);
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'x', movimientos: [gasta('ana'), { ...bloqueo(1), de: 'bea', a: 'bea' }] }), /nadie mueve tokens ajenos: bea no es el autor/);
  await assert.rejects(crearEvento({ autor: 'ana', sobre: alta.id, t: T0, payload: 'x', movimientos: [gasta('ana'), { ...bloqueo(1), salida: undefined }] }), /bloqueo exige salida/);
  // Liberar exige la misma salida y no más de lo bloqueado con ella.
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'x', movimientos: [gasta('ana'), liberacion(5, 'otra cosa')] }), /no hay 5 de T:minuto bloqueado en ana con la salida «otra cosa»/);
  await eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'bea confirmó en parte', movimientos: [gasta('ana'), liberacion(4)] });
  assert.deepEqual([eje.saldo('ana', 'T:minuto'), eje.bloqueado('ana', 'T:minuto')], [52, 6]);
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'x', movimientos: [gasta('ana'), liberacion(7)] }), /no hay 7 de T:minuto bloqueado/);
  // Restaurar rehace lo bloqueado desde los eventos.
  const otro = await restaurar(JSON.parse(JSON.stringify(serializar(eje))));
  assert.equal(otro.bloqueado('ana', 'T:minuto', salida), 6);
  assert.deepEqual(otro.series(), eje.series());
  assert.deepEqual(otro.bloqueos('ana'), eje.bloqueos('ana'));
});

// ---------- 5 · R: obligación del emisor y devolución ----------

test('R: la obligación del emisor es su R en manos ajenas; quien la tiene solo puede devolvérsela', async () => {
  const { eje, alta } = await mundo();
  await eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'mi reputación', movimientos: [gasta('ana'), emiteR('ana', 5)] });
  assert.equal(eje.obligaciones('ana'), 0); // en su cartera no obliga a nada
  await eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'confío en bea', movimientos: [gasta('ana'), mueveR('ana', 2, 'ana', 'bea')] });
  assert.equal(eje.obligaciones('ana'), 2);
  // Bea no la pasa a otro ni la consume.
  await assert.rejects(eje.escribir({ autor: 'bea', sobre: alta.id, t: T0, payload: 'x', movimientos: [gasta('bea'), mueveR('ana', 1, 'bea', 'sala')] }), /R no es fungible: solo la mueve su emisor ana; quien la tiene solo puede devolvérsela/);
  await assert.rejects(eje.escribir({ autor: 'bea', sobre: alta.id, t: T0, payload: 'x', movimientos: [gasta('bea'), mueveR('ana', 1, 'bea', null)] }), /R no es fungible/);
  await assert.rejects(eje.escribir({ autor: 'bea', sobre: alta.id, t: T0, payload: 'x', movimientos: [gasta('bea'), { ...mueveR('ana', 1, 'bea', 'bea'), estado: 'bloqueo', salida: 's' }] }), /R no es fungible/);
  // Un mensaje no emite R: escribir solo mueve T.
  await eje.escribir({ autor: 'bea', sobre: alta.id, t: T0, payload: 'ana, ¿me atiendes?', movimientos: [gasta('bea')] });
  assert.equal(eje.serie('R:ana').emitido, 5);
  // Pedir atención: bea le devuelve un R a ana. La obligación baja.
  await eje.escribir({ autor: 'bea', sobre: alta.id, t: T0, payload: 'te pido atención', movimientos: [gasta('bea'), mueveR('ana', 1, 'bea', 'ana')] });
  assert.equal(eje.obligaciones('ana'), 1);
  assert.deepEqual([eje.saldo('ana', 'R:ana'), eje.saldo('bea', 'R:ana')], [4, 1]);
  // El emisor sí puede consumir la suya.
  await eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'retiro una', movimientos: [gasta('ana'), mueveR('ana', 1, 'ana', null)] });
  assert.equal(eje.saldo('ana', 'R:ana'), 3);
  assert.deepEqual(validarMovimiento(mueveR('ana', 1, 'bea', 'ana')), []);
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

test('ciclo completo: T → R → P → E (ejecución) y E → P → R → T (liquidación)', async () => {
  const { eje, alta } = await mundo();
  const mediodia = '2026-11-07T12:00:00Z';
  // T: ana emite su tiempo (dos horas desde su alta de las diez) y bea el suyo.
  await eje.escribir({ autor: 'ana', sobre: alta.id, t: mediodia, payload: 'mi tiempo', movimientos: [gasta('ana'), { token: 'T', escala: 'hora', cantidad: 2, de: null, a: 'ana' }] });
  await eje.escribir({ autor: 'bea', sobre: alta.id, t: mediodia, payload: 'mi tiempo', movimientos: [gasta('bea'), { token: 'T', escala: 'hora', cantidad: 2, de: null, a: 'bea' }] });
  // T + R: ana respalda su reputación.
  const rep = await eje.escribir({ autor: 'ana', sobre: alta.id, t: mediodia, payload: 'mi reputación', movimientos: [gasta('ana'), emiteR('ana', 10)] });
  // T + R + P: escribe su taller y emite poder sobre él, cediendo un R a bea para que pueda requerir su atención.
  const tallerAna = await eje.escribir({ autor: 'ana', sobre: rep.id, t: mediodia, payload: 'Taller de cerámica', movimientos: [gasta('ana')] });
  await eje.escribir({ autor: 'ana', sobre: tallerAna.id, t: mediodia, payload: 'decido sobre mi taller', movimientos: [gasta('ana'), mueveR('ana', 1, 'ana', 'bea'), emiteP('ana', tallerAna.id, 2)] });
  // T + R + P + E: respalda tres plazas de clase, que caducan a fin de mes.
  await eje.escribir({ autor: 'ana', sobre: tallerAna.id, t: mediodia, payload: 'tres plazas de clase',
    movimientos: [gasta('ana'), mueveR('ana', 1, 'ana', 'bea'), emiteE('ana', 'clase', 3, { caduca: '2026-11-30T00:00:00Z' })] });
  assert.deepEqual([eje.saldo('ana', 'E:ana/clase'), eje.poderSobre('ana', tallerAna.id), eje.obligaciones('ana')], [3, 2, 2]);

  // Vuelta. E: bea toma una plaza y paga con su T (el T de otra persona: la misma serie T:hora).
  await eje.escribir({ autor: 'ana', sobre: tallerAna.id, t: mediodia, payload: 'plaza para bea', movimientos: [gasta('ana'), mueveE('ana', 'clase', 1, 'ana', 'bea')] });
  await eje.escribir({ autor: 'bea', sobre: tallerAna.id, t: mediodia, payload: 'pago la plaza', movimientos: [gasta('bea'), { token: 'T', escala: 'hora', cantidad: 1, de: 'bea', a: 'ana' }] });
  assert.deepEqual([eje.saldoT('ana', 'hora'), eje.saldoT('bea', 'hora')], [3, 1]);
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

test('bloquear P: de la clave exacta, solo lo disponible y propio; lo bloqueado no da poder hasta liberarlo', async () => {
  const { eje } = await mundo();
  const reg = await taller(eje, 'ana');
  const salida = 'hasta que bea entregue el inventario';
  const bloqueoP = (de, cantidad, s = salida) => ({ token: 'P', ambito: reg.id, cantidad, de, a: de, estado: 'bloqueo', salida: s });
  // La raíz cubre el taller con su P sobre todo el eje, pero bloquear va por la clave exacta, sin plan de débito por ámbitos.
  assert.ok(eje.poderSobre('raiz', reg.id) > 0);
  await assert.rejects(eje.escribir({ autor: 'raiz', sobre: reg.id, t: T0, payload: 'x', movimientos: [gasta('raiz'), bloqueoP('raiz', 1)] }),
    /saldo disponible insuficiente para bloquear P:[0-9a-f]{64} en raiz/);
  // Ni más de lo que tiene, ni lo de otra.
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: reg.id, t: T0, payload: 'x', movimientos: [gasta('ana'), bloqueoP('ana', 2)] }), /saldo disponible insuficiente para bloquear/);
  await assert.rejects(eje.escribir({ autor: 'bea', sobre: reg.id, t: T0, payload: 'x', movimientos: [gasta('bea'), bloqueoP('ana', 1)] }), /nadie mueve tokens ajenos: ana no es el autor/);
  // Bloqueado, el P no se delega ni autoriza.
  await eje.escribir({ autor: 'ana', sobre: reg.id, t: T0, payload: 'reservo mi poder', movimientos: [gasta('ana'), bloqueoP('ana', 1)] });
  assert.deepEqual([eje.poderSobre('ana', reg.id), eje.bloqueado('ana', 'P:' + reg.id, salida)], [0, 1]);
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: reg.id, t: T0, payload: 'x', movimientos: [gasta('ana'), { token: 'P', ambito: reg.id, cantidad: 1, de: 'ana', a: 'bea' }] }), /saldo insuficiente de P/);
  const c = await consolidar(eje, { autor: 'bea', foco: reg.id, t: T0, elecciones: { 1: 'otra mesa' } });
  assert.equal(puedeAutorizar(eje, 'ana', c.id), false);
  await assert.rejects(autorizar(eje, { autorizante: 'ana', consolidacion: c.id, t: T0 }), /ana no tiene P que cuente para autorizar/);
  // Liberar exige la misma salida (declarada, no verificable todavía: [X] decidir VG).
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: reg.id, t: T0, payload: 'x', movimientos: [gasta('ana'), { ...bloqueoP('ana', 1, 'otra'), estado: 'liberacion' }] }), /no hay 1 de P:[0-9a-f]{64} bloqueado en ana con la salida «otra»/);
  await eje.escribir({ autor: 'ana', sobre: reg.id, t: T0, payload: 'inventario entregado', movimientos: [gasta('ana'), { ...bloqueoP('ana', 1), estado: 'liberacion' }] });
  assert.equal(puedeAutorizar(eje, 'ana', c.id), true);
});

// ---------- 9 · el reloj: ningún evento antes que su foco ni que el alta de su autor ----------

test('el t de un evento no es anterior al de su foco ni al alta de su autor ([X] confirmar VG)', async () => {
  const { eje, alta } = await mundo();
  const tarde = '2026-11-07T11:00:00Z';
  const nota = await eje.escribir({ autor: 'ana', sobre: alta.id, t: tarde, payload: 'nota', movimientos: [gasta('ana')] });
  // Sobre la nota (11:00), a las 10:30, no.
  await assert.rejects(eje.escribir({ autor: 'bea', sobre: nota.id, t: '2026-11-07T10:30:00Z', payload: 'x', movimientos: [gasta('bea')] }),
    /el t del evento \(2026-11-07T10:30:00Z\) es anterior al de su foco [0-9a-f]{8} \(2026-11-07T11:00:00Z\)/);
  // El alta toma el t del evento que la hace: cris entra a las 11:00 y no escribe antes, ni sobre un foco más antiguo.
  await eje.escribir({ autor: 'raiz', sobre: alta.id, t: tarde, payload: 'alta de cris', contexto: { tipos: { cris: 'persona' } }, movimientos: [gasta('raiz'), daT('raiz', 'cris', 10)] });
  assert.equal(eje.alta('cris').t, tarde);
  await assert.rejects(eje.escribir({ autor: 'cris', sobre: alta.id, t: '2026-11-07T10:30:00Z', payload: 'x', movimientos: [gasta('cris')] }),
    /el t del evento \(2026-11-07T10:30:00Z\) es anterior al alta de cris \(2026-11-07T11:00:00Z\)/);
  // El mismo instante sí vale, y después también.
  await eje.escribir({ autor: 'cris', sobre: alta.id, t: tarde, payload: 'hola', movimientos: [gasta('cris')] });
  // validez lo dice en la capa 4, como el eje.
  const borrador = await crearEvento({ autor: 'bea', sobre: nota.id, t: '2026-11-07T10:30:00Z', payload: 'x', movimientos: [gasta('bea')] });
  const v = await validez(eje, borrador);
  assert.equal(v.acreditacion.estado, 'falla');
  assert.match(v.acreditacion.motivos.join(' '), /es anterior al de su foco/);
});

test('el reloj por arriba: un evento no va más de un año (anio) por delante del mayor t del eje ([X] confirmar VG)', async () => {
  // Revisión de seguridad: fechar a futuro inflaba el tope de T. Sin reloj externo, se acota con lo que hay en el eje.
  const { eje, alta } = await mundo();
  assert.equal(ADELANTO_MAXIMO_MS, 365 * 86400 * 1000);
  assert.equal(eje.tMaximo(), msUTC(T0));
  const limite = new Date(msUTC(T0) + ADELANTO_MAXIMO_MS).toISOString();
  const pasado = new Date(msUTC(T0) + ADELANTO_MAXIMO_MS + 1000).toISOString();
  // Un segundo de más: rechazado, también para emitir T, y validez lo dice en la capa 4.
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: alta.id, t: pasado, payload: 'x', movimientos: [gasta('ana'), { token: 'T', escala: 'anio', cantidad: 1, de: null, a: 'ana' }] }),
    /el t del evento \(2027-11-07T10:00:01\.000Z\) va más de un año \(anio\) por delante del mayor t del eje \(2026-11-07T10:00:00\.000Z\)/);
  const v = await validez(eje, await crearEvento({ autor: 'ana', sobre: alta.id, t: pasado, payload: 'x', movimientos: [gasta('ana')] }));
  assert.match(v.acreditacion.motivos.join(' '), /va más de un año \(anio\) por delante/);
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
  const { eje, alta } = await mundo();
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: alta.id, t: '2026-11-07T10:20:00+01:00', payload: 'x', movimientos: [gasta('ana')] }), /es anterior al de su foco/);
  await eje.escribir({ autor: 'ana', sobre: alta.id, t: '2026-11-07T11:20:00+01:00', payload: 'bien', movimientos: [gasta('ana')] });
  // Y la caducidad, igual de estricta (caducada() también: ver la prueba de la caducidad).
  assert.ok(validarMovimiento(emiteE('ana', 'bono', 1, { caduca: '2026-11-30' })).some((e) => /caduca debe ser instante ISO-8601 con zona explícita/.test(e)));
});

// ---------- 10 · los cuatro ataques de la revisión adversarial (neutralidad ante identidades) ----------

/** Ana da de alta a un títere: una persona que controla ella. */
async function conTitere(eje, alta, { minutos = 10, t = T0 } = {}) {
  await eje.escribir({ autor: 'ana', sobre: alta.id, t, payload: 'alta de un títere', contexto: { tipos: { titere: 'persona' } }, movimientos: [daT('ana', 'titere', minutos)] });
}

test('NEU-01 (revisión de la #62) alta gratis: sigue abierta, la decide el estudio de neutralidad (PROVISIONAL [X])', async () => {
  // No se añade coste por alta (lo decide el estudio de neutralidad ante agrupación y división). La prueba fija
  // lo que pasa hoy: ana da de alta a un títere con un minuto, el títere emite su mínimo de T en cada escala y le
  // devuelve el minuto. Ana queda igual y el títere se queda con un año, un ciclo, una semana, un día, una hora y
  // un segundo que nadie ha pagado.
  const { eje, alta } = await mundo();
  const antes = eje.saldoT('ana', 'minuto');
  await conTitere(eje, alta, { minutos: 1 }); // dar el minuto es el T que mueve el evento
  const minimo = ['segundo', 'minuto', 'hora', 'dia', 'semana', 'ciclo', 'anio'].map((escala) => ({ token: 'T', escala, cantidad: TOPE_T_MINIMO, de: null, a: 'titere' }));
  await eje.escribir({ autor: 'titere', sobre: alta.id, t: T0, payload: 'mi tiempo', movimientos: [...minimo, daT('titere', 'ana', 2)] });
  assert.equal(eje.saldoT('ana', 'minuto'), antes + 1); // ana recupera el minuto y gana otro
  assert.deepEqual(eje.tiempos('titere'), ['segundo', 'hora', 'dia', 'semana', 'ciclo', 'anio'].map((escala) => ({ escala, cantidad: 1 })));
});

test('NEU-02 (revisión de la #62) alta retrofechada: cerrada, ningún evento es anterior a su foco ni al alta de su autor', async () => {
  const { eje, alta } = await mundo();
  // El ataque: dar de alta a un títere en un evento fechado en 1900 para que el reloj le diera ~4e9 T:segundo.
  const viejo = '1900-01-01T00:00:00Z';
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: alta.id, t: viejo, payload: 'alta antigua', contexto: { tipos: { titere: 'persona' } }, movimientos: [daT('ana', 'titere', 1)] }),
    /el t del evento \(1900-01-01T00:00:00Z\) es anterior al de su foco [0-9a-f]{8}.*es anterior al alta de ana/);
  assert.equal(eje.alta('titere'), null);
  // Con el alta de hoy, el reloj solo da el mínimo, y el títere tampoco escribe antes de su alta.
  await conTitere(eje, alta);
  await assert.rejects(eje.escribir({ autor: 'titere', sobre: alta.id, t: T0, payload: 'x', movimientos: [gasta('titere'), { token: 'T', escala: 'segundo', cantidad: 4e9, de: null, a: 'titere' }] }),
    /tope de T:segundo para titere: llevaría 4000000000 emitido y el reloj da 1/);
  await assert.rejects(eje.escribir({ autor: 'titere', sobre: eje.genesisId, t: viejo, payload: 'x', movimientos: [gasta('titere')] }), /es anterior al alta de titere/);
});

// VG, 7-11 noche: autorizar = bloquear P con el umbral del dueño. Sustituye la regla de Core de esta revisión («solo
// cuenta el P sobre un registro del hilo que el autor no escribió»): el P del autor cuenta como cualquier otro, y lo
// que decide es el P sobre el registro del recurso, no quién lo bloquea. VG, 8-11: el registro del recurso es el más
// cercano del hilo del foco con P propio emitido (manda el más concreto con poder emitido; la raíz del dominio solo
// donde nadie ha emitido P por debajo, y el génesis solo donde nadie ha emitido P).
test('NEU-03 (revisión de la #62) el títere que autoriza: no da nada; manda el registro más cercano con P propio emitido', async () => {
  const { eje, alta } = await mundo();
  await conTitere(eje, alta, { minutos: 30 });
  // En el dominio de la raíz (sus altas), ana escribe un registro suyo, acuña P sobre él (1) y se lo delega al títere.
  const suyo = await eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'lo mío', movimientos: [gasta('ana')] });
  await eje.escribir({ autor: 'ana', sobre: suyo.id, t: T0, payload: 'poder sobre lo mío',
    movimientos: [gasta('ana'), emiteR('ana', 1), mueveR('ana', 1, 'ana', 'titere'), emiteP('ana', suyo.id), { token: 'P', ambito: suyo.id, cantidad: 1, de: 'ana', a: 'titere' }] });
  assert.equal(eje.poderSobre('titere', suyo.id), 1);
  const c = await consolidar(eje, { autor: 'ana', foco: suyo.id, t: T0, elecciones: { 1: 'me lo apruebo' } });
  // El recurso es su registro, que tiene P propio emitido: cuenta solo P:suyo, no el P del eje de la raíz.
  assert.equal(recursoDe(eje, c.id), suyo.id);
  assert.equal(puedeAutorizar(eje, 'raiz', c.id), false);
  // Escrita a mano, sin bloquear P, la autorización existe pero no cuenta, y no se ejecuta.
  await eje.escribir({ autor: 'titere', sobre: c.id, en: FABRICA, t: T0, payload: '==autorizo', contexto: { motor: 'fabrica', fase: 'autorizado' }, movimientos: [gasta('titere')] });
  assert.equal(estadoDe(eje, c.id), 'PENDIENTE DE AUTORIZACIÓN');
  await assert.rejects(ejecutar(eje, { autor: 'ana', consolidacion: c.id, t: T0 }), /PENDIENTE DE AUTORIZACIÓN/);
  // El títere solo tiene el P que ana emitió sobre lo suyo: con él autoriza lo mismo que ana sin títere (1 de 1).
  // Dividirse no da más: es el P de ana, que decide sobre su registro.
  await autorizar(eje, { autorizante: 'titere', consolidacion: c.id, t: T0 });
  assert.equal(estadoDe(eje, c.id), 'AUTORIZADO');
  await ejecutar(eje, { autor: 'ana', consolidacion: c.id, t: T0 });
  assert.equal(estadoDe(eje, c.id), 'EJECUTADO');
  // Un subregistro del títere debajo, con su P propio: manda en lo que se consolida sobre él, no en lo de ana.
  const delTitere = await eje.escribir({ autor: 'titere', sobre: suyo.id, t: T0, payload: 'lo del títere', movimientos: [gasta('titere')] });
  await eje.escribir({ autor: 'titere', sobre: delTitere.id, t: T0, payload: 'poder del títere',
    movimientos: [gasta('titere'), emiteR('titere', 1), mueveR('titere', 1, 'titere', 'ana'), emiteP('titere', delTitere.id)] });
  const debajo = await consolidar(eje, { autor: 'ana', foco: delTitere.id, t: T0, elecciones: { 1: 'otra cosa mía' } });
  assert.equal(recursoDe(eje, debajo.id), delTitere.id);
  const otra = await consolidar(eje, { autor: 'ana', foco: suyo.id, t: T0, elecciones: { 1: 'otra más' } });
  assert.equal(recursoDe(eje, otra.id), suyo.id);
  // Sin P propio en todo el hilo, manda el génesis: la raíz bloquea su P del eje (5 de 5).
  const sinP = await eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'sin poder propio', movimientos: [gasta('ana')] });
  const enSinP = await consolidar(eje, { autor: 'ana', foco: sinP.id, t: T0, elecciones: { 1: 'lo decide el eje' } });
  assert.equal(recursoDe(eje, enSinP.id), eje.genesisId);
  const a = await autorizar(eje, { autorizante: 'raiz', consolidacion: enSinP.id, t: T0 });
  assert.deepEqual(a.contexto.autoridad.bloquea, [{ clave: 'P:genesis', cantidad: 5 }]);
  assert.equal(estadoDe(eje, enSinP.id), 'AUTORIZADO');
  // En su propio dominio (un registro suyo sobre el génesis) ana se autoriza con su P: el del autor cuenta.
  const propio = await taller(eje, 'ana', { ante: 'titere' });
  const enLoPropio = await consolidar(eje, { autor: 'ana', foco: propio.id, t: T0, elecciones: { 1: 'lo decido yo' } });
  assert.equal(recursoDe(eje, enLoPropio.id), propio.id);
  await autorizar(eje, { autorizante: 'ana', consolidacion: enLoPropio.id, t: T0 });
  assert.equal(estadoDe(eje, enLoPropio.id), 'AUTORIZADO');
});

test('NEU-04 (revisión de la #62) el delegado que acuña: quien solo tiene P lo transfiere, no lo acuña ni lo estrecha hacia una serie cerrada', async () => {
  const { eje } = await mundo();
  const reg = await taller(eje, 'ana');
  const g = eje.genesisId;
  // La raíz delega en bea P sobre todo el eje.
  await eje.escribir({ autor: 'raiz', sobre: g, t: T0, payload: 'bea ayuda', movimientos: [gasta('raiz'), { token: 'P', ambito: 'genesis', cantidad: 1, de: 'raiz', a: 'bea' }] });
  const intento = (ambito) => eje.escribir({ autor: 'bea', sobre: reg.id, t: T0, payload: 'x', movimientos: [gasta('bea'), emiteR('bea', 2), mueveR('bea', 1, 'bea', 'ana'), emiteP('bea', ambito)] });
  // El ataque: con P:genesis delegado, acuñar P:<id del génesis>, que es todo el eje. Y tampoco sobre lo que cubre.
  await assert.rejects(intento(g), /P sobre [0-9a-f]{8} lo acuña solo quien escribió el registro \(raiz\): bea puede transferir el P que tenga, no acuñarlo/);
  await assert.rejects(intento('genesis'), /P sobre todo el eje \(«genesis»\) solo lo emite el génesis/);
  await assert.rejects(intento(reg.id), /lo acuña solo quien escribió el registro \(ana\)/);
  // R3 (VG, 7-11 noche): P:<taller> es una serie cerrada (ana ya la emitió). Estrechar hacia ella el P del eje la
  // ampliaría sin pasar por ana: no vale. Antes (#62) se aceptaba.
  const estrecha = (ambito) => eje.escribir({ autor: 'bea', sobre: reg.id, t: T0, payload: 'paso mi poder', movimientos: [gasta('bea'), { token: 'P', ambito, cantidad: 1, de: 'bea', a: 'sala' }] });
  await assert.rejects(estrecha(reg.id), /P:[0-9a-f]{8} es una serie cerrada: se delega el P:[0-9a-f]{8} que se tiene \(0\); estrecharlo desde un ámbito más amplio la ampliaría \(R3\)/);
  // Hacia la raíz de un dominio sin P propio, solo estrecha su autor; hacia un registro que no es raíz, cualquiera.
  const raizSinP = await eje.escribir({ autor: 'ana', sobre: g, t: T0, payload: 'otro dominio de ana', movimientos: [gasta('ana')] });
  await assert.rejects(estrecha(raizSinP.id), /estrechar P hacia [0-9a-f]{8}, la raíz de un dominio, es solo de quien la escribió \(ana\): bea delega el P que tiene con su ámbito \(R3\)/);
  const hoja = await eje.escribir({ autor: 'ana', sobre: raizSinP.id, t: T0, payload: 'una mesa', movimientos: [gasta('ana')] });
  await estrecha(hoja.id);
  assert.deepEqual([eje.poderSobre('bea', reg.id), eje.poderSobre('sala', hoja.id)], [0, 1]);
  assert.deepEqual([eje.serie('P:genesis').emitido, eje.serie('P:' + reg.id).emitido], [5, 1]);
});

test('R3: P:X la emite una sola vez su autor; ampliarla es ejecutar una consolidación sobre X que esté AUTORIZADA', async () => {
  const { eje } = await mundo();
  const reg = await taller(eje, 'ana'); // ana emite P:taller (1) con su R en juego ante bea
  const amplia = (cantidad = 1) => [gasta('ana'), mueveR('ana', 1, 'ana', 'bea'), emiteP('ana', reg.id, cantidad)];
  // Una segunda emisión suelta no vale: la serie está cerrada.
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: reg.id, t: T0, payload: 'más poder', movimientos: amplia() }),
    /P:[0-9a-f]{8} es una serie cerrada: ya la emitió su autor, y ampliarla es ejecutar una consolidación sobre [0-9a-f]{8} que esté AUTORIZADA \(R3\)/);
  // Ana delega su P en bea: ahora la ampliación la decide bea (1 de 1), no ana.
  await eje.escribir({ autor: 'ana', sobre: reg.id, t: T0, payload: 'bea decide', movimientos: [gasta('ana'), { token: 'P', ambito: reg.id, cantidad: 1, de: 'ana', a: 'bea' }] });
  const c = await consolidar(eje, { autor: 'ana', foco: reg.id, t: T0, titulo: 'Ampliar el P del taller', elecciones: { 1: 'dos P más' } });
  assert.equal(recursoDe(eje, c.id), reg.id);
  // Pendiente, ni ejecutándola vale la emisión.
  await assert.rejects(ejecutar(eje, { autor: 'ana', consolidacion: c.id, t: T0, movimientos: amplia(2).slice(1) }), /PENDIENTE DE AUTORIZACIÓN/);
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: c.id, en: FABRICA, t: T0, payload: 'a mano', contexto: { motor: 'fabrica', fase: 'ejecutado', evidencia: [c.id] }, movimientos: amplia(2) }),
    /P:[0-9a-f]{8} es una serie cerrada/);
  await autorizar(eje, { autorizante: 'bea', consolidacion: c.id, t: T0 });
  assert.equal(estadoDe(eje, c.id), 'AUTORIZADO');
  const e = await ejecutar(eje, { autor: 'ana', consolidacion: c.id, t: T0, movimientos: amplia(2).slice(1) });
  assert.equal(eje.serie('P:' + reg.id).emitido, 3);
  assert.equal(eje.saldo('ana', 'P:' + reg.id), 2);
  // Ejecutada, ya no amplía otra vez: la misma autorización no sirve dos veces.
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: c.id, en: FABRICA, t: T0, payload: 'otra vez', contexto: { motor: 'fabrica', fase: 'ejecutado', evidencia: [c.id] }, movimientos: amplia(2) }),
    /P:[0-9a-f]{8} es una serie cerrada/);
  // La capa 5 lo reconoce: la ejecución contó con la consolidación AUTORIZADA justo antes.
  assert.equal((await validez(eje, e.id)).capas[4].estado, 'ok');
  // Sobre el génesis, P:genesis y P:<id> son la misma serie: la raíz no la amplía sin una consolidación autorizada.
  const g = eje.genesisId;
  const ampliaG = [gasta('raiz'), mueveR('raiz', 1, 'raiz', 'ana'), emiteP('raiz', g)];
  await assert.rejects(eje.escribir({ autor: 'raiz', sobre: g, t: T0, payload: 'más poder', movimientos: ampliaG }), /es una serie cerrada/);
  const cg = await consolidar(eje, { autor: 'raiz', foco: g, t: T0, titulo: 'Ampliar el P del eje', elecciones: { 1: 'uno más' } });
  await autorizar(eje, { autorizante: 'raiz', consolidacion: cg.id, t: T0 });
  await ejecutar(eje, { autor: 'raiz', consolidacion: cg.id, t: T0, movimientos: ampliaG.slice(1) });
  assert.deepEqual([eje.serie('P:genesis').emitido, eje.serie('P:' + g).emitido], [5, 1]);
  assert.deepEqual(eje.bloqueos('raiz'), []); // la ejecución libera lo que bloqueó su autor
});

// ---------- SEG-01..03 (revisión de main 7-11 noche) ----------

test('SEG-01 (revisión de main 7-11 noche) ampliar P:X exige una ejecución real (con evidencia que resuelve) y una consolidación respalda una sola ampliación', async () => {
  const { eje } = await mundo();
  const reg = await taller(eje, 'ana');
  const amplia = (cantidad = 1) => [gasta('ana'), mueveR('ana', 1, 'ana', 'bea'), emiteP('ana', reg.id, cantidad)];
  await eje.escribir({ autor: 'ana', sobre: reg.id, t: T0, payload: 'bea decide', movimientos: [gasta('ana'), { token: 'P', ambito: reg.id, cantidad: 1, de: 'ana', a: 'bea' }] });
  const c = await consolidar(eje, { autor: 'ana', foco: reg.id, t: T0, titulo: 'Ampliar el P del taller', elecciones: { 1: 'dos P más' } });
  const a = await autorizar(eje, { autorizante: 'bea', consolidacion: c.id, t: T0 });
  assert.equal(estadoDe(eje, c.id), 'AUTORIZADO');
  // Una «ejecución» que solo lo dice: en la fábrica, del autor, fase ejecutado, sin evidencia. Antes ampliaba.
  const falsa = (contexto, payload) => eje.escribir({ autor: 'ana', sobre: c.id, en: FABRICA, t: T0, payload, contexto: { motor: 'fabrica', fase: 'ejecutado', ...contexto }, movimientos: amplia(2) });
  await assert.rejects(falsa({}, 'sin evidencia'), /es una serie cerrada.*\(R3\): una ejecución lleva su evidencia \(contexto\.evidencia\), y esta no la lleva/);
  await assert.rejects(falsa({ evidencia: [] }, 'evidencia vacía'), /y esta no la lleva/);
  // Con una referencia que no resuelve (así no contaba como ejecución y se repetía sin fin), tampoco.
  await assert.rejects(falsa({ evidencia: [c.id, 'f'.repeat(64)] }, 'evidencia rota'), /la evidencia cita ffffffff, que no está en el eje/);
  // Ni con evidencia que no cita la consolidación.
  await assert.rejects(falsa({ evidencia: [a.id] }, 'otra evidencia'), /la evidencia no cita la consolidación [0-9a-f]{8}/);
  assert.equal(eje.serie('P:' + reg.id).emitido, 1);
  assert.equal(estadoDe(eje, c.id), 'AUTORIZADO');
  // La ampliación legítima sigue pasando.
  const e = await ejecutar(eje, { autor: 'ana', consolidacion: c.id, t: T0, movimientos: amplia(2).slice(1) });
  assert.deepEqual(e.contexto.evidencia, [c.id, a.id]);
  assert.equal(eje.serie('P:' + reg.id).emitido, 3);
  assert.equal((await validez(eje, e.id)).capas[4].estado, 'ok');
  // Una segunda sobre la misma consolidación, con evidencia que resuelve: rechazada, ya respaldó una.
  await assert.rejects(falsa({ evidencia: [c.id, a.id] }, 'otra vez'), /la consolidación [0-9a-f]{8} ya respaldó una ampliación: respalda una sola/);
  // Las reglas del ciclo lo dicen igual aunque el contexto la diera por AUTORIZADA: manda el índice.
  const otra = await crearEvento({ autor: 'ana', sobre: c.id, en: FABRICA, t: T0, payload: 'otra más', contexto: { motor: 'fabrica', fase: 'ejecutado', evidencia: [c.id, a.id] }, movimientos: amplia(2) });
  const ctx = { ...contexto(eje), tMaximo: () => eje.tMaximo(), autorizada: () => true };
  assert.match(reglasDelCiclo(otra, { ...ctx, ampliada: (id) => id === c.id }).map((x) => x.texto).join('; '), /ya respaldó una ampliación/);
  assert.doesNotMatch(reglasDelCiclo(otra, { ...ctx, ampliada: () => false }).map((x) => x.texto).join('; '), /serie cerrada/);
  assert.equal(eje.serie('P:' + reg.id).emitido, 3);
});

test('SEG-02 (revisión de main 7-11 noche) un eje migrado de la versión 2 no es de demostración: la exención de clave vale solo en su prefijo', async () => {
  const g = await crearEvento({ autor: 'raiz', sobre: null, t: T0, payload: 'Viejo',
    movimientos: [{ token: 'T', escala: 'minuto', cantidad: 100, de: null, a: 'raiz' }], contexto: { genesis: true, tipos: { raiz: 'persona' } } });
  const alta = await crearEvento({ autor: 'raiz', sobre: g.id, t: T0, payload: 'alta de ana sin clave',
    movimientos: [gasta('raiz'), daT('raiz', 'ana', 10)], contexto: { tipos: { ana: 'persona' } } });
  const eje = await restaurar(JSON.parse(JSON.stringify({ version: 2, eventos: [g, alta] })));
  // El prefijo se restaura entero, sin claves.
  assert.deepEqual([eje.orden.length, eje.eventosV2, eje.demostracion], [2, 2, false]);
  for (const id of eje.orden) assert.equal((await validez(eje, id)).capas[2].estado, 'ok');
  // Lo nuevo, no: sin clave no se actúa (antes el eje entero pasaba por demostración).
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'nuevo', movimientos: [gasta('ana')] }), /sin clave no se actúa: ana no tiene clave registrada/);
  await assert.rejects(eje.escribir({ autor: 'raiz', sobre: alta.id, t: T0, payload: 'nuevo', movimientos: [gasta('raiz')] }), /sin clave no se actúa: raiz/);
  // Ni dando de alta a otra con su clave sin prueba de posesión.
  const otra = await generarClaves();
  await assert.rejects(eje.escribir({ autor: 'raiz', sobre: alta.id, t: T0, payload: 'alta de bea', contexto: { tipos: { bea: 'persona' }, claves: { bea: otra.publica } }, movimientos: [gasta('raiz'), daT('raiz', 'bea', 1)] }),
    /sin clave no se actúa: raiz.*la clave de bea llega sin prueba de posesión/);
  // Con la bandera firmada en su génesis, sí es de demostración, venga de la versión que venga.
  const gDemo = await crearEvento({ autor: 'raiz', sobre: null, t: T0, payload: 'Viejo de demostración',
    movimientos: [{ token: 'T', escala: 'minuto', cantidad: 100, de: null, a: 'raiz' }], contexto: { genesis: true, demostracion: true, tipos: { raiz: 'persona' } } });
  const demo = await restaurar(JSON.parse(JSON.stringify({ version: 2, eventos: [gDemo] })));
  assert.equal(demo.demostracion, true);
  await demo.escribir({ autor: 'raiz', sobre: gDemo.id, t: T0, payload: 'nuevo', movimientos: [gasta('raiz')] });
});

// ---------- SEG-04 (revisión de seguridad de la #73) ----------

test('SEG-04 (revisión de la #73) la consolidación solo se consume al ampliar de verdad: emitir P por primera vez en su fábrica no la gasta', async () => {
  const { eje } = await mundo();
  const reg = await taller(eje, 'ana');
  const amplia = (cantidad = 1) => [gasta('ana'), mueveR('ana', 1, 'ana', 'bea'), emiteP('ana', reg.id, cantidad)];
  await eje.escribir({ autor: 'ana', sobre: reg.id, t: T0, payload: 'bea decide', movimientos: [gasta('ana'), { token: 'P', ambito: reg.id, cantidad: 1, de: 'ana', a: 'bea' }] });
  const c = await consolidar(eje, { autor: 'ana', foco: reg.id, t: T0, titulo: 'Ampliar el P del taller', elecciones: { 1: 'dos P más' } });
  const a = await autorizar(eje, { autorizante: 'bea', consolidacion: c.id, t: T0 });
  const ejecutado = { motor: 'fabrica', fase: 'ejecutado' };
  // Otra identidad escribe en la fábrica de c un «ejecutado» que emite por primera vez P sobre un registro suyo:
  // es legítimo (P:<suyo> no estaba emitida) y antes bastaba para dar c por usada.
  const deBea = await eje.escribir({ autor: 'bea', sobre: eje.genesisId, t: T0, payload: 'rincón de bea', movimientos: [gasta('bea')] });
  await eje.escribir({ autor: 'bea', sobre: c.id, en: FABRICA, t: T0, payload: 'me cuelo', contexto: { ...ejecutado, evidencia: [c.id, a.id] },
    movimientos: [gasta('bea'), emiteR('bea', 10), mueveR('bea', 1, 'bea', 'ana'), emiteP('bea', deBea.id)] });
  // Y la autora de c, en su fábrica, emite por primera vez P:Y sobre otro registro suyo (con una evidencia que no
  // resuelve, así que no cuenta como ejecución de c): tampoco amplía nada.
  const Y = await eje.escribir({ autor: 'ana', sobre: eje.genesisId, t: T0, payload: 'otro registro de ana', movimientos: [gasta('ana')] });
  await eje.escribir({ autor: 'ana', sobre: c.id, en: FABRICA, t: T0, payload: 'primer P de Y', contexto: { ...ejecutado, evidencia: [c.id, 'f'.repeat(64)] },
    movimientos: [gasta('ana'), mueveR('ana', 1, 'ana', 'bea'), emiteP('ana', Y.id)] });
  assert.deepEqual([eje.serie('P:' + deBea.id).emitido, eje.serie('P:' + Y.id).emitido, eje.serie('P:' + reg.id).emitido], [1, 1, 1]);
  assert.equal(estadoDe(eje, c.id), 'AUTORIZADO');
  // Ninguno de los dos consumió c: la ampliación legítima sigue siendo posible, y la capa 5 lo reconoce.
  const e = await ejecutar(eje, { autor: 'ana', consolidacion: c.id, t: T0, movimientos: amplia(2).slice(1) });
  assert.equal(eje.serie('P:' + reg.id).emitido, 3);
  assert.equal((await validez(eje, e.id)).capas[4].estado, 'ok');
  // Una sola vez: esa sí la consumió.
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: c.id, en: FABRICA, t: T0, payload: 'otra vez', contexto: { ...ejecutado, evidencia: [c.id, a.id] }, movimientos: amplia(2) }),
    /la consolidación [0-9a-f]{8} ya respaldó una ampliación: respalda una sola/);
  assert.equal(eje.serie('P:' + reg.id).emitido, 3);
  // El eje reconstruido desde sus eventos dice lo mismo.
  const otro = await restaurar(JSON.parse(JSON.stringify(serializar(eje))));
  assert.deepEqual(otro.orden, eje.orden);
  assert.equal(otro.serie('P:' + reg.id).emitido, 3);
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
  const viejo = await crearEvento({ autor: 'club', sobre: g.id, t: '2026-11-06T09:00:00Z', payload: 'más vales y un alta',
    movimientos: [gasta('club'), emiteE('club', 'vale', 5), daT('club', 'ana', 10)], contexto: { tipos: { ana: 'persona' }, claves: { ana: llaves.publica } } });
  // Y uno con un t que solo Date.parse lee (sin T ni zona), como admitía la versión 2: se escribe sin crearEvento.
  const laxoCuerpo = { autor: 'club', sobre: viejo.id, en: '0000000000', t: '2026-11-06 10:00', movimientos: [gasta('club')], payload: 'nota', contexto: {} };
  const laxo = { ...laxoCuerpo, id: await hash(canonico(cuerpo(laxoCuerpo))) };
  const v2 = JSON.parse(JSON.stringify({ version: 2, exigirFirmas: false, eventos: [g, viejo, laxo] }));
  // Con las reglas nuevas no entraría.
  await assert.rejects(restaurar({ ...v2, version: 3 }), /génesis rechazado: el génesis lo emite una persona: su autor no puede ser grupo/);
  const eje = await restaurar(v2);
  assert.equal(eje.eventosV2, 3);
  assert.equal(eje.esDeV2(laxo.id), true);
  assert.deepEqual(eje.serie('E:club/vale'), { emisor: 'club', emitido: 15 });
  for (const id of eje.orden) assert.deepEqual((await validez(eje, id)).capas.map((c) => c.estado), ['ok', 'ok', 'ok', 'ok', 'ok']);
  // Lo nuevo ya va con las reglas de ahora: el grupo no emite, ni se escribe antes del foco.
  await assert.rejects(eje.escribir({ autor: 'club', sobre: viejo.id, t: T0, payload: 'x', movimientos: [gasta('club'), emiteE('club', 'vale', 1)] }), /solo las personas emiten: club es grupo/);
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: viejo.id, t: '2026-11-06T08:00:00Z', payload: 'x', movimientos: [gasta('ana')] }), /es anterior al de su foco/);
  await eje.escribir({ autor: 'ana', sobre: viejo.id, t: T0, payload: 'mi tiempo', movimientos: [gasta('ana'), { token: 'T', escala: 'minuto', cantidad: 1, de: null, a: 'ana' }] }, llaves.privada);
  // El alta de ana (en el prefijo, el 6-11 a las 9:00) cuenta para el tope desde el primer evento de la versión 3 (T0):
  // una hora después, 60 minutos y no los más de 1500 que daría su alta de la versión 2 (revisión de seguridad).
  assert.equal(eje.alta('ana').t, '2026-11-06T09:00:00Z');
  const unaHora = '2026-11-07T11:00:00Z';
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: viejo.id, t: unaHora, payload: 'x', movimientos: [gasta('ana'), { token: 'T', escala: 'minuto', cantidad: 60, de: null, a: 'ana' }] }, llaves.privada),
    /tope de T:minuto para ana: llevaría 61 emitido y el reloj da 60 desde su alta \(2026-11-07T10:00:00Z\)/);
  await eje.escribir({ autor: 'ana', sobre: viejo.id, t: unaHora, payload: 'mi hora', movimientos: [gasta('ana'), { token: 'T', escala: 'minuto', cantidad: 59, de: null, a: 'ana' }] }, llaves.privada);
  // Al guardar, la marca se conserva y el eje se vuelve a restaurar igual.
  const datos = JSON.parse(JSON.stringify(serializar(eje)));
  assert.deepEqual([datos.version, datos.v2, datos.eventosV2, datos.eventos.length], [3, { eventos: 3, ultimo: laxo.id }, undefined, 5]);
  const otro = await restaurar(datos);
  assert.deepEqual(otro.series(), eje.series());
  assert.equal(otro.emitidoT('ana', 'minuto'), 60);
  // En el prefijo no cabe lo que la versión 2 no conocía (bloquear, caducidad, devolver R).
  const conBloqueo = await crearEvento({ autor: 'club', sobre: g.id, t: T0, payload: 'x', movimientos: [gasta('club'), { ...gasta('club'), a: 'club', estado: 'bloqueo', salida: 's' }] });
  await assert.rejects(restaurar(JSON.parse(JSON.stringify({ version: 2, eventos: [g, conBloqueo] }))), /estado, salida y caduca no existían en la versión 2/);
});
