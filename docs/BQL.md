# BQL V0 — referencia para programar

BQL es la lógica de vistas de AGRAM: fórmulas que viven dentro de un slot BTML y se evalúan sin efectos. Este documento describe **lo que existe hoy en `src/bql.js`**, con firmas, tablas y ejemplos ejecutados con Node 24 desde la raíz del repositorio. Lo que no existe se marca «pendiente». Fuente de verdad: `src/bql.js`, `test/bql.test.js`, `test/bql-colecciones.test.js`, `test/vector.test.js`.

Vocabulario mínimo: un **evento** tiene un `payload` BTML (terminal, o array de 1 a 10 posiciones sin huecos; las posiciones contienen terminales, subarrays o referencias `{ ref, dir? }`). Una **dirección** es una cadena de diez dígitos (`'1200000000'` = índices `[1, 2]`; los ceros finales no cuentan). La **décupla** es el array desarrollado en sus posiciones 0–9. El **eje** (`src/eje.js`) guarda los eventos; `eje.obtener(id)`, `eje.orden`, `eje.sobre(id, dir)`.

---

## 1. Módulo y firmas

```js
import { esFormula, desescapar, analizar, evaluar, consultar, formato, ESTADOS } from './src/bql.js';
```

| Export | Firma | Qué hace |
|---|---|---|
| `esFormula(x)` | `(any) → boolean` | `true` si `x` es una cadena que empieza por un solo `=`. |
| `desescapar(x)` | `(any) → any` | Si `x` es cadena y empieza por `==`, quita **un** `=`. Si no, devuelve `x`. |
| `analizar(src)` | `(string) → Nodo` | Analiza una fórmula **sin** el `=` inicial y devuelve el árbol (§4.3). Lanza `SyntaxError`. |
| `evaluar(eje, evId, dir)` | `(Eje, string, string\|number[]) → Resultado` | Evalúa el slot `dir` del evento `evId`. Si el slot no es fórmula, devuelve su valor tal cual (§3). |
| `consultar(eje, evId, dir, formula)` | `(Eje, string, string\|number[], string) → Resultado` | Evalúa una fórmula suelta (con o sin `=` inicial) como si estuviera en el slot `dir` de `evId`. |
| `formato(valor)` | `(Valor) → string` | Texto de un valor BQL (§5). |
| `ESTADOS` | `['RESUELTO', 'PENDIENTE', 'INCOMPATIBLE', 'ERROR']` | Lista congelada. |

`dir` admite dos formas: una dirección de diez dígitos (`'1200000000'`) o un array de índices (`[1, 2]`). La dirección se convierte con `indicesDe`, que quita los ceros finales: `'0000000000'` es la raíz (`[]`) y `'1000000000'` es `[1]`. Límite conocido: una dirección en texto no puede nombrar un índice 0 real al final del camino; para la posición 0 se usa el array (`[0]`, `[1, 0]`).

**Resultado** (siempre un objeto, nunca una excepción salvo los defectos de §12):

| Campo | Tipo | Presente | Contenido |
|---|---|---|---|
| `estado` | `string` | siempre | `'RESUELTO'`, `'PENDIENTE'`, `'INCOMPATIBLE'` o `'ERROR'`. |
| `valor` | `Valor` | solo RESUELTO | El valor BQL (§5). |
| `motivo` | `string` | solo no RESUELTO | Mensaje exacto (§8). |
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
| cadena `'12 EUR'`, `'EUR 12'`, `'-3 EUR'`, `'12.5 m'` | `magnitud` (número y unidad, en cualquier orden, separados o no por espacios) | `'12 EUR'` |
| cadena `'7'`, `'-3'`, `'1.5'` | `numero` | `'7'` |
| cadena `'==x'` | `texto` `=x` | `'=x'` |
| cualquier otra cadena | `texto` | la cadena |

Unidad admitida en un literal de slot: primer carácter `A–Z a–z € $ %`, luego letras ASCII, dígitos, `_`, `€`, `$`, `%`. `'12 año'` no es magnitud (la `ñ` no entra): es texto.

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
| identificador | `[A-Za-z_][\w€$%]*` o `[€$%]` | `LOCAL`, `EUR`, `m`, `€`, `%` | ASCII; `ñ`, acentos y `/` no entran. |
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

`analizar` no valida nombres de función ni número de argumentos: `HOLA(1)` analiza bien y falla al evaluar (`ERROR: función desconocida: HOLA`).

---

## 5. Tipos de valor

Todo valor BQL es un objeto con `tipo`:

| `tipo` | Forma | `formato` | Ejemplo de `texto` |
|---|---|---|---|
| `numero` | `{ valor: number }` | redondeado a 3 decimales | `0.333`, `-6`, `Infinity` |
| `texto` | `{ valor: string }` | la cadena | `hola` |
| `booleano` | `{ valor: boolean }` | `verdadero` / `falso` | `verdadero` |
| `magnitud` | `{ cantidad, unidad, desglose: [{ cantidad, unidad }, …] }` | `cantidad unidad`, y entre paréntesis el desglose si tiene más de un sumando | `14 EUR (12 EUR + 2 EUR)` |
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

Siempre devuelven `booleano`.

| Pareja | `=` / `<>` | `<` `>` `<=` `>=` |
|---|---|---|
| numero, numero | por valor | por valor |
| magnitud, magnitud, **misma unidad** | por cantidad | por cantidad |
| texto, texto | por valor | orden de cadenas de JavaScript |
| booleano, booleano | por valor | orden `false < true` |
| cualquier otra pareja (tipos distintos, o magnitudes de unidad distinta) | compara `formato(a) === formato(b)` | **INCOMPATIBLE** `<a> y <b> no se comparan` |

Consecuencias verificadas de la última fila: `1 = "1"` → verdadero; `12 EUR = "12 EUR"` → verdadero; `12 EUR = 12 m` → falso; `12 EUR < 12 m` → INCOMPATIBLE; dos arrays de la misma longitud son «iguales» (`[2 posiciones]`); `1 < "a"` → INCOMPATIBLE.

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
| `BUSCAR(i, j, …)` | 1 o más índices 0–9 | coleccion de candidatos de la posición `[…anfitrión, i, j, …]` | siempre |
| `ACTUAL(pv, cantidad?)` | fuera de FILTRAR/ORDENAR: índice 0–9 y entero ≥ 1 (1 por defecto) | valor del primer candidato (cantidad 1) o coleccion de los `cantidad` primeros | fuera |
| `ACTUAL(k, …)` | dentro: 0 o más índices 0–9 | valor del candidato iterado, o de su subposición | dentro |
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

«Dentro» = mientras se evalúa el segundo argumento de `FILTRAR` o de `ORDENAR`. Fuera, las seis funciones de encaje dan `ERROR: <NOMBRE> solo dentro de FILTRAR u ORDENAR`.

### 7.1 El anfitrión

Toda fórmula se evalúa en un slot `base` (los índices del slot). El **anfitrión** es `base.slice(0, -1)`: la décupla que contiene el slot. `LOCAL`, `BUSCAR` y `ACTUAL(pv)` resuelven sus índices **relativos al anfitrión**.

| Slot de la fórmula (`dir` de `evaluar`/`consultar`) | Anfitrión | `LOCAL(0)` lee | `BUSCAR(4)` busca en |
|---|---|---|---|
| `[2]` o `'2000000000'` | `[]` (raíz) | `[0]` | `[4]` |
| `[1, 2]` | `[1]` | `[1, 0]` | `[1, 4]` |
| `[]` o `'0000000000'` | `[]` | `[0]` | `[4]` |

En `consultar`, `dir` solo sirve para fijar el anfitrión (la fórmula no tiene que existir en ese slot). Si el evento no existe, `consultar` solo falla cuando la fórmula lo lee (`LOCAL`, `BUSCAR`…): `consultar(eje, 'zzz', [1], '1')` es RESUELTO `1`.

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

- `id`: texto. Se quita un `@` inicial. Se busca en `eje.orden` por **prefijo**: exactamente un evento debe empezar por él; si ninguno, `ERROR: referencia desconocida: <p>`; si varios, `ERROR: referencia ambigua: <p>`.
- `dir`: texto de exactamente diez dígitos; si falta, la raíz (el payload entero). Otra cosa → `ERROR: REF espera una dirección de diez dígitos`. Si `id` no es texto → `ERROR: REF espera un id entre comillas`.
- Añade `<id>:<dir>` a `dependencias` y lee el slot como `LOCAL` (sigue fórmulas y referencias).

| Fórmula | `estado` | `texto` |
|---|---|---|
| `REF("<menu.id>")` | RESUELTO | `[3 posiciones]` |
| `REF("<8 primeros del id>", "1100000000")` | RESUELTO | `guiso` |
| `REF("@<8 primeros>", "1000000000")` | RESUELTO | `[3 posiciones]` |
| `REF("<id>", "7000000000")` (posición no desarrollada) | PENDIENTE | `PENDIENTE: posición sin desarrollar` |
| `REF("<id>", "1")` | ERROR | `ERROR: REF espera una dirección de diez dígitos` |
| `REF(1)` | ERROR | `ERROR: REF espera un id entre comillas` |
| `REF("zzz")` | ERROR | `ERROR: referencia desconocida: zzz` |

