// Conformidad BQL: pruebas escritas DESDE LA ESPECIFICACIÓN (corpus V4 y
// MAPA_GLOBAL_AGRAM §2.3, §10.7, §11 paso 2, §12), no desde el código. Cada
// prueba corresponde a una regla extraída del corpus con fuerza «decidido» o
// «acuerdo» (y las dos de límites que el mapa §2.3 lista como estado). Lo que
// el código no cumple todavía está igualmente escrito, marcado con { skip } y
// su id y motivo; no se maquilla (skip y no todo: con todo, Node 22 cuenta el
// fallo y el CI se pone en rojo). Las reglas con fuerza «propuesta» o
// «abierto» van en el bloque comentado del final, con su id, para que nadie
// las convierta en regla por accidente.
//
// Tres series de reglas extraídas del corpus comparten numeración BQL-nn. Aquí
// se distinguen por prefijo:
//   S = sintaxis y literales (S-01…S-26)
//   O = operadores, ámbitos y colecciones (O-01…O-40)
//   E = estados y evaluación segura (E-01…E-29)
// Nada de lo que se escribe aquí es real: datos inventados, ids que nacen al
// escribir.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Eje } from '../src/eje.js';
import { consultar, evaluar, ESTADOS, SUBTIPOS_PENDIENTE, LIMITES, esPendiente } from '../src/bql.js';
import { consolidar, estadoDe, consolidaciones } from '../src/motor.js';

const T0 = '2026-11-07T10:00:00Z';
const gastaT = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });
const ID_INEXISTENTE = 'f'.repeat(64); // bien formado, pero no está en el eje

/** Un eje mínimo: la raíz tiene tiempo y poder; su foco es el payload dado. */
async function ejeCon(payload) {
  const eje = await Eje.genesis({
    demostracion: true,
    identidad: 'raiz',
    emision: [{ token: 'T', escala: 'minuto', cantidad: 600 }, { token: 'P', cantidad: 5, ambito: 'genesis' }],
    foco: payload,
    t: T0,
  });
  return { eje, id: eje.genesisId };
}

/** Escribe un registro de la raíz sobre otro, opcionalmente anclado en una dirección. */
const escribe = (eje, sobre, payload, en) => eje.escribir({ autor: 'raiz', sobre, en, t: T0, movimientos: [gastaT('raiz')], payload });

/** Huella del eje (registros y saldos) para comprobar que una consulta no tiene efectos. */
const huella = (eje) => JSON.stringify([eje.orden, [...eje.saldos].map(([k, v]) => [k, [...v]])]);

/**
 * El ejemplo integral del corpus (03_BQL) con datos inventados: presupuesto
 * 175 en PV1 del plan, transporte 20 que se lee por REF, y tres candidatos
 * A/B/C de 120/140/170 escritos en la posición 2 del plan. La posición 5 del
 * plan guarda «dónde encaja lo que busco» como dirección de diez dígitos.
 */
async function escenarioIntegral() {
  const { eje, id } = await ejeCon(['Casa']);
  const transporte = await escribe(eje, id, ['Transporte', 'bus', 'ida', 'vuelta', 'tarifa', '20 EUR']);
  const plan = await escribe(eje, id, ['Plan de compra', '175 EUR', 'criterio', 'charla', 'fábrica', '2000000000']);
  const A = await escribe(eje, plan.id, ['A', '120 EUR'], '2000000000');
  const B = await escribe(eje, plan.id, ['B', '140 EUR'], '2000000000');
  const C = await escribe(eje, plan.id, ['C', '170 EUR'], '2000000000');
  const nombres = { [A.id]: 'A', [B.id]: 'B', [C.id]: 'C' };
  const nombre = (item) => nombres[item.evento] ?? item.origen;
  const c = (f) => consultar(eje, plan.id, [2], f);
  const REF_T = 'REF("' + transporte.id + '", "5000000000")';
  return { eje, id, transporte, plan, A, B, C, nombre, c, REF_T };
}
const ESCRITOS = 'FILTRAR(BUSCAR(2), ORIGEN() = "escrito")';

/** Colisiones y encaje: X.2 es una referencia a plan:3 (le sobra), y dos escritos en X.2 (les falta). */
async function escenarioEncaje() {
  const { eje, id } = await ejeCon(['Casa']);
  const plan = await escribe(eje, id, ['Plan', 'a', 'b', 'cena el sábado']);
  const x = await escribe(eje, id, ['X', 'recurso', { ref: plan.id, dir: '3000000000' }]);
  const h1 = await escribe(eje, x.id, 'uno', '2000000000');
  const h2 = await escribe(eje, x.id, 'dos', '2000000000');
  return { eje, id, plan, x, h1, h2, c: (f) => consultar(eje, x.id, [2], f) };
}

// =====================================================================
// Serie S: sintaxis y literales
// =====================================================================

test('S-01 «=» inicial marca la fórmula; cualquier otra cadena o número es literal', async () => {
  const { eje, id } = await ejeCon(['x', '=1 + 1', 'hola', 175, ' =1', '= 1 + 1']);
  const formula = evaluar(eje, id, [1]);
  assert.equal(formula.estado, 'RESUELTO');
  assert.equal(formula.texto, '2');
  assert.equal(evaluar(eje, id, [2]).texto, 'hola');
  assert.equal(evaluar(eje, id, [3]).texto, '175');
  assert.equal(evaluar(eje, id, [4]).texto, ' =1'); // el «=» no es el primer carácter: literal
  assert.equal(evaluar(eje, id, [5]).texto, '2'); // espacio tras el «=»: sigue siendo fórmula
});

test('S-03 el contenido de un slot es un número literal, una cadena literal o una expresión', async () => {
  const { eje, id } = await ejeCon(['x', 120, 'Yogur', '=100 + 20']);
  const n = evaluar(eje, id, [1]);
  assert.equal(n.valor.tipo, 'numero');
  assert.equal(n.texto, '120');
  const t = evaluar(eje, id, [2]);
  assert.equal(t.valor.tipo, 'texto');
  assert.equal(t.texto, 'Yogur');
  const e = evaluar(eje, id, [3]);
  assert.equal(e.estado, 'RESUELTO');
  assert.equal(e.texto, '120');
});

test('S-06 una posición explícita pasada como parámetro es una cadena de exactamente diez dígitos: REF(id, dir?)', async () => {
  const { eje, id } = await ejeCon(['Casa']);
  // VG, 7-11 noche: por hojas: el 0 envuelto hace de la 1 una décupla, direccionable por dígitos.
  const a = await escribe(eje, id, ['A', [['cero'], 'uno', 'dos']]);
  const c = (f) => consultar(eje, id, [0], f);
  assert.equal(c('REF("' + a.id + '", "1200000000")').texto, 'dos');
  assert.equal(c('REF("' + a.id + '")').valor.tipo, 'array'); // sin subposición: el registro entero
  for (const mala of ['"12"', '12', '"120000000012"', '"12000000000"']) {
    const r = c('REF("' + a.id + '", ' + mala + ')');
    assert.equal(r.estado, 'ERROR', 'dirección ' + mala);
  }
});

test('S-07 BUSCAR recibe una dirección de diez dígitos y devuelve la colección de encajes sin registrar ganador', async () => {
  // MAPA §12 [D] (VG, 7-11 tarde): un número es índice; un texto de diez dígitos es dirección. Las dos.
  const { eje, plan, c, A, B, C } = await escenarioIntegral();
  const antes = huella(eje);
  const r = c('BUSCAR("2000000000")');
  assert.equal(r.estado, 'RESUELTO');
  assert.equal(r.valor.tipo, 'coleccion');
  assert.deepEqual(r.valor.items.filter((i) => i.origen === 'escrito').map((i) => i.evento), [A.id, B.id, C.id]);
  assert.equal(r.texto, c('BUSCAR(2)').texto); // desde la raíz, índice y dirección nombran lo mismo
  assert.equal(huella(eje), antes);
  // La dirección es absoluta en el registro; el índice, relativo al anfitrión.
  const desdeDentro = (f) => consultar(eje, plan.id, [1, 0], f);
  assert.equal(desdeDentro('CONTAR(FILTRAR(BUSCAR("2000000000"), ORIGEN() = "escrito"))').texto, '3');
  assert.equal(desdeDentro('CONTAR(BUSCAR(2))').texto, '0'); // [1, 2] no existe
  for (const mala of ['"2"', '"20000000000"', '"2000000000", 1']) assert.equal(c('BUSCAR(' + mala + ')').estado, 'ERROR', mala);
});

test('S-08 LOCAL(n) toma n como índice 0–9 de la décupla anfitriona, nunca como cadena de diez dígitos', async () => {
  const { eje, id } = await ejeCon(['Casa', 'recurso', '=LOCAL(1)', '=LOCAL("8412300000")', '=LOCAL(10)', '=LOCAL()']);
  assert.equal(evaluar(eje, id, [2]).texto, 'recurso');
  assert.equal(evaluar(eje, id, [3]).estado, 'ERROR');
  assert.equal(evaluar(eje, id, [4]).estado, 'ERROR');
  assert.equal(evaluar(eje, id, [5]).estado, 'ERROR');
});

test('S-12 dentro de la fórmula «=» compara igualdad y «<>» desigualdad; «==» y «!=» no son operadores', async () => {
  const { eje, id } = await ejeCon(['Casa']);
  const c = (f) => consultar(eje, id, [0], f);
  assert.equal(c('1 + 2 = 3').texto, 'verdadero');
  assert.equal(c('1 = 2').texto, 'falso');
  assert.equal(c('1 <> 2').texto, 'verdadero');
  assert.equal(c('"a" <> "a"').texto, 'falso');
  assert.equal(c('1 == 1').estado, 'ERROR');
  assert.equal(c('1 != 2').estado, 'ERROR');
});

