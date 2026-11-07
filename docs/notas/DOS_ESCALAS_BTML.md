# Dos escalas de datos: `matrix_data` y `block_data`

Nota de lectura para VG · 7-11-2026 · **No decide nada.** Recoge lo que dice el corpus (citas literales con archivo y línea), lo que hoy hace el código de `main` y las opciones abiertas. Base: las dos lecturas y el juez del batallón anterior, comprobados de nuevo contra el corpus, contra el MAPA en su estado de esta tarde (§12, decisiones de VG del 7-11) y contra el código (`main` en `8d73b44`, 101 pruebas en verde). Lo que es deducción del asistente va marcado como tal.

Rutas abreviadas: `agx/` = raíz del paquete del corpus V4 (copia local de trabajo); `V2/` = `agx/80_HERENCIA_V3_INTEGRA/80_V2_INTEGRO/`; `V3/` = `agx/80_HERENCIA_V3_INTEGRA/`; `MAPA` = `MUELA/equipo/agram/MAPA_GLOBAL_AGRAM.md` (fuera de este repositorio); `02_BTML` = `agx/01_NUCLEO_V4/02_BTML_ESTRUCTURA_POSICIONES_Y_CEROS.md`.

> **Estado en `main` (`7090c8c`, 7-11 noche).** §3 sigue valiendo: comprobado de nuevo que un payload de once niveles pasa `validarPayload`, que `direccion` con once índices lanza `RangeError: entre 0 y 10 índices` y que el coste en T y `contarPosiciones` cuentan terminales (una referencia cuenta uno). Lo nuevo desde la nota: BQL ya no lanza con más de diez profundidades, da `PENDIENTE` (decidido en la integración del 7-11 y marcado [X] para revisar: `docs/BQL.md` §8), y la profundidad máxima de un payload está apuntada como [X] en `docs/BTML.md` §11. Nada de la nota está decidido.

## 1. La cuestión en tres frases

1. En septiembre VG decidió «distinguir esas **dos escalas de datos**, en lugar de aplastarlas en una única estructura indiferenciada» (D07), y desde entonces todo el corpus conserva `matrix_data` y `block_data` como **nombres**, sin decir en ningún sitio qué son.
2. Lo que sí está decidido, sin usar esos nombres, es una estructura de dos niveles: el **registro** (evento con id, encadenado en el eje) y la **posición** (dirección de diez dígitos, local a un registro); el código ya la tiene separada.
3. Queda por saber si los dos nombres son esos dos niveles, otra cosa del kernel V7–V10 (por ejemplo las estructuras A/B) o nombres que se retiran; y, con independencia de los nombres, hay dos fronteras que el código deja abiertas: qué pasa por debajo del décimo nivel y en qué unidad se cuentan los «~99 contenidos».

## 2. Lo que dice el corpus

### 2.1 La única fuente primaria: D07

`V2/90_FUENTES_CONSULTA/STATE_DECISIONES_DEL_USUARIO_2026-10-21.md` l.63–67:

> «### D07 · Estructuras `matrix_data` y `block_data` [D]
> - **Decisión:** distinguir esas **dos escalas de datos**, en lugar de aplastarlas en una única estructura indiferenciada.
> - **Estado:** debe revisarse su interpretación técnica exacta en las fuentes BTML/AGRAM antes de deducir capacidades nuevas.
> - **Trazabilidad:** usuario, **24-09-2026, 10:39 UTC**.»

El mismo archivo, l.4, avisa de qué es: «registro de decisiones y correcciones del usuario para el relevo a un chat nuevo; **no es canon técnico ni transcripción íntegra**». D07 es, por tanto, paráfrasis. Lleva el mismo sello (24-09-2026, 10:39 UTC) que D06 (l.57–61: «preservar los espacios de árboles y sus relaciones: `PV1 → 4^4`, `PV2 → 5^5`, `PV3 → 6^6`, `PV4 → 7^7`») y la misma sección que D08 (la matriz 3×3).

### 2.2 Las nueve menciones derivadas: conservar el nombre, no reinterpretar

