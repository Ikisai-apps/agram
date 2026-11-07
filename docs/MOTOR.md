# El motor AGRAM: el ciclo tal como existe

AGRAM es el motor: la ejecución real sobre la estructura de datos (BTML, `docs/BTML.md`) y la lógica de vistas (BQL, `docs/BQL.md`). Este documento describe **lo que existe hoy** en `src/motor.js`, `src/escritura.js`, `src/modos.js`, `src/tiempo.js` y `src/persistencia.js`, con firmas de funciones, tablas y ejemplos ejecutados con Node 24 desde la raíz del repositorio. Lo que no existe se marca «pendiente». Fuente de verdad: esos cinco módulos y `test/motor.test.js`, `test/escritura.test.js`, `test/modos.test.js`, `test/fabrica-1000.test.js`, `test/tiempo.test.js`, `test/persistencia.test.js`, `test/eprt.test.js`, `test/vector.test.js`.

Convenciones:

- Los ejemplos se ejecutan **desde la raíz del repositorio** con `node --input-type=module -e "..."` (Node ≥ 20). La salida que sigue a cada ejemplo es la salida real.
- El eje de ejemplo es `ejemplos/ikisai/compra-food.mjs` (datos inventados). Sus ids son deterministas (hash del cuerpo con `t` fijo): génesis `6c1c5968`, alta `ccf5a120`, menú `4598f23e`, compra `f9e59d1e`, cuenta `c70bfa6e`. En las salidas los ids se acortan a ocho caracteres con `corto`. `docs/BTML.md` y `docs/BQL.md` citan los mismos ids.
- Toda escritura recibe `t` explícito. `escribirDesde` y `ejecutar` usan `new Date().toISOString()` si falta, y entonces los ids no son reproducibles.
- Un «registro» y un «evento» son lo mismo. El «foco» es el registro sobre el que se trabaja. Una «consolidación» es el registro que escribe `consolidar`.

## 0. Mapa de módulos

| Módulo | Qué define | Exports |
|---|---|---|
| `src/motor.js` | El ciclo de la fábrica (PV4) | `descubrir`, `proponer`, `consolidar`, `autorizar`, `ejecutar`, `puedeAutorizar`, `autorizacionesValidas`, `estadoDe`, `consolidaciones`, `caminoVisible`, `FABRICA`, `FASES`, `OPERADORES`, `CLASE_EJECUTADO` |
| `src/escritura.js` | El registro de salida de cada modo; la matriz 10×10×10 de la fábrica | `item`, `resolverRef`, `desdePointed`, `desdeSequenced`, `desdeMapped`, `ubicar`, `costeT`, `escribirDesde`, `escribirSalida`, `CLASES`, `claseDe`, `esReferencia` |
| `src/modos.js` | Capacidad de lectura, tope duro y proporción por modo | `MODOS`, `nombreModo`, `lectura`, `tope`, `escritura`, `contarPosiciones`, `cabeTope`, `cabeEscritura`, `proporcion` |
| `src/tiempo.js` | Eje temporal (PV6/PV7) y comparabilidad (PV8) | `banda`, `ejeTemporal`, `medir`, `comparar`, `HITOS` |
| `src/persistencia.js` | Guardar y reconstruir el eje | `serializar`, `restaurar`, `guardarLocal`, `cargarLocal`, `borrarLocal`, `VERSION` |

`src/index.js` reexporta `modos.js` en plano y los demás como espacios de nombres: `motor`, `salida` (= `escritura.js`), `tiempo`, `persistencia`. Es decir: `import { motor, salida, tiempo, persistencia, lectura } from './src/index.js'`.

Dependencias: el motor lee el eje (`src/eje.js`), el encaje (`src/encaje.js`, `ocupantes`, `vector`, `signo`) y BQL (`src/bql.js`, `evaluar`), y escribe con `escribirDesde` y `eje.escribir`. `tiempo.js` usa `consolidaciones` del motor.

## 1. El ciclo

Cuatro pasos sobre un foco: **descubrir → consolidar → autorizar → ejecutar**. Los tres últimos son eventos normales del eje (transiciones de tokens con payload BTML), anclados en la fábrica del foco (posición 4) y encadenados por `sobre`; por eso la evidencia es el propio hilo: ejecución → consolidación → foco → … → génesis. Nada se borra ni se modifica en sitio.

| Paso | Función | Quién | Escribe (`payload`) | `sobre` / `en` | `contexto` | Mueve |
|---|---|---|---|---|---|---|
| descubrir | `descubrir(eje, foco, { camino, posiciones })` | cualquiera | nada | — | — | nada |
| consolidar | `consolidar(eje, { autor, foco, elecciones, titulo, t, camino }, privada)` | cualquier identidad con T | `[titulo, elección 1, …, elección n]` | foco / `direccion([...camino, 4])` | `{ motor: 'fabrica', fase: 'consolidado', fuentes, encaje, modo: 'mapped' }`; cada entrada de `encaje` lleva su `clase` | T del autor: 1 minuto por posición |
| autorizar | `autorizar(eje, { autorizante, consolidacion, t, nota }, privada)` | identidad con P > 0 sobre la consolidación y distinta del autor | `'==' + nota` | consolidación / `FABRICA` | `{ motor: 'fabrica', fase: 'autorizado', modo: 'pointed' }` | T del autorizante: 1 minuto |
| ejecutar | `ejecutar(eje, { autor, consolidacion, movimientos, t, titulo }, privada)` | el autor de la consolidación | `[titulo, { ref: consolidación }, { ref: autorización }]` | consolidación / `FABRICA` | `{ motor: 'fabrica', fase: 'ejecutado', evidencia: [consolidación, autorización], clase: 4 }` | T del autor: 1 minuto, más `movimientos` |

Constantes: `FABRICA = '4000000000'` (la posición 4 en la raíz del foco); `FASES = ['consolidado', 'autorizado', 'ejecutado']` (los valores de `contexto.fase`); `CLASE_EJECUTADO = 4` (la clase de modificación del registro ejecutado: acción, §7.2).

Estados de una consolidación (`estadoDe`): `PENDIENTE DE AUTORIZACIÓN` → `AUTORIZADO` → `EJECUTADO`. No se guardan: se calculan cada vez a partir de lo escrito sobre la consolidación en `FABRICA` por quien puede (§6).

Reglas de fondo, tal como están en el código:

- **Consolidar no es ejecutar.** La consolidación solo mueve el T de escribir; E, P y R se mueven en `ejecutar`, y solo si el autor los pasa en `movimientos`.
- **La posición no da autoridad.** Cualquiera consolida; autoriza quien tiene poder (P) sobre el registro; ejecuta el autor. Es la regla V0, un hueco provisional hasta que exista AARPIA (§4.1).
- **Elegir no publica.** `ELEGIR` de BQL devuelve una colección; la única fijación es `consolidar`, y no borra alternativas: las elecciones se guardan como referencias a sus fuentes, con el vector de encaje de cada una.
- **Cada cambio tiene clase.** La fábrica parte de la matriz de 100 del foco y emite solo lo modificado, en la matriz 10×10×10 (posición × subposición × clase de modificación); la clase es el tercer dígito bajo la época 0 (§7.2). La consolidación guarda la clase de cada elección y la ejecución es clase 4 (acción).
- **Todo cuesta tiempo.** Cada registro mueve T del autor: un minuto por posición escrita (cartón piedra, §7.3). Es el token `T:minuto`: cada escala de T es un token distinto, sin conversión, así que escribir exige tener minutos. Y cada modo tiene un tope duro de posiciones emitidas (§7.1).

Pendiente: las seis capacidades del motor que nombra el mapa (interpretar, resolver, posicionar, comparar, calcular, componer) no existen como funciones; son nombres descriptivos.

## 2. Descubrir

```js
descubrir(eje, foco, { camino = [], posiciones = [1, 2, 3, 4] } = {})  // → [{ posicion, dir, candidatos }]
caminoVisible(ocupante)                                                // → number[]  camino que se muestra: el del ocupante y, si su contenido es un array con posición 0, un 0 más
```

`descubrir` no escribe. Para cada posición de interacción (por defecto 1–4: recursos, criterios, comunicación, fábrica) devuelve la dirección `direccion([...camino, i])` y sus **candidatos**: los ocupantes de esa dirección en el foco (`encaje.ocupantes`, orden por encaje; ver `docs/BTML.md` §6) más dos campos calculados con BQL sobre lo visible de cada uno:

| Campo del candidato | Origen | Contenido |
|---|---|---|
| `origen`, `tipo` | encaje | `'propio'`, `'referencia'` o `'escrito'` |
| `evento`, `dir`, `camino`, `contenido`, `procedencia` | encaje | dónde vive el contenido (`docs/BTML.md` §6.2) |
| `autor`, `t` | encaje | solo en escritos |
| `origenDir`, `destino`, `vector`, `distancia`, `acuerdo`, `signo`, `faltas`, `excedentes` | encaje | el encaje del candidato en la posición |
| `estado`, `texto` | `bql.evaluar(eje, evento, caminoVisible(candidato))` | `RESUELTO` / `PENDIENTE` / `INCOMPATIBLE` / `ERROR` y el texto del valor (`docs/BQL.md` §1) |

`caminoVisible` añade un `0` al camino cuando el contenido es un array con posición 0: de un array se muestra su representación (PV0). De un terminal o una referencia se muestra lo que hay. BQL no sigue la referencia en `evaluar` (texto `→ <id>`), sí la sigue el candidato de origen `referencia`, que ya es lo alcanzado.

Errores: `foco desconocido: <id>` si el foco no está en el eje.

```sh
node --input-type=module -e "
import { ejemploCompra, ejemploCuenta } from './ejemplos/ikisai/compra-food.mjs';
import { descubrir, caminoVisible } from './src/motor.js';
const { eje, compra } = await ejemploCompra();
await ejemploCuenta(eje, compra);
for (const p of descubrir(eje, compra.id)) {
  console.log(p.posicion, p.dir, p.candidatos.length + ' candidatos');
  for (const c of p.candidatos) console.log('  ' + c.origen.padEnd(11) + c.evento.slice(0, 8) + ' camino ' + JSON.stringify(c.camino) + ' visible ' + JSON.stringify(caminoVisible(c)) + ' · ' + c.estado + ' · ' + c.texto + ' · ' + c.signo);
}
console.log(JSON.stringify(descubrir(eje, compra.id, { camino: [1], posiciones: [1, 2] }).map((p) => [p.dir, p.candidatos.map((c) => c.origen + ':' + c.texto)])));
console.log('registros antes y después:', eje.orden.length);
"
```

```text
1 1000000000 4 candidatos
  propio     f9e59d1e camino [1] visible [1,0] · RESUELTO · → 4598f23e · exacto
  propio     f9e59d1e camino [1,0] visible [1,0] · RESUELTO · → 4598f23e · exacto
  referencia 4598f23e camino [1] visible [1,0] · RESUELTO · ensalada · exacto
  escrito    c70bfa6e camino [] visible [0] · RESUELTO · Cuenta del menú · exacto
2 2000000000 3 candidatos
  propio     f9e59d1e camino [2] visible [2,0] · RESUELTO · → 4598f23e · exacto
  propio     f9e59d1e camino [2,0] visible [2,0] · RESUELTO · → 4598f23e · exacto
  referencia 4598f23e camino [2] visible [2,0] · RESUELTO · sin gluten · exacto
3 3000000000 2 candidatos
  propio     f9e59d1e camino [3] visible [3,0] · RESUELTO · huesped · exacto
  propio     f9e59d1e camino [3,0] visible [3,0] · RESUELTO · huesped · exacto
4 4000000000 2 candidatos
  propio     f9e59d1e camino [4] visible [4,0] · RESUELTO · pagar · exacto
  propio     f9e59d1e camino [4,0] visible [4,0] · RESUELTO · pagar · exacto
[["1100000000",["propio:1"]],["1200000000",["propio:12 EUR"]]]
registros antes y después: 5
```

Lectura: en la posición 1 de la compra colisionan `[1]` y `[1, 0]` (ambos muestran la referencia al menú), lo que esa referencia alcanza (`ensalada`, representación del menú:1) y la cuenta que cocina escribió en `1000000000` (`exacto`: un escrito anclado en la dirección buscada encaja exacto).

## 3. Consolidar

### 3.1 Firma

```js
consolidar(eje, { autor, foco, elecciones, titulo = 'Consolidación', t, camino = [] }, privada)  // → Promise<evento>
```

| Parámetro | Tipo | Significado |
|---|---|---|
| `autor` | identidad | Quien consolida. Mueve su T. Será quien ejecute. |
| `foco` | id | Registro sobre el que se anida la consolidación. |
| `elecciones` | `{ [posición 1–9]: elección }` | Una entrada por posición elegida (§3.2). Obligatorio y no vacío. |
| `titulo` | terminal | Va en la posición 0 del payload. |
| `t` | ISO | Instante. Pasa a `escribirDesde`. |
| `camino` | `number[]` | Profundidad: la consolidación se ancla en `direccion([...camino, 4])` y los huecos se heredan de `[...camino, i]`. |
| `privada` | CryptoKey | Si el autor tiene clave, firma (`docs/BTML.md` §7). |

