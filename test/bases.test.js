import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generarClaves } from '../src/autoridad.js';
import { ocupantes } from '../src/encaje.js';
import { validarPayload } from '../src/btml.js';
import { serializar, restaurar } from '../src/persistencia.js';
import { HITOS } from '../src/tiempo.js';
import {
  CIELO, COHORTES, CORTES, MEDIDAS, MEDIDAS_PV, MEDIDAS_REGISTRO, VERSION_CORTES, ETIQUETAS,
  caja, cortesDe, medir, baseVacia, baseUnitaria, fundir, bloqueDe, cajasEtiquetadas, baseDe,
  fundirHaciaArriba, escribirBase, leerBase, situar, proyectoDe, hijos, esBase, empaquetar,
  payloadDeBase, baseDePayload,
} from '../src/bases.js';
import * as agram from '../src/index.js';
import { ejemploComprasHermanas, escribirBasesDelEjemplo } from '../ejemplos/ikisai/compras-hermanas.mjs';

const T_BASES = '2026-11-07T18:00:00Z';
const casa = await generarClaves();
const hora = (de) => ({ token: 'T', escala: 'hora', cantidad: 1, de, a: null });

/** Estadística sin metadatos, para comparar bases. */
const estadistica = (b) => ({ cortes: b.cortes, n: b.n, medidas: b.medidas });
const ordenar = (b) => ({ ...b, medidas: Object.fromEntries(Object.entries(b.medidas).sort(([x], [y]) => (x < y ? -1 : 1))) });
const igualesEstadistica = (a, b) => assert.deepEqual(ordenar(estadistica(a)), ordenar(estadistica(b)));
const sumaCajas = (bloque) => bloque.cajas.reduce((s, c) => s + c, 0);

test('cortes: nueve umbrales crecientes por medida, diez cajas', () => {
  for (const m of [...MEDIDAS, 'movimientos.T:hora', 'movimientos.E:casa/EUR']) {
    const c = cortesDe(m);
    assert.equal(c.length, 9, m);
    for (let k = 1; k < c.length; k++) assert.ok(c[k] > c[k - 1], m);
    assert.equal(caja(m, 0), 0);
    assert.equal(caja(m, c[0]), 1);
    assert.equal(caja(m, c[8]), 9);
    assert.equal(caja(m, 1e9), 9);
  }
  assert.equal(caja('posiciones', 5), 4); // 4 <= 5 < 6
  assert.equal(caja('profundidad', 3), 3);
  assert.ok(Object.isFrozen(CORTES));
  assert.throws(() => cortesDe('inventada'), /medida desconocida/);
  assert.deepEqual(MEDIDAS, [...MEDIDAS_PV, ...MEDIDAS_REGISTRO]);
  assert.equal(MEDIDAS.length, 16);
  assert.equal(ETIQUETAS, HITOS);
  assert.equal(agram.bases.leerBase, leerBase); // el índice lo expone como espacio de nombres
});

test('medir: recuentos fundibles de un registro', async () => {
  const ej = await ejemploComprasHermanas({ claves: { casa } });
  const { eje } = ej;
  assert.deepEqual(medir(eje, ej.guisos.id), {
    'posiciones.0': 1, 'posiciones.1': 3, 'posiciones.2': 1, 'posiciones.3': 2, 'posiciones.4': 2,
    'posiciones.5': 0, 'posiciones.6': 0, 'posiciones.7': 0, 'posiciones.8': 0, 'posiciones.9': 0,
    posiciones: 9, escritos: 0, identidades: 2, profundidad: 3,
    'formulas.resueltas': 1, 'formulas.pendientes': 1,
    'movimientos.T:hora': 1, 'movimientos.E:casa/EUR': 1,
  });
  // Un terminal no tiene posición 0: cuenta en el total, no en los PV.
  const cafe = medir(eje, ej.cafe.id);
  assert.equal(cafe.posiciones, 1);
  assert.ok(MEDIDAS_PV.every((m) => cafe[m] === 0));
  // La cuenta escrita encima de la compra es un escrito.
  assert.equal(medir(eje, ej.compra.id).escritos, 1);
  // Movimientos por serie: el mercado mueve minutos (dos), horas y EUR de la casa, entre dos identidades (casa y vecina).
  const mercado = medir(eje, ej.mercado.id);
  assert.equal(mercado['movimientos.T:minuto'], 2);
  assert.equal(mercado['movimientos.T:hora'], 1);
  assert.equal(mercado['movimientos.E:casa/EUR'], 1);
  assert.equal(mercado.identidades, 2);
  assert.equal(medir(eje, eje.genesisId).profundidad, 0);
});

