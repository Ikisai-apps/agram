# La fábrica: diez interpretaciones por diez interacciones

Nota de lectura para VG · 7-11-2026 · **No decide nada.** Recoge lo que dicen el corpus y el MAPA (citas literales con archivo y línea), lo que hoy hace el código de `main` y las opciones abiertas. Base: las dos lecturas y el juez del batallón anterior, comprobados de nuevo contra el corpus y el código (`main` en `8d73b44`, 101 pruebas en verde), y **actualizados con la decisión de VG de esta tarde** sobre el registro de salida de la fábrica (`MAPA` §12, l.265–267), posterior al diario. Lo que es deducción del asistente va marcado como tal.

Rutas abreviadas: `agx/` = raíz del paquete del corpus V4 (copia local de trabajo); `V2/` = `agx/80_HERENCIA_V3_INTEGRA/80_V2_INTEGRO/`; `V3/` = `agx/80_HERENCIA_V3_INTEGRA/`; `MAPA` = `MUELA/equipo/agram/MAPA_GLOBAL_AGRAM.md` (fuera de este repositorio); `ESPEC_V3` = `V3/03_TRANSICION/ESPECIFICACION_EXPLORATORIA_V3_INTEGRA.md`.

## 1. La cuestión en tres frases

1. El 6-11 VG corrigió la lectura de la fábrica: «La fábrica (PV4) es el finalizador de una acción de registro: lo que consolida diez interpretaciones por diez interacciones en un registro»; la frase no está en el corpus, que solo tiene antecedentes (las pasadas 4×4 = 16 de la fábrica V3, «qué se modificó» por posición) y la orden de no fundir cuentas de diez.
2. Esta tarde (7-11) VG lo ha concretado: la fábrica parte de la matriz de 100 del foco (10 posiciones × 10 subposiciones), la tercera dimensión son los diez PV como clase de modificación, el registro de salida es la matriz 10×10×10 con cada celda modificada en `[i][j][k]`, se emiten solo las décuplas modificadas, sin «no aplicable», con topes duros por modo.
3. El código tiene el colapso (una consolidación anclada en 4 con fuentes y vectores) pero no la matriz: lee cuatro posiciones, escribe una sola profundidad y no conoce ni la clase de modificación ni el tope duro; queda por decidir cómo se escribe `[i][j][k]` sin huecos y lo que la decisión de esta tarde no cubre.

## 2. Lo que dicen el corpus y el MAPA

### 2.1 La frase del 6-11: su única fuente

- `MAPA` §2.4 l.76: «La fábrica (PV4) es el finalizador de una acción de registro: lo que consolida diez interpretaciones por diez interacciones en un registro [D, corrección de VG del 6-11]. C2-D y C2-E la detallan como cierre de una interacción con la frontera externa abierta […] [A].»
- `MAPA` §5.1 l.130 [YO]: «La fábrica. La leí a escala de proyecto, como una estructura grande de diez por diez. Es el finalizador de una sola acción de registro, pequeña y repetida; el diez por diez es el espacio de lo que se consolida en ese registro.»
- Grep de «finalizador», «diez interpretaciones», «interpretaciones por», «diez interacciones» y «diez por diez» sobre todo el paquete (`agx/01_NUCLEO_V4`, `agx/02_TRAZABILIDAD`, `V3/`, `V2/`, `V2/90_FUENTES_CONSULTA`): **cero resultados**. El chat donde VG lo dijo no está en el corpus.

### 2.2 La decisión de esta tarde (7-11)

