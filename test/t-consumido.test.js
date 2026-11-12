// T consumido y anotado en el registro que soporta (VG, 7-11 noche, mapa §12
// [D] «T, corregido por VG»; revisión de seguridad de Core, 8-11):
//   1. escribir CONSUME T del autor (de = autor, a = null) y el consumo se
//      anota en el registro `sobre` (eje.tiempoSobre, eje.tiempoBajo; el 8 lo
//      funde por escala);
//   2. T se ve desde fuera y no afecta mecánicamente a terceros: ni recuentos
//      (desde el encargo 3b ya no hay autorizar), ni topes de E, ni
//      elegibilidad, ni orden de candidatos;
//   3. T no cruza de persona: de una persona a otra se rechaza y se transforma
//      en E; una persona sí da su T a una cosa (la máquina gasta el de su
//      dueño); no hay grupos que reciban T (VG, 8-11: solo delegación);
//   4. (retirado por VG 12-11, #65: ya no hay «incongruencia de escala»; la escala
//      que cubre lo emitido la propone el 4: tiempo.escalaQueCubre, test/ui.test.js.)
// T como asignación diaria (VG, 8-11, sustituye a acuñar al gastar y al tope
// del reloj): «llega a las 12 de la noche y te da todo el T del día
// siguiente […]. Te lo gastas como quieras, no te puedes gastar más». Lo no
// gastado no se acumula; semana, ciclo y año llegan en partes diarias («tú
// diariamente tienes la posibilidad de poner uno partido de 7, 28 o 364 para
// que ese día decidas»); y pasado, futuro e inventado son ilimitados («pondría
// uno, pero si lo gastas te vuelve a salir uno») y quedan registrados como tal.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Eje } from '../src/eje.js';
import { direccion } from '../src/btml.js';
import { evaluar } from '../src/bql.js';
import * as motor from '../src/motor.js';
import { elegibles } from '../src/elegibles.js';
import { ocupantes } from '../src/encaje.js';
import { validez } from '../src/validez.js';
import { esPresente } from '../src/evento.js';
import { leerEvento } from '../src/lectura.js';
import { entrarPorInvitacion } from '../ejemplos/ikisai/altas.mjs';
import { ASIGNACION_T, PARTES_T, ESCALAS_REALES, asignacionT, diaCivil, textoT, validarMovimiento } from '../src/tokens.js';

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

/**
 * El día antes de T0, g invita a ana y a bea y ellas aceptan (su alta: encargo 3b; B1, VG 10-11: son personas) y g les
 * da minutos como E; g da de alta a una cosa, el robot, dándole T (no hay identidades de grupo: VG, 8-11). El génesis no
 * mueve nada: g emite su R y su E después (encargo 3b).
 */