test('fundir: suma caja a caja, conmutativa, asociativa, con neutro; series ausentes valen cero', async () => {
  const ej = await ejemploComprasHermanas({ claves: { casa } });
  const { eje } = ej;
  const [a, b, c] = [ej.guisos, ej.cafe, ej.mercado].map((r) => baseUnitaria(medir(eje, r.id)));
  igualesEstadistica(fundir(a, b), fundir(b, a));
  igualesEstadistica(fundir(fundir(a, b), c), fundir(a, fundir(b, c)));
  igualesEstadistica(fundir(baseVacia(), a), a);
  const abc = fundir(fundir(a, b), c);
  assert.equal(abc.n, 3);
  for (const m of Object.keys(abc.medidas)) assert.equal(sumaCajas(abc.medidas[m]), 3, m);
  // T:minuto solo lo mueve el mercado (2 movimientos): las otras dos valen cero en esa serie.
  assert.deepEqual(abc.medidas['movimientos.T:minuto'], { cajas: [2, 0, 1, 0, 0, 0, 0, 0, 0, 0], suma: 2, minimo: 0, maximo: 2 });
  assert.deepEqual(bloqueDe(a, 'movimientos.T:minuto'), { cajas: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0], suma: 0, minimo: 0, maximo: 0 });
  assert.equal(abc.medidas.posiciones.suma, 9 + 1 + 3);
  assert.equal(abc.medidas.posiciones.minimo, 1);
  assert.equal(abc.medidas.posiciones.maximo, 9);
  // Sin escala puente ni mezcla de profundidades.
  assert.throws(() => fundir(a, { ...b, cortes: 'otros' }), /cortes distintos/);
  assert.throws(() => fundir({ ...a, profundidad: 1 }, { ...b, profundidad: 2 }), /profundidades distintas/);
  // Etiquetas de caja: los diez hitos, sin asignar nada.
  const cajas = cajasEtiquetadas(abc, 'posiciones');
  assert.equal(cajas.length, 10);
  assert.deepEqual(cajas[5], { caja: 5, nivel: HITOS[5].nivel, nombre: HITOS[5].nombre, cuenta: 1 });
});

test('baseDe: los hijos de un registro, hermanos entre sí, con referencias a lo medido', async () => {
  const ej = await ejemploComprasHermanas({ claves: { casa } });
  const { eje } = ej;
  const base = baseDe(eje, ej.menu.id);
  const compras = [ej.compra, ej.fruta, ej.guisos, ej.cafe].map((r) => r.id);
  assert.equal(base.n, 4);
  assert.deepEqual(base.refs, compras);
  assert.equal(base.hasta, ej.cafe.id);
  assert.equal(base.profundidad, 1);
  assert.equal(base.desde, 'hijos');
  const aMano = compras.map((id) => baseUnitaria(medir(eje, id))).reduce(fundir, baseVacia());
  igualesEstadistica(base, aMano);
  assert.equal(base.medidas['formulas.pendientes'].suma, 1);
  assert.deepEqual(base.medidas.profundidad.cajas, [0, 0, 0, 4, 0, 0, 0, 0, 0, 0]);
  assert.equal(baseDe(eje, ej.cafe.id).n, 0);
});

test('escribirBase: evento en el 8 del padre, firmado, gasta T; contexto con n y hasta', async () => {
  const ej = await ejemploComprasHermanas({ claves: { casa } });
  const { eje } = ej;
  const antes = eje.saldoT('casa', 'minuto');
  const escritosMenu = medir(eje, ej.menu.id).escritos;
  const ev = await escribirBase(eje, { autor: 'casa', padre: ej.menu.id, privada: casa.privada, t: T_BASES });
  assert.equal(ev.sobre, ej.menu.id);
  assert.equal(ev.en, CIELO);
  assert.equal(ev.firmante, 'casa');
  assert.deepEqual(ev.contexto, { bases: true, n: 4, hasta: ej.cafe.id, profundidad: 1, desde: 'hijos', cortes: VERSION_CORTES });
  assert.equal(eje.saldoT('casa', 'minuto'), antes - 1);
  assert.ok(validarPayload(ev.payload).ok);
  assert.ok(esBase(ev));
  // La base no es hija de lo que mide ni cuenta como escrito.
  assert.equal(medir(eje, ej.menu.id).escritos, escritosMenu);
  assert.ok(!hijos(eje, ej.menu.id).some(esBase));
  // Sin clave, sin firma, sin nada que medir: no se escribe.
  await assert.rejects(escribirBase(eje, { autor: 'cocina', padre: ej.menu.id, privada: casa.privada, t: T_BASES }), /identidad con clave/);
  await assert.rejects(escribirBase(eje, { autor: 'casa', padre: ej.menu.id, t: T_BASES }), /va firmada/);
  await assert.rejects(escribirBase(eje, { autor: 'casa', padre: ej.cafe.id, privada: casa.privada, t: T_BASES }), /nada que medir/);
  await assert.rejects(escribirBase(eje, { autor: 'casa', padre: ej.cafe.id, privada: casa.privada, t: T_BASES, desde: 'bases' }), /nada que fundir/);
});

