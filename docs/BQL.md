# BQL V0 — referencia para programar

BQL es la lógica de vistas de AGRAM: fórmulas que viven dentro de un slot BTML y se evalúan sin efectos. Este documento describe **lo que existe hoy en `src/bql.js`**, con firmas, tablas y ejemplos ejecutados con Node 24 desde la raíz del repositorio. Lo que no existe se marca «pendiente»; lo que falta decidir, «[X] decidir VG». Fuente de verdad: `src/bql.js`, `test/bql.test.js`, `test/bql-colecciones.test.js`, `test/vector.test.js`, `test/bases-bql.test.js` (`CAJA` y `FRESCURA`) y `test/conformidad-bql.test.js` (una prueba por regla del corpus, con su id S-/O-/E-).

Vocabulario mínimo: un **evento** tiene un `payload` BTML (terminal, o array de 1 a 10 posiciones sin huecos; las posiciones contienen terminales, subarrays o referencias `{ ref, dir? }`). Una **dirección** es una cadena de diez dígitos (`'1200000000'` = índices `[1, 2]`; los ceros finales no cuentan). La **décupla** es el array desarrollado en sus posiciones 0–9. El **eje** (`src/eje.js`) guarda los eventos; `eje.obtener(id)`, `eje.orden`, `eje.sobre(id, dir)`.

---

## 1. Módulo y firmas

```js
import { esFormula, desescapar, analizar, evaluar, consultar, formato, ESTADOS, SUBTIPOS_PENDIENTE, LIMITES, esPendiente } from './src/bql.js';
```

| Export | Firma | Qué hace |
|---|---|---|
| `esFormula(x)` | `(any) → boolean` | `true` si `x` es una cadena que empieza por un solo `=`. |
| `desescapar(x)` | `(any) → any` | Si `x` es cadena y empieza por `==`, quita **un** `=`. Si no, devuelve `x`. |
| `analizar(src, { profundidad }?)` | `(string, object?) → Nodo` | Analiza una fórmula **sin** el `=` inicial y devuelve el árbol (§4.3). Lanza `SyntaxError`; si la anidación pasa de `profundidad` (por defecto `LIMITES.profundidad`), lanza un `Error` con `estado: 'PENDIENTE POR LÍMITE'`. |
| `evaluar(eje, evId, dir, opciones?)` | `(Eje, string, string\|number[], Opciones?) → Resultado` | Evalúa el slot `dir` del evento `evId`. Si el slot no es fórmula, devuelve su valor tal cual (§3). |
| `consultar(eje, evId, dir, formula, opciones?)` | `(Eje, string, string\|number[], string, Opciones?) → Resultado` | Evalúa una fórmula suelta (con o sin `=` inicial) como si estuviera en el slot `dir` de `evId`. |
| `formato(valor)` | `(Valor) → string` | Texto de un valor BQL (§5). |
| `ESTADOS` | `['RESUELTO', 'PENDIENTE', 'INCOMPATIBLE', 'ERROR']` | Los cuatro estados de cálculo del corpus. Lista congelada. |
| `SUBTIPOS_PENDIENTE` | `['PENDIENTE DE AUTORIZACIÓN', 'PENDIENTE POR LÍMITE']` | Los dos subtipos de PENDIENTE del mapa §2.3: esperas explicadas, no fallos. Lista congelada. |
| `esPendiente(estado)` | `(string) → boolean` | `true` para `'PENDIENTE'` y sus dos subtipos. |
| `LIMITES` | `{ presupuesto: 2000, profundidad: 100, candidatos: 1000 }` | Límites de cálculo por defecto (§9.3). Valores V0: [X] decidir VG. |

**Opciones** (las dos son optativas; sin opciones, todo se lee y rigen `LIMITES`):

| Campo | Tipo | Qué hace |
|---|---|---|
| `puedeLeer(evId, dir, indices)` | `(string, string, number[]) → boolean` | Gancho de autorización: se le pregunta por cada lectura, por cada ocupante de `BUSCAR` y por cada salto de una cadena de referencias (id del evento, dirección de diez dígitos y camino exacto de índices, que distingue la raíz `[]` de la posición `[0]`). `false` → PENDIENTE DE AUTORIZACIÓN (§9.6). El modelo de permisos no es de BQL: es de AARPIA (mapa §12). |
| `limites` | `{ presupuesto?, profundidad?, candidatos? }` | Sustituye los valores de `LIMITES` que se pasen. |

`dir` admite dos formas: una dirección de diez dígitos (`'1200000000'`) o un array de índices (`[1, 2]`). La dirección se convierte con `indicesDe`, que quita los ceros finales: `'0000000000'` es la raíz (`[]`) y `'1000000000'` es `[1]`. Límite conocido: una dirección en texto no puede nombrar un índice 0 real al final del camino; para la posición 0 se usa el array (`[0]`, `[1, 0]`).

**Resultado** (siempre un objeto, nunca una excepción):

| Campo | Tipo | Presente | Contenido |
|---|---|---|---|
| `estado` | `string` | siempre | `'RESUELTO'`, `'PENDIENTE'`, `'INCOMPATIBLE'`, `'ERROR'`, o un subtipo de PENDIENTE: `'PENDIENTE DE AUTORIZACIÓN'`, `'PENDIENTE POR LÍMITE'`. |
| `valor` | `Valor` | solo RESUELTO | El valor BQL (§5). |
| `motivo` | `string` | solo no RESUELTO | Mensaje exacto (§8). |
| `parcial` | `{ examinados, de }` | solo PENDIENTE POR LÍMITE, cuando se sabe | Cuántos candidatos se examinaron de cuántos (§9.3). |
| `texto` | `string` | siempre | `formato(valor)` si RESUELTO; si no, `estado + ': ' + motivo`. |
| `dependencias` | `string[]` | siempre | Slots leídos, como `'<id>:<dirección de diez dígitos>'` (§9.5). Parcial si hubo parada; `[]` si fue `SyntaxError`. |

Comprobación mínima (una línea, desde la raíz; en bash y en PowerShell con comillas simples exteriores):

```sh
node --input-type=module -e 'import { Eje } from "./src/eje.js"; import { consultar } from "./src/bql.js"; const eje = await Eje.genesis({ identidad: "casa", emision: [{ token: "T", escala: "hora", cantidad: 1 }], foco: ["x", "12 EUR"], t: "2026-11-07T15:00:00Z" }); console.log(consultar(eje, eje.genesisId, [1], `LOCAL(1) + 3 EUR`).texto); console.log(consultar(eje, eje.genesisId, [1], `CONTAR(FILTRAR(BUSCAR(1), ORIGEN() = "propio"))`).texto);'
```

Salida:

```
15 EUR (12 EUR + 3 EUR)
1
```

---

## 2. Convención `=` y `==`

No hay árbol BQL aparte: una fórmula es **una cadena en un slot** que empieza por `=`. La posición del slot da el significado (en la 2 es un criterio, en la 4 una actuación…); BQL no lo interpreta, solo evalúa.

| Contenido del slot | `esFormula` | Qué es | Valor leído |
|---|---|---|---|
| `'=1 + 1'` | `true` | fórmula `1 + 1` | numero 2 |
| `'= 1 = 1'` | `true` | fórmula ` 1 = 1` (comparación) | booleano verdadero |
| `'==hola'` | `false` | texto escapado | texto `=hola` |
| `'===x'` | `false` | texto escapado | texto `==x` (solo se quita un `=`) |
| `' =1'` | `false` | texto (el `=` no va al principio) | texto ` =1` |
| `'hola'` | `false` | texto | texto `hola` |
| `12` (número JS) | `false` | número | numero 12 |

`consultar` acepta la fórmula con o sin `=` inicial (`'=1+1'` y `'1+1'` dan lo mismo); quita como mucho un `=`.

---

## 3. Lectura de un slot: contenido crudo → valor BQL

Regla de conversión (`valorDe`), aplicada a todo slot que **no** sea fórmula:

| Contenido crudo | Valor BQL | `texto` |
|---|---|---|
| `undefined` (posición no desarrollada, o camino que atraviesa un terminal) | parada **PENDIENTE** `posición sin desarrollar` | — |
| número JS | `numero` | `'12'` |
| array | `array` | `'[3 posiciones]'` |
| `{ ref, dir? }` | `referencia` (solo en `evaluar`; en fórmulas se sigue, ver abajo) | `'→ 4598f23e'` (ocho primeros caracteres del id) |
| cadena `'12 EUR'`, `'EUR 12'`, `'-3 EUR'`, `'12.5 m'` | `magnitud` (número y unidad, en cualquier orden, separados o no por espacios). **[X] decidir VG**: cómo se escribe una magnitud en BTML; el mapa y el corpus no lo deciden, y esta lectura por la forma del texto convierte también nombres con número (`'Habitación 101'`, `'Mesa 4'`) | `'12 EUR'` |
| cadena de exactamente diez dígitos, `'2000000000'` | `texto` (es una **dirección**, no un número: mapa §12, «un texto de diez dígitos es dirección») | `'2000000000'` |
| cadena `'7'`, `'0034'`, `'1.5'` | `texto`: una cadena de cifras es una cadena literal (corpus 03: «Número literal: `120`; cadena literal: `"Yogur"`»); el número lo da el JSON. `'0034'` conserva sus ceros (auditoría de ajuste 2) | `'7'` |
| cadena `'==x'` | `texto` `=x` | `'=x'` |
| cualquier otra cadena | `texto` | la cadena |

Unidad admitida en un literal de slot: primer carácter una letra de cualquier alfabeto o `€ $ %`, luego letras, dígitos, `_`, `€`, `$`, `%`. `'3 días'`, `'1 año'` y `'año 2'` se leen hoy como magnitudes (las siete unidades de T se escriben como se llaman; [X] decidir VG, ver la tabla). Un número JS de diez cifras en el slot sigue siendo `numero`; solo la **cadena** de diez dígitos es dirección.

Asimetría: en un **slot** la unidad puede ir delante (`'EUR 12'`); dentro de una **fórmula** solo detrás (`12 EUR`): `=EUR 12` es `ERROR: identificador suelto: EUR`. Las unidades son **etiquetas**: `min` o `h` no tienen relación con las escalas de T (`minuto`, `hora`), ni `EUR` con la denominación del token E (que además va ligada a su emisor: la serie es `E:<emisor>/EUR`). Una magnitud BQL no mueve nada; para pagar lo que calcula una fórmula hay que pasar a mano `valor.cantidad` y `valor.unidad` al movimiento (`docs/MOTOR.md` §2.1).

**Referencias.** `evaluar` sobre un slot que contiene una referencia devuelve el valor `referencia` sin seguirla. Dentro de una fórmula, `LOCAL`, `REF` y `ACTUAL` **sí** siguen las referencias (encadenadas, hasta llegar a un contenido que no sea referencia) y anotan la dependencia. El camino de índices **no atraviesa** una referencia: si `[1, 0]` es `{ ref: menu, dir: '1000000000' }`, `LOCAL(1, 0)` devuelve lo que alcanza (un array de tres posiciones), pero `LOCAL(1, 0, 1)` busca `[1, 0, 1]` en el propio payload, encuentra un objeto que no es array y devuelve PENDIENTE. Para entrar en el otro registro se usa `REF(id, dir)`.

Verificado (`ejemploCompra` de `ejemplos/ikisai/compra-food.mjs`):

| Llamada | `estado` | `texto` |
|---|---|---|
| `evaluar(eje, compra.id, [1, 0])` | RESUELTO | `→ 4598f23e` |
| `consultar(eje, compra.id, [9], 'LOCAL(1, 0)')` | RESUELTO | `[3 posiciones]` |
| `consultar(eje, compra.id, [9], 'LOCAL(1, 0, 1)')` | PENDIENTE | `PENDIENTE: posición sin desarrollar` |
| `consultar(eje, compra.id, [9], 'REF("<menu.id>", "1100000000")')` | RESUELTO | `guiso` |

---

## 4. Gramática

### 4.1 Léxico

El analizador salta espacios en blanco y reconoce, por este orden:

| Token | Expresión regular | Ejemplos | Notas |
|---|---|---|---|
| número | `\d+(?:\.\d+)?` | `12`, `12.5` | Sin signo (el `-` es un operador unario), sin `.5`, sin exponente (`1e3` se lee como magnitud `1 e3`). |
| texto | `"(?:[^"\\]\|\\.)*"` | `"a"`, `"a\"b"` | Solo comillas dobles; escapes JSON (`\"`, `\\`, `\n`, `\u00e9`). |
| identificador | `[\p{L}_][\p{L}\p{N}_€$%]*` o `[€$%]` | `LOCAL`, `EUR`, `m`, `día`, `año`, `€`, `%` | Letras de cualquier alfabeto (con acentos y `ñ`); `/` no entra. |
| operador | `<>`, `<=`, `>=`, `(`, `)`, `+`, `-`, `*`, `/`, `,`, `=`, `<`, `>` | | |

Cualquier otro carácter → `SyntaxError: carácter inesperado en <pos>: <fragmento>`.

### 4.2 Sintaxis

```
comparacion := expr [ ( '=' | '<>' | '<' | '>' | '<=' | '>=' ) expr ]
expr        := termino { ( '+' | '-' ) termino }
termino     := factor { ( '*' | '/' ) factor }
factor      := '-' factor
             | '(' comparacion ')'
             | numero [ unidad ]
             | texto
             | NOMBRE '(' [ comparacion { ',' comparacion } ] ')'
unidad      := identificador no seguido de '('
```

Reglas:

- Precedencia de menor a mayor: comparación < `+ -` < `* /` < `-` unario. Asociatividad izquierda: `10 - 2 - 3` = 5.
- Una comparación no se encadena: `1 < 2 < 3` → `SyntaxError: sobra: <`. Se anida con paréntesis: `(1 < 2) = (2 < 3)`.
- Una magnitud es un número seguido inmediatamente de un identificador: `12 EUR`, `12EUR`, `12 €`, `5 %`. El orden `EUR 12` solo vale en literales de slot (§3), no en fórmulas (`SyntaxError: identificador suelto: EUR`).
- Un identificador solo es válido como nombre de función (seguido de `(`) o como unidad (precedido de número). Suelto → `SyntaxError: identificador suelto: <nombre>`.
- Los nombres de función se pasan a mayúsculas: `local(1)` ≡ `LOCAL(1)`. Las unidades **no**: `1 EUR + 2 eur` son dos unidades distintas (`1 EUR + 2 eur`).
- Una función puede tener cero argumentos: `ORIGEN()`, `Y()`.
- No hay literales booleanos: verdadero es `1 = 1`, falso es `1 <> 1`.

