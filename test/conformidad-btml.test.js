// Conformidad BTML: pruebas escritas DESDE LA ESPECIFICACIÓN (corpus V4,
// trazabilidad, herencia V3 y MAPA_GLOBAL_AGRAM §2.1, §8, §9–§12), no desde el
// código. Cada prueba corresponde a una regla con fuerza «decidido» o
// «acuerdo», con su id. Lo que el código no cumple todavía está igualmente
// escrito, en { skip } con su id y el motivo; no se maquilla. Cuando una regla
// se cumple en parte, la parte cumplida es la prueba «NN» y la que falta es
// «NNb» (skip). Las reglas con fuerza «propuesta» o «abierto» van en el bloque
// comentado del final, con su id, para que nadie las convierta en regla por
// accidente.
//
// La serie BTML trae, además de BTML-nn, dos reglas TOK-nn y tres MOT-nn
// propias del área BTML. Como esos números se repiten en la serie del motor y
// en la de tokens (test/conformidad-motor.test.js), aquí llevan el prefijo «B:»:
//   B:TOK-01, B:TOK-02 (BTML · evento) y B:MOT-01…B:MOT-03 (BTML · encaje).
//
// Ejes pequeños con Eje.genesis + escribir; datos inventados; los ids nacen al
// escribir. El génesis emite T en minutos (la escala que se gasta al escribir),
// para que las pruebas no dependan de convertir unas escalas en otras.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Eje } from '../src/eje.js';
import { crearEvento, validarForma, RAIZ } from '../src/evento.js';
import { validarPayload, esDireccion, esTerminal, direccion, indicesDe, resolver, ARIDAD } from '../src/btml.js';
import { ocupantes, seguir, arbol, colisiones, caminosDe, vector, acuerdo, signo, ordenarPorEncaje } from '../src/encaje.js';
import { evaluar, consultar } from '../src/bql.js';
import { descubrir, consolidar, autorizar, estadoDe, FABRICA } from '../src/motor.js';
import { desdeMapped } from '../src/escritura.js';
import { EPOCA_0, PV, leerDireccion } from '../src/epocas.js';
import { decupla } from '../src/pointed.js';
import { mapa } from '../src/mapped.js';
import { lectura, MODOS } from '../src/modos.js';
import { serializar, restaurar } from '../src/persistencia.js';
import { generarClaves, firmar, verificar } from '../src/autoridad.js';

const T0 = '2026-11-07T10:00:00Z';
const EMISION = [{ token: 'T', escala: 'minuto', cantidad: 600 }, { token: 'P', cantidad: 5, ambito: 'genesis' }];
const gastaT = (de, cantidad = 1) => ({ token: 'T', escala: 'minuto', cantidad, de, a: null });
const daT = (de, a, cantidad) => ({ token: 'T', escala: 'minuto', cantidad, de, a });
const ID_INEXISTENTE = 'f'.repeat(64); // bien formado, pero no está en el eje

/** Un eje mínimo: la raíz tiene tiempo (minutos) y poder sobre todo el eje; su foco es el payload dado. */
async function ejeCon(foco) {
  const eje = await Eje.genesis({ identidad: 'raiz', emision: EMISION, foco, t: T0 });
  return { eje, id: eje.genesisId };
}

/** Escribe un registro sobre otro, opcionalmente anclado en una dirección. */
const escribe = (eje, sobre, payload, en, autor = 'raiz', t = T0) =>
  eje.escribir({ autor, sobre, en, t, movimientos: [gastaT(autor)], payload });

/** Da de alta una identidad: la raíz le da minutos de T. */
const alta = (eje, quien, minutos = 60) =>
  eje.escribir({ autor: 'raiz', sobre: eje.genesisId, t: T0, movimientos: [gastaT('raiz'), daT('raiz', quien, minutos)], payload: 'alta de ' + quien });

/** Payload mínimo donde existe el camino `indices`: en cada nivel, relleno real hasta el índice y el siguiente nodo en él. */
const conCamino = (indices, hoja) => indices.reduceRight((hijo, i) => [...Array.from({ length: i }, (_, k) => 'r' + k), hijo], hoja);

/** Resumen comparable del árbol lógico: por dirección, los ocupantes con su origen, evento y camino. */
const resumenArbol = (eje, id) => [...arbol(eje, id).entries()].map(([d, oc]) => [d, oc.map((o) => [o.origen, o.evento, (o.camino ?? []).join('.')])]);

/** Huella del eje (registros y saldos) para comprobar que algo no tiene efectos. */
const huella = (eje) => JSON.stringify([eje.orden, [...eje.saldos].map(([k, v]) => [k, [...v]])]);

/**
 * Cuerpo de una prueba en skip cuya regla aún no tiene forma observable en el
 * código (ni función ni dato que mirar). Falla a propósito: quitar el skip sin
 * escribir la prueba no puede dar un verde vacío.
 */
const sinForma = (id) => () => assert.fail(id + ': la regla aún no tiene forma observable; escribir la prueba al implementarla');

// =====================================================================
// BTML · evento
// =====================================================================

test('BTML-01 la unidad de información es el evento (identidad, firmante, contexto) con payload BTML; todo lo demás se deriva', async () => {
  const { eje, id } = await ejeCon(['Casa', 'recurso']);
  const ev = await eje.escribir({ autor: 'raiz', sobre: id, en: '1000000000', t: T0, movimientos: [gastaT('raiz')], payload: ['Nota', 'hola'], contexto: { nota: 'x' } });
  assert.match(ev.id, /^[0-9a-f]{64}$/);
  assert.equal(ev.autor, 'raiz');
  assert.deepEqual(ev.contexto, { nota: 'x' });
  assert.equal(validarPayload(ev.payload).ok, true);
  // Lo que se guarda son los eventos; árbol, hilos y saldos se derivan de ellos al reconstruir.
  const datos = JSON.parse(JSON.stringify(serializar(eje)));
  assert.deepEqual(Object.keys(datos).sort(), ['eventos', 'exigirFirmas', 'version']);
  const otro = await restaurar(datos);
  assert.deepEqual(resumenArbol(otro, id), resumenArbol(eje, id));
  assert.deepEqual(otro.hilo(ev.id).map((e) => e.id), eje.hilo(ev.id).map((e) => e.id));
  assert.equal(huella(otro), huella(eje));
});

test('BTML-02 el evento tiene identidad y metadatos propios (firmante, contexto) separados de un payload libre', async () => {
  const { publica, privada } = await generarClaves();
  const eje = await Eje.genesis({ identidad: 'raiz', emision: EMISION, foco: 'Casa', t: T0, clave: publica, privada });
  // Un payload que «dice» ser metadatos no los cambia: el payload es libre.
  const ev = await eje.escribir({ autor: 'raiz', sobre: eje.genesisId, t: T0, movimientos: [gastaT('raiz')], payload: ['autor: mallory', 'firmante: nadie', { ref: eje.genesisId }], contexto: { nota: 'metadato' } }, privada);
  assert.equal(ev.autor, 'raiz');
  assert.equal(ev.firmante, 'raiz');
  assert.equal(await verificar(ev, publica), true);
  assert.deepEqual(ev.contexto, { nota: 'metadato' });
  assert.equal(ev.payload[0], 'autor: mallory');
  // La identidad cubre metadatos y payload: otro contexto con el mismo payload es otro evento.
  const otro = await crearEvento({ autor: ev.autor, sobre: ev.sobre, en: ev.en, t: ev.t, movimientos: ev.movimientos, payload: ev.payload, contexto: { nota: 'otra' } });
  assert.notEqual(otro.id, ev.id);
});

test('BTML-02b el evento lleva un metadato propio de autoridad cuando aplica', async () => {
  const { eje, id } = await ejeCon(['Casa', 'recurso']);
  await alta(eje, 'ana');
  const c = await consolidar(eje, { autor: 'ana', foco: id, t: T0, elecciones: { 1: 'algo' } });
  const a = await autorizar(eje, { autorizante: 'raiz', consolidacion: c.id, t: T0 });
  assert.ok(a.autoridad ?? a.contexto.autoridad);
  // En los metadatos, no en el payload: la regla y el P que bloquea (VG, 7-11 noche: autorizar = bloquear P).
  assert.deepEqual(a.contexto.autoridad.bloquea, [{ clave: 'P:genesis', cantidad: 5 }]);
  assert.equal(JSON.stringify(a.payload).includes('genesis'), false);
  // Donde no aplica, no aparece: ni en un registro cualquiera ni en la consolidación.
  assert.equal(c.contexto.autoridad, undefined);
  assert.equal((await escribe(eje, id, 'nota')).contexto.autoridad, undefined);
});

test('BTML-03 el id del evento no es su dirección; una parte concreta se nombra con id + dirección interna', async () => {
  const { eje, id } = await ejeCon(['Casa']);
  const a = await escribe(eje, id, ['A', ['a cero', 'a uno']], '1000000000');
  const b = await escribe(eje, id, ['B', ['b cero', 'b uno']], '1000000000');
  assert.equal(a.en, b.en); // la misma dirección de anclaje…
  assert.notEqual(a.id, b.id); // …y dos identidades
  assert.equal(esDireccion(a.id), false);
  // La misma dirección interna nombra partes distintas en cada evento: hacen falta los dos.
  assert.equal(resolver(a.payload, '1100000000'), 'a uno');
  assert.equal(resolver(b.payload, '1100000000'), 'b uno');
  const lector = await escribe(eje, id, ['L', { ref: a.id }, { ref: a.id, dir: '1100000000' }, '=LOCAL(1)', '=LOCAL(2)']);
  assert.equal(evaluar(eje, lector.id, [3]).valor.tipo, 'array'); // solo el id: el evento entero
  assert.equal(evaluar(eje, lector.id, [4]).texto, 'a uno'); // id + dirección: la parte
});

