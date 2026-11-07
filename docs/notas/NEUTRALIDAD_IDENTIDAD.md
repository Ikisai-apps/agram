# Neutralidad ante agrupación, división e identidades falsas

Nota de estudio · 7-11-2026 (noche) · Base: `main` en fef5438 · Prueba: `test/neutralidad.test.js` · No cambia el núcleo ni decide nada: lo que no está decidido va marcado **[X] decidir VG**. Actualización (7-11 noche): VG decidió R2 y está implementada (§4, §7).

Rutas abreviadas: `MAPA` = el mapa global de AGRAM (`MUELA/equipo/agram/MAPA_GLOBAL_AGRAM.md`, fuera del repositorio), §12 y §14; `AUDITORIA` = `90_FUENTES_CONSULTA/STATE_Auditoria_PV1_PV4_Recuperacion_Historica_2026-10-20.md` del corpus V2 (§4–§7); `EPRT` = `02_CONTEXTO/05_PROTOCOLOS_EPRT_Y_VERIFICACION.md` del mismo corpus.

## 1. El principio (VG, 7-11 noche, textual)

> «En el mundo actual da igual si una persona contabiliza su dinero, contabiliza el dinero de muchos o se agrupa para ser contabilizada como si fuese una única persona: un padre de familia que maneja todo el dinero de sus hijos no tiene más dinero por eso. Las personas no tienen beneficios reales ni por agruparse ni por dividirse, ni creando falsas identidades. Eso es crítico que funcione de esta manera en nuestro sistema: no se promueve que se creen identidades falsas, ni que se agrupen y dejen de tener identidad propia, porque eso les beneficiaría en la emisión de tokens y validación de los mismos. Emitir desde dos fuentes es igual de válido que emitir el doble desde una única fuente. No da más.»

Y la aclaración posterior sobre T (VG, 7-11 noche, `MAPA` §12 [D]):

> «T es el punto de partida, pero es el recurso que por sí mismo no vale nada. Ese es el sitio donde múltiples identidades pueden multiplicarte, pero es irrelevante, porque T sirve de manera interna: es tu medidor anti-spam tuyo propio. […] Falsear T no aporta nada: a quien valora con R le da igual si tardaste 10 horas o 100 días o usaste 100 identidades; valora el producto del trabajo, no el tiempo.»

Así que el estudio no trata como problema que T se multiplique con identidades. Mira E, P y R, que es donde está el valor para otros, y todo lo que el sistema concede **por cabeza** y afecta a terceros: elegibilidad, ranking, cohortes, autorizaciones y aceptación.

La propiedad que se busca, en una línea: **dividir una identidad en varias, o fundir varias en una, no cambia lo que obtienen de los demás.**

## 2. Qué concede hoy el sistema por identidad o por grupo

Fusión de las concesiones que encontraron los agentes del estudio. «Prueba» es el caso de `test/neutralidad.test.js` que lo reproduce (en `skip` mientras siga así).

