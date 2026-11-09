// La obtención de P como TOPE ACUMULADO (decisión de VG, tras el encargo 3b-bis). Antes, una obtención no se repetía
// (una por regla, titular y registro): dos plazas en dos transacciones daban P solo por la primera, y una emisión de
// polvo del emisor agotaba la obtención del receptor. Ahora lo que una regla que escribe coloca con `put v at
// A.2.1.(r)` es un NIVEL: el P obtenido por A sobre r por esa regla llega al menos a v, y el libro acuña solo la
// diferencia (acuñar con `tope`), sin quemar nunca por bajar el nivel. Las dos reglas de E y R calculan el nivel como
// diez por unidad neta recibida directamente del emisor (la vista `A.8.6`, el libro de antes, más lo que llega en la
// transacción); lo que pasa entre tenedores no cuenta. `writing a record gives ten P on it` no cambia: un registro
// escrito es nivel diez sobre él.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Eje } from '../src/eje.js';
import { crearEvento } from '../src/evento.js';
import { evaluar, evaluarEscritura } from '../src/bqlm.js';
import { ContextoEje } from '../src/contexto-eje.js';
import { EPOCA_0_BTML } from '../src/epocas.js';
import { serializar, restaurar } from '../src/persistencia.js';
import { entrarPorInvitacion } from '../ejemplos/ikisai/altas.mjs';

const T0 = '2026-11-08T10:00:00Z';
const minuto = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });
const R = (emisor, cantidad, de, a) => ({ token: 'R', emisor, cantidad, de, a });
const vale = (cantidad, de, a) => ({ token: 'E', emisor: 'g', denominacion: 'vale', cantidad, de, a });
const regla = (nombre) => EPOCA_0_BTML.escrituras.find((r) => r[0][0] === nombre);
const E_REGLA = 'getting E gives ten P on its record';
const R_REGLA = 'receiving R gives ten P on the root of its issuer';
const W_REGLA = 'writing a record gives ten P on it';

let plaza;
let n = 0;
/** g escribe el génesis y emite su R y cien vales divisibles (atados a su alta, el génesis); invita a ana, bea y carla. */
async function mundo() {
  const eje = await Eje.genesis({ demostracion: true, identidad: 'g', t: T0, foco: 'raíz', emision: [{ token: 'R', cantidad: 10 }, { token: 'E', denominacion: 'vale', cantidad: 100, divisible: true }] });
  for (const quien of ['ana', 'bea', 'carla']) await entrarPorInvitacion(eje, { por: 'g', quien, t: T0 });
  const g = eje.genesisId;
  plaza = (await eje.escribir({ autor: 'g', sobre: g, t: T0, payload: ['Plaza'], movimientos: [minuto('g')] })).id;
  return { eje, g };
}

/** `autor` escribe una transacción con esos movimientos (más su minuto); devuelve el evento. */
const mueve = (eje, autor, movimientos) => eje.escribir({ autor, sobre: autor === 'g' ? eje.genesisId : plaza, t: T0, payload: 'mov ' + (n++), movimientos: [minuto(autor), ...movimientos] });

/** Lo que obtuvo `quien` por la regla `etiqueta` en la transacción `ev` (la suma de sus acuñaciones de obtención). */
const obtenido = (eje, ev, quien, etiqueta) => eje.libro.asientos({ clase: 'obtencion' }).filter((a) => a.tx.id === ev.id && a.a === quien && (etiqueta === undefined || a.etiqueta === etiqueta)).reduce((s, a) => s + a.cantidad, 0);

/** Lo que `quien` obtiene por E al recibir `movimientos` escritos por `autor`. */
const porE = async (eje, autor, movimientos, quien) => obtenido(eje, await mueve(eje, autor, movimientos), quien, E_REGLA);

