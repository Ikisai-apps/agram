// Neutralidad ante agrupación y división (VG, 7-11 noche; mapa §12 [D]):
// «Emitir desde dos fuentes es igual de válido que emitir el doble desde una
// única fuente. No da más.» La propiedad: dividir una identidad en varias o
// fundir varias en una no cambia lo que obtienen de los demás (saldos que
// reciben de terceros, lo que ve el tercero, orden de sus candidatos,
// autorizaciones). T queda fuera (VG, 7-11 noche: «T no vale nada por sí
// mismo; es el medidor anti-spam propio»).
//
// Se construyen ejes pequeños con la API de hoy y se compara un mundo con
// una sola identidad («uno») con el mismo guion repartido entre varias
// («dividido») o fundido de nuevo en una («fundido»). Donde el código de hoy
// viola la propiedad, la prueba está escrita igual y va en
// { skip: 'NEU-xx: … [X] decidir VG …' } citando la concesión de
// docs/notas/NEUTRALIDAD_IDENTIDAD.md. No se toca el núcleo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Eje } from '../src/eje.js';
import * as motor from '../src/motor.js';
import { ocupantes } from '../src/encaje.js';
import { comparar, medidasDe } from '../src/tiempo.js';
import { evaluar } from '../src/bql.js';
import { direccion } from '../src/btml.js';
import { generarClaves } from '../src/autoridad.js';

const SEMILLA = 20261107;
const T0 = '2026-11-07T22:00:00Z';
const CASOS = 60;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function prng(semilla) {
  const r = mulberry32(semilla);
  return { r, int: (a, b) => a + Math.floor(r() * (b - a + 1)), pick: (xs) => xs[Math.floor(r() * xs.length)] };
}

const minuto = (de, cantidad = 1, a = null) => ({ token: 'T', escala: 'minuto', cantidad, de, a });
const eur = (emisor, cantidad, de, a) => ({ token: 'E', emisor, denominacion: 'EUR', cantidad, de, a });
let cuenta = 0;
/** Payload único: dos pagos iguales serían el mismo evento (mismo id). */
const unico = (texto) => texto + ' #' + (++cuenta);
const nombres = (base, k) => (k === 1 ? [base] : Array.from({ length: k }, (_, i) => base + (i + 1)));

/** Reparte un entero n > 0 en k partes ≥ 0 al azar (la suma es n). */
function repartir(g, n, k) {
  const cortes = Array.from({ length: k - 1 }, () => g.int(0, n)).sort((a, b) => a - b);
  return [...cortes, n].map((c, i) => c - (i ? cortes[i - 1] : 0));
}

/**
 * Mundo mínimo: génesis «g» (persona) con T y P sobre todo el eje; altas de
 * personas con T; el tercero «C» emite su serie E:C/EUR y su R:C; C escribe
 * la casa X (diez posiciones; la plaza 1 declara capacidad 4). Es un eje de
 * demostración, sin claves (R9): lo que se compara aquí son cantidades, no
 * firmas. NEU-08 construye el suyo con claves.
 */
