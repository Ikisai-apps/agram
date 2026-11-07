// Segundo ejemplo transversal con datos inventados: una reserva de alojamiento
// (Booking) en una casa rural. Existe para forzar que el núcleo sea genérico y
// no esté moldeado por la compra de comida: otro dominio, otra décupla, otro
// ciclo. Construye su propio eje: génesis de la casa; altas de recepción (con
// poder, P) y de una persona huésped (con dinero, E); la casa publica la
// disponibilidad; la persona huésped escribe la reserva sobre esa
// disponibilidad con referencias (no copias) y fórmulas BQL; recepción
// confirma por el ciclo del motor: consolidar → autorizar → ejecutar con el
// pago. Nada de esto es real.

import { Eje } from '../../src/eje.js';
import { evaluar } from '../../src/bql.js';
import { descubrir, consolidar, autorizar, ejecutar } from '../../src/motor.js';

/** Dónde se ancla la reserva en la disponibilidad: en su futuro (7), que es donde viven las fechas. [X] decidir VG: alternativa, en recursos (1), porque ocupa una habitación. */
export const EN_RESERVA = '7000000000';

/**
 * claves (opcional): { casa: {publica, privada}, recepcion: {...}, huesped: {...} }.
 * Con claves, la casa firma el génesis y declara las claves de las altas, y
 * cada identidad firma lo suyo. Sin claves, el eje funciona sin firmas.
 * confirmar: con false se detiene en la reserva escrita (sin ciclo del motor).
 */
export async function ejemploReserva({ claves = {}, confirmar = true } = {}) {
  const t = '2026-11-07T10:00:00Z';
  const priv = (id) => claves[id]?.privada;
  const eje = await Eje.genesis({
    identidad: 'casa',
    emision: [
      { token: 'T', escala: 'hora', cantidad: 1000 },
      { token: 'E', denominacion: 'EUR', cantidad: 500 },
      { token: 'P', cantidad: 10 },
    ],
    foco: 'Casa rural de ejemplo',
    t,
    clave: claves.casa?.publica,
    privada: priv('casa'),
  });

  // La casa da de alta a recepción (con poder para confirmar) y a una persona
  // huésped (con dinero para pagar): existen al recibir tokens.
  const declaradas = {};
  for (const id of ['recepcion', 'huesped']) if (claves[id]?.publica) declaradas[id] = claves[id].publica;
  const alta = await eje.escribir({
    autor: 'casa',
    sobre: eje.genesisId,
    t,
    movimientos: [
      { token: 'T', escala: 'minuto', cantidad: 1, de: 'casa', a: null },
      { token: 'T', escala: 'hora', cantidad: 40, de: 'casa', a: 'recepcion' },
      { token: 'P', cantidad: 3, de: 'casa', a: 'recepcion' },
      { token: 'E', denominacion: 'EUR', cantidad: 300, de: 'casa', a: 'huesped' },
      { token: 'T', escala: 'hora', cantidad: 72, de: 'casa', a: 'huesped' },
    ],
    payload: ['Altas de la temporada', ['recepcion', 'huesped']],
    contexto: Object.keys(declaradas).length ? { claves: declaradas } : {},
  }, priv('casa'));

  // La casa publica la disponibilidad sobre las altas. Un array BTML no admite
  // huecos, así que para declarar el futuro (7) hay que desarrollar 3–6.
  const disponibilidad = await eje.escribir({
    autor: 'casa',
    sobre: alta.id,
    t,
    movimientos: [{ token: 'T', escala: 'minuto', cantidad: 10, de: 'casa', a: null }],
    payload: [
      'Habitaciones libres del 20 al 23 de noviembre', // 0 representación
      [['doble', 'individual', 'familiar'], 3, ['EUR 80', 'EUR 55', 'EUR 120']], // 1 recursos: habitaciones, noches, precio por noche (por habitación)
      ['sin humo', 'con desayuno'], // 2 criterios
      ['recepcion'], // 3 comunicación: quién atiende
      'reservar', // 4 fábrica: la acción que se ofrece
      { ref: eje.genesisId }, // 5 estructura: la casa a la que pertenece
      { ref: alta.id }, // 6 pasado: de dónde viene (las altas)
      ['2026-11-20', '2026-11-23'], // 7 futuro: fechas
    ],
  }, priv('casa'));

  // La persona huésped escribe la reserva sobre la disponibilidad, anclada en
  // su futuro. La habitación y el precio son referencias a la disponibilidad
  // (1.0.1 y 1.2.1: la segunda habitación y su precio), no copias. Las
  // fórmulas viven en la misma décupla anidada (1): LOCAL lee a su profundidad.
  const reserva = await eje.escribir({
    autor: 'huesped',
    sobre: disponibilidad.id,
    en: EN_RESERVA,
    t: '2026-11-08T18:30:00Z',
    movimientos: [{ token: 'T', escala: 'minuto', cantidad: 15, de: 'huesped', a: null }],
    payload: [
      'Reserva de la individual, tres noches', // 0 representación
      [
        { ref: disponibilidad.id, dir: '1010000000' }, // 1.0 habitación elegida
        3, // 1.1 noches
        { ref: disponibilidad.id, dir: '1210000000' }, // 1.2 precio por noche
        '=LOCAL(2) * LOCAL(1)', // 1.3 total: precio por noche × noches
        '=LOCAL(3) + LOCAL(1) * 1 dia', // 1.4 el total compuesto con el tiempo que ocupa
      ],
      [{ ref: disponibilidad.id, dir: '2100000000' }], // 2 criterios: el que importa, con desayuno
      ['huesped', 'recepcion'], // 3 comunicación: quién habla con quién
    ],
  }, priv('huesped'));

  const resultado = { eje, alta, disponibilidad, reserva };
  if (!confirmar) return resultado;
  return { ...resultado, ...(await confirmarReserva(eje, reserva, { claves })) };
}

