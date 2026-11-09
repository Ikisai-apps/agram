# BQL mínimo (BQLM)

El BQL mínimo es el álgebra con la que se escriben las condiciones de las reglas de la época: traer posiciones, aplicar una posición a cada elemento, filtrar, contar, sumar y comparar. Viene de dos decisiones de VG (mapa §15 y §16, 9-11): «todo son reglas», escritas en BQL y leídas desde la época, no desde código; y «BQL es un lenguaje para manejar la matriz de BTML», con un léxico de palabras cortas en inglés. Lo que sea «escoger algo concreto» (el día de una fecha, la familia de una serie, la cartera de alguien) no es una función: es una **posición** que el contexto despliega.

Este documento describe lo que existe en `src/bqlm.js` (el analizador y el evaluador) y `src/contexto-eje.js` (el contexto sobre el eje). `src/bql.js` (BQL V0, `docs/BQL.md`) sigue igual. Las reglas de la época 0 (§6 y §10) son registros de la época (§5) y, desde el encargo 3a (VG, 10-11), están conectadas al eje: cada una es una condición de la transacción (`src/condiciones/reglas.js`), y las condiciones de JavaScript que sustituyen se retiraron (`docs/notas/CAPA_CERO.md` §3). Pruebas: `test/bqlm.test.js`, `test/contexto-eje.test.js`, `test/epoca-btml.test.js`, `test/primera-regla.test.js`, `test/reglas-bqlm.test.js` (cada regla de la época frente a su condición JS) y, de la revisión de seguridad, `test/seguridad-bqlm.test.js` (SEG-09 a SEG-12: el payload no fabrica movimientos ni «nadie»; el presupuesto de ocupantes; las salidas y series con nombres reservados, `__proto__`, `constructor`, `prototype`, que la validación de movimientos rechaza y el libro guarda como claves propias).