test('BTML-04 la época no es atributo del dato: el evento no la lleva y se interpreta bajo la época elegida desde fuera', async () => {
  const { eje, id } = await ejeCon(['Casa']);
  const ev = await escribe(eje, id, ['Nota', 'x'], '4000000000');
  assert.equal('epoca' in ev, false);
  assert.equal('epoca' in ev.contexto, false);
  // Aunque se intente, la época no entra en el evento.
  const conEpoca = await crearEvento({ autor: 'raiz', sobre: id, t: T0, movimientos: [gastaT('raiz')], payload: 'x', epoca: 'época 7' });
  assert.equal(conEpoca.epoca, undefined);
  // El mismo dato, leído desde dos épocas, dice dos cosas; el dato no cambia.
  const otra = { nombre: 'otra', reglaCorta: (p, d) => 'otra ' + p + '.' + d };
  assert.equal(leerDireccion(ev.en)[0].significado, 'fábrica');
  assert.equal(leerDireccion(ev.en, otra)[0].significado, 'otra 0.4');
  assert.equal(decupla(ev, otra).posiciones[1].significado, 'otra 0.1');
  assert.equal(eje.obtener(ev.id), ev);
});

test('B:TOK-01 todo evento es una transición de tokens con el payload encima: no hay evento sin movimiento', async () => {
  const { eje, id } = await ejeCon(['Casa']);
  await assert.rejects(crearEvento({ autor: 'raiz', sobre: id, t: T0, movimientos: [], payload: 'quieto' }), /todo evento mueve tokens/);
  await assert.rejects(eje.escribir({ autor: 'raiz', sobre: id, t: T0, movimientos: [], payload: 'quieto' }), /todo evento mueve tokens/);
  const ev = await escribe(eje, id, 'mínimo');
  assert.ok(ev.movimientos.length >= 1);
});

test('B:TOK-02 el evento más pequeño mueve T; E, P y R entran solo cuando el evento los toca', async () => {
  const eje = await Eje.genesis({ identidad: 'raiz', emision: [...EMISION, { token: 'E', denominacion: 'EUR', cantidad: 100 }], foco: 'Casa', t: T0 });
  const g = eje.genesisId;
  await alta(eje, 'ana');
  // Sin T no hay evento, aunque mueva E.
  await assert.rejects(eje.escribir({ autor: 'raiz', sobre: g, t: T0, movimientos: [{ token: 'E', emisor: 'raiz', denominacion: 'EUR', cantidad: 5, de: 'raiz', a: 'ana' }], payload: 'pago' }), /el autor debe mover T/);
  // Solo T: válido, y no toca E, P ni R.
  const minimo = await escribe(eje, g, 'nota');
  assert.deepEqual(minimo.movimientos.map((m) => m.token), ['T']);
  assert.equal(eje.saldo('raiz', 'E:raiz/EUR'), 100);
  // T y E cuando el evento toca E.
  const pago = await eje.escribir({ autor: 'raiz', sobre: g, t: T0, movimientos: [gastaT('raiz'), { token: 'E', emisor: 'raiz', denominacion: 'EUR', cantidad: 5, de: 'raiz', a: 'ana' }], payload: 'pago' });
  assert.deepEqual(pago.movimientos.map((m) => m.token), ['T', 'E']);
  assert.equal(eje.saldo('ana', 'E:raiz/EUR'), 5);
});

test('BTML-05 el génesis emite los tokens iniciales a la primera identidad bajo la época 0, fija un foco raíz y es el único evento sin foco', async () => {
  const { eje, id } = await ejeCon(['Raíz', 'recursos']);
  const g = eje.obtener(id);
  assert.equal(g.sobre, null);
  assert.equal(g.en, RAIZ);
  assert.equal(g.contexto.genesis, true);
  assert.ok(g.movimientos.length > 0);
  assert.ok(g.movimientos.every((m) => m.de === null && m.a === 'raiz'));
  assert.deepEqual(g.payload, ['Raíz', 'recursos']);
  // La lectura por defecto es la regla corta de la época 0: dígito = PV.
  assert.equal(leerDireccion('1000000000')[0].significado, PV[1]);
  assert.equal(decupla(g).posiciones[1].significado, PV[1]);
  // Ningún otro evento carece de foco, y no hay un segundo génesis.
  await assert.rejects(eje.escribir({ autor: 'raiz', sobre: null, t: T0, movimientos: [gastaT('raiz')], payload: 'otro' }), /solo el génesis carece de foco/);
  const otroGenesis = await crearEvento({ autor: 'raiz', sobre: null, t: T0, movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: null, a: 'raiz' }], payload: 'x', contexto: { genesis: true } });
  await assert.rejects(eje.anadir(otroGenesis), /ya hay génesis/);
  // El génesis se anida solo en la raíz.
  await assert.rejects(crearEvento({ autor: 'raiz', sobre: null, en: '4000000000', t: T0, movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: null, a: 'raiz' }], payload: 'x', contexto: { genesis: true } }), /el génesis solo se anida en la raíz/);
});

test('BTML-06 firma quien tiene clave y el eje verifica; el firmante es el autor; la clave nueva se declara al dar tokens; nadie mueve tokens ajenos', async () => {
  const raiz = await generarClaves();
  const ana = await generarClaves();
  const eje = await Eje.genesis({ identidad: 'raiz', emision: EMISION, foco: 'Casa', t: T0, clave: raiz.publica, privada: raiz.privada });
  const g = eje.genesisId;
  // La clave de ana la declara raiz en el mismo evento que le da tokens.
  await assert.rejects(eje.escribir({ autor: 'raiz', sobre: g, t: T0, movimientos: [gastaT('raiz')], payload: 'clave sin tokens', contexto: { claves: { ana: ana.publica } } }, raiz.privada), /sin darle tokens/);
  await eje.escribir({ autor: 'raiz', sobre: g, t: T0, movimientos: [gastaT('raiz'), daT('raiz', 'ana', 30)], payload: 'alta de ana', contexto: { claves: { ana: ana.publica } } }, raiz.privada);
  assert.deepEqual(eje.clave('ana'), ana.publica);
  // Quien tiene clave firma; el firmante es el autor; el eje verifica.
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: g, t: T0, movimientos: [gastaT('ana')], payload: 'sin firma' }), /firma ausente de ana/);
  const ev = await crearEvento({ autor: 'ana', sobre: g, t: T0, movimientos: [gastaT('ana')], payload: 'mensaje de ana' });
  await assert.rejects(eje.anadir(await firmar(ev, raiz.privada, 'raiz')), /el firmante debe ser el autor/);
  await assert.rejects(eje.anadir(await firmar(ev, raiz.privada)), /firma inválida de ana/);
  const bueno = await eje.anadir(await firmar(ev, ana.privada));
  assert.equal(bueno.firmante, bueno.autor);
  // Nadie mueve tokens ajenos, ni firmando.
  await assert.rejects(eje.escribir({ autor: 'ana', sobre: g, t: T0, movimientos: [gastaT('ana'), daT('raiz', 'ana', 1)], payload: 'robo' }, ana.privada), /nadie mueve tokens ajenos/);
});

test('BTML-07 forma, interpretación, firma y autorización son comprobaciones distintas: firmar no hace verdadero ni validar autoriza', async () => {
  const raiz = await generarClaves();
  const bea = await generarClaves();
  const eje = await Eje.genesis({ identidad: 'raiz', emision: EMISION, foco: ['Casa', 'recurso'], t: T0, clave: raiz.publica, privada: raiz.privada });
  const g = eje.genesisId;
  await eje.escribir({ autor: 'raiz', sobre: g, t: T0, movimientos: [gastaT('raiz'), daT('raiz', 'ana', 30), daT('raiz', 'bea', 30)], payload: 'altas', contexto: { claves: { bea: bea.publica } } }, raiz.privada);
  // Forma válida no es admisión: un evento bien formado sobre un foco que no existe no entra.
  const huerfano = await firmar(await crearEvento({ autor: 'raiz', sobre: ID_INEXISTENTE, t: T0, movimientos: [gastaT('raiz')], payload: 'x' }), raiz.privada);
  assert.deepEqual(validarForma(huerfano), []);
  await assert.rejects(eje.anadir(huerfano), /foco desconocido/);
  // Firma no es veracidad: lo firmado entra tal cual; interpretarlo es otra comprobación.
  const dicho = await eje.escribir({ autor: 'raiz', sobre: g, t: T0, movimientos: [gastaT('raiz')], payload: ['Afirmo', '2 + 2 = 5', '=2 + 2', '=LOCAL(9)'] }, raiz.privada);
  assert.equal(await verificar(dicho, raiz.publica), true);
  assert.equal(evaluar(eje, dicho.id, [1]).texto, '2 + 2 = 5');
  assert.equal(evaluar(eje, dicho.id, [2]).texto, '4');
  assert.equal(evaluar(eje, dicho.id, [3]).estado, 'PENDIENTE'); // bien formado y firmado, interpretación insuficiente
  // Ni forma ni firma autorizan: una «autorización» firmada por quien no puede no cambia el estado.
  const c = await consolidar(eje, { autor: 'ana', foco: g, t: T0, elecciones: { 1: 'algo' } });
  const falsa = await eje.escribir({ autor: 'bea', sobre: c.id, en: FABRICA, t: T0, movimientos: [gastaT('bea')], payload: '==autorizo', contexto: { fase: 'autorizado' } }, bea.privada);
  assert.equal(await verificar(falsa, bea.publica), true);
  assert.equal(estadoDe(eje, c.id), 'PENDIENTE DE AUTORIZACIÓN');
});

// =====================================================================
// BTML · terminales y arrays
// =====================================================================

test('BTML-08 el payload es un terminal o un array de hasta diez posiciones (terminal, array o referencia); un terminal no se envuelve', async () => {
  for (const ok of ['palabra', 42, { ref: 'a'.repeat(64) }, ['a', ['b', 2], { ref: 'a'.repeat(64), dir: '1200000000' }], Array.from({ length: 10 }, (_, i) => i)]) {
    assert.equal(validarPayload(ok).ok, true, JSON.stringify(ok));
  }
  assert.equal(validarPayload(Array.from({ length: 11 }, (_, i) => i)).ok, false);
  assert.equal(validarPayload({ libre: 'objeto' }).ok, false); // ni terminal ni array
  assert.equal(validarPayload(true).ok, false);
  const { eje, id } = await ejeCon(['Casa']);
  const t = await escribe(eje, id, 'un terminal suelto');
  assert.equal(t.payload, 'un terminal suelto'); // no hace falta ['un terminal suelto']
});