test('S-13 un escalar con unidad (200 m, 5 €, 12 EUR) es una magnitud: tipo de valor distinto del número', async () => {
  const { eje, id } = await ejeCon(['Casa', '12 EUR']);
  const c = (f) => consultar(eje, id, [0], f);
  for (const [f, texto] of [['200 m', '200 m'], ['5 €', '5 €'], ['12 EUR', '12 EUR']]) {
    const r = c(f);
    assert.equal(r.estado, 'RESUELTO', f);
    assert.equal(r.valor.tipo, 'magnitud', f);
    assert.equal(r.texto, texto);
  }
  assert.equal(c('12').valor.tipo, 'numero');
  assert.equal(evaluar(eje, id, [1]).valor.tipo, 'magnitud'); // también como literal de slot
});

test('S-14 misma unidad: 200 m + 50 m = 250 m sin perder el desglose de los operandos', async () => {
  const { eje, id } = await ejeCon(['Casa', '=200 m + 50 m']);
  const r = evaluar(eje, id, [1]);
  assert.equal(r.estado, 'RESUELTO');
  assert.equal(r.valor.tipo, 'magnitud');
  assert.equal(r.valor.cantidad, 250);
  assert.equal(r.valor.unidad, 'm');
  assert.deepEqual(r.valor.desglose.map((d) => [d.cantidad, d.unidad]), [[200, 'm'], [50, 'm']]);
  assert.equal(r.texto, '250 m (200 m + 50 m)');
});

test('S-15 200 m + 5 € no es una suma numérica: composición heterogénea que conserva los operandos', async () => {
  const { eje, id } = await ejeCon(['Casa', '=200 m + 5 €']);
  const r = evaluar(eje, id, [1]);
  assert.equal(r.estado, 'RESUELTO');
  assert.equal(r.valor.tipo, 'composicion');
  assert.deepEqual(r.valor.partes.map((p) => [p.cantidad, p.unidad]), [[200, 'm'], [5, '€']]);
  assert.equal(r.texto, '200 m + 5 €');
});

test('S-16 antes de operar se validan los tipos: tipo no aplicable es INCOMPATIBLE, distinto de ERROR de sintaxis', async () => {
  const { eje, id } = await ejeCon(['Casa', 'algo']);
  const c = (f) => consultar(eje, id, [1], f);
  for (const f of ['12 EUR * 2 EUR', '"a" + 1', '1 < "a"', 'FILTRAR(BUSCAR(1), 1 + 1)', 'CONTAR(1)']) {
    const r = c(f);
    assert.equal(r.estado, 'INCOMPATIBLE', f);
    assert.ok(r.motivo, f);
  }
  assert.equal(c('1 +').estado, 'ERROR');
  assert.equal(c('(1 + 2').estado, 'ERROR');
});

test('S-17 las siete unidades de tiempo son escalas distintas: no se convierten entre sí', async () => {
  const { eje, id } = await ejeCon(['Casa']);
  const c = (f) => consultar(eje, id, [0], f);
  const r = c('1 hora + 30 minuto');
  assert.equal(r.estado, 'RESUELTO');
  assert.equal(r.valor.tipo, 'composicion'); // ni 90 minuto ni 1.5 hora
  assert.equal(r.texto, '1 hora + 30 minuto');
  assert.equal(c('1 semana + 1 segundo + 1 ciclo').texto, '1 semana + 1 segundo + 1 ciclo');
  assert.equal(c('2 hora + 1 hora').texto, '3 hora (2 hora + 1 hora)'); // la misma escala sí suma
});

test('S-17b las unidades «día» y «año» se escriben como se llaman', async () => {
  const { eje, id } = await ejeCon(['Casa', '3 días', 'año 2', '=LOCAL(1) + 2 días']);
  const c = (f) => consultar(eje, id, [0], f);
  assert.equal(c('1 día + 1 hora').texto, '1 día + 1 hora');
  assert.equal(c('1 año').valor.tipo, 'magnitud');
  assert.equal(c('2 año + 1 año').texto, '3 año (2 año + 1 año)');
  assert.equal(evaluar(eje, id, [1]).valor.unidad, 'días'); // también como literal de slot
  assert.equal(evaluar(eje, id, [2]).valor.unidad, 'año');
  assert.equal(evaluar(eje, id, [3]).texto, '5 días (3 días + 2 días)');
});

test('S-18 los resultados no son tipos excluyentes: literal, estructura, colección o composición', async () => {
  // VG, 7-11 noche: por hojas: el 0 envuelto hace de la 1 una décupla (['sub', 'x'] sería una lista).
  const { eje, id } = await ejeCon(['Casa', [['sub'], 'x'], '=LOCAL(1)', '=BUSCAR(1)', '=1 m + 1 EUR', '=1 + 1', '=LOCAL(1, 1)']);
  assert.equal(evaluar(eje, id, [2]).valor.tipo, 'array'); // estructura
  assert.equal(evaluar(eje, id, [3]).valor.tipo, 'coleccion'); // candidatos
  assert.equal(evaluar(eje, id, [4]).valor.tipo, 'composicion');
  assert.equal(evaluar(eje, id, [5]).valor.tipo, 'numero'); // literal
  assert.equal(evaluar(eje, id, [6]).valor.tipo, 'texto');
});

test('S-18b las fechas son un tipo de valor',
  { skip: 'BQL-18 (sintaxis): no existe el tipo fecha; el corpus no fija su sintaxis ([X] decidir VG)' },
  async () => {
    const { eje, id } = await ejeCon(['Casa', '2026-10-22', '=LOCAL(1)']);
    assert.equal(evaluar(eje, id, [1]).valor.tipo, 'fecha');
    assert.equal(evaluar(eje, id, [2]).valor.tipo, 'fecha');
  });

test('S-21 los marcadores #A/#T/#B de los ejemplos son simbólicos: REF no finge resolverlos', async () => {
  const { eje, id } = await ejeCon(['Casa']);
  const real = await escribe(eje, id, ['Real', 'dato']);
  const c = (f) => consultar(eje, id, [0], f);
  for (const marca of ['#A', '#T', '#B']) {
    const r = c('REF("' + marca + '")');
    assert.notEqual(r.estado, 'RESUELTO', marca);
    assert.equal(r.valor, undefined);
    assert.ok(r.motivo);
  }
  assert.equal(c('REF("' + real.id + '", "1000000000")').texto, 'dato'); // un id de verdad sí
});

test('S-23 sin árbol BQL aparte: la anidación del array fija el anfitrión y la recursividad no consume profundidad', async () => {
  const doce = 'NO('.repeat(12) + '1 < 2' + ')'.repeat(12); // doce niveles > diez dígitos
  // VG, 7-11 noche: por hojas: el 0 envuelto hace del subarray una décupla anfitriona.
  const { eje, id } = await ejeCon(['Casa', [['sub'], 'dentro', '=LOCAL(1)'], '=LOCAL(1)', '=' + doce]);
  assert.equal(evaluar(eje, id, [1, 2]).texto, 'dentro'); // anfitrión: el subarray
  assert.equal(evaluar(eje, id, [2]).valor.tipo, 'array'); // anfitrión: la raíz
  assert.equal(evaluar(eje, id, [3]).texto, 'verdadero');
});

test('S-24 las reglas cortas y las primitivas del motor no son funciones BQL', async () => {
  const { eje, id } = await ejeCon(['Casa']);
  for (const f of ['INTERPRETAR', 'RESOLVER', 'POSICIONAR', 'COMPARAR', 'CALCULAR', 'COMPONER', 'REGLA_1']) {
    const r = consultar(eje, id, [0], f + '(1)');
    assert.equal(r.estado, 'ERROR', f);
    assert.match(r.motivo, /función desconocida/);
  }
});

test('S-25 ACTUAL(pv, cantidad?) fuera de FILTRAR: cantidad máxima de candidatos, nunca profundidad; ACTUAL(2) y ACTUAL(2,1) comparten intención', async () => {
  const { c } = await escenarioIntegral();
  assert.equal(c('ACTUAL(2)').texto, c('ACTUAL(2, 1)').texto);
  const diez = c('ACTUAL(2, 10)');
  assert.equal(diez.valor.tipo, 'coleccion');
  assert.equal(diez.valor.items.length, 4); // hasta diez: los cuatro que hay
  const mil = c('ACTUAL(2, 1000)');
  assert.equal(mil.estado, 'RESUELTO'); // sin obligación de encontrar mil
  assert.equal(mil.valor.items.length, 4);
});

test('S-26 los ejemplos BQL del corpus no son declaraciones aprobadas de producto',
  { skip: 'BQL-26 (sintaxis): regla de método sobre el corpus, sin comportamiento observable que comprobar en código' },
  () => {});

// =====================================================================
// Serie O: operadores, ámbitos y colecciones
// =====================================================================

test('O-01 una expresión vive en un único slot; la anidación del array que la contiene fija su anfitrión', async () => {
  // VG, 7-11 noche: por hojas: el 0 envuelto hace del subarray una décupla anfitriona.
  const { eje, id } = await ejeCon(['Casa', [['sub'], 'valor del sub', '=LOCAL(1)'], '=LOCAL(1)']);
  assert.equal(evaluar(eje, id, [1, 2]).texto, 'valor del sub');
  assert.equal(evaluar(eje, id, [2]).valor.tipo, 'array'); // la misma fórmula en otro slot: otro anfitrión
});

test('O-02 la recursividad de una fórmula no consume dígitos BTML, pero hay límites de cálculo', async () => {
  const doce = 'NO('.repeat(12) + '1 < 2' + ')'.repeat(12);
  const enorme = Array.from({ length: 3000 }, () => '1').join(' + ');
  const { eje, id } = await ejeCon(['Casa', '=' + doce, '=' + enorme]);
  assert.equal(evaluar(eje, id, [1]).texto, 'verdadero');
  const r = evaluar(eje, id, [2]);
  assert.notEqual(r.estado, 'RESUELTO');
  assert.match(r.motivo, /presupuesto|l[ií]mite/i);
});

test('O-03 la posición del slot da el sentido a la fórmula: criterio en 2, propuesta en 4, ejecución condicionada en 7',
  { skip: 'BQL-03 (ámbito): el papel por posición no está modelado en bql.js; solo el motor distingue la fábrica (4)' },
  () => {});