```js
import { analizar, evaluar, evaluarRegla, leerRegla, esLectura, rellenar, textoDe, ESTADOS, PALABRAS, PRIMITIVAS, LIMITES, POR_LIMITE, SIMBOLOS, NADIE, esSimbolo, Presupuesto, Parada, pendiente, porLimite } from './src/bqlm.js';
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
| D-META | un evento (la candidata o un registro del eje) | 3 autor y firmante (el segundo ocupante, siempre: `NADIE` si no va firmado; lo del payload va detrás), 5 su id («nadie» si aún no lo tiene) y las claves públicas que declara, cada una con su huella en el 0, su titular en el 3 y su prueba de posesión en el 4 (el 5 de un evento es solo suyo: ni el payload ni lo anclado lo ocupan), 6.0 t, 6.5 sobre y en, 1 los movimientos, que colisionan con lo que el payload tenga en su 1 |
| D-MOV | un movimiento | 0 su serie (un registro: D-SERIE), 1 cuánto, 2 estado, salida y caducidad (las que haya; la salida vale su texto y, si nombra una serie que existe, es la referencia a su registro), 3.0 de, 3.1 a (null es el símbolo «nadie», `NADIE`), 4 la primitiva, un símbolo (`mint` si de = null, `burn` si a = null, `lock` y `release` por el estado, si no `transfer`), 5 el registro de la serie (E), 7.0 la caducidad y 7.1 la fecha a la que se refiere (B3: ya no comparten posición), 9 nota |
| D-SERIE | una serie de tokens, que es un registro (VG, 10-11, B3) | 0 su clave legible, que vale la clave de texto del libro (su clave interna) y se lee por partes: 0.0 familia (un símbolo del libro), 0.1 la escala de T como dígito (segundo 0 … año 6, pasado 7, futuro 8, inventado 9), el emisor (E, R) o el ámbito (P), 0.2 denominación; 1.0 lo emitido y 1.1 lo consumido, hasta antes de la candidata; 2 el contrato de E: 2.0 «divisible» si lo es, 2.7 su caducidad; 3 sus emisores (E, R); 5 el registro al que está atada (E); 7 su franja (E). La materializa el libro como vista (`eje.serie`, `eje.registroDe`, las sumas de lo quemado); la de una serie que nace en la candidata sale de su primera emisión |
| D-FECHA | un instante ISO con zona | k = el número de periodo de la escala k desde 1970-01-01T00:00Z, en UTC: 0 segundo, 1 minuto, 2 hora, 3 día civil (`tokens.diaCivil`), 4 semana, 5 ciclo de 28 días, 6 año |
| D-VALOR | un terminal «12 EUR» o «EUR 12» (con espacio) | 1 cuánto, 2 unidad; solo lectura |

La convención del año de D-FECHA: años de 364 + 1 días (`tokens.SEGUNDOS.anio`, trece ciclos de 28 días y uno más) contados desde el 1 de enero de 1970, sin bisiestos; la semana cuenta desde ese día, que fue jueves. Es un número de periodo para comparar y agrupar, no una fecha del calendario civil ([X] decidir VG si el año ha de seguir al civil).

Un texto se despliega por su forma: un instante (D-FECHA), el id de un registro del eje (el registro), una identidad con alta (sus vistas) o una magnitud (D-VALOR). Sigue valiendo su texto para comparar. Una clave de serie escrita como texto ya no se despliega (B3: D-SERIE deja de ser un despliegue de texto): la serie es un registro al que se llega desde el 0 de un movimiento, de una entrada de la cartera o de una serie viva de un registro, y desde la salida de un bloqueo; un texto del payload no la fabrica (SEG-09).

**Vistas del libro como posiciones** (a la fecha de la candidata):

| Posición | Qué es | De dónde sale |
|---|---|---|
| `A.1` | la cartera de la identidad A: un ocupante por serie con algo disponible o bloqueado; cada uno, 0 la serie, 1 lo disponible, 2 lo bloqueado, un ocupante por salida (0 la salida, 1 cuánto) | `eje.libro.vista` (la capa cero, `docs/notas/CAPA_CERO.md`) |
| `A.6` | el alta de la identidad A: el registro que abrió su cuenta (`epoch.3.6`, «pasado: de dónde viene»); `A.6.6.0` es su t y `A.6.3` su autor. Sin alta en el eje, nada | `eje.alta`, `eje.obtener` |
| `A.7.e` | el T de la escala e (0-6) gastado de la asignación del día civil de `ev.6.0.3`: consumido o dado a una cosa; en las escalas informativas (7-9), nada | `eje.gastadoT` |
| `X.1` | de un registro de recurso: sus series de E atadas y vivas; cada una, 0 la serie, 1 lo vivo, 7 la caducidad. Lo vivo caduca con el **reloj de la caducidad**: el menor entre `ev.6.0` y el reloj de los demás (`before.6.3`); sin los demás, nada caduca (SEG-03, SEG-05, RL-4; como `src/condiciones/tope.js`) | `eje.series`, `eje.vivo`, `eje.tMaximo` |
| `X.7.1` | las series de E vivas de **todo el subárbol** de X (X y lo que cuelga de él), con el mismo reloj; cada una como en `X.1` (B6). El resto del 7 implícito son las lecturas que la época pone ahí (`X.7.4`, §5) | `eje.series`, `eje.hilo`, `eje.vivo` |
| `S.1.0`, `S.1.1` | de una serie S (la de un movimiento, `ev.1.0`, la de una entrada de la cartera, `A.1.0`, o la que nombra una salida): lo emitido y lo consumido hasta antes de la candidata (el `S.8` del encargo 2) | `eje.serie`, `libro.sumas` |
| `before.1` | los registros del libro, por llegada | `eje.orden` |
| `before.2` | lo bloqueado por salida y serie, **sumado sobre todos los titulares** (B6, BL-3): un ocupante por salida y serie, que vale su salida (así `before.2.("salida")` los da); 0 la serie, 1 cuánto, 3 los titulares | `eje.identidades`, `eje.bloqueos` |
| `before.3` | las identidades del libro | `eje.identidades` |
| `before.5` | el génesis | `eje.genesisId` |
| `before.6.0` | el mayor t del libro | `eje.tMaximo` |
| `before.9` | cómo es este libro: «demostración» si su génesis lo marca (sin clave se escribe; R9) | `eje.demostracion` |
| `before.6.3` | el **reloj de los demás** (B6): el mayor t del libro entre las identidades que no son el autor de la candidata ni emiten la E que ella acuña; nada si no hay ninguna | `eje.tMaximo(excluidos)` |

**El orden de un movimiento** es su lugar en `ev.1` (B6): los movimientos van primero, en su orden, y `nth k ev.1` es el k-ésimo (desde 0); no hace falta otra posición.

No hay tipo de identidad (VG, 10-11, B1): persona o cosa se lee del 3 de su alta (`first A.6.3 = A`: persona es quien escribió su propia alta; cosa, lo que dio de alta otra identidad, su dueño). Solo en el prefijo de la versión 2 (suelo de persistencia) el alta declaraba un tipo, y el contexto lo da en esa misma posición: el 3 de un alta de entonces, leído desde su identidad, es ella misma si se declaró persona y otro si no.

## 5. La época como registro

`datos/epocas/epoca-0.btml.json` es la época 0 como décupla BTML, leída con la cruceta; `cargarEpocaBtml` la carga y `EPOCA_0_BTML` la expone como `epoch`. Su forma está en `docs/BTML.md` §12. Con el BQL mínimo: `epoch.1.3.1.e.1` es la asignación diaria de la escala e (lo que el mapa escribe `epoch.T.e.1`), `epoch.5.p.d.0` el nombre de la regla corta del dígito d en la profundidad p y `first epoch.2` la primera regla.

**Las reglas son registros** (VG, 10-11, A1: «Correcto»). Cada regla es su propio registro: una décupla del molde con las diez posiciones llenas, en `datos/epocas/reglas/<su 0 en kebab>.json`, con un id estable, el hash de su cuerpo canónico (como el de un evento: `hash(canonico(regla))`). El 2 de la época es la **lista de referencias** `{ ref }` a esos registros, una hoja por regla, sin páginas ni tope de diez, en el orden que dice el 8 de cada una; la época es el registro raíz más los registros de sus reglas, referenciados. `npm run epocas` reescribe ese 2 desde `datos/epocas/reglas/` y genera `datos/epocas/epocas.js`; el cargador resuelve cada referencia (`cargarEpocaBtml(raíz, { registros, correcciones })`) y rechaza la que no resuelve. `EPOCA_0_BTML.condiciones` da las reglas en ese orden, `reglasConId` cada una con su id. Leídas con el BQL mínimo, `epoch.2` da los registros de las reglas (el contexto sigue la referencia, §4), que valen su id: `(first epoch.2).0` es el nombre de la primera, `(nth k epoch.2).2` la condición de la k-ésima (desde 0) y `epoch.2.0` los nombres de todas.

**Las lecturas son reglas** (VG, 10-11, B5). «present», «informative», «attended» y «obligation» son registros de la época como las demás reglas, en el mismo 2 y en la misma cadena del 8, con `read` en su 4. No son condiciones: no se cuelgan de las transacciones (`EPOCA_0_BTML.condiciones` no las lleva; `EPOCA_0_BTML.lecturas` sí, y `evaluarRegla` las rechaza). Su 2 es una fórmula «=…» en la que `it` es lo que se lee (un registro, la candidata o una identidad), así que su primer `where` da `it2`; su 3 dice **dónde se materializa**: el contexto pone lo que da la lectura en esa posición del sujeto, y las demás reglas la leen ahí, por su posición, sin repetir la fórmula (`leerRegla(regla, sujeto, contexto)` la evalúa a mano). No hace falta ninguna palabra nueva en el léxico.

| Lectura | Dónde | Qué da | Lo mismo que |
|---|---|---|---|
| present | `X.6.1` (de dónde viene, cuánto) | si el registro quema T real de su autor (una escala que el calendario mide), o es el génesis | `evento.esPresente` |
| informative | `X.6.7` (de dónde viene, para cuándo) | si quema T de una escala que el calendario no mide (pasado, futuro, inventado) | `ciclo.esInformativoT` en alguno de sus movimientos |
| attended | `X.7.4` (futuro, qué se hace) | si devuelve R a su emisor y un registro de ese emisor la cita en su 6.4 | `lente.devoluciones(…).atencion` |
| obligation | `A.3.1` (grupos de atención y R, cuánto) | la R de la identidad en manos de otros, disponible o bloqueada | `eje.obligaciones` |

Para leerlas, el contexto da dos posiciones más: `before.1`, los registros del libro por llegada, y `X.6.4`, lo que un registro atiende (los ids de su `contexto.atiende`). Por ejemplo, los registros no presentes del libro son `before.1 where not first it.6.1`. `test/lecturas-bqlm.test.js` comprueba cada lectura contra su función JS en los registros de los ejemplos.

**Corregir una regla** no la modifica en sitio: se añade un ocupante a su registro, en la posición que corrige, con un archivo de `datos/epocas/correcciones/` `{ "sobre": <id de la regla>, "en": <la posición, un dígito>, "ocupante": <lo nuevo>, "de": <de dónde viene> }`. El registro de la regla y su id no cambian; el cargador pone el ocupante detrás de lo suyo y `evaluarRegla` lee el último ocupante del 2 (la condición) y del 9 (el mensaje). Así una regla corregida sigue siendo la misma regla, con su historia en sus ocupantes.

## 6. La primera regla, leída

`first epoch.2`, «writing burns today's T», es una décupla del molde (mapa §16 [D]) con las diez posiciones llenas:

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

`evaluarRegla(regla, contexto)` lee el último ocupante del 2 (una corrección se añade detrás, §5), lo evalúa y devuelve `{ pasa, estado, motivo }`: pasa solo si da verdadero; si da falso, `motivo` es el último mensaje del 9 con cada `{expresión}` rellena (`rellenar`); si queda PENDIENTE o da ERROR, no pasa y el motivo lo dice. Una lectura (`read` en su 4) no es una condición: `evaluarRegla` la rechaza y se lee con `leerRegla` (§5). No mira el 3, el 4 ni el 5: todas las reglas de la época cuelgan de toda transacción (su 5 es `*`). Desde el encargo 3a la regla está conectada al eje (`src/condiciones/reglas.js`, §10); `test/primera-regla.test.js` (y, con las demás, `test/reglas-bqlm.test.js`) comprueba que da el mismo veredicto que la condición JS que sustituye en cada evento de los ejemplos de la compra y de la reserva, y en eventos inválidos hechos a mano.

## 7. Pendiente de integrar (para el libro)

Lo que el contexto lee hoy aparte y el libro de la capa cero tendría que dar como vista:

- **La cartera de una identidad** ya la da el libro (`libro.vista`); lo demás sale todavía de la envoltura del eje (`gastadoT`, `series`, `vivo`, `registroDe`, `sobre`).
- **Las series atadas a un registro**: hoy `eje.series()` entero, filtrado por `registro`, y `eje.vivo` serie a serie; el libro podría indexarlas por registro.
- **El T informativo gastado por identidad y día**: el eje lo lleva por registro (`tiempoInformativo`), no por persona y día; `A.7.e` de 7 a 9 queda vacío.
- **La asignación de cada identidad**: es de las personas, y persona es quien escribió su propia alta (B1: `first A.6.3 = A`), que la regla lee; si el libro acuña la asignación del día como una transacción, la regla leería la cartera y no necesitaría distinguir.
- **El reloj**: `before.6.0` es `eje.tMaximo()` y el de los demás, `before.6.3` (B6), `eje.tMaximo(excluidos)`.
- **El alta y lo emitido** (`A.6` y `S.8`, las vistas del encargo 2, §10): salen de `eje.alta` y `eje.serie`; el libro ya los tiene (`libro.alta` y la suma de lo acuñado como emisión).

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
24 horas: writing burns today's T: huesped burns no T, or more T than is left today (day 20764) | eje: writing burns today's T: huesped burns no T, or more T than is left today (day 20764)
```