test('BTML-09 un terminal puede ser número, palabra, HTML, expresión BQL o referencia', async () => {
  const { eje, id } = await ejeCon(['Casa']);
  for (const terminal of [12.5, 'yogur', '<b>oferta</b>', '=1 + 1', { ref: id }, { ref: id, dir: '1000000000' }]) {
    assert.equal(esTerminal(terminal), true, JSON.stringify(terminal));
    const ev = await escribe(eje, id, terminal);
    assert.deepEqual(ev.payload, terminal);
  }
});

test('BTML-09b un terminal puede ser un archivo',
  { skip: 'BTML-09: no existe terminal de archivo; solo número, cadena no vacía y referencia. [X] decidir VG la forma (la de abajo es supuesta)' },
  () => {
    assert.equal(esTerminal({ archivo: 'factura.pdf', hash: 'a'.repeat(64), tipo: 'application/pdf' }), true);
  });

test('BTML-10 todo array usado es no vacío (1..10); no se usa [] como nudo vacío, tampoco anidado', () => {
  assert.equal(validarPayload(['solo']).ok, true);
  assert.equal(validarPayload([]).ok, false);
  const anidado = validarPayload(['a', ['b', []]]);
  assert.equal(anidado.ok, false);
  assert.ok(anidado.errores.some((e) => /vacío/.test(e)));
});

test('BTML-11 sin null ni undefined para saltar índices: cada índice usado tiene contenido real', async () => {
  for (const malo of [['a', null, 'c'], ['a', undefined, 'c'], [null], ['a', ['b', null]]]) {
    assert.equal(validarPayload(malo).ok, false, JSON.stringify(malo));
  }
  const { eje, id } = await ejeCon(['Casa']);
  await assert.rejects(escribe(eje, id, ['a', null, 'c']), /hueco/);
  assert.equal(validarPayload(['a', 'mínimo', 'c']).ok, true);
});

test('BTML-11b tampoco posiciones ausentes: un array disperso de JavaScript no es un payload válido', async () => {
  const disperso = ['a', , 'c']; // el índice 1 no existe: ni null ni undefined, ausente
  const solo3 = [];
  solo3[3] = 'd';
  assert.equal(validarPayload(disperso).ok, false);
  assert.equal(validarPayload(solo3).ok, false);
  assert.deepEqual(validarPayload(solo3).errores, ['0: hueco', '1: hueco', '2: hueco']);
  assert.equal(validarPayload(['x', ['a', , 'c']]).ok, false); // tampoco anidado
  const { eje, id } = await ejeCon(['Casa']);
  await assert.rejects(escribe(eje, id, disperso), /hueco/);
});

test('BTML-14 la anidación cambia de rama sin llenar el espacio potencial: ["Compra",["Coste","=SUMA(100,20)"]] es válido sin otros ocho slots', async () => {
  const payload = ['Compra', ['Coste', '=SUMA(100,20)']];
  assert.equal(validarPayload(payload).ok, true);
  const { eje, id } = await ejeCon(['Casa']);
  const ev = await escribe(eje, id, payload);
  assert.deepEqual(ev.payload, payload); // tal cual: nadie rellena
  assert.equal(resolver(ev.payload, '1100000000'), '=SUMA(100,20)');
  assert.deepEqual([...arbol(eje, ev.id).keys()].sort(), ['0000000000', '1000000000', '1100000000']);
});

test('BTML-15 el camino literal de diez índices 9 (10 arrays, 91 terminales, 100 entradas, sin null) es un payload válido', async () => {
  let p = Array.from({ length: 10 }, (_, k) => 'h' + k); // el array más hondo: diez terminales
  for (let nivel = 0; nivel < 9; nivel++) p = [...Array.from({ length: 9 }, (_, k) => 'n' + nivel + '.' + k), p];
  let arrays = 0;
  let terminales = 0;
  let entradas = 0;
  const contar = (x) => {
    if (Array.isArray(x)) { arrays++; entradas += x.length; x.forEach(contar); } else terminales++;
  };
  contar(p);
  assert.deepEqual([arrays, terminales, entradas], [10, 91, 100]);
  assert.equal(validarPayload(p).ok, true);
  assert.equal(JSON.stringify(p).includes('null'), false);
  assert.equal(resolver(p, '9999999999'), 'h9');
  const { eje, id } = await ejeCon(['Casa']);
  const ev = await escribe(eje, id, p);
  assert.equal(ocupantes(eje, ev.id, Array(10).fill(9))[0].contenido, 'h9');
});

// =====================================================================
// BTML · décupla parcial
// =====================================================================

test('BTML-12 no se desarrollan automáticamente las diez casillas: solo existe lo escrito', async () => {
  const { eje, id } = await ejeCon(['Casa', ['a', 'b']]);
  assert.equal(eje.obtener(id).payload.length, 2);
  assert.equal(eje.obtener(id).payload[1].length, 2);
  const m = arbol(eje, id);
  assert.deepEqual([...m.keys()].sort(), ['0000000000', '1000000000', '1100000000']); // nada de diez por nivel
  const d = decupla(eje.obtener(id));
  assert.equal(d.posiciones.length, ARIDAD); // la décupla se puede mirar entera…
  assert.equal(d.posiciones.filter((p) => p.contenido !== undefined).length, 2); // …pero sin inventar contenido
  assert.equal(ocupantes(eje, id, [5]).length, 0);
});

test('BTML-13 la décupla es el aspecto de un payload al desarrollar sus diez posiciones, leídas con la regla corta de cada profundidad', async () => {
  const { eje, id } = await ejeCon(['Casa', ['sub', 'x']]);
  const ev = eje.obtener(id);
  assert.deepEqual(decupla(ev).posiciones.map((p) => p.significado), PV); // época 0, profundidad 0
  // Otra época u otra profundidad: otras perspectivas, no diez campos fijos.
  const porProfundidad = { nombre: 'prueba', reglaCorta: (p, d) => 'p' + p + 'd' + d };
  assert.equal(decupla(ev, porProfundidad, 0).posiciones[3].significado, 'p0d3');
  assert.equal(decupla(ev, porProfundidad, 2).posiciones[3].significado, 'p2d3');
  // Bajo la posición 1, ['sub', 'x'] es su lista de ocupantes por llegada, sin PV (VG, 7-11 noche);
  // la regla corta de la profundidad sigue en lo que la lista no ocupa (subposiciones por dirección).
  assert.equal(mapa(eje, id, { camino: [1], epoca: porProfundidad }).celdas[1].significado, 'ocupante 2');
  assert.equal(mapa(eje, id, { camino: [1], epoca: porProfundidad }).celdas[2].significado, 'p1d2');
});

// =====================================================================
// BTML · referencias
// =====================================================================

test('BTML-17 una posición puede referir a un evento completo o a una posición precisa de otro evento', async () => {
  const { eje, id } = await ejeCon(['Casa']);
  const a = await escribe(eje, id, ['A', ['a0', 'a1']]);
  const b = await escribe(eje, id, ['B', { ref: a.id }, { ref: a.id, dir: '1000000000' }, { ref: a.id, dir: '1100000000' }]);
  assert.deepEqual(seguir(eje, b.payload[1]).contenido, a.payload); // el evento completo
  assert.deepEqual(seguir(eje, b.payload[2]).contenido, ['a0', 'a1']); // un subárbol
  assert.equal(seguir(eje, b.payload[3]).contenido, 'a1'); // una posición precisa
});

test('BTML-17b una posición puede referir a una rama',
  { skip: 'BTML-17: no hay forma propia de referencia a una «rama» (docs/BTML.md §3.3 la deja pendiente); {ref, dir} cubre evento completo, subárbol y posición' },
  sinForma('BTML-17'));

test('BTML-18 las referencias no copian: lo referido se lee al resolver, nunca al escribir', async () => {
  const { eje, id } = await ejeCon(['Casa']);
  // Se prepara A sin añadirlo: su id ya existe porque es el hash de su cuerpo.
  const a = await crearEvento({ autor: 'raiz', sobre: id, t: T0, movimientos: [gastaT('raiz')], payload: ['A', 'contenido de A'] });
  const b = await escribe(eje, id, ['B', { ref: a.id, dir: '1000000000' }, '=LOCAL(1)']);
  assert.deepEqual(b.payload[1], { ref: a.id, dir: '1000000000' }); // se guarda la referencia, no el contenido
  assert.equal(JSON.stringify(b).includes('contenido de A'), false);
  assert.notEqual(evaluar(eje, b.id, [2]).estado, 'RESUELTO'); // aún no hay nada que leer
  await eje.anadir(a);
  assert.equal(evaluar(eje, b.id, [2]).texto, 'contenido de A'); // al resolver, ahora sí
  assert.equal(ocupantes(eje, b.id, [1]).find((o) => o.origen === 'referencia').contenido, 'contenido de A');
});

test('BTML-19 navegar referencias no consume profundidad BTML: el límite de diez dígitos es local a cada árbol', async () => {
  const { eje, id } = await ejeCon(['Casa']);
  let anterior = await escribe(eje, id, ['Fondo', ['nivel', 'tesoro']]);
  for (let k = 0; k < 7; k++) anterior = await escribe(eje, id, ['Salto ' + k, ['nivel', { ref: anterior.id, dir: '1100000000' }]]);
  // Ocho árboles de dos dígitos cada uno: dieciséis dígitos recorridos, y ninguna dirección pasa de diez.
  const r = seguir(eje, { ref: anterior.id, dir: '1100000000' });
  assert.equal(r.contenido, 'tesoro');
  assert.equal(r.procedencia.length, 8);
  assert.ok(r.procedencia.every((p) => esDireccion(p.split(':')[1])));
  const lector = await escribe(eje, id, ['Lector', '=REF("' + anterior.id + '", "1100000000")']);
  assert.equal(evaluar(eje, lector.id, [1]).texto, 'tesoro');
  // Un presupuesto (no la profundidad) limita el recorrido.
  for (let k = 0; k < 20; k++) anterior = await escribe(eje, id, ['Más ' + k, ['nivel', { ref: anterior.id, dir: '1100000000' }]]);
  assert.equal(seguir(eje, { ref: anterior.id, dir: '1100000000' }).rota, true);
});