### 7.4 `BUSCAR(i, j, …)`

Devuelve la **coleccion de ocupantes** de la posición `[…anfitrión, i, j, …]` del evento de la fórmula, calculada por `ocupantes` (`src/encaje.js`). No registra nada. La dirección se forma con `direccion(indices)`, por lo que `BUSCAR(1)` y `BUSCAR(1, 0)` nombran la misma dirección `1000000000` y devuelven la misma colección (colisión por ceros).

Ocupantes, en orden de llegada:

1. **propio**: cada camino del propio payload que colisiona en la dirección (`[1]`, y si `[1]` es un array con posición 0, también `[1, 0]`, `[1, 0, 0]`…).
2. **referencia**: justo detrás de cada propio que es una referencia, lo que esa referencia alcanza (siguiendo cadenas, hasta 20 saltos).
3. **escrito**: los eventos con `sobre = <este evento>` y `en = <la dirección>`, en orden de entrada en el eje.

Orden por defecto (**encaje**, `ordenarPorEncaje`): más profundidades de acuerdo primero; a igual acuerdo, menor distancia profundidad a profundidad; a igual distancia, orden de llegada. El signo no ordena.

**Estructura de un candidato** (`valor.items[k]`):

| Campo | Tipo | Contenido |
|---|---|---|
| `origen` | `'propio'` \| `'referencia'` \| `'escrito'` | Procedencia. |
| `evento` | string | Id del evento donde vive el valor (propio: el anfitrión; referencia: el evento alcanzado; escrito: el hijo). |
| `indices` | number[] | Camino dentro de `evento` (propio: el camino exacto, p. ej. `[4, 0]`; referencia: la posición alcanzada; escrito: `[]`, su payload entero). |
| `procedencia` | string[] | Cadena de lugares: `'<id>:<dir>#<camino>'` para propios, `'<id>:<dir>'` para referencias y escritos. |
| `autor`, `t` | string | Solo en escritos; `undefined` en los demás. |
| `vector` | number[10] | `destino − origen`, dígito a dígito. |
| `distancia` | number[10] | `|vector|` por profundidad. |
| `acuerdo` | 0–10 | Profundidades iniciales con diferencia 0. |
| `signo` | texto | `exacto` (todo 0), `completar` (solo positivos), `reducir` (solo negativos), `mixto`. |
| `faltas`, `excedentes` | number | Profundidades con diferencia positiva / negativa. |
| `origenDir`, `destino` | string | Direcciones de diez dígitos. |

Origen del vector según el tipo: propio → `origenDir = destino` (vector todo ceros, `exacto`, acuerdo 10); escrito → `origenDir = '0000000000'` (el hijo nace en su raíz y se le coloca en `destino`: para `destino = '4000000000'`, vector `[4, 0, …]`, `completar`, faltas 1, acuerdo 0, desplazamiento 4); referencia → `origenDir` = la dirección alcanzada en el otro registro (una referencia a `7000000000` colocada en `[2]` da vector `[-5, 0, …]`, `reducir`, excedentes 1; una referencia a `1000000000` colocada en `[1]` es `exacto`).

El valor de un candidato (lo que leen `ACTUAL()`, `SUMAR`, `ORDENAR`) es `leerSlot(evento, indices)`: sigue fórmulas y referencias; un escrito terminal da su terminal; un propio array da un `array`.

Verificado (escenario de `test/bql-colecciones.test.js`: compra con `[4] = ['pagar', 'servir']` y tres propinas escritas en `4000000000`):

| Fórmula (slot `[4]` de la compra) | `estado` | `texto` |
|---|---|---|
| `BUSCAR(4)` | RESUELTO | `5 candidatos: propio f9e59d1e · propio f9e59d1e · escrito d567acc1 · escrito 59bd2354 · escrito 9a726a75` |
| `BUSCAR(4, 0)` | RESUELTO | los mismos 5 (misma dirección) |
| `BUSCAR(7)` | RESUELTO | `0 candidatos` |
| `BUSCAR()` | ERROR | `ERROR: BUSCAR espera una posición` |
| `BUSCAR(1)` (compra: `[1, 0]` es referencia al menú; la cuenta está escrita en `1000000000`) | RESUELTO | `4 candidatos: propio f9e59d1e · propio f9e59d1e · referencia 4598f23e · escrito c70bfa6e` |

