import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejemploCompra, ejemploCuenta } from '../ejemplos/ikisai/compra-food.mjs';
import { proponer, consolidar, descubrir, OPERADORES } from '../src/motor.js';

const T = '2026-11-07T11:00:00Z';
const gastaT = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });

test('operadores Q, B, C', () => {
  assert.deepEqual(OPERADORES, { Q: 'descubrir', B: 'proponer', C: 'consolidar' });
});

test('proponer: las fórmulas del foco construyen las elecciones; lo literal se propone por referencia', async () => {
  const { eje, compra } = await ejemploCompra();
  const cuenta = await ejemploCuenta(eje, compra);
  // Un plan escrito sobre la compra: en 1 elige el mejor candidato de los recursos de la compra que sea un escrito,
  // en 2 calcula un terminal, en 4 un texto literal; 3 sin desarrollar.
  const plan = await eje.escribir({ autor: 'huesped', sobre: compra.id, t: T, movimientos: [gastaT('huesped')],
    payload: ['Plan', '=ELEGIR(FILTRAR(REF("' + compra.id.slice(0, 8) + '", "1000000000"), ORIGEN() = "propio"))', '=2 * 7 EUR', 'avisar a cocina', 'pagar'] });
  void plan;
  // La fórmula de la posición 1 lee la compra:1 por REF y no es una colección (REF devuelve el valor), así que
  // probamos BUSCAR sobre el propio plan: escribimos un registro con BUSCAR del anfitrión.
  const plan2 = await eje.escribir({ autor: 'huesped', sobre: compra.id, t: T, movimientos: [gastaT('huesped')],
    payload: ['Plan 2', ['menú', 1], '=2 * 7 EUR', 'avisar a cocina', '=ELEGIR(FILTRAR(BUSCAR(1), ORIGEN() = "propio"))'] });
  const p = proponer(eje, plan2.id);
  assert.deepEqual(Object.keys(p.elecciones).map(Number), [1, 2, 3, 4]);
  assert.deepEqual(p.elecciones[1], { ref: plan2.id, dir: '1000000000' }); // literal: por referencia al foco
  assert.equal(p.elecciones[2], '14 EUR'); // fórmula con valor: terminal nuevo
  assert.deepEqual(p.elecciones[3], { ref: plan2.id, dir: '3000000000' });
  assert.equal(p.elecciones[4].candidato.evento, plan2.id); // fórmula con colección: el primer candidato
  assert.equal(p.elecciones[4].candidato.tipo, 'propio');
  assert.deepEqual(p.origenes.map((o) => o.desde), ['foco', 'formula', 'foco', 'formula']);
  assert.deepEqual(p.pendientes, []);
  // Q → B → C: la propuesta se consolida tal cual.
  const d = descubrir(eje, plan2.id);
  assert.ok(d.length);
  const c = await consolidar(eje, { autor: 'huesped', foco: plan2.id, t: T, elecciones: p.elecciones, titulo: 'Propuesto por fórmulas' });
  assert.equal(c.payload[2], '14 EUR');
  assert.deepEqual(c.payload[1], { ref: plan2.id, dir: '1000000000' });
  assert.equal(c.contexto.encaje.length, 3); // dos referencias al foco y un candidato llevan encaje; el terminal no
  void cuenta;
});

test('proponer: lo pendiente o erróneo no entra en la propuesta y se informa', async () => {
  const { eje, compra } = await ejemploCompra();
  const plan = await eje.escribir({ autor: 'huesped', sobre: compra.id, t: T, movimientos: [gastaT('huesped')],
    payload: ['Plan', '=LOCAL(9)', '=1 +', '=ELEGIR(BUSCAR(7))'] });
  const p = proponer(eje, plan.id);
  assert.deepEqual(Object.keys(p.elecciones), []);
  assert.deepEqual(p.pendientes.map((x) => x.posicion), [1, 2, 3]);
  assert.match(p.pendientes[0].motivo, /PENDIENTE/);
  assert.match(p.pendientes[1].motivo, /ERROR/);
  assert.equal(p.pendientes[2].motivo, 'sin candidatos');
});
