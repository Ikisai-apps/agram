// Mi cuenta (carta/cuentas.js), lo puro, sin DOM, con el WebCrypto de Node: crear una cuenta es un eje cuyo único
// registro es mi alta (persona, la clave pública en su 5, firmada) y las reglas lo aceptan; exportar y restaurar con
// la frase correcta devuelve el mismo eje y la misma clave; con la frase incorrecta, un error sin pistas; el camino
// de un alta nueva lista el tutorial; y las claves de localStorage de las cuentas no se cruzan con las de los
// ejemplos. Nada real: las claves se generan en cada prueba y no se escriben en ningún archivo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as Q from '../carta/cuentas.js';
import { Eje, autoridad, contrato, acciones, persistencia, EPOCA_0_BTML } from '../src/index.js';
import * as A from '../src/acciones.js';
import * as C from '../src/contrato.js';

const T1 = '2026-11-10T10:00:00Z';
const FRASE = 'una frase larga que solo yo sé';

/** Un localStorage simulado mientras dura la prueba. */
async function conAlmacen(fn) {
  const almacen = new Map();
  globalThis.localStorage = { getItem: (k) => almacen.get(k) ?? null, setItem: (k, v) => almacen.set(k, String(v)), removeItem: (k) => almacen.delete(k) };
  try {
    return await fn(almacen);
  } finally {
    delete globalThis.localStorage;
  }
}

test('crear mi cuenta: un eje con un solo registro, mi alta escrita por mí (persona), con mi clave en su 5, firmada, referenciando la época 0; las reglas lo aceptan', async () => {
  const { cuenta, eje, privada, publica } = await Q.crearCuenta({ nombre: 'Víctor Gil', t: T1 });
  assert.deepEqual([cuenta.nombre, cuenta.identidad, cuenta.idioma], ['Víctor Gil', 'victor-gil', C.configuracion(null).language]);
  assert.equal(eje.orden.length, 1, 'solo mi alta');
  const g = eje.obtener(eje.genesisId);
  assert.deepEqual([cuenta.alta, eje.alta('victor-gil').id, g.autor, g.payload], [g.id, g.id, 'victor-gil', 'Víctor Gil']);
  assert.equal(eje.esPersona('victor-gil'), true, 'escribí mi alta: soy una persona');
  assert.equal(eje.demostracion, false, 'no es un eje de demostración: sin clave no se actúa');
  // La clave pública en el 5 del alta (B4: contexto.claves), igual a la de la cuenta, y la firma de la privada sobre el id.
  assert.deepEqual(g.contexto.claves['victor-gil'], publica);
  assert.deepEqual(eje.clave('victor-gil'), publica);
  assert.equal(g.contexto.epoca, EPOCA_0_BTML.id, 'referencia la época 0');
  assert.equal(await autoridad.verificar(g, publica), true);
  assert.equal(await autoridad.verificar(g, (await autoridad.generarClaves()).publica), false);
  assert.ok(privada && typeof privada === 'object' && !('d' in privada), 'la privada es una CryptoKey, no un JWK');
  // Las reglas lo aceptan tal cual: reconstruir el eje desde sus eventos lo revalida (ids, firmas, saldos).
  const otra = await Eje.desde(persistencia.serializar(eje).eventos);
  assert.deepEqual(otra.orden, eje.orden);
  assert.deepEqual(C.validar(eje, g.id), []);
  // Con ella firmo lo que escribo; sin firmar, la regla «who has a key signs» lo para.
  const tx = await acciones.transaccion(eje, 'anchor here', { X: cuenta.alta, title: 'Mi primer registro' }, 'victor-gil', { t: T1, firmar: Q.firmarCon(privada) });
  assert.equal(tx.ok, true, JSON.stringify(tx.motivos));
  const sin = await acciones.transaccion(eje, 'anchor here', { X: cuenta.alta, title: 'Sin firma' }, 'victor-gil', { t: T1 });
  assert.deepEqual([sin.ok, sin.motivos.map((m) => m.regla)], [false, ['who has a key signs']]);
  // Sin nombre no hay cuenta; un nombre sin letras legibles da la huella de la clave como identidad.
  await assert.rejects(Q.crearCuenta({ nombre: '  ' }), /nombre/);
  assert.equal(Q.identidadDe('Ñandú  Ágil'), 'nandu-agil');
  assert.equal(Q.identidadDe('···', publica), autoridad.huella(publica));
});