Los ocho caracteres son los primeros del id (hash SHA-256 del evento); con los mismos datos y el mismo `t` salen siempre los mismos.

### 7.5 `ACTUAL`

Dos modos, según si hay candidato iterado (`ctx.actual`):

**Fuera de FILTRAR/ORDENAR — `ACTUAL(pv, cantidad?)`**: la colección activa de la posición `[…anfitrión, pv]` (igual que `BUSCAR(pv)`), limitada a `cantidad` (1 por defecto). `cantidad` nunca significa profundidad.

| Caso | Resultado |
|---|---|
| `ACTUAL(pv)` o `ACTUAL(pv, 1)` | el **valor** del primer candidato (no una colección): `ACTUAL(4)` → `[2 posiciones]` |
| `ACTUAL(pv, n)` con `n ≥ 2` | coleccion con los `n` primeros (o menos si no hay tantos): `ACTUAL(4, 2)` → `2 candidatos: propio … · propio …`; `CONTAR(ACTUAL(4, 99))` → `5` |
| sin candidatos | PENDIENTE `sin candidatos en la posición <pv>` |
| `ACTUAL()` | ERROR `ACTUAL fuera de FILTRAR espera una posición` |
| `ACTUAL(1, 0)`, `ACTUAL(1, 1.5)` | ERROR `ACTUAL espera una cantidad entera ≥ 1` |
| `=ACTUAL(1)` escrito en el slot `[1]` | ERROR `ciclo en …` (el primer candidato de `[1]` es la propia fórmula) |

**Dentro — `ACTUAL(k, …)`**: `ACTUAL()` es el valor del candidato iterado; `ACTUAL(k, …)` es el valor de su subposición `[…candidato.indices, k, …]`. Aquí `ACTUAL(1, 2)` significa la subposición `[1, 2]` del candidato, no «cantidad 2». Si la subposición no existe (p. ej. `ACTUAL(0)` sobre un escrito terminal), la parada es PENDIENTE y **la consulta entera queda PENDIENTE**: un dato faltante no se convierte en falso.

### 7.6 `FILTRAR(col, cond)`

- `col` debe ser coleccion; si no, INCOMPATIBLE `FILTRAR espera una colección, no <tipo>`.
- `cond` es **perezosa**: se evalúa una vez por candidato con `ctx.actual = candidato`. Debe dar booleano; si no, INCOMPATIBLE `FILTRAR espera verdadero o falso, no <tipo>`. Falta `cond` → ERROR `FILTRAR espera una condición`.
- Dentro de `cond`: `ACTUAL` es el candidato; `LOCAL` **sigue siendo el anfitrión**; `BUSCAR` sigue buscando en el anfitrión; `ORIGEN()` y las funciones de encaje describen al candidato.
- Cualquier parada en un candidato (PENDIENTE, INCOMPATIBLE, ERROR) para toda la consulta con ese estado.
- `FILTRAR` anidado: el `ACTUAL` interior es el candidato interior; al salir se restaura el exterior.

| Fórmula (slot `[4]` de la compra) | `estado` | `texto` |
|---|---|---|
| `CONTAR(FILTRAR(BUSCAR(4), ORIGEN() = "escrito"))` | RESUELTO | `3` |
| `CONTAR(FILTRAR(BUSCAR(4), ORIGEN() = "propio"))` | RESUELTO | `2` |
| `CONTAR(FILTRAR(FILTRAR(BUSCAR(4), ORIGEN() = "escrito"), ACTUAL() > 1 EUR))` | RESUELTO | `2` |
| `FILTRAR(BUSCAR(4), ACTUAL() > 1 EUR)` (el primer candidato es el array propio) | INCOMPATIBLE | `INCOMPATIBLE: array y magnitud en EUR no se comparan` |
| `CONTAR(FILTRAR(BUSCAR(4), ACTUAL(0) = "pagar"))` (los escritos son terminales: sin posición 0) | PENDIENTE | `PENDIENTE: posición sin desarrollar` |
| `CONTAR(FILTRAR(BUSCAR(4), LOCAL(0) = "Compra del menú del día"))` | RESUELTO | `5` |
| `FILTRAR(BUSCAR(4), 1)` | INCOMPATIBLE | `INCOMPATIBLE: FILTRAR espera verdadero o falso, no numero` |
| `FILTRAR(1, 1 < 2)` | INCOMPATIBLE | `INCOMPATIBLE: FILTRAR espera una colección, no numero` |
| `CONTAR(FILTRAR(BUSCAR(4), FALTAS() = 1))` | RESUELTO | `3` |
| `CONTAR(FILTRAR(BUSCAR(4), Y(ACUERDO() = 10, DESPLAZAMIENTO() = 0)))` | RESUELTO | `2` |

