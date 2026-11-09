# El contrato entre el núcleo y la pantalla: la mitad de datos

Encargo 3c-1 (VG, 9-11). Principio: la pantalla, **la carta**, pinta un registro X con un tamaño, en un punto de vista k, **sin lógica propia**. Todo lo que decide algo (qué se enseña, cómo se llama, en qué orden, qué nivel tiene, qué cabe) viene del núcleo como **posición**, **vista** o **regla**. Nada hardcodeado en la pantalla; nada de negocio en JavaScript que pueda ser una regla o un dato de la época. Este documento describe las **entradas de datos** del contrato, `src/contrato.js` (exportado desde `src/index.js` como el espacio de nombres `contrato`); las entradas de acción (las plantillas de transacción del aro, `transaccion()`, el camino, el libro local, los modelos de visualización) son del encargo 3c-2. Pruebas: `test/contrato.test.js`, con una carta de texto (`test/carta-texto.mjs`) que pinta cada ejemplo de `ejemplos/` en los tres tamaños importando solo el contrato, y sus salidas esperadas (`test/carta-esperada.json`). Lo que aquí decide Core y VG no ha visto va marcado **«Core, pendiente de revisar VG»**; lo que de verdad queda abierto, en «Para decidir VG».

```js
import { contrato } from './src/index.js';
const { plantilla, etiqueta, ayuda, marcador, tipo, validar, representaciones, ocupantes, division, madurez, diario, yo, configuracion, mensaje } = contrato;
```

Toda entrada toma el eje y, como última opción, `{ epoca }` (lo que devuelve `cargarEpocaBtml`; por defecto `EPOCA_0_BTML`): cambiar la época cambia lo que devuelve, porque **todo se lee de ella**. El módulo solo sabe dónde mira la época cada cosa:

| Qué | Dónde está en la época |
|---|---|
| las etiquetas genéricas | `epoch.5.p.d` (las cien reglas cortas: nombre, significado, ejemplo) |
| el espacio de bloque (datos que caben → puntos de vista, la disposición, el paso) | `epoch.8.3` |
| los niveles de madurez | `epoch.8.4` (y la lectura «maturity», en el 2) |
| los órdenes de los ocupantes | `epoch.8.5` |
| los modos y su máximo | `epoch.8.2` |
| las plantillas de dominio | `epoch.9.2` (0 la cabecera, con el tipo genérico de cada dígito en 9.2.0.1; 9.2.1 «purchase», 9.2.2 «booking») |
| la plantilla «preferences» | `epoch.9.3` |
| los mensajes por idioma | `epoch.9.4` (0 la cabecera; 9.4.1 «es») |
| las representaciones: formatos y tamaños | `epoch.9.5` |

## 1. Plantillas: `plantilla(eje, X)` y lo que se lee de ellas

Una **plantilla** es un registro (de la época o del eje) con **la misma décupla que los datos que describe**: en cada posición d, una décupla que dice de la posición d de los datos

| d.k | Qué | Ejemplo («purchase», d = 1) |
|---|---|---|
| d.0 | la etiqueta legible (en el 0, también el nombre del tipo) | `order` |
| d.1 | el tipo de dato y la unidad o, en el 0, los formatos que admite | `tenfold`; en el 0, `text icon image` |
| d.2 | la validación: una fórmula `=…` del BQL mínimo con `it` = el registro; otro texto («any») es que no hay | `=first ((it.1 where not (mint in it2.4 or …)) each 1) > 0` |
| d.3 | quién la escribe | `owner` |
| d.4 | qué se hace con ella (`write`, `read`); **en el 4, lleva `template`**: así se reconoce una plantilla | `template write` |
| d.5 | su dirección | `1` |
| d.6 | de dónde viene | `ejemplos/ikisai/compra-food.mjs: 1.0 qué, 1.1 cuánto, 1.2 a qué precio` |
| d.7 | si es `required` u `optional` | `required` |
| d.8 | el orden de sus ocupantes (§3); **en el 8, los niveles del tipo** (§5) | `arrival` |
| d.9 | el marcador (placeholder) y, la última hoja, la ayuda; **en el 9, el modelo de división del tipo** (§4) | `[[menu], [1], ["EUR 12"]]`, `what is bought, how many and at what price…` |

