import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generarClaves } from '../src/autoridad.js';
import { ocupantes } from '../src/encaje.js';
import { validarPayload } from '../src/btml.js';
import { EPOCA_0 } from '../src/epocas.js';
import { serializar, restaurar } from '../src/persistencia.js';
import { consultar, evaluar } from '../src/bql.js';
import * as tiempo from '../src/tiempo.js';
import {
  CIELO, ETIQUETAS, HITOS, ALCANCES, SIN_BASE_ESCRITA, MEDIDAS, esRecuento, clavesDeMedidas, cortesDe, medir, estadisticaVacia, unitaria, fundir,
  bloqueDe, cajasEtiquetadas, calcularBase, identidadDe, escribirBase, leerBase, frescura, comprobar, situar, confluir,
  comparables, proyectoDe, hijos, esBase, basesEn, empaquetar, payloadDeBase, baseDePayload, valorDeBases, puedeEscribirBase,
} from '../src/bases.js';
import * as agram from '../src/index.js';
import { COSAS, ejemploComprasHermanas, escribirBaseDe, escribirBasesDelEjemplo } from '../ejemplos/ikisai/compras-hermanas.mjs';

const T_BASES = '2026-11-07T18:00:00Z';
const claves = {};
for (const id of ['casa', ...COSAS, 'cocina']) claves[id] = await generarClaves();
const nuevo = () => ejemploComprasHermanas({ claves });
const hora = (de) => ({ token: 'T', escala: 'hora', cantidad: 1, de, a: null });
const minuto = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });

/** Estadística comparable: claves en orden. */
const ordenar = (o) => Object.fromEntries(Object.entries(o).sort(([x], [y]) => (x < y ? -1 : 1)));
const estadistica = (e) => ({ ...e, medidas: ordenar(e.medidas), tokens: ordenar(e.tokens) });
const iguales = (a, b) => assert.deepEqual(estadistica(a), estadistica(b));
const sumaCajas = (bloque) => bloque.cajas.reduce((s, c) => s + c, 0);
const medidaA = (eje, ids) => ids.map((id) => unitaria(medir(eje, id))).reduce((a, b) => fundir(a, b), estadisticaVacia());
/** La escala provisional de la época 0 (VG, 7-11 noche, decisión 2). */
const ESCALA_0 = [1, 2, 3, 4, 6, 10, 16, 26, 42];
/** Texto canónico (claves ordenadas a cualquier altura), para comparar estadísticas sin depender del orden. */
const canonico = (x) => JSON.stringify(x, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1))) : v));