### 4.3 Árbol (`analizar`)

| `tipo` | Campos | Ejemplo de entrada | Salida |
|---|---|---|---|
| `num` | `v` | `3` | `{ tipo: 'num', v: 3 }` |
| `str` | `v` | `"a"` | `{ tipo: 'str', v: 'a' }` |
| `mag` | `cantidad`, `unidad` | `12 EUR` | `{ tipo: 'mag', cantidad: 12, unidad: 'EUR' }` |
| `neg` | `arg` | `-3 EUR` | `{ tipo: 'neg', arg: { tipo: 'mag', cantidad: 3, unidad: 'EUR' } }` |
| `bin` | `op` (`+ - * /`), `izq`, `der` | `1 + 2 * 3` | `{ tipo: 'bin', op: '+', izq: {num 1}, der: { tipo: 'bin', op: '*', … } }` |
| `cmp` | `op` (`= <> < > <= >=`), `izq`, `der` | `1 < 2` | `{ tipo: 'cmp', op: '<', izq: {num 1}, der: {num 2} }` |
| `fn` | `nombre` (mayúsculas), `args[]` | `LOCAL(1, 2)` | `{ tipo: 'fn', nombre: 'LOCAL', args: [{num 1}, {num 2}] }` |

`analizar` no valida nombres de función ni número de argumentos: `HOLA(1)` analiza bien y falla al evaluar (`ERROR: función desconocida: HOLA`). Sí limita la anidación (paréntesis, llamadas, `-` unario) a `LIMITES.profundidad` niveles: más → PENDIENTE POR LÍMITE `fórmula anidada más de 100 niveles` (así una fórmula de veinte mil paréntesis no revienta la pila). Las cadenas largas de `+` no anidan: las limita el presupuesto.

---

## 5. Tipos de valor

Todo valor BQL es un objeto con `tipo`:

| `tipo` | Forma | `formato` | Ejemplo de `texto` |
|---|---|---|---|
| `numero` | `{ valor: number }` | redondeado a 3 decimales | `0.333`, `-6`, `Infinity` |
| `texto` | `{ valor: string }` | la cadena | `hola` |
| `booleano` | `{ valor: boolean }` | `verdadero` / `falso` | `verdadero` |
| `magnitud` | `{ cantidad, unidad, desglose: [{ cantidad, unidad }, …] }` (`desglose` siempre presente; con un solo sumando tiene un elemento) | `cantidad unidad`, y entre paréntesis el desglose si tiene más de un sumando | `14 EUR (12 EUR + 2 EUR)` |
| `composicion` | `{ partes: [magnitud, …] }` (unidades distintas) | partes unidas por ` + ` | `300 m (200 m + 100 m) + 5 EUR` |
| `array` | `{ valor: any[] }` (el subarray crudo) | `[n posiciones]` | `[3 posiciones]` |
| `referencia` | `{ valor: { ref, dir? } }` | `→ ` + 8 primeros caracteres del id | `→ 4598f23e` |
| `coleccion` | `{ items: [candidato, …] }` (§7.4) | `n candidato(s)` + `: origen id8 · …` | `3 candidatos: escrito d567acc1 · escrito 59bd2354 · escrito 9a726a75`; `0 candidatos` |

---

## 6. Operadores

### 6.1 Suma y resta (`+`, `-`)

| Izquierda | Derecha | Resultado |
|---|---|---|
| numero | numero | numero |
| magnitud | magnitud, misma unidad | magnitud; el desglose conserva cada sumando (la resta añade el sumando con signo negativo) |
| magnitud | magnitud, otra unidad | composicion con las dos partes |
| composicion | magnitud o composicion | composicion; cada parte se funde con la de su misma unidad o se añade |
| numero | magnitud (o al revés) | **INCOMPATIBLE** `numero y magnitud en EUR no se suman` |
| cualquier otra pareja (texto, array, booleano, coleccion…) | | **INCOMPATIBLE** `<a> y <b> no se suman` |

