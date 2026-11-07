// Segundo ejemplo transversal con datos inventados: una reserva de alojamiento
// (Booking) en una casa rural. Existe para forzar que el núcleo sea genérico y
// no esté moldeado por la compra de comida: otro dominio, otra décupla, otro
// ciclo. Construye su propio eje: génesis de la casa (una persona); altas de
// recepción y de una persona huésped; la casa escribe su dominio
// «Alojamiento» y delega en recepción el poder (P) con ese ámbito; publica la
// disponibilidad (el elemento habitación, con sus plazas en 1.k) y abre la
// temporada emitiendo la serie de plazas; la persona huésped escribe la
// reserva anclada en una plaza, con las noches en su propio 7; recepción
// confirma por el ciclo del motor: consolidar → autorizar → ejecutar.
//
// La plaza (VG, 7-11, «las dos cosas a la vez»): una POSICIÓN de la
// habitación donde las reservas colisionan (se escriben y se ven todas), y una
// SERIE LIMITADA de tokens E emitida por la casa: «<plaza>@<noche>», un token
// por plaza y noche, tantos como capacidad. Ejecutar la reserva mueve esos
// tokens de la casa a la persona huésped; la segunda reserva solapada se
// escribe y colisiona, pero no se ejecuta: la casa ya no tiene el token de
// esa noche (saldo insuficiente). El contador del motor (motor.ocupacion)
// solo informa.
//
// La E atada al recurso (VG, 7-11 noche, R2 del estudio de neutralidad): la
// casa declara la capacidad en su registro de alojamiento (posición 2 de su
// payload: 4 plazas), acuña su P sobre él y lo bloquea plaza a plaza; cada
// serie de plaza va atada a la habitación (`registro`, en la clave tras la
// última «@») y hereda el tope del alojamiento, que se cuenta POR FRANJA (la
// noche, tras la «@» de la denominación): el E vivo de cada noche, sumando
// todas las plazas y emisores de esa noche, no pasa de 4, y ninguna otra
// identidad añade plazas por encima. Cada noche caduca a la hora de salida
// del día siguiente, y entonces su E deja de estar vivo.
//
// [X] decidir VG: titular de los tokens de plaza. La corrección de VG sobre
// titulares (mapa §12, 7-11 tarde) dice que una persona emite los tokens de
// plaza «y se los da a la habitación; la habitación los conserva y los
// maneja». Este ejemplo sigue la decisión anterior (mapa §12, mediodía:
// «mover esos tokens de la casa al huésped»): la serie se queda en la
// cartera de la casa y la entrega la ejecuta la casa. Pasarla a la habitación
// exige decidir cómo se liga el registro de la habitación con la identidad
// (una cosa) titular de sus plazas y quién consolida y ejecuta la entrega en
// su nombre (docs/MOTOR.md §5.1).
//
// [X] decidir VG: la ejecución de dos partes mientras AARPIA no exista. El
// motor V0 ejecuta solo el autor de la consolidación y nadie mueve tokens
// ajenos, así que confirmar son dos consolidaciones sobre la reserva, las dos
// autorizadas por recepción: primero la casa entrega los tokens de plaza
// («ocupar»), después la persona huésped paga («pagar»). Sin atomicidad: si
// el pago fallara después de la entrega, la plaza quedaría entregada sin
// cobrar; por eso, antes de escribir nada, se comprueba que hay saldo para
// pagar. La atomicidad es de AARPIA.

import { Eje } from '../../src/eje.js';
import { direccion, indicesDe, esReferencia } from '../../src/btml.js';
import { evaluar } from '../../src/bql.js';
import { costeT } from '../../src/escritura.js';
import { familiaDe } from '../../src/tokens.js';
import { descubrir, consolidar, autorizar, ejecutar, consolidaciones, autorizacionesValidas, capacidadDe, tramoDe, FABRICA } from '../../src/motor.js';

/** La casa: la persona que respalda las plazas y emite su serie (VG, 7-11 noche: solo emiten personas). */
export const CASA = 'casa';

