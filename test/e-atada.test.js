// La E atada al recurso, con tope compartido (VG, 7-11 noche: «Me parece bien
// todo»; R2 de docs/notas/NEUTRALIDAD_IDENTIDAD.md). Una prueba positiva y
// otra negativa por regla:
//   1. la serie lleva el registro del recurso, que existe en el eje;
//   2. el E vivo de un registro y sus descendientes no pasa de la capacidad
//      de cada ancestro que la declara (todas las denominaciones, todos los
//      emisores); sin capacidad no hay tope (deuda del emisor);
//   3. cada emisor emite en proporción al P bloqueado (P:X, o P:genesis donde
//      X no tiene P propio), y ese bloqueo no se libera mientras viva la E;
//   4. el redondeo: emisión conjunta y fracciones solo en series divisibles.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Eje, reglasDelTope, SIN_CAPACIDAD } from '../src/eje.js';
import { crearEvento } from '../src/evento.js';
import { claveToken, franjaDe, familiaDe } from '../src/tokens.js';
import { serializar, restaurar } from '../src/persistencia.js';

const T0 = '2026-11-08T10:00:00Z';
// Las altas, un mes antes de T0: cada persona escribe con su propio T, que acuña al gastarlo dentro del tope
// de su reloj (VG, 7-11 noche; Core, 8-11), y a T0 el reloj le da de sobra.
const ALTA = '2026-10-08T10:00:00Z';
const minuto = (de, cantidad = 1) => ({ token: 'T', escala: 'minuto', cantidad, de, a: null });
/** R propia en juego (VG, 7-11 noche: la exigen P y E). */
const enJuego = (persona, a = 'g') => ({ token: 'R', emisor: persona, cantidad: 1, de: persona, a });
let cuenta = 0;
const unico = (texto) => texto + ' #' + (++cuenta);

/**
 * Mundo: génesis «g» (persona, P:genesis 10); altas de personas; cada una
 * emite su R; «casa» escribe el registro A, que declara capacidad
 * `capacidad` en su posición 2, y acuña `pA` de P:A (T + R + P).
 */
async function mundo({ capacidad = 4, pA = 4, personas = ['casa', 'socia', 'bea'] } = {}) {
  const eje = await Eje.genesis({
    demostracion: true, identidad: 'g', tipo: 'persona', t: ALTA, foco: ['raíz'],
    emision: [{ token: 'T', escala: 'minuto', cantidad: 1e6 }, { token: 'P', ambito: 'genesis', cantidad: 10 }, { token: 'R', cantidad: 100 }, { token: 'E', denominacion: 'minuto', cantidad: 1e9 }],
  });
  // T no cruza de persona (VG, 7-11 noche): las altas reciben minutos de g como E de su serie de tiempo (E:g/minuto),
  // y cada persona escribe con su propio T, que se acuña al gastarse.
  await eje.escribir({
    autor: 'g', sobre: eje.genesisId, t: ALTA, payload: 'altas',
    movimientos: [minuto('g'), ...personas.map((p) => ({ token: 'E', emisor: 'g', denominacion: 'minuto', cantidad: 5000, de: 'g', a: p }))],
    contexto: { tipos: Object.fromEntries(personas.map((p) => [p, 'persona'])) },
  });
  for (const p of personas) {
    await eje.escribir({ autor: p, sobre: eje.genesisId, t: T0, payload: 'R de ' + p, movimientos: [minuto(p), { token: 'R', emisor: p, cantidad: 100, de: null, a: p }] });
  }
  const A = await eje.escribir({ autor: 'casa', sobre: eje.genesisId, t: T0, movimientos: [minuto('casa')], payload: ['Alojamiento', ['plazas'], capacidad] });
  if (pA > 0) {
    await eje.escribir({ autor: 'casa', sobre: A.id, t: T0, payload: 'P sobre el alojamiento',
      movimientos: [minuto('casa'), enJuego('casa'), { token: 'P', ambito: A.id, cantidad: pA, de: null, a: 'casa' }] });
  }
  return { eje, A: A.id };
}

/** La casa reparte P:A (delegar estrecha y reparte; no copia). */
async function delega(eje, A, a, cantidad, de = 'casa') {
  return eje.escribir({ autor: de, sobre: A, t: T0, payload: unico('delega'), movimientos: [minuto(de), { token: 'P', ambito: A, cantidad, de, a }] });
}

const serieE = (emisor, denominacion, registro) => claveToken({ token: 'E', emisor, denominacion, registro });

/**
 * Un evento que emite E atada a `registro`: T, R en juego y, si `bloquea`,
 * un bloqueo de P (`ambito`, A por defecto) con la salida = la clave de la serie.
 */