## 10. Las reglas de la época 0

Encargo 2 del plan del mapa (§16): las reglas de economía que eran condiciones en JavaScript escritas en BQL mínimo como décuplas del molde. Las tradujeron cinco familias en paralelo (T, ciclo, identidad, E y R) y cada una se verificó por equivalencia: evaluada con `evaluarRegla` sobre el eje de justo antes, frente a la condición JS que traduce, sobre el mismo eje, en los eventos de `node --test`, de los ejemplos de Ikisai, de `docs/comprobar.mjs` y de un fuzz por familia. **Encargo 3a (VG, 10-11): están conectadas al eje.** Cada regla del 2 de la época es una condición de la transacción (`src/condiciones/reglas.js`): se evalúa sobre el eje de antes y rechaza con el mensaje de su 9. Las condiciones JS que sustituyen se retiraron de `src/` y viven solo en `test/condiciones-retiradas.mjs`, donde la red de equivalencia las sigue comparando; la tabla de qué sustituye cada regla y qué queda en código está en `docs/notas/CAPA_CERO.md` §3.

Regla de oro (VG): si una regla no se puede escribir con el léxico, no se añade una función al BQL mínimo. Lo que falta es una posición (una vista o un despliegue), o la regla es suelo. Lo que no cabe queda en JavaScript, con su motivo (§10.3).

