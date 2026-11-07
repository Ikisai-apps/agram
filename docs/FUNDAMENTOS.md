# Fundamentos decididos (6-11-2026)

Resumen de lo que está decidido para construir el núcleo. El detalle y la trazabilidad viven fuera de este repositorio.

## Lectura segura: de la cruz a la X

El eje horizontal es la cadena de registros: pasado a la izquierda, presente en el centro, proyecciones a futuro a la derecha (PV6 y PV7, **hilos** encadenados por referencia). La confluencia hacia arriba produce PV8 (mediciones, niveles y grados). De ahí bajan los caminos de PV9. En el centro queda el registro en foco: PV5. Una lente sobre él es PV0. De la confluencia de árboles vecinos salen los cuatro ramales: PV1 entre 6 y 8, PV2 entre 8 y 7, PV3 entre 6 y 9, PV4 entre 7 y 9. La mano del usuario trabaja en 1–4 y ejecuta en 4. **Ejecutar escribe**: produce un registro nuevo que entra en el eje. La X escribe hacia la cruz; la cruz se lee hacia la X.

## Eventos sobre tokens

Todo evento **es** una transición de tokens; el payload BTML viaja encima. No hay evento sin movimiento. El evento mínimo mueve **T** (tiempo; siete escalas: segundo, minuto, hora, día, semana, ciclo de 28 días, año; cada escala es un token distinto). E (recursos), P (poder/criterio), R (reputación) entran cuando el evento los toca. Los tokens son tokens de base de datos; sin Nostr ni Bitcoin por ahora.

## Génesis

El primer registro se escribe por convención, fuera del sistema: emite tokens iniciales a la primera identidad bajo la regla corta de la época 0 (cada dígito es un PV) y fija un foco raíz. A partir de ahí todo se genera dentro.

## Épocas

La época es una convención paralela, **fuera del dato**. Un dato se puede leer desde cualquier época. La época actual es la confluencia de las pasadas y predefine cómo se calculará la siguiente. BTML no lleva época dentro. Las épocas viven como datos en `datos/epocas/`: la época 0 (un PV por dígito, en toda profundidad) y la «época 1 (propuesta)», pendiente de VG (`docs/REGLAS_CORTAS.md`).

## BTML

La unidad de información es el evento (identidad, firmante, contexto, metadatos) con un payload: un terminal (número, palabra, HTML, archivo, referencia) o un array posicional de hasta diez posiciones, sin nulos ni huecos, cuyas posiciones contienen terminales, subarrays o referencias a otros eventos. Las referencias no copian. Las direcciones son cadenas de diez dígitos; el ID no es la dirección. Los dígitos son posiciones semánticas: el significado de cada profundidad lo da la regla corta de la época.

## Modos, proporción y topes de escritura

Pointed (~1 décupla), Sequenced (~10), Mapped (~100), Scened (~1000). La unidad de cuenta es la posición. Desde Pointed se escribe un décimo de lo leído; desde Sequenced entre un quinto y un décimo; desde Mapped entre un cuarto y un tercio: es el estándar. Además hay **topes duros** de posiciones emitidas de una vez (7-11): Pointed 10, Sequenced 100, Mapped 1000, Scened 10000, lo mismo que cada modo lee. Son topes de lo **emitido**; lo que un modo lee es **capacidad, no tope duro**: Scened corta su escena en 10000 posiciones por defecto, y esa capacidad se puede bajar, subir o quitar (**[X] decidir VG** si la lectura tiene tope duro: el mapa solo fija los de emisión; `docs/MODOS.md` §6). El registro de salida se anida sobre el contenido del foco. En el código rechazan las dos, como dice el mapa («además de la proporción»): primero la proporción, como antes del 7-11 y con el mismo mensaje, su máximo sobre las posiciones del registro; después el tope, sobre lo emitido. **[X] decidir VG**: el mapa no dice si la proporción rechaza o solo informa; con las dos rechazando, la proporción (1, 20, 333) se alcanza antes que el tope y la matriz de 1000 no cabe en Mapped. Hasta que VG lo decida se conserva lo que había: rechaza.

