# BTML: la estructura de datos de AGRAM

BTML es la estructura de datos de AGRAM. Este documento describe BTML **tal como existe en el código** (`src/btml.js`, `src/evento.js`, `src/tokens.js`, `src/eje.js`, `src/encaje.js`, `src/autoridad.js`, `src/epocas.js`, `src/persistencia.js`), con firmas de funciones, tablas y ejemplos ejecutables. Lo que no existe se marca con «pendiente».

Convenciones de este documento:

- Todos los ejemplos se ejecutan **desde la raíz del repositorio** con `node --input-type=module -e "..."` (Node ≥ 20). La salida que sigue a cada ejemplo es la salida real.
- Los ids del eje de ejemplo (`ejemplos/ikisai/compra-food.mjs`) son deterministas (hash de un cuerpo fijo), así que se citan completos. Los primeros ocho caracteres bastan para reconocerlos: génesis `6c1c5968`, alta `ccf5a120`, menú `4598f23e`, compra `f9e59d1e`, cuenta `c70bfa6e`.
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
| `src/epocas.js` | Significado de cada dígito: época 0 y época 1 propuesta, cargadas desde `datos/epocas/` | `PV`, `EPOCA_0`, `EPOCA_1`, `EPOCAS`, `cargarEpoca`, `leerDireccion` |
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
| `tipos: { identidad: 'persona' \| 'grupo' \| 'cosa' }` | `Eje.genesis` (tipo del autor, con `tipo`) y quien da de alta | Tipo de una identidad que **recibe tokens en este mismo evento**. Solo decide quién emite (§2.4, §7.1). |
| `modo` | `escritura.escribirDesde` | `'pointed'`, `'sequenced'` o `'mapped'`. |
| `motor`, `fase`, `fuentes`, `encaje`, `evidencia` | `motor.js` | Fábrica: consolidación, autorización, ejecución. Fuera de este documento. |

### 1.5 Un evento real: la compra

Cuarto evento del eje de ejemplo. Su `sobre` es el menú; su `payload` referencia dos posiciones del menú sin copiarlas.

```json
{
  "autor": "huesped",
  "sobre": "4598f23e1341e47b99f2a22131f75880e5c5ec18d72ae46c0b49c1d4da1bac91",
  "en": "0000000000",
  "t": "2026-11-07T13:30:00Z",
  "movimientos": [
    { "token": "T", "escala": "hora", "cantidad": 1, "de": "huesped", "a": null },
    { "token": "E", "emisor": "casa", "denominacion": "EUR", "cantidad": 12, "de": "huesped", "a": "cocina" }
  ],
  "payload": [
    "Compra del menú del día",
    [ { "ref": "4598f23e1341e47b99f2a22131f75880e5c5ec18d72ae46c0b49c1d4da1bac91", "dir": "1000000000" }, 1, "EUR 12" ],
    [ { "ref": "4598f23e1341e47b99f2a22131f75880e5c5ec18d72ae46c0b49c1d4da1bac91", "dir": "2000000000" } ],
    [ "huesped", "cocina" ],
    [ "pagar", "servir" ]
  ],
  "contexto": {},
  "id": "f9e59d1ec7eb227d0faf3b22708cbf8e99c83443d406570e7c72b8766a2b7497"
}
```

Leído bajo la época 0 (§4.3): posición 0 representación, 1 recursos (qué, cuánto, a qué precio), 2 criterios, 3 comunicación, 4 fábrica.

## 2. Movimientos de tokens (E/P/R/T)

### 2.1 Familias y series: la constante

Toda familia de tokens es una **serie** (VG, 7-11-2026: «las series de tokens son una constante y se estandarizan»). La serie es limitada y la emite quien la respalda. Cada movimiento nombra su serie con los campos de `SERIE`, y la clave de saldo es `familia:campos` (unidos por `/`). En una línea por familia: familia, clave de serie, quién la emite.

| Familia | Nombre | Campos de serie | Clave de saldo | Quién la emite |
|---|---|---|---|---|
| `T` | tiempo | `escala` | `'T:<escala>'` | el génesis |
| `E` | recursos | `emisor`, `denominacion` | `'E:<emisor>/<denominacion>'` | su emisor, persona o grupo; la denominación va ligada al emisor como en R (§2.4) |
| `P` | poder / criterio | `ambito` | `'P:<ambito>'` | el génesis (`'P:genesis'`, todo el eje); a los demás les llega por delegación (§2.5) |
| `R` | reputación | `emisor` | `'R:<emisor>'` | su emisor, persona o grupo: la declara y solo él la amplía (§2.4) |

