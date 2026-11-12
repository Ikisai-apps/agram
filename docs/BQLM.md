# BQL mínimo (BQLM)

El BQL mínimo es el álgebra con la que se escriben las condiciones de las reglas de la época: traer posiciones, aplicar una posición a cada elemento, filtrar, contar, sumar y comparar. Viene de dos decisiones de VG (mapa §15 y §16, 9-11): «todo son reglas», escritas en BQL y leídas desde la época, no desde código; y «BQL es un lenguaje para manejar la matriz de BTML», con un léxico de palabras cortas en inglés. Lo que sea «escoger algo concreto» (el día de una fecha, la familia de una serie, la cartera de alguien) no es una función: es una **posición** que el contexto despliega.

Este documento describe lo que existe en `src/bqlm.js` (el analizador y el evaluador) y `src/contexto-eje.js` (el contexto sobre el eje). `src/bql.js` (BQL V0, `docs/BQL.md`) sigue igual. Las reglas de la época 0 (§6 y §10) son registros de la época (§5) y, desde el encargo 3a (VG, 10-11), están conectadas al eje: cada una es una condición de la transacción (`src/condiciones/reglas.js`), y las condiciones de JavaScript que sustituyen se retiraron (`docs/notas/CAPA_CERO.md` §3). El encargo 3b (VG, 8-11 y 9-11, mapa §15 y §16) añade las reglas que escriben (`put`, §1 y §5: la obtención de P), las del P como peso de criterio, la atención con precio y la invitación (§10), y las vistas que leen (§4: el criterio `A.2`, los grupos de atención `A.3`, los compromisos `X.2.4`; y, tras el 3b-bis, lo recibido de su emisor `A.8.6`, la base del tope de la obtención). Pruebas: `test/bqlm.test.js`, `test/contexto-eje.test.js`, `test/epoca-btml.test.js`, `test/primera-regla.test.js`, `test/reglas-bqlm.test.js` (cada regla de la época frente a su condición JS), `test/reglas-3b.test.js` (cada regla del 3b en positivo y en negativo, y sus propiedades), `test/reglas-tope.test.js` (la obtención como tope acumulado: dos plazas en dos transacciones, el polvo, el ir y venir, la reventa, el máximo en una transacción, la persistencia) y, de la revisión de seguridad, `test/seguridad-bqlm.test.js` (SEG-09 a SEG-12: el payload no fabrica movimientos ni «nadie»; el presupuesto de ocupantes; las salidas y series con nombres reservados, `__proto__`, `constructor`, `prototype`, que la validación de movimientos rechaza y el libro guarda como claves propias).

```js
import { analizar, evaluar, evaluarRegla, evaluarEscritura, evaluarPlantilla, queMueve, leerRegla, esLectura, esEscritura, rellenar, textoDe, ESTADOS, PALABRAS, ENLACES, NOMBRES, DESTINOS_DE_PUT, PRIMITIVAS, LIMITES, POR_LIMITE, SIMBOLOS, NADIE, esSimbolo, Presupuesto, Parada, pendiente, porLimite, VERIFICACION, COSTE_FIRMA, esBytes, hexDe } from './src/bqlm.js';
import { ContextoEje, NADIE, primitivaDe, desplegarFecha, desplegarSerie, desplegarValor } from './src/contexto-eje.js';
import { cargarEpocaBtml, EPOCA_0_BTML } from './src/epocas.js';
```

## 1. Léxico

Exacto y nada más. Cualquier otro nombre da ERROR «no es BQL mínimo: «X»»; si va seguido de un paréntesis, además «(no hay funciones con nombre)».

