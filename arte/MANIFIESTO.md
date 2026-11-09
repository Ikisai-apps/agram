# Manifiesto de arte: cómo un paquete de arte se convierte en modelo de visualización

Encargo 3c-2b (tras 3c-1). Principio de VG: nada hardcodeado en la pantalla; **los modelos de visualización son registros**; cualquier modelo puede estar incompleto y se rellena por partes; la carta pide una pieza y la cadena de modelos responde (el que nombra la configuración de quien mira → el animado genérico de la época → el sobrio, que siempre responde). El núcleo está en `src/modelos.js`; la descripción completa, en `docs/CONTRATO.md`, «Modelos de visualización». Este documento dice **qué tiene que traer un paquete de arte** y **cómo se importa** sin copiar archivos.

## 1. La pieza

Una pieza es un registro (una décupla BTML) con esta forma; lo que cada posición admite lo dice la cabecera de la época, `epoch.9.7.0` (`datos/epocas/epoca-0.btml.json`): los nombres de los tipos, de las orientaciones, de los niveles y de las palabras de repetición son datos, no están escritos en ningún programa.

| Posición | Qué lleva | Valores (de `epoch.9.7.0`) |
|---|---|---|
| 0 qué es | el **tipo** | `elemento` (por paso de madurez 1-10), `munequito` (por acción), `movimiento` (por primitiva de la capa cero o por efecto), `fondo` (por paso), `marco` (por paso), `icono` (del aro, por mundo) |
| 1 cuánto | `[tamaño mínimo, formato]`; sin recurso, `[tamaño mínimo, forma]` | tamaño 1 el hueco, 2 la tarjeta, 3 la pantalla (`epoch.9.5.2`, como las representaciones del 0); formato `svg`, `lottie`, `image`, `video`, `html`… (`epoch.9.5.1`); forma sobria `texto`, `rectangulo`, `punto` |
| 2 con qué condición | la **clave**: el paso 1-10, la acción (`esperar`, `actuar`, `celebrar`), la primitiva (`mint transfer lock release burn`) o el efecto (`crear-pasado`, `crear-futuro`, `crear-abajo`, `crear-arriba`), o el mundo del que es icono; `*` sirve para cualquiera | `epoch.9.7.0.4` dice el nombre de la clave de cada tipo |
| 3 con quién | la **orientación** | `centro`, `izquierda`, `derecha` (`epoch.9.7.0.3`; la primera es la de respaldo) |
| 4 qué hace | `[repetición, fotogramas]` | `loop` o `once` (`epoch.9.7.0.7`); los fotogramas, un entero; **obligatorio en lo animado** (`lottie`, `video`: `epoch.9.7.0.6`) |
| 5 dónde encaja | los **mundos** en que sirve | dígitos 0-9, o `*` = todos los mundos (1-4 y 6-9); los marcos y los iconos van en el 5 |
| 6 de dónde viene | el **recurso** y su procedencia | una ruta relativa del repositorio (`arte/...`) o una URL, y detrás el paquete, el nivel, la licencia |

```json
[["elemento"], [1, "svg"], [5], ["derecha"], ["once", 1], [1], ["arte/pruebas/03/ciudad/elemento/tienda-derecha-intermedio.svg", "arte/pruebas/03 (nivel intermedio)"]]
[["munequito"], [1, "lottie"], ["esperar"], ["centro"], ["loop", 48], [1], ["arte/pruebas/03/ciudad/munequito/vendedor-esperar-intermedio.json", "arte/pruebas/03 (nivel intermedio)"]]
[["elemento"], [1, "rectangulo"], ["*"], ["centro"], ["once", 1], ["*"]]
```

Leída (`modelos.leerPieza`, lo que devuelve `modelos.pieza`): `{ tipo, pv, clave, paso | accion | primitiva | mundo, variante, tamano, formato | forma, recurso, bucle, fotogramas, procedencia }`.

## 2. El modelo

Un modelo es un registro: **0** su nombre, su **nivel de detalle** (`sello`, `intermedio`, `ilustrado`: `epoch.9.7.0.1`) y una nota; **1-4 y 6-9** las piezas del mundo de cada punto de vista (1 ciudad, 2 jardín, 3 parque, 4 fábrica, 6 pasado, 7 futuro, 8 cielo, 9 camino), como lista de referencias `{ ref }` a los registros de las piezas; **5** los marcos y los iconos del aro. Un mundo sin piezas delante de otro con ellas lleva la hoja `sin piezas` (nunca se escribe `[]`); los de detrás no se escriben. Un modelo incompleto es normal: lo que no tiene lo da el siguiente de la cadena. En la época viven en `datos/epocas/modelos/<nombre>.json` con sus piezas en `datos/epocas/modelos/<nombre>/*.json`; `npm run epocas` reescribe las posiciones del modelo desde sus piezas y lo referencia desde `epoch.9.7`. En un eje, un modelo es un registro anclado al dominio de un proyecto, y sus piezas se anclan en la posición de su mundo (se rellena por partes).

