// CAJA y FRESCURA en BQL (docs/BQL.md §7.14): leen, sin efectos, la base
// vigente del 8 que resume el alcance del anfitrión, con las bases de
// src/bases.js. BASES() es la de src/bases.js (valorDeBases; sus pruebas, en
// test/bases.test.js). Ejemplo: las compras hermanas de
// ejemplos/ikisai/compras-hermanas.mjs (datos inventados).

// tiempo.js va primero a propósito: tiempo → motor → bql → bases → bql es un
// ciclo de importación (y tiempo reexporta de bases), y entrar por aquí no
// debe romper la carga.
import { HITOS, ALCANCES } from '../src/tiempo.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Eje } from '../src/eje.js';
import { generarClaves } from '../src/autoridad.js';
import { consultar, evaluar, esPendiente } from '../src/bql.js';
import { CIELO, ETIQUETAS, clavesDeMedidas, medir, leerBase, basesEn, situar, comprobar, esBase } from '../src/bases.js';
import * as agram from '../src/index.js';
import { COSAS, ejemploComprasHermanas, escribirBaseDe, escribirBasesDelEjemplo } from '../ejemplos/ikisai/compras-hermanas.mjs';

const RAIZ = '0000000000';
const claves = {};
for (const id of ['casa', ...COSAS]) claves[id] = await generarClaves();
const nuevo = () => ejemploComprasHermanas({ claves });
const hora = (de) => ({ token: 'T', escala: 'hora', cantidad: 1, de, a: null });
const SERIES = ['T:hora', 'E:casa/EUR'];

/** Consulta una fórmula como si estuviera en la raíz del registro `id` (el anfitrión: por defecto, la compra de dos guisos). */
const q = (ej, formula, id = ej.guisos.id, opciones) => consultar(ej.eje, id, [], formula, opciones);
const valor = (ej, formula, id) => {
  const r = q(ej, formula, id);
  assert.equal(r.estado, 'RESUELTO', formula + ': ' + r.texto);
  return r.valor.valor;
};
/** Frescura de la base vigente del 8 de un registro, sumada: lo que da FRESCURA. */
const llegadas = (eje, registro) => {
  const f = leerBase(eje, registro).frescura;
  return f.hijosNuevos + f.basesNuevas + f.debajo;
};

test('el ciclo de importación no rompe la carga: ETIQUETAS sigue siendo HITOS', () => {
  assert.equal(ETIQUETAS, HITOS);
  assert.equal(agram.bases.ETIQUETAS, HITOS);
  assert.equal(typeof agram.bql.consultar, 'function');
});

