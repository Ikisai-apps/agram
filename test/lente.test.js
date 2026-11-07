// R6 · la lente de R (VG, 7-11 noche; docs/notas/NEUTRALIDAD_IDENTIDAD.md §4).
// La R se valora solo con la lente firmada de quien la lee, y emitir R exige
// colateral. Cada regla con su caso que pasa y el que no, las propiedades
// (identidades falsas, ampliar no diluye), BQL y una prueba estática.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { Eje } from '../src/eje.js';
import { crearEvento } from '../src/evento.js';
import { validez } from '../src/validez.js';
import { consultar } from '../src/bql.js';
import { serializar, restaurar } from '../src/persistencia.js';
import {
  POSICION_LENTE, COLATERAL_R, colateral, declararLente, lenteDe, peso, valor, detalleValor, tenencia, devoluciones, pendientes,
  colateralDe, paresDeLente, payloadDeLente, anclasDeLente,
} from '../src/lente.js';
import { ejemploLente, valoresParaLaCasa, valorEnBql, LENTE_DE_LA_CASA, RECIEN } from '../ejemplos/ikisai/lente-booking.mjs';

const T0 = '2026-11-08T10:00:00Z';
const minuto = (de, cantidad = 1) => ({ token: 'T', escala: 'minuto', cantidad, de, a: null });
const R = (emisor, cantidad, de, a) => ({ token: 'R', emisor, cantidad, de, a });
const libera = (persona, cantidad, emisor = persona) => ({ ...colateral(persona, cantidad, emisor), estado: 'liberacion' });
let cuenta = 0;
const unico = (x) => x + ' #' + (++cuenta);
const cerca = (a, b) => Math.abs(a - b) < 1e-9;

/** Eje de demostración: «g» da de alta a quien se diga (personas salvo que se diga otro tipo), con minutos de sobra. */
async function demo(ids, tipos = {}) {
  const eje = await Eje.genesis({ demostracion: true, identidad: 'g', tipo: 'persona', t: T0, foco: 'raíz', emision: [{ token: 'T', escala: 'minuto', cantidad: 1e6 }, { token: 'P', ambito: 'genesis', cantidad: 10 }] });
  const alta = await eje.escribir({
    autor: 'g', sobre: eje.genesisId, t: T0, payload: 'altas',
    movimientos: [minuto('g'), ...ids.map((id) => ({ token: 'T', escala: 'minuto', cantidad: 1000, de: 'g', a: id }))],
    contexto: { tipos: Object.fromEntries(ids.map((id) => [id, tipos[id] ?? 'persona'])) },
  });
  return { eje, alta };
}

/** `emisor` emite `cantidad` de su R con su colateral (la décima parte) y reparte `a` ({ titular: cantidad }). */
async function emiteYDa(eje, emisor, cantidad, a = {}, sobre = eje.genesisId) {
  return eje.escribir({
    autor: emisor, sobre, t: T0, payload: unico('R de ' + emisor),
    movimientos: [minuto(emisor), R(emisor, cantidad, null, emisor), colateral(emisor, cantidad / 10), ...Object.entries(a).map(([t, c]) => R(emisor, c, emisor, t))],
  });
}

// ---------- 1 · la lente: un acto firmado del lector ----------

