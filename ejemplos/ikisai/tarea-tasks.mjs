// Ejemplo transversal con datos inventados: una tarea (Tasks) en una casa
// de eventos. Tiempo, pasos y dinero sobre el mismo núcleo que la compra de
// comida. Construye su propio eje: génesis de la casa (emite euros,
// minutos, horas y poder sobre todo el eje); altas de una persona
// organizadora y de un proveedor externo; la casa escribe las partidas del
// sábado; la organizadora escribe la tarea «montar la carpa del sábado», una
// décupla entera por PV con sus fórmulas BQL; el proveedor escribe
// presupuestos que colisionan en los recursos (1) de la tarea; la
// organizadora pasa por el motor: descubrir → proponer (la fórmula del 9
// elige el presupuesto por encaje y por criterios) → consolidar → la casa
// autoriza (P) → ejecutar con el pago (E) al proveedor y el consumo de las
// horas previstas (T). Nada de esto es real.
//
// Tokens según las decisiones de VG del 7-11: cada familia es una serie de
// denominaciones. T son siete tokens distintos, uno por escala y sin
// conversión: escribir cuesta minutos y el trabajo cuesta horas, así que la
// casa emite y reparte las dos series y nadie paga minutos con horas. E va
// por denominación (EUR, emitida y respaldada por la casa), P por ámbito
// (aquí «genesis») y R por emisor (no aparece en esta tarea).

import { Eje } from '../../src/eje.js';
import { evaluar } from '../../src/bql.js';
import { costeT, escribirDesde } from '../../src/escritura.js';
import { descubrir, proponer, consolidar, autorizar, ejecutar } from '../../src/motor.js';

/** Calendario inventado: hoy es sábado 7; la fiesta, el sábado 14. */
export const T0 = '2026-11-07T09:00:00Z';
export const FECHA_LIMITE = '2026-11-14T09:00:00Z';

/** Los presupuestos se escriben en los recursos (1) de la tarea: colisionan con lo propio. */
export const EN_PRESUPUESTO = '1000000000';

/**
 * Unidades de BQL → escala del token T. En BQL las unidades son etiquetas
 * («7 h» no sabe que es la escala hora); la traducción va a mano.
 * [X] decidir VG: si las unidades de tiempo de BQL deben ser las siete
 * escalas de T (y «EUR» la denominación de E) por definición.
 */
export const ESCALA_DE_UNIDAD = Object.freeze({ min: 'minuto', h: 'hora' });

/**
 * Etapas del ejemplo, en orden. `hasta` detiene el ejemplo al terminar una:
 * la tarea escrita, los presupuestos recibidos, la consolidación, la
 * autorización o la ejecución (por defecto, todo).
 */
export const ETAPAS = Object.freeze(['tarea', 'presupuestos', 'consolidada', 'autorizada', 'ejecutada']);

/** La fórmula del 5: cuántos presupuestos (escritos) colisionan en los recursos. */
export const FORMULA_RECIBIDOS = '=CONTAR(FILTRAR(BUSCAR(1), ORIGEN() = "escrito"))';

/**
 * La fórmula del 9 (camino): elige por encaje el presupuesto que cabe.
 * Entre los ocupantes del 1, los escritos exactos (acuerdo de diez
 * profundidades); de ellos, los que tienen el precio (su 1) dentro del coste
 * total de la tarea (1.2) y el plazo (su 2) dentro del plazo de la tarea
 * (2.0); el primero en orden de encaje. Los dos FILTRAR van anidados porque
 * Y evalúa todos sus argumentos: ACTUAL(1) sobre lo propio (un array)
 * pararía la consulta.
 *
 * [X] decidir VG: la elección vive en el 9 (camino) y no en el 1. proponer
 * coloca cada elección en la posición de su fórmula y solo lee la raíz del
 * foco; el 1 de la tarea guarda los recursos literales, y una fórmula
 * anidada en 1.x no la lee proponer (con `camino: [1]` la consolidación se
 * anclaría en 1.4, fuera de la fábrica de la tarea). Por eso el presupuesto
 * elegido queda en el 9 de la consolidación, no en sus recursos.
 */
