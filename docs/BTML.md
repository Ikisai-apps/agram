# BTML: la estructura de datos de AGRAM

BTML es la estructura de datos de AGRAM. Este documento describe BTML **tal como existe en el código** (`src/btml.js`, `src/evento.js`, `src/tokens.js`, `src/eje.js`, `src/encaje.js`, `src/autoridad.js`, `src/epocas.js`, `src/persistencia.js`), con firmas de funciones, tablas y ejemplos ejecutables. Lo que no existe se marca con «pendiente».

Convenciones de este documento:

- Todos los ejemplos se ejecutan **desde la raíz del repositorio** con `node --input-type=module -e "..."` (Node ≥ 20). La salida que sigue a cada ejemplo es la salida real.
- Los ids del eje de ejemplo (`ejemplos/ikisai/compra-food.mjs`) son deterministas (hash de un cuerpo fijo), así que se citan completos. Los primeros ocho caracteres bastan para reconocerlos: génesis `7bfe589b`, alta `e9742ff2`, menú `daad9ad8`, compra `ba13e220`, cuenta `31d3a67f`.
- Un «registro» y un «evento» son lo mismo. El «foco» es el registro sobre el que se escribe.

## 0. Mapa de módulos

| Módulo | Qué define | Funciones principales |
|---|---|---|
| `src/btml.js` | Payload, terminales, referencias, direcciones | `esTerminal`, `esReferencia`, `esDireccion`, `validarPayload`, `direccion`, `indicesDe`, `resolver`, `ARIDAD` |
| `src/tokens.js` | Familias de tokens, series y movimientos | `FAMILIAS`, `SERIE`, `ESCALAS_T`, `MAXIMO_ESCALAS_T`, `SEGUNDOS`, `validarMovimiento`, `claveToken`, `partirClave`, `cantidadBase` |
| `src/evento.js` | El evento, su cuerpo canónico y su id | `crearEvento`, `validarForma`, `cuerpo`, `canonico`, `hash`, `verificarId`, `RAIZ` |
| `src/eje.js` | La secuencia de eventos: génesis, saldos, identidades, anclaje | `Eje.genesis`, `Eje.desde`, `eje.escribir`, `eje.anadir`, `eje.validar`, `eje.obtener`, `eje.hilo`, `eje.sobre`, `eje.saldo`, `eje.saldoT`, `eje.tiempos`, `eje.recursos`, `eje.poderes`, `eje.reputaciones`, `eje.serie`, `eje.series`, `eje.identidades`, `eje.clave` |
| `src/encaje.js` | Ocupantes de una dirección, colisiones, vector, árbol lógico | `ocupantes`, `caminosDe`, `seguir`, `arbol`, `colisiones`, `vector`, `distancia`, `acuerdo`, `signo`, `faltas`, `excedentes`, `norma`, `ordenarPorEncaje` |
| `src/autoridad.js` | Claves y firmas por identidad | `generarClaves`, `firmar`, `verificar`, `exportarPrivada`, `importarPrivada`, `huella` |
| `src/epocas.js` | Significado de cada dígito (época 0) | `PV`, `EPOCA_0`, `leerDireccion` |
| `src/persistencia.js` | Guardar y reconstruir el eje | `serializar`, `restaurar`, `guardarLocal`, `cargarLocal`, `borrarLocal` |

`src/index.js` reexporta `btml.js`, `tokens.js`, `evento.js`, `eje.js` y `epocas.js` en plano, y `encaje`, `autoridad`, `persistencia` (entre otros) como espacios de nombres: `import { Eje, crearEvento, encaje } from './src/index.js'`.

## 1. El evento

La unidad de información es el evento: **una transición de tokens con un payload BTML encima**. No hay evento sin movimiento de tokens.

### 1.1 Campos

| Campo | Tipo | Obligatorio | Significado |
|---|---|---|---|
| `autor` | cadena no vacía | sí | Identidad que escribe. Todo movimiento sale de ella. |
| `sobre` | id de evento o `null` | sí | Registro en foco sobre el que se anida este evento (hijo → padre). `null` solo en el génesis. |
| `en` | dirección de diez dígitos | no (por defecto `'0000000000'`) | Posición del foco donde se anida lo escrito. El génesis solo admite la raíz. |
| `t` | cadena que `Date.parse` acepta | sí | Instante declarado por el autor. No se comprueba contra ningún reloj. |
| `movimientos` | array no vacío de movimientos | sí | Ver §2. El autor debe mover T (en el génesis, recibirlo). |
| `payload` | BTML | sí | Terminal o array posicional. Ver §3. |
| `contexto` | objeto | no (por defecto `{}`) | Metadatos libres. Forma parte del id. Claves en uso hoy: ver §1.4. |
| `id` | 64 hex | lo calcula `crearEvento` | SHA-256 del cuerpo canónico. |
| `firmante`, `firma` | cadena, base64url | solo si se firma | Los añade `firmar`. No forman parte del id. Ver §7. |

El objeto que devuelve `crearEvento` está congelado (`Object.freeze`) y siempre lleva `en` y `contexto` rellenos. Lo que se guarda y se transmite es ese objeto tal cual, en JSON.

### 1.2 Cuerpo canónico e id

```js
cuerpo(ev)        // → { autor, sobre, en, t, movimientos, payload, contexto }  (sin id, firmante ni firma)
canonico(valor)   // → JSON con claves ordenadas alfabéticamente en todos los niveles, sin espacios
hash(texto)       // → Promise<string>  SHA-256 en hexadecimal (Web Crypto; igual en Node y navegador)
crearEvento({ autor, sobre = null, en = RAIZ, t, movimientos, payload, contexto = {} })  // → Promise<evento congelado>
verificarId(ev)   // → Promise<boolean>  ev.id === hash(canonico(cuerpo(ev)))
validarForma(ev)  // → string[]  errores de forma, sin mirar el eje; [] si es correcto
```

`id = hash(canonico(cuerpo(ev)))`. Dos eventos con el mismo cuerpo tienen el mismo id; cambiar cualquier campo del cuerpo (incluidos `en` y `contexto`) cambia el id. La firma no entra en el cuerpo, así que firmar no cambia el id.

```sh
node --input-type=module -e "
import { crearEvento, canonico, cuerpo, verificarId } from './src/evento.js';
const ev = await crearEvento({ autor: 'ana', sobre: 'g', t: '2026-11-06T20:00:00Z', movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'ana', a: null }], payload: ['hola', 2] });
console.log(canonico(cuerpo(ev)));
console.log(ev.id);
console.log(await verificarId(ev), Object.isFrozen(ev), ev.en, JSON.stringify(ev.contexto));
"
```

```text
{"autor":"ana","contexto":{},"en":"0000000000","movimientos":[{"a":null,"cantidad":1,"de":"ana","escala":"minuto","token":"T"}],"payload":["hola",2],"sobre":"g","t":"2026-11-06T20:00:00Z"}
5285d74b745162f719939ae7e60c1f1df871409361c2c11582b7e0948f69d09b
true true 0000000000 {}
```

### 1.3 Errores de forma (`validarForma`)

`crearEvento` lanza `Error('evento mal formado: ' + errores.join('; '))` si hay alguno.

| Error | Causa |
|---|---|
| `autor obligatorio` | `autor` no es cadena o está vacío |
| `sobre debe ser id o null` | `sobre` no es cadena ni `null` |
| `en debe ser una dirección de diez dígitos` | `en` no cumple `/^[0-9]{10}$/` |
| `el génesis solo se anida en la raíz` | `sobre === null` y `en !== '0000000000'` |
| `t debe ser instante ISO` | `Date.parse(t)` es `NaN` |
| `todo evento mueve tokens` | `movimientos` vacío o no array |
| `movimiento i: …` | un movimiento inválido (ver §2.3) |
| `el autor debe mover T` | ningún movimiento T con `de === autor` (evento normal) |
| `el génesis debe emitir T al autor` | ningún movimiento T con `a === autor` (si `contexto.genesis === true`) |
| `payload ruta: …` | payload inválido (ver §3.4) |

### 1.4 Claves de `contexto` en uso

`contexto` es libre, pero el código ya reconoce o escribe estas claves:

| Clave | Quién la escribe | Significado |
|---|---|---|
| `genesis: true` | `Eje.genesis` | Marca el génesis. Solo puede haber uno por eje. |
| `claves: { identidad: JWK }` | `Eje.genesis` (clave del autor) y quien da de alta | Clave pública de una identidad que **recibe tokens en este mismo evento**. Ver §7.2. |
| `modo` | `escritura.escribirDesde` | `'pointed'`, `'sequenced'` o `'mapped'`. |
| `motor`, `fase`, `fuentes`, `encaje`, `evidencia` | `motor.js` | Fábrica: consolidación, autorización, ejecución. Fuera de este documento. |

### 1.5 Un evento real: la compra

Cuarto evento del eje de ejemplo. Su `sobre` es el menú; su `payload` referencia dos posiciones del menú sin copiarlas.

