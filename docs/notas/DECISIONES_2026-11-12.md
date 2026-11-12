# Lo decidido con VG el 11 y el 12 de noviembre de 2026

**Estado:** nota de registro, escrita el 12-11 sobre `beta` (`3cfe6ef`). Lleva al repositorio lo que hasta ahora vivía en el catálogo de issues de Core (filas 29 a 50, más los flecos de la 12 y la 23), en el diseño `DISENO_8-7_POR_MODO` (tercera versión, §7 incluido) y en el estudio `ESTUDIO_BQL_TRANSACCIONES` (§6), para que los agentes lean del repositorio y no del chat. No añade nada a lo que dicen esas fuentes. **Solo documentación:** ningún dato de la época ni ningún código cambia con esta nota; cada «qué cambia» es el encargo que sigue, y puede estar ya en una rama de la beta o no.

**Cómo leerla.** Las notas llevan el número del catálogo (`#31`, `#35`…), no uno nuevo. Marcas, como en el resto del repositorio:

- **DECIDIDO VG**: lo dijo VG; cuando el catálogo lo cita, va entre comillas.
- **Propuesta Core** / **hipótesis**: lo propuso Core y VG no lo ha cerrado (o lo cerró con un cambio, y entonces se dice).
- **Abierta**: sin decidir; se apunta para que nadie la dé por hecha.

Cada nota tiene cuatro líneas: *Qué se decidió*, *Por qué* (lo que dice la fuente; si no dice nada, «la fuente no lo dice»), *Qué cambia* (núcleo, datos de la época, carta) y *Pruebas* (las que la fuente nombra; si no nombra ninguna, «la fuente no las nombra: deben cubrir…», y solo lo que la propia decisión exige). Para lo que ya existe, véanse `docs/CONTRATO.md`, `docs/MOTOR.md`, `docs/BQLM.md`, `docs/REGLAS_CORTAS.md` y `docs/FUNDAMENTOS.md`; aquí no se repite.

## Índice por temas

| Tema | Notas |
|---|---|
| 1. Lecturas y profundidad | #12 (diseño 8.7, §7), #44, #45, #47, #52 (formas por modo) |
| 2. El 3: admisión, grupos, mínimos y personaje | #29, #31, #32, #33, #34 (sustituida), #35, #37, #38, #46 |
| 3. El 4, la escalera y el rango | #39, #40, #41, y las decisiones 7 y 8 del estudio (en #49) |
| 4. BQL con transacciones | #43, #48, #49 (decisiones 1 a 10), #50, #67 |
| 5. Tiempo e incongruencia | #42, #64 b, #65, decisión 4 de #49 (los tres relojes, `X.6.8`) |
| 6. Pantalla | #23 |

Al final: «Lo que queda abierto» y «Lo que las fuentes no dicen o dicen distinto».

---

## 1. Lecturas y profundidad

### #12 — Crecer desde abajo: matrices por PV y profundidad de diez dígitos (diseño cerrado en §7; ejecución en curso)

Fuente: catálogo #12 y `DISENO_8-7_POR_MODO` (tercera versión). Estado de la fila: en curso (rama `beta-bqllee`, «lecturas que caen a BQL»).

- **Qué se decidió.** Dos cosas distintas que coexisten; VG: «una cosa es la profundidad y otra las matrices de cada punto de vista; coexisten; no te cargues una para implementar la otra».
  - *Las matrices por PV* (decidido; se queda, escrito en la fila 8.7): PV1 enciende 1 2 3 4, profundidad 4, cruceta; PV2 enciende 1 a 5, profundidad 5, escalera y luego columnas; PV3 enciende 1 a 6, profundidad 6, rejilla 3 × 2 y luego conversación; PV4, los diez × los diez, profundidad 1, matriz PV × posición con estaciones; PV6 y PV7, las escalas, profundidad 1, franjas con cuatro hilos; PV8, las diez cajas, profundidad 1, cielo; PV9, posiciones y pasos, profundidad 1, camino; PV0 y PV5, profundidad 0, lente y json.
  - *La profundidad de diez dígitos*: cada celda de cualquier matriz es un nodo con sus diez posiciones; bajar un nivel es añadir un dígito (1, 1.1, 1.1.1, 1.1.1.1). El significado de cada dígito lo da la regla corta (`epoch.5`): el PV d aplicado al nodo de arriba. VG: el PV de la **primera profundidad** define **cómo se ve** todo lo de debajo (matriz, forma, hijos, hasta su profundidad); los dígitos siguientes definen **la información**. Se hereda del PV superior hacia abajo, nunca del último dígito hacia arriba.
  - *Mundos anidados* (VG, 11-11 noche, cerrado, §7): el 1 es el elemento con cuatro miradas a cuatro niveles (4⁴). El 2 son los criterios sobre ese elemento: la misma matriz más la quinta dimensión, «dónde encaja» (5⁵); dentro del 2 no se enseña la matriz del 1 porque ya está contenida. El 3 son los comentarios sobre los criterios del elemento: una dimensión más, «de dónde viene» (6⁶), sin enseñar las del 1 ni el 2. Por eso lo escrito en uno se ve en los otros. El 4 es **transversal**: no añade dimensión, cruza todas (PV × posición, 10 × 10).
  - *Las lecturas, por punto de vista* (§7, decidido): una regla larga por PV en `epoch.2` (qué lee ese PV aplicado a un nodo), encadenadas por los dígitos según las reglas cortas (`epoch.5`); una fórmula por celda en la fila 8.7 solo como excepción que gana. La anidación sale sola: la lectura del 3 se aplica sobre la del 2, que se aplica sobre la del 1.
  - *Contenido derivado de una celda* (§3 del diseño): además de lo anclado en su dirección, una celda muestra lo que las lecturas derivan del libro: las identidades con las que se movió R o T en el 1.3, las laborales (con T) en el 1.3.4, los trabajos (T movida sobre lo mío) en el 1.4, el grupo equipo (R dada al precio de equipo) en el 3.4. Lo anclado sigue siendo el caso por defecto.
- **Por qué.** Para no perder las matrices aprobadas en el mockup al implementar la profundidad, y para que lo escrito en un PV se vea en los otros (es la misma cosa con más o menos dimensiones).
- **Qué cambia.**
  - Núcleo: `contrato.leer`/`leerRuta` devuelven `{anclado, derivado (con por), lista}` (rama `beta-lecturas`, commit `e6dd6b0`); diez reglas largas en `epoch.2` (`what-it-is … how`, tipo «point of view»); en BQL caen el 2, 3, 4, 5, 6 (`path`) y 8; siguen envueltas en JS el 0 (representaciones), el 1 (flujo), el 7 (futuro) y el 9 (camino). Lo que cae a continuación se trata en #43.
  - Carta: baja 1 → 1.1 → 1.1.1 → 1.1.1.1 (botón ↘ por celda, cabecera con la dirección) y crear en un hueco escribe la dirección completa. El diseño pide comprobar que baja hasta la profundidad de cada matriz leyendo bien la dirección completa (hoy solo lee bien los dos primeros dígitos).
  - Datos, **propuesta Core sin respuesta registrada**: que la fila 8.7 lleve las formas de los tres modos (Pointed, Sequenced, Mapped) con herencia hacia abajo cuando un modo no declare la suya (una posición con tres hojas, con migración de datos y pruebas). Hoy la fila 8.7 es la de Mapped; Sequenced apila las mismas matrices en una columna (acordeón) y Pointed es la fila del elemento.
  - **Propuesta Core de orden** (diseño §5): 1) comprobar y arreglar la profundidad completa; 2) lecturas derivadas en las celdas, empezando por 1.3, 1.3.4, 1.4 y 3.4 con Core, como dato; 3) formas por modo en la fila 8.7; 4) PV a PV en los tres modos, empezando por el 0, el 1 y el 3. Siguiente encargo (§7): los diez operadores como reglas largas, empezando por 1, 2 y 3 anidados, con Core como caso real.
