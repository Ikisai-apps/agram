# BTML: la estructura de datos de AGRAM

BTML es la estructura de datos de AGRAM. Este documento describe BTML **tal como existe en el código** (`src/btml.js`, `src/evento.js`, `src/tokens.js`, `src/eje.js`, `src/encaje.js`, `src/autoridad.js`, `src/epocas.js`, `src/persistencia.js`), con firmas de funciones, tablas y ejemplos ejecutables. Lo que no existe se marca con «pendiente».

Convenciones de este documento:

- Todos los ejemplos se ejecutan **desde la raíz del repositorio** con `node --input-type=module -e "..."` (Node ≥ 20). La salida que sigue a cada ejemplo es la salida real.
- Los ids del eje de ejemplo (`ejemplos/ikisai/compra-food.mjs`) son deterministas (hash de un cuerpo fijo), así que se citan completos. Los primeros ocho caracteres bastan para reconocerlos: génesis `2d970a48`, alta `a8efd9b0`, menú `d367743b`, compra `bea2e06d`, cuenta `ee80a426`.
- Un «registro» y un «evento» son lo mismo. El «foco» es el registro sobre el que se escribe.

Antes de copiar un id de este documento: los ids cambian en cuanto cambia cualquier cosa del cuerpo del ejemplo (pasó con la PR #18, que puso ámbito al P del génesis, con la PR #28, que cambió el vector guardado en las consolidaciones, y con la PR #35, que puso el génesis en series: minutos, `E:casa/EUR`, tipo `grupo`). En un programa no se copian: se usan `compra.id`, `menu.id`… tal como los devuelve `ejemploCompra()`. Desde fuera de la raíz del repositorio se importa por URL absoluta: `import { Eje, encaje, bql, motor } from 'file:///<ruta del repositorio>/src/index.js'` (el paquete es `"type": "module"`; los imports internos son relativos). En PowerShell las comillas anidadas de `node -e "..."` fallan a menudo: es más fiable guardar el ejemplo en un `.mjs` y ejecutarlo con `node --input-type=module < ejemplo.mjs` desde la raíz.

## 0. Mapa de módulos

| Módulo | Qué define | Funciones principales |
|---|---|---|
| `src/btml.js` | Payload, terminales, referencias, direcciones | `esTerminal`, `esReferencia`, `esDireccion`, `validarPayload`, `direccion`, `indicesDe`, `resolver`, `ARIDAD` |
| `src/tokens.js` | Familias de tokens, series y movimientos | `FAMILIAS`, `SERIE`, `SEPARADOR_REGISTRO`, `ESCALAS_T`, `MAXIMO_ESCALAS_T`, `SEGUNDOS`, `AMBITO_GENESIS`, `TIPOS`, `EMITEN`, `CRITERIO_CAPACIDAD`, `validarMovimiento`, `claveToken`, `partirClave`, `esIdRegistro`, `capacidadDe`, `cantidadBase` |
| `src/evento.js` | El evento, su cuerpo canónico y su id | `crearEvento`, `validarForma`, `cuerpo`, `canonico`, `hash`, `verificarId`, `RAIZ` |
| `src/instante.js` | Instantes ISO-8601 estrictos con zona explícita, en milisegundos UTC | `esInstante`, `msUTC`, `msDeGuardado` (solo para eventos de la versión 2) |
| `src/eje.js` | La secuencia de eventos: génesis, saldos, identidades, anclaje | `Eje.genesis`, `Eje.desde`, `eje.escribir`, `eje.anadir`, `eje.validar`, `eje.obtener`, `eje.hilo`, `eje.sobre`, `eje.saldo`, `eje.saldoT`, `eje.tiempos`, `eje.recursos`, `eje.poderes`, `eje.poderSobre`, `eje.reputaciones`, `eje.serie`, `eje.series`, `eje.vivo`, `eje.registroDe`, `eje.topes`, `eje.tipo`, `eje.identidades`, `eje.clave`, `reglasDelTope`, `SIN_CAPACIDAD` |
| `src/encaje.js` | Ocupantes de una dirección (cada elemento de una lista, aparte), la lista de una posición (fuera del árbol), colisiones, vector, árbol lógico | `ocupantes`, `lista`, `caminosDe`, `seguir`, `arbol`, `colisiones`, `vector`, `distancia`, `acuerdo`, `signo`, `faltas`, `excedentes`, `norma`, `ordenarPorEncaje` |
| `src/autoridad.js` | Claves y firmas por identidad | `generarClaves`, `firmar`, `verificar`, `exportarPrivada`, `importarPrivada`, `huella` |
| `src/epocas.js` | Significado de cada dígito: la época 0 (las cien reglas cortas) y, cuando las haya, las épocas con reglas largas, cargadas desde `datos/epocas/` | `PV`, `EPOCA_0`, `EPOCAS`, `epocaDe`, `cargarEpoca`, `leerDireccion`, `leerCamino`, `nombreEnNodo` |
| `src/persistencia.js` | Guardar y reconstruir el eje | `serializar`, `restaurar`, `guardarLocal`, `cargarLocal`, `borrarLocal` |

`src/index.js` reexporta `btml.js`, `tokens.js`, `evento.js`, `eje.js`, `epocas.js` y `modos.js` en plano, y como espacios de nombres `pointed`, `sequenced`, `mapped`, `scened`, `salida` (= `src/escritura.js`), `bql`, `encaje`, `motor`, `autoridad`, `tiempo`, `persistencia`, `bases`, `efectos` y `validez`: `import { Eje, crearEvento, encaje, bql, motor } from './src/index.js'`. Cuidado también con `validez`: es el espacio de nombres de `src/validez.js`, y la función es `validez.validez`. Cuidado: `escritura` en plano **no** es el módulo `src/escritura.js` sino la función de `modos.js` que da la proporción de escritura de un modo; el módulo es `salida`. No hay espacios de nombres `btml`, `tokens`, `evento`, `eje`, `epocas` ni `modos`: lo suyo se importa en plano (`import { direccion, indicesDe, Eje } from './src/index.js'`; `import { btml } from …` falla con `does not provide an export named 'btml'`).

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

El objeto que devuelve `crearEvento` es la **copia en JSON** de lo que se le pasa (lo que se valida, se hashea y se guarda es lo mismo), congelada entera (`congelar`: también `payload`, `movimientos` y `contexto`, a todos los niveles), y siempre lleva `en` y `contexto` rellenos. Quien lo crea puede seguir usando y mutando sus arrays sin cambiar el evento. Lo que no cabe en JSON (un ciclo, un BigInt) es `evento mal formado: no cabe en JSON`; un array de más de diez posiciones en el payload se rechaza antes de copiarlo, sin recorrer su longitud (`evento mal formado: payload <ruta>: más de 10 posiciones`). Lo que se guarda y se transmite es ese objeto tal cual, en JSON. El eje (`anadir`, `desde`) guarda a su vez una copia normalizada y congelada de cada evento que recibe: solo sus campos (los del cuerpo, `id`, `firmante`, `firma`), con `en` y `contexto` por defecto si faltan; un campo de más no entra. No existe modificar en sitio, tampoco en memoria.

### 1.2 Cuerpo canónico e id

```js
cuerpo(ev)        // → { autor, sobre, en, t, movimientos, payload, contexto }  (sin id, firmante ni firma)
canonico(valor)   // → JSON con claves ordenadas alfabéticamente en todos los niveles, sin espacios; con la semántica de JSON (sin claves undefined)
hash(texto)       // → Promise<string>  SHA-256 en hexadecimal (Web Crypto; igual en Node y navegador)
crearEvento({ autor, sobre = null, en = RAIZ, t, movimientos, payload, contexto = {} })  // → Promise<evento congelado>
verificarId(ev)   // → Promise<boolean>  ev.id === hash(canonico(cuerpo(ev)))
validarForma(ev)  // → string[]  errores de forma, sin mirar el eje; [] si es correcto
```

`id = hash(canonico(cuerpo(ev)))`. Dos eventos con el mismo cuerpo tienen el mismo id; cambiar cualquier campo del cuerpo (incluidos `en` y `contexto`) cambia el id. La firma no entra en el cuerpo, así que firmar no cambia el id. `canonico` sigue la semántica de JSON (una clave con `undefined` o una función no está; un `undefined` en un array es `null`), así que el id de un evento no cambia al pasar por JSON: `{ nota: undefined }` y `{}` dan el mismo id.

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
| `t debe ser instante ISO-8601 con zona explícita (…)` | `t` no es `AAAA-MM-DDThh:mm[:ss[.fff]]` con `Z` o `±hh:mm` y una fecha real (`src/instante.js`; revisión de seguridad, 7-11 noche: Date.parse es laxo y depende del motor). Solo los eventos de un eje guardado con la versión 2 se leen con Date.parse |
| `todo evento mueve tokens` | `movimientos` vacío o no array |
| `movimiento i: …` | un movimiento inválido (ver §2.3) |
| `el autor debe mover T` | ningún movimiento T con `de === autor` (evento normal) |
| `el génesis debe emitir T al autor` | ningún movimiento T con `a === autor` (si `contexto.genesis === true`) |
| `payload ruta: …` | payload inválido (ver §3.4) |
| `contexto debe ser un objeto` | `contexto` es un número, un texto o un array (`null` vale como `{}`) |
| `evento no es objeto` | lo validado no es un objeto |

### 1.4 Claves de `contexto` en uso

`contexto` es libre, pero el código ya reconoce o escribe estas claves:

| Clave | Quién la escribe | Significado |
|---|---|---|
| `genesis: true` | `Eje.genesis` | Marca el génesis. Solo puede haber uno por eje. |
| `claves: { identidad: JWK }` | `Eje.genesis` (clave del autor) y quien da de alta | Clave pública de una identidad que **recibe tokens en este mismo evento**. Ver §7.2. |
| `tipos: { identidad: 'persona' \| 'grupo' \| 'cosa' }` | `Eje.genesis` (tipo del autor, con `tipo`) y quien da de alta | Tipo de una identidad que **recibe tokens en este mismo evento**. Solo decide quién emite (§2.4, §7.1). |
| `modo` | `escritura.escribirDesde` | `'pointed'`, `'sequenced'`, `'mapped'` o `'scened'`. |
| `heredadas` | `escritura.escribirDesde` (con `celda`, `heredadas` o desde `escribirSalida`) | Posiciones del payload que son relleno heredado del foco: cada una es una referencia al foco en su propia dirección, y el foco tiene contenido en ese camino exacto (se comprueba: una heredada nunca cuelga). No se emiten y no cuentan para el tope del modo (la proporción sí las cuenta, como antes); lo demás se vio o se escribió. Posiciones como número (`3`), subposiciones o clases como texto (`'1.2'`, `'1.2.3'`). Ver `docs/MOTOR.md` §7.3. |
| `clasifica: { posicion, evento, camino, indice? }` | `ui/clasificar.js` (`escribirColocacion`, modo «crear») | El registro coloca en una subposición de `posicion` (por dirección, su `en`) la pieza de la lista de esa posición que vive en `evento`, camino `camino` (`[]` si la pieza es un escrito) y, si es un elemento de una lista, `indice` (su lugar en ella). Desde entonces la pieza cuenta como clasificada. Ver §6.7. |
| `motor`, `fase`, `fuentes`, `encaje`, `nuevos`, `evidencia` | `motor.js` | Fábrica: consolidación, autorización, ejecución (`docs/MOTOR.md` §3). `encaje` dice de dónde vino cada elección con fuente; `nuevos`, dónde va cada terminal nuevo. Ningún registro guarda una clave `clase`: la clase de modificación se lee de una dirección con el camino desde el que se escribe (la matriz es relativa al camino: bajo un camino de profundidad n, el dígito n + 2; sin camino, el tercero; `docs/MOTOR.md` §7.2). |

### 1.5 Un evento real: la compra

Cuarto evento del eje de ejemplo. Su `sobre` es el menú; su `payload` referencia dos posiciones del menú sin copiarlas.

```json
{
  "autor": "huesped",
  "sobre": "d367743bd56eb5f722ace18466010fa58b34f366675675f6e086c447fac45c97",
  "en": "0000000000",
  "t": "2026-11-07T13:30:00Z",
  "movimientos": [
    { "token": "T", "escala": "hora", "cantidad": 1, "de": "huesped", "a": null },
    { "token": "E", "emisor": "casa", "denominacion": "EUR", "cantidad": 12, "de": "huesped", "a": "cocina" }
  ],
  "payload": [
    "Compra del menú del día",
    [ [ { "ref": "d367743bd56eb5f722ace18466010fa58b34f366675675f6e086c447fac45c97", "dir": "1000000000" } ], [ 1 ], [ "EUR 12" ] ],
    [ { "ref": "d367743bd56eb5f722ace18466010fa58b34f366675675f6e086c447fac45c97", "dir": "2000000000" } ],
    [ "huesped", "cocina" ],
    [ "pagar", "servir" ]
  ],
  "contexto": {},
  "id": "bea2e06df3f8ce56b2b3670c4281dfc33dc2a88fa380f8e0a8e5f3477a1ee810"
}
```

Leído bajo la época 0 (§4.3): posición 0 representación, 1 recursos, 2 criterios, 3 comunicación, 4 fábrica. Por hojas (VG, 7-11 noche; §3.2): la posición 1 tiene un array dentro, así que es una **décupla** y en ella el dígito es el PV aplicado al nodo de arriba: 1.0 qué es (la lista de uno con la referencia al menú:1), 1.1 cuánto (la lista de uno `[1]`), 1.2 con qué condición (la lista de uno `["EUR 12"]`); cada posición va entre corchetes (forma canónica, VG 8-11, §3.2). Las posiciones 2, 3 y 4 son solo hojas: son **listas**, sus ocupantes por llegada (la referencia a los criterios del menú; quién habla con quién; las dos acciones). Quien copie la décupla como plantilla (1.3 «total», 1.4 «tiempo»…) obtiene direcciones que la época 0 lee como «con quién» y «qué se hace» (ver `docs/notas/PRUEBA_DEL_EXTRANJERO.md`).

## 2. Movimientos de tokens (E/P/R/T)

### 2.1 Familias y series: la constante

Toda familia de tokens es una **serie** (VG, 7-11-2026: «las series de tokens son una constante y se estandarizan»). La serie es limitada y la emite quien la respalda. Cada movimiento nombra su serie con los campos de `SERIE`, y la clave de saldo es `familia:campos` (unidos por `/`). En una línea por familia: familia, clave de serie, quién la emite.

| Familia | Nombre | Campos de serie | Clave de saldo | Quién la emite |
|---|---|---|---|---|
| `T` | tiempo | `escala` | `'T:<escala>'` | cada persona, para sí misma, con el tope del reloj; también el génesis (§2.4) |
| `E` | recursos | `emisor`, `denominacion`, `registro` (opcional) | `'E:<emisor>/<denominacion>'` o `'E:<emisor>/<denominacion>@<registro>'` | una persona, a su nombre o al de un grupo sobre cuyo registro tiene P; la denominación va ligada al emisor como en R, y la serie al registro del recurso, con tope compartido (§2.4) |
| `P` | poder / criterio | `ambito` | `'P:<ambito>'` | el génesis (`'P:genesis'`, todo el eje); una persona, solo sobre un registro que escribió ella; a los demás les llega por delegación (§2.5), y quien solo lo tiene lo transfiere pero no lo acuña |
| `R` | reputación | `emisor` | `'R:<emisor>'` | una persona, a su nombre o al de un grupo sobre cuyo registro tiene P: la declara y solo ella la amplía (§2.4) |

`ESCALAS_T = ['segundo', 'minuto', 'hora', 'dia', 'semana', 'ciclo', 'anio']`: siete tokens distintos, ampliable hasta `MAXIMO_ESCALAS_T = 10` (`tokens.js` no carga si se pasa del tope). **Sin conversión entre escalas**: una hora no son sesenta minutos; `T:hora` y `T:minuto` son saldos distintos, como `E:casa/EUR` y `E:casa/BTC`. T va en **enteros**: cada escala es un token, y media hora serían minutos. `SEGUNDOS` (segundo 1, minuto 60, hora 3600, dia 86400, semana 7·86400, ciclo 28·86400, anio (13·28+1)·86400 = 365 días) es la duración de cada escala para medir distancias de tiempo (las bandas de `src/tiempo.js`); no convierte saldos.

[D] (VG, 7-11, mapa §12): E con la denominación ligada al emisor como en R; R declarada por su emisor, ampliable solo por él y con rastro visible; P por delegación desde un registro de dominio; las cosas son titulares que no emiten. [D] (VG, 7-11 noche): solo emiten las personas (un grupo es un registro con P delegado), T lo emite cada persona para sí misma con el tope del reloj, la emisión es escalonada T → R → P → E, hay bloqueo y liberación con salida, obligación del emisor de R y caducidad de E. Todo implementado (§2.4, §2.5, §7.1); el ciclo de vida completo está en `docs/FUNDAMENTOS.md` («Ciclo de vida de cada token»).

Quién emite T y P fuera del génesis está decidido (mapa §12, 7-11 noche: cada persona emite su T con tope, escalonado T→R→P→E) e implementado (§2.4); la regla de T es PROVISIONAL [X] (neutralidad ante agrupación y división). [X] decidir VG: qué escalas completan las diez de T; si P y R admiten fracciones (hoy sí, en coma flotante, que acumula error; T ya va en enteros, y E también salvo en las series declaradas `divisible`, R2).

### 2.2 Forma de un movimiento

```js
{ token: 'T', escala: 'minuto', cantidad: 2, de: 'cocina', a: null }                          // T: consumo de 2 minutos (T:minuto)
{ token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 12, de: 'huesped', a: 'cocina' }  // E: pago con EUR de la casa (E:casa/EUR)
{ token: 'P', cantidad: 2, ambito: '<id>', de: 'casa', a: 'cocina' }                          // P: delegar poder sobre un subárbol
{ token: 'R', cantidad: 3, emisor: 'casa', de: 'casa', a: 'cocina' }                          // R: la casa da reputación suya
{ token: 'E', emisor: 'casa', denominacion: 'cama@2026-11-13', cantidad: 2, de: null, a: 'casa' } // emisión de una serie de E (§2.4)
{ token: 'E', emisor: 'casa', denominacion: 'cama@2026-11-13', registro: '<id>', cantidad: 2, de: null, a: 'casa' } // E atada al registro del recurso (E:casa/cama@2026-11-13@<id>)
{ token: 'R', cantidad: 10, emisor: 'casa', de: null, a: 'casa' }                             // emisión de R: la casa amplía la suya (§2.4)
```

| Campo | Regla |
|---|---|
| `token` | uno de `FAMILIAS = ['E', 'P', 'R', 'T']` |
| `cantidad` | número finito > 0; en T, entero (cada escala es un token) |
| `escala` | obligatoria y válida si `token === 'T'`; prohibida en E/P/R |
| `denominacion` | obligatoria en E; prohibida en T/P/R |
| `ambito` | obligatorio en P (no hay P total): `'genesis'` o el id de un registro del eje (si no existe, el eje rechaza `ámbito desconocido`, §7.4); prohibido en el resto |
| `emisor` | obligatorio en E (la serie es suya) y en R; prohibido en T/P. En R, además, `de` solo puede ser el emisor o `null`, salvo para devolvérsela al emisor (`a` = el emisor; regla nueva, **[X] confirmar VG**, §2.4) |
| `de` | identidad (cadena) o `null`. `null` = **emisión** (§2.3, §2.4); en E y R, `a` debe ser el propio emisor. |
| `estado`, `salida` | opcionales: `estado: 'bloqueo' \| 'liberacion'` con `de` = `a` (no cambia de titular) y `salida` (texto no vacío, la condición de liberación: declarada, no verificable todavía; el propio titular libera cuando quiere; **[X] decidir VG** qué la hace verificable, p. ej. que la liberación cite un evento de otra identidad); `salida` solo con `estado` |
| `caduca` | opcional, solo en la emisión de E: instante ISO-8601 estricto con zona explícita, campo del contrato de la serie; se compara en UTC |
| texto de los campos | `de`, `a`, `emisor`, `denominacion`, `ambito` y `escala` no llevan `\|`, `:` ni `/`, los separadores de las claves de serie (PR #41): ni las identidades ni las denominaciones. Una denominación con hora (`cama@2026-11-13T00:00`) se rechaza; con fecha sola, no. |
| `a` | identidad o `null`. `null` = **consumo**. |
| `de` y `a` | ambos presentes; no pueden ser `null` los dos |

```js
SERIE                 // { T: ['escala'], E: ['emisor', 'denominacion'], P: ['ambito'], R: ['emisor'] }
TIPOS, EMITEN         // ['persona', 'grupo', 'cosa'], ['persona']: quién puede emitir (VG, 7-11 noche)
ESTADOS               // ['bloqueo', 'liberacion']: movimientos que no cambian de titular
topeT(alta, t, escala), TOPE_T_MINIMO  // el tope de T de una persona: ⌈(t − alta) / escala⌉, mínimo 1 (PROVISIONAL [X], §2.4)
validarMovimiento(m)  // → string[]  errores; [] si es válido
claveToken(m)         // → 'T:hora' | 'E:casa/EUR' | 'P:genesis' | 'R:casa' | …   familia + ':' + los campos de SERIE unidos por '/'
partirClave(clave)    // → { token, serie, ...campos }   'E:casa/cama@2026-11-13' → { token: 'E', serie: 'casa/cama@2026-11-13', emisor: 'casa', denominacion: 'cama@2026-11-13' }
cantidadBase(m)       // → m.cantidad: sin conversión, cada serie se cuenta en su propia unidad
```

```sh
node --input-type=module -e "
import { claveToken, cantidadBase, partirClave, validarMovimiento, SERIE, ESCALAS_T, MAXIMO_ESCALAS_T, SEGUNDOS } from './src/tokens.js';
console.log(claveToken({ token: 'T', escala: 'hora', cantidad: 1 }), cantidadBase({ token: 'T', escala: 'hora', cantidad: 1 }), claveToken({ token: 'T', escala: 'minuto', cantidad: 60 }));
console.log(claveToken({ token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 12 }), claveToken({ token: 'P', ambito: 'genesis' }), claveToken({ token: 'R', emisor: 'casa' }));
console.log(JSON.stringify(SERIE), ESCALAS_T.length, MAXIMO_ESCALAS_T, SEGUNDOS.anio / 86400);
console.log(JSON.stringify(partirClave('E:casa/cama@2026-11-13')));
console.log(JSON.stringify(validarMovimiento({ token: 'T', cantidad: 0, escala: 'mes', de: 'a' })));
console.log(JSON.stringify(validarMovimiento({ token: 'E', cantidad: 1, escala: 'hora', de: null, a: null })));
console.log(JSON.stringify(validarMovimiento({ token: 'E', emisor: 'a', denominacion: 'EUR', cantidad: 1, de: null, a: 'b' })));
console.log(JSON.stringify(validarMovimiento({ token: 'T', escala: 'hora', cantidad: 0.5, de: 'a', a: null })));
"
```

```text
T:hora 1 T:minuto
E:casa/EUR P:genesis R:casa
{"T":["escala"],"E":["emisor","denominacion","registro"],"P":["ambito"],"R":["emisor"]} 7 10 365
{"token":"E","serie":"casa/cama@2026-11-13","emisor":"casa","denominacion":"cama@2026-11-13"}
["cantidad debe ser > 0","escala T inválida: mes","de y a son obligatorios (null permitido)","a debe ser identidad o null"]
["escala solo en T","E exige denominación","E exige emisor: la serie es de quien la emite","movimiento sin origen ni destino"]
["la emisión de E va a su propio emisor"]
["T va en enteros: cada escala es un token"]
```

Todos los errores de `validarMovimiento` (en un evento salen como `evento mal formado: movimiento <i>: <error>`, §1.3):

| Error | Causa |
|---|---|
| `movimiento no es objeto` / `token desconocido: <x>` / `cantidad debe ser > 0` | forma básica |
| `escala T inválida: <x>` / `T va en enteros: cada escala es un token` / `escala solo en T` | la escala de T |
| `E exige denominación` / `E exige emisor: la serie es de quien la emite` / `el emisor de E no lleva «/»` / `denominación solo en E` | la serie de E |
| `P exige ámbito: no hay poder total` / `ámbito solo en P` | el ámbito de P |
| `R exige emisor` / `R no es fungible: solo la mueve su emisor <emisor>; quien la tiene solo puede devolvérsela` | la serie de R; el segundo, si `de` no es el emisor ni `null` y `a` no es el emisor: quien tiene R de otro solo puede devolvérsela (regla nueva, **[X] confirmar VG**: antes no podía moverla); tampoco la consume ni la bloquea |
| `estado inválido: <x> (bloqueo o liberacion)` / `<estado>: de y a son el mismo titular (no cambia de manos)` / `<estado> exige salida: la condición de liberación, declarada (no verificable todavía)` / `salida solo con estado (bloqueo o liberacion)` | bloquear y liberar (VG, 7-11 noche) |
| `caduca solo en la emisión de E` / `caduca debe ser instante ISO-8601 con zona explícita` | la caducidad, campo del contrato de una serie de E |
| `la emisión de <E o R> va a su propio emisor` / `emisor solo en E y en R` | emisión a otro; `emisor` en T o P |
| `<campo> no puede llevar \| : ni /` | separadores reservados en `de`, `a`, `emisor`, `denominacion`, `ambito` o `escala` |
| `de y a son obligatorios (null permitido)` / `de debe ser identidad o null` / `a debe ser identidad o null` / `movimiento sin origen ni destino` | origen y destino |

### 2.3 Reglas del eje sobre los movimientos

Las aplica `eje.validar` (§7.4): nadie mueve tokens ajenos (`de` debe ser el autor), y el saldo del autor debe cubrir la suma de lo que mueve **por clave de saldo** (minutos con minutos, horas con horas). El evento mínimo mueve T del autor, en cualquier escala: el coste de escribir es tiempo. `eje.escribir` solo exige que el autor mueva algo de T (cualquier cantidad y escala); el minuto por posición es de `escribirDesde` (`docs/MOTOR.md` §7.2) y del motor, así que escribir con ellos exige `T:minuto`. Emitir (`de === null`): el génesis emite cualquier familia a su autor; después solo emiten las personas, con las reglas de `src/ciclo.js` (§2.4): T para sí mismas con el tope del reloj, P sobre un registro suyo o sobre el que ya tienen P, E y R a su nombre o al de un grupo sobre cuyo registro tienen P, y todo escalonado. Bloquear y liberar (`estado`) mueven entre el disponible y lo bloqueado del autor, por salida; el saldo es lo disponible. La simulación aplica los movimientos **en orden** sobre una vista de los saldos (débitos y abonos), así que lo emitido en un evento puede darse en ese mismo evento.

### 2.4 Emisión de series

Emitir (iniciar una serie o ampliarla) es lo único reservado a las **personas** (VG, 7-11 noche: «todos son emitidos por una persona individualmente»): el tipo se declara en el alta (`contexto.tipos`, §7.1). Un **grupo** es un registro con P delegado: lo que se emite a su nombre (`emisor` = el grupo, en E y R) lo emite y lo firma una persona con P sobre el registro del grupo, que es su alta (`eje.alta(grupo)`); la serie nace en la cartera del grupo. Un grupo y una **cosa** (una habitación, una plaza) son titulares: reciben, conservan y mueven tokens y firman con su clave, pero no emiten. Quien no declaró tipo tampoco emite.

La emisión es escalonada («normalmente será T + (opc) R; si T + R + (opc) P; si T+R+P + (opc) E»): emitir R exige mover T del autor en el mismo evento (consumirlo o darlo a otra identidad: bloquearlo, liberarlo o dárselo a sí mismo no cuenta) y su colateral (R6: R del autor bloqueada con la salida = la serie, la décima parte de lo emitido); P, además, R propia en juego (ese colateral de su propia serie, `R:<autor>`, bloqueado antes o en el mismo evento); E, además, P del autor sobre el registro `sobre` del evento (saldo, o P que mueve o recibe en el propio evento). Y el reloj no va hacia atrás (**[X] confirmar VG**): el `t` de cualquier evento que no sea el génesis no es anterior al de su `sobre` ni al del alta de su autor (el alta toma el `t` del evento que la hace), así que un alta no se retrofecha para ganar T. La tabla completa, con el ciclo de vida de cada familia, está en `docs/FUNDAMENTOS.md`.

- **T** (PROVISIONAL [X] (VG, 7-11 noche): «emitir desde dos fuentes es igual de válido que emitir el doble desde una única fuente; no da más». «T por identidad y reloj» es justo lo que una identidad falsa multiplica, así que la regla final saldrá del estudio de neutralidad ante agrupación y división.): cada persona emite el suyo a sí misma (`a` = el autor). La serie es `T:<escala>`, sin emisor en la clave, para que el T de distintas personas se intercambie. Tope ([X] regla de la época, `tokens.topeT`): por persona y escala, lo emitido acumulado no pasa de ⌈(t − alta) / duración de la escala⌉, con un mínimo de `TOPE_T_MINIMO = 1`; el alta es el `t` del evento en que recibió tokens por primera vez (el génesis, para su autor), y lo emitido en el génesis no cuenta. `eje.emitidoT(persona, escala)` dice cuánto lleva.
- **P**: el génesis emite `P:genesis`; fuera de él, una persona acuña `P:<ámbito>` a sí misma solo si el ámbito es un registro existente que escribió ella. Quien solo tiene P (delegado) lo transfiere, estrechando el ámbito y conservando la cantidad, pero no lo acuña. `genesis` como ámbito solo lo emite el génesis; con el id del génesis lo amplía después su autor (**[X] confirmar VG**).
- **E**: una persona emite una **serie limitada** de una denominación que respalda (la casa emite un token por plaza y noche). La serie es **suya**, como en R: la clave lleva al emisor (`E:casa/cama@2026-11-13`). Por eso nadie se queda un nombre ni emite la denominación de otro: la misma denominación emitida por otro es otra serie (`E:bea/cama@2026-11-13`), y los EUR de la casa no son los de nadie más. Dentro de su serie, E es fungible: la mueve quien la tiene. Y va **atada al registro del recurso** (VG, 7-11 noche; R2): el campo `registro` (el id de un evento del eje) entra en la clave tras la última `@` (`E:casa/cama@2026-11-13@<id>`; una denominación no puede acabar en `@<id>`), y sin él la serie queda atada al registro del emisor. El E vivo de un registro y sus descendientes, por franja (lo que va tras la última `@` de la denominación: la noche en `cama@2026-11-13`; texto opaco cuya granularidad elige el dueño; sin `@`, una sola franja), no pasa de la capacidad que declara cualquier registro de su hilo (un entero en la posición 2 del payload raíz); cada serie emite en proporción al P bloqueado con su clave, o la de su familia (franja `*`), como salida (P del registro que declara la capacidad, o `P:genesis` si nadie emitió ese P), y ese P no se libera mientras la serie viva. Fracciones solo con `divisible: true`; emisión conjunta con `emisores: [...]`. Detalle en `docs/FUNDAMENTOS.md` («E atada al recurso, con tope compartido»).
- **R**: su emisor la declara y solo él la amplía (`R:<emisor>`); cada ampliación es un evento suyo en el eje, y ese es el rastro visible. Sigue sin ser fungible (§2.2): quien la recibe (persona, grupo o cosa) la conserva y no puede pasarla a un tercero, consumirla ni bloquearla; **solo puede devolvérsela a su emisor** (`de`: quien la tiene, `a`: el emisor), que es el acto de «pedir atención» (regla nueva, **[X] confirmar VG**: sale de la «reputación cedida a otros para requerir atención» de VG, 7-11 noche, pero antes quien la tenía no podía moverla). El emisor no la retira por su cuenta: el movimiento saldría de otra cartera y se rechaza ya en la forma (`R no es fungible: …`, la tabla de §2.2). Mientras está en su cartera no obliga a nada; en manos ajenas es la **obligación** del emisor: `eje.obligaciones(emisor)` (derivada de los saldos, no es un token; doble entrada, V10). Un mensaje no emite R. Emitirla exige colateral, el emisor **atiende** una devolución citándola (`contexto.atiende`) y, mientras no lo haga, su colateral no se libera; y la R no tiene un valor propio: vale ante quien la lee, con su lente firmada (R6, `src/lente.js`, `docs/FUNDAMENTOS.md` «La lente de R»). No hay función que liste el rastro: son los eventos del emisor con un movimiento R `de: null` (`eje.series()` da solo el total emitido). [X] decidir VG: si quien la recibe puede rechazarla.

Cómo se nombra la plaza dentro de la denominación no está decidido: el ejemplo de abajo usa `cama@<noche>` con tantos tokens como camas (una serie por habitación y noche); con varias plazas hay que distinguirlas en el nombre (`hab1-cama1@<noche>`, o la dirección de la plaza, como hace Booking: `1100000000@<noche>`, con la habitación como registro de la serie), siempre sin `|`, `:` ni `/`. [X] decidir VG.

La emisión es un movimiento con `de: null`, `emisor` igual al autor del evento (o al grupo en cuyo nombre emite) y `a` igual al emisor: la serie nace en la cartera de quien la emite. Para darla (las plazas a la habitación, la reputación a cocina) se mueve después, en el mismo evento si quiere. La serie es limitada porque solo crece cuando su emisor emite; mover más de lo que hay se rechaza por saldo, y lo emitido de una serie no puede llegar a infinito. Las series de E y R del génesis quedan a nombre de su autor (`Eje.genesis` completa `emisor`). La emisión de E puede llevar `caduca` (ISO): la fija la primera emisión, las ampliaciones coinciden y nada se ejecuta solo al caducar; `caducada(eje, clave, t)` la lee.

```js
eje.tipo(identidad)          // → 'persona' | 'grupo' | 'cosa' | null (sin tipo declarado)
eje.alta(identidad)          // → { id, t } del evento en que recibió tokens por primera vez (el registro de un grupo), o null
eje.emitidoT(persona, escala) // → T que lleva emitido fuera del génesis (para el tope del reloj)
eje.serie(clave)             // → { emisor, emitido } de la serie con esa clave de saldo ({ emisor: null, emitido: 0 } si nadie la ha emitido), y caduca, divisible y emisores si los tiene
eje.series()                 // → [{ clave, token, serie, ...campos, emisor, emitido, bloqueado, caduca, registro, consumido, divisible, emisores, tope, nota (solo E) }] todas las series emitidas, por orden de emisión
eje.vivo(clave, t)           // → E vivo de una serie: emitido − consumido, y 0 si caducó en t (R2)
eje.registroDe(clave)        // → el registro al que está atada una serie de E: el de su clave o el de su emisor
eje.topes(registro, t, franja) // → [{ registro, capacidad, franja, vivo, libre }] por cada registro de su hilo que declara capacidad y cada franja (R2)
eje.bloqueado(id, clave)     // → lo bloqueado de esa serie en id (con un tercer argumento, solo lo de esa salida); eje.saldo es lo disponible
eje.bloqueos(id)             // → [{ clave, ...campos, salida, cantidad }]
eje.obligaciones(emisor)     // → su R en manos ajenas
caducada(eje, clave, t)      // → true si la serie de E tiene caducidad y t ya la alcanza
```

```sh
node --input-type=module -e "
import { Eje } from './src/eje.js';
const t = '2026-11-07T09:00:00Z';
const gasta = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });
const da = (a, cantidad) => ({ token: 'T', escala: 'minuto', cantidad, de: 'casa', a });
const emite = (emisor, denominacion, cantidad) => ({ token: 'E', emisor, denominacion, cantidad, de: null, a: emisor });
const cama = (cantidad, de, a) => ({ token: 'E', emisor: 'casa', denominacion: 'cama@2026-11-13', cantidad, de, a });
const enJuego = (persona, a) => [{ token: 'R', emisor: persona, cantidad: 2, de: null, a: persona }, { token: 'R', emisor: persona, cantidad: 0.5, de: persona, a: persona, estado: 'bloqueo', salida: 'R:' + persona }, { token: 'R', emisor: persona, cantidad: 1, de: persona, a }];
const eje = await Eje.genesis({ demostracion: true, identidad: 'casa', tipo: 'persona', emision: [{ token: 'T', escala: 'minuto', cantidad: 60 }, { token: 'E', denominacion: 'EUR', cantidad: 500 }, { token: 'P', cantidad: 5, ambito: 'genesis' }], foco: 'Casa', t });
const alta = await eje.escribir({ autor: 'casa', sobre: eje.genesisId, t, movimientos: [gasta('casa'), da('bea', 5), da('hab-2', 5), { token: 'P', cantidad: 1, ambito: 'genesis', de: 'casa', a: 'bea' }], payload: 'altas', contexto: { tipos: { bea: 'persona', 'hab-2': 'cosa' } } });
const plazas = await eje.escribir({ autor: 'casa', sobre: alta.id, t, movimientos: [gasta('casa'), ...enJuego('casa', 'bea'), emite('casa', 'cama@2026-11-13', 2), cama(2, 'casa', 'hab-2')], payload: 'dos camas el 13-11, para la habitación 2' });
console.log(JSON.stringify(eje.serie('E:casa/cama@2026-11-13')), JSON.stringify(eje.recursos('hab-2')), eje.tipo('hab-2'));
await eje.escribir({ autor: 'bea', sobre: plazas.id, t, movimientos: [gasta('bea'), ...enJuego('bea', 'casa'), emite('bea', 'cama@2026-11-13', 1)], payload: 'la mía' });
console.log(JSON.stringify(eje.serie('E:bea/cama@2026-11-13')), JSON.stringify(eje.serie('E:casa/cama@2026-11-13')));
await eje.escribir({ autor: 'bea', sobre: plazas.id, t, movimientos: [gasta('bea'), emite('casa', 'cama@2026-11-14', 1)], payload: 'x' }).catch((e) => console.log(e.message));
await eje.escribir({ autor: 'hab-2', sobre: plazas.id, t, movimientos: [gasta('hab-2'), emite('hab-2', 'cama@2026-11-13', 1)], payload: 'x' }).catch((e) => console.log(e.message));
await eje.escribir({ autor: 'hab-2', sobre: plazas.id, t, movimientos: [gasta('hab-2'), cama(3, 'hab-2', 'bea')], payload: 'x' }).catch((e) => console.log(e.message));
await eje.escribir({ autor: 'hab-2', sobre: plazas.id, t, movimientos: [gasta('hab-2'), cama(1, 'hab-2', 'bea')], payload: 'reserva de bea' });
await eje.escribir({ autor: 'casa', sobre: plazas.id, t, movimientos: [gasta('casa'), { token: 'R', cantidad: 10, emisor: 'casa', de: null, a: 'casa' }, { token: 'R', cantidad: 1, emisor: 'casa', de: 'casa', a: 'casa', estado: 'bloqueo', salida: 'R:casa' }, { token: 'R', cantidad: 2, emisor: 'casa', de: 'casa', a: 'bea' }], payload: 'reputación de la casa' });
await eje.escribir({ autor: 'casa', sobre: plazas.id, t, movimientos: [gasta('casa'), { token: 'T', escala: 'hora', cantidad: 1, de: null, a: 'casa' }], payload: 'mi hora' });
await eje.escribir({ autor: 'casa', sobre: plazas.id, t, movimientos: [gasta('casa'), { token: 'T', escala: 'hora', cantidad: 1, de: null, a: 'casa' }], payload: 'otra hora' }).catch((e) => console.log(e.message));
console.log(eje.saldo('bea', 'E:casa/cama@2026-11-13'), JSON.stringify(eje.reputaciones('bea')));
console.log(eje.series().map((x) => x.clave + ' ' + x.emitido).join(' · '));
"
```

```text
{"emisor":"casa","emitido":2} [{"emisor":"casa","denominacion":"cama@2026-11-13","cantidad":2}] cosa
{"emisor":"bea","emitido":1} {"emisor":"casa","emitido":2}
evento rechazado: nadie emite en nombre de otro: casa no es el autor
evento rechazado: solo las personas emiten: hab-2 es cosa; emitir E exige R propia en juego: R:hab-2 bloqueada como colateral (salida «R:hab-2»), al menos la décima parte de lo emitido de R:hab-2, antes o en el mismo evento (R6); emitir E exige P del autor sobre el registro 4220ab3d (saldo o movimiento de P en el mismo evento)
evento rechazado: saldo insuficiente de E:casa/cama@2026-11-13 en hab-2
evento rechazado: tope de T:hora para casa: llevaría 2 emitido y el reloj da 1 desde su alta (2026-11-07T09:00:00Z)
1 [{"emisor":"casa","cantidad":3},{"emisor":"bea","cantidad":0.5}]
T:minuto 60 · E:casa/EUR 500 · P:genesis 5 · R:casa 12 · E:casa/cama@2026-11-13 2 · R:bea 2 · E:bea/cama@2026-11-13 1 · T:hora 1
```

### 2.5 P por delegación

VG (7-11): la casa escribe un registro de dominio («Alojamiento») y delega P con ese ámbito; recepción autoriza lo que otros proponen en lo que cuelga de ahí y puede delegar hacia abajo. Así funciona ya: P sobre todo el eje solo lo emite el génesis (`P:genesis`); fuera de él, una persona acuña P solo sobre un registro que escribió ella, escalonado (§2.4, VG 7-11 noche), y **una sola vez**: `P:X` es una serie cerrada, y ampliarla es ejecutar una consolidación sobre X que esté autorizada (R3, VG 7-11 noche); quien solo tiene P lo transfiere, no lo acuña; y delegar es mover P con un ámbito más estrecho (un registro), que se debita del ámbito exacto y, si no alcanza, de los que lo cubren (los registros de su hilo y `genesis`), salvo hacia una serie cerrada o hacia la raíz de un dominio ajeno (R3). `eje.poderSobre(identidad, registro)` suma el P cuyo ámbito es `genesis` o un registro del hilo de ese registro. Para autorizar no basta tenerlo: autorizar es **bloquear** P sobre el registro del recurso (la raíz del dominio, **[X] confirmar VG**) y la consolidación queda autorizada cuando lo bloqueado alcanza el umbral del dueño (`docs/MOTOR.md` §4). En Booking, la casa emite su P sobre las Reservas (la raíz de su dominio; el Alojamiento cuelga de ellas y su P respalda las plazas, R2) y delega en recepción más de la mitad: recepción autoriza sola las dos partes de la confirmación. Prueba: `test/eprt.test.js` («P por delegación desde un registro de dominio»), `test/autorizar.test.js`.

- El ámbito lo fija el movimiento (`ambito`), no el `sobre` del evento que delega: la delegación puede escribirse en cualquier sitio.
- El ámbito cubre lo que **cuelga** del registro por `sobre` (su subárbol de hilos), no lo que solo lo referencia: una nota escrita en otra rama que cita el dominio con `{ ref: dominio }` queda fuera.
- Quien recibe P con ámbito puede delegar hacia abajo (un registro que cuelgue del suyo); hacia arriba o de lado se rechaza por saldo: `saldo insuficiente de P sobre el eje en <autor>` (ámbito `genesis`) o `saldo insuficiente de P sobre <id8> en <autor>` (un registro que su P no cubre). Un ámbito que no es un registro del eje: `ámbito desconocido: <id8>` (§7.4).
- El id del génesis también vale como ámbito y autoriza en todo el eje, igual que `'genesis'` (`poderSobre` lo encuentra en el hilo de cualquier registro), pero con otra clave de saldo (`P:<id del génesis>`), y los dos nombres no son intercambiables al delegar. Con P sobre `genesis` se delega con ámbito el id del génesis (`ambitosQueCubren(<id del génesis>)` da `[<id del génesis>, 'genesis']`); con P sobre el id del génesis se delega a cualquier registro o al propio id, pero no con ámbito `'genesis'`, porque `ambitosQueCubren('genesis')` solo da `['genesis']`: `saldo insuficiente de P sobre el eje en <autor>`. [X] decidir VG si el id del génesis como ámbito se rechaza o se trata como `genesis`.

```js
eje.poderes(identidad)              // → [{ ambito, cantidad }]   no hay P total
eje.poderSobre(identidad, registro) // → número: P con ámbito 'genesis' o un registro del hilo de `registro`
eje.ambitosQueCubren(ambito)        // → [ambito, …registros de su hilo, 'genesis']; para 'genesis', ['genesis', id del génesis] (los dos nombran todo el eje)
```

## 3. El payload

### 3.1 Terminales

`esTerminal(x)` es verdadero para exactamente tres formas:

| Terminal | Condición | Ejemplo |
|---|---|---|
| número | `typeof x === 'number'` y finito | `12`, `-0.5` |
| cadena | `typeof x === 'string'` y no vacía | `'Menú del día'`, `'EUR 12'`, `'=LOCAL(1) + 15 min'` |
| referencia | `esReferencia(x)` | `{ ref: '4598…ac91', dir: '1000000000' }` |

No son terminales: `''`, `NaN`, `Infinity`, `true`/`false`, `null`, `undefined`, objetos sin `ref`. Una cadena que empieza por `=` es una fórmula BQL y por `==` un texto escapado: eso lo interpreta BQL, no BTML; para BTML son cadenas.

Pendiente: terminales HTML y archivo (el mapa §2.1 los nombra; hoy un HTML es una cadena y no hay archivos).

### 3.2 Arrays posicionales: décupla y lista, por hojas

Decisión de VG (7-11 noche: por hojas). Una **hoja** es un terminal o una referencia (`esHoja`). Dentro de una posición (fuera de la raíz):

- un array cuyos elementos son **todos hojas** es una **lista** (`esLista`): cada elemento es un **ocupante** de esa posición, con la misma llegada y el mismo encaje que el evento y en el orden de la lista (desempate estable). No tiene tope de diez (el tope por evento lo pone el modo, que cuenta cada elemento: `modos.cabeTope`). Se alcanza por **índice** (`encaje.lista`, BQL `BUSCAR(n, k)` y `LOCAL`), **nunca por dirección**: una dirección que caiga dentro de una lista no existe (§4.4). Está fuera de los dígitos: no lleva PV;
- un array con **al menos un array** dentro es una **décupla** (`esDecupla`): sus índices 0–9 son las subposiciones (los PV aplicados al nodo de arriba, §4.3), direccionables por dígitos. Dentro de una décupla, una hoja suelta es **un** ocupante de esa subposición.

El payload **raíz** es siempre la décupla de lo escrito (la cruceta), aunque sean solo hojas: `['Compra', 1, 'EUR 12']` en la raíz son las posiciones 0, 1 y 2.

**Forma canónica de la décupla y la lista (VG, 8-11).** Estas dos líneas son la forma correcta:

```
menú   = ['Menú del día', ['ensalada', 'guiso', 'fruta']]
compra = ['Compra', [[menú], [1]]]
```

Regla de lectura, en tres frases. El payload raíz es siempre una décupla. Dentro de una posición, un corchete de solo hojas es la **lista** de ocupantes de esa posición, y un corchete que contiene corchetes es una **décupla**. Una hoja suelta en una posición es la lista de un solo ocupante (`1` vale lo mismo que `[1]`); la forma canónica de una décupla de solo hojas es **cada posición entre corchetes** (`[[menú], [1]]`, `[[menú], [1], ['EUR 12']]`), y se retira la convención de envolver solo la posición 0 (`[[menú], 1, 'EUR 12']`, la de la #69), que sigue siendo válida pero no es la canónica.

Nota (VG, 8-11): la posición 0 es el campo libre de cómo se ve y no actúa; `[menú]` puede llevar más ocupantes; el `1` de 1.1 tendría a su vez su 0 si se desarrolla por dirección.

Lectura de `compra`: la 1 es la décupla `[[menú], [1]]`; su 1.0 es la lista `[menú]` (un ocupante: la referencia al menú), su 1.1 la lista `[1]` (un ocupante: la cantidad). `[menú, 1]` sería una lista de dos ocupantes, no una décupla. Los lectores (BQL `LOCAL`/`REF`, `seguir`, el cálculo del tramo y de la capacidad) leen la lista de **un** ocupante como su único ocupante: `['=LOCAL(2) * LOCAL(1)']` es la fórmula, `[ref]` es la referencia, `[1]` es 1; `BUSCAR` y los elementos por índice siguen siendo estructurales (un ocupante por elemento).

Una décupla (y la raíz) tiene **entre 1 y 10 posiciones** (`ARIDAD = 10`), índices 0–9, **sin `null`, `undefined` ni huecos**, y cada posición contiene una hoja u otro array; una lista tiene al menos un elemento, sin huecos ni nulos. Consecuencias:

- No hace falta envolver un terminal en un array de una posición: un payload puede ser un terminal directamente (el génesis de ejemplo es `'Casa de ejemplo'`).
- La información se genera de 0 hacia arriba: **si existe la posición d, existen 0…d−1**. Para escribir en la posición 4 hay que rellenar 0–3, con contenido o con referencias (así lo hacen `escritura.desdeMapped` y `motor.consolidar`: heredan del foco por referencia). `desdeMapped` solo hereda lo que el foco tiene en ese camino exacto (lo que cuelga de un terminal no tiene base, salvo la posición 0 de la raíz de un foco terminal, que se hereda como antes: §4.2), así que una referencia heredada siempre alcanza algo; si el foco no tiene base, no rechaza: ancla lo lejano en su posición con `en` (`docs/MOTOR.md` §7.3).
- Un array de un elemento es válido: en una posición, `[x]` es una lista de uno. La décupla de diez posiciones solo se desarrolla cuando corresponde.
- `validarPayload` no limita la profundidad; `direccion` sí (diez índices). Un nodo por debajo del décimo nivel existe pero no tiene dirección. Pendiente: cambio de foco al agotar diez niveles (mapa §2.1).

`modos.contarPosiciones(payload)` cuenta las posiciones desarrolladas: cada terminal cuenta una (cada elemento de una lista, uno).

### 3.3 Referencias

```js
{ ref: string, dir?: string }   // ref: id completo de otro evento; dir: dirección de diez dígitos dentro de su payload
```

- **No copian.** Lo que hay en el destino se lee al resolver (`encaje.seguir`, `encaje.ocupantes`, BQL `leerSlot`), nunca al escribir.
- `esReferencia` solo comprueba la forma: **exactamente** las claves propias `ref` (cadena no vacía) y, si está, `dir` (dirección válida). Una clave de más (`{ ref, extra }`), un `ref` heredado por prototipo o un `dir` presente pero `undefined` no son referencia: nada más viaja dentro de una referencia. **No se comprueba al escribir que `ref` exista en el eje**: una referencia a un id desconocido se guarda y, al seguirla, sale con `rota: true`, `estado: 'PENDIENTE'` y su `motivo` (el evento puede llegar; no es un error, corpus V4). Tampoco que `dir` exista en ese evento: una referencia a una posición que no desarrolla se guarda y, al seguirla, alcanza `contenido: undefined` **sin** `rota` (BQL la lee PENDIENTE `posición sin desarrollar`).
- `ref` debe ser el **id completo**. Los prefijos (`'bea2e06d'`) solo los resuelven BQL (`REF("bea2e06d")`) y la entrada de texto de `escritura.item` (`'@bea2e06d:1200000000'`), que los convierten en id completo antes de guardar.
- Sin `dir`, la referencia apunta al payload entero (`'0000000000'`).
- `btml.resolver` **no** sigue referencias; `encaje.seguir` sigue cadenas de referencias hasta 20 saltos.

Pendiente: referencias a «una rama» distinta de evento + dirección (mapa §2.1).

### 3.4 `validarPayload`

```js
validarPayload(payload, ruta = '', ancestros, raiz = true)  // → { ok: boolean, errores: string[] }
esHoja(x)      // un terminal o una referencia
esLista(x)     // fuera de la raíz: un array no vacío solo de hojas
esDecupla(x)   // un array con algún array dentro (la raíz siempre lo es)
```

Cada error lleva su ruta: los índices concatenados desde la raíz (`'21'` = posición 2, subposición 1) o `'raíz'`. En la raíz y en las décuplas solo se recorren las posiciones 0–9 (un array más largo ya es error), así que `'10'` es siempre la posición 1, subposición 0. Una lista puede pasar de diez: entonces sus elementos han de ser hojas y no tener huecos (se cuentan sus claves presentes, sin recorrer la longitud).

| Error | Causa |
|---|---|
| `ruta: ni terminal ni array` | booleano, `null` suelto en la raíz, objeto sin `ref`, cadena vacía, `NaN`… |
| `ruta: array vacío` | `[]` |
| `ruta: más de 10 posiciones` | la raíz con más de diez, o un array de más de diez que no es una lista (tiene algún array dentro: una décupla). Se comprueba antes que nada y no se mira dentro |
| `ruta: hueco en la lista` | un array de más de diez fuera de la raíz con posiciones ausentes o nulas: un disperso con una longitud enorme no se recorre |
| `ruta: hueco` | `null` o `undefined` en una posición, o una posición ausente de un array disperso de JavaScript (`Array(3)`, `[1, , 3]`, o un array con solo `[3]` asignado) |
| `ruta: ciclo` | un array que se contiene a sí mismo (no es un árbol) |

```sh
node --input-type=module -e "
import { validarPayload, esTerminal } from './src/btml.js';
console.log(JSON.stringify(validarPayload(['a', ['b', 2], { ref: 'x' }])));
console.log(JSON.stringify(validarPayload(['a', null, ['b', []], true])));
console.log(JSON.stringify(validarPayload([])));
console.log(JSON.stringify(validarPayload(Array(11).fill(1))));
console.log(JSON.stringify(validarPayload(['Mesa', Array(12).fill('invitado')])), JSON.stringify(validarPayload(['Mesa', [...Array(11).fill('x'), ['y']]])));
console.log(esTerminal(''), esTerminal(NaN), esTerminal(true), esTerminal({ ref: 'x', dir: '12' }), esTerminal({ ref: 'x' }));
"
```

```text
{"ok":true,"errores":[]}
{"ok":false,"errores":["1: hueco","21: array vacío","3: ni terminal ni array"]}
{"ok":false,"errores":["raíz: array vacío"]}
{"ok":false,"errores":["raíz: más de 10 posiciones"]}
{"ok":true,"errores":[]} {"ok":false,"errores":["1: más de 10 posiciones (una décupla; solo una lista de hojas pasa de diez)"]}
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
- Un terminal no tiene posición 0 (mapa §12: se retira la convención de la representación). Ni el encaje (`caminosDe` se detiene en él) ni `pointed.decupla` o `mapped.mapa` lo ponen en la posición 0: `decupla` y `mapa` entregan un payload terminal aparte, en `terminal`, con las diez posiciones sin contenido. En la escritura de Mapped, en cambio, la raíz de un foco terminal (el foco, o su nodo bajo el camino) hereda su posición 0 como en main y antes de la matriz: `desdeMapped` la rellena con `{ ref: foco, dir: direccion([...camino, 0]) }`, que alcanza el terminal por la colisión de ceros finales (`resolver(terminal, '0000000000')` da el terminal); lo demás que cuelga de un terminal no tiene base. **Pendiente** de decisión (mapa §12: «un terminal no tiene posición 0 (PENDIENTE)»; mapa §13; **[X] decidir VG**).

### 4.3 Significado de los dígitos: época 0

La época es una convención paralela, **fuera del dato**: BTML no lleva época dentro y cualquier dirección se lee desde cualquier época. Las épocas viven como datos en `datos/epocas/*.json` (copia generada en `datos/epocas/epocas.js`). La decidida es `EPOCA_0`, que son las **cien reglas cortas** (VG, 7-11 noche): en la profundidad 0, la cruceta, **cada dígito es un punto de vista** sobre el registro en foco (tabla siguiente); en toda profundidad n ≥ 1, **el dígito es el PV aplicado al nodo de arriba**: 0 qué es, 1 cuánto, 2 con qué condición, 3 con quién, 4 qué se hace, 5 dónde encaja, 6 de dónde viene, 7 para cuándo, 8 frente a otros, 9 cómo. Las reglas largas, que especializan rutas completas, son lo que pulen las épocas futuras. Las cien reglas, con ejemplos, en `docs/REGLAS_CORTAS.md`.

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
EPOCA_0.reglaCorta(profundidad, digito)  // → PV[digito] en la profundidad 0; en las demás, el PV aplicado al nodo de arriba ('qué es', 'cuánto', 'con qué condición'…)
leerDireccion(dir, epoca = EPOCA_0)      // → [{ profundidad, digito, significado }] una entrada por índice real (más `larga: ruta` si una regla larga especializa esa ruta); epoca por objeto o por nombre ('época 0')
EPOCAS                                   // { 'época 0': EPOCA_0 }
epocaDe(epoca = EPOCA_0)                 // → la época, por objeto o por nombre; un nombre que no existe (también 'época 1' y 'época 1 (propuesta)', retirada) lanza «época desconocida»
cargarEpoca(datos, { respaldo })         // → época desde { nombre, estado, principios, ordinales?, reglas, dudas }; en `reglas`, cortas { profundidad, digito, … } y largas { ruta, … } (ruta de 2 a 10 dígitos)
epoca.reglaLarga(ruta) / epoca.larga(ruta) / epoca.largas  // nombre, regla entera y lista de las reglas largas propias; la larga de una ruta exacta gana a la corta en leerDireccion
epoca.cortes(clave)                      // → nueve umbrales crecientes de las cajas del 8 para esa medida o serie, o undefined (mapa §12 [D]: «Cortes de las cajas = regla de la época»); la época 0 aún no los trae en sus datos
epoca.ordinal(profundidad)               // → true donde el dígito es orden (gancho del encaje); ninguna en la época 0
pointed.decupla(ev, epoca = EPOCA_0, profundidad = 0)  // → { id, autor, t, sobre, en, terminal, posiciones: [{ indice, significado, contenido }] × 10 }; terminal: el payload si es un terminal (sin posición 0), si no undefined; epoca por objeto o por nombre
sequenced.secuencia(eje, id, { epoca })  // igual: objeto o nombre
mapped.mapa(eje, id, { camino, epoca })  // igual: objeto o nombre
```

Las reglas cortas nombran **subposiciones de décuplas** (y las escritas por dirección, `en`); nunca los elementos de una lista (por hojas, VG 7-11 noche; §3.2). Vuelve la regla corta por profundidad de la PR #58 («compra 1.1 = cuánto»), que la PR #64 había retirado al leer todo array como lista. Una dirección se lee sin mirar el payload; con el payload, `leerCamino` y `nombreEnNodo` nombran los índices de una lista como ocupantes:

```js
leerDireccion(dir, epoca)                  // regla corta (o larga) por dígito: una dirección solo nombra subposiciones de décuplas
leerCamino(indices, epoca, { payload })    // en una décupla, la regla; un índice que cae en una lista (profundidad ≥ 1) → { profundidad, digito, ocupante, posicion, significado: 'ocupante 2 de la posición 3' }, sin regla corta ni larga
nombreEnNodo(nodo, profundidad, digito, epoca)  // → { ocupante, significado: 'ocupante k' } si profundidad ≥ 1, el nodo es una lista y el dígito cae en ella; si no, { significado: regla corta }
```

`pointed.decupla` (con `profundidad` ≥ 1) y `mapped.mapa` (con `camino`) nombran así sus posiciones: bajo la posición 1 de la compra (una décupla) salen las reglas cortas de la profundidad 1 («qué es», «cuánto», «con qué condición»…); bajo la 1 del menú (la lista de platos) salen «ocupante 1», «ocupante 2», «ocupante 3» y la lista entera en `lista`, y en lo que la lista no ocupa, las reglas cortas.

La «época 1 (propuesta)» se retiró como época (VG, 7-11 noche): sus preguntas son las reglas de las profundidades 1 a 9 de la época 0 (`docs/REGLAS_CORTAS.md`). El nombre «época 1» queda libre para la primera época que pula reglas largas; el cargador ya las admite, y todavía no hay contenido de reglas largas.

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
0:1=recursos 1:2=con qué condición
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
resolver(payload, dir)  // → contenido en esa dirección, o undefined si el camino atraviesa un terminal, una posición ausente o una lista
dentroDeLista(payload, dirOIndices)  // → el camino de la lista en la que entra esa dirección, o null
nodoEn(payload, indices)             // → el nodo en ese camino, bajando por la raíz y por décuplas
```

Desciende por los índices reales (`indicesDe`). No sigue referencias: si el camino pasa por una referencia, devuelve `undefined` más allá de ella. **Nunca entra en una lista** (por hojas, VG 7-11 noche): en la dirección de la lista devuelve el array entero; una dirección que siga dentro (la 1.1 del menú, cuya 1 es la lista de platos) no existe y da `undefined`, lo mismo que una posición vacía. Los ocupantes de una lista se alcanzan por índice (§6.7).

```sh
node --input-type=module -e "
import { ejemploCompra } from './ejemplos/ikisai/compra-food.mjs';
import { resolver } from './src/btml.js';
const { eje, compra, menu } = await ejemploCompra();
console.log(JSON.stringify(resolver(compra.payload, '1200000000')));
console.log(JSON.stringify(resolver(compra.payload, '1000000000')));
console.log(resolver(compra.payload, '1020000000'), resolver(compra.payload, '7000000000'));
const r = resolver(compra.payload, '1000000000')[0][0];
console.log(r.ref === menu.id, JSON.stringify(resolver(eje.obtener(r.ref).payload, r.dir)), resolver(menu.payload, '1100000000'));
"
```

```text
["EUR 12"]
[[{"ref":"d367743bd56eb5f722ace18466010fa58b34f366675675f6e086c447fac45c97","dir":"1000000000"}],[1],["EUR 12"]]
undefined undefined
true ["ensalada","guiso","fruta"] undefined
```

## 5. Anclaje hijo → padre: `sobre` y `en`

Un evento declara dónde se anida: `sobre` es el id del registro en foco y `en` la dirección, dentro del payload de ese foco, donde se cuelga. **El padre no lista a sus hijos**; el eje los encuentra recorriendo la lista de eventos (`eje.sobre`).

- Lo escrito es el **payload entero** del hijo; `en` es el anclaje, no un hueco que se rellena en el array del padre. El payload del padre no cambia nunca.
- `en` forma parte del cuerpo y por tanto del id: el mismo contenido anclado en dos posiciones son dos eventos distintos.
- Por defecto `en = RAIZ = '0000000000'`. Como `'0000000000'` también nombra la posición 0, anclar en la raíz y anclar en la posición 0 de profundidad 0 es lo mismo (límite conocido).
- El génesis tiene `sobre: null` y solo admite `en` raíz. Cualquier otro evento necesita un `sobre` que exista en el eje.
- **Hilo**: la cadena `evento → sobre → sobre → … → génesis`. Es una cadena por referencia, no un orden temporal.
- `en` puede ser **cualquier** dirección válida del foco, la desarrolle o no su payload: el ejemplo de abajo ancla una nota en `7000000000` de una compra que no tiene posición 7. El eje no comprueba que la posición exista.
- Varios escritos en la misma dirección salen **en orden de entrada en el eje**, no por `t`: un escrito con un `t` anterior que entra después sale detrás.
- Dónde anclar es decisión de quien escribe; el código no la toma. Decidido por VG para la reserva de alojamiento (mapa §12, 7-11): la reserva se ancla **en la plaza**, dentro de los recursos de la disponibilidad (`sobre: disponibilidad`, `en: direccion([1, k])`; para la plaza 1.1, `'1100000000'`), las noches van en el 7 de la propia reserva, y las reservas de la misma plaza colisionan en esa dirección (§6). Si las noches van dentro, las posiciones sin contenido propio que preceden a la 7 (5 y 6) tienen que llevar algo y no «no aplicable» (mapa §12, «Posiciones sin contenido»: «celdas sin cambio = referencia al foco»), pero ni el mapa ni el código fijan qué `dir` llevan. El extranjero de la ronda 2 (`docs/notas/PRUEBA_DEL_EXTRANJERO.md`, R2.2) puso referencias al foco con el camino del anclaje (`{ ref: disponibilidad, dir: direccion([1, k, 5]) }` y lo mismo con 6). Se parecen a las heredadas de `consolidar` con `camino` solo en la forma: `consolidar` hereda una posición únicamente si el foco tiene ocupantes en ella, y aquí rechazaría con `hueco en 5: elige algo o quita las posiciones siguientes`; `desdeMapped` tampoco las fabrica: sin base en 5 y 6, no las rellena y ancla la 7 aparte en el foco (lo lejano por anclaje, abajo). Esas referencias **no alcanzan nada**, porque la disponibilidad no desarrolla 1.k.5 ni 1.k.6 (la plaza es un terminal o una subdécupla corta): `seguir` da `contenido: undefined` sin `rota` (§3.3) y BQL las lee PENDIENTE. [X] decidir VG: las noches dentro del payload de la reserva (y entonces qué llevan 5 y 6: referencias así, que no alcanzan nada, u otra cosa) o ancladas aparte en el 7 de la reserva (`sobre: reserva`, `en: '7000000000'`: lo lejano por anclaje, abajo), que no obliga a rellenar 5 y 6. Con la capacidad como serie limitada (§2.4), la segunda reserva solapada se escribe y colisiona en la plaza, pero su ejecución se rechaza por saldo (`docs/MOTOR.md` §5). Para otros casos no hay criterio escrito: [X] decidir VG.
- **Lo lejano por anclaje** (mapa §12, «Posiciones sin contenido»: «celdas sin cambio = referencia al foco», «lo lejano = anclaje»). Una celda que cae lejos del prefijo desarrollado (la 9 de una décupla que llega a la 3) no se escribe dentro rellenando 4–8, sino como registro aparte anclado con `en`. **Dónde** se ancla no lo decide el mapa: el §12 solo dice «lo lejano = anclaje», y el §13 fija las coordenadas de la matriz de salida de la fábrica («la celda i.j.k bajo el camino c se escribe en `direccion([...c, i, j, k])`»), no de qué registro cuelga el ancla. Hay dos sitios, los dos BTML válidos, y cambian quién ve la celda: **en el foco**, en la dirección de la celda bajo el camino (la ve quien busca en el foco; así lo hace `desdeMapped` desde la #40), o **en la propia décupla** (la ve quien busca en la décupla y no quien busca en el foco; así lo hizo el extranjero de la ronda 2). Mientras no se decida, lo elige quien escribe. `desdeMapped` ancla en el foco (`docs/MOTOR.md` §7.3); `consolidar` no ancla: rechaza el hueco (`docs/MOTOR.md` §3.4). [X] decidir VG: dónde se ancla lo lejano, en el foco o en la décupla.

```js
eje.sobre(id, en?)  // → hijos directos de `id`, en orden de entrada; con `en`, solo los anclados en esa dirección
eje.hilo(id)        // → [evento, su foco, el foco de su foco, …, génesis]
eje.obtener(id)     // → evento o undefined
eje.conPrefijo(p)   // → ids que empiezan por p, en orden de entrada (lo que resuelven «@id», REF("id") y las aristas de fórmula de Scened)
```

`sobre(id, en)` y `conPrefijo(p)` van por índices que el eje mantiene al añadir (por dirección de anclaje y por los cuatro primeros caracteres del id): devuelven lo mismo que filtrar los hijos o `eje.orden`, sin recorrerlos. Coste medido en `docs/notas/RENDIMIENTO.md`.

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
ee80a426@1000000000 33abc96a@7000000000
1 0
true 1000000000 7000000000
```

Pendiente: si una hilera (Sequenced) o una décupla (Mapped) deben poder anidarse en una posición concreta o siempre en la raíz (mapa §10.6).

## 6. Colisiones y encaje

Una dirección puede tener **varios ocupantes**. Eso es el estado normal, no un error: nada se sobrescribe ni se borra. Corregir es añadir un ocupante. El árbol lógico se reconstruye desde los eventos; no se guarda.

### 6.1 Qué ocupa una dirección

`ocupantes(eje, id, indices)` reúne, para la dirección `direccion(indices)` del registro `id`, tres clases de ocupantes. `indices` es un **array de índices** (`[1]`, `[1, 2]`), no una dirección de diez dígitos: `ocupantes(eje, id, '1000000000')` lanza `RangeError: entre 0 y 10 índices` (BQL, en cambio, acepta las dos formas). Orden de llegada: cada camino propio y, si ese camino es una referencia, inmediatamente lo que alcanza; al final, los escritos.

| `origen` | Qué es | De dónde sale |
|---|---|---|
| `'propio'` | Cada camino del payload de `id` que colisiona en esa dirección (por los ceros finales: `[1]`, `[1,0]`, `[1,0,0]`…, sin entrar en una lista). Si el camino es una **lista** (por hojas), no es un ocupante: lo es **cada elemento**, con `enLista: true` e `indice` | `caminosDe(payload, dir)` |
| `'referencia'` | Lo que alcanza cada ocupante propio que es una referencia, con la cadena de procedencia | `seguir(eje, ref, procedencia)` |
| `'escrito'` | Cada evento hijo anclado en esa dirección (`sobre === id` y `en === dir`), con su payload entero | `eje.sobre(id, dir)` |

### 6.2 Forma de un ocupante

| Campo | Contenido |
|---|---|
| `origen` (= `tipo`) | `'propio'`, `'referencia'` o `'escrito'`. BQL lo expone como `ORIGEN()`. |
| `evento` | Id del evento donde vive el contenido: `id` (propio), el evento alcanzado (referencia), el hijo (escrito). |
| `dir` | Dirección dentro de `evento`: la buscada (propio), la alcanzada (referencia), `'0000000000'` (escrito). |
| `camino` | Índices exactos **dentro de `evento`**: `[1]`, `[1, 0]` (propio, dentro del foco); `indicesDe(dir)` (referencia, dentro del registro alcanzado, no del foco); `[]` (escrito, su payload entero). El camino por el que se llegó desde el foco solo está en `procedencia`. |
| `contenido` | Lo que hay ahí; `undefined` si la referencia está rota. |
| `enLista`, `indice` | Solo en un elemento de una lista (por hojas): `true` y su lugar en la lista. Su `camino` es el de la posición de la lista y su procedencia acaba en `[k]` (`'<id>:<dir>#3[1]'`). Los elementos de una lista comparten llegada y encaje (mismo vector, acuerdo y signo): empatan y el orden estable los deja en el orden de la lista. |
| `procedencia` | Cadena de pasos. Propio: `['<id>:<dir>#<camino con puntos>']`. Referencia: el paso propio seguido de `'<id alcanzado>:<dir>'` por salto. Escrito: `['<id hijo>:0000000000']`. |
| `autor`, `t` | Solo en escritos. |
| `rota` | `true` si la referencia no llegó a un evento: id desconocido o más de 20 saltos (solo en referencias). Una referencia a una posición que el evento no desarrolla da `contenido: undefined` **sin** `rota`. Cuando no hay rotura el campo **no existe** (no es `false`). |
| `estado`, `motivo` | Solo en una referencia a un evento que no está en el eje: `'PENDIENTE'` y `'evento ausente del eje: <id8>'`. Puede llegar: no es un error. |
| `origenDir`, `destino` | `destino` es la dirección buscada. `origenDir` es la dirección del candidato: la buscada (propio), la alcanzada en el otro registro (referencia), y **la de su anclaje `en`**, que es la buscada (escrito). Por eso propios y escritos son siempre encaje exacto y solo una referencia que alcanza otra dirección tiene vector distinto de cero. Para un escrito, `dir` (`0000000000`, su raíz) y `origenDir` (su anclaje) no coinciden: son cosas distintas. |
| `vector`, `distancia`, `acuerdo`, `signo`, `faltas`, `excedentes` | El encaje del candidato (`origenDir`) en lo buscado (`destino`) (§6.5). |
| `empate`, `empatados` | `true` si el encaje no lo separa de otro ocupante (mismo acuerdo y, en las profundidades que la época declare ordinales, misma distancia), y con cuántos; entre ellos decide la llegada. |
| `justificacion` | Texto: de dónde viene, cómo encaja y si empata. Por ejemplo `'escrito por raiz, anclado en 1000000000; encaje exacto; empata con 2 (decide la llegada)'`. Solo informa. |

```js
caminosDe(payload, dir)                        // → [{ indices, contenido }] el camino base y los caminos con un 0 más mientras haya posición 0 (sin entrar en una lista)
ocupantes(eje, id, indices, { orden = 'encaje', epoca, exacto = false } = {})  // → ocupante[]; orden 'encaje' (por defecto) o 'llegada'; la época dice qué profundidades son ordinales; exacto: solo el camino `indices` tal cual (BQL `BUSCAR` por índice), sin la colisión por ceros
seguir(eje, ref, procedencia = [])             // → ocupante de origen 'referencia' tras seguir hasta 20 saltos; rota: true si no llega
marcarEmpates(lista, { epoca } = {})           // → la lista con empate y empatados en cada ocupante
justificar(ocupante)                           // → string, la justificación de un ocupante ya marcado
caminoDe(o)                                    // → o.camino ?? indicesDe(o.dir)
```

### 6.3 Ejemplo real: la posición 1 de la compra

En la compra, la dirección `1000000000` tiene cuatro ocupantes una vez escrita la cuenta: la posición 1 (la décupla), el elemento de la 1.0 (la lista de uno con la referencia al menú), lo que alcanza esa referencia (la lista de platos del menú, entera) y la cuenta de cocina, anclada en `1000000000`.

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
console.log(ocupantes(eje, compra.id, [3]).map((o) => o.indice + ':' + o.contenido).join(' '));
"
```

```text
[[1],[1,0]]
propio [1] bea2e06d 1000000000 [0,0,0,0,0,0,0,0,0,0] exacto 10 ["bea2e06d:1000000000#1"]
propio [1,0] bea2e06d 1000000000 [0,0,0,0,0,0,0,0,0,0] exacto 10 ["bea2e06d:1000000000#1.0[0]"]
referencia [1] d367743b 1000000000 [0,0,0,0,0,0,0,0,0,0] exacto 10 ["bea2e06d:1000000000#1.0[0]","d367743b:1000000000"]
escrito [] ee80a426 1000000000 [0,0,0,0,0,0,0,0,0,0] exacto 10 ["ee80a426:0000000000"]
4 1 0
["ensalada","guiso","fruta"] "Cuenta del menú"
0:huesped 1:cocina
```

Los cuatro son encaje exacto (el elemento de la 1.0 lleva `enLista` e `indice: 0`, y la 3, `['huesped', 'cocina']`, da un ocupante por elemento): la cuenta está anclada justo en `1000000000`, así que su `origenDir` es esa dirección (§6.2). Como empatan en acuerdo, salen en orden de llegada. Contar los ocupantes de una dirección cuenta también la colisión por ceros: `[1]` y `[1, 0]` son dos ocupantes aunque el segundo sea la posición 0 del primero (decisión de VG, «colisiones, no apaños», mapa §12: la dirección nombra la colisión entera; buscar por índice, decidido como camino exacto, aún no existe: `docs/BQL.md` §11).

Un ocupante completo, tal como lo devuelve `ocupantes` (el tercero, la referencia seguida):

```json
{
  "tipo": "referencia",
  "origen": "referencia",
  "evento": "d367743bd56eb5f722ace18466010fa58b34f366675675f6e086c447fac45c97",
  "dir": "1000000000",
  "camino": [1],
  "contenido": ["ensalada", "guiso", "fruta"],
  "procedencia": [
    "bea2e06df3f8ce56b2b3670c4281dfc33dc2a88fa380f8e0a8e5f3477a1ee810:1000000000#1.0",
    "d367743bd56eb5f722ace18466010fa58b34f366675675f6e086c447fac45c97:1000000000"
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

`seguir` parte de una referencia y salta mientras el contenido alcanzado sea otra referencia (máximo 20 saltos). Devuelve un ocupante de origen `'referencia'`; si el id no existe o se agotan los saltos, `contenido` es `undefined` y `rota` es `true`. Si el id no existe, además `estado: 'PENDIENTE'` y `motivo` (el evento puede llegar).

```sh
node --input-type=module -e "
import { ejemploCompra } from './ejemplos/ikisai/compra-food.mjs';
import { seguir } from './src/encaje.js';
const { eje, compra } = await ejemploCompra();
const r = seguir(eje, compra.payload[1][0][0]);
console.log(r.evento.slice(0, 8), r.dir, JSON.stringify(r.camino), JSON.stringify(r.contenido), r.rota, JSON.stringify(r.procedencia.map((p) => p.slice(0, 8))));
const rota = seguir(eje, { ref: 'ffff' });
console.log(rota.rota, rota.contenido, JSON.stringify(rota.procedencia));
"
```

```text
d367743b 1000000000 [1] ["ensalada","guiso","fruta"] undefined ["d367743b"]
true undefined []
```

### 6.5 Vector, distancia y orden

Para cada ocupante se compara la dirección del candidato (`origenDir`) con la dirección buscada (`destino`). Convención vigente desde la PR #28 (opción B de `docs/notas/SIGNO_DEL_VECTOR.md`, elegida por VG el 7-11, mapa §12): **candidato − buscado**, como el ejemplo del corpus «+2 en el quinto dígito».

```js
vector(candidato, buscado)  // → [d0 … d9]  candidato − buscado, dígito a dígito, con signo (−9…9 por componente)
distancia(v)                // → [|d0| … |d9|]  siempre positiva; información (solo ordena donde la época haga ordinal la profundidad; en la época 0, en ninguna)
acuerdo(v)                  // → número de ceros seguidos desde la profundidad 0 (10 = encaje exacto)
signo(v)                    // → 'exacto' | 'completar' (solo negativos) | 'reducir' (solo positivos) | 'mixto'
faltas(v)                   // → cuántas componentes < 0 (al candidato le falta en esa profundidad: completar)
excedentes(v)               // → cuántas componentes > 0 (al candidato le sobra en esa profundidad: reducir)
norma(v)                    // → suma de |d|; medida de consulta (BQL DESPLAZAMIENTO()), no criterio de orden
ordenarPorEncaje(lista, { epoca } = {})  // → nueva lista ordenada por `.vector`, sin quitar nada
```

Orden por encaje (`ordenarPorEncaje`, el orden por defecto de `ocupantes` y de BQL `BUSCAR`):

1. más profundidades de acuerdo primero (el acuerdo de prefijo: los exactos, con acuerdo 10, van delante);
2. a igual acuerdo, menor distancia **solo en las profundidades que la época declare ordinales** (`epoca.ordinal(profundidad)`), comparando profundidad a profundidad, sin sumar. La época 0 no declara ninguna (sus dígitos son nominales: cada uno es un PV), así que hoy este paso no hace nada; `BUSCAR` no pasa época;
3. a igual de lo anterior, el orden de llegada.

El signo **no ordena**, ni la distancia salvo en una profundidad que una época haga ordinal (opción B de `docs/notas/SIGNO_DEL_VECTOR.md`, decidida por VG el 7-11 por la tarde, mapa §12 [D]): es informativo por componente (positivo = al candidato le sobra, negativo = le falta) y `signo(v)` resume el vector entero. Ni el signo ni la distancia ordenan en la época 0: son información (el corpus prohíbe «puntuar por cercanía ciega»). Un escrito anclado en la dirección buscada encaja exacto. Consecuencia práctica: como propios y escritos son siempre exactos (§6.2), el vector solo se separa de cero en una **referencia** que alcanza otra dirección, y casi todo el orden de una posición es el de llegada. Pendiente: cómo cambia el vector con la época, qué profundidades declara ordinales una época (la época 0 no declara ninguna, `docs/REGLAS_CORTAS.md`) y las reglas por dimensión que dirían dónde cuenta el signo; la orientación (la opción E de la nota) queda apuntada (VG, 7-11, mapa §12).

```sh
node --input-type=module -e "
import { vector, distancia, acuerdo, signo, faltas, excedentes, norma, ordenarPorEncaje } from './src/encaje.js';
const v = vector('1230000000', '1200000000');
console.log(JSON.stringify(v), JSON.stringify(distancia(v)), acuerdo(v), signo(v), faltas(v), excedentes(v), norma(v));
console.log(JSON.stringify(vector('1000000000', '1200000000')), signo(vector('1000000000', '1200000000')));
console.log(JSON.stringify(vector('1700000000', '2300000000')), signo(vector('1700000000', '2300000000')));
const lista = [
  { nombre: 'ref desde 7', vector: vector('7000000000', '2000000000') },
  { nombre: 'ref desde 3', vector: vector('3000000000', '2000000000') },
  { nombre: 'exacto', vector: vector('2000000000', '2000000000') },
  { nombre: 'desvio hondo', vector: vector('2300000000', '2000000000') },
  { nombre: 'escrito en 2', vector: vector('2000000000', '2000000000') },
];
console.log(ordenarPorEncaje(lista).map((x) => x.nombre).join(' | '));
console.log(ordenarPorEncaje(lista, { epoca: { ordinal: (k) => k === 0 } }).map((x) => x.nombre).join(' | '));
"
```

```text
[0,0,3,0,0,0,0,0,0,0] [0,0,3,0,0,0,0,0,0,0] 2 reducir 0 1 3
[0,-2,0,0,0,0,0,0,0,0] completar
[-1,4,0,0,0,0,0,0,0,0] mixto
exacto | escrito en 2 | desvio hondo | ref desde 7 | ref desde 3
exacto | escrito en 2 | desvio hondo | ref desde 3 | ref desde 7
```

Lectura: `1.2.3` buscado como `1.2` le sobra una profundidad (`+3`, reducir); `1` buscado como `1.2` le falta (`-2`, completar). En el orden, `ref desde 7` y `ref desde 3` empatan en acuerdo 0 y salen por llegada; solo con una época que declare ordinal la profundidad 0 (la última línea usa una época de prueba; ninguna época real lo hace todavía) gana la de menor distancia.

Dónde se ve la diferencia entre llegada y encaje: un registro cuya posición 2 es una referencia a la posición 7 de otro (viene de lejos: acuerdo 0) y un hijo escrito en su posición 2 (anclado ahí: exacto).

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
propio:exacto:0 referencia:reducir:5 escrito:exacto:0
propio:exacto:0 escrito:exacto:0 referencia:reducir:5
```

### 6.6 Árbol lógico y colisiones

```js
arbol(eje, id, { profundidad = 10, epoca } = {})  // → Map<dir, ocupante[]> para cada dirección desarrollada del payload y cada dirección con escritos; bajo la época elegida (hoy decide el orden)
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
2000000000 propio#2 referencia#2
3000000000 propio#3 propio#3
4000000000 propio#4 propio#4
0000000000:2 1000000000:4 2000000000:2 3000000000:2 4000000000:2
false
```

Lectura: cada décupla con posición 0 colisiona con ella (`0000000000`, `1000000000`); una lista no (por hojas, VG 7-11 noche): en `2000000000` la lista de uno da su referencia y lo que alcanza, y en `3000000000` y `4000000000` cada elemento es un ocupante, sin 3.1 ni 4.1, porque el árbol no baja por una lista; `1000000000` suma además lo alcanzado por la referencia y la cuenta escrita; `1100000000` (el terminal `1`) tiene un solo ocupante. `arbol` no entra en los escritos: la cuenta aparece como un único ocupante (`escrito#`, camino `[]`) en su anclaje; sus subposiciones no son direcciones del foco (para verlas, `arbol(eje, cuenta.id)`).

### 6.7 La lista de una posición: colisiones fuera del árbol

Decisión de VG (7-11 noche: por hojas; corrige la de la PR #64, que leía todo array dentro de una posición como su lista). La lista de una posición no está en el árbol: son los ocupantes que colisionan en esa posición, de n elementos, fuera de los dígitos («profundidad 11»), **por llegada**. Se alcanza por **índice** (`lista(...)[k]`, BQL `BUSCAR(n, k)`), **nunca por dirección**: una dirección de diez dígitos solo nombra subposiciones de la décupla, y `REF(compra, "1200000000")` es la subposición 1.2 (vacía si no se escribió), no un ocupante.

- Lo **propio** es el contenido del payload en el camino exacto: una **décupla** (un array con algún array) o una hoja es **un** ocupante; una **lista** (un array solo de hojas, §3.2) son **tantos como elementos**, con la misma llegada, en su orden, con `enLista` e `indice`. Así se declaran varios ocupantes en un solo evento: `menú 1 = ['ensalada', 'guiso', 'fruta']`.
- Luego, los **escritos** anclados en la dirección, uno por escrito (el payload de un escrito es su raíz, una décupla), por orden de entrada en el eje.
- En la raíz no hay propio (el payload raíz es la cruceta): solo lo escrito en ella. El límite de diez es por evento y por décupla, no por lista ([X] en el mapa).

```js
lista(eje, id, indices)  // → [{ llegada, tipo: 'propio' | 'escrito', evento, camino, contenido, autor?, t?, en?, alcanza?, enLista?, indice? }]
```

`llegada` es el orden del **evento** (0 lo propio, 1, 2… cada escrito): los elementos de una lista comparten llegada. `alcanza`, si el contenido es una referencia, es lo que alcanza (`seguir`), sin copiar.

`ocupantes` (§6.1) sigue siendo el encaje de una **dirección**: la colisión entera, con la décupla de la posición como un ocupante, su camino 1.0 como otro (o sus elementos, si es una lista) y lo que alcanzan las referencias. `lista` es la lista de la **posición**, por llegada y sin encaje. En BQL (`docs/BQL.md` §7.4), `BUSCAR(1)` da la lista de la posición 1 con cada elemento aparte, `BUSCAR(1, k)` el ocupante k por llegada, y `LOCAL` (índices) sí entra en una lista; `REF` (dirección) no.

```sh
node --input-type=module -e "
import { ejemploCompra, ejemploCuenta } from './ejemplos/ikisai/compra-food.mjs';
import { lista } from './src/encaje.js';
import { leerDireccion, leerCamino } from './src/epocas.js';
const { eje, compra, menu } = await ejemploCompra();
await ejemploCuenta(eje, compra);
for (const o of lista(eje, compra.id, [1])) console.log(o.llegada, o.tipo, o.camino.join('.') || 'raíz', JSON.stringify(o.contenido).slice(0, 40));
for (const o of lista(eje, menu.id, [1])) console.log(o.llegada, o.tipo, o.indice, o.contenido);
console.log(leerDireccion('1200000000').map((x) => x.significado).join(' › '));
console.log(leerCamino([3, 1], 'época 0', { payload: compra.payload }).map((x) => x.significado).join(' › '));
"
```

```text
0 propio 1 [[{"ref":"d367743bd56eb5f722ace18466010f
1 escrito raíz ["Cuenta del menú","=REF(\"bea2e06d\", \
0 propio 0 ensalada
0 propio 1 guiso
0 propio 2 fruta
recursos › con qué condición
comunicación › ocupante 2 de la posición 3
```

Lectura: la posición 1 de la compra tiene dos ocupantes por llegada: la décupla (uno) y la cuenta escrita en ella. La 1 del menú, una lista, tiene tres, con la misma llegada y en su orden. Una dirección se lee siempre por dígitos («recursos › con qué condición»); un índice que cae en una lista es «ocupante k de la posición p».

**Clasificar** (`ui/clasificar.js`, botón «Clasificar» de la app): la lista de la posición en foco como piezas por clasificar y la cruceta como diez huecos (las subposiciones de la posición, con la regla corta de su profundidad y, bajo la raíz, el PV de la cruceta como subtítulo). En modo **lente** colocar una pieza solo la muestra interpretada con ese hueco; no escribe nada y se recuerda solo en el navegador. En modo **crear** colocar escribe el elemento en la subposición por dirección (`en = direccion([...posicion, hueco])`) con `salida.escribirDesde` en modo Pointed (un terminal, un minuto de T del autor, firmado si hay clave), y el registro lleva `contexto.clasifica` (§1.4): la pieza sale de «por clasificar». Las piezas son la lista de la posición: una décupla es una pieza; cada elemento de una lista, una pieza aparte (clave `id#3[1]`). Lo que se escribe: un terminal que no es fórmula, tal cual (también un elemento de una lista); un escrito, una referencia a él; una fórmula o una décupla propias, una referencia a su camino (una pieza en un camino que acaba en 0 no se puede nombrar por dirección: §4.2, y se dice; un elemento de lista que es fórmula tampoco, porque una dirección no entra en una lista).

## 7. Identidades, claves y firmas

### 7.1 Identidades

Una identidad es una cadena (`'casa'`, `'cocina'`, `'huesped'`). **Existe cuando ha recibido tokens**: la primera por el génesis, las demás porque un evento les mueve tokens (`a: 'cocina'`). No hay registro de identidades aparte de los saldos. Las identidades son personas, grupos de personas (la casa) o cosas (una habitación); quien da de alta lo declara.

**Tipo.** Se declara en `contexto.tipos[identidad]` (`'persona'`, `'grupo'` o `'cosa'`) **del mismo evento en que esa identidad recibe tokens por primera vez**, igual que la clave (§7.2); el génesis declara el de su autor con `tipo`. Un tipo para una identidad que ya existe o que no recibe tokens en ese evento se rechaza, y no cambia. El tipo solo decide quién emite: solo las personas (VG, 7-11 noche); los grupos y las cosas son titulares (reciben, conservan y mueven tokens, firman con su clave) pero no emiten, y a nombre de un grupo emite una persona con P sobre su alta (§2.4). Quien no declaró tipo no emite fuera del génesis.

```js
eje.identidades()              // → string[] en orden de primera recepción
eje.saldo(identidad, clave)    // → número disponible; clave de saldo ('T:minuto', 'E:casa/EUR', 'P:genesis', 'R:casa', …); 0 si no existe ('P', 'T' o 'E:EUR' a secas siempre dan 0)
eje.bloqueado(identidad, clave, salida?) // → lo bloqueado (de una salida, o de todas)
eje.bloqueos(identidad)        // → [{ clave, ...campos, salida, cantidad }]
eje.alta(identidad)            // → { id, t } de su alta, o null
eje.emitidoT(identidad, escala) // → T que ha emitido fuera del génesis
eje.obligaciones(emisor)       // → su R en manos ajenas
eje.saldoT(identidad, escala)  // → saldo(identidad, 'T:' + escala), sin conversión; lanza si la escala no existe
eje.tiempos(identidad)         // → [{ escala, cantidad }] en el orden de ESCALAS_T, solo saldos > 0
eje.recursos(identidad)        // → [{ emisor, denominacion, cantidad }]
eje.tipo(identidad)            // → 'persona' | 'grupo' | 'cosa' | null
eje.poderes(identidad)         // → [{ ambito, cantidad }] sus P con saldo > 0 (no hay P total)
eje.poderSobre(identidad, id)  // → suma de sus P cuyo ámbito es 'genesis' o un registro del hilo de `id`
eje.reputaciones(identidad)    // → [{ emisor, cantidad }] su R, por emisor
eje.clave(identidad)           // → JWK pública o undefined
```

### 7.2 Claves

- Una clave pública es un JWK EC P-256: `{ kty: 'EC', crv: 'P-256', x, y }`. Al declararla, el eje comprueba que Web Crypto la importa para verificar y que no lleva parte privada (`d`): si no, `clave inválida para <id>` (`autoridad.clavePublicaValida`).
- El génesis solo declara la clave de su autor; si la declara, el génesis va firmado con ella por su autor, igual al crearlo (`Eje.genesis`) que al restaurarlo (`Eje.desde`).
- Se declara en `contexto.claves[identidad]` **del mismo evento en que esa identidad recibe tokens por primera vez** (el génesis para el autor inicial, con `clave`; el alta para las demás). Una clave declarada para una identidad que ya existe, o para una que no recibe tokens en ese evento, se rechaza. **No se puede cambiar una clave registrada.**
- **Sin clave no se actúa** (R9, regla madre de la neutralidad aceptada por VG el 7-11 noche; `docs/notas/NEUTRALIDAD_IDENTIDAD.md` §4). Una identidad sin clave registrada puede recibir tokens, pero no escribe: no mueve tokens, no autoriza ni escribe bases (`sin clave no se actúa: <id> no tiene clave registrada`). El génesis declara la clave de su autor y va firmado con ella; sin `clave`, `Eje.genesis` lanza.
- **Prueba de posesión.** Cada clave que declara un alta llega firmando el id del propio alta: `posesion: { <identidad>: <firma> }`, fuera del cuerpo como la firma del autor (no cambia el id; `autoridad.firmarPosesion`, o el tercer argumento de `eje.escribir`). Sin ella, `la clave de <id> llega sin prueba de posesión`; firmada con otra clave, `prueba de posesión inválida para <id>`; para una identidad que no declara clave en ese evento, `prueba de posesión de <id> sin clave declarada`.
- **Demostración.** Un eje creado con `Eje.genesis({ …, demostracion: true })` lleva `contexto.demostracion: true` en su génesis (`eje.demostracion`, visible en la interfaz) y conserva lo de antes: sin clave se escribe sin firma, y la prueba de posesión es opcional (si va, se comprueba). Los ejemplos de Ikisai, la app y casi todas las pruebas son de demostración. La demostración sale solo de esa bandera del génesis (SEG-02): un eje que viene de la versión 2 no exige claves en su prefijo, pero sí en lo que se le añade después.

### 7.3 Firmas

```js
generarClaves()              // → Promise<{ publica: JWK, privada: CryptoKey }>
firmar(ev, privada, firmante = ev.autor)  // → Promise<evento congelado con firmante y firma>; firma = ECDSA P-256 / SHA-256 sobre los bytes del id, en base64url
verificar(ev, publica)       // → Promise<boolean>
firmarPosesion(ev, identidad, privada)    // → Promise<evento con posesion[identidad]>: la clave nueva firma el id (R9)
verificarPosesion(ev, identidad, publica) // → Promise<boolean>
eje.escribir(datos, privada, { <identidad>: privada }?)  // el tercer argumento añade la prueba de posesión de cada clave nueva
exportarPrivada(privada)     // → Promise<JWK>   (para guardarla en local; nunca entra en el eje)
importarPrivada(jwk)         // → Promise<CryptoKey>
huella(publica)              // → primeros 8 caracteres de x, para mostrar
```

Reglas del eje: quien tiene clave registrada **debe firmar** cada evento suyo, `firmante` debe ser el `autor` (también en el génesis), y la firma se verifica al añadir y al restaurar. `verificar` solo acepta la firma en base64url canónico, como la escribe `firmar` (sin relleno, sin espacios, sin bits sobrantes distintos de cero). Quien no tiene clave escribe sin firma, salvo que el eje se cree con `exigirFirmas: true` (entonces todo autor necesita clave y el génesis debe ir firmado). La firma no cambia el id. Las claves privadas nunca entran en el eje.

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
const eje = await Eje.genesis({ demostracion: true, identidad: 'casa', emision: [{ token: 'T', escala: 'minuto', cantidad: 600 }], foco: 'g', t: '2026-11-06T20:00:00Z', clave: casa.publica, privada: casa.privada });
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

Un génesis firmado del eje de ejemplo tiene esta forma (la clave y la firma varían en cada ejecución; el id cambia respecto al génesis sin clave porque `contexto.claves` está en el cuerpo):

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
    "claves": { "casa": { "kty": "EC", "crv": "P-256", "x": "5-vP4RyU9PK1UGD3Zy6AkAg3Q-w3QunjJgiETVU0y84", "y": "Wt3mst49Jno-ckzR5uKCLRbmiwogElGJ1AYu6i6fjaw" } },
    "tipos": { "casa": "grupo" }
  },
  "id": "a6f55e2a8efc77c1c0af196c633d4c27fa67d34c45bd6593ca245c706feb2472",
  "firmante": "casa",
  "firma": "duuWmzDqaavT6EfzTKcgXai4f9wSw8L0ElwXGJKwkScOaXEpWhtLqxpzBWW9gbSo9aV1XpeQAzsYTP8X4CoRYw"
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
| `sin clave no se actúa: <autor> no tiene clave registrada (solo un eje de demostración lo admite)` | R9: fuera de la demostración, el autor no tiene clave |
| `la clave de <id> llega sin prueba de posesión: …` / `prueba de posesión inválida para <id>: …` / `prueba de posesión de <id> sin clave declarada para él en este evento` | R9: la prueba de posesión del alta falta (fuera de la demostración), no la firma la clave declarada, o sobra |
| `no se puede cambiar la clave de <id>` / `clave declarada para <id> sin darle tokens` / `clave inválida para <id>` | `contexto.claves` mal usado |
| `no se puede cambiar el tipo de <id>` / `tipo declarado para <id> sin darle tokens` / `tipo inválido para <id>: <tipo>` | `contexto.tipos` mal usado |
| `solo las personas emiten: <autor> es <grupo o cosa>` / `… no declaró tipo en su alta` | una emisión fuera del génesis por quien no es persona (VG, 7-11 noche) |
| `nadie emite en nombre de otro: <emisor> no es el autor` | emisión de E o R cuyo `emisor` no es el autor ni un grupo |
| `emitir a nombre del grupo <g> exige P sobre su registro (<id8>): <autor> no lo tiene` | emisión de E o R a nombre de un grupo sin P sobre su alta |
| `T lo emite cada persona para sí misma: a debe ser <autor>` / `tope de T:<escala> para <autor>: llevaría <n> emitido y el reloj da <m> desde su alta (<t>)` | emisión de T a otro, o por encima del tope del reloj |
| `la emisión de P va a quien la emite: <autor>` / `P sobre todo el eje («genesis») solo lo emite el génesis` / `P fuera del génesis va sobre un registro existente: ámbito desconocido <id8>` / `P sobre <id8> lo acuña solo quien escribió el registro (<autor>): <x> puede transferir el P que tenga, no acuñarlo` | emisión de P fuera del génesis |
| `el t del evento (<t>) es anterior al de su foco <id8> (<t>)` / `el t del evento (<t>) es anterior al alta de <autor> (<t>)` / `el t del evento (<t>) va más de un año (anio) por delante del mayor t del eje (<t>)` | el reloj no va hacia atrás, ni más de un año hacia delante (**[X] confirmar VG**) |
| `emitir <R, P o E> exige mover T del autor en el mismo evento: consumirlo o darlo a otra identidad` / `emitir <P o E> exige R propia en juego: R:<autor> bloqueada como colateral …` / `emitir E exige P del autor sobre el registro <id8> (saldo o movimiento de P en el mismo evento)` | el escalonado T → R → P → E |
| `emitir R:<y> exige colateral: R:<autor> bloqueada con la salida «R:<y>», al menos <n> …` / `el colateral de R:<y> no baja de <n> …` / `el colateral de R:<y> no se libera mientras haya devoluciones sin atender (…)` / `contexto.atiende cita <id8>, que no es una devolución de R:<autor> …` | R6: el colateral de R y las devoluciones (`src/lente.js`) |
| `la serie <clave> caduca el <t>: una ampliación no cambia su caducidad` / `la serie <clave> no caduca: …` | una ampliación de E con otra caducidad |
| `saldo disponible insuficiente para bloquear <clave> en <autor>` / `no hay <n> de <clave> bloqueado en <autor> con la salida «<salida>»` | bloquear más de lo disponible, o liberar lo que no está bloqueado con esa salida |
| `la serie <clave> no admite tanto` | lo emitido de la serie dejaría de ser un número finito |
| `nadie mueve tokens ajenos: <de> no es el autor` | un movimiento con `de !== autor` |
| `saldo insuficiente de <clave> en <autor>` | la suma de lo movido por clave supera el saldo (sin conversión: `T:minuto` no se paga con `T:hora`) |
| `ámbito desconocido: <id8>` | un movimiento de P cuyo `ambito` no es `'genesis'` ni un registro del eje |
| `saldo insuficiente de P sobre el eje en <autor>` / `saldo insuficiente de P sobre <id8> en <autor>` | delegar P con un ámbito que el P del autor no cubre (más ancho, o de otra rama): §2.5 |

```sh
node --input-type=module -e "
import { Eje } from './src/eje.js';
const eje = await Eje.genesis({ demostracion: true, identidad: 'raiz', emision: [{ token: 'T', escala: 'minuto', cantidad: 60 }], foco: 'g', t: '2026-11-06T20:00:00Z' });
const T = (de, cantidad = 1) => ({ token: 'T', escala: 'minuto', cantidad, de, a: null });
const base = { autor: 'raiz', sobre: eje.genesisId, t: '2026-11-06T20:00:00Z', payload: 'x' };
const intentos = [
  { ...base, sobre: 'nadie', movimientos: [T('raiz')] },
  { ...base, autor: 'bea', movimientos: [T('bea')] },
  { ...base, movimientos: [{ token: 'E', emisor: 'raiz', denominacion: 'EUR', cantidad: 1, de: 'raiz', a: 'bea' }] },
  { ...base, movimientos: [T('raiz'), { token: 'T', escala: 'minuto', cantidad: 1, de: null, a: 'raiz' }] },
  { ...base, movimientos: [T('raiz'), { token: 'E', emisor: 'bea', denominacion: 'EUR', cantidad: 1, de: null, a: 'bea' }] },
  { ...base, movimientos: [T('raiz'), { token: 'E', emisor: 'raiz', denominacion: 'EUR', cantidad: 1, de: null, a: 'raiz' }] },
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
evento rechazado: solo las personas emiten: raiz no declaró tipo en su alta
evento rechazado: solo las personas emiten: raiz no declaró tipo en su alta; emitir E exige R propia en juego: R:raiz bloqueada como colateral (salida «R:raiz»), al menos la décima parte de lo emitido de R:raiz, antes o en el mismo evento (R6); emitir E exige P del autor sobre el registro 68a9eb53 (saldo o movimiento de P en el mismo evento)
evento rechazado: solo las personas emiten: raiz no declaró tipo en su alta; emitir E exige R propia en juego: R:raiz bloqueada como colateral (salida «R:raiz»), al menos la décima parte de lo emitido de R:raiz, antes o en el mismo evento (R6); emitir E exige P del autor sobre el registro 68a9eb53 (saldo o movimiento de P en el mismo evento)
evento rechazado: saldo insuficiente de T:minuto en raiz
evento rechazado: saldo insuficiente de T:hora en raiz
evento mal formado: en debe ser una dirección de diez dígitos
evento mal formado: payload 1: hueco
evento mal formado: el génesis debe emitir T al autor
```

## 8. Génesis

El génesis es el primer evento del eje. Se escribe **por convención, fuera del sistema**: emite libremente (`de: null`) series de las cuatro familias a su autor (después solo emiten las personas, escalonado, §2.4), es el único sin foco (`sobre: null`) y lleva `contexto.genesis: true`. Fija el foco raíz (su `payload`) y la primera identidad, y puede declarar su tipo. A partir de él, todo se genera dentro.

```js
Eje.genesis({ identidad, emision, foco, t = ahora, contexto = {}, clave, privada, tipo, exigirFirmas = false, demostracion = false })  // → Promise<Eje>
//   identidad: primera identidad; emision: [{ token, cantidad, escala | denominacion | ambito | emisor }] (se completa con de: null, a: identidad; en E y R, emisor: identidad)
//   tipo: 'persona' | 'grupo' (contexto.tipos); sin tipo, su autor no emite fuera del génesis
//   lanza si una serie de E o R del génesis lleva otro emisor, si el génesis declara el tipo de otra identidad o si su autor es una cosa
//   foco: payload BTML raíz; clave/privada: si se dan, el génesis declara la clave y va firmado
//   sin clave no se actúa (R9): sin clave/privada lanza, salvo con demostracion: true (contexto.demostracion,
//   eje.demostracion), que conserva lo de antes: sin claves y sin prueba de posesión obligatoria
Eje.desde(eventos, { exigirFirmas = false } = {})  // → Promise<Eje>  reconstruye validando cada evento (ids, firmas, saldos); el primero debe ser el génesis
eje.genesisId                                      // id del génesis
```

```sh
node --input-type=module -e "
import { Eje } from './src/eje.js';
const eje = await Eje.genesis({ demostracion: true, identidad: 'raiz', emision: [{ token: 'T', escala: 'hora', cantidad: 10 }, { token: 'T', escala: 'minuto', cantidad: 480 }, { token: 'E', denominacion: 'EUR', cantidad: 5 }], foco: ['casa', ['menu']], t: '2026-11-06T20:00:00Z' });
console.log(JSON.stringify(eje.obtener(eje.genesisId)));
const alta = await eje.escribir({ autor: 'raiz', sobre: eje.genesisId, en: '1000000000', t: '2026-11-06T20:01:00Z', movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'raiz', a: null }, { token: 'T', escala: 'hora', cantidad: 2, de: 'raiz', a: 'bea' }], payload: 'alta de bea' });
console.log(JSON.stringify(eje.identidades()), eje.saldoT('raiz', 'minuto'), eje.saldoT('raiz', 'hora'), eje.saldoT('bea', 'hora'), eje.saldo('raiz', 'E:raiz/EUR'), JSON.stringify(eje.serie('E:raiz/EUR')));
console.log(alta.sobre === eje.genesisId, alta.en, eje.sobre(eje.genesisId, '1000000000').length);
"
```

```text
{"autor":"raiz","sobre":null,"en":"0000000000","t":"2026-11-06T20:00:00Z","movimientos":[{"token":"T","escala":"hora","cantidad":10,"de":null,"a":"raiz"},{"token":"T","escala":"minuto","cantidad":480,"de":null,"a":"raiz"},{"token":"E","denominacion":"EUR","cantidad":5,"emisor":"raiz","de":null,"a":"raiz"}],"payload":["casa",["menu"]],"contexto":{"genesis":true,"demostracion":true},"id":"80512ae0261847b7031c81e313654fd0d0b7de094f23ce84f3c33cdb3b6236bf"}
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
  "contexto": { "genesis": true, "tipos": { "casa": "grupo" } },
  "id": "2d970a485fe0e95c35bd2c5ec5eef1e5cb5584031949ae80c04d3330c610f84c"
}
```

### 8.1 Guardar y reconstruir

El eje se guarda como **la lista de sus eventos en orden**; nada más. Al restaurar se vuelve a validar todo (ids, firmas, saldos). El árbol lógico, los saldos, las claves, los tipos y las series se reconstruyen.

La versión 2 (7-11) llega con las series de tokens (T por escala, E ligada a su emisor, tipos en el alta): un eje guardado con la versión 1 no se restaura. La versión 3 (7-11 noche) trae el ciclo de vida de los tokens (solo emiten personas, emisión escalonada, bloqueo, caducidad): lo guardado sigue siendo la lista de eventos, pero las reglas nuevas rechazarían un eje de la versión 2 (un génesis de un grupo, E o R emitidos fuera del génesis sin el escalonado, eventos fechados antes que su foco). Por eso `migrar` marca todos sus eventos (`v2: { eventos, ultimo }`, con el id del último, que `restaurar` comprueba) y `restaurar` los revalida con las reglas de la 2; las nuevas rigen lo que se añada después, y `serializar` conserva la marca. Un `eventosV2` suelto en un guardado se rechaza (`docs/MOTOR.md` §9). Lo que ni las reglas de la 2 admiten no se restaura, y la app lo aparta igual. La app, en vez de pisarlo en silencio, lo aparta en `agram.eje.anterior` y avisa antes de empezar con el ejemplo.

```js
serializar(eje)    // → { version: 3, exigirFirmas, v2?: { eventos, ultimo }, eventos: evento[] }  v2 solo si el eje viene de una migración
restaurar(datos)   // → Promise<Eje>; lanza 'eje de la versión 1; esta es la 3' con un guardado antiguo, o si algún evento no cuadra
guardarLocal(eje, clave = 'agram.eje') / cargarLocal(clave) / borrarLocal(clave)   // localStorage si existe; false / null si no
apartarLocal(clave = 'agram.eje', destino = clave + '.anterior')                 // copia lo guardado sin borrarlo; true si había algo
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
console.log(otro.saldo('cocina', 'E:casa/EUR'), JSON.stringify(otro.identidades()), otro.orden.length);
datos.eventos[3].movimientos[1].cantidad = 1;
await restaurar(datos).catch((e) => console.log(e.message));
"
```

```text
3 false 5 2d970a48 a8efd9b0 d367743b bea2e06d ee80a426
12 ["casa","cocina","huesped"] 5
evento rechazado: id no corresponde al cuerpo
```

Pendiente: persistencia en base de datos y anclaje a una cadena. La forma de los eventos no cambia con eso.

## 9. El eje de ejemplo

`ejemplos/ikisai/compra-food.mjs` construye cinco eventos con datos inventados. `ejemploCompra({ claves })` devuelve `{ eje, alta, menu, compra }`; `ejemploCuenta(eje, compra, privadaCocina)` añade la cuenta. Con claves, los ids cambian (las claves van en el cuerpo) y cada identidad firma.

| Evento | id | autor | sobre | en | payload |
|---|---|---|---|---|---|
| génesis | `2d970a48…` | casa | — | `0000000000` | `"Casa de ejemplo"` |
| alta | `a8efd9b0…` | casa | génesis | `0000000000` | `["Altas del fin de semana", ["cocina", "huesped"]]` |
| menú | `d367743b…` | cocina | alta | `0000000000` | `["Menú del día", ["ensalada", "guiso", "fruta"], ["sin gluten", "vegetariano"]]` |
| compra | `bea2e06d…` | huesped | menú | `0000000000` | `["Compra del menú del día", [[{ref: menú, dir: "1000000000"}], [1], ["EUR 12"]], [{ref: menú, dir: "2000000000"}], ["huesped", "cocina"], ["pagar", "servir"]]` |
| cuenta | `ee80a426…` | cocina | compra | `1000000000` | `["Cuenta del menú", "=REF(\"bea2e06d\", \"1200000000\") + 2 EUR", "=LOCAL(1) + 15 min", "==no es fórmula"]` |

Series: la casa (una persona: `tipo: 'persona'` en el génesis; VG, 7-11 noche: solo emiten personas) emite 1000 `T:hora`, 1000 `T:minuto`, 500 `E:casa/EUR` (la serie es suya: la clave lleva al emisor) y 10 `P:genesis`; las altas reparten horas y minutos, que son tokens distintos, y declaran el tipo de cocina (grupo) y huesped (persona). Saldos tras los cinco eventos: casa 936 h y 279 min de T (1000 − 40 − 24; 1000 − 1 − 240 − 480), 440 EUR, 10 P; cocina 38 h y 237 min (40 − 2; 240 − 3), 12 EUR; huesped 23 h y 480 min (24 − 1), 48 EUR.

Qué ocupa cada dirección de la compra (con la cuenta escrita) está en §6.6. En particular, la posición 4 solo tiene sus dos propios (`[4]` y `[4, 0]`): nadie ha escrito en ella. Los escenarios con propinas escritas en `4000000000` que usa `docs/BQL.md` son de las pruebas (`test/bql-colecciones.test.js`), no de este eje.

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
export function esHoja(x): boolean;                       // terminal o referencia (por hojas, VG 7-11 noche)
export function esLista(x): boolean;                      // fuera de la raíz: array no vacío solo de hojas (ocupantes por llegada)
export function esDecupla(x): boolean;                    // array con algún array dentro (la raíz siempre es décupla)
export function validarPayload(payload, ruta = '', ancestros, raiz = true): { ok: boolean, errores: string[] };
export function direccion(indices: number[]): string;     // ≤ 10 índices 0–9 → diez dígitos (RangeError)
export function indicesDe(dir: string): number[];         // quita ceros finales (TypeError si no es dirección)
export function resolver(payload, dir: string): any;      // undefined si no se llega o si entra en una lista; no sigue referencias
export function dentroDeLista(payload, dirOIndices): number[] | null;  // el camino de la lista en la que entra esa dirección
export function nodoEn(payload, indices: number[]): any;  // bajando por la raíz y por décuplas

// src/tokens.js
export const AMBITO_GENESIS = 'genesis';
export const FAMILIAS = ['E', 'P', 'R', 'T'];
export const SERIE = { T: ['escala'], E: ['emisor', 'denominacion'], P: ['ambito'], R: ['emisor'] };
export const ESCALAS_T = ['segundo', 'minuto', 'hora', 'dia', 'semana', 'ciclo', 'anio'];
export const MAXIMO_ESCALAS_T = 10;                       // tokens.js lanza al cargar si ESCALAS_T lo supera
export const TIPOS = ['persona', 'grupo', 'cosa'];
export const EMITEN = ['persona'];                         // VG, 7-11 noche
export const ESTADOS = ['bloqueo', 'liberacion'];
export const TOPE_T_MINIMO = 1;                            // [X] regla de la época, PROVISIONAL
export function topeT(alta, t, escala): number;            // ⌈(t − alta) / SEGUNDOS[escala]⌉, mínimo TOPE_T_MINIMO; PROVISIONAL
export const SEGUNDOS = { segundo: 1, minuto: 60, hora: 3600, dia: 86400, semana: 604800, ciclo: 2419200, anio: 31536000 };  // solo para medir distancias
export function validarMovimiento(m): string[];
export function claveToken(m): string;                    // 'T:hora' | 'E:casa/EUR' | 'P:genesis' | 'R:casa' | …
export function partirClave(clave): { token, serie, ...campos };  // campos de SERIE: escala | emisor y denominacion | ambito | emisor
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
  static async genesis({ identidad, emision, foco, t, contexto, clave, privada, tipo, exigirFirmas, demostracion = false }): Promise<Eje>;  // sin clave lanza, salvo demostracion (R9)
  static async desde(eventos, { exigirFirmas = false } = {}): Promise<Eje>;
  eventos: Map<id, Evento>; orden: id[]; saldos: Map<identidad, Map<clave, number>>; bloqueados: Map<identidad, Map<clave, Map<salida, number>>>; claves: Map<identidad, JWK>; exigirFirmas: boolean; demostracion: boolean;   // series, tipos y altas son privados: se leen con serie(), series(), tipo(), alta()
  get genesisId(): string;
  obtener(id): Evento | undefined;
  identidades(): string[];
  saldo(identidad, clave): number;
  saldoT(identidad, escala): number;                       // saldo de 'T:' + escala
  tiempos(identidad): { escala, cantidad }[];
  recursos(identidad): { emisor, denominacion, cantidad }[];
  poderes(identidad): { ambito, cantidad }[];
  reputaciones(identidad): { emisor, cantidad }[];
  poderSobre(identidad, registro): number;                 // P con ámbito genesis o en el hilo de registro
  ambitosQueCubren(ambito): string[];                      // el ámbito, su hilo y 'genesis'
  serie(clave): { emisor, emitido, caduca? };            // por clave de saldo: 'E:casa/EUR', 'R:casa', 'T:hora', 'P:genesis'
  series(): { clave, token, serie, ...campos, emisor, emitido, bloqueado, caduca? }[];  // caduca solo en E (ISO o null)
  bloqueado(identidad, clave, salida?): number;
  bloqueos(identidad): { clave, token, serie, ...campos, salida, cantidad }[];
  obligaciones(emisor): number;                            // su R en manos ajenas
  alta(identidad): { id, t } | null;
  emitidoT(identidad, escala): number;
  clave(identidad): JWK | undefined;
  tipo(identidad): 'persona' | 'grupo' | 'cosa' | null;
  async validar(ev): Promise<string[]>;
  async anadir(ev): Promise<Evento>;                       // lanza 'evento rechazado: …'
  async escribir(datos, privada?, posesion?): Promise<Evento>;  // crearEvento + (firmarPosesion por cada { identidad: privada }) + (firmar) + anadir
  hilo(id): Evento[];                                      // hasta el génesis
  sobre(id, en?): Evento[];                                // hijos directos
  sobreDe(id, en, autores: Set): Evento[];                 // los anclados en (id, en) por esos autores, en orden de entrada (índice por autor, R8)
  cuantosSobre(id, en): number;                            // cuántos anclados en (id, en)
}
export function caducada(eje, clave, t): boolean;          // solo lee la caducidad de una serie de E; nada se ejecuta solo

// src/ciclo.js
export function reglasDelCiclo(ev, ctx): { i, capa: 4 | 5, texto }[];  // quién emite y el escalonado T → R → P → E; lo usan eje.validar y validez
export function aNombreDeGrupo(ctx, emisor): boolean;  // ¿emisión a nombre de un grupo? Con EMITEN, el único uso del tipo (R10)

// src/elegibles.js (R8: elegibilidad antes que límites)
export function elegibles(eje, id): { dueno, todos, autores: Set | null, origen: 'lista' | 'defecto' };  // 2.3 si es una lista de nombres (con 'cualquiera', todos); si no, el autor y quien aparece en su 3; más lo que el dueño ancle ahí
export function esElegible(ocupante, { todos, autores }): boolean;
export function ocupantesElegibles(eje, id, indices, opciones?): { lista, noElegibles, elegibles };
export function hijosElegibles(eje, id): { lista, elegiblesN, noElegibles, elegibles };  // elegibles delante, luego los demás
export const LISTA = [2, 3]; export const CON_QUIEN = 3; export const CUALQUIERA = 'cualquiera';

// src/encaje.js
export function vector(candidato, buscado): number[10];   // candidato − buscado (§6.5)
export function distancia(v): number[10];
export function acuerdo(v): number;
export function norma(v): number;
export function faltas(v): number;
export function excedentes(v): number;
export function signo(v): 'exacto' | 'completar' | 'reducir' | 'mixto';
export function ordenarPorEncaje(lista: { vector }[], { epoca } = {}): typeof lista;  // acuerdo, distancia solo en profundidades ordinales de la época, llegada
export function caminosDe(payload, dir): { indices: number[], contenido }[];
export function ocupantes(eje, id, indices: number[], { orden = 'encaje' | 'llegada', epoca, exacto = false, autores?: Set } = {}): Ocupante[];  // autores: solo los escritos de esos autores (R8)
export function seguir(eje, ref, procedencia = []): Ocupante;
export function marcarEmpates(lista: { vector }[], { epoca } = {}): (typeof lista[number] & { empate, empatados })[];
export function justificar(o: Ocupante): string;
export function arbol(eje, id, { profundidad = 10, epoca } = {}): Map<string, Ocupante[]>;
export function colisiones(mapa): { dir, ocupantes }[];
export function caminoDe(o): number[];

// src/autoridad.js
export async function generarClaves(): Promise<{ publica: JWK, privada: CryptoKey }>;
export async function exportarPrivada(privada): Promise<JWK>;
export async function importarPrivada(jwk): Promise<CryptoKey>;
export async function firmar(ev, privada, firmante = ev.autor): Promise<Evento>;
export async function verificar(ev, publica): Promise<boolean>;
export async function firmarPosesion(ev, identidad, privada): Promise<Evento>;  // R9: la clave nueva firma el id del alta (posesion)
export async function verificarPosesion(ev, identidad, publica): Promise<boolean>;
export function huella(publica): string;

// src/epocas.js
export const PV: string[10];
export const TODAS = 'todas';
export function cargarEpoca(datos, { respaldo }?): Epoca;
// Epoca: { nombre, estado, principios, dudas, reglas[100], largas, regla(p, d), reglaCorta(p, d), larga(ruta), reglaLarga(ruta), ordinal(p) }
export const EPOCA_0: Epoca;  // decidida: las cien reglas cortas (profundidad 0 = los diez PV; n ≥ 1 = el PV aplicado al nodo de arriba)
export const EPOCAS: { [nombre]: Epoca };
export function epocaDe(epoca = EPOCA_0): Epoca;  // por objeto o por nombre
export function leerDireccion(dir, epoca = EPOCA_0): { profundidad, digito, significado, larga? }[];

// src/persistencia.js
export const VERSION = 3;
export function serializar(eje): { version, exigirFirmas, eventos };
export function migrar(datos): datos;  // de la versión 2 a la 3: version 3 y la marca v2 = { eventos, ultimo } (sus eventos se validan con las reglas de la 2)
export async function restaurar(datos): Promise<Eje>;
export function guardarLocal(eje, clave = 'agram.eje'): boolean;
export async function cargarLocal(clave = 'agram.eje'): Promise<Eje | null>;
export function apartarLocal(clave = 'agram.eje', destino = clave + '.anterior'): boolean;
export function borrarLocal(clave = 'agram.eje'): void;
```

Las anotaciones de tipo son documentación; el código es JavaScript puro sin dependencias.

## 11. Lo que no existe (pendiente)

| Pendiente | Dónde se nota |
|---|---|
| Terminales HTML y archivo | §3.1: hoy solo número, cadena, referencia |
| Referencias a una rama que no sea evento + dirección | §3.3 |
| Comprobar al escribir que una referencia apunta a un evento existente | §3.3: se detecta al seguirla (`rota`, PENDIENTE) |
| Cero de orientación y reglas por dimensión para el signo del vector | §4.2, §6.5 |
| Nombrar un índice 0 real al final del camino | §4.2: se trata como colisión |
| Posición 0 de un terminal (ni el encaje ni `decupla` ni `mapa` la dan; la herencia de `desdeMapped` en la raíz de un foco terminal, sí) | §4.2 |
| Cambio de foco al agotar diez niveles; qué hacer con un payload de más de diez niveles (rechazarlo o cambiar de foco) | §3.2 |
| Contenido de las reglas largas (el cargador ya las admite); cómo cambia el vector con la época; qué profundidad es ordinal, si alguna (el gancho `epoca.ordinal` existe; la época 0 no declara ninguna; el signo ya está decidido: opción B, mapa §12 [D]) | §4.3, §6.5, `docs/REGLAS_CORTAS.md` |
| Criterio general para elegir `en` (solo está decidido el anclaje de la reserva en la plaza) | §5 |
| Prueba de posesión de la clave al dar de alta | §7.2 |
| La regla de T por persona y reloj (PROVISIONAL, neutralidad ante agrupación y división) y las reglas del ciclo marcadas «[X] confirmar VG» (§2.4); qué hace verificable la salida de un bloqueo; escalas de T octava a décima; fracciones en E, P y R ([X] decidir VG) | §2.1, §2.4 |
| Retirar o rechazar reputación dada; nombre de la plaza en la denominación; el id del génesis como segundo nombre del ámbito `genesis` ([X] decidir VG) | §2.4, §2.5 |
| Dónde van las noches de la reserva (dentro, y entonces qué llevan 5 y 6, o ancladas en el 7); dónde se ancla lo lejano, en el foco o en la décupla ([X] decidir VG) | §5 |
| Cómo firma un grupo (hoy, una clave guardada por sus representantes; es de AARPIA) | §7.1 |
| Anidar hileras o décuplas en una posición concreta por decisión | §5 |
| Persistencia en base de datos y anclaje a una cadena | §8.1 |
| Comprobación de `t` contra un reloj o contra el orden del eje | §1.1: solo `Date.parse` |
| [X] decidir VG: profundidad máxima de un payload (hoy un payload de miles de niveles agota la pila al validarlo; al crear o restaurar se rechaza como «no cabe en JSON») | §3.2, `test/propiedades.test.js` |
| [X] decidir VG: si mover T de uno a sí mismo cuenta como «el autor mueve T» (hoy escribe sin coste) | §2, `test/propiedades.test.js` |
| [X] decidir VG: `exigirFirmas` se guarda fuera de lo firmado (un archivo manipulado restaura con la política rebajada) | §8.1, `test/propiedades.test.js` |
| [X] decidir VG: la firma de un autor sin clave registrada se guarda sin verificar | §7.3, `test/propiedades.test.js` |