test('(a) dos plazas en dos transacciones dan veinte, igual que dos plazas en una (ya no hay asimetría)', async () => {
  const { eje, g } = await mundo();
  assert.deepEqual([await porE(eje, 'g', [vale(1, 'g', 'ana')], 'ana'), await porE(eje, 'g', [vale(1, 'g', 'ana')], 'ana')], [10, 10]);
  assert.equal(await porE(eje, 'g', [vale(2, 'g', 'bea')], 'bea'), 20);
  assert.equal(eje.poderSobre('ana', g, 'ana'), eje.poderSobre('bea', g, 'bea'), 'el mismo P sobre el génesis (la R de la invitación y las dos plazas)');
  assert.equal(eje.poderSobre('ana', g, 'ana'), 30);
});

test('(b) polvo: una décima de E da un P, y la venta posterior de una unidad sube el nivel a once (acuña diez más)', async () => {
  const { eje, g } = await mundo();
  assert.equal(await porE(eje, 'g', [vale(0.1, 'g', 'ana')], 'ana'), 1);
  assert.equal(await porE(eje, 'g', [vale(1, 'g', 'ana')], 'ana'), 10);
  assert.equal(eje.poderSobre('ana', g, 'ana'), 21, 'diez por la R de la invitación y once por los vales');
  // El emisor no agota nada con polvo: tres migajas más suben el nivel lo que valen.
  for (const c of [0.2, 0.3, 0.4]) assert.ok(Math.abs((await porE(eje, 'g', [vale(c, 'g', 'ana')], 'ana')) - 10 * c) < 1e-9);
});

test('(c) ir y venir: recibir una E del emisor da diez; devolverla no quema; recibirla otra vez no acuña', async () => {
  const { eje, g } = await mundo();
  assert.equal(await porE(eje, 'g', [vale(1, 'g', 'ana')], 'ana'), 10);
  const antes = eje.poderSobre('ana', g);
  const devuelve = await mueve(eje, 'ana', [vale(1, 'ana', 'g')]);
  assert.deepEqual([obtenido(eje, devuelve, 'ana', E_REGLA), obtenido(eje, devuelve, 'g', E_REGLA), eje.poderSobre('ana', g)], [0, 0, antes], 'ni quema ni da nada al emisor');
  assert.equal(await porE(eje, 'g', [vale(1, 'g', 'ana')], 'ana'), 0, 'el nivel vuelve a diez: ya alcanzado');
  assert.equal(await porE(eje, 'g', [vale(1, 'g', 'ana')], 'ana'), 10, 'la segunda unidad neta sí sube el nivel');
  assert.equal(eje.poderSobre('ana', g), antes + 10);
});

test('(d) reventa: quien compra y revende conserva su P; quien compra a un tenedor no obtiene; la siguiente compra al emisor sí', async () => {
  const { eje, g } = await mundo();
  assert.equal(await porE(eje, 'g', [vale(1, 'g', 'ana')], 'ana'), 10);
  const vende = await mueve(eje, 'ana', [vale(1, 'ana', 'carla')]);
  assert.deepEqual([obtenido(eje, vende, 'carla'), obtenido(eje, vende, 'ana', E_REGLA), eje.poderSobre('ana', g, 'ana')], [0, 0, 20], 'carla no obtiene; ana conserva (diez de la R, diez del vale)');
  assert.equal(await porE(eje, 'g', [vale(1, 'g', 'ana')], 'ana'), 10, 'ana sigue con una unidad neta recibida del emisor: la segunda sube el nivel a veinte');
  // carla devuelve al emisor lo que compró a ana: su nivel baja de cero (no tenía P del vale) y nada se quema.
  const devuelve = await mueve(eje, 'carla', [vale(1, 'carla', 'g')]);
  assert.deepEqual([obtenido(eje, devuelve, 'carla', E_REGLA), obtenido(eje, devuelve, 'g', E_REGLA), eje.poderSobre('carla', g, 'carla')], [0, 0, 10], 'solo la R de su invitación');
});