- `V2/01_NUCLEO/02_BTML_ESTRUCTURA_Y_PREGUNTAS.md` l.62: «Relación formal entre los antiguos espacios `4^4`, `5^5`, `6^6`, `7^7`, `matrix_data`/`block_data` y BTML decimal de diez profundidades. **No** presentar esas potencias como equivalentes a `10^10`.»
- `V2/01_NUCLEO/03_PV_GEOMETRIA_E_INTERFAZ.md` l.64: «`matrix_data` y `block_data` son dos escalas históricas que conviene no colapsar; su encaje actual debe revisarse si reaparece.»
- `V2/02_CONTEXTO/06_HOJA_DE_RUTA_Y_CRITERIOS_DE_PARADA.md` l.29: «G. Comprender expresamente la relación entre `4^4`/`5^5`/`6^6`/`7^7`, `matrix_data`/`block_data` y la representación decimal/BTML.»
- `V2/02_CONTEXTO/07_TRAZABILIDAD_Y_MATERIAL_HISTORICO.md` l.25: «Los antiguos espacios `4^4`/`5^5`/`6^6`/`7^7` y las escalas `matrix_data`/`block_data` existieron y tienen valor de genealogía; **no** reducirlos a la dirección BTML decimal sin investigar.»
- `V3/01_NUCLEO/03_BTML_ESTRUCTURA_EPOCAS_Y_OPERACIONES_ABIERTAS.md` l.29: «`matrix_data` y `block_data` son escalas históricas que se conservan **como nombres sin reinterpretación**.»
- `V3/03_TRANSICION/AUDITORIA_CONTINUIDAD_V2_V3_INTEGRA.md` l.87: «`matrix_data` y `block_data` son dos escalas históricas distintas que **deben recuperarse nominalmente**, sin definirlas por intuición.» (y l.281, en la tabla de recuperación: «Recuperar ejes, mapa PV8 0…9, pares A/B, `matrix_data/block_data`»).
- `V3/03_TRANSICION/DELTAS_DECISIONES_ABIERTOS.md` l.16: «`matrix_data` / `block_data`, antiguas potencias, C1/C2/C3 y viejos Core como fuentes **históricas** sin autoridad actual automática.»
- `02_BTML` l.31 (V4, último en el tiempo): «`matrix_data`, `block_data`, `4^4`, `5^5`, `6^6`, `7^7`, `4×4`, `5²`, `55` y `10^10` no se declaran magnitudes equivalentes.»
- `MAPA` §2.1 l.33: «`matrix_data` y `block_data` son dos escalas de datos que no se aplastan [D07]; su interpretación técnica exacta está pendiente [X].»

Las «fuentes BTML/AGRAM» a las que remite D07 no están en el paquete. `MAPA` §6 l.140: «No vienen en el paquete: […] los anexos de Drive (V5–V10, Pasadas 22 y 23), el código V10 y de AGRAM_v1, los laboratorios ejecutables […]». La auditoría del kernel (`V2/90_FUENTES_CONSULTA/STATE_Auditoria_PV1_PV4_Recuperacion_Historica_2026-10-20.md`) sí nombra sus identificadores («`TREE_ARITY = {1:4,2:5,3:6,4:7}` y `treeAddress`, `treePath`, `treeDistance`, `resolveNode`, `moveNode` se reportan conservados hasta V10») y ninguno es `matrix_data` ni `block_data`.

### 2.3 Lo que sí está decidido sin esos nombres: dos niveles

- `V2/01_NUCLEO/02_BTML_ESTRUCTURA_Y_PREGUNTAS.md` l.52: «La primera cuestión probablemente debería separar dirección local BTML y referencia interevento, ya que todas las demás pueden depender de ello.» Y l.60: «Profundidad local hasta diez vs número indefinido de saltos entre eventos; ciclos y presupuestos de recorrido.»
- `02_BTML` l.5: «[C] Un **árbol lógico de trabajo**, con hasta **diez profundidades de posicionamiento** dentro del marco/foco actual. […] El ID/hash del evento es independiente de la dirección. Se transmiten fragmentos pequeños que AGRAM reconstruye por reglas de época, referencias y contexto; no se materializa un array global denso de 10^10.»
- `02_BTML` l.45 y l.47 (Límites y ciclos): «**BTML:** diez pasos de posicionamiento en el marco actual. Cambiar foco para estudiar el interior de otro objeto mantiene referencias y no concatena veinte dígitos.» «**Referencias:** navegar eventos/objetos no consume directamente profundidad BTML.»
- `MAPA` §2.1: «El identificador o hash del evento no es la dirección [D]. Al agotar diez niveles se cambia de foco: otro objeto pasa a ser centro, con vínculo al anterior; no se concatena un undécimo dígito [A].»
- `MAPA` §10.4 l.210 [D]: «**Lo escrito va en el PV donde se escribe** […] Lo escrito es el payload entero del registro nuevo; la posición es el anclaje, no un hueco en un array.»
- `MAPA` §12 l.263 [D, VG 7-11 tarde]: «**BUSCAR por dirección y por índice:** las dos sin ambigüedad: un número es índice (camino exacto, relativo al anfitrión); un texto de diez dígitos es dirección (absoluta en el registro, nombra la colisión entera).» La dirección es «absoluta en el registro»: cada registro tiene su propio espacio de direcciones.

