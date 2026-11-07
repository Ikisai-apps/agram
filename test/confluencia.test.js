import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Eje } from '../src/eje.js';
import { ejemploCompra, ejemploCuenta, ejemploComprasVecinas } from '../ejemplos/ikisai/compra-food.mjs';
import { confluir, comparables, medidasDe, posicionesDe, clavesDe, etiquetaClave, distribucion, ALCANCES, MEDIDAS, HITOS, medir } from '../src/tiempo.js';

/** La compra ampliada: diez compras hermanas sobre el menú, la cuenta sobre la compra, un criterio de cocina. */
async function ampliada() {
  const base = await ejemploCompra();
  const cuenta = await ejemploCuenta(base.eje, base.compra);
  const vecinas = await ejemploComprasVecinas(base.eje, { menu: base.menu });
  return { ...base, cuenta, ...vecinas };
}

const gasta = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });

test('distribucion: mínimo, mediana, máximo y cuantil del foco frente a los demás', () => {
  assert.deepEqual(distribucion([1, 2, 3, 4], 4), { foco: 4, minimo: 1, mediana: 2.5, maximo: 4, cuantil: 1, menores: 3, iguales: 0, mayores: 0 });
  assert.deepEqual(distribucion([1, 2, 3, 4, 9], 1), { foco: 1, minimo: 1, mediana: 3, maximo: 9, cuantil: 0, menores: 0, iguales: 0, mayores: 4 });
  assert.equal(distribucion([5, 5, 5], 5).cuantil, 0.5); // todos iguales: ni arriba ni abajo
  assert.equal(distribucion([2, 5, 5, 7], 5).cuantil, (1 + 1 / 2) / 3); // los empates cuentan a medias
  assert.equal(distribucion([3], 3).cuantil, null); // solo: no hay con quién compararse
  // Un foco que no está entre los valores no resta nada: todos son «los demás».
  assert.deepEqual(distribucion([1, 2, 3], 5), { foco: 5, minimo: 1, mediana: 2, maximo: 3, cuantil: 1, menores: 3, iguales: 0, mayores: 0 });
  assert.equal(distribucion([1, 2, 3], 0).cuantil, 0);
  // Muchos comparables: sin desbordar la pila.
  const muchos = Array.from({ length: 300000 }, (_, i) => i);
  const d = distribucion(muchos, 5);
  assert.equal(d.minimo, 0);
  assert.equal(d.maximo, 299999);
  assert.equal(d.menores, 5);
});

test('comparables: hermanos ⊂ vecindad ⊂ todo, en orden de llegada y con el foco siempre dentro', async () => {
  const { eje, menu, rapida, alta, cuenta, alta2, criterioCocina } = await ampliada();
  const hermanos = comparables(eje, rapida.id, 'hermanos');
  assert.equal(hermanos.length, 10);
  assert.ok(hermanos.every((e) => e.sobre === menu.id));
  assert.ok(hermanos.some((e) => e.id === rapida.id));
  const vecindad = comparables(eje, rapida.id, 'vecindad');
  const idsVecindad = vecindad.map((e) => e.id);
  assert.equal(vecindad.length, 14); // génesis, alta, alta2, menú y las diez compras
  for (const id of [eje.genesisId, alta.id, alta2.id, menu.id, ...hermanos.map((e) => e.id)]) assert.ok(idsVecindad.includes(id));
  assert.ok(!idsVecindad.includes(cuenta.id)); // la cuenta está sobre la compra, no sobre el hilo de la rápida
  assert.ok(!idsVecindad.includes(criterioCocina.id));
  // La vecindad no es el hilo: el hilo de la rápida son cuatro registros.
  assert.equal(eje.hilo(rapida.id).length, 4);
  const todo = comparables(eje, rapida.id, 'todo');
  assert.equal(todo.length, eje.orden.length);
  assert.deepEqual(todo.map((e) => e.id), eje.orden); // orden de llegada
  assert.deepEqual(ALCANCES, ['hermanos', 'vecindad', 'todo']);
  assert.equal(comparables(eje, eje.genesisId).length, 1); // el génesis no tiene hermanos
  assert.throws(() => comparables(eje, rapida.id, 'hilo'), /alcance desconocido/);
  assert.throws(() => confluir(eje, 'nadie'), /foco desconocido/);
});