test('sin base escrita: PENDIENTE, el motivo dice cómo escribirla y qué vigilar', async () => {
  const ej = await nuevo();
  const { eje } = ej;
  const menu8 = ej.menu.id.slice(0, 8);
  // La escribe la propia cosa o quien tiene P sobre el registro (VG, 7-11 noche): aquí, la cosa del menú o la casa.
  const hermanos = 'sin base escrita en el 8 de ' + menu8 + ' (alcance hermanos). Para escribirla: escribirBase(eje, { registro, autor, privada }) con registro = '
    + menu8 + ', firmada por menu-dia (su identidad propia) o casa (con P sobre él); mide sus hijos y gasta 1 minuto de su T.';
  for (const f of ['CAJA("terminales")', 'FRESCURA()', 'CAJA("E:casa/EUR", "hermanos")', 'FRESCURA("hermanos")', 'BASES("hermanos")', 'BASES("hermanos", "terminales")']) {
    const r = q(ej, f);
    assert.deepEqual([r.estado, r.motivo], ['PENDIENTE', hermanos], f);
    assert.ok(r.dependencias.includes(ej.menu.id + ':' + CIELO), f); // lo que hay que vigilar: el 8 donde llegará la base
  }
  // En los alcances que funden, la base de arriba funde las de abajo: se escriben antes.
  const proyecto = q(ej, 'FRESCURA("proyecto")').motivo;
  assert.ok(proyecto.startsWith('sin base escrita en el 8 de ' + ej.comedor.id.slice(0, 8) + ' (alcance proyecto). '), proyecto);
  assert.match(proyecto, /firmada por comedor \(su identidad propia\) o casa \(con P sobre él\); mide sus hijos y funde la base vigente del 8 de cada uno \(se escriben antes, de abajo arriba; un hijo sin base cuenta solo por sí mismo\)/);
  assert.match(q(ej, 'CAJA("terminales", "general")').motivo, /firmada por casa \(su identidad propia\);/);
  // Un registro sin identidad propia (una compra): solo quien tiene P sobre él puede escribir su base, y se dice.
  const nota = await eje.escribir({ autor: 'huesped', sobre: ej.guisos.id, t: '2026-11-07T17:30:00Z', movimientos: [hora('huesped')], payload: 'Sin picante' });
  assert.equal(q(ej, 'FRESCURA()', nota.id).motivo, 'sin base escrita en el 8 de ' + ej.guisos.id.slice(0, 8) + ' (alcance hermanos). Para escribirla: escribirBase(eje, { registro, autor, privada }) con registro = '
    + ej.guisos.id.slice(0, 8) + ', firmada por casa (con P sobre él); mide sus hijos y gasta 1 minuto de su T.');
  // Sin identidad propia y sin nadie con clave y P sobre él, nadie puede escribirla.
  const solo = await Eje.genesis({ identidad: 'raiz', tipo: 'grupo', emision: [{ token: 'T', escala: 'minuto', cantidad: 10 }], foco: 'Sin poder', t: '2026-11-07T09:00:00Z' });
  const lista = await solo.escribir({ autor: 'raiz', sobre: solo.genesisId, t: '2026-11-07T09:00:00Z', movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'raiz', a: null }], payload: 'Lista' });
  const punto = await solo.escribir({ autor: 'raiz', sobre: lista.id, t: '2026-11-07T09:00:00Z', movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'raiz', a: null }], payload: 'Punto' });
  assert.equal(consultar(solo, punto.id, [], 'FRESCURA()').motivo, 'sin base escrita en el 8 de ' + lista.id.slice(0, 8) + ' (alcance hermanos). ' + lista.id.slice(0, 8)
    + ' no tiene identidad propia con clave (identidadDe) y nadie con clave tiene poder (P) sobre él: nadie puede escribir su base.');
  // Con un gancho que no deja leer el registro, la cosa (que sale de su contexto) no se nombra; quien tiene P (los saldos), sí.
  const callado = q(ej, 'FRESCURA()', ej.guisos.id, { puedeLeer: (id) => id !== ej.menu.id });
  assert.match(callado.motivo, /firmada por su identidad propia o casa \(con P sobre él\); mide sus hijos/);
  // Lo escrito en el 8 que no es una base válida (no la firma la cosa del menú) no cuenta.
  await eje.escribir({ autor: 'huesped', sobre: ej.menu.id, en: CIELO, t: '2026-11-07T17:40:00Z', movimientos: [hora('huesped')], payload: ['Bases del 8', 4], contexto: { bases: true } });
  assert.equal(q(ej, 'FRESCURA()').estado, 'PENDIENTE');
  await escribirBaseDe(ej, ej.menu.id);
  assert.equal(q(ej, 'FRESCURA()').estado, 'RESUELTO');
});

test('CAJA(medida, alcance?): la caja del anfitrión, la misma que BASES(alcance, medida) y que situar', async () => {
  const ej = await nuevo();
  const { eje } = ej;
  await escribirBasesDelEjemplo(ej);
  for (const alcance of ALCANCES) {
    const s = situar(eje, ej.guisos.id, { alcance });
    for (const m of [...clavesDeMedidas(), ...SERIES]) {
      const caja = valor(ej, 'CAJA("' + m + '", "' + alcance + '")');
      assert.equal(caja, (s.medidas[m] ?? s.tokens[m]).caja, alcance + ' ' + m);
      assert.equal(caja, valor(ej, 'BASES("' + alcance + '", "' + m + '")'), alcance + ' ' + m);
    }
  }
  // Por defecto, los hermanos: los guisos (nueve terminales) caen en la caja 5.
  assert.equal(q(ej, 'CAJA("terminales")').texto, '5');
  assert.equal(q(ej, 'CAJA("terminales") = 5').texto, 'verdadero'); // un número BQL más
  assert.equal(q(ej, 'CAJA("terminales") + CAJA("escritos")').texto, '5');
  // Otro anfitrión, otro 8: las manzanas se sitúan entre los hijos del puesto.
  assert.equal(valor(ej, 'CAJA("terminales")', ej.manzanas.id), situar(eje, ej.manzanas.id).medidas.terminales.caja);
  // Una serie emitida que nadie de la cohorte mueve vale cero: caja 0, con todos.
  assert.equal(q(ej, 'CAJA("P:genesis")').texto, '0');
  // Sin efectos: nada escrito, nada movido.
  const antes = [eje.orden.length, eje.saldoT('menu-dia', 'minuto'), eje.saldoT('casa', 'minuto')];
  for (const f of ['CAJA("terminales", "general")', 'FRESCURA("proyecto")', 'CAJA("E:casa/EUR")']) q(ej, f);
  assert.deepEqual([eje.orden.length, eje.saldoT('menu-dia', 'minuto'), eje.saldoT('casa', 'minuto')], antes);
});

