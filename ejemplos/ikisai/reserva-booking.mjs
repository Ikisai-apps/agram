// Segundo ejemplo transversal con datos inventados: una reserva de alojamiento
// (Booking) en una casa rural. Existe para forzar que el núcleo sea genérico y
// no esté moldeado por la compra de comida: otro dominio, otra décupla, otro
// ciclo. Construye su propio eje: génesis de la casa (una persona, la primera
// identidad del eje), que emite al empezar su R y sus EUR; la casa invita a
// recepción y a una persona huésped, que aceptan (su alta; encargo 3b); la
// casa escribe su «Alojamiento», que declara la capacidad; recepción escribe
// sobre él que atiende las reservas; la casa publica la disponibilidad (el
// elemento habitación, con sus plazas en 1.k); recepción respalda con su P dos
// de las plazas y la casa la otra, y la casa abre la temporada emitiendo la
// serie de plazas; la persona huésped escribe la reserva anclada en una plaza,
// con las noches en su propio 7 y lo que se va a mover anunciado en su 4.1.
//
// El ciclo es una sola operación (VG, 8-11, mapa §15 [D] «Una sola operación:
// registrar»): cada parte escribe su propio movimiento, anclado sobre la
// reserva: la casa entrega sus plazas (los tokens de cada noche) y la huésped
// paga sus euros. Nadie autoriza lo ajeno, porque cada uno solo mueve lo suyo
// («la casa entrega cuando escribe ella el movimiento de su cama; la huésped
// paga cuando escribe ella el suyo»). Qué cuenta como cerrado lo dice la
// reserva en su criterio (su 2): la plantilla de la época «all announced
// movements happened»; motor.siguiente dice a cada parte lo que le falta.
//
// El P (mapa §15 [D] «P como peso de criterio»): nadie lo acuña a mano. Quien
// escribe un registro obtiene diez unidades sobre él; quien consigue E de su
// emisor, diez por unidad sobre su registro; quien recibe R de su emisor, diez
// por unidad sobre la raíz de quien se la da (encargo 3b-bis: por cantidad). La
// casa tiene P sobre el Alojamiento y la habitación porque los escribió;
// recepción, sobre su propio registro, que cuelga del Alojamiento; la huésped,
// diez por noche sobre la habitación al recibir sus plazas. Cada P guarda su
// origen (P:<registro>/<origen>): quien lo obtuvo, aunque pase a otras manos.
//
// La plaza (VG, 7-11, «las dos cosas a la vez»): una POSICIÓN de la
// habitación donde las reservas colisionan (se escriben y se ven todas), y una
// SERIE LIMITADA de tokens E emitida por la casa: «<plaza>@<noche>», un token
// por plaza y noche, tantos como capacidad. La entrega mueve esos tokens de
// la casa a la persona huésped; la segunda reserva solapada se escribe y
// colisiona, pero la casa ya no puede entregarla: no tiene el token de esa
// noche (saldo insuficiente). El contador del motor (motor.ocupacion) solo
// informa.
//
// La E atada al recurso (VG, 7-11 noche, R2; VG, 9-11, D1 y F1): la casa
// declara la capacidad en su registro de alojamiento (posición 2 de su
// payload: 4 plazas); cada serie de plaza va atada a la habitación
// (`registro`) y hereda el tope del alojamiento, que se cuenta POR FRANJA (la
// noche): el E vivo de cada noche, sumando todas las plazas y emisores, no
// pasa de 4. Y la cuota de cada serie es el P comprometido por sus emisores
// (bloqueado con la salida = la familia de la plaza) frente a todo el P
// comprometido con las series del Alojamiento, por la capacidad: recepción
// compromete 1 con la cama individual y 2 con la litera; la casa, 1 con la de
// matrimonio. Cada noche caduca a la hora de salida del día siguiente.
//
// [X] decidir VG: titular de los tokens de plaza. Este ejemplo sigue la
// decisión del mapa §12, mediodía («mover esos tokens de la casa al
// huésped»): la serie se queda en la cartera de la casa y la entrega la
// escribe la casa.

import { Eje } from '../../src/eje.js';
import { direccion, indicesDe, esReferencia } from '../../src/btml.js';
import { evaluar } from '../../src/bql.js';
import { familiaDe, partirClave } from '../../src/tokens.js';
import { capacidadDe, tramoDe, siguiente, cerrado, ANUNCIO } from '../../src/motor.js';
import { entrarPorInvitacion } from './altas.mjs';
import { pagaElCoste, escribirPagando } from './coste.mjs';

