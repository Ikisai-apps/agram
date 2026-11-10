# El contrato entre el núcleo y la pantalla: la mitad de datos y la mitad de acción

Encargo 3c-1 (VG, 9-11). Principio: la pantalla, **la carta**, pinta un registro X con un tamaño, en un punto de vista k, **sin lógica propia**. Todo lo que decide algo (qué se enseña, cómo se llama, en qué orden, qué nivel tiene, qué cabe) viene del núcleo como **posición**, **vista** o **regla**. Nada hardcodeado en la pantalla; nada de negocio en JavaScript que pueda ser una regla o un dato de la época. Este documento describe las **entradas de datos** del contrato, `src/contrato.js` (exportado desde `src/index.js` como el espacio de nombres `contrato`), y, del encargo 3c-2b (tras 3c-1), **el libro local** (`src/local.js`, §10), **los pasos** (`src/pasos.js`, §11.4) y **los modelos de visualización** (`src/modelos.js`, §11); las plantillas de transacción del aro, `transaccion()` y el camino son del encargo 3c-2a. Pruebas: `test/contrato.test.js`, `test/local.test.js`, `test/pasos.test.js`, `test/modelos.test.js`, con una carta de texto (`test/carta-texto.mjs`) que pinta cada ejemplo de `ejemplos/` en los tres tamaños importando solo el contrato, y sus salidas esperadas (`test/carta-esperada.json`). Lo que aquí decide Core y VG no ha visto va marcado **«Core, pendiente de revisar VG»**; lo que de verdad queda abierto, en «Para decidir VG».

