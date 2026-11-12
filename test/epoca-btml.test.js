// La época 0 como registro BTML (datos/epocas/epoca-0.btml.json), leída con
// la cruceta (VG, 9-11, mapa §16 [D]): sin posiciones vacías, con las mismas
// cien reglas cortas que el formato de siempre, y legible con el BQL mínimo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EPOCA_0, EPOCA_0_BTML, EPOCAS, CORTES_PROVISIONALES, cargarEpocaBtml, leerDireccion } from '../src/epocas.js';
import { EPOCA_0_BTML_DATOS } from '../datos/epocas/epocas.js';
import { validarPayload, esTerminal } from '../src/btml.js';
import { FAMILIAS, ESCALAS_T, ESCALAS_REALES, ESCALAS_INFORMATIVAS, ASIGNACION_T, PARTES_T, SEGUNDOS } from '../src/tokens.js';
import { MODOS } from '../src/modos.js';
import { evaluar, analizar, rellenar, PRIMITIVAS } from '../src/bqlm.js';
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
  // Encargo 3c-2a (VG, tras 3b-bis): la orientación de una E es el token que la paga: cada orientación lleva su precio [[en qué], [cuánto]].
  assert.deepEqual([0, 1, 2, 3].map((k) => uno('epoch.1.0.1.' + k + '.0')), ['financiero y material', 'conocimiento e información', 'social y relacional', 'productivo y capacidad']);
  assert.deepEqual([0, 1, 2, 3].map((k) => uno('epoch.1.0.1.' + k + '.2.0')), ['E', 'P', 'R', 'T']);
  // Encargo 3c-2a (VG, tras 3b-bis): P por mirada; los cinco criterios quedan como etiquetas de las miradas 1-5.
  assert.deepEqual([0, 1, 2, 3, 4].map((k) => uno('epoch.1.1.1.' + k + '.0')), ['económico', 'administrativo', 'social', 'técnico', 'de encaje']);
  assert.deepEqual([0, 1, 2, 3, 4].map((k) => uno('epoch.1.1.1.' + k + '.1')), [1, 2, 3, 4, 5]);
  assert.match(uno('epoch.1.1.2'), /P por mirada/);
  // P (encargo 3b, mapa §15 [D]): lo que se obtiene (diez por registro, por E y por R) y los factores de subir y bajar.
  assert.deepEqual([uno('epoch.1.1.4.1'), ...val('epoch.1.1.4.2')], [10, 0.1, 1.1]);
  // R (encargo 3b, mapa §16 [D] «PV3 = regla de atención»): las seis zonas, cada una con su precio por defecto.
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((k) => uno('epoch.1.2.1.' + k + '.0')), ['desconocidos', 'comercial', 'expertos', 'cercanos', 'equipo', 'vetados']);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((k) => uno('epoch.1.2.1.' + k + '.1')), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((k) => uno('epoch.1.2.1.' + k + '.2.0')), ['my R', 'E', 'P', 'their R', 'open record', 'nothing']);
  assert.match(val('epoch.1.2.2').at(-1), /seis grupos son seis precios/);
  // T: el dígito de cada escala es el de D-SERIE (tokens.ESCALAS_T), y su 1, la asignación diaria del eje.
  ESCALAS_T.forEach((e, k) => {
    const asignacion = uno('epoch.1.3.1.' + k + '.1');
    if (ESCALAS_INFORMATIVAS.includes(e)) assert.equal(asignacion, 'sin límite', e);
    else {
      assert.equal(asignacion, ASIGNACION_T[e], e);
      assert.equal(uno('epoch.1.3.1.' + k + '.2'), PARTES_T[e] ?? 1, e + ': en partes de');
    }
  });
  const conHora = new ContextoEje(null, { epoch: EPOCA_0_BTML, ev: { autor: 'a', sobre: null, t: '2026-11-09T10:00:00Z', movimientos: [{ token: 'T', escala: 'hora', cantidad: 1, de: 'a', a: null }], payload: ['x'] } });
  assert.equal(evaluar('epoch.1.3.1.((first ev.1).0.0.1).1', conHora).valor[0], 24, 'la escala de la serie de un movimiento de T indexa su asignación');
});