test('R6·1 la lente es un acto del lector en la posición 3 de su alta: pares [emisor, peso], la última declaración manda', async () => {
  const { eje, alta } = await demo(['casa', 'norte', 'sur', 'ana']);
  assert.equal(lenteDe(eje, 'casa'), null); // sin declarar, no hay lente
  assert.equal(peso(eje, 'casa', 'norte'), null);
  assert.deepEqual(anclasDeLente(eje, 'casa'), [alta.id]);
  const d = await declararLente(eje, { lector: 'casa', pesos: { norte: 1, sur: 0.5 }, t: T0 });
  assert.equal(d.en, POSICION_LENTE);
  assert.equal(d.sobre, alta.id);
  assert.deepEqual(d.payload, [['norte', 1], ['sur', 0.5]]);
  const l = lenteDe(eje, 'casa');
  assert.deepEqual([...l.pesos], [['norte', 1], ['sur', 0.5]]);
  assert.deepEqual(l.declaraciones, [d.id]);
  assert.deepEqual([peso(eje, 'casa', 'norte'), peso(eje, 'casa', 'sur'), peso(eje, 'casa', 'ana')], [1, 0.5, 0]); // quien no está, pesa 0
  // La última declaración de cada emisor manda; peso 0 lo quita.
  await declararLente(eje, { lector: 'casa', pesos: { sur: 0, ana: 0.25 }, t: T0 });
  assert.deepEqual([peso(eje, 'casa', 'norte'), peso(eje, 'casa', 'sur'), peso(eje, 'casa', 'ana')], [1, 0, 0.25]);
  // Un registro «lente» propio (contexto.lente) también sirve de ancla.
  const reg = await eje.escribir({ autor: 'ana', sobre: eje.genesisId, t: T0, payload: 'mi lente', contexto: { lente: true }, movimientos: [minuto('ana')] });
  assert.deepEqual(anclasDeLente(eje, 'ana'), [alta.id, reg.id]);
  await declararLente(eje, { lector: 'ana', pesos: { norte: 0.75 }, t: T0, ancla: reg.id });
  assert.equal(peso(eje, 'ana', 'norte'), 0.75);
});

test('R6·1 no es lente: lo que escribe otro en la posición 3 del lector, otra posición, un registro ajeno o pares mal formados', async () => {
  const { eje, alta } = await demo(['casa', 'norte', 'intruso']);
  // Otro escribe en la posición 3 del alta de la casa: no es la lente de la casa (es, como mucho, la suya: comparten alta).
  await eje.escribir({ autor: 'intruso', sobre: alta.id, en: POSICION_LENTE, t: T0, payload: [['intruso', 1]], movimientos: [minuto('intruso')] });
  assert.equal(lenteDe(eje, 'casa'), null);
  assert.equal(peso(eje, 'intruso', 'intruso'), 1); // su propia lente, que no cambia la de nadie
  // La casa en otra posición, o sobre un registro que no es su alta ni un registro «lente» suyo: no cuenta.
  await eje.escribir({ autor: 'casa', sobre: alta.id, en: '2000000000', t: T0, payload: [['norte', 1]], movimientos: [minuto('casa')] });
  const ajeno = await eje.escribir({ autor: 'intruso', sobre: eje.genesisId, t: T0, payload: 'lente de otro', contexto: { lente: true }, movimientos: [minuto('intruso')] });
  await eje.escribir({ autor: 'casa', sobre: ajeno.id, en: POSICION_LENTE, t: T0, payload: [['norte', 1]], movimientos: [minuto('casa')] });
  assert.equal(lenteDe(eje, 'casa'), null);
  // Pares mal formados se ignoran y se dice por qué.
  assert.deepEqual(paresDeLente([['norte', 1], ['sur', 2], ['', 0.5], 'x', ['a/b', 1], ['ok', 0]]).pares, [['norte', 1], ['ok', 0]]);
  assert.equal(paresDeLente('texto').pares.length, 0);
  assert.throws(() => payloadDeLente({}), /de 1 a 10 pares/);
  assert.throws(() => payloadDeLente({ norte: 1.5 }), /lente mal formada/);
  await eje.escribir({ autor: 'casa', sobre: alta.id, en: POSICION_LENTE, t: T0, payload: [['norte', 1], ['sur', -1]], movimientos: [minuto('casa')] });
  const l = lenteDe(eje, 'casa');
  assert.deepEqual([...l.pesos], [['norte', 1]]);
  assert.match(l.ignorados[0], /posición 1: no es un par \[emisor, peso de 0 a 1\]/);
});

test('R6·1 recibir R nunca mete a su emisor en la lente del receptor', async () => {
  const { eje } = await demo(['casa', 'norte', 'pesado']);
  await declararLente(eje, { lector: 'casa', pesos: { norte: 1 }, t: T0 });
  await emiteYDa(eje, 'pesado', 1e6, { casa: 5e5 });
  assert.equal(eje.saldo('casa', 'R:pesado'), 5e5);
  assert.deepEqual([...lenteDe(eje, 'casa').pesos], [['norte', 1]]);
  assert.equal(peso(eje, 'casa', 'pesado'), 0);
});