```json
{
  "autor": "huesped",
  "sobre": "daad9ad8bba3064a6c2ae41af5d73b637431595f68c26ee9d27fc1025ec0754b",
  "en": "0000000000",
  "t": "2026-11-07T13:30:00Z",
  "movimientos": [
    { "token": "T", "escala": "hora", "cantidad": 1, "de": "huesped", "a": null },
    { "token": "E", "denominacion": "EUR", "cantidad": 12, "de": "huesped", "a": "cocina" }
  ],
  "payload": [
    "Compra del menú del día",
    [ { "ref": "daad9ad8bba3064a6c2ae41af5d73b637431595f68c26ee9d27fc1025ec0754b", "dir": "1000000000" }, 1, "EUR 12" ],
    [ { "ref": "daad9ad8bba3064a6c2ae41af5d73b637431595f68c26ee9d27fc1025ec0754b", "dir": "2000000000" } ],
    [ "huesped", "cocina" ],
    [ "pagar", "servir" ]
  ],
  "contexto": {},
  "id": "ba13e220c2e0eec08ae2cf7016d52acca485cb3b9b32a8e7ca04409f08326f73"
}
```

Leído bajo la época 0 (§4.3): posición 0 representación, 1 recursos (qué, cuánto, a qué precio), 2 criterios, 3 comunicación, 4 fábrica.

## 2. Movimientos de tokens (E/P/R/T)

### 2.1 Familias y series: la constante

Toda familia de tokens es una **serie de denominaciones** (VG, 7-11-2026: «las series de tokens son una constante y se estandarizan»). La serie es limitada y la emite quien la respalda. Cada movimiento nombra su serie con un campo (`SERIE`), y la clave de saldo es `familia:serie`. En una línea por familia: familia, clave de serie, quién la emite.

| Familia | Nombre | Campo de serie | Clave de saldo | Quién la emite |
|---|---|---|---|---|
| `T` | tiempo | `escala` | `'T:<escala>'` | el génesis |
| `E` | recursos | `denominacion` | `'E:<denominacion>'` | su emisor registrado: quien la emite por primera vez (§2.4) |
| `P` | poder / criterio | `ambito` | `'P:<ambito>'` | el génesis (`'P:genesis'`, todo el eje); delegar estrecha el ámbito y no emite |
| `R` | reputación | `emisor` | `'R:<emisor>'` | su emisor; hoy solo el génesis emite la suya |

`ESCALAS_T = ['segundo', 'minuto', 'hora', 'dia', 'semana', 'ciclo', 'anio']`: siete tokens distintos, ampliable hasta `MAXIMO_ESCALAS_T = 10`. **Sin conversión entre escalas**: una hora no son sesenta minutos; `T:hora` y `T:minuto` son saldos distintos, como `E:EUR` y `E:BTC`. `SEGUNDOS` (segundo 1, minuto 60, hora 3600, dia 86400, semana 7·86400, ciclo 28·86400, anio (13·28+1)·86400 = 365 días) es la duración de cada escala para medir distancias de tiempo (las bandas de `src/tiempo.js`); no convierte saldos.

[X] decidir VG: si una identidad puede emitir su propia serie de T o de R fuera del génesis; quién emite P sobre un ámbito sin pasar por el génesis; qué escalas completan las diez de T.

### 2.2 Forma de un movimiento

```js
{ token: 'T', escala: 'minuto', cantidad: 2, de: 'cocina', a: null }          // T: consumo de 2 minutos (T:minuto)
{ token: 'E', denominacion: 'EUR', cantidad: 12, de: 'huesped', a: 'cocina' } // E: pago (E:EUR)
{ token: 'P', cantidad: 2, ambito: '<id>', de: 'casa', a: 'cocina' }          // P: delegar poder sobre un subárbol
{ token: 'R', cantidad: 3, emisor: 'casa', de: 'casa', a: 'cocina' }          // R: la casa da reputación suya
{ token: 'E', denominacion: 'cama@2026-11-13', cantidad: 2, de: null, a: 'casa', emisor: 'casa' } // emisión de una serie de E (§2.4)
```

| Campo | Regla |
|---|---|
| `token` | uno de `FAMILIAS = ['E', 'P', 'R', 'T']` |
| `cantidad` | número finito > 0 |
| `escala` | obligatoria y válida si `token === 'T'`; prohibida en E/P/R |
| `denominacion` | obligatoria en E; prohibida en T/P/R |
| `ambito` | obligatorio en P (no hay P total); prohibido en el resto |
| `emisor` | obligatorio en R (solo él la mueve; su emisión va a él mismo) y en la emisión de E (`de === null`); prohibido en una transferencia de E y en T/P |
| `de` | identidad (cadena) o `null`. `null` = **emisión** (§2.3, §2.4). |
| `a` | identidad o `null`. `null` = **consumo**. |
| `de` y `a` | ambos presentes; no pueden ser `null` los dos |

```js
SERIE                 // { T: 'escala', E: 'denominacion', P: 'ambito', R: 'emisor' }
validarMovimiento(m)  // → string[]  errores; [] si es válido
claveToken(m)         // → 'T:hora' | 'E:EUR' | 'P:genesis' | 'R:casa' | …   familia + ':' + m[SERIE[familia]]
partirClave(clave)    // → { token, serie }   'E:cama@2026-11-13' → { token: 'E', serie: 'cama@2026-11-13' }
cantidadBase(m)       // → m.cantidad: sin conversión, cada serie se cuenta en su propia unidad
```

```sh
node --input-type=module -e "
import { claveToken, cantidadBase, partirClave, validarMovimiento, SERIE, ESCALAS_T, MAXIMO_ESCALAS_T, SEGUNDOS } from './src/tokens.js';
console.log(claveToken({ token: 'T', escala: 'hora', cantidad: 1 }), cantidadBase({ token: 'T', escala: 'hora', cantidad: 1 }), claveToken({ token: 'T', escala: 'minuto', cantidad: 60 }));
console.log(claveToken({ token: 'E', denominacion: 'EUR', cantidad: 12 }), claveToken({ token: 'P', ambito: 'genesis' }), claveToken({ token: 'R', emisor: 'casa' }));
console.log(JSON.stringify(SERIE), ESCALAS_T.length, MAXIMO_ESCALAS_T, SEGUNDOS.anio / 86400, JSON.stringify(partirClave('E:cama@2026-11-13')));
console.log(JSON.stringify(validarMovimiento({ token: 'T', cantidad: 0, escala: 'mes', de: 'a' })));
console.log(JSON.stringify(validarMovimiento({ token: 'E', cantidad: 1, escala: 'hora', de: null, a: null })));
console.log(JSON.stringify(validarMovimiento({ token: 'E', denominacion: 'EUR', cantidad: 1, de: 'a', a: 'b', emisor: 'a' })));
"
```

```text
T:hora 1 T:minuto
E:EUR P:genesis R:casa
{"T":"escala","E":"denominacion","P":"ambito","R":"emisor"} 7 10 365 {"token":"E","serie":"cama@2026-11-13"}
["cantidad debe ser > 0","escala T inválida: mes","de y a son obligatorios (null permitido)","a debe ser identidad o null"]
["escala solo en T","E exige denominación","la emisión de E exige emisor","movimiento sin origen ni destino"]
["emisor en E solo al emitir"]
```

### 2.3 Reglas del eje sobre los movimientos

Las aplica `eje.validar` (§7.4): nadie mueve tokens ajenos (`de` debe ser el autor), y el saldo del autor debe cubrir la suma de lo que mueve **por clave de saldo** (minutos con minutos, horas con horas). El evento mínimo mueve T del autor, en cualquier escala: el coste de escribir es tiempo (`escribirDesde` cobra un minuto por posición, así que escribir exige `T:minuto`). Emitir (`de === null`): el génesis emite cualquier familia; después solo se emiten series de E, cada una por su emisor (§2.4).

### 2.4 Emisión de series de E

Una identidad puede **emitir una serie limitada** de una denominación de E que ella respalda (ejemplo: la casa emite un token por plaza y noche). La emisión es un movimiento con `de: null`, `emisor` igual al autor del evento y `a` el propio emisor o quien él diga. Es válida solo si la denominación es nueva (queda registrada a nombre del emisor en `eje.emisores`, como las claves) o ya es suya. Nadie emite una denominación ajena ni en nombre de otro. Las series de E del génesis quedan a nombre de su autor (`Eje.genesis` completa `emisor`). La serie es limitada porque solo crece cuando su emisor emite; mover más de lo que hay se rechaza por saldo.

```js
eje.emisores                  // Map<denominación, identidad>
eje.serie(denominacion)       // → { emisor, emitido }  ({ emisor: null, emitido: 0 } si nadie la ha emitido)
eje.series()                  // → [{ clave, token, serie, emisor, emitido }] todas las series emitidas (las cuatro familias), por orden de emisión
```