test('leerBase: la más reciente del 8, con frescura; corregir deja la anterior como colisión', async () => {
  const ej = await ejemploComprasHermanas({ claves: { casa } });
  const { eje } = ej;
  assert.equal(leerBase(eje, ej.menu.id), null);
  const primera = await escribirBase(eje, { autor: 'casa', padre: ej.menu.id, privada: casa.privada, t: T_BASES });
  const leida = leerBase(eje, ej.menu.id);
  assert.equal(leida.id, primera.id);
  igualesEstadistica(leida, baseDe(eje, ej.menu.id));
  assert.deepEqual(leida.refs, baseDe(eje, ej.menu.id).refs);
  assert.deepEqual(leida.frescura, { t: T_BASES, hijosNuevos: 0, basesNuevas: 0, alDia: true });
  assert.equal(leida.anteriores, 0);
  // Llega otra compra hermana: la base envejece.
  await eje.escribir({ autor: 'huesped', sobre: ej.menu.id, t: '2026-11-07T18:30:00Z', movimientos: [hora('huesped')], payload: 'Otro café' });
  assert.deepEqual(leerBase(eje, ej.menu.id).frescura, { t: T_BASES, hijosNuevos: 1, basesNuevas: 0, alDia: false });
  // Corregir = escribir otra base; la anterior queda en el 8 como colisión.
  const segunda = await escribirBase(eje, { autor: 'casa', padre: ej.menu.id, privada: casa.privada, t: '2026-11-07T19:00:00Z' });
  const nueva = leerBase(eje, ej.menu.id);
  assert.equal(nueva.id, segunda.id);
  assert.equal(nueva.n, 5);
  assert.equal(nueva.anteriores, 1);
  assert.ok(nueva.frescura.alDia);
  const enElCielo = ocupantes(eje, ej.menu.id, [8]).filter((o) => o.tipo === 'escrito').map((o) => o.evento);
  assert.deepEqual(enElCielo.sort(), [primera.id, segunda.id].sort());
});

test('leerBase ignora lo que no es una base válida: sin firma o mal formada', async () => {
  const ej = await ejemploComprasHermanas({ claves: { casa } });
  const { eje } = ej;
  const buena = await escribirBase(eje, { autor: 'casa', padre: ej.menu.id, privada: casa.privada, t: T_BASES });
  // Mal formada aunque la firme la casa.
  await eje.escribir({ autor: 'casa', sobre: ej.menu.id, en: CIELO, t: '2026-11-07T18:10:00Z', movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'casa', a: null }], payload: ['Bases del 8', 99], contexto: { bases: true, n: 99, hasta: ej.cafe.id } }, casa.privada);
  // Bien formada pero de quien no tiene clave ni firma.
  await eje.escribir({ autor: 'huesped', sobre: ej.menu.id, en: CIELO, t: '2026-11-07T18:20:00Z', movimientos: [hora('huesped')], payload: payloadDeBase(baseDe(eje, ej.menu.id)), contexto: { bases: true, n: 4, hasta: ej.cafe.id } });
  const leida = leerBase(eje, ej.menu.id);
  assert.equal(leida.id, buena.id);
  assert.equal(leida.anteriores, 0);
  assert.equal(baseDePayload(['Bases del 8', 99]), null);
  // Fuera del 8 no es una base, se diga lo que se diga: es un hijo más.
  const fuera = await eje.escribir({ autor: 'huesped', sobre: ej.menu.id, en: '1000000000', t: '2026-11-07T18:40:00Z', movimientos: [hora('huesped')], payload: 'nota', contexto: { bases: true } });
  assert.ok(!esBase(fuera));
  assert.equal(hijos(eje, ej.menu.id).at(-1).id, fuera.id);
  assert.equal(leerBase(eje, ej.menu.id).frescura.hijosNuevos, 1);
});

