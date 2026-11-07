import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import * as nucleo from '../src/index.js';
import { PV, TODAS, EPOCA_0, EPOCAS, cargarEpoca, epocaDe, leerDireccion } from '../src/epocas.js';
import { EPOCA_0_DATOS } from '../datos/epocas/epocas.js';
import { generar, nombreDeConstante } from '../datos/epocas/generar.mjs';
import { ordenarPorEncaje } from '../src/encaje.js';
import { decupla } from '../src/pointed.js';
import { secuencia } from '../src/sequenced.js';
import { mapa } from '../src/mapped.js';
import { ejemploCompra } from '../ejemplos/ikisai/compra-food.mjs';

const leerJSON = (f) => JSON.parse(readFileSync(new URL('../datos/epocas/' + f, import.meta.url), 'utf8'));
const DIEZ = [...Array(10).keys()];
const PREGUNTAS = ['qué es', 'cuánto', 'con qué condición', 'con quién', 'qué se hace', 'dónde encaja', 'de dónde viene', 'para cuándo', 'frente a otros', 'cómo'];
const ARRIBA = /^Aplicado al nodo de arriba/;

/** Una época de prueba con las cien reglas cortas, para añadirle reglas largas. */
const generales = DIEZ.map((d) => ({ profundidad: TODAS, digito: d, nombre: 'g' + d }));

