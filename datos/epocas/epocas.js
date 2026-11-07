// Generado por datos/epocas/generar.mjs desde los JSON de esta carpeta.
// No se edita a mano: se cambia el JSON y se ejecuta `npm run epocas`.

// epoca-0.json
export const EPOCA_0_DATOS = {
  "nombre": "época 0",
  "estado": "decidida",
  "decision": "VG, 6-11 noche: «nos valen las 10 reglas de momento». Cada dígito es un PV en todas las profundidades (mapa §10.4 [D]). El génesis se escribe bajo esta regla (mapa §10.1 [D]). VG, 7-11 noche: la época 0 completa son las cien reglas cortas, diez por profundidad y diez profundidades; la profundidad 0 es la cruceta y en toda profundidad n ≥ 1 el dígito es el PV aplicado al nodo de arriba. La «época 1 (propuesta)» se retira como época y su contenido se funde en las profundidades 1 a 9.",
  "principios": [
    "La época está fuera del dato: un dato se lee desde cualquier época; BTML no lleva época dentro (mapa §9 [D]).",
    "Dígito = PV en todas las profundidades: una dirección es una cadena de miradas aplicadas desde el tronco; bajar un nivel es aplicar otra perspectiva al elemento (mapa §8, §10.4 [D]).",
    "Reglas cortas = época 0; reglas largas = lo que pulen las épocas: en toda profundidad n ≥ 1 el dígito es el PV aplicado al nodo de arriba (0 qué es, 1 cuánto, 2 con qué condición, 3 con quién, 4 qué se hace, 5 dónde encaja, 6 de dónde viene, 7 para cuándo, 8 frente a otros, 9 cómo). La profundidad 0 es la cruceta: los diez PV sobre el registro en foco (VG, 7-11 noche).",
    "Décupla y lista, por hojas (VG, 7-11 noche: por hojas): dentro de una posición, un array solo de hojas (terminales o referencias) es una LISTA, sus ocupantes por llegada, sin PV y fuera del árbol; un array con algún array dentro es una DÉCUPLA, y sus índices son dígitos con las reglas cortas. La raíz es siempre la décupla de lo escrito. Una dirección nombra subposiciones de décuplas, nunca un ocupante de una lista (que se alcanza por índice). Para que un grupo de hojas sea décupla se envuelve su 0: compra 1 = [[menú], 1, 'EUR 12'].",
    "Es el respaldo: lo que otra época no especialice se lee con ella (corpus V2 y V3: la época 0 es el fallback de las profundidades sin consolidar).",
    "Todos los dígitos son nominales: ninguna profundidad es ordinal, así que en el encaje ni el signo ni la distancia ordenan (opción B, decidida por VG el 7-11 tarde: mapa §12 [D], «Signo del vector: opción B»).",
    "Los ejemplos de las profundidades 3 a 9 recorren una sola lectura ilustrativa de una reserva (1.7.2.1.3.4.7.6.1), construida para recorrer las profundidades y no como modelo de reserva; ningún caso real llega todavía tan hondo."
  ],
  "ordinales": [],
  "cortes": {
    "todas": [
      1,
      2,
      3,
      4,
      6,
      10,
      16,
      26,
      42
    ],
    "decision": "VG, 7-11 noche (mapa §12 [D] «Cortes y etiquetas del 8»): los cortes de las diez cajas del 8 son regla de la época; la época 0 trae esta escala provisional creciente a saltos, sin más pretensión, y se cambiará con datos reales. Las bases guardan con qué cortes se escribieron. [X] decidir VG: sus valores, y si alguna medida lleva los suyos."
  },
  "reglas": [
    {
      "profundidad": 0,
      "digito": 0,
      "nombre": "representación",
      "significado": "PV0: la lente libre sobre el registro en foco (nombre, cifra, imagen, HTML). Puede engañar; no garantiza verdad.",
      "ejemplo": "compra 0 = 'Compra del menú del día'; =LOCAL(0) lo devuelve."
    },
    {
      "profundidad": 0,
      "digito": 1,
      "nombre": "recursos",
      "significado": "PV1, reino o ciudad: cantidades, entradas y salidas, costes, disponibilidad.",
      "ejemplo": "compra 1 = [[ref menú:1], 1, 'EUR 12']: qué, cuánto, a qué precio (una décupla: su 0 va envuelto)."
    },
    {
      "profundidad": 0,
      "digito": 2,
      "nombre": "criterios",
      "significado": "PV2, jardín: lo que distingue cosas aparentemente iguales; decisiones y preferencias; BUSCAR, FILTRAR, ORDENAR, ELEGIR.",
      "ejemplo": "menú 2 = ['sin gluten', 'vegetariano']; compra 2 = [ref menú:2]."
    },
    {
      "profundidad": 0,
      "digito": 3,
      "nombre": "comunicación",
      "significado": "PV3, parque acuático: hablar y escuchar, persona y grupo; no crea ni infiere relaciones ni motivos.",
      "ejemplo": "compra 3 = ['huesped', 'cocina']: quién habla con quién."
    },
    {
      "profundidad": 0,
      "digito": 4,
      "nombre": "fábrica",
      "significado": "PV4: preparar la actuación con recursos, criterios y comunicaciones y consolidar la elección; en 4 se ejecuta.",
      "ejemplo": "compra 4 = ['pagar', 'servir'] (una lista: dos acciones, dos ocupantes); consolidar() escribe en '4000000000' (FABRICA)."
    },
    {
      "profundidad": 0,
      "digito": 5,
      "nombre": "estructura",
      "significado": "PV5: el registro en foco, el centro de la cruceta (mapa §9 [D]); su estructura, referencias y firmas.",
      "ejemplo": "Los campos de encaje de un candidato (ORIGEN(), ACUERDO(), SIGNO()) son su 5."
    },
    {
      "profundidad": 0,
      "digito": 6,
      "nombre": "pasado",
      "significado": "PV6: hilos del pasado, registros encadenados por referencia; procedencia; más detalle cerca del presente.",
      "ejemplo": "El hilo de la compra: compra → menú → altas → génesis (por «sobre»)."
    },
    {
      "profundidad": 0,
      "digito": 7,
      "nombre": "futuro",
      "significado": "PV7: hilos del futuro: previsiones, compromisos, expiración, ejecución condicional autorizada.",
      "ejemplo": "Una consolidación pendiente de autorización aparece como futuro del foco (ejeTemporal)."
    },
    {
      "profundidad": 0,
      "digito": 8,
      "nombre": "comparabilidad",
      "significado": "PV8, cielo: la confluencia de los hilos; posición frente a comparables, medidas, los diez hitos nivel.grado; las estrellas no son verdad.",
      "ejemplo": "situar(eje, compra) sitúa la compra en su caja entre sus hermanos, leyendo la base escrita en el 8 del menú."
    },
    {
      "profundidad": 0,
      "digito": 9,
      "nombre": "camino",
      "significado": "PV9: la guía que baja de las bases: secuencias, tutoriales, siguiente paso; sugerir no es ejecutar.",
      "ejemplo": "Décupla del corpus V4: 9 = 'Confirmar la elección antes de registrar'."
    },
    {
      "profundidad": 1,
      "digito": 0,
      "nombre": "qué es",
      "significado": "Aplicado al nodo de arriba (la mirada de la profundidad 0, el PV del registro en foco): qué es la parte; su nombre o cara, lo que se ve si no se desarrolla.",
      "ejemplo": "compra 1.0 = [ref menú:1]: qué es lo comprado; =LOCAL(1, 0, 0) lee su ocupante (la referencia, seguida); x.0 ocupa la misma dirección que x (colisión por ceros)."
    },
    {
      "profundidad": 1,
      "digito": 1,
      "nombre": "cuánto",
      "significado": "Aplicado al nodo de arriba (la mirada de la profundidad 0, el PV del registro en foco): cuánto; su magnitud (número con unidad, veces, duración), donde SUMAR y el producto tienen sentido.",
      "ejemplo": "compra 1.1 = 1 (un menú): =LOCAL(1, 1) * 12 EUR da 12 EUR."
    },
    {
      "profundidad": 1,
      "digito": 2,
      "nombre": "con qué condición",
      "significado": "Aplicado al nodo de arriba (la mirada de la profundidad 0, el PV del registro en foco): con qué condición; el criterio que la distingue o la condiciona: precio, requisito, límite.",
      "ejemplo": "compra 1.2 = 'EUR 12': =REF(compra, \"1200000000\") da 12 EUR; una corrección escrita en '1200000000' es otro ocupante."
    },
    {
      "profundidad": 1,
      "digito": 3,
      "nombre": "con quién",
      "significado": "Aplicado al nodo de arriba (la mirada de la profundidad 0, el PV del registro en foco): con quién; su contraparte, quién la provee, la recibe o responde por ella.",
      "ejemplo": "Un escrito en la 1.3 de una reserva de Booking = 'recepción': quién atiende los recursos de la reserva."
    },
    {
      "profundidad": 1,
      "digito": 4,
      "nombre": "qué se hace",
      "significado": "Aplicado al nodo de arriba (la mirada de la profundidad 0, el PV del registro en foco): qué se hace; lo que se hace o se hará con ella. El 4 del 4 es la acción de la acción.",
      "ejemplo": "Escritos en la 1.4 de la compra = 'pagar' (lo que se hace con el recurso) y en la 3.4 = 'avisar'."
    },
    {
      "profundidad": 1,
      "digito": 5,
      "nombre": "dónde encaja",
      "significado": "Aplicado al nodo de arriba (la mirada de la profundidad 0, el PV del registro en foco): dónde encaja; la dirección o referencia donde encaja en el árbol, lo que BUSCAR(LOCAL(5)) recibiría.",
      "ejemplo": "Un escrito en la 1.5 de una reserva de Booking = { ref: calendario, dir: '7000000000' }: dónde encajan sus recursos."
    },
    {
      "profundidad": 1,
      "digito": 6,
      "nombre": "de dónde viene",
      "significado": "Aplicado al nodo de arriba (la mirada de la profundidad 0, el PV del registro en foco): de dónde viene; su origen y procedencia, desde cuándo y qué había antes.",
      "ejemplo": "La cuenta 1 sale de la compra 1.2; un escrito en la 1.6 de una reserva = 'entrada 14-11'."
    },
    {
      "profundidad": 1,
      "digito": 7,
      "nombre": "para cuándo",
      "significado": "Aplicado al nodo de arriba (la mirada de la profundidad 0, el PV del registro en foco): para cuándo; su plazo o compromiso, hasta cuándo vale o cuándo se cumple.",
      "ejemplo": "Un escrito en la 1.7 de una reserva de Booking = 'salida 16-11 12:00'; en la 1.7 de un menú = 'hasta las 16:00'."
    },
    {
      "profundidad": 1,
      "digito": 8,
      "nombre": "frente a otros",
      "significado": "Aplicado al nodo de arriba (la mirada de la profundidad 0, el PV del registro en foco): frente a otros; dónde queda frente a sus comparables: diferencia, nivel, hito requerido.",
      "ejemplo": "Un escrito en la 4.8 de una tarea = '3.1' (aprendizaje profesional, el hito del índice 3)."
    },
    {
      "profundidad": 1,
      "digito": 9,
      "nombre": "cómo",
      "significado": "Aplicado al nodo de arriba (la mirada de la profundidad 0, el PV del registro en foco): cómo; cómo se consigue, se usa o se aplica, y el siguiente paso.",
      "ejemplo": "Un escrito en la 1.9 de una reserva de Booking = 'check-in a partir de las 15:00'; en la 4.9 de una tarea = 'poner manteles'."
    },
    {
      "profundidad": 2,
      "digito": 0,
      "nombre": "qué es",
      "significado": "Aplicado al nodo de arriba (la parte, el nodo de la profundidad 1): qué es; el valor tal como se muestra. Colisiona con el detalle (x.y.0 ocupa la dirección de x.y). Si el detalle es un terminal no tiene posiciones: la lectura es de BQL sobre el valor.",
      "ejemplo": "Un precio escrito en la 1.2 de la compra = 'EUR 12' es terminal: BQL lo muestra como '12 EUR'; un terminal no tiene posición 0 en BTML."
    },
    {
      "profundidad": 2,
      "digito": 1,
      "nombre": "cuánto",
      "significado": "Aplicado al nodo de arriba (la parte, el nodo de la profundidad 1): cuánto; la cantidad, el número puro. Sobre un terminal, lectura de BQL.",
      "ejemplo": "La cantidad del precio escrito en la 1.2 es 12, el número puro."
    },
    {
      "profundidad": 2,
      "digito": 2,
      "nombre": "con qué condición",
      "significado": "Aplicado al nodo de arriba (la parte, el nodo de la profundidad 1): con qué condición; la unidad o la condición que hace válido el valor; separa magnitudes del mismo número. Sobre un terminal, lectura de BQL.",
      "ejemplo": "La unidad del precio escrito en la 1.2 es EUR; unidades distintas no se suman, se componen (14 EUR + 15 min no se funden)."
    },
    {
      "profundidad": 2,
      "digito": 3,
      "nombre": "con quién",
      "significado": "Aplicado al nodo de arriba (la parte, el nodo de la profundidad 1): con quién; quién fija el valor, lo cobra o responde por él.",
      "ejemplo": "El precio escrito en la 1.2 lo fija cocina y lo paga el huésped."
    },
    {
      "profundidad": 2,
      "digito": 4,
      "nombre": "qué se hace",
      "significado": "Aplicado al nodo de arriba (la parte, el nodo de la profundidad 1): qué se hace; la operación que lo produjo: suma, producto, elección, consolidación.",
      "ejemplo": "Los 14 EUR de la cuenta nacen de una suma: =REF(compra, \"1200000000\") + 2 EUR."
    },
    {
      "profundidad": 2,
      "digito": 5,
      "nombre": "dónde encaja",
      "significado": "Aplicado al nodo de arriba (la parte, el nodo de la profundidad 1): dónde encaja; dónde vive y quién lo firma: registro, dirección, camino de índices, firma.",
      "ejemplo": "La cuenta 1 depende de 'compra:1200000000' (dependencias de evaluar())."
    },
    {
      "profundidad": 2,
      "digito": 6,
      "nombre": "de dónde viene",
      "significado": "Aplicado al nodo de arriba (la parte, el nodo de la profundidad 1): de dónde viene; el desglose, los operandos y la procedencia del valor.",
      "ejemplo": "14 EUR (12 EUR + 2 EUR): el desglose del valor; procedencia de sus operandos."
    },
    {
      "profundidad": 2,
      "digito": 7,
      "nombre": "para cuándo",
      "significado": "Aplicado al nodo de arriba (la parte, el nodo de la profundidad 1): para cuándo; hasta cuándo vale o cuándo se liquida.",
      "ejemplo": "Un precio 'de hoy'; una tarifa 'hasta el 30-11'; un precio vencido sigue siendo ocupante, con su fecha."
    },
    {
      "profundidad": 2,
      "digito": 8,
      "nombre": "frente a otros",
      "significado": "Aplicado al nodo de arriba (la parte, el nodo de la profundidad 1): frente a otros; lo ocurrido frente a lo previsto o frente a sus comparables; señala la diferencia, no puntúa.",
      "ejemplo": "La cuenta cobra 14 EUR frente a los 12 EUR del menú: señala la diferencia, no puntúa."
    },
    {
      "profundidad": 2,
      "digito": 9,
      "nombre": "cómo",
      "significado": "Aplicado al nodo de arriba (la parte, el nodo de la profundidad 1): cómo; el camino de cálculo, la fórmula o la instrucción que lo obtiene.",
      "ejemplo": "La fórmula '=REF(…) + 2 EUR'; con '==' se guarda como texto sin evaluarse."
    },
    {
      "profundidad": 3,
      "digito": 0,
      "nombre": "qué es",
      "significado": "Aplicado al nodo de arriba (el detalle, el nodo de la profundidad 2): qué es; su nombre, su valor o su representación tal como se muestra.",
      "ejemplo": "Salida tardía, hasta las 14:00 (1.7.2: la condición de la salida de la reserva de Booking)."
    },
    {
      "profundidad": 3,
      "digito": 1,
      "nombre": "cuánto",
      "significado": "Aplicado al nodo de arriba (el detalle, el nodo de la profundidad 2): cuánto; su cantidad, su medida o los recursos que mueve.",
      "ejemplo": "Dos horas de gracia."
    },
    {
      "profundidad": 3,
      "digito": 2,
      "nombre": "con qué condición",
      "significado": "Aplicado al nodo de arriba (el detalle, el nodo de la profundidad 2): con qué condición; la condición o el criterio que lo distingue, lo limita o lo decide.",
      "ejemplo": "Solo si la habitación siguiente está libre."
    },
    {
      "profundidad": 3,
      "digito": 3,
      "nombre": "con quién",
      "significado": "Aplicado al nodo de arriba (el detalle, el nodo de la profundidad 2): con quién; con quién se relaciona: quién lo da, lo recibe o responde por él.",
      "ejemplo": "La concede recepción."
    },
    {
      "profundidad": 3,
      "digito": 4,
      "nombre": "qué se hace",
      "significado": "Aplicado al nodo de arriba (el detalle, el nodo de la profundidad 2): qué se hace; lo que se hace con él: la acción o la fórmula que lo trabaja.",
      "ejemplo": "Se pide y se aplica en recepción."
    },
    {
      "profundidad": 3,
      "digito": 5,
      "nombre": "dónde encaja",
      "significado": "Aplicado al nodo de arriba (el detalle, el nodo de la profundidad 2): dónde encaja; su lugar en el árbol, su referencia o su firma.",
      "ejemplo": "Cuelga de la salida de la reserva (1.7)."
    },
    {
      "profundidad": 3,
      "digito": 6,
      "nombre": "de dónde viene",
      "significado": "Aplicado al nodo de arriba (el detalle, el nodo de la profundidad 2): de dónde viene; su origen, su procedencia y lo que había antes.",
      "ejemplo": "Sale de la política del alojamiento."
    },
    {
      "profundidad": 3,
      "digito": 7,
      "nombre": "para cuándo",
      "significado": "Aplicado al nodo de arriba (el detalle, el nodo de la profundidad 2): para cuándo; su plazo, su vigencia o su compromiso.",
      "ejemplo": "Se pide antes de las 10:00 del día de salida."
    },
    {
      "profundidad": 3,
      "digito": 8,
      "nombre": "frente a otros",
      "significado": "Aplicado al nodo de arriba (el detalle, el nodo de la profundidad 2): frente a otros; cómo queda frente a otros comparables: diferencia, nivel o base.",
      "ejemplo": "Frente a la salida normal de las 12:00."
    },
    {
      "profundidad": 3,
      "digito": 9,
      "nombre": "cómo",
      "significado": "Aplicado al nodo de arriba (el detalle, el nodo de la profundidad 2): cómo; la guía, la interpretación o el siguiente paso.",
      "ejemplo": "Se pide en recepción o por el chat de Booking."
    },
    {
      "profundidad": 4,
      "digito": 0,
      "nombre": "qué es",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 3): qué es; su nombre, su valor o su representación tal como se muestra.",
      "ejemplo": "EUR 15 (1.7.2.1: el suplemento de la salida tardía)."
    },
    {
      "profundidad": 4,
      "digito": 1,
      "nombre": "cuánto",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 3): cuánto; su cantidad, su medida o los recursos que mueve.",
      "ejemplo": "15, la cantidad pura."
    },
    {
      "profundidad": 4,
      "digito": 2,
      "nombre": "con qué condición",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 3): con qué condición; la condición o el criterio que lo distingue, lo limita o lo decide.",
      "ejemplo": "Por hora de retraso, con tope de dos horas."
    },
    {
      "profundidad": 4,
      "digito": 3,
      "nombre": "con quién",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 3): con quién; con quién se relaciona: quién lo da, lo recibe o responde por él.",
      "ejemplo": "Lo cobra el alojamiento y lo paga el huésped."
    },
    {
      "profundidad": 4,
      "digito": 4,
      "nombre": "qué se hace",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 3): qué se hace; lo que se hace con él: la acción o la fórmula que lo trabaja.",
      "ejemplo": "Se suma a la cuenta de la reserva."
    },
    {
      "profundidad": 4,
      "digito": 5,
      "nombre": "dónde encaja",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 3): dónde encaja; su lugar en el árbol, su referencia o su firma.",
      "ejemplo": "Se apunta en la cuenta de la reserva."
    },
    {
      "profundidad": 4,
      "digito": 6,
      "nombre": "de dónde viene",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 3): de dónde viene; su origen, su procedencia y lo que había antes.",
      "ejemplo": "Sale de la tarifa del alojamiento."
    },
    {
      "profundidad": 4,
      "digito": 7,
      "nombre": "para cuándo",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 3): para cuándo; su plazo, su vigencia o su compromiso.",
      "ejemplo": "Se cobra al salir, el 16-11."
    },
    {
      "profundidad": 4,
      "digito": 8,
      "nombre": "frente a otros",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 3): frente a otros; cómo queda frente a otros comparables: diferencia, nivel o base.",
      "ejemplo": "Frente a la tarifa normal de EUR 90 por noche."
    },
    {
      "profundidad": 4,
      "digito": 9,
      "nombre": "cómo",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 3): cómo; la guía, la interpretación o el siguiente paso.",
      "ejemplo": "Se paga con tarjeta en recepción."
    },
    {
      "profundidad": 5,
      "digito": 0,
      "nombre": "qué es",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 4): qué es; su nombre, su valor o su representación tal como se muestra.",
      "ejemplo": "Recepción (1.7.2.1.3: quién cobra el suplemento)."
    },
    {
      "profundidad": 5,
      "digito": 1,
      "nombre": "cuánto",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 4): cuánto; su cantidad, su medida o los recursos que mueve.",
      "ejemplo": "Un solo puesto atiende."
    },
    {
      "profundidad": 5,
      "digito": 2,
      "nombre": "con qué condición",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 4): con qué condición; la condición o el criterio que lo distingue, lo limita o lo decide.",
      "ejemplo": "Solo de 7:00 a 22:00."
    },
    {
      "profundidad": 5,
      "digito": 3,
      "nombre": "con quién",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 4): con quién; con quién se relaciona: quién lo da, lo recibe o responde por él.",
      "ejemplo": "Responde ante la dirección del alojamiento."
    },
    {
      "profundidad": 5,
      "digito": 4,
      "nombre": "qué se hace",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 4): qué se hace; lo que se hace con él: la acción o la fórmula que lo trabaja.",
      "ejemplo": "Cobrar y dar el recibo."
    },
    {
      "profundidad": 5,
      "digito": 5,
      "nombre": "dónde encaja",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 4): dónde encaja; su lugar en el árbol, su referencia o su firma.",
      "ejemplo": "Es un puesto del equipo del alojamiento."
    },
    {
      "profundidad": 5,
      "digito": 6,
      "nombre": "de dónde viene",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 4): de dónde viene; su origen, su procedencia y lo que había antes.",
      "ejemplo": "Sale del cuadrante de turnos."
    },
    {
      "profundidad": 5,
      "digito": 7,
      "nombre": "para cuándo",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 4): para cuándo; su plazo, su vigencia o su compromiso.",
      "ejemplo": "Cada día de salida."
    },
    {
      "profundidad": 5,
      "digito": 8,
      "nombre": "frente a otros",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 4): frente a otros; cómo queda frente a otros comparables: diferencia, nivel o base.",
      "ejemplo": "Frente a gestionarlo por la aplicación de Booking."
    },
    {
      "profundidad": 5,
      "digito": 9,
      "nombre": "cómo",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 4): cómo; la guía, la interpretación o el siguiente paso.",
      "ejemplo": "Se localiza con el aviso de salida."
    },
    {
      "profundidad": 6,
      "digito": 0,
      "nombre": "qué es",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 5): qué es; su nombre, su valor o su representación tal como se muestra.",
      "ejemplo": "Cobrar y dar el recibo (1.7.2.1.3.4: lo que hace recepción)."
    },
    {
      "profundidad": 6,
      "digito": 1,
      "nombre": "cuánto",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 5): cuánto; su cantidad, su medida o los recursos que mueve.",
      "ejemplo": "Una vez por reserva."
    },
    {
      "profundidad": 6,
      "digito": 2,
      "nombre": "con qué condición",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 5): con qué condición; la condición o el criterio que lo distingue, lo limita o lo decide.",
      "ejemplo": "Solo con la cuenta cerrada."
    },
    {
      "profundidad": 6,
      "digito": 3,
      "nombre": "con quién",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 5): con quién; con quién se relaciona: quién lo da, lo recibe o responde por él.",
      "ejemplo": "Lo hace quien esté en el turno."
    },
    {
      "profundidad": 6,
      "digito": 4,
      "nombre": "qué se hace",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 5): qué se hace; lo que se hace con él: la acción o la fórmula que lo trabaja.",
      "ejemplo": "Primero se cobra; después se da el recibo."
    },
    {
      "profundidad": 6,
      "digito": 5,
      "nombre": "dónde encaja",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 5): dónde encaja; su lugar en el árbol, su referencia o su firma.",
      "ejemplo": "Es un paso de la salida."
    },
    {
      "profundidad": 6,
      "digito": 6,
      "nombre": "de dónde viene",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 5): de dónde viene; su origen, su procedencia y lo que había antes.",
      "ejemplo": "Viene del protocolo de salida."
    },
    {
      "profundidad": 6,
      "digito": 7,
      "nombre": "para cuándo",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 5): para cuándo; su plazo, su vigencia o su compromiso.",
      "ejemplo": "Antes de entregar la llave."
    },
    {
      "profundidad": 6,
      "digito": 8,
      "nombre": "frente a otros",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 5): frente a otros; cómo queda frente a otros comparables: diferencia, nivel o base.",
      "ejemplo": "Frente a cobrar por adelantado."
    },
    {
      "profundidad": 6,
      "digito": 9,
      "nombre": "cómo",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 5): cómo; la guía, la interpretación o el siguiente paso.",
      "ejemplo": "Se hace siguiendo el protocolo de salida."
    },
    {
      "profundidad": 7,
      "digito": 0,
      "nombre": "qué es",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 6): qué es; su nombre, su valor o su representación tal como se muestra.",
      "ejemplo": "Al salir, el 16-11 (1.7.2.1.3.4.7: el plazo de cobrar)."
    },
    {
      "profundidad": 7,
      "digito": 1,
      "nombre": "cuánto",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 6): cuánto; su cantidad, su medida o los recursos que mueve.",
      "ejemplo": "Media hora de margen."
    },
    {
      "profundidad": 7,
      "digito": 2,
      "nombre": "con qué condición",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 6): con qué condición; la condición o el criterio que lo distingue, lo limita o lo decide.",
      "ejemplo": "Se cumple cuando el huésped llega a recepción."
    },
    {
      "profundidad": 7,
      "digito": 3,
      "nombre": "con quién",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 6): con quién; con quién se relaciona: quién lo da, lo recibe o responde por él.",
      "ejemplo": "Lo vigila recepción."
    },
    {
      "profundidad": 7,
      "digito": 4,
      "nombre": "qué se hace",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 6): qué se hace; lo que se hace con él: la acción o la fórmula que lo trabaja.",
      "ejemplo": "Se avisa al huésped el día antes."
    },
    {
      "profundidad": 7,
      "digito": 5,
      "nombre": "dónde encaja",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 6): dónde encaja; su lugar en el árbol, su referencia o su firma.",
      "ejemplo": "Cae en el último día de la estancia."
    },
    {
      "profundidad": 7,
      "digito": 6,
      "nombre": "de dónde viene",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 6): de dónde viene; su origen, su procedencia y lo que había antes.",
      "ejemplo": "Viene de la hora de salida de la reserva (1.7)."
    },
    {
      "profundidad": 7,
      "digito": 7,
      "nombre": "para cuándo",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 6): para cuándo; su plazo, su vigencia o su compromiso.",
      "ejemplo": "Hasta que el huésped salga."
    },
    {
      "profundidad": 7,
      "digito": 8,
      "nombre": "frente a otros",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 6): frente a otros; cómo queda frente a otros comparables: diferencia, nivel o base.",
      "ejemplo": "Frente a las salidas de las otras reservas del día."
    },
    {
      "profundidad": 7,
      "digito": 9,
      "nombre": "cómo",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 6): cómo; la guía, la interpretación o el siguiente paso.",
      "ejemplo": "Se recuerda con un aviso por la mañana."
    },
    {
      "profundidad": 8,
      "digito": 0,
      "nombre": "qué es",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 7): qué es; su nombre, su valor o su representación tal como se muestra.",
      "ejemplo": "La política de salida del alojamiento (1.7.2.1.3.4.7.6: de dónde viene el plazo)."
    },
    {
      "profundidad": 8,
      "digito": 1,
      "nombre": "cuánto",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 7): cuánto; su cantidad, su medida o los recursos que mueve.",
      "ejemplo": "Una sola política para todo el alojamiento."
    },
    {
      "profundidad": 8,
      "digito": 2,
      "nombre": "con qué condición",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 7): con qué condición; la condición o el criterio que lo distingue, lo limita o lo decide.",
      "ejemplo": "Vale salvo acuerdo escrito con la dirección."
    },
    {
      "profundidad": 8,
      "digito": 3,
      "nombre": "con quién",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 7): con quién; con quién se relaciona: quién lo da, lo recibe o responde por él.",
      "ejemplo": "La fija la dirección."
    },
    {
      "profundidad": 8,
      "digito": 4,
      "nombre": "qué se hace",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 7): qué se hace; lo que se hace con él: la acción o la fórmula que lo trabaja.",
      "ejemplo": "Se aplica a cada reserva."
    },
    {
      "profundidad": 8,
      "digito": 5,
      "nombre": "dónde encaja",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 7): dónde encaja; su lugar en el árbol, su referencia o su firma.",
      "ejemplo": "Cuelga de las normas de la casa."
    },
    {
      "profundidad": 8,
      "digito": 6,
      "nombre": "de dónde viene",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 7): de dónde viene; su origen, su procedencia y lo que había antes.",
      "ejemplo": "Viene de las condiciones del alojamiento publicadas en Booking."
    },
    {
      "profundidad": 8,
      "digito": 7,
      "nombre": "para cuándo",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 7): para cuándo; su plazo, su vigencia o su compromiso.",
      "ejemplo": "Vigente hasta fin de temporada."
    },
    {
      "profundidad": 8,
      "digito": 8,
      "nombre": "frente a otros",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 7): frente a otros; cómo queda frente a otros comparables: diferencia, nivel o base.",
      "ejemplo": "Frente a la política de otros alojamientos."
    },
    {
      "profundidad": 8,
      "digito": 9,
      "nombre": "cómo",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 7): cómo; la guía, la interpretación o el siguiente paso.",
      "ejemplo": "Se lee en las condiciones publicadas."
    },
    {
      "profundidad": 9,
      "digito": 0,
      "nombre": "qué es",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 8): qué es; su nombre, su valor o su representación tal como se muestra.",
      "ejemplo": "Una sola política, la publicada (1.7.2.1.3.4.7.6.1: cuántas políticas rigen)."
    },
    {
      "profundidad": 9,
      "digito": 1,
      "nombre": "cuánto",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 8): cuánto; su cantidad, su medida o los recursos que mueve.",
      "ejemplo": "Un solo documento."
    },
    {
      "profundidad": 9,
      "digito": 2,
      "nombre": "con qué condición",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 8): con qué condición; la condición o el criterio que lo distingue, lo limita o lo decide.",
      "ejemplo": "Sin excepciones salvo acuerdo escrito."
    },
    {
      "profundidad": 9,
      "digito": 3,
      "nombre": "con quién",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 8): con quién; con quién se relaciona: quién lo da, lo recibe o responde por él.",
      "ejemplo": "La publica el alojamiento ante sus huéspedes."
    },
    {
      "profundidad": 9,
      "digito": 4,
      "nombre": "qué se hace",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 8): qué se hace; lo que se hace con él: la acción o la fórmula que lo trabaja.",
      "ejemplo": "Se aplica a todas las reservas."
    },
    {
      "profundidad": 9,
      "digito": 5,
      "nombre": "dónde encaja",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 8): dónde encaja; su lugar en el árbol, su referencia o su firma.",
      "ejemplo": "Cuelga de las condiciones del alojamiento."
    },
    {
      "profundidad": 9,
      "digito": 6,
      "nombre": "de dónde viene",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 8): de dónde viene; su origen, su procedencia y lo que había antes.",
      "ejemplo": "Viene de la última revisión de las condiciones."
    },
    {
      "profundidad": 9,
      "digito": 7,
      "nombre": "para cuándo",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 8): para cuándo; su plazo, su vigencia o su compromiso.",
      "ejemplo": "Vigente toda la temporada."
    },
    {
      "profundidad": 9,
      "digito": 8,
      "nombre": "frente a otros",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 8): frente a otros; cómo queda frente a otros comparables: diferencia, nivel o base.",
      "ejemplo": "Frente a la política del año anterior."
    },
    {
      "profundidad": 9,
      "digito": 9,
      "nombre": "cómo",
      "significado": "Aplicado al nodo de arriba (el nodo de la profundidad 8): cómo; la guía, la interpretación o el siguiente paso.",
      "ejemplo": "Se lee en la ficha del alojamiento."
    }
  ],
  "dudas": [
    "1 · [X] decidir VG. Profundidad 2: ¿posiciones consultables (LOCAL(1, 2, 2) = 'EUR') o lectura de BQL sobre los campos que ya guarda el valor (unidad, desglose, dependencias)? En el registro de salida de la fábrica ya está decidido: el tercer dígito es la clase de modificación.",
    "2 · [X] decidir VG. Más de diez (mesas de doce, grupos grandes): ¿registro propio referenciado o vista BQL? Una lista ya es de n (VG, 7-11 noche: por hojas): el límite de diez queda por evento y por décupla.",
    "3 · [X] decidir VG. Una referencia BTML es una dirección y una dirección no entra en una lista: ¿cómo se referencia un ocupante concreto de una lista (el guiso del menú)? Hoy se referencia la lista entera.",
    "4 · [X] decidir VG. La convención para que un grupo de hojas sea décupla (envolver su 0: [[qué], cuánto, …]) es de los ejemplos; ¿se fija como forma canónica u otra (por ejemplo, envolver todas)?"
  ]
};
