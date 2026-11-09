// Reglas R8, R9 y R10 del estudio de neutralidad (docs/notas/NEUTRALIDAD_IDENTIDAD.md §4),
// tras la regla madre que VG aceptó el 7-11 noche: lo que el sistema concede o enseña a un
// tercero depende solo de cantidades de E, P y R, nunca de cuántas identidades, emisores,
// registros o escritos las llevan. Un caso positivo y uno negativo por regla; la propiedad
// de R8 y los NEU-07/NEU-08 están en test/neutralidad.test.js.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Eje } from '../src/eje.js';
import * as motor from '../src/motor.js';
import { evaluar, consultar } from '../src/bql.js';
import { direccion } from '../src/btml.js';
import { elegibles, ocupantesElegibles } from '../src/elegibles.js';
import { secuencia } from '../src/sequenced.js';
import { validez } from '../src/validez.js';
import { serializar, restaurar } from '../src/persistencia.js';
import { crearEvento } from '../src/evento.js';
import { generarClaves, firmar, firmarPosesion } from '../src/autoridad.js';

const T0 = '2026-11-07T23:00:00Z';
// Las altas, un mes antes de T0 (ya no hace falta: cada persona escribe con su asignación de T del día (VG, 8-11)).
const ALTA = '2026-10-07T23:00:00Z';
// T no cruza de persona (VG, 7-11 noche): ceder minutos a otro es E de la serie de tiempo de quien los da
// (E:<de>/minuto, que el génesis emite); sin destinatario, consumir T propio.
const minuto = (de, cantidad = 1, a = null) => (a === null ? { token: 'T', escala: 'minuto', cantidad, de, a } : { token: 'E', emisor: de, denominacion: 'minuto', cantidad, de, a });

/** Eje de demostración: g da de alta a quien se le pida (con tipo persona salvo que se diga otro). */
async function demo(ids, tipos = {}) {
  const eje = await Eje.genesis({
    demostracion: true, identidad: 'g', t: ALTA, foco: 'raíz',
    emision: [{ token: 'E', denominacion: 'minuto', cantidad: 1e9 }, { token: 'P', ambito: 'genesis', cantidad: 10 }],
  });
  // B1 (VG, 10-11): las personas escriben su propia alta; persona o cosa se lee de quién la escribe.
  for (const id of ids) if ((tipos[id] ?? 'persona') === 'persona') await eje.entrar({ identidad: id, t: ALTA });
  await eje.escribir({
    autor: 'g', sobre: eje.genesisId, t: ALTA, payload: 'altas',
    // A una cosa, g le da T (Core, 8-11: una persona da su T a sus cosas); a las demás, minutos como E (T no cruza
    // de persona). Un grupo no recibe T ni lo acuña: lo que escribe un grupo lo escribe una persona con P sobre él.
    movimientos: [minuto('g'), ...ids.map((id) => (tipos[id] === 'cosa' ? { token: 'T', escala: 'minuto', cantidad: 500, de: 'g', a: id } : minuto('g', 500, id)))],
  });
  return eje;
}
const escribe = (eje, autor, sobre, payload, indices) => eje.escribir({ autor, sobre, t: T0, ...(indices ? { en: direccion(indices) } : {}), movimientos: [minuto(autor)], payload });

// ---------- R8 · elegibilidad antes que límites ----------

test('R8 por defecto: el autor y quien aparece en su 3; lo demás colisiona, no es elegible y solo se cuenta', async () => {
  const eje = await demo(['dueña', 'ana', 'bea', 'ruido']);
  const r = await escribe(eje, 'dueña', eje.genesisId, ['Mercado', 'ofertas', '=BUSCAR(1)', ['ana', 'texto que no es nadie']]);
  assert.deepEqual([...elegibles(eje, r.id).autores].sort(), ['ana', 'dueña']);
  const propia = await escribe(eje, 'dueña', r.id, 'de la dueña', [1]);
  const deAna = await escribe(eje, 'ana', r.id, 'de ana', [1]);
  const deBea = await escribe(eje, 'bea', r.id, 'de bea', [1]);
  const v = evaluar(eje, r.id, [2]);
  assert.deepEqual(v.valor.items.map((i) => i.evento), [r.id, propia.id, deAna.id]);
  assert.equal(v.valor.noElegibles, 1);
  assert.equal(consultar(eje, r.id, [2], 'CONTAR(BUSCAR(1))').texto, '3'); // el recuento no puntúa
  // Colisionar es libre: el escrito de bea sigue en el eje y en la lista de ocupantes del encaje.
  assert.ok(eje.sobre(r.id, direccion([1])).some((e) => e.id === deBea.id));
  // descubrir y proponer tampoco lo ven; descubrir lo cuenta.
  const [p1] = motor.descubrir(eje, r.id, { posiciones: [1] });
  assert.deepEqual([p1.candidatos.map((c) => c.evento), p1.total, p1.noElegibles], [[r.id, propia.id, deAna.id], 3, 1]);
});