**Cómo están en la época.** El 2 de la época es la lista de referencias a sus registros (§5): 26 condiciones y 4 lecturas, cada una con las diez posiciones llenas. El 8 de cada una encadena el orden: la primera es `first` y cada una va `after` la anterior; `EPOCA_0_BTML.condiciones` da las condiciones en ese orden y `EPOCA_0_BTML.lecturas` las lecturas. Se nombran por su 0, no por su lugar (la numeración «2.g.k» del encargo 2, de cuando iban en páginas de diez, ya no existe). Las seis que el mapa §15 cambia (el P acuñado, el P del génesis, el escalonado) están fuera de la época, en `datos/epocas/reglas-3b/`, sin conectar: el eje sigue con su código JS hasta el 3b.

**Qué pasa al validar.** Las reglas no se evalúan en el prefijo de la versión 2 (suelo de persistencia), en un evento mal formado (la forma es suelo) ni en uno con una referencia a un evento ausente (C1: lo rechaza el suelo). Si alguna regla falla con un veredicto, rechaza con su 9, relleno con lo que vale en la candidata; si ninguna falla y alguna queda PENDIENTE, la primera en el orden del 8 rechaza con su estado y su motivo (lo que no se sabe no se acepta). Por eso «every record hangs on a record of the ledger» va la segunda: un foco que no está deja PENDIENTE a las que suben por él, y es ella la que lo dice. El génesis también pasa por las reglas.

Todas leen los movimientos con `X in it.d` (por ejemplo, `T in it.0.0.0`, `mint in it.4`) y no con `=`: `ev.1` trae también lo que el payload tenga en su 1 (D-META colisiona), y `=` con una lista de ese payload da ERROR; `in` no da error y el payload no fabrica símbolos (SEG-09), así que solo cuentan los movimientos.

Prueba: `test/reglas-bqlm.test.js`. Cada regla da el mismo veredicto que la condición JS que sustituye en todos los eventos de los ejemplos de Ikisai, también en el génesis. En un fuzz corto con semilla fija (360 eventos sobre un mundo con recursos, E atada, P y R con colateral, y 90 génesis) da el mismo veredicto, salvo que sea más estricta en un evento que el eje ya rechaza por otro lado, o más laxa donde la forma (suelo) lo rechaza; y cada condición rechaza y deja pasar algún evento. Las reglas de la clave y la firma se ejercitan en un eje con claves (B4). Las divergencias conocidas están como `test.skip` con su id y su motivo (§10.4); con `AGRAM_DIVERGENCIAS=1` se ejecutan y comprueban que siguen ahí.