test('O-04 LOCAL(n) lee la posición n (0–9) de la décupla que aloja la expresión', async () => {
  const { eje, id } = await ejeCon(['Casa', 'uno', 'dos', '=LOCAL(0)', '=LOCAL(2)', '=LOCAL(9)']);
  assert.equal(evaluar(eje, id, [3]).texto, 'Casa');
  assert.equal(evaluar(eje, id, [4]).texto, 'dos');
  assert.equal(evaluar(eje, id, [5]).estado, 'PENDIENTE'); // la 9 no está desarrollada
  assert.equal(consultar(eje, id, [1], 'LOCAL("8412300000")').estado, 'ERROR');
});

test('O-05 LOCAL mantiene el anfitrión dentro de FILTRAR/ORDENAR y en filtros anidados', async () => {
  const { c } = await escenarioIntegral();
  assert.equal(c('CONTAR(FILTRAR(' + ESCRITOS + ', ACTUAL(1) <= LOCAL(1)))').texto, '3'); // todos caben en 175
  assert.equal(c('CONTAR(FILTRAR(' + ESCRITOS + ', LOCAL(0) = "Plan de compra"))').texto, '3');
  const anidado = c('CONTAR(FILTRAR(' + ESCRITOS + ', CONTAR(FILTRAR(' + ESCRITOS + ', LOCAL(1) = 175 EUR)) = 3))');
  assert.equal(anidado.texto, '3');
  assert.equal(c('CONTAR(ORDENAR(' + ESCRITOS + ', LOCAL(1)))').texto, '3');
});

test('O-06 el anfitrión es la décupla que contiene el slot, a su profundidad, no la raíz', async () => {
  const { eje, id } = await ejeCon(['H', ['a', '3 EUR', '=LOCAL(1) + 1 EUR', '=LOCAL(0)']]);
  assert.equal(evaluar(eje, id, [1, 2]).texto, '4 EUR (3 EUR + 1 EUR)');
  assert.equal(evaluar(eje, id, [1, 3]).texto, 'a');
});

test('O-07 REF(id, dir?) lee otro elemento por id o forma referencial admitida, con subposición opcional', async () => {
  const { eje, id } = await ejeCon(['Casa']);
  // VG, 7-11 noche: por hojas: el 0 envuelto hace de la 1 una décupla, direccionable por dígitos.
  const a = await escribe(eje, id, ['A', [['cero'], 'uno', 'dos']]);
  const c = (f) => consultar(eje, id, [0], f);
  assert.equal(c('REF("' + a.id + '")').valor.tipo, 'array');
  assert.equal(c('REF("' + a.id.slice(0, 12) + '", "1100000000")').texto, 'uno'); // prefijo único
  assert.equal(c('REF("@' + a.id + '", "1200000000")').texto, 'dos'); // forma @id
  assert.equal(c('REF("' + a.id + '", "1300000000")').estado, 'PENDIENTE'); // subposición sin desarrollar
});

test('O-08 REF es una consulta de datos: no ancla ni posiciona nada', async () => {
  const { eje, id } = await ejeCon(['Casa']);
  const a = await escribe(eje, id, ['A', 'dato']);
  const lector = await escribe(eje, id, ['Lector', '=REF("' + a.id + '", "1000000000")']);
  const antes = huella(eje);
  assert.equal(evaluar(eje, lector.id, [1]).texto, 'dato');
  assert.equal(huella(eje), antes);
  assert.equal(eje.sobre(a.id).length, 0); // nada escrito sobre A
  const ocupantes = consultar(eje, a.id, [1], 'BUSCAR(1)').valor.items;
  assert.ok(ocupantes.every((o) => o.origen === 'propio')); // el lector no ocupa la posición de A
});

test('O-09 tipo imposible es INCOMPATIBLE; ciclo irresoluble es ERROR', async () => {
  const { eje, id } = await ejeCon(['Casa', '=LOCAL(0) * 2', '=LOCAL(3)', '=LOCAL(2)']);
  assert.equal(evaluar(eje, id, [1]).estado, 'INCOMPATIBLE');
  const ciclo = evaluar(eje, id, [2]);
  assert.equal(ciclo.estado, 'ERROR');
  assert.match(ciclo.motivo, /ciclo/);
});

test('O-09b una referencia a un evento que no está en el eje queda PENDIENTE, no ERROR', async () => {
  const { eje, id } = await ejeCon(['Casa', { ref: ID_INEXISTENTE, dir: '1000000000' }, '=LOCAL(1)']);
  const r = consultar(eje, id, [0], 'REF("' + ID_INEXISTENTE + '")');
  assert.equal(r.estado, 'PENDIENTE');
  assert.equal(r.valor, undefined);
  assert.equal(evaluar(eje, id, [2]).estado, 'PENDIENTE'); // también una referencia BTML a un evento que no ha llegado
  assert.equal(consultar(eje, id, [0], 'REF("' + ID_INEXISTENTE.slice(0, 8) + '")').estado, 'PENDIENTE'); // prefijo sin evento
  assert.equal(consultar(eje, id, [0], 'REF("#T")').estado, 'ERROR'); // no es un id: mal formada
});

test('O-10 una relación circular A→B y B→A es legítima; solo la evaluación circular de un valor es ERROR', async () => {
  const { eje, id } = await ejeCon(['Casa']);
  // A escribe en su 2 un criterio y B se escribe sobre A en 2 apuntando a A.1: A→B por escritura, B→A por referencia.
  const a = await escribe(eje, id, ['A', 'dato', 'criterio', '=CONTAR(FILTRAR(' + ESCRITOS + ', ACTUAL(1) = LOCAL(1)))']);
  const b = await escribe(eje, a.id, ['B', { ref: a.id, dir: '1000000000' }], '2000000000');
  assert.equal(evaluar(eje, a.id, [3]).texto, '1'); // A lee B, que lee A: navegable
  assert.equal(consultar(eje, b.id, [1], 'LOCAL(1)').texto, 'dato');
  // Dependencia circular de valores: ERROR.
  const { eje: e2, id: id2 } = await ejeCon(['Casa', '=LOCAL(2) + 1', '=LOCAL(1) + 1']);
  const r = evaluar(e2, id2, [1]);
  assert.equal(r.estado, 'ERROR');
  assert.match(r.motivo, /ciclo/);
});

test('O-11 las referencias no copian; LOCAL y REF las siguen hasta el contenido conservando la traza', async () => {
  const { eje, id } = await ejeCon(['Casa']);
  // VG, 7-11 noche: por hojas: el 0 envuelto hace de la 1 una décupla, para leer la 1.1 por dirección.
  const menu = await escribe(eje, id, ['Menú', [['ensalada'], 'guiso', 'fruta']]);
  const compra = await escribe(eje, id, ['Compra', { ref: menu.id, dir: '1000000000' }, '=LOCAL(1)', '=REF("' + menu.id + '", "1100000000")']);
  assert.deepEqual(eje.obtener(compra.id).payload[1], { ref: menu.id, dir: '1000000000' }); // sigue siendo referencia
  const porLocal = evaluar(eje, compra.id, [2]);
  assert.equal(porLocal.valor.tipo, 'array');
  assert.equal(porLocal.valor.valor.length, 3);
  assert.ok(porLocal.dependencias.includes(menu.id + ':1000000000'));
  const porRef = evaluar(eje, compra.id, [3]);
  assert.equal(porRef.texto, 'guiso');
  assert.ok(porRef.dependencias.includes(menu.id + ':1100000000'));
});

test('O-12 navegar referencias a otros eventos no consume profundidad BTML ni concatena dígitos', async () => {
  const { eje, id } = await ejeCon(['Casa']);
  // VG, 7-11 noche: por hojas: el 0 envuelto hace de cada 1 una décupla, para seguir la 1.1 por dirección.
  const a = await escribe(eje, id, ['A', [['a1'], 'fondo']]);
  const b = await escribe(eje, id, ['B', [['b1'], { ref: a.id, dir: '1100000000' }]]);
  const c3 = await escribe(eje, id, ['C', [['c1'], { ref: b.id, dir: '1100000000' }], '=LOCAL(1, 1)']);
  assert.equal(evaluar(eje, c3.id, [2]).texto, 'fondo'); // tres eventos, dos dígitos cada uno
  const d = await escribe(eje, id, ['D', ['d1', ['d11', ['d111', '=REF("' + c3.id + '", "1100000000")']]]]);
  assert.equal(evaluar(eje, d.id, [1, 1, 1, 1]).texto, 'fondo'); // desde profundidad 4 sin sumar profundidades
});

test('O-12b permisos de lectura limitan el recorrido de las referencias: PENDIENTE DE AUTORIZACIÓN', async () => {
  // El modelo de permisos es de AARPIA (mapa §12); BQL solo pregunta por cada lectura con el gancho puedeLeer(evId, dir).
  const { eje, id } = await ejeCon(['Casa']);
  const secreto = await escribe(eje, id, ['Secreto', '30 EUR']);
  const lector = await escribe(eje, id, ['Lector', '10 EUR', '=LOCAL(1) + REF("' + secreto.id + '", "1000000000")']);
  await escribe(eje, lector.id, '5 EUR', '1000000000');
  const sinSecreto = { puedeLeer: (evId) => evId !== secreto.id };
  assert.equal(evaluar(eje, lector.id, [2]).texto, '40 EUR (10 EUR + 30 EUR)'); // sin gancho, todo se lee
  const r = evaluar(eje, lector.id, [2], sinSecreto);
  assert.equal(r.estado, 'PENDIENTE DE AUTORIZACIÓN');
  assert.ok(esPendiente(r.estado)); // espera explicada, no fallo
  assert.equal(r.valor, undefined);
  assert.match(r.motivo, /autorización/);
  assert.equal(consultar(eje, lector.id, [2], 'LOCAL(1)', sinSecreto).texto, '10 EUR'); // lo propio sí
  // El gancho recibe la dirección de diez dígitos y el camino exacto de índices de cada lectura.
  const pedidas = [];
  consultar(eje, lector.id, [2], 'REF("' + secreto.id + '", "1000000000")', { puedeLeer: (e, d, i) => { pedidas.push([d, i]); return true; } });
  assert.deepEqual(pedidas, [['1000000000', [1]]]);
  // La dirección sola no distingue la raíz [] de la posición [0]; los índices sí.
  const raizOCero = [];
  const anota = { puedeLeer: (e, d, i) => { raizOCero.push([d, i]); return true; } };
  evaluar(eje, lector.id, [], anota);
  consultar(eje, lector.id, [1], 'LOCAL(0)', anota);
  assert.deepEqual(raizOCero, [['0000000000', []], ['0000000000', [0]]]);
  const sinRaiz = { puedeLeer: (e, d, i) => i.length > 0 };
  assert.equal(consultar(eje, lector.id, [1], 'LOCAL(0)', sinRaiz).texto, 'Lector');
  assert.equal(evaluar(eje, lector.id, [], sinRaiz).estado, 'PENDIENTE DE AUTORIZACIÓN');
});

