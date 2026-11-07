# Auditoría de ajuste a AGRAM

Qué parte del código se separa de lo que VG ha decidido (mapa global, §2 y §9–§12) o de lo que especifica el corpus V4, y qué invariantes no cubre ningún módulo. Es una lista para decidir y no cambia nada: esta PR no toca código.

- **Base:** `main` en `8d73b44` (tras #28, #29 y #30). Los números de línea son los de ese commit.
- **Mapa:** `MUELA/equipo/agram/MAPA_GLOBAL_AGRAM.md` (se cita «mapa §x [marca] l.N»). Las marcas de autoridad son las del mapa: [D] lo decidió VG, [A] es un acuerdo de trabajo y [X] sigue abierto.
- **Corpus:** paquete V4 (`01_NUCLEO_V4/02…06`, se cita «corpus 0N l.N»).
- **Diario:** el batallón anterior (`wf_1dcdd615-ec1`) dejó seis lectores por módulo y treinta y nueve votos de refutadores sobre trece hallazgos (más un voto lanzado y sin resultado sobre un decimocuarto) antes de pararse por cuota.

## Método

1. **Lectores.** Seis lectores, uno por módulo (btml-encaje, bql, motor-escritura, eje-tokens-autoridad, pv-modos-tiempo, frontend), dejaron 63 hallazgos. Leyeron versiones anteriores del código (`9ac8a3a`/`9f04a68`, con trabajo sin commit del vector), así que cada hallazgo se ha vuelto a comprobar sobre `8d73b44`.
2. **Tres lentes.** Cada hallazgo se mira con tres lentes:
   - **F, fidelidad:** ¿hay una regla [D] o [A], o una regla del corpus, que lo sostenga con esa fuerza?
   - **C, código:** ¿el código hace lo que dice el hallazgo?
   - **A, ámbito:** ¿está declarado pendiente ([X], §11), es terreno de AARPIA o pide inventar una regla?
3. **Regla de supervivencia.** Un hallazgo sobrevive si al menos dos de las tres lentes **no** lo refutan. En las fichas, ✓ significa «no refuta» y ✗ «refuta». La fuente del voto se marca (d) si viene del diario y (a) si viene de esta auditoría.
4. **Votos que faltaban.** El diario votó trece hallazgos completos; un decimocuarto (C8) se quedó con un voto lanzado y sin resultado. Los demás, cincuenta contando ese, se han votado aquí leyendo mapa, corpus y código y ejecutando sondas sobre `ejemplos/ikisai/compra-food.mjs`. Las salidas que se citan entre comillas son reales.
5. **Fusiones.** Cuando dos lectores encontraron lo mismo desde módulos distintos, el hallazgo se ha fundido en uno.

**Resultado:** de 63 hallazgos, 43 sobreviven (35 fichas, porque 8 se fundieron) y 20 quedan refutados. Además hay 8 faltantes, invariantes que nadie cubre o que se rompen entre módulos.

Lo que pide una decisión de VG va marcado **[X] decidir VG**. No se propone ninguna regla que no esté en el mapa o en el corpus.

---

## 1. Confirmados

### 1.1 Fondo

**C1 · pv-modos-tiempo + frontend · Un terminal sigue desarrollándose como posición 0 (convención retirada)**
- **Dónde:** `src/pointed.js:10-11,19`; `src/mapped.js:39`; `src/sequenced.js:20` (usa `decupla`); `src/escritura.js:70`; `app.js:280-281`.
- **Afirmación:** `decupla()` y `mapa()` ponen un payload terminal en la posición 0, «representación». `desdeMapped` y el formulario de Mapped ofrecen heredar esa posición 0 con `{ref: foco, dir}`. Encaje (`caminosDe`, `encaje.js:117`) y BQL (`leerPosicion`, `bql.js:231` → PENDIENTE) ya dicen lo contrario, así que el repositorio sostiene dos lecturas del mismo dato.
- **Cita:** mapa §12 [D] l.246: «Se retira la convención de la representación. […] Un terminal no tiene posición 0 (PENDIENTE).»
- **Propuesta:** en Pointed, Sequenced y Mapped, un terminal no desarrolla ninguna posición; se muestra como el nodo (cabecera o fila «nodo»), y las diez posiciones quedan sin desarrollar. Hay que quitar la herencia de la posición 0 de un terminal en `escritura.js:70` y `app.js:280` y cambiar `test/pointed.test.js` («décupla de un terminal: solo la posición 0»).
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
- **Votos:** F✓ C✓ A✓ (a).

**C3 · bql · Dentro de FILTRAR, el segundo parámetro de ACTUAL se lee como profundidad**
- **Dónde:** `src/bql.js:342` (y `indicesDeArgs`, l.285-290).
- **Afirmación:** con un candidato activo, todos los argumentos de ACTUAL bajan por el candidato.
- **Sonda:** `CONTAR(FILTRAR(BUSCAR(4), ACTUAL(1, 10) = "x"))` → «ERROR: ACTUAL espera índices 0–9».
- **Cita:**
  - mapa §2.3 [D, prompt V5] l.60: «dentro de FILTRAR lee el candidato iterado; cantidad nunca significa profundidad»;
  - corpus 03 l.21: «segundo parámetro opcional = número máximo de candidatos, por defecto 1, nunca profundidad BTML».
- **Propuesta:** dentro de FILTRAR u ORDENAR, `ACTUAL(pv)` lee la posición pv del candidato y el segundo argumento es la cantidad (1 por defecto). Corregir `docs/BQL.md:367`, que documenta la lectura prohibida. Añadir la prueba `ACTUAL(1, 1)` ≡ `ACTUAL(1)`. Qué hace una cantidad mayor que 1 en un ámbito unitario: **[X] decidir VG** (corpus 03 l.23 lo deja para V5).
- **Votos:** F✓ C✓ A✓ (d).

**C4 · bql · Fuera de FILTRAR, ACTUAL inventa un origen**
- **Dónde:** `src/bql.js:343-348`; la prueba que lo fija es `test/bql-colecciones.test.js:63-70`.
- **Afirmación:** sin colección activa, `ACTUAL(pv)` hace un BUSCAR implícito en la posición pv del anfitrión y devuelve su primer ocupante, que es el propio anfitrión. El primer parámetro cambia de sentido: deja de ser «el PV del candidato» y pasa a ser «la posición del anfitrión».
- **Sonda:** desde el slot [8] de la compra, `ACTUAL(4)` → «[2 posiciones]», lo mismo que `LOCAL(4)`.
- **Cita:**
  - corpus 03 l.21: «Fuera de iteración lee el primero de la colección activa si existe. Sin ámbito activo, no inventa un origen y queda pendiente»;
  - mapa §2.3 l.60: la colección de BUSCAR «es el ámbito de ACTUAL».
- **Propuesta:** sin colección activa, PENDIENTE «sin ámbito activo». Cómo se establece la colección activa fuera de FILTRAR (por ejemplo, el último BUSCAR de la fórmula): **[X] decidir VG**. Hay que reescribir la prueba citada.
- **Votos:** F✓ C✓ A✓ (d).

**C5 · eje-tokens · Solo emite el génesis: no hay series por su emisor ni denominación ligada al emisor**
- **Dónde:** `src/eje.js:3,136`; `src/tokens.js:35,45`.
- **Afirmación:** cualquier movimiento con `de = null` posterior al génesis se rechaza («solo el génesis emite»). `tokens.js:58` ya admite que R se emita a su propio emisor, pero el eje lo bloquea: en la práctica solo existe el R de la primera identidad. La clave de E es `E:denominacion`, sin emisor, así que unas «plazas» de dos casas serían el mismo token.
- **Sonda:** `cocina` emite 1 R propio → «evento rechazado: solo el génesis emite».
- **Cita:** mapa §12 [D] l.254 (7-11 mediodía): «Exige en la base: emisión de series por su emisor (hoy solo emite el génesis), con la denominación ligada al emisor como en R»; mapa §2.6 [A/D] l.88: «R reputación: crédito de atención específico de su emisor». La emisión en general sigue abierta (§2.6 [X] l.92).
- **Propuesta:**
  - Permitir `de = null` cuando el emisor es el autor, para R y para series E.
  - Ligar la denominación de E a su emisor, igual que `R:emisor`.
  - Reescribir «Solo el génesis emite» como regla V0 en los casos que VG no ha abierto.
  - Qué emisiones de E y P se abren más allá de las series: **[X] decidir VG**.
  - La PR #21 (Booking) no toca `eje.js` ni `tokens.js`.
- **Votos:** F✓ C✓ A✓ (a).

**C6 · eje-tokens + frontend · T es un solo saldo en segundos y las siete escalas se convierten solas (aparcado por VG)**
- **Dónde:** `src/tokens.js:8,32,40`; `src/eje.js:83-85`; `app.js:301` (se muestra «… h»).
- **Afirmación:** una hora emitida se gasta como sesenta minutos. La única clave de saldo de tiempo es `T`; la sonda sobre la compra da `["T","E:EUR","P:genesis"]`.
- **Cita:**
  - mapa §2.6 [A/D] l.88: «T tiempo: siete escalas no convertibles automáticamente»;
  - corpus 06 l.23: «siete saldos/escalas de compromisos, no reducción automática a una sola unidad de valor»;
  - mapa §12 [D] l.254: «VG recuerda que antes había varios tokens de T […] (no tocar hasta que lo diga)».
- **Propuesta:** no tocar. **[X] decidir VG** cuándo T pasa a tener un saldo por escala (`T:escala`), o a una serie limitada por la misma puerta que E. Hasta entonces, el saldo en horas de `app.js:301` debería decir que es una suma convertida.
- **Votos:** F✓ C✓ A✗ (a). VG lo ha aparcado expresamente; sobrevive como constancia, no como encargo.

### 1.2 Media

**C7 · bql · Una referencia o un evento ausente da ERROR, no PENDIENTE**
- **Dónde:** `src/bql.js:228,267`.
- **Afirmación:** un id que no existe, en REF, en una referencia BTML leída con LOCAL o en un candidato alcanzado por una referencia rota, se clasifica como ERROR. En cambio `encaje.seguir` lo marca `rota: true` sin error.
- **Sonda:** `LOCAL(1)` sobre `{ref:'ffff…'}` → «ERROR: evento desconocido: ffffffff».
- **Cita:** corpus 02 l.49: «Referencia/contexto ausente → PENDIENTE; tipo imposible → INCOMPATIBLE; ciclo irresoluble → ERROR»; corpus 03 l.46: ERROR es para «sintaxis, ciclo sin resolución, fallo grave».
- **Propuesta:** referencia desconocida o rota → PENDIENTE con su motivo. Si un prefijo ambiguo es ERROR (de forma) o PENDIENTE: **[X] decidir VG**.
- **Votos:** F✓ C✓ A✓ (d).

**C8 · bql · `evaluar()` no sigue la referencia de un slot y la prueba que lo afirma pasa por coincidencia**
- **Dónde:** `src/bql.js:432` frente a `leerSlot`, l.255-259; la prueba es `test/bql.test.js:80-88`.
- **Afirmación:** si el slot evaluado contiene `{ref, dir}`, `evaluar()` devuelve RESUELTO con un valor de tipo referencia y no lo sigue. La misma referencia leída con LOCAL sí se sigue. Una referencia rota sale RESUELTO por `evaluar` y ERROR por LOCAL. La prueba dice evaluar «1.0», pero evalúa `'1000000000'` (= [1], un array de tres posiciones), que coincide en tamaño con los tres platos del menú.
- **Sonda:** `evaluar(compra, [1,0])` → «→ 579144c6»; `evaluar(x, [1])` con una referencia rota → «→ ffffffff».
- **Cita:** mapa §10.7 [A] l.230: BQL V0 «sigue referencias BTML»; corpus 02 l.49 (referencia ausente → PENDIENTE).
- **Propuesta:** que `evaluar()` lea por `leerSlot` (sigue la referencia y anota la dependencia). Reescribir la prueba para `[1,0]`, que compruebe el array del menú y `dependencias` ∋ `menu:1000000000`. Lo usan `motor.descubrir` (`motor.js:88`) y `app.js:116`.
- **Votos:** F✓ C✓ A✓ (a). El diario tenía un voto lanzado y sin resultado.

**C9 · motor · `ejecutar` no pasa por el registro de salida**
- **Dónde:** `src/motor.js:191-193`.
- **Afirmación:** consolidar y autorizar escriben con `escribirDesde` (modo, proporción comprobada y un minuto de T por posición). `ejecutar` llama a `eje.escribir` con un minuto fijo para un payload de tres posiciones, sin `contexto.modo` y sin comprobar la proporción.
- **Cita:** mapa §10.6 [A] l.223: «cada posición escrita mueve un minuto de T del autor. Proporción del modo comprobada al escribir»; mapa §10.7 [D] l.229: «proporción de escritura por modo».
- **Propuesta:** escribir la ejecución con `escribirDesde` añadiendo los movimientos reales al de T, o como mínimo `cantidad = costeT(payload)` y `contexto.modo`.
- **Votos:** F✓ C✓ A✓ (a).

**C10 · motor · La herencia de huecos en `consolidar` acepta posiciones que el payload del foco no tiene**
- **Dónde:** `src/motor.js:113-115` frente a `src/escritura.js:70`.
- **Afirmación:** un hueco se da por heredable si `ocupantes(...)` no está vacío, y eso incluye escritos ajenos y referencias rotas. Lo que se escribe es `{ref: foco, dir}`, que solo alcanza el payload del foco: la herencia queda vacía. `desdeMapped` usa otro criterio, el payload.
- **Cita:** mapa §10.6 [A] l.222: «si el foco tampoco tiene esa posición, es un hueco y se rechaza»; mapa §2.1 [D] l.17: «Las referencias no copian contenido».
- **Propuesta:** un solo criterio, `heredable(eje, foco, camino, i)`, compartido por el motor y la escritura. Para heredar lo escrito por otros, la referencia irá al evento escrito y nunca a una posición vacía del foco.
- **Votos:** F✓ C✓ A✓ (a).

**C11 · motor · `contexto.encaje[].vector` de una consolidación mezcla dos significados**
- **Dónde:** `src/motor.js:122` frente a l.127-130.
- **Afirmación:**
  - Si la elección es un candidato, se guarda el vector con que el candidato encajó en su búsqueda.
  - Si es una referencia explícita, se guarda `vector(origen, destino)`, es decir, el traslado.
  - El mismo campo, y en la misma consolidación, significa dos cosas.
- **Sonda:** con el mismo traslado de 4 a 1, el candidato da `[0,…]` «exacto» y `{ref, dir:'4000000000'}` da `[3,0,…]`.
- **Cita:** mapa §12 [D] l.248: «la consolidación guarda los vectores de sus fuentes»; mapa §12 [A] l.253 (opción B: signo = candidato − buscado).
- **Propuesta:** guardar siempre el vector de la fuente tal como encajó (§12). Si se quiere también el del traslado, en otro campo con su nombre. Cuál cuenta para la época: **[X] decidir VG**.
- **Votos:** F✓ C✓ A✓ (a). El hallazgo del lector («siempre cero») se ha reformulado sobre el código actual.

**C12 · motor · `consolidar` fija el modo `'mapped'` sea cual sea el modo de quien consolida**
- **Dónde:** `src/motor.js:136`; `app.js:371` no pasa el modo.
- **Afirmación:** la proporción se comprueba contra Mapped (tope 333) aunque se consolide desde Pointed o Sequenced. `docs/MOTOR.md:33,141` lo describe como es, pero no hay una decisión detrás.
- **Cita:** mapa §10 [D] l.179: «desde Mapped se escribe entre un tercio y un cuarto de lo leído; desde Sequenced entre un quinto y un décimo; desde Pointed un décimo».
- **Propuesta:** **[X] decidir VG**: o consolidar recibe el modo del usuario, o el mapa recoge que la fábrica consolida siempre como acto Mapped.
- **Votos:** F✓ C✓ A✓ (a).

**C13 · motor · Registrar evidencia solo conoce el éxito**
- **Dónde:** `src/motor.js:21,210-216`.
- **Afirmación:** las fases son `consolidado → autorizado → ejecutado`. No hay rechazo de quien puede autorizar (lo rechazado queda pendiente para siempre) ni desenlace de la ejecución (parcial, no ocurrido, sin confirmación). Tampoco hay recibos de terceros que la operación referencie.
- **Cita:**
  - corpus 04 l.34: «Registrar resultado diferencia éxito, rechazo, no ocurrido, ejecutado parcialmente, sin confirmación […] Una compra elegida o autorizada no equivale a una compra efectivamente hecha»;
  - mapa §2.4 [A] l.76: «recibos propios de terceros (aceptación de Bob, despacho, recepción) que la operación referencia sin apropiarse de ellos».
- **Propuesta:** **[X] decidir VG** qué parte es de AARPIA (§12 [D] l.249). Mínimo sin inventar estados: que la pantalla y `docs/MOTOR.md` digan que EJECUTADO es «ejecución declarada», no resultado material.
- **Votos:** F✓ C✓ A✗ (a). Ámbito: es el hueco de AARPIA.

**C14 · motor + frontend · Lo autorizado no acota lo ejecutado, y la regla provisional se presenta como regla**
- **Dónde:** `src/motor.js:183,192`; `app.js:247,374,386,393,396`.
- **Afirmación:**
  - `ejecutar` acepta cualquier movimiento, o ninguno, sin cotejarlo con lo consolidado.
  - El botón «ejecutar» no pasa movimientos, así que «pagar 14 EUR» nunca se mueve, y aun así el mensaje dice «Ejecutado … con evidencia».
  - Los textos («Autoriza quien tiene poder y no es el autor», «no tiene poder (P)», «Ahora ejecuta su autor») presentan como regla lo que VG fijó como hueco provisional.
- **Cita:** corpus 04 l.33: «Ejecutar exige […] límites de gasto/tiempo/alcance y ejecutor apropiado (posiblemente AARPIA u otro)»; mapa §12 [D] l.249: «AARPIA es el motor real de autorización/ejecución; lo del motor […] es un hueco provisional».
- **Propuesta:** marcar en pantalla «regla provisional (sin AARPIA)» y «ejecución declarada: no mueve E/P/R» mientras no se pasen movimientos. Que la consolidación declare los movimientos previstos y que ejecutar los coteje: **[X] decidir VG** (AARPIA).
- **Votos:** F✓ C✓ A✗ (a).

**C15 · motor + frontend · La proporción de escritura es un rango, solo se aplica el tope, y el mapa se contradice en Sequenced**
- **Dónde:** `src/modos.js:9-11,36-38`; `app.js:178,287`.
- **Afirmación:**
  - `cabeEscritura` solo mira el máximo.
  - En Mapped, el registro de salida (una décupla por PV, como mucho unas 100 posiciones) no puede llegar ni al mínimo (250) ni al tope (333).
  - Los formularios anuncian «de 10 a 20 posiciones de 100» y «de 250 a 333 de 1000», cosa que no ocurre.
- **Cita:**
  - mapa §10 [D] l.179: «desde Sequenced entre un quinto y un décimo»;
  - frente a mapa §10.1 [D] l.194: «Sequenced 1–2 de 100; Mapped 250–333 de 1000»;
  - mapa §10.7 [D] l.229: «proporción de escritura por modo».
- **Propuesta:** **[X] decidir VG**:
  - si la proporción es un tope por registro, un rango o un presupuesto por lectura;
  - qué cifra vale para Sequenced (10–20 o 1–2 de 100).
  - Hasta entonces, que los formularios digan «hasta N».
- **Votos:** F✓ C✓ A✓ (a).

**C16 · eje-tokens · `Eje.desde` acepta un génesis cuyos movimientos no son emisiones a la primera identidad**
- **Dónde:** `src/eje.js:51-61`; `src/evento.js:69-71`.
- **Afirmación:** al reconstruir, el génesis solo pasa `validarForma` y `verificarId`. Nada exige `de = null` y `a = autor` en todos sus movimientos.
- **Sonda:** un génesis con `{E, de:'mallory', a:'raiz'}` se restaura; identidades `["raiz","mallory"]`, saldo de mallory -50.
- **Cita:** mapa §10.1 [D] l.193: «Génesis = emisión inicial de tokens a la primera identidad»; mapa §11 [A] l.241: «reconstrucción validando todo»; mapa §2.6 l.88: «declarar no prueba poseer».
- **Propuesta:** una `validarGenesis`, usada por `Eje.genesis` y por `Eje.desde`, con todo movimiento `de = null, a = autor`. Prueba en `persistencia.test.js`.
- **Votos:** F✓ C✓ A✓ (a).

**C17 · pv-modos-tiempo · Mapped pone los hijos (registros ya ocurridos) a la derecha, donde van las proyecciones**
- **Dónde:** `src/mapped.js:5-6,47-48,79` frente a `src/tiempo.js:35-38`.
- **Afirmación:** el sobrio de Mapped imprime `hilo ← [foco] → hijos`, mientras que `tiempo.ejeTemporal` pone los hijos ya ocurridos en el pasado. Dos fuentes de verdad para el eje 6·5·7; `app.js:275` usa la segunda.
- **Cita:** mapa §9 [D/O] l.162: «Eso es el eje 6/7: registros a la izquierda, proyecciones a la derecha».
- **Propuesta:** `mapa()` toma pasado y futuro de `ejeTemporal`, y el sobrio imprime `pasado ← [foco] → proyecciones`. Corregir la cabecera de `mapped.js`.
- **Votos:** F✓ C✓ A✓ (a).

**C18 · pv-modos-tiempo + frontend · PV8 ordena con una puntuación de pesos inventados y compara hermanos, no ocupantes**
- **Dónde:** `src/tiempo.js:78-88`; `app.js:221` («entre hermanos X de N»).
- **Afirmación:** `puntuacion = posiciones + 2·escritos + movimientos`, orden descendente y puesto global. La cohorte son los hijos del mismo padre (`eje.sobre(ev.sobre)`), sin `en` y sin ocupantes por referencia ni colisiones.
- **Cita:**
  - mapa §12 [D] l.247: «El 8 compara ocupantes»;
  - mapa §2.2 [D20] l.54: «escala ordinal de hitos, no métrica»;
  - mapa §2.6 [D18] l.90: «No reducir P/R/T a dinero ni a puntuación»;
  - corpus 05 l.25: «Objetivo no es maximizar puntuación».
- **Propuesta:** quitar los pesos y la `puntuacion`, y devolver las medidas crudas por comparable. Cualquier orden lo elige quien consulta (ORDENAR). La cohorte son los ocupantes de la posición. La PR #19 (confluencia del 8, abierta) construye `confluir()` sobre ocupantes; al fusionarla habría que retirar `comparar()` o sus pesos.
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
- **Votos:** F✓ C✓ A✓ (a).

**C20 · frontend + pv-modos-tiempo · PV5 en Mapped enseña `payload[5]` y no el registro; el sobrio no muestra PV0**
- **Dónde:** `app.js:207`; `src/mapped.js:75`.
- **Afirmación:** la «estructura» construye el JSON con `payload: c.contenido` (la posición 5 del payload; en la compra no existe y se omite), ids recortados y sin firma. El sobrio de `mapped.js` pone el id en el 5 y no muestra el 0 en ninguna celda.
- **Cita:** mapa §9 [D/O] l.162-164: «En el centro queda el registro concreto en foco, el JSON que se visualiza: eso es PV5. Una lente sobre él da PV0»; mapa §2.2 [D08] l.52: matriz «1 8 2 / 6 0-5 7 / 3 9 4».
- **Propuesta:** el 5 muestra el registro tal cual (`ev` completo, con `firma`, y el subárbol si hay camino); el sobrio muestra «5 · 0» con la representación, igual que ya hace `app.js:208-209`.
- **Votos:** F✓ C✓ A✓ (a).

**C21 · frontend · Las diferencias del encaje no se ven**
- **Dónde:** `app.js:119,253,374`.
- **Afirmación:** el núcleo calcula para cada ocupante el vector, la distancia, el acuerdo y el signo, y ordena por ello. Los chips y las opciones de la fábrica solo muestran origen, id, autor y texto. Tras consolidar no se dice qué se refirió, qué se heredó y qué es nuevo.
- **Cita:** mapa §2.7 [A] l.98 y corpus 05 l.40: «La UI de PV4 muestra alternativas y diferencias […] y exhibe qué se registra, reemplaza, refiere o queda pendiente»; mapa §12 [D] l.248.
- **Propuesta:** una palabra y un número por candidato («exacto», «completar 1», acuerdo n), y el aviso de que la lista va ordenada por encaje. Después de consolidar, el desglose por posición.
- **Votos:** F✓ C✓ A✓ (a).

**C22 · frontend · No existe la operación con efecto nombrado; `app.js` pinta HTML fuera de RENDERS**
- **Dónde:** `app.js:125-155,165-185,272-294`; `src/pointed.js:39-46`; `src/mapped.js:84-90`; `src/escritura.js:102`; `src/motor.js:142`.
- **Afirmación:** ninguna transición lleva el nombre de su efecto (solo `modo` o `fase`). El sobrio que ve el usuario no es el `RENDERS.sobrio` del núcleo, así que el animado no tendría dónde enchufarse sobre las mismas transiciones.
- **Cita:** mapa §10.3 [D] l.205: «la operación semántica (transición + efecto nombrado) es una sola; sobrio y animado son dos renders de la misma operación»; mapa §10.2 [A] l.200: «cada operación del núcleo se nombra por su efecto visible […] desde el primer día».
- **Propuesta:** que la transición guarde su efecto nombrado y que `app.js` renderice a partir de la operación con funciones registradas en RENDERS. Los nombres de los efectos por PV: **[X] decidir VG** (§10.2 da ejemplos, no una lista).
- **Votos:** F✓ C✓ A✓ (a).

### 1.3 Leve

| # | Módulo | Dónde | Afirmación | Cita | Propuesta | Votos (a) |
|---|---|---|---|---|---|---|
| C23 | bql | `src/bql.js:201` | Entre tipos distintos, `=` compara el texto: `5 = "5"` → «verdadero»; `2 EUR = 2 min` → «falso» mientras `<` da INCOMPATIBLE. | corpus 03 l.44: «Antes de operar validar tipos y dimensiones»; l.46: INCOMPATIBLE (tipo, dimensión). | Tipos distintos → INCOMPATIBLE también en la igualdad. | F✓ C✓ A✓ |
| C24 | bql | `src/bql.js:369,373` | ORDENAR usa la cifra desnuda: «5 EUR, 3 min, 2 EUR» se ordenan como 5>3>2, y un «4» suelto se intercala. | corpus 03 l.44; mapa §2.3 [A] l.64. | Usar `comparar()` como comparador; lo no comparable queda señalado sin perder el resto. | F✓ C✓ A✓ |
| C25 | bql | `src/bql.js:339,438,453`; `src/btml.js:61-62` | BUSCAR con más de diez índices acumulados lanza un RangeError que escapa de `evaluar`/`consultar` (sonda: «RangeError: entre 0 y 10 índices»), contra su contrato «Siempre devuelve { estado… }». | mapa §2.1 [A] l.25: «no se concatena un undécimo dígito». | Validar anfitrión + índices ≤ 10 antes de `direccion()` y devolver un estado. Cuál: ver F1. | F✓ C✓ A✓ |
| C26 | bql | `src/bql.js:138,173` | El desglose guarda `{cantidad, unidad}` sin procedencia por operando; solo hay `ctx.dependencias` por fórmula. | mapa §2.3 [A] l.64: «composición heterogénea que conserva operandos y procedencia»; corpus 03 l.44: «sin perder el desglose y las fuentes, si se pide». | Anotar el origen (`evId:dir`) en cada parte cuando venga de LOCAL, REF o ACTUAL. | F✓ C✓ A✓ |
| C27 | motor | `src/motor.js:55,125-130` | Elegir [4] o [4.0] (que colisionan) produce la misma consolidación: se guarda `{ref, dir}` y el camino elegido se pierde; la referencia resuelve siempre el camino corto. | mapa §12 [D] l.246: «todos son ocupantes con su camino exacto y su procedencia». | Guardar `camino` y `procedencia` del candidato en `contexto.encaje`, sin tocar el formato. | F✓ C✓ A✓ |
| C28 | motor | `src/motor.js:123-126` frente a l.119 | Un `{candidato}` cuyo evento no existe se consolida sin comprobarlo; un `{ref}` desconocido se rechaza. | corpus 02 l.49 (referencia ausente → PENDIENTE). | La misma comprobación para `c.evento`; no aceptar candidatos `rota`. | F✓ C✓ A✓ |
| C29 | eje | `src/eje.js:108-151` | `validar` devuelve una lista plana de textos: no se sabe qué capa falló y la capa 4 no aparece como «no comprobada». | mapa §2.8 [A] l.102: «PV5 inspecciona señales de las cinco»; corpus 06 l.33; corpus 04 l.24. | Errores con capa (1–5) y un estado por capa; la 4 siempre «no comprobada». Solo nombra las capas que ya existen. | F✓ C✓ A✓ |
| C30 | persistencia | `src/persistencia.js:12,18` | `restaurar` toma `exigirFirmas` del propio guardado: quien edita el almacén relaja la política. | mapa §11 [A] l.241: «reconstrucción validando todo». | La política la decide quien reconstruye, `restaurar(datos, { exigirFirmas })`. | F✓ C✓ A✓ |
| C31 | eje | `src/eje.js:36-37` frente a l.59 | `Eje.genesis` admite una clave sin firma cuando `exigirFirmas` es falso; `Eje.desde` lo rechaza siempre: ese génesis no se puede restaurar. | mapa §11 [A] l.239: «quien tiene clave firma y el eje verifica». | Si se declara clave, el génesis va firmado, con o sin `exigirFirmas`. | F✓ C✓ A✓ |
| C32 | pv | `src/tiempo.js:51,55,62` | Las etiquetas de los hitos 2 («aprendizaje avanzado») y 9 («resolución experimental») no son las decididas, y el comentario las llama «provisionales». | mapa §2.2 [D20] l.54: «2→2.1 avanzado […] 9→5.3 resolución experimental muy avanzada». | Las etiquetas literales; si hacen falta cortas, que las acorte el render. | F✓ C✓ A✓ |
| C33 | pv + frontend | `src/mapped.js:7`; `app.js:225` | La celda 9 muestra el rastro de navegación (índices descendidos) como «camino». | mapa §2.2 l.48: «PV9, camino o guía: secuencias, tutoriales…»; mapa §9 [D/O] l.162: «caminos de PV9: explicaciones, flujos guiados». | Llevar el rastro a la cabecera; el 9 dice «pendiente de la confluencia del 8». | F✓ C✓ A✗: el 9 depende del 8, que es [X] (§11 l.242) |
| C34 | frontend | `app.js:119,422` | El chip de un ocupante navega por `o.dir`: [1] y [1.0] llevan al mismo sitio y `o.procedencia` no se enseña. | mapa §12 [D] l.246: «camino exacto y su procedencia». | Navegar por `o.camino` y mostrar la procedencia. | F✓ C✓ A✓ |
| C35 | frontend | `app.js:29-33` | `payloadEnFoco` indexa sin comprobar que haya un array: una referencia más honda que su terminal pinta un carácter suelto. | mapa §2.1 [D] l.17; corpus 04 l.24: «no dato inventado». | `Array.isArray(p) ? p[i] : undefined`, con el aviso «la referencia no alcanza esa posición». | F✓ C✓ A✓ |

---

## 2. Refutados

Cada línea dice qué afirmaba el hallazgo, qué lentes lo refutan y por qué.

**btml-encaje** (los ocho, votados en el diario):
- **`colisiones()` cuenta el nodo contra su posición 0** (F✗ C✗ A✗, d). §12 [D] l.246-247 retiró la convención; las colisiones por ceros son la conducta decidida.
- **La convención del cero solo se aplica a lo propio** (F✗ C✓ A✗, d). Extiende la convención retirada. Queda el resto de `test/encaje.test.js:37-39` (`void oc; void menu;`), que promete y no comprueba: es higiene de la prueba.
- **Una dirección que atraviesa una referencia devuelve vacío** (F✗ C✗ A✗, d). Corpus 02: «no concatena veinte dígitos»; corpus 03: convertir REF en anclaje «exige regla contextual distinta»; mapa §2.1 [X] l.21.
- **`validarPayload` admite más de diez profundidades** (F✗ C✓ A✗, d). El límite es de posicionamiento por foco, no de forma. Lo que falta es el cambio de foco: ver F1.
- **`seguir()` no distingue ausente de rota, y el tope de 20 saltos es inventado** (F✗ C✗ A✗, d). La distinción ya existe (sin `rota` / con `rota`); el presupuesto está previsto en el corpus y PENDIENTE POR LÍMITE es [X] (§11 l.242).
- **La procedencia del escrito no cita su anclaje** (F✗ C✗ A✗, d). `conEncaje` añade `destino` = `en` y el evento conserva `sobre`. Ninguna regla fija el formato.
- **`arbol()` con profundidad limitada incluye escritos más hondos** (F✗ C✓ A✗, d). Es una opción que no especifica nadie y que no usa ningún llamador; el contrato documentado incluye los escritos.
- **Comentario de `btml.js:70-75`** (F✗ C✗ A✗, d). Proponía reescribirlo con la convención retirada. Su único defecto real es llamar «punto abierto» a una colisión aceptada (§12).

**bql:**
- **BUSCAR no admite una dirección de diez dígitos** (F✗ C✓ A✗, d). La forma del argumento es [C/PROP] en el corpus y [A]/[X] en el mapa (§2.3 l.60, §10.7 l.231). Su alcance es una pregunta abierta (§8 l.156).
- **Un candidato pendiente aborta la colección en FILTRAR/ORDENAR/SUMAR** (F✗ C✓ A✗, d). La política de candidatos pendientes es [X] (§2.3 l.68) y PENDIENTE POR LÍMITE no existe (§11 l.242).
- **La posición 0 de un terminal da PENDIENTE** (F✗ C✗ A✗, a). Es justo lo que manda §12 [D] l.246: «Un terminal no tiene posición 0 (PENDIENTE)».
- **Agotar el presupuesto da ERROR y no PENDIENTE POR LÍMITE** (F✗ C✓ A✗, a). El subtipo es «propuesta» (corpus 02 l.49) y está declarado inexistente (§11 l.242).

**motor:**
- **La validez de una autorización depende del saldo de P en el momento de leer** (F✗ C✓ A✗, a). Ninguna regla dice en qué instante cuenta P en la regla provisional; es terreno de AARPIA (§12 l.249). Queda la pregunta: **[X] decidir VG**.
- **La ejecución pone la consolidación en la posición 1 y la autorización en la 2** (F✗ C✓ A✗, a). Ninguna regla dice dónde vive la evidencia en una décupla; la propuesta (5 y 6) sería inventada.

**eje-tokens:**
- **P sin ámbito («P total»)** (F✓ C✗ A✗, a). Resuelto en #18: `tokens.js:54` exige ámbito y `eje.poderSobre` lo aplica.
- **R fungible y sin emisor** (F✓ C✗ A✗, a). Resuelto en #18: la clave es `R:emisor` y solo la mueve su emisor. La parte de «nadie más puede emitir R» sigue viva en C5.

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
- **[X] decidir VG:** cómo se registra el vínculo entre focos (C2-B y C2-C no se pudieron leer, mapa §6). Como mínimo, un estado común en todos los módulos («requiere cambio de foco») en lugar de la excepción.

**F2 · La época no atraviesa los módulos**
- **Qué dice el mapa:** §12 [D] l.247-248: «La época cambia qué ocupantes aparecen y cómo se ordenan» y «la época cambia los vectores»; §9 [D] l.160.
- **Qué hay:**
  - `ocupantes` acepta `epoca` solo para ordenar (`encaje.js:79-80,134`), y `EPOCA_0` no define `ordinal` (`epocas.js:20-26`).
  - Ningún llamador pasa una época: BQL `buscar` (`bql.js:273`), `motor.descubrir`/`proponer` (`motor.js:48,87`), `tiempo` y `app.js`.
  - `vector()` se calcula sobre los dígitos crudos (`encaje.js:26-30`) y nada filtra ocupantes por época.
- **[X] decidir VG:** las reglas por dimensión (pendientes desde §12 l.252). Mientras tanto, conviene que BQL y el motor reciban la época como parámetro de lectura, aunque hoy solo exista la 0.

**F3 · El vector de un ocupante por referencia compara direcciones de dos marcos**
- **Qué hace el código:** `conEncaje` toma como origen la dirección dentro del evento referido (`encaje.js:96`) y la resta de la dirección del anfitrión. Una referencia sin `dir` colocada en la posición 1 sale con vector `[-1,0,…]` y acuerdo 0, así que queda detrás de los escritos ajenos. `motor.proponer` elige el primero (`motor.js:53`).
- **Qué dice el corpus:** corpus 02 (Límites): «Referencias: navegar eventos/objetos no consume directamente profundidad BTML» y «Cambiar foco […] no concatena veinte dígitos».
- **[X] decidir VG:** cuál es el «origen» de un ocupante por referencia (la posición del anfitrión donde está la referencia o la del destino). Va ligado a la elección A–E del signo (§12 l.253).

**F4 · Lo ejecutado no vuelve a entrar en el eje del foco**
- **Qué dice el mapa:** §9 [D/O] l.162: «Ejecutar genera un registro nuevo […] y vuelve a entrar por la izquierda del eje»; §10 [D] l.175.
- **Qué hacen los módulos:**
  - `motor.ejecutar` ancla la ejecución sobre la consolidación (`motor.js:195-196`).
  - `tiempo.ejeTemporal` solo mira los hijos directos del foco (`tiempo.js:33-38`) y quita del 7 lo EJECUTADO (l.40).
- **Sonda:**
  - Tras ejecutar, la ejecución no aparece ni en el 6 ni en el 7 del foco.
  - Antes, la consolidación pendiente aparece a la vez en el 6 («registro») y en el 7 («consolidación»).
- **[X] decidir VG:** si el 6 del foco incluye la descendencia de su fábrica, y si una consolidación pendiente es pasado, futuro o ambos.

**F5 · Varios anclajes por fragmento**
- **Qué dice el mapa:** §2.1 [A] l.23: «Un mismo fragmento puede admitir varios anclajes y generar varias posiciones plausibles».
- **Qué hay:** el evento tiene un solo `en` (`evento.js:48`, §10.4 [D] l.210), y la convención de anclaje sigue [X] (§2.1 l.21). Ningún módulo lo cubre.
- **[X] decidir VG.**

**F6 · La composición ordenada de PV como operadores no tiene módulo**
- **Qué dice el mapa:** §2.2 [D04] l.50: «Aplicar un PV es volver a interrogar el resultado; el orden importa («13» no es «31»)»; §7 l.144, tercera pieza.
- **Qué hay:** solo las direcciones codifican el orden. `motor.OPERADORES` nombra Q, B y C, pero ningún módulo aplica un PV a un resultado con procedencia.
- **[X] decidir VG** si entra con las reglas cortas.

**F7 · La evaluación segura está incompleta y tiene dos presupuestos sin relación**
- **Qué dice el mapa:** §2.4 [A] l.78: «caché y snapshot, límites de tiempo y candidatos».
- **Qué hay:** BQL tiene una pila y un presupuesto constante (`bql.js:27,293`), y el encaje un tope de 20 saltos (`encaje.js:11`). Nadie limita candidatos.
- **[X] decidir VG:** los límites de cálculo están abiertos (§2.3 l.68).

**F8 · Documentación desfasada respecto del código**
- `docs/MOTOR.md:166` enseña un escrito con `vector [1,0,…]` y `signo "completar"`. Desde #28 un escrito anclado en la dirección buscada es encaje exacto, y un signo positivo significa «reducir».
- `docs/BQL.md:367` documenta `ACTUAL(1, 2)` como subposición; ver C3.
- Hay que corregirlos junto con el código.

---

## 4. Preguntas para VG, en una lista

1. **ACTUAL:** qué hace una cantidad mayor que 1 en un ámbito unitario, y cómo se fija la colección activa fuera de FILTRAR (C3, C4).
2. **Proporción de escritura:** si es un tope, un rango o un presupuesto, y qué cifra vale para Sequenced (C15). Si la fábrica consolida siempre como Mapped (C12).
3. **Desenlaces:** rechazo, parcial y recibos de terceros, y qué es de AGRAM y qué de AARPIA (C13, C14). En qué instante cuenta P para autorizar (refutado en §2, pero abierto).
4. **Emisión:** qué emisiones se abren además de R y de las series E por emisor (C5). T por escalas, aparcado (C6).
5. **Encaje:** qué vector guarda la consolidación (C11); el origen de un ocupante por referencia (F3); la época que filtra y ordena (F2); la opción A–E del signo (ya [X]).
6. **Foco:** el cambio de foco y su vínculo (F1); varios anclajes (F5); si el 6 del foco incluye lo ejecutado en su fábrica (F4).
