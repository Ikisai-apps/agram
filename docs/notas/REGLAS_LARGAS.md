# Reglas largas

Nota de lectura para VG · 7-11-2026 · **No decide nada.** Recoge lo que dice el corpus (citas literales con archivo y línea), lo que hoy hace el código de `main` y las opciones abiertas. Base: las dos lecturas y el juez del batallón anterior, comprobados de nuevo contra el corpus, contra el MAPA en su estado de esta tarde (§12, decisiones de VG del 7-11) y contra el código (`main` en `8d73b44`, 101 pruebas en verde). Lo que es deducción del asistente va marcado como tal; los significados de ejemplo («precio», «lo que entrega la otra parte») son ilustraciones, no reglas.

Rutas abreviadas: `agx/` = raíz del paquete del corpus V4 (copia local de trabajo); `V2/` = `agx/80_HERENCIA_V3_INTEGRA/80_V2_INTEGRO/`; `V3/` = `agx/80_HERENCIA_V3_INTEGRA/`; `MAPA` = `MUELA/equipo/agram/MAPA_GLOBAL_AGRAM.md` (fuera de este repositorio); `06_EPOCAS` = `agx/01_NUCLEO_V4/06_EPOCAS_TIEMPO_EPRT_Y_FRONTERAS.md`; `02_BTML` = `agx/01_NUCLEO_V4/02_BTML_ESTRUCTURA_POSICIONES_Y_CEROS.md`.

## 1. La cuestión en tres frases

1. Desde V2 el corpus distingue la **regla corta** (por profundidad: diez significados exhaustivos para los dígitos 0–9) de la **regla larga** (por ruta o prefijo: parcial, dispersa, capaz de significado emergente y coherente con las cortas), pero no da ni un solo ejemplo de regla larga ni un formato.
2. VG decidió que de momento valen las diez reglas de la época 0 en todas las profundidades y que la época está fuera del dato; el código tiene solo `EPOCA_0.reglaCorta` y, desde la PR #29, un gancho `ordinal(profundidad)` en el encaje; la PR #33 (abierta) propone épocas en datos y una época 1 de cortas, sin largas.
3. Queda por decidir si las largas entran ya y cómo: dónde se declaran, con qué clave, qué pasa con dos largas para la misma ruta, si tocan el encaje (en particular si una larga puede declarar ordinal un prefijo) y cómo participan en la confluencia de épocas.

## 2. Lo que dice el corpus

### 2.1 Qué es una regla larga (V2 → V4, sin cambios de fondo)