test('el idioma es mi configuración: un registro «preferences» en el 9 de mi alta, firmado; con el idioma de la época no se escribe nada', async () => {
  const { cuenta, eje, publica } = await Q.crearCuenta({ nombre: 'Víctor', idioma: 'es', t: T1 });
  assert.equal(eje.orden.length, 2);
  const p = eje.obtener(eje.orden[1]);
  assert.deepEqual([p.autor, p.sobre, p.en, await autoridad.verificar(p, publica)], ['victor', cuenta.alta, '9000000000', true]);
  assert.equal(C.configuracion(eje, 'victor').language, 'es');
  assert.equal(C.configuracion(eje, 'victor').de, p.id);
  assert.equal(cuenta.idioma, 'es');
  const en = await Q.crearCuenta({ nombre: 'Víctor', idioma: C.configuracion(null).language, t: T1 });
  assert.equal(en.eje.orden.length, 1);
  // Los campos que pide crear salen del núcleo: la etiqueta del 0 (la regla corta) y la posición del idioma de la plantilla de preferencias, con los idiomas de la época.
  const campos = Q.camposDelAlta({ idioma: 'es' });
  assert.deepEqual(campos.map((c) => c.nombre), ['nombre', 'idioma']);
  assert.equal(campos[0].etiqueta, C.etiqueta(eje, cuenta.alta, 0, { idioma: 'es' }));
  assert.deepEqual([campos[1].clave, campos[1].opciones, campos[1].valor], ['language', C.idiomas(), 'es']);
  assert.equal(campos[1].etiqueta, C.texto(null, C.claves.parametro('preferences', 'language', 'label'), 'es'));
});

test('exportar y restaurar con la frase correcta devuelve el mismo eje y la misma clave (firma válida); la frase incorrecta o un archivo tocado, un error sin pistas; el archivo no lleva la clave privada en claro', async () => {
  const mia = await Q.crearCuenta({ nombre: 'Víctor', idioma: 'es', t: T1 });
  const primero = await acciones.transaccion(mia.eje, 'anchor here', { X: mia.cuenta.alta, title: 'Mi primer registro' }, 'victor', { t: T1, firmar: Q.firmarCon(mia.privada) });
  await mia.eje.anadir(primero.evento);
  const archivo = await Q.exportarCuenta(mia, FRASE, { t: T1 });
  assert.deepEqual([archivo.formato, archivo.version, archivo.nombre, archivo.idioma, archivo.identidad, archivo.alta, archivo.publica], [Q.FORMATO, Q.VERSION, 'Víctor', 'es', 'victor', mia.cuenta.alta, mia.publica]);
  assert.deepEqual(archivo.eje, persistencia.serializar(mia.eje), 'el eje entero, serializado: una foto');
  assert.deepEqual([archivo.clave.kdf, archivo.clave.cifrado, archivo.clave.iteraciones], [Q.CIFRADO.kdf, Q.CIFRADO.cifrado, Q.CIFRADO.iteraciones]);
  const texto = Q.textoDeArchivo(archivo);
  const jwk = await autoridad.exportarPrivada(mia.privada);
  assert.ok(!texto.includes(jwk.d), 'la parte privada no está en claro');
  assert.ok(!texto.includes('"d":'), 'ningún JWK con parte privada');
  assert.ok(!texto.includes(FRASE), 'la frase no se guarda');
  assert.equal(Q.nombreDeArchivo(mia.cuenta), 'agram-cuenta-victor.json');
  // Restaurar en «otro dispositivo»: desde el texto del archivo.
  const r = await Q.restaurarCuenta(texto, FRASE);
  assert.deepEqual(r.cuenta, mia.cuenta);
  assert.deepEqual(r.eje.orden, mia.eje.orden);
  assert.deepEqual(r.eje.clave('victor'), mia.publica);
  assert.equal(C.configuracion(r.eje, 'victor').language, 'es');
  const tx = await acciones.transaccion(r.eje, 'anchor here', { X: r.cuenta.alta, title: 'Desde el otro dispositivo' }, 'victor', { t: T1, firmar: Q.firmarCon(r.privada) });
  assert.equal(tx.ok, true, JSON.stringify(tx.motivos));
  assert.equal(await autoridad.verificar(tx.evento, mia.publica), true, 'la clave restaurada es la misma: su firma vale con la pública de antes');
  await r.eje.anadir(tx.evento);
  // La frase incorrecta: el mismo motivo que un archivo dañado, sin decir cuál de los dos.
  await assert.rejects(Q.restaurarCuenta(archivo, 'otra frase'), new RegExp(Q.FRASE_INCORRECTA.replace(/[()]/g, '\\$&')));
  await assert.rejects(Q.restaurarCuenta(archivo, ''), new RegExp(Q.FRASE_INCORRECTA.replace(/[()]/g, '\\$&')));
  const tocado = JSON.parse(texto);
  tocado.clave.datos = tocado.clave.datos.slice(0, -4) + (tocado.clave.datos.endsWith('AAAA') ? 'BBBB' : 'AAAA');
  await assert.rejects(Q.restaurarCuenta(tocado, FRASE), new RegExp(Q.FRASE_INCORRECTA.replace(/[()]/g, '\\$&')));
  // El id del alta ata el cifrado: cambiarlo tampoco abre.
  const otroAlta = JSON.parse(texto);
  otroAlta.alta = 'a'.repeat(64);
  await assert.rejects(Q.restaurarCuenta(otroAlta, FRASE), new RegExp(Q.FRASE_INCORRECTA.replace(/[()]/g, '\\$&')));
  // Un eje tocado no pasa la validación normal al restaurar (persistencia.restaurar revalida cada evento).
  const ejeTocado = JSON.parse(texto);
  ejeTocado.eje.eventos[1].payload = ['otra cosa'];
  await assert.rejects(Q.restaurarCuenta(ejeTocado, FRASE));
  // Lo que no es una copia.
  await assert.rejects(Q.restaurarCuenta({ formato: 'otro' }, FRASE), /no es una copia/);
  await assert.rejects(Q.restaurarCuenta({ ...archivo, version: 99 }, FRASE), /versión 99/);
});