```js
import { evaluarRegla } from './src/bqlm.js';
import { ContextoEje } from './src/contexto-eje.js';
import { EPOCA_0_BTML } from './src/epocas.js';
import { REGLAS_3B_DATOS } from './datos/epocas/epocas.js';
import { crearEvento } from './src/evento.js';
import { ejemploCompra } from './ejemplos/ikisai/compra-food.mjs';

const { eje, menu, compra } = await ejemploCompra();
const malo = await crearEvento({ autor: 'huesped', sobre: menu.id, t: compra.t, payload: 'vale', movimientos: [
  { token: 'T', escala: 'minuto', cantidad: 1, de: 'huesped', a: null },
  { token: 'E', emisor: 'casa', denominacion: 'vale', cantidad: 1, de: null, a: 'casa' },
  { token: 'P', ambito: menu.id, cantidad: 1, de: null, a: 'huesped' }] });
const ctx = new ContextoEje(eje, { ev: malo, epoch: EPOCA_0_BTML });
console.log(EPOCA_0_BTML.condiciones.length, 'reglas en la época y', REGLAS_3B_DATOS.length, 'fuera, para el 3b');
for (const r of EPOCA_0_BTML.condiciones) {
  const v = evaluarRegla(r, ctx);
  if (!v.pasa) console.log('época:', v.motivo);
}
for (const { registro } of REGLAS_3B_DATOS) {
  const v = evaluarRegla(registro, ctx);
  if (!v.pasa) console.log('3b:', v.motivo);
}
console.log(await eje.validar(malo));
```

```text
26 reglas en la época y 6 fuera, para el 3b
época: E is minted by and to its issuer: huesped mints E of casa, or to someone else
3b: minting P or E needs own R at stake: huesped has no R:huesped locked as collateral (exit R:huesped) covering a tenth of what was minted of it, before or in this transaction
3b: P is minted on one's own record: huesped mints P:61aa68f7143444ac0c86a6251982c4449c94464dfcfadeeee9d5ccb45da69705 on a record they did not write, or on the whole ledger
[
  'E is minted by and to its issuer: huesped mints E of casa, or to someone else',
  'P sobre 61aa68f7 lo acuña solo quien escribió el registro (cocina): huesped puede transferir el P que tenga, no acuñarlo',
  'emitir P exige R propia en juego: R:huesped bloqueada como colateral (salida «R:huesped»), al menos la décima parte de lo emitido de R:huesped, antes o en el mismo evento (R6)',
  'emitir E exige R propia en juego: R:huesped bloqueada como colateral (salida «R:huesped»), al menos la décima parte de lo emitido de R:huesped, antes o en el mismo evento (R6)'
]
```

Leído: la huésped quema un minuto, emite un vale a nombre de la casa y acuña P sobre el menú, que escribió la cocina. Una regla de la época no pasa: nadie emite E de otro, y el eje rechaza con su 9. Dos de las traducciones que esperan al 3b tampoco: acuñar P sobre un registro ajeno y emitir P y E sin su R en juego; el eje las rechaza con el código JS que sigue hasta el 3b (el de la R en juego, una vez por la P y otra por la E). «minting E needs P on the record» pasa, porque en la misma transacción se acuña P sobre el foco.

### 10.1 Las reglas, leídas

En el orden del 8 (el de `EPOCA_0_BTML.condiciones`).