## Sobrio y animado

Cada operación es una sola: la transición con su efecto nombrado. Sobrio y animado son dos renders de la misma operación, intercambiables en cualquier modo y PV, y ambos personalizables (PV0). Los mundos de los PV (reino, jardín, parque acuático, fábrica, hilos, cielo, camino) son especificación funcional: cada animación corresponde a un cambio semántico explicable.

## Añadido en la noche del 6 al 7-11-2026

### Colisiones, no apaños

Una dirección con ceros finales nombra a la vez la posición 1, la 1.0, la 1.0.0… Todos son ocupantes legítimos de esa dirección, con su camino exacto y su procedencia. Un terminal no tiene posición 0. Las colisiones se conservan y se ordenan sin borrar nada: son la materia prima de `BUSCAR`, de los criterios (`ORDENAR`), de `ACTUAL` y `ELEGIR` (que no publica) y de la fábrica (consolidar es la única fijación, y no borra). No existe modificar en sitio: corregir es añadir un ocupante. `BUSCAR` las pide de dos maneras, sin ambigüedad (VG, 7-11): con un número es índice (el camino exacto, relativo al anfitrión); con un texto de diez dígitos es dirección (absoluta en el registro, la colisión entera). Dentro de `FILTRAR` y `ORDENAR`, `ORIGEN()` dice de dónde viene cada ocupante (propio, referencia o escrito). Una consolidación guarda de dónde vino cada fuente elegida, con su vector (`contexto.encaje`). La época cambia qué ocupantes aparecen y cómo se ordenan; hoy solo por el gancho `epoca.ordinal`, que ninguna época usa todavía (cómo cambia el vector con la época: pendiente).

### El vector de encaje

Cada ocupante lleva su origen (la dirección del candidato), su destino (la dirección buscada) y el vector de diez diferencias con signo, dígito a dígito (corpus V4): **candidato − buscado**, como el ejemplo del corpus «+2 en el quinto dígito». Positivo, al candidato le sobra en esa profundidad (reducir); negativo, le falta (completar). La distancia (la diferencia sin signo, profundidad a profundidad y sin sumar enteros) también es información. Lo escrito anclado en la dirección buscada es encaje exacto. Decidido por VG el 7-11 por la tarde (opción B de `docs/notas/SIGNO_DEL_VECTOR.md`, mapa §12 [D]): el signo es información por componente, y **ni el signo ni la distancia ordenan** hasta que una época haga ordinal una profundidad (entonces solo ahí). Ordenan las coincidencias de ruta (el acuerdo de prefijo) y, a igualdad, la llegada, sin borrar nada; el corpus prohíbe «puntuar por cercanía ciega». La orientación (opción E, el tercer cero) queda apuntada; las reglas cortas (`docs/REGLAS_CORTAS.md`) aún no declaran ninguna profundidad ordinal. Lectura anterior, retirada: «ordena la distancia» y «positivo = falta».

### Tokens según el corpus

**P** (poder/criterio) exige siempre un ámbito: el registro cuyo subárbol cubre, o `genesis` (todo el eje). No existe un P total. Delegar poder estrecha el ámbito y se debita del ámbito que lo cubre. El motor autoriza con el poder sobre el registro de la consolidación. **R** (reputación) exige emisor y no es fungible: solo su emisor la mueve; quien la recibe la tiene «de X» y no puede pasarla. **E** por emisor y denominación. **T** por escala (ver «Series de tokens», 7-11; antes era un solo token en segundos). La validación de un evento simula sus movimientos sobre una vista de los saldos: si algo falla, nada cambia.

### Comparabilidad (PV8): el 8 compara ocupantes