### 3.2 Elecciones

Las claves de `elecciones` son posiciones **1–9**. Se recorren de 1 hasta la mayor elegida; cada posición produce una entrada del payload:

| Valor en `elecciones[i]` | Qué se guarda en `payload[i]` | `fuentes` | `encaje[k]` |
|---|---|---|---|
| `{ candidato }` (un candidato de `descubrir`) | `{ ref: candidato.evento, dir: candidato.dir ?? '0000000000' }` | `candidato.evento` | `{ posicion, evento, tipo, origen, destino, vector, signo, clase }` con el encaje del candidato (`origenDir`/`vector`/`signo` si los trae; si no, se calculan) |
| `{ ref, dir? }` (una referencia BTML) | tal cual | `ref` (debe existir en el eje) | `{ posicion, evento, origen: dir ?? '0000000000', destino, vector, clase }` (sin `tipo` ni `signo`) |
| cualquier otro valor BTML (terminal o array): un terminal nuevo | tal cual | — | `{ posicion, tipo: 'nuevo', destino, clase }` (sin origen ni vector: nace ahí) |
| ausente (hueco, `i` < última elegida) | `{ ref: foco, dir: direccion([...camino, i]) }` si `ocupantes(eje, foco, [...camino, i])` no está vacío; si no, error | — | — (no es una elección) |

`destino` es siempre `direccion([...camino, i])`. `fuentes` se deduplica (`[...new Set]`). Los huecos se **heredan del foco por referencia** porque un array BTML no admite huecos y una referencia no copia.

`clase` es la **clase de modificación** de la elección: el tercer dígito de su `destino` (`claseDe`, §7.2). En la raíz del foco (`camino = []`) toda elección cae en la subposición 0 de su posición y su clase es 0 (ver/sustituir). Bajo una celda (`camino = [i, j]`) la posición elegida **es** la clase: la elección 4 bajo la celda del precio `[1, 2]` va a `1240000000`, clase 4 (acción: pagar). Ver §3.5.

### 3.3 El registro resultante

Se escribe con `escribirDesde` en modo `mapped` (§7): `sobre = foco`, `en = direccion([...camino, 4])`, `payload = [titulo, …]`, `contexto = { motor: 'fabrica', fase: 'consolidado', fuentes, encaje, modo: 'mapped' }`, y un solo movimiento: T del autor, un minuto por posición (las referencias heredadas cuentan). Máximo 1000 posiciones (tope duro de Mapped, §7.1). El estado inicial es `PENDIENTE DE AUTORIZACIÓN`.

```sh
node --input-type=module -e "
import { ejemploCompra, ejemploCuenta } from './ejemplos/ikisai/compra-food.mjs';
import { descubrir, consolidar, estadoDe, FABRICA } from './src/motor.js';
const corto = (x) => JSON.stringify(x).replace(/[0-9a-f]{64}/g, (m) => m.slice(0, 8));
const { eje, compra } = await ejemploCompra();
const cuenta = await ejemploCuenta(eje, compra);
const d = descubrir(eje, compra.id);
const elegida = d[0].candidatos.find((c) => c.evento === cuenta.id);
const antesT = eje.saldoT('huesped', 'minuto');
const antesEUR = eje.saldo('huesped', 'E:casa/EUR');
const c = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: '2026-11-07T16:00:00Z', titulo: 'Pago del menú', elecciones: { 1: { candidato: elegida }, 2: 'sin lactosa', 4: 'pagar 14 EUR' } });
console.log(c.sobre === compra.id, c.en === FABRICA, c.autor);
console.log(corto(c.payload));
console.log(corto(c.contexto));
console.log(corto(c.movimientos), 'minutos gastados', antesT - eje.saldoT('huesped', 'minuto'), 'EUR movidos', antesEUR - eje.saldo('huesped', 'E:casa/EUR'));
console.log(estadoDe(eje, c.id));
"
```

```text
true true huesped
["Pago del menú",{"ref":"c70bfa6e","dir":"0000000000"},"sin lactosa",{"ref":"f9e59d1e","dir":"3000000000"},"pagar 14 EUR"]
{"motor":"fabrica","fase":"consolidado","fuentes":["c70bfa6e"],"encaje":[{"posicion":1,"evento":"c70bfa6e","tipo":"escrito","origen":"1000000000","destino":"1000000000","vector":[0,0,0,0,0,0,0,0,0,0],"signo":"exacto","clase":0},{"posicion":2,"tipo":"nuevo","destino":"2000000000","clase":0},{"posicion":4,"tipo":"nuevo","destino":"4000000000","clase":0}],"modo":"mapped"}
[{"token":"T","escala":"minuto","cantidad":5,"de":"huesped","a":null}] minutos gastados 5 EUR movidos 0
PENDIENTE DE AUTORIZACIÓN
```

La posición 3 no se eligió y queda por debajo de la 4: se hereda de la compra (`{ ref: compra, dir: '3000000000' }`, que alcanza `['huesped', 'cocina']` sin copiarlo) y no lleva encaje porque no es una elección. Cinco posiciones, cinco minutos. Los 14 EUR no se mueven: consolidar no ejecuta. Las tres elecciones son de clase 0: en la raíz del foco, elegir es ver o sustituir la posición.

### 3.4 Errores

| Mensaje | Causa |
|---|---|
| `nada que consolidar` | `elecciones` vacío o ausente |
| `las elecciones van en posiciones 1–9` | alguna clave no es un entero de 1 a 9 (`0`, `10`, `'a'`) |
| `hueco en <i>: elige algo o quita las posiciones siguientes` | la posición `i` no se eligió, está por debajo de la última y el foco no tiene ningún ocupante en `[...camino, i]` |
| `fuente desconocida en <i>` | una elección `{ ref }` cuyo `ref` no está en el eje |
| `Mapped emite como mucho 1000 posiciones; este registro tiene <n>` | el tope duro de Mapped (§7.1) |
| `evento rechazado: …` / `registro desconocido: <id>` | lo que rechace el eje (foco inexistente, autor sin T, firma…) o el encaje al buscar ocupantes de un foco inexistente |

```sh
node --input-type=module -e "
import { ejemploCompra } from './ejemplos/ikisai/compra-food.mjs';
import { consolidar } from './src/motor.js';
const { eje, compra, menu } = await ejemploCompra();
const T = '2026-11-07T16:00:00Z';
const intenta = (datos) => consolidar(eje, { autor: 'huesped', foco: compra.id, t: T, ...datos }).then((c) => console.log('ok', JSON.stringify(c.payload).replace(/[0-9a-f]{64}/g, (m) => m.slice(0, 8)), 'en', c.en), (e) => console.log(e.message));
await intenta({ elecciones: {} });
await intenta({ elecciones: { 0: 'x' } });
await intenta({ elecciones: { 10: 'x' } });
await intenta({ elecciones: { 7: 'más tarde' } });
await intenta({ elecciones: { 1: { ref: 'nadie' } } });
await intenta({ elecciones: { 1: Array(10).fill(Array(10).fill(Array(10).fill('x'))) } });
await intenta({ foco: 'nadie', elecciones: { 1: 'x' } });
await intenta({ elecciones: { 1: ['dos', 'menús'], 3: { ref: menu.id, dir: '2000000000' } } });
await intenta({ elecciones: { 1: 'uno' }, camino: [1] });
"
```

```text
nada que consolidar
las elecciones van en posiciones 1–9
las elecciones van en posiciones 1–9
hueco en 5: elige algo o quita las posiciones siguientes
fuente desconocida en 1
Mapped emite como mucho 1000 posiciones; este registro tiene 1001
evento rechazado: foco desconocido: nadie
ok ["Consolidación",["dos","menús"],{"ref":"f9e59d1e","dir":"2000000000"},{"ref":"4598f23e","dir":"2000000000"}] en 4000000000
ok ["Consolidación","uno"] en 1400000000
```

En la penúltima, la posición 2 (hueco entre la 1 y la 3) se heredó de la compra. En la última, `camino: [1]` ancla la consolidación en `1400000000`: la fábrica de la posición 1 del foco.

### 3.5 La clase de cada elección

La consolidación guarda en `contexto.encaje` la clase de modificación de cada elección: el tercer dígito de su destino (§7.2). Consolidar bajo la celda del precio de la compra (`camino: [1, 2]`) hace que cada posición elegida sea una clase sobre esa celda: 1 impulso de recursos, 2 criterio, 3 comunicación, 4 acción. La ejecución que sigue es siempre clase 4 (`CLASE_EJECUTADO`, en `contexto.clase`).

```sh
node --input-type=module -e "
import { ejemploCompra } from './ejemplos/ikisai/compra-food.mjs';
import { consolidar, autorizar, ejecutar } from './src/motor.js';
import { CLASES } from './src/escritura.js';
const T = '2026-11-07T16:00:00Z';
const { eje, compra } = await ejemploCompra();
const c = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: T, camino: [1, 2], titulo: 'Pago del precio', elecciones: { 1: '12 EUR de huesped', 2: 'precio del menú', 3: 'aviso a cocina', 4: 'pagar 12 EUR' } });
console.log('consolidación en', c.en);
for (const e of c.contexto.encaje) console.log(' ', e.posicion, e.tipo, e.destino, 'clase', e.clase, CLASES[e.clase]);
await consolidar(eje, { autor: 'huesped', foco: compra.id, t: T, camino: [1, 2], elecciones: { 4: 'pagar' } }).catch((e) => console.log(e.message));
await autorizar(eje, { autorizante: 'casa', consolidacion: c.id, t: T });
const e = await ejecutar(eje, { autor: 'huesped', consolidacion: c.id, t: T, movimientos: [{ token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 12, de: 'huesped', a: 'cocina' }] });
console.log('ejecutado: clase', e.contexto.clase, CLASES[e.contexto.clase]);
"
```

```text
consolidación en 1240000000
  1 nuevo 1210000000 clase 1 impulso de recursos
  2 nuevo 1220000000 clase 2 criterio
  3 nuevo 1230000000 clase 3 comunicación
  4 nuevo 1240000000 clase 4 acción
hueco en 1: elige algo o quita las posiciones siguientes
ejecutado: clase 4 acción
```

La segunda consolidación se rechaza: el precio (`'EUR 12'`) es un terminal y no tiene posiciones 1–3 que heredar, y `consolidar` todavía rechaza el hueco (no ancla lo lejano como `desdeMapped`, §7.3). **[X] decidir VG**: si `consolidar` debe heredar las clases sin modificar de una celda con base como hace `desdeMapped` (referencia a `i.j.k`) o anclar lo lejano en vez de rechazar.

## 4. Autorizar

### 4.1 Quién puede: la regla V0

```js
puedeAutorizar(eje, identidad, consolidacion)  // → boolean
```

`true` cuando la consolidación existe, `identidad` **no es su autor** y `eje.poderSobre(identidad, consolidacion) > 0`. El poder sobre un registro es la suma de los saldos de P cuyo ámbito es `'genesis'` (todo el eje) o cualquier registro del **hilo** de la consolidación (consolidación → foco → … → génesis). Es decir: quien tiene poder sobre un registro lo tiene sobre todo lo que cuelga de él. P exige ámbito y delegarlo lo estrecha (`src/eje.js`, `test/eprt.test.js`).

Esta regla es un **hueco provisional**: la autorización y la ejecución reales son de AARPIA, que no existe (pendiente). Lo que hoy hay es «P > 0 sobre el registro y no ser el autor».

```sh
node --input-type=module -e "
import { ejemploCompra } from './ejemplos/ikisai/compra-food.mjs';
import { consolidar, puedeAutorizar } from './src/motor.js';
const T = '2026-11-07T16:00:00Z';
const { eje, alta, menu, compra } = await ejemploCompra();
const gastaT = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });
console.log(JSON.stringify(eje.poderes('casa')), JSON.stringify(eje.poderes('cocina')));
// La casa delega a cocina 2 P con ámbito el menú: cubre el menú y lo que cuelga de él.
await eje.escribir({ autor: 'casa', sobre: menu.id, t: T, movimientos: [gastaT('casa'), { token: 'P', cantidad: 2, ambito: menu.id, de: 'casa', a: 'cocina' }], payload: 'cocina decide sobre su menú' });
console.log(JSON.stringify(eje.poderes('cocina')).replace(/[0-9a-f]{64}/g, (m) => m.slice(0, 8)), 'casa P:genesis', eje.saldo('casa', 'P:genesis'));
const sobreCompra = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: T, elecciones: { 1: 'dos menús' } });
const sobreAlta = await consolidar(eje, { autor: 'huesped', foco: alta.id, t: T, elecciones: { 1: 'otra alta' } });
console.log('sobre la compra (cuelga del menú): cocina', puedeAutorizar(eje, 'cocina', sobreCompra.id), eje.poderSobre('cocina', sobreCompra.id), '· casa', puedeAutorizar(eje, 'casa', sobreCompra.id), eje.poderSobre('casa', sobreCompra.id), '· huesped (autor)', puedeAutorizar(eje, 'huesped', sobreCompra.id));
console.log('sobre el alta (por encima del menú): cocina', puedeAutorizar(eje, 'cocina', sobreAlta.id), eje.poderSobre('cocina', sobreAlta.id), '· casa', puedeAutorizar(eje, 'casa', sobreAlta.id));
console.log('sobre algo que no existe:', puedeAutorizar(eje, 'casa', 'nadie'));
"
```

