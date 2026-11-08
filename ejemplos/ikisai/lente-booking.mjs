// La lente de R en Booking (R6 del estudio de neutralidad; VG, 7-11 noche),
// con datos inventados. Sobre la reserva de ejemplo (reserva-booking.mjs,
// sin confirmar), la casa decide cuánto le vale la reputación que traen sus
// huéspedes: solo la de quien ella nombra en su lente.
//
//   · Dos asociaciones de vecinos, «vecinos-norte» y «vecinos-sur», son GRUPOS:
//     su R la emite, con su firma, la persona que las lleva (la secretaria), que
//     tiene P sobre el registro del grupo y bloquea R suya como colateral de la
//     serie del grupo (src/lente.js: una décima parte de lo emitido). El grupo
//     la reparte después: el norte da 10 de sus 100 a la huésped; el sur, 20 de
//     sus 100.
//   · Una identidad nueva, «recien», se autoemite un millón de R (con su
//     colateral, cien mil) y le da medio millón a la huésped y mil a la casa.
//   · La casa firma su lente en la posición 3 de su alta (el génesis): peso 1 al
//     norte y 0,5 al sur. Nada más.
//
// Para la casa, la huésped vale 1 × 10/100 + 0,5 × 20/100 = 0,2. La R de
// «recien» no vale nada (la casa no la nombra), ni en manos de la huésped ni en
// las suyas propias: recibir R no mete a su emisor en la lente. La propia
// «recien» vale 0 para la casa, tenga la R que tenga de sí misma. Y quien no
// ha firmado lente (recepción) no valora la R de nadie: en BQL, PENDIENTE.
//
// `node ejemplos/ikisai/correr.mjs` imprime los valores al final.

import { ejemploReserva, CASA } from './reserva-booking.mjs';
import { colateral, declararLente, valor, detalleValor } from '../../src/lente.js';
import { consultar } from '../../src/bql.js';

/** Las dos asociaciones (grupos) y quien emite en su nombre. */
export const ASOCIACIONES = Object.freeze({
  'vecinos-norte': Object.freeze({ secretaria: 'secretaria-norte', emite: 100, aLaHuesped: 10 }),
  'vecinos-sur': Object.freeze({ secretaria: 'secretaria-sur', emite: 100, aLaHuesped: 20 }),
});

/** La lente de la casa: el peso que da a cada emisor de R. Quien no está, pesa 0. */
export const LENTE_DE_LA_CASA = Object.freeze({ 'vecinos-norte': 1, 'vecinos-sur': 0.5 });

/** La identidad nueva que se autoemite mucha R. */
export const RECIEN = 'recien';

const minutos = (de, cantidad = 1) => ({ token: 'T', escala: 'minuto', cantidad, de, a: null });
const daEuro = (de, a) => ({ token: 'E', emisor: CASA, denominacion: 'EUR', cantidad: 1, de, a });
const R = (emisor, cantidad, de, a) => ({ token: 'R', emisor, cantidad, de, a });

/**
 * Construye el ejemplo: la reserva sin confirmar, las altas de las
 * asociaciones y de «recien», la R de cada una y la lente de la casa.
 * Devuelve { eje, huesped, lente, ... } con lo escrito.
 */
export async function ejemploLente({ t = '2026-11-08T20:00:00Z' } = {}) {
  const base = await ejemploReserva({ confirmar: false });
  const { eje } = base;
  // Una hora después de las altas: cada persona escribe con su propio T, que acuña al gastarlo dentro del tope de su
  // reloj (VG, 7-11 noche; Core, 8-11). T no cruza de persona, y un grupo no recibe T.
  const luego = new Date(Date.parse(t) + 3600e3).toISOString();

  // La casa da de alta a las asociaciones (grupos), a sus secretarias y a «recien» (personas).
  const grupos = Object.keys(ASOCIACIONES);
  const personas = [...grupos.map((g) => ASOCIACIONES[g].secretaria), RECIEN];
  const altas = await eje.escribir({
    autor: CASA, sobre: eje.genesisId, t, payload: ['Altas de vecinos', [...grupos, ...personas]],
    movimientos: [minutos(CASA), ...[...grupos, ...personas].map((id) => daEuro(CASA, id))], // existen al recibir tokens
    contexto: { tipos: { ...Object.fromEntries(grupos.map((g) => [g, 'grupo'])), ...Object.fromEntries(personas.map((p) => [p, 'persona'])) } },
  });
  // Cada secretaria recibe P sobre el registro de su grupo (su alta): con él emite en su nombre.
  await eje.escribir({
    autor: CASA, sobre: altas.id, t, payload: 'Quién lleva cada asociación',
    movimientos: [minutos(CASA), ...grupos.map((g) => ({ token: 'P', ambito: altas.id, cantidad: 1, de: CASA, a: ASOCIACIONES[g].secretaria }))],
  });

  for (const g of grupos) {
    const { secretaria, emite, aLaHuesped } = ASOCIACIONES[g];
    // La secretaria emite su R (con su colateral) y la R del grupo, respaldada con R suya bloqueada
    // con la salida «R:<grupo>»: la décima parte de lo que emite el grupo (R6).
    await eje.escribir({
      autor: secretaria, sobre: altas.id, t: luego, payload: 'Reputación de ' + g,
      movimientos: [
        minutos(secretaria),
        R(secretaria, 20, null, secretaria), colateral(secretaria, 2), colateral(secretaria, emite / 10, g),
        R(g, emite, null, g),
      ],
    });
    // El grupo la reparte: una parte a la huésped. Lo hace su secretaria, con P sobre el alta del grupo, por su
    // cuenta (regla de Core, [X] confirmar VG: «lo que hace un grupo lo hace una persona con P sobre él, con su firma»).
    await eje.escribir({ autor: secretaria, sobre: altas.id, t: luego, payload: g + ' avala a la huésped', contexto: { porCuenta: g }, movimientos: [minutos(secretaria), R(g, aLaHuesped, g, 'huesped')] });
  }

  // «recien» se autoemite mucha R (con su colateral) y la reparte: a la huésped y a la casa.
  await eje.escribir({
    autor: RECIEN, sobre: altas.id, t: luego, payload: 'Mucha reputación',
    movimientos: [minutos(RECIEN), R(RECIEN, 1e6, null, RECIEN), colateral(RECIEN, 1e5), R(RECIEN, 5e5, RECIEN, 'huesped'), R(RECIEN, 1000, RECIEN, CASA)],
  });

  // La casa firma su lente: en la posición 3 de su alta (para la casa, el génesis).
  const lente = await declararLente(eje, { lector: CASA, pesos: LENTE_DE_LA_CASA, t: luego });
  return { ...base, altas, lente };
}

/** El valor de cada identidad para la casa, y la fórmula BQL que lo lee. */
export function valoresParaLaCasa(eje) {
  return Object.fromEntries(['huesped', RECIEN, CASA, 'vecinos-norte'].map((id) => [id, valor(eje, CASA, id)]));
}

/** La misma lectura en BQL, como la haría la casa (o quien se diga) desde la reserva: =VALOR_R("huesped"). */
export function valorEnBql(eje, reserva, lector = CASA, titular = 'huesped') {
  return consultar(eje, reserva.id, [], '=VALOR_R("' + titular + '")', { lector });
}