- `MAPA` §12 l.265 [D]: «**Posiciones sin contenido y registro de salida de la fábrica (VG, 7-11 tarde):** se escribe de 0 a 9 y dentro de cada posición igual (99 campos hasta todo nueves). La fábrica (PV4) parte de la matriz de 100 del foco (10 posiciones × 10 subposiciones), que ya está y no se emite; la tercera dimensión (×10 = 1000) es QUÉ se ha hecho en cada celda: de 0 a 9 clases de modificación (ver, sustituir, modificar, impulso con un token…). Se emiten SOLO las décuplas modificadas; ver un contenido ya es una modificación, así que siempre se emite algo, y puede ser mucho menos de 100. Topes duros por modo: Pointed 10, Sequenced 100, Mapped 1000, Scened 10000 (además de la proporción). Por eso no hay huecos: no se rellena macizo, se va por las ramas a las hojas necesarias; hojas/flores/frutos (PV2) = metáfora de la modificación; el impulso financiero es la base de la ejecución. Sin «no aplicable». Código: ya hace «celdas sin cambio = referencia al foco» y «lo lejano = anclaje»; falta el tope duro por modo, la CLASE de modificación por celda en el registro de salida, y «ver» como registro mínimo (más adelante).»
- `MAPA` §12 l.267 [D]: «**Confirmado por VG (7-11 tarde): la tercera dimensión de la fábrica son los diez PV como tercer dígito** («siempre estamos aplicando los puntos de vista»). El registro de salida es la matriz 10×10×10: posición × subposición × clase de modificación (0 ver/sustituir, 1 impulso de recursos, 2 criterio, 3 comunicación, 4 acción, …). Una celda modificada se escribe en [i][j][k]. Topes duros: Pointed 10, Sequenced 100, Mapped 1000, Scened 10000.»

La decisión no usa las palabras «interpretaciones» ni «interacciones»: no dice cuál de los tres ejes es cada una (ver opción A).

### 2.3 Antecedentes en el corpus

- `ESPEC_V3` l.258 (§08.2): «El usuario propone aplicar repetidamente **PV1 (recursos), PV2 (criterios), PV3 (personas/comunicación), PV4 (trabajo y tiempo)** para elaborar una actuación desde varios ángulos. Se habló de cuatro aplicaciones y de una matriz **4×4 = 16** como aproximación mínima de preparación antes del registro.»
- `V3/01_NUCLEO/02_DIEZ_PV_Y_EXPERIENCIA_VISUAL.md` l.58: «Se discutieron **cuatro pasadas por PV1–PV4**, imagen `4×4=16` […]. Son **intuiciones** de preparación integral, no deducciones de un álgebra AGRAM.»
- `ESPEC_V3` l.279 (§08.4, «Medir cambios frente a lo previsto»): «Se sugirió representar **por cada posición o paso** si ha habido cambio respecto a lo previsto. El principio es registrar o visualizar **qué se modificó**, y no puntuar directamente «30 frente a 80».» Y l.283: «Se mencionó otra organización con **diez pasos por posición** y tres niveles de profundidad por actuación […]. Es **otra lectura posicional**, no reutilización automática de los **diez niveles y grados** de PV8.»
- `ESPEC_V3` l.250–254 (§08.1): «**Sequenced**: línea de alrededor de **diez pasos** de producción. **Mapped**: fábrica con filas y columnas […] Los diez pasos, diez oficios y diez profundidades tienen resonancias útiles, pero **no son automáticamente equivalentes**.»
- `V3/01_NUCLEO/03_BTML_ESTRUCTURA_EPOCAS_Y_OPERACIONES_ABIERTAS.md` l.31: «**No fundir:** cuadrícula `4×4 = 16` de revisiones de cuatro PV, `5² = 25`, posición «55», diez pasos de fábrica, hasta `10^10` direcciones locales y potencias `n^n`. Son conceptos expresados en etapas distintas, sin igualdad matemática ni equivalencia aprobada.»
- El único «10 × 10» literal del corpus es otro: `agx/01_NUCLEO_V4/06_EPOCAS_TIEMPO_EPRT_Y_FRONTERAS.md` l.8: «Horizonte de 10 × 10 = **100 significados/reglas cortas fundamentales**.»

### 2.4 Qué es consolidar y qué debe exhibir PV4

