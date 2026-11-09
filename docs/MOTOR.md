# El motor AGRAM: el ciclo tal como existe

AGRAM es el motor: la ejecución real sobre la estructura de datos (BTML, `docs/BTML.md`) y la lógica de vistas (BQL, `docs/BQL.md`). Este documento describe **lo que existe hoy** en `src/motor.js`, `src/escritura.js`, `src/modos.js`, `src/tiempo.js`, `src/persistencia.js` y `src/bases.js`, con firmas de funciones, tablas y ejemplos ejecutados con Node 24 desde la raíz del repositorio. Lo que no existe se marca «pendiente». Fuente de verdad: esos seis módulos y `test/motor.test.js`, `test/escritura.test.js`, `test/modos.test.js`, `test/fabrica-1000.test.js`, `test/tiempo.test.js`, `test/confluencia.test.js`, `test/persistencia.test.js`, `test/bases.test.js`, `test/eprt.test.js`, `test/vector.test.js`.

Convenciones:

- Los ejemplos se ejecutan **desde la raíz del repositorio** con `node --input-type=module -e "..."` (Node ≥ 20). La salida que sigue a cada ejemplo es la salida real.
- El eje de ejemplo es `ejemplos/ikisai/compra-food.mjs` (datos inventados). Sus ids son deterministas (hash del cuerpo con `t` fijo): génesis `2d970a48`, alta `82aafc7b`, menú `ff05e68f`, compra `3147f38b`, cuenta `bcc60646`. En las salidas los ids se acortan a ocho caracteres con `corto`. Los tres documentos (`docs/BTML.md`, `docs/BQL.md` y este) citan los mismos ids; en un programa no se copian, se usan `compra.id`, `cuenta.id`… (cambian en cuanto cambia el cuerpo de un evento: pasó con la PR #18, con la PR #28, que cambió el vector que guardan las consolidaciones, y con la PR #35, que puso el génesis en series).
- Toda escritura recibe `t` explícito. `escribirDesde` y `ejecutar` usan `new Date().toISOString()` si falta, y entonces los ids no son reproducibles.
- Un «registro» y un «evento» son lo mismo. El «foco» es el registro sobre el que se trabaja. Una «consolidación» es el registro que escribe `consolidar`.

## 0. Mapa de módulos

| Módulo | Qué define | Exports |
|---|---|---|
| `src/libro.js` | La capa cero (VG, 9-11; `docs/FUNDAMENTOS.md` «La capa de transacciones»): el libro de transacciones, cinco primitivas, anclaje y memo, atomicidad y condiciones enchufables. Solo aritmética | `Libro` (`aplicar`, `probar`, `evaluar`, `asentar`, `simular`, `saldo`, `bloqueado`, `bloqueadoPorSalida`, `bloqueos`, `bloqueosCon`, `vista`, `alta`, `titulares`, `tiene`, `disponibles`, `sumas`, `asientos`), `Simulacion`, `acunar`, `transferir`, `bloquear`, `liberar`, `quemar`, `transaccion`, `PRIMITIVAS`, `EMISION`, `REPOSICION` |
| `src/condiciones/` | Las reglas de siempre como condiciones de validez de una transacción, por familias (`evento.js`, `identidad.js`, `ciclo.js`, `tope.js`, `r.js`), cada una con sus filas del inventario (`docs/notas/CAPA_CERO.md` §3) | `index.js`: `CONDICIONES`, `CONDICIONES_GENESIS`, `CONDICIONES_GENESIS_GUARDADO`, `CONDICIONES_DEL_CICLO`, `CONDICIONES_DEL_TOPE`, `CONDICIONES_DE_R`, `motivosDe`, `catalogo`, `reglasDelTope`, `erroresGenesis`, `erroresFirmaGenesis`, `contratoE`, `SIN_CAPACIDAD` |
| `src/motor.js` | El ciclo de la fábrica (PV4); la capacidad de una posición (§5.1, solo informa) | `descubrir`, `proponer`, `consolidar`, `autorizar`, `ejecutar`, `liberar`, `puedeAutorizar`, `poderParaBloquear`, `recursoDe`, `pesoAutorizacion`, `bloqueosDeP`, `autorizacionCaducada`, `autorizacionesValidas`, `estadoDe`, `esConsolidacion`, `consolidaciones`, `caminoVisible`, `capacidadDe`, `tramoDe`, `registrosEn`, `ocupacion`, `leerUmbral`, `FABRICA`, `FASES`, `OPERADORES`, `REGLA_AUTORIZAR`, `PLAZO_AUTORIZACION`, `UMBRAL_POR_DEFECTO`, `CRITERIO_CAPACIDAD` |
| `src/autorizacion.js` | La regla de autorizar (§4), pura: la leen el motor, el ciclo (R3) y la validez, cada uno con su eje | `recursoDe`, `subregistroDelDueno`, `clavesDeP`, `umbralDe`, `leerUmbral`, `alcanzaUmbral`, `pesoDe`, `estadoPorPeso`, `ejecucionesDe`, `esConsolidacion`, `lectorDelEje`, `FABRICA`, `UMBRAL_POR_DEFECTO` |
| `src/lente.js` | La lente de R (R6; `docs/FUNDAMENTOS.md` «La lente de R»): la R vale solo con la lente firmada del lector; emitir R exige colateral; devolver R es pedir atención | `declararLente`, `lenteDe`, `peso`, `valor`, `detalleValor`, `tenencia`, `anclasDeLente`, `paresDeLente`, `payloadDeLente`, `colateral`, `colateralDe`, `colateralMinimo`, `cubre`, `rPropiaEnJuego`, `reglasDeR`, `analizarR`, `SECCIONES_DE_R` (las secciones de `reglasDeR`, que `src/condiciones/r.js` envuelve), `devoluciones`, `pendientes`, `devolucionesDe`, `devolucionesEn`, `claveR`, `esSalidaDeColateral`, `POSICION_LENTE`, `COLATERAL_R`, `PARES_POR_DECLARACION` |
| `src/escritura.js` | El registro de salida de cada modo; la matriz 10×10×10 de la fábrica | `item`, `resolverRef`, `desdePointed`, `desdeSequenced`, `desdeMapped`, `ubicar`, `costeT`, `escribirDesde`, `escribirSalida`, `CLASES`, `claseDe`, `esReferencia` |
| `src/modos.js` | Mínimo y máximo por modo (los mismos para leer y emitir), proporción | `MODOS`, `nombreModo`, `maximo`, `minimo`, `alcanceDe`, `lectura`, `tope`, `escritura`, `contarPosiciones`, `cabeTope`, `cabeEscritura`, `proporcion`, `proporcionDe` |
| `src/tiempo.js` | Eje temporal (PV6/PV7), §8; reexporta de `bases.js` lo del 8 que otros módulos leían aquí (§8.3) | `banda`, `ejeTemporal`; de `bases.js`: `HITOS`, `ALCANCES`, `MEDIDAS`, `comparables`, `confluir`, `proyectoDe`, `etiquetaClave`, `SIN_BASE_ESCRITA` |
| `src/persistencia.js` | Guardar y reconstruir el eje | `serializar`, `restaurar`, `guardarLocal`, `cargarLocal`, `borrarLocal`, `apartarLocal`, `VERSION` |
| `src/bases.js` | Bases del 8: la única medida, registros fundibles en la posición 8 escritos por la propia cosa o por quien tiene P sobre ella, y su lectura por cohortes; confluir como respaldo declarado (§14) | `medir`, `posicionesDe`, `clavesDe`, `unitaria`, `fundir`, `identidadDe`, `puedeEscribirBase`, `calcularBase`, `escribirBase`, `leerBase`, `frescura`, `comprobar`, `situar`, `confluir`, `comparables`, `proyectoDe`, `valorDeBases`, `erroresDeBases`, `cajasEtiquetadas`, `hijos`, `esBase`, `basesEn`, `basePorId`, `baseDePayload`, `payloadDeBase`, `empaquetar`, `bloqueDe`, `cortesDe`, `cajaDe`, `clavesDeMedidas`, `etiquetaClave`, `estadisticaVacia`, `ALCANCES`, `CAJAS`, `CIELO`, `COSTE_BASE`, `CAMPOS_BASE`, `CAMPOS_FOCO`, `ETIQUETAS`, `HITOS`, `MEDIDAS`, `NINGUNA`, `ORIGENES_CORTES`, `SECCIONES`, `SIN_BASE_ESCRITA`, `TITULO` |

`src/index.js` reexporta `modos.js` en plano y los demás como espacios de nombres: `motor`, `salida` (= `escritura.js`), `tiempo`, `persistencia`, `bases`. Es decir: `import { motor, salida, tiempo, persistencia, lectura } from './src/index.js'`.

Debajo de todo está el libro: el eje (`src/eje.js`) es una envoltura de `src/libro.js` que traduce cada evento a una transacción (`eje.transaccion`) y la asienta con las condiciones de `src/condiciones/`; las capas de validez leen el eje de justo antes de un registro (`eje.antes(k)`) con las mismas condiciones (`docs/notas/CAPA_CERO.md`). `src/index.js` lo reexporta como los espacios de nombres `libro` y `condiciones`.

Dependencias: el motor lee el eje (`src/eje.js`), el encaje (`src/encaje.js`, `ocupantes`, `vector`, `signo`) y BQL (`src/bql.js`, `evaluar`), y escribe con `escribirDesde` y `eje.escribir`. `tiempo.js` usa `consolidaciones` del motor.

## 1. El ciclo

Cuatro pasos sobre un foco: **descubrir → consolidar → autorizar → ejecutar**, con un paso opcional entre los dos primeros: `proponer` construye las elecciones desde las fórmulas del foco (§2.1). Los tres últimos son eventos normales del eje (transiciones de tokens con payload BTML), anclados en la fábrica del foco (posición 4) y encadenados por `sobre`; por eso la evidencia es el propio hilo: ejecución → consolidación → foco → … → génesis. Nada se borra ni se modifica en sitio.

| Paso | Función | Quién | Escribe (`payload`) | `sobre` / `en` | `contexto` | Mueve |
|---|---|---|---|---|---|---|
| descubrir | `descubrir(eje, foco, { camino, posiciones, epoca, maximo })` | cualquiera | nada | — | — | nada |
| consolidar | `consolidar(eje, { autor, foco, elecciones, titulo, t, camino }, privada)` | cualquier identidad con T | `[titulo, elección 1, …, elección n]` | foco / `direccion([...camino, 4])` | `{ motor: 'fabrica', fase: 'consolidado', fuentes, encaje, modo: 'mapped' }` | T del autor: 1 minuto por posición |
| autorizar | `autorizar(eje, { autorizante, consolidacion, cantidad, t, nota, plazo }, privada)` | quien tenga P sobre el registro del recurso, el autor incluido (§4.1); queda AUTORIZADO cuando lo bloqueado alcanza el umbral del dueño | `'==' + nota` | consolidación / `FABRICA` | `{ modo: 'pointed', motor: 'fabrica', fase: 'autorizado', autoridad: { regla, recurso, bloquea, umbral, caduca } }` | T del autorizante: 1 minuto; y **bloquea** su P con la consolidación de salida |
| ejecutar | `ejecutar(eje, { autor, consolidacion, movimientos, t, titulo }, privada)` | el autor de la consolidación | `[titulo, { ref: consolidación }, { ref: autorización }]` | consolidación / `FABRICA` | `{ motor: 'fabrica', fase: 'ejecutado', evidencia: [consolidación, ...autorizaciones] }` | T del autor: 1 minuto por posición (3 con un título terminal), más `movimientos`, y libera el P que el autor bloqueó por ella (el de los demás queda liberable: `liberar`, §5) |

Constantes: `FABRICA = '4000000000'` (la posición 4 en la raíz del foco); `FASES = ['consolidado', 'autorizado', 'ejecutado']` (los valores de `contexto.fase`).

Estados de una consolidación (`estadoDe`): `PENDIENTE DE AUTORIZACIÓN` → `AUTORIZADO` → `EJECUTADO`. No se guardan: se calculan cada vez a partir de lo escrito sobre la consolidación en `FABRICA` y del P bloqueado por ella (§4, §6). Solo las consolidaciones tienen estado: para cualquier otro registro (el génesis, una nota, una autorización) `estadoDe` devuelve `undefined`.

Reglas de fondo, tal como están en el código:

- **Consolidar no es ejecutar.** La consolidación solo mueve el T de escribir; E, P y R se mueven en `ejecutar`, y solo si el autor los pasa en `movimientos`.
- **La posición no da autoridad.** Cualquiera consolida; autorizar es bloquear P sobre el registro del recurso, y la consolidación queda autorizada cuando lo bloqueado, de quien sea (el autor incluido), alcanza el umbral del dueño (VG, 7-11 noche; §4); ejecuta el autor. AARPIA, que no existe, hará la ejecución real.
- **Elegir no publica.** `ELEGIR` de BQL devuelve una colección; la única fijación es `consolidar`, y no borra alternativas: las elecciones se guardan como referencias a sus fuentes, con el vector de encaje de cada una.
- **Cada cambio tiene clase.** La fábrica parte de la matriz de 100 del foco y emite solo lo modificado, en la matriz 10×10×10 (posición × subposición × clase de modificación). La matriz es **relativa al camino**: bajo un camino de profundidad n, la clase es el dígito n + 2 de la dirección (el tercero desde el camino; sin camino, el tercero), y se lee de la dirección con el camino, `claseDe(dir, camino)` (§7.2): ni la consolidación ni la ejecución guardan un campo de clase (§3.5, §5).
- **Todo cuesta tiempo.** Cada registro mueve T del autor: un minuto por posición del registro, heredadas incluidas (cartón piedra, §7.3). Es el token `T:minuto`: cada escala de T es un token distinto, sin conversión, así que escribir exige tener minutos. Y cada modo tiene dos límites que rechazan: la proporción de siempre, que se mira primero y con el mensaje de siempre, y además un tope duro de posiciones emitidas (§7.1).

Pendiente: las seis capacidades del motor que nombra el mapa (interpretar, resolver, posicionar, comparar, calcular, componer) no existen como funciones; son nombres descriptivos.

## 2. Descubrir

```js
descubrir(eje, foco, { camino = [], posiciones = [1, 2, 3, 4], epoca, maximo = Infinity } = {})  // → [{ posicion, dir, candidatos, total, limitada, noElegibles }]
caminoVisible(ocupante)                                                // → number[]  camino de la etiqueta: el del ocupante y, si su contenido es un array con posición 0, un 0 más (solo para mostrar)
```

**Elegibilidad antes que límites** (R8; mapa §12 [D] «Quién ocupa una posición ajena»; `src/elegibles.js`). Los candidatos de `descubrir` y los que `proponer` lee por BQL son solo los ocupantes **elegibles** según el criterio del dueño del foco: lo propio, y los escritos de quien nombra su 2.3 (con `cualquiera`, todos) o, si no, los suyos y los de quien aparece en su 3, con las correcciones que el dueño ancle ahí (`docs/BQL.md` §7.4). `maximo`, `total` y `limitada` cuentan solo esos; los escritos que no lo son van en `noElegibles`, un recuento que no puntúa. Un escrito ajeno no deja de estar en el eje ni en `encaje.ocupantes`.

`descubrir` no escribe. Para cada posición de interacción (por defecto 1–4: recursos, criterios, comunicación, fábrica) devuelve la dirección `direccion([...camino, i])` y sus **candidatos**: los ocupantes de esa dirección en el foco (`encaje.ocupantes`, orden por encaje bajo la `epoca` que se elija al leer; ver `docs/BTML.md` §6) más tres campos calculados con BQL: el estado y el texto de su camino exacto, y una etiqueta para mostrarlo. Con `maximo`, entrega como mucho esos candidatos por posición (los primeros por encaje) sin presentar el corte como completo: `total` dice cuántos hay y `limitada` si se cortó.

| Campo del candidato | Origen | Contenido |
|---|---|---|
| `origen`, `tipo` | encaje | `'propio'`, `'referencia'` o `'escrito'` |
| `evento`, `dir`, `camino`, `contenido`, `procedencia` | encaje | dónde vive el contenido (`docs/BTML.md` §6.2) |
| `autor`, `t` | encaje | solo en escritos |
| `origenDir`, `destino`, `vector`, `distancia`, `acuerdo`, `signo`, `faltas`, `excedentes` | encaje | el encaje del candidato en la posición |
| `empate`, `empatados`, `justificacion` | encaje | si el encaje no lo separa de otro (y con cuántos) y el motivo del encaje en texto |
| `estado`, `texto` | `bql.evaluar(eje, evento, candidato.camino)` | `RESUELTO` / `PENDIENTE` / `INCOMPATIBLE` / `ERROR` y el texto del valor del **camino exacto** del ocupante (`docs/BQL.md` §1; mapa §12 [D]: «todos son ocupantes con su camino exacto»). Una referencia a un evento ausente no se evalúa: es `PENDIENTE` (`PENDIENTE: evento ausente del eje: <id8>`), como dice el encaje. Un elemento de una lista (`enLista`, `indice`) es un candidato aparte y muestra **su propio valor** (`LOCAL` por índice), no el de la lista entera: el menú de tres platos da tres candidatos, «ensalada», «guiso» y «fruta». |
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
  propio     fe48a3c2 camino [1] visible [1,0] · RESUELTO · [3 posiciones] · etiqueta → 7c3eb52f · exacto
  propio     fe48a3c2 camino [1,0] visible [1,0] · RESUELTO · ensalada · guiso · fruta · etiqueta ensalada · guiso · fruta · exacto
  referencia 7c3eb52f camino [1] visible [1,0] · RESUELTO · ensalada · guiso · fruta · etiqueta ensalada · exacto
  escrito    c475dae0 camino [] visible [0] · RESUELTO · [4 posiciones] · etiqueta Cuenta del menú · exacto
2 2000000000 2 candidatos
  propio     fe48a3c2 camino [2] visible [2] · RESUELTO · sin gluten · vegetariano · etiqueta sin gluten · vegetariano · exacto
  referencia 7c3eb52f camino [2] visible [2,0] · RESUELTO · sin gluten · vegetariano · etiqueta sin gluten · exacto
3 3000000000 2 candidatos
  propio     fe48a3c2 camino [3] visible [3] · RESUELTO · huesped · etiqueta huesped · exacto
  propio     fe48a3c2 camino [3] visible [3] · RESUELTO · cocina · etiqueta cocina · exacto
4 4000000000 2 candidatos
  propio     fe48a3c2 camino [4] visible [4] · RESUELTO · pagar · etiqueta pagar · exacto
  propio     fe48a3c2 camino [4] visible [4] · RESUELTO · servir · etiqueta servir · exacto
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
{"1":"14 EUR (12 EUR + 2 EUR)","2":"14 EUR (12 EUR + 2 EUR) + 15 min","3":{"ref":"c475dae0","dir":"3000000000"}}
["1:formula","2:formula","3:foco"] []
["Pago de la cuenta","14 EUR (12 EUR + 2 EUR)","14 EUR (12 EUR + 2 EUR) + 15 min",{"ref":"c475dae0","dir":"3000000000"}] · texto
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

Se escribe con `escribirDesde` en modo `mapped` (§7): `sobre = foco`, `en = direccion([...camino, 4])`, `payload = [titulo, …]`, `contexto = { motor: 'fabrica', fase: 'consolidado', fuentes, encaje, nuevos, modo: 'mapped' }`, y un solo movimiento: T del autor, un minuto por posición (las referencias heredadas cuentan). Límites de Mapped (§7.1): como mucho 1000 posiciones emitidas (el tope duro, el único que rechaza); la proporción (250–333) solo propone y avisa (VG, 7-11 noche: la proporción propone, el máximo manda). El estado inicial es `PENDIENTE DE AUTORIZACIÓN`.

```sh
node --input-type=module -e "
import { ejemploCompra, ejemploCuenta } from './ejemplos/ikisai/compra-food.mjs';
import { descubrir, consolidar, estadoDe, FABRICA } from './src/motor.js';
const corto = (x) => JSON.stringify(x).replace(/[0-9a-f]{64}/g, (m) => m.slice(0, 8));
const { eje, compra } = await ejemploCompra();
const cuenta = await ejemploCuenta(eje, compra);
const d = descubrir(eje, compra.id);
const elegida = d[0].candidatos.find((c) => c.evento === cuenta.id);
const antesT = eje.series().find((s) => s.clave === 'T:minuto').consumido; // huesped gasta su asignación del día (VG, 8-11); lo consumido cuenta aquí
const antesEUR = eje.saldo('huesped', 'E:casa/EUR');
const c = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: '2026-11-07T16:00:00Z', titulo: 'Pago del menú', elecciones: { 1: { candidato: elegida }, 2: 'sin lactosa', 4: 'pagar 14 EUR' } });
console.log(c.sobre === compra.id, c.en === FABRICA, c.autor);
console.log(corto(c.payload));
console.log(corto(c.contexto));
console.log(corto(c.movimientos), 'minutos gastados', eje.series().find((s) => s.clave === 'T:minuto').consumido - antesT, 'EUR movidos', antesEUR - eje.saldo('huesped', 'E:casa/EUR'));
console.log(estadoDe(eje, c.id));
"
```

```text
true true huesped
["Pago del menú",{"ref":"c475dae0","dir":"0000000000"},"sin lactosa",{"ref":"fe48a3c2","dir":"3000000000"},"pagar 14 EUR"]
{"motor":"fabrica","fase":"consolidado","fuentes":["c475dae0"],"encaje":[{"posicion":1,"evento":"c475dae0","tipo":"escrito","origen":"1000000000","destino":"1000000000","vector":[0,0,0,0,0,0,0,0,0,0],"signo":"exacto"}],"nuevos":[{"posicion":2,"destino":"2000000000"},{"posicion":4,"destino":"4000000000"}],"modo":"mapped"}
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
| `Mapped emite como mucho 1000 posiciones; este registro tiene <n>` | el máximo de Mapped (§7.1), el único límite que rechaza; la proporción solo propone (VG, 7-11 noche) |
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
ok ["Consolidación",["dos","menús"],{"ref":"fe48a3c2","dir":"2000000000"},{"ref":"7c3eb52f","dir":"2000000000"}] en 4000000000
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

Decisión de VG (7-11 noche, «La segunda»; R5 de `docs/notas/NEUTRALIDAD_IDENTIDAD.md`): **autorizar es bloquear P sobre el registro del recurso, con el umbral del dueño.** Sustituye la regla provisional de la #62 («autoriza quien no es el autor y tiene P > 0 sobre un registro del hilo que el autor no escribió»), que premiaba la segunda identidad: con un títere, una persona se autorizaba sola. La regla vive en `src/autorizacion.js`, un módulo puro que leen el motor, las reglas del ciclo (`src/ciclo.js`, para R3) y las capas de validez, cada uno con el eje del momento que le toca.

### 4.1 Qué P cuenta y cuándo basta

```js
recursoDe(eje, consolidacion)                  // → id de X, el registro del recurso
pesoAutorizacion(eje, consolidacion)           // → { recurso, ambito, claves, delEje, emitido, bloqueado, directo, respaldo, respaldan, umbral, necesario, alcanza }
poderParaBloquear(eje, identidad, consolidacion) // → [{ clave, ambito, cantidad }]  el P disponible de identidad que contaría al bloquearlo
respaldoParaAutorizar(eje, identidad, consolidacion) // → [{ clave, ambito, salida, cantidad }]  su P que ya respalda E del recurso y contaría si lo dice
puedeAutorizar(eje, identidad, consolidacion)  // → boolean: tiene P que cuente, disponible o respaldando E del recurso (el autor incluido)
leerUmbral(texto)                              // → { num, den, valor, texto } | null
```

Cuatro piezas:

1. **X, el registro del recurso** (VG, 8-11), es el registro **más cercano del hilo del foco** (el foco incluido) **que tenga P propio emitido** (la serie `P:X`, que solo emite su autor, R3). Manda el más concreto con poder emitido, escalón a escalón: la raíz del dominio solo manda donde nadie ha emitido P por debajo de ella, y el génesis solo donde nadie ha emitido P en todo el hilo. Así un ancestro intermedio con P propio (una habitación que la casa gobierna aparte) es el que manda sobre lo que cuelga de él. Nunca es la consolidación: se sube desde su foco. Sustituye «X = la raíz del dominio» (7-11 noche). En Booking, las dos partes de la confirmación, consolidadas sobre la reserva, suben por la habitación (sin P propio) hasta el Alojamiento de la casa, que lo tiene. **Salvedad del autor** (regla de Core tras la revisión de seguridad, **[X] confirmar VG**): quien escribe un registro puede acuñar P sobre él (R3), así que sin más el proponente escribiría un subregistro en el dominio de la casa, acuñaría P sobre él y se autorizaría solo o con un títere. Por eso, por debajo de la raíz, un registro con P propio solo cuenta como X si es de la **cadena de autoridad del dueño** (`subregistroDelDueno`, `src/autorizacion.js`): lo escribió el autor de la raíz; o lo escribió quien tiene `P:<raíz>` (disponible más bloqueado) que **alcanza el umbral de la raíz**, el mismo con que el dueño autoriza (`umbralDe`: por defecto, más de la mitad de lo emitido de `P:<raíz>`); o lo **estableció una consolidación sobre la raíz que quedó AUTORIZADA** (o ya EJECUTADA): el registro la cita en `contexto.subdominio`, lo escribe el autor de esa consolidación, y la consolidación va sobre la raíz y tiene la raíz como registro del recurso (revisión de seguridad, VG, 8-11; **[X] confirmar VG** el detalle: que también valga EJECUTADA, que el registro lo escriba el autor de la consolidación, y que deje de contar si la consolidación, sin ejecutar, vuelve a PENDIENTE). Antes bastaba `P:<raíz>` > 0: una millonésima de P delegada servía para fabricar un subdominio que se autoriza solo. Si no es de la cadena (lo escribió el proponente u otro ajeno, o un delegado por debajo del umbral), se salta y se sigue subiendo. La habitación que la casa gobierna aparte manda; la que lleva recepción con 3 de los 4 `P:<raíz>` que le delegó la casa, también; la de un delegado con una décima, no; la reserva de quien reserva, aunque acuñe P sobre ella, tampoco. Prueba: SEG-07 en `test/autorizar.test.js`. Y ampliar la serie `P:Y` cerrada de un subregistro ajeno sigue exigiendo la autorización del dominio que lo envuelve. **Para decidir VG**: el P estrechado hacia un registro antes de que su autor emita P sobre él (R3 solo lo impide hacia la raíz de un dominio) contaría después como `P:X`, por encima de lo emitido.
2. **Qué P cuenta.** Si X tiene P propio emitido (la serie `P:X`, que solo emite su autor, R3), cuenta **solo** `P:X`, medido sobre lo emitido de `P:X`: el P del génesis no cuenta. Si X es el génesis (nadie en el hilo ha emitido P), cuenta el P sobre todo el eje (`P:genesis` y `P:<id del génesis>`, el mismo ámbito), medido sobre lo emitido de los dos (propuesta de Core aceptada por VG; **[X]** si VG quiere otra cosa). El P estrechado hacia X desde un ámbito más amplio no cuenta mientras X no tenga P propio: quien quiera autorizar con el P del eje lo bloquea sin estrechar.
3. **El umbral** lo fija el dueño de X en su posición 2 (su criterio): un terminal `umbral a/b` (fracción de enteros) o `umbral 0.x` (decimal), entre 0 (excluido) y 1, en el 2 de X o en un 2.k si el 2 es un array. Con umbral declarado basta **alcanzarlo** (≥); sin él rige **más de la mitad** (estrictamente mayor que 1/2). Lo que otro ancle en el 2 de X no cuenta: es el criterio del dueño. Un `umbral …` ilegible no se adivina: rige el de por defecto y `pesoAutorizacion(…).umbral.aviso` lo dice. No es un lenguaje de criterios: es la única forma que se lee.
4. **El P que respalda E cuenta también** (VG, 8-11 madrugada, textual: «P bloqueado respaldando la E de un registro cuente también para autorizar sobre ese registro: inmovilizar poder en un recurso es ya el compromiso, y vale para las dos cosas»). El P de las claves que cuentan (pieza 2) bloqueado con salida = una serie de E atada a X o a un registro que cuelga de X, o su familia `@*` (§5.1), suma en el umbral de las consolidaciones sobre X como si estuviera bloqueado con salida = la consolidación, **sin volver a bloquearlo**. Solo el que respalda E **vivo** (emitido − consumido): es lo que lo inmoviliza (el eje no lo deja liberar mientras viva la E, `reglasDelTope` §4); un bloqueo hacia una serie que no existe, o ya consumida, se suelta cuando se quiera y no cuenta. **[X] confirmar VG**: la caducidad de la E no se mira aquí (el estado de una consolidación no depende del reloj): la E caducada deja de inmovilizar su P y, en cuanto su titular lo libera, deja de contar.

   **El acto de voluntad.** No cuenta solo: cuenta cuando su titular lo dice, con un registro suyo en la fábrica de la consolidación con `contexto.autoridad.respaldo: true` (`autorizar` lo escribe, §4.2). Es la forma más simple que cumple «ningún evento sin movimiento»: el registro mueve el T de escribirlo, como todo registro, y ningún P (no hay bloqueo nuevo). Cuenta lo que respalda en cada momento, no lo que declaró (`contexto.autoridad.respalda` es informativo), y deja de contar si lo retira con `liberar` (un registro con `contexto.libera` posterior). **[X] confirmar VG la salvedad**: sin ese acto el P que respalda no cuenta, para que respaldar plazas no autorice sin querer cualquier consolidación ajena del dominio.

Y **sin clave no se actúa** (R9, #68): fuera de un eje de demostración, `puedeAutorizar` solo da `true` a quien tiene clave registrada, y el eje rechaza que alguien sin clave bloquee P.

Una consolidación queda **AUTORIZADA** cuando el P de esas claves bloqueado con salida = la consolidación, **de cualquiera y el autor incluido**, más el P que respalda E del recurso de quienes lo dijeron (pieza 4), alcanza el umbral sobre lo emitido (`pesoAutorizacion`: `directo` + `respaldo` = `bloqueado`). Pesa la cantidad, no las cabezas: repartir el mismo P:X entre diez identidades no cambia nada, tampoco si respalda E en vez de ir bloqueado por la consolidación (`test/neutralidad.test.js`, NEU-01, NEU-02 y su propiedad; `test/p-respalda.test.js`). Sin nada emitido, nadie autoriza. `puedeAutorizar` solo dice si la identidad tiene P que cuente; poder autorizar no es bastar.

Una consecuencia que conviene ver: con el umbral por defecto, en un dominio solo puede haber **una** consolidación AUTORIZADA y sin ejecutar a la vez con el mismo P **bloqueado por ella** (cada una necesita más de la mitad). Para llevar varias en paralelo, el dueño baja el umbral en su 2, o quien autoriza libera tras ejecutar (§5). El P que respalda E es distinto: no está bloqueado por ninguna consolidación, así que el mismo vale, con un acto de voluntad en cada una, para varias a la vez, mientras siga inmovilizado respaldando la E.

**Nota de neutralidad.** Antes, R2 (la E atada al recurso, §5.1) y R5 (autorizar) competían por el mismo P:X: el P que respaldaba plazas quedaba bloqueado mientras vivieran y no quedaba P libre con el que autorizar, y Booking partía el dominio en unas «Reservas» que decidían y un «Alojamiento» que respaldaba (#70). Con la pieza 4 ya no compiten: inmovilizar P en el recurso es el compromiso de las dos, y Booking vuelve a un solo Alojamiento que respalda y decide (§5.1). Lo que se mide sigue siendo una cantidad de P:X comprometida, nunca cuántas identidades la tienen: partir ese P entre k identidades (cada una con su acto) da la misma suma, y una identidad sin P:X que respalde E vivo del recurso no suma nada aunque escriba el acto a mano.

```sh
node --input-type=module -e "
import { ejemploCompra } from './ejemplos/ikisai/compra-food.mjs';
import { consolidar, puedeAutorizar, recursoDe, pesoAutorizacion, poderParaBloquear } from './src/motor.js';
const T = '2026-11-07T16:00:00Z';
const { eje, menu, compra } = await ejemploCompra();
const gastaT = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });
const corto = (x) => JSON.stringify(x).replace(/[0-9a-f]{64}/g, (m) => m.slice(0, 8));
// La casa delega a cocina 2 P con ámbito el menú: cubre el menú, pero no es el P del registro del recurso.
await eje.escribir({ autor: 'casa', sobre: menu.id, t: T, movimientos: [gastaT('casa'), { token: 'P', cantidad: 2, ambito: menu.id, de: 'casa', a: 'cocina' }], payload: 'cocina decide sobre su menú' });
const c = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: T, elecciones: { 1: 'dos menús' } });
console.log('recurso', corto(recursoDe(eje, c.id)), '= génesis', recursoDe(eje, c.id) === eje.genesisId);
const p = pesoAutorizacion(eje, c.id);
console.log(corto({ claves: p.claves, delEje: p.delEje, emitido: p.emitido, bloqueado: p.bloqueado, umbral: p.umbral.texto, alcanza: p.alcanza }));
for (const x of ['casa', 'cocina', 'huesped']) console.log(x, puedeAutorizar(eje, x, c.id), corto(poderParaBloquear(eje, x, c.id)));
console.log('sobre algo que no existe:', puedeAutorizar(eje, 'casa', 'nadie'));
"
```

```text
recurso "6cb2ff68" = génesis true
{"claves":["P:genesis","P:6cb2ff68"],"delEje":true,"emitido":10,"bloqueado":0,"umbral":"más de la mitad","alcanza":false}
casa true [{"clave":"P:genesis","ambito":"genesis","cantidad":8}]
cocina false []
huesped false []
sobre algo que no existe: false
```

La compra cuelga del menú, que cuelga de las altas de la casa, y nadie en ese hilo ha emitido P propio: el recurso es el génesis (VG, 8-11) y cuenta el P del eje (10 emitidos por el génesis; a la casa le quedan 8 tras delegar 2 a cocina). El P de cocina, estrechado al menú, no es el del recurso.

### 4.2 Firma y registro

```js
autorizar(eje, { autorizante, consolidacion, cantidad, respaldo, t, nota = 'autorizo', plazo = PLAZO_AUTORIZACION }, privada)  // → Promise<evento>
autorizacionesValidas(eje, consolidacion)    // → evento[]  los «autorizado» en FABRICA que bloquean, de su autor, P de una clave que cuenta con la consolidación de salida, y los actos de voluntad con el P que respalda E que cuentan
autorizacionCaducada(eje, autorizacion, t)   // → boolean: lee contexto.autoridad.caduca; nada caduca solo
```

`autorizar` escribe con `eje.escribir` un registro de quien autoriza: `sobre = consolidación`, `en = FABRICA`, `payload = '==' + nota` (texto escapado para BQL), un minuto de T del autorizante y el **bloqueo**: `{ token: 'P', ambito, cantidad, de: autorizante, a: autorizante, estado: 'bloqueo', salida: consolidación }` por cada clave que cuenta, hasta `cantidad` (por defecto, todo lo que tiene disponible que cuente). `contexto = { modo: 'pointed', motor: 'fabrica', fase: 'autorizado', autoridad: { regla: REGLA_AUTORIZAR, recurso, bloquea: [{ clave, cantidad }], umbral, caduca } }`. Solo escribe si la consolidación está `PENDIENTE DE AUTORIZACIÓN`.

**Con el P que ya respalda E** (§4.1, pieza 4): si el autorizante tiene P que cuenta bloqueado respaldando E del recurso (`respaldoParaAutorizar`) y `respaldo` es `true` (lo es por defecto cuando no se da `cantidad`), el registro lo dice: `autoridad.respaldo: true` y, informativo, `autoridad.respalda: [{ clave, salida, cantidad }]`. Ese es el acto de voluntad; no bloquea nada por él. El respaldo se usa **primero**: sin `cantidad`, solo bloquea además su P disponible (todo) si con el respaldo no se alcanza el umbral; con `cantidad`, bloquea esa cantidad y usa el respaldo solo si se pide (`respaldo: true`). `liberar` retira el acto (y devuelve el P bloqueado por la consolidación, si lo hay); el P que respalda sigue bloqueado respaldando la E.

`contexto.autoridad` es el metadato de autoridad del evento (corpus: «firmante, contexto, autoridad cuando aplique»): es una declaración, y el estado se vuelve a calcular con el eje. `caduca` es el **plazo** del bloqueo: `t` más un `ciclo` (28 días) por defecto (`PLAZO_AUTORIZACION`, **[X] confirmar VG**), o `null` con `plazo: null`. Es un campo declarado, coherente con «la caducidad nunca es automática»: ni el estado lee el reloj ni nada se libera solo; `autorizacionCaducada` solo lo lee. Qué hace el motor con un bloqueo caducado es **[X] decidir VG**.

Lo que no cumple la regla **no cuenta**: un registro con `fase: 'autorizado'` que no bloquea P de una clave que cuente (ni es el acto de quien respalda E del recurso con ese P) queda en el eje (es un evento válido), pero `autorizacionesValidas` no lo devuelve y el estado no cambia. Y al revés: un bloqueo de P que cuenta con la consolidación de salida suma aunque no vaya en un registro «autorizado»; lo que decide es el P bloqueado, no el registro.

| Mensaje | Causa |
|---|---|
| `no es una consolidación: <id8>` | `consolidacion` no existe o no es una consolidación (`esConsolidacion`) |
| `<autorizante> no tiene P que cuente para autorizar: cuenta el P sobre el registro del recurso <X8> (P:<X8>)` | sin P:X disponible, donde X tiene P propio |
| `<autorizante> no tiene P que cuente para autorizar: cuenta el P sobre el registro del recurso <X8>, que no tiene P propio emitido: el P sobre todo el eje («genesis»)` | sin P del eje disponible, donde X no tiene P propio |
| `la cantidad a bloquear va de 0 (excluido) a <n>: <cantidad>` | `cantidad` fuera de lo disponible |
| `plazo de autorización inválido: <plazo> (…)` | `plazo` no es una escala de T ni `null` |
| `ya está autorizado` / `ya está ejecutado` | el estado ya no es `PENDIENTE DE AUTORIZACIÓN` |

```sh
node --input-type=module -e "
import { ejemploCompra } from './ejemplos/ikisai/compra-food.mjs';
import { consolidar, autorizar, autorizacionesValidas, estadoDe, pesoAutorizacion, FABRICA } from './src/motor.js';
import { evaluar } from './src/bql.js';
const T = '2026-11-07T16:00:00Z';
const corto = (x) => JSON.stringify(x).replace(/[0-9a-f]{64}/g, (m) => m.slice(0, 8));
const { eje, compra } = await ejemploCompra();
const c = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: T, elecciones: { 1: 'dos menús' } });
for (const autorizante of ['huesped', 'cocina']) await autorizar(eje, { autorizante, consolidacion: c.id, t: T }).catch((e) => console.log(e.message));
// Un «autorizado» escrito a mano sin bloquear P: ruido.
await eje.escribir({ autor: 'cocina', sobre: c.id, en: FABRICA, t: T, movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'cocina', a: null }], payload: '==autorizo', contexto: { fase: 'autorizado' } });
console.log('escritos en la fábrica', eje.sobre(c.id, FABRICA).length, '· válidos', autorizacionesValidas(eje, c.id).length, '·', estadoDe(eje, c.id));
// La casa bloquea 5 de sus 10: la mitad justa no basta.
await autorizar(eje, { autorizante: 'casa', consolidacion: c.id, cantidad: 5, t: T, nota: 'cinco' });
console.log('bloqueado', pesoAutorizacion(eje, c.id).bloqueado, 'de', pesoAutorizacion(eje, c.id).emitido, '·', estadoDe(eje, c.id));
const a = await autorizar(eje, { autorizante: 'casa', consolidacion: c.id, t: T, nota: 'vale' });
console.log(a.sobre === c.id, a.en, JSON.stringify(a.payload), 'BQL lo lee como', JSON.stringify(evaluar(eje, a.id, []).texto));
console.log(corto(a.movimientos));
console.log(corto({ ...a.contexto, autoridad: { ...a.contexto.autoridad, regla: '…' } }));
console.log('bloqueado', pesoAutorizacion(eje, c.id).bloqueado, '· válidos', autorizacionesValidas(eje, c.id).length, '·', estadoDe(eje, c.id), '· casa P:genesis disponible', eje.saldo('casa', 'P:genesis'), 'bloqueado', eje.bloqueado('casa', 'P:genesis'));
await autorizar(eje, { autorizante: 'casa', consolidacion: c.id, t: T }).catch((e) => console.log(e.message));
await autorizar(eje, { autorizante: 'casa', consolidacion: compra.id, t: T }).catch((e) => console.log(e.message));
"
```

```text
huesped no tiene P que cuente para autorizar: cuenta el P sobre el registro del recurso 6cb2ff68, que no tiene P propio emitido: el P sobre todo el eje («genesis»)
cocina no tiene P que cuente para autorizar: cuenta el P sobre el registro del recurso 6cb2ff68, que no tiene P propio emitido: el P sobre todo el eje («genesis»)
escritos en la fábrica 1 · válidos 0 · PENDIENTE DE AUTORIZACIÓN
bloqueado 5 de 10 · PENDIENTE DE AUTORIZACIÓN
true 4000000000 "==vale" BQL lo lee como "=vale"
[{"token":"T","escala":"minuto","cantidad":1,"de":"casa","a":null},{"token":"P","ambito":"genesis","cantidad":5,"de":"casa","a":"casa","estado":"bloqueo","salida":"76bc51ef"}]
{"modo":"pointed","motor":"fabrica","fase":"autorizado","autoridad":{"regla":"…","recurso":"6cb2ff68","bloquea":[{"clave":"P:genesis","cantidad":5}],"umbral":"más de la mitad","caduca":"2026-12-05T16:00:00.000Z"}}
bloqueado 10 · válidos 2 · AUTORIZADO · casa P:genesis disponible 0 bloqueado 10
ya está autorizado
no es una consolidación: fe48a3c2
```

### 4.3 R3: P:X es una serie cerrada

Decisión de VG (7-11 noche), en `src/ciclo.js` (la usan el eje al validar y la capa 5 con el libro de su momento):

- `P:X` la emite **una sola vez** el autor de X (en su primera emisión; varios movimientos del mismo evento son la misma). Sobre el génesis, `P:genesis` (el del génesis) y `P:<id del génesis>` son la misma serie: lo que emitió el génesis ya la abrió.
- **Ampliarla** es ejecutar una consolidación sobre X que esté `AUTORIZADA` por esta misma regla: la emisión va en los `movimientos` de `ejecutar`, y solo vale si justo antes la consolidación estaba autorizada y sin ejecutar (`P:<X8> es una serie cerrada: ya la emitió su autor, y ampliarla es ejecutar una consolidación sobre <X8> que esté AUTORIZADA (R3)`).
- Quien recibe P solo lo **delega** (repartiendo: el eje debita del ámbito exacto y, si no alcanza, de los que lo cubren, `#planDebitoP`) o lo **bloquea**. Estrechar hacia un registro (tomar de un ámbito más amplio para dar P con el ámbito de X) crearía `P:X` que no viene de su emisión, así que no vale hacia una serie cerrada, y hacia la **raíz de un dominio** solo lo hace su autor (**[X] confirmar VG**). Hacia un registro que no es raíz sigue libre: ese P no autoriza nada.