test('posicionesDe: las diez posiciones leídas del árbol lógico, con su procedencia', async () => {
  const { eje, menu, compra, vecinas } = await ampliada();
  // La compra: 0 propia; 1 propia (array) + alcanzada (1.0 es referencia) + escrita (la cuenta, en 1); 2 propia + alcanzada; 3 y 4 propias.
  const c = posicionesDe(eje, compra.id);
  assert.equal(c.desarrolladas, 5);
  assert.deepEqual(c.posiciones[1], { indice: 1, propia: true, referencia: true, escrita: true, tiene: true });
  assert.deepEqual(c.posiciones[2], { indice: 2, propia: true, referencia: true, escrita: false, tiene: true });
  assert.deepEqual(c.posiciones[5], { indice: 5, propia: false, referencia: false, escrita: false, tiene: false });
  assert.equal(c.raiz.escrita, false); // la cuenta está en 1, no en la raíz
  // Una posición que es directamente una referencia está alcanzada, no es propia: las referencias no copian.
  const mediodia = posicionesDe(eje, vecinas[2].id);
  assert.deepEqual(mediodia.posiciones[2], { indice: 2, propia: false, referencia: true, escrita: false, tiene: true });
  // Un registro que es solo una referencia es un terminal: no tiene posición 0.
  const soloRef = await eje.escribir({ autor: 'huesped', sobre: menu.id, t: '2026-11-07T14:30:00Z', movimientos: [gasta('huesped')], payload: { ref: menu.id, dir: '1000000000' } });
  assert.equal(posicionesDe(eje, soloRef.id).desarrolladas, 0);
  // Lo escrito por debajo de la profundidad 0 desarrolla la posición: en 1.2 desarrolla la 1.
  const sin1 = await eje.escribir({ autor: 'huesped', sobre: menu.id, t: '2026-11-07T14:31:00Z', movimientos: [gasta('huesped')], payload: ['Solo título'] });
  assert.equal(posicionesDe(eje, sin1.id).desarrolladas, 1);
  await eje.escribir({ autor: 'cocina', sobre: sin1.id, en: '1200000000', t: '2026-11-07T14:32:00Z', movimientos: [gasta('cocina')], payload: 'escrito hondo' });
  const hondo = posicionesDe(eje, sin1.id);
  assert.equal(hondo.desarrolladas, 2);
  assert.deepEqual(hondo.posiciones[1], { indice: 1, propia: false, referencia: false, escrita: true, tiene: true });
  // Lo escrito en la raíz colisiona con la posición 0 (§12) y se devuelve aparte.
  await eje.escribir({ autor: 'cocina', sobre: sin1.id, t: '2026-11-07T14:33:00Z', movimientos: [gasta('cocina')], payload: 'escrito en la raíz' });
  const conRaiz = posicionesDe(eje, sin1.id);
  assert.equal(conRaiz.raiz.escrita, true);
  assert.equal(conRaiz.posiciones[0].escrita, true);
  assert.equal(conRaiz.posiciones[0].propia, true);
});

test('medidasDe: posiciones frente a terminales, tokens por clave, identidades, profundidad y fórmulas', async () => {
  const { eje, compra, cuenta, vecinas } = await ampliada();
  const m = medidasDe(eje, compra.id);
  assert.deepEqual(medir(eje, compra.id), { posiciones: 9, escritos: 1, movimientos: 2 }); // medir() no cambia: cuenta terminales
  assert.equal(m.terminales, 9);
  assert.equal(m.posiciones, 5); // 0–4 desarrolladas: la misma definición que las bases por posición
  assert.equal(m.escritos, 1);
  assert.deepEqual(m.tokens, { T: 3600, 'E:EUR': 12 }); // por clave de saldo; sin P ni R totales
  assert.ok(!('E' in m.tokens) && !('P' in m.tokens) && !('R' in m.tokens));
  assert.equal(m.identidades, 2); // huesped y cocina
  assert.equal(m.profundidadHilo, 3);
  assert.equal(m.formulasResueltas, 0);
  assert.equal(m.procedencias.length, 10);
  const c = medidasDe(eje, cuenta.id);
  assert.equal(c.formulasResueltas, 2); // REF + 2 EUR y LOCAL(1) + 15 min
  assert.equal(c.formulasPendientes, 0);
  assert.equal(c.profundidadHilo, 4);
  assert.equal(medidasDe(eje, vecinas[0].id).formulasPendientes, 1); // =LOCAL(5) sin posición 5
  assert.equal(medidasDe(eje, vecinas[1].id).formulasResueltas, 1); // =LOCAL(0) + 1 EUR dentro de recursos
  const nota = medidasDe(eje, vecinas[6].id);
  assert.equal(nota.terminales, 1);
  assert.equal(nota.posiciones, 0); // un terminal no tiene posición 0
  const g = medidasDe(eje, eje.genesisId);
  assert.equal(g.identidades, 1);
  assert.equal(g.profundidadHilo, 0);
  assert.deepEqual(g.tokens, { T: 1000 * 3600, 'E:EUR': 500, 'P:genesis': 10 });
  assert.deepEqual(clavesDe(eje.obtener(eje.genesisId)), g.tokens);
  assert.throws(() => medidasDe(eje, 'nadie'), /registro desconocido/);
});