- `agx/01_NUCLEO_V4/04_AGRAM_OPERACIONES_AUTORIZACION_Y_REGISTRO.md` l.32: «Consolidar PV4 es fijar y registrar **la decisión/intención** con sus fuentes, criterios, reglas y vínculos, sin copiar indiscriminadamente el árbol.» l.34: «Registrar resultado diferencia éxito, rechazo, no ocurrido, ejecutado parcialmente, sin confirmación, etc. Una compra elegida o autorizada no equivale a una compra efectivamente hecha.» l.24 (Salidas): «diferencias propuesta-vigente; petición explícita de selección/confirmación cuando corresponda […]. Ausencia de información = pendiente explicada, no dato inventado.»
- `agx/01_NUCLEO_V4/01_MODELO_INTEGRADO_V1_A_V4.md` l.31: «**Consolidación en PV4:** decisión formal de seleccionar/crear y registrar una construcción, sin copiar todo el árbol. Se mantiene procedencia, alternativas y diferencias.» l.41: «Consultar ≠ elegir ≠ preparar ≠ consolidar ≠ publicar ≠ ejecutar ≠ acreditar resultado.»
- `agx/01_NUCLEO_V4/05_DIEZ_PV_UI_Y_MODOS.md` l.40: «**UX de PV4:** la UI muestra alternativas y diferencias, deja elegir/crear/combinar antes de consolidar, y exhibe qué se registra, reemplaza, refiere o sigue pendiente. Consolidar no actúa externamente.»
- `MAPA` §8 l.154: «Evaluar nunca tiene efectos; ELEGIR deja una propuesta; la fábrica, en la posición 4, consolida y emite un evento nuevo cuyo payload es el array consolidado con referencias a sus fuentes. La ejecución, si la hay, es otro acto con su autoridad.»
- `MAPA` §12 l.247 [D]: la colisión es «materia prima […] de la fábrica (consolidar = única fijación, que no borra). No existe modificar en sitio: corregir es añadir un ocupante.» l.248 [D]: «la consolidación guarda los vectores de sus fuentes».

### 2.5 La capa de interacción y el camino de escritura

- `MAPA` §9 l.162 [D/O]: «Esa es la X (A), la capa de interacción: la mano del usuario modifica, añade y quita sobre todo en 1–4, y en 4 ejecuta. Ejecutar genera un registro nuevo, una maraña de décuplas, que es lo que acaba anclado a Bitcoin y vuelve a entrar por la izquierda del eje.»
- `MAPA` §10 l.175 [D]: «**X → cruz es el camino de escritura** (ejecutar en 4 produce un registro que entra en el eje).»
- `MAPA` §10.1 l.194 [D]: «Unidad de cuenta de la proporción escritura/lectura = la posición (Pointed 1 de 10; Sequenced 1–2 de 100; Mapped 250–333 de 1000).»
- `MAPA` §10.4 l.210 [D]: «**Lo escrito va en el PV donde se escribe** […] la posición es el anclaje, no un hueco en un array.» §10.6 [A]: «en Mapped, las celdas vacías anteriores a la última escrita se rellenan con `{ref: foco, dir}` (las referencias no copian)».

### 2.6 Los laboratorios (hipótesis, no canon)

- C2-D (`V2/90_FUENTES_CONSULTA/AGRAM_C2D_Contrato_Semantico_Operativo_10PV_v0.9-candidata.md`) l.80: «| **PV4** | Preparación, lanzamiento y cierre de interacción productiva | Ver la operación futura, revisar condiciones, **cerrar/lanzar registro** | Propuesta/recepción/ejecución/pendiente/resultado | Cerrar la tarea en UI ≠ finalizar necesariamente la acción externa |»; l.175–177, tres objetos [HIP]: `ExecutionPlan`, `CloseRequest`, `ExecutionOutcome`; l.509: «¿podemos construir **una única operación concreta** que al cerrarse desde PV4 genere un registro único […]?»
- C2-E (`…/AGRAM_C2E_Operacion_Unica_Diez_PV_Traza_Integral_v1.0-candidata.md`) l.138, INV-E05: cada perspectiva «declara uno de: contenido, derivación reproducible, referencia, desconocido/inaccesible, o ausencia justificada». La decisión de esta tarde descarta parte de esto: «Sin «no aplicable»»; lo que no tiene contenido no se emite.

## 3. Lo que hoy hace el código

`src/motor.js`:

- `descubrir` (l.82) y `proponer` (l.38): por defecto `posiciones = [1, 2, 3, 4]`. Leen cuatro posiciones, no la matriz de 100; 0 y 5–9 no entran (6, 7 y 8 existen en `src/tiempo.js`, pero no se ofrecen como candidatos).
- `consolidar` (l.101–143): `payload[0]` = `titulo` (por defecto «Consolidación»); «las elecciones van en posiciones 1–9» (l.108); **una sola profundidad** (elecciones por índice `i`); cada elección es un candidato (→ `{ref, dir}`, con su vector en `contexto.encaje`), una referencia o un terminal nuevo; un hueco se hereda del foco por referencia o da «hueco en i» (l.111–116); escribe con `escribirDesde` en modo `'mapped'` fijo (l.136), `en = direccion([...camino, 4])`, `contexto = { motor: 'fabrica', fase: 'consolidado', fuentes, encaje }`.
- No hay clase de modificación, ni `[i][j][k]`, ni «ver» como acto, ni las alternativas vistas: se guardan solo las fuentes elegidas con su vector.
- `FASES = ['consolidado', 'autorizado', 'ejecutado']`; `ejecutar` (l.183) recibe los movimientos del llamador y escribe con `eje.escribir` directo (sin modo ni proporción).

`src/escritura.js`: segunda puerta de salida con la misma forma. `desdeMapped` construye una décupla por PV con herencia por referencia (`{ref: foco, dir}` en las celdas vacías anteriores a la última escrita), `desdePointed` un terminal, `desdeSequenced` una hilera; `escribirDesde` anota `contexto.modo`, ancla en `en` libre (raíz por defecto) y no pasa por la fábrica (sin fase, fuentes ni encaje).

`src/modos.js`: `lectura(modo)` = 10, 100, 1000, 10000 posiciones (Pointed, Sequenced, Mapped, Scened): **los mismos números que los topes duros de VG**. `escritura(modo)` = `[1, 1]`, `[10, 20]`, `[250, 333]`, `null`; `cabeEscritura` solo compara el máximo, contando terminales (`contarPosiciones`; una referencia cuenta uno). Con estas proporciones, el tope duro solo cambiaría algo en Scened, que hoy no tiene límite.

`app.js` `panelFabrica`: una fila por posición de `descubrir` (1–4) con «candidato / terminal nuevo / nada».

Frente a la decisión de esta tarde:

| decisión de VG (7-11 tarde) | hoy |
|---|---|
| se escribe de 0 a 9 | `consolidar` rechaza 0 y fija un título |
| matriz de 100 del foco (posición × subposición) | se leen 1–4, una profundidad |
| celdas sin cambio = referencia al foco | sí, en posiciones (`consolidar`, `desdeMapped`) |
| lo lejano = anclaje | sí (`sobre` + `en`) |
| clase de modificación por celda, `[i][j][k]` | no existe |
| se emiten solo las décuplas modificadas | se emite un payload hasta la última posición elegida, con herencias delante |
| topes duros por modo | no existen como tales; la proporción (máximo) sí; `consolidar` fuerza `'mapped'` |
| sin «no aplicable» | no hay forma de escribirlo (cumple) |
| «ver» como registro mínimo | no existe (VG: «más adelante») |

### El ejemplo: la compra del menú

Foco = la compra (`ejemplos/ikisai/compra-food.mjs`): `0` = «Compra del menú del día»; `1` = `[→menú:1, 1, 'EUR 12']`; `2` = `[→menú:2]`; `3` = `['huesped', 'cocina']`; `4` = `['pagar', 'servir']`. De su matriz de 100 tienen contenido ocho subposiciones (`1.0`, `1.1`, `1.2`, `2.0`, `3.0`, `3.1`, `4.0`, `4.1`); la posición `0` es un terminal y no tiene subposiciones; la cuenta de cocina, escrita en `1000000000`, es un registro anclado, no una celda del foco.

Lo que produce hoy `consolidar` con las elecciones de `test/motor.test.js` l.25–36 (`1` = la cuenta, `2` = «sin lactosa», `4` = «pagar 14 EUR»): `['Pago del menú', {ref: cuenta, dir: '0000000000'}, 'sin lactosa', {ref: compra, dir: '3000000000'}, 'pagar 14 EUR']` en `compra:4000000000`, `contexto.encaje` con el vector exacto de la cuenta. Es un colapso correcto de una profundidad; no dice qué se hizo en cada celda.

## 4. Opciones para VG

La forma general ya está decidida (§2.2). Las opciones son sobre lo que la decisión deja abierto. No se recomienda ninguna.