async function mundo(personas, { tercero = 'C', tipos = {} } = {}) {
  const eje = await Eje.genesis({
    demostracion: true,
    identidad: 'g', tipo: 'persona', t: T0, foco: ['raíz'],
    emision: [{ token: 'T', escala: 'minuto', cantidad: 1e6 }, { token: 'P', ambito: 'genesis', cantidad: 10 }],
  });
  const altas = [tercero, ...personas];
  await eje.escribir({
    autor: 'g', sobre: eje.genesisId, t: T0,
    movimientos: [minuto('g'), ...altas.map((id) => minuto('g', 5000, id))],
    payload: 'altas',
    contexto: { tipos: Object.fromEntries(altas.map((id) => [id, tipos[id] ?? 'persona'])) },
  });
  const casa = await eje.escribir({
    autor: tercero, sobre: eje.genesisId, t: T0, movimientos: [minuto(tercero)],
    payload: ['casa', ['plaza', 30, 4], 'normas', 'anfitrión', 'ficha', 'estructura', 'pasado', 'futuro', 'medidas', 'camino'],
  });
  // Emisión escalonada (VG, 7-11 noche: T + R + P + E): C gasta T, pone en juego un R:C ante g, acuña P sobre
  // su casa y emite E sobre ella. Es igual en todos los mundos, así que no cambia lo que se compara.
  await eje.escribir({
    autor: tercero, sobre: casa.id, t: T0,
    movimientos: [minuto(tercero), { token: 'R', emisor: tercero, cantidad: 1000, de: null, a: tercero }, { token: 'R', emisor: tercero, cantidad: 1, de: tercero, a: 'g' },
      { token: 'P', ambito: casa.id, cantidad: 1, de: null, a: tercero }, eur(tercero, 1e6, null, tercero)],
    payload: 'emisión de ' + tercero,
  });
  return { eje, X: casa.id };
}

/** Saldos de una identidad sin T (T es el medidor propio; VG, 7-11 noche). */
function sinT(eje, id) {
  return Object.fromEntries([...(eje.saldos.get(id) ?? new Map())].filter(([k, v]) => !k.startsWith('T:') && v !== 0).sort());
}
/** Suma por serie, sin T, de un conjunto de identidades: lo que tiene la coalición. */
function sumaCoalicion(eje, ids) {
  const s = {};
  for (const id of ids) for (const [k, v] of Object.entries(sinT(eje, id))) s[k] = (s[k] ?? 0) + v;
  return Object.fromEntries(Object.entries(s).filter(([, v]) => v !== 0).sort());
}
/** Lo emitido de cada serie sin T: emitir desde una o desde varias fuentes no cambia las series ajenas. */
const seriesAjenas = (eje, ajenos) => eje.series().filter((s) => s.token !== 'T' && ajenos.includes(s.emisor)).map((s) => [s.clave, s.emitido]);

// ---------- lo que hoy ya es neutral ----------