test('CAJA: argumentos y series; una serie mal escrita no se lee como caja 0', async () => {
  const ej = await nuevo();
  const conBase = await nuevo();
  await escribirBasesDelEjemplo(conBase);
  const err = (f, e = conBase) => {
    const r = q(e, f);
    assert.equal(r.estado, 'ERROR', f + ': ' + r.texto);
    return r.motivo;
  };
  assert.equal(err('CAJA()'), 'CAJA espera una medida y, si acaso, un alcance');
  assert.equal(err('CAJA("terminales", "hermanos", 1)'), 'CAJA espera una medida y, si acaso, un alcance');
  assert.equal(err('CAJA(3)'), 'CAJA espera el nombre de una medida entre comillas, no numero');
  assert.equal(err('CAJA("terminales", "linaje")'), 'CAJA: el alcance es hermanos, proyecto, general');
  assert.equal(err('CAJA("terminales", 1)'), 'CAJA: el alcance es hermanos, proyecto, general');
  assert.equal(err('FRESCURA("vecinos")'), 'FRESCURA: el alcance es hermanos, proyecto, general');
  assert.equal(err('FRESCURA("hermanos", 2)'), 'FRESCURA espera, si acaso, un alcance');
  const desconocida = /^CAJA: medida desconocida: .+ \(posiciones, terminales, escritos, movimientos, identidades, profundidadHilo, formulasResueltas, formulasPendientes o una serie T:<escala>, E:<emisor>\/<denominación>, P:<ámbito> o R:<emisor>\)$/;
  // Nombres de la versión anterior de esta PR, series mal formadas y escalas que no existen.
  for (const m of ['inventada', 'posiciones.3', 'movimientos.typo', 'movimientos.E:casa/EUR', 'E:typo', 'E:/EUR', 'E:casa/', 'T:siglo', 'R:a/b', 'X:hora']) {
    assert.match(err('CAJA("' + m + '")'), desconocida, m);
    assert.match(err('CAJA("' + m + '")', ej), desconocida, m + ' sin base: se valida antes de leer');
  }
  // Bien formada pero sin emitir en el eje: PENDIENTE (la emisión puede llegar), con las que hay.
  const emitidas = ' (series emitidas: T:hora, T:minuto, E:casa/EUR, P:genesis)';
  for (const [m, motivo] of [['E:csa/EUR', 'la serie E:csa/EUR no se ha emitido en el eje'], ['T:dia', 'la serie T:dia no se ha emitido en el eje'], ['R:casa', 'la serie R:casa no se ha emitido en el eje'], ['P:abc', 'el ámbito de P:abc no es un registro del eje']]) {
    const r = q(conBase, 'CAJA("' + m + '")');
    assert.deepEqual([r.estado, r.motivo], ['PENDIENTE', 'CAJA: ' + motivo + emitidas], m);
  }
  // El ámbito de P puede ser un registro del eje.
  assert.equal(q(conBase, 'CAJA("P:' + conBase.menu.id + '")').texto, '0');
});