| Regla | Leída |
|---|---|
| writing burns today's T | Quien escribe quema T suyo, y en ninguna escala con asignación gasta más de lo que le queda hoy: si es una persona (escribió su propia alta, o la escribe ahora), la asignación de la época menos lo gastado hoy (`A.7.e`) más el T de su cartera; si es una cosa, solo el T de su cartera. Lectura completa en §6. Lleva la forma provisional del génesis |
| every record hangs on a record of the ledger | El foco de la transacción (su 6.5 implícito, leído con `first ev.6`) es un registro del libro de antes: desplegado, su 5 es su propio id. Sin foco, solo el génesis (forma provisional; que el génesis sea el único sin foco lo asegura el suelo) |
| every event moves tokens | Toda transacción lleva al menos un movimiento, salvo el génesis (forma provisional) |
| T is whole | Ningún movimiento de T lleva decimales: media hora son treinta minutos. Que la cantidad sea un número positivo y un entero seguro es forma (suelo) |
| informative T is only burned | El T de las escalas que el calendario no mide (pasado, futuro, inventado: `epoch.7.0`) solo se quema, sin estado ni salida; las que se refieren a otra fecha (`epoch.7.2`) la llevan en su 7.1. Nada más lleva esa fecha ni una nota |
| locks keep their holder and name an exit | Un movimiento con estado (bloqueo o liberación) no acuña ni quema, tiene el mismo titular a los dos lados y lleva su salida |
| E is minted by and to its issuer | Toda E que se acuña tiene por emisor (el 1 de su serie) a quien escribe y va a su emisor. Vale igual en el génesis |
| R is minted to its issuer | Toda R que se acuña nace en la cartera de su emisor; de ahí sale a los tenedores con una transferencia, y entonces hay doble entrada (el crédito del tenedor, la obligación del emisor) |
| the genesis only mints to its author | En el génesis, todos los movimientos son acuñaciones a su autor. Fuera del génesis no dice nada (forma provisional) |
| the genesis E names no record | En el génesis, ninguna E nombra un registro: queda atada al propio génesis (forma provisional) |
| who has a key signs | Si quien escribe tiene clave (en su alta, `A.6.5`, o la que declara ahora para sí en su propia alta, `ev.5`), firma: el segundo ocupante de `ev.3` es él (B4). Verificar la firma es suelo |
| without a key nobody acts | Quien escribe tiene clave, o el libro es de demostración (`before.9`) |
| a key is declared at its alta | Una clave declarada (en `ev.5`, detrás del id) es de quien aún no tiene cuenta y, o es quien escribe (su propia alta), o recibe algo en esta transacción (una cosa) |
| a declared key comes with its proof | La clave que se declara para otro (una cosa) lleva su prueba de posesión, en su 4; fuera de un libro de demostración. Verificar la prueba es suelo |
| not before its focus | La fecha de la transacción no es anterior a la de su foco (D-FECHA, en segundos) |
| not before the writer joined | Ni anterior al alta de quien escribe (`A.6`; su t es `A.6.6.0`) |
| at most a year ahead | Ni más de un año por delante del mayor t del libro (`before.6.0`). El año lo lee del calendario de la época, `epoch.7.0.6.1` (sus segundos: 364 + 1 días; VG, 10-11, A3). Con el libro vacío no hay tope |
| only persons mint | Solo acuñan las personas: quien escribió su propia alta (`first A.6.3 = A`, B1) o quien la escribe ahora |
| R is minted by its issuer | Nadie acuña R de otro: R:Y solo la acuña Y. Emitir R ya no exige colateral (VG, 9-11) |
| nobody mints T | Ninguna transacción acuña T, ni el génesis: el T de cada día sale de la asignación de la época |
| T is not locked | Ningún movimiento de T bloquea ni libera: bloquear es de E, P y R |
| T only goes to things | T no cruza de persona: una persona da su T solo a una cosa, y una cosa a otra solo si las dos son del mismo dueño, si quien escribe escribió el alta de la destino o si tiene P sobre ella. Dar tiempo a otro es acuñar E en él |
| E is tied to a record that exists | La E que se acuña nombrando un registro (el 5 de su serie) nombra uno del libro |
| locked P backing live E is not released | No se libera P bloqueado cuya salida es una serie de E (una franja, no la familia) que sigue viva tras la transacción: lo vivo antes (`X.1` del registro de la serie, con el reloj de la caducidad), más lo que se acuña ahora si no ha caducado, menos lo que se quema ahora |
| nobody moves tokens of others | Todo movimiento con origen (transferir, bloquear, liberar, quemar) sale de quien escribe. En JS era una condición de paso; como regla rechaza la transacción entera, con el mismo veredicto |
| P moves within a known scope | El P que quien escribe delega o consume va sobre «genesis» o sobre un registro del libro |

Las cuatro lecturas (present, informative, attended, obligation) están en §5. Las seis del 3b, fuera de la época: «the genesis P is over the whole ledger», «P is minted to its minter», «P is minted on one's own record», «minting needs real T», «minting P or E needs own R at stake» y «minting E needs P on the record» (traducen el código de hoy; el mapa §15 las cambia).

### 10.2 Condición JS ↔ regla

La tabla está en `docs/notas/CAPA_CERO.md` §3: cada condición que queda en `CONDICIONES`, con por qué sigue en código, y cada regla de la época con la condición JS que sustituye (retirada o a la vez) y su capa de validez. Lo que sigue en código es suelo (la forma, el id, un génesis, las referencias, la firma y las claves como criptografía, la atomicidad de los saldos), el prefijo de la versión 2 (suelo de persistencia), lo del 3b y lo que aún no cabe (§10.3).

### 10.3 Lo que no cabe, con su motivo

Queda en JavaScript. Entre paréntesis, lo que falta: una posición (vista o despliegue) o una decisión de VG; o nada, porque es suelo.