| # | Qué se concede por cabeza | Dónde | Gravedad | Prueba |
|---|---|---|---|---|
| C1 | Alta libre: quien da tokens a un nombre nuevo declara su tipo y su clave, sin prueba de posesión ni de que haya otra persona | `eje.validar` (`contexto.tipos`, `contexto.claves`) | crítica (raíz de las demás) | — |
| C2 | Autorizar por nombre y por umbral: basta P > 0 y no ser el autor; 1e-9 de P autoriza igual que 1000; autorizar no bloquea P; basta una | `motor.puedeAutorizar`, `autorizacionesValidas` | crítica | NEU-01, NEU-02 |
| C3 | Una identidad sin clave no se autentica: cualquiera escribe en su nombre, mueve sus tokens o autoriza por ella | `eje.validar` (`exigirFirmas = false`) | crítica | NEU-08 |
| C4 | E y R se emiten sin tope ni lazo con el recurso: dos fuentes respaldan 8 plazas de una casa de 4. **Cerrada para E** con R2 (VG, 7-11 noche: la E atada al registro del recurso, con tope compartido; §4); R sigue sin tope (R6) | `eje.validar` (emisión; ahora `eje.reglasDelTope`) | alta | NEU-04 (pasa) |
| C5 | El grupo emite por su cuenta: una familia de 4 que se declara grupo tiene 5 fuentes | `tokens.EMITEN` | alta | NEU-03 |
| C6 | El ranking del 8 suma posiciones + 2·escritos + movimientos: partir un escrito en diez da diez veces más | `tiempo.comparar` (celda 8 de `app.js`) | alta | NEU-05 |
| C7 | Las medidas del 8 cuentan cabezas (identidades, movimientos, escritos) y sitúan por percentil en cohortes que fabrica quien se mide | `tiempo.medidasDe`, `bases.CORTES_PROVISIONALES`, `distribucion` | alta | NEU-06 |
| C8 | El límite de candidatos se aplica antes de la elegibilidad; cualquier ruido ajeno bloquea el `BUSCAR` del dueño | `bql.buscar`, `motor.proponer` | media | NEU-07 |
| C9 | La base del 8 no se recalcula: una cosa del propio autor puede certificar cajas falsas | `bases.leerSiEsBase` | media | — |
| C10 | Escribir transfiere T y no lo consume (TOK-02): el «ping-pong» deja escribir gratis | `evento.validarForma` | baja tras la aclaración de VG, salvo que el ruido llegue a terceros (C8) | TOK-02 (ya existe) |
| C11 | Escalonado de presencia: basta tener algo de R o de P; la «R propia en juego» puede ser autoemitida o cruzada entre identidades propias | `MAPA` §12 decisión 5 (sin código) | alta (diseño) | — |
| C12 | P ampliable por quien ya tiene algo, ámbitos nuevos con P a voluntad; delegar podría copiar en vez de repartir | `MAPA` §12, corpus PV2 (sin código) | alta (diseño) | — |
| C13 | Valorar R contando emisores distintos; cobertura que acepta respaldo circular entre identidades | `MAPA` §12, `AUDITORIA` §6–§7 | alta (diseño) | — |
| C14 | Elegibilidad abierta si nombrar un grupo en el 3 vale para todos sus miembros | `MAPA` §14 (abierto) | media | — |
| C15 | T por persona con tope del reloj **si** T se cambia por E o R de otros | `MAPA` §12 decisión 5 | irrelevante mientras T no se cobre ni respalde ante terceros | — |
| C16 | Costes fijos por acto (`ejecutar` 3 minutos, base 1 minuto): agrupar abarata | `motor.ejecutar`, `bases.COSTE_BASE` | baja (es T) | — |

Lo que hoy **ya es neutral** (y la prueba lo comprueba con casos generados):

- Los saldos se suman por identidad y no hay nada per cápita: que un padre lleve el dinero de sus hijos no crea tokens, y repartirlo tampoco.
- T y P se conservan (solo los emite el génesis); delegar P reparte la suma (`eje.#planDebitoP`), no la copia.
- R no es fungible: el tenedor no la junta ni la pasa. E y R son series de su emisor: nadie amplía la serie de otro.
- El orden de los candidatos (`encaje.ordenarPorEncaje`) no mira al autor: más nombres no adelantan a nadie.
- El coste de escribir es lineal (1 minuto por posición), y la validez no da ninguna puntuación global que inflar.
- Del corpus: un mensaje no emite R y PV8 no emite P (`AUDITORIA` §5–§6). Cierran dos vías por las que el volumen de actividad se convertiría en valor.

## 3. Los cuatro diseños y lo que les pasó

Cuatro agentes propusieron diseños independientes; tres agentes atacaron cada uno. Los cuatro salieron **rotos** en los tres ataques, pero cada uno dejó piezas que aguantaron.

