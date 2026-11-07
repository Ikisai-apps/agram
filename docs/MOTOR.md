# El motor AGRAM: el ciclo tal como existe

AGRAM es el motor: la ejecución real sobre la estructura de datos (BTML, `docs/BTML.md`) y la lógica de vistas (BQL, `docs/BQL.md`). Este documento describe **lo que existe hoy** en `src/motor.js`, `src/escritura.js`, `src/modos.js`, `src/tiempo.js`, `src/persistencia.js` y `src/bases.js`, con firmas de funciones, tablas y ejemplos ejecutados con Node 24 desde la raíz del repositorio. Lo que no existe se marca «pendiente». Fuente de verdad: esos seis módulos y `test/motor.test.js`, `test/escritura.test.js`, `test/modos.test.js`, `test/fabrica-1000.test.js`, `test/tiempo.test.js`, `test/confluencia.test.js`, `test/persistencia.test.js`, `test/bases.test.js`, `test/eprt.test.js`, `test/vector.test.js`.

Convenciones:

- Los ejemplos se ejecutan **desde la raíz del repositorio** con `node --input-type=module -e "..."` (Node ≥ 20). La salida que sigue a cada ejemplo es la salida real.
- El eje de ejemplo es `ejemplos/ikisai/compra-food.mjs` (datos inventados). Sus ids son deterministas (hash del cuerpo con `t` fijo): génesis `6c1c5968`, alta `ccf5a120`, menú `4598f23e`, compra `f9e59d1e`, cuenta `c70bfa6e`. En las salidas los ids se acortan a ocho caracteres con `corto`. Los tres documentos (`docs/BTML.md`, `docs/BQL.md` y este) citan los mismos ids; en un programa no se copian, se usan `compra.id`, `cuenta.id`… (cambian en cuanto cambia el cuerpo de un evento: pasó con la PR #18, con la PR #28, que cambió el vector que guardan las consolidaciones, y con la PR #35, que puso el génesis en series).
- Toda escritura recibe `t` explícito. `escribirDesde` y `ejecutar` usan `new Date().toISOString()` si falta, y entonces los ids no son reproducibles.
- Un «registro» y un «evento» son lo mismo. El «foco» es el registro sobre el que se trabaja. Una «consolidación» es el registro que escribe `consolidar`.

## 0. Mapa de módulos

| Módulo | Qué define | Exports |
|---|---|---|
| `src/motor.js` | El ciclo de la fábrica (PV4); la capacidad de una posición (§5.1, solo informa) | `descubrir`, `proponer`, `consolidar`, `autorizar`, `ejecutar`, `puedeAutorizar`, `poderParaAutorizar`, `autorizacionesValidas`, `estadoDe`, `esConsolidacion`, `consolidaciones`, `caminoVisible`, `capacidadDe`, `tramoDe`, `registrosEn`, `ocupacion`, `FABRICA`, `FASES`, `OPERADORES`, `REGLA_AUTORIZAR`, `CRITERIO_CAPACIDAD` |
| `src/escritura.js` | El registro de salida de cada modo; la matriz 10×10×10 de la fábrica | `item`, `resolverRef`, `desdePointed`, `desdeSequenced`, `desdeMapped`, `ubicar`, `costeT`, `escribirDesde`, `escribirSalida`, `CLASES`, `claseDe`, `esReferencia` |
| `src/modos.js` | Mínimo y máximo por modo (los mismos para leer y emitir), proporción | `MODOS`, `nombreModo`, `maximo`, `minimo`, `alcanceDe`, `lectura`, `tope`, `escritura`, `contarPosiciones`, `cabeTope`, `cabeEscritura`, `proporcion`, `proporcionDe` |
| `src/tiempo.js` | Eje temporal (PV6/PV7) y comparabilidad (PV8), §8; la confluencia del 8 y sus cohortes, que usan las bases (§14 y `docs/FUNDAMENTOS.md`) | `banda`, `ejeTemporal`, `medir`, `comparar`, `comparables`, `proyectoDe`, `confluir`, `fundir`, `medidasDe`, `posicionesDe`, `distribucion`, `cortesDeCohorte`, `cajaDe`, `clavesDe`, `etiquetaClave`, `ALCANCES`, `CAJAS`, `MEDIDAS`, `HITOS` |
| `src/persistencia.js` | Guardar y reconstruir el eje | `serializar`, `restaurar`, `guardarLocal`, `cargarLocal`, `borrarLocal`, `apartarLocal`, `VERSION` |
| `src/bases.js` | Bases del 8: registros fundibles en la posición 8, escritos por la propia cosa (§14) | `identidadDe`, `medir`, `unitaria`, `fundir`, `calcularBase`, `escribirBase`, `leerBase`, `frescura`, `comprobar`, `situar`, `valorDeBases`, `cajasEtiquetadas`, `hijos`, `esBase`, `basesEn`, `basePorId`, `baseDePayload`, `payloadDeBase`, `empaquetar`, `bloqueDe`, `cortesDe`, `clavesDeMedidas`, `estadisticaVacia`, `CIELO`, `CORTES_PROVISIONALES`, `COSTE_BASE`, `CAMPOS_BASE`, `CAMPOS_FOCO`, `ETIQUETAS`, `NINGUNA`, `ORIGENES_CORTES`, `SECCIONES`, `TITULO` |

`src/index.js` reexporta `modos.js` en plano y los demás como espacios de nombres: `motor`, `salida` (= `escritura.js`), `tiempo`, `persistencia`, `bases`. Es decir: `import { motor, salida, tiempo, persistencia, lectura } from './src/index.js'`.

Dependencias: el motor lee el eje (`src/eje.js`), el encaje (`src/encaje.js`, `ocupantes`, `vector`, `signo`) y BQL (`src/bql.js`, `evaluar`), y escribe con `escribirDesde` y `eje.escribir`. `tiempo.js` usa `consolidaciones` del motor.

## 1. El ciclo

Cuatro pasos sobre un foco: **descubrir → consolidar → autorizar → ejecutar**, con un paso opcional entre los dos primeros: `proponer` construye las elecciones desde las fórmulas del foco (§2.1). Los tres últimos son eventos normales del eje (transiciones de tokens con payload BTML), anclados en la fábrica del foco (posición 4) y encadenados por `sobre`; por eso la evidencia es el propio hilo: ejecución → consolidación → foco → … → génesis. Nada se borra ni se modifica en sitio.

| Paso | Función | Quién | Escribe (`payload`) | `sobre` / `en` | `contexto` | Mueve |
|---|---|---|---|---|---|---|
| descubrir | `descubrir(eje, foco, { camino, posiciones, epoca, maximo })` | cualquiera | nada | — | — | nada |
| consolidar | `consolidar(eje, { autor, foco, elecciones, titulo, t, camino }, privada)` | cualquier identidad con T | `[titulo, elección 1, …, elección n]` | foco / `direccion([...camino, 4])` | `{ motor: 'fabrica', fase: 'consolidado', fuentes, encaje, modo: 'mapped' }` | T del autor: 1 minuto por posición |
| autorizar | `autorizar(eje, { autorizante, consolidacion, t, nota }, privada)` | identidad distinta del autor con P > 0 sobre un registro del hilo que el autor no escribió (§4.1, [X] confirmar VG) | `'==' + nota` | consolidación / `FABRICA` | `{ motor: 'fabrica', fase: 'autorizado', autoridad: { regla, poderes }, modo: 'pointed' }` | T del autorizante: 1 minuto |
| ejecutar | `ejecutar(eje, { autor, consolidacion, movimientos, t, titulo }, privada)` | el autor de la consolidación | `[titulo, { ref: consolidación }, { ref: autorización }]` | consolidación / `FABRICA` | `{ motor: 'fabrica', fase: 'ejecutado', evidencia: [consolidación, autorización] }` | T del autor: 1 minuto por posición (3 con un título terminal), más `movimientos` |

Constantes: `FABRICA = '4000000000'` (la posición 4 en la raíz del foco); `FASES = ['consolidado', 'autorizado', 'ejecutado']` (los valores de `contexto.fase`).

Estados de una consolidación (`estadoDe`): `PENDIENTE DE AUTORIZACIÓN` → `AUTORIZADO` → `EJECUTADO`. No se guardan: se calculan cada vez a partir de lo escrito sobre la consolidación en `FABRICA` por quien puede (§6). Solo las consolidaciones tienen estado: para cualquier otro registro (el génesis, una nota, una autorización) `estadoDe` devuelve `undefined`.

Reglas de fondo, tal como están en el código:

- **Consolidar no es ejecutar.** La consolidación solo mueve el T de escribir; E, P y R se mueven en `ejecutar`, y solo si el autor los pasa en `movimientos`.
- **La posición no da autoridad.** Cualquiera consolida; autoriza quien tiene poder (P) sobre el registro, sin contar el P sobre registros que escribió el propio autor; ejecuta el autor. Es la regla V0, un hueco provisional hasta que exista AARPIA (§4.1).
- **Elegir no publica.** `ELEGIR` de BQL devuelve una colección; la única fijación es `consolidar`, y no borra alternativas: las elecciones se guardan como referencias a sus fuentes, con el vector de encaje de cada una.
- **Cada cambio tiene clase.** La fábrica parte de la matriz de 100 del foco y emite solo lo modificado, en la matriz 10×10×10 (posición × subposición × clase de modificación). La matriz es **relativa al camino**: bajo un camino de profundidad n, la clase es el dígito n + 2 de la dirección (el tercero desde el camino; sin camino, el tercero), y se lee de la dirección con el camino, `claseDe(dir, camino)` (§7.2): ni la consolidación ni la ejecución guardan un campo de clase (§3.5, §5).
- **Todo cuesta tiempo.** Cada registro mueve T del autor: un minuto por posición del registro, heredadas incluidas (cartón piedra, §7.3). Es el token `T:minuto`: cada escala de T es un token distinto, sin conversión, así que escribir exige tener minutos. Y cada modo tiene dos límites que rechazan: la proporción de siempre, que se mira primero y con el mensaje de siempre, y además un tope duro de posiciones emitidas (§7.1).

Pendiente: las seis capacidades del motor que nombra el mapa (interpretar, resolver, posicionar, comparar, calcular, componer) no existen como funciones; son nombres descriptivos.

## 2. Descubrir

```js
descubrir(eje, foco, { camino = [], posiciones = [1, 2, 3, 4], epoca, maximo = Infinity } = {})  // → [{ posicion, dir, candidatos, total, limitada }]
caminoVisible(ocupante)                                                // → number[]  camino de la etiqueta: el del ocupante y, si su contenido es un array con posición 0, un 0 más (solo para mostrar)
```

`descubrir` no escribe. Para cada posición de interacción (por defecto 1–4: recursos, criterios, comunicación, fábrica) devuelve la dirección `direccion([...camino, i])` y sus **candidatos**: los ocupantes de esa dirección en el foco (`encaje.ocupantes`, orden por encaje bajo la `epoca` que se elija al leer; ver `docs/BTML.md` §6) más tres campos calculados con BQL: el estado y el texto de su camino exacto, y una etiqueta para mostrarlo. Con `maximo`, entrega como mucho esos candidatos por posición (los primeros por encaje) sin presentar el corte como completo: `total` dice cuántos hay y `limitada` si se cortó.

| Campo del candidato | Origen | Contenido |
|---|---|---|
| `origen`, `tipo` | encaje | `'propio'`, `'referencia'` o `'escrito'` |
| `evento`, `dir`, `camino`, `contenido`, `procedencia` | encaje | dónde vive el contenido (`docs/BTML.md` §6.2) |
| `autor`, `t` | encaje | solo en escritos |
| `origenDir`, `destino`, `vector`, `distancia`, `acuerdo`, `signo`, `faltas`, `excedentes` | encaje | el encaje del candidato en la posición |
| `empate`, `empatados`, `justificacion` | encaje | si el encaje no lo separa de otro (y con cuántos) y el motivo del encaje en texto |
| `estado`, `texto` | `bql.evaluar(eje, evento, candidato.camino)` | `RESUELTO` / `PENDIENTE` / `INCOMPATIBLE` / `ERROR` y el texto del valor del **camino exacto** del ocupante (`docs/BQL.md` §1; mapa §12 [D]: «todos son ocupantes con su camino exacto»). Una referencia a un evento ausente no se evalúa: es `PENDIENTE` (`PENDIENTE: evento ausente del eje: <id8>`), como dice el encaje. |
| `etiqueta` | `bql.evaluar(eje, evento, caminoVisible(candidato)).texto` | el texto que se muestra: de un array, el de su posición 0; si no, el mismo `texto`. No decide el estado: una fórmula pendiente en la posición 0 no vuelve pendiente al candidato, y `[1]` y `[1, 0]` se distinguen por su estado y su texto (auditoría de ajuste 2). |

`caminoVisible` añade un `0` al camino cuando el contenido es un array con posición 0: de un array, la etiqueta es su posición 0; el estado no. De un terminal o una referencia se muestra lo que hay. BQL no sigue la referencia en `evaluar` (texto `→ <id>`), sí la sigue el candidato de origen `referencia`, que ya es lo alcanzado.

Errores: `foco desconocido: <id>` si el foco no está en el eje.

```sh
node --input-type=module -e "
import { ejemploCompra, ejemploCuenta } from './ejemplos/ikisai/compra-food.mjs';
import { descubrir, caminoVisible } from './src/motor.js';
const { eje, compra } = await ejemploCompra();
await ejemploCuenta(eje, compra);
for (const p of descubrir(eje, compra.id)) {
  console.log(p.posicion, p.dir, p.candidatos.length + ' candidatos');
  for (const c of p.candidatos) console.log('  ' + c.origen.padEnd(11) + c.evento.slice(0, 8) + ' camino ' + JSON.stringify(c.camino) + ' visible ' + JSON.stringify(caminoVisible(c)) + ' · ' + c.estado + ' · ' + c.texto + ' · etiqueta ' + c.etiqueta + ' · ' + c.signo);
}
console.log(JSON.stringify(descubrir(eje, compra.id, { camino: [1], posiciones: [1, 2] }).map((p) => [p.dir, p.candidatos.map((c) => c.origen + ':' + c.texto)])));
console.log('registros antes y después:', eje.orden.length);
"
```

```text
1 1000000000 4 candidatos
  propio     dd4ab35f camino [1] visible [1,0] · RESUELTO · [3 posiciones] · etiqueta → d173ab58 · exacto
  propio     dd4ab35f camino [1,0] visible [1,0] · RESUELTO · → d173ab58 · etiqueta → d173ab58 · exacto
  referencia d173ab58 camino [1] visible [1,0] · RESUELTO · [3 posiciones] · etiqueta ensalada · exacto
  escrito    233c9da6 camino [] visible [0] · RESUELTO · [4 posiciones] · etiqueta Cuenta del menú · exacto
2 2000000000 3 candidatos
  propio     dd4ab35f camino [2] visible [2,0] · RESUELTO · [1 posiciones] · etiqueta → d173ab58 · exacto
  propio     dd4ab35f camino [2,0] visible [2,0] · RESUELTO · → d173ab58 · etiqueta → d173ab58 · exacto
  referencia d173ab58 camino [2] visible [2,0] · RESUELTO · [2 posiciones] · etiqueta sin gluten · exacto
3 3000000000 2 candidatos
  propio     dd4ab35f camino [3] visible [3,0] · RESUELTO · [2 posiciones] · etiqueta huesped · exacto
  propio     dd4ab35f camino [3,0] visible [3,0] · RESUELTO · huesped · etiqueta huesped · exacto
4 4000000000 2 candidatos
  propio     dd4ab35f camino [4] visible [4,0] · RESUELTO · [2 posiciones] · etiqueta pagar · exacto
  propio     dd4ab35f camino [4,0] visible [4,0] · RESUELTO · pagar · etiqueta pagar · exacto
[["1100000000",["propio:1"]],["1200000000",["propio:12 EUR"]]]
registros antes y después: 5
```

Lectura: en la posición 1 de la compra colisionan `[1]` y `[1, 0]` (cada uno con su estado y su texto; los dos llevan la misma etiqueta, la referencia al menú), lo que esa referencia alcanza (`ensalada`, representación del menú:1) y la cuenta que cocina escribió en `1000000000` (`exacto`: está anclada justo en la dirección buscada). Los cuatro son exactos y salen en orden de llegada; con la convención vigente (`docs/BTML.md` §6.5) solo una referencia que alcanza otra dirección tiene vector distinto de cero.

### 2.1 Proponer (operador B): elecciones desde las fórmulas del foco

`proponer` (PR #26, posterior a la primera versión de este documento) construye las `elecciones` de una consolidación leyendo las posiciones del foco. Los operadores del ciclo son `OPERADORES = { Q: 'descubrir', B: 'proponer', C: 'consolidar' }`: Q interroga, B construye la propuesta, C la fija; el orden importa. No escribe nada.

```js
proponer(eje, foco, { camino = [], posiciones = [1, 2, 3, 4] } = {})  // → { foco, elecciones, origenes, pendientes }
```

| Lo que hay en `[...camino, i]` del foco | Qué propone en `elecciones[i]` | `origenes[k].desde` |
|---|---|---|
| sin desarrollar | nada (la posición no entra) | — |
| fórmula que resuelve a una **colección** | `{ candidato }` con su primer ítem (el mejor encaje, salvo que la fórmula ORDENE otra cosa) | `'formula'` |
| fórmula que resuelve a un **número** | el número | `'formula'` |
| fórmula que resuelve a otro valor (magnitud, composición, texto…) | su **texto** formateado (`r.texto`), como terminal nuevo | `'formula'` |
| contenido literal (terminal, array o referencia) | `{ ref: foco, dir }`: lo literal se propone por referencia | `'foco'` |
| fórmula PENDIENTE, INCOMPATIBLE o ERROR, o colección vacía | nada; se informa en `pendientes` (`{ posicion, motivo }`) | — |

Ejemplo: el ciclo entero sobre la cuenta, con el pago tomado de la fórmula en vez de teclearlo.

```sh
node --input-type=module -e "
import { ejemploCompra, ejemploCuenta } from './ejemplos/ikisai/compra-food.mjs';
import { proponer, consolidar, autorizar, ejecutar, estadoDe, OPERADORES } from './src/motor.js';
import { evaluar } from './src/bql.js';
const corto = (x) => JSON.stringify(x).replace(/[0-9a-f]{64}/g, (m) => m.slice(0, 8));
const { eje, compra } = await ejemploCompra();
const cuenta = await ejemploCuenta(eje, compra);
console.log(JSON.stringify(OPERADORES));
const p = proponer(eje, cuenta.id);
console.log(corto(p.elecciones));
console.log(corto(p.origenes.map((o) => o.posicion + ':' + o.desde)), corto(p.pendientes));
const T = '2026-11-07T16:00:00Z';
const cons = await consolidar(eje, { autor: 'huesped', foco: cuenta.id, t: T, titulo: 'Pago de la cuenta', elecciones: p.elecciones });
console.log(corto(cons.payload), '·', evaluar(eje, cons.id, [1]).valor.tipo);
const importe = evaluar(eje, cuenta.id, [1]).valor;
await autorizar(eje, { autorizante: 'casa', consolidacion: cons.id, t: T });
await ejecutar(eje, { autor: 'huesped', consolidacion: cons.id, t: T, movimientos: [{ token: 'E', emisor: 'casa', denominacion: importe.unidad, cantidad: importe.cantidad, de: 'huesped', a: 'cocina' }] });
console.log(estadoDe(eje, cons.id), importe.cantidad, importe.unidad, '· EUR cocina', eje.saldo('cocina', 'E:casa/EUR'), 'huesped', eje.saldo('huesped', 'E:casa/EUR'));
"
```

```text
{"Q":"descubrir","B":"proponer","C":"consolidar"}
{"1":"14 EUR (12 EUR + 2 EUR)","2":"14 EUR (12 EUR + 2 EUR) + 15 min","3":{"ref":"233c9da6","dir":"3000000000"}}
["1:formula","2:formula","3:foco"] []
["Pago de la cuenta","14 EUR (12 EUR + 2 EUR)","14 EUR (12 EUR + 2 EUR) + 15 min",{"ref":"233c9da6","dir":"3000000000"}] · texto
EJECUTADO 14 EUR · EUR cocina 26 huesped 34
```

Lectura: la cuenta tiene fórmulas en 1 y 2 y un texto escapado en 3; la 4 no existe y no propone. La consolidación guarda el **texto** de la magnitud con su desglose (`"14 EUR (12 EUR + 2 EUR)"`), que BQL vuelve a leer como `texto`, no como magnitud (§13.16). El importe del pago no sale de la consolidación: se toma de la fórmula (`evaluar(...).valor`) y se pasa a mano a `ejecutar`, con `unidad` como denominación de E y el emisor de la serie escrito aparte (`emisor: 'casa'`: desde la PR #35 la serie es `E:casa/EUR`). Las unidades de BQL son etiquetas y no dicen de quién es la serie (`docs/BQL.md` §3). Nada comprueba que el texto consolidado y el movimiento ejecutado digan lo mismo.

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

| Valor en `elecciones[i]` | Qué se guarda en `payload[i]` | `fuentes` | `encaje[k]` | `nuevos[k]` |
|---|---|---|---|---|
| `{ candidato }` (un candidato de `descubrir`) | `{ ref: candidato.evento, dir: candidato.dir ?? '0000000000' }` | `candidato.evento` | `{ posicion, evento, tipo, origen, destino, vector, signo }` con el encaje del candidato (`origenDir`/`vector`/`signo` si los trae; si no, se calculan). `origen` es el `origenDir` del candidato, no el `dir` de la referencia guardada: para un escrito, la referencia apunta a su raíz (`dir: '0000000000'`, el payload entero) y `origen` es su anclaje, igual a `destino` (vector cero, `exacto`) | — |
| `{ ref, dir? }` (una referencia BTML) | tal cual | `ref` (debe existir en el eje) | `{ posicion, evento, origen: dir ?? '0000000000', destino, vector }` con `vector(origen, destino)` = candidato − buscado (sin `tipo` ni `signo`) | — |
| un array de elecciones (combinar) | el array, con cada elemento tratado como arriba: candidatos y referencias pasan a referencias; terminales y subarrays, tal cual | las de cada elemento | una entrada por cada fuente, todas con la misma `posicion` | `{ posicion, destino }`, una sola vez, si lleva algún terminal nuevo |
| cualquier otro valor BTML (terminal) | tal cual | — | — | `{ posicion, destino }` |
| ausente (hueco, `i` < última elegida) | `{ ref: foco, dir: direccion([...camino, i]) }` si `ocupantes(eje, foco, [...camino, i])` no está vacío; si no, error | — | — | — |

`destino` es siempre `direccion([...camino, i])`. `fuentes` se deduplica (`[...new Set]`). Los huecos se **heredan del foco por referencia** porque un array BTML no admite huecos y una referencia no copia. `encaje` dice de dónde vino cada elección: solo llevan entrada las fuentes (candidatos y referencias), con su `evento`, `origen` y `vector`. Los terminales nuevos no vienen de ninguna fuente: van **aparte**, en `nuevos`, con su `posicion` y su `destino` (sin evento, origen ni vector). Ninguna de las dos listas guarda clase: la de una elección es `claseDe(destino)` (§3.5).

### 3.3 El registro resultante

Se escribe con `escribirDesde` en modo `mapped` (§7): `sobre = foco`, `en = direccion([...camino, 4])`, `payload = [titulo, …]`, `contexto = { motor: 'fabrica', fase: 'consolidado', fuentes, encaje, nuevos, modo: 'mapped' }`, y un solo movimiento: T del autor, un minuto por posición (las referencias heredadas cuentan). Límites de Mapped (§7.1): como mucho 333 posiciones del registro (la proporción, que rechaza como antes y se mira primero: **[X] decidir VG**) y 1000 posiciones emitidas (el tope duro, que con la proporción rechazando no se llega a alcanzar). El estado inicial es `PENDIENTE DE AUTORIZACIÓN`.

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
["Pago del menú",{"ref":"233c9da6","dir":"0000000000"},"sin lactosa",{"ref":"dd4ab35f","dir":"3000000000"},"pagar 14 EUR"]
{"motor":"fabrica","fase":"consolidado","fuentes":["233c9da6"],"encaje":[{"posicion":1,"evento":"233c9da6","tipo":"escrito","origen":"1000000000","destino":"1000000000","vector":[0,0,0,0,0,0,0,0,0,0],"signo":"exacto"}],"nuevos":[{"posicion":2,"destino":"2000000000"},{"posicion":4,"destino":"4000000000"}],"modo":"mapped"}
[{"token":"T","escala":"minuto","cantidad":5,"de":"huesped","a":null}] minutos gastados 5 EUR movidos 0
PENDIENTE DE AUTORIZACIÓN
```

La posición 3 no se eligió y queda por debajo de la 4: se hereda de la compra (`{ ref: compra, dir: '3000000000' }`, que alcanza `['huesped', 'cocina']` sin copiarlo) y no lleva encaje porque no es una elección; los terminales nuevos (2 y 4) tampoco: van en `nuevos`, con su destino. Cinco posiciones, cinco minutos. Los 14 EUR no se mueven: consolidar no ejecuta.

### 3.4 Errores

| Mensaje | Causa |
|---|---|
| `nada que consolidar` | `elecciones` vacío o ausente |
| `las elecciones van en posiciones 1–9` | alguna clave no es un entero de 1 a 9 (`0`, `10`, `'a'`) |
| `hueco en <i>: elige algo o quita las posiciones siguientes` | la posición `i` no se eligió, está por debajo de la última y el foco no tiene ningún ocupante en `[...camino, i]` |
| `fuente desconocida en <i>` | una elección `{ ref }` cuyo `ref` no está en el eje |
| `mapped escribe como mucho 333 posiciones; este registro tiene <n>` | la proporción de Mapped (§7.1), que rechaza como antes y se mira primero (**[X] decidir VG**): también cuando el registro pasa del tope (1000) |
| `Mapped emite como mucho 1000 posiciones; este registro tiene <n>` | el tope duro de Mapped (§7.1); mientras la proporción rechace, no se llega a él |
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
await intenta({ elecciones: { 1: Array(10).fill(Array(10).fill(Array(4).fill('x'))) } });
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
mapped escribe como mucho 333 posiciones; este registro tiene 1001
mapped escribe como mucho 333 posiciones; este registro tiene 401
evento rechazado: foco desconocido: nadie
ok ["Consolidación",["dos","menús"],{"ref":"dd4ab35f","dir":"2000000000"},{"ref":"d173ab58","dir":"2000000000"}] en 4000000000
ok ["Consolidación","uno"] en 1400000000
```

En la penúltima, la posición 2 (hueco entre la 1 y la 3) se heredó de la compra. En la última, `camino: [1]` ancla la consolidación en `1400000000`: la fábrica de la posición 1 del foco.

### 3.5 La clase de una elección: se lee, no se guarda

`consolidar` no guarda clase. La clase de modificación se lee de una dirección **y del camino desde el que se lee**, porque la matriz es relativa al camino (§7.2): bajo un camino de profundidad n, la clase es el dígito n + 2. Para una elección (de `encaje` o de `nuevos`) es `claseDe(destino, camino)`, con el `camino` de la consolidación. La elección `i` va en `direccion([...camino, i])`: desde su camino es la celda `i.0.0`, así que su clase es 0 con cualquier camino. Bajo `camino = [1, 2]` el destino de la elección `n` es `1.2.n`; su tercer dígito absoluto (`n`) es su clase solo leída desde la raíz, donde es la celda `1.2.n`. La consolidación se ancla en `direccion([...camino, 4])` (la fábrica de ese camino), así que esa elección vive físicamente en `1.2.4.n`. El registro no guarda su camino: para leer la clase hay que saber desde dónde se escribió.

```sh
node --input-type=module -e "
import { ejemploCompra } from './ejemplos/ikisai/compra-food.mjs';
import { consolidar, autorizar, ejecutar } from './src/motor.js';
import { CLASES, claseDe } from './src/escritura.js';
const T = '2026-11-07T16:00:00Z';
const { eje, compra } = await ejemploCompra();
const elecciones = { 1: '12 EUR de huesped', 2: 'precio del menú', 3: 'aviso a cocina', 4: 'pagar 12 EUR' };
const camino = [1, 2];
const c = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: T, camino, titulo: 'Pago del precio', elecciones });
console.log('consolidación en', c.en, '· contexto', JSON.stringify(Object.keys(c.contexto)));
for (const { posicion, destino } of c.contexto.nuevos) console.log(' ', posicion, 'destino', destino, '· desde [1, 2]: clase', claseDe(destino, camino), CLASES[claseDe(destino, camino)], '· desde la raíz: clase', claseDe(destino), CLASES[claseDe(destino)]);
await consolidar(eje, { autor: 'huesped', foco: compra.id, t: T, camino, elecciones: { 4: 'pagar' } }).catch((e) => console.log(e.message));
await autorizar(eje, { autorizante: 'casa', consolidacion: c.id, t: T });
const e = await ejecutar(eje, { autor: 'huesped', consolidacion: c.id, t: T, movimientos: [{ token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 12, de: 'huesped', a: 'cocina' }] });
console.log('ejecutado en', e.en, '· clase sin camino', claseDe(e.en), '· contexto', JSON.stringify(Object.keys(e.contexto)));
"
```

```text
consolidación en 1240000000 · contexto ["motor","fase","fuentes","encaje","nuevos","modo"]
  1 destino 1210000000 · desde [1, 2]: clase 0 ver/sustituir · desde la raíz: clase 1 impulso de recursos
  2 destino 1220000000 · desde [1, 2]: clase 0 ver/sustituir · desde la raíz: clase 2 criterio
  3 destino 1230000000 · desde [1, 2]: clase 0 ver/sustituir · desde la raíz: clase 3 comunicación
  4 destino 1240000000 · desde [1, 2]: clase 0 ver/sustituir · desde la raíz: clase 4 acción
hueco en 1: elige algo o quita las posiciones siguientes
ejecutado en 4000000000 · clase sin camino 0 · contexto ["motor","fase","evidencia"]
```

Las cuatro elecciones son, desde su camino, las celdas `1.0.0` a `4.0.0`: clase 0. Leídas desde la raíz, las mismas direcciones son las celdas `1.2.1` a `1.2.4`, de clases 1 a 4. La segunda consolidación se rechaza: el precio (`'EUR 12'`) es un terminal y no tiene posiciones 1–3 que heredar, y `consolidar` rechaza el hueco (no ancla lo lejano como `desdeMapped`, §7.3). La ejecución es una acción, pero se escribe en `FABRICA`, sin camino: la celda `4.0.0`, de clase 0.

**[X] decidir VG**: qué clase tiene una elección de la consolidación (la de su destino leída desde el camino, hoy siempre 0, o la 4 de la fábrica `direccion([...camino, 4])` donde se ancla el registro); si el registro guarda el camino desde el que se escribió (hoy no, y sin él una dirección no dice su clase); si `consolidar` debe usar la matriz como `desdeMapped` (heredar lo que el foco tenga en el camino exacto y anclar lo lejano) en vez de rechazar el hueco; en qué dirección se escribe la ejecución para que su clase salga de ella (por ejemplo `4040000000` sobre la consolidación, en vez de `FABRICA`), o si la ejecución no lleva clase.

## 4. Autorizar

### 4.1 Quién puede: la regla V0

```js
puedeAutorizar(eje, identidad, consolidacion)  // → boolean
```

```js
poderParaAutorizar(eje, identidad, foco, autorPropuesta)  // → [{ ambito, cantidad }]  el P de identidad que cuenta para autorizar lo que autorPropuesta propone sobre foco
```

`true` cuando la consolidación existe, `identidad` **no es su autor** y tiene P > 0 que **cuente** (`poderParaAutorizar`). Cuenta el P cuyo ámbito es un registro del **hilo** de la consolidación (consolidación → foco → … → génesis; `'genesis'` es el registro del génesis) **que no escribió el autor de la consolidación**. Es decir: quien tiene poder sobre un registro lo tiene sobre todo lo que cuelga de él, salvo para autorizar a quien escribió ese registro. P exige ámbito y delegarlo lo estrecha (`src/eje.js`, `test/eprt.test.js`).

La condición «que no escribió el autor» es regla de Core tras la revisión adversarial del 7-11 noche (**[X] confirmar VG**). Sin ella, el autor acuñaba P sobre su propio registro, se lo delegaba a una identidad suya (un títere) y esa le autorizaba: la ejecución salía `EJECUTADO`. Ahora autoriza el **dominio ajeno** (la casa, con P sobre el génesis, autoriza la compra del huésped), nunca el P acuñado por quien propone sobre lo suyo; ese P sirve para delegar criterio sobre lo suyo (que otros propongan ahí). Como el saldo de P no guarda de dónde viene, tampoco cuenta el P sobre ese registro que otro haya delegado estrechando el suyo. Queda abierto (**[X]**): un títere que escribe su propio registro en el hilo y acuña P sobre él autoriza lo que el autor consolide debajo (`test/ciclo-eprt.test.js`, NEU-03). En Booking, la persona huésped delega a recepción P sobre su reserva para que recepción pueda autorizar la entrega de la casa (`ejemplos/ikisai/reserva-booking.mjs`, `reservar`).

Esta regla es un **hueco provisional**: la autorización y la ejecución reales son de AARPIA, que no existe (pendiente). Lo que hoy hay es «no ser el autor y tener P > 0 sobre un registro del hilo que el autor no escribió».

```sh
node --input-type=module -e "
import { ejemploCompra } from './ejemplos/ikisai/compra-food.mjs';
import { consolidar, puedeAutorizar, poderParaAutorizar } from './src/motor.js';
const T = '2026-11-07T16:00:00Z';
const { eje, alta, menu, compra } = await ejemploCompra();
const gastaT = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });
const corto = (x) => JSON.stringify(x).replace(/[0-9a-f]{64}/g, (m) => m.slice(0, 8));
console.log(JSON.stringify(eje.poderes('casa')), JSON.stringify(eje.poderes('cocina')));
// La casa delega a cocina 2 P con ámbito el menú: cubre el menú y lo que cuelga de él.
await eje.escribir({ autor: 'casa', sobre: menu.id, t: T, movimientos: [gastaT('casa'), { token: 'P', cantidad: 2, ambito: menu.id, de: 'casa', a: 'cocina' }], payload: 'cocina decide sobre su menú' });
console.log(corto(eje.poderes('cocina')), 'casa P:genesis', eje.saldo('casa', 'P:genesis'));
const sobreCompra = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: T, elecciones: { 1: 'dos menús' } });
const sobreAlta = await consolidar(eje, { autor: 'huesped', foco: alta.id, t: T, elecciones: { 1: 'otra alta' } });
console.log('sobre la compra (cuelga del menú): cocina', puedeAutorizar(eje, 'cocina', sobreCompra.id), corto(poderParaAutorizar(eje, 'cocina', sobreCompra.id, 'huesped')), '· casa', puedeAutorizar(eje, 'casa', sobreCompra.id), '· huesped (autor)', puedeAutorizar(eje, 'huesped', sobreCompra.id));
console.log('sobre el alta (por encima del menú): cocina', puedeAutorizar(eje, 'cocina', sobreAlta.id), eje.poderSobre('cocina', sobreAlta.id), '· casa', puedeAutorizar(eje, 'casa', sobreAlta.id));
// Cocina pasa 1 P sobre su menú al huésped y consolida sobre el menú: el huésped no la autoriza con ese P (el menú lo escribió cocina).
await eje.escribir({ autor: 'cocina', sobre: menu.id, t: T, movimientos: [gastaT('cocina'), { token: 'P', cantidad: 1, ambito: menu.id, de: 'cocina', a: 'huesped' }], payload: 'el huésped opina del menú' });
const deCocina = await consolidar(eje, { autor: 'cocina', foco: menu.id, t: T, elecciones: { 1: 'menú de mañana' } });
console.log('sobre el menú, de cocina: huesped', puedeAutorizar(eje, 'huesped', deCocina.id), eje.poderSobre('huesped', deCocina.id), corto(poderParaAutorizar(eje, 'huesped', deCocina.id, 'cocina')), '· casa', puedeAutorizar(eje, 'casa', deCocina.id));
console.log('sobre algo que no existe:', puedeAutorizar(eje, 'casa', 'nadie'));
"
```

```text
[{"ambito":"genesis","cantidad":10}] []
[{"ambito":"d173ab58","cantidad":2}] casa P:genesis 8
sobre la compra (cuelga del menú): cocina true [{"ambito":"d173ab58","cantidad":2}] · casa true · huesped (autor) false
sobre el alta (por encima del menú): cocina false 0 · casa true
sobre el menú, de cocina: huesped false 1 [] · casa true
sobre algo que no existe: false
```

### 4.2 Firma y registro

```js
autorizar(eje, { autorizante, consolidacion, t, nota = 'autorizo' }, privada)  // → Promise<evento>
autorizacionesValidas(eje, consolidacion)                                     // → evento[]  escritos en FABRICA sobre la consolidación con fase 'autorizado' cuyo autor puede autorizar
```

`autorizar` escribe con `escribirDesde` en modo `pointed`: `sobre = consolidación`, `en = FABRICA`, `payload = '==' + nota` (texto escapado para BQL), `contexto = { motor: 'fabrica', fase: 'autorizado', autoridad: { regla: REGLA_AUTORIZAR, poderes }, modo: 'pointed' }`, un minuto de T del autorizante. Solo escribe si la consolidación está `PENDIENTE DE AUTORIZACIÓN` y el autorizante puede.

`contexto.autoridad` es el metadato de autoridad del evento (corpus: «firmante, contexto, autoridad cuando aplique»): la regla aplicada y los poderes del autorizante que cuentan (`[{ ambito, cantidad }]`, los de `poderParaAutorizar`) en el momento de autorizar. Es una declaración: el estado se vuelve a calcular con el eje y no se fía de ella. Los demás registros no lo llevan.

Lo que no cumple la regla **no cuenta**: un registro con `fase: 'autorizado'` escrito a mano por quien no puede autorizar queda en el eje (es un evento válido) pero `autorizacionesValidas` no lo devuelve y el estado no cambia.

| Mensaje | Causa |
|---|---|
| `no es una consolidación: <id8>` | `consolidacion` no existe o su `contexto.fase` no es `'consolidado'` |
| `el autor no se autoriza a sí mismo` | `autorizante === consolidación.autor` |
| `<autorizante> no tiene poder (P) sobre este registro que cuente para autorizar a <autor>: solo cuenta el P sobre un registro del hilo que <autor> no escribió` | `poderParaAutorizar` no suma nada |
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
cocina no tiene poder (P) sobre este registro que cuente para autorizar a huesped: solo cuenta el P sobre un registro del hilo que huesped no escribió
escritos en la fábrica 1 · válidos 0 · PENDIENTE DE AUTORIZACIÓN
true 4000000000 "==vale" BQL lo lee como "=vale" {"motor":"fabrica","fase":"autorizado","autoridad":{"regla":"V0 provisional hasta AARPIA: autoriza quien no es el autor y tiene P > 0 sobre un registro del hilo que el autor no escribió ([X] confirmar VG); ejecuta el autor","poderes":[{"ambito":"genesis","cantidad":10}]},"modo":"pointed"} 1 casa
escritos en la fábrica 2 · válidos 1 · AUTORIZADO
ya está autorizado
no es una consolidación: dd4ab35f
```

## 5. Ejecutar

```js
ejecutar(eje, { autor, consolidacion, movimientos = [], t, titulo = 'Ejecutado' }, privada)  // → Promise<evento>
```

Condiciones, en este orden: la consolidación existe y tiene `fase: 'consolidado'`; `autor` es el autor de la consolidación; el estado es `AUTORIZADO` (ni pendiente ni ejecutado). La capacidad de una posición no se cuenta aquí: la limita una serie de tokens que la ejecución mueve, y sin saldo el eje rechaza (§5.1). Entonces escribe **directamente con `eje.escribir`** (no pasa por `escribirDesde`: sin `contexto.modo`, sin comprobar proporción ni tope):

- `sobre = consolidación`, `en = FABRICA`, `t` (si falta, el reloj);
- `payload = [titulo, { ref: consolidación }, { ref: autorización }]`, donde la autorización es la **primera** de `autorizacionesValidas`;
- `movimientos = [{ token: 'T', escala: 'minuto', cantidad: contarPosiciones(payload), de: autor, a: null }, ...movimientos]` (un minuto por posición escrita, como todo registro de salida: 3 con un título terminal): aquí se mueven los tokens reales (E, P, R, más T). Como en todo evento, cada movimiento debe salir del autor (`de === autor`) y su saldo debe cubrirlo; si no, el eje rechaza el evento entero y nada cambia;
- `contexto = { motor: 'fabrica', fase: 'ejecutado', evidencia: [consolidación, autorización] }`. Sin clase: la de un registro se lee de su dirección con el camino desde el que se escribe (`claseDe(en, camino)`, §7.2), y `FABRICA`, sin camino, es la celda `4.0.0`, de clase 0, aunque ejecutar sea una acción (**[X] decidir VG**, §3.5).

| Mensaje | Causa |
|---|---|
| `no es una consolidación: <id8>` | no existe o no tiene fase `'consolidado'` |
| `ejecuta el autor de la consolidación: <autor>` | otro autor |
| `PENDIENTE DE AUTORIZACIÓN` | sin autorización válida |
| `ya ejecutado` | ya hay ejecución válida |
| `evento rechazado: …` | lo que rechace el eje (`nadie mueve tokens ajenos`, `saldo insuficiente…`; también una plaza sin token esa noche, §5.1) |

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
true 4000000000 ["Pagado",{"ref":"05aa2b96"},{"ref":"9e602de2"}]
{"motor":"fabrica","fase":"ejecutado","evidencia":["05aa2b96","9e602de2"]} [{"token":"T","escala":"minuto","cantidad":3,"de":"huesped","a":null},{"token":"E","emisor":"casa","denominacion":"EUR","cantidad":14,"de":"huesped","a":"cocina"}]
cocina EUR 12 → 26 · huesped EUR 48 → 34 · huesped minutos 475 → 472
EJECUTADO · hilo: 8df7f157 → 05aa2b96 → dd4ab35f → d173ab58 → 06b890b5 → 49ee3fca
evidencia: true true
ya ejecutado
[{"id":"05aa2b96","autor":"huesped","t":"2026-11-07T16:00:00Z","titulo":"Pago del menú","estado":"EJECUTADO","fuentes":[]}]
```

El hilo de la ejecución es la evidencia: ejecución → consolidación → compra → menú → alta → génesis.

Dos consecuencias de «ejecuta el autor» y «nadie mueve tokens ajenos»:

- **Un intercambio no cabe en una ejecución.** En una reserva, las plazas (serie limitada de E, `docs/BTML.md` §2.4) las tiene quien las respalda o la habitación a quien se las dio, y el pago lo tiene la persona huésped: cada parte consolida y ejecuta lo suyo (la habitación o la casa entrega la plaza de cada noche; la persona huésped paga), sin atomicidad. Meter el pago en la ejecución de la otra parte se rechaza (`nadie mueve tokens ajenos: <huésped> no es el autor`). Si quien entrega no tiene ya el token de alguna noche (otra reserva solapada se lo llevó), el eje rechaza la ejecución entera: `evento rechazado: saldo insuficiente de E:<emisor>/<plaza>@<noche> en <autor>`. [X] decidir VG: la ejecución de dos partes mientras AARPIA no exista (mapa §12).
- **Una ejecución rechazada no deja rastro.** El eje no guarda el evento rechazado, así que la consolidación sigue `AUTORIZADO` aunque ya no pueda ejecutarse: el estado no distingue «a la espera» de «imposible» (no hay rechazar ni caducar, §12).

### 5.1 Capacidad: cuántos ocupantes de una posición pueden ser válidos

Decisión de VG (7-11, «las dos cosas a la vez»): una posición admite muchos ocupantes (colisiones: se escriben y se ven todos), y puede declarar una **capacidad**: cuántos de ellos pueden ser **válidos** a la vez. Quien la hace cumplir es una **serie limitada de tokens E** que emite quien respalda la posición: en Booking, la casa emite `E:casa/<plaza>@<noche>`, un token por plaza y noche, tantos como capacidad, y ejecutar la reserva los mueve de la casa a la persona huésped. Una segunda reserva solapada se escribe y colisiona, pero su ejecución no pasa: la casa ya no tiene el token de esa noche (`evento rechazado: saldo insuficiente de E:casa/…@<noche> en casa`). La fábrica no cuenta nada: el contador de este apartado es **informativo** (para la interfaz y para saber cuántos tokens emitir).

**[X] decidir VG** (auditoría de ajuste 2, A2-07): la corrección de VG sobre titulares (mapa §12 [D], 7-11 tarde) dice que «una persona emite los tokens de plaza de una habitación y se los da a la habitación; la habitación los conserva y los maneja». El ejemplo sigue la decisión de mediodía (mapa §12 [D] «Capacidad y tokens casan»: «mover esos tokens de la casa al huésped»): la serie se queda en la cartera de la casa, `libres` lee el saldo de la casa y la entrega la consolida y ejecuta la casa. Para pasar a la habitación hace falta decidir cómo se liga el registro de la habitación con la identidad (una cosa) que es titular de sus plazas, y quién consolida y ejecuta la entrega en su nombre; con eso, la casa emitiría y movería la serie a la habitación en el mismo evento (docs/FUNDAMENTOS.md: «para darla se mueve después, en el mismo evento si quiere»).

```js
CRITERIO_CAPACIDAD = 2                 // dónde declara la décupla de una posición su capacidad
capacidadDe(nodo)                       // → entero positivo en nodo[2], o undefined
tramoDe(eje, id)                        // → { inicio, fin, extremos, texto, desde }: el 7 del registro como [inicio, fin); sin 7 o ilegible, error
registrosEn(eje, sobre, dir)            // → eventos anclados en la posición o que la referencian desde donde estén, por llegada
ocupacion(eje, id)                      // → [{ sobre, dir, camino, capacidad, tramo, validos, aLaVez, cabe }]: solo informa
```

- **Declaración** (`[X] decidir VG`): la décupla de la posición lleva un entero positivo en su criterio (subposición 2: «cuántos caben»), como una plaza `[nombre, precio, capacidad]` bajo la época 0. Sin ese entero la posición no declara nada.
- **Qué posición ocupa un registro**: la de su anclaje (`sobre` + `en`). La dirección nombra la colisión entera (§12 del mapa: `1000000000` es a la vez `[1]`, `[1.0]`, `[1.0.0]`), así que se mira cada camino que nombra y cuenta el que declare capacidad. Al contar a los demás, entran también los que **referencian** la posición desde otro anclaje (`registrosEn`): ninguno escapa al contador por elegir otro `en`.
- **Tramo** (`[X] decidir VG`): `[inicio, fin]` en ISO, con el fin excluido (la noche de la salida no se ocupa), en el 7 del registro. El 7 es una colisión: vale lo propio (`payload[7]`) o lo que el **autor** del registro ancle en su 7 («lo lejano = anclaje»: se llega al 7 sin rellenar 5 y 6); manda el primero por encaje y llegada. Un tramo es acotado: con capacidad, sin 7 o ilegible es error. Un ocupante ya válido sin tramo legible cuenta como todo el tiempo.
- **Cuántos a la vez**: los otros registros de la posición con consolidación ejecutada que se solapan con el tramo, y el máximo que coincide en un mismo instante (barrido por los inicios). Con capacidad 2, dos estancias encadenadas y una tercera que las cruza caben; una cuarta que coincide con dos, no.
- `ejecutar` **no** consulta `ocupacion`.

Lo que no hace el motor: mover tokens de dos partes en un solo acto. El motor V0 ejecuta solo el autor de la consolidación y nadie mueve tokens ajenos, así que Booking confirma con **dos consolidaciones** sobre la reserva, autorizadas por recepción: la casa entrega los tokens de plaza y después la persona huésped paga (`ejemplos/ikisai/reserva-booking.mjs`, `[X] decidir VG`; la atomicidad es de AARPIA).

## 6. Estado y lista de consolidaciones

```js
estadoDe(eje, consolidacion)            // → 'PENDIENTE DE AUTORIZACIÓN' | 'AUTORIZADO' | 'EJECUTADO' | undefined (si no existe o no es una consolidación)
consolidaciones(eje, foco, camino = []) // → [{ id, autor, t, titulo, estado, fuentes }]  las consolidaciones ancladas en direccion([...camino, 4]) del foco
esConsolidacion(evento)                 // → boolean: el único criterio de qué es una consolidación
```

Qué es una consolidación lo dice `esConsolidacion`, el mismo criterio para `estadoDe`, `autorizar`, `ejecutar`, `consolidaciones` y las capas de validez y de efectos: `contexto.fase === 'consolidado'`, `contexto.motor === 'fabrica'` y anclada (`en`) en la fábrica de un camino de su foco, es decir, una dirección cuyo último índice real es el 4, como la escribe `consolidar` (`direccion([...camino, 4])`). La fase es un metadato que cualquiera puede declarar; el anclaje es lo que la separa de un registro escrito a mano fuera de la fábrica, que no tiene estado (auditoría de ajuste 2, mapa §11: «consolidar (fábrica, anclado en 4 …)»).

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

La unidad de cuenta es la **posición** (cada terminal, referencias incluidas, cuenta una; un array cuenta la suma de las suyas). Cada modo tiene estas cifras:

- el **máximo** o **tope duro** (VG, 7-11-2026; confirmado VG, 7-11 noche): cuántas posiciones puede **emitir** de una vez, y es el mismo máximo que el de **representar**: «todo lo que no se pueda representar realmente no se puede alterar y por lo tanto no tiene sentido emitirlo». `maximo(modo)`; `lectura` y `tope` son alias. Lo comprueban `escribirDesde` y `escribirSalida` (y por tanto `consolidar` y `autorizar`) sobre lo emitido: las referencias de relleno heredadas del foco no se emiten («se emiten solo las décuplas modificadas», mapa §12) y no cuentan cuando la escritura sabe cuáles son (§7.3);
- el **mínimo** (VG, 7-11 noche): lo que el modo intenta representar y emitir (Pointed 1, Sequenced 10, Mapped 100, Scened 1000; Be sin fijar, **[X] decidir VG**). No rechaza: lo emitido por debajo se escribe y se informa con `alcanceDe` (`{ conseguido, minimo, maximo, alMinimo }`): `escribirSalida` lo devuelve en `alcance` y, para el evento de `escribirDesde`, `alcanceDeRegistro(evento)` (§7.3). Detalle y cita en `docs/MODOS.md` §0;
- la **proporción** de escritura sobre lectura (VG, 6-11-2026): el estándar. Se exige su máximo (1, 20, 333) sobre **todas las posiciones del registro**, lo heredado incluido, como antes del 7-11 (`<modo> escribe como mucho <máx> posiciones; este registro tiene <n>`); el mínimo no se exige. `proporcion` y `proporcionDe` dicen dónde queda un registro y `escribirSalida` lo devuelve.

Se mira **primero la proporción** y después el tope: así, todo lo que antes del 7-11 se rechazaba se sigue rechazando con el mismo mensaje, también cuando además pasa del tope (treinta posiciones en Pointed dan `pointed escribe como mucho 1 posiciones; este registro tiene 30`, como en `main`). Mientras la proporción rechace, en Pointed, Sequenced y Mapped se llega antes a ella que al tope (las posiciones del registro nunca son menos que las emitidas, y 1 < 10, 20 < 100, 333 < 1000): el mensaje del tope (`<Modo> emite como mucho <tope> posiciones; …`) solo sale en Scened, que no tiene proporción.

Quién tiene en cuenta los límites al ubicar: `ubicar` con modo, y por tanto `escribirDesde` con una celda, ubica **una celda**: si tiene base pero dentro del registro, con su relleno, no cabe, la ancla sola (§7.3). `desdeMapped` conforma **varias celdas** y las ubica solo por la base, sin modo; `escribirSalida` mide después la salida entera y, si no cabe, la **rechaza** sin anclar nada. Con la misma celda y el mismo modo, pues, `escribirDesde` con celda puede anclarla y escribir donde `desdeMapped` + `escribirSalida` rechaza (**[X] decidir VG** si `desdeMapped` también ancla por límites, y qué celdas).

**[X] decidir VG**: el mapa dice «topes duros por modo … (además de la proporción)», pero no dice si la proporción rechaza o solo informa. Hasta que VG lo decida se conserva lo que había: rechaza. Con las dos rechazando, el tope solo decide en Scened, y la matriz de 1000 no cabe en Mapped. Si la proporción solo informara, bastaría con quitar su comprobación de `fueraDeLimite` (`src/escritura.js`).

```js
MODOS                         // { pointed, sequenced, mapped, scened, be } → { nombre, decuplas, proporcion: [mín, máx] | null, minimo, maximo }
nombreModo(modo)              // → 'Pointed' | 'Sequenced' | 'Mapped' | 'Scened' | 'Be'
maximo(modo)                  // → máximo duro: posiciones que el modo representa y emite como mucho de una vez (Be: Infinity)
minimo(modo)                  // → mínimo que el modo intenta representar y emitir; solo se informa (Be: null, sin fijar)
alcanceDe(conseguido, modo)   // → { conseguido, minimo, maximo, alMinimo }: los tres números de una lectura o una emisión
lectura(modo)                 // → alias de maximo: posiciones que el modo lee de una vez
tope(modo)                    // → alias de maximo: posiciones que el modo emite como mucho de una vez
escritura(modo)               // → [mínimo, máximo] según la proporción (floor de lectura × proporción), o null si no está fijada
contarPosiciones(payload)     // → número de terminales del payload (anidado incluido); 0 si no es BTML
cabeTope(payload, modo, heredadas = [])  // → contarPosiciones(payload) − heredadas.length <= tope(modo): el tope cuenta lo emitido; cada heredada es una posición de relleno
cabeEscritura(payload, modo)  // → contarPosiciones(payload) <= máximo de la proporción, lo heredado incluido; true si no está fijada (la escritura rechaza con este criterio)
proporcionDe(posiciones, modo)  // → { posiciones, rango: [mín, máx] | null, estado: 'por debajo' | 'dentro' | 'por encima' | 'sin fijar' }; posiciones = las del registro, lo heredado incluido
proporcion(payload, modo)     // → proporcionDe(contarPosiciones(payload), modo): cuenta todo el payload, también lo heredado, como la proporción
```

| Modo | Décuplas | Mínimo (informa) | Máximo: lee y emite (rechaza; cuenta lo emitido) | Proporción (rechaza su máximo, como antes; [X]) | Según la proporción `[mín, máx]` |
|---|---|---|---|---|---|
| `pointed` | 1 | 1 | 10 | 1/10 | `[1, 1]` |
| `sequenced` | 10 | 10 | 100 | 1/10 – 1/5 | `[10, 20]` |
| `mapped` | 100 | 100 | 1000 (la matriz 10×10×10) | 1/4 – 1/3 | `[250, 333]` |
| `scened` | 1000 | 1000 | 10000 | sin fijar (`null`) | `null` |
| `be` | — | sin fijar (`null`, [X]) | todos (`Infinity`) | sin fijar (`null`, [X]) | `null` |

Scened tiene máximo duro de emisión y de lectura (su escena corta en 10000 posiciones, `docs/MODOS.md` §6) y render sobrio (`src/scened.js`), pero no formulario de escritura. Be no tiene interfaz gráfica. Un modo que no está en `MODOS` da `Error('modo desconocido: <modo>')` en `lectura`, `tope`, `escritura`, `escribirDesde`…

```sh
node --input-type=module -e "
import { MODOS, lectura, tope, minimo, escritura, contarPosiciones, cabeTope, proporcion, nombreModo } from './src/modos.js';
for (const m of Object.keys(MODOS)) console.log(nombreModo(m).padEnd(10), 'décuplas', String(MODOS[m].decuplas).padStart(4), '· mín', String(minimo(m)).padStart(4), '· lee', String(lectura(m)).padStart(8), '· tope', String(tope(m)).padStart(8), '· proporción', JSON.stringify(escritura(m)));
console.log(contarPosiciones('x'), contarPosiciones(['a', ['b', 'c'], { ref: 'r' }]), contarPosiciones([{ ref: 'a' }, { ref: 'b', dir: '1000000000' }]), contarPosiciones(undefined), contarPosiciones(null));
const mil = Array(10).fill(Array(10).fill(Array(10).fill('x')));
console.log(cabeTope(Array(10).fill('x'), 'pointed'), cabeTope(Array(11).fill('x'), 'pointed'), cabeTope(mil, 'mapped'), cabeTope(mil, 'sequenced'), cabeTope([mil, 'y'], 'mapped'), cabeTope([mil, 'y'], 'scened'));
const conRelleno = [{ ref: 'foco', dir: '0000000000' }, Array(10).fill('x')];
console.log(contarPosiciones(conRelleno), cabeTope(conRelleno, 'pointed'), cabeTope(conRelleno, 'pointed', [0]), JSON.stringify(proporcion(conRelleno, 'sequenced')));
for (const [p, m] of [['x', 'pointed'], [Array(5).fill('x'), 'sequenced'], [Array(10).fill(['a', 'b', 'c']), 'sequenced'], [mil, 'mapped'], [mil, 'scened']]) console.log(m.padEnd(9), JSON.stringify(proporcion(p, m)));
try { tope('otro'); } catch (e) { console.log(e.message); }
"
```

```text
Pointed    décuplas    1 · mín    1 · lee       10 · tope       10 · proporción [1,1]
Sequenced  décuplas   10 · mín   10 · lee      100 · tope      100 · proporción [10,20]
Mapped     décuplas  100 · mín  100 · lee     1000 · tope     1000 · proporción [250,333]
Scened     décuplas 1000 · mín 1000 · lee    10000 · tope    10000 · proporción null
Be         décuplas null · mín null · lee Infinity · tope Infinity · proporción null
1 4 2 0 0
true false true false false true
11 false true {"posiciones":11,"rango":[10,20],"estado":"dentro"}
pointed   {"posiciones":1,"rango":[1,1],"estado":"dentro"}
sequenced {"posiciones":5,"rango":[10,20],"estado":"por debajo"}
sequenced {"posiciones":30,"rango":[10,20],"estado":"por encima"}
mapped    {"posiciones":1000,"rango":[250,333],"estado":"por encima"}
scened    {"posiciones":1000,"rango":null,"estado":"sin fijar"}
modo desconocido: otro
```

Un registro con una referencia de relleno y diez posiciones escritas tiene 11 posiciones: sin decirle cuál es heredada, `cabeTope` las cuenta todas como emitidas y no caben en Pointed (10); con `[0]`, lo emitido son 10 y caben. La proporción cuenta las 11.

### 7.2 La matriz 10×10×10 de la fábrica

Decisión de VG (7-11-2026, tarde): «siempre estamos aplicando los puntos de vista».

- La fábrica (PV4) parte de la **matriz de 100 del foco**: 10 posiciones × 10 subposiciones. Ya está y **no se emite**.
- El registro de salida emite **solo las celdas modificadas**. La tercera dimensión es la **clase de modificación**: los diez PV bajo la época 0. Una modificación de clase `k` sobre la celda `[i][j]` se escribe en `payload[i][j][k]`. Matriz completa: 10 × 10 × 10 = 1000 posiciones, el tope de Mapped; la proporción de Mapped (333) hoy no la deja pasar (§7.1, **[X] decidir VG**).
- La matriz es **relativa al camino** (VG, 7-11 tarde): desde donde esté el foco (un `camino` de profundidad n), los tres dígitos siguientes son posición, subposición y clase. El registro va en `direccion(camino)`, así que la celda `i.j.k` cae en `direccion([...camino, i, j, k])`, y su clase es el dígito en la profundidad n + 2: el tercero desde el camino (sin camino, el tercero de la dirección: `i j k 0000000`). Bajo un camino de más de 7 profundidades no cabe la clase (la dirección tiene diez dígitos): `claseDe` da error, y `comprobarCelda` solo admite celdas que quepan (pendiente con el cambio de foco al agotar diez niveles, `docs/BTML.md` §3.2).
- **Ver ya es una modificación** (clase 0): siempre se emite algo. Sin nada visto ni escrito, `desdeMapped` rechaza (`la décupla está vacía…`). Solo se ve lo que existe: la dirección de la celda vista ha de alcanzar algo en el foco (§7.3).
- Lo no modificado **anterior** a lo modificado (posiciones antes de `i`, subposiciones antes de `j`, clases antes de `k`) se **hereda del foco por referencia** `{ ref: foco, dir }`: un array BTML no admite huecos y una referencia no copia.
- Lo **lejano sin base** en el foco no se rechaza: se **ancla** en su posición, en un registro aparte con `en` = la dirección de la celda (`ubicar`, §7.3).

| `k` | Clase (`CLASES[k]`) | PV del dígito |
|---|---|---|
| 0 | ver/sustituir | representación |
| 1 | impulso de recursos | recursos |
| 2 | criterio | criterios |
| 3 | comunicación | comunicación |
| 4 | acción | fábrica |
| 5–9 | `null`: **[X] decidir VG** (VG nombró 0–4 y «…») | estructura, pasado, futuro, comparabilidad, camino |

`claseDe(dir, camino = [])` devuelve el dígito de clase de una dirección leída desde `camino`: el de la profundidad `camino.length + 2`. Sin camino, el tercero: `claseDe('1240000000') === 4`. La misma dirección es otra celda desde otro camino: `1734000000` es la celda `1.7.3` desde la raíz (`claseDe('1734000000') === 3`) y la `7.3.4` bajo `[1]` (`claseDe('1734000000', [1]) === 4`); `1010000000` es `1.0.1` desde la raíz (clase 1) y `0.1.0` bajo `[1]` (clase 0). Errores: `dirección no válida: <dir>`; `la dirección <dir> no está bajo el camino <c>`; `bajo un camino de <n> profundidades no cabe la clase…` (n ≥ 8). La clase se lee de la dirección con su camino; ningún registro guarda un campo de clase aparte (ni la consolidación ni la ejecución, §3.5). Tampoco guarda el camino desde el que se escribió: un registro anclado va en la dirección de su celda, y sin el camino esa dirección no dice su clase (**[X] decidir VG** si el registro guarda su camino; quien escribe lo sabe: `salida.camino`, el `camino` de `escribirDesde` o de `consolidar`).

**Base en el foco.** Un hueco (de posición, de subposición o de clase) tiene base si el foco tiene contenido **en ese camino exacto**, sin seguir referencias. Lo que cuelga de un terminal no tiene base (igual que en el encaje, `docs/BTML.md` §4.2), **salvo la posición 0 de la raíz de un foco terminal**, que se hereda como antes de la matriz: si el foco (o su nodo bajo `camino`) es un terminal, escribir en su posición 1 hereda la 0 con `{ ref: foco, dir: direccion([...camino, 0]) }`, y esa dirección alcanza el terminal por la colisión de ceros finales (`resolver(terminal, '0000000000')` da el terminal). Así lo hacía `main`, y así `app.js` sigue pudiendo escribir sobre el génesis. **[X] decidir VG**: el mapa §12 dice «un terminal no tiene posición 0 (PENDIENTE)»; hasta que lo decida se conserva lo que había, y solo para la raíz (lo demás que cuelga de un terminal, como `0.0` o `1`, no tiene base y se ancla). Así, toda referencia heredada alcanza algo en el foco (lo comprueba `test/fabrica-1000.test.js` celda a celda, con caminos `[]`, `[1]` y `[1, 2]`, sobre la compra y sobre el génesis). Para pagar el precio de la compra (`[1][2][4]`), el precio es un terminal (`'EUR 12'`) y no tiene clases 0–3 que heredar: la celda se **ancla** en `1240000000`. Si el foco desarrolla las clases de la celda (`[1][2]` es un array), se heredan por referencia a `1200000000`…`1230000000` y el pago va dentro. **[X] decidir VG**: si, mientras el foco no desarrolla las clases de una celda, lo no modificado se hereda por referencia a la celda `i.j` (dentro del registro) en vez de anclarse (hoy).

**Ceros finales.** Una dirección con ceros finales nombra la colisión (mapa §12): la heredada o la vista de una subposición 0 (`4.0`, `1.2.0`) se escribe con la dirección de la posición (`4000000000`, `1200000000`), y `resolver` da la posición entera (`['pagar', 'servir']`, no `'pagar'`); ver `0.0` alcanza el registro entero. Lo mismo con un `camino` que acaba en 0: su dirección es la de su padre (`direccion([1, 0]) === direccion([1])`), así que un registro que va en ella está en esa colisión. **[X] decidir VG**: si ver o heredar una subposición 0 (o anidar bajo un camino que acaba en 0) necesita una referencia por índice exacto (como BUSCAR por índice, mapa §12). Hasta entonces se conserva lo que había: la dirección con ceros finales.

**Ver y heredar.** Una celda vista (`{ ref: foco, dir: i.j }` en `[i][j][0]`) y una heredada en la misma celda son el mismo valor. Lo que las distingue es `contexto.heredadas`: el registro dice qué heredó, y lo demás se vio o se escribió (`desdeMapped` devuelve además `vistas`). **[X] decidir VG**: si ver necesita una marca propia en el payload.

**Compactación.** Bajo la raíz, un array de un solo terminal se guarda como el terminal: la dirección `2000000000` nombra a la vez `[2]`, `[2][0]` y `[2][0][0]` (colisión de ceros finales). Por eso una celda con solo la clase 0, sola en su posición, ocupa `payload[i]` como antes de la matriz (compatibilidad con las décuplas de líneas). La raíz del registro es siempre un array.

### 7.3 Conformar el registro de salida (`src/escritura.js`)

```js
item(eje, texto)                           // → terminal: número, texto, o referencia {ref, dir?} si el texto es '@<prefijo>' o '@<prefijo>:<dirección>'; diez dígitos exactos son una dirección y se quedan como texto ('0400000000')
resolverRef(eje, prefijo)                  // → { ref: id completo }  el prefijo (con o sin '@', ≥ 4 caracteres) debe ser único en eje.orden
desdePointed(eje, texto)                   // → un terminal (una referencia también vale)
desdeSequenced(eje, textos)                // → array de 1 a 10 ítems sin huecos (los vacíos finales se descartan)
desdeMapped(eje, entrada, foco, camino = [])  // → { payload | null, heredadas, vistas, anclados, camino }  la matriz 10×10×10 (§7.2)
ubicar(eje, foco, celda, { camino = [], escritas = [], modo?, contenido? } = {})  // → { ubicacion: 'dentro' | 'anclado', en, dir, faltan, motivo? }
costeT(payload)                            // → minutos de T que mueve el registro = contarPosiciones(payload), heredadas incluidas
escribirDesde(eje, { modo, autor, sobre, en = direccion(camino), payload, t = ahora, contexto = {}, celda?, camino = [], heredadas = [] }, privada)  // → Promise<evento>
escribirSalida(eje, { modo = 'mapped', autor, sobre, salida, t = ahora, contexto = {} }, privada)  // → Promise<{ registro | null, anclados: evento[], proporcion }>
CLASES                                     // los nombres de clase: 0–4 de VG; 5–9 null, [X] decidir VG (§7.2)
claseDe(dir, camino = [])                  // → la clase de la dirección leída desde el camino: su dígito en la profundidad camino.length + 2 (sin camino, el tercero)
```

**Ítems de entrada** (`item`): se recorta el texto; vacío → error `ítem vacío`; `/^@([0-9a-f]{4,64})(?::([0-9]{10}))?$/i` → referencia por prefijo hexadecimal (`resolverRef`: `referencia desconocida: <p>` si ningún id empieza así, `referencia ambigua: <p>` si varios); `/^-?\d+(\.\d+)?$/` → número JS; cualquier otra cosa → la cadena tal cual (`'12 EUR'` y `'=LOCAL(1)'` son cadenas; su sentido lo pone BQL). Un `@` seguido de algo que no es hexadecimal de 4 a 64 caracteres (`'@zzzz'`, `'@ab'`, `'@4598f23e:12'`) **es texto**, no error; `referencia demasiado corta` solo lo da `resolverRef` llamado directamente con menos de cuatro caracteres.

**Pointed** escribe un terminal; si `item` no da un terminal → `Pointed escribe un terminal` (no ocurre con `item`, que siempre devuelve terminales).

**Sequenced** escribe una hilera: se recortan los textos, se quitan los vacíos finales; vacía → `la hilera está vacía`; > 10 → `la hilera tiene más de 10 posiciones`; un vacío intermedio → `hueco en la posición <i>: rellénala o quita las siguientes`.

**Mapped** (`desdeMapped`) conforma la matriz 10×10×10 bajo `camino` del foco. La `entrada` es una de dos formas (no se mezclan: `mezcla de líneas y celdas…`):

| Forma | Ejemplo | Lectura |
|---|---|---|
| Diez listas de líneas, una por posición (la del formulario de hoy) | `lineas[4] = ['pagado', 'servido']` | Una línea **sin marca** es **texto** (pasa por `item`) y va con clase 0 a la **subposición siguiente libre**: la décupla de siempre. Una línea que empieza por `d.d ` (`'1.5 kg de harina'`) sigue siendo texto. Una línea con la **marca de celda `@:j.k texto`** fija subposición `j` y clase `k` (primero se colocan las marcadas); sin texto y con `k = 0` es ver (`'@:2.0'`). Solo la forma exacta es una celda marcada: una línea que empieza por `@:` sin esa forma (`'@:) gracias'`, `'@:1.2x'`) es texto, como antes. La marca es una propuesta (**[X] decidir VG**): lo que deja de poder escribirse como texto es una línea con la forma exacta (`'@:1.2 algo'`), que no tiene escape. |
| Lista de celdas | `[{ i: 1, j: 2, k: 4, contenido: 'pagar 12 EUR' }]` | `j` y `k` valen 0 si faltan. `contenido`: texto (pasa por `item`) o valor BTML. **Sin contenido y con clase 0 es ver**: una referencia a la celda del foco, cuya dirección ha de alcanzar algo en el foco (`no hay nada que ver en <i.j>…` si no). |

Cada celda se ubica con `ubicar`, en orden de dirección: **dentro** si cada hueco anterior de su ruta ya está escrito en el mismo registro o el foco tiene contenido en ese camino exacto (§7.2); si no, **anclada**. Devuelve:

- `payload`: la matriz con lo que va dentro (lo anterior no modificado, heredado del foco por referencia), o `null` si todo se ancla;
- `heredadas`: lo heredado, en orden: posiciones como número (`3`) y subposiciones o clases como texto (`'1.0'`, `'1.2.3'`). Cada una alcanza algo en el foco;
- `vistas`: las celdas vistas (`'1.2'`);
- `anclados`: `[{ celda: [i, j, k], en, payload, faltan }]`, una entrada por celda sin base: `en` es la dirección de la celda y `faltan` los huecos sin base que la alejan (`['5', '6']`);
- `camino`: el camino del foco; el registro va en `direccion(camino)`, de modo que cada celda `i.j.k` cae en `direccion([...camino, i, j, k])` y su clase es `claseDe(esa dirección, camino)`, la `k` (§7.2).

`desdeMapped` ubica solo por la base, como `ubicar` sin modo: **no ancla por límites**. Los límites del modo miden la salida entera al escribirla con `escribirSalida`, que la rechaza si no cabe (§7.1, **[X] decidir VG** si `desdeMapped` también ancla por límites).

Errores: `la décupla está vacía: ver ya es una modificación (clase 0); escribe o ve al menos una celda`; `no hay nada que ver en <i.j>: el foco no tiene esa celda`; `la celda <i.j.k> está dos veces`; `celda fuera de la matriz: <i.j.k>`; `falta el contenido de <i.j.k>: solo ver (clase 0) va sin contenido`; `la posición <i> no admite más de 10 subposiciones`; `la décupla tiene más de 10 posiciones`; `la celda <…> no cabe bajo un camino de <n> profundidades`; `contenido no válido en <i.j.k>: …`; `foco desconocido: <id>`.

Respecto de la décupla anterior a la matriz cambian dos cosas: lo lejano se ancla en vez de dar `hueco en <i>`; y una línea con la forma exacta `@:j.k texto`, que antes era texto, es una celda marcada. Las demás líneas significan lo mismo, también las que empiezan por `@:` sin esa forma. Un foco terminal hereda su posición 0 como antes (§7.2, **[X]**). **[X] decidir VG**: la marca (propuesta: `@:j.k`) y si el formulario de Mapped pide la clase de cada celda (`app.js` no enseña la marca).

**`ubicar(eje, foco, celda, { camino, escritas, modo, contenido })`** decide entre «dentro del registro» y «anclado en la posición» para una celda objetivo (`[i]`, `[i, j]` o `[i, j, k]` bajo `camino`). `escritas` son las celdas que ya van dentro del mismo registro (cuentan como base). `en` es donde va el registro (dentro, `direccion(camino)`; anclado, la dirección de la celda) y `dir`, donde cae la celda en los dos casos: `direccion([...camino, ...celda])`, de clase `claseDe(dir, camino)`. **Con `modo`**, tiene en cuenta sus límites (§7.1) con `contenido` (un terminal si falta; cada una de `escritas` cuenta una posición): si la celda tiene base pero el registro, con su relleno heredado, no cabría, la ancla sola y lo dice en `motivo` (`pointed escribe como mucho 1 posiciones; dentro, el registro tiene 3`); si ni sola cabe, error (`… esta celda tiene <n>`). Sin `modo` solo mira la base: así ubica `desdeMapped`, cuya salida se mide entera al escribirla (y se rechaza si no cabe). No escribe nada.

**`escribirDesde`** escribe **un** registro en `sobre` + `en` (`en` vale por defecto `direccion(camino)`: la raíz sin camino). Comprueba los **límites** del modo (§7.1): primero el máximo de la **proporción** sobre todas las posiciones del registro (`<modo> escribe como mucho <máx> posiciones; este registro tiene <n>`, como antes) y después el **tope duro** sobre lo **emitido** (`<Modo> emite como mucho <tope> posiciones; este registro tiene <n>`). Con `heredadas` (las de `desdeMapped`), esas posiciones son relleno y no cuentan para el tope; cada una ha de ser una referencia al foco en su dirección bajo `camino`, y el foco ha de tener contenido en ese camino exacto (`la heredada <h> no es una referencia al foco en <dir>`, `la heredada <h> no alcanza nada en el foco: solo se hereda lo que el foco tiene`, `heredada no válida: <h>`); quedan en `contexto.heredadas`. Con `heredadas`, el registro va en `direccion(camino)`, como con `celda`: otro `en` se rechaza (`con heredadas, el registro va en <dir del camino> (la dirección de su camino), no en <en>`). Sin `heredadas`, todo el payload cuenta como emitido. Añade `contexto.modo` al contexto que se le pase y escribe con `eje.escribir` un solo movimiento: `{ token: 'T', escala: 'minuto', cantidad: costeT(payload), de: autor, a: null }` (el coste sí cuenta el relleno). Con **`celda`**, `payload` es el contenido de esa celda del foco `sobre` y se ubica con `ubicar` **con el modo**: dentro, se envuelve en la matriz (con lo anterior heredado por referencia, apuntado en `contexto.heredadas`); anclado (sin base, o porque dentro no cabría), se escribe tal cual. El registro va en el `en` de `ubicar` y la celda cae en su `dir`; otro `en` se rechaza (`la celda <i.j.k> cae en <dir>: el registro va en <en de ubicar>, no en <en>`). `payload` nulo → `nada que escribir en el registro…`; todo heredado → `nada que emitir: todo el registro es herencia del foco`. Si el `payload` viene de `desdeMapped` y dejó celdas ancladas, escribirlo solo las perdería: se rechaza con `<n> celda(s) sin base en el foco se ancla(n) aparte (<i.j.k> en <dir>, …): escribe la salida entera con escribirSalida`. El aviso va con el objeto `payload` que devolvió `desdeMapped` (una copia no lo lleva) y dura hasta que `escribirSalida` ha escrito la salida entera: si `escribirSalida` falla (por ejemplo, por saldo de T), el aviso sigue.

**`escribirSalida`** escribe la salida entera de `desdeMapped`: el registro (si hay algo dentro) en `direccion(salida.camino)`, con sus `heredadas`, y cada celda anclada en su `en`. No se le pasa `en` ni `camino`: los dice la salida, para que cada celda caiga en su dirección. Los límites miden **la salida entera** antes de escribir nada: primero la proporción, todas sus posiciones (`… escribe como mucho <máx> posiciones; esta salida tiene <n>`, **[X] decidir VG**); después el tope, lo emitido sin las heredadas (`… emite como mucho <tope> posiciones; esta salida tiene <n>`). Si no cabe, la rechaza entera: no ancla celdas por límites como `ubicar` con modo (**[X] decidir VG**, §7.1). Una salida de otro foco no pasa (sus heredadas no son referencias a `sobre`). Devuelve también `proporcion`: dónde quedan las posiciones de la salida respecto de la proporción del modo (por debajo o dentro; por encima no llega a escribirse); y `alcance`, los tres números de lo emitido (`{ conseguido, minimo, maximo, alMinimo }`, VG 7-11 noche): por debajo del mínimo del modo se escribe igual y se dice. `escribirDesde` devuelve el evento del eje (congelado y firmado); sus tres números, con `alcanceDeRegistro(evento)` (lo emitido = posiciones del registro menos `contexto.heredadas`, en el modo de `contexto.modo`). No es atómica: si el eje rechaza un anclado (por ejemplo, por saldo de T), lo anterior queda escrito.

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
const kilo = []; kilo[1] = ['1.5 kg de harina'];
console.log('una línea «d.d» es texto:', corto(desdeMapped(eje, kilo, compra.id).payload));
try { desdeMapped(eje, [], compra.id); } catch (e) { console.log(e.message); }
"
```

```text
["hola",12.5,-3,"12 EUR",{"ref":"d173ab58"},{"ref":"d173ab58","dir":"1000000000"},"=LOCAL(1)"]
ítem vacío
referencia desconocida: ffff
"@zzzz"
"@ab"
"@d173ab58:12"
{"ref":"d173ab58"}
referencia demasiado corta: @ab
referencia desconocida: ffff
"servido" {"ref":"d173ab58"}
["llegar",{"ref":"d173ab58"},3]
hueco en la posición 1: rellénala o quita las siguientes
la hilera está vacía
la hilera tiene más de 10 posiciones
[{"ref":"dd4ab35f","dir":"0000000000"},{"ref":"dd4ab35f","dir":"1000000000"},"sin lactosa",{"ref":"dd4ab35f","dir":"3000000000"},["pagado","servido a las 14:05"]] heredadas [0,1,3] coste 6 minutos
la 3 heredada alcanza ["huesped","cocina"] sin copiar
con camino [1]: {"payload":[{"ref":"dd4ab35f","dir":"1000000000"},"dos"],"heredadas":[0],"vistas":[],"anclados":[],"camino":[1]}
lo lejano se ancla: {"payload":null,"heredadas":[],"vistas":[],"anclados":[{"celda":[7,0,0],"en":"7000000000","payload":"más tarde","faltan":["5","6"]}],"camino":[]}
una línea «d.d» es texto: [{"ref":"dd4ab35f","dir":"0000000000"},"1.5 kg de harina"]
la décupla está vacía: ver ya es una modificación (clase 0); escribe o ve al menos una celda
```

Nota: `'@zzzz'` (no hexadecimal), `'@ab'` (corto) y `'@4598f23e:12'` (la subposición necesita diez dígitos) no casan con la forma de referencia y se guardan como texto. Las tres referencias heredadas de la décupla cuestan un minuto cada una: el coste cuenta posiciones del registro, no solo las tecleadas (el tope no las cuenta si se le dicen las `heredadas`; la proporción sí, como antes). Las líneas de la décupla son celdas `2.0.0`, `4.0.0` y `4.1.0`; compactadas, dan la misma décupla que antes de la matriz, y una línea que empieza por `d.d ` sigue siendo texto. La posición 7 está lejos (la compra solo desarrolla 0–4): se ancla en `7000000000` en vez de rechazarse.

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
const ver = desdeMapped(eje, [{ i: 1, j: 2 }], compra.id);
console.log('ver 1.2:', corto(ver.payload), '· heredadas', JSON.stringify(ver.heredadas), '· vistas', JSON.stringify(ver.vistas));
for (const c of [{ i: 2, j: 3 }, { i: 0, j: 5 }]) try { desdeMapped(eje, [c], compra.id); } catch (e) { console.log(e.message); }
const pagar = desdeMapped(eje, [{ i: 1, j: 2, k: 4, contenido: 'pagar 12 EUR' }], compra.id);
console.log('pagar 1.2.4:', corto(pagar));
const lineas = []; lineas[1] = ['@:2.4 pagar 12 EUR']; lineas[4] = ['pagado', '@:0.1 con tarjeta'];
const conMarca = desdeMapped(eje, lineas, compra.id);
console.log('con marca: [4] =', corto(conMarca.payload[4]), '· anclados', corto(conMarca.anclados.map((a) => a.celda.join('.') + ' en ' + a.en)));
for (const c of [[1, 2, 4], [2, 0, 0], [7, 0, 0], [1, 5, 0]]) console.log('ubicar', c.join('.'), corto(ubicar(eje, compra.id, c)));
for (const modo of ['mapped', 'pointed']) console.log('ubicar 2.0.0 en', modo, corto(ubicar(eje, compra.id, [2, 0, 0], { modo })));
const mezcla = []; mezcla[2] = ['sin lactosa']; mezcla[7] = ['repetir el sábado'];
const salida = desdeMapped(eje, mezcla, compra.id);
console.log('salida', corto(salida));
await escribirDesde(eje, { modo: 'mapped', autor: 'huesped', sobre: compra.id, payload: salida.payload, t: T }).catch((e) => console.log(e.message));
const antes = eje.saldoT('huesped', 'minuto');
const { registro, anclados, proporcion } = await escribirSalida(eje, { modo: 'mapped', autor: 'huesped', sobre: compra.id, salida, t: T });
console.log('registro en', registro.en, corto(registro.payload), JSON.stringify(registro.contexto), '· anclado en', anclados[0].en, corto(anclados[0].payload), '·', antes - eje.saldoT('huesped', 'minuto'), 'minutos ·', JSON.stringify(proporcion));
const celda = await escribirDesde(eje, { modo: 'pointed', autor: 'huesped', sobre: compra.id, celda: [9, 0, 0], payload: 'volver', t: T });
console.log('celda 9.0.0 →', celda.en, corto(celda.payload));
const postre = await escribirDesde(eje, { modo: 'mapped', autor: 'huesped', sobre: compra.id, celda: [3, 0, 0], camino: [1], payload: 'postre', t: T });
console.log('celda 3.0.0 bajo [1] en Mapped →', postre.en, corto(postre.payload), JSON.stringify(postre.contexto), '·', postre.movimientos[0].cantidad, 'minutos');
const flan = await escribirDesde(eje, { modo: 'pointed', autor: 'huesped', sobre: compra.id, celda: [3, 0, 0], camino: [1], payload: 'flan', t: T });
console.log('celda 3.0.0 bajo [1] en Pointed →', flan.en, corto(flan.payload), '·', flan.movimientos[0].cantidad, 'minuto');
await escribirDesde(eje, { modo: 'mapped', autor: 'huesped', sobre: compra.id, celda: [3, 0, 0], camino: [1], en: '4000000000', payload: 'postre', t: T }).catch((e) => console.log(e.message));
"
```

```text
0 ver/sustituir · 1 impulso de recursos · 2 criterio · 3 comunicación · 4 acción · 5 null · 6 null · 7 null · 8 null · 9 null
ver 1.2: [{"ref":"dd4ab35f","dir":"0000000000"},[{"ref":"dd4ab35f","dir":"1000000000"},{"ref":"dd4ab35f","dir":"1100000000"},{"ref":"dd4ab35f","dir":"1200000000"}]] · heredadas [0,"1.0","1.1"] · vistas ["1.2"]
no hay nada que ver en 2.3: el foco no tiene esa celda
no hay nada que ver en 0.5: el foco no tiene esa celda
pagar 1.2.4: {"payload":null,"heredadas":[],"vistas":[],"anclados":[{"celda":[1,2,4],"en":"1240000000","payload":"pagar 12 EUR","faltan":["1.2.0","1.2.1","1.2.2","1.2.3"]}],"camino":[]}
con marca: [4] = [{"ref":"dd4ab35f","dir":"4000000000"},"pagado"] · anclados ["1.2.4 en 1240000000","4.0.1 en 4010000000"]
ubicar 1.2.4 {"ubicacion":"anclado","en":"1240000000","dir":"1240000000","faltan":["1.2.0","1.2.1","1.2.2","1.2.3"]}
ubicar 2.0.0 {"ubicacion":"dentro","en":"0000000000","dir":"2000000000","faltan":[]}
ubicar 7.0.0 {"ubicacion":"anclado","en":"7000000000","dir":"7000000000","faltan":["5","6"]}
ubicar 1.5.0 {"ubicacion":"anclado","en":"1500000000","dir":"1500000000","faltan":["1.3","1.4"]}
ubicar 2.0.0 en mapped {"ubicacion":"dentro","en":"0000000000","dir":"2000000000","faltan":[]}
ubicar 2.0.0 en pointed {"ubicacion":"anclado","en":"2000000000","dir":"2000000000","faltan":[],"motivo":"pointed escribe como mucho 1 posiciones; dentro, el registro tiene 3"}
salida {"payload":[{"ref":"dd4ab35f","dir":"0000000000"},{"ref":"dd4ab35f","dir":"1000000000"},"sin lactosa"],"heredadas":[0,1],"vistas":[],"anclados":[{"celda":[7,0,0],"en":"7000000000","payload":"repetir el sábado","faltan":["5","6"]}],"camino":[]}
1 celda sin base en el foco se ancla aparte (7.0.0 en 7000000000): escribe la salida entera con escribirSalida
registro en 0000000000 [{"ref":"dd4ab35f","dir":"0000000000"},{"ref":"dd4ab35f","dir":"1000000000"},"sin lactosa"] {"modo":"mapped","heredadas":[0,1]} · anclado en 7000000000 "repetir el sábado" · 4 minutos · {"posiciones":4,"rango":[250,333],"estado":"por debajo"}
celda 9.0.0 → 9000000000 "volver"
celda 3.0.0 bajo [1] en Mapped → 1000000000 [{"ref":"dd4ab35f","dir":"1000000000"},{"ref":"dd4ab35f","dir":"1100000000"},{"ref":"dd4ab35f","dir":"1200000000"},"postre"] {"modo":"mapped","heredadas":[0,1,2]} · 4 minutos
celda 3.0.0 bajo [1] en Pointed → 1300000000 "flan" · 1 minuto
la celda 3.0.0 cae en 1300000000: el registro va en 1000000000, no en 4000000000
```

Lectura:

- `ver 1.2`: ver el precio emite una referencia a él (`1200000000`) y hereda por referencia lo anterior (la posición 0 y las subposiciones 1.0 y 1.1): cuatro posiciones, una emitida. Ver lo que la compra no tiene (2.3, 0.5) se rechaza.
- `pagar 1.2.4`: el precio (`'EUR 12'`) es un terminal y no tiene clases 0–3 que heredar: el pago se ancla en `1240000000`, un registro de una posición.
- `con marca`: `'@:0.1 con tarjeta'` fija la subposición 0 con clase 1 (impulso de recursos), así que `'pagado'` va a la subposición libre siguiente, la 1, y `4.0` se hereda (`4000000000`). La clase 1 de `4.0` (que es `'pagar'`, un terminal) no tiene base y se ancla en `4010000000`, igual que `@:2.4` en `1240000000`. Sin la marca `@:`, las líneas serían texto, como antes.
- `ubicar 2.0.0 en mapped / en pointed`: la celda tiene base (la compra tiene 0 y 1). En Mapped cabe dentro; en Pointed, dentro serían 3 posiciones (dos heredadas y la celda) y la proporción de Pointed admite 1: `ubicar` la ancla sola en `2000000000` y dice por qué.
- `ubicar 1.5.0`: la posición 1 de la compra tiene subposiciones 0–2; la 5 está lejos (faltan 1.3 y 1.4) y se ancla en `1500000000`.
- `salida`: la posición 2 cabe dentro; la 7 se ancla. `escribirDesde` con solo el payload la perdería y se rechaza; `escribirSalida` escribe el registro (3 posiciones, `contexto.heredadas` = `[0, 1]`) y el anclado (1): cuatro minutos. Lo emitido son 2 posiciones (lo escrito, no lo heredado: lo que cuenta el tope); la proporción cuenta las 4 posiciones de la salida y la deja por debajo de su mínimo (250), que no se exige. Lo anclado es un ocupante escrito de `7000000000` en la compra (`docs/BTML.md` §6).
- `celda 3.0.0 bajo [1]`: bajo la posición 1 de la compra la celda tiene base. En Mapped va dentro: el registro va en `1000000000` (la dirección del camino) y el postre cae en `1300000000`, como dice `ubicar`; cuatro posiciones y cuatro minutos, una sola emitida. En Pointed, esas cuatro posiciones no caben en la proporción (1): `ubicar` la ancla y el flan se escribe solo en `1300000000`, la misma dirección, con un minuto. Pedirle otro `en` se rechaza.

La matriz bajo un camino: la misma dirección es otra celda, con otra clase, según desde dónde se lea; y la raíz de un foco terminal hereda su posición 0, como antes.

```sh
node --input-type=module -e "
import { ejemploCompra } from './ejemplos/ikisai/compra-food.mjs';
import { desdeMapped, ubicar, escribirSalida, claseDe } from './src/escritura.js';
import { resolver } from './src/btml.js';
const corto = (x) => JSON.stringify(x).replace(/[0-9a-f]{64}/g, (m) => m.slice(0, 8));
const T = '2026-11-07T16:00:00Z';
const { eje, compra } = await ejemploCompra();
for (const [celda, camino] of [[[1, 2, 4], []], [[2, 4, 0], [1]], [[0, 1, 0], [1]], [[7, 3, 4], [1]], [[1, 0, 4], [1, 2]]]) {
  const u = ubicar(eje, compra.id, celda, { camino });
  console.log('celda', celda.join('.'), 'bajo', JSON.stringify(camino), '→', u.ubicacion, 'en', u.en, '· cae en', u.dir, '· clase', claseDe(u.dir, camino), '(desde la raíz', claseDe(u.dir) + ')');
}
const lineas = []; lineas[2] = ['@:0.4 pagar 12 EUR']; lineas[3] = ['postre'];
const bajo = desdeMapped(eje, lineas, compra.id, [1]);
const r = await escribirSalida(eje, { autor: 'huesped', sobre: compra.id, salida: bajo, t: T });
console.log('salida bajo [1]: registro en', r.registro.en, corto(r.registro.payload), '· anclado en', r.anclados.map((a) => a.en + ' clase ' + claseDe(a.en, [1])).join(', '));
const g = eje.genesisId; const una = []; una[1] = ['algo'];
const s = desdeMapped(eje, una, g);
console.log('génesis (terminal):', corto(s.payload), '· heredadas', JSON.stringify(s.heredadas), '· la 0 alcanza', JSON.stringify(resolver(eje.obtener(g).payload, s.payload[0].dir)));
const precio = desdeMapped(eje, una, compra.id, [1, 2]);
console.log('bajo [1, 2] (el precio, terminal):', corto(precio.payload), '· la 0 alcanza', JSON.stringify(resolver(compra.payload, precio.payload[0].dir)));
"
```

```text
celda 1.2.4 bajo [] → anclado en 1240000000 · cae en 1240000000 · clase 4 (desde la raíz 4)
celda 2.4.0 bajo [1] → anclado en 1240000000 · cae en 1240000000 · clase 0 (desde la raíz 4)
celda 0.1.0 bajo [1] → anclado en 1010000000 · cae en 1010000000 · clase 0 (desde la raíz 1)
celda 7.3.4 bajo [1] → anclado en 1734000000 · cae en 1734000000 · clase 4 (desde la raíz 3)
celda 1.0.4 bajo [1,2] → anclado en 1210400000 · cae en 1210400000 · clase 4 (desde la raíz 1)
salida bajo [1]: registro en 1000000000 [{"ref":"dd4ab35f","dir":"1000000000"},{"ref":"dd4ab35f","dir":"1100000000"},{"ref":"dd4ab35f","dir":"1200000000"},"postre"] · anclado en 1204000000 clase 4
génesis (terminal): [{"ref":"49ee3fca","dir":"0000000000"},"algo"] · heredadas [0] · la 0 alcanza "Casa de ejemplo"
bajo [1, 2] (el precio, terminal): [{"ref":"dd4ab35f","dir":"1200000000"},"algo"] · la 0 alcanza "EUR 12"
```

Lectura: pagar el precio desde la raíz es la celda `1.2.4` (clase 4); la misma dirección `1240000000`, leída bajo `[1]`, es la celda `2.4.0`, de clase 0. Bajo `[1]`, `@:0.4 pagar 12 EUR` en la posición 2 es la celda `2.0.4`: cae en `1204000000` y su clase, leída desde `[1]`, es 4 (desde la raíz sería 0). El génesis y el precio son terminales: escribir en su posición 1 hereda la 0, cuya dirección alcanza el terminal (como en `main`; **[X] decidir VG**, §7.2).

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
const diezMilUno = [Array(10).fill(Array(10).fill(Array(10).fill(Array(10).fill('z')))), 'una más'];
await escribirDesde(eje, { modo: 'scened', autor: 'huesped', sobre: compra.id, payload: diezMilUno, t: T }).catch((e) => console.log(e.message));
await escribirDesde(eje, { modo: 'otro', autor: 'huesped', sobre: compra.id, payload: 'x', t: T }).catch((e) => console.log(e.constructor.name + ': ' + e.message));
await escribirDesde(eje, { modo: 'mapped', autor: 'huesped', sobre: compra.id, payload: null, t: T }).catch((e) => console.log(e.message));
"
```

```text
true 4000000000 {"modo":"pointed"} [{"token":"T","escala":"minuto","cantidad":1,"de":"huesped","a":null}] minutos 1
0000000000 {"nota":"libre","modo":"sequenced"} 3 hijos de la compra 2
pointed escribe como mucho 1 posiciones; este registro tiene 30
sequenced escribe como mucho 20 posiciones; este registro tiene 30
mapped 30
scened 100
Scened emite como mucho 10000 posiciones; este registro tiene 10001
Error: modo desconocido: otro
nada que escribir en el registro (si todo se ancla, escribe la salida con escribirSalida)
```

Treinta posiciones superan la proporción de Pointed (1) y también su tope (10): lo dice la proporción, que se mira primero, con el mensaje de siempre. En Sequenced, igual con su proporción (20) (**[X] decidir VG** si rechaza, §7.1). Scened no tiene proporción: solo su tope, que rechaza 10001 posiciones emitidas.

### 7.4 Qué usa el motor

| Registro | Vía | Modo | Posiciones |
|---|---|---|---|
| consolidación | `escribirDesde` | `mapped` | 1 + posiciones elegidas o heredadas (≤ 333 por la proporción; tope 1000) |
| autorización | `escribirDesde` | `pointed` | 1 |
| ejecución | `eje.escribir` directo | — (sin `modo`, sin comprobar tope) | 3 |

`consolidar` no usa todavía `desdeMapped` ni `ubicar`: sus huecos se heredan si el foco tiene ocupantes y si no se rechazan (§3.4, §3.5).

Pendiente: si una hilera o una décupla deben anidarse en una posición concreta por decisión o siempre en la raíz del foco (hoy, sin celda, `en` lo elige quien llama; con celda o con `escribirSalida`, el registro va en la dirección del camino y lo anclado en la de su celda); el coste real de cada operación (hoy un minuto por posición del registro, heredadas incluidas, cartón piedra: **[X] decidir VG** si el relleno se cobra).

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
  pasado registro      5eed2389 huesped  2026-11-07T14:30:00Z   -1800 hora
  pasado registro      233c9da6 cocina   2026-11-07T14:10:00Z   -3000 hora
  pasado registro      d173ab58 cocina   2026-11-07T09:00:00Z  -21600 dia
  pasado registro      06b890b5 casa     2026-11-07T09:00:00Z  -21600 dia
  pasado registro      49ee3fca casa     2026-11-07T09:00:00Z  -21600 dia
  futuro consolidacion 5eed2389 huesped  2026-11-07T14:30:00Z   -1800 hora PENDIENTE DE AUTORIZACIÓN
  futuro proyeccion    fd9032b5 huesped  2026-11-13T13:30:00Z  513000 semana 
declarado:cena el sábado:0:segundo · pasado 2 de 4
```

### 8.3 Comparabilidad relativa (PV8)

```js
medir(eje, id)      // → { posiciones, escritos, movimientos }  posiciones desarrolladas del payload, hijos directos (sin sus bases del 8), movimientos del evento
comparar(eje, foco) // → { foco, posicion, de, comparables: [{ id, autor, posiciones, escritos, movimientos, puntuacion }], hitos: HITOS }
HITOS               // diez hitos { indice, nivel, nombre }, congelados
```

Los **comparables accesibles** del foco son sus hermanos: los registros escritos sobre el mismo padre, sin sus bases del 8 (`bases.hijos(eje, foco.sobre)`, sin distinguir `en`). El génesis y una base del 8 solo se comparan consigo mismos. La puntuación es `posiciones + 2 × escritos + movimientos` (cartón piedra); la lista va de mayor a menor puntuación y `posicion` es la del foco (1 = más medido). No asigna nivel ni grado: `HITOS` es la tabla de los diez hitos, con sus etiquetas literales (mapa §2.2 [D20]), sin algoritmo que la aplique (pendiente). Las estrellas no son verdad.

| Índice | Nivel | Nombre |
|---|---|---|
| 0 | 0.3 | idea |
| 1 | 1.1 | aprendizaje |
| 2 | 2.1 | avanzado |
| 3 | 3.1 | aprendizaje profesional |
| 4 | 3.2 | resolución profesional |
| 5 | 4.1 | aprendizaje superior |
| 6 | 4.2 | solución profesional avanzada |
| 7 | 5.1 | investigación |
| 8 | 5.2 | trabajo maestro |
| 9 | 5.3 | resolución experimental muy avanzada |

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
menú: posición 1 de 2 · d173ab58 cocina 9 | 0e9d31d3 casa 2
nota: posición 2 · génesis: de 1 · hitos true 10 5.3 resolución experimental muy avanzada
```

Las bases del 8 se escriben como registros en la posición 8 de lo que resumen (§14); `tiempo.confluir` calcula lo mismo al vuelo. Pendiente: proyecciones reales en PV7 (timelocks, hashlocks, fechas en el payload más allá de la posición 7), nivel y grado.

## 9. Persistencia

```js
VERSION = 3                         // 7-11 noche (ciclo de vida de los tokens); la 2, desde la PR #35 (series de tokens); un eje de la versión 1 no se restaura
serializar(eje)                     // → { version: 3, exigirFirmas, v2?: { eventos, ultimo }, eventos: evento[] }  los eventos, en orden; v2 solo si el eje viene de una migración
migrar(datos)                       // → los datos en la versión actual: de la 2 a la 3, version: 3 y v2 = { eventos: n, ultimo: id del último } (todos se validan con las reglas de la 2)
restaurar(datos)                    // → Promise<Eje>  migra, comprueba la marca v2 y Eje.desde(eventos, { eventosV2: n }): vuelve a validar ids, firmas, saldos y reglas de emisión (las de la 2 para los primeros eventosV2); lanza si algo no cuadra
guardarLocal(eje, clave = 'agram.eje')  // → boolean  localStorage.setItem(clave, JSON); false si lanza
cargarLocal(clave = 'agram.eje')        // → Promise<Eje | null>  null si no hay nada o algo falla
borrarLocal(clave = 'agram.eje')        // → void
apartarLocal(clave = 'agram.eje', destino = clave + '.anterior')  // → boolean  copia lo guardado sin borrarlo (la app aparta así un eje de la versión 1)
```

Se guarda **la lista de eventos y nada más**. Todo lo demás se reconstruye al restaurar: saldos, identidades, claves, índice de hijos, el árbol lógico y, con él, los estados de la fábrica (`estadoDe` vuelve a calcularse desde los escritos). Un evento manipulado en el guardado se rechaza (`id no corresponde al cuerpo`); una firma quitada también (`firma ausente`). Errores propios: `eje de la versión <n>; esta es la 3` (un guardado de otra versión sin migración, p. ej. anterior a las series), `datos de eje inválidos` (sin `version`, sin eventos), `el primer evento debe ser el génesis`, `eventosV2 no se declara en un guardado: …`, `la marca de la versión 2 no corresponde a sus eventos`. Lo mismo en `docs/BTML.md` §8.1.

**De la versión 2 a la 3 la migración no es trivial.** Las reglas de la 3 (solo emiten personas, emisión escalonada, el `t` de un evento no anterior al de su foco ni al alta de su autor) rechazarían un eje v2 con un génesis de grupo, con E o R emitidos fuera del génesis sin el escalonado o con eventos fechados hacia atrás. Por eso `migrar`, y solo desde unos datos de la versión 2, marca el prefijo (`v2: { eventos: n, ultimo: <id del último> }`), `restaurar` comprueba que el evento n tiene ese id (los ids se vuelven a verificar) y revalida esos n eventos con las reglas de la 2 (T y P solo los emite el génesis; E y R, su emisor a sí mismo, persona o grupo; R no se devuelve; sin estado, salida ni caduca; sin escalonado ni regla del reloj; el `t` vale si Date.parse lo lee; `src/ciclo.js`). Los eventos que se añadan después siguen las reglas de la 3, y el alta de quien entró en el prefijo cuenta, para el reloj y el tope de T, desde el primer evento de la 3. `serializar` conserva la marca y validez lee cada registro con las reglas que le tocan. Un `eventosV2` suelto en un guardado se rechaza (revisión de seguridad, 7-11 noche). Lo que la marca no es: una firma; quien escribe el archivo puede escribirla, igual que podría presentar sus eventos como versión 2, que también se admite, y no gana nada que la versión 2 no diera ya (**[X] confirmar VG**).

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
encaje guardado [{"posicion":1,"evento":"46ff5dd9","tipo":"referencia","origen":"1100000000","destino":"1000000000","vector":[0,1,0,0,0,0,0,0,0,0],"signo":"reducir"}]
puede autorizar casa=true cocina=true huesped=false
rechazo: el autor no se autoriza a sí mismo
autorización "==sale en 10 minutos" · AUTORIZADO
ejecución ["Pagado y servido",{"ref":"c0f3626f"},{"ref":"8dea7eb1"}] · evidencia ["c0f3626f","8dea7eb1"] · EJECUTADO
EUR cocina 14 huesped 36 · hilo de la ejecución: huesped → huesped → huesped → cocina → casa → casa
consolidaciones del pedido [{"id":"c0f3626f","autor":"huesped","t":"2026-11-07T13:40:00Z","titulo":"Pedido del guiso","estado":"EJECUTADO","fuentes":["46ff5dd9"]}]
pasado registro:huesped:hora registro:cocina:dia registro:casa:dia registro:casa:dia · futuro 0
comparar: posición 1 de 2 · huesped=9 casa=3
restaurado 8 eventos · EJECUTADO · posición 2 de la consolidación: sin lactosa
```

Lectura de la salida:

- `pedido`: las posiciones 0 y 2 no se rellenaron y están por debajo de la 3, así que se heredan del menú por referencia; seis posiciones, seis minutos.
- `posición 1`: colisionan `[1]` y `[1, 0]` (la referencia al guiso) con lo que esa referencia alcanza. El guiso vive en la profundidad 1.1 del menú y se coloca en la 1 del pedido: vector `[0, 1, …]` (candidato − buscado: `1.1` menos `1`), signo `reducir` (le sobra una profundidad). `posición 4 nada`: el pedido tiene posiciones 0–3 y nadie ha escrito en su 4.
- `consolidación`: la elección de la 1 es la referencia al guiso (`menú:1100000000`); la 3 se hereda del pedido; el encaje guardado es el del candidato elegido.
- `puede autorizar`: cocina, por los 2 P con ámbito el menú (el pedido cuelga del menú); la casa, por los 3 P que le quedan sobre `genesis`; la persona huésped no, porque es el autor.
- `EUR cocina 14 huesped 36`: los euros se mueven en la ejecución, no antes. El hilo de la ejecución recorre autores: huésped (ejecución) → huésped (consolidación) → huésped (pedido) → cocina (menú) → casa (alta) → casa (génesis).
- `futuro 0`: la única consolidación ya está ejecutada y el pedido no tiene posición 7. `comparar`: los hermanos del pedido son lo escrito sobre el menú: el pedido (6 posiciones + 2 × 1 escrito + 1 movimiento = 9) y la delegación de poder (1 + 0 + 2 = 3).
- `restaurado 8 eventos`: génesis, alta, menú, delegación, pedido, consolidación, autorización y ejecución; el estado `EJECUTADO` se recalcula desde ellos.

## 11. API mínima

```js
// src/motor.js
export const FABRICA = '4000000000';
export const FASES = ['consolidado', 'autorizado', 'ejecutado'];
export const REGLA_AUTORIZAR: string;   // la regla V0 en texto; va en contexto.autoridad.regla de cada autorización
export function caminoVisible(ocupante): number[];
export function esConsolidacion(evento): boolean;  // fase 'consolidado', motor 'fabrica' y anclada en la fábrica (posición 4) de un camino de su foco
export const OPERADORES = { Q: 'descubrir', B: 'proponer', C: 'consolidar' };
export function descubrir(eje, foco, { camino = [], posiciones = [1, 2, 3, 4], epoca, maximo = Infinity } = {}): { posicion, dir, candidatos: Candidato[], total, limitada }[];
export function proponer(eje, foco, { camino = [], posiciones = [1, 2, 3, 4] } = {}): { foco, elecciones, origenes: { posicion, desde, texto }[], pendientes: { posicion, motivo }[] };
export async function consolidar(eje, { autor, foco, elecciones, titulo = 'Consolidación', t, camino = [] }, privada?): Promise<Evento>;
export function puedeAutorizar(eje, identidad, consolidacion): boolean;
export function poderParaAutorizar(eje, identidad, foco, autorPropuesta): { ambito, cantidad }[];  // el P que cuenta: sobre un registro del hilo que autorPropuesta no escribió
export async function autorizar(eje, { autorizante, consolidacion, t, nota = 'autorizo' }, privada?): Promise<Evento>;
export async function ejecutar(eje, { autor, consolidacion, movimientos = [], t, titulo = 'Ejecutado' }, privada?): Promise<Evento>;
export function autorizacionesValidas(eje, consolidacion): Evento[];
export function estadoDe(eje, consolidacion): 'PENDIENTE DE AUTORIZACIÓN' | 'AUTORIZADO' | 'EJECUTADO' | undefined;
export function consolidaciones(eje, foco, camino = []): { id, autor, t, titulo, estado, fuentes }[];
export const CRITERIO_CAPACIDAD = 2;
export function capacidadDe(nodo): number | undefined;
export function tramoDe(eje, id): { inicio, fin, extremos, texto, desde };
export function registrosEn(eje, sobre, dir): Evento[];
export function ocupacion(eje, id): { sobre, dir, camino, capacidad, tramo, validos, aLaVez, cabe }[];

// src/escritura.js
export function resolverRef(eje, prefijo): { ref };
export function item(eje, texto): number | string | { ref, dir? };
export function desdePointed(eje, texto): terminal;
export function desdeSequenced(eje, textos: string[]): terminal[];
export function desdeMapped(eje, entrada: string[][] | { i, j?, k?, contenido? }[], foco, camino = []): { payload: any[] | null, heredadas: (number | string)[], vistas: string[], anclados: { celda, en, payload, faltan }[], camino: number[] };
export function ubicar(eje, foco, celda: number[], { camino = [], escritas = [], modo?, contenido? } = {}): { ubicacion: 'dentro' | 'anclado', en, dir, faltan: string[], motivo? };
export function costeT(payload): number;
export async function escribirDesde(eje, { modo, autor, sobre, en = direccion(camino), payload, t = ahora, contexto = {}, celda?, camino = [], heredadas = [] }, privada?): Promise<Evento>;
export async function escribirSalida(eje, { modo = 'mapped', autor, sobre, salida, t = ahora, contexto = {} }, privada?): Promise<{ registro: Evento | null, anclados: Evento[], proporcion }>;
export const CLASES: (string | null)[10];  // ver/sustituir, impulso de recursos, criterio, comunicación, acción; 5–9 null ([X] decidir VG)
export function claseDe(dir, camino = []): number;  // el dígito en la profundidad camino.length + 2
export { esReferencia };

// src/modos.js
export const MODOS = { pointed: { nombre: 'Pointed', decuplas: 1, proporcion: [1/10, 1/10], tope: 10 }, sequenced: { nombre: 'Sequenced', decuplas: 10, proporcion: [1/10, 1/5], tope: 100 }, mapped: { nombre: 'Mapped', decuplas: 100, proporcion: [1/4, 1/3], tope: 1000 }, scened: { nombre: 'Scened', decuplas: 1000, proporcion: null, tope: 10000 } };
export function nombreModo(modo): string;
export function lectura(modo): number;
export function tope(modo): number;
export function escritura(modo): [number, number] | null;
export function contarPosiciones(payload): number;
export function cabeTope(payload, modo, heredadas = []): boolean;  // lo emitido: sin las heredadas
export function cabeEscritura(payload, modo): boolean;
export function proporcionDe(posiciones, modo): { posiciones, rango: [number, number] | null, estado: 'por debajo' | 'dentro' | 'por encima' | 'sin fijar' };
export function proporcion(payload, modo): ReturnType<proporcionDe>;

// src/tiempo.js
export function banda(deltaSegundos): string;
export function ejeTemporal(eje, foco, { ahora, maximo = 10, camino = [] } = {}): { foco, ahora, pasado, futuro, totalPasado, totalFuturo };
export const HITOS: { indice, nivel, nombre }[10];
export function medir(eje, id): { posiciones, escritos, movimientos };
export function comparar(eje, foco): { foco, posicion, de, comparables, hitos };

// src/persistencia.js
export const VERSION = 3;
export function serializar(eje): { version, exigirFirmas, eventos };
export function migrar(datos): datos;  // de la versión 2 a la 3: version 3 y la marca v2 = { eventos, ultimo } (sus eventos se validan con las reglas de la 2)
export async function restaurar(datos): Promise<Eje>;
export function guardarLocal(eje, clave = 'agram.eje'): boolean;
export async function cargarLocal(clave = 'agram.eje'): Promise<Eje | null>;
export function borrarLocal(clave = 'agram.eje'): void;
export function apartarLocal(clave = 'agram.eje', destino = clave + '.anterior'): boolean;
```

Las anotaciones de tipo son documentación; el código es JavaScript puro sin dependencias. `Evento`, `Eje` y `Ocupante` están en `docs/BTML.md` §10; `Candidato` es un `Ocupante` más `estado` y `texto` (§2).

## 12. Lo que no existe (pendiente)

| Pendiente | Hoy |
|---|---|
| AARPIA: autorización y ejecución reales, con sus agentes | Regla V0: autoriza quien no es el autor y tiene P > 0 sobre un registro del hilo que el autor no escribió ([X] confirmar VG); ejecuta el autor (§4.1). |
| Las seis capacidades del motor (interpretar, resolver, posicionar, comparar, calcular, componer) como operaciones | No existen como funciones. |
| Rechazar, revocar, caducar; varias autorizaciones (quórum); ejecución por tramos | Tres estados y una sola autorización válida basta; `ejecutar` toma la primera. Una ejecución que el eje rechaza deja la consolidación en `AUTORIZADO` (§5). |
| Ejecución de varias partes (intercambio atómico: plaza por pago) | Cada movimiento sale del autor de la consolidación: una consolidación por parte, sin atomicidad (§5). [X] decidir VG (AARPIA). |
| Recibos de terceros referenciados por la operación raíz (aceptación, despacho, recepción) | La evidencia es consolidación + autorización; nada más se enlaza. |
| Cierre de una interacción en la interfaz | Fuera del motor. |
| Mínimo de la proporción de escritura; si la proporción rechaza o solo informa (**[X] decidir VG**, §7.1); proporción de Scened | Solo se comprueba el máximo, como antes: rechaza (1/20/333) sobre las posiciones del registro, y se mira primero, con el mensaje de siempre; además, el tope duro (10/100/1000/10000) rechaza sobre lo emitido (solo decide en Scened, sin proporción). |
| Si `desdeMapped` ancla por límites, como `ubicar` con modo, y qué celdas (**[X] decidir VG**, §7.1) | `ubicar` con modo y `escribirDesde` con una celda la anclan sola si dentro no cabe; `desdeMapped` ubica solo por la base, y `escribirSalida` rechaza entera la salida que no cabe. |
| Nombre de las clases 5–9 (**[X] decidir VG**, §7.2) | `CLASES[5…9]` valen `null`. |
| Escritura desde Scened (formulario, proporción) | Scened tiene tope de emisión (10000), lectura y composición con render sobrio (`src/scened.js`, `docs/MODOS.md`); su proporción está sin fijar y ninguna pantalla escribe desde él. |
| La marca de celda en las líneas de Mapped (propuesta: `@:j.k texto`) y si el formulario pide la clase de cada celda (`app.js`, **[X] decidir VG**, §7.3) | Una línea sin marca es texto con clase 0, como antes, también si empieza por `@:` sin la forma exacta; `@:j.k texto` fija la celda, y una línea con esa forma no se puede escribir como texto (no hay escape); `app.js` no enseña la marca. En Mapped, `app.js` escribe la salida entera con `escribirSalida` cuando quedan celdas ancladas (lo lejano se ancla en su posición y la décupla va en la dirección de su camino, aunque se eligiera otra posición: el aviso lo dice) o cuando la posición elegida es justo la de su camino; si no, con `escribirDesde` en la posición elegida, como antes. |
| «Ver» como registro mínimo desde la interfaz; marca propia de ver en el payload (**[X] decidir VG**, §7.2) | `desdeMapped` lo admite (celda de clase 0 sin contenido, si su dirección alcanza algo en el foco); ninguna pantalla lo emite. Ver y heredar se distinguen por `contexto.heredadas`. |
| Referencia exacta a una subposición 0, y registro bajo un camino que acaba en 0 (**[X] decidir VG**, §7.2) | Ver o heredar `i.0` usa la dirección de `i` (colisión de ceros finales); un registro bajo `[…, 0]` va en la dirección de su padre. |
| `consolidar` con la matriz: herencia por camino exacto y anclaje de lo lejano; clase de sus elecciones (**[X] decidir VG**, §3.5) | `consolidar` hereda por ocupantes y rechaza el hueco sin ellos; no guarda clase: se lee con `claseDe(destino, camino)`, y con la matriz relativa al camino es 0 para toda elección. |
| Si un registro guarda el camino desde el que se escribió (**[X] decidir VG**, §7.2) | No lo guarda. La clase de una dirección depende del camino (matriz relativa al camino): la de un registro anclado no se sabe sin él; quien escribe lo sabe (`salida.camino`, el `camino` de `escribirDesde` o de `consolidar`). |
| Posición 0 de un terminal (mapa §12: «un terminal no tiene posición 0», PENDIENTE; **[X] decidir VG**, §7.2) | Como en `main`: la raíz de un foco terminal hereda su posición 0 (su dirección alcanza el terminal); lo demás que cuelga de un terminal no tiene base y se ancla. El encaje, `decupla` y `mapa` no le dan posición 0 (`docs/BTML.md` §4.2). |
| Clase de la autorización y de la ejecución (**[X] decidir VG**: ¿2, criterio?; ¿4 escrita en otra dirección?, §3.5) | Ninguna guarda clase; las dos se escriben en `FABRICA`, sin camino: la celda `4.0.0`, de clase 0. |
| Clases sin modificar de una celda sin desarrollar: heredar por referencia a la celda `i.j` o anclar (**[X] decidir VG**, §7.2) | Se ancla: solo se hereda lo que el foco tiene en el camino exacto. |
| Coste real de las operaciones; si el relleno heredado se cobra (**[X] decidir VG**) | Un minuto de T por posición del registro (heredadas incluidas), también al autorizar y al ejecutar. |
| Anidar hileras o décuplas en una posición por decisión | Sin celda, `en` lo elige quien llama (`direccion(camino)` por defecto); con celda o con `escribirSalida`, el registro va en la dirección del camino y lo anclado en la de su celda. |
| Reglas por dimensión para el signo guardado en `encaje`; cambio del encaje con la época | El vector se guarda tal cual; ninguna regla lo filtra. |
| Caché y snapshot en la evaluación segura | BQL tiene pila de ciclos y presupuesto; no hay caché (`docs/BQL.md` §9). |
| Nivel y grado; `HITOS` aplicados; retirar `comparar` (auditoría C18) | `comparar` ordena hermanos por una puntuación fija; `HITOS` es una tabla. Las bases del 8 se escriben como registros fundibles en el 8 de lo que resumen y se leen con `BASES()` en BQL (§14). |
| Proyecciones reales en PV7: timelocks, hashlocks, fechas dentro del payload | Solo escritos con `t > ahora` y la posición 7 del foco. |
| Comprobar `t` contra un reloj o contra el orden del eje | Solo `Date.parse`. |
| Persistencia en base de datos; anclaje a una cadena; sincronización entre visores | Lista de eventos en memoria; `localStorage` por visor. |
| Render animado de las operaciones (sobrio/animado) | Solo renders sobrios en `pointed.js`, `sequenced.js`, `mapped.js` y `scened.js`; el frontend (`app.js`) queda fuera de este documento: los modos y su vista en el navegador están en `docs/MODOS.md`. |

## 13. Límites y defectos observados (no corregidos aquí)

1. `autorizar` guarda `'==' + nota`: BQL lo lee como `=<nota>` (`'==vale'` → `=vale`), no como `<nota>`. El escape se antepone siempre, haga falta o no.
2. `estadoDe` declara `EJECUTADO` ante cualquier escrito del autor con `fase: 'ejecutado'` cuya `evidencia` exista o falte, **sin comprobar que haya autorización válida**: un autor puede escribir a mano un «ejecutado» sobre una consolidación nunca autorizada (§6). `ejecutar` sí lo impide; `eje.escribir` no.
3. Hueco heredado cuando el foco no desarrolla la posición pero tiene escritos en ella: `consolidar` hereda `{ ref: foco, dir }` porque hay ocupantes, pero esa referencia alcanza `undefined` en el payload del foco; el escrito que justificó la herencia no queda referenciado. `desdeMapped` no tiene este caso (mira solo el payload, y lo que no tiene base lo ancla). Las dos reglas de base siguen siendo distintas (§3.5, §7.2).
4. `consolidar` no comprueba el foco antes de construir el payload: sin huecos, el error llega del eje (`evento rechazado: foco desconocido`); con huecos, del encaje (`registro desconocido`).
5. Una elección `{ ref, dir }` no comprueba que `dir` exista en la fuente.
6. `ejecutar` no pasa por `escribirDesde`: su registro no lleva `contexto.modo` y no se comprueban proporción ni tope (sí paga un minuto por posición). Toma como evidencia la primera autorización válida aunque haya varias.
7. `escribirSalida` no es atómica: si el eje rechaza una celda anclada (saldo de T, firma…), el registro y los anclados anteriores quedan escritos. El aviso de `escribirDesde` sobre celdas ancladas solo funciona si se le pasa el mismo objeto `payload` que devolvió `desdeMapped` (una copia no lo lleva); se retira cuando `escribirSalida` ha escrito la salida entera, así que tras un fallo a medias sigue puesto aunque el registro ya esté escrito.
8. `guardarLocal` devuelve `true` en Node sin `localStorage` aunque no haya guardado nada.
9. `banda` usa «estrictamente menor»: 60 s es `hora`, 3600 s es `dia`, 86400 s es `semana`.
10. `ejeTemporal` pone en `pasado` todos los antecesores del hilo aunque su `t` sea posterior a `ahora` (delta positivo en el pasado).
11. `consolidaciones(eje, foco, camino)` solo ve la fábrica de ese camino; una consolidación anclada en otra profundidad no aparece en el eje temporal de la raíz.
12. `costeT` y la proporción cuentan las referencias heredadas como posiciones del registro, como antes; el tope no las cuenta cuando la escritura sabe cuáles son (con `celda`, con `heredadas` o desde `escribirSalida`). Un payload de `desdeMapped` escrito con `escribirDesde` sin pasarle `heredadas` (así lo hace `app.js` cuando se elige una posición que no es la del camino y nada se ancla) cuenta el relleno también para el tope y no deja `contexto.heredadas`.
13. `escribirDesde` y `ejecutar` usan el reloj si falta `t`: ids no reproducibles.
14. `comparar` compara hermanos por `sobre` sin distinguir `en`; la puntuación `posiciones + 2 × escritos + movimientos` es cartón piedra, sin respaldo en el corpus.
15. La regla V0 permite que el autor de una consolidación sea quien tenga todo el poder: entonces nadie puede autorizarla (la casa consolidando sobre su propio eje sin haber delegado P).
16. `proponer` convierte el valor de una fórmula que no es número en su **texto** formateado: una magnitud se consolida como `"14 EUR (12 EUR + 2 EUR)"`, que BQL relee como `texto` (el paréntesis del desglose impide leerla como magnitud). El importe deja de ser operable en la consolidación (§2.1).
17. `ejecutar` sobre una consolidación pendiente lanza `Error('PENDIENTE DE AUTORIZACIÓN')`: el mensaje es el nombre del estado, sin prefijo que diga qué falló, y coincide con el valor normal de `estadoDe`.
18. Nada une el texto de la acción consolidada (`'pagar 14 EUR'`) con los `movimientos` de la ejecución: se puede consolidar «pagar 14 EUR» y ejecutar 1000 EUR (si hay saldo) o nada.

## 14. Bases del 8 (`src/bases.js`)

Las estadísticas del 8 son **registros** escritos en la posición 8 (el cielo, `CIELO = '8000000000'`) del registro que resumen, con referencias a lo medido; no hay base de datos aparte (mapa §12, [D] «Cohortes y bases del 8»). Lo que se mide, las cohortes, la caja y cómo se funde una medida son los de la confluencia (§8.3 y `tiempo.confluir`): una base es lo fundible de `confluir` sobre una cohorte, escrito en el 8 y fundible hacia arriba. Detalle, ejemplo ejecutado y abiertos en `docs/notas/BASES_DEL_8.md`; pruebas en `test/bases.test.js`; ejemplo en `ejemplos/ikisai/compras-hermanas.mjs`. Se importa como `bases` desde `src/index.js`.

```js
medir(eje, id)                       // → tiempo.medidasDe(eje, id), con un guarda: BASES() dentro del propio registro no lo vuelve a medir
cortesDe(clave, epoca)               // → { cortes, origen }: los de epoca.cortes(clave) ('epoca') o los provisionales ('provisional', [X] sus valores)
unitaria(m, epoca); fundir(a, b)     // → estadística { n, medidas, tokens, posiciones, raiz }; fundir usa tiempo.fundir en cada medida y rechaza cortes distintos
identidadDe(eje, id)                 // → la cosa (con clave) que el propio registro da de alta; la del génesis, su autor ([X]); si no, null
hijos(eje, id); esBase(eje, ev)      // → lo escrito sobre el registro sin sus bases válidas; si un evento es una base válida
calcularBase(eje, registro, { epoca }) // → { hijos, subarbol, refsHijos, refsBases, hasta, sinBase, epoca }, sin escribir
escribirBase(eje, { registro, privada, t, epoca }) // → evento en el 8 del registro, firmado por su cosa, que gasta 1 minuto de su T
leerBase(eje, id)                    // → la vigente (la última llegada), con anteriores y frescura { t, hijosNuevos, basesNuevas, debajo, sinNovedades }, o null
comprobar(eje, base, { epoca })      // → { alDia, diferencias }: recalcula y compara, bajando por las bases fundidas que siguen vigentes
situar(eje, foco, { alcance, epoca }) // → la forma de tiempo.confluir leída del 8 (medidas, tokens, posiciones, raiz), más incluido y cambiadas
valorDeBases(eje, id, args)          // → lo que devuelve BASES() en BQL
```

| Paso | Quién | `sobre` / `en` | `contexto` | Mueve |
|---|---|---|---|---|
| escribir una base | la propia cosa del registro (`identidadDe`), firmando | el registro / `CIELO` | `{ bases: true, n, nSubarbol, hasta, epoca, sinBase }` | `COSTE_BASE`: 1 minuto de su T ([X] coste) |

- **Dos estadísticas por base.** `hijos`: los hijos del registro medidos uno a uno (la cohorte de hermanos de cada uno). `subarbol`: el registro y todo lo que cuelga de él (la cohorte de proyecto y la general). El subárbol funde, **sin releer registros**, el subárbol de la base vigente de cada hijo; un hijo sin base cuenta por sí mismo y, si tiene descendencia, queda en `sinBase` ([X] cómo se completa).
- **Cohortes** (las de `tiempo.comparables`). `hermanos` lee los hijos del 8 del padre; `proyecto`, el subárbol del 8 de `tiempo.proyectoDe`; `general`, el subárbol del 8 del génesis. Con los mismos cortes, `situar` da los mismos números que `confluir` (lo comprueba `test/bases.test.js`).
- **Cortes = regla de la época.** Se leen de `epoca.cortes(clave)`, con las claves de `confluir`. La época 0 no los declara: `confluir` saca entonces los de cada cohorte, que no se funden; una base usa unos provisionales fijos ([X] sus valores). Cada bloque guarda sus cortes y no se funden bloques con cortes distintos.
- **Validez.** Solo es base lo que firma en el 8 la propia cosa del registro, gastando T, con exactamente ese `contexto`, un payload coherente (cajas que suman n, extremos compatibles con la suma y con las cajas ocupadas, cortes crecientes), las referencias a **todos** los hijos llegados hasta `hasta`, en orden, y bases fundidas válidas de esos hijos. Lo demás escrito en el 8 es un hijo más: lo cuentan `escritos`, `comparar` y la confluencia.
- **Las bases no son hermanas, escritos ni comparables** de lo que miden: `tiempo.medir`, `comparar`, `comparables` y `posicionesDe` las saltan, así que escribir una base no cambia lo que mide.
- **Corregir = escribir otra base.** La anterior queda en el 8 como colisión; `leerBase` da la última y cuenta las `anteriores`.
- **Frescura y comprobación.** `frescura` cuenta lo llegado sin releer: hijos después de `hasta`, hijos cuya base vigente ya no es la fundida y lo mismo, sumado, en las fundidas (`debajo`). No ve cambios en lo ya medido; para eso, `comprobar` recalcula. `situar` dice en `cambiadas` las medidas en que el foco, medido ahora, cae en una caja vacía aunque la base lo incluya.
- **`BASES()` en BQL** (`docs/BQL.md` §7.13). `BASES()` = n de la base del 8 del anfitrión; `BASES(alcance)` = n de la cohorte; `BASES(alcance, medida)` = la caja del anfitrión; `BASES(alcance, medida, k | campo)` = una caja o un dato. La dependencia es la base leída; el gancho `puedeLeer` decide leer la base y, si hay que situarlo, el anfitrión.
- **`CAJA` y `FRESCURA` en BQL** (`docs/BQL.md` §7.14). `CAJA(medida, alcance?)` = `BASES(alcance, medida)`, con `"hermanos"` por defecto; `FRESCURA(alcance?)` = las llegadas que cuenta la frescura de la base (0 no es «al día»). Cobran lo que examina la lectura, no miden al anfitrión sin base y, sin base, el motivo dice cómo escribirla. Las fórmulas que leen el 8 sin situar a su registro hacen que una base dependa de la anterior (cuentan como pendientes o resueltas según haya base): [X] decidir VG.
- **Sin nivel ni grado.** Las diez cajas llevan las etiquetas de `HITOS` (`hito` en `situar`); nada asigna nivel ni grado.

Abiertos ([X] decidir VG, en el código y en la nota §3): cómo se identifica un registro con una identidad; los valores de los cortes provisionales; el coste de una base; la disposición del payload; «más reciente» por llegada; qué es la frescura; cómo se completa lo que cuelga de un hijo sin base; la firma de `BASES()`; si la interfaz lee solo las bases escritas y se retiran `comparar` y el cálculo al vuelo (auditoría C18).