### A · Qué eje es cada palabra de la frase del 6-11

- Qué es: documental. A1: «interpretaciones» = la matriz de 100 leída del foco (lo que «ya está y no se emite»), «interacciones» = las diez clases de modificación (los PV aplicados: «siempre estamos aplicando los puntos de vista»). A2: «interpretaciones» = las diez posiciones, «interacciones» = las diez subposiciones, y la clase es la tercera dimensión añadida el 7-11. A1 encaja con «la mano modifica, añade y quita» (la interacción es lo que se hace); A2 con «diez por diez = el espacio de lo que se consolida» (`MAPA` §5.1). Es **deducción**; ninguna fuente dice cuál.
- Cambio en código: ninguno. Una frase en `MAPA` §2.4 y en `docs/MOTOR.md` que diga qué eje es cada palabra.
- Ejemplo: con A1, la acción «pagar 14 EUR» en la celda `4.0` es **una interacción de clase 4 sobre una interpretación** (lo que la compra dice en `4.0`); con A2, es la subposición `0` de la posición `4`, y la clase 4 es un tercer dato.

### B · Cómo se escribe `[i][j][k]` sin huecos

- Qué es: VG fija que «una celda modificada se escribe en [i][j][k]». La regla BTML de no huecos (`MAPA` §10.7 [D]: «payload terminal o array ≤10 sin huecos») obliga a que existan `[i][j][0…k−1]`. Variante B1: rellenar las clases anteriores con la referencia a la celda del foco, igual que hoy se rellenan las posiciones («celdas sin cambio = referencia al foco»). Variante B2: la clase 0 («ver/sustituir») va siempre con lo visto o lo nuevo (VG: «ver un contenido ya es una modificación, así que siempre se emite algo») y solo las clases 1…k−1 se rellenan por referencia. En ambas, la posición 0 es elegible como las demás y `titulo` queda como atajo de «crear en 0».
- Cambio en código: `src/motor.js` `consolidar`: elecciones por celda y clase, por ejemplo `{ '1.2': { clase: 0, valor: 'EUR 14' }, '4.0': { clase: 4, valor: 'pagar 14 EUR' } }` (manteniendo los atajos de hoy para una profundidad); construir el payload hasta tres niveles, rellenando por referencia posiciones, subposiciones y clases anteriores; quitar el filtro `i < 1` (l.108); `contexto.encaje` por celda (`posicion: '1.2'`). `test/motor.test.js`: un caso por variante.
- Ejemplo (B1) con la compra, sustituir el precio y fijar la acción:

  ```
  [ {ref: compra, dir: '0000000000'},                       // 0 sin cambio
    [ {ref: compra, dir: '1000000000'},                     // 1.0 sin cambio
      {ref: compra, dir: '1100000000'},                     // 1.1 sin cambio
      ['EUR 14'] ],                                         // 1.2, clase 0: sustituir
    {ref: compra, dir: '2000000000'},                       // 2 sin cambio
    {ref: compra, dir: '3000000000'},                       // 3 sin cambio
    [ [ {ref: compra, dir: '4000000000'},                   // 4.0, clases 0–3: referencia a la celda
        {ref: compra, dir: '4000000000'},
        {ref: compra, dir: '4000000000'},
        {ref: compra, dir: '4000000000'},
        'pagar 14 EUR' ] ] ]                                // 4.0, clase 4: acción
  ```

  Once terminales (las referencias cuentan): cabe en Sequenced (≤20) y en Mapped (≤333), no en Pointed (1). Cuatro de los once son relleno de clases. Con B2 el relleno sería el mismo salvo que la clase 0 llevaría lo visto. Lo que el ejemplo enseña: con la regla de no huecos, una acción de clase alta cuesta las clases de debajo.

### C · Topes duros por modo y modo real en la consolidación

