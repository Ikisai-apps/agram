// BASES, CAJA y FRESCURA en BQL: leen, sin efectos, la base vigente del 8 de
// la cohorte del foco (el registro de la fórmula). Ejemplo: las compras
// hermanas de ejemplos/ikisai/compras-hermanas.mjs, con una base escrita.

// tiempo.js va primero a propósito: tiempo → motor → bql → bases → tiempo es
// un ciclo de importación, y cargar por aquí no debe romper (ETIQUETAS).
import { HITOS } from '../src/tiempo.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generarClaves } from '../src/autoridad.js';
import { consultar, evaluar, formato, esPendiente } from '../src/bql.js';
import { CIELO, COHORTES, MEDIDAS, ETIQUETAS, caja, cortesDe, medir, escribirBase, leerBase, situar, payloadDeBase, baseDe } from '../src/bases.js';
import * as agram from '../src/index.js';
import { ejemploComprasHermanas, escribirBasesDelEjemplo } from '../ejemplos/ikisai/compras-hermanas.mjs';

const T_BASE = '2026-11-07T18:00:00Z';
const casa = await generarClaves();
const hora = (de) => ({ token: 'T', escala: 'hora', cantidad: 1, de, a: null });
const RAIZ = '0000000000';

/** Las compras hermanas y, si se pide, la base de hermanos escrita en el 8 del menú del día. */
async function compras({ base = true } = {}) {
  const ej = await ejemploComprasHermanas({ claves: { casa } });
  const ev = base ? await escribirBase(ej.eje, { autor: 'casa', padre: ej.menu.id, privada: casa.privada, t: T_BASE }) : null;
  return { ...ej, base: ev };
}

/** Consulta una fórmula como si estuviera en la raíz del registro `id` (el foco). */
const q = (ej, formula, id = ej.guisos.id, opciones) => consultar(ej.eje, id, [], formula, opciones);

/** Mediana exacta de una lista de números. */
function medianaExacta(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length / 2;
  return s.length % 2 ? s[Math.floor(m)] : (s[m - 1] + s[m]) / 2;
}

test('el ciclo de importación no rompe la carga: ETIQUETAS sigue siendo HITOS', () => {
  assert.equal(ETIQUETAS, HITOS);
  assert.equal(agram.bases.ETIQUETAS, HITOS);
  assert.equal(typeof agram.bql.consultar, 'function');
});

test('sin base escrita: PENDIENTE, y el motivo dice cómo escribirla', async () => {
  const ej = await compras({ base: false });
  const menu8 = ej.menu.id.slice(0, 8);
  for (const f of ['BASES()', 'CAJA("posiciones")', 'FRESCURA()', 'BASES("hermanos")']) {
    const r = q(ej, f);
    assert.equal(r.estado, 'PENDIENTE', f);
    assert.match(r.motivo, new RegExp('sin base en el 8 de ' + menu8 + ' a profundidad 1 \\(cohorte hermanos\\)'));
    assert.match(r.motivo, /escribirBase\(eje, \{ autor, padre, privada \}\) con padre = /);
    assert.match(r.motivo, /identidad con clave/);
    assert.match(r.motivo, /1 minuto de T/);
    // Lo que hay que vigilar: el 8 del menú, donde llegará la base.
    assert.ok(r.dependencias.includes(ej.menu.id + ':' + CIELO), f);
  }
  // En las cohortes fundidas, primero las bases de abajo y luego desde: 'bases'.
  const proyecto = q(ej, 'BASES("proyecto")');
  assert.equal(proyecto.estado, 'PENDIENTE');
  assert.match(proyecto.motivo, new RegExp('8 de ' + ej.alta.id.slice(0, 8) + ' a profundidad 2'));
  assert.match(proyecto.motivo, /primero la base de profundidad 1 en el 8 de cada hijo/);
  assert.match(proyecto.motivo, /desde: 'bases', profundidad: 2/);
  assert.match(q(ej, 'CAJA("posiciones", "general")').motivo, /desde: 'bases', profundidad: 3/);
  // Lo escrito en el 8 que no es una base válida (sin clave ni firma) no cuenta.
  await ej.eje.escribir({ autor: 'huesped', sobre: ej.menu.id, en: CIELO, t: T_BASE, movimientos: [hora('huesped')], payload: payloadDeBase(baseDe(ej.eje, ej.menu.id)), contexto: { bases: true, n: 4, hasta: ej.cafe.id } });
  assert.equal(q(ej, 'BASES()').estado, 'PENDIENTE');
});

