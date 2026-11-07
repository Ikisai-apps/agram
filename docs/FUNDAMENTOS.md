# Fundamentos decididos (6-11-2026)

Resumen de lo que está decidido para construir el núcleo. El detalle y la trazabilidad viven fuera de este repositorio.

## Lectura segura: de la cruz a la X

El eje horizontal es la cadena de registros: pasado a la izquierda, presente en el centro, proyecciones a futuro a la derecha (PV6 y PV7, **hilos** encadenados por referencia). La confluencia hacia arriba produce PV8 (mediciones, niveles y grados). De ahí bajan los caminos de PV9. En el centro queda el registro en foco: PV5. Una lente sobre él es PV0. De la confluencia de árboles vecinos salen los cuatro ramales: PV1 entre 6 y 8, PV2 entre 8 y 7, PV3 entre 6 y 9, PV4 entre 7 y 9. La mano del usuario trabaja en 1–4 y ejecuta en 4. **Ejecutar escribe**: produce un registro nuevo que entra en el eje. La X escribe hacia la cruz; la cruz se lee hacia la X.

## Eventos sobre tokens

Todo evento **es** una transición de tokens; el payload BTML viaja encima. No hay evento sin movimiento. El evento mínimo mueve **T** (tiempo; siete escalas: segundo, minuto, hora, día, semana, ciclo de 28 días, año; cada escala es un token distinto). E (recursos), P (poder/criterio), R (reputación) entran cuando el evento los toca. Los tokens son tokens de base de datos; sin Nostr ni Bitcoin por ahora.

## Génesis

El primer registro se escribe por convención, fuera del sistema: emite tokens iniciales a la primera identidad bajo la regla corta de la época 0 (cada dígito es un PV) y fija un foco raíz. A partir de ahí todo se genera dentro.

## Épocas

La época es una convención paralela, **fuera del dato**. Un dato se puede leer desde cualquier época. La época actual es la confluencia de las pasadas y predefine cómo se calculará la siguiente. BTML no lleva época dentro.

## BTML

La unidad de información es el evento (identidad, firmante, contexto, metadatos) con un payload: un terminal (número, palabra, HTML, archivo, referencia) o un array posicional de hasta diez posiciones, sin nulos ni huecos, cuyas posiciones contienen terminales, subarrays o referencias a otros eventos. Las referencias no copian. Las direcciones son cadenas de diez dígitos; el ID no es la dirección. Los dígitos son posiciones semánticas: el significado de cada profundidad lo da la regla corta de la época.

## Modos y proporción de escritura

Pointed (~1 décupla), Sequenced (~10), Mapped (~100), Scened (~1000). La unidad de cuenta es la posición. Desde Pointed se escribe un décimo de lo leído; desde Sequenced entre un quinto y un décimo; desde Mapped entre un cuarto y un tercio. El registro de salida se anida sobre el contenido del foco.

## Sobrio y animado

Cada operación es una sola: la transición con su efecto nombrado. Sobrio y animado son dos renders de la misma operación, intercambiables en cualquier modo y PV, y ambos personalizables (PV0). Los mundos de los PV (reino, jardín, parque acuático, fábrica, hilos, cielo, camino) son especificación funcional: cada animación corresponde a un cambio semántico explicable.

## Añadido en la noche del 6 al 7-11-2026

### Colisiones, no apaños

Una dirección con ceros finales nombra a la vez la posición 1, la 1.0, la 1.0.0… Todos son ocupantes legítimos de esa dirección, con su camino exacto y su procedencia. Un terminal no tiene posición 0. Las colisiones se conservan y se ordenan sin borrar nada: son la materia prima de `BUSCAR`, de los criterios (`ORDENAR`), de `ACTUAL` y `ELEGIR` (que no publica) y de la fábrica (consolidar es la única fijación, y no borra). No existe modificar en sitio: corregir es añadir un ocupante.

### El vector de encaje

Cada ocupante lleva su origen (de dónde viene), su destino (dónde se coloca) y el vector de diez diferencias con signo, dígito a dígito (corpus V4): candidato − buscado. Ordenan las **coincidencias de ruta** y la llegada, sin borrar nada: exactos primero, luego más profundidades de acuerdo (el acuerdo de prefijo), empates por llegada. El signo es información por componente: positivo, al candidato le sobra (reducir); negativo, le falta (completar). La distancia (la diferencia sin signo, profundidad a profundidad y sin sumar enteros) también es información. Ni el signo ni la distancia ordenan hasta que una época haga ordinal una profundidad, y entonces solo ahí: opción B, decidida por VG el 7-11 por la tarde (nota en `docs/notas/SIGNO_DEL_VECTOR.md`). Un escrito anclado en la dirección buscada encaja exacto. La orientación (el tercer cero) queda apuntada para cuando lleguen las reglas cortas.

### Tokens según el corpus

**P** (poder/criterio) exige siempre un ámbito: el registro cuyo subárbol cubre, o `genesis` (todo el eje). No existe un P total. Delegar poder estrecha el ámbito y se debita del ámbito que lo cubre. El motor autoriza con el poder sobre el registro de la consolidación. **R** (reputación) exige emisor y no es fungible: solo su emisor la mueve; quien la recibe la tiene «de X» y no puede pasarla. **E** por emisor y denominación. **T** por escala (ver «Series de tokens», 7-11; antes era un solo token en segundos). La validación de un evento simula sus movimientos sobre una vista de los saldos: si algo falla, nada cambia.

### AARPIA e identidades

La autorización y la ejecución reales son de AARPIA, que aún no existe; lo que hay en el motor (autoriza quien tiene poder sobre el registro y no es el autor; ejecuta el autor) es un hueco provisional. Las identidades son personas, grupos de personas o cosas; quien da de alta a una identidad declara su clave y su tipo en el mismo evento que le da tokens. El tipo solo sirve para saber quién emite (ver «Series de tokens»).

### Lenguaje para IA

Los lenguajes se hicieron para que programaran personas; aquí programan IA. Por eso: posiciones en vez de nombres (coordenadas), referencias que no copian (conexiones), colisiones como distribución, vector como distancia, consolidar como colapso con traza, época como lectura por contexto. El léxico es una capa (las reglas cortas) sobre las posiciones; las fórmulas son cortas y locales; el frontend es la única parte pensada para personas.

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

**P.** La casa escribe un registro de dominio («Alojamiento») y delega P con ese ámbito; recepción autoriza lo que cuelga de ahí y puede delegar hacia abajo. P solo se emite en el génesis; delegar estrecha el ámbito.

Decidido [D] (VG, 7-11, mapa §12) e implementado: lo anterior. Abierto [X] decidir VG: si una identidad puede emitir su propio tiempo como serie limitada (T fuera del génesis: «no tocar hasta que lo diga»); qué escalas completan las diez de T; si E, P y R admiten fracciones (hoy sí, en coma flotante); cómo firma un grupo (es de AARPIA).