test('tokens por clave: P por ámbito y R por emisor nunca se suman en un total', async () => {
  const t = '2026-11-07T09:00:00Z';
  const eje = await Eje.genesis({
    identidad: 'casa',
    emision: [{ token: 'T', escala: 'hora', cantidad: 10 }, { token: 'P', cantidad: 5, ambito: 'genesis' }, { token: 'R', cantidad: 3, emisor: 'casa' }],
    foco: 'raíz',
    t,
  });
  const alta = await eje.escribir({
    autor: 'casa',
    sobre: eje.genesisId,
    t,
    movimientos: [gasta('casa'), { token: 'P', cantidad: 2, ambito: 'genesis', de: 'casa', a: 'ana' }, { token: 'R', cantidad: 1, emisor: 'casa', de: 'casa', a: 'ana' }],
    payload: ['Alta de Ana', ['ana']],
  });
  const estrecha = await eje.escribir({
    autor: 'casa',
    sobre: alta.id,
    t,
    movimientos: [gasta('casa'), { token: 'P', cantidad: 3, ambito: alta.id, de: 'casa', a: 'ana' }],
    payload: 'poder solo sobre el alta',
  });
  const c = confluir(eje, estrecha.id, { alcance: 'todo' });
  assert.deepEqual(Object.keys(c.tokens), ['P:' + alta.id, 'P:genesis', 'R:casa', 'T']);
  assert.ok(!('P' in c.tokens) && !('R' in c.tokens) && !('E' in c.tokens));
  assert.equal(c.tokens['P:genesis'].foco, 0);
  assert.equal(c.tokens['P:genesis'].maximo, 5);
  assert.equal(c.tokens['P:' + alta.id].foco, 3);
  assert.equal(c.tokens['P:' + alta.id].cuantil, 1); // nadie más movió poder sobre el alta
  assert.equal(c.tokens['R:casa'].maximo, 3);
  assert.deepEqual(c.comparables[1].tokens, { T: 60, 'P:genesis': 2, 'R:casa': 1 }); // el alta: dos claves de poder y reputación, ningún total
  assert.equal(c.tokens['P:genesis'].etiqueta, 'P movido sobre el eje');
  assert.equal(etiquetaClave('P:' + alta.id), 'P movido sobre ' + alta.id.slice(0, 8));
  assert.equal(etiquetaClave('R:casa'), 'R movida de casa');
  assert.equal(etiquetaClave('E:EUR'), 'E movido (EUR)');
  assert.equal(etiquetaClave('T'), 'T movido (segundos)');
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
  assert.deepEqual(Object.keys(c.tokens), ['E:EUR', 'T']); // solo las claves que alguien mueve
  for (const d of [...Object.values(c.medidas), ...Object.values(c.tokens)]) {
    assert.ok(!('nivel' in d) && !('grado' in d) && !('puntuacion' in d));
    assert.ok(d.cuantil >= 0 && d.cuantil <= 1);
    assert.equal(d.menores + d.iguales + d.mayores, 9);
  }
  assert.ok(!('nivel' in c) && !('grado' in c) && !('puntuacion' in c) && !('posicion' in c));
  // Tiempo: la compra original gastó una hora; las otras nueve, un minuto.
  assert.deepEqual(c.tokens.T, { etiqueta: 'T movido (segundos)', foco: 60, minimo: 60, mediana: 60, maximo: 3600, cuantil: (0 + 8 / 2) / 9, menores: 0, iguales: 8, mayores: 1 });
  // Recursos: solo la compra y la rápida pagaron 12 EUR; quien no mueve EUR cuenta 0.
  assert.equal(c.tokens['E:EUR'].foco, 12);
  assert.equal(c.tokens['E:EUR'].minimo, 0);
  assert.equal(c.tokens['E:EUR'].cuantil, (8 + 1 / 2) / 9);
  // Todas las hermanas comparten la profundidad del hilo: nadie está arriba ni abajo.
  assert.equal(c.medidas.profundidadHilo.cuantil, 0.5);
  assert.equal(c.medidas.profundidadHilo.iguales, 9);
  // Nadie ha escrito sobre la rápida; sobre dos hermanas sí.
  assert.equal(c.medidas.escritos.foco, 0);
  assert.equal(c.medidas.escritos.mayores, 2);
  assert.equal(c.medidas.escritos.maximo, 1);
  assert.equal(c.hitos, HITOS); // solo como tabla
  // La compra original es la más desarrollada en terminales; en posiciones empata con la compra del grupo.
  const d = confluir(eje, compra.id);
  assert.equal(d.medidas.terminales.foco, 9);
  assert.equal(d.medidas.terminales.cuantil, 1);
  assert.equal(d.medidas.posiciones.foco, 5);
  assert.equal(d.medidas.posiciones.maximo, 5);
  assert.equal(d.medidas.posiciones.iguales, 1);
  assert.equal(d.medidas.posiciones.cuantil, (8 + 1 / 2) / 9);
  assert.equal(d.medidas.escritos.cuantil, (8 + 1 / 2) / 9);
  assert.equal(d.medidas.formulasResueltas.foco, 0);
  assert.equal(d.medidas.formulasPendientes.maximo, 1);
});

