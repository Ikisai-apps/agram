import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Eje } from '../src/eje.js';
import { serializar, restaurar } from '../src/persistencia.js';
import { pagaElCoste } from './ayudas-coste.js';

const T0 = '2026-11-07T10:00:00Z';
const gastaT = (de) => pagaElCoste(de);

test('sobre() usa el índice y conserva el orden de entrada; la restauración lo reconstruye', async () => {
  const eje = await Eje.genesis({ demostracion: true, identidad: 'r', emision: [], foco: 'g', t: T0 });
  const g = eje.genesisId;
  const ids = [];
  for (let i = 0; i < 300; i++) {
    const ev = await eje.escribir({ autor: 'r', sobre: g, en: i % 2 ? '4000000000' : '0000000000', t: T0, movimientos: [gastaT('r')], payload: 'p' + i });
    ids.push(ev.id);
  }
  const t0 = performance.now();
  for (let k = 0; k < 200; k++) eje.sobre(g, '4000000000');
  const ms = performance.now() - t0;
  assert.deepEqual(eje.sobre(g).map((e) => e.id), ids);
  assert.equal(eje.sobre(g, '4000000000').length, 150);
  assert.deepEqual(eje.sobre('nadie'), []);
  assert.ok(ms < 500, 'doscientas consultas sobre 300 hijos en ' + ms.toFixed(0) + ' ms');
  const otro = await restaurar(JSON.parse(JSON.stringify(serializar(eje))));
  assert.deepEqual(otro.sobre(g).map((e) => e.id), ids);
  // La lista devuelta es una copia: modificarla no toca el índice.
  otro.sobre(g).pop();
  assert.equal(otro.sobre(g).length, 300);
});
