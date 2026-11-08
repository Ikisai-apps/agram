// R7 del estudio de neutralidad (VG, 7-11 noche, mapa §12 [D] «Resto de la
// lista del estudio»): el 8 solo funde CANTIDADES y sitúa por cuota. Los
// recuentos (identidades, escritos, movimientos, posiciones, medias por n)
// son informativos: sin cortes ni cajas, fuera de situar y de cualquier
// criterio que decida. PV8 ordena REGISTROS por masa (suma por serie), nunca
// identidades. Propiedad: partir un escrito en diez o añadir N hermanos
// vacíos no cambia la caja del foco.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Eje } from '../src/eje.js';
import { consultar } from '../src/bql.js';
import {
  confluir, situar, medir, esRecuento, esCantidad, cuotaDe, cajaDeCuota, porMasa, masaDe, ochoPorCantidades, MEDIDAS, INFORMATIVOS,
} from '../src/bases.js';

const AYER = '2026-11-07T10:00:00Z';
const T0 = '2026-11-08T10:00:00Z';

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

const gasta = (de, cantidad = 1) => ({ token: 'T', escala: 'minuto', cantidad, de, a: null });
const eur = (de, a, cantidad) => ({ token: 'E', emisor: 'g', denominacion: 'EUR', cantidad, de, a });
let cuenta = 0;
const unico = (x) => x + ' #' + (++cuenta);

/** Un mercado M de g con un foco F y unos hermanos; las personas pagan EUR al escribir. */
async function mercado() {
  const eje = await Eje.genesis({
    demostracion: true, identidad: 'g', tipo: 'persona', t: AYER, foco: 'raíz',
    emision: [{ token: 'E', denominacion: 'EUR', cantidad: 1e6, divisible: true }],
  });
  const ids = ['ana', 'bea', 'cris', 'dani'];
  await eje.escribir({ autor: 'g', sobre: eje.genesisId, t: AYER, payload: 'altas', contexto: { tipos: Object.fromEntries(ids.map((x) => [x, 'persona'])) },
    movimientos: [gasta('g'), ...ids.map((x) => eur('g', x, 1000))] });
  const M = await eje.escribir({ autor: 'g', sobre: eje.genesisId, t: T0, payload: 'mercado', movimientos: [gasta('g')] });
  return { eje, M: M.id, ids };
}

/** Un hermano con su pago y su T: un escrito o, partido, diez (las mismas cantidades repartidas). */
async function hermano(eje, M, autor, { pago, minutos, partido = false }) {
  if (!partido) return [await eje.escribir({ autor, sobre: M, t: T0, payload: unico('hermano'), movimientos: [gasta(autor, minutos), eur(autor, 'g', pago)] })];
  const piezas = [];
  for (let i = 0; i < 10; i++) {
    piezas.push(await eje.escribir({ autor, sobre: M, t: T0, payload: unico('pieza'), movimientos: [gasta(autor, minutos / 10), eur(autor, 'g', pago / 10)] }));
  }
  return piezas;
}

/**
 * Dónde cae el foco por cantidades: por serie, su valor, su caja, su cuota y la caja de su cuota. Sin las series
 * de T movido: un hermano vacío también gasta su T, y eso se ve en la cuota de T de los demás, que es el medidor
 * propio de cada uno y no concede nada (VG, 7-11 noche). La caja del foco por su cantidad no cambia nunca.
 */
function sitio(eje, foco, alcance) {
  const c = confluir(eje, foco, { alcance });
  return Object.fromEntries(Object.entries(c.tokens).filter(([k]) => !k.startsWith('T:')).map(([k, x]) => [k, [x.foco, x.caja, x.cuota, x.cajaCuota]]));
}

test('propiedad (R7): partir un escrito en diez o añadir N hermanos vacíos no cambia la caja del foco ni su cuota', async () => {
  const p = prng(20261108);
  for (let caso = 0; caso < 10; caso++) {
    const pagos = Array.from({ length: p.int(1, 3) }, () => 10 * p.int(1, 9));
    const pagoFoco = 10 * p.int(1, 9);
    const correr = async ({ partir, vacios }) => {
      const { eje, M } = await mercado();
      const [foco] = await hermano(eje, M, 'ana', { pago: pagoFoco, minutos: 10 });
      for (const [i, pago] of pagos.entries()) await hermano(eje, M, 'bea', { pago, minutos: 10, partido: partir && i === 0 });
      for (let i = 0; i < vacios; i++) await eje.escribir({ autor: 'cris', sobre: M, t: T0, payload: unico('vacío'), movimientos: [gasta('cris')] });
      return sitio(eje, foco.id, 'hermanos');
    };
    const base = await correr({ partir: false, vacios: 0 });
    assert.ok(base['E:g/EUR'][2] > 0 && base['E:g/EUR'][2] <= 1, 'caso ' + caso + ': cuota del foco en EUR');
    assert.deepEqual(await correr({ partir: true, vacios: 0 }), base, 'caso ' + caso + ': partido en diez');
    assert.deepEqual(await correr({ partir: false, vacios: p.int(1, 6) }), base, 'caso ' + caso + ': hermanos vacíos');
  }
});

