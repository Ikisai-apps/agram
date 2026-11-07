// Ejemplo ampliado de la compra, con datos inventados: varias compras
// hermanas en dos menús de la casa y en un puesto del mercado, para tener
// cohortes que resumir en el 8 (bases del 8, src/bases.js). Nada es real.
//
//   génesis «Casa de ejemplo» (casa)
//   ├─ alta «Altas del fin de semana» (casa)          ← proyecto A
//   │  ├─ menú del día (cocina)
//   │  │  ├─ compra del menú (huesped)  ← la del ejemplo base, con su cuenta encima
//   │  │  ├─ compra de fruta (huesped)
//   │  │  ├─ compra de dos guisos (vecina) ← una fórmula resuelta y otra pendiente
//   │  │  └─ «Un café» (huesped)           ← un terminal
//   │  └─ menú de la cena (cocina)
//   │     ├─ compra de la cena (huesped)
//   │     └─ sopa para llevar (vecina)
//   └─ «Mercado del sábado» (casa, da de alta a vecina) ← proyecto B
//      └─ puesto de fruta (cocina)
//         ├─ compra de manzanas (vecina)
//         └─ compra de peras (huesped)
//
// Las bases las escribe la casa (tiene clave y firma); [X] decidir VG:
// deberían escribirlas las propias cosas.

import { ejemploCompra, ejemploCuenta } from './compra-food.mjs';
import { escribirBase } from '../../src/bases.js';

const hora = (de) => ({ token: 'T', escala: 'hora', cantidad: 1, de, a: null });
const minuto = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });
const eur = (de, a, cantidad) => ({ token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad, de, a });

/**
 * claves: { casa: {publica, privada}, ... }. La casa necesita clave para
 * escribir bases. Devuelve el eje y los ids de cada registro.
 */
export async function ejemploComprasHermanas({ claves = {} } = {}) {
  const priv = (id) => claves[id]?.privada;
  const { eje, alta, menu, compra } = await ejemploCompra({ claves });
  const cuenta = await ejemploCuenta(eje, compra, priv('cocina'));
  const escribir = (datos) => eje.escribir(datos, priv(datos.autor));

  // Proyecto B: el mercado, que además da de alta a una vecina (persona).
  const mercado = await escribir({
    autor: 'casa',
    sobre: eje.genesisId,
    t: '2026-11-07T15:00:00Z',
    movimientos: [
      minuto('casa'),
      { token: 'T', escala: 'hora', cantidad: 10, de: 'casa', a: 'vecina' },
      { token: 'T', escala: 'minuto', cantidad: 60, de: 'casa', a: 'vecina' },
      eur('casa', 'vecina', 30),
    ],
    payload: ['Mercado del sábado', ['fruta', 'pan']],
    contexto: { tipos: { vecina: 'persona' } },
  });

  // Compras hermanas de la compra del ejemplo base, sobre el menú del día.
  const fruta = await escribir({
    autor: 'huesped',
    sobre: menu.id,
    t: '2026-11-07T15:10:00Z',
    movimientos: [hora('huesped'), eur('huesped', 'cocina', 6)],
    payload: ['Compra de fruta', [{ ref: menu.id, dir: '1200000000' }, 2, 'EUR 3'], ['huesped', 'cocina']],
  });
  const guisos = await escribir({
    autor: 'vecina',
    sobre: menu.id,
    t: '2026-11-07T15:20:00Z',
    movimientos: [hora('vecina'), eur('vecina', 'cocina', 12)],
    payload: [
      'Compra de dos guisos',
      [{ ref: menu.id, dir: '1100000000' }, 2, '=2 * 6 EUR'], // fórmula resuelta
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
    sobre: alta.id,
    t: '2026-11-07T16:00:00Z',
    movimientos: [hora('cocina')],
    payload: ['Menú de la cena', ['sopa', 'tortilla'], ['vegetariano']],
  });
  const compraCena = await escribir({
    autor: 'huesped',
    sobre: cena.id,
    t: '2026-11-07T16:10:00Z',
    movimientos: [hora('huesped'), eur('huesped', 'cocina', 9)],
    payload: ['Compra de la cena', [{ ref: cena.id, dir: '1100000000' }, 1, 'EUR 9'], ['huesped', 'cocina']],
  });
  const sopa = await escribir({
    autor: 'vecina',
    sobre: cena.id,
    t: '2026-11-07T16:20:00Z',
    movimientos: [hora('vecina'), eur('vecina', 'cocina', 7)],
    payload: ['Sopa para llevar', [{ ref: cena.id, dir: '1000000000' }, 1, '=9 EUR - 2 EUR']],
  });

  // El puesto del mercado, con dos compras.
  const puesto = await escribir({
    autor: 'cocina',
    sobre: mercado.id,
    t: '2026-11-07T17:00:00Z',
    movimientos: [hora('cocina')],
    payload: ['Puesto de fruta', ['manzanas', 'peras']],
  });
  const manzanas = await escribir({
    autor: 'vecina',
    sobre: puesto.id,
    t: '2026-11-07T17:10:00Z',
    movimientos: [hora('vecina'), eur('vecina', 'cocina', 4)],
    payload: ['Compra de manzanas', [{ ref: puesto.id, dir: '1000000000' }, 3, 'EUR 4']],
  });
  const peras = await escribir({
    autor: 'huesped',
    sobre: puesto.id,
    t: '2026-11-07T17:20:00Z',
    movimientos: [hora('huesped'), eur('huesped', 'cocina', 3)],
    payload: ['Compra de peras', [{ ref: puesto.id, dir: '1100000000' }, 2, 'EUR 3']],
  });

  return { eje, alta, menu, compra, cuenta, fruta, guisos, cafe, cena, compraCena, sopa, mercado, puesto, manzanas, peras };
}

/**
 * Escribe las bases del ejemplo, de abajo arriba: las de los hermanos en el
 * 8 del menú, de la cena y del puesto; las fundidas en el 8 de los dos
 * proyectos (alta y mercado) y en el del génesis. Todas firmadas por la casa.
 */
export async function escribirBasesDelEjemplo(ej, privadaCasa, { t = '2026-11-07T18:00:00Z' } = {}) {
  const { eje } = ej;
  const escribir = (padre, desde) => escribirBase(eje, { autor: 'casa', padre, privada: privadaCasa, t, desde });
  const hermanos = {
    menu: await escribir(ej.menu.id, 'hijos'),
    cena: await escribir(ej.cena.id, 'hijos'),
    puesto: await escribir(ej.puesto.id, 'hijos'),
  };
  const proyectos = {
    alta: await escribir(ej.alta.id, 'bases'),
    mercado: await escribir(ej.mercado.id, 'bases'),
  };
  const general = await escribir(eje.genesisId, 'bases');
  return { hermanos, proyectos, general };
}