test('(e) R: la misma R devuelta y recibida otra vez no acuña; la que pasa entre tenedores no acuña; la segunda unidad neta sí', async () => {
  const { eje } = await mundo();
  const altaAna = eje.alta('ana').id;
  const porR = async (autor, movimientos, quien) => obtenido(eje, await mueve(eje, autor, movimientos), quien, R_REGLA);
  await mueve(eje, 'ana', [R('ana', 10, null, 'ana')]);
  assert.equal(await porR('ana', [R('ana', 2, 'ana', 'bea')], 'bea'), 20);
  assert.equal(await porR('bea', [R('ana', 1, 'bea', 'ana')], 'ana'), 0, 'devolver R al emisor no le da P a él');
  assert.equal(eje.poderSobre('bea', altaAna), 20, 'ni quema el de bea');
  assert.equal(await porR('ana', [R('ana', 1, 'ana', 'bea')], 'bea'), 0, 'la misma R, otra vez: el nivel ya estaba en veinte');
  assert.equal(await porR('ana', [R('ana', 1, 'ana', 'bea')], 'bea'), 10, 'la tercera unidad neta sube el nivel a treinta');
  assert.equal(await porR('bea', [R('ana', 1, 'bea', 'carla')], 'carla'), 0, 'de un tenedor, nada');
  assert.equal(await porR('carla', [R('ana', 1, 'carla', 'ana')], 'ana'), 0);
  // Las vistas: lo recibido neto de su emisor, por serie (A.8.6), y la obligación de ana (A.8.1) siguen cada una en su sitio.
  const ctx = new ContextoEje(eje, { epoch: EPOCA_0_BTML });
  assert.deepEqual(evaluar('("bea").8.6.("R:ana").1', ctx).valor, [3], 'recibidas 4, devuelta 1');
  assert.deepEqual([evaluar('("bea").8.6.("R:ana").6', ctx).valor, evaluar('("bea").8.6.("R:ana").4', ctx).valor, evaluar('("bea").8.6.("R:ana").3', ctx).valor], [[4], [1], ['ana']]);
  assert.deepEqual(evaluar('("carla").8.6.("R:ana")', ctx).valor, [], 'carla no recibió R de ana de ana: de bea');
  assert.equal(evaluar('("ana").8.1', ctx).valor[0], eje.obligaciones('ana'));
});

test('(f) varias colocaciones de la misma regla para el mismo titular y registro en una transacción: el máximo, no la suma', async () => {
  const { eje, g } = await mundo();
  const ev = await crearEvento({ autor: 'g', sobre: g, t: T0, payload: 'dos de una', movimientos: [minuto('g'), vale(1, 'g', 'ana'), vale(1, 'g', 'ana')] });
  // La regla coloca una vez por movimiento, y cada vez el mismo nivel (lo que llega en toda la transacción: dos).
  const w = evaluarEscritura(regla(E_REGLA), new ContextoEje(eje, { ev, epoch: EPOCA_0_BTML }));
  assert.deepEqual(w.escrituras.map(({ desde, ...x }) => x), [{ sujeto: 'ana', camino: [2, 1], clave: g, valor: 20 }, { sujeto: 'ana', camino: [2, 1], clave: g, valor: 20 }]);
  // Cada colocación dice desde qué movimiento se hizo (la serie de la que viene: el tope por serie).
  assert.deepEqual(w.escrituras.map((x) => [x.desde.k, x.desde.i, x.desde.m.denominacion]), [['mov', 1, 'vale'], ['mov', 2, 'vale']]);
  // El eje las funde en un solo paso: acuñar el nivel con tope (no cuarenta).
  const pasos = eje.transaccion(ev).movimientos.slice(ev.movimientos.length).flat();
  const deAna = pasos.filter((p) => p.a === 'ana');
  assert.deepEqual(deAna.map((p) => [p.serie, p.cantidad, p.tope, p.clase, p.etiqueta]), [['P:' + g + '/ana', 20, 20, 'obtencion', E_REGLA]]);
  const hecho = await eje.anadir(ev);
  assert.equal(obtenido(eje, hecho, 'ana', E_REGLA), 20);
  // Un nivel ya alcanzado no deja paso (ni vacío): ana devuelve un vale y lo recibe otra vez junto a uno para bea; la
  // transacción lleva sus movimientos, la escritura de g y la obtención de bea, y nada para ana.
  await mueve(eje, 'ana', [vale(1, 'ana', 'g')]);
  const otra = await crearEvento({ autor: 'g', sobre: g, t: T0, payload: 'nada nuevo para ana', movimientos: [minuto('g'), vale(1, 'g', 'bea'), vale(1, 'g', 'ana')] });
  const tx = eje.transaccion(otra);
  assert.deepEqual(tx.movimientos.slice(otra.movimientos.length).flat().map((p) => [p.a, p.cantidad, p.tope]), [['g', 10, 10], ['bea', 10, 10]], 'ana ya está en veinte: no hay paso para ella');
  assert.equal(obtenido(eje, await eje.anadir(otra), 'ana', E_REGLA), 0);
});