function emision(autor, { A, registro = A, sobre = registro, denominacion, cantidad, bloquea = 0, ambito = A, extra = {}, t = T0, otros = [] }) {
  const clave = serieE(extra.emisor ?? autor, denominacion, registro);
  const movimientos = [minuto(autor), enJuego(autor)];
  movimientos.push(...otros);
  if (bloquea) movimientos.push({ token: 'P', ambito, cantidad: bloquea, de: autor, a: autor, estado: 'bloqueo', salida: clave });
  movimientos.push({ token: 'E', emisor: autor, denominacion, registro, cantidad, de: null, a: autor, ...extra });
  return { autor, sobre, t, payload: unico('emite ' + denominacion), movimientos };
}

// ---------- 1 · el registro ----------

test('R2·1: la serie lleva el registro del recurso, que ha de existir; sin él queda atada al registro del emisor', async () => {
  const { eje, A } = await mundo();
  const otro = 'f'.repeat(64);
  await assert.rejects(eje.escribir(emision('casa', { A, registro: otro, sobre: A, denominacion: 'cama@n1', cantidad: 1, bloquea: 1 })), /registro desconocido de la serie E:casa\/cama@n1@ffffffff/);
  const ev = await eje.escribir(emision('casa', { A, denominacion: 'cama@n1', cantidad: 1, bloquea: 1 }));
  const k = serieE('casa', 'cama@n1', A);
  assert.equal(k, 'E:casa/cama@n1@' + A);
  assert.equal(eje.saldo('casa', k), 1);
  assert.equal(eje.registroDe(k), A);
  // Además de los minutos que g le cedió en su alta (E:g/minuto, sin registro: el de su emisor).
  assert.deepEqual(eje.recursos('casa'), [{ emisor: 'g', denominacion: 'minuto', cantidad: 5000 }, { emisor: 'casa', denominacion: 'cama@n1', registro: A, cantidad: 1 }]);
  const s = eje.series().find((x) => x.clave === k);
  assert.deepEqual([s.registro, s.tope, s.emitido, s.consumido, s.divisible, s.emisores, s.nota], [A, 4, 1, 0, false, ['casa'], undefined]);
  // Sin registro: la serie queda atada al registro del emisor (su alta) y, sin capacidad, no tiene tope.
  await eje.escribir({ autor: 'casa', sobre: A, t: T0, payload: 'vales', movimientos: [minuto('casa'), enJuego('casa'), { token: 'E', emisor: 'casa', denominacion: 'vale', cantidad: 1000, de: null, a: 'casa' }] });
  const vale = eje.series().find((x) => x.clave === 'E:casa/vale');
  assert.deepEqual([vale.registro, vale.tope, vale.nota], [eje.alta('casa').id, null, SIN_CAPACIDAD]);
  assert.ok(ev.id);
});

// ---------- 2 · el tope compartido ----------

test('R2·2: el E vivo de un registro no pasa de su capacidad, sumando denominaciones y emisores', async () => {
  const { eje, A } = await mundo({ capacidad: 4, pA: 4 });
  await delega(eje, A, 'socia', 2);
  await eje.escribir(emision('casa', { A, denominacion: 'cama@n1', cantidad: 2, bloquea: 2 }));
  await eje.escribir(emision('socia', { A, denominacion: 'litera@n1', cantidad: 2, bloquea: 2 }));
  assert.deepEqual(eje.topes(A, T0), [{ registro: A, capacidad: 4, franja: 'n1', vivo: 4, libre: 0 }]);
  // Otra denominación, otro emisor: el tope es del registro en esa franja, no de la serie.
  await assert.rejects(eje.escribir(emision('casa', { A, denominacion: 'sofa@n1', cantidad: 1, bloquea: 0 })), /tope de E del registro .* en la franja «n1».*llegaría a 5 y su capacidad es 4/);
  // Con capacidad libre, sí: consumir baja el E vivo.
  await eje.escribir({ autor: 'casa', sobre: A, t: T0, payload: 'noche consumida', movimientos: [minuto('casa'), { token: 'E', emisor: 'casa', denominacion: 'cama@n1', registro: A, cantidad: 1, de: 'casa', a: null }] });
  assert.equal(eje.vivo(serieE('casa', 'cama@n1', A), T0), 1);
  assert.equal(eje.topes(A, T0)[0].vivo, 3);
});