`test/ciclo-eprt.test.js` («R3: P:X la emite una sola vez su autor…», NEU-04) y `test/propiedades-2.test.js` (el modelo independiente) lo prueban.

## 5. Ejecutar

```js
ejecutar(eje, { autor, consolidacion, movimientos = [], t, titulo = 'Ejecutado' }, privada)  // → Promise<evento>
liberar(eje, { titular, consolidacion, t, nota = 'libero' }, privada)                     // → Promise<evento>  devuelve al disponible el P que titular bloqueó por la consolidación
bloqueosDeP(eje, identidad, consolidacion)                                               // → [{ clave, ambito, cantidad }]  su P bloqueado con esa salida
```

**Liberación** (VG, 7-11 noche). El eje solo deja liberar al titular (nadie mueve tokens ajenos), así que la ejecución libera en el mismo evento el P que **su autor** había bloqueado por la consolidación (si lo había: el autor cuenta como cualquiera), y el de los demás queda **liberable**: cada titular lo recupera con `liberar`, un registro suyo en la fábrica de la consolidación (`payload = '==' + nota`, un minuto de T, `contexto = { modo: 'pointed', motor: 'fabrica', libera: consolidación }`) que lleva la liberación `{ token: 'P', …, estado: 'liberacion', salida: consolidación }`. `liberar` sirve también para **retirar** una autorización antes de que se ejecute (R5: «quien bloqueó puede retirarlo antes de ejecutar»): si la suma baja del umbral, la consolidación vuelve a `PENDIENTE DE AUTORIZACIÓN` y `ejecutar` la rechaza. Y para un bloqueo caducado (§4.2): nada lo libera solo.

