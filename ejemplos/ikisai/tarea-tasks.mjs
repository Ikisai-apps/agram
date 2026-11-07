// Ejemplo transversal con datos inventados: una tarea (Tasks) en una casa
// de eventos. Tiempo, pasos y dinero sobre el mismo núcleo que la compra de
// comida. Construye su propio eje:
//   - génesis de la casa (una persona): emite una serie de E por partida del
//     sábado, minutos, horas y poder sobre todo el eje;
//   - altas de una persona organizadora y de un proveedor externo;
//   - la casa escribe las partidas del sábado;
//   - la organizadora escribe la tarea «montar la carpa del sábado», una
//     décupla con sus fórmulas BQL;
//   - el proveedor escribe presupuestos donde la tarea dice que busca (su 5):
//     en sus recursos (1), donde colisionan con lo propio;
//   - el motor: descubrir → proponer (la fórmula del 9 deja los presupuestos
//     que caben en coste y en plazo y se queda con el primero que llegó) →
//     consolidar → la casa autoriza (P) → el proveedor entrega y consume sus
//     horas (T) → la organizadora ejecuta el pago (E) en las series de las
//     partidas.
// Nada de esto es real.
//
// Las series de tokens (VG, 7-11; src/tokens.js):
//   T: un token por escala y sin conversión: T:minuto y T:hora son series
//      distintas. Escribir cuesta minutos (uno por posición) y trabajar
//      cuesta horas, así que la casa reparte las dos.
//   E: E:<emisor>/<denominación>. Cada partida es una posición con capacidad
//      (su importe) respaldada por una serie limitada de E que emite la casa,
//      E:casa/<concepto> (ver PARTIDAS). La organizadora recibe las series de
//      las partidas de su tarea y ningún otro E, así que el núcleo no la deja
//      pagar más que el coste total de la tarea.
//   P: por ámbito (aquí «genesis»: la casa autoriza sobre todo su eje).
//   R: por emisor (no aparece en esta tarea).
// Emitir es solo de personas (VG, 7-11 noche): la casa es la persona que la
// lleva y emite en el génesis; las altas declaran a la organizadora y al
// proveedor como personas, que aquí no emiten.

import { Eje } from '../../src/eje.js';
import { evaluar } from '../../src/bql.js';
import { indicesDe } from '../../src/btml.js';
import { claveToken } from '../../src/tokens.js';
import { costeT, escribirDesde } from '../../src/escritura.js';
import { descubrir, proponer, consolidar, autorizar, ejecutar, FABRICA } from '../../src/motor.js';

/** Calendario inventado: hoy es sábado 7; la fiesta, el sábado 14. */
export const T0 = '2026-11-07T09:00:00Z';
export const FECHA_LIMITE = '2026-11-14T09:00:00Z';

/**
 * Dónde busca la tarea sus presupuestos: en sus recursos (1). La tarea lo
 * guarda en su 5, «dónde encaja lo que busco» (mapa §2.3), y el proveedor
 * escribe ahí, así que los presupuestos colisionan con lo propio.
 * La fórmula del 9 busca con BUSCAR(LOCAL(5)), por dirección (mapa §12:
 * BUSCAR por índice y por dirección, llegado con la #36): el texto de diez
 * dígitos del 5 nombra la colisión entera del 1.
 *
 * [X] decidir VG: quién puede ocupar una posición de recursos ajena. El 1 es
 * de la tarea (lo escribe la organizadora) y cualquiera con minutos escribe
 * en él: el proveedor, la casa o alguien que no está en la tarea. El eje y el
 * motor no lo limitan, y la fórmula del 9 no puede (no lee el autor de un
 * candidato). Este ejemplo solo lo para al pagar (movimientosDeEjecucion).
 */
export const EN_PRESUPUESTO = '1000000000';

/**
 * Partidas del sábado: [concepto, importe en EUR]. Cada una es una posición
 * con capacidad (su importe, en el registro de partidas) respaldada por una
 * serie limitada de E que emite la casa, E:casa/<concepto>, con tantos tokens
 * como euros de capacidad (mapa §12: la plaza y su serie). Las tres primeras
 * son las de la carpa.
 * [X] decidir VG: que la denominación sea el concepto y que un token valga un
 * EUR es convención de este ejemplo. BQL ve «250 EUR» y el eje ve 250 tokens
 * de E:casa/alquiler de la carpa; la traducción va a mano (ver ESCALA_DE_UNIDAD).
 */
