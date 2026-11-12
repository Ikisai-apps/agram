import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ejemploCompra, ejemploCuenta } from '../ejemplos/ikisai/compra-food.mjs';
import { descubrir, consolidar, registrar, siguiente, cerrado, FABRICA, ANUNCIO } from '../src/motor.js';
import { ocupantes } from '../src/encaje.js';
import { Eje } from '../src/eje.js';
import { esDireccion, direccion } from '../src/btml.js';
import { FAMILIAS } from '../src/tokens.js';
import * as indice from '../src/index.js';
import * as efectosModulo from '../src/efectos.js';
import { generar } from '../datos/generar-efectos.mjs';
import {
  CATALOGO, TIPOS_EFECTO, MARCAS_EFECTO, SIN_NOMBRE, efectosDe, efectosDelEje, verEn, sobrio, render, nombreMundo, claseRelativa,
} from '../src/efectos.js';
import { pagaElCoste } from './ayudas-coste.js';

const T = '2026-11-07T16:00:00Z';
const X = '[X] decidir VG';
const DE_CELDA = ['ver', 'sustituir', 'anclado', 'escrito', 'impulso', 'modificar'];
const sinTokens = (efectos) => efectos.filter((e) => e.tipo !== 'token');
const lineas = (efectos) => sinTokens(efectos).map((e) => e.etiqueta + ' ' + e.tipo);

function escribe(eje, autor, sobre, en, payload, contexto = {}) {
  return eje.escribir({ autor, sobre, en, t: T, movimientos: [pagaElCoste(autor)], payload, contexto });
}

// Encargo 3b (VG, 8-11; mapa §15 [D] «Una sola operación: registrar»; N6: «los mundos animan registros anclados y
// movimientos; las fases las nombra el proceso»): el motor ya no escribe autorizaciones ni ejecuciones. Lo único que
// registra en la fábrica es la propuesta (consolidar); lo demás son registros con sus movimientos: el anuncio en el
// 4.1 de la propuesta (motor.ANUNCIO) y el pago que lo cumple (motor.siguiente). Que esté cerrada es una lectura
// (motor.cerrado), no una fase escrita.

/** Lo único que el motor registra en la fábrica (src/efectos.js, FASES_MOTOR). */
const FASES = ['consolidado'];

/** La compra con su cuenta, una propuesta de la huésped, su anuncio (pagar 14 EUR a la cocina) y el pago. */
async function cicloCompleto() {
  const { eje, menu, compra } = await ejemploCompra();
  await ejemploCuenta(eje, compra);
  const d = descubrir(eje, compra.id);
  const c = await consolidar(eje, {
    autor: 'huesped', foco: compra.id, t: T, titulo: 'Pago del menú',
    elecciones: { 1: { candidato: d[0].candidatos[3] }, 2: 'sin lactosa', 4: 'pagar 14 EUR' },
  });
  const a = await registrar(eje, {
    autor: 'huesped', sobre: c.id, en: ANUNCIO, t: T, payload: [['E:casa/EUR'], [14], ['pagar'], [['huesped'], ['cocina']]],
    movimientos: [pagaElCoste('huesped')],
  });
  const e = await registrar(eje, { ...siguiente(eje, c.id, 'huesped').faltaDeMi[0].transaccion, t: T });
  return { eje, menu, compra, c, a, e };
}

