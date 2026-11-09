// R según el corpus y la lente del lector (encargo 3b; VG, 9-11, mapa §15 [D] «R según el corpus, confirmado» y
// «R, últimas dos»; §16 [D] «PV3 = regla de atención»). R se emite libremente por su emisor (sin colateral: se retira
// el de la #75), se transfiere entre tenedores sin cambiar de emisor (se corrige la #62), se liquida devolviéndola a su
// emisor (pedir atención), el emisor atiende con un registro suyo anclado sobre la petición, con T real, y el tenedor
// puede perdonarla quemándola. Su valor para un tercero solo existe con la lente del lector, que son sus grupos de
// atención que cobran con la R de quien escribe («aceptar tu R como pago es darte peso»), y cada unidad cuenta una (se
// retira la valoración por participación de la #75). Cada regla con su caso que pasa y el que no, las propiedades
// (identidades falsas, ampliar no diluye), BQL y una prueba estática.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { Eje } from '../src/eje.js';
import { crearEvento } from '../src/evento.js';
import { validez } from '../src/validez.js';
import { consultar } from '../src/bql.js';
import { serializar, restaurar } from '../src/persistencia.js';
import { PRECIO_LENTE, claveR, lenteDe, peso, valor, detalleValor, devoluciones, pendientes } from '../src/lente.js';
import { entrarPorInvitacion } from '../ejemplos/ikisai/altas.mjs';
import { ejemploLente, valoresParaLaCasa, valorEnBql, CERCANOS_DE_LA_CASA, RECIEN } from '../ejemplos/ikisai/lente-booking.mjs';

const T0 = '2026-11-08T10:00:00Z';
const AYER = '2026-11-07T10:00:00Z';
const minuto = (de, cantidad = 1) => ({ token: 'T', escala: 'minuto', cantidad, de, a: null });
const R = (emisor, cantidad, de, a) => ({ token: 'R', emisor, cantidad, de, a });
let cuenta = 0;
const unico = (x) => x + ' #' + (++cuenta);

/** Eje de demostración: las personas entran por invitación de «g» (encargo 3b) y g les da minutos como E (E:g/minuto). */
async function demo(ids) {
  const eje = await Eje.genesis({ demostracion: true, identidad: 'g', t: AYER, foco: 'raíz', emision: [{ token: 'R', cantidad: 1e6 }, { token: 'E', denominacion: 'minuto', cantidad: 1e6 }] });
  for (const id of ids) await entrarPorInvitacion(eje, { por: 'g', quien: id, t: AYER });
  const alta = await eje.escribir({
    autor: 'g', sobre: eje.genesisId, t: AYER, payload: 'altas',
    movimientos: [minuto('g'), ...ids.map((id) => ({ token: 'E', emisor: 'g', denominacion: 'minuto', cantidad: 1000, de: 'g', a: id }))],
  });
  // Revisión de seguridad (encargo 3b): escribir sobre el alta ajena (el génesis es el alta de g) tiene el precio de su
  // atención; lo de todos cuelga de un registro común que g escribe en el génesis.
  const plaza = await eje.escribir({ autor: 'g', sobre: eje.genesisId, t: AYER, payload: ['Plaza'], movimientos: [minuto('g')] });
  eje.plaza = plaza.id;
  return { eje, alta };
}

/** `emisor` emite `cantidad` de su R (emitir R exige T real: el minuto que quema) y reparte `a` ({ titular: cantidad }). */
async function emiteYDa(eje, emisor, cantidad, a = {}, sobre = eje.plaza) {
  return eje.escribir({
    autor: emisor, sobre, t: T0, payload: unico('R de ' + emisor),
    movimientos: [minuto(emisor), R(emisor, cantidad, null, emisor), ...Object.entries(a).map(([t, c]) => R(emisor, c, emisor, t))],
  });
}