```sh
node --input-type=module -e "
import { Eje } from './src/eje.js';
const t = '2026-11-07T09:00:00Z';
const gasta = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });
const eje = await Eje.genesis({ identidad: 'casa', emision: [{ token: 'T', escala: 'minuto', cantidad: 60 }, { token: 'E', denominacion: 'EUR', cantidad: 500 }], foco: 'Casa', t });
const alta = await eje.escribir({ autor: 'casa', sobre: eje.genesisId, t, movimientos: [gasta('casa'), { token: 'T', escala: 'minuto', cantidad: 5, de: 'casa', a: 'bea' }], payload: 'alta de bea' });
const plazas = await eje.escribir({ autor: 'casa', sobre: alta.id, t, movimientos: [gasta('casa'), { token: 'E', denominacion: 'cama@2026-11-13', cantidad: 2, de: null, a: 'casa', emisor: 'casa' }], payload: 'dos camas el 13-11' });
console.log(JSON.stringify(eje.serie('cama@2026-11-13')), JSON.stringify(eje.serie('EUR')), eje.saldo('casa', 'E:cama@2026-11-13'));
await eje.escribir({ autor: 'bea', sobre: plazas.id, t, movimientos: [gasta('bea'), { token: 'E', denominacion: 'cama@2026-11-13', cantidad: 1, de: null, a: 'bea', emisor: 'bea' }], payload: 'x' }).catch((e) => console.log(e.message));
await eje.escribir({ autor: 'bea', sobre: plazas.id, t, movimientos: [gasta('bea'), { token: 'E', denominacion: 'cama@2026-11-14', cantidad: 1, de: null, a: 'bea', emisor: 'casa' }], payload: 'x' }).catch((e) => console.log(e.message));
await eje.escribir({ autor: 'casa', sobre: plazas.id, t, movimientos: [gasta('casa'), { token: 'E', denominacion: 'cama@2026-11-13', cantidad: 3, de: 'casa', a: 'bea' }], payload: 'x' }).catch((e) => console.log(e.message));
await eje.escribir({ autor: 'casa', sobre: plazas.id, t, movimientos: [gasta('casa'), { token: 'T', escala: 'hora', cantidad: 1, de: null, a: 'casa' }], payload: 'x' }).catch((e) => console.log(e.message));
console.log(eje.series().map((x) => x.clave + ' ' + x.emitido + ' de ' + x.emisor).join(' · '));
"
```

```text
{"emisor":"casa","emitido":2} {"emisor":"casa","emitido":500} 2
evento rechazado: nadie emite una denominación ajena: cama@2026-11-13 la emite casa
evento rechazado: nadie emite en nombre de otro: casa no es el autor
evento rechazado: saldo insuficiente de E:cama@2026-11-13 en casa
evento rechazado: solo el génesis emite T
T:minuto 60 de casa · E:EUR 500 de casa · E:cama@2026-11-13 2 de casa
```

## 3. El payload

### 3.1 Terminales

`esTerminal(x)` es verdadero para exactamente tres formas:

| Terminal | Condición | Ejemplo |
|---|---|---|
| número | `typeof x === 'number'` y finito | `12`, `-0.5` |
| cadena | `typeof x === 'string'` y no vacía | `'Menú del día'`, `'EUR 12'`, `'=LOCAL(1) + 15 min'` |
| referencia | `esReferencia(x)` | `{ ref: '37c5…db78', dir: '1000000000' }` |

No son terminales: `''`, `NaN`, `Infinity`, `true`/`false`, `null`, `undefined`, objetos sin `ref`. Una cadena que empieza por `=` es una fórmula BQL y por `==` un texto escapado: eso lo interpreta BQL, no BTML; para BTML son cadenas.

Pendiente: terminales HTML y archivo (el mapa §2.1 los nombra; hoy un HTML es una cadena y no hay archivos).

### 3.2 Arrays posicionales

Un array BTML tiene **entre 1 y 10 posiciones** (`ARIDAD = 10`), índices 0–9, **sin `null`, `undefined` ni huecos**, y cada posición contiene un terminal u otro array. Consecuencias:

- No hace falta envolver un terminal en un array de una posición: un payload puede ser un terminal directamente (el génesis de ejemplo es `'Casa de ejemplo'`).
- La información se genera de 0 hacia arriba: **si existe la posición d, existen 0…d−1**. Para escribir en la posición 4 hay que rellenar 0–3, con contenido o con referencias (así lo hacen `escritura.desdeMapped` y `motor.consolidar`: heredan del foco por referencia).
- Un array de un elemento es válido. La décupla de diez posiciones solo se desarrolla cuando corresponde.
- `validarPayload` no limita la profundidad; `direccion` sí (diez índices). Un nodo por debajo del décimo nivel existe pero no tiene dirección. Pendiente: cambio de foco al agotar diez niveles (mapa §2.1).

`modos.contarPosiciones(payload)` cuenta las posiciones desarrolladas: cada terminal cuenta una.

### 3.3 Referencias

```js
{ ref: string, dir?: string }   // ref: id completo de otro evento; dir: dirección de diez dígitos dentro de su payload
```

- **No copian.** Lo que hay en el destino se lee al resolver (`encaje.seguir`, `encaje.ocupantes`, BQL `leerSlot`), nunca al escribir.
- `esReferencia` solo comprueba la forma: `ref` cadena no vacía y `dir`, si está, dirección válida. **No se comprueba al escribir que `ref` exista en el eje**: una referencia a un id desconocido se guarda y, al seguirla, sale con `rota: true`.
- `ref` debe ser el **id completo**. Los prefijos (`'ba13e220'`) solo los resuelven BQL (`REF("ba13e220")`) y la entrada de texto de `escritura.item` (`'@ba13e220:1200000000'`), que los convierten en id completo antes de guardar.
- Sin `dir`, la referencia apunta al payload entero (`'0000000000'`).
- `btml.resolver` **no** sigue referencias; `encaje.seguir` sigue cadenas de referencias hasta 20 saltos.

Pendiente: referencias a «una rama» distinta de evento + dirección (mapa §2.1).

### 3.4 `validarPayload`

```js
validarPayload(payload, ruta = '')  // → { ok: boolean, errores: string[] }
```

Cada error lleva su ruta: los índices concatenados desde la raíz (`'21'` = posición 2, subposición 1) o `'raíz'`.

| Error | Causa |
|---|---|
| `ruta: ni terminal ni array` | booleano, `null` suelto en la raíz, objeto sin `ref`, cadena vacía, `NaN`… |
| `ruta: array vacío` | `[]` |
| `ruta: más de 10 posiciones` | longitud > 10 |
| `ruta: hueco` | `null` o `undefined` en una posición |

```sh
node --input-type=module -e "
import { validarPayload, esTerminal } from './src/btml.js';
console.log(JSON.stringify(validarPayload(['a', ['b', 2], { ref: 'x' }])));
console.log(JSON.stringify(validarPayload(['a', null, ['b', []], true])));
console.log(JSON.stringify(validarPayload([])));
console.log(JSON.stringify(validarPayload(Array(11).fill(1))));
console.log(esTerminal(''), esTerminal(NaN), esTerminal(true), esTerminal({ ref: 'x', dir: '12' }), esTerminal({ ref: 'x' }));
"
```

```text
{"ok":true,"errores":[]}
{"ok":false,"errores":["1: hueco","21: array vacío","3: ni terminal ni array"]}
{"ok":false,"errores":["raíz: array vacío"]}
{"ok":false,"errores":["raíz: más de 10 posiciones"]}
false false false false true
```

## 4. Direcciones

### 4.1 Forma

Una dirección es **siempre una cadena de exactamente diez dígitos** (`esDireccion`). Cada dígito es el índice tomado en una profundidad: el primero en la raíz del payload, el segundo dentro de la posición elegida, y así hasta diez niveles. **El id del evento no es la dirección**: la dirección es un lugar dentro de un payload; el id nombra el evento.

```js
direccion(indices)   // [8,4,1,2,3] → '8412300000'; [] → '0000000000'. RangeError si > 10 índices o índice fuera de 0–9
indicesDe(dir)       // '8412300000' → [8,4,1,2,3]; '1010000000' → [1,0,1]; '0000000000' → []. TypeError si no son diez dígitos
esDireccion(s)       // /^[0-9]{10}$/
```

```sh
node --input-type=module -e "
import { direccion, indicesDe, esDireccion } from './src/btml.js';
console.log(direccion([8, 4, 1, 2, 3]));
console.log(direccion([]));
console.log(JSON.stringify(indicesDe('8412300000')));
console.log(JSON.stringify(indicesDe('1010000000')));
console.log(JSON.stringify(indicesDe('1000000000')), direccion([1, 0]) === direccion([1]));
console.log(esDireccion('841'), esDireccion('0000000011'));
try { direccion(Array(11).fill(1)); } catch (e) { console.log(e.constructor.name, e.message); }
"
```

```text
8412300000
0000000000
[8,4,1,2,3]
[1,0,1]
[1] true
false true
RangeError entre 0 y 10 índices
```

### 4.2 Los tres ceros

| Cero | Dónde | Qué significa | Estado |
|---|---|---|---|
| Índice real 0 | un `0` seguido de algún dígito distinto de cero (`'1010000000'` → `[1, 0, 1]`) | Se ha descendido por la posición 0 | Existe |
| Cero final | los ceros que cierran la cadena (`'1000000000'`) | No se ha descendido más. `indicesDe` los quita. La dirección nombra **a la vez** la posición 1, la 1.0, la 1.0.0… mientras cada nodo sea un array con posición 0: todas **colisionan** en esa dirección (§6). | Existe |
| Cero de orientación | el tercer cero, bajo regla de época | En el vector de diferencias (§6.5) una componente 0 es «ninguna diferencia en esa profundidad»; las reglas por dimensión que le darían otro sentido no existen. | **Pendiente** |