test('R8 lista explícita en 2.3 (criterio · con quién): manda sobre el 3; el autor sigue siendo elegible', async () => {
  const eje = await demo(['dueña', 'ana', 'bea']);
  // El 3 nombra a ana; la lista del criterio, solo a bea.
  const r = await escribe(eje, 'dueña', eje.genesisId, ['Mercado', 'ofertas', ['criterio', 'sin prisa', 'precio justo', ['bea']], ['ana']]);
  assert.deepEqual([elegibles(eje, r.id).origen, [...elegibles(eje, r.id).autores].sort()], ['lista', ['bea', 'dueña']]);
  const deAna = await escribe(eje, 'ana', r.id, 'de ana', [1]);
  const deBea = await escribe(eje, 'bea', r.id, 'de bea', [1]);
  const { lista, noElegibles } = ocupantesElegibles(eje, r.id, [1], { exacto: true });
  assert.deepEqual([lista.filter((o) => o.tipo === 'escrito').map((o) => o.evento), noElegibles], [[deBea.id], 1]);
  assert.equal(lista.some((o) => o.evento === deAna.id), false);
  // Un nombre suelto también es lista; una fórmula no (vuelve el defecto).
  const uno = await escribe(eje, 'dueña', eje.genesisId, ['Otro', 'x', ['c', ['d'], 'e', 'bea']]);
  assert.deepEqual([...elegibles(eje, uno.id).autores].sort(), ['bea', 'dueña']);
  const formula = await escribe(eje, 'dueña', eje.genesisId, ['Otro más', 'x', ['c', ['d'], 'e', '=LOCAL(3)'], ['ana']]);
  assert.deepEqual([elegibles(eje, formula.id).origen, [...elegibles(eje, formula.id).autores].sort()], ['defecto', ['ana', 'dueña']]);
});

// Antes, con un grupo: hoy un grupo no escribe (no tiene T; lo suyo lo escribe una persona con P sobre él, Core
// 8-11), así que la cocina es una cosa que escribe con el T que le da g, y marta tiene P sobre ella.
test('R8 una identidad nombrada en el 3 cuenta como UN ocupante: sus escritos, no los de quien tiene P sobre ella', async () => {
  const eje = await demo(['dueña', 'cocina', 'marta'], { cocina: 'cosa' });
  // marta tiene P sobre el registro de la cocina (su alta): es «miembro». No por eso es elegible.
  const altaCocina = eje.alta('cocina').id;
  await eje.escribir({ autor: 'g', sobre: altaCocina, t: T0, payload: 'marta lleva la cocina', movimientos: [minuto('g'), { token: 'P', ambito: altaCocina, cantidad: 1, de: 'g', a: 'marta' }] });
  assert.ok(eje.poderSobre('marta', altaCocina) > 0);
  const r = await escribe(eje, 'dueña', eje.genesisId, ['Pedido', 'platos', '=BUSCAR(1)', ['cocina']]);
  const delGrupo = await escribe(eje, 'cocina', r.id, 'del grupo', [1]);
  await escribe(eje, 'marta', r.id, 'de marta', [1]);
  const v = evaluar(eje, r.id, [2]).valor;
  assert.deepEqual([v.items.filter((i) => i.origen === 'escrito').map((i) => i.evento), v.noElegibles], [[delGrupo.id], 1]);
});