export const FORMULA_ELECCION = '=ELEGIR(FILTRAR(FILTRAR(BUSCAR(1), Y(ORIGEN() = "escrito", ACUERDO() = 10)), Y(ACTUAL(1) <= LOCAL(1, 2), ACTUAL(2) <= LOCAL(2, 0))))';

/**
 * La décupla de una tarea, por PV (época 0). Las fórmulas viven donde
 * alcanzan lo que leen, porque LOCAL solo mira dentro de su anfitrión: el
 * coste total va dentro de recursos (1.2) y suma las partidas de 1.0; el
 * tiempo previsto va dentro de la fábrica, tras el último paso, y suma las
 * horas de cada paso; lo que cruza PV va en la raíz: el recuento del 5, la
 * composición «EUR + horas» del 8 y la elección del 9.
 *
 *   partidas: referencias a los importes de las partidas (no copias).
 *   pasos: [[nombre, '2 h'], …], de uno a ocho.
 *   origen: referencia para el 6 (de dónde viene la tarea).
 *
 * [X] decidir VG: dentro de la fábrica los pasos ocupan 4.1, 4.2… por orden,
 * no por PV, y lo mismo las partidas en 1.0.1, 1.0.2…; la época 0 dice que
 * cada dígito es un PV en todas las profundidades. Una hilera ordinal pide
 * su regla corta. Y como el tiempo previsto va tras el último paso, su
 * dirección cambia con el número de pasos (4.5 aquí, 4.3 en una tarea de dos).
 */
export function decuplaTarea({ titulo, partidas, materiales, plazo, calidad, quien, pasos, origen, fechaLimite }) {
  if (!partidas.length || partidas.length > 9) throw new Error('de una a nueve partidas');
  if (!pasos.length || pasos.length > 8) throw new Error('de uno a ocho pasos');
  const coste = '=' + partidas.map((_, k) => 'LOCAL(0, ' + (k + 1) + ')').join(' + ');
  const tiempo = '=' + pasos.map((_, k) => 'LOCAL(' + (k + 1) + ', 1)').join(' + ');
  const posicionTiempo = pasos.length + 1;
  return [
    titulo, // 0 representación
    [
      ['Presupuesto por partidas', ...partidas], // 1.0 presupuesto en EUR: referencias a las partidas
      materiales, // 1.1 materiales
      coste, // 1.2 coste total = suma de las partidas
    ], // 1 recursos
    [plazo, calidad], // 2 criterios: plazo de ejecución (horas) y calidad
    quien, // 3 comunicación: quién habla con quién
    ['Pasos', ...pasos, tiempo], // 4 fábrica: los pasos como subdécupla y el tiempo previsto tras el último
    FORMULA_RECIBIDOS, // 5 estructura: presupuestos recibidos
    origen, // 6 pasado: de dónde viene
    fechaLimite, // 7 futuro: fecha límite
    '=LOCAL(1, 2) + LOCAL(4, ' + posicionTiempo + ')', // 8 comparabilidad: composición «EUR + horas»
    FORMULA_ELECCION, // 9 camino: el presupuesto que encaja y cabe
  ];
}

/** Tiempo previsto de una tarea: la fórmula tras el último paso de su fábrica. */
export function tiempoPrevisto(eje, tareaId) {
  const fabrica = eje.obtener(tareaId).payload[4];
  return evaluar(eje, tareaId, [4, fabrica.length - 1]);
}

/**
 * Lo que mueve la ejecución, leído con BQL y no tecleado: el precio del
 * presupuesto elegido (el 9 de la consolidación) pasa de quien ejecuta al
 * autor del presupuesto como E de su denominación; las horas previstas de la
 * tarea se consumen como T de su escala.
 */