async function mundo() {
  const eje = await Eje.genesis({
    demostracion: true, identidad: 'g', t: AYER, foco: ['raíz'],
    emision: [{ token: 'R', cantidad: 10 }, { token: 'E', denominacion: 'minuto', cantidad: 1e6 }],
  });
  for (const id of ['ana', 'bea']) await entrarPorInvitacion(eje, { por: 'g', quien: id, t: AYER });
  const alta = await eje.escribir({
    autor: 'g', sobre: eje.genesisId, t: AYER, payload: 'altas',
    movimientos: [gasta('g'), cedeE('g', 'ana', 10), cedeE('g', 'bea', 10), daT('g', 'robot', 30)],
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
  // Sobre el génesis: la emisión de g, sus dos invitaciones y las altas que da (las aceptaciones cuelgan de cada invitación).
  assert.deepEqual(eje.tiempoSobre(g), { minuto: 4 });
  assert.deepEqual(eje.tiempoSobre(alta.id), { minuto: 3 });
  assert.deepEqual(eje.tiempoSobre(a.id), { minuto: 6, hora: 1 });
  assert.deepEqual(eje.tiempoSobre('nadie'), {});
  // Y lo que cuelga de él.
  assert.deepEqual(eje.tiempoBajo(alta.id), { minuto: 9, hora: 1 });
  assert.deepEqual(eje.tiempoBajo(g), { minuto: 15, hora: 1 }); // y las dos aceptaciones
  // En las series de T: lo consumido y lo que salió de la asignación diaria (g, ana y bea; el robot gastó el suyo).
  const serie = (k) => eje.series().find((s) => s.clave === k);
  assert.deepEqual([serie('T:minuto').consumido, serie('T:minuto').deAsignacion], [15, 11 + 30]); // y los 30 que g dio al robot
  assert.deepEqual([serie('T:hora').emitido, serie('T:hora').consumido, serie('T:hora').deAsignacion], [0, 1, 1]);
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

test('T no cruza de persona: a otra persona se rechaza; a una cosa, sí; dar tiempo a otra persona es E', async () => {
  const { eje, alta } = await mundo();
  await assert.rejects(eje.escribir({ autor: 'g', sobre: alta.id, t: T0, payload: 'x', movimientos: [gasta('g'), daT('g', 'ana', 5)] }),
    /T only goes to things/);
  // Una cosa tampoco se lo pasa a una persona.
  await assert.rejects(eje.escribir({ autor: 'robot', sobre: alta.id, t: T0, payload: 'x', movimientos: [gasta('robot'), daT('robot', 'ana', 1)] }), /T only goes to things/);
  // A una cosa, sí: la máquina gasta el T de su dueño; y una cosa a otra cosa nueva, también.
  await eje.escribir({ autor: 'g', sobre: alta.id, t: T0, payload: 'más T para el robot', movimientos: [gasta('g'), daT('g', 'robot', 5)] });
  await eje.escribir({ autor: 'robot', sobre: alta.id, t: T0, payload: 'un brazo', movimientos: [gasta('robot'), daT('robot', 'brazo', 3)] });
  assert.deepEqual([eje.saldoT('robot', 'minuto'), eje.saldoT('brazo', 'minuto')], [31, 3]);
  // Lo que vale entre personas: E de la serie del que da, en su tiempo.
  await eje.escribir({ autor: 'g', sobre: alta.id, t: T0, payload: 'cinco minutos para ana', movimientos: [gasta('g'), cedeE('g', 'ana', 5)] });
  assert.equal(eje.saldo('ana', 'E:g/minuto'), 15);
  assert.equal(eje.saldo('ana', 'T:minuto'), 0); // ningún T explícito: solo su asignación del día
});

test('T de cosa a cosa (VG, 8-11): solo entre cosas del mismo dueño, o si el autor escribió el alta de la destino o tiene P sobre ella', async () => {
  const { eje, alta } = await mundo();
  // Otra cosa de g (el mismo dueño que el robot) y una cosa de ana.
  await eje.escribir({ autor: 'g', sobre: alta.id, t: T0, payload: 'el horno', movimientos: [gasta('g'), daT('g', 'horno', 2)] });
  const deAna = await eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'mi tostadora', movimientos: [gasta('ana'), daT('ana', 'tostadora', 2)] });
  assert.deepEqual(eje.alta('tostadora'), { id: deAna.id, t: T0 });
  // Del mismo dueño: sí.
  await eje.escribir({ autor: 'robot', sobre: alta.id, t: T0, payload: 'al horno', movimientos: [gasta('robot'), daT('robot', 'horno', 3)] });
  assert.equal(eje.saldoT('horno', 'minuto'), 5);
  // De otro dueño, sin escribir su alta ni tener P sobre ella: no.
  const aLaTostadora = { autor: 'robot', sobre: alta.id, t: T0, payload: 'a la tostadora', movimientos: [gasta('robot'), daT('robot', 'tostadora', 3)] };
  await assert.rejects(eje.escribir(aLaTostadora), /T only goes to things/);
  // Con P sobre el alta de la tostadora (aquí, el que ana le da del registro que la dio de alta: mapa §15, ya no hay P
  // del génesis sobre todo el eje): sí.
  await eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'poder para el robot', movimientos: [gasta('ana'), { token: 'P', ambito: deAna.id, cantidad: 1, de: 'ana', a: 'robot' }] });
  await eje.escribir({ ...aLaTostadora, payload: 'a la tostadora, con poder' });
  assert.equal(eje.saldoT('tostadora', 'minuto'), 5);
});