**El P que respalda E no se libera al ejecutar** (VG, 8-11): el que contó por el acto de voluntad (§4.1, pieza 4) no está bloqueado por la consolidación, sino con la salida = una serie de E (o su familia), así que la ejecución no lo toca, y el eje no deja soltarlo mientras viva la E. Sigue respaldándola, y vale para la siguiente consolidación con otro acto. `liberar` sobre la consolidación solo retira el acto.

Condiciones, en este orden: la consolidación existe y tiene `fase: 'consolidado'`; `autor` es el autor de la consolidación; el estado es `AUTORIZADO` (ni pendiente ni ejecutado): el P bloqueado por ella alcanza el umbral **ahora**, no solo cuando se autorizó. La capacidad de una posición no se cuenta aquí: la limita una serie de tokens que la ejecución mueve, y sin saldo el eje rechaza (§5.1). Entonces escribe **directamente con `eje.escribir`** (no pasa por `escribirDesde`: sin `contexto.modo`, sin comprobar proporción ni tope):

- `sobre = consolidación`, `en = FABRICA`, `t` (si falta, el reloj);
- `payload = [titulo, { ref: consolidación }, { ref: autorización }]`, donde la autorización es la **primera** de `autorizacionesValidas` (si el P se bloqueó fuera de un registro «autorizado», no hay ninguna y el payload es `[titulo, { ref: consolidación }]`);
- `movimientos = [{ token: 'T', escala: 'minuto', cantidad: contarPosiciones(payload), de: autor, a: null }, ...movimientos, ...liberaciones]` (un minuto por posición escrita, como todo registro de salida: 3 con un título terminal; y la liberación del P que el autor bloqueó por ella): aquí se mueven los tokens reales (E, P, R, más T). Si la consolidación es una ampliación de `P:X` (§4.3), la emisión va aquí. Como en todo evento, cada movimiento debe salir del autor (`de === autor`) y su saldo debe cubrirlo; si no, el eje rechaza el evento entero y nada cambia;
- `contexto = { motor: 'fabrica', fase: 'ejecutado', evidencia: [consolidación, ...autorizaciones] }`, con todas las de `autorizacionesValidas`. Sin clase: la de un registro se lee de su dirección con el camino desde el que se escribe (`claseDe(en, camino)`, §7.2), y `FABRICA`, sin camino, es la celda `4.0.0`, de clase 0, aunque ejecutar sea una acción (**[X] decidir VG**, §3.5).