| Diseño | Idea central | Lo que aguantó | Por dónde se rompió |
|---|---|---|---|
| 1. Libro consolidable | Todo lo que ve un tercero es una suma lineal de cantidades por serie; T fuera | Tope de E compartido por recurso; solo el autor amplía P; autorizar por fracción de P bloqueado; grupo = registro; el 8 por sumas y cuotas | P bloqueado reciclado entre identidades; series de E por emisor que no se suman (el redondeo premia agruparse); P de ámbitos distintos sumado; lente por nombres; ranking por identidad; «ámbito más concreto» fabricable |
| 2. Valor solo por aceptación | Cada lector reparte una unidad de masa por aristas de R firmadas; nada se crea dentro de un anillo de identidades falsas | La masa se conserva; la firma obligatoria; el peso de autorizar como suma de P | El autor acuña P sobre su propia consolidación; con polvo de P se agota el E de otro; la R del emisor se diluye (revoca avales); se ordena por la masa del autor, que no se gasta; corte fijo de profundidad |
| 3. Identidad sin renta | El tipo no concede nada; todo valor viene del respaldo, por emisor y por peso | Autorizar por peso; prueba de posesión de la clave; grupos sin reloj; elegibles antes del límite | La R recibida sin pedirla entra en lo que valora el lector; el 8 sigue contando escritos; obligaciones en una identidad desechable; tope de E por denominación; percentiles por recuento |
| 4. Por emisor y cantidad, fiel a V10 | Bloquear P para autorizar (LOCK/RELEASE del corpus); E atada al registro; valorar es cosa del lector | Peso 0 por defecto para emisores que el lector no nombra; delegar reparte; conservación de P | «No ser el autor» premia la segunda identidad; registro propio dentro de un árbol ajeno; R sin tope valorada por unidad; elegibilidad por saldo ≥ u; reservas que cuentan registros y no plazas; bloqueos sin caducidad |

Agrupados, los ataques y si la recomendación (§4) los cierra:

| Ataque | Lo cierra |
|---|---|
| Segunda identidad para autorizarse a uno mismo | R5 |
| Polvo de P (1e-9) que autoriza, emite E o da elegibilidad | R5, R2, R8 |
| Acuñar P: quien tiene algo lo amplía; el autor de una consolidación o de un subregistro se da P | R3 + R5 |
| Sumar P de ámbitos distintos (padre, génesis) contra un umbral absoluto | R5 (solo cuenta P del registro del recurso); P:genesis [X] |
| Reciclar el P bloqueado entre identidades para emitir más E | R2 (el bloqueo queda atado al E vivo) |
| Series de E por emisor + redondeo: agruparse da plazas enteras | R2 (fracciones o emisión conjunta) |
| Esquivar el tope de E por denominación, por profundidad o partiendo la casa en registros | R2 (tope jerárquico en la unidad del registro) |
| Ranking por identidad: copar el top-10 dividiéndose, subir puestos fundiéndose | R7 (se ordenan registros por masa; lo visible, por cuota) |
| Cohortes: hermanos vacíos, medias por n, cajas escalón, flujos lavados | R7 |
| Entrar en la lente de otro regalándole R; avalistas falsos; cobertura circular | R6 |
| El emisor diluye su R y revoca avales ya dados | R6 (ampliar R no diluye a quien ya la tiene) |
| Elegibilidad por P > 0 o por grupo en el 3; ruido que bloquea BUSCAR o tapa las vistas | R8 |
| El autor de un grupo se emite más P y diluye a los miembros | R3 |
| Bloqueos que no caducan o se reutilizan | R5 |
| T transferible y anónimo usado para pagar a terceros | R1 + [X] |
| **Identidad desechable**: dejar las obligaciones en un nombre y llevarse los activos a otro (responsabilidad limitada) | **sin parche completo**; mitiga R6 (colateral bloqueado y emisor nuevo con peso 0) |
| **Recurso físico duplicado** en dos registros que no se conocen | **sin parche** (es un problema de oráculo); mitiga R6 |
| **Recién llegados** con peso 0 que compiten por llegada con identidades falsas; criterios «uno por persona» | **sin parche neutral**: [X] si se prohíben los criterios per cápita |

## 4. Recomendación

Una sola regla madre, que sale de los cuatro diseños y de los doce ataques: **lo que el sistema concede o enseña a un tercero solo puede depender de cantidades de E, P y R (bloqueadas, emitidas o sumadas por serie) y nunca de cuántas identidades, emisores, registros o escritos las llevan.** Toda función que lo cumpla es lineal: partir una cantidad en diez nombres da lo mismo que tenerla en uno. Los umbrales «> 0», los recuentos de cabezas, los percentiles por recuento, los cortes por puesto y el orden por llegada como premio la rompen.

Diez reglas concretas, cada una con la función donde iría. Ninguna está implementada; todas dependen de **[X] decidir VG** (§6).

