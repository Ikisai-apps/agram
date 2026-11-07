// El P que respalda la E de un registro cuenta también para autorizar sobre
// él (VG, 8-11 madrugada, textual: «P bloqueado respaldando la E de un
// registro cuente también para autorizar sobre ese registro: inmovilizar
// poder en un recurso es ya el compromiso, y vale para las dos cosas»;
// src/autorizacion.js). Cuenta solo con el acto de voluntad de su titular
// (motor.autorizar lo escribe: `contexto.autoridad.respaldo: true`, sin
// bloqueo nuevo); ejecutar no lo libera; repartirlo entre identidades no
// cambia nada.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Eje } from '../src/eje.js';
import { claveToken, familiaDe } from '../src/tokens.js';
import {
  consolidar, autorizar, ejecutar, liberar, estadoDe, puedeAutorizar, recursoDe, pesoAutorizacion, autorizacionesValidas,
  respaldoParaAutorizar, FABRICA,
} from '../src/motor.js';
import { validez } from '../src/validez.js';

const T0 = '2026-11-08T10:00:00Z';
const minuto = (de, cantidad = 1) => ({ token: 'T', escala: 'minuto', cantidad, de, a: null });
const enJuego = (persona, a = 'g') => ({ token: 'R', emisor: persona, cantidad: 1, de: persona, a });
let cuenta = 0;
const unico = (texto) => texto + ' #' + (++cuenta);
const serieE = (emisor, denominacion, registro) => claveToken({ token: 'E', emisor, denominacion, registro });

/**
 * Génesis «g»; altas de personas con minutos y su R; «casa» escribe el registro
 * A sobre el génesis (la raíz de su dominio), que declara capacidad 4, y acuña
 * `pA` de P:A. Si `respalda`, bloquea esa cantidad de P:A con la salida = la
 * familia de la serie «cama@*» atada a `registro` (A o su habitación H, que
 * cuelga de A) y emite una cama esa noche (E vivo). Devuelve el eje, A, H y la
 * familia.
 */
async function mundo({ pA = 4, respalda = 3, enHabitacion = false, personas = ['casa', 'bea', 't', 'p1', 'p2', 'p3', 'p4', 'p5'] } = {}) {
  const eje = await Eje.genesis({
    demostracion: true, identidad: 'g', tipo: 'persona', t: T0, foco: ['raíz'],
    emision: [{ token: 'T', escala: 'minuto', cantidad: 1e6 }, { token: 'P', ambito: 'genesis', cantidad: 10 }],
  });
  await eje.escribir({
    autor: 'g', sobre: eje.genesisId, t: T0, payload: 'altas',
    movimientos: [minuto('g'), ...personas.map((a) => ({ token: 'T', escala: 'minuto', cantidad: 5000, de: 'g', a }))],
    contexto: { tipos: Object.fromEntries(personas.map((p) => [p, 'persona'])) },
  });
  for (const p of personas) {
    await eje.escribir({ autor: p, sobre: eje.genesisId, t: T0, payload: 'R de ' + p, movimientos: [minuto(p), { token: 'R', emisor: p, cantidad: 100, de: null, a: p }] });
  }
  const A = (await eje.escribir({ autor: 'casa', sobre: eje.genesisId, t: T0, movimientos: [minuto('casa')], payload: ['Alojamiento', ['plazas'], 4] })).id;
  await eje.escribir({ autor: 'casa', sobre: A, t: T0, payload: 'P sobre el alojamiento', movimientos: [minuto('casa'), enJuego('casa'), { token: 'P', ambito: A, cantidad: pA, de: null, a: 'casa' }] });
  const H = (await eje.escribir({ autor: 'casa', sobre: A, t: T0, movimientos: [minuto('casa')], payload: 'Habitación' })).id;
  const registro = enHabitacion ? H : A;
  const familia = familiaDe(serieE('casa', 'cama@n1', registro));
  if (respalda) {
    await eje.escribir({ autor: 'casa', sobre: registro, t: T0, payload: unico('abre la cama'), movimientos: [minuto('casa'), enJuego('casa'),
      { token: 'P', ambito: A, cantidad: respalda, de: 'casa', a: 'casa', estado: 'bloqueo', salida: familia },
      { token: 'E', emisor: 'casa', denominacion: 'cama@n1', registro, cantidad: 1, de: null, a: 'casa' }] });
  }
  return { eje, A, H, familia };
}

/** La casa reparte P:A: { identidad: cantidad }. */
async function reparte(eje, A, cuanto) {
  await eje.escribir({ autor: 'casa', sobre: A, t: T0, payload: unico('reparto'), movimientos: [minuto('casa'), ...Object.entries(cuanto).map(([a, cantidad]) => ({ token: 'P', ambito: A, cantidad, de: 'casa', a }))] });
}

