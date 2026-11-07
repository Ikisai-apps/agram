// Segundo ejemplo transversal con datos inventados: una reserva de alojamiento
// (Booking) en una casa rural. Existe para forzar que el núcleo sea genérico y
// no esté moldeado por la compra de comida: otro dominio, otra décupla, otro
// ciclo. Construye su propio eje: génesis de la casa; altas de recepción y de
// una persona huésped (con dinero, E); la casa publica la disponibilidad y
// delega en recepción el poder (P) sobre ella; la persona huésped escribe la
// reserva sobre esa disponibilidad con referencias (no copias) y fórmulas
// BQL; recepción confirma por el ciclo del motor: consolidar → autorizar →
// ejecutar con el pago. Nada de esto es real.
//
// [X] decidir VG: la habitación-noche como recurso escaso. Hoy la habitación
// es texto BTML en la disponibilidad y la reserva solo mueve T (y E al
// ejecutar: el pago). Nada de la casa queda comprometido ni descontado, y el
// eje acepta una segunda reserva de la misma habitación en las mismas fechas.
// El mapa dice «tokens como base, no perímetro» y E = cantidad,
// disponibilidad, derechos y obligaciones: la alternativa es que la
// habitación-noche sea un E de la casa que se mueve o se bloquea al
// confirmar, lo que exige dos partes (compromiso de la casa + pago de la
// persona huésped; hueco AARPIA del mapa §12). Mientras tanto la ejecución se
// titula «Pagada»: solo hay evidencia del pago, no de la ocupación.

import { Eje } from '../../src/eje.js';
import { evaluar } from '../../src/bql.js';
import { descubrir, consolidar, autorizar, ejecutar, consolidaciones, autorizacionesValidas, FABRICA } from '../../src/motor.js';

/**
 * Dónde se ancla la reserva en la disponibilidad: en su futuro (7), que es
 * donde viven las fechas. [X] decidir VG: alternativa, en recursos (1), porque
 * ocupa una habitación. No es solo semántica: descubrir y consolidaciones
 * miran 1–4, así que desde la disponibilidad la reserva hoy solo se ve por
 * ocupantes(7), BUSCAR(7) y el eje temporal, no por la fábrica.
 */
export const EN_RESERVA = '7000000000';

/**
 * Marca honesta de relleno. Un array BTML no admite huecos, así que para
 * declarar el 7 hay que escribir algo en 3–6; lo que este ejemplo no
 * desarrolla lo dice con un texto llano (no empieza por «=», así que no
 * necesita el escape «==», que solo protege un «=» inicial).
 * [X] decidir VG: cómo se escribe «sin desarrollar» o «no aplicable» sin null
 * (mapa §4.6). Una referencia al propio registro no sirve de marca: el id no
 * existe hasta que el registro está escrito.
 */
