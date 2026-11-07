# Los modos de experiencia: de Pointed a Scened

Este documento describe **lo que existe hoy** de los modos de experiencia (mapa global §2.7) y, sobre todo, el modo nuevo: **Scened**, varios focos en escena. Fuente de verdad: `src/modos.js`, `src/pointed.js`, `src/sequenced.js`, `src/mapped.js`, `src/scened.js` y sus pruebas (`test/modos.test.js`, `test/pointed.test.js`, `test/sequenced.test.js`, `test/mapped.test.js`, `test/scened.test.js`). Lo que el mapa no decide se marca «[X] decidir VG». La escritura desde cada modo (registro de salida y proporción) está en `docs/MOTOR.md` §7.

Convenciones, las de `docs/MOTOR.md`: los ejemplos se ejecutan desde la raíz del repositorio con Node ≥ 20 y la salida que sigue a cada uno es la real; el eje de ejemplo es `ejemplos/ikisai/compra-food.mjs` (datos inventados) con ids deterministas: génesis `6c1c5968`, alta `ccf5a120`, menú `4598f23e`, compra `f9e59d1e`, cuenta `c70bfa6e`.

## 0. Los modos

| Modo | Piezas (§2.7) | Lee de una vez | Módulo | Qué compone | Renders |
|---|---|---|---|---|---|
| Pointed | una décupla | 10 posiciones | `src/pointed.js` | `decupla(ev, epoca)`: las diez posiciones del foco | sobrio |
| Sequenced | unas diez | 100 | `src/sequenced.js` | `secuencia(eje, id, { sentido })`: el hilo del foco o lo escrito sobre él | sobrio |
| Mapped | unas cien (la 3×3) | 1000 | `src/mapped.js` | `mapa(eje, id, { camino, epoca })`: matriz 1 8 2 / 6 5 7 / 3 9 4, eje 6·5·7 y medidas del 8 | sobrio |
| **Scened** | unas mil | **10000** (tope duro) | `src/scened.js` | `escena(eje, focos, { camino, epoca })`: varios mapas y sus ejes temporales en un marco común | sobrio |
| Be / Dragón | sin cardinalidad | — | no existe | — | — |

«Lee de una vez» es `lectura(modo)` de `src/modos.js`: décuplas × 10. Tres reglas valen para todos [A/D]: **cambiar de modo no muta el contenido** (un modo solo lee); **sobrio y animado son dos renders de la misma operación** (§10.3; hoy solo existe el sobrio, y pedir `'animado'` lanza «render no disponible»); y la época va **fuera del dato** (§9): cada modo recibe la época con la que se lee.

`src/index.js` los expone como espacios de nombres: `pointed`, `sequenced`, `mapped`, `scened`.

## 1. Scened: qué es y qué no es

El mapa (§2.7) lo describe como unas mil piezas en espacios panorámicos; §12 le pone un **tope duro de 10000**. Scened **no es el render animado** (los mundos llegan después, en el orden de §12: primero la cruz, luego la X): es la composición que un render, sobrio o animado, necesita para enseñar muchas piezas a la vez.

Una escena es una **composición de mapas de Mapped**: cada foco se lee con `mapped.mapa` (sus diez celdas en el camino, su hilo, lo escrito sobre él y sus medidas) y con `tiempo.ejeTemporal` (pasado y futuro con bandas). Scened no recalcula nada de eso a su manera: guarda cada mapa y cada eje temporal tal como salen de sus módulos y añade lo que ninguno de ellos tiene:

1. **un marco común**: el antecesor común de los focos en el hilo y la posición de cada foco en la escena;
2. **las aristas** entre focos: hilo, referencias BTML y referencias de fórmulas BQL;
3. **los recuentos** de toda la escena;
4. **el tope** de Scened, con su corte y su aviso.

## 2. API (`src/scened.js`)

```js
escena(eje, focos, { camino = [], epoca = EPOCA_0, ahora, maximo, tope = TOPE, centro } = {})
escenaDe(eje, foco, { alcance = 'hermanos', ...opciones de escena })   // alcance: 'hermanos' | 'hilo'
render(escena, nombre = 'sobrio')   // sobrio(escena): texto
TOPE        // 10000 = lectura('scened')
ALCANCES    // ['hermanos', 'hilo']
ARISTAS     // ['hilo', 'referencia', 'formula']
RENDERS     // { sobrio }
```