/** Bea escribe algo dentro del dominio de A y lo consolida: el recurso es A. */
async function consolidacion(eje, A, autor = 'bea') {
  const pide = await eje.escribir({ autor, sobre: A, t: T0, movimientos: [minuto(autor)], payload: unico('pido la sala') });
  return consolidar(eje, { autor, foco: pide.id, t: T0, elecciones: { 1: unico('la sala') } });
}

test('el P que respalda E del recurso alcanza el umbral con el acto de voluntad, sin bloqueo nuevo', async () => {
  for (const enHabitacion of [false, true]) {
    // La E atada a A o a un registro que cuelga de A (la habitación): las dos cuentan para lo que se consolida en A.
    const { eje, A, familia } = await mundo({ enHabitacion });
    const c = await consolidacion(eje, A);
    assert.equal(recursoDe(eje, c.id), A);
    assert.deepEqual(respaldoParaAutorizar(eje, 'casa', c.id), [{ clave: 'P:' + A, ambito: A, salida: familia, cantidad: 3 }]);
    assert.equal(puedeAutorizar(eje, 'casa', c.id), true);
    const a = await autorizar(eje, { autorizante: 'casa', consolidacion: c.id, t: T0 });
    // El acto: un registro en la fábrica de la consolidación que mueve el T de escribirlo y ningún P.
    assert.equal(a.en, FABRICA);
    assert.deepEqual(a.movimientos.map((m) => m.token), ['T']);
    assert.deepEqual([a.contexto.autoridad.respaldo, a.contexto.autoridad.bloquea, a.contexto.autoridad.respalda], [true, [], [{ clave: 'P:' + A, salida: familia, cantidad: 3 }]]);
    const peso = pesoAutorizacion(eje, c.id);
    assert.deepEqual([peso.directo, peso.respaldo, peso.bloqueado, peso.emitido, peso.respaldan], [0, 3, 3, 4, [{ identidad: 'casa', cantidad: 3 }]]);
    assert.equal(estadoDe(eje, c.id), 'AUTORIZADO');
    assert.deepEqual(autorizacionesValidas(eje, c.id).map((x) => x.id), [a.id]);
    // La capa de permiso lo reconoce: el acto cuenta.
    assert.notEqual((await validez(eje, a.id)).permiso.estado, 'falla');
  }
});

test('sin el acto de voluntad el P que respalda no cuenta: ni bloqueando otro P, ni escribiendo «autorizado» sin decirlo', async () => {
  const { eje, A } = await mundo();
  const c = await consolidacion(eje, A);
  // Respaldar no autoriza solo.
  assert.deepEqual([pesoAutorizacion(eje, c.id).bloqueado, estadoDe(eje, c.id)], [0, 'PENDIENTE DE AUTORIZACIÓN']);
  // Con `cantidad`, la casa bloquea su P libre (1) y no usa el respaldo si no lo pide: 1 de 4, no basta.
  const a = await autorizar(eje, { autorizante: 'casa', consolidacion: c.id, cantidad: 1, t: T0 });
  assert.equal(a.contexto.autoridad.respaldo, undefined);
  assert.deepEqual([pesoAutorizacion(eje, c.id).directo, pesoAutorizacion(eje, c.id).respaldo, estadoDe(eje, c.id)], [1, 0, 'PENDIENTE DE AUTORIZACIÓN']);
  // Un «autorizado» escrito a mano sin decir que autoriza con el respaldo tampoco.
  await eje.escribir({ autor: 'casa', sobre: c.id, en: FABRICA, t: T0, payload: '==autorizo', contexto: { motor: 'fabrica', fase: 'autorizado' }, movimientos: [minuto('casa')] });
  assert.equal(estadoDe(eje, c.id), 'PENDIENTE DE AUTORIZACIÓN');
  // Pedido con `respaldo: true`, cuenta lo bloqueado y lo que respalda: 1 + 3.
  await autorizar(eje, { autorizante: 'casa', consolidacion: c.id, respaldo: true, t: T0 });
  assert.deepEqual([pesoAutorizacion(eje, c.id).bloqueado, estadoDe(eje, c.id)], [4, 'AUTORIZADO']);
  // Retirarlo (liberar) devuelve el P bloqueado por la consolidación y el acto deja de contar; el respaldo sigue bloqueado.
  await liberar(eje, { titular: 'casa', consolidacion: c.id, t: T0 });
  assert.deepEqual([pesoAutorizacion(eje, c.id).bloqueado, estadoDe(eje, c.id), eje.bloqueado('casa', 'P:' + A), eje.saldo('casa', 'P:' + A)], [0, 'PENDIENTE DE AUTORIZACIÓN', 3, 1]);
});