export function movimientosDeEjecucion(eje, consolidacionId, tareaId) {
  const c = eje.obtener(consolidacionId);
  const elegido = c.payload[9];
  if (!elegido?.ref) throw new Error('la consolidación no tiene presupuesto elegido en el 9');
  const presupuesto = eje.obtener(elegido.ref);
  const precio = evaluar(eje, presupuesto.id, [1]);
  const horas = tiempoPrevisto(eje, tareaId);
  if (precio.valor?.tipo !== 'magnitud') throw new Error('precio sin magnitud: ' + precio.texto);
  if (horas.valor?.tipo !== 'magnitud' || !ESCALA_DE_UNIDAD[horas.valor.unidad]) throw new Error('tiempo sin escala: ' + horas.texto);
  return [
    { token: 'E', denominacion: precio.valor.unidad, cantidad: precio.valor.cantidad, de: c.autor, a: presupuesto.autor },
    { token: 'T', escala: ESCALA_DE_UNIDAD[horas.valor.unidad], cantidad: horas.valor.cantidad, de: c.autor, a: null },
  ];
}

/**
 * claves (opcional): { casa: {publica, privada}, organizadora: {...}, proveedor: {...} }.
 * Con claves, la casa firma el génesis y declara las claves de las altas, y
 * cada identidad firma lo suyo. Sin claves, el eje funciona sin firmas.
 * hasta (opcional): la última etapa que se recorre (ETAPAS).
 */