test('BTML-19b los permisos de lectura limitan el recorrido de referencias',
  { skip: 'BTML-19: en el encaje no hay permisos de lectura: seguir() recorre las referencias por todo el eje que tiene el observador (ver BTML-65b). Solo BQL limita el recorrido: desde la PR #36, integrada, pregunta al gancho opcional puedeLeer por cada salto de la cadena de REF y da PENDIENTE DE AUTORIZACIÓN (O-12b, O-12c); el gancho lo pasa quien llama y el modelo de permisos es de AARPIA (mapa §12)' },
  sinForma('BTML-19'));

test('BTML-20 contexto ausente → PENDIENTE; tipo imposible → INCOMPATIBLE; ciclo irresoluble → ERROR', async () => {
  const { eje, id } = await ejeCon(['Casa', 'texto', '=LOCAL(9)', '="a" + 1', '=LOCAL(4)', '=LOCAL(3)']);
  assert.equal(evaluar(eje, id, [2]).estado, 'PENDIENTE');
  assert.equal(evaluar(eje, id, [3]).estado, 'INCOMPATIBLE');
  assert.equal(evaluar(eje, id, [4]).estado, 'ERROR');
  assert.match(evaluar(eje, id, [4]).motivo, /ciclo/);
});

test('BTML-20b en el encaje, una referencia a un evento ausente es PENDIENTE (con su motivo), no ERROR', async () => {
  const { eje, id } = await ejeCon(['Casa']);
  const b = await escribe(eje, id, ['B', { ref: ID_INEXISTENTE }, '=LOCAL(1)']);
  const rota = ocupantes(eje, b.id, [1]).find((o) => o.origen === 'referencia');
  assert.equal(rota.estado, 'PENDIENTE');
  assert.match(rota.motivo, /ausente/);
  assert.equal(seguir(eje, { ref: ID_INEXISTENTE }).estado, 'PENDIENTE');
  // Lo que sí está no lleva estado de pendiente.
  const a = await escribe(eje, id, 'A');
  assert.equal(seguir(eje, { ref: a.id }).estado, undefined);
});

test('BTML-20c en BQL, una referencia a un evento ausente es PENDIENTE, no ERROR', async () => {
  const { eje, id } = await ejeCon(['Casa']);
  const b = await escribe(eje, id, ['B', { ref: ID_INEXISTENTE }, '=LOCAL(1)']);
  assert.equal(consultar(eje, id, [0], 'REF("' + ID_INEXISTENTE + '")').estado, 'PENDIENTE');
  assert.equal(evaluar(eje, b.id, [2]).estado, 'PENDIENTE');
});

test('BTML-23 la yuxtaposición de referencias no significa por sí sola suma, concatenación ni traducción', async () => {
  const { eje, id } = await ejeCon(['Casa']);
  const a = await escribe(eje, id, 23);
  const b = await escribe(eje, id, 'euros');
  const c = await escribe(eje, id, ['C', { ref: a.id }, { ref: b.id }, '=LOCAL(1)', '=LOCAL(2)', '=LOCAL(1) + LOCAL(2)']);
  assert.equal(evaluar(eje, c.id, [3]).texto, '23'); // cada una se lee por separado
  assert.equal(evaluar(eje, c.id, [4]).texto, 'euros');
  assert.equal(evaluar(eje, c.id, [5]).estado, 'INCOMPATIBLE'); // ni «23 euros» ni suma
  const todo = consultar(eje, c.id, [0], 'REF("' + c.id + '")');
  assert.equal(todo.valor.tipo, 'array'); // el registro sigue siendo dos referencias, no una lectura combinada
  for (const r of [todo.texto, evaluar(eje, c.id, [5]).texto]) assert.equal(/23 ?euros/.test(r), false);
});

// =====================================================================
// BTML · direcciones
// =====================================================================

test('BTML-25 toda dirección explícita es una cadena de exactamente diez dígitos (en `en` y en el dir de una referencia)', async () => {
  for (const d of ['0000000000', '8412300000', '9999999999']) assert.equal(esDireccion(d), true);
  for (const d of [8412300000, '84123', '84123000000', '841230000a', '']) assert.equal(esDireccion(d), false, String(d));
  const { eje, id } = await ejeCon(['Casa']);
  await assert.rejects(eje.escribir({ autor: 'raiz', sobre: id, en: 4000000000, t: T0, movimientos: [gastaT('raiz')], payload: 'x' }), /en debe ser una dirección de diez dígitos/);
  await assert.rejects(eje.escribir({ autor: 'raiz', sobre: id, en: '4', t: T0, movimientos: [gastaT('raiz')], payload: 'x' }), /en debe ser una dirección de diez dígitos/);
  assert.equal(validarPayload(['x', { ref: id, dir: '12' }]).ok, false);
  assert.equal(validarPayload(['x', { ref: id, dir: 1200000000 }]).ok, false);
  assert.equal(consultar(eje, id, [0], 'REF("' + id + '", "12")').estado, 'ERROR');
  assert.equal(direccion([8, 4, 1, 2, 3]), '8412300000');
});

test('BTML-26 hasta diez profundidades de posicionamiento; no se materializa un array denso de 10^10', async () => {
  assert.throws(() => direccion(Array(11).fill(1)), RangeError);
  assert.equal(direccion(Array(10).fill(1)), '1111111111');
  const { eje, id } = await ejeCon(['Casa']);
  const ev = await escribe(eje, id, conCamino([9, 9, 9], 'hondo'));
  const m = arbol(eje, ev.id);
  // Solo lo desarrollado: la raíz y 10 + 10 + 10 posiciones (que, por los ceros finales, ocupan 28 direcciones), no 10^10.
  assert.equal(m.size, 28);
  assert.ok(m.has('9990000000'));
});

test('BTML-26b lo que queda por debajo de la décima profundidad no se pierde en silencio',
  { skip: 'BTML-26: validarPayload acepta anidaciones de más de diez niveles y arbol() descarta en silencio lo que queda bajo el décimo, sin dirección ni cambio de foco. [X] decidir VG si se rechaza o se cambia de foco (BTML-40)' },
  () => {
    let p = 'bajo el décimo';
    for (let k = 0; k < 11; k++) p = ['n' + k, p]; // once niveles por la posición 1
    assert.equal(validarPayload(p).ok, false);
  });

test('BTML-27 los dígitos son posiciones semánticas; en la época 0, la profundidad 0 son los diez PV y en las demás el dígito es el PV aplicado al nodo de arriba', () => {
  for (let d = 0; d < ARIDAD; d++) assert.equal(EPOCA_0.reglaCorta(0, d), PV[d]);
  for (let p = 1; p < ARIDAD; p++) for (let d = 0; d < ARIDAD; d++) assert.equal(EPOCA_0.reglaCorta(p, d), EPOCA_0.reglaCorta(1, d));
  assert.deepEqual(leerDireccion('4440000000').map((x) => x.significado), ['fábrica', 'qué se hace', 'qué se hace']);
  assert.deepEqual(leerDireccion('8412000000').map((x) => [x.profundidad, x.digito, x.significado]),
    [[0, 8, PV[8]], [1, 4, 'qué se hace'], [2, 1, 'cuánto'], [3, 2, 'con qué condición']]);
});

test('BTML-28 la dirección no es clave de almacenamiento: se calcula al reconstruir y admite varios ocupantes', async () => {
  const { eje, id } = await ejeCon(['Casa', ['recurso', 'x']]);
  const h1 = await escribe(eje, id, 'uno', '1000000000');
  const h2 = await escribe(eje, id, 'dos', '1000000000');
  // Se guarda por id, no por dirección.
  assert.deepEqual([...eje.eventos.keys()].sort(), [id, h1.id, h2.id].sort());
  assert.equal(eje.eventos.has('1000000000'), false);
  // La dirección aparece al reconstruir, con todos sus ocupantes, y cada reconstrucción es nueva.
  const m1 = arbol(eje, id);
  const m2 = arbol(eje, id);
  assert.notEqual(m1, m2);
  assert.deepEqual(resumenArbol(eje, id), resumenArbol(eje, id));
  assert.deepEqual(m1.get('1000000000').map((o) => o.origen), ['propio', 'propio', 'escrito', 'escrito']);
});

test('BTML-28b una dirección puede ser ambigua por varios anclajes de un mismo fragmento',
  { skip: 'BTML-28: cada fragmento declara un solo anclaje (sobre + en); no hay ambigüedad por varios anclajes (ver BTML-56b)' },
  sinForma('BTML-28'));

test('BTML-29 "1100000000" y "0000000011" no son la misma dirección ni una inversión válida', async () => {
  const p = [['x', 'y'], ['a', 'b']];
  assert.equal(resolver(p, '1100000000'), 'b');
  assert.equal(resolver(p, '0000000011'), undefined);
  assert.notDeepEqual(indicesDe('1100000000'), indicesDe('0000000011'));
  assert.notDeepEqual(vector('1100000000', '0000000011'), Array(10).fill(0));
  const { eje, id } = await ejeCon(p);
  assert.notDeepEqual(ocupantes(eje, id, [1, 1]), ocupantes(eje, id, [0, 0, 0, 0, 0, 0, 0, 0, 1, 1]));
});

