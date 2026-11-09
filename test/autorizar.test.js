// Autorizar es bloquear P sobre el registro del recurso, con el umbral del
// dueño (VG, 7-11 noche: «La segunda»; R5 de docs/notas/NEUTRALIDAD_IDENTIDAD.md;
// src/autorizacion.js). Una prueba positiva y una negativa por regla.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Eje } from '../src/eje.js';
import {
  consolidar, autorizar, ejecutar, liberar, estadoDe, puedeAutorizar, recursoDe, pesoAutorizacion, autorizacionesValidas,
  autorizacionCaducada, leerUmbral, FABRICA, PLAZO_AUTORIZACION, UMBRAL_POR_DEFECTO,
} from '../src/motor.js';
import { validez } from '../src/validez.js';

const T0 = '2026-11-07T22:00:00Z';
// Las altas, un mes antes de T0 (ya no hace falta: cada persona escribe con su asignación de T del día (VG, 8-11)).
const ALTA = '2026-10-07T22:00:00Z';
const gasta = (de, cantidad = 1) => ({ token: 'T', escala: 'minuto', cantidad, de, a: null });
const daP = (de, a, cantidad, ambito) => ({ token: 'P', ambito, cantidad, de, a });
let n = 0;
const unico = (texto) => texto + ' #' + (++n);

/**
 * Génesis «g» (persona, 10 P sobre todo el eje); altas de la dueña «d», de «a», «b» y de un títere «t»; la dueña
 * escribe su registro X sobre el génesis (la raíz de su dominio) con `criterio` en su 2 y, si `pX`, emite P:X
 * una vez (T + R + P). Devuelve el eje y X.
 */
async function mundo({ criterio = 'sin humo', pX = 100 } = {}) {
  const eje = await Eje.genesis({
    demostracion: true, // sin claves: un eje de demostración (R9)
    identidad: 'g', t: ALTA, foco: ['raíz'],
    emision: [{ token: 'P', ambito: 'genesis', cantidad: 10 }, { token: 'E', denominacion: 'minuto', cantidad: 5000 }],
  });
  const ids = ['d', 'a', 'b', 't'];
  // T no cruza de persona (VG, 7-11 noche): las altas reciben minutos de g como E (E:g/minuto); cada una escribe con su T.
  // B1 (VG, 10-11): las personas escriben su propia alta; persona o cosa se lee de quién la escribe.
  for (const id of ids) await eje.entrar({ identidad: id, t: ALTA });
  await eje.escribir({ autor: 'g', sobre: eje.genesisId, t: ALTA, payload: 'altas',
    movimientos: [gasta('g'), ...ids.map((a) => ({ token: 'E', emisor: 'g', denominacion: 'minuto', cantidad: 300, de: 'g', a }))] });
  const X = await eje.escribir({ autor: 'd', sobre: eje.genesisId, t: T0, payload: ['recurso de d', 'una sala', criterio], movimientos: [gasta('d', 3)] });
  if (pX) {
    await eje.escribir({ autor: 'd', sobre: X.id, t: T0, payload: 'poder sobre la sala', movimientos: [gasta('d'),
      { token: 'R', emisor: 'd', cantidad: 2, de: null, a: 'd' }, { token: 'R', emisor: 'd', cantidad: 0.5, de: 'd', a: 'd', estado: 'bloqueo', salida: 'R:d' }, { token: 'R', emisor: 'd', cantidad: 1, de: 'd', a: 'a' },
      { token: 'P', ambito: X.id, cantidad: pX, de: null, a: 'd' }] });
  }
  return { eje, X: X.id };
}

/** La dueña reparte su P:X: { identidad: cantidad }. */
async function reparte(eje, X, cuanto) {
  await eje.escribir({ autor: 'd', sobre: X, t: T0, payload: unico('reparto'), movimientos: [gasta('d'), ...Object.entries(cuanto).map(([a, c]) => daP('d', a, c, X))] });
}