| Mensaje | Causa |
|---|---|
| `no es una consolidación: <id8>` | no existe o no tiene fase `'consolidado'` |
| `ejecuta el autor de la consolidación: <autor>` | otro autor |
| `PENDIENTE DE AUTORIZACIÓN` | el P bloqueado por ella no alcanza el umbral (nunca lo alcanzó, o se retiró) |
| `ya ejecutado` | ya hay ejecución válida |
| `evento rechazado: …` | lo que rechace el eje (`nadie mueve tokens ajenos`, `saldo insuficiente…`; también una plaza sin token esa noche, §5.1) |

```sh
node --input-type=module -e "
import { ejemploCompra, ejemploCuenta } from './ejemplos/ikisai/compra-food.mjs';
import { consolidar, autorizar, ejecutar, liberar, estadoDe, consolidaciones } from './src/motor.js';
const T = '2026-11-07T16:00:00Z';
const corto = (x) => JSON.stringify(x).replace(/[0-9a-f]{64}/g, (m) => m.slice(0, 8));
const { eje, compra } = await ejemploCompra();
await ejemploCuenta(eje, compra);
const c = await consolidar(eje, { autor: 'huesped', foco: compra.id, t: T, titulo: 'Pago del menú', elecciones: { 1: 'un menú', 4: 'pagar 14 EUR' } });
await ejecutar(eje, { autor: 'huesped', consolidacion: c.id, t: T }).catch((e) => console.log(e.message));
const a = await autorizar(eje, { autorizante: 'casa', consolidacion: c.id, t: T });
await ejecutar(eje, { autor: 'casa', consolidacion: c.id, t: T }).catch((e) => console.log(e.message));
await ejecutar(eje, { autor: 'huesped', consolidacion: c.id, t: T, movimientos: [{ token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 14, de: 'cocina', a: 'huesped' }] }).catch((e) => console.log(e.message));
const antes = [eje.saldo('cocina', 'E:casa/EUR'), eje.saldo('huesped', 'E:casa/EUR'), eje.series().find((s) => s.clave === 'T:minuto').consumido]; // huesped gasta su asignación del día (VG, 8-11)
const e = await ejecutar(eje, { autor: 'huesped', consolidacion: c.id, t: T, titulo: 'Pagado', movimientos: [{ token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 14, de: 'huesped', a: 'cocina' }] });
console.log(e.sobre === c.id, e.en, corto(e.payload));
console.log(corto(e.contexto), corto(e.movimientos));
console.log('cocina EUR', antes[0], '→', eje.saldo('cocina', 'E:casa/EUR'), '· huesped EUR', antes[1], '→', eje.saldo('huesped', 'E:casa/EUR'), '· minutos consumidos en el eje', antes[2], '→', eje.series().find((s) => s.clave === 'T:minuto').consumido);
console.log(estadoDe(eje, c.id), '· hilo:', eje.hilo(e.id).map((x) => x.id.slice(0, 8)).join(' → '));
console.log('evidencia:', e.contexto.evidencia[0] === c.id, e.contexto.evidencia[1] === a.id);
await ejecutar(eje, { autor: 'huesped', consolidacion: c.id, t: T }).catch((e) => console.log(e.message));
// El P que bloqueó la casa queda liberable: solo ella lo libera.
console.log('casa P:genesis disponible', eje.saldo('casa', 'P:genesis'), '· bloqueado por la consolidación', eje.bloqueado('casa', 'P:genesis', c.id));
const l = await liberar(eje, { titular: 'casa', consolidacion: c.id, t: T });
console.log(corto(l.movimientos[1]), corto(l.contexto), '· casa P:genesis disponible', eje.saldo('casa', 'P:genesis'));
console.log(corto(consolidaciones(eje, compra.id)));
"
```

```text
PENDIENTE DE AUTORIZACIÓN
ejecuta el autor de la consolidación: huesped
evento rechazado: nadie mueve tokens ajenos: cocina no es el autor
true 4000000000 ["Pagado",{"ref":"58e06d3b"},{"ref":"8e3ebcb4"}]
{"motor":"fabrica","fase":"ejecutado","evidencia":["58e06d3b","8e3ebcb4"]} [{"token":"T","escala":"minuto","cantidad":3,"de":"huesped","a":null},{"token":"E","emisor":"casa","denominacion":"EUR","cantidad":14,"de":"huesped","a":"cocina"}]
cocina EUR 12 → 26 · huesped EUR 48 → 34 · minutos consumidos en el eje 10 → 13
EJECUTADO · hilo: 272fbbf7 → 58e06d3b → fe48a3c2 → 7c3eb52f → 3399a980 → 6cb2ff68
evidencia: true true
ya ejecutado
casa P:genesis disponible 0 · bloqueado por la consolidación 10
{"token":"P","ambito":"genesis","cantidad":10,"de":"casa","a":"casa","estado":"liberacion","salida":"58e06d3b"} {"modo":"pointed","motor":"fabrica","libera":"58e06d3b"} · casa P:genesis disponible 10
[{"id":"58e06d3b","autor":"huesped","t":"2026-11-07T16:00:00Z","titulo":"Pago del menú","estado":"EJECUTADO","fuentes":[]}]
```

El hilo de la ejecución es la evidencia: ejecución → consolidación → compra → menú → alta → génesis.

Dos consecuencias de «ejecuta el autor» y «nadie mueve tokens ajenos»:

- **Un intercambio no cabe en una ejecución.** En una reserva, las plazas (serie limitada de E, `docs/BTML.md` §2.4) las tiene quien las respalda o la habitación a quien se las dio, y el pago lo tiene la persona huésped: cada parte consolida y ejecuta lo suyo (la habitación o la casa entrega la plaza de cada noche; la persona huésped paga), sin atomicidad. Meter el pago en la ejecución de la otra parte se rechaza (`nadie mueve tokens ajenos: <huésped> no es el autor`). Si quien entrega no tiene ya el token de alguna noche (otra reserva solapada se lo llevó), el eje rechaza la ejecución entera: `evento rechazado: saldo insuficiente de E:<emisor>/<plaza>@<noche> en <autor>`. [X] decidir VG: la ejecución de dos partes mientras AARPIA no exista (mapa §12).
- **Una ejecución rechazada no deja rastro.** El eje no guarda el evento rechazado, así que la consolidación sigue `AUTORIZADO` aunque ya no pueda ejecutarse: el estado no distingue «a la espera» de «imposible» (no hay rechazar ni caducar, §12).

### 5.1 Capacidad: cuántos ocupantes de una posición pueden ser válidos

Decisión de VG (7-11, «las dos cosas a la vez»): una posición admite muchos ocupantes (colisiones: se escriben y se ven todos), y puede declarar una **capacidad**: cuántos de ellos pueden ser **válidos** a la vez. Quien la hace cumplir es una **serie limitada de tokens E** que emite quien respalda la posición: en Booking, la casa emite `E:casa/<plaza>@<noche>`, un token por plaza y noche, tantos como capacidad, y ejecutar la reserva los mueve de la casa a la persona huésped. Una segunda reserva solapada se escribe y colisiona, pero su ejecución no pasa: la casa ya no tiene el token de esa noche (`evento rechazado: saldo insuficiente de E:casa/…@<noche> en casa`). La fábrica no cuenta nada: el contador de este apartado es **informativo** (para la interfaz y para saber cuántos tokens emitir).

**La capacidad de un registro sí la hace cumplir el eje** (VG, 7-11 noche; R2 del estudio de neutralidad; `eje.reglasDelTope`, detalle en `docs/FUNDAMENTOS.md`, «E atada al recurso, con tope compartido»). La misma forma (un entero positivo en la posición 2), en el **payload raíz de un registro**, es el tope del E vivo de las series atadas a él y a sus descendientes (`registro` en la serie: `E:casa/1100000000@<noche>@<habitación>`), **por franja**: lo que va tras la última `@` de la denominación (la noche), sumando todas las denominaciones y todos los emisores de esa franja. La franja es texto opaco (el eje no interpreta fechas) y su granularidad la elige quien respalda el recurso; sin `@`, una sola franja. Cada serie emite en proporción al P bloqueado con su clave (o la de su familia, la franja `*`) como salida, y ese P no se libera mientras viva. Por eso `capacidadDe` vive ahora en `src/tokens.js` y el motor la reexporta. En Booking, el alojamiento (la raíz del dominio) declara 4 plazas y su P:Alojamiento (4) respalda una cama cada uno para todas las noches: la casa la de matrimonio y recepción, con el P que le delegó la casa, la individual y la litera (coemisora de sus series); son catorce noches de 4: nadie añade una quinta plaza en una noche, aunque otra tenga sitio; cada noche caduca a la salida del día siguiente. La capacidad de una **posición** (la plaza 1.k) sigue siendo solo informativa: el eje mira la del registro.

**[X] decidir VG** (auditoría de ajuste 2, A2-07): la corrección de VG sobre titulares (mapa §12 [D], 7-11 tarde) dice que «una persona emite los tokens de plaza de una habitación y se los da a la habitación; la habitación los conserva y los maneja». El ejemplo sigue la decisión de mediodía (mapa §12 [D] «Capacidad y tokens casan»: «mover esos tokens de la casa al huésped»): la serie se queda en la cartera de la casa, `libres` lee el saldo de la casa y la entrega la consolida y ejecuta la casa. Para pasar a la habitación hace falta decidir cómo se liga el registro de la habitación con la identidad (una cosa) que es titular de sus plazas, y quién consolida y ejecuta la entrega en su nombre; con eso, la casa emitiría y movería la serie a la habitación en el mismo evento (docs/FUNDAMENTOS.md: «para darla se mueve después, en el mismo evento si quiere»).

```js
CRITERIO_CAPACIDAD = 2                 // dónde declara una décupla (una posición o el payload de un registro) su capacidad; de src/tokens.js
capacidadDe(nodo)                       // → entero positivo en nodo[2], o undefined; de src/tokens.js
tramoDe(eje, id)                        // → { inicio, fin, extremos, texto, desde }: el 7 del registro como [inicio, fin), escrito como décupla `[[inicio], [fin]]`; sin 7 o ilegible (también una lista de dos hojas, que son dos ocupantes), error
registrosEn(eje, sobre, dir)            // → eventos anclados en la posición o que la referencian desde donde estén, por llegada
ocupacion(eje, id)                      // → [{ sobre, dir, camino, capacidad, tramo, validos, aLaVez, cabe }]: solo informa
```

- **Declaración** (`[X] decidir VG`): la décupla de la posición lleva un entero positivo en su criterio (subposición 2: «cuántos caben»), como una plaza `[nombre, precio, capacidad]` bajo la época 0. Sin ese entero la posición no declara nada.
- **Qué posición ocupa un registro**: la de su anclaje (`sobre` + `en`). La dirección nombra la colisión entera (§12 del mapa: `1000000000` es a la vez `[1]`, `[1.0]`, `[1.0.0]`), así que se mira cada camino que nombra y cuenta el que declare capacidad. Al contar a los demás, entran también los que **referencian** la posición desde otro anclaje (`registrosEn`): ninguno escapa al contador por elegir otro `en`.
- **Tramo** (`[X] decidir VG`): una décupla `[[inicio], [fin]]` en ISO (cada posición entre corchetes, la forma canónica; `[[inicio], fin]` sigue valiendo), con el fin excluido (la noche de la salida no se ocupa), en el 7 del registro. Por hojas, `[inicio, fin]` es una lista de dos ocupantes, no un tramo: `tramoDe` no la lee como par y el error lo dice. El 7 es una colisión: vale lo propio (`payload[7]`) o lo que el **autor** del registro ancle en su 7 («lo lejano = anclaje»: se llega al 7 sin rellenar 5 y 6); manda el primero por encaje y llegada. Un tramo es acotado: con capacidad, sin 7 o ilegible es error. Un ocupante ya válido sin tramo legible cuenta como todo el tiempo.
- **Cuántos a la vez**: los otros registros de la posición con consolidación ejecutada que se solapan con el tramo, y el máximo que coincide en un mismo instante (barrido por los inicios). Con capacidad 2, dos estancias encadenadas y una tercera que las cruza caben; una cuarta que coincide con dos, no.
- `ejecutar` **no** consulta `ocupacion`.

Lo que no hace el motor: mover tokens de dos partes en un solo acto. El motor V0 ejecuta solo el autor de la consolidación y nadie mueve tokens ajenos, así que Booking confirma con **dos consolidaciones** sobre la reserva, autorizadas por recepción con el P:Alojamiento que ya respalda la individual y la litera (3 de 4, más de la mitad: el Alojamiento es la raíz del dominio y el registro del recurso, §4; VG, 8-11: ese P respalda y decide, y ejecutar no lo suelta): la casa entrega los tokens de plaza y después la persona huésped paga (`ejemplos/ikisai/reserva-booking.mjs`, `[X] decidir VG`; la atomicidad es de AARPIA).

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
| `AUTORIZADO` | si no, el P bloqueado con salida = la consolidación, en las claves que cuentan, alcanza el umbral sobre lo emitido (`pesoAutorizacion(…).alcanza`, §4.1) |
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

La unidad de cuenta es la **posición con contenido** (VG, 7-11 noche, decisión 10.1: «lo leído se cuenta por lo que hay»; `contenido(payload)`, con `contarPosiciones` como alias): cada terminal, referencias incluidas, cuenta una; cada ocupante de una lista, uno; un array, la suma de las suyas. La misma medida vale para leer y para emitir. Cada modo tiene estas cifras:

- el **máximo** o **tope duro** (VG, 7-11-2026; confirmado VG, 7-11 noche): cuántas posiciones puede **emitir** de una vez, y es el mismo máximo que el de **representar**: «todo lo que no se pueda representar realmente no se puede alterar y por lo tanto no tiene sentido emitirlo». `maximo(modo)`; `tope` es alias, y `lectura` da la misma cifra como capacidad representativa (la base de la proporción). Es **el único límite que rechaza** (`cabeTope`, la regla dura). Lo comprueban `escribirDesde` y `escribirSalida` (y por tanto `consolidar` y `autorizar`) sobre lo emitido: las referencias de relleno heredadas del foco no se emiten («se emiten solo las décuplas modificadas», mapa §12) y no cuentan cuando la escritura sabe cuáles son (§7.3);
- el **mínimo** (VG, 7-11 noche): lo que el modo intenta representar y emitir (Pointed 1, Sequenced 10, Mapped 100, Scened 1000; Be no tiene: responde exactamente lo que se le pide, VG 7-11 noche, y sus tres números son conseguido, pedido y máximo). No rechaza: lo emitido por debajo se escribe y se informa con `alcanceDe` (`{ conseguido, minimo, maximo, alMinimo }`): `escribirSalida` lo devuelve en `alcance` y, para el evento de `escribirDesde`, `alcanceDeRegistro(evento)` (§7.3). Detalle y cita en `docs/MODOS.md` §0;
- la **proporción** de escritura sobre lectura (VG, 6-11-2026): desde la decisión 10.3 (VG, 7-11 noche: **la proporción propone, el máximo manda**) ya no es tope, sino **lo que la fábrica propone por defecto**, el tamaño normal de lo escrito respecto de lo leído: `escritura(modo)` o su alias `propuesta(modo)` (Pointed `[1, 1]`, Sequenced `[10, 20]`, Mapped `[250, 333]`). Se mide sobre **todas las posiciones del registro**, lo heredado incluido. Lo que se sale de ella **se escribe y se avisa**, nunca es error: `proporcionDe(posiciones, modo)` da `{ posiciones, rango, estado, aviso }`, con `aviso` en texto fuera de la proporción (`Sequenced propone escribir de 10 a 20 posiciones (la proporción sobre lo leído); esto tiene 21, por encima. No es error: la proporción propone, el máximo (100) manda.`) y `null` dentro o sin fijar. `escribirSalida` lo devuelve en `proporcion` y en `avisos`; para el evento de `escribirDesde`, `proporcionDeRegistro(evento)`. `cabeEscritura` solo informa.