### 7.7 `ORDENAR(col, expr, "desc"?)`

- `col` coleccion (si no, INCOMPATIBLE). `expr` perezosa, evaluada por candidato como en `FILTRAR`; falta → ERROR `ORDENAR espera una expresión`.
- Clave de orden según el tipo del resultado de `expr`: numero → su valor; magnitud → su **cantidad** (la unidad se ignora); texto → la cadena; cualquier otro → `formato(valor)`.
- Ascendente con `<`/`>` de JavaScript; orden estable (los empates conservan el orden de entrada, que por defecto es el de encaje). Tercer argumento: el texto `desc` en cualquier combinación de mayúsculas invierte; cualquier otro valor se ignora en silencio (ascendente).
- No tiene efectos: devuelve una colección nueva.

| Fórmula (slot `[4]`; propinas 2, 5 y 1 EUR escritas en ese orden) | `texto` |
|---|---|
| `ORDENAR(FILTRAR(BUSCAR(4), ORIGEN() = "escrito"), ACTUAL())` | `3 candidatos: escrito 9a726a75 · escrito d567acc1 · escrito 59bd2354` (1, 2, 5 EUR) |
| `ORDENAR(FILTRAR(BUSCAR(4), ORIGEN() = "escrito"), ACTUAL(), "desc")` | `3 candidatos: escrito 59bd2354 · escrito d567acc1 · escrito 9a726a75` (5, 2, 1 EUR) |
| `ORDENAR(BUSCAR(4), ORIGEN())` | escritos antes que propios (orden alfabético de `escrito` < `propio`) |
| `ORDENAR(BUSCAR(4), DESPLAZAMIENTO(), "desc")` | los tres escritos (4) antes que los dos propios (0) |

### 7.8 `ELEGIR(col, k?)`

Los `k` primeros candidatos de `col` como coleccion (1 por defecto; si hay menos, los que haya; sobre una colección vacía, `0 candidatos`). `k` no entero o < 1 → ERROR `ELEGIR espera una cantidad entera ≥ 1`. `col` no coleccion → INCOMPATIBLE. **No publica nada**: elegir de verdad es consolidar en la fábrica (`src/motor.js`), fuera de BQL.

`ELEGIR(ORDENAR(FILTRAR(BUSCAR(4), ORIGEN() = "escrito"), ACTUAL(), "desc"))` → `1 candidato: escrito 59bd2354` (la propina de 5 EUR); `…, 2)` → `2 candidatos: escrito 59bd2354 · escrito d567acc1`.

### 7.9 `CONTAR(col)`

Número de candidatos. `CONTAR(BUSCAR(9))` → `0`. Argumento no coleccion → INCOMPATIBLE `CONTAR espera una colección, no <tipo>`.

### 7.10 `SUMAR(col)`

Suma los valores de los candidatos, en orden, con la regla de `+` (§6.1): números con números; magnitudes con desglose; unidades distintas → composicion. Colección vacía → numero `0`. Un solo candidato → su valor **sin comprobar el tipo** (`SUMAR` de una colección con un único escrito que es un array devuelve ese `array`). Mezclas que `+` no admite → INCOMPATIBLE (`SUMAR(BUSCAR(4))` sobre la compra → `INCOMPATIBLE: array y texto no se suman`, porque el primer propio es `['pagar', 'servir']` y el segundo es `'pagar'`).

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
| `SIGNO()` | texto `exacto` / `completar` / `reducir` / `mixto` | `signo` (`exacto` si falta) |
| `ACUERDO()` | numero 0–10 | `acuerdo` (10 si falta) |
| `DESPLAZAMIENTO()` | numero: Σ \|vector[k]\| | `vector` (0 si falta) |
| `FALTAS()` | numero: profundidades con diferencia > 0 | `faltas` (0 si falta) |
| `EXCEDENTES()` | numero: profundidades con diferencia < 0 | `excedentes` (0 si falta) |

Verificado sobre la compra con la cuenta escrita en `1000000000` (`test/vector.test.js`, slot `[1]`): `CONTAR(FILTRAR(BUSCAR(1), SIGNO() = "exacto"))` → `3` (`[1]`, `[1, 0]` y la referencia al menú); `… SIGNO() = "completar"` → `1` (la cuenta); `… FALTAS() = 1` → `1`; `… DESPLAZAMIENTO() > 0` → `1`; `… ACUERDO() = 10` → `3`.

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