test('el camino de mi alta nueva lista el tutorial del 9 de la plantilla de identidad: la clave (ya declarada), los grupos de atención y el primer registro; seguir lo hace hasta donde puede', async () => {
  const { cuenta, eje, privada } = await Q.crearCuenta({ nombre: 'Víctor', idioma: 'es', t: T1 });
  const c = await A.camino(eje, cuenta.alta, 'victor', { t: T1, idioma: 'es' });
  const tutorial = c.pasos.filter((p) => p.fuente === 'tutorial');
  assert.deepEqual(tutorial.map((p) => [p.regla ?? p.hacer.plantilla, p.hecho]), [['a key is declared at its alta', true], ['set a group price', false], ['anchor here', false]]);
  assert.ok(tutorial.every((p) => typeof p.falta === 'string' && p.falta.length), 'cada paso dice en humano qué falta');
  // Seguir: pone el precio de mi primer grupo (firmado) y se para en el primer registro, que pide un título.
  const auto = await A.autoejecutar(eje, cuenta.alta, 'victor', Q.firmarCon(privada), { t: T1 });
  assert.deepEqual([auto.hechos.map((h) => h.paso.hacer.plantilla), auto.parado.paso.hacer.plantilla, auto.parado.motivos.map((m) => m.regla)], [['set a group price'], 'anchor here', ['title']]);
  assert.equal(await autoridad.verificar(auto.hechos[0].evento, eje.clave('victor')), true);
  const r = await A.transaccion(eje, 'anchor here', { X: cuenta.alta, title: 'Mi primer registro' }, 'victor', { t: T1, firmar: Q.firmarCon(privada) });
  await eje.anadir(r.evento);
  assert.deepEqual((await A.camino(eje, cuenta.alta, 'victor', { t: T1 })).pasos.filter((p) => p.fuente === 'tutorial').map((p) => p.hecho), [true, true, true]);
});