Antes del 7-11 noche se miraba primero la proporción y rechazaba (`pointed escribe como mucho 1 posiciones; …`); ese mensaje ya no existe. Hoy el único rechazo de límites es el del máximo: `<Modo> emite como mucho <tope> posiciones; <qué> tiene <n>` (treinta posiciones en Pointed: `Pointed emite como mucho 10 posiciones; este registro tiene 30`). La matriz entera de la fábrica (1000) cabe ya en Mapped, con el aviso de la proporción.

Quién tiene en cuenta los límites al ubicar: `ubicar` con modo, y por tanto `escribirDesde` con una celda, ubica **una celda**: si tiene base pero dentro del registro lo emitido no cabe en el máximo, la ancla sola (§7.3). `desdeMapped` conforma **varias celdas** y las ubica solo por la base, sin modo; `escribirSalida` mide después la salida entera y, si no cabe, la **rechaza** sin anclar nada. Con la misma celda y el mismo modo, pues, `escribirDesde` con celda puede anclarla y escribir donde `desdeMapped` + `escribirSalida` rechaza (**[X] decidir VG** si `desdeMapped` también ancla por límites, y qué celdas).

```js
MODOS                         // { pointed, sequenced, mapped, scened, be } → { nombre, orden, decuplas, proporcion: [mín, máx] | null, minimo, maximo }
nombreModo(modo)              // → 'Pointed' | 'Sequenced' | 'Mapped' | 'Scened' | 'Be'
maximo(modo)                  // → máximo duro: posiciones que el modo representa y emite como mucho de una vez (Be: Infinity)
minimo(modo)                  // → mínimo que el modo intenta representar y emitir; solo se informa (Be: null, no aplica: responde lo que se le pide)
alcanceDe(conseguido, modo)   // → { conseguido, minimo, maximo, alMinimo }: los tres números de una lectura o una emisión
lectura(modo)                 // → la capacidad representativa (décuplas × 10 = el máximo): base de la proporción, no lo que una lectura trae
tope(modo)                    // → alias de maximo: posiciones que el modo emite como mucho de una vez
escritura(modo), propuesta(modo)  // → [mínimo, máximo] que la fábrica propone según la proporción (floor de lectura × proporción), o null si no está fijada
contenido(payload)            // → posiciones con contenido: cada terminal una, cada ocupante de una lista uno; 0 si no es BTML
contarPosiciones(payload)     // → alias de contenido
recortar(payload, max), admitir(cantidades, max), avisoCorte(modo, x, y, detalle)  // → el corte duro de las vistas (docs/MODOS.md §0.2)
cabeTope(payload, modo, heredadas = [])  // → contenido(payload) − heredadas.length <= tope(modo): la regla dura; cuenta lo emitido; cada heredada es una posición de relleno
cabeEscritura(payload, modo)  // → contenido(payload) <= máximo de la propuesta, lo heredado incluido; true si no está fijada (solo informa)
proporcionDe(posiciones, modo)  // → { posiciones, rango: [mín, máx] | null, estado: 'por debajo' | 'dentro' | 'por encima' | 'sin fijar', aviso: texto | null }; posiciones = las del registro, lo heredado incluido
proporcion(payload, modo)     // → proporcionDe(contenido(payload), modo): cuenta todo el payload, también lo heredado, como la proporción
orden(posiciones), minimoDe(n), maximoDe(n), ordenDeEscala(escalaT)  // → los órdenes de magnitud (docs/MODOS.md §0.4)
```

| Modo | Décuplas | Mínimo (informa) | Máximo: lee y emite (rechaza; cuenta lo emitido) | Proporción (propone; fuera, avisa) | Propuesta `[mín, máx]` |
|---|---|---|---|---|---|
| `pointed` | 1 | 1 | 10 | 1/10 | `[1, 1]` |
| `sequenced` | 10 | 10 | 100 | 1/10 – 1/5 | `[10, 20]` |
| `mapped` | 100 | 100 | 1000 (la matriz 10×10×10) | 1/4 – 1/3 | `[250, 333]` |
| `scened` | 1000 | 1000 | 10000 | sin fijar (`null`) | `null` |
| `be` | — | no tiene: responde lo que se le pide (`null`, VG 7-11 noche) | todos (`Infinity`) | sin propuesta (`null`, [X]) | `null` |

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
11 false true {"posiciones":11,"rango":[10,20],"estado":"dentro","aviso":null}
pointed   {"posiciones":1,"rango":[1,1],"estado":"dentro","aviso":null}
sequenced {"posiciones":5,"rango":[10,20],"estado":"por debajo","aviso":"Sequenced propone escribir de 10 a 20 posiciones (la proporción sobre lo leído); esto tiene 5, por debajo. No es error: la proporción propone, el máximo (100) manda."}
sequenced {"posiciones":30,"rango":[10,20],"estado":"por encima","aviso":"Sequenced propone escribir de 10 a 20 posiciones (la proporción sobre lo leído); esto tiene 30, por encima. No es error: la proporción propone, el máximo (100) manda."}
mapped    {"posiciones":1000,"rango":[250,333],"estado":"por encima","aviso":"Mapped propone escribir de 250 a 333 posiciones (la proporción sobre lo leído); esto tiene 1000, por encima. No es error: la proporción propone, el máximo (1000) manda."}
scened    {"posiciones":1000,"rango":null,"estado":"sin fijar","aviso":null}
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

**Ítems de entrada** (`item`): se recorta el texto; vacío → error `ítem vacío`; `/^@([0-9a-f]{4,64})(?::([0-9]{10}))?$/i` → referencia por prefijo hexadecimal (`resolverRef`: `referencia desconocida: <p>` si ningún id empieza así, `referencia ambigua: <p>` si varios); `/^-?\d+(\.\d+)?$/` → número JS; cualquier otra cosa → la cadena tal cual (`'12 EUR'` y `'=LOCAL(1)'` son cadenas; su sentido lo pone BQL). Un `@` seguido de algo que no es hexadecimal de 4 a 64 caracteres (`'@zzzz'`, `'@ab'`, `'@ff05e68f:12'`) **es texto**, no error; `referencia demasiado corta` solo lo da `resolverRef` llamado directamente con menos de cuatro caracteres.

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

**`ubicar(eje, foco, celda, { camino, escritas, modo, contenido })`** decide entre «dentro del registro» y «anclado en la posición» para una celda objetivo (`[i]`, `[i, j]` o `[i, j, k]` bajo `camino`). `escritas` son las celdas que ya van dentro del mismo registro (cuentan como base). `en` es donde va el registro (dentro, `direccion(camino)`; anclado, la dirección de la celda) y `dir`, donde cae la celda en los dos casos: `direccion([...camino, ...celda])`, de clase `claseDe(dir, camino)`. **Con `modo`**, tiene en cuenta sus límites (§7.1) con `contenido` (un terminal si falta; cada una de `escritas` cuenta una posición): si la celda tiene base pero lo emitido dentro del registro (sus `escritas` y ella) no cabría en el máximo del modo, la ancla sola y lo dice en `motivo` (`Pointed emite como mucho 10 posiciones; dentro, el registro tiene 11`); si ni sola cabe, error (`… esta celda tiene <n>`). La proporción no ancla ni rechaza (VG, 7-11 noche: la proporción propone, el máximo manda). Sin `modo` solo mira la base: así ubica `desdeMapped`, cuya salida se mide entera al escribirla (y se rechaza si no cabe). No escribe nada.

**`escribirDesde`** escribe **un** registro en `sobre` + `en` (`en` vale por defecto `direccion(camino)`: la raíz sin camino). Comprueba el **límite** del modo (§7.1): el **tope duro** sobre lo **emitido** (`<Modo> emite como mucho <tope> posiciones; este registro tiene <n>`); la **proporción** ya no rechaza: lo que se sale de ella se escribe y lo dice `proporcionDeRegistro(evento).aviso` (VG, 7-11 noche: la proporción propone, el máximo manda). Con `heredadas` (las de `desdeMapped`), esas posiciones son relleno y no cuentan para el tope; cada una ha de ser una referencia al foco en su dirección bajo `camino`, y el foco ha de tener contenido en ese camino exacto (`la heredada <h> no es una referencia al foco en <dir>`, `la heredada <h> no alcanza nada en el foco: solo se hereda lo que el foco tiene`, `heredada no válida: <h>`); quedan en `contexto.heredadas`. Con `heredadas`, el registro va en `direccion(camino)`, como con `celda`: otro `en` se rechaza (`con heredadas, el registro va en <dir del camino> (la dirección de su camino), no en <en>`). Sin `heredadas`, todo el payload cuenta como emitido. Añade `contexto.modo` al contexto que se le pase y escribe con `eje.escribir` un solo movimiento: `{ token: 'T', escala: 'minuto', cantidad: costeT(payload), de: autor, a: null }` (el coste sí cuenta el relleno). Con **`celda`**, `payload` es el contenido de esa celda del foco `sobre` y se ubica con `ubicar` **con el modo**: dentro, se envuelve en la matriz (con lo anterior heredado por referencia, apuntado en `contexto.heredadas`); anclado (sin base, o porque dentro no cabría), se escribe tal cual. El registro va en el `en` de `ubicar` y la celda cae en su `dir`; otro `en` se rechaza (`la celda <i.j.k> cae en <dir>: el registro va en <en de ubicar>, no en <en>`). `payload` nulo → `nada que escribir en el registro…`; todo heredado → `nada que emitir: todo el registro es herencia del foco`. Si el `payload` viene de `desdeMapped` y dejó celdas ancladas, escribirlo solo las perdería: se rechaza con `<n> celda(s) sin base en el foco se ancla(n) aparte (<i.j.k> en <dir>, …): escribe la salida entera con escribirSalida`. El aviso va con el objeto `payload` que devolvió `desdeMapped` (una copia no lo lleva) y dura hasta que `escribirSalida` ha escrito la salida entera: si `escribirSalida` falla (por ejemplo, por saldo de T), el aviso sigue.

**`escribirSalida`** escribe la salida entera de `desdeMapped`: el registro (si hay algo dentro) en `direccion(salida.camino)`, con sus `heredadas`, y cada celda anclada en su `en`. No se le pasa `en` ni `camino`: los dice la salida, para que cada celda caiga en su dirección. El tope mide **la salida entera** antes de escribir nada: lo emitido sin las heredadas (`… emite como mucho <tope> posiciones; esta salida tiene <n>`). Si no cabe, la rechaza entera: no ancla celdas por límites como `ubicar` con modo (**[X] decidir VG**, §7.1). Una salida de otro foco no pasa (sus heredadas no son referencias a `sobre`). Devuelve también `proporcion`: dónde quedan las posiciones de la salida (todas, lo heredado incluido) respecto de la proporción del modo, con su `aviso` si se sale (por debajo o por encima se escribe igual: la proporción propone, el máximo manda, VG 7-11 noche); `avisos`, los textos que la vista enseña; y `alcance`, los tres números de lo emitido (`{ conseguido, minimo, maximo, alMinimo }`, VG 7-11 noche): por debajo del mínimo del modo se escribe igual y se dice. `escribirDesde` devuelve el evento del eje (congelado y firmado); sus tres números, con `alcanceDeRegistro(evento)` (lo emitido = posiciones del registro menos `contexto.heredadas`, en el modo de `contexto.modo`). No es atómica: si el eje rechaza un anclado (por ejemplo, por saldo de T), lo anterior queda escrito.

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
["hola",12.5,-3,"12 EUR",{"ref":"7c3eb52f"},{"ref":"7c3eb52f","dir":"1000000000"},"=LOCAL(1)"]
ítem vacío
referencia desconocida: ffff
"@zzzz"
"@ab"
"@7c3eb52f:12"
{"ref":"7c3eb52f"}
referencia demasiado corta: @ab
referencia desconocida: ffff
"servido" {"ref":"7c3eb52f"}
["llegar",{"ref":"7c3eb52f"},3]
hueco en la posición 1: rellénala o quita las siguientes
la hilera está vacía
la hilera tiene más de 10 posiciones
[{"ref":"fe48a3c2","dir":"0000000000"},{"ref":"fe48a3c2","dir":"1000000000"},"sin lactosa",{"ref":"fe48a3c2","dir":"3000000000"},[["pagado"],["servido a las 14:05"]]] heredadas [0,1,3] coste 6 minutos
la 3 heredada alcanza ["huesped","cocina"] sin copiar
con camino [1]: {"payload":[{"ref":"fe48a3c2","dir":"1000000000"},"dos"],"heredadas":[0],"vistas":[],"anclados":[],"camino":[1]}
lo lejano se ancla: {"payload":null,"heredadas":[],"vistas":[],"anclados":[{"celda":[7,0,0],"en":"7000000000","payload":"más tarde","faltan":["5","6"]}],"camino":[]}
una línea «d.d» es texto: [{"ref":"fe48a3c2","dir":"0000000000"},"1.5 kg de harina"]
la décupla está vacía: ver ya es una modificación (clase 0); escribe o ve al menos una celda
```

Nota: `'@zzzz'` (no hexadecimal), `'@ab'` (corto) y `'@ff05e68f:12'` (la subposición necesita diez dígitos) no casan con la forma de referencia y se guardan como texto. Las tres referencias heredadas de la décupla cuestan un minuto cada una: el coste cuenta posiciones del registro, no solo las tecleadas (el tope no las cuenta si se le dicen las `heredadas`; la proporción sí, como antes). Las líneas de la décupla son celdas `2.0.0`, `4.0.0` y `4.1.0`; compactadas, dan la misma décupla que antes de la matriz, y una línea que empieza por `d.d ` sigue siendo texto. La posición 7 está lejos (la compra solo desarrolla 0–4): se ancla en `7000000000` en vez de rechazarse.

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
console.log('con marca: [4] =', corto(conMarca.payload?.[4] ?? null), '· anclados', corto(conMarca.anclados.map((a) => a.celda.join('.') + ' en ' + a.en)));
for (const c of [[1, 2, 4], [2, 0, 0], [7, 0, 0], [1, 5, 0]]) console.log('ubicar', c.join('.'), corto(ubicar(eje, compra.id, c)));
for (const modo of ['mapped', 'pointed']) console.log('ubicar 2.0.0 en', modo, corto(ubicar(eje, compra.id, [2, 0, 0], { modo })));
const mezcla = []; mezcla[2] = ['sin lactosa']; mezcla[7] = ['repetir el sábado'];
const salida = desdeMapped(eje, mezcla, compra.id);
console.log('salida', corto(salida));
await escribirDesde(eje, { modo: 'mapped', autor: 'huesped', sobre: compra.id, payload: salida.payload, t: T }).catch((e) => console.log(e.message));
const antes = eje.series().find((s) => s.clave === 'T:minuto').consumido; // huesped gasta su asignación del día (VG, 8-11)
const { registro, anclados, proporcion } = await escribirSalida(eje, { modo: 'mapped', autor: 'huesped', sobre: compra.id, salida, t: T });
console.log('registro en', registro.en, corto(registro.payload), JSON.stringify(registro.contexto), '· anclado en', anclados[0].en, corto(anclados[0].payload), '·', eje.series().find((s) => s.clave === 'T:minuto').consumido - antes, 'minutos ·', JSON.stringify(proporcion));
const celda = await escribirDesde(eje, { modo: 'pointed', autor: 'huesped', sobre: compra.id, celda: [9, 0, 0], payload: 'volver', t: T });
console.log('celda 9.0.0 →', celda.en, corto(celda.payload));
const postre = await escribirDesde(eje, { modo: 'mapped', autor: 'huesped', sobre: compra.id, celda: [3, 0, 0], camino: [1], payload: 'postre', t: T });
console.log('celda 3.0.0 bajo [1] en Mapped →', postre.en, corto(postre.payload), JSON.stringify(postre.contexto), '·', postre.movimientos[0].cantidad, 'minutos');
const flan = await escribirDesde(eje, { modo: 'pointed', autor: 'huesped', sobre: compra.id, celda: [3, 0, 0], camino: [1], payload: 'flan', t: T });
console.log('celda 3.0.0 bajo [1] en Pointed →', flan.en, corto(flan.payload), '·', flan.movimientos[0].cantidad, 'minutos');
await escribirDesde(eje, { modo: 'mapped', autor: 'huesped', sobre: compra.id, celda: [3, 0, 0], camino: [1], en: '4000000000', payload: 'postre', t: T }).catch((e) => console.log(e.message));
"
```

