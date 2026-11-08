import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Eje } from '../src/eje.js';
import { crearEvento } from '../src/evento.js';
import { generarClaves, firmar, verificar, exportarPrivada, importarPrivada } from '../src/autoridad.js';

const T0 = '2026-11-06T20:00:00Z';
const gastaT = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });

test('firmar y verificar un evento; el id no cambia con la firma', async () => {
  const { publica, privada } = await generarClaves();
  const ev = await crearEvento({ autor: 'ana', sobre: 'g', t: T0, movimientos: [gastaT('ana')], payload: 'hola' });
  const f = await firmar(ev, privada);
  assert.equal(f.id, ev.id);
  assert.equal(f.firmante, 'ana');
  assert.equal(await verificar(f, publica), true);
  const otra = await generarClaves();
  assert.equal(await verificar(f, otra.publica), false);
  assert.equal(await verificar(ev, publica), false);
});

test('génesis con clave: el autor debe firmar; sin firma se rechaza', async () => {
  const { publica, privada } = await generarClaves();
  const eje = await Eje.genesis({ demostracion: true, identidad: 'raiz', emision: [{ token: 'E', denominacion: 'minuto', cantidad: 600 }], foco: 'g', t: T0, clave: publica, privada });
  assert.deepEqual(eje.clave('raiz'), publica);
  await assert.rejects(eje.escribir({ autor: 'raiz', sobre: eje.genesisId, t: T0, movimientos: [gastaT('raiz')], payload: 'sin firma' }), /firma ausente de raiz/);
  const ev = await eje.escribir({ autor: 'raiz', sobre: eje.genesisId, t: T0, movimientos: [gastaT('raiz')], payload: 'firmado' }, privada);
  assert.equal(ev.firmante, 'raiz');
  const ajena = await generarClaves();
  await assert.rejects(eje.escribir({ autor: 'raiz', sobre: eje.genesisId, t: T0, movimientos: [gastaT('raiz')], payload: 'otra clave' }, ajena.privada), /firma inválida/);
});

test('nadie mueve tokens ajenos', async () => {
  const eje = await Eje.genesis({ demostracion: true, identidad: 'raiz', emision: [{ token: 'E', denominacion: 'minuto', cantidad: 600 }], foco: 'g', t: T0 });
  await eje.escribir({ autor: 'raiz', sobre: eje.genesisId, t: T0, movimientos: [gastaT('raiz'), { token: 'E', emisor: 'raiz', denominacion: 'minuto', cantidad: 1, de: 'raiz', a: 'bea' }], payload: 'alta' });
  await assert.rejects(
    eje.escribir({ autor: 'bea', sobre: eje.genesisId, t: T0, movimientos: [gastaT('bea'), { token: 'E', emisor: 'raiz', denominacion: 'minuto', cantidad: 1, de: 'raiz', a: 'bea' }], payload: 'robo' }),
    /nadie mueve tokens ajenos/,
  );
});

test('una identidad nueva nace con clave si quien la da de alta la declara; luego debe firmar', async () => {
  const raiz = await generarClaves();
  const bea = await generarClaves();
  const eje = await Eje.genesis({ demostracion: true, identidad: 'raiz', emision: [{ token: 'E', denominacion: 'minuto', cantidad: 600 }], foco: 'g', t: T0, clave: raiz.publica, privada: raiz.privada });
  await eje.escribir({ autor: 'raiz', sobre: eje.genesisId, t: T0, movimientos: [gastaT('raiz'), { token: 'E', emisor: 'raiz', denominacion: 'minuto', cantidad: 2, de: 'raiz', a: 'bea' }], payload: 'alta de bea', contexto: { tipos: { bea: 'persona' }, claves: { bea: bea.publica } } }, raiz.privada); // una persona: escribe con su T (Core, 8-11)
  assert.deepEqual(eje.clave('bea'), bea.publica);
  await assert.rejects(eje.escribir({ autor: 'bea', sobre: eje.genesisId, t: T0, movimientos: [gastaT('bea')], payload: 'x' }), /firma/);
  const ok = await eje.escribir({ autor: 'bea', sobre: eje.genesisId, t: T0, movimientos: [gastaT('bea')], payload: 'x' }, bea.privada);
  assert.equal(ok.autor, 'bea');
  // No se puede cambiar una clave ya registrada, ni declarar una clave sin dar tokens.
  const otra = await generarClaves();
  await assert.rejects(eje.escribir({ autor: 'raiz', sobre: eje.genesisId, t: T0, movimientos: [gastaT('raiz')], payload: 'cambio', contexto: { claves: { bea: otra.publica } } }, raiz.privada), /no se puede cambiar la clave/);
  await assert.rejects(eje.escribir({ autor: 'raiz', sobre: eje.genesisId, t: T0, movimientos: [gastaT('raiz')], payload: 'sin tokens', contexto: { claves: { cris: otra.publica } } }, raiz.privada), /sin darle tokens/);
});

test('exigirFirmas: todo autor necesita clave; el génesis debe ir firmado', async () => {
  await assert.rejects(Eje.genesis({ demostracion: true, identidad: 'raiz', emision: [], foco: 'g', t: T0, exigirFirmas: true }), /firmado/);
  const raiz = await generarClaves();
  const eje = await Eje.genesis({ demostracion: true, identidad: 'raiz', emision: [{ token: 'E', denominacion: 'minuto', cantidad: 600 }], foco: 'g', t: T0, clave: raiz.publica, privada: raiz.privada, exigirFirmas: true });
  await eje.escribir({ autor: 'raiz', sobre: eje.genesisId, t: T0, movimientos: [gastaT('raiz'), { token: 'E', emisor: 'raiz', denominacion: 'minuto', cantidad: 1, de: 'raiz', a: 'bea' }], payload: 'alta sin clave' }, raiz.privada);
  await assert.rejects(eje.escribir({ autor: 'bea', sobre: eje.genesisId, t: T0, movimientos: [gastaT('bea')], payload: 'x' }), /autor sin clave/);
});

test('la clave privada se exporta e importa (para guardarla en local)', async () => {
  const { publica, privada } = await generarClaves();
  const jwk = await exportarPrivada(privada);
  const otraVez = await importarPrivada(jwk);
  const ev = await crearEvento({ autor: 'ana', sobre: 'g', t: T0, movimientos: [gastaT('ana')], payload: 'hola' });
  assert.equal(await verificar(await firmar(ev, otraVez), publica), true);
});