- `V2/01_NUCLEO/02_BTML_ESTRUCTURA_Y_PREGUNTAS.md` l.30: «**Corta:** diez reglas explícitas/exhaustivas para los dígitos `0` a `9` **en una profundidad dada**. Ejemplo: a profundidad 1, qué significa leer `3` como segundo dígito, con independencia del prefijo completo.»
- Ídem l.32: «**Larga:** especialización contextual de una ruta como `03`, `31` o rutas más profundas. Puede **generar significado emergente** que no está expresado aisladamente en sus dígitos, siempre que sea **coherente con las reglas cortas** pertinentes. No es una clasificación exhaustiva de cada una de las `10^n` rutas.»
- Ídem l.34: «Una regla larga no puede contradecir sin más las reglas cortas que la hacen interpretable. Puede haber varias especializaciones contextualizadas si su diferencia queda expresa.»
- `V2/02_CONTEXTO/04_EPOCAS_GOBERNANZA_Y_TIEMPO.md` l.15: «En cada profundidad existe una gramática **corta**, formada por diez significados exhaustivamente establecidos para los dígitos 0–9. Una gramática **larga** puede especializar rutas completas, aportar significados emergentes compatibles y mantenerse parcial/dispersa.» Y l.19: «Especificaciones largas compatibles pueden generar significado nuevo sin limitarse a concatenar definiciones previas. La formalización exacta del fallback entre reglas cortas de épocas distintas todavía no está cerrada.»
- `V2/01_NUCLEO/04_CORRECCIONES_DE_ESTA_CONVERSACION.md` l.23 (corrección 19): «En cada profundidad, diez definiciones **cortas** exhaustivas para dígitos 0–9; interpretaciones **largas** de rutas específicas solo cuando son útiles, coherentes con las cortas y capaces de **generar significado nuevo**. No confundir con definición exhaustiva de `10^n` rutas.»
- `V3/01_NUCLEO/03_BTML_ESTRUCTURA_EPOCAS_Y_OPERACIONES_ABIERTAS.md` l.38: «**Larga:** especialización de rutas/prefijos (`00`, `01`, ... `99`, etc.) **parcial/dispersa** que puede introducir contenido emergente si **refina y no contradice arbitrariamente** las cortas. No debe enumerar todo el espacio combinatorio ni limitarse a suma trivial.»
- `V3/03_TRANSICION/ESPECIFICACION_EXPLORATORIA_V3_INTEGRA.md` l.528: «**Regla larga**: especifica/refina **rutas completas o prefijos contextualizados**, como 00, 01, ..., 99; puede ser parcial/dispersa y debe mantener compatibilidad con la interpretación corta, **sin reinterpretaciones caprichosas**.» Y l.624, guardarraíl 14: «**No canonizar reglas largas incompatibles con las cortas**, ni borrar las 100 reglas cortas potencialmente definibles desde el inicio.»
- `06_EPOCAS` l.9 (V4): «**Regla larga:** definición de rutas/prefijos completos que refina de modo coherente las cortas; parcial y dispersa, no exige enumerar `10^10` rutas. Puede especializar construcciones y aportar significado emergente, no contradicción arbitraria.»
- `agx/01_NUCLEO_V4/01_MODELO_INTEGRADO_V1_A_V4.md` l.43: «Una regla corta de época ≠ una composición larga contextual ≠ implementación ejecutable verificable de alguna regla.» Y `06_EPOCAS` l.11: «Implementaciones verificables JS/Rust u otras, referenciadas por hashes, son **implementaciones sustituibles**, no identidad semántica automática de la regla. Hashes no dan permiso para ejecutar código remoto sin política.»
- `02_BTML` l.7: «El significado del dígito depende de la regla corta de su profundidad y puede refinarse por reglas largas. No son diez campos universales rígidos en todos los niveles.»
- `MAPA` §2.5 l.82 [A]: «Las reglas largas refinan rutas y prefijos completos sin enumerar 10^10.» `MAPA` §2.1 l.19 [A]: «una regla larga puede especializar una ruta completa».
- Límite que el propio corpus pone: `V2/02_CONTEXTO/06_HOJA_DE_RUTA_Y_CRITERIOS_DE_PARADA.md` l.53, entre los «Riesgos a vigilar»: «6. Prometer que el ser humano puede deducir automáticamente cualquier ruta larga con solo conocer cien reglas; la comprensión práctica de algunas especializaciones todavía exigirá contexto adicional.»

### 2.2 Época 0, respaldo y lo decidido por VG

- `V2/01_NUCLEO/01_DECISIONES_Y_MODELO_ACTUAL.md` l.50: «**Época 0** da interpretación genérica de los diez dígitos en todas las profundidades no especializadas. […] mientras las interpretaciones **largas** de rutas completas se especializan de forma dispersa y coherente con aquellas.»
- `V3/01_NUCLEO/03_…` l.39: «**Época 0:** ofrece reglas iniciales que pueden actuar como **fallback** en profundidades todavía sin consolidación específica.»
- `MAPA` §10.4 l.209 [D]: «**Regla corta de época 0 en todas las profundidades:** “nos valen las 10 reglas de momento”. Cada dígito es un PV también en profundidad 1, 2…; las 100 reglas cortas quedan para más adelante.»
- `06_EPOCAS` l.12 [U, cierre V4]: «las 100 reglas cortas se trabajan en V5 junto a ejemplos y UI para que no se inventen sin casos prácticos.»
- `agx/02_TRAZABILIDAD/04_ABIERTOS_Y_PRUEBAS_V5.md` l.11: «**B · 100 reglas cortas:** 10 niveles × significados 0–9 en cada nivel; versiones corta exhaustiva y larga refinadora. Inicialmente trabajar un subconjunto representativo y comprobar contradicciones antes de completar cientos de combinaciones.» Y l.40, en «Investigaciones aplazadas sin desecho»: «Algoritmo global de encaje, combinaciones largas emergentes, generación económica de árbol con referencias […]».
- `MAPA` §11 l.242 [X]: «Siguen sin existir: reglas cortas más allá de época 0, reglas largas, […]».

