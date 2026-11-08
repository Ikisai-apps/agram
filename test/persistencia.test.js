import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejemploCompra, ejemploCuenta } from '../ejemplos/ikisai/compra-food.mjs';
import { serializar, restaurar, guardarLocal, cargarLocal, borrarLocal, apartarLocal, migrar, VERSION } from '../src/persistencia.js';
import { Eje } from '../src/eje.js';
import { crearEvento } from '../src/evento.js';
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

test('un eje de la versión 2 se migra a la 3 sin tocar sus eventos: se revalidan con las reglas de la 2', async () => {
  // Un eje que la versión 2 podía guardar: en ella no había T acuñado al gastarse (VG, 7-11 noche), así que solo
  // escribe quien tiene T, la casa (el ejemplo de la compra ya no cabe: cocina escribe con su propio T).
  const t = '2026-11-07T09:00:00Z';
  const eje = await Eje.genesis({ demostracion: true, identidad: 'casa', tipo: 'persona', t, foco: 'Casa de ejemplo',
    emision: [{ token: 'E', denominacion: 'EUR', cantidad: 50 }] });
  const gasta = { token: 'T', escala: 'minuto', cantidad: 1, de: 'casa', a: null };
  const alta = await eje.escribir({ autor: 'casa', sobre: eje.genesisId, t, payload: ['Altas', ['huesped']], contexto: { tipos: { huesped: 'persona' } },
    movimientos: [gasta, { token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 10, de: 'casa', a: 'huesped' }] });
  await eje.escribir({ autor: 'casa', sobre: alta.id, t, payload: ['Menú del día', ['ensalada', 'guiso']], movimientos: [{ ...gasta, cantidad: 3 }] });
  // El génesis de la versión 2 emitía T a su autor (hoy no: VG, 8-11, no hay T acumulable): se escribe a mano, con
  // los mismos eventos de después.
  const emitir = (m) => ({ ...m, de: null, a: 'casa' });
  const g2 = await crearEvento({ autor: 'casa', sobre: null, t, payload: 'Casa de ejemplo', contexto: { genesis: true, demostracion: true, tipos: { casa: 'persona' } },
    movimientos: [emitir({ token: 'T', escala: 'minuto', cantidad: 100 }), emitir({ token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 50 })] });
  const alta2 = await crearEvento({ ...eje.obtener(alta.id), sobre: g2.id });
  const menu2 = await crearEvento({ ...eje.obtener(eje.orden[2]), sobre: alta2.id });
  const v2 = JSON.parse(JSON.stringify({ version: 2, exigirFirmas: false, eventos: [g2, alta2, menu2] }));
  assert.equal(migrar(v2).version, VERSION);
  assert.deepEqual(migrar(v2).eventos, v2.eventos);
  // La migración no es trivial: todos sus eventos se marcan como de la versión 2 y se validan con aquellas reglas;
  // las nuevas rigen lo que se añada después (lo que solo admitía la 2 está en test/ciclo-eprt.test.js).
  // La marca la pone solo migrar: cuántos eventos y el id del último, que restaurar comprueba.
  const marca = { eventos: v2.eventos.length, ultimo: v2.eventos[v2.eventos.length - 1].id };
  assert.deepEqual(migrar(v2).v2, marca);
  assert.equal(migrar({ ...v2, eventosV2: 1, v2: { eventos: 1, ultimo: 'x' } }).v2.eventos, v2.eventos.length); // lo que traiga, se descarta
  const otro = await restaurar(v2);
  assert.deepEqual(otro.orden, [g2.id, alta2.id, menu2.id]);
  assert.equal(otro.eventosV2, v2.eventos.length);
  assert.deepEqual(serializar(otro).v2, marca); // al volver a guardar se conserva
  assert.equal(serializar(eje).v2, undefined); // un eje de la 3 no la lleva
  // Revisión de seguridad: un guardado de la 3 no declara eventosV2, y una marca que no corresponde se rechaza.
  const v3 = migrar(v2);
  await assert.rejects(restaurar({ ...v3, eventosV2: 2 }), /eventosV2 no se declara en un guardado/);
  await assert.rejects(restaurar({ ...v3, v2: { eventos: 2, ultimo: marca.ultimo } }), /la marca de la versión 2 no corresponde a sus eventos/);
  await assert.rejects(restaurar({ ...v3, v2: { eventos: v2.eventos.length + 1, ultimo: marca.ultimo } }), /no corresponde/);
  await assert.rejects(restaurar({ ...v3, v2: { eventos: 0, ultimo: marca.ultimo } }), /no corresponde/);
  // Un evento manipulado no se restaura con ninguna de las dos reglas.
  const tocado = JSON.parse(JSON.stringify(v2));
  tocado.eventos[0].contexto.tipos.casa = 'grupo';
  await assert.rejects(restaurar(tocado), /génesis rechazado: id del génesis no corresponde/);
});