test('fundirHaciaArriba: el 8 del proyecto funde las bases de sus hijos sin releer registros', async () => {
  const ej = await ejemploComprasHermanas({ claves: { casa } });
  const { eje } = ej;
  const menu = await escribirBase(eje, { autor: 'casa', padre: ej.menu.id, privada: casa.privada, t: T_BASES });
  // La cena aún no tiene base: no cuenta y se dice.
  let alta = fundirHaciaArriba(eje, ej.alta.id);
  assert.equal(alta.n, 4);
  assert.deepEqual(alta.sinBase, [ej.cena.id]);
  assert.deepEqual(alta.refs, [menu.id]);
  const cena = await escribirBase(eje, { autor: 'casa', padre: ej.cena.id, privada: casa.privada, t: T_BASES });
  alta = fundirHaciaArriba(eje, ej.alta.id);
  assert.equal(alta.n, 6);
  assert.equal(alta.profundidad, 2);
  assert.equal(alta.desde, 'bases');
  assert.deepEqual(alta.refs, [menu.id, cena.id]);
  assert.deepEqual(alta.sinBase, []);
  assert.equal(alta.hasta, ej.cena.id);
  // Lo mismo que medir las seis compras una a una.
  const compras = [ej.compra, ej.fruta, ej.guisos, ej.cafe, ej.compraCena, ej.sopa].map((r) => r.id);
  igualesEstadistica(alta, compras.map((id) => baseUnitaria(medir(eje, id))).reduce(fundir, baseVacia()));
  igualesEstadistica(alta, fundir(leerBase(eje, ej.menu.id), leerBase(eje, ej.cena.id)));
  // Profundidad explícita: a profundidad 3 no hay bases de nietos debajo de alta.
  assert.equal(fundirHaciaArriba(eje, ej.alta.id, { profundidad: 3 }).n, 0);
  assert.throws(() => fundirHaciaArriba(eje, ej.alta.id, { profundidad: 1 }), /profundidad >= 2/);
});

test('las seis bases del ejemplo: hermanos, proyectos y génesis; frescura de las fundidas', async () => {
  const ej = await ejemploComprasHermanas({ claves: { casa } });
  const { eje } = ej;
  const bases = await escribirBasesDelEjemplo(ej, casa.privada);
  const general = leerBase(eje, eje.genesisId);
  assert.equal(general.id, bases.general.id);
  assert.equal(general.n, 8);
  assert.equal(general.profundidad, 3);
  assert.deepEqual(general.refs, [bases.proyectos.alta.id, bases.proyectos.mercado.id]);
  assert.equal(leerBase(eje, ej.mercado.id).n, 2);
  assert.equal(leerBase(eje, ej.alta.id).n, 6);
  // Ocho compras a profundidad 3; una fórmula pendiente (los dos guisos) y dos resueltas (guisos y sopa).
  assert.equal(general.medidas['formulas.pendientes'].suma, 1);
  assert.equal(general.medidas['formulas.resueltas'].suma, 2);
  assert.deepEqual(general.medidas.profundidad.cajas, [0, 0, 0, 8, 0, 0, 0, 0, 0, 0]);
  assert.ok(general.frescura.alDia);
  // Corregir la base del menú deja anticuadas las fundidas de arriba: la de alta lo dice.
  await eje.escribir({ autor: 'vecina', sobre: ej.menu.id, t: '2026-11-07T18:30:00Z', movimientos: [hora('vecina')], payload: 'Un té' });
  await escribirBase(eje, { autor: 'casa', padre: ej.menu.id, privada: casa.privada, t: '2026-11-07T19:00:00Z' });
  assert.deepEqual(leerBase(eje, ej.alta.id).frescura, { t: T_BASES, hijosNuevos: 0, basesNuevas: 1, alDia: false });
  assert.ok(leerBase(eje, eje.genesisId).frescura.alDia); // el génesis solo mira las bases de sus hijos
  const alta2 = await escribirBase(eje, { autor: 'casa', padre: ej.alta.id, privada: casa.privada, t: '2026-11-07T19:10:00Z', desde: 'bases' });
  assert.equal(alta2.contexto.n, 7);
  assert.equal(leerBase(eje, eje.genesisId).frescura.basesNuevas, 1);
});