// ---------- 2 · el valor ----------

test('R6·2 valor = Σ peso × saldo ÷ emitido sobre los emisores de la lente; la R propia y la de emisores no nombrados valen 0', async () => {
  const { eje } = await demo(['casa', 'norte', 'sur', 'ana', 'nuevo']);
  await emiteYDa(eje, 'norte', 100, { ana: 10 });
  await emiteYDa(eje, 'sur', 100, { ana: 20 });
  await emiteYDa(eje, 'nuevo', 1e6, { ana: 5e5 }); // se autoemite mucha y la reparte
  assert.equal(valor(eje, 'casa', 'ana'), null); // sin lente, no hay valor
  await declararLente(eje, { lector: 'casa', pesos: { norte: 1, sur: 0.5 }, t: T0 });
  assert.equal(valor(eje, 'casa', 'ana'), 0.2); // 1 × 10/100 + 0,5 × 20/100
  assert.equal(valor(eje, 'casa', 'nuevo'), 0); // su propia R no la avala nadie
  assert.equal(valor(eje, 'casa', 'norte'), 0); // la R propia no vale ante nadie
  const d = detalleValor(eje, 'casa', 'ana');
  assert.deepEqual(d.porEmisor.map((x) => [x.emisor, x.peso, x.saldo, x.parte]), [['norte', 1, 10, 0.1], ['sur', 0.5, 20, 0.2]]);
  assert.equal(d.eventos.length, 2);
  // Otro lector, otra lente, otro valor: R no tiene un valor propio.
  await declararLente(eje, { lector: 'sur', pesos: { nuevo: 1 }, t: T0 });
  assert.equal(valor(eje, 'sur', 'ana'), 0.5);
});

test('R6·2 ampliar R:X no diluye a quien ya la tiene; lo que llega después vale sobre lo emitido entonces', async () => {
  const { eje } = await demo(['casa', 'norte', 'ana', 'bea']);
  await declararLente(eje, { lector: 'casa', pesos: { norte: 1 }, t: T0 });
  await emiteYDa(eje, 'norte', 100, { ana: 10 });
  assert.equal(valor(eje, 'casa', 'ana'), 0.1);
  await emiteYDa(eje, 'norte', 900, { bea: 10 }); // amplía a 1000 (con su colateral) y da 10 a bea
  assert.equal(valor(eje, 'casa', 'ana'), 0.1); // no baja
  assert.equal(valor(eje, 'casa', 'bea'), 0.01); // 10 de 1000
  // Devolver parte baja la participación a prorrata.
  await eje.escribir({ autor: 'ana', sobre: eje.genesisId, t: T0, payload: 'te pido atención', movimientos: [minuto('ana'), R('norte', 5, 'ana', 'norte')] });
  assert.equal(valor(eje, 'casa', 'ana'), 0.05);
  assert.deepEqual(tenencia(eje, 'ana', 'norte').saldo, 5);
});

// ---------- 3 · emitir R exige colateral ----------