`ESCALAS_T = ['segundo', 'minuto', 'hora', 'dia', 'semana', 'ciclo', 'anio']`: siete tokens distintos, ampliable hasta `MAXIMO_ESCALAS_T = 10` (`tokens.js` no carga si se pasa del tope). **Sin conversión entre escalas**: una hora no son sesenta minutos; `T:hora` y `T:minuto` son saldos distintos, como `E:casa/EUR` y `E:casa/BTC`. T va en **enteros**: cada escala es un token, y media hora serían minutos. `SEGUNDOS` (segundo 1, minuto 60, hora 3600, dia 86400, semana 7·86400, ciclo 28·86400, anio (13·28+1)·86400 = 365 días) es la duración de cada escala para medir distancias de tiempo (las bandas de `src/tiempo.js`); no convierte saldos.

[D] (VG, 7-11, mapa §12): E con la denominación ligada al emisor como en R; R declarada por su emisor, ampliable solo por él y con rastro visible; P por delegación desde un registro de dominio; emitir es de personas y grupos, y las cosas son titulares que no emiten. Todo implementado (§2.4, §2.5, §7.1).

[X] decidir VG: si una identidad puede emitir su propio tiempo como serie limitada (T fuera del génesis: «no tocar hasta que lo diga»); qué escalas completan las diez de T; si E, P y R admiten fracciones (hoy sí, en coma flotante, que acumula error; T ya va en enteros).

### 2.2 Forma de un movimiento

```js
{ token: 'T', escala: 'minuto', cantidad: 2, de: 'cocina', a: null }                          // T: consumo de 2 minutos (T:minuto)
{ token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 12, de: 'huesped', a: 'cocina' }  // E: pago con EUR de la casa (E:casa/EUR)
{ token: 'P', cantidad: 2, ambito: '<id>', de: 'casa', a: 'cocina' }                          // P: delegar poder sobre un subárbol
{ token: 'R', cantidad: 3, emisor: 'casa', de: 'casa', a: 'cocina' }                          // R: la casa da reputación suya
{ token: 'E', emisor: 'casa', denominacion: 'cama@2026-11-13', cantidad: 2, de: null, a: 'casa' } // emisión de una serie de E (§2.4)
{ token: 'R', cantidad: 10, emisor: 'casa', de: null, a: 'casa' }                             // emisión de R: la casa amplía la suya (§2.4)
```

| Campo | Regla |
|---|---|
| `token` | uno de `FAMILIAS = ['E', 'P', 'R', 'T']` |
| `cantidad` | número finito > 0; en T, entero (cada escala es un token) |
| `escala` | obligatoria y válida si `token === 'T'`; prohibida en E/P/R |
| `denominacion` | obligatoria en E; prohibida en T/P/R |
| `ambito` | obligatorio en P (no hay P total); prohibido en el resto |
| `emisor` | obligatorio en E (la serie es suya; sin `/`) y en R (solo él la mueve); prohibido en T/P |
| `de` | identidad (cadena) o `null`. `null` = **emisión** (§2.3, §2.4); en E y R, `a` debe ser el propio emisor. |
| `a` | identidad o `null`. `null` = **consumo**. |
| `de` y `a` | ambos presentes; no pueden ser `null` los dos |

```js
SERIE                 // { T: ['escala'], E: ['emisor', 'denominacion'], P: ['ambito'], R: ['emisor'] }
TIPOS, EMITEN         // ['persona', 'grupo', 'cosa'], ['persona', 'grupo']: quién puede emitir
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
{"T":["escala"],"E":["emisor","denominacion"],"P":["ambito"],"R":["emisor"]} 7 10 365
{"token":"E","serie":"casa/cama@2026-11-13","emisor":"casa","denominacion":"cama@2026-11-13"}
["cantidad debe ser > 0","escala T inválida: mes","de y a son obligatorios (null permitido)","a debe ser identidad o null"]
["escala solo en T","E exige denominación","E exige emisor: la serie es de quien la emite","movimiento sin origen ni destino"]
["la emisión de E va a su propio emisor"]
["T va en enteros: cada escala es un token"]
```

### 2.3 Reglas del eje sobre los movimientos