test('O-12c BUSCAR pregunta al gancho por cada ocupante y por cada salto antes de exponer id, autor, t y procedencia', async () => {
  // Revisión de seguridad de la PR #36: el gancho se aplica al camino exacto de cada ocupante y a cada salto de una cadena de referencias.
  const { eje, id } = await ejeCon(['Casa']);
  const secreto = await escribe(eje, id, ['Secreto', '30 EUR']);
  const puente = await escribe(eje, id, ['Puente', { ref: secreto.id, dir: '1000000000' }]);
  // VG, 7-11 noche: por hojas: el 0 envuelto hace de la 4 una décupla, con colisión por ceros entre la 4 y la 4.0.
  const lector = await escribe(eje, id, ['Lector', '10 EUR', 'x', { ref: puente.id, dir: '1000000000' }, [['a'], 'b']]);
  const escrito = await escribe(eje, lector.id, '5 EUR', '1000000000');
  const sin = (...ids) => ({ puedeLeer: (evId) => !ids.includes(evId) });
  // Escrito ajeno no autorizado: la consulta entera queda pendiente y el motivo no nombra su id.
  const r = consultar(eje, lector.id, [1], 'CONTAR(BUSCAR(1))', sin(escrito.id));
  assert.equal(r.estado, 'PENDIENTE DE AUTORIZACIÓN');
  assert.ok(!r.motivo.includes(escrito.id.slice(0, 8)));
  assert.equal(r.valor, undefined);
  assert.equal(consultar(eje, lector.id, [1], 'CONTAR(BUSCAR(1))', sin(secreto.id)).texto, '2'); // con el escrito autorizado, sí
  assert.equal(consultar(eje, lector.id, [1], 'SUMAR(BUSCAR(1))', sin(secreto.id)).texto, '15 EUR (10 EUR + 5 EUR)');
  // Cadena de referencias: lector.3 → puente.1 → secreto.1. Cada salto pasa por el gancho, también el segundo.
  assert.equal(consultar(eje, lector.id, [3], 'CONTAR(BUSCAR(3))').texto, '2'); // sin gancho: el propio y lo alcanzado
  const pedidas = [];
  consultar(eje, lector.id, [3], 'BUSCAR(3)', { puedeLeer: (e, d, i) => { pedidas.push(e.slice(0, 8) + ':' + i.join('.')); return true; } });
  assert.deepEqual(pedidas, [lector.id.slice(0, 8) + ':3', lector.id.slice(0, 8) + ':3', puente.id.slice(0, 8) + ':1', secreto.id.slice(0, 8) + ':1']);
  assert.equal(consultar(eje, lector.id, [3], 'BUSCAR(3)', sin(secreto.id)).estado, 'PENDIENTE DE AUTORIZACIÓN');
  assert.equal(consultar(eje, lector.id, [3], 'BUSCAR(3)', sin(puente.id)).estado, 'PENDIENTE DE AUTORIZACIÓN');
  assert.equal(consultar(eje, lector.id, [3], 'LOCAL(3)', sin(puente.id)).estado, 'PENDIENTE DE AUTORIZACIÓN'); // leer sigue la misma regla
  // Colisión por ceros: cada ocupante por su camino exacto. Negar la 4.0 deja pasar BUSCAR(4) (camino exacto 4) y no la dirección entera.
  const sin40 = { puedeLeer: (e, d, i) => i.join('.') !== '4.0' };
  assert.equal(consultar(eje, lector.id, [4], 'CONTAR(BUSCAR(4))', sin40).texto, '1');
  assert.equal(consultar(eje, lector.id, [4], 'BUSCAR("4000000000")', sin40).estado, 'PENDIENTE DE AUTORIZACIÓN');
  assert.equal(consultar(eje, lector.id, [4], 'CONTAR(BUSCAR("4000000000"))').texto, '2');
  // Autorizar una posición expone su subárbol propio (el valor array lleva el subarray crudo); los escritos y las referencias se preguntan aparte.
  const solo4 = { puedeLeer: (e, d, i) => e === lector.id && i.join('.') === '4' };
  assert.deepEqual(consultar(eje, lector.id, [4], 'LOCAL(4)', solo4).valor.valor, [['a'], 'b']);
  assert.equal(consultar(eje, lector.id, [4], 'LOCAL(4, 0)', solo4).estado, 'PENDIENTE DE AUTORIZACIÓN');
});

test('O-13 dentro de FILTRAR el segundo parámetro de ACTUAL sigue siendo cantidad, nunca profundidad', async () => {
  const { c } = await escenarioIntegral();
  assert.equal(c('CONTAR(FILTRAR(' + ESCRITOS + ', ACTUAL(1) = ACTUAL(1, 1)))').texto, '3');
  const r = c('FILTRAR(' + ESCRITOS + ', CONTAR(ACTUAL(1, 1000)) >= 0)');
  assert.doesNotMatch(r.motivo ?? '', /índices/);
  // Cantidad > 1 en un ámbito de un solo candidato está abierta en el corpus (O-17, E-23): no se inventa, queda PENDIENTE.
  assert.equal(r.estado, 'PENDIENTE');
  assert.equal(c('FILTRAR(' + ESCRITOS + ', ACTUAL(1, 0) = 1)').estado, 'ERROR'); // cantidad 0 no es una cantidad
});

test('O-14 dentro de FILTRAR, ACTUAL se rebasa con el candidato examinado y se restituye al terminar', async () => {
  const { c, nombre, REF_T } = await escenarioIntegral();
  // El ejemplo integral con la sintaxis vigente: candidato + transporte ≤ presupuesto del anfitrión.
  const r = c('FILTRAR(' + ESCRITOS + ', ACTUAL(1) + ' + REF_T + ' <= LOCAL(1))');
  assert.equal(r.estado, 'RESUELTO');
  assert.deepEqual(r.valor.items.map(nombre), ['A', 'B']); // 140 y 160 caben; 190 no
  // Tras el FILTRAR no queda candidato activo: ORIGEN() ya no puede leer uno.
  const despues = c('Y(CONTAR(FILTRAR(' + ESCRITOS + ', ACTUAL(1) <= LOCAL(1))) = 3, ORIGEN() = "escrito")');
  assert.notEqual(despues.estado, 'RESUELTO');
});

test('O-15 fuera de iteración y sin ámbito activo, ACTUAL no inventa un origen: queda PENDIENTE', async () => {
  const { eje, id } = await ejeCon(['Casa']);
  const r = consultar(eje, id, [0], 'ACTUAL()');
  assert.equal(r.estado, 'PENDIENTE');
  assert.equal(r.valor, undefined);
  assert.match(r.motivo, /ámbito/);
});

test('O-16 la colección que devuelve BUSCAR es el ámbito de ACTUAL', async () => {
  const { c } = await escenarioIntegral();
  const buscar = c('BUSCAR(2)').valor.items;
  assert.equal(c('CONTAR(FILTRAR(BUSCAR(2), ORIGEN() = "escrito"))').texto, String(buscar.filter((i) => i.origen === 'escrito').length));
  assert.equal(c('CONTAR(FILTRAR(BUSCAR(2), ORIGEN() = "propio"))').texto, String(buscar.filter((i) => i.origen === 'propio').length));
  assert.equal(buscar[0].origen, 'propio');
  assert.equal(c('ACTUAL(2)').texto, 'criterio'); // el primero de la colección de BUSCAR(2)
});

test('O-18 BUSCAR devuelve los candidatos de la posición, con procedencia y vector, y no registra ganador', async () => {
  const { eje, c, A, B, C } = await escenarioIntegral();
  const antes = huella(eje);
  const r = c('BUSCAR(2)');
  assert.equal(r.estado, 'RESUELTO');
  assert.equal(r.valor.tipo, 'coleccion');
  assert.deepEqual(r.valor.items.filter((i) => i.origen === 'escrito').map((i) => i.evento), [A.id, B.id, C.id]);
  for (const item of r.valor.items) {
    assert.ok(Array.isArray(item.procedencia) && item.procedencia.length > 0);
    assert.equal(item.vector.length, 10);
    assert.ok(['exacto', 'completar', 'reducir', 'mixto'].includes(item.signo));
  }
  assert.equal(huella(eje), antes);
  assert.equal(c('BUSCAR(7)').texto, '0 candidatos');
});

test('O-19 BUSCAR(LOCAL(5)): la dirección guardada en la posición 5 («dónde encaja lo que busco»)', async () => {
  const { c, nombre, REF_T, A, B, C } = await escenarioIntegral();
  assert.equal(c('LOCAL(5)').valor.tipo, 'texto'); // un texto de diez dígitos en un slot es una dirección, no un número
  const r = c('BUSCAR(LOCAL(5))');
  assert.equal(r.estado, 'RESUELTO');
  assert.deepEqual(r.valor.items.filter((i) => i.origen === 'escrito').map((i) => i.evento), [A.id, B.id, C.id]);
  // El ejemplo integral del corpus con su BUSCAR(LOCAL(5)): quedan A y B, C fuera.
  const integral = c('FILTRAR(FILTRAR(BUSCAR(LOCAL(5)), ORIGEN() = "escrito"), ACTUAL(1) + ' + REF_T + ' <= LOCAL(1))');
  assert.deepEqual(integral.valor.items.map(nombre), ['A', 'B']);
});