## 3. Lo que un paquete de arte tiene que traer

1. **Los archivos**, con un archivo por orientación: la izquierda es el lado del PV1 y la derecha el del PV2, cambian por separado y **nunca se usa el espejo como pieza** (`arte/pruebas/03/LEEME.md`).
2. **Un índice**, `indice.json`, con una entrada por pieza. Campos: `ruta` (relativa al paquete; obligatoria), `mundo` o `pv` (un dígito 0-9 o un nombre: ciudad, jardín, parque, fábrica, pasado, futuro, cielo, camino, aro), `familia` (el tipo), `nombre`, `paso` | `accion` | `primitiva` (la clave), `nivel`, `orientacion`, `bucle`, `fotogramas`, `tamano`, `formato`. **Tolera campos que falten**: el tipo y el mundo se infieren de las carpetas de la ruta (`ciudad/elemento/...`), la orientación y el nivel de los segmentos del nombre del archivo (`tienda-derecha-intermedio.svg`), el formato de la extensión, los fotogramas de un Lottie leyéndolo, el bucle de que sea animado; sin clave, la pieza sirve para cualquiera (`*`). Y a nivel de paquete: `nombre`, `nivel`, `nota`, `procedencia`, `licencia`.
3. **Fotogramas en múltiplos de diez** en lo nuevo (`epoch.9.7.0.8`): el paso k de un elemento de diez pasos cae en el fotograma k × (total ÷ 10). El arte de prueba 03 trae 48 y el importador lo avisa.
4. **Lo animado dice si repite**: `bucle` (loop) o una sola vez (once), y cuántos fotogramas tiene.
5. **Seguro**: un Lottie sin expresiones (ninguna clave `"x"` con código), sin `assets` externos ni direcciones `http`; un SVG sin `<script>`, atributos `on*=`, `<image>`, `<foreignObject>` ni referencias externas (lo que comprueba la prueba del reproductor, `pruebas/carta/`).
6. **La licencia**, en el índice o en su LEEME.

## 4. Importar

```sh
node arte/importar.mjs arte/pruebas/03             # imprime el modelo (JSON) y los avisos en la salida de error
node arte/importar.mjs arte/pruebas/03 --escribir  # lo deja en datos/epocas/modelos/prueba-03.json y prueba-03/
npm run epocas                                     # la época lo referencia desde epoch.9.7
```

El importador **no copia ningún archivo**: las piezas referencian las rutas del paquete tal como están en el repositorio. Desde código: `importar(indice, { carpeta })` → `{ nombre, nivel, modelo, piezas: [{ archivo, id, registro }], avisos }`; los avisos son los de `modelos.validarModelo` (lo animado sin bucle o sin fotogramas es un motivo; los fotogramas que no son múltiplo de diez, un aviso) y lo que se infirió o se omitió. Para que la carta lo use, quien mira lo nombra en su configuración (la preferencia `model`, `epoch.9.3.6`) o la época lo pone en su cadena (`epoch.9.7.0.2`).

## 5. Lo que admite una pieza que viene del eje (SEG-14)

Cualquiera puede publicar un modelo o piezas en un eje, pero **quien mira adopta**: su preferencia `model` nombra el modelo por **id** (`{ ref }` o el id como texto; por nombre solo se resuelven los modelos de la época, así que nadie suplanta a `ikisai`), y de un modelo del eje solo cuentan las piezas **ancladas por su autor** (la delegación está pendiente). Además, en una pieza del eje, y no en las de la época ni en las del repositorio:

- el **recurso** es una ruta relativa dentro de `arte/` (sin `..`, sin esquema, sin `//`, `\` ni `%`) o una URL de un origen de la **lista blanca**, un dato de la cabecera de la época (`epoch.9.7.0.9`, detrás de la nota; hoy `https://agram.ikisai.com`). Cualquier otro recurso descarta la pieza y responde el respaldo;
- el formato **`html`** no se admite (una pieza del eje que lo declare se descarta).
