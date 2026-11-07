// Segundo ejemplo transversal con datos inventados: una reserva de alojamiento
// (Booking) en una casa rural. Existe para forzar que el núcleo sea genérico y
// no esté moldeado por la compra de comida: otro dominio, otra décupla, otro
// ciclo. Construye su propio eje: génesis de la casa (un grupo); altas de
// recepción y de una persona huésped; la casa escribe su dominio
// «Alojamiento» y delega en recepción el poder (P) con ese ámbito; publica el
// elemento habitación con sus plazas; la persona huésped escribe la reserva
// anclada en una plaza, con las noches en su propio 7; recepción confirma por
// el ciclo del motor: consolidar → autorizar → ejecutar con el pago.
//
// La plaza (VG, 7-11): una POSICIÓN con capacidad dentro del elemento
// habitación. Las reservas son sus ocupantes: colisionan en la plaza y se
// ven todas, pero solo tantas como su capacidad pueden ser VÁLIDAS a la vez
// (una por cama y noche). La validez se fija al EJECUTAR en la fábrica: el
// motor se niega a ejecutar una reserva si la plaza ya tiene, en su tramo,
// tantas reservas ejecutadas como capacidad (motor.ocupacion).
//
// Pendiente, decidido por VG (mapa §12, 7-11: «las dos cosas a la vez»): la
// serie limitada de tokens de plaza. Además de la posición con capacidad, la
// casa emite una serie de E (un token por plaza y noche, tantos como
// capacidad) y ejecutar la reserva mueve esos tokens al huésped. Aquí solo
// está la mitad «posición»: la otra exige que la ejecución mueva en el mismo
// acto tokens de la casa (o de la habitación, como cosa titular) y del
// huésped, y el motor V0 ejecuta solo el autor de la consolidación y nadie
// mueve tokens ajenos.
// [X] decidir VG: la ejecución de dos partes mientras AARPIA no exista (quién
// entrega los tokens de plaza, con qué consolidación y en qué orden respecto
// al pago). Mientras tanto la ejecución se titula «Pagada y válida»: hay
// evidencia del pago y de que la plaza tenía sitio.

import { Eje } from '../../src/eje.js';
import { direccion } from '../../src/btml.js';
import { evaluar } from '../../src/bql.js';
import { descubrir, consolidar, autorizar, ejecutar, consolidaciones, autorizacionesValidas, FABRICA } from '../../src/motor.js';

/** Las plazas de la habitación: cada una en la posición 1.k de sus recursos. */
export const PLAZAS = Object.freeze({ matrimonio: 0, individual: 1, litera: 2 });

/** Dirección de una plaza dentro de la habitación (1.k): ahí se anclan sus reservas. */
export function plaza(k) {
  return direccion([1, k]);
}

/** Dirección del precio de una plaza (1.k.1): dentro de la plaza, no en un array aparte. */
export function precioDe(k) {
  return direccion([1, k, 1]);
}

/**
 * El elemento habitación: 0 su nombre; 1 sus recursos, que son sus plazas
 * (1.k), cada una [nombre, precio por noche, capacidad]; 2 criterios; 3 quién
 * atiende; 4 la acción que ofrece. La capacidad va en el criterio de la plaza
 * (su posición 2: cuántas reservas caben a la vez) y es lo que lee el motor
 * (motor.capacidadDe; [X] en motor.CRITERIO_CAPACIDAD).
 * Límite conocido de los ceros finales: la primera plaza (1.0) colisiona con
 * la posición 1 entera y con su propio nombre (1.0.0) en 1000000000; el
 * motor mira toda la colisión y solo la plaza declara capacidad.
 */
export const HABITACION = Object.freeze([
  'Habitación del jardín', // 0 representación
  [
    ['cama de matrimonio', 'EUR 80', 1], // 1.0 plaza: una pareja por noche
    ['cama individual', 'EUR 55', 1], // 1.1 plaza: una persona por noche
    ['litera', 'EUR 25', 2], // 1.2 plaza: dos camas, dos reservas a la vez
  ], // 1 recursos: las plazas
  ['sin humo', 'con desayuno'], // 2 criterios
  ['recepcion'], // 3 comunicación: quién atiende
  'reservar', // 4 fábrica: la acción que se ofrece
]);

/** Movimiento de T: escribir cuesta minutos de quien escribe. */
const minutos = (de, cantidad = 1) => ({ token: 'T', escala: 'minuto', cantidad, de, a: null });