test('O-20 las colisiones se conservan: propio, alcanzado por referencia, escritos y colisiones por ceros, con su camino', async () => {
  const { eje, id, plan, x, h1, h2, c } = await escenarioEncaje();
  const r = c('BUSCAR(2)').valor.items;
  assert.deepEqual(r.map((i) => i.origen).sort(), ['escrito', 'escrito', 'propio', 'referencia']);
  assert.deepEqual(r.filter((i) => i.origen === 'escrito').map((i) => i.evento), [h1.id, h2.id]);
  assert.equal(r.find((i) => i.origen === 'referencia').evento, plan.id);
  assert.ok(r.every((i) => i.procedencia.length > 0 && Array.isArray(i.indices)));
  // Colisión por ceros: la posición 1 y la 1.0 son dos ocupantes, no uno. La dirección nombra la colisión entera.
  // VG, 7-11 noche: por hojas: para que la 1 sea una décupla (con 1.0) se envuelve su 0; la 1.0 es la lista ['p'].
  const y = await escribe(eje, id, ['Y', [['p'], 'q']]);
  const ceros = consultar(eje, y.id, [1], 'BUSCAR("1000000000")').valor.items;
  assert.deepEqual(ceros.map((i) => [i.indices, i.lista]), [[[1], undefined], [[1, 0], 0]]); // la décupla y el elemento de la 1.0
  assert.ok(ceros.every((i) => i.origen === 'propio'));
  // El índice es camino exacto (mapa §12 [D], VG 7-11): 1 es la 1, sin la 1.0.
  assert.deepEqual(consultar(eje, y.id, [1], 'BUSCAR(1)').valor.items.map((i) => i.indices), [[1]]);
  // BUSCAR(1, 0) es el ocupante 0 de la lista de la 1 por llegada: la décupla, uno solo; no es la 1.0, que se
  // lee por dígito con LOCAL(1, 0) (la lista de uno) y su elemento por índice con LOCAL(1, 0, 0).
  assert.deepEqual(consultar(eje, y.id, [1], 'BUSCAR(1, 0)').valor.items.map((i) => i.indices), [[1]]);
  assert.equal(consultar(eje, y.id, [1], 'BUSCAR(1, 1)').texto, '0 candidatos');
  const lista10 = consultar(eje, y.id, [1], 'LOCAL(1, 0)');
  assert.deepEqual([lista10.valor.tipo, lista10.texto], ['lista', 'p']); // una lista se escribe con sus elementos
  assert.equal(consultar(eje, y.id, [1], 'LOCAL(1, 0, 0)').texto, 'p');
  assert.equal(consultar(eje, id, [0], 'REF("' + y.id + '", "1100000000")').texto, 'q'); // por dirección, la décupla
  // Una lista no es una décupla: un ocupante por elemento, sin colisión por ceros (la dirección no entra en ella).
  const z = await escribe(eje, id, ['Z', ['p', 'q']]);
  const enLista = consultar(eje, z.id, [1], 'BUSCAR("1000000000")').valor.items;
  assert.deepEqual(enLista.map((i) => [i.origen, i.indices, i.lista]), [['propio', [1], 0], ['propio', [1], 1]]);
  assert.deepEqual(consultar(eje, z.id, [1], 'BUSCAR(1)').valor.items.map((i) => i.lista), [0, 1]);
  // Lo escrito en la 1 va detrás de la lista, por llegada: BUSCAR(1, 2) es el escrito.
  const zEscrito = await escribe(eje, z.id, 'r', '1000000000');
  assert.deepEqual(consultar(eje, z.id, [1], 'BUSCAR(1, 1)').valor.items.map((i) => i.lista), [1]);
  assert.deepEqual(consultar(eje, z.id, [1], 'BUSCAR(1, 2)').valor.items.map((i) => i.evento), [zEscrito.id]);
  assert.equal(consultar(eje, z.id, [1], 'BUSCAR(1, 3)').texto, '0 candidatos');
  assert.equal(consultar(eje, z.id, [1], 'LOCAL(1, 1)').texto, 'q'); // por índice, LOCAL entra en la lista
  const porDir = consultar(eje, id, [0], 'REF("' + z.id + '", "1100000000")'); // por dirección, no
  assert.equal(porDir.estado, 'PENDIENTE');
  assert.match(porDir.motivo, /cae dentro de la lista de la 1/);
  void x;
});

test('O-21 orden por encaje: coincidencias de ruta (acuerdo de prefijo), luego llegada; signo y distancia son información', async () => {
  // MAPA §12 [D] opción B (VG, 7-11 tarde): ni signo ni distancia ordenan hasta que una época haga ordinal una profundidad.
  const { h1, h2, c } = await escenarioEncaje();
  const r = c('BUSCAR(2)').valor.items;
  assert.deepEqual(r.map((i) => i.origen), ['propio', 'escrito', 'escrito', 'referencia']);
  assert.equal(r[0].signo, 'exacto');
  assert.deepEqual([r[1].signo, r[2].signo], ['exacto', 'exacto']); // escritos anclados en la dirección buscada: encaje exacto
  assert.deepEqual([r[1].evento, r[2].evento], [h1.id, h2.id]); // empate: llegada
  assert.equal(r[3].acuerdo, 0); // la referencia alcanza 3 colocada en 2: no coincide en la profundidad 0
  assert.equal(r[3].signo, 'reducir'); // candidato − buscado = +1: le sobra; es información, no orden
  assert.equal(r[3].distancia[0], 1);
});

test('O-22 un terminal no tiene posición 0 (PENDIENTE); ORIGEN() distingue la procedencia del candidato', async () => {
  const { eje, id } = await ejeCon(['Casa', 'terminal', '=LOCAL(1, 0)']);
  assert.equal(evaluar(eje, id, [2]).estado, 'PENDIENTE');
  await escribe(eje, id, 'escrito', '1000000000');
  const c = (f) => consultar(eje, id, [1], f);
  assert.equal(c('CONTAR(FILTRAR(BUSCAR(1), ORIGEN() = "escrito"))').texto, '1');
  assert.equal(c('CONTAR(FILTRAR(BUSCAR(1), ORIGEN() = "propio"))').texto, '1');
  assert.equal(c('CONTAR(FILTRAR(BUSCAR(1), ACTUAL(0) = "x"))').estado, 'PENDIENTE');
});

test('O-24 FILTRAR(coleccion, predicado) evalúa el predicado por candidato y devuelve la subcolección; el predicado debe ser booleano', async () => {
  const { c, nombre } = await escenarioIntegral();
  assert.deepEqual(c('FILTRAR(' + ESCRITOS + ', ACTUAL(1) <= 140 EUR)').valor.items.map(nombre), ['A', 'B']);
  assert.equal(c('FILTRAR(' + ESCRITOS + ', 1 > 2)').texto, '0 candidatos');
  assert.equal(c('FILTRAR(' + ESCRITOS + ', ACTUAL(1))').estado, 'INCOMPATIBLE'); // una magnitud no es un predicado
  assert.equal(c('FILTRAR(1, 1 < 2)').estado, 'INCOMPATIBLE'); // un número no es una colección
});

test('O-25 un dato faltante en FILTRAR no se convierte en falso: ningún candidato se descarta en silencio', async () => {
  const { c } = await escenarioIntegral();
  // BUSCAR(2) incluye el propio «criterio» (terminal, sin posición 1): la consulta queda PENDIENTE.
  const r = c('FILTRAR(BUSCAR(2), ACTUAL(1) <= LOCAL(1))');
  assert.equal(r.estado, 'PENDIENTE');
  assert.equal(r.valor, undefined); // no hay una colección RESUELTA con el terminal fuera
  assert.equal(c('CONTAR(FILTRAR(BUSCAR(2), ACTUAL(1) <= LOCAL(1)))').estado, 'PENDIENTE');
});

test('O-26 un fallo de evaluación no borra alternativas y PENDIENTE, INCOMPATIBLE y ERROR se distinguen', async () => {
  const { eje, c } = await escenarioIntegral();
  const antes = huella(eje);
  assert.equal(c('FILTRAR(BUSCAR(2), ACTUAL(1) <= LOCAL(1))').estado, 'PENDIENTE');
  assert.equal(c('FILTRAR(' + ESCRITOS + ', ACTUAL(1) <= LOCAL(0))').estado, 'INCOMPATIBLE');
  assert.equal(c('FILTRAR(' + ESCRITOS + ', ACTUAL(1) <= )').estado, 'ERROR');
  assert.equal(c('CONTAR(BUSCAR(2))').texto, '4'); // las alternativas siguen ahí
  assert.equal(huella(eje), antes);
});

test('O-27 las consultas son puras: BUSCAR, FILTRAR, REF, ELEGIR y evaluar una fórmula no producen efectos', async () => {
  const { eje, plan, c, REF_T } = await escenarioIntegral();
  const condicionada = await escribe(eje, plan.id, ['Si', 'a', 'b', 'c', 'd', 'e', 'f', '=ELEGIR(ORDENAR(' + ESCRITOS + ', ACTUAL(1)))']);
  const antes = huella(eje);
  c('BUSCAR(2)');
  c('FILTRAR(' + ESCRITOS + ', ACTUAL(1) + ' + REF_T + ' <= LOCAL(1))');
  c(REF_T);
  c('ELEGIR(ORDENAR(' + ESCRITOS + ', ACTUAL(1), "desc"), 2)');
  assert.equal(evaluar(eje, condicionada.id, [7]).estado, 'RESUELTO');
  assert.equal(huella(eje), antes);
  assert.deepEqual(consolidaciones(eje, plan.id), []);
});

