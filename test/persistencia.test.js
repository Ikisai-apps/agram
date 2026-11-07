import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejemploCompra, ejemploCuenta } from '../ejemplos/ikisai/compra-food.mjs';
import { serializar, restaurar, guardarLocal, cargarLocal, borrarLocal, apartarLocal, migrar, VERSION } from '../src/persistencia.js';
import { generarClaves } from '../src/autoridad.js';
import { evaluar } from '../src/bql.js';

test('serializar y restaurar reconstruye el eje validando todo', async () => {
  const { eje, compra } = await ejemploCompra();
  await ejemploCuenta(eje, compra);
  const datos = JSON.parse(JSON.stringify(serializar(eje)));
  assert.equal(datos.version, 3); // VG, 7-11 noche: la versión 3 trae el ciclo de vida de los tokens (bloqueos, caducidad)
  assert.equal(datos.version, VERSION);
  assert.equal(datos.eventos.length, 5);
  const otro = await restaurar(datos);
  assert.deepEqual(otro.orden, eje.orden);
  assert.equal(otro.saldo('cocina', 'E:casa/EUR'), 12);
  assert.deepEqual(otro.identidades(), eje.identidades());
  assert.equal(evaluar(otro, otro.orden[4], [1]).texto, '14 EUR (12 EUR + 2 EUR)');
});

test('un evento manipulado en el guardado se rechaza al restaurar', async () => {
  const { eje } = await ejemploCompra();
  const datos = JSON.parse(JSON.stringify(serializar(eje)));
  datos.eventos[3].movimientos[1].cantidad = 1; // la compra pagaba 12
  await assert.rejects(restaurar(datos), /id no corresponde/);
  const datos2 = JSON.parse(JSON.stringify(serializar(eje)));
  datos2.eventos[0].payload = 'otro génesis';
  await assert.rejects(restaurar(datos2), /génesis/);
});

test('con claves, las firmas se verifican también al restaurar', async () => {
  const claves = { casa: await generarClaves(), cocina: await generarClaves(), huesped: await generarClaves() };
  const { eje, compra } = await ejemploCompra({ claves });
  assert.ok(eje.obtener(compra.id).firma);
  assert.deepEqual(eje.clave('huesped'), claves.huesped.publica);
  const datos = JSON.parse(JSON.stringify(serializar(eje)));
  const otro = await restaurar(datos);
  assert.deepEqual(otro.clave('cocina'), claves.cocina.publica);
  // Quitar una firma rompe la restauración.
  const roto = JSON.parse(JSON.stringify(serializar(eje)));
  delete roto.eventos[2].firma;
  await assert.rejects(restaurar(roto), /firma ausente/);
  // Y sin la clave privada, cocina ya no puede escribir.
  await assert.rejects(otro.escribir({ autor: 'cocina', sobre: compra.id, t: '2026-11-07T15:00:00Z', movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'cocina', a: null }], payload: 'x' }), /firma ausente/);
});

test('guardar y cargar en un localStorage simulado', async () => {
  const almacen = new Map();
  globalThis.localStorage = { getItem: (k) => almacen.get(k) ?? null, setItem: (k, v) => almacen.set(k, v), removeItem: (k) => almacen.delete(k) };
  try {
    const { eje } = await ejemploCompra();
    assert.equal(guardarLocal(eje), true);
    const otro = await cargarLocal();
    assert.deepEqual(otro.orden, eje.orden);
    borrarLocal();
    assert.equal(await cargarLocal(), null);
    assert.equal(apartarLocal(), false); // nada que apartar
  } finally {
    delete globalThis.localStorage;
  }
});

test('un eje de la versión 1 no se restaura, y lo guardado se aparta en vez de perderse', async () => {
  const almacen = new Map();
  globalThis.localStorage = { getItem: (k) => almacen.get(k) ?? null, setItem: (k, v) => almacen.set(k, v), removeItem: (k) => almacen.delete(k) };
  try {
    const { eje } = await ejemploCompra();
    const antiguo = JSON.stringify({ ...serializar(eje), version: 1 });
    await assert.rejects(restaurar(JSON.parse(antiguo)), /eje de la versión 1; esta es la 3/);
    almacen.set('agram.eje', antiguo);
    assert.equal(await cargarLocal(), null);
    assert.equal(apartarLocal(), true);
    assert.equal(almacen.get('agram.eje.anterior'), antiguo);
  } finally {
    delete globalThis.localStorage;
  }
});

test('un eje de la versión 2 se migra a la 3 sin tocar sus eventos y se revalida con las reglas nuevas', async () => {
  const { eje } = await ejemploCompra();
  const v2 = JSON.parse(JSON.stringify({ ...serializar(eje), version: 2 }));
  assert.equal(migrar(v2).version, VERSION);
  assert.deepEqual(migrar(v2).eventos, v2.eventos);
  const otro = await restaurar(v2);
  assert.deepEqual(otro.orden, eje.orden);
  // Lo que ya no cumple las reglas de la 3 no se restaura: un génesis firmado por un grupo (VG, 7-11 noche).
  const deGrupo = JSON.parse(JSON.stringify(v2));
  deGrupo.eventos[0].contexto.tipos.casa = 'grupo';
  await assert.rejects(restaurar(deGrupo), /génesis rechazado/);
});