test('R2·2: el tope es por franja (lo que va tras la última «@»): cada noche tiene su capacidad; un bloqueo de familia respalda todas', async () => {
  const { eje, A } = await mundo({ capacidad: 4, pA: 4 });
  const familia = familiaDe(serieE('casa', 'cama@n1', A));
  assert.equal(familia, 'E:casa/cama@*@' + A);
  assert.deepEqual([franjaDe('cama@n1'), franjaDe('a@b@2026-11-13'), franjaDe('EUR')], ['n1', '2026-11-13', '']);
  // g le da a la casa 1 de P sobre todo el eje: le deja P disponible que cubre A para seguir emitiendo (escalonado). Antes
  // se lo delegaba estrechado a A; con R3 (VG, 7-11 noche) P:A es una serie cerrada y estrechar hacia ella no vale.
  await assert.rejects(delega(eje, A, 'casa', 1, 'g'), /P:[0-9a-f]{8} es una serie cerrada: se delega el P:[0-9a-f]{8} que se tiene \(0\)/);
  await eje.escribir({ autor: 'g', sobre: A, t: T0, payload: unico('delega'), movimientos: [minuto('g'), { token: 'P', ambito: 'genesis', cantidad: 1, de: 'g', a: 'casa' }] });
  // La casa bloquea sus 4 de P:A una vez, para la familia «cama», y con ellos respalda 4 camas cada noche.
  const bloqueoFamilia = { token: 'P', ambito: A, cantidad: 4, de: 'casa', a: 'casa', estado: 'bloqueo', salida: familia };
  await eje.escribir(emision('casa', { A, denominacion: 'cama@n1', cantidad: 4, otros: [bloqueoFamilia] }));
  for (const n of ['n2', 'n3']) await eje.escribir(emision('casa', { A, denominacion: 'cama@' + n, cantidad: 4 }));
  assert.deepEqual(eje.topes(A, T0).map((x) => [x.franja, x.vivo, x.libre]), [['n1', 4, 0], ['n2', 4, 0], ['n3', 4, 0]]);
  // Una quinta plaza en n2 no cabe, sea cama o sofá; en n4, sí: otra franja, la misma capacidad.
  await assert.rejects(eje.escribir(emision('casa', { A, denominacion: 'cama@n2', cantidad: 1 })), /en la franja «n2».*llegaría a 5 y su capacidad es 4/);
  await assert.rejects(eje.escribir(emision('casa', { A, denominacion: 'sofa@n2', cantidad: 1, bloquea: 1 })), /en la franja «n2».*llegaría a 5 y su capacidad es 4/);
  await eje.escribir(emision('casa', { A, denominacion: 'cama@n4', cantidad: 4 }));
  // La cuota sigue siendo por serie: el bloqueo de familia da 4 por noche, no 5.
  await assert.rejects(eje.escribir(emision('casa', { A, denominacion: 'cama@n5', cantidad: 5 })), /cuota de E:casa\/cama@n5@.*da 4 de 4/);
  // Las denominaciones sin «@» son una sola franja, la de siempre ('').
  assert.deepEqual(eje.topes(A, T0, '').map((x) => [x.franja, x.vivo]), [['', 0]]);
  // El bloqueo de familia no se suelta mientras viva alguna noche de la cama.
  await assert.rejects(eje.escribir({ autor: 'casa', sobre: A, t: T0, payload: 'suelta', movimientos: [minuto('casa'), { ...bloqueoFamilia, estado: 'liberacion' }] }), /respalda 16 de E vivo: no se libera mientras viva/);
  assert.equal(eje.vivo(familia, T0), 16);
  // «@*» es la franja reservada a la familia: ninguna denominación la lleva.
  await assert.rejects(eje.escribir(emision('casa', { A, denominacion: 'cama@*', cantidad: 1 })), /franja reservada/);
});

test('R2·2: sin capacidad declarada no hay tope ni hace falta P bloqueado (deuda del emisor)', async () => {
  const { eje } = await mundo();
  const libre = await eje.escribir({ autor: 'casa', sobre: eje.genesisId, t: T0, movimientos: [minuto('casa')], payload: ['Tienda', ['sin capacidad']] });
  await eje.escribir({ autor: 'casa', sobre: libre.id, t: T0, payload: 'P de la tienda', movimientos: [minuto('casa'), enJuego('casa'), { token: 'P', ambito: libre.id, cantidad: 1, de: null, a: 'casa' }] });
  await eje.escribir(emision('casa', { A: libre.id, denominacion: 'EUR', cantidad: 1e6, bloquea: 0 }));
  const s = eje.series().find((x) => x.clave === serieE('casa', 'EUR', libre.id));
  assert.deepEqual([s.tope, s.nota, s.emitido], [null, SIN_CAPACIDAD, 1e6]);
  assert.deepEqual(eje.topes(libre.id, T0), []);
});