test('lo que cambia al partir o al añadir hermanos vacíos son recuentos: se informan, no sitúan', async () => {
  const { eje, M } = await mercado();
  const [foco] = await hermano(eje, M, 'ana', { pago: 40, minutos: 10 });
  await hermano(eje, M, 'bea', { pago: 60, minutos: 10, partido: true });
  const c = confluir(eje, foco.id);
  assert.equal(c.n, 11); // once escritos: n es un recuento
  for (const m of MEDIDAS) {
    assert.equal(esRecuento(m.clave), true);
    assert.deepEqual([c.medidas[m.clave].recuento, 'caja' in c.medidas[m.clave], 'cajas' in c.medidas[m.clave]], [true, false, false], m.clave);
  }
  const e = c.tokens['E:g/EUR'];
  assert.deepEqual([e.foco, e.suma, e.cuota, e.cajaCuota], [40, 100, 0.4, 4]);
  assert.deepEqual(e.informativos, INFORMATIVOS); // enCaja, debajo, encima y media cuentan registros: informan
  assert.equal(esCantidad('E:g/EUR') && esCantidad('tiempo:minuto') && !esCantidad('escritos') && !esCantidad('tiempo:mes'), true);
  // Cuota: su suma ÷ la de la cohorte; sin nada en la cohorte, sin cuota.
  assert.deepEqual([cuotaDe(3, 12), cuotaDe(0, 0), cajaDeCuota(0.25), cajaDeCuota(1), cajaDeCuota(0), cajaDeCuota(null)], [0.25, null, 2, 9, 0, null]);
  // En BQL, la cuota se pide como un campo más; los recuentos no se sitúan.
  assert.equal(consultar(eje, foco.id, [], 'BASES("hermanos", "E:g/EUR", "cuota")').estado, 'PENDIENTE'); // sin base escrita: BQL no calcula al vuelo
});

test('el T consumido sobre un registro es una cantidad del 8 (tiempo:<escala>), y la base no la cambia', async () => {
  const { eje, M } = await mercado();
  await hermano(eje, M, 'ana', { pago: 10, minutos: 7 });
  await hermano(eje, M, 'bea', { pago: 10, minutos: 3 });
  assert.equal(medir(eje, M).tokens['tiempo:minuto'], 10);
  assert.equal(medir(eje, eje.genesisId).tokens['tiempo:minuto'], 2); // las altas y el mercado
  // El subárbol del génesis funde el T gastado en todo el eje, sin recorrerlo: lo que da eje.tiempoBajo.
  const general = confluir(eje, M, { alcance: 'general' });
  assert.equal(general.tokens['tiempo:minuto'].suma, eje.tiempoBajo(eje.genesisId).minuto);
});

test('PV8 ordena registros por masa (suma por serie), nunca identidades ni recuentos', async () => {
  const { eje, M } = await mercado();
  const [a] = await hermano(eje, M, 'ana', { pago: 30, minutos: 10 });
  const b = await hermano(eje, M, 'bea', { pago: 50, minutos: 10, partido: true }); // diez piezas de 5
  const [c] = await hermano(eje, M, 'cris', { pago: 20, minutos: 10 });
  const ids = [a.id, ...b.map((x) => x.id), c.id];
  const orden = porMasa(eje, ids, 'E:g/EUR');
  assert.deepEqual(orden.slice(0, 2).map((x) => x.id), [a.id, c.id]); // 30 y 20: las piezas de 5, detrás, en su orden
  assert.deepEqual(orden.slice(2).map((x) => x.id), b.map((x) => x.id));
  assert.deepEqual(masaDe(eje, a.id), { 'T:minuto': 10, 'E:g/EUR': 30 });
  assert.throws(() => porMasa(eje, ids, 'identidades'), /no es una cantidad/);
});

test('ochoPorCantidades: lo que leerá la celda 8 de Mapped (pendiente de integrar en src/mapped.js)', async () => {
  const { eje, M } = await mercado();
  const [foco] = await hermano(eje, M, 'ana', { pago: 40, minutos: 10 });
  await hermano(eje, M, 'bea', { pago: 60, minutos: 10 });
  const o = ochoPorCantidades(eje, foco.id);
  assert.deepEqual([o.estado, o.escrita, o.n], ['RESUELTO', false, 2]);
  const e = o.cantidades.find((x) => x.clave === 'E:g/EUR');
  assert.deepEqual([e.foco, e.cuota, e.cajaCuota, e.debajo + e.enCaja + e.encima], [40, 0.4, 4, 2]);
  assert.deepEqual(o.recuentos.map((x) => x.clave), MEDIDAS.map((x) => x.clave));
  assert.ok(o.recuentos.every((x) => x.recuento === true && !('caja' in x)));
  assert.equal(ochoPorCantidades(eje, eje.genesisId).estado, 'PENDIENTE');
  assert.deepEqual(situar(eje, foco.id, { respaldo: true }).tokens['E:g/EUR'].cuota, 0.4);
});