---

## 8. Estados y qué los provoca

La evaluación se detiene en la primera parada; el estado de la consulta es el de esa parada. Un `SyntaxError` del análisis se convierte en ERROR con `dependencias: []`.

| Estado | Motivo exacto | Cuándo |
|---|---|---|
| RESUELTO | — | Hay valor. |
| PENDIENTE | `posición sin desarrollar` | Se lee una posición que no existe, o un camino que atraviesa un terminal o una referencia (en `evaluar`, `LOCAL`, `REF`, `ACTUAL`, valor de un candidato, subposición de un candidato). |
| PENDIENTE | `sin candidatos en la posición <pv>` | `ACTUAL(pv, …)` fuera de FILTRAR sobre una posición sin ocupantes. |
| INCOMPATIBLE | `<a> y <b> no se suman` / `no se multiplican` / `no se dividen` / `no se comparan` | Operador entre tipos que no operan (§6). `<a>` es el tipo, o `magnitud en <unidad>`. |
| INCOMPATIBLE | `no se niega <tipo>` | `-` unario sobre algo que no es numero ni magnitud. |
| INCOMPATIBLE | `<FN> espera verdadero o falso, no <tipo>` | Condición de `FILTRAR` o argumento de `Y`/`O`/`NO` no booleano. |
| INCOMPATIBLE | `<FN> espera una colección, no <tipo>` | Primer argumento de `FILTRAR`, `ORDENAR`, `ELEGIR`, `CONTAR`, `SUMAR` no es coleccion. |
| ERROR | `carácter inesperado en <n>: …`, `se esperaba <x> en el token <n>`, `fórmula incompleta`, `identificador suelto: <x>`, `token inesperado: <x>`, `sobra: <x>` | Sintaxis (§4). |
| ERROR | `función desconocida: <NOMBRE>` | Nombre no listado en §7.0. |
| ERROR | `ciclo en <id8>:<dir>` | Un slot con fórmula se vuelve a leer mientras se está evaluando (autorreferencia, ciclo entre eventos, `=ACTUAL(1)` en `[1]`). |
| ERROR | `presupuesto agotado` | Más de 2000 nodos evaluados en una consulta (§9.3). |
| ERROR | `evento desconocido: <id8>` | `evaluar`/`LOCAL`/`BUSCAR` sobre un id que no está en el eje, o una referencia BTML rota (`{ ref: 'nadie' }`) leída desde una fórmula o como candidato. |
| ERROR | `referencia desconocida: <p>` / `referencia ambigua: <p>` | `REF` con prefijo que no resuelve a exactamente un evento. |
| ERROR | `LOCAL espera al menos un índice`, `<FN> espera índices 0–9`, `REF espera un id entre comillas`, `REF espera una dirección de diez dígitos`, `BUSCAR espera una posición`, `ACTUAL fuera de FILTRAR espera una posición`, `ACTUAL espera una cantidad entera ≥ 1`, `FILTRAR espera una condición`, `ORDENAR espera una expresión`, `ELEGIR espera una cantidad entera ≥ 1`, `<FN> solo dentro de FILTRAR u ORDENAR` | Argumentos mal formados (§7). |

Propagación: una parada dentro de la condición de `FILTRAR`, de la expresión de `ORDENAR`, de un argumento de `Y`/`O`/`NO` o de un valor leído por `SUMAR` para **toda** la consulta (no se salta el candidato ni se interpreta como falso).

---

## 9. Evaluación segura

### 9.1 Sin efectos

`evaluar` y `consultar` no escriben en el eje ni mueven tokens: `eje.orden.length` y los saldos son iguales antes y después (`test/bql.test.js`, «la evaluación no tiene efectos»). `BUSCAR`, `FILTRAR`, `ORDENAR`, `ELEGIR` devuelven colecciones nuevas; nada se registra.

### 9.2 Pila de ciclos

Cada slot con fórmula que se evalúa entra en una pila con clave `<id>:<dir>`; si se vuelve a pedir mientras está en la pila → `ERROR: ciclo en <id8>:<dir>`. Cubre autorreferencias (`=LOCAL(2)` en `[2]`), ciclos entre eventos (`A[3] = LOCAL(4)`, `A[4] = LOCAL(3)`) y ciclos a través de `ACTUAL` o `BUSCAR` (la fórmula es su propio candidato).