/** EUR de la casa: la serie E:casa/EUR. */
const eur = (cantidad, de, a) => ({ token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad, de, a });

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
    tipo: 'grupo', // solo personas y grupos emiten
    emision: [
      { token: 'T', escala: 'hora', cantidad: 1000 },
      { token: 'T', escala: 'minuto', cantidad: 5000 }, // otro token: escribir cuesta minutos
      { token: 'E', denominacion: 'EUR', cantidad: 500 }, // la serie E:casa/EUR
      { token: 'P', cantidad: 10, ambito: 'genesis' }, // poder de la casa sobre todo su eje
    ],
    foco: 'Casa rural de ejemplo',
    t,
    clave: claves.casa?.publica,
    privada: priv('casa'),
  });

  // La casa da de alta a recepción y a una persona huésped (con dinero para
  // pagar): existen al recibir tokens, y el alta declara qué es cada una.
  const declaradas = {};
  for (const id of ['recepcion', 'huesped']) if (claves[id]?.publica) declaradas[id] = claves[id].publica;
  const alta = await eje.escribir({
    autor: 'casa',
    sobre: eje.genesisId,
    t,
    movimientos: [
      minutos('casa'),
      { token: 'T', escala: 'hora', cantidad: 40, de: 'casa', a: 'recepcion' },
      { token: 'T', escala: 'minuto', cantidad: 600, de: 'casa', a: 'recepcion' },
      eur(300, 'casa', 'huesped'),
      { token: 'T', escala: 'hora', cantidad: 72, de: 'casa', a: 'huesped' },
      { token: 'T', escala: 'minuto', cantidad: 600, de: 'casa', a: 'huesped' },
    ],
    payload: ['Altas de la temporada', ['recepcion', 'huesped']],
    contexto: { tipos: { recepcion: 'persona', huesped: 'persona' }, ...(Object.keys(declaradas).length ? { claves: declaradas } : {}) },
  }, priv('casa'));

  // El dominio (VG, 7-11): un registro «Alojamiento» de la casa. Todo lo de
  // Booking cuelga de él, y el poder de recepción tiene ese ámbito.
  const alojamiento = await eje.escribir({
    autor: 'casa',
    sobre: eje.genesisId,
    t,
    movimientos: [minutos('casa')],
    payload: 'Alojamiento',
  }, priv('casa'));

  // La casa delega en recepción el poder de confirmar, con el ámbito del
  // dominio: recepción autoriza lo que cuelga del Alojamiento (y puede
  // delegar hacia abajo), nada más. Va en un evento propio: P exige un ámbito
  // que ya exista.
  const delegacion = await eje.escribir({
    autor: 'casa',
    sobre: alojamiento.id,
    t,
    movimientos: [minutos('casa'), { token: 'P', cantidad: 3, ambito: alojamiento.id, de: 'casa', a: 'recepcion' }],
    payload: 'Recepción atiende el alojamiento',
  }, priv('casa'));

  // La casa publica el elemento habitación con sus plazas, sobre el dominio.
  const habitacion = await eje.escribir({
    autor: 'casa',
    sobre: alojamiento.id,
    t,
    movimientos: [minutos('casa', 10)],
    payload: structuredClone(HABITACION), // copia: el payload de un evento no comparte arrays con nadie
  }, priv('casa'));

  const reserva = await reservar(eje, {
    autor: 'huesped',
    habitacion,
    plaza: PLAZAS.individual,
    noches: ['2026-11-20', '2026-11-23'],
    t: '2026-11-08T18:30:00Z',
    privada: priv('huesped'),
  });

  const resultado = { eje, alta, alojamiento, delegacion, habitacion, reserva };
  if (!confirmar) return resultado;
  return { ...resultado, ...(await confirmarReserva(eje, reserva, { claves })) };
}

/**
 * Una reserva: la escribe quien reserva sobre la habitación, ANCLADA EN LA
 * PLAZA (en = 1.k), con las noches en su propio futuro (7): [entrada,
 * salida], la salida no se ocupa. La plaza y su precio van por referencia
 * (no copias); las fórmulas viven en la misma décupla anidada (1), porque
 * LOCAL lee a su profundidad. Las reservas de una plaza colisionan en ella:
 * escribirlas no reserva nada; la validez llega al ejecutar.
 * [X] decidir VG: qué llevan 4–6 de una reserva para llegar al 7 sin huecos
 * (VG: sin «no aplicable»). Aquí, contenido propio: 4 las acciones que
 * prepara, 5 su lugar en el árbol (la plaza que ocupa, mapa §8) y 6 el hilo
 * de donde viene (la habitación, §10: hilos = cadena por referencia).
 * [X] BQL no resta fechas: el número de noches (1.1) se escribe aparte del
 * tramo (7); en el dato, nada comprueba que coincidan.
 */
