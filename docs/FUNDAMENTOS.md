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

Una dirección con ceros finales nombra a la vez la posición 1, la 1.0, la 1.0.0… Todos son ocupantes legítimos de esa dirección, con su camino exacto y su procedencia. Un terminal no tiene posición 0. Las colisiones se conservan y se ordenan sin borrar nada: son la materia prima de `BUSCAR`, de los criterios (`ORDENAR`), de `ACTUAL` y `ELEGIR` (que no publica) y de la fábrica (consolidar es la única fijación, y no borra). No existe modificar en sitio: corregir es añadir un ocupante. `BUSCAR` las pide de dos maneras, sin ambigüedad (VG, 7-11): con un número es índice (el camino exacto, relativo al anfitrión); con un texto de diez dígitos es dirección (absoluta en el registro, la colisión entera).

### El vector de encaje

Cada ocupante lleva su origen (la dirección del candidato), su destino (la dirección buscada) y el vector de diez diferencias con signo, dígito a dígito (corpus V4): **candidato − buscado**, como el ejemplo del corpus «+2 en el quinto dígito». Positivo, al candidato le sobra en esa profundidad (reducir); negativo, le falta (completar). La distancia (la diferencia sin signo, profundidad a profundidad y sin sumar enteros) también es información. Lo escrito anclado en la dirección buscada es encaje exacto. Decidido por VG el 7-11 por la tarde (opción B de `docs/notas/SIGNO_DEL_VECTOR.md`, mapa §12 [D]): el signo es información por componente, y **ni el signo ni la distancia ordenan** hasta que una época haga ordinal una profundidad (entonces solo ahí). Ordenan las coincidencias de ruta (el acuerdo de prefijo) y, a igualdad, la llegada, sin borrar nada; el corpus prohíbe «puntuar por cercanía ciega». La orientación (opción E, el tercer cero) queda apuntada; las reglas cortas (`docs/REGLAS_CORTAS.md`) aún no declaran ninguna profundidad ordinal. Lectura anterior, retirada: «ordena la distancia» y «positivo = falta».

### Tokens según el corpus

**P** (poder/criterio) exige siempre un ámbito: el registro cuyo subárbol cubre, o `genesis` (todo el eje). No existe un P total. Delegar poder estrecha el ámbito y se debita del ámbito que lo cubre. El motor autoriza con el poder sobre el registro de la consolidación. **R** (reputación) exige emisor y no es fungible: solo su emisor la mueve; quien la recibe la tiene «de X» y no puede pasarla, solo devolvérsela a su emisor (VG, 7-11 noche: «pedir atención»). **E** por emisor y denominación. **T** por escala (ver «Series de tokens», 7-11; antes era un solo token en segundos). La validación de un evento simula sus movimientos sobre una vista de los saldos: si algo falla, nada cambia.

### Comparabilidad (PV8): el 8 compara ocupantes

La confluencia hacia arriba (`tiempo.confluir`) no asigna nivel ni grado: construye las **bases** del foco frente a una cohorte de comparables accesibles y dice en qué caja cae el foco. Cohortes (VG, 7-11), lo que leerá el 8 del padre, del proyecto o del génesis: hermanos (elementos similares: escritos sobre el mismo padre) ⊂ proyecto (dónde estoy: el registro del hilo que cuelga del génesis y todo lo que cuelga de él, recorrido por el índice de hijos; no es el hilo) ⊂ general (el ámbito: todo el eje). Qué registro es el proyecto sigue abierto. Por cada medida (posiciones desarrolladas, terminales, escritos, movimientos, identidades, profundidad del hilo, fórmulas) y por cada serie de token que alguien mueve (`T:<escala>`, `E:<emisor>/<denominación>`, `P:<ámbito>`, `R:<emisor>`: no hay P total ni R fungible), solo lo **fundible**: recuento, suma, mínimo, máximo e histograma de diez cajas (una décupla por medida, cuyas diez posiciones son los diez hitos del 8). Fundir dos bases (`tiempo.fundir`) es O(1). Los cortes de las cajas son regla de la época; la época 0 no los tiene, así que hoy son provisionales (igual anchura en la cohorte) y esos histogramas no se funden entre cohortes. Por cada posición 0–9, cuántos comparables la tienen según sus ocupantes (`encaje.ocupantes`: los caminos que colisionan en ella, lo que alcanzan sus referencias y lo escrito encima) y por qué procedencia: propia, alcanzada por referencia (las referencias no copian) o escrita encima, también por debajo de la profundidad 0. Lo escrito en la raíz colisiona con la posición 0 y se devuelve aparte. Los HITOS heredados son solo una tabla. Consulta sin efectos. Las **bases escritas** son registros en la posición 8 del registro que resumen (VG, 7-11; `src/bases.js`, `docs/MOTOR.md` §14): las escribe la propia cosa con su clave y gastando su T, con las mismas medidas y cohortes que `confluir`; el 8 de cada registro guarda la base de sus hijos y la de su subárbol, que funde las bases de los hijos sin releer registros, y se leen con `BASES()` en BQL. Como sus cajas han de fundirse, sin cortes de la época usan unos provisionales fijos. Las bases no son hermanas, ni escritos, ni comparables de lo que miden.