/**
 * Confirmación por el ciclo del motor. La persona huésped consolida en la
 * fábrica de su reserva lo que elige (habitación y criterio, por referencia a
 * la disponibilidad; lo que va a pagar, como fórmula que lee el total);
 * recepción autoriza (tiene P y no es la autora); la persona huésped ejecuta
 * con el pago E a la casa. Consolidar no es pagar: el E se mueve al ejecutar.
 */
export async function confirmarReserva(eje, reserva, { claves = {}, t = '2026-11-09T09:00:00Z' } = {}) {
  const priv = (id) => claves[id]?.privada;
  const d = descubrir(eje, reserva.id);
  const alcanzado = (posicion) => d.find((p) => p.posicion === posicion).candidatos.find((c) => c.origen === 'referencia');
  const consolidacion = await consolidar(eje, {
    autor: 'huesped',
    foco: reserva.id,
    t,
    titulo: 'Reserva en firme',
    elecciones: {
      1: { candidato: alcanzado(1) }, // la habitación alcanzada por la referencia
      2: { candidato: alcanzado(2) }, // el criterio alcanzado por la referencia
      4: '=REF("' + reserva.id.slice(0, 8) + '", "1300000000")', // lo que se va a pagar: el total de la reserva
    },
  }, priv('huesped'));
  const autorizacion = await autorizar(eje, { autorizante: 'recepcion', consolidacion: consolidacion.id, t, nota: 'confirmada' }, priv('recepcion'));
  // La consulta no tiene efectos: el efecto es la ejecución, que mueve el E.
  const total = evaluar(eje, consolidacion.id, [4]);
  if (total.estado !== 'RESUELTO' || total.valor.tipo !== 'magnitud' || total.valor.unidad !== 'EUR') throw new Error('total no resuelto: ' + total.texto);
  const ejecucion = await ejecutar(eje, {
    autor: 'huesped',
    consolidacion: consolidacion.id,
    t,
    titulo: 'Pagada y ocupada',
    movimientos: [{ token: 'E', denominacion: 'EUR', cantidad: total.valor.cantidad, de: 'huesped', a: 'casa' }],
  }, priv('huesped'));
  return { consolidacion, autorizacion, ejecucion };
}