### 9.3 Presupuesto

Cada evaluación (`evaluar` o `consultar`) dispone de **2000 nodos**: cada literal, operador, comparación y función consumen uno; las condiciones perezosas consumen por candidato; las fórmulas ajenas leídas por `LOCAL`/`REF`/`ACTUAL` consumen del mismo presupuesto. Al pasarse → `ERROR: presupuesto agotado`. Verificado: `1+1+…` con 1000 términos (1999 nodos) → `1000`; con 1001 términos (2001 nodos) → `ERROR: presupuesto agotado`.

### 9.4 Fórmulas ajenas

Cuando una fórmula lee otro slot que también es fórmula (por `LOCAL`, `REF` o como candidato), la fórmula ajena se evalúa **en su propio evento y con su propio anfitrión** (su `LOCAL` lee su décupla, su `BUSCAR` busca en su posición) y **sin candidato activo** (`ctx.actual = null`): un `ACTUAL(pv)` dentro de ella es el modo «fuera». Al volver, se restaura el candidato de la fórmula que la leyó.

### 9.5 Dependencias

`dependencias` acumula `'<id>:<dirección>'` (dirección de diez dígitos) de:

- cada slot con fórmula que se evaluó con éxito, **incluido el propio slot** en `evaluar` (por eso `evaluar(eje, id, [3])` de `=LOCAL(2) + 15 min` lista `…:2000000000` y `…:3000000000`);
- cada referencia BTML seguida (`<ref>:<dir>`);
- cada destino de `REF`.

No se anotan los literales leídos (`LOCAL(1, 2)` sobre `'EUR 12'` deja `dependencias: []`). Si la evaluación para, la lista contiene lo acumulado hasta la parada.

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
c('2 * 12 EUR / 4');
c('12 EUR < 12 m');
c('Y(1 < 2, NO(2 > 3))');
c('BUSCAR(4)');
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
dependencias de compra [3]: [ '5819876e…:2000000000', '5819876e…:3000000000' ]
--- consultar(eje, evId, dir, formula): una fórmula suelta en el contexto de un slot
LOCAL(1, 0)                                                → RESUELTO     menú
LOCAL(0)                                                   → RESUELTO     menú
12 EUR - 2 EUR                                             → RESUELTO     10 EUR (12 EUR + -2 EUR)
200 m + 5 EUR                                              → RESUELTO     200 m + 5 EUR
(200 m + 5 EUR) + 100 m                                    → RESUELTO     300 m (200 m + 100 m) + 5 EUR
2 * 12 EUR / 4                                             → RESUELTO     6 EUR
12 EUR < 12 m                                              → INCOMPATIBLE INCOMPATIBLE: magnitud en EUR y magnitud en m no se comparan
Y(1 < 2, NO(2 > 3))                                        → RESUELTO     verdadero
BUSCAR(4)                                                  → RESUELTO     5 candidatos: propio 5819876e · propio 5819876e · escrito 4c1ca012 · escrito aee8e3b3 · escrito 472af969
CONTAR(BUSCAR(4))                                          → RESUELTO     5
CONTAR(FILTRAR(BUSCAR(4), ORIGEN() = "escrito"))           → RESUELTO     3
SUMAR(FILTRAR(BUSCAR(4), ORIGEN() = "escrito"))            → RESUELTO     8 EUR (2 EUR + 5 EUR + 1 EUR)
FILTRAR(BUSCAR(4), ACTUAL() > 1 EUR)                       → INCOMPATIBLE INCOMPATIBLE: array y magnitud en EUR no se comparan
FILTRAR(FILTRAR(BUSCAR(4), ORIGEN() = "escrito"), ACTUAL() > 1 EUR) → RESUELTO     2 candidatos: escrito 4c1ca012 · escrito aee8e3b3
ELEGIR(ORDENAR(FILTRAR(BUSCAR(4), ORIGEN() = "escrito"), ACTUAL(), "desc")) → RESUELTO     1 candidato: escrito aee8e3b3
SUMAR(ELEGIR(ORDENAR(FILTRAR(BUSCAR(4), ORIGEN() = "escrito"), ACTUAL()), 2)) → RESUELTO     3 EUR (1 EUR + 2 EUR)
CONTAR(FILTRAR(BUSCAR(4), ACTUAL(0) = "pagar"))            → PENDIENTE    PENDIENTE: posición sin desarrollar
CONTAR(FILTRAR(BUSCAR(4), SIGNO() = "completar"))          → RESUELTO     3
CONTAR(FILTRAR(BUSCAR(4), Y(ACUERDO() = 10, DESPLAZAMIENTO() = 0))) → RESUELTO     2
ACTUAL(4)                                                  → RESUELTO     [2 posiciones]
ACTUAL(4, 2)                                               → RESUELTO     2 candidatos: propio 5819876e · propio 5819876e
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
| Estados `PENDIENTE DE AUTORIZACIÓN` y `PENDIENTE POR LÍMITE` (mapa §2.3) | No son estados BQL. El primero es una fase de la consolidación en el motor; el segundo no existe en ningún sitio. |
| Condicional (`SI`), `MIN`, `MAX`, `PROMEDIO`, funciones de texto, concatenación | No hay. |
| Fechas, tiempo, PV6/PV7 en fórmulas | No hay; `t` del candidato no es accesible desde BQL. |
| Operaciones matriciales de PV8 y familias de operadores por PV (V4) | No hay. |
| Conversión de unidades (`EUR` ↔ `€`, `min` ↔ `minuto`, `m` ↔ `km`) | Las unidades son etiquetas literales, sensibles a mayúsculas; distintas → composición. |
| `BUSCAR` por dirección sobre todo el eje, o con la dirección que guarda la posición 5 | `BUSCAR` recibe índices relativos al anfitrión y solo mira ese evento (propios, referencias alcanzadas, escritos anclados). No recorre otros eventos que «declaren» la posición. |
| Reglas por dimensión para el signo (corpus V4: «solo cuenta si la regla de esa dimensión lo permite») | El signo se calcula siempre y solo informa; ninguna regla lo filtra. |
| `ORDENAR` con varias claves; orden por encaje explícito | Una clave; el orden por encaje es el de `BUSCAR` por defecto. |
| `Y`/`O` perezosos (cortocircuito) | Evalúan todos los argumentos. |
| Comparación encadenada (`1 < x < 3`) | `SyntaxError`. |
| Literales booleanos, comillas simples, exponentes, `.5`, unidades con `ñ`, `/` o acentos | No hay. |
| Identificadores estables de operadores e idioma, llamadas por hash, matrices tipadas, política de candidatos pendientes (mapa §2.3 «abierto») | No hay. Los nombres son los españoles en mayúsculas de §7.0. |
| Acceso desde BQL a `autor`, `t`, `procedencia`, `vector` completo del candidato | Solo lo que exponen las seis funciones de §7.11; el resto está en `valor.items[k]` desde JavaScript. |