test('R2·2: caducar baja el E vivo; la capacidad se vuelve a usar', async () => {
  const { eje, A } = await mundo({ capacidad: 2, pA: 2 });
  const n1 = serieE('casa', 'cama@n1', A);
  await eje.escribir(emision('casa', { A, denominacion: 'cama@n1', cantidad: 2, bloquea: 2, extra: { caduca: '2026-11-09T12:00:00Z' } }));
  await assert.rejects(eje.escribir(emision('casa', { A, denominacion: 'sofa@n1', cantidad: 1 })), /tope de E del registro .* en la franja «n1»/);
  const despues = '2026-11-09T12:00:00Z';
  assert.equal(eje.vivo(n1, despues), 0);
  assert.equal(eje.vivo(n1, T0), 2);
  // Caducada la noche, su P se libera y respalda otra serie de la misma franja, en el mismo evento.
  const suelta = { token: 'P', ambito: A, cantidad: 2, de: 'casa', a: 'casa', estado: 'liberacion', salida: n1 };
  await assert.rejects(eje.escribir(emision('casa', { A, denominacion: 'sofa@n1', cantidad: 2, bloquea: 2, otros: [suelta] })), /respalda 2 de E vivo/); // antes de caducar, no
  // Fechada después de caducar, tampoco mientras el eje no haya llegado ahí (SEG-03): la caducidad se mira con el
  // menor entre su t y el mayor t aceptado antes. Cuando otra identidad escribe con ese t, sí.
  await assert.rejects(eje.escribir(emision('casa', { A, denominacion: 'sofa@n1', cantidad: 2, bloquea: 2, t: despues, otros: [suelta] })), /respalda 2 de E vivo/);
  await eje.escribir({ autor: 'g', sobre: A, t: despues, payload: unico('pasa la noche'), movimientos: [minuto('g')] });
  await eje.escribir(emision('casa', { A, denominacion: 'sofa@n1', cantidad: 2, bloquea: 2, t: despues, otros: [suelta] }));
  assert.deepEqual(eje.topes(A, despues), [{ registro: A, capacidad: 2, franja: 'n1', vivo: 2, libre: 0 }]);
});

test('SEG-03 (revisión de main 7-11 noche) fechar a futuro no vacía la franja ni libera el P: la caducidad se mira con el reloj del eje', async () => {
  const { eje, A } = await mundo({ capacidad: 2, pA: 2 });
  const n1 = serieE('casa', 'cama@n1', A);
  const caduca = '2026-11-09T12:00:00Z';
  await eje.escribir(emision('casa', { A, denominacion: 'cama@n1', cantidad: 2, bloquea: 2, extra: { caduca } }));
  const suelta = { token: 'P', ambito: A, cantidad: 2, de: 'casa', a: 'casa', estado: 'liberacion', salida: n1 };
  // La emisora se fecha el día después de caducar (dentro del año que admite el reloj): ni libera el P que respalda la
  // E viva, ni con él vuelve a llenar la franja.
  await assert.rejects(eje.escribir({ autor: 'casa', sobre: A, t: caduca, payload: unico('suelta'), movimientos: [minuto('casa'), suelta] }), /respalda 2 de E vivo: no se libera mientras viva/);
  await assert.rejects(eje.escribir(emision('casa', { A, denominacion: 'sofa@n1', cantidad: 2, bloquea: 2, t: caduca, otros: [suelta] })),
    /respalda 2 de E vivo.*tope de E del registro [0-9a-f]{8} en la franja «n1».*llegaría a 4 y su capacidad es 2/);
  assert.equal(eje.bloqueado('casa', 'P:' + A, n1), 2);
  // Un registro de otra identidad con t anterior a la caducidad no basta; con t ≥ caduca, el eje llega ahí y sí.
  await eje.escribir({ autor: 'bea', sobre: A, t: '2026-11-09T11:59:00Z', payload: unico('casi'), movimientos: [minuto('bea')] });
  await assert.rejects(eje.escribir({ autor: 'casa', sobre: A, t: caduca, payload: unico('suelta'), movimientos: [minuto('casa'), suelta] }), /respalda 2 de E vivo/);
  await eje.escribir({ autor: 'bea', sobre: A, t: caduca, payload: unico('ya es mañana'), movimientos: [minuto('bea')] });
  await eje.escribir(emision('casa', { A, denominacion: 'sofa@n1', cantidad: 2, bloquea: 2, t: caduca, otros: [suelta] }));
  assert.deepEqual(eje.topes(A, caduca), [{ registro: A, capacidad: 2, franja: 'n1', vivo: 2, libre: 0 }]);
});