/** Las plazas de la habitación: cada una en la posición 1.k de sus recursos. */
export const PLAZAS = Object.freeze({ matrimonio: 0, individual: 1, litera: 2 });

/** Noches que abre la casa: [primera, fin), la noche del fin no. */
export const TEMPORADA = Object.freeze(['2026-11-16', '2026-11-30']);

/** Dirección de una plaza dentro de la habitación (1.k): ahí se anclan sus reservas. */
export function plaza(k) {
  return direccion([1, k]);
}

/** Dirección del precio de una plaza (1.k.1): dentro de la plaza, no en un array aparte. */
export function precioDe(k) {
  return direccion([1, k, 1]);
}

/**
 * La disponibilidad (mapa §12: «en la plaza, dentro de los recursos de la
 * disponibilidad (1.k)»): un elemento por habitación, colgado del dominio
 * Alojamiento. 0 su nombre; 1 sus recursos, que son sus plazas (1.k), una
 * subdécupla por plaza [[nombre], precio por noche, capacidad] (por hojas,
 * VG 7-11 noche: el nombre va envuelto para que la plaza sea décupla y no
 * una lista de tres ocupantes); 2 criterios, una lista;
 * 3 quién atiende; 4 la acción que ofrece. La capacidad va en el criterio de
 * la plaza (su posición 2: cuántas reservas caben a la vez; [X] en
 * motor.CRITERIO_CAPACIDAD) y dice cuántos tokens emite la casa por noche.
 * Límite conocido de los ceros finales: la primera plaza (1.0) colisiona con
 * la posición 1 entera y con su propio nombre (1.0.0) en 1000000000.
 */
export const HABITACION = Object.freeze([
  'Habitación del jardín', // 0 representación
  [
    [['cama de matrimonio'], 'EUR 80', 1], // 1.0 plaza: una pareja por noche
    [['cama individual'], 'EUR 55', 1], // 1.1 plaza: una persona por noche
    [['litera'], 'EUR 25', 2], // 1.2 plaza: dos camas, dos reservas a la vez
  ], // 1 recursos: las plazas
  ['sin humo', 'con desayuno'], // 2 criterios: una lista de dos ocupantes
  ['recepcion'], // 3 comunicación: quién atiende (una lista de uno)
  'reservar', // 4 fábrica: la acción que se ofrece
]);

/**
 * Denominación de la serie de una plaza en una noche: «<plaza>@<noche>»,
 * con la plaza nombrada por su dirección en la habitación (1.k). La
 * habitación ya no va en la denominación: es el REGISTRO de la serie (R2),
 * así que dos habitaciones no comparten serie. Va sin «|», «:» ni «/», como
 * toda denominación.
 * [X] decidir VG: cómo se nombra la plaza dentro de la denominación.
 */
export function denominacionPlaza(k, noche) {
  return plaza(k) + '@' + noche;
}

/** Clave de saldo de esa serie: E:casa/<plaza>@<noche>@<habitación>. */
export function seriePlaza(habitacionId, k, noche) {
  return 'E:' + CASA + '/' + denominacionPlaza(k, noche) + '@' + habitacionId;
}

/**
 * Clave de la familia de una plaza: todas sus noches (la franja «*»,
 * tokens.familiaDe). La casa bloquea su P con esta salida, y ese bloqueo
 * respalda la plaza cada noche.
 */
export function familiaPlaza(habitacionId, k) {
  return familiaDe(seriePlaza(habitacionId, k, 'noche'));
}

/** Movimiento de tokens de plaza: la serie de la casa atada a la habitación. */
export function tokenPlaza(habitacionId, k, noche, cantidad, de, a) {
  return { token: 'E', emisor: CASA, denominacion: denominacionPlaza(k, noche), registro: habitacionId, cantidad, de, a };
}

/**
 * [X] decidir VG: a qué hora deja de estar viva la plaza de una noche. Aquí,
 * a las 12:00 UTC del día siguiente (la hora de salida).
 */
export function caducaNoche(noche) {
  return new Date(Date.parse(noche) + 86400000 + 12 * 3600000).toISOString().replace('.000Z', 'Z');
}