test('datos/efectos.js está al día con datos/efectos.json', () => {
  const enDisco = readFileSync(new URL('../datos/efectos.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.equal(enDisco, generar(), 'efectos.js desfasado: ejecuta `node datos/generar-efectos.mjs`');
  assert.deepEqual(CATALOGO, JSON.parse(readFileSync(new URL('../datos/efectos.json', import.meta.url), 'utf8')));
  assert.ok(Object.isFrozen(CATALOGO.mundos[1].efectos.impulso));
});

test('el catálogo: diez mundos, las clases de VG, una familia por token, y cada nombre con su fuente y su «[X] decidir VG»', () => {
  assert.deepEqual(CATALOGO.mundos.map((m) => m.pv), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(CATALOGO.mundos.map((m) => m.nombre), ['lente', 'ciudad', 'jardín', 'parque', 'fábrica', 'estructura', 'hilos del pasado', 'hilos del futuro', 'cielo', 'camino']);
  assert.deepEqual(CATALOGO.clases.slice(0, 5).map((c) => c.nombre), ['ver/sustituir', 'impulso de recursos', 'criterio', 'comunicación', 'acción']);
  for (const c of CATALOGO.clases.slice(5)) assert.ok(c.nombre === null && c.decision.startsWith(X), 'clase ' + c.clase);
  assert.deepEqual(Object.keys(CATALOGO.familias).sort(), [...FAMILIAS].sort());
  assert.deepEqual(['E', 'P', 'R', 'T'].map((f) => CATALOGO.familias[f].mundo), [1, 2, 3, 4]);
  // Cada marca es un «[X] decidir VG», y cada tipo de efecto tiene su genérico.
  for (const [k, m] of Object.entries(MARCAS_EFECTO)) assert.ok(m.startsWith(X), 'marca ' + k);
  assert.equal(SIN_NOMBRE, MARCAS_EFECTO.sinNombre);
  assert.deepEqual(Object.keys(CATALOGO.tipos).sort(), [...TIPOS_EFECTO].sort());
  // Las fases con efecto son las del motor. Encargo 3b: el motor solo registra «consolidado»; el catálogo
  // (datos/efectos.json) aún nombra «autorizado» y «ejecutado», que ya no se producen (el jardín usa el nombre de
  // «ejecutado» para el fruto de una propuesta cerrada). Se comprueba que no hay más que esas, y queda informado.
  const RETIRADAS = ['autorizado', 'ejecutado'];
  assert.deepEqual(Object.keys(CATALOGO.tipos.fase.generico), [...FASES, ...RETIRADAS]);
  const valida = (k) => k === '*' || DE_CELDA.includes(k) || /^modificar\.[2-9]$/.test(k)
    || /^token\.(emitir|mover|consumir)$/.test(k) || (k.startsWith('fase.') && [...FASES, ...RETIRADAS].includes(k.slice(5)));
  for (const m of CATALOGO.mundos) {
    for (const [k, e] of Object.entries(m.efectos)) {
      assert.ok(valida(k), m.nombre + ': clave desconocida ' + k);
      assert.ok(typeof e.nombre === 'string' && e.nombre, m.nombre + '.' + k + ' sin nombre');
      assert.ok(typeof e.metafora === 'string' && e.metafora, m.nombre + '.' + k + ' sin metáfora');
      assert.ok(typeof e.fuente === 'string' && e.fuente, m.nombre + '.' + k + ' sin fuente');
      // El emparejamiento operación ↔ nombre está abierto: también las palabras del corpus llevan su marca.
      assert.ok(typeof e.decision === 'string' && e.decision.startsWith(X + ': emparejamiento propuesto'), m.nombre + '.' + k);
    }
    for (const s of m.sinOperacion) assert.ok(s.nombre && s.fuente && s.nota, m.nombre + ': ' + s.nombre);
  }
  // La metáfora genérica de emitir en la ciudad no es la del ejemplo de Booking.
  assert.doesNotMatch(CATALOGO.mundos[1].efectos['token.emitir'].metafora, /plaza|noche/);
});

test('todo efecto es coherente: su clase es la de su celda vista desde su marco, y lleva sus marcas', async () => {
  const { eje } = await cicloCompleto();
  let celdas = 0;
  for (const id of eje.orden) {
    const ev = eje.obtener(id);
    const efectos = efectosDe(eje, id);
    assert.ok(efectos.length > 0, 'sin efectos: ' + id.slice(0, 8));
    for (const ef of efectos) {
      assert.equal(ef.evento, id);
      assert.ok(TIPOS_EFECTO.includes(ef.tipo), ef.tipo);
      assert.ok(Number.isInteger(ef.mundo) && ef.mundo >= 0 && ef.mundo <= 9, 'mundo ' + ef.mundo);
      assert.ok(typeof ef.nombre === 'string' && ef.nombre.length > 0, 'nombre');
      assert.ok(Array.isArray(ef.decisiones) && ef.decisiones.length > 0 && ef.decisiones.every((d) => d.startsWith(X)), 'decisiones de ' + ef.tipo);
      assert.ok(Number.isInteger(ef.clase) && ef.clase >= 0 && ef.clase <= 9, 'clase ' + ef.clase);
      if (ef.tipo === 'token') {
        assert.equal(ef.celda, null);
        assert.ok(ef.decisiones.includes(MARCAS_EFECTO.familia));
        continue;
      }
      // Toda celda, sea de un terminal, de un array o del motor: sin excepciones.
      celdas++;
      assert.ok(esDireccion(ef.celda), 'celda ' + ef.celda);
      assert.equal(ef.celda, direccion(ef.camino));
      assert.equal(ef.clase, claseRelativa(ef.celda, ef.marco));
      assert.equal(ef.mundo, ef.posicion);
      assert.equal(ef.posicion, ef.camino[ef.marco.length] ?? 0);
      if (ef.ruta.length) assert.ok(ef.decisiones.includes(MARCAS_EFECTO.matriz), 'celda de dentro sin la marca de la matriz');
    }
    assert.equal(efectos.filter((e) => e.tipo === 'token').length, ev.movimientos.length);
  }
  assert.ok(celdas > 15); // por hojas, una lista es una sola celda
});

test('la compra: el registro colisiona en la raíz del menú; lo de dentro va celda a celda, con su marca; las referencias al menú son herencia', async () => {
  const { eje, menu, compra } = await ejemploCompra();
  const efectos = efectosDe(eje, compra);
  assert.deepEqual(sobrio(efectos).split('\n'), [
    'lente · mostrar · 0000000000',
    'ciudad · abrir tienda · 1100000000',
    'ciudad · abrir tienda · 1200000000',
    // Encargo 3b: la 2 de la compra lleva, además de la referencia al menú, la plantilla de cerrado que nombra
    // (mapa §15 [D] N5): una lista con un terminal propio, una celda.
    'jardín · brotar · 2000000000',
    'parque · hablar · 3000000000',
    'fábrica · paso · 4000000000', // VG, 7-11 noche: por hojas. La 3 y la 4 son listas: una celda cada una, sin 3.1 ni 4.1
    'estructura · inspeccionar · 5000000000', // encargo 3c-1: su 5 nombra su plantilla, «purchase»
    'fábrica · línea que se mueve · T:hora',
    'ciudad · mercancía que fluye · E:casa/EUR',
  ]);
  // El registro entero ocupa la raíz del menú, donde ya estaban el menú y su representación: colisiona.
  const [registro] = efectos;
  assert.deepEqual([registro.tipo, registro.ruta, registro.colisiona], ['sustituir', [], 2]);
  assert.deepEqual(registro.con.map((o) => [o.origen, o.evento, o.camino]), [['propio', menu.id, []], ['propio', menu.id, [0]]]);
  assert.equal(registro.con.length, ocupantes(eje, menu.id, []).filter((o) => o.origen !== 'escrito').length);
  // Lo de dentro no colisiona con las celdas del menú: el núcleo no lo cuenta como ocupante.
  // VG, 7-11 noche: por hojas: la 1 del menú es una lista; sus platos son ocupantes de la 1, y la 1.1 no existe.
  assert.deepEqual(ocupantes(eje, menu.id, [1]).map((o) => [o.origen, o.contenido]), [['propio', 'ensalada'], ['propio', 'guiso'], ['propio', 'fruta']]);
  assert.deepEqual(ocupantes(eje, menu.id, [1, 1]), []);
  assert.deepEqual(lineas(efectos), ['0.0.0 sustituir', '1.1.0 escrito', '1.2.0 escrito', '2.0.0 escrito', '3.0.0 escrito', '4.0.0 escrito', '5.0.0 escrito']); // 5: su plantilla (encargo 3c-1)
  for (const e of sinTokens(efectos).slice(1)) assert.ok(e.decisiones.includes(MARCAS_EFECTO.matriz));
  // En la raíz no hay duda de marco; [1][0][0] y [2][0] son referencias al menú: herencia, no efecto.
  // VG, 7-11 noche: por hojas: la 1.0 de la compra es la lista de uno [ref menú:1] (cada posición entre corchetes).
  assert.ok(!registro.decisiones.includes(MARCAS_EFECTO.marco));
  assert.deepEqual(compra.payload[1][0], [{ ref: menu.id, dir: '1000000000' }]);
  assert.deepEqual(compra.payload[2][0], { ref: menu.id, dir: '2000000000' });
  assert.ok(!efectos.some((e) => e.etiqueta === '1.0.0'));
  // La 2 sí tiene efecto, pero por su terminal (la plantilla de cerrado), no por la referencia al menú.
  assert.deepEqual(compra.payload[2][1], 'all announced movements happened');
  // Los movimientos van entre carteras, en el mundo de su familia, con su marca.
  const pago = efectos.find((e) => e.token === 'E');
  assert.deepEqual(
    { mundo: pago.mundo, celda: pago.celda, clase: pago.clase, movimiento: pago.movimiento, serie: pago.serie, cantidad: pago.cantidad, de: pago.de, a: pago.a },
    { mundo: 1, celda: null, clase: 1, movimiento: 'mover', serie: 'E:casa/EUR', cantidad: 12, de: 'huesped', a: 'cocina' },
  );
  assert.match(pago.fuente, /flujos de mercancías/);
  assert.deepEqual(pago.decisiones, [CATALOGO.mundos[1].efectos['token.mover'].decision, MARCAS_EFECTO.familia]);
  const tiempo = efectos.find((e) => e.token === 'T');
  assert.deepEqual([tiempo.mundo, tiempo.movimiento, tiempo.serie, tiempo.nombre], [4, 'consumir', 'T:hora', 'línea que se mueve']);
  assert.match(tiempo.decisiones[0], /big picture/);
});

test('colisión como en el núcleo: un registro ocupa su dirección entera y colisiona con lo que había antes', async () => {
  const { eje, menu } = await ejemploCompra();
  const registro = async (en, payload) => efectosDe(eje, await escribe(eje, 'cocina', menu.id, en, payload))[0];
  // Donde el menú tiene sus platos, un registro colisiona con ellos. VG, 7-11 noche: por hojas: la 1 del menú es
  // la lista ['ensalada', 'guiso', 'fruta'], tres ocupantes en la 1 (no hay 1.1 por dirección).
  const precio = await registro('1000000000', 'más caro');
  assert.deepEqual([precio.tipo, precio.mundo, precio.colisiona], ['sustituir', 1, 3]);
  assert.deepEqual(precio.con.map((o) => [o.origen, o.camino]), [['propio', [1]], ['propio', [1]], ['propio', [1]]]);
  assert.equal(precio.nombre, 'encarecer o abaratar');
  // Dos registros en 7, donde el menú no llega: el primero ancla, el segundo colisiona con el primero.
  const primero = await escribe(eje, 'cocina', menu.id, '7000000000', 'vuelve el jueves');
  const segundo = await escribe(eje, 'cocina', menu.id, '7000000000', 'o el viernes');
  assert.equal(ocupantes(eje, menu.id, [7]).length, 2);
  const [a, b] = [efectosDe(eje, primero)[0], efectosDe(eje, segundo)[0]];
  assert.deepEqual([a.tipo, a.colisiona, a.nombre], ['anclado', 0, 'arco al futuro']);
  assert.deepEqual([b.tipo, b.colisiona, b.con[0].evento, b.nombre], ['sustituir', 1, primero.id, 'arco al futuro']);
  // Lo escrito después no cambia el efecto de lo anterior: el primero sigue anclando.
  assert.equal(efectosDe(eje, primero)[0].tipo, 'anclado');
});

test('un solo marco para terminales y arrays: la misma celda da el mismo mundo, y el camino exacto distingue 1, 1.0 y 1.0.0', async () => {
  const { eje, menu, compra } = await ejemploCompra();
  const registro = async (en, payload) => efectosDe(eje, await escribe(eje, 'cocina', menu.id, en, payload));
  const terminal = (await registro('1000000000', 'x'))[0];
  const conArray = await registro('1000000000', ['x', 'y']);
  const campos = (e) => [e.mundo, e.celda, e.clase, e.camino, e.marco, e.ruta];
  assert.deepEqual(campos(terminal), [1, '1000000000', 0, [1], [], []]);
  assert.deepEqual(campos(conArray[0]), campos(terminal));
  // La posición 0 de un array es su representación: colisiona con el registro y no da efecto aparte.
  assert.deepEqual(lineas(conArray), ['1.0.0 sustituir', '1.1.0 escrito']);
  assert.equal(conArray[1].mundo, 1);
  // Lo escrito fuera de la raíz lleva la marca del marco: el registro no guarda desde qué camino se escribió.
  assert.ok(terminal.decisiones.includes(MARCAS_EFECTO.marco));
  // §13 desde la raíz: 7310000000 es la celda 7.3.1, de clase 1, en los hilos del futuro.
  const lejos = (await registro('7310000000', 'ya veremos'))[0];
  assert.deepEqual([lejos.tipo, lejos.mundo, lejos.subposicion, lejos.clase, lejos.etiqueta], ['impulso', 7, 3, 1, '7.3.1']);
  assert.equal(lejos.clase, claseRelativa('7310000000'));
  // Más hondo que la clase, todo es contenido de la celda: un array anclado en 7.3.1 no da celdas aparte.
  assert.deepEqual(lineas(await registro('7310000000', ['a', 'b'])), ['7.3.1 impulso']);
  // Tres registros en la raíz de la compra con algo en 1, 1.0 y 1.0.0: misma celda, caminos distintos.
  const en1 = async (payload) => efectosDe(eje, await escribe(eje, 'cocina', compra.id, '0000000000', ['Nota', payload])).find((e) => e.ruta.length);
  // VG, 7-11 noche: por hojas. Solo hojas bajo la raíz es una lista, una celda: para bajar a la 1.0 y la 1.0.0 hacen falta décuplas.
  const caminos = [await en1('uno'), await en1([['uno'], ['dos']]), await en1([[['uno'], ['dos']]])];
  assert.deepEqual(caminos.map((e) => [e.celda, e.camino]), [['1000000000', [1]], ['1000000000', [1, 0]], ['1000000000', [1, 0, 0]]]);
});

test('la clase de una celda de dentro: impulso, modificar, y lo que el corpus no nombra', async () => {
  const { eje, compra } = await ejemploCompra();
  const ajuste = await escribe(eje, 'cocina', compra.id, '0000000000', [
    'Ajuste',
    // VG, 7-11 noche: por hojas. Décuplas con cada posición entre corchetes, para que cada hoja sea su propia celda.
    [['nuevo'], ['propina']],
    [[['k0'], ['k1'], ['k2'], ['k3']]],
    [[['h0'], ['h1'], ['h2'], ['h3'], ['h4'], ['h5']]],
  ]);
  const celdas = sinTokens(efectosDe(eje, ajuste)).slice(1);
  const ver = (et) => celdas.find((e) => e.etiqueta === et);
  assert.deepEqual(celdas.map((e) => [e.etiqueta, e.tipo, e.mundo, e.nombre]), [
    ['1.0.0', 'escrito', 1, 'abrir tienda'],
    ['1.1.0', 'escrito', 1, 'abrir tienda'],
    ['2.0.0', 'escrito', 2, 'brotar'],
    ['2.0.1', 'impulso', 2, 'luz'],
    ['2.0.2', 'modificar', 2, 'florecer'],
    ['2.0.3', 'modificar', 2, 'florecer'],
    ['3.0.0', 'escrito', 3, 'hablar'],
    ['3.0.1', 'impulso', 3, 'paquete'],
    ['3.0.2', 'modificar', 3, 'modificar (criterio)'],
    ['3.0.3', 'modificar', 3, 'modificar (comunicación)'],
    ['3.0.4', 'modificar', 3, 'modificar (acción)'],
    ['3.0.5', 'modificar', 3, 'modificar (clase 5)'],
  ]);
  // Lo que el parque no nombra sale con su nombre genérico y «[X] decidir VG»; la clase 5 trae además la suya.
  assert.deepEqual(ver('3.0.5').decisiones, [SIN_NOMBRE, CATALOGO.clases[5].decision, MARCAS_EFECTO.matriz]);
  assert.equal(ver('3.0.5').metafora, null);
  // Relativa al marco, no absoluta; el marco es exacto: [1, 0] no es [1].
  assert.equal(claseRelativa('1201000000', [1]), 1);
  assert.equal(claseRelativa('1201000000', '1000000000'), 1);
  assert.equal(claseRelativa('1201000000'), 0);
  assert.equal(claseRelativa('1020300000', [1, 0]), 3);
  assert.equal(claseRelativa('1020300000', '1000000000'), 0);
  assert.throws(() => claseRelativa('2000000000', [1]), /no está bajo el marco/);
  assert.throws(() => claseRelativa('2000000000', [1, 12]), /lista de índices/);
});

test('referencias al foco: herencia, salvo que el registro diga que las ve', async () => {
  const { eje, compra } = await ejemploCompra();
  const r = (dir) => ({ ref: compra.id, dir });
  const tipos = (ev) => lineas(efectosDe(eje, ev)).slice(1);
  // Sin marcas: las referencias son herencia; solo la 3 escribe.
  const sinMarca = await escribe(eje, 'cocina', compra.id, '0000000000', ['Nota', r('1000000000'), r('2000000000'), 'gracias']);
  assert.deepEqual(tipos(sinMarca), ['3.0.0 escrito']);
  // contexto.vistas (rutas «i.j»): ver es clase 0, y en el parque se llama escuchar.
  const conVista = await escribe(eje, 'cocina', compra.id, '0000000000', ['Nota', r('1000000000'), r('2000000000'), r('3000000000')], { vistas: ['3.0'] });
  const vista = efectosDe(eje, conVista).find((e) => e.tipo === 'ver');
  assert.deepEqual([vista.etiqueta, vista.mundo, vista.clase, vista.nombre], ['3.0.0', 3, 0, 'escuchar']);
  // contexto.heredadas (como la PR #40): lo que no está en la lista se ha visto.
  const conHeredadas = await escribe(eje, 'cocina', compra.id, '0000000000', [r('0000000000'), r('1000000000'), 'propina'], { heredadas: [0] });
  assert.deepEqual(tipos(conHeredadas), ['1.0.0 ver', '2.0.0 escrito']);
  // Un registro que es solo la referencia a su foco es el registro mínimo de ver.
  const soloVer = await escribe(eje, 'cocina', compra.id, '3000000000', { ref: compra.id });
  assert.deepEqual(sinTokens(efectosDe(eje, soloVer)).map((e) => [e.tipo, e.mundo, e.nombre]), [['ver', 3, 'escuchar']]);
});

test('el ciclo del motor: la propuesta es la única fase, sin leer su payload como celdas; lo demás son registros y movimientos', async () => {
  const { eje, compra, c, a, e } = await cicloCompleto();
  const deMotor = (ev) => sinTokens(efectosDe(eje, ev));
  // La propuesta: una sola fase, sin «jardín · brotar» ni «fábrica · paso» por su payload.
  assert.equal(deMotor(c).length, 1);
  const fase = (ev) => deMotor(ev)[0];
  assert.deepEqual([fase(c).tipo, fase(c).fase, fase(c).mundo, fase(c).celda, fase(c).clase, fase(c).nombre], ['fase', 'consolidado', 4, FABRICA, 0, 'consolidar']);
  assert.ok(fase(c).decisiones.includes(MARCAS_EFECTO.claseFase));
  // Antes, la autorización y la ejecución eran fases del motor. Encargo 3b (N6): el anuncio es un registro anclado en
  // el 4.1 de la propuesta, que se lee celda a celda, y el pago, un registro anclado en el 4 del anuncio que cumple (VG
  // 12-11, decisión 8; #48) con sus movimientos. Ninguno es una fase; que la propuesta esté cerrada es una lectura
  // (motor.cerrado).
  assert.ok(![a, e].some((ev) => efectosDe(eje, ev).some((x) => x.tipo === 'fase' || x.tipo === 'ruido')));
  assert.deepEqual([fase(a).tipo, fase(a).celda, fase(a).nombre], ['anclado', ANUNCIO, 'anclar']);
  assert.deepEqual([e.sobre, deMotor(e).map((x) => [x.tipo, x.celda, x.nombre])], [a.id, [['anclado', FABRICA, 'anclar']]]);
  assert.equal(cerrado(eje, c.id).cerrado, true);
  // La consolidación dice qué fijó en cada posición del foco, sin animarlo aparte.
  assert.deepEqual(fase(c).elecciones.map((x) => [x.posicion, x.celda, x.desde]), [
    [1, '1000000000', 'elegida'], [2, '2000000000', 'nueva'], [3, '3000000000', 'heredada'], [4, '4000000000', 'nueva'],
  ]);
  assert.equal(fase(c).elecciones[2].ref, compra.id);
  // La misma operación vista desde otros mundos.
  const vista = (ef, m) => verEn(ef, m)?.nombre ?? null;
  assert.deepEqual([7, 9, 2, 6].map((m) => vista(fase(c), m)), ['arco al futuro', 'previsualizar', 'fructificar', null]);
  assert.equal(vista(fase(c), 0), 'mostrar'); // la lente lo muestra todo
  assert.equal(vista(fase(c), 5), 'inspeccionar');
  assert.ok(verEn(fase(c), 7).decisiones[0].startsWith(X));
  // El pago mueve los EUR reales: mercancía que fluye.
  assert.ok(efectosDe(eje, e).some((x) => x.tipo === 'token' && x.serie === 'E:casa/EUR' && x.cantidad === 14 && x.nombre === 'mercancía que fluye'));
});

// Antes: autorizaciones y ejecuciones que el motor no reconocía (sin P bloqueado, forjadas, con la evidencia rota, una
// segunda vez) eran ruido. Encargo 3b (mapa §15 [D]; N6: «las fases las nombra el proceso»): no hay esas fases. Lo que
// se comprueba ahora: una fase escrita a mano no cuenta; el catálogo lee el registro por lo que es.
test('una fase escrita a mano no es una transición: se lee por lo que es; fuera de la fábrica, ruido con su motivo', async () => {
  const { eje, compra } = await ejemploCompra();
  const c = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: T, elecciones: { 1: 'algo' } });
  const motor = (autor, sobre, en, fase, payload, contexto = {}) => escribe(eje, autor, sobre, en, payload, { motor: 'fabrica', fase, ...contexto });
  const solo = (ev) => {
    const r = sinTokens(efectosDe(eje, ev));
    assert.equal(r.length, 1);
    return r[0];
  };
  // Un registro del motor en la fábrica de la propuesta es otra propuesta sobre ella, diga la fase que diga, sea
  // quien sea quien lo escriba: «consolidado», no «autorizado» ni «ejecutado».
  for (const [autor, fase] of [['cocina', 'autorizado'], ['huesped', 'autorizado'], ['cocina', 'ejecutado'], ['huesped', 'ejecutado']]) {
    const r = solo(await motor(autor, c.id, FABRICA, fase, '==' + fase));
    assert.deepEqual([r.tipo, r.fase, r.mundo, r.celda, r.nombre], ['fase', 'consolidado', 4, FABRICA, 'consolidar'], autor + ' ' + fase);
  }
  // Sin contexto del motor, la fase escrita no es nada: un registro más, celda a celda.
  const aMano = solo(await escribe(eje, 'cocina', c.id, FABRICA, '==autorizo', { fase: 'autorizado' }));
  assert.deepEqual([aMano.tipo, aMano.celda], ['sustituir', FABRICA]);
  // Nada de eso cierra ni abre la propuesta: sin nada anunciado, está cerrada (N5).
  assert.equal(cerrado(eje, c.id).cerrado, true);
  // Una «consolidación» fuera de la posición 4 no la lista el motor: ruido, con su motivo.
  const fuera = await motor('huesped', compra.id, '7000000000', 'consolidado', ['Fuera', 'algo']);
  const r = solo(fuera);
  assert.deepEqual([r.tipo, r.fase, r.motivo, r.mundo, r.celda, r.nombre], ['ruido', 'consolidado', 'fuera de la fábrica: el motor consolida en la posición 4 de su camino', 7, '7000000000', 'ruido']);
  assert.ok(r.decisiones.includes(SIN_NOMBRE));
  assert.deepEqual([6, 7].map((m) => verEn(r, m)), [null, null]);
  // Los tokens del ruido sí se movieron: salen como siempre.
  assert.equal(efectosDe(eje, fuera).filter((x) => x.tipo === 'token').length, 1);
});

// Antes: una autorización contaba o no según el P de ahora, y su efecto lo seguía. Encargo 3b (mapa §15 [D]; N6): el
// estado es una lectura del eje de ahora (motor.cerrado) y el efecto de la propuesta no cambia con él.
test('el estado se lee con el eje de ahora; el efecto de la propuesta no cambia al cerrarse', async () => {
  const { eje, compra } = await ejemploCompra();
  const c = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: T, elecciones: { 1: 'algo' } });
  const antes = efectosDe(eje, c.id);
  assert.equal(cerrado(eje, c.id).cerrado, true, 'sin nada anunciado');
  await registrar(eje, {
    autor: 'huesped', sobre: c.id, en: ANUNCIO, t: T, payload: [['E:casa/EUR'], [5], ['pagar'], [['huesped'], ['cocina']]],
    movimientos: [pagaElCoste('huesped')],
  });
  assert.equal(cerrado(eje, c.id).cerrado, false, 'con un pago anunciado y sin hacer');
  assert.deepEqual(efectosDe(eje, c.id), antes);
  const pago = await registrar(eje, { ...siguiente(eje, c.id, 'huesped').faltaDeMi[0].transaccion, t: T });
  assert.equal(cerrado(eje, c.id).cerrado, true);
  assert.deepEqual(efectosDe(eje, c.id), antes);
  assert.ok(!efectosDe(eje, pago).some((x) => x.tipo === 'fase'), 'el pago no es una fase: es un registro con su movimiento');
});