```text
[{"ambito":"genesis","cantidad":10}] []
[{"ambito":"4598f23e","cantidad":2}] casa P:genesis 8
sobre la compra (cuelga del menú): cocina true 2 · casa true 8 · huesped (autor) false
sobre el alta (por encima del menú): cocina false 0 · casa true
sobre algo que no existe: false
```

### 4.2 Firma y registro

```js
autorizar(eje, { autorizante, consolidacion, t, nota = 'autorizo' }, privada)  // → Promise<evento>
autorizacionesValidas(eje, consolidacion)                                     // → evento[]  escritos en FABRICA sobre la consolidación con fase 'autorizado' cuyo autor puede autorizar
```

`autorizar` escribe con `escribirDesde` en modo `pointed`: `sobre = consolidación`, `en = FABRICA`, `payload = '==' + nota` (texto escapado para BQL), `contexto = { motor: 'fabrica', fase: 'autorizado', modo: 'pointed' }`, un minuto de T del autorizante. Solo escribe si la consolidación está `PENDIENTE DE AUTORIZACIÓN` y el autorizante puede.

Lo que no cumple la regla **no cuenta**: un registro con `fase: 'autorizado'` escrito a mano por quien no puede autorizar queda en el eje (es un evento válido) pero `autorizacionesValidas` no lo devuelve y el estado no cambia.

| Mensaje | Causa |
|---|---|
| `no es una consolidación: <id8>` | `consolidacion` no existe o su `contexto.fase` no es `'consolidado'` |
| `el autor no se autoriza a sí mismo` | `autorizante === consolidación.autor` |
| `<autorizante> no tiene poder (P) sobre este registro` | `poderSobre` = 0 |
| `ya está autorizado` / `ya está ejecutado` | el estado ya no es `PENDIENTE DE AUTORIZACIÓN` |

```sh
node --input-type=module -e "
import { ejemploCompra } from './ejemplos/ikisai/compra-food.mjs';
import { consolidar, autorizar, autorizacionesValidas, estadoDe, FABRICA } from './src/motor.js';
import { evaluar } from './src/bql.js';
const T = '2026-11-07T16:00:00Z';
const { eje, compra } = await ejemploCompra();
const c = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: T, elecciones: { 1: 'dos menús' } });
for (const autorizante of ['huesped', 'cocina']) await autorizar(eje, { autorizante, consolidacion: c.id, t: T }).catch((e) => console.log(e.message));
// Un «autorizado» escrito a mano por quien no puede: ruido.
await eje.escribir({ autor: 'cocina', sobre: c.id, en: FABRICA, t: T, movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'cocina', a: null }], payload: '==autorizo', contexto: { fase: 'autorizado' } });
console.log('escritos en la fábrica', eje.sobre(c.id, FABRICA).length, '· válidos', autorizacionesValidas(eje, c.id).length, '·', estadoDe(eje, c.id));
const a = await autorizar(eje, { autorizante: 'casa', consolidacion: c.id, t: T, nota: 'vale' });
console.log(a.sobre === c.id, a.en, JSON.stringify(a.payload), 'BQL lo lee como', JSON.stringify(evaluar(eje, a.id, []).texto), JSON.stringify(a.contexto), a.movimientos[0].cantidad, a.movimientos[0].de);
console.log('escritos en la fábrica', eje.sobre(c.id, FABRICA).length, '· válidos', autorizacionesValidas(eje, c.id).length, '·', estadoDe(eje, c.id));
await autorizar(eje, { autorizante: 'casa', consolidacion: c.id, t: T }).catch((e) => console.log(e.message));
await autorizar(eje, { autorizante: 'casa', consolidacion: compra.id, t: T }).catch((e) => console.log(e.message));
"
```

```text
el autor no se autoriza a sí mismo
cocina no tiene poder (P) sobre este registro
escritos en la fábrica 1 · válidos 0 · PENDIENTE DE AUTORIZACIÓN
true 4000000000 "==vale" BQL lo lee como "=vale" {"motor":"fabrica","fase":"autorizado","modo":"pointed"} 1 casa
escritos en la fábrica 2 · válidos 1 · AUTORIZADO
ya está autorizado
no es una consolidación: f9e59d1e
```

## 5. Ejecutar

```js
ejecutar(eje, { autor, consolidacion, movimientos = [], t, titulo = 'Ejecutado' }, privada)  // → Promise<evento>
```

Condiciones, en este orden: la consolidación existe y tiene `fase: 'consolidado'`; `autor` es el autor de la consolidación; el estado es `AUTORIZADO` (ni pendiente ni ejecutado). Entonces escribe **directamente con `eje.escribir`** (no pasa por `escribirDesde`: sin `contexto.modo`, sin comprobar tope):

- `sobre = consolidación`, `en = FABRICA`, `t` (si falta, el reloj);
- `payload = [titulo, { ref: consolidación }, { ref: autorización }]`, donde la autorización es la **primera** de `autorizacionesValidas`;
- `movimientos = [{ token: 'T', escala: 'minuto', cantidad: 1, de: autor, a: null }, ...movimientos]`: aquí se mueven los tokens reales (E, P, R, más T). Como en todo evento, cada movimiento debe salir del autor (`de === autor`) y su saldo debe cubrirlo; si no, el eje rechaza el evento entero y nada cambia;
- `contexto = { motor: 'fabrica', fase: 'ejecutado', evidencia: [consolidación, autorización], clase: 4 }`: ejecutar es una modificación de clase 4, acción (`CLASE_EJECUTADO`, §7.2).

| Mensaje | Causa |
|---|---|
| `no es una consolidación: <id8>` | no existe o no tiene fase `'consolidado'` |
| `ejecuta el autor de la consolidación: <autor>` | otro autor |
| `PENDIENTE DE AUTORIZACIÓN` | sin autorización válida |
| `ya ejecutado` | ya hay ejecución válida |
| `evento rechazado: …` | lo que rechace el eje (`nadie mueve tokens ajenos`, `saldo insuficiente…`) |

```sh
node --input-type=module -e "
import { ejemploCompra, ejemploCuenta } from './ejemplos/ikisai/compra-food.mjs';
import { consolidar, autorizar, ejecutar, estadoDe, consolidaciones } from './src/motor.js';
const T = '2026-11-07T16:00:00Z';
const corto = (x) => JSON.stringify(x).replace(/[0-9a-f]{64}/g, (m) => m.slice(0, 8));
const { eje, compra } = await ejemploCompra();
await ejemploCuenta(eje, compra);
const c = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: T, titulo: 'Pago del menú', elecciones: { 1: 'un menú', 4: 'pagar 14 EUR' } });
await ejecutar(eje, { autor: 'huesped', consolidacion: c.id, t: T }).catch((e) => console.log(e.message));
const a = await autorizar(eje, { autorizante: 'casa', consolidacion: c.id, t: T });
await ejecutar(eje, { autor: 'casa', consolidacion: c.id, t: T }).catch((e) => console.log(e.message));
await ejecutar(eje, { autor: 'huesped', consolidacion: c.id, t: T, movimientos: [{ token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 14, de: 'cocina', a: 'huesped' }] }).catch((e) => console.log(e.message));
const antes = [eje.saldo('cocina', 'E:casa/EUR'), eje.saldo('huesped', 'E:casa/EUR'), eje.saldoT('huesped', 'minuto')];
const e = await ejecutar(eje, { autor: 'huesped', consolidacion: c.id, t: T, titulo: 'Pagado', movimientos: [{ token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 14, de: 'huesped', a: 'cocina' }] });
console.log(e.sobre === c.id, e.en, corto(e.payload));
console.log(corto(e.contexto), corto(e.movimientos));
console.log('cocina EUR', antes[0], '→', eje.saldo('cocina', 'E:casa/EUR'), '· huesped EUR', antes[1], '→', eje.saldo('huesped', 'E:casa/EUR'), '· huesped minutos', antes[2], '→', eje.saldoT('huesped', 'minuto'));
console.log(estadoDe(eje, c.id), '· hilo:', eje.hilo(e.id).map((x) => x.id.slice(0, 8)).join(' → '));
console.log('evidencia:', e.contexto.evidencia[0] === c.id, e.contexto.evidencia[1] === a.id);
await ejecutar(eje, { autor: 'huesped', consolidacion: c.id, t: T }).catch((e) => console.log(e.message));
console.log(corto(consolidaciones(eje, compra.id)));
"
```

```text
PENDIENTE DE AUTORIZACIÓN
ejecuta el autor de la consolidación: huesped
evento rechazado: nadie mueve tokens ajenos: cocina no es el autor
true 4000000000 ["Pagado",{"ref":"e3a6b8cb"},{"ref":"2b31255e"}]
{"motor":"fabrica","fase":"ejecutado","evidencia":["e3a6b8cb","2b31255e"],"clase":4} [{"token":"T","escala":"minuto","cantidad":1,"de":"huesped","a":null},{"token":"E","emisor":"casa","denominacion":"EUR","cantidad":14,"de":"huesped","a":"cocina"}]
cocina EUR 12 → 26 · huesped EUR 48 → 34 · huesped minutos 475 → 474
EJECUTADO · hilo: 78948939 → e3a6b8cb → f9e59d1e → 4598f23e → ccf5a120 → 6c1c5968
evidencia: true true
ya ejecutado
[{"id":"e3a6b8cb","autor":"huesped","t":"2026-11-07T16:00:00Z","titulo":"Pago del menú","estado":"EJECUTADO","fuentes":[]}]
```

El hilo de la ejecución es la evidencia: ejecución → consolidación → compra → menú → alta → génesis.

## 6. Estado y lista de consolidaciones

```js
estadoDe(eje, consolidacion)            // → 'PENDIENTE DE AUTORIZACIÓN' | 'AUTORIZADO' | 'EJECUTADO' | undefined (si no existe)
consolidaciones(eje, foco, camino = []) // → [{ id, autor, t, titulo, estado, fuentes }]  las consolidaciones ancladas en direccion([...camino, 4]) del foco
```

`estadoDe` mira los escritos sobre la consolidación en `FABRICA` (`eje.sobre(consolidacion, FABRICA)`), en este orden:

| Estado | Condición |
|---|---|
| `EJECUTADO` | hay un escrito con `contexto.fase === 'ejecutado'` cuyo autor es el autor de la consolidación y cuyos `contexto.evidencia` (si los hay) existen todos en el eje |
| `AUTORIZADO` | si no, hay al menos una autorización válida (`autorizacionesValidas`) |
| `PENDIENTE DE AUTORIZACIÓN` | en cualquier otro caso |

`consolidaciones` filtra los hijos del foco anclados en la fábrica de ese camino con `fase: 'consolidado'`; `titulo` es `payload[0]`.

```sh
node --input-type=module -e "
import { ejemploCompra } from './ejemplos/ikisai/compra-food.mjs';
import { consolidar, autorizar, estadoDe, consolidaciones, FABRICA } from './src/motor.js';
const T = '2026-11-07T16:00:00Z';
const { eje, compra } = await ejemploCompra();
const gastaT = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });
const c = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: T, elecciones: { 1: 'dos menús' } });
await autorizar(eje, { autorizante: 'casa', consolidacion: c.id, t: T });
// Un «ejecutado» escrito por otro autor no cuenta.
await eje.escribir({ autor: 'cocina', sobre: c.id, en: FABRICA, t: T, movimientos: [gastaT('cocina')], payload: 'falso', contexto: { fase: 'ejecutado' } });
console.log(estadoDe(eje, c.id));
// Uno del autor con evidencia que no existe, tampoco.
await eje.escribir({ autor: 'huesped', sobre: c.id, en: FABRICA, t: T, movimientos: [gastaT('huesped')], payload: 'falso', contexto: { fase: 'ejecutado', evidencia: [c.id, 'nadie'] } });
console.log(estadoDe(eje, c.id));
// Límite conocido: uno del autor sin evidencia cuenta, incluso sobre una consolidación nunca autorizada.
const c2 = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: T, elecciones: { 1: 'tres menús' } });
await eje.escribir({ autor: 'huesped', sobre: c2.id, en: FABRICA, t: T, movimientos: [gastaT('huesped')], payload: 'a mano', contexto: { fase: 'ejecutado' } });
console.log(estadoDe(eje, c2.id), '(sin autorización)');
console.log(JSON.stringify(consolidaciones(eje, compra.id).map((x) => [x.titulo, x.estado])), estadoDe(eje, 'nadie'));
"
```

```text
AUTORIZADO
AUTORIZADO
EJECUTADO (sin autorización)
[["Consolidación","AUTORIZADO"],["Consolidación","EJECUTADO"]] undefined
```