test('BASES(): un valor de tipo bases con la caja del foco, mínimo, mediana aproximada, máximo, n y frescura', async () => {
  const ej = await compras();
  const r = q(ej, 'BASES()');
  assert.equal(r.estado, 'RESUELTO');
  const v = r.valor;
  assert.equal(v.tipo, 'bases');
  assert.equal(v.cohorte, 'hermanos');
  assert.deepEqual([v.foco, v.registro, v.profundidad, v.base, v.autor, v.t, v.desde, v.n, v.incluido], [ej.guisos.id, ej.menu.id, 1, ej.base.id, 'casa', T_BASE, 'hijos', 4, true]);
  assert.deepEqual(v.frescura, { t: T_BASE, hijosNuevos: 0, basesNuevas: 0, alDia: true, nuevos: 0 });
  // Todas las medidas fijas y las series que mueven la base o el foco.
  assert.deepEqual(Object.keys(v.medidas), [...MEDIDAS, 'movimientos.E:casa/EUR', 'movimientos.T:hora']);
  // Lo mismo que situar, y el histograma tal como está escrito en el 8.
  const s = situar(ej.eje, ej.guisos.id);
  const leida = leerBase(ej.eje, ej.menu.id);
  for (const [m, x] of Object.entries(v.medidas)) {
    const b = leida.medidas[m];
    assert.deepEqual([x.valor, x.caja, x.debajo, x.enCaja, x.encima, x.media], [s.medidas[m].valor, s.medidas[m].caja, s.medidas[m].debajo, s.medidas[m].enCaja, s.medidas[m].encima, s.medidas[m].media], m);
    assert.equal(x.etiqueta, HITOS[x.caja]); // etiqueta de la caja, no un grado
    assert.deepEqual([x.cajas, x.minimo, x.maximo], [b.cajas, b.minimo, b.maximo], m);
    assert.equal(x.debajo + x.enCaja + x.encima, v.n);
    assert.ok(x.minimo <= x.mediana && x.mediana <= x.maximo, m);
    assert.equal(x.cajaMediana, caja(m, x.mediana), m);
  }
  // Los guisos: nueve posiciones en la caja 5; por debajo, el café.
  const p = v.medidas.posiciones;
  assert.deepEqual([p.valor, p.caja, p.debajo, p.enCaja, p.encima, p.minimo, p.maximo], [9, 5, 1, 3, 0, 1, 9]);
  assert.deepEqual(p.cajas, [0, 1, 0, 0, 0, 3, 0, 0, 0, 0]);
  // Mediana aproximada desde las cajas: el café (1) y tres en la caja 5 (6 a 9), repartidos 6, 7.5, 9.
  assert.equal(p.mediana, 6.75);
  assert.equal(p.cajaMediana, 5);
  // Exacta donde cada caja ocupada tiene un solo valor posible (cortes lineales por debajo de 9, recuentos por debajo de 4).
  const valores = (m) => leida.refs.map((id) => medir(ej.eje, id)[m] ?? 0);
  let exactas = 0;
  for (const [m, x] of Object.entries(v.medidas)) {
    const lineal = cortesDe(m)[4] === 5; // 1…9; si no, recuentos 1 2 3 4 6 10…
    if (x.maximo < (lineal ? 9 : 4)) {
      assert.equal(x.mediana, medianaExacta(valores(m)), m);
      exactas++;
    }
  }
  assert.equal(exactas, 17); // todas menos posiciones
  assert.equal(v.medidas['formulas.pendientes'].encima, 0); // solo los guisos tienen una pendiente
  // Sin efectos: nada escrito, nada movido.
  const antes = [ej.eje.orden.length, ej.eje.saldoT('casa', 'minuto')];
  for (const f of ['BASES()', 'CAJA("posiciones", "general")', 'FRESCURA("proyecto")']) q(ej, f);
  assert.deepEqual([ej.eje.orden.length, ej.eje.saldoT('casa', 'minuto')], antes);
});

