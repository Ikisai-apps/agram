# Índice de los documentos

Qué leer para qué. Todo lo que hay aquí describe `main` (03dbf34, con la integración #55: fábrica 10×10×10, bases del 8, efectos, validez, Scened, mundo de los hilos y frontend). Lo que falta por decidir se marca «[X] decidir VG», y lo que no existe, «pendiente». El mapa global, con las decisiones de VG ([D]), los acuerdos de trabajo ([A]) y lo abierto ([X]), vive fuera de este repositorio público (`MUELA/equipo/agram/MAPA_GLOBAL_AGRAM.md`). Lo decidido que importa para el código está resumido en `docs/FUNDAMENTOS.md`.

## Por dónde empezar

| Si eres… | Lee, en este orden |
|---|---|
| alguien que llega y quiere saber qué es AGRAM | `README.md` → `docs/FUNDAMENTOS.md` |
| un programa o un agente que va a escribir registros y fórmulas | `docs/BTML.md` → `docs/BQL.md` → `docs/MOTOR.md` (es lo que leyó «el extranjero», `docs/notas/PRUEBA_DEL_EXTRANJERO.md`) |
| quien toca la pantalla | `docs/MODOS.md` → `docs/EFECTOS.md` (cada animación sale de un efecto) → `docs/MOTOR.md` §7 → `app.js`, `ui/` y `mundos/` |
| quien va a decidir (VG) | `docs/FUNDAMENTOS.md` («Las decisiones del mapa §12, una a una») → las notas de `docs/notas/` → las «Dudas para VG» de `docs/REGLAS_CORTAS.md` |

## Para qué sirve cada documento

| Documento | Para qué | Lo esencial |
|---|---|---|
| `README.md` | Qué es el repositorio, cómo se ejecuta y dónde se publica | `node ejemplos/ikisai/correr.mjs`, `npm test`, GitHub Pages |
| `docs/FUNDAMENTOS.md` | Lo decidido, sin código: la cruz y la X, eventos sobre tokens, génesis, épocas, colisiones, el vector de encaje, el 8, AARPIA, series de tokens, la plaza, la fábrica 10×10×10 y el orden de los mundos | «Las decisiones del mapa §12, una a una» comprueba cada [D] del mapa §12 y dice si ya está en `main` |
| `docs/BTML.md` | La estructura de datos tal como existe: el evento, los movimientos E/P/R/T, el payload, las direcciones de diez dígitos, `sobre` y `en`, las colisiones y el encaje, identidades y firmas, el génesis, el eje de ejemplo y la API | §6 (colisiones y encaje) y §2 (series de tokens); §11, lo pendiente |
| `docs/BQL.md` | Las fórmulas: la convención `=`, la gramática, los tipos, los operadores, las funciones (`LOCAL`, `REF`, `BUSCAR`, `ACTUAL`, `FILTRAR`…), los estados y la evaluación segura | §7 (funciones) y §8 (estados); §10, un ejemplo entero ejecutable |
| `docs/MOTOR.md` | El ciclo de la fábrica (descubrir, proponer, consolidar, autorizar, ejecutar), el registro de salida por modo, el eje temporal (6 y 7), la comparabilidad (8) y la persistencia | §1 (el ciclo) y §10, el ciclo entero ejecutable |
| `docs/MODOS.md` | Los modos de experiencia (Pointed, Sequenced, Mapped, Scened) y, en detalle, Scened: varios focos en escena con sus aristas, la capacidad de lectura (10000 por defecto; [X] decidir VG: tope duro o capacidad ajustable) y la vista sobria del navegador | §6 (la capacidad y el corte) y §10 (la vista en el frontend) |
| `docs/EFECTOS.md` | El catálogo de efectos: qué cambió en cada operación, de qué clase y cómo se ve en su mundo; el puente entre el núcleo y los mundos animados | «Qué es un efecto» y «Los mundos» |
| `docs/VALIDEZ.md` | Las cinco capas de validez de un registro, como estados independientes (`ok`, `pendiente`, `falla`), sin veredicto global | §2 (uso) y §4 (estados) |
| `docs/REGLAS_CORTAS.md` | Qué significa cada dígito en cada profundidad: la época 0 (decidida) y la «época 1 (propuesta)», con sus dudas para VG | «Época 0» y «Dudas para VG» |
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

## Dónde está cada cosa en el código

| Busco | Documento | Código | Pruebas |
|---|---|---|---|
| eventos, eje, tokens, génesis | `docs/BTML.md` §1, §2, §8 | `src/evento.js`, `src/eje.js`, `src/tokens.js` | `test/eje.test.js`, `test/eprt.test.js`, `test/evento.test.js`, `test/tokens.test.js` |
| direcciones, payload, colisiones, encaje | `docs/BTML.md` §3–§6 | `src/btml.js`, `src/encaje.js` | `test/encaje.test.js`, `test/vector.test.js`, `test/conformidad-btml.test.js` |
| firmas y claves | `docs/BTML.md` §7 | `src/autoridad.js` | `test/autoridad.test.js` |
| épocas y reglas cortas | `docs/REGLAS_CORTAS.md` | `src/epocas.js`, `datos/epocas/` | `test/epocas.test.js` |
| fórmulas | `docs/BQL.md` | `src/bql.js` | `test/bql.test.js`, `test/bql-colecciones.test.js`, `test/conformidad-bql.test.js` |
| la fábrica | `docs/MOTOR.md` §1–§6 | `src/motor.js` | `test/motor.test.js`, `test/proponer.test.js`, `test/conformidad-motor.test.js` |
| la matriz 10×10×10 y los topes de emisión | `docs/MOTOR.md` §7, `docs/notas/FABRICA_10X10.md` | `src/escritura.js`, `src/modos.js` | `test/fabrica-1000.test.js` |
| escribir desde un modo | `docs/MOTOR.md` §7 | `src/escritura.js`, `src/modos.js` | `test/escritura.test.js`, `test/modos.test.js` |
| 6, 7 y 8 | `docs/MOTOR.md` §8, `docs/FUNDAMENTOS.md` («Comparabilidad») | `src/tiempo.js` | `test/tiempo.test.js`, `test/confluencia.test.js` |
| las bases del 8 | `docs/notas/BASES_DEL_8.md`, `docs/MOTOR.md` §14 | `src/bases.js` | `test/bases.test.js` |
| efectos | `docs/EFECTOS.md` | `src/efectos.js`, `datos/efectos.json` | `test/efectos.test.js` |
| validez | `docs/VALIDEZ.md` | `src/validez.js` | `test/validez.test.js` |
| Pointed, Sequenced, Mapped, Scened | `docs/MODOS.md` | `src/pointed.js`, `src/sequenced.js`, `src/mapped.js`, `src/scened.js` | `test/pointed.test.js`, `test/sequenced.test.js`, `test/mapped.test.js`, `test/scened.test.js` |
| la pantalla | `docs/MODOS.md` §10 (Scened) | `index.html`, `app.js`, `ui/comun.js`, `ui/encaje.js`, `ui/fabrica.js`, `ui/epocas.js`, `ui/ejemplos.js`, `ui/saldos.js`, `ui/escena.js` | `test/ui.test.js`, `test/escena-ui.test.js` |
| el mundo de los hilos (6 y 7, animado) | `docs/EFECTOS.md` («Los mundos») | `mundos/hilos.js`, `mundos/hilos-ui.js`, `mundos/hilos.css` | `test/hilos.test.js` |
| guardar y restaurar | `docs/MOTOR.md` §9, `docs/BTML.md` §8.1 | `src/persistencia.js` | `test/persistencia.test.js` |
| ejemplos de Ikisai (datos inventados) | `docs/BTML.md` §9 | `ejemplos/ikisai/` | `test/ejemplo-ikisai.test.js`, `test/ejemplo-booking.test.js`, `test/ejemplo-tasks.test.js` |

## Convenciones de todos los documentos

- Los ejemplos se ejecutan **desde la raíz del repositorio** con Node ≥ 20, y la salida que sigue a cada uno es la real. `node docs/comprobar.mjs` los vuelve a ejecutar todos y dice cuál no da lo impreso. Un fragmento que no se ejecuta solo (usa un `eje` que no define) lleva encima `<!-- comprobar: fragmento -->` y no se ejecuta; un comando de `sh` que no es `node --input-type=module -e` es una instrucción, no un ejemplo.
- Los ids del ejemplo de la compra son deterministas: génesis `6c1c5968`, alta `ccf5a120`, menú `4598f23e`, compra `f9e59d1e`, cuenta `c70bfa6e`. En un programa no se copian: cambian en cuanto cambia el cuerpo de un evento.
- «[X] decidir VG» es lo que nadie ha decidido; «pendiente», lo que no existe; [D], [A] y [H] son las marcas del mapa (decidido, acuerdo, hipótesis).
- El repositorio es público: datos inventados, ningún secreto.
