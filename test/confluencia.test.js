import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Eje } from '../src/eje.js';
import { ejemploCompra, ejemploCuenta, ejemploComprasVecinas } from '../ejemplos/ikisai/compra-food.mjs';
import { EPOCA_0 } from '../src/epocas.js';
import {
  confluir, comparables, proyectoDe, medir, posicionesDe, clavesDe, etiquetaClave, fundir, unitaria, estadisticaVacia, cortesDe,
  ALCANCES, MEDIDAS, HITOS, SIN_BASE_ESCRITA,
} from '../src/bases.js';

// VG, 7-11 noche (mapa §14.2): una sola verdad del 8, la escrita. confluir() queda como respaldo
// declarado (al vuelo, «sin base escrita»); una sola medida (bases.medir); los cortes son regla de la
// época (la 0 trae 1 2 3 4 6 10 16 26 42): se retiran los cortes de cohorte y tiempo.distribucion.
const ESCALA_0 = [1, 2, 3, 4, 6, 10, 16, 26, 42];

/** La compra ampliada: diez compras hermanas sobre el menú, la cuenta sobre la compra, un criterio de cocina. */
async function ampliada() {
  const base = await ejemploCompra();
  const cuenta = await ejemploCuenta(base.eje, base.compra);
  const vecinas = await ejemploComprasVecinas(base.eje, { menu: base.menu });
  return { ...base, cuenta, ...vecinas };
}

const gasta = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });

test('cortes: regla de la época; la época 0 trae 1 2 3 4 6 10 16 26 42 para las cantidades (R7: los recuentos no tienen)', async () => {
  for (const clave of ['T:hora', 'E:casa/EUR', 'P:genesis', 'tiempo:minuto']) assert.deepEqual(cortesDe(clave), { cortes: ESCALA_0, origen: 'epoca' }, clave);
  for (const clave of MEDIDAS.map((m) => m.clave)) assert.throws(() => cortesDe(clave), /recuento informativo/, clave);
  // Solo lo fundible: n, suma, mínimo, máximo y, en las cantidades, cortes y diez cajas; el foco se sitúa en su caja y por su cuota.
  const { eje, rapida } = await ampliada();
  const c = confluir(eje, rapida.id);
  for (const d of Object.values(c.medidas)) {
    for (const k of ['n', 'suma', 'minimo', 'maximo', 'foco', 'media']) assert.ok(k in d, k);
    for (const k of ['cortes', 'cajas', 'caja', 'enCaja', 'cuota', 'nivel', 'grado']) assert.ok(!(k in d), k);
    assert.equal(d.recuento, true);
  }
  for (const d of Object.values(c.tokens)) {
    for (const k of ['n', 'suma', 'minimo', 'maximo', 'cortes', 'origenCortes', 'cajas', 'foco', 'caja', 'cuota', 'cajaCuota', 'enCaja', 'debajo', 'encima']) assert.ok(k in d, k);
    for (const k of ['mediana', 'cuantil', 'menores', 'iguales', 'mayores', 'nivel', 'grado', 'puntuacion']) assert.ok(!(k in d), k);
    assert.deepEqual(d.cortes, ESCALA_0);
    assert.equal(d.debajo + d.enCaja + d.encima, d.n);
  }
});

test('fundir es O(1) y exacto: por partes da lo mismo que todo junto; con cortes distintos no se funde (no hay escala puente)', async () => {
  const { eje, rapida } = await ampliada();
  const u = comparables(eje, rapida.id).map((e) => unitaria(medir(eje, e.id)));
  const junta = (l) => l.reduce((a, b) => fundir(a, b), estadisticaVacia());
  const todo = junta(u);
  assert.deepEqual(fundir(junta(u.slice(0, 4)), junta(u.slice(4))), todo);
  assert.equal(todo.n, 10);
  const c = confluir(eje, rapida.id);
  for (const k of Object.keys(c.medidas)) assert.deepEqual([c.medidas[k].n, c.medidas[k].suma, c.medidas[k].cajas], [todo.medidas[k].n, todo.medidas[k].suma, todo.medidas[k].cajas], k);
  const otra = { ...EPOCA_0, nombre: 'otra', cortes: () => [1, 2, 3, 4, 5, 6, 7, 8, 9] };
  assert.throws(() => fundir(todo, unitaria(medir(eje, rapida.id), otra)), /cortes distintos/);
});