const consolidacionDe = (eje, autor, foco) => consolidar(eje, { autor, foco, t: T0, elecciones: { 1: unico('reservo la sala') } });

test('umbral por defecto: más de la mitad del P:X emitido; 49 % no autoriza, 50 % tampoco, 51 % sí', async () => {
  const { eje, X } = await mundo();
  await reparte(eje, X, { b: 49 });
  const c = await consolidacionDe(eje, 'a', X);
  assert.equal(recursoDe(eje, c.id), X);
  const a1 = await autorizar(eje, { autorizante: 'b', consolidacion: c.id, t: T0 });
  assert.deepEqual(a1.movimientos[1], { token: 'P', ambito: X, cantidad: 49, de: 'b', a: 'b', estado: 'bloqueo', salida: c.id });
  assert.deepEqual([pesoAutorizacion(eje, c.id).bloqueado, estadoDe(eje, c.id)], [49, 'PENDIENTE DE AUTORIZACIÓN']);
  await reparte(eje, X, { b: 1 });
  await autorizar(eje, { autorizante: 'b', consolidacion: c.id, t: T0, nota: 'uno más' });
  assert.deepEqual([pesoAutorizacion(eje, c.id).bloqueado, estadoDe(eje, c.id)], [50, 'PENDIENTE DE AUTORIZACIÓN']); // la mitad justa no basta
  await reparte(eje, X, { b: 1 });
  await autorizar(eje, { autorizante: 'b', consolidacion: c.id, t: T0, nota: 'y otro' });
  assert.deepEqual([pesoAutorizacion(eje, c.id).bloqueado, estadoDe(eje, c.id)], [51, 'AUTORIZADO']);
  assert.deepEqual(pesoAutorizacion(eje, c.id).umbral, UMBRAL_POR_DEFECTO);
  // Ya autorizada, autorizar() no bloquea más.
  await reparte(eje, X, { b: 1 });
  await assert.rejects(autorizar(eje, { autorizante: 'b', consolidacion: c.id, t: T0, nota: 'más' }), /ya está autorizado/);
});

test('el umbral lo fija el dueño en su posición 2: «umbral a/b» o «umbral 0.x»; basta alcanzarlo', async () => {
  const casos = [['umbral 1/4', 24, 25], ['umbral 0.75', 74, 75], [['sin humo', 'umbral 2/3'], 66, 67]];
  for (const [criterio, noBasta, basta] of casos) {
    const { eje, X } = await mundo({ criterio });
    await reparte(eje, X, { b: basta });
    const c = await consolidacionDe(eje, 'a', X);
    await autorizar(eje, { autorizante: 'b', consolidacion: c.id, cantidad: noBasta, t: T0 });
    assert.equal(estadoDe(eje, c.id), 'PENDIENTE DE AUTORIZACIÓN', JSON.stringify(criterio));
    await autorizar(eje, { autorizante: 'b', consolidacion: c.id, cantidad: basta - noBasta, t: T0 });
    assert.equal(estadoDe(eje, c.id), 'AUTORIZADO', JSON.stringify(criterio));
    assert.equal(pesoAutorizacion(eje, c.id).umbral.declarado, true);
  }
  // Una sola forma: lo que no se lee no se adivina, rige el de por defecto y se avisa.
  assert.deepEqual(leerUmbral('umbral 2/3'), { num: 2, den: 3, valor: 2 / 3, texto: 'umbral 2/3' });
  for (const malo of ['umbral 3/2', 'umbral 0', 'umbral 1/0', 'umbral dos tercios', 'umbral -1/2', '2/3']) assert.equal(leerUmbral(malo), null, malo);
  const { eje, X } = await mundo({ criterio: 'umbral 3/2' });
  const c = await consolidacionDe(eje, 'a', X);
  const { umbral } = pesoAutorizacion(eje, c.id);
  assert.equal(umbral.estricto, true);
  assert.match(umbral.aviso, /umbral ilegible en el 2 de [0-9a-f]{8} \(«umbral 3\/2»\): rige más de la mitad/);
  // Lo que otro ancla en el 2 de X no es el criterio del dueño.
  await eje.escribir({ autor: 'a', sobre: X, en: '2000000000', t: T0, payload: 'umbral 1/100', movimientos: [gasta('a')] });
  assert.equal(pesoAutorizacion(eje, c.id).umbral.texto, 'más de la mitad');
});