La verdad es la base escrita; `confluir` es el respaldo declarado (VG, 7-11 noche: sin base escrita en el 8, calcula al vuelo y dice «sin base escrita»; `docs/MOTOR.md` §14). La confluencia hacia arriba (`tiempo.confluir`) no asigna nivel ni grado: construye las **bases** del foco frente a una cohorte de comparables accesibles y dice en qué caja cae el foco. Cohortes (VG, 7-11), lo que leerá el 8 del padre, del proyecto o del génesis: hermanos (elementos similares: escritos sobre el mismo padre) ⊂ proyecto (dónde estoy: el registro del hilo que cuelga del génesis y todo lo que cuelga de él, recorrido por el índice de hijos; no es el hilo) ⊂ general (el ámbito: todo el eje). Qué registro es el proyecto sigue abierto. Por cada medida (posiciones desarrolladas, terminales, escritos, movimientos, identidades, profundidad del hilo, fórmulas) y por cada serie de token que alguien mueve (`T:<escala>`, `E:<emisor>/<denominación>`, `P:<ámbito>`, `R:<emisor>`: no hay P total ni R fungible), solo lo **fundible**: recuento, suma, mínimo, máximo e histograma de diez cajas (una décupla por medida, cuyas diez posiciones son los diez hitos del 8). Fundir dos bases (`tiempo.fundir`) es O(1). Los cortes de las cajas son regla de la época; la época 0 no los tiene, así que hoy son provisionales (igual anchura en la cohorte) y esos histogramas no se funden entre cohortes. Por cada posición 0–9, cuántos comparables la tienen según sus ocupantes (`encaje.ocupantes`: los caminos que colisionan en ella, lo que alcanzan sus referencias y lo escrito encima) y por qué procedencia: propia, alcanzada por referencia (las referencias no copian) o escrita encima, también por debajo de la profundidad 0. Lo escrito en la raíz colisiona con la posición 0 y se devuelve aparte. Los HITOS heredados son solo una tabla. Consulta sin efectos. Las **bases escritas** son registros en la posición 8 del registro que resumen (VG, 7-11; `src/bases.js`, `docs/MOTOR.md` §14): las escribe la propia cosa con su clave y gastando su T, con las mismas medidas y cohortes que `confluir`; el 8 de cada registro guarda la base de sus hijos y la de su subárbol, que funde las bases de los hijos sin releer registros, y se leen con `BASES()` en BQL. Como sus cajas han de fundirse, sin cortes de la época usan unos provisionales fijos. Las bases no son hermanas, ni escritos, ni comparables de lo que miden.

### AARPIA e identidades

La autorización y la ejecución reales son de AARPIA, que aún no existe; lo que hay en el motor (autoriza quien tiene poder sobre el registro y no es el autor; ejecuta el autor) es un hueco provisional. Las identidades son personas, grupos de personas o cosas; quien da de alta a una identidad declara su clave y su tipo en el mismo evento que le da tokens. El tipo solo sirve para saber quién emite (ver «Series de tokens»).

### Lenguaje para IA

Los lenguajes se hicieron para que programaran personas; aquí programan IA. Por eso: posiciones en vez de nombres (coordenadas), referencias que no copian (conexiones), colisiones como distribución, vector como distancia, consolidar como colapso con traza, época como lectura por contexto. El léxico es una capa (las reglas cortas) sobre las posiciones; las fórmulas son cortas y locales; el frontend es la única parte pensada para personas. La prueba que lo mide es «el extranjero»: un agente sin corpus, solo con las reglas y la gramática, escribe registros y fórmulas correctas (resultados en `docs/notas/PRUEBA_DEL_EXTRANJERO.md`).

## Añadido el 7-11-2026: reservas, fábrica y mundos

### La plaza: capacidad, colisión y anclaje