test('comparables: hermanos ⊂ proyecto ⊂ general, en orden de llegada y con el foco siempre dentro', async () => {
  const { eje, menu, rapida, alta, cuenta, alta2, criterioCocina } = await ampliada();
  const hermanos = comparables(eje, rapida.id, 'hermanos');
  assert.equal(hermanos.length, 10);
  assert.ok(hermanos.every((e) => e.sobre === menu.id));
  assert.ok(hermanos.some((e) => e.id === rapida.id));
  // El proyecto es el registro del hilo que cuelga del génesis (el 8 del génesis funde los de los proyectos).
  assert.equal(proyectoDe(eje, rapida.id).id, alta.id);
  assert.equal(proyectoDe(eje, cuenta.id).id, alta.id);
  assert.equal(proyectoDe(eje, alta.id).id, alta.id); // un proyecto es su propio proyecto
  assert.equal(proyectoDe(eje, eje.genesisId).id, eje.genesisId);
  const proyecto = comparables(eje, rapida.id, 'proyecto');
  const ids = proyecto.map((e) => e.id);
  assert.equal(proyecto.length, 14); // el alta, el menú, las diez compras, la cuenta y el criterio de cocina
  for (const id of [alta.id, menu.id, cuenta.id, criterioCocina.id, ...hermanos.map((e) => e.id)]) assert.ok(ids.includes(id));
  assert.ok(!ids.includes(eje.genesisId)); // el génesis es el ámbito, no el proyecto
  assert.ok(!ids.includes(alta2.id)); // otro proyecto
  assert.deepEqual(ids, eje.orden.filter((id) => ids.includes(id))); // orden de llegada
  assert.deepEqual(comparables(eje, cuenta.id, 'proyecto').map((e) => e.id), ids); // todo el proyecto comparte cohorte
  // La cohorte no es el hilo: el hilo de la rápida son cuatro registros.
  assert.equal(eje.hilo(rapida.id).length, 4);
  // Un foco que es él mismo un proyecto: su cohorte es lo que cuelga de él; sus hermanos, los otros proyectos.
  assert.deepEqual(comparables(eje, alta2.id, 'proyecto').map((e) => e.id), [alta2.id]);
  assert.deepEqual(comparables(eje, alta.id, 'hermanos').map((e) => e.id), [alta.id, alta2.id]);
  const general = comparables(eje, rapida.id, 'general');
  assert.deepEqual(general.map((e) => e.id), eje.orden); // orden de llegada
  assert.deepEqual(comparables(eje, eje.genesisId, 'proyecto').map((e) => e.id), eje.orden); // el proyecto del génesis es todo el eje
  assert.deepEqual(ALCANCES, ['hermanos', 'proyecto', 'general']); // las tres cohortes de VG (7-11)
  assert.equal(comparables(eje, eje.genesisId).length, 1); // el génesis no tiene hermanos
  for (const viejo of ['hilo', 'vecindad', 'linaje', 'todo']) assert.throws(() => comparables(eje, rapida.id, viejo), /alcance desconocido/);
  assert.throws(() => confluir(eje, 'nadie'), /foco desconocido/);
});

