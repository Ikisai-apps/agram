# Índice de los documentos

Qué leer para qué. Todo lo que hay aquí describe `main` (03dbf34, con la integración #55: fábrica 10×10×10, bases del 8, efectos, validez, Scened, mundo de los hilos y frontend). Lo que falta por decidir se marca «[X] decidir VG», y lo que no existe, «pendiente». El mapa global, con las decisiones de VG ([D]), los acuerdos de trabajo ([A]) y lo abierto ([X]), vive fuera de este repositorio público (`MUELA/equipo/agram/MAPA_GLOBAL_AGRAM.md`). Lo decidido que importa para el código está resumido en `docs/FUNDAMENTOS.md`.

## Por dónde empezar

| Si eres… | Lee, en este orden |
|---|---|
| alguien que llega y quiere saber qué es AGRAM | `README.md` → `docs/FUNDAMENTOS.md` |
| un programa o un agente que va a escribir registros y fórmulas | `docs/BTML.md` → `docs/BQL.md` → `docs/MOTOR.md` (es lo que leyó «el extranjero», `docs/notas/PRUEBA_DEL_EXTRANJERO.md`) |
| quien toca la pantalla | `docs/MODOS.md` → `docs/EFECTOS.md` (cada animación sale de un efecto) → `docs/MOTOR.md` §7 → `carta/` (la carta) y, la web antigua, `antigua/app.js`, `antigua/ui/` y `antigua/mundos/` |
| quien va a decidir (VG) | `docs/FUNDAMENTOS.md` («Las decisiones del mapa §12, una a una») → las notas de `docs/notas/` → las «Dudas para VG» de `docs/REGLAS_CORTAS.md` |

## Para qué sirve cada documento

| Documento | Para qué | Lo esencial |
|---|---|---|
| `README.md` | Qué es el repositorio, cómo se ejecuta y dónde se publica | `node ejemplos/ikisai/correr.mjs`, `npm test`, GitHub Pages |
| `docs/FUNDAMENTOS.md` | Lo decidido, sin código: la cruz y la X, eventos sobre tokens, génesis, épocas, colisiones, el vector de encaje, el 8, AARPIA, series de tokens, la plaza, la fábrica 10×10×10 y el orden de los mundos | «Las decisiones del mapa §12, una a una» comprueba cada [D] del mapa §12 y dice si ya está en `main` |
| `docs/BTML.md` | La estructura de datos tal como existe: el evento, los movimientos E/P/R/T, el payload, las direcciones de diez dígitos, `sobre` y `en`, las colisiones y el encaje, identidades y firmas, el génesis, el eje de ejemplo y la API | §6 (colisiones y encaje) y §2 (series de tokens); §11, lo pendiente |
| `docs/BQL.md` | Las fórmulas: la convención `=`, la gramática, los tipos, los operadores, las funciones (`LOCAL`, `REF`, `BUSCAR`, `ACTUAL`, `FILTRAR`…), los estados y la evaluación segura | §7 (funciones) y §8 (estados); §10, un ejemplo entero ejecutable |
| `docs/BQLM.md` | El BQL mínimo, con el que se escriben las condiciones de las reglas de la época: léxico corto en inglés, gramática, semántica, el contexto sobre el eje (despliegues y vistas del libro como posiciones) y la primera regla leída | §1 (léxico), §4 (el contexto), §6 (la primera regla) y §8 (para decidir VG) |
| `docs/CONTRATO.md` | El contrato entre el núcleo y la pantalla (y, en §14, las cuentas: entrar como uno mismo, la copia de seguridad cifrada y la restauración): la mitad de datos (encargo 3c-1: plantillas, representaciones, ocupantes ordenados, el espacio de bloque, la madurez, el diario, mi foco y mi configuración, los mensajes por idioma) y, del 3c-2b, el libro local (los segundos de cada interacción y el minuto que los engloba), los pasos (lecturas discretas como índice de fotograma) y los modelos de visualización como registros con respaldo en cadena; y, del 3c-2a, la mitad de acción: los seis precios de R, P por mirada, el precio de la E, las estaciones («stage»), las plantillas de transacción del aro, `transaccion`, el camino y `autoejecutar` | §1 (plantillas), §4 (división), §5 (madurez), §10 (libro local), §11 (modelos, pasos y la carta animada), §12 (acciones) y «Para decidir VG» |
| `arte/MANIFIESTO.md` | Qué trae un paquete de arte para convertirse en modelo de visualización (la pieza, el modelo, el índice) y cómo se importa sin copiar archivos (`arte/importar.mjs`); `arte/fase2/LEEME.md`, la biblioteca de la fase 2 (626 piezas, el modelo `ikisai`) | §1 (la pieza) y §3 (lo que trae el paquete) |
| `docs/MOTOR.md` | El ciclo de la fábrica (descubrir, proponer, consolidar, autorizar, ejecutar), el registro de salida por modo, el eje temporal (6 y 7), la comparabilidad (8) y la persistencia | §1 (el ciclo) y §10, el ciclo entero ejecutable |
| `docs/MODOS.md` | Los modos de experiencia (Pointed, Sequenced, Mapped, Scened) y, en detalle, Scened: varios focos en escena con sus aristas, la capacidad de lectura (10000 por defecto; [X] decidir VG: tope duro o capacidad ajustable) y la vista sobria del navegador | §6 (la capacidad y el corte) y §10 (la vista en el frontend) |
| `docs/EFECTOS.md` | El catálogo de efectos: qué cambió en cada operación, de qué clase y cómo se ve en su mundo; el puente entre el núcleo y los mundos animados | «Qué es un efecto» y «Los mundos» |
| `docs/MUNDOS.md` | Los mundos animados del frontend: la cruz (hilos 6 y 7, cielo 8, camino 9, el 5 en el centro) y la X (fábrica 4, ciudad 1, jardín 2, parque 3, lente 0), y cómo entra cada uno con Mapped | la tabla de mundos y los abiertos |
| `docs/VALIDEZ.md` | Las cinco capas de validez de un registro, como estados independientes (`ok`, `pendiente`, `falla`), sin veredicto global | §2 (uso) y §4 (estados) |
| `docs/REGLAS_CORTAS.md` | Qué significa cada dígito en cada profundidad: la época 0, con sus cien reglas cortas (la «época 1 (propuesta)» se retiró: sus preguntas son reglas de la época 0) | «Época 0» y sus [X] |
| `docs/comprobar.mjs` | Comprueba que los documentos dicen la verdad: ejecuta cada ejemplo y compara con la salida impresa | `node docs/comprobar.mjs` desde la raíz |

## Las notas (`docs/notas/`)

Son notas de lectura y de resultados, con fecha y con su base (el commit de `main` sobre el que se hicieron). No deciden nada; cada una lleva arriba su **estado en `main`**, que dice qué ha cambiado desde que se escribió.

| Nota | Para qué | Estado |
|---|---|---|
| `SIGNO_DEL_VECTOR.md` | Las opciones A–E sobre el signo del vector de encaje, con las citas del corpus | VG eligió la B; implementada |
| `REGLAS_LARGAS.md` | Qué son las reglas largas (por prefijo) frente a las cortas, y opciones para introducirlas | abierta: no hay reglas largas |
| `FABRICA_10X10.md` | La fábrica como matriz 10×10×10: el corpus, el mapa y lo que hace el código | decidida por VG el 7-11; en `main` (`src/escritura.js`, `src/modos.js`) |
| `CAPAS_DE_VALIDEZ.md` | Las cinco capas de validez de un registro y opciones para exponerlas | en `main` como módulo de lectura (`src/validez.js`, `docs/VALIDEZ.md`); lo que sigue abierto, allí |
| `BASES_DEL_8.md` | Las bases del 8 como registros fundibles escritos en la posición 8: lo decidido, qué hace el código y los abiertos | en `main` (`src/bases.js`, `BASES()` en BQL) |
| `DOS_ESCALAS_BTML.md` | Qué pueden ser `matrix_data` y `block_data`, y las fronteras de las diez profundidades | abierta |
| `AUDITORIA_AJUSTE.md` | Dónde se separa el código de lo decidido: fichas votadas, el §12 línea a línea y preguntas para VG | base `95e5396`; buena parte ya resuelta en `main` (ver su estado) |
| `PRUEBA_DEL_EXTRANJERO.md` | La prueba del extranjero: un agente con solo BTML, BQL y MOTOR escribe registros y fórmulas, y un conocedor lo califica | hecha; el anexo es histórico y dice qué cambia hoy |
| `CAPA_CERO.md` | La capa cero: el libro de transacciones, la correspondencia evento ↔ transacción y las condiciones envueltas con su fila del inventario | paso 1 del mapa §16 (VG, 9-11); en `src/libro.js` y `src/condiciones/` |

## Dónde está cada cosa en el código

| Busco | Documento | Código | Pruebas |
|---|---|---|---|
| eventos, eje, tokens, génesis | `docs/BTML.md` §1, §2, §8 | `src/evento.js`, `src/eje.js`, `src/tokens.js` | `test/eje.test.js`, `test/eprt.test.js`, `test/evento.test.js`, `test/tokens.test.js` |
| la capa cero: el libro de transacciones y las reglas como condiciones de validez | `docs/FUNDAMENTOS.md` («La capa de transacciones»), `docs/notas/CAPA_CERO.md` | `src/libro.js`, `src/condiciones/`, `src/eje.js` | `test/libro.test.js`, `test/capa-cero.test.js` |
| direcciones, payload, colisiones, encaje | `docs/BTML.md` §3–§6 | `src/btml.js`, `src/encaje.js` | `test/encaje.test.js`, `test/vector.test.js`, `test/conformidad-btml.test.js` |
| firmas y claves | `docs/BTML.md` §7 | `src/autoridad.js` | `test/autoridad.test.js` |
| épocas y reglas cortas | `docs/REGLAS_CORTAS.md` | `src/epocas.js`, `datos/epocas/` | `test/epocas.test.js` |
| fórmulas | `docs/BQL.md` | `src/bql.js` | `test/bql.test.js`, `test/bql-colecciones.test.js`, `test/conformidad-bql.test.js` |
| el BQL mínimo, sus despliegues y vistas, la época como registro y la primera regla | `docs/BQLM.md`, `docs/BTML.md` §12 | `src/bqlm.js`, `src/contexto-eje.js`, `src/epocas.js` (`cargarEpocaBtml`), `datos/epocas/epoca-0.btml.json` | `test/bqlm.test.js`, `test/contexto-eje.test.js`, `test/epoca-btml.test.js`, `test/primera-regla.test.js`, `test/seguridad-bqlm.test.js` |
| el contrato núcleo↔pantalla: plantillas, división, madurez, diario, preferencias, mensajes | `docs/CONTRATO.md` | `src/contrato.js`, `src/contexto-eje.js` (la medida `X.8.6`), `datos/epocas/epoca-0.btml.json` (8.3-8.5, 9.2-9.5), `datos/epocas/reglas/maturity.json` | `test/contrato.test.js`, `test/carta-texto.mjs`, `test/carta-esperada.json` |
| las acciones del aro (encargo 3c-2a): los datos de la época (precios de R, P por mirada, precio de la E, estaciones), las plantillas de transacción, `transaccion`, el camino | `docs/CONTRATO.md` §12 | `src/acciones.js`, `datos/epocas/plantillas/`, `datos/epocas/reglas/attention-group.json`, `attention-price.json`, `stage.json`, `datos/epocas/epoca-0.btml.json` (1.0, 1.1, 1.2, 3.0.9, 4.2, 9.6) | `test/acciones.test.js`, `test/carta-texto.mjs` (`pintarPara`) |
| el libro local (segundos → minuto), los pasos y los modelos de visualización (encargo 3c-2b); la biblioteca de la fase 2 como modelo `ikisai` (etapa 5) | `docs/CONTRATO.md` §10-§11, `arte/MANIFIESTO.md`, `arte/fase2/LEEME.md` | `src/local.js`, `src/pasos.js`, `src/modelos.js`, `datos/epocas/epoca-0.btml.json` (9.3.6, 9.3.7, 9.7, 9.8), `datos/epocas/modelos/`, `arte/importar.mjs`, `arte/fase2/` | `test/local.test.js`, `test/pasos.test.js`, `test/modelos.test.js` |
| la fábrica | `docs/MOTOR.md` §1–§6 | `src/motor.js` | `test/motor.test.js`, `test/proponer.test.js`, `test/conformidad-motor.test.js` |
| la matriz 10×10×10 y los topes de emisión | `docs/MOTOR.md` §7, `docs/notas/FABRICA_10X10.md` | `src/escritura.js`, `src/modos.js` | `test/fabrica-1000.test.js` |
| escribir desde un modo | `docs/MOTOR.md` §7 | `src/escritura.js`, `src/modos.js` | `test/escritura.test.js`, `test/modos.test.js` |
| 6, 7 y 8 | `docs/MOTOR.md` §8, `docs/FUNDAMENTOS.md` («Comparabilidad») | `src/tiempo.js` | `test/tiempo.test.js`, `test/confluencia.test.js` |
| las bases del 8 | `docs/notas/BASES_DEL_8.md`, `docs/MOTOR.md` §14, `docs/BQL.md` §7.13–§7.14 | `src/bases.js`, `src/bql.js` | `test/bases.test.js`, `test/bases-bql.test.js` |
| efectos | `docs/EFECTOS.md` | `src/efectos.js`, `datos/efectos.json` | `test/efectos.test.js` |
| validez | `docs/VALIDEZ.md` | `src/validez.js` | `test/validez.test.js` |
| neutralidad: elegibles antes que límites (R8), sin clave no se actúa (R9), el tipo no da renta (R10) | `docs/FUNDAMENTOS.md` («Neutralidad»), `docs/notas/NEUTRALIDAD_IDENTIDAD.md`, `docs/BQL.md` §7.4 | `src/elegibles.js`, `src/eje.js`, `src/autoridad.js`, `src/ciclo.js` | `test/neutralidad.test.js`, `test/neutralidad-reglas.test.js` |
| la lente de R (R6): la R vale solo con la lente firmada de quien la lee; emitir R exige colateral; atender devoluciones | `docs/FUNDAMENTOS.md` («La lente de R»), `docs/notas/NEUTRALIDAD_IDENTIDAD.md` §4, `docs/BQL.md` §7.15 | `src/lente.js`, `src/ciclo.js`, `src/eje.js`, `src/validez.js`, `src/bql.js`, `ejemplos/ikisai/lente-booking.mjs` | `test/lente.test.js` |
| Pointed, Sequenced, Mapped, Scened | `docs/MODOS.md` | `src/pointed.js`, `src/sequenced.js`, `src/mapped.js`, `src/scened.js` | `test/pointed.test.js`, `test/sequenced.test.js`, `test/mapped.test.js`, `test/scened.test.js` |
| la pantalla | `docs/MODOS.md` §0.5 (la celda 8 de Mapped) y §10 (Scened); la carta animada entera, `docs/CONTRATO.md` §11.6 | la carta: `index.html`, `carta/carta.js`, `carta/dom.js`, `carta/gestos.js`, `carta/app.js` (`docs/CONTRATO.md`); la web antigua: `antigua/index.html`, `antigua/app.js`, `antigua/ui/*.js` | `test/carta.test.js`, `test/ui.test.js`, `test/escena-ui.test.js`, `test/celda-8.test.js` |
| los mundos animados: la cruz y la X | `docs/MUNDOS.md`, `docs/EFECTOS.md` («Los mundos») | `antigua/mundos/` (`hilos-ui.js`, `cruz-ui.js` y `x-ui.js` los enganchan a `antigua/app.js`) | `test/hilos.test.js`, `test/cielo.test.js`, `test/camino.test.js`, `test/cruz.test.js`, `test/cruz-ui.test.js`, `test/mundos-x.test.js`, `test/ganchos-app.test.js` |
| guardar y restaurar | `docs/MOTOR.md` §9, `docs/BTML.md` §8.1 | `src/persistencia.js` | `test/persistencia.test.js` |
| mi cuenta (etapa 2): el alta propia como génesis, la clave en el dispositivo, la copia de seguridad cifrada y la restauración | `docs/CONTRATO.md` §14 | `carta/cuentas.js`, `carta/app.js` (el arranque, el selector «soy», la copia), `carta/dom.js` | `test/cuentas.test.js` |
| ejemplos de Ikisai (datos inventados) | `docs/BTML.md` §9 | `ejemplos/ikisai/` | `test/ejemplo-ikisai.test.js`, `test/ejemplo-booking.test.js`, `test/ejemplo-tasks.test.js` |

## Convenciones de todos los documentos

- Los ejemplos se ejecutan **desde la raíz del repositorio** con Node ≥ 20, y la salida que sigue a cada uno es la real. `node docs/comprobar.mjs` los vuelve a ejecutar todos y dice cuál no da lo impreso. Un fragmento que no se ejecuta solo (usa un `eje` que no define) lleva encima `<!-- comprobar: fragmento -->` y no se ejecuta; un comando de `sh` que no es `node --input-type=module -e` es una instrucción, no un ejemplo.
- Los ids del ejemplo de la compra son deterministas: génesis `18537db9`, alta `ac94ba82`, menú `5c9fbf11`, compra `21367950`, cuenta `07179f18`. En un programa no se copian: cambian en cuanto cambia el cuerpo de un evento.
- «[X] decidir VG» es lo que nadie ha decidido; «pendiente», lo que no existe; [D], [A] y [H] son las marcas del mapa (decidido, acuerdo, hipótesis).
- El repositorio es público: datos inventados, ningún secreto.