/** El lector pone a `quienes` en su grupo de cercanos (la zona 3, cuyo precio es la R de quien escribe): su lente. */
async function cercanos(eje, lector, quienes) {
  return eje.escribir({ autor: lector, sobre: eje.alta(lector).id, en: '3330000000', t: T0, payload: [...quienes], movimientos: [minuto(lector)] });
}

// ---------- 1 · la lente: los grupos de atención del lector ----------

test('lente: los grupos de atención del lector que cobran con la R de quien escribe; los que nombra pesan 1', async () => {
  const { eje } = await demo(['casa', 'norte', 'sur', 'ana']);
  assert.equal(PRECIO_LENTE, 'their R');
  // Con alta y sin nadie en sus grupos que cobran con R, la lente está vacía: nadie pesa.
  assert.deepEqual([...lenteDe(eje, 'casa').pesos], []);
  assert.deepEqual(lenteDe(eje, 'casa').grupos, [3]); // solo cercanos cobra con «their R» por defecto (epoch.1.2.1; el equipo, desde el 3c-2a, con «open record»)
  assert.equal(peso(eje, 'casa', 'norte'), 0);
  assert.equal(lenteDe(eje, 'nadie'), null); // sin alta no hay lente
  assert.equal(peso(eje, 'nadie', 'norte'), null);
  await cercanos(eje, 'casa', ['norte', 'sur']);
  assert.deepEqual([...lenteDe(eje, 'casa').pesos], [['norte', 1], ['sur', 1]]);
  assert.deepEqual([peso(eje, 'casa', 'norte'), peso(eje, 'casa', 'sur'), peso(eje, 'casa', 'ana')], [1, 1, 0]); // quien no está, pesa 0
  // Corregir es añadir: si la casa cambia el precio de sus cercanos (3.3.2), ese grupo deja de ser lente (gana el último).
  await eje.escribir({ autor: 'casa', sobre: eje.alta('casa').id, en: '3320000000', t: T0, payload: [['E'], [1]], movimientos: [minuto('casa')] });
  assert.deepEqual([...lenteDe(eje, 'casa').pesos], []);
});

test('lente: no cuenta lo que otro escribe en los grupos del lector, ni el lector en otra posición', async () => {
  const { eje } = await demo(['casa', 'norte', 'intruso']);
  const alta = eje.alta('casa').id;
  // Otro ancla nombres en el 3.3.3 del alta de la casa: no son sus cercanos (solo cuenta lo que ancla la casa). Revisión
  // de seguridad (encargo 3b): sin el precio de su grupo ni siquiera entra; pagándolo (desconocidos: la R de la casa,
  // devuelta), entra y sigue sin contar.
  await emiteYDa(eje, 'casa', 10, { intruso: 1 });
  await assert.rejects(eje.escribir({ autor: 'intruso', sobre: alta, en: '3330000000', t: T0, payload: ['intruso'], movimientos: [minuto('intruso')] }), /attention has a price/);
  await eje.escribir({ autor: 'intruso', sobre: alta, en: '3330000000', t: T0, payload: ['intruso'], movimientos: [minuto('intruso'), R('casa', 1, 'intruso', 'casa')] });
  assert.deepEqual([...lenteDe(eje, 'casa').pesos], []);
  // El intruso en su propia alta sí: su lente, que no cambia la de nadie.
  await cercanos(eje, 'intruso', ['norte']);
  assert.equal(peso(eje, 'intruso', 'norte'), 1);
  assert.deepEqual([...lenteDe(eje, 'casa').pesos], []);
  // La casa en otra posición de su alta (2.3, sus criterios) no toca su atención.
  await eje.escribir({ autor: 'casa', sobre: alta, en: '2300000000', t: T0, payload: ['norte'], movimientos: [minuto('casa')] });
  assert.deepEqual([...lenteDe(eje, 'casa').pesos], []);
});

