// Generado por datos/generar-efectos.mjs desde datos/efectos.json.
// No se edita a mano: se cambia el JSON y se ejecuta `node datos/generar-efectos.mjs`.

export const CATALOGO_EFECTOS = {
  "nombre": "catálogo de efectos",
  "estado": "propuesta",
  "decision": "Decidido [D]: la clase de modificación es el tercer dígito, relativa al camino (mapa §12 y §13); sobrio y animado son dos renders de la misma operación, y cada animación corresponde a un cambio explicable (FUNDAMENTOS); un registro escrito sobre una dirección es un ocupante más y colisiona con los que ya había (mapa §12, src/encaje.js). Propuesta: qué operación lleva qué nombre; el corpus da el vocabulario de cada mundo pero no lo empareja con operaciones («el significado algebraico de esas interacciones se definirá después», V3 PV1). Por eso cada nombre lleva su fuente y su marca «[X] decidir VG», y cada efecto la arrastra.",
  "fuentes": {
    "V3": "corpus 80_HERENCIA_V3_INTEGRA/01_NUCLEO/02_DIEZ_PV_Y_EXPERIENCIA_VISUAL.md",
    "V3E": "corpus 80_HERENCIA_V3_INTEGRA/03_TRANSICION/ESPECIFICACION_EXPLORATORIA_V3_INTEGRA.md",
    "V4": "corpus 01_NUCLEO_V4/05_DIEZ_PV_UI_Y_MODOS.md",
    "mapa": "mapa global de AGRAM, §12 y §13: decisiones [D] de VG del 6 y 7-11",
    "big picture": "big picture del 7-11, §6: propuesta de Core, no corpus"
  },
  "marcas": {
    "sinNombre": "[X] decidir VG: el corpus no nombra este efecto en este mundo",
    "matriz": "[X] decidir VG: leer lo que un registro trae dentro como la matriz 10×10×10 (posición, subposición, clase) está decidido solo para el registro de salida de la fábrica (mapa §12 y §13); hoy ningún registro de main lo es con certeza (la PR #40 lo trae; si escritura y consolidar son la misma salida sigue abierto, FABRICA_10X10 D1/D2). Aquí es propuesta",
    "marco": "[X] decidir VG: el registro no guarda desde qué camino del foco se escribió; se lee desde la raíz del foco (mapa §13 con n = 0). Escrito desde un camino más hondo, su mundo y su clase serían otros",
    "marcoLectura": "[X] decidir VG: el registro no guarda desde qué camino del foco se escribió; aquí se lee desde el camino de quien mira (mapa §13 con n = su profundidad), porque está anclado en él o bajo él. Si se escribió desde otro camino, su mundo y su clase serían otros",
    "familia": "[X] decidir VG: el mundo y la clase de cada familia de tokens salen de los cuatro moduladores del jardín, que el corpus da como «metáfora, no equivalencia técnica aprobada» (V3 PV2). Coinciden con los nombres que VG dio a las clases 1 a 4 (impulso de recursos, criterio, comunicación, acción) y con P = poder/criterio (FUNDAMENTOS)",
    "claseFase": "[X] decidir VG: qué clase lleva una fase del motor. Leída en la posición 4 de su camino, donde el motor la ancla, sale 0, como en la PR #40 (AUDITORIA_AJUSTE C9)"
  },
  "tipos": {
    "ver": {
      "clase": 0,
      "generico": "ver",
      "que": "El registro es una referencia a su foco (el registro mínimo de ver), o una celda suya apunta al foco y el registro la marca como vista (contexto.vistas, o fuera de contexto.heredadas cuando las lista). Ver ya es una modificación."
    },
    "sustituir": {
      "clase": 0,
      "generico": "sustituir",
      "que": "El registro ocupa una dirección del foco que ya tenía ocupantes antes que él (los del foco, lo que alcanzan sus referencias y lo escrito antes allí: encaje.ocupantes) y colisiona con ellos. Corregir es añadir: nada se borra."
    },
    "anclado": {
      "clase": 0,
      "generico": "anclar",
      "que": "El registro es el primer ocupante de una dirección que el foco no desarrolla: lo lejano se ancla en su posición."
    },
    "escrito": {
      "clase": 0,
      "generico": "escribir",
      "que": "Contenido de clase 0 que el registro trae dentro, celda a celda (lectura como matriz, [X]); o el génesis, que no tiene foco."
    },
    "impulso": {
      "clase": 1,
      "generico": "impulso de recursos",
      "que": "Clase 1: el registro, por la dirección donde se ancla, o una celda suya."
    },
    "modificar": {
      "clase": "2-9",
      "generico": "modificar",
      "que": "Clases 2 a 9: el registro, por la dirección donde se ancla, o una celda suya. El nombre genérico lleva el de su clase."
    },
    "token": {
      "generico": {
        "emitir": "emitir",
        "mover": "mover",
        "consumir": "consumir"
      },
      "que": "Un movimiento de tokens del evento: emitir (de nadie), mover (de alguien a alguien) o consumir (a nadie). No ocurre en una celda sino entre carteras."
    },
    "fase": {
      "generico": {
        "consolidado": "consolidar",
        "autorizado": "autorizar",
        "ejecutado": "ejecutar"
      },
      "que": "La fase que un registro del motor marca en contexto.fase, solo si el motor la reconoce: la consolidación que lista, la autorización que cuenta y la ejecución que da el estado EJECUTADO (src/motor.js)."
    },
    "ruido": {
      "generico": "ruido",
      "que": "Un registro que marca una fase del motor que el motor no reconoce («lo demás es ruido», src/motor.js): no hay transición, solo lo escrito y sus tokens."
    }
  },
  "clases": [
    {
      "clase": 0,
      "nombre": "ver/sustituir",
      "decision": "[D] VG, 7-11 (mapa §12)"
    },
    {
      "clase": 1,
      "nombre": "impulso de recursos",
      "decision": "[D] VG, 7-11 (mapa §12)"
    },
    {
      "clase": 2,
      "nombre": "criterio",
      "decision": "[D] VG, 7-11 (mapa §12)"
    },
    {
      "clase": 3,
      "nombre": "comunicación",
      "decision": "[D] VG, 7-11 (mapa §12)"
    },
    {
      "clase": 4,
      "nombre": "acción",
      "decision": "[D] VG, 7-11 (mapa §12)"
    },
    {
      "clase": 5,
      "nombre": null,
      "decision": "[X] decidir VG: es el PV5 (estructura); su nombre como clase de modificación no está decidido"
    },
    {
      "clase": 6,
      "nombre": null,
      "decision": "[X] decidir VG: es el PV6 (pasado); su nombre como clase de modificación no está decidido"
    },
    {
      "clase": 7,
      "nombre": null,
      "decision": "[X] decidir VG: es el PV7 (futuro); su nombre como clase de modificación no está decidido"
    },
    {
      "clase": 8,
      "nombre": null,
      "decision": "[X] decidir VG: es el PV8 (comparabilidad); su nombre como clase de modificación no está decidido"
    },
    {
      "clase": 9,
      "nombre": null,
      "decision": "[X] decidir VG: es el PV9 (camino); su nombre como clase de modificación no está decidido"
    }
  ],
  "familias": {
    "E": {
      "mundo": 1,
      "clase": 1,
      "modulador": "luz",
      "fuente": "V3E §06.2: «Luz → recursos / dimensión PV1»"
    },
    "P": {
      "mundo": 2,
      "clase": 2,
      "modulador": "calor",
      "fuente": "V3E §06.2: «Calor → poder / dimensión PV2»"
    },
    "R": {
      "mundo": 3,
      "clase": 3,
      "modulador": "agua",
      "fuente": "V3E §06.2: «Agua → reputación/comunicación / dimensión PV3»"
    },
    "T": {
      "mundo": 4,
      "clase": 4,
      "modulador": "vida",
      "fuente": "V3E §06.2: «Vida, fauna, polinizadores, animales → trabajo/tiempo/actividad / dimensión PV4»"
    }
  },
  "mundos": [
    {
      "pv": 0,
      "nombre": "lente",
      "largo": "lente libre sobre el registro en foco",
      "efectos": {
        "*": {
          "nombre": "mostrar",
          "metafora": "La lente enseña el elemento como lo quiere su autor: una palabra, una cifra, una imagen o una escena. Puede simplificar o engañar: no promete verdad.",
          "fuente": "V3E §04: «Su finalidad es mostrar el elemento»; V3 PV0: «PV0 no promete verdad»",
          "decision": "[X] decidir VG: emparejamiento propuesto (la palabra es del corpus; que la lente lo muestre todo, no)"
        }
      },
      "sinOperacion": []
    },
    {
      "pv": 1,
      "nombre": "ciudad",
      "largo": "reino / ciudad de los recursos",
      "efectos": {
        "escrito": {
          "nombre": "abrir tienda",
          "metafora": "Aparece algo nuevo en la ciudad: una tienda donde no había nada. Al crecer, manzana, gremio, barrio.",
          "fuente": "V3E §05.1: «Un proyecto muy pequeño comienza como una tienda»",
          "decision": "[X] decidir VG: emparejamiento propuesto; además, nombre compuesto con el vocabulario del corpus, que no está en él"
        },
        "sustituir": {
          "nombre": "encarecer o abaratar",
          "metafora": "Llega otro ocupante a algo que ya estaba: el coste sube o baja, la disponibilidad o la seguridad cambian.",
          "fuente": "V3 PV1: «abaratamiento/encarecimiento de costes, seguridad, disponibilidad»",
          "decision": "[X] decidir VG: emparejamiento propuesto (la palabra es del corpus; qué operación la lleva, no)"
        },
        "impulso": {
          "nombre": "mercancía que fluye",
          "metafora": "Los recursos se ponen en marcha por las calles: flujo de mercancías y movimiento económico.",
          "fuente": "V3 PV1: «flujos de mercancías y movimiento económico»",
          "decision": "[X] decidir VG: emparejamiento propuesto (la palabra es del corpus; qué operación la lleva, no)"
        },
        "token.emitir": {
          "nombre": "abrir vía",
          "metafora": "Quien respalda un recurso abre su vía: pone en la ciudad su serie limitada, tantas unidades como respalda.",
          "fuente": "V3 PV1: «apertura/cierre de vías y recursos»; mapa §12 [D]: E son denominaciones emitidas en serie limitada por quien las respalda",
          "decision": "[X] decidir VG: emparejamiento propuesto (la palabra es del corpus; qué operación la lleva, no)"
        },
        "token.mover": {
          "nombre": "mercancía que fluye",
          "metafora": "Los recursos pasan de una cartera a otra por las calles de la ciudad.",
          "fuente": "V3 PV1: «flujos de mercancías y movimiento económico»",
          "decision": "[X] decidir VG: emparejamiento propuesto (la palabra es del corpus; qué operación la lleva, no)"
        }
      },
      "sinOperacion": [
        {
          "nombre": "cerrar vía",
          "fuente": "V3 PV1: «apertura/cierre de vías y recursos»",
          "nota": "[X] decidir VG: qué operación cierra una vía; consumir E no cierra la serie."
        },
        {
          "nombre": "seguridad",
          "fuente": "V3 PV1",
          "nota": "Interacción candidata del corpus; ninguna operación del núcleo la produce todavía."
        },
        {
          "nombre": "ciudadanos modelo",
          "fuente": "V3E §05.2",
          "nota": "Rutinas o agentes con oficio y permisos delimitados; llegan con la automatización, no con el núcleo."
        }
      ]
    },
    {
      "pv": 2,
      "nombre": "jardín",
      "largo": "jardín / terrario / bosque de los criterios",
      "efectos": {
        "escrito": {
          "nombre": "brotar",
          "metafora": "Brota una hoja donde no había: un criterio nuevo, todavía hierba.",
          "fuente": "mapa §12 [D]: «hojas/flores/frutos (PV2) = metáfora de la modificación»; V3 PV2: «Plantas crecen, florecen y fructifican»",
          "decision": "[X] decidir VG: emparejamiento propuesto; además, el corpus dice «crecen», no «brotar»"
        },
        "sustituir": {
          "nombre": "florecer",
          "metafora": "Un criterio que ya estaba echa flor: un ocupante nuevo sobre él.",
          "fuente": "V3 PV2: «Plantas crecen, florecen y fructifican»; mapa §12 [D]: flores = modificación",
          "decision": "[X] decidir VG: emparejamiento propuesto (la palabra es del corpus; qué operación la lleva, no)"
        },
        "modificar": {
          "nombre": "florecer",
          "metafora": "El criterio se modifica en otra clase y florece.",
          "fuente": "V3 PV2: «Plantas crecen, florecen y fructifican»; mapa §12 [D]: flores = modificación",
          "decision": "[X] decidir VG: emparejamiento propuesto (la palabra es del corpus; qué operación la lleva, no)"
        },
        "impulso": {
          "nombre": "luz",
          "metafora": "Le llega luz al criterio: recursos que lo alimentan.",
          "fuente": "V3E §06.2: «Luz → recursos / dimensión PV1»",
          "decision": "[X] decidir VG: emparejamiento propuesto (la palabra es del corpus; qué operación la lleva, no)"
        },
        "token.emitir": {
          "nombre": "calor",
          "metafora": "Se enciende el calor: poder con su ámbito.",
          "fuente": "V3E §06.2: «Calor → poder / dimensión PV2»",
          "decision": "[X] decidir VG: emparejamiento propuesto (la palabra es del corpus; qué operación la lleva, no)"
        },
        "token.mover": {
          "nombre": "calor",
          "metafora": "El calor pasa a otra parte del jardín: poder delegado, con el ámbito estrechado.",
          "fuente": "V3E §06.2: «Calor → poder / dimensión PV2»",
          "decision": "[X] decidir VG: emparejamiento propuesto (la palabra es del corpus; qué operación la lleva, no)"
        },
        "fase.consolidado": {
          "nombre": "fructificar",
          "metafora": "Los criterios elegidos dan fruto: la consolidación los fija sin borrar los demás.",
          "fuente": "V3E §06.1: «Flores y frutos: crecimiento, productividad y consolidación de los criterios»",
          "decision": "[X] decidir VG: emparejamiento propuesto (la palabra es del corpus; qué operación la lleva, no)"
        }
      },
      "sinOperacion": [
        {
          "nombre": "marchitar",
          "fuente": "V3 PV2: el ecosistema se desertifica cuando le faltan recursos, calor, agua o vida",
          "nota": "[X] decidir VG: ninguna operación lo produce; corregir es añadir y nada se borra."
        }
      ]
    },
    {
      "pv": 3,
      "nombre": "parque",
      "largo": "parque acuático / spa de la comunicación",
      "efectos": {
        "escrito": {
          "nombre": "hablar",
          "metafora": "Alguien deja algo en el agua: a una persona (bañera) o a un grupo (piscina).",
          "fuente": "V3E §07.1: «Hablar a una persona», «Hablar a un grupo»; §07.3: «dejar algo en el agua»",
          "decision": "[X] decidir VG: emparejamiento propuesto; además, el núcleo no distingue todavía si se habla a una persona o a un grupo"
        },
        "sustituir": {
          "nombre": "hablar",
          "metafora": "Otro mensaje en un agua que ya corría: a una persona (bañera) o a un grupo (piscina).",
          "fuente": "V3E §07.1: «Hablar a una persona», «Hablar a un grupo»",
          "decision": "[X] decidir VG: emparejamiento propuesto; además, el núcleo no distingue todavía si se habla a una persona o a un grupo"
        },
        "ver": {
          "nombre": "escuchar",
          "metafora": "Alguien lee lo que había en el agua: escucha a una persona o a un grupo.",
          "fuente": "V3E §07.1: «Escuchar/leer a una persona», «Escuchar/leer a un grupo»",
          "decision": "[X] decidir VG: emparejamiento propuesto (la palabra es del corpus; qué operación la lleva, no)"
        },
        "impulso": {
          "nombre": "paquete",
          "metafora": "Un robot mensajero lleva un paquete con tokens al agua de alguien.",
          "fuente": "V3E §07.3: «Los paquetes de información pueden incorporar tokens»; robots camareros y mensajeros",
          "decision": "[X] decidir VG: emparejamiento propuesto (la palabra es del corpus; qué operación la lleva, no)"
        },
        "token.mover": {
          "nombre": "subir el agua",
          "metafora": "Sube el agua de quien recibe reputación: más atención en su comunicación.",
          "fuente": "V3E §06.2: «Agua → reputación/comunicación»; §07.3: el agua «puede subir, bajar y redistribuirse»",
          "decision": "[X] decidir VG: emparejamiento propuesto; además, nombre compuesto con el vocabulario del corpus"
        }
      },
      "sinOperacion": [
        {
          "nombre": "silenciar",
          "fuente": "V3E §07.2: «Cueva o zona apartada: comunicación ignorada, silenciada»",
          "nota": "Ninguna operación del núcleo silencia todavía."
        }
      ]
    },
    {
      "pv": 4,
      "nombre": "fábrica",
      "largo": "fábrica de producción, trabajo y tiempo",
      "efectos": {
        "escrito": {
          "nombre": "paso",
          "metafora": "Un paso nuevo en la línea de producción.",
          "fuente": "V3E §08.1: «Pointed: una operación o un puesto paso a paso»; «Sequenced: línea de alrededor de diez pasos de producción»",
          "decision": "[X] decidir VG: emparejamiento propuesto (la palabra es del corpus; qué operación la lleva, no)"
        },
        "sustituir": {
          "nombre": "paso",
          "metafora": "Otro ocupante en un puesto que ya tenía alguien: el paso se rehace sin borrar el anterior.",
          "fuente": "V3E §08.1: «una operación o un puesto paso a paso»",
          "decision": "[X] decidir VG: emparejamiento propuesto (la palabra es del corpus; qué operación la lleva, no)"
        },
        "impulso": {
          "nombre": "impulso",
          "metafora": "Entra el impulso de recursos que mueve la ejecución.",
          "fuente": "mapa §12 [D]: «el impulso financiero es la base de la ejecución»",
          "decision": "[X] decidir VG: emparejamiento propuesto (la palabra es del mapa; qué operación la lleva, no)"
        },
        "token.mover": {
          "nombre": "línea que se mueve",
          "metafora": "El tiempo pasa a otros trabajadores: la línea avanza.",
          "fuente": "big picture §6; V3E §08.6: «rapidez de líneas», «velocidad de los trabajadores»",
          "decision": "[X] decidir VG: emparejamiento propuesto; además, el nombre es de la big picture, no del corpus"
        },
        "token.consumir": {
          "nombre": "línea que se mueve",
          "metafora": "Se gasta tiempo de trabajo: la línea avanza lo que cuesta el registro.",
          "fuente": "big picture §6; V3E §08.6: «rapidez de líneas», «velocidad de los trabajadores»",
          "decision": "[X] decidir VG: emparejamiento propuesto; además, el nombre es de la big picture, no del corpus"
        },
        "fase.consolidado": {
          "nombre": "consolidar",
          "metafora": "La fábrica fija una acción de registro con las elecciones y sus fuentes; todavía no actúa.",
          "fuente": "V4: «consolidación de elecciones»; «Consolidar no actúa externamente»",
          "decision": "[X] decidir VG: emparejamiento propuesto (la palabra es del corpus; qué operación la lleva, no)"
        },
        "fase.autorizado": {
          "nombre": "autorizar",
          "metafora": "Quien tiene poder da paso a la consolidación.",
          "fuente": "V4: «separación entre intención, autorización, ejecución y resultado»",
          "decision": "[X] decidir VG: emparejamiento propuesto (la palabra es del corpus; qué operación la lleva, no)"
        },
        "fase.ejecutado": {
          "nombre": "ejecutar",
          "metafora": "La línea entrega: se mueven los tokens reales y queda la evidencia.",
          "fuente": "V4: «separación entre intención, autorización, ejecución y resultado»",
          "decision": "[X] decidir VG: emparejamiento propuesto (la palabra es del corpus; qué operación la lleva, no)"
        }
      },
      "sinOperacion": [
        {
          "nombre": "previsualizar",
          "fuente": "V3 PV4: «previsualizar cambios»",
          "nota": "Descubrir y proponer no escriben eventos, así que no tienen efecto; [X] decidir VG si previsualizar deja registro."
        }
      ]
    },
    {
      "pv": 5,
      "nombre": "estructura",
      "largo": "estructura: inspección del registro en foco",
      "efectos": {
        "*": {
          "nombre": "inspeccionar",
          "metafora": "Se ve el dato con su estructura, procedencia, referencias y firmas, tipo JSON.",
          "fuente": "V3E §09: «PV5 permite inspeccionar qué hay detrás»",
          "decision": "[X] decidir VG: emparejamiento propuesto (la palabra es del corpus; que la estructura lo inspeccione todo, no)"
        }
      },
      "sinOperacion": []
    },
    {
      "pv": 6,
      "nombre": "hilos del pasado",
      "largo": "hilos del pasado",
      "efectos": {
        "escrito": {
          "nombre": "entra por la izquierda",
          "metafora": "Un hecho entra en el hilo por la izquierda, con más detalle cerca del presente.",
          "fuente": "big picture §6; V3E §10: hilos del pasado; corpus V2: «izquierda pasado / derecha futuro»",
          "decision": "[X] decidir VG: emparejamiento propuesto; además, el nombre es de la big picture, no del corpus"
        },
        "sustituir": {
          "nombre": "entra por la izquierda",
          "metafora": "Otro ocupante de un hecho entra en el hilo por la izquierda, junto al que había.",
          "fuente": "big picture §6; V3E §10",
          "decision": "[X] decidir VG: emparejamiento propuesto; además, el nombre es de la big picture, no del corpus"
        },
        "anclado": {
          "nombre": "entra por la izquierda",
          "metafora": "Un hecho lejano entra en el hilo colgado de su posición.",
          "fuente": "big picture §6; V3E §10",
          "decision": "[X] decidir VG: emparejamiento propuesto; además, el nombre es de la big picture, no del corpus"
        },
        "fase.ejecutado": {
          "nombre": "ancla",
          "metafora": "La ejecución ancla en el hilo lo que era proyecto.",
          "fuente": "big picture §6: «la ejecución ancla»",
          "decision": "[X] decidir VG: emparejamiento propuesto; además, el nombre es de la big picture, no del corpus"
        }
      },
      "sinOperacion": []
    },
    {
      "pv": 7,
      "nombre": "hilos del futuro",
      "largo": "hilos del futuro",
      "efectos": {
        "escrito": {
          "nombre": "arco al futuro",
          "metafora": "Una previsión o un compromiso se dibuja a la derecha, como un arco hacia su momento.",
          "fuente": "big picture §6: «una proyección o una consolidación pendiente se dibuja a la derecha»; V3E §10: hilos del futuro",
          "decision": "[X] decidir VG: emparejamiento propuesto; además, el nombre es de la big picture, no del corpus"
        },
        "sustituir": {
          "nombre": "arco al futuro",
          "metafora": "Otro arco hacia el mismo momento, junto al que había.",
          "fuente": "big picture §6; V3E §10",
          "decision": "[X] decidir VG: emparejamiento propuesto; además, el nombre es de la big picture, no del corpus"
        },
        "anclado": {
          "nombre": "arco al futuro",
          "metafora": "Una previsión lejana, colgada de su posición, se dibuja a la derecha.",
          "fuente": "big picture §6; V3E §10",
          "decision": "[X] decidir VG: emparejamiento propuesto; además, el nombre es de la big picture, no del corpus"
        },
        "fase.consolidado": {
          "nombre": "arco al futuro",
          "metafora": "La consolidación pendiente se dibuja a la derecha: preparada, no hecha.",
          "fuente": "big picture §6: «una consolidación pendiente se dibuja a la derecha»; V3E §10.5: PV4 prepara, PV7 sitúa en el tiempo",
          "decision": "[X] decidir VG: emparejamiento propuesto; además, el nombre es de la big picture, no del corpus"
        },
        "fase.ejecutado": {
          "nombre": "ancla",
          "metafora": "El arco cae al presente y ancla: lo previsto ya es hecho.",
          "fuente": "big picture §6: «la ejecución ancla»",
          "decision": "[X] decidir VG: emparejamiento propuesto; además, el nombre es de la big picture, no del corpus"
        }
      },
      "sinOperacion": []
    },
    {
      "pv": 8,
      "nombre": "cielo",
      "largo": "cielo de estrellas y constelaciones",
      "efectos": {
        "escrito": {
          "nombre": "constelación",
          "metafora": "Las medidas nuevas se agrupan como estrellas en una constelación.",
          "fuente": "V3 PV8: «Agrupar datos como estrellas brillantes y constelaciones»",
          "decision": "[X] decidir VG: emparejamiento propuesto (la palabra es del corpus; qué operación la lleva, no)"
        },
        "sustituir": {
          "nombre": "caja",
          "metafora": "Una base nueva sobre la anterior: el foco se sitúa en su caja, una de las diez, en cada cohorte.",
          "fuente": "mapa §12 [D] (bases del 8): «el foco se sitúa en su caja en cada cohorte»; «Corregir = añadir otra base»",
          "decision": "[X] decidir VG: emparejamiento propuesto (la palabra es del mapa; qué operación la lleva, no)"
        }
      },
      "sinOperacion": [
        {
          "nombre": "fundir",
          "fuente": "mapa §12 [D]: el 8 del proyecto funde las bases de sus hijos",
          "nota": "Llega con las bases del 8 (confluencia); hoy ningún evento funde."
        }
      ]
    },
    {
      "pv": 9,
      "nombre": "camino",
      "largo": "camino de guía hacia la actuación",
      "efectos": {
        "escrito": {
          "nombre": "paso adelante",
          "metafora": "Un paso más en el camino, desde donde se está hacia el objetivo.",
          "fuente": "V3E §12.1: «Se divide en etapas, pasos y transiciones»",
          "decision": "[X] decidir VG: emparejamiento propuesto; además, nombre compuesto con el vocabulario del corpus"
        },
        "sustituir": {
          "nombre": "paso adelante",
          "metafora": "Otro paso en una etapa que ya estaba.",
          "fuente": "V3E §12.1: «etapas, pasos y transiciones»",
          "decision": "[X] decidir VG: emparejamiento propuesto; además, nombre compuesto con el vocabulario del corpus"
        },
        "fase.consolidado": {
          "nombre": "previsualizar",
          "metafora": "El camino enseña lo que se haría: consolidado, todavía sin ejecutar.",
          "fuente": "V3 PV9: controles «previsualizar» y «ejecutar»; V4: «Consolidar no actúa externamente»",
          "decision": "[X] decidir VG: emparejamiento propuesto (la palabra es del corpus; qué operación la lleva, no)"
        },
        "fase.ejecutado": {
          "nombre": "ejecutar",
          "metafora": "El paso se da de verdad, con autoridad explícita.",
          "fuente": "V3 PV9: «nunca convertir una sugerencia en ejecución sin autoridad explícita»",
          "decision": "[X] decidir VG: emparejamiento propuesto (la palabra es del corpus; qué operación la lleva, no)"
        }
      },
      "sinOperacion": []
    }
  ]
};