test('FRESCURA(alcance?): llegadas desde la base, las que cuenta su frescura; 0 no es «al día»', async () => {
  const ej = await nuevo();
  const { eje } = ej;
  await escribirBasesDelEjemplo(ej);
  const registros = [ej.menu.id, ej.comedor.id, eje.genesisId]; // los 8 que leen los tres alcances desde los guisos
  const fr = (id = ej.guisos.id) => ALCANCES.map((a) => valor(ej, 'FRESCURA("' + a + '")', id));
  assert.deepEqual(fr(), [0, 0, 0]);
  // Llega un té al menú: la base del menú tiene un hijo nuevo; la del comedor y la del génesis lo ven debajo.
  await eje.escribir({ autor: 'vecina', sobre: ej.menu.id, t: '2026-11-07T18:30:00Z', movimientos: [hora('vecina')], payload: 'Un té' });
  assert.deepEqual(fr(), [1, 1, 1]);
  assert.deepEqual(fr(), registros.map((id) => llegadas(eje, id)));
  assert.deepEqual(registros.map((id) => leerBase(eje, id).frescura.sinNovedades), [false, false, false]);
  // Corregir la base del menú: la de los hermanos, sin llegadas; arriba, una base renovada.
  await escribirBaseDe(ej, ej.menu.id, { t: '2026-11-07T19:00:00Z' });
  assert.deepEqual(fr(), [0, 1, 1]);
  assert.deepEqual(fr(), registros.map((id) => llegadas(eje, id)));
  // La frescura es la de la base entera: desde la cena, la base renovada de su hermano el menú cuenta en «hermanos».
  assert.equal(valor(ej, 'FRESCURA()', ej.cena.id), 1);
  // Lo que cambia en un registro ya medido no es una llegada: FRESCURA da 0 y comprobar() lo ve.
  await eje.escribir({ autor: 'vecina', sobre: ej.cafe.id, en: '4000000000', t: '2026-11-07T19:30:00Z', movimientos: [hora('vecina')], payload: 'Sin azúcar' });
  assert.equal(valor(ej, 'FRESCURA()'), 0);
  assert.equal(comprobar(eje, leerBase(eje, ej.menu.id)).alDia, false);
});

test('dependencias: el 8 leído y la base; CAJA, además, el anfitrión medido', async () => {
  const ej = await nuevo();
  await escribirBasesDelEjemplo(ej);
  const base = leerBase(ej.eje, ej.menu.id).id;
  assert.deepEqual(q(ej, 'CAJA("terminales")').dependencias.sort(), [ej.menu.id + ':' + CIELO, base + ':' + RAIZ, ej.guisos.id + ':' + RAIZ].sort());
  assert.deepEqual(q(ej, 'FRESCURA()').dependencias.sort(), [ej.menu.id + ':' + CIELO, base + ':' + RAIZ].sort());
  const general = leerBase(ej.eje, ej.eje.genesisId).id;
  assert.deepEqual(q(ej, 'FRESCURA("general")').dependencias.sort(), [ej.eje.genesisId + ':' + CIELO, general + ':' + RAIZ].sort());
});

