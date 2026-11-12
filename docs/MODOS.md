# Los modos de experiencia: de Pointed a Scened

Este documento describe **lo que existe hoy** de los modos de experiencia (mapa global §2.7) y, sobre todo, el modo nuevo: **Scened**, varios focos en escena. Fuente de verdad: `src/modos.js`, `src/pointed.js`, `src/sequenced.js`, `src/mapped.js`, `src/scened.js` y sus pruebas (`test/modos.test.js`, `test/pointed.test.js`, `test/sequenced.test.js`, `test/mapped.test.js`, `test/scened.test.js`). Lo que el mapa no decide se marca «[X] decidir VG». La escritura desde cada modo (registro de salida y proporción) está en `docs/MOTOR.md` §7.

Convenciones, las de `docs/MOTOR.md`: los ejemplos se ejecutan desde la raíz del repositorio con Node ≥ 20 y la salida que sigue a cada uno es la real; el eje de ejemplo es `ejemplos/ikisai/compra-food.mjs` (datos inventados) con ids deterministas (cambian si cambia la época 0: el génesis lleva su id, encargo 3b): génesis `607d3035` (el alta de la casa: encargo 3b), altas del fin de semana `20be0387`, menú `7d2cecd4`, compra `b0d35693`, cuenta `b7d73503`.

## 0. Los modos

| Modo | Piezas (§2.7) | Orden | Mínimo | Máximo | Módulo | Qué compone | Renders |
|---|---|---|---|---|---|---|---|
| Pointed | una décupla | 1 | 1 | 10 | `src/pointed.js` | `decupla(ev, epoca)`: las diez posiciones del foco | sobrio |
| Sequenced | unas diez | 2 | 10 | 100 | `src/sequenced.js` | `secuencia(eje, id, { sentido })`: el hilo del foco o lo escrito sobre él | sobrio |
| Mapped | unas cien (la 3×3) | 3 | 100 | 1000 | `src/mapped.js` | `mapa(eje, id, { camino, epoca, medidas })`: matriz 1 8 2 / 6 5 7 / 3 9 4 y eje 6·5·7; la celda 8 con `ocho` y las medidas del 8 solo si se piden (§0.5) | sobrio |
| **Scened** | unas mil | 4 | 1000 | 10000 | `src/scened.js` | `escena(eje, focos, { camino, epoca })`: varios mapas y sus ejes temporales en un marco común | sobrio |
| Be | todos, sin interfaz gráfica | del 5 en adelante | no tiene: responde lo que se le pide (VG, 7-11 noche) | todos (`Infinity`) | solo en `src/modos.js` | — | — |

Las cifras son **posiciones con contenido** (§0.1) y salen del orden de magnitud de cada modo (§0.4): mínimo 10^(orden−1), máximo 10^orden. La decisión es de VG (7-11 noche):

> «A él le llegan los datos empezando por un único dato. En Pointed hablábamos de 10, en Sequenced de 100, en Mapped de 1000, en Scened de 10.000 y en Be, como que dice todos, porque no tiene interfaz gráfica como tal. Ese es el máximo de datos que se pueden representar. Después tenemos la cantidad de información mínima que cada interfaz quiere intentar representar. No significa que la tenga que representar, porque a lo mejor no tiene información suficiente, pero es la mínima que intenta: Pointed 1, Sequenced 10, Mapped 100, Scened 1000. Ahí tendremos tres números: el que consigue (que a lo mejor es menor), el mínimo y el máximo. Y eso corresponde con los que emite, con los máximos y los mínimos que emite, porque todo lo que no se pueda representar realmente no se puede alterar y por lo tanto no tiene sentido emitirlo.»

**Lectura y emisión comparten los números**: el máximo es duro para representar y para emitir, y el mínimo es lo que el modo intenta en los dos sentidos; no llegar al mínimo no es error, es información.

En `src/modos.js`: `maximo(modo)` y `minimo(modo)`; `tope(modo)` es alias de `maximo(modo)` y `cabeTope` es la regla dura de la emisión. `lectura(modo)` (las décuplas del modo × 10) da la misma cifra que el máximo, pero ya no es lo que una lectura trae: queda como **capacidad representativa**, la base sobre la que se calcula la proporción (§0.3). `alcanceDe(conseguido, modo)` da los tres números: `{ conseguido, minimo, maximo, alMinimo }`. **Be no tiene mínimo propio** (VG, 7-11 noche, decisión 10.4: responde exactamente lo que se le pide): sus tres números son `{ conseguido, pedido, maximo: Infinity, alMinimo: true }`, con `alcanceDe(conseguido, 'be', { pedido })` (`pedido` vale por defecto lo conseguido; `alMinimo` siempre es `true` porque no hay mínimo que alcanzar), y el frontend los diría «5 · pedido 5 · máx todos»; `minimo('be')` es `null` porque no aplica.

| Dónde | Los tres números | Corte |
|---|---|---|
| `pointed.decupla` | `alcance`: las posiciones con contenido del payload | `corte`, `avisos` (§0.2) |
| `sequenced.secuencia` | `alcance`: el contenido de los registros que entran | `corte`, `avisos` |
| `mapped.mapa` | `alcance`: el contenido del foco, su hilo (hasta `maximo`) y sus hijos (hasta `maximo`), cada registro una vez | `corte`, `avisos` |
| `scened.escena` | `cifras` (con `necesario`, §6): se llama así porque `escenaDe` ya usa `alcance` para la cohorte | `corte`, `avisos` |
| `salida.escribirSalida` | `alcance` de lo emitido (sin lo heredado); `proporcion` y `avisos` (§0.3) | rechaza por encima del máximo |
| `salida.escribirDesde` | devuelve el evento del eje (congelado y firmado); `salida.alcanceDeRegistro(evento)` da sus tres números y `salida.proporcionDeRegistro(evento)`, su proporción con su aviso | rechaza por encima del máximo |

El frontend los enseña en cada vista junto al nombre del modo, discretos: `Sequenced · 19 · mín 10 · máx 100`, y el aviso de corte arriba y abajo de lo que trae.

### 0.1 Lo leído se cuenta por lo que hay

VG, 7-11 noche (decisión 10.1, «Por supuesto, adelante»): el «conseguido» de cada vista cuenta **contenido real**, no diez por décupla traída. Lo mide `contenido(payload)` en `src/modos.js`, la misma medida para leer y para emitir:

| Lo que hay | Cuenta |
|---|---|
| un terminal (texto, número, referencia) | 1 |
| una décupla | la suma de sus posiciones con contenido: `['a', 'b', 'c']` cuenta 3, no 10 |
| una lista de ocupantes (bajo una posición, un array solo de hojas, `btml.esLista`) | uno por ocupante: una lista de doce cuenta 12 |
| algo anidado | lo que hay a cualquier profundidad: `['a', ['b', 'c'], { ref }]` cuenta 4 |
| lo que no es BTML | 0 |

`contarPosiciones` sigue existiendo como alias (lo usan `src/motor.js` y la fábrica). Así el mínimo de Pointed (1) puede quedar sin alcanzar al leer, y Pointed ya no dice siempre 10: la compra del ejemplo trae 9 en Pointed y la escena de la compra con su menú, 19. Los máximos y los mínimos no cambian.

