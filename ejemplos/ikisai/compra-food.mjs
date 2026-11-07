// Ejemplo transversal con datos inventados: una compra de comida en una casa
// de eventos. Muestra el eje de punta a punta: génesis, identidades que nacen
// al recibir tokens, un evento de compra con payload BTML y su décupla en
// Pointed. Nada de esto es real.

import { Eje } from '../../src/eje.js';

/**
 * claves (opcional): { casa: {publica, privada}, cocina: {...}, huesped: {...} }.
 * Con claves, la casa firma el génesis y declara las claves de las altas, y
 * cada identidad firma lo suyo. Sin claves, el eje funciona sin firmas.
 */
export async function ejemploCompra({ claves = {} } = {}) {
  const t = '2026-11-07T09:00:00Z';
  const priv = (id) => claves[id]?.privada;
  const eje = await Eje.genesis({
    identidad: 'casa',
    emision: [
      { token: 'T', escala: 'hora', cantidad: 1000 },
      { token: 'E', denominacion: 'EUR', cantidad: 500 },
      { token: 'P', cantidad: 10, ambito: 'genesis' }, // poder de la casa sobre todo su eje
    ],
    foco: 'Casa de ejemplo',
    t,
    clave: claves.casa?.publica,
    privada: priv('casa'),
  });

  // La casa da de alta a cocina y a una persona huésped: existen al recibir tokens.
  const declaradas = {};
  for (const id of ['cocina', 'huesped']) if (claves[id]?.publica) declaradas[id] = claves[id].publica;
  const alta = await eje.escribir({
    autor: 'casa',
    sobre: eje.genesisId,
    t,
    movimientos: [
      { token: 'T', escala: 'minuto', cantidad: 1, de: 'casa', a: null },
      { token: 'T', escala: 'hora', cantidad: 40, de: 'casa', a: 'cocina' },
      { token: 'E', denominacion: 'EUR', cantidad: 60, de: 'casa', a: 'huesped' },
      { token: 'T', escala: 'hora', cantidad: 24, de: 'casa', a: 'huesped' },
    ],
    payload: ['Altas del fin de semana', ['cocina', 'huesped']],
    contexto: Object.keys(declaradas).length ? { claves: declaradas } : {},
  }, priv('casa'));

  // Cocina publica el menú del día sobre las altas.
  const menu = await eje.escribir({
    autor: 'cocina',
    sobre: alta.id,
    t,
    movimientos: [{ token: 'T', escala: 'hora', cantidad: 2, de: 'cocina', a: null }],
    payload: ['Menú del día', ['ensalada', 'guiso', 'fruta'], ['sin gluten', 'vegetariano']],
  }, priv('cocina'));

  // La persona huésped compra el menú: paga E a cocina y gasta su tiempo.
  const compra = await eje.escribir({
    autor: 'huesped',
    sobre: menu.id,
    t: '2026-11-07T13:30:00Z',
    movimientos: [
      { token: 'T', escala: 'hora', cantidad: 1, de: 'huesped', a: null },
      { token: 'E', denominacion: 'EUR', cantidad: 12, de: 'huesped', a: 'cocina' },
    ],
    payload: [
      'Compra del menú del día',
      [{ ref: menu.id, dir: '1000000000' }, 1, 'EUR 12'], // 1 recursos: qué, cuánto, a qué precio
      [{ ref: menu.id, dir: '2000000000' }], // 2 criterios: los del menú
      ['huesped', 'cocina'], // 3 comunicación: quién habla con quién
      ['pagar', 'servir'], // 4 fábrica: la acción que se registra
    ],
  }, priv('huesped'));

  return { eje, alta, menu, compra };
}

/**
 * La cuenta: cocina la escribe sobre la compra, en recursos (posición 1).
 * Primera fórmula BQL real en un slot: lee el precio de la compra por REF,
 * le suma la propina, y la posición siguiente compone euros con minutos.
 */
export async function ejemploCuenta(eje, compra, privadaCocina) {
  return eje.escribir({
    autor: 'cocina',
    sobre: compra.id,
    en: '1000000000',
    t: '2026-11-07T14:10:00Z',
    movimientos: [{ token: 'T', escala: 'minuto', cantidad: 3, de: 'cocina', a: null }],
    payload: [
      'Cuenta del menú',
      '=REF("' + compra.id.slice(0, 8) + '", "1200000000") + 2 EUR', // 1 recursos: precio de la compra + propina
      '=LOCAL(1) + 15 min', // 2 criterios: lo que cuesta en euros y en tiempo de servicio
      '==no es fórmula', // 3 comunicación: texto escapado
    ],
  }, privadaCocina);
}