test('PENDIENTE POR LÍMITE: se cobra lo que la lectura examina, contado mientras se examina', async () => {
  const ej = await nuevo();
  const { eje } = ej;
  const sobre = (id) => eje.sobre(id).length;
  // Sin base, mirar el 8 del menú: la base que no está y sus cuatro hijos.
  const conPresupuesto = (f, presupuesto) => q(ej, f, ej.guisos.id, { limites: { presupuesto } });
  assert.equal(conPresupuesto('FRESCURA()', 1 + 1 + sobre(ej.menu.id)).estado, 'PENDIENTE');
  assert.equal(conPresupuesto('FRESCURA()', 1 + sobre(ej.menu.id)).estado, 'PENDIENTE POR LÍMITE');
  await escribirBasesDelEjemplo(ej);
  // Lo que examina la frescura: 1 por la base, los escritos sobre el registro y, por cada hijo medido, los
  // escritos sobre él (su 8), bajando por las bases fundidas que siguen vigentes.
  const coste = (registro) => {
    let c = sobre(registro);
    const b = leerBase(eje, registro);
    for (const h of b.refsHijos) {
      c += sobre(h);
      const v = basesEn(eje, h).at(-1);
      if (v && b.refsBases.includes(v.id)) c += coste(h) - sobre(h);
    }
    return c;
  };
  const costeHermanos = 1 + coste(ej.menu.id);
  const costeGeneral = 1 + coste(eje.genesisId);
  assert.deepEqual([costeHermanos, costeGeneral], [6, 20]); // el menú: la base y cinco escritos; el génesis: todo el árbol de bases
  // FRESCURA() gasta un paso; con un argumento, dos. Lo demás es la lectura.
  const corto = conPresupuesto('FRESCURA()', costeHermanos);
  assert.equal(corto.estado, 'PENDIENTE POR LÍMITE');
  assert.ok(esPendiente(corto.estado));
  assert.equal(corto.motivo, 'el alcance hermanos (8 de ' + ej.menu.id.slice(0, 8) + ') exige examinar al menos 6 registros y quedan 5 pasos de presupuesto');
  assert.deepEqual(corto.parcial, { examinados: 0, de: 6 });
  assert.equal(conPresupuesto('FRESCURA()', costeHermanos + 1).estado, 'RESUELTO');
  assert.equal(conPresupuesto('FRESCURA("general")', costeGeneral + 2).estado, 'RESUELTO');
  assert.equal(conPresupuesto('FRESCURA("general")', costeGeneral + 1).estado, 'PENDIENTE POR LÍMITE');
  // Se deja de contar en cuanto no cabe: «al menos», y `de` es una cota inferior.
  const pronto = conPresupuesto('FRESCURA("general")', 2 + 1 + sobre(eje.genesisId) + 1);
  assert.equal(pronto.motivo, 'el alcance general (8 de ' + eje.genesisId.slice(0, 8) + ') exige examinar al menos ' + (1 + sobre(eje.genesisId) + sobre(ej.comedor.id)) + ' registros y quedan ' + (1 + sobre(eje.genesisId) + 1) + ' pasos de presupuesto');
  // CAJA cobra la misma lectura (medir el anfitrión aparte: §7.14).
  assert.equal(conPresupuesto('CAJA("terminales")', 2 + costeHermanos).estado, 'RESUELTO');
  assert.equal(conPresupuesto('CAJA("terminales")', 1 + costeHermanos).estado, 'PENDIENTE POR LÍMITE');
  // BASES hereda el presupuesto: cobra la misma lectura del 8 (VG, 7-11 noche); BASES() lee el 8 del propio anfitrión.
  assert.equal(conPresupuesto('BASES("hermanos")', 2 + costeHermanos).estado, 'RESUELTO');
  assert.equal(conPresupuesto('BASES("hermanos")', 1 + costeHermanos).estado, 'PENDIENTE POR LÍMITE');
  assert.equal(conPresupuesto('BASES("hermanos", "terminales", "suma")', 4 + costeHermanos).estado, 'RESUELTO');
  assert.equal(conPresupuesto('BASES("hermanos", "terminales", "suma")', 3 + costeHermanos).estado, 'PENDIENTE POR LÍMITE');
  const costePropio = 1 + coste(ej.menu.id);
  assert.equal(q(ej, 'BASES()', ej.menu.id, { limites: { presupuesto: 1 + costePropio } }).texto, '4');
  assert.equal(q(ej, 'BASES()', ej.menu.id, { limites: { presupuesto: costePropio } }).estado, 'PENDIENTE POR LÍMITE');
  // El presupuesto es de toda la fórmula: dos lecturas se suman.
  assert.equal(conPresupuesto('FRESCURA() + FRESCURA()', 3 + 2 * costeHermanos).estado, 'RESUELTO');
  assert.equal(conPresupuesto('FRESCURA() + FRESCURA()', 2 + 2 * costeHermanos).estado, 'PENDIENTE POR LÍMITE');
});