- Qué es: VG fija «Pointed 10, Sequenced 100, Mapped 1000, Scened 10000 (además de la proporción)». Falta decir qué cuentan (posiciones del payload, celdas `[i][j][k]` o décuplas emitidas) y que la consolidación use el modo desde el que se trabaja.
- Cambio en código: `src/modos.js`: `TOPES = { pointed: 10, sequenced: 100, mapped: 1000, scened: 10000 }` (o reutilizar `lectura(modo)`, que ya da esos números) y `cabeEscritura` comprueba tope y proporción; `src/motor.js` `consolidar({ modo })` pasa el modo real a `escribirDesde` en lugar de `'mapped'` (l.136). `test/modos.test.js`: Scened rechaza 10001.
- Ejemplo: la consolidación de B desde Pointed se rechaza hoy y seguiría rechazándose (proporción 1); desde Scened hoy no tiene límite y con el tope lo tendría (10000). Si el tope contara celdas `[i][j][k]` en vez de terminales, el payload de B contaría 2 celdas modificadas, no 11.

### D · Una puerta de salida o dos

- Qué es: `escritura.js` y `consolidar` producen registros de la misma forma por dos caminos. D1: la fábrica es el único finalizador; escribir desde Pointed/Sequenced/Mapped produce celdas modificadas que entran por `consolidar` (con clase, fuentes, encaje, anclado en 4, pendiente de autorización). D2: dos actos distintos (escribir en un PV con `en` libre, sin autorización; consolidar una acción en 4), etiquetados para no confundirlos. La decisión de esta tarde pone topes por modo al registro de salida de la fábrica, lo que acerca D1, pero no lo dice; `MAPA` §10.6 [X] sigue abierto.
- Cambio en código: D1: `desdePointed`/`desdeSequenced`/`desdeMapped` devuelven elecciones por celda (clase 0 para texto, referencia para `@id`) y `app.js` llama a `motor.consolidar` con el modo real; `escribirDesde` queda interno. D2: `escribirDesde` anota `contexto.motor = 'escritura'` y `consolidaciones()` lo ignora.
- Ejemplo: hoy, escribir desde Mapped sobre la compra con la celda 2 = «sin lactosa» produce `[{ref: compra, dir: '0000000000'}, {ref: compra, dir: '1000000000'}, 'sin lactosa']` en la raíz, sin fase ni fuentes. Con D1 sería una consolidación en `compra:4000000000`, celda `2.0` clase 0, `PENDIENTE DE AUTORIZACIÓN`. Con D2 queda igual, con `contexto.motor = 'escritura'`.

### E · La clase 1 («impulso de recursos») como base de la ejecución

- Qué es: VG: «el impulso financiero es la base de la ejecución»; la clase 1 es «impulso de recursos». Hoy `ejecutar` recibe los movimientos libres del llamador y la acción consolidada es texto. E1: la celda de clase 1 lleva el movimiento propuesto y `ejecutar` solo admite lo consolidado. E2: dejar `ejecutar` como está hasta AARPIA (`MAPA` §12 l.249 [D]: «AARPIA es el motor real de autorización/ejecución»).
- Cambio en código: E1: formato del impulso en la celda (terminal, subarray o referencia: [X] decidir VG); `ejecutar` compara cada movimiento con los impulsos consolidados (mismo token y denominación, mismo de/a, cantidad ≤) y rechaza el exceso. `test/motor.test.js`: un movimiento mayor que el consolidado se rechaza.
- Ejemplo: celda `1.2`, clase 1 = impulso de 14 EUR de huésped a cocina. `ejecutar` con 20 EUR → «excede lo consolidado: 14 EUR»; con 14 EUR pasa, y la evidencia enlaza consolidación y autorización como hoy.

### F · Fases de cierre y resultado

- Qué es: C2-D propone [HIP] previsualizado → solicitado el cierre → admitido/rechazado → pendiente externo / ejecutado → resultado (éxito, rechazo, parcial, sin confirmación); V4 04 l.34 enumera los resultados. Hoy hay tres fases y un rechazo o una ejecución parcial no se pueden registrar. Toca a AARPIA y a la capa 5 (ver `docs/notas/CAPAS_DE_VALIDEZ.md`, opción H).
- Cambio en código: `FASES` amplía con `rechazado` y `resultado`; `autorizar({ decision: 'admito' | 'rechazo' })`; `acreditar({ consolidacion, resultado, evidencia })`; `estadoDe` devuelve `RECHAZADO` y `EJECUTADO · <resultado>`.
- Ejemplo: cocina rechaza el pago («sin stock de guiso») → `RECHAZADO`; en otro hilo, cocina admite, huésped ejecuta y cocina declara «parcial: falta la fruta» → `EJECUTADO · parcial`.