test('BTML-31 las posiciones no se reducen a números grandes: se comparan diez dígitos con signo, dimensión a dimensión', () => {
  assert.deepEqual(vector('8412500000', '8412300000'), [0, 0, 0, 0, 2, 0, 0, 0, 0, 0]); // no 200000
  assert.deepEqual(vector('1999999999', '2000000000'), [-1, 9, 9, 9, 9, 9, 9, 9, 9, 9]); // a 1 de distancia como entero, lejos por dimensiones
  // El orden no sigue la cercanía como entero: "1999999999" es el entero más cercano a "2000000000", pero no comparte ruta.
  const buscada = '2000000000';
  const lista = [{ n: 'entero cercano', vector: vector('1999999999', buscada) }, { n: 'misma rama', vector: vector('2900000000', buscada) }];
  assert.deepEqual(ordenarPorEncaje(lista).map((x) => x.n), ['misma rama', 'entero cercano']);
});

// =====================================================================
// BTML · los tres ceros
// =====================================================================

test('BTML-32 los ceros no son relleno: el índice 0 recorrido se distingue de los ceros de representación', async () => {
  assert.deepEqual(indicesDe('1010000000'), [1, 0, 1]); // el cero intermedio es un índice recorrido
  assert.deepEqual(indicesDe('1000000000'), [1]); // los ceros finales son representación
  const { eje, id } = await ejeCon(['Casa', ['cero', 'uno']]);
  // Cuál de los dos es se conoce por contexto: el camino exacto de cada ocupante.
  assert.deepEqual(ocupantes(eje, id, [1]).map((o) => o.camino), [[1], [1, 0]]);
  assert.deepEqual(ocupantes(eje, id, [1, 1]).map((o) => o.camino), [[1, 1]]);
});

test('BTML-32b el tercer cero: un cero orientativo o de agregación bajo regla de época',
  { skip: 'BTML-32: solo existen el índice 0 recorrido y los ceros de representación; el cero orientativo no existe (sus reglas están abiertas, BTML-37)' },
  sinForma('BTML-32'));

test('BTML-33 la dirección se completa con ceros finales de representación: 8→4→1→2 se escribe "8412000000"', () => {
  assert.equal(direccion([8, 4, 1, 2]), '8412000000');
  assert.deepEqual(indicesDe('8412000000'), [8, 4, 1, 2]);
  assert.equal(direccion([]), '0000000000');
});

test('BTML-34 la cadena de diez dígitos no determina por sí sola un nodo: "8412000000" nombra la ruta 8.4.1.2 y su hijo 0', async () => {
  const { eje, id } = await ejeCon(conCamino([8, 4, 1, 2], ['cero', 'uno']));
  assert.equal(direccion([8, 4, 1, 2]), direccion([8, 4, 1, 2, 0]));
  const oc = ocupantes(eje, id, [8, 4, 1, 2]);
  assert.deepEqual(oc.map((o) => o.camino), [[8, 4, 1, 2], [8, 4, 1, 2, 0]]); // misma representación, dos nodos
  assert.deepEqual(oc[0].contenido, ['cero', 'uno']);
  assert.equal(oc[1].contenido, 'cero');
  assert.deepEqual(oc.map((o) => o.dir), ['8412000000', '8412000000']);
});

test('BTML-35 colisiones, no apaños: la dirección con ceros finales nombra a la vez 1, 1.0, 1.0.0…, cada uno con camino y procedencia', async () => {
  const { eje, id } = await ejeCon(['Casa', [['x', 'y'], 'b']]);
  const oc = ocupantes(eje, id, [1]);
  assert.deepEqual(oc.map((o) => o.camino), [[1], [1, 0], [1, 0, 0]]);
  assert.deepEqual(oc.map((o) => o.procedencia), [[id + ':1000000000#1'], [id + ':1000000000#1.0'], [id + ':1000000000#1.0.0']]);
  assert.deepEqual(ocupantes(eje, id, [1, 0, 0]), oc); // el mismo lugar se nombra igual desde cualquiera de los tres
  assert.ok(colisiones(arbol(eje, id)).some((c) => c.dir === '1000000000' && c.ocupantes.length === 3));
});

test('BTML-36 un terminal no tiene posición 0: pedirla da PENDIENTE', async () => {
  const { eje, id } = await ejeCon(['Casa', 'terminal', '=LOCAL(1, 0)']);
  assert.equal(evaluar(eje, id, [2]).estado, 'PENDIENTE');
  const t = await escribe(eje, id, 'solo un terminal');
  assert.deepEqual(caminosDe(t.payload, '0000000000').map((c) => c.indices), [[]]); // el terminal, sin un 0 debajo
  assert.deepEqual(ocupantes(eje, t.id, []).map((o) => o.camino), [[]]);
  assert.deepEqual(ocupantes(eje, id, [1]).map((o) => o.camino), [[1]]);
});

test('BTML-36b la décupla y el mapa tampoco ponen un terminal en su posición 0; la herencia de su raíz se conserva ([X], mapa §13)', async () => {
  const { eje, id } = await ejeCon('foco terminal');
  const ev = eje.obtener(id);
  assert.equal(decupla(ev).posiciones[0].contenido, undefined);
  assert.equal(mapa(eje, id).celdas[0].contenido, undefined);
  const celdas = [];
  celdas[1] = ['algo'];
  // Integración 7-11: #42 pedía «hueco en 0»; el mapa §13 manda conservar, como en main y marcada [X],
  // la herencia de la raíz de un foco terminal: la posición 0 es una referencia al foco entero.
  const { payload, heredadas } = desdeMapped(eje, celdas, id);
  assert.deepEqual(payload, [{ ref: id, dir: '0000000000' }, 'algo']);
  assert.deepEqual(heredadas, [0]);
  // El terminal no se pierde: se entrega aparte, sin posición.
  assert.equal(decupla(ev).terminal, 'foco terminal');
  assert.equal(mapa(eje, id).terminal, 'foco terminal');
  assert.ok(decupla(ev).posiciones.every((p) => p.contenido === undefined));
});

// =====================================================================
// BTML · cambio de foco
// =====================================================================

test('BTML-39 pasar al interior de otro objeto no concatena dígitos: la dirección allí vuelve a ser local y se mantienen las referencias', async () => {
  const { eje, id } = await ejeCon(['Casa']);
  const a = await escribe(eje, id, ['A', ['a0', 'a1']]);
  const b = await escribe(eje, id, ['B', 'x', 'y', ['b0', 'b1', { ref: a.id, dir: '1100000000' }]]);
  const oc = ocupantes(eje, b.id, [3, 2]);
  const ref = oc.find((o) => o.origen === 'referencia');
  assert.equal(ref.contenido, 'a1');
  assert.equal(ref.dir, '1100000000'); // local al otro objeto, no "3211000000…"
  assert.deepEqual(ref.procedencia, [b.id + ':3200000000#3.2', a.id + ':1100000000']);
  for (const o of oc) for (const d of [o.dir, o.origenDir, o.destino]) assert.equal(esDireccion(d), true);
});

test('BTML-40 al agotar diez niveles se cambia de foco: otro objeto pasa a ser centro, con vínculo al anterior',
  { skip: 'BTML-40: no existe la operación de cambio de foco al llegar al décimo nivel; cualquier registro puede ser foco (sobre), pero nada cambia de foco ni deja el vínculo' },
  sinForma('BTML-40'));

// =====================================================================
// BTML · encaje
// =====================================================================

test('BTML-42 paso 1 del encaje: se resuelven las referencias y el registro en foco', async () => {
  const { eje, id } = await ejeCon(['Casa']);
  const a = await escribe(eje, id, ['A', 'dato']);
  const x = await escribe(eje, id, ['X', { ref: a.id, dir: '1000000000' }]);
  const oc = ocupantes(eje, x.id, [1]);
  assert.ok(oc.every((o) => o.destino === '1000000000')); // todo se mide contra el foco y la posición buscada
  assert.equal(oc.find((o) => o.origen === 'referencia').contenido, 'dato');
  assert.throws(() => ocupantes(eje, ID_INEXISTENTE, [1]), /registro desconocido/);
});

test('BTML-42b paso 1 del encaje: también usuario, objeto y tronco/reglas de época',
  { skip: 'BTML-42: el encaje no recibe usuario ni tronco; la época solo entra para ordenar (epoca.ordinal)' },
  sinForma('BTML-42'));

test('BTML-43 paso 2 del encaje: ubicaciones candidatas de diez dígitos, cada una con su procedencia', async () => {
  const { eje, id } = await ejeCon(['Casa', ['r', 'x']]);
  const a = await escribe(eje, id, ['A', 'b', 'c', 'd', 'e', 'f', 'g', 'lejos']);
  const x = await escribe(eje, id, ['X', 'r', [{ ref: a.id, dir: '7000000000' }]]);
  await escribe(eje, x.id, 'escrito', '2000000000');
  const oc = ocupantes(eje, x.id, [2]);
  assert.deepEqual(oc.map((o) => o.origen).sort(), ['escrito', 'propio', 'propio', 'referencia']);
  for (const o of oc) {
    assert.equal(esDireccion(o.origenDir), true);
    assert.equal(esDireccion(o.destino), true);
    assert.ok(o.procedencia.length > 0);
  }
  assert.equal(oc.find((o) => o.origen === 'referencia').origenDir, '7000000000');
});

test('BTML-43b paso 2 del encaje: la orientación de los ceros entra en las candidatas',
  { skip: 'BTML-43: no hay orientación (el tercer cero, BTML-37 abierto)' },
  sinForma('BTML-43'));

test('BTML-44 la colisión es el estado normal de una posición; no se modifica en sitio: corregir es añadir un ocupante', async () => {
  const { eje, id } = await ejeCon(['Casa', 'precio: 12']);
  const original = eje.obtener(id);
  assert.equal(typeof eje.modificar, 'undefined');
  assert.equal(typeof eje.borrar, 'undefined');
  assert.equal(Object.isFrozen(original), true);
  assert.throws(() => { original.payload = 'otro'; }, TypeError);
  const correccion = await escribe(eje, id, 'precio: 14', '1000000000');
  assert.deepEqual(eje.obtener(id).payload, ['Casa', 'precio: 12']); // lo anterior sigue
  const oc = ocupantes(eje, id, [1]);
  assert.deepEqual(oc.map((o) => [o.origen, o.contenido]), [['propio', 'precio: 12'], ['escrito', 'precio: 14']]);
  assert.equal(oc[1].evento, correccion.id);
});