| Opción | Qué hace |
|---|---|
| `focos` | ids de registros **en orden de prioridad**: si la escena se corta por el tope, entran los primeros. Un repetido cuenta una vez y deja un aviso. Un id desconocido lanza `foco desconocido`; una lista vacía lanza. |
| `camino`, `epoca` | Los de `mapped.mapa`: todos los focos se miran desde el mismo camino y bajo la misma época. `camino` llega también a `ejeTemporal` (consolidaciones y lo declarado en 7). |
| `ahora` | El presente de los ejes temporales (por defecto, el reloj). Con `ahora` fijo la escena es reproducible. |
| `maximo` | Décuplas de hilo y de hijos por foco, como en `mapa` y `ejeTemporal` (por defecto, las suyas: 10). |
| `tope` | Posiciones leídas como máximo. Por defecto y **como máximo** el de Scened (10000): se puede bajar (vistas previas, pruebas), no subir; pasarlo lanza `el tope de Scened es 10000 posiciones leídas`. |
| `centro` | Un foco que se marca (`centro: true`, `*` en el render). Si no está entre los focos, lanza. |

`escenaDe` elige los focos y pone el foco como centro y **primero en prioridad** (si hay corte, entra):

- `'hermanos'`: el foco y los registros escritos sobre su mismo padre, por orden de llegada. Son los comparables accesibles del 8 (`tiempo.comparar`) y la cohorte «hermanos» de §12.
- `'hilo'`: el foco y sus antecesores hasta el génesis, el más cercano primero (como `sequenced.secuencia` con `sentido: 'hilo'`).

Resultado de `escena` (`escenaDe` añade `alcance`):

| Campo | Contenido |
|---|---|
| `modo` | `'scened'` |
| `comun` | id del antecesor común de los focos en el hilo (`null` si la escena quedó vacía) |
| `camino`, `epoca`, `ahora` | con qué se leyó (`epoca` es su nombre) |
| `focos` | las piezas, en el orden del marco común (abajo) |
| `aristas` | `{ tipo, de, a, deId, aId, … }`; `de` y `a` son posiciones en la escena |
| `recuentos` | §5 |
| `corte` | `null`, o `{ tope, posicionesLeidas, necesitaba, foco, fuera }` (§6) |
| `avisos` | textos; el del corte va el primero |

Cada pieza de `focos`: `posicion`, `id`, `autor`, `t`, `sobre`, `en`, `nivel`, `centro`, `hermano: { indice, de }` (entre los focos de la escena con el mismo padre), `hermanosEnEje` (cuántos hay en el eje), `representacion` (la celda 0 del mapa en el camino; si el payload ahí es un terminal, que no tiene posición 0, el propio terminal: `mapa.terminal`), `salen` (sus aristas), `entran` (cuántas llegan), `mapa` y `tiempo`.

## 3. El marco común

- **Antecesor común.** Todos los registros de un eje comparten el génesis, así que siempre hay uno: el registro más profundo que está en el hilo de todos los focos. Puede ser uno de los focos (el menú en una escena con sus compras) o no (tres compras hermanas sin su menú: el común es el menú, fuera de la escena).
- **Nivel.** Saltos de hilo desde el común: el común es nivel 0; lo escrito sobre él, nivel 1; y así.
- **Posición.** Se recorre el árbol del hilo desde el común: el antecesor antes que sus descendientes, y los hermanos juntos por **orden de llegada**. La posición no depende del orden en que se pidieron los focos (ese orden solo decide quién entra si hay corte).
- **Hermanos.** Los focos escritos sobre el mismo registro forman un grupo; cada pieza dice su índice en el grupo y cuántos hermanos tiene en el eje.
- **Las referencias no reordenan.** Una referencia siempre apunta hacia atrás en el eje (un id es el hash de un registro que ya existía), así que entre hermanos el orden de llegada ya deja lo referido antes que lo que lo refiere. Entre ramas distintas una arista de referencia puede apuntar «adelante» en la escena; no se recoloca a nadie. **[X] decidir VG:** si las referencias deben reordenar la escena o solo dibujarse.

