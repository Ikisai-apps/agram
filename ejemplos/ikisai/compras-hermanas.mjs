// Ejemplo de compras hermanas, con datos inventados: dos proyectos de una
// casa con menús y un puesto, y compras sobre cada uno, para tener cohortes
// que resumir en el 8 (bases del 8, src/bases.js). Nada es real.
//
//   génesis «Casa de ejemplo» (casa)                    ← la casa escribe la base del génesis
//   ├─ «Comedor del fin de semana» (casa)  cosa comedor  ← proyecto A
//   │  ├─ «Menú del día» (cocina)          cosa menu-dia
//   │  │  ├─ compra del menú (huesped)
//   │  │  ├─ compra de fruta (huesped)
//   │  │  ├─ compra de dos guisos (vecina) ← una fórmula resuelta y otra pendiente
//   │  │  └─ «Un café» (huesped)           ← un terminal
//   │  └─ «Menú de la cena» (cocina)       cosa menu-cena
//   │     ├─ compra de la cena (huesped)
//   │     └─ sopa para llevar (vecina)
//   └─ «Mercado del sábado» (casa)         cosa mercado  ← proyecto B
//      └─ «Puesto de fruta» (cocina)       cosa puesto
//         ├─ compra de manzanas (vecina)
//         └─ compra de peras (huesped)
//
// La base de cada registro la escribe la propia cosa, con su clave y gastando
// su T (mapa §12). Cada registro que resume a otros da de alta, en su mismo
// evento, a su cosa: su clave y unos minutos de T (es una cosa porque su alta
// la escribe otro: VG, 10-11, B1). Así se
// identifica hoy un registro con su identidad ([X] decidir VG, src/bases.js
// identidadDe); la del génesis es su autor, la casa.

// Por hojas (VG, 7-11 noche): los platos de un menú y las frutas de un
// puesto son listas (arrays solo de hojas): sus elementos son ocupantes de la
// 1 y una dirección no entra en ellos. Por eso cada compra referencia la
// lista entera ('1000000000') y no un plato por dirección; el plato lo dice
// su representación. Los recursos de cada compra son una décupla con el 0
// entre corchetes (forma canónica, VG 8-11): [[lo comprado], [cuánto], [a qué precio]].
// [X] decidir VG: cómo se referencia un elemento de una lista (una
// referencia BTML es una dirección, y una dirección no entra en una lista).

import { Eje } from '../../src/eje.js';
import { generarClaves } from '../../src/autoridad.js';
import { escribirBase, identidadDe } from '../../src/bases.js';
import { entrarPorInvitacion } from './altas.mjs';
import { pagaElCoste, escribirPagando } from './coste.mjs';

const T = '2026-11-07T09:00:00Z';
/** El día en que se escriben las bases del ejemplo por defecto: uno en que la casa no ha gastado su asignación (las gasta ella, la del génesis). */
export const T_BASES = '2026-11-09T18:00:00Z';
const hora = (de) => ({ token: 'T', escala: 'hora', cantidad: 1, de, a: null });
const minuto = (de) => pagaElCoste(de);
// Minutos de T para una cosa (su máquina): T no cruza de persona (VG, 7-11 noche), pero una persona da su T a
// una cosa, y una cosa al resto de sus cosas (Core, 8-11). Las personas escriben con su propio T.
const minutos = (de, a, cantidad) => ({ token: 'T', escala: 'minuto', cantidad, de, a });
const segundos = (de, a, cantidad) => ({ token: 'T', escala: 'segundo', cantidad, de, a });
const horas = (de, a, cantidad) => ({ token: 'T', escala: 'hora', cantidad, de, a });
/**
 * Escribir una base cuesta un minuto por posición (VG 12-11, #64 b): las del ejemplo, entre trescientos y seiscientos
 * minutos. Quien las escribe es una cosa, que solo tiene el T que le dan, así que su dueña le va dando por escalas
 * (minutos, segundos, horas y el día, el ciclo o el año enteros, que le llegan cada día a una persona); una base se paga
 * en la primera escala en que le alcanza (escribirBase). El sábado (7-11) lo que cabe en la asignación de ese día de la
 * casa, y el domingo (8-11, con el mercado) otro tanto, que las cosas conservan.
 */
const eur = (de, a, cantidad) => ({ token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad, de, a });

/** Las cosas del ejemplo: cada registro que resume a otros es una cosa con su clave. */
export const COSAS = Object.freeze(['comedor', 'menu-dia', 'menu-cena', 'mercado', 'puesto']);

/** Da de alta a una cosa en el propio registro: su clave (los minutos para escribir sus bases van en los movimientos). */
const altaDeCosa = (cosa, claves) => ({ claves: { [cosa]: claves[cosa].publica } });

/**
 * claves (opcional): { casa, comedor, 'menu-dia', 'menu-cena', mercado,
 * puesto, ... } con { publica, privada }; las que falten de la casa y de las
 * cosas se generan. Devuelve el eje, las claves y cada registro.
 */