| Condición | Motivo |
|---|---|
| VA-3 (ciclo y tope) y las variantes de la versión 2 dentro de la forma, el génesis y la firma | Es otro juego de reglas para un tramo del eje (el prefijo migrado de la versión 2), no una condición de la época 0: es suelo de persistencia (VG, 10-11, A4). Las reglas no se evalúan en él |
| EE-1, el contrato; EE-9 (divisible, emisores, enteros si no es divisible; la caducidad la fija la primera emisión); GN-1, emisión conjunta y divisible en el génesis | El registro de la serie (B3) aún no despliega «divisible» ni «emisores» de una serie que ya no está viva (vista). Con esas posiciones se escriben con el léxico de hoy: «una ampliación no cambia divisible ni emisores», «sin divisible, `floor it.1 = it.1`» |
| EE-10 (la emisión conjunta: cada coemisor tiene su P bloqueado) | Faltan los coemisores del movimiento y la clave de familia de la serie (despliegue). Lo bloqueado de cada coemisor sí está en su cartera |
| EE-8 con la salida de una familia (franja «*»); EE-4 | La serie da la denominación con la franja dentro y la franja aparte, pero no la clave de familia ni la denominación sin franja, y sin operaciones de texto no se casa «cama@n1» con «cama@*» (despliegue). «locked P backing live E is not released» deja fuera esa salida |
| EE-2 (la capacidad de un registro) | La capacidad es un entero en el 2 del payload, pero el 2 puede llevar otras cosas y el léxico no tiene prueba de tipo (decisión VG: B2 la pone en la cruceta del 2 del recurso, 2.1) |
| EE-5 con EE-11 (el tope por franja) | Las vistas ya están (B6): lo vivo de todo el subárbol es `X.7.1` y caduca con el reloj de los demás (`before.6.3`). Falta cómo se declara la capacidad (EE-2) y la franja sin denominación (EE-4) para escribirla. EE-11 es el caso vacío |
| EE-7 (la cuota por P bloqueado) | Necesita lo emitido de P:A, que no es una posición, la familia (EE-4), divisible (EE-9) y la capacidad (EE-2); además el mapa ya la cambia (D1: frente al total comprometido; F1: el subárbol en numerador y denominador). Se escribe con el P nuevo (3b) |
| EE-3, EE-6, EE-12 | EE-3 es el 7 de la serie (su franja), que ya existe; EE-6 es la vista `X.1`; EE-12 es una propiedad del libro (nada se mueve solo al caducar: suelo) |
| PP-5 (no se estrecha P hacia una serie cerrada; hacia la raíz de otro, solo su autor) | JS lleva el P de quien escribe movimiento a movimiento dentro de la transacción; el orden del movimiento ya es `nth` en `ev.1` (B6), pero §15 cambia delegar por reposicionar con factor (3b) |
| PP-3 (R3: ampliar P:X solo ejecutando una consolidación autorizada, una vez) | Lee el estado de una consolidación, que vive en el contexto y en el eje. §15 retira el guion consolidar → autorizar → ejecutar (3b) |
| RR-3 y RR-4 (el colateral de R) | RETIRADAS por VG (9-11, mapa §15, «R según el corpus»): R se emite sin colateral; el respaldo es la obligación de atender. «R is minted by its issuer» es lo que queda de la emisión. El eje aún exige el colateral: es del 3b |
| RR-1 (R no es fungible: quien la tiene solo puede devolverla) | RETIRADA por VG (9-11): R se transfiere libremente entre tenedores sin sustituir al emisor, y el tenedor puede perdonar la deuda (quemarla). Lo que queda, «sin sustituir al emisor», es la clave de la serie (suelo). La rama R de `validarMovimiento` se quita en el 3b |
| RR-5 (solo el emisor atiende las devoluciones de su R) | VG decide que atender lo define el criterio de PV2 de cada identidad. Lo que atiende un registro ya es una posición (`X.6.4`) y «attended» es una lectura (§5); faltan el criterio de atención por defecto de la época (`epoch.9`) y colgar reglas de una ruta (el 5 de la regla) |
| RR-6 sin colateral («R en juego» para emitir P o E) | «minting P or E needs own R at stake» (3b) traduce la regla de hoy, con el colateral. Sin colateral, «R en juego» es tener R propia emitida (D2) |
| RR-7, RR-8 (la lente, el valor de R para un lector); RR-9, retirada | Son lecturas. RR-2 ya es «obligation» (`A.3.1`); RR-8 cabe de la misma forma, y la lente espera al formato de los grupos de PV3 (decisión VG) |
| Pedir atención (PV3, mapa §16) y «recibir R da P en la raíz del emisor» (N2) | No existen en JS. La primera necesita la posición del alta o de la raíz del dominio de una identidad y el formato de los grupos de PV3 (vista y decisión VG); la segunda es una acuñación (`put`, aún fuera del intérprete) con la mecánica de la obtención abierta |
| BL-2, GN-1 «series finitas», TT-10 | Aritmética de saldos del libro (suelo) |
| BL-4 (un bloqueo de autorización caduca) | Es del motor, que §15 retira (decisión VG). BL-3 ya es una vista: `before.2` (B6) |
| TT-11 (el T sobre un registro, en el 8, sin lo que cuestan sus bases) | Es una lectura del 8; la suma cabe (`sum ((((down X) each 1) where T in it.0.0.0 and it.0.0.1 = k and burn in it.4) each 1)`), pero ninguna posición dice qué hijo es una base (decisión VG) |
| TT-13, TT-14, TT-15, TT-17 (la escala incongruente, la recomendada, el coste de escribir, la banda de una distancia) | No rechazan nada o hoy no se aplican; necesitan contar las posiciones del contenido de un registro (despliegue) o un «ahora» que no es una posición (vista). A3 decide que escribir se cobra por posición escrita |

Resuelto en el encargo 3a y fuera de esta tabla: «solo las personas emiten», T entre personas y cosas y los tipos (B1: persona o cosa por autoría del alta); la firma, las claves y la demostración (B4: posiciones; verificar es suelo); EV-3 y RR-2 (B5: lecturas); RL-4 (B6: el reloj de los demás); TT-12 y TT-16 (A3: el calendario de la época).

### 10.4 Divergencias conocidas

Lo que la verificación dejó sin el mismo veredicto, con la prueba que lo documenta (`test/reglas-bqlm.test.js`, `test.skip` con su id). Ninguna cambia el veredicto del eje: donde la regla es más laxa, lo para el suelo o el código que sigue hasta el 3b.