test('O-28 ORDENAR ordena por un criterio evaluado en cada candidato, puede discrepar del encaje y es estable', async () => {
  const { c, nombre } = await escenarioIntegral();
  assert.deepEqual(c(ESCRITOS).valor.items.map(nombre), ['A', 'B', 'C']); // orden por encaje: llegada
  assert.deepEqual(c('ORDENAR(' + ESCRITOS + ', ACTUAL(1), "desc")').valor.items.map(nombre), ['C', 'B', 'A']);
  assert.deepEqual(c('ORDENAR(' + ESCRITOS + ', ACTUAL(1))').valor.items.map(nombre), ['A', 'B', 'C']);
  assert.deepEqual(c('ORDENAR(' + ESCRITOS + ', 1)').valor.items.map(nombre), ['A', 'B', 'C']); // empate total: estable
});

test('O-29 una operación o comparación entre tipos o unidades que no se corresponden es INCOMPATIBLE', async () => {
  const { eje, id } = await ejeCon(['Casa']);
  const c = (f) => consultar(eje, id, [0], f);
  for (const f of ['2 kg * 3 kg', '1 EUR < 1 min', '1 EUR + "a"', '1 EUR > 1', 'Y(1, 2)']) {
    assert.equal(c(f).estado, 'INCOMPATIBLE', f);
  }
});

test('O-29b la igualdad entre unidades distintas y el orden sobre claves de tipos mezclados también son INCOMPATIBLE', async () => {
  const { c } = await escenarioEncaje();
  for (const f of ['1 EUR = 1 min', '1 EUR <> 1 min', '1 = "1"', '12 EUR = "12 EUR"']) assert.equal(c(f).estado, 'INCOMPATIBLE', f);
  assert.equal(c('1 EUR = 1 EUR').texto, 'verdadero'); // misma unidad sí
  const integral = await escenarioIntegral();
  assert.equal(integral.c('ORDENAR(BUSCAR(2), ACTUAL())').estado, 'INCOMPATIBLE'); // texto («criterio») y arrays (A, B, C) como claves
  const { eje, id } = await ejeCon(['Casa', 'mezcla']);
  await escribe(eje, id, '2 EUR', '1000000000');
  await escribe(eje, id, '5 min', '1000000000');
  const r = consultar(eje, id, [1], 'ORDENAR(FILTRAR(BUSCAR(1), ORIGEN() = "escrito"), ACTUAL())');
  assert.equal(r.estado, 'INCOMPATIBLE'); // magnitudes de unidades distintas tampoco se ordenan juntas
  assert.match(r.motivo, /EUR.*min/);
});

test('O-30 ELEGIR deja una propuesta como valor: no publica ni consolida', async () => {
  const { eje, plan, c, nombre } = await escenarioIntegral();
  const antes = huella(eje);
  const uno = c('ELEGIR(ORDENAR(' + ESCRITOS + ', ACTUAL(1)))');
  assert.deepEqual(uno.valor.items.map(nombre), ['A']);
  assert.deepEqual(c('ELEGIR(ORDENAR(' + ESCRITOS + ', ACTUAL(1)), 2)').valor.items.map(nombre), ['A', 'B']);
  assert.equal(huella(eje), antes);
  assert.deepEqual(consolidaciones(eje, plan.id), []);
});

test('O-32 colecciones: los candidatos conservan identidad, orden y referencias; su valor se lee bajo demanda', async () => {
  const { eje, id } = await ejeCon(['Casa', 'a', 'b']);
  const roto = await escribe(eje, id, ['Roto', '=1 +'], '2000000000');
  const c = (f) => consultar(eje, id, [2], f);
  const r = c('BUSCAR(2)');
  assert.equal(r.estado, 'RESUELTO'); // la fórmula rota no se ha leído
  assert.equal(c('CONTAR(BUSCAR(2))').texto, '2');
  const item = r.valor.items.find((i) => i.evento === roto.id);
  assert.ok(item && Array.isArray(item.indices) && item.procedencia.length > 0);
  assert.equal(c('CONTAR(FILTRAR(' + ESCRITOS + ', ACTUAL(1) = 1))').estado, 'ERROR'); // solo al pedir su valor
});

test('O-32b colecciones grandes: lotes, continuaciones y snapshot de reglas',
  { skip: 'BQL-32 (ámbito): sin API de lotes/continuaciones ni snapshot de reglas; el corpus no fija su forma' },
  () => {});

test('O-34 la composición heterogénea conserva los operandos', async () => {
  const { eje, id } = await ejeCon(['Casa', '200 m', '5 EUR', '=LOCAL(1) + LOCAL(2)']);
  const r = evaluar(eje, id, [3]);
  assert.equal(r.estado, 'RESUELTO');
  assert.equal(r.valor.tipo, 'composicion');
  assert.deepEqual(r.valor.partes.map((p) => [p.cantidad, p.unidad]), [[200, 'm'], [5, 'EUR']]);
  assert.equal(r.texto, '200 m + 5 EUR');
});

test('O-34b la composición conserva la procedencia de sus operandos: los slots leídos quedan en las dependencias', async () => {
  const { eje, id } = await ejeCon(['Casa', '200 m', '5 EUR', '=LOCAL(1) + LOCAL(2)']);
  const r = evaluar(eje, id, [3]);
  assert.ok(r.dependencias.includes(id + ':1000000000'));
  assert.ok(r.dependencias.includes(id + ':2000000000'));
});

test('O-35 la suma de importes homogéneos devuelve un escalar con desglose: 200 m + 50 m = 250 m', async () => {
  const { eje, id } = await ejeCon(['Casa', '=200 m + 50 m', '=12 EUR + 2 EUR']);
  const r = evaluar(eje, id, [1]);
  assert.equal(r.valor.tipo, 'magnitud');
  assert.equal(r.valor.cantidad, 250);
  assert.equal(r.texto, '250 m (200 m + 50 m)');
  assert.equal(evaluar(eje, id, [2]).texto, '14 EUR (12 EUR + 2 EUR)');
});

// =====================================================================
// Serie E: estados y evaluación segura
// =====================================================================

test('E-01 toda evaluación termina en RESUELTO, PENDIENTE, INCOMPATIBLE o ERROR', async () => {
  assert.deepEqual([...ESTADOS], ['RESUELTO', 'PENDIENTE', 'INCOMPATIBLE', 'ERROR']);
  const { eje, id } = await ejeCon(['Casa', '=1 + 1', '=LOCAL(9)', '=LOCAL(0) + 1', '=1 +', '=HOLA()', '=BUSCAR(1)']);
  for (let i = 1; i <= 6; i++) {
    const r = evaluar(eje, id, [i]);
    assert.ok(ESTADOS.includes(r.estado), 'slot ' + i + ': ' + r.estado);
  }
  assert.ok(ESTADOS.includes(consultar(eje, id, [1], 'ACTUAL()').estado));
});

test('E-02 RESUELTO significa evaluación suficiente: un cálculo global examina todos los candidatos', async () => {
  const { c, nombre } = await escenarioIntegral();
  assert.equal(c('CONTAR(BUSCAR(2))').texto, '4');
  assert.equal(c('CONTAR(FILTRAR(' + ESCRITOS + ', ACTUAL(1) >= 100 EUR))').texto, '3'); // los tres, no los primeros
  assert.deepEqual(c('FILTRAR(' + ESCRITOS + ', ACTUAL(1) >= 170 EUR)').valor.items.map(nombre), ['C']); // también el último
});

test('E-03 PENDIENTE cuando falta un dato o un contexto: espera explicada, no dato inventado', async () => {
  const { eje, id } = await ejeCon(['Casa', 'terminal', '=LOCAL(9)', '=LOCAL(1, 0)', '=ACTUAL(7)']);
  for (const i of [2, 3, 4]) {
    const r = evaluar(eje, id, [i]);
    assert.equal(r.estado, 'PENDIENTE', 'slot ' + i);
    assert.ok(r.motivo.length > 0);
    assert.equal(r.valor, undefined);
  }
});

test('E-04 INCOMPATIBLE cuando el tipo o la regla no son aplicables, antes de operar', async () => {
  const { eje, id } = await ejeCon(['Casa', 'texto', '=LOCAL(1) + 1', '=NO(1)', '=-"a"', '=FILTRAR(BUSCAR(1), 1 + 1)', '=CONTAR(1)']);
  for (let i = 2; i <= 6; i++) assert.equal(evaluar(eje, id, [i]).estado, 'INCOMPATIBLE', 'slot ' + i);
});

test('E-05 una referencia ausente (REF a un evento que no está en el eje) produce PENDIENTE, no ERROR', async () => {
  const { eje, id } = await ejeCon(['Casa', '=REF("' + ID_INEXISTENTE + '", "1000000000")']);
  const r = evaluar(eje, id, [1]);
  assert.equal(r.estado, 'PENDIENTE');
  assert.equal(r.valor, undefined);
  assert.ok(r.motivo.length > 0);
});

test('E-06 ERROR se reserva a sintaxis inválida, ciclo sin resolución y fallo grave (función desconocida)', async () => {
  const { eje, id } = await ejeCon(['Casa', '=1 +', '=HOLA(1)', '=LOCAL(4)', '=LOCAL(3)', '=(1 + 2', '=1 2']);
  for (const [i, motivo] of [[1, /incompleta/], [2, /función desconocida/], [3, /ciclo/], [5, /esperaba/], [6, /sobra/]]) {
    const r = evaluar(eje, id, [i]);
    assert.equal(r.estado, 'ERROR', 'slot ' + i);
    assert.match(r.motivo, motivo);
  }
});

test('E-07 relación circular navegable; dependencia circular de valores (también a través de BUSCAR y REF) es ERROR', async () => {
  const { eje, id } = await ejeCon(['Casa']);
  // El plan cuenta, en su 2, los escritos en 1 cuyo PV1 valga 1; el escrito lee el 2 del plan por REF: ciclo.
  const plan = await escribe(eje, id, ['Plan', 'a', '=CONTAR(FILTRAR(FILTRAR(BUSCAR(1), ORIGEN() = "escrito"), ACTUAL(1) = 1))']);
  await escribe(eje, plan.id, ['D', '=REF("' + plan.id + '", "2000000000")'], '1000000000');
  const r = evaluar(eje, plan.id, [2]);
  assert.equal(r.estado, 'ERROR');
  assert.match(r.motivo, /ciclo/);
  // Sin fórmulas, la misma estructura (plan→D por escritura, D→plan por referencia) se navega.
  const plan2 = await escribe(eje, id, ['Plan2', 'a', 'b']);
  await escribe(eje, plan2.id, ['D2', { ref: plan2.id, dir: '2000000000' }], '1000000000');
  assert.equal(consultar(eje, plan2.id, [1], 'CONTAR(FILTRAR(FILTRAR(BUSCAR(1), ORIGEN() = "escrito"), ACTUAL(1) = "b"))').texto, '1');
});