test('el génesis: escribe la raíz; su emisión inicial emite sus series', async () => {
  const { eje } = await ejemploCompra();
  // Encargo 3b: el génesis es la época 0, sin movimientos (ni P del génesis: P se obtiene, mapa §15 [D]).
  assert.deepEqual(efectosDe(eje, eje.genesisId).map((x) => [x.tipo, x.celda, nombreMundo(x.mundo), x.nombre]), [['escrito', '0000000000', 'lente', 'mostrar']]);
  // Lo que emite va en la segunda transacción, «Emisión inicial de casa»: gasta su minuto y emite R (antes de E) y E.
  const emision = eje.sobre(eje.genesisId).find((x) => Array.isArray(x.payload) && x.payload[0] === 'Emisión inicial de casa');
  const efectos = efectosDe(eje, emision.id);
  assert.deepEqual(efectos.map((x) => [x.tipo, x.movimiento ?? null, x.serie ?? x.celda, nombreMundo(x.mundo), x.nombre]), [
    ['sustituir', null, '0000000000', 'lente', 'mostrar'],
    ['token', 'consumir', 'T:minuto', 'fábrica', 'línea que se mueve'],
    ['token', 'emitir', 'R:casa', 'parque', 'emitir R'],
    ['token', 'emitir', 'E:casa/EUR', 'ciudad', 'abrir vía'],
  ]);
  assert.deepEqual([efectos[3].de, efectos[3].a], [null, 'casa']);
});