test('bases por posición: «el 70 % de los comparables tiene criterios y tú no», con su procedencia', async () => {
  const { eje, compra, rapida, vecinas } = await ampliada();
  const c = confluir(eje, rapida.id);
  assert.equal(c.posiciones.length, 10);
  const criterios = c.posiciones[2];
  assert.equal(criterios.significado, 'criterios');
  assert.equal(criterios.comparables, 7);
  assert.equal(criterios.propias, 5); // la compra y cuatro vecinas con su array de criterios
  assert.equal(criterios.referencias, 6); // esas cinco alcanzan el menú por referencia; la de mediodía solo por referencia
  assert.equal(criterios.escritas, 1); // cocina escribió el criterio encima de una compra sin criterios
  assert.equal(criterios.proporcion, 0.7);
  assert.equal(criterios.foco, false);
  assert.deepEqual(criterios.delFoco, { propia: false, referencia: false, escrita: false });
  const d = confluir(eje, compra.id);
  assert.equal(d.posiciones[2].foco, true);
  assert.deepEqual(d.posiciones[2].delFoco, { propia: true, referencia: true, escrita: false });
  assert.deepEqual(d.posiciones[1].delFoco, { propia: true, referencia: true, escrita: true }); // la cuenta está escrita en 1
  const mediodia = confluir(eje, vecinas[2].id);
  assert.deepEqual(mediodia.posiciones[2].delFoco, { propia: false, referencia: true, escrita: false });
  assert.equal(mediodia.posiciones[2].foco, true);
  // Las diez compras tienen representación (posición 0), salvo la nota terminal, que no tiene posiciones.
  assert.equal(c.posiciones[0].comparables, 9);
  assert.equal(c.posiciones[0].proporcion, 0.9);
  assert.equal(c.posiciones[0].significado, 'representación');
  assert.equal(c.posiciones[0].escritas, 0); // nadie escribió en la raíz de una compra
  assert.deepEqual(c.raiz, { comparables: 0, proporcion: 0, foco: false });
  const nota = confluir(eje, vecinas[6].id);
  assert.ok(nota.posiciones.every((p) => p.foco === false));
  // Recursos: nueve de diez (todas menos la nota); siete los alcanzan por referencia; uno los tiene escritos (la cuenta).
  assert.equal(c.posiciones[1].comparables, 9);
  assert.equal(c.posiciones[1].referencias, 7);
  assert.equal(c.posiciones[1].escritas, 1);
  // Fábrica: solo la compra original y la del grupo.
  assert.equal(c.posiciones[4].comparables, 2);
  assert.equal(c.posiciones[4].significado, 'fábrica');
  assert.equal(c.posiciones[9].comparables, 0);
  assert.equal(c.posiciones[9].proporcion, 0);
  for (const p of c.posiciones) assert.ok(!('nivel' in p) && !('grado' in p));
});