test('R8 el límite se aplica después, a los elegibles: el ruido no lo agota, pero lo elegible de más sí', async () => {
  const eje = await demo(['dueña', 'ana', 'r1', 'r2', 'r3', 'r4', 'r5']);
  const r = await escribe(eje, 'dueña', eje.genesisId, ['Mercado', 'ofertas', '=BUSCAR(1)', ['ana']]);
  for (const x of ['r1', 'r2', 'r3', 'r4', 'r5']) await escribe(eje, x, r.id, 'ruido de ' + x, [1]); // llega antes
  const deAna = await escribe(eje, 'ana', r.id, 'de ana', [1]);
  // Con límite 2: lo propio y lo de ana caben; los cinco escritos ajenos no cuentan para el límite.
  const bien = evaluar(eje, r.id, [2], { limites: { candidatos: 2 } });
  assert.deepEqual([bien.estado, bien.valor.items.map((i) => i.evento), bien.valor.noElegibles], ['RESUELTO', [r.id, deAna.id], 5]);
  // proponer elige el primer ELEGIBLE, no el primer ruido llegado.
  assert.equal(motor.proponer(eje, r.id, { posiciones: [2] }).elecciones[2].candidato.evento, r.id);
  // Negativo: si los elegibles pasan del límite, sigue PENDIENTE POR LÍMITE (y la parada cuenta solo elegibles).
  await escribe(eje, 'dueña', r.id, 'otra de la dueña', [1]);
  const corto = evaluar(eje, r.id, [2], { limites: { candidatos: 2 } });
  assert.deepEqual([corto.estado, corto.parcial], ['PENDIENTE POR LÍMITE', { examinados: 2, de: 3 }]);
});

test('R8 en las vistas con tope: el ruido no tapa los hijos del dueño en Sequenced; solo ocupa el sitio que sobra, y se cuenta', async () => {
  const eje = await demo(['dueña', 'r1', 'r2', 'r3']);
  const r = await escribe(eje, 'dueña', eje.genesisId, ['Diario', 'notas']);
  const ruido = [];
  for (const x of ['r1', 'r2', 'r3']) ruido.push(await escribe(eje, x, r.id, 'ruido de ' + x));
  const suya = await escribe(eje, 'dueña', r.id, 'nota de la dueña');
  const s = secuencia(eje, r.id, { sentido: 'hijos', maximo: 1 });
  assert.deepEqual([s.decuplas.map((d) => d.id), s.total, s.noElegibles], [[suya.id], 4, 3]);
  // Con sitio, lo demás va detrás, en su orden de entrada y marcado: la vista sirve para navegar.
  const todo = secuencia(eje, r.id, { sentido: 'hijos', maximo: 10 });
  assert.deepEqual(todo.decuplas.map((d) => [d.id, d.elegible ?? true]), [[suya.id, true], ...ruido.map((e) => [e.id, false])]);
});

test('R8 «cualquiera» en el 2.3 abre la elegibilidad a todos: oferta pública, sin recuento por cabeza', async () => {
  const eje = await demo(['casa', 'ana', 'bea']);
  const menu = await escribe(eje, 'casa', eje.genesisId, ['Menú', 'platos', ['sin gluten', 'vegetariano', 'hasta las 16:00', ['cualquiera']]]);
  assert.deepEqual([elegibles(eje, menu.id).todos, elegibles(eje, menu.id).autores], [true, null]);
  const deAna = await escribe(eje, 'ana', menu.id, 'pido uno', [1]);
  const deBea = await escribe(eje, 'bea', menu.id, 'pido dos', [1]);
  const { lista, noElegibles } = ocupantesElegibles(eje, menu.id, [1], { exacto: true });
  assert.deepEqual([lista.filter((o) => o.tipo === 'escrito').map((o) => o.evento), noElegibles], [[deAna.id, deBea.id], 0]);
  // Negativo: sin `cualquiera`, el mismo menú no las ve.
  const cerrado = await escribe(eje, 'casa', eje.genesisId, ['Menú cerrado', 'platos', ['sin gluten']]);
  await escribe(eje, 'ana', cerrado.id, 'pido uno', [1]);
  assert.equal(ocupantesElegibles(eje, cerrado.id, [1], { exacto: true }).noElegibles, 1);
});