/** Plazas por noche de la habitación: la suma de las capacidades de sus plazas (1 + 1 + 2 = 4). */
export const PLAZAS_POR_NOCHE = HABITACION[1].reduce((s, p) => s + (capacidadDe(p) ?? 0), 0);

/**
 * El registro de alojamiento de la casa (R2): declara en su posición 2 la
 * capacidad que respalda, 4 plazas. Es el tope del E vivo, POR NOCHE (la
 * franja de la denominación), de todas las plazas que cuelguen de él.
 */
export const ALOJAMIENTO = Object.freeze(['Alojamiento', Object.freeze(['plazas por noche']), PLAZAS_POR_NOCHE]);

/** Tokens de una plaza y noche que la casa aún tiene: los que quedan por reservar. */
export function libres(eje, habitacionId, k, noche) {
  return eje.saldo(CASA, seriePlaza(habitacionId, k, noche));
}

/** Noches de un tramo [entrada, salida): una por fecha (AAAA-MM-DD), la de salida no. */
export function nochesEntre(entrada, salida) {
  const fecha = /^\d{4}-\d{2}-\d{2}$/;
  if (!fecha.test(entrada) || !fecha.test(salida) || !(Date.parse(entrada) < Date.parse(salida))) {
    throw new Error('las noches van por fecha (AAAA-MM-DD), entrada antes que salida: ' + entrada + ' – ' + salida);
  }
  const noches = [];
  for (let d = Date.parse(entrada); d < Date.parse(salida); d += 86400000) noches.push(new Date(d).toISOString().slice(0, 10));
  return noches;
}

/** Movimiento de T: escribir cuesta minutos de quien escribe. */
const minutos = (de, cantidad = 1) => ({ token: 'T', escala: 'minuto', cantidad, de, a: null });

/** EUR de la casa: la serie E:casa/EUR. */
export const EUR = 'E:' + CASA + '/EUR';
const eur = (cantidad, de, a) => ({ token: 'E', emisor: CASA, denominacion: 'EUR', cantidad, de, a });

/**
 * claves (opcional): { casa: {publica, privada}, recepcion: {...}, huesped: {...} }.
 * Con claves, la casa firma el génesis y declara las claves de las altas, y
 * cada identidad firma lo suyo. Sin claves, el eje funciona sin firmas.
 * confirmar: con false se detiene en la reserva escrita (sin ciclo del motor).
 * temporada: las noches [primera, fin) que abre la casa (TEMPORADA por defecto).
 */
