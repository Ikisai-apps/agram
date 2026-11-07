import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejemploCompra, ejemploCuenta } from '../ejemplos/ikisai/compra-food.mjs';
import { vector, acuerdo, norma, signo, faltas, excedentes, distancia, ordenarPorEncaje, ocupantes } from '../src/encaje.js';
import { consultar } from '../src/bql.js';
import { consolidar, descubrir } from '../src/motor.js';

const gastaT = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });
const T = '2026-11-07T16:00:00Z';

test('vector: destino menos origen, dígito a dígito; distancia positiva, acuerdo y signo informativo', () => {
  // candidato − buscado, como el ejemplo del corpus («+2 en el quinto dígito»)
  assert.deepEqual(vector('1000000000', '1000000000'), [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(vector('0000000000', '4000000000'), [-4, 0, 0, 0, 0, 0, 0, 0, 0, 0]); // le falta
  assert.deepEqual(vector('7000000000', '2000000000'), [5, 0, 0, 0, 0, 0, 0, 0, 0, 0]); // le sobra
  assert.deepEqual(vector('1230000000', '1200000000'), [0, 0, 3, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(vector('1200020000', '1200000000'), [0, 0, 0, 0, 0, 2, 0, 0, 0, 0]);
  const exacto = vector('1000000000', '1000000000');
  assert.equal(acuerdo(exacto), 10);
  assert.equal(signo(exacto), 'exacto');
  const sobra = vector('6000000000', '1000000000');
  assert.equal(signo(sobra), 'reducir'); // le sobra en la profundidad 0
  assert.equal(excedentes(sobra), 1);
  assert.deepEqual(distancia(sobra), [5, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(norma(sobra), 5);
  const falta = vector('0000000000', '4000000000');
  assert.equal(signo(falta), 'completar'); // le falta en la profundidad 0
  assert.equal(faltas(falta), 1);
  assert.equal(signo(vector('1700000000', '2300000000')), 'mixto');
  assert.equal(acuerdo(vector('1230000000', '1200000000')), 2);
  assert.throws(() => vector('12', '1200000000'), TypeError);
});

test('ordenar por encaje: coincidencias de ruta (acuerdo de prefijo) y llegada; la distancia por dígito no ordena', () => {
  const lista = [
    { nombre: 'ref desde 7', vector: vector('7000000000', '2000000000') },
    { nombre: 'escrito en 2', vector: vector('0000000000', '2000000000') },
    { nombre: 'exacto', vector: vector('2000000000', '2000000000') },
    { nombre: 'desvío hondo', vector: vector('2300000000', '2000000000') },
    { nombre: 'otro escrito', vector: vector('0000000000', '2000000000') },
  ];
  assert.deepEqual(ordenarPorEncaje(lista).map((x) => x.nombre), ['exacto', 'desvío hondo', 'ref desde 7', 'escrito en 2', 'otro escrito']);
});

test('los ocupantes llevan su vector y salen por encaje; la llegada sigue disponible', async () => {
  const { eje, compra } = await ejemploCompra();
  // Un registro cuya posición 2 es una referencia a la posición 7 de otro (viene leyendo),
  // y un hijo escrito en su posición 2 (viene escribiendo).
  const plan = await eje.escribir({ autor: 'casa', sobre: compra.id, t: T, movimientos: [gastaT('casa')], payload: ['Plan', 'a', 'b', 'c', 'd', 'e', 'f', 'cena el sábado'] });
  const x = await eje.escribir({ autor: 'casa', sobre: compra.id, t: T, movimientos: [gastaT('casa')], payload: ['X', 'r', { ref: plan.id, dir: '7000000000' }] });
  const hijo = await eje.escribir({ autor: 'casa', sobre: x.id, en: '2000000000', t: T, movimientos: [gastaT('casa')], payload: 'criterio escrito' });
  const llegada = ocupantes(eje, x.id, [2], { orden: 'llegada' });
  assert.deepEqual(llegada.map((o) => o.origen), ['propio', 'referencia', 'escrito']);
  assert.deepEqual(llegada.map((o) => o.signo), ['exacto', 'reducir', 'exacto']); // el escrito está anclado justo ahí
  assert.deepEqual(llegada[1].vector.slice(0, 1), [5]);
  assert.deepEqual(llegada[2].vector.slice(0, 1), [0]);
  const encaje = ocupantes(eje, x.id, [2]);
  assert.deepEqual(encaje.map((o) => o.origen), ['propio', 'escrito', 'referencia']); // más coincidencia de ruta antes
  assert.equal(encaje[1].evento, hijo.id);
  // Las colisiones por ceros son encajes exactos entre sí.
  const oc = ocupantes(eje, compra.id, [1]);
  assert.ok(oc.filter((o) => o.origen === 'propio').every((o) => o.signo === 'exacto'));
});

test('BQL: BUSCAR sale por encaje y SIGNO/FALTAS/ACUERDO/DESPLAZAMIENTO son consultables', async () => {
  const { eje, compra } = await ejemploCompra();
  await ejemploCuenta(eje, compra);
  const c = (f) => consultar(eje, compra.id, [1], f);
  assert.equal(c('CONTAR(FILTRAR(BUSCAR(1), SIGNO() = "exacto"))').texto, '4'); // [1], [1.0], la referencia al menú:1 y la cuenta anclada en 1
  assert.equal(c('CONTAR(FILTRAR(BUSCAR(1), SIGNO() = "completar"))').texto, '0');
  assert.equal(c('CONTAR(FILTRAR(BUSCAR(1), FALTAS() = 0))').texto, '4');
  assert.equal(c('CONTAR(FILTRAR(BUSCAR(1), DESPLAZAMIENTO() > 0))').texto, '0');
  assert.equal(c('CONTAR(FILTRAR(BUSCAR(1), ACUERDO() = 10))').texto, '4');
  assert.equal(c('SIGNO()').estado, 'ERROR');
});

test('la consolidación guarda el encaje de cada fuente elegida', async () => {
  const { eje, compra } = await ejemploCompra();
  const cuenta = await ejemploCuenta(eje, compra);
  const d = descubrir(eje, compra.id);
  const candidatoCuenta = d[0].candidatos.find((x) => x.evento === cuenta.id);
  const cons = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: T, elecciones: { 1: { candidato: candidatoCuenta }, 4: 'pagar' } });
  const e = cons.contexto.encaje;
  assert.equal(e.length, 1);
  assert.equal(e[0].posicion, 1);
  assert.equal(e[0].evento, cuenta.id);
  assert.equal(e[0].signo, 'exacto'); // la cuenta está anclada en la posición 1 de la compra
  assert.deepEqual(e[0].vector.slice(0, 2), [0, 0]);
  assert.deepEqual(cons.contexto.fuentes, [cuenta.id]);
});
