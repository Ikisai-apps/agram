# Fundamentos decididos (6-11-2026)

Resumen de lo que está decidido para construir el núcleo. El detalle y la trazabilidad viven fuera de este repositorio.

## Lectura segura: de la cruz a la X

El eje horizontal es la cadena de registros: pasado a la izquierda, presente en el centro, proyecciones a futuro a la derecha (PV6 y PV7, **hilos** encadenados por referencia). La confluencia hacia arriba produce PV8 (mediciones, niveles y grados). De ahí bajan los caminos de PV9. En el centro queda el registro en foco: PV5. Una lente sobre él es PV0. De la confluencia de árboles vecinos salen los cuatro ramales: PV1 entre 6 y 8, PV2 entre 8 y 7, PV3 entre 6 y 9, PV4 entre 7 y 9. La mano del usuario trabaja en 1–4 y ejecuta en 4. **Ejecutar escribe**: produce un registro nuevo que entra en el eje. La X escribe hacia la cruz; la cruz se lee hacia la X.

## Eventos sobre tokens

Todo evento **es** una transición de tokens; el payload BTML viaja encima. No hay evento sin movimiento. El evento mínimo mueve **T** (tiempo; siete escalas: segundo, minuto, hora, día, semana, ciclo de 28 días, año). E (recursos), P (poder/criterio), R (reputación) entran cuando el evento los toca. Los tokens son tokens de base de datos; sin Nostr ni Bitcoin por ahora.

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

Cada ocupante lleva su origen (de dónde viene), su destino (dónde se coloca) y el vector de diez diferencias con signo, dígito a dígito (corpus V4). Ordena la **distancia**, siempre positiva, profundidad a profundidad y sin sumar enteros: exactos primero, luego más profundidades de acuerdo, luego menor distancia, empates por llegada. El signo es solo informativo: positivo, al candidato le falta (completar); negativo, le sobra (reducir); y solo cuenta donde la regla de esa dimensión lo permita. Pendiente de VG: si el signo es por componente o del vector entero, y el orden que impone que la información crezca desde el cero (nota en `docs/notas/`).

### Tokens según el corpus

**P** (poder/criterio) exige siempre un ámbito: el registro cuyo subárbol cubre, o `genesis` (todo el eje). No existe un P total. Delegar poder estrecha el ámbito y se debita del ámbito que lo cubre. El motor autoriza con el poder sobre el registro de la consolidación. **R** (reputación) exige emisor y no es fungible: solo su emisor la mueve; quien la recibe la tiene «de X» y no puede pasarla. **E** por denominación. **T** un solo token en segundos; la escala es la unidad. La validación de un evento simula sus movimientos sobre una vista de los saldos: si algo falla, nada cambia.

### Comparabilidad (PV8): el 8 compara ocupantes

La confluencia hacia arriba (`tiempo.confluir`) no asigna nivel ni grado: construye las **bases** del foco frente a sus comparables accesibles (hermanos ⊂ vecindad ⊂ todo; la cohorte sigue abierta) y dice dónde cae el foco. Por cada medida (posiciones desarrolladas, terminales, escritos, movimientos, identidades, profundidad del hilo, fórmulas) y por cada clave de token que alguien mueve (`T`, `E:EUR`, `P:<ámbito>`, `R:<emisor>`: no hay P total ni R fungible), su distribución y el cuantil del foco. Por cada posición 0–9, cuántos comparables la tienen en su árbol lógico y por qué procedencia: propia, alcanzada por referencia (las referencias no copian) o escrita encima, también por debajo de la profundidad 0. Lo escrito en la raíz colisiona con la posición 0 y se devuelve aparte. Los HITOS heredados son solo una tabla. Consulta sin efectos.

### AARPIA e identidades

La autorización y la ejecución reales son de AARPIA, que aún no existe; lo que hay en el motor (autoriza quien tiene poder sobre el registro y no es el autor; ejecuta el autor) es un hueco provisional. Las identidades son usuarios o cosas; quien da de alta a una identidad declara su clave en el mismo evento que le da tokens.

### Lenguaje para IA

Los lenguajes se hicieron para que programaran personas; aquí programan IA. Por eso: posiciones en vez de nombres (coordenadas), referencias que no copian (conexiones), colisiones como distribución, vector como distancia, consolidar como colapso con traza, época como lectura por contexto. El léxico es una capa (las reglas cortas) sobre las posiciones; las fórmulas son cortas y locales; el frontend es la única parte pensada para personas.