---

## 12. Límites y defectos observados (pendiente, no corregidos aquí)

1. **Funciones sin argumentos que esperan uno**: `NO()`, `CONTAR()`, `SUMAR()`, `FILTRAR()`, `ORDENAR()`, `ELEGIR()` lanzan `TypeError: Cannot read properties of undefined (reading 'tipo')` **fuera** de `evaluar`/`consultar` (no devuelven un Resultado). Quien construya fórmulas debe garantizar el argumento.
2. `1e3` se analiza como magnitud `1 e3` (no hay notación exponencial).
3. `1 / 0` devuelve numero `Infinity` (texto `Infinity`), sin parada.
4. `=`/`<>` entre tipos distintos comparan el texto formateado: `1 = "1"` es verdadero; dos arrays de igual longitud son iguales; dos colecciones con el mismo texto son iguales.
5. `ORDENAR` con claves de tipos mezclados (p. ej. arrays formateados y números) ordena con la comparación de JavaScript entre cadenas y números; el resultado no está definido por BQL.
6. `SUMAR` de una colección con un solo candidato devuelve su valor aunque no sea sumable (un `array`, un `texto`).
7. `evaluar` no sigue una referencia en un slot literal (devuelve `referencia`); `LOCAL`/`REF`/`ACTUAL` sí la siguen. Un camino de índices no entra en el evento referenciado (§3).
8. Una dirección en texto no puede nombrar un índice 0 real final (`'1000000000'` es `[1]`, no `[1, 0]`); usar arrays de índices. Por lo mismo, `BUSCAR(1)` y `BUSCAR(1, 0)` son la misma búsqueda.
9. El tercer argumento de `ORDENAR` distinto del texto `desc` se ignora en silencio.
10. Una referencia BTML rota (`{ ref: 'nadie' }`) aparece como candidato `referencia nadie` en `BUSCAR` y da `ERROR: evento desconocido: nadie` al leer su valor.
11. La resta de magnitudes se muestra con el sumando negativo en el desglose (`10 EUR (12 EUR + -2 EUR)`).