export const PARTIDAS = Object.freeze([
  Object.freeze(['alquiler de la carpa', 250]),
  Object.freeze(['transporte', 60]),
  Object.freeze(['imprevistos', 40]),
  Object.freeze(['tarima del escenario', 120]),
]);
const DE_LA_CARPA = PARTIDAS.slice(0, 3);

/**
 * Unidades de BQL → escala del token T. En BQL las unidades son etiquetas
 * («7 h» no sabe que es la escala hora); la traducción va a mano.
 * [X] decidir VG: si las unidades de tiempo de BQL deben ser las siete
 * escalas de T por definición, y cómo se liga una unidad de BQL («EUR») a
 * las series de E que la respaldan (aquí, las de las partidas).
 */
export const ESCALA_DE_UNIDAD = Object.freeze({ min: 'minuto', h: 'hora' });

/**
 * Etapas del ejemplo, en orden. `hasta` detiene el ejemplo al terminar una:
 * la tarea escrita, los presupuestos recibidos, la consolidación, la
 * autorización, la entrega del proveedor o la ejecución (por defecto, todo).
 */
export const ETAPAS = Object.freeze(['tarea', 'presupuestos', 'consolidada', 'autorizada', 'entregada', 'ejecutada']);

/** Dónde vive el coste total en toda tarea: 1.1, la cantidad de los recursos. */
export const DIR_COSTE = '1100000000';
/** Dónde vive el tiempo previsto en toda tarea: 4.1, la cantidad de la fábrica. */
export const DIR_TIEMPO = '4100000000';

/**
 * La fórmula del 9: de los ocupantes del 1, los escritos (ORIGEN); de ellos,
 * los que caben: precio (su 1) dentro del coste total de la tarea (1.1) y
 * plazo (su 2) dentro del plazo de la tarea (2.1); y de esos, el primero en
 * el orden de BUSCAR. Todo escrito anclado en el 1 encaja exacto (diez
 * profundidades de acuerdo), así que ese orden es el de llegada (mapa §12:
 * los empates, por llegada). Los dos FILTRAR van anidados porque Y evalúa
 * todos sus argumentos: ACTUAL(1) sobre lo propio (un array) pararía la
 * consulta.
 *
 * Corregir es añadir un ocupante (mapa §12): un presupuesto corregido no
 * sustituye al original. Los dos quedan en el 1, y la fórmula elige entre
 * ellos por llegada sin borrar ninguno.
 * [X] decidir VG: preferir la corrección. Con ORIGEN y la llegada, la fórmula
 * solo puede quedarse con el PRIMERO que cabe: si el original también cabe,
 * sale el original. Preferir la corrección pide algo que BQL no expresa:
 * leer el autor y la llegada de cada candidato (los candidatos de BUSCAR los
 * llevan, pero ninguna función los expone) o tomar el ÚLTIMO de una colección
 * (ELEGIR toma desde el principio y ORDENAR no tiene clave de llegada). Aquí
 * no se inventa una función para eso.
 *
 * [X] decidir VG: la elección vive en el 9 y no en el 1. La consolidación
 * tiene un solo hueco por PV: su 1 guarda o los recursos literales de la
 * tarea (por referencia) o el presupuesto elegido, no las dos cosas.
 * `consolidar` aceptaría el candidato en el 1 (no comprueba qué va en cada
 * posición); este ejemplo lo deja en el 9 para no perder los recursos. Es el
 * mismo choque que en la tarea: `proponer` pone cada elección en la posición
 * de su fórmula, y el 1 de la tarea ya guarda los recursos.
 */
export const FORMULA_ELECCION = '=ELEGIR(FILTRAR(FILTRAR(BUSCAR(LOCAL(5)), ORIGEN() = "escrito"), Y(ACTUAL(1) <= LOCAL(1, 1), ACTUAL(2) <= LOCAL(2, 1))))';