### AARPIA e identidades

La autorización y la ejecución reales son de AARPIA, que aún no existe; lo que hay en el motor (autoriza quien tiene poder sobre el registro y no es el autor; ejecuta el autor) es un hueco provisional. Las identidades son personas, grupos de personas o cosas; quien da de alta a una identidad declara su clave y su tipo en el mismo evento que le da tokens. El tipo solo sirve para saber quién emite: solo las personas (ver «Series de tokens»; VG, 7-11 noche).

### Lenguaje para IA

Los lenguajes se hicieron para que programaran personas; aquí programan IA. Por eso: posiciones en vez de nombres (coordenadas), referencias que no copian (conexiones), colisiones como distribución, vector como distancia, consolidar como colapso con traza, época como lectura por contexto. El léxico es una capa (las reglas cortas) sobre las posiciones; las fórmulas son cortas y locales; el frontend es la única parte pensada para personas.

## Series de tokens (VG, 7-11-2026; quién emite, 7-11 noche)

«Las series de tokens son una constante y se estandarizan.» Toda familia de tokens es una **serie**; la serie es limitada y la emite quien la respalda. Y quien respalda es siempre una persona (VG, 7-11 noche): «todos son emitidos por una persona individualmente. Siempre es X persona respalda Y recurso concreto, poder de decisión sobre algo, reputación cedida a otros para requerir atención, o tiempo usado por alguien en algo». La constante, en una línea por familia (familia: clave de serie: quién la emite):

| Familia | Clave de serie | Quién la emite |
|---|---|---|
| **T** tiempo | `T:<escala>` (segundo, minuto, hora, dia, semana, ciclo, anio), sin emisor en la clave | cada persona, para sí misma, sin pasar del reloj desde su alta (PROVISIONAL [X]: neutralidad ante agrupación y división); también el génesis |
| **E** recursos | `E:<emisor>/<denominación>` (`E:casa/EUR`, `E:casa/cama-2@2026-11-13`…) | una persona, a su nombre o al de un grupo sobre cuyo registro tiene P; la denominación va ligada al emisor, como en R |
| **P** poder/criterio | `P:<ámbito>` (un registro o `genesis`) | el génesis, sobre todo el eje; después, una persona sobre un registro del que es autora o sobre el que ya tiene P (para delegarlo); a los demás les llega por delegación |
| **R** reputación | `R:<emisor>` | una persona, a su nombre o al de un grupo sobre cuyo registro tiene P: la declara y solo ella la amplía, con rastro visible |

**Quién emite.** Emitir (iniciar una serie o ampliarla) es lo único reservado a las **personas** (`EMITEN = ['persona']`). Un **grupo** es un registro con P delegado: lo que «emite el grupo» lo emite, y lo firma, una persona con P sobre el registro del grupo (su alta, `eje.alta(grupo)`); la serie de E o de R puede quedar a nombre del grupo (`emisor` = el grupo) y nace en su cartera. Las **cosas** (una habitación, una plaza) y los grupos son titulares: tienen clave, firman, reciben, conservan y mueven tokens, pero no emiten. El tipo (persona, grupo o cosa) se declara en el alta, como la clave, y no cambia; quien no lo declaró no emite. El génesis lo escribe una persona (o quien no declara tipo, como antes), nunca un grupo ni una cosa. La emisión nace en la cartera de quien la emite (`de: null`, `a` = el emisor); para darla se mueve después, en el mismo evento si quiere. Una serie solo crece cuando su emisor emite, y lo emitido no puede llegar a infinito.