Las aplica `eje.validar` (§7.4): nadie mueve tokens ajenos (`de` debe ser el autor), y el saldo del autor debe cubrir la suma de lo que mueve **por clave de saldo** (minutos con minutos, horas con horas). El evento mínimo mueve T del autor, en cualquier escala: el coste de escribir es tiempo (`escribirDesde` cobra un minuto por posición, así que escribir exige `T:minuto`). Emitir (`de === null`): el génesis emite cualquier familia a su autor; después, E y R los emite su emisor, a sí mismo, si es persona o grupo (§2.4); T y P, solo el génesis. La simulación aplica los movimientos **en orden** sobre una vista de los saldos (débitos y abonos), así que lo emitido en un evento puede darse en ese mismo evento.

### 2.4 Emisión de series de E y de R

Emitir (iniciar una serie o ampliarla) es lo único reservado a **personas y grupos** (VG, 7-11): el tipo se declara en el alta (`contexto.tipos`, §7.1). Una **cosa** (una habitación, una plaza) es titular: recibe, conserva y mueve tokens y firma con su clave, pero no emite. Quien no declaró tipo tampoco emite.

- **E**: una persona o un grupo emite una **serie limitada** de una denominación que respalda (la casa emite un token por plaza y noche). La serie es **suya**, como en R: la clave lleva al emisor (`E:casa/cama@2026-11-13`). Por eso nadie se queda un nombre ni emite la denominación de otro: la misma denominación emitida por otro es otra serie (`E:bea/cama@2026-11-13`), y los EUR de la casa no son los de nadie más. Dentro de su serie, E es fungible: la mueve quien la tiene.
- **R**: su emisor la declara y solo él la amplía (`R:<emisor>`); cada ampliación es un evento suyo en el eje, y ese es el rastro visible. Sigue sin ser fungible (§2.2).

La emisión es un movimiento con `de: null`, `emisor` igual al autor del evento y `a` igual al emisor: la serie nace en la cartera de quien la emite. Para darla (las plazas a la habitación, la reputación a cocina) se mueve después, en el mismo evento si quiere. La serie es limitada porque solo crece cuando su emisor emite; mover más de lo que hay se rechaza por saldo, y lo emitido de una serie no puede llegar a infinito. Las series de E y R del génesis quedan a nombre de su autor (`Eje.genesis` completa `emisor`). T y P no se emiten fuera del génesis.

```js
eje.tipo(identidad)   // → 'persona' | 'grupo' | 'cosa' | null (sin tipo declarado)
eje.serie(clave)      // → { emisor, emitido } de la serie con esa clave de saldo ({ emisor: null, emitido: 0 } si nadie la ha emitido)
eje.series()          // → [{ clave, token, serie, ...campos, emisor, emitido }] todas las series emitidas (las cuatro familias), por orden de emisión
```