Consecuencias conocidas:

- `direccion([1, 0]) === direccion([1])`: **no se puede nombrar un índice 0 real que sea el último del camino**. Se trata como colisión (ambos caminos son ocupantes de la misma dirección), no como error.
- `'0000000000'` nombra la raíz del payload (camino `[]`) y su posición 0 (camino `[0]`).
- `'1100000000'` y `'0000000011'` no son equivalentes: la segunda es `[0,0,0,0,0,0,0,0,1,1]`, un camino de diez niveles.
- Un terminal no tiene posición 0 en el encaje (`caminosDe` se detiene en él). En Pointed, `decupla` muestra un payload terminal en la posición 0. **Pendiente** de decisión (mapa §12).

### 4.3 Significado de los dígitos: época 0

La época es una convención paralela, **fuera del dato**: BTML no lleva época dentro y cualquier dirección se lee desde cualquier época. Solo existe `EPOCA_0`, cuya regla corta vale en todas las profundidades: **cada dígito es un punto de vista**.

| Dígito | PV | Significado |
|---|---|---|
| 0 | PV0 | representación |
| 1 | PV1 | recursos |
| 2 | PV2 | criterios |
| 3 | PV3 | comunicación |
| 4 | PV4 | fábrica |
| 5 | PV5 | estructura (registro en foco) |
| 6 | PV6 | pasado |
| 7 | PV7 | futuro |
| 8 | PV8 | comparabilidad |
| 9 | PV9 | camino |

```js
PV                              // array congelado de los diez nombres
EPOCA_0.reglaCorta(profundidad, digito)  // → PV[digito]
leerDireccion(dir, epoca = EPOCA_0)      // → [{ profundidad, digito, significado }] una entrada por índice real
pointed.decupla(ev, epoca = EPOCA_0, profundidad = 0)  // → { id, autor, t, sobre, en, posiciones: [{ indice, significado, contenido }] × 10 }
```

Pendiente: reglas cortas de otras épocas, las cien reglas cortas por profundidad y las reglas largas.

```sh
node --input-type=module -e "
import { leerDireccion } from './src/epocas.js';
import { decupla } from './src/pointed.js';
import { ejemploCompra } from './ejemplos/ikisai/compra-food.mjs';
console.log(leerDireccion('1200000000').map((x) => x.profundidad + ':' + x.digito + '=' + x.significado).join(' '));
const { compra } = await ejemploCompra();
for (const p of decupla(compra).posiciones) console.log(p.indice, p.significado, p.contenido === undefined ? '-' : Array.isArray(p.contenido) ? '[' + p.contenido.length + ']' : p.contenido);
"
```

```text
0:1=recursos 1:2=criterios
0 representación Compra del menú del día
1 recursos [3]
2 criterios [1]
3 comunicación [2]
4 fábrica [2]
5 estructura -
6 pasado -
7 futuro -
8 comparabilidad -
9 camino -
```

### 4.4 `resolver`: descender por una dirección

```js
resolver(payload, dir)  // → contenido en esa dirección, o undefined si el camino atraviesa un terminal o una posición ausente
```

Desciende por los índices reales (`indicesDe`). No sigue referencias: si el camino pasa por una referencia, devuelve `undefined` más allá de ella.

```sh
node --input-type=module -e "
import { ejemploCompra } from './ejemplos/ikisai/compra-food.mjs';
import { resolver } from './src/btml.js';
const { eje, compra, menu } = await ejemploCompra();
console.log(JSON.stringify(resolver(compra.payload, '1200000000')));
console.log(JSON.stringify(resolver(compra.payload, '1000000000')));
console.log(resolver(compra.payload, '1020000000'), resolver(compra.payload, '7000000000'));
const r = resolver(compra.payload, '1000000000')[0];
console.log(r.ref === menu.id, JSON.stringify(resolver(eje.obtener(r.ref).payload, r.dir)));
"
```

```text
"EUR 12"
[{"ref":"daad9ad8bba3064a6c2ae41af5d73b637431595f68c26ee9d27fc1025ec0754b","dir":"1000000000"},1,"EUR 12"]
undefined undefined
true ["ensalada","guiso","fruta"]
```

## 5. Anclaje hijo → padre: `sobre` y `en`

Un evento declara dónde se anida: `sobre` es el id del registro en foco y `en` la dirección, dentro del payload de ese foco, donde se cuelga. **El padre no lista a sus hijos**; el eje los encuentra recorriendo la lista de eventos (`eje.sobre`).

- Lo escrito es el **payload entero** del hijo; `en` es el anclaje, no un hueco que se rellena en el array del padre. El payload del padre no cambia nunca.
- `en` forma parte del cuerpo y por tanto del id: el mismo contenido anclado en dos posiciones son dos eventos distintos.
- Por defecto `en = RAIZ = '0000000000'`. Como `'0000000000'` también nombra la posición 0, anclar en la raíz y anclar en la posición 0 de profundidad 0 es lo mismo (límite conocido).
- El génesis tiene `sobre: null` y solo admite `en` raíz. Cualquier otro evento necesita un `sobre` que exista en el eje.
- **Hilo**: la cadena `evento → sobre → sobre → … → génesis`. Es una cadena por referencia, no un orden temporal.

```js
eje.sobre(id, en?)  // → hijos directos de `id`, en orden de entrada; con `en`, solo los anclados en esa dirección
eje.hilo(id)        // → [evento, su foco, el foco de su foco, …, génesis]
eje.obtener(id)     // → evento o undefined
```

```sh
node --input-type=module -e "
import { ejemploCompra, ejemploCuenta } from './ejemplos/ikisai/compra-food.mjs';
const { eje, compra } = await ejemploCompra();
const cuenta = await ejemploCuenta(eje, compra);
const nota = await eje.escribir({ autor: 'huesped', sobre: compra.id, en: '7000000000', t: '2026-11-07T15:00:00Z', movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'huesped', a: null }], payload: 'repetir el sabado' });
console.log(eje.hilo(nota.id).map((e) => e.autor + '@' + e.en).join(' > '));
console.log(eje.sobre(compra.id).map((e) => e.id.slice(0, 8) + '@' + e.en).join(' '));
console.log(eje.sobre(compra.id, '1000000000').length, eje.sobre(compra.id, '0000000000').length);
console.log(cuenta.sobre === compra.id, cuenta.en, nota.en);
"
```

```text
huesped@7000000000 > huesped@0000000000 > cocina@0000000000 > casa@0000000000 > casa@0000000000
31d3a67f@1000000000 6941e321@7000000000
1 0
true 1000000000 7000000000
```

Pendiente: si una hilera (Sequenced) o una décupla (Mapped) deben poder anidarse en una posición concreta o siempre en la raíz (mapa §10.6).

## 6. Colisiones y encaje

Una dirección puede tener **varios ocupantes**. Eso es el estado normal, no un error: nada se sobrescribe ni se borra. Corregir es añadir un ocupante. El árbol lógico se reconstruye desde los eventos; no se guarda.

### 6.1 Qué ocupa una dirección

`ocupantes(eje, id, indices)` reúne, para la dirección `direccion(indices)` del registro `id`, tres clases de ocupantes. Orden de llegada: cada camino propio y, si ese camino es una referencia, inmediatamente lo que alcanza; al final, los escritos.

| `origen` | Qué es | De dónde sale |
|---|---|---|
| `'propio'` | Cada camino del payload de `id` que colisiona en esa dirección (por los ceros finales: `[1]`, `[1,0]`, `[1,0,0]`…) | `caminosDe(payload, dir)` |
| `'referencia'` | Lo que alcanza cada ocupante propio que es una referencia, con la cadena de procedencia | `seguir(eje, ref, procedencia)` |
| `'escrito'` | Cada evento hijo anclado en esa dirección (`sobre === id` y `en === dir`), con su payload entero | `eje.sobre(id, dir)` |

### 6.2 Forma de un ocupante

| Campo | Contenido |
|---|---|
| `origen` (= `tipo`) | `'propio'`, `'referencia'` o `'escrito'`. BQL lo expone como `ORIGEN()`. |
| `evento` | Id del evento donde vive el contenido: `id` (propio), el evento alcanzado (referencia), el hijo (escrito). |
| `dir` | Dirección dentro de `evento`: la buscada (propio), la alcanzada (referencia), `'0000000000'` (escrito). |
| `camino` | Índices exactos: `[1]`, `[1, 0]` (propio); `indicesDe(dir)` (referencia); `[]` (escrito). |
| `contenido` | Lo que hay ahí; `undefined` si la referencia está rota. |
| `procedencia` | Cadena de pasos. Propio: `['<id>:<dir>#<camino con puntos>']`. Referencia: el paso propio seguido de `'<id alcanzado>:<dir>'` por salto. Escrito: `['<id hijo>:0000000000']`. |
| `autor`, `t` | Solo en escritos. |
| `rota` | `true` si una referencia no llegó a contenido (solo en referencias). |
| `origenDir`, `destino` | Dirección de donde viene el contenido y dirección donde se coloca. |
| `vector`, `distancia`, `acuerdo`, `signo`, `faltas`, `excedentes` | El encaje de `origenDir` en `destino` (§6.5). |