test('lo mismo desde un eje reconstruido, sin tocar nada', async () => {
  const { eje, c } = await cicloCompleto();
  const antes = JSON.stringify(eje.orden.map((id) => eje.obtener(id)));
  const todos = efectosDelEje(eje);
  assert.equal(todos.length, eje.orden.reduce((n, id) => n + efectosDe(eje, id).length, 0));
  assert.deepEqual(efectosDe(eje, c.id), efectosDe(eje, c));
  const copia = await Eje.desde(JSON.parse(antes));
  assert.deepEqual(efectosDelEje(copia), todos);
  assert.equal(JSON.stringify(eje.orden.map((id) => eje.obtener(id))), antes);
});

test('render sobrio: una línea por efecto, «mundo · efecto · lugar»; el lugar de un movimiento es su serie', async () => {
  const { eje } = await cicloCompleto();
  const todos = efectosDelEje(eje);
  const filas = sobrio(todos).split('\n');
  assert.equal(filas.length, todos.length);
  todos.forEach((e, i) => assert.match(filas[i], e.tipo === 'token' ? /^[^·]+ · [^·]+ · [EPRT]:\S+$/ : /^[^·]+ · [^·]+ · \d{10}$/));
  assert.equal(render(todos), sobrio(todos));
  const conDetalle = render(todos, 'sobrio', { detalle: true }).split('\n');
  assert.ok(conDetalle.includes('ciudad · mercancía que fluye · E:casa/EUR · 14 huesped→cocina'));
  assert.ok(conDetalle.includes('fábrica · consolidar · 4000000000 · consolidado'));
  assert.ok(conDetalle.includes('ciudad · encarecer o abaratar · 1000000000 · registro 1.0.0 sustituir'));
  assert.ok(!conDetalle.some((l) => l.includes('4200000000')), 'la consolidación no se lee celda a celda');
  assert.throws(() => render(todos, 'animado'), /render no disponible/);
  assert.throws(() => nombreMundo(10), /fuera de 0–9/);
});