test('R6·3 emitir R exige R propia bloqueada con la salida = la serie, la décima parte de lo emitido; en la primera, en el mismo evento', async () => {
  assert.deepEqual(COLATERAL_R, { num: 1, den: 10 });
  const { eje } = await demo(['ana']);
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: eje.genesisId, t: T0, payload: 'x', movimientos: [minuto('ana'), R('ana', 10, null, 'ana')] }),
    /emitir R:ana exige colateral: R:ana bloqueada con la salida «R:ana», al menos 1 \(1\/10 de lo emitido, 10\); hay 0 \(R6\)/);
  // Bloquear con otra salida no es colateral.
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: eje.genesisId, t: T0, payload: 'x', movimientos: [minuto('ana'), R('ana', 10, null, 'ana'), { ...colateral('ana', 1), salida: 'otra' }] }), /exige colateral/);
  await eje.escribir({ autor: 'ana', sobre: eje.genesisId, t: T0, payload: 'mi R', movimientos: [minuto('ana'), R('ana', 10, null, 'ana'), colateral('ana', 1)] });
  assert.equal(colateralDe(eje, 'ana'), 1);
  assert.equal(eje.saldo('ana', 'R:ana'), 9);
  // Ampliar pide que el colateral siga cubriendo la décima parte.
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: eje.genesisId, t: T0, payload: 'x', movimientos: [minuto('ana'), R('ana', 10, null, 'ana')] }), /al menos 2 .* hay 1/);
  await eje.escribir({ autor: 'ana', sobre: eje.genesisId, t: T0, payload: 'más R', movimientos: [minuto('ana'), R('ana', 10, null, 'ana'), colateral('ana', 1)] });
  // Liberar por debajo de la décima parte, no; lo que sobra, sí (sin devoluciones pendientes).
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: eje.genesisId, t: T0, payload: 'x', movimientos: [minuto('ana'), libera('ana', 1)] }), /el colateral de R:ana no baja de 2/);
  await eje.escribir({ autor: 'ana', sobre: eje.genesisId, t: T0, payload: 'bloqueo de más', movimientos: [minuto('ana'), colateral('ana', 3)] });
  await eje.escribir({ autor: 'ana', sobre: eje.genesisId, t: T0, payload: 'lo suelto', movimientos: [minuto('ana'), libera('ana', 3)] });
  assert.equal(colateralDe(eje, 'ana'), 2);
});

test('R6·3 a nombre de un grupo: el colateral es R de quien firma, con la salida = la serie del grupo', async () => {
  const { eje, alta } = await demo(['club', 'ana'], { club: 'grupo' });
  await eje.escribir({ autor: 'g', sobre: alta.id, t: T0, payload: 'ana lleva el club', movimientos: [minuto('g'), { token: 'P', ambito: alta.id, cantidad: 1, de: 'g', a: 'ana' }] });
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'x', movimientos: [minuto('ana'), R('ana', 10, null, 'ana'), colateral('ana', 1), R('club', 30, null, 'club')] }),
    /emitir R:club exige colateral: R:ana bloqueada con la salida «R:club», al menos 3/);
  await eje.escribir({ autor: 'ana', sobre: alta.id, t: T0, payload: 'R del club', movimientos: [minuto('ana'), R('ana', 10, null, 'ana'), colateral('ana', 1), colateral('ana', 3, 'club'), R('club', 30, null, 'club')] });
  assert.equal(colateralDe(eje, 'ana', 'club'), 3);
  assert.equal(eje.saldo('club', 'R:club'), 30);
});