| Qué | Se escribe | Lectura |
|---|---|---|
| posición | `X.d.d…` | los ocupantes de esa posición de X; X es `ev`, `epoch`, `before`, `me`, `it`, `it2`… o una expresión entre paréntesis |
| índice por valor | `X.(expr)` | si expr vale un dígito 0-9, esa posición; si vale un texto, los ocupantes de X que se llaman así |
| primero, último, k-ésimo | `first M`, `last M`, `nth k M` | `nth` cuenta desde 0, como los ocupantes de una lista |
| aplicar una posición | `M each d.d…` | la posición d de cada elemento de M (lo mismo que `(M).d`) |
| filtrar | `M where cond` | los elementos que cumplen cond; dentro, `it` es el elemento; en un where anidado, `it2`, `it3`… |
| árbol | `up X`, `down X`, `path X`, `under X` | el padre por el ancla 6.5; los registros anclados sobre X; el hilo de X hasta la raíz (tope de diez niveles); X y **todo lo que cuelga de él**, a cualquier profundidad, por llegada (VG 12-11; el presupuesto es su tope) |
| libro | `moves X` | **los asientos del libro** de X, por llegada, cada uno con su D-MOV (VG 12-11): de un registro, lo que asentó su transacción, también lo que añade el libro (la asignación del día, el T informativo, la reposición, la obtención); de una identidad, todo donde es de o a; de una serie (la de un movimiento, una entrada de la cartera o `before.4.(…)`), todos sus asientos; de la candidata, lo que declara (aún no está asentada) |
| ordenar | `M by e` | M ordenado por e, de menor a mayor; los empates, por llegada (`last` da el mayor; `0 - e`, al revés). Como `where`, da el siguiente it: dentro, el elemento es `it` (o `it2`…) |
| recuento | `count M`, `sum M`, `max M`, `min M` | |
| aritmética | `+ - * /`, `floor x`, `-x` | solo números |
| comparación | `= != < <= > >=` | el orden, solo entre números |
| lógica | `and`, `or`, `not`, `x in M` | `and` y `or` son perezosos |
| literales | `12`, `2.5`, `"texto"` | |
| símbolos | `mint transfer lock release burn`, `E P R T` | símbolos del libro: se leen por su nombre, pero no son texto (`burn = "burn"` es falso; §3) |
| nombres | `ev`, `epoch`, `before`, `me`, `memo` | la transacción candidata, el registro de la época, el libro de antes y, desde el encargo 3c-2a, la identidad que mira (sus vistas: `me.1` la cartera, `me.2.1` su P, `me.3` sus grupos); lo leen las plantillas de transacción del aro (`docs/CONTRATO.md` §12). `memo` (VG 12-11, decisión 5) es el payload de la candidata, sin movimientos ni metadatos: `memo.1` es el 1 del payload, sin el doble sentido de `ev.1` |
| serie | `T.d`, `R.(x)`, `E.(x).(y)`, `E.(x).(y).(z)`, `P.(x)`, `P.(x).(y)` | la serie como posición de su familia (VG 12-11, decisión 5): `T.1` el T de minuto (el dígito de su escala), `T.8` el futuro, `R.(me)` la R de quien escribe, `E.(emisor).(denominación)[.(registro)]`, `P.(ámbito)[.(origen)]`. Vale la serie (D-SERIE), exista o no: su valor es su clave. Una parte vacía no hace serie (nada) |
| mover | `mint q S to A`, `transfer q S from A to B`, `lock q S from A exit E`, `release q S from A exit E`, `burn q S from A`, con `when F` (mint, transfer, burn) y `price Pr` (mint) | **solo en una plantilla de transacción** (§11; invariante del núcleo): los cinco símbolos como verbos. Cada uno vale verdadero y anota un movimiento; lo que vale cero o nada no se mueve |
| verificar | `bytes(h)`, `hex(b)`, `utf8(t)`, `hash(x[, etiqueta])`, `sha256(b)`, `sha256d(b)`, `cat(b, …)`, `slice(b, i, j)`, `reverse(b)`, `le(b)`, `below(a, b)`, `merkle(hoja, lados, hermanos, esquema)`, `ots(x, pasos)`, `cabecera(b)`, `tx(b)`, `signed(firma, mensaje, clave)`, `lookup(claves, valores, clave)`, `payload(X)` | las primitivas de verificación (§12; Core AGRAM 12-11, #67, y 13-11, H17-H19): la única excepción a «no hay funciones con nombre». Calculan sobre bytes, un tipo nuevo, o leen dos listas hermanas (`lookup`) o el payload tal cual (`payload`); nunca firman; son lectura |
| colocar | `put v at X.d.(k)`, `put v at X.d.(k).e` | en una regla que escribe (`put` en su 4): anota «la posición d.(k) de cada X vale al menos v» (un nivel, un estado BTML; no «añade v») y vale verdadero (§5); con un dígito tras el índice, coloca en esa posición de la entrada k (encargo 3c-2a: el P sobre la mirada e del registro k, `A.2.1.(r).1`). Solo en los destinos de una lista cerrada, `DESTINOS_DE_PUT` (hoy `A.2.1`, la obtención; VG 12-11, decisión 6). En una plantilla, solo el nivel en mano, `put v at A.1.(S).1` (§11) |

`moves`, `under` y `by` entraron el 12-11 (VG, estudio BQL-transacciones, decisiones 1 y 2: «ninguna palabra más por ahora»): leer el libro es una palabra y no una posición (el 1 de un registro ya junta sus movimientos, su payload y sus series vivas), y son las dos que faltaban para el 1, el 6 y el 7 de los puntos de vista. Para todo lo demás sigue la regla de oro: lo concreto es posición.

`put` y `at` entraron en el encargo 3b (mapa §16 [D]: «put v at X.d, colocar, solo reglas que escriben»). El destino no se lee: es dónde se escribe, y termina siempre en un índice por valor, la clave de lo que se coloca (`put 10 at (first ev.3).2.1.(first ev.5)`: diez en la entrada del registro `ev.5` del P posicionado de quien escribe). Lo que se coloca es un **nivel** (VG, tras 3b-bis): la posición llega al menos a v, y quien la concilia (el libro, §5) añade solo lo que falte, nunca quita; varias colocaciones de la misma regla en el mismo sitio en una transacción se quedan con el máximo, no con la suma. Fuera de una regla que escribe y de una plantilla de transacción, `put` es ERROR («put: solo en una regla que escribe»), y en una regla que escribe, fuera de su lista cerrada de destinos, también (VG 12-11, decisión 6: el libro, por su cuenta, solo acuña hasta un nivel en una lista cerrada).

`mint transfer lock release burn` como verbos, `from to exit when price` y `memo` entraron el 12-11 (VG, estudio BQL-transacciones, decisión 5). Un símbolo de primitiva es un verbo cuando lo sigue un operando (un número, un texto, un paréntesis, un nombre, `it`, una prefija o un símbolo de familia); si no (`burn in it.4`, `it.4 = burn`), sigue siendo el símbolo. Un símbolo de familia seguido de `.` es la serie (`R.(me)`); suelto, el símbolo (`T in it.0.0.0`).

## 2. Gramática

```text
expresión   := disyunción (('where' | 'by') disyunción)*   where y by se llevan todo lo que queda a su derecha
disyunción  := conjunción ('or' conjunción)*
conjunción  := negación ('and' negación)*
negación    := 'not' negación | comparación
comparación := suma (('=' | '!=' | '<' | '<=' | '>' | '>=' | 'in') suma)?     sin encadenar
suma        := producto (('+' | '-') producto)*
producto    := prefija (('*' | '/') prefija)*
prefija     := ('first' | 'last' | 'count' | 'sum' | 'max' | 'min' | 'floor' | 'up' | 'down' | 'path' | 'under' | 'moves' | '-') prefija
             | 'nth' prefija prefija
             | 'put' suma 'at' posfija                  el destino acaba en '.' '(' expresión ')'
             | posfija
posfija     := primaria ('.' dígitos | '.' '(' expresión ')' | 'each' dígitos)*
             | familia ('.' dígito | '.' '(' expresión ')')+   la serie: T una parte, R una, E dos o tres, P una o dos
verbo       := ('mint' | 'transfer' | 'lock' | 'release' | 'burn') suma prefija enlace*
enlace      := ('from' | 'to' | 'exit' | 'when' | 'price') suma           cada uno una vez; los que pide y admite cada verbo, §11
dígitos     := dígito ('.' dígito)*                    cada dígito, uno solo: ev.12 es un error («escribe 1.2»)
primaria    := número | "texto" | símbolo | verbo | 'ev' | 'epoch' | 'before' | 'me' | 'memo' | 'it' | 'it2' | … | '(' expresión ')'
```

Una posición solo se lee de un nombre, de `it` o de una expresión entre paréntesis: `"12 EUR".1` es un error de sintaxis; `("12 EUR").1` vale 12. Las prefijas se aplican a todo lo que sigue sin operador: `sum (first ev.3).1.(it.0).1` es la suma del camino entero, y `count M >= 1` es `(count M) >= 1`. `where` es lo de menor precedencia: `count (ev.1 where it.4 = burn)` lleva paréntesis; sin ellos, el where filtraría el recuento. Un «=» al principio (la forma de fórmula de una regla) se admite y no cuenta.

## 3. Semántica

- **Toda expresión vale una lista de ocupantes**, en orden de llegada. Un literal es la lista de uno.
- **Una lista de uno se usa como su elemento** en la aritmética y en las comparaciones (decisión G3). Comparar una lista de más de uno es ERROR, con el aviso de usar `first`, `last`, `nth`, `count` o `sum`.
- **Lo vacío.** `=` y `!=` comparan nada con nada (`epoch.9 = epoch.8` es verdadero; `epoch.9 = 1`, falso) e `in` con nada es falso. La aritmética y el orden con una posición vacía quedan PENDIENTE: falta un valor. `count` de nada es 0, `sum` de nada es 0, `max` y `min` de nada son nada.
- **Las primitivas y las familias son símbolos del libro; el payload no puede fabricarlas** (revisión de seguridad, SEG-09). `mint`, `transfer`, `lock`, `release`, `burn`, `E`, `P`, `R`, `T` y «nadie» (`NADIE`) son objetos propios (`SIMBOLOS`, `esSimbolo`), no textos: solo los producen el analizador, desde un literal, y el contexto, desde un movimiento real (su 4, la familia de su serie, el «nadie» de su 3). Un texto «burn» escrito en el payload no es igual a `burn`, así que una décupla del payload que imita un movimiento no pasa `it.4 = burn`; y una identidad que se llame «nadie» no se confunde con el otro lado de una quema (SEG-11). Se leen por su nombre (`texto`).
- **Valores.** Un ocupante vale su número, su texto o su símbolo; un registro vale su id; una décupla no tiene valor y compararla es ERROR («lee una de sus posiciones»). Números y textos distintos no son iguales (`1 = "1"` es falso). Los resultados lógicos son `true` y `false`.
- **Índice por valor.** `X.(3)` es `X.3`. `X.("E:casa/EUR")` deja los ocupantes de X que se llaman así: un ocupante se llama como su valor o, si es una décupla, como los valores de su 0. Así `A.1.("E:casa/EUR")` es la entrada de esa serie en la cartera, y `ev.1.("T:hora")` los movimientos de esa serie.
- **`where`** evalúa la condición con `it` = cada elemento y deja los que dan verdadero; la condición tiene que dar verdadero o falso. Si la condición de un elemento queda PENDIENTE, todo el where queda PENDIENTE, como el `FILTRAR` de BQL V0 ([X] decidir VG: `docs/REGLAS_CORTAS.md`, duda 6).
- **`up`, `down`, `path`, `under`** solo valen sobre registros (la candidata `ev`, un registro del eje o el texto de su id); sobre otra cosa son ERROR. `path` da el registro y sus antepasados; si el hilo pasa de diez, PENDIENTE. `under` da el registro y todo lo que cuelga de él, por llegada (la candidata, ella sola); cada registro cuesta uno del presupuesto, así que un subárbol mayor que él es PENDIENTE POR LÍMITE.
- **`moves`** vale sobre un registro, una identidad con alta o una serie del libro; sobre otra cosa (una identidad sin alta, un número, un contexto sin libro) es ERROR («no es un registro, una identidad ni una serie del libro»). Cada asiento cuesta uno del presupuesto. Los asientos solo los produce el libro: el payload no los fabrica, como los símbolos (SEG-09).
- **`by`** evalúa la clave con el elemento como `it` (o `it2`…) y ordena de menor a mayor, estable. La clave es un número o un texto, todas del mismo tipo: una vacía es PENDIENTE, una lista de más de uno o una décupla es ERROR, y mezclar números y textos, ERROR.
- **Estados**, como el BQL actual: RESUELTO, PENDIENTE (falta algo que resolver: una posición vacía donde hace falta un valor, una referencia a un evento que no está, el contexto sin `ev` o sin `epoch`, un límite de cálculo) y ERROR (sintaxis, un nombre que no es del léxico, tipos que no operan, división por cero). `evaluar` no lanza: devuelve `{ estado: 'RESUELTO', valor, texto }` o `{ estado, motivo }`.
- **Límites** (`LIMITES`): 100 000 pasos por evaluación (`opciones.limites.pasos`), 10 000 ocupantes expandidos por el contexto (`opciones.limites.ocupantes`, el máximo de Scened; SEG-10), 100 niveles de anidamiento y 10 niveles de hilo. Pasarse es PENDIENTE con subtipo «PENDIENTE POR LÍMITE» (`POR_LIMITE`). El presupuesto de ocupantes (`Presupuesto`) es uno por evaluación, lo comparten todas las llamadas al contexto y cuenta cada ocupante expandido y cada salto de referencia; las referencias ya seguidas se recuerdan por (ref, dir), y una que vuelve sobre sí misma es PENDIENTE.

## 4. El contexto: posiciones de verdad

El evaluador no sabe nada del eje: pregunta a un **contexto** con esta interfaz.

| Método | Devuelve |
|---|---|
| `nombre(n)` | el nodo de `'ev'`, `'epoch'` o `'before'`, o `undefined` si no lo hay (y la expresión queda PENDIENTE) |
| `ocupantes(nodo, camino, presupuesto)` | los ocupantes de la posición `camino` (dígitos 0-9) del nodo, por llegada, gastando del `Presupuesto` de la evaluación; puede lanzar PENDIENTE (`pendiente(motivo)`, `porLimite(motivo)`) |
| `padre(nodo)` | el registro padre, `null` en la raíz, `undefined` si el nodo no es un registro |
| `hijos(nodo)` | los registros anclados sobre él, `undefined` si no es un registro |
| `valor(nodo)` | el escalar de un nodo que no es número ni texto (el id de un registro) o `undefined` |
| `texto(nodo)` | (opcional) cómo se escribe en un mensaje |

`new ContextoEje(eje, { ev, epoch, me })` lo implementa sobre el eje actual, **sin modificarlo**: `ev` es la transacción candidata (un evento que aún no está en el eje: el eje es el libro de antes), `epoch` la época (`EPOCA_0_BTML` o su décupla) y `me` (encargo 3c-2a) la identidad que mira, un texto que se despliega como toda identidad con alta. Sin eje (`new ContextoEje(null, { epoch })`) solo lee payloads y despliegues.

**Cómo se baja.** Un dígito cada vez, y lo que queda del camino se aplica a cada ocupante: `X.a.b` es siempre `(X.a).b`. En el payload se baja por la raíz y por las décuplas; una lista da sus elementos; una referencia, lo que alcanza en el payload del otro registro (como `encaje.seguir`: sin entrar en listas) o el registro entero si no lleva dirección; una hoja, su despliegue. En un registro del eje, lo escrito anclado en una posición es ocupante de esa posición (por llegada, después de lo propio), y lo escrito anclado exactamente en el camino entero también lo es aunque el payload no tenga una décupla por medio (como `encaje.ocupantes` con `exacto`).

**Orden de los ocupantes** de una posición: los implícitos (D-META y las vistas), lo propio del payload y lo escrito anclado.

**Despliegues** (los de `docs/notas/INVENTARIO_REGLAS.md` §2.2):

| Código | Qué despliega | Posiciones |
|---|---|---|
| D-META | un evento (la candidata o un registro del eje) | 3 autor y firmante (el segundo ocupante, siempre: `NADIE` si no va firmado; lo del payload va detrás), 5 su id («nadie» si aún no lo tiene) y las claves públicas que declara, cada una con su huella en el 0, su titular en el 3 y su prueba de posesión en el 4 (el 5 de un evento es solo suyo: ni el payload ni lo anclado lo ocupan), 6.0 t, 6.5 sobre y en, 1 los movimientos, que colisionan con lo que el payload tenga en su 1 |
| D-MOV | un movimiento (el declarado en el 1 de un evento) o un **asiento del libro** (lo que da `moves`) | 0 su serie (un registro: D-SERIE), 1 cuánto, 2 estado, salida y caducidad (las que haya; la salida vale su texto y, si nombra una serie que existe, es la referencia a su registro; si es un instante, se despliega como D-FECHA), 3.0 de, 3.1 a (null es el símbolo «nadie», `NADIE`), **4 qué se hace** (VG 12-11, decisión 3: vale su primitiva, así que `burn in M.4` y `M.4 != burn` siguen como antes): **4.0 la primitiva**, un símbolo (`mint` si de = null, `burn` si a = null, `lock` y `release` por el estado, si no `transfer`), **4.1 la clase del asiento** (`emision`, `asignacion`, `obtencion`, `reposicion` o `informativo`: la que el libro le da; `anuncio` en un movimiento anunciado, VG 12-11, decisión 8; lo demás, y un movimiento declarado, no la tienen), 5 el registro de la serie (E; sin registro nombrado, el alta de su emisor: D2), **6 cuándo y dónde: 6.0 el instante** (el t del registro que lo asienta) **y 6.5 ese registro**, 7.0 la caducidad y 7.1 la fecha a la que se refiere (B3: ya no comparten posición), **7.2 bloqueado hasta** (la salida que es un instante, en lo que queda bloqueado: bloquear, o transferir con salida), 9 nota. Un asiento toma las fechas y la nota del movimiento declarado que lo originó (el del mismo paso). **Lo anunciado** (VG 12-11, decisión 8: estado «anunciado» en su 2, clase «anuncio» en su 4.1, para cuándo en su 7.1) no toca saldos: el libro no lo asienta, `moves` del registro lo da detrás de sus asientos y el 1 del registro no lo lleva (lo que se movió) |
| D-SERIE | una serie de tokens, que es un registro (VG, 10-11, B3) | 0 su clave legible, que vale la clave de texto del libro (su clave interna) y se lee por partes: 0.0 familia (un símbolo del libro), 0.1 la escala de T como dígito (segundo 0 … año 6, pasado 7, futuro 8, inventado 9), el emisor (E, R) o el **registro** del ámbito (P: `r`, aunque el ámbito sea una mirada `r.d`), 0.2 denominación (E) u origen (P: quien lo obtuvo; encargo 3b-bis), 0.5 la **mirada** del ámbito de P (encargo 3c-2a, P por mirada: el dígito d de `r.d`; nada si es el registro entero); 1.0 lo emitido y 1.1 lo consumido, hasta antes de la candidata; 2 el contrato de E: 2.0 «divisible» si lo es, 2.2 sus **precios** (encargo 3c-2a: cada uno `[[en qué], [cuánto por unidad]]`, el principal primero, los que declaró su emisión con `precio` y `precios`, o el de la primera orientación de `epoch.1.0.1` si no declaró ninguno), 2.7 su caducidad; 3 sus emisores (E, R) o su origen (P); 5 el registro al que está atada (E); 7 su franja (E). La materializa el libro como vista (`eje.serie`, `eje.registroDe`, las sumas de lo quemado); la de una serie que nace en la candidata sale de su primera emisión |
| D-FECHA | un instante ISO con zona | k = el número de periodo de la escala k desde 1970-01-01T00:00Z, en UTC: 0 segundo, 1 minuto, 2 hora, 3 día civil (`tokens.diaCivil`), 4 semana, 5 ciclo de 28 días, 6 año |
| D-VALOR | un terminal «12 EUR» o «EUR 12» (con espacio) | 1 cuánto, 2 unidad; solo lectura |

La convención del año de D-FECHA: años de 364 + 1 días (`tokens.SEGUNDOS.anio`, trece ciclos de 28 días y uno más) contados desde el 1 de enero de 1970, sin bisiestos; la semana cuenta desde ese día, que fue jueves. Es un número de periodo para comparar y agrupar, no una fecha del calendario civil ([X] decidir VG si el año ha de seguir al civil).

Un texto se despliega por su forma: un instante (D-FECHA), el id de un registro del eje (el registro), una identidad con alta (sus vistas) o una magnitud (D-VALOR). Sigue valiendo su texto para comparar. Una clave de serie escrita como texto ya no se despliega (B3: D-SERIE deja de ser un despliegue de texto): la serie es un registro al que se llega desde el 0 de un movimiento, de una entrada de la cartera o de una serie viva de un registro, y desde la salida de un bloqueo; un texto del payload no la fabrica (SEG-09).

**Vistas del libro como posiciones** (a la fecha de la candidata):

| Posición | Qué es | De dónde sale |
|---|---|---|
| `A.1` | la cartera de la identidad A: un ocupante por serie con algo disponible o bloqueado; cada uno, 0 la serie, 1 lo disponible, 2 lo bloqueado, un ocupante por salida (0 la salida, 1 cuánto) | `eje.libro.vista` (la capa cero, `docs/notas/CAPA_CERO.md`) |
| `A.2` | el **criterio** de A (encargo 3b, mapa §15 [D] «P como peso de criterio»): `A.2.1` su P posicionado, una entrada por registro sobre el que tiene P, de todos sus orígenes (0 el registro, 1 cuánto, disponible y bloqueado, 2 lo bloqueado por salida, 3 su titular, 4 lo disponible, 6 sus orígenes: encargo 3b-bis, uno por quien lo obtuvo, que vale su nombre, con 0 la serie, 1 cuánto, 2 lo bloqueado, 3 el origen y 4 lo disponible); `A.2.3` las personas cuyos criterios adopta (la lente de criterios: los nombres que A escribe en el 2.3 de su alta, en el payload o anclados ahí por ella); `A.2.6` **el P de su origen** (encargo 3b-bis): lo que obtuvo A, esté en la mano que esté, una entrada por registro (0 el registro, 1 cuánto en todas las manos, 3 en qué manos, 6 el origen, 8 su reparto en el dominio, la lectura «share», §5). `A.2.1.(r)` y `A.2.6.(r)` son las entradas del registro r | `eje.libro.vista`, `eje.obtenidoPor`, `eje.alta`, `eje.sobre`. Encargo 3c-2a (P por mirada): `A.2.1` y `A.2.6` llevan **una entrada por ámbito**, el registro entero y cada mirada suya `r.d`; las dos valen el registro (su 0) y la de una mirada lleva el dígito en su 5 (`A.2.1.(r)` da todas las de r) |
| `A.3` | los **grupos de atención** de A (mapa §16 [D] «PV3 = regla de atención»), uno por zona, en su orden: las seis de la época (`epoch.1.2.1`: desconocidos 0, comercial 1, expertos 2, cercanos 3, equipo 4, vetados 5) y las que A abra con un precio propio. Cada grupo: 0 su nombre, 1 su zona, 2 su precio (`[[en qué], [cuánto]]`: el de la época y, detrás, lo que A ancla en el `3.k.2` de su alta; manda el último), 3 quiénes (lo que A ancla en el `3.k.3` de su alta). Solo cuenta lo que ancla A | `epoch.1.2.1`, `eje.sobreDe`. Encargo 3c-2a: los seis precios de la época son `my R`, `E`, `P`, `their R`, `open record` (el equipo: sin pago mientras haya un registro abierto entre los dos) y `nothing` |
| `A.6` | el alta de la identidad A: el registro que abrió su cuenta (`epoch.3.6`, «pasado: de dónde viene»); `A.6.6.0` es su t y `A.6.3` su autor. Sin alta en el eje, nada | `eje.alta`, `eje.obtener` |
| `A.8.1` | su obligación: la R de A en manos de otros (la lectura «obligation», §5; antes `A.3.1`) | §5 |
| `A.8.6` | **lo recibido de su emisor** (VG, tras 3b-bis: la base del tope de la obtención): una entrada por serie de E o de R que le ha llegado alguna vez directamente de su emisor, también la que ya no tiene (por eso no cuelga de la cartera `A.1`, que solo lista lo que hay), en el orden en que tocó cada serie; cada una vale su serie (`A.8.6.(serie)` la da) y lleva 0 la serie (D-SERIE: `0.5` su registro), 1 **cuánto neto** (lo transferido del emisor a A menos lo transferido de A al emisor; puede ser negativo), 3 el emisor, 4 lo devuelto y 6 lo recibido. Lo que pasa entre tenedores no cuenta, y un emisor no se recibe a sí mismo. Es el 8 de la identidad, «frente a otros», al lado de su obligación: lo que le ha llegado de otros emisores frente a lo que ella debe | `eje.recibidoDelEmisor`, `libro.sumas({ primitiva: 'transferir', serie, de, a })` |
| `A.7.e` | el T de la escala e (0-6) gastado de la asignación del día civil de `ev.6.0.3`: consumido o dado a una cosa; en las escalas informativas (7-9), nada | `eje.gastadoT` |
| `X.1` | de un registro de recurso: sus series de E atadas y vivas; cada una, 0 la serie, 1 lo vivo, 7 la caducidad. Lo vivo caduca con el **reloj de la caducidad**: el menor entre `ev.6.0` y el reloj de los demás (`before.6.3`); sin los demás, nada caduca (SEG-03, SEG-05, RL-4; como `src/condiciones/tope.js`) | `eje.series`, `eje.vivo`, `eje.tMaximo` |
| `X.2.4` | los **compromisos** con el registro X (mapa §15 [D] (5): «comprometer = bloquear con salida la decisión»): lo bloqueado por cualquiera con la salida = el id de X; cada uno, 0 la serie, 1 cuánto, 3 su titular, 5 la decisión (X), 8 su peso (la lectura «weight», §5). El resto del 2 de X es su payload | `eje.bloqueosCon`; `X.4.8` es la lectura «stage» (§5), `X.6.2` y `X.6.3` las lecturas «attention price» y «attention group» (§5) |
| `X.7.1` | las series de E vivas de **todo el subárbol** de X (X y lo que cuelga de él), con el mismo reloj; cada una como en `X.1` (B6). El resto del 7 implícito son las lecturas que la época pone ahí (`X.7.4`, `X.7.7`, `X.7.9`, §5) | `eje.series`, `eje.hilo`, `eje.vivo` |
| `X.6.8` | **los tres relojes** de X (VG 12-11, decisión 4): 6.8.0 su t del libro, 6.8.1 la marca de Nostr al transportarlo (su instante, la clave del relé y, detrás, el recibo copiado: una décupla, 0 «recibo de llegada», 1 instante, 2 relé, 3 firma, 4 id del recibo), 6.8.2 el bloque de Bitcoin que lo ancla (su instante, su altura, su hash y, detrás, **la prueba copiada**: la décupla del sello de tiempo del SIP 0, con «-» leído como nada; encargo «verificado-regla»); los dos últimos, vacíos hasta que exista el transporte (los pone él, fuera del id). En 6.8.4 y 6.8.5, las lecturas «received» y «sealed» (§5, §12). Se puntúan como el vector de diferencias con signo del encaje: una diferencia negativa más allá de su margen (`epoch.7.3`) es la única incongruencia real, la cuenta rara (`X.6.9`, la lectura «clocks out of order», §5); las distancias, latencias de anclaje, serán la medida del 8 | el evento; el transporte |
| `S.1.0`, `S.1.1` | de una serie S (la de un movimiento, `ev.1.0`, la de una entrada de la cartera, `A.1.0`, o la que nombra una salida): lo emitido y lo consumido hasta antes de la candidata (el `S.8` del encargo 2) | `eje.serie`, `libro.sumas` |
| `before.1` | los registros del libro, por llegada | `eje.orden` |
| `before.2` | lo bloqueado por salida y serie, **sumado sobre todos los titulares** (B6, BL-3): un ocupante por salida y serie, que vale su salida (así `before.2.("salida")` los da); 0 la serie, 1 cuánto, 3 los titulares | `eje.identidades`, `eje.bloqueos` |
| `before.3` | las identidades del libro | `eje.identidades` |
| `before.4` | **las series del libro**, por aparición (encargo 3c-2a): cada una su registro (D-SERIE); `before.4.("E:casa/EUR")` la busca por su valor, así que un texto que nombra una serie se despliega sin que el texto la fabrique (SEG-09) | `eje.series` |
| `before.5` | el génesis | `eje.genesisId` |
| `before.6.0` | el mayor t del libro | `eje.tMaximo` |
| `epoch` por su id | la raíz de la época (`EPOCA_0_BTML.id`), referenciada desde un registro (el 2 de una invitación, `{ ref }`), se alcanza como `epoch` | `cargarEpocaBtml(…, { id })` |
| `before.9` | cómo es este libro: «demostración» si su génesis lo marca (sin clave se escribe; R9) | `eje.demostracion` |
| `before.8` | **los servicios de fuera del eje** (encargo «verificado-regla», #67): los ajustes «exterior settings» de la cuenta RAÍZ, ya leídos (`exterior.ajustesDelEje`): 1 relay url, 2 blossom url, 3 seal url, **6 observer keys** (una clave x-only por ocupante), 7 confirmations, 8 guide url. Con ellos verifican todos los lectores | `exterior.ajustesDelEje` |
| `before.6.3` | el **reloj de los demás** (B6): el mayor t del libro entre las identidades que no son el autor de la candidata ni emiten la E que ella acuña; nada si no hay ninguna | `eje.tMaximo(excluidos)` |

**Lo que el núcleo lee en un registro va delante.** Los implícitos van primero, así que `(first X.7).d` y `(first X.6).d` son lo que el núcleo lee en el 7 y el 6 de X (sus lecturas, sus relojes), sin lo que el payload o lo anclado pongan en su 7 o su 6 (una referencia en el 7 del payload, un registro anclado en el 7.7): así lo leen las reglas de la época 12-11.

**El orden de un movimiento** es su lugar en `ev.1` (B6): los movimientos van primero, en su orden, y `nth k ev.1` es el k-ésimo (desde 0); no hace falta otra posición.

No hay tipo de identidad (VG, 10-11, B1): persona o cosa se lee del 3 de su alta (`first A.6.3 = A`: persona es quien escribió su propia alta; cosa, lo que dio de alta otra identidad, su dueño). Solo en el prefijo de la versión 2 (suelo de persistencia) el alta declaraba un tipo, y el contexto lo da en esa misma posición: el 3 de un alta de entonces, leído desde su identidad, es ella misma si se declaró persona y otro si no.

## 5. La época como registro

`datos/epocas/epoca-0.btml.json` es la época 0 como décupla BTML, leída con la cruceta; `cargarEpocaBtml` la carga y `EPOCA_0_BTML` la expone como `epoch`. Su forma está en `docs/BTML.md` §12. Con el BQL mínimo: `epoch.1.3.1.e.1` es la asignación diaria de la escala e (lo que el mapa escribe `epoch.T.e.1`), `epoch.5.p.d.0` el nombre de la regla corta del dígito d en la profundidad p y `first epoch.2` la primera regla.

**Las reglas son registros** (VG, 10-11, A1: «Correcto»). Cada regla es su propio registro: una décupla del molde con las diez posiciones llenas, en `datos/epocas/reglas/<su 0 en kebab>.json`, con un id estable, el hash de su cuerpo canónico (como el de un evento: `hash(canonico(regla))`). El 2 de la época es la **lista de referencias** `{ ref }` a esos registros, una hoja por regla, sin páginas ni tope de diez, en el orden que dice el 8 de cada una; la época es el registro raíz más los registros de sus reglas, referenciados. `npm run epocas` reescribe ese 2 desde `datos/epocas/reglas/` y genera `datos/epocas/epocas.js`; el cargador resuelve cada referencia (`cargarEpocaBtml(raíz, { registros, correcciones })`) y rechaza la que no resuelve. `EPOCA_0_BTML.condiciones` da las reglas en ese orden, `reglasConId` cada una con su id. Leídas con el BQL mínimo, `epoch.2` da los registros de las reglas (el contexto sigue la referencia, §4), que valen su id: `(first epoch.2).0` es el nombre de la primera, `(nth k epoch.2).2` la condición de la k-ésima (desde 0) y `epoch.2.0` los nombres de todas.

**Las lecturas son reglas** (VG, 10-11, B5). «present», «informative», «attended», «obligation» y, desde el encargo 3b, «share» y «weight» son registros de la época como las demás reglas, en el mismo 2 y en la misma cadena del 8, con `read` en su 4. No son condiciones: no se cuelgan de las transacciones (`EPOCA_0_BTML.condiciones` no las lleva; `EPOCA_0_BTML.lecturas` sí, y `evaluarRegla` las rechaza). Su 2 es una fórmula «=…» en la que `it` es lo que se lee (un registro, la candidata o una identidad), así que su primer `where` da `it2`; su 3 dice **dónde se materializa**: el contexto pone lo que da la lectura en esa posición del sujeto, y las demás reglas la leen ahí, por su posición, sin repetir la fórmula (`leerRegla(regla, sujeto, contexto)` la evalúa a mano). No hace falta ninguna palabra nueva en el léxico.

| Lectura | Dónde | Qué da | Lo mismo que |
|---|---|---|---|
| present | `X.6.1` (de dónde viene, cuánto) | si el registro quema T real de su autor (una escala que el calendario mide), o es el génesis | `evento.esPresente` |
| informative | `X.6.7` (de dónde viene, para cuándo) | si quema T de una escala que el calendario no mide (pasado, futuro, inventado) | `ciclo.esInformativoT` en alguno de sus movimientos |
| attended | `X.7.4` (futuro, qué se hace) | si devuelve R a su emisor y ese emisor ancló sobre él un registro suyo con T real (presente): pedir atención y atenderla (mapa §15 [D] «R según el corpus»; el criterio de cada uno por su PV2 sigue [X] VG) | `lente.devoluciones(…).atencion` |
| obligation | `A.8.1` (frente a otros, cuánto) | la R de la identidad en manos de otros, disponible o bloqueada | `eje.obligaciones` |
| share | `A.2.6.8` (en cada entrada del P de su origen; encargo 3b-bis, antes `A.2.1.8`) | el reparto: la parte del P que obtuvo A, esté en la mano que esté, en el dominio del registro que está en él: P de origen A en r ÷ P de origen A en el dominio de r, el árbol que cuelga del registro más alto del hilo de r escrito por su dueño (mapa §15 [D] (3): «cada persona se lee como su 100 %, por dominio»; 3b-bis: sobre el P de su origen) | `motor.peso` |
| weight | `X.2.4.8` (en cada compromiso con X) | por el ORIGEN del P comprometido (encargo 3b-bis, el 0.2 de su serie): con nombres en el 2.3, presión del origen ÷ 9 × lo comprometido ÷ el P de su origen en el dominio de X (`A.2.6`); con «cualquiera», presión ÷ 9 × lo comprometido, por cantidad. 0 si no es P o si su P no está en ese dominio. Encargo 3c-2a (P por mirada): un compromiso de P sobre una mirada `r.d` pesa solo si la decisión dice esa mirada en su criterio («view d», una magnitud, en su 2.2 o en su 2 si es una lista); el del registro entero pesa siempre. La presión la fija el dueño de X en el 2.3 de X: un nombre cuenta 9 (`epoch.9.0.0.4`), «nombre 5» su presión, «cualquiera» abre a todos; sin lista, solo cuenta el dueño (N4) | `motor.recuento` |
| attention group | `X.6.3` (de dónde viene, con quién) | la zona en que el dueño del registro sobre el que se escribe X (su alta, cuando la regla de atención rige) pone a quien escribe X: el último de sus grupos (`A.3`) que lo nombra en su 3, el que le asignó la invitación que aceptó (su 8), o la zona de `epoch.9.0.2.1` (encargo 3c-2a) | la búsqueda que hacía la regla «attention has a price» |
| attention price | `X.6.2` (de dónde viene, con qué condición) | el precio de esa zona: el último 2 del grupo, `[[en qué], [cuánto]]` (encargo 3c-2a: los seis grupos son seis precios); la regla de atención lo lee aquí y «write to X» construye el pago con él | — |
| stage | `X.4.8` (fábrica, frente a otros: lo ocurrido frente a lo previsto) | los movimientos anunciados en el 4.1 de X que aún no han pasado (la condición de la plantilla de cerrado); por estación (`epoch.4.2`: E pagar, P decidir, R atender, T trabajar) con `before.4` para la familia de cada anuncio (encargo 3c-2a) | «what is missing» (`epoch.9.0.3`) |
| dated movement | `X.7.9` (futuro, cómo; Core, pendiente de revisar VG) | el primer asiento del registro que lo refiere a una fecha (`moves`): el T futuro declarado (la escala «futuro» de `epoch.1.3.1`) con su 7.1, lo bloqueado hasta una fecha (7.2), la emisión de E que caduca (7.0) o la quema de E propia. Sobre él, los **estados del futuro** de `epoch.7.4` (una fila por estado: su nombre, cuándo, con `it` = este asiento, y su fecha): previsto, bloqueado (sigue en `A.1` de quien lo bloqueó), liberado, caducado (la caducidad ya pasó `before.6.0`, o quema E propia) y caduca | `contrato.estadoDeEntrada` de antes (VG 12-11: ahora lo lee de aquí) |
| for when | `X.7.7` (futuro, para cuándo) | la fecha a la que se refiere el registro, en segundos: la de su movimiento con fecha (`(first X.7).9`: su 7.0.0, 7.1.0 o 7.2.0) o, si no tiene 7 (la quema de E propia), su instante; nada si no tiene. La leen «by when» (el 7, por esa fecha) y el paso «cuando» de `epoch.9.8` | la fecha de `estadoDeEntrada` |
| clocks out of order | `X.6.9` (de dónde viene, cómo; la que proponía el estudio, Core, pendiente de revisar VG) | si los tres relojes de `X.6.8` no van en orden (libro ≤ Nostr ≤ Bitcoin) más allá de sus márgenes (`epoch.7.3`): la única cuenta rara (VG 12-11, #42). Hoy, siempre falso | — |
| sealed | `X.6.8.5` (junto al reloj que comprueba; Core 12-11) | si la prueba del sello de tiempo copiada en `X.6.8.2` cuadra y la firmó un observador declarado por la cuenta raíz (§12; VG 12-11, #64 d y #67); PENDIENTE si falta el dato | `contrato.verificado` (`sello`), que ya solo la evalúa |
| received | `X.6.8.4` | si la firma del relé vale sobre el id del recibo copiado en `X.6.8.1`; PENDIENTE si falta el dato | `contrato.verificado` (`recibo`) |

Para leerlas, el contexto da dos posiciones más: `before.1`, los registros del libro por llegada, y `X.6.4`, lo que un registro atiende (los ids de su `contexto.atiende`; «attended» ya no lo usa desde el 3b: atender es anclarse sobre la petición). Por ejemplo, los registros no presentes del libro son `before.1 where not first it.6.1`. `test/lecturas-bqlm.test.js` comprueba cada lectura contra su función JS en los registros de los ejemplos.

**Las reglas que escriben** (encargo 3b; mapa §15 [D] N1, N2 y N3: «la obtención»). «writing a record gives ten P on it», «getting E gives ten P on its record» y «receiving R gives ten P on the root of its issuer» llevan `put` en su 4: no son condiciones (`EPOCA_0_BTML.condiciones` no las lleva; `EPOCA_0_BTML.escrituras` sí, y `evaluarRegla` las rechaza) ni lecturas. `evaluarEscritura(regla, contexto)` evalúa su 2 sobre la candidata y devuelve `{ estado, escrituras, motivo }`, con las colocaciones `[{ sujeto, camino, clave, valor, desde }]` que anotan sus `put` (`desde`, si el `put` va dentro de un `where`, es el elemento que se estaba mirando: el movimiento); lo que vale la fórmula no cuenta. El eje (`src/eje.js`, la obtención) traduce cada colocación en `A.2.1.(r)`, el P posicionado, en una acuñación de `P:r/A` a A (de origen A: encargo 3b-bis) en la misma transacción, después de sus movimientos, con la clase «obtencion» y por etiqueta el nombre de la regla; otras colocaciones no se asientan. **Lo que se coloca es un nivel, y la obtención es un tope acumulado** (decisión de VG tras el 3b-bis; sustituye a «una sola obtención por regla, titular y registro», de la revisión de seguridad del 3b): `put v at A.2.1.(r)` dice que el P obtenido por A sobre r por esa regla llega al menos a v, y el eje acuña con `tope: v` (la acuñación programada del libro, `docs/notas/CAPA_CERO.md` §1): solo lo que falte para que lo acuñado por esa regla a A sobre r llegue a v, y nada si ya llegó (entonces no hay paso). Nunca se quema por bajar el nivel. Varias colocaciones de la misma regla para el mismo A y r en una transacción se quedan con el máximo, no con la suma. Las dos reglas de E y de R calculan ese nivel como diez por **unidad neta recibida directamente del emisor** hasta la transacción incluida (lo de antes lo da la vista `A.8.6`, §4; lo de la transacción se suma encima; lo devuelto al emisor resta; lo que pasa entre tenedores ni suma ni resta), así que dos plazas en dos transacciones dan lo mismo que en una, una emisión de polvo del emisor solo da el P del polvo y un ir y venir de la misma E o R no acuña P sin fin. Un segundo tope, **por serie**, cierra el blanqueo por un tercero (A recibe, pasa la unidad a C, C la devuelve al emisor, el emisor se la da a A otra vez: el neto de A subiría sin fin): cada colocación lleva en `desde` el elemento del `where` en que se hizo (el movimiento, en estas dos reglas), y lo que una regla acuña por lo que llega de una serie no pasa, sumando todos los orígenes, de diez por unidad acuñada de esa serie (`eje.obtenidoDeSerie`, `docs/notas/CAPA_CERO.md` §1): la misma unidad no da P dos veces. Así nadie acuña P a mano: el P se obtiene o se reposiciona («P is repositioned one step at a time», §10.1).

**Las plantillas del motor** (encargo 3b, paso 2: el ciclo como una sola operación) también son BQL mínimo en la época, en su 9, evaluadas con `it` = el registro X: el recuento (`epoch.9.0.0`: «weighted sum», «weighted mean» y «threshold»; el umbral por defecto, 0, en su 2, la presión máxima, 9, en su 4, y en su 5 lo que no es una plantilla, con su motivo: «one per person», que exige identidad de fuera; encargo 3b-bis: cada compromiso cuenta por su origen, con «cualquiera» por cantidad de P y con nombres por reparto, la media abierta frente a todo el P del dominio y el umbral frente al P de los orígenes que cuentan), «cerrado» (`epoch.9.0.1`: «all announced movements happened», que el dueño de X nombra en el 2 de X), la zona de quien no está en ningún grupo (`epoch.9.0.2`) y «siguiente» (`epoch.9.0.3`: «what is missing» y las plantillas de transacción «move what was announced» y «commit P»); el orden del tutorial es `epoch.9.1`. Las lee `src/motor.js` (`docs/MOTOR.md`).

**Corregir una regla** no la modifica en sitio: se añade un ocupante a su registro, en la posición que corrige, con un archivo de `datos/epocas/correcciones/` `{ "sobre": <id de la regla>, "en": <la posición, un dígito>, "ocupante": <lo nuevo>, "de": <de dónde viene> }`. El registro de la regla y su id no cambian; el cargador pone el ocupante detrás de lo suyo y `evaluarRegla` lee el último ocupante del 2 (la condición) y del 9 (el mensaje). Así una regla corregida sigue siendo la misma regla, con su historia en sus ocupantes.

Las entradas de datos del contrato núcleo↔pantalla (encargo 3c-1: las plantillas, con `template` en su 4; el espacio de bloque, los niveles y los órdenes de `epoch.8`; las plantillas de dominio, las preferencias, los mensajes por idioma y las representaciones de `epoch.9`; y la lectura «maturity», en `X.8.1`) están en `docs/CONTRATO.md`.

## 6. La primera regla, leída

`first epoch.2`, «writing burns today's T», es una décupla del molde (mapa §16 [D]) con las diez posiciones llenas:

| | Lleva |
|---|---|
| 0 nombre | `writing burns today's T` |
| 1 constantes | `1` (al menos una quema), `epoch.7.0` (qué escalas mide el calendario: las que tienen asignación; A3), `epoch.1.3.1` (dónde están las asignaciones) |
| 2 condición | la fórmula de abajo |
| 3 a quién | `ev.3`: quien escribe |
| 4 qué primitiva vigila | `burn`, `transfer` (dar T a una cosa también gasta la asignación) |
| 5 dónde cuelga | `*`: toda transacción |
| 6 de dónde viene | VG, 7-11 noche (escribir consume T del autor), VG, 8-11 (T como asignación diaria), A3 (el calendario de la época), B1 (la asignación es de las personas) y A2 (sin excepción para el génesis) |
| 7 desde qué época | `epoch 0` |
| 8 orden | `first` |
| 9 mensaje | `writing burns today's T: {first ev.3} burns less T than writing costs ({first (first ev.8).6.1 * first epoch.7.0.1.1} seconds), or more T than is left today (day {ev.6.0.3})` |

La condición (desde el 12-11, #64 b, además de la quema y del límite del día, exige lo que calcula la regla «the cost of writing»: la T que el autor quema, en segundos —cada escala por su cantidad y los segundos de `epoch.7.0`, una suma de siete términos—, ha de llegar a `first (first ev.8).6.1 * first epoch.7.0.1.1`, lo mismo que da esa lectura; el texto completo está en `datos/epocas/reglas/writing-burns-today-s-t.json`). Abajo, sin ese término:

```text
=(count (ev.1 where T in it.0.0.0 and burn in it.4 and it.3.0 = first ev.3) >= 1
  and ((count (first ev.3).6 = 0 or first (first ev.3).6.3 = first ev.3)
       and count (ev.1 where T in it.0.0.0 and count epoch.7.0.(it.0.0.1) = 1 and it.3.0 = first ev.3 and it.3.1 != first ev.3
           and sum ((ev.1 where T in it2.0.0.0 and it2.0.0.1 = it.0.0.1 and it2.3.0 = first ev.3 and it2.3.1 != first ev.3) each 1)
             > epoch.1.3.1.(it.0.0.1).1 - sum (first ev.3).7.(it.0.0.1) + sum (first ev.3).1.(it.0).1) = 0
    or not (count (first ev.3).6 = 0 or first (first ev.3).6.3 = first ev.3)
       and count (ev.1 where T in it.0.0.0 and count epoch.7.0.(it.0.0.1) = 1 and it.3.0 = first ev.3 and it.3.1 != first ev.3
           and sum ((ev.1 where T in it2.0.0.0 and it2.0.0.1 = it.0.0.1 and it2.3.0 = first ev.3 and it2.3.1 != first ev.3) each 1)
             > sum (first ev.3).1.(it.0).1) = 0))
```

Leída: entre los movimientos de la transacción hay al menos uno que es T, se quema y sale de quien escribe; y ninguno de los movimientos de T de una escala con asignación (las que el calendario mide, `epoch.7.0`) que salen de quien escribe hacia otro (una quema o un regalo a una cosa) hace que lo que sale en esa escala pase, si quien escribe es una persona (escribió su propia alta, o aún no tiene: la escribe ahora), de la asignación del día de la época, menos lo ya gastado hoy, más el T explícito que tenga en su cartera; si es una cosa, del T de su cartera. El génesis no pasa por las reglas: es la época 0, fuera del sistema (encargo 3b, paso 5). Es lo que hoy comprueban dos condiciones envueltas de la capa cero: `FORMA` (`src/condiciones/evento.js`, fila EV-2: «escribir consume T del autor») y la sección TT-4 del ciclo (`src/condiciones/ciclo.js`: «T del día agotado»); el encargo 3 las sustituye por esta regla. Una cosa no tiene asignación: lo que gasta de más lo para el saldo del eje (la aritmética de saldos, el suelo), no esta regla (§8).

Dos cambios del encargo 2 (verificados por la familia T, §10): los filtros dicen `T in it.0.0` y `burn in it.4` en vez de `it.0.0 = T` y `it.4 = burn`, porque `ev.1` trae también lo que el payload tenga en su 1 (D-META colisiona) y comparar con `=` una lista de ese payload daba ERROR, así que la regla rechazaba eventos válidos (con el payload `["x", [[["a", "b"]], ["c"]]]`); `in` no da error y el payload no fabrica símbolos (SEG-09). Y la salida `or count up ev = 0` dejaba pasar el génesis, como la condición JS: el encargo 3b la retiró con las demás formas provisionales del génesis, porque el génesis es ahora la época 0 sin movimientos y no pasa por las reglas.

`evaluarRegla(regla, contexto)` lee el último ocupante del 2 (una corrección se añade detrás, §5), lo evalúa y devuelve `{ pasa, estado, motivo }`: pasa solo si da verdadero; si da falso, `motivo` es el último mensaje del 9 con cada `{expresión}` rellena (`rellenar`); si queda PENDIENTE o da ERROR, no pasa y el motivo lo dice. Una lectura (`read` en su 4) no es una condición: `evaluarRegla` la rechaza y se lee con `leerRegla` (§5). No mira el 3, el 4 ni el 5: todas las reglas de la época cuelgan de toda transacción (su 5 es `*`). Desde el encargo 3a la regla está conectada al eje (`src/condiciones/reglas.js`, §10); `test/primera-regla.test.js` (y, con las demás, `test/reglas-bqlm.test.js`) comprueba que da el mismo veredicto que la condición JS que sustituye en cada evento de los ejemplos de la compra y de la reserva, y en eventos inválidos hechos a mano.

## 7. Pendiente de integrar (para el libro)

Lo que el contexto lee hoy aparte y el libro de la capa cero tendría que dar como vista:

- **La cartera de una identidad** ya la da el libro (`libro.vista`); lo demás sale todavía de la envoltura del eje (`gastadoT`, `series`, `vivo`, `registroDe`, `sobre`).
- **Las series atadas a un registro**: hoy `eje.series()` entero, filtrado por `registro`, y `eje.vivo` serie a serie; el libro podría indexarlas por registro.
- **El T informativo gastado por identidad y día**: el eje lo lleva por registro (`tiempoInformativo`), no por persona y día; `A.7.e` de 7 a 9 queda vacío.
- **La asignación de cada identidad**: es de las personas, y persona es quien escribió su propia alta (B1: `first A.6.3 = A`), que la regla lee; si el libro acuña la asignación del día como una transacción, la regla leería la cartera y no necesitaría distinguir.
- **El reloj**: `before.6.0` es `eje.tMaximo()` y el de los demás, `before.6.3` (B6), `eje.tMaximo(excluidos)`.
- **El alta y lo emitido** (`A.6` y `S.8`, las vistas del encargo 2, §10): salen de `eje.alta` y `eje.serie`; el libro ya los tiene (`libro.alta` y la suma de lo acuñado como emisión).
- **`moves` de una identidad** recorre el diario entero del libro (no hay un índice por titular de «de o a»); `moves` de un registro usa el índice por ancla (`libro.asientos({ registro })`). `under` ordena el subárbol por llegada con un índice de `eje.orden` que el contexto rehace cuando el eje crece. Si `moves A` o `under` pesan en la carta, el libro podría indexar por titular y por subárbol (estudio BQL-transacciones, §5 paso 2: riesgo bajo-medio).

## 8. Para decidir VG

- **El texto de la primera regla.** El mapa nombra la regla («writing burns today's T») pero no la escribe; las diez posiciones son una propuesta [H] hecha con el molde.
- **La asignación de una cosa**: resuelto (VG, 10-11, B1): una cosa (su alta la escribió otra identidad) no tiene asignación; la regla lo lee del 3 de su alta y le cuenta solo el T de su cartera.
- **`A.7.e` es lo gastado de la asignación**, no solo lo quemado: incluye el T dado a una cosa, como el eje.
- **El orden de los ocupantes** de una posición: implícitos, propio del payload, escrito anclado.
- **Lo vacío**: `=` con nada es falso; la aritmética y el orden con nada, PENDIENTE; un elemento PENDIENTE en un where deja PENDIENTE todo el where (`docs/REGLAS_CORTAS.md`, duda 6).
- **`nth` desde 0**; **`path` con tope de diez**, y PENDIENTE si el hilo es más largo.
- **`before`**: 1 los registros, 2 lo bloqueado por salida, 3 las identidades, 5 el génesis, 6.0 el mayor t, 6.3 el reloj de los demás, 9 «demostración» [H].
- **El índice por valor** con un texto deja los ocupantes que se llaman así (su valor o los valores de su 0); con un dígito, es esa posición.
- **`each d` es lo mismo que `.d`** tras una expresión.
- **Los despliegues van por la forma del texto**, en cualquier sitio: un texto con forma de instante, de clave de serie, de id de registro, de identidad o de magnitud se despliega.
- **«nadie» no tiene literal**: es un símbolo que solo da el contexto; una regla lo compara con lo que lee de otro movimiento, no lo escribe.
- **Las referencias** se siguen leyendo solo el payload del otro registro (como `encaje.seguir`); una referencia sin dirección da el registro entero.
- **El año de D-FECHA** (§4).
- **La época como registro**: las familias en 1.0-1.3 (en el orden de `FAMILIAS`), cada una `[[nombre], [estructura], [estado]]`; las décuplas de dentro no se rellenan hasta diez (sin `[]` ni huecos; la raíz y cada regla sí llevan las diez); los principios y las dudas del JSON de siempre no pasan a la décupla. Los cinco criterios de P son, desde el encargo 3c-2a, las etiquetas de las miradas 1-5 (P por mirada); las seis zonas de R (`epoch.1.2.1`) son seis precios, con el equipo en «open record» (`docs/CONTRATO.md` §12).

## 9. Ejemplos

Sin eje, sobre un payload cualquiera leído como `epoch`:

```js
import { evaluar } from './src/bqlm.js';
import { ContextoEje } from './src/contexto-eje.js';

const lista = ['Lista', ['pan', 'leche', 'huevos'], [['12 EUR'], ['2026-11-09T10:30:00Z']]];
const ctx = new ContextoEje(null, { epoch: lista });
for (const e of ['epoch.1', 'count epoch.1', 'nth 1 epoch.1', 'epoch.1 where it != "leche"', 'epoch.2.0.1 * 2', 'epoch.2.1.3', 'epoch.1 = "pan"', 'epoch.9 + 1', 'FILTRAR(epoch.1)']) {
  const r = evaluar(e, ctx);
  console.log(e.padEnd(28), r.estado.padEnd(9), r.texto ?? r.motivo);
}
```

```text
epoch.1                      RESUELTO  pan, leche, huevos
count epoch.1                RESUELTO  3
nth 1 epoch.1                RESUELTO  leche
epoch.1 where it != "leche"  RESUELTO  pan, huevos
epoch.2.0.1 * 2              RESUELTO  24
epoch.2.1.3                  RESUELTO  20766
epoch.1 = "pan"              ERROR     comparar: es una lista de 3 (pan, leche, huevos); usa first, last, nth, count o sum
epoch.9 + 1                  PENDIENTE +: la posición está vacía, falta un valor
FILTRAR(epoch.1)             ERROR     no es BQL mínimo: «FILTRAR» (no hay funciones con nombre)
```

La compra de Ikisai como transacción candidata, con el eje de justo antes:

```js
import { evaluar } from './src/bqlm.js';
import { ContextoEje } from './src/contexto-eje.js';
import { EPOCA_0_BTML } from './src/epocas.js';
import { Eje } from './src/eje.js';
import { ejemploCompra } from './ejemplos/ikisai/compra-food.mjs';

const { eje, compra } = await ejemploCompra();
const antes = await Eje.desde(eje.orden.slice(0, -1).map((id) => eje.obtener(id)));
const ctx = new ContextoEje(antes, { ev: compra, epoch: EPOCA_0_BTML });
for (const e of ['first ev.3', 'ev.6.0', 'ev.6.0.3', 'ev.1.4', 'ev.1.0', '(ev.1 where it.4 = burn) each 0.0.1', '(first ev.3).1.("E:casa/EUR").1', '(first ev.3).7.2', 'epoch.1.3.1.2.1', 'count path ev']) {
  const r = evaluar(e, ctx);
  console.log(e.padEnd(36), r.texto ?? r.estado + ' ' + r.motivo);
}
```

```text
first ev.3                           huesped
ev.6.0                               2026-11-07T13:30:00Z
ev.6.0.3                             20764
ev.1.4                               burn, transfer
ev.1.0                               T:hora, E:casa/EUR, ensalada, guiso, fruta
(ev.1 where it.4 = burn) each 0.0.1  2
(first ev.3).1.("E:casa/EUR").1      60
(first ev.3).7.2                     0
epoch.1.3.1.2.1                      24
count path ev                        4
```

Leído: quien escribe es la persona huésped; el día civil de la compra es el 20764; sus dos movimientos son una quema y una transferencia; `ev.1.0` trae las dos series y, por la referencia del payload, los tres platos del menú; la quema es de la escala 2 (hora); antes de la compra tenía 60 EUR de la casa y no había gastado ninguna hora ese día; la asignación diaria de horas es 24; y el hilo de la compra tiene cuatro registros.

La primera regla, sobre dos eventos hechos a mano después de la compra (que gastó una hora):

```js
import { evaluarRegla } from './src/bqlm.js';
import { ContextoEje } from './src/contexto-eje.js';
import { EPOCA_0_BTML } from './src/epocas.js';
import { crearEvento } from './src/evento.js';
import { ejemploCompra } from './ejemplos/ikisai/compra-food.mjs';

const { eje, menu } = await ejemploCompra();
const regla = EPOCA_0_BTML.condiciones[0];
const horas = (n) => crearEvento({ autor: 'huesped', sobre: menu.id, t: '2026-11-07T16:00:00Z', movimientos: [{ token: 'T', escala: 'hora', cantidad: n, de: 'huesped', a: null }], payload: [n + ' horas'] });
for (const n of [23, 24]) {
  const ev = await horas(n);
  const r = evaluarRegla(regla, new ContextoEje(eje, { ev, epoch: EPOCA_0_BTML }));
  console.log(n, 'horas:', r.pasa ? 'pasa' : r.motivo, '| eje:', (await eje.validar(ev)).join('; ') || 'válido');
}
```

```text
23 horas: pasa | eje: válido
24 horas: writing burns today's T: huesped burns less T than writing costs (60 seconds), or more T than is left today (day 20764) | eje: writing burns today's T: huesped burns less T than writing costs (60 seconds), or more T than is left today (day 20764)
```

## 10. Las reglas de la época 0

Encargo 2 del plan del mapa (§16): las reglas de economía que eran condiciones en JavaScript escritas en BQL mínimo como décuplas del molde. Las tradujeron cinco familias en paralelo (T, ciclo, identidad, E y R) y cada una se verificó por equivalencia: evaluada con `evaluarRegla` sobre el eje de justo antes, frente a la condición JS que traduce, sobre el mismo eje, en los eventos de `node --test`, de los ejemplos de Ikisai, de `docs/comprobar.mjs` y de un fuzz por familia. **Encargo 3a (VG, 10-11): están conectadas al eje.** Cada regla del 2 de la época es una condición de la transacción (`src/condiciones/reglas.js`): se evalúa sobre el eje de antes y rechaza con el mensaje de su 9. Las condiciones JS que sustituyen se retiraron de `src/` y viven solo en `test/condiciones-retiradas.mjs`, donde la red de equivalencia las sigue comparando; la tabla de qué sustituye cada regla y qué queda en código está en `docs/notas/CAPA_CERO.md` §3. **Encargo 3b (VG, 8-11 y 9-11, mapa §15 y §16): las reglas del P como peso de criterio, de R según el corpus, de la atención con precio y de la invitación** entran en la época y se conectan igual; las que no traducen una condición JS (las cambia el mapa o son nuevas) se prueban en positivo y en negativo (`test/reglas-3b.test.js`), no por equivalencia.

Regla de oro (VG): si una regla no se puede escribir con el léxico, no se añade una función al BQL mínimo. Lo que falta es una posición (una vista o un despliegue), o la regla es suelo. Lo que no cabe queda en JavaScript, con su motivo (§10.3). El 3b solo añadió una palabra, `put` (con `at`), que el mapa ya tenía en el léxico. Las primitivas de verificación (§12, #67) no rompen la regla: no escogen nada del libro, calculan sobre bytes copiados en él.

**Cómo están en la época.** El 2 de la época es la lista de referencias a sus registros (§5): 30 condiciones, 3 reglas que escriben y 10 lecturas (las tres últimas, del encargo 3c-2a), cada una con las diez posiciones llenas; y, al final, las 10 lecturas de los puntos de vista (encargo «lecturas», issue #12: `point of view` en su 4, `EPOCA_0_BTML.lecturasDePv`), que no son condiciones ni se materializan: cada ocupante de su 2 es una fórmula con `it` = el nodo y `me` = su dueño, o `js <nombre>`, una lectura del núcleo en JavaScript donde este BQL no alcanza (`docs/CONTRATO.md` §4.4). El 8 de cada una encadena el orden: la primera es `first` y cada una va `after` la anterior; `EPOCA_0_BTML.condiciones` da las condiciones en ese orden, `EPOCA_0_BTML.escrituras` las que escriben y `EPOCA_0_BTML.lecturas` las lecturas. Se nombran por su 0, no por su lugar (la numeración «2.g.k» del encargo 2, de cuando iban en páginas de diez, ya no existe). La carpeta `datos/epocas/reglas-3b/`, con las traducciones del código de antes del 3b que esperaban fuera, se retiró: lo que el mapa §15 cambia ya está en la época.

**Qué pasa al validar.** Las reglas no se evalúan en el génesis (la época 0: el suelo, `src/condiciones/identidad.js`, comprueba que no mueve nada; lleva en su contexto la referencia a la época), en el prefijo de la versión 2 (suelo de persistencia), en un evento mal formado (la forma es suelo) ni en uno con una referencia a un evento ausente (C1: lo rechaza el suelo). Si alguna regla falla con un veredicto, rechaza con su 9, relleno con lo que vale en la candidata; si ninguna falla y alguna queda PENDIENTE, la primera en el orden del 8 rechaza con su estado y su motivo (lo que no se sabe no se acepta). Por eso «every record hangs on a record of the ledger» va la segunda: un foco que no está deja PENDIENTE a las que suben por él, y es ella la que lo dice. Después, si la transacción pasa, el eje evalúa las reglas que escriben y asienta lo que colocan (§5).

Todas leen los movimientos con `X in it.d` (por ejemplo, `T in it.0.0.0`, `mint in it.4`) y no con `=`: `ev.1` trae también lo que el payload tenga en su 1 (D-META colisiona), y `=` con una lista de ese payload da ERROR; `in` no da error y el payload no fabrica símbolos (SEG-09), así que solo cuentan los movimientos.

Prueba: `test/reglas-bqlm.test.js`. Cada regla que traduce una condición JS da el mismo veredicto que ella en todos los eventos de los ejemplos de Ikisai. En un fuzz corto con semilla fija da el mismo veredicto, salvo que sea más estricta en un evento que el eje ya rechaza por otro lado, o más laxa donde la forma (suelo) lo rechaza; y cada condición rechaza y deja pasar algún evento. Las reglas de la clave y la firma se ejercitan en un eje con claves y altas por invitación (B4). Las divergencias conocidas están como `test.skip` con su id y su motivo (§10.4); con `AGRAM_DIVERGENCIAS=1` se ejecutan y comprueban que siguen ahí. Las del 3b, en `test/reglas-3b.test.js`.

```js
import { evaluarRegla, evaluarEscritura } from './src/bqlm.js';
import { ContextoEje } from './src/contexto-eje.js';
import { EPOCA_0_BTML } from './src/epocas.js';
import { Eje } from './src/eje.js';
import { crearEvento } from './src/evento.js';
import { ejemploCompra } from './ejemplos/ikisai/compra-food.mjs';

const { eje, menu, compra } = await ejemploCompra();
const nombres = [[menu.id, '<menú>'], [compra.id, '<compra>'], [eje.alta('casa').id, '<alta de casa>']];
const sinIds = (s) => s.replace(/[0-9a-f]{64}|\b[0-9a-f]{8}\b/g, (x) => nombres.find(([id]) => id.startsWith(x))?.[1] ?? '<id>');
const { condiciones, escrituras, lecturas } = EPOCA_0_BTML;
console.log(condiciones.length, 'condiciones,', escrituras.length, 'reglas que escriben y', lecturas.length, 'lecturas');

// La huésped quema un minuto, emite un vale a nombre de la casa y acuña P a mano sobre el menú.
const malo = await crearEvento({ autor: 'huesped', sobre: menu.id, t: compra.t, payload: 'vale', movimientos: [
  { token: 'T', escala: 'minuto', cantidad: 1, de: 'huesped', a: null },
  { token: 'E', emisor: 'casa', denominacion: 'vale', cantidad: 1, de: null, a: 'casa' },
  { token: 'P', ambito: menu.id, cantidad: 1, de: null, a: 'huesped' }] });
const ctx = new ContextoEje(eje, { ev: malo, epoch: EPOCA_0_BTML });
for (const r of condiciones) {
  const v = evaluarRegla(r, ctx);
  if (!v.pasa) console.log('no pasa:', sinIds(v.motivo));
}
console.log((await eje.validar(malo)).map(sinIds));

// Lo que colocan las reglas que escriben al aceptar la compra (sobre el eje de justo antes).
const antes = await Eje.desde(eje.orden.slice(0, -1).map((id) => eje.obtener(id)));
for (const r of escrituras) {
  const { escrituras: w } = evaluarEscritura(r, new ContextoEje(antes, { ev: compra, epoch: EPOCA_0_BTML }));
  console.log(r[0][0].padEnd(50), w.map((x) => x.sujeto + ': ' + x.valor + ' P en ' + sinIds(x.clave)).join(' · ') || '—');
}
```

```text
31 condiciones, 3 reglas que escriben y 17 lecturas
no pasa: E is minted by and to its issuer: huesped mints E of casa, or to someone else
no pasa: P is repositioned one step at a time: huesped mints P that is not one step of its own P up (a tenth) or down (a tenth more), from one record to its parent, a child or one of its views, keeping its origin
no pasa: minting E needs own R issued: huesped mints E and has never issued R of its own
[
  'E is minted by and to its issuer: huesped mints E of casa, or to someone else',
  'P is repositioned one step at a time: huesped mints P that is not one step of its own P up (a tenth) or down (a tenth more), from one record to its parent, a child or one of its views, keeping its origin',
  'minting E needs own R issued: huesped mints E and has never issued R of its own'
]
writing a record gives ten P on it                 huesped: 10 P en <compra>
getting E gives ten P on its record                —
receiving R gives ten P on the root of its issuer  —
```

Leído: la huésped quema un minuto, emite un vale a nombre de la casa y acuña P a mano sobre el menú. Tres reglas no pasan, y el eje rechaza con sus tres mensajes: nadie emite E de otro; nadie acuña P a mano (el P se obtiene o se reposiciona, y esto no es un paso de su P hacia arriba ni hacia abajo); y para emitir E hay que haber emitido R propia. «minting E needs P on its record» pasa: el vale no nombra registro, así que queda atado al alta de su emisor (la de la casa, el génesis), y la huésped tiene P ahí desde que recibió la R de la casa con la invitación. Al aceptar la compra, las reglas que escriben colocan diez P para la huésped sobre la compra (la escribió ella). La cocina recibe euros de la casa, pero de la huésped, no de su emisora: no obtiene P (encargo 3b-bis: solo da P lo que llega de su emisor, diez por unidad); y la compra no mueve R.

### 10.1 Las reglas, leídas

En el orden del 8 (el de `EPOCA_0_BTML.condiciones`).

| Regla | Leída |
|---|---|
| writing burns today's T | Quien escribe quema T suyo, y en ninguna escala con asignación gasta más de lo que le queda hoy: si es una persona (escribió su propia alta, o la escribe ahora), la asignación de la época menos lo gastado hoy (`A.7.e`) más el T de su cartera; si es una cosa, solo el T de su cartera. Lectura completa en §6 |
| every record hangs on a record of the ledger | El foco de la transacción (su 6.5 implícito, leído con `first ev.6`) es un registro del libro de antes: desplegado, su 5 es su propio id. Sin excepción: el génesis es la época 0 y no pasa por las reglas (A2; se retira la forma provisional «no tiene foco») |
| every event moves tokens | Toda transacción lleva al menos un movimiento |
| T is whole | Ningún movimiento de T lleva decimales: media hora son treinta minutos. Que la cantidad sea un número positivo y un entero seguro es forma (suelo) |
| informative T is only burned | El T de las escalas que el calendario no mide (pasado, futuro, inventado: `epoch.7.0`) solo se quema, sin estado ni salida; las que se refieren a otra fecha (`epoch.7.2`) la llevan en su 7.1. Nada más lleva esa fecha ni una nota |
| locks keep their holder and name an exit | Un movimiento con estado (bloqueo o liberación) no acuña ni quema, tiene el mismo titular a los dos lados y lleva su salida |
| E is minted by and to its issuer | Toda E que se acuña tiene por emisor (el 1 de su serie) a quien escribe y va a su emisor |
| R is minted to its issuer | Toda R que se acuña nace en la cartera de su emisor; de ahí sale a los tenedores con una transferencia, y entonces hay doble entrada (el crédito del tenedor, la obligación del emisor) |
| who has a key signs | Si quien escribe tiene clave (en su alta, `A.6.5`, o la que declara ahora para sí en su propia alta, `ev.5`), firma: el segundo ocupante de `ev.3` es él (B4). Verificar la firma es suelo |
| without a key nobody acts | Quien escribe tiene clave, o el libro es de demostración (`before.9`) |
| a key is declared at its alta | Una clave declarada (en `ev.5`, detrás del id) es de quien aún no tiene cuenta y, o es quien escribe (su propia alta), o recibe algo en esta transacción (una cosa) |
| a declared key comes with its proof | La clave que se declara para otro (una cosa) lleva su prueba de posesión, en su 4; fuera de un libro de demostración. Verificar la prueba es suelo |
| not before its focus | La fecha de la transacción no es anterior a la de su foco (D-FECHA, en segundos) |
| not before the writer joined | Ni anterior al alta de quien escribe (`A.6`; su t es `A.6.6.0`) |
| at most a year ahead | Ni más de un año por delante del mayor t del libro (`before.6.0`). El año lo lee del calendario de la época, `epoch.7.0.6.1` (sus segundos: 364 + 1 días; VG, 10-11, A3). Con el libro vacío no hay tope |
| only persons mint | Solo acuñan las personas: quien escribió su propia alta (`first A.6.3 = A`, B1) o quien la escribe ahora |
| R is minted by its issuer | Nadie acuña R de otro: R:Y solo la acuña Y. Emitir R no exige colateral (VG, 9-11: el respaldo es la obligación de atender) |
| nobody mints T | Ninguna transacción acuña T: el T de cada día sale de la asignación de la época |
| T is not locked | Ningún movimiento de T bloquea ni libera: bloquear es de E, P y R |
| T only goes to things | T no cruza de persona: una persona da su T solo a una cosa, y una cosa a otra solo si las dos son del mismo dueño, si quien escribe escribió el alta de la destino o si tiene P posicionado en esa alta (el 3b retira el P del génesis y el que cubría el hilo). Dar tiempo a otro es acuñar E en él |
| E is tied to a record that exists | La E que se acuña nombrando un registro (el 5 de su serie) nombra uno del libro |
| locked P backing live E is not released | No se libera P bloqueado cuya salida es una serie de E (una franja, no la familia) que sigue viva tras la transacción: lo vivo antes (`X.1` del registro de la serie, con el reloj de la caducidad), más lo que se acuña ahora si no ha caducado, menos lo que se quema ahora |
| nobody moves tokens of others | Todo movimiento con origen (transferir, bloquear, liberar, quemar) sale de quien escribe, con una sola excepción: **aceptar su propia invitación**. Quien aún no tiene alta, anclado sobre una invitación que lo nombra como invitado en su 3.1, recoge para sí, con una transferencia desde quien la escribió cuya salida es él mismo, lo que esa persona guardó bloqueado con esa salida (revisión de seguridad del 3b: no vale para un tercero, ni desde otra identidad, ni ya con alta; el suelo de la capa 4, `src/validez.js`, lo repite para toda transferencia con salida desde otro titular) |
| P moves within a known scope | Todo P que se mueve va sobre un registro del libro (el ámbito de su serie lo es). Ya no hay P sobre «genesis» (mapa §15 retira «P del génesis sobre todo el eje») |
| P is repositioned one step at a time | Nadie acuña P a mano (mapa §15 retira «el autor de X acuña P:X»). Si la transacción acuña P, es un paso: quien escribe quema P suyo de un solo registro y lo acuña para sí en uno solo, su padre o un hijo; subir da una décima de lo quemado (`first epoch.1.1.4.2`, 0,1) y bajar, una décima más (`last epoch.1.1.4.2`, 1,1), con un margen de una milmillonésima (P es divisible). Lo quemado y lo acuñado son del mismo origen (el 0.2 de su serie; encargo 3b-bis: reposicionar no cambia quién lo obtuvo). Ir más lejos son varios pasos (N7: solo subir y bajar). El P que se obtiene no lo acuña la transacción, sino el libro (§5). Encargo 3c-2a (P por mirada): llevar P del registro entero a una mirada suya (`r` → `r.d`) es un paso hacia abajo y de la mirada al entero, uno hacia arriba; de una mirada a otra, o de una mirada al padre o a un hijo, son dos; la serie entera (ámbito con su mirada y origen) es la misma en todas las acuñaciones y en todas las quemas |
| minting R needs real T | Quien acuña R quema en la misma transacción T suyo de una escala que el calendario mide (`epoch.7.0`; el informativo no cuenta). La exigencia encadena E → P → R → T (N3) |
| minting E needs P on its record | Quien acuña E tiene, antes de la transacción, P posicionado (`(first ev.3).2.1`, de cualquier origen: el delegado de un grupo emite con lo que le delegan; [X] VG, encargo 3b-bis) en el registro al que la E está atada: su 5 o, sin registro nombrado, el alta de su emisor (N3, D2). Encargo 3c-2a: vale el P sobre el registro entero o sobre su mirada 1 (`r.1`, su E), no el de otras miradas |
| minting E needs own R issued | Quien acuña E ha emitido R propia: la tiene en su cartera, la tienen otros (su obligación, `A.8.1`) o la acuña en esta transacción. «R en juego» sin colateral (D1, D2) |
| attention has a price | Escribir sobre el alta de otra identidad, en cualquier dirección (su 3 entero, `3100000000`, `3.2`… y fuera del 3; el génesis es el alta de la primera identidad), cuesta el precio del grupo en que el receptor pone a quien escribe (mapa §16 [D] «PV3 = regla de atención»): el último de sus grupos (`A.3`) que lo nombra en su 3; si ninguno, el que le asignó la invitación que aceptó (su 8); si no, desconocidos (zona 0). El precio es el último 2 del grupo, `[[en qué], [cuánto]]`: «their R» la R de quien escribe, «my R» la R del receptor devuelta, «E», «P»; se paga con transferencias de quien escribe al receptor en la misma transacción. «nothing» es el veto: rechaza aunque pague. La única exención es la autoría: el dueño escribe en su propia alta sin pagarse (revisión de seguridad del encargo 3b). Encargo 3c-2a: el grupo y el precio ya no van escritos en la regla: son las lecturas «attention group» (`ev.6.3`) y «attention price» (`ev.6.2`) de la propia transacción; los seis grupos son seis precios (`epoch.1.2.1`), y el equipo paga «open record»: nada, si existe un registro abierto (con movimientos anunciados y pendientes, `X.4.8`) que nombre a los dos en su 3; «P» exige que el P esté sobre el dominio del destinatario (su alta en el hilo del registro del P) |
| a person joins by an invitation | Quien escribe sin alta (es su primera transacción: su alta) la ancla sobre una invitación (su 0 dice «invitation») de una identidad con alta que la nombra en su 3.1, dentro de su 7 (hasta cuándo vale, leído con el reloj de la caducidad de E: el menor entre el t de la aceptación y el reloj de los demás, `before.6.3`), sin fecharse antes del último t del libro (`before.6.0`; revisión de seguridad) y, si nombra una clave en su 3.5, con esa clave declarada. La única alta sin invitación es la del génesis, la primera identidad, que no pasa por las reglas |

Las tres reglas que escriben van detrás, en el mismo orden del 8 (§5):

| Regla | Coloca |
|---|---|
| writing a record gives ten P on it | `first epoch.1.1.4.1` (diez) P para quien escribe en el registro que escribe: `put … at (first ev.3).2.1.(first ev.5)` (N1). También en el génesis: la primera identidad tiene diez P sobre él |
| getting E gives ten P on its record | Para quien recibe E **directamente de su emisor** (`it.3.0 = it.0.0.1`), con alta, de una serie atada a un registro (su 5), el **nivel** de P sobre ese registro, de origen quien la recibe: diez por unidad neta de E atada a él recibida de su emisor, lo de antes (`sum (((first it.3.1).8.6 where E in it2.0.0.0 and it2.0.5 = it.5) each 1)`: las entradas de `A.8.6` cuyas series están atadas al mismo registro) más lo que llega en esta transacción de su emisor a la misma mano con el mismo registro (`sum ((ev.1 where E in it2.0.0.0 and transfer in it2.4 and it2.3.0 = it2.0.0.1 and it2.3.1 = it.3.1 and it2.5 = it.5) each 1)`). Encargo 3b-bis: por cantidad, no por cabeza; lo que pasa de tenedor a tenedor no da P. VG, tras 3b-bis: tope acumulado (§5): dos plazas en dos transacciones dan lo mismo que en una; varias series atadas al mismo registro suman; el polvo solo da el P del polvo. Encargo 3c-2a (P por mirada): coloca sobre la **mirada 1** del registro de la serie, `put … at A.2.1.(r).1` |
| receiving R gives ten P on the root of its issuer | Para quien recibe R **directamente de su emisor** (con alta el emisor), el **nivel** de P sobre el alta del emisor, la raíz de su dominio (N2: «quien te cede atención te da voz en lo suyo»): diez por unidad neta de esa R recibida de él, lo de antes (`sum (first it.3.1).8.6.(it.0).1`) más lo que llega en esta transacción (`sum ((ev.1 where R in it2.0.0.0 and transfer in it2.4 and it2.0 = it.0 and it2.3.0 = it.3.0 and it2.3.1 = it.3.1) each 1)`). La R que pasa de tenedor a tenedor y la que vuelve a su emisor no dan P; devolverla baja el nivel sin quemar nada, y recibirla otra vez no acuña hasta pasar el nivel ya alcanzado (VG, tras 3b-bis: tope acumulado, §5). Encargo 3c-2a (P por mirada): coloca sobre el **3** del alta del emisor, `put … at A.2.1.(alta).3` |

Las diez lecturas (present, informative, attended, obligation, share, weight, maturity, attention group, attention price, stage) están en §5; la madurez del encargo 3c-1, en `docs/CONTRATO.md` §5, y las tres del 3c-2a en `docs/CONTRATO.md` §12.

### 10.2 Condición JS ↔ regla

La tabla está en `docs/notas/CAPA_CERO.md` §3: cada condición que queda en `CONDICIONES`, con por qué sigue en código, y cada regla de la época con la condición JS que sustituye (retirada o a la vez) y su capa de validez. Lo que sigue en código es suelo (la forma, el id, el génesis, las referencias, la firma y las claves como criptografía, la atomicidad de los saldos y quién saca lo bloqueado con salida), el prefijo de la versión 2 (suelo de persistencia) y lo que aún no cabe (§10.3).

### 10.3 Lo que no cabe, con su motivo

Queda en JavaScript. Entre paréntesis, lo que falta: una posición (vista o despliegue) o una decisión de VG; o nada, porque es suelo.

| Condición | Motivo |
|---|---|
| VA-3 (ciclo y tope) y las variantes de la versión 2 dentro de la forma, el génesis y la firma | Es otro juego de reglas para un tramo del eje (el prefijo migrado de la versión 2), no una condición de la época 0: es suelo de persistencia (VG, 10-11, A4). Las reglas no se evalúan en él |
| EE-1, el contrato; EE-9 (divisible, emisores, enteros si no es divisible; la caducidad la fija la primera emisión) | El registro de la serie (B3) aún no despliega «divisible» ni «emisores» de una serie que ya no está viva (vista). Con esas posiciones se escriben con el léxico de hoy: «una ampliación no cambia divisible ni emisores», «sin divisible, `floor it.1 = it.1`» |
| EE-10 (la emisión conjunta: cada coemisor tiene su P bloqueado) | Faltan los coemisores del movimiento y la clave de familia de la serie (despliegue). Lo bloqueado de cada coemisor sí está en su cartera |
| EE-8 con la salida de una familia (franja «*»); EE-4 | La serie da la denominación con la franja dentro y la franja aparte, pero no la clave de familia ni la denominación sin franja, y sin operaciones de texto no se casa «cama@n1» con «cama@*» (despliegue). «locked P backing live E is not released» deja fuera esa salida |
| EE-2 (la capacidad de un registro) | La capacidad es un entero en el 2 del payload, pero el 2 puede llevar otras cosas y el léxico no tiene prueba de tipo (decisión VG: B2 la pone en la cruceta del 2 del recurso, 2.1) |
| EE-5 con EE-11 (el tope por franja) | Las vistas ya están (B6): lo vivo de todo el subárbol es `X.7.1` y caduca con el reloj de los demás (`before.6.3`). Falta cómo se declara la capacidad (EE-2) y la franja sin denominación (EE-4) para escribirla. EE-11 es el caso vacío |
| EE-7 (la cuota por P comprometido) | Sigue en JS con el P nuevo (`src/condiciones/tope.js`): frente al P comprometido de todos (D1) y con el subárbol en el numerador y en el denominador (F1). Los compromisos ya son una vista (`X.2.4`), pero falta la familia (EE-4), divisible (EE-9) y la capacidad (EE-2) |
| EE-3, EE-6, EE-12 | EE-3 es el 7 de la serie (su franja), que ya existe; EE-6 es la vista `X.1`; EE-12 es una propiedad del libro (nada se mueve solo al caducar: suelo) |
| RR-5 (atender) | «attended» es una lectura (§5) con el criterio por defecto (un registro del emisor anclado sobre la petición, con T real). Cómo declara cada uno su criterio de atención en su PV2 sigue [X] VG, y colgar reglas de una ruta (el 5 de la regla) también |
| RR-7, RR-8 (la lente, el valor de R para un lector) | Son lecturas de la interfaz y de BQL V0 (`src/lente.js`, `VALOR_R`): la lente es el 3 del lector, los grupos de atención cuyo precio es «their R» (§16: la lente de R y las condiciones de aceptación son la misma cosa); cada unidad vale una |
| BL-2, GN-1 «series finitas», TT-10 | Aritmética de saldos del libro (suelo) |
| Sacar lo bloqueado con salida de otro titular | Suelo (capa 4, `src/validez.js`): solo quien acepta su propia invitación, lo mismo que la excepción de «nobody moves tokens of others» |
| TT-11 (el T sobre un registro, en el 8, sin lo que cuestan sus bases) | Es una lectura del 8; la suma cabe (`sum ((((down X) each 1) where T in it.0.0.0 and it.0.0.1 = k and burn in it.4) each 1)`), pero ninguna posición dice qué hijo es una base (decisión VG) |
| TT-13, TT-14, TT-15, TT-17 (la escala incongruente, la recomendada, el coste de escribir, la banda de una distancia) | No rechazan nada o hoy no se aplican; necesitan contar las posiciones del contenido de un registro (despliegue) o un «ahora» que no es una posición (vista). A3 decide que escribir se cobra por posición escrita |

Resuelto en el encargo 3a y fuera de esta tabla: «solo las personas emiten», T entre personas y cosas y los tipos (B1: persona o cosa por autoría del alta); la firma, las claves y la demostración (B4: posiciones; verificar es suelo); EV-3 y RR-2 (B5: lecturas); RL-4 (B6: el reloj de los demás); TT-12 y TT-16 (A3: el calendario de la época).

Retirado o resuelto en el encargo 3b (mapa §15 y §16) y fuera de esta tabla: el P acuñado por el autor y el P del génesis (PP-2), la consolidación que amplía P y su guion de autorizar (PP-3, R3, BL-4: el motor ya no tiene paso de autorizar), el estrechamiento de P (PP-5: es reposicionar, «P is repositioned one step at a time»), el escalonado en JS (ES-1: «minting R needs real T», «minting E needs P on its record», «minting E needs own R issued»), el colateral de R (RR-3, RR-4 y la «R en juego» con colateral, RR-6), la R no fungible (RR-1: R se transfiere entre tenedores y se perdona quemándola; la rama R de `validarMovimiento` ya no está), la valoración de R por participación (RR-9), pedir atención (PV3: «attention has a price») y recibir R da P en la raíz del emisor (N2: una regla que escribe).

### 10.4 Divergencias conocidas

Lo que la verificación dejó sin el mismo veredicto, con la prueba que lo documenta (`test/reglas-bqlm.test.js`, `test.skip` con su id). Ninguna cambia el veredicto del eje: donde la regla es más laxa, lo para el suelo o el código que sigue.

| Id | Regla | Caso | Por qué |
|---|---|---|---|
| EE-4 | locked P backing live E is not released | liberar un bloqueo de familia con E viva: JS lo rechaza y la regla no lo mira | falta la clave de familia; `EE-8` sigue en JS a la vez |
| VA-3 | minting E needs own R issued | un evento del prefijo v2 que las reglas de la versión 2 aceptan; leída a mano, la regla lo rechaza | ninguna posición dice si un evento es del prefijo; las reglas no se evalúan en él (suelo de persistencia) |

Resueltas en el encargo 3a, ahora pruebas que pasan: D-META-1 y D-META-3 (C1), D-MOV-7 (B3), R10-T (B1), RELOJ-MS (C2) y RL-4 (B6). En el 3b dejan de serlo: GENESIS-GUARDA (el génesis ya no pasa por las reglas), PATH-10 (el escalonado lee el P posicionado en el registro, sin subir por el hilo) y RR-3 y RR-1 (el eje ya no exige colateral ni R no fungible).

En eventos que el eje rechaza por otro lado hay más diferencias, inofensivas: movimientos mal formados que JS aparta (`validosDe`) y la regla cuenta (las reglas no se evalúan si la forma falla); un movimiento null, con el que D-MOV lanza y la regla da ERROR; un autor sin alta (`A.7` vacío: PENDIENTE); y la salida que no es texto (el léxico no distingue un texto de un número; lo para la forma).

### 10.5 Para decidir VG

Lo marcado [X] en las cinco familias, en la integración y en los encargos 3a y 3b. Se suma a §8.

- **Las reglas de forma**: seis reglas («every event moves tokens», «T is whole», «informative T is only burned», «locks keep their holder and name an exit», «R is minted to its issuer» y la parte de forma de «E is minted by and to its issuer») repiten parte de `validarForma`, que sigue (suelo de forma: `crearEvento` lo usa). ¿Se retiran de `validarForma` y la forma queda solo como BTML, o se quedan las dos?
- **El génesis como la época 0** (encargo 3b, paso 5): el génesis es el alta de la primera identidad, sin movimientos, con la referencia a la época en su contexto; no pasa por las reglas de la época, sí por las que escriben (diez P sobre él). Su emisión inicial va en una segunda transacción [H].
- **Lo PENDIENTE al validar**: si ninguna regla falla con un veredicto, rechaza la primera que queda PENDIENTE, con su motivo, no con su 9 [H].
- **El prefijo de la versión 2**: queda como suelo de persistencia (A4); sus identidades conservan el tipo declarado, que el contexto lee como autoría (una persona escribió su propia alta) [H].
- **Las posiciones nuevas** son una propuesta [H] hecha con las reglas cortas de la época: las lecturas (`X.6.1`, `X.6.7`, `X.7.4`, `A.8.1`, `A.2.6.8`, `X.2.4.8`), lo que atiende un registro (`X.6.4`), los registros del libro (`before.1`), lo bloqueado por salida (`before.2`), el reloj de los demás (`before.6.3`), las series vivas del subárbol (`X.7.1`) y, del 3b, el criterio (`A.2.1`, `A.2.3`), los grupos de atención (`A.3`: precio en `3.k.2` y quiénes en `3.k.3` del alta) y los compromisos (`X.2.4`).
- **El 5 de un evento es solo suyo** (su id y sus claves): lo que el payload tenga en su 5 ya no se lee en `X.5` (B4) [H].
- **D-MOV**: en qué posición van «divisible» y «emisores» (EE-9, EE-10).
- **La serie**: una posición con la clave de familia o con la denominación sin franja (EE-4); el contrato de una serie que ya no está viva.
- **El año de D-FECHA**: el calendario de la época cuenta 364 + 1 días (A3); queda si el año de D-FECHA ha de seguir al civil (§4).
- **Cómo se declara la capacidad** de un registro (EE-2; B2 la pone en 2.1).
- **R**: si la acuñación puede ir directa al tenedor («R is minted to its issuer» dice que no); cómo declara cada uno su criterio de atención (RR-5) y colgar reglas de una ruta.
- **Lo que el 3b dejó abierto** [H]: un paso de reposición por transacción; el P de un registro es exacto (sin subárbol) para «minting E needs P on its record» y para «T only goes to things»; la obtención también para las cosas y sin exigir R (N3 dice «P exige R»); la R y la E solo dan P si llegan de su emisor ([X] confirmar VG; por unidad desde el 3b-bis, y como tope acumulado desde la decisión de VG tras el 3b-bis); las presiones como «nombre k» (una magnitud, D-VALOR) en el 2.3 de X; el umbral del recuento por defecto, 0, y «above x» en el criterio; el precio del equipo y los «cuánto» de las zonas; el literal «invitation» en inglés; la excepción de «nobody moves tokens of others» acotada a aceptar la propia invitación.
- **Datos de la época** que faltan: los órdenes de magnitud (TT-12) y el coste de escribir por posición (TT-15), que A3 decide.
- **Lo que el 3b-bis deja abierto** [H]: la presión es la del origen del P comprometido (no la de su titular); la obtención de E solo de su emisor y por unidad (la no repetición, que hacía que quien compra en dos veces obtuviera por la primera sola, la sustituyó VG por el tope acumulado: decidido); emitir y respaldar E con P delegado sigue valiendo; con nombres y «cualquiera» a la vez, el recuento es abierto; la media abierta, frente a todo el P del dominio; el mensaje de «one per person», en inglés como los de las reglas.

## 11. Mover: los verbos y el invariante del núcleo

VG, 12-11 (estudio BQL-transacciones, `docs/notas/DECISIONES_2026-11-12.md` #49, decisiones 5 a 8, y #48; ola 2 de la escritura). Lo que hasta ahora declaraban las plantillas de transacción en un segundo lenguaje (una décupla por movimiento en su 4, con el «extra» de la posición 2 y el texto `"nobody"`) se escribe en BQL. Todas las plantillas están migradas y la lista de antes se retiró (fusión con PV3); la nota `docs/notas/BQL_MUEVE.md` dice cómo y qué queda.

**Los verbos** (decisión 5). Los cinco símbolos que BQL ya tenía son verbos, con cinco palabras de enlace y la serie como posición de su familia:

| Verbo | Pide | Admite | Movimiento |
|---|---|---|---|
| `mint q S to A` | `to` | `price`, `when` | de nadie a A; `price Pr` es el precio de una emisión de E (`[[serie], [cuánto]]`) |
| `transfer q S from A to B` | `from`, `to` | `exit`, `when` | de A a B; con `exit`, la transferencia con salida (de lo bloqueado con ella) |
| `lock q S from A exit E` | `from`, `exit` | | bloquea con la salida E (de y a son A) |
| `release q S from A exit E` | `from`, `exit` | | libera lo bloqueado con la salida E |
| `burn q S from A` | `from` | `when` | de A a nadie; `when F` en un T informativo es la fecha a la que se refiere (`burn 1 T.8 from me when F`, el T futuro de antes); en T real lo anuncia para esa fecha (`burn 60 T.1 from me when F`: declarar T futuro desde el 12-11, #64 c) |

- **La serie** es un nodo cuyo valor es su clave: una serie de su familia (`R.(me)`, `T.1`) o una que ya se lee (`before.4.(first memo.1.0)`, `first (me.1 where … ) each 0`, `(first (moves X)).0`). Un texto o un número no son una serie (SEG-09): `transfer 1 "R:ana" …` es ERROR. Una serie vacía (una parte que falta) mueve con serie nula, y quien construye dice «no series».
- **`when`** en lo que no es un T informativo **anuncia** (decisión 8): el movimiento sale con estado «anunciado» y la fecha en `refiere` (su D-MOV 7.1); no toca saldos (§4, D-MOV; `docs/MOTOR.md`).
- **Cada verbo vale verdadero**, así que el condicional es `cond and verbo` (`and` es perezoso), las alternativas van con `or` y `M where (… and verbo …)` mueve una vez por elemento. **Lo que vale cero o nada no se mueve** (una cantidad que queda PENDIENTE es nada), como en la lista de antes.
- **`put v at A.1.(S).1`**, en una plantilla, es el **nivel en mano**: lo que A tiene disponible de S ha de llegar a v; se acuña (mint a A) solo lo que falte. Ningún otro destino en una plantilla.

`evaluarPlantilla(sentencias, contexto, { sujeto })` evalúa las sentencias del 4 de una plantilla, en orden, con `it` = X, `me` = quien la lanza, `ev` y `memo` = la candidata, con el mismo presupuesto (SEG-10), y devuelve `{ estado, movimientos, motivo }`: `[{ verbo, serie, cantidad, de, a, salida?, cuando?, precio? }]`. Lo que valen las sentencias no cuenta; cuenta lo que mueven. `src/acciones.js` (`transaccion`) recoge, redondea y pasa la forma (`validarMovimiento`).

<!-- comprobar: fragmento -->
```text
=put memo.1 at me.1.(R.(me)).1                        give own R: acuño la R propia que me falte…
=transfer memo.1 R.(me) from me to first it.3         …y se la doy al dueño de X
=lock first memo.1.1 before.4.(first memo.1.0) from me exit it          commit P
=burn first memo.1.1 T.1 from me when first memo.1.0                    declare future T (un anuncio de T con fecha)
=first ev.6.2.0 = "their R" and put first ev.6.2.1 at me.1.(R.(me)).1 and transfer first ev.6.2.1 R.(me) from me to first it.3
 or first ev.6.2.0 = "my R" and transfer first ev.6.2.1 R.(first it.3) from me to first it.3 or …                write to X
```

**El invariante del núcleo** (decisión 6): **las plantillas construyen y firma quien mueve; las reglas solo leen; el libro, por su cuenta, solo acuña hasta un nivel en una lista cerrada.**

1. **Una regla no mueve.** `evaluar` mira el árbol entero (`queMueve`): una fórmula con un verbo, evaluada fuera de una plantilla (una condición, una lectura, una lectura de un punto de vista, una regla que escribe, el 2 de una plantilla, un defecto, un mensaje), es ERROR aunque el verbo quede detrás de un `and` que da falso. El cargador de la época (`cargarEpocaBtml`) no carga una regla con un verbo, ni una que coloque sin ser una regla que escribe.
2. **Firma quien mueve.** La candidata que construye una plantilla es de quien la lanza (`autor`) y la firma él (`opciones.firmar`); un verbo que nombra lo ajeno se construye, pero no concede nada: lo rechaza «nobody moves tokens of others», y lo que no está en la cartera de quien lo mueve no sale (saldo insuficiente).
3. **El libro, por su cuenta, solo acuña hasta un nivel**: las reglas que escriben se aplican sin firma, así que solo colocan (`put`) y solo en `DESTINOS_DE_PUT` (`A.2.1`, la obtención de P). Un `put` en otro destino es ERROR.

Pruebas: `test/bqlm.test.js` (los verbos, la serie de su familia, el invariante, `put` y `memo`), `test/seguridad-bqlm.test.js` (SEG-14 y SEG-15: una regla con un verbo no se carga; lo que nombra lo ajeno lo rechaza la regla y lo firma quien lanza), `test/acciones.test.js` (la doble ejecución, cerrada: las sentencias mueven lo que movía la lista, `test/doble-ejecucion-esperada.json`; el coste, el anuncio y #48).


## 12. Primitivas de verificación

Core AGRAM, 12-11 (`docs/notas/DECISIONES_2026-11-12.md` #67; pedidas por Core StateArk para escribir el SIP 0, su `HUECOS_BQL.md`). BQL gana **primitivas puras de verificación**: comprueban, sin salir del libro, las pruebas que un registro trae copiadas (el sello de tiempo de `X.6.8.2`, un recibo de pago, un candado por hash, una firma). Son la única excepción a «no hay funciones con nombre» (§1) y a la regla de oro de §10: no escogen nada concreto del libro (eso sigue siendo posición), **calculan sobre bytes**, y eso no es una posición. Código: `src/cripto.js` (lo puro) y `src/bqlm.js` (`VERIFICACION`, `esBytes`, `COSTE_FIRMA`). Pruebas: `test/bqlm-cripto.test.js` (vectores) y `test/seguridad-bqlm.test.js` (SEG-16 a SEG-18).

**Por qué son lectura.** Sin efectos ni entrada/salida: solo leen sus argumentos (que el evaluador calcula como cualquier subexpresión), no llaman al contexto, no ven la red ni el reloj. **Nunca firman ni ven claves privadas**: de la librería vendorizada solo se usan `schnorr.verify` y, para el TapTweak, la aritmética pública de la curva (`schnorr.utils.lift_x`, `schnorr.Point`). No son verbos (`queMueve` no las cuenta: el invariante del núcleo de §11 sigue igual), así que una regla que las usa **sigue solo leyendo**: todo lo que verifica está en el libro, copiado en el registro. Que la cabecera sea de la cadena buena no lo puede decir una regla (H9 del SIP): tiene que entrar en el libro como dato firmado por quien la observa.

**El tipo bytes.** Un valor nuevo del evaluador, distinto de texto y número (`esBytes`): solo lo producen las primitivas. En los datos BTML los bytes viajan como **texto hex** y se convierten con `bytes(…)`; se leen (en un mensaje, en `texto`) en hex en minúsculas. Dos bytes son iguales si lo son byte a byte; bytes y texto nunca son iguales (`bytes("00ff") = "00ff"` es falso, como `1 = "1"`): para comparar con un hex del dato, `hex(b) = …` o `b = bytes(…)`. No tienen posiciones (se cortan con `slice`), no operan en la aritmética, no son clave de un índice por valor, de un `put`, de una salida ni de un precio.

| Forma | Da | Notas |
|---|---|---|
| `bytes(hex)` | bytes | longitud par, cifras 0-9 y a-f (mayúsculas o minúsculas); si no, ERROR |
| `hex(b)` | texto | en minúsculas |
| `utf8(texto)` | bytes | |
| `hash(x)` | bytes | SHA-256 de la serialización canónica BTML de x (`canonico`, la del id de evento): `hash("abc")` hashea `"abc"` con sus comillas; un número, su JSON; un registro, su valor (su id, como texto). Si x ya es bytes, hashea los bytes. Una décupla no tiene valor: ERROR |
| `hash(x, etiqueta)` | bytes | el hash etiquetado de BIP-340, `sha256(sha256(etiqueta) ‖ sha256(etiqueta) ‖ m)`, con m el canónico de x o x si es bytes |
| `sha256(b)`, `sha256d(b)` | bytes | sobre bytes; `sha256d` es el doble de Bitcoin |
| `cat(b1, b2, …)` | bytes | concatena (uno o más) |
| `slice(b, desde, hasta)` | bytes | índices de byte, fin excluido; `0 ≤ desde ≤ hasta ≤ largo` o ERROR |
| `reverse(b)` | bytes | el orden de Bitcoin: un explorador enseña txid y hash de bloque al revés de como se hashean |
| `le(b)` | número | entero little-endian sin signo de 1 a 8 bytes (ERROR si no cabe en un número exacto) |
| `below(a, b)` | verdadero o falso | a < b como enteros sin signo **big-endian**, de igual longitud. La prueba de trabajo: `below(reverse(first C.7), first C.8)` |
| `merkle(hoja, lados, hermanos, esquema)` | bytes, la raíz | esquema `"sip"` (SIP-0.md, normativo, el de `servidor/sim/stateark/merkle.js`): hoja = SHA-256(0x00 ‖ id), nodo = SHA-256(0x01 ‖ izq ‖ der), el impar sube sin duplicarse; `"bitcoin"`: la hoja es el txid (orden interno) tal cual, nodo = sha256d(izq ‖ der), el impar se duplica (su hermano es él mismo). El camino, de la hoja a la raíz, son **dos listas hermanas** (Core AGRAM 13-11, H18, «sin tuplas»): los lados (`"i"` si el hermano va a la izquierda, `"d"` si a la derecha) y los hermanos (en hex, como viajan en el dato, o en bytes), uno por paso; distinto número de lados que de hermanos es ERROR. **Ausentes o vacías, la raíz es la hoja** (en «sip», su hash de hoja: un lote de un solo id). La forma de tres argumentos (pares `[lado, hermano]`) se retiró |
| `ots(x, pasos)` | bytes | OpenTimestamps (13-11, H18): los pasos son **una lista de textos**, en orden, `"prepend <hex>"`, `"append <hex>"` o `"sha256"`, sin tuplas; da lo que llega. Sin pasos, x tal cual. El SIP 0 de hoy no la usa (el camino del lote a la cabecera es un `merkle(…, "bitcoin")`) |
| `cabecera(b)` | décupla | una cabecera de bloque de Bitcoin (80 bytes): 1 versión, 2 bloque anterior (bytes), 3 raíz de Merkle (bytes), 4 hora, 5 bits, 6 nonce (números), 7 hash del bloque (bytes, sha256d, orden interno), 8 objetivo (32 bytes big-endian, desde los bits) |
| `tx(b)` | décupla | una transacción cruda, con o sin testigo (BIP-144): 1 entradas (cada una 0 txid, 1 vout, y además 2 scriptSig, 3 secuencia), 2 salidas (cada una 0 sats, 1 script), 3 testigos (uno por entrada, sus elementos en su 0; vacío sin testigo), 4 locktime, 5 txid (bytes, orden interno: sha256d sin el testigo). ERROR si falta o sobra algo |
| `signed(firma, mensaje, clave)` | verdadero o falso | BIP-340: firma 64 bytes, mensaje 32, clave x-only 32, todos bytes (otro tipo es ERROR; otra longitud, falso). El mensaje de un registro firmado es `bytes(id)`: `signed(f, bytes(first ev.5), k)` |
| `lookup(claves, valores, clave)` | la lista de valores | Core AGRAM 13-11 (H17, «sin tuplas»): lo nombrado va en dos listas hermanas, las claves y los valores, en el mismo orden; da los valores de las posiciones donde la clave es esa, en su orden (varios si se repite, como «causa»), nada si ninguna. Si una de las dos es una décupla (valores que no son hojas), cada posición suya, hasta la primera vacía, es un elemento. Distinto número de claves que de valores es ERROR. Pura |
| `payload(X)` | décupla | Core AGRAM 13-11 (H19): el payload de un registro (o de la candidata) **tal como se escribió**, sin lo implícito (D-META, vistas, lecturas) ni lo anclado: en un registro guardado `X.3` lleva a su autor y `X.5` su id, y `(payload(X)).3` y `(payload(X)).5`, lo escrito. Es lectura del contexto, como una posición (`memo` solo vale para la candidata). ERROR si X no es un registro |
| `tapleaf(script)` | bytes, 32 | Core AGRAM 13-11 (H20 del SIP 0; VG: el sello ancla por Taproot, no por OpenTimestamps): el hash TapLeaf de BIP-341, `hash(cat(0xc0, compact_size(largo), script), "TapLeaf")`, versión de hoja Tapscript `0xc0`. La hoja de compromiso del sello es `tapleaf(cat(bytes("6a20"), lote))`: `OP_RETURN <32 bytes>`, la plantilla de Script «compromiso» del SIP 0 |
| `taptweak(interna, hoja, hermanos)` | bytes, 32 | H20: la clave de salida x-only de una salida P2TR (BIP-341): la raíz del árbol desde la hoja y sus hermanos (TapBranch, `hash(menor ‖ mayor, "TapBranch")`, **ordena sus hijos: el camino son solo los hermanos**, sin lados; en hex o en bytes, como en `merkle`; ausentes o vacíos, la hoja es la raíz), `t = hash(interna ‖ raíz, "TapTweak")` y `Q = lift_x(interna) + t·G`; da la x de Q. Una interna que no es la x de un punto de la curva, un `t` que no es escalar o un hermano que no son 32 bytes: ERROR. Solo aritmética pública, sin secretos. El script de la salida es `cat(bytes("5120"), taptweak(…))` |

Se escriben como llamadas, con su número de argumentos (`VERIFICACION`, el analizador lo comprueba: `merkle(a, b)` es ERROR de sintaxis, «lleva 4 argumentos»). Cada argumento es un ocupante, como en la aritmética (G3): vacío, PENDIENTE; de más de uno, ERROR; salvo los lados y los hermanos de `merkle`, los pasos de `ots` y las claves y los valores de `lookup`, que son listas (y pueden faltar). Lo que devuelven `cabecera` y `tx` es una décupla pura que se lee por posiciones como cualquier otra (`first cabecera(b).3`, `tx(b).2 where first it.0 = 50000`).

**Coste.** Cada primitiva da un paso y **paga en el presupuesto los bytes que procesa antes de procesarlos** (`Presupuesto.gastarBytes`): `bytes` la mitad del texto, `hash` y `sha256` lo que hashean, `cat` lo que junta, `tx` el doble de la transacción (leerla y su txid), `cabecera` 160, cada paso de Merkle 65 o 96, `signed` `COSTE_FIRMA` (65 536: verificar una firma cuesta como hashear unos 64 KB), `tapleaf` lo que hashea y `taptweak` `COSTE_TAPTWEAK` (como una firma: subir la interna a un punto y multiplicar el generador) más 96 por nodo. El tope es `LIMITES.bytes`, 2 000 000 por evaluación (`opciones.limites.bytes`), y pasarse es PENDIENTE POR LÍMITE, como los demás límites (§3). Una transacción de 100 KB cabe (200 KB); una de 1 MB se corta sin llegar a leerse; un `cat` o un `signed` dentro de un `where` largo se corta igual. Unas treinta firmas por evaluación.

**El SHA-256 y la curva.** El SHA-256 es el de `@noble/hashes` que ya iba dentro de `src/vendor/noble-secp256k1.js`, exportado con `schnorr` (el único retoque del empaquetado; Web Crypto es asíncrono); las pruebas lo cruzan con `node:crypto` y con el hash etiquetado de noble. El TapTweak usa la aritmética de la curva que `schnorr` ya exporta (`utils.lift_x`, `Point`): el vendor no exporta nada de más (`src/vendor/LEEME.md`). Las pruebas de `tapleaf` y `taptweak` usan los vectores de rust-miniscript de Core StateArk (`test/vectores-miniscript.js`) y los cruzan con la secp256k1 mínima y el árbol Taproot de la simulación (`servidor/sim/stateark/secp.js` y `taproot.js`).

**«Verificado», una regla de la época** (VG 12-11, #64 d y #67; encargos «verificado-regla» y «taproot»). La lectura «sealed» (`X.6.8.5`) comprueba con estas primitivas la prueba que el registro trae copiada en `X.6.8.2`, la décupla del sello de tiempo del SIP 0 (0a445b2, sin huecos ni tuplas; desde el 13-11 **ancla por Taproot**: 1 altura, 2 hash, 3 raíz del lote, 4 el id sellado, 5 instante, 6 vía «taproot», 7 lo observado — 7.0 cabecera, 7.1 firma del observador, 7.2 altura LE, 7.3 su clave y, si los hay, 7.4 los lados y 7.5 los hermanos del camino «bitcoin» de la transacción de anclaje a la cabecera —, 8 el anclaje — 8.0 la transacción de anclaje, 8.1 la salida, 8.2 la clave interna y, si los hay, 8.3 los hermanos Taproot —, 9 el camino «sip», 9.0 lados y 9.1 hermanos, si lo hay). La cadena: id → árbol «sip» → raíz del lote → hoja de compromiso `OP_RETURN <raíz>` → árbol Taproot → TapTweak → salida P2TR de la transacción de anclaje → camino «bitcoin» → cabecera firmada por el observador. Con S el sello, T la transacción de anclaje y C su cabecera (el texto completo, en `datos/epocas/reglas/sealed.json`):

<!-- comprobar: fragmento -->
```text
S = (first ((first it.6).8.2 where "sello de tiempo" in it2.0))      el sello copiado (lo del núcleo: first it.6)
T = (first tx(bytes(first S.8.0)))       C = (first cabecera(bytes(first S.7.0)))
=bytes(first S.4) = bytes(first it.5)                                                         la hoja es el propio registro
 and cat(bytes("5120"), taptweak(bytes(first S.8.2), tapleaf(cat(bytes("6a20"), bytes(first S.3))), S.8.3))
       = first (nth (first S.8.1) T.2).1                                  el lote está comprometido en la salida del anclaje
 and merkle(first T.5, S.7.4, S.7.5, "bitcoin") = first C.3                                    el anclaje llega a la cabecera
 and hex(first C.7) = first S.2 and below(reverse(first C.7), first C.8)                       su hash y su prueba de trabajo
 and le(bytes(first S.7.2)) = first S.1                                                        la altura firmada es la del sello
 and signed(bytes(first S.7.1), hash(cat(bytes(first S.7.0), bytes(first S.7.2)), "StateArk/Observador/Cabecera/v1"), bytes(first S.7.3))
 and first S.7.3 in before.8.6                                                                 un observador de la cuenta raíz
 and hex(merkle(bytes(first it.5), S.9.0, S.9.1, "sip")) = first S.3                           el id llega a la raíz del lote
 and "taproot" in S.6
```

Las posiciones del sello (`S.1`, `S.7.0`, `S.8.2`…) no van fijadas a mano: salen de un solo mapa, `POSICIONES_DEL_SELLO` de `src/sello.js` (la forma de la simulación 0ddd6e7, SIP 0a445b2: `decuplaDeSello` da la misma décupla que `selloComoDecupla`), y la fórmula de `sealed.json` es la que escribe `formulaDeSellado()` (una prueba lo comprueba): si StateArk cambia la décupla del sello, se cambian el mapa y `decuplaDeSello` y se reescribe la fórmula. **El orden importa**: lo que lee la transacción, la interna y la cabecera va antes que lo que sin ellas podría dar falso (el camino «sip», la vía), así que lo que falta (sin sello; sin cabecera, firma o clave; sin la transacción, el vout o la clave interna) la deja PENDIENTE, porque `bytes` de nada es PENDIENTE (§3): nunca verdadera. Una clave fuera de `before.8.6`, una firma mala, una interna o un hermano Taproot manipulados o una prueba que no cuadra la dejan falsa (una interna que no es un punto de la curva, ERROR). `ots` queda como primitiva probada sin uso. La lectura «received» (`X.6.8.4`) es `signed(bytes(first R.3), bytes(first R.4), bytes(first R.2))` con R = `(first ((first it.6).8.1 where "recibo de llegada" in it2.0))`, el recibo copiado: la firma del relé sobre el id de su recibo. La lectura **«paid»** (`X.6.8.6`, encargo «taproot») comprueba el recibo de pago de StateArk copiado en `X.6.8.3` (`eje.marcarPago`; `docs/CONTRATO.md` §4.4), con R = `(first (first it.6).8.3)` (0-4 la décupla del recibo, 5 emisor, 6 t, 7 id del sobre, 8 firma: `POSICIONES_DEL_PAGO`, y la fórmula, `formulaDePago()`): `signed(bytes(first R.8), bytes(first R.7), bytes(first R.5))`, que es un recibo de pago, que el txid de `tx(R.4.0)` es el sujeto y con el camino `R.4.2`, `R.4.3` llega a la raíz de `cabecera(R.4.1)`, que la cabecera da el «bloque» del recibo (`lookup(R.2, R.3, "bloque")`) con prueba de trabajo, y que una salida paga «cuánto» en sat al script «destino» (`count (T.2 where first it2.0 = first (first lookup(R.2, R.3, "cuánto")).1 and hex(first it2.1) = first lookup(R.2, R.3, "destino")) >= 1`). `contrato.verificado` las evalúa (`docs/CONTRATO.md` §4.4) y las estaciones de `epoch.4.3` leen «sealed» («sin verificar no se ejecuta», `docs/MOTOR.md` §4.1). Pruebas: `test/verificado-regla.test.js`, `test/bqlm-cripto.test.js` (la cadena entera de un sello de la simulación), SEG-19 y SEG-20 en `test/seguridad-bqlm.test.js`.

**El SIP 0** (Core StateArk, `InTheState/stateark/sip/`, solo lectura) escribe sus reglas con estas formas; `test/bqlm-cripto.test.js` comprueba que `analizar` las acepta todas, también «sealed» con `tapleaf` y `taptweak` (H20, SIP 0a445b2); su primer borrador escribía `merkle(hoja, camino)` sin esquema.

```js
import { evaluar } from './src/bqlm.js';
import { ContextoEje } from './src/contexto-eje.js';

// El bloque génesis de Bitcoin, copiado como dato: su cabecera (80 bytes en hex) y un camino de Merkle vacío.
const genesis = '0100000000000000000000000000000000000000000000000000000000000000000000003ba3edfd7a7b12b27ac72c3e67768f617fc81bc3888a51323a9fb8aa4b1e5e4a29ab5f49ffff001d1dac2b7c';
const ctx = new ContextoEje(null, { epoch: [[genesis]] });
const c = 'first cabecera(bytes(first epoch.0))';
for (const e of ['hex(sha256(utf8("abc")))', 'bytes("00ff") = "00ff"', c + '.4', 'hex(reverse(' + c + '.7))', 'below(reverse(' + c + '.7), ' + c + '.8)', 'hash', 'merkle(bytes("00"), epoch.9)', 'sign(bytes("00"))']) {
  const r = evaluar(e, ctx);
  console.log(r.estado.padEnd(9), r.texto ?? r.motivo);
}
```

```text
RESUELTO  ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad
RESUELTO  false
RESUELTO  1231006505
RESUELTO  000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f
RESUELTO  true
ERROR     sintaxis: hash es una primitiva de verificación y se escribe con sus argumentos entre paréntesis: hash(x) o hash(x, etiqueta)
ERROR     sintaxis: merkle(hoja, lados, hermanos, esquema) lleva 4 argumentos, no 2
ERROR     no es BQL mínimo: «sign» (no hay funciones con nombre)
```

Leído: el SHA-256 de «abc»; bytes y texto no son iguales; la hora del génesis; su hash, al revés, es el que enseña un explorador; cumple su prueba de trabajo; y las tres formas mal escritas dan ERROR con su motivo: una primitiva sin paréntesis, `merkle` sin esquema y una firma, que no existe.