test('SEG-05 (revisión de la #73) el reloj lo marcan los demás: los eventos del propio autor fechados a futuro no caducan su E', async () => {
  const { eje, A } = await mundo({ capacidad: 2, pA: 2 });
  const n1 = serieE('casa', 'cama@n1', A);
  const caduca = '2026-11-09T12:00:00Z';
  await eje.escribir(emision('casa', { A, denominacion: 'cama@n1', cantidad: 2, bloquea: 2, extra: { caduca } }));
  const suelta = { token: 'P', ambito: A, cantidad: 2, de: 'casa', a: 'casa', estado: 'liberacion', salida: n1 };
  // La casa escribe antes dos eventos suyos fechados después de caducar (dentro del año que admite el reloj). El mayor
  // t del eje llega ahí, pero lo ha puesto ella: con SEG-03 eso ya bastaba para caducar su E.
  await eje.escribir({ autor: 'casa', sobre: A, t: caduca, payload: unico('mañana'), movimientos: [minuto('casa')] });
  await eje.escribir({ autor: 'casa', sobre: A, t: '2026-11-10T12:00:00Z', payload: unico('pasado mañana'), movimientos: [minuto('casa')] });
  assert.equal(eje.tMaximo(), Date.parse('2026-11-10T12:00:00Z'));
  assert.equal(eje.tMaximo(['casa']), Date.parse(T0)); // el reloj de los demás
  assert.equal(eje.tMaximo(['casa', 'g', 'socia', 'bea']), -Infinity); // sin nadie más, no hay reloj
  // Ni libera el P que respalda la E viva, ni con él vuelve a llenar la franja.
  await assert.rejects(eje.escribir({ autor: 'casa', sobre: A, t: caduca, payload: unico('suelta'), movimientos: [minuto('casa'), suelta] }), /respalda 2 de E vivo: no se libera mientras viva/);
  await assert.rejects(eje.escribir(emision('casa', { A, denominacion: 'sofa@n1', cantidad: 2, bloquea: 2, t: caduca, otros: [suelta] })),
    /respalda 2 de E vivo.*tope de E del registro [0-9a-f]{8} en la franja «n1».*llegaría a 4 y su capacidad es 2/);
  assert.equal(eje.bloqueado('casa', 'P:' + A, n1), 2);
  // Un evento de otra identidad con t ≥ caduca, sí: el eje llega ahí.
  await eje.escribir({ autor: 'bea', sobre: A, t: caduca, payload: unico('ya es mañana'), movimientos: [minuto('bea')] });
  await eje.escribir(emision('casa', { A, denominacion: 'sofa@n1', cantidad: 2, bloquea: 2, t: caduca, otros: [suelta] }));
  assert.deepEqual(eje.topes(A, caduca), [{ registro: A, capacidad: 2, franja: 'n1', vivo: 2, libre: 0 }]);
});

test('SEG-05 (revisión de la #73) el reloj tampoco lo marca el emisor beneficiado: en una emisión conjunta se excluye a los coemisores', () => {
  // Las reglas del tope, con un contexto mínimo: la casa suelta el P de una serie que caduca y emite en conjunto con la
  // socia. El reloj se pide sin el autor ni los emisores; si la socia contara, su evento fechado a futuro caducaría la E.
  const A = 'a'.repeat(64);
  const vieja = serieE('casa', 'cama@n1', A);
  const caduca = '2026-11-09T12:00:00Z';
  const pedidos = [];
  const ctx = (relojDe) => ({
    reglas: 3,
    tMaximo: (excluidos) => { pedidos.push([...excluidos].sort()); return relojDe(excluidos); },
    registro: () => ({ id: A }),
    alta: () => null,
    serie: (k) => (k === vieja ? { emisor: 'casa', emitido: 2, consumido: 0, caduca, registro: A } : null),
    seriesE: () => [],
    topes: () => [],
    dentro: () => false,
    bloqueado: () => 0,
    bloqueadoP: () => 1,
  });
  const ev = {
    autor: 'casa', sobre: A, t: caduca, payload: 'suelta y emite',
    movimientos: [
      { token: 'P', ambito: A, cantidad: 2, de: 'casa', a: 'casa', estado: 'liberacion', salida: vieja },
      { token: 'E', emisor: 'casa', denominacion: 'sofa@n1', registro: A, cantidad: 1, de: null, a: 'casa', emisores: ['casa', 'socia'] },
    ],
  };
  // Solo la socia (coemisora) escribió con t ≥ caduca: no cuenta, la E sigue viva.
  const soloSocia = (excluidos) => (excluidos.includes('socia') ? Date.parse(T0) : Date.parse(caduca));
  assert.match(reglasDelTope(ev, ctx(soloSocia)).map((x) => x.texto).join('; '), /respalda 2 de E vivo: no se libera mientras viva/);
  assert.deepEqual(pedidos.at(-1), ['casa', 'socia']);
  // Si quien llega ahí es otra identidad, caduca.
  assert.deepEqual(reglasDelTope(ev, ctx(() => Date.parse(caduca))), []);
  // Sin reloj de los demás (nadie más ha escrito), nada caduca.
  assert.match(reglasDelTope(ev, ctx(() => -Infinity)).map((x) => x.texto).join('; '), /respalda 2 de E vivo/);
});

