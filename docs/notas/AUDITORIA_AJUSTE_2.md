# Auditoría de ajuste a AGRAM, ronda 2

Segunda pasada sobre qué parte del código se separa de lo que VG ha decidido (mapa global) o de lo que especifica el corpus V4. La ronda 1 está en `docs/notas/AUDITORIA_AJUSTE.md`; aquí no se repiten sus hallazgos, y el §3 dice cuáles siguen. A diferencia de la ronda 1, esta PR **sí arregla** los hallazgos confirmados cuya corrección es clara y no toca una decisión. Lo que pide decidir queda marcado **[X] decidir VG**.

- **Base:** el encargo citaba `main` en `7090c8c` (556 pruebas). Esta rama parte de `03dbf34` (#55, integración 2), que ya estaba en `main` al empezar. Las sondas se rehicieron sobre `03dbf34`, y las líneas que se citan son las de ese commit salvo que se diga otra cosa. Antes de los arreglos: 666 pruebas, 585 pasan, 81 en skip. Después: 671 pruebas (cinco nuevas), 590 pasan, 0 fallan, 81 en skip.
- **Mapa:** `MUELA/equipo/agram/MAPA_GLOBAL_AGRAM.md`, leído entero en §12, §13 y §14. **El mapa cambió durante la ronda.** Al final, el §12 trae dos [D] nuevas de VG del 7-11 por la noche: la decisión 5 de §14.1 (quién emite: «emite siempre una persona», escalonado T→R→P→E, «P emitir solo por ámbito (nunca "P total")») y la decisión 6 (máximos y mínimos por modo). Algunos votos citan líneas del §14 que ya no están, como la corrección de las «cien reglas cortas de la época 0». Donde eso cambia una conclusión, la ficha lo dice (A2-05).
- **Corpus:** paquete V4 (`01_NUCLEO_V4/02…06`); se cita «corpus 0N l.N».
- **Método:** el de la ronda 1. Cada hallazgo se mira con tres lentes: **F**, fidelidad (si una regla [D] o [A], o una del corpus, lo sostiene con esa fuerza); **C**, código (si el código hace lo que se afirma); **A**, ámbito (si está declarado pendiente, es de AARPIA o pide inventar una regla). Un hallazgo sobrevive si al menos dos de las tres lentes **no** lo refutan. En los votos, ✓ significa «no refuta» y ✗ «refuta».

**Resultado.** Se votaron 48 hallazgos. Sobreviven 7 y se refutan 41. Se arreglan en código A2-01 (en parte), A2-02, A2-03, A2-04 y A2-06, con pruebas de regresión en `test/auditoria-ajuste-2.test.js`. A2-05 es solo de documentación, y A2-07 queda como [X] decidir VG.

---

## 1. Confirmados

### A2-01 · bql · `valorDe` deduce el tipo por la forma del texto: «Habitación 101» pasa a ser una magnitud y «0034» pasa a 34
- **Dónde:** `src/bql.js:194` (`RE_MAGNITUD_SLOT`) y `src/bql.js:203-207` (`valorDe`).
- **Afirmación:** `valorDe` convertía las cadenas de un slot según su forma. Cualquier «palabra número» o «número palabra» pasaba a ser una magnitud, y cualquier cadena de cifras pasaba a ser un número. Ni el mapa ni el corpus tienen esa regla, y estropea datos: los nombres con número se vuelven magnitudes y los ceros a la izquierda se pierden.
- **Evidencia:** sonda con el payload `['Habitación 101', 'x', '0034', '120', 'Mesa 4', '12 EUR']`:
  - `LOCAL(0)` → «101 Habitación»; `LOCAL(0) = "Habitación 101"` → INCOMPATIBLE;
  - `LOCAL(2)` → «34»; `LOCAL(2) = "0034"` → INCOMPATIBLE;
  - `LOCAL(3) = "120"` → INCOMPATIBLE;
  - `LOCAL(4) + LOCAL(5)` → «4 Mesa + 12 EUR».

  El corpus 03 l.9 dice: «Número literal: `120`; cadena literal: `"Yogur"`». El mapa §10.7 [A] l.230 solo dice «aritmética y magnitudes», y docs/BQL.md §3 lo presentaba como regla sin [X]. En el corpus, `04_EJEMPLOS/DECUPLA_COMPRA_ILUSTRATIVA.json` escribe el presupuesto como número JSON (`175`).
- **Propuesta:** una cadena de slot se lee como texto, con dos excepciones ya decididas: la fórmula («=») y la dirección de diez dígitos (mapa §12 [D]). El número lo da el JSON. Cómo se escribe una magnitud en BTML es una regla nueva.
- **Hecho:** `valorDe` deja de convertir las cadenas de cifras: `'0034'` y `'120'` son texto, y el número JSON `120` sigue siendo número. La lectura de magnitudes por la forma del texto se conserva, marcada **[X] decidir VG** en el código y en docs/BQL.md §3, porque los ejemplos y las pruebas la usan (`'EUR 12'`) y quitarla exige decidir antes cómo se escribe una magnitud. Prueba: `test/auditoria-ajuste-2.test.js`, A2-01.
- **Votos:** F✓ C✓ A✓.

### A2-02 · motor · Una consolidación se reconocía solo por `contexto.fase`
- **Dónde:** `src/motor.js` (`autorizar`, `ejecutar`, `estadoDe`, `consolidaciones`), `src/efectos.js:202` y `src/validez.js:426,436,494`.
- **Afirmación:** `autorizar`, `ejecutar` y `estadoDe` aceptaban como consolidación cualquier evento con `contexto.fase === 'consolidado'`, aunque no estuviera anclado en la fábrica (`en = direccion([...camino, 4])`, como ancla `consolidar`). `consolidaciones()` sí filtraba por el 4, así que el mismo registro existía para `ejecutar` y no para la fábrica del foco. La docstring de `autorizar` dice que un metadato «es una declaración… el estado se vuelve a calcular con el eje, no se fía de ella», pero de la fase sí se fiaba. No es C2 de la ronda 1, que trata el «ejecutado» escrito a mano.
- **Evidencia:** huesped escribe sobre la compra, en `'7000000000'`, el payload `'mañana'` con `{fase:'consolidado'}`. `estadoDe` → «PENDIENTE DE AUTORIZACIÓN»; la casa autoriza → «AUTORIZADO»; huesped ejecuta con 20 EUR → «EJECUTADO» y cocina pasa de 12 a 32 EUR; `consolidaciones(compra)` → 0. Citas: mapa §11 [A] l.238, «consolidar (fábrica, anclado en 4, huecos heredados por referencia, fuentes)»; corpus 04 l.28, «CONSOLIDAR EN PV4 → EJECUTAR CON AUTORIZACIÓN».
- **Hecho:** un solo criterio, `esConsolidacion(evento)`, exportado en `src/motor.js`. Exige `fase 'consolidado'`, `motor 'fabrica'` y que `en` sea una dirección cuyo último índice real es el 4, el mismo anclaje con que escribe `consolidar`. Lo usan por igual `estadoDe`, `autorizar`, `ejecutar`, `consolidaciones`, la capa del motor de `efectos.js` y las faltas de autorización y ejecución de `validez.js`. Lo que separa una consolidación de un registro hecho a mano es el anclaje: `motor:'fabrica'` también es un metadato. Documentado en docs/MOTOR.md §6. Prueba: A2-02, con el registro de la sonda (no tiene estado y no se puede autorizar ni ejecutar) y con la fase declarada a mano en el 4 sin `motor`.
- **Votos:** F✓ C✓ A✓.

### A2-03 · motor-escritura · `descubrir` daba a cada candidato que es un array el estado y el texto de su posición 0
- **Dónde:** `src/motor.js` (`caminoVisible` y `descubrir`); `app.js:268`.
- **Afirmación:** `caminoVisible` añade un 0 al camino de todo ocupante cuyo contenido es un array («su posición 0 si es un array (su representación)»), y `descubrir` evaluaba en ese camino. Eso tiene dos consecuencias. La primera: el estado del candidato es el de su PV0, así que un candidato sano con una fórmula pendiente en la 0 sale PENDIENTE. La segunda: los ocupantes [1] y [1, 0], que colisionan, salen idénticos. No es C1 ni C34 de la ronda 1.
- **Evidencia:** en la posición 1 de la compra, «propio [1] visible [1,0] RESUELTO → 4598f23e» y «propio [1,0] visible [1,0] RESUELTO → 4598f23e». El escrito `['=REF("ffffffff")', 'ensalada', …]` sale «PENDIENTE: referencia ausente del eje: ffffffff». Citas: mapa §12 [D], «Se retira la convención de la representación. […] todos son ocupantes con su camino exacto y su procedencia»; la convención retirada es la del mapa §11 l.236 («su posición 0 es su propia representación (PV0)»).
- **Hecho:** `descubrir` calcula `estado` y `texto` sobre el camino exacto (`o.camino`) y añade un campo aparte, `etiqueta`, con el texto de la posición 0 para mostrar; la etiqueta no decide el estado. La app enseña la etiqueta en el desplegable de la fábrica. Se corrigen docs/MOTOR.md §2 (la tabla, la salida del ejemplo regenerada y la lectura) y las dos pruebas que fijaban el texto de la PV0 (`test/motor.test.js:18`, `test/ejemplo-booking.test.js:168,218`, ahora sobre `etiqueta`). Prueba: A2-03.
- **Matiz de los votos:** con el camino exacto, un ERROR en la posición 1 de un array no sale en el estado del candidato, porque el array entero da RESUELTO «[N posiciones]». Qué estado debe tener un array con una posición en ERROR es la política de candidatos (mapa §2.3, «política de candidatos pendientes [X]»).
- **Votos:** F✗ C✓ A✓. La fidelidad lo refutaba porque la lectura de la época 0 nombra el 0 como «representación»; el ámbito y el código, no.

### A2-04 · motor-escritura · `item()` convertía en número un texto de diez dígitos: la dirección se perdía, y con un cero delante cambiaba
- **Dónde:** `src/escritura.js:103` (`item`; el hallazgo citaba la l.28, que es un comentario).
- **Afirmación:** `item()` convertía en `Number` todo texto que casa con `/^-?\d+(\.\d+)?$/`, también una dirección de diez dígitos. `'0400000000'` quedaba en 400000000, con nueve cifras. BQL lee al revés (`bql.js`: «un texto de diez dígitos es una dirección, no un número»), así que lo que escribía un modo no era lo que leía BQL.
- **Evidencia:** `item('0400000000')` → número 400000000; con `desdeSequenced` y `'1000000000'` en la 5, `=BUSCAR(LOCAL(5))` → «ERROR: BUSCAR espera índices 0–9», mientras `=BUSCAR("1000000000")` → «RESUELTO 1 candidato». Citas: mapa §2.1 [D] l.25, «Las direcciones explícitas son siempre cadenas de diez dígitos»; mapa §12 [D], «un texto de diez dígitos es dirección (absoluta en el registro, nombra la colisión entera)».
- **Hecho:** en `item()`, un texto de exactamente diez dígitos se queda como texto, con la misma prueba `esDireccion` que usa BQL. Documentado en docs/MOTOR.md (`item`). Prueba: A2-04, con `'0400000000'`, `'4000000000'` y `BUSCAR(LOCAL(5))` igual a `BUSCAR("1000000000")`.
- **[X] decidir VG:** un número que no se representa exacto (`String(Number(t))` distinto de `t`: `'0034'`, `'12345678901234567890'` → 12345678901234567000) se sigue convirtiendo. Queda por decidir si se conserva como texto o se rechaza; está anotado en el código.
- **Votos:** F✗ C✓ A✓. Para la fidelidad, la [D] de §12 decide la lectura en BUSCAR y no los ítems de entrada; el ámbito la aplica a toda dirección escrita (§2.1 [D] l.25).

### A2-05 · eje-tokens · «P solo lo emite el génesis» figuraba como decidido
- **Dónde:** `src/eje.js:6,207,341`; docs/FUNDAMENTOS.md:78-80; docs/BTML.md:154,240,286,1179.
- **Afirmación:** el eje rechaza toda emisión de P fuera del génesis, y el génesis solo emite P con ámbito `genesis`, que vale para todo el eje. docs/FUNDAMENTOS.md y docs/BTML.md lo contaban entre lo «Decidido [D] (VG, 7-11, mapa §12)», y sus listas [X] no lo recogían. El mapa nunca lo decidió: solo decidió la delegación («la casa escribe un registro de dominio («Alojamiento») y delega P con ese ámbito»).
- **Evidencia:** mapa §2.6 l.88, «P poder o criterio: capital de criterio acotado a un área, sin «P total»»; l.92, «Emisión, liquidación, delegación de P, defensa Sybil: abiertos [X]». Durante la votación era la pregunta 5 de §14.1.
- **Cambio en el mapa durante la ronda:** VG decidió la pregunta 5 (mapa §12 [D], 7-11 noche, «Ciclo de vida de E/P/R/T y quién emite»): «Emite siempre una persona», con emisión escalonada T→R→P→E y «P emitir solo por ámbito (nunca "P total", ni PV8 lo emite solo)». Está «Encargado a Opus (7-11 noche)». Así que lo que hace hoy el eje ya no es solo algo no decidido: es un estado de partida que una decisión posterior manda cambiar, con el encargo en marcha.
- **Hecho (solo documentación; el código no se toca, es el encargo de la decisión 5):** FUNDAMENTOS.md, BTML.md y el comentario de `src/eje.js` dicen ahora que «T y P solo se emiten en el génesis» es el estado de hoy y no la regla, citan la decisión del §12 y su encargo, y señalan que el P de ámbito `genesis` hace hoy de poder sobre todo el eje, lo que esa decisión excluye. Se quita «T fuera del génesis» de las listas [X], porque ya está decidido.
- **Votos:** F✓ C✓ A✗. Para el ámbito era la pregunta 5 de §14.1, entonces abierta; ya está decidida, así que tampoco es un pendiente sin decidir.

### A2-06 · pv-epocas-tiempo · Los cortes de las cajas son regla de la época, pero una época cargada de datos no podía llevarlos
- **Dónde:** `src/epocas.js:41-98` (`cargarEpoca`); `src/tiempo.js:385-389,406` (`confluir`).
- **Afirmación:** `confluir` y `bases.cortesDe` buscan `epoca.cortes(clave)`, pero `cargarEpoca` ni leía un campo de cortes ni exponía `cortes()`; solo se podía con un objeto hecho a mano (`test/confluencia.test.js:380`). Además, `confluir` era el único modo que no aceptaba la época por nombre: llamaba a `epoca.reglaCorta` directamente.
- **Evidencia:** `Object.keys(EPOCA_0)` sin `cortes`; `cargarEpoca({…, cortes})` descartaba el campo en silencio; `confluir(eje, compra, { epoca: 'época 1 (propuesta)' })` → «TypeError: epoca.reglaCorta is not a function». Citas: mapa §12 [D], «Cortes de las cajas = regla de la época»; mapa §14.2 (g), «cortes de caja = epoca.cortes(medida)».
- **Hecho:** `cargarEpoca` acepta `cortes: { <clave>: [nueve umbrales crecientes] }`, lo valida con la misma regla que `bases.cortesDe` y expone `epoca.cortes(clave)`, que da `undefined` si la época no los trae. `confluir` pasa la época por `epocaDe`. Documentado en docs/BTML.md (API de épocas) y en el comentario de `cortesDeCohorte`. Prueba: A2-06.
- **Lo que no se hace:** escribir en `datos/epocas/epoca-0.json` la escala provisional 1 2 3 4 6 10 16 26 42. Uno de los votos citaba una [D] de VG («la época 0 trae la escala provisional»), pero esa línea ya no está en el mapa actual, y §14.1.2 sigue preguntando «¿regla de la época 0, y cuáles?». Para qué medidas vale: **[X] decidir VG**. Hasta entonces, `src/bases.js` sigue con `CORTES_PROVISIONALES`, de origen `'provisional'`.
- **Votos:** F✓ C✓ A✓.

### A2-07 · casos · Booking: los tokens de plaza se quedan en la casa y la habitación no es titular
- **Dónde:** `ejemplos/ikisai/reserva-booking.mjs:219` (`abrirTemporada`: `de: null, a: CASA`), l.95-97 (`libres`, saldo de la casa) y l.342-355 (la entrega la consolida y ejecuta la casa); docs/MOTOR.md §5.1.
- **Afirmación:** la habitación es solo un registro, no una identidad: `eje.identidades()` da `[casa, recepcion, huesped]`. La cabecera del caso solo cita la decisión de mediodía.
- **Evidencia:** mapa §12 [D], «Corrección de VG sobre titulares (7-11 tarde)»: «una persona emite los tokens de plaza de una habitación y se los da a la habitación; la habitación los conserva y los maneja». El mismo §12, en la [D] «Capacidad y tokens casan» (mediodía), dice: «Ejecutar la reserva en la fábrica = mover esos tokens de la casa al huésped». docs/notas/PRUEBA_DEL_EXTRANJERO.md ya lo anotaba: «la de la habitación es la más cercana a lo último decidido».
- **Por qué no se arregla aquí:** las dos [D] chocan en el ejemplo, y cambiarlo obliga a decidir cómo se liga el registro de la habitación con la identidad (una cosa) titular de sus plazas, y quién consolida y ejecuta la entrega en su nombre. Además movería los ids deterministas que citan los documentos.
- **Hecho:** queda **[X] decidir VG** en la cabecera de `reserva-booking.mjs` y en docs/MOTOR.md §5.1, con las dos citas y lo que haría falta. Si VG elige la habitación, la casa emitiría la serie y la movería a la habitación en el mismo evento (docs/FUNDAMENTOS.md: «para darla se mueve después, en el mismo evento si quiere»).
- **Votos:** F✗ C✓ A✓.

---

## 2. Refutados

Una línea por hallazgo, con sus votos (F, C, A) y el motivo que pesa.

**btml-encaje**
- **Una referencia lee solo el camino corto de su dirección** (F✗ C✓ A✗). «Igual que las referencias» en la [D] de BUSCAR resume cómo funcionan ya las referencias; no manda nada sobre ellas. Qué valor da una referencia con varios ocupantes es [X], y la lectura corta ya salió en C27.
- **Una referencia que no alcanza nada sale como «alcanzado», sin PENDIENTE** (F✗ C✓ A✗). La política de candidatos pendientes y PENDIENTE POR LÍMITE son [X] (mapa §2.3); la ronda 1 ya refutó «`seguir()` no distingue ausente de rota». Queda una imprecisión en docs/BTML.md (`contenido` también es undefined sin `rota`).
- **Una referencia escrita por otro no se sigue** (F✗ C✓ A✗). Ninguna [D] dice desde qué ocupante se alcanza por referencia. La composición de anclaje y referencia va a V5 (corpus 02 l.57).
- **Cualquier cadena vale como `ref`** (F✗ C✓ A✗). La forma del id es de AARPIA/Nostr. Exigir 64 hexadecimales sería una regla nueva, y el prefijo ambiguo ya es [X] desde C7.

**bql**
- **Una fórmula escrita como escrito terminal no tiene anfitrión** (F✗ C✓ A✗). El anfitrión lo da la anidación (corpus 03 l.5). Componer el foco con `en` es T3 de REGLAS_LARGAS, [X].
- **Una referencia propia da el mismo dato en dos candidatos y SUMAR lo cuenta dos veces** (F✗ C✓ A✗). Dos candidatos es lo decidido (§12 [D]). Qué valor lleva el propio que es referencia no lo fija ninguna [D]; el propio hallazgo lo deja en [X].
- **Un candidato INCOMPATIBLE oculta a otro PENDIENTE** (F✗ C✓ A✗). Es la política de candidatos pendientes, que es [X] (§2.3; docs/REGLAS_CORTAS.md, duda 10). La cita del corpus 04 l.40 está en una sección [C/PROP].
- **REF resuelve el prefijo al leer** (F✗ C✓ A✗). El prefijo está documentado (docs/BQL.md §5), el prefijo ambiguo es [X] (C7) y lo de `puedeLeer` es de AARPIA.
- **DESPLAZAMIENTO() suma distancias de dígitos nominales** (F✗ C✗ A✗). La [D] de la opción B regula el orden por defecto, y si DESPLAZAMIENTO() se queda como consulta es T5 de SIGNO_DEL_VECTOR, [X].
- **Con el límite agotado, `parcial` dice que se examinaron menos** (F✗ C✗ A✗). La cifra cumple la definición de docs/BQL.md §9.3, y la forma de `parcial` es [X].
- **`dependencias` no recoge BUSCAR** (F✗ C✓ A✗). Es una exclusión declarada, y el recálculo no existe. Solo es cierto un detalle: docs/BQL.md §9.5 cita como del corpus una frase que no está en él (lo más cercano es corpus 04 l.40, «Retener diferencias y procedencia para auditoría»).
- **ELEGIR sin candidatos da RESUELTO** (F✗ C✓ A✗). Está documentado (docs/BQL.md §7.8, «sobre una colección vacía, `0 candidatos`»); la firma de ELEGIR es S-22/O-31, [X]; el motor ya da pendiente «sin candidatos» en `proponer`.
- **ORIGEN() no distingue la colisión por ceros** (F✗ C✓ A✗). La [D] no fija los valores de ORIGEN(). Leer la procedencia desde BQL está declarado pendiente (docs/BQL.md §11).

**motor-escritura**
- **Lo consolidado no queda fijado: una fórmula se reevalúa** (F✗ C✓ A✗). «Consolidar = única fijación» fija la elección, no el valor. Caché y snapshot están declarados pendientes (MOT-65c, E-14), y quién ocupa una posición ajena es §14.1.3.
- **`proponer` convierte un empate en una elección por llegada** (F✗ C✓ A✗). «Empates por llegada» es la [D] del orden; cuándo pedir selección es MOT-12, [X].
- **Un ocupante válido sin tramo cuenta como «todo el tiempo»** (F✗ C✓ A✗). Está dentro de la viñeta «Tramo ([X] decidir VG)» de docs/MOTOR.md, y la ocupación solo informa.
- **`tramoDe` hace mandar al primer tramo por llegada** (F✗ C✓ A✗). Que gane la última corrección es §14.1.4 y docs/BQL.md, [X].
- **Heredar la posición 0 de un foco array referencia el nodo entero** (F✗ C✗ A✗). Es la colisión decidida (§12 [D]), y docs/MOTOR.md §7.2 ya la marca [X].
- **Mapped borra las líneas vacías de una celda** (F✗ C✗ A✗). Una línea no es una subposición, y la subposición se fija con la marca «@:j.k», que es [X].
- **`proponer` consolida importes redondeados a milésimas** (F✗ C✓ A✗). Es una cara de docs/MOTOR.md §13.16, que ya está declarado. Matiz que hay que añadir allí: el texto consolidado también redondea.

**eje-tokens**
- **Un génesis sin tipo emite y deja sus series sin poder ampliarse** (F✗ C✓ A✗). El génesis es «por convención, fuera del sistema» (§10.1 [D]); los tipos son §14.1.8.
- **El alta sin tipo no tiene vuelta** (F✗ C✓ A✗). Ninguna [D] obliga a declarar el tipo; está documentado y probado.
- **El eje deja modificar en sitio saldos, claves y orden** (F✗ C✓ A✗). «No existe modificar en sitio» trata de ocupantes, no de cómo se encapsula en JavaScript; los campos públicos están documentados (docs/BTML.md).
- **Con `exigirFirmas`, un alta sin clave crea una identidad muda** (F✗ C✓ A✗). Las altas y las firmas son G1–G3 de CAPAS_DE_VALIDEZ, [X], y terreno de AARPIA.
- **Delegar P crea saldos que `series()` no conoce** (F✗ C✗ A✗). `series()` lista emisiones, y el id del génesis como ámbito ya es [X] en docs/BTML.md.
- **Persistencia local: `guardarLocal` dice que guardó sin almacenamiento; `apartarLocal` pisa lo apartado** (F✗ C✓ A✗). (a) ya está en docs/MOTOR.md §13.8; el almacenamiento local es una comodidad.

**pv-epocas-tiempo**
- **La época 1 (propuesta) fija la clase en la profundidad 2 absoluta** (F✗ C✓ A✗). La época 1 propuesta se rehace (§14, [D] «Época 1», «Pendiente: rehacer datos/epocas/epoca-1-propuesta.json»).
- **El eje temporal decide pasado o proyección por la `t` declarada** (F✗ C✓ A✗). Las proyecciones reales en PV7 y la comprobación de `t` están declaradas pendientes (docs/MOTOR.md §12); C19 ya pedía el orden por hilo.
- **Mapped calcula un 8 propio** (F✗ C✓ A✗). Una sola verdad del 8 es §14.2 [H] y §14.1.7; retirar comparar() es C18.
- **La caja del foco no se liga a su hito** (F✗ C✗ A✗). `bases.situar()` ya devuelve `hito: HITOS[k]`.
- **Mapped lee con el tope de Sequenced** (F✗ C✓ A✗). La lectura por modo no estaba decidida durante el voto. Ahora la decide §12 [D] (decisión 6: máximos y mínimos por modo, «iguales para representar y para emitir»), con encargo propio a `src/modos.js`.
- **La época 0 da significado a profundidades que no existen** (F✗ C✓ A✗). «Todas las profundidades» es la [D] de §10.4; el resto es F1.
- **La época 1 dice usar el respaldo en 3–9 pero escribe setenta reglas** (F✗ C✗ A✗). Hace lo que dicen sus principios, y la época 1 se rehace.
- **`decupla()` etiqueta con la regla de una profundidad sin saber qué nodo lee** (F✗ C✓ A✗). La app le pasa el payload y la profundidad ya emparejados, y no hay regla sobre su firma.

**casos**
- **Food: la compra se cobra al escribirla y el ciclo la vuelve a cobrar** (F✗ C✓ A✗). «Consolidar no es ejecutar» no prohíbe un pago directo, y el ciclo de docs/MOTOR.md es un ejemplo con datos inventados.
- **Booking: el importe lo fija la fórmula de quien paga** (F✗ C✓ A✗). Cotejar es del ejecutor o de la autorización (corpus 04 l.33; §12 [D] AARPIA); está cerca de C14.
- **Los casos escriben sin modo** (F✗ C✓ A✗). Los topes son para escribir desde un modo, y el minuto por posición es [A] de cartón piedra.
- **Tasks: la fecha límite es un registro con una `t` inventada** (F✗ C✗ A✗). `t` es «declarado por el autor» (docs/BTML.md §1.1), y PV7 está declarado pendiente.
- **Booking ordena las subposiciones de 1 por orden y no por PV** (F✗ C✓ A✗). Ya está preguntado en PRUEBA_DEL_EXTRANJERO §5.2.1, [X].
- **Tasks: la elección vive en el 9 y su [X] solo la compara con el 1** (F✗ C✓ A✗). Está declarado [X] en el propio caso; las lecturas del 2 y del 4 son [A] o ejemplos ilustrativos.
- **Dos comentarios de los casos conservan la convención de ceros retirada** (F✗ C✗ A✗). «El mismo lugar» es la colisión decidida (src/encaje.js lo dice igual).

---

## 3. Lo que sigue de la ronda 1

Comprobado sobre `03dbf34` con sondas y leyendo el código. «Sigue» quiere decir que el código hace lo mismo que describía la ficha; las propuestas y los [X] de la ronda 1 no cambian.

| Ficha | Estado | Cómo se comprobó |
|---|---|---|
| C1 terminal como posición 0 | Resuelto | `pointed.decupla(génesis)` da `terminal: "Casa de ejemplo"` y ninguna posición 0; `mapped.mapa` igual. Queda la herencia de la raíz de un foco terminal (`app.js:296`, `desdeMapped`), marcada [X] por §13. |
| C2 EJECUTADO sin autorización | **Sigue** | Sonda: el autor escribe `{fase:'ejecutado'}` a mano en la fábrica → `estadoDe` «EJECUTADO». `validez.js` lo señala como falla (`faltasDeEjecucion`), pero `motor.estadoDe` no. |
| C3 segundo parámetro de ACTUAL en FILTRAR | Resuelto | `ACTUAL(1, 10)` dentro de FILTRAR → «PENDIENTE: … la cantidad mayor que 1 en un ámbito de un solo candidato no está definida». |
| C4 ACTUAL fuera de FILTRAR inventa un origen | **Sigue** | Desde [8], `ACTUAL(4)` → «[2 posiciones]», lo mismo que `LOCAL(4)`. `ACTUAL()` sin argumentos sí da «sin ámbito activo». |
| C36 BUSCAR por dirección y por índice | Resuelto | `BUSCAR("1000000000")` → 4 candidatos; `BUSCAR(1)` y `BUSCAR(1, 0)` dan colecciones distintas. |
| C7 referencia ausente = ERROR | Resuelto | `LOCAL(1)` sobre `{ref:'ffff…'}` → «PENDIENTE: evento ausente del eje». |
| C8 `evaluar` no sigue la referencia de un slot | **Sigue** | `evaluar(compra, [1,0])` → «→ 4598f23e». docs/MOTOR.md §2 lo describe como diseño. |
| C9 `ejecutar` no pasa por el registro de salida | **Sigue** | La ejecución no lleva `contexto.modo`; docs/MOTOR.md §4 lo declara («directamente con `eje.escribir`»). |
| C10 huecos de `consolidar` | **Sigue** | Rechaza el hueco sin ocupantes, ahora con [X] en el código. |
| C11 `encaje[].vector` mezcla dos significados | **Sigue** | Sin cambios en `contenido()` de `consolidar`. |
| C12 `consolidar` fija el modo `'mapped'` | **Sigue** | `contexto.modo` = `mapped` siempre. |
| C13 la evidencia solo conoce el éxito | **Sigue** | `FASES` = consolidado, autorizado, ejecutado. |
| C14 lo autorizado no acota lo ejecutado | **Sigue** | `ejecutar` acepta cualquier `movimientos`; ver también el refutado «Booking: el importe…». |
| C15 topes duros y matriz 10×10×10 | Resuelto | `src/modos.js` (topes 10/100/1000/10000) y `escribirSalida`; la proporción sigue [X]. La [D] de la decisión 6 (mínimos por modo) es trabajo nuevo, ya encargado. |
| C17 Mapped pone los hijos a la derecha | **Sigue** | `mapped.js:46-47`: hilo e hijos sin cambios. |
| C18 PV8 con pesos inventados | **Sigue** | `tiempo.comparar()` sigue en `app.js:292`; §14.2 lo retira. |
| C19 hilos 6/7 ordenados por fecha | **Sigue** | `tiempo.js:40-52`: orden por `delta`; lo declarado lleva la `t` del foco. |
| C20 PV5 en Mapped | Resuelto | La celda 5 enseña el registro (id, autor, firmante, sobre, en, t, movimientos, contexto) y la lente, el PV0. |
| C21 las diferencias del encaje no se ven | Resuelto | `ui/encaje.js` enseña acuerdo, signo, vector y procedencia. |
| C22 operación con efecto nombrado | En parte | `src/efectos.js` y `datos/efectos.js` (catálogo) y el render animado de los hilos (#55); falta el resto de mundos. |
| C23 `=` entre tipos distintos | Resuelto | `5 = "5"` → INCOMPATIBLE. |
| C24 ORDENAR con la cifra desnuda | Resuelto | Las claves mezcladas dan INCOMPATIBLE. |
| C25 RangeError con más de diez índices | Resuelto | → «PENDIENTE: posición sin desarrollar: más de diez profundidades» (§13, revisar como Fable). |
| C26 el desglose sin procedencia | **Sigue** | `mag()` guarda `{cantidad, unidad}`. |
| C27 [4] y [4.0] dan la misma consolidación | **Sigue** | `contexto.encaje` no guarda el camino. |
| C28 candidato con evento inexistente | **Sigue** | `consolidar` no comprueba `c.evento`. |
| C29 `validar` sin capas | En parte | `src/validez.js` da las cinco capas; `eje.validar` sigue devolviendo una lista plana. |
| C30 `restaurar` toma `exigirFirmas` del guardado | **Sigue** | `persistencia.js:22`: `exigirFirmas: Boolean(datos.exigirFirmas)`. |
| C31 génesis con clave y sin firma | Resuelto | `Eje.genesis` aplica `erroresFirmaGenesis`, como `Eje.desde`. |
| C32 etiquetas de los hitos | Resuelto | `HITOS`: «2.1 avanzado», «5.3 resolución experimental muy avanzada». |
| C33 la celda 9 muestra el rastro | En parte | Sigue el rastro, ahora con una guía de las consolidaciones pendientes. |
| C34 el chip navega por `o.dir` | En parte | La procedencia ya se ve (`ui/encaje.js:67`); la navegación sigue por `o.dir` (l.62). |
| C35 `payloadEnFoco` sin comprobar el array | **Sigue** | `app.js:40-44`. |
| F1 cambio de foco | Sigue | Sin módulo; BQL da PENDIENTE pasado el décimo nivel, y Mapped y `ejeTemporal` lanzan RangeError. |
| F2 la época no atraviesa los módulos | En parte | `epocaDe` en Pointed, Sequenced, Mapped, Scened y, con A2-06, `confluir`; BQL y el vector siguen sin época. |
| F3–F7 | Siguen | Abiertos en el mapa (§2, §11 [X], §14); no se volvieron a sondear. |
| F8 documentación desfasada | En parte | docs/FUNDAMENTOS.md y `src/encaje.js` ya recogen la opción B; docs/notas/SIGNO_DEL_VECTOR.md sigue sin decir que VG eligió la B. |

---

## 4. Preguntas para VG que deja esta ronda

1. **Magnitudes en BTML** (A2-01): ¿cómo se escribe una magnitud en un slot: la cadena «12 EUR», un par u otra forma? Hasta que se decida, la lectura por la forma del texto sigue en el código, marcada [X].
2. **Números de entrada no exactos** (A2-04): ¿«0034» o «12345678901234567890» escritos desde un modo se conservan como texto o se rechazan?
3. **Cortes de la época 0** (A2-06): ¿la escala 1 2 3 4 6 10 16 26 42 va en los datos de la época 0, y para qué medidas?
4. **Titular de las plazas en Booking** (A2-07): ¿la serie de plazas vive en la habitación (corrección de titulares, 7-11 tarde) o en la casa (mediodía)? Si es en la habitación, ¿cómo se liga el registro de la habitación con la identidad (una cosa) y quién consolida y ejecuta la entrega en su nombre?
5. **Estado de un array con una posición en ERROR** (A2-03, matiz): entra en la política de candidatos (mapa §2.3, [X]).
