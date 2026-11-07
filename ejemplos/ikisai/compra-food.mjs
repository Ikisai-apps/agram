// Ejemplo transversal con datos inventados: una compra de comida en una casa
// de eventos. Muestra el eje de punta a punta: génesis, identidades que nacen
// al recibir tokens, un evento de compra con payload BTML y su décupla en
// Pointed. Nada de esto es real.
//
// Las series de tokens: la casa (un grupo) emite en el génesis sus EUR (la
// serie E:casa/EUR, ligada a ella como R) y las dos escalas de T que usa:
// horas y minutos, tokens distintos sin conversión (escribir cuesta minutos;
// comprar, horas). Las altas reparten ambas y declaran qué es cada identidad
// (cocina, un grupo; huesped, una persona). Las plazas de alojamiento son otra
// serie, la de Booking.

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
    tipo: 'grupo', // solo personas y grupos emiten
    emision: [
      { token: 'T', escala: 'hora', cantidad: 1000 },
      { token: 'T', escala: 'minuto', cantidad: 1000 }, // otro token: mil minutos no son horas
      { token: 'E', denominacion: 'EUR', cantidad: 500 }, // la serie E:casa/EUR: el génesis completa emisor = casa
      { token: 'P', cantidad: 10, ambito: 'genesis' }, // poder de la casa sobre todo su eje
    ],
    foco: 'Casa de ejemplo',
    t,
    clave: claves.casa?.publica,
    privada: priv('casa'),
  });

  // La casa da de alta a cocina y a una persona huésped: existen al recibir tokens, y el alta declara su tipo.
  const declaradas = {};
  for (const id of ['cocina', 'huesped']) if (claves[id]?.publica) declaradas[id] = claves[id].publica;
  const alta = await eje.escribir({
    autor: 'casa',
    sobre: eje.genesisId,
    t,
    movimientos: [
      { token: 'T', escala: 'minuto', cantidad: 1, de: 'casa', a: null },
      { token: 'T', escala: 'hora', cantidad: 40, de: 'casa', a: 'cocina' },
      { token: 'T', escala: 'minuto', cantidad: 240, de: 'casa', a: 'cocina' },
      { token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 60, de: 'casa', a: 'huesped' },
      { token: 'T', escala: 'hora', cantidad: 24, de: 'casa', a: 'huesped' },
      { token: 'T', escala: 'minuto', cantidad: 480, de: 'casa', a: 'huesped' },
    ],
    payload: ['Altas del fin de semana', ['cocina', 'huesped']],
    contexto: { tipos: { cocina: 'grupo', huesped: 'persona' }, ...(Object.keys(declaradas).length ? { claves: declaradas } : {}) },
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
      { token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 12, de: 'huesped', a: 'cocina' },
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