**T.** Siete tokens distintos, uno por escala, ampliable hasta diez. Sin conversión: una hora **no** son sesenta minutos, son tokens distintos, como un euro no es un bitcoin. T va en enteros: media hora serían minutos. Escribir cuesta minutos, así que quien escribe necesita minutos; el génesis del ejemplo emite minutos y horas y las altas reparten ambos. La duración de cada escala solo sirve para medir distancias (las bandas del eje temporal) y el tope del reloj, nunca para cambiar un token por otro. Cada persona emite su T a sí misma (`{ token: 'T', escala, cantidad, de: null, a: autor }`); la serie sigue siendo `T:<escala>`, constante, para que el T de distintas personas se intercambie. **El tope** (PROVISIONAL [X] (VG, 7-11 noche): «emitir desde dos fuentes es igual de válido que emitir el doble desde una única fuente; no da más». «T por identidad y reloj» es justo lo que una identidad falsa multiplica, así que la regla final saldrá del estudio de neutralidad ante agrupación y división. Hoy, como [X] regla de la época, `tokens.topeT` y `TOPE_T_MINIMO`): por persona y escala, lo emitido acumulado hasta el instante `t` del evento no pasa de ⌈(t − alta) / duración de la escala⌉, y nunca de menos de 1. El alta es el `t` del evento en que la persona recibió tokens por primera vez (el génesis es el alta de su autor); lo emitido en el génesis no cuenta. Se consulta con `eje.emitidoT(persona, escala)`.

**E.** Una persona **emite una serie limitada** de una denominación que respalda (la casa emite un token por plaza y noche): `{ token: 'E', emisor, denominacion, cantidad, de: null, a: emisor }`, con `emisor` igual al autor del evento o a un grupo sobre cuyo registro tiene P. La serie es de su emisor: la clave lo lleva, así que nadie se queda un nombre ni emite la denominación de otro; la misma denominación emitida por otro es otra serie, y los EUR de la casa no son los de nadie más. Dentro de su serie, E es fungible. Lo emitido de cada serie se consulta con `eje.serie(clave)` y `eje.series()`. La emisión puede llevar `caduca` (ver «Ciclo de vida»).

**R.** Su emisor la declara y solo él la amplía (`{ token: 'R', emisor, cantidad, de: null, a: emisor }`); cada ampliación es un evento suyo en el eje, que es el rastro visible. Un mensaje no emite R.

**P.** La casa escribe un registro de dominio («Alojamiento») y delega P con ese ámbito; recepción autoriza lo que cuelga de ahí y puede delegar hacia abajo; delegar estrecha el ámbito. Fuera del génesis, una persona emite `P:<ámbito>` solo si el ámbito es un registro que existe y del que es autora, o sobre el que ya tiene P (y entonces lo emite para delegarlo). P sobre todo el eje (`genesis`) solo lo emite el génesis.

**Emisión escalonada** (VG, 7-11 noche: «normalmente será T + (opc) R; si T + R + (opc) P; si T+R+P + (opc) E»). En un evento que emite algo y no es el génesis (`src/ciclo.js`, la misma regla en `eje.validar` y en las capas 4 y 5 de validez):

| Emite | Exige en el mismo evento |
|---|---|
| T | nada más: es la base (y el tope del reloj) |
| R | mover T del autor |
| P | mover T del autor y **R propia en juego**: un movimiento de `R:<autor>` del autor hacia otra identidad o hacia el registro (`a` no nulo y distinto del autor; bloquearla o consumirla no cuenta) |
| E | lo de P y además **P del autor sobre el registro** `sobre` del evento: saldo disponible en un ámbito que lo cubre, o P que el autor mueve o recibe en el propio evento con ese ámbito |

Los errores dicen qué falta: «emitir E exige R propia en juego en el mismo evento», «emitir E exige P del autor sobre el registro…», «tope de T:hora para ana…».

Decidido [D] (VG, 7-11 y 7-11 noche) e implementado: lo anterior. Abierto [X] decidir VG: qué escalas completan las diez de T; si E, P y R admiten fracciones (hoy sí, en coma flotante); cómo firma un grupo (es de AARPIA); la regla de T, que es PROVISIONAL: «emitir desde dos fuentes es igual de válido que emitir el doble desde una única fuente; no da más» (VG, 7-11 noche), y un tope por identidad y reloj es justo lo que una identidad falsa multiplica (también el mínimo de un token por escala que cada alta recibe del reloj); la regla final saldrá del estudio de neutralidad ante agrupación y división.