test('R2·2: partir el recurso en subregistros no esquiva el tope del ancestro (aunque declaren más capacidad)', async () => {
  const { eje, A } = await mundo({ capacidad: 4, pA: 4 });
  await delega(eje, A, 'socia', 1);
  // La socia escribe dentro del alojamiento un subregistro suyo con capacidad 100 y se acuña todo su P.
  const Y = await eje.escribir({ autor: 'socia', sobre: A, t: T0, movimientos: [minuto('socia')], payload: ['Mi rincón', ['camas'], 100] });
  await eje.escribir({ autor: 'socia', sobre: Y.id, t: T0, payload: 'P del rincón', movimientos: [minuto('socia'), enJuego('socia'), { token: 'P', ambito: Y.id, cantidad: 10, de: null, a: 'socia' }] });
  const conY = (cantidad) => emision('socia', { A: Y.id, denominacion: 'cama@n1', cantidad, bloquea: 10 });
  // Con todo el P del rincón bloqueado, la cuota del rincón da 100, pero la del alojamiento da 0.
  await assert.rejects(eje.escribir(conY(5)), /cuota de E:socia\/cama@n1@.* en el registro .*bloquea 0 de P:/);
  // Con su P:A bloqueado (1 de 4: cuota 1 en A), solo cabe 1, por mucho que el rincón declare 100.
  const y1 = emision('socia', { A: Y.id, denominacion: 'cama@n1', cantidad: 2, bloquea: 10, otros: [{ token: 'P', ambito: A, cantidad: 1, de: 'socia', a: 'socia', estado: 'bloqueo', salida: serieE('socia', 'cama@n1', Y.id) }] });
  await assert.rejects(eje.escribir(y1), /cuota de E:socia\/cama@n1@.* en el registro .*da 1 de 4/);
  await eje.escribir({ ...y1, payload: unico('uno'), movimientos: y1.movimientos.map((m) => (m.token === 'E' && m.de === null ? { ...m, cantidad: 1 } : m)) });
  // La casa llena el resto en el propio alojamiento: el E del rincón cuenta en el tope de A.
  await eje.escribir(emision('casa', { A, denominacion: 'cama@n1', cantidad: 3, bloquea: 3 }));
  await assert.rejects(eje.escribir(emision('casa', { A, denominacion: 'sofa@n1', cantidad: 1, bloquea: 0 })), /tope de E del registro .* en la franja «n1».*llegaría a 5 y su capacidad es 4/);
  assert.deepEqual(eje.topes(Y.id, T0).map((x) => [x.registro, x.capacidad, x.franja, x.vivo]), [[Y.id, 100, 'n1', 1], [A, 4, 'n1', 4]]);
});

// ---------- 3 · la cuota por P bloqueado y el bloqueo que no se libera ----------

test('R2·3: cada emisor emite en proporción al P:X que bloquea (hacia abajo)', async () => {
  const { eje, A } = await mundo({ capacidad: 4, pA: 4 });
  await assert.rejects(eje.escribir(emision('casa', { A, denominacion: 'cama@n1', cantidad: 1, bloquea: 0 })), /cuota de E:casa\/cama@n1@.*bloquea 0 de P:[0-9a-f]+ .*de 4 emitido; da 0 de 4/);
  await assert.rejects(eje.escribir(emision('casa', { A, denominacion: 'cama@n1', cantidad: 2, bloquea: 1 })), /da 1 de 4 \(hacia abajo\) y el E vivo de la serie llegaría a 2/);
  await eje.escribir(emision('casa', { A, denominacion: 'cama@n1', cantidad: 1, bloquea: 1 }));
  // Con capacidad 4 y P:A emitido 3, un P bloqueado da ⌊4/3⌋ = 1.
  const otro = await mundo({ capacidad: 4, pA: 3 });
  await assert.rejects(otro.eje.escribir(emision('casa', { A: otro.A, denominacion: 'cama@n1', cantidad: 2, bloquea: 1 })), /da 1 de 4/);
  await otro.eje.escribir(emision('casa', { A: otro.A, denominacion: 'cama@n1', cantidad: 2, bloquea: 2 })); // ⌊8/3⌋ = 2
});

test('R2·3: donde X no tiene P propio emitido manda el P:genesis bloqueado', async () => {
  const { eje, A } = await mundo({ capacidad: 4, pA: 0 });
  // g (persona, P:genesis 10) bloquea P:genesis: ⌊b · 4 / 10⌋.
  const deG = (cantidad, bloquea) => emision('g', { A, denominacion: 'cama@n1', cantidad, bloquea, ambito: 'genesis' });
  const en = (ev) => ({ ...ev, movimientos: ev.movimientos.map((m) => (m.token === 'R' ? { ...m, a: 'casa' } : m)) });
  await assert.rejects(eje.escribir(en(deG(1, 2))), /bloquea 2 de P:genesis con la salida de la serie, de 10 emitido; da 0 de 4/);
  await eje.escribir(en(deG(2, 5)));
  assert.equal(eje.bloqueado('g', 'P:genesis', serieE('g', 'cama@n1', A)), 5);
});

