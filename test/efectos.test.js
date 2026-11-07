import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ejemploCompra, ejemploCuenta } from '../ejemplos/ikisai/compra-food.mjs';
import { descubrir, consolidar, autorizar, ejecutar, FABRICA, FASES } from '../src/motor.js';
import { Eje } from '../src/eje.js';
import { esDireccion } from '../src/btml.js';
import { FAMILIAS } from '../src/tokens.js';
import { generar } from '../datos/generar-efectos.mjs';
import {
  CATALOGO, TIPOS, FASES as FASES_CON_EFECTO, SIN_NOMBRE, efectosDe, efectosDelEje, verEn, sobrio, render, nombreMundo, claseRelativa,
} from '../src/efectos.js';

const T = '2026-11-07T16:00:00Z';
const X = '[X] decidir VG';
const DE_CELDA = ['ver', 'sustituir', 'escrito', 'anclado', 'impulso', 'modificar'];

function escribe(eje, autor, sobre, en, payload, contexto = {}) {
  return eje.escribir({ autor, sobre, en, t: T, movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: autor, a: null }], payload, contexto });
}

async function cicloCompleto() {
  const { eje, compra } = await ejemploCompra();
  await ejemploCuenta(eje, compra);
  const d = descubrir(eje, compra.id);
  const c = await consolidar(eje, {
    autor: 'huesped', foco: compra.id, t: T, titulo: 'Pago del menú',
    elecciones: { 1: { candidato: d[0].candidatos[3] }, 2: 'sin lactosa', 4: 'pagar 14 EUR' },
  });
  const a = await autorizar(eje, { autorizante: 'casa', consolidacion: c.id, t: T });
  const e = await ejecutar(eje, {
    autor: 'huesped', consolidacion: c.id, t: T,
    movimientos: [{ token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 14, de: 'huesped', a: 'cocina' }],
  });
  return { eje, compra, c, a, e };
}