test('el autor cuenta como cualquiera: su P bloqueado suma, pero solo no basta si no llega al umbral', async () => {
  const { eje, X } = await mundo();
  await reparte(eje, X, { a: 30, b: 25 });
  const c = await consolidacionDe(eje, 'a', X);
  assert.equal(puedeAutorizar(eje, 'a', c.id), true); // desaparece «no ser el autor»
  const propia = await autorizar(eje, { autorizante: 'a', consolidacion: c.id, t: T0 });
  assert.equal(estadoDe(eje, c.id), 'PENDIENTE DE AUTORIZACIÓN'); // 30 de 100
  await autorizar(eje, { autorizante: 'b', consolidacion: c.id, t: T0 });
  assert.equal(estadoDe(eje, c.id), 'AUTORIZADO'); // 55 de 100: la del autor cuenta
  assert.deepEqual(autorizacionesValidas(eje, c.id).map((x) => x.autor), ['a', 'b']);
  assert.equal(autorizacionesValidas(eje, c.id)[0].id, propia.id);
  // Y la dueña, con lo que le queda (45 de 100), sola tampoco autorizaría otra.
  const otra = await consolidacionDe(eje, 'd', X);
  await autorizar(eje, { autorizante: 'd', consolidacion: otra.id, t: T0 });
  assert.equal(estadoDe(eje, otra.id), 'PENDIENTE DE AUTORIZACIÓN');
});

test('un títere sin P:X no autoriza nada: ni con P del eje donde X tiene P propio, ni escribiendo «autorizado» a mano', async () => {
  const { eje, X } = await mundo();
  // El génesis le da al títere todo su P del eje.
  await eje.escribir({ autor: 'g', sobre: eje.genesisId, t: T0, payload: 'todo para t', movimientos: [gasta('g'), daP('g', 't', 10, 'genesis')] });
  const c = await consolidacionDe(eje, 'a', X);
  assert.equal(puedeAutorizar(eje, 't', c.id), false);
  await assert.rejects(autorizar(eje, { autorizante: 't', consolidacion: c.id, t: T0 }), /t no tiene P que cuente para autorizar: cuenta el P sobre el registro del recurso [0-9a-f]{8} \(P:[0-9a-f]{8}\)/);
  // A mano: un «autorizado» que bloquea P del eje con la consolidación de salida no cuenta.
  await eje.escribir({ autor: 't', sobre: c.id, en: FABRICA, t: T0, payload: '==autorizo', contexto: { motor: 'fabrica', fase: 'autorizado' },
    movimientos: [gasta('t'), { token: 'P', ambito: 'genesis', cantidad: 10, de: 't', a: 't', estado: 'bloqueo', salida: c.id }] });
  assert.equal(estadoDe(eje, c.id), 'PENDIENTE DE AUTORIZACIÓN');
  assert.deepEqual(autorizacionesValidas(eje, c.id), []);
  // Ni un subregistro del títere dentro de X con su P propio emitido: no es de la cadena de autoridad de la dueña (ni lo
  // escribió ella ni el títere tiene P:X), así que se salta (VG, 8-11, con la salvedad del autor de Core, [X]) y el
  // recurso sigue siendo X; su P sobre el subregistro no es P:X.
  const sub = await eje.escribir({ autor: 't', sobre: X, t: T0, payload: 'lo del títere', movimientos: [gasta('t')] });
  await eje.escribir({ autor: 't', sobre: sub.id, t: T0, payload: 'poder del títere', movimientos: [gasta('t'),
    { token: 'R', emisor: 't', cantidad: 2, de: null, a: 't' }, { token: 'R', emisor: 't', cantidad: 0.5, de: 't', a: 't', estado: 'bloqueo', salida: 'R:t' }, { token: 'R', emisor: 't', cantidad: 1, de: 't', a: 'a' }, { token: 'P', ambito: sub.id, cantidad: 1, de: null, a: 't' }] });
  const debajo = await consolidacionDe(eje, 'a', sub.id);
  assert.equal(recursoDe(eje, debajo.id), X);
  assert.equal(puedeAutorizar(eje, 't', debajo.id), false);
});

