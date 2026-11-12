// La lente de R en Booking (encargo 3b; VG, 9-11, mapa §15 [D] «R según el corpus» y §16 [D] «PV3 = regla de
// atención»), con datos inventados. Sobre la reserva de ejemplo (reserva-booking.mjs, sin confirmar), la casa decide
// cuánto le vale la reputación que traen sus huéspedes: la lente de R y las condiciones de aceptación son la misma
// cosa («aceptar tu R como pago es darte peso»), así que solo vale la R de quien la casa pone en un grupo de su
// atención que cobra con la R de quien escribe («their R»).
//
//   · Dos asociaciones de vecinos, «vecinos-norte» y «vecinos-sur», son REGISTROS, no identidades (VG, 8-11: «los
//     grupos son solo delegación»): cada una la escribe su secretaria, una persona que la casa invita. La R la emite
//     la secretaria a su nombre, sin colateral (VG, 9-11: el respaldo es la obligación de atender), y la da ella: la
//     del norte, 10 de sus 100 a la huésped; la del sur, 20 de sus 100.
//   · Una identidad nueva, «recien», se autoemite un millón de R y le da medio millón a la huésped y mil a la casa.
//   · La casa pone a las dos secretarias en su grupo de cercanos (la zona 3, cuyo precio es su R): lo ancla en el
//     3.3.3 de su alta, quiénes de esa zona. Nada más.
//
// Para la casa, la huésped vale 10 + 20 = 30: cada unidad de R cuenta una (VG, 9-11: se retira la valoración por
// participación). La R de «recien» no vale nada (la casa no la acepta como pago), ni en manos de la huésped ni en
// las suyas propias: recibir R no mete a su emisor en la lente. La propia «recien» vale 0 para la casa, tenga la R
// que tenga de sí misma. Y recepción, que no acepta la R de nadie, no la valora: 0.
//
// `node ejemplos/ikisai/correr.mjs` imprime los valores al final.

import { ejemploReserva, CASA } from './reserva-booking.mjs';
import { entrarPorInvitacion } from './altas.mjs';
import { valor, detalleValor } from '../../src/lente.js';
import { consultar } from '../../src/bql.js';
import { pagaElCoste, escribirPagando } from './coste.mjs';

/** Las dos asociaciones (registros) y la persona que escribe cada una y emite su R. */
export const ASOCIACIONES = Object.freeze({
  'vecinos-norte': Object.freeze({ secretaria: 'secretaria-norte', emite: 100, aLaHuesped: 10 }),
  'vecinos-sur': Object.freeze({ secretaria: 'secretaria-sur', emite: 100, aLaHuesped: 20 }),
});

/** Quiénes pone la casa en su grupo de cercanos (zona 3: cobran con su R): su lente. */
export const CERCANOS_DE_LA_CASA = Object.freeze(['secretaria-norte', 'secretaria-sur']);

/** La identidad nueva que se autoemite mucha R. */
export const RECIEN = 'recien';

const minutos = (de, cantidad) => (cantidad === undefined ? pagaElCoste(de) : { token: 'T', escala: 'minuto', cantidad, de, a: null });
const daEuro = (de, a) => ({ token: 'E', emisor: CASA, denominacion: 'EUR', cantidad: 1, de, a });
const R = (emisor, cantidad, de, a) => ({ token: 'R', emisor, cantidad, de, a });

/**
 * Construye el ejemplo: la reserva sin confirmar, la entrada por invitación de las personas (secretarias y
 * «recien»), el registro de cada asociación, la R de cada una y el grupo de cercanos de la casa. Devuelve
 * { eje, huesped, altas, asociaciones, lente, ... } con lo escrito (`asociaciones`: nombre → su registro; `lente`:
 * el registro de la casa que nombra a sus cercanos).
 */
export async function ejemploLente({ t = '2026-11-08T20:00:00Z' } = {}) {
  const base = await ejemploReserva({ confirmar: false });
  const { eje } = base;
  // Una hora después de las altas: cada persona escribe con su asignación de T del día (VG, 8-11).
  const luego = new Date(Date.parse(t) + 3600e3).toISOString();

  // La casa invita a las secretarias y a «recien» (aceptan: su alta) y les da un euro.
  const nombres = Object.keys(ASOCIACIONES);
  const personas = [...nombres.map((n) => ASOCIACIONES[n].secretaria), RECIEN];
  for (const id of personas) await entrarPorInvitacion(eje, { por: CASA, quien: id, t });
  const altas = await escribirPagando(eje, {
    autor: CASA, sobre: eje.genesisId, t, payload: ['Altas de vecinos', personas],
    movimientos: [minutos(CASA), ...personas.map((id) => daEuro(CASA, id))],
  });

  // Cada secretaria escribe el registro de su asociación (un grupo es un registro) y, sobre él, emite su R (emitir R
  // exige T real: el minuto que quema) y da una parte a la huésped.
  const asociaciones = {};
  for (const n of nombres) {
    const { secretaria, emite, aLaHuesped } = ASOCIACIONES[n];
    asociaciones[n] = await escribirPagando(eje, { autor: secretaria, sobre: altas.id, t: luego, payload: ['Asociación', n], movimientos: [minutos(secretaria)] });
    await escribirPagando(eje, {
      autor: secretaria, sobre: asociaciones[n].id, t: luego, payload: 'Reputación de ' + secretaria + ' en ' + n,
      movimientos: [minutos(secretaria), R(secretaria, emite, null, secretaria), R(secretaria, aLaHuesped, secretaria, 'huesped')],
    });
  }

  // «recien» se autoemite mucha R y la reparte: a la huésped y a la casa.
  await escribirPagando(eje, {
    autor: RECIEN, sobre: altas.id, t: luego, payload: 'Mucha reputación',
    movimientos: [minutos(RECIEN), R(RECIEN, 1e6, null, RECIEN), R(RECIEN, 5e5, RECIEN, 'huesped'), R(RECIEN, 1000, RECIEN, CASA)],
  });

  // La casa pone a las secretarias en su grupo de cercanos: en el 3.3.3 de su alta (para la casa, el génesis).
  const lente = await escribirPagando(eje, {
    autor: CASA, sobre: eje.genesisId, en: '3330000000', t: luego, payload: [...CERCANOS_DE_LA_CASA],
    movimientos: [minutos(CASA)],
  });
  return { ...base, altas, asociaciones, lente };
}

/** El valor de cada identidad para la casa, y la fórmula BQL que lo lee. */
export function valoresParaLaCasa(eje) {
  return Object.fromEntries(['huesped', RECIEN, CASA, 'secretaria-norte'].map((id) => [id, valor(eje, CASA, id)]));
}

/** La misma lectura en BQL, como la haría la casa (o quien se diga) desde la reserva: =VALOR_R("huesped"). */
export function valorEnBql(eje, reserva, lector = CASA, titular = 'huesped') {
  return consultar(eje, reserva.id, [], '=VALOR_R("' + titular + '")', { lector });
}

export { detalleValor };