test('datos/efectos.js está al día con datos/efectos.json', () => {
  const enDisco = readFileSync(new URL('../datos/efectos.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.equal(enDisco, generar(), 'efectos.js desfasado: ejecuta `node datos/generar-efectos.mjs`');
  assert.deepEqual(CATALOGO, JSON.parse(readFileSync(new URL('../datos/efectos.json', import.meta.url), 'utf8')));
  assert.ok(Object.isFrozen(CATALOGO.mundos[1].efectos.impulso));
});

test('el catálogo: diez mundos, las clases de VG, una familia por token, y cada nombre con su fuente o «[X] decidir VG»', () => {
  assert.deepEqual(CATALOGO.mundos.map((m) => m.pv), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(CATALOGO.mundos.map((m) => m.nombre), ['lente', 'ciudad', 'jardín', 'parque', 'fábrica', 'estructura', 'hilos del pasado', 'hilos del futuro', 'cielo', 'camino']);
  assert.deepEqual(CATALOGO.clases.slice(0, 5).map((c) => c.nombre), ['ver/sustituir', 'impulso de recursos', 'criterio', 'comunicación', 'acción']);
  for (const c of CATALOGO.clases.slice(5)) assert.ok(c.nombre === null && c.decision.startsWith(X), 'clase ' + c.clase);
  // Cada familia de tokens tiene mundo y clase (los moduladores del corpus), pendiente de VG.
  assert.deepEqual(Object.keys(CATALOGO.familias).sort(), [...FAMILIAS].sort());
  assert.deepEqual(['E', 'P', 'R', 'T'].map((f) => CATALOGO.familias[f].mundo), [1, 2, 3, 4]);
  assert.ok(CATALOGO.decisionFamilias.startsWith(X));
  // Las fases con efecto son las del motor.
  assert.deepEqual(FASES_CON_EFECTO, FASES);
  const valida = (k) => k === '*' || DE_CELDA.includes(k) || /^modificar\.[2-9]$/.test(k)
    || /^token\.(emitir|mover|consumir)$/.test(k) || (k.startsWith('fase.') && FASES.includes(k.slice(5)));
  for (const m of CATALOGO.mundos) {
    for (const [k, e] of Object.entries(m.efectos)) {
      assert.ok(valida(k), m.nombre + ': clave desconocida ' + k);
      assert.ok(typeof e.nombre === 'string' && e.nombre, m.nombre + '.' + k + ' sin nombre');
      assert.ok(typeof e.metafora === 'string' && e.metafora, m.nombre + '.' + k + ' sin metáfora');
      assert.ok(typeof e.fuente === 'string' && e.fuente, m.nombre + '.' + k + ' sin fuente');
      if (e.decision !== undefined) assert.ok(e.decision.startsWith(X), m.nombre + '.' + k);
    }
    for (const s of m.sinOperacion) assert.ok(s.nombre && s.fuente && s.nota, m.nombre + ': ' + s.nombre);
  }
});

test('cada evento del ejemplo de la compra produce efectos con nombre y mundo', async () => {
  const { eje, compra } = await ejemploCompra();
  await ejemploCuenta(eje, compra);
  assert.equal(eje.orden.length, 5);
  for (const id of eje.orden) {
    const ev = eje.obtener(id);
    const efectos = efectosDe(eje, id);
    assert.ok(efectos.length > 0, 'sin efectos: ' + id.slice(0, 8));
    for (const ef of efectos) {
      assert.equal(ef.evento, id);
      assert.ok(TIPOS.includes(ef.tipo), ef.tipo);
      assert.ok(Number.isInteger(ef.mundo) && ef.mundo >= 0 && ef.mundo <= 9, 'mundo ' + ef.mundo);
      assert.ok(typeof ef.nombre === 'string' && ef.nombre.length > 0, 'nombre');
      assert.ok(esDireccion(ef.celda), 'celda ' + ef.celda);
      assert.ok(Number.isInteger(ef.clase) && ef.clase >= 0 && ef.clase <= 9, 'clase ' + ef.clase);
      if (DE_CELDA.includes(ef.tipo) && Array.isArray(ev.payload)) assert.equal(ef.clase, claseRelativa(ef.celda, ev.en));
    }
    // Todo evento mueve tokens: hay un efecto por movimiento.
    assert.equal(efectos.filter((e) => e.tipo === 'token').length, ev.movimientos.length);
  }
});

test('la compra: qué cambió, de qué clase y cómo se ve en su mundo; las referencias al menú son herencia', async () => {
  const { eje, menu, compra } = await ejemploCompra();
  const efectos = efectosDe(eje, compra);
  assert.deepEqual(sobrio(efectos).split('\n'), [
    'lente · mostrar · 0000000000',
    'ciudad · encarecer o abaratar · 1100000000',
    'ciudad · encarecer o abaratar · 1200000000',
    'parque · hablar · 3000000000',
    'parque · hablar · 3100000000',
    'fábrica · paso · 4000000000',
    'fábrica · paso · 4100000000',
    'fábrica · línea que se mueve · 0000000000',
    'ciudad · mercancía que fluye · 0000000000',
  ]);
  // [1][0] y [2][0] son referencias al menú (el foco): herencia, no efecto.
  assert.deepEqual(compra.payload[1][0], { ref: menu.id, dir: '1000000000' });
  assert.ok(!efectos.some((e) => e.etiqueta === '1.0.0' || e.etiqueta === '2.0.0'));
  // El menú tenía 1.1 y 1.2: la compra los sustituye; 3 y 4 no los tenía: los escribe.
  assert.deepEqual(efectos.filter((e) => e.tipo !== 'token').map((e) => e.etiqueta + ' ' + e.tipo), [
    '0.0.0 sustituir', '1.1.0 sustituir', '1.2.0 sustituir', '3.0.0 escrito', '3.1.0 escrito', '4.0.0 escrito', '4.1.0 escrito',
  ]);
  const pago = efectos.find((e) => e.token === 'E');
  assert.deepEqual(
    { mundo: pago.mundo, clase: pago.clase, movimiento: pago.movimiento, serie: pago.serie, cantidad: pago.cantidad, de: pago.de, a: pago.a },
    { mundo: 1, clase: 1, movimiento: 'mover', serie: 'E:casa/EUR', cantidad: 12, de: 'huesped', a: 'cocina' },
  );
  assert.match(pago.fuente, /flujos de mercancías/);
  assert.equal(pago.decision, undefined); // nombre del corpus
  const tiempo = efectos.find((e) => e.token === 'T');
  assert.deepEqual([tiempo.mundo, tiempo.movimiento, tiempo.serie, tiempo.nombre], [4, 'consumir', 'T:hora', 'línea que se mueve']);
  assert.ok(tiempo.decision.startsWith(X)); // de la big picture, no del corpus
});

test('la clase es el dígito relativo al anclaje: impulso, modificar, y lo que el corpus no nombra', async () => {
  const { eje, compra } = await ejemploCompra();
  const ajuste = await escribe(eje, 'cocina', compra.id, '1000000000', [
    'Ajuste',
    ['nuevo', ['visto', 'propina']],
    [['k0', 'k1', 'k2', 'k3']],
    [['h0', 'h1', 'h2', 'h3', 'h4', 'h5']],
  ]);
  const celdas = efectosDe(eje, ajuste).filter((e) => e.tipo !== 'token');
  const ver = (et) => celdas.find((e) => e.etiqueta === et);
  assert.deepEqual(celdas.map((e) => [e.etiqueta, e.celda, e.tipo, e.mundo, e.nombre]), [
    ['0.0.0', '1000000000', 'sustituir', 0, 'mostrar'],
    ['1.0.0', '1100000000', 'sustituir', 1, 'encarecer o abaratar'],
    ['1.1.0', '1110000000', 'escrito', 1, 'abrir tienda'],
    ['1.1.1', '1111000000', 'impulso', 1, 'mercancía que fluye'],
    ['2.0.0', '1200000000', 'sustituir', 2, 'florecer'],
    ['2.0.1', '1201000000', 'impulso', 2, 'luz'],
    ['2.0.2', '1202000000', 'modificar', 2, 'florecer'],
    ['2.0.3', '1203000000', 'modificar', 2, 'florecer'],
    ['3.0.0', '1300000000', 'escrito', 3, 'hablar'],
    ['3.0.1', '1301000000', 'impulso', 3, 'paquete'],
    ['3.0.2', '1302000000', 'modificar', 3, 'modificar (criterio)'],
    ['3.0.3', '1303000000', 'modificar', 3, 'modificar (comunicación)'],
    ['3.0.4', '1304000000', 'modificar', 3, 'modificar (acción)'],
    ['3.0.5', '1305000000', 'modificar', 3, 'modificar (clase 5)'],
  ]);
  // Relativa, no absoluta: bajo el anclaje 1, la celda 1201000000 es de clase 1 aunque su tercer dígito sea 0.
  assert.equal(ver('2.0.1').clase, 1);
  assert.equal(ver('2.0.1').celda[2], '0');
  assert.equal(claseRelativa('1201000000', '1000000000'), 1);
  assert.equal(claseRelativa('1201000000'), 0);
  // Lo que el parque no nombra sale con su nombre genérico y «[X] decidir VG».
  assert.equal(ver('3.0.5').decision, SIN_NOMBRE);
  assert.equal(ver('3.0.5').metafora, null);
});

test('referencias al foco: herencia, salvo que el registro diga que las ve', async () => {
  const { eje, compra } = await ejemploCompra();
  const r = (dir) => ({ ref: compra.id, dir });
  const tipos = (ev) => efectosDe(eje, ev).filter((e) => e.tipo !== 'token').map((e) => e.etiqueta + ' ' + e.tipo);
  // Sin marcas: las tres primeras son herencia; solo la 3 escribe.
  const sinMarca = await escribe(eje, 'cocina', compra.id, '0000000000', [r('0000000000'), r('1000000000'), r('2000000000'), 'gracias']);
  assert.deepEqual(tipos(sinMarca), ['3.0.0 sustituir']);
  // contexto.vistas (celdas «i.j»): ver es clase 0, y en el parque se llama escuchar.
  const conVista = await escribe(eje, 'cocina', compra.id, '0000000000', [r('0000000000'), r('1000000000'), r('2000000000'), r('3000000000')], { vistas: ['3.0'] });
  const vista = efectosDe(eje, conVista).find((e) => e.tipo === 'ver');
  assert.deepEqual([vista.etiqueta, vista.mundo, vista.clase, vista.nombre], ['3.0.0', 3, 0, 'escuchar']);
  // contexto.heredadas (como la PR #40): lo que no está en la lista se ha visto.
  const conHeredadas = await escribe(eje, 'cocina', compra.id, '0000000000', [r('0000000000'), r('1000000000'), 'propina'], { heredadas: [0] });
  assert.deepEqual(tipos(conHeredadas), ['1.0.0 ver', '2.0.0 sustituir']);
  // Un registro que es solo la referencia a su foco es el registro mínimo de ver.
  const soloVer = await escribe(eje, 'cocina', compra.id, '3000000000', { ref: compra.id });
  assert.deepEqual(efectosDe(eje, soloVer).filter((e) => e.tipo !== 'token').map((e) => [e.tipo, e.mundo, e.nombre]), [['ver', 3, 'escuchar']]);
});

test('terminales: ocupan su posición; sobre algo, sustituyen; donde el foco no llega, anclan', async () => {
  const { eje, menu } = await ejemploCompra();
  const sobreAlgo = await escribe(eje, 'cocina', menu.id, '2000000000', 'sin frutos secos');
  const lejos = await escribe(eje, 'cocina', menu.id, '7000000000', 'vuelve el jueves');
  const muyLejos = await escribe(eje, 'cocina', menu.id, '7310000000', 'ya veremos');
  const celda = (ev) => {
    const e = efectosDe(eje, ev).find((x) => x.tipo !== 'token');
    return [e.tipo, e.mundo, e.celda, e.clase, e.nombre];
  };
  assert.deepEqual(celda(sobreAlgo), ['sustituir', 2, '2000000000', 0, 'florecer']);
  assert.deepEqual(celda(lejos), ['anclado', 7, '7000000000', 0, 'arco al futuro']);
  // Lo escrito va en el PV donde se escribe: el último dígito de su posición.
  assert.deepEqual(celda(muyLejos), ['anclado', 1, '7310000000', 0, 'anclar']);
  // Un array anclado donde el foco no tiene nada: todo lo que trae se ancla.
  const rama = await escribe(eje, 'cocina', menu.id, '6000000000', ['la semana pasada', 'cerrado']);
  assert.deepEqual(efectosDe(eje, rama).filter((e) => e.tipo !== 'token').map((e) => [e.etiqueta, e.tipo, e.nombre]), [
    ['0.0.0', 'anclado', 'mostrar'],
    ['1.0.0', 'anclado', 'anclar'],
  ]);
});

test('el ciclo del motor: consolidar, autorizar y ejecutar son efectos de la fábrica, y cada mundo los ve a su manera', async () => {
  const { eje, c, a, e } = await cicloCompleto();
  const fase = (ev) => efectosDe(eje, ev).find((x) => x.tipo === 'fase');
  assert.deepEqual([c, a, e].map((ev) => [fase(ev).fase, fase(ev).mundo, fase(ev).celda, fase(ev).clase, fase(ev).nombre]), [
    ['consolidado', 4, FABRICA, 0, 'consolidar'],
    ['autorizado', 4, FABRICA, 0, 'autorizar'],
    ['ejecutado', 4, FABRICA, 0, 'ejecutar'],
  ]);
  // La misma operación vista desde otros mundos.
  const vista = (ef, m) => verEn(ef, m)?.nombre ?? null;
  assert.deepEqual([7, 9, 2, 6].map((m) => vista(fase(c), m)), ['arco al futuro', 'previsualizar', 'fructificar', null]);
  assert.deepEqual([6, 7, 9].map((m) => vista(fase(e), m)), ['ancla', 'ancla', 'ejecutar']);
  assert.equal(vista(fase(a), 9), null);
  assert.equal(vista(fase(a), 0), 'mostrar'); // la lente lo muestra todo
  assert.equal(vista(fase(a), 5), 'inspeccionar');
  // La ejecución mueve los EUR reales: mercancía que fluye; su referencia a la consolidación (su foco) es herencia.
  const ejecucion = efectosDe(eje, e);
  assert.ok(ejecucion.some((x) => x.tipo === 'token' && x.serie === 'E:casa/EUR' && x.cantidad === 14 && x.nombre === 'mercancía que fluye'));
  assert.ok(!ejecucion.some((x) => x.etiqueta === '1.0.0'));
  // La consolidación: la elección de recursos (la cuenta) cae en la 1 bajo la fábrica, el criterio nuevo brota.
  assert.deepEqual(efectosDe(eje, c).filter((x) => x.tipo !== 'token' && x.tipo !== 'fase').map((x) => [x.celda, x.mundo, x.tipo]), [
    ['4000000000', 0, 'sustituir'],
    ['4100000000', 1, 'sustituir'],
    ['4200000000', 2, 'escrito'],
    ['4400000000', 4, 'escrito'],
  ]);
});

test('el génesis: escribe la raíz y emite sus series', async () => {
  const { eje } = await ejemploCompra();
  const efectos = efectosDe(eje, eje.genesisId);
  assert.deepEqual(efectos.map((x) => [x.tipo, x.movimiento ?? null, x.token ?? null, nombreMundo(x.mundo), x.nombre]), [
    ['escrito', null, null, 'lente', 'mostrar'],
    ['token', 'emitir', 'T', 'fábrica', 'emitir T'],
    ['token', 'emitir', 'T', 'fábrica', 'emitir T'],
    ['token', 'emitir', 'E', 'ciudad', 'abrir vía'],
    ['token', 'emitir', 'P', 'jardín', 'calor'],
  ]);
  assert.equal(efectos[1].decision, SIN_NOMBRE); // solo el génesis emite T: el corpus no lo nombra
  assert.deepEqual([efectos[3].de, efectos[3].a, efectos[3].serie], [null, 'casa', 'E:casa/EUR']);
});

test('solo del evento: lo mismo desde un eje reconstruido, sin tocar nada', async () => {
  const { eje, c } = await cicloCompleto();
  const antes = JSON.stringify(eje.orden.map((id) => eje.obtener(id)));
  const todos = efectosDelEje(eje);
  assert.equal(todos.length, eje.orden.reduce((n, id) => n + efectosDe(eje, id).length, 0));
  assert.deepEqual(efectosDe(eje, c.id), efectosDe(eje, c));
  const copia = await Eje.desde(JSON.parse(antes));
  assert.deepEqual(efectosDelEje(copia), todos);
  assert.equal(JSON.stringify(eje.orden.map((id) => eje.obtener(id))), antes);
});

test('render sobrio: una línea por efecto, «mundo · efecto · celda»', async () => {
  const { eje } = await cicloCompleto();
  const todos = efectosDelEje(eje);
  const lineas = sobrio(todos).split('\n');
  assert.equal(lineas.length, todos.length);
  for (const l of lineas) assert.match(l, /^[^·]+ · [^·]+ · \d{10}$/);
  assert.equal(render(todos), sobrio(todos));
  const conDetalle = render(todos, 'sobrio', { detalle: true }).split('\n');
  assert.ok(conDetalle.includes('ciudad · mercancía que fluye · 4000000000 · E:casa/EUR 14 huesped→cocina'));
  assert.ok(conDetalle.includes('fábrica · consolidar · 4000000000 · consolidado'));
  assert.ok(conDetalle.includes('jardín · brotar · 4200000000 · 2.0.0 escrito'));
  assert.throws(() => render(todos, 'animado'), /render no disponible/);
  assert.throws(() => nombreMundo(10), /fuera de 0–9/);
});

test('errores: evento o foco desconocidos', async () => {
  const { eje, menu } = await ejemploCompra();
  assert.throws(() => efectosDe(eje, 'desconocido'), /evento desconocido/);
  assert.throws(() => efectosDe(eje, { ...menu, sobre: 'f'.repeat(64) }), /foco desconocido/);
  assert.throws(() => efectosDe(eje, { ...menu, en: '12' }), /anclaje inválido/);
});