## Ciclo de vida de cada token: emitir, transferir, bloquear, liberar, consumir (VG, 7-11 noche)

Cada movimiento es `{ token, cantidad, de, a, …campos de la serie }`. Emitir es `de: null`; consumir, `a: null`; transferir, `de` y `a` distintos. **Bloquear** y **liberar** no cambian de titular: llevan `estado: 'bloqueo'` o `estado: 'liberacion'` (sin acento, como los demás identificadores), `de` = `a` = el autor, la misma clave de serie y una `salida`: la condición verificable de liberación (corpus V10: «LOCK exige salida verificable explícita»). Bloquear pasa la cantidad del disponible al bloqueado; liberar la devuelve, citando la misma salida, y no más de lo bloqueado con ella. `eje.saldo(id, clave)` sigue siendo el **disponible**; lo bloqueado se lee con `eje.bloqueado(id, clave[, salida])` y `eje.bloqueos(id)`, y `eje.series()` da lo bloqueado de cada serie. Un consumo o una transferencia solo salen del disponible. Nadie mueve tokens ajenos: todo movimiento con `de` lo escribe su titular.

| T tiempo | Quién | Cómo |
|---|---|---|
| emitir | cada persona, a sí misma | `de: null, a: autor`, sin pasar del tope del reloj; el génesis, libremente a su autor |
| transferir | quien lo tiene | fungible en su escala: el T de una persona vale lo mismo que el de otra |
| bloquear / liberar | quien lo tiene | con salida; del disponible al bloqueado y vuelta |
| consumir | quien lo tiene | escribir cuesta T: todo evento mueve T del autor |

| R reputación | Quién | Cómo |
|---|---|---|
| emitir | una persona (a su nombre o al de un grupo con P) | a su propia cartera; exige T en el evento |
| transferir | solo su emisor | al pasar a otro titular nace la **obligación** del emisor: `eje.obligaciones(emisor)` = su R en manos ajenas (derivado de los saldos, no es un token; doble entrada, V10) |
| devolver | quien la tiene, a su emisor | es la liquidación: «pedir atención» (`de: tenedor, a: emisor`); baja la obligación |
| bloquear / liberar | solo su emisor | quien la tiene no puede pasarla, consumirla ni bloquearla: solo devolverla |
| consumir | solo su emisor | |

| P poder | Quién | Cómo |
|---|---|---|
| emitir | el génesis (sobre todo el eje); una persona, sobre un registro suyo o sobre el que ya tiene P | a su cartera; exige T y R propia en juego |
| transferir (delegar) | quien lo tiene | estrecha el ámbito: se debita del ámbito más concreto que lo cubre |
| bloquear / liberar | quien lo tiene | de la clave exacta `P:<ámbito>`, con salida |
| consumir | quien lo tiene | |

| E recursos | Quién | Cómo |
|---|---|---|
| emitir | una persona (a su nombre o al de un grupo con P) | a la cartera del emisor; exige T, R propia en juego y P sobre el registro del evento; puede llevar `caduca` |
| transferir | quien lo tiene | fungible dentro de su serie |
| bloquear / liberar | quien lo tiene | con salida |
| consumir | quien lo tiene | |

**Caducidad.** La emisión de E admite `caduca: <ISO>`. Es un campo del contrato de la serie: lo fija la primera emisión y las ampliaciones deben coincidir (sin caducidad, o con la misma). Se guarda en `eje.series()` (y en `eje.serie(clave)` si la hay). **Nunca es automática**: nada se ejecuta solo al caducar; BQL o el motor pueden leerla, y `caducada(eje, clave, t)` dice si ha caducado en `t`. Los tokens de una serie caducada se siguen moviendo.

**Las dos presiones** (VG, 7-11 noche). Decreciente, la **ejecución**: de T a E (T, después R, después P, después E: el escalonado de arriba). Creciente, la **liquidación**: «E da P que gastar en los criterios de ese recurso», «P da R para pedir la atención de otros», y «R ahorra T al cambiar E por el T de otras personas o de ti mismo en el pasado». El núcleo da las piezas (transferir, bloquear con salida, devolver R, delegar P, la obligación del emisor); `test/ciclo-eprt.test.js` recorre un ciclo completo de ida y vuelta.