El tercer caso es un defecto observado (§13): `ejecutar` exige la autorización, pero `estadoDe` no la comprueba en un «ejecutado» escrito a mano por el autor.

## 7. Registro de salida: topes por modo y la matriz de la fábrica

### 7.1 Modos, topes duros y proporción (`src/modos.js`)

La unidad de cuenta es la **posición** (cada terminal, referencias incluidas, cuenta una; un array cuenta la suma de las suyas). Cada modo tiene dos cifras:

- el **tope duro** (VG, 7-11-2026): cuántas posiciones puede emitir de una vez. Es lo único que rechaza una escritura (`escribirDesde`, `escribirSalida`, y por tanto `consolidar` y `autorizar`). Coincide con lo que el modo lee: no se emite más de lo que se ve;
- la **proporción** de escritura sobre lectura (VG, 6-11-2026): el estándar. Informa (`proporcion`), no rechaza. Hasta el 7-11 se exigía su máximo (1, 20, 333); con los topes duros ha pasado a ser información. **[X] decidir VG**: si la interfaz debe avisar cuando un registro queda por encima o por debajo de la proporción.

```js
MODOS                         // { pointed, sequenced, mapped, scened } → { nombre, decuplas, proporcion: [mín, máx] | null, tope }
nombreModo(modo)              // → 'Pointed' | 'Sequenced' | 'Mapped' | 'Scened'
lectura(modo)                 // → posiciones que el modo lee de una vez: decuplas × 10
tope(modo)                    // → tope duro: posiciones que el modo emite como mucho de una vez
escritura(modo)               // → [mínimo, máximo] según la proporción (floor de lectura × proporción), o null si no está fijada
contarPosiciones(payload)     // → número de terminales del payload (anidado incluido); 0 si no es BTML
cabeTope(payload, modo)       // → contarPosiciones(payload) <= tope(modo)
cabeEscritura(payload, modo)  // → contarPosiciones(payload) <= máximo de la proporción; true si no está fijada (ya no se usa para rechazar)
proporcion(payload, modo)     // → { posiciones, rango: [mín, máx] | null, estado: 'por debajo' | 'dentro' | 'por encima' | 'sin fijar' }
```

| Modo | Décuplas | Lee | Tope duro (rechaza) | Proporción (informa) | Según la proporción `[mín, máx]` |
|---|---|---|---|---|---|
| `pointed` | 1 | 10 | 10 | 1/10 | `[1, 1]` |
| `sequenced` | 10 | 100 | 100 | 1/10 – 1/5 | `[10, 20]` |
| `mapped` | 100 | 1000 | 1000 (la matriz 10×10×10) | 1/4 – 1/3 | `[250, 333]` |
| `scened` | 1000 | 10000 | 10000 | sin fijar (`null`) | `null` |

Scened tiene tope pero no tiene render todavía. Un modo que no está en `MODOS` da `Error('modo desconocido: <modo>')` en `lectura`, `tope`, `escritura`, `escribirDesde`…

```sh
node --input-type=module -e "
import { MODOS, lectura, tope, escritura, contarPosiciones, cabeTope, proporcion, nombreModo } from './src/modos.js';
for (const m of Object.keys(MODOS)) console.log(nombreModo(m).padEnd(10), 'décuplas', String(MODOS[m].decuplas).padStart(4), '· lee', String(lectura(m)).padStart(5), '· tope', String(tope(m)).padStart(5), '· proporción', JSON.stringify(escritura(m)));
console.log(contarPosiciones('x'), contarPosiciones(['a', ['b', 'c'], { ref: 'r' }]), contarPosiciones([{ ref: 'a' }, { ref: 'b', dir: '1000000000' }]), contarPosiciones(undefined), contarPosiciones(null));
const mil = Array(10).fill(Array(10).fill(Array(10).fill('x')));
console.log(cabeTope(Array(10).fill('x'), 'pointed'), cabeTope(Array(11).fill('x'), 'pointed'), cabeTope(mil, 'mapped'), cabeTope(mil, 'sequenced'), cabeTope([mil, 'y'], 'mapped'), cabeTope([mil, 'y'], 'scened'));
for (const [p, m] of [['x', 'pointed'], [Array(5).fill('x'), 'sequenced'], [Array(10).fill(['a', 'b', 'c']), 'sequenced'], [mil, 'mapped'], [mil, 'scened']]) console.log(m.padEnd(9), JSON.stringify(proporcion(p, m)));
try { tope('otro'); } catch (e) { console.log(e.message); }
"
```

```text
Pointed    décuplas    1 · lee    10 · tope    10 · proporción [1,1]
Sequenced  décuplas   10 · lee   100 · tope   100 · proporción [10,20]
Mapped     décuplas  100 · lee  1000 · tope  1000 · proporción [250,333]
Scened     décuplas 1000 · lee 10000 · tope 10000 · proporción null
1 4 2 0 0
true false true false false true
pointed   {"posiciones":1,"rango":[1,1],"estado":"dentro"}
sequenced {"posiciones":5,"rango":[10,20],"estado":"por debajo"}
sequenced {"posiciones":30,"rango":[10,20],"estado":"por encima"}
mapped    {"posiciones":1000,"rango":[250,333],"estado":"por encima"}
scened    {"posiciones":1000,"rango":null,"estado":"sin fijar"}
modo desconocido: otro
```

### 7.2 La matriz 10×10×10 de la fábrica

Decisión de VG (7-11-2026, tarde): «siempre estamos aplicando los puntos de vista».

- La fábrica (PV4) parte de la **matriz de 100 del foco**: 10 posiciones × 10 subposiciones. Ya está y **no se emite**.
- El registro de salida emite **solo las celdas modificadas**. La tercera dimensión es la **clase de modificación**, escrita como **tercer dígito** bajo la época 0: los diez PV. Una modificación de clase `k` sobre la celda `[i][j]` se escribe en `payload[i][j][k]`; su dirección es `i j k 0000000`. Matriz completa: 10 × 10 × 10 = 1000 posiciones, el tope de Mapped.
- **Ver ya es una modificación** (clase 0): siempre se emite algo. Sin nada visto ni escrito, `desdeMapped` rechaza (`la décupla está vacía…`).
- Lo no modificado **anterior** a lo modificado (posiciones antes de `i`, subposiciones antes de `j`, clases antes de `k`) se **hereda del foco por referencia** `{ ref: foco, dir }`: un array BTML no admite huecos y una referencia no copia.
- Lo **lejano sin base** en el foco no se rechaza: se **ancla** en su posición, en un registro aparte con `en` = la dirección de la celda (`ubicar`, §7.3).

| `k` | Clase (`CLASES[k]`) | PV del dígito |
|---|---|---|
| 0 | ver/sustituir | representación |
| 1 | impulso de recursos | recursos |
| 2 | criterio | criterios |
| 3 | comunicación | comunicación |
| 4 | acción | fábrica |
| 5 | estructura | estructura |
| 6 | pasado | pasado |
| 7 | futuro | futuro |
| 8 | comparabilidad | comparabilidad |
| 9 | camino | camino |

`claseDe(dir)` devuelve el tercer dígito de una dirección: `claseDe('1240000000') === 4`. El motor guarda la clase de cada elección en la consolidación (§3.5) y la clase 4 en la ejecución (§5).

**Base en el foco.** Un hueco de posición o de subposición tiene base si el foco tiene contenido en ese camino (un terminal es su propia posición 0: colisión de ceros finales). Un hueco de **clase** tiene base si **existe la celda** `[i][j]`: la matriz de 100 del foco ya está, y cada celda se puede ver desde cualquiera de los diez PV. Por eso, para pagar el precio de la compra (`[1][2][4]`), las clases 0–3 del precio se heredan por referencia a `1200000000`…`1230000000` (la 0 es la propia celda; las demás nombran el precio visto desde el PV 1, 2 y 3, que la compra no desarrolla). **[X] decidir VG**: si las clases sin modificar se heredan por referencia a `i.j.k` (hoy) o todas a la celda `i.j`.

**Compactación.** Bajo la raíz, un array de un solo terminal se guarda como el terminal: la dirección `2000000000` nombra a la vez `[2]`, `[2][0]` y `[2][0][0]`, así que no se pierde nada. Por eso una celda con solo la clase 0, sola en su posición, ocupa `payload[i]` como antes de la matriz (compatibilidad con las décuplas de líneas). La raíz del registro es siempre un array.

### 7.3 Conformar el registro de salida (`src/escritura.js`)

```js
item(eje, texto)                           // → terminal: número, texto, o referencia {ref, dir?} si el texto es '@<prefijo>' o '@<prefijo>:<dirección>'
resolverRef(eje, prefijo)                  // → { ref: id completo }  el prefijo (con o sin '@', ≥ 4 caracteres) debe ser único en eje.orden
desdePointed(eje, texto)                   // → un terminal (una referencia también vale)
desdeSequenced(eje, textos)                // → array de 1 a 10 ítems sin huecos (los vacíos finales se descartan)
desdeMapped(eje, entrada, foco, camino = [])  // → { payload | null, heredadas, anclados }  la matriz 10×10×10 (§7.2)
ubicar(eje, foco, celda, { camino = [], escritas = [] } = {})  // → { ubicacion: 'dentro' | 'anclado', dir, en?, faltan }
costeT(payload)                            // → minutos de T que mueve el registro = contarPosiciones(payload)
escribirDesde(eje, { modo, autor, sobre, en = RAIZ, payload, t = ahora, contexto = {}, celda?, camino = [] }, privada)  // → Promise<evento>
escribirSalida(eje, { modo = 'mapped', autor, sobre, en = RAIZ, camino = [], salida, t = ahora, contexto = {} }, privada)  // → Promise<{ registro | null, anclados: evento[] }>
CLASES                                     // los diez nombres de clase (§7.2)
claseDe(dir)                               // → tercer dígito de la dirección
```

**Ítems de entrada** (`item`): se recorta el texto; vacío → error `ítem vacío`; `/^@([0-9a-f]{4,64})(?::([0-9]{10}))?$/i` → referencia por prefijo hexadecimal (`resolverRef`: `referencia desconocida: <p>` si ningún id empieza así, `referencia ambigua: <p>` si varios); `/^-?\d+(\.\d+)?$/` → número JS; cualquier otra cosa → la cadena tal cual (`'12 EUR'` y `'=LOCAL(1)'` son cadenas; su sentido lo pone BQL). Un `@` seguido de algo que no es hexadecimal de 4 a 64 caracteres (`'@zzzz'`, `'@ab'`, `'@4598f23e:12'`) **es texto**, no error; `referencia demasiado corta` solo lo da `resolverRef` llamado directamente con menos de cuatro caracteres.

**Pointed** escribe un terminal; si `item` no da un terminal → `Pointed escribe un terminal` (no ocurre con `item`, que siempre devuelve terminales).

**Sequenced** escribe una hilera: se recortan los textos, se quitan los vacíos finales; vacía → `la hilera está vacía`; > 10 → `la hilera tiene más de 10 posiciones`; un vacío intermedio → `hueco en la posición <i>: rellénala o quita las siguientes`.

**Mapped** (`desdeMapped`) conforma la matriz 10×10×10 bajo `camino` del foco. La `entrada` es una de dos formas (no se mezclan: `mezcla de líneas y celdas…`):

| Forma | Ejemplo | Lectura |
|---|---|---|
| Diez listas de líneas, una por posición (la del formulario de hoy) | `lineas[4] = ['pagado', '0.1 con tarjeta']` | Una línea **sin clase** va con clase 0 a la **subposición siguiente libre** (primero se colocan las que fijan subposición). Una línea **`j.k texto`** fija subposición `j` y clase `k`. |
| Lista de celdas | `[{ i: 1, j: 2, k: 4, contenido: 'pagar 12 EUR' }]` | `j` y `k` valen 0 si faltan. `contenido`: texto (pasa por `item`) o valor BTML. **Sin contenido y con clase 0 es ver**: una referencia a la celda del foco. |

Cada celda se ubica con `ubicar`, en orden de dirección: **dentro** si cada hueco anterior de su ruta ya está escrito en el mismo registro o tiene base en el foco (§7.2); si no, **anclada**. Devuelve:

- `payload`: la matriz con lo que va dentro (lo anterior no modificado, heredado del foco por referencia), o `null` si todo se ancla;
- `heredadas`: lo heredado, en orden: posiciones como número (`3`) y subposiciones o clases como texto (`'1.0'`, `'1.2.3'`);
- `anclados`: `[{ celda: [i, j, k], en, payload, faltan }]`, una entrada por celda sin base: `en` es la dirección de la celda y `faltan` los huecos sin base que la alejan (`['5', '6']`).

Errores: `la décupla está vacía: ver ya es una modificación (clase 0); escribe o ve al menos una celda`; `la celda <i.j.k> está dos veces`; `celda fuera de la matriz: <i.j.k>`; `falta el contenido de <i.j.k>: solo ver (clase 0) va sin contenido`; `la posición <i> no admite más de 10 subposiciones`; `la décupla tiene más de 10 posiciones`; `la celda <…> no cabe bajo un camino de <n> profundidades`; `contenido no válido en <i.j.k>: …`; `foco desconocido: <id>`.