/**
 * La décupla de una tarea. En la raíz cada posición es un PV (época 0):
 *   0 el título; 1 recursos; 2 criterios; 3 quién habla con quién;
 *   4 fábrica; 5 dónde encaja lo que busco (EN_PRESUPUESTO); 6 de dónde
 *   viene; 7 la fecha límite; 8 la composición «EUR + horas»; 9 la elección.
 * Debajo hay hileras: una lista con su nombre en .0 (la representación) y
 * sus ítems por orden en .1, .2… (partidas, materiales, criterios, quién y
 * pasos). Recursos (1) y fábrica (4) agrupan una hilera en x.0 y su cantidad
 * en x.1, en una dirección fija e igual en toda tarea: el coste total en 1.1
 * (DIR_COSTE) y el tiempo previsto en 4.1 (DIR_TIEMPO). Las fórmulas viven
 * donde alcanzan lo que leen, porque LOCAL solo mira dentro de su anfitrión:
 * el coste dentro de recursos, el tiempo dentro de la fábrica, y lo que cruza
 * PV en la raíz (la composición del 8 y la elección del 9).
 *
 *   partidas: referencias a los importes de las partidas (no copias), de una a nueve.
 *   materiales: textos, de uno a nueve.
 *   quien: identidades que hablan en la tarea, de una a nueve.
 *   pasos: [[nombre, '2 h'], …], de uno a nueve.
 *   origen: referencia para el 6 (de dónde viene la tarea).
 *
 * [X] decidir VG: el relleno hasta el 9. La elección vive en el 9 y un array
 * BTML no tiene huecos, así que del 5 al 8 hay que escribir algo. El mapa
 * (§12) dice «sin no aplicable; prefijo denso y anclaje»: lo lejano se ancla
 * en vez de rellenar. Anclar la elección en el 9 no funciona hoy: `proponer`
 * solo lee las fórmulas del payload del foco, y una fórmula anclada busca
 * candidatos en su propio registro (BUSCAR mira desde su anfitrión, también
 * por dirección), no en la colisión del 1 de la tarea. Qué queda en cada
 * posición:
 *   - 5: lo que el corpus le da, dónde encaja lo que busco. Antes llevaba un
 *     recuento de presupuestos, que se quita: el mapa (§12) pone los
 *     recuentos en las bases del 8, registros escritos en el 8 (#19). Ahora
 *     el recuento es una consulta y no ocupa posición.
 *   - 6 y 7 dicen lo de su PV (de dónde viene, la fecha límite), pero repiten
 *     lo que ya dicen el hilo (la tarea se escribe sobre las partidas) y la
 *     proyección anclada en el 7.
 *   - 8: la composición «EUR + horas», que comparan las tareas hermanas, es
 *     de este ejemplo. El 8 del mapa son las bases.
 *
 * [X] decidir VG: hileras ordinales. La época 0 dice que cada dígito es un PV
 * en todas las profundidades. Por debajo de la raíz lo cumplen el nombre de
 * cada hilera (.0, su representación) y las dos cantidades (1.1 y 4.1: PV1,
 * cantidades y costes). Lo demás va por orden, no por PV:
 *   - las hileras de partidas y de pasos ocupan 1.0 y 4.0 (la representación
 *     de los recursos y de la fábrica), y los materiales, 1.2 (criterios de
 *     los recursos);
 *   - dentro de las hileras, las partidas (1.0.k), los materiales (1.2.k),
 *     plazo y calidad (2.1 y 2.2), quién (3.k) y los pasos (4.0.k);
 *   - en el registro de partidas, el transporte cae en 1.2 (criterios), los
 *     imprevistos en 1.3 (comunicación) y la tarima en 1.4 (fábrica).
 * Una hilera ordinal pide su regla corta.
 */