test('formato: una línea legible; las medidas a cero se cuentan', async () => {
  const ej = await compras();
  const r = q(ej, 'BASES()');
  assert.equal(r.texto, formato(r.valor));
  assert.ok(r.texto.startsWith('hermanos · n 4 · base ' + ej.base.id.slice(0, 8) + ' del 2026-11-07 · al día — '), r.texto);
  assert.match(r.texto, /posiciones 9: caja 5 \(mín 1, mediana ≈ 6\.75, máx 9\)/);
  assert.match(r.texto, /formulas\.pendientes 1: caja 1 \(mín 0, mediana ≈ 0, máx 1\)/);
  assert.match(r.texto, /; 5 medidas a cero$/); // posiciones.5 … posiciones.9
  assert.doesNotMatch(r.texto, /posiciones\.7/);
  await ej.eje.escribir({ autor: 'vecina', sobre: ej.menu.id, t: '2026-11-07T18:30:00Z', movimientos: [hora('vecina')], payload: 'Un té' });
  assert.match(q(ej, 'BASES()').texto, / · no al día: 1 registro nuevo — /);
});

test('dependencias: el 8 leído, el foco medido y la base', async () => {
  const ej = await compras();
  const r = q(ej, 'BASES()');
  for (const d of [ej.menu.id + ':' + CIELO, ej.guisos.id + ':' + RAIZ, ej.base.id + ':' + RAIZ]) assert.ok(r.dependencias.includes(d), d);
  // FRESCURA no mide el foco: no lo anota.
  const f = q(ej, 'FRESCURA()');
  assert.ok(f.dependencias.includes(ej.base.id + ':' + RAIZ));
  assert.ok(!f.dependencias.includes(ej.guisos.id + ':' + RAIZ));
});

test('CAJA(medida, cohorte?): la caja 0–9 del foco, igual que situar', async () => {
  const ej = await compras({ base: false });
  await escribirBasesDelEjemplo(ej, casa.privada); // las tres cohortes
  for (const cohorte of COHORTES) {
    const s = situar(ej.eje, ej.guisos.id, { cohorte });
    for (const m of [...MEDIDAS, 'movimientos.T:hora', 'movimientos.E:casa/EUR']) {
      const r = q(ej, 'CAJA("' + m + '", "' + cohorte + '")');
      assert.equal(r.estado, 'RESUELTO', cohorte + ' ' + m);
      assert.deepEqual(r.valor, { tipo: 'numero', valor: s.medidas[m].caja });
    }
  }
  assert.equal(q(ej, 'CAJA("posiciones")').texto, '5');
  assert.equal(q(ej, 'CAJA("formulas.pendientes")').texto, '1');
  assert.equal(q(ej, 'CAJA("posiciones", "PROYECTO")').texto, '5'); // la cohorte no distingue mayúsculas
  assert.equal(q(ej, 'CAJA("posiciones") = 5').texto, 'verdadero'); // un número BQL más
  assert.equal(q(ej, 'CAJA("posiciones") + CAJA("escritos")').texto, '5');
  assert.equal(q(ej, 'CAJA("movimientos.R:nadie")').texto, '0'); // serie que nadie mueve: cero
  assert.equal(q(ej, 'CAJA("posiciones")', ej.manzanas.id).texto, '4'); // otro foco, otro 8 (el del puesto)
  // Cohortes que crecen alrededor del mismo foco (como en la nota de las bases).
  const n = Object.fromEntries(COHORTES.map((c) => [c, q(ej, 'BASES("' + c + '")').valor]));
  assert.deepEqual(COHORTES.map((c) => [n[c].n, n[c].profundidad, n[c].registro, n[c].desde]), [[4, 1, ej.menu.id, 'hijos'], [6, 2, ej.alta.id, 'bases'], [8, 3, ej.eje.genesisId, 'bases']]);
  assert.deepEqual(COHORTES.map((c) => n[c].medidas.posiciones.debajo), [1, 2, 4]);
  assert.equal(n.proyecto.incluido, null); // una base fundida no lista a los nietos
});

