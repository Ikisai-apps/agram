# Los modos de experiencia: de Pointed a Scened

Este documento describe **lo que existe hoy** de los modos de experiencia (mapa global §2.7) y, sobre todo, el modo nuevo: **Scened**, varios focos en escena. Fuente de verdad: `src/modos.js`, `src/pointed.js`, `src/sequenced.js`, `src/mapped.js`, `src/scened.js` y sus pruebas (`test/modos.test.js`, `test/pointed.test.js`, `test/sequenced.test.js`, `test/mapped.test.js`, `test/scened.test.js`). Lo que el mapa no decide se marca «[X] decidir VG». La escritura desde cada modo (registro de salida y proporción) está en `docs/MOTOR.md` §7.

Convenciones, las de `docs/MOTOR.md`: los ejemplos se ejecutan desde la raíz del repositorio con Node ≥ 20 y la salida que sigue a cada uno es la real; el eje de ejemplo es `ejemplos/ikisai/compra-food.mjs` (datos inventados) con ids deterministas: génesis `2d970a48`, alta `a8efd9b0`, menú `d367743b`, compra `d5064f4a`, cuenta `7e00c893`.

## 0. Los modos

| Modo | Piezas (§2.7) | Mínimo | Máximo | Módulo | Qué compone | Renders |
|---|---|---|---|---|---|---|
| Pointed | una décupla | 1 | 10 | `src/pointed.js` | `decupla(ev, epoca)`: las diez posiciones del foco | sobrio |
| Sequenced | unas diez | 10 | 100 | `src/sequenced.js` | `secuencia(eje, id, { sentido })`: el hilo del foco o lo escrito sobre él | sobrio |
| Mapped | unas cien (la 3×3) | 100 | 1000 | `src/mapped.js` | `mapa(eje, id, { camino, epoca })`: matriz 1 8 2 / 6 5 7 / 3 9 4, eje 6·5·7 y medidas del 8 | sobrio |
| **Scened** | unas mil | 1000 | 10000 | `src/scened.js` | `escena(eje, focos, { camino, epoca })`: varios mapas y sus ejes temporales en un marco común | sobrio |
| Be | todos, sin interfaz gráfica | sin fijar (**[X] decidir VG**) | todos (`Infinity`) | solo en `src/modos.js` | — | — |

Las cifras son posiciones (una décupla = diez). La decisión es de VG (7-11 noche):

> «A él le llegan los datos empezando por un único dato. En Pointed hablábamos de 10, en Sequenced de 100, en Mapped de 1000, en Scened de 10.000 y en Be, como que dice todos, porque no tiene interfaz gráfica como tal. Ese es el máximo de datos que se pueden representar. Después tenemos la cantidad de información mínima que cada interfaz quiere intentar representar. No significa que la tenga que representar, porque a lo mejor no tiene información suficiente, pero es la mínima que intenta: Pointed 1, Sequenced 10, Mapped 100, Scened 1000. Ahí tendremos tres números: el que consigue (que a lo mejor es menor), el mínimo y el máximo. Y eso corresponde con los que emite, con los máximos y los mínimos que emite, porque todo lo que no se pueda representar realmente no se puede alterar y por lo tanto no tiene sentido emitirlo.»

**Lectura y emisión comparten los números**: el máximo es duro para representar y para emitir, y el mínimo es lo que el modo intenta en los dos sentidos; no llegar al mínimo no es error, es información.

En `src/modos.js`: `maximo(modo)` y `minimo(modo)`; `lectura(modo)` y `tope(modo)` son alias de `maximo(modo)` (ya son la misma cifra) y `cabeTope` sigue igual. `alcanceDe(conseguido, modo)` da los tres números: `{ conseguido, minimo, maximo, alMinimo }` (`alMinimo` es `null` si el mínimo no está fijado, como en Be).