Una plaza (una cama) es una **posición** del elemento habitación, dentro de los recursos de la disponibilidad (la 1.k), y a la vez una **serie limitada** de tokens E que emite quien la respalda (la casa): un token por plaza y noche, tantos como capacidad (VG, 7-11: «las dos cosas a la vez»). La reserva se ancla en la plaza y lleva sus noches en su propio 7; las reservas de la misma plaza colisionan ahí y se ven todas. Ejecutar la reserva en la fábrica es mover esos tokens de la casa a quien reserva; la segunda reserva solapada se escribe y colisiona, pero no se ejecuta: la casa ya no tiene el token de esa noche (saldo insuficiente). En `main`: el ejemplo de la reserva (`ejemplos/ikisai/reserva-booking.mjs`, `test/ejemplo-booking.test.js`). Cómo firma la confirmación a dos partes sin atomicidad es de AARPIA ([X] decidir VG, en el propio ejemplo).

### Las bases del 8: lo decidido

«Comparabilidad (PV8)» describe el cálculo. Lo decidido para escribirlo (VG, 7-11, «exactamente lo que buscábamos»): sin base de datos aparte, las estadísticas son **registros** en la posición 8 del registro que resumen, con referencias a lo medido; el 8 del proyecto funde las bases de sus hijos y el 8 del génesis, las de los proyectos; la base lleva fecha y frescura; la escribe la propia cosa con su clave y gastando su T; corregir es añadir otra base (la historia sale gratis); lo que no se funde (medianas exactas, correlaciones) se aproxima o se descarta; `BASES()` en BQL las lee. En `main`: `src/bases.js` las escribe como registros en la posición 8 y `BASES()`, `CAJA()` y `FRESCURA()` las leen (`docs/BQL.md` §7.13–§7.14); el detalle y sus abiertos, en `docs/notas/BASES_DEL_8.md` y `docs/MOTOR.md` §14.

### El registro de salida de la fábrica

Se escribe de 0 a 9, y dentro de cada posición igual, sin huecos ni «no aplicable»: no se rellena macizo, se va por las ramas a las hojas necesarias (VG, 7-11). El impulso financiero es la base de la ejecución. La matriz 10×10×10 (los diez PV como tercer dígito, relativa al camino), la herencia por referencia, el anclaje de lo lejano y los topes duros de emisión por modo están en `main` y se explican una sola vez, más abajo: «La fábrica: la matriz 10×10×10» y «Topes duros de emisión por modo».

### Los mundos animados: el orden

Cada animación corresponde a una transición real (ver «Sobrio y animado»). El orden decidido (VG, 7-11): primero la cruz entera, los hilos 6 y 7, luego el cielo 8 y el camino 9, con el 5 en el centro; después la X: la fábrica 4 (confluencia de 7 y 9), el 1, el 2, el 3 y la lente 0. Antes de animar, un catálogo de efectos: qué se ve en cada mundo cuando cambia la celda i.j.k. En `main`: el catálogo de efectos (`src/efectos.js`, `docs/EFECTOS.md`) y, sobre él, la cruz entera (los hilos del 6 y 7; el cielo del 8, el camino del 9 y el 5 en el centro) y la X (fábrica 4, ciudad 1, jardín 2, parque 3 y lente 0), en Mapped con «animado» (`mundos/`, `docs/MUNDOS.md`). Scened no anima nada: solo tiene el render sobrio.

## Las decisiones del mapa §12, una a una

Comprobación de que este documento recoge cada [D] del §12 del mapa (noche del 6 al 7-11 y 7-11). Las que el propio mapa retira o corrige van con su corrección.