test('neutral: lo que un tercero paga y lo que la coalición tiene no cambia al dividir ni al fundir (E y R por emisor)', async () => {
  const g = prng(SEMILLA);
  for (let caso = 0; caso < CASOS; caso++) {
    const k = g.int(2, 5);
    const pagos = Array.from({ length: g.int(1, 4) }, () => g.int(1, 500));
    const devuelve = g.int(0, pagos.reduce((s, x) => s + x, 0));
    const r = g.int(1, 100);
    const repartos = pagos.map((p) => repartir(g, p, k));
    const repartoR = repartir(g, r, k);

    // Uno: A recibe todo de C, devuelve una parte y recibe R:C.
    const uno = await mundo(['A']);
    for (const p of pagos) await uno.eje.escribir({ autor: 'C', sobre: uno.X, t: T0, movimientos: [minuto('C'), eur('C', p, 'C', 'A')], payload: unico('pago') });
    if (devuelve) await uno.eje.escribir({ autor: 'A', sobre: uno.X, t: T0, movimientos: [minuto('A'), eur('C', devuelve, 'A', 'C')], payload: 'devolución' });
    await uno.eje.escribir({ autor: 'C', sobre: uno.X, t: T0, movimientos: [minuto('C'), { token: 'R', emisor: 'C', cantidad: r, de: 'C', a: 'A' }], payload: 'aval' });

    // Dividido: A1…Ak reciben lo mismo repartido y devuelven lo mismo entre todas.
    const ids = nombres('A', k);
    const div = await mundo(ids);
    for (const reparto of repartos) {
      await div.eje.escribir({ autor: 'C', sobre: div.X, t: T0, movimientos: [minuto('C'), ...reparto.map((c, i) => [c, ids[i]]).filter(([c]) => c > 0).map(([c, a]) => eur('C', c, 'C', a))], payload: unico('pago') });
    }
    let resta = devuelve;
    for (const id of ids) {
      const c = Math.min(resta, div.eje.saldo(id, 'E:C/EUR'));
      if (c > 0) await div.eje.escribir({ autor: id, sobre: div.X, t: T0, movimientos: [minuto(id), eur('C', c, id, 'C')], payload: 'devolución' });
      resta -= c;
    }
    await div.eje.escribir({ autor: 'C', sobre: div.X, t: T0, movimientos: [minuto('C'), ...repartoR.map((c, i) => [c, ids[i]]).filter(([c]) => c > 0).map(([c, a]) => ({ token: 'R', emisor: 'C', cantidad: c, de: 'C', a }))], payload: 'aval' });

    // Fundido: las k vuelven a juntar su E en A1 (el padre que lleva el dinero de sus hijos). R no se junta: no es fungible.
    const fun = await mundo(ids);
    for (const reparto of repartos) {
      await fun.eje.escribir({ autor: 'C', sobre: fun.X, t: T0, movimientos: [minuto('C'), ...reparto.map((c, i) => [c, ids[i]]).filter(([c]) => c > 0).map(([c, a]) => eur('C', c, 'C', a))], payload: unico('pago') });
    }
    for (const id of ids.slice(1)) {
      const c = fun.eje.saldo(id, 'E:C/EUR');
      if (c > 0) await fun.eje.escribir({ autor: id, sobre: fun.X, t: T0, movimientos: [minuto(id), eur('C', c, id, ids[0])], payload: 'al padre' });
    }
    if (devuelve) await fun.eje.escribir({ autor: ids[0], sobre: fun.X, t: T0, movimientos: [minuto(ids[0]), eur('C', devuelve, ids[0], 'C')], payload: 'devolución' });
    await fun.eje.escribir({ autor: 'C', sobre: fun.X, t: T0, movimientos: [minuto('C'), { token: 'R', emisor: 'C', cantidad: r, de: 'C', a: ids[0] }], payload: 'aval' });

    const msg = 'caso ' + caso + ' (k=' + k + ')';
    for (const otro of [div, fun]) {
      assert.deepEqual(sinT(otro.eje, 'C'), sinT(uno.eje, 'C'), msg + ': lo que tiene el tercero');
      assert.deepEqual(sumaCoalicion(otro.eje, ids), sumaCoalicion(uno.eje, ['A']), msg + ': lo que tiene la coalición');
      assert.deepEqual(seriesAjenas(otro.eje, ['C', 'g']), seriesAjenas(uno.eje, ['C', 'g']), msg + ': las series ajenas');
    }
    // El padre tiene lo mismo que la persona sola.
    assert.equal(fun.eje.saldo(ids[0], 'E:C/EUR'), uno.eje.saldo('A', 'E:C/EUR'), msg);
  }
});

test('neutral: nadie junta R ajena ni emite la serie de otro, sea uno o sean varios', async () => {
  const { eje, X } = await mundo(['A1', 'A2']);
  await eje.escribir({ autor: 'C', sobre: X, t: T0, movimientos: [minuto('C'), { token: 'R', emisor: 'C', cantidad: 5, de: 'C', a: 'A1' }], payload: 'aval' });
  // A1 no pasa la R:C a A2 (R no es fungible): juntar reputación en un «padre» no da R reutilizable.
  await assert.rejects(eje.escribir({ autor: 'A1', sobre: X, t: T0, movimientos: [minuto('A1'), { token: 'R', emisor: 'C', cantidad: 5, de: 'A1', a: 'A2' }], payload: 'juntar' }), /R no es fungible/);
  // Ninguna de las dos emite E:C/EUR: más nombres no amplían la serie de un tercero.
  await assert.rejects(eje.escribir({ autor: 'A2', sobre: X, t: T0, movimientos: [minuto('A2'), eur('C', 100, null, 'C')], payload: 'falsificar' }), /nadie emite en nombre de otro/);
  assert.equal(eje.serie('E:C/EUR').emitido, 1e6);
});

