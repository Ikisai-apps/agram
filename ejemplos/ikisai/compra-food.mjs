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
  const paga = (de, eur) => ({ token: 'E', denominacion: 'EUR', cantidad: eur, de, a: 'cocina' });
  const alta2 = await eje.escribir({
    autor: 'casa',
    sobre: eje.genesisId,
    t: '2026-11-07T12:00:00Z',
    movimientos: [gasta('casa'), { token: 'T', escala: 'hora', cantidad: 10, de: 'casa', a: 'huesped2' }, { token: 'E', denominacion: 'EUR', cantidad: 30, de: 'casa', a: 'huesped2' }],
    payload: ['Alta de otra persona huésped', ['huesped2']],
  }, priv('casa'));
  const criterios = [{ ref: menu.id, dir: '2000000000' }];
  const recursos = [{ ref: menu.id, dir: '1000000000' }, 1, 'EUR 12'];
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
    ['Compra con fórmula resuelta', ['EUR 10', '=LOCAL(0) + 1 EUR'], criterios], // 1.1: 11 EUR, leyendo 1.0
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