| [D] del mapa §12 | Dónde está aquí | En `main` (03dbf34) |
|---|---|---|
| Colisiones, no apaños; un terminal no tiene posición 0; `ORIGEN()` | «Colisiones, no apaños» | hecho |
| Qué es una colisión (materia prima de BUSCAR, ORDENAR, ACTUAL/ELEGIR y la fábrica; corregir es añadir; el 8 compara ocupantes; la época cambia ocupantes y orden) | «Colisiones, no apaños», «Comparabilidad (PV8)» | hecho, salvo cómo cambia el vector con la época |
| Vector de diez diferencias con signo; la consolidación guarda los vectores de sus fuentes | «El vector de encaje», «Colisiones, no apaños» | hecho |
| Corrección del signo y signo del vector: opción B | «El vector de encaje» (la lectura anterior, retirada) | hecho |
| AARPIA es el motor real; identidades | «AARPIA e identidades» | hueco provisional en el motor |
| Idea de fondo: lenguaje para IA; prueba del extranjero | «Lenguaje para IA» | prueba hecha (nota) |
| Capacidad y tokens casan; plaza como posición con capacidad y serie limitada | «La plaza: capacidad, colisión y anclaje», «Series de tokens» (E) | hecho en el ejemplo de la reserva |
| Las series de tokens son una constante y se estandarizan | «Series de tokens» | hecho |
| Anclaje de la reserva | «La plaza: capacidad, colisión y anclaje» | hecho en el ejemplo de la reserva |
| Poder de recepción y reputación | «Series de tokens» (P y R) | hecho |
| Titulares y su corrección: las cosas son titulares, solo personas y grupos emiten | «Series de tokens» («Quién emite») | hecho |
| BUSCAR por dirección y por índice | «Colisiones, no apaños» | hecho |
| Cohortes y bases del 8 | «Comparabilidad (PV8)», «Las bases del 8: lo decidido» | hecho: cohortes y cálculo (`src/tiempo.js`) y bases escritas en el 8 (`src/bases.js`; `BASES`, `CAJA` y `FRESCURA` en BQL) |
| Posiciones sin contenido y registro de salida de la fábrica; la tercera dimensión son los PV; topes duros | «El registro de salida de la fábrica», «La fábrica: la matriz 10×10×10», «Topes duros de emisión por modo» | hecho: herencia por referencia, anclaje de lo lejano, matriz relativa al camino y topes de emisión (`src/escritura.js`, `src/modos.js`); los [X] de esas secciones siguen abiertos |
| Orden de los mundos animados; catálogo de efectos antes de animar | «Los mundos animados: el orden» | hecho: catálogo de efectos, la cruz (hilos, cielo, camino y el 5) y la X (`mundos/`, `docs/MUNDOS.md`) |
| Agentes: todo a Opus, que no sobren tokens | — | organización del trabajo, no del núcleo: no va aquí |

## Series de tokens (VG, 7-11-2026)

«Las series de tokens son una constante y se estandarizan.» Toda familia de tokens es una **serie**; la serie es limitada y la emite quien la respalda. La constante, en una línea por familia (familia: clave de serie: quién la emite):

| Familia | Clave de serie | Quién la emite |
|---|---|---|
| **T** tiempo | `T:<escala>` (segundo, minuto, hora, dia, semana, ciclo, anio) | el génesis |
| **E** recursos | `E:<emisor>/<denominación>` (`E:casa/EUR`, `E:casa/cama-2@2026-11-13`…) | su emisor, persona o grupo: la denominación va ligada a él, como en R |
| **P** poder/criterio | `P:<ámbito>` (un registro o `genesis`) | el génesis, sobre todo el eje; a los demás les llega por delegación |
| **R** reputación | `R:<emisor>` | su emisor, persona o grupo: la declara y solo él la amplía, con rastro visible |

**Quién emite.** Emitir (iniciar una serie o ampliarla) es lo único reservado a **personas y grupos**. Las **cosas** (una habitación, una plaza) son titulares: tienen clave, firman, reciben, conservan y mueven tokens, pero no emiten. El tipo (persona, grupo o cosa) se declara en el alta, como la clave, y no cambia; quien no lo declaró no emite. La emisión nace en la cartera de su emisor (`de: null`, `a` = el emisor); para darla se mueve después, en el mismo evento si quiere. Una serie solo crece cuando su emisor emite, y lo emitido no puede llegar a infinito.

