import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Eje } from '../src/eje.js';
import { evaluar, consultar, esFormula, desescapar, analizar, formato } from '../src/bql.js';
import { ejemploCompra } from '../ejemplos/ikisai/compra-food.mjs';

const T0 = '2026-11-06T20:00:00Z';
const gastaT = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });

async function ejeCon(payload) {
  const eje = await Eje.genesis({ identidad: 'raiz', emision: [{ token: 'T', escala: 'minuto', cantidad: 600 }], foco: payload, t: T0 });
  return { eje, id: eje.genesisId };
}

test('convención «=» y escape «==»', () => {
  assert.equal(esFormula('=1+1'), true);
  assert.equal(esFormula('==no es fórmula'), false);
  assert.equal(esFormula('hola'), false);
  assert.equal(desescapar('==hola'), '=hola');
  assert.equal(desescapar('hola'), 'hola');
});

test('analizar: precedencia, magnitudes, funciones', () => {
  assert.deepEqual(analizar('1 + 2 * 3'), { tipo: 'bin', op: '+', izq: { tipo: 'num', v: 1 }, der: { tipo: 'bin', op: '*', izq: { tipo: 'num', v: 2 }, der: { tipo: 'num', v: 3 } } });
  assert.deepEqual(analizar('12 EUR'), { tipo: 'mag', cantidad: 12, unidad: 'EUR' });
  assert.deepEqual(analizar('LOCAL(1, 2)'), { tipo: 'fn', nombre: 'LOCAL', args: [{ tipo: 'num', v: 1 }, { tipo: 'num', v: 2 }] });
  assert.throws(() => analizar('1 +'), SyntaxError);
  assert.throws(() => analizar('LOCAL(1'), SyntaxError);
});

test('aritmética y magnitudes: misma unidad suma con desglose', async () => {
  const { eje, id } = await ejeCon(['x', '=200 m + 50 m', '=2 * 12 EUR', '=1 + 2 * 3']);
  const a = evaluar(eje, id, '1000000000');
  assert.equal(a.estado, 'RESUELTO');
  assert.equal(a.texto, '250 m (200 m + 50 m)');
  assert.equal(evaluar(eje, id, '2000000000').texto, '24 EUR');
  assert.equal(evaluar(eje, id, '3000000000').texto, '7');
});

test('sumar trata igual a los dos operandos: el derecho conserva su desglose (defecto visto en el caso Tasks)', async () => {
  const { eje, id } = await ejeCon(['x', '=1 EUR + 2 EUR', '=3 EUR + 4 EUR', '=LOCAL(1) + LOCAL(2)', '=1 h + 2 h', '=350 EUR + LOCAL(4)', '=LOCAL(1) - LOCAL(2)']);
  const c = (f) => consultar(eje, id, [9], f).texto;
  // Antes: «10 EUR (1 EUR + 2 EUR + 7 EUR)»: el operando derecho llegaba aplanado.
  assert.equal(c('(1 EUR + 2 EUR) + (3 EUR + 4 EUR)'), '10 EUR (1 EUR + 2 EUR + 3 EUR + 4 EUR)');
  assert.equal(evaluar(eje, id, [3]).texto, '10 EUR (1 EUR + 2 EUR + 3 EUR + 4 EUR)'); // también leyendo fórmulas ajenas
  // Simetría: a + b y b + a tienen la misma cantidad y los mismos sumandos.
  const ab = consultar(eje, id, [9], 'LOCAL(1) + LOCAL(2)').valor;
  const ba = consultar(eje, id, [9], 'LOCAL(2) + LOCAL(1)').valor;
  assert.equal(ab.cantidad, ba.cantidad);
  const sumandos = (v) => v.desglose.map((d) => d.cantidad).sort((x, y) => x - y);
  assert.deepEqual(sumandos(ab), sumandos(ba));
  // Unidad nueva a la derecha: entra en la composición con su desglose (el 8 de la tarea: EUR + horas).
  assert.equal(evaluar(eje, id, [5]).texto, '350 EUR + 3 h (1 h + 2 h)');
  assert.equal(c('1 EUR + (2 EUR + 1 h + 2 h)'), '3 EUR (1 EUR + 2 EUR) + 3 h (1 h + 2 h)');
  // Al restar, cada sumando del derecho cambia de signo.
  assert.equal(evaluar(eje, id, [6]).texto, '-4 EUR (1 EUR + 2 EUR + -3 EUR + -4 EUR)');
  // Sin desglose sigue igual que antes.
  assert.equal(c('12 EUR + 2 EUR'), '14 EUR (12 EUR + 2 EUR)');
  assert.equal(c('5 EUR + 1 h'), '5 EUR + 1 h');
});

test('composición heterogénea preserva los operandos', async () => {
  const { eje, id } = await ejeCon(['x', '=200 m + 5 EUR', '=LOCAL(1) + 100 m']);
  const r = evaluar(eje, id, '1000000000');
  assert.equal(r.estado, 'RESUELTO');
  assert.equal(r.valor.tipo, 'composicion');
  assert.equal(r.texto, '200 m + 5 EUR');
  assert.equal(evaluar(eje, id, '2000000000').texto, '300 m (200 m + 100 m) + 5 EUR');
});