// ---------- por cuenta de otro: nada (VG, 8-11) ----------

test('por cuenta de otro no se mueve nada (VG, 8-11: los grupos son solo delegación); lo delegado se usa con la propia firma', async () => {
  // Retira SEG-06: ya no hay «por cuenta de un grupo» (contexto.porCuenta), ni con P exacto sobre su alta.
  const { eje, alta } = await mundo();
  await eje.escribir({ autor: 'g', sobre: alta.id, t: AYER, payload: 'P a ana', movimientos: [gasta('g'), { token: 'P', ambito: alta.id, cantidad: 1, de: 'g', a: 'ana' }] });
  const deBea = { autor: 'ana', sobre: alta.id, t: T0, payload: 'x', contexto: { porCuenta: 'bea' }, movimientos: [gasta('ana'), cedeE('bea', 'ana', 1)] };
  await assert.rejects(eje.escribir(deBea), /nobody moves tokens of others/);
  const v = await validez(eje, { ...deBea, en: '0000000000', id: 'x' });
  assert.equal(v.permiso.estado, 'falla');
  assert.match(v.permiso.motivos.join(' '), /nobody moves tokens of others/);
  // Delegar es dar (VG, 8-11: «yo te delego T, P, R, E para que tú lo uses»): bea da a ana minutos de su E, y ana los usa con su firma.
  await eje.escribir({ autor: 'bea', sobre: alta.id, t: T0, payload: 'te delego', movimientos: [gasta('bea'), cedeE('bea', 'ana', 3)] });
  await eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'lo uso', movimientos: [gasta('ana'), cedeE('ana', 'g', 3)] });
  assert.deepEqual([eje.saldo('bea', 'E:g/minuto'), eje.saldo('ana', 'E:g/minuto')], [7, 10]);
  // Y un alta no declara tipo, tampoco grupo (B1): persona o cosa se lee de quién escribe el alta.
  await assert.rejects(eje.escribir({ autor: 'g', sobre: alta.id, t: T0, payload: 'el coro', contexto: { tipos: { coro: 'grupo' } }, movimientos: [gasta('g'), cedeE('g', 'coro', 5)] }), /no hay tipo en el alta/);
});

// ---------- T como asignación diaria (VG, 8-11) ----------

const MANANA = '2026-11-09T09:00:00Z';

test('asignación diaria: cada persona tiene a las doce todo el T del día, sin emitir nada (VG, 8-11)', async () => {
  const { eje } = await mundo();
  assert.deepEqual(ESCALAS_REALES.map((e) => eje.saldoT('ana', e, T0)), [86400, 1440, 24, 1, 1, 1, 1]);
  assert.deepEqual(ASIGNACION_T, { segundo: 86400, minuto: 1440, hora: 24, dia: 1, semana: 1, ciclo: 1, anio: 1 });
  // Es del día civil (UTC) de su propio reloj: a las 23:59 y a las 00:00 son dos días.
  assert.equal(asignacionT('2026-11-08T23:59:59Z', 'minuto').periodo + 1, asignacionT('2026-11-09T00:00:00Z', 'minuto').periodo);
  assert.equal(diaCivil('2026-11-09T00:00:00+01:00'), diaCivil('2026-11-08T23:00:00Z'));
  // Quien no es persona no tiene asignación: una cosa, el T que le dio su persona.
  assert.equal(eje.saldoT('robot', 'minuto', T0), 30);
});