Una plantilla **se reconoce porque su 4 lleva `template`**, como las reglas llevan `read`, `put` o las primitivas: en su 4 mismo si es una lista, o en su 4.4 (qué se hace con lo que se hace) si su 4 describe el 4 de los datos (`esPlantilla`). La **diagonal** d.d es lo propio del tipo para la mirada d: 0.0 su nombre, 4.4 `template`, 8.8 sus niveles, 9.9 su modelo de división. Las demás d.d no son especiales (1.1 es el tipo del 1). **Core, pendiente de revisar VG.**

Un registro **referencia su plantilla desde su 5** (dónde encaja: su tipo), por **nombre** (como la compra nombra la plantilla de cerrado en su 2: la compra lleva `['purchase']` y la reserva `['booking']`, `ejemplos/ikisai/`) o por **referencia** `{ ref }` (a una posición de la época, `{ ref: <id de la época>, dir: '9210000000' }`, o a un registro del eje que sea una plantilla). Lo que no resuelve a una plantilla no lo es: **en un alta el 5 lleva su clave y su id** (B4), y ni una clave, ni un id de un registro corriente, ni un nombre desconocido son una plantilla (`plantilla` devuelve `null`). Las plantillas que hay (`plantillas(eje)`): las de dominio de la época, la de preferencias y las escritas en el eje. Se eligió el nombre y no la referencia para los ejemplos porque el id de la época cambia con cada edición de la época y arrastraría el de todos los registros.

**Las cien reglas cortas de la época 0 (`epoch.5`) son la plantilla genérica**: etiqueta por dígito y profundidad. Es el respaldo **en cadena**: la plantilla de X → si calla en esa posición, la genérica. Una plantilla solo describe las posiciones de la profundidad 0 (su d.k es metadato de d, no la descripción de d.k); en profundidad, siempre la regla corta de esa profundidad.

```js
plantilla(eje, X)             // → la décupla de la plantilla de X, o null; X es un id, un evento o una candidata
plantillas(eje)               // → [{ nombre, registro, donde }]: las de la época (su dirección) y las del eje (su id)
esPlantilla(r)                // → si su 4 lleva template
nombreDePlantilla(p)          // → su 0.0
etiqueta(eje, X, d)           // → la etiqueta: d.0 de la plantilla o el nombre de la regla corta; d es un dígito, «1.2», [1, 2] o una dirección
ayuda(eje, X, d)              // → la última hoja del d.9 de la plantilla, o el significado de la regla corta
marcador(eje, X, d)           // → las hojas del d.9 menos la ayuda (lo que se espera), o el ejemplo de la regla corta
tipo(eje, X, d)               // → las hojas del d.1 de la plantilla, o el tipo genérico del dígito (epoch.9.2.0.1)
validar(eje, X)               // → [{ posicion, motivo }]: cada d.2 «=…» evaluada con it = X; vacía si todo pasa (o no hay plantilla)
```

`validar` evalúa cada fórmula con `it` = el registro (su id en el eje, o la candidata `ev` si aún no está); el motivo que da es la etiqueta y la ayuda de la posición, en inglés (o el estado, si la fórmula no se resuelve). Cuidado con el 1 y el 3: `X.1` trae también los movimientos (D-META) y `X.3` el autor y el firmante, así que una validación del payload los aparta como hacen las reglas (`it.1 where not (mint in it2.4 or transfer in it2.4 or …)` deja la décupla del payload).

Las dos plantillas de dominio de ejemplo, en `epoch.9.2`: **«purchase»** (la compra del menú: 0 purchase, 1 order, 2 criteria, 3 who, 4 actions; valida que la cantidad del 1.1 sea positiva y que el 2 nombre la plantilla de cerrado) y **«booking»** (la reserva: 0 booking, 1 stay, 2 criteria, 3 who, 4 prepares, 5 type, 6 origin, 7 dates, 8 maturity con cinco niveles en su 8.8: requested, announced, confirmed, settled, closed; valida que las noches sean al menos una y el cerrado). Sus tipos, en inglés y en minúsculas, son las claves con que la carta trabaja.