test('CAJA dentro de su propio registro no se mide a sí misma (ni se cuelga); FRESCURA no mide', async () => {
  const ej = await nuevo();
  const { eje } = ej;
  await escribirBasesDelEjemplo(ej);
  const x = await eje.escribir({
    autor: 'vecina',
    sobre: ej.menu.id,
    t: '2026-11-07T18:30:00Z',
    movimientos: [hora('vecina')],
    payload: ['Compra con su caja', '=CAJA("terminales")', '=FRESCURA()', '=CAJA("formulasResueltas")'],
  });
  assert.equal(evaluar(eje, x.id, [1]).texto, '4'); // cuatro terminales: caja 4
  assert.equal(evaluar(eje, x.id, [2]).texto, '1'); // la propia x es una llegada
  // Medida para situarla, x no se vuelve a medir: sus dos CAJA cuentan como pendientes; FRESCURA se resuelve.
  assert.deepEqual([medir(eje, x.id).formulasResueltas, medir(eje, x.id).formulasPendientes], [1, 2]);
  assert.equal(evaluar(eje, x.id, [3]).texto, '1'); // una resuelta: caja 1
  const dentro = evaluar(eje, x.id, [1]);
  assert.equal(dentro.estado, 'RESUELTO');
  // Una referencia que vuelve al mismo registro por otro también termina.
  const y = await eje.escribir({ autor: 'huesped', sobre: ej.menu.id, t: '2026-11-07T19:10:00Z', movimientos: [hora('huesped')], payload: ['Mira la caja de x', { ref: x.id, dir: '1000000000' }, '=LOCAL(1) + CAJA("terminales")'] });
  assert.equal(evaluar(eje, y.id, [2]).estado, 'RESUELTO');
  assert.deepEqual([medir(eje, y.id).formulasResueltas, medir(eje, y.id).formulasPendientes], [0, 1]);
});

test('lo que se guarda en el 8 depende del 8 anterior solo por las fórmulas que leen el 8 sin situar a su registro', async () => {
  // Un té bajo el menú con FRESCURA y BASES("hermanos"), que leen el 8 del menú sin medir al té.
  const ej = await nuevo();
  const { eje } = ej;
  await eje.escribir({ autor: 'vecina', sobre: ej.menu.id, t: '2026-11-07T17:30:00Z', movimientos: [hora('vecina')], payload: ['Un té', '=FRESCURA()', '=BASES("hermanos")'] });
  await escribirBaseDe(ej, ej.menu.id, { t: '2026-11-07T18:00:00Z' });
  // La primera base: sin base anterior, las dos fórmulas del té cuentan como pendientes. Su frescura no lo ve.
  const primera = leerBase(eje, ej.menu.id);
  assert.equal(primera.frescura.sinNovedades, true);
  assert.equal(valor(ej, 'FRESCURA()'), 0);
  const c = comprobar(eje, primera);
  assert.equal(c.alDia, false); // recalculada ahora, con una base en el 8, las dos se resuelven
  assert.deepEqual(c.diferencias[0].hijos, ['formulasPendientes', 'formulasResueltas']);
  // La segunda, escrita sin que nada llegue, ya las cuenta como resueltas.
  await escribirBaseDe(ej, ej.menu.id, { t: '2026-11-07T18:05:00Z' });
  const [b1, b2] = basesEn(eje, ej.menu.id);
  assert.equal(b2.hijos.medidas.formulasResueltas.suma - b1.hijos.medidas.formulasResueltas.suma, 2);
  assert.equal(b1.hijos.medidas.formulasPendientes.suma - b2.hijos.medidas.formulasPendientes.suma, 2);
  assert.equal(comprobar(eje, leerBase(eje, ej.menu.id)).alDia, true);
  // CAJA sitúa a su registro: al medirlo para una base queda pendiente, haya base o no. No depende del 8 anterior.
  const otro = await nuevo();
  await otro.eje.escribir({ autor: 'vecina', sobre: otro.menu.id, t: '2026-11-07T17:30:00Z', movimientos: [hora('vecina')], payload: ['Leche', '=CAJA("terminales")', '=CAJA("terminales", "general")'] });
  await escribirBaseDe(otro, otro.menu.id, { t: '2026-11-07T18:00:00Z' });
  await escribirBaseDe(otro, otro.menu.id, { t: '2026-11-07T18:05:00Z' });
  const [o1, o2] = basesEn(otro.eje, otro.menu.id);
  assert.deepEqual(o2.hijos, o1.hijos);
  assert.equal(comprobar(otro.eje, o1).alDia, true);
});