```sh
node --input-type=module -e "
import { Eje } from './src/eje.js';
const t = '2026-11-07T09:00:00Z';
const gasta = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });
const da = (a, cantidad) => ({ token: 'T', escala: 'minuto', cantidad, de: 'casa', a });
const emite = (emisor, denominacion, cantidad) => ({ token: 'E', emisor, denominacion, cantidad, de: null, a: emisor });
const cama = (cantidad, de, a) => ({ token: 'E', emisor: 'casa', denominacion: 'cama@2026-11-13', cantidad, de, a });
const eje = await Eje.genesis({ identidad: 'casa', tipo: 'grupo', emision: [{ token: 'T', escala: 'minuto', cantidad: 60 }, { token: 'E', denominacion: 'EUR', cantidad: 500 }], foco: 'Casa', t });
const alta = await eje.escribir({ autor: 'casa', sobre: eje.genesisId, t, movimientos: [gasta('casa'), da('bea', 5), da('hab-2', 5)], payload: 'altas', contexto: { tipos: { bea: 'persona', 'hab-2': 'cosa' } } });
const plazas = await eje.escribir({ autor: 'casa', sobre: alta.id, t, movimientos: [gasta('casa'), emite('casa', 'cama@2026-11-13', 2), cama(2, 'casa', 'hab-2')], payload: 'dos camas el 13-11, para la habitación 2' });
console.log(JSON.stringify(eje.serie('E:casa/cama@2026-11-13')), JSON.stringify(eje.recursos('hab-2')), eje.tipo('hab-2'));
await eje.escribir({ autor: 'bea', sobre: plazas.id, t, movimientos: [gasta('bea'), emite('bea', 'cama@2026-11-13', 1)], payload: 'la mía' });
console.log(JSON.stringify(eje.serie('E:bea/cama@2026-11-13')), JSON.stringify(eje.serie('E:casa/cama@2026-11-13')));
await eje.escribir({ autor: 'bea', sobre: plazas.id, t, movimientos: [gasta('bea'), emite('casa', 'cama@2026-11-14', 1)], payload: 'x' }).catch((e) => console.log(e.message));
await eje.escribir({ autor: 'hab-2', sobre: plazas.id, t, movimientos: [gasta('hab-2'), emite('hab-2', 'cama@2026-11-13', 1)], payload: 'x' }).catch((e) => console.log(e.message));
await eje.escribir({ autor: 'hab-2', sobre: plazas.id, t, movimientos: [gasta('hab-2'), cama(3, 'hab-2', 'bea')], payload: 'x' }).catch((e) => console.log(e.message));
await eje.escribir({ autor: 'hab-2', sobre: plazas.id, t, movimientos: [gasta('hab-2'), cama(1, 'hab-2', 'bea')], payload: 'reserva de bea' });
await eje.escribir({ autor: 'casa', sobre: plazas.id, t, movimientos: [gasta('casa'), { token: 'R', cantidad: 10, emisor: 'casa', de: null, a: 'casa' }, { token: 'R', cantidad: 2, emisor: 'casa', de: 'casa', a: 'bea' }], payload: 'reputación de la casa' });
await eje.escribir({ autor: 'casa', sobre: plazas.id, t, movimientos: [gasta('casa'), { token: 'T', escala: 'hora', cantidad: 1, de: null, a: 'casa' }], payload: 'x' }).catch((e) => console.log(e.message));
console.log(eje.saldo('bea', 'E:casa/cama@2026-11-13'), JSON.stringify(eje.reputaciones('bea')));
console.log(eje.series().map((x) => x.clave + ' ' + x.emitido).join(' · '));
"
```

```text
{"emisor":"casa","emitido":2} [{"emisor":"casa","denominacion":"cama@2026-11-13","cantidad":2}] cosa
{"emisor":"bea","emitido":1} {"emisor":"casa","emitido":2}
evento rechazado: nadie emite en nombre de otro: casa no es el autor
evento rechazado: solo personas y grupos emiten: hab-2 es cosa
evento rechazado: saldo insuficiente de E:casa/cama@2026-11-13 en hab-2
evento rechazado: solo el génesis emite T
1 [{"emisor":"casa","cantidad":2}]
T:minuto 60 · E:casa/EUR 500 · E:casa/cama@2026-11-13 2 · E:bea/cama@2026-11-13 1 · R:casa 10
```

### 2.5 P por delegación

VG (7-11): la casa escribe un registro de dominio («Alojamiento») y delega P con ese ámbito; recepción autoriza lo que cuelga de ahí y puede delegar hacia abajo. Así funciona ya: P solo se emite en el génesis (`P:genesis`, todo el eje), y delegar es mover P con un ámbito más estrecho (un registro), que se debita del ámbito exacto y, si no alcanza, de los que lo cubren (los registros de su hilo y `genesis`). `eje.poderSobre(identidad, registro)` suma el P cuyo ámbito es `genesis` o un registro del hilo de ese registro; es lo que mira el motor para autorizar. Prueba: `test/eprt.test.js` («P por delegación desde un registro de dominio»).