Ninguna decisión de VG menciona las largas: no las aplaza ni las autoriza. Los catorce originales de `V2/90_FUENTES_CONSULTA` no contienen la palabra «época» (grep sin resultados): la pareja corta/larga nace en V2.

### 2.3 Época y confluencia

- `MAPA` §9 l.160 [D, VG 6-11]: «**La época es una convención paralela, no un atributo del dato.** El dato no dice en qué época está: cualquier dato puede analizarse desde cualquier época. La convención «por fuera» es la época actual, que es la confluencia de las épocas pasadas y que predefine cómo se calculará la confluencia de la siguiente. Por tanto la época no debe quedar delimitada dentro de BTML».
- `V2/02_CONTEXTO/04_EPOCAS_…` l.5: «Una época es un árbol AGRAM/proyecto informacional ordinario cuyo contenido se adopta como **base común de interpretación**. No constituye una clase especial que precise un gestor central. Por la misma recursividad, las reglas para definir la próxima época pueden ser un proyecto AGRAM.» Y l.9: «**Convergencia anual:** no simple elección de una propuesta vencedora; composición/integración colectiva de aportaciones útiles de varias ramas bajo criterios de la época vigente. […] NO existe algoritmo de legitimidad/Sybil/anti-captura resuelto.»
- `V3/01_NUCLEO/03_…` l.40: «**Convergencia anual:** integración de aportaciones de diversas ramas, **no** una votación de ganador único que destruye alternativas. […] Autoridad, legitimidad, antigüedad de reglas, compatibilidad entre épocas, conflictos y traducciones permanecen abiertos.»

Ningún pasaje relaciona las reglas largas con la confluencia. Lo único abierto que el corpus declara en ese cruce es «el fallback entre reglas cortas de épocas distintas».

### 2.4 Época y encaje

- `02_BTML` l.38: «4. Ordenar sin borrar alternativas: compatibilidad demostrada; calidad/anclaje de referencias; **estructura/prefijos**; semántica de vector; preferencias/precedentes consolidados. Este orden es **propuesta de evaluación**, no score matemático universal.» Y l.39: «El signo positivo o negativo solo indica reducir/completar si la regla de esa dimensión lo permite.»
- `MAPA` §12 l.247 [D]: «La época cambia qué ocupantes aparecen y cómo se ordenan.» l.248 [D]: «la época cambia los vectores».
- `MAPA` §12 l.257 [D, VG 7-11 tarde]: «**Signo del vector: opción B.** Signo por componente como información; ni signo ni distancia ordenan hasta que una época haga ordinal una profundidad (entonces solo ahí). La E (orientación) queda apuntada para cuando lleguen las reglas cortas.»

Es el único enganche escrito entre época y encaje: «haga ordinal **una profundidad**». «Estructura/prefijos» (l.38) es el único lugar del corpus donde prefijos y encaje aparecen juntos, y no está desarrollado.

## 3. Lo que hoy hace el código