**T.** Siete tokens distintos, uno por escala, ampliable hasta diez. Sin conversión: una hora **no** son sesenta minutos, son tokens distintos, como un euro no es un bitcoin. T va en enteros: media hora serían minutos. Escribir cuesta minutos, así que quien escribe necesita minutos; el génesis del ejemplo emite minutos y horas y las altas reparten ambos. La duración de cada escala solo sirve para medir distancias (las bandas del eje temporal), nunca para cambiar un token por otro.

**E.** Una persona o un grupo **emite una serie limitada** de una denominación que respalda (la casa emite un token por plaza y noche): `{ token: 'E', emisor, denominacion, cantidad, de: null, a: emisor }`, con `emisor` igual al autor del evento. La serie es suya: la clave lleva al emisor, así que nadie se queda un nombre ni emite la denominación de otro; la misma denominación emitida por otro es otra serie, y los EUR de la casa no son los de nadie más. Dentro de su serie, E es fungible. Lo emitido de cada serie se consulta con `eje.serie(clave)` y `eje.series()`.

**R.** Su emisor la declara y solo él la amplía (`{ token: 'R', emisor, cantidad, de: null, a: emisor }`); cada ampliación es un evento suyo en el eje, que es el rastro visible.

**P.** La casa escribe un registro de dominio («Alojamiento») y delega P con ese ámbito; recepción autoriza lo que cuelga de ahí y puede delegar hacia abajo; delegar estrecha el ámbito. Hoy P solo se emite en el génesis (ámbito `genesis`, todo el eje): es el estado de partida, no la regla (ver abajo).

Decidido [D] (VG, 7-11, mapa §12) e implementado: lo anterior, salvo que T y P solo se emitan en el génesis, que es el estado de hoy. Quién emite T y P está decidido por VG en el mapa §12 (7-11 noche, decisión 5 de §14.1): emite siempre una persona, P solo por ámbito y nunca «P total», escalonado T→R→P→E; encargado y pendiente de implementar; mientras tanto, el P de ámbito `genesis` hace de poder sobre todo el eje, que es lo que esa decisión excluye. Abierto [X] decidir VG: qué escalas completan las diez de T; si E, P y R admiten fracciones (hoy sí, en coma flotante); cómo firma un grupo (es de AARPIA).

## Añadido el 7-11-2026 (tarde)

### La fábrica: la matriz 10×10×10

La fábrica (PV4) parte de la matriz de 100 del foco (10 posiciones × 10 subposiciones), que ya está y no se emite. El registro de salida emite **solo las celdas modificadas**. La tercera dimensión es la **clase de modificación**, y son los diez PV bajo la época 0 («siempre estamos aplicando los puntos de vista»): 0 ver/sustituir, 1 impulso de recursos, 2 criterio, 3 comunicación, 4 acción, … **[X] decidir VG**: el nombre de las clases 5–9 (son los PV 5–9: estructura, pasado, futuro, comparabilidad, camino; en el código valen `null`). Una modificación de clase k sobre la celda [i][j] se escribe en `payload[i][j][k]`: pagar el precio de una compra (la celda [1][2]) es [1][2][4]. La matriz es **relativa al camino** (VG, 7-11 tarde): desde donde esté el foco (un camino de profundidad n), los tres dígitos siguientes son posición, subposición y clase; la celda i.j.k bajo el camino c cae en `direccion([...c, i, j, k])` y su clase es el dígito en la profundidad n + 2, no el tercero absoluto (sin camino, coinciden). La misma dirección es otra celda, con otra clase, leída desde otro camino. **Ver ya es una modificación** (clase 0), así que siempre se emite algo; solo se ve lo que la dirección alcanza en el foco. La matriz completa son 1000 posiciones, el tope de Mapped (la proporción de Mapped, 333, hoy no la deja pasar: ver arriba).