test('carga: datos/epocas/epocas.js está al día con los JSON y la época 1 propuesta ya no existe', () => {
  const enDisco = readFileSync(new URL('../datos/epocas/epocas.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.equal(enDisco, generar(), 'epocas.js desfasado: ejecuta `npm run epocas`');
  assert.deepEqual(EPOCA_0_DATOS, leerJSON('epoca-0.json'));
  assert.equal(nombreDeConstante('epoca-0.json'), 'EPOCA_0_DATOS');
  assert.deepEqual(readdirSync(new URL('../datos/epocas/', import.meta.url)).filter((f) => /^epoca-.*\.json$/.test(f)), ['epoca-0.json']);
  assert.equal(nucleo.EPOCA_1_PROPUESTA, undefined);
});

test('época 0: las cien reglas cortas, una por profundidad y dígito, sin huecos ni duplicados', () => {
  assert.equal(EPOCA_0.nombre, 'época 0');
  assert.equal(EPOCA_0.estado, 'decidida');
  assert.match(EPOCA_0_DATOS.decision, /VG, 7-11 noche/);
  assert.equal(EPOCA_0_DATOS.reglas.length, 100);
  const vistas = new Set(EPOCA_0_DATOS.reglas.map((r) => r.profundidad + '.' + r.digito));
  assert.equal(vistas.size, 100, 'reglas repetidas');
  for (const p of DIEZ) for (const d of DIEZ) assert.ok(vistas.has(p + '.' + d), `falta la regla ${p}.${d}`);
  assert.ok(EPOCA_0_DATOS.reglas.every((r) => r.profundidad !== TODAS && r.ruta === undefined), 'ninguna regla general ni larga');
  assert.equal(EPOCA_0.reglas.length, 100);
  for (const r of EPOCA_0.reglas) assert.ok(r.nombre && r.significado && r.ejemplo, `regla ${r.profundidad}.${r.digito} incompleta`);
  assert.equal(EPOCA_0.largas.length, 0);
  assert.deepEqual(EPOCA_0_DATOS.ordinales, []);
  assert.ok(DIEZ.every((k) => !EPOCA_0.ordinal(k)), 'ninguna profundidad es ordinal');
  assert.equal(EPOCA_0.reglaCorta(0, 10), undefined);
  assert.equal(EPOCA_0.reglaCorta(12, 4), undefined); // fuera de las diez profundidades no hay regla
});

test('época 0: la profundidad 0 es la cruceta y en toda profundidad n ≥ 1 el dígito es el PV aplicado al nodo de arriba', () => {
  for (const d of DIEZ) {
    assert.equal(EPOCA_0.reglaCorta(0, d), PV[d]);
    assert.doesNotMatch(EPOCA_0.regla(0, d).significado, ARRIBA);
  }
  for (let p = 1; p < 10; p++) {
    for (const d of DIEZ) {
      assert.equal(EPOCA_0.reglaCorta(p, d), PREGUNTAS[d], `regla ${p}.${d}`);
      assert.match(EPOCA_0.regla(p, d).significado, ARRIBA, `regla ${p}.${d}`);
      // El sentido del dígito no cambia de profundidad: el mismo PV, en cualquier n ≥ 1.
      assert.equal(EPOCA_0.reglaCorta(p, d), EPOCA_0.reglaCorta(1, d));
    }
  }
  // El principio de VG viaja con los datos.
  assert.ok(EPOCA_0.principios.some((x) => /en toda profundidad n ≥ 1 el dígito es el PV aplicado al nodo de arriba/.test(x) && /reglas largas = lo que pulen las épocas/.test(x)));
  // Lo que ya estaba decidido sigue ahí: el signo (opción B) y que ninguna profundidad es ordinal.
  assert.ok(EPOCA_0.principios.some((x) => /opción B, decidida por VG/.test(x) && x.includes('§12 [D]')));
  assert.ok(EPOCA_0.dudas.every((x) => x.includes('[X] decidir VG')));
});

test('EPOCAS: solo la época 0; la época 1 propuesta se retiró y no ocupa el nombre «época 1»', () => {
  assert.deepEqual(Object.keys(EPOCAS), ['época 0']);
  assert.equal(EPOCAS['época 0'], EPOCA_0);
  assert.equal(epocaDe(), EPOCA_0);
  assert.equal(epocaDe('época 0'), EPOCA_0);
  assert.throws(() => epocaDe('época 1 (propuesta)'), /época desconocida/);
  assert.throws(() => epocaDe('época 1'), /época desconocida: época 1$/);
  assert.throws(() => epocaDe('época 7'), /época desconocida/);
});

test('lectura: leerDireccion lee la profundidad 0 como PV y la 1 como «aplicado al nodo de arriba»', () => {
  const lectura = leerDireccion('1400000000');
  assert.deepEqual(lectura, [
    { profundidad: 0, digito: 1, significado: 'recursos' },
    { profundidad: 1, digito: 4, significado: 'qué se hace' },
  ]);
  // Las reglas completas de esas dos entradas.
  const r0 = EPOCA_0.regla(lectura[0].profundidad, lectura[0].digito);
  const r1 = EPOCA_0.regla(lectura[1].profundidad, lectura[1].digito);
  assert.equal(r0.nombre, 'recursos');
  assert.doesNotMatch(r0.significado, ARRIBA); // la cruceta: el PV sobre el registro en foco
  assert.equal(r1.nombre, 'qué se hace');
  assert.match(r1.significado, ARRIBA);
  assert.deepEqual(leerDireccion('1400000000', 'época 0'), lectura);
  assert.deepEqual(leerDireccion('1400000000', EPOCA_0), lectura);
  assert.deepEqual(leerDireccion('0000000000'), []);
  assert.throws(() => leerDireccion('1000000000', 'época 9'), /época desconocida/);
  assert.throws(() => leerDireccion('1000000000', 'época 1 (propuesta)'), /época desconocida/);
});

test('lectura: la dirección entera, profundidad a profundidad', () => {
  assert.deepEqual(leerDireccion('1721347610').map((x) => x.significado),
    ['recursos', 'para cuándo', 'con qué condición', 'cuánto', 'con quién', 'qué se hace', 'para cuándo', 'de dónde viene', 'cuánto']);
  assert.deepEqual(leerDireccion('1721347610').map((x) => x.digito), [1, 7, 2, 1, 3, 4, 7, 6, 1]);
  const r = EPOCA_0.regla(1, 2);
  assert.equal(r.nombre, 'con qué condición');
  assert.match(r.ejemplo, /1200000000/);
  assert.equal(EPOCA_0.regla(10, 0), undefined);
  assert.equal(EPOCA_0.regla(0, 10), undefined);
});

test('los modos leen con la época que se les pase, por objeto o por nombre', async () => {
  const ev = { id: 'ab', autor: 'x', t: '2026-11-07T10:00:00Z', sobre: null, payload: ['Compra', 1, 'EUR 12'] };
  const grano = ['qué es', 'cuánto', 'con qué condición'];
  assert.deepEqual(decupla(ev, EPOCA_0, 1).posiciones.map((p) => p.significado).slice(0, 3), grano);
  assert.deepEqual(decupla(ev, 'época 0', 1).posiciones.map((p) => p.significado), PREGUNTAS);
  assert.deepEqual(decupla(ev).posiciones.map((p) => p.significado), [...PV]); // profundidad 0: la cruceta
  assert.throws(() => decupla(ev, 'época 1'), /época desconocida/);

  const { eje, compra } = await ejemploCompra();
  const porNombre = secuencia(eje, compra.id, { epoca: 'época 0' });
  assert.deepEqual(porNombre, secuencia(eje, compra.id, { epoca: EPOCA_0 }));
  assert.deepEqual(porNombre.decuplas[0].posiciones.map((p) => p.significado), [...PV]); // profundidad 0 del registro nuevo
  assert.throws(() => secuencia(eje, compra.id, { epoca: 'época 9' }), /época desconocida/);

  const m = mapa(eje, compra.id, { camino: [1], epoca: 'época 0' });
  assert.deepEqual(m, mapa(eje, compra.id, { camino: [1], epoca: EPOCA_0 }));
  assert.deepEqual(m.celdas.map((c) => c.significado), PREGUNTAS);
  assert.deepEqual(mapa(eje, compra.id).celdas.map((c) => c.significado), [...PV]);
  assert.throws(() => mapa(eje, compra.id, { epoca: 'época 1' }), /época desconocida/);
});

test('cargarEpoca: regla de todas las profundidades, regla propia y respaldo', () => {
  const e = cargarEpoca({ nombre: 'prueba', reglas: [...generales, { profundidad: 3, digito: 1, nombre: 'propia' }] });
  assert.equal(e.reglaCorta(3, 1), 'propia');
  assert.equal(e.reglaCorta(4, 1), 'g1');
  assert.equal(e.reglas.length, 100);
  // Sin regla ni respaldo, falta; con la época 0 de respaldo, se lee como la época 0.
  const parcial = { nombre: 'parcial', reglas: [{ profundidad: 1, digito: 1, nombre: 'otro cuánto' }] };
  assert.throws(() => cargarEpoca(parcial), /falta la regla corta 0\.0/);
  const conRespaldo = cargarEpoca(parcial, { respaldo: EPOCA_0 });
  assert.equal(conRespaldo.reglaCorta(1, 1), 'otro cuánto');
  assert.equal(conRespaldo.reglaCorta(1, 2), 'con qué condición');
  assert.equal(conRespaldo.reglaCorta(0, 2), 'criterios');
});

test('cargarEpoca: rechaza datos mal formados', () => {
  assert.throws(() => cargarEpoca({ reglas: generales }), /falta el nombre/);
  assert.throws(() => cargarEpoca({ nombre: 'x' }), /faltan las reglas/);
  assert.throws(() => cargarEpoca({ nombre: 'x', reglas: [...generales, { profundidad: 0, digito: 10, nombre: 'n' }] }), /dígito 0–9/);
  assert.throws(() => cargarEpoca({ nombre: 'x', reglas: [...generales, { profundidad: 10, digito: 0, nombre: 'n' }] }), /profundidad 0–9/);
  assert.throws(() => cargarEpoca({ nombre: 'x', reglas: [...generales, { profundidad: 0, digito: 0, nombre: '' }] }), /falta el nombre/);
  assert.throws(() => cargarEpoca({ nombre: 'x', reglas: [...generales, generales[0]] }), /regla repetida/);
  assert.throws(() => cargarEpoca({ nombre: 'x', reglas: generales, ordinales: [11] }), /ordinales/);
});

// ---------- reglas largas ----------

test('reglas largas: una regla con ruta se aplica al leer esa ruta exacta y gana a las cortas', () => {
  const datos = { nombre: 'con larga', reglas: [...generales, { ruta: '14', nombre: 'qué se hace con los recursos', significado: 'Lo que se hace con los recursos.', ejemplo: 'pagar' }] };
  const e = cargarEpoca(datos);
  assert.equal(e.largas.length, 1);
  assert.equal(e.reglas.length, 100); // las largas no cuentan entre las cien cortas
  assert.equal(e.reglaCorta(1, 4), 'g4'); // la corta sigue ahí
  assert.equal(e.reglaLarga('14'), 'qué se hace con los recursos');
  assert.equal(e.larga('14').ruta, '14');
  assert.equal(e.larga('14').ejemplo, 'pagar');
  assert.equal(e.reglaLarga('15'), undefined);
  assert.equal(e.larga('1'), undefined);
  // La ruta exacta: gana la larga y la entrada lo dice.
  assert.deepEqual(leerDireccion('1400000000', e), [
    { profundidad: 0, digito: 1, significado: 'g1' },
    { profundidad: 1, digito: 4, significado: 'qué se hace con los recursos', larga: '14' },
  ]);
  // La corta de siempre donde la ruta no coincide.
  assert.deepEqual(leerDireccion('1500000000', e).map((x) => x.significado), ['g1', 'g5']);
  assert.deepEqual(leerDireccion('2400000000', e).map((x) => x.significado), ['g2', 'g4']);
  // Una ruta más honda que la larga pasa por ella: la entrada de la profundidad 1 sigue siendo la larga.
  assert.deepEqual(leerDireccion('1430000000', e).map((x) => x.significado), ['g1', 'qué se hace con los recursos', 'g3']);
  // Sin reglas largas, la lectura no cambia: la época 0 no trae ninguna.
  assert.deepEqual(leerDireccion('1400000000', EPOCA_0).map((x) => Object.keys(x).join()), ['profundidad,digito,significado', 'profundidad,digito,significado']);
});

test('reglas largas: con respaldo, la propia manda y la del respaldo vale donde la propia calla', () => {
  const base = cargarEpoca({ nombre: 'base', reglas: [...generales, { ruta: '84', nombre: 'base 84' }, { ruta: '85', nombre: 'base 85' }] });
  const sobre = cargarEpoca({ nombre: 'sobre', reglas: [{ ruta: '84', nombre: 'propia 84' }] }, { respaldo: base });
  assert.equal(sobre.reglaLarga('84'), 'propia 84');
  assert.equal(sobre.reglaLarga('85'), 'base 85');
  assert.equal(sobre.largas.length, 1); // `largas` lista solo las propias
  assert.deepEqual(leerDireccion('8500000000', sobre).map((x) => x.significado), ['g8', 'base 85']);
});

test('reglas largas: una ruta mal formada, repetida o mezclada con corta se rechaza', () => {
  const con = (r) => ({ nombre: 'x', reglas: [...generales, ...r] });
  assert.throws(() => cargarEpoca(con([{ ruta: '1', nombre: 'n' }])), /dos a diez dígitos/); // una sola cifra es una corta
  assert.throws(() => cargarEpoca(con([{ ruta: '1a', nombre: 'n' }])), /dos a diez dígitos/);
  assert.throws(() => cargarEpoca(con([{ ruta: 14, nombre: 'n' }])), /dos a diez dígitos/);
  assert.throws(() => cargarEpoca(con([{ ruta: '12345678901', nombre: 'n' }])), /dos a diez dígitos/);
  assert.throws(() => cargarEpoca(con([{ ruta: '14', profundidad: 1, digito: 4, nombre: 'n' }])), /ruta, no profundidad ni dígito/);
  assert.throws(() => cargarEpoca(con([{ ruta: '14' }])), /falta el nombre/);
  assert.throws(() => cargarEpoca(con([{ ruta: '14', nombre: 'a' }, { ruta: '14', nombre: 'b' }])), /regla larga repetida/);
});

test('ordinal(profundidad): una época declarada en datos ordena por distancia donde es ordinal (gancho del encaje)', () => {
  const ordinal0 = cargarEpoca({ nombre: 'ordinal en 0', ordinales: [0], reglas: generales });
  assert.equal(ordinal0.ordinal(0), true);
  assert.equal(ordinal0.ordinal(1), false);
  const cero = Array(10).fill(0);
  const lista = [
    { nombre: 'lejos', vector: [3, ...cero.slice(1)] },
    { nombre: 'cerca', vector: [-1, 5, ...cero.slice(2)] },
    { nombre: 'exacto', vector: cero },
  ];
  const nombres = (l) => l.map((x) => x.nombre);
  // Época 0: todo nominal; ordenan el acuerdo de prefijo y la llegada.
  assert.deepEqual(nombres(ordenarPorEncaje(lista, { epoca: EPOCA_0 })), ['exacto', 'lejos', 'cerca']);
  assert.deepEqual(nombres(ordenarPorEncaje(lista, { epoca: EPOCA_0 })), nombres(ordenarPorEncaje(lista)));
  // Una época ordinal en la profundidad 0: ahí la distancia ordena.
  assert.deepEqual(nombres(ordenarPorEncaje(lista, { epoca: ordinal0 })), ['exacto', 'cerca', 'lejos']);
});