test('lente: recibir R nunca mete a su emisor en la lente del receptor', async () => {
  const { eje } = await demo(['casa', 'norte', 'pesado']);
  await cercanos(eje, 'casa', ['norte']);
  await emiteYDa(eje, 'pesado', 1e6, { casa: 5e5 });
  assert.equal(eje.saldo('casa', 'R:pesado'), 5e5);
  assert.deepEqual([...lenteDe(eje, 'casa').pesos], [['norte', 1]]);
  assert.equal(peso(eje, 'casa', 'pesado'), 0);
});

// ---------- 2 · el valor, por unidad ----------

test('valor = Σ peso × unidades de R de los emisores de la lente; la R propia y la de emisores no nombrados valen 0', async () => {
  const { eje } = await demo(['casa', 'norte', 'sur', 'ana', 'nuevo']);
  await emiteYDa(eje, 'norte', 100, { ana: 10 });
  await emiteYDa(eje, 'sur', 100, { ana: 20 });
  await emiteYDa(eje, 'nuevo', 1e6, { ana: 5e5 }); // se autoemite mucha y la reparte
  assert.equal(valor(eje, 'casa', 'ana'), 0); // nadie en su lente
  assert.equal(valor(eje, 'nadie', 'ana'), null); // sin alta, sin lente: no hay valor
  await cercanos(eje, 'casa', ['norte', 'sur']);
  assert.equal(valor(eje, 'casa', 'ana'), 30); // 10 + 20: cada unidad cuenta una
  assert.equal(valor(eje, 'casa', 'nuevo'), 0); // su propia R no la avala nadie
  assert.equal(valor(eje, 'casa', 'norte'), 0); // la R propia no vale ante nadie
  const d = detalleValor(eje, 'casa', 'ana');
  assert.deepEqual(d.porEmisor.map((x) => [x.emisor, x.peso, x.saldo, x.aporte]), [['norte', 1, 10, 10], ['sur', 1, 20, 20]]);
  // Otro lector, otra lente, otro valor: R no tiene un valor propio.
  await cercanos(eje, 'sur', ['nuevo']);
  assert.equal(valor(eje, 'sur', 'ana'), 5e5);
});

test('ampliar R:X no diluye a quien ya la tiene: cada unidad cuenta una', async () => {
  const { eje } = await demo(['casa', 'norte', 'ana', 'bea']);
  await cercanos(eje, 'casa', ['norte']);
  await emiteYDa(eje, 'norte', 100, { ana: 10 });
  assert.equal(valor(eje, 'casa', 'ana'), 10);
  await emiteYDa(eje, 'norte', 900, { bea: 10 });
  assert.equal(valor(eje, 'casa', 'ana'), 10); // no baja
  assert.equal(valor(eje, 'casa', 'bea'), 10);
  // Devolver parte (pedir atención) la quita de quien la devuelve.
  await eje.escribir({ autor: 'ana', sobre: eje.plaza, t: T0, payload: 'te pido atención', movimientos: [minuto('ana'), R('norte', 5, 'ana', 'norte')] });
  assert.equal(valor(eje, 'casa', 'ana'), 5);
});

// ---------- 3 · emitir, transferir, devolver, atender y perdonar ----------

test('emitir R: solo su emisor, sin colateral; exige T real en la misma transacción (VG, 8-11 tarde, N3)', async () => {
  const { eje } = await demo(['ana', 'bea']);
  // Sin colateral (VG, 9-11: el respaldo es la obligación de atender).
  await eje.escribir({ autor: 'ana', sobre: eje.plaza, t: T0, payload: 'mi R', movimientos: [minuto('ana'), R('ana', 10, null, 'ana')] });
  assert.equal(eje.saldo('ana', 'R:ana'), 10);
  assert.equal(eje.bloqueado('ana', 'R:ana'), 0);
  // Sin T real (solo T informativo), no.
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: eje.plaza, t: T0, payload: 'x',
    movimientos: [{ token: 'T', escala: 'inventado', cantidad: 1, de: 'ana', a: null }, R('ana', 10, null, 'ana')] }), /minting R needs real T/);
  // Nadie emite la R de otro, ni a nombre de un grupo (VG, 8-11).
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: eje.plaza, t: T0, payload: 'x', movimientos: [minuto('ana'), R('bea', 30, null, 'bea')] }),
    /R is minted by its issuer/);
});

