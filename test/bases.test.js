import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generarClaves } from '../src/autoridad.js';
import { ocupantes } from '../src/encaje.js';
import { validarPayload } from '../src/btml.js';
import { EPOCA_0 } from '../src/epocas.js';
import { serializar, restaurar } from '../src/persistencia.js';
import { consultar, evaluar } from '../src/bql.js';
import { HITOS, ALCANCES, comparar, comparables, confluir, medidasDe, proyectoDe, medir as medirTiempo } from '../src/tiempo.js';
import {
  CIELO, ETIQUETAS, CORTES_PROVISIONALES, clavesDeMedidas, cortesDe, medir, estadisticaVacia, unitaria, fundir,
  bloqueDe, cajasEtiquetadas, calcularBase, identidadDe, escribirBase, leerBase, frescura, comprobar, situar,
  hijos, esBase, basesEn, empaquetar, payloadDeBase, baseDePayload, valorDeBases,
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
/** Una época con cortes para todo, para comparar las bases con confluir() (que, sin ellos, saca los de cada cohorte). */
const CON_CORTES = { ...EPOCA_0, nombre: 'época con cortes', cortes: (clave) => cortesDe(clave).cortes };

test('cortes: los da la época por su gancho, con las claves de confluir(); sin él, los provisionales', () => {
  assert.deepEqual(clavesDeMedidas(), ['posiciones', 'terminales', 'escritos', 'movimientos', 'identidades', 'profundidadHilo', 'formulasResueltas', 'formulasPendientes']);
  for (const clave of [...clavesDeMedidas(), 'T:hora', 'E:casa/EUR']) {
    const { cortes, origen } = cortesDe(clave);
    assert.equal(origen, 'provisional');
    assert.equal(cortes.length, 9, clave);
    for (let k = 1; k < cortes.length; k++) assert.ok(cortes[k] > cortes[k - 1], clave);
  }
  assert.deepEqual(cortesDe('escritos').cortes, CORTES_PROVISIONALES.escritos);
  assert.deepEqual(cortesDe('E:casa/EUR').cortes, CORTES_PROVISIONALES.tokens);
  // Una época que declara cortes manda; la época 0 no los declara.
  const epoca = { ...EPOCA_0, nombre: 'época de prueba', cortes: (clave) => (clave === 'escritos' ? [0, 1, 2, 3, 4, 5, 6, 7, 8] : undefined) };
  assert.deepEqual(cortesDe('escritos', epoca), { cortes: [0, 1, 2, 3, 4, 5, 6, 7, 8], origen: 'epoca' });
  assert.equal(cortesDe('terminales', epoca).origen, 'provisional');
  assert.throws(() => cortesDe('escritos', { ...epoca, cortes: () => [3, 2, 1] }), /nueve umbrales crecientes/);
  assert.throws(() => cortesDe('inventada'), /medida desconocida/);
  // Cada bloque guarda sus cortes: no se funden medidas con cortes distintos (no se inventa escala puente).
  const m = { posiciones: 0, terminales: 1, escritos: 1, movimientos: 0, identidades: 0, profundidadHilo: 1, formulasResueltas: 0, formulasPendientes: 0, tokens: {}, procedencias: Array.from({ length: 10 }, () => ({ propia: false, referencia: false, escrita: false, tiene: false })), raiz: { escrita: false } };
  const b = unitaria(m, epoca);
  assert.deepEqual(b.medidas.escritos.cajas, [0, 0, 1, 0, 0, 0, 0, 0, 0, 0]);
  assert.throws(() => fundir(unitaria(m), b), /cortes distintos en escritos/);
  // Los mismos cortes de dos orígenes sí se funden: el bloque lo dice («mixto»).
  assert.equal(fundir(unitaria(m), unitaria(m, CON_CORTES)).medidas.escritos.origenCortes, 'mixto');
  // Etiquetas: los diez hitos de tiempo.js, con las literales del mapa (auditoría C32).
  assert.equal(ETIQUETAS, HITOS);
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

test('medir: las medidas de la confluencia (tiempo.medidasDe), una sola verdad', async () => {
  const ej = await nuevo();
  const { eje } = ej;
  const guisos = medir(eje, ej.guisos.id);
  assert.deepEqual(guisos, medidasDe(eje, ej.guisos.id));
  assert.deepEqual(
    clavesDeMedidas().map((k) => guisos[k]),
    [5, 9, 0, 2, 2, 3, 1, 1], // posiciones 0–4, nueve terminales, una fórmula resuelta y otra pendiente
  );
  assert.deepEqual(guisos.tokens, { 'T:hora': 1, 'E:casa/EUR': 12 });
  // Un terminal no tiene posición 0: un terminal, ninguna posición.
  assert.deepEqual([medir(eje, ej.cafe.id).terminales, medir(eje, ej.cafe.id).posiciones], [1, 0]);
  assert.equal(medir(eje, ej.menu.id).escritos, 4);
  assert.deepEqual(medir(eje, ej.mercado.id).tokens, { 'T:minuto': 11, 'E:casa/EUR': 30 });
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
  for (const k of [...Object.keys(abc.medidas), ...Object.keys(abc.tokens)]) assert.equal(sumaCajas(bloqueDe(abc, k)), 3, k);
  // T:minuto solo lo mueve el mercado (11): los otros dos valen cero en esa serie.
  const minutos = abc.tokens['T:minuto'];
  assert.deepEqual([minutos.cajas, minutos.suma, minutos.minimo, minutos.maximo], [[2, 0, 0, 0, 0, 0, 1, 0, 0, 0], 11, 0, 11]);
  assert.deepEqual(bloqueDe(a, 'T:minuto').cajas, [1, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual([abc.medidas.terminales.suma, abc.medidas.terminales.minimo, abc.medidas.terminales.maximo], [9 + 1 + 3, 1, 9]);
  // Por posición: cuántos la tienen desarrollada y por qué procedencia; la raíz aparte.
  assert.deepEqual(abc.posiciones[1], { comparables: 2, propias: 2, referencias: 1, escritas: 0 });
  assert.equal(abc.raiz, 1); // el puesto está escrito en la raíz del mercado
  // Etiquetas de caja: los diez hitos, sin asignar nada.
  const cajas = cajasEtiquetadas(abc, 'terminales');
  assert.equal(cajas.length, 10);
  assert.deepEqual(cajas[5], { caja: 5, nivel: HITOS[5].nivel, nombre: HITOS[5].nombre, cuenta: 1 });
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
  assert.deepEqual(menu.subarbol.medidas.profundidadHilo.cajas, [0, 0, 1, 4, 0, 0, 0, 0, 0, 0]);
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
  for (const seccion of ['hijos', 'subarbol']) assert.deepEqual(c.diferencias[0][seccion], ['escritos', 'posiciones', 'posiciones por PV'], seccion);
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

test('situar: el foco en su caja en las tres cohortes, con la forma y los números de confluir()', async () => {
  const ej = await nuevo();
  const { eje } = ej;
  const sinBase = situar(eje, ej.guisos.id);
  assert.equal(sinBase.estado, 'PENDIENTE');
  assert.match(sinBase.motivo, /sin base en el 8/);
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
      assert.deepEqual([s.registro, s.seccion, s.n], esperado[nombre][alcance], donde);
      assert.ok(s.frescura.sinNovedades);
      assert.equal(s.incluido, true);
      assert.deepEqual(s.cambiadas, []);
      for (const [k, x] of [...Object.entries(s.medidas), ...Object.entries(s.tokens)]) {
        assert.equal(x.debajo + x.enCaja + x.encima, s.n, donde + ' ' + k);
        assert.ok(x.enCaja >= 1, donde + ' ' + k); // el foco está medido en todas
        assert.equal(x.hito, HITOS[x.caja]);
        assert.ok(!('nivel' in x) && !('grado' in x));
      }
      // Una sola verdad: lo leído del 8 es lo que confluir() calcula al vuelo con los mismos cortes.
      const c = confluir(eje, foco, { alcance, epoca: CON_CORTES });
      assert.equal(c.n, s.n, donde);
      for (const k of Object.keys(c.medidas)) assert.deepEqual(delBloque(s.medidas[k]), delBloque(c.medidas[k]), donde + ' ' + k);
      for (const k of Object.keys(c.tokens)) assert.deepEqual([c.tokens[k].etiqueta, ...delBloque(c.tokens[k])], [s.tokens[k].etiqueta, ...delBloque(s.tokens[k])], donde + ' ' + k);
      assert.deepEqual(s.posiciones, c.posiciones, donde);
      assert.deepEqual(s.raiz, c.raiz, donde);
    }
  }
  const h = situar(eje, ej.guisos.id);
  assert.deepEqual([h.medidas.posiciones.foco, h.medidas.posiciones.caja, h.medidas.posiciones.debajo, h.medidas.posiciones.enCaja], [5, 5, 2, 2]);
  assert.equal(h.medidas.formulasPendientes.encima, 0); // solo los guisos tienen una pendiente
  // Un proyecto y el génesis se sitúan en su propio subárbol; el génesis no tiene hermanos.
  assert.deepEqual([proyectoDe(eje, ej.guisos.id).id, proyectoDe(eje, ej.comedor.id).id], [ej.comedor.id, ej.comedor.id]);
  assert.equal(situar(eje, ej.comedor.id, { alcance: 'proyecto' }).incluido, true);
  assert.equal(situar(eje, eje.genesisId, { alcance: 'general' }).n, 14);
  assert.match(situar(eje, eje.genesisId).motivo, /sin cohorte/);
  assert.throws(() => situar(eje, ej.guisos.id, { alcance: 'linaje' }), /alcance desconocido/);
  // El foco cambia después de medido: cae en una caja vacía y se dice.
  await eje.escribir({ autor: 'casa', sobre: ej.guisos.id, en: '4000000000', t: '2026-11-07T18:40:00Z', movimientos: [minuto('casa')], payload: 'Nota' }, claves.casa.privada);
  assert.deepEqual(situar(eje, ej.guisos.id).cambiadas, ['escritos']);
  // Un registro que la base no mide (llegó después) no está incluido.
  const te = await eje.escribir({ autor: 'vecina', sobre: ej.menu.id, t: '2026-11-07T18:50:00Z', movimientos: [hora('vecina')], payload: 'Un té' });
  assert.deepEqual(['hermanos', 'general'].map((alcance) => situar(eje, te.id, { alcance }).incluido), [false, false]);
});

test('tiempo: comparar, medir y la confluencia no cuentan las bases del 8 como hermanos, escritos ni comparables', async () => {
  const ej = await nuevo();
  const { eje } = ej;
  const resumen = (c) => [c.posicion, c.de, c.comparables.map((x) => x.id)];
  const antes = {
    comparar: resumen(comparar(eje, ej.guisos.id)),
    escritos: medirTiempo(eje, ej.menu.id).escritos,
    menu: medidasDe(eje, ej.menu.id),
    alcances: ALCANCES.map((alcance) => comparables(eje, ej.guisos.id, alcance).map((e) => e.id)),
  };
  const bases = await escribirBasesDelEjemplo(ej);
  assert.deepEqual(resumen(comparar(eje, ej.guisos.id)), antes.comparar);
  assert.deepEqual(antes.comparar.slice(0, 2), [2, 4]);
  assert.equal(medirTiempo(eje, ej.menu.id).escritos, antes.escritos);
  assert.deepEqual(medidasDe(eje, ej.menu.id), antes.menu); // la base en su 8 no desarrolla esa posición
  assert.deepEqual(ALCANCES.map((alcance) => comparables(eje, ej.guisos.id, alcance).map((e) => e.id)), antes.alcances);
  assert.equal(comparar(eje, bases.menus.menu.id).de, 1); // una base solo se compara consigo misma
  assert.deepEqual(comparables(eje, bases.general.id, 'general').map((e) => e.id), [bases.general.id]);
  // Lo que no es base sí es hermano: una compra que se declara base sigue en la lista.
  const pan = await eje.escribir({ autor: 'huesped', sobre: ej.menu.id, en: CIELO, t: T_BASES, movimientos: [hora('huesped')], payload: ['Compra de pan', 3], contexto: { bases: true } });
  assert.equal(comparar(eje, pan.id).de, 5);
  assert.equal(confluir(eje, pan.id).n, 5);
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
  const r = q(ej.guisos.id, 'BASES("proyecto", "terminales")');
  assert.equal(r.valor.valor, s.medidas.terminales.caja);
  assert.deepEqual(r.dependencias, [bases.proyectos.comedor.id + ':0000000000']);
  assert.equal(q(ej.guisos.id, 'BASES("proyecto", "terminales", ' + s.medidas.terminales.caja + ')').valor.valor, s.medidas.terminales.enCaja);
  for (const campo of ['foco', 'debajo', 'encima', 'enCaja', 'suma', 'minimo', 'maximo', 'media']) {
    assert.equal(q(ej.guisos.id, 'BASES("proyecto", "terminales", "' + campo + '")').valor.valor, s.medidas.terminales[campo], campo);
  }
  assert.equal(q(ej.guisos.id, 'BASES("hermanos", "E:casa/EUR", "suma") = 32').texto, 'verdadero'); // 12 + 6 + 12 + 2
  assert.equal(q(ej.guisos.id, 'BASES("hermanos", "T:siglo", 0)').texto, '4'); // serie ausente: todos en cero
  assert.match(q(eje.genesisId, 'BASES("hermanos")').motivo, /sin cohorte/);
  for (const f of ['BASES("linaje")', 'BASES("hermanos", "inventada")', 'BASES("hermanos", "terminales", "grado")', 'BASES("hermanos", "terminales", 10)', 'BASES("hermanos", "terminales", 1, 2)']) {
    assert.equal(q(ej.guisos.id, f).estado, 'ERROR', f);
  }
  assert.equal(valorDeBases(eje, ej.menu.id).valor, 4);
  // El gancho de autorización de BQL decide: leer la base y, para situarlo, el anfitrión entero.
  const sinBases = (id) => !esBase(eje, eje.obtener(id));
  const negada = q(ej.guisos.id, 'BASES("proyecto", "terminales", "suma")', { puedeLeer: sinBases });
  assert.deepEqual([negada.estado, negada.motivo], ['PENDIENTE DE AUTORIZACIÓN', 'leer la base del 8 de ' + ej.comedor.id.slice(0, 8) + ' exige una autorización que no hay']);
  assert.equal(q(ej.guisos.id, 'BASES("proyecto", "terminales")', { puedeLeer: (id) => id !== ej.guisos.id }).estado, 'PENDIENTE DE AUTORIZACIÓN');
  assert.equal(q(ej.guisos.id, 'BASES("proyecto", "terminales", "suma")', { puedeLeer: (id) => id !== ej.guisos.id }).estado, 'RESUELTO');
  // Dentro de un registro: lo que mide a su propio registro no se mide a sí mismo mientras se mide.
  const nota = await eje.escribir({ autor: 'huesped', sobre: ej.menu.id, t: '2026-11-07T18:30:00Z', movimientos: [hora('huesped')], payload: ['Nota', '=BASES("hermanos", "terminales")', '=BASES("hermanos")'] });
  assert.deepEqual([medir(eje, nota.id).formulasResueltas, medir(eje, nota.id).formulasPendientes], [1, 1]);
  const enNota = evaluar(eje, nota.id, [1]);
  assert.equal(enNota.estado, 'RESUELTO');
  assert.equal(enNota.valor.valor, situar(eje, nota.id).medidas.terminales.caja);
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
    await eje.escribir({ autor: 'huesped', sobre: ej.puesto.id, t: '2026-11-07T18:' + String(10 + i) + ':00Z', movimientos: [hora('huesped')], payload: 'nota ' + i });
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