| Dónde | Los tres números |
|---|---|
| `pointed.decupla` | `alcance`: siempre una décupla, 10 posiciones |
| `sequenced.secuencia` | `alcance`: las décuplas traídas × 10 |
| `mapped.mapa` | `alcance`: el foco, su hilo (hasta `maximo`) y sus hijos (hasta `maximo`), cada registro una vez, × 10 |
| `scened.escena` | `cifras` (con `necesario`, §6): se llama así porque `escenaDe` ya usa `alcance` para la cohorte |
| `salida.escribirSalida` | `alcance` de lo emitido (sin lo heredado) |
| `salida.escribirDesde` | devuelve el evento del eje (congelado y firmado); `salida.alcanceDeRegistro(evento)` da sus tres números |

El frontend los enseña en cada vista junto al nombre del modo, discretos: `Sequenced · 40 · mín 10 · máx 100`.

Tres reglas valen para todos [A/D]: **cambiar de modo no muta el contenido** (un modo solo lee); **sobrio y animado son dos renders de la misma operación** (§10.3; en estos módulos solo existe el sobrio, y pedir `'animado'` lanza «render no disponible»; el primer mundo animado, los hilos del 6 y 7, está en el frontend: `mundos/hilos.js`); y la época va **fuera del dato** (§9): cada modo recibe la época con la que se lee.

`src/index.js` los expone como espacios de nombres: `pointed`, `sequenced`, `mapped`, `scened`.

## 1. Scened: qué es y qué no es

El mapa (§2.7 [A]) lo describe como unas mil piezas en espacios panorámicos. Scened **no es el render animado** (los mundos llegan después, en el orden de §12: primero la cruz, luego la X): es la composición que un render, sobrio o animado, necesita para enseñar muchas piezas a la vez.

Una escena es una **composición de mapas de Mapped**: cada foco se lee con `mapped.mapa` (sus diez celdas en el camino, su hilo, lo escrito sobre él y sus medidas) y con `tiempo.ejeTemporal` (pasado y futuro con bandas). Scened no recalcula nada de eso a su manera: guarda cada mapa y cada eje temporal tal como salen de sus módulos y añade lo que ninguno de ellos tiene:

1. **un marco común**: el antecesor común de los focos en el hilo y la posición de cada foco en la escena;
2. **las aristas** entre focos: hilo, referencias BTML y referencias de fórmulas BQL;
3. **los recuentos** de toda la escena;
4. **la capacidad** de la escena, con su corte y su aviso, y sus tres cifras (lo conseguido, el mínimo y el máximo de Scened).

## 2. API (`src/scened.js`)