test('R se transfiere entre tenedores sin cambiar de emisor, y el tenedor puede perdonarla (quemarla): la obligación baja', async () => {
  const { eje } = await demo(['ana', 'bea', 'cris']);
  await emiteYDa(eje, 'ana', 10, { bea: 4 });
  assert.equal(eje.obligaciones('ana'), 4);
  // Se corrige la #62: bea la pasa a cris; sigue siendo R:ana (su emisor no cambia).
  await eje.escribir({ autor: 'bea', sobre: eje.plaza, t: T0, payload: 'te la paso', movimientos: [minuto('bea'), R('ana', 2, 'bea', 'cris')] });
  assert.deepEqual([eje.saldo('bea', claveR('ana')), eje.saldo('cris', claveR('ana')), eje.obligaciones('ana')], [2, 2, 4]);
  // Perdonar (VG, 9-11, «R, últimas dos»): cris quema la que tiene sin pedir atención; la obligación de ana se extingue.
  await eje.escribir({ autor: 'cris', sobre: eje.plaza, t: T0, payload: 'te la perdono', movimientos: [minuto('cris'), R('ana', 2, 'cris', null)] });
  assert.deepEqual([eje.saldo('cris', claveR('ana')), eje.obligaciones('ana')], [0, 2]);
  // Nadie mueve la R de otro tenedor.
  await assert.rejects(eje.escribir({ autor: 'cris', sobre: eje.plaza, t: T0, payload: 'x', movimientos: [minuto('cris'), R('ana', 1, 'bea', 'cris')] }), /nobody moves tokens of others/);
});

test('devolver R es pedir atención; atender es un registro del emisor anclado sobre la petición, con T real (VG, 9-11)', async () => {
  const { eje } = await demo(['ana', 'bea', 'otra']);
  await emiteYDa(eje, 'ana', 10, { bea: 4 });
  const dev = await eje.escribir({ autor: 'bea', sobre: eje.plaza, t: T0, payload: 'ana, te pido atención', movimientos: [minuto('bea'), R('ana', 1, 'bea', 'ana')] });
  assert.deepEqual(pendientes(eje, 'ana'), [dev.id]);
  assert.deepEqual(devoluciones(eje, 'ana').map((d) => [d.id, d.de, d.cantidad, d.atencion]), [[dev.id, 'bea', 1, null]]);
  // Lo que escribe otro sobre la petición no la atiende; ni lo que el emisor paga solo con T informativo (no es presente).
  await eje.escribir({ autor: 'otra', sobre: dev.id, t: T0, payload: 'yo no soy ana', movimientos: [minuto('otra')] });
  await eje.escribir({ autor: 'ana', sobre: dev.id, t: T0, payload: 'luego', movimientos: [{ token: 'T', escala: 'inventado', cantidad: 1, de: 'ana', a: null }] });
  assert.deepEqual(pendientes(eje, 'ana'), [dev.id]);
  // El emisor la atiende con un registro suyo anclado sobre ella, con T real.
  const at = await eje.escribir({ autor: 'ana', sobre: dev.id, t: T0, payload: 'te atiendo', movimientos: [minuto('ana')] });
  assert.deepEqual(pendientes(eje, 'ana'), []);
  // La atención es el registro que atiende (presente), no el primero del emisor sobre la petición.
  assert.equal(devoluciones(eje, 'ana')[0].atencion, at.id);
  // Las capas de validez leen las mismas reglas: emitir R sin T real falla.
  const sinT = await crearEvento({ autor: 'bea', sobre: eje.plaza, t: T0, payload: 'x', movimientos: [{ token: 'T', escala: 'inventado', cantidad: 1, de: 'bea', a: null }, R('bea', 10, null, 'bea')] });
  assert.match((await validez(eje, sinT)).permiso.motivos.join(' '), /minting R needs real T/);
  // Y el eje entero se restaura igual (las reglas de R se revalidan).
  const otro = await restaurar(JSON.parse(JSON.stringify(serializar(eje))));
  assert.deepEqual(pendientes(otro, 'ana'), []);
  assert.equal(valor(otro, 'ana', 'bea'), valor(eje, 'ana', 'bea'));
});