```js
caminosDe(payload, dir)                        // → [{ indices, contenido }] el camino base y los caminos con un 0 más mientras haya posición 0
ocupantes(eje, id, indices, { orden = 'encaje' } = {})  // → ocupante[]; orden 'encaje' (por defecto) o 'llegada'
seguir(eje, ref, procedencia = [])             // → ocupante de origen 'referencia' tras seguir hasta 20 saltos; rota: true si no llega
caminoDe(o)                                    // → o.camino ?? indicesDe(o.dir)
```

### 6.3 Ejemplo real: la posición 1 de la compra

En `ba13e220`, la dirección `1000000000` tiene cuatro ocupantes una vez escrita la cuenta: la posición 1 (array), la 1.0 (la referencia al menú), lo que alcanza esa referencia (el menú:1) y la cuenta de cocina, anclada en `1000000000`.

```sh
node --input-type=module -e "
import { ejemploCompra, ejemploCuenta } from './ejemplos/ikisai/compra-food.mjs';
import { ocupantes, caminosDe } from './src/encaje.js';
const { eje, compra } = await ejemploCompra();
await ejemploCuenta(eje, compra);
console.log(JSON.stringify(caminosDe(compra.payload, '1000000000').map((c) => c.indices)));
for (const o of ocupantes(eje, compra.id, [1])) console.log(o.origen, JSON.stringify(o.camino), o.evento.slice(0, 8), o.origenDir, JSON.stringify(o.vector), o.signo, o.acuerdo, JSON.stringify(o.procedencia.map((p) => p.slice(0, 8) + p.slice(64))));
console.log(ocupantes(eje, compra.id, [1, 0]).length, ocupantes(eje, compra.id, [1, 1]).length, ocupantes(eje, compra.id, [7]).length);
console.log(JSON.stringify(ocupantes(eje, compra.id, [1])[2].contenido), JSON.stringify(ocupantes(eje, compra.id, [1])[3].contenido[0]));
"
```

```text
[[1],[1,0]]
propio [1] ba13e220 1000000000 [0,0,0,0,0,0,0,0,0,0] exacto 10 ["ba13e220:1000000000#1"]
propio [1,0] ba13e220 1000000000 [0,0,0,0,0,0,0,0,0,0] exacto 10 ["ba13e220:1000000000#1.0"]
referencia [1] daad9ad8 1000000000 [0,0,0,0,0,0,0,0,0,0] exacto 10 ["ba13e220:1000000000#1.0","daad9ad8:1000000000"]
escrito [] 31d3a67f 0000000000 [1,0,0,0,0,0,0,0,0,0] completar 0 ["31d3a67f:0000000000"]
4 1 0
["ensalada","guiso","fruta"] "Cuenta del menú"
```

Un ocupante completo, tal como lo devuelve `ocupantes` (el tercero, la referencia seguida):

```json
{
  "tipo": "referencia",
  "origen": "referencia",
  "evento": "daad9ad8bba3064a6c2ae41af5d73b637431595f68c26ee9d27fc1025ec0754b",
  "dir": "1000000000",
  "camino": [1],
  "contenido": ["ensalada", "guiso", "fruta"],
  "procedencia": [
    "ba13e220c2e0eec08ae2cf7016d52acca485cb3b9b32a8e7ca04409f08326f73:1000000000#1.0",
    "daad9ad8bba3064a6c2ae41af5d73b637431595f68c26ee9d27fc1025ec0754b:1000000000"
  ],
  "origenDir": "1000000000",
  "destino": "1000000000",
  "vector": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  "distancia": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  "acuerdo": 10,
  "signo": "exacto",
  "faltas": 0,
  "excedentes": 0
}
```

### 6.4 Seguir referencias

`seguir` parte de una referencia y salta mientras el contenido alcanzado sea otra referencia (máximo 20 saltos). Devuelve un ocupante de origen `'referencia'`; si el id no existe o se agotan los saltos, `contenido` es `undefined` y `rota` es `true`.

```sh
node --input-type=module -e "
import { ejemploCompra } from './ejemplos/ikisai/compra-food.mjs';
import { seguir } from './src/encaje.js';
const { eje, compra } = await ejemploCompra();
const r = seguir(eje, compra.payload[1][0]);
console.log(r.evento.slice(0, 8), r.dir, JSON.stringify(r.camino), JSON.stringify(r.contenido), r.rota, JSON.stringify(r.procedencia.map((p) => p.slice(0, 8))));
const rota = seguir(eje, { ref: 'ffff' });
console.log(rota.rota, rota.contenido, JSON.stringify(rota.procedencia));
"
```

```text
daad9ad8 1000000000 [1] ["ensalada","guiso","fruta"] undefined ["daad9ad8"]
true undefined []
```

### 6.5 Vector, distancia y orden

Para cada ocupante se compara la dirección de donde viene (`origenDir`) con la dirección donde se coloca (`destino`):

```js
vector(origen, destino)   // → [d0 … d9]  destino − origen, dígito a dígito, con signo (−9…9 por componente)
distancia(v)              // → [|d0| … |d9|]  siempre positiva; es lo que ordena
acuerdo(v)                // → número de ceros seguidos desde la profundidad 0 (10 = encaje exacto)
signo(v)                  // → 'exacto' | 'completar' (solo positivos) | 'reducir' (solo negativos) | 'mixto'
faltas(v)                 // → cuántas componentes > 0 (al candidato le falta: completar)
excedentes(v)             // → cuántas componentes < 0 (al candidato le sobra: reducir)
norma(v)                  // → suma de |d|; medida de consulta (BQL DESPLAZAMIENTO()), no criterio de orden
ordenarPorEncaje(lista)   // → nueva lista ordenada por `.vector`, sin quitar nada
```

Orden por encaje (`ordenarPorEncaje`, el orden por defecto de `ocupantes` y de BQL `BUSCAR`):

1. más profundidades de acuerdo primero (los exactos, con acuerdo 10, van delante);
2. a igual acuerdo, menor distancia **profundidad a profundidad** (se compara `|d0|`, luego `|d1|`…; no se suman);
3. a igual distancia, el orden de llegada.

El signo **no ordena**: es informativo por componente (positivo = falta, negativo = sobra) y `signo(v)` resume el vector entero. Pendiente: las reglas por dimensión que dirían dónde cuenta el signo. Pendiente: cómo cambia el vector con la época.

```sh
node --input-type=module -e "
import { vector, distancia, acuerdo, signo, faltas, excedentes, norma, ordenarPorEncaje } from './src/encaje.js';
const v = vector('1230000000', '1200000000');
console.log(JSON.stringify(v), JSON.stringify(distancia(v)), acuerdo(v), signo(v), faltas(v), excedentes(v), norma(v));
console.log(JSON.stringify(vector('0000000000', '4000000000')), signo(vector('0000000000', '4000000000')));
console.log(JSON.stringify(vector('1700000000', '2300000000')), signo(vector('1700000000', '2300000000')));
const lista = [
  { nombre: 'ref desde 7', vector: vector('7000000000', '2000000000') },
  { nombre: 'escrito en 2', vector: vector('0000000000', '2000000000') },
  { nombre: 'exacto', vector: vector('2000000000', '2000000000') },
  { nombre: 'desvio hondo', vector: vector('2300000000', '2000000000') },
  { nombre: 'otro escrito', vector: vector('0000000000', '2000000000') },
];
console.log(ordenarPorEncaje(lista).map((x) => x.nombre).join(' | '));
"
```

```text
[0,0,-3,0,0,0,0,0,0,0] [0,0,3,0,0,0,0,0,0,0] 2 reducir 0 1 3
[4,0,0,0,0,0,0,0,0,0] completar
[1,-4,0,0,0,0,0,0,0,0] mixto
exacto | desvio hondo | escrito en 2 | otro escrito | ref desde 7
```

Dónde se ve la diferencia entre llegada y encaje: un registro cuya posición 2 es una referencia a la posición 7 de otro (viene de lejos) y un hijo escrito en su posición 2 (viene de la raíz, a distancia 2).

```sh
node --input-type=module -e "
import { ejemploCompra } from './ejemplos/ikisai/compra-food.mjs';
import { ocupantes } from './src/encaje.js';
const { eje, compra } = await ejemploCompra();
const T = { token: 'T', escala: 'minuto', cantidad: 1, de: 'casa', a: null };
const plan = await eje.escribir({ autor: 'casa', sobre: compra.id, t: '2026-11-07T16:00:00Z', movimientos: [T], payload: ['Plan', 'a', 'b', 'c', 'd', 'e', 'f', 'cena'] });
const x = await eje.escribir({ autor: 'casa', sobre: compra.id, t: '2026-11-07T16:00:00Z', movimientos: [T], payload: ['X', 'r', { ref: plan.id, dir: '7000000000' }] });
await eje.escribir({ autor: 'casa', sobre: x.id, en: '2000000000', t: '2026-11-07T16:00:00Z', movimientos: [T], payload: 'criterio escrito' });
const f = (o) => o.origen + ':' + o.signo + ':' + o.vector[0];
console.log(ocupantes(eje, x.id, [2], { orden: 'llegada' }).map(f).join(' '));
console.log(ocupantes(eje, x.id, [2]).map(f).join(' '));
"
```