test('R6·3 devolver R es pedir atención: con devoluciones sin atender el colateral no se libera; atender es citarlas', async () => {
  const { eje } = await demo(['ana', 'bea', 'otra']);
  await emiteYDa(eje, 'ana', 10, { bea: 4 });
  await eje.escribir({ autor: 'ana', sobre: eje.genesisId, t: T0, payload: 'de más', movimientos: [minuto('ana'), colateral('ana', 2)] });
  const dev = await eje.escribir({ autor: 'bea', sobre: eje.genesisId, t: T0, payload: 'ana, te pido atención', movimientos: [minuto('bea'), R('ana', 1, 'bea', 'ana')] });
  assert.deepEqual(pendientes(eje, 'ana'), [dev.id]);
  assert.deepEqual(devoluciones(eje, 'ana').map((d) => [d.id, d.de, d.cantidad, d.atencion]), [[dev.id, 'bea', 1, null]]);
  // Mientras no la atienda, el colateral queda bloqueado (sin castigo automático).
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: eje.genesisId, t: T0, payload: 'x', movimientos: [minuto('ana'), libera('ana', 2)] }),
    /el colateral de R:ana no se libera mientras haya devoluciones sin atender \([0-9a-f]{8}\): atender es escribir un evento de ana con contexto.atiende/);
  // Atender lo hace el emisor, citando una devolución de su R; otro no, ni se cita lo que no es una devolución.
  await assert.rejects(eje.escribir({ autor: 'otra', sobre: dev.id, t: T0, payload: 'x', contexto: { atiende: dev.id }, movimientos: [minuto('otra')] }), /contexto.atiende cita [0-9a-f]{8}, que no es una devolución de R:otra/);
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: dev.id, t: T0, payload: 'x', contexto: { atiende: eje.genesisId }, movimientos: [minuto('ana')] }), /que no es una devolución de R:ana/);
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: dev.id, t: T0, payload: 'x', contexto: { atiende: [] }, movimientos: [minuto('ana')] }), /contexto.atiende es el id de una devolución/);
  const at = await eje.escribir({ autor: 'ana', sobre: dev.id, t: T0, payload: 'te atiendo', contexto: { atiende: dev.id }, movimientos: [minuto('ana')] });
  assert.deepEqual(pendientes(eje, 'ana'), []);
  assert.equal(devoluciones(eje, 'ana')[0].atencion, at.id);
  await eje.escribir({ autor: 'ana', sobre: eje.genesisId, t: T0, payload: 'suelto lo de más', movimientos: [minuto('ana'), libera('ana', 2)] });
  assert.equal(colateralDe(eje, 'ana'), 1);
  // Las capas de validez dicen lo mismo, con el libro de justo antes.
  const sinColateral = await crearEvento({ autor: 'bea', sobre: eje.genesisId, t: T0, payload: 'x', movimientos: [minuto('bea'), R('bea', 10, null, 'bea')] });
  assert.match((await validez(eje, sinColateral)).acreditacion.motivos.join(' '), /emitir R:bea exige colateral/);
  const dev2 = await eje.escribir({ autor: 'bea', sobre: eje.genesisId, t: T0, payload: 'otra vez', movimientos: [minuto('bea'), R('ana', 1, 'bea', 'ana')] });
  await eje.escribir({ autor: 'ana', sobre: eje.genesisId, t: T0, payload: 'de más', movimientos: [minuto('ana'), colateral('ana', 1)] });
  const suelta = await crearEvento({ autor: 'ana', sobre: eje.genesisId, t: T0, payload: 'x', movimientos: [minuto('ana'), libera('ana', 1)] });
  assert.match((await validez(eje, suelta)).permiso.motivos.join(' '), new RegExp('devoluciones sin atender \\(' + dev2.id.slice(0, 8)));
  const atiende = await crearEvento({ autor: 'bea', sobre: eje.genesisId, t: T0, payload: 'x', contexto: { atiende: dev2.id }, movimientos: [minuto('bea')] });
  assert.match((await validez(eje, atiende)).permiso.motivos.join(' '), /que no es una devolución de R:bea/);
  // Y el eje entero se restaura igual (las reglas de R se revalidan).
  const otro = await restaurar(JSON.parse(JSON.stringify(serializar(eje))));
  assert.deepEqual(pendientes(otro, 'ana'), [dev2.id]);
  assert.equal(valor(otro, 'ana', 'bea'), valor(eje, 'ana', 'bea'));
});

// ---------- 4 · BQL ----------