```js
escena(eje, focos, { camino = [], epoca = EPOCA_0, ahora, maximo, capacidad = CAPACIDAD, centro } = {})
escenaDe(eje, foco, { alcance = 'hermanos', ...opciones de escena })   // alcance: 'hermanos' | 'proyecto' | 'general' | 'hilo'
render(escena, nombre = 'sobrio')   // sobrio(escena): texto
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
| `maximo` | Registros de hilo, de hijos y de eje temporal que trae cada foco, como en `mapa` y `ejeTemporal` (por defecto, los suyos: 10). Un entero ≥ 0; si no, lanza `maximo inválido`. El marco usa siempre el hilo entero (§6). |
| `capacidad` | Posiciones como máximo. Por defecto `CAPACIDAD` (10000, el máximo de Scened). Se puede bajar (vistas previas, pruebas), **nunca subir ni quitar**: lo que no es un entero de 1 a 10000 (también `Infinity`) lanza `capacidad inválida … el máximo de Scened es duro; se puede pedir menos, nunca más`. |
| `centro` | Un foco que se marca (`centro: true`, `*` en el render). Si no está entre los focos, lanza. |

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
| `decuplasEnEscena`, `posicionesEnEscena` | registros que la escena trae (cada uno una vez, §6) y su equivalente en posiciones (× 10) |
| `capacidad` | la capacidad aplicada (10000 o menos) |
| `grupos` | grupos de hermanos (padres distintos) |
| `aristas` | `{ hilo, referencia, formula }` |
| `referenciasFuera` | referencias a registros fuera de la escena |
| `escritos`, `movimientos`, `posicionesDesarrolladas` | sumas de las medidas del 8 de cada mapa |
| `pasado`, `futuro` | sumas de `totalPasado` y `totalFuturo` de cada eje temporal |

## 6. La capacidad y el corte

**La capacidad de Scened es su máximo: 10000 posiciones**, `maximo('scened')`, mil décuplas de diez. Es **tope duro** (VG, 7-11 noche): el mismo máximo vale para representar y para emitir (`tope('scened')`, que aplica `escribirDesde`, `docs/MOTOR.md` §7.1). La opción `capacidad` solo lo baja.

La escena devuelve siempre sus tres cifras en `cifras`: `conseguido` (las posiciones en escena), `minimo` (1000), `maximo` (10000) y `alMinimo`; y además `necesario`, las posiciones que traería la escena entera sin corte. Una escena por debajo de 1000 no es un error: `alMinimo` es `false` y el render lo dice (`mín 1000 (no llega)`).

Cómo se cuenta:

- Cada registro que la escena trae cuenta **una décupla = diez posiciones**, como en `lectura()`, desarrolle las posiciones que desarrolle. **[X] decidir VG:** contar por décupla traída (lo de hoy) o por posiciones desarrolladas (`contarPosiciones`).
- Un foco trae: su propio registro; **su hilo entero** hasta el génesis (el marco común y las aristas de hilo salen de él, aunque `mapa.hilo` enseñe solo `maximo`); sus hijos tal como los trae el mapa (hasta `maximo`); y lo que aparece en su eje temporal (hasta `maximo`). Lo que comparten varios focos (el menú, el génesis) se cuenta **una sola vez**: mil compras hermanas traen mil décuplas más el menú y lo que haya por encima.
- **No se cuentan** los números que los módulos calculan sobre el eje entero sin traer décuplas a la escena: las medidas del 8 de cada mapa (cuántos escritos, profundidad del hilo), los totales del eje temporal (`totalPasado`, `totalFuturo`) y `hermanosEnEje`. La capacidad limita lo que la escena trae, no lo que el código recorre para calcular esos números (entra en el [X] de la unidad).
- Los focos entran **en el orden pedido**. Cuando el siguiente llevaría la cuenta por encima de la capacidad, la escena **se corta ahí**: ese foco y todos los que vienen detrás quedan fuera, y nada entra a medias. **[X] decidir VG:** cortar en el primero que no cabe (lo de hoy) o seguir admitiendo los siguientes que aún quepan.
- El corte **nunca es silencioso**: `corte` lo describe, `recuentos.fuera` lo cuenta, `avisos[0]` lo dice («… Trae X de Y posiciones.», con Y = `cifras.necesario`) y el render lo imprime en su última línea. Si no cabe ni el primer foco, la escena queda vacía, con su aviso.

Con mil compras hermanas de un menú escrito sobre el génesis (prueba `mil compras hermanas`): cada compra trae su décupla, y el menú y el génesis entran una vez, así que entran 998 compras (2 + 998 = 1000 décuplas = 10000 posiciones) y las dos últimas quedan fuera; la escena entera habría traído 10020:

```text
aviso: capacidad de la escena: 10000 posiciones. El foco ……… (999º de 1000) la llevaría a 10010; la escena se corta ahí y quedan fuera 2 focos: ……… ………. Trae 10000 de 10020 posiciones.
```

Coste: cada foco es un `mapa` y un `ejeTemporal`, también los que quedan fuera (para contar `necesario`); la escena de mil compras tarda en torno a un segundo en Node 24.

## 7. Render sobrio

Una cabecera con el marco común y las cifras (`70 de 10000 posiciones · mín 1000 (no llega) · máx 10000`: lo conseguido de la capacidad, el mínimo y el máximo de Scened); **una línea por foco** con su posición, su nivel (`n0`, `n1`…), el centro (`*`), id, autor, su contenido en el camino (como en Sequenced: el terminal, o las posiciones desarrolladas con su índice), hermanos, pasado y futuro, las **aristas que salen** (con la posición de destino en la escena) y cuántas **entran** (`← n`); una línea de aristas, una de recuentos y los avisos.

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

La compra del ejemplo, su cuenta (con la fórmula `=REF("d5064f4a", "1200000000") + 2 EUR`) y dos compras hermanas más del mismo menú:

```sh
node --input-type=module -e "
import { ejemploCompra, ejemploCuenta } from './ejemplos/ikisai/compra-food.mjs';
import { escena, escenaDe, render } from './src/scened.js';
const { eje, menu, compra } = await ejemploCompra();
const cuenta = await ejemploCuenta(eje, compra);
const otra = (t, titulo, n) => eje.escribir({ autor: 'huesped', sobre: menu.id, t, movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'huesped', a: null }, { token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 12 * n, de: 'huesped', a: 'cocina' }], payload: [titulo, [{ ref: menu.id, dir: '1000000000' }, n, 'EUR ' + 12 * n]] });
const c2 = await otra('2026-11-07T13:40:00Z', 'Segunda compra', 1);
const c3 = await otra('2026-11-07T13:50:00Z', 'Tercera compra', 2);
const ahora = '2026-11-07T15:00:00Z';
console.log(render(escena(eje, [cuenta.id, c3.id, compra.id, c2.id, menu.id], { ahora })));
console.log('---');
console.log(render(escenaDe(eje, compra.id, { alcance: 'hilo', ahora })));
console.log('---');
console.log(render(escenaDe(eje, c2.id, { ahora })));
console.log('---');
console.log(render(escena(eje, [compra.id, c2.id, c3.id, menu.id], { ahora, capacidad: 60 })));
"
```

```text
escena · 5 de 5 focos · común d367743b · época 0 · camino raíz · 70 de 10000 posiciones · mín 1000 (no llega) · máx 10000
0 n0 d367743b cocina · 0 Menú del día · 1 [3] · 2 [2] · hermano 1 de 1 · pasado 5 futuro 0 · ← 7
1 n1 d5064f4a huesped · 0 Compra del menú del día · 1 [3] · 2 [1] · 3 [2] · 4 [2] · hermano 1 de 3 · pasado 4 futuro 0 · hilo→0 · ref 1.0→0:1000000000 · ref 2.0→0:2000000000 · ← 2
2 n2 7e00c893 cocina · 0 Cuenta del menú · 1 =REF("d5064f4a", "1200000000") … · 2 =LOCAL(1) + 15 min · 3 ==no es fórmula · hermano 1 de 1 · pasado 4 futuro 0 · hilo→1 en 1000000000 · fórmula 1→1:1200000000
3 n1 7a81cc50 huesped · 0 Segunda compra · 1 [3] · hermano 2 de 3 · pasado 3 futuro 0 · hilo→0 · ref 1.0→0:1000000000
4 n1 f06e8c67 huesped · 0 Tercera compra · 1 [3] · hermano 3 de 3 · pasado 3 futuro 0 · hilo→0 · ref 1.0→0:1000000000
aristas: hilo 4 · referencia 4 · fórmula 1 · fuera de escena 0
recuentos: grupos 3 · escritos 4 · movimientos 8 · posiciones desarrolladas 16 · pasado 19 · futuro 0
---
escena · 4 de 4 focos · común 2d970a48 · época 0 · camino raíz · 70 de 10000 posiciones · mín 1000 (no llega) · máx 10000
0 n0 2d970a48 casa · Casa de ejemplo · hermano 1 de 1 · pasado 1 futuro 0 · ← 1
1 n1 a8efd9b0 casa · 0 Altas del fin de semana · 1 [2] · hermano 1 de 1 · pasado 2 futuro 0 · hilo→0 · ← 1
2 n2 d367743b cocina · 0 Menú del día · 1 [3] · 2 [2] · hermano 1 de 1 · pasado 5 futuro 0 · hilo→1 · ← 3
3*n3 d5064f4a huesped · 0 Compra del menú del día · 1 [3] · 2 [1] · 3 [2] · 4 [2] · hermano 1 de 1 (3 en el eje) · pasado 4 futuro 0 · hilo→2 · ref 1.0→2:1000000000 · ref 2.0→2:2000000000
aristas: hilo 3 · referencia 2 · fórmula 0 · fuera de escena 0
recuentos: grupos 4 · escritos 6 · movimientos 13 · posiciones desarrolladas 10 · pasado 12 · futuro 0
---
escena · 3 de 3 focos · común d367743b · época 0 · camino raíz · 70 de 10000 posiciones · mín 1000 (no llega) · máx 10000
0 n1 d5064f4a huesped · 0 Compra del menú del día · 1 [3] · 2 [1] · 3 [2] · 4 [2] · hermano 1 de 3 · pasado 4 futuro 0
1*n1 7a81cc50 huesped · 0 Segunda compra · 1 [3] · hermano 2 de 3 · pasado 3 futuro 0
2 n1 f06e8c67 huesped · 0 Tercera compra · 1 [3] · hermano 3 de 3 · pasado 3 futuro 0
aristas: hilo 0 · referencia 0 · fórmula 0 · fuera de escena 4
recuentos: grupos 1 · escritos 1 · movimientos 6 · posiciones desarrolladas 9 · pasado 10 · futuro 0
---
escena · 2 de 4 focos · común d367743b · época 0 · camino raíz · 60 de 60 posiciones · mín 1000 (no llega) · máx 10000
0 n1 d5064f4a huesped · 0 Compra del menú del día · 1 [3] · 2 [1] · 3 [2] · 4 [2] · hermano 1 de 2 (3 en el eje) · pasado 4 futuro 0
1 n1 7a81cc50 huesped · 0 Segunda compra · 1 [3] · hermano 2 de 2 (3 en el eje) · pasado 3 futuro 0
aristas: hilo 0 · referencia 0 · fórmula 0 · fuera de escena 3
recuentos: grupos 1 · escritos 1 · movimientos 4 · posiciones desarrolladas 7 · pasado 7 · futuro 0
aviso: capacidad de la escena: 60 posiciones. El foco f06e8c67 (3º de 4) la llevaría a 70; la escena se corta ahí y quedan fuera 2 focos: f06e8c67 d367743b. Trae 60 de 70 posiciones.
```

Lectura de la primera escena: se pidieron en desorden y el marco las coloca por el hilo, en preorden. El menú es el común (n0) y recibe siete aristas: el hilo de las tres compras y sus cuatro referencias. La cuenta (n2) cuelga de la compra anclada en su posición 1 (los recursos) y su fórmula lee la 1.2 de la compra (el precio); por eso va justo detrás de la compra y antes de la segunda compra: las tres compras siguen el orden de llegada, pero no van seguidas. En la segunda, el génesis es un terminal y sale como tal, sin índice. En la última, la compra trae cinco décuplas (ella, el menú, las altas, el génesis y la cuenta escrita encima), la segunda compra suma una y la tercera pasaría de 60: se corta ahí y el menú, pedido detrás, también queda fuera.

## 9. Lo que no existe y lo que decide VG

| Pendiente | Hoy |
|---|---|
| **[X] decidir VG:** unidad y alcance de lo que se cuenta | Décupla traída × 10, cada registro una vez, con el hilo entero de cada foco; los números calculados sobre el eje (medidas, totales, hermanos en el eje) no cuentan (§6). |
| **[X] decidir VG:** política de corte | En el orden pedido, se corta en el primero que no cabe (§6). |
| **[X] decidir VG:** orden de la escena | Preorden del hilo: cada rama seguida; los hermanos, por llegada pero no siempre seguidos (§3). |
| **[X] decidir VG:** si las referencias reordenan | Solo son aristas (§3). |
| **[X] decidir VG** en `src/tiempo.js`: las cohortes (qué es el proyecto, si incluye todo lo que cuelga de él, si los hermanos exigen la misma posición `en`) | `escenaDe` usa `tiempo.comparables` tal cual (§2). |
| **[X] decidir VG:** más alcances | `hermanos`, `proyecto`, `general` (las tres cohortes de §12) y `hilo` (linaje hacia arriba). No existe «el hilo hacia abajo» desde el foco (lo escrito encima, recursivo). |
| Escritura desde Scened | Sin formulario: la proporción de Scened está sin fijar (`escritura('scened')` es `null`). Su máximo (10000) es el mismo para la escena y para emitir, y `escribirDesde` lo aplica (`docs/MOTOR.md` §7.1); su mínimo (1000) solo se informa. |
| **[X] decidir VG:** el mínimo de Be y la proporción de Scened y de Be | `minimo('be')` es `null` y `escritura('scened')`, `escritura('be')` son `null`. |
| Render animado y mundos | Solo el sobrio. El primer mundo animado (`mundos/hilos.js`, en el frontend) anima el eje temporal de un foco, no una escena. |
| Colisiones entre focos (dos focos que ocupan la misma dirección de un tercero) | No son aristas; están en `encaje.ocupantes` de cada registro. |
| Bases del 8 en la escena (confluencia) | Las medidas de cada mapa se suman; no se funden bases. |
| Aristas de BQL evaluado (`BUSCAR`, `ACTUAL`…, o un `REF` con argumentos calculados) | Solo `REF` con argumentos literales, leído en el árbol de la fórmula, sin evaluar (§4). |

## 10. En el frontend: la vista sobria de Scened

Un cuarto botón, **Scened**, junto a Pointed, Sequenced y Mapped (`index.html`). La vista vive en `ui/escena.js`; `app.js` solo la engancha (una rama en `pintar()` y `pintarScened()`). Llama a `escenaDe(estado.eje, estado.foco, { alcance, camino: estado.camino })` tal cual, sin código propio de cohortes. Render sobrio, a 400 px sin desbordar:

- **Alcance**, cuatro botones en el orden de `ALCANCES`: `hermanos`, `proyecto`, `todo el eje` (`general`) e `hilo`. En los cuatro, el foco es el centro y va primero en prioridad; los demás, por llegada (**[X] decidir VG**, §9). El alcance elegido se recuerda en el navegador (`agram.escena.alcance`), como comodidad.
- **Lectura frente al máximo**: «Scened · n de m focos · común · camino · época», una barra de posiciones en escena sobre el máximo y las tres cifras («70 · mín 1000 · máx 10000», con `htmlCifras` de `ui/comun.js` donde la vista las pinte). El máximo es duro (VG, 7-11 noche, §6); la vista no lo cambia.
- **El corte se ve arriba y abajo de la lista**, con el mismo aviso de `escena` (§6), la barra en color de aviso y «n focos fuera» junto a la cifra. Si no cabe ni el foco, la vista lo dice en vez de quedar vacía. Con todo el eje de mil dos registros (prueba en `test/escena-ui.test.js`), entran mil y el aviso dice cuáles quedan fuera.
- **Una fila por foco**, en el orden del marco común (§3): posición, id corto, autor, «centro», la representación (`mapa.terminal` si el foco es un terminal, como el génesis, que no tiene posición 0; si no, su posición 0), y debajo nivel, hermanos, pasado, futuro y cuántas aristas entran. La sangría es el nivel, hasta seis.
- **Aristas como enlaces** a la fila de su destino, anclada por id (`#escena-<id>`), no por posición: al recentrar, el enlace sigue llevando al mismo registro. Texto: `hilo → 0 en 1000000000`, `ref 1.0 → 2 : 1000000000`, `fórmula 1 → 3 : 1200000000`; el título de cada una dice qué significa («su posición 1.0 es una referencia a la 1000000000 de …, no copia»).
- **Tocar un foco** lo pone en el centro de la escena (el `data-ir` de siempre); **«Mapped»**, un botón aparte en la fila, abre ese foco en Mapped. **[X] decidir VG:** la propuesta anterior de esta sección era que tocar una fila cambiara el foco y lo abriera en Mapped a la vez; aquí se separan para poder recorrer la escena sin salir de ella.
- Solo lee: no hay formulario de escritura en Scened mientras su proporción no esté fijada. Sin selector de época propio: usa la época 0. No anima nada: no hay transiciones ni CSS de animación.