Lo no modificado anterior a lo modificado se hereda del foco por referencia (no hay huecos: no se rellena macizo, se va por las ramas a las hojas necesarias), y solo si el foco tiene contenido en ese camino exacto, de modo que una referencia heredada siempre alcanza algo. Lo que cuelga de un terminal no tiene base, salvo la posición 0 de la raíz de un foco terminal, que se hereda como antes de la matriz (su dirección alcanza el terminal por la colisión de ceros finales). **[X] decidir VG**: el mapa §12 dice «un terminal no tiene posición 0 (PENDIENTE)»; se conserva lo que había. Lo lejano, para lo que el foco no tiene base, no se rechaza: se **ancla** en su posición (`en`). El registro guarda qué heredó (`contexto.heredadas`): lo demás se vio o se escribió. Ningún registro guarda un campo de clase: se lee al leer, de la dirección y del camino desde el que se escribió. Tampoco guarda ese camino (**[X] decidir VG** si lo guarda: sin él, la dirección de un registro anclado no dice su clase). La consolidación sigue diciendo en `encaje` de dónde vino cada elección con fuente; sus terminales nuevos van aparte, en `nuevos`, con su destino. Qué clase tienen las elecciones de una consolidación, la autorización y la ejecución está sin decidir (**[X] decidir VG**). Detalle en `docs/MOTOR.md` §7.

### Topes duros de emisión por modo

Pointed 10, Sequenced 100, Mapped 1000, Scened 10000 posiciones emitidas de una vez; lo heredado por referencia no se emite y no cuenta (mapa §12: «se emiten solo las décuplas modificadas»). Scened tiene tope de emisión y una composición con render sobrio (`src/scened.js`, `docs/MODOS.md`), sin formulario de escritura; lo que su escena lee no tiene tope duro: es capacidad (10000 posiciones por defecto, ajustable; **[X] decidir VG**, ver arriba). La proporción también rechaza, y cuenta todas las posiciones del registro, lo heredado incluido, como antes; se mira primero, así que mientras rechace el tope solo decide en Scened. Al ubicar **una celda** (`ubicar` con el modo, y `escribirDesde` con una celda) se tienen en cuenta los dos límites: si dentro del registro, con su relleno, no cabe, se ancla sola. `desdeMapped`, que conforma **varias celdas** a la vez, las ubica solo por la base, y `escribirSalida` mide la salida entera y la rechaza si no cabe. **[X] decidir VG**: si la proporción, que el mapa mantiene («además de la proporción»), rechaza o informa (hoy rechaza, como antes; ver arriba); si `desdeMapped` también ancla por límites, y qué celdas; si el relleno heredado se cobra en T (hoy sí, como antes: un minuto por posición del registro).

## Neutralidad ante agrupación y división (VG, 7-11 noche)

«Emitir desde dos fuentes es igual de válido que emitir el doble desde una única fuente. No da más.» Nadie gana nada por agruparse, por dividirse ni por crear identidades falsas: un padre que lleva el dinero de sus hijos no tiene más por eso (mapa §12 [D]). T queda fuera, porque es el medidor anti-spam de cada uno y por sí mismo no vale nada (VG, 7-11 noche); la neutralidad se mide en E, P y R y en todo lo que se concede a terceros (elegibilidad, ranking, cohortes, autorizaciones). El estudio, con el mapa de lo que hoy se concede por identidad, los cuatro diseños atacados, la recomendación y las preguntas para VG, está en [`docs/notas/NEUTRALIDAD_IDENTIDAD.md`](notas/NEUTRALIDAD_IDENTIDAD.md); la propiedad ejecutable, en `test/neutralidad.test.js`, con lo que hoy la viola en `skip` (NEU-01 a NEU-08). Este párrafo no cambia ninguna regla de arriba: lo que proponga la nota solo entra cuando VG lo decida.