test('R6·4 BQL: VALOR_R y LENTE leen la lente del lector que consulta; sin lector o sin lente, PENDIENTE', async () => {
  const { eje } = await demo(['casa', 'norte', 'ana']);
  const reg = await emiteYDa(eje, 'norte', 100, { ana: 10 });
  const q = (f, op) => consultar(eje, reg.id, [], f, op);
  assert.equal(q('=VALOR_R("ana")').estado, 'PENDIENTE');
  assert.match(q('=VALOR_R("ana")').motivo, /sin lector no hay lente, y sin lente R no vale nada/);
  assert.equal(q('=VALOR_R("ana")', { lector: 'casa' }).estado, 'PENDIENTE');
  assert.match(q('=VALOR_R("ana")', { lector: 'casa' }).motivo, /casa no ha declarado su lente de R/);
  // Sin lente, R no vale nada en una fórmula: la comparación tampoco se resuelve.
  assert.equal(q('=VALOR_R("ana") > 0', { lector: 'casa' }).estado, 'PENDIENTE');
  const d = await declararLente(eje, { lector: 'casa', pesos: { norte: 0.5 }, t: T0 });
  const r = q('=VALOR_R("ana")', { lector: 'casa' });
  assert.deepEqual([r.estado, r.valor.valor], ['RESUELTO', 0.05]);
  assert.ok(r.dependencias.includes(eje.alta('casa').id + ':' + POSICION_LENTE)); // una declaración nueva lo cambia
  assert.deepEqual(q('=LENTE("norte")', { lector: 'casa' }).valor.valor, 0.5);
  assert.deepEqual(q('=LENTE("ana")', { lector: 'casa' }).valor.valor, 0);
  assert.equal(q('=VALOR_R("ana") > 0.01', { lector: 'casa' }).valor.valor, true);
  assert.equal(q('=VALOR_R(3)', { lector: 'casa' }).estado, 'ERROR');
  assert.equal(q('=LENTE()', { lector: 'casa' }).estado, 'ERROR');
  // El gancho decide la lectura de la lente y de cada tenencia.
  assert.equal(q('=VALOR_R("ana")', { lector: 'casa', puedeLeer: (id) => id !== d.id }).estado, 'PENDIENTE DE AUTORIZACIÓN');
  assert.equal(q('=VALOR_R("ana")', { lector: 'casa', puedeLeer: (id) => id !== reg.id }).estado, 'PENDIENTE DE AUTORIZACIÓN');
  // Y cuesta presupuesto: los dos nodos de la fórmula, una declaración y un evento de tenencia.
  const corto = q('=VALOR_R("ana")', { lector: 'casa', limites: { presupuesto: 3 } });
  assert.equal(corto.estado, 'PENDIENTE POR LÍMITE');
  assert.match(corto.motivo, /VALOR_R \(las tenencias de R de ana\) exige examinar 1 registros y quedan 0/);
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

test('propiedad R6: N identidades falsas que se emiten R entre sí (y la regalan) no cambian el valor que un lector da a nadie', async () => {
  for (let s = 0; s < 6; s++) {
    const g = prng(20261108 + s);
    const N = g.int(3, 12);
    const falsas = Array.from({ length: N }, (_, i) => 'falsa' + i);
    const reales = ['casa', 'norte', 'sur', 'ana', 'bea'];
    const { eje, alta } = await demo([...reales, ...falsas]);
    await emiteYDa(eje, 'norte', g.pick([10, 100, 1000]), { ana: g.int(1, 5), bea: g.int(0, 5) || 1 });
    await emiteYDa(eje, 'sur', g.pick([10, 100]), { bea: g.int(1, 5) });
    await declararLente(eje, { lector: 'casa', pesos: { norte: 1, sur: g.pick([0.25, 0.5, 1]) }, t: T0 });
    await declararLente(eje, { lector: 'ana', pesos: { sur: 1 }, t: T0 });
    const lectores = ['casa', 'ana', 'bea'];
    const antes = fotoDeValores(eje, lectores, [...reales, ...falsas]);
    // Las falsas se emiten R (con su colateral), se la dan entre ellas, a los lectores y a los reales;
    // se nombran unas a otras en sus lentes y escriben en la posición 3 del alta (que comparten con la casa).
    for (const f of falsas) {
      const a = {};
      for (let k = 0; k < g.int(1, 4); k++) a[g.pick([...falsas.filter((x) => x !== f), ...lectores, 'norte'])] = g.int(1, 1000);
      await emiteYDa(eje, f, 1e4, a);
      await declararLente(eje, { lector: f, pesos: Object.fromEntries(falsas.slice(0, 5).map((x) => [x, 1])), t: T0 });
      await eje.escribir({ autor: f, sobre: alta.id, en: POSICION_LENTE, t: T0, payload: [[f, 1]], movimientos: [minuto(f)] });
    }
    assert.equal(fotoDeValores(eje, lectores, [...reales, ...falsas]), antes, 'semilla ' + s);
    // Y lo que las falsas tienen vale 0 para la casa, aunque tengan mucha R entre todas.
    for (const f of falsas) assert.equal(valor(eje, 'casa', f), 0);
  }
});

test('propiedad R6: ampliar R:X nunca baja el valor de quien ya la tenía', async () => {
  for (let s = 0; s < 6; s++) {
    const g = prng(7000 + s);
    const tenedores = ['t1', 't2', 't3'];
    const { eje } = await demo(['casa', 'x', ...tenedores]);
    await declararLente(eje, { lector: 'casa', pesos: { x: g.pick([0.5, 1]) }, t: T0 });
    await emiteYDa(eje, 'x', 100, { t1: g.int(1, 20) });
    for (let paso = 0; paso < 8; paso++) {
      const antes = tenedores.map((t) => valor(eje, 'casa', t));
      const quien = g.pick(tenedores);
      await emiteYDa(eje, 'x', g.pick([1, 10, 100, 1000]), g.si(0.7) ? { [quien]: g.int(1, 5) } : {});
      tenedores.forEach((t, i) => assert.ok(valor(eje, 'casa', t) >= antes[i] - 1e-9, 'semilla ' + s + ' paso ' + paso + ': ' + t + ' bajó'));
    }
  }
});

// ---------- 6 · el ejemplo de Booking ----------

test('R6 en Booking: la casa da 1 a una asociación y 0,5 a otra; quien se autoemite mucha R no vale nada para ella', async () => {
  const { eje, reserva, lente } = await ejemploLente();
  assert.deepEqual(LENTE_DE_LA_CASA, { 'vecinos-norte': 1, 'vecinos-sur': 0.5 });
  assert.equal(lente.sobre, eje.genesisId); // el alta de la casa es el génesis
  assert.deepEqual(valoresParaLaCasa(eje), { huesped: 0.2, [RECIEN]: 0, casa: 0, 'vecinos-norte': 0 });
  assert.equal(eje.saldo('huesped', 'R:' + RECIEN), 5e5); // la tiene, y no vale nada para la casa
  assert.equal(eje.saldo('casa', 'R:' + RECIEN), 1000); // ni recibirla la mete en su lente
  assert.equal(peso(eje, 'casa', RECIEN), 0);
  assert.ok(cerca(detalleValor(eje, 'casa', 'huesped').porEmisor.reduce((s, x) => s + x.aporte, 0), 0.2));
  // La R del grupo la respalda R bloqueada de su secretaria (R6).
  assert.equal(colateralDe(eje, 'secretaria-norte', 'vecinos-norte'), 10);
  const bql = valorEnBql(eje, reserva);
  assert.deepEqual([bql.estado, bql.texto], ['RESUELTO', '0.2']);
  assert.equal(valorEnBql(eje, reserva, 'recepcion').estado, 'PENDIENTE'); // recepción no ha firmado lente
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

test('R6 prueba estática: fuera de src/lente.js ningún módulo suma R de emisores distintos ni cuenta emisores', () => {
  // La prueba se prueba: estas formas se detectan.
  for (const malo of [
    "const t = eje.reputaciones(id).reduce((s, r) => s + r.cantidad, 0);",
    "for (const k of claves) if (k.startsWith('R:')) total += saldo(k);",
    "const n = movs.filter((m) => m.token === 'R').length;",
    "const cuantos = new Set(lista.map((x) => x.emisor)).size;",
  ]) assert.ok(JUNTAN_R.some((re) => re.test(malo)), malo);
  const archivos = [...fuentes('src'), ...fuentes('ui'), ...fuentes('mundos'), ...fuentes('ejemplos'), 'app.js'].filter((a) => a !== 'src/lente.js');
  assert.ok(archivos.length > 20);
  const fuera = archivos.filter((a) => JUNTAN_R.some((re) => re.test(sinComentarios(readFileSync(a, 'utf8')))));
  assert.deepEqual(fuera, []);
  // Y la lente solo junta R en detalleValor, multiplicada por el peso del lector.
  const lente = sinComentarios(readFileSync('src/lente.js', 'utf8'));
  assert.equal((lente.match(/valor \+= aporte/g) ?? []).length, 1);
  assert.match(lente, /const aporte = p \* t\.parte;/);
});