```js
import { contrato } from './src/index.js';
const { plantilla, etiqueta, ayuda, marcador, tipo, validar, representaciones, ocupantes, division, madurez, diario, yo, configuracion, mensaje, texto, legible, desdeLegible } = contrato;
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
| la plantilla «preferences» | `epoch.9.3` (9.3.6 la preferencia `model`, encargo 3c-2b) |
| los mensajes por idioma y los textos por clave (§8) | `epoch.9.4` (0 la cabecera; 9.4.1 «es»: las reglas, las plantillas, los niveles, los órdenes, los tamaños y los formatos de `legible`; 9.4.2 «en»: solo los formatos canónicos de `legible`) |
| las representaciones: formatos y tamaños | `epoch.9.5` |
| los modelos de visualización (§11) | `epoch.9.7` (0 la cabecera; 1… las referencias a los modelos, `datos/epocas/modelos/`) |
| la tabla de pasos (§11.4) | `epoch.9.8` |
| la asignación diaria de T que gasta el libro local (§10) | `epoch.1.3.1` (la escala 0, el segundo) |
| las plantillas de transacción, las acciones del aro (§12) | `epoch.9.6` (0 la cabecera; 9.6.1 las referencias, `datos/epocas/plantillas/`) |
| los precios de los seis grupos de R (§12.1) | `epoch.1.2.1` (cada grupo, su `[[en qué], [cuánto]]` en el 2) y las lecturas «attention group» y «attention price» |
| los precios de las cuatro orientaciones de E (§12.3) | `epoch.1.0.1` (cada orientación, su `[[en qué], [cuánto]]` en el 2); el de cada serie, en su emisión (`precio`, `precios`) |
| las estaciones de la fábrica (§12.4) | `epoch.4.2` (`[[familia], [qué se hace], [la plantilla que mueve lo anunciado]]`) y la lectura «stage» |
| el tutorial del alta (§12.6) | `epoch.3.0.9` (el 9 de la plantilla de identidad) |

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

La **configuración** vive como un registro anclado en **`yo.9`** (el 9 del alta, «cómo: su guía») escrito por mí, cuyo tipo es la plantilla **«preferences»** de la época (`epoch.9.3`): 1 `step` (cuántos por carga; 10), 2 `render` (`sober` o `animated`), 3 `language` (`en`), 4 `sizes` (los pasos de tamaño, 1 2 3), 5 `preferences` (su tipo: B4, el 5 nombra la plantilla, y no es una preferencia: `configuracion` no lo lee) y, del encargo 3c-2b, 6 `model` (el modelo de visualización que la carta consulta primero, §11.2; por defecto `sobrio`). Las etiquetas de la plantilla son las claves de lo que devuelve; sus defectos, las hojas del d.9 menos la ayuda. Sin registro, los defectos; con varios míos, el último; lo que otro ancle ahí no cuenta. Como el 5 exige el 0-4, un registro de preferencias dice todo (y `validar` lo valida con la plantilla); el 6 es opcional.

```js
yo(eje, identidad, { t })   // → { identidad, alta, cartera, criterio: { posicionado, adopta }, atencion, tiempo } o null
configuracion(eje, yo)      // → { step, render, language, sizes, model, de }  (de: el id del registro, o null si son los defectos)
```

## 8. Mensajes y traducción: `mensaje(eje, regla, idioma, { ev })`

Los mensajes de las reglas (su 9) son en inglés, canónicos, y empiezan por el nombre de la regla («<nombre>: <texto>»). La traducción va por plantilla: `epoch.9.4` lleva un registro **«messages» por idioma** (9.4.1: `es`, `[["es", "español"], [«regla: texto», …]]`) cuyos ocupantes son una hoja por regla, **«<nombre de la regla>: <texto traducido>»**, con los mismos huecos `{…}` que el original. Se eligieron hojas y no pares `[[nombre], [texto]]` porque los pares son décuplas y una décupla no pasa de diez ocupantes, mientras que una lista de hojas no tiene tope (la misma razón por la que el 2 de la época es una lista de referencias; **Core, pendiente de revisar VG**); `mensaje` admite también la forma en pares para un registro de hasta diez. `mensaje` devuelve el texto en el idioma pedido con los huecos resueltos como el 9 de toda regla (`bqlm.rellenar`, sobre el eje y la candidata `ev`), y cae al inglés si falta el idioma o la regla. Las cuarenta reglas de hoy están traducidas al español; la prueba comprueba que cada traducción conserva los huecos del original.

```js
mensaje(eje, regla, idioma = 'en', { ev })   // → el texto; regla es la décupla o su nombre; null si no existe
idiomas()                                    // → ['en', 'es']
```

### 8.1 Los textos de la época por clave: `texto(eje, clave, idioma, { original })`

La carta se lee en español (etapa 1 del roadmap, parte mecánica) **por datos**: el mismo registro «messages» del idioma lleva, además de las reglas, una hoja «`<clave>: <texto>`» por cada texto de la época que la carta enseña. La convención de claves, sistemática:

| Clave | Qué traduce | Ejemplo en `es` |
|---|---|---|
| `template <nombre>` | el nombre de una plantilla de transacción (las 33 del aro) o de datos («purchase», «booking», «preferences») | `template apply a resource: aplicar un recurso` |
| `template <nombre> param <etiqueta> label` | la etiqueta de un parámetro de una plantilla de transacción, o de una posición de una plantilla de datos (su d.0) | `template apply a resource param quantity label: cantidad` |
| `template <nombre> param <etiqueta> help` | su ayuda (la última hoja del 9) | `… param quantity help: cuántas unidades` |
| `template <nombre> param <etiqueta> placeholder` | el marcador de una posición de una plantilla de datos, en una sola hoja (opcional: sin él, las hojas del d.9) | `template purchase param order placeholder: menú · 1 · EUR 12` |
| `template <nombre> message` | el 9 de una plantilla de transacción, con los mismos huecos `{…}` y el nombre canónico delante (como las reglas) | `template pay message: pay: {me} paga lo anunciado en {first it.0}` |
| `level <nombre>` | un nivel de madurez (los quince genéricos y los de cada tipo, como los cinco de «booking») | `level seed: semilla` |
| `order <nombre>`, `size <nombre>` | un orden de `epoch.8.5`, un tamaño de `epoch.9.5.2` | `order newest: lo último primero` |
| `legible <qué>` | los formatos con que `legible` compone un texto, con huecos planos | `legible price: {amount} {series} por unidad` |

`texto(eje, clave, idioma, { original })` devuelve la traducción del registro del idioma; si falta, la del registro canónico **«en»** (`epoch.9.4.2`, que solo lleva los formatos de `legible`: las reglas y las plantillas tienen su inglés en su propio 9 y en sus etiquetas); si falta, `original` (el inglés que ya tiene quien pregunta); si no hay nada, `null`. `contrato.claves` compone las claves (`claves.plantilla(nombre)`, `claves.parametro(nombre, etiqueta, 'label' | 'help' | 'placeholder')`, `claves.mensaje(nombre)`, `claves.nivel`, `claves.orden`, `claves.tamano`, `claves.legible`), para que nadie fuera del contrato escriba la convención. **Todas las entradas que dan texto de la época aceptan `idioma` en sus opciones**: `etiqueta`, `ayuda`, `marcador` (solo lo que viene de una plantilla; las reglas cortas de la época van tal cual), `validar` (los motivos), `madurez` (`nombre` traducido, `clave` el canónico) y `niveles`; en el aro, `acciones.parametros(plantilla, { idioma })` (`etiqueta`, `ayuda`), `acciones.acciones` (cada acción con `id`, `nombre` canónico y `etiqueta` en el idioma de quien mira), `transaccion` (los motivos de los parámetros y el mensaje de una lectura) y `camino` (`falta` y `niveles`). Los datos que se escriben en el eje siguen en inglés: el 0 del registro que escribe una acción es su mensaje canónico, como el 9 de las reglas. La carta lee el idioma de `configuracion(yo).language` y lanza las acciones **por el id de su plantilla**, no por su nombre, para que el nombre que se ve sea solo el traducido.

```js
texto(eje, clave, idioma = 'en', { original })   // → el texto, o null
claves                                           // → { plantilla, parametro, mensaje, nivel, orden, tamano, legible }
```

### 8.2 Valores legibles: `legible(eje, valor, tipo, { idioma })` y `desdeLegible(texto, tipo, { eje, idioma })`

Un valor de una posición o de un parámetro ya no se enseña como JSON en crudo. `legible` devuelve `{ texto, partes }`; `tipo` es el de la plantilla (las hojas de su d.1) y orienta la lectura, y lo que el valor **es** se reconoce también por su forma. Lo que decide cómo se dice viene de la época (los formatos `legible …` de `epoch.9.4`, las escalas de T de `epoch.1.3`, los nombres de las plantillas y de los niveles) o del eje (el 0 de un registro o de un alta):

| Valor | Texto | En `partes` |
|---|---|---|
| un precio `[["E"], [1]]` (o `[["E:casa/EUR"], [12]]`) | «1 E por unidad» («12 EUR por unidad») | `precio: { enQue, cuanto, serie }` |
| una lista de precios | cada uno, separados por « · » | `precios` |
| una serie `E:casa/EUR` | «EUR» | `familia, emisor, denominacion, registro` (el id al que está atada) `, registroTexto` (su 0) |
| `T:hora`, `P:<r>/ana`, `P:<r>.1/ana`, `R:casa` | «hora» (el nombre de la escala en `epoch.1.3.1`), «P sobre <0 de r>», «P sobre <0 de r>, mirada 1», «R de casa» | `escala`, `registro`, `mirada`, `origen`, `emisor` |
| un instante `2026-11-07T13:30:00Z`; un día `2026-11-20` | la fecha y la hora en el idioma (`Intl`, en UTC: «7 nov 2026, 13:30»); solo la fecha | `instante` (el original) |
| una identidad | el 0 de su alta («Alta de huesped», «Casa de ejemplo») | `identidad, alta` |
| una referencia `{ ref, dir }` o un id | el 0 del registro; con dirección, « · » y la etiqueta de esa posición («Menú del día · recursos») | `ref, dir, X, representacion, posicion` |
| una décupla | su 0 legible; sin él, «registro de N posiciones» | `decupla, n, posiciones` (cada una legible) |
| una lista | sus ocupantes legibles, separados por « · » | `lista` |
| una cantidad de token `{ serie, cantidad }` (un asiento del diario) | «12 EUR», «1 hora» | `cantidad, serie` |
| el nombre de una acción del aro, de una plantilla de datos, un nivel | su traducción («aplicar un recurso», «compra», «semilla») | `accion, id` / `plantilla` / `nivel` |
| un número, un texto | tal cual (los dígitos no se localizan: el input los devuelve igual) | `valor` |

`desdeLegible(texto, tipo, { eje, idioma })` es la inversa mínima para editar los **tipos simples** (`esTipoSimple(tipo)`: los tipos genéricos de `epoch.9.2.0.1`; una décupla se edita en BTML): un número (con coma o punto decimal), un instante (ISO estricto; un día «AAAA-MM-DD» o «AAAA-MM-DDTHH:MM», como lo da un input, completados en UTC), una identidad por su id o por el 0 de su alta, una referencia por su id o por el 0 de un registro, un nivel o el nombre de una acción o de una plantilla por su traducción, y el texto tal cual; vacío, `{ valor: undefined }`. Devuelve `{ valor }` o `{ motivo }` (el motivo, con los formatos «legible not a number», «… not an instant», «… unknown identity», «… unknown record» de `epoch.9.4`). La carta enseña en el input de cada parámetro el valor legible (y el crudo en un desplegable «ver en BTML»); al enviar, si el texto no se tocó manda el crudo, si el tipo es simple lo lee con `desdeLegible`, y lo demás como antes (JSON si empieza por `[` o `{`).

```js
legible(eje, valor, tipo, { idioma = 'en' })       // → { texto, partes }
desdeLegible(texto, tipo, { eje, idioma = 'en' })  // → { valor } | { motivo }
esTipoSimple(tipo)                                 // → true salvo la décupla
```

**Core, pendiente de revisar VG**: los nombres en español de las 33 acciones y de sus parámetros (`datos/epocas/epoca-0.btml.json`, 9.4.1); que la hora se enseñe en UTC (la del libro); que una referencia con dirección se lea como «<0> · <etiqueta de la posición>»; que un valor que nombra una plantilla («purchase» en el 5) se enseñe traducido («compra») aunque el dato siga en inglés; que la identidad se lea por el 0 de su alta («Alta de huesped»). Los textos propios de la carta (botones, «soy», «configuración», «guardar este rato», «leído») no son de la época: viven en `carta/textos.js`, en un solo objeto por idioma (hoy, `es`), para traducirlos luego por la misma preferencia.

## 9. Qué cambia en el eje y en los ejemplos

- `src/contexto-eje.js`: el 8 de un registro (y de la candidata) tiene su nodo implícito: 8.6 la medida (la vista) y las lecturas de la época en `X.8.d` (`X.8.1`, «maturity»). Añadido al final del bloque de vistas. Para una identidad, `A.8.1` sigue siendo «obligation».
- `datos/epocas/epoca-0.btml.json`: 8.3, 8.4, 8.5, 9.2, 9.3, 9.4, 9.5 y una línea de procedencia en el 6; `datos/epocas/reglas/maturity.json`. Eran 40 reglas: 30 condiciones, 3 que escriben, 7 lecturas (con el 3c-2a, 43: diez lecturas, §12).
- `ejemplos/ikisai/compra-food.mjs` y `reserva-booking.mjs`: la compra y la reserva nombran su plantilla en su 5. Cambian los ids de los ejemplos (el génesis referencia la época) y las salidas de los documentos se regeneraron.
- La carta en español (etapa 1, §8.1-8.2): `epoch.9.4.1` («es») pasa de 43 hojas (las reglas) a 469 (las 33 plantillas de transacción con sus parámetros y mensajes, «purchase», «booking» y «preferences» con sus posiciones, los veinte niveles, los tres órdenes, los tres tamaños y los formatos de `legible`), y `epoch.9.4.2` («en») nace con los trece formatos canónicos. Cambia el id de la época y, con él, los de los ejemplos; las salidas de `docs/MODOS.md` y `docs/MOTOR.md` se regeneraron. Pruebas: `test/legible.test.js`.

## 10. El libro local: `LibroLocal(eje, yo)`, `ver`, `tocar`, `recorrido`, `englobar`

Encargo 3c-2b (tras 3c-1). Decisión de VG: cada interacción (ver, tocar) quema **un T de segundo** en un **libro local** de la persona, nunca en el eje compartido; al registrar, lo normal es **englobar** todas esas interacciones en **un minuto y un solo registro**, anclado a lo anterior, y al eje solo llega el minuto (o más). **Las escalas de T son niveles de agregación**: el segundo es una interacción; el minuto, un registro que engloba interacciones; la hora, el día, la semana, el ciclo y el año, registros que engloban registros (cada registro de una escala ancla en su 6 los de la escala inferior). `src/local.js` (espacio de nombres `local`) hace solo lo local, **segundos → minuto**; englobar hacia arriba sobre registros del eje (minutos en una hora, horas en un día…) es la plantilla de transacción «aggregate T» del encargo 3c-2a: esa es la frontera.

El libro local es un `Libro` propio de la capa cero (`src/libro.js`: las mismas primitivas, la misma atomicidad) con la cartera de `T:segundo` de `yo`: **la asignación diaria de la época** (`epoch.1.3.1.0.1`: 86 400 por día civil, UTC), que se renueva a medianoche como en el eje y no se acumula. Cada interacción es una transacción del libro local con un solo paso: acuñar un segundo de la asignación del día (con tope, la acuñación programada: `clase: asignacion`, etiqueta = el día civil) y quemarlo, anclada sobre el registro X que se ve o se toca (`libro.sumas({ registro: X })` dice cuántos segundos lleva cada registro). Nada queda en la cartera. La escala de interacción y la del registro que engloba son la primera y la segunda de la época (`ESCALA_INTERACCION`, `ESCALA_REGISTRO`), no palabras del módulo.

- `ver(X, { t })` y `tocar(X, accion, { t })` queman un segundo y anotan `{ t, X, accion }`; devuelven `{ ok: true, anotacion, queda }` o, **si no queda T de segundo del día, `{ ok: false, motivo }` sin lanzar**: el motivo es el mensaje de la regla de la época que cobra el T del día («writing burns today's T», `contrato.mensaje` con la interacción como candidata, en el idioma de la configuración de `yo`). X es el id de un registro del eje; `t` por defecto, ahora.
- `recorrido(desde)` lista lo anotado y aún no englobado, por llegada (`desde`: cuántas se saltan, o un instante). `quedaHoy(t)`, `gastadoHoy(t)` y `tiempo(X)` leen el libro local.
- `englobar(firmar, { nota, t })` construye **una** transacción para el eje: quema **1 T de minuto** de `yo` (la regla «writing burns today's T» la cobra como a cualquier registro: sale de su asignación del día en el eje) y escribe un registro de escala minuto **anclado a lo anterior** (el último minuto englobado o, la primera vez, el alta de `yo`): 0 la nota, 1 cuántas interacciones, 2 el hash del tramo local (SHA-256 del JSON canónico de las anotaciones: lo que lo acredita), 3 quién, 4 las acciones por llegada, 5 lo anterior (`{ ref }`), **6 el recorrido**: `[[los ids visitados, por llegada], [cuántas interacciones], [el primer t, el último t], [el hash]]`, **7 la escala** (`minuto`). Marca lo local como englobado (`anotacion.en` = el id del minuto) y devuelve el evento asentado; sin nada pendiente, `null`. `firmar` es la clave privada de `yo` (`eje.escribir` firma) o una función `async (evento) → evento firmado`; en un eje de demostración, nada. **Nada de los segundos se publica**: en el eje no entra ninguna serie `T:segundo` por aquí (lo comprueba `test/local.test.js`).
- `serializar()` → `{ version, yo, anterior, anotaciones }` y `LibroLocal.restaurar(eje, datos)`: la carta guarda el libro local en el navegador como guarda el eje; restaurar vuelve a quemar cada segundo en un libro nuevo (como el eje revalida sus eventos) y conserva lo englobado y lo anterior.

<!-- comprobar: fragmento -->
```js
import { local } from './src/index.js';
const mio = new local.LibroLocal(eje, 'huesped');
mio.ver(menu.id);                      // → { ok: true, anotacion: { t, X, accion: 'ver', en: null }, queda: 86399 }
mio.tocar(compra.id, 'abrir');
const minuto = await mio.englobar(privada, { nota: 'una tarde en el menú' });   // → el registro de escala minuto, asentado en el eje
```

**Core, pendiente de revisar VG**: el reparto del recorrido por la cruceta del registro (1 cuántas, 2 el hash, 4 las acciones, 5 lo anterior; el 6 lleva el recorrido entero como pidió VG, así que cuántas y el hash salen dos veces); que la primera vez se ancle al alta; que el `t` del minuto sea el de la última interacción; que el hash sea del JSON canónico de `{ t, X, accion }`.

## 11. Modelos de visualización: `modelo(eje, yo)` y `pieza(modelos, tipo, pv, clave, variante, { tamano, rol, de })`

Encargo 3c-2b (tras 3c-1) y etapa 5 del roadmap (la fase 2 del arte, 9-11). Principio de VG: nada hardcodeado en la pantalla; **los modelos de visualización son registros**; **cualquier modelo puede estar incompleto y se rellena por partes**; los «estados» del motor ya no existen: lo que la animación necesita como estado son **pasos** (§11.4). `src/modelos.js` (espacio de nombres `modelos`) solo sabe dónde mira la época cada cosa: los nombres de los tipos, de las orientaciones, de los niveles, de las palabras de repetición y la cadena de respaldo son datos de la cabecera `epoch.9.7.0`. El manifiesto para quien hace arte: `arte/MANIFIESTO.md`; el importador, `arte/importar.mjs`.

### 11.1 La forma: el modelo y la pieza

Un **modelo** es una décupla registro: **0** su nombre, su nivel de detalle (`sello`, `intermedio`, `ilustrado`: `epoch.9.7.0.1`) y una nota; **1-4 y 6-9** las piezas del mundo de cada punto de vista (1 ciudad, 2 jardín, 3 parque, 4 fábrica, 6 pasado, 7 futuro, 8 cielo, 9 camino), como **lista de referencias `{ ref }` a registros de pieza** y, en un modelo del eje, también las piezas **ancladas** en esa posición; **5** los marcos y los iconos del aro. En la época, `epoch.9.7` es la cabecera (9.7.0) y las referencias a los modelos (9.7.1…), que viven en `datos/epocas/modelos/<nombre>.json` con sus piezas en `datos/epocas/modelos/<nombre>/*.json`; `npm run epocas` reescribe las posiciones de cada modelo desde sus piezas (según el 5 de cada pieza: en qué mundos sirve) y el 9.7 de la raíz, y el BQL mínimo los alcanza por su id como alcanza las reglas (`epoch.9.7.1.0` es el 0 del primer modelo; `epoch.9.7.3.1` las piezas de la ciudad del tercero). En un eje, un modelo es un registro anclado al dominio de un proyecto (su 0 con un nombre y un nivel de la cabecera), y sus piezas se anclan en la posición de su mundo: se rellena por partes. Un mundo sin piezas delante de otro con ellas lleva la hoja `sin piezas` (nunca se escribe `[]`).

**Por qué las piezas son registros referenciados y no ocupantes inline** (Core, pendiente de revisar VG): una posición de una décupla no pasa de diez ocupantes, y una ciudad tiene más de diez piezas (diez pasos por tres orientaciones solo en los elementos); una lista de referencias no tiene tope (como el 2 de la época), una pieza anclada en el mundo de un modelo del eje es «rellenar por partes» tal cual, y anclar dentro de una subdécupla chocaría con los ceros finales de las direcciones.

Una **pieza** es una décupla registro:

| Posición | Qué | Valores |
|---|---|---|
| 0 qué es | el tipo | `etapa` (la pieza grande del mundo, por paso de madurez 1-10), `elemento` (un objeto suelto: por paso y por nombre), `munequito` (por acción y por rol), `movimiento` (por primitiva de la capa cero o por efecto `crear-pasado/futuro/abajo/arriba`), `fondo` (por paso), `marco` (por mundo y por nombre), `icono` (del aro, por mundo y por nombre); `epoch.9.7.0.4` los lista con los nombres de su clave y, en su 2, la **correspondencia** (abajo) |
| 1 cuánto | `[tamaño mínimo, formato]`; sin recurso, `[tamaño mínimo, forma]` | los tamaños de `epoch.9.5.2` (1 hueco, 2 tarjeta, 3 pantalla), como las representaciones del 0; los formatos de `epoch.9.5.1`; las formas sobrias `texto`, `rectangulo`, `punto`. **El nivel de detalle vive aquí**: sello → 1, intermedio → 2, ilustrado → 3, y los tres conviven en un modelo |
| 2 con qué condición | la clave: la condición y, detrás, lo que distingue | el paso, la acción (`esperar`, `actuar`, `celebrar`), la primitiva (`acunar transferir bloquear liberar quemar`) o el efecto, o el mundo del que es icono o marco; `*` sirve para cualquiera. Detrás, en los tipos con dos claves (`epoch.9.7.0.4`), la **segunda componente**: el rol del muñequito (`["esperar", "vendedor"]`), el nombre del elemento (`[5, "tienda"]`), del icono o del marco |
| 3 con quién | la orientación | `centro`, `izquierda` (el lado del PV1), `derecha` (el del PV2): `epoch.9.7.0.3`, la primera es la de respaldo; son piezas distintas, nunca un espejo |
| 4 qué hace | `[repetición, fotogramas]` | `loop` o `once` (`epoch.9.7.0.7`) y un entero; **obligatorio en lo animado** (`lottie`, `video`: `epoch.9.7.0.6`); los fotogramas de lo nuevo, múltiplos de diez (`epoch.9.7.0.8`) |
| 5 dónde encaja | los mundos en que sirve | dígitos, o `*` = todos los mundos (1-4 y 6-9); marcos e iconos, el 5 |
| 6 de dónde viene | el recurso y su procedencia | una ruta relativa del repositorio (`arte/...`) o una URL; detrás, el paquete, el nivel, la licencia |
| 7 en qué orden | el rango | 0 o nada, la primera opción; 1, una pieza que quedó **de respaldo** detrás de otra nueva con su misma clave (el `respaldo: true` del índice de la fase 2) |

Leída (`leerPieza`, lo que devuelve `pieza`): `{ modelo, nivel, tipo, pv, clave, paso | accion | primitiva | mundo, subclave, rol | nombre, variante, tamano, formato | forma, recurso, bucle, fotogramas, rango, procedencia }`. Tres modelos en la época: **`sobrio`** (el modelo 0: sin recursos, solo formas, una pieza comodín por tipo que sirve en todos los mundos y en el 5: completo por forma, siempre responde), **`animado-generico`** (incompleto a propósito: solo la ciudad, con la tienda de la fase 2 como elemento del paso 5 y, con el mismo recurso, del paso 1 como respaldo de 1-10, en las tres orientaciones, y el vendedor esperando de la fase 2; las piezas de la prueba 03 quedan detrás con rango 1; sin iconos del aro) e **`ikisai`** (el de dominio: **las 626 piezas de la fase 2**, `arte/fase2/`, importadas en un solo modelo con `node arte/importar.mjs arte/fase2/bloque-0 … bloque-6 --nombre ikisai`; nivel `ilustrado`, el más alto que tiene; las nueve posiciones llenas: 334 etapas, 145 muñequitos, 144 efectos (17 que sirven en todos los mundos), 77 elementos, 22 iconos, 18 marcos y 16 fondos contando cada comodín en cada mundo).

**La correspondencia** (`epoch.9.7.0.4.n.2`, `corresponde(cabecera, tipo, dado, pv)` y `rolPorDefecto(cabecera, tipo, pv)`): filas `[[lo dado], [la clave de la pieza], [mundos…]]` que llevan de lo que el núcleo o la carta dan a la clave con que se pide la pieza. Para el muñequito, el **rol por defecto de cada mundo** (ciudad vendedor, jardín jardinero, parque socorrista, fábrica operario, pasado relojero, futuro tejedor, cielo astrónomo, camino guía); para el movimiento, la primitiva del libro → el efecto, por mundo: `acunar` es `crear-abajo` salvo en el pasado (`crear-pasado`), el futuro (`crear-futuro`) y el cielo (`crear-arriba`); lo que no renombra se pide tal cual (`transferir`, `bloquear`, `liberar`, `quemar`).

**Un modelo por nivel o el nivel en la pieza** (Core, etapa 5): el nivel va en la pieza, como su tamaño mínimo (`[1, "svg"]` sello, `[2, …]` intermedio, `[3, …]` ilustrado), y los tres conviven en `ikisai`. Es lo que `pieza(…, { tamano })` ya hacía («la de mayor tamaño mínimo que quepa»): en el hueco responde el sello, en la tarjeta el intermedio, en la pantalla el ilustrado donde lo hay y el intermedio donde no; un mundo sin sello no responde en el hueco y cae al siguiente modelo. Tres modelos encadenados por nivel habrían exigido repetir el encadenamiento en la cadena de la época y en la preferencia `model`, y el respaldo entre niveles ya lo da el tamaño.

### 11.2 El respaldo en cadena

`modelo(eje, yo)` devuelve la lista de modelos a consultar, en orden: el que nombra la configuración de `yo` (la preferencia `model` de «preferences», `epoch.9.3.6`; la cabecera dice dónde está, `epoch.9.7.0.5`: un nombre de la época, o el id de un registro del eje que sea un modelo: §11.5), luego los de la cadena de la época (`epoch.9.7.0.2`: `animado-generico`, `sobrio`), sin repetir. Por defecto `model` es `sobrio` (coherente con `render: sober`), así que la cadena de quien no ha elegido es `sobrio` y detrás `animado-generico`; quien nombra `ikisai` tiene `ikisai → animado-generico → sobrio`. Un nombre que no existe no rompe la cadena.

`pieza(modelos, tipo, pv, clave, variante, { tamano, rol, de })` busca en orden y devuelve la primera pieza que exista: en cada modelo, la orientación pedida y, si no la hay, las de la cabecera (la primera es la de respaldo); con una clave numérica, la pieza del paso pedido o **la del paso inferior más cercano del mismo modelo antes de caer al siguiente modelo** (la comodín `*` es la más baja); con una palabra, la exacta o la comodín; entre varias, **la de mayor tamaño mínimo que quepa** en `tamano` (sin tamaño, todas caben) y, a igual tamaño, **la de menor rango** (la nueva antes que la que quedó de respaldo con su misma clave: el respaldo dentro del modelo). Con `rol`, la segunda componente de la clave: las piezas de ese rol o nombre y, si el modelo no tiene ninguna del rol pedido en ese mundo, **las del rol por defecto del mundo** (la correspondencia de la cabecera) y, si tampoco, cualquiera. Con `de`, una clave numérica k se lee como «k de `de`» y se **reescala a los pasos que el modelo tiene** para ese tipo y mundo (su mayor clave numérica): la madurez 11 de 15 de la compra pide la etapa 8 de 10. Nunca null mientras el sobrio esté en la cadena: lo comprueba `test/modelos.test.js` para todos los tipos, mundos, claves y orientaciones. `validarModelo(m)` → `{ motivos, avisos }`: lo animado sin su 4, una repetición que la cabecera no conoce, fotogramas que no son un entero positivo o un tamaño que la época no tiene son motivos; fotogramas que no son múltiplo de diez, un aviso (el arte de prueba 03 trae 48).

<!-- comprobar: fragmento -->
```js
import { modelos } from './src/index.js';
const cadena = modelos.modelo(eje, 'huesped');                                   // → [{ nombre, nivel, nota, donde, registro, piezas, cabecera }, …]
modelos.pieza(cadena, 'elemento', 1, 7, 'derecha');                              // → la tienda del paso 5, derecha (el paso inferior más cercano)
modelos.pieza(cadena, 'munequito', 1, 'esperar');                                // → el vendedor (lottie, loop, 50 fotogramas)
modelos.pieza(cadena, 'icono', 5, 3, 'centro', { tamano: 1 });                   // → con ikisai, el icono «escribir» del parque en sello; sin él, la del sobrio: { tipo: 'icono', forma: 'texto', … }
modelos.pieza(cadena, 'etapa', 1, 11, 'izquierda', { tamano: 2, de: 15 });       // → la etapa 8 de la ciudad, izquierda, intermedio (11 de 15 reescalado a 10)
modelos.pieza(cadena, 'munequito', 3, 'celebrar', 'centro', { tamano: 2, rol: 'nadie' }); // → el socorrista (el rol por defecto del parque)
```

### 11.3 El manifiesto de arte y el importador

`arte/MANIFIESTO.md` dice qué trae un paquete de arte para convertirse en modelo: los archivos (uno por orientación), un índice `indice.json` con una entrada por pieza (`ruta`, `mundo`/`pv`, `tipo`/`familia`, `nombre`, `paso`/`accion`/`primitiva`, `nivel`, `tamano`, `orientacion`, `bucle`, `fotogramas`, `mundos`, `heredado`, `respaldo`; tolera campos que falten), fotogramas en múltiplos de diez, Lottie sin expresiones ni recursos externos, SVG sin scripts, y la licencia. `node arte/importar.mjs <carpeta>… [--nombre n] [--escribir]` lee los índices (varias carpetas, los bloques de una entrega, van en **un** modelo) y genera el JSON del modelo (el registro y sus piezas, con las referencias por mundo) **sin copiar archivos**; lo que falta lo infiere de las carpetas de la ruta, de los segmentos del nombre del archivo, de la extensión y del propio Lottie, y lo dice en sus avisos; con `--escribir` lo deja en `datos/epocas/modelos/` para que `npm run epocas` lo referencie. De la fase 2: `pv: "comun"` es el 5 en lo que se clava por mundo (iconos, marcos) y `*` en los efectos; el mundo 0 (la lente) va al 5 (un modelo no tiene posición 0); `mundos: [6, 7]` son los mundos en que sirve; `nombre` es la segunda componente de la clave; `tamano` que falte sale del nivel; `respaldo: true` es rango 1. `arte/pruebas/03/indice.json` es el índice de ejemplo; `arte/fase2/bloque-N/indice.json`, los siete de la fase 2.

### 11.4 Los pasos: `pasos(eje, X)`

Los pasos son lecturas que dan un **valor discreto** y la animación los usa como **índice de fotograma** (paso k → fotograma k; es lo que prueba `pruebas/carta/`: «el cambio de paso es un cambio de fotograma»). Qué pasos hay y de dónde sale cada uno es la tabla de **`epoch.9.8`**, una fila por punto de vista, `[[pv], [nombre], [k], [de], [nota]]`; `k` y `de` son fórmulas «=…» del BQL mínimo con `it` = el registro (su primer `where` da `it2`), un número, o la palabra de una lectura que el núcleo ya da (los mecanismos de `src/pasos.js`, como `epoch.8.5` nombra «llegada» o «encaje»: qué paso hay es un dato, cómo se lee es código). No se recalcula nada que el núcleo dé.

| PV | Paso | k | de |
|---|---|---|---|
| 4 | `ciclo` | la etapa del ciclo: los movimientos anunciados (los registros que el dueño ancló en el 4.1 de X) que ya pasaron: fórmula, la misma condición que la plantilla de cerrado de `epoch.9.0.1` y «what is missing» de `epoch.9.0.3` | cuántos se anunciaron (fórmula); sin anuncios, 0 de 0 |
| 8 | `cuota` | la caja (0-9) de la cuota de X frente a su padre, en la serie en que más pesa (`share box`: `mapped.cuota` y `bases.cajaDeCuota`); null en la raíz | 10 |
| 7 | `escala` | la escala de T del registro: el dígito de la serie del primer T que quema, 0-9 como `epoch.1.3.1` (fórmula sobre `it.1`, D-SERIE); null si no quema T | 10 |
| `*` | `madurez` | para todo elemento: su nivel (`maturity`: `contrato.madurez`, la lectura «maturity» en `X.8.1`, entre los niveles de su plantilla o los genéricos) | cuántos niveles |

`pasos(eje, X)` → `{ ciclo: { pv, k, de }, cuota: { pv, k, de }, escala: { pv, k, de }, madurez: { pv, k, de } }`, con los nombres de la tabla como claves (cambiarla en una copia de la época cambia las claves, los puntos de vista, los `de` y las fórmulas: `test/pasos.test.js`); `k` es null donde la lectura no da valor. La compra del ejemplo: ciclo 0 de 0 (no anuncia nada), cuota 9 (es lo único que mueve algo bajo el menú), escala 2 (quema una hora), madurez 11 de 15; la reserva confirmada: ciclo 4 de 4 (tres noches y el pago), madurez 4 de 5 (los niveles de «booking»); recién escrita, ciclo 0 de 4. **No hizo falta ninguna lectura `read` nueva**: la escala y el ciclo son fórmulas sobre vistas que ya existen (los movimientos de `X.1` con D-SERIE; `down` y los anuncios del 4.1, como las plantillas del motor), y la madurez y la cuota las da el núcleo.

```js
import { ejemploCompra } from './ejemplos/ikisai/compra-food.mjs';
import { pasos } from './src/index.js';
const { eje, compra } = await ejemploCompra();
console.log(JSON.stringify(pasos.pasos(eje, compra.id)));
console.log(pasos.tabla().map((f) => f.pv + ' ' + f.nombre).join(' · '));
```

```text
{"ciclo":{"pv":4,"k":0,"de":0},"cuota":{"pv":8,"k":9,"de":10},"escala":{"pv":7,"k":2,"de":10},"madurez":{"pv":"*","k":11,"de":15}}
4 ciclo · 8 cuota · 7 escala · * madurez
```

### 11.5 Quién entra en un modelo (SEG-14)

Los modelos son registros que cualquiera puede publicar, pero **quien mira los adopta**: su preferencia `model` nombra el modelo, y lo ajeno solo entra por adopción. Por eso (a) **por nombre solo se resuelven los modelos de la época** (`epoch.9.7`); un modelo del eje se nombra en `model` por **id** (`{ ref }` o el id como texto) y un nombre que no está en la época ni es un id se salta en la cadena, de modo que un registro del eje llamado `ikisai` no suplanta al de la época; (b) de un modelo del eje solo cuentan las piezas **ancladas por su autor** (la delegación a otras identidades queda pendiente: el eje no tiene hoy delegación de escritura sobre un registro, y `autoresDelModelo` en `src/modelos.js` es donde se sumaría), y las de otros se ignoran sin error; (c) en una pieza que viene del eje (anclada o referenciada) el `recurso` es una ruta relativa dentro de `arte/` (sin `..`, esquema, `//`, `\` ni `%`) o una URL de un origen de la **lista blanca**, que es un dato de la cabecera `epoch.9.7.0.9` (detrás de la nota; hoy `https://agram.ikisai.com`; `cabecera().origenes`), y el formato `html` no se admite; lo que no cumple se descarta y responde el respaldo. Las piezas de la época y del repositorio no pasan por estos filtros.

### 11.6 La carta animada entera (etapa 5)

Con `render: animated`, `carta/carta.js` pide a la cadena de modelos, para cada PV de la carta (`test/carta.test.js`):

| Qué | Pieza | Cómo se pide |
|---|---|---|
| la **etapa** | `etapa` del mundo del PV | la madurez del foco como «k de de» (`contrato.madurez`: 11 de 15 → la etapa 8 de 10 que el modelo tiene), con la orientación de su lado (1, 3 y 6 la del PV1; 2, 4 y 7 la del PV2; el resto centro) y el tamaño del PV: el sello en comprimido, el intermedio en tarjeta y bloque, el ilustrado donde lo hay |
| el **fondo** | `fondo` del mundo, en bloque y en foco | por la misma madurez: la etapa inferior más cercana (la fase 2 trae 5 y 10); por debajo del 5, nada (la forma sobria no se pinta) |
| el **marco** | `marco` del 5 del modelo, por mundo | el del mundo del PV alrededor de cada carta; en el centro, el neutro (la comodín) |
| el **personaje** | `munequito` del mundo, por acción y rol | el rol del registro (gancho `rolDeRegistro`, hoy null) o el **rol por defecto del mundo** de la cabecera; `esperar` en bucle en lo enfocado (bloque o foco) y parado en tarjeta; `actuar` una vez cuando llega una transacción nueva al PV; `celebrar` una vez cuando el paso propio del PV (`pasos`) llega a su «de» (la reserva confirmada: ciclo 4 de 4) |
| los **elementos** | `elemento` del mundo, por nombre | uno por ocupante: un registro referenciado, por su propia madurez; lo demás, la comodín (el primero del mundo) |
| los **efectos** | `movimiento`, por primitiva | por cada primitiva distinta de lo que una transacción nueva declara (sin la asignación de T, la obtención de P y el T que cuesta escribir), la clave que da la correspondencia de la cabecera para ese mundo (`acunar` → `crear-abajo`, `crear-pasado` en el 6, `crear-futuro` en el 7, `crear-arriba` en el 8; `transferir`, `bloquear`, `liberar`, `quemar` tal cual), superpuesta a la pieza real y reproducida una vez; si todo lo declarado se quema (sale de alguien y no llega a nadie), al acabar se oculta la pieza (`consumido`) |
| los **iconos del aro** | `icono` del 5, por mundo | en sello (tamaño 1), uno por hueco |

Lo nuevo es lo que la app marca en `estado.nuevos` (las transacciones del diario llegadas desde la última vez, `marcarNuevos` en `carta/app.js`); cada una cuelga de un PV de X (el primer dígito del `en` de su primer ancestro bajo X; X mismo o lo anclado en su 0, el centro) y se olvida en cuanto se ha pintado con lottie-web. **Rendimiento** (`carta/dom.js`, `trasPintar`): nunca más de N animaciones a la vez, N la preferencia `animations` de quien mira (`epoch.9.3.7`, defecto 10), por prioridad (0 lo nuevo y los efectos, 1 lo enfocado, 2 el resto) y orden del documento; el resto espera en su fotograma y entra cuando acaba un efecto; lo que sale de pantalla se pausa; los SVG son `<img>` y los Lottie van en `svg`. Medido con Playwright en la compra del ejemplo con el modelo `ikisai` y los ocho PV en bloque: 400×700 (apilada) 8 Lottie cargados, 1 reproduciéndose (los demás fuera de pantalla, pausados), 60 fps; 1200×800 (matriz) 8 cargados, 4 en pantalla reproduciéndose, 50-60 fps, 5 durante un efecto; con `animations: 2`, 2. Sobrio no cambia: completo sin imágenes. Pendiente: las transiciones `abrir`/`cerrar` del aro (no hay dato del núcleo que las nombre) y el rol leído del registro.

## 12. Acciones: el aro, la transacción y el camino

Encargo 3c-2a (VG, tras 3b-bis). La mitad de acción del contrato, `src/acciones.js` (exportado como el espacio de nombres `acciones`). Principio (VG): nada hardcodeado en la pantalla ni negocio en JavaScript que pueda ser una regla o un dato de la época; **la carta solo lista y lanza lo que el núcleo le da**. Pruebas: `test/acciones.test.js`; la carta de texto (`test/carta-texto.mjs`, `pintarPara`) pinta el aro y el camino para quien mira.

```js
import { acciones } from './src/index.js';
const { acciones: aro, transaccion, camino, autoejecutar, estaciones, plantillasDeTransaccion, parametros } = acciones;
```

### 12.1 Los datos que VG decidió (todo en la época, con su procedencia en el 6: «VG, tras 3b-bis»)

**Los seis grupos de R son seis precios** (`epoch.1.2.1`). Cada grupo lleva en su 2 el token con que se paga escribir a alguien de ese grupo: desconocidos `my R` (la propia R del destinatario devuelta: gratis para quien ya tiene R suya; los desconocidos caen aquí por defecto), comercial `E` (la cantidad la fija el dueño en su `A.3.1.2`; el token no se cambia), expertos `P` (P del remitente sobre el dominio del destinatario: gratis para quien tiene criterio sobre lo suyo), cercanos `their R` (atención por atención), equipo **`open record`** (sin pago mientras exista un registro abierto, con movimientos anunciados y pendientes, que nombre a los dos en su 3), vetados `nothing` (no llegan). Los nombres de los grupos son los que ya tenía la época. La regla «attention has a price» ya no lleva escrito el grupo ni el precio: los lee de dos **lecturas nuevas** de la propia transacción, **«attention group»** (`X.6.3`: de dónde viene, con quién: la zona en que el dueño del alta sobre la que se escribe pone a quien escribe: el último de sus grupos que lo nombra, el que le asignó su invitación, o la zona de `epoch.9.0.2.1`) y **«attention price»** (`X.6.2`: con qué condición: el último 2 de esa zona, el de la época o el que el dueño ancló en el `3.k.2` de su alta). `epoch.9.0.2` deja de repetir el precio.

**P por mirada.** El ámbito de una serie de P admite una ruta de posición: `P:<r>.<d>/<origen>` (`tokens.ambitoDe`, `raizDeAmbito`, `miradaDeAmbito`). P sobre r entero pesa en todo lo de r; P sobre `r.d` pesa solo en decisiones sobre la mirada d (1 su E, 2 su P, 3 su R, 4 su T, 5 su encaje). La serie como registro da la mirada en su `0.5`; `A.2.1` y `A.2.6` llevan una entrada por ámbito, cada una con el registro en su 0 y la mirada en su 5. Obtención: «getting E gives ten P on its record» coloca en `r.1` (`put … at A.2.1.(r).1`: el destino de `put` admite un dígito tras el índice por valor); «receiving R…» en el `3` del alta del emisor; «writing a record…» sigue sobre r entero. Reposicionar hacia `r.d` es un paso de siempre (de r a `r.d`, bajar: una décima más; de `r.d` a r, subir: una décima; de una mirada a otra, o de una mirada a un hijo, dos). «minting E needs P on its record» admite P en r o en `r.1`. Recuentos: la lectura «weight» pesa un compromiso de P sobre `r.d` solo si la decisión dice esa mirada en su criterio (**«view d»**, una magnitud, en su 2.2 junto al umbral, o en su 2 si es una lista); el P del registro entero pesa siempre; si la decisión no dice mirada, es sobre r entero. `eje.poderSobre(A, r, origen, mirada)` y `motor.peso(eje, A, X, mirada)` toman la mirada (sin ella, todo el P posicionado en r, el entero y el de cada mirada). Los cinco criterios de P de `epoch.1.1` quedan como etiquetas de las posiciones 1-5.

**La orientación de una E es el token que la paga.** Las cuatro orientaciones de `epoch.1.0.1` llevan su precio `[[en qué], [cuánto]]` (financiera ↔ E, conocimiento ↔ P, social ↔ R, productiva ↔ T). Cada serie de E declara en su **emisión** su precio principal (`precio: [<serie o familia>, <cuánto por unidad>]`) y los que acepta (`precios`, una lista de pares); son del contrato de la serie (`tope.contratoE`), y la serie como registro los da en su **2.2** (con qué condición se consigue una unidad), el principal primero y, sin declarar, el de la primera orientación (una unidad de E). Se eligió el 2.2 porque el 2 de la serie ya es su contrato (2.0 divisible, 2.7 caducidad) y el precio es la condición de conseguirla.

**Los pasos de un proceso se tipan por token.** La lectura **«stage»** (`X.4.8`: fábrica, frente a otros: lo ocurrido frente a lo previsto, que es la regla corta del 8 en la profundidad 1) da los movimientos anunciados en el 4.1 de X que aún no han pasado (la misma condición que la plantilla de cerrado). Las **estaciones** son datos de `epoch.4.2`: `[[familia], [qué se hace], [la plantilla que mueve lo anunciado]]`: E pagar (`pay`), P decidir, R atender, T trabajar (`deliver`). La familia de un anuncio se lee buscando su serie por su valor en las series del libro, la vista nueva **`before.4`** (`before.4.("E:casa/EUR")`): un texto no fabrica una serie. `estaciones(eje, X)` → `[{ familia, estacion, plantilla, anunciados, hechos, pendientes }]`. Es la base de las estaciones de la fábrica y del PV4 del aro; no cambia el motor.

### 12.2 Las plantillas de transacción: `acciones(eje, X, k, yo)`

Cada acción del aro es una plantilla de transacción, un registro de la época en `epoch.9.6.1` (la lista de referencias a `datos/epocas/plantillas/<nombre>.json`; `npm run epocas` la reescribe en el orden de su 8) con el molde de regla adaptado:

| | Lleva |
|---|---|
| 0 | el nombre (inglés) |
| 1 | los parámetros que pide, cada uno como una posición de una plantilla de datos: 0 etiqueta, 1 tipo (`text`, `number`, `ref`, `identity`, `instant`, `tenfold`), 2 validación `=…` con `it` = el valor, 3 quién lo da, 4 qué se hace con él, 5 **dónde va en el registro que escribe** («1.2»; «-» si no va en él), 6 de dónde viene, 7 `required` u `optional`, 8 orden, 9 los defectos y, la última hoja, la ayuda. Un defecto `=…` se lee sobre `it` = X, `me` y la candidata `ev` |
| 2 | **cuándo se ofrece**: BQL mínimo con `it` = X y **`me`** = la identidad que mira (nombre nuevo del contexto, junto a `ev`, `epoch`, `before`) |
| 3 | quién la lanza (`me`) |
| 4 | **lo que mueve**: un movimiento por décupla, 0 la serie (una clave, una fórmula o sus partes `[familia, emisor|escala|ámbito, denominación|origen, registro]`), 1 cuánto, 2 la primitiva y, si la lleva, su salida (lock, release, transfer con salida), el precio de una emisión de E o la fecha de un T informativo, 3 `[[de], [a]]` (`nobody` es nadie); lo que da cero o nada no se mueve. O `read` si solo lee; o `path` (`path all`) si lanza el camino |
| 5 | **dónde ancla**: el dígito (o camino, con huecos `{parámetro}`: `3.{zone}.2`) de X y, si no es X, una fórmula que da el registro (`=first (first it.3).6`, el alta del dueño de X) |
| 6, 7 | procedencia, época |
| 8 | **`[punto de vista, orden]`**: la primera de cada PV es la acción por defecto |
| 9 | el mensaje (inglés, con huecos sobre `it`, `me`, `ev`): la representación del registro que escribe |

El registro que escribe cada acción nombra la acción en su 4 (`actions`) y, si lo tiene, su tipo de datos en su 5 («apply a resource» escribe una «purchase»); lo que queda entre las posiciones que piden los parámetros se rellena con datos (1 sobre qué, 2 el criterio, 3 quién): nunca un hueco. `acciones` devuelve las plantillas del PV k cuya condición pasa para `me` sobre X, en el orden del 8: `[{ nombre, plantilla, parametros: [{ nombre, tipo, requerido, ayuda, posicion, valor, falta }], porDefecto, lectura, camino }]`, con los defectos ya resueltos y lo que falta marcado. **Si una acción no debe aparecer, es su 2 quien lo dice.**

El catálogo (MUNDOS_DISEÑO §11 con la corrección de VG al 4), con su condición:

| PV | Acción | Se ofrece si (su 2) |
|---|---|---|
| 1 | **apply a resource** (dar E a X: propina, pagar, reservar; escribe una «purchase») | tengo E y no soy el dueño de X; el precio por defecto es el de la primera serie viva de X (su 2.2); sin serie, lo da quien lanza |
| 1 | issue E tied to X (la emisión lleva su precio) | tengo P en X o en X.1 |
| 1 | lock E as a bid for a quota | tengo E |
| 1 | consume | tengo E de una serie atada a X |
| 2 | **commit P** (votar; con mirada opcional) | tengo P en el dominio de X; ancla en X.2.1 |
| 2 | reposition P toward X (un paso: subir una décima, bajar una décima más) | tengo P entero en el padre o en un hijo de X |
| 2 | declare capacity or threshold | soy el dueño de X; ancla en X.2.2 |
| 2 | borrow criteria from someone (un nombre en el 2.3 de mi alta) | el dueño de X no soy yo y tiene alta |
| 3 | **write to X** (el paquete con el pago del grupo: un movimiento por token posible, solo mueve el que el precio nombra; «their R» acuña antes la propia R que falte) | el dueño de X no soy yo, tiene alta y no me ha vetado; ancla en el 3 de su alta |
| 3 | give own R · return R (ask for attention) · attend · forgive · set a group price (`3.{zone}.2` de mi alta) | su 2 |
| 4 | **aggregate T** (el registro de la escala superior en la fábrica de X con lo de abajo, `down X`, en su 6) · break down · propose · deliver (lo anunciado que me toca y no es E) · pay (lo anunciado de E) · close | su 2 |
| 6 | **anchor here** (no sobre el alta de otro: ahí se escribe con «write to X») · reference X from another record · view thread (lee) | su 2 |
| 7 | **commit time** (bloquear hasta una fecha) · declare future T (T informativo con su fecha) · expire something mine | su 2 |
| 8 | **measure** (una base en el 8 de X) · change cohort · compare with another record (lee) | tengo P en X o soy su dueño |
| 9 | **follow the path** (`path`) · view the whole tutorial (lee) · auto-run to the end (`path all`) · ask for a recommendation (lee) | X existe |

### 12.3 Construir y validar: `transaccion(eje, plantilla, params, yo)`

`params.X` es el registro. Construye la candidata desde la plantilla: el ancla (su 5), el payload con los parámetros dados y los defectos de los que faltan (en orden, con lo ya puesto a la vista como `ev`: el pago de «write to X» es la lectura `ev.6.2` de la propia candidata), los movimientos de su 4 y, salvo que un parámetro ocupe el 0, su mensaje como representación. Valida primero los parámetros con su 2 (motivos por posición, `{ regla: <parámetro>, mensaje, parametro }`) y después la transacción entera contra las reglas **sin asentarla**: `eje.validar(ev)`, que ya existía (las condiciones sobre el libro de antes, sin confirmar). Devuelve `{ ok, evento, motivos: [{ regla, mensaje }] }` con los mensajes por `contrato.mensaje(…, idioma)` en el idioma de la configuración de `yo` (o el que se pida); lo que no es una regla de la época (la aritmética del libro) llega con su texto. Con `opciones.firmar` (`async (evento) → evento firmado`, lo que la carta sepa firmar) la candidata **se firma antes de validarse** y vuelve firmada: quien tiene clave firma (R9), así que sin ella una identidad con clave vería siempre «who has a key signs» en la validación en seco (encargo de la carta v1). **Si `ok`, la carta lo asienta** con lo que ya existe (`eje.anadir`); aquí no se asienta nada. Una plantilla `read` devuelve `ok` con `lectura`; una `path`, el paso del camino que lanzaría (`paso`), o todos los míos (`pasos`) con `path all`.

### 12.4 Las estaciones: `estaciones(eje, X)`

Lo anunciado en X por estación (§12.1): `[{ familia, estacion, plantilla, anunciados, hechos, pendientes }]`. Los anuncios son los registros que el dueño ancla en el 4.1 de X (leídos por `down`, como la plantilla de cerrado); los pendientes, la lectura «stage».

### 12.5 El camino: `camino(eje, X, yo, { sugerencias })` y `autoejecutar(eje, X, yo, firmar)`

Tres fuentes, en este orden, y cada paso `{ fuente, falta, hacer, espera, hecho }`:

1. **El tutorial** (`fuente: 'tutorial'`): los nombres de plantillas de transacción (o de reglas) escritos en el 9 de la plantilla de X (la de datos; la de identidad, `epoch.3.0.9`, si X es mi alta) o del propio X. Un paso está `hecho` si hay un registro mío en su ancla. Una regla en el tutorial no se lanza: se cumple o no («a key is declared at its alta»: la clave se declara en el alta misma).
2. **Las reglas** (`fuente: 'reglas'`, con la regla que lo deriva): cada movimiento anunciado y pendiente (la lectura «stage», con la plantilla de su estación: si lo debo yo es un paso mío, `hacer: { plantilla, X, parametros }`; si lo debe otro, un paso de **espera**, `espera: <quién>`: el camino enseña las dos cosas), el recuento del dueño sin alcanzar («commit P» si lo puedo lanzar; si no, espera del dueño), las peticiones de atención sin atender de mi alta («attend») y las caducidades próximas (un día del calendario, `epoch.7.0.3.1`: «expire something mine» si la serie es mía; si no, espera del emisor). `falta` se lee en humano con el 9 de la regla vía `mensaje()`, en mi idioma.
3. **Las sugerencias** (`fuente: 'sugerencia'`): un gancho opcional, `sugerencias(eje, X, yo) → [{ plantilla, parametros }]`, sin LLM aquí; cada una se construye y se valida con `transaccion` y queda marcada (`pasa`, `motivos`).

Si la madurez de X es 0 o desconocida, devuelve además `niveles` (los de su plantilla o los de `contrato.niveles()`). Orden: primero lo que nombra el criterio del dueño (`X.2.3`), luego lo que nombra el mío (el 2.3 de mi alta), luego el resto.

`autoejecutar` construye y lanza los pasos míos en orden mientras pasen: cada uno con `transaccion` (firmado con `firmar(evento)`, lo que la carta sepa firmar, antes de validarse) y asentado con `eje.anadir`; se detiene en el primero que no pasa: `{ hechos: [{ paso, evento }], parado: { paso, motivos } | null }`. En la reserva abierta de Booking, la huésped paga y la casa entrega las tres plazas por el aro, y la reserva queda cerrada (`test/acciones.test.js`).

### 12.6 El tutorial del alta

Sale de los datos, sin código especial: el 9 de la plantilla de identidad (`epoch.3.0.9`) lista «a key is declared at its alta» (la regla: la clave se declara en el alta misma, así que el paso solo dice si está), «set a group price» (los grupos de atención) y «anchor here» (el primer registro). `autoejecutar` sobre un alta nueva pone el precio de su primer grupo y se para en el primer registro, que pide un título.

## 13. Para decidir VG

Del encargo 3c-2a:

- **La mirada de una decisión** va en su criterio (`X.2.2`, junto al umbral, o en su 2 si es una lista) como «view d», y no en el 2.3 como decía el encargo: en el 2.3 un ocupante que no es un nombre rompe el defecto «sin lista, solo el dueño» (N4). «O el compromiso lo dice» queda: el compromiso de P sobre `r.d` ya lleva su mirada en la serie.
- **El precio de la E en el 2.2 de la serie** y declarado en la emisión (`precio`, `precios`); una familia sola como precio («E») deja la serie concreta a quien paga.
- **«stage» en `X.4.8`** y **`before.4`** (las series del libro) para leer la familia de un anuncio por su valor.
- **El aro**: el molde de las plantillas (parámetros como posiciones de una plantilla de datos; `[punto de vista, orden]` en el 8; el ancla con huecos `{parámetro}`; el registro que escribe nombra la acción en su 4 y su tipo en su 5; las posiciones intermedias se rellenan con «sobre qué», «criterio» y «quién»); que «apply a resource» escriba una «purchase»; que «commit P» y «reposition P» anclen en X.2.1 y «declare capacity» en X.2.2 (anclados en el 2 entero, el 3 del registro se leería como parte del 2.3 de X); que «deliver» mueva todo lo anunciado que no es E (P, R y T) y «pay» la E; que «aggregate T» englobe los hijos de X en su fábrica; que las acciones que solo leen («view thread», «compare…», «view the whole tutorial», «ask for a recommendation») sean plantillas con `read` en su 4.
- **El equipo** paga «open record» con cuánto 0: abierto es «con movimientos anunciados y pendientes» (la lectura «stage»), no «sin cerrar» en general.
- **La clave en el tutorial** es una regla, no una acción: no hay plantilla que la declare después del alta.
- **Los textos de las plantillas** (ayudas, mensajes) en inglés como los de las reglas, canónicos; su español, por datos en `epoch.9.4` con la convención de claves de §8.1 (`template <nombre>`, `… param <etiqueta> label | help | placeholder`, `… message`, `level`, `order`, `size`, `legible`).

- **La forma de las plantillas**: la diagonal (0.0 nombre, 4.4 `template`, 8.8 niveles, 9.9 modelo de división) y que una plantilla solo describa la profundidad 0 (las subposiciones, como el 1.2 de la compra, llevan la regla corta de su profundidad). ¿Plantillas anidadas (el 1 de una compra con su propia plantilla «resource»)?
- **El 5 como tipo**: la referencia a la plantilla por nombre o por `{ ref }`; en BQL mínimo `X.5` sigue siendo solo el id y las claves (B4), así que el tipo se lee del payload, no del contexto.
- **Las representaciones**: la hoja como texto sin tamaño mínimo, la décupla rica (0, 1, 5), los tres tamaños y los datos que caben en cada uno (1, 4, 10), los ocho formatos y que el 0.1 de la plantilla los acote.
- **El espacio de bloque**: con un dato, 0 si hay representación y si no 5; las filas de 7 y 8; el umbral de lista frente a matriz (1,25).
- **Los órdenes**: `epoch.8.5` (una entrada de la época, no una lectura); el d.8 de la plantilla manda sobre el 2.3 del dueño y este sobre el defecto; solo `arrival`, `newest` y `fit`.
- **La madurez**: `X.8.1` para el nivel y `X.8.6` para la medida; la suma posiciones + profundidad + órdenes de la cantidad; los diez nombres de los niveles por posición; los cinco niveles de «booking» y el reparto proporcional de los niveles de un tipo sobre los genéricos.
- **Las preferencias**: en el 9 del alta; sus cuatro campos y sus defectos (`sober`, 10, `en`, 1 2 3).
- **Los mensajes**: una hoja «regla: texto» por regla en el registro del idioma; `en` como canónico.
- **El libro local** (§10): el reparto del minuto por la cruceta (1 cuántas, 2 el hash, 4 las acciones, 5 lo anterior, 6 el recorrido entero, 7 la escala), la primera ancla en el alta, el `t` del minuto, y que las interacciones solo sean sobre registros que el eje tiene.
- **Los modelos** (§11): las piezas como registros referenciados o anclados (no ocupantes inline, por el tope de diez); la forma de la pieza (0 tipo, 1 tamaño y formato o forma, 2 clave, 3 orientación, 4 repetición y fotogramas, 5 mundos, 6 recurso); la cabecera de `epoch.9.7.0` (niveles, cadena, orientaciones, tipos y sus claves, la preferencia, los formatos animados, loop/once, el múltiplo diez); que `model` valga `sobrio` por defecto y la cadena no repita; que la orientación de respaldo se busque en el mismo modelo antes que en el siguiente; que el 5 de «preferences» (el tipo) esté descrito en la plantilla para que exista el 6, y que `configuracion` no lo lea; el hueco `epoch.9.6` reservado al encargo 3c-2a.
- **Los pasos** (§11.4): las cuatro filas de `epoch.9.8` y sus nombres en español; que la cuota del 8 sea la de la serie en que más pesa; que el ciclo cuente anuncios cumplidos sobre anunciados (y 0 de 0 sin anuncios); que el `de` de la cuota y de la escala sea el número 10 escrito en la tabla (una décupla cuenta como un ocupante en el BQL mínimo, así que no se pueden contar sus posiciones).
