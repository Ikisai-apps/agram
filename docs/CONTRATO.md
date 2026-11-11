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
| los pasos de tamaño de un PV en Mapped (§4.1) | `epoch.8.6` |
| la división de cada mundo en pantalla completa (§4.2) | `epoch.8.7` (con las escalas de T de `epoch.1.3`, el calendario de `epoch.7` y los pasos de `epoch.9.8`) |
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
colores()                  // → { [pv]: "#rrggbb" }, el color de cada punto de vista (epoch.9.5.4); la carta lo pasa a --pv-0 … --pv-9
```

## 3. Ocupantes ordenados y paginados: `ocupantes(eje, X, d, desde, cuantos)`

La carta **nunca ordena ni filtra**. El orden lo da la época: `epoch.8.5` lista los órdenes que existen, cada uno `[[nombre], [mecanismo, …], [qué]]`: **`arrival`** (por llegada; el primero, el defecto), `newest` (por llegada, el último primero), `latest` (por el t de cada uno, el más reciente primero), `soonest` (por el t, el más próximo primero) y `fit` (por encaje: `encaje.ordenarPorEncaje`). El mecanismo es la palabra que el código de los ocupantes ya conoce (`llegada`, `encaje`, `instante`: por el t del registro referenciado, lo propio con el de X, a igual t por llegada; `reverse` lo invierte): qué orden rige es un dato, cómo se ordena es código. Rige, por este orden: el **d.8 de la plantilla** de X si nombra un orden existente; si no, lo que el **dueño nombra en el 2.3** de X (un ocupante del 2.3 de su payload, o anclado ahí por él, que se llame como un orden; B2: el 2.3 ya es «con quién cuenta»); si no, el que se pide en `opciones.orden` (el de las **listas verticales** de un mundo, la novena posición de su fila de `epoch.8.7`: el 6 `latest`, el 7 `soonest`, VG 11-11 #18: lo más cercano al presente arriba; lo pide la carta para el hilo de Sequenced y los bloques de Mapped, no para las franjas); si no, el primero de la época. Se eligió `epoch.8.5` y no una lectura porque ordenar no es una fórmula del BQL mínimo (no hay orden en el léxico) y los órdenes ya existían en el código de los ocupantes (**Core, pendiente de revisar VG**).

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

### 4.1 Mapped: los pasos de tamaño de cada punto de vista (VG, 10-11)

En una pantalla ancha (la matriz, Mapped) **no hay scroll nunca**: la carta ocupa la ventana entera y se avanza hacia adentro (profundidad) y por tamaño, no hacia abajo. Cada punto de vista lateral tiene un **paso de tamaño**, y los pasos son datos de la época, `epoch.8.6` («size steps», procedencia «VG, 10-11»), una fila por paso de menor a mayor, `[[nombre], [fracción en una esquina], [fracción en un lado], [datos que caben]]` (una fracción es un número o dos hojas, numerador y denominador):

| Paso | Esquina (1-4) | Lado (6-9) | Datos | Qué es |
|---|---|---|---|---|
| `hidden` | 0 | 0 | 0 | oculto (también lo que la división de 8.3 no enseña) |
| `dot` | 0 | 0 | 1 | un puntito junto al foco: no ocupa pantalla; el de partida |
| `group` | 1/16 | 1/16 | 9 | un grupito pegado a su esquina o lateral; dentro, la división de 8.3 con los datos que tenga (5 → la X con el 0, 9 → el 3×3) |
| `block` | 1/4 | 1/9 | 10 | la pantalla queda en 3×3: los demás ocupan su celda y se rellenan con lo que tengan |
| `full` | 1 | 1 | 1000 | un solo PV a pantalla completa, con el máximo de Mapped (8.2) y la división de 8.3 dentro |

`pasosDeTamano({ idioma })` → `[{ indice, nombre, esquina, lado, datos, texto }]` (`texto`, por la clave «size <nombre>»). La carta no lleva ningún nombre ni fracción escrita; lo que necesita lo deduce de la tabla (`carta/carta.js`, `escalaDeTamanos`): el de **partida** es el primero en que cabe un dato (el punto), el primero **con espacio** es el primero cuya fracción no es 0 (el grupo), la **pantalla completa** es el que ocupa 1 en esquina y lado, y el **tope** es el anterior a ese (el bloque). Cambiar la tabla en una copia de la época cambia los pasos, las cajas y lo que cabe (`test/carta-mapped.test.js`).

**El reparto de la pantalla** (`repartir`, puro; el árbol trae para cada PV su `pasoDeTamano` y su `caja` en fracciones de la pantalla, y el centro la suya). La pantalla es la matriz 3×3 de la geometría (1 arriba a la izquierda, 8 arriba, 2 arriba a la derecha, 6 izquierda, 7 derecha, 3 abajo a la izquierda, 9 abajo, 4 abajo a la derecha; el 0 y el 5 en el centro). Lo que quiere un PV es la raíz de su fracción en cada eje (un cuarto de pantalla es medio ancho y medio alto); cada columna y cada fila quieren lo del mayor de sus PV. Si algún PV está en el tope, la pantalla está **en matriz**: los demás llenan su celda como si estuvieran al menos en el primer paso con espacio, y el foco quiere la celda de un lado en el tope (un tercio). Después, en cada eje: si lo que se quiere cabe, el centro (el foco) se queda lo que sobra; si no cabe, la banda del PV tocado **más recientemente** se queda lo suyo y las demás se reparten el resto **en proporción**; si nadie es el más reciente (los puntitos suben a todos a la vez), todas en proporción: la cruz se encoge con la X. Cada eje suma exactamente 1: el árbol nunca pide más del 100 % de la pantalla.

**La competición** (`ampliar`, puro, Core, regla elegida): cuando un PV crece por su cuenta (el clic, sus botoncitos, el arrastre) y los PV de su fila (al ensanchar) o de su columna (al alargar) ya no caben juntos, sin contar el foco, **gana el más reciente**: cada PV de esa fila o columna que se tocó antes uno a uno y está en un paso igual o mayor que el que acaba de alcanzar **baja un paso**. Quien ha subido con los puntitos no compite (todos en proporción).

**Los dos mandos.** (a) Los **puntitos del foco** (los diez PV en su paso, junto a la información del foco; la pantalla inicial es solo el 0 con ellos) suben **un paso a todos** hasta el tope (`ampliarTodos`); en el tope, otra pulsación no hace nada, y un mando aparte los baja un paso. (b) El **clic sobre un PV** sube un paso **solo a ese** (`ampliar`); en el tope, el siguiente lo pone **a pantalla completa** (el foco pasa a ese PV); sus **botoncitos** (+ y −) y el **asa** de su esquina hacen lo mismo: arrastrar el asa hacia el centro amplía y hacia fuera reduce, un paso por cada octavo del lado menor de la pantalla recorrido en la dirección de su esquina o lado (la que va hacia el centro: el «umbral por cuadrante»).

**La pantalla completa** de un PV: solo él, sin rosetones; en los lados y esquinas, flechas a los PV vecinos en su sitio de la geometría, el 0 y el 5 junto al 9 (abajo al centro, pequeños), y un botón claro **volver** (y Esc) que deja el PV en el tope. Dentro, `division` con los datos del paso (el máximo de Mapped), por **páginas** de lo que cabe (sin scroll, «anterior» y «siguiente» en lugar de «cargar más»; también en los bloques).

**Los rosetones** en el ordenador: cada uno en su esquina o lateral (el 0 arriba al centro y el 5 abajo al centro, junto al 8 y al 9, más pequeños), por encima de los bloques, una sola vez; en la pantalla completa no se ven. En el móvil (apilada) siguen las dos tiras.

**La medida de cada carta**, pequeña y en su fila de arriba (VG, 10-11; Core, regla elegida): la de un PV es **su paso propio** si la tabla de pasos le da uno (`epoch.9.8`: el 4 su ciclo, el 7 su escala, el 8 su cuota) y, si no, la de todo elemento (la madurez). Así el PV4, el sitio de las acciones, dice en qué etapa del ciclo está.

### 4.2 La división de cada mundo en pantalla completa: `divisionDelMundo(eje, pv, { nivel })` (VG, 10-11 noche)

A pantalla completa la división de un mundo (un punto de vista lateral) **no es una rejilla n × n con herencia: es la cruceta aplicada al elemento pulsado** (VG, 10-11 noche; corrige la tanda 4 de la mañana). Al entrar en un elemento, sus **hijos** son los dígitos que ese mundo enciende, cada uno un PV aplicado al nodo de arriba, con el nombre que da `epoch.5` a esa profundidad (en profundidad ≥ 1: 0 qué es, 1 cuánto, 2 con qué condición, 3 con quién, 4 qué se hace, 5 dónde encaja, 6 de dónde viene, 7 para cuándo, 8 frente a otros, 9 cómo). La división es un dato de la época, `epoch.8.7` («world division», procedencia «VG, 10-11 noche»), una fila por PV, sin posiciones vacías (donde no aplica va `0` o `"-"`: una posición de BTML no puede estar vacía):

`[[pv], [hijos], [profundidad], [formas], [lo que mide], [estilo de los de abajo], [nota], [hilos], [enlace], [orden]]`

| PV | Hijos | Profundidad | Formas (una por nivel; la última se repite) | Lo que mide | Qué es |
|---|---|---|---|---|---|
| 0 | `-` | 0 | `lente` | `-` | la lente, sin división |
| 5 | `-` | 0 | `json` | `-` | el reverso: el JSON del registro |
| 1 | 1 2 3 4 | 4 | `cruceta` | `-` | cuatro esquinas (↖1 ↗2 ↙3 ↘4), el pulsado en el centro; cada esquina vuelve a dividirse al entrar |
| 2 | 1 2 3 4 5 | 5 | `escalera`, `columnas` | `epoch.1.1`, `epoch.9.0.0` (enlace `1 2 3 4 5`) | nivel 1: escalera de cinco peldaños; nivel ≥ 2: cinco columnas, una por hijo, con el siguiente nivel dentro |
| 3 | 1 2 3 4 5 6 | 6 | `rejilla`, `conversacion` | `epoch.1.2.1`, `attended` (enlace `0 1 2 3 4 5`) | nivel 1: rejilla 3 × 2 de los seis grupos de atención; dentro, la conversación |
| 4 | `-` | 1 | `matriz` | `epoch.5`, `pv` | 10 × 10: columnas = los diez PV como tipo de interacción, filas = posición modificada; la celda es la lista de ejecuciones |
| 6 | `-` | 1 | `franjas` | `epoch.1.3`, `epoch.7`, `escala` | una franja vertical por escala de T que mide el calendario, la más cercana a ahora a la derecha; cuatro hilos horizontales |
| 7 | `-` | 1 | `franjas` | lo mismo | espejo del 6: la más cercana a ahora a la izquierda |
| 8 | `-` | 1 | `cielo` | `hitos`, `cuota` | las diez cajas nivel.grado de `HITOS` (`src/bases.js`); cada registro, en la caja del paso `cuota` |
| 9 | `-` | 1 | `camino` | `hitos`, `epoch.9.8` | primero las diez posiciones nivel.grado para situarse; después los pasos del camino (`acciones.camino`, §12.5) |

**Las posiciones de la fila.** `hijos` son los dígitos (el 2 enciende los sitios del 1 más el centro, el 5 «dónde encaja»; el 3, los del 2 más el lateral izquierdo, el 6 «de dónde viene»: ya no hay `hereda`, está en `hijos`); `profundidad` son los niveles a los que se puede entrar; `formas` es la forma de cada nivel (el nivel pide su forma; pasado el último, se repite); `lo que mide` son referencias a lo que la época o las bases dan (una referencia no es un número escrito); **`hilos`** (la posición 8, aparte para que las siete anteriores no cambien de sitio) son los PV de las filas horizontales de las franjas, de arriba abajo: el 6 `1 3 2 4`, el 7 `2 4 1 3`, `-` en las demás; `estilo de los de abajo` es el texto de CSS por defecto de la época para los hijos de un elemento de ese mundo (§4.3), `-` si no hay (hoy un solo ejemplo mínimo, `--hueco: 1fr` en el 1, para que la cascada se pueda probar); **`enlace`** (la novena, detrás de los hilos; encargo «datos», issue #11, Core, pendiente de revisar VG) es lo que cada hijo es de lo que la fila mide, uno por hijo y en su orden, `-` en las demás: en el 2, la mirada de su P (`epoch.1.1`: el hijo d es la mirada d, `1 2 3 4 5`); en el 3, la zona de atención (`epoch.1.2.1`: hijo 1 ↔ zona 0 general, 2 ↔ 1 comercial, 3 ↔ 2 expertos, 4 ↔ 3 poder o cercanos, 5 ↔ 4 equipo, 6 ↔ 5 vetados, `0 1 2 3 4 5`); **`orden`** (la décima, detrás del enlace; solo en el 6 y el 7, VG 11-11, issue #18) es el orden de `epoch.8.5` de sus listas verticales (§3): el 6 `latest` (lo más reciente arriba), el 7 `soonest` (lo más próximo arriba); las franjas no cambian.

**Referencias a lo que se mide.** Una lista de referencias se resuelve al leer: `epoch.1.3` con `epoch.7` son **las escalas de T que el calendario mide** (las de `epoch.1.3.1` cuyo nombre está en el calendario `epoch.7`; hoy siete: segundo, minuto, hora, día, semana, ciclo y año; pasado, futuro e inventado no se miden), con su dígito 0-9, que es el que da `pasos.escala` (§11.4), y el nombre del paso de `epoch.9.8` que coloca cada entrada (`escala`); `hitos` son las diez cajas de `HITOS` (`src/bases.js`), `nivel.grado` («0.3 idea» … «5.3 resolución experimental muy avanzada»), con el paso (`cuota`, en el 8) que coloca cada registro en su caja. No se escribe «7» ni «10»: quitar el año del calendario deja seis franjas (`test/division-mundos.test.js`).

```js
divisionDelMundo(eje, pv, { nivel, epoca })
// → { pv, hijos, profundidad, nivel, entra, forma, formas, mide, bandas?, paso?, hilos?, enlace?, orden?, estilo, nota } | null
hijosDe(eje, X, pv, { nivel, epoca })
// → [{ digito, nombre, ocupantes, total, vacio, mirada?, comprometidos?, reposicionables?, umbral?, valor?, pasa?, faltan?, precio?, estados? }]
```

`nivel` es el nivel de profundidad en que se mira (desde 1, sin pasar de `profundidad`); `entra` es si aún se puede entrar más adentro (`nivel < profundidad`); `forma` es la del nivel pedido y `formas` todas; `bandas` solo si la fila mide algo que se reparte en bandas: `[{ indice, escala, nombre }]` (las franjas, de la escala más fina a la más gruesa) o `[{ indice, nivel, grado, nombre }]` (el cielo y el camino, las diez cajas de `HITOS`), con `paso` el paso de `epoch.9.8` que coloca cada entrada en su banda; `hilos` solo en el 6 y el 7; `estilo` es el CSS por defecto de la época para los de abajo, ya pasado por `cssSeguro` (§4.3), `""` si no hay; `null` si la época no dice nada de ese PV (la carta cae a la división de §4). El 0 y el 5 vuelven con `hijos` vacío y profundidad 0: no se dividen. **Ya no existen** `columnas`, `filas` ni `hereda`: la geometría de las celdas la saca la carta de `forma` y `hijos`.

`hijosDe` da los hijos del elemento X en ese mundo: uno por dígito de `hijos`, con su `nombre` a la profundidad del nivel (`epoch.5`), los `ocupantes` de `X.<dígito>` (tal cual los da `ocupantes`, hasta el paso de la época; `total` es cuántos hay) y `vacio` (sin ocupantes). **La regla del vacío** (VG): un hijo sin ocupantes se pinta con su nombre apagado y no se entra; si todos están vacíos, no se baja. La aplica la carta; el núcleo solo da los hijos con sus ocupantes.

**Lo que se mide por hijo** (encargo «datos», issue #11; Core, pendiente de revisar VG). Si X es un registro del eje y la fila trae su `enlace`, cada hijo lleva además lo que la fila mide de él:

- `epoch.1.1` (el 2, P por mirada): `mirada` y el P posicionado sobre `X.<mirada>` de todos sus titulares, `comprometidos` (bloqueado, con la salida que sea) y `reposicionables` (disponible: su titular lo puede mover). Son las mismas cifras que `yo(…).criterio.posicionado` da por titular, sumadas.
- `epoch.9.0.0` (el 2, el recuento): solo si el criterio del dueño de X dice esa mirada (`view d` en su 2.2, o en su 2 si es una lista; `motor.miradasDe(eje, X)`, la misma lectura que la regla «weight»), su `motor.recuento`: `umbral` (el `above x` del dueño o el de la época), `valor`, `pasa` y `faltan` (umbral − valor, 0 si pasa), en las unidades del recuento (con `cualquiera` y la suma ponderada, P comprometido).
- `epoch.1.2.1` (el 3, los grupos de atención): `precio`, el de la zona del enlace para el **dueño** de X (su autor; su A.3: el de la época o el que ancló en el 3.k.2 de su alta, `set a group price`): `{ zona, grupo, enQue, cuanto, texto }`, con `texto` en el idioma por los textos de la época «legible attention price <en qué>» (`{amount}`, `{owner}`).
- `attended` (el 3, los paquetes): `estados`, uno por ocupante (`lente.estadoDePaquete`): `pendiente` o `atendido` si el ocupante es una petición de atención (devuelve R a su emisor; atendida según la lectura «attended», X.7.4), `perdonado` si quema R de otro emisor, `null` si no es un paquete.

La carta lo pinta en el pie de la celda (`.hijo-pie`, después de `.hijo-cuerpo`): en el 2 la línea «umbral n · faltan m» y los votos (`.hijo-medida`) con una barra (`.hijo-barra`, hacia el umbral si lo hay, si no la parte comprometida de los votos); en el 3 el grupo y su precio (`.hijo-precio`); en la conversación, cada mensaje con su paquete (`.paquete[data-estado]`). **No se da todavía**: el umbral de una decisión sin `view` (es sobre el registro entero y no hay hijo para ella); el que declara la acción «declare capacity or threshold» (un registro anclado en X.2.2, que `recuento` no lee: solo lee el `above x` del payload); «en qué se diferencia» un criterio de sus hermanos (la época no lo define); el estado «rebotado» (el motor rechaza un mensaje sin pago y no queda nada en el libro) y el de un mensaje pagado con E, P o R ajena (la lectura «attended» solo sabe de devoluciones de R).

**La carta** (`carta/carta.js`, `rejillaDe`) pinta la pantalla completa de un PV en las **formas sobrias** que VG aprobó en el mockup del segundo nivel (v3), a partir de la forma del nivel, con una tabla por forma (`FORMAS`: geometría y colocación de las celdas): `cruceta` 2 × 2, las cuatro esquinas, cada una la tarjeta del hijo con una tabla de sus ocupantes legibles (una décupla, una columna por hoja), y el elemento pulsado como **tarjeta central flotante** encima del cruce (`flotante`: `{ X, pv, texto, etiqueta, medida, plantilla, ancla, pasos }`; cara 0 su nombre y su medida, con barra si tiene `de`; cara 5 la plantilla, el ancla y los pasos; ↻ la gira, `data-girar`, solo en pantalla); `escalera` 1 × n peldaños, cada uno un escalón más adentro; `columnas` n columnas, cada una con el **nivel siguiente** dentro (`siguiente`: por cada ocupante que es un registro, sus hijos por `hijosDe` al nivel + 1, con la regla del vacío); `rejilla` 3 columnas (3 × 2 con seis hijos); `conversacion` una columna de mensajes con autor y hora (el ocupante lleva `t`); `matriz` 10 × 10 (los ocupantes del PV por filas, en páginas de matrices enteras, «‹ n de m ›») con sus **ejes** nombrados (`ejes.columnas`: los diez PV como tipo de interacción, `etiqueta` corta; `ejes.filas`: la posición modificada, el nombre de la regla corta a profundidad 1), la **diagonal** marcada (`diagonal`) y el estado de cada celda que es un anuncio (`estado`: «propuesta» si está pendiente, «ejecutada» si ya pasó, por `acciones.estaciones`; el sello, solo CSS); `franjas`, `cielo` y `camino` con bandas. Cada celda de un hijo lleva su dígito (`data-pv`, de él sale el color, `data-color`), su nombre, cuántos tiene y su cuerpo (`.hijo-nombre`, `.hijo-cifra`, `.hijo-cuerpo`), y `data-vacio` si no tiene: entonces el nombre va apagado y debajo **el paso del camino** que lo llenaría (`escribir`: la acción por defecto de su PV, de `acciones.acciones` para quien mira, «escribir aquí · <acción>»). El contenedor (`.rejilla-completa[data-forma]`) va posicionado y aislado y los huecos entre hijos salen de `--hueco`: el animado añadirá capas (fondo, marco, dibujo dentro de cada hijo) sobre este mismo DOM, y **la forma no depende del modelo** (sobrio y animado dan el mismo HTML de la rejilla). **Entrar en un ocupante** que es un registro con algo dentro (un clic, `data-celda`) baja un nivel de profundidad si quedan niveles: la rejilla pasa a ser la de ese registro (`estado.profundidad[pv]`, la lista de registros por los que se ha entrado; el foco no cambia; el `pv` es el del mundo, `data-rejilla`) y **volver** (el botón, `data-subir`, y Esc) sube; en el último nivel, o si el ocupante no tiene nada dentro, la celda ya no entra y su clic abre el registro como siempre (`data-abrir`); en las celdas que entran, un botoncito ↗ abre el registro.

**Las bandas** (en lugar de celdas): las **franjas** del **6 y el 7** son **verticales**, una columna por escala (geometría: una columna por banda y una fila por hilo más la de los nombres), atravesadas por los **cuatro hilos** horizontales de `d.hilos` (`hilos: [{ pv, etiqueta }]`, de arriba abajo; cada banda trae sus `cruces`, uno por hilo). Cada entrada va en la franja de su escala (el paso `escala` de `epoch.9.8` sobre la entrada; el zoom es pasar de escala) y en el hilo del PV de X del que cuelga (`hilo`; si no cuelga de ninguno de los cuatro, en el primero con `hiloSupuesto`); lo que no cabe en un cruce se cuenta en una cuenta mayor con el número (`mas`). Son los ocupantes que son registros; en el pasado (el 6), las entradas del diario (§6); si el PV no tiene ocupantes, lo que cuelga de X (su hilo). En el 6 la más lejana va a la izquierda y la más cercana a ahora (`ahora`) a la derecha; el 7 al revés. Lo que no tiene escala (no quema T) va aparte, en una tira pequeña bajo las bandas. El **cielo** del **8** son las diez cajas en **dos filas** (arriba 0.3 1.1 2.1 3.1 3.2, abajo 4.1 4.2 5.1 5.2 5.3) y pone cada uno en la caja de su cuota (0-9, el paso `cuota`), con la estrella por el nivel de la caja (y borde con el grado 2, halo con el 3, solo CSS); marca la caja de X (`foco`) y trae `cuota` (el paso de X) y `enElFoco` (las posiciones que X tiene escritas); una caja vacía lleva el paso del camino del 8. El **camino** del **9** son primero las diez posiciones nivel.grado para situarse (`camino: true`, en dos filas, con `madurez`, la de X; el núcleo no dice todavía cuáles tiene disponibles un registro ni en cuál está, así que ninguna se enciende y cada una lleva el paso del camino del 9) y, debajo, los pasos del camino y la guía de siempre (`htmlCamino`, `htmlGuia`), plegables.

**En un bloque** (un cuarto o un noveno de la pantalla, §4.1) la misma rejilla se usa **si cabe** (cada celda de 48 px o más, `MEDIDAS.hueco`); si no, la división de §4 (`epoch.8.3`) como hasta ahora. En un bloque no se entra: se sube a pantalla completa.

**Decisiones de Core, pendientes de revisar VG**: que `hilos` sea una posición propia al final de la fila y no una sublista de `lo que mide`; que el 8 lleve en `lo que mide` el nombre del paso (`cuota`) y no solo `hitos`; que el ocupante de un hijo entre solo si lo que hay dentro tiene algo en el mismo mundo (un registro sin ocupantes en ninguno de sus hijos no se baja); los ocupantes de las bandas (los del PV, el diario en el pasado y el hilo si no hay otros) y la tira «sin T»; que `volver` suba un nivel antes de salir de la pantalla completa; que la profundidad es por PV y se olvida al cambiar de registro.

### 4.3 Los dos estilos como datos (VG, 10-11 noche)

El aspecto de un registro y el de lo que hay debajo de él son **datos**, dos textos de CSS en dos posiciones del propio registro (nada que ver con el código de la carta):

| Estilo | Posición | Es |
|---|---|---|
| **propio** | `X.0.9` | representación · cómo: cómo se pinta X |
| **de los de abajo** | `X.5.0` | estructura · qué es: cómo se pintan los hijos de X (en la carta, los elementos de clase `hijo`) |

Una posición puede tener varios ocupantes (la corrección es un escrito nuevo, §3): **gana el último** que sea un estilo. El 5.0 ocupa la misma dirección que el 5 (x.0 es x, colisión por ceros), así que en él conviven con el estilo cosas que no lo son (el nombre de la plantilla en el 5); lo que no pasa por `cssSeguro` no cuenta.

```js
estilo(eje, X, { de: 'propio' | 'hijos', pv, epoca })
// → { css, origen }   origen: 'registro' | 'padre' | 'plantilla' | 'epoca' | null
cssSeguro(texto)
// → el texto saneado, o ""
```

**La cascada** (gana lo más cercano; un texto que `cssSeguro` deja en nada no cuenta y pasa la mano al siguiente): para `propio`, el `X.0.9`; si no, el `0.9` de la plantilla de X (§1); si no, nada: la fila de `epoch.8.7` es de los de abajo y no dice cómo se pinta un registro (`{ css: "", origen: null }`). Para `hijos`, el `X.5.0`; si no, el `5.0` del padre de X (el registro sobre el que se escribió, `sobre`); si no, el `5.0` de la plantilla de X; si no, el «estilo de los de abajo» de la fila de `epoch.8.7` del mundo `pv` donde cuelga X (sin `pv`, no hay época que consultar). El resultado pasa siempre por `cssSeguro`.

**`cssSeguro(texto)`** deja pasar solo declaraciones `propiedad: valor;` de CSS corriente y variables `--x: …`: la lista blanca de propiedades son colores, fondos, bordes, tipografía, espaciado, grid y flex, tamaños y variables (no `position`, `z-index`, `transform`, `content`, `cursor`, `animation`…: nada que saque un elemento de su sitio, tape la pantalla o dispare algo). Un texto con `{` `}` `<` `>` `@` (y por tanto `@import`), barras invertidas o comentarios, `url(` (ni `image-set(`, `src(` y parecidas), `expression(`, `javascript:`, `behavior` o `-moz-binding`, caracteres de control o invisibles, o de más de 2000 caracteres, se rechaza entero (`""`); una declaración con una propiedad fuera de la lista blanca, con un valor que no se entiende o con `!important` se descarta sola y se conservan las demás. Lo que sale son las declaraciones normalizadas, separadas por un espacio.

**Por qué no hay JavaScript como dato.** El libro es compartido: lo que un registro dice en su 0.9 o en su 5.0 lo lee y lo pinta quien mira, y a veces alguien que no es su autor ni ha elegido leerlo. Un estilo es una descripción; un guion es una acción, y ejecutar el guion de otro desde un dato rompería la separación entre lo que dice el libro y lo que hace la máquina de quien lo abre. Tampoco se carga nada de fuera (`url(`, `@import`): un dato no puede hacer que el navegador de otro pida algo a un servidor ajeno. Con estas dos reglas un estilo no puede ni ejecutar código ni salir de su sitio.

**La carta** (`carta/carta.js`, `carta/dom.js`) lleva en el nodo del foco, en el de la rejilla y en cada ocupante que es un registro su `estilo: { propio, hijos }` (cada uno `{ css, origen }`), y `html` emite un `<style data-estilos>` con una regla por estilo no vacío, acotada al registro por su `data-id`: `[data-id="<id>"] { … }` para el propio y `[data-id="<id>"] .hijo { … }` para el de los de abajo. El contenedor de la rejilla y el ocupante que es un registro llevan su `data-id`; cada celda de la rejilla, la clase `hijo`. `dom.js` vuelve a pasar cada texto por `cssSeguro` al emitir (el árbol podría venir de otro sitio) y solo emite un `data-id` que sea un identificador sin más; nada de texto sin sanear llega al `innerHTML`.

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

Las transacciones del subárbol de X (X y lo anclado bajo él, a cualquier profundidad) **por llegada**, cada una con sus **asientos del libro** (lo que de verdad se movió: los movimientos, la asignación del día y la obtención de P, con su primitiva, serie, de, a, cantidad y, si los tiene, salida, clase y etiqueta) y su ancla. Paginado desde un índice o desde un id; `cuantos` por defecto, el paso. Con `opciones.orden` (un orden de `epoch.8.5`; la lista vertical del 6 pide el suyo, `latest`), en ese orden: `instante` por el t de cada transacción, `reverse` al revés; el encaje no ordena transacciones. Sobrio y animado leen las mismas vistas; el animado además este diario, listo para reproducirlo en orden.

```js
diario(eje, X, desde = 0, cuantos = paso())   // → { total, desde, entradas: [{ id, t, autor, movimientos, ancla: { sobre, en } }] }
```

## 7. Mi foco y mi configuración: `yo(eje, identidad)` y `configuracion(eje, yo)`

`yo` es mi alta y sus posiciones, las vistas del encargo 3a leídas con el BQL mínimo: `A.1` la cartera, `A.2` el criterio (2.1 el P posicionado, 2.3 los criterios que adopto), `A.3` los grupos de atención (nombre, zona, precio, quiénes), `A.7` el tiempo gastado hoy por escala (a la fecha `t`; por defecto el reloj del libro).

La **configuración** vive como un registro anclado en **`yo.9`** (el 9 del alta, «cómo: su guía») escrito por mí, cuyo tipo es la plantilla **«preferences»** de la época (`epoch.9.3`): 1 `step` (cuántos por carga; 10), 2 `render` (`sober` o `animated`), 3 `language` (`es`; el canónico de los mensajes, `en`), 4 `sizes` (los pasos de tamaño, 1 2 3), 5 `preferences` (su tipo: B4, el 5 nombra la plantilla, y no es una preferencia: `configuracion` no lo lee) y, del encargo 3c-2b, 6 `model` (el modelo de visualización que la carta consulta primero, §11.2; por defecto `ikisai`). Las etiquetas de la plantilla son las claves de lo que devuelve; sus defectos, las hojas del d.9 menos la ayuda. Sin registro, los defectos; con varios míos, el último; lo que otro ancle ahí no cuenta. Como el 5 exige el 0-4, un registro de preferencias dice todo (y `validar` lo valida con la plantilla); el 6 es opcional.

```js
yo(eje, identidad, { t })   // → { identidad, alta, cartera, criterio: { posicionado, adopta }, atencion, tiempo } o null
configuracion(eje, yo)      // → { step, render, language, sizes, model, de }  (de: el id del registro, o null si son los defectos)
clavesDeConfiguracion()     // → [{ pv, clave, defecto, valores? }]: valores, si su validación es una enumeración («="sober" in it.2 or "animated" in it.2»)
```

Las preferencias de **dos valores** (hoy solo el pintado, `render`: sober o animated) son los **interruptores** de la barra de la carta (VG, 10-11): las dos palabras en el idioma (clave «template preferences param <clave> option <valor>»); tocar la otra escribe la preferencia como lo hace la configuración (un registro más en el 9 del alta) y repinta.

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
| el nombre de una plantilla de cerrado (`epoch.9.0.1`: el criterio por defecto, VG 10-11) | su traducción por «template <nombre>» («todos los movimientos anunciados ocurrieron»); `desdeLegible` la devuelve al canónico | `cerrado` |
| un número, un texto | tal cual (los dígitos no se localizan: el input los devuelve igual) | `valor` |

`desdeLegible(texto, tipo, { eje, idioma })` es la inversa mínima para editar los **tipos simples** (`esTipoSimple(tipo)`: los tipos genéricos de `epoch.9.2.0.1`; una décupla se edita en BTML): un número (con coma o punto decimal), un instante (ISO estricto; un día «AAAA-MM-DD» o «AAAA-MM-DDTHH:MM», como lo da un input, completados en UTC), una identidad por su id o por el 0 de su alta, una referencia por su id o por el 0 de un registro, un nivel o el nombre de una acción o de una plantilla por su traducción, y el texto tal cual; vacío, `{ valor: undefined }`. Devuelve `{ valor }` o `{ motivo }` (el motivo, con los formatos «legible not a number», «… not an instant», «… unknown identity», «… unknown record» de `epoch.9.4`). La carta enseña en el input de cada parámetro el valor legible (y el crudo en un desplegable «ver en BTML»); al enviar, si el texto no se tocó manda el crudo, si el tipo es simple lo lee con `desdeLegible`, y lo demás como antes (JSON si empieza por `[` o `{`).

```js
legible(eje, valor, tipo, { idioma = 'en' })       // → { texto, partes }
desdeLegible(texto, tipo, { eje, idioma = 'en' })  // → { valor } | { motivo }
esTipoSimple(tipo)                                 // → true salvo la décupla
```

**Core, pendiente de revisar VG**: los nombres en español de las 33 acciones y de sus parámetros (`datos/epocas/epoca-0.btml.json`, 9.4.1); que la hora se enseñe en UTC (la del libro); que una referencia con dirección se lea como «<0> · <etiqueta de la posición>»; que un valor que nombra una plantilla («purchase» en el 5) se enseñe traducido («compra») aunque el dato siga en inglés; que la identidad se lea por el 0 de su alta («Alta de huesped»). Los textos propios de la carta (botones, «soy», «configuración», «guardar este rato», «leído») no son de la época: viven en `carta/textos.js`, en un solo objeto por idioma (hoy, `es`), para traducirlos luego por la misma preferencia.

### 8.3 Las opciones de una posición: `opciones(eje, X, pv, { yo, idioma, parametro })` (issue #5)

Lo que se puede escribir en la posición `pv` de X, como `[{ valor, texto }]` (el `texto`, el legible en el idioma), sacado siempre de los datos; vacío si no hay lista (la carta pinta entonces un input libre). La primera fuente que da algo: **(a)** el 5 (B4, el tipo) lista las plantillas que hay; un tipo `ref` que nombra una plantilla (`["ref", "purchase"]`), los registros del eje de esa plantilla; `identity`, las identidades del eje; **(b)** una enumeración de la época: la que escribe la validación (`="a" in it.N or "b" in it.N`, como el pintado; un rango de diez enteros como mucho, `=it >= 0 and it <= 9`, como los dígitos), los niveles de `epoch.8.4` si el tipo es `level`, los idiomas de los mensajes (`epoch.9.4`) en la preferencia que tiene uno de ellos por defecto, los modelos de `epoch.9.7` en la preferencia que nombra su cabecera (`epoch.9.7.0.5`) y, en un parámetro de una acción, la lista de la que su defecto `=first …` toma el primero; **(c)** lo ya escrito en esa posición en los registros hermanos (mismo padre, misma plantilla), sin repetir y sin fórmulas. Un tipo que no es simple (una décupla) no tiene lista. Con `parametro` (uno de `acciones.parametros`, con `en`: la dirección donde anclará el registro que escribe la acción) son las de ese parámetro de una acción sobre X; la carta las pinta en el formulario como un desplegable con «otro…». Lo que la época declara pero ninguna posición enlaza (las escalas de T, `epoch.1.3.1`; los seis grupos de atención, `epoch.1.2.1`) no sale; los niveles y grados de las cajas del 8 no están en la época (`src/bases.js`, `HITOS`).

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

Para el **elemento** (VG, 11-11), lo que la carta da de cada celda de un mundo a pantalla completa → el nombre del elemento que se dibuja en ella; una fila por dado, cuyas claves se **emparejan una a una con sus mundos** (`[[hijo], [tienda, parterre, estanque, estacion, constelacion, hito], [1, 2, 3, 4, 8, 9]]`: una fila con varias claves y tantos mundos como claves; una décupla no pasa de diez filas):

| Dado | Qué es | Mundo → elemento |
|---|---|---|
| `hijo` | el contenedor de un hijo con ocupantes (una celda, una banda con algo) | 1 `tienda`, 2 `parterre`, 3 `estanque`, 4 `estacion`, 8 `constelacion`, 9 `hito` |
| `ocupante` | cada unidad que ocupa un hijo | 1 `mercancia`, 2 `flor`, 3 `paquete`, 4 `pieza`, 6 `cuenta-pasado`, 7 `cuenta-futuro`, 8 `estrella`, 9 `paso` |
| `vacio` | un hijo sin ocupantes | 8 `polvo` (en los demás, nada: queda como en sobrio, apagado) |
| `actual` | la posición donde está el foco | 9 `puerta` |
| `hecho` | lo ejecutado (la estación ejecutada de la matriz) | 4 `sello` |
| `repetido` | lo que vuelve en su ciclo | 6 `cuenta-ciclo` |
| `persona` | un ocupante que es una persona (`eje.esPersona`) | 3 `bano` |
| `cerrado` | lo cerrado | 3 `verja` |

`corresponde(cabecera, 'elemento', dado, pv)` da el nombre; sin fila en ese mundo da lo dado tal cual y la carta no dibuja nada. La pieza se pide por ese nombre (`rol`) al paso del mundo (la clave de su etapa). Hoy el núcleo no da `actual` (nada asigna nivel ni grado al foco), `repetido` ni `cerrado`: esas filas están y no se usan hasta que lo dé.

**Un modelo por nivel o el nivel en la pieza** (Core, etapa 5): el nivel va en la pieza, como su tamaño mínimo (`[1, "svg"]` sello, `[2, …]` intermedio, `[3, …]` ilustrado), y los tres conviven en `ikisai`. Es lo que `pieza(…, { tamano })` ya hacía («la de mayor tamaño mínimo que quepa»): en el hueco responde el sello, en la tarjeta el intermedio, en la pantalla el ilustrado donde lo hay y el intermedio donde no; un mundo sin sello no responde en el hueco y cae al siguiente modelo. Tres modelos encadenados por nivel habrían exigido repetir el encadenamiento en la cadena de la época y en la preferencia `model`, y el respaldo entre niveles ya lo da el tamaño.

### 11.2 El respaldo en cadena

`modelo(eje, yo)` devuelve la lista de modelos a consultar, en orden: el que nombra la configuración de `yo` (la preferencia `model` de «preferences», `epoch.9.3.6`; la cabecera dice dónde está, `epoch.9.7.0.5`: un nombre de la época, o el id de un registro del eje que sea un modelo: §11.5), luego los de la cadena de la época (`epoch.9.7.0.2`: `ikisai`, `animado-generico`, `sobrio`), sin repetir. Por defecto `model` es `ikisai` (el interruptor «animado» de la barra enseña el arte sin pasar por Configuración; en sobrio ningún modelo pinta nada, `ctx.animado` manda), así que la cadena de quien no ha elegido es `ikisai → animado-generico → sobrio`; **el sobrio va siempre al final**: el modelo sin ninguna pieza con recurso es el respaldo por definición, y quien nombra `sobrio` tiene la misma cadena `ikisai → animado-generico → sobrio` (#3: así «animado» siempre encuentra el arte). Un nombre que no existe no rompe la cadena. En la configuración, «modelo» es un desplegable con los modelos de la época que tienen recursos (`eleccionDeModelo`: hoy `ikisai` y `animado-generico`, en el orden de la cadena; el sobrio no), `ikisai` por defecto; con uno solo no se pregunta y se guarda ese (#4).

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

**A pantalla completa (Mapped), el animado son capas sobre el sobrio** (VG, 11-11: «el animado es el sobrio añadiéndole las imágenes animadas y los fondos»). La rejilla del mundo (§4.2) es la misma en los dos renders; `capasDeRejilla` (`carta/carta.js`) solo le añade, en animado, `r.capas` (fondo, etapa, marco, personaje y su dibujo quieto, efectos sin hijo), `capa` en cada celda o banda (el dibujo del hijo, uno por ocupante, el sello de lo hecho, los efectos de lo que cuelga de ese hijo por `pvDondeCuelga`) y `dibujo` en los ocupantes de las bandas; `carta/dom.js` los pinta como nodos de clase `capa`, todos absolutos (dónde, CSS por `data-forma`): de abajo arriba, el **fondo** del mundo (por la madurez del foco, a toda la superficie sin deformar, atenuado; las celdas pasan a fondo translúcido), la **etapa** del pulsado (por su madurez: en la cruceta dentro de la cara 0 de la tarjeta central, detrás del nombre y la cifra; en las demás formas, pequeña en la cabecera), el **dibujo** de la correspondencia dentro de cada `.hijo-cuerpo` (escala con la cifra del hijo entre 0,6 y 1,4; el nombre y la cifra se visten de cartel solo con CSS), el **personaje** del rol por defecto en el hueco entre celdas (`esperar` en bucle, `actuar` con lo nuevo; si Lottie no carga, su pieza `*` quieta), los **efectos** de lo nuevo y el **marco** del mundo (cada esquina, la del dibujo sin deformar, y una línea del color del mundo entre ellas). Quitar del HTML animado todo nodo `.capa` da exactamente el sobrio, en los ocho mundos y en el nivel 2 del 1, el 2 y el 3, y las cajas de cada hijo, de la tarjeta y de la rejilla miden lo mismo (`test/animado-capas.test.js`; Playwright, 1920 × 1080 y 1366 × 768). Con «reducir movimiento», `trasPintar` no reproduce nada.

**En los bloques y las tarjetas de Mapped, y en el centro, igual** (VG, 11-11, #16: el marco flotaba como una figura encima del contenido). El PV en tarjeta o en bloque es el sobrio más nodos `.capa`, absolutos: el **fondo** del mundo atenuado detrás de todo (solo en bloque), la **etapa** pequeña en la cabecera a la derecha del nombre, el **dibujo** del mundo en cada hijo de su rejilla (`capasDeRejilla` con `personaje: false` y `efectos: false`) o, en una lista, el elemento de cada ocupante como capa, lo nuevo encima del bloque entero y el **marco** abrazando el borde (sus esquinas sin deformar y la línea del color del mundo, a 4 px del borde; en una celda muy baja del móvil, solo la línea). **Sin personaje** (solo a pantalla completa). El centro lleva el marco de la misma manera. Nada cambia de sitio ni de medida (Playwright: las cajas de todo lo que no es capa, iguales en sobrio y en animado a 1366 × 768, 844 × 390 y 1920 × 1080); Sequenced sigue con su escenario.

## 12. Acciones: el aro, la transacción y el camino

Encargo 3c-2a (VG, tras 3b-bis). La mitad de acción del contrato, `src/acciones.js` (exportado como el espacio de nombres `acciones`). Principio (VG): nada hardcodeado en la pantalla ni negocio en JavaScript que pueda ser una regla o un dato de la época; **la carta solo lista y lanza lo que el núcleo le da**. Pruebas: `test/acciones.test.js`; la carta de texto (`test/carta-texto.mjs`, `pintarPara`) pinta el aro y el camino para quien mira.

**La carta pinta el aro como ocho sitios en la matriz 3 × 3 sin centro alrededor del elemento pulsado** (mockup v3): cada sitio es el de su PV (`celda` = `GEOMETRIA[pv].celda`, data-fila y data-columna en el DOM), en el color de su PV, con la acción por defecto de `acciones.acciones(eje, X, pv, yo)` y, al volver a pulsar el sitio («+N» o clic derecho), las alternativas como una columna pegada al chip; un sitio sin acciones va apagado. Con el aro abierto, las teclas 1-4 y 6-9 lanzan la acción por defecto de ese sitio y Esc lo cierra. El árbol (`nodoAro`) no sabe de píxeles: en Mapped la app (`carta/app.js`, `situarAro`) lo ancla al elemento con un `position: fixed` calculado de su `getBoundingClientRect()` al abrirlo (que `carta/gestos.js` pasa como ancla) y recortado a la ventana; en el móvil apilado sigue centrado.

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
3. **Las sugerencias** (`fuente: 'sugerencia'`): un gancho opcional, `sugerencias(eje, X, yo) → [{ plantilla, parametros, sobre?, porque?, id?, invalida? }]`, sin LLM aquí; cada una se construye y se valida con `transaccion` y queda marcada (`pasa`, `motivos`). `sobre` es otro registro que X (por defecto, X), `porque` y `id` salen en el paso (`porque`, `propuesta`) y una con `invalida` (el motivo) no se construye: sale como paso inválido (`hacer: null`, `invalida`), no se descarta en silencio. La salida externa del PV9 (§16.6) es quien lo usa.

Si la madurez de X es 0 o desconocida, devuelve además `niveles` (los de su plantilla o los de `contrato.niveles()`). Orden: primero lo que nombra el criterio del dueño (`X.2.3`), luego lo que nombra el mío (el 2.3 de mi alta), luego el resto.

`autoejecutar` construye y lanza los pasos míos en orden mientras pasen: cada uno con `transaccion` (firmado con `firmar(evento)`, lo que la carta sepa firmar, antes de validarse) y asentado con `eje.anadir`; se detiene en el primero que no pasa: `{ hechos: [{ paso, evento }], parado: { paso, motivos } | null }`. En la reserva abierta de Booking, la huésped paga y la casa entrega las tres plazas por el aro, y la reserva queda cerrada (`test/acciones.test.js`).

### 12.6 El tutorial del alta

Sale de los datos, sin código especial: el 9 de la plantilla de identidad (`epoch.3.0.9`) lista «a key is declared at its alta» (la regla: la clave se declara en el alta misma, así que el paso solo dice si está), «set a group price» (los grupos de atención) y «anchor here» (el primer registro). `autoejecutar` sobre un alta nueva pone el precio de su primer grupo y se para en el primer registro, que pide un título.

### 12.7 Opiniones como registros: la plantilla «opinion» y `opiniones(eje, proyecto)`

Encargo de VG (PV9, tanda 2): «que el feedback que yo lance se ancle en el proyecto AGRAM dentro de AGRAM y tú puedas leerlo». Cada opinión de «opinar» (`carta/opinar.js`) puede escribirse además como un registro del eje; sin el ajuste, todo sigue como hoy (solo local + exportar).

- **La plantilla de dominio «opinion»** (`epoch.9.2.4`, detrás de «purchase», «booking» y «guide settings»), como cualquiera: 0 `opinion` el texto; 1 `classification` la clasificación del nodo como ocupantes «etiqueta: valor» (`type`, `pv`, `d`, `size`, `representation`, `mode`, `width`, `render`: las etiquetas, en el placeholder de la posición); 2 `criteria` y 4 `actions` los que escribe todo «anchor here»; 3 `who` quién opina; 5 `type` = `opinion`; 6 `about` la referencia `{ ref }` al registro opinado (el que se tocó o, si no era un registro, el que estaba en foco); 7 `version` la versión de la carta (la `VERSION` de `sw.js`); 8 `seen` lo que enseñaba lo tocado (hasta 80 caracteres); 9 `route` los tipos de los ancestros del nodo, del más lejano al más cercano. Etiquetas y ayudas en es y en por las claves de siempre (`template opinion param … label | help`). **Decisión de Core**: una posición nunca queda vacía en BTML, así que la ruta (9) obliga a escribir 6, 7 y 8; por eso la versión y lo visto son la 7 y la 8 (y no ocupantes de la 1), se rellenan con «-» las que falten y, sin registro al que referirse, no se escribe lo de detrás del 5.
- **`anchor here` lleva cinco parámetros opcionales nuevos**: `type` (5), `about` (6), `version` (7), `seen` (8) y `route` (9), sin defecto: un «anchor here» corriente no los escribe. Es lo que permite que una opinión sea «anchor here» con la décupla de la plantilla (la carta pone cada valor por la `posicion` del parámetro, no por su nombre).
- **El ajuste «opinions anchor»**: la posición 6 de la plantilla **«guide settings»** (§16.2; la de «preferences» tiene las diez llenas y una plantilla hermana habría pedido otro registro y otro formulario por un solo campo). Texto, sin defecto: el id (o los ocho primeros caracteres, o el 0) del registro del proyecto AGRAM, que VG crea con «anclar aquí» sobre su alta; `-` lo quita. `contrato.anclaDeLasOpiniones(eje, yo)` lo lee; `acciones.proyectoDeOpiniones(eje, yo)` lo resuelve a un registro (`acciones.registroDe(eje, texto)`: id entero, prefijo único de ocho o más caracteres, o el 0). `carta/guia.js` `ajustes()` lo da como `ancla` solo si está.
- **Escribir**: con el ajuste y un registro que exista, cada opinión guardada se escribe como la transacción «anchor here» (el nombre de la plantilla y el de la transacción los dice la guía de la época, posiciones 7 y 8 de `epoch.9.9`) sobre ese registro: `acciones.transaccion` (las reglas) + la firma + `eje.anadir`, y quema su T de minuto como todo registro (`carta/externa.js`, `anclarOpinion`). Si falla (sin T, reglas, el registro no existe, sin clave), la opinión queda solo en local y la cajita lo dice («solo en local: …»).
- **Leer**: `acciones.opiniones(eje, proyecto)` → `[{ id, autor, t, texto, clasificacion, sobre, ruta, respuestas: [{ id, autor, t, texto, respuestas }] }]`: los registros `opinion` anclados bajo ese registro, con sus respuestas (lo anclado debajo de cada una, en hilo). La carta las lista en el 6 (pasado) del proyecto (con cuántas respuestas lleva cada una) y quien lea el eje desde fuera (Be) las lee con la misma función, sin código especial. Responder a una opinión es «anchor here» sobre ella.

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
- **Los órdenes**: `epoch.8.5` (una entrada de la época, no una lectura); el d.8 de la plantilla manda sobre el 2.3 del dueño y este sobre el defecto; `arrival`, `newest`, `latest`, `soonest` y `fit`; las listas verticales del 6 y el 7 piden el de su fila de `epoch.8.7` (#18).
- **La madurez**: `X.8.1` para el nivel y `X.8.6` para la medida; la suma posiciones + profundidad + órdenes de la cantidad; los diez nombres de los niveles por posición; los cinco niveles de «booking» y el reparto proporcional de los niveles de un tipo sobre los genéricos.
- **Las preferencias**: en el 9 del alta; sus cuatro campos y sus defectos (`sober`, 10, `en`, 1 2 3).
- **Los mensajes**: una hoja «regla: texto» por regla en el registro del idioma; `en` como canónico.
- **El libro local** (§10): el reparto del minuto por la cruceta (1 cuántas, 2 el hash, 4 las acciones, 5 lo anterior, 6 el recorrido entero, 7 la escala), la primera ancla en el alta, el `t` del minuto, y que las interacciones solo sean sobre registros que el eje tiene.
- **Los modelos** (§11): las piezas como registros referenciados o anclados (no ocupantes inline, por el tope de diez); la forma de la pieza (0 tipo, 1 tamaño y formato o forma, 2 clave, 3 orientación, 4 repetición y fotogramas, 5 mundos, 6 recurso); la cabecera de `epoch.9.7.0` (niveles, cadena, orientaciones, tipos y sus claves, la preferencia, los formatos animados, loop/once, el múltiplo diez); que `model` valga `ikisai` por defecto y la cadena no repita; que la orientación de respaldo se busque en el mismo modelo antes que en el siguiente; que el 5 de «preferences» (el tipo) esté descrito en la plantilla para que exista el 6, y que `configuracion` no lo lea; el hueco `epoch.9.6` reservado al encargo 3c-2a.
- **Los pasos** (§11.4): las cuatro filas de `epoch.9.8` y sus nombres en español; que la cuota del 8 sea la de la serie en que más pesa; que el ciclo cuente anuncios cumplidos sobre anunciados (y 0 de 0 sin anuncios); que el `de` de la cuota y de la escala sea el número 10 escrito en la tabla (una décupla cuenta como un ocupante en el BQL mínimo, así que no se pueden contar sus posiciones).

## 14. Cuentas: entrar como uno mismo

Etapa 2 del roadmap hasta el MVP (tras la carta v1): VG entra en AGRAM como VG y no como una identidad de ejemplo. `carta/cuentas.js` (sin DOM; pruebas en `test/cuentas.test.js` con el WebCrypto de Node) y `carta/app.js` (la pantalla de arranque, el selector «soy», la copia). Nada de servidor: eso es la etapa 3, el libro compartido.

**Qué es una cuenta.** `{ nombre, idioma, identidad, alta, publica }`: un eje propio cuyo **génesis es mi alta**, escrita por mí (una persona, B1) con mi nombre en su 0, mi clave pública declarada en su 5 (B4: `contexto.claves`) y firmada con la privada. Lo construye el núcleo tal cual, `Eje.genesis({ identidad, foco: nombre, clave, privada })`: el génesis es la única alta sin invitación (la regla «a person joins by an invitation»), referencia la época 0 y no es un eje de demostración, así que rige «sin clave no se actúa» y todo lo que escribo va firmado (`who has a key signs`). La **identidad** sale del nombre (minúsculas, sin acentos, guiones: «Víctor Gil» → `victor-gil`; si no queda nada legible, la huella de la clave); el nombre entero es el 0 del alta y es lo que `legible` enseña. El **idioma** es mi configuración: si difiere del de la época, un registro «preferences» en el 9 de mi alta (`carta/carta.js` `preferencias`, §7), firmado; con el idioma de la época, nada. Los campos que pide crear la cuenta los da el núcleo (`cuentas.camposDelAlta({ idioma })`): la etiqueta, la ayuda y el marcador del 0 de un registro sin plantilla (la regla corta de la época) y la posición del idioma de la plantilla «preferences» (`contrato.texto`, con los idiomas que tienen mensajes, `contrato.idiomas`).

**Qué guarda la carta y cómo.** Por cuenta, en localStorage, sin mezclarse con los ejemplos (que siguen en `agram.eje`, `agram.claves`, `agram.foco`, `agram.yo`, `agram.ejemplo` y `agram.local.<yo>`; las claves de unos y otras están en `cuentas.CLAVES` y `cuentas.CLAVES_EJEMPLO`, y la prueba comprueba que no se cruzan):

| Clave | Qué |
|---|---|
| `agram.cuentas` | la lista de mis cuentas: nombre, idioma, identidad, id del alta y clave pública (nunca la privada) |
| `agram.cuenta` | la última usada: el id de su alta, o `ejemplo` si lo último fue un ejemplo |
| `agram.eje.<alta>` | su eje serializado (`persistencia.serializar`) |
| `agram.clave.<alta>` | su clave privada exportada como JWK, igual que las de las identidades de ejemplo en `agram.claves` (sin cifrar dentro del navegador; solo la frase de la copia la cifra al salir de él) |
| `agram.local.<alta>.<yo>` | el libro local de quien mira en esa cuenta |
| `agram.sync.<alta>` | su clave de lectura del libro compartido (§15.8): un secreto, nunca en el eje |
| `agram.sync.estado.<alta>` | el estado de su sincronía (`Sincronia#serializar`: la cola, los órdenes del servidor, lo rechazado; sin la clave de lectura) |

Al abrir la carta: si lo último fue una cuenta, se entra en ella (`abrirCuenta`: el eje se revalida al restaurarlo y se comprueba que declara para mi identidad la clave pública de la cuenta); si lo último fue un ejemplo, en el ejemplo; si nunca se eligió nada, la pantalla de arranque: **crear mi cuenta**, **restaurar una cuenta** (desde su copia) o **probar con un ejemplo**. El selector «soy» lista mis cuentas y, aparte, los ejemplos (en una cuenta, la opción de probar con uno; en un ejemplo, sus identidades), y crear o restaurar. Tras crear, el foco es mi alta con el camino (el PV de la cruz de abajo) abierto: el tutorial del alta (§12.6, un dato de `epoch.3.0.9`) dice que la clave ya está declarada y que faltan el precio de un grupo de atención y el primer registro; «seguir» pone el precio y se para en el registro, que pide un título. «Olvidar esta cuenta» borra de este navegador su eje, su clave y sus libros locales (con confirmación; sin copia no se recupera). «Reiniciar» solo existe en los ejemplos y no toca las cuentas.

**La copia de seguridad y la restauración.** `exportarCuenta({ cuenta, eje, privada }, frase)` → un archivo `agram-cuenta-<nombre>.json` (`<a download>` con un blob: es GitHub Pages, no un artefacto):

```json
{ "formato": "agram-cuenta", "version": 1, "exportado": "<instante>",
  "nombre": "…", "idioma": "es", "identidad": "…", "alta": "<id del alta>", "publica": { "kty": "EC", "crv": "P-256", "x": "…", "y": "…" },
  "clave": { "kdf": "PBKDF2", "hash": "SHA-256", "iteraciones": 600000, "sal": "<base64, 16 bytes>", "cifrado": "AES-GCM", "iv": "<base64, 12 bytes>", "datos": "<base64: el JWK privado cifrado>" },
  "eje": { "version": 3, "exigirFirmas": false, "eventos": [ … ] } }
```

La clave privada va cifrada con la frase (PBKDF2 con sal aleatoria y 600 000 iteraciones → AES-GCM de 256 bits, con el id del alta como dato asociado: el cifrado no vale con otro alta); la frase no se guarda en ningún sitio y la carta pide que se repita (ocho caracteres como mínimo: una comodidad de la pantalla, no un dato de la época). En claro solo van el nombre, el idioma, la identidad, el id del alta, la clave pública y el eje (público por naturaleza). El eje exportado es una **foto**: sin libro compartido, lo que se haga después en un dispositivo no aparece en el otro; con él (§15.8), el otro dispositivo baja el resto al restaurar. La interfaz lo dice. `restaurarCuenta(archivo, frase)` descifra, importa la clave, comprueba que es la pareja de la pública, restaura el eje con `persistencia.restaurar` (cada evento vuelve a pasar por las reglas: ids, firmas, saldos) y comprueba que el eje declara esa clave para la identidad en su alta; la frase incorrecta y un archivo tocado dan el mismo motivo, sin pistas. Si la cuenta ya estaba en este navegador, la copia la sustituye y la carta lo dice. Con el libro compartido (§15.8), la copia lleva además la **clave de lectura dentro de lo cifrado** (lo cifrado es entonces `{ privada: JWK, claveLectura }`; sin ella, el JWK tal cual, como siempre: una copia sin clave de lectura sigue valiendo) y restaurar la repone; si la foto trae el servidor y el eje compartido en su configuración, el eje se baja del servidor.

**Qué es dato de la época y qué no.** Del núcleo y de la época: cómo se construye el génesis, qué reglas lo aceptan, dónde va la clave (el 5) y el idioma (el 9 del alta), las etiquetas del formulario de crear, el tutorial del alta y los idiomas disponibles. De la carta (sus textos, `carta/textos.js`): los nombres de los botones, el mínimo de la frase, el nombre del archivo y el mapeo de claves de localStorage. Nada se añadió a la época: el tutorial de `epoch.3.0.9` ya cubría el alta nueva (la clave, el precio de un grupo, el primer registro con «anchor here»). Seguridad: nada real en el repositorio (ninguna cuenta ni clave de ejemplo se escribe en archivos; las pruebas generan las suyas), la privada nunca sale del navegador sin cifrar, y lo restaurado no se da por bueno.

## 15. El libro compartido: `Sincronia({ url, eje, claveLectura })`, `subir`, `bajar`, `sincronizar`

Etapa 3 del roadmap (mapa §17 [D], VG: «estoy de acuerdo con tus 2 recomendaciones»): un único eje accesible desde el móvil y el ordenador. Decisiones: se aloja en la nube de Ikisai, que es **Supabase**, en un **proyecto aparte para AGRAM**; el eje es **privado con clave de lectura**; se escribe solo con eventos **firmados por una identidad con alta en el eje**; **el servidor no valida reglas**: guarda, ordena por llegada y da la hora. **Nada está desplegado**: el proyecto Supabase no existe aún; lo que hay es la migración y la función listas (`servidor/supabase/`), un servidor de prueba en Node con el mismo contrato (`servidor/prueba/servidor.mjs`) y el cliente (`src/sincronia.js`, espacio de nombres `sincronia`), probados entre sí (`test/sincronia.test.js`, `test/servidor-prueba.test.js`, `test/paridad-funcion.test.js`). Cómo desplegar y crear el primer eje: `servidor/LEEME.md`. La carta ya lo usa: §15.8 (la especificación de entonces queda como registro en `carta/sincronia-ui.md`).

### 15.1 El contrato HTTP

Todo cuelga de una base `url` (`https://<ref>.supabase.co/functions/v1` en Supabase, donde la función se llama `eventos`; `http://127.0.0.1:8787` con el servidor de prueba). JSON en los dos sentidos; los errores, `{ error }`.

| Petición | Qué hace | Respuestas |
|---|---|---|
| `POST {url}/eventos/ejes` con `{ eje }` | crea un eje y genera su **clave de lectura**, que devuelve **una sola vez** (guarda solo su hash SHA-256). Protegido: `Authorization: Bearer <clave de servicio>` o `X-Crear-Ejes: <AGRAM_CREAR_EJES>`. El servidor de prueba responde también en `POST /ejes` | `201 { eje, claveLectura, creado }`; `400` nombre inválido (`[a-z0-9][a-z0-9._-]{0,63}`); `401`; `409` ya existe; `503` crear ejes deshabilitado |
| `POST {url}/eventos` con `{ eje, evento }` y `X-Clave-Lectura` | guarda un evento. Comprueba la forma, que `id` = SHA-256 del cuerpo canónico y que la firma verifica con la clave del **alta** del autor (el primer evento del eje que la declara en `contexto.claves`); en un eje vacío solo entra un génesis firmado por sí mismo. **Idempotente**: el mismo id devuelve su orden | `201 { orden, recibido }`; `200 { orden, recibido, duplicado: true }`; `400` forma, id o firma; `401` clave de lectura; `403` autor sin alta; `404` eje; `413` cuerpo > 256 KB; `429` más de 60 escrituras por minuto en el eje |
| `GET {url}/eventos?eje=…&desde=<orden>&cuantos=<≤500>` con `X-Clave-Lectura` | los eventos con `orden > desde`, por llegada, paginados (500 por defecto) | `200 { eventos: [{ orden, recibido, evento }], siguiente }` (`siguiente`: el `desde` de la página siguiente, o `null`); `400`, `401`, `404` |
| `OPTIONS` | CORS: `https://agram.ikisai.com` y `http://localhost:*` | `204` |

`orden` es el número de llegada (un `bigserial`: crece en todo el servidor, no por eje; solo importa su orden) y `recibido`, la hora del servidor al guardarlo. La tabla `eventos` es de solo añadir: clave primaria `(eje, id)`, índice `(eje, orden)`, un disparador que impide UPDATE, DELETE y TRUNCATE a cualquier rol, RLS activo **sin políticas** para `anon`/`authenticated` (todo pasa por la función con el rol de servicio: una política de lectura anónima dejaría leer el eje entero con la clave anónima, que es pública, saltándose la clave de lectura). La tabla `ejes` guarda `eje`, `clave_lectura_hash` y `creado`.

### 15.2 Qué valida quién

- **El servidor** (`servidor/supabase/funciones/eventos/verificar.js`, sin el núcleo; en el servidor de prueba, el núcleo mismo): solo la **forma**: los campos, el hash y la firma del autor con la clave de su alta. Ni movimientos, ni payload, ni `t`, ni posesión, ni reglas. Un génesis sin clave declarada (un eje de demostración) no se puede compartir.
- **El cliente** (`sincronizar`): cada evento bajado pasa por `eje.anadir` con las reglas enteras. Lo que no pasa va a **`rechazados`** (`{ id, motivo, de: 'reglas' }`), se recuerda para no volver a intentarlo y **no rompe la sincronización**: lo siguiente entra igual.

### 15.3 La cola

Lo pendiente es lo que el eje local tiene y el servidor no (`pendientes(eje)`: no hay que encolar a mano). Se sube **en orden de entrada**, porque cada evento depende de los anteriores. Sin red (`SinRed`: el `fetch` falla), nada lanza: el primer pendiente queda en `cola` con `intentos` y `proximo` (espera creciente: 1 s, 2 s, 4 s… hasta 5 min), y hasta ese instante no se reintenta ni él ni lo de detrás. Un rechazo del servidor (`ErrorDelServidor`, con `estado`) se anota en `rechazados` con `de: 'servidor'` y en la cola con su `error`, y espera igual: lo de detrás depende de él, así que no se salta. `serializar()` → `{ version, url, eje, desde, ordenes, recibidos, cola, rechazados }` (**sin la clave de lectura**) y `Sincronia.restaurar(datos, { claveLectura })`: la cola sobrevive a recargar, como el eje.

### 15.4 La reconciliación del orden

No hay conflictos: todo evento válido se acepta **en orden de llegada al servidor**, y ese es el orden que vale. El orden local puede diferir (lo escrito sin red va, en local, delante de lo que otro dispositivo subió antes). `sincronizar` lo nota al bajar: si lo local ya va en el orden del servidor y todo lo nuevo llega detrás, añade por detrás (`eje.anadir`); si no, **`eje.reordenar(lista)`**: el eje se reconstruye en el orden del servidor, con lo nuevo en su sitio y **lo pendiente de subir detrás**, volviendo a validar cada evento como al restaurar; lo que en ese orden deja de pasar las reglas (otro dispositivo gastó antes lo mismo) va a `rechazados` (`de: 'reorden'`) sin lanzar. El eje adopta el resultado **en sitio** (el mismo objeto, con sus índices y su libro reconstruidos), así que quien lo tenía sigue teniéndolo; el informe lo dice (`reordenado: true`). El prefijo de la versión 2 de persistencia no se reordena. Un eje local cuyo génesis no es el del servidor no se mezcla: `errores` lo dice y nada se sube.

### 15.5 El reloj de los demás

El `recibido` del servidor es la hora a la que los demás vieron cada evento. Entra en el eje con **`eje.marcarReloj(instante)`** (se queda con el mayor; no toca ningún evento, así que ningún id cambia) y las reglas lo leen donde ya leían el reloj de los demás: **`before.6.3`** (`eje.tMaximo(excluidos)`, el mayor t de quienes no son el autor de la candidata: SEG-05), sin tocarlas. No entra en `before.6.0`, el mayor t del libro: eso son los eventos. `Sincronia.marcarReloj(eje)` lo vuelve a marcar tras restaurar.

### 15.6 Privacidad

Leer exige la clave de lectura del eje (`X-Clave-Lectura`; el servidor compara su hash); escribir también, y además la firma del autor con la clave de su alta. La clave de lectura **no va en el eje** (el eje se comparte): vive en el almacén local del dispositivo, por cuenta (`agram.sync.<alta>`, §15.8), y sale de él solo cifrada, en la copia de seguridad (§14). Ningún secreto en el código: la función lee todo de `Deno.env`; las credenciales, en `PROD/ikisai-apps/private/`.

### 15.7 Configuración

La plantilla «preferences» (§7) tiene dos posiciones más: **8 `sync url`** (la base del servidor) y **9 `sync ledger`** (el nombre del eje), de texto, sin defecto (sin valor, el eje vive solo en el dispositivo), con etiqueta y ayuda en español en `epoch.9.4` («servidor», «eje compartido»). `configuracion(eje, yo)` las devuelve como `'sync url'` y `'sync ledger'` (los nombres están en `sincronia.CONFIGURACION`); `sincronia.destino(eje, yo)` las lee y da `{ url, eje }` (la url, http o https, sin la barra final) o `null` si falta alguna o la url no es una url. `contrato.clavesDeConfiguracion()` da todas las preferencias de la plantilla, `[{ pv, clave, defecto }]`, también las que no tienen defecto: es lo que pinta el formulario de la carta. Como BTML no tiene posiciones vacías, un registro de preferencias sin servidor acaba en el 7 (y uno con eje compartido pero sin servidor, también: sin servidor no se comparte nada).

<!-- comprobar: fragmento -->
```js
import { sincronia, contrato } from './src/index.js';
const c = contrato.configuracion(eje, 'vg');                       // c['sync url'], c['sync ledger']
const S = new sincronia.Sincronia({ url: c['sync url'], eje: c['sync ledger'], claveLectura });
const informe = await S.sincronizar(eje);                         // → { bajados, anadidos, rechazados, subidos, pendientes, reordenado, sinRed, errores }
const { eje: nuevo } = await S.sincronizar(null);                 // sin eje local: nace del génesis del servidor
guardar(S.serializar());                                          // la cola, con el eje; la clave de lectura aparte
```

### 15.8 En la carta

`carta/sincronia.js` (sin DOM; pruebas en `test/carta-sincronia.test.js` contra el servidor de prueba) y `carta/app.js`. **Solo las cuentas sincronizan**, y solo con las tres cosas: `sync url` y `sync ledger` en su configuración (el formulario de configuración las pinta, como las demás preferencias: «servidor», «eje compartido») y la **clave de lectura** en este navegador, en un campo aparte del mismo formulario que lee y escribe `agram.sync.<alta>` (sin `name`: no entra en el registro de preferencias, que va en el eje). Los ejemplos no tienen cuenta ni clave de lectura: no sincronizan nunca.

| Cuándo | Qué hace la carta |
|---|---|
| al entrar en una cuenta (abrirla, crearla, restaurarla) | `sinc.abrir`: la `Sincronia` restaurada de `agram.sync.estado.<alta>` (si es del mismo servidor y eje; si no, una nueva), `marcarReloj(eje)`, y sincroniza sin esperar: pinta ya con lo local |
| tras cada escritura (un formulario, un campo, «seguir» con `autoejecutar`, «guardar este rato» con `englobar`) | `guardar()` (el eje, el libro local y el estado de la sincronía) y sincroniza sin esperar |
| al guardar la configuración | guarda la clave de lectura en el almacén y vuelve a abrir la sincronía (el servidor, el eje o la clave pueden haber cambiado) |
| al volver la red (`online`) y cada 30 s con la pestaña visible | sincroniza (la espera creciente de la cola decide si toca reintentar) |
| restaurar una copia que lleva clave de lectura y, en su foto, el servidor y el eje compartido | `sinc.ejeDelServidor`: `sincronizar(null)` crea el eje desde el génesis del servidor, si es el de esta cuenta (su alta con su clave) y el de la foto; lo de la foto que el servidor no tiene va detrás, pendiente de subir. Si no se puede (sin red, otra clave, otro eje, o el servidor aún vacío), se dice y se sigue con la foto, como antes |
| abrir una cuenta cuyo eje no está en este navegador, con clave de lectura y el estado de su sincronía | lo mismo, sin foto; si no se puede, la cuenta no se abre, como antes |
| cambiar de cuenta, o ir a un ejemplo | la sincronía de antes se suelta (lo suyo ya quedó guardado) y se abre la de la nueva cuenta |
| olvidar la cuenta | borra también `agram.sync.<alta>` y `agram.sync.estado.<alta>` |
| reiniciar (solo en los ejemplos) | no toca ninguna cuenta |

Las sincronizaciones van **de una en una** (`sinc.enSerie`): la que llega con otra en marcha se marca y se repite una vez al acabar. Al terminar cada una: si el eje cambió (`reordenado` o `anadidos`), guardar y repintar; si no, solo la línea de estado (repintarlo todo cada 30 s borraría lo que se está escribiendo); siempre, el estado de la sincronía a `agram.sync.estado.<alta>`. Si la cuenta se olvidó mientras tanto, no se escribe nada suyo.

**La línea de estado** (bajo «guardado en este navegador», `sinc.lineaDeEstado` → `dom.htmlSincronia`): «n por subir» y, sin red, «sin red: se subirá al volver»; «el orden cambió al sincronizar» si se reordenó; «al día con el eje compartido» si no hay nada que decir; los errores tal cual (un 401 es la clave de lectura; «el eje … del servidor no es este», que `sync ledger` apunta a otro eje); y, si algo no entró, «n registros no entraron» con un desplegable que lista el id corto, el motivo y de dónde viene (`reglas`: de otro dispositivo, las reglas no lo admiten aquí; `reorden`: de aquí, dejó de valer al llegar antes otro; `servidor`: de aquí, el servidor no lo acepta, con el estado HTTP; deja de salir cuando el servidor lo acepta). Nada de esto bloquea: se escribe en local y la cola sube.

**Core, pendiente de revisar VG**: que escribir exija también la clave de lectura (el encargo solo la pedía para leer; cuesta nada y evita que un extraño siquiera sondee el eje); que `POST /ejes` cuelgue de la función `eventos` (`…/eventos/ejes`) para desplegar una sola función; que un rechazo del servidor no se salte (bloquea lo de detrás hasta que alguien mire); que el reloj del servidor entre solo en `before.6.3`; que la lógica compartida de la función vaya en `.js` y no en `.ts` (Node la importa sin transpilar).


## 16. La guía: preguntar a Claude con el contexto exacto de la pantalla

Encargo de VG y Core (10-11): **el 9 es donde se enchufa una IA, y funciona sin ella**. La guía responde «qué estoy viendo, qué significa, qué viene después»; es de **solo lectura** (no cambia nada, no dice que ha hecho algo; las acciones serían una segunda fase). Vive en el PV9, debajo de los pasos del camino: en móvil a lo ancho de su franja (con la tarjeta ya), en la matriz dentro del bloque del 9 o cuando el 9 es el foco. Funciona también en los ejemplos (vía directa). Código: `carta/guia.js` (puro, sin DOM), `carta/texto.js` (la carta de texto, movida desde `test/carta-texto.mjs`, que la reexporta), la sección de `carta/dom.js` (`htmlGuia`) y `carta/app.js`; el servidor: `servidor/supabase/funciones/guia/`. Pruebas: `test/guia.test.js`.

### 16.1 Las instrucciones son dato: «la guía empieza leyendo en el 9»

Tres capas, de lo general a lo particular, como un CLAUDE.md:

1. **El 9 de la época** (`epoch.9.9`): la guía misma, un registro referenciado como las reglas, las plantillas y los modelos (`datos/epocas/guia/guide.json`, su id en `GUIA_DE_EPOCA_DATOS`; `npm run epocas` escribe la referencia). Sus posiciones: 0 el nombre (`guide`), 1 **el papel** (guía de AGRAM para quien mira; solo lee; responde corto en el idioma de la configuración; nunca inventa ni dice que ha hecho algo), 2 **el resumen de AGRAM** (unas 25 líneas: los diez puntos de vista y sus mundos, los cuatro tokens, madurez y etapas, el aro, el camino, cuentas y libro compartido, los tamaños), 3 **las normas de formato**, 4 **las preguntas hechas** (los botones rápidos: «¿qué estoy viendo?», «¿qué viene ahora?», «¿qué significa esta posición?») 5 el nombre de la plantilla de sus ajustes, **6 cómo responder desde fuera de AGRAM** (el formato del archivo que vuelve, §16.6; en es, `guide answer`), **7 el nombre de la plantilla de una opinión** y **8 el de la transacción que la ancla** (§12.7). El inglés es el canónico del registro; el español está en el 9.4 por clave (`guide role`, `guide summary`, `guide rules`, `guide question N`). `contrato.guia(eje, idioma)` → `{ id, nombre, papel, resumen, normas, preguntas, ajustes, respuesta, opinion, ancla }`; el idioma sin traducción cae al inglés.
2. **El 9 de la plantilla del foco** (`plantilla(X)[9]`): lo que el tipo diga para la guía, leído en humano.
3. **El 9 del propio foco** (`X.9`: «cómo seguir», el tutorial fijo del dueño; lo escrito en su propio 9 y lo anclado ahí): lo que ese registro dice para la guía. **Los registros de configuración** (el de preferencias y el de ajustes de la guía, que también cuelgan del 9 del alta) **no se mandan**: pueden llevar dónde se comparte el eje (`contrato.esDeConfiguracion`).

`guia.instrucciones(eje, X, yo)` junta las tres (el texto base, y detrás «Instrucciones del 9 de la plantilla de este registro: …» y «Instrucciones del 9 de este registro: …», si hay). **El código no lleva escrita ninguna palabra de la guía**: solo lee esas posiciones (una prueba lo comprueba frase a frase). Cada tipo y cada registro pueden llevar así sus propias instrucciones sin tocar el código.

### 16.2 Los ajustes: una plantilla propia, no «preferences»

La plantilla «preferences» (§7) ya tiene las diez posiciones ocupadas (0-9; el 5 es el tipo), así que `guide` y `guide via` **no caben como posiciones nuevas suyas**: los ajustes de la guía son una plantilla de dominio **«guide settings»** (`epoch.9.2`, la tercera detrás de «purchase» y «booking»), un registro más anclado en el `9` del alta por su dueño, como el de preferencias. Posiciones: 1 `guide model` (`claude-sonnet-5-5`), 2 `guide via` (`server` o `direct`, validado por la plantilla; `server`), 3 `guide history` (turnos de la conversación que se guardan: 20), 4 `guide context` (tope del contexto en caracteres: 6000), 5 el tipo, 6 `opinions anchor` (el registro donde anclar las opiniones, sin defecto: §12.7). Etiquetas y ayudas en es y en por las claves de siempre (`template guide settings param … label | help`). `contrato.configuracionDe(eje, yo, nombre)` y `clavesDeConfiguracionDe(nombre)` generalizan `configuracion` y `clavesDeConfiguracion` a otra plantilla; `contrato.configuracionGuia(eje, yo)` los lee, con los defectos de la época si no hay registro; `guia.ajustes()` los da con los números como números. El formulario de «configuración» pinta estos campos aparte (sin `name`, con `data-guia-campo`) y, si cambian, escribe el registro; el de preferencias sigue igual. Las posiciones 1-4 son el contrato; las etiquetas, de la época.

**La clave de la API NUNCA va en el eje.** Vive en `localStorage` `agram.ia.<alta>` (campo aparte del mismo formulario, `data-clave-ia`, como la clave de lectura), no entra en la copia de seguridad, se borra al olvidar la cuenta, y la interfaz avisa de que vive solo en este navegador y de que cualquiera con acceso a él puede leerla. La conversación, en `agram.guia.<alta>` (solo los últimos 20 turnos; se vacía con el botón «vaciar»).

### 16.3 El contexto de cada pregunta: `contexto(estado, eje, yo, { ancho, alto, cuenta, tope })`

Texto, con un tope (`guide context`, 6000 caracteres): **modo y ancho** (el modo lo da la época por la forma de la pantalla, como en la carta), **quién soy** (persona o cosa, en su cuenta o en un ejemplo), **el foco** con su lectura humana (`leerEvento`), su madurez y el punto de vista abierto, **la carta de texto del foco** a la pantalla (`texto.pintar`, tamaño 3), **el camino** (`acciones.camino`: pasos míos, de espera, hechos, niveles), **las acciones del aro por punto de vista** (con su nombre traducido; `*` la de por defecto), **las últimas cinco entradas del diario** leídas, y lo relevante de la configuración (idioma y render; nunca dónde se comparte el eje). Cada bloque se recorta **por el final** a su parte del tope (reparto por pesos) y el propio texto lo dice: «[recortado por el tope de N caracteres: foco, carta]».

Un ejemplo real (la compra de Ikisai, 400 px, recortado):

```
pantalla: 400×800 px · modo list (franjas apiladas) · render sober · idioma en

quien mira: huesped (persona) · en un ejemplo con datos inventados

foco: cdeef0f0 · punto de vista abierto: 0
madurez: nivel 11 de 15 · list
lectura del registro:
cdeef0f0 · huesped · 2026-11-07T13:30:00Z · sobre 42159022 en 0000000000
0 · representación: Compra del menú del día
1 · recursos: …

carta de texto del foco:
[screen · matrix] Compra del menú del día
  nivel 11/15 · list (11 posiciones, 0 de profundidad, 13 unidades)
  1 · order: [[→ 42159022:1], [1], [EUR 12]]
  …

camino: 0 pasos

acciones del aro, por punto de vista (* la de por defecto):
PV1: issue E tied to X* · lock E as a bid for a quota
…
PV9: follow the path* · view the whole tutorial · auto-run to the end · ask for a recommendation

últimas entradas del diario:
- 2026-11-07T13:30:00Z · cdeef0f0 · huesped · …

language: es · render: sober
```

### 16.4 Dos vías de llamada

**Servidor (la preferida)**: `POST {sync url}/guia` (la base del libro compartido, §15.1; en Supabase, la función `guia` hermana de `eventos`), con `X-Clave-Lectura` (la del libro compartido de la cuenta: sin cuenta con servidor, eje compartido y clave de lectura no se llama).

| Petición | Respuesta |
|---|---|
| `POST {url}/guia` con `{ eje, modelo?, mensajes: [{ role, content }…], contexto, instrucciones? }` | `200 { texto, uso: { entrada, salida } }` |

`eje` es el nombre del eje compartido; `mensajes` empieza por `user`, alterna y acaba en una pregunta del usuario (hasta 24, cada uno de hasta 2000 caracteres); `contexto` (hasta **8 000** caracteres) es el de §16.3; `instrucciones` (hasta 8 000), las de §16.1: **el servidor no sabe nada de AGRAM**, junta las dos como el `system` de la llamada. Errores: `400` forma, `401` clave de lectura (comprobada contra `ejes.clave_lectura_hash`), `404` eje, `413` cuerpo, contexto o instrucciones demasiado grandes, `429` más de **30 preguntas por minuto** por eje (o la cuota del proveedor), `502` el proveedor falla (con su motivo; también si la clave del proveedor en el servidor no vale), `OPTIONS` CORS como `eventos`. La función (`servidor/supabase/funciones/guia/index.ts`, Deno; el contrato, en `api.js`, el mismo módulo que usa el servidor de prueba) llama a `https://api.anthropic.com/v1/messages` con `ANTHROPIC_API_KEY` de `Deno.env`, `anthropic-version: 2023-06-01`, `max_tokens` 800 y el modelo pedido (por defecto `claude-sonnet-5-5`). El servidor de prueba (`servidor/prueba/servidor.mjs`) responde `/guia` con un **eco fijo** («(guía de prueba) …» y las primeras líneas del contexto) sin llamar a nada. Desplegarla: `servidor/LEEME.md`.

**Directo (provisional, hasta que haya servidor)**: la carta llama a la API de mensajes desde el navegador con la clave de `agram.ia.<alta>` y las cabeceras `x-api-key`, `anthropic-version: 2023-06-01` y `anthropic-dangerous-direct-browser-access: true`; el `system` es lo mismo, instrucciones y contexto. Sin clave, no llama y lo dice. Vale también en los ejemplos (la clave va por alta de quien mira).

`guia.preguntar(...)` → `{ ok: true, texto, uso }` o `{ ok: false, motivo, estado? }`: los errores salen tal cual en el panel («la clave de lectura no vale para este eje (401)», «la clave de Anthropic no vale (401)», «sin red», «demasiadas preguntas o cuota agotada (429)»).

### 16.5 El panel

Dentro del PV9, debajo de los pasos: la conversación (los últimos turnos), «pensando…» mientras contesta, los **botones rápidos** (las preguntas hechas de la época, §16.1), un campo de pregunta y «preguntar», y «vaciar». Solo se repinta su sección (lo escrito en el campo se recuerda aunque se repinte la carta entera). Para la selección de «opinar» lleva `data-nodo="guia"`.

**Core, pendiente de revisar VG**: que los ajustes sean una plantilla aparte por no caber en «preferences» (diez posiciones llenas); que el cliente mande las instrucciones al servidor (el servidor no las lleva: así no hay que redesplegar para cambiarlas, y el tope de 8 000 caracteres las acota); el reparto del tope del contexto por bloques; que la conversación sea de la alta de quien mira y no del eje (no se sincroniza); el límite de 30 preguntas por minuto cuenta por instancia de la función, no globalmente.

### 16.6 La salida externa: descargo un markdown, hablo fuera, vuelvo con un archivo

Encargo de VG (tanda 2): «descargo un markdown con el contexto, hablo fuera, vuelvo con un archivo y me enseña lo que propone para aceptarlo, rechazarlo o modificarlo». Código: `carta/externa.js` (puro); el panel de la guía lleva los botones. Pruebas: `test/pv9-externa.test.js`.

**Exportar contexto** descarga `agram-contexto-<fecha>.md` con: (1) **Instrucciones de la guía**: la cascada del 9 (§16.1), el mismo texto que se manda a la IA (`guia.instrucciones`); (2) **Contexto de la pantalla** (`guia.contexto`, con tope `TOPE_EXPORTAR` = 20 000 caracteres en vez de los 6 000 de la guía), el id completo del foco al principio y las **acciones del aro con sus parámetros** (nombre canónico, tipo, requerido u opcional y si ya tiene valor por defecto, y la ayuda: lo que hace falta para proponer); (3) **Cómo responder**, el texto de la época (posición 6 del registro `guide` de `epoch.9.9`, en el idioma de quien mira): no está escrito en el código (una prueba lo comprueba frase a frase).

**El formato de vuelta** (un `.json` o un `.md` con un bloque ```json; también vale la lista sola):

```json
{ "propuestas": [
  { "accion": "<nombre de una acción del aro>",
    "sobre": "<id del registro (bastan los ocho primeros caracteres) o su 0>",
    "parametros": { "<nombre o etiqueta de un parámetro>": "<valor>" },
    "porque": "<una frase>" } ] }
```

`accion`: el nombre canónico (inglés) de una plantilla de transacción o el que lleva en el idioma de quien mira, sin mayúsculas. `sobre`: el registro del que trata (`acciones.registroDe`). `parametros`: por la clave canónica o por la etiqueta; los valores se leen con su tipo como en un formulario (`contrato.desdeLegible`: una fecha `2026-11-20`, un registro por su id o su 0). `porque` se enseña tal cual.

**Importar propuestas** guarda cada una, tal como llegó, en `localStorage` `agram.propuestas.<alta|ejemplo>` (por cuenta; «ejemplo» en un ejemplo) con un id; viven ahí hasta que se aceptan o se rechazan. Se evalúan **cada vez** contra el eje (`externa.evaluar`): un registro que aparece después hace válida una propuesta que antes no lo era. **Inválida, con su motivo** (no se descarta en silencio): acción que no existe, falta `sobre`, registro que no está en el libro, parámetro que la acción no pide, valor que no se lee con su tipo, elemento que no es un objeto.

**En el camino**: `externa.sugerenciasDe` es el gancho `sugerencias` de `acciones.camino` (§12.5): cada propuesta sobre el registro en foco es un paso de la tercera fuente con su «porque» y marcado si ahora pasa las reglas (`acciones.transaccion`, con la firma de quien mira: sin esto una identidad con clave vería siempre «who has a key signs»); una inválida sobre ese registro sale como paso inválido con su motivo. Las que tratan de otro registro, o de ninguno que exista, se listan en el panel de la guía («propuestas importadas · N») con «ir al registro» y «rechazar». Tres botones por propuesta: **aceptar** (lanza la acción con esos parámetros: `acciones.transaccion` + firma + `eje.anadir`; si algo no pasa, abre el formulario con el motivo), **modificar** (o tocar el nombre: el formulario normal de la acción con los parámetros rellenos, editable; al lanzarlo desde ahí, la propuesta deja de estar pendiente) y **rechazar** (desaparece). Nada se asienta sin que quien mira lo lance, y lo asentado lo firma él y lo comprueban las reglas. «Seguir» (`autoejecutar`) no lanza propuestas.

**Core, pendiente de revisar VG**: que las propuestas sobre otro registro estén en el panel y no en todos los caminos; que `anchor here` lleve `type`, `about`, `version`, `seen` y `route` como opcionales (§12.7); que el ajuste «opinions anchor» viva en «guide settings»; que el contexto exportado llegue a 20 000 caracteres.


## 17. Be: el mando de Core

Encargo de VG y Core (10-11): **Be es el modo en que Core lee el eje compartido sin la pantalla** (el modo «Be» de la tabla de interacciones: «nombrarlo», «desde el PV…», «siguiente»). Core es una IA que trabaja desde la línea de comandos; `be.mjs` le da lo que la pantalla da a VG, en texto plano y en español. **Esta primera versión solo lee**: escribir (con identidad propia y firma) vendrá después. Código: `be.mjs` (raíz; sin dependencias, usa `src/sincronia.js`, `src/lectura.js`, `src/acciones.js`, `carta/texto.js` y `carta/guia.js` tal cual, sin código especial). Pruebas: `test/be.test.js` (servidor de prueba en un puerto libre, `be.mjs` como proceso hijo con configuración y caché temporales).

### 17.1 Uso y configuración

`node be.mjs <orden> [argumentos] [--config <ruta>] [--como <identidad>]`.

La **configuración** es un JSON **fuera del repositorio**, con `--config <ruta>` o la variable `AGRAM_BE_CONFIG`: `{ "sync_url": "https://…/functions/v1", "eje": "vg", "clave_lectura": "…" }` (también valen `url` y `claveLectura`). Ni la dirección, ni el eje, ni la clave están en el código; la clave de lectura no se imprime ni entra en la caché.

### 17.2 La caché

La primera llamada baja el eje entero con `sincronizar(null)` (el eje nace del génesis del servidor y cada evento pasa por las reglas, §15.2) y lo guarda en **`~/.agram/be/<eje>.json`** (fuera del repo; `AGRAM_BE_CACHE` cambia la carpeta; `persistencia.serializar` del eje, `Sincronia.serializar()` sin la clave y la marca de las opiniones ya vistas). Las siguientes llamadas restauran la caché y bajan solo lo nuevo (`desde` el último orden conocido). Una caché de otro servidor o de otro eje, o ilegible, se ignora y se baja de nuevo. **Sin red** se lee la caché y la salida empieza con `(sin red: leo la caché (<fecha>, hasta el orden N))`; sin caché, falla diciéndolo. Los errores del servidor salen tal cual (`servidor 401: …` la clave de lectura, `servidor 404: …` el eje) y la orden termina con código 1.

### 17.3 Las órdenes

`<X>` es un registro por su id, por un prefijo de ocho o más caracteres o por su 0 (`acciones.registroDe`). `--como <identidad>` es quien mira (por defecto, el autor del génesis; debe tener alta).

| Orden | Qué da |
|---|---|
| `estado` | el eje, el número de registros, el último orden del servidor, las identidades con su alta y su 0, y el registro «AGRAM» si existe |
| `ver <X>` | la lectura humana (`leerEvento`), la madurez y la carta de texto en tamaño 3 (`pintarPara`) como `--como` |
| `camino <X>` | los pasos (`acciones.camino`): fuente, hecho / espera a / qué hacer y lo que falta |
| `aro <X>` | las acciones por punto de vista (`acciones.acciones`), `*` la de por defecto, nombre canónico y traducido, y los parámetros que faltan |
| `diario [--desde n] [--cuantos n]` | las entradas leídas (`leerEvento`) por llegada (`--desde`: número de llegada empezando en 1; por defecto las últimas `--cuantos`, 10), con su orden y hora del servidor |
| `opiniones [proyecto] [--nuevas]` | `acciones.opiniones(eje, proyecto)` (por defecto el registro cuyo 0 es «AGRAM»): fecha, autor, clasificación, el registro opinado (id corto y 0), la ruta, el texto y las respuestas en hilo. Cada listado marca en la caché lo que ha enseñado; `--nuevas` enseña solo lo que no estaba (una opinión con una respuesta nueva sale, con la respuesta marcada `NUEVA`) |
| `contexto <X> [--tope n]` | el mismo contexto que la guía manda a la IA (`guia.contexto`), para que Core vea lo que ve la guía |
| `buscar <texto>` | los registros cuyo 0 o cuya lectura contienen el texto (hasta 50) |

### 17.4 Lo que no hace aún

No escribe: ni opiniones, ni respuestas, ni acciones del aro. Escribir pedirá una **identidad propia de Core** (un alta en el eje, con su clave, que VG da) y la **firma** de cada evento, con la T de minuto de todo registro (§12.7, §15); y habrá que decidir si pasa por `acciones.transaccion` como cualquier acción. No sube nada (`sincronizar` se llama con `subir: false`) y no guarda claves privadas.
