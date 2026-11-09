# BQL mínimo (BQLM)

El BQL mínimo es el álgebra con la que se escriben las condiciones de las reglas de la época: traer posiciones, aplicar una posición a cada elemento, filtrar, contar, sumar y comparar. Viene de dos decisiones de VG (mapa §15 y §16, 9-11): «todo son reglas», escritas en BQL y leídas desde la época, no desde código; y «BQL es un lenguaje para manejar la matriz de BTML», con un léxico de palabras cortas en inglés. Lo que sea «escoger algo concreto» (el día de una fecha, la familia de una serie, la cartera de alguien) no es una función: es una **posición** que el contexto despliega.

Este documento describe lo que existe en `src/bqlm.js` (el analizador y el evaluador) y `src/contexto-eje.js` (el contexto sobre el eje). Todavía no sustituye a nada: `src/bql.js` (BQL V0, `docs/BQL.md`) sigue igual, y las reglas de la época 0 (§6 y §10) no están conectadas al eje: el eje sigue usando las condiciones de JavaScript. Pruebas: `test/bqlm.test.js`, `test/contexto-eje.test.js`, `test/epoca-btml.test.js`, `test/primera-regla.test.js`, `test/reglas-bqlm.test.js` (cada regla de la época frente a su condición JS) y, de la revisión de seguridad, `test/seguridad-bqlm.test.js` (SEG-09 a SEG-12: el payload no fabrica movimientos ni «nadie»; el presupuesto de ocupantes; las salidas y series con nombres reservados, `__proto__`, `constructor`, `prototype`, que la validación de movimientos rechaza y el libro guarda como claves propias).

```js
import { analizar, evaluar, evaluarRegla, rellenar, textoDe, ESTADOS, PALABRAS, PRIMITIVAS, LIMITES, POR_LIMITE, SIMBOLOS, NADIE, esSimbolo, Presupuesto, Parada, pendiente, porLimite } from './src/bqlm.js';
import { ContextoEje, NADIE, primitivaDe, desplegarFecha, desplegarSerie, desplegarValor } from './src/contexto-eje.js';
import { cargarEpocaBtml, EPOCA_0_BTML } from './src/epocas.js';
```

## 1. Léxico

Exacto y nada más. Cualquier otro nombre da ERROR «no es BQL mínimo: «X»»; si va seguido de un paréntesis, además «(no hay funciones con nombre)».

| Qué | Se escribe | Lectura |
|---|---|---|
| posición | `X.d.d…` | los ocupantes de esa posición de X; X es `ev`, `epoch`, `before`, `it`, `it2`… o una expresión entre paréntesis |
| índice por valor | `X.(expr)` | si expr vale un dígito 0-9, esa posición; si vale un texto, los ocupantes de X que se llaman así |
| primero, último, k-ésimo | `first M`, `last M`, `nth k M` | `nth` cuenta desde 0, como los ocupantes de una lista |
| aplicar una posición | `M each d.d…` | la posición d de cada elemento de M (lo mismo que `(M).d`) |
| filtrar | `M where cond` | los elementos que cumplen cond; dentro, `it` es el elemento; en un where anidado, `it2`, `it3`… |
| árbol | `up X`, `down X`, `path X` | el padre por el ancla 6.5; los registros anclados sobre X; el hilo de X hasta la raíz (tope de diez niveles) |
| recuento | `count M`, `sum M`, `max M`, `min M` | |
| aritmética | `+ - * /`, `floor x`, `-x` | solo números |
| comparación | `= != < <= > >=` | el orden, solo entre números |
| lógica | `and`, `or`, `not`, `x in M` | `and` y `or` son perezosos |
| literales | `12`, `2.5`, `"texto"` | |
| símbolos | `mint transfer lock release burn`, `E P R T` | símbolos del libro: se leen por su nombre, pero no son texto (`burn = "burn"` es falso; §3) |
| nombres | `ev`, `epoch`, `before` | la transacción candidata, el registro de la época, el libro de antes |

`put v at X.d` (colocar, solo para reglas que escriben) está en el léxico del mapa pero no en este encargo: hoy da «no es BQL mínimo».

## 2. Gramática