test('neutral: delegar P reparte y no copia; dividir el P recibido no cambia lo que llega a un tercero', async () => {
  const g = prng(SEMILLA + 1);
  for (let caso = 0; caso < CASOS; caso++) {
    const k = g.int(2, 6);
    const p = g.int(1, 9);
    const aC = g.int(0, p);
    const uno = await mundo(['A']);
    await uno.eje.escribir({ autor: 'g', sobre: uno.X, t: T0, movimientos: [minuto('g'), { token: 'P', ambito: uno.X, cantidad: p, de: 'g', a: 'A' }], payload: unico('delega') });
    if (aC) await uno.eje.escribir({ autor: 'A', sobre: uno.X, t: T0, movimientos: [minuto('A'), { token: 'P', ambito: uno.X, cantidad: aC, de: 'A', a: 'C' }], payload: unico('delega') });

    const ids = nombres('A', k);
    const div = await mundo(ids);
    const reparto = repartir(g, p, k);
    await div.eje.escribir({ autor: 'g', sobre: div.X, t: T0, movimientos: [minuto('g'), ...reparto.map((c, i) => [c, ids[i]]).filter(([c]) => c > 0).map(([c, a]) => ({ token: 'P', ambito: div.X, cantidad: c, de: 'g', a }))], payload: unico('delega') });
    let resta = aC;
    for (const id of ids) {
      const c = Math.min(resta, div.eje.saldo(id, 'P:' + div.X));
      if (c > 0) await div.eje.escribir({ autor: id, sobre: div.X, t: T0, movimientos: [minuto(id), { token: 'P', ambito: div.X, cantidad: c, de: id, a: 'C' }], payload: unico('delega') });
      resta -= c;
    }
    const msg = 'caso ' + caso;
    assert.equal(div.eje.poderSobre('C', div.X), uno.eje.poderSobre('C', uno.X), msg + ': el P que llega al tercero');
    assert.equal(ids.reduce((s, id) => s + div.eje.poderSobre(id, div.X), 0), uno.eje.poderSobre('A', uno.X), msg + ': el P de la coalición');
    assert.equal(div.eje.saldo('g', 'P:genesis'), uno.eje.saldo('g', 'P:genesis'), msg + ': el P del génesis');
  }
});

test('neutral: el orden de los candidatos en la posición de un tercero no depende de quién los escribe', async () => {
  const g = prng(SEMILLA + 2);
  for (let caso = 0; caso < CASOS / 2; caso++) {
    const k = g.int(2, 5);
    const textos = Array.from({ length: g.int(1, 6) }, (_, i) => 'oferta ' + i);
    const dirs = textos.map(() => g.pick([[1], [1, 2], [1, 0, 3]]));
    const autores = textos.map(() => g.int(0, k - 1));
    const uno = await mundo(['A']);
    const ids = nombres('A', k);
    const div = await mundo(ids);
    for (let i = 0; i < textos.length; i++) {
      await uno.eje.escribir({ autor: 'A', sobre: uno.X, en: direccion(dirs[i]), t: T0, movimientos: [minuto('A')], payload: textos[i] });
      await div.eje.escribir({ autor: ids[autores[i]], sobre: div.X, en: direccion(dirs[i]), t: T0, movimientos: [minuto(ids[autores[i]])], payload: textos[i] });
    }
    const vista = (m) => ocupantes(m.eje, m.X, [1]).map((o) => [o.tipo, JSON.stringify(o.contenido), o.vector.join(',')]);
    assert.deepEqual(vista(div), vista(uno), 'caso ' + caso);
  }
});

// ---------- lo que hoy viola la propiedad (skip con id y concesión) ----------

/** Una consolidación de A sobre la casa X de C; en «dividido», A tiene además A2. */
async function consolidacionDeA(personas) {
  const m = await mundo(personas);
  await m.eje.escribir({ autor: 'g', sobre: m.X, t: T0, movimientos: [minuto('g'), { token: 'P', ambito: 'genesis', cantidad: 1, de: 'g', a: 'A' }], payload: unico('delega') });
  const c = await motor.consolidar(m.eje, { autor: 'A', foco: m.X, t: T0, elecciones: { 1: 'reserva de A', 2: 'sin normas', 3: 'A', 4: 'pagar 30' } });
  return { ...m, c: c.id };
}