```text
propio:exacto:0 referencia:reducir:-5 escrito:completar:2
propio:exacto:0 escrito:completar:2 referencia:reducir:-5
```

### 6.6 Árbol lógico y colisiones

```js
arbol(eje, id, { profundidad = 10 } = {})  // → Map<dir, ocupante[]> para cada dirección desarrollada del payload y cada dirección con escritos
colisiones(mapa)                            // → [{ dir, ocupantes }] solo las direcciones con más de un ocupante
```

```sh
node --input-type=module -e "
import { ejemploCompra, ejemploCuenta } from './ejemplos/ikisai/compra-food.mjs';
import { arbol, colisiones } from './src/encaje.js';
const { eje, compra } = await ejemploCompra();
await ejemploCuenta(eje, compra);
const m = arbol(eje, compra.id);
for (const [dir, oc] of m) console.log(dir, oc.map((o) => o.origen + '#' + o.camino.join('.')).join(' '));
console.log(colisiones(m).map((c) => c.dir + ':' + c.ocupantes.length).join(' '));
console.log(arbol(eje, compra.id, { profundidad: 1 }).has('1200000000'));
"
```

```text
0000000000 propio# propio#0
1000000000 propio#1 propio#1.0 referencia#1 escrito#
1100000000 propio#1.1
1200000000 propio#1.2
2000000000 propio#2 propio#2.0 referencia#2
3000000000 propio#3 propio#3.0
3100000000 propio#3.1
4000000000 propio#4 propio#4.0
4100000000 propio#4.1
0000000000:2 1000000000:4 2000000000:3 3000000000:2 4000000000:2
false
```

Lectura: cada array con posición 0 colisiona con ella (`0000000000`, `1000000000`, `2000000000`…); `1000000000` suma además lo alcanzado por la referencia y la cuenta escrita; `1100000000` (la cantidad, un terminal) tiene un solo ocupante.

## 7. Identidades, claves y firmas

### 7.1 Identidades

Una identidad es una cadena (`'casa'`, `'cocina'`, `'huesped'`). **Existe cuando ha recibido tokens**: la primera por el génesis, las demás porque un evento les mueve tokens (`a: 'cocina'`). No hay registro de identidades aparte de los saldos. Las identidades pueden ser usuarios o cosas; quien da de alta declara.

```js
eje.identidades()              // → string[] en orden de primera recepción
eje.saldo(identidad, clave)    // → número; clave de saldo ('T:minuto', 'E:EUR', 'P:genesis', 'R:casa', …); 0 si no existe
eje.saldoT(identidad, escala)  // → saldo(identidad, 'T:' + escala), sin conversión; lanza si la escala no existe
eje.tiempos(identidad)         // → [{ escala, cantidad }] en el orden de ESCALAS_T, solo saldos > 0
eje.recursos(identidad)        // → [{ denominacion, cantidad }]
eje.poderes(identidad)         // → [{ ambito, cantidad }]
eje.reputaciones(identidad)    // → [{ emisor, cantidad }]
eje.clave(identidad)           // → JWK pública o undefined
```

### 7.2 Claves

- Una clave pública es un JWK EC P-256: `{ kty: 'EC', crv: 'P-256', x, y }`.
- Se declara en `contexto.claves[identidad]` **del mismo evento en que esa identidad recibe tokens por primera vez** (el génesis para el autor inicial, con `clave`; el alta para las demás). Una clave declarada para una identidad que ya existe, o para una que no recibe tokens en ese evento, se rechaza. **No se puede cambiar una clave registrada.**
- Pendiente: prueba de posesión de la clave al dar de alta (hoy quien da de alta declara la clave sin que la identidad nueva demuestre tenerla).

### 7.3 Firmas

```js
generarClaves()              // → Promise<{ publica: JWK, privada: CryptoKey }>
firmar(ev, privada, firmante = ev.autor)  // → Promise<evento congelado con firmante y firma>; firma = ECDSA P-256 / SHA-256 sobre los bytes del id, en base64url
verificar(ev, publica)       // → Promise<boolean>
exportarPrivada(privada)     // → Promise<JWK>   (para guardarla en local; nunca entra en el eje)
importarPrivada(jwk)         // → Promise<CryptoKey>
huella(publica)              // → primeros 8 caracteres de x, para mostrar
```

Reglas del eje: quien tiene clave registrada **debe firmar** cada evento suyo, `firmante` debe ser el `autor`, y la firma se verifica al añadir y al restaurar. Quien no tiene clave escribe sin firma, salvo que el eje se cree con `exigirFirmas: true` (entonces todo autor necesita clave y el génesis debe ir firmado). La firma no cambia el id. Las claves privadas nunca entran en el eje.

```sh
node --input-type=module -e "
import { Eje } from './src/eje.js';
import { crearEvento } from './src/evento.js';
import { generarClaves, firmar, verificar } from './src/autoridad.js';
const casa = await generarClaves();
const bea = await generarClaves();
const T = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });
const ev = await crearEvento({ autor: 'casa', sobre: 'g', t: '2026-11-06T20:00:00Z', movimientos: [T('casa')], payload: 'hola' });
const f = await firmar(ev, casa.privada);
console.log(f.id === ev.id, f.firmante, await verificar(f, casa.publica), await verificar(f, bea.publica), await verificar(ev, casa.publica));
const eje = await Eje.genesis({ identidad: 'casa', emision: [{ token: 'T', escala: 'minuto', cantidad: 600 }], foco: 'g', t: '2026-11-06T20:00:00Z', clave: casa.publica, privada: casa.privada });
const g = eje.obtener(eje.genesisId);
console.log(g.firmante, JSON.stringify(Object.keys(g.contexto.claves)), g.contexto.claves.casa.kty, g.contexto.claves.casa.crv);
await eje.escribir({ autor: 'casa', sobre: g.id, t: '2026-11-06T20:00:00Z', movimientos: [T('casa')], payload: 'sin firma' }).catch((e) => console.log(e.message));
const alta = await eje.escribir({ autor: 'casa', sobre: g.id, t: '2026-11-06T20:00:00Z', movimientos: [T('casa'), { token: 'T', escala: 'minuto', cantidad: 60, de: 'casa', a: 'bea' }], payload: 'alta de bea', contexto: { claves: { bea: bea.publica } } }, casa.privada);
console.log(alta.firmante, eje.clave('bea').x === bea.publica.x);
await eje.escribir({ autor: 'bea', sobre: alta.id, t: '2026-11-06T20:00:00Z', movimientos: [T('bea')], payload: 'x' }, casa.privada).catch((e) => console.log(e.message));
const ok = await eje.escribir({ autor: 'bea', sobre: alta.id, t: '2026-11-06T20:00:00Z', movimientos: [T('bea')], payload: 'x' }, bea.privada);
console.log(ok.firmante, ok.firma.length > 0);
await eje.escribir({ autor: 'casa', sobre: g.id, t: '2026-11-06T20:00:00Z', movimientos: [T('casa')], payload: 'cambio', contexto: { claves: { bea: casa.publica } } }, casa.privada).catch((e) => console.log(e.message));
"
```

```text
true casa true false false
casa ["casa"] EC P-256
evento rechazado: firma ausente de casa
casa true
evento rechazado: firma inválida de bea
bea true
evento rechazado: no se puede cambiar la clave de bea
```

Un génesis firmado tiene esta forma (la firma varía en cada ejecución; el id cambia respecto al génesis sin clave porque `contexto.claves` está en el cuerpo):

```json
{
  "autor": "casa",
  "sobre": null,
  "en": "0000000000",
  "t": "2026-11-07T09:00:00Z",
  "movimientos": [
    { "token": "T", "escala": "hora", "cantidad": 1000, "de": null, "a": "casa" },
    { "token": "T", "escala": "minuto", "cantidad": 1000, "de": null, "a": "casa" },
    { "token": "E", "denominacion": "EUR", "cantidad": 500, "emisor": "casa", "de": null, "a": "casa" },
    { "token": "P", "cantidad": 10, "ambito": "genesis", "de": null, "a": "casa" }
  ],
  "payload": "Casa de ejemplo",
  "contexto": {
    "genesis": true,
    "claves": { "casa": { "kty": "EC", "crv": "P-256", "x": "kKjLkSNM8eCjXP8lDWe2OuRG752_aj-zfVZKc7sEX10", "y": "eId106TdjeRHUC0hVPiUbLOXGvsH6fiLo4f0S2fqJ-A" } }
  },
  "id": "23b0bc739b5f8f8da6aab16c247933cc59f5a6867303e39b93adb292cf5342ae",
  "firmante": "casa",
  "firma": "sxVbBtcwPkbynL0t_w5l-0_RaMjmqLzNAGPPCnEV_J94Oad133AZXVVXFh7AXEQjZ-atTucEoqQ4qOT_AERH3w"
}
```

### 7.4 Rechazos del eje (`eje.validar`)

`eje.anadir` y `eje.escribir` lanzan `Error('evento rechazado: ' + errores.join('; '))`. Antes, `crearEvento` ya ha lanzado `evento mal formado` si falla la forma (§1.3).