test('el proyecto se recorre por el índice de hijos: solo su subárbol, en orden de llegada aunque los proyectos se intercalen', async () => {
  const t = '2026-11-07T09:00:00Z';
  const eje = await Eje.genesis({ demostracion: true, identidad: 'casa', tipo: 'persona', emision: [], foco: 'raíz', t }); // VG, 7-11 noche: el génesis lo emite una persona (antes, un grupo)
  const escribe = (sobre, payload) => eje.escribir({ autor: 'casa', sobre, t, movimientos: [gasta('casa')], payload });
  const a = await escribe(eje.genesisId, ['Proyecto A']);
  const b = await escribe(eje.genesisId, ['Proyecto B']);
  const ultimo = new Map([[a.id, a.id], [b.id, b.id]]);
  const del = new Map([[a.id, [a.id]], [b.id, [b.id]]]);
  for (let i = 0; i < 150; i++) {
    for (const p of [a, b]) {
      const e = await escribe(i % 3 === 0 ? p.id : ultimo.get(p.id), ['paso ' + i]); // ramas desde el proyecto y cadenas hondas
      ultimo.set(p.id, e.id);
      del.get(p.id).push(e.id);
    }
  }
  const foco = ultimo.get(a.id);
  assert.equal(proyectoDe(eje, foco).id, a.id);
  assert.deepEqual(comparables(eje, foco, 'proyecto').map((e) => e.id), del.get(a.id));
  const c = confluir(eje, foco, { alcance: 'proyecto' });
  assert.equal(c.n, 151);
  assert.equal(c.tokens['T:minuto'].suma, 151);
  assert.deepEqual(comparables(eje, b.id, 'hermanos').map((e) => e.id), [a.id, b.id]);
});