test('varias series de E atadas al mismo registro suman en el nivel; el P de la emisión de polvo no agota la de otra serie', async () => {
  const { eje, g } = await mundo();
  const E = (denominacion, cantidad, a) => [{ token: 'E', emisor: 'g', denominacion, cantidad, de: null, a: 'g' }, { token: 'E', emisor: 'g', denominacion, cantidad, de: 'g', a }];
  assert.equal(await porE(eje, 'g', E('pan', 3, 'ana'), 'ana'), 30);
  assert.equal(await porE(eje, 'g', E('miel', 1, 'ana'), 'ana'), 10, 'otra serie atada al génesis: el nivel sube a cuarenta');
  assert.equal(await porE(eje, 'g', [vale(0.5, 'g', 'ana')], 'ana'), 5);
  assert.equal(eje.poderSobre('ana', g, 'ana'), 55, 'la R de la invitación y 4,5 unidades de E');
  const ctx = new ContextoEje(eje, { epoch: EPOCA_0_BTML });
  assert.deepEqual(evaluar('("ana").8.6 each 1', ctx).valor, [1, 3, 1, 0.5], 'R:g, pan, miel y vale');
  assert.deepEqual(evaluar('sum ((("ana").8.6 where E in it.0.0.0 and it.0.5 = "' + g + '") each 1)', ctx).valor, [4.5], 'lo que lee la regla: las series de E atadas al génesis');
});

test('la vista A.8.6 cuenta lo recibido directamente del emisor aunque ya no se tenga, y no lo que llega de un tenedor', async () => {
  const { eje, g } = await mundo();
  await mueve(eje, 'g', [vale(2, 'g', 'ana')]);
  await mueve(eje, 'ana', [vale(2, 'ana', 'bea')]);
  const ctx = new ContextoEje(eje, { epoch: EPOCA_0_BTML });
  assert.deepEqual([eje.saldo('ana', 'E:g/vale'), evaluar('("ana").8.6.("E:g/vale").1', ctx).valor], [0, [2]], 'ana ya no tiene vales, pero recibió dos del emisor');
  assert.deepEqual(evaluar('("ana").1.("E:g/vale")', ctx).valor, [], 'la cartera no los lista: por eso la vista no cuelga de ella');
  assert.deepEqual(evaluar('("bea").8.6 each 0.0.0', ctx).valor.map((s) => s.simbolo), ['R'], 'bea solo recibió de su emisor la R de la invitación');
  assert.deepEqual(eje.recibidoDelEmisor('ana'), [{ serie: 'R:g', emisor: 'g', recibido: 1, devuelto: 0, neto: 1 }, { serie: 'E:g/vale', emisor: 'g', recibido: 2, devuelto: 0, neto: 2 }]);
  assert.deepEqual(eje.recibidoDelEmisor('g'), [], 'un emisor no se recibe a sí mismo');
  assert.deepEqual(eje.recibidoDelEmisor('nadie'), []);
});