test('E-08 PENDIENTE DE AUTORIZACIÓN es un estado operativo de la consolidación, no un estado de cálculo', async () => {
  const { eje, id } = await ejeCon(['Casa']);
  const plan = await escribe(eje, id, ['Plan', 'a', '=1 + 1']);
  assert.ok(!ESTADOS.includes('PENDIENTE DE AUTORIZACIÓN'));
  assert.equal(evaluar(eje, plan.id, [2]).estado, 'RESUELTO'); // la fórmula no sabe de autorizaciones
  const cons = await consolidar(eje, { autor: 'raiz', foco: plan.id, t: T0, elecciones: { 1: 'propuesta' } });
  assert.equal(estadoDe(eje, cons.id), 'PENDIENTE DE AUTORIZACIÓN');
  assert.equal(evaluar(eje, plan.id, [2]).estado, 'RESUELTO'); // y sigue sin saberlo
});

test('E-10 un dato faltante en la condición de FILTRAR (o en Y/O/NO) no se convierte en falso', async () => {
  const { eje, id, c } = await escenarioIntegral();
  assert.equal(c('FILTRAR(BUSCAR(2), ACTUAL(1) <= LOCAL(1))').estado, 'PENDIENTE');
  const { eje: e2, id: id2 } = await ejeCon(['Casa', '=Y(1 < 2, LOCAL(9) = 1)', '=NO(LOCAL(9) = 1)', '=O(1 > 2, LOCAL(9) = 1)']);
  for (const i of [1, 2, 3]) {
    const r = evaluar(e2, id2, [i]);
    assert.equal(r.estado, 'PENDIENTE', 'slot ' + i);
    assert.notEqual(r.texto, 'falso');
  }
  void eje; void id;
});

test('E-11 no se presenta como completo lo que no se examinó entero; parciales no silenciosos y orden estable', async () => {
  const { c, nombre } = await escenarioIntegral();
  assert.deepEqual(c('ORDENAR(' + ESCRITOS + ', ACTUAL(1), "desc")').valor.items.map(nombre), ['C', 'B', 'A']); // examinó los tres
  assert.deepEqual(c('ORDENAR(' + ESCRITOS + ', 1)').valor.items.map(nombre), ['A', 'B', 'C']); // estable
  assert.equal(c('CONTAR(FILTRAR(' + ESCRITOS + ', ACTUAL(1) >= 100 EUR))').texto, '3');
});

test('E-12 colecciones grandes: ACTUAL(pv, 1000) no obliga a encontrar mil; los candidatos conservan identidad y referencias', async () => {
  const { c, A } = await escenarioIntegral();
  const r = c('ACTUAL(2, 1000)');
  assert.equal(r.estado, 'RESUELTO');
  assert.equal(r.valor.items.length, 4);
  const a = r.valor.items.find((i) => i.evento === A.id);
  assert.ok(a && Array.isArray(a.indices) && a.procedencia.length > 0);
});

test('E-12b colecciones grandes: lotes y continuaciones',
  { skip: 'BQL-12 (estados): sin lotes ni continuaciones; ACTUAL(pv, n) recorta la colección ya calculada (ver también O-32b)' },
  () => {});

test('E-13 la anidación no consume dígitos BTML, pero la evaluación tiene límites de cálculo', async () => {
  const enorme = '=' + Array.from({ length: 3000 }, () => '1').join(' + ');
  const { eje, id } = await ejeCon(['Casa', enorme, '=LOCAL(1) + 1', 'a']);
  assert.notEqual(evaluar(eje, id, [1]).estado, 'RESUELTO');
  assert.notEqual(evaluar(eje, id, [2]).estado, 'RESUELTO'); // el límite alcanza a lo leído por LOCAL
  const anidado = 'CONTAR(FILTRAR(FILTRAR(FILTRAR(BUSCAR(3), ORIGEN() = "propio"), 1 < 2), 2 < 3))';
  assert.equal(consultar(eje, id, [3], anidado).texto, '1');
});

test('O-33/E-09 agotar un límite de cálculo es PENDIENTE POR LÍMITE, con lo examinado señalado; no es ERROR', async () => {
  assert.deepEqual([...SUBTIPOS_PENDIENTE], ['PENDIENTE DE AUTORIZACIÓN', 'PENDIENTE POR LÍMITE']);
  assert.ok(SUBTIPOS_PENDIENTE.every(esPendiente));
  assert.equal(LIMITES.presupuesto, 2000);
  // Presupuesto.
  const enorme = '=' + Array.from({ length: 3000 }, () => '1').join(' + ');
  const { eje, id } = await ejeCon(['Casa', enorme, '=' + 'NO('.repeat(150) + '1 < 2' + ')'.repeat(150), '=' + 'NO('.repeat(20000) + '1 < 2' + ')'.repeat(20000)]);
  const p = evaluar(eje, id, [1]);
  assert.equal(p.estado, 'PENDIENTE POR LÍMITE');
  assert.match(p.motivo, /presupuesto/);
  assert.equal(p.valor, undefined);
  assert.equal(evaluar(eje, id, [1], { limites: { presupuesto: 10000 } }).texto, '3000'); // con más presupuesto, se resuelve
  // Profundidad de la fórmula: no revienta la pila, para.
  assert.equal(evaluar(eje, id, [2]).estado, 'PENDIENTE POR LÍMITE');
  assert.equal(evaluar(eje, id, [2], { limites: { profundidad: 200 } }).texto, 'verdadero');
  assert.equal(evaluar(eje, id, [3]).estado, 'PENDIENTE POR LÍMITE');
  // Profundidad de lecturas encadenadas (referencias que siguen referencias).
  let anterior = await escribe(eje, id, ['Fondo', 'tesoro']);
  for (let k = 0; k < 5; k++) anterior = await escribe(eje, id, ['Salto ' + k, { ref: anterior.id, dir: '1000000000' }]);
  const cadena = consultar(eje, id, [0], 'REF("' + anterior.id + '", "1000000000")', { limites: { profundidad: 3 } });
  assert.equal(cadena.estado, 'PENDIENTE POR LÍMITE');
  assert.equal(consultar(eje, id, [0], 'REF("' + anterior.id + '", "1000000000")').texto, 'tesoro');
  // Candidatos: no se presenta como completo lo que no se examinó entero.
  const integral = await escenarioIntegral();
  const { c } = integral;
  const conLimites = (f, limites) => consultar(integral.eje, integral.plan.id, [2], f, { limites });
  const cortados = conLimites('CONTAR(BUSCAR(2))', { candidatos: 2 });
  assert.equal(cortados.estado, 'PENDIENTE POR LÍMITE');
  assert.deepEqual(cortados.parcial, { examinados: 2, de: 4 });
  assert.equal(c('CONTAR(BUSCAR(2))').texto, '4');
  // Dentro de FILTRAR, la parada dice cuántos candidatos se examinaron: se prueba cada corte del presupuesto.
  const formula = 'FILTRAR(' + ESCRITOS + ', ACTUAL(1) <= LOCAL(1))';
  const parciales = [];
  for (let presupuesto = 1; presupuesto <= 60; presupuesto++) {
    const r = conLimites(formula, { presupuesto });
    if (r.estado === 'RESUELTO') break;
    assert.equal(r.estado, 'PENDIENTE POR LÍMITE');
    if (r.parcial) parciales.push(r.parcial);
  }
  assert.ok(parciales.some((p) => p.de === 3 && p.examinados > 0 && p.examinados < 3));
  assert.deepEqual([...ESTADOS], ['RESUELTO', 'PENDIENTE', 'INCOMPATIBLE', 'ERROR']); // los estados de cálculo siguen siendo cuatro
});

test('E-14 la evaluación se hace sobre una foto estable del eje (snapshot), reproducible mientras se calcula',
  { skip: 'BQL-14 (estados): no hay caché ni snapshot; sin API para fijar una foto del eje al consultar' },
  () => {});

test('E-15 las consultas son puras: ningún operador ni la evaluación de un slot registran nada', async () => {
  const { eje, plan, c, REF_T } = await escenarioIntegral();
  const lector = await escribe(eje, plan.id, ['Lector', '=ELEGIR(ORDENAR(' + ESCRITOS + ', ACTUAL(1)))', '=' + REF_T, '=BUSCAR(1)']);
  const antes = huella(eje);
  const eventosAntes = JSON.stringify([...eje.eventos.values()]);
  for (const f of ['BUSCAR(2)', 'FILTRAR(' + ESCRITOS + ', ACTUAL(1) <= LOCAL(1))', REF_T, 'ACTUAL(2, 2)', 'SUMAR(' + ESCRITOS + ')']) c(f);
  for (const i of [1, 2, 3]) evaluar(eje, lector.id, [i]);
  assert.equal(huella(eje), antes);
  assert.equal(JSON.stringify([...eje.eventos.values()]), eventosAntes);
});

test('E-16 ELEGIR selecciona y deja la propuesta como valor; convertirla en registro es otro acto', async () => {
  const { eje, plan, c, A } = await escenarioIntegral();
  const antes = eje.orden.length;
  const r = c('ELEGIR(ORDENAR(' + ESCRITOS + ', ACTUAL(1)))');
  assert.equal(r.valor.tipo, 'coleccion');
  assert.equal(r.valor.items[0].evento, A.id);
  assert.equal(eje.orden.length, antes);
  assert.deepEqual(consolidaciones(eje, plan.id), []);
});