test('VG, 8-11: el registro del recurso es el más cercano del hilo con P propio emitido; si no hay ninguno, el génesis', async () => {
  const { eje, X } = await mundo();
  await reparte(eje, X, { b: 60 });
  // La dueña escribe una habitación dentro de X y la gobierna aparte: acuña P:H y da 3 de 4 a «a».
  const H = await eje.escribir({ autor: 'd', sobre: X, t: T0, payload: 'habitación', movimientos: [gasta('d')] });
  await eje.escribir({ autor: 'd', sobre: H.id, t: T0, payload: 'poder sobre la habitación', movimientos: [gasta('d'),
    { token: 'R', emisor: 'd', cantidad: 1, de: null, a: 'd' }, { token: 'R', emisor: 'd', cantidad: 1, de: 'd', a: 'a' },
    { token: 'P', ambito: H.id, cantidad: 4, de: null, a: 'd' }, daP('d', 'a', 3, H.id)] });
  const reserva = await eje.escribir({ autor: 'b', sobre: H.id, t: T0, payload: 'reserva de b', movimientos: [gasta('b')] });
  // Habitación con P propio: autoriza su P, no el de la casa (b tiene 60 de 100 P:X y no cuenta ahí).
  const c = await consolidacionDe(eje, 'b', reserva.id);
  assert.equal(recursoDe(eje, c.id), H.id);
  assert.deepEqual(pesoAutorizacion(eje, c.id).claves, ['P:' + H.id]);
  assert.equal(puedeAutorizar(eje, 'b', c.id), false);
  await assert.rejects(autorizar(eje, { autorizante: 'b', consolidacion: c.id, t: T0 }), /b no tiene P que cuente/);
  await autorizar(eje, { autorizante: 'a', consolidacion: c.id, t: T0 });
  assert.equal(estadoDe(eje, c.id), 'AUTORIZADO');
  // Habitación sin P propio: manda la casa (X), con su P:X.
  const H2 = await eje.escribir({ autor: 'd', sobre: X, t: T0, payload: 'otra habitación', movimientos: [gasta('d')] });
  const c2 = await consolidacionDe(eje, 'a', H2.id);
  assert.equal(recursoDe(eje, c2.id), X);
  await autorizar(eje, { autorizante: 'b', consolidacion: c2.id, t: T0 });
  assert.equal(estadoDe(eje, c2.id), 'AUTORIZADO');
  // Una habitación escrita por quien tiene P delegado de la casa (b, con P:X): su P propio también manda.
  await liberar(eje, { titular: 'b', consolidacion: c2.id, t: T0 });
  const H3 = await eje.escribir({ autor: 'b', sobre: X, t: T0, payload: 'habitación que lleva b', movimientos: [gasta('b')] });
  await eje.escribir({ autor: 'b', sobre: H3.id, t: T0, payload: 'poder sobre la habitación de b', movimientos: [gasta('b'),
    { token: 'R', emisor: 'b', cantidad: 2, de: null, a: 'b' }, { token: 'R', emisor: 'b', cantidad: 0.5, de: 'b', a: 'b', estado: 'bloqueo', salida: 'R:b' }, { token: 'R', emisor: 'b', cantidad: 1, de: 'b', a: 'a' },
    { token: 'P', ambito: H3.id, cantidad: 2, de: null, a: 'b' }] });
  const c4 = await consolidacionDe(eje, 'd', H3.id);
  assert.equal(recursoDe(eje, c4.id), H3.id);
  await autorizar(eje, { autorizante: 'b', consolidacion: c4.id, t: T0 });
  assert.equal(estadoDe(eje, c4.id), 'AUTORIZADO');
  // El subregistro del proponente con P propio (ni lo escribió la dueña ni tiene P:X) no autoriza nada: se salta y
  // manda X, donde el proponente no tiene P. Queda PENDIENTE DE AUTORIZACIÓN.
  const suyo = await eje.escribir({ autor: 't', sobre: X, t: T0, payload: 'lo del proponente', movimientos: [gasta('t')] });
  await eje.escribir({ autor: 't', sobre: suyo.id, t: T0, payload: 'poder del proponente', movimientos: [gasta('t'),
    { token: 'R', emisor: 't', cantidad: 2, de: null, a: 't' }, { token: 'R', emisor: 't', cantidad: 0.5, de: 't', a: 't', estado: 'bloqueo', salida: 'R:t' }, { token: 'R', emisor: 't', cantidad: 1, de: 't', a: 'a' },
    { token: 'P', ambito: suyo.id, cantidad: 5, de: null, a: 't' }] });
  const c5 = await consolidacionDe(eje, 't', suyo.id);
  assert.equal(recursoDe(eje, c5.id), X);
  await assert.rejects(autorizar(eje, { autorizante: 't', consolidacion: c5.id, t: T0 }), /t no tiene P que cuente/);
  assert.equal(estadoDe(eje, c5.id), 'PENDIENTE DE AUTORIZACIÓN');
  // Nada emitido en todo el hilo: manda el génesis, con el P del eje.
  const Y = await eje.escribir({ autor: 'd', sobre: eje.genesisId, t: T0, payload: 'dominio sin P', movimientos: [gasta('d')] });
  const sub = await eje.escribir({ autor: 'a', sobre: Y.id, t: T0, payload: 'algo en Y', movimientos: [gasta('a')] });
  const c3 = await consolidacionDe(eje, 'a', sub.id);
  assert.deepEqual([recursoDe(eje, c3.id), pesoAutorizacion(eje, c3.id).delEje], [eje.genesisId, true]);
  assert.equal(puedeAutorizar(eje, 'g', c3.id), true);
});