## 4. Aristas

| Tipo | De → a | Campos | Cuándo |
|---|---|---|---|
| `hilo` | foco → su antecesor más cercano **que esté en la escena** | `saltos`; si es directo (1 salto), `en`: la dirección donde está anclado | siempre que algún antecesor sea foco |
| `referencia` | foco → foco al que apunta una referencia BTML de su payload | `camino` (dónde está la referencia en el foco que la tiene), `dir` (a qué posición apunta) | cada referencia del payload entero, a cualquier profundidad |
| `formula` | foco → foco nombrado por un `REF("id o prefijo", "dir"?)` de una fórmula BQL de su payload | `camino`, `dir` | lectura estática del árbol de la fórmula (`bql.analizar`): no se evalúa nada |

Las referencias (BTML o REF) a registros que no están en la escena no son aristas: se cuentan en `recuentos.referenciasFuera`. Un REF que no se resuelve (prefijo ambiguo o desconocido, dirección que no es de diez dígitos) o una fórmula que no se puede analizar no cuentan: lo dirá BQL al evaluar. Un REF anidado (dentro de `FILTRAR`, `SUMAR`…) sí cuenta. `BUSCAR`, `ACTUAL` y demás dependen de evaluar y no dan aristas.

## 5. Recuentos

| Campo | Qué cuenta |
|---|---|
| `pedidos` | focos distintos pedidos |
| `enEscena`, `fuera` | cuántos entraron y cuántos dejó fuera el corte |
| `decuplasLeidas`, `posicionesLeidas` | registros leídos (cada uno una vez) y su equivalente en posiciones (× 10) |
| `tope` | el tope aplicado |
| `grupos` | grupos de hermanos (padres distintos) |
| `aristas` | `{ hilo, referencia, formula }` |
| `referenciasFuera` | referencias a registros fuera de la escena |
| `escritos`, `movimientos`, `posicionesDesarrolladas` | sumas de las medidas del 8 de cada mapa |
| `pasado`, `futuro` | sumas de `totalPasado` y `totalFuturo` de cada eje temporal |

## 6. El tope y el corte