test('situar: el foco en su caja por medida en las tres cohortes', async () => {
  const ej = await ejemploComprasHermanas({ claves: { casa } });
  const { eje } = ej;
  const sinBase = situar(eje, ej.guisos.id);
  assert.equal(sinBase.estado, 'PENDIENTE');
  assert.match(sinBase.motivo, /sin base en el 8/);
  await escribirBasesDelEjemplo(ej, casa.privada);
  const esperado = { hermanos: [ej.menu.id, 1, 4], proyecto: [ej.alta.id, 2, 6], general: [eje.genesisId, 3, 8] };
  for (const cohorte of COHORTES) {
    const s = situar(eje, ej.guisos.id, { cohorte });
    assert.equal(s.estado, 'RESUELTO', cohorte);
    assert.deepEqual([s.registro, s.profundidad, s.n], esperado[cohorte]);
    assert.ok(s.frescura.alDia);
    for (const [m, x] of Object.entries(s.medidas)) {
      assert.equal(x.debajo + x.enCaja + x.encima, s.n, cohorte + ' ' + m);
      assert.ok(x.enCaja >= 1, cohorte + ' ' + m); // el foco está medido en todas
      assert.equal(x.caja, caja(m, x.valor));
      assert.equal(x.etiqueta, HITOS[x.caja]);
      assert.ok(!('nivel' in x) && !('grado' in x));
    }
  }
  const h = situar(eje, ej.guisos.id, { cohorte: 'hermanos' });
  assert.equal(h.incluido, true);
  assert.deepEqual(
    [h.medidas.posiciones.valor, h.medidas.posiciones.caja, h.medidas.posiciones.debajo, h.medidas.posiciones.enCaja],
    [9, 5, 1, 3], // nueve posiciones; por debajo, el café
  );
  assert.equal(h.medidas['formulas.pendientes'].encima, 0); // solo los guisos tienen una pendiente
  assert.equal(situar(eje, ej.manzanas.id, { cohorte: 'proyecto' }).registro, ej.mercado.id);
  assert.equal(proyectoDe(eje, ej.guisos.id), ej.alta.id);
  // Sin cohorte: el génesis no tiene padre; un proyecto no tiene proyecto por encima.
  assert.match(situar(eje, eje.genesisId).motivo, /sin cohorte/);
  assert.match(situar(eje, ej.alta.id, { cohorte: 'proyecto' }).motivo, /sin cohorte/);
  assert.throws(() => situar(eje, ej.guisos.id, { cohorte: 'linaje' }), /cohorte desconocida/);
  assert.throws(() => situar(eje, ej.guisos.id, { cohorte: 'proyecto', proyecto: ej.mercado.id }), /no está en el hilo/);
});

test('las bases son registros: se guardan y se reconstruyen con el eje', async () => {
  const ej = await ejemploComprasHermanas({ claves: { casa } });
  await escribirBasesDelEjemplo(ej, casa.privada);
  const otro = await restaurar(JSON.parse(JSON.stringify(serializar(ej.eje))));
  for (const id of [ej.menu.id, ej.alta.id, otro.genesisId]) {
    const a = leerBase(ej.eje, id);
    const b = leerBase(otro, id);
    assert.equal(b.id, a.id);
    igualesEstadistica(b, a);
  }
});

test('payload: más de diez hijos o series se anidan en décuplas y se leen igual', async () => {
  assert.deepEqual(empaquetar([1, 2, 3]), [1, 2, 3]);
  const muchos = Array.from({ length: 123 }, (_, i) => i);
  const arbol = empaquetar(muchos);
  assert.ok(arbol.length <= 10);
  assert.deepEqual(arbol.flat(Infinity), muchos);
  assert.ok(validarPayload(arbol).ok);
  // Una base con doce hijos y doce series de tokens.
  const ej = await ejemploComprasHermanas({ claves: { casa } });
  const { eje } = ej;
  for (let i = 0; i < 12; i++) {
    await eje.escribir({ autor: 'huesped', sobre: ej.peras.id, t: '2026-11-07T18:' + String(10 + i) + ':00Z', movimientos: [hora('huesped')], payload: 'nota ' + i });
  }
  const base = baseDe(eje, ej.peras.id);
  for (let i = 0; i < 12; i++) base.medidas['movimientos.E:serie' + String(i).padStart(2, '0') + '/X'] = bloqueDe(base, 'movimientos.E:nada/X');
  const payload = payloadDeBase(base);
  assert.ok(validarPayload(payload).ok);
  const leida = baseDePayload(payload);
  assert.deepEqual(leida.refs, base.refs);
  igualesEstadistica({ ...leida, cortes: base.cortes }, base);
  const ev = await escribirBase(eje, { autor: 'casa', padre: ej.peras.id, privada: casa.privada, t: T_BASES });
  assert.equal(leerBase(eje, ej.peras.id).refs.length, 12);
  assert.equal(ev.contexto.n, 12);
});