test('un títere sin P ni E no autoriza: ni con el acto escrito a mano, ni con P propio respaldando su E dentro del dominio', async () => {
  const { eje, A } = await mundo();
  const c = await consolidacion(eje, A);
  assert.equal(puedeAutorizar(eje, 't', c.id), false);
  await assert.rejects(autorizar(eje, { autorizante: 't', consolidacion: c.id, t: T0 }), /t no tiene P que cuente para autorizar/);
  // A mano, diciendo que autoriza con un respaldo que no tiene: no suma nada.
  const falso = await eje.escribir({ autor: 't', sobre: c.id, en: FABRICA, t: T0, payload: '==autorizo', movimientos: [minuto('t')],
    contexto: { motor: 'fabrica', fase: 'autorizado', autoridad: { respaldo: true, respalda: [{ clave: 'P:' + A, salida: 'E:casa/cama@*@' + A, cantidad: 4 }] } } });
  assert.deepEqual([pesoAutorizacion(eje, c.id).bloqueado, estadoDe(eje, c.id)], [0, 'PENDIENTE DE AUTORIZACIÓN']);
  assert.deepEqual(autorizacionesValidas(eje, c.id), []);
  assert.equal((await validez(eje, falso.id)).permiso.estado, 'falla');
  // Un subregistro suyo en el dominio, con su P propio bloqueado hacia su propia serie: es P:sub, no P:A, y ni siquiera
  // emite E ahí (el tope de A pide P:A bloqueado, R2).
  const sub = await eje.escribir({ autor: 't', sobre: A, t: T0, payload: 'lo del títere', movimientos: [minuto('t')] });
  const kt = familiaDe(serieE('t', 'vale@n1', sub.id));
  await eje.escribir({ autor: 't', sobre: sub.id, t: T0, payload: 'P del títere', movimientos: [minuto('t'), enJuego('t'),
    { token: 'P', ambito: sub.id, cantidad: 5, de: null, a: 't' },
    { token: 'P', ambito: sub.id, cantidad: 5, de: 't', a: 't', estado: 'bloqueo', salida: kt }] });
  await assert.rejects(eje.escribir({ autor: 't', sobre: sub.id, t: T0, payload: 'E del títere', movimientos: [minuto('t'), enJuego('t'),
    { token: 'E', emisor: 't', denominacion: 'vale@n1', registro: sub.id, cantidad: 1, de: null, a: 't' }] }), /cuota de E:t\/vale@n1/);
  assert.deepEqual(respaldoParaAutorizar(eje, 't', c.id), []);
  assert.equal(estadoDe(eje, c.id), 'PENDIENTE DE AUTORIZACIÓN');
});

test('solo cuenta el P que respalda E vivo del recurso: no un bloqueo hacia una serie que no existe ni hacia E de otro dominio', async () => {
  const { eje, A } = await mundo({ respalda: 0 });
  await reparte(eje, A, { p1: 3 });
  // p1 bloquea su P:A hacia una serie de E que nadie emitió: no la respalda, se suelta cuando quiera, no cuenta.
  await eje.escribir({ autor: 'p1', sobre: A, t: T0, payload: 'hacia nada', movimientos: [minuto('p1'), { token: 'P', ambito: A, cantidad: 3, de: 'p1', a: 'p1', estado: 'bloqueo', salida: 'E:casa/fantasma@*@' + A }] });
  const c = await consolidacion(eje, A);
  assert.deepEqual(respaldoParaAutorizar(eje, 'p1', c.id), []);
  await assert.rejects(autorizar(eje, { autorizante: 'p1', consolidacion: c.id, t: T0 }), /p1 no tiene P que cuente para autorizar/);
  // Otro dominio de la casa (B, con su propia cama): su P:B respaldando E de B no cuenta para lo que se consolida en A.
  const B = (await eje.escribir({ autor: 'casa', sobre: eje.genesisId, t: T0, movimientos: [minuto('casa')], payload: ['Otro alojamiento', ['plazas'], 2] })).id;
  await eje.escribir({ autor: 'casa', sobre: B, t: T0, payload: 'P y cama en B', movimientos: [minuto('casa'), enJuego('casa'),
    { token: 'P', ambito: B, cantidad: 2, de: null, a: 'casa' },
    { token: 'P', ambito: B, cantidad: 2, de: 'casa', a: 'casa', estado: 'bloqueo', salida: familiaDe(serieE('casa', 'cama@n1', B)) },
    { token: 'E', emisor: 'casa', denominacion: 'cama@n1', registro: B, cantidad: 1, de: null, a: 'casa' }] });
  assert.deepEqual(respaldoParaAutorizar(eje, 'casa', c.id), []);
});