test('2: la lista de referencias a los registros de las reglas, en el orden de su 8; la primera, «writing burns today\'s T»', () => {
  // VG, 10-11, A1: cada regla es su propio registro y el 2 de la época es la lista de referencias, una hoja por regla.
  // B5: las lecturas («read» en su 4) van en el 2 detrás de las condiciones, en la misma cadena del 8; encargo 3b: las
  // reglas que escriben («put» en su 4, la obtención de P) van entre unas y otras.
  const reglas = EPOCA_0_BTML.reglasConId.map((x) => x.regla);
  // Encargo «lecturas» (issue #12): las diez lecturas de los puntos de vista («point of view» en su 4) van al final.
  // VG 12-11 (estudio BQL-transacciones): tres lecturas más, el movimiento con fecha (X.7.9), su fecha (X.7.7) y los tres relojes (X.6.9);
  // y el coste de escribir (decisión 7), una lectura sobre la candidata.
  assert.deepEqual([EPOCA_0_BTML.condiciones.length, EPOCA_0_BTML.escrituras.length, EPOCA_0_BTML.lecturas.length, EPOCA_0_BTML.lecturasDePv.length], [30, 3, 14, 10]);
  assert.equal(JSON_EN_DISCO[2].length, reglas.length);
  assert.ok(JSON_EN_DISCO[2].every((x) => Object.keys(x).join() === 'ref' && /^[0-9a-f]{64}$/.test(x.ref)), 'el 2 son referencias { ref }');
  assert.deepEqual(EPOCA_0_BTML.reglasConId.map((x) => x.id), JSON_EN_DISCO[2].map((x) => x.ref));
  // El 8 encadena las reglas: la primera es «first» y cada una va «after» la anterior.
  reglas.forEach((r, k) => assert.equal(r[8][0], k === 0 ? 'first' : 'after ' + reglas[k - 1][0][0], r[0][0]));
  assert.equal(new Set(reglas.map((r) => r[0][0])).size, reglas.length, 'sin nombres repetidos');
  for (const r of reglas) {
    const dePv = r[4].length === 1 && r[4][0] === 'point of view';
    if (dePv) assert.ok(r[2].every((f) => /^=/.test(f) || /^js [a-z]+$/.test(f)), r[0][0] + ': cada ocupante de su 2, una fórmula o una lectura JS nombrada');
    else assert.match(r[2][0], /^=/);
    assert.ok(r[4].every((p) => PRIMITIVAS.includes(p) || p === 'put') || (r[4].length === 1 && r[4][0] === 'read') || dePv, r[0][0] + ': su 4 son primitivas (y put si escribe), read si es una lectura o point of view si es la de un PV');
    assert.deepEqual(r[7], ['epoch 0']);
  }
  // Con el BQL mínimo, el 2 da las reglas (cada referencia lleva a su registro): first, nth k.
  assert.equal(uno('count epoch.2'), 57);
  assert.equal(evaluar('first epoch.2', ctx).texto, JSON_EN_DISCO[2][0].ref, 'una regla se lee por su id');
  assert.equal(uno('first epoch.2 = "' + JSON_EN_DISCO[2][0].ref + '"'), true, 'y vale su id');
  assert.equal(uno('(first epoch.2).0'), "writing burns today's T");
  assert.deepEqual(val('(first epoch.2).1'), [1, 'epoch.7.0', 'epoch.1.3.1']);
  assert.match(uno('(first epoch.2).2'), /^=\(count \(ev\.1 where T in it\.0\.0/);
  assert.deepEqual(val('(first epoch.2).3'), ['ev.3']);
  assert.deepEqual(val('(first epoch.2).4'), ['burn', 'transfer']);
  assert.deepEqual(val('(first epoch.2).5'), ['*']);
  assert.ok(val('(first epoch.2).6').every((l) => /^(\[provisional\] )?VG, \d+-11/.test(l)), 'cada procedencia cita a VG y su fecha (marcada [provisional] si lo es)');
  assert.deepEqual(val('(first epoch.2).7'), ['epoch 0']);
  assert.deepEqual(val('(first epoch.2).8'), ['first']);
  assert.match(uno('(first epoch.2).9'), /\{first ev\.3\}/);
  assert.equal(uno('(nth 42 epoch.2).0'), 'stage', 'las lecturas van detrás');
  assert.equal(uno('(last epoch.2).0'), 'how', 'y al final, las de los diez puntos de vista (del 0 al 9)');
  assert.equal(uno('(nth 29 epoch.2).0'), 'a person joins by an invitation', 'la última condición');
  assert.equal(uno('(nth 30 epoch.2).0'), 'writing a record gives ten P on it', 'y detrás, las que escriben');
  assert.deepEqual(val('epoch.2.0'), reglas.map((r) => r[0][0]), 'el 0 de cada una');
});

test('reglas como registros: un archivo por regla (su 0 en kebab), id = hash del cuerpo canónico, y la raíz al día', async () => {
  const { reglasDe, raizConReglas, kebab, idDe } = await import('../datos/epocas/generar.mjs');
  const { REGLAS_DE_EPOCA_DATOS } = await import('../datos/epocas/epocas.js');
  const { hash, canonico } = await import('../src/evento.js');
  const enDisco = reglasDe();
  assert.equal(enDisco.length, 57, '30 condiciones, 3 que escriben, 14 lecturas y las 10 de los puntos de vista');
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
  assert.match(uno('epoch.3.0.3'), /grupos de atención/);
  assert.match(uno('epoch.3.0.7'), /^tiempo/);
  assert.deepEqual(DIEZ.map((d) => val('epoch.3.0.' + d).length), [1, 1, 1, 1, 1, 1, 1, 1, 1, 4], 'la plantilla dice qué va en cada una de las diez; su 9 lleva además el tutorial del alta (encargo 3c-2a)');
  assert.deepEqual(val('epoch.3.0.9').slice(1), ['a key is declared at its alta', 'set a group price', 'anchor here']);
  assert.deepEqual([0, 1, 2, 3, 4].map((k) => uno('epoch.4.0.' + k + '.0')), [...PRIMITIVAS]);
  assert.deepEqual([0, 1, 2, 3, 4].map((k) => uno('epoch.4.1.' + k + '.0')), ['D-META', 'D-MOV', 'D-SERIE', 'D-FECHA', 'D-VALOR']);
  assert.ok(val('epoch.6').length >= 10 && val('epoch.6').every((l) => /^VG, (\d+-11|tras 3b-bis)/.test(l)), 'una línea por decisión de VG, con fecha (o «tras» el encargo que la precede, sin inventarla)');
  // 7: el calendario (VG, 10-11, A3): los segundos de cada escala real, por su dígito (el de D-SERIE); las
  // informativas no se miden. Semana de 7 días, ciclo de 28, año de 364 + 1. Y las escalas que se refieren a otra fecha.
  assert.deepEqual(ESCALAS_REALES.map((e, k) => uno('epoch.7.0.' + k + '.1')), ESCALAS_REALES.map((e) => SEGUNDOS[e]));
  assert.deepEqual(ESCALAS_T.map((e, k) => uno('count epoch.7.0.' + k)), ESCALAS_T.map((e) => (ESCALAS_REALES.includes(e) ? 1 : 0)), 'el calendario mide las reales; las informativas no están');
  assert.deepEqual([3, 4, 5, 6].map((k) => uno('epoch.7.0.' + k + '.2')), [1, 7, 28, 365]);
  assert.match(uno('epoch.7.0.6.3'), /^364 \+ 1/);
  assert.equal(uno('epoch.7.1'), 'el tiempo lo marcan los demás');
  assert.deepEqual(val('epoch.7.2'), [ESCALAS_T.indexOf('pasado'), ESCALAS_T.indexOf('futuro')]);
  assert.equal(SEGUNDOS.anio, 365 * 86400);
  assert.deepEqual(val('epoch.8.0'), [...CORTES_PROVISIONALES]);
  assert.deepEqual(EPOCA_0_BTML.cortesConOrigen(), { cortes: [...CORTES_PROVISIONALES], origen: 'epoca' });
  assert.deepEqual(EPOCA_0_BTML.cortes('lo que sea'), EPOCA_0.cortes());
  DIEZ.forEach((n) => assert.deepEqual([uno('epoch.8.1.' + n + '.0'), uno('epoch.8.1.' + n + '.1')], n ? [10 ** (n - 1), 10 ** n] : [0, 0], 'orden ' + n));
  for (const [k, m] of ['pointed', 'sequenced', 'mapped', 'scened'].entries()) {
    assert.deepEqual([uno('epoch.8.2.' + k + '.0'), uno('epoch.8.2.' + k + '.1'), uno('epoch.8.2.' + k + '.2')], [MODOS[m].nombre, MODOS[m].minimo, MODOS[m].maximo]);
  }
  // Encargo 3b: las plantillas son décuplas [[nombre], [fórmula]] (mapa §15 [D] N4: «todo lo predefinido se traduce
  // por detrás a BQL»).
  assert.deepEqual([0, 1, 2].map((k) => uno('epoch.9.0.0.1.' + k + '.0')), ['weighted sum', 'weighted mean', 'threshold']);
  assert.ok([0, 1, 2].every((k) => /^=/.test(uno('epoch.9.0.0.1.' + k + '.1'))), 'cada plantilla de recuento, una fórmula');
  assert.deepEqual([uno('epoch.9.0.0.2'), uno('epoch.9.0.0.4')], [0, 9], 'el umbral por defecto y la presión máxima');
  assert.deepEqual(val('epoch.9.0.1.1.0.0'), ['all announced movements happened']);
  assert.equal(uno('epoch.9.0.2.1'), 0, 'la atención por defecto: la zona de desconocidos; su precio se lee de epoch.1.2.1 (encargo 3c-2a)');
  assert.match(uno('epoch.9.0.2.2'), /desconocidos/);
  assert.deepEqual([0, 1, 2].map((k) => uno('epoch.9.0.3.1.' + k + '.0')), ['what is missing', 'move what was announced', 'commit P']);
  assert.deepEqual(val('epoch.9.1'), [5, 4, 1, 7, 2, 8, 9, 3, 'segunda alta']);
  assert.equal(EPOCA_0_BTML.nombre, 'época 0');
  assert.deepEqual(val('epoch.0'), ['época 0', 'epoch 0']);
});

/** Los números de un árbol de expresión del BQL mínimo (sus literales). */
function numerosDe(arbol, fuera = []) {
  if (!arbol || typeof arbol !== 'object') return fuera;
  if (arbol.n === 'lit' && typeof arbol.v === 'number') fuera.push(arbol.v);
  for (const v of Object.values(arbol)) if (v && typeof v === 'object' && !Object.isFrozen(v)) numerosDe(v, fuera);
  return fuera;
}

/** Los números que lleva una regla: los de sus posiciones, los de su condición y los de las {expresiones} de su mensaje. */
function numerosDeRegla(regla) {
  const fuera = [];
  for (const posicion of regla) {
    for (const x of posicion) {
      if (typeof x === 'number') fuera.push(x);
      else if (typeof x === 'string' && x.startsWith('=')) numerosDe(analizar(x, { sujeto: regla[4].includes('read') }), fuera);
      else if (typeof x === 'string') for (const [, e] of x.matchAll(/\{([^{}]+)\}/g)) numerosDe(analizar(e), fuera);
    }
  }
  return fuera;
}

test('A3: ninguna regla lleva un número que la época tenga (los datos del mundo se leen de la época)', () => {
  // Los números de la época, fuera de sus reglas: el calendario, las asignaciones, los cortes, los órdenes de magnitud…
  const deLaEpoca = new Set();
  const recoger = (x) => (Array.isArray(x) ? x.forEach(recoger) : typeof x === 'number' && deLaEpoca.add(x));
  JSON_EN_DISCO.forEach((x, d) => d !== 2 && recoger(x));
  // 0 y 1 son la nada y la unidad de contar (count … = 0, count … >= 1), no datos del mundo.
  const neutros = new Set([0, 1]);
  assert.ok(deLaEpoca.has(31536000) && deLaEpoca.has(7) && deLaEpoca.has(24), 'la época lleva el año en segundos, la semana y las horas del día');
  const fuera = [];
  for (const r of [...EPOCA_0_BTML.condiciones, ...EPOCA_0_BTML.escrituras, ...EPOCA_0_BTML.lecturas]) {
    for (const n of numerosDeRegla(r)) if (deLaEpoca.has(n) && !neutros.has(n)) fuera.push(r[0][0] + ': ' + n);
  }
  assert.deepEqual(fuera, []);
  // La prueba ve lo que tiene que ver: una regla con el año escrito no pasa.
  const conAnio = [...EPOCA_0_BTML.condiciones[0]];
  conAnio[2] = ['=(first ev.6.0).0 <= before.6.0.0 + 31536000'];
  assert.deepEqual(numerosDeRegla(conAnio).filter((n) => deLaEpoca.has(n) && !neutros.has(n)), [31536000]);
  // «at most a year ahead» lee el año del calendario de la época.
  const anio = EPOCA_0_BTML.condiciones.find((r) => r[0][0] === 'at most a year ahead');
  assert.match(anio[2][0], /epoch\.7\.0\.6\.1/);
  assert.equal(rellenar('{epoch.7.0.6.1}', ctx), String(SEGUNDOS.anio));
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