test('E-17 evaluar una cadena «=» no ejecuta nada, tampoco en la posición 7', async () => {
  const { eje, plan, c } = await escenarioIntegral();
  const futuro = await escribe(eje, plan.id, ['Si llega', 'a', 'b', 'c', 'd', 'e', 'f', '=ELEGIR(' + ESCRITOS + ')']);
  const antes = huella(eje);
  const r = evaluar(eje, futuro.id, [7]);
  assert.equal(r.estado, 'RESUELTO');
  assert.equal(huella(eje), antes);
  assert.deepEqual(consolidaciones(eje, plan.id), []);
  assert.equal(c('CONTAR(BUSCAR(7))').texto, '0');
});

test('E-18 un fallo no borra alternativas ni hace pasar un PENDIENTE por INCOMPATIBLE', async () => {
  const { eje, id } = await ejeCon(['Casa', 'texto', '=LOCAL(9)', '=1 EUR + LOCAL(2)', '=LOCAL(1) + 1 EUR', '=NO(LOCAL(2) = 1)']);
  assert.equal(evaluar(eje, id, [3]).estado, 'PENDIENTE'); // pendiente + magnitud sigue pendiente
  assert.equal(evaluar(eje, id, [4]).estado, 'INCOMPATIBLE'); // texto + magnitud
  assert.equal(evaluar(eje, id, [5]).estado, 'PENDIENTE');
  await escribe(eje, id, 'alternativa', '2000000000');
  assert.equal(consultar(eje, id, [2], 'CONTAR(BUSCAR(2))').texto, '2'); // la fórmula pendiente y lo escrito
});

test('E-20 ACTUAL sin ámbito activo no inventa un origen y queda PENDIENTE', async () => {
  const { eje, id } = await ejeCon(['Casa', '=ACTUAL()']);
  const r = evaluar(eje, id, [1]);
  assert.equal(r.estado, 'PENDIENTE');
  assert.equal(r.valor, undefined);
});

test('E-21 un terminal no tiene posición 0: leer una subposición de un terminal da PENDIENTE', async () => {
  const { eje, id } = await ejeCon(['Casa', 'terminal', '=LOCAL(1, 0)', '=LOCAL(1, 3)']);
  assert.equal(evaluar(eje, id, [2]).estado, 'PENDIENTE');
  assert.equal(evaluar(eje, id, [3]).estado, 'PENDIENTE');
  const otro = await escribe(eje, id, ['Otro', '=REF("' + id + '", "1100000000")']);
  assert.equal(evaluar(eje, otro.id, [1]).estado, 'PENDIENTE');
  await escribe(eje, id, 'escrito terminal', '1000000000');
  assert.equal(consultar(eje, id, [1], 'CONTAR(FILTRAR(BUSCAR(1), ACTUAL(0) = "x"))').estado, 'PENDIENTE');
});

test('E-22 todo estado no RESUELTO viene explicado con un motivo legible y sin dato inventado', async () => {
  const { eje, id } = await ejeCon(['Casa', 'texto', '=LOCAL(9)', '=LOCAL(1) + 1', '=1 +', '=HOLA()', '=LOCAL(6)', '=LOCAL(5)', '=REF("#T")']);
  for (let i = 2; i <= 7; i++) {
    const r = evaluar(eje, id, [i]);
    assert.notEqual(r.estado, 'RESUELTO', 'slot ' + i);
    assert.equal(typeof r.motivo, 'string');
    assert.ok(r.motivo.length > 0);
    assert.equal(r.texto, r.estado + ': ' + r.motivo);
    assert.equal(r.valor, undefined);
  }
});

test('E-24 la evaluación retiene dependencias y procedencia para auditoría', async () => {
  const { eje, plan, transporte, c, REF_T } = await escenarioIntegral();
  const lector = await escribe(eje, plan.id, ['Lector', '=REF("' + plan.id + '", "1000000000") + ' + REF_T]);
  const r = evaluar(eje, lector.id, [1]);
  assert.equal(r.texto, '195 EUR (175 EUR + 20 EUR)');
  assert.ok(r.dependencias.includes(plan.id + ':1000000000'));
  assert.ok(r.dependencias.includes(transporte.id + ':5000000000'));
  for (const item of c('BUSCAR(2)').valor.items) {
    assert.ok(item.procedencia.length > 0);
    assert.equal(item.vector.length, 10);
    assert.equal(item.distancia.length, 10);
    assert.ok(typeof item.signo === 'string');
  }
});

test('E-24b toda lectura queda en las dependencias, también la de un literal por LOCAL', async () => {
  const { eje, id } = await ejeCon(['Casa', '175 EUR', '=LOCAL(1) + 1 EUR', '=LOCAL(9)']);
  assert.ok(evaluar(eje, id, [2]).dependencias.includes(id + ':1000000000'));
  assert.ok(evaluar(eje, id, [3]).dependencias.includes(id + ':9000000000')); // también la que quedó PENDIENTE: cuando llegue, se recalcula
});

test('E-25 navegar referencias entre eventos no consume profundidad BTML', async () => {
  const { eje, id } = await ejeCon(['Casa']);
  // VG, 7-11 noche: por hojas: el 0 envuelto hace de cada 1 una décupla, para seguir la 1.1 por dirección.
  let anterior = await escribe(eje, id, ['Fondo', [['nivel'], 'tesoro']]);
  for (let k = 0; k < 5; k++) anterior = await escribe(eje, id, ['Salto ' + k, [['nivel'], { ref: anterior.id, dir: '1100000000' }]]);
  const lector = await escribe(eje, id, ['Lector', [['nivel'], '=LOCAL(0, 0)'], '=REF("' + anterior.id + '", "1100000000")']);
  assert.equal(evaluar(eje, lector.id, [2]).texto, 'tesoro'); // seis saltos de dos dígitos sin concatenar
  assert.equal(evaluar(eje, lector.id, [1, 1]).texto, 'nivel'); // y el anfitrión local sigue siendo el subarray
});

test('E-26 unidades distintas no son INCOMPATIBLE ni suma escalar: composición; misma unidad suma con desglose', async () => {
  const { eje, id } = await ejeCon(['Casa', '=200 m + 5 €', '=200 m + 50 m']);
  const hetero = evaluar(eje, id, [1]);
  assert.notEqual(hetero.estado, 'INCOMPATIBLE');
  assert.equal(hetero.estado, 'RESUELTO');
  assert.equal(hetero.valor.tipo, 'composicion');
  assert.equal(hetero.valor.partes.length, 2);
  assert.equal(evaluar(eje, id, [2]).texto, '250 m (200 m + 50 m)');
});

// =====================================================================
// Reglas con fuerza «propuesta» o «abierto»: sin prueba hasta que VG decida.
// Se listan con su id para que no se conviertan en regla por accidente.
// =====================================================================
//
// Serie S (sintaxis)
//   S-02 [propuesta] escape «==» para un texto que empieza por «=»; «===x» sin definir.
//   S-04 [abierto]   comillas dentro de la fórmula: dobles (convención) o simples (ejemplo integral); escape interno.
//   S-05 [abierto]   literales numéricos: separador decimal/miles, notación científica, signo.
//   S-09 [abierto]   identificadores estables de operador, idioma, versiones, implementación por hash.
//   S-10 [propuesta] vocabulario SUMA, MULTI, MENOR_IGUAL (hoy +, *, <=): alias o corrección del corpus.
//   S-11 [abierto]   operadores infijos y tabla de precedencia (hoy decisión de implementación).
//   S-19 [abierto]   vectores/matrices tipadas como valores BQL.
//   S-20 [propuesta] diez operaciones matriciales afines a PV8 (no sustituyen la comparabilidad de PV8).
//   S-22 [abierto]   firma de ELEGIR: cantidad, candidato por referencia o ambas.
//
// Serie O (operadores y ámbitos)
//   O-17 [abierto]   cantidad > 1 dentro de ámbitos unitarios; propagación de cardinalidad y orden en filtros anidados
//                    (hoy ACTUAL(pv, k > 1) dentro de FILTRAR/ORDENAR queda PENDIENTE, sin inventar respuesta).
//   O-23 [abierto]   si BUSCAR recorre todos los eventos accesibles que declaran la posición o solo los que el árbol enlaza.
//   O-31 [abierto]   sintaxis exacta de ELEGIR; =ELEGIR(LOCAL(2),REF('#B')) es ilustrativo.
//   O-33 [propuesta] PENDIENTE POR LÍMITE con parciales señalados: implementado por encargo (mapa §2.3 lo lista
//                    entre los estados); se prueba arriba con E-09. Valores de los límites y forma de `parcial`: V0.
//   O-36 [abierto]   composiciones más allá de la suma: producto, comparación, división, materialización, trazabilidad.
//   O-37 [abierto]   nombres en español como alias; identidad semántica estable y localización en V5.
//   O-38 [abierto]   implementaciones verificables referenciadas por hash; política de ejecución.
//   O-39 [propuesta] familias de operadores por PV como categorías exploratorias.
//   O-40 [propuesta] el ejemplo integral literal FILTRAR(BUSCAR(LOCAL(5)), MENOR_IGUAL(SUMA(ACTUAL(1),REF('#T','5000000000')),LOCAL(1)));
//                    su lógica sí se prueba con la sintaxis vigente en O-14.
//
// Serie E (estados)
//   E-09 [propuesta] agotamiento de recursos → PENDIENTE POR LÍMITE con parciales: implementado (ver O-33/E-09).
//   E-19 [abierto]   política de candidatos pendientes dentro de FILTRAR/ORDENAR (hoy toda la consulta queda PENDIENTE).
//   E-23 [abierto]   cantidad > 1 de ACTUAL en ámbitos unitarios; fijar sintaxis antes de asignar estados.
//   E-27 [abierto]   propagación de estados por LOCAL/REF: si se nombra el slot origen y si un ERROR ajeno se degrada.
//   E-28 [abierto]   valor nulo, terminal vacío y «resultado desconocido» como estados (hoy '' es texto RESUELTO).
//   E-29 [propuesta] cada ejemplo normativo declara estado esperado, condición de éxito y contraejemplo.