test('gastar no puede superar la asignación: agotar los minutos del día y ser rechazado; validez dice lo mismo', async () => {
  const { eje, alta } = await mundo();
  await eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'mucho', movimientos: [gasta('ana', 1400)] });
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'demasiado', movimientos: [gasta('ana', 41)] }), /writing burns today's T/);
  await eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'lo justo', movimientos: [gasta('ana', 40)] });
  assert.equal(eje.saldoT('ana', 'minuto', T0), 0);
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'uno más', movimientos: [gasta('ana')] }), /writing burns today's T/);
  // Las horas son otro token: siguen enteras, y con ellas ana sigue escribiendo hoy.
  await eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'con una hora', movimientos: [gasta('ana', 1, 'hora')] });
  const v = await validez(eje, { autor: 'ana', sobre: alta.id, t: T0, payload: 'y', movimientos: [gasta('ana', 1)], contexto: {}, en: '0000000000', id: 'x' });
  assert.equal(v.acreditacion.estado, 'falla');
  assert.match(v.acreditacion.motivos.join(' '), /writing burns today's T/);
  // Nadie emite T fuera del génesis: la asignación no se amplía.
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'x', movimientos: [{ token: 'T', escala: 'minuto', cantidad: 41, de: null, a: 'ana' }, gasta('ana', 1, 'hora')] }), /nobody mints T/);
  // Una cosa gasta el T que le dieron: saldo insuficiente, como siempre.
  await assert.rejects(eje.escribir({ autor: 'robot', sobre: alta.id, t: T0, payload: 'x', movimientos: [gasta('robot', 31)] }), /saldo insuficiente de T:minuto en robot/);
});

test('el cambio de día renueva la asignación entera y no acumula lo que no se gastó', async () => {
  const { eje, alta } = await mundo();
  await eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'hoy', movimientos: [gasta('ana', 1000)] });
  assert.equal(eje.saldoT('ana', 'minuto', T0), 440);
  // Mañana: 1440, no 1440 + 440. Y ayer tenía su día entero, que ya pasó: gastó un minuto en escribir su alta (B1).
  assert.deepEqual([eje.saldoT('ana', 'minuto', MANANA), eje.saldoT('ana', 'minuto', AYER)], [1440, 1439]);
  await eje.escribir({ autor: 'ana', sobre: alta.id, t: MANANA, payload: 'mañana', movimientos: [gasta('ana', 1440)] });
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: alta.id, t: MANANA, payload: 'x', movimientos: [gasta('ana')] }), /writing burns today's T/);
  // Sin t, su propio reloj: el día de su último evento.
  assert.equal(eje.saldoT('ana', 'minuto'), 0);
  // Restaurar rehace lo gastado de cada día desde los eventos.
  const otro = await Eje.desde(eje.orden.map((id) => eje.obtener(id)));
  assert.deepEqual([T0, MANANA].map((t) => otro.saldoT('ana', 'minuto', t)), [440, 0]);
});

test('semana, ciclo y año, en partes diarias: «uno partido de 7, 28 o 364 para que ese día decidas»', async () => {
  const { eje, alta } = await mundo();
  assert.deepEqual(PARTES_T, { semana: 7, ciclo: 28, anio: 364 });
  // Cada día, una parte de cada una: 1/7 de semana, 1/28 de ciclo, 1/364 de año. La cantidad va en partes, enteras.
  assert.deepEqual(['semana', 'ciclo', 'anio'].map((e) => textoT(e, eje.saldoT('ana', e, T0))), ['1/7 semana', '1/28 ciclo', '1/364 anio']);
  assert.deepEqual([textoT('semana', 3), textoT('semana', 7), textoT('anio', 728), textoT('minuto', 5)], ['3/7 semana', '1 semana', '2 anio', '5 minuto']);
  // Una semana entera (7 partes) no cabe en un día; su parte del día, sí.
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'una semana', movimientos: [gasta('ana', 7, 'semana')] }), /writing burns today's T/);
  await eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'mi parte de la semana', movimientos: [gasta('ana', 1, 'semana')] });
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'otra', movimientos: [gasta('ana', 1, 'semana')] }), /writing burns today's T/);
  // Lo no puesto no se acumula: a la semana siguiente, otra vez una parte.
  assert.equal(eje.saldoT('ana', 'semana', '2026-11-15T10:00:00Z'), 1);
  // Y siguen en enteros: no hay medias partes.
  assert.ok(validarMovimiento(gasta('ana', 0.5, 'semana')).some((e) => /T va en enteros/.test(e)));
});