export async function reservar(eje, { autor, habitacion, plaza: k, noches, t, nombre, privada }) {
  const [entrada, salida] = noches;
  const n = Math.round((Date.parse(salida) - Date.parse(entrada)) / 86400000);
  const plazaElegida = habitacion.payload[1][k];
  return eje.escribir({
    autor,
    sobre: habitacion.id,
    en: plaza(k),
    t,
    movimientos: [minutos(autor, 15)],
    payload: [
      nombre ?? 'Reserva de la ' + plazaElegida[0] + ', ' + n + ' noches', // 0 representación
      [
        { ref: habitacion.id, dir: plaza(k) }, // 1.0 la plaza: [nombre, precio, capacidad]
        n, // 1.1 noches
        { ref: habitacion.id, dir: precioDe(k) }, // 1.2 precio por noche: dentro de la plaza elegida
        '=LOCAL(2) * LOCAL(1)', // 1.3 total: precio por noche × noches
        '=LOCAL(3) + LOCAL(1) * 1 dia', // 1.4 el total compuesto con el tiempo que ocupa
      ], // 1 recursos
      [{ ref: habitacion.id, dir: '2100000000' }], // 2 criterios: el que importa, con desayuno
      [autor, 'recepcion'], // 3 comunicación: quién habla con quién
      ['pagar', 'ocupar'], // 4 fábrica: lo que prepara
      { ref: habitacion.id, dir: plaza(k) }, // 5 estructura: su lugar en el árbol, la plaza que ocupa
      { ref: habitacion.id }, // 6 pasado: el hilo de donde viene
      [entrada, salida], // 7 futuro: las noches (tramo)
    ],
  }, privada);
}

/**
 * Confirmación por el ciclo del motor. Quien reservó consolida en la fábrica
 * de su reserva lo que elige (la plaza y el criterio, por referencia a la
 * habitación; lo que va a pagar, como fórmula que lee el total); recepción
 * autoriza (tiene P sobre el Alojamiento y no es la autora); quien reservó
 * ejecuta con el pago E a la casa. Consolidar no es pagar: el E se mueve al
 * ejecutar. Y la fábrica fija la validez: si la plaza ya está llena en esas
 * noches, ejecutar se niega («capacidad agotada») y la reserva queda escrita
 * y autorizada pero no válida, sin cobro. Idempotente: si la reserva ya
 * tiene una consolidación ejecutada, devuelve esa confirmación (con
 * yaConfirmada) y no cobra dos veces.
 */
export async function confirmarReserva(eje, reserva, { claves = {}, t = '2026-11-09T09:00:00Z', recepcion = 'recepcion' } = {}) {
  const hecha = consolidaciones(eje, reserva.id).find((c) => c.estado === 'EJECUTADO');
  if (hecha) {
    const consolidacion = eje.obtener(hecha.id);
    const autorizacion = autorizacionesValidas(eje, hecha.id)[0];
    const ejecucion = eje.sobre(hecha.id, FABRICA).find((e) => e.contexto?.fase === 'ejecutado' && e.autor === consolidacion.autor);
    return { consolidacion, autorizacion, ejecucion, yaConfirmada: true };
  }
  const priv = (id) => claves[id]?.privada;
  const quien = reserva.autor;
  const d = descubrir(eje, reserva.id);
  const alcanzado = (posicion) => d.find((p) => p.posicion === posicion).candidatos.find((c) => c.origen === 'referencia');
  const consolidacion = await consolidar(eje, {
    autor: quien,
    foco: reserva.id,
    t,
    titulo: 'Reserva en firme',
    elecciones: {
      1: { candidato: alcanzado(1) }, // la plaza alcanzada por la referencia
      2: { candidato: alcanzado(2) }, // el criterio alcanzado por la referencia
      4: '=REF("' + reserva.id + '", "1300000000")', // lo que se va a pagar: el total de la reserva (id completo)
    },
  }, priv(quien));
  const autorizacion = await autorizar(eje, { autorizante: recepcion, consolidacion: consolidacion.id, t, nota: 'confirmada' }, priv(recepcion));
  // La consulta no tiene efectos: el efecto es la ejecución, que mueve el E.
  const total = evaluar(eje, consolidacion.id, [4]);
  if (total.estado !== 'RESUELTO' || total.valor.tipo !== 'magnitud' || total.valor.unidad !== 'EUR') throw new Error('total no resuelto: ' + total.texto);
  const ejecucion = await ejecutar(eje, {
    autor: quien,
    consolidacion: consolidacion.id,
    t,
    titulo: 'Pagada y válida', // evidencia del pago y de que la plaza tenía sitio (ver [X] tokens de plaza en la cabecera)
    movimientos: [eur(total.valor.cantidad, quien, 'casa')],
  }, priv(quien));
  return { consolidacion, autorizacion, ejecucion };
}