test('BTML-44b nada se modifica en sitio tampoco en memoria: el payload guardado no se puede mutar', async () => {
  const { eje, id } = await ejeCon(['Casa', 'precio: 12']);
  const ev = eje.obtener(id);
  assert.equal(Object.isFrozen(ev.payload), true);
  assert.equal(Object.isFrozen(ev.movimientos), true);
  assert.equal(Object.isFrozen(ev.contexto), true);
  assert.throws(() => { ev.payload[1] = 'precio: 1'; }, TypeError);
  assert.throws(() => { ev.movimientos[0].cantidad = 1e9; }, TypeError);
  // Tampoco lo que se reconstruye desde datos guardados.
  const datos = JSON.parse(JSON.stringify(serializar(eje)));
  const otro = await restaurar(datos);
  assert.equal(Object.isFrozen(otro.obtener(id).payload), true);
  assert.equal(Object.isFrozen(otro.obtener(id).movimientos[0]), true);
  assert.equal(Object.isFrozen(datos.eventos[0].payload), false); // el eje guarda sus copias: los datos de quien restaura no se tocan
  // El evento guarda su copia: quien lo escribió puede seguir usando su array sin cambiar el evento.
  const mio = ['Mío', 'x'];
  const escrito = await escribe(eje, id, mio);
  mio.push('y');
  assert.deepEqual(escrito.payload, ['Mío', 'x']);
});

test('BTML-45 dos eventos distintos colisionan en la misma posición sin ser idénticos ni sobrescribirse', async () => {
  const { eje, id } = await ejeCon(['Casa', 'recurso']);
  await alta(eje, 'ana');
  const a = await escribe(eje, id, 'mismo texto', '1000000000');
  const b = await escribe(eje, id, 'mismo texto', '1000000000', 'ana');
  assert.notEqual(a.id, b.id);
  const escritos = ocupantes(eje, id, [1]).filter((o) => o.origen === 'escrito');
  assert.deepEqual(escritos.map((o) => [o.evento, o.autor]), [[a.id, 'raiz'], [b.id, 'ana']]); // los dos, con su procedencia
  // Un evento idéntico no es otra alternativa: es el mismo y no se registra dos veces.
  await assert.rejects(eje.anadir(eje.obtener(a.id)), /evento ya registrado/);
});

test('BTML-46 paso 3 del encaje: coincidencias de ruta y un vector de diez diferencias con signo, un dígito por componente', async () => {
  const { eje, id } = await ejeCon(['Casa']);
  const plan = await escribe(eje, id, ['Plan', 'a', 'b', 'tres']);
  const x = await escribe(eje, id, ['X', 'r', { ref: plan.id, dir: '3000000000' }]);
  for (const o of ocupantes(eje, x.id, [2])) {
    assert.equal(o.vector.length, 10);
    assert.ok(o.vector.every((v) => Number.isInteger(v) && v >= -9 && v <= 9));
    assert.deepEqual(o.vector, vector(o.origenDir, o.destino));
    assert.equal(o.acuerdo, acuerdo(o.vector));
  }
  const ref = ocupantes(eje, x.id, [2]).find((o) => o.origen === 'referencia');
  assert.deepEqual(ref.vector, [1, 0, 0, 0, 0, 0, 0, 0, 0, 0]); // 3 − 2 en la profundidad 0
  assert.equal(ref.acuerdo, 0);
});

test('BTML-47 buscada "8412300000": "8412500000" tiene +2 en el quinto dígito y "8412100000" −2; todo ceros es exacto', () => {
  assert.deepEqual(vector('8412500000', '8412300000'), [0, 0, 0, 0, 2, 0, 0, 0, 0, 0]);
  assert.deepEqual(vector('8412100000', '8412300000'), [0, 0, 0, 0, -2, 0, 0, 0, 0, 0]);
  assert.deepEqual(vector('8412300000', '8412300000'), Array(10).fill(0));
  assert.equal(signo(vector('8412300000', '8412300000')), 'exacto');
  assert.equal(acuerdo(vector('8412300000', '8412300000')), 10);
});

test('BTML-48 el signo es información (sobra → reducir, falta → completar) y no ordena por sí mismo', () => {
  const buscada = '8412300000';
  assert.equal(signo(vector('8412500000', buscada)), 'reducir');
  assert.equal(signo(vector('8412100000', buscada)), 'completar');
  // Mismo acuerdo, signos opuestos: manda la llegada, en los dos sentidos.
  const sobra = { n: 'sobra', vector: vector('8412500000', buscada) };
  const falta = { n: 'falta', vector: vector('8412100000', buscada) };
  assert.deepEqual(ordenarPorEncaje([sobra, falta]).map((x) => x.n), ['sobra', 'falta']);
  assert.deepEqual(ordenarPorEncaje([falta, sobra]).map((x) => x.n), ['falta', 'sobra']);
});

test('BTML-48b el signo solo dice reducir/completar donde la regla de esa dimensión lo permite',
  { skip: 'BTML-48: no existen reglas por dimensión que digan dónde cuenta el signo; signo() lee «reducir» o «completar» también en dígitos nominales (época 0). [X] decidir VG la forma (abajo, supuesta)' },
  () => {
    const soloLaPrimera = { nombre: 'ordinal en 0', ordinal: (k) => k === 0, reglaCorta: (p, d) => PV[d] };
    const v = vector('8412500000', '8412300000'); // difiere en la profundidad 4, nominal en esta época
    assert.notEqual(signo(v, { epoca: soloLaPrimera }), 'reducir');
  });

test('BTML-50 se ordena sin borrar alternativas: ningún candidato se descarta, tampoco por distancia', async () => {
  const lista = [
    { n: 'lejos', vector: vector('9999999999', '1000000000') },
    { n: 'exacto', vector: vector('1000000000', '1000000000') },
    { n: 'cerca', vector: vector('1100000000', '1000000000') },
  ];
  const orden = ordenarPorEncaje(lista);
  assert.equal(orden.length, 3);
  assert.deepEqual(orden.map((x) => x.n).sort(), ['cerca', 'exacto', 'lejos']);
  const { eje, id } = await ejeCon(['Casa']);
  const lejos = await escribe(eje, id, ['L', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'nueve']);
  const x = await escribe(eje, id, ['X', { ref: lejos.id, dir: '9000000000' }]);
  await escribe(eje, x.id, 'escrito', '1000000000');
  assert.equal(consultar(eje, x.id, [1], 'CONTAR(BUSCAR(1))').texto, '3'); // el propio, el lejano y el escrito
});

test('BTML-51 se compara después de interpretar: con dígitos nominales (época 0) la distancia por dígito no ordena', () => {
  const buscada = '2000000000';
  const lista = [
    { n: 'desde 9', vector: vector('9000000000', buscada) },
    { n: 'desde 3', vector: vector('3000000000', buscada) },
  ];
  assert.deepEqual(ordenarPorEncaje(lista, { epoca: EPOCA_0 }).map((x) => x.n), ['desde 9', 'desde 3']); // llegada
  assert.deepEqual(ordenarPorEncaje(lista).map((x) => x.n), ['desde 9', 'desde 3']);
});

test('BTML-53 los exactos van primero, los empates por llegada; lo escrito anclado en la dirección buscada es exacto', async () => {
  const { eje, id } = await ejeCon(['Casa']);
  const plan = await escribe(eje, id, ['Plan', 'a', 'b', 'c', 'd', 'e', 'f', 'siete']);
  const x = await escribe(eje, id, ['X', 'r', { ref: plan.id, dir: '7000000000' }]);
  const h1 = await escribe(eje, x.id, 'uno', '2000000000');
  const h2 = await escribe(eje, x.id, 'dos', '2000000000');
  const oc = ocupantes(eje, x.id, [2]);
  assert.deepEqual(oc.map((o) => o.origen), ['propio', 'escrito', 'escrito', 'referencia']);
  assert.deepEqual(oc.slice(1, 3).map((o) => o.evento), [h1.id, h2.id]);
  assert.deepEqual(oc.slice(0, 3).map((o) => o.signo), ['exacto', 'exacto', 'exacto']);
  assert.equal(oc[3].signo, 'reducir');
});

test('BTML-54 la época cambia cómo se ordenan los ocupantes', () => {
  const buscada = '2000000000';
  const lista = [
    { n: 'desde 9', vector: vector('9000000000', buscada) },
    { n: 'desde 3', vector: vector('3000000000', buscada) },
  ];
  const ordinalEn0 = { nombre: 'ordinal en 0', ordinal: (k) => k === 0, reglaCorta: (p, d) => String(d) };
  assert.deepEqual(ordenarPorEncaje(lista, { epoca: EPOCA_0 }).map((x) => x.n), ['desde 9', 'desde 3']);
  assert.deepEqual(ordenarPorEncaje(lista, { epoca: ordinalEn0 }).map((x) => x.n), ['desde 3', 'desde 9']);
});

test('BTML-54b el árbol entero se reconstruye bajo la época elegida, que decide el orden de cada posición', async () => {
  const consultadas = [];
  const espia = { nombre: 'espía', ordinal: (k) => { consultadas.push(k); return false; }, reglaCorta: (p, d) => PV[d] };
  const { eje, id } = await ejeCon(['Casa', 'a']);
  await escribe(eje, id, 'b', '1000000000');
  const m = arbol(eje, id, { epoca: espia });
  assert.ok(consultadas.length > 0);
  for (const [dir, oc] of m) assert.deepEqual(oc, ocupantes(eje, id, indicesDe(dir), { epoca: espia }), dir);
});

test('BTML-54c la época cambia también qué ocupantes aparecen y los vectores',
  { skip: 'BTML-54: la época solo declara qué profundidades son ordinales, y eso solo ordena; ninguna regla de época dice todavía cómo cambia los ocupantes ni los vectores (las cien reglas cortas se trabajan en V5; terreno de src/epocas.js, otro agente). [X] decidir VG la forma' },
  sinForma('BTML-54'));