test('persona → cosa: el T que da sale de su asignación del día', async () => {
  const { eje, alta } = await mundo();
  await eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'mi robot', movimientos: [gasta('ana'), daT('ana', 'mio', 1000)] });
  assert.deepEqual([eje.saldoT('ana', 'minuto', T0), eje.saldoT('mio', 'minuto', T0)], [439, 1000]);
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'más', movimientos: [gasta('ana'), daT('ana', 'mio', 439)] }), /writing burns today's T/);
  // Lo que tiene la cosa es suyo y no caduca con el día: lo gasta mañana.
  await eje.escribir({ autor: 'mio', sobre: alta.id, t: MANANA, payload: 'trabajo', movimientos: [gasta('mio', 600)] });
  assert.equal(eje.saldoT('mio', 'minuto', MANANA), 400);
});

test('ningún T se acumula (VG, 8-11: no hay T acumulable): el génesis no emite T y su autor vive de su asignación del día', async () => {
  await assert.rejects(Eje.genesis({ demostracion: true, identidad: 'g', t: AYER, foco: 'x', emision: [{ token: 'T', escala: 'minuto', cantidad: 1e6 }] }),
    /nobody mints T/); // encargo 3b: el génesis no mueve nada; lo que su autor emite pasa por las reglas
  const { eje, alta } = await mundo();
  assert.equal(eje.saldo('g', 'T:minuto'), 0);
  // AYER g gastó 4 minutos (su emisión, dos invitaciones y las altas) y dio 30 al robot: de su asignación de ayer.
  assert.equal(eje.saldoT('g', 'minuto', AYER), 1440 - 34);
  // Hoy, los 1440 del día y nada más: lo que no gastó ayer no pasa a hoy.
  await assert.rejects(eje.escribir({ autor: 'g', sobre: alta.id, t: T0, payload: 'mucho', movimientos: [gasta('g', 2000)] }), /writing burns today's T/);
  await eje.escribir({ autor: 'g', sobre: alta.id, t: T0, payload: 'el día entero', movimientos: [gasta('g', 1440)] });
  assert.deepEqual([eje.saldo('g', 'T:minuto'), eje.saldoT('g', 'minuto', T0), eje.saldoT('g', 'minuto', MANANA)], [0, 0, 1440]);
  // Una cosa no tiene asignación: conserva lo que le dio su persona hasta gastarlo.
  assert.equal(eje.saldoT('robot', 'minuto', MANANA), 30);
});

test('pasado, futuro e inventado: ilimitados, se registran con sus dos fechas y se enseñan aparte (VG, 8-11)', async () => {
  const { eje, alta } = await mundo();
  const haceUnAnio = '2025-11-08T10:00:00Z';
  const pasado = (nota) => ({ token: 'T', escala: 'pasado', cantidad: 1, de: 'ana', a: null, refiere: haceUnAnio, ...(nota ? { nota } : {}) });
  // «Pondría uno, pero si lo gastas te vuelve a salir uno»: diez veces el mismo día, todas pasan.
  for (let i = 0; i < 10; i++) {
    await eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'lo que hice hace un año ' + i, movimientos: [gasta('ana'), pasado(i === 0 ? 'planté el olivo' : undefined)] });
  }
  assert.equal(eje.saldoT('ana', 'pasado', T0), 1);
  await eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'lo que haré', movimientos: [gasta('ana'), { token: 'T', escala: 'futuro', cantidad: 3, de: 'ana', a: null, refiere: '2027-01-01T00:00:00Z' }] });
  await eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'un cuento', movimientos: [gasta('ana'), { token: 'T', escala: 'inventado', cantidad: 1, de: 'ana', a: null, nota: 'érase una vez' }] });
  // Queda registrado como tal: quién, el t real, la fecha a la que se refiere y la nota; aparte de las siete reales.
  const registrado = eje.tiempoInformativo(alta.id);
  assert.equal(registrado.length, 12);
  assert.deepEqual(registrado[0], { escala: 'pasado', cantidad: 1, autor: 'ana', t: T0, refiere: haceUnAnio, nota: 'planté el olivo', id: registrado[0].id });
  assert.deepEqual(registrado.slice(10).map((x) => [x.escala, x.cantidad, x.refiere, x.nota]), [['futuro', 3, '2027-01-01T00:00:00Z', null], ['inventado', 1, null, 'érase una vez']]);
  assert.deepEqual(eje.tiempoSobre(alta.id), { minuto: 12 });
  const informativas = eje.series().filter((x) => x.informativa).map((x) => [x.clave, x.consumido]);
  assert.deepEqual(informativas, [['T:pasado', 10], ['T:futuro', 3], ['T:inventado', 1]]);
  // Pasado y futuro exigen la fecha a la que se refieren; solo se consumen.
  const sinFecha = { token: 'T', escala: 'pasado', cantidad: 1, de: 'ana', a: null };
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'x', movimientos: [gasta('ana'), sinFecha] }), /T pasado exige refiere/);
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'x', movimientos: [gasta('ana'), { ...sinFecha, escala: 'futuro' }] }), /T futuro exige refiere/);
  assert.ok(validarMovimiento({ ...pasado(), a: 'bea' }).some((e) => /solo se consume/.test(e)));
  assert.ok(validarMovimiento({ ...gasta('ana'), nota: 'x' }).some((e) => /nota solo en T pasado, futuro o inventado/.test(e)));
  // Y pagan la escritura (VG, 8-11): el registro es válido, gratis en T real, y queda como no presente («el pago es la
  // ausencia de un registro presente, que puede ser un criterio en PV2 cuando el tiempo importe (p. ej. caducidad
  // alimentaria)»). Con T real, presente.
  const antes = eje.saldoT('ana', 'minuto', T0);
  const deMemoria = await eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'de memoria', movimientos: [pasado()] });
  assert.deepEqual([eje.presente(deMemoria.id), esPresente(deMemoria), eje.saldoT('ana', 'minuto', T0)], [false, false, antes]);
  assert.deepEqual([eje.presente(alta.id), eje.presente(eje.genesisId), eje.presente('nada')], [true, true, undefined]);
  // Se ve en validez y en la lectura, y un criterio del dueño puede exigirlo en BQL: FILTRAR(…, PRESENTE()).
  assert.deepEqual([(await validez(eje, deMemoria.id)).presente, (await validez(eje, alta.id)).presente], [false, true]);
  assert.ok(leerEvento(eje, deMemoria.id).split('\n')[0].endsWith(' · no presente (pagado con T informativo; VG, 8-11)'));
  assert.doesNotMatch(leerEvento(eje, alta.id), /no presente/);
  const X = await eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, movimientos: [gasta('ana')],
    payload: ['caducidad', 'lote', '=CONTAR(FILTRAR(BUSCAR("1000000000"), PRESENTE()))', '=CONTAR(BUSCAR("1000000000"))'] });
  await eje.escribir({ autor: 'ana', sobre: X.id, en: '1000000000', t: T0, movimientos: [gasta('ana')], payload: 'abierto hoy' });
  await eje.escribir({ autor: 'ana', sobre: X.id, en: '1000000000', t: T0, movimientos: [pasado()], payload: 'abierto, de memoria' });
  assert.deepEqual([evaluar(eje, X.id, [2]).texto, evaluar(eje, X.id, [3]).texto], ['2', '3']);
  assert.equal(evaluar(eje, X.id, [2]).estado, 'RESUELTO');
  // Restaurar rehace lo registrado.
  const otro = await Eje.desde(eje.orden.map((id) => eje.obtener(id)));
  assert.deepEqual(otro.tiempoInformativo(alta.id), eje.tiempoInformativo(alta.id));
  assert.equal(otro.presente(deMemoria.id), false);
});