test('FRESCURA(cohorte?): registros nuevos desde la base; en las fundidas, hijos nuevos y bases renovadas', async () => {
  const ej = await compras({ base: false });
  await escribirBasesDelEjemplo(ej, casa.privada);
  const fr = (c = 'hermanos', id = ej.guisos.id) => q(ej, 'FRESCURA("' + c + '")', id).valor.valor;
  assert.deepEqual(COHORTES.map((c) => fr(c)), [0, 0, 0]);
  // Llega una compra hermana: la base del menú envejece; las de arriba no lo ven aún.
  const te = await ej.eje.escribir({ autor: 'vecina', sobre: ej.menu.id, t: '2026-11-07T18:30:00Z', movimientos: [hora('vecina')], payload: 'Un té' });
  assert.deepEqual(COHORTES.map((c) => fr(c)), [1, 0, 0]);
  assert.equal(q(ej, 'FRESCURA()').texto, '1');
  assert.equal(q(ej, 'BASES()', te.id).valor.incluido, false); // el té no está en la base
  // Corregir la base del menú: al día; la del proyecto ya no (una base renovada debajo).
  await escribirBase(ej.eje, { autor: 'casa', padre: ej.menu.id, privada: casa.privada, t: '2026-11-07T19:00:00Z' });
  assert.deepEqual(COHORTES.map((c) => fr(c)), [0, 1, 0]);
  assert.match(q(ej, 'BASES("proyecto")').texto, /no al día: 0 hijos nuevos y 1 base renovada/);
  assert.deepEqual(q(ej, 'BASES("proyecto")').valor.frescura, { t: T_BASE, hijosNuevos: 0, basesNuevas: 1, alDia: false, nuevos: 1 });
});

test('sin cohorte: PENDIENTE con el motivo de situar', async () => {
  const ej = await compras();
  const genesis = q(ej, 'BASES()', ej.eje.genesisId);
  assert.equal(genesis.estado, 'PENDIENTE');
  assert.equal(genesis.motivo, 'sin cohorte: el foco no tiene padre (cohorte hermanos)');
  assert.equal(q(ej, 'FRESCURA("proyecto")', ej.alta.id).motivo, 'sin cohorte: el foco es el propio registro (cohorte proyecto)');
  assert.equal(q(ej, 'CAJA("posiciones", "general")', ej.eje.genesisId).motivo, 'sin cohorte: el foco es el propio registro (cohorte general)');
  // Un foco que no está en el eje puede llegar: PENDIENTE, como en el resto de BQL.
  assert.equal(consultar(ej.eje, 'f'.repeat(64), [], 'BASES()').motivo, 'evento ausente del eje: ffffffff');
});