test('ejecutar no libera el P que respalda: solo el bloqueado con salida = la consolidación; el respaldo sigue y cuenta para la siguiente', async () => {
  const { eje, A, familia } = await mundo({ pA: 8, respalda: 5 }); // 5 de 8 respaldan la cama (cuota 5 × 4 / 8 = 2, emite 1)
  await reparte(eje, A, { bea: 1 });
  const c = await consolidacion(eje, A);
  await autorizar(eje, { autorizante: 'bea', consolidacion: c.id, cantidad: 1, t: T0 }); // la autora bloquea su P:A
  await autorizar(eje, { autorizante: 'casa', consolidacion: c.id, t: T0 }); // la casa, con el que respalda: 6 de 8
  assert.deepEqual([pesoAutorizacion(eje, c.id).directo, pesoAutorizacion(eje, c.id).respaldo, estadoDe(eje, c.id)], [1, 5, 'AUTORIZADO']);
  const e = await ejecutar(eje, { autor: 'bea', consolidacion: c.id, t: T0 });
  assert.equal(estadoDe(eje, c.id), 'EJECUTADO');
  // La ejecución libera el P de la autora bloqueado por la consolidación, y nada del respaldo.
  assert.deepEqual(e.movimientos.filter((m) => m.estado === 'liberacion').map((m) => [m.de, m.cantidad, m.salida]), [['bea', 1, c.id]]);
  assert.deepEqual([eje.saldo('bea', 'P:' + A), eje.bloqueado('casa', 'P:' + A, familia), eje.bloqueado('casa', 'P:' + A, c.id)], [1, 5, 0]);
  // Ni la casa lo suelta mientras viva la cama.
  await assert.rejects(eje.escribir({ autor: 'casa', sobre: A, t: T0, payload: 'suelta', movimientos: [minuto('casa'), { token: 'P', ambito: A, cantidad: 5, de: 'casa', a: 'casa', estado: 'liberacion', salida: familia }] }), /no se libera mientras viva/);
  // El mismo P respalda y vale para otra consolidación, con otro acto de voluntad (5 de 8: más de la mitad).
  const otra = await consolidacion(eje, A);
  assert.equal(estadoDe(eje, otra.id), 'PENDIENTE DE AUTORIZACIÓN');
  await autorizar(eje, { autorizante: 'casa', consolidacion: otra.id, t: T0 });
  assert.equal(estadoDe(eje, otra.id), 'AUTORIZADO');
  // Y la evidencia de la ejecución cita las dos autorizaciones (la del bloqueo y el acto); las capas de validez, que
  // leen el libro de justo antes de la ejecución, la dan por autorizada (sin el respaldo, 1 de 8 no bastaba).
  assert.equal(e.contexto.evidencia.length, 3);
  assert.equal((await validez(eje, e.id)).permiso.estado, 'ok');
});

test('neutralidad: repartir el mismo P que respalda entre k identidades no cambia el estado (ni respaldar en vez de bloquear por la consolidación)', async () => {
  // La casa acuña 10 P:A, respalda la cama con 3 y reparte S entre k identidades, que lo bloquean hacia la misma familia
  // (inmovilizado mientras viva la cama) y dicen que autorizan con él. Con 5 de 10 no basta (más de la mitad); con 6, sí.
  const partes = (S, k) => Array.from({ length: k }, (_, i) => Math.floor(S / k) + (i < S % k ? 1 : 0));
  for (const S of [5, 6]) {
    const estados = new Set();
    for (const k of [1, 2, 3, 5]) {
      for (const modo of ['respaldo', 'bloqueo']) {
        const { eje, A, familia } = await mundo({ pA: 10, respalda: 3 });
        const ids = ['p1', 'p2', 'p3', 'p4', 'p5'].slice(0, k);
        const cuanto = partes(S, k);
        await reparte(eje, A, Object.fromEntries(ids.map((id, i) => [id, cuanto[i]])));
        const c = await consolidacion(eje, A);
        for (const [i, id] of ids.entries()) {
          if (modo === 'respaldo') {
            await eje.escribir({ autor: id, sobre: A, t: T0, payload: unico('respaldo'), movimientos: [minuto(id), { token: 'P', ambito: A, cantidad: cuanto[i], de: id, a: id, estado: 'bloqueo', salida: familia }] });
            await autorizar(eje, { autorizante: id, consolidacion: c.id, t: T0 });
          } else {
            await autorizar(eje, { autorizante: id, consolidacion: c.id, cantidad: cuanto[i], t: T0 });
          }
        }
        const peso = pesoAutorizacion(eje, c.id);
        assert.equal(peso.bloqueado, S, 'S=' + S + ' k=' + k + ' ' + modo);
        estados.add(estadoDe(eje, c.id));
      }
    }
    assert.deepEqual([...estados], [S === 5 ? 'PENDIENTE DE AUTORIZACIÓN' : 'AUTORIZADO']);
  }
});