test('R2·3: el P bloqueado no se libera mientras viva la E que respalda', async () => {
  const { eje, A } = await mundo({ capacidad: 4, pA: 4 });
  const k = serieE('casa', 'cama@n1', A);
  await eje.escribir(emision('casa', { A, denominacion: 'cama@n1', cantidad: 2, bloquea: 2 }));
  const libera = (payload) => ({ autor: 'casa', sobre: A, t: T0, payload, movimientos: [minuto('casa'), { token: 'P', ambito: A, cantidad: 2, de: 'casa', a: 'casa', estado: 'liberacion', salida: k }] });
  await assert.rejects(eje.escribir(libera('suelta')), /respalda 2 de E vivo: no se libera mientras viva/);
  // La casa da una noche a bea; bea la consume; la casa consume la otra: ya no queda E vivo.
  await eje.escribir({ autor: 'casa', sobre: A, t: T0, payload: 'entrega', movimientos: [minuto('casa'), { token: 'E', emisor: 'casa', denominacion: 'cama@n1', registro: A, cantidad: 1, de: 'casa', a: 'bea' }] });
  await eje.escribir({ autor: 'bea', sobre: A, t: T0, payload: 'dormida', movimientos: [minuto('bea'), { token: 'E', emisor: 'casa', denominacion: 'cama@n1', registro: A, cantidad: 1, de: 'bea', a: null }] });
  await assert.rejects(eje.escribir(libera('aún no')), /respalda 1 de E vivo/);
  await eje.escribir({ autor: 'casa', sobre: A, t: T0, payload: 'sin usar', movimientos: [minuto('casa'), { token: 'E', emisor: 'casa', denominacion: 'cama@n1', registro: A, cantidad: 1, de: 'casa', a: null }] });
  assert.equal(eje.vivo(k, T0), 0);
  await eje.escribir(libera('ya'));
  assert.equal(eje.saldo('casa', 'P:' + A), 4);
  // Un bloqueo cuya salida no es una serie de E no cambia: se libera cuando su titular quiere.
  await eje.escribir({ autor: 'casa', sobre: A, t: T0, payload: 'otro', movimientos: [minuto('casa'), { token: 'P', ambito: A, cantidad: 1, de: 'casa', a: 'casa', estado: 'bloqueo', salida: 'cualquier cosa' }] });
  await eje.escribir({ autor: 'casa', sobre: A, t: T0, payload: 'otro fuera', movimientos: [minuto('casa'), { token: 'P', ambito: A, cantidad: 1, de: 'casa', a: 'casa', estado: 'liberacion', salida: 'cualquier cosa' }] });
});

// ---------- 4 · el redondeo ----------

test('R2·4: fracciones solo en series divisibles; la cuota de una divisible no se redondea', async () => {
  const { eje, A } = await mundo({ capacidad: 4, pA: 3 });
  await assert.rejects(eje.escribir(emision('casa', { A, denominacion: 'leña', cantidad: 1.5, bloquea: 2 })), /la serie E:casa\/leña@.* va en enteros: no se declaró divisible/);
  // Divisible: 1 de 3 bloqueado da 4/3 exactos.
  await assert.rejects(eje.escribir(emision('casa', { A, denominacion: 'leña', cantidad: 1.4, bloquea: 1, extra: { divisible: true } })), /cuota de E:casa\/leña/);
  await eje.escribir(emision('casa', { A, denominacion: 'leña', cantidad: 4 / 3, bloquea: 1, extra: { divisible: true } }));
  assert.equal(eje.serie(serieE('casa', 'leña', A)).divisible, true);
  // Una ampliación no cambia el contrato.
  await assert.rejects(eje.escribir(emision('casa', { A, denominacion: 'leña', cantidad: 1, bloquea: 1 })), /es divisible: una ampliación no cambia su contrato/);
  // Las fracciones de una serie no divisible tampoco se mueven.
  await eje.escribir({ autor: 'casa', sobre: A, t: T0, payload: 'vales', movimientos: [minuto('casa'), enJuego('casa'), { token: 'E', emisor: 'casa', denominacion: 'vale', cantidad: 10, de: null, a: 'casa' }] });
  await assert.rejects(eje.escribir({ autor: 'casa', sobre: A, t: T0, payload: 'medio vale', movimientos: [minuto('casa'), { token: 'E', emisor: 'casa', denominacion: 'vale', cantidad: 0.5, de: 'casa', a: 'bea' }] }), /E:casa\/vale va en enteros/);
});

