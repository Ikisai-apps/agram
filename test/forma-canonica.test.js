// Forma canónica de la décupla y la lista (VG, 8-11): cada posición de una
// décupla de solo hojas va entre corchetes. Las dos líneas de VG:
//
//   menú   = ['Menú del día', ['ensalada', 'guiso', 'fruta']]
//   compra = ['Compra', [[menú], [1]]]
//
// Un corchete de solo hojas es la LISTA de ocupantes de su posición; uno que
// contiene corchetes es una DÉCUPLA; una hoja suelta es la lista de uno (vale,
// pero no es la canónica). Datos inventados.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Eje } from '../src/eje.js';
import { esLista, esDecupla, validarPayload, resolver, direccion } from '../src/btml.js';
import { consultar, evaluar } from '../src/bql.js';
import { seguir } from '../src/encaje.js';
import { capacidadDe } from '../src/motor.js';

const T0 = '2026-11-08T10:00:00Z';
const gastaT = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });

async function ejeCon(payload) {
  const eje = await Eje.genesis({
    demostracion: true,
    identidad: 'raiz',
    emision: [],
    foco: payload,
    t: T0,
  });
  return { eje, id: eje.genesisId };
}

const escribe = (eje, sobre, payload) => eje.escribir({ autor: 'raiz', sobre, t: T0, movimientos: [gastaT('raiz')], payload });

test('las dos líneas de VG: la 1 de compra es una décupla y cada posición es la lista de sus ocupantes', async () => {
  const { eje, id } = await ejeCon(['Menú del día', ['ensalada', 'guiso', 'fruta']]);
  const menu = eje.obtener(id);
  const compraPayload = ['Compra', [[{ ref: menu.id }], [1]]];
  assert.equal(validarPayload(compraPayload).ok, true);
  const uno = compraPayload[1];
  assert.equal(esDecupla(uno), true);
  assert.equal(esLista(uno), false);
  assert.equal(esLista(uno[0]), true); // 1.0 = [menú]: la lista de un ocupante
  assert.equal(esLista(uno[1]), true); // 1.1 = [1]: la lista de un ocupante
  assert.equal(esLista(menu.payload[1]), true); // la lista de platos: tres ocupantes
  // La forma suelta sigue valiendo, pero [menú, 1] sin envolver es una lista de dos, no una décupla.
  assert.equal(esDecupla([{ ref: menu.id }, 1]), false);
  assert.equal(esLista([{ ref: menu.id }, 1]), true);
  const compra = await escribe(eje, id, compraPayload);
  assert.deepEqual(compra.payload, compraPayload);
  // Por dirección, cada posición es su lista; 1.1 es [1].
  assert.deepEqual(resolver(compra.payload, direccion([1, 1])), [1]);
  // 1.0 y la 1 comparten dirección (los ceros finales): la dirección nombra la colisión entera, la décupla.
  assert.deepEqual(resolver(compra.payload, direccion([1, 0])), uno);
});

test('[x] se lee como x en las fórmulas: las posiciones de una décupla canónica operan igual que las sueltas', async () => {
  const { eje, id } = await ejeCon(['Casa']);
  const canonica = await escribe(eje, id, ['Compra', [['EUR 10'], [3], ['=LOCAL(0, 0) + 1 EUR'], ['=LOCAL(1) * 2']]]);
  const suelta = await escribe(eje, id, ['Compra', [['EUR 10'], 3, '=LOCAL(0, 0) + 1 EUR', '=LOCAL(1) * 2']]);
  for (const c of [canonica, suelta]) {
    const dosDeTres = evaluar(eje, c.id, [1, 3]);
    assert.equal(dosDeTres.estado, 'RESUELTO');
    assert.equal(dosDeTres.texto, '6');
    assert.equal(evaluar(eje, c.id, [1, 2]).texto, '11 EUR (10 EUR + 1 EUR)');
    assert.equal(consultar(eje, c.id, [1, 0], 'LOCAL(1) + 4').texto, '7');
    assert.equal(consultar(eje, c.id, [1, 0], 'LOCAL(1) > 2').texto, 'verdadero');
  }
  // Lo que cambia es solo el id, porque cambia el payload.
  assert.notEqual(canonica.id, suelta.id);
});

test('[ref] se sigue como ref: una lista de un ocupante con una referencia llega a lo referenciado', async () => {
  const { eje, id } = await ejeCon(['Casa']);
  const menu = await escribe(eje, id, ['Menú', ['ensalada', 'guiso', 'fruta'], [['EUR 4'], [2]]]);
  const compra = await escribe(eje, id, ['Compra', [[{ ref: menu.id, dir: '2000000000' }], [{ ref: menu.id, dir: '2100000000' }]]]);
  // La 2.1 del menú es [2] (lista de uno; la 2 es su décupla).
  // 1.1 = [ref a la 2.1 del menú]: [ref] es ref, y la 2.1 es la lista de un ocupante [2], que se lee como su ocupante.
  const h = seguir(eje, { ref: compra.id, dir: direccion([1, 1]) });
  assert.equal(h.contenido, 2);
  assert.deepEqual(h.procedencia, [compra.id + ':1100000000', menu.id + ':2100000000']);
  assert.equal(consultar(eje, compra.id, [1, 0], 'LOCAL(1)').texto, '2');
  assert.equal(consultar(eje, compra.id, [1, 0], 'LOCAL(0, 0)').texto, '[2 posiciones]'); // 1.0 = [ref]: LOCAL la sigue hasta la 2 del menú
});

test('la capacidad de una plaza canónica es la de su lista de un ocupante', () => {
  assert.equal(capacidadDe([['cama'], ['EUR 55'], [2]]), 2);
  assert.equal(capacidadDe([['cama'], ['EUR 55'], 2]), 2); // la forma suelta sigue valiendo
  assert.equal(capacidadDe([['cama'], ['EUR 55'], ['2']]), undefined);
  assert.equal(capacidadDe([['cama'], ['EUR 55'], [0]]), undefined);
});
