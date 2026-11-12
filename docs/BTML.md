# BTML: la estructura de datos de AGRAM

BTML es la estructura de datos de AGRAM. Este documento describe BTML **tal como existe en el código** (`src/btml.js`, `src/evento.js`, `src/tokens.js`, `src/eje.js`, `src/encaje.js`, `src/autoridad.js`, `src/epocas.js`, `src/persistencia.js`), con firmas de funciones, tablas y ejemplos ejecutables. Lo que no existe se marca con «pendiente».

Convenciones de este documento:

- Todos los ejemplos se ejecutan **desde la raíz del repositorio** con `node --input-type=module -e "..."` (Node ≥ 20). La salida que sigue a cada ejemplo es la salida real.
- Los ids del eje de ejemplo (`ejemplos/ikisai/compra-food.mjs`) son deterministas (hash de un cuerpo fijo), pero cambian con cualquier cambio de un cuerpo, también con el de la época: desde el encargo 3b el génesis lleva en su contexto el id de la época 0 (`contexto.epoca`), que cambia en cuanto cambia una regla. Por eso aquí se nombran por su papel (`<génesis>`, `<menú>`, `<compra>`…); las salidas de los ejemplos que los imprimen son las del commit que las escribió.
- Un «registro» y un «evento» son lo mismo. El «foco» es el registro sobre el que se escribe.