Ambigüedad conocida del prefijo: una línea que empieza por `d.d ` (`'1.5 kg'`) se lee como subposición 1, clase 5 y texto `kg`. Para escribir ese texto tal cual se le pone delante su celda: `'0.0 1.5 kg'`. **[X] decidir VG**: si el prefijo de celda necesita una marca propia.

**`ubicar(eje, foco, celda, { camino, escritas })`** decide entre «dentro del registro» y «anclado en la posición» para una celda objetivo (`[i]`, `[i, j]` o `[i, j, k]` bajo `camino`). `escritas` son las celdas que ya van dentro del mismo registro (cuentan como base). No escribe nada.

**`escribirDesde`** escribe **un** registro: comprueba el **tope duro** del modo (`<Modo> emite como mucho <tope> posiciones; este registro tiene <n>`), añade `contexto.modo` al contexto que se le pase y escribe con `eje.escribir` un solo movimiento: `{ token: 'T', escala: 'minuto', cantidad: costeT(payload), de: autor, a: null }`. El registro se anida en `sobre` + `en` (raíz por defecto). Con **`celda`**, `payload` es el contenido de esa celda del foco `sobre` y se ubica con `ubicar`: dentro, se envuelve en la matriz (con lo anterior heredado por referencia) y se escribe en `en`; anclado, se escribe tal cual con `en` = la dirección de la celda. `payload` nulo → `nada que escribir en el registro…`. Si el `payload` viene de `desdeMapped` y dejó celdas ancladas, escribirlo solo las perdería: se rechaza con `<n> celda(s) sin base en el foco se ancla(n) aparte (<i.j.k> en <dir>, …): escribe la salida entera con escribirSalida`.

**`escribirSalida`** escribe la salida entera de `desdeMapped`: el registro (si hay algo dentro) en `en` y cada celda anclada en su posición (con `escribirDesde` y `celda`). El tope cuenta **la salida entera** (`… emite como mucho <tope> posiciones; esta salida tiene <n>`), antes de escribir nada. No es atómica: si el eje rechaza un anclado (por ejemplo, por saldo de T), lo anterior queda escrito.

```sh
node --input-type=module -e "
import { ejemploCompra } from './ejemplos/ikisai/compra-food.mjs';
import { item, resolverRef, desdePointed, desdeSequenced, desdeMapped, costeT } from './src/escritura.js';
import { resolver } from './src/btml.js';
const corto = (x) => JSON.stringify(x).replace(/[0-9a-f]{64}/g, (m) => m.slice(0, 8));
const { eje, compra, menu } = await ejemploCompra();
const m8 = menu.id.slice(0, 8);
console.log(corto([item(eje, ' hola '), item(eje, '12.5'), item(eje, '-3'), item(eje, '12 EUR'), item(eje, '@' + m8), item(eje, '@' + m8 + ':1000000000'), item(eje, '=LOCAL(1)')]));
for (const t of ['', '@ffff', '@zzzz', '@ab', '@' + m8 + ':12']) try { console.log(corto(item(eje, t))); } catch (e) { console.log(e.message); }
for (const p of [menu.id.slice(0, 4), '@ab', 'ffff']) try { console.log(corto(resolverRef(eje, p))); } catch (e) { console.log(e.message); }
console.log(corto(desdePointed(eje, 'servido')), corto(desdePointed(eje, '@' + m8)));
console.log(corto(desdeSequenced(eje, ['llegar', '@' + m8, '3', '', ''])));
for (const h of [['a', '', 'c'], ['', ''], Array(11).fill('x')]) try { desdeSequenced(eje, h); } catch (e) { console.log(e.message); }
const celdas = []; celdas[2] = ['sin lactosa']; celdas[4] = ['pagado', 'servido a las 14:05'];
const { payload, heredadas } = desdeMapped(eje, celdas, compra.id);
console.log(corto(payload), 'heredadas', JSON.stringify(heredadas), 'coste', costeT(payload), 'minutos');
console.log('la 3 heredada alcanza', corto(resolver(eje.obtener(compra.id).payload, payload[3].dir)), 'sin copiar');
const sub = []; sub[1] = ['dos'];
console.log('con camino [1]:', corto(desdeMapped(eje, sub, compra.id, [1])));
const tarde = []; tarde[7] = ['más tarde'];
console.log('lo lejano se ancla:', corto(desdeMapped(eje, tarde, compra.id)));
try { desdeMapped(eje, [], compra.id); } catch (e) { console.log(e.message); }
"
```

```text
["hola",12.5,-3,"12 EUR",{"ref":"4598f23e"},{"ref":"4598f23e","dir":"1000000000"},"=LOCAL(1)"]
ítem vacío
referencia desconocida: ffff
"@zzzz"
"@ab"
"@4598f23e:12"
{"ref":"4598f23e"}
referencia demasiado corta: @ab
referencia desconocida: ffff
"servido" {"ref":"4598f23e"}
["llegar",{"ref":"4598f23e"},3]
hueco en la posición 1: rellénala o quita las siguientes
la hilera está vacía
la hilera tiene más de 10 posiciones
[{"ref":"f9e59d1e","dir":"0000000000"},{"ref":"f9e59d1e","dir":"1000000000"},"sin lactosa",{"ref":"f9e59d1e","dir":"3000000000"},["pagado","servido a las 14:05"]] heredadas [0,1,3] coste 6 minutos
la 3 heredada alcanza ["huesped","cocina"] sin copiar
con camino [1]: {"payload":[{"ref":"f9e59d1e","dir":"1000000000"},"dos"],"heredadas":[0],"anclados":[]}
lo lejano se ancla: {"payload":null,"heredadas":[],"anclados":[{"celda":[7,0,0],"en":"7000000000","payload":"más tarde","faltan":["5","6"]}]}
la décupla está vacía: ver ya es una modificación (clase 0); escribe o ve al menos una celda
```

Nota: `'@zzzz'` (no hexadecimal), `'@ab'` (corto) y `'@4598f23e:12'` (la subposición necesita diez dígitos) no casan con la forma de referencia y se guardan como texto. Las tres referencias heredadas de la décupla cuestan un minuto cada una: el coste cuenta posiciones del registro, no solo las tecleadas. Las líneas sin clase de la décupla son celdas `2.0.0`, `4.0.0` y `4.1.0`; compactadas, dan la misma décupla que antes de la matriz. La posición 7 está lejos (la compra solo desarrolla 0–4): se ancla en `7000000000` en vez de rechazarse.

La matriz sobre la compra del menú: ver el precio, pagarlo, ubicar celdas y escribir una salida con parte anclada.

```sh
node --input-type=module -e "
import { ejemploCompra } from './ejemplos/ikisai/compra-food.mjs';
import { desdeMapped, ubicar, escribirDesde, escribirSalida, CLASES } from './src/escritura.js';
import { resolver } from './src/btml.js';
const corto = (x) => JSON.stringify(x).replace(/[0-9a-f]{64}/g, (m) => m.slice(0, 8));
const T = '2026-11-07T16:00:00Z';
const { eje, compra } = await ejemploCompra();
console.log(CLASES.map((c, k) => k + ' ' + c).join(' · '));
const ver = desdeMapped(eje, [{ i: 1, j: 2, k: 0 }], compra.id);
console.log('ver 1.2.0:', corto(ver.payload), '· heredadas', JSON.stringify(ver.heredadas));
const pagar = desdeMapped(eje, [{ i: 1, j: 2, k: 4, contenido: 'pagar 12 EUR' }], compra.id);
console.log('pagar 1.2.4: [1][2] =', corto(pagar.payload[1][2]), '· heredadas', JSON.stringify(pagar.heredadas));
const lineas = []; lineas[1] = ['2.4 pagar 12 EUR']; lineas[4] = ['pagado', '0.1 con tarjeta'];
console.log('por líneas: [4] =', corto(desdeMapped(eje, lineas, compra.id).payload[4]));
for (const c of [[1, 2, 4], [7, 0, 0], [1, 5, 0]]) console.log('ubicar', c.join('.'), corto(ubicar(eje, compra.id, c)));
const mezcla = []; mezcla[2] = ['sin lactosa']; mezcla[7] = ['repetir el sábado'];
const salida = desdeMapped(eje, mezcla, compra.id);
console.log('salida', corto(salida));
await escribirDesde(eje, { modo: 'mapped', autor: 'huesped', sobre: compra.id, payload: salida.payload, t: T }).catch((e) => console.log(e.message));
const antes = eje.saldoT('huesped', 'minuto');
const { registro, anclados } = await escribirSalida(eje, { modo: 'mapped', autor: 'huesped', sobre: compra.id, salida, t: T });
console.log('registro en', registro.en, corto(registro.payload), '· anclado en', anclados[0].en, corto(anclados[0].payload), '·', antes - eje.saldoT('huesped', 'minuto'), 'minutos');
const celda = await escribirDesde(eje, { modo: 'pointed', autor: 'huesped', sobre: compra.id, celda: [9, 0, 0], payload: 'volver', t: T });
console.log('celda 9.0.0 →', celda.en, corto(celda.payload));
const dentro = await escribirDesde(eje, { modo: 'mapped', autor: 'huesped', sobre: compra.id, celda: [1, 2, 4], payload: 'pagar 12 EUR', t: T });
console.log('celda 1.2.4 →', dentro.en, dentro.payload[1][2][4], '·', dentro.movimientos[0].cantidad, 'posiciones');
"
```

```text
0 ver/sustituir · 1 impulso de recursos · 2 criterio · 3 comunicación · 4 acción · 5 estructura · 6 pasado · 7 futuro · 8 comparabilidad · 9 camino
ver 1.2.0: [{"ref":"f9e59d1e","dir":"0000000000"},[{"ref":"f9e59d1e","dir":"1000000000"},{"ref":"f9e59d1e","dir":"1100000000"},{"ref":"f9e59d1e","dir":"1200000000"}]] · heredadas [0,"1.0","1.1"]
pagar 1.2.4: [1][2] = [{"ref":"f9e59d1e","dir":"1200000000"},{"ref":"f9e59d1e","dir":"1210000000"},{"ref":"f9e59d1e","dir":"1220000000"},{"ref":"f9e59d1e","dir":"1230000000"},"pagar 12 EUR"] · heredadas [0,"1.0","1.1","1.2.0","1.2.1","1.2.2","1.2.3"]
por líneas: [4] = [[{"ref":"f9e59d1e","dir":"4000000000"},"con tarjeta"],"pagado"]
ubicar 1.2.4 {"ubicacion":"dentro","dir":"1240000000","faltan":[]}
ubicar 7.0.0 {"ubicacion":"anclado","en":"7000000000","dir":"7000000000","faltan":["5","6"]}
ubicar 1.5.0 {"ubicacion":"anclado","en":"1500000000","dir":"1500000000","faltan":["1.3","1.4"]}
salida {"payload":[{"ref":"f9e59d1e","dir":"0000000000"},{"ref":"f9e59d1e","dir":"1000000000"},"sin lactosa"],"heredadas":[0,1],"anclados":[{"celda":[7,0,0],"en":"7000000000","payload":"repetir el sábado","faltan":["5","6"]}]}
1 celda sin base en el foco se ancla aparte (7.0.0 en 7000000000): escribe la salida entera con escribirSalida
registro en 0000000000 [{"ref":"f9e59d1e","dir":"0000000000"},{"ref":"f9e59d1e","dir":"1000000000"},"sin lactosa"] · anclado en 7000000000 "repetir el sábado" · 4 minutos
celda 9.0.0 → 9000000000 "volver"
celda 1.2.4 → 0000000000 pagar 12 EUR · 8 posiciones
```

Lectura:

- `ver 1.2.0`: ver el precio emite una referencia a él (`1200000000`) y hereda por referencia lo anterior (la posición 0 y las subposiciones 1.0 y 1.1): cuatro posiciones.
- `pagar 1.2.4`: el pago está en `payload[1][2][4]`; las clases 0–3 del precio no se modificaron y se heredan (la 0 es el propio precio). Ocho posiciones.
- `por líneas`: `'0.1 con tarjeta'` ocupa la subposición 0 con clase 1 (impulso de recursos), así que `'pagado'` va a la subposición libre siguiente, la 1. La clase 0 de `4.0` se hereda (`4000000000`, la acción `pagar` de la compra).
- `ubicar 1.5.0`: la posición 1 de la compra tiene subposiciones 0–2; la 5 está lejos (faltan 1.3 y 1.4) y se ancla en `1500000000`.
- `salida`: la posición 2 cabe dentro; la 7 se ancla. `escribirDesde` con solo el payload la perdería y se rechaza; `escribirSalida` escribe el registro (3 posiciones) y el anclado (1): cuatro minutos. Lo anclado es un ocupante escrito de `7000000000` en la compra (`docs/BTML.md` §6).