- `src/epocas.js`: `PV` (los diez nombres), `EPOCA_0 = { nombre, reglaCorta(profundidad, digito) → PV[digito] }`, `leerDireccion(dir, epoca = EPOCA_0)` → una entrada `{ profundidad, digito, significado }` por profundidad real. No hay método por prefijo ni por ruta.
- La época es parámetro, nunca campo del evento: `pointed.decupla(ev, epoca)`, `sequenced.secuencia(…, { epoca })`, `mapped.mapa(…, { epoca })`, `leerDireccion(dir, epoca)`. Cumple «época fuera del dato».
- `src/encaje.js` (PR #29): `ordenarPorEncaje(lista, { epoca })` y `ocupantes(eje, id, indices, { orden, epoca })` ordenan por acuerdo de prefijo y, **solo en las profundidades que `epoca.ordinal(k)` declare**, por distancia; después, llegada. `EPOCA_0` no define `ordinal`, así que nada cambia. El comentario de `vector` (l.24) aún dice «Opción B de docs/notas/SIGNO_DEL_VECTOR.md; pendiente de que VG elija»: VG ya la eligió (`MAPA` §12 l.257).
- El gancho no llega al usuario: `src/bql.js` l.273 (`BUSCAR`) y `src/motor.js` l.87 y l.113 (`descubrir`, `consolidar`) llaman a `ocupantes` sin época.
- No existe carpeta `datos/` en `main`. `test/pointed.test.js` solo comprueba época 0 (`leerDireccion('1200000000')` → `recursos`, `criterios`).
- `docs/BTML.md` §6.5 (l.557–561) sigue diciendo que «a igual acuerdo, menor distancia profundidad a profundidad» ordena; desde las PR #28 y #29 no ordena en época 0. Es un desajuste documental, no de código.

PR abierta, sin fusionar: **#33 «Reglas cortas: época 0 en datos y época 1 propuesta»**. Añade `datos/epocas/epoca-0.json`, `datos/epocas/epoca-1-propuesta.json`, `cargarEpoca(datos, { respaldo })` y `ordinal` declarado en datos (`"ordinales": []`). Su época 1 es de cortas (profundidad 1 = «la pregunta del PV»: 0 qué, 1 cuánto, 2 con qué condición, 3 con quién…), todas nominales. Sobre las largas dice (`docs/REGLAS_CORTAS.md` de esa rama, principio 10): «Solo una regla larga podría declarar ordinal un prefijo (hitos de PV8, escalas de T, pasos de 9); las reglas largas aún no existen ([X] decidir VG, duda 6).»

### El ejemplo: la compra del menú

Payload real (`ejemplos/ikisai/compra-food.mjs`): compra `1` = `[→menú:1, 1, 'EUR 12']`; `4` = `['pagar', 'servir']`; la cuenta de cocina escrita `en: '1000000000'` sobre la compra.

| ruta | lectura por cortas hoy (época 0) | lectura por cortas en la época 1 de la PR #33 | una larga posible (ilustración) |
|---|---|---|---|
| `1.0` | recursos › representación | recursos › qué | — (las cortas bastan) |
| `1.2` | recursos › criterios | recursos › con qué condición | «precio» |
| `4.1` | fábrica › recursos | fábrica › cuánto | «lo que entrega la otra parte» |

La larga añade lo que la composición de cortas no dice por sí sola («precio» no está en «recursos» ni en «criterios» aislados) sin contradecirla. Ninguna de estas largas está en el corpus.

## 4. Opciones para VG

No se recomienda ninguna. A es compatible con todas las demás como estado de partida; E y F son independientes de B, C y D.

### A · No tocar nada: época 0 y esperar el primer caso real

- Qué es: la opción alineada con «nos valen las 10 reglas de momento» [D], con el cierre V4 (cortas en V5 con ejemplos y UI) y con «trabajar un subconjunto representativo y comprobar contradicciones».
- Cambio en código: ninguno en `src/`. Solo documentación: `docs/BTML.md` §6.5 (la distancia no ordena en época 0) y el comentario de `vector` en `src/encaje.js` l.24 («pendiente de que VG elija» → elegida el 7-11).
- Ejemplo: `leerDireccion('1200000000')` sigue devolviendo `recursos`, `criterios`; `BUSCAR(1)` ordena por acuerdo de prefijo y llegada. Nada cambia hasta que VG elija un caso.

### B · Punto de extensión mínimo: `reglaLarga(camino)` opcional en la época

- Qué es: una época puede declarar `reglaLarga(camino)`, parcial (`undefined` = respaldo en las cortas). `leerDireccion` conserva su salida y añade un campo opcional `especializacion`. `EPOCA_0` no declara ninguna. Permite escribir el primer ejemplo como prueba sin inventar formato de datos.
- Cambio en código: `src/epocas.js`: `leerDireccion(dir, epoca)` busca `epoca.reglaLarga?.(camino.slice(0, k))` de mayor a menor `k` y, si la hay, añade `especializacion: { prefijo, significado }`. `src/pointed.js` y `src/mapped.js` podrían etiquetar cada posición con `epoca.reglaLarga?.([...camino, i])` sin cambiar sus firmas. Una prueba con una época inyectada solo en el test.
- Ejemplo: época de prueba `{ nombre: 'prueba', reglaCorta: (p, d) => PV[d], reglaLarga: (c) => ({ '1.2': { significado: 'precio' } })[c.join('.')] }`. Entonces `leerDireccion('1200000000', prueba)` devuelve las dos entradas de siempre más `especializacion: { prefijo: '1.2', significado: 'precio' }`, que casa con `'EUR 12'` en `compra[1][2]`.
- Decisiones previas: la clave (ver T1) y la precedencia (ver T2).

### C · Largas como datos, sobre el formato de la PR #33

- Qué es: si VG fusiona la PR #33, cada época es un JSON en `datos/epocas/`; se añade un campo `largas`: mapa disperso `camino → lista de especializaciones` (lista, porque el corpus admite «varias especializaciones contextualizadas si su diferencia queda expresa»).
- Cambio en código: `cargarEpoca` valida `largas`: cada entrada con `significado`, `diferencia` obligatoria cuando hay más de una para el mismo camino, `refina` = las cortas de los dígitos de su camino (la única comprobación mecánica de «coherente con las cortas» que se ve posible: que `refina` coincida con lo que dan las cortas), `implementacion` opcional por hash y nunca identidad de la regla (`06_EPOCAS` l.11). `reglaLarga(camino)` sale de ahí. Sin cambios en `btml.js`, `evento.js` ni `eje.js`.
- Ejemplo: `"largas": { "1.2": [{ "significado": "precio", "refina": ["recursos", "con qué condición"], "ejemplo": "compra 1.2 = 'EUR 12'" }], "4.1": [{ "significado": "lo que entrega la otra parte", "refina": ["fábrica", "cuánto"], "diferencia": "en una compra" }] }`. Una entrada cuyo `refina` no coincida con las cortas («`1.2` refina `comunicación`») se rechaza al cargar: es el guardarraíl 14 hecho prueba.

### D · La época como registro del eje y la confluencia como consolidación

- Qué es: lectura de V2 («las reglas para definir la próxima época pueden ser un proyecto AGRAM»). La época N+1 sería una consolidación cuyo foco es la época N y cuyas elecciones son largas aportadas por ramas; dos largas distintas para la misma ruta quedan como colisión con procedencia («colisiones, no apaños», `MAPA` §12 [D]), ordenadas por los criterios que la época N dejó escritos («predefine cómo se calculará la confluencia de la siguiente»). Es **deducción**: el corpus no la escribe. Concilia, a juicio del asistente, «época = árbol ordinario» con «no debe quedar delimitada dentro de BTML»: la época existe como dato, ningún evento ordinario la referencia, y se elige por fuera como parámetro de lectura.
- Cambio en código: `src/epocas.js`: `epocaDesde(eje, id)` construye `{ reglaCorta, reglaLarga, ordinal }` leyendo el payload de un registro con una disposición convenida (qué posición del árbol-época guarda qué: [X] decidir VG). `motor.consolidar` se reutiliza para producir la época N+1.
- Ejemplo: la rama «cocina» propone `1.2 = precio`; la rama «huésped», `1.2 = lo que pago`. La consolidación de la época 1 guarda las dos como ocupantes de `1.2`, cada una con procedencia y vector; `epocaDesde(eje, epoca1).reglaLarga([1, 2])` devuelve las dos (colisión conservada).

### E · Llevar la época hasta BUSCAR y el motor

- Qué es: independiente de las largas. Sin esto, «la época cambia qué ocupantes aparecen y cómo se ordenan» [D] no se ve en ninguna consulta, aunque el gancho exista en `encaje.js`.
- Cambio en código: `src/bql.js` l.273: `ocupantes(ctx.eje, evId, indices, { epoca: ctx.epoca })`, y `consultar(eje, id, indices, formula, { epoca })` que la meta en `ctx`. `src/motor.js` l.87 y l.113: `ocupantes(eje, foco, indices, { epoca })`, con `epoca` en las opciones de `descubrir` y `consolidar`. Una prueba en `test/bql.test.js` con `{ ordinal: (k) => k === 0 }`.
- Ejemplo: con la lista de `test/vector.test.js`, sin época el orden es por acuerdo y llegada; con `{ ordinal: (k) => k === 0 }` la distancia en la profundidad 0 desempata. Tras el cambio, `consultar(eje, compra.id, [1], 'BUSCAR(1)', { epoca })` daría ese mismo orden en BQL, cosa que hoy no puede.

### F · La larga en el encaje: «estructura/prefijos» y ordinal por prefijo

- Qué es: dos variantes. F1: cada ocupante lleva la especialización de prefijo más largo que case con su origen, y BQL la expone a FILTRAR/ORDENAR como función de candidato (igual que hoy `SIGNO()` o `ACUERDO()`), sin tocar el orden por defecto: es el criterio «estructura/prefijos» de `02_BTML` l.38. F2: la propuesta de la PR #33 (duda 6): una larga puede declarar **ordinal un prefijo** (los hitos de PV8, las escalas de T, los pasos de 9), y entonces el desempate por distancia vale solo dentro de ese prefijo. F2 choca con la letra del [D] del 7-11 («hasta que una época haga ordinal **una profundidad**»): ampliarlo a prefijos es decisión nueva.
- Cambio en código: F1: `src/encaje.js` `conEncaje(o, destino, epoca)` añade `especializacion`; `src/bql.js` añade `ESPECIALIZACION()` junto a `SIGNO()`/`ACUERDO()`. F2: `ordenarPorEncaje` pregunta `epoca.ordinal(camino)` (prefijo) en vez de `epoca.ordinal(k)` (profundidad). Ambas dependen de B o C y de E.
- Ejemplo: F1: `FILTRAR(BUSCAR(1), ESPECIALIZACION() = "precio")` desde la compra devuelve solo lo que cae bajo `1.2` (`'EUR 12'`). F2: bajo una larga «`8` = hitos, ordinal», dos ocupantes de la posición 8 en los hitos 3 y 7 frente a un buscado 4 se ordenarían 3 antes que 7 (|−1| < |3|); fuera de `8.*` nada cambia.

### Decisiones transversales (hacen falta con B, C, D o F)

**T1 · Clave de la larga.** Todos los ejemplos del corpus (`00`…`99`, `03`, `31`) empiezan en la profundidad 0. Deducción: la clave es el camino de índices reales con puntos (`1.2`), no la dirección de diez dígitos, porque `direccion([1, 0]) === direccion([1])` (`docs/BTML.md` §4.2) y una larga para `1.0` sería innombrable. Con la [D] del 7-11 (`MAPA` §12 l.263: «un número es índice (camino exacto…); un texto de diez dígitos es dirección (…nombra la colisión entera)») una larga por dirección especializaría la colisión entera, y una por camino solo el camino exacto.

**T2 · Precedencia.** El corpus no la fija. Candidatas: prefijo más largo gana; ruta completa gana sobre prefijo; o ninguna gana y se devuelven todas las que casen, como colisión.

**T3 · La ruta a través del anclaje.** La cuenta está escrita `en: '1000000000'` sobre la compra: su `[1]` cae, respecto del foco, en la ruta `1.1`, y su `[2]` en `1.2`. Hoy ninguna función compone ruta del foco + `en` + camino propio, y la PR #33 (principio 6) lee lo escrito siempre desde su propio 0. Si una larga sobre `1.2` debe alcanzar a lo escrito es [X] decidir VG.

## 5. Lo que no se puede decidir desde el corpus

1. **Un solo ejemplo** de regla larga: no existe en todo el corpus; los ejemplos son claves (`03`, `31`) sin contenido.
2. **Formato y lugar**: ni JSON, ni árbol, ni carpeta. `datos/epocas` no aparece en el corpus; existe solo en la PR #33, sin fusionar.
3. **Clave y precedencia** (T1, T2): «ruta completa» y «prefijo contextualizado» se usan juntos sin definir la diferencia.
4. **Qué es «contradecir arbitrariamente»** una corta: solo se dice que la larga refina y no contradice.
5. **Si las largas pertenecen a una época** o se comparten entre épocas, y cómo se versionan.
6. **Cómo entran en la confluencia**: el corpus no tiene algoritmo de convergencia ni de legitimidad, y solo declara abierto el fallback entre cortas de épocas distintas.
7. **Qué relación tienen con el vector**: «la época cambia los vectores» no se desarrolla; el [D] del 7-11 habla de profundidades ordinales, no de prefijos (F2).
8. **Si una larga cruza el anclaje `en`** (T3) o sobrevive a un cambio de foco al agotar diez niveles.
9. **La tensión «época = árbol ordinario»** (V2, V3, V4) frente a «la época no debe quedar delimitada dentro de BTML» (VG 6-11): la salida de D es deducción.
10. **El calendario** de diez épocas consolidando una profundidad cada una: V2 lo llama hipótesis «no desplegada»; VG no se ha pronunciado.

## Fuentes leídas

- Diario del batallón anterior: `leer:reglas-largas:0`, `leer:reglas-largas:1`, `juez:reglas-largas`.
- `V2/01_NUCLEO/01_DECISIONES_Y_MODELO_ACTUAL.md`, `02_BTML_ESTRUCTURA_Y_PREGUNTAS.md`, `04_CORRECCIONES_DE_ESTA_CONVERSACION.md`; `V2/02_CONTEXTO/04_EPOCAS_GOBERNANZA_Y_TIEMPO.md`, `06_HOJA_DE_RUTA_Y_CRITERIOS_DE_PARADA.md`; `V3/01_NUCLEO/03_BTML_ESTRUCTURA_EPOCAS_Y_OPERACIONES_ABIERTAS.md`; `V3/03_TRANSICION/ESPECIFICACION_EXPLORATORIA_V3_INTEGRA.md`; `agx/01_NUCLEO_V4/01_MODELO_INTEGRADO_V1_A_V4.md`, `02_BTML_ESTRUCTURA_POSICIONES_Y_CEROS.md`, `06_EPOCAS_TIEMPO_EPRT_Y_FRONTERAS.md`; `agx/02_TRAZABILIDAD/04_ABIERTOS_Y_PRUEBAS_V5.md`. Grep de «época», «larga», «corta», «prefijo», «confluencia», «convergencia» sobre el paquete.
- `MAPA` §2.1, §2.5, §9, §10.4, §11, §12.
- `src/epocas.js`, `src/encaje.js`, `src/bql.js`, `src/motor.js`, `src/pointed.js`, `src/mapped.js`, `test/pointed.test.js`, `test/vector.test.js`, `docs/BTML.md`, `docs/notas/SIGNO_DEL_VECTOR.md`, `ejemplos/ikisai/compra-food.mjs`; PR #33 (rama `reglas-cortas`: `datos/epocas/epoca-0.json`, `src/epocas.js`, `docs/REGLAS_CORTAS.md`).