- **Pruebas.** Las de la fuente: casos de Core verdes (1.3, 1.3.4, 1.4, 3.4; anidación 2.3) en las lecturas; la carta baja los cuatro niveles del 1 con la dirección completa. Para la fila 8.7 por modo, el diseño pide migración de datos con pruebas y no las detalla.
- Los flecos de #12 que VG cerró el 12-11 están en #44, #45 y #47, y el del 3.4 («cercanos» o «equipo») en #33.

### #52 — Las formas van por modo en la fila 8.7, con herencia hacia abajo; los modos son cinco (DECIDIDO VG 12-11; hecho en la beta)

Fuente: catálogo #52 y `DISENO_8-7_POR_MODO` (§4, la propuesta que VG ha decidido). Esta nota es la excepción a «solo documentación»: lleva dato y código.

- **Qué se decidió.** Las formas de la fila 8.7 van **por modo**, con **herencia hacia abajo**, y los modos son **cinco**: Pointed (10⁰), Sequenced (10¹), Mapped (10², más el clic), Scened (10³) y Be. La posición 3 de cada fila (una por PV) pasa a ser una **lista, no una décupla**, con una hoja por modo en el orden de los modos de la época (`epoch.8.2`); donde la hoja es «-» el modo **hereda del anterior** (Sequenced de Pointed, Mapped de Sequenced, Scened de Mapped, Be de Scened). Cada hoja lleva la forma de cada nivel separadas por «>» (`escalera > columnas`; la última se repite). El PV de la primera profundidad sigue definiendo cómo se ve a cualquier profundidad (no cambia), y no se tocan hijos, profundidad, enlace, estilo, hilos ni orden.
- **Por qué.** Un mismo mundo no se ve igual en cada modo: Pointed enseña la fila del elemento, Sequenced apila en una columna (acordeón), Mapped lo despliega en 2D con su clic, y lo que hoy decide el código de la carta (apilar o no) debe ser un dato de la época que se pueda cambiar modo a modo sin repetir lo que no cambia; la herencia hacia abajo evita escribir cinco veces lo mismo. Y los modos son cinco porque Scened (varios focos en escena) y Be (sin interfaz gráfica) ya son modos de la época: la fila no puede dejarlos fuera.
- **Qué cambia.**
  - Datos: `epoch.8.7`, posición 3 de cada fila, migrada: **Mapped lleva lo de hoy**; **Sequenced lleva lo mismo** (la carta ya enseña en él la misma forma, apilada en una columna cuando no cabe a lo ancho; ese apilado sigue siendo código y píxeles de pantalla, no una forma); **Pointed «-»** (la fila del elemento no es una forma de la división, así que no hay nada que migrar; queda para cuando VG la defina); **Scened y Be «-»**, heredan de Mapped. Una nota nueva al final de `epoch.8.7`.
  - Núcleo: `contrato.formaDe(eje, pv, modo, { nivel })` resuelve la herencia → `{ forma, formas, de }`; `divisionDelMundo` acepta `modo` (por defecto `mapped`, la fila de siempre) y devuelve `modo`.
  - Carta: la fila abierta de Sequenced pide su forma como `sequenced` (`rejillaDe(…, { modo })`); lo demás, Mapped. Se ve igual que antes (`test/carta-esperada.json` no cambia).
- **Pruebas.** `test/contrato.test.js` (herencia por modo, cinco modos, «-», lista más corta, modo desconocido, una época con otras hojas) y `test/modos.test.js` (los cinco modos de `epoch.8.2` y de `src/modos.js`, en el mismo orden); `npm run test:carta`, `epoca-btml`, `traducciones` y `docs/comprobar.mjs` verdes.
- **Queda abierto.** Qué es la forma propia de Pointed y de Sequenced (hoy Sequenced repite la de Mapped y Pointed no tiene) y cuándo Scened y Be tienen la suya: PV a PV, empezando por el 0, el 1 y el 3 (diseño §5, paso 4). Pendiente de VG.

### #44 — Flecos de #12 (DECIDIDO VG 12-11)

- **Qué se decidió.** (1) «Lo suyo» = el dueño del nodo raíz (el registro donde estás): sí. (2) El 1 **sí** cuenta lo que el dueño se mueve a sí mismo: acuñar es crear (un sofá en E, lo mismo en P y R); la mayoría de los registros propios no tocan a nadie externo y tienen que verse. (3) **Sin tope en el núcleo** (quitar los 200 por dígito): el límite es de pantalla, que pagina; los contadores deben ser exactos.
- **Por qué.** Lo que el dueño se mueve a sí mismo es creación y debe verse; el límite es cosa de la pantalla.
- **Qué cambia.** Corregir la lectura `how-much`/flujo del 1 (hoy no cuenta lo que el dueño se mueve a sí mismo); quitar el tope de 200 del núcleo; paginar en la carta. Rama `beta-bqllee`: «ajuste en contrato/reglas + pruebas».
- **Pruebas.** La fuente solo dice «+ pruebas». Deben cubrir: un registro propio que solo acuña aparece en el 1; ningún dígito recorta a 200 y los contadores dan el recuento exacto.

### #45 — El 6 lee las dos cosas, siempre (DECIDIDO VG 12-11)