test('PENDIENTE POR LÍMITE: la cohorte cuesta más que el presupuesto que queda', async () => {
  const ej = await compras({ base: false });
  await escribirBasesDelEjemplo(ej, casa.privada);
  const { eje } = ej;
  const sobre = (id) => eje.sobre(id).length;
  // Hermanos: la base y los hijos del menú (cuatro compras y la base).
  const costeHermanos = 1 + sobre(ej.menu.id);
  assert.equal(costeHermanos, 6);
  // General: la base, los hijos del génesis y los hijos de cada uno (en ellos se busca su 8).
  const costeGeneral = 1 + sobre(eje.genesisId) + eje.sobre(eje.genesisId).reduce((s, h) => s + sobre(h.id), 0);
  // La llamada gasta un paso, y cada argumento otro, antes de leer.
  const conPresupuesto = (f, presupuesto) => q(ej, f, ej.guisos.id, { limites: { presupuesto } });
  const corto = conPresupuesto('BASES()', costeHermanos);
  assert.equal(corto.estado, 'PENDIENTE POR LÍMITE');
  assert.ok(esPendiente(corto.estado));
  assert.equal(corto.motivo, 'la cohorte hermanos (8 de ' + ej.menu.id.slice(0, 8) + ') exige examinar 6 registros y quedan 5 pasos de presupuesto');
  assert.deepEqual(corto.parcial, { examinados: 0, de: 6 });
  assert.equal(conPresupuesto('BASES()', costeHermanos + 1).estado, 'RESUELTO');
  // Las fundidas examinan más: con presupuesto para los hermanos no llega para la general.
  assert.equal(conPresupuesto('CAJA("posiciones", "general")', costeHermanos + 2).estado, 'PENDIENTE POR LÍMITE');
  assert.equal(conPresupuesto('CAJA("posiciones", "general")', costeGeneral + 3).estado, 'RESUELTO');
  assert.equal(conPresupuesto('CAJA("posiciones", "general")', costeGeneral + 2).estado, 'PENDIENTE POR LÍMITE');
  // Se deja de contar en cuanto no cabe: «al menos», y `de` es una cota inferior.
  const pronto = conPresupuesto('CAJA("posiciones", "general")', 4);
  assert.equal(pronto.motivo, 'la cohorte general (8 de ' + eje.genesisId.slice(0, 8) + ') exige examinar al menos ' + (1 + sobre(eje.genesisId)) + ' registros y quedan 1 pasos de presupuesto');
  assert.deepEqual(pronto.parcial, { examinados: 0, de: 1 + sobre(eje.genesisId) });
  // El presupuesto es de toda la fórmula: dos lecturas se suman.
  assert.equal(conPresupuesto('FRESCURA() + FRESCURA()', costeHermanos + 4).estado, 'PENDIENTE POR LÍMITE');
  assert.equal(conPresupuesto('FRESCURA() + FRESCURA()', 2 * costeHermanos + 4).estado, 'RESUELTO');
  // La n de la base no se cobra: leerla no relee lo medido.
  assert.equal(q(ej, 'BASES("general")').valor.n, 8);
});

test('una fórmula de bases dentro del propio foco no se mide a sí misma (ni se cuelga)', async () => {
  const ej = await compras();
  const { eje } = ej;
  const x = await eje.escribir({
    autor: 'vecina',
    sobre: ej.menu.id,
    t: '2026-11-07T18:30:00Z',
    movimientos: [hora('vecina')],
    payload: ['Compra con su caja', '=CAJA("posiciones")', '=FRESCURA()', '=CAJA("formulas.resueltas")'],
  });
  assert.equal(evaluar(eje, x.id, [1]).texto, '4'); // cuatro posiciones: caja 4
  assert.equal(evaluar(eje, x.id, [2]).texto, '1'); // la propia x es nueva
  assert.equal(evaluar(eje, x.id, [3]).estado, 'RESUELTO');
  // Vista desde fuera, las tres fórmulas se resuelven.
  assert.deepEqual([medir(eje, x.id)['formulas.resueltas'], medir(eje, x.id)['formulas.pendientes']], [3, 0]);
  // Vista desde dentro, las dos que miden el foco son un ciclo y cuentan como pendientes; FRESCURA no mide el foco.
  const dentro = q(ej, 'BASES()', x.id).valor.medidas;
  assert.deepEqual([dentro['formulas.resueltas'].valor, dentro['formulas.pendientes'].valor], [1, 2]);
  // Escribir la base midiendo hermanos con fórmulas de bases también termina.
  const nueva = await escribirBase(eje, { autor: 'casa', padre: ej.menu.id, privada: casa.privada, t: '2026-11-07T19:00:00Z' });
  assert.equal(nueva.contexto.n, 5);
  assert.equal(leerBase(eje, ej.menu.id).medidas['formulas.resueltas'].maximo, 3);
  assert.equal(evaluar(eje, x.id, [2]).texto, '0');
  // Una referencia que vuelve al mismo foco por otro registro también para.
  const y = await eje.escribir({ autor: 'huesped', sobre: ej.menu.id, t: '2026-11-07T19:10:00Z', movimientos: [hora('huesped')], payload: ['Mira la caja de x', { ref: x.id, dir: '1000000000' }, '=LOCAL(1) + CAJA("posiciones")'] });
  assert.equal(evaluar(eje, y.id, [2]).estado, 'RESUELTO');
});