1. **R1 · T se queda en casa.** Escribir consume T: `evento.validarForma` exige un movimiento T con `de` = autor y `a` = null (cierra TOK-02 y el «ping-pong»). T nunca respalda nada ante terceros ni entra en R2, R5, R6, R7 o R8. Con eso, «T por persona con tope del reloj» deja de ser problema (§5).
2. **R2 · E atada al recurso, con tope compartido.** La serie lleva el registro: `E:<emisor>/<d>@<registro>` (`tokens.SERIE`, `claveToken`, `partirClave`). En `eje.validar`, el E vivo (emitido menos consumido o caducado) de un registro y de sus descendientes no pasa de la capacidad del ancestro que la declara, en la unidad del registro y sumando todas las denominaciones y todos los emisores. Cada emisor solo emite en proporción al P:X que bloquea, y ese bloqueo no se libera mientras viva el E que respalda. Fracciones de E, o emisión conjunta con varias firmas, para que separarse no pierda plazas por redondeo. **Implementada** (VG, 7-11 noche: «Me parece bien todo»; `eje.reglasDelTope`, `docs/FUNDAMENTOS.md` «E atada al recurso, con tope compartido»): el registro es el campo `registro` de la serie, tras la última `@` de la clave, y sin él la serie queda atada al registro del emisor; la capacidad es un entero en la posición 2 del payload raíz de un registro; el tope se comprueba en **cada** registro del hilo que la declara, así que un subregistro no lo esquiva; la cuota es ⌊P bloqueado con la salida = la serie ÷ P:X emitido × capacidad⌋, con `P:genesis` donde X no tiene P propio; E va en enteros salvo en series `divisible`, y la emisión conjunta (`emisores`) suma el P bloqueado de cada coemisor (su firma es su bloqueo, **[X]**). Pruebas: NEU-04 (ya sin `skip`), dos propiedades nuevas en `test/neutralidad.test.js` y `test/e-atada.test.js`.
3. **R3 · P:X es una serie cerrada.** Solo la emite el autor de X en el alta de X (o el génesis sobre `genesis`); ampliarla es una consolidación más sobre X, autorizada por R5. Quien recibe P solo lo delega (repartiendo, como ya hace `eje.#planDebitoP`) o lo bloquea. Va en `eje.validar` (o en la regla del ciclo E/P/R/T que encarga la decisión 5).
4. **R4 · El grupo es un registro.** `tokens.EMITEN = ['persona']` y `erroresGenesis` sin génesis de grupo (ya decidido en la decisión 5). Lo que se emite «a nombre del grupo» es una consolidación sobre su registro autorizada por peso de P:G (R5), con el firmante a la vista y obligación solidaria del firmante.
5. **R5 · Autorizar es bloquear P, y pesa por cantidad.** `motor.autorizar` escribe un bloqueo de P:X con salida = la consolidación. `motor.estadoDe` da AUTORIZADO si el P:X bloqueado (de cualquiera, el autor incluido) llega al umbral, medido como fracción del P:X emitido. X es el registro del recurso: el foco del dueño, nunca la consolidación ni un subregistro de su autor. El P de un ancestro solo cuenta si se delega estrechado a X. Se quita «no ser el autor» de `motor.puedeAutorizar`. Ejecutar exige que el bloqueo siga vivo y lo libera; el bloqueo caduca y quien bloqueó puede retirarlo antes de ejecutar.
6. **R6 · R se valora por participación y solo ante quien la lee.** Ninguna función suma R ni E de emisores distintos ni cuenta emisores. Una vista por lector (por ejemplo, `src/lente.js`) da a cada emisor el peso que el lector le ha dado con un acto firmado: recibir R nunca mete al emisor en la lente, y un emisor nuevo pesa 0. Valor = peso × saldo ÷ emitido; ampliar R:X no diluye a quien ya la tiene (se reparte a prorrata). Emitir R exige colateral bloqueado que se libera al atender (`eje.obligaciones`); qué pasa si no se atiende es [X]. La cobertura (V10) solo cuenta respaldo de emisores de la lente, neto de ciclos.
7. **R7 · El 8 solo funde cantidades.** En `tiempo.medidasDe` y `bases.medir`, identidades, escritos, movimientos, posiciones y medias por n quedan como informativas, marcadas «recuento», fuera de `CORTES_PROVISIONALES.RECUENTOS`, de `distribucion` y de los criterios que deciden. El foco se sitúa por cuota (su suma ÷ la del padre, del proyecto o del génesis), que no cambia al añadir hermanos vacíos ni al partir uno en diez. Se retira `tiempo.comparar` (decisión 7). PV8 ordena registros por masa, no identidades, y lo visible se reparte por cuota. `bases.leerSiEsBase` recalcula con `bases.comprobar` y descarta la base que no cuadra.
8. **R8 · Elegibilidad antes que límites.** `bql.buscar`, las vistas con tope y `motor.proponer` ponen primero a los elegibles según la lista explícita del dueño (su posición 2; por defecto, el autor y quien aparece en su posición 3), con un índice al escribir. El límite de candidatos y los topes de los modos se aplican después; el resto se resume en un recuento que no puntúa. Un grupo nombrado cuenta como un ocupante. Lo que reparte cupo bloquea una cantidad por candidatura; `CONTAR(BUSCAR(…))` en un criterio que concede da aviso.
9. **R9 · Sin clave no se actúa.** `eje.validar` rechaza mover tokens, autorizar o escribir bases a una identidad sin clave registrada (salvo un eje marcado como demostración). El alta de una persona trae la firma de su clave nueva (prueba de posesión), y `validez.js` pasa de «posesión: sin probar» a «probada» o «falla».
10. **R10 · El tipo no da renta.** El tipo (persona, grupo, cosa) se autodeclara en el alta, como hoy, y solo dice quién firma emisiones. Ningún módulo fuera de `eje.validar` lee `eje.tipo()` (se comprueba con una prueba estática). Con R2, R5, R6 y R7, declarar 20 «personas» falsas da 20 emisores que no valen nada para quien no los nombra y ni una plaza de más.