test('R8 las correcciones del dueño en su 2.3 y en su 3 cuentan (se añaden); las de otros no', async () => {
  const eje = await demo(['dueña', 'ana', 'bea', 'intrusa']);
  const r = await escribe(eje, 'dueña', eje.genesisId, ['Mercado', 'ofertas', '=BUSCAR(1)', ['ana']]);
  // Alguien ajeno se nombra en el 3 y en el 2.3 de la dueña: no cuenta.
  await escribe(eje, 'intrusa', r.id, 'intrusa', [3]);
  await escribe(eje, 'intrusa', r.id, 'cualquiera', [2, 3]);
  assert.deepEqual([elegibles(eje, r.id).origen, [...elegibles(eje, r.id).autores].sort()], ['defecto', ['ana', 'dueña']]);
  // La dueña añade a bea en su 3: entra con ana.
  await escribe(eje, 'dueña', r.id, ['bea'], [3]);
  assert.deepEqual([...elegibles(eje, r.id).autores].sort(), ['ana', 'bea', 'dueña']);
  // Y luego ancla una lista en su 2.3: manda la lista (el autor sigue dentro), y con `cualquiera`, todos.
  await escribe(eje, 'dueña', r.id, 'bea', [2, 3]);
  assert.deepEqual([elegibles(eje, r.id).origen, [...elegibles(eje, r.id).autores].sort()], ['lista', ['bea', 'dueña']]);
  await escribe(eje, 'dueña', r.id, ['cualquiera'], [2, 3]);
  assert.equal(elegibles(eje, r.id).todos, true);
});

test('R8 el índice por autor del eje (sobreDe) da lo mismo que filtrar sobre() y en orden de entrada', async () => {
  const eje = await demo(['a', 'b', 'c']);
  const r = await escribe(eje, 'a', eje.genesisId, ['Registro']);
  for (const x of ['b', 'a', 'c', 'b', 'a']) await escribe(eje, x, r.id, 'de ' + x + ' ' + eje.orden.length, [1]);
  const dir = direccion([1]);
  for (const autores of [new Set(['a']), new Set(['a', 'b']), new Set(['c', 'b', 'a']), new Set(['nadie'])]) {
    assert.deepEqual(eje.sobreDe(r.id, dir, autores).map((e) => e.id), eje.sobre(r.id, dir).filter((e) => autores.has(e.autor)).map((e) => e.id));
  }
  assert.equal(eje.cuantosSobre(r.id, dir), 5);
});

// ---------- R9 · sin clave no se actúa ----------

test('R9 el génesis sin clave se rechaza fuera de la demostración; con clave y firma, entra; la marca es explícita', async () => {
  const base = { identidad: 'g', t: T0, foco: 'raíz', emision: [{ token: 'E', denominacion: 'minuto', cantidad: 1e9 }] };
  await assert.rejects(Eje.genesis(base), /sin clave no se actúa: el génesis declara la clave de su autor/);
  const k = await generarClaves();
  const eje = await Eje.genesis({ ...base, clave: k.publica, privada: k.privada });
  assert.equal(eje.demostracion, false);
  assert.equal('demostracion' in eje.obtener(eje.genesisId).contexto, false);
  const d = await Eje.genesis({ ...base, demostracion: true });
  assert.equal(d.demostracion, true);
  // Una marca que no es true no vale.
  const g = await crearEvento({ autor: 'g', sobre: null, t: T0, payload: 'raíz', movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: null, a: 'g' }], contexto: { genesis: true, demostracion: 'sí' } });
  await assert.rejects(Eje.desde([g]), /demostracion va como true o no va/);
});

