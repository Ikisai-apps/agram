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
import { crearEvento } from '../src/evento.js';
import { reglasDelCiclo } from '../src/ciclo.js';
import { validarMovimiento, topeT, TOPE_T_MINIMO, EMITEN } from '../src/tokens.js';
import { serializar, restaurar } from '../src/persistencia.js';
import { validez } from '../src/validez.js';

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
  await assert.rejects(Eje.genesis({ identidad: 'x', tipo: 'grupo', emision: [{ token: 'T', escala: 'hora', cantidad: 1 }], foco: 'g', t: T0 }), /el génesis lo emite una persona: su autor no puede ser grupo/);
  const sinTipo = await Eje.genesis({ identidad: 'x', emision: [{ token: 'T', escala: 'minuto', cantidad: 5 }], foco: 'g', t: T0 });
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
  assert.deepEqual(reglasDelCiclo(sinT, contexto(eje)).map((e) => e.texto), ['emitir R exige mover T del autor en el mismo evento']);
  const conT = { ...sinT, movimientos: [gasta('ana'), emiteR('ana', 1)] };
  assert.deepEqual(reglasDelCiclo(conT, contexto(eje)), []);
  // T que recibe no es T que mueve.
  const recibeT = { ...sinT, movimientos: [daT('raiz', 'ana', 1), emiteR('ana', 1)] };
  assert.match(reglasDelCiclo(recibeT, contexto(eje)).map((e) => e.texto).join(' '), /emitir R exige mover T del autor/);
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
  await intento([mueveR('ana', 1, 'ana', 'bea')]); // hacia alguien
  assert.equal(eje.poderSobre('ana', reg.id), 2);
  assert.equal(eje.saldo(reg.id, 'R:ana'), 1);
});

test('P fuera del génesis: sobre un registro del que es autora, o sobre el que ya tiene P para delegarlo', async () => {
  const { eje, alta } = await mundo();
  const reg = await taller(eje, 'ana');
  assert.equal(eje.poderSobre('ana', reg.id), 1);
  assert.equal(eje.serie('P:' + reg.id).emisor, 'ana');
  // Sobre un registro ajeno, sin P sobre él, no.
  await assert.rejects(eje.escribir({ autor: 'bea', sobre: reg.id, t: T0, payload: 'x', movimientos: [gasta('bea'), emiteR('bea', 2), mueveR('bea', 1, 'bea', 'ana'), emiteP('bea', reg.id)] }),
    /emitir P sobre [0-9a-f]{8} exige ser autora del registro o tener ya P sobre él: bea no es ni lo uno ni lo otro/);
  // Ni sobre todo el eje ni sobre un ámbito que no existe.
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: reg.id, t: T0, payload: 'x', movimientos: [gasta('ana'), mueveR('ana', 1, 'ana', 'bea'), emiteP('ana', 'genesis')] }), /P sobre todo el eje \(«genesis»\) solo lo emite el génesis/);
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: reg.id, t: T0, payload: 'x', movimientos: [gasta('ana'), mueveR('ana', 1, 'ana', 'bea'), emiteP('ana', 'f'.repeat(64))] }), /P fuera del génesis va sobre un registro existente: ámbito desconocido ffffffff/);
  // La emisión de P va a quien la emite; para darla, se mueve después.
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: reg.id, t: T0, payload: 'x', movimientos: [gasta('ana'), mueveR('ana', 1, 'ana', 'bea'), { ...emiteP('ana', reg.id), a: 'bea' }] }), /la emisión de P va a quien la emite: ana/);
  // Ana delega P en bea; con él, bea emite P sobre el taller para delegarlo a su vez.
  await eje.escribir({ autor: 'ana', sobre: reg.id, t: T0, payload: 'bea ayuda', movimientos: [gasta('ana'), { token: 'P', ambito: reg.id, cantidad: 1, de: 'ana', a: 'bea' }] });
  await eje.escribir({ autor: 'bea', sobre: reg.id, t: T0, payload: 'bea delega', movimientos: [gasta('bea'), emiteR('bea', 2), mueveR('bea', 1, 'bea', 'ana'), emiteP('bea', reg.id), { token: 'P', ambito: reg.id, cantidad: 1, de: 'bea', a: 'raiz' }] });
  assert.equal(eje.poderSobre('raiz', reg.id), 6); // 5 del génesis + 1 delegado por bea
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
  assert.ok(validarMovimiento({ ...base, estado: 'bloqueo' }).some((e) => /bloqueo exige salida: la condición verificable de liberación/.test(e)));
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