### 2.4 La economía de las diez profundidades

- `02_BTML` l.19: «**Una construcción de orden ~99 contenidos es satisfactoria como punto de partida** […] Como contraste estrictamente físico, un recorrido de **diez índices 9** requiere diez arrays con diez elementos cada uno: 91 terminales + 9 subarrays anidados como elementos = **100 entradas de array**, sin posiciones nulas. […] Esta cuenta **no** prueba el posicionamiento BTML contextual ni afirma equivalencia ontológica entre JSON y el árbol interpretado.»
- `agx/04_EJEMPLOS/LEER_EJEMPLOS.md`: «Contiene **10 arrays**, **91 terminales**, **9 subarrays no raíz usados como entradas**, y **100 entradas de array sumadas**.»
- `MAPA` §12 l.265 [D, VG 7-11 tarde]: «se escribe de 0 a 9 y dentro de cada posición igual (99 campos hasta todo nueves)».

### 2.5 Otros sentidos de «escala» y de «matriz» que no son estos

- Escala de tiempo: las siete escalas de T (`MAPA` §12 l.255 [D]: «T = siete tokens, uno por escala»).
- Escalas visuales: `agx/01_NUCLEO_V4/05_DIEZ_PV_UI_Y_MODOS.md` l.31: «Potencias `4^4`, `5^5`, `6^6`, `7^7` son escalas visuales/geométricas heredadas que **no** se identifican con direcciones locales BTML ni se mezclan con 4×4, 55 o 5².» `V3/01_NUCLEO/01_MODELO_ACTUAL_Y_PRECEDENCIAS.md`: «**Escala:** tamaño real del mundo/proyecto, zoom local, detalle interno, profundidad del árbol, densidad simultánea y presupuesto temporal son variables relacionadas, pero no equivalentes.»
- `MAPA` §4.10 [A]: «Tres cadenas de dígitos distintas que las fuentes antiguas mezclan: PVPath («2342», secuencia de operadores), dirección BTML («8412300000», posición en el árbol) y geometría visual (4^4, 5^5…). V4 las separa; cualquier diseño debe nombrarlas de forma distinta desde el primer día [A].»
- Matriz: la 3×3 de D08 y de Mapped; y desde esta tarde la matriz de la fábrica (`MAPA` §12 l.265 y l.267 [D]: «La fábrica (PV4) parte de la matriz de 100 del foco (10 posiciones × 10 subposiciones), que ya está y no se emite»; «El registro de salida es la matriz 10×10×10»). Ninguna de estas frases menciona `matrix_data`.

## 3. Lo que hoy hace el código

Ningún archivo de `src/`, `test/`, `docs/` ni `app.js` contiene `matrix_data` ni `block_data`. El código implementa los dos niveles de §2.3 sin nombrarlos:

- **Nivel registro** (`src/eje.js`, `src/evento.js`): eventos con `id` = SHA-256 del cuerpo canónico, encadenados por `sobre` y anclados por `en` (dirección de diez dígitos dentro del foco); índice `hijos` por registro.
- **Nivel posición** (`src/btml.js`): `ARIDAD = 10`; `validarPayload` (terminal o array de 1–10 posiciones sin nulos ni huecos); `esDireccion` (exactamente diez dígitos); `direccion(indices)` lanza `RangeError` con más de diez índices; `indicesDe`, `resolver`.
- **El cruce** (`src/encaje.js`, `ocupantes`): tres tipos de ocupante. `propio` = misma posición del mismo registro; `referencia` = `{ref, dir}`, de una posición a otro registro y vuelta a una posición suya; `escrito` = otro registro entero anclado con `sobre` + `en`. Desde PR #28 los escritos anclados en la dirección buscada salen exactos (`origen: dir`, l.145); las referencias restan la dirección alcanzada en el otro registro contra la posición donde se colocan (`origenDir = o.dir`, l.96).