test('R9 el alta trae la prueba de posesión de cada clave nueva: sin ella, con otra clave o sin clave declarada, no entra', async () => {
  const [kg, ka, kb] = [await generarClaves(), await generarClaves(), await generarClaves()];
  const eje = await Eje.genesis({ identidad: 'g', t: T0, foco: 'raíz', clave: kg.publica, privada: kg.privada, emision: [{ token: 'E', denominacion: 'minuto', cantidad: 1e9 }] });
  // ana es una cosa de g (B1: su alta la escribe g, que declara su clave): la clave llega con su prueba de posesión.
  const alta = (payload) => ({ autor: 'g', sobre: eje.genesisId, t: T0, payload, movimientos: [minuto('g'), minuto('g', 5, 'ana')], contexto: { claves: { ana: ka.publica } } });
  await assert.rejects(eje.escribir(alta('sin prueba'), kg.privada), /a declared key comes with its proof: the key of ana/);
  await assert.rejects(eje.escribir(alta('prueba ajena'), kg.privada, { ana: kb.privada }), /prueba de posesión inválida para ana/);
  await assert.rejects(eje.escribir(alta('prueba de más'), kg.privada, { ana: ka.privada, bea: kb.privada }), /prueba de posesión de bea sin clave declarada/);
  const ok = await eje.escribir(alta('con prueba'), kg.privada, { ana: ka.privada });
  assert.equal(typeof ok.posesion.ana, 'string');
  // La prueba firma el id: no se reutiliza en otro evento.
  const otro = await crearEvento({ ...alta('otra alta'), movimientos: [minuto('g'), minuto('g', 5, 'cris')], contexto: { claves: { cris: ka.publica } } });
  const robada = await firmar({ ...otro, posesion: { cris: ok.posesion.ana } }, kg.privada);
  await assert.rejects(eje.anadir(robada), /prueba de posesión inválida para cris/);
  // Validez, capa 3: la posesión pasa de «sin probar» a «probada».
  const capa3 = (await validez(eje, ok.id)).capas[2];
  assert.deepEqual([capa3.estado, capa3.clavesDeclaradas, capa3.demostracion], ['ok', [{ identidad: 'ana', por: 'g', posesion: 'probada' }], false]);
  // Se guarda y se restaura con la prueba.
  const vuelta = await restaurar(JSON.parse(JSON.stringify(serializar(eje))));
  assert.deepEqual(vuelta.obtener(ok.id).posesion, ok.posesion);
});

test('R9 sin clave no se mueve ni se autoriza; en demostración, sí (como antes), y la posesión queda «sin probar»', async () => {
  const [kg, ka] = [await generarClaves(), await generarClaves()];
  const eje = await Eje.genesis({ identidad: 'g', t: ALTA, foco: 'raíz', clave: kg.publica, privada: kg.privada, emision: [{ token: 'E', denominacion: 'minuto', cantidad: 1e9 }, { token: 'P', ambito: 'genesis', cantidad: 4 }] });
  // ana (una persona) entra con clave; muda, sin clave pero con minutos de g y con P sobre todo el eje.
  // B1 (VG, 10-11): la persona escribe su propia alta.
  await eje.entrar({ identidad: 'ana', t: ALTA, clave: ka.publica, privada: ka.privada }); // su clave, en su alta: la firma es la prueba
  await eje.escribir({ autor: 'g', sobre: eje.genesisId, t: ALTA, payload: 'altas', movimientos: [minuto('g'), minuto('g', 9, 'ana'), minuto('g', 9, 'muda'), { token: 'P', ambito: 'genesis', cantidad: 1, de: 'g', a: 'muda' }] }, kg.privada);
  await assert.rejects(eje.escribir({ autor: 'muda', sobre: eje.genesisId, t: T0, payload: 'x', movimientos: [minuto('muda')] }), /without a key nobody acts: muda has no key/);
  const c = await motor.consolidar(eje, { autor: 'ana', foco: eje.genesisId, t: T0, elecciones: { 1: 'algo' } }, ka.privada);
  assert.equal(motor.puedeAutorizar(eje, 'muda', c.id), false); // tiene P, no tiene clave
  assert.equal(motor.puedeAutorizar(eje, 'g', c.id), true);
  // La capa 3 de un registro escrito a mano por la muda: falla.
  const aMano = await crearEvento({ autor: 'muda', sobre: eje.genesisId, t: T0, payload: 'x', movimientos: [minuto('muda')] });
  assert.match((await validez(eje, aMano)).capas[2].motivos.map((m) => m.texto ?? m).join(' '), /without a key nobody acts: muda has no key/);
  // Demostración: lo mismo entra; la clave sin prueba queda «sin probar», y una prueba mala falla igual.
  const d = await demo(['muda']);
  await escribe(d, 'muda', d.genesisId, 'x');
  const kc = await generarClaves();
  const sinPrueba = await d.escribir({ autor: 'g', sobre: d.genesisId, t: T0, payload: 'alta de cris', movimientos: [minuto('g'), minuto('g', 3, 'cris')], contexto: { claves: { cris: kc.publica } } });
  assert.deepEqual((await validez(d, sinPrueba.id)).capas[2].clavesDeclaradas, [{ identidad: 'cris', por: 'g', posesion: 'sin probar' }]);
  await assert.rejects(d.escribir({ autor: 'g', sobre: d.genesisId, t: T0, payload: 'alta de dani', movimientos: [minuto('g'), minuto('g', 3, 'dani')], contexto: { claves: { dani: kc.publica } } }, undefined, { dani: ka.privada }), /prueba de posesión inválida para dani/);
});