/** Quien escribe `registro` acuña P propio sobre él (T + R en juego + P), como la dueña sobre X. */
async function acunaP(eje, autor, registro, cantidad = 2) {
  await eje.escribir({ autor, sobre: registro, t: T0, payload: unico('poder de ' + autor), movimientos: [gasta(autor),
    { token: 'R', emisor: autor, cantidad: 2, de: null, a: autor }, { token: 'R', emisor: autor, cantidad: 0.5, de: autor, a: autor, estado: 'bloqueo', salida: 'R:' + autor },
    { token: 'P', ambito: registro, cantidad, de: null, a: autor }] });
}

test('SEG-07 (revisión de seguridad de main, 8-11) un subdominio cuenta como recurso si su autor tiene P:raíz que alcanza el umbral de la raíz, o si lo estableció una consolidación sobre la raíz AUTORIZADA', async () => {
  // La dueña emite 4 P:X y reparte: 3 a b (la recepción) y una décima a «a».
  const { eje, X } = await mundo({ pX: 4 });
  await reparte(eje, X, { b: 3, a: 0.1 });

  // Recepción con 3 de 4 P:X (más de la mitad, el umbral de X): su habitación con P propio manda.
  const H = await eje.escribir({ autor: 'b', sobre: X, t: T0, payload: 'habitación de recepción', movimientos: [gasta('b')] });
  await acunaP(eje, 'b', H.id);
  const cH = await consolidacionDe(eje, 'd', H.id);
  assert.equal(recursoDe(eje, cH.id), H.id);
  await autorizar(eje, { autorizante: 'b', consolidacion: cH.id, t: T0 });
  assert.equal(estadoDe(eje, cH.id), 'AUTORIZADO');

  // El delegado con una décima de P:X (0,1 de 4) no fabrica un subdominio: su registro con P propio se salta y manda X,
  // donde lo suyo no llega al umbral. Antes bastaba P > 0.
  const A = await eje.escribir({ autor: 'a', sobre: X, t: T0, payload: 'lo de a', movimientos: [gasta('a')] });
  await acunaP(eje, 'a', A.id, 5);
  const cA = await consolidacionDe(eje, 'a', A.id);
  assert.equal(recursoDe(eje, cA.id), X);
  await autorizar(eje, { autorizante: 'a', consolidacion: cA.id, t: T0 }); // bloquea su 0,1 de P:X: no llega
  assert.equal(estadoDe(eje, cA.id), 'PENDIENTE DE AUTORIZACIÓN');
  await assert.rejects(ejecutar(eje, { autor: 'a', consolidacion: cA.id, t: T0 }), /PENDIENTE DE AUTORIZACIÓN/);

  // Un subdominio establecido por una consolidación sobre X que quedó AUTORIZADA: el títere (sin P) lo propone, la
  // recepción lo autoriza con su P:X y el títere lo escribe citándola en contexto.subdominio.
  const cS = await consolidar(eje, { autor: 't', foco: X, t: T0, elecciones: { 1: 'un rincón que gobierna t' } });
  const sub = (autor, citada) => eje.escribir({ autor, sobre: X, t: T0, payload: unico('rincón de ' + autor), contexto: { subdominio: citada }, movimientos: [gasta(autor)] });
  // Mientras la consolidación está pendiente, el registro que la cita no cuenta.
  const S0 = await sub('t', cS.id);
  await acunaP(eje, 't', S0.id);
  const cS0 = await consolidacionDe(eje, 'd', S0.id);
  assert.equal(recursoDe(eje, cS0.id), X);
  await autorizar(eje, { autorizante: 'b', consolidacion: cS.id, t: T0 });
  assert.equal(estadoDe(eje, cS.id), 'AUTORIZADO');
  // Autorizada, sí: el mismo registro, ya leído con la consolidación autorizada, y uno nuevo.
  assert.equal(recursoDe(eje, cS0.id), S0.id);
  const S = await sub('t', cS.id);
  await acunaP(eje, 't', S.id);
  const cDeS = await consolidacionDe(eje, 'b', S.id);
  assert.equal(recursoDe(eje, cDeS.id), S.id);
  await autorizar(eje, { autorizante: 't', consolidacion: cDeS.id, t: T0 });
  assert.equal(estadoDe(eje, cDeS.id), 'AUTORIZADO');
  // Ejecutada, sigue contando.
  await ejecutar(eje, { autor: 't', consolidacion: cS.id, t: T0 });
  assert.equal(estadoDe(eje, cS.id), 'EJECUTADO');
  assert.equal(recursoDe(eje, cDeS.id), S.id);
  // Citarla no sirve a otro autor que el de la consolidación, ni citar una que no va sobre la raíz.
  const ajeno = await sub('a', cS.id);
  await acunaP(eje, 'a', ajeno.id);
  assert.equal(recursoDe(eje, (await consolidacionDe(eje, 'd', ajeno.id)).id), X);
  const deOtra = await sub('t', cH.id); // cH va sobre H, no sobre X (y es de d)
  await acunaP(eje, 't', deOtra.id);
  assert.equal(recursoDe(eje, (await consolidacionDe(eje, 'd', deOtra.id)).id), X);

  // El escrito por la autora de la raíz sigue contando, sin P:X que alcance nada (la dueña se queda con 0,9 de 4).
  const D = await eje.escribir({ autor: 'd', sobre: X, t: T0, payload: 'lo de la dueña', movimientos: [gasta('d')] });
  await eje.escribir({ autor: 'd', sobre: D.id, t: T0, payload: 'poder sobre lo de la dueña', movimientos: [gasta('d'), { token: 'P', ambito: D.id, cantidad: 1, de: null, a: 'd' }] });
  assert.equal(recursoDe(eje, (await consolidacionDe(eje, 'a', D.id)).id), D.id);

  // Las capas de validez leen lo mismo: la autorización de «a» sobre su registro no cuenta para el umbral (falla la
  // ejecución escrita a mano).
  const aMano = { autor: 'a', sobre: cA.id, en: FABRICA, t: T0, payload: 'a mano', contexto: { motor: 'fabrica', fase: 'ejecutado', evidencia: [cA.id] }, movimientos: [gasta('a')], id: 'x' };
  const v = await validez(eje, aMano);
  assert.equal(v.permiso.estado, 'falla');
  assert.match(v.permiso.motivos.join(' '), /al ejecutar no estaba AUTORIZADA \(0\.1 de 4 P:[0-9a-f]{8} bloqueado; umbral: más de la mitad\)/);
});