// ---------- 4 · BQL ----------

test('BQL: VALOR_R y LENTE leen la lente del lector que consulta; sin lector o sin alta, PENDIENTE', async () => {
  const { eje } = await demo(['casa', 'norte', 'ana']);
  const reg = await emiteYDa(eje, 'norte', 100, { ana: 10 });
  const q = (f, op) => consultar(eje, reg.id, [], f, op);
  assert.equal(q('=VALOR_R("ana")').estado, 'PENDIENTE');
  assert.match(q('=VALOR_R("ana")').motivo, /sin lector no hay lente, y sin lente R no vale nada/);
  assert.equal(q('=VALOR_R("ana")', { lector: 'nadie' }).estado, 'PENDIENTE');
  assert.match(q('=VALOR_R("ana")', { lector: 'nadie' }).motivo, /nadie no tiene alta/);
  // Con alta y nadie en su lente, R no vale nada para ella: 0.
  assert.deepEqual(q('=VALOR_R("ana")', { lector: 'casa' }).valor.valor, 0);
  await cercanos(eje, 'casa', ['norte']);
  const r = q('=VALOR_R("ana")', { lector: 'casa' });
  assert.deepEqual([r.estado, r.valor.valor], ['RESUELTO', 10]);
  assert.ok(r.dependencias.includes(eje.alta('casa').id + ':3000000000')); // un grupo nuevo lo cambia
  assert.deepEqual(q('=LENTE("norte")', { lector: 'casa' }).valor.valor, 1);
  assert.deepEqual(q('=LENTE("ana")', { lector: 'casa' }).valor.valor, 0);
  assert.equal(q('=VALOR_R("ana") > 5', { lector: 'casa' }).valor.valor, true);
  assert.equal(q('=VALOR_R(3)', { lector: 'casa' }).estado, 'ERROR');
  assert.equal(q('=LENTE()', { lector: 'casa' }).estado, 'ERROR');
  // El gancho decide la lectura de la lente (el alta del lector, de donde cuelgan sus grupos).
  assert.equal(q('=VALOR_R("ana")', { lector: 'casa', puedeLeer: (id) => id !== eje.alta('casa').id }).estado, 'PENDIENTE DE AUTORIZACIÓN');
  // Y cuesta presupuesto: los nodos de la fórmula, la lente y cada emisor que suma.
  const corto = q('=VALOR_R("ana")', { lector: 'casa', limites: { presupuesto: 3 } });
  assert.equal(corto.estado, 'PENDIENTE POR LÍMITE');
  assert.match(corto.motivo, /VALOR_R \(la R de ana\) exige examinar 1 registros y quedan 0/);
  assert.equal(q('=VALOR_R("ana")', { lector: 'casa', limites: { presupuesto: 4 } }).estado, 'RESUELTO');
});

// ---------- 5 · propiedades ----------

function prng(semilla) {
  let a = semilla;
  const r = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { int: (x, y) => x + Math.floor(r() * (y - x + 1)), pick: (xs) => xs[Math.floor(r() * xs.length)], si: (p) => r() < p };
}

const fotoDeValores = (eje, lectores, ids) => JSON.stringify(lectores.map((l) => ids.map((id) => valor(eje, l, id))));

