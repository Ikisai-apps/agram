# BQL mínimo (BQLM)

El BQL mínimo es el álgebra con la que se escriben las condiciones de las reglas de la época: traer posiciones, aplicar una posición a cada elemento, filtrar, contar, sumar y comparar. Viene de dos decisiones de VG (mapa §15 y §16, 9-11): «todo son reglas», escritas en BQL y leídas desde la época, no desde código; y «BQL es un lenguaje para manejar la matriz de BTML», con un léxico de palabras cortas en inglés. Lo que sea «escoger algo concreto» (el día de una fecha, la familia de una serie, la cartera de alguien) no es una función: es una **posición** que el contexto despliega.

Este documento describe lo que existe en `src/bqlm.js` (el analizador y el evaluador) y `src/contexto-eje.js` (el contexto sobre el eje). Todavía no sustituye a nada: `src/bql.js` (BQL V0, `docs/BQL.md`) sigue igual, y la primera regla no está conectada al eje (§6). Pruebas: `test/bqlm.test.js`, `test/contexto-eje.test.js`, `test/epoca-btml.test.js`, `test/primera-regla.test.js` y, de la revisión de seguridad, `test/seguridad-bqlm.test.js` (SEG-09 a SEG-12: el payload no fabrica movimientos ni «nadie»; el presupuesto de ocupantes; las salidas y series con nombres reservados, `__proto__`, `constructor`, `prototype`, que la validación de movimientos rechaza y el libro guarda como claves propias).

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
| `A.7.e` | el T de la escala e (0-6) gastado de la asignación del día civil de `ev.6.0.3`: consumido o dado a una cosa; en las escalas informativas (7-9), nada | `eje.gastadoT` |
| `X.1` | de un registro de recurso: sus series de E atadas y vivas; cada una, 0 la serie, 1 lo vivo, 7 la caducidad | `eje.series`, `eje.vivo` |
| `before.3` | las identidades del libro | `eje.identidades` |
| `before.5` | el génesis | `eje.genesisId` |
| `before.6.0` | el mayor t del libro | `eje.tMaximo` |

El contexto no lee el tipo de ninguna identidad (R10, `test/neutralidad-reglas.test.js`).

## 5. La época como registro

`datos/epocas/epoca-0.btml.json` es la época 0 como décupla BTML, leída con la cruceta; `cargarEpocaBtml` la carga y `EPOCA_0_BTML` la expone como `epoch`. Su forma está en `docs/BTML.md` §12. Con el BQL mínimo: `epoch.1.3.1.e.1` es la asignación diaria de la escala e (lo que el mapa escribe `epoch.T.e.1`), `epoch.5.p.d.0` el nombre de la regla corta del dígito d en la profundidad p y `epoch.2.0` la primera regla.

## 6. La primera regla, leída

`epoch.2.0`, «writing burns today's T», es una décupla del molde (mapa §16 [D]) con las diez posiciones llenas:

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
=count (ev.1 where it.0.0 = T and it.4 = burn and it.3.0 = first ev.3) >= 1
 and count (ev.1 where it.0.0 = T and it.0.1 < 7 and it.3.0 = first ev.3 and it.3.1 != first ev.3
     and sum ((ev.1 where it2.0.0 = T and it2.0.1 = it.0.1 and it2.3.0 = first ev.3 and it2.3.1 != first ev.3) each 1)
       > epoch.1.3.1.(it.0.1).1 - (first ev.3).7.(it.0.1) + sum (first ev.3).1.(it.0).1) = 0
```

Leída: entre los movimientos de la transacción hay al menos uno que es T, se quema y sale de quien escribe; y ninguno de los movimientos de T de una escala con asignación (0 a 6) que salen de quien escribe hacia otro (una quema o un regalo a una cosa) hace que lo que sale en esa escala pase de la asignación del día de la época, menos lo ya gastado hoy, más el T explícito que tenga en su cartera. Es lo que hoy comprueban dos condiciones envueltas de la capa cero: `FORMA` (`src/condiciones/evento.js`, fila EV-2: «escribir consume T del autor») y la sección TT-4 del ciclo (`src/condiciones/ciclo.js`: «T del día agotado»); el encargo siguiente las sustituye por esta regla. Una cosa no tiene asignación: lo que gasta de más lo para el saldo del eje (la aritmética de saldos, el suelo), no esta regla (§8).

`evaluarRegla(regla, contexto)` lee el 2, lo evalúa y devuelve `{ pasa, estado, motivo }`: pasa solo si da verdadero; si da falso, `motivo` es el mensaje del 9 con cada `{expresión}` rellena (`rellenar`); si queda PENDIENTE o da ERROR, no pasa y el motivo lo dice. No mira el 3, el 4 ni el 5: colgar las reglas de cada transacción es trabajo de después. La regla no está conectada al eje; `test/primera-regla.test.js` comprueba que da el mismo veredicto que `eje.validar` en cada evento de los ejemplos de la compra y de la reserva, y en eventos inválidos hechos a mano.

## 7. Pendiente de integrar (para el libro)

Lo que el contexto lee hoy aparte y el libro de la capa cero tendría que dar como vista:

- **La cartera de una identidad** ya la da el libro (`libro.vista`); lo demás sale todavía de la envoltura del eje (`gastadoT`, `series`, `vivo`, `registroDe`, `sobre`).
- **Las series atadas a un registro**: hoy `eje.series()` entero, filtrado por `registro`, y `eje.vivo` serie a serie; el libro podría indexarlas por registro.
- **El T informativo gastado por identidad y día**: el eje lo lleva por registro (`tiempoInformativo`), no por persona y día; `A.7.e` de 7 a 9 queda vacío.
- **La asignación de cada identidad**: el eje decide por el tipo quién tiene asignación diaria, y el contexto no lee el tipo (R10); si el libro acuña la asignación del día como una transacción, la regla leería la cartera y no necesitaría distinguir.
- **El reloj**: `before.6.0` es `eje.tMaximo()`; el de los demás (`tMaximo(excluidos)`) no tiene posición todavía.

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