```text
0 ver/sustituir · 1 impulso de recursos · 2 criterio · 3 comunicación · 4 acción · 5 null · 6 null · 7 null · 8 null · 9 null
ver 1.2: [{"ref":"fe48a3c2","dir":"0000000000"},[[{"ref":"fe48a3c2","dir":"1000000000"}],[{"ref":"fe48a3c2","dir":"1100000000"}],[{"ref":"fe48a3c2","dir":"1200000000"}]]] · heredadas [0,"1.0","1.1"] · vistas ["1.2"]
no hay nada que ver en 2.3: el foco no tiene esa celda
no hay nada que ver en 0.5: el foco no tiene esa celda
pagar 1.2.4: {"payload":null,"heredadas":[],"vistas":[],"anclados":[{"celda":[1,2,4],"en":"1240000000","payload":"pagar 12 EUR","faltan":["1.2.0","1.2.1","1.2.2","1.2.3"]}],"camino":[]}
con marca: [4] = null · anclados ["1.2.4 en 1240000000","4.0.1 en 4010000000","4.1.0 en 4100000000"]
ubicar 1.2.4 {"ubicacion":"anclado","en":"1240000000","dir":"1240000000","faltan":["1.2.0","1.2.1","1.2.2","1.2.3"]}
ubicar 2.0.0 {"ubicacion":"dentro","en":"0000000000","dir":"2000000000","faltan":[]}
ubicar 7.0.0 {"ubicacion":"anclado","en":"7000000000","dir":"7000000000","faltan":["5","6"]}
ubicar 1.5.0 {"ubicacion":"anclado","en":"1500000000","dir":"1500000000","faltan":["1.3","1.4"]}
ubicar 2.0.0 en mapped {"ubicacion":"dentro","en":"0000000000","dir":"2000000000","faltan":[]}
ubicar 2.0.0 en pointed {"ubicacion":"dentro","en":"0000000000","dir":"2000000000","faltan":[]}
salida {"payload":[{"ref":"fe48a3c2","dir":"0000000000"},{"ref":"fe48a3c2","dir":"1000000000"},"sin lactosa"],"heredadas":[0,1],"vistas":[],"anclados":[{"celda":[7,0,0],"en":"7000000000","payload":"repetir el sábado","faltan":["5","6"]}],"camino":[]}
1 celda sin base en el foco se ancla aparte (7.0.0 en 7000000000): escribe la salida entera con escribirSalida
registro en 0000000000 [{"ref":"fe48a3c2","dir":"0000000000"},{"ref":"fe48a3c2","dir":"1000000000"},"sin lactosa"] {"modo":"mapped","heredadas":[0,1]} · anclado en 7000000000 "repetir el sábado" · 4 minutos · {"posiciones":4,"rango":[250,333],"estado":"por debajo","aviso":"Mapped propone escribir de 250 a 333 posiciones (la proporción sobre lo leído); esto tiene 4, por debajo. No es error: la proporción propone, el máximo (1000) manda."}
celda 9.0.0 → 9000000000 "volver"
celda 3.0.0 bajo [1] en Mapped → 1000000000 [{"ref":"fe48a3c2","dir":"1000000000"},{"ref":"fe48a3c2","dir":"1100000000"},{"ref":"fe48a3c2","dir":"1200000000"},"postre"] {"modo":"mapped","heredadas":[0,1,2]} · 4 minutos
celda 3.0.0 bajo [1] en Pointed → 1000000000 [{"ref":"fe48a3c2","dir":"1000000000"},{"ref":"fe48a3c2","dir":"1100000000"},{"ref":"fe48a3c2","dir":"1200000000"},"flan"] · 4 minutos
la celda 3.0.0 cae en 1300000000: el registro va en 1000000000, no en 4000000000
```

Lectura:

- `ver 1.2`: ver el precio emite una referencia a él (`1200000000`) y hereda por referencia lo anterior (la posición 0 y las subposiciones 1.0 y 1.1): cuatro posiciones, una emitida. Ver lo que la compra no tiene (2.3, 0.5) se rechaza.
- `pagar 1.2.4`: el precio (`'EUR 12'`) es un terminal y no tiene clases 0–3 que heredar: el pago se ancla en `1240000000`, un registro de una posición.
- `con marca`: `'@:0.1 con tarjeta'` fija la subposición 0 con clase 1 (impulso de recursos), así que `'pagado'` va a la subposición libre siguiente, la 1, y `4.0` se hereda (`4000000000`). La clase 1 de `4.0` (que es `'pagar'`, un terminal) no tiene base y se ancla en `4010000000`, igual que `@:2.4` en `1240000000`. Sin la marca `@:`, las líneas serían texto, como antes.
- `ubicar 2.0.0 en mapped / en pointed`: la celda tiene base (la compra tiene 0 y 1). En Mapped y en Pointed cabe dentro: serían 3 posiciones (dos heredadas y la celda) y una emitida, dentro del máximo de los dos; que Pointed proponga 1 no ancla nada (VG, 7-11 noche: la proporción propone, el máximo manda).
- `ubicar 1.5.0`: la posición 1 de la compra tiene subposiciones 0–2; la 5 está lejos (faltan 1.3 y 1.4) y se ancla en `1500000000`.
- `salida`: la posición 2 cabe dentro; la 7 se ancla. `escribirDesde` con solo el payload la perdería y se rechaza; `escribirSalida` escribe el registro (3 posiciones, `contexto.heredadas` = `[0, 1]`) y el anclado (1): cuatro minutos. Lo emitido son 2 posiciones (lo escrito, no lo heredado: lo que cuenta el tope); la proporción cuenta las 4 posiciones de la salida, la deja por debajo de lo que propone (250) y lo avisa, sin rechazar. Lo anclado es un ocupante escrito de `7000000000` en la compra (`docs/BTML.md` §6).
- `celda 3.0.0 bajo [1]`: bajo la posición 1 de la compra la celda tiene base. En Mapped va dentro: el registro va en `1000000000` (la dirección del camino) y el postre cae en `1300000000`, como dice `ubicar`; cuatro posiciones y cuatro minutos, una sola emitida. En Pointed también va dentro (una emitida cabe en su máximo, 10; la proporción, 1, solo avisa): el flan va en `1000000000` con sus tres heredadas, cuatro minutos. Pedirle otro `en` se rechaza.

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
"
```

```text
celda 1.2.4 bajo [] → anclado en 1240000000 · cae en 1240000000 · clase 4 (desde la raíz 4)
celda 2.4.0 bajo [1] → anclado en 1240000000 · cae en 1240000000 · clase 0 (desde la raíz 4)
celda 0.1.0 bajo [1] → anclado en 1010000000 · cae en 1010000000 · clase 0 (desde la raíz 1)
celda 7.3.4 bajo [1] → anclado en 1734000000 · cae en 1734000000 · clase 4 (desde la raíz 3)
celda 1.0.4 bajo [1,2] → anclado en 1210400000 · cae en 1210400000 · clase 4 (desde la raíz 1)
salida bajo [1]: registro en 1000000000 [{"ref":"fe48a3c2","dir":"1000000000"},{"ref":"fe48a3c2","dir":"1100000000"},{"ref":"fe48a3c2","dir":"1200000000"},"postre"] · anclado en 1204000000 clase 4
génesis (terminal): [{"ref":"6cb2ff68","dir":"0000000000"},"algo"] · heredadas [0] · la 0 alcanza "Casa de ejemplo"
```

Lectura: pagar el precio desde la raíz es la celda `1.2.4` (clase 4); la misma dirección `1240000000`, leída bajo `[1]`, es la celda `2.4.0`, de clase 0. Bajo `[1]`, `@:0.4 pagar 12 EUR` en la posición 2 es la celda `2.0.4`: cae en `1204000000` y su clase, leída desde `[1]`, es 4 (desde la raíz sería 0). El génesis y el precio son terminales: escribir en su posición 1 hereda la 0, cuya dirección alcanza el terminal (como en `main`; **[X] decidir VG**, §7.2).

```sh
node --input-type=module -e "
import { ejemploCompra } from './ejemplos/ikisai/compra-food.mjs';
import { escribirDesde, desdeSequenced } from './src/escritura.js';
const T = '2026-11-07T16:00:00Z';
const { eje, compra } = await ejemploCompra();
const antes = eje.series().find((s) => s.clave === 'T:minuto').consumido; // huesped gasta su asignación del día (VG, 8-11)
const p = await escribirDesde(eje, { modo: 'pointed', autor: 'huesped', sobre: compra.id, en: '4000000000', payload: 'servido', t: T });
console.log(p.sobre === compra.id, p.en, JSON.stringify(p.contexto), JSON.stringify(p.movimientos), 'minutos', eje.series().find((s) => s.clave === 'T:minuto').consumido - antes);
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
Pointed emite como mucho 10 posiciones; este registro tiene 30
sequenced 30
mapped 30
scened 100
Scened emite como mucho 10000 posiciones; este registro tiene 10001
Error: modo desconocido: otro
nada que escribir en el registro (si todo se ancla, escribe la salida con escribirSalida)
```

Treinta posiciones superan el tope de Pointed (10): se rechazan con el mensaje del máximo. En Sequenced (máximo 100) y Mapped caben y se escriben, aunque se salgan de lo que propone su proporción (20 y 250–333), que solo avisa (VG, 7-11 noche: la proporción propone, el máximo manda). Scened no tiene proporción: solo su tope, que rechaza 10001 posiciones emitidas.

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
  pasado registro      1532253f huesped  2026-11-07T14:30:00Z   -1800 hora
  pasado registro      c475dae0 cocina   2026-11-07T14:10:00Z   -3000 hora
  pasado registro      7c3eb52f cocina   2026-11-07T09:00:00Z  -21600 dia
  pasado registro      3399a980 casa     2026-11-07T09:00:00Z  -21600 dia
  pasado registro      6cb2ff68 casa     2026-11-07T09:00:00Z  -21600 dia
  futuro consolidacion 1532253f huesped  2026-11-07T14:30:00Z   -1800 hora PENDIENTE DE AUTORIZACIÓN
  futuro proyeccion    6cd9212e huesped  2026-11-13T13:30:00Z  513000 semana
declarado:cena el sábado:0:segundo · pasado 2 de 4
```

### 8.3 Comparabilidad (PV8): se lee del 8

La comparabilidad ya no se calcula en `src/tiempo.js` (VG, 7-11 noche, mapa §14.2: una sola verdad del 8, la escrita). Se retiran `tiempo.comparar` (el puesto entre hermanos con la puntuación `posiciones + 2 × escritos + movimientos`) y `tiempo.medir`: queda una sola medida, `bases.medir`, y el foco se sitúa leyendo la base escrita en el 8 que resume su cohorte (`bases.situar`, §14). Si ese 8 no tiene base escrita, `situar` lo dice (PENDIENTE, frescura «sin base escrita») y, con `{ respaldo: true }`, calcula al vuelo con `confluir`, declarado. `tiempo.js` reexporta de `bases.js`, por compatibilidad, `HITOS`, `ALCANCES`, `MEDIDAS`, `comparables`, `confluir`, `proyectoDe`, `etiquetaClave` y `SIN_BASE_ESCRITA`.

```js
medir(eje, id)                              // bases.medir: la única medida (§14)
situar(eje, foco, { alcance, respaldo })    // la caja del foco en su cohorte, leída del 8 (§14)
HITOS                                       // diez etiquetas de caja { indice, nivel, nombre }, congeladas
```

**El 8 solo funde cantidades** (R7 del estudio de neutralidad; VG, 7-11 noche). Lo que sitúa y compara son las sumas por serie (E, P, R y T movidos; y el T consumido sobre el registro, `tiempo:<escala>`) y la **cuota** del foco en su cohorte (su suma ÷ la de la cohorte), que no cambia al añadir hermanos vacíos ni al partir un escrito en diez. Las medidas de `MEDIDAS` son **recuentos** (`recuento: true`): se informan, sin cortes ni cajas, y no deciden nada. PV8 ordena **registros por masa** (`bases.porMasa`), nunca identidades. Detalle en §14.