test('guardar, listar, abrir y olvidar cuentas en un localStorage simulado; las claves de las cuentas no se cruzan con las de los ejemplos', async () => {
  await conAlmacen(async (almacen) => {
    const mia = await Q.crearCuenta({ nombre: 'Víctor', idioma: 'es', t: T1 });
    assert.deepEqual([Q.cuentas(), Q.ultima()], [[], null]);
    assert.equal(await Q.guardarCuenta(mia), true);
    assert.deepEqual(Q.cuentas(), [{ nombre: 'Víctor', idioma: 'es', identidad: 'victor', alta: mia.cuenta.alta, publica: mia.publica }]);
    assert.equal(Q.ultima(), mia.cuenta.alta);
    // La clave privada se guarda como JWK exportado (como las de ejemplo en agram.claves), nunca en texto plano fuera del navegador.
    const jwk = JSON.parse(almacen.get(Q.CLAVES.clave(mia.cuenta.alta)));
    assert.deepEqual([jwk.kty, jwk.crv, typeof jwk.d], ['EC', 'P-256', 'string']);
    // Abrir: el eje revalidado y la clave importada; firma como antes.
    const abierta = await Q.abrirCuenta(mia.cuenta.alta);
    assert.deepEqual([abierta.motivo, abierta.cuenta, abierta.eje.orden], [undefined, mia.cuenta, mia.eje.orden]);
    const tx = await acciones.transaccion(abierta.eje, 'anchor here', { X: mia.cuenta.alta, title: 'Primero' }, 'victor', { t: T1, firmar: Q.firmarCon(abierta.privada) });
    assert.equal(await autoridad.verificar(tx.evento, mia.publica), true);
    await abierta.eje.anadir(tx.evento);
    assert.equal(Q.guardarEje(abierta.cuenta, abierta.eje), true);
    assert.equal((await Q.abrirCuenta(mia.cuenta.alta)).eje.orden.length, 3, 'mi alta, mi configuración y el registro nuevo');
    // Una cuenta cuyo eje no declara su clave no se abre.
    const ajena = await Q.crearCuenta({ nombre: 'Otra', t: T1 });
    almacen.set(Q.CLAVES.eje(mia.cuenta.alta), JSON.stringify(persistencia.serializar(ajena.eje)));
    assert.match((await Q.abrirCuenta(mia.cuenta.alta)).motivo, /no declara la clave/);
    assert.match((await Q.abrirCuenta('x'.repeat(64))).motivo, /ninguna cuenta/);
    // Olvidar: nada queda de ella en el almacén.
    Q.olvidarCuenta(mia.cuenta.alta, ['victor']);
    assert.deepEqual([Q.cuentas(), Q.ultima()], [[], null]);
    assert.ok([...almacen.keys()].every((k) => !k.includes(mia.cuenta.alta)));
    // El mapeo de claves: las de una cuenta y las de los ejemplos son conjuntos disjuntos, también los libros locales
    // de una identidad que se llame como una de ejemplo.
    const deCuenta = Q.clavesDe({ ...mia.cuenta, identidad: 'huesped' }, ['huesped', 'victor']);
    const deEjemplo = [CLAVES_EJEMPLO_PLANAS(), Q.CLAVES_EJEMPLO.local('huesped'), Q.CLAVES_EJEMPLO.local('victor')].flat();
    assert.ok(deCuenta.every((k) => !deEjemplo.includes(k)), JSON.stringify({ deCuenta, deEjemplo }));
    assert.ok(deCuenta.every((k) => k.startsWith('agram.')));
    // Sin almacenamiento, nada se guarda y nada se rompe.
    delete globalThis.localStorage;
    assert.equal(await Q.guardarCuenta(mia), false);
    assert.deepEqual(Q.cuentas(), []);
  });
});

/** Las claves fijas de los ejemplos (sin las funciones). */
const CLAVES_EJEMPLO_PLANAS = () => Object.values(Q.CLAVES_EJEMPLO).filter((v) => typeof v === 'string');

test('las claves de los ejemplos que usa la carta son las de cuentas.js (un solo sitio), y cuentas.js no lleva palabras de la época', () => {
  const app = readFileSync(new URL('../carta/app.js', import.meta.url), 'utf8');
  for (const k of CLAVES_EJEMPLO_PLANAS()) assert.ok(!new RegExp("'" + k.replace('.', '\\.') + "'").test(app), 'carta/app.js escribe «' + k + '» en vez de usar CLAVES_EJEMPLO');
  const fuente = readFileSync(new URL('../carta/cuentas.js', import.meta.url), 'utf8');
  const literales = new Set([...fuente.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1]));
  const raiz = EPOCA_0_BTML.registro;
  const palabras = [
    ...raiz[5][0].map((r) => r[0][0]), ...C.niveles(), ...C.plantillas(null).flatMap((p) => [p.nombre, ...p.registro.filter(Array.isArray).map((d) => d[0]?.[0]).filter((x) => typeof x === 'string')]),
    ...A.plantillasDeTransaccion().map((p) => p.nombre), ...C.idiomas(),
  ];
  for (const p of palabras) assert.ok(!literales.has(p), 'carta/cuentas.js lleva escrito «' + p + '»');
  void contrato;
});