```text
expresión   := disyunción ('where' disyunción)*        where se lleva todo lo que queda a su derecha
disyunción  := conjunción ('or' conjunción)*
conjunción  := negación ('and' negación)*
negación    := 'not' negación | comparación
comparación := suma (('=' | '!=' | '<' | '<=' | '>' | '>=' | 'in') suma)?     sin encadenar
suma        := producto (('+' | '-') producto)*
producto    := prefija (('*' | '/') prefija)*
prefija     := ('first' | 'last' | 'count' | 'sum' | 'max' | 'min' | 'floor' | 'up' | 'down' | 'path' | '-') prefija
             | 'nth' prefija prefija
             | posfija
posfija     := primaria ('.' dígitos | '.' '(' expresión ')' | 'each' dígitos)*
dígitos     := dígito ('.' dígito)*                    cada dígito, uno solo: ev.12 es un error («escribe 1.2»)
primaria    := número | "texto" | símbolo | 'ev' | 'epoch' | 'before' | 'it' | 'it2' | … | '(' expresión ')'
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
- **`up`, `down`, `path`** solo valen sobre registros (la candidata `ev`, un registro del eje o el texto de su id); sobre otra cosa son ERROR. `path` da el registro y sus antepasados; si el hilo pasa de diez, PENDIENTE.
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

`new ContextoEje(eje, { ev, epoch })` lo implementa sobre el eje actual, **sin modificarlo**: `ev` es la transacción candidata (un evento que aún no está en el eje: el eje es el libro de antes), `epoch` la época (`EPOCA_0_BTML` o su décupla). Sin eje (`new ContextoEje(null, { epoch })`) solo lee payloads y despliegues.

**Cómo se baja.** Un dígito cada vez, y lo que queda del camino se aplica a cada ocupante: `X.a.b` es siempre `(X.a).b`. En el payload se baja por la raíz y por las décuplas; una lista da sus elementos; una referencia, lo que alcanza en el payload del otro registro (como `encaje.seguir`: sin entrar en listas) o el registro entero si no lleva dirección; una hoja, su despliegue. En un registro del eje, lo escrito anclado en una posición es ocupante de esa posición (por llegada, después de lo propio), y lo escrito anclado exactamente en el camino entero también lo es aunque el payload no tenga una décupla por medio (como `encaje.ocupantes` con `exacto`).

**Orden de los ocupantes** de una posición: los implícitos (D-META y las vistas), lo propio del payload y lo escrito anclado.

**Despliegues** (los de `docs/notas/INVENTARIO_REGLAS.md` §2.2):

| Código | Qué despliega | Posiciones |
|---|---|---|
| D-META | un evento (la candidata o un registro del eje) | 3 autor y firmante (el firmante solo si va firmado), 5 id, 6.0 t, 6.5 sobre y en, 1 los movimientos, que colisionan con lo que el payload tenga en su 1 |
| D-MOV | un movimiento | 0 su serie (la clave, que se despliega con D-SERIE), 1 cuánto, 2 estado, salida y caducidad (las que haya), 3.0 de, 3.1 a (null es el símbolo «nadie», `NADIE`), 4 la primitiva, un símbolo (`mint` si de = null, `burn` si a = null, `lock` y `release` por el estado, si no `transfer`), 5 el registro de la serie (E), 7 caducidad o fecha a la que se refiere, 9 nota |
| D-SERIE | una clave de serie | 0 familia (un símbolo si la serie viene del libro: la de un movimiento, una entrada de la cartera o una serie atada; un texto si es una clave escrita en el payload), 1 la escala de T como dígito (segundo 0 … año 6, pasado 7, futuro 8, inventado 9), el emisor (E, R) o el ámbito (P), 2 denominación, 5 registro, 7 franja |
| D-FECHA | un instante ISO con zona | k = el número de periodo de la escala k desde 1970-01-01T00:00Z, en UTC: 0 segundo, 1 minuto, 2 hora, 3 día civil (`tokens.diaCivil`), 4 semana, 5 ciclo de 28 días, 6 año |
| D-VALOR | un terminal «12 EUR» o «EUR 12» (con espacio) | 1 cuánto, 2 unidad; solo lectura |

La convención del año de D-FECHA: años de 364 + 1 días (`tokens.SEGUNDOS.anio`, trece ciclos de 28 días y uno más) contados desde el 1 de enero de 1970, sin bisiestos; la semana cuenta desde ese día, que fue jueves. Es un número de periodo para comparar y agrupar, no una fecha del calendario civil ([X] decidir VG si el año ha de seguir al civil).

Un texto se despliega por su forma: un instante (D-FECHA), una clave de serie (D-SERIE), el id de un registro del eje (el registro), una identidad con alta (sus vistas) o una magnitud (D-VALOR). Sigue valiendo su texto para comparar.

**Vistas del libro como posiciones** (a la fecha de la candidata):

| Posición | Qué es | De dónde sale |
|---|---|---|
| `A.1` | la cartera de la identidad A: un ocupante por serie con algo disponible o bloqueado; cada uno, 0 la serie, 1 lo disponible, 2 lo bloqueado, un ocupante por salida (0 la salida, 1 cuánto) | `eje.libro.vista` (la capa cero, `docs/notas/CAPA_CERO.md`) |
| `A.6` | el alta de la identidad A: el registro que abrió su cuenta (`epoch.3.6`, «pasado: de dónde viene»); `A.6.6.0` es su t y `A.6.3` su autor. Sin alta en el eje, nada | `eje.alta`, `eje.obtener` |
| `A.7.e` | el T de la escala e (0-6) gastado de la asignación del día civil de `ev.6.0.3`: consumido o dado a una cosa; en las escalas informativas (7-9), nada | `eje.gastadoT` |
| `X.1` | de un registro de recurso: sus series de E atadas y vivas; cada una, 0 la serie, 1 lo vivo, 7 la caducidad | `eje.series`, `eje.vivo` |
| `S.8` | de una serie del libro S (la de un movimiento, `ev.1.0`, o la de una entrada de la cartera, `A.1.0`): lo emitido hasta antes de la candidata [H]; una clave escrita en el payload no la tiene | `eje.serie` |
| `before.3` | las identidades del libro | `eje.identidades` |
| `before.5` | el génesis | `eje.genesisId` |
| `before.6.0` | el mayor t del libro | `eje.tMaximo` |

El contexto no lee el tipo de ninguna identidad (R10, `test/neutralidad-reglas.test.js`).

## 5. La época como registro

`datos/epocas/epoca-0.btml.json` es la época 0 como décupla BTML, leída con la cruceta; `cargarEpocaBtml` la carga y `EPOCA_0_BTML` la expone como `epoch`. Su forma está en `docs/BTML.md` §12. Con el BQL mínimo: `epoch.1.3.1.e.1` es la asignación diaria de la escala e (lo que el mapa escribe `epoch.T.e.1`), `epoch.5.p.d.0` el nombre de la regla corta del dígito d en la profundidad p y `epoch.2.0.0` la primera regla. Las reglas del 2 van en páginas de diez por su orden (una décupla no lleva más de diez ocupantes que no son hojas): `epoch.2.g.k` es la regla 10·g + k, y `EPOCA_0_BTML.condiciones` las da en una lista (§10).

## 6. La primera regla, leída

`epoch.2.0.0`, «writing burns today's T», es una décupla del molde (mapa §16 [D]) con las diez posiciones llenas:

| | Lleva |
|---|---|
| 0 nombre | `writing burns today's T` |
| 1 constantes | `1` (al menos una quema), `7` (la primera escala sin asignación), `epoch.1.3.1` (dónde están las asignaciones) |
| 2 condición | la fórmula de abajo |
| 3 a quién | `ev.3`: quien escribe |
| 4 qué primitiva vigila | `burn`, `transfer` (dar T a una cosa también gasta la asignación) |
| 5 dónde cuelga | `*`: toda transacción |
| 6 de dónde viene | VG, 7-11 noche (escribir consume T del autor) y VG, 8-11 (T como asignación diaria) |
| 7 desde qué época | `epoch 0` |
| 8 orden | `first` |
| 9 mensaje | `writing burns today's T: {first ev.3} burns no T, or more T than is left today (day {ev.6.0.3})` |

La condición:

```text
=(count (ev.1 where T in it.0.0 and burn in it.4 and it.3.0 = first ev.3) >= 1
  and count (ev.1 where T in it.0.0 and it.0.1 < 7 and it.3.0 = first ev.3 and it.3.1 != first ev.3
      and sum ((ev.1 where T in it2.0.0 and it2.0.1 = it.0.1 and it2.3.0 = first ev.3 and it2.3.1 != first ev.3) each 1)
        > epoch.1.3.1.(it.0.1).1 - (first ev.3).7.(it.0.1) + sum (first ev.3).1.(it.0).1) = 0)
 or count up ev = 0
```

Leída: entre los movimientos de la transacción hay al menos uno que es T, se quema y sale de quien escribe; y ninguno de los movimientos de T de una escala con asignación (0 a 6) que salen de quien escribe hacia otro (una quema o un regalo a una cosa) hace que lo que sale en esa escala pase de la asignación del día de la época, menos lo ya gastado hoy, más el T explícito que tenga en su cartera. El génesis (el único registro sin foco: `up ev` no da nada) no lo necesita. Es lo que hoy comprueban dos condiciones envueltas de la capa cero: `FORMA` (`src/condiciones/evento.js`, fila EV-2: «escribir consume T del autor») y la sección TT-4 del ciclo (`src/condiciones/ciclo.js`: «T del día agotado»); el encargo 3 las sustituye por esta regla. Una cosa no tiene asignación: lo que gasta de más lo para el saldo del eje (la aritmética de saldos, el suelo), no esta regla (§8).

Dos cambios del encargo 2 (verificados por la familia T, §10): los filtros dicen `T in it.0.0` y `burn in it.4` en vez de `it.0.0 = T` y `it.4 = burn`, porque `ev.1` trae también lo que el payload tenga en su 1 (D-META colisiona) y comparar con `=` una lista de ese payload daba ERROR, así que la regla rechazaba eventos válidos (con el payload `["x", [[["a", "b"]], ["c"]]]`); `in` no da error y el payload no fabrica símbolos (SEG-09). Y la salida `or count up ev = 0` deja pasar el génesis, como la condición JS (la forma no le pide quemar T y TT-4 no lo evalúa): sin ella, la regla rechazaba todos los génesis.

`evaluarRegla(regla, contexto)` lee el 2, lo evalúa y devuelve `{ pasa, estado, motivo }`: pasa solo si da verdadero; si da falso, `motivo` es el mensaje del 9 con cada `{expresión}` rellena (`rellenar`); si queda PENDIENTE o da ERROR, no pasa y el motivo lo dice. No mira el 3, el 4 ni el 5: colgar las reglas de cada transacción es trabajo de después. La regla no está conectada al eje; `test/primera-regla.test.js` (y, con las demás, `test/reglas-bqlm.test.js`) comprueba que da el mismo veredicto que `eje.validar` en cada evento de los ejemplos de la compra y de la reserva, y en eventos inválidos hechos a mano.

## 7. Pendiente de integrar (para el libro)

Lo que el contexto lee hoy aparte y el libro de la capa cero tendría que dar como vista:

- **La cartera de una identidad** ya la da el libro (`libro.vista`); lo demás sale todavía de la envoltura del eje (`gastadoT`, `series`, `vivo`, `registroDe`, `sobre`).
- **Las series atadas a un registro**: hoy `eje.series()` entero, filtrado por `registro`, y `eje.vivo` serie a serie; el libro podría indexarlas por registro.
- **El T informativo gastado por identidad y día**: el eje lo lleva por registro (`tiempoInformativo`), no por persona y día; `A.7.e` de 7 a 9 queda vacío.
- **La asignación de cada identidad**: el eje decide por el tipo quién tiene asignación diaria, y el contexto no lee el tipo (R10); si el libro acuña la asignación del día como una transacción, la regla leería la cartera y no necesitaría distinguir.
- **El reloj**: `before.6.0` es `eje.tMaximo()`; el de los demás (`tMaximo(excluidos)`) no tiene posición todavía.
- **El alta y lo emitido** (`A.6` y `S.8`, las vistas del encargo 2, §10): salen de `eje.alta` y `eje.serie`; el libro ya los tiene (`libro.alta` y la suma de lo acuñado como emisión).

## 8. Para decidir VG

