// La época 0 como registro BTML (datos/epocas/epoca-0.btml.json), leída con
// la cruceta (VG, 9-11, mapa §16 [D]): sin posiciones vacías, con las mismas
// cien reglas cortas que el formato de siempre, y legible con el BQL mínimo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EPOCA_0, EPOCA_0_BTML, EPOCAS, CORTES_PROVISIONALES, cargarEpocaBtml, leerDireccion } from '../src/epocas.js';
import { EPOCA_0_BTML_DATOS } from '../datos/epocas/epocas.js';
import { validarPayload, esTerminal } from '../src/btml.js';
import { FAMILIAS, ESCALAS_T, ESCALAS_INFORMATIVAS, ASIGNACION_T, PARTES_T } from '../src/tokens.js';
import { MODOS } from '../src/modos.js';
import { evaluar, PRIMITIVAS } from '../src/bqlm.js';
import { ContextoEje } from '../src/contexto-eje.js';

const DIEZ = [...Array(10).keys()];
const JSON_EN_DISCO = JSON.parse(readFileSync(new URL('../datos/epocas/epoca-0.btml.json', import.meta.url), 'utf8'));
const ctx = new ContextoEje(null, { epoch: EPOCA_0_BTML });
const val = (src) => {
  const r = evaluar(src, ctx);
  assert.equal(r.estado, 'RESUELTO', src + ': ' + r.motivo);
  return r.valor;
};
const uno = (src) => {
  const v = val(src);
  assert.equal(v.length, 1, src);
  return v[0];
};

/** Recorre un payload y devuelve las rutas de los arrays vacíos y de los huecos. */
function vacios(x, ruta = 'raíz') {
  if (!Array.isArray(x)) return [];
  if (x.length === 0) return [ruta];
  const fuera = [];
  for (let i = 0; i < x.length; i++) {
    if (!(i in x) || x[i] === null || x[i] === undefined) fuera.push(ruta + '.' + i + ' (hueco)');
    else fuera.push(...vacios(x[i], ruta + '.' + i));
  }
  return fuera;
}

test('el JSON es la décupla que se carga: epocas.js la copia y es un payload BTML válido', () => {
  assert.deepEqual(EPOCA_0_BTML_DATOS, JSON_EN_DISCO);
  assert.deepEqual(validarPayload(JSON_EN_DISCO), { ok: true, errores: [] });
  assert.deepEqual(EPOCA_0_BTML.registro, JSON_EN_DISCO);
  assert.ok(Object.isFrozen(EPOCA_0_BTML.registro) && Object.isFrozen(EPOCA_0_BTML.registro[5][3][2]), 'congelada en profundidad');
  assert.equal(EPOCAS['época 0'], EPOCA_0, 'el registro de épocas sigue con la época 0 de siempre');
});

test('sin posiciones vacías (VG: nunca []): ningún array vacío ni hueco; la raíz y cada regla, con las diez', () => {
  assert.deepEqual(vacios(JSON_EN_DISCO), []);
  assert.equal(JSON_EN_DISCO.length, 10);
  for (const d of DIEZ) assert.ok(JSON_EN_DISCO[d] !== undefined, 'la raíz lleva el ' + d);
  for (const r of EPOCA_0_BTML.condiciones) {
    assert.equal(r.length, 10);
    for (const d of DIEZ) assert.ok(Array.isArray(r[d]) && r[d].length > 0 && r[d].every(esTerminal), 'cada posición de la regla lleva algo, en forma canónica');
  }
});

test('las cien reglas cortas coinciden en los dos formatos, sin perder texto', () => {
  assert.equal(EPOCA_0_BTML.reglas.length, 100);
  for (const p of DIEZ) {
    for (const d of DIEZ) {
      const vieja = EPOCA_0.regla(p, d);
      const nueva = EPOCA_0_BTML.regla(p, d);
      assert.deepEqual({ ...nueva }, { profundidad: p, digito: d, nombre: vieja.nombre, significado: vieja.significado, ejemplo: vieja.ejemplo }, p + '.' + d);
      assert.equal(EPOCA_0_BTML.reglaCorta(p, d), EPOCA_0.reglaCorta(p, d));
      // Y con el BQL mínimo: 5.p.d = [[nombre], [significado], [ejemplo]].
      assert.equal(uno('epoch.5.' + p + '.' + d + '.0'), vieja.nombre);
    }
  }
  assert.equal(EPOCA_0_BTML.regla(10, 0), undefined);
  for (const dir of ['1400000000', '7623000000', '0000000000']) assert.deepEqual(leerDireccion(dir, EPOCA_0_BTML), leerDireccion(dir, EPOCA_0));
});