test('cortes: regla de la época (gancho epoca.cortes); la época 0 trae 1 2 3 4 6 10 16 26 42; otra época sin ellos usa los de la 0', () => {
  assert.deepEqual(clavesDeMedidas(), ['posiciones', 'terminales', 'escritos', 'movimientos', 'identidades', 'profundidadHilo', 'formulasResueltas', 'formulasPendientes']);
  // R7 (VG, 7-11 noche): solo las cantidades tienen cortes; las medidas de MEDIDAS son recuentos informativos.
  assert.ok(MEDIDAS.every((x) => x.recuento === true && esRecuento(x.clave)));
  for (const clave of clavesDeMedidas()) assert.throws(() => cortesDe(clave), /es un recuento informativo: no tiene cortes ni cajas/, clave);
  for (const clave of ['T:hora', 'E:casa/EUR', 'tiempo:minuto']) assert.deepEqual(cortesDe(clave), { cortes: ESCALA_0, origen: 'epoca' }, clave);
  assert.equal(esRecuento('T:hora'), false);
  // Una época que declara cortes manda; donde no dice nada, los de la época 0 (respaldo).
  const epoca = { ...EPOCA_0, nombre: 'época de prueba', cortes: (clave) => (clave === 'T:hora' ? [0, 1, 2, 3, 4, 5, 6, 7, 8] : undefined) };
  assert.deepEqual(cortesDe('T:hora', epoca), { cortes: [0, 1, 2, 3, 4, 5, 6, 7, 8], origen: 'epoca' });
  assert.deepEqual(cortesDe('E:casa/EUR', epoca), { cortes: ESCALA_0, origen: 'respaldo' });
  assert.throws(() => cortesDe('T:hora', { ...epoca, cortes: () => [3, 2, 1] }), /nueve umbrales crecientes/);
  assert.throws(() => cortesDe('inventada'), /medida desconocida/);
  // Cada bloque guarda sus cortes: no se funden cantidades con cortes distintos (no se inventa escala puente).
  const m = { posiciones: 0, terminales: 1, escritos: 1, movimientos: 0, identidades: 0, profundidadHilo: 1, formulasResueltas: 0, formulasPendientes: 0, tokens: { 'T:hora': 1 }, procedencias: Array.from({ length: 10 }, () => ({ propia: false, referencia: false, escrita: false, tiene: false })), raiz: { escrita: false } };
  const b = unitaria(m, epoca);
  assert.deepEqual(b.tokens['T:hora'].cajas, [0, 0, 1, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(b.medidas.escritos, { recuento: true, n: 1, suma: 1, minimo: 1, maximo: 1 }); // sin cortes ni cajas
  assert.throws(() => fundir(unitaria(m), b), /cortes distintos en T:hora/);
  // Los mismos cortes de dos orígenes sí se funden: el bloque lo dice («mixto»).
  const sinCortes = { nombre: 'sin cortes', reglaCorta: EPOCA_0.reglaCorta };
  assert.equal(fundir(unitaria(m), unitaria(m, sinCortes)).tokens['T:hora'].origenCortes, 'mixto');
  // Etiquetas: los diez hitos, con las literales del mapa (auditoría C32); texto informativo de la caja.
  assert.equal(ETIQUETAS, HITOS);
  assert.equal(tiempo.HITOS, HITOS);
  assert.deepEqual([HITOS[2].nombre, HITOS[9].nombre], ['avanzado', 'resolución experimental muy avanzada']);
  assert.equal(agram.bases.leerBase, leerBase); // el índice lo expone como espacio de nombres
});

test('identidadDe: la propia cosa que el registro da de alta; la del génesis, su autor', async () => {
  const ej = await nuevo();
  const { eje } = ej;
  assert.equal(identidadDe(eje, eje.genesisId), 'casa');
  assert.equal(identidadDe(eje, ej.comedor.id), 'comedor');
  assert.equal(identidadDe(eje, ej.menu.id), 'menu-dia');
  assert.equal(identidadDe(eje, ej.puesto.id), 'puesto');
  assert.equal(identidadDe(eje, ej.guisos.id), null); // una compra no es una cosa con clave
  // Una cosa sin clave, o dos cosas en el mismo registro: no hay identidad propia.
  const [x, y] = [await generarClaves(), await generarClaves()];
  const sinClave = await eje.escribir({ autor: 'casa', sobre: eje.genesisId, t: T_BASES, movimientos: [minuto('casa'), { ...minuto('casa'), a: 'caja' }], payload: 'Caja', contexto: { tipos: { caja: 'cosa' } } }, claves.casa.privada);
  const dos = await eje.escribir({
    autor: 'casa', sobre: eje.genesisId, t: T_BASES,
    movimientos: [minuto('casa'), { ...minuto('casa'), a: 'x' }, { ...minuto('casa'), a: 'y' }],
    payload: 'Dos cosas', contexto: { tipos: { x: 'cosa', y: 'cosa' }, claves: { x: x.publica, y: y.publica } },
  }, claves.casa.privada);
  assert.equal(identidadDe(eje, sinClave.id), null);
  assert.equal(identidadDe(eje, dos.id), null);
});

test('medir: una sola medida (bases.medir); tiempo.js ya no mide', async () => {
  const ej = await nuevo();
  const { eje } = ej;
  const guisos = medir(eje, ej.guisos.id);
  for (const viejo of ['medir', 'medidasDe', 'comparar']) assert.equal(tiempo[viejo], undefined, viejo);
  assert.throws(() => medir(eje, 'nadie'), /registro desconocido/);
  assert.deepEqual(
    clavesDeMedidas().map((k) => guisos[k]),
    [5, 9, 0, 2, 2, 3, 1, 1], // posiciones 0–4, nueve terminales, una fórmula resuelta y otra pendiente
  );
  assert.deepEqual(guisos.tokens, { 'T:hora': 1, 'E:casa/EUR': 12 });
  // Un terminal no tiene posición 0: un terminal, ninguna posición.
  assert.deepEqual([medir(eje, ej.cafe.id).terminales, medir(eje, ej.cafe.id).posiciones], [1, 0]);
  assert.equal(medir(eje, ej.menu.id).escritos, 4);
  // Y el T que consumieron quienes escribieron encima (el puesto, una hora de la cocina): R7, una cantidad más.
  assert.deepEqual(medir(eje, ej.mercado.id).tokens, { 'T:minuto': 11, 'E:casa/EUR': 30, 'tiempo:hora': 1 });
  assert.equal(medir(eje, eje.genesisId).profundidadHilo, 0);
});

test('fundir: cada medida con tiempo.fundir; conmutativa, asociativa, con neutro; series ausentes valen cero', async () => {
  const ej = await nuevo();
  const { eje } = ej;
  const [a, b, c] = [ej.guisos, ej.cafe, ej.mercado].map((r) => unitaria(medir(eje, r.id)));
  iguales(fundir(a, b), fundir(b, a));
  iguales(fundir(fundir(a, b), c), fundir(a, fundir(b, c)));
  iguales(fundir(estadisticaVacia(), a), a);
  const abc = fundir(fundir(a, b), c);
  assert.equal(abc.n, 3);
  for (const k of Object.keys(abc.tokens)) assert.equal(sumaCajas(bloqueDe(abc, k)), 3, k);
  for (const k of Object.keys(abc.medidas)) assert.deepEqual([abc.medidas[k].recuento, abc.medidas[k].n, 'cajas' in abc.medidas[k]], [true, 3, false], k);
  // T:minuto solo lo mueve el mercado (11): los otros dos valen cero en esa serie.
  const minutos = abc.tokens['T:minuto'];
  assert.deepEqual([minutos.cajas, minutos.suma, minutos.minimo, minutos.maximo], [[2, 0, 0, 0, 0, 0, 1, 0, 0, 0], 11, 0, 11]);
  assert.deepEqual(bloqueDe(a, 'T:minuto').cajas, [1, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual([abc.medidas.terminales.suma, abc.medidas.terminales.minimo, abc.medidas.terminales.maximo], [9 + 1 + 3, 1, 9]);
  // Por posición: cuántos la tienen desarrollada y por qué procedencia; la raíz aparte.
  assert.deepEqual(abc.posiciones[1], { comparables: 2, propias: 2, referencias: 1, escritas: 0 });
  assert.equal(abc.raiz, 1); // el puesto está escrito en la raíz del mercado
  // Etiquetas de caja: los diez hitos, sin asignar nada, y solo para cantidades (R7).
  const cajas = cajasEtiquetadas(abc, 'T:minuto');
  assert.equal(cajas.length, 10);
  assert.deepEqual(cajas[6], { caja: 6, nivel: HITOS[6].nivel, nombre: HITOS[6].nombre, cuenta: 1 });
  assert.throws(() => cajasEtiquetadas(abc, 'terminales'), /es un recuento informativo: no tiene cajas/);
});

test('calcularBase: los hijos y el subárbol; lo que cuelga de un hijo sin base no cuenta y se dice', async () => {
  const ej = await nuevo();
  const { eje } = ej;
  const compras = [ej.compra, ej.fruta, ej.guisos, ej.cafe].map((r) => r.id);
  const menu = calcularBase(eje, ej.menu.id);
  assert.deepEqual([menu.hijos.n, menu.subarbol.n, menu.hasta, menu.epoca], [4, 5, ej.cafe.id, 'época 0']);
  assert.deepEqual(menu.refsHijos, compras);
  assert.deepEqual([menu.refsBases, menu.sinBase], [[], []]);
  iguales(menu.hijos, medidaA(eje, compras));
  iguales(menu.subarbol, medidaA(eje, [ej.menu.id, ...compras]));
  assert.deepEqual(menu.subarbol.medidas.profundidadHilo, { recuento: true, n: 5, suma: 14, minimo: 2, maximo: 3 }); // un recuento: sin cajas
  // Sin las bases de los menús, el comedor cuenta los menús pero no lo que cuelga de ellos.
  const comedor = calcularBase(eje, ej.comedor.id);
  assert.deepEqual([comedor.hijos.n, comedor.subarbol.n], [2, 3]);
  assert.deepEqual(comedor.sinBase, [ej.menu.id, ej.cena.id]);
  // Un escrito sobre una compra (que no es una cosa): la compra queda sin base y su escrito no cuenta.
  await eje.escribir({ autor: 'casa', sobre: ej.compra.id, t: T_BASES, movimientos: [minuto('casa')], payload: 'Cuenta' }, claves.casa.privada);
  assert.deepEqual(calcularBase(eje, ej.menu.id).sinBase, [ej.compra.id]);
  assert.equal(calcularBase(eje, ej.menu.id).subarbol.n, 5);
});

test('escribirBase: la escribe la propia cosa en el 8 del registro, firmada, y gasta su T', async () => {
  const ej = await nuevo();
  const { eje } = ej;
  assert.equal(eje.saldoT('menu-dia', 'minuto'), 10);
  const ev = await escribirBase(eje, { registro: ej.menu.id, privada: claves['menu-dia'].privada, t: T_BASES });
  assert.deepEqual([ev.autor, ev.firmante, ev.sobre, ev.en], ['menu-dia', 'menu-dia', ej.menu.id, CIELO]);
  assert.deepEqual(ev.contexto, { bases: true, n: 4, nSubarbol: 5, hasta: ej.cafe.id, epoca: 'época 0', sinBase: 0 });
  assert.equal(eje.saldoT('menu-dia', 'minuto'), 9);
  assert.ok(validarPayload(ev.payload).ok);
  assert.ok(esBase(eje, ev));
  // La base no es hija de lo que mide, ni un escrito, ni desarrolla su posición 8.
  assert.equal(medir(eje, ej.menu.id).escritos, 4);
  assert.equal(medir(eje, ej.menu.id).procedencias[8].tiene, false);
  assert.ok(!hijos(eje, ej.menu.id).some((h) => h.id === ev.id));
  // Sin identidad propia, sin firma o con la clave de otro: no se escribe.
  await assert.rejects(escribirBase(eje, { registro: ej.guisos.id, privada: claves.casa.privada, t: T_BASES }), /propia cosa/);
  await assert.rejects(escribirBase(eje, { registro: ej.menu.id, t: T_BASES }), /va firmada/);
  await assert.rejects(escribirBase(eje, { registro: ej.menu.id, privada: claves.casa.privada, t: T_BASES }), /firma inválida de menu-dia/);
  // Una cosa sin nada encima: nada que medir.
  const vacia = await generarClaves();
  const nada = await eje.escribir({ autor: 'casa', sobre: eje.genesisId, t: T_BASES, movimientos: [minuto('casa'), { ...minuto('casa'), a: 'vacia' }], payload: 'Nada', contexto: { tipos: { vacia: 'cosa' }, claves: { vacia: vacia.publica } } }, claves.casa.privada);
  await assert.rejects(escribirBase(eje, { registro: nada.id, privada: vacia.privada, t: T_BASES }), /nada que medir/);
});

test('en el 8 solo es base lo que firma la propia cosa bien formado; lo demás es un hijo más', async () => {
  const ej = await nuevo();
  const { eje } = ej;
  const buena = await escribirBaseDe(ej, ej.menu.id);
  const calculada = calcularBase(eje, ej.menu.id);
  const contexto = { bases: true, n: 4, nSubarbol: 5, hasta: ej.cafe.id, epoca: 'época 0', sinBase: 0 };
  const en8 = (autor, datos) => eje.escribir({ autor, sobre: ej.menu.id, en: CIELO, t: T_BASES, ...datos }, claves[autor]?.privada);
  const intentos = [
    // Una compra que se declara base para esconderse (sin clave ni firma).
    await en8('huesped', { movimientos: [hora('huesped')], payload: ['Compra de pan', 3], contexto: { bases: true } }),
    // Una base bien formada, firmada por otra identidad con clave.
    await en8('cocina', { movimientos: [minuto('cocina')], payload: payloadDeBase(calculada), contexto }),
    // De la propia cosa, con un contexto que no es el de una base.
    await en8('menu-dia', { movimientos: [minuto('menu-dia')], payload: payloadDeBase(calculada), contexto: { ...contexto, profundidad: 'x', desde: 'raro' } }),
    // De la propia cosa, con referencias que no son sus hijos en orden.
    await en8('menu-dia', { movimientos: [minuto('menu-dia')], payload: payloadDeBase({ ...calculada, refsHijos: [...calculada.refsHijos].reverse() }), contexto: { ...contexto, hasta: ej.compra.id } }),
  ];
  // De la propia cosa, con un bloque incoherente: la suma no cabe entre n·mínimo y n·máximo.
  const falsa = JSON.parse(JSON.stringify(payloadDeBase(calculada)));
  falsa[2][0][0][1] = 1000;
  intentos.push(await en8('menu-dia', { movimientos: [minuto('menu-dia')], payload: falsa, contexto }));
  assert.equal(baseDePayload(falsa), null);
  // Fuera del 8 no es una base, se diga lo que se diga.
  intentos.push(await eje.escribir({ autor: 'huesped', sobre: ej.menu.id, en: '1000000000', t: T_BASES, movimientos: [hora('huesped')], payload: 'nota', contexto: { bases: true } }));
  for (const ev of intentos) assert.ok(!esBase(eje, ev), JSON.stringify(ev.payload).slice(0, 40));
  assert.deepEqual(basesEn(eje, ej.menu.id).map((b) => b.id), [buena.id]);
  assert.deepEqual(hijos(eje, ej.menu.id).slice(4).map((h) => h.id), intentos.map((e) => e.id));
  assert.equal(medir(eje, ej.menu.id).escritos, 4 + intentos.length);
  const leida = leerBase(eje, ej.menu.id);
  assert.equal(leida.id, buena.id);
  assert.equal(leida.anteriores, 0);
  assert.deepEqual(leida.frescura, { t: T_BASES, hijosNuevos: intentos.length, basesNuevas: 0, debajo: 0, sinNovedades: false });
  // Una cohorte falsa no sitúa a nadie: la de hermanos sigue siendo la que firmó la cosa.
  assert.equal(situar(eje, ej.guisos.id).base, buena.id);
});

test('leerBase: la más reciente del 8, con frescura; corregir deja la anterior; comprobar recalcula', async () => {
  const ej = await nuevo();
  const { eje } = ej;
  assert.equal(leerBase(eje, ej.menu.id), null);
  const primera = await escribirBaseDe(ej, ej.menu.id);
  const leida = leerBase(eje, ej.menu.id);
  assert.equal(leida.id, primera.id);
  iguales(leida.hijos, calcularBase(eje, ej.menu.id).hijos);
  iguales(leida.subarbol, calcularBase(eje, ej.menu.id).subarbol);
  assert.deepEqual(leida.frescura, { t: T_BASES, hijosNuevos: 0, basesNuevas: 0, debajo: 0, sinNovedades: true });
  assert.deepEqual(comprobar(eje, leida), { alDia: true, diferencias: [] });
  // Algo escrito sobre una compra ya medida: no es una llegada al menú; frescura no lo ve, comprobar sí.
  await eje.escribir({ autor: 'casa', sobre: ej.fruta.id, en: '4000000000', t: '2026-11-07T18:20:00Z', movimientos: [minuto('casa')], payload: 'Ticket' }, claves.casa.privada);
  assert.ok(leerBase(eje, ej.menu.id).frescura.sinNovedades);
  const c = comprobar(eje, leerBase(eje, ej.menu.id));
  assert.equal(c.alDia, false);
  assert.deepEqual(c.diferencias.map((d) => [d.registro, d.refs]), [[ej.menu.id, false]]);
  // El ticket también consumió un minuto sobre la compra: cambia la cantidad «tiempo:minuto» (R7).
  for (const seccion of ['hijos', 'subarbol']) assert.deepEqual(c.diferencias[0][seccion], ['escritos', 'posiciones', 'tiempo:minuto', 'posiciones por PV'], seccion);
  // Llega otra compra hermana: la base envejece.
  await eje.escribir({ autor: 'huesped', sobre: ej.menu.id, t: '2026-11-07T18:30:00Z', movimientos: [hora('huesped')], payload: 'Otro café' });
  assert.equal(leerBase(eje, ej.menu.id).frescura.hijosNuevos, 1);
  // Corregir = escribir otra base; la anterior queda en el 8 como colisión.
  const segunda = await escribirBaseDe(ej, ej.menu.id, { t: '2026-11-07T19:00:00Z' });
  const nueva = leerBase(eje, ej.menu.id);
  assert.deepEqual([nueva.id, nueva.hijos.n, nueva.anteriores, nueva.frescura.sinNovedades], [segunda.id, 5, 1, true]);
  assert.ok(comprobar(eje, nueva).alDia);
  const enElCielo = ocupantes(eje, ej.menu.id, [8]).filter((o) => o.tipo === 'escrito').map((o) => o.evento);
  assert.deepEqual(enElCielo.sort(), [primera.id, segunda.id].sort());
});

test('las seis bases: cada 8 funde las bases de sus hijos; la frescura baja por las fundidas', async () => {
  const ej = await nuevo();
  const { eje } = ej;
  const bases = await escribirBasesDelEjemplo(ej);
  const general = leerBase(eje, eje.genesisId);
  assert.equal(general.id, bases.general.id);
  assert.equal(general.autor, 'casa');
  assert.deepEqual([general.hijos.n, general.subarbol.n], [2, 14]);
  assert.deepEqual(general.refsBases, [bases.proyectos.comedor.id, bases.proyectos.mercado.id]);
  assert.deepEqual([leerBase(eje, ej.comedor.id).subarbol.n, leerBase(eje, ej.mercado.id).subarbol.n], [9, 4]);
  // Lo mismo que medir uno a uno los catorce registros, sin releer ninguno al fundir.
  const todos = eje.orden.filter((id) => !esBase(eje, eje.obtener(id)));
  assert.equal(todos.length, 14);
  iguales(general.subarbol, medidaA(eje, todos));
  assert.deepEqual([general.subarbol.medidas.formulasPendientes.suma, general.subarbol.medidas.formulasResueltas.suma], [1, 2]);
  assert.ok(general.frescura.sinNovedades);
  assert.ok(comprobar(eje, general).alDia);
  // Corregir la base del menú deja anticuadas las de arriba: el comedor lo ve en sus hijos; el génesis, debajo.
  await eje.escribir({ autor: 'vecina', sobre: ej.menu.id, t: '2026-11-07T18:30:00Z', movimientos: [hora('vecina')], payload: 'Un té' });
  assert.deepEqual(frescura(eje, leerBase(eje, eje.genesisId)), { t: T_BASES, hijosNuevos: 0, basesNuevas: 0, debajo: 1, sinNovedades: false });
  await escribirBaseDe(ej, ej.menu.id, { t: '2026-11-07T19:00:00Z' });
  assert.deepEqual(leerBase(eje, ej.comedor.id).frescura, { t: T_BASES, hijosNuevos: 0, basesNuevas: 1, debajo: 0, sinNovedades: false });
  assert.deepEqual(leerBase(eje, eje.genesisId).frescura, { t: T_BASES, hijosNuevos: 0, basesNuevas: 0, debajo: 1, sinNovedades: false });
  const comedor2 = await escribirBaseDe(ej, ej.comedor.id, { t: '2026-11-07T19:10:00Z' });
  assert.equal(comedor2.contexto.nSubarbol, 10);
  assert.equal(leerBase(eje, eje.genesisId).frescura.basesNuevas, 1);
  assert.deepEqual(comprobar(eje, leerBase(eje, eje.genesisId)).diferencias.map((d) => d.registro), [eje.genesisId]);
});

test('situar lee el 8 (la verdad escrita); sin base escrita lo dice y, con respaldo, calcula al vuelo con confluir()', async () => {
  const ej = await nuevo();
  const { eje } = ej;
  // Sin base escrita: PENDIENTE y se dice; con respaldo, el cálculo al vuelo, declarado.
  const sinBase = situar(eje, ej.guisos.id);
  assert.deepEqual([sinBase.estado, sinBase.escrita, sinBase.frescura], ['PENDIENTE', false, SIN_BASE_ESCRITA]);
  assert.equal(sinBase.motivo, 'sin base escrita en el 8 de ' + ej.menu.id.slice(0, 8));
  const respaldo = situar(eje, ej.guisos.id, { respaldo: true });
  assert.deepEqual([respaldo.estado, respaldo.escrita, respaldo.respaldo, respaldo.frescura, respaldo.n], ['RESUELTO', false, true, SIN_BASE_ESCRITA, 4]);
  assert.deepEqual(respaldo, confluir(eje, ej.guisos.id));
  await escribirBasesDelEjemplo(ej);
  const esperado = {
    guisos: { hermanos: [ej.menu.id, 'hijos', 4], proyecto: [ej.comedor.id, 'subarbol', 9], general: [eje.genesisId, 'subarbol', 14] },
    menu: { hermanos: [ej.comedor.id, 'hijos', 2], proyecto: [ej.comedor.id, 'subarbol', 9], general: [eje.genesisId, 'subarbol', 14] },
  };
  const delBloque = (x) => [x.n, x.suma, x.minimo, x.maximo, x.cortes, x.cajas, x.foco, x.caja];
  for (const [nombre, foco] of [['guisos', ej.guisos.id], ['menu', ej.menu.id]]) {
    for (const alcance of ALCANCES) {
      const donde = nombre + ' ' + alcance;
      const s = situar(eje, foco, { alcance });
      assert.equal(s.estado, 'RESUELTO', donde);
      assert.equal(s.escrita, true, donde);
      assert.deepEqual([s.registro, s.seccion, s.n], esperado[nombre][alcance], donde);
      assert.equal(s.autor, identidadDe(eje, s.registro));
      assert.ok(s.frescura.sinNovedades);
      assert.equal(s.incluido, true);
      assert.deepEqual(s.cambiadas, []);
      assert.deepEqual(situar(eje, foco, { alcance, respaldo: true }), s, donde); // con base escrita, el respaldo no se usa
      // Los recuentos, informativos y sin caja (R7).
      for (const [k, x] of Object.entries(s.medidas)) assert.deepEqual([x.recuento, 'caja' in x, x.n], [true, false, s.n], donde + ' ' + k);
      for (const [k, x] of Object.entries(s.tokens)) {
        assert.equal(x.debajo + x.enCaja + x.encima, s.n, donde + ' ' + k);
        assert.deepEqual(x.informativos, ['enCaja', 'debajo', 'encima', 'media']);
        assert.equal(x.cuota, x.suma > 0 ? x.foco / x.suma : null, donde + ' ' + k);
        assert.ok(x.enCaja >= 1, donde + ' ' + k); // el foco está medido en todas
        assert.equal(x.hito, HITOS[x.caja]);
        assert.ok(!('nivel' in x) && !('grado' in x));
      }
      // Una sola verdad: lo leído del 8 es lo que confluir() calcula al vuelo, con los cortes de la época.
      const c = confluir(eje, foco, { alcance });
      assert.deepEqual([c.escrita, c.baseEscrita, c.frescura], [false, s.base, 'calculada al vuelo'], donde);
      assert.equal(c.n, s.n, donde);
      for (const k of Object.keys(c.medidas)) assert.deepEqual(s.medidas[k], c.medidas[k], donde + ' ' + k);
      for (const k of Object.keys(c.tokens)) assert.deepEqual([c.tokens[k].etiqueta, ...delBloque(c.tokens[k])], [s.tokens[k].etiqueta, ...delBloque(s.tokens[k])], donde + ' ' + k);
      assert.deepEqual(s.posiciones, c.posiciones, donde);
      assert.deepEqual(s.raiz, c.raiz, donde);
    }
  }
  const h = situar(eje, ej.guisos.id);
  assert.deepEqual([h.medidas.posiciones.foco, h.medidas.posiciones.recuento, 'caja' in h.medidas.posiciones], [5, true, false]);
  assert.equal(h.medidas.formulasPendientes.maximo, 1); // solo los guisos tienen una pendiente
  assert.deepEqual([h.tokens['T:hora'].foco, h.tokens['T:hora'].caja, h.tokens['T:hora'].cuota], [1, 1, 1 / h.tokens['T:hora'].suma]);
  // Un proyecto y el génesis se sitúan en su propio subárbol; el génesis no tiene hermanos.
  assert.deepEqual([proyectoDe(eje, ej.guisos.id).id, proyectoDe(eje, ej.comedor.id).id], [ej.comedor.id, ej.comedor.id]);
  assert.equal(situar(eje, ej.comedor.id, { alcance: 'proyecto' }).incluido, true);
  assert.equal(situar(eje, eje.genesisId, { alcance: 'general' }).n, 14);
  assert.match(situar(eje, eje.genesisId).motivo, /sin cohorte/);
  assert.match(situar(eje, eje.genesisId, { respaldo: true }).motivo, /sin cohorte/);
  assert.throws(() => situar(eje, ej.guisos.id, { alcance: 'linaje' }), /alcance desconocido/);
  // El foco cambia después de medido: cae en una caja vacía y se dice.
  await eje.escribir({ autor: 'casa', sobre: ej.guisos.id, en: '4000000000', t: '2026-11-07T18:40:00Z', movimientos: [minuto('casa')], payload: 'Nota' }, claves.casa.privada);
  assert.deepEqual(situar(eje, ej.guisos.id).cambiadas, ['tiempo:minuto'] ); // la nota consumió un minuto sobre los guisos: una cantidad (R7); los escritos son un recuento
  // Un registro que la base no mide (llegó después) no está incluido.
  const te = await eje.escribir({ autor: 'vecina', sobre: ej.menu.id, t: '2026-11-07T18:50:00Z', movimientos: [hora('vecina')], payload: 'Un té' });
  assert.deepEqual(['hermanos', 'general'].map((alcance) => situar(eje, te.id, { alcance }).incluido), [false, false]);
});

test('la base del padre leída del 8 coincide con el fundido recalculado al vuelo cuando ambas existen; si algo no está escrito, se nota', async () => {
  const ej = await nuevo();
  const { eje } = ej;
  await escribirBasesDelEjemplo(ej);
  const subarbol = (id) => [id, ...hijos(eje, id).flatMap((h) => subarbol(h.id))];
  const conBase = eje.orden.filter((id) => leerBase(eje, id));
  assert.equal(conBase.length, 6);
  for (const id of conBase) {
    const b = leerBase(eje, id);
    assert.equal(canonico(b.hijos), canonico(medidaA(eje, hijos(eje, id).map((h) => h.id))), 'hijos de ' + id.slice(0, 8));
    assert.equal(canonico(b.subarbol), canonico(medidaA(eje, subarbol(id))), 'subárbol de ' + id.slice(0, 8));
  }
  // Algo que la base no ve: una nota sobre una compra (sin base propia). Lo escrito no cambia; al vuelo, sí.
  await eje.escribir({ autor: 'casa', sobre: ej.compra.id, t: '2026-11-07T18:40:00Z', movimientos: [minuto('casa')], payload: 'Nota' }, claves.casa.privada);
  const general = leerBase(eje, eje.genesisId);
  assert.equal(general.subarbol.n, 14);
  assert.equal(confluir(eje, ej.guisos.id, { alcance: 'general' }).n, 15);
  assert.equal(situar(eje, ej.guisos.id, { alcance: 'general' }).n, 14); // la verdad es la escrita
  assert.equal(comprobar(eje, leerBase(eje, ej.menu.id)).alDia, false); // y comprobar dice que hay que reescribirla
});

test('fundir es asociativo y conmutativo sobre medidas, con la estadística vacía como neutro (propiedad)', async () => {
  const ej = await nuevo();
  const { eje } = ej;
  const u = eje.orden.map((id) => unitaria(medir(eje, id)));
  assert.equal(u.length, 14);
  for (let i = 0; i < u.length; i++) {
    assert.equal(canonico(fundir(estadisticaVacia(), u[i])), canonico(u[i]));
    for (let j = 0; j < u.length; j++) {
      assert.equal(canonico(fundir(u[i], u[j])), canonico(fundir(u[j], u[i])), i + ' y ' + j);
      const k = (i + j + 1) % u.length;
      assert.equal(canonico(fundir(fundir(u[i], u[j]), u[k])), canonico(fundir(u[i], fundir(u[j], u[k]))), i + ', ' + j + ' y ' + k);
    }
  }
  // Cualquier orden y cualquier agrupación dan lo mismo (permutaciones con una semilla fija).
  let semilla = 7;
  const azar = () => (semilla = (semilla * 48271) % 2147483647) / 2147483647;
  const todo = canonico(u.reduce((a, b) => fundir(a, b), estadisticaVacia()));
  for (let vuelta = 0; vuelta < 20; vuelta++) {
    const l = [...u].sort(() => azar() - 0.5);
    while (l.length > 1) {
      const p = Math.floor(azar() * (l.length - 1));
      l.splice(p, 2, fundir(l[p], l[p + 1]));
    }
    assert.equal(canonico(l[0]), todo, 'vuelta ' + vuelta);
  }
});

test('la escribe la propia cosa o quien tiene P sobre el registro; nadie sin P escribe la base de otro', async () => {
  const ej = await nuevo();
  const { eje } = ej;
  // La casa tiene P sobre todo el eje: escribe la base del menú (que tiene su cosa) y la de unos guisos (que no la tienen).
  assert.deepEqual(puedeEscribirBase(eje, 'casa', ej.menu.id), { puede: true, por: 'poder', motivo: '' });
  assert.equal(puedeEscribirBase(eje, 'menu-dia', ej.menu.id).por, 'identidad');
  const deLaCasa = await escribirBase(eje, { registro: ej.menu.id, autor: 'casa', privada: claves.casa.privada, t: T_BASES });
  assert.deepEqual([leerBase(eje, ej.menu.id).id, leerBase(eje, ej.menu.id).por, leerBase(eje, ej.menu.id).autor], [deLaCasa.id, 'poder', 'casa']);
  await eje.escribir({ autor: 'casa', sobre: ej.guisos.id, t: T_BASES, movimientos: [minuto('casa')], payload: 'Nota' }, claves.casa.privada);
  await assert.rejects(escribirBase(eje, { registro: ej.guisos.id, privada: claves.casa.privada, t: T_BASES }), /propia cosa o quien tiene P/);
  await escribirBase(eje, { registro: ej.guisos.id, autor: 'casa', privada: claves.casa.privada, t: T_BASES });
  assert.equal(leerBase(eje, ej.guisos.id).por, 'poder');
  // El mercado (una cosa) tiene clave pero no P sobre el menú: ni escribirBase ni un evento bien formado a mano cuentan.
  assert.match(puedeEscribirBase(eje, 'mercado', ej.menu.id).motivo, /nadie sin P sobre/);
  assert.match(puedeEscribirBase(eje, 'huesped', ej.menu.id).motivo, /nadie sin P sobre/);
  await assert.rejects(escribirBase(eje, { registro: ej.menu.id, autor: 'mercado', privada: claves.mercado.privada, t: T_BASES }), /nadie sin P sobre/);
  const contexto = { bases: true, n: 4, nSubarbol: 5, hasta: ej.cafe.id, epoca: 'época 0', sinBase: 0 };
  const aMano = await eje.escribir({ autor: 'mercado', sobre: ej.menu.id, en: CIELO, t: T_BASES, movimientos: [minuto('mercado')], payload: payloadDeBase(calcularBase(eje, ej.menu.id)), contexto }, claves.mercado.privada);
  assert.equal(esBase(eje, aMano), false);
  // El poder cuenta al escribir: el mercado recibe P sobre el menú, escribe su base y devuelve el poder; la base sigue valiendo.
  await eje.escribir({ autor: 'casa', sobre: ej.menu.id, t: T_BASES, movimientos: [minuto('casa'), { token: 'P', cantidad: 1, ambito: ej.menu.id, de: 'casa', a: 'mercado' }], payload: 'Poder sobre el menú' }, claves.casa.privada);
  assert.equal(puedeEscribirBase(eje, 'mercado', ej.menu.id).por, 'poder');
  assert.equal(puedeEscribirBase(eje, 'mercado', ej.puesto.id).puede, false); // el ámbito es el menú, no el puesto
  const deCocina = await escribirBase(eje, { registro: ej.menu.id, autor: 'mercado', privada: claves.mercado.privada, t: T_BASES });
  await eje.escribir({ autor: 'mercado', sobre: ej.menu.id, t: T_BASES, movimientos: [minuto('mercado'), { token: 'P', cantidad: 1, ambito: ej.menu.id, de: 'mercado', a: 'casa' }], payload: 'Devuelvo el poder' }, claves.mercado.privada);
  assert.equal(puedeEscribirBase(eje, 'mercado', ej.menu.id).puede, false);
  const otro = await restaurar(JSON.parse(JSON.stringify(serializar(eje)))); // releído desde cero, ya sin el poder del mercado
  assert.deepEqual(basesEn(otro, ej.menu.id).map((b) => [b.id, b.por]), [[deLaCasa.id, 'poder'], [deCocina.id, 'poder']]);
  assert.equal(esBase(otro, aMano), false); // la de antes de tener poder sigue sin contar
});

test('«sin base escrita» se informa en situar, en BQL y en el respaldo', async () => {
  const ej = await nuevo();
  const { eje } = ej;
  const q = (f) => consultar(eje, ej.guisos.id, [], f);
  for (const f of ['BASES("hermanos")', 'BASES("proyecto", "T:hora")', 'CAJA("T:hora")', 'FRESCURA("general")']) {
    const r = q(f);
    assert.equal(r.estado, 'PENDIENTE', f);
    assert.ok(r.motivo.startsWith(SIN_BASE_ESCRITA + ' en el 8 de '), f);
  }
  assert.equal(valorDeBases(eje, ej.menu.id).motivo, SIN_BASE_ESCRITA + ' en el 8 de ' + ej.menu.id.slice(0, 8));
  assert.ok(consultar(eje, ej.menu.id, [], 'BASES()').motivo.startsWith(SIN_BASE_ESCRITA + ' en el 8 de ' + ej.menu.id.slice(0, 8) + ' (su propio 8)'));
  for (const alcance of ALCANCES) {
    assert.equal(situar(eje, ej.guisos.id, { alcance }).frescura, SIN_BASE_ESCRITA, alcance);
    assert.equal(confluir(eje, ej.guisos.id, { alcance }).frescura, SIN_BASE_ESCRITA, alcance);
  }
  // Con la base escrita, ya no se dice.
  await escribirBasesDelEjemplo(ej);
  assert.equal(typeof situar(eje, ej.guisos.id).frescura, 'object');
  assert.equal(q('BASES("hermanos")').texto, '4');
});

test('las bases del 8 no son hermanas, escritos ni comparables de lo que miden', async () => {
  const ej = await nuevo();
  const { eje } = ej;
  const antes = {
    menu: medir(eje, ej.menu.id),
    alcances: ALCANCES.map((alcance) => comparables(eje, ej.guisos.id, alcance).map((e) => e.id)),
    hermanos: confluir(eje, ej.guisos.id).n,
  };
  const bases = await escribirBasesDelEjemplo(ej);
  assert.deepEqual(medir(eje, ej.menu.id), antes.menu); // la base en su 8 no es un escrito ni desarrolla esa posición
  assert.deepEqual(ALCANCES.map((alcance) => comparables(eje, ej.guisos.id, alcance).map((e) => e.id)), antes.alcances);
  assert.equal(confluir(eje, ej.guisos.id).n, antes.hermanos);
  assert.equal(confluir(eje, bases.menus.menu.id).n, 1); // una base solo se compara consigo misma
  assert.deepEqual(comparables(eje, bases.general.id, 'general').map((e) => e.id), [bases.general.id]);
  // Lo que no es base sí es hermano: una compra que se declara base sigue en la lista.
  const pan = await eje.escribir({ autor: 'huesped', sobre: ej.menu.id, en: CIELO, t: T_BASES, movimientos: [hora('huesped')], payload: ['Compra de pan', 3], contexto: { bases: true } });
  assert.equal(confluir(eje, pan.id).n, 5);
  assert.equal(medir(eje, ej.menu.id).escritos, 5);
});

test('BASES() en BQL: n, la caja del anfitrión y los datos de la base, con su dependencia y su autorización', async () => {
  const ej = await nuevo();
  const { eje } = ej;
  const q = (id, f, opciones) => consultar(eje, id, [], f, opciones);
  assert.equal(q(ej.guisos.id, 'BASES("hermanos")').estado, 'PENDIENTE');
  assert.equal(q(ej.menu.id, 'BASES()').estado, 'PENDIENTE');
  const bases = await escribirBasesDelEjemplo(ej);
  assert.equal(q(ej.menu.id, 'BASES()').texto, '4');
  assert.deepEqual(ALCANCES.map((a) => q(ej.guisos.id, 'BASES("' + a + '")').texto), ['4', '9', '14']);
  const s = situar(eje, ej.guisos.id, { alcance: 'proyecto' });
  const r = q(ej.guisos.id, 'BASES("proyecto", "T:hora")');
  assert.equal(r.valor.valor, s.tokens["T:hora"].caja);
  // Como CAJA: el 8 leído, la base y el anfitrión medido (BASES hereda la lectura cobrada y autorizada del 8).
  assert.deepEqual(r.dependencias.sort(), [ej.comedor.id + ':' + CIELO, bases.proyectos.comedor.id + ':0000000000', ej.guisos.id + ':0000000000'].sort());
  assert.deepEqual(q(ej.guisos.id, 'BASES("proyecto", "T:hora", "suma")').dependencias.sort(), [ej.comedor.id + ':' + CIELO, bases.proyectos.comedor.id + ':0000000000'].sort());
  assert.equal(q(ej.guisos.id, 'BASES("proyecto", "T:hora", ' + s.tokens["T:hora"].caja + ')').valor.valor, s.tokens["T:hora"].enCaja);
  for (const campo of ['foco', 'cuota', 'cajaCuota', 'debajo', 'encima', 'enCaja', 'suma', 'minimo', 'maximo', 'media']) {
    assert.equal(q(ej.guisos.id, 'BASES("proyecto", "T:hora", "' + campo + '")').valor.valor, s.tokens["T:hora"][campo], campo);
  }
  assert.equal(q(ej.guisos.id, 'BASES("hermanos", "E:casa/EUR", "suma") = 32').texto, 'verdadero'); // 12 + 6 + 12 + 2
  assert.equal(q(ej.guisos.id, 'BASES("hermanos", "T:siglo", 0)').texto, '4'); // serie ausente: todos en cero
  assert.match(q(eje.genesisId, 'BASES("hermanos")').motivo, /sin cohorte/);
  for (const f of ['BASES("linaje")', 'BASES("hermanos", "inventada")', 'BASES("hermanos", "T:hora", "grado")', 'BASES("hermanos", "T:hora", 10)', 'BASES("hermanos", "T:hora", 1, 2)', 'BASES("hermanos", "terminales")', 'CAJA("identidades")']) { // los recuentos no se sitúan (R7)
    assert.equal(q(ej.guisos.id, f).estado, 'ERROR', f);
  }
  assert.equal(valorDeBases(eje, ej.menu.id).valor, 4);
  // El gancho de autorización de BQL decide: leer la base y, para situarlo, el anfitrión entero.
  const sinBases = (id) => !esBase(eje, eje.obtener(id));
  const negada = q(ej.guisos.id, 'BASES("proyecto", "T:hora", "suma")', { puedeLeer: sinBases });
  assert.deepEqual([negada.estado, negada.motivo], ['PENDIENTE DE AUTORIZACIÓN', 'leer la base del 8 de ' + ej.comedor.id.slice(0, 8) + ' exige una autorización que no hay']);
  assert.equal(q(ej.guisos.id, 'BASES("proyecto", "T:hora")', { puedeLeer: (id) => id !== ej.guisos.id }).estado, 'PENDIENTE DE AUTORIZACIÓN');
  assert.equal(q(ej.guisos.id, 'BASES("proyecto", "T:hora", "suma")', { puedeLeer: (id) => id !== ej.guisos.id }).estado, 'RESUELTO');
  // Dentro de un registro: lo que mide a su propio registro no se mide a sí mismo mientras se mide.
  const nota = await eje.escribir({ autor: 'huesped', sobre: ej.menu.id, t: '2026-11-07T18:30:00Z', movimientos: [hora('huesped')], payload: ['Nota', '=BASES("hermanos", "T:hora")', '=BASES("hermanos")'] });
  assert.deepEqual([medir(eje, nota.id).formulasResueltas, medir(eje, nota.id).formulasPendientes], [1, 1]);
  const enNota = evaluar(eje, nota.id, [1]);
  assert.equal(enNota.estado, 'RESUELTO');
  assert.equal(enNota.valor.valor, situar(eje, nota.id).tokens["T:hora"].caja);
});

test('las bases son registros: se guardan y se reconstruyen con el eje', async () => {
  const ej = await nuevo();
  await escribirBasesDelEjemplo(ej);
  const otro = await restaurar(JSON.parse(JSON.stringify(serializar(ej.eje))));
  for (const id of [ej.menu.id, ej.comedor.id, otro.genesisId]) {
    const a = leerBase(ej.eje, id);
    const b = leerBase(otro, id);
    assert.equal(b.id, a.id);
    iguales(b.hijos, a.hijos);
    iguales(b.subarbol, a.subarbol);
    assert.deepEqual(b.frescura, a.frescura);
  }
});

test('payload: más de diez hijos o series se anidan en décuplas y se leen igual', async () => {
  assert.deepEqual(empaquetar([1, 2, 3]), [1, 2, 3]);
  const muchos = Array.from({ length: 123 }, (_, i) => i);
  const arbol = empaquetar(muchos);
  assert.ok(arbol.length <= 10);
  assert.deepEqual(arbol.flat(Infinity), muchos);
  assert.ok(validarPayload(arbol).ok);
  // El puesto con catorce hijos y doce series de tokens de más.
  const ej = await nuevo();
  const { eje } = ej;
  for (let i = 0; i < 12; i++) {
    // De la casa: la persona huésped no tiene tantas horas en su reloj (acuña su T dentro del tope; Core, 8-11).
    await eje.escribir({ autor: 'casa', sobre: ej.puesto.id, t: '2026-11-07T18:' + String(10 + i) + ':00Z', movimientos: [hora('casa')], payload: 'nota ' + i }, claves.casa.privada);
  }
  const calculada = calcularBase(eje, ej.puesto.id);
  for (let i = 0; i < 12; i++) calculada.hijos.tokens['E:serie' + String(i).padStart(2, '0') + '/X'] = bloqueDe(calculada.hijos, 'E:nada/X');
  const payload = payloadDeBase(calculada);
  assert.ok(validarPayload(payload).ok);
  const leida = baseDePayload(payload);
  assert.deepEqual(leida.refsHijos, calculada.refsHijos);
  iguales(leida.hijos, calculada.hijos);
  iguales(leida.subarbol, calculada.subarbol);
  const ev = await escribirBaseDe(ej, ej.puesto.id);
  assert.equal(leerBase(eje, ej.puesto.id).refsHijos.length, 14);
  assert.equal(ev.contexto.n, 14);
});