Comprobado hoy con la compra del menú (`ejemplos/ikisai/compra-food.mjs`):

| nivel | qué hay |
|---|---|
| registros | génesis (casa) ← altas (casa) ← menú (cocina) ← compra (huésped) ← cuenta (cocina, `en: '1000000000'`) |
| posiciones de la compra | `1000000000` → `[→menú:1, 1, 'EUR 12']`; `1200000000` → `'EUR 12'`; `4100000000` → `'servir'` |
| cruce: `ocupantes(compra, [1])` | propio `[1]`, propio `[1.0]` (colisión por ceros), referencia a menú:1, la cuenta escrita; los cuatro con vector `[0,…,0]` y acuerdo 10 |

Fronteras que el código deja abiertas:

- **Más de diez niveles.** Un payload de once niveles anidados pasa `validarPayload` (`ok = true`); `direccion(Array(11).fill(0))` lanza «RangeError: entre 0 y 10 índices»; `arbol` (`src/encaje.js` l.178) omite en silencio lo que queda por debajo. `docs/BTML.md` l.214 lo deja escrito: «Pendiente: cambio de foco al agotar diez niveles».
- **Unidad de cuenta.** Con el literal `agx/04_EJEMPLOS/BTML_CAMINO_9999999999_LITERAL.json`, `modos.contarPosiciones` da 91 (terminales); arrays 10; entradas 100. El código cuenta terminales: `escritura.costeT` cobra un minuto de T por terminal y `cabeEscritura` compara terminales con la proporción del modo.
- **Palabras ocupadas.** «escala» en código es la unidad de T (`src/eje.js` `saldoT`, `src/tokens.js` `ESCALAS_T`); «matriz» es la 3×3 de Mapped (`src/mapped.js` `MATRIZ`).

## 4. Opciones para VG

A–E responden a «qué son los dos nombres»; T1–T3 son independientes de los nombres y valen con cualquiera de ellas. No se recomienda ninguna.

### A · Cuarentena nominal

- Qué es: lo único que el corpus permite sin VG. Los dos nombres se conservan como herencia pendiente; el código no los nombra; se pide a VG la fuente.
- Cambio en código: ninguno en `src/`. Una línea en `docs/BTML.md` §11 (Lo que no existe): «`matrix_data` y `block_data`: dos escalas de datos heredadas que no se aplastan [D07]; qué son está pendiente de las fuentes V7–V10/AGRAM_v1 [X]; el código no las nombra».
- Ejemplo: pregunta para VG, literal: «En septiembre decidiste no aplastar `matrix_data` y `block_data`. ¿Eran dos estructuras del código V7–V10, dos niveles de datos (registro frente a posición), la matriz de la fábrica frente al bloque que se emite, o las estructuras A/B? ¿Dónde se pueden leer?». Hasta la respuesta, `MAPA` §2.1 sigue con su [X].

### B · `block_data` = registro (eje), `matrix_data` = posición (payload)

- Qué es: identificar los nombres con los dos niveles que ya existen. Es **deducción**: ningún texto liga los nombres al eje ni al payload, y D07 prohíbe «deducir capacidades nuevas»; solo vale si VG lo confirma.
- Cambio en código: solo nombres y pruebas, sin lógica nueva. Cabecera de `src/eje.js` («escala de registros: eventos con id encadenados por `sobre` y anclados por `en`») y de `src/btml.js` («escala de posiciones: payload ≤10, direcciones de diez dígitos locales al registro»); sección «Dos escalas» en `docs/BTML.md`; `test/escalas.test.js` que fije tres invariantes: `esDireccion` rechaza más de diez dígitos y no existe ninguna clave registro+posición concatenada; la única pasarela posición → registro es `{ref, dir}` y la única registro → posición es `sobre` + `en`; `ocupantes(compra, [1])` devuelve ocupantes de los dos niveles. Usar «registro» y «posición» en el texto, no «escala» ni «matriz».
- Ejemplo: la tabla de §3. Cada registro abre su propio espacio de diez dígitos; los registros se encadenan por referencia, no por dígitos («no concatena veinte dígitos»).

### C · `matrix_data` = la matriz de la fábrica, `block_data` = lo que se emite

