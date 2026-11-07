# Mundos animados: la cruz y la X

Orden decidido por VG (mapa §12, [D] «Orden de los mundos animados»): primero la cruz entera, hilos 6 y 7, luego cielo 8 y camino 9, con el 5 en el centro (tetraedro B completo); después la X. Sobrio y animado son dos renders de la misma operación (mapa §10.3 [D]; `docs/FUNDAMENTOS.md`): cada mundo tiene una función de datos que solo lee el núcleo y dos renders que leen esos datos. Nada simulado (mapa §10.2 [D]): lo que se mueve es el efecto de un evento real del eje o un cambio de lectura que se dice como tal.

| PV | Mundo | Código | Datos | Render animado | Render sobrio |
|---|---|---|---|---|---|
| 6 · 7 | hilos | `mundos/hilos.js` y `mundos/hilos-ui.js` (PR #50) | `datosHilos` (= `tiempo.ejeTemporal`) | `svgHilos`, `htmlHilos` | listas del eje temporal (`app.js`) |
| 8 | cielo | `mundos/cielo.js` | `datosCielo` (bases del 8, `src/bases.js`) | `svgCielo`, `htmlCielo` | `htmlCieloSobrio` |
| 9 | camino | `mundos/camino.js` | `datosCamino` (motor, encaje, BQL) | `svgCamino` + la lista | `htmlCamino(…, { animado: false })` |
| 5 | estructura | `mundos/cruz.js` | el registro en foco | `htmlCentro`: JSON plegable | el mismo |
| cruz | en la app | `mundos/cruz-ui.js` | lo de arriba, desde quien mira | `piezasCruz` (celdas 8 y 9, la cruz entera) | lo mismo, sin dibujos |
| 4 | fábrica | `mundos/fabrica.js` | `datosFabrica` (matriz del foco, `efectosDe` con el camino como marco, consolidaciones) | `svgFabrica` | `lineasFabrica` |
| 1 | ciudad | `mundos/ciudad.js` | `datosCiudad` (posición 1, series E) | `svgCiudad` | `lineasCiudad` |
| 2 | jardín | `mundos/jardin.js` | `datosJardin` (ocupantes de 2, encaje) | `svgJardin` | `lineasJardin` |
| 3 | parque | `mundos/parque.js` | `datosParque` (quién escribe sobre quién) | `svgParque` | `lineasParque` |
| 0 | lente | `mundos/lente.js` | `datosLente` (la posición 0) | `svgLente` (+ `marcoHTML`) | `lineasLente` |
| X | en la app | `mundos/x.js` y `mundos/x-ui.js` | `datosX` (los cinco) | `piezasX` (celdas 1–4 y 0, la X entera) | `sobrioX` |

Todo es función pura que devuelve texto (SVG o HTML), sin DOM ni librerías; las pruebas están en `test/cielo.test.js`, `test/camino.test.js`, `test/cruz.test.js`, `test/cruz-ui.test.js` y `test/mundos-x.test.js`. Los nombres de los efectos salen del catálogo (`src/efectos.js`, PR #45); lo que el corpus no nombra lleva `data-decision="[X] decidir VG…"`.

## Cielo (8)

Las bases del 8 como constelaciones: **una por medida** del 8 (`bases.MEDIDAS`: posiciones, terminales, escritos, movimientos, identidades, profundidad, fórmulas resueltas y pendientes) y **una por serie de token** (T:hora, E:casa/EUR…), cada una con **diez estrellas, una por caja**, en el orden de los valores sobre una bóveda simétrica. El **brillo** de cada estrella (área y opacidad) es proporcional a su recuento: cuántos registros de la cohorte caen en esa caja. El **foco** lleva un anillo en su caja en cada constelación; las líneas unen las estrellas encendidas. Además, **la décupla**: diez estrellas, una por posición 0–9, cuántos de la cohorte la tienen desarrollada, con un anillo en cada posición que tiene el foco. Las posiciones son puntos de vista, no un orden: van en línea recta, sin trazo, y el rótulo dice cuáles tiene el foco («en el foco: 0 1 2 3 4»), nunca «cuántas de diez».

- **La verdad es la base escrita** (VG, 7-11 noche: una sola verdad del 8). `datosCielo(eje, foco, { cohorte })` lee la base del 8 que resume la cohorte con `bases.leerBase` y `bases.situar` (hermanos: los hijos del 8 del padre; proyecto y general: el subárbol del 8 del proyecto o del génesis). Si ese 8 no tiene base escrita, usa el respaldo declarado (`bases.situar` con `respaldo`, es decir `bases.confluir`: los registros de la cohorte, medidos con `bases.medir` y fundidos con `bases.unitaria` y `bases.fundir`, con los cortes de la época), no la escribe y lo dice: **«sin base escrita»** (borde discontinuo, `data-escrita="false"`, sin `data-evento` ni `data-efecto`: sin evento detrás no se nombra efecto). Con base escrita, cada constelación lleva el nombre que el catálogo da al evento de la base visto desde el 8 (`efectosEnCielo`: hoy «constelación»; el anillo solo lleva «caja» si el evento lo es). Escrita o al vuelo, los números son los mismos cuando las bases están al día: lo comprueban las pruebas con el ejemplo `compras-hermanas.mjs` (PR #44).
- **Cohortes** (`hermanos`, `proyecto`, `general`): un selector en el orden fijo de `bases.ALCANCES`. Nunca se ordenan cohortes ni se asigna nivel: más estrellas es más registros en esa caja, no mejor. Las cajas se rotulan con su tramo de valores según los cortes guardados en cada bloque (`0`, `4–5`, `≥ 42`), no con los hitos del 8.
- **Base nueva.** `svgCielo(datos, { nuevos })`: si la base que se lee es nueva para quien mira (la memoria de los hilos), sus estrellas nacen caja a caja (`nace`, `data-nueva`). Es el evento real del 8. La app no escribe bases: las escribe la propia cosa o quien tiene P sobre el registro, con su clave (`bases.escribirBase`).
- **Transición.** Al cambiar de cohorte, `svgCielo(datos, { anterior })` recompone la constelación: cada estrella con brillo crece o mengua desde el que tenía (`--s0` en tamaño; `--o0`, la opacidad anterior en valor absoluto, sin recortar), la que se apaga se desvanece donde estaba (`se-apaga`) y el anillo del foco se desplaza de su caja anterior a la nueva (`--dx0`, `--dy0`). Es un cambio de lectura, no un evento: lleva `data-transicion="cohorte"`.
- **Estado de la base:** quién la escribió y cuándo, su frescura (`sinNovedades`, hijos nuevos, bases más recientes, novedades más abajo), las anteriores, si mide al foco y en cuántas medidas ha cambiado el foco desde entonces (`situar`: `incluido`, `cambiadas`).
- **Celda 8 de Mapped (animado):** las ocho medidas del 8, sin rótulos, con la nota «sin base escrita» si se lee el respaldo; un botón pasa a la cohorte siguiente y otro abre la cruz. En sobrio, la celda 8 la pinta `app.js` con `mapped.ocho`: la base leída o «sin base escrita (respaldo al vuelo)» y la caja del foco por medida.

## Camino (9)

Desde el foco, los pasos hacia la acción como una senda: `datosCamino(eje, foco, { camino, identidad })`.

| Paso | De dónde sale | Efecto principal (catálogo) | Botones |
|---|---|---|---|
| desarrollar *i* | posición sin ocupantes (`encaje.ocupantes`) | celda anclada en el mundo *i* | previsualizar · escribir aquí (Pointed) |
| fórmula pendiente | fórmula del foco que no resuelve (`bql.evaluar`) o lo que `proponer` no puede proponer | `sustituir` en su mundo; el camino: «paso adelante» | previsualizar |
| propuesta | `motor.proponer`, si no está ya consolidada (`propuestaConsolidada`: misma consolidación, mismo contenido) | fábrica: «consolidar»; el camino: «previsualizar» | previsualizar · consolidar |
| autorizar | consolidación PENDIENTE DE AUTORIZACIÓN (`motor.consolidaciones`/`estadoDe`) | fábrica: «autorizar» | previsualizar · autorizar (si se puede) · ejecutar deshabilitado |
| ejecutar | consolidación AUTORIZADA | fábrica y camino: «ejecutar» | previsualizar · **ejecutar (solo su autor)** |
| ejecutado | consolidación EJECUTADA (las tres últimas, junto a la acción) | el de su evento real | ir al registro |

- **«previsualizar» no escribe.** `previsualizar(eje, datos, clave, { identidad, privadaDe, t })` reconstruye una copia del eje validando evento a evento (`copiar`, como al cargar) y corre en ella la operación real del motor, con la clave de quien daría el paso (`actorDe`: ejecuta el autor; autoriza quien mira si puede, si no la primera identidad con poder). Devuelve el evento que se escribiría, sus efectos (render sobrio del catálogo) o el error con el que el motor lo rechazaría. Con la misma hora, lo previsualizado es el mismo evento (mismo id) que escribe después el motor: lo comprueban las pruebas. Por eso la vista no enseña el id: sale de la hora en que se escriba. El paso previsualizado se marca quieto (un anillo discontinuo), sin animación: no hay evento detrás. La previsualización se descarta en cuanto se escribe algo en el eje (desde cualquier modo) o cambian el foco, el camino o quien mira.
- **Propuesta ya consolidada.** Si alguna consolidación del foco y su camino tiene ya el contenido que propone `motor.proponer` (`contenidoPropuesto`, lo mismo que escribiría `motor.consolidar`), la propuesta no sale como paso: la senda sigue por esa consolidación hasta la acción y la vista lo dice. Consolidarla otra vez se hace desde la fábrica.
- **Al ejecutar**, el paso se consolida con animación (la piedra se llena y suelta una onda) y el registro aparece en los hilos (el ancla de la PR #50). Lo nuevo se anima una sola vez: los brazos de la cruz leen una misma mirada (`hilos.memoria`).
- **Celda 9 de Mapped (animado):** la senda sin rótulos; lo que no cabe va a un contador. Tocar una piedra abre su previsualización en la cruz.

## Centro (5) y la cruz

`htmlCentro(ev)` pinta la lente del foco y el registro como JSON plegable (`htmlEstructura`): cada objeto y cada lista es un `<details>`, empiezan abiertos el registro y su payload, las referencias y los ids del eje llevan a su registro, lo largo se recorta con el texto entero en el título. El catálogo lo nombra «inspeccionar».

`htmlCruz({ c8, c6, c5, c7, c9 })` coloca cada parte en su brazo como en la matriz de Mapped: el cielo arriba, los hilos del pasado y del futuro a los lados del 5, el camino abajo, con las cuatro uniones con el centro. En el móvil (hasta 640 px) los brazos se apilan: 8; 6, 5 y 7 como pasado, presente y futuro; 9.

En la app, la cruz **entra con Mapped**, como los hilos (PR #50; mapa §10.2 [A]): no es un modo. `mundos/cruz-ui.js` hace lo mismo que `mundos/hilos-ui.js`: `app.js` llama una vez a `instalarCruz()` y, en cada pintado, a `trasPintarCruz()` justo después de `trasPintarHilos()`. En animado, las celdas 8 y 9 llevan el cielo y la senda encima de su contenido sobrio, que se queda; «ver la cruz» (celdas 8 y 9, en los dos renders) la abre debajo de la matriz. El render es uno solo, el del botón «animado» que lleva `hilos-ui.js`: `trasPintarCruz` lee su `aria-pressed`, que `trasPintarHilos` acaba de poner al día.

## La X (4, 1, 2, 3 y 0)

Después de la cruz, la X (mapa §12 [D]): la fábrica 4 como confluencia de 7 y 9, la ciudad 1, el jardín 2, el parque 3 y la lente 0. `datosX(eje, foco, { camino })` lee el eje una vez para los cinco; `svgMundo(pv, datos, { compacto, nuevos })` dibuja uno; `htmlX` y `sobrioX` son la vista entera en animado y en sobrio. Cada mundo dice en la cabecera de su módulo qué se ve, qué se anima y sus [X].

- **Fábrica (4).** Diez líneas de montaje, una por posición, con los puestos de la matriz de 100 del foco; las piezas son las celdas que modifican lo escrito sobre él, leídas con `efectos.efectosDe(eje, registro, { marco: camino })` (`docs/EFECTOS.md`: la matriz relativa al camino de quien mira, con la marca del marco leído). Debajo, las estaciones del motor (consolidar, autorizar, ejecutar) con las consolidaciones como cajas.
- **Ciudad (1).** La manzana de la posición 1 (tiendas) y las vías de las series E del foco; una vía se cierra cuando su emisor se queda sin saldo.
- **Jardín (2).** Los ocupantes de la posición 2 como plantas: hierba (encaje exacto) o arbusto (acuerdo parcial); la flor se abre al consolidar la elección y el fruto cuaja al ejecutar.
- **Parque (3).** Quién habla con quién: piscinas (grupos) y bañeras (personas); una gota o un paquete viaja de quien escribe a quien recibe.
- **Lente (0).** La portada del foco y, detrás, las de otros; el HTML se pinta aparte, en un iframe sin permisos.

En la app, la X **entra con Mapped**, como los hilos y la cruz: `app.js` llama una vez a `instalarX()` y, en cada pintado, a `trasPintarX()` después de `trasPintarCruz()`, con el render de los hilos (`renderActual` de `mundos/hilos-ui.js`). En animado, las celdas 1–4 llevan su mundo encima de su contenido (la celda sigue siendo el botón del sobrio) y la del centro lleva la lente en lugar del texto de la portada, con «ver la X», que abre debajo de la matriz (y de la cruz, si está abierta) los cinco mundos con su leyenda, «reproducir la llegada» y la misma lectura en sobrio. Lo nuevo se anima una vez, con su propia memoria.

## Abiertos ([X] decidir VG)

1. Cielo: rótulos de caja por tramo de valores en lugar de los hitos del 8 (los hitos se leerían como nivel).
2. Cielo: la forma de la constelación (bóveda simétrica, igual para todas las medidas), el orden (las de la confluencia, la décupla, las series) y que la celda 8 de Mapped solo muestre las de la confluencia.
3. Cielo: sin base escrita, se calcula al vuelo la cohorte entera (lo que se leería del 8 si cada registro tuviera su base al día), no la base que escribiría ahora el registro (`bases.calcularBase`, que no cuenta lo que cuelga de un hijo sin base).
4. Cielo: recomponer al cambiar de cohorte no es un efecto del catálogo, sino lectura.
5. Camino: el catálogo nombra «previsualizar» a la consolidación vista desde el camino (V3 PV9: controles «previsualizar» y «ejecutar»); aquí el botón «previsualizar» no consolida, es una lectura que no escribe. ¿Debe consolidar?
6. Camino: qué paso resuelve una fórmula pendiente (hoy, añadir un ocupante en su celda: corregir es añadir).
7. Camino: el orden de la senda (desarrollar, fórmulas, propuesta, autorizar, ejecutar; lo ejecutado al final, junto a la acción) y cuántas ejecuciones se ven (tres).
8. Camino: la previsualización de una posición sin desarrollar no lleva contenido (lo pone quien escribe): dice dónde se anclaría y con qué efecto.
9. Cruz: cómo se entra (como los hilos: con Mapped, desde las celdas 8 y 9, y se abre bajo la matriz); Pointed y Sequenced no la dibujan todavía.
10. Camino: una propuesta ya consolidada (mismo contenido) no vuelve a salir como paso; consolidarla otra vez, desde la fábrica.
11. Cielo: cómo nace una base nueva (las estrellas, caja a caja), y que la app no escribe bases porque en sus ejemplos ningún registro tiene identidad propia con clave.
12. Ejemplos: en el ejemplo de la compra del frontend cada cohorte tiene pocos registros y ninguna base escrita; el ejemplo `compras-hermanas.mjs` (PR #44, con sus cosas y sus bases) daría un cielo escrito y más poblado si entra como tercer ejemplo del frontend.
13. X: cómo se entra (como los hilos y la cruz: con Mapped, desde sus celdas, y se abre bajo la matriz); Pointed y Sequenced no la dibujan todavía.
14. X: los abiertos de cada mundo, en la cabecera de su módulo (`mundos/fabrica.js`, `ciudad.js`, `jardin.js`, `parque.js`, `lente.js`); en la fábrica, además, leer cada registro desde el camino de quien mira (`docs/EFECTOS.md`, el marco).