| Error | Causa |
|---|---|
| `id no corresponde al cuerpo` | el id no es el hash del cuerpo (evento manipulado) |
| `evento ya registrado` | mismo id ya en el eje |
| `ya hay génesis` | `contexto.genesis` en un evento que no es el primero |
| `solo el génesis carece de foco` | `sobre === null` |
| `foco desconocido: <id>` | `sobre` no está en el eje |
| `autor desconocido: <id>` | el autor no ha recibido tokens nunca |
| `firma ausente de <autor>` / `el firmante debe ser el autor` / `firma inválida de <autor>` | el autor tiene clave y no firma, firma otro, o la firma no verifica |
| `autor sin clave: <autor>` | `exigirFirmas` y el autor no tiene clave |
| `no se puede cambiar la clave de <id>` / `clave declarada para <id> sin darle tokens` / `clave inválida para <id>` | `contexto.claves` mal usado |
| `solo el génesis emite <T, P o R>` | un movimiento con `de === null` de T, P o R fuera del génesis |
| `nadie emite en nombre de otro: <emisor> no es el autor` | emisión de E cuyo `emisor` no es el autor |
| `nadie emite una denominación ajena: <denominación> la emite <emisor>` | emisión de E de una denominación registrada a otra identidad |
| `nadie mueve tokens ajenos: <de> no es el autor` | un movimiento con `de !== autor` |
| `saldo insuficiente de <clave> en <autor>` | la suma de lo movido por clave supera el saldo (sin conversión: `T:minuto` no se paga con `T:hora`) |

```sh
node --input-type=module -e "
import { Eje } from './src/eje.js';
const eje = await Eje.genesis({ identidad: 'raiz', emision: [{ token: 'T', escala: 'minuto', cantidad: 60 }], foco: 'g', t: '2026-11-06T20:00:00Z' });
const T = (de, cantidad = 1) => ({ token: 'T', escala: 'minuto', cantidad, de, a: null });
const base = { autor: 'raiz', sobre: eje.genesisId, t: '2026-11-06T20:00:00Z', payload: 'x' };
const intentos = [
  { ...base, sobre: 'nadie', movimientos: [T('raiz')] },
  { ...base, autor: 'bea', movimientos: [T('bea')] },
  { ...base, movimientos: [{ token: 'E', denominacion: 'EUR', cantidad: 1, de: 'raiz', a: 'bea' }] },
  { ...base, movimientos: [T('raiz'), { token: 'T', escala: 'minuto', cantidad: 1, de: null, a: 'raiz' }] },
  { ...base, movimientos: [T('raiz'), { token: 'E', denominacion: 'EUR', cantidad: 1, de: null, a: 'raiz', emisor: 'bea' }] },
  { ...base, movimientos: [T('raiz', 1000)] },
  { ...base, movimientos: [{ token: 'T', escala: 'hora', cantidad: 1, de: 'raiz', a: null }] },
  { ...base, en: '4', movimientos: [T('raiz')] },
  { ...base, movimientos: [T('raiz')], payload: ['a', null] },
  { ...base, movimientos: [T('raiz')], contexto: { genesis: true } },
];
for (const d of intentos) await eje.escribir(d).catch((e) => console.log(e.message));
"
```

```text
evento rechazado: foco desconocido: nadie
evento rechazado: autor desconocido: bea; saldo insuficiente de T:minuto en bea
evento mal formado: el autor debe mover T
evento rechazado: solo el génesis emite T
evento rechazado: nadie emite en nombre de otro: bea no es el autor
evento rechazado: saldo insuficiente de T:minuto en raiz
evento rechazado: saldo insuficiente de T:hora en raiz
evento mal formado: en debe ser una dirección de diez dígitos
evento mal formado: payload 1: hueco
evento mal formado: el génesis debe emitir T al autor
```

## 8. Génesis

El génesis es el primer evento del eje. Se escribe **por convención, fuera del sistema**: emite libremente (`de: null`) series de las cuatro familias a su autor (después solo se emiten series de E, cada una por su emisor, §2.4), es el único sin foco (`sobre: null`) y lleva `contexto.genesis: true`. Fija el foco raíz (su `payload`) y la primera identidad. A partir de él, todo se genera dentro.

```js
Eje.genesis({ identidad, emision, foco, t = ahora, contexto = {}, clave, privada, exigirFirmas = false })  // → Promise<Eje>
//   identidad: primera identidad; emision: [{ token, cantidad, escala | denominacion | ambito | emisor }] (se completa con de: null, a: identidad; en E, emisor: identidad)
//   lanza 'génesis rechazado: …' si una serie de E del génesis lleva otro emisor
//   foco: payload BTML raíz; clave/privada: si se dan, el génesis declara la clave y va firmado
Eje.desde(eventos, { exigirFirmas = false } = {})  // → Promise<Eje>  reconstruye validando cada evento (ids, firmas, saldos); el primero debe ser el génesis
eje.genesisId                                      // id del génesis
```

```sh
node --input-type=module -e "
import { Eje } from './src/eje.js';
const eje = await Eje.genesis({ identidad: 'raiz', emision: [{ token: 'T', escala: 'hora', cantidad: 10 }, { token: 'T', escala: 'minuto', cantidad: 480 }, { token: 'E', denominacion: 'EUR', cantidad: 5 }], foco: ['casa', ['menu']], t: '2026-11-06T20:00:00Z' });
console.log(JSON.stringify(eje.obtener(eje.genesisId)));
const alta = await eje.escribir({ autor: 'raiz', sobre: eje.genesisId, en: '1000000000', t: '2026-11-06T20:01:00Z', movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'raiz', a: null }, { token: 'T', escala: 'hora', cantidad: 2, de: 'raiz', a: 'bea' }], payload: 'alta de bea' });
console.log(JSON.stringify(eje.identidades()), eje.saldoT('raiz', 'minuto'), eje.saldoT('raiz', 'hora'), eje.saldoT('bea', 'hora'), eje.saldo('raiz', 'E:EUR'), JSON.stringify(eje.serie('EUR')));
console.log(alta.sobre === eje.genesisId, alta.en, eje.sobre(eje.genesisId, '1000000000').length);
"
```

```text
{"autor":"raiz","sobre":null,"en":"0000000000","t":"2026-11-06T20:00:00Z","movimientos":[{"token":"T","escala":"hora","cantidad":10,"de":null,"a":"raiz"},{"token":"T","escala":"minuto","cantidad":480,"de":null,"a":"raiz"},{"token":"E","denominacion":"EUR","cantidad":5,"emisor":"raiz","de":null,"a":"raiz"}],"payload":["casa",["menu"]],"contexto":{"genesis":true},"id":"00b4d289e180f867647972b909df60c1496e1c80f15866e48d0f63e6973283f5"}
["raiz","bea"] 479 8 2 5 {"emisor":"raiz","emitido":5}
true 1000000000 1
```

El génesis del eje de ejemplo:

```json
{
  "autor": "casa",
  "sobre": null,
  "en": "0000000000",
  "t": "2026-11-07T09:00:00Z",
  "movimientos": [
    { "token": "T", "escala": "hora", "cantidad": 1000, "de": null, "a": "casa" },
    { "token": "T", "escala": "minuto", "cantidad": 1000, "de": null, "a": "casa" },
    { "token": "E", "denominacion": "EUR", "cantidad": 500, "emisor": "casa", "de": null, "a": "casa" },
    { "token": "P", "cantidad": 10, "ambito": "genesis", "de": null, "a": "casa" }
  ],
  "payload": "Casa de ejemplo",
  "contexto": { "genesis": true },
  "id": "7bfe589b7136a08faa6e73b4122b380882721d40164d26d821acd3864634cae6"
}
```

### 8.1 Guardar y reconstruir

El eje se guarda como **la lista de sus eventos en orden**; nada más. Al restaurar se vuelve a validar todo (ids, firmas, saldos). El árbol lógico, los saldos y las claves se reconstruyen.

```js
serializar(eje)    // → { version: 1, exigirFirmas, eventos: evento[] }
restaurar(datos)   // → Promise<Eje>; lanza si la versión no es 1 o algún evento no cuadra
guardarLocal(eje, clave = 'agram.eje') / cargarLocal(clave) / borrarLocal(clave)   // localStorage si existe; false / null si no
```

```sh
node --input-type=module -e "
import { ejemploCompra, ejemploCuenta } from './ejemplos/ikisai/compra-food.mjs';
import { serializar, restaurar } from './src/persistencia.js';
const { eje, compra } = await ejemploCompra();
await ejemploCuenta(eje, compra);
const datos = JSON.parse(JSON.stringify(serializar(eje)));
console.log(datos.version, datos.exigirFirmas, datos.eventos.length, datos.eventos.map((e) => e.id.slice(0, 8)).join(' '));
const otro = await restaurar(datos);
console.log(otro.saldo('cocina', 'E:EUR'), JSON.stringify(otro.identidades()), otro.orden.length);
datos.eventos[3].movimientos[1].cantidad = 1;
await restaurar(datos).catch((e) => console.log(e.message));
"
```