export const SIN_DESARROLLAR = 'sin desarrollar';

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
      { token: 'P', cantidad: 10, ambito: 'genesis' }, // poder de la casa sobre todo su eje
    ],
    foco: 'Casa rural de ejemplo',
    t,
    clave: claves.casa?.publica,
    privada: priv('casa'),
  });

  // La casa da de alta a recepción y a una persona huésped (con dinero para
  // pagar): existen al recibir tokens. El poder de recepción no cabe aquí: P
  // exige un ámbito que ya exista, y la disponibilidad aún no está escrita.
  const declaradas = {};
  for (const id of ['recepcion', 'huesped']) if (claves[id]?.publica) declaradas[id] = claves[id].publica;
  const alta = await eje.escribir({
    autor: 'casa',
    sobre: eje.genesisId,
    t,
    movimientos: [
      { token: 'T', escala: 'minuto', cantidad: 1, de: 'casa', a: null },
      { token: 'T', escala: 'hora', cantidad: 40, de: 'casa', a: 'recepcion' },
      { token: 'E', denominacion: 'EUR', cantidad: 300, de: 'casa', a: 'huesped' },
      { token: 'T', escala: 'hora', cantidad: 72, de: 'casa', a: 'huesped' },
    ],
    payload: ['Altas de la temporada', ['recepcion', 'huesped']],
    contexto: Object.keys(declaradas).length ? { claves: declaradas } : {},
  }, priv('casa'));

  // La casa publica la disponibilidad sobre las altas. Cada habitación es una
  // subdécupla [nombre, precio por noche]: un solo nodo referenciable, sin
  // arrays paralelos. Límite conocido de los ceros finales: la primera
  // habitación (1.0.0, «doble») no se puede nombrar con precisión, porque
  // 1000000000 nombra a la vez [1], [1.0], [1.0.0] y [1.0.0.0]. Un array BTML
  // no admite huecos, así que para declarar el futuro (7) hay que escribir
  // 3–6: 3 y 4 dicen algo; 5 y 6 llevan la marca de relleno.
  const disponibilidad = await eje.escribir({
    autor: 'casa',
    sobre: alta.id,
    t,
    movimientos: [{ token: 'T', escala: 'minuto', cantidad: 10, de: 'casa', a: null }],
    payload: [
      'Habitaciones libres del 20 al 23 de noviembre', // 0 representación
      [
        [['doble', 'EUR 80'], ['individual', 'EUR 55'], ['familiar', 'EUR 120']], // 1.0 habitaciones: cada una [nombre, precio por noche]
        3, // 1.1 noches
      ], // 1 recursos
      ['sin humo', 'con desayuno'], // 2 criterios
      ['recepcion'], // 3 comunicación: quién atiende
      'reservar', // 4 fábrica: la acción que se ofrece
      SIN_DESARROLLAR, // 5 relleno para llegar al 7 (ver [X] en SIN_DESARROLLAR)
      SIN_DESARROLLAR, // 6 relleno para llegar al 7
      ['2026-11-20', '2026-11-23'], // 7 futuro: fechas
    ],
  }, priv('casa'));

  // La casa delega en recepción el poder de confirmar: P con ámbito, que
  // estrecha el poder de la casa a un registro y lo que cuelgue de él. Va en
  // un evento propio, después de publicar la disponibilidad, con el ámbito
  // mínimo: la disponibilidad misma (cubre la reserva y su fábrica).
  // [X] decidir VG: el ámbito del poder de recepción. Alternativas: 'genesis'
  // (recepción autorizaría todo el eje) o alta.id (todo lo publicado desde
  // las altas). Con el mínimo, recepción no puede autorizar nada fuera de esta
  // disponibilidad.
  const delegacion = await eje.escribir({
    autor: 'casa',
    sobre: disponibilidad.id,
    t,
    movimientos: [
      { token: 'T', escala: 'minuto', cantidad: 1, de: 'casa', a: null },
      { token: 'P', cantidad: 3, ambito: disponibilidad.id, de: 'casa', a: 'recepcion' },
    ],
    payload: 'Recepción atiende esta disponibilidad',
  }, priv('casa'));

  // La persona huésped escribe la reserva sobre la disponibilidad, anclada en
  // su futuro. La habitación elegida es una referencia a su subdécupla
  // (1.0.1: la segunda habitación) y el precio, una referencia dentro de esa
  // misma subdécupla (1.0.1.1), no copias: la dirección del precio cuelga de
  // la de la habitación. Las fórmulas viven en la misma décupla anidada (1):
  // LOCAL lee a su profundidad. Límite del núcleo: LOCAL(0, 1) no lee el
  // precio a través de la referencia de 1.0 (leerPosicion no sigue
  // referencias a mitad de camino), por eso el precio va como referencia.
  const reserva = await eje.escribir({
    autor: 'huesped',
    sobre: disponibilidad.id,
    en: EN_RESERVA,
    t: '2026-11-08T18:30:00Z',
    movimientos: [{ token: 'T', escala: 'minuto', cantidad: 15, de: 'huesped', a: null }],
    payload: [
      'Reserva de la individual, tres noches', // 0 representación
      [
        { ref: disponibilidad.id, dir: '1010000000' }, // 1.0 habitación elegida: [individual, EUR 55]
        3, // 1.1 noches
        { ref: disponibilidad.id, dir: '1011000000' }, // 1.2 precio por noche: dentro de la habitación elegida
        '=LOCAL(2) * LOCAL(1)', // 1.3 total: precio por noche × noches
        '=LOCAL(3) + LOCAL(1) * 1 dia', // 1.4 el total compuesto con el tiempo que ocupa
      ],
      [{ ref: disponibilidad.id, dir: '2100000000' }], // 2 criterios: el que importa, con desayuno
      ['huesped', 'recepcion'], // 3 comunicación: quién habla con quién
    ],
  }, priv('huesped'));

  const resultado = { eje, alta, disponibilidad, delegacion, reserva };
  if (!confirmar) return resultado;
  return { ...resultado, ...(await confirmarReserva(eje, reserva, { claves })) };
}

/**
 * Confirmación por el ciclo del motor. La persona huésped consolida en la
 * fábrica de su reserva lo que elige (habitación y criterio, por referencia a
 * la disponibilidad; lo que va a pagar, como fórmula que lee el total);
 * recepción autoriza (tiene P sobre la disponibilidad y no es la autora); la
 * persona huésped ejecuta con el pago E a la casa. Consolidar no es pagar: el
 * E se mueve al ejecutar. Idempotente: si la reserva ya tiene una
 * consolidación ejecutada, devuelve esa confirmación (con yaConfirmada) y no
 * cobra dos veces. El motor por sí solo no lo impide (acepta N
 * consolidaciones ejecutadas sobre un foco): la exclusividad vive aquí.
 */
export async function confirmarReserva(eje, reserva, { claves = {}, t = '2026-11-09T09:00:00Z' } = {}) {
  const hecha = consolidaciones(eje, reserva.id).find((c) => c.estado === 'EJECUTADO');
  if (hecha) {
    const consolidacion = eje.obtener(hecha.id);
    const autorizacion = autorizacionesValidas(eje, hecha.id)[0];
    const ejecucion = eje.sobre(hecha.id, FABRICA).find((e) => e.contexto?.fase === 'ejecutado' && e.autor === consolidacion.autor);
    return { consolidacion, autorizacion, ejecucion, yaConfirmada: true };
  }
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
      4: '=REF("' + reserva.id + '", "1300000000")', // lo que se va a pagar: el total de la reserva (id completo, no prefijo)
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
    titulo: 'Pagada', // solo hay evidencia del pago (ver [X] habitación-noche en la cabecera)
    movimientos: [{ token: 'E', denominacion: 'EUR', cantidad: total.valor.cantidad, de: 'huesped', a: 'casa' }],
  }, priv('huesped'));
  return { consolidacion, autorizacion, ejecucion };
}