test('NEU-01: con una segunda identidad, A se autoriza su propia consolidación; sola no puede',
  { skip: 'NEU-01: concesión «autorizar por nombre y por umbral P > 0» (src/motor.js:puedeAutorizar, REGLA_AUTORIZAR V0; mapa §14 [D] «ejecutar exige autorización de quien tiene poder y no es el autor»). Hoy A sola queda PENDIENTE y con A2 (1e-9 de P delegado por A) queda AUTORIZADO: dividirse da autonomía. [X] decidir VG: autorizar por P bloqueado contra un umbral, contando el P del autor como cualquier otro (recomendación R5 de la nota)' },
  async () => {
    const uno = await consolidacionDeA(['A']);
    // Sola, A no puede autorizarse.
    await assert.rejects(motor.autorizar(uno.eje, { autorizante: 'A', consolidacion: uno.c, t: T0 }), /no se autoriza a sí mismo/);

    const dos = await consolidacionDeA(['A', 'A2']);
    await dos.eje.escribir({ autor: 'A', sobre: dos.X, t: T0, movimientos: [minuto('A'), { token: 'P', ambito: 'genesis', cantidad: 1e-9, de: 'A', a: 'A2' }], payload: 'polvo' });
    if (motor.puedeAutorizar(dos.eje, 'A2', dos.c)) await motor.autorizar(dos.eje, { autorizante: 'A2', consolidacion: dos.c, t: T0 });
    assert.equal(motor.estadoDe(dos.eje, dos.c), motor.estadoDe(uno.eje, uno.c), 'dividirse no debe cambiar el estado de la consolidación');
  });

test('NEU-02: repartir el mismo P entre más identidades no da más autorizantes',
  { skip: 'NEU-02: concesión «umbral binario de P» (src/motor.js:puedeAutorizar: P > 0 basta, sin cantidad ni cuórum, y autorizar no bloquea P). Con 1 de P en una identidad hay 1 autorizante válido; repartido en 5 × 0,2 hay 5, y 1e-9 autoriza igual que 1. [X] decidir VG: peso = P bloqueado (recomendación R5)' },
  async () => {
    const autorizantes = async (k) => {
      const m = await consolidacionDeA(['A', ...nombres('B', k)]);
      const ids = nombres('B', k);
      await m.eje.escribir({ autor: 'g', sobre: m.X, t: T0, movimientos: [minuto('g'), ...ids.map((b) => ({ token: 'P', ambito: m.X, cantidad: 1 / k, de: 'g', a: b }))], payload: unico('delega') });
      // Peso total de quienes pueden autorizar, contado como «votos»: hoy, uno por cabeza.
      return ids.filter((b) => motor.puedeAutorizar(m.eje, b, m.c)).length;
    };
    assert.equal(await autorizantes(5), await autorizantes(1));
  });

// NEU-03 ya no se salta: el ciclo E/P/R/T (PR #62, VG 7-11 noche: «emite siempre una persona») lo implementa
// (src/tokens.js: EMITEN = ['persona']; src/ciclo.js).
test('NEU-03: agruparse no añade un emisor (el grupo es un registro; emite una persona con P sobre él)',
  async () => {
    const { eje, X } = await mundo(['P1', 'P2', 'G'], { tipos: { G: 'grupo' } });
    await assert.rejects(
      eje.escribir({ autor: 'G', sobre: X, t: T0, movimientos: [minuto('G'), { token: 'R', emisor: 'G', cantidad: 100, de: null, a: 'G' }], payload: 'R del grupo' }),
      /solo las personas emiten: G es grupo/,
    );
  });

