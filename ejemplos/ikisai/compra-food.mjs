// Ejemplo transversal con datos inventados: una compra de comida en una casa
// de eventos. Muestra el eje de punta a punta: génesis, identidades que nacen
// al recibir tokens, un evento de compra con payload BTML y su décupla en
// Pointed. Nada de esto es real.
//
// Las series de tokens: la casa (una persona: solo las personas emiten, VG,
// 7-11 noche) emite en el génesis sus EUR (la
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
    demostracion: true,
    identidad: 'casa',
    tipo: 'persona', // solo las personas emiten (VG, 7-11 noche)
    emision: [
      { token: 'T', escala: 'hora', cantidad: 1000 },
      { token: 'T', escala: 'minuto', cantidad: 1000 }, // otro token: mil minutos no son horas
      { token: 'E', denominacion: 'EUR', cantidad: 500 }, // la serie E:casa/EUR: el génesis completa emisor = casa
      // T no cruza de persona (VG, 7-11 noche): el tiempo que la casa cede a otros es E de su serie, en horas.
      { token: 'E', denominacion: 'hora', cantidad: 1000 },
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
      // Cada una escribe con su propio T (se acuña al gastarse); la casa cede a cocina 40 horas de su
      // tiempo como E:casa/hora (T no cruza de persona, VG 7-11 noche) y a la persona huésped, euros.
      { token: 'E', emisor: 'casa', denominacion: 'hora', cantidad: 40, de: 'casa', a: 'cocina' },
      { token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 60, de: 'casa', a: 'huesped' },
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
    // Por hojas (VG, 7-11 noche): un array solo de hojas en una posición es una lista de ocupantes; los
    // platos son tres ocupantes de la 1, con la misma llegada y en este orden (no la 1.0, 1.1 y 1.2).
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
      // Por hojas (VG, 7-11 noche): con un array dentro, la posición es una décupla (1.0 qué es, 1.1 cuánto,
      // 1.2 con qué condición); la convención es envolver su 0. Solo hojas: una lista de ocupantes.
      [[{ ref: menu.id, dir: '1000000000' }], 1, 'EUR 12'], // 1 recursos: qué (los platos del menú), cuánto, a qué precio
      [{ ref: menu.id, dir: '2000000000' }], // 2 criterios: los del menú (una lista de uno)
      ['huesped', 'cocina'], // 3 comunicación: quién habla con quién, dos ocupantes
      ['pagar', 'servir'], // 4 fábrica: las acciones que se registran, dos ocupantes
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

/**
 * La compra ampliada, para que el 8 tenga comparables reales: la casa da de
 * alta a otra persona huésped, y sobre el mismo menú se escriben nueve
 * compras vecinas de la compra original (diez hermanas en total). Siete de
 * las diez tienen criterios (posición 2): cinco en su propio payload (un
 * array que apunta a los del menú), una solo por referencia directa al menú
 * (alcanzada, no propia: las referencias no copian) y una porque cocina
 * escribió un criterio encima; tres no: la compra rápida, una nota terminal
 * y una compra sin criterios. Una compra lleva en recursos (posición 1) una
 * fórmula pendiente y otra una fórmula resuelta. Todo inventado.
 */
export async function ejemploComprasVecinas(eje, { menu }, privadas = {}) {
  const priv = (id) => privadas[id];
  const gasta = (de, minutos = 1) => ({ token: 'T', escala: 'minuto', cantidad: minutos, de, a: null });
  const paga = (de, eur) => ({ token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: eur, de, a: 'cocina' });
  const alta2 = await eje.escribir({
    autor: 'casa',
    sobre: eje.genesisId,
    t: '2026-11-07T12:00:00Z',
    movimientos: [
      gasta('casa'),
      { token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 30, de: 'casa', a: 'huesped2' },
    ],
    payload: ['Alta de otra persona huésped', ['huesped2']],
    contexto: { tipos: { huesped2: 'persona' } },
  }, priv('casa'));
  const criterios = [{ ref: menu.id, dir: '2000000000' }];
  const recursos = [[{ ref: menu.id, dir: '1000000000' }], 1, 'EUR 12']; // una décupla: el 0 envuelto (por hojas)
  // La compra rápida: solo recursos, sin criterios. Es el foco natural para preguntarle al 8.
  const rapida = await eje.escribir({
    autor: 'huesped2',
    sobre: menu.id,
    t: '2026-11-07T13:35:00Z',
    movimientos: [gasta('huesped2'), paga('huesped2', 12)],
    payload: ['Compra rápida', recursos],
  }, priv('huesped2'));
  const vecinas = [];
  const payloads = [
    ['Compra con fórmula pendiente', '=LOCAL(5)', criterios], // 1: fórmula que espera la posición 5 (estructura)
    ['Compra con fórmula resuelta', [['EUR 10'], '=LOCAL(0, 0) + 1 EUR'], criterios], // 1.1: 11 EUR, leyendo el ocupante 0 de la 1.0
    ['Compra de mediodía', recursos, { ref: menu.id, dir: '2000000000' }], // 2: solo por referencia, sin array propio
    ['Compra para llevar', recursos, criterios, ['huesped2', 'cocina']],
    ['Compra del grupo', recursos, criterios, ['huesped', 'cocina'], ['pagar']],
    ['Compra sin criterios todavía', recursos], // criterios se los escribe cocina encima
    'nota sobre el menú', // terminal: no tiene posiciones
    ['Compra sin criterios', recursos],
  ];
  let minuto = 40;
  for (const payload of payloads) {
    const autor = vecinas.length % 2 ? 'huesped2' : 'huesped';
    vecinas.push(await eje.escribir({ autor, sobre: menu.id, t: '2026-11-07T13:' + minuto++ + ':00Z', movimientos: [gasta(autor)], payload }, priv(autor)));
  }
  const criterioCocina = await eje.escribir({
    autor: 'cocina',
    sobre: vecinas[5].id,
    en: '2000000000',
    t: '2026-11-07T13:50:00Z',
    movimientos: [gasta('cocina')],
    payload: ['Criterio de cocina', 'sin picante'],
  }, priv('cocina'));
  return { alta2, rapida, vecinas, criterioCocina };
}