test('«writing a record gives ten P on it» con la semántica de nivel: diez una vez por registro, y el paso lleva su tope', async () => {
  const { eje, g } = await mundo();
  const ev = await crearEvento({ autor: 'ana', sobre: plaza, t: T0, payload: 'nota', movimientos: [minuto('ana')] });
  assert.deepEqual(evaluarEscritura(regla(W_REGLA), new ContextoEje(eje, { ev, epoch: EPOCA_0_BTML })).escrituras, [{ sujeto: 'ana', camino: [2, 1], clave: ev.id, valor: 10 }]);
  assert.deepEqual(eje.transaccion(ev).movimientos.slice(1).flat().map((p) => [p.a, p.cantidad, p.tope, p.etiqueta]), [['ana', 10, 10, W_REGLA]]);
  const nota = await eje.anadir(ev);
  assert.equal(eje.poderSobre('ana', nota.id), 10);
  assert.equal(eje.libro.asientos({ clase: 'obtencion', serie: 'P:' + nota.id + '/ana' }).length, 1);
  assert.ok(g);
});

test('tope por serie: el blanqueo por un tercero (A → C → emisor → A) con una sola unidad emitida acuña diez en total, nunca veinte; con dos, veinte', async () => {
  const blanqueo = async (emitidas, vueltas = 3) => {
    const eje = await Eje.genesis({ demostracion: true, identidad: 'g', t: T0, foco: 'raíz', emision: [{ token: 'R', cantidad: 10 }, { token: 'E', denominacion: 'vale', cantidad: emitidas }] });
    for (const quien of ['ana', 'carla']) await entrarPorInvitacion(eje, { por: 'g', quien, t: T0 });
    const g = eje.genesisId;
    plaza = (await eje.escribir({ autor: 'g', sobre: g, t: T0, payload: ['Plaza'], movimientos: [minuto('g')] })).id;
    const porVuelta = [];
    for (let i = 0; i < vueltas; i++) {
      porVuelta.push(await porE(eje, 'g', [vale(1, 'g', 'ana')], 'ana'));
      await mueve(eje, 'ana', [vale(1, 'ana', 'carla')]);
      await mueve(eje, 'carla', [vale(1, 'carla', 'g')]);
    }
    // El neto de ana sigue subiendo (recibió tres del emisor y no le devolvió ninguna): es el tope por serie el que para.
    assert.equal(eje.recibidoDelEmisor('ana').find((x) => x.serie === 'E:g/vale').neto, vueltas);
    assert.equal(eje.obtenidoDeSerie('E:g/vale', E_REGLA), porVuelta.reduce((s, x) => s + x, 0), 'lo apuntado por serie es lo acuñado');
    // Y se restaura igual.
    const copia = await Eje.desde(eje.orden.map((id) => eje.obtener(id)));
    assert.equal(copia.obtenidoDeSerie('E:g/vale', E_REGLA), eje.obtenidoDeSerie('E:g/vale', E_REGLA));
    assert.deepEqual(copia.libro.vista('ana'), eje.libro.vista('ana'));
    return { porVuelta, P: eje.poderSobre('ana', g, 'ana') - 10 };
  };
  assert.deepEqual(await blanqueo(1), { porVuelta: [10, 0, 0], P: 10 }, 'una unidad emitida: diez en total');
  assert.deepEqual(await blanqueo(2), { porVuelta: [10, 10, 0], P: 20 }, 'dos unidades emitidas: veinte');
  // El tope por serie suma todos los orígenes: con dos unidades emitidas, ana y carla no pasan de veinte entre las dos.
  const eje = await Eje.genesis({ demostracion: true, identidad: 'g', t: T0, foco: 'raíz', emision: [{ token: 'R', cantidad: 10 }, { token: 'E', denominacion: 'vale', cantidad: 2 }] });
  for (const quien of ['ana', 'carla']) await entrarPorInvitacion(eje, { por: 'g', quien, t: T0 });
  plaza = (await eje.escribir({ autor: 'g', sobre: eje.genesisId, t: T0, payload: ['Plaza'], movimientos: [minuto('g')] })).id;
  assert.equal(await porE(eje, 'g', [vale(2, 'g', 'ana')], 'ana'), 20);
  await mueve(eje, 'ana', [vale(2, 'ana', 'g')]);
  assert.equal(await porE(eje, 'g', [vale(2, 'g', 'carla')], 'carla'), 0, 'las mismas dos unidades ya dieron su P (a ana, que lo conserva)');
  // Una serie que nace en la misma transacción cuenta lo que acuña: el cupo no es cero.
  const ev = await mueve(eje, 'g', [{ token: 'E', emisor: 'g', denominacion: 'pan', cantidad: 2, de: null, a: 'g' }, { token: 'E', emisor: 'g', denominacion: 'pan', cantidad: 2, de: 'g', a: 'carla' }]);
  assert.equal(obtenido(eje, ev, 'carla', E_REGLA), 20);
  // El paso apunta de qué serie viene lo acuñado.
  assert.deepEqual(eje.libro.asientos({ clase: 'obtencion' }).filter((a) => a.tx.id === ev.id && a.a === 'carla').map((a) => a.origen.series), [[['E:g/pan', 20]]]);
});