- **Qué se decidió.** El 6 lee las **dos** cosas, siempre (celda y mundo): el **hilo** (de dónde cuelga exactamente, hacia arriba) y el **diario** (todo lo pasado que le ha llegado, sobre él y lo que cuelga de él). El diario es más que el hilo pero no lo contiene. En las franjas: el hilo como la cadena de origen, lo llegado en los cuatro hilos 1 2 3 4 por lo que movió.
- **Por qué.** La fuente no lo dice más allá de la distinción hilo/diario.
- **Qué cambia.** Ajustar la regla `where-it-comes-from` (hoy solo `path`, es decir, el hilo) para que lea también el diario, y las franjas en la carta. Rama `beta-bqllee`. El estudio BQL (#43) propone cómo escribirlo («PV6, where it comes from»).
- **Pruebas.** La fuente no las nombra: deben cubrir que la lectura devuelve el hilo y el diario por separado y que el diario no es el hilo.

### #47 — El diario llega, no se busca (DECIDIDO VG 12-11; estado: abierta, principio)

- **Qué se decidió.** Lo que entra en mi diario entra porque hay un **intercambio de tokens a mi favor**; la transacción del token lleva el contenido o el puntero indexable (OP_RETURN en Bitcoin, mensaje en Lightning, igual en RGB); me entra por el 3 («te ha llegado esto», chat) y ahí atiendo o no. El índice inverso del servidor es solo transporte (con Nostr, el relé entrega). Bitcoin como índice de arranque: una dirección conocida con OP_RETURN con prefijo nuestro que apunta al índice de relés (burdo); Taproot/MAST (currado); **no ahora**.
- **Por qué.** Conecta con #43: si BQL lee transacciones, lee lo recibido.
- **Qué cambia.** Nada en el código hoy: es una guía para AARPIA y el transporte.
- **Pruebas.** Ninguna por ahora (la fuente no las nombra).

---

## 2. El 3: admisión, grupos, mínimos y personaje

Todas estas notas hablan del mismo sitio, el PV3 («para quién»). La **versión buena** del 3 es la de #35; #34 quedó sustituida por ella.

### #29 — «Admitir a alguien» es un intercambio de R (principio, VG 11-11 noche; lo concreto, en #31 a #33)

- **Qué se decidió.** «Admitir a alguien» tiene que ver con intercambios del token R (y de T, al ser trabajo): admitir = transacción de R entre el dueño y la identidad (grupos de atención), no un nombre escrito en el 2.3; aceptar un trabajo = dar o devolver R por él. Corrección de VG: Core es una **entidad** en el 1.3 (con quién), de tipo laboral = 1.3.4; en el 1.4 van los **trabajos** que hace; en el 3.4 por la R (equipo). Se ve ahí no por un ancla escrita sino porque **el intercambio lo coloca ahí**: un elemento se posiciona en todos los PV y cada PV lo lee por lo que mueve (R → 3, T → 4 y 1). La colocación sale de las lecturas, no de un `en` fijo.
  - **Principio general (VG):** ninguna identidad que escribe puede colocar su información sobre la de otra persona salvo que esa persona la acepte; como mucho, el dueño puede **preaceptar** el contenido de una identidad concreta. Las propuestas de Core no son distintas de las de nadie: es la base del trabajo en equipo.
- **Por qué.** Ver `docs/notas/CORE_IDENTIDAD.md` (la regla general de lo ajeno).
- **Qué cambia.** Ya en la beta (commit `075d57c`): plantilla «admitir a alguien» (PV3, orden 7), que da R mía (acuñando la que falte) y minutos de T (solo a cosas, regla «T only goes to things»); `be.mjs pendientes`. Por comprobar: si la preaceptación existe como dato de la época (criterio del dueño en PV2 o delegación de P); si no, definirla como **regla, no como código**.
- **Preguntas que el catálogo dejó a VG.** (1) elegibles por la R: aceptar un escrito suelto dándole R sobre él; ¿tener R del dueño admite en todo lo suyo o solo donde se dio? (la contesta #31: baja por el árbol); (2) preaceptación heredada subiendo por `sobre` (la regla de elegibles de #31 sube por `sobre` mientras el dueño sea el mismo); (3) dejar de admitir: devolver la R o vetar, zona 5 (la contesta #32); (4) colocar por lo que se mueve (1.3, 1.3.4, 1.4/4, equipo) como lecturas de la época: hoy ninguna sale (#33 solo cierra la celda del 3); (5) la carta no pinta pendiente/aceptado: exponer elegibilidad en el contrato (abierta). Defecto visto: la carta enseña a «cocina» con el 0 de «Altas del fin de semana».
- **Pruebas.** La fuente no nombra las de #29 más allá de las de la plantilla; las de #31 a #33, abajo.

### #31 — La admisión baja por el árbol (DECIDIDO VG 11-11, «Perfecto»)

- **Qué se decidió.** La admisión **baja por el árbol**, no es global: quien recibe R mía sobre un registro queda admitido en ese registro y en todo lo que cuelga de él (admitir en el proyecto vale para sus issues; admitir en el alta, para todo lo mío). La regla de elegibles sube por `sobre` mientras el dueño sea el mismo.
- **Por qué.** La fuente no lo dice más allá del ejemplo.
- **Qué cambia.** Encargo pequeño en elegibles (regla/dato). Rama `beta-pv3`.
- **Pruebas.** «+ prueba» (la fuente no la detalla): quien recibió R sobre un proyecto queda admitido en sus issues y no fuera de ese árbol.

### #32 — Dejar de admitir = quitar (DECIDIDO VG 11-11)

- **Qué se decidió.** Dejar de admitir = **quitar** a esa identidad (o dejar de aceptar su R) de la posición mía donde la admití: una corrección del dueño sobre esa posición; desde entonces la lectura del 3 no la coloca y elegibles no la admite en lo que cuelga. Devolver la R es la **liquidación** (puede venir después); **vetar** (grupo 5) es la emergencia y gana sobre cualquier R.
- **Por qué.** La fuente no lo dice.
- **Qué cambia.** Una acción del aro «quitar» (inversa de admitir) como plantilla; elegibles lee la corrección. Rama `beta-pv3`.
- **Pruebas.** La fuente no las nombra: deben cubrir que tras «quitar» el 3 no la coloca y elegibles no la admite en lo que cuelga, y que el veto gana sobre una R vigente.

### #33 — La celda del 3 la deciden los movimientos (DECIDIDO VG 11-11, «Exacto»)

- **Qué se decidió.** La celda del 3 en que cae una identidad la deciden **los movimientos**, no una etiqueta: R sola → cercanos (celda 4); R con T → equipo (celda 5). Los precios por grupo son lo que cobro por atender a cada uno, no una lista de nombres.
- **Por qué.** Hoy la lectura `with-whom` pone R+T en la celda 4 (el 3.4 cae en «cercanos»), cuando «equipo» es la celda 5.
- **Qué cambia.** Corregir la lectura `with-whom` (ajuste de la regla del 3). Rama `beta-pv3`.
- **Pruebas.** Prueba con Core en la celda 5 (la fuente la nombra); y R sola → celda 4.
- Ojo: #35 (12-11) renumera los grupos del 3 (0 a 5, más abajo) y corrige la escalera de tokens; #33 se lee junto con #35.

### #34 — Bandeja de entrada del 3 (estado «decidir VG»; **sustituida por #35**)

- **Qué se propuso.** Un espacio donde lleguen mensajes de quienes aún no tienen mi R. Hoy (`epoch.1.2.1`) «desconocidos» cobra MI R (imposible para un desconocido) y «cercanos» cobra SU R. **Propuesta Core:** cruzar los dos precios: desconocidos = su R (cualquiera acuña la suya y la pone en juego: es la bandeja, frena el spam, se puede atender, perdonar o quemar); cercanos = mi R devuelta (atención por atención). Aceptar un escrito suelto = darle R sobre el escrito (29.1a) **queda aprobado**.
- **Estado.** El catálogo dice que #35 «sustituye a #34». Lo que continúa es la regla única de #35: quien escribe pone su R; atender devuelve, perdonar quema.

### #35 — PV3, versión buena (VG 12-11, con corrección de la escalera)

- **Qué se decidió (el sitio).** El sitio en el 3 lo decide **de qué hablas** (regla corta: 3.d = «con quién» sobre d): mensaje anclado en un recurso mío → mi 3.1 (y E); en un criterio → 3.2 (y P); sobre personas → 3.3 (cercanos); sobre trabajo → 3.4 (y T); 3.0 = sin tema (base/ruido); 3.5 = lo que no encaja = vetados. **No hay «grupo» como dato:** los tokens son consecuencia. Arrastrar = reclasificar la conversación; arrastrar al 5 = vetar.
- **Corrección VG 12-11: la escalera de tokens** es T → +R → +P → +E (como el ciclo cerrado el 7-11): T = estar en el 4 (trabajo); T+R = 3.3 cercanos; T+R+P = 3.2 expertos (el criterio necesita gente y registros); T+R+P+E = 3.1 comercial (el recurso necesita criterios, un creador y registros). Lo acumulativo crece **del 4 hacia el 1**, no al revés.
- **Principio transversal.** El 4 no representa información, funciona distinto; el 6 y el 7 existen para apoyarlo y quitarle el ruido (el trabajo en el tiempo); el token usado marca por dónde va cada registro.
- **PV3 v2 (VG 12-11, la pantalla).** Grupos 0 a 5 como los PV: 0 ruido/base, 1 comercial (+E), 2 expertos (+P), 3 cercanos/favoritos (R), 4 equipo (+T), 5 vetados. Regla única en los dos sentidos: quien escribe pone su R, y el segundo token ya en el primer mensaje lo mete directo en su grupo; atender devuelve, perdonar quema. R = canal de estado por pareja, transferible entre tenedores (loops), cerrar = devolver. El dueño arrastra a cualquiera a cualquier grupo. En cada grupo: personas con marcador de cantidad; orden: primero los que tienen R mía, luego los que usan su R; un botón que cicla doy/recibo/todos. Dentro: 0 chat; 1 + recursos compartidos; 2 + paquetes de criterios; 3 favoritos; 4 equipo; acumulativos y filtrados por el elemento/criterio en foco.
- **Por qué.** La fuente da el principio (el 4 funciona distinto; los tokens son consecuencia del tema, no una etiqueta) y no más.
- **Qué cambia.** Lectura del 3 (por tema, no por grupo), pantalla del 3 (grupos 0 a 5, arrastrar, botón doy/recibo/todos) y la regla del precio. Rama `beta-pv3`. Queda un punto **abierto con VG**: «arrastrar vs. movimientos» (Core lo cierra con VG y luego hace el encargo).
- **Pruebas.** La fuente no las nombra: deben cubrir el sitio por tema (los cuatro casos, más el 0 y el 5), que la escalera acumula del 4 al 1 y que arrastrar al 5 veta.

### #37 — Mínimo y rango por caja del 3 (VG 12-11)

- **Qué se decidió.** «Rango» = nivel.grado. Por caja del 3 (y en 1 y 2 dentro del 3): **mínimo de cantidad** para que algo aparezca (luego decido si lo leo) y **filtro por rango**: por defecto mi propio rango sobre el foco; modos: solo ese rango · ampliar hacia arriba · ampliar hacia abajo; contador de los que quedan fuera. El precio por grupo de `epoch.1.2.1` **desaparece como está**; los mínimos son datos del propio nodo X.3.d (su 1 = cantidad mínima, su 8 = rango exigido).
- **Por qué.** La fuente no lo dice más allá del reparto de datos (los mínimos viven en el nodo).
- **Qué cambia.** Datos del nodo X.3.d y retirada del precio por grupo de `epoch.1.2.1`; filtro en la carta. Rama `beta-pv3` (filtro preparado; el rango sale de `beta-el4`, #39), con #35 y #38.
- **Pruebas.** La fuente no las nombra: deben cubrir el mínimo, los tres modos de rango y el contador de los excluidos.

### #38 — El personaje es la configuración del sitio (VG 12-11)

- **Qué se decidió.** Cada cuadrante (PV o sub-PV) tiene su responsable: el muñeco en animado, un icono de interrogante en el mismo sitio en sobrio; **hablar con él = configurar ese sitio**. Tiene los diez PV: es el propio nodo X.d visto con sus diez posiciones (1 mínimo, 8 rango, 9 guía, 5 estilo X.5.0, que ya existía sin dónde tocarse…); el interrogante abre la cruceta del nodo; doy/recibo/todos son lecturas de su 3/6/7. **La barra superior desaparece:** la configuración general es el personaje del 0 con el foco abierto. VG: «Lo que ya representábamos en BTML y no pintábamos».
- **Por qué.** El nodo ya llevaba esos datos y no había dónde tocarlos.
- **Qué cambia.** Carta: el personaje por sitio y quitar la barra superior; datos: nada nuevo (ya están en el nodo). Rama `beta-pv3` (en los sitios del 3), junto con #35 y #37 cuando VG cierre el 3.
- **Pruebas.** La fuente no las nombra: deben cubrir que en sobrio el interrogante está en el mismo sitio que el muñeco y abre la cruceta del nodo, y que la configuración general sale del personaje del 0.

### #46 — La T de una cosa no tiene defecto (DECIDIDO VG 12-11)

- **Qué se decidió.** La T de una cosa al darla de alta **no tiene defecto en la plantilla:** es un parámetro que decide el dueño (desplegable por escalas); reponer = otra transferencia de T del dueño a la cosa (o una regla de la época si un día se quiere automática). **Una cosa nunca tiene más T que la que una persona le dio.** Quitar los 60 minutos por defecto de «dar de alta una cosa».
- **Por qué.** Para que una cosa nunca tenga más T de la que una persona le dio.
- **Qué cambia.** Dato de la plantilla «dar de alta una cosa» (quitar el 60). Rama `beta-pv3`.
- **Pruebas.** «+ prueba» (la fuente la nombra): una cosa sin T dada por una persona no tiene T; reponer es una transferencia del dueño.
- **Aclarado a VG dónde vive cada cosa:** hilo = punteros «sobre» hacia arriba (completo por construcción); diario = índice inverso «quién apunta a mí» (hoy el servidor; con Nostr, los relés: parcial por naturaleza); Bitcoin solo ancla compromisos (tercer reloj, §5).

---

## 3. El 4, la escalera y el rango

### #41 — El 4 y la matriz grande (VG 12-11)

- **Qué se decidió.**
  - *Filas* = **oficios** 0-9: 0 mostrar, 1 gestionar, 2 administrar, 3 coordinar, 4 hacer, 5 verificar, 6 registrar, 7 planear, 8 medir, 9 guiar. *Columnas* = **ejecución** 0-9: 0 contenido, 1 E, 2 P, 3 R, 4 T, 5 verificación sin token propio, 6/7 adjudicación al pasado / proyección al futuro, 8 crecimiento que genera rangos, 9 contenido que guía.
  - Cubo [0..9]¹⁰; Pointed 10⁰ (1 punto), Sequenced 10¹, Mapped 10² (+ tercera dimensión con clic), Scened 10³. Diagonal del cubo = dddddddddd.
  - **Escalera dulce** (corregida por VG 12-11: la fila es el tipo de acción y la dirección el intercambio hecho; un dígito más porque cambiar es más que ver): fila k ↔ dígito k+1 repetido k+1 veces, relleno con ceros: 1000000000 → 0.3, 2200000000 → 1.1, 3330000000 → 2.1, 4444000000 → 3.1, **5555500000 → 3.2 (el punto dulce: verificar)**, 6666660000 → 4.1, 7777777000 → 4.2, 8888888800 → 5.1, 9999999990 → 5.2, 0000000000 → 5.3. Fila 9: tras el 9 viene el 0, diez ceros: el ciclo da la vuelta; VG: equivale a crear una época en sí misma, un foco currado del todo, cuyo último acto es poner el escaparate, su 0 (las landings de AGRAM, Ikisai y Mueling son ese 0).
  - **DECIDIDO VG:** los diez **rangos** = los diez peldaños de la escalera (0 → 0.3 … 9 → 5.3); cualquier desajuste puntúa **hacia arriba** (para que quepa en un token). La matriz del 4 = proyección 10² del cubo para el nodo; la diagonal marca el peldaño.
- **Por qué.** La fuente da el sentido de la fila como tipo de acción y de la dirección como el intercambio hecho; el «hacia arriba» es para que quepa en un token.
- **Qué cambia.** Rama `beta-el4`: luego, la regla `how`/`against-others` por la escalera y la matriz del 4 con oficios y ejecución como **datos** (no código).
- **Pruebas.** La fuente no las nombra: deben cubrir que cada peldaño da su rango, que el desajuste puntúa hacia arriba y que la diagonal marca el peldaño.

### #39 — Un solo rango (DECIDIDO VG 12-11, corregido)

- **Qué se decidió.** **Un solo rango**, el del 8 (nivel.grado por la cuota en la cohorte), usado por detrás en todas partes: filtro del 3, posiciones del 9, etc. No hay rango declarado: situarse en el 9 es elegir entre las posiciones que ese rango deja disponibles. Se descarta repartir la madurez.
- **Por qué.** La fuente no lo dice más allá de la corrección de VG.
- **Qué cambia.** Lectura `how` apoyada en la del 8; filtro del 3 por rango. Rama `beta-el4`. Se enlaza con #41 (los rangos son los peldaños) y #37 (el filtro).
- **Pruebas.** La fuente no las nombra: deben cubrir que `how` sale del 8 y que el filtro del 3 por rango coincide con él.

### #40 — El orden de ver es 1, 2, 3, 4 (DECIDIDO VG 12-11)

- **Qué se decidió.** El **orden de ver** es 1, 2, 3, 4 (sobre qué me centro, con qué criterios, para quién, hago) en todas partes; los hilos del 6 y del 7 pasan a 1 2 3 4 de arriba abajo (hoy 1 3 2 4 / 2 4 1 3, dato en la fila 8.7). Lo hecho se construye al revés: T (que se recalcula) → R → P → E.
- **Por qué.** La fuente no lo dice más allá del orden de ver frente al de construir.
- **Qué cambia.** Dos datos en la fila 8.7. Rama `beta-el4`.
- **Pruebas.** «+ prueba» (la fuente la nombra): los hilos del 6 y del 7 salen en 1 2 3 4.

### Decisiones 7 y 8 del estudio BQL (recogidas en #49; el resto, en el tema 4)

El estudio las presentó como decisiones para VG (§6) y VG las tomó el 12-11; afectan al 4:

- **Decisión 7 — el coste de escribir (DECIDIDO VG, modelo de ejecución).** Dos estados: **interactuar** sobre el foco (sin acuñar) y **ejecutar desde el 4**. El 4 recopila lo que cada cosa exige en T (cada parte puede exigir o no) y propone la denominación de T que lo cubre, ajustable a escalas menores (1 h 11 min) o mayores; **ejecutar = acuñar la T**. El botón de ejecutar va junto a eso y cambia con el rango: apagado pero pulsable al principio, marcado al llegar al 3, efectos/segundo borde al subir. El valor del registro crece con sus transacciones (todas suman). Una regla, cantidad = suma de lo exigido por posición; **el minuto fijo era un sucedáneo.**
  - *Por qué:* el estudio halló el coste copiado 30 veces como «1 minuto» en las plantillas mientras `escribirDesde` cobra un minuto por posición (A3): dos verdades distintas.
  - *Qué cambia:* el 4 calcula y propone la T; la regla del coste sale de las plantillas (`escritura.costeT` y las 30 copias del minuto) y pasa a ser una regla de la época que se aplica a toda candidata antes de firmar (paso 4 del plan, ola 2).
  - *Pruebas:* la fuente no las nombra: deben cubrir que la cantidad es la suma de lo exigido por posición, que ejecutar acuña esa T y que interactuar no acuña.
- **Decisión 8 — el anuncio es un movimiento anunciado del libro (DECIDIDO VG: SÍ).** Y «declarar T futuro» = anuncio de T con fecha. VG, en el 4: pulsar una celda la abre y enseña su lista de hasta diez movimientos anunciados, cada uno con el **color de su estado** (propuesto, autorizado, ejecutado, verificado); afinar o completar los que faltan sube el rango; **los estados salen del motor y pasan a datos de la época** (el motor solo comprueba). Resuelve #48.
  - *Qué cambia:* hoy lo anunciado es un registro en el 4.1 cuyo payload imita un movimiento y solo lo escriben los ejemplos; pasa a ser un movimiento anunciado del libro, cumplido por el registro que se ancla sobre él; las estaciones pasan a datos (la «verificada» es la de #50).
  - *Pruebas:* el caso de dos anuncios iguales y un solo pago (#48): cada pago cumple un solo anuncio.
- **Decisión 9** (el 4 lee el trabajo de todo el subárbol con `under`), también del 4: ver el tema 4.

---

## 4. BQL con transacciones

### #43 — BQL sabe de transacciones (VG 12-11; estudio entregado)

Fuente: catálogo #43 y `ESTUDIO_BQL_TRANSACCIONES`. Todo el BQL nuevo del estudio es **propuesta de Core**: no existe en el código; las decisiones 1 a 9 las tomó VG (véase #49) y la 10 la toma Core.

- **Qué se decidió.** BQL sabe de transacciones: la **B** de BQL; además de BTML, lee y mueve tokens.
  - (a) **Leer:** movimientos de un registro (token, cantidad, serie, de→a, instante, bloqueado hasta, caduca), lo que tiene en mano una identidad por serie, lo anunciado y pendiente; el tiempo viene de ahí (resuelve #13 «BQL sin fecha»).
  - (b) **Mover:** una regla expresa movimientos de T/R/P/E (lo que hoy declaran las plantillas y ejecuta el motor en código).
  - **Límite:** lo que sale del libro al mundo (correo, API, pintar) se queda en el motor/embebido.
  - Primer paso: inventario de lecturas y reglas envueltas en JS que caen con esto (estudio, §2).
- **Por qué (estudio, §1 a §4).**
  1. La parte de movimientos de las plantillas es un ñapo **de forma, no de seguridad**: un segundo lenguaje en el 4 de cada plantilla (posiciones que cambian de sentido, `"nobody"` en lugar del símbolo, condicionales por multiplicar por cero, el minuto de escribir copiado 30 veces, `motor.siguiente` armando movimientos en JS). Lo salva que todo lo que construye pasa después, entero, por las reglas.
  2. BQLM ya lee movimientos, cartera, bloqueos, relojes e instantes (comparables como números). Con `moves`, `under`, `by` y unas posiciones caen `js flujo`, `js futuro`, el diario, `estadoDeEntrada` y «when scale»: de 34 filas del inventario, unas 17 caen, 7 son dudosas y el resto se queda en JS a propósito (suelo o efecto hacia fuera).
  3. Mover = los cinco símbolos como verbos (`mint transfer lock release burn`) con `from to exit when price` y `memo`.
- **Qué cambia (plan en 7 pasos, §5 del estudio; propuesta Core).** 1 leer: posiciones (D-MOV nuevas, `X.6.8`, `epoch.7.3`); 2 leer: palabras (`moves`, `under`, `by` en `bqlm.js`); 3 caen las lecturas envueltas (PV1, PV7, `estadoDeEntrada`, «when scale», `diario`, `lente.pendientes`, `motor.cierre`, caducidades del camino; se retira la incongruencia por escala, #42); 4 escribir (verbos, `memo`, serie como posición, `put` en la cartera, 30 plantillas migradas, la regla del coste, `motor.siguiente` sobre las plantillas, fuera `serieDe` y el «extra»); 5 reglas que escriben (lista cerrada de destinos de `put`, tope por serie de la obtención en BQL, asignación de T como regla si VG quiere); 6 el anuncio; 7 lo que queda en JS a propósito (cierra el inventario en `docs/notas/CAPA_CERO.md`). Orden (decisión 10): **leer primero, escribir después, doble ejecución al migrar**: ola 1 en `beta-bqllee`, ola 2 de escritura tras fundir.
- **Pruebas (estudio, §5).** Una por posición en `contexto-eje.test` y SEG-09 (el payload no fabrica el 6 ni el 8); analizador, presupuesto y PENDIENTE POR LÍMITE en subárboles grandes, empates estables; red de equivalencia de cada fórmula frente a su JS en los ejemplos y en `lecturas.test` (`contrato.leer` no cambia de firma); doble ejecución durante la migración (el 4 viejo y el nuevo dan los mismos movimientos en `acciones.test`, los ejemplos y `autoejecutar`) y después se borra el viejo; `reglas-tope` y `seguridad-bqlm` más casos nuevos (una regla que escribe con un verbo da ERROR); el caso de dos anuncios iguales y un solo pago.

### #49 — Las diez decisiones del estudio BQL §6 (repaso con VG, 12-11)

Estado de la fila: en curso. Ola 1: `beta-bqllee` (decisiones 1 a 4 y 9); ola 2: escritura (5 a 8) tras fundir.

1. **`moves` como palabra: SÍ** (VG «Bien»). *Por qué:* el 1 de un registro ya está colisionado (movimientos, el 1 del payload, lo anclado y las series de E vivas). *Qué cambia:* `moves X` da los asientos del libro de X por llegada; de una identidad, todo donde es «de» o «a»; de una serie, todos sus asientos.
2. **`under` y `by`: SÍ**, ninguna palabra más por ahora (VG «Correcto»). *Por qué:* son las dos que faltan para el 1, el 6 y el 7; para todo lo demás sigue la regla de oro (lo concreto es posición). `under X` = X y todo lo que cuelga de él a cualquier profundidad (con el presupuesto como tope); `M by e` = M ordenado por e de menor a mayor, empates por llegada.
3. **Posiciones nuevas de D-MOV: SÍ, con la clase del asiento en 4.1** (junto a la primitiva en 4.0; las dos son «qué se hace»), **instante y registro en 6**, **bloqueado hasta en 7.2**. VG: «las clases de asiento en su 4». *Qué cambia:* la salida que es un instante se despliega; el payload no puede fabricar el 6 ni la clase (SEG-09).
4. **Relojes en X.6.8: SÍ, como vector de tres instantes** (6.8.0 el t del libro, 6.8.1 Nostr, 6.8.2 bloque Bitcoin), puntuado como el vector de diferencias con signo del encaje: signo = orden (negativo = cuenta rara), distancias = latencias de anclaje como medida del 8 (sin uso hasta que haya transporte). Ver el tema 5.
5. **Verbos de movimiento: SÍ**: `mint transfer lock release burn` + `from to exit when price memo`, serie como posición de su familia. *Qué cambia:* las plantillas dejan de ser un segundo lenguaje (el 4 pasa a ser una lista de sentencias evaluadas en orden); desaparecen `serieDe`, el «extra» de la posición 2 y el texto `"nobody"`. Ola 2.
6. **Invariante: SÍ.** Las plantillas construyen y **firma quien mueve**; las reglas solo leen; el libro por su cuenta solo acuña hasta un nivel en una lista cerrada. Con prueba. *Por qué (§4c del estudio, propuesta de Core):* tres capas que ninguna se salta (la plantilla construye la candidata y no concede nada; las reglas la validan y solo leen: un verbo o un `put` dentro de una regla que lee es ERROR; el libro la aplica entera o nada). Invariantes: el autor (todo lo que sale de una mano va en la transacción que firma esa mano); el libro solo acuña hasta un nivel (`put`, solo en una lista cerrada: hoy `A.2.1`, la obtención, y si VG quiere la asignación de T); quién acuña qué (E y R, solo su emisor y para sí; T, nadie, es del libro; P, solo la obtención o la reposición de un paso); el P que respalda no cambia; construir la clave de una serie no da derecho a nada; atomicidad y presupuesto (SEG-10); lo que sale del libro no es BQL. *Pruebas:* `reglas-tope` y `seguridad-bqlm`, y que una regla con un verbo da ERROR.
7. **El coste de escribir: DECIDIDO VG (modelo de ejecución).** Ver el tema 3.
8. **Anuncio = movimiento anunciado del libro: SÍ** (y «declarar T futuro» = anuncio de T con fecha). Ver el tema 3. Resuelve #48.
9. **El 4 lee el trabajo de todo el subárbol con `under`: SÍ** (la celda distingue lo directo de lo heredado). *Qué cambia:* hoy el PV4 lee un solo nivel (`down`); con `under` lee todo el subárbol.
10. **Decisión de Core (VG delega): leer primero, escribir después, doble ejecución al migrar.**

Pruebas de 1 a 4 y 9: las del paso 1 y 2 del estudio (ver #43). Para 5 a 8, las del paso 4 a 6 (ver #43).

### #48 — Defecto probable: un pago cierra dos anuncios iguales (abierta)

- **Qué es.** Visto por el estudio (sin prueba que lo cubra): un mismo pago cierra dos anuncios iguales, porque lo anunciado es un payload que imita un movimiento, solo lo escriben los ejemplos y se casa por existencia, no por consumo (p. ej. un pago de 20 cierra dos anuncios de 20).
- **Qué se hace.** Encargo pequeño: una **prueba que lo reproduzca**; si se confirma, arreglar o resolver con la decisión 8 (anuncio = movimiento anunciado del libro). Es una **hipótesis** hasta que la prueba exista.

### #50 — Diario materializado, verificación y «sin verificar no se ejecuta» (VG 12-11, con la decisión 6; estado: diseño)

- **Qué se decidió.**
  - (a) El diario/índice de transacciones como **vista materializada persistente** (lo que el eje ya construye en memoria: hijos por «sobre», saldos, bloqueos, relojes), igual en navegador y servidor, de la que lee `moves`.
  - (b) El **5 = verificación automática** de que lo local encaja con lo anclado en la cadena (segundo tetraedro).
  - (c) Dos modos: mostrar enseguida lo no verificado (rápido) y verificar en segundo plano (perezoso/await). **Regla de seguridad: sin verificar no se ejecuta** (ningún movimiento se apoya en algo no verificado): una estación «verificada» que no pone nadie. Hoy todo cuenta como verificado al llegar del servidor.
- **Por qué.** La fuente da la regla de seguridad; el resto es diseño.
- **Qué cambia.** Dejarlo establecido en `docs/MOTOR.md` y `docs/CONTRATO.md`; la estación «verificada» como dato de la época (con #49 decisión 8: los estados salen del motor y pasan a datos).
- **Pruebas.** La fuente no las nombra: deben cubrir que un movimiento apoyado en algo no verificado no se ejecuta y que mostrar rápido no lo ejecuta.

### #67 — Primitivas puras de verificación en BQL (Core AGRAM 12-11, para el SIP de StateArk)

Fuente: decisión de Core AGRAM del 12-11, a petición de Core StateArk (`InTheState/stateark/sip/HUECOS_BQL.md`, huecos H1 a H8 y H10). No es una decisión de VG: la marca es **Propuesta Core**, aplicada.

- **Qué se decidió.** BQL gana primitivas **puras** de verificación, sin efectos ni entrada/salida, nunca de firma ni de claves privadas: `bytes`, `hex`, `utf8`, `hash` (canónico o etiquetado BIP-340), `sha256`, `sha256d`, `cat`, `slice`, `reverse`, `le`, `below`, `merkle` (esquemas `"bitcoin"` y `"sip"`), `ots`, `cabecera`, `tx` y `signed` (BIP-340), con un tipo nuevo, los **bytes**, distinto de texto y número (en los datos BTML viajan como hex). Forma, coste y semántica: `docs/BQLM.md` §12.
- **Por qué.** Los SIP de StateArk son épocas de AGRAM: un registro de AGRAM no va a buscar nada al eje de StateArk, lleva **copiada** la prueba (el sello de tiempo, el recibo, el candado) y una regla tiene que comprobarla **sin salir del libro**. Sin estas primitivas, la regla tenía que creerse lo copiado (la raíz, la hora, las salidas, la preimagen). Una regla que las usa sigue «solo leyendo» (invariante de #49, decisión 6): todo lo que verifica está en el libro; las primitivas no son verbos. Son la única excepción a «no hay funciones con nombre»: no escogen nada del libro (eso sigue siendo posición), calculan sobre bytes.
- **Qué cambia.** Núcleo: `src/cripto.js` (lo puro: SHA-256 propio, porque el de noble no se exporta y Web Crypto es asíncrono; cabecera, transacción, Merkle, OTS; BIP-340 con `schnorr.verify`, la única llamada a la librería) y `src/bqlm.js` (las llamadas, el tipo bytes, el presupuesto por byte: `LIMITES.bytes`, 2 000 000 por evaluación; `COSTE_FIRMA`, 65 536 por firma). Ningún dato de la época cambia. Anunciado y no hecho: «verificado» como regla de la época que lee `X.6.8.2` (`docs/CONTRATO.md` §4.4).
- **Pruebas.** `test/bqlm-cripto.test.js`: SHA-256 de FIPS 180-2 y cruzado con `node:crypto`; los vectores de BIP-340; el bloque génesis (cabecera, prueba de trabajo, coinbase, Merkle de una tx); un Merkle «bitcoin» de tres con duplicado; el Merkle «sip» con la misma raíz que el sellador de `servidor/sim/stateark`; OTS sintético; una transacción con testigo; `signed` sobre `bytes(id)` de un evento firmado; el candado §8 en Taproot (vector de rust-miniscript de StateArk); y que `analizar` acepta las reglas del SIP 0. `test/seguridad-bqlm.test.js`, SEG-16 a SEG-18: ninguna primitiva firma, ninguna lee fuera del libro, el presupuesto corta una `tx` o un `cat` desmesurados.

---

## 5. Tiempo e incongruencia

### #42 — La incongruencia de escala se retira; solo queda la de los tres relojes (DECIDIDO VG 12-11)

- **Qué se decidió.** La «incongruencia de escala» era un invento de Core (mockup) y **se retira**; `cuenta-rara` queda reservada a la **única incongruencia real**: los tres relojes fuera de orden: (1.º) el movimiento de T en el libro, (2.º) la marca de tiempo del evento al transportarlo por Nostr, (3.º) el bloque de Bitcoin que lo ancla. Hoy solo existe el primero: nada que marcar. El 6 y el 7 se construyen con T.
- **Por qué.** Solo los tres relojes pueden estar realmente fuera de orden.
- **Qué cambia.** Quitar `incongruente`/`franjaDeEntrada` por escala del núcleo y de la carta; dejar el hueco para los tres relojes. Rama `beta-bqllee`.
- **Pruebas.** La fuente no las nombra: deben cubrir que ya no se marca incongruencia por escala y que `cuenta-rara` no salta con un solo reloj.

### #65 — Se retira también la «escala frente a tamaño» del núcleo; queda `escalaQueCubre` (DECIDIDO VG 12-11)

- **Qué se decidió.** #42 quitó la incongruencia de escala de la carta y de `contrato.js`, pero el núcleo conservaba `tiempo.incongruenciaDe` (con `incongruenciaT` en `validez`) y `tiempo.recomendacionDeEscala` (decisión del 8-11). VG 12-11: **se retiran las dos**; la única incongruencia del núcleo es «clocks out of order» (los tres relojes de `X.6.8`). El cálculo de la recomendación no se pierde: pasa a ser `tiempo.escalaQueCubre(posiciones)` (orden de magnitud de lo emitido → escala del calendario que lo cubre), una utilidad del 4 para proponer la denominación de T al ejecutar (decisión 7 de #49, tema 3).
- **Por qué.** La escala ya no la declara el autor a ojo sino que la propone el 4 a partir de lo emitido, así que el desajuste no puede darse salvo por fallo del propio 4: eso es cosa de una prueba, no de una marca al usuario.
- **Qué cambia.** `src/tiempo.js` (fuera `incongruenciaDe` y `recomendacionDeEscala`; entra `escalaQueCubre`), `src/validez.js` (la interpretación ya no lleva `incongruenciaT`), `antigua/` (fuera `htmlRecomendacionT` y la línea tras escribir), `docs/CONTRATO.md`, `docs/FUNDAMENTOS.md`, `docs/MODOS.md`, `docs/notas/NEUTRALIDAD_IDENTIDAD.md` (C16), `docs/notas/INVENTARIO_REGLAS.md` (TT-13 retirada, TT-14 reconvertida). Rama `beta-sinescala`.
- **Pruebas.** Retirada la de `incongruenciaDe` (`test/t-consumido.test.js`); la de la recomendación de `test/ui.test.js` pasa a probar `escalaQueCubre` (fronteras 0, 1, 10, 11, 100, 1000, 1001, 10^7 y el desborde).

### #64 b — La condición «writing burns today's T» exige lo calculado por la regla del coste (DECIDIDO VG 12-11)

- **Qué se decidió.** El coste de escribir es una regla de la época, «the cost of writing» (un minuto del calendario por posición del payload, A3), y ya lo pagaban las plantillas y `escribirDesde`. La condición «writing burns today's T» solo pedía al menos una quema de T del autor. VG: **la condición exige lo calculado por la regla**: lo que el autor quema de T, en cualquier escala real y convertido a segundos con el calendario, ha de ser ≥ lo exigido por el payload. Menos se rechaza («burns less T than writing costs (N seconds)»); quemar de más vale; el T informativo no paga (pero quien solo quema T informativo escribe una memoria o un plan, gratis en T real y no presente, y no se le exige el coste: así lo decidió VG el 8-11, «el T informativo paga la escritura», y no cambia). El génesis sigue fuera de las reglas.
- **Por qué.** Un registro que paga menos de lo que la regla dice está mal pagado; el libro no acepta dos tarifas según por dónde entre el registro: **una sola tarifa, por posición, venga de donde venga**.
- **Qué cambia.** `datos/epocas/reglas/writing-burns-today-s-t.json` (la condición y su mensaje es/en); `src/escritura.js` (`quemaDelCoste(autor, payload, escala?, { eje })`, que usan `escribirDesde`, `Eje.invitar`/`aceptar`, `Local.englobar` y `escribirBase`); los ejemplos (`ejemplos/ikisai/coste.mjs`: `pagaElCoste`/`escribirPagando`) y los helpers de las pruebas (`test/ayudas-coste.js`) calculan por payload. La cuenta del coste está repetida en la condición (una regla no llama a otra); `test/coste-exigido.test.js` comprueba que coincide con `exigido`.
- **Consecuencia abierta (decidir VG).** Una base pesa cientos de posiciones (≈280–360 en el ejemplo), así que escribirla cuesta cientos de minutos; antes, un minuto (`COSTE_BASE`, «[X] decidir VG: el coste de una base»). Las cosas del ejemplo (comprasHermanas) reciben ahora T de su dueño (sábado y domingo) en minutos, segundos, horas y el día, el ciclo o el año enteros para poder escribirlas; `escribirBase` paga en la `escala` que se le pida o, si no, en la primera, empezando por el minuto, que le alcanza (`escritura.escalaQueAlcanza`); y las bases del ejemplo se escriben por defecto el 9-11, un día en que la casa no ha gastado su asignación. El mercado y el puesto del ejemplo pasan del 7-11 al 8-11. Los mensajes de «ver/tocar» (un segundo, local) usan la misma plantilla de la regla.
- **Pruebas.** `test/coste-exigido.test.js`: la cuenta de la condición es la de la regla; lo exigido pasa, uno menos se rechaza, de más vale; suma de escalas (1 h + 11 min); el T informativo no cuenta; una posición cuesta un minuto.

### Los tres relojes en `X.6.8` (decisión 4 de #49, DECIDIDO VG)

- **Qué se decidió.** `X.6.8` como **vector de tres instantes**: 6.8.0 el t del libro, 6.8.1 Nostr, 6.8.2 bloque Bitcoin. Se puntúa como el vector de diferencias con signo del encaje: **signo = orden** (negativo = cuenta rara), **distancias = latencias de anclaje** como medida del 8 (sin uso hasta que haya transporte).
- **Por qué.** Es la incongruencia de #42 hecha dato: lo que se compara son los tres relojes.
- **Qué cambia.** Posición nueva `X.6.8`, vacía hasta que exista el transporte (la pone el transporte, fuera del id). *Propuesta Core del estudio (no decidida por VG como tal):* los márgenes en un dato de la época, `epoch.7.3` (la hora de un bloque de Bitcoin admite unas dos horas de holgura), y una lectura, en `X.6.9` o donde VG diga, que da verdadero si los relojes no van en orden; hoy siempre daría falso.
- **Pruebas.** Una por posición en `contexto-eje.test`; SEG-09 (el payload no fabrica el 6); una lectura de «fuera de orden» con los tres relojes presentes y una con solo el primero.
- **Sobre #13** (BQL sin fecha): lo resuelve #43 (el tiempo viene de las transacciones). La otra mitad de #13, plantilla 0.9/5.0 (estilos) frente a textos de ayuda, sigue «decidir VG».

---

## 6. Pantalla

### #23 — Cómo poner algo como foco (VG 12-11, «Correcto»)

- **Qué se decidió.** Poner algo como foco **no es lo mismo que profundizar**. VG: arrastrar al centro sería lo ideal; doble clic también. Core recomendó las dos y VG dijo «Correcto»: **doble clic / doble toque = foco** en los dos modos (ya en la beta); **arrastrar al centro, solo en Mapped** (pendiente de hacer); **en Sequenced no**, se confundiría con el scroll del hilo. Un clic sigue siendo profundizar.
- **Por qué.** En Sequenced el arrastre se confundiría con el scroll del hilo.
- **Qué cambia.** Carta: el doble clic/doble toque ya está; falta arrastrar al centro en Mapped (rama `beta-el4`).
- **Pruebas.** La fuente no las nombra: deben cubrir que un clic profundiza, que el doble clic pone el foco en los dos modos y que arrastrar al centro solo existe en Mapped.

---

## Lo que queda abierto

- **#35**: «arrastrar vs. movimientos» (Core lo cierra con VG antes del encargo).
- **#29**: la preaceptación como dato de la época (por comprobar), la exposición de elegibilidad en el contrato y colocar por lo que se mueve (1.3, 1.3.4, 1.4/4, equipo) como lecturas: hoy ninguna sale.
- **#47**: principio, sin código; transporte (Nostr, Bitcoin) para cuando AARPIA lo pida.
- **#48**: prueba que reproduzca el defecto; hipótesis hasta entonces.
- **#50**: diseño; falta dejarlo en `docs/MOTOR.md` y `docs/CONTRATO.md`.
- **Fila 8.7 por modo**: decidida (#52) y migrada; falta la forma propia de Pointed y de Sequenced, PV a PV (diseño §5, paso 4). El **orden de implementación** (diseño §5) sigue siendo propuesta de Core.
- **Estudio BQL:** si la asignación de T pasa a regla del libro y destino de `put` (decisión 6, paso 5: «si VG quiere»).
- **#13**, la mitad de los estilos (plantilla 0.9/5.0 frente a textos de ayuda): decidir VG.

## Lo que las fuentes no dicen o dicen distinto

1. **Numeración de `X.6.8`.** El estudio (§4a) propone 6.8.0 = Nostr y 6.8.1 = Bitcoin; #49 (decisión 4, de VG) fija tres instantes: 6.8.0 = el t del libro, 6.8.1 = Nostr, 6.8.2 = Bitcoin. Esta nota sigue #49; las fórmulas del estudio habrá que reescribirlas con esa numeración.
2. **Clase del asiento.** El estudio la pone en D-MOV 8 y la primitiva en 4; #49 (decisión 3) la pone en 4.1, junto a la primitiva en 4.0. Esta nota sigue #49; las fórmulas del estudio (`it3.8 = "asignacion"…`) deben ajustarse.
3. **«#12 cerrado».** El catálogo da la fila #12 como «en curso»; lo cerrado es el diseño de §7 y los flecos que VG resolvió el 12-11 (#44, #45, #47).
4. **Pruebas.** Salvo las que la fuente nombra (los casos de Core del #12, la prueba con Core en la celda 5 de #33, «+ prueba» en #31, #40, #44 y #46, y el plan de pruebas del estudio), las demás se limitan a lo que la propia decisión exige.