export async function ejemploTarea({ claves = {}, hasta = 'ejecutada' } = {}) {
  const tope = ETAPAS.indexOf(hasta);
  if (tope < 0) throw new Error('etapa desconocida: ' + hasta);
  const priv = (id) => claves[id]?.privada;
  const r = {};

  // Génesis: la casa emite y respalda sus series: euros, minutos (escribir),
  // horas (trabajar) y poder sobre todo su eje.
  const eje = await Eje.genesis({
    identidad: 'casa',
    emision: [
      { token: 'E', denominacion: 'EUR', cantidad: 1000 },
      { token: 'T', escala: 'minuto', cantidad: 600 },
      { token: 'T', escala: 'hora', cantidad: 200 },
      { token: 'P', cantidad: 10, ambito: 'genesis' },
    ],
    foco: 'Casa de eventos de ejemplo',
    t: T0,
    clave: claves.casa?.publica,
    privada: priv('casa'),
  });
  r.eje = eje;

  // Altas: la organizadora recibe el fondo del sábado, minutos y horas; el
  // proveedor externo, minutos para escribir presupuestos y horas. Existen al
  // recibir tokens. Escribir cuesta un minuto por posición.
  const declaradas = {};
  for (const id of ['organizadora', 'proveedor']) if (claves[id]?.publica) declaradas[id] = claves[id].publica;
  const altas = ['Altas para la fiesta del sábado', ['organizadora', 'proveedor']];
  r.alta = await eje.escribir({
    autor: 'casa',
    sobre: eje.genesisId,
    t: T0,
    movimientos: [
      { token: 'T', escala: 'minuto', cantidad: costeT(altas), de: 'casa', a: null },
      { token: 'E', denominacion: 'EUR', cantidad: 400, de: 'casa', a: 'organizadora' },
      { token: 'T', escala: 'minuto', cantidad: 120, de: 'casa', a: 'organizadora' },
      { token: 'T', escala: 'hora', cantidad: 40, de: 'casa', a: 'organizadora' },
      { token: 'T', escala: 'minuto', cantidad: 60, de: 'casa', a: 'proveedor' },
      { token: 'T', escala: 'hora', cantidad: 20, de: 'casa', a: 'proveedor' },
    ],
    payload: altas,
    contexto: Object.keys(declaradas).length ? { claves: declaradas } : {},
  }, priv('casa'));

  // Partidas del sábado: la casa reparte el dinero en partidas [concepto, importe].
  r.partidas = await escribirDesde(eje, {
    modo: 'sequenced',
    autor: 'casa',
    sobre: r.alta.id,
    t: T0,
    payload: [
      'Partidas del sábado', // 0
      [
        'Partidas', // 1.0
        ['alquiler de la carpa', '250 EUR'], // 1.1
        ['transporte', '60 EUR'], // 1.2
        ['imprevistos', '40 EUR'], // 1.3
        ['tarima del escenario', '120 EUR'], // 1.4
      ], // 1 recursos
    ],
  }, priv('casa'));

  // La tarea: la organizadora la escribe sobre las partidas, desde Mapped.
  // El presupuesto referencia los importes (1.1.1, 1.2.1, 1.3.1): no copia.
  const partida = (k) => ({ ref: r.partidas.id, dir: '1' + k + '10000000' });
  r.tarea = await escribirDesde(eje, {
    modo: 'mapped',
    autor: 'organizadora',
    sobre: r.partidas.id,
    t: '2026-11-07T10:00:00Z',
    payload: decuplaTarea({
      titulo: 'Montar la carpa del sábado',
      partidas: [partida(1), partida(2), partida(3)],
      materiales: ['carpa de 6 × 12 m', 'piquetas', 'cuerdas', 'lastres'],
      plazo: '8 h',
      calidad: 'anclada, tensada y sin goteras',
      quien: ['organizadora', 'proveedor'],
      pasos: [['marcar el suelo', '1 h'], ['anclar las piquetas', '2 h'], ['levantar la carpa', '3 h'], ['tensar y revisar', '1 h']],
      origen: { ref: r.partidas.id },
      fechaLimite: FECHA_LIMITE,
    }),
  }, priv('organizadora'));

  // La fecha límite como proyección: un registro anclado en el futuro (7)
  // de la tarea con el instante de la fecha. El 7 de la tarea solo la
  // declara como texto; el eje temporal ve proyecciones por su `t`.
  r.limite = await escribirDesde(eje, {
    modo: 'pointed',
    autor: 'organizadora',
    sobre: r.tarea.id,
    en: '7000000000',
    t: FECHA_LIMITE,
    payload: 'fecha límite: la carpa, montada',
  }, priv('organizadora'));
  if (tope < 1) return r;

  // El proveedor escribe un presupuesto en los recursos de la tarea (colisión
  // en 1), por PV: 1 su precio, 2 su plazo, 3 con quién hablar. Se pasa del
  // coste total; corregir no es modificar: añade un segundo presupuesto, y
  // los dos quedan como ocupantes.
  r.presupuestos = [];
  for (const [t, payload] of [
    ['2026-11-07T17:00:00Z', ['Presupuesto: carpa con suelo de madera', '420 EUR', '5 h', 'proveedor']],
    ['2026-11-08T09:30:00Z', ['Presupuesto corregido: carpa sin suelo', '310 EUR', '6 h', 'proveedor']],
  ]) {
    r.presupuestos.push(await escribirDesde(eje, { modo: 'sequenced', autor: 'proveedor', sobre: r.tarea.id, en: EN_PRESUPUESTO, t, payload }, priv('proveedor')));
  }
  if (tope < 2) return r;

  // Motor: Q descubre, B propone desde las fórmulas del foco, C consolida.
  // El 8 (composición) entra como terminal; el 9 (elección), como el
  // presupuesto elegido; 1–4 por referencia a la tarea; 5–7 se heredan.
  r.descubierto = descubrir(eje, r.tarea.id);
  r.propuesta = proponer(eje, r.tarea.id, { posiciones: [1, 2, 3, 4, 8, 9] });
  r.consolidacion = await consolidar(eje, {
    autor: 'organizadora',
    foco: r.tarea.id,
    t: '2026-11-08T10:00:00Z',
    titulo: 'Encargo del montaje de la carpa',
    elecciones: r.propuesta.elecciones,
  }, priv('organizadora'));
  if (tope < 3) return r;

  // La casa autoriza con su poder (P sobre todo el eje); no es la autora.
  r.autorizacion = await autorizar(eje, { autorizante: 'casa', consolidacion: r.consolidacion.id, t: '2026-11-08T11:00:00Z' }, priv('casa'));
  if (tope < 4) return r;

  // Ejecutar, con la carpa montada el viernes: la organizadora paga al
  // proveedor el precio elegido y consume las horas previstas.
  r.ejecucion = await ejecutar(eje, {
    autor: 'organizadora',
    consolidacion: r.consolidacion.id,
    t: '2026-11-13T18:00:00Z',
    titulo: 'Carpa montada y pagada',
    movimientos: movimientosDeEjecucion(eje, r.consolidacion.id, r.tarea.id),
  }, priv('organizadora'));
  return r;
}