**El tope de Scened es 10000 posiciones leídas** (§12), que es lo que Scened lee de una vez: `lectura('scened')`, mil décuplas de diez. Coincide en número con el tope duro de **escritura** de Scened (10000 posiciones emitidas, §12: `tope('scened')` en `src/modos.js`, desde la #40), que es otra cosa: aquí no se escribe.

Cómo se cuenta:

- Cada registro cuya décupla lee la escena cuenta **una décupla = diez posiciones**, como en `lectura()`, desarrolle las posiciones que desarrolle. **[X] decidir VG:** contar por décupla leída (lo de hoy) o por posiciones desarrolladas (`contarPosiciones`).
- Un foco lee: su propio registro, su hilo y sus hijos tal como los trae el mapa (hasta `maximo` cada uno) y lo que aparece en su eje temporal. Lo que comparten varios focos (el menú, el génesis) se lee **una sola vez**: mil compras hermanas leen mil décuplas más el menú y lo que haya por encima.
- Los focos entran **en el orden pedido**. Cuando el siguiente llevaría la lectura por encima del tope, la escena **se corta ahí**: ese foco y todos los que vienen detrás quedan fuera, y nada se lee a medias. **[X] decidir VG:** cortar en el primero que no cabe (lo de hoy) o seguir admitiendo los siguientes que aún quepan.
- El corte **nunca es silencioso**: `corte` lo describe, `recuentos.fuera` lo cuenta, `avisos[0]` lo dice y el render lo imprime en su última línea. Si no cabe ni el primer foco, la escena queda vacía, con su aviso.

Con mil compras hermanas de un menú escrito sobre el génesis (prueba `mil compras hermanas`): cada compra lee su décupla, y el menú y el génesis se leen una vez, así que entran 998 compras (2 + 998 = 1000 décuplas = 10000 posiciones) y las dos últimas quedan fuera:

```text
aviso: tope de Scened: 10000 posiciones leídas. El foco ……… (999º de 1000) llevaría la lectura a 10010; la escena se corta ahí y quedan fuera 2 focos: ……… ………
```

Coste: cada foco es un `mapa` y un `ejeTemporal`; la escena de mil compras tarda en torno a un segundo en Node 24.

## 7. Render sobrio

Una cabecera con el marco común y la lectura; **una línea por foco** con su posición, su nivel (`n0`, `n1`…), el centro (`*`), id, autor, representación, hermanos, pasado y futuro, las **aristas que salen** (con la posición de destino en la escena) y cuántas **entran** (`← n`); una línea de aristas, una de recuentos y los avisos.

| En la línea | Significa |
|---|---|
| `hilo→0` | escrito sobre el foco 0 (en su raíz) |
| `hilo→1 en 1000000000` | escrito sobre el foco 1, anclado en su posición 1 |
| `hilo→0 (3 saltos)` | el foco 0 es su antecesor, tres registros más arriba |
| `ref 1.0→0:1000000000` | en su posición 1.0 hay una referencia a la 1000000000 del foco 0 |
| `fórmula 1→1:1200000000` | la fórmula de su posición 1 lee con REF la 1200000000 del foco 1 |
| `hermano 1 de 2 (3 en el eje)` | primero de los dos hermanos que hay en la escena; en el eje son tres |

## 8. Ejemplo ejecutable

La compra del ejemplo, su cuenta (con la fórmula `=REF("f9e59d1e", "1200000000") + 2 EUR`) y dos compras hermanas más del mismo menú:

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
console.log(render(escena(eje, [compra.id, c2.id, c3.id, menu.id], { ahora, tope: 60 })));
"
```

```text
escena · 5 de 5 focos · común 4598f23e · época 0 · camino raíz · 70 de 10000 posiciones leídas
0 n0 4598f23e cocina Menú del día · hermano 1 de 1 · pasado 5 futuro 0 · ← 7
1 n1 f9e59d1e huesped Compra del menú del día · hermano 1 de 3 · pasado 4 futuro 0 · hilo→0 · ref 1.0→0:1000000000 · ref 2.0→0:2000000000 · ← 2
2 n2 c70bfa6e cocina Cuenta del menú · hermano 1 de 1 · pasado 4 futuro 0 · hilo→1 en 1000000000 · fórmula 1→1:1200000000
3 n1 290a9176 huesped Segunda compra · hermano 2 de 3 · pasado 3 futuro 0 · hilo→0 · ref 1.0→0:1000000000
4 n1 e4543ae2 huesped Tercera compra · hermano 3 de 3 · pasado 3 futuro 0 · hilo→0 · ref 1.0→0:1000000000
aristas: hilo 4 · referencia 4 · fórmula 1 · fuera de escena 0
recuentos: grupos 3 · escritos 4 · movimientos 8 · posiciones 16 · pasado 19 · futuro 0
---
escena · 4 de 4 focos · común 6c1c5968 · época 0 · camino raíz · 70 de 10000 posiciones leídas
0 n0 6c1c5968 casa Casa de ejemplo · hermano 1 de 1 · pasado 1 futuro 0 · ← 1
1 n1 ccf5a120 casa Altas del fin de semana · hermano 1 de 1 · pasado 2 futuro 0 · hilo→0 · ← 1
2 n2 4598f23e cocina Menú del día · hermano 1 de 1 · pasado 5 futuro 0 · hilo→1 · ← 3
3*n3 f9e59d1e huesped Compra del menú del día · hermano 1 de 1 (3 en el eje) · pasado 4 futuro 0 · hilo→2 · ref 1.0→2:1000000000 · ref 2.0→2:2000000000
aristas: hilo 3 · referencia 2 · fórmula 0 · fuera de escena 0
recuentos: grupos 4 · escritos 6 · movimientos 13 · posiciones 10 · pasado 12 · futuro 0
---
escena · 3 de 3 focos · común 4598f23e · época 0 · camino raíz · 70 de 10000 posiciones leídas
0 n1 f9e59d1e huesped Compra del menú del día · hermano 1 de 3 · pasado 4 futuro 0
1*n1 290a9176 huesped Segunda compra · hermano 2 de 3 · pasado 3 futuro 0
2 n1 e4543ae2 huesped Tercera compra · hermano 3 de 3 · pasado 3 futuro 0
aristas: hilo 0 · referencia 0 · fórmula 0 · fuera de escena 4
recuentos: grupos 1 · escritos 1 · movimientos 6 · posiciones 9 · pasado 10 · futuro 0
---
escena · 2 de 4 focos · común 4598f23e · época 0 · camino raíz · 60 de 60 posiciones leídas
0 n1 f9e59d1e huesped Compra del menú del día · hermano 1 de 2 (3 en el eje) · pasado 4 futuro 0
1 n1 290a9176 huesped Segunda compra · hermano 2 de 2 (3 en el eje) · pasado 3 futuro 0
aristas: hilo 0 · referencia 0 · fórmula 0 · fuera de escena 3
recuentos: grupos 1 · escritos 1 · movimientos 4 · posiciones 7 · pasado 7 · futuro 0
aviso: tope de Scened: 60 posiciones leídas. El foco e4543ae2 (3º de 4) llevaría la lectura a 70; la escena se corta ahí y quedan fuera 2 focos: e4543ae2 4598f23e
```

Lectura de la primera escena: se pidieron en desorden y el marco las coloca por el hilo. El menú es el común (n0) y recibe siete aristas: el hilo de las tres compras y sus cuatro referencias. La cuenta (n2) cuelga de la compra anclada en su posición 1 (los recursos) y su fórmula lee la 1.2 de la compra (el precio). En la última, la compra lee cinco décuplas (ella, el menú, las altas, el génesis y la cuenta escrita encima), la segunda compra suma una y la tercera pasaría de 60: se corta ahí y el menú, pedido detrás, también queda fuera.

## 9. Lo que no existe y lo que decide VG

| Pendiente | Hoy |
|---|---|
| **[X] decidir VG:** unidad del tope de lectura | Décupla leída × 10, cada registro una vez (§6). |
| **[X] decidir VG:** política de corte | En el orden pedido, se corta en el primero que no cabe (§6). |
| **[X] decidir VG:** si las referencias reordenan | Solo son aristas (§3). |
| **[X] decidir VG:** más alcances | `hermanos` y `hilo` (linaje hacia arriba). Las tres cohortes de §12 son hermanos, linaje/proyecto y general (el ámbito): «general» no tiene alcance todavía, ni lo tiene «el hilo hacia abajo» (lo escrito encima, recursivo). |
| Escritura desde Scened | Sin formulario: la proporción de Scened está sin fijar (`escritura('scened')` es `null`). El tope de emisión (10000) ya está (`tope('scened')`, desde la #40) y `escribirDesde` lo aplica (`docs/MOTOR.md` §7.1). |
| Render animado y mundos | Solo el sobrio. |
| Colisiones entre focos (dos focos que ocupan la misma dirección de un tercero) | No son aristas; están en `encaje.ocupantes` de cada registro. |
| Bases del 8 en la escena (confluencia) | Las medidas de cada mapa se suman; no se funden bases. |
| Aristas de BQL evaluado (`BUSCAR`, `ACTUAL`…) | Solo `REF` leído en el árbol de la fórmula, sin evaluar. |

## 10. Cómo entraría en el frontend

`app.js` no cambia en esta pieza. Entraría así: un cuarto botón `data-modo="scened"` en `index.html`; en `app.js`, `scened` desde `./src/index.js` y un `pintarScened()` que llame a `scened.escenaDe(estado.eje, estado.foco, { alcance, camino: estado.camino })` con un selector `hermanos | hilo`; una fila por foco con los mismos datos que el render sobrio (posición, nivel como sangría, aristas como enlaces a la posición de destino); tocar una fila cambia el foco y abre ese foco en Mapped; el aviso de corte, visible arriba y abajo de la lista. Sin formulario de escritura en Scened mientras su proporción no esté fijada.