test('posicionesDe: las diez posiciones leídas de sus ocupantes, con su procedencia', async () => {
  const { eje, menu, compra, vecinas } = await ampliada();
  // La compra: 0 propia; 1 propia (décupla) + alcanzada (1.0 es una lista con una referencia) + escrita (la cuenta, en 1);
  // 2 solo alcanzada (VG, 7-11 noche: por hojas: la 2 es una lista de una referencia y cada elemento es un
  // ocupante; la lista no es un ocupante propio); 3 y 4 propias.
  const c = posicionesDe(eje, compra.id);
  assert.equal(c.desarrolladas, 5);
  assert.deepEqual(c.posiciones[1], { indice: 1, propia: true, referencia: true, escrita: true, tiene: true });
  assert.deepEqual(c.posiciones[2], { indice: 2, propia: false, referencia: true, escrita: false, tiene: true });
  assert.deepEqual(c.posiciones[5], { indice: 5, propia: false, referencia: false, escrita: false, tiene: false });
  assert.equal(c.raiz.escrita, false); // la cuenta está en 1, no en la raíz
  // Una posición que es directamente una referencia está alcanzada, no es propia: las referencias no copian.
  const mediodia = posicionesDe(eje, vecinas[2].id);
  assert.deepEqual(mediodia.posiciones[2], { indice: 2, propia: false, referencia: true, escrita: false, tiene: true });
  // Un registro que es solo una referencia es un terminal: no tiene posición 0.
  const soloRef = await eje.escribir({ autor: 'huesped', sobre: menu.id, t: '2026-11-07T14:30:00Z', movimientos: [gasta('huesped')], payload: { ref: menu.id, dir: '1000000000' } });
  assert.equal(posicionesDe(eje, soloRef.id).desarrolladas, 0);
  // Los ocupantes de la 1 son 1, 1.0, 1.0.0…: una referencia en el camino 1.1 ocupa la 1.1, no la 1.
  const honda = await eje.escribir({ autor: 'huesped', sobre: menu.id, t: '2026-11-07T14:30:30Z', movimientos: [gasta('huesped')], payload: ['Compra', [['EUR 3'], [{ ref: menu.id, dir: '1000000000' }]]] }); // VG, 7-11 noche: por hojas: 1 décupla (0 envuelto)
  assert.deepEqual(posicionesDe(eje, honda.id).posiciones[1], { indice: 1, propia: true, referencia: false, escrita: false, tiene: true });
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

test('medir, la única medida: posiciones frente a terminales, tokens por clave, identidades, profundidad y fórmulas', async () => {
  const { eje, compra, cuenta, vecinas } = await ampliada();
  const m = medir(eje, compra.id);
  assert.deepEqual(Object.keys(m).slice(0, 8), MEDIDAS.map((x) => x.clave)); // una sola medida (bases.medir): la de tiempo.js se retira
  assert.equal(m.terminales, 9);
  assert.equal(m.posiciones, 5); // 0–4 desarrolladas: la misma definición que las bases por posición
  assert.equal(m.escritos, 1);
  // Por serie, sin totales de familia; y el T que gastaron quienes escribieron encima (R7: una cantidad).
  assert.deepEqual(m.tokens, { 'T:hora': 1, 'E:casa/EUR': 12, 'tiempo:minuto': 3 });
  for (const familia of ['T', 'E', 'P', 'R']) assert.ok(!(familia in m.tokens));
  assert.equal(m.identidades, 2); // huesped y cocina
  assert.equal(m.profundidadHilo, 3);
  assert.equal(m.formulasResueltas, 0);
  assert.equal(m.procedencias.length, 10);
  const c = medir(eje, cuenta.id);
  assert.equal(c.formulasResueltas, 2); // REF + 2 EUR y LOCAL(1) + 15 min
  assert.equal(c.formulasPendientes, 0);
  assert.equal(c.profundidadHilo, 4);
  assert.equal(medir(eje, vecinas[0].id).formulasPendientes, 1); // =LOCAL(5) sin posición 5
  assert.equal(medir(eje, vecinas[1].id).formulasResueltas, 1); // =LOCAL(0) + 1 EUR dentro de recursos
  const nota = medir(eje, vecinas[6].id);
  assert.equal(nota.terminales, 1);
  assert.equal(nota.posiciones, 0); // un terminal no tiene posición 0
  const g = medir(eje, eje.genesisId);
  assert.equal(g.identidades, 1);
  assert.equal(g.profundidadHilo, 0);
  // Una hora no son sesenta minutos; y el T consumido sobre el génesis, aparte.
  assert.deepEqual(g.tokens, { 'E:casa/EUR': 500, 'P:genesis': 10, 'tiempo:minuto': eje.tiempoSobre(eje.genesisId).minuto });
  assert.deepEqual(clavesDe(eje.obtener(eje.genesisId)), Object.fromEntries(Object.entries(g.tokens).filter(([k]) => !k.startsWith('tiempo:'))));
  assert.throws(() => medir(eje, 'nadie'), /registro desconocido/);
});

test('tokens por clave: P por ámbito y R por emisor nunca se suman en un total', async () => {
  const t = '2026-11-07T09:00:00Z';
  const eje = await Eje.genesis({
    demostracion: true,
    identidad: 'casa',
    tipo: 'persona', // VG, 7-11 noche: el génesis lo emite una persona (antes, un grupo)
    emision: [{ token: 'P', cantidad: 5, ambito: 'genesis' }, { token: 'R', cantidad: 3, emisor: 'casa' }],
    foco: 'raíz',
    t,
  });
  const alta = await eje.escribir({
    autor: 'casa',
    sobre: eje.genesisId,
    t,
    movimientos: [gasta('casa'), { token: 'P', cantidad: 2, ambito: 'genesis', de: 'casa', a: 'ana' }, { token: 'R', cantidad: 1, emisor: 'casa', de: 'casa', a: 'ana' }],
    payload: ['Alta de Ana', ['ana']],
    contexto: { tipos: { ana: 'persona' } },
  });
  const estrecha = await eje.escribir({
    autor: 'casa',
    sobre: alta.id,
    t,
    movimientos: [gasta('casa'), { token: 'P', cantidad: 3, ambito: alta.id, de: 'casa', a: 'ana' }],
    payload: 'poder solo sobre el alta',
  });
  const c = confluir(eje, estrecha.id, { alcance: 'general' });
  assert.deepEqual(Object.keys(c.tokens), ['P:' + alta.id, 'P:genesis', 'R:casa', 'T:minuto', 'tiempo:minuto']);
  for (const familia of ['T', 'E', 'P', 'R']) assert.ok(!(familia in c.tokens));
  assert.equal(c.tokens['P:genesis'].foco, 0);
  assert.equal(c.tokens['P:genesis'].maximo, 5);
  assert.equal(c.tokens['P:genesis'].suma, 5 + 2); // el génesis emite 5 y el alta delega 2: misma serie
  assert.equal(c.tokens['P:' + alta.id].foco, 3);
  assert.equal(c.tokens['P:' + alta.id].caja, 3); // tres de poder: la caja 3 de la escala de la época 0
  assert.deepEqual([c.tokens['P:' + alta.id].cajas[3], c.tokens['P:' + alta.id].encima], [1, 0]); // nadie más movió poder sobre el alta
  assert.equal(c.tokens['R:casa'].maximo, 3);
  assert.deepEqual(c.comparables[1].tokens, { 'T:minuto': 1, 'P:genesis': 2, 'R:casa': 1, 'tiempo:minuto': 1 }); // el alta: una clave por serie, ningún total
  assert.equal(c.tokens['P:genesis'].etiqueta, 'P movido sobre el eje');
  assert.equal(etiquetaClave('P:' + alta.id), 'P movido sobre ' + alta.id.slice(0, 8));
  assert.equal(etiquetaClave('R:casa'), 'R movida de casa');
  assert.equal(etiquetaClave('E:casa/EUR'), 'E movido (EUR de casa)');
  assert.equal(etiquetaClave('T:minuto'), 'T movido en minuto');
  assert.equal(etiquetaClave('tiempo:minuto'), 'T consumido sobre el registro, en minuto');
});

test('confluir: las bases del foco entre sus hermanos, sin nivel ni grado', async () => {
  const { eje, compra, rapida } = await ampliada();
  const antes = eje.orden.length;
  const c = confluir(eje, rapida.id);
  assert.equal(eje.orden.length, antes); // consulta sin efectos
  assert.deepEqual([c.escrita, c.respaldo, c.frescura, c.baseEscrita], [false, true, SIN_BASE_ESCRITA, null]); // respaldo declarado
  assert.equal(c.alcance, 'hermanos');
  assert.equal(c.n, 10);
  assert.equal(c.comparables.length, 10);
  assert.deepEqual(Object.keys(c.medidas), MEDIDAS.map((m) => m.clave));
  assert.deepEqual(Object.keys(c.tokens), ['E:casa/EUR', 'T:hora', 'T:minuto', 'tiempo:minuto']); // solo las series que alguien mueve, y el T gastado encima
  for (const d of Object.values(c.medidas)) assert.deepEqual([d.recuento, d.n, 'caja' in d], [true, 10, false]);
  for (const d of Object.values(c.tokens)) {
    assert.ok(!('nivel' in d) && !('grado' in d) && !('puntuacion' in d) && !('cuantil' in d) && !('mediana' in d));
    assert.equal(d.n, 10);
    assert.equal(d.cajas.length, 10);
    assert.equal(d.cajas.reduce((s, x) => s + x, 0), 10);
    assert.ok(Number.isInteger(d.caja) && d.caja >= 0 && d.caja <= 9);
  }
  assert.ok(!('nivel' in c) && !('grado' in c) && !('puntuacion' in c) && !('posicion' in c));
  // Tiempo, por escala: la compra original gastó una hora; las otras nueve, un minuto. Una hora no son sesenta minutos.
  assert.equal(c.tokens['T:hora'].suma, 1);
  assert.equal(c.tokens['T:hora'].foco, 0);
  assert.equal(c.tokens['T:hora'].caja, 0);
  assert.equal(c.tokens['T:minuto'].etiqueta, 'T movido en minuto');
  assert.equal(c.tokens['T:minuto'].suma, 9);
  assert.equal(c.tokens['T:minuto'].foco, 1);
  assert.equal(c.tokens['T:minuto'].caja, 1);
  assert.deepEqual(c.tokens['T:minuto'].cajas, [1, 9, 0, 0, 0, 0, 0, 0, 0, 0]);
  // Recursos: solo la compra y la rápida pagaron 12 EUR de la casa; quien no mueve EUR cuenta 0.
  assert.equal(c.tokens['E:casa/EUR'].foco, 12);
  assert.equal(c.tokens['E:casa/EUR'].minimo, 0);
  assert.equal(c.tokens['E:casa/EUR'].suma, 24);
  assert.deepEqual(c.tokens['E:casa/EUR'].cajas, [8, 0, 0, 0, 0, 0, 2, 0, 0, 0]); // 12 cae en la caja 6 (de 10 a 15)
  // Cuota (R7): la rápida pagó 12 de los 24 EUR de sus hermanas: la mitad, en la caja 5 de las cuotas.
  assert.deepEqual([c.tokens['E:casa/EUR'].cuota, c.tokens['E:casa/EUR'].cajaCuota], [0.5, 5]);
  // Todas las hermanas comparten la profundidad del hilo (3): un recuento, sin cajas.
  assert.deepEqual([c.medidas.profundidadHilo.suma, c.medidas.profundidadHilo.minimo, c.medidas.profundidadHilo.maximo], [30, 3, 3]);
  // Nadie ha escrito sobre la rápida; sobre dos hermanas sí.
  assert.equal(c.medidas.escritos.foco, 0);
  assert.equal(c.medidas.escritos.suma, 2);
  assert.equal(c.medidas.escritos.maximo, 1);
  assert.equal(c.hitos, HITOS); // solo como tabla
  // La compra original es la más desarrollada en terminales (sola en su caja, nadie encima); en posiciones
  // comparte la caja 4 (de 4 a 5) con otras dos.
  const d = confluir(eje, compra.id);
  assert.equal(d.medidas.terminales.foco, 9);
  assert.equal(d.medidas.terminales.maximo, 9);
  assert.equal('caja' in d.medidas.terminales, false); // un recuento: se informa, no se sitúa (R7)
  assert.equal(d.medidas.posiciones.foco, 5);
  assert.equal(d.medidas.posiciones.maximo, 5);
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
  // VG, 7-11 noche: por hojas: el array de criterios de la compra y de cuatro vecinas es una lista de una
  // referencia; su elemento es el ocupante, así que esas cinco ya no cuentan como propias, solo alcanzadas.
  assert.equal(criterios.propias, 0);
  assert.equal(criterios.referencias, 6); // esas cinco alcanzan el menú por referencia; la de mediodía solo por referencia
  assert.equal(criterios.escritas, 1); // cocina escribió el criterio encima de una compra sin criterios
  assert.equal(criterios.proporcion, 0.7);
  assert.equal(criterios.foco, false);
  assert.deepEqual(criterios.delFoco, { propia: false, referencia: false, escrita: false });
  const d = confluir(eje, compra.id);
  assert.equal(d.posiciones[2].foco, true);
  assert.deepEqual(d.posiciones[2].delFoco, { propia: false, referencia: true, escrita: false }); // VG, 7-11 noche: por hojas: lista de una referencia
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
  // Otra época cambia el significado de las posiciones y nada más; sin cortes propios, usa los de la época 0 (respaldo).
  const otra = { nombre: 'otra', reglaCorta: (profundidad, digito) => 'd' + profundidad + '.' + digito };
  const base = confluir(eje, rapida.id);
  const leida = confluir(eje, rapida.id, { epoca: otra });
  assert.equal(leida.posiciones[2].significado, 'd0.2');
  assert.deepEqual(leida.posiciones.map(({ significado, ...resto }) => resto), base.posiciones.map(({ significado, ...resto }) => resto));
  const sinOrigen = (medidas) => Object.fromEntries(Object.entries(medidas).map(([k, { origenCortes, ...resto }]) => [k, resto]));
  assert.deepEqual(leida.medidas, base.medidas);
  assert.deepEqual(sinOrigen(leida.tokens), sinOrigen(base.tokens));
  assert.deepEqual([leida.tokens['T:minuto'].origenCortes, base.tokens['T:minuto'].origenCortes], ['respaldo', 'epoca']);
});

test('las cohortes proyecto y general cambian las bases; el génesis solo se compara consigo mismo', async () => {
  const { eje, rapida } = await ampliada();
  const proyecto = confluir(eje, rapida.id, { alcance: 'proyecto' });
  assert.equal(proyecto.alcance, 'proyecto');
  assert.equal(proyecto.n, 14);
  assert.equal(proyecto.medidas.profundidadHilo.minimo, 1); // el alta: el génesis no es del proyecto
  assert.equal(proyecto.medidas.profundidadHilo.maximo, 4); // la cuenta y el criterio de cocina
  assert.equal(proyecto.medidas.profundidadHilo.foco, 3);
  assert.deepEqual(Object.keys(proyecto.tokens), ['E:casa/EUR', 'T:hora', 'T:minuto', 'tiempo:hora', 'tiempo:minuto']); // sin el génesis, nadie del proyecto mueve poder
  const general = confluir(eje, rapida.id, { alcance: 'general' });
  assert.equal(general.n, eje.orden.length);
  assert.equal(general.medidas.profundidadHilo.minimo, 0); // el génesis
  assert.equal(general.medidas.profundidadHilo.maximo, 4); // la cuenta y el criterio de cocina
  assert.equal(general.medidas.formulasResueltas.maximo, 2); // la cuenta
  assert.deepEqual(Object.keys(general.tokens), ['E:casa/EUR', 'P:genesis', 'T:hora', 'T:minuto', 'tiempo:hora', 'tiempo:minuto']); // el génesis emite poder sobre el eje
  assert.equal(confluir(eje, eje.genesisId, { alcance: 'proyecto' }).n, eje.orden.length); // el proyecto del génesis es todo el eje
  const g = confluir(eje, eje.genesisId);
  assert.equal(g.n, 1);
  assert.deepEqual([g.medidas.posiciones.foco, g.medidas.posiciones.n], [1, 1]); // solo, con una posición (la 0, por lo escrito en su raíz): no hay con quién compararse
  assert.equal(g.tokens['P:genesis'].foco, 10);
  assert.equal(g.tokens['P:genesis'].n, 1);
  // El génesis de ejemplo es un terminal: no tiene posición 0 propia. Pero las altas están ancladas
  // en su raíz (en = 0000000000), que colisiona con la posición 0 (§12: colisiones, no apaños);
  // la raíz se devuelve aparte para que el 8 pueda distinguirla.
  assert.equal(g.posiciones[0].propias, 0);
  assert.equal(g.posiciones[0].escritas, 1);
  assert.equal(g.posiciones[0].comparables, 1);
  assert.deepEqual(g.raiz, { comparables: 1, proporcion: 1, foco: true });
});

test('los cortes de la época valen en todas las cohortes: las cajas se funden de una cohorte a otra', async () => {
  const { eje, rapida } = await ampliada();
  const cortes = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const conCortes = { nombre: 'con cortes', reglaCorta: (p, d) => 'd' + d, cortes: () => cortes };
  for (const epoca of [EPOCA_0, conCortes]) {
    const hermanos = confluir(eje, rapida.id, { epoca });
    const general = confluir(eje, rapida.id, { alcance: 'general', epoca });
    assert.equal(hermanos.tokens['T:minuto'].origenCortes, 'epoca');
    assert.deepEqual(hermanos.tokens['T:minuto'].cortes, epoca === EPOCA_0 ? ESCALA_0 : cortes);
    assert.deepEqual(hermanos.tokens['T:minuto'].cortes, general.tokens['T:minuto'].cortes); // sin cortes de cohorte
  }
});