test('propiedad: N identidades falsas que se emiten R entre sí (y la regalan) no cambian el valor que un lector da a nadie', async () => {
  for (let s = 0; s < 4; s++) {
    const g = prng(20261108 + s);
    const N = g.int(3, 8);
    const falsas = Array.from({ length: N }, (_, i) => 'falsa' + i);
    const reales = ['casa', 'norte', 'sur', 'ana', 'bea'];
    const { eje } = await demo([...reales, ...falsas]);
    await emiteYDa(eje, 'norte', g.pick([10, 100, 1000]), { ana: g.int(1, 5), bea: g.int(0, 5) || 1 });
    await emiteYDa(eje, 'sur', g.pick([10, 100]), { bea: g.int(1, 5) });
    await cercanos(eje, 'casa', g.si(0.5) ? ['norte', 'sur'] : ['norte']);
    await cercanos(eje, 'ana', ['sur']);
    // Revisión de seguridad (encargo 3b): anclar en el alta de la casa tiene su precio (desconocidos: su R, devuelta).
    await emiteYDa(eje, 'casa', N, Object.fromEntries(falsas.map((f) => [f, 1])));
    const lectores = ['casa', 'ana', 'bea'];
    const antes = fotoDeValores(eje, lectores, [...reales, ...falsas]);
    // Las falsas se emiten R, se la dan entre ellas, a los lectores y a los reales; se ponen unas a otras en sus grupos
    // y anclan nombres en los grupos del alta de la casa (que no son de la casa).
    for (const f of falsas) {
      const a = {};
      for (let k = 0; k < g.int(1, 4); k++) a[g.pick([...falsas.filter((x) => x !== f), ...lectores, 'norte'])] = g.int(1, 1000);
      await emiteYDa(eje, f, 1e4, a);
      await cercanos(eje, f, falsas.slice(0, 5));
      await eje.escribir({ autor: f, sobre: eje.alta('casa').id, en: '3330000000', t: T0, payload: [f], movimientos: [minuto(f), R('casa', 1, f, 'casa')] });
    }
    assert.equal(fotoDeValores(eje, lectores, [...reales, ...falsas]), antes, 'semilla ' + s);
    // Y lo que las falsas tienen vale 0 para la casa, aunque tengan mucha R entre todas.
    for (const f of falsas) assert.equal(valor(eje, 'casa', f), 0);
  }
});

test('propiedad: ampliar R:X nunca baja el valor de quien ya la tenía', async () => {
  for (let s = 0; s < 4; s++) {
    const g = prng(7000 + s);
    const tenedores = ['t1', 't2', 't3'];
    const { eje } = await demo(['casa', 'x', ...tenedores]);
    await cercanos(eje, 'casa', ['x']);
    await emiteYDa(eje, 'x', 100, { t1: g.int(1, 20) });
    for (let paso = 0; paso < 6; paso++) {
      const antes = tenedores.map((t) => valor(eje, 'casa', t));
      const quien = g.pick(tenedores);
      await emiteYDa(eje, 'x', g.pick([1, 10, 100, 1000]), g.si(0.7) ? { [quien]: g.int(1, 5) } : {});
      tenedores.forEach((t, i) => assert.ok(valor(eje, 'casa', t) >= antes[i], 'semilla ' + s + ' paso ' + paso + ': ' + t + ' bajó'));
    }
  }
});

// ---------- 6 · el ejemplo de Booking ----------