test('R9 firmarPosesion no cambia el id y la forma de posesion se comprueba', async () => {
  const k = await generarClaves();
  const ev = await crearEvento({ autor: 'g', sobre: 'x', t: T0, payload: 'p', movimientos: [minuto('g')] });
  const conPrueba = await firmarPosesion(ev, 'ana', k.privada);
  assert.equal(conPrueba.id, ev.id);
  const eje = await demo([]);
  const mal = { ...(await crearEvento({ autor: 'g', sobre: eje.genesisId, t: T0, payload: 'p', movimientos: [minuto('g')] })), posesion: ['no'] };
  await assert.rejects(eje.anadir(mal), /posesion debe ser un objeto/);
});

// ---------- R10 · ser persona o cosa no da renta ----------

// VG, 10-11, B1: desaparece el tipo. Persona es la identidad que escribe su propia alta; cosa, la que da de alta
// otra identidad, su dueño. La prueba estática de R10 (ningún módulo lee el tipo fuera de unos sitios) se retira: ya
// no hay tipo que leer, y lo que distingue a una persona de una cosa lo dice una regla de la época que lee el 3 del
// alta («only persons mint»). Queda la prueba de comportamiento: ser persona o cosa no cambia lo que se obtiene de
// otros; solo decide quién emite.

test('R10 ser persona o cosa (por quién escribe el alta, B1) no cambia lo que se obtiene de otros (elegir, autorizar)', async () => {
  const mundo = async (tipo) => {
    const eje = await demo(['dueña', 'b'], { b: tipo });
    await eje.escribir({ autor: 'g', sobre: eje.genesisId, t: T0, payload: 'poder', movimientos: [minuto('g'), { token: 'P', ambito: 'genesis', cantidad: 1, de: 'g', a: 'b' }] });
    const r = await escribe(eje, 'dueña', eje.genesisId, ['Mercado', 'ofertas', '=BUSCAR(1)', ['b']]);
    await escribe(eje, 'b', r.id, 'oferta de b', [1]);
    const c = await motor.consolidar(eje, { autor: 'dueña', foco: r.id, t: T0, elecciones: { 1: 'algo' } });
    const v = evaluar(eje, r.id, [2]).valor;
    return { candidatos: v.items.map((i) => [i.origen, i.autor ?? null]), autoriza: motor.puedeAutorizar(eje, 'b', c.id), elegible: elegibles(eje, r.id).autores.has('b') };
  };
  const persona = await mundo('persona');
  // Un grupo no escribe (Core, 8-11: lo suyo lo escribe una persona con P sobre él), así que se compara la cosa.
  assert.deepEqual(await mundo('cosa'), persona);
  assert.deepEqual(persona, { candidatos: [['propio', null], ['escrito', 'b']], autoriza: true, elegible: true });
  // Lo único que decide: quién emite (la regla «only persons mint»). Una cosa no emite.
  const eje = await demo(['b'], { b: 'cosa' });
  await assert.rejects(eje.escribir({ autor: 'b', sobre: eje.genesisId, t: T0, payload: 'x', movimientos: [minuto('b'), { token: 'R', emisor: 'b', cantidad: 1, de: null, a: 'b' }] }), /only persons mint: b is a thing \(its alta was written by g\)/);
});