test('BTML-55 paso 5 del encaje: se entregan candidatos con diferencias, faltas y excedentes', async () => {
  const { eje, id } = await ejeCon(['Casa']);
  const plan = await escribe(eje, id, ['Plan', 'a', 'b', 'tres']);
  const x = await escribe(eje, id, ['X', { ref: plan.id, dir: '3000000000' }, 'r']);
  for (const o of ocupantes(eje, x.id, [1])) {
    for (const campo of ['evento', 'procedencia', 'camino', 'origenDir', 'destino', 'vector', 'distancia', 'acuerdo', 'signo', 'faltas', 'excedentes']) {
      assert.ok(o[campo] !== undefined, campo);
    }
  }
  const ref = ocupantes(eje, x.id, [1]).find((o) => o.origen === 'referencia');
  assert.deepEqual([ref.excedentes, ref.faltas, ref.distancia[0]], [1, 0, 2]);
});

test('BTML-55b paso 5 del encaje: también una justificación y la marca de empate', async () => {
  const { eje, id } = await ejeCon(['Casa', 'r']);
  await escribe(eje, id, 'uno', '1000000000');
  await escribe(eje, id, 'dos', '1000000000');
  const oc = ocupantes(eje, id, [1]);
  assert.ok(oc.every((o) => typeof o.justificacion === 'string' && o.justificacion.length > 0));
  assert.equal(oc.filter((o) => o.origen === 'escrito').every((o) => o.empate === true), true);
  assert.match(oc[2].justificacion, /escrito por raiz.*encaje exacto.*empata con 2 \(decide la llegada\)/);
  // Quien está solo no empata; y lo que el encaje separa tampoco.
  const solo = await ejeCon(['Casa', 'r', 's']);
  assert.deepEqual(ocupantes(solo.eje, solo.id, [2]).map((o) => o.empate), [false]);
  const plan = await escribe(eje, id, ['Plan', 'a', 'b', 'tres']);
  const x = await escribe(eje, id, ['X', 'r', { ref: plan.id, dir: '3000000000' }]);
  assert.deepEqual(ocupantes(eje, x.id, [2]).map((o) => [o.origen, o.empate]), [['propio', false], ['referencia', false]]);
  assert.match(ocupantes(eje, x.id, [2])[1].justificacion, /0 de 10 profundidades de acuerdo; reducir/);
});

// =====================================================================
// BTML · árbol desde fragmentos
// =====================================================================

test('BTML-56 un fragmento puede aparecer en varias posiciones cuando existe la relación posicional (por referencia)', async () => {
  const { eje, id } = await ejeCon(['Casa']);
  const frag = await escribe(eje, id, 'fragmento');
  const a = await escribe(eje, id, conCamino([8, 4, 1, 2, 3], { ref: frag.id }));
  const b = await escribe(eje, id, conCamino([8, 4, 1, 1, 3], { ref: frag.id }));
  const enA = ocupantes(eje, a.id, [8, 4, 1, 2, 3]).find((o) => o.origen === 'referencia');
  const enB = ocupantes(eje, b.id, [8, 4, 1, 1, 3]).find((o) => o.origen === 'referencia');
  assert.equal(enA.evento, frag.id);
  assert.equal(enB.evento, frag.id);
  assert.deepEqual([enA.destino, enB.destino], ['8412300000', '8411300000']);
  // Sin relación posicional no aparece: en A no hay nada en 8.4.1.1.3.
  assert.equal(ocupantes(eje, a.id, [8, 4, 1, 1, 3]).length, 0);
});

test('BTML-56b un mismo fragmento admite varios anclajes y genera varias posiciones plausibles',
  { skip: 'BTML-56: cada evento declara un único anclaje (sobre + en); un fragmento hijo 3 con anclajes A "8412000000" y B "8411000000" no puede generar "8412300000" y "8411300000" por sí mismo' },
  sinForma('BTML-56'));

test('BTML-57 al reconstruir no se generan arrays intermedios vacíos ni se inventan padres sin evidencia', async () => {
  const { eje, id } = await ejeCon(['Casa', 'recurso']);
  const h = await escribe(eje, id, 'anclado hondo', '7300000000');
  const m = arbol(eje, id);
  assert.ok(m.has('7300000000'));
  assert.equal(m.get('7300000000')[0].evento, h.id);
  assert.equal(m.has('7000000000'), false); // no se inventa el padre 7
  assert.deepEqual(ocupantes(eje, id, [7]), []);
  assert.deepEqual(eje.obtener(id).payload, ['Casa', 'recurso']); // el foco no se rellena
  assert.deepEqual(m.get('7300000000')[0].procedencia, [h.id + ':0000000000']); // se conserva la fuente
});

test('BTML-58 un solo árbol lógico: fuentes, proyección y consolidación son estados de la misma interpretación', async () => {
  const { eje, id } = await ejeCon(['Casa', 'recurso', 'criterio']);
  await alta(eje, 'ana');
  const fuente = await escribe(eje, id, 'alternativa', '1000000000');
  const d = descubrir(eje, id, { posiciones: [1] });
  const elegido = d[0].candidatos.find((x) => x.evento === fuente.id);
  const c = await consolidar(eje, { autor: 'ana', foco: id, t: T0, elecciones: { 1: { candidato: elegido } } });
  // La consolidación vive en el mismo árbol del foco, en su posición 4, junto a sus fuentes.
  const m = arbol(eje, id);
  assert.ok(m.get('1000000000').some((o) => o.evento === fuente.id));
  assert.ok(m.get('4000000000').some((o) => o.evento === c.id));
  assert.deepEqual(c.payload[1], { ref: fuente.id, dir: '0000000000' }); // referencia, no otro árbol
});

test('BTML-59 el árbol se reconstruye, no se guarda: se compone desde fragmentos con procedencia siguiendo referencias', async () => {
  const { eje, id } = await ejeCon(['Casa', 'recurso']);
  const a = await escribe(eje, id, ['A', 'dato']);
  await escribe(eje, id, { ref: a.id, dir: '1000000000' }, '1000000000');
  const datos = JSON.parse(JSON.stringify(serializar(eje)));
  assert.equal(JSON.stringify(datos).includes('ocupantes'), false);
  const otro = await restaurar(datos);
  assert.deepEqual(resumenArbol(otro, id), resumenArbol(eje, id));
  const escrito = arbol(otro, id).get('1000000000').find((o) => o.origen === 'escrito');
  assert.deepEqual(escrito.procedencia.length, 1);
});

test('BTML-59b el árbol se interpreta bajo la época elegida', async () => {
  const consultadas = [];
  const espia = { nombre: 'espía', ordinal: (k) => { consultadas.push(k); return false; }, reglaCorta: (p, d) => PV[d] };
  const { eje, id } = await ejeCon(['Casa', 'a']);
  arbol(eje, id, { epoca: espia });
  assert.ok(consultadas.length > 0);
});

test('BTML-59c el árbol se interpreta también bajo el contexto (usuario, objeto, tronco)',
  { skip: 'BTML-59: arbol() no recibe contexto de interpretación; no hay forma de usuario ni de tronco (ver BTML-42b)' },
  sinForma('BTML-59'));

test('BTML-60 los hijos conocen al padre (id + dirección); el padre no lista a sus hijos y no cambia', async () => {
  const { eje, id } = await ejeCon(['Casa', 'recurso']);
  const padre = eje.obtener(id);
  const antes = JSON.stringify(padre);
  const hijo = await escribe(eje, id, 'hijo', '1000000000');
  assert.equal(hijo.sobre, id);
  assert.equal(hijo.en, '1000000000');
  assert.equal(JSON.stringify(eje.obtener(id)), antes);
  assert.equal(JSON.stringify(padre.payload).includes(hijo.id), false);
  assert.deepEqual(eje.sobre(id).map((e) => e.id), [hijo.id]); // la lista de hijos se deriva de los hijos
});

test('BTML-61 lo escrito va en el PV donde se escribe: es el payload entero del registro nuevo; la posición es su anclaje', async () => {
  const { eje, id } = await ejeCon(['Casa', 'a', 'b']);
  const ev = await escribe(eje, id, ['Mensaje', 'para', 'todos'], '3000000000');
  assert.equal(ev.en, '3000000000');
  assert.deepEqual(eje.obtener(id).payload, ['Casa', 'a', 'b']); // no se rellena un hueco del padre
  const escrito = ocupantes(eje, id, [3]).find((o) => o.origen === 'escrito');
  assert.deepEqual(escrito.contenido, ['Mensaje', 'para', 'todos']);
  // Límite conocido: la posición 0 de la profundidad 0 coincide con la raíz.
  assert.equal(direccion([0]), RAIZ);
  const enCero = await escribe(eje, id, 'en el cero', '0000000000');
  const enRaiz = eje.sobre(id).filter((e) => e.en === RAIZ);
  assert.ok(enRaiz.some((e) => e.id === enCero.id));
});

test('BTML-63 herencia por referencia: las celdas vacías anteriores a la última se rellenan con {ref: foco, dir}; sin esa posición en el foco, consolidar rechaza y desdeMapped ancla lo lejano', async () => {
  const { eje, id } = await ejeCon(['Casa', 'recurso', 'criterio']);
  const celdas = [];
  celdas[2] = ['otro criterio'];
  const { payload, heredadas } = desdeMapped(eje, celdas, id);
  assert.deepEqual(heredadas, [0, 1]);
  assert.deepEqual(payload, [{ ref: id, dir: '0000000000' }, { ref: id, dir: '1000000000' }, 'otro criterio']);
  const lejos = [];
  lejos[5] = ['más allá'];
  // Lo lejano se ancla (mapa §12, «lo lejano = anclaje»; PR #40): sin base en 3 y 4, la 5 no se rechaza, va aparte en su dirección.
  const r = desdeMapped(eje, lejos, id);
  assert.equal(r.payload, null);
  assert.deepEqual(r.anclados.map((x) => [x.en, x.payload, x.faltan]), [['5000000000', 'más allá', ['3', '4']]]);
  await alta(eje, 'ana');
  const c = await consolidar(eje, { autor: 'ana', foco: id, t: T0, elecciones: { 2: 'x' } });
  assert.deepEqual(c.payload[1], { ref: id, dir: '1000000000' });
  await assert.rejects(consolidar(eje, { autor: 'ana', foco: id, t: T0, elecciones: { 5: 'x' } }), /hueco en 3/);
});