test('en Booking: la casa acepta como pago la R de las dos secretarias; quien se autoemite mucha R no vale nada para ella', async () => {
  const { eje, reserva, lente, asociaciones } = await ejemploLente();
  assert.deepEqual(CERCANOS_DE_LA_CASA, ['secretaria-norte', 'secretaria-sur']);
  assert.equal(lente.sobre, eje.genesisId); // el alta de la casa es el génesis
  assert.equal(lente.en, '3330000000'); // su grupo de cercanos: quiénes
  assert.deepEqual(valoresParaLaCasa(eje), { huesped: 30, [RECIEN]: 0, casa: 0, 'secretaria-norte': 0 });
  assert.equal(eje.saldo('huesped', 'R:' + RECIEN), 5e5); // la tiene, y no vale nada para la casa
  assert.equal(eje.saldo('casa', 'R:' + RECIEN), 1000); // ni recibirla la mete en su lente
  assert.equal(peso(eje, 'casa', RECIEN), 0);
  assert.equal(detalleValor(eje, 'casa', 'huesped').porEmisor.reduce((s, x) => s + x.aporte, 0), 30);
  // Las asociaciones son registros (VG, 8-11): su R es la de su secretaria, sin colateral; la secretaria obtuvo P al escribirla.
  assert.equal(eje.bloqueado('secretaria-norte', 'R:secretaria-norte'), 0);
  assert.equal(eje.esPersona('vecinos-norte'), null); // un grupo es un registro, no una identidad: no tiene alta
  assert.equal(eje.saldo('secretaria-norte', 'P:' + asociaciones['vecinos-norte'].id + '/secretaria-norte'), 10);
  const bql = valorEnBql(eje, reserva);
  assert.deepEqual([bql.estado, bql.texto], ['RESUELTO', '30']);
  // Recepción tiene alta y nadie en sus grupos que cobran con R: para ella, la R de la huésped vale 0.
  assert.deepEqual([valorEnBql(eje, reserva, 'recepcion').estado, valorEnBql(eje, reserva, 'recepcion').texto], ['RESUELTO', '0']);
});

// ---------- 7 · prueba estática ----------

function fuentes(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? fuentes(dir + '/' + e.name) : /\.m?js$/.test(e.name) ? [dir + '/' + e.name] : []));
}
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');

/**
 * Formas de juntar R de emisores distintos o de contar emisores. La prueba
 * es aproximada (busca patrones), y se comprueba a sí misma con ejemplos.
 */
const JUNTAN_R = [
  /reputaciones\([^)]*\)\s*\.\s*(reduce|length)\b/, // sumar o contar las R de un titular
  /startsWith\(\s*['"`]R:['"`]\s*\)/, // recorrer todas las series R
  /token\s*===\s*['"`]R['"`][^;\n]*\)\s*\.\s*(reduce|length)\b/, // filtrar por familia R y sumar o contar
  /new Set\([^;\n]*\.emisor\b[^;\n]*\)\s*\.size/, // contar emisores distintos (la lista `emisores` de una E conjunta es otra cosa)
];

test('prueba estática: fuera de src/lente.js ningún módulo suma R de emisores distintos ni cuenta emisores', () => {
  // La prueba se prueba: estas formas se detectan.
  for (const malo of [
    "const t = eje.reputaciones(id).reduce((s, r) => s + r.cantidad, 0);",
    "for (const k of claves) if (k.startsWith('R:')) total += saldo(k);",
    "const n = movs.filter((m) => m.token === 'R').length;",
    "const cuantos = new Set(lista.map((x) => x.emisor)).size;",
  ]) assert.ok(JUNTAN_R.some((re) => re.test(malo)), malo);
  const archivos = [...fuentes('src'), ...fuentes('antigua/ui'), ...fuentes('antigua/mundos'), ...fuentes('ejemplos'), 'antigua/app.js'].filter((a) => a !== 'src/lente.js');
  assert.ok(archivos.length > 20);
  const fuera = archivos.filter((a) => JUNTAN_R.some((re) => re.test(sinComentarios(readFileSync(a, 'utf8')))));
  assert.deepEqual(fuera, []);
  // Y la lente solo junta R en detalleValor, multiplicada por el peso del lector, unidad a unidad.
  const lente = sinComentarios(readFileSync('src/lente.js', 'utf8'));
  assert.equal((lente.match(/valor \+= p \* saldo/g) ?? []).length, 1);
});