- Qué es: **deducción nueva de esta tarde**, más débil que B. VG llama ahora «matriz» a la de 100 del foco («10 posiciones × 10 subposiciones, que ya está y no se emite») y al registro de salida 10×10×10; lo que se emite son «SOLO las décuplas modificadas», que acaban «ancladas a Bitcoin» (`MAPA` §9 l.162: «Ejecutar genera un registro nuevo, una maraña de décuplas, que es lo que acaba anclado a Bitcoin»). Leído así, no aplastar sería no confundir la matriz que se lee (no se emite) con el bloque que se escribe. Nada del corpus lo dice; D07 (24-09) es seis semanas anterior a esa matriz.
- Cambio en código: ninguno propio; si VG lo confirma, los nombres irían en la pieza que implemente el registro de salida 10×10×10 (ver `docs/notas/FABRICA_10X10.md`): una función que lea la matriz del foco sin escribir y otra que emita solo las décuplas modificadas.
- Ejemplo: foco = la compra; matriz leída = sus posiciones 0–9 × subposiciones (`1.0` el menú, `1.1` = 1, `1.2` = `'EUR 12'`…); lo emitido = una décupla con la celda `1.2` modificada. La matriz no viaja; el bloque sí.

### D · Las dos estructuras transmisibles A (PV1–4) y B (PV6–9)

- Qué es: la identificación más arriesgada. El contrato v0.2 (`V2/90_FUENTES_CONSULTA/AGRAM_Contrato_Construccion_Transmision_Reconstruccion_v0.2.md`) contempla «**dos estructuras transmitibles**, una ligada a PV1–PV4 y otra ligada a PV6–PV9», pero es del 19-10, cinco semanas posterior a D07, y nunca las llama así; `MAPA` §4.7 deja A/B en [X].
- Cambio en código: ninguno hasta que VG decida A/B; si lo decidiera, sería una forma de empaquetado para transmitir, no un cambio de `btml.js`.
- Ejemplo: la compra transmitida como A = posiciones 1–4 (`[→menú:1, 1, 'EUR 12']`, `[→menú:2]`, `['huesped','cocina']`, `['pagar','servir']`) y B = lo que se deriva en 6–9 (hilo, futuro, comparación, camino), que hoy el código calcula al leer y no guarda.

### E · Retirar los nombres

- Qué es: solo VG puede; el corpus ordena conservarlos «nominalmente».
- Cambio en código: ninguno. `MAPA` §2.1 pasaría de «su interpretación técnica exacta está pendiente [X]» a «retirados [D, fecha]: eran nombres del kernel V7–V10; la distinción vigente es registro frente a posición».
- Ejemplo: la frase de §3 queda como única descripción de los dos niveles, sin nombres heredados.

### T1 · Cerrar la frontera de las diez profundidades

- Qué es: el [A] «al agotar diez niveles se cambia de foco […] no se concatena un undécimo dígito», que el código no aplica. Independiente de los nombres.
- Cambio en código: `src/btml.js`, función `profundidad(payload)`, y una de dos: (a) `validarPayload` rechaza cualquier nodo por debajo del décimo nivel con «profundidad > 10: ese contenido debe ser su propio registro, referenciado desde aquí»; (b) se admite y `encaje.arbol` devuelve además `sinDireccion` con los caminos que no caben, para que la interfaz proponga el cambio de foco.
- Ejemplo: once arrays anidados. Hoy: se escribe, `direccion` lanza y `arbol` no muestra la hoja. Con (a) el evento se rechaza al escribir; con (b) se escribe y `arbol` avisa de un camino sin dirección.

### T2 · Unidad de cuenta de los «~99»

- Qué es: el corpus da 91 terminales y 100 entradas para el mismo literal y acepta «orden ~99»; VG dice esta tarde «99 campos hasta todo nueves». Nadie fija si se cuentan terminales, entradas o campos.
- Cambio en código: si VG fija la unidad, `contarEntradas(payload)` en `src/modos.js` junto a `contarPosiciones` (o solo una de las dos), usada en `cabeEscritura` y en `escritura.costeT`.
- Ejemplo: el literal `9999999999` cuesta hoy 91 minutos de T (91 terminales); por entradas costaría 100.

### T3 · Qué mide el acuerdo entre dos registros