test('NEU-04: dos fuentes no respaldan más E sobre el mismo recurso que una (la casa tiene 4 plazas)',
  { skip: 'NEU-04: concesión «E sin lazo con el registro ni con su capacidad» (src/eje.js:validar solo mira Number.isFinite del total; la serie es E:<emisor>/<d>, no del recurso). A y A2 emiten 4 + 4 plazas sobre la misma casa de 4 y el eje lo acepta (también una sola identidad emite 8). [X] decidir VG: tope de E vivo por recurso, compartido entre emisores y repartido por P bloqueado (recomendación R2)' },
  async () => {
    const emitido = async (fuentes) => {
      const m = await mundo(fuentes);
      for (const f of fuentes) await m.eje.escribir({ autor: 'g', sobre: m.X, t: T0, movimientos: [minuto('g'), { token: 'P', ambito: m.X, cantidad: 1, de: 'g', a: f }], payload: unico('delega') });
      let total = 0;
      for (const f of fuentes) {
        try {
          await m.eje.escribir({ autor: f, sobre: m.X, en: direccion([1]), t: T0, movimientos: [minuto(f), { token: 'E', emisor: f, denominacion: 'plaza-noche', cantidad: 4, de: null, a: f }], payload: 'respaldo 4 plazas' });
          total += 4;
        } catch { /* rechazada: no suma */ }
      }
      return total;
    };
    const capacidad = motor.capacidadDe(['plaza', 30, 4]);
    assert.ok(await emitido(['A']) <= capacidad);
    assert.equal(await emitido(['A', 'A2']), await emitido(['A']));
  });

test('NEU-05: el ranking del 8 no cambia al partir un escrito en piezas o en autores',
  { skip: 'NEU-05: concesión «ranking por recuentos» (src/tiempo.js:comparar: puntuación = posiciones + 2·escritos + movimientos, leída por la celda 8 de app.js). Un hijo de 10 posiciones suma 2; diez hijos de 1 (de diez identidades o de una) suman 20. Retirada ya por la decisión 7 del mapa §12 [D] («se retira comparar() con pesos»); pendiente en el código' },
  async () => {
    const puntuacion = async (k) => {
      const ids = nombres('A', k);
      const m = await mundo(['A', ...ids.filter((x) => x !== 'A')]);
      const Y = await m.eje.escribir({ autor: 'A', sobre: m.X, t: T0, movimientos: [minuto('A')], payload: 'Y' });
      if (k === 1) await m.eje.escribir({ autor: 'A', sobre: Y.id, t: T0, movimientos: [minuto('A', 10)], payload: Array.from({ length: 10 }, (_, i) => 'p' + i) });
      else for (let i = 0; i < 10; i++) await m.eje.escribir({ autor: ids[i % k], sobre: Y.id, t: T0, movimientos: [minuto(ids[i % k])], payload: 'p' + i });
      return comparar(m.eje, Y.id).comparables.find((x) => x.id === Y.id).puntuacion;
    };
    assert.equal(await puntuacion(10), await puntuacion(1));
  });

test('NEU-06: lo que el 8 mide de un pago no cambia al repartirlo entre más identidades',
  { skip: 'NEU-06: concesión «el 8 cuenta cabezas» (src/tiempo.js:medidasDe: identidades = Set.size, movimientos = número; src/bases.js:CORTES_PROVISIONALES.RECUENTOS). C paga 8 EUR a A: identidades 2, movimientos 2; los mismos 8 EUR a 8 identidades: 9 y 9. Las sumas por serie sí son iguales. [X] decidir VG: que en el 8 que se compara entren solo sumas y cuotas por serie (recomendación R7)' },
  async () => {
    const medidas = async (k) => {
      const ids = nombres('A', k);
      const m = await mundo(ids);
      const ev = await m.eje.escribir({ autor: 'C', sobre: m.X, t: T0, movimientos: [minuto('C'), ...ids.map((a) => eur('C', 8 / k, 'C', a))], payload: unico('pago') });
      const x = medidasDe(m.eje, ev.id);
      return { identidades: x.identidades, movimientos: x.movimientos };
    };
    assert.deepEqual(await medidas(8), await medidas(1));
  });