## 5. Lo que no se puede decidir desde el corpus

1. **Qué eje es cada palabra** de «diez interpretaciones por diez interacciones» (A): ni el corpus ni la decisión de esta tarde lo dicen.
2. **Cómo se rellenan las clases** por debajo de la usada (B): la regla de no huecos lo exige; VG dice «no se rellena macizo» y «celdas sin cambio = referencia al foco», pero no habla de clases.
3. **Qué pasa con una celda del foco que es un terminal**: `MAPA` §12 l.246 [D]: «Un terminal no tiene posición 0 (PENDIENTE)». La matriz de 100 supone subposiciones; en la compra, `0` es un terminal. Cómo se modifica `0.j` es [X] decidir VG.
4. **Los nombres de las clases 5–9**: VG dio «0 ver/sustituir, 1 impulso de recursos, 2 criterio, 3 comunicación, 4 acción, …». Con la época 0 la clase k es el PV k; si una época posterior cambia la lectura de esa profundidad, ¿cambia la clase? La época está fuera del dato [D], pero la clase va dentro del registro.
5. **Contraste con la PR #33 (abierta)**: su época 1 propuesta nombra la profundidad 2 como «anatomía del valor» (0 valor mostrado, 1 cantidad, 2 unidad o condición, 3 quién lo dice, 4 operación, …); la decisión de esta tarde usa el tercer dígito del registro de salida como clase de modificación. Los nombres son paralelos dígito a dígito, pero uno describe el valor y el otro lo que se le hizo. Si son la misma lectura es [X] decidir VG.
6. **Qué cuentan los topes duros** (C) y si la proporción sigue contando terminales.
7. **Varias clases en una misma celda** (sustituir e impulsar a la vez): la forma `[i][j][k]` lo permite; nadie lo ha dicho.
8. **«Ver» como registro mínimo**: VG lo deja «más adelante»; tampoco está dicho si «ver» sin modificar nada mueve T ni si cuenta para el tope.
9. **Una o dos puertas de salida** (D) y si `en` sigue libre cuando escribe la fábrica.
10. **Dónde queda la traza de lo visto y no elegido** («alternativas y diferencias», V4 01 l.31): «ver» como clase 0 podría ser esa traza, pero no está escrito.
11. **Lo que la fábrica entrega a la ejecución** (E) y **el contrato del resultado** (F): AARPIA no existe y la regla V0 es un hueco provisional [D].

## Fuentes leídas

- Diario del batallón anterior: `leer:fabrica-10x10:0`, `leer:fabrica-10x10:1`, `juez:fabrica-10x10`.
- `ESPEC_V3` §08.1–§08.4; `V3/01_NUCLEO/02_DIEZ_PV_Y_EXPERIENCIA_VISUAL.md`, `03_BTML_ESTRUCTURA_EPOCAS_Y_OPERACIONES_ABIERTAS.md`; `agx/01_NUCLEO_V4/01_MODELO_INTEGRADO_V1_A_V4.md`, `04_AGRAM_OPERACIONES_AUTORIZACION_Y_REGISTRO.md`, `05_DIEZ_PV_UI_Y_MODOS.md`, `06_EPOCAS_TIEMPO_EPRT_Y_FRONTERAS.md`; `V2/90_FUENTES_CONSULTA/` (C2-D v0.9, C2-E v1.0). Grep de «finalizador», «interpretaciones por», «diez interacciones», «diez por diez», «10 × 10» sobre todo el paquete.
- `MAPA` §2.4, §5.1, §8, §9, §10, §10.1, §10.4, §10.6, §10.7, §12 (incluidas las decisiones del 7-11 tarde).
- `src/motor.js`, `src/escritura.js`, `src/modos.js`, `src/tiempo.js`, `test/motor.test.js`, `docs/MOTOR.md`, `app.js` (`panelFabrica`), `ejemplos/ikisai/compra-food.mjs`; PR #33 (rama `reglas-cortas`, `docs/REGLAS_CORTAS.md`).