export async function ejemploComprasHermanas({ claves: dadas = {} } = {}) {
  const claves = { ...dadas };
  for (const id of ['casa', ...COSAS]) claves[id] ??= await generarClaves();
  const priv = (id) => claves[id]?.privada;
  const eje = await Eje.genesis({
    demostracion: true,
    identidad: 'casa', // escribe su propia alta, el génesis: es una persona (VG, 10-11, B1); solo las personas emiten
    emision: [
      { token: 'R', cantidad: 10 },
      { token: 'E', denominacion: 'EUR', cantidad: 500 },
    ],
    foco: 'Casa de ejemplo',
    t: T,
    clave: claves.casa.publica,
    privada: priv('casa'),
  });
  const escribir = (datos) => escribirPagando(eje, datos, priv(datos.autor));

  // Las personas entran aceptando la invitación de la casa (encargo 3b): su aceptación es su alta (VG, 10-11, B1).
  for (const id of ['huesped', 'vecina']) await entrarPorInvitacion(eje, { por: 'casa', quien: id, t: T, clave: claves[id], privadaDe: priv });

  // La cocina es una cosa de la casa (su máquina: escribe con el T que le da), sin clave en el eje de demostración:
  // así la única cosa con clave que da de alta el comedor es el propio comedor (identidadDe). La casa la da de alta en su
  // propio registro, con su nombre en el 0, y con la T que le da su dueña (una cosa no tiene más T que la que una persona
  // le dio, #46).
  await escribir({
    autor: 'casa',
    sobre: eje.genesisId,
    t: T,
    movimientos: [
      minuto('casa'),
      { token: 'T', escala: 'hora', cantidad: 20, de: 'casa', a: 'cocina' },
      minutos('casa', 'cocina', 700),
      segundos('casa', 'cocina', 30000),
    ],
    payload: ['cocina'],
  });

  // Proyecto A: el comedor da de alta a su cosa y la casa da euros a huesped y vecina.
  const comedor = await escribir({
    autor: 'casa',
    sobre: eje.genesisId,
    t: T,
    movimientos: [
      minuto('casa'),
      eur('casa', 'huesped', 60),
      eur('casa', 'vecina', 40),
      minutos('casa', 'comedor', 10),
      segundos('casa', 'comedor', 30000),
      { token: 'T', escala: 'dia', cantidad: 1, de: 'casa', a: 'comedor' },
    ],
    payload: ['Comedor del fin de semana', ['cocina', 'huesped', 'vecina']],
    contexto: { claves: { comedor: claves.comedor.publica } },
  });

  // El menú del día y sus cuatro compras hermanas.
  const menu = await escribir({
    autor: 'cocina',
    sobre: comedor.id,
    t: T,
    movimientos: [{ token: 'T', escala: 'hora', cantidad: 2, de: 'cocina', a: null }, minutos('cocina', 'menu-dia', 400), horas('cocina', 'menu-dia', 6)],
    payload: ['Menú del día', ['ensalada', 'guiso', 'fruta'], ['sin gluten', 'vegetariano']],
    contexto: altaDeCosa('menu-dia', claves),
  });
  const compra = await escribir({
    autor: 'huesped',
    sobre: menu.id,
    t: '2026-11-07T13:30:00Z',
    movimientos: [hora('huesped'), eur('huesped', 'cocina', 12)],
    payload: [
      'Compra del menú del día',
      [[{ ref: menu.id, dir: '1000000000' }], [1], ['EUR 12']],
      [{ ref: menu.id, dir: '2000000000' }],
      ['huesped', 'cocina'],
      ['pagar', 'servir'],
    ],
  });
  const fruta = await escribir({
    autor: 'huesped',
    sobre: menu.id,
    t: '2026-11-07T15:10:00Z',
    movimientos: [hora('huesped'), eur('huesped', 'cocina', 6)],
    payload: ['Compra de fruta', [[{ ref: menu.id, dir: '1000000000' }], [2], ['EUR 3']], ['huesped', 'cocina']],
  });
  const guisos = await escribir({
    autor: 'vecina',
    sobre: menu.id,
    t: '2026-11-07T15:20:00Z',
    movimientos: [hora('vecina'), eur('vecina', 'cocina', 12)],
    payload: [
      'Compra de dos guisos',
      [[{ ref: menu.id, dir: '1000000000' }], [2], ['=2 * 6 EUR']], // fórmula resuelta
      [{ ref: menu.id, dir: '2000000000' }],
      ['vecina', 'cocina'],
      ['pagar', '=LOCAL(9)'], // fórmula pendiente: la 9 no está desarrollada
    ],
  });
  const cafe = await escribir({
    autor: 'huesped',
    sobre: menu.id,
    t: '2026-11-07T15:30:00Z',
    movimientos: [hora('huesped'), eur('huesped', 'cocina', 2)],
    payload: 'Un café',
  });

  // El menú de la cena, hermano del menú del día, con dos compras.
  const cena = await escribir({
    autor: 'cocina',
    sobre: comedor.id,
    t: '2026-11-07T16:00:00Z',
    movimientos: [hora('cocina'), segundos('cocina', 'menu-cena', 30000)],
    payload: ['Menú de la cena', ['sopa', 'tortilla'], ['vegetariano']],
    contexto: altaDeCosa('menu-cena', claves),
  });
  const compraCena = await escribir({
    autor: 'huesped',
    sobre: cena.id,
    t: '2026-11-07T16:10:00Z',
    movimientos: [hora('huesped'), eur('huesped', 'cocina', 9)],
    payload: ['Compra de la cena', [[{ ref: cena.id, dir: '1000000000' }], [1], ['EUR 9']], ['huesped', 'cocina']],
  });
  const sopa = await escribir({
    autor: 'vecina',
    sobre: cena.id,
    t: '2026-11-07T16:20:00Z',
    movimientos: [hora('vecina'), eur('vecina', 'cocina', 7)],
    payload: ['Sopa para llevar', [[{ ref: cena.id, dir: '1000000000' }], [1], ['=9 EUR - 2 EUR']]],
  });

  // Proyecto B: el mercado, su cosa y un puesto con dos compras.
  const mercado = await escribir({
    autor: 'casa',
    sobre: eje.genesisId,
    t: '2026-11-08T15:00:00Z',
    movimientos: [
      minuto('casa'),
      minutos('casa', 'mercado', 450),
      segundos('casa', 'mercado', 30000),
      minutos('casa', 'comedor', 300),
      segundos('casa', 'comedor', 25000),
      minutos('casa', 'cocina', 650),
      segundos('casa', 'cocina', 30000),
      { token: 'T', escala: 'ciclo', cantidad: 1, de: 'casa', a: 'cocina' },
      { token: 'T', escala: 'anio', cantidad: 1, de: 'casa', a: 'cocina' },
      eur('casa', 'vecina', 30),
    ],
    payload: ['Mercado del sábado', ['fruta', 'pan']],
    contexto: altaDeCosa('mercado', claves),
  });
  const puesto = await escribir({
    autor: 'cocina',
    sobre: mercado.id,
    t: '2026-11-08T17:00:00Z',
    movimientos: [
      hora('cocina'),
      segundos('cocina', 'puesto', 30000),
      minutos('cocina', 'menu-dia', 600),
      { token: 'T', escala: 'ciclo', cantidad: 1, de: 'cocina', a: 'menu-dia' },
      { token: 'T', escala: 'anio', cantidad: 1, de: 'cocina', a: 'menu-dia' },
    ],
    payload: ['Puesto de fruta', ['manzanas', 'peras']],
    contexto: altaDeCosa('puesto', claves),
  });
  const manzanas = await escribir({
    autor: 'vecina',
    sobre: puesto.id,
    t: '2026-11-08T17:10:00Z',
    movimientos: [hora('vecina'), eur('vecina', 'cocina', 4)],
    payload: ['Compra de manzanas', [[{ ref: puesto.id, dir: '1000000000' }], [3], ['EUR 4']]],
  });
  const peras = await escribir({
    autor: 'huesped',
    sobre: puesto.id,
    t: '2026-11-08T17:20:00Z',
    movimientos: [hora('huesped'), eur('huesped', 'cocina', 3)],
    payload: ['Compra de peras', [[{ ref: puesto.id, dir: '1000000000' }], [2], ['EUR 3']]],
  });

  return { eje, claves, comedor, menu, compra, fruta, guisos, cafe, cena, compraCena, sopa, mercado, puesto, manzanas, peras };
}

/** Escribe la base de un registro del ejemplo: la firma su propia cosa. */
export function escribirBaseDe(ej, registro, { t = T_BASES } = {}) {
  const cosa = identidadDe(ej.eje, registro);
  // Paga lo que exige la regla del coste en la primera escala en la que le alcanza (escribirBase: el minuto, si no, otra).
  return escribirBase(ej.eje, { registro, privada: ej.claves[cosa]?.privada, t });
}

/**
 * Escribe las seis bases del ejemplo, de abajo arriba (cada una funde las de
 * los hijos ya escritas): los dos menús y el puesto; los dos proyectos; el
 * génesis. Cada una la firma su propia cosa.
 */
export async function escribirBasesDelEjemplo(ej, { t = T_BASES } = {}) {
  const de = (registro) => escribirBaseDe(ej, registro, { t });
  const menus = { menu: await de(ej.menu.id), cena: await de(ej.cena.id), puesto: await de(ej.puesto.id) };
  const proyectos = { comedor: await de(ej.comedor.id), mercado: await de(ej.mercado.id) };
  const general = await de(ej.eje.genesisId);
  return { menus, proyectos, general };
}