```text
1 false 5 7bfe589b e9742ff2 daad9ad8 ba13e220 31d3a67f
12 ["casa","cocina","huesped"] 5
evento rechazado: id no corresponde al cuerpo
```

Pendiente: persistencia en base de datos y anclaje a una cadena. La forma de los eventos no cambia con eso.

## 9. El eje de ejemplo

`ejemplos/ikisai/compra-food.mjs` construye cinco eventos con datos inventados. `ejemploCompra({ claves })` devuelve `{ eje, alta, menu, compra }`; `ejemploCuenta(eje, compra, privadaCocina)` añade la cuenta. Con claves, los ids cambian (las claves van en el cuerpo) y cada identidad firma.

| Evento | id | autor | sobre | en | payload |
|---|---|---|---|---|---|
| génesis | `7bfe589b…` | casa | — | `0000000000` | `"Casa de ejemplo"` |
| alta | `e9742ff2…` | casa | génesis | `0000000000` | `["Altas del fin de semana", ["cocina", "huesped"]]` |
| menú | `daad9ad8…` | cocina | alta | `0000000000` | `["Menú del día", ["ensalada", "guiso", "fruta"], ["sin gluten", "vegetariano"]]` |
| compra | `ba13e220…` | huesped | menú | `0000000000` | `["Compra del menú del día", [{ref: menú, dir: "1000000000"}, 1, "EUR 12"], [{ref: menú, dir: "2000000000"}], ["huesped", "cocina"], ["pagar", "servir"]]` |
| cuenta | `31d3a67f…` | cocina | compra | `1000000000` | `["Cuenta del menú", "=REF(\"ba13e220\", \"1200000000\") + 2 EUR", "=LOCAL(1) + 15 min", "==no es fórmula"]` |

Series: la casa emite en el génesis 1000 `T:hora`, 1000 `T:minuto`, 500 `E:EUR` (la serie EUR queda a su nombre) y 10 `P:genesis`; las altas reparten horas y minutos, que son tokens distintos. Saldos tras los cinco eventos: casa 936 h y 279 min de T (1000 − 40 − 24; 1000 − 1 − 240 − 480), 440 EUR, 10 P; cocina 38 h y 237 min (40 − 2; 240 − 3), 12 EUR; huesped 23 h y 480 min (24 − 1), 48 EUR.

```js
import { ejemploCompra, ejemploCuenta } from './ejemplos/ikisai/compra-food.mjs';
const { eje, alta, menu, compra } = await ejemploCompra();
const cuenta = await ejemploCuenta(eje, compra);
```

## 10. API mínima

Firmas completas de lo que un programa necesita para escribir y leer BTML.

```js
// src/btml.js
export const ARIDAD = 10;
export function esReferencia(x): boolean;                 // { ref: string no vacía, dir?: dirección }
export function esTerminal(x): boolean;                   // número finito | cadena no vacía | referencia
export function esDireccion(s): boolean;                  // /^[0-9]{10}$/
export function validarPayload(payload, ruta = ''): { ok: boolean, errores: string[] };
export function direccion(indices: number[]): string;     // ≤ 10 índices 0–9 → diez dígitos (RangeError)
export function indicesDe(dir: string): number[];         // quita ceros finales (TypeError si no es dirección)
export function resolver(payload, dir: string): any;      // undefined si no se llega; no sigue referencias

// src/tokens.js
export const AMBITO_GENESIS = 'genesis';
export const FAMILIAS = ['E', 'P', 'R', 'T'];
export const SERIE = { T: 'escala', E: 'denominacion', P: 'ambito', R: 'emisor' };
export const ESCALAS_T = ['segundo', 'minuto', 'hora', 'dia', 'semana', 'ciclo', 'anio'];
export const MAXIMO_ESCALAS_T = 10;
export const SEGUNDOS = { segundo: 1, minuto: 60, hora: 3600, dia: 86400, semana: 604800, ciclo: 2419200, anio: 31536000 };  // solo para medir distancias
export function validarMovimiento(m): string[];
export function claveToken(m): string;                    // 'T:hora' | 'E:EUR' | 'P:genesis' | 'R:casa' | …
export function partirClave(clave): { token, serie };
export function cantidadBase(m): number;                  // m.cantidad, sin conversión

// src/evento.js
export const RAIZ = '0000000000';
export function canonico(valor): string;
export async function hash(texto): Promise<string>;
export function cuerpo(ev): { autor, sobre, en, t, movimientos, payload, contexto };
export async function crearEvento({ autor, sobre = null, en = RAIZ, t, movimientos, payload, contexto = {} }): Promise<Evento>;
export function validarForma(ev): string[];
export async function verificarId(ev): Promise<boolean>;

// src/eje.js
export class Eje {
  constructor({ exigirFirmas = false } = {});
  static async genesis({ identidad, emision, foco, t, contexto, clave, privada, exigirFirmas }): Promise<Eje>;
  static async desde(eventos, { exigirFirmas = false } = {}): Promise<Eje>;
  eventos: Map<id, Evento>; orden: id[]; saldos: Map<identidad, Map<clave, number>>; claves: Map<identidad, JWK>; emisores: Map<denominacion, identidad>; exigirFirmas: boolean;
  get genesisId(): string;
  obtener(id): Evento | undefined;
  identidades(): string[];
  saldo(identidad, clave): number;
  saldoT(identidad, escala): number;                       // saldo de 'T:' + escala
  tiempos(identidad): { escala, cantidad }[];
  recursos(identidad): { denominacion, cantidad }[];
  poderes(identidad): { ambito, cantidad }[];
  reputaciones(identidad): { emisor, cantidad }[];
  serie(denominacion): { emisor, emitido };
  series(): { clave, token, serie, emisor, emitido }[];
  clave(identidad): JWK | undefined;
  async validar(ev): Promise<string[]>;
  async anadir(ev): Promise<Evento>;                       // lanza 'evento rechazado: …'
  async escribir(datos, privada?): Promise<Evento>;        // crearEvento + (firmar) + anadir
  hilo(id): Evento[];                                      // hasta el génesis
  sobre(id, en?): Evento[];                                // hijos directos
}

// src/encaje.js
export function vector(origen, destino): number[10];
export function distancia(v): number[10];
export function acuerdo(v): number;
export function norma(v): number;
export function faltas(v): number;
export function excedentes(v): number;
export function signo(v): 'exacto' | 'completar' | 'reducir' | 'mixto';
export function ordenarPorEncaje(lista: { vector }[]): typeof lista;
export function caminosDe(payload, dir): { indices: number[], contenido }[];
export function ocupantes(eje, id, indices, { orden = 'encaje' | 'llegada' } = {}): Ocupante[];
export function seguir(eje, ref, procedencia = []): Ocupante;
export function arbol(eje, id, { profundidad = 10 } = {}): Map<string, Ocupante[]>;
export function colisiones(mapa): { dir, ocupantes }[];
export function caminoDe(o): number[];

// src/autoridad.js
export async function generarClaves(): Promise<{ publica: JWK, privada: CryptoKey }>;
export async function exportarPrivada(privada): Promise<JWK>;
export async function importarPrivada(jwk): Promise<CryptoKey>;
export async function firmar(ev, privada, firmante = ev.autor): Promise<Evento>;
export async function verificar(ev, publica): Promise<boolean>;
export function huella(publica): string;

// src/epocas.js
export const PV: string[10];
export const EPOCA_0: { nombre, reglaCorta(profundidad, digito) };
export function leerDireccion(dir, epoca = EPOCA_0): { profundidad, digito, significado }[];

// src/persistencia.js
export const VERSION = 1;
export function serializar(eje): { version, exigirFirmas, eventos };
export async function restaurar(datos): Promise<Eje>;
export function guardarLocal(eje, clave = 'agram.eje'): boolean;
export async function cargarLocal(clave = 'agram.eje'): Promise<Eje | null>;
export function borrarLocal(clave = 'agram.eje'): void;
```

Las anotaciones de tipo son documentación; el código es JavaScript puro sin dependencias.

## 11. Lo que no existe (pendiente)

| Pendiente | Dónde se nota |
|---|---|
| Terminales HTML y archivo | §3.1: hoy solo número, cadena, referencia |
| Referencias a una rama que no sea evento + dirección | §3.3 |
| Comprobar al escribir que una referencia apunta a un evento existente | §3.3: se detecta al seguirla (`rota`) |
| Cero de orientación y reglas por dimensión para el signo del vector | §4.2, §6.5 |
| Nombrar un índice 0 real al final del camino | §4.2: se trata como colisión |
| Posición 0 de un terminal (encaje no la da; Pointed sí) | §4.2 |
| Cambio de foco al agotar diez niveles | §3.2 |
| Reglas cortas de otras épocas, cien reglas cortas, reglas largas; cómo cambia el vector con la época | §4.3, §6.5 |
| Prueba de posesión de la clave al dar de alta | §7.2 |
| Emisión de series de T, P y R fuera del génesis; escalas de T octava a décima ([X] decidir VG) | §2.1, §2.4 |
| Anidar hileras o décuplas en una posición concreta por decisión | §5 |
| Persistencia en base de datos y anclaje a una cadena | §8.1 |
| Comprobación de `t` contra un reloj o contra el orden del eje | §1.1: solo `Date.parse` |