test('tope por serie en R: la misma R devuelta por un tercero y dada otra vez no acuña más de diez por unidad emitida', async () => {
  const { eje } = await mundo();
  const altaAna = eje.alta('ana').id;
  const porR = async (autor, movimientos, quien) => obtenido(eje, await mueve(eje, autor, movimientos), quien, R_REGLA);
  await mueve(eje, 'ana', [R('ana', 1, null, 'ana')]);
  assert.equal(await porR('ana', [R('ana', 1, 'ana', 'bea')], 'bea'), 10);
  await mueve(eje, 'bea', [R('ana', 1, 'bea', 'carla')]);
  await mueve(eje, 'carla', [R('ana', 1, 'carla', 'ana')]);
  assert.equal(await porR('ana', [R('ana', 1, 'ana', 'bea')], 'bea'), 0, 'bea tiene neto 2, pero ana solo emitió una');
  assert.equal(eje.poderSobre('bea', altaAna, 'bea'), 10);
  // Emitir otra abre cupo: la siguiente vuelta sí acuña.
  await mueve(eje, 'bea', [R('ana', 1, 'bea', 'carla')]);
  await mueve(eje, 'carla', [R('ana', 1, 'carla', 'ana')]);
  assert.equal(await porR('ana', [R('ana', 1, null, 'ana'), R('ana', 1, 'ana', 'bea')], 'bea'), 10);
  assert.equal(eje.obtenidoDeSerie('R:ana', R_REGLA), 20);
});

test('(g) persistencia: un eje guardado se restaura con el mismo P obtenido y las mismas acuñaciones de obtención', async () => {
  const { eje, g } = await mundo();
  await mueve(eje, 'g', [vale(0.1, 'g', 'ana')]);
  await mueve(eje, 'g', [vale(1, 'g', 'ana'), vale(1, 'g', 'ana')]);
  await mueve(eje, 'ana', [vale(1, 'ana', 'g')]);
  await mueve(eje, 'g', [vale(1, 'g', 'ana')]);
  await mueve(eje, 'ana', [R('ana', 5, null, 'ana'), R('ana', 2, 'ana', 'bea')]);
  await mueve(eje, 'bea', [R('ana', 1, 'bea', 'ana')]);
  await mueve(eje, 'ana', [R('ana', 2, 'ana', 'bea')]);
  const foto = (e) => JSON.stringify([e.identidades().map((id) => [id, e.poderes(id), e.recibidoDelEmisor(id)]), e.libro.asientos({ clase: 'obtencion' }).map((a) => [a.n, a.a, a.serie, a.cantidad, a.etiqueta])]);
  const copia = await restaurar(JSON.parse(JSON.stringify(serializar(eje))));
  assert.equal(foto(copia), foto(eje));
  assert.equal(foto(await Eje.desde(eje.orden.map((id) => eje.obtener(id)))), foto(eje));
  assert.deepEqual([eje.poderSobre('ana', g, 'ana'), eje.poderSobre('bea', eje.alta('ana').id, 'bea')], [31, 30], 'ana: la R y 2,1 netas de vale; bea: 3 netas de R');
});