// NEU-07 ya no se salta: R8, elegibilidad antes que límites (src/elegibles.js; mapa §12 [D] «Quién ocupa una
// posición ajena»: elegible por defecto = el autor y quien aparece en su posición 3). BUSCAR filtra los elegibles y
// después aplica el límite; el ruido ajeno solo se cuenta (noElegibles).
test('NEU-07: escritos ajenos que el dueño no considera elegibles no le bloquean su BUSCAR', async () => {
  const buscar = async (ruido) => {
    const ids = nombres('S', Math.max(ruido, 1));
    const m = await mundo(ids);
    // El mercado del dueño: su posición 2 (criterio) busca entre los candidatos de su posición 1.
    const Z = await m.eje.escribir({ autor: 'C', sobre: m.X, t: T0, movimientos: [minuto('C')], payload: ['mercado', 'ofertas', '=BUSCAR(1)'] });
    await m.eje.escribir({ autor: 'C', sobre: Z.id, en: direccion([1]), t: T0, movimientos: [minuto('C')], payload: 'oferta del dueño' });
    for (let i = 0; i < ruido; i++) await m.eje.escribir({ autor: ids[i], sobre: Z.id, en: direccion([1]), t: T0, movimientos: [minuto(ids[i])], payload: 'ruido ' + i });
    const r = evaluar(m.eje, Z.id, [2], { limites: { candidatos: 3 } });
    return { estado: r.estado, candidatos: r.valor?.items.map((i) => [i.origen, i.evento]), fuera: r.valor?.noElegibles ?? 0 };
  };
  const [con, sin] = [await buscar(4), await buscar(0)];
  assert.deepEqual([con.estado, con.candidatos], [sin.estado, sin.candidatos]);
  assert.equal(con.estado, 'RESUELTO');
  assert.deepEqual([con.fuera, sin.fuera], [4, 0]); // el recuento informa y no puntúa
});

test('propiedad (R8): N identidades falsas con ruido en la posición del dueño no cambian lo que su BUSCAR devuelve ni su orden', async () => {
  const g = prng(SEMILLA + 7);
  for (let caso = 0; caso < CASOS / 3; caso++) {
    const guion = Array.from({ length: g.int(1, 5) }, (_, i) => ({ autor: g.pick(['C', 'A']), texto: 'oferta ' + i, dir: g.pick([[1], [1], [1, 2]]) }));
    const falsas = nombres('F', g.int(1, 8));
    const ruido = Array.from({ length: g.int(1, 12) }, (_, i) => ({ autor: g.pick(falsas), texto: 'ruido ' + i, dir: g.pick([[1], [1, 2], [1, 0]]), antes: g.int(0, guion.length) }));
    const limite = guion.length + 1; // cabe lo del dueño y lo de A; con el ruido delante, hoy no cabría
    const correr = async (conRuido) => {
      // A aparece en el 3 del mercado: es elegible. Las falsas solo existen en el mundo con ruido.
      const m = await mundo(conRuido ? ['A', ...falsas] : ['A']);
      const Z = await m.eje.escribir({ autor: 'C', sobre: m.X, t: T0, movimientos: [minuto('C')], payload: ['mercado', 'ofertas', '=BUSCAR("1000000000")', 'A'] });
      for (let k = 0; k <= guion.length; k++) {
        if (conRuido) for (const x of ruido.filter((r) => r.antes === k)) await m.eje.escribir({ autor: x.autor, sobre: Z.id, en: direccion(x.dir), t: T0, movimientos: [minuto(x.autor)], payload: x.texto });
        const x = guion[k];
        if (x) await m.eje.escribir({ autor: x.autor, sobre: Z.id, en: direccion(x.dir), t: T0, movimientos: [minuto(x.autor)], payload: x.texto });
      }
      const r = evaluar(m.eje, Z.id, [2], { limites: { candidatos: limite } });
      const propuesta = motor.proponer(m.eje, Z.id, { posiciones: [2] }).elecciones[2]?.candidato.evento;
      return { estado: r.estado, orden: r.valor?.items.map((i) => [i.origen, i.evento, i.autor ?? null]), propuesta };
    };
    const [sin, con] = [await correr(false), await correr(true)];
    // El mercado, sus escritos y los de A tienen el mismo id en los dos mundos: cuelgan de X, que no depende de las altas.
    assert.deepEqual(con, sin, 'caso ' + caso);
    assert.equal(sin.estado, 'RESUELTO', 'caso ' + caso);
  }
});