```sh
node --input-type=module -e "
import { ejemploCompra } from './ejemplos/ikisai/compra-food.mjs';
import { escribirDesde, desdeSequenced } from './src/escritura.js';
const T = '2026-11-07T16:00:00Z';
const { eje, compra } = await ejemploCompra();
const antes = eje.saldoT('huesped', 'minuto');
const p = await escribirDesde(eje, { modo: 'pointed', autor: 'huesped', sobre: compra.id, en: '4000000000', payload: 'servido', t: T });
console.log(p.sobre === compra.id, p.en, JSON.stringify(p.contexto), JSON.stringify(p.movimientos), 'minutos', antes - eje.saldoT('huesped', 'minuto'));
const s = await escribirDesde(eje, { modo: 'sequenced', autor: 'huesped', sobre: compra.id, payload: desdeSequenced(eje, ['llegar', 'pedir', 'pagar']), t: T, contexto: { nota: 'libre' } });
console.log(s.en, JSON.stringify(s.contexto), s.movimientos[0].cantidad, 'hijos de la compra', eje.sobre(compra.id).length);
const grande = Array(10).fill(Array(3).fill('x'));
for (const modo of ['pointed', 'sequenced', 'mapped']) await escribirDesde(eje, { modo, autor: 'huesped', sobre: compra.id, payload: grande, t: T }).then((e) => console.log(e.contexto.modo, e.movimientos[0].cantidad), (e) => console.log(e.message));
const sc = await escribirDesde(eje, { modo: 'scened', autor: 'huesped', sobre: compra.id, payload: Array(10).fill(Array(10).fill('y')), t: T });
console.log(sc.contexto.modo, sc.movimientos[0].cantidad);
await escribirDesde(eje, { modo: 'otro', autor: 'huesped', sobre: compra.id, payload: 'x', t: T }).catch((e) => console.log(e.constructor.name + ': ' + e.message));
await escribirDesde(eje, { modo: 'mapped', autor: 'huesped', sobre: compra.id, payload: null, t: T }).catch((e) => console.log(e.message));
"
```

```text
true 4000000000 {"modo":"pointed"} [{"token":"T","escala":"minuto","cantidad":1,"de":"huesped","a":null}] minutos 1
0000000000 {"nota":"libre","modo":"sequenced"} 3 hijos de la compra 2
Pointed emite como mucho 10 posiciones; este registro tiene 30
sequenced 30
mapped 30
scened 100
Error: modo desconocido: otro
nada que escribir en el registro (si todo se ancla, escribe la salida con escribirSalida)
```

Treinta posiciones superan el tope de Pointed (10) y la proporción de Sequenced (20), pero caben en el tope de Sequenced (100): se escriben.

### 7.4 Qué usa el motor

| Registro | Vía | Modo | Posiciones |
|---|---|---|---|
| consolidación | `escribirDesde` | `mapped` | 1 + posiciones elegidas o heredadas (≤ 1000) |
| autorización | `escribirDesde` | `pointed` | 1 |
| ejecución | `eje.escribir` directo | — (sin `modo`, sin comprobar tope; `contexto.clase = 4`) | 3 |

`consolidar` no usa todavía `desdeMapped` ni `ubicar`: sus huecos se heredan si el foco tiene ocupantes y si no se rechazan (§3.4, §3.5).

Pendiente: si una hilera o una décupla deben anidarse en una posición concreta por decisión o siempre en la raíz del foco (hoy `en` lo elige quien llama; lo anclado va siempre a la dirección de su celda); el coste real de cada operación (hoy un minuto por posición, cartón piedra).

## 8. Eje temporal y comparabilidad

### 8.1 Bandas

```js
banda(deltaSegundos)  // → 'segundo' | 'minuto' | 'hora' | 'dia' | 'semana' | 'ciclo' | 'anio' | 'mas'
```

La banda de una distancia es la **escala más pequeña cuya duración es estrictamente mayor** que `|delta|` (`SEGUNDOS` de `src/tokens.js`: minuto 60, hora 3600, día 86400, semana 7 días, ciclo 28 días, año 365 días). Por eso 59 s es `minuto` y 60 s es `hora`; a partir de 365 días, `mas`. El signo no importa.

| `\|delta\|` en segundos | Banda |
|---|---|
| 0 – 59 | `segundo` si < 1, si no `minuto` |
| 60 – 3599 | `hora` |
| 3600 – 86399 | `dia` |
| 86400 – 604799 | `semana` |
| 604800 – 2419199 | `ciclo` |
| 2419200 – 31535999 | `anio` |
| ≥ 31536000 | `mas` |

### 8.2 Eje temporal del foco (PV6 y PV7)

```js
ejeTemporal(eje, foco, { ahora = new Date().toISOString(), maximo = 10, camino = [] } = {})
// → { foco, ahora, pasado: entrada[], futuro: entrada[], totalPasado, totalFuturo }
// entrada: { id, autor, t, tipo, delta (segundos respecto a ahora), banda, estado? (consolidacion), contenido? (declarado) }
```

El presente (`ahora`) es la costura. A la izquierda los registros; a la derecha las proyecciones:

| Lista | `tipo` | Qué entra |
|---|---|---|
| `pasado` | `registro` | el hilo del foco hacia atrás (sus antecesores, sin el propio foco, sea cual sea su `t`) y los escritos sobre el foco con `t <= ahora` |
| `futuro` | `proyeccion` | los escritos sobre el foco con `t > ahora` |
| `futuro` | `consolidacion` | las consolidaciones del foco (en `direccion([...camino, 4])`) que no están `EJECUTADO`, con su `estado`: futuro subjetivo, sea cual sea su `t` |
| `futuro` | `declarado` | lo que el foco tiene en la posición `[...camino, 7]` (`contenido`), con `delta: 0` y banda `segundo` |

Orden: `pasado` del más cercano al presente al más lejano; `futuro` del más cercano al más lejano. Una misma entrada (`id` + `tipo`) no se repite; una consolidación pendiente escrita antes de `ahora` aparece dos veces porque son dos tipos (`registro` en el pasado, `consolidacion` en el futuro). `maximo` (por defecto las diez décuplas de Sequenced) recorta cada lista; `totalPasado` y `totalFuturo` dan el tamaño sin recortar.

```sh
node --input-type=module -e "
import { ejemploCompra, ejemploCuenta } from './ejemplos/ikisai/compra-food.mjs';
import { ejeTemporal, banda } from './src/tiempo.js';
import { consolidar } from './src/motor.js';
const gastaT = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });
console.log([0, 59, 60, 3599, 3600, 86400, 7 * 86400, 28 * 86400, 365 * 86400].map((s) => s + ':' + banda(s)).join(' '), '· banda(-90)', banda(-90));
const { eje, compra } = await ejemploCompra();
await ejemploCuenta(eje, compra);
await eje.escribir({ autor: 'huesped', sobre: compra.id, en: '7000000000', t: '2026-11-13T13:30:00Z', movimientos: [gastaT('huesped')], payload: 'repetir el viernes' });
await consolidar(eje, { autor: 'huesped', foco: compra.id, t: '2026-11-07T14:30:00Z', elecciones: { 1: 'dos menús' } });
const e = ejeTemporal(eje, compra.id, { ahora: '2026-11-07T15:00:00Z' });
console.log('ahora', e.ahora, '· pasado', e.pasado.length, 'de', e.totalPasado, '· futuro', e.futuro.length, 'de', e.totalFuturo);
for (const x of e.pasado) console.log('  pasado', x.tipo.padEnd(13), x.id.slice(0, 8), x.autor.padEnd(8), x.t, String(x.delta).padStart(7), x.banda);
for (const x of e.futuro) console.log('  futuro', x.tipo.padEnd(13), x.id.slice(0, 8), x.autor.padEnd(8), x.t, String(x.delta).padStart(7), x.banda, x.estado ?? '');
const plan = await eje.escribir({ autor: 'casa', sobre: compra.id, t: '2026-11-07T14:00:00Z', movimientos: [gastaT('casa')], payload: ['Plan', 'a', 'b', 'c', 'd', 'e', 'f', 'cena el sábado'] });
const d = ejeTemporal(eje, plan.id, { ahora: '2026-11-07T15:00:00Z', maximo: 2 });
console.log(d.futuro.map((x) => x.tipo + ':' + x.contenido + ':' + x.delta + ':' + x.banda).join(' '), '· pasado', d.pasado.length, 'de', d.totalPasado);
"
```

```text
0:segundo 59:minuto 60:hora 3599:hora 3600:dia 86400:semana 604800:ciclo 2419200:anio 31536000:mas · banda(-90) hora
ahora 2026-11-07T15:00:00Z · pasado 5 de 5 · futuro 2 de 2
  pasado registro      08bdf337 huesped  2026-11-07T14:30:00Z   -1800 hora
  pasado registro      c70bfa6e cocina   2026-11-07T14:10:00Z   -3000 hora
  pasado registro      4598f23e cocina   2026-11-07T09:00:00Z  -21600 dia
  pasado registro      ccf5a120 casa     2026-11-07T09:00:00Z  -21600 dia
  pasado registro      6c1c5968 casa     2026-11-07T09:00:00Z  -21600 dia
  futuro consolidacion 08bdf337 huesped  2026-11-07T14:30:00Z   -1800 hora PENDIENTE DE AUTORIZACIÓN
  futuro proyeccion    72bf0b74 huesped  2026-11-13T13:30:00Z  513000 semana 
declarado:cena el sábado:0:segundo · pasado 2 de 4
```

### 8.3 Comparabilidad relativa (PV8)

```js
medir(eje, id)      // → { posiciones, escritos, movimientos }  posiciones desarrolladas del payload, hijos directos, movimientos del evento
comparar(eje, foco) // → { foco, posicion, de, comparables: [{ id, autor, posiciones, escritos, movimientos, puntuacion }], hitos: HITOS }
HITOS               // diez hitos { indice, nivel, nombre }, congelados
```

Los **comparables accesibles** del foco son sus hermanos: los registros escritos sobre el mismo padre (`eje.sobre(foco.sobre)`, sin distinguir `en`). El génesis solo se compara consigo mismo. La puntuación es `posiciones + 2 × escritos + movimientos` (cartón piedra); la lista va de mayor a menor puntuación y `posicion` es la del foco (1 = más medido). No asigna nivel ni grado: `HITOS` es una tabla heredada sin algoritmo que la aplique (pendiente). Las estrellas no son verdad.

| Índice | Nivel | Nombre |
|---|---|---|
| 0 | 0.3 | idea |
| 1 | 1.1 | aprendizaje |
| 2 | 2.1 | aprendizaje avanzado |
| 3 | 3.1 | aprendizaje profesional |
| 4 | 3.2 | resolución profesional |
| 5 | 4.1 | aprendizaje superior |
| 6 | 4.2 | solución profesional avanzada |
| 7 | 5.1 | investigación |
| 8 | 5.2 | trabajo maestro |
| 9 | 5.3 | resolución experimental |

```sh
node --input-type=module -e "
import { ejemploCompra, ejemploCuenta } from './ejemplos/ikisai/compra-food.mjs';
import { comparar, medir, HITOS } from './src/tiempo.js';
const gastaT = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });
const { eje, alta, menu, compra } = await ejemploCompra();
await ejemploCuenta(eje, compra);
const nota = await eje.escribir({ autor: 'casa', sobre: alta.id, t: '2026-11-07T10:00:00Z', movimientos: [gastaT('casa')], payload: 'nota breve' });
console.log('menú', JSON.stringify(medir(eje, menu.id)), '· nota', JSON.stringify(medir(eje, nota.id)), '· compra', JSON.stringify(medir(eje, compra.id)));
const c = comparar(eje, menu.id);
console.log('menú: posición', c.posicion, 'de', c.de, '·', c.comparables.map((x) => x.id.slice(0, 8) + ' ' + x.autor + ' ' + x.puntuacion).join(' | '));
console.log('nota: posición', comparar(eje, nota.id).posicion, '· génesis: de', comparar(eje, eje.genesisId).de, '· hitos', c.hitos === HITOS, HITOS.length, HITOS[9].nivel, HITOS[9].nombre);
"
```

```text
menú {"posiciones":6,"escritos":1,"movimientos":1} · nota {"posiciones":1,"escritos":0,"movimientos":1} · compra {"posiciones":9,"escritos":1,"movimientos":2}
menú: posición 1 de 2 · 4598f23e cocina 9 | 33fe0503 casa 2
nota: posición 2 · génesis: de 1 · hitos true 10 5.3 resolución experimental
```

Pendiente: confluencia estadística del 8 (bases por medida y por posición), proyecciones reales en PV7 (timelocks, hashlocks, fechas en el payload más allá de la posición 7), nivel y grado.

## 9. Persistencia

```js
VERSION = 1
serializar(eje)                     // → { version: 1, exigirFirmas, eventos: evento[] }  solo los eventos, en orden
restaurar(datos)                    // → Promise<Eje>  Eje.desde(eventos): vuelve a validar ids, firmas y saldos; lanza si algo no cuadra
guardarLocal(eje, clave = 'agram.eje')  // → boolean  localStorage.setItem(clave, JSON); false si lanza
cargarLocal(clave = 'agram.eje')        // → Promise<Eje | null>  null si no hay nada o algo falla
borrarLocal(clave = 'agram.eje')        // → void
```