Los dos operandos se tratan igual: el desglose del resultado lleva los sumandos de la izquierda y **los de la derecha uno a uno** (al restar, cada sumando de la derecha con el signo cambiado), y una unidad que solo trae la derecha entra en la composición con su desglose. Verificado (`test/bql.test.js`): `(1 EUR + 2 EUR) + (3 EUR + 4 EUR)` → `10 EUR (1 EUR + 2 EUR + 3 EUR + 4 EUR)`; `(1 EUR + 2 EUR) - (3 EUR + 4 EUR)` → `-4 EUR (1 EUR + 2 EUR + -3 EUR + -4 EUR)`; `350 EUR + (1 h + 2 h)` → `350 EUR + 3 h (1 h + 2 h)`. Antes el operando derecho llegaba aplanado (`10 EUR (1 EUR + 2 EUR + 7 EUR)`), defecto visto en el caso Tasks (PR #34).

### 6.2 Producto y división (`*`, `/`)

| Izquierda | Derecha | `*` | `/` |
|---|---|---|---|
| numero | numero | numero | numero (`1 / 0` → `Infinity`, sin parada) |
| numero | magnitud | magnitud (misma unidad) | **INCOMPATIBLE** `no se dividen` |
| magnitud | numero | magnitud | magnitud |
| magnitud | magnitud | **INCOMPATIBLE** `no se multiplican` (también con la misma unidad: `2 kg * 3 kg`) | **INCOMPATIBLE** |
| composicion | lo que sea | **INCOMPATIBLE** | **INCOMPATIBLE** |

El producto o la división de una magnitud **pierde el desglose** (`2 * 12 EUR` → `24 EUR`, sin paréntesis).

### 6.3 Negación unaria (`-`)

numero → numero; magnitud → magnitud (sin desglose); cualquier otro → **INCOMPATIBLE** `no se niega <tipo>` (incluida la composicion).

### 6.4 Comparaciones (`=`, `<>`, `<`, `>`, `<=`, `>=`)

Devuelven `booleano`. Solo comparan dos **escalares del mismo tipo**, y si son magnitudes, de la **misma unidad** (corpus: «antes de operar validar tipos y dimensiones»; regla BQL-29, acuerdo).

| Pareja | `=` / `<>` | `<` `>` `<=` `>=` |
|---|---|---|
| numero, numero | por valor | por valor |
| magnitud, magnitud, **misma unidad** | por cantidad | por cantidad |
| texto, texto | por valor | orden de cadenas de JavaScript |
| booleano, booleano | por valor | orden `false < true` |
| cualquier otra pareja: tipos distintos, magnitudes de unidad distinta, o array, referencia, colección o composición | **INCOMPATIBLE** `<a> y <b> no se comparan` | **INCOMPATIBLE** |

Verificado: `1 = "1"`, `12 EUR = "12 EUR"`, `12 EUR = 12 m`, `12 EUR < 12 m`, `1 < "a"` → INCOMPATIBLE; `1 EUR = 1 EUR` → verdadero. Comparar composiciones (`(1 m + 1 EUR) = (1 m + 1 EUR)`) también es INCOMPATIBLE: el corpus deja abierta la comparación de composiciones heterogéneas (BQL-36) y no se resuelve por anticipado; [X] decidir VG.

### 6.5 Ejemplos ejecutados

| Fórmula | `estado` | `texto` |
|---|---|---|
| `1 + 2 * 3` | RESUELTO | `7` |
| `(1 + 2) * 3` | RESUELTO | `9` |
| `1/3` | RESUELTO | `0.333` |
| `0.1 + 0.2` | RESUELTO | `0.3` |
| `200 m + 50 m` | RESUELTO | `250 m (200 m + 50 m)` |
| `12 EUR - 2 EUR` | RESUELTO | `10 EUR (12 EUR + -2 EUR)` |
| `2 * 12 EUR / 4` | RESUELTO | `6 EUR` |
| `200 m + 5 EUR` | RESUELTO | `200 m + 5 EUR` |
| `(200 m + 5 EUR) + 100 m` | RESUELTO | `300 m (200 m + 100 m) + 5 EUR` |
| `(200 m + 5 EUR) - 5 EUR` | RESUELTO | `200 m + 0 EUR (5 EUR + -5 EUR)` |
| `(200 m + 5 EUR) * 2` | INCOMPATIBLE | `INCOMPATIBLE: composicion y numero no se multiplican` |
| `1 + 2 EUR` | INCOMPATIBLE | `INCOMPATIBLE: numero y magnitud en EUR no se suman` |
| `2 kg * 3 kg` | INCOMPATIBLE | `INCOMPATIBLE: magnitud en kg y magnitud en kg no se multiplican` |
| `"b" > "a"` | RESUELTO | `verdadero` |
| `2 EUR >= 3 EUR` | RESUELTO | `falso` |
| `1 <> 2` | RESUELTO | `verdadero` |

---

## 7. Funciones

### 7.0 Resumen

| Función | Argumentos | Devuelve | Dónde vale |
|---|---|---|---|
| `LOCAL(i, j, …)` | 1 o más índices enteros 0–9 | valor del slot `[…anfitrión, i, j, …]` | siempre |
| `REF(id, dir?)` | texto id o prefijo (opcional `@` delante); texto de diez dígitos | valor del slot `dir` de ese evento (raíz si falta) | siempre |
| `BUSCAR(i, j, …)` | 1 o más índices 0–9 (números) | coleccion de candidatos del camino exacto `[…anfitrión, i, j, …]` | siempre |
| `BUSCAR("dirección")` | un texto de diez dígitos | coleccion de candidatos de esa dirección del registro (absoluta, no relativa al anfitrión): la colisión entera | siempre |
| `ACTUAL(pv, cantidad?)` | fuera de FILTRAR/ORDENAR: índice 0–9 y entero ≥ 1 (1 por defecto) | valor del primer candidato (cantidad 1) o coleccion de los `cantidad` primeros | fuera |
| `ACTUAL(pv?, cantidad?)` | dentro: índice 0–9 opcional y entero ≥ 1 (1 por defecto) | valor del candidato iterado (`ACTUAL()`) o de su posición `pv`; `cantidad` sigue siendo cantidad | dentro |
| `FILTRAR(col, cond)` | coleccion; condición evaluada por candidato | coleccion | siempre |
| `ORDENAR(col, expr, "desc"?)` | coleccion; expresión por candidato; texto `desc` (sin distinguir mayúsculas) | coleccion | siempre |
| `ELEGIR(col, k?)` | coleccion; entero ≥ 1 (1 por defecto) | coleccion con los `k` primeros | siempre |
| `CONTAR(col)` | coleccion | numero | siempre |
| `SUMAR(col)` | coleccion | suma de los valores de los candidatos | siempre |
| `ORIGEN()` | — | texto `propio` / `referencia` / `escrito` | solo dentro |
| `SIGNO()` | — | texto `exacto` / `completar` / `reducir` / `mixto` | solo dentro |
| `ACUERDO()` | — | numero 0–10 | solo dentro |
| `DESPLAZAMIENTO()` | — | numero (suma de las distancias) | solo dentro |
| `FALTAS()` | — | numero | solo dentro |
| `EXCEDENTES()` | — | numero | solo dentro |
| `Y(a, b, …)` | 0 o más booleanos | booleano (todos; `Y()` = verdadero) | siempre |
| `O(a, b, …)` | 0 o más booleanos | booleano (alguno; `O()` = falso) | siempre |
| `NO(a)` | 1 booleano | booleano | siempre |
| `BASES(alcance?, medida?, k \| campo?)` | ninguno; o texto `hermanos` / `proyecto` / `general`, texto de una medida o de una serie de token, y una caja 0–9 o un campo | numero: n de una base del 8, la caja del anfitrión o un dato de la base (§7.13) | siempre |
| `CAJA(medida, alcance?)` | texto de una medida o de una serie de token; alcance (`"hermanos"` por defecto) | numero 0–9: la caja del anfitrión, la de `BASES(alcance, medida)` (§7.14) | siempre |
| `FRESCURA(alcance?)` | alcance (`"hermanos"` por defecto) | numero: llegadas desde la base que lee ese alcance (hijos nuevos, bases renovadas y lo mismo debajo). `0` = ninguna llegada, no «al día»: no ve cambios en lo ya medido (§7.14) | siempre |

«Dentro» = mientras se evalúa el segundo argumento de `FILTRAR` o de `ORDENAR`. Fuera, las seis funciones de encaje dan `ERROR: <NOMBRE> solo dentro de FILTRAR u ORDENAR`.

### 7.1 El anfitrión

Toda fórmula se evalúa en un slot `base` (los índices del slot). El **anfitrión** es `base.slice(0, -1)`: la décupla que contiene el slot. `LOCAL`, `BUSCAR(i, …)` y `ACTUAL(pv)` resuelven sus índices **relativos al anfitrión**. `BUSCAR("dirección")` no: la dirección es absoluta en el registro de la fórmula (mapa §12 [D]: «un número es índice (camino exacto, relativo al anfitrión); un texto de diez dígitos es dirección (absoluta en el registro, nombra la colisión entera)»).

| Slot de la fórmula (`dir` de `evaluar`/`consultar`) | Anfitrión | `LOCAL(0)` lee | `BUSCAR(4)` busca en |
|---|---|---|---|
| `[2]` o `'2000000000'` | `[]` (raíz) | `[0]` | `[4]` |
| `[1, 2]` | `[1]` | `[1, 0]` | `[1, 4]` |
| `[]` o `'0000000000'` | `[]` | `[0]` | `[4]` |

En `consultar`, `dir` solo sirve para fijar el anfitrión (la fórmula no tiene que existir en ese slot). `consultar` no evalúa el slot `dir`, así que consultar desde `[4]` una fórmula que busca en la 4 no es un ciclo; solo hay `ciclo en …` cuando se vuelve a leer un slot **que contiene una fórmula** mientras se evalúa (§9.2). Si el evento no está en el eje, `consultar` solo para cuando la fórmula lo lee (`LOCAL`, `BUSCAR`…), y para en PENDIENTE (puede llegar): `consultar(eje, 'zzz', [1], '1')` es RESUELTO `1`; `consultar(eje, 'zzz', [1], 'BUSCAR(1)')` es `PENDIENTE: evento ausente del eje: zzz`.

**Alcance.** Con `LOCAL`, `BUSCAR` por índice y `ACTUAL(pv)` una fórmula solo ve su décupla anfitriona: desde `[1, 3]` no leen `[1]` ni `[7]` del mismo registro, y `REF` al propio registro es imposible porque su id es el hash del payload que contiene la fórmula. La lectura absoluta dentro del propio registro la da `BUSCAR` por **dirección** (§7.4): desde `[1, 3]`, `BUSCAR("7000000000")` devuelve la colisión entera de la 7 del registro. [X] decidir VG si `LOCAL` y `ACTUAL` admiten también una dirección o basta `BUSCAR`.

### 7.2 `LOCAL(i, j, …)`

Lee `[…anfitrión, i, j, …]` del evento de la fórmula. Sigue fórmulas (con detección de ciclos) y referencias. No hay `LOCAL()` sin índices.

| Fórmula (anfitrión `['x', 'y']`) | `estado` | `texto` |
|---|---|---|
| `LOCAL(0)` | RESUELTO | `x` |
| `LOCAL(5)` | PENDIENTE | `PENDIENTE: posición sin desarrollar` |
| `LOCAL()` | ERROR | `ERROR: LOCAL espera al menos un índice` |
| `LOCAL(10)`, `LOCAL(1.5)`, `LOCAL("1")` | ERROR | `ERROR: LOCAL espera índices 0–9` |
| `LOCAL(1)` en el slot `[1]` | ERROR | `ERROR: ciclo en <id8>:1000000000` |

Con el payload `['Compra', ['menú', 1, 'EUR 12'], '=LOCAL(1, 2) + 2 EUR', '=LOCAL(2) + 15 min']`: `evaluar(eje, id, [2])` → `14 EUR (12 EUR + 2 EUR)`; `evaluar(eje, id, [3])` → `14 EUR (12 EUR + 2 EUR) + 15 min`, con `dependencias` que incluyen `<id>:2000000000` y `<id>:3000000000`.

### 7.3 `REF(id, dir?)`

- `id`: texto. Se quita un `@` inicial y se pasa a minúsculas. Tiene que poder ser un id (hexadecimal, como los hashes del eje); si no → `ERROR: referencia mal formada: <p>` (los marcadores `#A`, `#T`, `#B` de los ejemplos del corpus caen aquí). Se busca en `eje.orden` por **prefijo**: si un solo evento empieza por él, ese; si varios, `ERROR: referencia ambigua: <p>`; si **ninguno**, `PENDIENTE: referencia ausente del eje: <p>` (corpus: «referencia/contexto ausente → PENDIENTE»; el evento puede llegar).
- `dir`: texto de exactamente diez dígitos; si falta, la raíz (el payload entero). Otra cosa → `ERROR: REF espera una dirección de diez dígitos`. Si `id` no es texto → `ERROR: REF espera un id entre comillas`.
- Lee el slot como `LOCAL` (sigue fórmulas y referencias) y anota `<id>:<dir>` en `dependencias`.

| Fórmula | `estado` | `texto` |
|---|---|---|
| `REF("<menu.id>")` | RESUELTO | `[3 posiciones]` |
| `REF("<8 primeros del id>", "1100000000")` | RESUELTO | `guiso` |
| `REF("@<8 primeros>", "1000000000")` | RESUELTO | `[3 posiciones]` |
| `REF("<id>", "7000000000")` (posición no desarrollada) | PENDIENTE | `PENDIENTE: posición sin desarrollar` |
| `REF("<id>", "1")` | ERROR | `ERROR: REF espera una dirección de diez dígitos` |
| `REF(1)` | ERROR | `ERROR: REF espera un id entre comillas` |
| `REF("ffff…ffff")` (64 caracteres, ningún evento así en el eje) | PENDIENTE | `PENDIENTE: referencia ausente del eje: ffff…` |
| `REF("zzz")`, `REF("#T")` | ERROR | `ERROR: referencia mal formada: zzz` |

### 7.4 `BUSCAR(i, j, …)` y `BUSCAR("dirección")`

Devuelve la **coleccion de ocupantes** de una posición del evento de la fórmula, calculada por `ocupantes` (`src/encaje.js`). No registra nada. Dos formas, sin ambigüedad (mapa §12 [D], VG 7-11 tarde; igual que las referencias):

- **índice** (números): `BUSCAR(i, j, …)` busca en el **camino exacto** `[…anfitrión, i, j, …]`, relativo al anfitrión. `BUSCAR(1)` es la posición 1 y `BUSCAR(1, 0)` la 1.0, sin colisión por ceros entre ellas.
- **dirección** (un texto de diez dígitos): `BUSCAR("2000000000")` busca en esa dirección del registro, absoluta, y nombra **la colisión entera** (`1`, `1.0`, `1.0.0`…). Es la forma del ejemplo integral del corpus, `BUSCAR(LOCAL(5))`, con la dirección «dónde encaja lo que busco» guardada en la posición 5 (una cadena de diez dígitos en un slot se lee como texto, §3). Otro texto, o un texto con más argumentos → `ERROR: BUSCAR espera índices 0–9 o una dirección de diez dígitos`.

Si hay más de `limites.candidatos` ocupantes (1000 por defecto) → `PENDIENTE POR LÍMITE` con `parcial: { examinados, de }`: no se presenta como completo lo que no se examinó entero. Si el gancho `puedeLeer` no autoriza la posición buscada, o algún ocupante, o algún salto de la cadena de un ocupante por referencia → `PENDIENTE DE AUTORIZACIÓN`, antes de exponer nada de ningún ocupante (§9.6).

Ocupantes, en orden de llegada:

1. **propio**: con dirección, cada camino del propio payload que colisiona en ella (`[1]`, y si `[1]` es un array con posición 0, también `[1, 0]`, `[1, 0, 0]`…); con índice, solo el camino pedido.
2. **referencia**: justo detrás de cada propio que es una referencia, lo que esa referencia alcanza (siguiendo cadenas, hasta 20 saltos).
3. **escrito**: los eventos con `sobre = <este evento>` y `en = <la dirección>`, en orden de entrada en el eje. Con índice, un escrito solo tiene su dirección de anclaje, y se lee como toda dirección, sin ceros finales (`indicesDe`, como `REF` y las referencias BTML): los anclados en `1000000000` salen en `BUSCAR(1)` y no en `BUSCAR(1, 0)`. [X] decidir VG: el mapa fija «índice = camino exacto» y «dirección = colisión entera», no dónde cae un escrito (que se ancla con una dirección) cuando se busca por índice.

Orden por defecto (**encaje**, `ordenarPorEncaje`, `docs/BTML.md` §6.5; mapa §12 [D], opción B, decidida por VG el 7-11 por la tarde): más coincidencias de ruta primero (profundidades de acuerdo; los exactos tienen 10); a igual acuerdo, orden de llegada. Ni el signo ni la distancia ordenan: son información, salvo en las profundidades que una época declare ordinales (`epoca.ordinal(k)`), donde a igual acuerdo ordena la menor distancia. La época 0 no declara ninguna (`BUSCAR` no pasa época; `docs/REGLAS_CORTAS.md`).

**Estructura de un candidato** (`valor.items[k]`):

| Campo | Tipo | Contenido |
|---|---|---|
| `origen` | `'propio'` \| `'referencia'` \| `'escrito'` | Procedencia. |
| `evento` | string | Id del evento donde vive el valor (propio: el anfitrión; referencia: el evento alcanzado; escrito: el hijo). |
| `indices` | number[] | Camino dentro de `evento` (propio: el camino exacto, p. ej. `[4, 0]`; referencia: la posición alcanzada; escrito: `[]`, su payload entero). |
| `procedencia` | string[] | Cadena de lugares: `'<id>:<dir>#<camino>'` para propios, `'<id>:<dir>'` para referencias y escritos. |
| `autor`, `t` | string | Solo en escritos; `undefined` en los demás. |
| `vector` | number[10] | candidato − buscado (`origenDir − destino`), dígito a dígito. |
| `distancia` | number[10] | `|vector|` por profundidad; información, no orden. |
| `acuerdo` | 0–10 | Profundidades iniciales con diferencia 0. |
| `signo` | texto | `exacto` (todo 0), `completar` (solo negativos: le falta), `reducir` (solo positivos: le sobra), `mixto`. |
| `faltas`, `excedentes` | number | Profundidades con diferencia negativa (le falta) / positiva (le sobra). |
| `origenDir`, `destino` | string | Direcciones de diez dígitos. |

Origen del vector según el tipo: propio → `origenDir = destino` (vector todo ceros, `exacto`, acuerdo 10); escrito → anclado exactamente en la dirección buscada, `origenDir = destino` (`exacto`, acuerdo 10, desplazamiento 0; su `dir` sigue siendo `'0000000000'`, la raíz de su payload, su `indices` es `[]` y su valor es su payload entero); referencia → `origenDir` = la dirección alcanzada en el otro registro (una referencia a `3000000000` colocada en `[2]` da vector `[1, 0, …]`, `reducir`, excedentes 1, acuerdo 0; una referencia a `1100000000` colocada en `[2]` da `[-1, 1, 0, …]`, `mixto`; una referencia a `1000000000` colocada en `[1]` es `exacto`). En la época 0, por tanto, **solo una referencia que alcanza otra dirección** tiene acuerdo menor que 10: `ACUERDO()`, `SIGNO()`, `FALTAS()` y `DESPLAZAMIENTO()` no distinguen un escrito de un propio (para eso está `ORIGEN()`).

La colisión por ceros solo aparece buscando por **dirección**: en el eje de ejemplo, sin nada escrito en la 4, `CONTAR(BUSCAR("4000000000"))` es `2` (`[4]`, el array `['pagar', 'servir']`, y `[4, 0]`, su posición 0 `'pagar'`: «colisiones, no apaños», mapa §12), y `CONTAR(BUSCAR(4))` es `1` (el camino exacto `[4]`). Las tablas de esta sección usan el escenario de `test/bql-colecciones.test.js` (tres propinas escritas en `4000000000`), que **no** está en el eje de ejemplo.

El valor de un candidato (lo que leen `ACTUAL()`, `SUMAR`, `ORDENAR`) es `leerSlot(evento, indices)`: sigue fórmulas y referencias; un escrito terminal da su terminal; un propio array da un `array`.

Verificado (escenario de `test/bql-colecciones.test.js`: compra con `[4] = ['pagar', 'servir']` y tres propinas escritas en `4000000000`):

| Fórmula (slot `[4]` de la compra) | `estado` | `texto` |
|---|---|---|
| `BUSCAR(4)` | RESUELTO | `4 candidatos: propio f9e59d1e · escrito d567acc1 · escrito 59bd2354 · escrito 9a726a75` (la posición 4 y las propinas ancladas en ella) |
| `BUSCAR(4, 0)` | RESUELTO | `1 candidato: propio f9e59d1e` (solo la 4.0, `'pagar'`) |
| `BUSCAR("4000000000")` | RESUELTO | `5 candidatos: propio f9e59d1e · propio f9e59d1e · escrito d567acc1 · escrito 59bd2354 · escrito 9a726a75` (la colisión entera: 4, 4.0 y los escritos) |
| `BUSCAR(7)` | RESUELTO | `0 candidatos` |
| `BUSCAR()` | ERROR | `ERROR: BUSCAR espera una posición` |
| `BUSCAR("4")` | ERROR | `ERROR: BUSCAR espera índices 0–9 o una dirección de diez dígitos` |
| `BUSCAR(1)` (compra: `[1, 0]` es referencia al menú; la cuenta está escrita en `1000000000`) | RESUELTO | `2 candidatos: propio f9e59d1e · escrito c70bfa6e` |
| `BUSCAR(1, 0)` | RESUELTO | `2 candidatos: propio f9e59d1e · referencia 4598f23e` (la 1.0 y lo que alcanza) |
| `BUSCAR("1000000000")` | RESUELTO | `4 candidatos: propio f9e59d1e · propio f9e59d1e · referencia 4598f23e · escrito c70bfa6e` |

Los ocho caracteres son los primeros del id (hash SHA-256 del evento); con los mismos datos y el mismo `t` salen siempre los mismos.

### 7.5 `ACTUAL`

La misma firma en los dos modos, `ACTUAL(pv, cantidad?)`: el segundo parámetro es **siempre** la cantidad máxima de candidatos (1 por defecto) y **nunca** profundidad (mapa §2.3 [D]; corpus: `ACTUAL(1)` y `ACTUAL(1,1)` comparten intención). Más de dos argumentos → `ERROR: ACTUAL espera una posición y, si acaso, una cantidad`. Lo que cambia es el ámbito, según haya candidato iterado (`ctx.actual`) o no:

**Fuera de FILTRAR/ORDENAR**: la colección activa del camino exacto `[…anfitrión, pv]` (igual que `BUSCAR(pv)`: `pv` es un índice), limitada a `cantidad`.

| Caso | Resultado |
|---|---|
| `ACTUAL(pv)` o `ACTUAL(pv, 1)` | el **valor** del primer candidato (no una colección): `ACTUAL(4)` → `[2 posiciones]` |
| `ACTUAL(pv, n)` con `n ≥ 2` | coleccion con los `n` primeros (o menos si no hay tantos): `ACTUAL(4, 2)` → `2 candidatos: propio f9e59d1e · escrito d567acc1`; `CONTAR(ACTUAL(4, 99))` → `4` |
| sin candidatos | PENDIENTE `sin candidatos en la posición <pv>` |
| `ACTUAL()` (sin ámbito activo) | PENDIENTE `ACTUAL sin ámbito activo: no hay candidato ni posición de la que leer` (corpus: «sin ámbito activo, no inventa un origen y queda pendiente») |
| `ACTUAL(1, 0)`, `ACTUAL(1, 1.5)` | ERROR `ACTUAL espera una cantidad entera ≥ 1` |
| `=ACTUAL(1)` escrito en el slot `[1]` | ERROR `ciclo en …` (el primer candidato de `[1]` es la propia fórmula) |

El primer candidato es el **más antiguo**: propios primero y escritos por orden de llegada (todos exactos, §7.4). Como corregir es añadir un ocupante (mapa §12), `ACTUAL(pv)` da el original y no la corrección, y BQL no tiene forma de quedarse con el último (§7.7, §11).

**Dentro de FILTRAR/ORDENAR**: el ámbito es el candidato iterado, uno solo.

| Caso | Resultado |
|---|---|
| `ACTUAL()` | el valor del candidato |
| `ACTUAL(pv)` o `ACTUAL(pv, 1)` | el valor de su posición `[…candidato.indices, pv]` |
| `ACTUAL(pv, n)` con `n ≥ 2` | PENDIENTE `ACTUAL(<pv>, <n>) dentro de FILTRAR u ORDENAR: la cantidad mayor que 1 en un ámbito de un solo candidato no está definida`. El corpus lo deja abierto (BQL-17/23: «la cantidad >1 dentro de ámbitos unitarios […] necesita pruebas de V5»); no se inventa respuesta. [X] decidir VG. |
| `ACTUAL(1, 0)` | ERROR `ACTUAL espera una cantidad entera ≥ 1` |

Ya no hay subposiciones anidadas del candidato por `ACTUAL(k, j)` (antes `ACTUAL(1, 2)` dentro era la subposición `[1, 2]`; contradecía el [D] «cantidad nunca profundidad»). Si la posición no existe (p. ej. `ACTUAL(0)` sobre un escrito terminal), la parada es PENDIENTE y **la consulta entera queda PENDIENTE**: un dato faltante no se convierte en falso.

### 7.6 `FILTRAR(col, cond)`

- `col` debe ser coleccion; si no, INCOMPATIBLE `FILTRAR espera una colección, no <tipo>`.
- `cond` es **perezosa**: se evalúa una vez por candidato con `ctx.actual = candidato`. Debe dar booleano; si no, INCOMPATIBLE `FILTRAR espera verdadero o falso, no <tipo>`. Falta `cond` → ERROR `FILTRAR espera una condición`.
- Dentro de `cond`: `ACTUAL` es el candidato; `LOCAL` **sigue siendo el anfitrión**; `BUSCAR` sigue buscando en el anfitrión; `ORIGEN()` y las funciones de encaje describen al candidato.
- Cualquier parada en un candidato (PENDIENTE y sus subtipos, INCOMPATIBLE, ERROR) para toda la consulta con ese estado. Si es PENDIENTE POR LÍMITE, `parcial: { examinados, de }` dice cuántos candidatos se habían examinado (lo mismo en `ORDENAR` y `SUMAR`).
- `FILTRAR` anidado: el `ACTUAL` interior es el candidato interior; al salir se restaura el exterior.

| Fórmula (slot `[4]` de la compra) | `estado` | `texto` |
|---|---|---|
| `CONTAR(FILTRAR(BUSCAR(4), ORIGEN() = "escrito"))` | RESUELTO | `3` |
| `CONTAR(FILTRAR(BUSCAR(4), ORIGEN() = "propio"))` | RESUELTO | `1` (camino exacto: la 4, no la 4.0) |
| `CONTAR(FILTRAR(FILTRAR(BUSCAR(4), ORIGEN() = "escrito"), ACTUAL() > 1 EUR))` | RESUELTO | `2` |
| `FILTRAR(BUSCAR(4), ACTUAL() > 1 EUR)` (el primer candidato es el array propio) | INCOMPATIBLE | `INCOMPATIBLE: array y magnitud en EUR no se comparan` |
| `CONTAR(FILTRAR(BUSCAR(4), ACTUAL(0) = "pagar"))` (los escritos son terminales: sin posición 0) | PENDIENTE | `PENDIENTE: posición sin desarrollar` |
| `CONTAR(FILTRAR(BUSCAR(4), LOCAL(0) = "Compra del menú del día"))` | RESUELTO | `4` |
| `FILTRAR(BUSCAR(4), 1)` | INCOMPATIBLE | `INCOMPATIBLE: FILTRAR espera verdadero o falso, no numero` |
| `FILTRAR(1, 1 < 2)` | INCOMPATIBLE | `INCOMPATIBLE: FILTRAR espera una colección, no numero` |
| `CONTAR(FILTRAR(BUSCAR(4), ACTUAL(0, 2) = "pagar"))` | PENDIENTE | `PENDIENTE: ACTUAL(0, 2) dentro de FILTRAR u ORDENAR: la cantidad mayor que 1 en un ámbito de un solo candidato no está definida` |
| `CONTAR(FILTRAR(BUSCAR(4), FALTAS() = 1))` | RESUELTO | `0` (los escritos anclados en `4000000000` son encaje exacto) |
| `CONTAR(FILTRAR(BUSCAR(4), Y(ACUERDO() = 10, DESPLAZAMIENTO() = 0)))` | RESUELTO | `4` |

### 7.7 `ORDENAR(col, expr, "desc"?)`

- `col` coleccion (si no, INCOMPATIBLE). `expr` perezosa, evaluada por candidato como en `FILTRAR`; falta → ERROR `ORDENAR espera una expresión`.
- Las claves (el resultado de `expr` en cada candidato) tienen que ser **escalares de un mismo tipo**: todas numero, todas texto, todas booleano, o todas magnitud **de la misma unidad** (se ordena por la cantidad). Una clave array, referencia, colección o composición → INCOMPATIBLE `ORDENAR no ordena por <tipo>`; claves de tipos o unidades mezclados → INCOMPATIBLE `ORDENAR con claves de tipos distintos: <tipos>` (BQL-29: validar tipos y dimensiones antes de operar).
- Ascendente con `<`/`>` de JavaScript; orden estable (los empates conservan el orden de entrada, que por defecto es el de encaje). Tercer argumento: el texto `desc` en cualquier combinación de mayúsculas invierte **el comparador**, no la lista: el orden sigue siendo estable y los empates conservan el orden de entrada también en descendente. Cualquier otro valor se ignora en silencio (ascendente).
- No tiene efectos: devuelve una colección nueva.
- No invierte la llegada: con candidatos que empatan en la clave (todos los escritos exactos de una posición, ordenados por `ORIGEN()`, `ACUERDO()` o cualquier clave constante), `"desc"` deja el mismo orden. Así, «el escrito más reciente» no se puede elegir en BQL: `ELEGIR(FILTRAR(BUSCAR(4), ORIGEN() = "escrito"))` da el más antiguo, y ni la llegada ni `t` son accesibles como clave (§11). Desde JavaScript, `valor.items.at(-1)` de la colección.

| Fórmula (slot `[4]`; propinas 2, 5 y 1 EUR escritas en ese orden) | `texto` |
|---|---|
| `ORDENAR(FILTRAR(BUSCAR(4), ORIGEN() = "escrito"), ACTUAL())` | `3 candidatos: escrito 9a726a75 · escrito d567acc1 · escrito 59bd2354` (1, 2, 5 EUR) |
| `ORDENAR(FILTRAR(BUSCAR(4), ORIGEN() = "escrito"), ACTUAL(), "desc")` | `3 candidatos: escrito 59bd2354 · escrito d567acc1 · escrito 9a726a75` (5, 2, 1 EUR) |
| `ORDENAR(BUSCAR(4), ORIGEN())` | escritos antes que propios (orden alfabético de `escrito` < `propio`) |
| `ORDENAR(BUSCAR(4), DESPLAZAMIENTO(), "desc")` | el orden de entrada (todos tienen desplazamiento 0: empate estable) |
| `ORDENAR(BUSCAR(4), ACTUAL())` | `INCOMPATIBLE: ORDENAR no ordena por array` (el primer propio es `['pagar', 'servir']`) |

### 7.8 `ELEGIR(col, k?)`

Los `k` primeros candidatos de `col` como coleccion (1 por defecto; si hay menos, los que haya; sobre una colección vacía, `0 candidatos`). `k` no entero o < 1 → ERROR `ELEGIR espera una cantidad entera ≥ 1`. `col` no coleccion → INCOMPATIBLE. **No publica nada**: elegir de verdad es consolidar en la fábrica (`src/motor.js`), fuera de BQL.

`ELEGIR(ORDENAR(FILTRAR(BUSCAR(4), ORIGEN() = "escrito"), ACTUAL(), "desc"))` → `1 candidato: escrito 59bd2354` (la propina de 5 EUR); `…, 2)` → `2 candidatos: escrito 59bd2354 · escrito d567acc1`.

### 7.9 `CONTAR(col)`

Número de candidatos. `CONTAR(BUSCAR(9))` → `0`. Argumento no coleccion → INCOMPATIBLE `CONTAR espera una colección, no <tipo>`.

### 7.10 `SUMAR(col)`

Suma los valores de los candidatos, en orden, con la regla de `+` (§6.1): números con números; magnitudes con desglose; unidades distintas → composicion. Colección vacía → numero `0`, **sin unidad**: `SUMAR(BUSCAR(9)) + 1 EUR` es `INCOMPATIBLE: numero y magnitud en EUR no se suman` (§12). Un solo candidato → su valor **sin comprobar el tipo** (`SUMAR` de una colección con un único escrito que es un array devuelve ese `array`). Mezclas que `+` no admite → INCOMPATIBLE (`SUMAR(BUSCAR(4))` sobre la compra → `INCOMPATIBLE: array y magnitud en EUR no se suman`, porque el propio es `['pagar', 'servir']` y el primer escrito `'2 EUR'`; `SUMAR(BUSCAR("4000000000"))` → `INCOMPATIBLE: array y texto no se suman`, porque en la colisión entera el segundo es la 4.0, `'pagar'`). Cada valor sumado conserva su desglose, también el de la derecha (§6.1).

| Fórmula | `texto` |
|---|---|
| `SUMAR(FILTRAR(BUSCAR(4), ORIGEN() = "escrito"))` | `8 EUR (2 EUR + 5 EUR + 1 EUR)` |
| `SUMAR(ELEGIR(ORDENAR(FILTRAR(BUSCAR(4), ORIGEN() = "escrito"), ACTUAL(), "desc"), 2))` | `7 EUR (5 EUR + 2 EUR)` |
| `SUMAR(FILTRAR(BUSCAR(4), ORIGEN() = "escrito")) + LOCAL(1, 2)` | `20 EUR (2 EUR + 5 EUR + 1 EUR + 12 EUR)` |
| `SUMAR(BUSCAR(9))` | `0` |

### 7.11 Funciones de encaje: `ORIGEN`, `SIGNO`, `ACUERDO`, `DESPLAZAMIENTO`, `FALTAS`, `EXCEDENTES`

Solo dentro de `FILTRAR`/`ORDENAR`; fuera, ERROR `<NOMBRE> solo dentro de FILTRAR u ORDENAR`. Sin argumentos (los que se pasen se evalúan y se ignoran).

| Función | Valor | Del campo del candidato |
|---|---|---|
| `ORIGEN()` | texto `propio` / `referencia` / `escrito` | `origen` |
| `SIGNO()` | texto `exacto` / `completar` (le falta) / `reducir` (le sobra) / `mixto` | `signo` (`exacto` si falta) |
| `ACUERDO()` | numero 0–10 | `acuerdo` (10 si falta) |
| `DESPLAZAMIENTO()` | numero: Σ \|vector[k]\| | `vector` (0 si falta) |
| `FALTAS()` | numero: profundidades con diferencia < 0 (le falta) | `faltas` (0 si falta) |
| `EXCEDENTES()` | numero: profundidades con diferencia > 0 (le sobra) | `excedentes` (0 si falta) |

Verificado sobre la compra con la cuenta escrita en `1000000000` (slot `[1]`, `test/vector.test.js`): `CONTAR(FILTRAR(BUSCAR("1000000000"), SIGNO() = "exacto"))` → `4` (la colisión entera: `[1]`, `[1, 0]`, la referencia al menú y la cuenta, anclada exactamente ahí); `… SIGNO() = "completar"` → `0`; `… FALTAS() = 1` → `0`; `… DESPLAZAMIENTO() > 0` → `0`; `… ACUERDO() = 10` → `4`. Por índice, `CONTAR(FILTRAR(BUSCAR(1), SIGNO() = "exacto"))` → `2` (`[1]` y la cuenta).

### 7.12 `Y`, `O`, `NO`

- Variádicas `Y(a, b, …)` y `O(a, b, …)`; `NO(a)`.
- **Todos los argumentos se evalúan antes** (no hay cortocircuito): `Y(1 > 2, HOLA())` → ERROR `función desconocida: HOLA`; `O(1 < 2, LOCAL(9))` → PENDIENTE.
- Argumento no booleano → INCOMPATIBLE `Y espera verdadero o falso, no numero` (igual `O`, `NO`).
- `Y()` → verdadero; `O()` → falso.

| Fórmula | `texto` |
|---|---|
| `Y(1 < 2, 2 < 3)` | `verdadero` |
| `O(1 > 2, NO(2 > 3))` | `verdadero` |
| `NO(1 < 2)` | `falso` |
| `Y(1, 2)` | `INCOMPATIBLE: Y espera verdadero o falso, no numero` |

### 7.13 `BASES(alcance?, medida?, k | campo?)`

Lee las **bases del 8** (`src/bases.js`, `docs/MOTOR.md` §14): las estadísticas escritas como registros en la posición 8 del registro que resumen, firmadas por la propia cosa o por quien tiene P sobre ella (mapa §12 [D]: «BASES() en BQL; la cohorte se elige leyendo el 8 del padre, del proyecto o del génesis»). Solo lee la verdad escrita (VG, 7-11 noche, «Una sola verdad del 8»): sin base escrita, PENDIENTE; nunca calcula al vuelo. El registro de la fórmula es el anfitrión.

| Forma | Devuelve |
|---|---|
| `BASES()` | n de la base vigente del 8 del anfitrión (sus hijos) |
| `BASES(alcance)` | n de la cohorte: `"hermanos"` (los hijos del 8 del padre), `"proyecto"` (el subárbol del 8 del proyecto) o `"general"` (el subárbol del 8 del génesis) |
| `BASES(alcance, medida)` | la caja (0–9) del anfitrión en esa cohorte |
| `BASES(alcance, medida, k)` | cuántos hay en la caja `k` (0–9) |
| `BASES(alcance, medida, campo)` | de la base: `"suma"`, `"minimo"`, `"maximo"`, `"media"`; del anfitrión: `"foco"` (su valor), `"caja"`, `"enCaja"`, `"debajo"`, `"encima"` |

La medida es una de `bases.MEDIDAS` (`"posiciones"`, `"terminales"`, `"escritos"`, `"movimientos"`, `"identidades"`, `"profundidadHilo"`, `"formulasResueltas"`, `"formulasPendientes"`) o una clave de serie de token (`"T:hora"`, `"E:casa/EUR"`…); una serie que la base no nombra vale cero en todos. Un alcance, una medida o un campo que no existen → ERROR (se valida antes de leer). Después, **la lectura del 8 es la de `CAJA` y `FRESCURA`** (§7.14): hereda el presupuesto (cobra lo que examina, y `BASES()` lee el 8 del propio anfitrión), el gancho `puedeLeer` (§9.6: leer la base es leer un escrito anclado en el 8, `leer la base del 8 de <id8> …`; lo que sitúa al anfitrión lo lee entero, su raíz `[]`, y con gancho no cuenta sus fórmulas) y los motivos: sin base escrita, `sin base escrita en el 8 de <id8> (alcance <a>). Para escribirla: …` (en `BASES()`, `(su propio 8)`); sin cohorte, `sin cohorte: el génesis no tiene padre`. Dependencias: el 8 leído (`<registro>:8000000000`), la base leída (`<id de la base>:0000000000`) y, si sitúa al anfitrión, `<anfitrión>:0000000000`. Una fórmula `BASES(…)` que sitúa a su propio registro, evaluada mientras ese registro se mide para una base, queda PENDIENTE (no se mide a sí misma).

Verificado sobre `ejemplos/ikisai/compras-hermanas.mjs`, desde la compra de dos guisos, con las seis bases del ejemplo escritas (`test/bases.test.js`):

| Fórmula | `texto` |
|---|---|
| `BASES("hermanos")` (antes de escribir las bases) | `PENDIENTE: sin base escrita en el 8 de <menú> (alcance hermanos). Para escribirla: …` |
| `BASES("hermanos")` | `4` |
| `BASES("proyecto")` | `9` |
| `BASES("general")` | `14` |
| `BASES("hermanos", "terminales")` | `5` |
| `BASES("hermanos", "terminales", 5)` | `3` |
| `BASES("hermanos", "terminales", "debajo")` | `1` |
| `BASES("hermanos", "terminales", "media")` | `6.25` |
| `BASES("general", "E:casa/EUR", "suma")` | `685` |
| `BASES("hermanos", "T:siglo", 0)` | `4` |
| `BASES("linaje")` | `ERROR: BASES: el alcance es hermanos, proyecto, general` |
| `BASES()` en el menú | `4` |
| `BASES("hermanos")` en el génesis | `PENDIENTE: sin cohorte: el génesis no tiene padre` |
| con `puedeLeer` que niega las bases | `PENDIENTE DE AUTORIZACIÓN: leer la base del 8 de <comedor> exige una autorización que no hay` |

[X] decidir VG: la firma de `BASES()` (el mapa solo la nombra).

### 7.14 `CAJA(medida, alcance?)` y `FRESCURA(alcance?)`

Leen el 8 como `BASES` (§7.13), sin efectos, con el mismo anfitrión (el registro de la fórmula; [X] decidir VG si dentro de `FILTRAR`/`ORDENAR` debe ser el candidato) y los mismos alcances. Las tres leen solo la base escrita (la verdad del 8) y comparten la lectura: presupuesto, gancho, motivos y dependencias. Escribir una base no es de BQL: es `escribirBase` (`src/bases.js`; la firma la propia cosa o quien tiene P sobre el registro, con su clave, y gasta su T). Pruebas: `test/bases-bql.test.js`.

| Función | Devuelve |
|---|---|
| `CAJA(medida, alcance?)` | la caja 0–9 del anfitrión en esa medida: la misma que `BASES(alcance, medida)` y que `situar` (`src/bases.js`) |
| `FRESCURA(alcance?)` | las llegadas desde la base vigente del 8 que lee el alcance: `hijosNuevos + basesNuevas + debajo` de su frescura (`leerBase`, `docs/MOTOR.md` §14). `0` = `sinNovedades` |

**Alcance**: `"hermanos"` (por defecto: el 8 del padre, su estadística de los hijos), `"proyecto"` (el 8 de `bases.proyectoDe`, su subárbol) o `"general"` (el 8 del génesis, su subárbol). Exacto y en minúsculas, como en `BASES`.

**Medida** (`CAJA`): una de `bases.MEDIDAS` (`"posiciones"`, `"terminales"`, `"escritos"`, `"movimientos"`, `"identidades"`, `"profundidadHilo"`, `"formulasResueltas"`, `"formulasPendientes"`) o una clave de serie bien formada: `T:<escala>` con una escala de `tokens.ESCALAS_T`, `E:<emisor>/<denominación>`, `P:<ámbito>` o `R:<emisor>`. Otro nombre es ERROR, aunque no haya base (se valida antes de leer); también los de la primera versión de esta pieza (`"posiciones.3"`, `"movimientos.E:casa/EUR"`). Una serie bien formada que el eje no tiene (sin emitir; en `P`, un ámbito que no es un registro) da PENDIENTE con la lista de las emitidas, en vez de leerse como «caja 0»: así se ve la errata (`"E:csa/EUR"`). Una serie emitida que nadie de la cohorte mueve sí vale cero: caja 0. (`BASES` no hace esta comprobación: `BASES("hermanos", "T:siglo", 0)` da `4`, §7.13.)

**`FRESCURA` cuenta llegadas, no cambios.** Es la frescura de la base entera (de sus dos estadísticas), sumada:

- `hijosNuevos`: hijos del registro llegados después del último medido;
- `basesNuevas`: hijos medidos cuya base vigente ya no es la fundida;
- `debajo`: lo mismo, en las bases fundidas que siguen vigentes, a cualquier altura.

No ve que cambie un registro ya medido (un escrito sobre una compra sin base, una fórmula que se resuelve): eso lo dice `comprobar()`, que recalcula. Por eso `0` es «ninguna llegada», no «al día». En `"hermanos"` cuenta también las bases renovadas de los hermanos, aunque no cambien la estadística de los hijos (que mide a cada hijo, no su base): desde la cena, la base corregida del menú da `FRESCURA()` = `1`. [X] decidir VG: qué es la frescura (el mapa solo dice que la base la lleva; `docs/notas/BASES_DEL_8.md` §3.8).

**Estados.**

| Estado | Motivo | Cuándo |
|---|---|---|
| RESUELTO | — | Hay base válida en el 8 del alcance. |
| PENDIENTE | `sin base escrita en el 8 de <id8> (alcance hermanos). Para escribirla: escribirBase(eje, { registro, autor, privada }) con registro = <id8>, firmada por <cosa> (su identidad propia) o <x> (con P sobre él); mide sus hijos y gasta 1 minuto de su T.` | No hay base escrita. Nombra a la propia cosa y a quienes tienen clave y P sobre el registro. En `proyecto` y `general` dice además `funde la base vigente del 8 de cada uno (se escriben antes, de abajo arriba; un hijo sin base cuenta solo por sí mismo)`. Si el gancho no deja leer el registro, la cosa no se nombra (`firmada por su identidad propia o <x> (con P sobre él)`): sale del contexto del registro; quienes tienen P salen de los saldos y se nombran siempre. |
| PENDIENTE | `sin base escrita en el 8 de <id8> (alcance <a>). <id8> no tiene identidad propia con clave (identidadDe) y nadie con clave tiene poder (P) sobre él: nadie puede escribir su base.` | El registro no da de alta a una cosa con clave y nadie con clave tiene P sobre él ([X] decidir VG cómo se identifica un registro con una identidad, nota de las bases §3.1). |
| PENDIENTE | `sin cohorte: el génesis no tiene padre` | `"hermanos"` desde el génesis. |
| PENDIENTE | `evento ausente del eje: <id8>` | El anfitrión no está en el eje (puede llegar). |
| PENDIENTE | `CAJA: la serie <clave> no se ha emitido en el eje (series emitidas: …)` / `CAJA: el ámbito de P:<x> no es un registro del eje (series emitidas: …)` | Serie bien formada que el eje no tiene. |
| PENDIENTE | `CAJA no se evalúa mientras se mide su propio registro` | `CAJA` dentro de su registro, evaluada mientras ese registro se mide (abajo). |
| PENDIENTE POR LÍMITE | `el alcance <a> (8 de <id8>) exige examinar al menos <k> registros y quedan <q> pasos de presupuesto` | La lectura no cabe (abajo); `parcial: { examinados: 0, de: <k> }`, cota inferior. |
| PENDIENTE DE AUTORIZACIÓN | `leer la base del 8 de <id8> exige una autorización que no hay` | El gancho no deja leer la base (su raíz), como en `BASES`. |
| PENDIENTE DE AUTORIZACIÓN | `leer <id8>:0000000000 (camino raíz) exige una autorización que no hay` | `CAJA`: el gancho no deja leer el anfitrión entero (situarlo es medirlo). |
| PENDIENTE DE AUTORIZACIÓN | `contar las fórmulas de <id8> las evalúa sin el gancho de autorización: con gancho no se cuentan` | `CAJA("formulasResueltas")` o `CAJA("formulasPendientes")` con gancho (abajo); igual `BASES(alcance, "formulasResueltas" \| "formulasPendientes", …)` cuando sitúa al anfitrión. |
| ERROR | `CAJA espera una medida y, si acaso, un alcance` · `FRESCURA espera, si acaso, un alcance` · `CAJA espera el nombre de una medida entre comillas, no <tipo>` · `CAJA: medida desconocida: <m> (…)` · `<FN>: el alcance es hermanos, proyecto, general` | Argumentos. |

**Orden.** Primero los argumentos; después la base; solo si la hay, el anfitrión (`CAJA`, y `BASES` cuando lo sitúa). Sin base no se mide nada ni se pregunta por el anfitrión.

**Coste: el presupuesto.** Leer una base es leer su frescura, y se cobra lo que examina, contado mientras se examina y antes de medir nada: 1 por la base; los escritos sobre el registro (entre ellos se busca la base); los escritos sobre cada hijo medido (su 8); y, bajando por las bases fundidas que siguen vigentes, lo mismo en cada una. Sale del mismo `presupuesto` que el resto de la fórmula (§9.3): `FRESCURA() + FRESCURA()` cobra dos veces. `BASES` cobra lo mismo (VG, 7-11 noche: hereda el presupuesto). En cuanto no cabe, PENDIENTE POR LÍMITE y se deja de contar («al menos»). En el ejemplo, con las seis bases escritas, la lectura de los hermanos de los guisos cuesta 6 (la base y los cinco escritos sobre el menú: cuatro compras y su base) y la general, 20 (el árbol de bases entero). Sin base se cobra mirar el 8: 1 más los escritos sobre el registro. Medir al anfitrión (`CAJA`, `BASES`) no se cobra: evalúa sus fórmulas aparte (§12, 11).

**`CAJA` dentro de su propio registro.** `CAJA` sitúa al anfitrión, y situarlo es medirlo, lo que evalúa sus fórmulas. Mientras un registro se mide (para situarlo, o para escribir la base de su padre), una `CAJA` suya queda PENDIENTE (`CAJA no se evalúa mientras se mide su propio registro`, la guarda de `src/bases.js`) y cuenta en `formulasPendientes`; evaluada desde fuera, se resuelve. Así siempre termina, también con ciclos entre registros por referencias. `FRESCURA` no mide al anfitrión y no entra en ese ciclo.

**Lo que se guarda en el 8 depende del 8 anterior**, solo por las fórmulas que leen el 8 sin situar a su registro: `FRESCURA`, y `BASES` sin medida o con una caja o un dato de la base. Al medir su registro (para la base del padre), una de ellas sin base escrita queda PENDIENTE y cuenta en `formulasPendientes`; con base, se resuelve y cuenta en `formulasResueltas`. Si un hijo del menú lleva `=FRESCURA()`, la primera base del menú lo cuenta como pendiente y la segunda, escrita justo después sin que llegue nada, como resuelta. La frescura de la primera dice que no hay novedades (`FRESCURA()` = `0`), y `comprobar()` dice que no está al día. `CAJA` no tiene este efecto: al medir su registro queda pendiente, haya base o no. Lo comprueba `test/bases-bql.test.js`. [X] decidir VG: si las fórmulas que leen el 8 deben contar en `formulasResueltas` y `formulasPendientes` (o no contar, o contar siempre como pendientes al medir para una base).

**Dependencias** (§9.5): `<registro>:8000000000`, el 8 leído (una base que llegue cambia el resultado; se anota también cuando queda PENDIENTE: es lo que hay que vigilar); `<base>:0000000000`, la base leída; y en `CAJA` (y en `BASES` cuando sitúa al anfitrión), `<anfitrión>:0000000000` (medido entero). Los hijos nuevos, que cambian `FRESCURA`, no se anotan: no son una posición ([X] decidir VG cómo se vigila la llegada de hijos).

**Autorización** (§9.6): la base, por su raíz, con el mismo motivo en las tres; en `CAJA` (y en `BASES` cuando lo sitúa), además, el anfitrión por su raíz. Las fórmulas del anfitrión que la medida evalúa no reciben el gancho (`bases.medir` llama a `evaluar` sin opciones), así que, con gancho, ni `CAJA` ni `BASES` dan las dos medidas de fórmulas del anfitrión: dejarían ver si se resuelven fórmulas que leen lo que quien consulta no puede leer. Las demás medidas, sí; y los datos de la base (`BASES(alcance, "formulasResueltas", "suma")`), también. [X] decidir VG: medir al anfitrión con el gancho de quien consulta.

Ejemplo ejecutado (las compras hermanas de `ejemplos/ikisai/compras-hermanas.mjs`, datos inventados). Guardar como `caja-frescura-ejemplo.mjs` en la raíz y ejecutar `node --input-type=module < caja-frescura-ejemplo.mjs`:

```js
import { ejemploComprasHermanas, escribirBaseDe, escribirBasesDelEjemplo } from './ejemplos/ikisai/compras-hermanas.mjs';
import { leerBase, comprobar } from './src/bases.js';
import { consultar } from './src/bql.js';

const ej = await ejemploComprasHermanas(); // las claves son nuevas en cada ejecución: los ids cambian
const { eje } = ej;
const nombres = [[ej.menu.id, '<menú>'], [ej.comedor.id, '<comedor>'], [eje.genesisId, '<génesis>'], [ej.guisos.id, '<guisos>']];
const sinIds = (s) => s.replace(/\b[0-9a-f]{8}\b/g, (x) => nombres.find(([id]) => id.startsWith(x))?.[1] ?? '<id8>');
const q = (f, opciones) => console.log(f.padEnd(32), '→', sinIds(consultar(eje, ej.guisos.id, [], f, opciones).texto)); // el anfitrión: los guisos
const hora = { token: 'T', escala: 'hora', cantidad: 1, de: 'vecina', a: null };
const alcances = ['hermanos', 'proyecto', 'general'];

console.log('--- sin bases');
q('CAJA("terminales")');
q('FRESCURA("proyecto")');
console.log('--- las seis bases del ejemplo, cada una firmada por su cosa');
await escribirBasesDelEjemplo(ej);
for (const a of alcances) q('CAJA("terminales", "' + a + '")');
q('CAJA("E:casa/EUR", "general")');
q('BASES("general", "E:casa/EUR")');
q('FRESCURA()');
q('CAJA("E:csa/EUR")');
q('CAJA("movimientos.E:casa/EUR")');
console.log('--- llega un té al menú');
await eje.escribir({ autor: 'vecina', sobre: ej.menu.id, t: '2026-11-07T18:30:00Z', movimientos: [hora], payload: 'Un té' });
for (const a of alcances) q('FRESCURA("' + a + '")');
console.log('--- la cosa del menú corrige su base');
await escribirBaseDe(ej, ej.menu.id, { t: '2026-11-07T19:00:00Z' });
for (const a of alcances) q('FRESCURA("' + a + '")');
console.log('--- una nota sobre el café no es una llegada al menú');
await eje.escribir({ autor: 'vecina', sobre: ej.cafe.id, en: '4000000000', t: '2026-11-07T19:30:00Z', movimientos: [hora], payload: 'Sin azúcar' });
q('FRESCURA()');
console.log('comprobar(la base del menú).alDia →', comprobar(eje, leerBase(eje, ej.menu.id)).alDia);
console.log('--- límites y autorización');
q('FRESCURA("general")', { limites: { presupuesto: 20 } });
q('CAJA("formulasPendientes")', { puedeLeer: () => true });
```

```text
--- sin bases
CAJA("terminales")               → PENDIENTE: sin base escrita en el 8 de <menú> (alcance hermanos). Para escribirla: escribirBase(eje, { registro, autor, privada }) con registro = <menú>, firmada por menu-dia (su identidad propia) o casa (con P sobre él); mide sus hijos y gasta 1 minuto de su T.
FRESCURA("proyecto")             → PENDIENTE: sin base escrita en el 8 de <comedor> (alcance proyecto). Para escribirla: escribirBase(eje, { registro, autor, privada }) con registro = <comedor>, firmada por comedor (su identidad propia) o casa (con P sobre él); mide sus hijos y funde la base vigente del 8 de cada uno (se escriben antes, de abajo arriba; un hijo sin base cuenta solo por sí mismo) y gasta 1 minuto de su T.
--- las seis bases del ejemplo, cada una firmada por su cosa
CAJA("terminales", "hermanos")   → 5
CAJA("terminales", "proyecto")   → 5
CAJA("terminales", "general")    → 5
CAJA("E:casa/EUR", "general")    → 6
BASES("general", "E:casa/EUR")   → 6
FRESCURA()                       → 0
CAJA("E:csa/EUR")                → PENDIENTE: CAJA: la serie E:csa/EUR no se ha emitido en el eje (series emitidas: T:hora, T:minuto, E:casa/EUR, P:genesis)
CAJA("movimientos.E:casa/EUR")   → ERROR: CAJA: medida desconocida: movimientos.E:casa/EUR (posiciones, terminales, escritos, movimientos, identidades, profundidadHilo, formulasResueltas, formulasPendientes o una serie T:<escala>, E:<emisor>/<denominación>, P:<ámbito> o R:<emisor>)
--- llega un té al menú
FRESCURA("hermanos")             → 1
FRESCURA("proyecto")             → 1
FRESCURA("general")              → 1
--- la cosa del menú corrige su base
FRESCURA("hermanos")             → 0
FRESCURA("proyecto")             → 1
FRESCURA("general")              → 1
--- una nota sobre el café no es una llegada al menú
FRESCURA()                       → 0
comprobar(la base del menú).alDia → false
--- límites y autorización
FRESCURA("general")              → PENDIENTE POR LÍMITE: el alcance general (8 de <génesis>) exige examinar al menos 19 registros y quedan 18 pasos de presupuesto
CAJA("formulasPendientes")       → PENDIENTE DE AUTORIZACIÓN: contar las fórmulas de <guisos> las evalúa sin el gancho de autorización: con gancho no se cuentan
```

Lectura: sin bases, el motivo dice quién puede escribir cada una: la propia cosa o la casa, que tiene P sobre todo el eje. Los guisos (nueve terminales) caen en la caja 5 de `terminales` (de 6 a 9, con los cortes de la época 0) en los tres alcances. `CAJA("E:casa/EUR", "general")` es la caja de sus 12 euros entre los catorce registros del ámbito, la misma que da `BASES("general", "E:casa/EUR")`. Una serie mal escrita no da caja 0, y un nombre de la primera versión de esta pieza es ERROR. El té es una llegada para las tres bases: la del menú lo tiene como hijo nuevo; la del comedor y la del génesis lo ven debajo. Al corregir la base del menú, la de los hermanos vuelve a `0`; las de arriba ven una base renovada hasta que se reescriban. La nota sobre el café cambia una compra ya medida: `FRESCURA()` da `0` y `comprobar()` dice que la base no está al día. Con `presupuesto: 20`, la llamada y su argumento gastan dos pasos y la lectura general pide al menos 19 (el árbol de bases ha crecido): no cabe.

#### Las dos formas de `BASES`: [X] decidir VG qué firma queda

Hay dos propuestas de `BASES` y no caben juntas: con un solo argumento, cada una da una cosa distinta.

| | A: la de la #44 (la que hay) | B: la primera versión de esta pieza (#52, commit `031a85a`, retirada) |
|---|---|---|
| Firma | `BASES(alcance?, medida?, k \| campo?)` | `BASES(cohorte?)` |
| Devuelve | un numero: n, la caja del anfitrión, una caja de la base o un dato (§7.13) | un valor de tipo `bases`: por medida, la caja del foco, el mínimo, una mediana aproximada desde las cajas y el máximo; n y frescura. `formato` lo daba en una línea (con los nombres de entonces: `posiciones 9: caja 5 (mín 1, mediana ≈ 6.75, máx 9)`; «posiciones» era lo que ahora es `terminales`) |
| Cómo se opera | es un número: se compara y se suma | no operaba con nada (INCOMPATIBLE); para operar, `CAJA` y `FRESCURA` |
| A favor | todo es número; una sola función | una fórmula muestra la base entera, con su mediana |

Hoy queda la A: es la de la #44, que ya lleva la integración. `CAJA` y `FRESCURA` sirven con las dos (`CAJA(m, a)` = `BASES(a, m)` de la A). Si VG elige la B, `BASES(alcance)` deja de dar n y el valor `bases` de `031a85a` se rehace sobre `situar` de la #44.

---

## 8. Estados y qué los provoca

La evaluación se detiene en la primera parada; el estado de la consulta es el de esa parada. Un `SyntaxError` del análisis se convierte en ERROR con `dependencias: []`. Los cuatro estados de cálculo son los de `ESTADOS`; PENDIENTE tiene dos subtipos (`SUBTIPOS_PENDIENTE`, mapa §2.3), que se reconocen con `esPendiente(estado)`.

| Estado | Motivo exacto | Cuándo |
|---|---|---|
| RESUELTO | — | Hay valor. |
| PENDIENTE | `posición sin desarrollar` | Se lee una posición que no existe, o un camino que atraviesa un terminal o una referencia (en `evaluar`, `LOCAL`, `REF`, `ACTUAL`, valor de un candidato, posición de un candidato). |
| PENDIENTE | `posición sin desarrollar: más de diez profundidades` | El camino pedido pasa de diez índices: ninguna dirección BTML llega ahí. [X] decidir VG: PENDIENTE (lo de hoy, de la PR #36) o ERROR (lo que pedía la #43); se eligió PENDIENTE en la integración del 7-11, sin revisar. |
| PENDIENTE | `sin candidatos en la posición <pv>` | `ACTUAL(pv, …)` fuera de FILTRAR sobre una posición sin ocupantes. |
| PENDIENTE | `evento ausente del eje: <id8>` | `evaluar`/`LOCAL`/`BUSCAR` sobre un id que no está en el eje, o una referencia BTML (`{ ref }`) a un evento que no ha llegado, leída desde una fórmula o como candidato. Corpus: «referencia/contexto ausente → PENDIENTE». |
| PENDIENTE | `referencia ausente del eje: <p>` | `REF` con un id o prefijo que ningún evento del eje tiene. |
| PENDIENTE | `ACTUAL sin ámbito activo: no hay candidato ni posición de la que leer` | `ACTUAL()` fuera de FILTRAR/ORDENAR. |
| PENDIENTE | `ACTUAL(<pv>, <n>) dentro de FILTRAR u ORDENAR: la cantidad mayor que 1 en un ámbito de un solo candidato no está definida` | Abierto en el corpus (§7.5). |
| PENDIENTE DE AUTORIZACIÓN | `leer <id8>:<dir> (camino <i.j…\|raíz>) exige una autorización que no hay` | El gancho `puedeLeer(evId, dir, indices)` devolvió `false` para una lectura, para un ocupante propio de `BUSCAR` o para un salto de la cadena de un ocupante por referencia (§9.6). |
| PENDIENTE DE AUTORIZACIÓN | `leer un escrito anclado en <id8>:<dir> exige una autorización que no hay` | El gancho devolvió `false` para un escrito ocupante de `BUSCAR`; se nombra el lugar buscado, no el escrito (su id no se expone). |
| PENDIENTE POR LÍMITE | `presupuesto de cálculo agotado: más de <n> pasos` | Se agotó el presupuesto (§9.3). |
| PENDIENTE POR LÍMITE | `fórmula anidada más de <n> niveles` / `más de <n> lecturas encadenadas` / `profundidad de cálculo agotada` | Se pasó la profundidad: de la fórmula al analizarla, de fórmulas y referencias leídas unas desde otras, o la pila de JavaScript (§9.3). |
| PENDIENTE POR LÍMITE | `más de <n> candidatos en <id8>:<dir>` | `BUSCAR` (o `ACTUAL` fuera) con más ocupantes que `limites.candidatos`; `parcial: { examinados, de }`. |
| INCOMPATIBLE | `<a> y <b> no se suman` / `no se multiplican` / `no se dividen` / `no se comparan` | Operador entre tipos que no operan (§6). `<a>` es el tipo, o `magnitud en <unidad>`. |
| INCOMPATIBLE | `no se niega <tipo>` | `-` unario sobre algo que no es numero ni magnitud. |
| INCOMPATIBLE | `<FN> espera verdadero o falso, no <tipo>` | Condición de `FILTRAR` o argumento de `Y`/`O`/`NO` no booleano. |
| INCOMPATIBLE | `<FN> espera una colección, no <tipo>` | Primer argumento de `FILTRAR`, `ORDENAR`, `ELEGIR`, `CONTAR`, `SUMAR` no es coleccion. |
| INCOMPATIBLE | `ORDENAR no ordena por <tipo>` / `ORDENAR con claves de tipos distintos: <tipos>` | Claves de `ORDENAR` no escalares, o de tipos o unidades mezclados (§7.7). |
| ERROR | `carácter inesperado en <n>: …`, `se esperaba <x> en el token <n>`, `fórmula incompleta`, `identificador suelto: <x>`, `token inesperado: <x>`, `sobra: <x>` | Sintaxis (§4). |
| ERROR | `función desconocida: <NOMBRE>` | Nombre no listado en §7.0. |
| PENDIENTE, PENDIENTE POR LÍMITE, PENDIENTE DE AUTORIZACIÓN, ERROR | los de §7.14 | `BASES`, `CAJA` y `FRESCURA`: sin base escrita (el motivo dice cómo escribirla), sin cohorte, serie sin emitir, lectura más cara que el presupuesto, base o anfitrión no autorizados, argumentos que no valen. |
| ERROR | `ciclo en <id8>:<dir>` | Un slot con fórmula o referencia se vuelve a leer mientras se está leyendo (autorreferencia, ciclo entre eventos, `=ACTUAL(1)` en `[1]`). |
| ERROR | `referencia ambigua: <p>` / `referencia mal formada: <p>` | `REF` con un prefijo que tienen varios eventos, o con algo que no puede ser un id (`#T`, `zzz`, vacío). |
| ERROR | `LOCAL espera al menos un índice`, `<FN> espera índices 0–9`, `REF espera un id entre comillas`, `REF espera una dirección de diez dígitos`, `BUSCAR espera una posición`, `BUSCAR espera índices 0–9 o una dirección de diez dígitos`, `ACTUAL espera una posición y, si acaso, una cantidad`, `ACTUAL espera una cantidad entera ≥ 1`, `FILTRAR espera una condición`, `ORDENAR espera una expresión`, `ELEGIR espera una cantidad entera ≥ 1`, `<FN> espera un argumento`, `<FN> espera una colección`, `<FN> solo dentro de FILTRAR u ORDENAR` | Argumentos mal formados o que faltan (§7). |

Propagación: una parada dentro de la condición de `FILTRAR`, de la expresión de `ORDENAR`, de un argumento de `Y`/`O`/`NO` o de un valor leído por `SUMAR` para **toda** la consulta (no se salta el candidato ni se interpreta como falso).

---

## 9. Evaluación segura

### 9.1 Sin efectos

`evaluar` y `consultar` no escriben en el eje ni mueven tokens: `eje.orden.length` y los saldos son iguales antes y después (`test/bql.test.js`, «la evaluación no tiene efectos»). `BUSCAR`, `FILTRAR`, `ORDENAR`, `ELEGIR` devuelven colecciones nuevas; nada se registra. `CAJA` y `FRESCURA` leen el 8 y no escriben bases: escribirlas es `escribirBase`, fuera de BQL (§7.14).

### 9.2 Pila de ciclos

Cada slot con fórmula que se evalúa, y cada slot con referencia que se sigue, entra en una pila con clave `<id>:<dir>`; si se vuelve a pedir mientras está en la pila → `ERROR: ciclo en <id8>:<dir>`. Cubre autorreferencias (`=LOCAL(2)` en `[2]`), ciclos entre eventos (`A[3] = LOCAL(4)`, `A[4] = LOCAL(3)`) y ciclos a través de `ACTUAL` o `BUSCAR` (la fórmula es su propio candidato). Una relación circular entre datos sin fórmulas se navega sin error (corpus: «A→B y B→A pueden ser relaciones legítimas»).

### 9.3 Límites de cálculo: PENDIENTE POR LÍMITE

Agotar un recurso no es un fallo: es una espera explicada, `PENDIENTE POR LÍMITE` (corpus: «agotamiento de recursos puede ser PENDIENTE POR LÍMITE con parciales señalados»; mapa §2.3 lo lista entre los estados). Tres límites por evaluación, en `LIMITES`, que las opciones pueden cambiar (`{ limites: { presupuesto: 10000 } }`):

| Límite | Por defecto | Qué cuenta | Motivo |
|---|---|---|---|
| `presupuesto` | 2000 | Pasos de evaluación: cada literal, operador, comparación y función consume uno; las condiciones perezosas consumen por candidato; las fórmulas ajenas leídas por `LOCAL`/`REF`/`ACTUAL` consumen del mismo presupuesto; `CAJA` y `FRESCURA` cobran lo que examina la lectura de la base (§7.14). | `presupuesto de cálculo agotado: más de 2000 pasos`; `el alcance <a> (8 de <id8>) exige examinar al menos <k> registros y quedan <q> pasos de presupuesto` |
| `profundidad` | 100 | La anidación de una fórmula al analizarla, y las lecturas encadenadas (fórmulas que leen fórmulas, referencias que siguen referencias). Si aun así se agotara la pila de JavaScript, también para aquí. | `fórmula anidada más de 100 niveles`, `más de 100 lecturas encadenadas`, `profundidad de cálculo agotada` |
| `candidatos` | 1000 | Ocupantes de una posición en `BUSCAR` (y en `ACTUAL` fuera de FILTRAR). | `más de 1000 candidatos en <id8>:<dir>` |

Verificado: `1+1+…` con 1000 términos (1999 pasos) → `1000`; con 1001 términos (2001 pasos) → `PENDIENTE POR LÍMITE: presupuesto de cálculo agotado: más de 2000 pasos`; con 3000 términos y `presupuesto: 10000` → `3000`.

**Parciales.** No se presenta como completo lo que no se examinó entero: cuando se sabe cuánto se examinó, el resultado lleva `parcial: { examinados, de }` (en `BUSCAR`, los candidatos que caben en el límite de los que hay; en `FILTRAR`, `ORDENAR` y `SUMAR`, los candidatos ya recorridos cuando se agotó el límite). No se devuelve un valor a medias. Los valores de los límites y la forma de `parcial` son de V0: [X] decidir VG (el corpus pide además límites de tiempo, lotes y continuaciones, que no existen).

### 9.4 Fórmulas ajenas

Cuando una fórmula lee otro slot que también es fórmula (por `LOCAL`, `REF` o como candidato), la fórmula ajena se evalúa **en su propio evento y con su propio anfitrión** (su `LOCAL` lee su décupla, su `BUSCAR` busca en su posición) y **sin candidato activo** (`ctx.actual = null`): un `ACTUAL(pv)` dentro de ella es el modo «fuera». Al volver, se restaura el candidato de la fórmula que la leyó.

### 9.5 Dependencias

`dependencias` acumula `'<id>:<dirección>'` (dirección de diez dígitos) de **toda lectura de un slot** (corpus: «retener procedencia y dependencias leídas para auditoría»): literales, fórmulas y referencias, por `LOCAL`, `REF`, `ACTUAL` o como valor de un candidato, y **el propio slot** en `evaluar` cuando es fórmula. Por eso `evaluar(eje, id, [3])` de `=LOCAL(2) + 15 min`, con `[2] = '=LOCAL(1, 2) + 2 EUR'`, lista `…:3000000000`, `…:2000000000` y `…:1200000000` (el literal `'EUR 12'`). Se anota también la lectura que queda PENDIENTE (una posición sin desarrollar, o una referencia BTML a un evento que no ha llegado): es lo que hay que vigilar para recalcular. Un `REF` cuyo id no resuelve no se anota (no hay id completo que anotar). `BUSCAR` no se anota (lista ocupantes, no lee valores). Si la evaluación para, la lista contiene lo acumulado hasta la parada.

### 9.6 Autorización de lectura: PENDIENTE DE AUTORIZACIÓN

BQL no tiene modelo de permisos: la autorización es de AARPIA (mapa §12 [D]) y se evalúa aparte de la fórmula (corpus: «PENDIENTE DE AUTORIZACIÓN es estado operativo distinto de fracaso de cálculo»; «permisos y presupuestos limitan el recorrido»). Quien llama puede pasar el gancho `puedeLeer(evId, dir, indices)`: id del evento, dirección de diez dígitos y **camino exacto de índices** (una copia). La dirección sola no distingue la raíz `[]` de la posición `[0]` (las dos son `0000000000`), ni `[1]` de `[1, 0]`; los índices sí. Un gancho de dos parámetros sigue valiendo, pero entonces decide sin esa distinción.

Se le pregunta, siempre antes de exponer nada:

- en **cada lectura de un slot**: la del slot que se evalúa, las de `LOCAL`, `REF` y `ACTUAL`, la de cada candidato cuyo valor se pide, y **cada salto** de una referencia BTML que se sigue (cada salto es una lectura con su evento y su camino);
- en **cada `BUSCAR`** (y en `ACTUAL` fuera de FILTRAR): por la posición buscada y después **por cada ocupante**, antes de devolver su id, autor, `t` o procedencia: un propio por su camino exacto (en una colisión, `[1]` y `[1, 0]` por separado); un escrito por su raíz (`[]` del escrito); uno alcanzado por referencia, por **cada salto** de su cadena (`saltos` de `seguir` en `src/encaje.js`), no solo por el último.

Si alguno devuelve `false`, la consulta entera para en `PENDIENTE DE AUTORIZACIÓN` (no se devuelve la colección sin él: no se presenta como completo lo que no se examinó entero). El motivo nombra el lugar leído (`leer <id8>:<dir> (camino 1.0) …`); si el no autorizado es un escrito, nombra el lugar buscado y no el escrito (`leer un escrito anclado en <id8>:<dir> …`), para no exponer su id. [X] decidir VG: si un ocupante no autorizado debe parar la consulta (lo de hoy) o quedar fuera de la colección señalado como parcial.

**¿Autorizar una posición autoriza su subárbol?** BQL no lo supone: pregunta por el camino exacto de cada lectura, así que autorizar `[4]` no autoriza `LOCAL(4, 0)` (se pregunta por `[4, 0]`) ni los escritos anclados en subdirecciones, ni lo que alcanzan las referencias de dentro (se preguntan aparte, por ocupante y por salto). Pero el **valor** de una lectura autorizada es el contenido entero de esa posición: si es un subarray, el valor `array` lleva el subárbol propio crudo (literales, fórmulas como texto y referencias `{ ref, dir }` sin seguir). En la práctica, autorizar una posición expone su subárbol propio del payload, y nada más. [X] decidir VG: si el valor `array` debe exigir también el permiso de cada subposición (o recortarse) antes de exponerse.

Sin gancho, todo se lee: el estado nunca aparece y la fórmula «no sabe» de autorizaciones (prueba E-08). Pruebas: O-12b (lecturas, raíz frente a `[0]`) y O-12c (ocupantes, saltos, colisión, subárbol) en `test/conformidad-bql.test.js`. No es el mismo PENDIENTE DE AUTORIZACIÓN que el estado de una consolidación en el motor (`src/motor.js`), aunque se llamen igual: aquí es una lectura que espera permiso; allí, un acto que espera quien lo autorice.

---

## 10. Ejemplo completo ejecutable

Guardar como `bql-ejemplo.mjs` en la raíz del repositorio y ejecutar `node bql-ejemplo.mjs` (o, sin guardar, `node --input-type=module < bql-ejemplo.mjs` desde la raíz). Los ids que aparecen en la salida son hashes deterministas de los datos del ejemplo.

```js
// Ejemplo ejecutable de BQL V0. Guardar en la raíz del repositorio y ejecutar:
//   node bql-ejemplo.mjs
// (o, sin guardar, desde la raíz: node --input-type=module < bql-ejemplo.mjs)
import { Eje } from './src/eje.js';
import { evaluar, consultar } from './src/bql.js';

const T = '2026-11-07T15:00:00Z';
const gastaT = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });

// Génesis: la identidad «casa» recibe tokens; el foco raíz es un texto.
const eje = await Eje.genesis({ identidad: 'casa', emision: [{ token: 'T', escala: 'minuto', cantidad: 600 }], foco: 'Casa de ejemplo', t: T }); // escribir cuesta minutos

// Un registro con fórmulas en sus slots (posiciones 1–4 de la décupla).
const compra = await eje.escribir({
  autor: 'casa', sobre: eje.genesisId, t: T, movimientos: [gastaT('casa')],
  payload: [
    'Compra',                    // 0
    ['menú', 1, 'EUR 12'],       // 1 recursos: qué, cuánto, precio (literal con unidad)
    '=LOCAL(1, 2) + 2 EUR',      // 2 fórmula: lee 1.2 del anfitrión y suma
    '=LOCAL(2) + 15 min',        // 3 fórmula que lee otra fórmula: composición heterogénea
    ['pagar', 'servir'],         // 4 fábrica
  ],
});

// Tres propinas escritas en la posición 4 de la compra (sobre + en).
const p1 = await eje.escribir({ autor: 'casa', sobre: compra.id, en: '4000000000', t: T, movimientos: [gastaT('casa')], payload: '2 EUR' });
const p2 = await eje.escribir({ autor: 'casa', sobre: compra.id, en: '4000000000', t: T, movimientos: [gastaT('casa')], payload: '5 EUR' });
const p3 = await eje.escribir({ autor: 'casa', sobre: compra.id, en: '4000000000', t: T, movimientos: [gastaT('casa')], payload: '1 EUR' });

// Un registro que apunta a la compra por referencia (no copia).
const cuenta = await eje.escribir({
  autor: 'casa', sobre: compra.id, en: '1000000000', t: T, movimientos: [gastaT('casa')],
  payload: ['Cuenta', { ref: compra.id, dir: '2000000000' }, '=REF("' + compra.id.slice(0, 8) + '", "1200000000") * 2', '==no es fórmula'],
});

const muestra = (etiqueta, r) => console.log(etiqueta.padEnd(58), '→', r.estado.padEnd(12), r.texto);

console.log('--- evaluar(eje, evId, dir): el slot tal como está');
muestra('compra [1,2]  literal con unidad', evaluar(eje, compra.id, [1, 2]));
muestra('compra [2]    fórmula', evaluar(eje, compra.id, [2]));
muestra('compra [3]    fórmula sobre fórmula', evaluar(eje, compra.id, '3000000000'));
muestra('compra [7]    sin desarrollar', evaluar(eje, compra.id, [7]));
muestra('cuenta [1]    referencia (no se sigue)', evaluar(eje, cuenta.id, [1]));
muestra('cuenta [2]    REF por prefijo', evaluar(eje, cuenta.id, [2]));
muestra('cuenta [3]    texto escapado', evaluar(eje, cuenta.id, [3]));
console.log('dependencias de compra [3]:', evaluar(eje, compra.id, [3]).dependencias.map((d) => d.slice(0, 8) + '…' + d.slice(64)));

console.log('--- consultar(eje, evId, dir, formula): una fórmula suelta en el contexto de un slot');
const c = (f, dir = [4]) => muestra(f, consultar(eje, compra.id, dir, f));
c('LOCAL(1, 0)');
c('LOCAL(0)', [1, 2]);                       // anfitrión = [1] → lee [1, 0]
c('12 EUR - 2 EUR');
c('200 m + 5 EUR');
c('(200 m + 5 EUR) + 100 m');
c('(1 EUR + 2 EUR) + (3 EUR + 4 EUR)');        // los dos operandos conservan su desglose
c('2 * 12 EUR / 4');
c('12 EUR < 12 m');
c('Y(1 < 2, NO(2 > 3))');
c('BUSCAR(4)');                              // índice: camino exacto (la 4 y lo anclado en ella)
c('BUSCAR("4000000000")');                   // dirección: la colisión entera (también la 4.0)
c('CONTAR(BUSCAR(4))');
c('CONTAR(FILTRAR(BUSCAR(4), ORIGEN() = "escrito"))');
c('SUMAR(FILTRAR(BUSCAR(4), ORIGEN() = "escrito"))');
c('FILTRAR(BUSCAR(4), ACTUAL() > 1 EUR)');  // el propio es un array: INCOMPATIBLE
c('FILTRAR(FILTRAR(BUSCAR(4), ORIGEN() = "escrito"), ACTUAL() > 1 EUR)');
c('ELEGIR(ORDENAR(FILTRAR(BUSCAR(4), ORIGEN() = "escrito"), ACTUAL(), "desc"))');
c('SUMAR(ELEGIR(ORDENAR(FILTRAR(BUSCAR(4), ORIGEN() = "escrito"), ACTUAL()), 2))');
c('CONTAR(FILTRAR(BUSCAR(4), ACTUAL(0) = "pagar"))');  // un terminal no tiene posición 0: PENDIENTE
c('CONTAR(FILTRAR(BUSCAR(4), SIGNO() = "completar"))');
c('CONTAR(FILTRAR(BUSCAR(4), Y(ACUERDO() = 10, DESPLAZAMIENTO() = 0)))');
c('ACTUAL(4)');
c('ACTUAL(4, 2)');
c('ACTUAL(7)');
c('ORIGEN()');
c('LOCAL(1) + 1');
c('1 +');
c('HOLA(1)');
console.log('registros en el eje antes y después de consultar: sin efectos →', eje.orden.length);
```

Salida (Node 24.14.1, 7-11-2026):

```
--- evaluar(eje, evId, dir): el slot tal como está
compra [1,2]  literal con unidad                           → RESUELTO     12 EUR
compra [2]    fórmula                                      → RESUELTO     14 EUR (12 EUR + 2 EUR)
compra [3]    fórmula sobre fórmula                        → RESUELTO     14 EUR (12 EUR + 2 EUR) + 15 min
compra [7]    sin desarrollar                              → PENDIENTE    PENDIENTE: posición sin desarrollar
cuenta [1]    referencia (no se sigue)                     → RESUELTO     → 5819876e
cuenta [2]    REF por prefijo                              → RESUELTO     24 EUR
cuenta [3]    texto escapado                               → RESUELTO     =no es fórmula
dependencias de compra [3]: [
  '5819876e…:3000000000',
  '5819876e…:2000000000',
  '5819876e…:1200000000'
]
--- consultar(eje, evId, dir, formula): una fórmula suelta en el contexto de un slot
LOCAL(1, 0)                                                → RESUELTO     menú
LOCAL(0)                                                   → RESUELTO     menú
12 EUR - 2 EUR                                             → RESUELTO     10 EUR (12 EUR + -2 EUR)
200 m + 5 EUR                                              → RESUELTO     200 m + 5 EUR
(200 m + 5 EUR) + 100 m                                    → RESUELTO     300 m (200 m + 100 m) + 5 EUR
(1 EUR + 2 EUR) + (3 EUR + 4 EUR)                          → RESUELTO     10 EUR (1 EUR + 2 EUR + 3 EUR + 4 EUR)
2 * 12 EUR / 4                                             → RESUELTO     6 EUR
12 EUR < 12 m                                              → INCOMPATIBLE INCOMPATIBLE: magnitud en EUR y magnitud en m no se comparan
Y(1 < 2, NO(2 > 3))                                        → RESUELTO     verdadero
BUSCAR(4)                                                  → RESUELTO     4 candidatos: propio 5819876e · escrito 4c1ca012 · escrito aee8e3b3 · escrito 472af969
BUSCAR("4000000000")                                       → RESUELTO     5 candidatos: propio 5819876e · propio 5819876e · escrito 4c1ca012 · escrito aee8e3b3 · escrito 472af969
CONTAR(BUSCAR(4))                                          → RESUELTO     4
CONTAR(FILTRAR(BUSCAR(4), ORIGEN() = "escrito"))           → RESUELTO     3
SUMAR(FILTRAR(BUSCAR(4), ORIGEN() = "escrito"))            → RESUELTO     8 EUR (2 EUR + 5 EUR + 1 EUR)
FILTRAR(BUSCAR(4), ACTUAL() > 1 EUR)                       → INCOMPATIBLE INCOMPATIBLE: array y magnitud en EUR no se comparan
FILTRAR(FILTRAR(BUSCAR(4), ORIGEN() = "escrito"), ACTUAL() > 1 EUR) → RESUELTO     2 candidatos: escrito 4c1ca012 · escrito aee8e3b3
ELEGIR(ORDENAR(FILTRAR(BUSCAR(4), ORIGEN() = "escrito"), ACTUAL(), "desc")) → RESUELTO     1 candidato: escrito aee8e3b3
SUMAR(ELEGIR(ORDENAR(FILTRAR(BUSCAR(4), ORIGEN() = "escrito"), ACTUAL()), 2)) → RESUELTO     3 EUR (1 EUR + 2 EUR)
CONTAR(FILTRAR(BUSCAR(4), ACTUAL(0) = "pagar"))            → PENDIENTE    PENDIENTE: posición sin desarrollar
CONTAR(FILTRAR(BUSCAR(4), SIGNO() = "completar"))          → RESUELTO     0
CONTAR(FILTRAR(BUSCAR(4), Y(ACUERDO() = 10, DESPLAZAMIENTO() = 0))) → RESUELTO     4
ACTUAL(4)                                                  → RESUELTO     [2 posiciones]
ACTUAL(4, 2)                                               → RESUELTO     2 candidatos: propio 5819876e · escrito 4c1ca012
ACTUAL(7)                                                  → PENDIENTE    PENDIENTE: sin candidatos en la posición 7
ORIGEN()                                                   → ERROR        ERROR: ORIGEN solo dentro de FILTRAR u ORDENAR
LOCAL(1) + 1                                               → INCOMPATIBLE INCOMPATIBLE: array y numero no se suman
1 +                                                        → ERROR        ERROR: fórmula incompleta
HOLA(1)                                                    → ERROR        ERROR: función desconocida: HOLA
registros en el eje antes y después de consultar: sin efectos → 6
```

---

## 11. Lo que NO existe todavía (pendiente)

| Pendiente | Hoy |
|---|---|
| Variables, asignación, efectos, publicación desde BQL | No hay. `ELEGIR` no publica; consolidar y ejecutar viven en `src/motor.js` (fábrica, PV4), fuera de BQL. |
| Modelo de permisos de lectura | BQL solo pregunta al gancho `puedeLeer` (§9.6); quién puede leer qué es de AARPIA. |
| Límites de tiempo, lotes y continuaciones, caché y foto estable (snapshot) del eje (corpus, evaluación segura) | No hay. Los límites son presupuesto, profundidad y candidatos (§9.3). |
| Condicional (`SI`), `MIN`, `MAX`, `PROMEDIO`, funciones de texto, concatenación | No hay. |
| Fechas, tiempo, PV6/PV7 en fórmulas | No hay tipo fecha (el corpus no fija su sintaxis: [X] decidir VG); `t` del candidato no es accesible desde BQL. |
| Operaciones matriciales de PV8 y familias de operadores por PV (V4) | No hay. |
| Conversión de unidades (`EUR` ↔ `€`, `min` ↔ `minuto`, `m` ↔ `km`) | Las unidades son etiquetas literales, sensibles a mayúsculas; distintas → composición. |
| `BUSCAR` sobre todo el eje | `BUSCAR` (por índice o por dirección) solo mira el evento de la fórmula (propios, referencias alcanzadas, escritos anclados). Si debe recorrer todos los eventos accesibles que declaran la posición o solo los que el árbol enlaza sigue abierto (mapa §8; O-23): [X] decidir VG. |
| Dónde cae un escrito en una búsqueda por índice (el mapa §12 [D] fija «índice = camino exacto» y «dirección = colisión entera», no esto) | El escrito se toma en el camino de su dirección de anclaje sin ceros finales (`indicesDe`), como toda dirección: los anclados en `1000000000` salen en `BUSCAR(1)` y no en `BUSCAR(1, 0)` (§7.4): [X] decidir VG. |
| Ocupante no autorizado en `BUSCAR` | Para la consulta entera en PENDIENTE DE AUTORIZACIÓN; la alternativa sería dejarlo fuera señalado como parcial (§9.6): [X] decidir VG. |
| Permiso del subárbol en un valor `array` | Autorizar una posición expone su subárbol propio (el valor lleva el subarray crudo); no se pregunta por cada subposición (§9.6): [X] decidir VG. |
| Cantidad > 1 de `ACTUAL` dentro de FILTRAR/ORDENAR (corpus: abierto) | PENDIENTE (§7.5): [X] decidir VG. |
| Comparar composiciones heterogéneas (corpus: abierto) | INCOMPATIBLE (§6.4): [X] decidir VG. |
| Un camino de más de diez profundidades (decidido en la integración del 7-11, sin revisar) | PENDIENTE `posición sin desarrollar: más de diez profundidades` (§8), como hace la PR #36; la #43 pedía ERROR. Las dos evitan el `RangeError`: [X] decidir VG. |
| Lectura absoluta dentro del propio registro con `LOCAL` o `ACTUAL` (§7.1) | Solo `BUSCAR` por dirección la da; [X] decidir VG si `LOCAL` y `ACTUAL` la admiten también. |
| Elegir el último por llegada (el escrito más reciente, la última corrección) o por `t` | No hay: `"desc"` no invierte los empates, no hay `ULTIMO` ni `INVERTIR`, y ni la llegada ni `t` son accesibles (§7.7). [X] decidir VG: que el desempate por llegada deje delante lo más reciente (corregir es añadir un ocupante), una función para el último, o que `"desc"` invierta también los empates. |
| Valor del candidato elegido de una colección cualquiera (p. ej. de `ELEGIR(ORDENAR(…))`) | No hay función: `ACTUAL(pv)` da el valor del primero de `BUSCAR(pv)` en su orden por defecto; para otra colección, desde JavaScript `valor.items[0]`, o `SUMAR` de una colección de un ítem (§12.3, un defecto, no una vía). |
| Reglas por dimensión para el signo (corpus V4: «solo cuenta si la regla de esa dimensión lo permite») y profundidades ordinales por época | El signo se calcula siempre y solo informa; ninguna regla lo filtra. Ni signo ni distancia ordenan mientras ninguna época declare una profundidad ordinal (la época 0 no lo hace). |
| `ORDENAR` con varias claves; orden por encaje explícito | Una clave; el orden por encaje es el de `BUSCAR` por defecto. |
| `Y`/`O` perezosos (cortocircuito) | Evalúan todos los argumentos. |
| `CAJA`/`FRESCURA` (y `BASES`) de un candidato dentro de `FILTRAR`/`ORDENAR` | El anfitrión es siempre el registro de la fórmula (§7.14): [X] decidir VG si dentro debe ser el candidato. |
| Vigilar la llegada de hijos (lo que cambia `FRESCURA`) | Las dependencias nombran el 8 leído, la base y el anfitrión, no «los hijos de»: [X] decidir VG. |
| Medir al anfitrión con el gancho de quien consulta | La medida evalúa sus fórmulas sin gancho; con gancho, ni `CAJA` ni `BASES` dan las dos medidas de fórmulas del anfitrión (§7.14): [X] decidir VG. |
| Mediana, cuantiles, correlaciones (lo no fundible; mapa §12: «se aproxima o se descarta») | No hay. La forma B de `BASES` daba una mediana aproximada desde las cajas (§7.14): [X] decidir VG qué firma queda. |
| Comparación encadenada (`1 < x < 3`) | `SyntaxError`. |
| Literales booleanos, comillas simples, exponentes, `.5`, unidades con `/` | No hay. (Las unidades con acentos y `ñ`, `día`, `año`, sí: §4.1.) |
| Identificadores estables de operadores e idioma, llamadas por hash, matrices tipadas, política de candidatos pendientes (mapa §2.3 «abierto») | No hay. Los nombres son los españoles en mayúsculas de §7.0. |
| Acceso desde BQL a `autor`, `t`, `procedencia`, `vector` completo del candidato | Solo lo que exponen las seis funciones de §7.11; el resto está en `valor.items[k]` desde JavaScript. |

---

## 12. Límites y defectos observados (pendiente, no corregidos aquí)

1. `1e3` se analiza como magnitud `1 e3` (no hay notación exponencial).
2. `1 / 0` devuelve numero `Infinity` (texto `Infinity`), sin parada.
3. `SUMAR` de una colección con un solo candidato devuelve su valor aunque no sea sumable (un `array`, un `texto`).
4. `evaluar` no sigue una referencia en un slot literal (devuelve `referencia`); `LOCAL`/`REF`/`ACTUAL` sí la siguen. Un camino de índices no entra en el evento referenciado (§3).
5. Una dirección en texto no puede nombrar un índice 0 real final (`'1000000000'` es `[1]`, no `[1, 0]`); usar arrays de índices. En `BUSCAR` eso es lo decidido (mapa §12 [D]): `BUSCAR("1000000000")` nombra la colisión entera; `BUSCAR(1)` y `BUSCAR(1, 0)`, cada una su camino exacto.
6. El tercer argumento de `ORDENAR` distinto del texto `desc` se ignora en silencio.
7. Una referencia BTML rota (`{ ref: 'nadie' }`) aparece como candidato `referencia nadie` en `BUSCAR` y da `PENDIENTE: evento ausente del eje: nadie` al leer su valor.
8. La resta de magnitudes se muestra con el sumando negativo en el desglose (`10 EUR (12 EUR + -2 EUR)`).
9. Una cadena de diez dígitos en un slot es texto (dirección), no número: `'1234567890' + 1` es INCOMPATIBLE. Un número JS de diez cifras sí es número.
10. `SUMAR` de una colección vacía es el numero `0` sin unidad, así que no se suma con una magnitud: `SUMAR(FILTRAR(BUSCAR(4), ORIGEN() = "escrito")) + 1 EUR` sobre el eje de ejemplo (sin escritos en la 4) es INCOMPATIBLE.
11. La medida del anfitrión de `CAJA` (y de `BASES` cuando lo sitúa: `medir` en `src/bases.js`, la única medida) evalúa sus fórmulas con `evaluar` sin opciones: sin el gancho `puedeLeer` y con los límites por defecto, en un cálculo aparte que no gasta el presupuesto de la consulta. Por eso, con gancho, ni `CAJA` ni `BASES` dan las medidas de fórmulas del anfitrión (§7.14).
12. `FRESCURA` no ve que un registro ya medido cambie (escritos nuevos encima, fórmulas que se resuelven): solo cuenta llegadas (§7.14). `0` no es «al día»: eso lo dice `comprobar()`.
13. Lo que se guarda en el 8 depende del 8 anterior por las fórmulas que leen el 8 sin situar a su registro (`FRESCURA`, `BASES` sin medida o con un dato de la base): la primera base las cuenta como pendientes y la siguiente como resueltas, sin que llegue nada (§7.14).

Corregidos en esta versión (estaban aquí): las funciones sin el argumento que esperan (`NO()`, `CONTAR()`…) ya devuelven `ERROR: <FN> espera un argumento`/`una colección` en vez de lanzar `TypeError`; `=`/`<>` entre tipos o unidades distintos ya son INCOMPATIBLE (antes comparaban el texto formateado); `ORDENAR` con claves mezcladas ya es INCOMPATIBLE (antes ordenaba sin definir); más de diez índices ya no lanza `RangeError`; una anidación muy honda ya no revienta la pila; la suma ya no aplana el operando derecho (`(1 EUR + 2 EUR) + (3 EUR + 4 EUR)` daba `10 EUR (1 EUR + 2 EUR + 7 EUR)`, §6.1); el gancho `puedeLeer` ya recibe el camino exacto y se aplica por ocupante y por salto (§9.6); `BUSCAR(índice)` ya es camino exacto (§7.4).