test('1: las cuatro familias con su estructura; T, diez escalas como dígitos con su asignación diaria en el 1', () => {
  FAMILIAS.forEach((f, k) => assert.equal(uno('first epoch.1.' + k + '.0'), f));
  assert.deepEqual([0, 1, 2, 3].map((k) => uno('epoch.1.0.1.' + k)), ['financiero y material', 'conocimiento e información', 'social y relacional', 'productivo y capacidad']);
  assert.deepEqual([0, 1, 2, 3, 4].map((k) => uno('epoch.1.1.1.' + k)), ['económico', 'administrativo', 'social', 'técnico', 'de encaje']);
  assert.match(uno('epoch.1.1.2'), /\[X\] confirmar VG/);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((k) => uno('epoch.1.2.1.' + k)), ['su R', 'E', 'P', 'mi R devuelta', 'vetado', 'desconocidos']);
  assert.match(uno('epoch.1.2.2'), /\[X\] confirmar VG/);
  // T: el dígito de cada escala es el de D-SERIE (tokens.ESCALAS_T), y su 1, la asignación diaria del eje.
  ESCALAS_T.forEach((e, k) => {
    const asignacion = uno('epoch.1.3.1.' + k + '.1');
    if (ESCALAS_INFORMATIVAS.includes(e)) assert.equal(asignacion, 'sin límite', e);
    else {
      assert.equal(asignacion, ASIGNACION_T[e], e);
      assert.equal(uno('epoch.1.3.1.' + k + '.2'), PARTES_T[e] ?? 1, e + ': en partes de');
    }
  });
  assert.equal(uno('epoch.1.3.1.(("T:hora").1).1'), 24, 'la escala de una serie de T indexa su asignación');
});