/**
 * Un eje con claves, sin demostración (R9): g firma el génesis; S2 entra con
 * su clave y su prueba de posesión, y S3 recibe tokens sin clave.
 */
async function mundoConClaves() {
  const [kg, k2] = [await generarClaves(), await generarClaves()];
  const eje = await Eje.genesis({
    identidad: 'g', tipo: 'persona', t: T0, foco: ['raíz'], clave: kg.publica, privada: kg.privada,
    emision: [{ token: 'T', escala: 'minuto', cantidad: 1e6 }, { token: 'P', ambito: 'genesis', cantidad: 10 }],
  });
  const X = await eje.escribir({
    autor: 'g', sobre: eje.genesisId, t: T0, movimientos: [minuto('g'), minuto('g', 5000, 'S2'), minuto('g', 5000, 'S3')], payload: 'altas',
    contexto: { tipos: { S2: 'persona', S3: 'persona' }, claves: { S2: k2.publica } },
  }, kg.privada, { S2: k2.privada });
  return { eje, X: X.id, kg, k2 };
}

// NEU-08 ya no se salta: R9, sin clave no se actúa (src/eje.js:validar), salvo en un eje marcado como demostración.
test('NEU-08: sin clave no se actúa: nadie escribe como otra identidad ni mueve sus tokens', async () => {
  const { eje, X, kg, k2 } = await mundoConClaves();
  const antes = [eje.saldo('S2', 'T:minuto'), eje.saldo('S3', 'T:minuto')];
  // «g» escribe en nombre de S2 (que tiene clave): sin su firma, o con la de g, no entra.
  await assert.rejects(eje.escribir({ autor: 'S2', sobre: X, t: T0, movimientos: [minuto('S2', 1, 'g')], payload: 'escrito por g' }), /firma ausente de S2/);
  await assert.rejects(eje.escribir({ autor: 'S2', sobre: X, t: T0, movimientos: [minuto('S2', 1, 'g')], payload: 'escrito por g' }, kg.privada), /firma inválida de S2/);
  // Ni en nombre de S3, que no tiene clave: N nombres sin clave no son N votos gratis.
  await assert.rejects(eje.escribir({ autor: 'S3', sobre: X, t: T0, movimientos: [minuto('S3', 1, 'g')], payload: 'escrito por g' }), /sin clave no se actúa: S3 no tiene clave registrada/);
  assert.deepEqual([eje.saldo('S2', 'T:minuto'), eje.saldo('S3', 'T:minuto')], antes);
  // S2 sí actúa, con su firma.
  await eje.escribir({ autor: 'S2', sobre: X, t: T0, movimientos: [minuto('S2', 1, 'g')], payload: 'escrito por S2' }, k2.privada);
  assert.equal(eje.saldo('S2', 'T:minuto'), antes[0] - 1);
  // Un eje de demostración conserva lo de antes, y lo dice: el génesis lo lleva en su contexto.
  const demo = await mundo(['S3']);
  assert.equal(demo.eje.demostracion, true);
  assert.equal(demo.eje.obtener(demo.eje.genesisId).contexto.demostracion, true);
  await demo.eje.escribir({ autor: 'S3', sobre: demo.X, t: T0, movimientos: [minuto('S3', 1, 'g')], payload: 'escrito por g' });
});