test('los nombres del módulo no chocan con los del índice', () => {
  const planos = new Set(Object.keys(indice));
  const propios = Object.keys(efectosModulo);
  assert.deepEqual(propios.filter((n) => planos.has(n)), []);
  assert.ok(!propios.includes('TIPOS') && !propios.includes('FASES'));
});

test('errores: evento o foco desconocidos', async () => {
  const { eje, menu } = await ejemploCompra();
  assert.throws(() => efectosDe(eje, 'desconocido'), /evento desconocido/);
  assert.throws(() => efectosDe(eje, { ...menu, sobre: 'f'.repeat(64) }), /foco desconocido/);
  assert.throws(() => efectosDe(eje, { ...menu, en: '12' }), /anclaje inválido/);
});

test('marco de quien mira: un registro anclado en el camino se lee desde él, con la clase en el dígito n+2', async () => {
  const { eje, compra } = await ejemploCompra();
  const gasto = { token: 'T', escala: 'minuto', cantidad: 4, de: 'huesped', a: null };
  const bajo = await eje.escribir({
    autor: 'huesped', sobre: compra.id, en: '1000000000', t: T, movimientos: [gasto],
    payload: [{ ref: compra.id, dir: '1000000000' }, [{ ref: compra.id, dir: '1100000000' }, [['ver'], ['impulso']]]],
  });
  const celdas = (efectos) => efectos.filter((e) => DE_CELDA.includes(e.tipo)).map((e) => `${e.etiqueta}:${e.tipo}`);
  // Sin marco, desde la raíz: hasta la profundidad 3, la clase es el tercer dígito de la dirección.
  const raiz = efectosDe(eje, bajo.id);
  assert.deepEqual(celdas(raiz), ['1.0.0:sustituir', '1.1.1:impulso']);
  // Desde [1]: hasta la profundidad 3 tras el marco; 1.1.1.1 es la celda 1.1.1 de la matriz de la posición 1 (clase 1).
  const uno = efectosDe(eje, bajo.id, { marco: [1] });
  assert.deepEqual(celdas(uno), ['0.0.0:sustituir', '1.1.0:escrito', '1.1.1:impulso']);
  for (const ef of uno.filter((e) => e.tipo !== 'token')) {
    assert.deepEqual(ef.marco, [1]);
    assert.equal(ef.clase, claseRelativa(ef.celda, ef.marco));
    assert.ok(ef.decisiones.includes(MARCAS_EFECTO.marcoLectura));
    assert.ok(!ef.decisiones.includes(MARCAS_EFECTO.marco));
  }
  assert.deepEqual(efectosDe(eje, bajo.id, { marco: '1000000000' }), uno);
  // Fuera del marco, o con un marco exacto que no lo contiene ([1, 0] no es [1]), se lee desde la raíz.
  assert.deepEqual(efectosDe(eje, bajo.id, { marco: [2] }), raiz);
  assert.deepEqual(efectosDe(eje, bajo.id, { marco: [1, 0] }), raiz);
  assert.deepEqual(efectosDe(eje, bajo.id, { marco: [] }), raiz);
  assert.throws(() => efectosDe(eje, bajo.id, { marco: [1, 12] }), /lista de índices/);
});

test('marco de quien mira: las fases del motor no cambian', async () => {
  const { eje } = await cicloCompleto();
  let fases = 0;
  for (const id of eje.orden) {
    // Encargo 3b: los registros del motor son las propuestas (contexto.motor = fabrica); ya no hay fases escritas.
    if (eje.obtener(id).contexto?.motor !== 'fabrica') continue;
    fases++;
    assert.deepEqual(efectosDe(eje, id, { marco: [4] }), efectosDe(eje, id));
  }
  assert.equal(fases, 1);
});