test('BTML-64 un hilo es la cadena de registros encadenados por referencia hasta el génesis, no una secuencia temporal', async () => {
  const { eje, id } = await ejeCon(['Casa']);
  // El t de un evento no es anterior al de su foco ([X] confirmar VG, src/ciclo.js), así que el hilo no puede ir
  // hacia atrás en el reloj; lo que muestra que no es una secuencia temporal es lo que queda fuera: «suelto» se
  // escribió entre a y b y no está en el hilo.
  const a = await escribe(eje, id, 'a', undefined, 'raiz', '2026-11-07T12:00:00Z');
  const suelto = await escribe(eje, id, 'suelto', undefined, 'raiz', '2026-11-07T12:10:00Z');
  const b = await escribe(eje, a.id, 'b', undefined, 'raiz', '2026-11-07T12:20:00Z');
  const c = await escribe(eje, b.id, 'c', undefined, 'raiz', '2026-11-07T12:30:00Z');
  assert.deepEqual(eje.hilo(c.id).map((e) => e.id), [c.id, b.id, a.id, id]);
  assert.equal(eje.hilo(c.id).some((e) => e.id === suelto.id), false);
});

test('BTML-65 lo disponible depende del descubrimiento: observadores con distintos subconjuntos reconstruyen distinto', async () => {
  const { eje, id } = await ejeCon(['Casa', 'recurso']);
  await escribe(eje, id, 'uno', '1000000000');
  await escribe(eje, id, 'dos', '1000000000');
  const eventos = JSON.parse(JSON.stringify(serializar(eje))).eventos;
  const quienVioPoco = await Eje.desde(eventos.slice(0, 2));
  const quienVioTodo = await Eje.desde(eventos);
  assert.equal(ocupantes(quienVioPoco, id, [1]).length, 2);
  assert.equal(ocupantes(quienVioTodo, id, [1]).length, 3);
});

test('BTML-65b los permisos de lectura limitan lo que cada observador reúne',
  { skip: 'BTML-65: no hay permisos de lectura en el eje ni en el encaje: arbol() y ocupantes() reúnen todo el eje que tiene el observador. Solo BQL pregunta, desde la PR #36, integrada, al gancho opcional puedeLeer por cada lectura y por cada ocupante (O-12b, O-12c); el modelo de permisos es de AARPIA (mapa §12)' },
  sinForma('BTML-65'));

// =====================================================================
// BTML · matrix_data/block_data
// =====================================================================

test('BTML-67 matrix_data y block_data son dos escalas de datos distintas que no se aplastan',
  { skip: 'BTML-67: matrix_data y block_data no existen en el código; su interpretación técnica está pendiente (BTML-68 [X])' },
  sinForma('BTML-67'));

test('BTML-69 las potencias 4^4, 5^5, 6^6, 7^7… no son magnitudes equivalentes ni direcciones BTML', async () => {
  const potencias = [4 ** 4, 5 ** 5, 6 ** 6, 7 ** 7, 4 * 4, 5 ** 2, 55];
  for (const m of Object.keys(MODOS)) assert.equal(potencias.includes(lectura(m)), false, m); // las capacidades no son esas escalas
  assert.equal(ARIDAD, 10);
  assert.equal(esDireccion('4^4'), false);
  const { eje, id } = await ejeCon(['Casa', '4^4', '7^7']);
  assert.equal(evaluar(eje, id, [1]).valor.tipo, 'texto'); // en un slot, un nombre más
  assert.equal(consultar(eje, id, [0], '4^4').estado, 'ERROR'); // ninguna ecuación las convierte
});

// =====================================================================
// BTML · encaje (motor)
// =====================================================================

test('B:MOT-01 un fallo no borra alternativas: la referencia rota sigue siendo ocupante, sin dato inventado', async () => {
  const { eje, id } = await ejeCon(['Casa']);
  const x = await escribe(eje, id, ['X', { ref: ID_INEXISTENTE }]);
  await escribe(eje, x.id, 'escrito', '1000000000');
  const oc = ocupantes(eje, x.id, [1]);
  assert.deepEqual(oc.map((o) => o.origen).sort(), ['escrito', 'propio', 'referencia']);
  const rota = oc.find((o) => o.origen === 'referencia');
  assert.equal(rota.rota, true);
  assert.equal(rota.contenido, undefined);
});

test('B:MOT-01b al descubrir, la referencia ausente es un candidato pendiente explicado, no un error', async () => {
  const { eje, id } = await ejeCon(['Casa']);
  const x = await escribe(eje, id, ['X', { ref: ID_INEXISTENTE }, '=LOCAL(1)']);
  const [p1] = descubrir(eje, x.id, { posiciones: [1] });
  const rota = p1.candidatos.find((o) => o.origen === 'referencia');
  assert.equal(rota.estado, 'PENDIENTE');
  assert.match(rota.texto, /^PENDIENTE: evento ausente del eje/);
  assert.equal(rota.contenido, undefined); // sin dato inventado
  assert.equal(p1.candidatos.length, 2); // y sin borrar la alternativa
});

test('B:MOT-01c en BQL, la referencia ausente es un pendiente explicado', async () => {
  const { eje, id } = await ejeCon(['Casa']);
  const x = await escribe(eje, id, ['X', { ref: ID_INEXISTENTE }, '=LOCAL(1)']);
  const r = evaluar(eje, x.id, [2]);
  assert.equal(r.estado, 'PENDIENTE');
  assert.ok(r.motivo);
});

test('B:MOT-02 descubrir no elige una sola opción: conserva por posición las alternativas de igual posición y distinto id', async () => {
  const { eje, id } = await ejeCon(['Casa', 'recurso']);
  await alta(eje, 'ana');
  const a = await escribe(eje, id, 'opción A', '1000000000');
  const b = await escribe(eje, id, 'opción B', '1000000000', 'ana');
  const [p1] = descubrir(eje, id, { posiciones: [1] });
  assert.equal(p1.dir, '1000000000');
  assert.deepEqual(p1.candidatos.map((c) => c.evento), [id, a.id, b.id]);
  assert.deepEqual(p1.candidatos.map((c) => c.texto), ['recurso', 'opción A', 'opción B']);
});

test('B:MOT-03 consolidar es la única fijación y no borra: un evento nuevo, con referencias a sus fuentes y el vector de cada una', async () => {
  const { eje, id } = await ejeCon(['Casa', 'recurso', 'criterio']);
  await alta(eje, 'ana');
  const fuente = await escribe(eje, id, ['Oferta', 'grande'], '1000000000');
  const antes = eje.orden.length;
  const elegido = descubrir(eje, id, { posiciones: [1] })[0].candidatos.find((x) => x.evento === fuente.id);
  const c = await consolidar(eje, { autor: 'ana', foco: id, t: T0, elecciones: { 1: { candidato: elegido }, 2: 'nuevo criterio' } });
  assert.equal(eje.orden.length, antes + 1);
  assert.deepEqual(c.payload[1], { ref: fuente.id, dir: '0000000000' });
  assert.equal(JSON.stringify(c.payload).includes('grande'), false); // no copia el árbol
  assert.deepEqual(c.contexto.fuentes, [fuente.id]);
  assert.equal(c.contexto.encaje[0].evento, fuente.id);
  assert.equal(c.contexto.encaje[0].vector.length, 10);
  assert.ok(ocupantes(eje, id, [1]).some((o) => o.evento === fuente.id)); // la fuente sigue ahí
});

// =====================================================================
// Reglas con fuerza «propuesta» o «abierto»: sin prueba hasta que VG decida.
// Se listan con su id para que no se conviertan en regla por accidente.
// =====================================================================
//
//   BTML-16 [abierto]   cómo se escribe «desconocido», «reservado» u otros estados de ranura (presente, derivado,
//                       enlazado, no aplicable, disputado) en una décupla sin null.
//   BTML-21 [propuesta] recursos agotados → PENDIENTE POR LÍMITE (hoy ERROR «presupuesto agotado»; seguir() marca rota).
//   BTML-22 [abierto]   referencia a un destino ausente o inaccesible: ¿se admite al escribir?, ¿cómo se marca al leer?
//                       (hoy se admite y sale rota: true; ver BTML-18 y B:MOT-01).
//   BTML-24 [abierto]   si «ID+posición» y «posición+ID» son operaciones distintas; sin sintaxis, precedencia ni tipos.
//   BTML-30 [abierto]   dos orientaciones ("1100000000" frente a "0000000011") como hipótesis de construcción/almacenamiento.
//   BTML-37 [abierto]   reglas del tercer cero (orientativo/agregación), distinción nodo/hijo 0, anclaje y época.
//   BTML-38 [propuesta] dos nodos con la misma cadena "8412000000" y rutas distintas exigen desambiguación en la
//                       interfaz y en REF (hoy REF(id, dir) y {ref, dir} leen el camino base sin señalar la colisión).
//   BTML-41 [abierto]   ENCAJAR V0 es contrato conceptual; fórmula total, desempate y composición de anclajes en V5.
//   BTML-49 [abierto]   qué ordena a los no exactos y qué significa cada signo (opciones A–E). El MAPA §12 recoge que
//                       VG eligió la opción B el 7-11 por la tarde; aquí sigue en el bloque porque la regla llegó como
//                       abierta. Lo que B dice ya se prueba en BTML-48, BTML-51 y BTML-53.
//   BTML-52 [propuesta] orden en cinco criterios (compatibilidad, referencias, prefijos, vector, precedentes).
//   BTML-62 [abierto]   si una hilera o una décupla se anidan en una posición concreta del foco o siempre en su raíz.
//   BTML-66 [abierto]   si las estructuras transmisibles A (PV1–4) y B (PV6–9) sobreviven como empaquetado.
//   BTML-68 [abierto]   interpretación técnica de matrix_data y block_data (se conservan como nombres).