Antes de copiar un id de este documento: los ids cambian en cuanto cambia cualquier cosa del cuerpo del ejemplo (pasó con la PR #18, que puso ámbito al P del génesis, con la PR #28, que cambió el vector guardado en las consolidaciones, con la PR #35, que puso el génesis en series, y con el encargo 3b, que dejó el génesis sin movimientos y con el id de la época). En un programa no se copian: se usan `compra.id`, `menu.id`… tal como los devuelve `ejemploCompra()`. Desde fuera de la raíz del repositorio se importa por URL absoluta: `import { Eje, encaje, bql, motor } from 'file:///<ruta del repositorio>/src/index.js'` (el paquete es `"type": "module"`; los imports internos son relativos). En PowerShell las comillas anidadas de `node -e "..."` fallan a menudo: es más fiable guardar el ejemplo en un `.mjs` y ejecutarlo con `node --input-type=module < ejemplo.mjs` desde la raíz.

## 0. Mapa de módulos

| Módulo | Qué define | Funciones principales |
|---|---|---|
| `src/btml.js` | Payload, terminales, referencias, direcciones | `esTerminal`, `esReferencia`, `esDireccion`, `validarPayload`, `direccion`, `indicesDe`, `resolver`, `ARIDAD` |
| `src/tokens.js` | Familias de tokens, series y movimientos | `FAMILIAS`, `SERIE`, `SEPARADOR_REGISTRO`, `ESCALAS_T`, `MAXIMO_ESCALAS_T`, `SEGUNDOS`, `AMBITO_GENESIS`, `TIPOS`, `EMITEN`, `CRITERIO_CAPACIDAD`, `validarMovimiento`, `claveToken`, `partirClave`, `esIdRegistro`, `capacidadDe`, `cantidadBase` |
| `src/evento.js` | El evento, su cuerpo canónico y su id | `crearEvento`, `validarForma`, `cuerpo`, `canonico`, `hash`, `verificarId`, `RAIZ` |
| `src/instante.js` | Instantes ISO-8601 estrictos con zona explícita, en milisegundos UTC; se comparan en segundos enteros (VG, 10-11, C2) | `esInstante`, `msUTC`, `segundosUTC`, `msDeGuardado` y `segundosDeGuardado` (solo para eventos de la versión 2) |
| `src/eje.js` | La secuencia de eventos: génesis, saldos, identidades, anclaje. Por dentro, una envoltura del libro de transacciones (`docs/notas/CAPA_CERO.md`) | `Eje.genesis`, `Eje.desde`, `eje.escribir`, `eje.anadir`, `eje.validar`, `eje.obtener`, `eje.hilo`, `eje.sobre`, `eje.saldo`, `eje.saldoT`, `eje.tiempos`, `eje.recursos`, `eje.poderes`, `eje.poderSobre`, `eje.reputaciones`, `eje.serie`, `eje.series`, `eje.vivo`, `eje.registroDe`, `eje.topes`, `eje.esPersona`, `eje.alta`, `eje.invitar`, `eje.aceptar`, `eje.identidades`, `eje.clave`, `eje.libro`, `eje.transaccion`, `eje.contexto`, `eje.antes`, `reglasDelTope`, `SIN_CAPACIDAD` |
| `src/libro.js` | La capa cero (VG, 9-11): el libro de transacciones, cinco primitivas, anclaje y memo, atomicidad, condiciones enchufables | `Libro`, `acunar`, `transferir`, `bloquear`, `liberar`, `quemar`, `transaccion`, `PRIMITIVAS` |
| `src/condiciones/` | Las condiciones de validez de la transacción: el suelo, las reglas de la época conectadas (`reglas.js`, encargo 3a) y lo que queda en JS (`docs/notas/CAPA_CERO.md` §3) | `CONDICIONES`, `CONDICIONES_GENESIS`, `CONDICIONES_DE_LA_EPOCA`, `motivosDe`, `catalogo` |
| `src/encaje.js` | Ocupantes de una dirección (cada elemento de una lista, aparte), la lista de una posición (fuera del árbol), colisiones, vector, árbol lógico | `ocupantes`, `lista`, `caminosDe`, `seguir`, `arbol`, `colisiones`, `vector`, `distancia`, `acuerdo`, `signo`, `faltas`, `excedentes`, `norma`, `ordenarPorEncaje` |
| `src/autoridad.js` | Claves y firmas por identidad | `generarClaves`, `firmar`, `verificar`, `exportarPrivada`, `importarPrivada`, `huella` |
| `src/epocas.js` | Significado de cada dígito: la época 0 (las cien reglas cortas) y, cuando las haya, las épocas con reglas largas, cargadas desde `datos/epocas/`; y la época como registro (§12) | `PV`, `EPOCA_0`, `EPOCAS`, `epocaDe`, `cargarEpoca`, `leerDireccion`, `leerCamino`, `nombreEnNodo`, `cargarEpocaBtml`, `EPOCA_0_BTML` |
| `src/bqlm.js`, `src/contexto-eje.js` | El BQL mínimo y su contexto sobre el eje: posiciones, despliegues, vistas del libro y lecturas (`docs/BQLM.md`) | `analizar`, `evaluar`, `evaluarRegla`, `evaluarEscritura`, `leerRegla`, `ContextoEje` |
| `src/lectura.js` | Lectura humana de un payload y de un registro: un esquema de texto, una línea por posición (§3.5) | `leer`, `leerEvento` |
| `src/persistencia.js` | Guardar y reconstruir el eje | `serializar`, `restaurar`, `guardarLocal`, `cargarLocal`, `borrarLocal` |

`src/index.js` reexporta `btml.js`, `tokens.js`, `evento.js`, `eje.js`, `epocas.js`, `modos.js` y `lectura.js` en plano, y como espacios de nombres `pointed`, `sequenced`, `mapped`, `scened`, `salida` (= `src/escritura.js`), `bql`, `encaje`, `motor`, `autoridad`, `tiempo`, `persistencia`, `bases`, `efectos`, `validez`, `libro` y `condiciones`: `import { Eje, crearEvento, encaje, bql, motor } from './src/index.js'`. Cuidado también con `validez`: es el espacio de nombres de `src/validez.js`, y la función es `validez.validez`. Cuidado: `escritura` en plano **no** es el módulo `src/escritura.js` sino la función de `modos.js` que da la proporción de escritura de un modo; el módulo es `salida`. No hay espacios de nombres `btml`, `tokens`, `evento`, `eje`, `epocas` ni `modos`: lo suyo se importa en plano (`import { direccion, indicesDe, Eje } from './src/index.js'`; `import { btml } from …` falla con `does not provide an export named 'btml'`).

## 1. El evento

La unidad de información es el evento: **una transición de tokens con un payload BTML encima**. No hay evento sin movimiento de tokens.

### 1.1 Campos

| Campo | Tipo | Obligatorio | Significado |
|---|---|---|---|
| `autor` | cadena no vacía | sí | Identidad que escribe. Todo movimiento sale de ella. |
| `sobre` | id de evento o `null` | sí | Registro en foco sobre el que se anida este evento (hijo → padre). `null` solo en el génesis. El alta de una persona se anida sobre la invitación que acepta (§7.1). |
| `en` | dirección de diez dígitos | no (por defecto `'0000000000'`) | Posición del foco donde se anida lo escrito. El génesis solo admite la raíz. |
| `t` | cadena que `Date.parse` acepta | sí | Instante declarado por el autor. No se comprueba contra ningún reloj. |
| `movimientos` | array de movimientos | sí | Ver §2. No vacío y el autor debe **consumir** T (`de` = autor, `a` = null), salvo en el génesis, que no mueve nada (encargo 3b: es la época 0, §8). |
| `payload` | BTML | sí | Terminal o array posicional. Ver §3. |
| `contexto` | objeto | no (por defecto `{}`) | Metadatos libres. Forma parte del id. Claves en uso hoy: ver §1.4. |
| `id` | 64 hex | lo calcula `crearEvento` | SHA-256 del cuerpo canónico. |
| `firmante`, `firma` | cadena; la firma, BIP-340 en hex (64 bytes, 128 caracteres en minúsculas) | solo si se firma | Los añade `firmar`. No forman parte del id. Ver §7. |

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
| `escribir consume T del autor: un movimiento de T con de = <autor> y a = null (VG, 7-11 noche)` | ningún consumo de T del autor (evento normal; darlo a sí mismo o bloquearlo no cuenta). En un evento de la versión 2, `el autor debe mover T` |
| `el génesis debe emitir T al autor` | solo en un génesis de la versión 2: ningún movimiento T con `a === autor`. Desde el 8-11 el génesis no emite T (VG, 8-11: «no hay un tipo de T que se acumule») y desde el encargo 3b no mueve nada: lo que su autor emite al empezar (`emision`, E y R) va en una transacción suya después (§8) |
| `payload ruta: …` | payload inválido (ver §3.4) |
| `contexto debe ser un objeto` | `contexto` es un número, un texto o un array (`null` vale como `{}`) |
| `evento no es objeto` | lo validado no es un objeto |

### 1.4 Claves de `contexto` en uso

`contexto` es libre, pero el código ya reconoce o escribe estas claves:

| Clave | Quién la escribe | Significado |
|---|---|---|
| `genesis: true`, `epoca` | `Eje.genesis` | Marca el génesis. Solo puede haber uno por eje. `epoca` es el id de la época 0 (`EPOCA_0_BTML.id`): el génesis es la época 0 en este eje (encargo 3b). |
| `claves: { identidad: clave pública }` (hex x-only, §7.2) | `Eje.genesis` (clave del autor), `eje.aceptar` (la de quien acepta una invitación) y quien da de alta una cosa | Clave pública de quien escribe su propia alta o de una identidad que **recibe tokens en este mismo evento**. Ver §7.2. |
| `tipos` | nadie (solo un eje de la versión 2) | **Ya no existe** (VG, 10-11, B1: desaparece el tipo). Persona o cosa se lee de quién escribe el alta: una persona escribe la suya; una cosa la da de alta otra identidad, su dueño (§7.1). Fuera del prefijo de la versión 2 un alta que lo declara se rechaza. |
| `modo` | `escritura.escribirDesde` | `'pointed'`, `'sequenced'`, `'mapped'` o `'scened'`. |
| `heredadas` | `escritura.escribirDesde` (con `celda`, `heredadas` o desde `escribirSalida`) | Posiciones del payload que son relleno heredado del foco: cada una es una referencia al foco en su propia dirección, y el foco tiene contenido en ese camino exacto (se comprueba: una heredada nunca cuelga). No se emiten y no cuentan para el tope del modo (la proporción sí las cuenta, como antes); lo demás se vio o se escribió. Posiciones como número (`3`), subposiciones o clases como texto (`'1.2'`, `'1.2.3'`). Ver `docs/MOTOR.md` §7.3. |
| `clasifica: { posicion, evento, camino, indice? }` | `ui/clasificar.js` (`escribirColocacion`, modo «crear») | El registro coloca en una subposición de `posicion` (por dirección, su `en`) la pieza de la lista de esa posición que vive en `evento`, camino `camino` (`[]` si la pieza es un escrito) y, si es un elemento de una lista, `indice` (su lugar en ella). Desde entonces la pieza cuenta como clasificada. Ver §6.7. |
| `motor`, `fuentes`, `encaje`, `nuevos` | `motor.js` | Fábrica: la consolidación (`motor: 'fabrica'`; `docs/MOTOR.md` §3). Desde el encargo 3b no hay fases ni autorización: el ciclo es una sola operación, registrar, y «cerrado» es una lectura. `encaje` dice de dónde vino cada elección con fuente; `nuevos`, dónde va cada terminal nuevo. Ningún registro guarda una clave `clase`: la clase de modificación se lee de una dirección con el camino desde el que se escribe (la matriz es relativa al camino: bajo un camino de profundidad n, el dígito n + 2; sin camino, el tercero; `docs/MOTOR.md` §7.2). |

### 1.5 Un evento real: la compra

Cuarto evento del eje de ejemplo. Su `sobre` es el menú; su `payload` referencia dos posiciones del menú sin copiarlas.

```json
{
  "autor": "huesped",
  "sobre": "<id del menú>",
  "en": "0000000000",
  "t": "2026-11-07T13:30:00Z",
  "movimientos": [
    { "token": "T", "escala": "hora", "cantidad": 1, "de": "huesped", "a": null },
    { "token": "E", "emisor": "casa", "denominacion": "EUR", "cantidad": 12, "de": "huesped", "a": "cocina" }
  ],
  "payload": [
    "Compra del menú del día",
    [ [ { "ref": "<id del menú>", "dir": "1000000000" } ], [ 1 ], [ "EUR 12" ] ],
    [ { "ref": "<id del menú>", "dir": "2000000000" }, "all announced movements happened" ],
    [ "huesped", "cocina" ],
    [ "pagar", "servir" ]
  ],
  "contexto": {},
  "id": "<id de la compra>"
}
```

Leído (`leerEvento`, §3.5):

<!-- comprobar: leído
import { leerEvento } from './src/lectura.js';
import { ejemploCompra } from './ejemplos/ikisai/compra-food.mjs';
const { eje, menu, compra } = await ejemploCompra();
console.log(leerEvento(eje, compra.id, { nombres: { [menu.id]: 'menú', [compra.id]: 'compra' } }));
-->

```text
compra · huesped · 2026-11-07T13:30:00Z · sobre menú en 0000000000
0 · representación: Compra del menú del día
1 · recursos:
  0 · qué es: → menú:1 (ensalada · guiso · fruta)
  1 · cuánto: 1
  2 · con qué condición: EUR 12
2 · criterios: → menú:2 (sin gluten · vegetariano) · all announced movements happened · 2 ocupantes
3 · comunicación: huesped · cocina · 2 ocupantes
4 · fábrica: pagar · servir · 2 ocupantes
5 · estructura: purchase
```

Leído bajo la época 0 (§4.3): posición 0 representación, 1 recursos, 2 criterios, 3 comunicación, 4 fábrica. Por hojas (VG, 7-11 noche; §3.2): la posición 1 tiene un array dentro, así que es una **décupla** y en ella el dígito es el PV aplicado al nodo de arriba: 1.0 qué es (la lista de uno con la referencia al menú:1), 1.1 cuánto (la lista de uno `[1]`), 1.2 con qué condición (la lista de uno `["EUR 12"]`); cada posición va entre corchetes (forma canónica, VG 8-11, §3.2). Las posiciones 2, 3 y 4 son solo hojas: son **listas**, sus ocupantes por llegada (la referencia a los criterios del menú y la plantilla de cerrado que la huésped nombra, «all announced movements happened», encargo 3b: `docs/MOTOR.md`; quién habla con quién; las dos acciones). Quien copie la décupla como plantilla (1.3 «total», 1.4 «tiempo»…) obtiene direcciones que la época 0 lee como «con quién» y «qué se hace» (ver `docs/notas/PRUEBA_DEL_EXTRANJERO.md`).

## 2. Movimientos de tokens (E/P/R/T)

### 2.1 Familias y series: la constante

Toda familia de tokens es una **serie** (VG, 7-11-2026: «las series de tokens son una constante y se estandarizan»). La serie es limitada y la emite quien la respalda. Cada movimiento nombra su serie con los campos de `SERIE`, y la clave de saldo es `familia:campos` (unidos por `/`). En una línea por familia: familia, clave de serie, quién la emite.

| Familia | Nombre | Campos de serie | Clave de saldo | Quién la emite |
|---|---|---|---|---|
| `T` | tiempo | `escala` | `'T:<escala>'` | nadie, ni el génesis: cada persona recibe cada día su asignación (VG, 8-11, §2.4; no hay T acumulable) |
| `E` | recursos | `emisor`, `denominacion`, `registro` (opcional) | `'E:<emisor>/<denominacion>'` o `'E:<emisor>/<denominacion>@<registro>'` | una persona, a su nombre; la denominación va ligada al emisor como en R, y la serie al registro del recurso, con tope compartido (§2.4) |
| `P` | poder / criterio | `ambito` (el id de un registro) | `'P:<id del registro>'` | nadie a mano (encargo 3b, mapa §15): se **obtiene** (diez al escribir un registro, al conseguir E y al recibir R de su emisor) y se **reposiciona** por el árbol; se transfiere y se delega (§2.5) |
| `R` | reputación | `emisor` | `'R:<emisor>'` | una persona, a su nombre: la declara y solo ella la amplía (§2.4) |

`ESCALAS_T = ['segundo', 'minuto', 'hora', 'dia', 'semana', 'ciclo', 'anio', 'pasado', 'futuro', 'inventado']`: diez tokens distintos, el tope `MAXIMO_ESCALAS_T = 10` (`tokens.js` no carga si se pasa). Las siete primeras son las reales (`ESCALAS_REALES`); las tres últimas (`ESCALAS_INFORMATIVAS`, VG, 8-11) registran tiempo pasado, futuro o inventado, son ilimitadas, no miden (`SEGUNDOS` las da `null`) ni tienen orden, y se enseñan aparte (§2.4). **Sin conversión entre escalas**: una hora no son sesenta minutos; `T:hora` y `T:minuto` son saldos distintos, como `E:casa/EUR` y `E:casa/BTC`. T va en **enteros**: cada escala es un token, y media hora serían minutos. `SEGUNDOS` (segundo 1, minuto 60, hora 3600, dia 86400, semana 7·86400, ciclo 28·86400, anio (13·28+1)·86400 = 365 días) es la duración de cada escala real para medir distancias de tiempo (las bandas de `src/tiempo.js`); no convierte saldos. Semana, ciclo y año van en **partes diarias** (`PARTES_T`: 7, 28 y 364): `cantidad: 1` en `semana` es 1/7 de semana, y una semana entera son 7; `textoT('semana', 3)` lo lee «3/7 semana».

[D] (VG, 7-11, mapa §12): E con la denominación ligada al emisor como en R; R declarada por su emisor, ampliable solo por él y con rastro visible; las cosas son titulares que no emiten. [D] (VG, 7-11 noche): solo emiten las personas (un grupo es un registro), T es la asignación diaria de cada persona (VG, 8-11), hay bloqueo y liberación con salida, obligación del emisor de R y caducidad de E. [D] (VG, 8-11 y 9-11, mapa §15, encargo 3b): P es peso de criterio, obtenido y posicionado en registros; la exigencia encadena E → P → R → T; R se emite sin colateral y se transfiere entre tenedores. Todo implementado (§2.4, §2.5, §7.1); el ciclo de vida completo está en `docs/FUNDAMENTOS.md` («Ciclo de vida de cada token»).

Quién tiene T y cómo se obtiene P está decidido (VG, 8-11: T como asignación diaria; mapa §15: P obtenido y reposicionado, «unidades decimales») e implementado (§2.4, §2.5). [X] decidir VG: si R admite fracciones (hoy sí, en coma flotante, que acumula error; P es decimal por decisión de VG; T va en enteros, y E también salvo en las series declaradas `divisible`, R2).

### 2.2 Forma de un movimiento

```js
{ token: 'T', escala: 'minuto', cantidad: 2, de: 'cocina', a: null }                          // T: consumo de 2 minutos (T:minuto)
{ token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 12, de: 'huesped', a: 'cocina' }  // E: pago con EUR de la casa (E:casa/EUR)
{ token: 'P', cantidad: 2, ambito: '<id>', de: 'casa', a: 'cocina' }                          // P: pasar criterio sobre un registro
{ token: 'R', cantidad: 3, emisor: 'casa', de: 'casa', a: 'cocina' }                          // R: la casa da reputación suya
{ token: 'E', emisor: 'casa', denominacion: 'cama@2026-11-13', cantidad: 2, de: null, a: 'casa' } // emisión de una serie de E (§2.4)
{ token: 'E', emisor: 'casa', denominacion: 'cama@2026-11-13', registro: '<id>', cantidad: 2, de: null, a: 'casa' } // E atada al registro del recurso (E:casa/cama@2026-11-13@<id>)
{ token: 'R', cantidad: 10, emisor: 'casa', de: null, a: 'casa' }                             // emisión de R: la casa amplía la suya (§2.4)
{ token: 'P', cantidad: 4, ambito: '<id>', de: 'casa', a: 'ana', salida: '<decisión>' }      // delegar: transferir lo bloqueado con esa salida (§2.5)
```

| Campo | Regla |
|---|---|
| `token` | uno de `FAMILIAS = ['E', 'P', 'R', 'T']` |
| `cantidad` | número finito > 0; en T, entero (cada escala es un token; en semana, ciclo y año, en partes diarias: `PARTES_T`) |
| `refiere`, `nota` | solo en T `pasado`, `futuro` o `inventado`, que solo se consumen (`a = null`): `refiere` es la fecha a la que se refiere (instante ISO-8601 con zona; obligatoria en pasado y futuro, opcional en inventado), `nota` un texto opcional (VG, 8-11) |
| `escala` | obligatoria y válida si `token === 'T'`; prohibida en E/P/R |
| `denominacion` | obligatoria en E; prohibida en T/P/R |
| `ambito` | obligatorio en P (no hay P total): el id de un registro del eje (si no lo es, «P moves within a known scope», §7.4; ya no hay `'genesis'`); prohibido en el resto |
| `emisor` | obligatorio en E (la serie es suya) y en R; prohibido en T/P. R se transfiere entre tenedores sin cambiar de emisor (VG, 9-11, mapa §15: se retira la R no fungible) |
| `de` | identidad (cadena) o `null`. `null` = **emisión** (§2.3, §2.4); en E y R, `a` debe ser el propio emisor. |
| `estado`, `salida` | opcionales: `estado: 'bloqueo' \| 'liberacion'` con `de` = `a` (no cambia de titular) y `salida` (texto no vacío, la condición de liberación: declarada, no verificable todavía; el propio titular libera cuando quiere; **[X] decidir VG** qué la hace verificable). Una **transferencia con salida** (`de` y `a` distintos, sin `estado`; encargo 3b) sale de lo bloqueado de `de` con esa salida y llega a `a` bloqueada con ella, o libre si la salida nombra a quien la recibe: es delegar (§2.5) y recoger lo que guarda una invitación (§7.1) |
| `caduca` | opcional, solo en la emisión de E: instante ISO-8601 estricto con zona explícita, campo del contrato de la serie; se compara en UTC |
| texto de los campos | `de`, `a`, `emisor`, `denominacion`, `ambito` y `escala` no llevan `\|`, `:` ni `/`, los separadores de las claves de serie (PR #41): ni las identidades ni las denominaciones. Una denominación con hora (`cama@2026-11-13T00:00`) se rechaza; con fecha sola, no. |
| `a` | identidad o `null`. `null` = **consumo**. |
| `de` y `a` | ambos presentes; no pueden ser `null` los dos |

```js
SERIE                 // { T: ['escala'], E: ['emisor', 'denominacion'], P: ['ambito'], R: ['emisor'] }
TIPOS, EMITEN         // ['persona', 'cosa'], ['persona']: quién puede emitir (VG, 7-11 noche; sin grupo, VG 8-11)
ESTADOS               // ['bloqueo', 'liberacion']: movimientos que no cambian de titular
asignacionT(t, escala), ASIGNACION_T, PARTES_T, diaCivil(t), textoT(escala, n)  // la asignación diaria de T (VG, 8-11, §2.4)
validarMovimiento(m)  // → string[]  errores; [] si es válido
claveToken(m)         // → 'T:hora' | 'E:casa/EUR' | 'P:<id>/<origen>' | 'R:casa' | …   familia + ':' + los campos de SERIE unidos por '/'
partirClave(clave)    // → { token, serie, ...campos }   'E:casa/cama@2026-11-13' → { token: 'E', serie: 'casa/cama@2026-11-13', emisor: 'casa', denominacion: 'cama@2026-11-13' }
cantidadBase(m)       // → m.cantidad: sin conversión, cada serie se cuenta en su propia unidad
```

```sh
node --input-type=module -e "
import { claveToken, cantidadBase, partirClave, validarMovimiento, SERIE, ESCALAS_T, MAXIMO_ESCALAS_T, SEGUNDOS } from './src/tokens.js';
console.log(claveToken({ token: 'T', escala: 'hora', cantidad: 1 }), cantidadBase({ token: 'T', escala: 'hora', cantidad: 1 }), claveToken({ token: 'T', escala: 'minuto', cantidad: 60 }));
console.log(claveToken({ token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 12 }), claveToken({ token: 'P', ambito: 'menu' }), claveToken({ token: 'R', emisor: 'casa' }));
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
E:casa/EUR P:menu R:casa
{"T":["escala"],"E":["emisor","denominacion","registro"],"P":["ambito","origen"],"R":["emisor"]} 10 10 365
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
| `T <pasado o futuro> exige refiere: …` / `refiere debe ser instante ISO-8601 con zona explícita` / `T <escala> solo se consume (a = null): …` / `nota solo en T pasado, futuro o inventado` / `refiere solo en T pasado, futuro o inventado` / `la nota es texto` | el T informativo (VG, 8-11) |
| `E exige denominación` / `E exige emisor: la serie es de quien la emite` / `el emisor de E no lleva «/»` / `denominación solo en E` | la serie de E |
| `P exige ámbito: no hay poder total` / `ámbito solo en P` | el ámbito de P |
| `R exige emisor` | la serie de R (encargo 3b: se retira «R no es fungible»; quien la tiene la pasa, la devuelve o la quema) |
| `estado inválido: <x> (bloqueo o liberacion)` / `<estado>: de y a son el mismo titular (no cambia de manos)` / `<estado> exige salida: la condición de liberación, declarada (no verificable todavía)` / `salida solo con estado (bloqueo o liberacion) o en una transferencia (de y a)` / `una transferencia con salida cambia de manos: de y a son distintos` / `la salida es texto` | bloquear, liberar y transferir con salida (VG, 7-11 noche; encargo 3b) |
| `caduca solo en la emisión de E` / `caduca debe ser instante ISO-8601 con zona explícita` | la caducidad, campo del contrato de una serie de E |
| `la emisión de <E o R> va a su propio emisor` / `emisor solo en E y en R` | emisión a otro; `emisor` en T o P |
| `<campo> no puede llevar \| : ni /` | separadores reservados en `de`, `a`, `emisor`, `denominacion`, `ambito` o `escala` |
| `de y a son obligatorios (null permitido)` / `de debe ser identidad o null` / `a debe ser identidad o null` / `movimiento sin origen ni destino` | origen y destino |

### 2.3 Reglas del eje sobre los movimientos

Las aplica `eje.validar` (§7.4): nadie mueve tokens ajenos (`de` debe ser el autor; el «por cuenta de un grupo» se retiró, VG 8-11, «los grupos son solo delegación»; la única excepción es aceptar la propia invitación, que recoge lo que quien invita guardó con la salida = quien acepta, §7.1), y el saldo del autor debe cubrir la suma de lo que mueve **por clave de saldo** (minutos con minutos, horas con horas). El evento mínimo mueve T del autor, en cualquier escala: el coste de escribir es tiempo. `eje.escribir` solo exige que el autor mueva algo de T (cualquier cantidad y escala); el minuto por posición es de `escribirDesde` (`docs/MOTOR.md` §7.2) y del motor, así que escribir con ellos exige `T:minuto`. Emitir (`de === null`): el génesis no emite nada (es la época 0, §8); solo emiten las personas, con las reglas de la época (§2.4): T no se emite (cada persona tiene su asignación diaria), P no se acuña a mano (se obtiene y se reposiciona, §2.5), E y R a su nombre, con la exigencia E → P → R → T. Bloquear y liberar (`estado`) mueven entre el disponible y lo bloqueado del autor, por salida; el saldo es lo disponible. La simulación aplica los movimientos **en orden** sobre una vista de los saldos (débitos y abonos), así que lo emitido en un evento puede darse en ese mismo evento. Esa simulación es la del libro de transacciones (`src/libro.js`; VG, 9-11, la capa cero): cada evento es una transacción con un paso por movimiento (acuñar, transferir, bloquear, liberar, quemar) y se aplica entera o nada (`docs/notas/CAPA_CERO.md`).

### 2.4 Emisión de series

Emitir (iniciar una serie o ampliarla) es lo único reservado a las **personas** (VG, 7-11 noche: «todos son emitidos por una persona individualmente»): persona es quien escribió su propia alta (VG, 10-11, B1: no hay tipo, §7.1). No hay identidades de grupo (VG, 8-11, [X] confirmar VG: «lo único que tenemos de grupo es la delegación: yo te delego T, P, R, E para que tú lo uses; es la persona la que hace el registro»): un grupo es un **registro**; su autor obtiene P sobre él al escribirlo y lo delega, y cada persona emite a su nombre. Una **cosa** (una habitación, una plaza), cuya alta escribió su dueño, es titular: reciben, conservan y mueven tokens y firman con su clave, pero no emiten.

La exigencia encadena E → P → R → T (VG, 8-11 tarde, mapa §15 N3: «dos secuencias, no dos escalones»; reglas de la época, `docs/BQLM.md` §10.1): emitir R exige quemar T real del autor en la misma transacción (una escala que el calendario mide; el informativo no cuenta: «minting R needs real T»), sin colateral (VG, 9-11: el respaldo es la obligación de atender); emitir E exige P del autor posicionado en el registro al que la E está atada («minting E needs P on its record»: su `registro` o, sin él, el alta del emisor) y R propia emitida («minting E needs own R issued»: en su cartera, en manos de otros o en la misma transacción). P no se emite: se obtiene y se reposiciona (§2.5). Y el reloj no va hacia atrás (**[X] confirmar VG**): el `t` de cualquier evento no es anterior al de su `sobre` ni al del alta de su autor, así que un alta no se retrofecha para ganar días de asignación. La tabla completa, con el ciclo de vida de cada familia, está en `docs/FUNDAMENTOS.md`.

- **T** (VG, 8-11: «como en los videojuegos: llega a las 12 de la noche y te da todo el T del día siguiente, todos los segundos, todos los minutos, las horas, el día, el proporcional de la semana, de los 28 días y del año. Te lo gastas como quieras, no te puedes gastar más. Es suficiente para que no sea limitante»): nadie emite T, ni el génesis (`T no se emite: ni el génesis; cada persona tiene su asignación del día`; VG, 8-11: «no hay un tipo de T que se acumule»). Cada **persona** dada de alta tiene, por cada día civil de su propio reloj (el `t` de sus eventos, en UTC), su asignación entera (`ASIGNACION_T`): 86400 segundos, 1440 minutos, 24 horas, 1 día y una parte de semana, de ciclo y de año («tú diariamente tienes la posibilidad de poner uno partido de 7, 28 o 364 para que ese día decidas»). Lo no gastado **no se acumula** ([X] confirmar VG): al cambiar de día, la asignación es la nueva. Gastar (consumirlo o darlo a una cosa) sale de lo que queda del día; ningún T se acumula; si no alcanza, `writing burns today's T: <autor> burns less T than writing costs (<n> seconds), or more T than is left today (day <n>)` (la regla de la época). Una cosa no tiene asignación: gasta el T que le dio su persona (o otra cosa del mismo dueño, o de quien escribió su alta o tiene P sobre ella: VG, 8-11) y lo conserva hasta gastarlo; un grupo no tiene T. T no se bloquea ni se libera (`T is not locked: …`). Las tres informativas (`pasado`, `futuro`, `inventado`) son ilimitadas («pondría uno, pero si lo gastas te vuelve a salir uno»): no se rechazan por saldo, solo quedan registradas, con su `refiere` y su `nota`, y **pagan la escritura** (VG, 8-11): el evento sale gratis en T real y no es presente (`evento.esPresente`, `eje.presente(id)`; `PRESENTE()` en BQL). La serie es `T:<escala>`, sin emisor en la clave. `eje.saldoT(persona, escala, t)` dice lo que queda.
- **P** (mapa §15 [D] «P como peso de criterio»): nadie lo acuña a mano. Lo acuña el libro, como **obtención** (las reglas que escriben de la época, `docs/BQLM.md` §5): diez al escribir un registro (sobre él), y diez por unidad al recibir E (sobre el registro de la serie) o R (sobre su alta) directamente de su emisor (encargo 3b-bis: por cantidad, no por cabeza). Después se **reposiciona** por el árbol: un paso por transacción, quemando P de un registro y acuñándolo en su padre (una décima) o en un hijo (una décima más). `P:<id>/<origen>` es el P posicionado en ese registro que obtuvo `<origen>` (encargo 3b-bis: el P guarda su origen, como la R su emisor; pasarlo o reposicionarlo no lo cambia, y quien mueve P de otro origen lo dice con `origen` en el movimiento); ya no hay `P:genesis` ni P que cubra lo de debajo.
- **E**: una persona emite una **serie limitada** de una denominación que respalda (la casa emite un token por plaza y noche). La serie es **suya**, como en R: la clave lleva al emisor (`E:casa/cama@2026-11-13`). Por eso nadie se queda un nombre ni emite la denominación de otro: la misma denominación emitida por otro es otra serie (`E:bea/cama@2026-11-13`), y los EUR de la casa no son los de nadie más. Dentro de su serie, E es fungible: la mueve quien la tiene. Y va **atada al registro del recurso** (VG, 7-11 noche; R2): el campo `registro` (el id de un evento del eje) entra en la clave tras la última `@` (`E:casa/cama@2026-11-13@<id>`; una denominación no puede acabar en `@<id>`), y sin él la serie queda atada al registro del emisor. El E vivo de un registro y sus descendientes, por franja (lo que va tras la última `@` de la denominación: la noche en `cama@2026-11-13`; texto opaco cuya granularidad elige el dueño; sin `@`, una sola franja), no pasa de la capacidad que declara cualquier registro de su hilo (un entero en la posición 2 del payload raíz); cada serie emite en proporción al P comprometido con su clave, o la de su familia (franja `*`), como salida: el P posicionado en el registro que declara la capacidad o en lo que cuelga de él, frente al de todos (VG, 9-11, D1 y F1), y ese P no se libera mientras la serie viva. Fracciones solo con `divisible: true`; emisión conjunta con `emisores: [...]`. Detalle en `docs/FUNDAMENTOS.md` («E atada al recurso, con tope compartido»).
- **R** (VG, 9-11, mapa §15 [D] «R según el corpus»): su emisor la declara y solo él la amplía (`R:<emisor>`), sin colateral; cada ampliación es un evento suyo en el eje, y ese es el rastro visible. Se **transfiere** libremente entre tenedores sin cambiar de emisor; **devolverla** al emisor es pedirle atención, y el emisor la **atiende** con un registro suyo anclado sobre la petición, con T real (la lectura «attended»; el criterio de cada uno por su PV2 sigue [X] VG); y el tenedor puede **perdonar** la deuda quemándola. Mientras está en su cartera no obliga a nada; en manos ajenas es la **obligación** del emisor: `eje.obligaciones(emisor)` (derivada de los saldos, no es un token; doble entrada, V10). Un mensaje no emite R. La R no tiene un valor propio: vale ante quien la lee, una unidad cada una de los emisores que su lente nombra (los grupos de atención del lector que cobran con la R de quien escribe: `src/lente.js`, `docs/FUNDAMENTOS.md` «La lente de R»). Escribir en el 3 del alta de otro cuesta el precio que pone a tu grupo: su R devuelta, tu R, E o P («attention has a price», §7.1). No hay función que liste el rastro: son los eventos del emisor con un movimiento R `de: null` (`eje.series()` da solo el total emitido). [X] decidir VG: si quien la recibe puede rechazarla.

Cómo se nombra la plaza dentro de la denominación no está decidido: el ejemplo de abajo usa `cama@<noche>` con tantos tokens como camas (una serie por habitación y noche); con varias plazas hay que distinguirlas en el nombre (`hab1-cama1@<noche>`, o la dirección de la plaza, como hace Booking: `1100000000@<noche>`, con la habitación como registro de la serie), siempre sin `|`, `:` ni `/`. [X] decidir VG.

La emisión es un movimiento con `de: null`, `emisor` igual al autor del evento y `a` igual al emisor: la serie nace en la cartera de quien la emite. Para darla (las plazas a la habitación, la reputación a la cocina) se mueve después, en el mismo evento si quiere. La serie es limitada porque solo crece cuando su emisor emite; mover más de lo que hay se rechaza por saldo, y lo emitido de una serie no puede llegar a infinito. Las series de E y R de la emisión inicial quedan a nombre del autor del génesis (`Eje.genesis` completa `emisor` y las escribe en una transacción suya, la segunda del eje). La emisión de E puede llevar `caduca` (ISO): la fija la primera emisión, las ampliaciones coinciden y nada se ejecuta solo al caducar; `caducada(eje, clave, t)` la lee.

```js
eje.esPersona(identidad)     // → true si escribió su propia alta (persona), false si se la escribió otra identidad (cosa), null sin alta (VG, 10-11, B1)
eje.alta(identidad)          // → { id, t } del evento en que recibió tokens por primera vez, o null
eje.saldoT(id, escala, t)    // → T disponible el día de t: lo que queda de su asignación (persona) o lo que le dieron (cosa); ningún T se acumula (VG, 8-11)
eje.presente(id)             // → false si el registro se pagó solo con T informativo (VG, 8-11); true si no; undefined si no está
eje.gastadoT(persona, escala, dia) // → lo gastado de su asignación ese día civil (tokens.asignacionT)
eje.tiempoInformativo(id)    // → [{ escala, cantidad, autor, t, refiere, nota, id }]: el T pasado, futuro e inventado consumido sobre id, aparte
eje.serie(clave)             // → { emisor, emitido } de la serie con esa clave de saldo ({ emisor: null, emitido: 0 } si nadie la ha emitido), y caduca, divisible y emisores si los tiene
eje.series()                 // → [{ clave, token, serie, ...campos, emisor, emitido, bloqueado, caduca, registro, consumido, divisible, emisores, tope, nota (solo E) }] todas las series emitidas, por orden de emisión; en T, consumido y deAsignacion (lo que salió de las asignaciones), o informativa: true
eje.vivo(clave, t)           // → E vivo de una serie: emitido − consumido, y 0 si caducó en t (R2)
eje.registroDe(clave)        // → el registro al que está atada una serie de E: el de su clave o el de su emisor
eje.topes(registro, t, franja) // → [{ registro, capacidad, franja, vivo, libre }] por cada registro de su hilo que declara capacidad y cada franja (R2)
eje.bloqueado(id, clave)     // → lo bloqueado de esa serie en id (con un tercer argumento, solo lo de esa salida); eje.saldo es lo disponible
eje.bloqueos(id)             // → [{ clave, ...campos, salida, cantidad }]
eje.obligaciones(emisor)     // → su R en manos ajenas
caducada(eje, clave, t)      // → true si la serie de E tiene caducidad y t ya la alcanza
```

```js
import { Eje } from './src/eje.js';
const t = '2026-11-07T09:00:00Z';
const luego = '2026-11-07T10:00:00Z'; // bea escribe con su asignación de T del día (VG, 8-11)
const gasta = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });
const da = (a, cantidad) => ({ token: 'T', escala: 'minuto', cantidad, de: 'casa', a }); // T solo a una cosa: no cruza de persona
const emite = (emisor, denominacion, cantidad) => ({ token: 'E', emisor, denominacion, cantidad, de: null, a: emisor });
const cama = (cantidad, de, a) => ({ token: 'E', emisor: 'casa', denominacion: 'cama@2026-11-13', cantidad, de, a });
const R = (emisor, cantidad, de, a) => ({ token: 'R', emisor, cantidad, de, a });
const eje = await Eje.genesis({ demostracion: true, identidad: 'casa', emision: [{ token: 'R', cantidad: 10 }, { token: 'E', denominacion: 'EUR', cantidad: 500 }], foco: 'Casa', t });
await eje.aceptar(await eje.invitar({ autor: 'casa', invitado: 'bea', t }), {}, { t }); // bea acepta la invitación: su alta, una persona (B1)
const alta = await eje.escribir({ autor: 'casa', sobre: eje.genesisId, t, movimientos: [gasta('casa'), da('hab-2', 5)], payload: 'altas' }); // la habitación, una cosa: su alta la escribe la casa
const plazas = await eje.escribir({ autor: 'casa', sobre: alta.id, t, movimientos: [gasta('casa'), emite('casa', 'cama@2026-11-13', 2), cama(2, 'casa', 'hab-2')], payload: 'dos camas el 13-11, para la habitación 2' });
console.log(JSON.stringify(eje.serie('E:casa/cama@2026-11-13')), JSON.stringify(eje.recursos('hab-2')), eje.esPersona('hab-2'));
await eje.escribir({ autor: 'bea', sobre: plazas.id, t: luego, movimientos: [gasta('bea'), R('bea', 2, null, 'bea'), emite('bea', 'cama@2026-11-13', 1)], payload: 'la mía' });
console.log(JSON.stringify(eje.serie('E:bea/cama@2026-11-13')), JSON.stringify(eje.serie('R:bea')));
const no = (d) => eje.escribir({ sobre: plazas.id, payload: 'x', ...d }).catch((e) => console.log(e.message));
await no({ autor: 'bea', t: luego, movimientos: [gasta('bea'), emite('casa', 'cama@2026-11-14', 1)] });
await no({ autor: 'hab-2', t, movimientos: [gasta('hab-2'), emite('hab-2', 'cama@2026-11-13', 1)] });
await no({ autor: 'hab-2', t, movimientos: [gasta('hab-2'), cama(3, 'hab-2', 'bea')] });
await no({ autor: 'casa', t, movimientos: [gasta('casa'), { token: 'T', escala: 'hora', cantidad: 1, de: null, a: 'casa' }] });
await no({ autor: 'casa', t, movimientos: [gasta('casa'), { token: 'P', ambito: plazas.id, cantidad: 5, de: null, a: 'casa' }] });
await eje.escribir({ autor: 'hab-2', sobre: plazas.id, t, movimientos: [gasta('hab-2'), cama(1, 'hab-2', 'bea')], payload: 'reserva de bea' });
await eje.escribir({ autor: 'casa', sobre: plazas.id, t, movimientos: [gasta('casa'), R('casa', 2, 'casa', 'bea')], payload: 'reputación de la casa' }); // sin colateral (VG, 9-11)
await eje.escribir({ autor: 'bea', sobre: plazas.id, t: luego, movimientos: [gasta('bea'), R('casa', 1, 'bea', 'hab-2')], payload: 'te paso R de la casa' }); // R pasa de tenedor a tenedor (VG, 9-11)
console.log(eje.saldo('bea', 'E:casa/cama@2026-11-13'), JSON.stringify(eje.reputaciones('bea')), JSON.stringify(eje.reputaciones('hab-2')), eje.obligaciones('casa'));
const series = eje.series();
console.log(series.filter((x) => x.token !== 'P').map((x) => x.clave + ' ' + x.emitido).join(' · '), '· y', series.filter((x) => x.token === 'P').length, 'series de P, una por registro que dio P y por quien lo obtuvo');
```

```text
{"emisor":"casa","emitido":2} [{"emisor":"casa","denominacion":"cama@2026-11-13","cantidad":2}] false
{"emisor":"bea","emitido":1} {"emisor":"bea","emitido":2}
evento rechazado: E is minted by and to its issuer: bea mints E of casa, or to someone else; minting E needs P on its record: bea mints E on a record where it has no P
evento rechazado: only persons mint: hab-2 is a thing (its alta was written by casa), and only persons mint; minting E needs P on its record: hab-2 mints E on a record where it has no P; minting E needs own R issued: hab-2 mints E and has never issued R of its own
evento rechazado: saldo insuficiente de E:casa/cama@2026-11-13 en hab-2
evento rechazado: nobody mints T: casa mints 1 T; everyone has today's allowance
evento rechazado: P is repositioned one step at a time: casa mints P that is not one step of its own P up (a tenth) or down (a tenth more), from one record to its parent, a child or one of its views, keeping its origin
1 [{"emisor":"casa","cantidad":2},{"emisor":"bea","cantidad":2}] [{"emisor":"casa","cantidad":1}] 3
T:minuto 0 · R:casa 10 · E:casa/EUR 500 · E:casa/cama@2026-11-13 2 · R:bea 2 · E:bea/cama@2026-11-13 1 · y 12 series de P, una por registro que dio P y por quien lo obtuvo
```

Leído: la casa emite al empezar su R y sus euros (la emisión inicial, después del génesis), invita a bea, que acepta (su alta: una persona), y da de alta a la habitación, una cosa. Las camas de la casa van atadas a su alta (sin `registro`), donde tiene los diez P de haberla escrito. Bea emite su R y su cama en la misma transacción, quemando un minuto real. No pasan: bea emitiendo E de la casa; la habitación emitiendo (es una cosa, y además no tiene P ni R propia); la habitación moviendo más camas de las que tiene; la casa acuñando T; y la casa acuñando P a mano. La casa da R sin colateral y bea la pasa a la habitación sin devolverla a su emisor.

### 2.5 P: obtener, reposicionar, delegar y comprometer

Encargo 3b (VG, 8-11, mapa §15 [D] «P como peso de criterio»: «a P le estás dando mucho peso»). P son unidades **posicionadas en registros**: `P:X` es el criterio de su titular sobre el registro X, y nada más (no cubre lo que cuelga de X ni hay P sobre todo el eje). Se retiran «el autor de X acuña P:X», el P del génesis, la consolidación que amplía P (R3), el estrechamiento y el débito que subía por el hilo, y el paso de autorizar (`docs/MOTOR.md`).

- **Obtener** (N1, N2): el libro acuña diez P en la misma transacción, con la clase «obtencion», a quien escribe un registro (sobre él), a quien consigue E de otro (sobre el registro de la serie) y a quien recibe R directamente de su emisor (sobre el alta del emisor). Lo dicen las reglas que escriben de la época, no el código; lo que colocan es un nivel, un tope acumulado por regla, titular y registro (diez por unidad neta recibida del emisor; VG, tras 3b-bis), con un tope por serie (diez por unidad emitida). `eje.libro.asientos({ clase: 'obtencion' })` las lista.
- **Reposicionar** (N7): un paso por transacción. Quien escribe quema P suyo de un registro y lo acuña para sí en su padre (subir deja una décima: 10 → 1) o en un hijo (bajar añade una décima: 1 → 1,1), con decimales. Ir a un registro ajeno es subir al antepasado común y bajar, varios pasos («P is repositioned one step at a time»).
- **Pasar y delegar**: P se transfiere a otro sobre el mismo registro, sin cambiar de origen. Delegar es una **transferencia con salida** (mapa §15 [D] (6)): quien delega bloquea su P con la salida = la decisión y lo transfiere con esa salida; llega a quien recibe bloqueado con ella, comprometido con esa decisión, y cuenta como de quien lo obtuvo.
- **Comprometer** (mapa §15 [D] (5)): bloquear P con la salida = el id de la decisión. Los compromisos con X son la vista `X.2.4`, y el recuento los pesa según el criterio del dueño de X (`docs/MOTOR.md`).
- **El peso por dominio** (mapa §15 [D] (3)): el peso de A sobre X es el P que obtuvo A en X ÷ el que obtuvo A en el dominio de X, esté en la mano que esté (encargo 3b-bis: el reparto por origen), con el dominio el árbol que cuelga del registro más alto del hilo de X escrito por su dueño (la lectura «share», `A.2.6.8`; `motor.peso`). Dividir o fundir identidades no lo cambia.

```js
eje.poderes(identidad)              // → [{ ambito, origen, cantidad }]   una por serie; no hay P total
eje.poderSobre(identidad, registro, origen?) // → número: su P posicionado en ese registro, disponible y bloqueado (de todos los orígenes, o del que se diga)
eje.obtenidoPor(origen)             // → [{ registro, cantidad, titulares }]: el P que obtuvo, esté en la mano que esté
```

En Booking (`ejemplos/ikisai/reserva-booking.mjs`), la casa escribe el registro de dominio («Alojamiento»), donde obtiene sus diez P, y respalda las plazas comprometiendo ese P con la familia de cada plaza (su salida); cada parte de la confirmación mueve lo suyo. Pruebas: `test/reglas-3b.test.js`, `test/eprt.test.js`.

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

Las dos líneas de VG (8-11), escritas a mano (`menú` es una referencia al registro del menú):

```js
menú = ['Menú del día', ['ensalada', 'guiso', 'fruta']]
compra = ['Compra', [[menú], [1]]]
```

Leído, el menú: la 1 es una lista (solo hojas), tres ocupantes en una línea.

<!-- comprobar: leído
import { leer } from './src/lectura.js';
console.log(leer(['Menú del día', ['ensalada', 'guiso', 'fruta']]));
-->

```text
0 · representación: Menú del día
1 · recursos: ensalada · guiso · fruta · 3 ocupantes
```

Leído, la compra (con el eje, la referencia dice lo que alcanza): la 1 tiene arrays dentro, así que es una décupla y sus posiciones van una sangría más adentro, con las preguntas de la profundidad 1.

<!-- comprobar: leído
import { leer } from './src/lectura.js';
import { ejemploCompra } from './ejemplos/ikisai/compra-food.mjs';
const { eje, menu } = await ejemploCompra();
const menú = { ref: menu.id };
console.log(leer(['Compra', [[menú], [1]]], { eje, nombres: { [menu.id]: 'menú' } }));
-->

```text
0 · representación: Compra
1 · recursos:
  0 · qué es: → menú (Menú del día)
  1 · cuánto: 1
```

Sin envolver, `['Compra', [menú, 1]]` es otra cosa: la 1 es una lista de dos ocupantes.

<!-- comprobar: leído
import { leer } from './src/lectura.js';
import { ejemploCompra } from './ejemplos/ikisai/compra-food.mjs';
const { eje, menu } = await ejemploCompra();
const menú = { ref: menu.id };
console.log(leer(['Compra', [menú, 1]], { eje, nombres: { [menu.id]: 'menú' } }));
-->

```text
0 · representación: Compra
1 · recursos: → menú (Menú del día) · 1 · 2 ocupantes
```

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
- `ref` debe ser el **id completo**. Los prefijos (`'21367950'`) solo los resuelven BQL (`REF("21367950")`) y la entrada de texto de `escritura.item` (`'@21367950:1200000000'`), que los convierten en id completo antes de guardar.
- Sin `dir`, la referencia apunta al payload entero (`'0000000000'`).
- `btml.resolver` **no** sigue referencias; `encaje.seguir` sigue cadenas de referencias hasta 20 saltos.

Un payload con tres referencias al menú y a un evento que no está en el eje:

```js
['Compra de mediodía', [[{ ref: menú, dir: '1000000000' }], 1], { ref: menú, dir: '2000000000' }, [{ ref: 'ffff…' }]]
```

Leído sin eje, una referencia es solo su destino (`→ <id corto>:<dirección>`; sin dirección, el registro entero):

<!-- comprobar: leído
import { leer } from './src/lectura.js';
import { ejemploCompra } from './ejemplos/ikisai/compra-food.mjs';
const { menu } = await ejemploCompra();
const p = ['Compra de mediodía', [[{ ref: menu.id, dir: '1000000000' }], 1], { ref: menu.id, dir: '2000000000' }, [{ ref: 'f'.repeat(64) }]];
console.log(leer(p, { nombres: { [menu.id]: 'menú' } }));
-->

```text
0 · representación: Compra de mediodía
1 · recursos:
  0 · qué es: → menú:1
  1 · cuánto: 1
2 · criterios: → menú:2
3 · comunicación: → ffffffff
```

Leído con el eje, cada una dice además, entre paréntesis, lo que alcanza (sin copiarlo): el texto de su posición 0, la lista entera si alcanza una lista, o que está pendiente si el evento no ha llegado:

<!-- comprobar: leído
import { leer } from './src/lectura.js';
import { ejemploCompra } from './ejemplos/ikisai/compra-food.mjs';
const { eje, menu } = await ejemploCompra();
const p = ['Compra de mediodía', [[{ ref: menu.id, dir: '1000000000' }], 1], { ref: menu.id, dir: '2000000000' }, [{ ref: 'f'.repeat(64) }]];
console.log(leer(p, { eje, nombres: { [menu.id]: 'menú' } }));
-->

```text
0 · representación: Compra de mediodía
1 · recursos:
  0 · qué es: → menú:1 (ensalada · guiso · fruta)
  1 · cuánto: 1
2 · criterios: → menú:2 (sin gluten · vegetariano)
3 · comunicación: → ffffffff (pendiente: evento ausente del eje: ffffffff)
```

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

### 3.5 Lectura humana: `leer` y `leerEvento`

VG, 8-11: «es muy difícil de leer para una persona, incluido para mí; por eso es muy difícil evaluarlo sin lentes». `src/lectura.js` imprime un payload como un esquema de texto plano, sin colores ni HTML: **una línea por posición con contenido**, `<dígito> · <nombre>: <contenido>`, con **dos espacios de sangría por nivel**. Vive aparte de `src/btml.js` para que BTML siga sin depender de las épocas; `src/index.js` lo reexporta en plano.

```js
leer(payload, { epoca = EPOCA_0, profundidad = 0, eje, nombres } = {})  // → string
leerEvento(eje, id, { epoca = EPOCA_0, nombres, camino } = {})         // → string: cabecera, leer(payload) y los ocupantes anclados
```

- **Nombre**: la regla corta de la época en esa profundidad (§4.3). En la 0, la cruceta: representación, recursos, criterios…; en toda n ≥ 1, las preguntas: qué es, cuánto, con qué condición… Si la época tiene una regla larga para esa ruta exacta (leyendo desde la raíz), gana la larga.
- **Contenido**: una hoja, su texto (una fórmula, tal cual, sin evaluar); una referencia, `→ <id corto>` y, si apunta a una posición, `:<dirección en corto>` (`→ menú:1`); con `eje`, además, entre paréntesis lo que alcanza en su posición 0 (§3.3); una lista, sus ocupantes separados por ` · ` y, si son más de uno, `· n ocupantes`; una décupla, nada en su línea: sus posiciones van debajo, una sangría más adentro.
- Las posiciones vacías no se imprimen. Un payload terminal (sin posiciones, como el del génesis) se lee como su texto, en una línea.
- `profundidad`: la del nodo que se lee. En la 0 el payload es la cruceta aunque sean solo hojas; en una n ≥ 1 un array solo de hojas es una lista y se lee en una línea.
- `nombres`: un `Map`, un objeto o una función id → nombre corto, para leer `menú` en vez de `5c9fbf11` (sin él, los ocho primeros caracteres del id).

`leerEvento` pone delante una cabecera `<id corto> · <autor> · <t> · sobre <id corto> en <dirección>` (el génesis dice `génesis`) y, bajo cada posición, los **escritos anclados** en ella (`encaje.ocupantes`, camino exacto, por llegada), uno por línea: `↳ ocupante k · <autor> · <texto>`, con `k` su lugar en la lista de la posición (§6.7: los propios primero) y el texto de su posición 0. Los anclados en la raíz van al final, sin sangría. Con `camino`, solo la posición de ese camino (lo que enseña Clasificar). La compra con la cuenta de cocina escrita en `1000000000`:

<!-- comprobar: leído
import { leerEvento } from './src/lectura.js';
import { ejemploCompra, ejemploCuenta } from './ejemplos/ikisai/compra-food.mjs';
const { eje, menu, compra } = await ejemploCompra();
await ejemploCuenta(eje, compra);
const nombres = { [menu.id]: 'menú', [compra.id]: 'compra', [eje.genesisId]: 'génesis' };
console.log(leerEvento(eje, compra.id, { nombres }));
console.log(leerEvento(eje, compra.id, { nombres, camino: [1] }));
console.log(leerEvento(eje, eje.genesisId, { nombres }));
-->

```text
compra · huesped · 2026-11-07T13:30:00Z · sobre menú en 0000000000
0 · representación: Compra del menú del día
1 · recursos:
  0 · qué es: → menú:1 (ensalada · guiso · fruta)
  1 · cuánto: 1
  2 · con qué condición: EUR 12
  ↳ ocupante 2 · cocina · Cuenta del menú
2 · criterios: → menú:2 (sin gluten · vegetariano) · all announced movements happened · 2 ocupantes
3 · comunicación: huesped · cocina · 2 ocupantes
4 · fábrica: pagar · servir · 2 ocupantes
5 · estructura: purchase
compra · huesped · 2026-11-07T13:30:00Z · sobre menú en 0000000000 · posición 1
1 · recursos:
  0 · qué es: → menú:1 (ensalada · guiso · fruta)
  1 · cuánto: 1
  2 · con qué condición: EUR 12
  ↳ ocupante 2 · cocina · Cuenta del menú
génesis · casa · 2026-11-07T09:00:00Z · génesis
Casa de ejemplo
3 · comunicación:
  ↳ ocupante 1 · casa · invitation
↳ ocupante 1 · casa · Emisión inicial de casa
↳ ocupante 2 · casa · Altas del fin de semana
```

La cuenta es el ocupante 2 de la posición 1: el 1 es la propia décupla de la compra. El génesis (un terminal, sin movimientos) lleva anclada en su 3 la invitación de la casa a la huésped (encargo 3b, §7.1) y, en la raíz, la emisión inicial y las altas. En la app, el conmutador «leído» de Pointed enseña `leerEvento` del foco, y el de Clasificar, el de la posición en foco. `node ejemplos/ikisai/leer.mjs` imprime la compra, el menú y la reserva leídos.

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
2 criterios [2]
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
console.log(JSON.stringify(resolver(compra.payload, '1000000000')).replace(menu.id, '<menú>'));
console.log(resolver(compra.payload, '1020000000'), resolver(compra.payload, '7000000000'));
const r = resolver(compra.payload, '1000000000')[0][0];
console.log(r.ref === menu.id, JSON.stringify(resolver(eje.obtener(r.ref).payload, r.dir)), resolver(menu.payload, '1100000000'));
"
```

```text
["EUR 12"]
[[{"ref":"<menú>","dir":"1000000000"}],[1],["EUR 12"]]
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
const nombre = (e) => (e.id === cuenta.id ? 'cuenta' : 'nota');
const nota = await eje.escribir({ autor: 'huesped', sobre: compra.id, en: '7000000000', t: '2026-11-07T15:00:00Z', movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'huesped', a: null }], payload: 'repetir el sabado' });
console.log(eje.hilo(nota.id).map((e) => e.autor + '@' + e.en).join(' > '));
console.log(eje.sobre(compra.id).map((e) => nombre(e) + '@' + e.en).join(' '));
console.log(eje.sobre(compra.id, '1000000000').length, eje.sobre(compra.id, '0000000000').length);
console.log(cuenta.sobre === compra.id, cuenta.en, nota.en);
"
```

```text
huesped@7000000000 > huesped@0000000000 > cocina@0000000000 > casa@0000000000 > casa@0000000000
cuenta@1000000000 nota@7000000000
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
const { eje, compra, menu } = await ejemploCompra();
const cuenta = await ejemploCuenta(eje, compra);
const nom = (x) => x.replace(compra.id, 'compra').replace(menu.id, 'menú').replace(cuenta.id, 'cuenta');
console.log(JSON.stringify(caminosDe(compra.payload, '1000000000').map((c) => c.indices)));
for (const o of ocupantes(eje, compra.id, [1])) console.log(o.origen, JSON.stringify(o.camino), nom(o.evento), o.origenDir, JSON.stringify(o.vector), o.signo, o.acuerdo, JSON.stringify(o.procedencia.map(nom)));
console.log(ocupantes(eje, compra.id, [1, 0]).length, ocupantes(eje, compra.id, [1, 1]).length, ocupantes(eje, compra.id, [7]).length);
console.log(JSON.stringify(ocupantes(eje, compra.id, [1])[2].contenido), JSON.stringify(ocupantes(eje, compra.id, [1])[3].contenido[0]));
console.log(ocupantes(eje, compra.id, [3]).map((o) => o.indice + ':' + o.contenido).join(' '));
"
```

```text
[[1],[1,0]]
propio [1] compra 1000000000 [0,0,0,0,0,0,0,0,0,0] exacto 10 ["compra:1000000000#1"]
propio [1,0] compra 1000000000 [0,0,0,0,0,0,0,0,0,0] exacto 10 ["compra:1000000000#1.0[0]"]
referencia [1] menú 1000000000 [0,0,0,0,0,0,0,0,0,0] exacto 10 ["compra:1000000000#1.0[0]","menú:1000000000"]
escrito [] cuenta 1000000000 [0,0,0,0,0,0,0,0,0,0] exacto 10 ["cuenta:0000000000"]
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
  "evento": "<id del menú>",
  "dir": "1000000000",
  "camino": [1],
  "contenido": ["ensalada", "guiso", "fruta"],
  "procedencia": [
    "<id de la compra>:1000000000#1.0[0]",
    "<id del menú>:1000000000"
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
const { eje, compra, menu } = await ejemploCompra();
const r = seguir(eje, compra.payload[1][0][0]);
const nom = (x) => x.replace(menu.id, 'menú');
console.log(nom(r.evento), r.dir, JSON.stringify(r.camino), JSON.stringify(r.contenido), r.rota, JSON.stringify(r.procedencia.map(nom)));
const rota = seguir(eje, { ref: 'ffff' });
console.log(rota.rota, rota.contenido, JSON.stringify(rota.procedencia));
"
```

```text
menú 1000000000 [1] ["ensalada","guiso","fruta"] undefined ["menú:1000000000"]
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
import { pagaElCoste, escribirPagando } from './ejemplos/ikisai/coste.mjs';
import { ocupantes } from './src/encaje.js';
const { eje, compra } = await ejemploCompra();
const T = pagaElCoste('casa');
const plan = await escribirPagando(eje, { autor: 'casa', sobre: compra.id, t: '2026-11-07T16:00:00Z', movimientos: [T], payload: ['Plan', 'a', 'b', 'c', 'd', 'e', 'f', 'cena'] });
const x = await escribirPagando(eje, { autor: 'casa', sobre: compra.id, t: '2026-11-07T16:00:00Z', movimientos: [T], payload: ['X', 'r', { ref: plan.id, dir: '7000000000' }] });
await escribirPagando(eje, { autor: 'casa', sobre: x.id, en: '2000000000', t: '2026-11-07T16:00:00Z', movimientos: [T], payload: 'criterio escrito' });
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
2000000000 propio#2 referencia#2 propio#2
3000000000 propio#3 propio#3
4000000000 propio#4 propio#4
5000000000 propio#5
0000000000:2 1000000000:4 2000000000:3 3000000000:2 4000000000:2
false
```

Lectura: cada décupla con posición 0 colisiona con ella (`0000000000`, `1000000000`); una lista no (por hojas, VG 7-11 noche): en `2000000000` la lista de dos da su referencia, lo que alcanza y la plantilla de cerrado que la compra nombra, y en `3000000000` y `4000000000` cada elemento es un ocupante, sin 3.1 ni 4.1, porque el árbol no baja por una lista; `1000000000` suma además lo alcanzado por la referencia y la cuenta escrita; `1100000000` (el terminal `1`) tiene un solo ocupante. `arbol` no entra en los escritos: la cuenta aparece como un único ocupante (`escrito#`, camino `[]`) en su anclaje; sus subposiciones no son direcciones del foco (para verlas, `arbol(eje, cuenta.id)`).

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
for (const o of lista(eje, compra.id, [1])) console.log(o.llegada, o.tipo, o.camino.join('.') || 'raíz', JSON.stringify(o.contenido).replace(menu.id, '<menú>').replace(compra.id.slice(0, 8), '<compra>').slice(0, 40));
for (const o of lista(eje, menu.id, [1])) console.log(o.llegada, o.tipo, o.indice, o.contenido);
console.log(leerDireccion('1200000000').map((x) => x.significado).join(' › '));
console.log(leerCamino([3, 1], 'época 0', { payload: compra.payload }).map((x) => x.significado).join(' › '));
"
```

```text
0 propio 1 [[{"ref":"<menú>","dir":"1000000000"}],[
1 escrito raíz ["Cuenta del menú","=REF(\"<compra>\", \
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

Una identidad es una cadena (`'casa'`, `'cocina'`, `'huesped'`). **Existe cuando tiene alta**: el registro que abrió su cuenta en el libro. No hay registro de identidades aparte del libro.

**Persona o cosa, por autoría** (VG, 10-11, B1). No hay tipo. Una **persona** escribe su propia alta: el génesis (su autor, la primera identidad del eje) o, desde el encargo 3b, la **aceptación de una invitación** (mapa §16 [D] «El árbol mínimo es la invitación»). Una **cosa** es lo que da de alta otra identidad, su dueño, al darle tokens (`a: 'cocina'`). Las reglas lo leen del 3 de su alta (`first A.6.3 = A`). Ser persona decide quién emite (solo las personas; nadie a nombre de otro, §2.4) y quién tiene asignación de T; las cosas son titulares (reciben, conservan y mueven tokens, firman con su clave) pero no emiten. Un alta que declara `contexto.tipos` se rechaza («no hay tipo en el alta»); solo el prefijo de la versión 2 conserva el tipo que se declaraba entonces (suelo de persistencia).

**La invitación** (encargo 3b; «a person joins by an invitation»). Quien tiene alta invita con `eje.invitar({ autor, invitado, clave?, da?, grupo?, dominio?, comun?, hasta?, tema?, t })`: un registro suyo anclado en el 3 de su alta (`3000000000`), una décupla con 0 `invitation`, 1 lo que da (por defecto, una unidad de su R; lo guarda bloqueado con la salida = el invitado), 2 la referencia a la época, 3 quien invita, quien es invitado y, si la nombra, su clave, 4 cómo se acepta, 5 el dominio, 6 el alta de quien invita, 7 hasta cuándo vale, 8 el grupo de atención que le asigna (por defecto 0, desconocidos) y 9 el tema. El invitado acepta con `eje.aceptar(invitacion, clave?, { t })`: su primera transacción, anclada sobre la invitación y firmada con su clave, que quema un minuto de su día y recoge lo que la invitación le guarda (una transferencia desde quien invita con la salida = él). **Esa aceptación es su alta**: la escribe él, así que es una persona. Sin invitación (o con la de otro, caducada o con otra clave) nadie entra. `eje.entrar`, el alta abierta, se retira. Lo que el alta de una persona tiene que hacer después lo da el tutorial: `motor.siguiente(eje, alta, yo).tutorial` (`docs/MOTOR.md`).

**Escribir a otro** (mapa §16 [D] «PV3 = regla de atención»). Lo que se ancla en el 3 del alta de otra identidad es un mensaje, y paga el precio del grupo en que ella pone a quien escribe (sus grupos de atención, `A.3`: desconocidos 0, comercial 1, expertos 2, cercanos 3, equipo 4, vetados 5; quién está en cada uno lo ancla ella en el `3.k.3` de su alta, y el precio, en el `3.k.2`). Sin pago no entra; el veto rechaza aunque pague («attention has a price», `docs/BQLM.md` §10.1).

```js
eje.identidades()              // → string[] en orden de primera recepción
eje.saldo(identidad, clave)    // → número disponible; clave de saldo ('T:minuto', 'E:casa/EUR', 'P:<id>/<origen>', 'R:casa', …); 0 si no existe ('P', 'T' o 'E:EUR' a secas siempre dan 0)
eje.bloqueado(identidad, clave, salida?) // → lo bloqueado (de una salida, o de todas)
eje.bloqueos(identidad)        // → [{ clave, ...campos, salida, cantidad }]
eje.alta(identidad)            // → { id, t } de su alta, o null
eje.gastadoT(persona, escala, dia) // → lo gastado de su asignación diaria ese día civil (VG, 8-11)
eje.obligaciones(emisor)       // → su R en manos ajenas
eje.saldoT(identidad, escala, t) // → T disponible el día de t (sin t, el de su último evento): lo que queda de la asignación de una persona más saldo(identidad, 'T:' + escala); sin conversión; lanza si la escala no existe
eje.tiempos(identidad)         // → [{ escala, cantidad }] del T explícito (el de una cosa; una persona no tiene: VG, 8-11), en el orden de ESCALAS_T, solo saldos > 0
eje.recursos(identidad)        // → [{ emisor, denominacion, cantidad }]
eje.esPersona(identidad)       // → true (escribió su propia alta) | false (cosa: se la escribió otro) | null (sin alta)
eje.poderes(identidad)         // → [{ ambito, cantidad }] sus P con saldo > 0 (no hay P total)
eje.poderSobre(identidad, id)  // → su P posicionado en el registro `id`, disponible y bloqueado (encargo 3b)
eje.invitar({ autor, invitado, … }) // → Promise<la invitación>: anclada en el 3 del alta de quien invita
eje.aceptar(invitacion, clave?, { t }?) // → Promise<el alta de quien acepta>: una persona
eje.reputaciones(identidad)    // → [{ emisor, cantidad }] su R, por emisor
eje.clave(identidad)           // → clave pública (hex x-only, 64 caracteres) o undefined
```

### 7.2 Claves

- Las firmas son **Schnorr sobre secp256k1 según BIP-340**, como Nostr (NIP-01) y Taproot (`docs/notas/FIRMAS_BIP340.md`; la librería, vendorizada: `src/vendor/LEEME.md`). Una clave pública es la **x de 32 bytes** del punto (x-only), en hexadecimal en minúsculas: 64 caracteres. Al declararla, el eje comprueba que es eso y que la x es la de un punto de la curva (`lift_x` de BIP-340): si no, `clave inválida para <id>` (`autoridad.clavePublicaValida`). Mayúsculas, prefijos (`02…`) u otros largos no valen: una sola escritura por clave. No hay compatibilidad con las claves ECDSA P-256 (JWK) de antes.
- El génesis solo declara la clave de su autor; si la declara, el génesis va firmado con ella por su autor, igual al crearlo (`Eje.genesis`) que al restaurarlo (`Eje.desde`).
- Se declara en `contexto.claves[identidad]` **del alta de esa identidad**: el génesis para el autor inicial, con `clave`; la aceptación de su invitación para una persona (`eje.aceptar(invitacion, { publica, privada })`); el evento en que recibe tokens por primera vez para una cosa. Una clave declarada para una identidad que ya existe, o para una que no recibe tokens en ese evento, se rechaza. **No se puede cambiar una clave registrada.**
- **Sin clave no se actúa** (R9, regla madre de la neutralidad aceptada por VG el 7-11 noche; `docs/notas/NEUTRALIDAD_IDENTIDAD.md` §4). Una identidad sin clave registrada puede recibir tokens, pero no escribe: no mueve tokens ni escribe bases (`sin clave no se actúa: <id> no tiene clave registrada`). El génesis declara la clave de su autor y va firmado con ella; sin `clave`, `Eje.genesis` lanza.
- **Prueba de posesión.** Cada clave que declara un alta llega firmando el id del propio alta: `posesion: { <identidad>: <firma> }`, fuera del cuerpo como la firma del autor (no cambia el id; `autoridad.firmarPosesion`, o el tercer argumento de `eje.escribir`). Sin ella, `la clave de <id> llega sin prueba de posesión`; firmada con otra clave, `prueba de posesión inválida para <id>`; para una identidad que no declara clave en ese evento, `prueba de posesión de <id> sin clave declarada`.
- **Demostración.** Un eje creado con `Eje.genesis({ …, demostracion: true })` lleva `contexto.demostracion: true` en su génesis (`eje.demostracion`, visible en la interfaz) y conserva lo de antes: sin clave se escribe sin firma, y la prueba de posesión es opcional (si va, se comprueba). Los ejemplos de Ikisai, la app y casi todas las pruebas son de demostración. La demostración sale solo de esa bandera del génesis (SEG-02): un eje que viene de la versión 2 no exige claves en su prefijo, pero sí en lo que se le añade después.

### 7.3 Firmas

```js
generarClaves()              // → Promise<{ publica, privada }>: hex de 32 bytes cada una (la pública, x-only); el azar, de Web Crypto
publicaDe(privada)           // → la pública (hex x-only) de una privada; lanza si la privada no vale (0 < d < n)
firmar(ev, privada, firmante = ev.autor)  // → Promise<evento congelado con firmante y firma>; firma = BIP-340 sobre los 32 bytes del id (aux_rand de Web Crypto), en hex: 128 caracteres
verificar(ev, publica)       // → Promise<boolean>
firmarPosesion(ev, identidad, privada)    // → Promise<evento con posesion[identidad]>: la clave nueva firma el id (R9)
verificarPosesion(ev, identidad, publica) // → Promise<boolean>
eje.escribir(datos, privada, { <identidad>: privada }?)  // el tercer argumento añade la prueba de posesión de cada clave nueva
exportarPrivada(privada)     // → Promise<hex>   la misma privada, comprobada (para guardarla en local; nunca entra en el eje)
importarPrivada(hex)         // → Promise<hex>   la comprueba al leerla; lanza si no vale (por ejemplo, un JWK P-256 de antes)
clavePublicaValida(publica)  // → boolean: hex x-only de un punto de la curva
huella(publica)              // → sus primeros 8 caracteres, para mostrar
```

Reglas del eje: quien tiene clave registrada **debe firmar** cada evento suyo, `firmante` debe ser el `autor` (también en el génesis), y la firma se verifica al añadir y al restaurar. `verificar` solo acepta la firma como la escribe `firmar`: 64 bytes en hexadecimal en minúsculas (una sola escritura por firma); el mensaje firmado es el id (los 32 bytes del SHA-256 del cuerpo canónico), así que la firma sigue fuera del hash. Quien no tiene clave escribe sin firma, salvo que el eje se cree con `exigirFirmas: true` (entonces todo autor necesita clave y el génesis debe ir firmado). La firma no cambia el id. Las claves privadas nunca entran en el eje.

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
const eje = await Eje.genesis({ demostracion: true, identidad: 'casa', emision: [], foco: 'g', t: '2026-11-06T20:00:00Z', clave: casa.publica, privada: casa.privada });
const g = eje.obtener(eje.genesisId);
console.log(g.firmante, JSON.stringify(Object.keys(g.contexto.claves)), g.contexto.claves.casa.length, g.contexto.claves.casa === casa.publica);
await eje.escribir({ autor: 'casa', sobre: g.id, t: '2026-11-06T20:00:00Z', movimientos: [T('casa')], payload: 'sin firma' }).catch((e) => console.log(e.message));
const alta = await eje.escribir({ autor: 'casa', sobre: g.id, t: '2026-11-06T20:00:00Z', movimientos: [T('casa'), { token: 'T', escala: 'minuto', cantidad: 60, de: 'casa', a: 'bea' }], payload: 'alta de bea', contexto: { claves: { bea: bea.publica } } }, casa.privada); // bea, una cosa de la casa (su alta la escribe la casa, B1): T no cruza de persona
console.log(alta.firmante, eje.clave('bea') === bea.publica);
await eje.escribir({ autor: 'bea', sobre: alta.id, t: '2026-11-06T20:00:00Z', movimientos: [T('bea')], payload: 'x' }, casa.privada).catch((e) => console.log(e.message));
const ok = await eje.escribir({ autor: 'bea', sobre: alta.id, t: '2026-11-06T20:00:00Z', movimientos: [T('bea')], payload: 'x' }, bea.privada);
console.log(ok.firmante, ok.firma.length === 128);
await eje.escribir({ autor: 'casa', sobre: g.id, t: '2026-11-06T20:00:00Z', movimientos: [T('casa')], payload: 'cambio', contexto: { claves: { bea: casa.publica } } }, casa.privada).catch((e) => console.log(e.message));
"
```

```text
true casa true false false
casa ["casa"] 64 true
evento rechazado: who has a key signs: casa has a key and this transaction is not signed by them (signer: nadie)
casa true
evento rechazado: firma inválida de bea
bea true
evento rechazado: a key is declared at its alta: bea already has an account, or is neither the author nor receives anything here
```

Un génesis firmado del eje de ejemplo tiene esta forma (la clave y la firma varían en cada ejecución; el id cambia respecto al génesis sin clave porque `contexto.claves` está en el cuerpo). La emisión inicial de la casa, sus euros y su R, va después, en una transacción suya (§8):

```json
{
  "autor": "casa",
  "sobre": null,
  "en": "0000000000",
  "t": "2026-11-07T09:00:00Z",
  "movimientos": [],
  "payload": "Casa de ejemplo",
  "contexto": {
    "genesis": true,
    "epoca": "<id de la época 0>",
    "claves": { "casa": "d95dc4936c57cf68318a04398093205d55e199bff3e2574319ece42adfe075d3" }
  },
  "id": "<id del génesis>",
  "firmante": "casa",
  "firma": "2149e3e4663b34448d41f15c87aeecb3486efd475ee5069c144b89ef5a52f90d9945d819e4168e1073cb58eb45581d5e307dc4d272f7256c3dc9ced7bfe93a2b"
}
```

### 7.4 Rechazos del eje (`eje.validar`)

`eje.anadir` y `eje.escribir` lanzan `Error('evento rechazado: ' + errores.join('; '))`. Antes, `crearEvento` ya ha lanzado `evento mal formado` si falla la forma (§1.3).

Cada fila de esta tabla sale de una condición de validez de la transacción del evento: el suelo (`src/condiciones/`), una regla de la época (encargo 3a: `src/condiciones/reglas.js`, que rechaza con su 9) o lo que queda en JS; la tabla de cuál es cuál está en `docs/notas/CAPA_CERO.md` §3. Después va la aritmética del libro. Los errores salen en el orden de las condiciones (las reglas, en el de su 8) y, al final, los saldos de cada movimiento en su orden.

| Error | Causa |
|---|---|
| `id no corresponde al cuerpo` | suelo: el id no es el hash del cuerpo (evento manipulado) |
| `evento ya registrado` | suelo: mismo id ya en el eje |
| `ya hay génesis` / `solo el génesis carece de foco` / `el génesis no mueve nada: es la época 0 (encargo 3b); …` | suelo: `contexto.genesis` en un evento que no es el primero, `sobre === null`, o un génesis con movimientos (también uno guardado antes del 3b) |
| `referencia a un evento que no está en el eje: <id8> (mientras el eje es local; con red, se resuelve antes de aceptar)` | suelo (VG, 10-11, C1): una referencia `{ ref }` del payload a un evento que el eje no tiene. Una fórmula `=REF("…")` es texto y sí entra (queda PENDIENTE al leerla) |
| `firma inválida de <autor>` / `autor sin clave: <autor>` | suelo: la firma no verifica; `exigirFirmas` y el autor no tiene clave |
| `clave inválida para <id>` / `prueba de posesión inválida para <id>: …` / `prueba de posesión de <id> sin clave declarada para él en este evento` | suelo: la clave declarada no es una clave pública válida, su prueba de posesión no la firma esa clave, o sobra |
| `no hay tipo en el alta (VG, 10-11, B1): …` | un alta que declara `contexto.tipos` fuera del prefijo de la versión 2 |
| `<regla>: <su 9>` | una regla de la época rechaza la transacción (encargo 3a): su nombre y su mensaje, relleno con lo que vale en la candidata. Las de abajo |
| `who has a key signs: <autor> has a key and this transaction is not signed by them (signer: <firmante>)` | el autor tiene clave y no firma, o firma otro (B4) |
| `without a key nobody acts: <autor> has no key (…)` | R9: fuera de la demostración, el autor no tiene clave |
| `a key is declared at its alta: <id> already has an account, or is neither the author nor receives anything here` | una clave que se declara para quien ya tiene cuenta, o para alguien que no es el autor ni recibe nada |
| `a declared key comes with its proof: the key of <id> comes without the signature of that key on the id of this alta (posesion)` | R9: la clave de una cosa llega sin su prueba de posesión (fuera de la demostración) |
| `every record hangs on a record of the ledger: <sobre> is not one (…)` | `sobre` no está en el eje |
| `writing burns today's T: <autor> burns less T than writing costs (<n> seconds), or more T than is left today (day <n>)` | el autor quema menos T del que cuesta escribir (la regla «the cost of writing»: un minuto por posición; VG, 12-11, #64 b), o una persona gasta más T del que le queda del día (VG, 8-11) |
| `only persons mint: <autor> is a thing (its alta was written by <dueño>), and only persons mint` | una emisión por una cosa (B1). En el prefijo de la versión 2: `solo las personas emiten: <autor> es grupo (lo declaró su alta, de la versión 2)` |
| `E is minted by and to its issuer: …` / `R is minted by its issuer: …` | emisión de E o R cuyo emisor no es el autor (tampoco a nombre de un grupo: VG, 8-11) |
| `nobody mints T: <autor> mints <n> T; everyone has today's allowance` | una emisión de T fuera del génesis |
| `T is not locked: <autor> locks or releases T; …` | un movimiento de T con `estado` |
| `T only goes to things: <autor> gives T to <a>: …` | T a otra persona, o de una cosa a una cosa de otro dueño sin escribir su alta ni tener P sobre ella (VG, 7-11 noche y 8-11) |
| `not before its focus: …` / `not before the writer joined: …` / `at most a year ahead: …` | el reloj no va hacia atrás, ni más de un año hacia delante, en segundos (C2) |
| `E is tied to a record that exists: <serie> names a record that is not in the ledger` | la E nombra un registro que no está |
| `locked P backing live E is not released: …` | se libera P que respalda una serie de E viva |
| `nobody moves tokens of others: <autor> moves from <de>` | un movimiento con `de !== autor` (el «por cuenta de un grupo» se retiró: VG, 8-11), salvo aceptar la propia invitación: quien aún no tiene alta, anclado sobre una invitación que lo nombra, recoge para sí lo que quien invita guardó con la salida = él (§7.1) |
| `nadie mueve lo ajeno: <autor> saca lo bloqueado de <de> sin aceptar una invitación suya que lo nombre` | suelo (capa 4): una transferencia con salida desde otro titular que no es esa aceptación |
| `P moves within a known scope: <id> names no record of the ledger` | un movimiento de P cuyo `ambito` no es un registro del eje (ya no hay `'genesis'`) |
| `P is repositioned one step at a time: <autor> mints P that is not one step of its own P up (a tenth) or down (a tenth more), …` | acuñar P a mano, para otro, con otro factor o más de un nivel (§2.5) |
| `minting R needs real T: …` / `minting E needs P on its record: …` / `minting E needs own R issued: …` | la exigencia E → P → R → T (§2.4) |
| `attention has a price: <autor> writes to <receptor> without the price of its group in the same transaction, or is vetoed` | un mensaje en el 3 del alta de otro sin su precio, o de alguien vetado (§7.1) |
| `a person joins by an invitation: <autor> has no alta and does not accept an invitation that names it (in time, with its key)` | quien no tiene alta escribe sin aceptar una invitación que lo nombre (§7.1) |
| `la serie <clave> caduca el <t>: una ampliación no cambia su caducidad` / `la serie <clave> no caduca: …` | una ampliación de E con otra caducidad |
| `saldo disponible insuficiente para bloquear <clave> en <autor>` / `no hay <n> de <clave> bloqueado en <autor> con la salida «<salida>»` | suelo: bloquear más de lo disponible, o liberar o transferir con salida lo que no está bloqueado con ella |
| `la serie <clave> no admite tanto` | suelo: lo emitido de la serie dejaría de ser un número finito |
| `saldo insuficiente de <clave> en <autor>` | suelo: la suma de lo movido por clave supera el saldo (sin conversión: `T:minuto` no se paga con `T:hora`) |

En el prefijo de la versión 2 siguen las reglas de entonces, con sus textos (`autor desconocido`, `firma ausente`, `no se puede cambiar la clave`, `tipo declarado … sin darle tokens`…).

```sh
node --input-type=module -e "
import { Eje } from './src/eje.js';
const eje = await Eje.genesis({ demostracion: true, identidad: 'raiz', emision: [], foco: 'g', t: '2026-11-06T20:00:00Z' });
const T = (de, cantidad = 1) => ({ token: 'T', escala: 'minuto', cantidad, de, a: null });
const base = { autor: 'raiz', sobre: eje.genesisId, t: '2026-11-06T20:00:00Z', payload: 'x' };
const intentos = [
  { ...base, sobre: 'nadie', movimientos: [T('raiz')] },
  { ...base, autor: 'bea', movimientos: [T('bea')] },
  { ...base, movimientos: [{ token: 'E', emisor: 'raiz', denominacion: 'EUR', cantidad: 1, de: 'raiz', a: 'bea' }] },
  { ...base, movimientos: [T('raiz'), { token: 'T', escala: 'minuto', cantidad: 1, de: null, a: 'raiz' }] },
  { ...base, movimientos: [T('raiz'), { token: 'E', emisor: 'bea', denominacion: 'EUR', cantidad: 1, de: null, a: 'bea' }] },
  { ...base, movimientos: [T('raiz'), { token: 'E', emisor: 'raiz', denominacion: 'EUR', cantidad: 1, de: null, a: 'raiz' }] },
  { ...base, movimientos: [T('raiz', 2000)] },
  { ...base, movimientos: [{ token: 'T', escala: 'hora', cantidad: 25, de: 'raiz', a: null }] },
  { ...base, en: '4', movimientos: [T('raiz')] },
  { ...base, movimientos: [T('raiz')], payload: ['a', null] },
  { ...base, movimientos: [T('raiz')], contexto: { genesis: true } },
];
for (const d of intentos) await eje.escribir(d).catch((e) => console.log(e.message));
"
```

```text
evento rechazado: every record hangs on a record of the ledger: nadie is not one
evento rechazado: attention has a price: bea writes to raiz without the price of its group in the same transaction, or is vetoed; a person joins by an invitation: bea has no alta and does not accept an invitation that names it (in time, with its key)
evento mal formado: escribir consume T del autor: un movimiento de T con de = raiz y a = null (VG, 7-11 noche)
evento rechazado: nobody mints T: raiz mints 1 T; everyone has today's allowance
evento rechazado: E is minted by and to its issuer: raiz mints E of bea, or to someone else; minting E needs P on its record: raiz mints E on a record where it has no P; minting E needs own R issued: raiz mints E and has never issued R of its own
evento rechazado: minting E needs own R issued: raiz mints E and has never issued R of its own
evento rechazado: writing burns today's T: raiz burns less T than writing costs (60 seconds), or more T than is left today (day 20763)
evento rechazado: writing burns today's T: raiz burns less T than writing costs (60 seconds), or more T than is left today (day 20763)
evento mal formado: en debe ser una dirección de diez dígitos
evento mal formado: payload 1: hueco
evento rechazado: ya hay génesis
```

## 8. Génesis

El génesis es el primer evento del eje y **es la época 0 en este eje** (VG, 10-11, A2; mapa §16 [D] «El árbol mínimo es la invitación»; encargo 3b): un registro **sin movimientos**, fuera del sistema, que lleva en su contexto el id de la época (`contexto.epoca`) y `contexto.genesis: true`. Es el único sin foco (`sobre: null`) y no pasa por las reglas de la época, solo por el suelo (lo que declara, su firma). Fija el foco raíz (su `payload`) y es el **alta de la primera identidad**: la única alta sin invitación; las demás personas entran aceptando una (§7.1). Su autor obtiene diez P sobre él al escribirlo, como sobre todo registro propio. Lo que quiera emitir al empezar (`emision`: E y R; nunca T ni P) va en una transacción suya sobre el génesis, la segunda del eje, que sí pasa por las reglas: quema un minuto de su día, emite R antes que E (emitir E exige R propia emitida) y ata sus E al génesis, donde tiene sus diez P.

```js
Eje.genesis({ identidad, emision, foco, t = ahora, contexto = {}, clave, privada, exigirFirmas = false, demostracion = false })  // → Promise<Eje>
//   identidad: primera identidad; su autor escribe su propia alta: es una persona (VG, 10-11, B1: no hay tipo; pasar `tipo` lanza)
//   emision: [{ token, cantidad, denominacion | emisor }], E y R, si quiere (puede ir vacía): se escribe en una segunda
//   transacción, con de: null, a: identidad y, en E y R, emisor: identidad. T no («nobody mints T») ni P (lanza: «nadie acuña P a mano»)
//   foco: payload BTML raíz; clave/privada: si se dan, el génesis declara la clave y va firmado
//   sin clave no se actúa (R9): sin clave/privada lanza, salvo con demostracion: true (contexto.demostracion,
//   eje.demostracion), que conserva lo de antes: sin claves y sin prueba de posesión obligatoria
Eje.desde(eventos, { exigirFirmas = false } = {})  // → Promise<Eje>  reconstruye validando cada evento (ids, firmas, saldos); el primero debe ser el génesis
eje.genesisId                                      // id del génesis
```

```sh
node --input-type=module -e "
import { Eje } from './src/eje.js';
const eje = await Eje.genesis({ demostracion: true, identidad: 'raiz', emision: [{ token: 'R', cantidad: 3 }, { token: 'E', denominacion: 'EUR', cantidad: 5 }], foco: ['casa', ['menu']], t: '2026-11-06T20:00:00Z' });
const g = eje.obtener(eje.genesisId);
console.log(JSON.stringify(g.movimientos), JSON.stringify(g.payload), g.contexto.genesis, g.contexto.epoca === (await import('./src/epocas.js')).EPOCA_0_BTML.id);
const emision = eje.obtener(eje.orden[1]);
console.log(emision.autor, emision.sobre === eje.genesisId, emision.movimientos.map((m) => (m.de === null ? 'acuña ' : 'quema ') + m.cantidad + ' ' + m.token).join(', '));
const alta = await eje.escribir({ autor: 'raiz', sobre: eje.genesisId, en: '1000000000', t: '2026-11-06T20:01:00Z', movimientos: [{ token: 'T', escala: 'minuto', cantidad: 1, de: 'raiz', a: null }, { token: 'T', escala: 'hora', cantidad: 2, de: 'raiz', a: 'bea' }], payload: 'alta de bea' }); // bea, una cosa: su alta la escribe raiz (B1); T, solo a una cosa; raiz gasta su asignación del día: ningún T se acumula (VG, 8-11)
console.log(JSON.stringify(eje.identidades()), eje.saldoT('raiz', 'minuto'), eje.saldoT('raiz', 'hora'), eje.saldoT('bea', 'hora'), eje.saldo('raiz', 'E:raiz/EUR'), JSON.stringify(eje.serie('E:raiz/EUR')), eje.poderSobre('raiz', eje.genesisId));
console.log(alta.sobre === eje.genesisId, alta.en, eje.sobre(eje.genesisId, '1000000000').length);
await Eje.genesis({ demostracion: true, identidad: 'x', emision: [{ token: 'P', ambito: 'genesis', cantidad: 1 }], foco: 'x', t: '2026-11-06T20:00:00Z' }).catch((e) => console.log(e.message.slice(0, 60) + '…'));
"
```

```text
[] ["casa",["menu"]] true true
raiz true quema 1 T, acuña 3 R, acuña 5 E
["raiz","bea"] 1438 22 2 5 {"emisor":"raiz","emitido":5} 10
true 1000000000 1
génesis: nadie acuña P a mano (mapa §15, «P como peso de cri…
```

### 8.1 Guardar y reconstruir

El eje se guarda como **la lista de sus eventos en orden**; nada más. Al restaurar se vuelve a validar todo (ids, firmas, saldos). El árbol lógico, los saldos, las claves, los tipos y las series se reconstruyen.

La versión 2 (7-11) llega con las series de tokens (T por escala, E ligada a su emisor, tipos en el alta): un eje guardado con la versión 1 no se restaura. La versión 3 (7-11 noche) trae el ciclo de vida de los tokens (solo emiten personas, emisión escalonada, bloqueo, caducidad): lo guardado sigue siendo la lista de eventos, pero las reglas nuevas rechazarían un eje de la versión 2 (un génesis de un grupo, E o R emitidos fuera del génesis sin el escalonado, eventos fechados antes que su foco). Por eso `migrar` marca todos sus eventos (`v2: { eventos, ultimo }`, con el id del último, que `restaurar` comprueba) y `restaurar` los revalida con las reglas de la 2; las nuevas rigen lo que se añada después, y `serializar` conserva la marca. Un `eventosV2` suelto en un guardado se rechaza (`docs/MOTOR.md` §9). Lo que ni las reglas de la 2 admiten no se restaura, y la app lo aparta igual. Un eje de la versión 3 guardado antes del 8-11 cuyo génesis emitía T tampoco se restaura (VG, 8-11: «no hay un tipo de T que se acumule»; el génesis ya no emite T): no hay migración, porque ese T era justo lo que se acumulaba. Tampoco uno guardado antes del encargo 3b: su génesis movía tokens (`el génesis no mueve nada: es la época 0`), sus personas entraban sin invitación y su P era el de antes; [X] decidir VG si hace falta migrarlo. La app, en vez de pisarlo en silencio, lo aparta en `agram.eje.anterior` y avisa antes de empezar con el ejemplo.

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
console.log(datos.version, datos.exigirFirmas, datos.eventos.length, datos.eventos.map((e) => e.autor).join(' '));
const otro = await restaurar(datos);
console.log(otro.saldo('cocina', 'E:casa/EUR'), JSON.stringify(otro.identidades()), otro.orden.length);
datos.eventos[6].movimientos[1].cantidad = 1; // la compra
await restaurar(datos).catch((e) => console.log(e.message));
"
```

```text
3 false 8 casa casa casa huesped casa cocina huesped cocina
12 ["casa","huesped","cocina"] 8
evento rechazado: id no corresponde al cuerpo
```

Pendiente: persistencia en base de datos y anclaje a una cadena. La forma de los eventos no cambia con eso.

## 9. El eje de ejemplo

`ejemplos/ikisai/compra-food.mjs` construye ocho eventos con datos inventados. `ejemploCompra({ claves })` devuelve `{ eje, alta, menu, compra }`; `ejemploCuenta(eje, compra, privadaCocina)` añade la cuenta. Con claves, los ids cambian (las claves van en el cuerpo) y cada identidad firma.

| Evento | autor | sobre | en | payload |
|---|---|---|---|---|
| génesis | casa | — | `0000000000` | `"Casa de ejemplo"` (sin movimientos: la época 0, §8) |
| emisión inicial | casa | génesis | `0000000000` | `["Emisión inicial de casa"]`: 10 `R:casa` y 500 `E:casa/EUR` |
| invitación | casa | génesis | `3000000000` | `[["invitation"], ["1 R:casa"], [{ref: época}], [["casa"], ["huesped"]], …]` (§7.1) |
| alta de la huésped | huesped | invitación | `0000000000` | `["Alta de huesped"]`: acepta la invitación y recoge su R:casa |
| alta | casa | génesis | `0000000000` | `["Altas del fin de semana", ["cocina", "huesped"]]` |
| menú | cocina | alta | `0000000000` | `["Menú del día", ["ensalada", "guiso", "fruta"], ["sin gluten", "vegetariano"]]` |
| compra | huesped | menú | `0000000000` | `["Compra del menú del día", [[{ref: menú, dir: "1000000000"}], [1], ["EUR 12"]], [{ref: menú, dir: "2000000000"}, "all announced movements happened"], ["huesped", "cocina"], ["pagar", "servir"]]` |
| cuenta | cocina | compra | `1000000000` | `["Cuenta del menú", "=REF(\"<compra>\", \"1200000000\") + 2 EUR", "=LOCAL(1) + 15 min", "==no es fórmula"]` |

Series: la casa (una persona: escribe el génesis, que es su alta; B1) emite al empezar 10 `R:casa` y 500 `E:casa/EUR` (la serie es suya: la clave lleva al emisor); ningún T se emite, y P no se emite: cada registro da diez P a quien lo escribe, y quien recibe R o E de su emisor obtiene diez P por unidad en su registro, de origen él (§2.5; encargo 3b-bis). La huésped entra por la invitación de la casa (es una persona) y recoge la unidad de R que le guardaba; la casa da de alta a la cocina (una cosa) con horas y minutos de su T, que son tokens distintos, y da euros a la huésped. Las personas gastan de su asignación del día; la cocina, del T que le dio la casa. Saldos tras los ocho eventos: casa 440 EUR y 9 `R:casa`; cocina 18 h y 237 min de T, 12 EUR; huesped 48 EUR y 1 `R:casa`; y cada uno, diez P por registro propio, más los obtenidos sobre el génesis (la huésped, veinte: por la R y por los euros; la cocina, diez: por los euros).

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

// src/lectura.js (§3.5)
export function leer(payload, { epoca, profundidad = 0, eje, nombres } = {}): string;  // una línea por posición: «<dígito> · <nombre>: <contenido>», dos espacios por nivel
export function leerEvento(eje, id, { epoca, nombres, camino } = {}): string;          // cabecera + leer(payload) + «↳ ocupante k · autor · texto» bajo cada posición

// src/tokens.js
export const AMBITO_GENESIS = 'genesis';                 // el P del génesis de la versión 2 (suelo de persistencia); desde el encargo 3b no hay P sobre todo el eje
export const FAMILIAS = ['E', 'P', 'R', 'T'];
export const SERIE = { T: ['escala'], E: ['emisor', 'denominacion'], P: ['ambito'], R: ['emisor'] };
export const ESCALAS_REALES = ['segundo', 'minuto', 'hora', 'dia', 'semana', 'ciclo', 'anio'];
export const ESCALAS_INFORMATIVAS = ['pasado', 'futuro', 'inventado'];   // VG, 8-11: ilimitadas, con refiere y nota
export const ESCALAS_T = [...ESCALAS_REALES, ...ESCALAS_INFORMATIVAS]; // diez
export const MAXIMO_ESCALAS_T = 10;                       // tokens.js lanza al cargar si ESCALAS_T lo supera
export const TIPOS = ['persona', 'cosa'];  // sin grupo (VG, 8-11): un grupo es un registro
export const EMITEN = ['persona'];                         // VG, 7-11 noche
export const ESTADOS = ['bloqueo', 'liberacion'];
export const ASIGNACION_T = { segundo: 86400, minuto: 1440, hora: 24, dia: 1, semana: 1, ciclo: 1, anio: 1 };  // VG, 8-11: cada día
export const PARTES_T = { semana: 7, ciclo: 28, anio: 364 };  // semana, ciclo y año van en partes diarias
export function asignacionT(t, escala): { periodo, cantidad }; // periodo: el día civil (UTC) de t
export function diaCivil(t): number;
export function textoT(escala, cantidad): string;          // «3/7 semana», «1 semana», «5 minuto»
export const SEGUNDOS = { segundo: 1, minuto: 60, hora: 3600, dia: 86400, semana: 604800, ciclo: 2419200, anio: 31536000, pasado: null, futuro: null, inventado: null };  // solo para medir distancias
export function validarMovimiento(m): string[];
export function claveToken(m): string;                    // 'T:hora' | 'E:casa/EUR' | 'P:<id>/<origen>' | 'R:casa' | …
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
  static async genesis({ identidad, emision, foco, t, contexto, clave, privada, exigirFirmas, demostracion = false }): Promise<Eje>;  // sin movimientos; la emisión, en una segunda transacción; sin clave lanza, salvo demostracion (R9); con tipo o con P lanza
  static async desde(eventos, { exigirFirmas = false } = {}): Promise<Eje>;
  eventos: Map<id, Evento>; orden: id[]; claves: Map<identidad, string>; exigirFirmas: boolean; demostracion: boolean;   // series y altas son privados: se leen con serie(), series(), alta(), esPersona()
  get libro(): Libro;                                      // la capa cero (src/libro.js): saldos, bloqueos, vistas por identidad, sumas, el diario
  get saldos(): Map<identidad, Map<clave, number>>;        // copia leída del libro (compatibilidad)
  get bloqueados(): Map<identidad, Map<clave, Map<salida, number>>>;  // ídem
  transaccion(ev): Transaccion;                            // el evento como transacción del libro, con el eje de ahora (docs/notas/CAPA_CERO.md §2)
  contexto(ev): object;                                    // lo que leen las condiciones de su transacción: el eje de antes del evento
  antes(k): Eje;                                           // el eje con los k primeros eventos (lo que leen las capas de validez)
  get genesisId(): string;
  obtener(id): Evento | undefined;
  identidades(): string[];
  saldo(identidad, clave): number;
  tiempos(identidad): { escala, cantidad }[];
  recursos(identidad): { emisor, denominacion, cantidad }[];
  poderes(identidad): { ambito, cantidad }[];
  reputaciones(identidad): { emisor, cantidad }[];
  poderSobre(identidad, registro): number;                 // su P posicionado en ese registro (disponible y bloqueado)
  serie(clave): { emisor, emitido, caduca? };            // por clave de saldo: 'E:casa/EUR', 'R:casa', 'T:hora', 'P:<id>/<origen>'
  series(): { clave, token, serie, ...campos, emisor, emitido, bloqueado, caduca? }[];  // caduca solo en E (ISO o null)
  bloqueado(identidad, clave, salida?): number;
  bloqueos(identidad): { clave, token, serie, ...campos, salida, cantidad }[];
  bloqueosCon(salida): { identidad, clave, cantidad }[];  // lo bloqueado por cualquiera con esa salida (los compromisos con una decisión)
  obligaciones(emisor): number;                            // su R en manos ajenas
  alta(identidad): { id, t } | null;
  saldoT(identidad, escala, t?): number;                  // asignación del día (persona) o lo recibido (cosa); ningún T se acumula (VG, 8-11)
  presente(id): boolean | undefined;                       // false si se pagó solo con T informativo (VG, 8-11)
  gastadoT(identidad, escala, dia): number;
  tiempoInformativo(id): { escala, cantidad, autor, t, refiere, nota, id }[];
  clave(identidad): string | undefined;   // hex x-only
  esPersona(identidad): boolean | null;                    // B1: escribió su propia alta (en el prefijo v2, el tipo declarado); null sin alta
  tipoV2(identidad): string | null;                        // el tipo que declaró un alta del prefijo de la versión 2
  async invitar({ autor, invitado, clave?, da?, grupo?, dominio?, comun?, hasta?, tema?, t, privada? }): Promise<Evento>;  // la invitación, en el 3 del alta de autor (§7.1)
  async aceptar(invitacion, clave?, { t, payload }?): Promise<Evento>;  // el alta de quien acepta: una persona (B1); sustituye a entrar
  async validar(ev): Promise<string[]>;
  async anadir(ev): Promise<Evento>;                       // lanza 'evento rechazado: …'
  async escribir(datos, privada?, posesion?): Promise<Evento>;  // crearEvento + (firmarPosesion por cada { identidad: privada }) + (firmar) + anadir
  hilo(id): Evento[];                                      // hasta el génesis
  sobre(id, en?): Evento[];                                // hijos directos
  sobreDe(id, en, autores: Set): Evento[];                 // los anclados en (id, en) por esos autores, en orden de entrada (índice por autor, R8)
  cuantosSobre(id, en): number;                            // cuántos anclados en (id, en)
}
export function caducada(eje, clave, t): boolean;          // solo lee la caducidad de una serie de E; nada se ejecuta solo

// src/libro.js (la capa cero, VG 9-11: «registrar es hacer una transacción»)
export function acunar(serie, a, cantidad, opciones?): Primitiva;          // opciones: clase, etiqueta, tope
export function transferir(serie, de, a, cantidad, opciones?): Primitiva;  // opciones: fuentes, clase, etiqueta y salida (de lo bloqueado de de con ella; a a su disponible si salida === a)
export function bloquear(serie, de, cantidad, salida): Primitiva;
export function liberar(serie, de, cantidad, salida): Primitiva;
export function quemar(serie, de, cantidad, opciones?): Primitiva;
export function transaccion({ movimientos, ancla: { sobre, en }, memo, autor, t, firma, abre, … }): Transaccion;  // movimientos: pasos (una primitiva o un grupo atómico)
export class Libro {
  async aplicar(tx, condiciones?, contexto?): Promise<{ ok, motivos }>;   // entera o nada; condiciones (tx, libroAntes, contexto) → null | motivo
  async probar(tx, condiciones?, contexto?): Promise<{ motivos, simulacion }>;  // sin tocar el libro
  async evaluar(tx, condiciones?, contexto?): Promise<motivo[]>;          // solo las condiciones
  asentar(tx, simulacion?): asiento[];                                    // sin condiciones; lanza si la aritmética falla
  saldo(id, serie): number; bloqueado(id, serie, salida?): number; bloqueadoPorSalida(salida, serie?): number | object;
  bloqueos(id): { serie, salida, cantidad }[]; bloqueosCon(salida): { titular, serie, cantidad }[];
  vista(id): { [serie]: { disponible, bloqueado: { [salida]: number } } };  // la cartera por series
  alta(id): Transaccion | null; titulares(): string[]; tiene(id): boolean;
  sumas({ primitiva, serie, registro, titular, clase, etiqueta, desde, hasta }): number | { [serie]: number };
  asientos(filtro): asiento[];                                            // el diario
}

// src/ciclo.js
export function reglasDelCiclo(ev, ctx): { i, capa: 4 | 5, texto }[];  // lo que queda en JS: la caducidad de una serie de E (EE-9) y las reglas de la versión 2; lo usan eje.validar y validez
export const SECCIONES_DEL_CICLO: { nombre, filas, evaluar(ev, ctx, validos) }[];  // EE-9; lo demás son reglas de la época (src/condiciones/reglas.js)
export function motivoTipo(id, tipo): string | null;  // por qué no vale ese tipo en un alta (null si vale)
export function motivoAjenos(de): string;                  // «nadie mueve tokens ajenos: <de> no es el autor»

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
export async function generarClaves(): Promise<{ publica: string, privada: string }>;   // hex: x-only y escalar, 32 bytes
export function publicaDe(privada: string): string;
export async function exportarPrivada(privada: string): Promise<string>;
export async function importarPrivada(privada: string): Promise<string>;
export function clavePublicaValida(publica): boolean;
export async function firmar(ev, privada, firmante = ev.autor): Promise<Evento>;
export async function verificar(ev, publica): Promise<boolean>;
export async function firmarPosesion(ev, identidad, privada): Promise<Evento>;  // R9: la clave nueva firma el id del alta (posesion)
export async function verificarPosesion(ev, identidad, publica): Promise<boolean>;
export function huella(publica): string;

// src/epocas.js
export const PV: string[10];
export const TODAS = 'todas';
export function cargarEpoca(datos, { respaldo }?): Epoca;
export function cargarEpocaBtml(payload, { registros, correcciones, id }?): EpocaBtml;  // §12; condiciones, escrituras y lecturas
export const EPOCA_0_BTML: EpocaBtml; export const EPOCA_0_BTML_ID: string;  // la época 0 como registro y su id (el que lleva el génesis)
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
| La regla de T por persona y reloj (PROVISIONAL, neutralidad ante agrupación y división) y las reglas del ciclo marcadas «[X] confirmar VG» (§2.4); qué hace verificable la salida de un bloqueo; escalas de T octava a décima; fracciones en E y R ([X] decidir VG) | §2.1, §2.4 |
| Rechazar reputación recibida; nombre de la plaza en la denominación ([X] decidir VG) | §2.4 |
| Migrar un eje guardado antes del encargo 3b ([X] decidir VG) | §8.1 |
| Dónde van las noches de la reserva (dentro, y entonces qué llevan 5 y 6, o ancladas en el 7); dónde se ancla lo lejano, en el foco o en la décupla ([X] decidir VG) | §5 |
| Anidar hileras o décuplas en una posición concreta por decisión | §5 |
| Persistencia en base de datos y anclaje a una cadena | §8.1 |
| Comprobación de `t` contra un reloj o contra el orden del eje | §1.1: solo `Date.parse` |
| [X] decidir VG: profundidad máxima de un payload (hoy un payload de miles de niveles agota la pila al validarlo; al crear o restaurar se rechaza como «no cabe en JSON») | §3.2, `test/propiedades.test.js` |
| Decidido (VG, 7-11 noche): mover T de uno a sí mismo no paga la escritura; escribir consume T | §2, `test/propiedades.test.js`, `test/t-consumido.test.js` |
| [X] decidir VG: `exigirFirmas` se guarda fuera de lo firmado (un archivo manipulado restaura con la política rebajada) | §8.1, `test/propiedades.test.js` |
| [X] decidir VG: la firma de un autor sin clave registrada se guarda sin verificar | §7.3, `test/propiedades.test.js` |

## 12. La época como registro

Decisión de VG (9-11, mapa §16 [D]): **la época es un registro leído con la cruceta, y el génesis es la época**. `datos/epocas/epoca-0.btml.json` es la época 0 escrita así, como una décupla BTML en forma canónica y **sin posiciones vacías** (VG: «no hay posiciones vacías; nunca se escribe [] directamente»): ningún array vacío ni hueco, y la raíz y cada regla con las diez posiciones llenas. Convive con `datos/epocas/epoca-0.json`, el formato de siempre, que sigue cargando `EPOCA_0` y todo lo que lo usa; las cien reglas cortas son las mismas en los dos (`test/epoca-btml.test.js`). El génesis de cada eje la referencia: lleva su id en `contexto.epoca` (encargo 3b, §8), y una invitación, en su 2.

| Posición | Lleva |
|---|---|
| 0 nombre | `['época 0', 'epoch 0']` |
| 1 recursos | las cuatro familias, en el orden de `FAMILIAS`: 1.0 E, 1.1 P, 1.2 R, 1.3 T; cada una `[[letra, nombre], [estructura], [estado]]`. E: las cuatro orientaciones del corpus (financiero y material, conocimiento e información, social y relacional, productivo y capacidad). P: cinco criterios, las miradas 1-5 (económico, administrativo, social, técnico, de encaje), «[X] confirmar VG». P lleva además 1.1.3, quién lo obtiene, y 1.1.4, `[["obtain and reposition"], [10], [0.1, 1.1], [nota]]`: diez por registro, subir deja una décima y bajar añade una (mapa §15). R: las seis zonas de la atención (1.2.1), cada una `[[nombre], [zona], [[precio], [cuánto]]]`: desconocidos 0 «my R», comercial 1 «E», expertos 2 «P», cercanos 3 «their R», equipo 4 «their R», vetados 5 «nothing»; el precio del equipo y los «cuánto» siguen «[X] confirmar VG». T: diez escalas como dígitos (0 segundo … 6 año, 7 pasado, 8 futuro, 9 inventado), cada una `[[nombre], [asignación diaria], [en partes de]]`: 86400, 1440, 24, 1, 1 de 7, 1 de 28, 1 de 364, y «sin límite» en 7, 8 y 9 |
| 2 criterios | las reglas largas, como condiciones (`docs/BQLM.md` §10). Cada regla es su propio registro (VG, 10-11, A1), y el 2 es la **lista de referencias** `{ ref }` a esos registros, una hoja por regla y sin tope de diez, en el orden que dice el 8 de cada una. Los registros viven en `datos/epocas/reglas/<su 0 en kebab>.json`; su id es el hash de su cuerpo canónico, como el de un evento. Son 53: 30 condiciones, conectadas al eje (encargo 3a: cada una es una condición de la transacción y rechaza con su 9), 3 reglas que escriben, con `put` en su 4 (encargo 3b: la obtención de P, que el libro acuña en la misma transacción), 10 lecturas, con `read` en su 4 (B5: «present», «informative», «attended», «obligation»; 3b: «share», «weight»; 3c-1: «maturity»; 3c-2a: «attention group», «attention price», «stage»; el contexto las pone en la posición que dice su 3), y las 10 lecturas de los puntos de vista, con `point of view` en su 4 y el PV en su 3 (encargo «lecturas», issue #12: «qué lee el PV d aplicado a un nodo», que el contrato encadena por los dígitos de una dirección; `docs/CONTRATO.md` §4.4). La primera es «writing burns today's T» (`docs/BQLM.md` §6) |
| 3 con quién | 3.0 la plantilla de identidad (qué va en cada posición de un alta: 1 cartera, 2 criterio, `A.2.1` su P posicionado y `A.2.3` los criterios que adopta, 3 grupos de atención, `A.3.k` la zona k con su precio en `3.k.2` y quiénes en `3.k.3`, 7 tiempo, 8 `A.8.1` su obligación…); 3.1 el autor del primer registro, «el autor del génesis» |
| 4 qué se hace | 4.0 las cinco primitivas (`mint`, `transfer`, `lock`, `release`, `burn`) y 4.1 los cinco despliegues (D-META, D-MOV, D-SERIE, D-FECHA, D-VALOR), con su nombre y una línea |
| 5 dónde encaja | las cien reglas cortas: 5.p.d = `[[nombre], [significado], [ejemplo]]` de la regla del dígito d en la profundidad p |
| 6 de dónde viene | la procedencia: una línea por decisión de VG citada, con su fecha |
| 7 para cuándo | 7.0 el calendario: las siete escalas que se miden, por su dígito, cada una `[[nombre], [segundos], [días]]` (segundo 1, minuto 60, hora 3600, día 86 400; semana de 7 días, ciclo de 28, año de 364 + 1 = 31 536 000 segundos); las informativas no se miden y no están. 7.1 el reloj: «el tiempo lo marcan los demás». 7.2 las escalas que se refieren a otra fecha: 7 (pasado) y 8 (futuro). Son los datos del mundo (VG, 10-11, A3): `src/tokens.js` lee de aquí `SEGUNDOS`, y del 1.3 `ASIGNACION_T` y `PARTES_T`, y ninguna regla escribe un número que la época tenga |
| 8 frente a otros | 8.0 los cortes de las cajas (1 2 3 4 6 10 16 26 42), 8.1 los órdenes de magnitud (8.1.n = `[[10^(n−1)], [10^n]]`), 8.2 el mínimo y el máximo de cada modo y, del encargo 3c-1 (`docs/CONTRATO.md`), 8.3 el espacio de bloque (datos que caben → puntos de vista, la disposición y el paso), 8.4 los niveles de madurez, 8.5 los órdenes de los ocupantes, 8.6 los pasos de tamaño de Mapped y 8.7 la división de cada mundo a pantalla completa (VG, 10-11 noche): una fila por PV `[[pv], [hijos], [profundidad], [formas], [lo que mide], [estilo de los de abajo], [nota], [hilos]]`, la cruceta aplicada al elemento pulsado (`docs/CONTRATO.md` §4.2-§4.3) |
| 9 cómo | 9.0 las plantillas, fórmulas del BQL mínimo con `it` = el registro (encargo 3b, `docs/MOTOR.md`): 9.0.0 el recuento («weighted sum», «weighted mean», «threshold»; umbral por defecto 0 y presión máxima 9), 9.0.1 cerrado («all announced movements happened»), 9.0.2 la zona de quien no está en ningún grupo (desconocidos, «my R») y 9.0.3 siguiente («what is missing», con las plantillas de transacción «move what was announced» y «commit P»); 9.1 el orden del tutorial: 5, 4, 1, 7, 2, 8, 9, 3 y la segunda alta; del encargo 3c-1 (`docs/CONTRATO.md`), 9.2 las plantillas de dominio («purchase», «booking»), 9.3 la plantilla «preferences» (con 9.3.5 el tipo y 9.3.6 la preferencia `model`, del 3c-2b), 9.4 los mensajes por idioma (es) y 9.5 las representaciones (formatos y tamaños); del encargo 3c-2b (`docs/CONTRATO.md` §10-§11), 9.6 las plantillas de transacción del aro (encargo 3c-2a, `docs/CONTRATO.md` §12: 9.6.0 la cabecera, 9.6.1 la lista de referencias a los registros de `datos/epocas/plantillas/`, en el orden de su 8: [punto de vista, orden]), 9.7 los modelos de visualización (9.7.0 la cabecera: niveles, cadena de respaldo, orientaciones, tipos de pieza con su clave, la preferencia que nombra el modelo, los formatos animados, loop/once, el múltiplo de los fotogramas; 9.7.1… las referencias a los registros de los modelos de `datos/epocas/modelos/`, cada uno con sus piezas referenciadas por mundo) y 9.8 la tabla de pasos (una fila por punto de vista: el ciclo del 4, la caja de la cuota del 8, la escala de T del 7 y la madurez de todo elemento) |

Una regla es una décupla del molde (mapa §16 [D]): 0 nombre, 1 constantes que usa, 2 condición (una fórmula «=…» del BQL mínimo, lo único con álgebra), 3 a quién aplica, 4 qué primitiva vigila, 5 dónde cuelga (`*` toda transacción, un dígito una corta, una ruta una larga), 6 de dónde viene, 7 desde qué época rige, 8 orden frente a otras reglas, 9 mensaje. Una lectura (B5) lleva `read` en su 4: su 2 es la fórmula que se lee (`it` es lo leído), su 3 la posición donde se materializa (`X.6.1` de un registro, `A.8.1` de una identidad) y su 9 lo que dice. Una regla que escribe (encargo 3b) lleva `put` en su 4: su 2 coloca con `put v at X.d.(k)` y el libro asienta lo que coloca en el P posicionado (`docs/BQLM.md` §5). La que es provisional lo marca en su 6 («[provisional]», A2).

**La época = el registro raíz + los registros de sus reglas, referenciados** (como la invitación: se referencia, no se manda). `npm run epocas` (`datos/epocas/generar.mjs`) lee `datos/epocas/reglas/`, calcula el id de cada regla, reescribe el 2 de la raíz con sus referencias en el orden de su 8 y genera `datos/epocas/epocas.js` con la raíz, los registros (`REGLAS_DE_EPOCA_DATOS`) y las correcciones; desde el encargo 3c-2b hace lo mismo con los modelos de visualización (`datos/epocas/modelos/`: reescribe las posiciones de cada modelo con las referencias a sus piezas y el 9.7 de la raíz con las referencias a los modelos, `MODELOS_DE_EPOCA_DATOS`), que el cargador recibe como registros junto a las reglas. **Corregir una regla no la modifica en sitio**: se añade un ocupante a su registro, un archivo en `datos/epocas/correcciones/` `{ "sobre": <id de la regla>, "en": <la posición, un dígito>, "ocupante": <lo nuevo>, "de": <procedencia> }`; el registro y su id no cambian, el cargador pone el ocupante detrás de lo suyo y quien la lee toma el último (la condición del 2, el mensaje del 9).

```js
cargarEpocaBtml(payload, { registros, correcciones })  // → la época: lo mismo que cargarEpoca (regla, reglaCorta, larga, reglaLarga, ordinal, cortes, cortesConOrigen) y además payload y registro (la décupla congelada), condiciones (las reglas del 2 que no son lecturas ni escriben, resueltas, en su orden), escrituras (las de `put` en su 4), lecturas (las de `read` en su 4), id (el de la raíz, si se pasa), reglasConId ([{ id, regla }]) y registros (Map id → regla); rechaza una época con [] o huecos, sin las diez, con un 2 que no son referencias o que no resuelven, con una regla incompleta o sin «=…» en su 2
EPOCA_0_BTML               // la época 0 como décupla, con sus registros de reglas; no está en EPOCAS (es la misma época en otro formato); leerDireccion(dir, EPOCA_0_BTML) lee igual que con EPOCA_0
```

Leída con el BQL mínimo (`docs/BQLM.md`): `epoch.1.3.1.2.1` es la asignación diaria de horas (24), `epoch.5.1.1.0` el nombre de la regla corta 1.1 («cuánto») y `(first epoch.2).0` el nombre de la primera regla: el 2 es una lista, así que sus reglas se toman con `first`, `last` y `nth k` (cada referencia lleva a su registro), y `epoch.2.0` da el 0 de todas.

```sh
node --input-type=module -e "
import { evaluar } from './src/bqlm.js';
import { ContextoEje } from './src/contexto-eje.js';
import { EPOCA_0_BTML } from './src/epocas.js';
const ctx = new ContextoEje(null, { epoch: EPOCA_0_BTML });
for (const e of ['epoch.0', 'first epoch.1.3.0', 'epoch.1.3.1.2.1', 'epoch.1.3.1.4.2', 'epoch.5.1.1.0', '(first epoch.2).0', 'count epoch.2', 'epoch.8.0', 'epoch.9.1']) console.log(e, '→', evaluar(e, ctx).texto);
"
```

```text
epoch.0 → época 0, epoch 0
first epoch.1.3.0 → T
epoch.1.3.1.2.1 → 24
epoch.1.3.1.4.2 → 7
epoch.5.1.1.0 → cuánto
(first epoch.2).0 → writing burns today's T
count epoch.2 → 57
epoch.8.0 → 1, 2, 3, 4, 6, 10, 16, 26, 42
epoch.9.1 → 5, 4, 1, 7, 2, 8, 9, 3, segunda alta
```