## 2. Representaciones: `representaciones(eje, X)`

Los ocupantes de `X.0` son representaciones, y la carta elige la que cabe. Forma (**Core, pendiente de revisar VG**): una **hoja** (un texto, un número) es una representación de texto **sin tamaño mínimo** (0; su formato es el primero de la lista de la época, `text`); una **décupla** es una representación **rica**: su 0 el texto alternativo, su 1 `[tamaño mínimo, formato]`, su 5 dónde está el recurso (una URL relativa del repositorio, o una referencia `{ ref }`). Los tamaños son los de `epoch.9.5.2`: **1** el hueco mínimo (`slot`), **2** la tarjeta (`card`), **3** la pantalla completa (`screen`), cada uno con los **datos que caben** en él (1, 4, 10; Core: es lo que la carta de texto usa para pedir la división). Los formatos son los de `epoch.9.5.1`: `text`, `icon`, `image`, `video`, `lottie`, `svg`, `html`, `ref`. La plantilla puede declarar en su **0.1** qué formatos admite el 0 de ese tipo («purchase» y «booking»: text, icon, image); lo que no admite, y lo que no tiene un tamaño de la época, se omite.

De dónde salen: lo propio del 0 de X (una hoja, una lista de hojas o una décupla) y los registros anclados en la **raíz** de X cuyo payload es una décupla con esa forma (lo escrito en la raíz colisiona con el 0). Un registro cuyo payload es un terminal es su propia representación de texto.

```js
representaciones(eje, X)   // → [{ texto, tamano, formato, recurso }], por tamaño mínimo
tamanos()                  // → [{ tamano, nombre, datos }]
```

## 3. Ocupantes ordenados y paginados: `ocupantes(eje, X, d, desde, cuantos)`

La carta **nunca ordena ni filtra**. El orden lo da la época: `epoch.8.5` lista los órdenes que existen, cada uno `[[nombre], [mecanismo, …], [qué]]`: **`arrival`** (por llegada; el primero, el defecto), `newest` (por llegada, el último primero) y `fit` (por encaje: `encaje.ordenarPorEncaje`). El mecanismo es la palabra que el código de los ocupantes ya conoce (`llegada`, `encaje`; `reverse` lo invierte): qué orden rige es un dato, cómo se ordena es código. Rige, por este orden: el **d.8 de la plantilla** de X si nombra un orden existente; si no, lo que el **dueño nombra en el 2.3** de X (un ocupante del 2.3 de su payload, o anclado ahí por él, que se llame como un orden; B2: el 2.3 ya es «con quién cuenta»); si no, el primero de la época. Se eligió `epoch.8.5` y no una lectura porque ordenar no es una fórmula del BQL mínimo (no hay orden en el léxico) y los órdenes ya existían en el código de los ocupantes (**Core, pendiente de revisar VG**).

Devuelve los ocupantes **tal cual**: las hojas, las décuplas y las referencias por su id (`{ ref, dir }`, sin lo que alcanzan: la carta lo pide aparte con la misma entrada), y cada registro anclado exactamente en esa posición como la referencia a su id. Es la lista de la posición por hojas (`encaje.ocupantes` con `exacto`): la décupla del 1 de la compra es **un** ocupante y, detrás, la cuenta anclada en su 1. Paginado: `desde` un índice y `cuantos` (por defecto el **paso** de la época, `epoch.8.3.3`: diez).

```js
ocupantes(eje, X, d, desde = 0, cuantos = paso())   // → { total, desde, cuantos, orden, ocupantes }
ordenes()                                           // → [{ nombre, mecanismo, que }]
paso()                                              // → 10
```

## 4. El modelo de división: `division(eje, ruta, { datos, forma, modo })`

La tabla de VG del **espacio de bloque** va como datos en `epoch.8.3.1`, una fila por número de datos que caben, `[[datos], [puntos de vista], [condición o nota], [alternativa]]`:

| Datos | Puntos de vista | |
|---|---|---|
| 1 | `[0]`, o `[5]` si X no tiene representación (`=count it.0 > 0`: un registro terminal) | la elección entre 0 y 5, Core, pendiente de revisar VG |
| 2 | `[0, 5]` | |
| 3 | `[1, 2, 3]` | |
| 4 | `[1, 2, 3, 4]` | |
| 5 | `[0, 1, 2, 3, 4]` | |
| 6 | `[0, 1, 2, 3, 4, 5]` | |
| 7 | `[0, 1, 2, 3, 4, 5, 8]` | **[X] decidir VG**: propuesta de Core (en la fila) |
| 8 | `[1, 2, 3, 4, 6, 7, 8, 9]` | **[X] decidir VG**: propuesta de Core (en la fila) |
| 9 | `[1, 2, 3, 4, 0, 6, 7, 8, 9]` | la matriz 3×3: los ocho laterales y el 0 en el centro |
| 10 | `[1, 2, 3, 4, 0, 5, 6, 7, 8, 9]` | la matriz completa (los dos centros, 0 y 5) o la lista de diez |
| más de 10 | diez, y «cargar más» de diez en diez (`epoch.8.3.3`) | |

**Lista frente a matriz** (`epoch.8.3.2`): lista si el hueco es más alto que ancho, matriz si es cuadrado. La carta solo pasa la **forma del hueco** (`{ ancho, alto }`, o el cociente alto/ancho, o el nombre de una disposición); el núcleo decide con el umbral de la época (alto/ancho por encima de 1,25 es lista; Core, pendiente de revisar VG). Los **modos** (`epoch.8.2`: Pointed 1-10, Sequenced 10-100, Mapped 100-1000, Scened 1000-10000, Be todos) acotan los datos a su máximo si se pasa `modo`. Si la plantilla del registro en foco trae su **propio modelo en su 9.9** (una tabla con la misma forma), ese manda sobre el de la época.

```js
division(eje, ruta, { datos, forma, modo })   // → { pvs, disposicion: 'list' | 'matrix', paso, datos, maximo, cargarMas }
modos()                                       // → [{ nombre, minimo, maximo }]
```

`ruta` es el registro en foco (su id, el evento o `{ id }`). Los nombres de las disposiciones son los de la época (`list`, `matrix`): cambiarlos en la época cambia lo que devuelve.

## 5. Madurez: la medida del 8 como lectura

La madurez de X es una **lectura** nueva en la época, **«maturity»** (`datos/epocas/reglas/maturity.json`): un registro de regla como las demás, en el 2 de la época y en la cadena del 8 (después de «weight»), con `read` en su 4. **Se materializa en `X.8.1`**: frente a otros (8), cuánto (1): el nivel es la cantidad con que X se compara con los demás, y el 8.1 es el sitio donde el despliegue de la cruceta pone «cuánto» de la comparabilidad; la medida de la que sale queda en **`X.8.6`** (de dónde viene), una vista del contexto: 8.6.1 (cuánto) las posiciones escritas de X y de todo lo que cuelga de él, 8.6.5 (dónde encaja) la profundidad del subárbol en registros, 8.6.4 (qué se hace) las unidades que mueven sus transacciones. Las bases del 8 siguen siendo registros anclados en el 8; esto es lo implícito.

**Por qué una vista para la medida.** Una fórmula entera en BQL mínimo recorrería el subárbol posición a posición (`down` y sus payloads) y en un subárbol grande reventaría el presupuesto de diez mil ocupantes (SEG-10); así que la medida bruta la da `src/contexto-eje.js` (el nodo del 8, al final del bloque de vistas) y **la regla solo convierte la medida en nivel**, con los datos de `epoch.8.4`:

- `8.4.1` los umbrales por posición (1 … 10) y `8.4.2` sus nombres: **seed, sprout, shoot, stem, branch, leaf, bud, flower, fruit, tenfold** (1 posición = semilla; 10 = la décupla entera; los nombres, Core, pendiente de revisar VG);
- `8.4.3` los techos de los órdenes de magnitud que suben de nivel (10, 100, 1000, 10000, 100000; los de `epoch.8.1` a partir del segundo, planos para que el `where` los recorra) y `8.4.4` sus nombres: **list, shop, block, district, kingdom** (la lista, la tienda, la manzana, el distrito, el reino);
- la medida = posiciones + profundidad + **cuántos techos pasa la cantidad** (no la cantidad: doce euros no hacen una tienda; Core, pendiente de revisar VG). El nivel = cuántos umbrales de posición alcanza la medida + cuántos techos pasa: hasta diez, uno por posición; después, uno por orden de magnitud.

```text
=count (epoch.8.4.1 where it2 <= M) + count (epoch.8.4.3 where it2 < M)
  con M = first it.8.6.1 + first it.8.6.5 + count (epoch.8.4.3 where it3 < first it.8.6.4)
```

La regla no lleva ningún número (A3: los datos del mundo son de la época). **Los niveles de un tipo son datos de su plantilla**, en su 8.8 (la décupla del 8 de la plantilla, «frente a otros» de «frente a otros»), con los quince genéricos como defecto; puede haber menos: los de la plantilla se reparten proporcionalmente sobre los genéricos («booking», cinco: la reserva confirmada del ejemplo está en el cuarto, `settled`).

```js
madurez(eje, X)   // → { nivel, de, nombre, medida: { posiciones, profundidad, cantidad } }
niveles()         // → los quince genéricos
```

La compra del ejemplo (con la cuenta colgando) es `list` (11 de 15: 15 posiciones, 1 de profundidad, 16 unidades); la cuenta sola, `stem` (4); un registro de una posición recién escrito, `seed`.

## 6. El diario: `diario(eje, X, desde, cuantos)`

Las transacciones del subárbol de X (X y lo anclado bajo él, a cualquier profundidad) **por llegada**, cada una con sus **asientos del libro** (lo que de verdad se movió: los movimientos, la asignación del día y la obtención de P, con su primitiva, serie, de, a, cantidad y, si los tiene, salida, clase y etiqueta) y su ancla. Paginado desde un índice o desde un id; `cuantos` por defecto, el paso. Sobrio y animado leen las mismas vistas; el animado además este diario, listo para reproducirlo en orden.

```js
diario(eje, X, desde = 0, cuantos = paso())   // → { total, desde, entradas: [{ id, t, autor, movimientos, ancla: { sobre, en } }] }
```

## 7. Mi foco y mi configuración: `yo(eje, identidad)` y `configuracion(eje, yo)`

`yo` es mi alta y sus posiciones, las vistas del encargo 3a leídas con el BQL mínimo: `A.1` la cartera, `A.2` el criterio (2.1 el P posicionado, 2.3 los criterios que adopto), `A.3` los grupos de atención (nombre, zona, precio, quiénes), `A.7` el tiempo gastado hoy por escala (a la fecha `t`; por defecto el reloj del libro).

La **configuración** vive como un registro anclado en **`yo.9`** (el 9 del alta, «cómo: su guía») escrito por mí, cuyo tipo es la plantilla **«preferences»** de la época (`epoch.9.3`): 1 `step` (cuántos por carga; 10), 2 `render` (`sober` o `animated`), 3 `language` (`en`), 4 `sizes` (los pasos de tamaño, 1 2 3), 5 `preferences`. Las etiquetas de la plantilla son las claves de lo que devuelve; sus defectos, las hojas del d.9 menos la ayuda. Sin registro, los defectos; con varios míos, el último; lo que otro ancle ahí no cuenta. Como el 5 exige el 0-4, un registro de preferencias dice todo (y `validar` lo valida con la plantilla).

```js
yo(eje, identidad, { t })   // → { identidad, alta, cartera, criterio: { posicionado, adopta }, atencion, tiempo } o null
configuracion(eje, yo)      // → { step, render, language, sizes, de }  (de: el id del registro, o null si son los defectos)
```

## 8. Mensajes y traducción: `mensaje(eje, regla, idioma, { ev })`