/** La casa: la persona que respalda las plazas y emite su serie (VG, 7-11 noche: solo emiten personas). */
export const CASA = 'casa';

/** Las plazas que respalda recepción con su P: la cama individual (1) y la litera (2), un P por cama. La de matrimonio, la casa. */
export const RESPALDA_RECEPCION = Object.freeze({ 1: 1, 2: 2 });

/** La plantilla de cerrado que la reserva nombra en su criterio (la de la época por defecto, dicha en voz alta). */
export const CERRADO = 'all announced movements happened';

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
 * disponibilidad (1.k)»): un elemento por habitación, colgado del dominio,
 * el Alojamiento. 0 su nombre; 1 sus recursos, que son sus plazas (1.k), una
 * subdécupla por plaza [[nombre], [precio por noche], [capacidad]] (forma
 * canónica, VG 8-11: cada posición entre corchetes, para que la plaza sea
 * décupla y no una lista de tres ocupantes); 2 criterios, una lista;
 * 3 quién atiende; 4 la acción que ofrece. La capacidad va en el criterio de
 * la plaza (su posición 2: cuántas reservas caben a la vez; [X] en
 * motor.CRITERIO_CAPACIDAD) y dice cuántos tokens emite la casa por noche.
 * Límite conocido de los ceros finales: la primera plaza (1.0) colisiona con
 * la posición 1 entera y con su propio nombre (1.0.0) en 1000000000.
 */
