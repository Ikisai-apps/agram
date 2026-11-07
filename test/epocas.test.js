import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PV, TODAS, EPOCA_0, EPOCA_1_PROPUESTA, EPOCAS, cargarEpoca, epocaDe, leerDireccion } from '../src/epocas.js';
import { EPOCA_0_DATOS, EPOCA_1_PROPUESTA_DATOS } from '../datos/epocas/epocas.js';
import { generar, nombreDeConstante } from '../datos/epocas/generar.mjs';
import { ordenarPorEncaje } from '../src/encaje.js';
import { decupla } from '../src/pointed.js';
import { secuencia } from '../src/sequenced.js';
import { mapa } from '../src/mapped.js';
import { ejemploCompra } from '../ejemplos/ikisai/compra-food.mjs';

const leerJSON = (f) => JSON.parse(readFileSync(new URL('../datos/epocas/' + f, import.meta.url), 'utf8'));
const DIEZ = [...Array(10).keys()];
const E1 = 'época 1 (propuesta)';

test('carga: datos/epocas/epocas.js está al día con los JSON', () => {
  const enDisco = readFileSync(new URL('../datos/epocas/epocas.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.equal(enDisco, generar(), 'epocas.js desfasado: ejecuta `npm run epocas`');
  assert.deepEqual(EPOCA_0_DATOS, leerJSON('epoca-0.json'));
  assert.deepEqual(EPOCA_1_PROPUESTA_DATOS, leerJSON('epoca-1-propuesta.json'));
  assert.equal(nombreDeConstante('epoca-1-propuesta.json'), 'EPOCA_1_PROPUESTA_DATOS');
});

test('época 0: igual que hoy, cada dígito es un PV en todas las profundidades', () => {
  assert.equal(EPOCA_0.nombre, 'época 0');
  assert.equal(EPOCA_0.estado, 'decidida');
  // El signo (opción B) se cita como decidido por VG (mapa §12 [D]).
  assert.ok(EPOCA_0.principios.some((p) => /opción B, decidida por VG/.test(p) && p.includes('§12 [D]')));
  for (const p of [...DIEZ, 12]) for (const d of DIEZ) assert.equal(EPOCA_0.reglaCorta(p, d), PV[d]);
  assert.equal(EPOCA_0.reglaCorta(0, 10), undefined);
  assert.equal(EPOCA_0.reglas.length, 100);
  assert.ok(EPOCA_0_DATOS.reglas.every((r) => r.profundidad === TODAS));
  assert.ok(DIEZ.every((k) => !EPOCA_0.ordinal(k)));
});

test('época 1 (propuesta): cien reglas, una por profundidad y dígito, con nombre, significado y ejemplo', () => {
  assert.equal(EPOCA_1_PROPUESTA.nombre, E1);
  assert.equal(EPOCA_1_PROPUESTA.estado, 'propuesta');
  assert.equal(EPOCA_1_PROPUESTA_DATOS.reglas.length, 100);
  const vistas = new Set(EPOCA_1_PROPUESTA_DATOS.reglas.map((r) => r.profundidad + '.' + r.digito));
  assert.equal(vistas.size, 100);
  for (const r of EPOCA_1_PROPUESTA.reglas) {
    assert.ok(r.nombre && r.significado && r.ejemplo, `regla ${r.profundidad}.${r.digito} incompleta`);
  }
  assert.ok(EPOCA_1_PROPUESTA.principios.length >= 10);
  assert.ok(EPOCA_1_PROPUESTA.dudas.length > 0 && EPOCA_1_PROPUESTA.dudas.every((d) => d.includes('[X] decidir VG')));
  // Lo que VG ya decidió el 7-11 por la tarde (mapa §12 [D]) no se vuelve a preguntar: se cita como decidido.
  assert.ok(EPOCA_1_PROPUESTA.principios.some((p) => p.startsWith('Orden y signo.') && p.includes('Opción B, decidida por VG')));
  assert.ok(!EPOCA_1_PROPUESTA.dudas.some((d) => /Se decide junto con las opciones A–E|¿Las dos\?/.test(d)));
});

test('época 1 (propuesta): el dígito sigue siendo el PV (invariancia que pide ACTUAL)', () => {
  // Profundidad 0 = época 0.
  for (const d of DIEZ) assert.equal(EPOCA_1_PROPUESTA.reglaCorta(0, d), PV[d]);
  // Por debajo, cada regla dice qué PV aplica: el nombre es el grano, no otro significado.
  for (const r of EPOCA_1_PROPUESTA.reglas.filter((x) => x.profundidad > 0)) {
    assert.ok(r.significado.startsWith('PV' + r.digito), `regla ${r.profundidad}.${r.digito}: «${r.significado.slice(0, 20)}…»`);
  }
  // Las profundidades 3 a 9 no se especializan: la decena de preguntas de la profundidad 1.
  for (let p = 3; p < 10; p++) for (const d of DIEZ) assert.equal(EPOCA_1_PROPUESTA.reglaCorta(p, d), EPOCA_1_PROPUESTA.reglaCorta(1, d));
  // Todas nominales: nada ordinal.
  assert.ok(DIEZ.every((k) => !EPOCA_1_PROPUESTA.ordinal(k)));
});

test('EPOCAS: por nombre; la propuesta no ocupa el nombre «época 1»', () => {
  assert.deepEqual(Object.keys(EPOCAS), ['época 0', E1]);
  assert.equal(EPOCAS['época 0'], EPOCA_0);
  assert.equal(EPOCAS[E1], EPOCA_1_PROPUESTA);
  assert.equal(epocaDe(E1), EPOCA_1_PROPUESTA);
  assert.equal(epocaDe(), EPOCA_0);
  assert.equal(EPOCAS['época 1'], undefined);
  assert.throws(() => epocaDe('época 1'), /época desconocida: época 1$/);
  assert.throws(() => epocaDe('época 7'), /época desconocida/);
});

test('lectura: leerDireccion con cualquier época, por objeto o por nombre', () => {
  const dir = '1721347610';
  assert.deepEqual(leerDireccion(dir).map((x) => x.significado),
    ['recursos', 'futuro', 'criterios', 'recursos', 'comunicación', 'fábrica', 'futuro', 'pasado', 'recursos']);
  const e1 = ['recursos', 'para cuándo', 'unidad o condición', 'cuánto', 'con quién', 'qué se hace', 'para cuándo', 'de dónde viene', 'cuánto'];
  assert.deepEqual(leerDireccion(dir, EPOCA_1_PROPUESTA).map((x) => x.significado), e1);
  assert.deepEqual(leerDireccion(dir, E1).map((x) => x.significado), e1);
  assert.deepEqual(leerDireccion(dir, E1).map((x) => x.digito), [1, 7, 2, 1, 3, 4, 7, 6, 1]);
  assert.deepEqual(leerDireccion('1200000000', E1), [
    { profundidad: 0, digito: 1, significado: 'recursos' },
    { profundidad: 1, digito: 2, significado: 'con qué condición' },
  ]);
  assert.deepEqual(leerDireccion('0000000000', EPOCA_1_PROPUESTA), []);
  assert.throws(() => leerDireccion('1000000000', 'época 9'), /época desconocida/);
});

test('lectura: la regla completa trae significado y ejemplo', () => {
  const r = EPOCA_1_PROPUESTA.regla(1, 2);
  assert.equal(r.nombre, 'con qué condición');
  assert.match(r.ejemplo, /1200000000/);
  assert.equal(EPOCA_1_PROPUESTA.regla(10, 0), undefined);
  assert.equal(EPOCA_1_PROPUESTA.regla(0, 10), undefined);
});

test('los modos leen con la época que se les pase, por objeto o por nombre', async () => {
  const ev = { id: 'ab', autor: 'x', t: '2026-11-07T10:00:00Z', sobre: null, payload: ['Compra', 1, 'EUR 12'] };
  const grano = ['qué', 'cuánto', 'con qué condición'];
  assert.deepEqual(decupla(ev, EPOCA_1_PROPUESTA, 1).posiciones.map((p) => p.significado).slice(0, 3), grano);
  assert.deepEqual(decupla(ev, E1, 1).posiciones.map((p) => p.significado).slice(0, 3), grano);
  assert.deepEqual(decupla(ev, 'época 0', 1).posiciones.map((p) => p.significado), [...PV]);
  assert.deepEqual(decupla(ev).posiciones.map((p) => p.significado), [...PV]);
  assert.throws(() => decupla(ev, 'época 1'), /época desconocida/);

  const { eje, compra } = await ejemploCompra();
  const porNombre = secuencia(eje, compra.id, { epoca: E1 });
  assert.deepEqual(porNombre, secuencia(eje, compra.id, { epoca: EPOCA_1_PROPUESTA }));
  assert.deepEqual(porNombre.decuplas[0].posiciones.map((p) => p.significado), [...PV]); // profundidad 0 = época 0
  assert.throws(() => secuencia(eje, compra.id, { epoca: 'época 9' }), /época desconocida/);

  const m = mapa(eje, compra.id, { camino: [1], epoca: E1 });
  assert.deepEqual(m, mapa(eje, compra.id, { camino: [1], epoca: EPOCA_1_PROPUESTA }));
  assert.deepEqual(m.celdas.map((c) => c.significado).slice(0, 3), grano);
  assert.deepEqual(mapa(eje, compra.id, { camino: [1] }).celdas.map((c) => c.significado), [...PV]);
  assert.throws(() => mapa(eje, compra.id, { epoca: 'época 1' }), /época desconocida/);
});

test('cargarEpoca: regla de todas las profundidades, regla propia y respaldo', () => {
  const generales = DIEZ.map((d) => ({ profundidad: TODAS, digito: d, nombre: 'g' + d }));
  const e = cargarEpoca({ nombre: 'prueba', reglas: [...generales, { profundidad: 3, digito: 1, nombre: 'propia' }] });
  assert.equal(e.reglaCorta(3, 1), 'propia');
  assert.equal(e.reglaCorta(4, 1), 'g1');
  assert.equal(e.reglas.length, 100);
  // Sin regla ni respaldo, falta; con la época 0 de respaldo, se lee como época 0.
  const parcial = { nombre: 'parcial', reglas: [{ profundidad: 1, digito: 1, nombre: 'cuánto' }] };
  assert.throws(() => cargarEpoca(parcial), /falta la regla corta 0\.0/);
  const conRespaldo = cargarEpoca(parcial, { respaldo: EPOCA_0 });
  assert.equal(conRespaldo.reglaCorta(1, 1), 'cuánto');
  assert.equal(conRespaldo.reglaCorta(1, 2), 'criterios');
});

test('cargarEpoca: rechaza datos mal formados', () => {
  const base = DIEZ.map((d) => ({ profundidad: TODAS, digito: d, nombre: 'g' + d }));
  assert.throws(() => cargarEpoca({ reglas: base }), /falta el nombre/);
  assert.throws(() => cargarEpoca({ nombre: 'x' }), /faltan las reglas/);
  assert.throws(() => cargarEpoca({ nombre: 'x', reglas: [...base, { profundidad: 0, digito: 10, nombre: 'n' }] }), /dígito 0–9/);
  assert.throws(() => cargarEpoca({ nombre: 'x', reglas: [...base, { profundidad: 10, digito: 0, nombre: 'n' }] }), /profundidad 0–9/);
  assert.throws(() => cargarEpoca({ nombre: 'x', reglas: [...base, { profundidad: 0, digito: 0, nombre: '' }] }), /falta el nombre/);
  assert.throws(() => cargarEpoca({ nombre: 'x', reglas: [...base, base[0]] }), /regla repetida/);
  assert.throws(() => cargarEpoca({ nombre: 'x', reglas: base, ordinales: [11] }), /ordinales/);
});

test('ordinal(profundidad): una época declarada en datos ordena por distancia donde es ordinal (gancho del encaje)', () => {
  const base = DIEZ.map((d) => ({ profundidad: TODAS, digito: d, nombre: 'g' + d }));
  const ordinal0 = cargarEpoca({ nombre: 'ordinal en 0', ordinales: [0], reglas: base });
  assert.equal(ordinal0.ordinal(0), true);
  assert.equal(ordinal0.ordinal(1), false);
  const cero = Array(10).fill(0);
  const lista = [
    { nombre: 'lejos', vector: [3, ...cero.slice(1)] },
    { nombre: 'cerca', vector: [-1, 5, ...cero.slice(2)] },
    { nombre: 'exacto', vector: cero },
  ];
  const nombres = (l) => l.map((x) => x.nombre);
  // Época 1: todo nominal; ordenan el acuerdo de prefijo y la llegada.
  assert.deepEqual(nombres(ordenarPorEncaje(lista, { epoca: EPOCA_1_PROPUESTA })), ['exacto', 'lejos', 'cerca']);
  assert.deepEqual(nombres(ordenarPorEncaje(lista, { epoca: EPOCA_1_PROPUESTA })), nombres(ordenarPorEncaje(lista)));
  // Una época ordinal en la profundidad 0: ahí la distancia ordena.
  assert.deepEqual(nombres(ordenarPorEncaje(lista, { epoca: ordinal0 })), ['exacto', 'cerca', 'lejos']);
});