test('argumentos: cohorte y medida se validan antes de leer; bases no opera con otros tipos', async () => {
  const ej = await compras();
  const err = (f) => {
    const r = q(ej, f);
    assert.equal(r.estado, 'ERROR', f);
    return r.motivo;
  };
  assert.equal(err('BASES("vecinos")'), 'BASES espera una cohorte: "hermanos", "proyecto", "general" (no "vecinos")');
  assert.equal(err('FRESCURA(1)'), 'FRESCURA espera una cohorte: "hermanos", "proyecto", "general", no numero');
  assert.equal(err('BASES("hermanos", "proyecto")'), 'BASES espera, si acaso, una cohorte');
  assert.equal(err('FRESCURA("hermanos", 2)'), 'FRESCURA espera, si acaso, una cohorte');
  assert.equal(err('CAJA()'), 'CAJA espera una medida y, si acaso, una cohorte');
  assert.equal(err('CAJA(3)'), 'CAJA espera el nombre de una medida entre comillas, no numero');
  assert.match(err('CAJA("inventada")'), /^medida desconocida: inventada \(posiciones, posiciones\.0 … posiciones\.9/);
  assert.match(err('CAJA("movimientos.")'), /^medida desconocida/);
  assert.match(err('CAJA("posiciones", "linaje")'), /^CAJA espera una cohorte/);
  // Sin base, la medida mal escrita sigue siendo ERROR (se valida antes de leer).
  const sin = await compras({ base: false });
  assert.equal(q(sin, 'CAJA("inventada")').estado, 'ERROR');
  // El valor bases no se suma ni se compara.
  assert.equal(q(ej, 'BASES() + 1').texto, 'INCOMPATIBLE: bases y numero no se suman');
  assert.equal(q(ej, 'BASES() = BASES()').texto, 'INCOMPATIBLE: bases y bases no se comparan');
});

test('autorización: el 8, la base y el foco pasan por el gancho', async () => {
  const ej = await compras();
  const sin = (prohibido) => ({ puedeLeer: (id, dir) => !prohibido(id, dir) });
  const noOcho = sin((id, dir) => id === ej.menu.id && dir === CIELO);
  const noBase = sin((id) => id === ej.base.id);
  const noFoco = sin((id, dir) => id === ej.guisos.id && dir === RAIZ);
  for (const [opciones, f] of [[noOcho, 'BASES()'], [noOcho, 'FRESCURA()'], [noBase, 'CAJA("posiciones")'], [noBase, 'FRESCURA()'], [noFoco, 'BASES()']]) {
    assert.equal(q(ej, f, ej.guisos.id, opciones).estado, 'PENDIENTE DE AUTORIZACIÓN', f);
  }
  // FRESCURA no mide el foco: no necesita leerlo.
  assert.equal(q(ej, 'FRESCURA()', ej.guisos.id, noFoco).texto, '0');
});