Los mensajes de las reglas (su 9) son en inglés, canónicos, y empiezan por el nombre de la regla («<nombre>: <texto>»). La traducción va por plantilla: `epoch.9.4` lleva un registro **«messages» por idioma** (9.4.1: `es`, `[["es", "español"], [«regla: texto», …]]`) cuyos ocupantes son una hoja por regla, **«<nombre de la regla>: <texto traducido>»**, con los mismos huecos `{…}` que el original. Se eligieron hojas y no pares `[[nombre], [texto]]` porque los pares son décuplas y una décupla no pasa de diez ocupantes, mientras que una lista de hojas no tiene tope (la misma razón por la que el 2 de la época es una lista de referencias; **Core, pendiente de revisar VG**); `mensaje` admite también la forma en pares para un registro de hasta diez. `mensaje` devuelve el texto en el idioma pedido con los huecos resueltos como el 9 de toda regla (`bqlm.rellenar`, sobre el eje y la candidata `ev`), y cae al inglés si falta el idioma o la regla. Las cuarenta reglas de hoy están traducidas al español; la prueba comprueba que cada traducción conserva los huecos del original.

```js
mensaje(eje, regla, idioma = 'en', { ev })   // → el texto; regla es la décupla o su nombre; null si no existe
idiomas()                                    // → ['en', 'es']
```

## 9. Qué cambia en el eje y en los ejemplos

- `src/contexto-eje.js`: el 8 de un registro (y de la candidata) tiene su nodo implícito: 8.6 la medida (la vista) y las lecturas de la época en `X.8.d` (`X.8.1`, «maturity»). Añadido al final del bloque de vistas. Para una identidad, `A.8.1` sigue siendo «obligation».
- `datos/epocas/epoca-0.btml.json`: 8.3, 8.4, 8.5, 9.2, 9.3, 9.4, 9.5 y una línea de procedencia en el 6; `datos/epocas/reglas/maturity.json`. Son 40 reglas: 30 condiciones, 3 que escriben, 7 lecturas.
- `ejemplos/ikisai/compra-food.mjs` y `reserva-booking.mjs`: la compra y la reserva nombran su plantilla en su 5. Cambian los ids de los ejemplos (el génesis referencia la época) y las salidas de los documentos se regeneraron.

## 10. Para decidir VG

- **La forma de las plantillas**: la diagonal (0.0 nombre, 4.4 `template`, 8.8 niveles, 9.9 modelo de división) y que una plantilla solo describa la profundidad 0 (las subposiciones, como el 1.2 de la compra, llevan la regla corta de su profundidad). ¿Plantillas anidadas (el 1 de una compra con su propia plantilla «resource»)?
- **El 5 como tipo**: la referencia a la plantilla por nombre o por `{ ref }`; en BQL mínimo `X.5` sigue siendo solo el id y las claves (B4), así que el tipo se lee del payload, no del contexto.
- **Las representaciones**: la hoja como texto sin tamaño mínimo, la décupla rica (0, 1, 5), los tres tamaños y los datos que caben en cada uno (1, 4, 10), los ocho formatos y que el 0.1 de la plantilla los acote.
- **El espacio de bloque**: con un dato, 0 si hay representación y si no 5; las filas de 7 y 8; el umbral de lista frente a matriz (1,25).
- **Los órdenes**: `epoch.8.5` (una entrada de la época, no una lectura); el d.8 de la plantilla manda sobre el 2.3 del dueño y este sobre el defecto; solo `arrival`, `newest` y `fit`.
- **La madurez**: `X.8.1` para el nivel y `X.8.6` para la medida; la suma posiciones + profundidad + órdenes de la cantidad; los diez nombres de los niveles por posición; los cinco niveles de «booking» y el reparto proporcional de los niveles de un tipo sobre los genéricos.
- **Las preferencias**: en el 9 del alta; sus cuatro campos y sus defectos (`sober`, 10, `en`, 1 2 3).
- **Los mensajes**: una hoja «regla: texto» por regla en el registro del idioma; `en` como canónico.