test('autorización: la base y, en CAJA, el anfitrión pasan por el gancho; el anfitrión, solo si hay base', async () => {
  const ej = await nuevo();
  const { eje } = ej;
  const sinFoco = { puedeLeer: (id) => id !== ej.guisos.id };
  // Sin base, el anfitrión no se mide ni se pide: PENDIENTE por la base, no por la autorización.
  assert.equal(q(ej, 'CAJA("terminales")', ej.guisos.id, sinFoco).estado, 'PENDIENTE');
  await escribirBasesDelEjemplo(ej);
  const sinBases = { puedeLeer: (id) => !esBase(eje, eje.obtener(id)) };
  for (const f of ['CAJA("terminales")', 'FRESCURA()']) {
    const r = q(ej, f, ej.guisos.id, sinBases);
    assert.deepEqual([r.estado, r.motivo], ['PENDIENTE DE AUTORIZACIÓN', 'leer la base del 8 de ' + ej.menu.id.slice(0, 8) + ' exige una autorización que no hay'], f);
  }
  assert.equal(q(ej, 'CAJA("terminales")', ej.guisos.id, sinFoco).estado, 'PENDIENTE DE AUTORIZACIÓN');
  assert.equal(q(ej, 'FRESCURA()', ej.guisos.id, sinFoco).texto, '0'); // FRESCURA no lee el anfitrión
  // Con gancho, las fórmulas del anfitrión no se cuentan: la medida las evaluaría sin él.
  const todo = { puedeLeer: () => true };
  assert.equal(q(ej, 'CAJA("terminales")', ej.guisos.id, todo).texto, '5');
  for (const m of ['formulasResueltas', 'formulasPendientes']) {
    const r = q(ej, 'CAJA("' + m + '")', ej.guisos.id, todo);
    assert.deepEqual([r.estado, r.motivo], ['PENDIENTE DE AUTORIZACIÓN', 'contar las fórmulas de ' + ej.guisos.id.slice(0, 8) + ' las evalúa sin el gancho de autorización: con gancho no se cuentan'], m);
    assert.equal(q(ej, 'CAJA("' + m + '")').estado, 'RESUELTO', m);
  }
  // BASES hereda el gancho de CAJA y FRESCURA (VG, 7-11 noche): la base, el anfitrión y sus fórmulas.
  for (const f of ['BASES("hermanos")', 'BASES("hermanos", "terminales", "suma")', 'BASES("hermanos", "terminales")']) {
    const r = q(ej, f, ej.guisos.id, sinBases);
    assert.deepEqual([r.estado, r.motivo], ['PENDIENTE DE AUTORIZACIÓN', 'leer la base del 8 de ' + ej.menu.id.slice(0, 8) + ' exige una autorización que no hay'], f);
  }
  assert.equal(q(ej, 'BASES("hermanos", "terminales")', ej.guisos.id, sinFoco).estado, 'PENDIENTE DE AUTORIZACIÓN');
  assert.equal(q(ej, 'BASES("hermanos", "terminales", "suma")', ej.guisos.id, sinFoco).estado, 'RESUELTO'); // un dato de la base no lee el anfitrión
  assert.equal(q(ej, 'BASES("hermanos", "formulasPendientes")', ej.guisos.id, todo).estado, 'PENDIENTE DE AUTORIZACIÓN');
  assert.equal(q(ej, 'BASES("hermanos", "formulasPendientes")').estado, 'RESUELTO');
});

test('sin cohorte o sin anfitrión: PENDIENTE', async () => {
  const ej = await nuevo();
  await escribirBasesDelEjemplo(ej);
  const genesis = ej.eje.genesisId;
  for (const f of ['CAJA("terminales")', 'FRESCURA("hermanos")']) {
    assert.deepEqual([q(ej, f, genesis).estado, q(ej, f, genesis).motivo], ['PENDIENTE', 'sin cohorte: el génesis no tiene padre'], f);
  }
  // El génesis sí está en su propio subárbol (proyecto y general).
  assert.equal(q(ej, 'FRESCURA("general")', genesis).texto, '0');
  assert.equal(q(ej, 'CAJA("terminales", "general")', genesis).estado, 'RESUELTO');
  // Un anfitrión que no está en el eje puede llegar.
  assert.equal(consultar(ej.eje, 'f'.repeat(64), [], 'FRESCURA()').motivo, 'evento ausente del eje: ffffffff');
});