`HITOS` son las etiquetas de las diez cajas, literales (mapa §2.2 [D20]): texto informativo de la caja, nunca un juicio (decisión 2 de VG, 7-11 noche). Nada asigna nivel ni grado. Las estrellas no son verdad.

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
import { medir, situar, HITOS } from './src/bases.js';
import * as tiempo from './src/tiempo.js';
const gastaT = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });
const { eje, alta, menu, compra } = await ejemploCompra();
await ejemploCuenta(eje, compra);
const nota = await eje.escribir({ autor: 'casa', sobre: alta.id, t: '2026-11-07T10:00:00Z', movimientos: [gastaT('casa')], payload: 'nota breve' });
const breve = (m) => JSON.stringify({ posiciones: m.posiciones, terminales: m.terminales, escritos: m.escritos, movimientos: m.movimientos });
console.log('menú', breve(medir(eje, menu.id)), '· nota', breve(medir(eje, nota.id)));
console.log('situar:', situar(eje, menu.id).estado, '·', situar(eje, menu.id).motivo.replace(alta.id.slice(0, 8), '<alta>'));
const c = situar(eje, menu.id, { respaldo: true });
const t = c.tokens['T:hora'];
console.log('respaldo:', c.frescura, '· n', c.n, '· T:hora: foco', t.foco, 'caja', t.caja, '(' + t.hito.nombre + ')', '· cuota', t.cuota, '· cortes', t.cortes.join(' '), '· terminales (recuento, sin caja):', c.medidas.terminales.foco);
console.log('tiempo.js ya no tiene:', ['comparar', 'medir'].filter((f) => !(f in tiempo)).join(', '), '· génesis:', situar(eje, eje.genesisId).motivo, '· hitos', HITOS.length, HITOS[9].nivel, HITOS[9].nombre);
"
```

```text
menú {"posiciones":3,"terminales":6,"escritos":1,"movimientos":1} · nota {"posiciones":0,"terminales":1,"escritos":0,"movimientos":1}
situar: PENDIENTE · sin base escrita en el 8 de <alta>
respaldo: sin base escrita · n 2 · T:hora: foco 2 caja 2 (avanzado) · cuota 1 · cortes 1 2 3 4 6 10 16 26 42 · terminales (recuento, sin caja): 6
tiempo.js ya no tiene: comparar, medir · génesis: sin cohorte: el génesis no tiene padre · hitos 10 5.3 resolución experimental muy avanzada
```

Donde antes `comparar` decía «posición 1 de 2», ahora se lee la caja del menú entre sus hermanos (los hijos del alta), sin puesto: uno debajo, ninguno encima, y la etiqueta de la caja no es un grado del menú. Pendiente: proyecciones reales en PV7 (timelocks, hashlocks, fechas en el payload más allá de la posición 7).

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
import { descubrir, consolidar, autorizar, ejecutar, liberar, estadoDe, consolidaciones, puedeAutorizar, recursoDe, FABRICA } from './src/motor.js';
import { desdeMapped, escribirDesde } from './src/escritura.js';
import { ejeTemporal } from './src/tiempo.js';
import { situar } from './src/bases.js';
import { serializar, restaurar } from './src/persistencia.js';
import { evaluar } from './src/bql.js';

const corto = (x) => JSON.stringify(x).replace(/[0-9a-f]{64}/g, (m) => m.slice(0, 8));
const gastaT = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });
const t = (hora) => '2026-11-07T' + hora + ':00Z';

// 1. Génesis: la casa recibe euros y poder sobre todo el eje (ámbito «genesis»); T no (VG, 8-11: no hay T acumulable): vive de su asignación del día.
const eje = await Eje.genesis({ demostracion: true, identidad: 'casa', tipo: 'persona', emision: [{ token: 'E', denominacion: 'EUR', cantidad: 500 }, { token: 'P', cantidad: 5, ambito: 'genesis' }], foco: 'Casa de ejemplo', t: t('09:00') });
// 2. Altas: cocina (una cosa de la casa, que escribe con el T que ella le da) y una persona huésped (escribe con
//    su asignación de T del día, VG 8-11; T no cruza de persona, VG 7-11 noche) existen al recibir tokens.
const alta = await eje.escribir({ autor: 'casa', sobre: eje.genesisId, t: t('09:00'), movimientos: [gastaT('casa'), { token: 'T', escala: 'hora', cantidad: 10, de: 'casa', a: 'cocina' }, { token: 'T', escala: 'minuto', cantidad: 60, de: 'casa', a: 'cocina' }, { token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 50, de: 'casa', a: 'huesped' }], payload: ['Altas', ['cocina', 'huesped']], contexto: { tipos: { cocina: 'cosa', huesped: 'persona' } } });
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
// 7. Autorizar es bloquear P sobre el registro del recurso: nadie en el hilo del pedido ha emitido P propio, así que
//    manda el génesis y cuenta el P del eje. La casa tiene 3 de 5 (más de la mitad); el P de cocina, estrechado al menú, no es ese.
console.log('recurso = génesis', recursoDe(eje, cons.id) === eje.genesisId, '· puede autorizar', ['casa', 'cocina', 'huesped'].map((i) => i + '=' + puedeAutorizar(eje, i, cons.id)).join(' '));
await autorizar(eje, { autorizante: 'cocina', consolidacion: cons.id, t: t('13:41') }).catch((e) => console.log('rechazo:', corto(e.message)));
const aut = await autorizar(eje, { autorizante: 'casa', consolidacion: cons.id, t: t('13:45'), nota: 'sale en 10 minutos' });
console.log('autorización', JSON.stringify(aut.payload), corto(aut.contexto.autoridad.bloquea), '·', estadoDe(eje, cons.id));
// 8. Ejecutar: el autor mueve los euros y deja la evidencia.
const ej = await ejecutar(eje, { autor: 'huesped', consolidacion: cons.id, t: t('14:05'), titulo: 'Pagado y servido', movimientos: [{ token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 14, de: 'huesped', a: 'cocina' }] });
console.log('ejecución', corto(ej.payload), '· evidencia', corto(ej.contexto.evidencia), '·', estadoDe(eje, cons.id));
console.log('EUR cocina', eje.saldo('cocina', 'E:casa/EUR'), 'huesped', eje.saldo('huesped', 'E:casa/EUR'), '· hilo de la ejecución:', eje.hilo(ej.id).map((x) => x.autor).join(' → '));
console.log('consolidaciones del pedido', corto(consolidaciones(eje, pedido.id)));
// La casa recupera el P que bloqueó: tras ejecutar, solo ella lo libera.
await liberar(eje, { titular: 'casa', consolidacion: cons.id, t: t('14:06') });
console.log('casa P:genesis', eje.saldo('casa', 'P:genesis'), '· bloqueado', eje.bloqueado('casa', 'P:genesis'));
// 9. Eje temporal del pedido a las 14:10 y comparabilidad entre hermanos (lo escrito sobre el menú).
const et = ejeTemporal(eje, pedido.id, { ahora: t('14:10') });
console.log('pasado', et.pasado.map((x) => x.tipo + ':' + x.autor + ':' + x.banda).join(' '), '· futuro', et.futuro.length);
const s8 = situar(eje, pedido.id, { respaldo: true }); // el 8 del menú no tiene base escrita: respaldo al vuelo, declarado
const minutos = s8.tokens['T:minuto']; // R7: el 8 sitúa cantidades; los terminales son un recuento, sin caja
console.log('8 entre hermanos:', s8.frescura, '· n', s8.n, '· T:minuto: foco', minutos.foco, 'caja', minutos.caja, '· cuota', minutos.cuota, '· terminales (recuento):', s8.medidas.terminales.foco);
// 10. Persistir y restaurar: los estados se recalculan desde los eventos.
const otro = await restaurar(JSON.parse(JSON.stringify(serializar(eje))));
console.log('restaurado', otro.orden.length, 'eventos ·', estadoDe(otro, cons.id), '· posición 2 de la consolidación:', evaluar(otro, cons.id, [2]).texto);
```

```text
pedido [{"ref":"f724f338","dir":"0000000000"},[[{"ref":"f724f338","dir":"1100000000"}],[1]],{"ref":"f724f338","dir":"2000000000"},[["huesped"],["cocina"]]] · heredadas [0,2] · coste 6 min
posición 1 propio [2 posiciones] (exacto) · propio PENDIENTE: posición sin desarrollar: 1100000000 cae dentro de la lista de la 1; una dirección no nombra ocupantes de una lista (se leen por índice: BUSCAR o LOCAL) (exacto) · referencia guiso (reducir)
posición 2 propio → f724f338 (exacto) · referencia sin gluten · vegetariano (exacto)
posición 3 propio [2 posiciones] (exacto) · propio huesped (exacto)
posición 4 nada
consolidación ["Pedido del guiso",{"ref":"f724f338","dir":"1100000000"},"sin lactosa",{"ref":"815d11fb","dir":"3000000000"},"pagar 14 EUR"] · en la fábrica true · PENDIENTE DE AUTORIZACIÓN
encaje guardado [{"posicion":1,"evento":"f724f338","tipo":"referencia","origen":"1100000000","destino":"1000000000","vector":[0,1,0,0,0,0,0,0,0,0],"signo":"reducir"}]
recurso = génesis true · puede autorizar casa=true cocina=false huesped=false
rechazo: "cocina no tiene P que cuente para autorizar: cuenta el P sobre el registro del recurso 917415c7, que no tiene P propio emitido: el P sobre todo el eje («genesis»)"
autorización "==sale en 10 minutos" [{"clave":"P:genesis","cantidad":3}] · AUTORIZADO
ejecución ["Pagado y servido",{"ref":"8a2e9352"},{"ref":"51d8a094"}] · evidencia ["8a2e9352","51d8a094"] · EJECUTADO
EUR cocina 14 huesped 36 · hilo de la ejecución: huesped → huesped → huesped → cocina → casa → casa
consolidaciones del pedido [{"id":"8a2e9352","autor":"huesped","t":"2026-11-07T13:40:00Z","titulo":"Pedido del guiso","estado":"EJECUTADO","fuentes":["f724f338"]}]
casa P:genesis 3 · bloqueado 0
pasado registro:huesped:hora registro:cocina:dia registro:casa:dia registro:casa:dia · futuro 0
8 entre hermanos: sin base escrita · n 2 · T:minuto: foco 6 caja 5 · cuota 0.8571428571428571 · terminales (recuento): 6
restaurado 9 eventos · EJECUTADO · posición 2 de la consolidación: sin lactosa
```

Lectura de la salida:

- `pedido`: las posiciones 0 y 2 no se rellenaron y están por debajo de la 3, así que se heredan del menú por referencia; seis posiciones, seis minutos.
- `posición 1`: colisionan `[1]` y `[1, 0]` (la referencia al guiso, que cae dentro de la lista del menú: por eso sale `PENDIENTE`, una dirección no nombra ocupantes de una lista) con lo que esa referencia alcanza. El guiso vive en la profundidad 1.1 del menú y se coloca en la 1 del pedido: vector `[0, 1, …]` (candidato − buscado: `1.1` menos `1`), signo `reducir` (le sobra una profundidad). `posición 4 nada`: el pedido tiene posiciones 0–3 y nadie ha escrito en su 4.
- `consolidación`: la elección de la 1 es la referencia al guiso (`menú:1100000000`); la 3 se hereda del pedido; el encaje guardado es el del candidato elegido.
- `puede autorizar`: autorizar es bloquear P sobre el registro del recurso; nadie en el hilo del pedido (menú, alta de la casa) ha emitido P propio, así que es el génesis y cuenta el P del eje. La casa tiene los 3 que le quedan sobre `genesis` (de 5: más de la mitad) y los bloquea; los 2 P de cocina, estrechados al menú, no son ese P; la persona huésped no tiene ninguno (si lo tuviera, contaría aunque sea la autora).
- `EUR cocina 14 huesped 36`: los euros se mueven en la ejecución, no antes. El hilo de la ejecución recorre autores: huésped (ejecución) → huésped (consolidación) → huésped (pedido) → cocina (menú) → casa (alta) → casa (génesis).
- `futuro 0`: la única consolidación ya está ejecutada y el pedido no tiene posición 7. `8 entre hermanos`: los hermanos del pedido son lo escrito sobre el menú (el pedido y la delegación de poder); nadie ha escrito la base del 8 del menú, así que `situar` usa el respaldo al vuelo y lo dice («sin base escrita»). Sin puesto, y solo por cantidades (R7, VG 7-11 noche): el pedido cae en su caja de `T:minuto` y se dice su cuota de los minutos movidos entre sus hermanos; sus seis terminales son un recuento, que se informa sin caja.
- `casa P:genesis 3 · bloqueado 0`: tras la ejecución, la casa libera el P que bloqueó (solo ella puede).
- `restaurado 9 eventos`: génesis, alta, menú, delegación, pedido, consolidación, autorización, ejecución y liberación; el estado `EJECUTADO` se recalcula desde ellos.

## 11. API mínima