test('P del eje: no cuenta donde X tiene P propio emitido, y sí donde no lo tiene (sobre lo emitido por el génesis)', async () => {
  const { eje, X } = await mundo();
  const c = await consolidacionDe(eje, 'a', X);
  assert.equal(puedeAutorizar(eje, 'g', c.id), false);
  await assert.rejects(autorizar(eje, { autorizante: 'g', consolidacion: c.id, t: T0 }), /g no tiene P que cuente/);
  // Un dominio sin P propio: manda el génesis (VG, 8-11), con el P del eje (10, todo en g). 5 no pasa de la mitad; 6 sí.
  const Y = await eje.escribir({ autor: 'd', sobre: eje.genesisId, t: T0, payload: 'otro dominio de d', movimientos: [gasta('d')] });
  const cy = await consolidacionDe(eje, 'a', Y.id);
  const peso = pesoAutorizacion(eje, cy.id);
  assert.deepEqual([peso.recurso, peso.delEje, peso.emitido], [eje.genesisId, true, 10]);
  await autorizar(eje, { autorizante: 'g', consolidacion: cy.id, cantidad: 5, t: T0 });
  assert.equal(estadoDe(eje, cy.id), 'PENDIENTE DE AUTORIZACIÓN');
  await autorizar(eje, { autorizante: 'g', consolidacion: cy.id, cantidad: 1, t: T0 });
  assert.equal(estadoDe(eje, cy.id), 'AUTORIZADO');
});