test('LOCAL lee la décupla anfitriona, también literales con unidad', async () => {
  const { eje, id } = await ejeCon(['Compra', ['menú', 1, 'EUR 12'], '=LOCAL(1, 2) + 2 EUR', '=LOCAL(2) + 15 min']);
  assert.equal(evaluar(eje, id, '2000000000').texto, '14 EUR (12 EUR + 2 EUR)');
  const r = evaluar(eje, id, '3000000000');
  assert.equal(r.texto, '14 EUR (12 EUR + 2 EUR) + 15 min');
  assert.ok(r.dependencias.includes(id + ':2000000000'));
});

test('REF lee otro evento por id o prefijo, con subposición', async () => {
  const { eje, menu, compra } = await ejemploCompra();
  // Después de la compra (13:30): el t de un evento no es anterior al de su foco ([X] confirmar VG, src/ciclo.js).
  const cuenta = await eje.escribir({ autor: 'cocina', sobre: compra.id, t: '2026-11-07T14:00:00Z', movimientos: [gastaT('cocina')],
    payload: ['Cuenta', '=REF("' + compra.id.slice(0, 8) + '", "1200000000") + 2 EUR', '=REF("' + menu.id + '", "1000000000")'] });
  assert.equal(evaluar(eje, cuenta.id, '1000000000').texto, '14 EUR (12 EUR + 2 EUR)');
  // VG, 7-11 noche: por hojas: la 1 del menú es la lista de los tres platos, no una décupla.
  assert.equal(evaluar(eje, cuenta.id, '2000000000').valor.tipo, 'lista');
  assert.equal(evaluar(eje, cuenta.id, '2000000000').texto, 'ensalada · guiso · fruta');
  // «0000000000» es la raíz (límite conocido de los ceros); la posición 0 se pide por índices.
  assert.equal(evaluar(eje, cuenta.id, '0000000000').texto, '[3 posiciones]');
  assert.equal(evaluar(eje, cuenta.id, [0]).texto, 'Cuenta');
});

test('estados: PENDIENTE, INCOMPATIBLE, ERROR (sintaxis, función, ciclo)', async () => {
  const { eje, id } = await ejeCon(['texto', '=LOCAL(9)', '=LOCAL(0) + 1', '=1 +', '=HOLA(1)', '=LOCAL(6)', '=LOCAL(5) + 1', '=2 kg * 3 kg']);
  assert.equal(evaluar(eje, id, '1000000000').estado, 'PENDIENTE');
  assert.equal(evaluar(eje, id, '2000000000').estado, 'INCOMPATIBLE');
  assert.equal(evaluar(eje, id, '3000000000').estado, 'ERROR');
  assert.match(evaluar(eje, id, '4000000000').motivo, /función desconocida: HOLA/);
  const ciclo = evaluar(eje, id, '5000000000');
  assert.equal(ciclo.estado, 'ERROR');
  assert.match(ciclo.motivo, /ciclo/);
  assert.equal(evaluar(eje, id, '7000000000').estado, 'INCOMPATIBLE');
});

test('las referencias BTML se siguen al leer un slot', async () => {
  const { eje, compra, menu } = await ejemploCompra();
  // VG, 7-11 noche: por hojas: la 1 de la compra es la décupla [[ref menú:1], 1, 'EUR 12'] (por dirección,
  // ceros finales: la 1 entera); su 1.0 es la lista de uno con la referencia al menú:1, que se lee por índice.
  const r = evaluar(eje, compra.id, '1000000000');
  assert.equal(r.estado, 'RESUELTO');
  assert.equal(r.valor.tipo, 'array');
  const slot = evaluar(eje, compra.id, '1000000000');
  assert.equal(formato(slot.valor), '[3 posiciones]');
  assert.equal(evaluar(eje, compra.id, [1, 0]).valor.tipo, 'lista');
  assert.equal(evaluar(eje, compra.id, [1, 0]).texto, '→ ' + menu.id.slice(0, 8));
  // El elemento 0 de esa lista es la referencia: LOCAL la lee por índice y la sigue hasta la lista de platos del menú.
  assert.equal(evaluar(eje, compra.id, [1, 0, 0]).valor.tipo, 'referencia');
  assert.equal(consultar(eje, compra.id, [8], 'LOCAL(1, 0, 0)').texto, 'ensalada · guiso · fruta');
});

test('la evaluación no tiene efectos', async () => {
  const { eje, id } = await ejeCon(['x', '=1 + 1']);
  const antes = eje.orden.length;
  const saldo = eje.saldo('raiz', 'T:minuto');
  evaluar(eje, id, '1000000000');
  assert.equal(eje.orden.length, antes);
  assert.equal(eje.saldo('raiz', 'T:minuto'), saldo);
});