- Qué es: VG eligió el 7-11 tarde la opción B del signo (`MAPA` §12 l.257 [D]: «ni signo ni distancia ordenan hasta que una época haga ordinal una profundidad»), pero el **acuerdo de prefijo** sí ordena, y para una referencia se calcula entre la dirección del otro registro y la posición donde se coloca: compara dos espacios de direcciones distintos.
- Cambio en código: tres salidas en `src/encaje.js` `conEncaje`: (i) dejarlo y escribir que entre registros el acuerdo compara perspectivas bajo la época, no posiciones de almacenamiento; (ii) tratar las referencias como los escritos (`origenDir = destino`, exactas), una línea; (iii) marcar `entreRegistros: true` y excluir ese acuerdo del orden.
- Ejemplo: un registro X con `X:2` = referencia a `plan:7` («cena el sábado») y un hijo escrito en `2000000000`. Hoy `ocupantes(X, [2])`: propio y escrito exactos (acuerdo 10); la referencia sale con vector `[5,0,…]`, acuerdo 0, y queda la última. Con (ii) empataría con los otros y decidiría la llegada.

## 5. Lo que no se puede decidir desde el corpus

1. **Qué son** `matrix_data` y `block_data`: ni forma, ni contenido, ni cuál es la grande, ni en qué unidad se mide la escala. Ningún archivo del paquete los define (tampoco los catorce originales de `V2/90_FUENTES_CONSULTA` ni los ZIP de `agx/99_RESGUARDOS`).
2. **De dónde salen los nombres.** Las fuentes probables (kernel V7–V10 `agram.js`/`core.json`, AGRAM_v1, anexos V5–V10) no están en el paquete; D07 es paráfrasis. [X] decidir VG: aportar la fuente o decir qué recuerda.
3. **Su relación con la dirección de diez dígitos**: solo hay negaciones («no se declaran magnitudes equivalentes»; «no reducirlos a la dirección BTML decimal sin investigar»).
4. **Su relación con el evento, el eje, A/B o la matriz de la fábrica**: ningún texto la establece; B, C y D son deducciones.
5. **Si siguen vigentes** como algo más que nombres: V3 los conserva «sin reinterpretación», DELTAS los declara «sin autoridad actual automática», y las decisiones de VG del 6 y 7-11 no los mencionan.
6. **Qué significa en código «aplastar»** o «no aplastar» dos escalas.
7. **La unidad de cuenta** de «~99» (T2) y el **vector entre registros** (T3): el corpus no los fija; T3 es posterior al corpus (el anclaje `en` es de VG, 6-11).
8. **Cómo se compone la ruta** de un registro hijo con la del padre (el hijo, ¿hereda profundidad o abre un árbol nuevo de diez niveles?): `MAPA` §8 l.156 lo deja abierto («cómo declara un fragmento su anclaje, por ID del padre más índice, por dirección completa, o por ambos»).

## Fuentes leídas

- Diario del batallón anterior: `leer:dos-escalas:0`, `leer:dos-escalas:1`, `juez:dos-escalas`.
- `V2/90_FUENTES_CONSULTA/STATE_DECISIONES_DEL_USUARIO_2026-10-21.md`, `STATE_Auditoria_PV1_PV4_Recuperacion_Historica_2026-10-20.md`, `AGRAM_Contrato_Construccion_Transmision_Reconstruccion_v0.2.md`; `V2/01_NUCLEO/02_BTML_ESTRUCTURA_Y_PREGUNTAS.md`, `03_PV_GEOMETRIA_E_INTERFAZ.md`; `V2/02_CONTEXTO/06_HOJA_DE_RUTA_Y_CRITERIOS_DE_PARADA.md`, `07_TRAZABILIDAD_Y_MATERIAL_HISTORICO.md`; `V3/01_NUCLEO/01_MODELO_ACTUAL_Y_PRECEDENCIAS.md`, `03_BTML_ESTRUCTURA_EPOCAS_Y_OPERACIONES_ABIERTAS.md`; `V3/03_TRANSICION/AUDITORIA_CONTINUIDAD_V2_V3_INTEGRA.md`, `DELTAS_DECISIONES_ABIERTOS.md`; `agx/01_NUCLEO_V4/02_BTML_ESTRUCTURA_POSICIONES_Y_CEROS.md`, `05_DIEZ_PV_UI_Y_MODOS.md`; `agx/04_EJEMPLOS/`. Grep de `matrix_data` y `block_data` sobre todo el paquete.
- `MAPA` §2.1, §4.7, §4.10, §6, §8, §9, §10.4, §12.
- `src/btml.js`, `src/eje.js`, `src/evento.js`, `src/encaje.js`, `src/modos.js`, `src/escritura.js`, `src/mapped.js`, `src/tokens.js`, `docs/BTML.md`, `ejemplos/ikisai/compra-food.mjs`.