| Id | Regla | Caso | Por qué |
|---|---|---|---|
| GENESIS-GUARDA | las que apartan el génesis | un evento sin foco que no es el génesis pasa por la forma provisional `count up ev = 0`; lo para el suelo (solo el génesis carece de foco) | la forma provisional del génesis (A2) |
| PATH-10 | minting E needs P on the record (3b) | P en un antepasado a más de diez niveles del foco: el eje acepta y la regla queda PENDIENTE | `path` tiene tope de diez (VG, 10-11, C2); el escalonado es del 3b y sigue en JS |
| EE-4 | locked P backing live E is not released | liberar un bloqueo de familia con E viva: JS lo rechaza y la regla no lo mira | falta la clave de familia; `EE-8` sigue en JS a la vez |
| VA-3 | minting P or E needs own R at stake (3b) | un evento del prefijo v2 que las reglas de la versión 2 aceptan | las reglas no se evalúan en el prefijo (suelo de persistencia) |
| RR-3 retirada, RR-1 retirada | R is minted by its issuer y las de R | emitir R sin colateral, transferir R entre tenedores: el eje de hoy lo rechaza y las reglas no | decisión de VG (9-11); el colateral es del 3b |

Resueltas en el encargo 3a, ahora pruebas que pasan: D-META-1 y D-META-3 (C1), D-MOV-7 (B3), R10-T (B1), RELOJ-MS (C2) y RL-4 (B6).

En eventos que el eje rechaza por otro lado hay más diferencias, inofensivas: movimientos mal formados que JS aparta (`validosDe`) y la regla cuenta (las reglas no se evalúan si la forma falla); un movimiento null, con el que D-MOV lanza y la regla da ERROR; un autor sin alta (`A.7` vacío: PENDIENTE); y la salida que no es texto (el léxico no distingue un texto de un número; lo para la forma).

### 10.5 Para decidir VG

Lo marcado [X] en las cinco familias, en la integración y en el encargo 3a. Se suma a §8.

- **Las reglas de forma**: seis reglas («every event moves tokens», «T is whole», «informative T is only burned», «locks keep their holder and name an exit», «R is minted to its issuer» y la parte de forma de «E is minted by and to its issuer») repiten parte de `validarForma`, que sigue (suelo de forma: `crearEvento` lo usa). ¿Se retiran de `validarForma` y la forma queda solo como BTML, o se quedan las dos?
- **El génesis como transacción**: la forma provisional «no tiene foco» (A2) y las reglas que solo miran el génesis sobran cuando el génesis sea la época (mapa §16).
- **Lo PENDIENTE al validar**: si ninguna regla falla con un veredicto, rechaza la primera que queda PENDIENTE, con su motivo, no con su 9 [H].
- **El prefijo de la versión 2**: queda como suelo de persistencia (A4); sus identidades conservan el tipo declarado, que el contexto lee como autoría (una persona escribió su propia alta) [H].
- **Las posiciones nuevas** son una propuesta [H] hecha con las reglas cortas de la época: las lecturas (`X.6.1`, `X.6.7`, `X.7.4`, `A.3.1`), lo que atiende un registro (`X.6.4`), los registros del libro (`before.1`), lo bloqueado por salida (`before.2`), el reloj de los demás (`before.6.3`) y las series vivas del subárbol (`X.7.1`).
- **El 5 de un evento es solo suyo** (su id y sus claves): lo que el payload tenga en su 5 ya no se lee en `X.5` (B4) [H].
- **D-MOV**: en qué posición van «divisible» y «emisores» (EE-9, EE-10).
- **La serie**: una posición con la clave de familia o con la denominación sin franja (EE-4); el contrato de una serie que ya no está viva.
- **El año de D-FECHA**: el calendario de la época cuenta 364 + 1 días (A3); queda si el año de D-FECHA ha de seguir al civil (§4).
- **Cómo se declara la capacidad** de un registro (EE-2; B2 la pone en 2.1).
- **R**: si la acuñación puede ir directa al tenedor («R is minted to its issuer» dice que no); el criterio de atención por defecto de la época y colgar reglas de una ruta (RR-5).
- **Lo que el mapa §15 cambia (3b)**: el P acuñado (§15 retira «el autor de X acuña P:X» y «P del génesis sobre todo el eje»; escribir un registro propio da diez unidades, N1); el escalonado como dos secuencias (E exige P, P exige R, R exige T; N3); el colateral de R (qué es «R en juego» sin colateral, RR-6); RR-1, RR-3 y RR-4, retiradas (el eje aún las aplica); R3 y el guion de autorizar (PP-3, BL-4); reposicionar P con factor (PP-5, PP-4); la cuota frente al total comprometido y con el subárbol (EE-7: D1, F1); recibir R da P en la raíz del emisor (N2); y D2 (toda E dice a qué registro está atada, el génesis el suyo), frente a «the genesis E names no record».
- **Datos de la época** que faltan: los órdenes de magnitud (TT-12) y el coste de escribir por posición (TT-15), que A3 decide.