// ---------- 2 · T se ve y no concede nada a terceros ----------

/**
 * Un mercado de casa (una persona) con criterio BUSCAR y a ana en su 3 (elegible), ofertas de ana, bea y el robot
 * con el T que diga `gastos` (uno por escrito), un alojamiento con capacidad 4 y E atada a él, y una propuesta de ana
 * sobre el mercado con la que ana compromete su P (encargo 3b: ya no hay autorizar; el recuento lo fija el dueño de
 * la propuesta, mapa §15 [D] (4)). Devuelve lo que se concede o se enseña a terceros, con los ids por su orden de
 * llegada (los gastos cambian los ids).
 */
async function mercado(gastos) {
  const { eje, alta } = await mundo();
  let k = 0;
  const g = () => gastos[k++ % gastos.length];
  await entrarPorInvitacion(eje, { por: 'g', quien: 'casa', t: AYER });
  await eje.escribir({ autor: 'g', sobre: alta.id, t: AYER, payload: 'alta de casa', movimientos: [gasta('g'), cedeE('g', 'casa', 10)] });
  // Revisión de seguridad (encargo 3b): escribir sobre el alta de otra identidad (el génesis es el alta de g) tiene el
  // precio de su atención; casa cuelga su mercado de su propia alta.
  const X = await eje.escribir({ autor: 'casa', sobre: eje.alta('casa').id, t: T0, payload: ['mercado', 'ofertas', '=BUSCAR(1)', 'ana'], movimientos: [gasta('casa', g())] });
  for (const [autor, texto] of [['bea', 'ruido'], ['ana', 'oferta de ana'], ['robot', 'oferta del robot'], ['casa', 'oferta de casa']]) {
    await eje.escribir({ autor, sobre: X.id, en: direccion([1]), t: T0, payload: texto, movimientos: [gasta(autor, g())] });
  }
  // Su R (sin colateral: VG, 9-11) y E atada a un alojamiento con capacidad 4, comprometiendo su P sobre él (D1).
  await eje.escribir({ autor: 'casa', sobre: X.id, t: T0, payload: 'reputación', movimientos: [gasta('casa', g()), { token: 'R', emisor: 'casa', cantidad: 10, de: null, a: 'casa' }, { token: 'R', emisor: 'casa', cantidad: 1, de: 'casa', a: 'g' }] });
  const H = await eje.escribir({ autor: 'casa', sobre: X.id, t: T0, payload: ['alojamiento', ['plazas'], 4], movimientos: [gasta('casa', g())] });
  const clave = 'E:casa/cama@n1@' + H.id;
  await eje.escribir({ autor: 'casa', sobre: H.id, t: T0, payload: 'camas', movimientos: [gasta('casa', g()), { token: 'R', emisor: 'casa', cantidad: 1, de: 'casa', a: 'g' },
    { token: 'P', ambito: H.id, cantidad: 2, de: 'casa', a: 'casa', estado: 'bloqueo', salida: 'E:casa/cama@*@' + H.id },
    { token: 'E', emisor: 'casa', denominacion: 'cama@n1', registro: H.id, cantidad: 2, de: null, a: 'casa' }] });
  const c = await motor.consolidar(eje, { autor: 'ana', foco: X.id, t: T0, elecciones: { 1: 'algo' } });
  await eje.escribir({ autor: 'ana', sobre: c.id, t: T0, payload: 'me comprometo', movimientos: [gasta('ana', g()), { token: 'P', ambito: c.id, cantidad: 5, de: 'ana', a: 'ana', estado: 'bloqueo', salida: c.id }] });
  const indice = (id) => eje.orden.indexOf(id);
  const r = evaluar(eje, X.id, [2], { limites: { candidatos: 3 } });
  const rc = motor.recuento(eje, c.id);
  return {
    recuento: [rc.plantilla, rc.valor, rc.pasa],
    topes: eje.topes(H.id, T0).map((x) => [indice(x.registro), x.capacidad, x.franja, x.vivo, x.libre]),
    vivo: eje.vivo(clave, T0),
    elegibles: [...elegibles(eje, X.id).autores].sort(),
    candidatos: [r.estado, ...(r.valor?.items ?? []).map((i) => [i.origen, i.autor ?? null, i.contenido ?? null]), r.valor?.noElegibles ?? 0],
    propuesta: motor.proponer(eje, X.id, { posiciones: [2] }).elecciones[2]?.candidato?.autor ?? null,
    tiempo: eje.tiempoBajo(eje.genesisId),
  };
}

test('propiedad: cambiar el T gastado no cambia recuentos, topes de E, elegibles ni el orden de los candidatos', async () => {
  const p = prng(SEMILLA);
  const base = await mercado([1]);
  // Por defecto solo cuenta la dueña de la propuesta (ana): compromete 5 de los 20 P de su dominio (la propuesta y su
  // compromiso), un peso de 0,25 (mapa §15 [D] (3): cada persona se lee como su 100 % por dominio).
  assert.deepEqual(base.recuento, ['weighted sum', 0.25, true]);
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
