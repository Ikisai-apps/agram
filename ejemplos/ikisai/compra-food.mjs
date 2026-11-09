// Ejemplo transversal con datos inventados: una compra de comida en una casa
// de eventos. Muestra el eje de punta a punta: génesis, identidades que nacen
// al recibir tokens, un evento de compra con payload BTML y su décupla en
// Pointed. Nada de esto es real.
//
// Las series de tokens: la casa (una persona: solo las personas emiten, VG,
// 7-11 noche) escribe el génesis y emite al empezar su R (R:casa) y sus EUR
// (la serie E:casa/EUR, atada a su alta: el génesis); T no se emite (horas y
// minutos son tokens distintos de la asignación del día: escribir cuesta
// minutos; comprar, horas). Qué es cada identidad lo dice quién escribe su
// alta (VG, 10-11, B1): la persona huésped escribe la suya, aceptando la
// invitación de la casa (encargo 3b); la cocina, una cosa, la da de alta la
// casa. Las plazas de alojamiento son otra serie, la de Booking.
//
// El ciclo es una sola operación (VG, 8-11, mapa §15): la huésped registra
// la compra y en ella paga sus euros a la cocina (cada uno mueve lo suyo; nadie
// autoriza nada). La compra nombra en su criterio (su 2) la plantilla de
// cerrado de la época, «all announced movements happened»: no anuncia nada
// que falte, así que está cerrada (motor.cerrado).

import { Eje } from '../../src/eje.js';
import { entrarPorInvitacion } from './altas.mjs';

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
    identidad: 'casa', // escribe el génesis, su propia alta: es una persona (VG, 10-11, B1); solo las personas emiten
    // T no (VG, 8-11: no hay T acumulable): la casa vive de su asignación del día, como cualquier persona.
    emision: [
      { token: 'R', cantidad: 10 }, // su R (R:casa): emitir E exige R propia emitida (VG, 9-11, D2)
      { token: 'E', denominacion: 'EUR', cantidad: 500 }, // la serie E:casa/EUR: el génesis completa emisor = casa
    ],
    foco: 'Casa de ejemplo',
    t,
    clave: claves.casa?.publica,
    privada: priv('casa'),
  });

  // La casa invita a la persona huésped y ella acepta: su aceptación es su alta (VG, 9-11, mapa §16 [D]; B1:
  // persona es quien escribe la suya). Con clave, la declara y firma con ella.
  await entrarPorInvitacion(eje, { por: 'casa', quien: 'huesped', t, clave: claves.huesped, privadaDe: priv });

  // La casa da de alta a cocina, una cosa (su alta la escribe la casa, su dueña), y da euros a la huésped.
  const declaradas = {};
  if (claves.cocina?.publica) declaradas.cocina = claves.cocina.publica;
  const alta = await eje.escribir({
    autor: 'casa',
    sobre: eje.genesisId,
    t,
    movimientos: [
      { token: 'T', escala: 'minuto', cantidad: 1, de: 'casa', a: null },
      // La cocina es una cosa (su máquina): la casa le da T para que escriba (VG, 7-11 noche; Core, 8-11: una
      // persona da su T a una cosa, y sale de su asignación del día). T no cruza de persona: la persona huésped
      // recibe euros y escribe con su asignación de T del día (VG, 8-11).
      { token: 'T', escala: 'hora', cantidad: 20, de: 'casa', a: 'cocina' },
      { token: 'T', escala: 'minuto', cantidad: 240, de: 'casa', a: 'cocina' },
      { token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 60, de: 'casa', a: 'huesped' },
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
      // Forma canónica (VG, 8-11): con un array dentro, la posición es una décupla (1.0 qué es, 1.1 cuánto,
      // 1.2 con qué condición) y cada una de sus posiciones va entre corchetes: la lista de sus ocupantes.
      [[{ ref: menu.id, dir: '1000000000' }], [1], ['EUR 12']], // 1 recursos: qué (los platos del menú), cuánto, a qué precio
      [{ ref: menu.id, dir: '2000000000' }, 'all announced movements happened'], // 2 criterios: los del menú y la plantilla de cerrado (encargo 3b)
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
  // La casa invita a la otra persona huésped, que acepta (su alta), y después le da euros.
  await entrarPorInvitacion(eje, { por: 'casa', quien: 'huesped2', t: '2026-11-07T12:00:00Z', privadaDe: priv });
  const alta2 = await eje.escribir({
    autor: 'casa',
    sobre: eje.genesisId,
    t: '2026-11-07T12:00:00Z',
    movimientos: [
      gasta('casa'),
      { token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 30, de: 'casa', a: 'huesped2' },
    ],
    payload: ['Euros para otra persona huésped', ['huesped2']],
  }, priv('casa'));
  const criterios = [{ ref: menu.id, dir: '2000000000' }];
  const recursos = [[{ ref: menu.id, dir: '1000000000' }], [1], ['EUR 12']]; // una décupla: cada posición entre corchetes (forma canónica)
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
    ['Compra con fórmula resuelta', [['EUR 10'], ['=LOCAL(0, 0) + 1 EUR']], criterios], // 1.1: 11 EUR, leyendo el ocupante 0 de la 1.0
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