Se guarda **la lista de eventos y nada más**. Todo lo demás se reconstruye al restaurar: saldos, identidades, claves, índice de hijos, el árbol lógico y, con él, los estados de la fábrica (`estadoDe` vuelve a calcularse desde los escritos). Un evento manipulado en el guardado se rechaza (`id no corresponde al cuerpo`); una firma quitada también (`firma ausente`). Errores propios: `datos de eje inválidos` (sin `version: 1`, sin eventos), `el primer evento debe ser el génesis`.

En Node no hay `localStorage`: `guardarLocal` devuelve `true` sin guardar nada (no lanza) y `cargarLocal` devuelve `null`. En el navegador, `localStorage` es una comodidad por visor. Pendiente: base de datos y anclaje a una cadena; la forma de los eventos no cambia con eso.

```sh
node --input-type=module -e "
import { ejemploCompra, ejemploCuenta } from './ejemplos/ikisai/compra-food.mjs';
import { consolidar, autorizar, ejecutar, estadoDe } from './src/motor.js';
import { serializar, restaurar, guardarLocal, cargarLocal, borrarLocal, VERSION } from './src/persistencia.js';
const T = '2026-11-07T16:00:00Z';
const { eje, compra } = await ejemploCompra();
await ejemploCuenta(eje, compra);
const c = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: T, elecciones: { 1: 'dos menús' } });
await autorizar(eje, { autorizante: 'casa', consolidacion: c.id, t: T });
const datos = JSON.parse(JSON.stringify(serializar(eje)));
console.log(datos.version === VERSION, datos.exigirFirmas, datos.eventos.length, 'eventos ·', Object.keys(datos).join(','), '·', Object.keys(datos.eventos[5]).join(','));
const otro = await restaurar(datos);
console.log(otro.orden.length, estadoDe(otro, c.id), JSON.stringify(otro.identidades()), otro.saldo('cocina', 'E:casa/EUR'), otro.sobre(c.id).length);
const e = await ejecutar(otro, { autor: 'huesped', consolidacion: c.id, t: T });
console.log('en la copia', estadoDe(otro, c.id), '· en el original', estadoDe(eje, c.id), eje.obtener(e.id) === undefined);
datos.eventos[6].payload = '==no autorizo';
await restaurar(datos).catch((err) => console.log(err.message));
await restaurar({ version: 2, eventos: [] }).catch((err) => console.log(err.message));
console.log(typeof globalThis.localStorage, guardarLocal(eje), await cargarLocal());
const almacen = new Map();
globalThis.localStorage = { getItem: (k) => almacen.get(k) ?? null, setItem: (k, v) => almacen.set(k, v), removeItem: (k) => almacen.delete(k) };
console.log(guardarLocal(eje, 'prueba'), (await cargarLocal('prueba')).orden.length, almacen.get('prueba').length > 1000);
borrarLocal('prueba');
console.log(await cargarLocal('prueba'));
"
```

```text
true false 7 eventos · version,exigirFirmas,eventos · autor,sobre,en,t,movimientos,payload,contexto,id
7 AUTORIZADO ["casa","cocina","huesped"] 12 1
en la copia EJECUTADO · en el original AUTORIZADO true
evento rechazado: id no corresponde al cuerpo
datos de eje inválidos
undefined true null
true 7 true
null
```

## 10. Ejemplo completo ejecutable

Guardar como `motor-ejemplo.mjs` en la raíz del repositorio y ejecutar `node motor-ejemplo.mjs` (o, sin guardar, `node --input-type=module < motor-ejemplo.mjs`). Recorre el ciclo entero sobre un eje nuevo: génesis con poder, altas, delegación de P con ámbito, escritura desde Mapped con herencia, descubrir, consolidar, autorizar, ejecutar, eje temporal, comparabilidad y restauración.

```js
// ejecutable: guardar en la raíz del repositorio como motor-ejemplo.mjs y ejecutar
//   node motor-ejemplo.mjs      (o, sin guardar: node --input-type=module < motor-ejemplo.mjs)
import { Eje } from './src/eje.js';
import { descubrir, consolidar, autorizar, ejecutar, estadoDe, consolidaciones, puedeAutorizar, FABRICA } from './src/motor.js';
import { desdeMapped, escribirDesde } from './src/escritura.js';
import { ejeTemporal, comparar } from './src/tiempo.js';
import { serializar, restaurar } from './src/persistencia.js';
import { evaluar } from './src/bql.js';

const corto = (x) => JSON.stringify(x).replace(/[0-9a-f]{64}/g, (m) => m.slice(0, 8));
const gastaT = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });
const t = (hora) => '2026-11-07T' + hora + ':00Z';

// 1. Génesis: la casa recibe tiempo (horas y minutos, tokens distintos), euros y poder sobre todo el eje (ámbito «genesis»).
const eje = await Eje.genesis({ identidad: 'casa', emision: [{ token: 'T', escala: 'hora', cantidad: 100 }, { token: 'T', escala: 'minuto', cantidad: 600 }, { token: 'E', denominacion: 'EUR', cantidad: 500 }, { token: 'P', cantidad: 5, ambito: 'genesis' }], foco: 'Casa de ejemplo', t: t('09:00') });
// 2. Altas: cocina y una persona huésped existen al recibir tokens.
const alta = await eje.escribir({ autor: 'casa', sobre: eje.genesisId, t: t('09:00'), movimientos: [gastaT('casa'), { token: 'T', escala: 'hora', cantidad: 10, de: 'casa', a: 'cocina' }, { token: 'T', escala: 'minuto', cantidad: 60, de: 'casa', a: 'cocina' }, { token: 'T', escala: 'hora', cantidad: 10, de: 'casa', a: 'huesped' }, { token: 'T', escala: 'minuto', cantidad: 60, de: 'casa', a: 'huesped' }, { token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 50, de: 'casa', a: 'huesped' }], payload: ['Altas', ['cocina', 'huesped']] });
// 3. Cocina publica el menú sobre el alta; la casa le delega poder sobre el menú (y lo que cuelgue de él).
const menu = await eje.escribir({ autor: 'cocina', sobre: alta.id, t: t('09:30'), movimientos: [gastaT('cocina')], payload: ['Menú del día', ['ensalada', 'guiso', 'fruta'], ['sin gluten', 'vegetariano'], ['cocina'], ['servir', 'cobrar 14 EUR']] });
await eje.escribir({ autor: 'casa', sobre: menu.id, t: t('09:35'), movimientos: [gastaT('casa'), { token: 'P', cantidad: 2, ambito: menu.id, de: 'casa', a: 'cocina' }], payload: 'cocina decide sobre su menú' });
// 4. La persona huésped escribe desde Mapped sobre el menú: una décupla que hereda del foco lo que no rellena.
const celdas = [];
celdas[1] = ['@' + menu.id.slice(0, 8) + ':1100000000', '1'];
celdas[3] = ['huesped', 'cocina'];
const { payload, heredadas } = desdeMapped(eje, celdas, menu.id);
const pedido = await escribirDesde(eje, { modo: 'mapped', autor: 'huesped', sobre: menu.id, t: t('13:30'), payload });
console.log('pedido', corto(pedido.payload), '· heredadas', JSON.stringify(heredadas), '· coste', pedido.movimientos[0].cantidad, 'min');
// 5. Descubrir: qué hay en las posiciones 1–4 del pedido.
const d = descubrir(eje, pedido.id);
for (const p of d) console.log('posición', p.posicion, p.candidatos.map((c) => c.origen + ' ' + c.texto + ' (' + c.signo + ')').join(' · ') || 'nada');
// 6. Consolidar: elegir el guiso (lo que alcanza la referencia) y fijar la acción en 4.
const guiso = d[0].candidatos.find((c) => c.origen === 'referencia');
const cons = await consolidar(eje, { autor: 'huesped', foco: pedido.id, t: t('13:40'), titulo: 'Pedido del guiso', elecciones: { 1: { candidato: guiso }, 2: 'sin lactosa', 4: 'pagar 14 EUR' } });
console.log('consolidación', corto(cons.payload), '· en la fábrica', cons.en === FABRICA, '·', estadoDe(eje, cons.id));
console.log('encaje guardado', corto(cons.contexto.encaje));
// 7. Autorizar: cocina puede (poder sobre el menú, del que cuelga el pedido); la casa también; la persona huésped no (es el autor).
console.log('puede autorizar', ['casa', 'cocina', 'huesped'].map((i) => i + '=' + puedeAutorizar(eje, i, cons.id)).join(' '));
await autorizar(eje, { autorizante: 'huesped', consolidacion: cons.id, t: t('13:41') }).catch((e) => console.log('rechazo:', e.message));
const aut = await autorizar(eje, { autorizante: 'cocina', consolidacion: cons.id, t: t('13:45'), nota: 'sale en 10 minutos' });
console.log('autorización', JSON.stringify(aut.payload), '·', estadoDe(eje, cons.id));
// 8. Ejecutar: el autor mueve los euros y deja la evidencia.
const ej = await ejecutar(eje, { autor: 'huesped', consolidacion: cons.id, t: t('14:05'), titulo: 'Pagado y servido', movimientos: [{ token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 14, de: 'huesped', a: 'cocina' }] });
console.log('ejecución', corto(ej.payload), '· evidencia', corto(ej.contexto.evidencia), '·', estadoDe(eje, cons.id));
console.log('EUR cocina', eje.saldo('cocina', 'E:casa/EUR'), 'huesped', eje.saldo('huesped', 'E:casa/EUR'), '· hilo de la ejecución:', eje.hilo(ej.id).map((x) => x.autor).join(' → '));
console.log('consolidaciones del pedido', corto(consolidaciones(eje, pedido.id)));
// 9. Eje temporal del pedido a las 14:10 y comparabilidad entre hermanos (lo escrito sobre el menú).
const et = ejeTemporal(eje, pedido.id, { ahora: t('14:10') });
console.log('pasado', et.pasado.map((x) => x.tipo + ':' + x.autor + ':' + x.banda).join(' '), '· futuro', et.futuro.length);
const cmp = comparar(eje, pedido.id);
console.log('comparar: posición', cmp.posicion, 'de', cmp.de, '·', cmp.comparables.map((x) => x.autor + '=' + x.puntuacion).join(' '));
// 10. Persistir y restaurar: los estados se recalculan desde los eventos.
const otro = await restaurar(JSON.parse(JSON.stringify(serializar(eje))));
console.log('restaurado', otro.orden.length, 'eventos ·', estadoDe(otro, cons.id), '· posición 2 de la consolidación:', evaluar(otro, cons.id, [2]).texto);
```

```text
pedido [{"ref":"46ff5dd9","dir":"0000000000"},[{"ref":"46ff5dd9","dir":"1100000000"},1],{"ref":"46ff5dd9","dir":"2000000000"},["huesped","cocina"]] · heredadas [0,2] · coste 6 min
posición 1 propio → 46ff5dd9 (exacto) · propio → 46ff5dd9 (exacto) · referencia guiso (reducir)
posición 2 propio → 46ff5dd9 (exacto) · referencia sin gluten (exacto)
posición 3 propio huesped (exacto) · propio huesped (exacto)
posición 4 nada
consolidación ["Pedido del guiso",{"ref":"46ff5dd9","dir":"1100000000"},"sin lactosa",{"ref":"0f4572a1","dir":"3000000000"},"pagar 14 EUR"] · en la fábrica true · PENDIENTE DE AUTORIZACIÓN
encaje guardado [{"posicion":1,"evento":"46ff5dd9","tipo":"referencia","origen":"1100000000","destino":"1000000000","vector":[0,1,0,0,0,0,0,0,0,0],"signo":"reducir","clase":0},{"posicion":2,"tipo":"nuevo","destino":"2000000000","clase":0},{"posicion":4,"tipo":"nuevo","destino":"4000000000","clase":0}]
puede autorizar casa=true cocina=true huesped=false
rechazo: el autor no se autoriza a sí mismo
autorización "==sale en 10 minutos" · AUTORIZADO
ejecución ["Pagado y servido",{"ref":"936b2cd1"},{"ref":"97ec0c43"}] · evidencia ["936b2cd1","97ec0c43"] · EJECUTADO
EUR cocina 14 huesped 36 · hilo de la ejecución: huesped → huesped → huesped → cocina → casa → casa
consolidaciones del pedido [{"id":"936b2cd1","autor":"huesped","t":"2026-11-07T13:40:00Z","titulo":"Pedido del guiso","estado":"EJECUTADO","fuentes":["46ff5dd9"]}]
pasado registro:huesped:hora registro:cocina:dia registro:casa:dia registro:casa:dia · futuro 0
comparar: posición 1 de 2 · huesped=9 casa=3
restaurado 8 eventos · EJECUTADO · posición 2 de la consolidación: sin lactosa
```

Lectura de la salida:

- `pedido`: las posiciones 0 y 2 no se rellenaron y están por debajo de la 3, así que se heredan del menú por referencia; seis posiciones, seis minutos.
- `posición 1`: colisionan `[1]` y `[1, 0]` (la referencia al guiso) con lo que esa referencia alcanza. El guiso vive en la profundidad 1.1 del menú y se coloca en la 1 del pedido: vector `[0, 1, …]` (candidato − buscado), signo `reducir` (le sobra una profundidad). `posición 4 nada`: el pedido tiene posiciones 0–3 y nadie ha escrito en su 4.
- `consolidación`: la elección de la 1 es la referencia al guiso (`menú:1100000000`); la 3 se hereda del pedido; el encaje guardado es el del candidato elegido más los dos terminales nuevos (2 y 4), cada uno con su clase: 0, porque en la raíz del foco elegir es ver o sustituir la posición.
- `puede autorizar`: cocina, por los 2 P con ámbito el menú (el pedido cuelga del menú); la casa, por los 3 P que le quedan sobre `genesis`; la persona huésped no, porque es el autor.
- `EUR cocina 14 huesped 36`: los euros se mueven en la ejecución, no antes. El hilo de la ejecución recorre autores: huésped (ejecución) → huésped (consolidación) → huésped (pedido) → cocina (menú) → casa (alta) → casa (génesis).
- `futuro 0`: la única consolidación ya está ejecutada y el pedido no tiene posición 7. `comparar`: los hermanos del pedido son lo escrito sobre el menú: el pedido (6 posiciones + 2 × 1 escrito + 1 movimiento = 9) y la delegación de poder (1 + 0 + 2 = 3).
- `restaurado 8 eventos`: génesis, alta, menú, delegación, pedido, consolidación, autorización y ejecución; el estado `EJECUTADO` se recalcula desde ellos.

## 11. API mínima

```js
// src/motor.js
export const FABRICA = '4000000000';
export const FASES = ['consolidado', 'autorizado', 'ejecutado'];
export const CLASE_EJECUTADO = 4;
export const OPERADORES = { Q: 'descubrir', B: 'proponer', C: 'consolidar' };
export function caminoVisible(ocupante): number[];
export function proponer(eje, foco, { camino = [], posiciones = [1, 2, 3, 4] } = {}): { foco, elecciones, origenes, pendientes };
export function descubrir(eje, foco, { camino = [], posiciones = [1, 2, 3, 4] } = {}): { posicion, dir, candidatos: Candidato[] }[];
export async function consolidar(eje, { autor, foco, elecciones, titulo = 'Consolidación', t, camino = [] }, privada?): Promise<Evento>;
export function puedeAutorizar(eje, identidad, consolidacion): boolean;
export async function autorizar(eje, { autorizante, consolidacion, t, nota = 'autorizo' }, privada?): Promise<Evento>;
export async function ejecutar(eje, { autor, consolidacion, movimientos = [], t, titulo = 'Ejecutado' }, privada?): Promise<Evento>;
export function autorizacionesValidas(eje, consolidacion): Evento[];
export function estadoDe(eje, consolidacion): 'PENDIENTE DE AUTORIZACIÓN' | 'AUTORIZADO' | 'EJECUTADO' | undefined;
export function consolidaciones(eje, foco, camino = []): { id, autor, t, titulo, estado, fuentes }[];

// src/escritura.js
export function resolverRef(eje, prefijo): { ref };
export function item(eje, texto): number | string | { ref, dir? };
export function desdePointed(eje, texto): terminal;
export function desdeSequenced(eje, textos: string[]): terminal[];
export function desdeMapped(eje, entrada: string[][] | { i, j?, k?, contenido? }[], foco, camino = []): { payload: any[] | null, heredadas: (number | string)[], anclados: { celda, en, payload, faltan }[] };
export function ubicar(eje, foco, celda: number[], { camino = [], escritas = [] } = {}): { ubicacion: 'dentro' | 'anclado', dir, en?, faltan: string[] };
export function costeT(payload): number;
export async function escribirDesde(eje, { modo, autor, sobre, en = '0000000000', payload, t = ahora, contexto = {}, celda?, camino = [] }, privada?): Promise<Evento>;
export async function escribirSalida(eje, { modo = 'mapped', autor, sobre, en = '0000000000', camino = [], salida, t = ahora, contexto = {} }, privada?): Promise<{ registro: Evento | null, anclados: Evento[] }>;
export const CLASES: string[10];  // ver/sustituir, impulso de recursos, criterio, comunicación, acción, estructura, pasado, futuro, comparabilidad, camino
export function claseDe(dir): number;
export { esReferencia };

// src/modos.js
export const MODOS = { pointed: { nombre: 'Pointed', decuplas: 1, proporcion: [1/10, 1/10], tope: 10 }, sequenced: { nombre: 'Sequenced', decuplas: 10, proporcion: [1/10, 1/5], tope: 100 }, mapped: { nombre: 'Mapped', decuplas: 100, proporcion: [1/4, 1/3], tope: 1000 }, scened: { nombre: 'Scened', decuplas: 1000, proporcion: null, tope: 10000 } };
export function nombreModo(modo): string;
export function lectura(modo): number;
export function tope(modo): number;
export function escritura(modo): [number, number] | null;
export function contarPosiciones(payload): number;
export function cabeTope(payload, modo): boolean;
export function cabeEscritura(payload, modo): boolean;
export function proporcion(payload, modo): { posiciones, rango: [number, number] | null, estado: 'por debajo' | 'dentro' | 'por encima' | 'sin fijar' };

// src/tiempo.js
export function banda(deltaSegundos): string;
export function ejeTemporal(eje, foco, { ahora, maximo = 10, camino = [] } = {}): { foco, ahora, pasado, futuro, totalPasado, totalFuturo };
export const HITOS: { indice, nivel, nombre }[10];
export function medir(eje, id): { posiciones, escritos, movimientos };
export function comparar(eje, foco): { foco, posicion, de, comparables, hitos };

// src/persistencia.js
export const VERSION = 1;
export function serializar(eje): { version, exigirFirmas, eventos };
export async function restaurar(datos): Promise<Eje>;
export function guardarLocal(eje, clave = 'agram.eje'): boolean;
export async function cargarLocal(clave = 'agram.eje'): Promise<Eje | null>;
export function borrarLocal(clave = 'agram.eje'): void;
```

Las anotaciones de tipo son documentación; el código es JavaScript puro sin dependencias. `Evento`, `Eje` y `Ocupante` están en `docs/BTML.md` §10; `Candidato` es un `Ocupante` más `estado` y `texto` (§2).

## 12. Lo que no existe (pendiente)

| Pendiente | Hoy |
|---|---|
| AARPIA: autorización y ejecución reales, con sus agentes | Regla V0: autoriza quien tiene P > 0 sobre el registro y no es el autor; ejecuta el autor (§4.1). |
| Las seis capacidades del motor (interpretar, resolver, posicionar, comparar, calcular, componer) como operaciones | No existen como funciones. |
| Rechazar, revocar, caducar; varias autorizaciones (quórum); ejecución por tramos | Tres estados y una sola autorización válida basta; `ejecutar` toma la primera. |
| Recibos de terceros referenciados por la operación raíz (aceptación, despacho, recepción) | La evidencia es consolidación + autorización; nada más se enlaza. |
| Cierre de una interacción en la interfaz | Fuera del motor. |
| Qué hace la interfaz con la proporción (**[X] decidir VG**: avisar o rechazar); proporción de Scened | Solo rechaza el tope duro (10/100/1000/10000); `proporcion` informa; Scened sin proporción. |
| Render de Scened | Scened tiene tope (10000) y lectura, sin render. |
| El formulario de Mapped pide la clase de cada celda (`app.js`) | Hoy pide líneas por posición: sin prefijo, clase 0; `j.k texto` fija subposición y clase. `app.js` escribe con `escribirDesde` y no con `escribirSalida`: lo que se ancla se rechaza con aviso, no se pierde. |
| «Ver» como registro mínimo desde la interfaz | `desdeMapped` lo admite (celda de clase 0 sin contenido); ninguna pantalla lo emite. |
| `consolidar` con la matriz: clases heredadas y anclaje de lo lejano (**[X] decidir VG**, §3.5) | `consolidar` guarda la clase de cada elección, pero hereda por ocupantes y rechaza el hueco sin ellos. |
| Clase de la autorización (**[X] decidir VG**: ¿2, criterio?) | `autorizar` no guarda clase; la ejecución guarda la 4. |
| Clases sin modificar de una celda: referencia a `i.j.k` o a la celda (**[X] decidir VG**, §7.2) | Referencia a `i.j.k`. |
| Marca propia para el prefijo de celda en las líneas (**[X] decidir VG**, §7.3) | `j.k texto`; un texto que empieza por `d.d ` se escribe con su celda delante. |
| Coste real de las operaciones | Un minuto de T por posición escrita, y uno por autorización o ejecución. |
| Anidar hileras o décuplas en una posición por decisión | `en` lo elige quien llama (raíz por defecto); lo anclado va a la dirección de su celda. |
| Reglas por dimensión para el signo guardado en `encaje`; cambio del encaje con la época | El vector se guarda tal cual; ninguna regla lo filtra. |
| Caché y snapshot en la evaluación segura | BQL tiene pila de ciclos y presupuesto; no hay caché (`docs/BQL.md` §9). |
| Confluencia estadística del 8; nivel y grado; `HITOS` aplicados | `comparar` ordena hermanos por una puntuación fija; `HITOS` es una tabla. |
| Proyecciones reales en PV7: timelocks, hashlocks, fechas dentro del payload | Solo escritos con `t > ahora` y la posición 7 del foco. |
| Comprobar `t` contra un reloj o contra el orden del eje | Solo `Date.parse`. |
| Persistencia en base de datos; anclaje a una cadena; sincronización entre visores | Lista de eventos en memoria; `localStorage` por visor. |
| Render animado de las operaciones (sobrio/animado) | Solo renders sobrios en `pointed.js`, `sequenced.js`, `mapped.js`; el frontend (`app.js`) queda fuera de este documento. |

## 13. Límites y defectos observados (no corregidos aquí)

1. `autorizar` guarda `'==' + nota`: BQL lo lee como `=<nota>` (`'==vale'` → `=vale`), no como `<nota>`. El escape se antepone siempre, haga falta o no.
2. `estadoDe` declara `EJECUTADO` ante cualquier escrito del autor con `fase: 'ejecutado'` cuya `evidencia` exista o falte, **sin comprobar que haya autorización válida**: un autor puede escribir a mano un «ejecutado» sobre una consolidación nunca autorizada (§6). `ejecutar` sí lo impide; `eje.escribir` no.
3. Hueco heredado cuando el foco no desarrolla la posición pero tiene escritos en ella: `consolidar` hereda `{ ref: foco, dir }` porque hay ocupantes, pero esa referencia alcanza `undefined` en el payload del foco; el escrito que justificó la herencia no queda referenciado. `desdeMapped` no tiene este caso (mira solo el payload, y lo que no tiene base lo ancla). Las dos reglas de base siguen siendo distintas (§3.5, §7.2).
4. `consolidar` no comprueba el foco antes de construir el payload: sin huecos, el error llega del eje (`evento rechazado: foco desconocido`); con huecos, del encaje (`registro desconocido`).
5. Una elección que es un array se guarda como subarray aunque el código la llame «terminal nuevo»; una elección `{ ref, dir }` no comprueba que `dir` exista en la fuente.
6. `ejecutar` no pasa por `escribirDesde`: su registro no lleva `contexto.modo` y no se comprueba el tope. Toma como evidencia la primera autorización válida aunque haya varias.
7. `escribirSalida` no es atómica: si el eje rechaza una celda anclada (saldo de T, firma…), el registro y los anclados anteriores quedan escritos. El aviso de `escribirDesde` sobre celdas ancladas solo funciona si se le pasa el mismo objeto `payload` que devolvió `desdeMapped` (una copia no lo lleva).
8. `guardarLocal` devuelve `true` en Node sin `localStorage` aunque no haya guardado nada.
9. `banda` usa «estrictamente menor»: 60 s es `hora`, 3600 s es `dia`, 86400 s es `semana`.
10. `ejeTemporal` pone en `pasado` todos los antecesores del hilo aunque su `t` sea posterior a `ahora` (delta positivo en el pasado).
11. `consolidaciones(eje, foco, camino)` solo ve la fábrica de ese camino; una consolidación anclada en otra profundidad no aparece en el eje temporal de la raíz.
12. `costeT` cobra las referencias heredadas como posiciones escritas, y el tope las cuenta como emitidas: «se emiten solo las celdas modificadas», pero lo anterior heredado por referencia también ocupa posiciones del registro.
13. `escribirDesde` y `ejecutar` usan el reloj si falta `t`: ids no reproducibles.
14. `comparar` compara hermanos por `sobre` sin distinguir `en`; la puntuación `posiciones + 2 × escritos + movimientos` es cartón piedra, sin respaldo en el corpus.
15. La regla V0 permite que el autor de una consolidación sea quien tenga todo el poder: entonces nadie puede autorizarla (la casa consolidando sobre su propio eje sin haber delegado P).
