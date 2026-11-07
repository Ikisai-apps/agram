import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejemploCompra, ejemploCuenta, ejemploComprasVecinas } from '../ejemplos/ikisai/compra-food.mjs';
import { confluir, comparables, medidasDe, distribucion, ALCANCES, MEDIDAS, HITOS, medir } from '../src/tiempo.js';

/** La compra ampliada: diez compras hermanas sobre el menú, la cuenta sobre la compra, un criterio de cocina. */
async function ampliada() {
  const base = await ejemploCompra();
  const cuenta = await ejemploCuenta(base.eje, base.compra);
  const vecinas = await ejemploComprasVecinas(base.eje, { menu: base.menu });
  return { ...base, cuenta, ...vecinas };
}

test('distribucion: mínimo, mediana, máximo y cuantil del foco frente a los demás', () => {
  assert.deepEqual(distribucion([1, 2, 3, 4], 4), { foco: 4, minimo: 1, mediana: 2.5, maximo: 4, cuantil: 1, menores: 3, iguales: 0, mayores: 0 });
  assert.deepEqual(distribucion([1, 2, 3, 4, 9], 1), { foco: 1, minimo: 1, mediana: 3, maximo: 9, cuantil: 0, menores: 0, iguales: 0, mayores: 4 });
  assert.equal(distribucion([5, 5, 5], 5).cuantil, 0.5); // todos iguales: ni arriba ni abajo
  assert.equal(distribucion([2, 5, 5, 7], 5).cuantil, (1 + 1 / 2) / 3); // los empates cuentan a medias
  assert.equal(distribucion([3], 3).cuantil, null); // solo: no hay con quién compararse
});

test('comparables: hermanos ⊂ hilo ⊂ todo, en orden de llegada y con el foco siempre dentro', async () => {
  const { eje, menu, rapida, alta, cuenta, alta2 } = await ampliada();
  const hermanos = comparables(eje, rapida.id, 'hermanos');
  assert.equal(hermanos.length, 10);
  assert.ok(hermanos.every((e) => e.sobre === menu.id));
  assert.ok(hermanos.some((e) => e.id === rapida.id));
  const hilo = comparables(eje, rapida.id, 'hilo');
  const idsHilo = hilo.map((e) => e.id);
  assert.equal(hilo.length, 14); // génesis, alta, alta2, menú y las diez compras
  for (const id of [eje.genesisId, alta.id, alta2.id, menu.id, ...hermanos.map((e) => e.id)]) assert.ok(idsHilo.includes(id));
  assert.ok(!idsHilo.includes(cuenta.id)); // la cuenta está sobre la compra, no sobre el hilo de la rápida
  const todo = comparables(eje, rapida.id, 'todo');
  assert.equal(todo.length, eje.orden.length);
  assert.deepEqual(todo.map((e) => e.id), eje.orden); // orden de llegada
  assert.ok(hermanos.every((e) => idsHilo.includes(e.id)) && hilo.every((e) => eje.orden.includes(e.id)));
  assert.deepEqual(ALCANCES, ['hermanos', 'hilo', 'todo']);
  assert.equal(comparables(eje, eje.genesisId).length, 1); // el génesis no tiene hermanos
  assert.throws(() => comparables(eje, rapida.id, 'vecindario'), /alcance desconocido/);
  assert.throws(() => confluir(eje, 'nadie'), /foco desconocido/);
});

test('medidasDe: tokens por familia, identidades, profundidad y fórmulas resueltas frente a pendientes', async () => {
  const { eje, compra, cuenta, vecinas } = await ampliada();
  const m = medidasDe(eje, compra.id);
  assert.deepEqual(medir(eje, compra.id), { posiciones: 9, escritos: 1, movimientos: 2 });
  assert.equal(m.posiciones, 9);
  assert.equal(m.escritos, 1);
  assert.equal(m.T, 3600); // una hora, en segundos
  assert.equal(m.E, 12);
  assert.equal(m.P, 0);
  assert.equal(m.R, 0);
  assert.equal(m.identidades, 2); // huesped y cocina
  assert.equal(m.profundidadHilo, 3);
  assert.equal(m.formulasResueltas, 0);
  const c = medidasDe(eje, cuenta.id);
  assert.equal(c.formulasResueltas, 2); // REF + 2 EUR y LOCAL(1) + 15 min
  assert.equal(c.formulasPendientes, 0);
  assert.equal(c.profundidadHilo, 4);
  assert.equal(medidasDe(eje, vecinas[0].id).formulasPendientes, 1); // =LOCAL(5) sin posición 5
  assert.equal(medidasDe(eje, vecinas[1].id).formulasResueltas, 1); // =LOCAL(1) + 1 EUR
  assert.equal(medidasDe(eje, eje.genesisId).identidades, 1);
  assert.equal(medidasDe(eje, eje.genesisId).profundidadHilo, 0);
});