test('2: la lista de referencias a los registros de las reglas, en el orden de su 8; la primera, «writing burns today\'s T»', () => {
  // VG, 10-11, A1: cada regla es su propio registro y el 2 de la época es la lista de referencias, una hoja por regla.
  const reglas = EPOCA_0_BTML.condiciones;
  assert.equal(reglas.length, 27);
  assert.equal(JSON_EN_DISCO[2].length, reglas.length);
  assert.ok(JSON_EN_DISCO[2].every((x) => Object.keys(x).join() === 'ref' && /^[0-9a-f]{64}$/.test(x.ref)), 'el 2 son referencias { ref }');
  assert.deepEqual(EPOCA_0_BTML.reglasConId.map((x) => x.id), JSON_EN_DISCO[2].map((x) => x.ref));
  // El 8 encadena las reglas: la primera es «first» y cada una va «after» la anterior.
  reglas.forEach((r, k) => assert.equal(r[8][0], k === 0 ? 'first' : 'after ' + reglas[k - 1][0][0], r[0][0]));
  assert.equal(new Set(reglas.map((r) => r[0][0])).size, reglas.length, 'sin nombres repetidos');
  for (const r of reglas) {
    assert.match(r[2][0], /^=/);
    assert.ok(r[4].every((p) => PRIMITIVAS.includes(p)), r[0][0] + ': su 4 son primitivas');
    assert.deepEqual(r[7], ['epoch 0']);
  }
  // Con el BQL mínimo, el 2 da las reglas (cada referencia lleva a su registro): first, nth k.
  assert.equal(uno('count epoch.2'), 27);
  assert.equal(evaluar('first epoch.2', ctx).texto, JSON_EN_DISCO[2][0].ref, 'una regla se lee por su id');
  assert.equal(uno('first epoch.2 = "' + JSON_EN_DISCO[2][0].ref + '"'), true, 'y vale su id');
  assert.equal(uno('(first epoch.2).0'), "writing burns today's T");
  assert.deepEqual(val('(first epoch.2).1'), [1, 7, 'epoch.1.3.1']);
  assert.match(uno('(first epoch.2).2'), /^=\(count \(ev\.1 where T in it\.0\.0/);
  assert.deepEqual(val('(first epoch.2).3'), ['ev.3']);
  assert.deepEqual(val('(first epoch.2).4'), ['burn', 'transfer']);
  assert.deepEqual(val('(first epoch.2).5'), ['*']);
  assert.ok(val('(first epoch.2).6').every((l) => /^VG, \d+-11/.test(l)));
  assert.deepEqual(val('(first epoch.2).7'), ['epoch 0']);
  assert.deepEqual(val('(first epoch.2).8'), ['first']);
  assert.match(uno('(first epoch.2).9'), /\{first ev\.3\}/);
  assert.equal(uno('(nth 26 epoch.2).0'), 'P moves within a known scope');
  assert.deepEqual(val('epoch.2.0'), reglas.map((r) => r[0][0]), 'el 0 de cada una');
});

test('reglas como registros: un archivo por regla (su 0 en kebab), id = hash del cuerpo canónico, y la raíz al día', async () => {
  const { reglasDe, raizConReglas, kebab, idDe } = await import('../datos/epocas/generar.mjs');
  const { REGLAS_DE_EPOCA_DATOS } = await import('../datos/epocas/epocas.js');
  const { hash, canonico } = await import('../src/evento.js');
  const enDisco = reglasDe();
  assert.equal(enDisco.length, 27);
  for (const { archivo, id, registro } of enDisco) {
    assert.equal(archivo, kebab(registro[0][0]) + '.json');
    assert.equal(id, await hash(canonico(registro)), archivo + ': el id es el hash de su cuerpo canónico, como el de un evento');
    assert.equal(idDe(registro), id);
    assert.deepEqual(vacios(registro), [], archivo + ': sin posiciones vacías');
    assert.deepEqual(validarPayload(registro), { ok: true, errores: [] });
  }
  assert.deepEqual(REGLAS_DE_EPOCA_DATOS, enDisco, 'epocas.js lleva los registros de reglas/');
  assert.deepEqual(raizConReglas(), JSON_EN_DISCO, 'el 2 de la raíz es el que genera `npm run epocas` desde reglas/');
  assert.equal(kebab("P is minted on one's own record"), 'p-is-minted-on-one-s-own-record');
});

test('corregir una regla es añadir un ocupante a su registro: el id no cambia y manda el último', async () => {
  const { REGLAS_DE_EPOCA_DATOS } = await import('../datos/epocas/epocas.js');
  const { evaluarRegla } = await import('../src/bqlm.js');
  const primera = EPOCA_0_BTML.reglasConId[0];
  const correccion = { archivo: 'prueba.json', sobre: primera.id, en: '2', ocupante: '=1 = 2', de: 'prueba' };
  const corregida = cargarEpocaBtml(JSON_EN_DISCO, { registros: REGLAS_DE_EPOCA_DATOS, correcciones: [correccion] });
  assert.equal(corregida.reglasConId[0].id, primera.id, 'el registro de la regla no cambia, ni su id');
  assert.deepEqual(corregida.condiciones[0][2], [...primera.regla[2], '=1 = 2'], 'la corrección va detrás de lo suyo');
  const ctx2 = new ContextoEje(null, { epoch: corregida });
  assert.equal(evaluarRegla(corregida.condiciones[0], ctx2).pasa, false, 'vale el último ocupante del 2');
  assert.equal(evaluar('last (first epoch.2).2', ctx2).texto, '=1 = 2');
  assert.throws(() => cargarEpocaBtml(JSON_EN_DISCO, { registros: REGLAS_DE_EPOCA_DATOS, correcciones: [{ ...correccion, sobre: 'ab'.repeat(32) }] }), /no es sobre una regla de la época/);
  assert.throws(() => cargarEpocaBtml(JSON_EN_DISCO, { registros: REGLAS_DE_EPOCA_DATOS, correcciones: [{ ...correccion, en: '12' }] }), /un dígito/);
});

test('3 a 9: plantilla de identidad, primitivas y despliegues, procedencia, calendario, cortes y modos, plantillas y tutorial', () => {
  assert.equal(uno('epoch.3.1'), 'el autor del génesis');
  assert.match(uno('epoch.3.0.1'), /^cartera/);
  assert.match(uno('epoch.3.0.2'), /P posicionado/);
  assert.match(uno('epoch.3.0.3'), /grupos de atención y R/);
  assert.match(uno('epoch.3.0.7'), /^tiempo/);
  assert.deepEqual(DIEZ.map((d) => val('epoch.3.0.' + d).length), DIEZ.map(() => 1), 'la plantilla dice qué va en cada una de las diez');
  assert.deepEqual([0, 1, 2, 3, 4].map((k) => uno('epoch.4.0.' + k + '.0')), [...PRIMITIVAS]);
  assert.deepEqual([0, 1, 2, 3, 4].map((k) => uno('epoch.4.1.' + k + '.0')), ['D-META', 'D-MOV', 'D-SERIE', 'D-FECHA', 'D-VALOR']);
  assert.ok(val('epoch.6').length >= 10 && val('epoch.6').every((l) => /^VG, \d+-11/.test(l)), 'una línea por decisión de VG, con fecha');
  assert.deepEqual([0, 1, 2, 3].map((k) => uno('epoch.7.0.' + k + '.1')), [1, 7, 28, 365]);
  assert.equal(uno('epoch.7.1'), 'el tiempo lo marcan los demás');
  assert.deepEqual(val('epoch.8.0'), [...CORTES_PROVISIONALES]);
  assert.deepEqual(EPOCA_0_BTML.cortesConOrigen(), { cortes: [...CORTES_PROVISIONALES], origen: 'epoca' });
  assert.deepEqual(EPOCA_0_BTML.cortes('lo que sea'), EPOCA_0.cortes());
  DIEZ.forEach((n) => assert.deepEqual([uno('epoch.8.1.' + n + '.0'), uno('epoch.8.1.' + n + '.1')], n ? [10 ** (n - 1), 10 ** n] : [0, 0], 'orden ' + n));
  for (const [k, m] of ['pointed', 'sequenced', 'mapped', 'scened'].entries()) {
    assert.deepEqual([uno('epoch.8.2.' + k + '.0'), uno('epoch.8.2.' + k + '.1'), uno('epoch.8.2.' + k + '.2')], [MODOS[m].nombre, MODOS[m].minimo, MODOS[m].maximo]);
  }
  assert.deepEqual(val('epoch.9.0.0.1'), ['weighted sum', 'weighted mean', 'threshold']);
  assert.deepEqual(val('epoch.9.0.1.1'), ['all announced movements happened']);
  assert.deepEqual([uno('epoch.9.0.2.1'), uno('epoch.9.0.2.2')], ['desconocidos', 'my own R']);
  assert.deepEqual(val('epoch.9.1'), [5, 4, 1, 7, 2, 8, 9, 3, 'segunda alta']);
  assert.equal(EPOCA_0_BTML.nombre, 'época 0');
  assert.deepEqual(val('epoch.0'), ['época 0', 'epoch 0']);
});

test('cargarEpocaBtml rechaza una época con posiciones vacías, sin las diez o con una regla incompleta', async () => {
  const { REGLAS_DE_EPOCA_DATOS } = await import('../datos/epocas/epocas.js');
  const copia = () => JSON.parse(JSON.stringify(JSON_EN_DISCO));
  const con = (f) => { const e = copia(); f(e); return e; };
  const cargar = (e, registros = REGLAS_DE_EPOCA_DATOS) => cargarEpocaBtml(e, { registros });
  const conRegla = (k, f) => REGLAS_DE_EPOCA_DATOS.map((x) => (x.id === JSON_EN_DISCO[2][k].ref ? { ...x, registro: f(JSON.parse(JSON.stringify(x.registro))) } : x));
  assert.throws(() => cargar(con((e) => { e[7][1] = []; })), /array vacío/);
  assert.throws(() => cargar(copia().slice(0, 9)), /las diez posiciones llenas/);
  assert.throws(() => cargarEpocaBtml(JSON_EN_DISCO), /no está entre los registros de la época/, 'sin los registros, las referencias del 2 no resuelven');
  assert.throws(() => cargar(con((e) => { e[2] = [[['una regla escrita dentro']]]; })), /lista de referencias/);
  assert.throws(() => cargar(JSON_EN_DISCO, conRegla(0, (r) => r.slice(0, 9))), /regla 1 del 2 \([0-9a-f]{8}\) lleva las diez/);
  assert.throws(() => cargar(JSON_EN_DISCO, conRegla(13, (r) => { r[2] = ['count ev.1 >= 1']; return r; })), /regla 14 del 2 \([0-9a-f]{8}\) lleva su condición «=…»/);
  assert.throws(() => cargar(con((e) => { e[5][4] = e[5][4].slice(0, 9); })), /profundidad 4 lleva diez/);
  assert.throws(() => cargar(con((e) => { e[5][0][0] = [['representación'], ['solo dos']]; })), /regla corta 0\.0/);
  assert.throws(() => cargar(con((e) => { e[8][0] = [3, 2, 1]; })), /nueve umbrales/);
});
