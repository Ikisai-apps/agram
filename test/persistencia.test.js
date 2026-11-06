import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejemploCompra, ejemploCuenta } from '../ejemplos/ikisai/compra-food.mjs';
import { serializar, restaurar, guardarLocal, cargarLocal, borrarLocal } from '../src/persistencia.js';
import { generarClaves } from '../src/autoridad.js';
import { evaluar } from '../src/bql.js';

test('serializar y restaurar reconstruye el eje validando todo', async () => {
  const { eje, compra } = await ejemploCompra();
  await ejemploCuenta(eje, compra);
  const datos = JSON.parse(JSON.stringify(serializar(eje)));
  assert.equal(datos.version, 1);
  assert.equal(datos.eventos.length, 5);
  const otro = await restaurar(datos);
  assert.deepEqual(otro.orden, eje.orden);
  assert.equal(otro.saldo('cocina', 'E:EUR'), 12);
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
  } finally {
    delete globalThis.localStorage;
  }
});
