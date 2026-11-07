# Auditoría de ajuste a AGRAM

Qué parte del código se separa de lo que VG ha decidido (mapa global, §2 y §9–§12) o de lo que especifica el corpus V4, y qué invariantes no cubre ningún módulo. Es una lista para decidir y no cambia nada: esta PR no toca código.

- **Base:** `main` en `95e5396` (tras #35, series de tokens, y #41, separadores reservados). Los números de línea son los de ese commit. La primera versión se hizo sobre `8d73b44`; esta revisión (7-11, tarde) vuelve a comprobar cada ficha, cada línea, cada id y cada sonda.
- **Mapa:** `MUELA/equipo/agram/MAPA_GLOBAL_AGRAM.md` (se cita «mapa §x [marca] l.N»). Se ha leído entero el §12 (l.244–268, todas las [D] del 7-11) y el §13 (l.270–272, todavía sin entradas). Las marcas de autoridad son las del mapa: [D] lo decidió VG, [A] es un acuerdo de trabajo y [X] sigue abierto.
- **Corpus:** paquete V4 (`01_NUCLEO_V4/02…06`, se cita «corpus 0N l.N»).
- **PR abiertas:** cuando una PR abierta ya ataca un hallazgo, la ficha lo dice en «PR abierta». El resumen está en §6.
- **Diario:** el batallón anterior (`wf_1dcdd615-ec1`) dejó seis lectores por módulo y treinta y nueve votos de refutadores sobre trece hallazgos (más un voto lanzado y sin resultado sobre un decimocuarto) antes de pararse por cuota.

## Qué cambia en esta revisión

- **Retirados porque `main` ya los resuelve** (#35): C5 (solo emitía el génesis), C6 (T era un solo saldo en segundos) y C16 (`Eje.desde` aceptaba un génesis ajeno). Quedan en §1.4 con la sonda que ya no los reproduce.
- **Repuesto como vigente:** «BUSCAR no admite una dirección» se refutó porque la forma del argumento estaba abierta. Ahora es [D] (§12 l.263) y vuelve como **C36**, junto con la otra mitad de la misma decisión: el índice es camino exacto.
- **El signo, opción B, ya es [D]** (§12 l.257). Cambian las citas de C11 y F3 y la pregunta 5. Dos textos que no lo recogen (`src/encaje.js:24` y `docs/FUNDAMENTOS.md:41`) pasan a F8.
- **C18** se alinea con las bases del 8 (§12 l.264): los hermanos son una de las tres cohortes. Lo que falla son los pesos, la cohorte única y el cálculo al vuelo en lugar de bases escritas en el 8.
- **C10 y C15** se reformulan con la salida sin huecos (prefijo denso + anclaje), la matriz 10×10×10 y los topes duros 10/100/1000/10000 (§12 l.265 y l.267).
- **C14** suma la [D] de la plaza (§12 l.254 y l.258): ejecutar es mover los tokens.
- **C33** pierde la refutación por ámbito: el 8 ya está decidido.
- **Líneas, ids y sondas:** en `app.js` todo lo que va después de `pintarSaldos` baja cinco líneas; `eje.js` y `persistencia.js` cambian con #35. Los ids del ejemplo son ahora compra `f9e59d1e`, menú `4598f23e` y cuenta `c70bfa6e`. Todas las sondas se han vuelto a ejecutar sobre `95e5396`.
- **Secciones nuevas:** §5, el §12 línea a línea contra `main`; §6, las PR abiertas que ya atacan hallazgos y dónde chocan entre sí; §7, las lecturas mías del mapa que §13 pide anotar.

## Método

1. **Lectores.** Seis lectores, uno por módulo (btml-encaje, bql, motor-escritura, eje-tokens-autoridad, pv-modos-tiempo, frontend), dejaron 63 hallazgos. Leyeron versiones anteriores del código (`9ac8a3a`/`9f04a68`, con trabajo sin commit del vector), así que cada hallazgo se volvió a comprobar sobre `8d73b44`, y ahora sobre `95e5396`.
2. **Tres lentes.** Cada hallazgo se mira con tres lentes:
   - **F, fidelidad:** ¿hay una regla [D] o [A], o una regla del corpus, que lo sostenga con esa fuerza?
   - **C, código:** ¿el código hace lo que dice el hallazgo?
   - **A, ámbito:** ¿está declarado pendiente ([X], §11), es terreno de AARPIA o pide inventar una regla?
3. **Regla de supervivencia.** Un hallazgo sobrevive si al menos dos de las tres lentes **no** lo refutan. En las fichas, ✓ significa «no refuta» y ✗ «refuta». La fuente del voto se marca (d) si viene del diario y (a) si viene de esta auditoría.
4. **Votos que faltaban.** El diario votó trece hallazgos completos; un decimocuarto (C8) se quedó con un voto lanzado y sin resultado. Los demás, cincuenta contando ese, se votaron leyendo mapa, corpus y código y ejecutando sondas sobre `ejemplos/ikisai/compra-food.mjs`. Las salidas que se citan entre comillas son reales.
5. **Fusiones.** Cuando dos lectores encontraron lo mismo desde módulos distintos, el hallazgo se ha fundido en uno.
6. **Revisión del 7-11 (tarde).** Cada ficha se ha vuelto a leer contra `95e5396` y contra el §12 completo, y cada sonda se ha vuelto a ejecutar. Las citas del mapa conservan sus números de línea: §1–§11 no se han movido, y lo nuevo del §12 va de la l.254 a la l.268.

**Resultado.** En la primera versión, de 63 hallazgos sobrevivieron 43 (35 fichas) y 20 quedaron refutados; había además 8 faltantes. Tras esta revisión hay tres fichas resueltas en `main` (C5, C6 y C16) y un refutado que vuelve (C36): **33 fichas vigentes, 19 refutados y 8 faltantes**.

Lo que pide una decisión de VG va marcado **[X] decidir VG**. No se propone ninguna regla que no esté en el mapa o en el corpus. Si una PR abierta deja como [X] algo que el mapa ya decide, manda el mapa, y la ficha lo dice.

---

## 1. Confirmados

### 1.1 Fondo

**C1 · pv-modos-tiempo + frontend · Un terminal sigue desarrollándose como posición 0 (convención retirada)**
- **Dónde:** `src/pointed.js:10-11,19`; `src/mapped.js:39`; `src/sequenced.js:20` (usa `decupla`); `src/escritura.js:70`; `app.js:280-281`.
- **Afirmación:** `decupla()` y `mapa()` ponen un payload terminal en la posición 0, «representación». `desdeMapped` y el formulario de Mapped ofrecen heredar esa posición 0 con `{ref: foco, dir}`. Encaje (`caminosDe`, `encaje.js:117`) y BQL (`leerPosicion`, `bql.js:231` → PENDIENTE) ya dicen lo contrario, así que el repositorio sostiene dos lecturas del mismo dato.
- **Sonda:** `pointed.decupla` del génesis (un terminal) da como primera posición `{"indice":0,"significado":"representación","contenido":"Casa de ejemplo"}`.
- **Cita:** mapa §12 [D] l.246: «Se retira la convención de la representación. […] Un terminal no tiene posición 0 (PENDIENTE).»
- **Propuesta:** en Pointed, Sequenced y Mapped, un terminal no desarrolla ninguna posición; se muestra como el nodo (cabecera o fila «nodo»), y las diez posiciones quedan sin desarrollar. Hay que quitar la herencia de la posición 0 de un terminal en `escritura.js:70` y `app.js:280` y cambiar `test/pointed.test.js:23` («décupla de un terminal: solo la posición 0»).
- **PR abierta:** #42 (BTML-36) lo resuelve en `decupla`, `mapa`, `desdeMapped` y la app. La #40 lo resuelve en la herencia de su nuevo `desdeMapped`. Las dos tocan `desdeMapped` y chocan ahí; la #42 lo anota.
- **Votos:** F✓ C✓ A✓ (a).

**C2 · motor · El autor puede declarar EJECUTADO sin ninguna autorización**
- **Dónde:** `src/motor.js:214`.
- **Afirmación:** `estadoDe` devuelve EJECUTADO si el autor de la consolidación ha escrito en 4 un evento con `contexto.fase = 'ejecutado'` cuyas evidencias existen. Con evidencia vacía, `[].every(…)` es verdadero. No se comprueba que haya una autorización válida.
- **Sonda:** consolidar → «PENDIENTE DE AUTORIZACIÓN»; el autor escribe `{fase:'ejecutado'}` a mano → «EJECUTADO».
- **Cita:**
  - mapa §11 [A] l.238: «ejecuta el autor; lo escrito por quien no puede no cambia el estado»;
  - mapa §2.4 [D28] l.74: «Propuesta, declaración, firma, ejecución y resultado material no se confunden»;
  - corpus 04 l.33: «Ejecutar exige acto solicitante, permisos…».
- **Propuesta:** EJECUTADO exige que `contexto.evidencia` contenga el id de una autorización de `autorizacionesValidas` anterior en `eje.orden`. Añadir la prueba «el autor escribe ejecutado a mano y el estado no cambia». La regla de quién autoriza sigue siendo el hueco provisional de AARPIA; esto es coherencia del propio hueco.
- **PR abierta:** ninguna. La #42 cambia `estadoDe` (solo las consolidaciones tienen estado), pero sigue sin exigir la autorización.
- **Votos:** F✓ C✓ A✓ (a).

**C3 · bql · Dentro de FILTRAR, el segundo parámetro de ACTUAL se lee como profundidad**
- **Dónde:** `src/bql.js:342` (y `indicesDeArgs`, l.285-290).
- **Afirmación:** con un candidato activo, todos los argumentos de ACTUAL bajan por el candidato.
- **Sonda:** `CONTAR(FILTRAR(BUSCAR(4), ACTUAL(1, 10) = "x"))` → «ERROR: ACTUAL espera índices 0–9».
- **Cita:**
  - mapa §2.3 [D, prompt V5] l.60: «dentro de FILTRAR lee el candidato iterado; cantidad nunca significa profundidad»;
  - corpus 03 l.21: «segundo parámetro opcional = número máximo de candidatos, por defecto 1, nunca profundidad BTML».
- **Propuesta:** dentro de FILTRAR u ORDENAR, `ACTUAL(pv)` lee la posición pv del candidato y el segundo argumento es la cantidad (1 por defecto). Corregir `docs/BQL.md:367`, que documenta la lectura prohibida. Añadir la prueba `ACTUAL(1, 1)` ≡ `ACTUAL(1)`. Qué hace una cantidad mayor que 1 en un ámbito unitario: **[X] decidir VG** (corpus 03 l.23 lo deja para V5).
- **PR abierta:** #36 lo implementa (dentro, el segundo argumento es la cantidad; una cantidad mayor que 1 da PENDIENTE sin inventar) y corrige `docs/BQL.md`.
- **Votos:** F✓ C✓ A✓ (d).

**C4 · bql · Fuera de FILTRAR, ACTUAL inventa un origen**
- **Dónde:** `src/bql.js:343-348`; la prueba que lo fija es `test/bql-colecciones.test.js:63-70`.
- **Afirmación:** sin colección activa, `ACTUAL(pv)` hace un BUSCAR implícito en la posición pv del anfitrión y devuelve su primer ocupante, que es el propio anfitrión. El primer parámetro cambia de sentido: deja de ser «el PV del candidato» y pasa a ser «la posición del anfitrión».
- **Sonda:** desde el slot [8] de la compra, `ACTUAL(4)` → «[2 posiciones]», lo mismo que `LOCAL(4)`.
- **Cita:**
  - corpus 03 l.21: «Fuera de iteración lee el primero de la colección activa si existe. Sin ámbito activo, no inventa un origen y queda pendiente»;
  - mapa §2.3 l.60: la colección de BUSCAR «es el ámbito de ACTUAL».
- **Propuesta:** sin colección activa, PENDIENTE «sin ámbito activo». Cómo se establece la colección activa fuera de FILTRAR (por ejemplo, el último BUSCAR de la fórmula): **[X] decidir VG**. Hay que reescribir la prueba citada.
- **PR abierta:** #36, en parte: `ACTUAL()` sin argumentos y sin candidato da PENDIENTE «sin ámbito activo»; `ACTUAL(pv)` fuera de FILTRAR sigue leyendo la posición pv del anfitrión.
- **Votos:** F✓ C✓ A✓ (d).

**C36 · bql · BUSCAR no admite una dirección, y un índice nombra la colisión entera**
- **Dónde:** `src/bql.js:337-340` (solo índices 0–9) y `buscar`, l.271-278 (→ `ocupantes`, que junta todos los caminos que colisionan por ceros); `docs/BQL.md:246,310`.
- **Afirmación:** BUSCAR solo acepta números 0–9 y los convierte en dirección: devuelve la colisión entera (los propios por ceros, lo alcanzado por referencia y los escritos). Un texto de diez dígitos es un error.
- **Sonda:** desde la compra, `BUSCAR("1000000000")` → «ERROR: BUSCAR espera índices 0–9»; `BUSCAR(1)` y `BUSCAR(1, 0)` → los mismos «4 candidatos: propio f9e59d1e · propio f9e59d1e · referencia 4598f23e · escrito c70bfa6e».
- **Cita:** mapa §12 [D] l.263: «BUSCAR por dirección y por índice […]: las dos sin ambigüedad: un número es índice (camino exacto, relativo al anfitrión); un texto de diez dígitos es dirección (absoluta en el registro, nombra la colisión entera). Igual que las referencias.»
- **Propuesta:** `BUSCAR("dddddddddd")` busca la dirección, absoluta en el registro, y devuelve la colisión entera. `BUSCAR(n, …)` busca el camino exacto relativo al anfitrión: `BUSCAR(1)` ya no es `BUSCAR(1, 0)`. Corregir `docs/BQL.md:310`, que documenta lo contrario. Qué ocupantes entran en un camino exacto además del propio (los escritos anclados en esa dirección; lo que alcanza una referencia que está en ese camino): **[X] decidir VG**.
- **PR abierta:** #36 implementa la dirección. Deja el índice como «[X] decidir VG», pero el mapa ya lo decide; lo único abierto es qué ocupantes entran en el camino exacto, como dice la propia #36.
- **Votos:** F✓ C✓ A✓ (a). Primera versión: refutado (F✗ C✓ A✗, d), porque la forma del argumento era [C/PROP] en el corpus y [A]/[X] en el mapa (§2.3 l.60, §10.7 l.231, §8 l.156). La [D] de l.263 lo cierra.

### 1.2 Media

**C7 · bql · Una referencia o un evento ausente da ERROR, no PENDIENTE**
- **Dónde:** `src/bql.js:228,267`.
- **Afirmación:** un id que no existe, en REF, en una referencia BTML leída con LOCAL o en un candidato alcanzado por una referencia rota, se clasifica como ERROR. En cambio `encaje.seguir` lo marca `rota: true` sin error.
- **Sonda:** `LOCAL(1)` sobre `{ref:'ffff…'}` → «ERROR: evento desconocido: ffffffff».
- **Cita:** corpus 02 l.49: «Referencia/contexto ausente → PENDIENTE; tipo imposible → INCOMPATIBLE; ciclo irresoluble → ERROR»; corpus 03 l.46: ERROR es para «sintaxis, ciclo sin resolución, fallo grave».
- **Propuesta:** referencia desconocida o rota → PENDIENTE con su motivo. Si un prefijo ambiguo es ERROR (de forma) o PENDIENTE: **[X] decidir VG**.
- **PR abierta:** #36 en BQL (REF y referencia BTML a un evento ausente → PENDIENTE; para el prefijo ambiguo elige ERROR) y #42 en el encaje y en `descubrir` (el ocupante de una referencia ausente es PENDIENTE con su motivo).
- **Votos:** F✓ C✓ A✓ (d).

**C8 · bql · `evaluar()` no sigue la referencia de un slot y la prueba que lo afirma pasa por coincidencia**
- **Dónde:** `src/bql.js:432` frente a `leerSlot`, l.255-259; la prueba es `test/bql.test.js:80-88`.
- **Afirmación:** si el slot evaluado contiene `{ref, dir}`, `evaluar()` devuelve RESUELTO con un valor de tipo referencia y no lo sigue. La misma referencia leída con LOCAL sí se sigue. Una referencia rota sale RESUELTO por `evaluar` y ERROR por LOCAL. La prueba dice evaluar «1.0», pero evalúa `'1000000000'` (= [1], un array de tres posiciones), que coincide en tamaño con los tres platos del menú.
- **Sonda:** `evaluar(compra, [1,0])` → «→ 4598f23e» (el id del menú, sin seguir); `evaluar(x, [1])` con una referencia rota → «→ ffffffff».
- **Cita:** mapa §10.7 [A] l.230: BQL V0 «sigue referencias BTML»; corpus 02 l.49 (referencia ausente → PENDIENTE).
- **Propuesta:** que `evaluar()` lea por `leerSlot` (sigue la referencia y anota la dependencia). Reescribir la prueba para `[1,0]`, que compruebe el array del menú y `dependencias` ∋ `menu:1000000000`. Lo usan `motor.descubrir` (`motor.js:88`) y `app.js:116`.
- **PR abierta:** ninguna; en la #36, `evaluar` sigue devolviendo la referencia sin seguirla.
- **Votos:** F✓ C✓ A✓ (a). El diario tenía un voto lanzado y sin resultado.

**C9 · motor · `ejecutar` no pasa por el registro de salida**
- **Dónde:** `src/motor.js:191-193`.
- **Afirmación:** consolidar y autorizar escriben con `escribirDesde` (modo, límite de escritura y un minuto de `T:minuto` por posición). `ejecutar` llama a `eje.escribir` con un minuto fijo, sin `contexto.modo` y sin tope.
- **Sonda:** al ejecutar la compra, «{"posiciones":3,"minutos":1,"modo":null}».
- **Cita:** mapa §10.6 [A] l.223: «cada posición escrita mueve un minuto de T del autor. Proporción del modo comprobada al escribir»; mapa §10.7 [D] l.229: «proporción de escritura por modo»; mapa §12 [D] l.265: «Topes duros por modo».
- **Propuesta:** escribir la ejecución con `escribirDesde` añadiendo los movimientos reales al de T, o como mínimo `cantidad = costeT(payload)` y `contexto.modo`. Qué clase de modificación lleva la ejecución en la matriz (§12 l.267): **[X] decidir VG** (la #40 también lo deja abierto).
- **PR abierta:** #42, en parte: cobra un minuto por posición (3 en la sonda), pero sigue sin pasar por `escribirDesde`. La #40 deja el motor como en `main`.
- **Votos:** F✓ C✓ A✓ (a).

**C10 · motor · `consolidar` rellena huecos con referencias que pueden no alcanzar nada, y rechaza lo que el mapa manda anclar**
- **Dónde:** `src/motor.js:111-116` frente a `src/escritura.js:70-74`. `docs/MOTOR.md:904` lo da como límite conocido.
- **Afirmación:**
  - Un hueco se da por heredable si `ocupantes(...)` no está vacío, y eso incluye escritos ajenos y referencias rotas. Lo que se escribe es `{ref: foco, dir}`, que solo alcanza el payload del foco: si el foco no tiene esa posición, la herencia queda vacía.
  - Si no hay ocupantes, rechaza: «hueco en i».
  - `desdeMapped` usa otro criterio, el payload del foco. Hay dos criterios para la misma salida.
- **Cita:**
  - mapa §12 [D] l.265: «se escribe de 0 a 9 […] no hay huecos: no se rellena macizo, se va por las ramas a las hojas necesarias […] Sin «no aplicable». Código: ya hace «celdas sin cambio = referencia al foco» y «lo lejano = anclaje»»;
  - mapa §12 [D] l.247: la fábrica («consolidar = única fijación, que no borra»);
  - mapa §2.1 [D] l.17: «Las referencias no copian contenido».
  - La regla anterior, §10.6 [A] l.222 («si el foco tampoco tiene esa posición, es un hueco y se rechaza»), queda superada por l.265.
- **Propuesta:** un solo criterio para `consolidar` y para la escritura. Lo que el foco tiene en el camino exacto se hereda por referencia (prefijo denso); lo que no tiene se ancla en su dirección, sin rechazo y sin referencia vacía. Para heredar lo escrito por otros, la referencia va al evento escrito.
- **PR abierta:** #40 pone ese criterio en la escritura (`ubicar`: se hereda solo lo que el foco tiene y lo que no tiene base se ancla). Deja `consolidar` como está, con «si consolidar usa la misma regla» marcado [X]. Por el mapa, la regla es la del registro de salida de la fábrica y `consolidar` es su fijación (lectura mía, §7).
- **Votos:** F✓ C✓ A✓ (a).

**C11 · motor · `contexto.encaje[].vector` de una consolidación mezcla dos significados**
- **Dónde:** `src/motor.js:122` frente a l.127-130.
- **Afirmación:**
  - Si la elección es un candidato, se guarda el vector con que el candidato encajó en su búsqueda.
  - Si es una referencia explícita, se guarda `vector(origen, destino)`, es decir, el traslado.
  - El mismo campo, y en la misma consolidación, significa dos cosas.
- **Sonda:** con el mismo traslado de 4 a 1, el candidato da «exacto [0,0,0,0,0,0,0,0,0,0]» y `{ref, dir:'4000000000'}` da «[3,0,0,0,0,0,0,0,0,0]».
- **Cita:** mapa §12 [D] l.248: «la consolidación guarda los vectores de sus fuentes»; mapa §12 [D] l.257 (opción B: el signo por componente es información; la resta es candidato − buscado, l.253).
- **Propuesta:** guardar siempre el vector de la fuente tal como encajó (§12). Si se quiere también el del traslado, en otro campo con su nombre. Cuál cuenta para la época: **[X] decidir VG**.
- **PR abierta:** ninguna. La #42 reordena `consolidar` sin cambiar el campo.
- **Votos:** F✓ C✓ A✓ (a). El hallazgo del lector («siempre cero») se reformuló sobre el código.

**C12 · motor · `consolidar` fija el modo `'mapped'` sea cual sea el modo de quien consolida**
- **Dónde:** `src/motor.js:136`; `app.js:376` no pasa el modo.
- **Afirmación:** el límite se comprueba contra Mapped aunque se consolide desde Pointed o Sequenced: hoy 333 posiciones frente a 1 o 20; con los topes de §12, 1000 frente a 10 o 100. `docs/MOTOR.md:33,141` lo describe como es, pero no hay una decisión detrás.
- **Cita:** mapa §10 [D] l.179: «desde Mapped se escribe entre un tercio y un cuarto de lo leído; desde Sequenced entre un quinto y un décimo; desde Pointed un décimo»; mapa §12 [D] l.265: «Topes duros por modo: Pointed 10, Sequenced 100, Mapped 1000, Scened 10000».
- **Propuesta:** **[X] decidir VG**: o consolidar recibe el modo del usuario, o el mapa recoge que la fábrica consolida siempre como acto Mapped.
- **PR abierta:** ninguna (la #40 deja el motor como en `main`).
- **Votos:** F✓ C✓ A✓ (a).

**C13 · motor · Registrar evidencia solo conoce el éxito**
- **Dónde:** `src/motor.js:21,210-216`.
- **Afirmación:** las fases son `consolidado → autorizado → ejecutado`. No hay rechazo de quien puede autorizar (lo rechazado queda pendiente para siempre) ni desenlace de la ejecución (parcial, no ocurrido, sin confirmación). Tampoco hay recibos de terceros que la operación referencie.
- **Cita:**
  - corpus 04 l.34: «Registrar resultado diferencia éxito, rechazo, no ocurrido, ejecutado parcialmente, sin confirmación […] Una compra elegida o autorizada no equivale a una compra efectivamente hecha»;
  - mapa §2.4 [A] l.76: «recibos propios de terceros (aceptación de Bob, despacho, recepción) que la operación referencia sin apropiarse de ellos».
- **Propuesta:** **[X] decidir VG** qué parte es de AARPIA (§12 [D] l.249). Mínimo sin inventar estados: que la pantalla y `docs/MOTOR.md` digan que EJECUTADO es «ejecución declarada», no resultado material.
- **PR abierta:** ninguna. La #42 deja en skip lo que depende de esta decisión (MOT-35b, qué es un recibo).
- **Votos:** F✓ C✓ A✗ (a). Ámbito: es el hueco de AARPIA.

**C14 · motor + frontend · Lo autorizado no acota lo ejecutado, el botón ejecuta sin mover tokens y la regla provisional se presenta como regla**
- **Dónde:** `src/motor.js:183,192`; `app.js:247,379,391,398,401`.
- **Afirmación:**
  - `ejecutar` acepta cualquier movimiento, o ninguno, sin cotejarlo con lo consolidado.
  - El botón «ejecutar» no pasa movimientos (`app.js:398`), así que «pagar 14 EUR» nunca se mueve, y aun así el mensaje dice «Ejecutado … con evidencia».
  - Los textos («Autoriza quien tiene poder y no es el autor», «no tiene poder (P)», «Ahora ejecuta su autor») presentan como regla lo que VG fijó como hueco provisional.
- **Cita:**
  - corpus 04 l.33: «Ejecutar exige […] límites de gasto/tiempo/alcance y ejecutor apropiado (posiblemente AARPIA u otro)»;
  - mapa §12 [D] l.249: «AARPIA es el motor real de autorización/ejecución; lo del motor […] es un hueco provisional»;
  - mapa §12 [D] l.254 (y l.258): «Ejecutar la reserva en la fábrica = mover esos tokens de la casa al huésped; la segunda reserva solapada se escribe y colisiona pero no se ejecuta (saldo insuficiente)».
- **Propuesta:** que ejecutar mueva los tokens ya no es solo AARPIA: l.254 lo decide, y un botón que ejecuta sin moverlos lo contradice. Marcar en pantalla «regla provisional (sin AARPIA)» y, mientras no se pasen movimientos, «ejecución declarada: no mueve E/P/R». Que la consolidación declare los movimientos previstos y que ejecutar los coteje: **[X] decidir VG** (AARPIA).
- **PR abierta:** #42, en parte: la autorización declara la regla provisional en `contexto.autoridad.regla`. La app y el cotejo siguen igual.
- **Votos:** F✓ C✓ A✗ (a). Ámbito: el cotejo es de AARPIA; que ejecutar mueva lo consolidado ya no lo es (l.254).

**C15 · motor + frontend · La salida no tiene topes duros por modo ni matriz 10×10×10: la proporción hace de tope**
- **Dónde:** `src/modos.js:8-13,36-38`; `src/escritura.js:50-78,89-93`; `app.js:178,287`; `docs/MOTOR.md:181,432,449,561`.
- **Afirmación:**
  - `cabeEscritura` rechaza por encima del máximo de la proporción: Pointed 1, Sequenced 20, Mapped 333 y Scened sin límite. Sonda, `escritura(modo)`: `["pointed [1,1]","sequenced [10,20]","mapped [250,333]","scened null"]`.
  - El registro de salida de Mapped es una décupla por PV (unas 100 posiciones como mucho) y no tiene clase de modificación: no llega al tope de 1000 ni dice qué se hizo en cada celda.
  - Los formularios anuncian «de 10 a 20 posiciones de 100» y «de 250 a 333 de 1000».
- **Cita:**
  - mapa §12 [D] l.265: «Se emiten SOLO las décuplas modificadas; ver un contenido ya es una modificación […]. Topes duros por modo: Pointed 10, Sequenced 100, Mapped 1000, Scened 10000 (además de la proporción)»;
  - mapa §12 [D] l.267: «El registro de salida es la matriz 10×10×10: posición × subposición × clase de modificación […]. Una celda modificada se escribe en [i][j][k]»;
  - mapa §10 [D] l.179 («desde Sequenced entre un quinto y un décimo») frente a §10.1 [D] l.194 («Sequenced 1–2 de 100»).
- **Propuesta:** el tope duro de cada modo es el rechazo; la salida es la matriz posición × subposición × clase, con la clase en el tercer dígito y «ver» como modificación mínima. **[X] decidir VG**:
  - qué hace la proporción junto al tope, avisar o rechazar: el mapa dice «además de», no cómo;
  - qué cifra vale para Sequenced (10–20 o 1–2 de 100).
  - Hasta entonces, que los formularios digan «tope N».
- **PR abierta:** #40 pone los topes y la matriz en la escritura (`desdeMapped`, `ubicar`, `escribirSalida`) y deja la proporción como información, marcada [X]. No toca `app.js` ni el motor (C9, C12).
- **Votos:** F✓ C✓ A✓ (a).

**C17 · pv-modos-tiempo · Mapped pone los hijos (registros ya ocurridos) a la derecha, donde van las proyecciones**
- **Dónde:** `src/mapped.js:5-6,47-48,79` frente a `src/tiempo.js:35-38`.
- **Afirmación:** el sobrio de Mapped imprime `hilo ← [foco] → hijos`, mientras que `tiempo.ejeTemporal` pone los hijos ya ocurridos en el pasado. Dos fuentes de verdad para el eje 6·5·7; `app.js:275` usa la segunda.
- **Cita:** mapa §9 [D/O] l.162: «Eso es el eje 6/7: registros a la izquierda, proyecciones a la derecha».
- **Propuesta:** `mapa()` toma pasado y futuro de `ejeTemporal`, y el sobrio imprime `pasado ← [foco] → proyecciones`. Corregir la cabecera de `mapped.js`.
- **PR abierta:** ninguna.
- **Votos:** F✓ C✓ A✓ (a).

**C18 · pv-modos-tiempo + frontend · PV8 calcula al vuelo una puntuación con pesos inventados, en una sola cohorte y sin bases**
- **Dónde:** `src/tiempo.js:65-89`; `app.js:221` («entre hermanos X de N»).
- **Afirmación:**
  - `puntuacion = posiciones + 2·escritos + movimientos`, orden descendente y un puesto global. Sonda sobre la compra: «f9e59d1e 11 · posicion 1 de 1».
  - Hay una sola cohorte, los hijos del mismo padre (`eje.sobre(ev.sobre)`), sin linaje ni general, y sin ocupantes por referencia ni colisiones.
  - Se calcula en cada lectura. No hay bases escritas en el 8, ni medidas fundibles, ni histograma de diez cajas, ni fecha o frescura, ni `BASES()` en BQL.
- **Cita:**
  - mapa §12 [D] l.264: tres cohortes («hermanos = elementos similares; linaje/proyecto = dónde estoy; general = el ámbito»); «las estadísticas son REGISTROS escritos en la posición 8 del registro que resumen («bases»)»; medidas fundibles («recuentos, sumas, mín, máx e histograma de diez cajas por medida = una décupla por medida»); «el foco se sitúa en su caja en cada cohorte»; «Cortes de las cajas = regla de la época»; «Código: bases en el 8 con fundir/frescura y BASES() en BQL»;
  - mapa §12 [D] l.247: «El 8 compara ocupantes»;
  - mapa §2.2 [D20] l.54: «escala ordinal de hitos, no métrica»; mapa §2.6 [D18] l.90: «No reducir P/R/T a dinero ni a puntuación»; corpus 05 l.25: «Objetivo no es maximizar puntuación».
- **Propuesta:** quitar los pesos y la `puntuacion`. En su lugar, bases por medida con solo lo fundible y el foco en su caja, en las tres cohortes; escribirlas como registros en el 8 (la propia cosa, con su clave y su T) y leerlas con `BASES()`. Cuando lleguen, retirar `comparar()` y cambiar «entre hermanos X de N» en `app.js:221`.
- **PR abierta:** #19 (confluencia del 8) hace `confluir()` sobre ocupantes, con las tres cohortes, bases fundibles, `fundir` y la caja del foco. Deja como pendiente escribirlas en el 8 y `BASES()`, y marca sus propios [X] (composición de las cohortes, cortes en la época 0, lista de medidas).
- **Votos:** F✓ C✓ A✓ (a).

**C19 · pv-modos-tiempo · Hilos 6/7: ordenados por fecha y no por hilo, sin compresión, y lo declarado lleva una fecha inventada**
- **Dónde:** `src/tiempo.js:43-48`.
- **Afirmación:**
  - El pasado se ordena por `delta` temporal; si `ahora` precede al hilo, el orden se invierte.
  - A partir de `maximo` lo lejano se trunca en vez de comprimirse.
  - Lo declarado en 7 entra con `delta: 0, banda: 'segundo'`.
- **Cita:**
  - mapa §10 [D] l.174: «Hilos (PV6/PV7) = cadena de registros encadenados por referencia, no mera secuencia temporal»;
  - corpus 06 l.16: «PV6/7 para hilos temporales comprimidos»;
  - corpus 05 l.21: «Más detalle cerca del presente»;
  - corpus 04 l.24: «Ausencia de información = pendiente explicada, no dato inventado».
- **Propuesta:** ordenar el pasado por la posición en el hilo; agrupar por banda (detalle cerca, recuento lejos) y recortar por banda; lo declarado va «sin fecha», al final del futuro.
- **PR abierta:** ninguna.
- **Votos:** F✓ C✓ A✓ (a).

**C20 · frontend + pv-modos-tiempo · PV5 en Mapped enseña `payload[5]` y no el registro; el sobrio no muestra PV0**
- **Dónde:** `app.js:207`; `src/mapped.js:75`.
- **Afirmación:** la «estructura» construye el JSON con `payload: c.contenido` (la posición 5 del payload; en la compra no existe y se omite), ids recortados y sin firma. El sobrio de `mapped.js` pone el id en el 5 y no muestra el 0 en ninguna celda.
- **Cita:** mapa §9 [D/O] l.162-164: «En el centro queda el registro concreto en foco, el JSON que se visualiza: eso es PV5. Una lente sobre él da PV0»; mapa §2.2 [D08] l.52: matriz «1 8 2 / 6 0-5 7 / 3 9 4».
- **Propuesta:** el 5 muestra el registro tal cual (`ev` completo, con `firma`, y el subárbol si hay camino); el sobrio muestra «5 · 0» con la representación, igual que ya hace `app.js:208-209`.
- **PR abierta:** ninguna.
- **Votos:** F✓ C✓ A✓ (a).

**C21 · frontend · Las diferencias del encaje no se ven**
- **Dónde:** `app.js:119,253,379`.
- **Afirmación:** el núcleo calcula para cada ocupante el vector, la distancia, el acuerdo y el signo, y ordena por encaje. Los chips y las opciones de la fábrica solo muestran origen, id, autor y texto. Tras consolidar no se dice qué se refirió, qué se heredó y qué es nuevo.
- **Cita:** mapa §2.7 [A] l.98 y corpus 05 l.40: «La UI de PV4 muestra alternativas y diferencias […] y exhibe qué se registra, reemplaza, refiere o queda pendiente»; mapa §12 [D] l.248.
- **Propuesta:** una palabra y un número por candidato («exacto», «completar 1», acuerdo n), y el aviso de que la lista va ordenada por encaje. Después de consolidar, el desglose por posición.
- **PR abierta:** #42, en parte: cada ocupante lleva `justificacion` y `empate` en el núcleo; la app no los enseña.
- **Votos:** F✓ C✓ A✓ (a).

**C22 · frontend · No existe la operación con efecto nombrado; `app.js` pinta HTML fuera de RENDERS**
- **Dónde:** `app.js:125-155,165-185,272-294`; `src/pointed.js:39-46`; `src/mapped.js:84-90`; `src/escritura.js:102`; `src/motor.js:142`.
- **Afirmación:** ninguna transición lleva el nombre de su efecto (solo `modo` o `fase`). El sobrio que ve el usuario no es el `RENDERS.sobrio` del núcleo, así que el animado no tendría dónde enchufarse sobre las mismas transiciones.
- **Cita:** mapa §10.3 [D] l.205: «la operación semántica (transición + efecto nombrado) es una sola; sobrio y animado son dos renders de la misma operación»; mapa §10.2 [A] l.200: «cada operación del núcleo se nombra por su efecto visible […] desde el primer día»; mapa §12 [D] l.268: «Antes de animar: catálogo de efectos (celda i.j.k → efecto por mundo)».
- **Propuesta:** que la transición guarde su efecto nombrado y que `app.js` renderice a partir de la operación con funciones registradas en RENDERS. Los nombres de los efectos: **[X] decidir VG** (§10.2 da ejemplos; l.268 pide el catálogo por celda i.j.k, que no está hecho).
- **PR abierta:** ninguna.
- **Votos:** F✓ C✓ A✓ (a).

### 1.3 Leve

| # | Módulo | Dónde | Afirmación | Cita | Propuesta | PR abierta | Votos (a) |
|---|---|---|---|---|---|---|---|
| C23 | bql | `src/bql.js:201` | Entre tipos distintos, `=` compara el texto: `5 = "5"` → «verdadero»; `2 EUR = 2 min` → «falso» mientras `<` da «INCOMPATIBLE: magnitud en EUR y magnitud en min no se comparan». | corpus 03 l.44: «Antes de operar validar tipos y dimensiones»; l.46: INCOMPATIBLE (tipo, dimensión). | Tipos distintos → INCOMPATIBLE también en la igualdad. | #36 | F✓ C✓ A✓ |
| C24 | bql | `src/bql.js:369,373` | ORDENAR usa la cifra desnuda: «5 EUR, 3 min, 2 EUR» se ordenan como 5>3>2, y un «4» suelto se intercala. | corpus 03 l.44; mapa §2.3 [A] l.64. | Usar `comparar()` como comparador; lo no comparable queda señalado sin perder el resto. | #36 (INCOMPATIBLE con claves mezcladas) | F✓ C✓ A✓ |
| C25 | bql | `src/bql.js:339,438,453`; `src/btml.js:61-62` | BUSCAR con más de diez índices acumulados lanza un RangeError que escapa de `evaluar`/`consultar` (sonda: «RangeError: entre 0 y 10 índices»), contra su contrato «Siempre devuelve { estado… }». | mapa §2.1 [A] l.25: «no se concatena un undécimo dígito». | Validar anfitrión + índices ≤ 10 antes de `direccion()` y devolver un estado. Cuál: ver F1. | #36 (PENDIENTE) y #43 (ERROR): eligen estados distintos | F✓ C✓ A✓ |
| C26 | bql | `src/bql.js:138,173` | El desglose guarda `{cantidad, unidad}` sin procedencia por operando; solo hay `ctx.dependencias` por fórmula. | mapa §2.3 [A] l.64: «composición heterogénea que conserva operandos y procedencia»; corpus 03 l.44: «sin perder el desglose y las fuentes, si se pide». | Anotar el origen (`evId:dir`) en cada parte cuando venga de LOCAL, REF o ACTUAL. | — | F✓ C✓ A✓ |
| C27 | motor | `src/motor.js:55,125-130` | Elegir [4] o [4.0] (que colisionan) produce la misma consolidación: se guarda `{ref, dir}` y el camino elegido se pierde; la referencia resuelve siempre el camino corto. | mapa §12 [D] l.246: «todos son ocupantes con su camino exacto y su procedencia». | Guardar `camino` y `procedencia` del candidato en `contexto.encaje`, sin tocar el formato. | — | F✓ C✓ A✓ |
| C28 | motor | `src/motor.js:123-126` frente a l.119 | Un `{candidato}` cuyo evento no existe se consolida sin comprobarlo; un `{ref}` desconocido se rechaza. | corpus 02 l.49 (referencia ausente → PENDIENTE). | La misma comprobación para `c.evento`; no aceptar candidatos `rota`. | — | F✓ C✓ A✓ |
| C29 | eje | `src/eje.js:153-218` | `validar` devuelve una lista plana de textos: no se sabe qué capa falló y la capa 4 no aparece como «no comprobada». | mapa §2.8 [A] l.102: «PV5 inspecciona señales de las cinco»; corpus 06 l.33; corpus 04 l.24. | Errores con capa (1–5) y un estado por capa; la 4 siempre «no comprobada». Solo nombra las capas que ya existen. | — (la #42 deja la capa 4 en skip) | F✓ C✓ A✓ |
| C30 | persistencia | `src/persistencia.js:15,22` | `restaurar` toma `exigirFirmas` del propio guardado: quien edita el almacén relaja la política. | mapa §11 [A] l.241: «reconstrucción validando todo». | La política la decide quien reconstruye, `restaurar(datos, { exigirFirmas })`. | #43 la deja como [X] | F✓ C✓ A✓ |
| C31 | eje | `src/eje.js:49-50` frente a l.76-77 | `Eje.genesis` admite una clave sin firma cuando `exigirFirmas` es falso; `Eje.desde` lo rechaza siempre: ese génesis no se puede restaurar. Sonda: el génesis con clave y sin firma se crea, y `restaurar(serializar(eje))` → «firma del génesis inválida». | mapa §11 [A] l.239: «quien tiene clave firma y el eje verifica». | Si se declara clave, el génesis va firmado, con o sin `exigirFirmas`. | #43 | F✓ C✓ A✓ |
| C32 | pv | `src/tiempo.js:51,55,62` | Las etiquetas de los hitos 2 («aprendizaje avanzado») y 9 («resolución experimental») no son las decididas, y el comentario las llama «provisionales». | mapa §2.2 [D20] l.54: «2→2.1 avanzado […] 9→5.3 resolución experimental muy avanzada». | Las etiquetas literales; si hacen falta cortas, que las acorte el render. | — | F✓ C✓ A✓ |
| C33 | pv + frontend | `src/mapped.js:7`; `app.js:225` | La celda 9 muestra el rastro de navegación (índices descendidos) como «camino». | mapa §2.2 l.48: «PV9, camino o guía: secuencias, tutoriales…»; mapa §9 [D/O] l.162: «caminos de PV9: explicaciones, flujos guiados». | Llevar el rastro a la cabecera; el 9 dice «pendiente de la confluencia del 8». | — | F✓ C✓ A✓: antes A✗ porque el 8 era [X] (§11 l.242); desde §12 l.264 es [D] |
| C34 | frontend | `app.js:119,427` | El chip de un ocupante navega por `o.dir`: [1] y [1.0] llevan al mismo sitio y `o.procedencia` no se enseña. | mapa §12 [D] l.246: «camino exacto y su procedencia». | Navegar por `o.camino` y mostrar la procedencia. | — | F✓ C✓ A✓ |
| C35 | frontend | `app.js:29-33` | `payloadEnFoco` indexa sin comprobar que haya un array: una referencia más honda que su terminal pinta un carácter suelto. | mapa §2.1 [D] l.17; corpus 04 l.24: «no dato inventado». | `Array.isArray(p) ? p[i] : undefined`, con el aviso «la referencia no alcanza esa posición». | — | F✓ C✓ A✓ |

### 1.4 Resueltos en `main` desde la primera versión

- **C5 · Solo emitía el génesis; la denominación de E no iba ligada al emisor.** Lo resolvió #35: la clave es `E:<emisor>/<denominación>` y E y R las emite su emisor a sí mismo si es persona o grupo (`src/eje.js:193-203`, `src/tokens.js:110-124`). Sonda: cocina (un grupo) emite 1 R propio; el evento entra y `eje.saldo('cocina', 'R:cocina')` da 1. Antes: «evento rechazado: solo el génesis emite». Lo que queda abierto (T fuera del génesis, escalas octava a décima, fracciones, cómo firma un grupo) ya está marcado [X] en `docs/FUNDAMENTOS.md:76` y `docs/BTML.md:149`.
- **C6 · T era un solo saldo en segundos y las escalas se convertían solas.** Lo resolvió #35: un token por escala (`T:<escala>`), en enteros y sin conversión, y la app enseña cada escala por separado (`app.js:300-302`). Sonda: claves de saldo de huesped → `["E:casa/EUR","T:hora","T:minuto"]`; antes, `["T","E:EUR","P:genesis"]`.
- **C16 · `Eje.desde` aceptaba un génesis cuyos movimientos no eran emisiones a su autor.** Lo resolvió #35: `erroresGenesis` (`src/eje.js:313-331`), usado por `Eje.genesis` (l.47) y por `Eje.desde` (l.72). Sonda: un génesis con `{E, de:'mallory', a:'raiz'}` → «génesis rechazado: el génesis solo emite a su autor».

La #41 (separadores reservados en la simulación de `validar`) no cerraba ninguna ficha.

---

## 2. Refutados

Cada línea dice qué afirmaba el hallazgo, qué lentes lo refutan y por qué. Son 19: el vigésimo de la primera versión, «BUSCAR no admite una dirección», vuelve como C36.

**btml-encaje** (los ocho, votados en el diario):
- **`colisiones()` cuenta el nodo contra su posición 0** (F✗ C✗ A✗, d). §12 [D] l.246-247 retiró la convención; las colisiones por ceros son la conducta decidida.
- **La convención del cero solo se aplica a lo propio** (F✗ C✓ A✗, d). Extiende la convención retirada. Queda el resto de `test/encaje.test.js:37-39` (`void oc; void menu;`), que promete y no comprueba: es higiene de la prueba.
- **Una dirección que atraviesa una referencia devuelve vacío** (F✗ C✗ A✗, d). Corpus 02: «no concatena veinte dígitos»; corpus 03: convertir REF en anclaje «exige regla contextual distinta»; mapa §2.1 [X] l.21.
- **`validarPayload` admite más de diez profundidades** (F✗ C✓ A✗, d). El límite es de posicionamiento por foco, no de forma. Lo que falta es el cambio de foco: ver F1. La #43 deja la profundidad máxima como [X].
- **`seguir()` no distingue ausente de rota, y el tope de 20 saltos es inventado** (F✗ C✗ A✗, d). La distinción ya existe (sin `rota` / con `rota`); el presupuesto está previsto en el corpus y PENDIENTE POR LÍMITE es [X] (§11 l.242).
- **La procedencia del escrito no cita su anclaje** (F✗ C✗ A✗, d). `conEncaje` añade `destino` = `en` y el evento conserva `sobre`. Ninguna regla fija el formato.
- **`arbol()` con profundidad limitada incluye escritos más hondos** (F✗ C✓ A✗, d). Es una opción que no especifica nadie y que no usa ningún llamador; el contrato documentado incluye los escritos.
- **Comentario de `btml.js:70-75`** (F✗ C✗ A✗, d). Proponía reescribirlo con la convención retirada. Su único defecto real es llamar «punto abierto» a una colisión aceptada (§12).

**bql:**
- **Un candidato pendiente aborta la colección en FILTRAR/ORDENAR/SUMAR** (F✗ C✓ A✗, d). La política de candidatos pendientes es [X] (§2.3 l.68) y PENDIENTE POR LÍMITE no existe (§11 l.242).
- **La posición 0 de un terminal da PENDIENTE** (F✗ C✗ A✗, a). Es justo lo que manda §12 [D] l.246: «Un terminal no tiene posición 0 (PENDIENTE)».
- **Agotar el presupuesto da ERROR y no PENDIENTE POR LÍMITE** (F✗ C✓ A✗, a). El subtipo es «propuesta» (corpus 02 l.49) y está declarado inexistente (§11 l.242). Aun así, dos PR abiertas lo resuelven de forma distinta: la #36 da PENDIENTE POR LÍMITE y la #43 deja la pila agotada en ERROR (ver F7).

**motor:**
- **La validez de una autorización depende del saldo de P en el momento de leer** (F✗ C✓ A✗, a). Ninguna regla dice en qué instante cuenta P en la regla provisional; es terreno de AARPIA (§12 l.249). Queda la pregunta: **[X] decidir VG**.
- **La ejecución pone la consolidación en la posición 1 y la autorización en la 2** (F✗ C✓ A✗, a). Ninguna regla dice dónde vive la evidencia en una décupla; la propuesta (5 y 6) sería inventada.

**eje-tokens:**
- **P sin ámbito («P total»)** (F✓ C✗ A✗, a). Resuelto en #18: `tokens.js:116` exige ámbito y `eje.poderSobre` lo aplica.
- **R fungible y sin emisor** (F✓ C✗ A✗, a). Resuelto en #18: la clave es `R:emisor` y solo la mueve su emisor (`tokens.js:117-120`). La parte de «nadie más puede emitir R» la resolvió #35 (C5, §1.4).

**pv-modos-tiempo:**
- **`leerDireccion` elige el camino corto** (F✗ C✓ A✗, a). Lee los dígitos de una dirección bajo la época, no sus ocupantes; enumerar las colisiones es del encaje, que ya lo hace.
- **`banda()` pone la frontera exacta en la escala siguiente** (`banda(60)` → «hora») (F✗ C✓ A✗, a). Es fallo real del contrato interno de la función, pero ninguna regla del mapa ni del corpus fija las fronteras; queda fuera del ajuste.

**frontend:**
- **La mano escribe en 0 y 5–9** (F✗ C✓ A✗, a). §9 [D] l.162 dice «sobre todo en 1–4», no solo; limitarlo sería una regla nueva.
- **`.saldo` está definido dos veces en `index.html:106,111`** (F✗ C✓ A✗, a). Es maquetación y no ajuste a AGRAM. Es un «chirrido» real para la lista de §10.7 l.229.

---

## 3. Faltantes

Invariantes del mapa (§2, §9–§12) que ningún módulo cubre, o que se rompen entre módulos.

**F1 · El cambio de foco no existe, y el límite de diez profundidades se impone solo con una excepción**
- **Qué dice el mapa:** §2.1 [A] l.25: «Al agotar diez niveles se cambia de foco: otro objeto pasa a ser centro, con vínculo al anterior»; §2.7 [A] l.98: la navegación termina en «cambio de foco»; §7 l.144.
- **Qué hace cada módulo:**
  - `validarPayload` admite más de diez niveles.
  - `direccion()` lanza RangeError.
  - `arbol()` recorta en silencio.
  - BQL deja escapar la excepción (C25).
  - `app.irA` cambia de foco sin vínculo al anterior.
  - Hay datos admitidos que ningún módulo sabe nombrar.
- **PR abiertas:** las tres esperan la misma decisión y responden distinto. La #36 da PENDIENTE («posición sin desarrollar: más de diez profundidades»); la #43 da ERROR («más de 10 profundidades: la posición no tiene dirección») y deja la profundidad máxima del payload como [X]; la #42 deja la prueba en skip (BTML-26b).
- **[X] decidir VG:** cómo se registra el vínculo entre focos (C2-B y C2-C no se pudieron leer, mapa §6), y qué estado da una posición más honda que diez mientras tanto. Como mínimo, un estado común en todos los módulos («requiere cambio de foco») en lugar de la excepción.

**F2 · La época no atraviesa los módulos**
- **Qué dice el mapa:** §12 [D] l.247-248: «La época cambia qué ocupantes aparecen y cómo se ordenan» y «la época cambia los vectores»; §12 [D] l.257: «ni signo ni distancia ordenan hasta que una época haga ordinal una profundidad (entonces solo ahí)»; §9 [D] l.160.
- **Qué hay:**
  - El orden ya sigue la opción B: `ordenarPorEncaje` solo usa la distancia en las profundidades que la época declara ordinales (`encaje.js:79-91`), y `EPOCA_0` no declara ninguna (`epocas.js:20-26`).
  - Ningún llamador pasa una época: BQL `buscar` (`bql.js:273`), `motor.descubrir`/`proponer` (`motor.js:48,87`), `tiempo` y `app.js`.
  - `vector()` se calcula sobre los dígitos crudos (`encaje.js:26-30`) y nada filtra ocupantes por época.
- **PR abiertas:** la #42 pasa la época a `arbol()` y a `descubrir()`, solo para ordenar. La #33 propone una época 1 con `ordinal` declarado en datos. BQL sigue sin recibirla.
- **[X] decidir VG:** las reglas por dimensión (pendientes desde §12 l.252) y cómo cambia la época qué ocupantes aparecen y sus vectores. Mientras tanto, conviene que BQL y el motor reciban la época como parámetro de lectura, aunque hoy solo exista la 0.

**F3 · El vector de un ocupante por referencia compara direcciones de dos marcos**
- **Qué hace el código:** `conEncaje` toma como origen la dirección dentro del evento referido (`encaje.js:96`) y le resta la dirección del anfitrión. Una referencia sin `dir` colocada en la posición 1 sale con vector `[-1,0,…]` y acuerdo 0, así que queda detrás de los escritos ajenos. `motor.proponer` elige el primero (`motor.js:53`).
- **Sonda:** anfitrión `['h', {ref: otro}]` con un escrito ajeno anclado en 1 → «propio [0,0,0,0,0,0,0,0,0,0] acuerdo 10 · escrito [0,0,0,0,0,0,0,0,0,0] acuerdo 10 · referencia [-1,0,0,0,0,0,0,0,0,0] acuerdo 0».
- **Qué dice el corpus:** corpus 02 (Límites): «Referencias: navegar eventos/objetos no consume directamente profundidad BTML» y «Cambiar foco […] no concatena veinte dígitos».
- **[X] decidir VG:** cuál es el «origen» de un ocupante por referencia: la posición del anfitrión donde está la referencia o la del destino. La opción B (§12 l.257) fija la resta, candidato − buscado, pero no qué dirección es el candidato cuando llega por referencia.

**F4 · Lo ejecutado no vuelve a entrar en el eje del foco**
- **Qué dice el mapa:** §9 [D/O] l.162: «Ejecutar genera un registro nuevo […] y vuelve a entrar por la izquierda del eje»; §10 [D] l.175.
- **Qué hacen los módulos:**
  - `motor.ejecutar` ancla la ejecución sobre la consolidación (`motor.js:195-196`).
  - `tiempo.ejeTemporal` solo mira los hijos directos del foco (`tiempo.js:33-38`) y quita del 7 lo EJECUTADO (l.40).
- **Sonda:**
  - Antes de ejecutar, la consolidación pendiente aparece a la vez en el 6 y en el 7: «{"pasado":["registro"],"futuro":["consolidacion"]}».
  - Tras ejecutar, la ejecución no aparece ni en el 6 ni en el 7 del foco: «{"en6":false,"en7":false}».
- **[X] decidir VG:** si el 6 del foco incluye la descendencia de su fábrica, y si una consolidación pendiente es pasado, futuro o ambos.

**F5 · Varios anclajes por fragmento**
- **Qué dice el mapa:** §2.1 [A] l.23: «Un mismo fragmento puede admitir varios anclajes y generar varias posiciones plausibles».
- **Qué hay:** el evento tiene un solo `en` (`evento.js:48`, §10.4 [D] l.210), y la convención de anclaje sigue [X] (§2.1 l.21). Ningún módulo lo cubre; la #42 lo deja en skip (BTML-28b).
- **[X] decidir VG.**

**F6 · La composición ordenada de PV como operadores no tiene módulo**
- **Qué dice el mapa:** §2.2 [D04] l.50: «Aplicar un PV es volver a interrogar el resultado; el orden importa («13» no es «31»)»; §7 l.144, tercera pieza.
- **Qué hay:** solo las direcciones codifican el orden. `motor.OPERADORES` nombra Q, B y C, pero ningún módulo aplica un PV a un resultado con procedencia. La clase de modificación de la matriz (§12 l.267, «siempre estamos aplicando los puntos de vista») es un PV aplicado a una celda, pero no compone PV sobre un resultado.
- **[X] decidir VG** si entra con las reglas cortas.

**F7 · La evaluación segura está incompleta y tiene presupuestos sin relación**
- **Qué dice el mapa:** §2.4 [A] l.78: «caché y snapshot, límites de tiempo y candidatos».
- **Qué hay:** BQL tiene una pila y un presupuesto constante (`bql.js:27,293`), y el encaje un tope de 20 saltos (`encaje.js:11`). Nadie limita candidatos.
- **PR abiertas:** la #36 pone límites de presupuesto, profundidad y candidatos con PENDIENTE POR LÍMITE; la #42 añade `descubrir({ maximo })`; la #43 convierte la pila agotada en ERROR. El encaje sigue con sus 20 saltos aparte, y la #36 y la #43 no dan el mismo estado para la pila agotada.
- **[X] decidir VG:** los límites de cálculo están abiertos (§2.3 l.68).

**F8 · Documentación desfasada respecto del código o del mapa**
- `docs/MOTOR.md:166` ya está al día: #35 regeneró las salidas y el escrito encaja exacto. Sale de la lista.
- `docs/BQL.md:367` documenta `ACTUAL(1, 2)` como subposición; ver C3. La #36 lo corrige.
- `docs/BQL.md:310` dice que `BUSCAR(1)` y `BUSCAR(1, 0)` devuelven la misma colección (contra §12 l.263, ver C36), y `docs/BQL.md:318` que «a igual acuerdo, menor distancia», cuando en la época 0 la distancia no ordena (§12 l.257). La #36 corrige el orden y deja el índice como [X].
- `docs/FUNDAMENTOS.md:41` dice que «ordena la distancia» y da el signo al revés («positivo, al candidato le falta (completar)»). El código y el mapa (§12 l.253 y l.257) dicen lo contrario: positivo le sobra (reducir), y ni el signo ni la distancia ordenan en la época 0. Ninguna PR abierta lo toca.
- `src/encaje.js:24` dice «Opción B […] pendiente de que VG elija»; VG la eligió (§12 l.257). Ninguna PR abierta lo toca; la #39 lo anota.
- `docs/MOTOR.md:181,209,432,449,561` presentan la proporción como tope (333 en Mapped); ver C15. La #40 reescribe ese apartado con los topes.
- `docs/notas/SIGNO_DEL_VECTOR.md` es la nota de opciones y está bien que no decida, pero no dice que VG eligió la B (§12 l.257).
- Hay que corregirlos junto con el código, o en una PR de documentación.

---

## 4. Preguntas para VG, en una lista

1. **ACTUAL:** qué hace una cantidad mayor que 1 en un ámbito unitario, y cómo se fija la colección activa fuera de FILTRAR (C3, C4).
2. **BUSCAR:** qué ocupantes entran en el camino exacto de un índice además del propio: los escritos anclados en esa dirección, lo alcanzado por una referencia (C36).
3. **Salida de la fábrica:** si la proporción avisa o rechaza junto al tope duro, y qué cifra vale para Sequenced (C15). Si la fábrica consolida siempre como Mapped (C12). Qué clase de modificación lleva la ejecución (C9).
4. **Desenlaces:** rechazo, parcial y recibos de terceros, y qué es de AGRAM y qué de AARPIA (C13, C14). En qué instante cuenta P para autorizar (refutado en §2, pero abierto).
5. **Encaje:** qué vector guarda la consolidación (C11); el origen de un ocupante por referencia (F3); cómo cambia la época qué ocupantes aparecen y sus vectores (F2). La opción del signo ya no es pregunta: VG eligió la B (§12 l.257).
6. **Foco:** el cambio de foco y su vínculo, y qué estado da lo que pasa de diez profundidades (F1, C25); varios anclajes (F5); si el 6 del foco incluye lo ejecutado en su fábrica (F4).
7. **Otras:** si un prefijo ambiguo es ERROR o PENDIENTE (C7); los nombres de los efectos, con el catálogo i.j.k de §12 l.268 (C22); los PV como operadores (F6); los límites de cálculo (F7).

La emisión ya no está aquí: lo que sigue abierto tras #35 (T fuera del génesis, escalas octava a décima, fracciones, cómo firma un grupo) está en `docs/FUNDAMENTOS.md:76` y `docs/BTML.md:149`.

---

## 5. El §12 línea a línea contra `main`

| l. | Decisión | En `main` (`95e5396`) | Ficha | PR abierta |
|---|---|---|---|---|
| 246 | [D] Colisiones, no apaños; un terminal no tiene posición 0; ORIGEN() en BQL | Encaje y BQL la siguen; Pointed, Sequenced, Mapped, la escritura y la app no | C1, C27, C34 | #42, #40 |
| 247 | [D] Qué es una colisión; corregir es añadir; el 8 compara ocupantes; la época cambia ocupantes y orden | El eje solo añade; el 8 no compara ocupantes; la época no llega | C18, F2 | #19, #42 |
| 248 | [D] Vector de diez diferencias; la consolidación guarda los vectores de sus fuentes | Se guardan, con dos significados | C11, C21 | — |
| 249 | [D] AARPIA es el motor real; lo del motor es un hueco provisional | La regla provisional se presenta como regla | C2, C13, C14 | #42 (regla declarada) |
| 250 | [D] Idea de fondo; prueba del extranjero | Sin hallazgo de ajuste | — | #37 |
| 252, 253, 257 | [D] Signo: opción B | El código ya la sigue (`encaje.js:79-91`); dos textos no | F3, F8 | #36 (docs) |
| 254, 258 | [D] Plaza = posición con capacidad respaldada por una serie limitada de E de la casa; ejecutar = mover esos tokens | Las series y el rechazo por saldo están (#35); ejecutar no mueve lo consolidado | C14 | #21 (caso Booking) |
| 255 | [D] Las series de tokens son una constante | Hecho en #35 | C5, C6 (§1.4) | — |
| 259 | [D] Reserva anclada en la plaza (1.k), noches en su 7 | No es del núcleo: lo usa el ejemplo | — | #21 |
| 260 | [D] Poder con ámbito en un registro de dominio; reputación declarada por su emisor | Hecho en #35 (P por delegación desde el dominio; R ampliable solo por su emisor) | — | — |
| 261, 262 | [D] Titulares: las cosas tienen clave y cartera; solo personas y grupos emiten | Hecho en #35 (tipo en el alta; las cosas reciben, conservan y mueven). Cómo firma un grupo es de AARPIA ([X] en #35) | — | — |
| 263 | [D] BUSCAR por índice (camino exacto) y por dirección (colisión entera) | Solo índice, y nombra la colisión entera | C36 | #36 (dirección) |
| 264 | [D] Cohortes y bases del 8 como registros fundibles | Puntuación con pesos, una cohorte, al vuelo | C18, C33 | #19 |
| 265 | [D] Sin «no aplicable»: prefijo denso + anclaje; topes 10/100/1000/10000 | La proporción hace de tope; `consolidar` rechaza huecos | C10, C15, C12 | #40 (escritura) |
| 266, 267 | [H] → [D] Matriz 10×10×10; la clase de modificación es el tercer dígito | Sin clase; salida de una décupla por PV | C15, C9 | #40 (escritura) |
| 268 | [D] Orden de los mundos animados; catálogo de efectos i.j.k | Sin efectos nombrados | C22 | — |

§13 (l.270–272) no tiene entradas todavía: no hay decisiones de camino tomadas bajo Opus que revisar. Las lecturas mías de esta revisión van en §7.

---

## 6. PR abiertas que ya atacan hallazgos

| PR | Ataca | Qué deja |
|---|---|---|
| #36 BQL según el corpus | C3; C4 en parte; C7 (BQL); C23; C24; C25; C36 (la dirección); F7 en parte; F8 (`docs/BQL.md`) | `ACTUAL(pv)` fuera de FILTRAR sigue leyendo el anfitrión (C4); el índice como camino exacto lo marca [X], pero lo decide el mapa (C36); `evaluar` sigue sin seguir referencias (C8) |
| #40 Fábrica 10×10×10 | C15; C10 del lado de la escritura; C1 en la herencia de `desdeMapped` | El motor como en `main` (C9, C10 en `consolidar`, C12); la proporción, [X] |
| #42 BTML y motor según el corpus | C1; C7 (encaje y `descubrir`); C9 en parte (un minuto por posición); C14 en parte (regla declarada); C21 en parte (justificación en el núcleo); F2 en parte (época en `arbol` y `descubrir`); F7 en parte (`maximo`) | C2 sin tocar; la app sin el encaje; F1 y F5 en skip |
| #43 Pruebas de propiedades | C25 (ERROR en vez de excepción); C31 | C30 y la profundidad máxima (F1), [X] |
| #19 Confluencia del 8 | C18 | Escribir las bases en el 8 y `BASES()` |

**Choques entre PR abiertas** sobre los mismos hallazgos:
- **C25, F1 y F7:** para lo que pasa de diez profundidades, la #36 da PENDIENTE y la #43 da ERROR; para la pila agotada, la #36 da PENDIENTE POR LÍMITE y la #43 da ERROR «presupuesto agotado». Hay que elegir antes de fusionar las dos.
- **C1:** la #40 y la #42 reescriben `desdeMapped`. La #42 avisa de que la nueva versión no debe heredar la posición 0 de un terminal, y la revisión de la #40 ya no la hereda.

---

## 7. Lecturas mías del mapa (para §13)

El §13 pide anotar las interpretaciones tomadas mientras Core corre como Opus para que Fable las revise. Estas son las de esta revisión, marcadas [YO]:

1. **[YO] C10:** la regla de §12 l.265 (sin huecos, prefijo denso + anclaje) vale también para `consolidar`, porque es la fijación de la fábrica (l.247) y escribe su registro de salida. La #40 lo deja [X].
2. **[YO] C36:** §12 l.263 decide que el índice es camino exacto; solo queda abierto qué ocupantes entran en él. La #36 lo deja entero como [X].
3. **[YO] C14:** §12 l.254 («ejecutar […] = mover esos tokens») hace que ejecutar sin movimientos contradiga una [D], no solo el hueco de AARPIA.
4. **[YO] C18:** los hermanos son una cohorte válida (l.264). El defecto ya no es «hermanos en vez de ocupantes»: son los pesos, la cohorte única y el cálculo al vuelo en lugar de bases escritas en el 8.
