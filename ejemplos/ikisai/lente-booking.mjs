// La lente de R en Booking (R6 del estudio de neutralidad; VG, 7-11 noche),
// con datos inventados. Sobre la reserva de ejemplo (reserva-booking.mjs,
// sin confirmar), la casa decide cuánto le vale la reputación que traen sus
// huéspedes: solo la de quien ella nombra en su lente.
//
//   · Dos asociaciones de vecinos, «vecinos-norte» y «vecinos-sur», son
//     REGISTROS, no identidades (VG, 8-11: «los grupos son solo delegación»):
//     cada una la escribe su secretaria, la persona fundadora, que emite P
//     sobre ese registro (pertenecer es tener ese P, que ella puede delegar).
//     La R la emite la secretaria a su nombre, con su propio colateral
//     (src/lente.js: una décima parte de lo emitido), y la da ella: la del
//     norte, 10 de sus 100 a la huésped; la del sur, 20 de sus 100.
//   · Una identidad nueva, «recien», se autoemite un millón de R (con su
//     colateral, cien mil) y le da medio millón a la huésped y mil a la casa.
//   · La casa firma su lente en la posición 3 de su alta (el génesis): peso 1 a
//     la secretaria del norte y 0,5 a la del sur. Nada más. La lente pesa a
//     personas; un atajo «peso para quien tenga P sobre este registro» queda
//     para decidir VG (docs/FUNDAMENTOS.md).
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

/** Las dos asociaciones (registros) y la persona que escribe cada una y emite su R. */
export const ASOCIACIONES = Object.freeze({
  'vecinos-norte': Object.freeze({ secretaria: 'secretaria-norte', emite: 100, aLaHuesped: 10 }),
  'vecinos-sur': Object.freeze({ secretaria: 'secretaria-sur', emite: 100, aLaHuesped: 20 }),
});

/** La lente de la casa: el peso que da a cada emisor de R (personas). Quien no está, pesa 0. */
export const LENTE_DE_LA_CASA = Object.freeze({ 'secretaria-norte': 1, 'secretaria-sur': 0.5 });

/** La identidad nueva que se autoemite mucha R. */
export const RECIEN = 'recien';

const minutos = (de, cantidad = 1) => ({ token: 'T', escala: 'minuto', cantidad, de, a: null });
const daEuro = (de, a) => ({ token: 'E', emisor: CASA, denominacion: 'EUR', cantidad: 1, de, a });
const R = (emisor, cantidad, de, a) => ({ token: 'R', emisor, cantidad, de, a });

/**
 * Construye el ejemplo: la reserva sin confirmar, el alta de las personas
 * (secretarias y «recien»), el registro de cada asociación con el P de su
 * secretaria, la R de cada una y la lente de la casa. Devuelve
 * { eje, huesped, altas, asociaciones, lente, ... } con lo escrito
 * (`asociaciones`: nombre → su registro).
 */
export async function ejemploLente({ t = '2026-11-08T20:00:00Z' } = {}) {
  const base = await ejemploReserva({ confirmar: false });
  const { eje } = base;
  // Una hora después de las altas: cada persona escribe con su propio T, que acuña al gastarlo dentro del tope de su
  // reloj (VG, 7-11 noche; Core, 8-11). T no cruza de persona.
  const luego = new Date(Date.parse(t) + 3600e3).toISOString();

  // La casa da de alta a las secretarias y a «recien» (personas).
  const nombres = Object.keys(ASOCIACIONES);
  const personas = [...nombres.map((n) => ASOCIACIONES[n].secretaria), RECIEN];
  const altas = await eje.escribir({
    autor: CASA, sobre: eje.genesisId, t, payload: ['Altas de vecinos', personas],
    movimientos: [minutos(CASA), ...personas.map((id) => daEuro(CASA, id))], // existen al recibir tokens
    contexto: { tipos: Object.fromEntries(personas.map((p) => [p, 'persona'])) },
  });

  // Cada secretaria escribe el registro de su asociación (un grupo es un registro) y, sobre él, emite su R con su
  // colateral (R6: la décima parte), da una parte a la huésped y emite P sobre el registro (T + R + P): ese P es
  // la asociación; lo delega a quien entre.
  const asociaciones = {};
  for (const n of nombres) {
    const { secretaria, emite, aLaHuesped } = ASOCIACIONES[n];
    asociaciones[n] = await eje.escribir({ autor: secretaria, sobre: altas.id, t: luego, payload: ['Asociación', n], movimientos: [minutos(secretaria)] });
    const registro = asociaciones[n].id;
    await eje.escribir({
      autor: secretaria, sobre: registro, t: luego, payload: 'Reputación de ' + secretaria + ' en ' + n,
      movimientos: [
        minutos(secretaria),
        R(secretaria, emite, null, secretaria), colateral(secretaria, emite / 10), R(secretaria, aLaHuesped, secretaria, 'huesped'),
        { token: 'P', ambito: registro, cantidad: 1, de: null, a: secretaria },
      ],
    });
  }

  // «recien» se autoemite mucha R (con su colateral) y la reparte: a la huésped y a la casa.
  await eje.escribir({
    autor: RECIEN, sobre: altas.id, t: luego, payload: 'Mucha reputación',
    movimientos: [minutos(RECIEN), R(RECIEN, 1e6, null, RECIEN), colateral(RECIEN, 1e5), R(RECIEN, 5e5, RECIEN, 'huesped'), R(RECIEN, 1000, RECIEN, CASA)],
  });

  // La casa firma su lente: en la posición 3 de su alta (para la casa, el génesis).
  const lente = await declararLente(eje, { lector: CASA, pesos: LENTE_DE_LA_CASA, t: luego });
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