export const HABITACION = Object.freeze([
  'Habitación del jardín', // 0 representación
  [
    [['cama de matrimonio'], ['EUR 80'], [1]], // 1.0 plaza: una pareja por noche
    [['cama individual'], ['EUR 55'], [1]], // 1.1 plaza: una persona por noche
    [['litera'], ['EUR 25'], [2]], // 1.2 plaza: dos camas, dos reservas a la vez
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
 * El registro de alojamiento de la casa, la raíz del dominio (R2): declara en
 * su posición 2 la capacidad que respalda, 4 plazas. Es el tope del E vivo,
 * POR NOCHE (la franja de la denominación), de todas las plazas que cuelguen
 * de él, y el registro del recurso de lo que se consolida debajo (R5).
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
const minutos = (de, cantidad) => (cantidad === undefined ? pagaElCoste(de) : { token: 'T', escala: 'minuto', cantidad, de, a: null });

/** EUR de la casa: la serie E:casa/EUR. */
export const EUR = 'E:' + CASA + '/EUR';
const eur = (cantidad, de, a) => ({ token: 'E', emisor: CASA, denominacion: 'EUR', cantidad, de, a });

/**
 * claves (opcional): { casa: {publica, privada}, recepcion: {...}, huesped: {...} }.
 * Con claves, la casa firma el génesis y sus invitaciones, y cada identidad
 * acepta la suya con su clave y firma lo suyo. Sin claves, el eje funciona sin firmas.
 * confirmar: con false se detiene en la reserva escrita (sin entrega ni pago).
 * temporada: las noches [primera, fin) que abre la casa (TEMPORADA por defecto).
 */
export async function ejemploReserva({ claves = {}, confirmar = true, temporada: noches = TEMPORADA } = {}) {
  const t = '2026-11-07T10:00:00Z';
  const priv = (id) => claves[id]?.privada;
  const eje = await Eje.genesis({
    demostracion: true,
    identidad: CASA, // escribe el génesis, su alta: la primera identidad del eje es una persona (VG, 10-11, B1)
    emision: [
      { token: 'R', cantidad: 10 }, // su R (R:casa): emitir E exige R propia emitida (VG, 9-11, D2)
      { token: 'E', denominacion: 'EUR', cantidad: 500 }, // la serie E:casa/EUR
      { token: 'E', denominacion: 'hora', cantidad: 1000 }, // el tiempo que la casa cede a otros: E:casa/hora (T no cruza de persona)
    ],
    foco: 'Casa rural de ejemplo',
    t,
    clave: claves.casa?.publica,
    privada: priv('casa'),
  });

  // La casa invita a recepción y a la persona huésped; cada una acepta (su alta, firmada con su clave si la tiene).
  // Después la casa les da lo suyo.
  for (const id of ['recepcion', 'huesped']) await entrarPorInvitacion(eje, { por: CASA, quien: id, t, clave: claves[id], privadaDe: priv });
  const alta = await escribirPagando(eje, {
    autor: CASA,
    sobre: eje.genesisId,
    t,
    movimientos: [
      minutos(CASA),
      // Cada una escribe con su asignación de T del día (VG, 8-11). La casa cede a recepción 40 horas de su
      // tiempo como E:casa/hora (VG, 7-11 noche: T no cruza de persona, se transforma en E).
      { token: 'E', emisor: CASA, denominacion: 'hora', cantidad: 40, de: CASA, a: 'recepcion' },
      eur(300, CASA, 'huesped'),
    ],
    payload: ['Altas de la temporada', ['recepcion', 'huesped']],
  }, priv('casa'));

  // El dominio (VG, 7-11): el «Alojamiento» de la casa, raíz de todo lo de Booking. Declara su capacidad (R2), 4
  // plazas por noche. Escribirlo le da a la casa diez P sobre él (mapa §15 [D] N1).
  const alojamiento = await escribirPagando(eje, {
    autor: CASA,
    sobre: eje.genesisId,
    t,
    movimientos: [minutos(CASA)],
    payload: structuredClone(ALOJAMIENTO),
  }, priv('casa'));

  // Recepción escribe sobre el Alojamiento que atiende las reservas: su P (diez, sobre su propio registro) cuelga
  // del dominio, y con él respalda plazas. Ya no hay P delegado por la casa: nadie emite P a mano (mapa §15).
  const atiende = await escribirPagando(eje, {
    autor: 'recepcion',
    sobre: alojamiento.id,
    t,
    movimientos: [minutos('recepcion')],
    payload: 'Recepción atiende las reservas',
  }, priv('recepcion'));

  // La casa publica la disponibilidad (la habitación con sus plazas) sobre el dominio.
  const habitacion = await escribirPagando(eje, {
    autor: CASA,
    sobre: alojamiento.id,
    t,
    movimientos: [minutos(CASA)],
    payload: structuredClone(HABITACION), // copia: el payload de un evento no comparte arrays con nadie
  }, priv('casa'));

  // Oferta pública (R8, src/elegibles.js): la casa ancla en el 2.3 de la habitación (criterio · con quién) que
  // `cualquiera` puede reservar. Así las reservas de quien sea son elegibles en sus plazas; elegible no es elegido.
  const abierta = await escribirPagando(eje, {
    autor: CASA,
    sobre: habitacion.id,
    en: '2300000000',
    t,
    movimientos: [minutos(CASA)],
    payload: 'cualquiera',
  }, priv('casa'));

  // Recepción respalda con su P la cama individual y la litera, todas las noches (R2): será coemisora de sus
  // series. Ese P queda comprometido mientras vivan sus noches.
  const respaldo = await respaldarPlazas(eje, habitacion, { identidad: 'recepcion', plazas: RESPALDA_RECEPCION, ambito: atiende.id, t, privada: priv('recepcion') });

  const temporada = await abrirTemporada(eje, habitacion, { noches, t, privada: priv('casa') });

  const reserva = await reservar(eje, {
    autor: 'huesped',
    habitacion,
    plaza: PLAZAS.individual,
    noches: ['2026-11-20', '2026-11-23'],
    t: '2026-11-08T18:30:00Z',
    privada: priv('huesped'),
  });

  const resultado = { eje, alta, alojamiento, atiende, habitacion, abierta, respaldo, temporada, reserva };
  if (!confirmar) return resultado;
  return { ...resultado, ...(await confirmarReserva(eje, reserva, { claves })) };
}

/**
 * Quien tiene P en el dominio (aquí, recepción, sobre su propio registro, que cuelga del Alojamiento) respalda
 * plazas de la habitación: bloquea ese P con la salida = la familia de cada plaza (todas sus noches), `plazas` = { k:
 * cantidad }. Va en un registro suyo, firmado por él: es su firma de coemisor de esas series (R2, emisión conjunta).
 * Ese P no se libera mientras viva alguna noche de la plaza, y es su compromiso con ella (mapa §15 [D] (5)).
 */
export async function respaldarPlazas(eje, habitacion, { identidad, plazas, ambito, t, privada }) {
  const bloqueos = Object.entries(plazas).map(([k, cantidad]) => ({ token: 'P', ambito, cantidad, de: identidad, a: identidad, estado: 'bloqueo', salida: familiaPlaza(habitacion.id, Number(k)) }));
  return escribirPagando(eje, {
    autor: identidad,
    sobre: habitacion.sobre,
    t,
    movimientos: [minutos(identidad), ...bloqueos],
    payload: 'Respaldo plazas de la ' + String(habitacion.payload[0]).toLowerCase(),
  }, privada);
}

/**
 * La casa abre la temporada: emite, por cada plaza de la habitación y cada noche de [primera, fin), tantos tokens
 * «<plaza>@<noche>» como capacidad, atados a la habitación (R2) y con caducidad a la salida del día siguiente. Es la
 * serie limitada que respalda las plazas; solo la casa la amplía. Emitir E exige P sobre su registro (la casa
 * escribió la habitación: tiene diez) y R propia emitida (VG, 8-11 tarde, N3; 9-11, D2).
 * La cuota de cada serie (VG, 9-11, D1): el P que sus emisores comprometen con la familia de la plaza (todas sus
 * noches) frente a todo el P comprometido con las plazas del Alojamiento, por su capacidad. Cada cama pide una unidad
 * comprometida: lo que ya comprometieron otros (respaldarPlazas) cuenta, y quien lo comprometió es coemisor de la
 * serie (`emisores`); lo que falta lo compromete la casa con su P sobre el Alojamiento. Ese P no se libera mientras
 * viva alguna noche de la plaza.
 */
export async function abrirTemporada(eje, habitacion, { noches = TEMPORADA, t, privada } = {}) {
  const alojamiento = eje.obtener(habitacion.sobre);
  const ambito = alojamiento.id;
  const movimientos = [minutos(CASA)];
  habitacion.payload[1].forEach((laPlaza, k) => {
    const plazas = capacidadDe(laPlaza);
    if (!plazas) return;
    const familia = familiaPlaza(habitacion.id, k);
    const ya = eje.bloqueosCon(familia).filter((b) => b.clave.startsWith('P:'));
    const otros = [...new Set(ya.map((b) => b.identidad).filter((id) => id !== CASA))].sort();
    const falta = plazas - ya.reduce((s, b) => s + b.cantidad, 0);
    if (falta > 0) movimientos.push({ token: 'P', ambito, cantidad: falta, de: CASA, a: CASA, estado: 'bloqueo', salida: familia });
    const conjunta = otros.length ? { emisores: [CASA, ...otros] } : {};
    for (const noche of nochesEntre(...noches)) {
      movimientos.push({ ...tokenPlaza(habitacion.id, k, noche, plazas, null, CASA), caduca: caducaNoche(noche), ...conjunta });
    }
  });
  return escribirPagando(eje, {
    autor: CASA,
    sobre: habitacion.id,
    t,
    movimientos,
    payload: 'Temporada del ' + noches[0] + ' al ' + noches[1] + ': un token por plaza y noche, tantos como capacidad',
  }, privada);
}

/**
 * Una reserva: la escribe quien reserva sobre la habitación, ANCLADA EN LA PLAZA (en = 1.k). Prefijo denso, de 0 a
 * 4, sin relleno: la plaza y su precio van por referencia (no copias) y las fórmulas viven en la misma décupla
 * anidada (1), porque LOCAL lee a su profundidad; su criterio (2) son los de la habitación y la plantilla de cerrado
 * (encargo 3b: el dueño la nombra en su PV2); 4 es lo que prepara. Lo lejano, por anclaje: las noches (la décupla
 * [[entrada], [salida]]) se anclan en el 7 de la propia reserva (la salida no se ocupa), y lo que se va a mover se
 * anuncia en su 4.1 (motor.ANUNCIO) como movimientos anunciados del libro (VG 12-11, decisión 8: no tocan saldos):
 * un anuncio con las noches que entrega la casa (un token de la plaza por noche) y otro con el total que paga quien
 * reserva. Cada parte cumple el suyo con un registro anclado sobre él. Escribirla no reserva nada: las reservas de una plaza colisionan en ella y la validez
 * llega cuando cada parte escribe su movimiento.
 */
export async function reservar(eje, { autor, habitacion, plaza: k, noches, t, nombre, privada }) {
  const [entrada, salida] = noches;
  const lista = nochesEntre(entrada, salida);
  const n = lista.length;
  const plazaElegida = habitacion.payload[1][k];
  const payload = [
    nombre ?? 'Reserva de la ' + plazaElegida[0][0] + ', ' + n + ' noches', // 0 representación
    [
      [{ ref: habitacion.id, dir: plaza(k) }], // 1.0 la plaza: [[nombre], [precio], [capacidad]] (cada posición entre corchetes: la 1 es una décupla)
      [n], // 1.1 noches
      [{ ref: habitacion.id, dir: precioDe(k) }], // 1.2 precio por noche: dentro de la plaza elegida
      ['=LOCAL(2) * LOCAL(1)'], // 1.3 total: precio por noche × noches
      ['=LOCAL(3) + LOCAL(1) * 1 dia'], // 1.4 el total compuesto con el tiempo que ocupa
    ], // 1 recursos
    [{ ref: habitacion.id, dir: '2000000000' }, CERRADO], // 2 criterios: los de la habitación y la plantilla de cerrado
    [autor, 'recepcion'], // 3 comunicación: quién habla con quién
    [['pagar'], ['ocupar']], // 4 fábrica: lo que prepara, una décupla (4.0 pagar, 4.1 ocupar)
    ['booking'], // 5 estructura: dónde encaja, su tipo: la plantilla «booking» de la época (epoch.9.2; encargo 3c-1)
  ];
  const reserva = await escribirPagando(eje, { autor, sobre: habitacion.id, en: plaza(k), t, movimientos: [minutos(autor)], payload }, privada);
  const tramo = [[entrada], [salida]]; // una décupla (cada posición entre corchetes): [entrada, salida] sería una lista de dos ocupantes
  await escribirPagando(eje, {
    autor,
    sobre: reserva.id,
    en: direccion([7]),
    t,
    movimientos: [minutos(autor)],
    payload: tramo,
  }, privada);
  // Lo que se va a mover (encargo 3b): la casa entrega un token de la plaza por noche; quien reserva paga el total.
  const total = evaluar(eje, reserva.id, [1, 3]);
  const anuncios = [['ocupar', lista.map((noche) => anunciado(seriePlaza(habitacion.id, k, noche), 1, CASA, autor))], ...(total.valor?.tipo === 'magnitud' ? [['pagar', [anunciado(EUR, total.valor.cantidad, autor, CASA)]]] : [])];
  for (const [que, movimientos] of anuncios) {
    await escribirPagando(eje, { autor, sobre: reserva.id, en: ANUNCIO, t, movimientos: [minutos(autor), ...movimientos], payload: que }, privada);
  }
  return reserva;
}

/** Un movimiento anunciado (VG 12-11, decisión 8): la serie, cuánto, de quién y a quién, sin tocar saldos (motor.siguiente lo lee). */
function anunciado(serie, cantidad, de, a) {
  const { token, emisor, denominacion, registro } = partirClave(serie);
  return { token, emisor, denominacion, ...(registro ? { registro } : {}), cantidad, de, a, estado: 'anunciado' };
}

/**
 * Las noches que ocupa una reserva, comprobadas antes de mover nada: está anclada EXACTAMENTE en la plaza que
 * referencia (1.0), esa plaza declara capacidad, su 7 da un tramo acotado por fechas (motor.tramoDe) y 1.1 coincide
 * con el número de noches del tramo (BQL no resta fechas: la comprobación vive aquí). Devuelve la habitación, la
 * plaza k y las noches.
 */
export function nochesDe(eje, reserva) {
  const r = eje.obtener(reserva.id ?? reserva);
  if (!r) throw new Error('reserva desconocida');
  const corto = r.id.slice(0, 8);
  // La plaza va entre corchetes en la 1.0 (por hojas): una lista de un ocupante, la referencia.
  const laPlaza = Array.isArray(r.payload) && Array.isArray(r.payload[1]) && Array.isArray(r.payload[1][0]) ? r.payload[1][0][0] : undefined;
  if (!esReferencia(laPlaza) || laPlaza.ref !== r.sobre || (laPlaza.dir ?? '0000000000') !== r.en) {
    throw new Error('la reserva ' + corto + ' no está anclada en la plaza que referencia: anclada en ' + r.en + (esReferencia(laPlaza) ? ', referencia ' + (laPlaza.dir ?? '0000000000') + ' de ' + laPlaza.ref.slice(0, 8) : ', sin plaza en 1.0'));
  }
  const habitacion = eje.obtener(r.sobre);
  const [uno, k = 0, ...resto] = indicesDe(r.en);
  if (uno !== 1 || resto.length || !capacidadDe(habitacion.payload?.[1]?.[k])) throw new Error('la reserva ' + corto + ' no está en una plaza con capacidad: ' + r.en);
  const tramo = tramoDe(eje, r.id);
  const noches = nochesEntre(...tramo.extremos);
  const declaradas = [r.payload[1][1]].flat()[0]; // 1.1 entre corchetes (lista de un ocupante) o suelta: lo mismo
  if (declaradas !== noches.length) {
    throw new Error('las noches de 1.1 (' + declaradas + ') no coinciden con el tramo del 7 (' + tramo.texto + ': ' + noches.length + ') en la reserva ' + corto);
  }
  return { habitacion, k, noches, tramo };
}

/**
 * La parte de `quien`: lo que a la reserva le falta de ella (motor.siguiente), en un registro suyo anclado sobre el
 * anuncio que lo pide (VG 12-11, decisión 8: así lo cumple, y solo a él), con su T y sus movimientos (todas las noches
 * en una sola transacción: entera o nada). Si no le falta nada, no escribe y devuelve null.
 */
async function cumplir(eje, reserva, quien, { t, titulo, privada }) {
  const { faltaDeMi } = siguiente(eje, reserva.id, quien);
  let ultimo = null;
  for (const x of faltaDeMi.filter((f) => f.plantilla === 'move what was announced')) {
    ultimo = await escribirPagando(eje, { autor: quien, sobre: x.anuncio, en: x.transaccion.en, t, movimientos: [minutos(quien), ...x.transaccion.movimientos.slice(1)], payload: titulo }, privada);
  }
  return ultimo;
}

/**
 * Confirmar es que cada parte escriba su movimiento (encargo 3b, mapa §15 [D]): primero la casa entrega las plazas
 * (los tokens «<plaza>@<noche>» que la reserva anunció) y después la persona huésped paga el total. Si otra reserva
 * ya se llevó el token de alguna noche, el eje rechaza la entrega (saldo insuficiente): la reserva queda escrita y
 * abierta (cerrado da false), y no se cobra. Antes de escribir nada comprueba las noches (nochesDe) y que haya saldo
 * para pagar. Lo hecho no se repite: cada parte escribe solo lo que le falta (motor.siguiente); si la reserva ya
 * está cerrada, devuelve las dos partes con yaConfirmada.
 */
export async function confirmarReserva(eje, reserva, { claves = {}, t = '2026-11-09T09:00:00Z' } = {}) {
  const priv = (id) => claves[id]?.privada;
  const quien = reserva.autor;
  // Lo hecho cuelga de los anuncios de la reserva (VG 12-11, decisión 8).
  const hecho = (autor, titulo) => eje.sobre(reserva.id, ANUNCIO).flatMap((a) => eje.sobre(a.id)).find((e) => e.autor === autor && e.payload === titulo) ?? null;
  // Las noches y el anclaje, siempre (también si la reserva ya está cerrada): una reserva sin anuncios en su 4.1 cumple
  // de vacío la plantilla de cerrado, y eso no la confirma.
  nochesDe(eje, reserva);
  const ya = { entrega: hecho(CASA, 'Plaza entregada'), pago: hecho(quien, 'Pagada') };
  if (cerrado(eje, reserva.id).cerrado && ya.entrega && ya.pago) return { ...ya, yaConfirmada: true };
  const total = evaluar(eje, reserva.id, [1, 3]);
  const alcanza = total.estado === 'RESUELTO' && total.valor.tipo === 'magnitud' && total.valor.unidad === 'EUR' && eje.saldo(quien, EUR) >= total.valor.cantidad;
  if (!hecho(quien, 'Pagada') && !alcanza) throw new Error('sin saldo para pagar ' + total.texto + ': no se entrega la plaza');
  const entrega = (await cumplir(eje, reserva, CASA, { t, titulo: 'Plaza entregada', privada: priv(CASA) })) ?? hecho(CASA, 'Plaza entregada');
  const pago = (await cumplir(eje, reserva, quien, { t, titulo: 'Pagada', privada: priv(quien) })) ?? hecho(quien, 'Pagada');
  if (!entrega || !pago) throw new Error('la reserva no anuncia en su 4.1 la entrega y el pago: no hay nada que confirmar');
  return { entrega, pago };
}