test('bloqueo liberado al ejecutar: el del autor en la propia ejecución; el de los demás queda liberable y lo libera su titular', async () => {
  const { eje, X } = await mundo();
  await reparte(eje, X, { a: 20, b: 40 });
  const c = await consolidacionDe(eje, 'a', X);
  await autorizar(eje, { autorizante: 'a', consolidacion: c.id, t: T0 });
  const ab = await autorizar(eje, { autorizante: 'b', consolidacion: c.id, t: T0 });
  assert.equal(estadoDe(eje, c.id), 'AUTORIZADO');
  // Nadie libera lo de otro, ni el autor al ejecutar.
  await assert.rejects(eje.escribir({ autor: 'a', sobre: c.id, en: FABRICA, t: T0, payload: 'x', movimientos: [gasta('a'), { token: 'P', ambito: X, cantidad: 40, de: 'b', a: 'b', estado: 'liberacion', salida: c.id }] }), /nadie mueve tokens ajenos/);
  const e = await ejecutar(eje, { autor: 'a', consolidacion: c.id, t: T0 });
  assert.deepEqual(e.movimientos.slice(1), [{ token: 'P', ambito: X, cantidad: 20, de: 'a', a: 'a', estado: 'liberacion', salida: c.id }]);
  assert.deepEqual(e.contexto.evidencia, [c.id, autorizacionesValidas(eje, c.id)[0].id, ab.id]);
  assert.deepEqual([eje.saldo('a', 'P:' + X), eje.bloqueado('a', 'P:' + X, c.id)], [20, 0]);
  assert.deepEqual([eje.saldo('b', 'P:' + X), eje.bloqueado('b', 'P:' + X, c.id)], [0, 40]); // liberable
  await liberar(eje, { titular: 'b', consolidacion: c.id, t: T0 });
  assert.deepEqual([eje.saldo('b', 'P:' + X), eje.bloqueado('b', 'P:' + X, c.id)], [40, 0]);
  await assert.rejects(liberar(eje, { titular: 'b', consolidacion: c.id, t: T0 }), /b no tiene P bloqueado por/);
  // Liberado todo, sigue EJECUTADO, y la capa 5 lee la ejecución con el P bloqueado de justo antes.
  assert.equal(estadoDe(eje, c.id), 'EJECUTADO');
  assert.equal((await validez(eje, e.id)).permiso.estado, 'ok');
});