Persistencia: versión 3. Lo guardado sigue siendo la lista de eventos; lo bloqueado y la caducidad se reconstruyen al revalidarlos. Un eje de la versión 2 se migra sin cambiar sus eventos y se revalida con estas reglas (lo que ya no las cumple, como un génesis de un grupo, no se restaura).

## Añadido el 7-11-2026 (tarde)

### La fábrica: la matriz 10×10×10

La fábrica (PV4) parte de la matriz de 100 del foco (10 posiciones × 10 subposiciones), que ya está y no se emite. El registro de salida emite **solo las celdas modificadas**. La tercera dimensión es la **clase de modificación**, y son los diez PV bajo la época 0 («siempre estamos aplicando los puntos de vista»): 0 ver/sustituir, 1 impulso de recursos, 2 criterio, 3 comunicación, 4 acción, … **[X] decidir VG**: el nombre de las clases 5–9 (son los PV 5–9: estructura, pasado, futuro, comparabilidad, camino; en el código valen `null`). Una modificación de clase k sobre la celda [i][j] se escribe en `payload[i][j][k]`: pagar el precio de una compra (la celda [1][2]) es [1][2][4]. La matriz es **relativa al camino** (VG, 7-11 tarde): desde donde esté el foco (un camino de profundidad n), los tres dígitos siguientes son posición, subposición y clase; la celda i.j.k bajo el camino c cae en `direccion([...c, i, j, k])` y su clase es el dígito en la profundidad n + 2, no el tercero absoluto (sin camino, coinciden). La misma dirección es otra celda, con otra clase, leída desde otro camino. **Ver ya es una modificación** (clase 0), así que siempre se emite algo; solo se ve lo que la dirección alcanza en el foco. La matriz completa son 1000 posiciones, el tope de Mapped (la proporción de Mapped, 333, hoy no la deja pasar: ver arriba).

Lo no modificado anterior a lo modificado se hereda del foco por referencia (no hay huecos: no se rellena macizo, se va por las ramas a las hojas necesarias), y solo si el foco tiene contenido en ese camino exacto, de modo que una referencia heredada siempre alcanza algo. Lo que cuelga de un terminal no tiene base, salvo la posición 0 de la raíz de un foco terminal, que se hereda como antes de la matriz (su dirección alcanza el terminal por la colisión de ceros finales). **[X] decidir VG**: el mapa §12 dice «un terminal no tiene posición 0 (PENDIENTE)»; se conserva lo que había. Lo lejano, para lo que el foco no tiene base, no se rechaza: se **ancla** en su posición (`en`). El registro guarda qué heredó (`contexto.heredadas`): lo demás se vio o se escribió. Ningún registro guarda un campo de clase: se lee al leer, de la dirección y del camino desde el que se escribió. Tampoco guarda ese camino (**[X] decidir VG** si lo guarda: sin él, la dirección de un registro anclado no dice su clase). La consolidación sigue diciendo en `encaje` de dónde vino cada elección con fuente; sus terminales nuevos van aparte, en `nuevos`, con su destino. Qué clase tienen las elecciones de una consolidación, la autorización y la ejecución está sin decidir (**[X] decidir VG**). Detalle en `docs/MOTOR.md` §7.

### Topes duros de emisión por modo

Pointed 10, Sequenced 100, Mapped 1000, Scened 10000 posiciones emitidas de una vez; lo heredado por referencia no se emite y no cuenta (mapa §12: «se emiten solo las décuplas modificadas»). Scened tiene tope de emisión y una composición con render sobrio (`src/scened.js`, `docs/MODOS.md`), sin formulario de escritura; lo que su escena lee no tiene tope duro: es capacidad (10000 posiciones por defecto, ajustable; **[X] decidir VG**, ver arriba). La proporción también rechaza, y cuenta todas las posiciones del registro, lo heredado incluido, como antes; se mira primero, así que mientras rechace el tope solo decide en Scened. Al ubicar **una celda** (`ubicar` con el modo, y `escribirDesde` con una celda) se tienen en cuenta los dos límites: si dentro del registro, con su relleno, no cabe, se ancla sola. `desdeMapped`, que conforma **varias celdas** a la vez, las ubica solo por la base, y `escribirSalida` mide la salida entera y la rechaza si no cabe. **[X] decidir VG**: si la proporción, que el mapa mantiene («además de la proporción»), rechaza o informa (hoy rechaza, como antes; ver arriba); si `desdeMapped` también ancla por límites, y qué celdas; si el relleno heredado se cobra en T (hoy sí, como antes: un minuto por posición del registro).