test('confluir: las bases del foco entre sus hermanos, sin nivel ni grado', async () => {
  const { eje, compra, rapida } = await ampliada();
  const antes = eje.orden.length;
  const c = confluir(eje, rapida.id);
  assert.equal(eje.orden.length, antes); // consulta sin efectos
  assert.equal(c.alcance, 'hermanos');
  assert.equal(c.n, 10);
  assert.equal(c.comparables.length, 10);
  assert.deepEqual(Object.keys(c.medidas), MEDIDAS.map((m) => m.clave));
  for (const d of Object.values(c.medidas)) {
    assert.ok(!('nivel' in d) && !('grado' in d) && !('puntuacion' in d));
    assert.ok(d.cuantil >= 0 && d.cuantil <= 1);
    assert.equal(d.menores + d.iguales + d.mayores, 9);
  }
  // Tiempo: la compra original gastó una hora; las otras nueve, un minuto.
  assert.deepEqual(c.medidas.T, { foco: 60, minimo: 60, mediana: 60, maximo: 3600, cuantil: (0 + 8 / 2) / 9, menores: 0, iguales: 8, mayores: 1 });
  // Recursos: solo la compra y la rápida pagaron 12 EUR.
  assert.equal(c.medidas.E.foco, 12);
  assert.equal(c.medidas.E.cuantil, (8 + 1 / 2) / 9);
  // Todas las hermanas comparten la profundidad del hilo: nadie está arriba ni abajo.
  assert.equal(c.medidas.profundidadHilo.cuantil, 0.5);
  assert.equal(c.medidas.profundidadHilo.iguales, 9);
  // Nadie ha escrito sobre la rápida; sobre dos hermanas sí.
  assert.equal(c.medidas.escritos.foco, 0);
  assert.equal(c.medidas.escritos.mayores, 2);
  assert.equal(c.medidas.escritos.maximo, 1);
  assert.equal(c.hitos, HITOS); // solo como tabla
  // Y la compra original es la más desarrollada en posiciones.
  const d = confluir(eje, compra.id);
  assert.equal(d.medidas.posiciones.foco, 9);
  assert.equal(d.medidas.posiciones.cuantil, 1);
  assert.equal(d.medidas.posiciones.maximo, 9);
  assert.equal(d.medidas.escritos.cuantil, (8 + 1 / 2) / 9);
  assert.equal(d.medidas.formulasResueltas.foco, 0);
  assert.equal(d.medidas.formulasPendientes.maximo, 1);
});

test('bases por posición: «el 70 % de los comparables tiene criterios y tú no»', async () => {
  const { eje, compra, rapida, vecinas } = await ampliada();
  const c = confluir(eje, rapida.id);
  assert.equal(c.posiciones.length, 10);
  const criterios = c.posiciones[2];
  assert.equal(criterios.significado, 'criterios');
  assert.equal(criterios.comparables, 7);
  assert.equal(criterios.propias, 6);
  assert.equal(criterios.escritas, 1); // cocina escribió el criterio encima de una compra sin criterios
  assert.equal(criterios.proporcion, 0.7);
  assert.equal(criterios.foco, false);
  assert.equal(confluir(eje, compra.id).posiciones[2].foco, true);
  // Las diez compras tienen representación (posición 0), salvo la nota terminal, que no tiene posiciones.
  assert.equal(c.posiciones[0].comparables, 9);
  assert.equal(c.posiciones[0].proporcion, 0.9);
  assert.equal(c.posiciones[0].significado, 'representación');
  const nota = confluir(eje, vecinas[6].id);
  assert.ok(nota.posiciones.every((p) => p.foco === false));
  // Recursos: nueve de diez (todas menos la nota). Fábrica: solo la compra original y la del grupo.
  assert.equal(c.posiciones[1].comparables, 9);
  assert.equal(c.posiciones[4].comparables, 2);
  assert.equal(c.posiciones[4].significado, 'fábrica');
  assert.equal(c.posiciones[9].comparables, 0);
  assert.equal(c.posiciones[9].proporcion, 0);
});

test('alcance hilo y todo cambian las bases; el génesis solo se compara consigo mismo', async () => {
  const { eje, rapida } = await ampliada();
  const hilo = confluir(eje, rapida.id, { alcance: 'hilo' });
  assert.equal(hilo.n, 14);
  assert.equal(hilo.medidas.profundidadHilo.minimo, 0); // el génesis
  assert.equal(hilo.medidas.profundidadHilo.maximo, 3);
  assert.ok(hilo.medidas.profundidadHilo.cuantil > 0.5); // el foco está en lo más hondo del hilo
  const todo = confluir(eje, rapida.id, { alcance: 'todo' });
  assert.equal(todo.n, eje.orden.length);
  assert.equal(todo.medidas.profundidadHilo.maximo, 4); // la cuenta y el criterio de cocina
  assert.equal(todo.medidas.formulasResueltas.maximo, 2); // la cuenta
  const g = confluir(eje, eje.genesisId);
  assert.equal(g.n, 1);
  assert.equal(g.medidas.posiciones.cuantil, null);
  assert.equal(g.medidas.posiciones.minimo, g.medidas.posiciones.maximo);
  // El génesis de ejemplo es un terminal: no tiene posición 0 propia. Pero las altas están ancladas
  // en su raíz (en = 0000000000), que colisiona con la posición 0 (§12: colisiones, no apaños).
  assert.equal(g.posiciones[0].propias, 0);
  assert.equal(g.posiciones[0].escritas, 1);
  assert.equal(g.posiciones[0].comparables, 1);
});