Lo que queda sin resolver, y conviene decirlo claro: ninguna regla impide que una persona abandone una identidad con deudas y siga con otra limpia, ni que registre dos veces la misma casa. Las dos se mitigan con colateral bloqueado y con lentes que pesan 0 a lo desconocido, como pasa hoy con las sociedades pantalla y los anuncios duplicados.

## 5. Qué cambia de las decisiones vigentes

| Decisión | Hoy | Con la recomendación |
|---|---|---|
| Decisión 5: «cada persona emite su propio T con tope del reloj» (PROVISIONAL [X]) | En duda porque una identidad falsa lo multiplica | **Se puede confirmar**: con R1, T no sale de su dueño como valor y multiplicarlo solo multiplica el propio anti-spam |
| Decisión 5: «la serie T:<escala> constante para que T de distintas personas se cambie»; «R ahorra T al cambiar E por el T de otras personas» | T fungible y transferible entre personas | Choca con «T no vale nada por sí mismo» y con `EPRT` («T: no fungibilidad automática»): propuesta, T no se transfiere entre personas, o viaja con su emisor. [X] |
| Decisión 5: escalonado T→R→P→E | Puertas de presencia | Se mantiene como orden del ciclo, no como defensa; «R propia en juego» = R:<yo> bloqueada como colateral |
| Decisión 5: E «serie limitada del emisor» | Sin lazo con el recurso | Serie ligada al registro del recurso, con tope compartido (R2). Decidido por VG (7-11 noche) e implementado |
| `MAPA` §14 [D]: «ejecutar exige autorización de quien tiene poder y no es el autor» | Por nombre y P > 0 | Por P bloqueado contra un umbral; el P del autor cuenta igual (R5). Solo puede cambiarlo VG |
| `MAPA` §14 [D]: elegibilidad por el criterio del dueño | Decidida, sin implementar (TK-01) | Igual, precisada: antes del límite, y un grupo nombrado es un ocupante (R8) |
| Decisión 7: se retira `comparar()`; PV8 = ranking | Retirada pendiente en el código | Sin cambio; se precisa qué ordena PV8: registros por masa, no identidades (R7) |
| Decisión 8: quién declara el tipo | Abierta | Autodeclaración en el alta con prueba de posesión de la clave; el tipo deja de tener peso económico (R9, R10) |
| `docs/FUNDAMENTOS.md`, «Quién emite: personas y grupos» | Así en el código | Solo personas, como ya dice la decisión 5 (R4) |

## 6. Para decidir VG (en este orden)