export async function ejemploReserva({ claves = {}, confirmar = true, temporada: noches = TEMPORADA } = {}) {
  const t = '2026-11-07T10:00:00Z';
  const priv = (id) => claves[id]?.privada;
  const eje = await Eje.genesis({
    demostracion: true,
    identidad: CASA,
    tipo: 'persona', // solo las personas emiten (VG, 7-11 noche)
    emision: [
      { token: 'T', escala: 'hora', cantidad: 1000 },
      { token: 'T', escala: 'minuto', cantidad: 5000 }, // otro token: escribir cuesta minutos
      { token: 'E', denominacion: 'EUR', cantidad: 500 }, // la serie E:casa/EUR
      { token: 'P', cantidad: 10, ambito: 'genesis' }, // poder de la casa sobre todo su eje
      { token: 'R', cantidad: 10 }, // reputación de la casa (R:casa): la pone en juego al emitir plazas
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
    autor: CASA,
    sobre: eje.genesisId,
    t,
    movimientos: [
      minutos(CASA),
      { token: 'T', escala: 'hora', cantidad: 40, de: CASA, a: 'recepcion' },
      { token: 'T', escala: 'minuto', cantidad: 600, de: CASA, a: 'recepcion' },
      eur(300, CASA, 'huesped'),
      { token: 'T', escala: 'hora', cantidad: 72, de: CASA, a: 'huesped' },
      { token: 'T', escala: 'minuto', cantidad: 600, de: CASA, a: 'huesped' },
    ],
    payload: ['Altas de la temporada', ['recepcion', 'huesped']],
    contexto: { tipos: { recepcion: 'persona', huesped: 'persona' }, ...(Object.keys(declaradas).length ? { claves: declaradas } : {}) },
  }, priv('casa'));

  // El dominio (VG, 7-11): un registro «Alojamiento» de la casa. Todo lo de
  // Booking cuelga de él, y el poder de recepción tiene ese ámbito. Declara
  // su capacidad (R2): 4 plazas por noche.
  const alojamiento = await eje.escribir({
    autor: CASA,
    sobre: eje.genesisId,
    t,
    movimientos: [minutos(CASA)],
    payload: structuredClone(ALOJAMIENTO),
  }, priv('casa'));

  // La casa delega en recepción el poder de confirmar, con el ámbito del
  // dominio: recepción autoriza lo que cuelga del Alojamiento (y puede
  // delegar hacia abajo), nada más. Va en un evento propio: P exige un ámbito
  // que ya exista.
  const delegacion = await eje.escribir({
    autor: CASA,
    sobre: alojamiento.id,
    t,
    movimientos: [minutos(CASA), { token: 'P', cantidad: 3, ambito: alojamiento.id, de: CASA, a: 'recepcion' }],
    payload: 'Recepción atiende el alojamiento',
  }, priv('casa'));

  // La casa publica la disponibilidad (la habitación con sus plazas) sobre el dominio.
  const habitacion = await eje.escribir({
    autor: CASA,
    sobre: alojamiento.id,
    t,
    movimientos: [minutos(CASA, 10)],
    payload: structuredClone(HABITACION), // copia: el payload de un evento no comparte arrays con nadie
  }, priv('casa'));

  // Oferta pública (R8, src/elegibles.js): la casa ancla en el 2.3 de la habitación (criterio · con quién) que
  // `cualquiera` puede reservar. Así las reservas de quien sea son elegibles en sus plazas; elegible no es elegido.
  const abierta = await eje.escribir({
    autor: CASA,
    sobre: habitacion.id,
    en: '2300000000',
    t,
    movimientos: [minutos(CASA)],
    payload: 'cualquiera',
  }, priv('casa'));

  const temporada = await abrirTemporada(eje, habitacion, { noches, t, privada: priv('casa') });

  const reserva = await reservar(eje, {
    autor: 'huesped',
    habitacion,
    plaza: PLAZAS.individual,
    noches: ['2026-11-20', '2026-11-23'],
    t: '2026-11-08T18:30:00Z',
    privada: priv('huesped'),
  });

  const resultado = { eje, alta, alojamiento, delegacion, habitacion, abierta, temporada, reserva };
  if (!confirmar) return resultado;
  return { ...resultado, ...(await confirmarReserva(eje, reserva, { claves })) };
}

/**
 * La casa abre la temporada: emite, por cada plaza de la habitación y cada
 * noche de [primera, fin), tantos tokens «<plaza>@<noche>» como capacidad,
 * atados a la habitación (R2) y con caducidad a la salida del día siguiente.
 * Es la serie limitada que respalda las plazas; solo la casa la amplía.
 * Emitir E es el último escalón (VG, 7-11 noche: «si T+R+P + (opc) E»): la
 * casa gasta su T, pone en juego su reputación ante recepción (un R:casa) y
 * tiene P sobre la habitación (el suyo cubre todo el eje).
 * Y emitir E cuesta P bloqueado (R2): si aún no lo tiene, la casa acuña su P
 * sobre el alojamiento, tanto como su capacidad (4), y bloquea de él, por
 * cada plaza, tanto como la plaza admite, con la salida = la familia de la
 * plaza (todas sus noches): su cuota, cada noche, es P bloqueado ÷ P emitido
 * × capacidad = las camas de la plaza. Ese P no se libera mientras viva
 * alguna noche de la plaza.
 */
export async function abrirTemporada(eje, habitacion, { noches = TEMPORADA, t, privada } = {}) {
  const alojamiento = eje.obtener(habitacion.sobre);
  const capacidad = capacidadDe(alojamiento?.payload);
  const ambito = alojamiento.id;
  const movimientos = [minutos(CASA), { token: 'R', emisor: CASA, cantidad: 1, de: CASA, a: 'recepcion' }];
  if (capacidad && !eje.serie('P:' + ambito).emitido) movimientos.push({ token: 'P', ambito, cantidad: capacidad, de: null, a: CASA });
  habitacion.payload[1].forEach((laPlaza, k) => {
    const plazas = capacidadDe(laPlaza);
    if (!plazas) return;
    const familia = familiaPlaza(habitacion.id, k);
    const falta = plazas - eje.bloqueado(CASA, 'P:' + ambito, familia);
    if (capacidad && falta > 0) movimientos.push({ token: 'P', ambito, cantidad: falta, de: CASA, a: CASA, estado: 'bloqueo', salida: familia });
    for (const noche of nochesEntre(...noches)) {
      movimientos.push({ ...tokenPlaza(habitacion.id, k, noche, plazas, null, CASA), caduca: caducaNoche(noche) });
    }
  });
  return eje.escribir({
    autor: CASA,
    sobre: habitacion.id,
    t,
    movimientos,
    payload: 'Temporada del ' + noches[0] + ' al ' + noches[1] + ': un token por plaza y noche, tantos como capacidad',
  }, privada);
}

/**
 * Una reserva: la escribe quien reserva sobre la habitación, ANCLADA EN LA
 * PLAZA (en = 1.k). Prefijo denso, de 0 a 4, sin relleno: la plaza y su
 * precio van por referencia (no copias) y las fórmulas viven en la misma
 * décupla anidada (1), porque LOCAL lee a su profundidad; 4 es lo que
 * prepara, las dos partes de la ejecución. Lo lejano, por anclaje: las
 * noches [entrada, salida] se anclan en el 7 de la propia reserva (la
 * salida no se ocupa), sin rellenar 5 y 6. Escribirla no reserva nada: las
 * reservas de una plaza colisionan en ella y la validez llega al ejecutar.
 *
 * Con el tramo, quien reserva deja en manos de recepción confirmar lo que la
 * casa le entregue sobre su reserva: acuña un P sobre ella (es su registro;
 * T + R + P: pone en juego un R propio ante recepción) y se lo delega. Sin
 * eso nadie podría autorizar la entrega de la casa: para autorizar lo que la
 * casa propone solo cuenta el P sobre un registro del hilo que la casa no
 * escribió ([X] confirmar VG, src/motor.js poderParaAutorizar), y el de
 * recepción sobre el Alojamiento lo escribió la casa.
 */
export async function reservar(eje, { autor, habitacion, plaza: k, noches, t, nombre, privada }) {
  const [entrada, salida] = noches;
  const n = nochesEntre(entrada, salida).length;
  const plazaElegida = habitacion.payload[1][k];
  const payload = [
    nombre ?? 'Reserva de la ' + plazaElegida[0][0] + ', ' + n + ' noches', // 0 representación
    [
      [{ ref: habitacion.id, dir: plaza(k) }], // 1.0 la plaza: [[nombre], precio, capacidad] (envuelta: la 1 es una décupla)
      n, // 1.1 noches
      { ref: habitacion.id, dir: precioDe(k) }, // 1.2 precio por noche: dentro de la plaza elegida
      '=LOCAL(2) * LOCAL(1)', // 1.3 total: precio por noche × noches
      '=LOCAL(3) + LOCAL(1) * 1 dia', // 1.4 el total compuesto con el tiempo que ocupa
    ], // 1 recursos
    [{ ref: habitacion.id, dir: '2000000000' }], // 2 criterios: los de la habitación (una dirección no entra en su lista)
    [autor, 'recepcion'], // 3 comunicación: quién habla con quién
    [['pagar'], 'ocupar'], // 4 fábrica: lo que prepara, una décupla (por hojas: el 0 envuelto) para que la entrega elija 4.1 «ocupar» por dirección
  ];
  const reserva = await eje.escribir({ autor, sobre: habitacion.id, en: plaza(k), t, movimientos: [minutos(autor, costeT(payload))], payload }, privada);
  const tramo = [entrada, salida];
  await eje.escribir({
    autor,
    sobre: reserva.id,
    en: direccion([7]),
    t,
    movimientos: [
      minutos(autor, costeT(tramo)),
      { token: 'R', emisor: autor, cantidad: 1, de: null, a: autor }, // su reputación, en juego ante recepción
      { token: 'R', emisor: autor, cantidad: 1, de: autor, a: 'recepcion' },
      { token: 'P', ambito: reserva.id, cantidad: 1, de: null, a: autor }, // P sobre su reserva, que escribió
      { token: 'P', ambito: reserva.id, cantidad: 1, de: autor, a: 'recepcion' }, // y recepción confirma por ella
    ],
    payload: tramo,
  }, privada);
  return reserva;
}

/**
 * Las noches que ocupa una reserva, comprobadas antes de mover nada: está
 * anclada EXACTAMENTE en la plaza que referencia (1.0), esa plaza declara
 * capacidad, su 7 da un tramo acotado por fechas (motor.tramoDe) y 1.1
 * coincide con el número de noches del tramo (BQL no resta fechas: la
 * comprobación vive aquí). Devuelve la habitación, la plaza k y las noches.
 */
export function nochesDe(eje, reserva) {
  const r = eje.obtener(reserva.id ?? reserva);
  if (!r) throw new Error('reserva desconocida');
  const corto = r.id.slice(0, 8);
  // La plaza va envuelta en la 1.0 (por hojas): una lista de un ocupante, la referencia.
  const laPlaza = Array.isArray(r.payload) && Array.isArray(r.payload[1]) && Array.isArray(r.payload[1][0]) ? r.payload[1][0][0] : undefined;
  if (!esReferencia(laPlaza) || laPlaza.ref !== r.sobre || (laPlaza.dir ?? '0000000000') !== r.en) {
    throw new Error('la reserva ' + corto + ' no está anclada en la plaza que referencia: anclada en ' + r.en + (esReferencia(laPlaza) ? ', referencia ' + (laPlaza.dir ?? '0000000000') + ' de ' + laPlaza.ref.slice(0, 8) : ', sin plaza en 1.0'));
  }
  const habitacion = eje.obtener(r.sobre);
  const [uno, k = 0, ...resto] = indicesDe(r.en);
  if (uno !== 1 || resto.length || !capacidadDe(habitacion.payload?.[1]?.[k])) throw new Error('la reserva ' + corto + ' no está en una plaza con capacidad: ' + r.en);
  const tramo = tramoDe(eje, r.id);
  const noches = nochesEntre(...tramo.extremos);
  const declaradas = r.payload[1][1];
  if (declaradas !== noches.length) {
    throw new Error('las noches de 1.1 (' + declaradas + ') no coinciden con el tramo del 7 (' + tramo.texto + ': ' + noches.length + ') en la reserva ' + corto);
  }
  return { habitacion, k, noches, tramo };
}

/** La ejecución válida de una consolidación, si la tiene. */
function ejecucionDe(eje, consolidacion) {
  return eje.sobre(consolidacion.id, FABRICA).find((e) => e.contexto?.fase === 'ejecutado' && e.autor === consolidacion.autor);
}

/**
 * Una parte de la confirmación, sin repetir lo hecho: si su autor ya
 * consolidó sobre la reserva, sigue desde ahí (autorizar, ejecutar); si ya
 * está ejecutada, no escribe nada.
 */
async function cumplir(eje, { autor, reserva, titulo, elecciones, recepcion, t, ejecucion, movimientos, priv }) {
  const previa = consolidaciones(eje, reserva.id).find((c) => c.autor === autor);
  const consolidacion = previa ? eje.obtener(previa.id) : await consolidar(eje, { autor, foco: reserva.id, t, titulo, elecciones: elecciones() }, priv(autor));
  const autorizacion = autorizacionesValidas(eje, consolidacion.id)[0]
    ?? await autorizar(eje, { autorizante: recepcion, consolidacion: consolidacion.id, t, nota: 'confirmada' }, priv(recepcion));
  const hecha = ejecucionDe(eje, consolidacion)
    ?? await ejecutar(eje, { autor, consolidacion: consolidacion.id, t, titulo: ejecucion, movimientos: movimientos(consolidacion) }, priv(autor));
  return { consolidacion, autorizacion, ejecucion: hecha };
}

/**
 * Confirmación por el ciclo del motor, en dos partes autorizadas por
 * recepción (tiene P sobre el Alojamiento y no es autora de ninguna):
 * 1. ocupar: la casa consolida sobre la reserva la plaza y la acción
 *    «ocupar» (por referencia), y al ejecutar entrega a la persona huésped
 *    un token «<plaza>@<noche>» por noche. Si otra reserva ya se llevó el
 *    de alguna noche, el eje lo rechaza (saldo insuficiente): la reserva
 *    queda escrita, consolidada y autorizada, pero no válida, y no se cobra.
 * 2. pagar: quien reservó consolida lo que elige (la plaza y el criterio por
 *    referencia; lo que va a pagar como fórmula que lee el total) y ejecuta
 *    con el pago E a la casa. Consolidar no es pagar.
 * Antes de escribir nada comprueba las noches (nochesDe) y que haya saldo
 * para pagar. Idempotente: lo ya hecho no se repite y, si las dos partes
 * están ejecutadas, devuelve la confirmación con yaConfirmada.
 */
export async function confirmarReserva(eje, reserva, { claves = {}, t = '2026-11-09T09:00:00Z', recepcion = 'recepcion' } = {}) {
  const priv = (id) => claves[id]?.privada;
  const quien = reserva.autor;
  const ejecutada = (autor) => consolidaciones(eje, reserva.id).some((c) => c.autor === autor && c.estado === 'EJECUTADO');
  const yaConfirmada = ejecutada(CASA) && ejecutada(quien);
  let noches = [];
  let habitacion;
  let k;
  if (!ejecutada(CASA)) {
    ({ habitacion, k, noches } = nochesDe(eje, reserva));
    const total = evaluar(eje, reserva.id, [1, 3]);
    const alcanza = total.estado === 'RESUELTO' && total.valor.tipo === 'magnitud' && total.valor.unidad === 'EUR' && eje.saldo(quien, EUR) >= total.valor.cantidad;
    if (!ejecutada(quien) && !alcanza) throw new Error('sin saldo para pagar ' + total.texto + ': no se entrega la plaza');
  }
  const d = () => descubrir(eje, reserva.id);
  const alcanzado = (posicion) => d().find((p) => p.posicion === posicion).candidatos.find((c) => c.origen === 'referencia');
  const entrega = await cumplir(eje, {
    autor: CASA,
    reserva,
    recepcion,
    t,
    priv,
    titulo: 'Plaza en firme',
    elecciones: () => ({
      1: { candidato: alcanzado(1) }, // la plaza alcanzada por la referencia
      4: { ref: reserva.id, dir: direccion([4, 1]) }, // la acción: «ocupar», de lo que prepara la reserva
    }),
    ejecucion: 'Plaza entregada',
    movimientos: () => noches.map((noche) => tokenPlaza(habitacion.id, k, noche, 1, CASA, quien)),
  });
  const pago = await cumplir(eje, {
    autor: quien,
    reserva,
    recepcion,
    t,
    priv,
    titulo: 'Reserva en firme',
    elecciones: () => ({
      1: { candidato: alcanzado(1) }, // la plaza alcanzada por la referencia
      2: { candidato: alcanzado(2) }, // el criterio alcanzado por la referencia
      4: '=REF("' + reserva.id + '", "1300000000")', // lo que se va a pagar: el total de la reserva (id completo)
    }),
    ejecucion: 'Pagada',
    movimientos: (consolidacion) => {
      // La consulta no tiene efectos: el efecto es la ejecución, que mueve el E.
      const total = evaluar(eje, consolidacion.id, [4]);
      if (total.estado !== 'RESUELTO' || total.valor.tipo !== 'magnitud' || total.valor.unidad !== 'EUR') throw new Error('total no resuelto: ' + total.texto);
      return [eur(total.valor.cantidad, quien, CASA)];
    },
  });
  return { entrega, pago, ...(yaConfirmada ? { yaConfirmada } : {}) };
}