test('retirar antes de ejecutar: quien bloqueó libera, la consolidación vuelve a PENDIENTE y no se ejecuta', async () => {
  const { eje, X } = await mundo();
  await reparte(eje, X, { b: 60 });
  const c = await consolidacionDe(eje, 'a', X);
  await autorizar(eje, { autorizante: 'b', consolidacion: c.id, t: T0 });
  assert.equal(estadoDe(eje, c.id), 'AUTORIZADO');
  await liberar(eje, { titular: 'b', consolidacion: c.id, t: T0, nota: 'lo retiro' });
  assert.equal(estadoDe(eje, c.id), 'PENDIENTE DE AUTORIZACIÓN');
  await assert.rejects(ejecutar(eje, { autor: 'a', consolidacion: c.id, t: T0 }), /PENDIENTE DE AUTORIZACIÓN/);
});

test('caducidad del bloqueo: un campo declarado (por defecto, un ciclo de 28 días); nada caduca ni se libera solo', async () => {
  const { eje, X } = await mundo();
  await reparte(eje, X, { b: 60 });
  const c = await consolidacionDe(eje, 'a', X);
  const a = await autorizar(eje, { autorizante: 'b', consolidacion: c.id, t: T0 });
  assert.equal(PLAZO_AUTORIZACION, 'ciclo');
  assert.equal(a.contexto.autoridad.caduca, '2026-12-05T22:00:00.000Z');
  assert.equal(autorizacionCaducada(eje, a.id, '2026-12-05T21:59:59Z'), false);
  assert.equal(autorizacionCaducada(eje, a.id, '2026-12-05T22:00:00Z'), true);
  assert.equal(estadoDe(eje, c.id), 'AUTORIZADO'); // el estado no lee el reloj: caducar no ejecuta nada
  // Sin plazo, no caduca.
  const otra = await consolidacionDe(eje, 'a', X);
  await liberar(eje, { titular: 'b', consolidacion: c.id, t: T0 });
  await assert.rejects(autorizar(eje, { autorizante: 'b', consolidacion: otra.id, plazo: 'quincena', t: T0 }), /plazo de autorización inválido/);
  const sinPlazo = await autorizar(eje, { autorizante: 'b', consolidacion: otra.id, plazo: null, t: T0 });
  assert.equal(sinPlazo.contexto.autoridad.caduca, null);
  assert.equal(autorizacionCaducada(eje, sinPlazo.id, '2099-01-01T00:00:00Z'), false);
});

test('cantidad: por defecto todo lo que cuenta; ni cero ni más de lo que se tiene', async () => {
  const { eje, X } = await mundo();
  await reparte(eje, X, { b: 10 });
  const c = await consolidacionDe(eje, 'a', X);
  await assert.rejects(autorizar(eje, { autorizante: 'b', consolidacion: c.id, cantidad: 11, t: T0 }), /la cantidad a bloquear va de 0 \(excluido\) a 10: 11/);
  await assert.rejects(autorizar(eje, { autorizante: 'b', consolidacion: c.id, cantidad: 0, t: T0 }), /la cantidad a bloquear/);
  const a = await autorizar(eje, { autorizante: 'b', consolidacion: c.id, t: T0 });
  assert.deepEqual(a.contexto.autoridad.bloquea, [{ clave: 'P:' + X, cantidad: 10 }]);
  assert.equal(a.contexto.autoridad.recurso, X);
});
