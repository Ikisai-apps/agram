# Mundos animados: la cruz

Orden decidido por VG (mapa §12, [D] «Orden de los mundos animados»): primero la cruz entera, hilos 6 y 7, luego cielo 8 y camino 9, con el 5 en el centro (tetraedro B completo); después la X. Sobrio y animado son dos renders de la misma operación (mapa §10.3 [D]; `docs/FUNDAMENTOS.md`): cada mundo tiene una función de datos que solo lee el núcleo y dos renders que leen esos datos. Nada simulado (mapa §10.2 [D]): lo que se mueve es el efecto de un evento real del eje o un cambio de lectura que se dice como tal.

| PV | Mundo | Código | Datos | Render animado | Render sobrio |
|---|---|---|---|---|---|
| 6 · 7 | hilos | `mundos/hilos.js` (PR #50) | `datosHilos` (= `tiempo.ejeTemporal`) | `svgHilos` | listas del eje temporal (`app.js`) |
| 8 | cielo | `mundos/cielo.js` | `datosCielo` (bases del 8, `src/bases.js`) | `svgCielo`, `htmlCielo` | `htmlCieloSobrio` |
| 9 | camino | `mundos/camino.js` | `datosCamino` (motor, encaje, BQL) | `svgCamino` + la lista | `htmlCamino(…, { animado: false })` |
| 5 | estructura | `mundos/cruz.js` | el registro en foco | `htmlCentro`: JSON plegable | el mismo |

Todo es función pura que devuelve texto (SVG o HTML), sin DOM ni librerías; las pruebas están en `test/cielo.test.js`, `test/camino.test.js` y `test/cruz.test.js`. Los nombres de los efectos salen del catálogo (`src/efectos.js`, PR #45); lo que el corpus no nombra lleva `data-decision="[X] decidir VG…"`.

## Cielo (8)

Las bases del 8 como constelaciones: **una por medida** de la confluencia (`tiempo.MEDIDAS`: posiciones, terminales, escritos, movimientos, identidades, profundidad, fórmulas resueltas y pendientes) y **una por serie de token** (T:hora, E:casa/EUR…), cada una con **diez estrellas, una por caja**, en el orden de los valores sobre una bóveda simétrica. El **brillo** de cada estrella (área y opacidad) es proporcional a su recuento: cuántos registros de la cohorte caen en esa caja. El **foco** lleva un anillo en su caja en cada constelación; las líneas unen las estrellas encendidas. Además, **la décupla**: diez estrellas, una por posición 0–9, cuántos de la cohorte la tienen desarrollada, con un anillo en cada posición que tiene el foco.

- **Base escrita o al vuelo.** `datosCielo(eje, foco, { cohorte })` lee la base del 8 que resume la cohorte con `bases.leerBase` y `bases.situar` (hermanos: los hijos del 8 del padre; proyecto y general: el subárbol del 8 del proyecto o del génesis). Si ese 8 no tiene base, la calcula al vuelo (`baseAlVuelo`: los registros de `tiempo.comparables`, medidos con `bases.medir` y fundidos con `bases.unitaria` y `bases.fundir`, con los mismos cortes), no la escribe y la marca **«sin escribir»** (borde discontinuo, `data-escrita="false"`, sin `data-evento`). Escrita o al vuelo, los números son los mismos cuando las bases están al día: lo comprueban las pruebas con el ejemplo `compras-hermanas.mjs` (PR #44).
- **Cohortes** (`hermanos`, `proyecto`, `general`): un selector en el orden fijo de `tiempo.ALCANCES`. Nunca se ordenan cohortes ni se asigna nivel: más estrellas es más registros en esa caja, no mejor. Las cajas se rotulan con su tramo de valores según los cortes guardados en cada bloque (`0`, `4–5`, `≥ 42`), no con los hitos del 8.
- **Transición.** Al cambiar de cohorte, `svgCielo(datos, { anterior })` recompone la constelación: cada estrella crece o mengua desde su brillo en la cohorte anterior (`--s0`, `--o0`) y el anillo del foco se desplaza de su caja anterior a la nueva (`--dx0`, `--dy0`). Es un cambio de lectura, no un evento: lleva `data-transicion="cohorte"`.
- **Estado de la base:** quién la escribió y cuándo, su frescura (`sinNovedades`, hijos nuevos, bases más recientes, novedades más abajo), las anteriores, si mide al foco y en cuántas medidas ha cambiado el foco desde entonces (`situar`: `incluido`, `cambiadas`).
- **Celda 8 de Mapped:** las ocho medidas de la confluencia, sin rótulos; el botón pasa a la cohorte siguiente.

## Camino (9)

Desde el foco, los pasos hacia la acción como una senda: `datosCamino(eje, foco, { camino, identidad })`.

| Paso | De dónde sale | Efecto principal (catálogo) | Botones |
|---|---|---|---|
| desarrollar *i* | posición sin ocupantes (`encaje.ocupantes`) | celda anclada en el mundo *i* | previsualizar · escribir aquí (Pointed) |
| fórmula pendiente | fórmula del foco que no resuelve (`bql.evaluar`) o lo que `proponer` no puede proponer | `sustituir` en su mundo; el camino: «paso adelante» | previsualizar |
| propuesta | `motor.proponer` | fábrica: «consolidar»; el camino: «previsualizar» | previsualizar · consolidar |
| autorizar | consolidación PENDIENTE DE AUTORIZACIÓN (`motor.consolidaciones`/`estadoDe`) | fábrica: «autorizar» | previsualizar · autorizar (si se puede) · ejecutar deshabilitado |
| ejecutar | consolidación AUTORIZADA | fábrica y camino: «ejecutar» | previsualizar · **ejecutar (solo su autor)** |
| ejecutado | consolidación EJECUTADA (las tres últimas, junto a la acción) | el de su evento real | ir al registro |

- **«previsualizar» no escribe.** `previsualizar(eje, datos, clave, { identidad, privadaDe, t })` reconstruye una copia del eje validando evento a evento (`copiar`, como al cargar) y corre en ella la operación real del motor, con la clave de quien daría el paso (`actorDe`: ejecuta el autor; autoriza quien mira si puede, si no la primera identidad con poder). Devuelve el evento que se escribiría, sus efectos (render sobrio del catálogo) o el error con el que el motor lo rechazaría. Con la misma hora, lo previsualizado es el mismo evento (mismo id) que escribe después el motor: lo comprueban las pruebas.
- **Al ejecutar**, el paso se consolida con animación (la piedra se llena y suelta una onda) y el registro aparece en los hilos (el ancla de la PR #50). Lo nuevo se anima una sola vez: los tres brazos leen la misma memoria de los hilos (`hilos.memoria`).
- **Celda 9 de Mapped:** la senda sin rótulos; lo que no cabe va a un contador. Tocar una piedra abre su previsualización en la vista cruz.

## Centro (5) y vista «cruz»

`htmlCentro(ev)` pinta la lente del foco y el registro como JSON plegable (`htmlEstructura`): cada objeto y cada lista es un `<details>`, empiezan abiertos el registro y su payload, las referencias y los ids del eje llevan a su registro, lo largo se recorta con el texto entero en el título. El catálogo lo nombra «inspeccionar».

`htmlCruz({ c8, c6, c5, c7, c9 })` coloca cada parte en su brazo como en la matriz de Mapped: el cielo arriba, los hilos del pasado y del futuro a los lados del 5, el camino abajo, con las cuatro uniones con el centro. En `app.js`, el botón «cruz» la abre y el conmutador «animado» alterna los dos renders; con el animado, las celdas 8 y 9 de Mapped muestran también el cielo y la senda.

## Abiertos ([X] decidir VG)

1. Cielo: rótulos de caja por tramo de valores en lugar de los hitos del 8 (los hitos se leerían como nivel).
2. Cielo: la forma de la constelación (bóveda simétrica, igual para todas las medidas), el orden (las de la confluencia, la décupla, las series) y que la celda 8 de Mapped solo muestre las de la confluencia.
3. Cielo: sin base escrita, se calcula al vuelo la cohorte entera (lo que se leería del 8 si cada registro tuviera su base al día), no la base que escribiría ahora el registro (`bases.calcularBase`, que no cuenta lo que cuelga de un hijo sin base).
4. Cielo: recomponer al cambiar de cohorte no es un efecto del catálogo, sino lectura.
5. Camino: el catálogo nombra «previsualizar» a la consolidación vista desde el camino (V3 PV9: controles «previsualizar» y «ejecutar»); aquí el botón «previsualizar» no consolida, es una lectura que no escribe. ¿Debe consolidar?
6. Camino: qué paso resuelve una fórmula pendiente (hoy, añadir un ocupante en su celda: corregir es añadir).
7. Camino: el orden de la senda (desarrollar, fórmulas, propuesta, autorizar, ejecutar; lo ejecutado al final, junto a la acción) y cuántas ejecuciones se ven (tres).
8. Camino: la previsualización de una posición sin desarrollar no lleva contenido (lo pone quien escribe): dice dónde se anclaría y con qué efecto.
9. Ejemplos: en el ejemplo de la compra del frontend cada cohorte tiene pocos registros y ninguna base escrita; el ejemplo `compras-hermanas.mjs` (PR #44, con sus cosas y sus bases) daría un cielo escrito y más poblado si entra como tercer ejemplo del frontend.