### 0.2 Todos cortan duro

VG, 7-11 noche (decisión 10.2, «Todos cortan duro (Pointed también)»): los cuatro modos cortan en su máximo con **el mismo aviso**, «… Trae X de Y posiciones.» (`avisoCorte` en `src/modos.js`), y nunca traen más. **Be no corta**: representa todos. Cada modo devuelve `corte` (`null` si no corta) y `avisos` (el del corte, el primero), y su render y su vista enseñan el aviso **arriba y abajo**, como Scened. El orden de corte de cada modo:

| Modo | Orden de corte | Qué entra a medias |
|---|---|---|
| Pointed | la décupla del foco: sus posiciones con contenido **por índice** (la 0 y lo que cuelga de ella antes que la 1; en una lista, los ocupantes por llegada), con `modos.recortar` | sí: las posiciones que pierden algo llevan `cortada: true`; `corte.cortadas` dice cuáles |
| Sequenced | los registros **por llegada**: el hilo, el más cercano primero; los hijos, en orden de entrada (`modos.admitir`) | nada: el primero que no cabe y los que vienen detrás quedan fuera (`corte.fuera`) |
| Mapped | el **foco**, después su **hilo** (el más cercano primero) y después sus **hijos** (por llegada) | nada; solo si el foco ya pasa del máximo entra recortado por índice, como en Pointed, y nada más (`corte.foco: 'recortado'`) |
| Scened | los focos en el orden pedido (§6) | nada |

Ejemplos de aviso: `Pointed corta en su máximo (10 posiciones): entran sus 10 primeras posiciones con contenido, por índice; la lista trae 12 ocupantes y entran los 10 primeros por llegada. Trae 10 de 12 posiciones.`; `Sequenced corta en su máximo (100 posiciones): entran 10 de 12 registros por llegada y quedan fuera 2: … Trae 100 de 120 posiciones.`

**Lo que pide más del máximo se rechaza**, como la `capacidad` de Scened: el `maximo` de `secuencia` (registros pedidos) es un entero de 0 a 100 (cada registro trae al menos una posición, así que más nunca cabría; `sequenced.MAXIMO_REGISTROS`); el `maximo` de `mapa` (registros de hilo y de hijos) y el de `escena`, de 0 a 499 (el foco y dos veces 499 ya son 999 registros; `mapped.MAXIMO_REGISTROS`). Fuera de eso: `maximo inválido: … se puede pedir menos, nunca más`. Por defecto se siguen pidiendo diez registros de cada, como antes.

### 0.3 La proporción propone, el máximo manda

VG, 7-11 noche (decisión 10.3): **los máximos del modo son los límites duros de la emisión**; la proporción (Pointed 1/10, Sequenced 1/10–1/5, Mapped 1/4–1/3; Scened y Be sin fijar) deja de ser tope y pasa a ser **lo que la fábrica propone por defecto**: el tamaño normal de lo escrito respecto de lo leído.

- `escritura(modo)` y su alias `propuesta(modo)` dan el rango propuesto, `[mín, máx]` (Pointed `[1, 1]`, Sequenced `[10, 20]`, Mapped `[250, 333]`), sobre la capacidad representativa (`lectura`).
- La escritura (`src/escritura.js`) **solo rechaza por el máximo** (`cabeTope`, sobre lo emitido, sin lo heredado): `Pointed emite como mucho 10 posiciones; este registro tiene 11`.
- Lo que se sale de la proporción **se escribe y se avisa**: `proporcionDe(posiciones, modo)` da `{ posiciones, rango, estado, aviso }`; `aviso` es `null` dentro de la proporción y, fuera, por ejemplo: `Sequenced propone escribir de 10 a 20 posiciones (la proporción sobre lo leído); esto tiene 21, por encima. No es error: la proporción propone, el máximo (100) manda.` `escribirSalida` lo devuelve en `proporcion` y en `avisos`; para el evento de `escribirDesde`, `proporcionDeRegistro(evento)`. La proporción cuenta todas las posiciones del registro, lo heredado incluido; `cabeEscritura` solo informa.
- En el frontend, el formulario de cada modo dice lo que propone y lo que manda («Sequenced propone de 10 a 20 posiciones (como mucho 100)») y, tras escribir, el aviso de la proporción sale como una línea discreta bajo el mensaje de éxito, nunca como error.
- El mínimo del modo sigue informándose, sin rechazar (§0; ver «Para decidir VG», §9).

### 0.4 Órdenes de magnitud

VG, 7-11 noche (mapa §12, «T, corregido por VG», punto 4): el tamaño de un árbol se mide en **órdenes de magnitud**, como medida general y no solo de las UI. El orden n va de 10^(n−1) a 10^n posiciones con contenido:

> «que un T de segundo sea un árbol de información más pequeño que el que se emite, y un T de hora o de día uno más grande»

| Función (`src/modos.js`) | Qué da |
|---|---|
| `orden(posiciones)` | el n tal que 10^(n−1) < posiciones ≤ 10^n; 0 posiciones, orden 0; 1, orden 1 (1–10, 11–100, 101–1000…) |
| `minimoDe(n)`, `maximoDe(n)` | 10^(n−1) y 10^n (el orden 0, 0 y 0) |
| `MODOS[modo].orden` | Pointed 1, Sequenced 2, Mapped 3, Scened 4, Be del quinto en adelante (`orden` 5, por encima de Scened). Los cuatro primeros tienen por mínimo y máximo `minimoDe(orden)` y `maximoDe(orden)`; Be no tiene mínimo propio y su máximo es todos (VG, 7-11 noche) |
| `ordenDeEscala(escalaT)`, `ORDENES_DE_ESCALA` | segundo 1, minuto 2, hora 3, día 4, semana 5, ciclo 6, año 7 (las siete reales, `tokens.ESCALAS_REALES`: `dia`, `anio`); las tres informativas de las diez de `tokens.ESCALAS_T` (pasado, futuro, inventado; VG, 8-11) son informativas sin orden: `null` |