test('R2·4: el génesis fija también si su E es divisible; no nombra registro ni emite en conjunto', async () => {
  const base = { demostracion: true, identidad: 'g', tipo: 'persona', t: T0, foco: 'g' };
  await assert.rejects(Eje.genesis({ ...base, emision: [{ token: 'T', escala: 'minuto', cantidad: 9 }, { token: 'E', denominacion: 'EUR', cantidad: 10.5 }] }), /E:g\/EUR va en enteros/);
  const eje = await Eje.genesis({ ...base, emision: [{ token: 'T', escala: 'minuto', cantidad: 9 }, { token: 'E', denominacion: 'EUR', cantidad: 10.5, divisible: true }] });
  assert.deepEqual(eje.serie('E:g/EUR'), { emisor: 'g', emitido: 10.5, divisible: true });
  assert.equal(eje.series().find((s) => s.clave === 'E:g/EUR').registro, eje.genesisId);
  await assert.rejects(Eje.genesis({ ...base, emision: [{ token: 'T', escala: 'minuto', cantidad: 9 }, { token: 'E', denominacion: 'EUR', cantidad: 1, registro: 'a'.repeat(64) }] }), /en el génesis no hay registro que nombrar/);
  await assert.rejects(Eje.genesis({ ...base, emision: [{ token: 'T', escala: 'minuto', cantidad: 9 }, { token: 'E', denominacion: 'EUR', cantidad: 1, emisores: ['g', 'h'] }] }), /sin emisión conjunta/);
});

test('R2·4: emisión conjunta: varios suman su P bloqueado para alcanzar una unidad entera', async () => {
  const { eje, A } = await mundo({ capacidad: 4, pA: 3 });
  await delega(eje, A, 'socia', 1);
  await delega(eje, A, 'bea', 1);
  const k = serieE('casa', 'cama@n1', A);
  // Por separado, cada P de 3 da ⌊4/3⌋ = 1 plaza: entre los tres, 3 de 4.
  // Juntos (la casa emite con emisores = los tres, cada uno con su P bloqueado para la serie), ⌊3·4/3⌋ = 4.
  const firma = (quien) => eje.escribir({ autor: quien, sobre: A, t: T0, payload: unico('firma ' + quien), movimientos: [minuto(quien), { token: 'P', ambito: A, cantidad: 1, de: quien, a: quien, estado: 'bloqueo', salida: k }] });
  const conjunta = (cantidad, emisores) => emision('casa', { A, denominacion: 'cama@n1', cantidad, bloquea: 1, extra: { emisores } });
  await firma('socia');
  // bea aparece sin haber bloqueado nada: su firma falta.
  await assert.rejects(eje.escribir(conjunta(4, ['casa', 'socia', 'bea'])), /emisión conjunta de E:casa\/cama@n1@.*: bea no tiene P bloqueado para la serie/);
  await firma('bea');
  await eje.escribir(conjunta(4, ['casa', 'socia', 'bea']));
  assert.equal(eje.saldo('casa', k), 4);
  assert.deepEqual(eje.serie(k).emisores, ['bea', 'casa', 'socia']);
  // Los emisores son del contrato: una ampliación no los cambia.
  await assert.rejects(eje.escribir(emision('casa', { A, denominacion: 'cama@n1', cantidad: 1, bloquea: 0 })), /una ampliación no cambia sus emisores/);
  // El P de bea queda atado a la serie mientras viva.
  await assert.rejects(eje.escribir({ autor: 'bea', sobre: A, t: T0, payload: 'me voy', movimientos: [minuto('bea'), { token: 'P', ambito: A, cantidad: 1, de: 'bea', a: 'bea', estado: 'liberacion', salida: k }] }), /no se libera mientras viva/);
});

// ---------- persistencia y versión 2 ----------

test('R2: el eje se reconstruye igual (registro, consumido, contrato) y la versión 2 no conoce estos campos', async () => {
  const { eje, A } = await mundo({ capacidad: 4, pA: 4 });
  await eje.escribir(emision('casa', { A, denominacion: 'cama@n1', cantidad: 3, bloquea: 3 }));
  await eje.escribir({ autor: 'casa', sobre: A, t: T0, payload: 'una menos', movimientos: [minuto('casa'), { token: 'E', emisor: 'casa', denominacion: 'cama@n1', registro: A, cantidad: 1, de: 'casa', a: null }] });
  const otro = await restaurar(JSON.parse(JSON.stringify(serializar(eje))));
  assert.deepEqual(otro.series(), eje.series());
  assert.deepEqual(otro.topes(A, T0), eje.topes(A, T0));
  const ev = await crearEvento({ autor: 'casa', sobre: A, t: T0, payload: 'v2', movimientos: [minuto('casa'), { token: 'E', emisor: 'casa', denominacion: 'x', registro: A, cantidad: 1, de: null, a: 'casa' }] });
  assert.match(reglasDelTope(ev, { reglas: 2 })[0].texto, /no existían en la versión 2/);
});