```js
// src/motor.js
export const FABRICA = '4000000000';
export const FASES = ['consolidado', 'autorizado', 'ejecutado'];
export const REGLA_AUTORIZAR: string;   // la regla de autorizar en texto; va en contexto.autoridad.regla de cada autorización
export const PLAZO_AUTORIZACION = 'ciclo';  // plazo por defecto del bloqueo de una autorización ([X] confirmar VG)
export const UMBRAL_POR_DEFECTO: { num: 1, den: 2, valor: 0.5, estricto: true, declarado: false, texto: 'más de la mitad' };
export function leerUmbral(texto): { num, den, valor, texto } | null;  // «umbral a/b» o «umbral 0.x», entre 0 (excluido) y 1
export function caminoVisible(ocupante): number[];
export function esConsolidacion(evento): boolean;  // fase 'consolidado', motor 'fabrica' y anclada en la fábrica (posición 4) de un camino de su foco
export const OPERADORES = { Q: 'descubrir', B: 'proponer', C: 'consolidar' };
export function descubrir(eje, foco, { camino = [], posiciones = [1, 2, 3, 4], epoca, maximo = Infinity } = {}): { posicion, dir, candidatos: Candidato[], total, limitada }[];
export function proponer(eje, foco, { camino = [], posiciones = [1, 2, 3, 4] } = {}): { foco, elecciones, origenes: { posicion, desde, texto }[], pendientes: { posicion, motivo }[] };
export async function consolidar(eje, { autor, foco, elecciones, titulo = 'Consolidación', t, camino = [] }, privada?): Promise<Evento>;
export function recursoDe(eje, consolidacion): string;  // X: el registro más cercano del hilo del foco con P propio emitido, o el génesis (VG, 8-11)
export function pesoAutorizacion(eje, consolidacion): { recurso, ambito, claves, delEje, emitido, bloqueado, umbral, necesario, alcanza };
export function poderParaBloquear(eje, identidad, consolidacion): { clave, ambito, cantidad }[];  // su P disponible que contaría
export function puedeAutorizar(eje, identidad, consolidacion): boolean;  // tiene P que cuente; el autor incluido
export async function autorizar(eje, { autorizante, consolidacion, cantidad, t, nota = 'autorizo', plazo = PLAZO_AUTORIZACION }, privada?): Promise<Evento>;
export function autorizacionCaducada(eje, autorizacion, t): boolean;
export async function ejecutar(eje, { autor, consolidacion, movimientos = [], t, titulo = 'Ejecutado' }, privada?): Promise<Evento>;
export async function liberar(eje, { titular, consolidacion, t, nota = 'libero' }, privada?): Promise<Evento>;
export function bloqueosDeP(eje, identidad, consolidacion): { clave, ambito, cantidad }[];
export function autorizacionesValidas(eje, consolidacion): Evento[];
export function estadoDe(eje, consolidacion): 'PENDIENTE DE AUTORIZACIÓN' | 'AUTORIZADO' | 'EJECUTADO' | undefined;
export function consolidaciones(eje, foco, camino = []): { id, autor, t, titulo, estado, fuentes }[];
export { CRITERIO_CAPACIDAD, capacidadDe } from './tokens.js';  // CRITERIO_CAPACIDAD = 2; capacidadDe(nodo): number | undefined
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
export { HITOS, ALCANCES, MEDIDAS, comparables, confluir, proyectoDe, etiquetaClave, SIN_BASE_ESCRITA } from './bases.js';  // el 8 vive en bases.js (§14); comparar y medir se retiran

// src/bases.js (§14)
export function medir(eje, id): Medida;  // la única medida
export function situar(eje, foco, { alcance = 'hermanos', epoca, respaldo = false } = {}): Situada;
export function confluir(eje, foco, { alcance = 'hermanos', epoca } = {}): Situada & { escrita: false, respaldo: true, comparables };
export async function escribirBase(eje, { registro, autor = identidadDe(eje, registro), privada, t, epoca }): Promise<Evento>;
export function leerBase(eje, id): Base | null;

// src/mapped.js (la celda 8)
export function ocho(eje, foco, { alcance = 'hermanos', epoca } = {}): { alcance, foco, estado, motivo?, escrita, base, registro, seccion, n, frescura, cantidades, cuota, recuentos, medidas, posiciones, incluido, cambiadas };
export function cuota(eje, foco, { epoca } = {}): { padre, escrita, base, frescura, incluido, series: [{ clave, etiqueta, foco, padre, cuota }] } | null;
export function textoOcho(o): string;
export function mapa(eje, id, { camino, epoca, maximo, medidas = false } = {}): Mapa; // medidas: null salvo { medidas: true } (bases.medir)

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
| AARPIA: autorización y ejecución reales, con sus agentes | Autorizar es bloquear P sobre el registro del recurso, con el umbral del dueño (VG, 7-11 noche, §4); ejecuta el autor. |
| Las seis capacidades del motor (interpretar, resolver, posicionar, comparar, calcular, componer) como operaciones | No existen como funciones. |
| Rechazar; qué hace el motor con un bloqueo caducado; ejecución por tramos | Tres estados. Varias autorizaciones suman P bloqueado contra el umbral (el quórum es la fracción); retirar es liberar (§5); la caducidad es un campo declarado que nada ejecuta (§4.2). Una ejecución que el eje rechaza deja la consolidación en `AUTORIZADO` con el P bloqueado hasta que su titular lo libere (§5). |
| Ejecución de varias partes (intercambio atómico: plaza por pago) | Cada movimiento sale del autor de la consolidación: una consolidación por parte, sin atomicidad (§5). [X] decidir VG (AARPIA). |
| Recibos de terceros referenciados por la operación raíz (aceptación, despacho, recepción) | La evidencia es consolidación + autorizaciones; nada más se enlaza. |
| Cierre de una interacción en la interfaz | Fuera del motor. |
| Proporción de Scened y de Be (**[X] decidir VG**, §7.1) | Sin propuesta (`null`). Decidido (VG, 7-11 noche, 10.3): la proporción propone y avisa, no rechaza; solo el tope duro (10/100/1000/10000) rechaza, sobre lo emitido. |
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
6. `ejecutar` no pasa por `escribirDesde`: su registro no lleva `contexto.modo` y no se comprueban proporción ni tope (sí paga un minuto por posición). En el payload referencia solo la primera autorización válida; en `contexto.evidencia` van todas.
7. `escribirSalida` no es atómica: si el eje rechaza una celda anclada (saldo de T, firma…), el registro y los anclados anteriores quedan escritos. El aviso de `escribirDesde` sobre celdas ancladas solo funciona si se le pasa el mismo objeto `payload` que devolvió `desdeMapped` (una copia no lo lleva); se retira cuando `escribirSalida` ha escrito la salida entera, así que tras un fallo a medias sigue puesto aunque el registro ya esté escrito.
8. `guardarLocal` devuelve `true` en Node sin `localStorage` aunque no haya guardado nada.
9. `banda` usa «estrictamente menor»: 60 s es `hora`, 3600 s es `dia`, 86400 s es `semana`.
10. `ejeTemporal` pone en `pasado` todos los antecesores del hilo aunque su `t` sea posterior a `ahora` (delta positivo en el pasado).
11. `consolidaciones(eje, foco, camino)` solo ve la fábrica de ese camino; una consolidación anclada en otra profundidad no aparece en el eje temporal de la raíz.
12. `costeT` y la proporción cuentan las referencias heredadas como posiciones del registro, como antes; el tope no las cuenta cuando la escritura sabe cuáles son (con `celda`, con `heredadas` o desde `escribirSalida`). Un payload de `desdeMapped` escrito con `escribirDesde` sin pasarle `heredadas` (así lo hace `app.js` cuando se elige una posición que no es la del camino y nada se ancla) cuenta el relleno también para el tope y no deja `contexto.heredadas`.
13. `escribirDesde` y `ejecutar` usan el reloj si falta `t`: ids no reproducibles.
14. La cohorte de hermanos es lo escrito sobre el mismo padre (`sobre`), sin distinguir `en` ([X] decidir VG, §14). (La puntuación con pesos de `comparar` se retiró: VG, 7-11 noche.)
15. Con el umbral por defecto (más de la mitad), en un dominio solo cabe una consolidación AUTORIZADA y sin ejecutar a la vez con el mismo P, y quien autorizó ha de liberar tras cada ejecución para autorizar la siguiente (§4.1). Lo resuelve el dueño bajando el umbral en su 2; si el motor debe hacer algo más es **[X] decidir VG**. (Antes, con la regla V0, el autor que tenía todo el poder no podía autorizarse; ahora sí: su P cuenta.)
16. `proponer` convierte el valor de una fórmula que no es número en su **texto** formateado: una magnitud se consolida como `"14 EUR (12 EUR + 2 EUR)"`, que BQL relee como `texto` (el paréntesis del desglose impide leerla como magnitud). El importe deja de ser operable en la consolidación (§2.1).
17. `ejecutar` sobre una consolidación pendiente lanza `Error('PENDIENTE DE AUTORIZACIÓN')`: el mensaje es el nombre del estado, sin prefijo que diga qué falló, y coincide con el valor normal de `estadoDe`.
18. Nada une el texto de la acción consolidada (`'pagar 14 EUR'`) con los `movimientos` de la ejecución: se puede consolidar «pagar 14 EUR» y ejecutar 1000 EUR (si hay saldo) o nada.

## 14. Bases del 8 (`src/bases.js`)

**Una sola verdad del 8, la escrita** (VG, 7-11 noche, mapa §14.2 y §12 [D] «Una sola verdad del 8»). Las estadísticas del 8 son **registros** escritos en la posición 8 (el cielo, `CIELO = '8000000000'`) del registro que resumen, con referencias a lo medido y «hasta»; no hay base de datos aparte. Las cohortes se **leen** de esos registros, nunca recorriendo el eje; el cálculo al vuelo (`confluir`) queda solo como respaldo declarado («sin base escrita»). Detalle, ejemplo ejecutado y abiertos en `docs/notas/BASES_DEL_8.md`; pruebas en `test/bases.test.js` y `test/bases-bql.test.js`; ejemplo en `ejemplos/ikisai/compras-hermanas.mjs`. Se importa como `bases` desde `src/index.js`.

```js
medir(eje, id)                       // → la ÚNICA medida de un registro: los recuentos (posiciones y procedencias por PV, terminales, escritos, movimientos, identidades, profundidadHilo, formulasResueltas, formulasPendientes, raiz) y las cantidades (tokens: por serie, y el T consumido sobre él como «tiempo:<escala>»)
esRecuento(clave); esCantidad(clave) // → R7: qué es un recuento informativo (MEDIDAS, recuento: true) y qué es una cantidad (lo único que el 8 sitúa)
cortesDe(clave, epoca)               // → { cortes, origen } de una cantidad: epoca.cortes(clave) ('epoca'); si la época no los da, los de la época 0 ('respaldo'); un recuento no tiene
cuotaDe(valor, suma); cajaDeCuota(c) // → la cuota del foco en su cohorte (null si la cohorte no tiene nada) y su caja (su décima parte)
porMasa(eje, ids, serie); masaDe(eje, id) // → PV8: registros por masa en una serie (de más a menos; a igual masa, en su orden); las cantidades de un registro
ochoPorCantidades(eje, foco, { alcance, epoca }) // → cantidades con caja y cuota, recuentos aparte (la lectura que integra mapped.ocho)
unitaria(m, epoca); fundir(a, b)     // → estadística { n, medidas, tokens, posiciones, raiz }; fundir es asociativo y conmutativo, con estadisticaVacia() de neutro; rechaza cortes distintos
identidadDe(eje, id)                 // → la cosa (con clave) que el propio registro da de alta; la del génesis, su autor ([X]); si no, null
puedeEscribirBase(eje, autor, id)    // → { puede, por: 'identidad' | 'poder' | null, motivo }: la propia cosa o quien tiene P sobre el registro, con clave
hijos(eje, id); esBase(eje, ev)      // → lo escrito sobre el registro sin sus bases válidas; si un evento es una base válida
calcularBase(eje, registro, { epoca }) // → { hijos, subarbol, refsHijos, refsBases, hasta, sinBase, epoca }, sin escribir
escribirBase(eje, { registro, autor, privada, t, epoca }) // → evento en el 8 del registro, firmado por autor (por defecto la propia cosa), que gasta 1 minuto de su T
leerBase(eje, id)                    // → la vigente (la última llegada), con autor, por, anteriores y frescura { t, hijosNuevos, basesNuevas, debajo, sinNovedades }, o null
comprobar(eje, base, { epoca })      // → { alDia, diferencias }: recalcula y compara, bajando por las bases fundidas que siguen vigentes
situar(eje, foco, { alcance, epoca, respaldo }) // → el foco en su caja, leído del 8 de la cohorte (escrita: true); sin base, PENDIENTE «sin base escrita» o, con respaldo, confluir
confluir(eje, foco, { alcance, epoca }) // → respaldo declarado: lo mismo, calculado al vuelo recorriendo la cohorte (escrita: false, frescura «sin base escrita»)
comparables(eje, foco, alcance); proyectoDe(eje, foco) // → los registros de una cohorte recorriendo el eje (solo para el respaldo y Scened); el proyecto del foco
valorDeBases(eje, id, args); erroresDeBases(args) // → lo que devuelve BASES() en BQL; por qué unos argumentos no valen
```

| Paso | Quién | `sobre` / `en` | `contexto` | Mueve |
|---|---|---|---|---|
| escribir una base | la propia cosa del registro (`identidadDe`) o quien tiene P sobre él, firmando con su clave | el registro / `CIELO` | `{ bases: true, n, nSubarbol, hasta, epoca, sinBase }` | `COSTE_BASE`: 1 minuto de su T ([X] coste) |

- **Una sola medida.** `medir` vive en `bases.js` y es la única: `tiempo.js` ya no mide ni puntúa (se retiran `tiempo.medir`, `tiempo.medidasDe` y `tiempo.comparar`, §8.3).
- **Dos estadísticas por base.** `hijos`: el fundido de las medidas de los hijos del registro (la cohorte de hermanos de cada uno). `subarbol`: el registro y todo lo que cuelga de él (la cohorte de proyecto y la general). El subárbol funde, **sin releer registros**, el subárbol de la base vigente de cada hijo: el 8 del proyecto funde las bases de sus hijos y el del génesis, las de los proyectos. Un hijo sin base cuenta por sí mismo y, si tiene descendencia, queda en `sinBase` ([X] cómo se completa).
- **Cohortes leídas del 8.** `hermanos` lee los hijos del 8 del padre; `proyecto`, el subárbol del 8 de `proyectoDe`; `general`, el subárbol del 8 del génesis. Con las bases al día (y sin hijos sin base), lo leído coincide con lo que `confluir` recalcula al vuelo (lo comprueba `test/bases.test.js`); si no, manda lo escrito y `comprobar` dice qué ha cambiado.
- **Respaldo declarado.** Sin base escrita en el 8 de la cohorte, `situar` devuelve PENDIENTE con frescura «sin base escrita»; con `{ respaldo: true }` devuelve `confluir`, que recorre la cohorte, funde con las mismas funciones y lo dice (`escrita: false`, `respaldo: true`, `frescura: 'sin base escrita'`). BQL nunca usa el respaldo.
- **El 8 solo funde cantidades** (R7; VG, 7-11 noche). Las medidas de `MEDIDAS` son recuentos: un bloque `{ recuento: true, n, suma, minimo, maximo }`, sin cortes ni cajas (en el payload, `[suma, mínimo, máximo]`); `situar` y `confluir` los dan con el valor del foco y su media, sin caja; `cortesDe`, `cajasEtiquetadas`, `BASES` y `CAJA` los rechazan. Las cantidades se sitúan por su caja (con los cortes de la época) y por su **cuota** (`cuota`, `cajaCuota`); lo que cuenta registros dentro de una caja (`enCaja`, `debajo`, `encima`, `media`) va marcado en `informativos`. `cambiadas` solo mira cantidades. El T consumido sobre el registro (`eje.tiempoSobre`) entra como `tiempo:<escala>`, sin lo que cuestan sus propias bases. Una base escrita con el formato anterior (recuentos con cajas) ya no es válida: se reescribe.
- **Cortes = regla de la época** (decisión 2 de VG). Se leen de `epoca.cortes(clave)` para las cantidades; la época 0 trae `1 2 3 4 6 10 16 26 42` para todas (`datos/epocas/epoca-0.json`, `cortes`; [X] sus valores). Una época que no los da usa los de la época 0 (`origen: 'respaldo'`). Se retiran los cortes de cohorte: todas las cohortes comparten cortes y se funden. Cada bloque guarda sus cortes y no se funden bloques con cortes distintos.
- **Validez.** Solo es base lo que, en el 8 del registro, firma con su clave la propia cosa del registro o quien tenía P sobre él al escribirla (el poder se mira con lo llegado antes de la base, no hoy: [X]), gastando T, con exactamente ese `contexto`, un payload coherente (cajas que suman n, extremos compatibles con la suma y con las cajas ocupadas, cortes crecientes), las referencias a **todos** los hijos llegados hasta `hasta`, en orden, y bases fundidas válidas de esos hijos. Lo demás escrito en el 8 es un hijo más: lo cuentan `escritos` y el respaldo. Nadie sin P escribe la base de una cosa que no es suya.
- **Las bases no son hermanas, escritos ni comparables** de lo que miden: `medir`, `comparables` y `posicionesDe` las saltan, así que escribir una base no cambia lo que mide.
- **Corregir = escribir otra base.** La anterior queda en el 8 como colisión; `leerBase` da la última y cuenta las `anteriores`.
- **Frescura y comprobación.** `frescura` cuenta lo llegado sin releer: hijos después de `hasta`, hijos cuya base vigente ya no es la fundida y lo mismo, sumado, en las fundidas (`debajo`). No ve cambios en lo ya medido; para eso, `comprobar` recalcula. `situar` dice en `cambiadas` las medidas en que el foco, medido ahora, cae en una caja vacía aunque la base lo incluya.
- **`BASES()`, `CAJA()` y `FRESCURA()` en BQL** (`docs/BQL.md` §7.13 y §7.14). Leen la base escrita y heredan el gancho `puedeLeer` (leer la base y, si hay que situarlo, el anfitrión y sus fórmulas) y el presupuesto de la fórmula (cobran lo que examina la lectura del 8). Sin base, PENDIENTE «sin base escrita» con el modo de escribirla; nunca calculan al vuelo.
- **La celda 8 de Mapped y el cielo.** `mapped.ocho(eje, foco, { alcance, epoca })` da lo que lee la celda 8 (la base escrita o el respaldo, dicho), por cantidades (R7; integra lo que daba `bases.ochoPorCantidades`): hermanos por defecto, proyecto o todo el eje; primero las cantidades por serie con su caja, su cuota en la cohorte y la caja de esa cuota, y la cuota del foco frente a su padre (`mapped.cuota`); después los recuentos, como información y sin caja; `mapped.textoOcho` es su texto. `mundos/cielo.js` (`datosCielo`) lee con la misma `ocho`: dibuja una constelación por cantidad y la décupla, enseña los recuentos aparte y dice «sin base escrita». En sobrio la pinta `ui/ocho.js`, al pintarse la celda: es ahí donde se mide el foco, porque `mapped.mapa` solo mide con `{ medidas: true }` y Scened solo suma bajo demanda (`docs/MODOS.md` §0.5).
- **Sin nivel ni grado.** Las diez cajas llevan las etiquetas de `HITOS` (`hito` en `situar`), texto informativo; nada asigna nivel ni grado ni puntúa.

Abiertos ([X] decidir VG, en el código y en la nota §3): cómo se identifica un registro con una identidad; los valores de los cortes de la época 0; el coste de una base; la disposición del payload; «más reciente» por llegada; qué es la frescura; cómo se completa lo que cuelga de un hijo sin base; la firma de `BASES()`; si el poder para escribir una base se mira al escribirla (hoy) o al leerla.