`ordenDeEscala` es **solo informativa**: nadie la aplica todavía. La usa `tiempo.escalaQueCubre` para que el 4 proponga la escala de T que cubre lo emitido (VG 12-11, #65; la «incongruencia de escala», que se enseñaba sin rechazar, se retiró).

Tres reglas valen para todos [A/D]: **cambiar de modo no muta el contenido** (un modo solo lee); **sobrio y animado son dos renders de la misma operación** (§10.3; en estos módulos solo existe el sobrio, y pedir `'animado'` lanza «render no disponible»; el primer mundo animado, los hilos del 6 y 7, está en el frontend: `mundos/hilos.js`); y la época va **fuera del dato** (§9): cada modo recibe la época con la que se lee.

**El personaje es la configuración del sitio** (VG, 12-11, #38; `test/personaje-del-sitio.test.js`): no hay barra superior. Cada cuadrante (cada PV de la 3 × 3, la pantalla completa de un PV con sus sub-PV y cajas, cada fila de Sequenced) lleva en su cabecera el mismo botón `.sitio-interrogante`: el interrogante en sobrio y, en animado, el muñeco como una capa `.capa-sitio` de ese botón (el arte propio del elemento o el del modelo `general`; sin arte, el interrogante). Pulsarlo abre la cruceta del propio nodo X.<lugar> (`acciones.sitio`). El del 0 es el personaje del foco (arriba de la columna en Sequenced) y abre el 0 de mi alta con las opciones de la barra (quién soy 0, hoy y guardar rato 1, configuración 2, cuenta 4, sobrio/animado 5, opinar 8, guía/exterior, guardado y sincronía 9). La matriz del 4 queda fuera (sus celdas son oficio × ejecución).

**El animado de la pantalla completa de Mapped son capas sobre el sobrio** (VG, 11-11): la rejilla de cada mundo es el mismo DOM en los dos renders y el animado solo añade nodos `.capa` absolutos (fondo, etapa, dibujo de cada hijo, personaje en el hueco, efectos, marco); quitarlos devuelve el sobrio exacto y nada cambia de sitio ni de medida (`test/animado-capas.test.js`; medido con Playwright a 1920 × 1080 y 1366 × 768).

`src/index.js` los expone como espacios de nombres: `pointed`, `sequenced`, `mapped`, `scened`.

### 0.5 La celda 8 de Mapped y las medidas perezosas

VG, 8-11 (mapa §14.1, punto 12: «bien a ambos»): la celda 8 de Mapped, en sobrio, lee el 8 de una cohorte del foco, **«hermanos» por defecto**, con un toque para pasar a «proyecto» o a «todo el eje»; enseña **primero las cantidades por serie y la cuota del foco frente a su padre** (lo que decide las cajas) y, en una segunda línea más discreta, **los recuentos como información**. Y las medidas que enseñan Mapped y Scened son la medida única del 8, **calculada solo cuando se pide**.

| Función (`src/mapped.js`) | Qué da |
|---|---|
| `ocho(eje, foco, { alcance, epoca })` | La lectura de la celda 8, por cantidades (R7; integra lo que daba `bases.ochoPorCantidades`): `alcance` es `'hermanos'` (por defecto: el 8 del padre), `'proyecto'` (el 8 del proyecto) o `'general'` (todo el eje: el 8 del génesis), `COHORTES`. Lee la base escrita (`bases.situar`) o, si no la hay, el respaldo al vuelo, dicho (`frescura: 'sin base escrita'`). Da `cantidades` (por serie: T movido por escala, E por emisor y denominación, P por ámbito, R por emisor y el T consumido sobre el registro, `tiempo:<escala>`; el valor del foco, su caja, su cuota en la cohorte con la caja de esa cuota, y cuántos quedan debajo, en ella y encima, que son información), `cuota` (frente al padre), `recuentos` (las medidas de `bases.MEDIDAS`: valor del foco y lo fundido, sin caja; la celda enseña cinco, `RECUENTOS` y `recuentosDeCelda`) y `posiciones` (la décupla de la cohorte, para quien la dibuje). Sin puesto ni puntuación. |
| `cuota(eje, foco, { epoca })` | La cuota del foco frente a su padre, serie a serie: lo que mueve el foco ÷ lo que mueven entre todos los hijos del padre (la base del 8 del padre, o su respaldo). `null` sin padre. Es la `cuota` que da `bases.situar` entre hermanos (R7); en las otras cohortes, `ocho` da además la cuota en la cohorte en cada cantidad, y la celda enseña las dos. |
| `textoOcho(o)`, `textoCuota(c)` | El texto sobrio de la celda (abajo): una línea por serie con la cantidad, su caja y su cuota frente al padre (y, fuera de hermanos, en la cohorte), y al final los recuentos como información; y una cuota como porcentaje («37,5 %», «—» si no hay nada de esa serie). |
| `mapa(eje, id, { medidas: true })` | Con la opción, `medidas` es la medida única del 8 del foco (`medidasDe`, es decir, `bases.medir`: `posiciones`, `terminales`, `escritos`, `movimientos`, `identidades`, `profundidadHilo`, `formulasResueltas`, `formulasPendientes` y `tokens` por serie). **Sin la opción, `medidas` es `null` y no se mide nada**: Scened pide un mapa por cada foco. |
| `medidasDe(eje, id)`, `medicionesPedidas()` | La medida que piden las vistas (la de `bases.medir`, sin el detalle por posición) y cuántas veces se ha pedido desde que se cargó el módulo: el contador con que las pruebas comprueban que `mapa()` sin la opción no mide. |

Si la base escrita no mide al foco (llegó después), la cuota lo dice (`incluido: false`) y puede pasar de 1. **Para decidir VG:** si la suma del foco es solo el foco (hoy) o su subárbol, y si el denominador son los hijos del padre (hoy) o su subárbol.

Las compras del menú del día (`ejemplos/ikisai/compras-hermanas.mjs`, datos inventados), sin bases escritas: la celda 8 de los guisos entre hermanos y en todo el eje, y `mapa` sin medir y midiendo:

```sh
node --input-type=module -e "
import { ejemploComprasHermanas } from './ejemplos/ikisai/compras-hermanas.mjs';
import { ocho, textoOcho, mapa, medicionesPedidas } from './src/mapped.js';
const { eje, guisos } = await ejemploComprasHermanas();
for (const alcance of ['hermanos', 'general']) console.log(textoOcho(ocho(eje, guisos.id, { alcance })));
console.log('mapa sin la opción:', mapa(eje, guisos.id).medidas, '· medidas pedidas:', medicionesPedidas());
const m = mapa(eje, guisos.id, { medidas: true }).medidas;
console.log('con { medidas: true }:', m.escritos, 'escritos ·', m.movimientos, 'movimientos · medidas pedidas:', medicionesPedidas());
"
```

```text
8 · hermanos · sin base escrita (respaldo al vuelo) · n 4
E:casa/EUR 12: caja 6 · cuota frente al padre 37,5 %
T:hora 1: caja 1 · cuota frente al padre 25 %
recuentos (información): hilo 3 · escritos 0 · movimientos 2 · posiciones 5 · identidades 2
8 · general · sin base escrita (respaldo al vuelo) · n 20
E:casa/EUR 12: caja 6 · cuota frente al padre 37,5 % · en la cohorte 1,8 %
R:casa 0: caja 0 · cuota frente al padre — · en la cohorte 0 %
T:anio 0: caja 0 · cuota frente al padre — · en la cohorte 0 %
T:ciclo 0: caja 0 · cuota frente al padre — · en la cohorte 0 %
T:dia 0: caja 0 · cuota frente al padre — · en la cohorte 0 %
T:hora 1: caja 1 · cuota frente al padre 25 % · en la cohorte 2,6 %
T:minuto 0: caja 0 · cuota frente al padre — · en la cohorte 0 %
T:segundo 0: caja 0 · cuota frente al padre — · en la cohorte 0 %
tiempo:hora 0: caja 0 · cuota frente al padre — · en la cohorte 0 %
tiempo:minuto 0: caja 0 · cuota frente al padre — · en la cohorte 0 %
recuentos (información): hilo 3 · escritos 0 · movimientos 2 · posiciones 5 · identidades 2
mapa sin la opción: null · medidas pedidas: 0
con { medidas: true }: 0 escritos · 2 movimientos · medidas pedidas: 1
```

Los guisos mueven 12 EUR de los 32 que mueven las cuatro compras del menú (37,5 %) y una de sus cuatro horas de T (25 %). En todo el eje cambian las cajas (n 14), aparecen series que el padre no mueve («—») y se añade la cuota en la cohorte (12 EUR son el 1,8 % de los que se mueven en todo el eje); la cuota frente al padre no cambia.

**Scened**, igual: `escena()` no mide ningún registro y `recuentos.medidas` es `null`; con `{ medidas: true }`, o después con `medidasDeEscena(eje, escena)`, suma la medida del 8 de cada foco en escena (la misma función, una vez por foco). El render sobrio lo dice en una línea propia (`medidas del 8: bajo demanda …` o `medidas del 8 (suma de n focos): …`).

**En el frontend** (`ui/ocho.js`, enganchado en `app.js`): la celda 8 llama a `ocho` al pintarse (es ahí donde se mide el foco; `mapa()` se pide sin medidas). Arriba, tres botones reales con `aria-pressed` (`hermanos`, `proyecto`, `todo el eje`); la elegida se recuerda en el navegador (`agram.ocho.cohorte`) solo como comodidad, y sin almacenamiento vuelve a hermanos. Debajo, de dónde se lee («entre hermanos · base 1a2b3c4d · sin novedades · n 4» o «sin base escrita (respaldo al vuelo)»), una fila por serie con la cantidad del foco, su caja y su cuota, y en una línea más discreta, marcada «información», los recuentos. Todo envuelve: a 400 px, sin scroll horizontal (un P sobre un registro se enseña con ocho caracteres de su id). En Scened, un botón «medir la escena» pide la suma. El cielo animado (`mundos/cielo.js`, `datosCielo`) lee con `ocho`, la misma función que la celda sobria: una sola verdad.

### 0.5 bis Las formas de la división, por modo

VG, 12-11 (#52): **los modos son cinco** (Pointed, Sequenced, Mapped, Scened y Be, los de `epoch.8.2`, en ese orden) y **las formas de la división de cada mundo (`epoch.8.7`) van por modo, con herencia hacia abajo**. La posición 3 de cada fila es una lista con una hoja por modo; `-` hereda del modo anterior (Sequenced de Pointed, Mapped de Sequenced, Scened de Mapped, Be de Scened). Hoy Mapped lleva las formas de siempre, Sequenced las mismas (apiladas en una columna cuando no caben a lo ancho: eso es píxeles, no dato), Pointed ninguna y Scened y Be heredan de Mapped. `contrato.formaDe(eje, pv, modo, { nivel })` resuelve la herencia; la carta pide `sequenced` en la fila abierta del acordeón y `mapped` en las demás. Detalle y por qué: `docs/CONTRATO.md` §4.2 («Las formas por modo») y `docs/notas/DECISIONES_2026-11-12.md` (#52).

### 0.6 El móvil: vertical Sequenced, apaisado Mapped

VG, 11-11. **En vertical** (más alto que ancho) la carta del móvil es Sequenced (`carta-apilada`, la disposición se describe abajo); **al girarlo a apaisado** es Mapped (la matriz 3 × 3 con sus pasos de tamaño, la pantalla completa de un PV y el aro anclado), sin scroll de página y legible. La decisión sigue siendo de la época por la proporción alto/ancho (`contrato.division`, `epoch.8.3.2`), no del código: 844 × 390, 915 × 412 y 740 × 360 salen Mapped, 400 × 700 apilado.
**Medidas por pantalla**: en apaisado y con menos de 500 px útiles, `carta.js medidasDePantalla` (que `app.js` llama con la ventana entera: sin barra superior desde el #38) reduce el hueco (48), la tarjeta (160) y la línea (30) en proporción al alto, con un mínimo del 60 %; son píxeles de pantalla, no datos del dominio. En vertical y en el ordenador son las de siempre.
**Solo CSS** (`carta/estilo.css`, `@media (orientation:landscape) and (max-height:500px)`): el personaje de cada sitio, los rosetones, los puntitos, las flechas y los mandos como objetivos táctiles de 32 px, y las formas de la pantalla completa con letra más corta; al girar, `app.js` repinta cuando cambia el ancho (no con un campo enfocado).
**Sequenced en vertical, una sola columna** (VG, 11-11 noche): Pointed es la tarjeta del foco y Sequenced le añade el hilo, que es el scroll. Arriba de la columna va el personaje del 0 (VG, 12-11, #38: sustituye a la barra de una línea y su menú; pegajoso, abre la cruceta del 0 de mi alta con las opciones de la barra); cada fila de la tarjeta lleva su interrogante (o su muñeco) a la derecha; no hay rosetones ni franja de comprimidos; abajo, fija, la fila de los diez dígitos en su color (`arbol().secuencia.digitos`).
La tarjeta lleva una fila por PV (`secuencia.filas`, en el orden de los dígitos), cada una un acordeón: cerrada es `NIVEL.comprimido` y abierta `NIVEL.bloque` en `estado.niveles`, y abierta enseña debajo el segundo nivel del PV como Mapped (`nodoLateral` con `rejillaDe`: los hijos con su nombre, sus ocupantes y la regla del vacío; en una columna si no cabe a lo ancho; se entra y se sube por `estado.profundidad`).
El hilo: encima de la tarjeta el pasado (el PV 6 en bloque: sus ocupantes y el diario) y debajo el futuro (el 7), por páginas con el paso de la configuración (`estado.paginas`, «cargar más»); las filas 6 y 7 y sus dígitos llevan a su zona en lugar de abrirse.

## 1. Scened: qué es y qué no es

El mapa (§2.7 [A]) lo describe como unas mil piezas en espacios panorámicos. Scened **no es el render animado** (los mundos llegan después, en el orden de §12: primero la cruz, luego la X): es la composición que un render, sobrio o animado, necesita para enseñar muchas piezas a la vez.

Una escena es una **composición de mapas de Mapped**: cada foco se lee con `mapped.mapa` (sus diez celdas en el camino, su hilo y lo escrito sobre él; sus medidas del 8, solo si se piden: §0.5) y con `tiempo.ejeTemporal` (pasado y futuro con bandas). Scened no recalcula nada de eso a su manera: guarda cada mapa y cada eje temporal tal como salen de sus módulos y añade lo que ninguno de ellos tiene:

1. **un marco común**: el antecesor común de los focos en el hilo y la posición de cada foco en la escena;
2. **las aristas** entre focos: hilo, referencias BTML y referencias de fórmulas BQL;
3. **los recuentos** de toda la escena;
4. **la capacidad** de la escena, con su corte y su aviso, y sus tres cifras (lo conseguido, el mínimo y el máximo de Scened).

## 2. API (`src/scened.js`)

```js
escena(eje, focos, { camino = [], epoca = EPOCA_0, ahora, maximo, capacidad = CAPACIDAD, centro, medidas = false } = {})
escenaDe(eje, foco, { alcance = 'hermanos', ...opciones de escena })   // alcance: 'hermanos' | 'proyecto' | 'general' | 'hilo'
render(escena, nombre = 'sobrio')   // sobrio(escena): texto
medidasDeEscena(eje, escena)        // la suma de la medida del 8 de cada foco, bajo demanda (§0.5)
textoMedidas(suma)                  // su línea en el render sobrio
CAPACIDAD   // 10000 = maximo('scened'): el máximo duro de Scened (VG, 7-11 noche)
ALCANCES    // ['hermanos', 'proyecto', 'general', 'hilo']
ARISTAS     // ['hilo', 'referencia', 'formula']
RENDERS     // { sobrio }
```

| Opción | Qué hace |
|---|---|
| `focos` | ids de registros **en orden de prioridad**: si la escena se corta por la capacidad, entran los primeros. Un repetido cuenta una vez y deja un aviso. Un id desconocido lanza `foco desconocido`; una lista vacía lanza. |
| `camino`, `epoca` | Los de `mapped.mapa`: todos los focos se miran desde el mismo camino y bajo la misma época. La época va por objeto o por nombre (`'época 0'`), como en `mapa`. `camino` llega también a `ejeTemporal` (consolidaciones y lo declarado en 7). |
| `ahora` | El presente de los ejes temporales (por defecto, el reloj). Con `ahora` fijo la escena es reproducible. |
| `maximo` | Registros de hilo, de hijos y de eje temporal que trae cada foco, como en `mapa` y `ejeTemporal` (por defecto, los suyos: 10). Un entero de 0 a 499, como en `mapa` (pedir más es pedir más del máximo, §0.2); si no, lanza `maximo inválido`. El marco usa siempre el hilo entero (§6). |
| `capacidad` | Posiciones como máximo. Por defecto `CAPACIDAD` (10000, el máximo de Scened). Se puede bajar (vistas previas, pruebas), **nunca subir ni quitar**: lo que no es un entero de 1 a 10000 (también `Infinity`) lanza `capacidad inválida … el máximo de Scened es duro; se puede pedir menos, nunca más`. |
| `centro` | Un foco que se marca (`centro: true`, `*` en el render). Si no está entre los focos, lanza. |
| `medidas` | `true`: `recuentos.medidas` suma la medida del 8 de cada foco en escena (`medidasDeEscena`). Por defecto, `false`: componer la escena no mide ningún registro (§0.5). |

`escenaDe` elige los focos y pone el foco como centro y **primero en prioridad** (si hay corte, entra):

- `'hermanos'`, `'proyecto'`, `'general'`: las tres cohortes de §12 tal como las da `tiempo.comparables` (hermanos = escritos sobre el mismo padre; proyecto = el proyecto del foco y lo que cuelga de él; general = todo el eje), en orden de llegada. La cohorte se define en un solo sitio: lo que deja abierto está marcado en `src/tiempo.js` (**[X] decidir VG** allí: qué registro es el proyecto, si la cohorte es todo lo que cuelga de él o solo sus hijos, y **si los hermanos exigen además la misma posición `en`**: hoy la cuenta, anclada en 1, es hermana de lo que cocina escriba en 2). Si cambia allí, cambia aquí.
- `'hilo'`: el foco y sus antecesores hasta el génesis, el más cercano primero (como `sequenced.secuencia` con `sentido: 'hilo'`).

Resultado de `escena` (`escenaDe` añade `alcance`):

| Campo | Contenido |
|---|---|
| `modo` | `'scened'` |
| `comun` | id del antecesor común de los focos en el hilo (`null` si la escena quedó vacía) |
| `camino`, `epoca`, `ahora` | con qué se leyó (`epoca` es el nombre de la época resuelta, también si se pasó por nombre) |
| `focos` | las piezas, en el orden del marco común (§3) |
| `aristas` | `{ tipo, de, a, deId, aId, … }`; `de` y `a` son posiciones en la escena |
| `recuentos` | §5 |
| `cifras` | `{ conseguido, minimo, maximo, alMinimo, necesario }`: posiciones en escena, el mínimo (1000) y el máximo (10000) de Scened, si llega al mínimo y cuántas traería la escena entera sin corte (§6) |
| `corte` | `null`, o `{ capacidad, posicionesEnEscena, necesitaba, foco, fuera }` (§6) |
| `avisos` | textos; el del corte va el primero |

Cada pieza de `focos`: `posicion`, `id`, `autor`, `t`, `sobre`, `en`, `nivel`, `centro`, `hermano: { indice, de }` (entre los focos de la escena con el mismo padre), `hermanosEnEje` (cuántos hay en el eje), `salen` (sus aristas), `entran` (cuántas llegan), `mapa` y `tiempo`. El contenido del foco en el camino está en su `mapa`: `mapa.terminal` si es un terminal (un terminal no tiene posición 0, §12) y, si no, `mapa.celdas`. La escena no elige ninguna posición como «la representación» del foco.

## 3. El marco común

- **Antecesor común.** Todos los registros de un eje comparten el génesis, así que siempre hay uno: el registro más profundo que está en el hilo de todos los focos. Puede ser uno de los focos (el menú en una escena con sus compras) o no (tres compras hermanas sin su menú: el común es el menú, fuera de la escena).
- **Nivel.** Saltos de hilo desde el común: el común es nivel 0; lo escrito sobre él, nivel 1; y así.
- **Posición.** Se recorre el árbol del hilo desde el común **en preorden**, con los hijos de cada registro por **orden de llegada**: cada foco va antes que lo que cuelga de él, y una rama entera va antes que la siguiente. Por eso **dos hermanos no van seguidos** si el primero tiene descendientes en la escena: en la escena [compra, cuenta, segunda compra] la compra va en 0, su cuenta en 1 y la segunda compra en 2. La posición no depende del orden en que se pidieron los focos (ese orden solo decide quién entra si hay corte). **[X] decidir VG:** preorden (lo de hoy: cada rama seguida) o por niveles (los hermanos seguidos y sus descendientes después).
- **Hermanos.** Los focos escritos sobre el mismo registro forman un grupo; cada pieza dice su índice en el grupo y cuántos hermanos tiene en el eje.
- **Las referencias no reordenan.** Una referencia siempre apunta hacia atrás en el eje (un id es el hash de un registro que ya existía), así que entre hermanos el orden de llegada ya deja lo referido antes que lo que lo refiere. Entre ramas distintas una arista de referencia puede apuntar «adelante» en la escena; no se recoloca a nadie. **[X] decidir VG:** si las referencias deben reordenar la escena o solo dibujarse.

## 4. Aristas

| Tipo | De → a | Campos | Cuándo |
|---|---|---|---|
| `hilo` | foco → su antecesor más cercano **que esté en la escena** | `saltos`; si es directo (1 salto), `en`: la dirección donde está anclado | siempre que algún antecesor sea foco |
| `referencia` | foco → foco al que apunta una referencia BTML de su payload | `camino` (dónde está la referencia en el foco que la tiene), `dir` (a qué posición apunta) | cada referencia del payload entero, a cualquier profundidad |
| `formula` | foco → foco nombrado por un `REF` de una fórmula BQL de su payload | `camino`, `dir` | lectura estática del árbol de la fórmula (`bql.analizar`): no se evalúa nada |

Un `REF` da arista con **las mismas reglas con que REF resuelve en BQL** (`src/bql.js`): el primer argumento, un texto literal con el id o un prefijo, con o sin `@`, sin distinguir mayúsculas, hexadecimal y único en el eje; el segundo, si está, un texto literal de diez dígitos (sin él, la raíz `0000000000`). Lo que en BQL da ERROR (referencia mal formada o ambigua, una dirección que no es un texto de diez dígitos, como `"12"` o el número `1200000000`) o PENDIENTE (prefijo ausente del eje) no da arista; una fórmula que no se puede analizar, tampoco. Un `REF` con un argumento calculado (una expresión) depende de evaluar y no se lee aquí. Un `REF` anidado (dentro de `FILTRAR`, `SUMAR`…) sí cuenta. `BUSCAR`, `ACTUAL` y demás dependen de evaluar y no dan aristas. La prueba `lectura estática de REF` contrasta cada caso con `bql.consultar`: hay arista si y solo si BQL lo resuelve, y apunta a lo que BQL lee (sus `dependencias`).

Las referencias (BTML o REF) a registros que no están en la escena no son aristas: se cuentan en `recuentos.referenciasFuera`.

## 5. Recuentos

| Campo | Qué cuenta |
|---|---|
| `pedidos` | focos distintos pedidos |
| `enEscena`, `fuera` | cuántos entraron y cuántos dejó fuera el corte |
| `decuplasEnEscena`, `posicionesEnEscena` | registros que la escena trae (cada uno una vez, §6) y sus posiciones con contenido (§0.1) |
| `capacidad` | la capacidad aplicada (10000 o menos) |
| `grupos` | grupos de hermanos (padres distintos) |
| `aristas` | `{ hilo, referencia, formula }` |
| `referenciasFuera` | referencias a registros fuera de la escena |
| `medidas` | `null`, salvo con `{ medidas: true }`: entonces `{ focos, posiciones, terminales, escritos, movimientos, identidades, profundidadHilo, formulasResueltas, formulasPendientes }`, la suma de la medida única del 8 de cada foco (§0.5) |
| `pasado`, `futuro` | sumas de `totalPasado` y `totalFuturo` de cada eje temporal |

## 6. La capacidad y el corte

**La capacidad de Scened es su máximo: 10000 posiciones con contenido**, `maximo('scened')`. Es **tope duro** (VG, 7-11 noche): el mismo máximo vale para representar y para emitir (`tope('scened')`, que aplica `escribirDesde`, `docs/MOTOR.md` §7.1). La opción `capacidad` solo lo baja.

La escena devuelve siempre sus tres cifras en `cifras`: `conseguido` (las posiciones en escena), `minimo` (1000), `maximo` (10000) y `alMinimo`; y además `necesario`, las posiciones que traería la escena entera sin corte. Una escena por debajo de 1000 no es un error: `alMinimo` es `false` y el render lo dice (`mín 1000 (no llega)`).

Cómo se cuenta:

- Cada registro que la escena trae cuenta **su contenido real** (§0.1, VG 7-11 noche, decisión 10.1): un terminal, una posición; cada ocupante de una lista, uno; una décupla, sus posiciones con contenido. Antes contaba diez por registro.
- Un foco trae: su propio registro; **su hilo entero** hasta el génesis (el marco común y las aristas de hilo salen de él, aunque `mapa.hilo` enseñe solo `maximo`); sus hijos tal como los trae el mapa (hasta `maximo`, y dentro del corte de Mapped, §0.2); y lo que aparece en su eje temporal (hasta `maximo`). Lo que comparten varios focos (el menú, el génesis) se cuenta **una sola vez**: mil compras hermanas traen el contenido de mil compras más el del menú y lo que haya por encima.
- **No se cuentan** los números que los módulos calculan sobre el eje entero sin traer registros a la escena: las medidas del 8 (solo bajo demanda, §0.5), los totales del eje temporal (`totalPasado`, `totalFuturo`) y `hermanosEnEje`. La capacidad limita lo que la escena trae, no lo que el código recorre para calcular esos números (**[X] decidir VG**, §9).
- Los focos entran **en el orden pedido**. Cuando el siguiente llevaría la cuenta por encima de la capacidad, la escena **se corta ahí**: ese foco y todos los que vienen detrás quedan fuera, y nada entra a medias. **[X] decidir VG:** cortar en el primero que no cabe (lo de hoy) o seguir admitiendo los siguientes que aún quepan.
- El corte **nunca es silencioso**: `corte` lo describe, `recuentos.fuera` lo cuenta, `avisos[0]` lo dice («… Trae X de Y posiciones.», con Y = `cifras.necesario`) y el render lo imprime en su última línea. Si no cabe ni el primer foco, la escena queda vacía, con su aviso.

Con mil compras hermanas de diez posiciones cada una, de un menú de nueve escrito sobre el génesis, un terminal (prueba `mil compras hermanas`): el menú y el génesis entran una vez (10), así que entran 999 compras (10 + 999 × 10 = 10000) y la última queda fuera; la escena entera habría traído 10010:

```text
aviso: capacidad de la escena: 10000 posiciones. El foco ……… (1000º de 1000) la llevaría a 10010; la escena se corta ahí y quedan fuera 1 foco: ………. Trae 10000 de 10010 posiciones.
```

Coste: cada foco es un `mapa` y un `ejeTemporal`, también los que quedan fuera (para contar `necesario`); la escena de mil compras tarda en torno a un segundo en Node 24.

## 7. Render sobrio

Una cabecera con el marco común y las cifras (`31 de 10000 posiciones · mín 1000 (no llega) · máx 10000`: lo conseguido de la capacidad, el mínimo y el máximo de Scened); **una línea por foco** con su posición, su nivel (`n0`, `n1`…), el centro (`*`), id, autor, su contenido en el camino (como en Sequenced: el terminal, o las posiciones desarrolladas con su índice), hermanos, pasado y futuro, las **aristas que salen** (con la posición de destino en la escena) y cuántas **entran** (`← n`); una línea de aristas, una de recuentos, una de medidas del 8 (o que se piden bajo demanda) y los avisos.

| En la línea | Significa |
|---|---|
| `0 Compra del menú del día · 1 [3]` | en su posición 0 hay un texto; en la 1, una décupla con tres posiciones |
| `Casa de ejemplo` (sin índice) | el foco es un terminal: no tiene posiciones |
| `hilo→0` | escrito sobre el foco 0 (en su raíz) |
| `hilo→1 en 1000000000` | escrito sobre el foco 1, anclado en su posición 1 |
| `hilo→0 (3 saltos)` | el foco 0 es su antecesor, tres registros más arriba |
| `ref 1.0→0:1000000000` | en su posición 1.0 hay una referencia a la 1000000000 del foco 0 |
| `fórmula 1→1:1200000000` | la fórmula de su posición 1 lee con REF la 1200000000 del foco 1 |
| `hermano 1 de 2 (3 en el eje)` | primero de los dos hermanos que hay en la escena; en el eje son tres |

## 8. Ejemplo ejecutable

La compra del ejemplo, su cuenta (con la fórmula `=REF("b0d35693", "1200000000") + 2 EUR`) y dos compras hermanas más del mismo menú:

```sh
node --input-type=module -e "
import { ejemploCompra, ejemploCuenta } from './ejemplos/ikisai/compra-food.mjs';
import { pagaElCoste, escribirPagando } from './ejemplos/ikisai/coste.mjs';
import { escena, escenaDe, render } from './src/scened.js';
const { eje, menu, compra } = await ejemploCompra();
const cuenta = await ejemploCuenta(eje, compra);
const otra = (t, titulo, n) => escribirPagando(eje, { autor: 'huesped', sobre: menu.id, t, movimientos: [pagaElCoste('huesped'), { token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 12 * n, de: 'huesped', a: 'cocina' }], payload: [titulo, [{ ref: menu.id, dir: '1000000000' }, n, 'EUR ' + 12 * n]] });
const c2 = await otra('2026-11-07T13:40:00Z', 'Segunda compra', 1);
const c3 = await otra('2026-11-07T13:50:00Z', 'Tercera compra', 2);
const ahora = '2026-11-07T15:00:00Z';
console.log(render(escena(eje, [cuenta.id, c3.id, compra.id, c2.id, menu.id], { ahora, medidas: true })));
console.log('---');
console.log(render(escenaDe(eje, compra.id, { alcance: 'hilo', ahora })));
console.log('---');
console.log(render(escenaDe(eje, c2.id, { ahora })));
console.log('---');
console.log(render(escena(eje, [compra.id, c2.id, c3.id, menu.id], { ahora, capacidad: 30 })));
"
```

```text
escena · 5 de 5 focos · común 8d4199fa · época 0 · camino raíz · 31 de 10000 posiciones · mín 1000 (no llega) · máx 10000
0 n0 8d4199fa cocina · 0 Menú del día · 1 [3] · 2 [2] · hermano 1 de 1 · pasado 5 futuro 0 · ← 7
1 n1 1e1b2c84 huesped · 0 Compra del menú del día · 1 [3] · 2 [2] · 3 [2] · 4 [2] · 5 purchase · hermano 1 de 3 · pasado 4 futuro 0 · hilo→0 · ref 1.0.0→0:1000000000 · ref 2.0→0:2000000000 · ← 2
2 n2 2fe61207 cocina · 0 Cuenta del menú · 1 =REF("1e1b2c84", "1200000000") … · 2 =LOCAL(1) + 15 min · 3 ==no es fórmula · hermano 1 de 1 · pasado 4 futuro 0 · hilo→1 en 1000000000 · fórmula 1→1:1200000000
3 n1 540b2400 huesped · 0 Segunda compra · 1 [3] · hermano 2 de 3 · pasado 3 futuro 0 · hilo→0 · ref 1.0→0:1000000000
4 n1 1f6703f7 huesped · 0 Tercera compra · 1 [3] · hermano 3 de 3 · pasado 3 futuro 0 · hilo→0 · ref 1.0→0:1000000000
aristas: hilo 4 · referencia 4 · fórmula 1 · fuera de escena 0
recuentos: grupos 3 · pasado 19 · futuro 0
medidas del 8 (suma de 5 focos): escritos 4 · movimientos 8 · posiciones 17 · identidades 8
---
escena · 4 de 4 focos · común 91778f17 · época 0 · camino raíz · 43 de 10000 posiciones · mín 1000 (no llega) · máx 10000
0 n0 91778f17 casa · Casa de ejemplo · hermano 1 de 1 · pasado 3 futuro 0 · ← 1
1 n1 ed6e0d84 casa · 0 cocina · hermano 1 de 1 (3 en el eje) · pasado 2 futuro 0 · hilo→0 · ← 1
2 n2 8d4199fa cocina · 0 Menú del día · 1 [3] · 2 [2] · hermano 1 de 1 · pasado 5 futuro 0 · hilo→1 · ← 3
3*n3 1e1b2c84 huesped · 0 Compra del menú del día · 1 [3] · 2 [2] · 3 [2] · 4 [2] · 5 purchase · hermano 1 de 1 (3 en el eje) · pasado 4 futuro 0 · hilo→2 · ref 1.0.0→2:1000000000 · ref 2.0→2:2000000000
aristas: hilo 3 · referencia 2 · fórmula 0 · fuera de escena 0
recuentos: grupos 4 · pasado 14 · futuro 0
medidas del 8: bajo demanda (escena con { medidas: true })
---
escena · 3 de 3 focos · común 8d4199fa · época 0 · camino raíz · 31 de 10000 posiciones · mín 1000 (no llega) · máx 10000
0 n1 1e1b2c84 huesped · 0 Compra del menú del día · 1 [3] · 2 [2] · 3 [2] · 4 [2] · 5 purchase · hermano 1 de 3 · pasado 4 futuro 0
1*n1 540b2400 huesped · 0 Segunda compra · 1 [3] · hermano 2 de 3 · pasado 3 futuro 0
2 n1 1f6703f7 huesped · 0 Tercera compra · 1 [3] · hermano 3 de 3 · pasado 3 futuro 0
aristas: hilo 0 · referencia 0 · fórmula 0 · fuera de escena 4
recuentos: grupos 1 · pasado 10 · futuro 0
medidas del 8: bajo demanda (escena con { medidas: true })
---
escena · 2 de 4 focos · común 8d4199fa · época 0 · camino raíz · 27 de 30 posiciones · mín 1000 (no llega) · máx 10000
0 n1 1e1b2c84 huesped · 0 Compra del menú del día · 1 [3] · 2 [2] · 3 [2] · 4 [2] · 5 purchase · hermano 1 de 2 (3 en el eje) · pasado 4 futuro 0
1 n1 540b2400 huesped · 0 Segunda compra · 1 [3] · hermano 2 de 2 (3 en el eje) · pasado 3 futuro 0
aristas: hilo 0 · referencia 0 · fórmula 0 · fuera de escena 3
recuentos: grupos 1 · pasado 7 · futuro 0
medidas del 8: bajo demanda (escena con { medidas: true })
aviso: capacidad de la escena: 30 posiciones. El foco 1f6703f7 (3º de 4) la llevaría a 31; la escena se corta ahí y quedan fuera 2 focos: 1f6703f7 8d4199fa. Trae 27 de 31 posiciones.
```

Lectura de la primera escena: se pidieron en desorden y el marco las coloca por el hilo, en preorden. El menú es el común (n0) y recibe siete aristas: el hilo de las tres compras y sus cuatro referencias. La cuenta (n2) cuelga de la compra anclada en su posición 1 (los recursos) y su fórmula lee la 1.2 de la compra (el precio); por eso va justo detrás de la compra y antes de la segunda compra: las tres compras siguen el orden de llegada, pero no van seguidas. En la segunda, el génesis es un terminal y sale como tal, sin índice. En la última, la compra trae 24 posiciones con contenido (ella, que con el criterio de cerrado en su 2 tiene una más que antes del encargo 3b, el menú, las altas, el génesis y la cuenta escrita encima), la segunda compra suma 4 y la tercera pasaría de 30: se corta ahí y el menú, pedido detrás, también queda fuera.

## 9. Lo que no existe y lo que decide VG

| Pendiente | Hoy |
|---|---|
| Unidad de lo que se cuenta | Decidido (VG, 7-11 noche, 10.1): el contenido real de cada registro traído, una vez (§0.1). |
| **[X] decidir VG:** alcance de lo que se cuenta | Con el hilo entero de cada foco; los números calculados sobre el eje (medidas, totales, hermanos en el eje) no cuentan (§6). |
| **[X] decidir VG:** política de corte | Todos cortan duro (10.2, §0.2). En Scened, en el orden pedido, se corta en el primero que no cabe (§6); en Sequenced y Mapped, igual, por llegada; en Pointed, por índice dentro de la décupla. |
| **[X] decidir VG:** cuántos registros piden Sequenced y Mapped por defecto | Diez de cada, como antes: ahora que cada registro cuenta su contenido, rara vez llegan a su máximo (100 y 1000) ni a su mínimo. |
| **[X] decidir VG:** si el mínimo del modo es también límite duro de la emisión | Solo se informa (`alMinimo`), como hasta ahora. La decisión 10.3 nombra «los mínimos y máximos» como límites duros, pero la 7-11 dice que el mínimo es lo que el modo intenta; no se cambia sin VG. |
| **[X] decidir VG:** orden de la escena | Preorden del hilo: cada rama seguida; los hermanos, por llegada pero no siempre seguidos (§3). |
| **[X] decidir VG:** si las referencias reordenan | Solo son aristas (§3). |
| **[X] decidir VG** en `src/bases.js` (antes en `src/tiempo.js`): las cohortes (qué es el proyecto, si incluye todo lo que cuelga de él, si los hermanos exigen la misma posición `en`) | `escenaDe` usa `tiempo.comparables` tal cual (§2). |
| **[X] decidir VG:** más alcances | `hermanos`, `proyecto`, `general` (las tres cohortes de §12) y `hilo` (linaje hacia arriba). No existe «el hilo hacia abajo» desde el foco (lo escrito encima, recursivo). |
| Escritura desde Scened | Sin formulario: la proporción de Scened está sin fijar (`escritura('scened')` es `null`). Su máximo (10000) es el mismo para la escena y para emitir, y `escribirDesde` lo aplica (`docs/MOTOR.md` §7.1); su mínimo (1000) solo se informa. |
| **[X] decidir VG:** la proporción de Scened y de Be | Sin propuesta: `escritura('scened')` y `escritura('be')` son `null`. Ya no está pendiente el mínimo de Be (VG, 7-11 noche, 10.4): no tiene, responde exactamente lo que se le pide (§0). |
| **[X] decidir VG:** si `ordenDeEscala` llega a rechazar | Solo informa (§0.4); nadie la aplica todavía. |
| Render animado y mundos | Solo el sobrio. El primer mundo animado (`mundos/hilos.js`, en el frontend) anima el eje temporal de un foco, no una escena. |
| Colisiones entre focos (dos focos que ocupan la misma dirección de un tercero) | No son aristas; están en `encaje.ocupantes` de cada registro. |
| Bases del 8 en la escena (confluencia) | La medida del 8 de cada foco se suma bajo demanda (§0.5); no se funden bases. |
| Aristas de BQL evaluado (`BUSCAR`, `ACTUAL`…, o un `REF` con argumentos calculados) | Solo `REF` con argumentos literales, leído en el árbol de la fórmula, sin evaluar (§4). |

## 10. En el frontend: la vista sobria de Scened

Un cuarto botón, **Scened**, junto a Pointed, Sequenced y Mapped (`index.html`). La vista vive en `ui/escena.js`; `app.js` solo la engancha (una rama en `pintar()` y `pintarScened()`). Llama a `escenaDe(estado.eje, estado.foco, { alcance, camino: estado.camino })` tal cual, sin código propio de cohortes. Render sobrio, a 400 px sin desbordar:

- **Alcance**, cuatro botones en el orden de `ALCANCES`: `hermanos`, `proyecto`, `todo el eje` (`general`) e `hilo`. En los cuatro, el foco es el centro y va primero en prioridad; los demás, por llegada (**[X] decidir VG**, §9). El alcance elegido se recuerda en el navegador (`agram.escena.alcance`), como comodidad.
- **Lectura frente al máximo**: «Scened · n de m focos · común · camino · época», una barra de posiciones en escena sobre el máximo y las tres cifras («31 · mín 1000 · máx 10000», con `htmlCifras` de `ui/comun.js` donde la vista las pinte). El máximo es duro (VG, 7-11 noche, §6); la vista no lo cambia.
- **El corte se ve arriba y abajo de la lista**, con el mismo aviso de `escena` (§6), la barra en color de aviso y «n focos fuera» junto a la cifra. Si no cabe ni el foco, la vista lo dice en vez de quedar vacía. Con todo el eje de mil dos registros de diez posiciones (prueba en `test/escena-ui.test.js`), entran mil uno y el aviso dice cuál queda fuera. Pointed, Sequenced y Mapped enseñan su aviso de corte igual, arriba y abajo de lo que traen (§0.2); en Pointed, una posición cortada dice «· cortada» y se sigue abriendo por lo que tiene.
- **Una fila por foco**, en el orden del marco común (§3): posición, id corto, autor, «centro», la representación (`mapa.terminal` si el foco es un terminal, como el génesis, que no tiene posición 0; si no, su posición 0), y debajo nivel, hermanos, pasado, futuro y cuántas aristas entran. La sangría es el nivel, hasta seis.
- **Aristas como enlaces** a la fila de su destino, anclada por id (`#escena-<id>`), no por posición: al recentrar, el enlace sigue llevando al mismo registro. Texto: `hilo → 0 en 1000000000`, `ref 1.0 → 2 : 1000000000`, `fórmula 1 → 3 : 1200000000`; el título de cada una dice qué significa («su posición 1.0 es una referencia a la 1000000000 de …, no copia»).
- **Tocar un foco** lo pone en el centro de la escena (el `data-ir` de siempre); **«Mapped»**, un botón aparte en la fila, abre ese foco en Mapped. **[X] decidir VG:** la propuesta anterior de esta sección era que tocar una fila cambiara el foco y lo abriera en Mapped a la vez; aquí se separan para poder recorrer la escena sin salir de ella.
- **Medidas del 8, bajo demanda** (VG, 8-11, §0.5): debajo de los recuentos, un botón «medir la escena» pide la suma de la medida del 8 de los focos de esa escena; hasta entonces no se mide ninguno. Cambiar de foco, de alcance o de camino vuelve al botón.
- Solo lee: no hay formulario de escritura en Scened mientras su proporción no esté fijada. Sin selector de época propio: usa la época 0. No anima nada: no hay transiciones ni CSS de animación.