```js
eje.poderes(identidad)              // → [{ ambito, cantidad }]   no hay P total
eje.poderSobre(identidad, registro) // → número: P con ámbito 'genesis' o un registro del hilo de `registro`
eje.ambitosQueCubren(ambito)        // → [ambito, …registros de su hilo, 'genesis']
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
- `ref` debe ser el **id completo**. Los prefijos (`'f9e59d1e'`) solo los resuelven BQL (`REF("f9e59d1e")`) y la entrada de texto de `escritura.item` (`'@f9e59d1e:1200000000'`), que los convierten en id completo antes de guardar.
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

La época es una convención paralela, **fuera del dato**: BTML no lleva época dentro y cualquier dirección se lee desde cualquier época. Las épocas viven como datos en `datos/epocas/*.json` (copia generada en `datos/epocas/epocas.js`). La decidida es `EPOCA_0`, cuya regla corta vale en todas las profundidades: **cada dígito es un punto de vista**.

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
leerDireccion(dir, epoca = EPOCA_0)      // → [{ profundidad, digito, significado }] una entrada por índice real; epoca puede ser un nombre ('época 1')
EPOCAS                                   // { 'época 0': EPOCA_0, 'época 1': EPOCA_1 }
cargarEpoca(datos, { respaldo })         // → época desde { nombre, estado, principios, ordinales?, reglas, dudas }
epoca.ordinal(profundidad)               // → true donde el dígito es orden (gancho del encaje); ninguna en las épocas 0 y 1
pointed.decupla(ev, epoca = EPOCA_0, profundidad = 0)  // → { id, autor, t, sobre, en, posiciones: [{ indice, significado, contenido }] × 10 }
```

`EPOCA_1` es una **propuesta** de las cien reglas cortas (el mismo PV, con el grano de cada profundidad nombrado), pendiente de VG: ver `docs/REGLAS_CORTAS.md`. Pendiente: la decisión sobre la época 1 y las reglas largas.

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
[{"ref":"4598f23e1341e47b99f2a22131f75880e5c5ec18d72ae46c0b49c1d4da1bac91","dir":"1000000000"},1,"EUR 12"]
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
c70bfa6e@1000000000 b9f0ee17@7000000000
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

En `f9e59d1e`, la dirección `1000000000` tiene cuatro ocupantes una vez escrita la cuenta: la posición 1 (array), la 1.0 (la referencia al menú), lo que alcanza esa referencia (el menú:1) y la cuenta de cocina, anclada en `1000000000`.

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
propio [1] f9e59d1e 1000000000 [0,0,0,0,0,0,0,0,0,0] exacto 10 ["f9e59d1e:1000000000#1"]
propio [1,0] f9e59d1e 1000000000 [0,0,0,0,0,0,0,0,0,0] exacto 10 ["f9e59d1e:1000000000#1.0"]
referencia [1] 4598f23e 1000000000 [0,0,0,0,0,0,0,0,0,0] exacto 10 ["f9e59d1e:1000000000#1.0","4598f23e:1000000000"]
escrito [] c70bfa6e 1000000000 [0,0,0,0,0,0,0,0,0,0] exacto 10 ["c70bfa6e:0000000000"]
4 1 0
["ensalada","guiso","fruta"] "Cuenta del menú"
```

Un ocupante completo, tal como lo devuelve `ocupantes` (el tercero, la referencia seguida):

```json
{
  "tipo": "referencia",
  "origen": "referencia",
  "evento": "4598f23e1341e47b99f2a22131f75880e5c5ec18d72ae46c0b49c1d4da1bac91",
  "dir": "1000000000",
  "camino": [1],
  "contenido": ["ensalada", "guiso", "fruta"],
  "procedencia": [
    "f9e59d1ec7eb227d0faf3b22708cbf8e99c83443d406570e7c72b8766a2b7497:1000000000#1.0",
    "4598f23e1341e47b99f2a22131f75880e5c5ec18d72ae46c0b49c1d4da1bac91:1000000000"
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
4598f23e 1000000000 [1] ["ensalada","guiso","fruta"] undefined ["4598f23e"]
true undefined []
```

### 6.5 Vector, distancia y orden

Para cada ocupante se compara la dirección de donde viene (`origenDir`) con la dirección donde se coloca (`destino`):

```js
vector(candidato, buscado)  // → [d0 … d9]  candidato − buscado, dígito a dígito, con signo (−9…9 por componente)
distancia(v)                // → [|d0| … |d9|]  siempre positiva; información (solo ordena donde la época haga ordinal la profundidad)
acuerdo(v)                  // → número de ceros seguidos desde la profundidad 0 (10 = encaje exacto)
signo(v)                    // → 'exacto' | 'completar' (solo negativos) | 'reducir' (solo positivos) | 'mixto'
faltas(v)                   // → cuántas componentes < 0 (al candidato le falta: completar)
excedentes(v)               // → cuántas componentes > 0 (al candidato le sobra: reducir)
norma(v)                    // → suma de |d|; medida de consulta (BQL DESPLAZAMIENTO()), no criterio de orden
ordenarPorEncaje(lista, { epoca } = {})  // → nueva lista ordenada por `.vector`, sin quitar nada
```

Orden por encaje (`ordenarPorEncaje`, el orden por defecto de `ocupantes` y de BQL `BUSCAR`):

1. más coincidencias de ruta primero (profundidades de acuerdo; los exactos, con acuerdo 10, van delante);
2. después, solo en las profundidades que la época declare ordinales (`epoca.ordinal(profundidad)`), menor distancia; en la época 0 los dígitos son nominales y ninguna lo es;
3. los empates conservan el orden de llegada.

El signo **no ordena** (VG, 7-11: opción B de `docs/notas/SIGNO_DEL_VECTOR.md`): es informativo por componente (positivo = al candidato le sobra, negativo = le falta) y `signo(v)` resume el vector entero. Un escrito anclado en la dirección buscada encaja exacto. Pendiente: cómo cambia el vector con la época.

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
[0,0,3,0,0,0,0,0,0,0] [0,0,3,0,0,0,0,0,0,0] 2 reducir 0 1 3
[-4,0,0,0,0,0,0,0,0,0] completar
[-1,4,0,0,0,0,0,0,0,0] mixto
exacto | desvio hondo | ref desde 7 | escrito en 2 | otro escrito
```

Dónde se ve la diferencia entre llegada y encaje: un registro cuya posición 2 es una referencia a la posición 7 de otro (viene de lejos: le sobra en la profundidad 0) y un hijo escrito en su posición 2 (anclado en la dirección buscada: exacto).

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

Una identidad es una cadena (`'casa'`, `'cocina'`, `'huesped'`). **Existe cuando ha recibido tokens**: la primera por el génesis, las demás porque un evento les mueve tokens (`a: 'cocina'`). No hay registro de identidades aparte de los saldos. Las identidades son personas, grupos de personas (la casa) o cosas (una habitación); quien da de alta lo declara.

**Tipo.** Se declara en `contexto.tipos[identidad]` (`'persona'`, `'grupo'` o `'cosa'`) **del mismo evento en que esa identidad recibe tokens por primera vez**, igual que la clave (§7.2); el génesis declara el de su autor con `tipo`. Un tipo para una identidad que ya existe o que no recibe tokens en ese evento se rechaza, y no cambia. El tipo solo decide quién emite (VG, 7-11): las cosas son titulares (reciben, conservan y mueven tokens, firman con su clave) pero no emiten (§2.4). Quien no declaró tipo no emite fuera del génesis.

```js
eje.identidades()              // → string[] en orden de primera recepción
eje.saldo(identidad, clave)    // → número; clave de saldo ('T:minuto', 'E:casa/EUR', 'P:genesis', 'R:casa', …); 0 si no existe
eje.saldoT(identidad, escala)  // → saldo(identidad, 'T:' + escala), sin conversión; lanza si la escala no existe
eje.tiempos(identidad)         // → [{ escala, cantidad }] en el orden de ESCALAS_T, solo saldos > 0
eje.recursos(identidad)        // → [{ emisor, denominacion, cantidad }]
eje.tipo(identidad)            // → 'persona' | 'grupo' | 'cosa' | null
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
| `no se puede cambiar la clave de <id>` / `clave declarada para <id> sin darle tokens` / `clave inválida para <id>` | `contexto.claves` mal usado |
| `no se puede cambiar el tipo de <id>` / `tipo declarado para <id> sin darle tokens` / `tipo inválido para <id>: <tipo>` | `contexto.tipos` mal usado |
| `solo el génesis emite <T o P>` | un movimiento con `de === null` de T o P fuera del génesis |
| `nadie emite en nombre de otro: <emisor> no es el autor` | emisión de E o R cuyo `emisor` no es el autor |
| `solo personas y grupos emiten: <autor> es cosa` / `… no declaró tipo en su alta` | emisión de E o R por una cosa o por quien no declaró tipo |
| `la serie <clave> no admite tanto` | lo emitido de la serie dejaría de ser un número finito |
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
evento rechazado: solo el génesis emite T
evento rechazado: nadie emite en nombre de otro: bea no es el autor
evento rechazado: solo personas y grupos emiten: raiz no declaró tipo en su alta
evento rechazado: saldo insuficiente de T:minuto en raiz
evento rechazado: saldo insuficiente de T:hora en raiz
evento mal formado: en debe ser una dirección de diez dígitos
evento mal formado: payload 1: hueco
evento mal formado: el génesis debe emitir T al autor
```

## 8. Génesis

El génesis es el primer evento del eje. Se escribe **por convención, fuera del sistema**: emite libremente (`de: null`) series de las cuatro familias a su autor (después, E y R los emite su emisor si es persona o grupo, §2.4), es el único sin foco (`sobre: null`) y lleva `contexto.genesis: true`. Fija el foco raíz (su `payload`) y la primera identidad, y puede declarar su tipo. A partir de él, todo se genera dentro.

```js
Eje.genesis({ identidad, emision, foco, t = ahora, contexto = {}, clave, privada, tipo, exigirFirmas = false })  // → Promise<Eje>
//   identidad: primera identidad; emision: [{ token, cantidad, escala | denominacion | ambito | emisor }] (se completa con de: null, a: identidad; en E y R, emisor: identidad)
//   tipo: 'persona' | 'grupo' (contexto.tipos); sin tipo, su autor no emite fuera del génesis
//   lanza si una serie de E o R del génesis lleva otro emisor, si el génesis declara el tipo de otra identidad o si su autor es una cosa
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
console.log(JSON.stringify(eje.identidades()), eje.saldoT('raiz', 'minuto'), eje.saldoT('raiz', 'hora'), eje.saldoT('bea', 'hora'), eje.saldo('raiz', 'E:raiz/EUR'), JSON.stringify(eje.serie('E:raiz/EUR')));
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
  "contexto": { "genesis": true, "tipos": { "casa": "grupo" } },
  "id": "6c1c59685fe87c600e9b66f3a34fbdfb45649f1d7399d958c411a0ba129f52ff"
}
```

### 8.1 Guardar y reconstruir

El eje se guarda como **la lista de sus eventos en orden**; nada más. Al restaurar se vuelve a validar todo (ids, firmas, saldos). El árbol lógico, los saldos, las claves, los tipos y las series se reconstruyen.

La versión 2 (7-11) llega con las series de tokens (T por escala, E ligada a su emisor, tipos en el alta): un eje guardado con la versión 1 no se restaura. La app, en vez de pisarlo en silencio, lo aparta en `agram.eje.anterior` y avisa antes de empezar con el ejemplo.

```js
serializar(eje)    // → { version: 2, exigirFirmas, eventos: evento[] }
restaurar(datos)   // → Promise<Eje>; lanza 'eje de la versión 1; esta es la 2' con un guardado antiguo, o si algún evento no cuadra
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
2 false 5 6c1c5968 ccf5a120 4598f23e f9e59d1e c70bfa6e
12 ["casa","cocina","huesped"] 5
evento rechazado: id no corresponde al cuerpo
```

Pendiente: persistencia en base de datos y anclaje a una cadena. La forma de los eventos no cambia con eso.

## 9. El eje de ejemplo

`ejemplos/ikisai/compra-food.mjs` construye cinco eventos con datos inventados. `ejemploCompra({ claves })` devuelve `{ eje, alta, menu, compra }`; `ejemploCuenta(eje, compra, privadaCocina)` añade la cuenta. Con claves, los ids cambian (las claves van en el cuerpo) y cada identidad firma.

| Evento | id | autor | sobre | en | payload |
|---|---|---|---|---|---|
| génesis | `6c1c5968…` | casa | — | `0000000000` | `"Casa de ejemplo"` |
| alta | `ccf5a120…` | casa | génesis | `0000000000` | `["Altas del fin de semana", ["cocina", "huesped"]]` |
| menú | `4598f23e…` | cocina | alta | `0000000000` | `["Menú del día", ["ensalada", "guiso", "fruta"], ["sin gluten", "vegetariano"]]` |
| compra | `f9e59d1e…` | huesped | menú | `0000000000` | `["Compra del menú del día", [{ref: menú, dir: "1000000000"}, 1, "EUR 12"], [{ref: menú, dir: "2000000000"}], ["huesped", "cocina"], ["pagar", "servir"]]` |
| cuenta | `c70bfa6e…` | cocina | compra | `1000000000` | `["Cuenta del menú", "=REF(\"f9e59d1e\", \"1200000000\") + 2 EUR", "=LOCAL(1) + 15 min", "==no es fórmula"]` |

Series: la casa (un grupo: `tipo: 'grupo'` en el génesis) emite 1000 `T:hora`, 1000 `T:minuto`, 500 `E:casa/EUR` (la serie es suya: la clave lleva al emisor) y 10 `P:genesis`; las altas reparten horas y minutos, que son tokens distintos, y declaran el tipo de cocina (grupo) y huesped (persona). Saldos tras los cinco eventos: casa 936 h y 279 min de T (1000 − 40 − 24; 1000 − 1 − 240 − 480), 440 EUR, 10 P; cocina 38 h y 237 min (40 − 2; 240 − 3), 12 EUR; huesped 23 h y 480 min (24 − 1), 48 EUR.

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
export const SERIE = { T: ['escala'], E: ['emisor', 'denominacion'], P: ['ambito'], R: ['emisor'] };
export const ESCALAS_T = ['segundo', 'minuto', 'hora', 'dia', 'semana', 'ciclo', 'anio'];
export const MAXIMO_ESCALAS_T = 10;                       // tokens.js lanza al cargar si ESCALAS_T lo supera
export const TIPOS = ['persona', 'grupo', 'cosa'];
export const EMITEN = ['persona', 'grupo'];
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
  static async genesis({ identidad, emision, foco, t, contexto, clave, privada, tipo, exigirFirmas }): Promise<Eje>;
  static async desde(eventos, { exigirFirmas = false } = {}): Promise<Eje>;
  eventos: Map<id, Evento>; orden: id[]; saldos: Map<identidad, Map<clave, number>>; claves: Map<identidad, JWK>; exigirFirmas: boolean;   // series y tipos son privados: se leen con serie(), series(), tipo()
  get genesisId(): string;
  obtener(id): Evento | undefined;
  identidades(): string[];
  saldo(identidad, clave): number;
  saldoT(identidad, escala): number;                       // saldo de 'T:' + escala
  tiempos(identidad): { escala, cantidad }[];
  recursos(identidad): { emisor, denominacion, cantidad }[];
  poderes(identidad): { ambito, cantidad }[];
  reputaciones(identidad): { emisor, cantidad }[];
  poderSobre(identidad, registro): number;
  serie(clave): { emisor, emitido };                     // por clave de saldo: 'E:casa/EUR', 'R:casa', 'T:hora', 'P:genesis'
  series(): { clave, token, serie, ...campos, emisor, emitido }[];
  clave(identidad): JWK | undefined;
  tipo(identidad): 'persona' | 'grupo' | 'cosa' | null;
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
export const TODAS = 'todas';
export function cargarEpoca(datos, { respaldo }?): Epoca;
// Epoca: { nombre, estado, principios, dudas, reglas[100], regla(p, d), reglaCorta(p, d), ordinal(p) }
export const EPOCA_0: Epoca;  // decidida: dígito = PV en todas las profundidades
export const EPOCA_1: Epoca;  // propuesta, pendiente de VG
export const EPOCAS: { [nombre]: Epoca };
export function epocaDe(epoca = EPOCA_0): Epoca;  // por objeto o por nombre
export function leerDireccion(dir, epoca = EPOCA_0): { profundidad, digito, significado }[];

// src/persistencia.js
export const VERSION = 2;
export function serializar(eje): { version, exigirFirmas, eventos };
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
| Comprobar al escribir que una referencia apunta a un evento existente | §3.3: se detecta al seguirla (`rota`) |
| Cero de orientación y reglas por dimensión para el signo del vector | §4.2, §6.5 |
| Nombrar un índice 0 real al final del camino | §4.2: se trata como colisión |
| Posición 0 de un terminal (encaje no la da; Pointed sí) | §4.2 |
| Cambio de foco al agotar diez niveles | §3.2 |
| Decisión de VG sobre la época 1 propuesta; reglas largas; profundidades ordinales (cómo cambia el vector con la época) | §4.3, §6.5, `docs/REGLAS_CORTAS.md` |
| Prueba de posesión de la clave al dar de alta | §7.2 |
| Emisión de T fuera del génesis (el tiempo de alguien como serie propia); escalas de T octava a décima; fracciones en E, P y R ([X] decidir VG) | §2.1, §2.4 |
| Cómo firma un grupo (hoy, una clave guardada por sus representantes; es de AARPIA) | §7.1 |
| Anidar hileras o décuplas en una posición concreta por decisión | §5 |
| Persistencia en base de datos y anclaje a una cadena | §8.1 |
| Comprobación de `t` contra un reloj o contra el orden del eje | §1.1: solo `Date.parse` |