1. **La regla madre.** ¿Lo que se concede a terceros depende solo de cantidades de E, P y R, nunca de cuántas identidades, registros o escritos las llevan? De esta respuesta cuelgan todas las demás.
2. **Autorizar.** ¿Se cambia «tiene P y no es el autor» por «P bloqueado sobre el registro del recurso ≥ umbral», con el P del autor contando igual? ¿Umbral por defecto (propuesta: más de la mitad del P:X emitido)? ¿Cuenta el P:genesis?
3. **P.** ¿P:X lo emite una sola vez el autor de X, y ampliarlo es una consolidación autorizada?
4. **E.** Decidido (VG, 7-11 noche: «Me parece bien todo») e implementado: E atada al registro del recurso, tope de E vivo compartido entre emisores, cuota por P bloqueado, emisión conjunta y fracciones solo en series divisibles; un E sin capacidad declarada (EUR) va atado al registro del emisor, sin tope (deuda del emisor). Queda abierto, entre otros, el tope por noche (`docs/FUNDAMENTOS.md`, «E atada al recurso, con tope compartido»).
5. **R.** ¿R valorada por participación y solo con la lente firmada del lector? ¿Colateral para emitir R y qué pasa si no se atiende (slashing, abierto en el corpus)?
6. **T.** ¿Se confirma T por persona con tope del reloj, sin salir como valor y consumiéndose al escribir? ¿T se transfiere entre personas? ¿Qué escala de T corresponde a qué tamaño de árbol emitido (¿segundo → Pointed 10, minuto → Sequenced 100, hora → Mapped 1000, día → Scened 10000?)?
7. **El 8 y PV8.** ¿Solo sumas y cuotas en lo que se compara, con los recuentos como información? ¿PV8 ordena registros por masa?
8. **Elegibilidad.** ¿Nombrar un grupo en el 3 cuenta como un solo ocupante? ¿Se prohíben los criterios «uno por persona», que no tienen versión neutral?
9. **Tipo y firma.** ¿Autodeclaración con prueba de posesión de la clave (decisión 8)? ¿Firma obligatoria fuera de un modo demostración?
10. **Lo que no tiene parche.** ¿Se acepta que identidades desechables y recursos duplicados solo se mitiguen (colateral, lentes), como en el mundo actual?

## 7. La prueba

`test/neutralidad.test.js` construye ejes pequeños con la API de hoy y compara el mismo guion con una identidad, repartido entre varias y fundido de nuevo en una.

- **Pasan hoy** (casos generados con semilla): lo que un tercero paga y lo que la coalición tiene no cambia al dividir ni al fundir; nadie junta R ajena ni amplía la serie de otro; delegar P reparte y no copia; el orden de los candidatos no depende del autor.
- **En `skip`** con su id y la concesión que lo causa, escritas como la propiedad para que al arreglar el código baste con quitar el `skip`: NEU-01 (autorizarse con una segunda identidad), NEU-02 (más autorizantes al repartir P), NEU-03 (el grupo emite), NEU-04 (8 plazas para 4 camas), NEU-05 (ranking por recuentos), NEU-06 (el 8 cuenta cabezas), NEU-07 (el ruido ajeno bloquea `BUSCAR`), NEU-08 (escribir en nombre de otro).
- **Ya sin `skip`** (actualización, 7-11 noche): NEU-04, con R2 implementada. Se reescribió con la forma nueva (la serie atada al registro H de la casa, que declara capacidad 4, y el P:H repartido entre las fuentes): con una, dos o cuatro fuentes el total respaldado es el mismo y no pasa de 4. Y dos propiedades nuevas: repartir la capacidad entre k emisores con el mismo P total no cambia el E vivo máximo (con la emisión conjunta), y partir el recurso en subregistros, aunque declaren más capacidad, no esquiva el tope del ancestro.

Se comprobó que cada `skip` falla hoy por el motivo que dice: NEU-01 da AUTORIZADO frente a PENDIENTE; NEU-02, 5 autorizantes frente a 1; NEU-04, 8 plazas frente a 4; NEU-05, 22 puntos frente a 4; NEU-06, 9 identidades frente a 2; NEU-07, PENDIENTE POR LÍMITE frente a RESUELTO; NEU-03 y NEU-08 se aceptan cuando deberían rechazarse.