- **El texto de la primera regla.** El mapa nombra la regla («writing burns today's T») pero no la escribe; las diez posiciones son una propuesta [H] hecha con el molde.
- **La asignación de una cosa.** La regla acota con la asignación de la época; una cosa no la tiene y la regla no lo sabe (no lee el tipo, R10). Hoy lo para el saldo. ¿Se acuña la asignación del día como transacción (y la regla lee solo la cartera) o se da una vista con la asignación de cada identidad?
- **`A.7.e` es lo gastado de la asignación**, no solo lo quemado: incluye el T dado a una cosa, como el eje.
- **El orden de los ocupantes** de una posición: implícitos, propio del payload, escrito anclado.
- **Lo vacío**: `=` con nada es falso; la aritmética y el orden con nada, PENDIENTE; un elemento PENDIENTE en un where deja PENDIENTE todo el where (`docs/REGLAS_CORTAS.md`, duda 6).
- **`nth` desde 0**; **`path` con tope de diez**, y PENDIENTE si el hilo es más largo.
- **`before`**: 3 las identidades, 5 el génesis, 6.0 el mayor t [H].
- **El índice por valor** con un texto deja los ocupantes que se llaman así (su valor o los valores de su 0); con un dígito, es esa posición.
- **`each d` es lo mismo que `.d`** tras una expresión.
- **Los despliegues van por la forma del texto**, en cualquier sitio: un texto con forma de instante, de clave de serie, de id de registro, de identidad o de magnitud se despliega.
- **«nadie» no tiene literal**: es un símbolo que solo da el contexto; una regla lo compara con lo que lee de otro movimiento, no lo escribe.
- **Las referencias** se siguen leyendo solo el payload del otro registro (como `encaje.seguir`); una referencia sin dirección da el registro entero.
- **El año de D-FECHA** (§4).
- **La época como registro**: las familias en 1.0-1.3 (en el orden de `FAMILIAS`), cada una `[[nombre], [estructura], [estado]]`; las décuplas de dentro no se rellenan hasta diez (sin `[]` ni huecos; la raíz y cada regla sí llevan las diez); los principios y las dudas del JSON de siempre no pasan a la décupla. Los cinco criterios de P y los seis grupos de R siguen «[X] confirmar VG».

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
for (const e of ['first ev.3', 'ev.6.0', 'ev.6.0.3', 'ev.1.4', 'ev.1.0', '(ev.1 where it.4 = burn) each 0.1', '(first ev.3).1.("E:casa/EUR").1', '(first ev.3).7.2', 'epoch.1.3.1.2.1', 'count path ev']) {
  const r = evaluar(e, ctx);
  console.log(e.padEnd(34), r.texto ?? r.estado + ' ' + r.motivo);
}
```

```text
first ev.3                         huesped
ev.6.0                             2026-11-07T13:30:00Z
ev.6.0.3                           20764
ev.1.4                             burn, transfer
ev.1.0                             T:hora, E:casa/EUR, ensalada, guiso, fruta
(ev.1 where it.4 = burn) each 0.1  2
(first ev.3).1.("E:casa/EUR").1    60
(first ev.3).7.2                   0
epoch.1.3.1.2.1                    24
count path ev                      4
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
24 horas: writing burns today's T: huesped burns no T, or more T than is left today (day 20764) | eje: T del día agotado (hora): quedan 23
```

## 10. Las reglas de la época 0

Encargo 2 del plan del mapa (§16): las reglas de economía que hoy son condiciones en JavaScript (`src/condiciones/*.js`, la tabla de `docs/notas/CAPA_CERO.md` §3) escritas en BQL mínimo como décuplas del molde, en `epoch.2`. Las tradujeron cinco familias en paralelo (T, ciclo, identidad, E y R) y cada décupla se verificó por equivalencia: evaluada con `evaluarRegla` sobre el eje de justo antes, frente a la condición JS que traduce, sobre el mismo eje, en los eventos de `node --test`, de los ejemplos de Ikisai, de `docs/comprobar.mjs` y de un fuzz por familia (entre 14 000 y 24 000 eventos por familia). **No están conectadas al eje**: el eje sigue usando las condiciones JS (eso es el encargo 3).

Regla de oro (VG): si una regla no se puede escribir con el léxico, no se añade una función al BQL mínimo. Lo que falta es una posición (una vista o un despliegue), o la regla es suelo. Lo que no cabe queda en JavaScript, con su motivo (§10.3). Para escribir dos reglas hicieron falta dos vistas nuevas del contexto (§4): `A.6`, el alta de una identidad (el registro que abrió su cuenta), y `S.8`, lo emitido de una serie del libro hasta antes de la candidata.

**Cómo están en la época.** Son 27 décuplas con las diez posiciones llenas. Una décupla no lleva más de diez ocupantes que no son hojas (BTML), así que van en páginas de diez por su orden: `epoch.2.g.k` es la regla 10·g + k ([X] VG: cómo se agrupan, §10.5). El 8 de cada una encadena el orden: la primera es `first` y cada una va `after` la anterior. `EPOCA_0_BTML.condiciones` las da en una lista, en ese orden. El orden sigue el de `eje.validar`: primero la forma, luego el génesis, el ancla, el alta, el reloj, quién emite, el escalonado, la E atada y las condiciones de paso.

Todas leen los movimientos con `X in it.d` (por ejemplo, `T in it.0.0`, `mint in it.4`) y no con `=`: `ev.1` trae también lo que el payload tenga en su 1 (D-META colisiona), y `=` con una lista de ese payload da ERROR; `in` no da error y el payload no fabrica símbolos (SEG-09), así que solo cuentan los movimientos.

Prueba: `test/reglas-bqlm.test.js`. Cada regla da el mismo veredicto que su condición JS en todos los eventos de los ejemplos de Ikisai, también en el génesis. En un fuzz corto con semilla fija (360 eventos sobre un mundo con recursos, E atada, P y R con colateral, y 90 génesis) da el mismo veredicto, salvo que sea más estricta en un evento que el eje ya rechaza por otro lado, o más laxa donde la forma (suelo) lo rechaza; y cada condición rechaza y deja pasar algún evento. Las divergencias conocidas están como `test.skip` con su id y su motivo (§10.4); con `AGRAM_DIVERGENCIAS=1` se ejecutan y comprueban que siguen ahí.

```js
import { evaluarRegla } from './src/bqlm.js';
import { ContextoEje } from './src/contexto-eje.js';
import { EPOCA_0_BTML } from './src/epocas.js';
import { crearEvento } from './src/evento.js';
import { ejemploCompra } from './ejemplos/ikisai/compra-food.mjs';

const { eje, menu, compra } = await ejemploCompra();
const malo = await crearEvento({ autor: 'huesped', sobre: menu.id, t: compra.t, payload: 'vale', movimientos: [
  { token: 'T', escala: 'minuto', cantidad: 1, de: 'huesped', a: null },
  { token: 'E', emisor: 'huesped', denominacion: 'vale', cantidad: 1, de: null, a: 'huesped' },
  { token: 'P', ambito: menu.id, cantidad: 1, de: null, a: 'huesped' }] });
const ctx = new ContextoEje(eje, { ev: malo, epoch: EPOCA_0_BTML });
console.log(EPOCA_0_BTML.condiciones.length, 'reglas');
EPOCA_0_BTML.condiciones.forEach((r, k) => {
  const v = evaluarRegla(r, ctx);
  if (!v.pasa) console.log('2.' + Math.floor(k / 10) + '.' + (k % 10), v.motivo);
});
console.log(await eje.validar(malo));
```

```text
27 reglas
2.1.8 P is minted on one's own record: huesped mints P:7c3eb52fe755163f18e8d67121f72a55247d435f9c9210f5abdb1195ec1f5f20 on a record they did not write, or on the whole ledger
2.2.1 minting P or E needs own R at stake: huesped has no R:huesped locked as collateral (exit R:huesped) covering a tenth of what was minted of it, before or in this transaction
[
  'P sobre 7c3eb52f lo acuña solo quien escribió el registro (cocina): huesped puede transferir el P que tenga, no acuñarlo',
  'emitir P exige R propia en juego: R:huesped bloqueada como colateral (salida «R:huesped»), al menos la décima parte de lo emitido de R:huesped, antes o en el mismo evento (R6)',
  'emitir E exige R propia en juego: R:huesped bloqueada como colateral (salida «R:huesped»), al menos la décima parte de lo emitido de R:huesped, antes o en el mismo evento (R6)'
]
```

Leído: la huésped quema un minuto, emite un vale suyo y acuña P sobre el menú, que escribió la cocina. Dos reglas no pasan: acuñar P sobre un registro ajeno y emitir P y E sin su R en juego. El eje da los mismos motivos con el texto de siempre (el de la R en juego, una vez por la P y otra por la E). «minting E needs P on the record» pasa, porque en la misma transacción se acuña P sobre el foco.

### 10.1 Las reglas, leídas

| | Regla | Leída |
|---|---|---|
| 2.0.0 | writing burns today's T | Quien escribe quema T suyo, y en ninguna escala con asignación (0 a 6) gasta más de lo que le queda hoy: la asignación de la época menos lo gastado hoy (`A.7.e`), más el T que tenga en su cartera. El génesis no lo necesita. Lectura completa en §6 |
| 2.0.1 | every event moves tokens | Toda transacción lleva al menos un movimiento, salvo el génesis (la candidata es el génesis si el libro de antes no tiene génesis: `count before.5 = 0`) |
| 2.0.2 | T is whole | Ningún movimiento de T lleva decimales: media hora son treinta minutos. Que la cantidad sea un número positivo y un entero seguro es forma (suelo) |
| 2.0.3 | informative T is only burned | El T de las escalas 7, 8 y 9 (pasado, futuro, inventado) solo se quema, sin estado ni salida; el pasado y el futuro llevan la fecha a la que se refieren. Nada más lleva esa fecha ni una nota: ni el T real ni un movimiento de E, P o R. Como D-MOV pone en el 7 «caducidad o fecha a la que se refiere», «tiene esa fecha» se escribe `count it.7 > 0 and not it.7 in it.2` (lo del 7 no es su caducidad, que también está en el 2) |
| 2.0.4 | locks keep their holder and name an exit | Un movimiento con estado (bloqueo o liberación) no acuña ni quema, tiene el mismo titular a los dos lados y lleva su salida: en su 2, algo más que el estado que no sea un texto vacío ni su caducidad |
| 2.0.5 | E is minted by and to its issuer | Toda E que se acuña tiene por emisor (el 1 de su serie) a quien escribe y va a su emisor. Vale igual en el génesis |
| 2.0.6 | R is minted to its issuer | Toda R que se acuña nace en la cartera de su emisor; de ahí sale a los tenedores con una transferencia, y entonces hay doble entrada (el crédito del tenedor, la obligación del emisor) |
| 2.0.7 | the genesis only mints to its author | En el génesis, todos los movimientos son acuñaciones a su autor. Fuera del génesis no dice nada |
| 2.0.8 | the genesis P is over the whole ledger | En el génesis, el P es sobre todo el eje (ámbito «genesis»). Traduce el código de hoy; el mapa §15 lo retira |
| 2.0.9 | the genesis E names no record | En el génesis, ninguna E nombra un registro: queda atada al propio génesis |
| 2.1.0 | every record hangs on a record of the ledger | El foco de la transacción (su 6.5 implícito, leído con `first ev.6`) es un registro del libro de antes: desplegado, su 5 es su propio id. Sin foco, solo el génesis |
| 2.1.1 | the author has an account | Quien escribe está entre las identidades del libro de antes (`before.3`). El génesis no lo necesita: su cuenta nace con él |
| 2.1.2 | not before its focus | La fecha de la transacción no es anterior a la de su foco (D-FECHA, en segundos). Si el foco no está en el libro, no dice nada: lo para el ancla |
| 2.1.3 | not before the writer joined | Ni anterior al alta de quien escribe (la vista nueva `A.6`; su t es `A.6.6.0`) |
| 2.1.4 | at most a year ahead | Ni más de un año (31 536 000 segundos, escrito en su 1) por delante del mayor t del libro (`before.6.0`). Con el libro vacío no hay tope |
| 2.1.5 | R is minted by its issuer | Nadie acuña R de otro: R:Y solo la acuña Y. Emitir R ya no exige colateral (VG, 9-11) |
| 2.1.6 | nobody mints T | Ninguna transacción acuña T, ni el génesis: el T de cada día sale de la asignación de la época |
| 2.1.7 | P is minted to its minter | El P que se acuña va a quien escribe; delegar es transferir el P que se tiene. Traduce el código de hoy; el mapa §15 lo cambia |
| 2.1.8 | P is minted on one's own record | El P que se acuña es sobre un registro del libro escrito por quien escribe; fuera del génesis, nunca sobre todo el eje. Traduce el código de hoy; el mapa §15 lo retira |
| 2.1.9 | T is not locked | Ningún movimiento de T bloquea ni libera: bloquear es de E, P y R |
| 2.2.0 | minting needs real T | Si la transacción acuña E, P o R, quien escribe quema en ella T de una escala real (0 a 6), sin estado. El T informativo no cuenta |
| 2.2.1 | minting P or E needs own R at stake | Si acuña P o E, quien escribe tiene su R en juego: lo bloqueado de su R con la salida «R:él» (antes, en su cartera, más lo que bloquea y menos lo que libera ahora) es más que cero y, por diez, llega a lo emitido de su R (antes, la vista nueva `S.8`, más lo que acuña ahora). Es la regla de hoy; el mapa §15 retira el colateral |
| 2.2.2 | minting E needs P on the record | Si acuña E y su foco es un registro, quien escribe tiene P que lo cubre (en su cartera o movido en esta transacción): sobre «genesis», el génesis, el propio foco o un antepasado del foco (`path`, que se mira lo último) |
| 2.2.3 | E is tied to a record that exists | La E que se acuña nombrando un registro (su 5: el de la clave o el del contrato) nombra uno del libro |
| 2.2.4 | locked P backing live E is not released | No se libera P bloqueado cuya salida es una serie de E (una franja, no la familia) que sigue viva tras la transacción: lo vivo antes (`X.1` del registro de la serie), más lo que se acuña ahora si no ha caducado, menos lo que se quema ahora, con el margen de 1e-9 de la condición JS |
| 2.2.5 | nobody moves tokens of others | Todo movimiento con origen (transferir, bloquear, liberar, quemar) sale de quien escribe. En JS es una condición de paso; como regla rechaza la transacción entera, con el mismo veredicto |
| 2.2.6 | P moves within a known scope | El P que quien escribe delega o consume va sobre «genesis» o sobre un registro del libro |

Dos traducciones verificadas no entran porque otra ya las cubre: «writing burns T» (familia identidad) es la mitad de forma de 2.0.0, y «nobody mints for another» (familia ciclo, E y R a la vez) lo cubren 2.0.5 y 2.1.5, que además rigen en el génesis. Al integrar se rehízo el 8 de cada regla (las familias citaban reglas de otras, y la de E nombraba «VA-3», que no es una regla) y se quitó el texto vacío del 1 de 2.0.4 (un texto vacío no es un terminal BTML; la condición lo sigue comparando).

### 10.2 Condición JS ↔ regla

En el orden de `CONDICIONES` (`src/condiciones/index.js`). La misma correspondencia está en la tabla de `docs/notas/CAPA_CERO.md` §3.

| Condición JS | Regla BQLM | Lo que queda en JS |
|---|---|---|
| `EV-1` (forma) | 2.0.1 (EV-1), 2.0.0 (EV-2), 2.0.2 (TT-7), 2.0.3 (TT-5), 2.0.4 (BL-1), 2.0.5 y 2.0.6 (la emisión va a su propio emisor) | la forma del evento y del movimiento (suelo); PP-1 (la clave «P:» sin ámbito no es una serie: forma); RR-1, retirada (§10.3) |
| `suelo:id`, `suelo:nuevo`, `suelo:un-genesis` | — | suelo |
| `ancla` | 2.1.0 | — |
| `ID-1` | 2.1.1 | — |
| `ID-5`, `ID-6`, `ID-3` | — | no caben (§10.3) |
| `VA-3` (ciclo) | — | no cabe |
| `RL-1` | 2.1.2 (RL-1), 2.1.3 (RL-2), 2.1.4 (RL-3) | el alta acotada del prefijo v2 |
| `ID-9` | 2.1.5 (R), 2.0.5 (E), 2.1.6 (TT-1), 2.1.7 y 2.1.8 (PP-2) | solo las personas emiten; PP-3 (R3); EE-9 (la caducidad la fija la primera emisión) |
| `TT-6` | 2.1.9 | — |
| `TT-4` | 2.0.0 | — |
| `TT-8` | — | no cabe (TT-8, TT-9) |
| `PP-5` | — | no cabe |
| `ES-1` | 2.2.0 (lo de T), 2.2.1 (R en juego), 2.2.2 (P sobre el registro) | — |
| `VA-3` (tope) | — | no cabe |
| `EE-1` | 2.2.3 (el registro) | el contrato: divisible, emisores, enteros (EE-9) |
| `EE-8` | 2.2.4 (la salida de una serie) | la salida de una familia (EE-4) |
| `EE-10` | — | no cabe |
| `EE-5` | — | no cabe (EE-2 a EE-7, EE-11, RL-4) |
| `RR-3` | 2.1.5 sustituye a la condición, sin colateral (VG, 9-11) | retirada: no se traduce |
| `RR-4` | — | retirada con el colateral |
| `RR-5` | — | no cabe |
| `ID-8` | 2.2.5 | — |
| `PP-4` | 2.2.6 | — |
| `GN-1` (génesis) | 2.0.7, 2.0.8, 2.0.9 y, en el génesis, también 2.0.5, 2.1.5, 2.1.6 y 2.2.5 | la emisión conjunta y divisible; las series finitas (suelo) |
| `GN-2` (génesis) | — | no cabe |

### 10.3 Lo que no cabe, con su motivo

Queda en JavaScript. Entre paréntesis, lo que falta: una posición (vista o despliegue) o una decisión de VG; o nada, porque es suelo.

| Condición | Motivo |
|---|---|
| ID-9, «solo las personas emiten»; TT-8 y TT-9 (T no cruza de persona; de cosa a cosa, con el mismo dueño); ID-3 (los tipos se declaran en el alta) | Hace falta saber si una identidad es persona o cosa, y el contexto no lee el tipo (R10) ni hay campo de tipo (mapa §15, H2: una cosa es un registro con clave propia). Es la duda de §8, «la asignación de una cosa». Con la asignación del día acuñada como transacción, o con una vista de la asignación de cada identidad, TT-8 sería `count (ev.1 where T in it.0.0 and transfer in it.4 and it.3.1 != first ev.3 and <el destino tiene asignación>) = 0`. TT-9 necesita además el dueño (`A.6.3`) y el P sobre el alta de la destino, que §15 rediseña (decisión VG) |
| VA-3 (ciclo y tope) y las variantes de la versión 2 dentro de la forma, el génesis y la firma | Es otro juego de reglas para un tramo del eje (el prefijo migrado de la versión 2), no una condición de la época 0, y ninguna posición dice si la candidata está en ese prefijo (decisión VG) |
| EE-1, el contrato; EE-9 (divisible, emisores, enteros si no es divisible; la caducidad la fija la primera emisión); GN-1, emisión conjunta y divisible en el génesis | D-MOV no despliega «divisible» ni «emisores», y ninguna vista da el contrato de una serie que ya no está viva (despliegue y vista). Con esas posiciones se escriben con el léxico de hoy: «una ampliación no cambia divisible ni emisores», «sin divisible, `floor it.1 = it.1`» |
| EE-10 (la emisión conjunta: cada coemisor tiene su P bloqueado) | Faltan los coemisores del movimiento y la clave de familia de la serie (despliegue). Lo bloqueado de cada coemisor sí está en su cartera |
| EE-8 con la salida de una familia (franja «*»); EE-4 | D-SERIE da la denominación con la franja dentro y la franja aparte, pero no la clave de familia ni la denominación sin franja, y sin operaciones de texto no se casa «cama@n1» con «cama@*» (despliegue). 2.2.4 deja fuera esa salida |
| EE-2 (la capacidad de un registro) | La capacidad es un entero en el 2 del payload, pero el 2 puede llevar otras cosas y el léxico no tiene prueba de tipo (decisión VG: declararla como magnitud, «4 plazas», que D-VALOR da en `X.2.1`, o una vista de capacidad) |
| EE-5 con EE-11 y RL-4 (el tope por franja) | Para cada registro del hilo con capacidad hay que sumar lo vivo de la franja en todo su subárbol: `X.1` solo da las series atadas al propio registro y `down` baja un nivel (vista: «series vivas del subárbol de X»). Lo vivo ha de caducar con el reloj de los demás (RL-4: `tMaximo(excluidos)` no tiene posición). EE-11 es el caso vacío |
| EE-7 (la cuota por P bloqueado) | Necesita lo emitido de P:A, que no es una posición, la familia (EE-4), divisible (EE-9) y la capacidad (EE-2); además el mapa ya la cambia (D1: frente al total comprometido; F1: el subárbol en numerador y denominador). Se escribe con el P nuevo (vista y decisión VG) |
| EE-3, EE-6, EE-12, RL-4 | EE-3 es el despliegue D-SERIE.7, que ya existe; EE-6 es la vista `X.1`; EE-12 es una propiedad del libro (nada se mueve solo al caducar: suelo); RL-4 es el reloj que usan EE-5 y EE-6 (vista) |
| PP-5 (no se estrecha P hacia una serie cerrada; hacia la raíz de otro, solo su autor) | JS lleva el P de quien escribe movimiento a movimiento dentro de la transacción, y D-MOV no da el orden del movimiento (despliegue). §15 cambia además delegar por reposicionar con factor |
| PP-3 (R3: ampliar P:X solo ejecutando una consolidación autorizada, una vez) | Lee el estado de una consolidación, que vive en el contexto y en el eje. §15 retira el guion consolidar → autorizar → ejecutar (decisión VG) |
| RR-3 y RR-4 (el colateral de R) | RETIRADAS por VG (9-11, mapa §15, «R según el corpus»): R se emite sin colateral; el respaldo es la obligación de atender. 2.1.5 es lo que queda de la emisión. Hoy el eje aún exige el colateral |
| RR-1 (R no es fungible: quien la tiene solo puede devolverla) | RETIRADA por VG (9-11): R se transfiere libremente entre tenedores sin sustituir al emisor, y el tenedor puede perdonar la deuda (quemarla). Lo que queda, «sin sustituir al emisor», es la clave de la serie (suelo). El encargo 3 ha de quitar la rama R de `validarMovimiento` |
| RR-5 (solo el emisor atiende las devoluciones de su R) | Lee `contexto.atiende`, que no es una posición, y VG decide que atender lo define el criterio de PV2 de cada identidad. Faltan el criterio de atención por defecto de la época (`epoch.9`) y colgar reglas de una ruta (el 5 de la regla), que `evaluarRegla` aún no mira (decisión VG) |
| RR-6 sin colateral («R en juego» para emitir P o E) | 2.2.1 traduce la regla de hoy, con el colateral. Sin colateral, el mapa deja abierto qué cuenta como R en juego (decisión VG) |
| RR-2, RR-7, RR-8 (la obligación del emisor, la lente, el valor de R para un lector); RR-9, retirada | Son lecturas, no condiciones. RR-2 y RR-8 caben en el léxico (por ejemplo, la obligación de Y es la suma de R:Y en las carteras de los demás); falta decidir dónde cuelgan las lecturas en la época, y la lente espera al formato de los grupos de PV3 (decisión VG) |
| Pedir atención (PV3, mapa §16) y «recibir R da P en la raíz del emisor» (N2) | No existen en JS. La primera necesita la posición del alta o de la raíz del dominio de una identidad y el formato de los grupos de PV3 (vista y decisión VG); la segunda es una acuñación (`put`, aún fuera del intérprete) con la mecánica de la obtención abierta |
| EV-3 (un registro es presente si consume T real) | Es una lectura: cabe en el léxico (`count before.5 = 0 or count (ev.1 where T in it.0.0 and it.0.1 < 7 and burn in it.4 and count it.2 = 0 and it.3.0 = first ev.3) >= 1`, lo mismo que `esPresente`), pero colgada en `epoch.2` rechazaría eventos válidos (decisión VG: dónde viven las lecturas) |
| ID-4, ID-5, ID-6, ID-7, GN-2 (firma, claves, demostración) | Verificar firmas y pruebas de posesión es criptografía (suelo). Lo demás no tiene posición: el firmante colisiona con el 3 del payload en `ev.3`, y la clave de una identidad y la bandera de demostración no están en ningún sitio que el contexto lea (decisión VG: dónde vive la clave) |
| BL-2, GN-1 «series finitas», TT-10 | Aritmética de saldos del libro (suelo) |
| BL-3 (lo bloqueado con una salida por todos los titulares), BL-4 (un bloqueo de autorización caduca) | BL-3 es una lectura que §15 sustituye por el recuento del dueño (vista); BL-4 es del motor, que §15 retira (decisión VG) |
| TT-11 (el T sobre un registro, en el 8, sin lo que cuestan sus bases) | Es una lectura del 8; la suma cabe (`sum ((((down X) each 1) where T in it.0.0 and it.0.1 = k and burn in it.4) each 1)`), pero ninguna posición dice qué hijo es una base (decisión VG) |
| TT-12, TT-16 (orden de magnitud y segundos de cada escala) | Son datos de la época que `epoch.1.3.1` no lleva; de ella sale un año de 364 días y `tokens.SEGUNDOS.anio` cuenta 365 (decisión VG) |
| TT-13, TT-14, TT-15, TT-17 (la escala incongruente, la recomendada, el coste de escribir, la banda de una distancia) | No rechazan nada o hoy no se aplican; necesitan contar las posiciones del contenido de un registro (despliegue) o un «ahora» que no es una posición (vista) |

### 10.4 Divergencias conocidas

Lo que la verificación dejó sin el mismo veredicto, con la prueba que lo documenta (`test/reglas-bqlm.test.js`, `test.skip` con su id).

| Id | Regla | Caso | Por qué |
|---|---|---|---|
| D-META-1, D-META-3 | toda regla que lee `ev.1`, `ev.3` o `ev.6` | un payload con una referencia a un evento que no está (`{"ref": "abab…"}`) en su 1, su 3 o su 6, o con más de 10 000 hojas: el eje lo acepta y la regla queda PENDIENTE | D-META mezcla lo implícito (movimientos, autor y firmante, sobre y en) con lo propio del payload, y no hay posición con solo lo implícito. Aparece en 43 eventos válidos de los tests |
| D-MOV-7 | 2.0.3 | una E acuñada con caducidad y con fecha a la que se refiere: JS la rechaza y la regla no la ve | D-MOV pone en el 7 «caducidad o fecha a la que se refiere» |
| R10-T | 2.0.0 | una cosa (o una identidad sin tipo) quema más horas que su saldo: la regla le cuenta la asignación de la época; lo para el saldo | no lee el tipo (R10) |
| RELOJ-MS | 2.1.2, 2.1.3, 2.1.4 | una transacción unos milisegundos anterior a su foco, dentro del mismo segundo: JS la rechaza y la regla no | D-FECHA da segundos enteros. Lo mismo con una caducidad a media fracción de segundo en 2.2.4 |
| GENESIS-GUARDA | 2.0.0, 2.2.0 y las del ciclo | un evento sin foco que no es el génesis pasa por `or count up ev = 0`; lo para el ancla | la guarda del génesis |
| PATH-10 | 2.2.2 | P en un antepasado a más de diez niveles del foco: el eje acepta y la regla queda PENDIENTE | `path` tiene tope de diez |
| EE-4 | 2.2.4 | liberar un bloqueo de familia con E viva: JS lo rechaza y la regla no lo mira | falta la clave de familia |
| RL-4 | 2.2.4 | liberar el respaldo de una E caducada según la fecha del evento pero viva según el reloj de los demás | falta la vista del reloj de los demás |
| VA-3 | las del ciclo | un evento del prefijo v2 que las reglas de la versión 2 aceptan | ninguna posición dice si el evento es del prefijo |
| RR-3 retirada, RR-1 retirada | 2.1.5 y las de R | emitir R sin colateral, transferir R entre tenedores: el eje de hoy lo rechaza y las reglas no | decisión de VG (9-11) |

En eventos que el eje rechaza por otro lado hay más diferencias, inofensivas: movimientos mal formados que JS aparta (`validosDe`) y la regla cuenta; un movimiento null, con el que D-MOV lanza y la regla da ERROR (un apunte de robustez para `src/contexto-eje.js`: D-META podría saltarse lo que no es objeto); un autor que no es persona, donde otra fila de ID-9 da antes su motivo; un autor sin alta (`A.7` vacío: PENDIENTE); un foco que no está (`up ev`: PENDIENTE); y la salida que no es texto en 2.0.4 (el léxico no distingue un texto de un número; lo para la forma).

### 10.5 Para decidir VG

Lo marcado [X] en las cinco familias y en la integración. Se suma a §8.

- **Cómo se agrupan más de diez reglas en el 2.** Hoy, en páginas de diez por su orden (2.g.k). Otras opciones: por familia, como el 1 (E, P, R, T), o por la primitiva que vigilan.
- **Una posición con solo lo implícito de D-META** (los movimientos en el 1; autor y firmante en el 3; sobre y en en el 6), o que el suelo rechace referencias a eventos ausentes, o que una referencia ausente no deje PENDIENTE (D-META-1, D-META-3).
- **Cómo se aparta el génesis de las reglas de «*».** Hoy hay dos formas: `or count up ev = 0` (sin foco: familias T y ciclo) y `count before.5 = 0` (el libro de antes no tiene génesis: familia identidad), que dan lo mismo en los eventos válidos; conviene una sola. Si el génesis deja de ser una transacción (el mapa §16 dice que el génesis es la época), las dos sobran.
- **El prefijo de la versión 2**: ¿es una época propia con su 2 (el 7 de cada regla) o queda como suelo de la persistencia?
- **El tipo de una identidad**: la asignación de una cosa (§8), «solo las personas emiten» (ID-9), el paso de T entre personas y cosas (TT-8, TT-9) y la regla de tipos (ID-3), frente a H2 («no se mira el tipo»): ¿se retira ya o espera a que «cosa = registro con clave propia» tenga posición?
- **D-MOV**: separar la caducidad y la fecha a la que se refiere en el 7; en qué posición van «divisible» y «emisores» (EE-9, EE-10); el orden del movimiento en su transacción (PP-5).
- **D-SERIE**: una posición con la clave de familia o con la denominación sin franja (EE-4).
- **Vistas que faltan**: el contrato de una serie que ya no está viva; las series vivas del subárbol de un registro (EE-5); el reloj de los demás (RL-4); lo bloqueado con una salida por todos los titulares (BL-3).
- **El reloj en milisegundos o en segundos** (D-FECHA da segundos; JS compara milisegundos), también para las caducidades con fracción de segundo.
- **El tope de diez de `path`** (PATH-10).
- **El año**: 2.1.4 escribe en su 1 un año de 365 días (`tokens.SEGUNDOS.anio`) porque la época no lo lleva; de `epoch.1.3.1` sale uno de 364 (TT-16; el año de D-FECHA, §4).
- **Cómo se declara la capacidad** de un registro (EE-2).
- **Dónde viven las lecturas** que otras reglas o un criterio de PV2 reutilizan (EV-3, TT-11, RR-2, RR-8): como reglas de la época con otra marca en su 4 o su 5, como plantillas en el 9, o repetidas dentro de cada regla.
- **La clave de una identidad, el firmante y la demostración** (ID-4 a ID-7, GN-2): su posición en el alta o en D-META.
- **R**: si la acuñación puede ir directa al tenedor (2.0.6 dice que no: nace en la cartera del emisor); el criterio de atención por defecto de la época y colgar reglas de una ruta (RR-5).
- **Lo que el mapa §15 cambia y estas reglas traducen como está hoy**: el P acuñado (2.1.7, 2.1.8 y 2.0.8: §15 retira «el autor de X acuña P:X» y «P del génesis sobre todo el eje»; escribir un registro propio da diez unidades, N1); el escalonado como dos secuencias (2.2.0, 2.2.1, 2.2.2: E exige P, P exige R, R exige T; N3); el colateral de R, que §15 retira y 2.2.1 aún exige (qué es «R en juego» sin colateral, RR-6); RR-1, RR-3 y RR-4, retiradas (el eje de hoy aún las aplica: el encargo 3 ha de quitarlas); R3 y el guion de autorizar (PP-3, BL-4); reposicionar P con factor (PP-5, PP-4); la cuota frente al total comprometido y con el subárbol (EE-7: D1, F1); recibir R da P en la raíz del emisor (N2); y D2 (toda E dice a qué registro está atada, el génesis el suyo), frente a 2.0.9, que hoy pide que la E del génesis no nombre registro.
- **Datos de la época** que faltan: el orden de magnitud y los segundos de cada escala (TT-12, TT-16); si el coste de escribir se cobra por posición (TT-15).