test('bases por posición: lo escrito por debajo de la profundidad 0 cuenta, y la época solo pone el significado', async () => {
  const { eje, menu, rapida } = await ampliada();
  const sin1 = await eje.escribir({ autor: 'huesped', sobre: menu.id, t: '2026-11-07T14:31:00Z', movimientos: [gasta('huesped')], payload: ['Solo título'] });
  const antes = confluir(eje, sin1.id);
  assert.equal(antes.n, 11);
  assert.equal(antes.posiciones[1].foco, false);
  assert.equal(antes.posiciones[1].escritas, 1);
  await eje.escribir({ autor: 'cocina', sobre: sin1.id, en: '1200000000', t: '2026-11-07T14:32:00Z', movimientos: [gasta('cocina')], payload: 'escrito hondo' });
  const despues = confluir(eje, sin1.id);
  assert.equal(despues.posiciones[1].foco, true);
  assert.deepEqual(despues.posiciones[1].delFoco, { propia: false, referencia: false, escrita: true });
  assert.equal(despues.posiciones[1].escritas, 2);
  assert.equal(despues.posiciones[1].comparables, 10);
  assert.equal(despues.medidas.posiciones.foco, 2);
  // Otra época cambia el significado de las posiciones y nada más.
  const otra = { nombre: 'otra', reglaCorta: (profundidad, digito) => 'd' + profundidad + '.' + digito };
  const base = confluir(eje, rapida.id);
  const leida = confluir(eje, rapida.id, { epoca: otra });
  assert.equal(leida.posiciones[2].significado, 'd0.2');
  assert.deepEqual(leida.posiciones.map(({ significado, ...resto }) => resto), base.posiciones.map(({ significado, ...resto }) => resto));
  assert.deepEqual(leida.medidas, base.medidas);
});

test('alcance vecindad y todo cambian las bases; el génesis solo se compara consigo mismo', async () => {
  const { eje, rapida } = await ampliada();
  const vecindad = confluir(eje, rapida.id, { alcance: 'vecindad' });
  assert.equal(vecindad.n, 14);
  assert.equal(vecindad.medidas.profundidadHilo.minimo, 0); // el génesis
  assert.equal(vecindad.medidas.profundidadHilo.maximo, 3);
  assert.ok(vecindad.medidas.profundidadHilo.cuantil > 0.5); // el foco está en lo más hondo de su hilo
  assert.deepEqual(Object.keys(vecindad.tokens), ['E:EUR', 'P:genesis', 'T']); // el génesis emite poder sobre el eje
  const todo = confluir(eje, rapida.id, { alcance: 'todo' });
  assert.equal(todo.n, eje.orden.length);
  assert.equal(todo.medidas.profundidadHilo.maximo, 4); // la cuenta y el criterio de cocina
  assert.equal(todo.medidas.formulasResueltas.maximo, 2); // la cuenta
  const g = confluir(eje, eje.genesisId);
  assert.equal(g.n, 1);
  assert.equal(g.medidas.posiciones.cuantil, null);
  assert.equal(g.tokens['P:genesis'].foco, 10);
  assert.equal(g.tokens['P:genesis'].cuantil, null);
  // El génesis de ejemplo es un terminal: no tiene posición 0 propia. Pero las altas están ancladas
  // en su raíz (en = 0000000000), que colisiona con la posición 0 (§12: colisiones, no apaños);
  // la raíz se devuelve aparte para que el 8 pueda distinguirla.
  assert.equal(g.posiciones[0].propias, 0);
  assert.equal(g.posiciones[0].escritas, 1);
  assert.equal(g.posiciones[0].comparables, 1);
  assert.deepEqual(g.raiz, { comparables: 1, proporcion: 1, foco: true });
});