export function decuplaTarea({ titulo, partidas, materiales, plazo, calidad, quien, pasos, origen, fechaLimite }) {
  for (const [nombre, lista] of [['partidas', partidas], ['materiales', materiales], ['quien', quien], ['pasos', pasos]]) {
    if (!lista.length || lista.length > 9) throw new Error('de uno a nueve: ' + nombre);
  }
  const coste = '=' + partidas.map((_, k) => 'LOCAL(0, ' + (k + 1) + ')').join(' + ');
  const tiempo = '=' + pasos.map((_, k) => 'LOCAL(0, ' + (k + 1) + ', 1)').join(' + ');
  return [
    titulo, // 0 representación
    [
      ['Partidas', ...partidas], // 1.0 hilera de partidas: referencias a sus importes
      coste, // 1.1 coste total = suma de las partidas
      ['Materiales', ...materiales], // 1.2 hilera de materiales
    ], // 1 recursos
    ['Criterios', plazo, calidad], // 2 criterios: 2.1 plazo de ejecución (horas), 2.2 calidad
    ['Quién habla con quién', ...quien], // 3 comunicación
    [
      ['Pasos', ...pasos], // 4.0 hilera de pasos
      tiempo, // 4.1 tiempo previsto = suma de los pasos
    ], // 4 fábrica
    EN_PRESUPUESTO, // 5 estructura: dónde encaja lo que busco (los presupuestos, en el 1)
    origen, // 6 pasado: de dónde viene ([X] relleno: repite el hilo)
    fechaLimite, // 7 futuro: la fecha límite ([X] relleno: repite la proyección anclada)
    '=LOCAL(1, 1) + LOCAL(4, 1)', // 8 ([X] relleno): la composición «EUR + horas» de este ejemplo
    FORMULA_ELECCION, // 9 la elección: el primer presupuesto que cabe
  ];
}

/** Tiempo previsto de una tarea (4.1). */
export function tiempoPrevisto(eje, tareaId) {
  return evaluar(eje, tareaId, indicesDe(DIR_TIEMPO));
}

/** El presupuesto que eligió la consolidación (su 9). */
function presupuestoElegido(eje, consolidacionId) {
  const elegido = eje.obtener(consolidacionId)?.payload[9];
  if (!elegido?.ref) throw new Error('la consolidación no tiene presupuesto elegido en el 9');
  return eje.obtener(elegido.ref);
}

/**
 * El pago, leído con BQL y no tecleado: el precio del presupuesto elegido
 * (su 1) pasa de quien ejecuta al autor del presupuesto, en las series de las
 * partidas de la tarea, por su orden (1.0.1, 1.0.2…) y hasta el importe de
 * cada una. La serie de cada partida es la de quien la escribe y la respalda:
 * E:<autor del registro de partidas>/<concepto>, con el concepto en 1.k.0,
 * leído a través de la referencia. Esa serie tiene que estar emitida por él
 * con al menos el importe de la partida (su capacidad).
 *
 * Antes comprueba lo que la fórmula del 9 no puede comprobar: que quien
 * cobra esté en el 3 de la tarea (quién habla con quién) y no sea quien paga.
 *
 * [X] decidir VG: repartir el precio entre partidas por orden es una regla de
 * este ejemplo. Y el proveedor cobra en tokens de las partidas, que la casa
 * respalda: canjearlos por euros (liquidar una serie) no existe.
 */
export function movimientosDeEjecucion(eje, consolidacionId, tareaId) {
  const c = eje.obtener(consolidacionId);
  const tarea = eje.obtener(tareaId);
  const presupuesto = presupuestoElegido(eje, consolidacionId);
  const quien = tarea.payload[3].slice(1);
  if (!quien.includes(presupuesto.autor) || presupuesto.autor === c.autor) {
    throw new Error(presupuesto.autor + ' no cobra: no está en el 3 de la tarea o es quien paga');
  }
  const precio = evaluar(eje, presupuesto.id, [1]);
  if (precio.valor?.tipo !== 'magnitud') throw new Error('precio sin magnitud: ' + precio.texto);
  let resta = precio.valor.cantidad;
  const movimientos = [];
  for (const ref of tarea.payload[1][0].slice(1)) {
    const donde = indicesDe(ref.dir);
    const importe = evaluar(eje, ref.ref, donde).valor;
    if (importe?.tipo !== 'magnitud' || importe.unidad !== precio.valor.unidad) throw new Error('partida sin importe en ' + precio.valor.unidad);
    // El concepto es el ocupante 0 de la 1.k.0 (una lista de uno): se lee por índice, que sí entra en una lista.
    const concepto = evaluar(eje, ref.ref, [...donde.slice(0, -1), 0, 0]).valor;
    if (concepto?.tipo !== 'texto') throw new Error('partida sin concepto');
    const emisor = eje.obtener(ref.ref).autor;
    const serie = eje.serie(claveToken({ token: 'E', emisor, denominacion: concepto.valor }));
    if (serie.emisor !== emisor || serie.emitido < importe.cantidad) throw new Error('partida sin respaldo: ' + emisor + ' no ha emitido ' + importe.cantidad + ' de ' + concepto.valor);
    const parte = Math.min(resta, importe.cantidad);
    if (parte > 0) movimientos.push({ token: 'E', emisor, denominacion: concepto.valor, cantidad: parte, de: c.autor, a: presupuesto.autor });
    resta -= parte;
  }
  if (resta > 0) throw new Error('el precio pasa del coste de las partidas en ' + resta + ' ' + precio.valor.unidad);
  return movimientos;
}

/**
 * Las horas de la entrega, leídas con BQL: las del presupuesto elegido (su
 * 2), que consume su autor, porque es quien trabaja y solo él mueve sus
 * tokens. Las horas previstas de la tarea (4.1) son una previsión de la
 * organizadora y no se consumen.
 * [X] decidir VG: el 2 del presupuesto es su plazo, un criterio (el que la
 * fórmula del 9 compara con el 2.1 de la tarea), y este ejemplo lo consume
 * como horas de trabajo. Son las horas que el proveedor declara; nadie
 * comprueba las reales.
 */
export function horasDeEntrega(eje, consolidacionId) {
  const presupuesto = presupuestoElegido(eje, consolidacionId);
  const horas = evaluar(eje, presupuesto.id, [2]);
  if (horas.valor?.tipo !== 'magnitud' || !ESCALA_DE_UNIDAD[horas.valor.unidad]) throw new Error('tiempo sin escala: ' + horas.texto);
  return { token: 'T', escala: ESCALA_DE_UNIDAD[horas.valor.unidad], cantidad: horas.valor.cantidad, de: presupuesto.autor, a: null };
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

  // Génesis: la casa, una persona, emite y respalda sus series: una de E por
  // partida (su capacidad, E:casa/<concepto>), minutos (escribir), horas
  // (trabajar) y poder sobre todo su eje.
  const eje = await Eje.genesis({
    identidad: 'casa',
    tipo: 'persona', // solo las personas emiten (VG, 7-11 noche)
    emision: [
      ...PARTIDAS.map(([concepto, importe]) => ({ token: 'E', denominacion: concepto, cantidad: importe })), // el génesis pone emisor = casa
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

  // Altas: la organizadora recibe las series de las partidas de la carpa
  // (y ningún otro E), minutos y horas; el proveedor externo, minutos para
  // escribir y horas para trabajar. Existen al recibir tokens, y el alta
  // declara qué son. Escribir cuesta un minuto por posición. La tarima se
  // queda en la casa.
  const declaradas = {};
  for (const id of ['organizadora', 'proveedor']) if (claves[id]?.publica) declaradas[id] = claves[id].publica;
  const altas = ['Altas para la fiesta del sábado', ['organizadora', 'proveedor']];
  r.alta = await eje.escribir({
    autor: 'casa',
    sobre: eje.genesisId,
    t: T0,
    movimientos: [
      { token: 'T', escala: 'minuto', cantidad: costeT(altas), de: 'casa', a: null },
      ...DE_LA_CARPA.map(([concepto, importe]) => ({ token: 'E', emisor: 'casa', denominacion: concepto, cantidad: importe, de: 'casa', a: 'organizadora' })),
      { token: 'T', escala: 'minuto', cantidad: 120, de: 'casa', a: 'organizadora' },
      { token: 'T', escala: 'hora', cantidad: 40, de: 'casa', a: 'organizadora' },
      { token: 'T', escala: 'minuto', cantidad: 60, de: 'casa', a: 'proveedor' },
      { token: 'T', escala: 'hora', cantidad: 20, de: 'casa', a: 'proveedor' },
    ],
    payload: altas,
    contexto: { tipos: { organizadora: 'persona', proveedor: 'persona' }, ...(Object.keys(declaradas).length ? { claves: declaradas } : {}) },
  }, priv('casa'));

  // Partidas del sábado: la casa escribe cada partida [concepto, importe] en
  // una hilera de recursos. El importe es la capacidad de la partida.
  r.partidas = await escribirDesde(eje, {
    modo: 'sequenced',
    autor: 'casa',
    sobre: r.alta.id,
    t: T0,
    payload: [
      'Partidas del sábado', // 0
      // Por hojas (VG, 7-11 noche): cada partida es una décupla [[concepto], importe] (el 0 envuelto), para que
      // su importe tenga dirección (1.k.1); [concepto, importe] sería una lista de dos ocupantes.
      ['Partidas', ...PARTIDAS.map(([concepto, importe]) => [[concepto], importe + ' EUR'])], // 1 recursos: 1.k = [[concepto], importe]
    ],
  }, priv('casa'));

  // La tarea: la organizadora la escribe sobre las partidas, desde Mapped.
  // El presupuesto referencia los importes de las partidas de la carpa
  // (1.1.1, 1.2.1, 1.3.1): no copia.
  r.tarea = await escribirDesde(eje, {
    modo: 'mapped',
    autor: 'organizadora',
    sobre: r.partidas.id,
    t: '2026-11-07T10:00:00Z',
    payload: decuplaTarea({
      titulo: 'Montar la carpa del sábado',
      partidas: DE_LA_CARPA.map((_, k) => ({ ref: r.partidas.id, dir: '1' + (k + 1) + '10000000' })),
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

  // El proveedor escribe un presupuesto donde la tarea dice que busca (su 5:
  // los recursos), por PV: 1 su precio, 2 su plazo, 3 con quién hablar. Se
  // pasa del coste total, y lo corrige. Corregir no es modificar: añade un
  // segundo presupuesto y los dos quedan como ocupantes. Aquí la fórmula del
  // 9 elige el corregido solo porque el primero no cabe (ver FORMULA_ELECCION).
  r.presupuestos = [];
  for (const [t, payload] of [
    ['2026-11-07T17:00:00Z', ['Presupuesto: carpa con suelo de madera', '420 EUR', '5 h', 'proveedor']],
    ['2026-11-08T09:30:00Z', ['Presupuesto corregido: carpa sin suelo', '310 EUR', '6 h', 'proveedor']],
  ]) {
    r.presupuestos.push(await escribirDesde(eje, { modo: 'sequenced', autor: 'proveedor', sobre: r.tarea.id, en: r.tarea.payload[5], t, payload }, priv('proveedor')));
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

  // Entrega: el proveedor monta la carpa y lo registra en la fábrica de la
  // consolidación. Consume las horas de su presupuesto (su 1 en la entrega
  // es una referencia a ellas, no una copia). Es un recibo de tercero: el
  // motor no lo enlaza como evidencia (docs/MOTOR.md §12).
  const presupuesto = presupuestoElegido(eje, r.consolidacion.id);
  const entrega = ['Carpa montada', { ref: presupuesto.id, dir: '2000000000' }];
  r.entrega = await eje.escribir({
    autor: 'proveedor',
    sobre: r.consolidacion.id,
    en: FABRICA,
    t: '2026-11-13T16:00:00Z',
    movimientos: [
      { token: 'T', escala: 'minuto', cantidad: costeT(entrega), de: 'proveedor', a: null },
      horasDeEntrega(eje, r.consolidacion.id),
    ],
    payload: entrega,
  }, priv('proveedor'));
  if (tope < 5) return r;

  // Ejecutar, con la carpa montada el viernes: la organizadora paga al
  // proveedor el precio elegido en las series de las partidas.
  r.ejecucion = await ejecutar(eje, {
    autor: 'organizadora',
    consolidacion: r.consolidacion.id,
    t: '2026-11-13T18:00:00Z',
    titulo: 'Carpa montada y pagada',
    movimientos: movimientosDeEjecucion(eje, r.consolidacion.id, r.tarea.id),
  }, priv('organizadora'));
  return r;
}
