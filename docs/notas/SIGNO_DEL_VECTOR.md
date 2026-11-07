# El signo del vector de encaje

Nota de lectura para VG · 7-11-2026 · **No decide nada.** Recoge lo que dice el corpus (citas literales con archivo y línea), lo que hoy hace el código, las cuatro lecturas que se hicieron esta noche y las opciones abiertas. Lo que es deducción del asistente va marcado como tal. `docs/FUNDAMENTOS.md` («El vector de encaje») remite a esta nota.

> **Estado en `main` (`03dbf34`, 7-11 noche, tras la integración #55).** VG eligió la **opción B** (mapa §12 [D], 7-11 tarde) y está implementada (PR #28; el gancho de la época, PR #29). Lo que §4 cuenta como «hoy» es el código de antes de esas PR y **ya no se cumple**: el vector es candidato − buscado (una referencia a la 7 colocada en la 2 da `+5`, «reducir»); un escrito anclado en la dirección buscada es exacto (acuerdo 10, no «completar»); ordenan el acuerdo de prefijo y la llegada, y la distancia solo ordenaría en una profundidad que una época declare ordinal (ninguna lo hace). `docs/FUNDAMENTOS.md` ya no dice «pendiente de VG». Lo vigente está en `docs/BTML.md` §6.5 y `docs/BQL.md` §7.4. Siguen abiertas la orientación (opción E) y las decisiones transversales de §5.

Rutas abreviadas: `agx/` = raíz del paquete del corpus V4 (copia local de trabajo); `MAPA` = `MUELA/equipo/agram/MAPA_GLOBAL_AGRAM.md` (fuera de este repositorio); `02_BTML` = `agx/01_NUCLEO_V4/02_BTML_ESTRUCTURA_POSICIONES_Y_CEROS.md`.

## 1. La cuestión en tres frases

1. El corpus V4 describe el encaje con un «vector **de diez diferencias con signo**, un dígito por componente», entrega «faltas/excedentes» y advierte que «el signo positivo o negativo solo indica reducir/completar si la regla de esa dimensión lo permite».
2. VG dudó de que hagan falta vectores negativos («lo único que indicas es la distancia, siempre positiva») y después lo matizó: «no estoy seguro, era solo una apreciación»; «podemos indicar que la matriz es negativa también, no solo el número; o el vector es negativo en su completa»; «la información se va generando de 0 hacia arriba y por lo tanto tienes ya un orden que siempre va a existir»; «se puede forzar a empezar en un número alto».
3. Hoy el código ordena los ocupantes por acuerdo de prefijos y luego por |diferencia| profundidad a profundidad, y conserva el signo por componente como información (más una etiqueta global); queda por decidir qué es el signo, si la distancia por dígito puede ordenar mientras ningún dígito tenga orden (época 0), y varias convenciones que el corpus no fija.

## 2. Lo que dice el corpus

### 2.1 El vector y el signo (V4, contrato conceptual)

`02_BTML`, sección «ENCAJAR V0: contrato conceptual, no función total demostrada»:

> l.37 «3. Comparar con la posición buscada mediante coincidencias de ruta y vector **de diez diferencias con signo**, un dígito por componente.»
>
> l.38 «4. Ordenar sin borrar alternativas: compatibilidad demostrada; calidad/anclaje de referencias; estructura/prefijos; semántica de vector; preferencias/precedentes consolidados. Este orden es **propuesta de evaluación**, no score matemático universal.»
>
> l.39 «5. Entregar candidatos, justificaciones, diferencias, faltas/excedentes y empate. El signo positivo o negativo solo indica reducir/completar si la regla de esa dimensión lo permite.»
>
> l.41 «Ejemplo [EX]: solicitada `"8412300000"`; candidata `"8412500000"` tiene +2 en el quinto dígito; candidata `"8412100000"` tiene −2 en el quinto. Anclajes A `"8412000000"` y B `"8411000000"`, más fragmento hijo 3, pueden generar `"8412300000"` y `"8411300000"` **solo si** existe la relación posicional aplicable. Dos eventos distintos pueden colisionar en la misma posición; eso no los hace idénticos ni autoriza a sobrescribir uno.»

Lo mismo en los demás documentos V4:

- `agx/00_LEER_PRIMERO.md` l.42: «Encaje: resolver referencias y contexto, obtener posiciones interpretadas, comparar vector de diez diferencias **con signo**, aplicar compatibilidad/criterios/preferencias, conservar alternativas. No se ha demostrado una fórmula total de encaje.»
- `agx/01_NUCLEO_V4/04_AGRAM_OPERACIONES_AUTORIZACION_Y_REGISTRO.md` l.15–16: «3. **POSICIONAR:** obtener posiciones lógicas mediante rutas locales, anclajes, ceros y orientación, sin superar diez profundidades por marco. 4. **COMPARAR:** compatibilidad y coincidencia, vector de diez diferencias con signo, relaciones de candidatos y preferencias contextualizadas.» Y l.24, entre las salidas: «lista/colección de candidatos identificados, ordenados o con empate; motivos de encaje, distancias vectoriales y referencias».
- `agx/02_TRAZABILIDAD/03_REGISTRO_HITOS_V4.md` l.20: «3. **Encaje y diferencias:** interpretaciones candidatas, vectores firmados en diez componentes, orden contextual sin suma de enteros gigantes.» l.22: «5. **Formalización conceptual ceros y prioridades:** zero literal, zero representacional, zero de orientación; comparar después de interpretar, no puntuar por cercanía ciega; precedentes preferidos sin excluir alternativas.»
- `agx/02_TRAZABILIDAD/02_DESCARTES_Y_NO_REGRESION.md` l.10 [DESC]: «No reducir las posiciones BTML a «números grandes» ni su resta a una distancia escalar. Comparar diez dígitos con signo en dimensiones semánticas y conservar ceros/contexto.»
- `agx/02_TRAZABILIDAD/01_HERENCIA_COMPATIBILIDAD_Y_REEMPLAZOS.md` l.24, bajo «## Ampliaciones V4 [EXTEND]»: «**Encaje:** vector posicional con signo y criterios contextualizados; alternativas con procedencia; no descartar por mera distancia numérica, ni sobrescribir colisiones.»
- `agx/02_TRAZABILIDAD/04_ABIERTOS_Y_PRUEBAS_V5.md` l.13: «**C · Encaje/ceros/orientación:** casos `"8412300000"` y otras rutas, compartir ceros con distinto recorrido/depth, colisiones exactas y diferentes, anclaje desde ID, vector firmado, alternativas; ranking condicionado; validar con UI en lugar de declarar fórmula sin evidencias.»

Lo que se lee de ahí sin deducir nada: el signo es **por componente** («un dígito por componente»; «+2» y «−2» «en el quinto dígito»; «faltas/excedentes» en plural); tiene una semántica (reducir/completar) **condicionada** a «la regla de esa dimensión»; el orden es una lista de cinco criterios en la que el vector aparece cuarto y como «semántica de vector», no como distancia; y lo rechazado expresamente es la **distancia escalar** («números grandes», «cercanía ciega», «mera distancia numérica»). El corpus no contiene ni la frase «la distancia ordena» ni «la distancia no ordena».

«Dimensión» no está definida en el corpus (solo aparece en l.39 y en 02_DESCARTES l.10, «dimensiones semánticas»). La lectura natural es la regla corta de cada profundidad: `agx/01_NUCLEO_V4/06_EPOCAS_TIEMPO_EPRT_Y_FRONTERAS.md` l.8: «A cada profundidad le corresponde una **regla corta exhaustiva** que explica el significado de los diez dígitos 0…9 en esa profundidad (primer dígito = profundidad 0). Horizonte de 10 × 10 = **100 significados/reglas cortas fundamentales**.» Esa identificación es deducción, no cita.

### 2.2 Los dígitos no son magnitudes

- V2, `agx/80_HERENCIA_V3_INTEGRA/80_V2_INTEGRO/01_NUCLEO/02_BTML_ESTRUCTURA_Y_PREGUNTAS.md` l.10 [U]: «cada dígito representa una de las diez perspectivas»; l.14: «Los números/dígitos son **posiciones semánticas**, cuyo significado depende de la gramática de época y de especializaciones de profundidad/ruta».
- `MAPA` §10.4 l.209 [D]: «**Regla corta de época 0 en todas las profundidades:** «nos valen las 10 reglas de momento». Cada dígito es un PV también en profundidad 1, 2…; las 100 reglas cortas quedan para más adelante.»
- El único sitio del corpus donde un dígito tiene orden es PV8: `agx/80_HERENCIA_V3_INTEGRA/01_NUCLEO/02_DIEZ_PV_Y_EXPERIENCIA_VISUAL.md` l.87 («Diez hitos heredados exactos (índice → nivel.grado): 0→0.3 (idea); 1→1.1 (aprendizaje); … 9→5.3»). Y aun ahí: `…/90_FUENTES_CONSULTA/AGRAM_PV8_R1_Calibracion_Dinamica_Comparabilidad_Impugnacion_v1.1-candidata.md` l.57: «Es una **escala ordinal de hitos**, no una medida métrica: entre las posiciones 2 y 3 no existe necesariamente la misma distancia que entre 7 y 8»; `04_ABIERTOS` l.32: «**Comparabilidad PV8:** no recomendar mayor grado de forma ciega»; `agx/01_NUCLEO_V4/01_MODELO_INTEGRADO_V1_A_V4.md` l.44: «Mayor profundidad ≠ más zoom ≠ más densidad ≠ mayor tiempo ≠ mayor calidad.»

### 2.3 El orden de llenado («de 0 hacia arriba») y el coste de empezar alto

- `02_BTML` l.12 [U]: «No usar `null` ni posiciones ausentes para **saltar índices**. Si queremos usar el índice 3 de un array literal, los índices 0, 1 y 2 tendrán contenido real, aunque mínimo.» `03_REGISTRO` l.13: «arrays no vacíos y secuenciales que pueden ser unitarios, no JSON disperso».
- `02_BTML` l.19 [U, cierre V4]: «un recorrido de **diez índices 9** requiere diez arrays con diez elementos cada uno: 91 terminales + 9 subarrays anidados como elementos = **100 entradas de array**, sin posiciones nulas. […] Esta cuenta **no** prueba el posicionamiento BTML contextual».
- `MAPA` §10.4 l.210 [D]: «**Lo escrito va en el PV donde se escribe** […] la posición es el anclaje, no un hueco en un array.» §10.6 l.222 [A]: «**Herencia por referencia:** en Mapped, las celdas vacías anteriores a la última escrita se rellenan con `{ref: foco, dir}`».

Es decir: el orden que VG señala existe por decisión suya, dentro de cada array literal (hermanos de un mismo padre). «Empezar en un número alto» tiene hoy tres vías con coste distinto: array literal (k posiciones reales), herencia por referencia (k referencias) y anclaje `en` (ninguna posición intermedia). Lo del coste por vía es lectura del código, no del corpus.

### 2.4 Los tres ceros y la «orientación»

- `02_BTML` l.23: «Distinguir: (a) índice 0 realmente recorrido; (b) ceros de la cadena explícita de diez dígitos cuya profundidad se conoce por contexto; (c) posible función orientativa/de agregación bajo una regla de época. Ejemplo: una ruta local de cuatro pasos `8→4→1→2` puede representarse como `"8412000000"`; su descendiente en el índice cero podría conservar la **misma representación decimal**, sin ser el mismo nodo. […] La representación de diez dígitos no determina por sí sola una identidad material.»
- `02_BTML` l.30: «Comparar `"1100000000"` y `"0000000011"` como orientaciones opuestas es **hipótesis**, no afirmación de identidad ni inversión universal válida.»
- V3, `agx/80_HERENCIA_V3_INTEGRA/01_NUCLEO/03_BTML_ESTRUCTURA_EPOCAS_Y_OPERACIONES_ABIERTAS.md` l.19: «El usuario subrayó que los **ceros finales** de `1100000000` pueden expresar la representación agregada/alta de la posición `11`, **no** un relleno desechable sin semántica.» l.23: «**Dos orientaciones:** construir arrays desde arriba puede ser más natural que organizar almacenamiento de unidades pequeñas desde abajo. El ejemplo `1100000000` frente a `0000000011` **no** afirma equivalencia de identidad ni anuncia una operación de inversión válida de BTML. Es una intuición de construcción/almacenamiento a estudiar.»
- V3, `agx/80_HERENCIA_V3_INTEGRA/03_TRANSICION/ESPECIFICACION_EXPLORATORIA_V3_INTEGRA.md` l.42: «**BTML = matriz; BQL = lentes; AGRAM = interacción; interfaz = representación**»; l.465–467: «### 15.2 Matriz reversible como perspectiva de construcción/almacenamiento […] **Rectificación decisiva:** no se afirma que invertir el orden de una dirección represente automáticamente **el mismo elemento** o sea una operación ya válida de BTML»; l.617: «7. **No afirmar que `1100000000` y `0000000011` son el mismo dato**.»
- `02_DESCARTES` l.9 [DESC]: «No presentar `"1100000000"` y `"0000000011"` como misma dirección invertible sin regla validada; el usuario dijo que no eran automáticamente intercambiables.» l.27 [OPEN]: «Reglas completas de ceros de orientación, distinción nodo/hijo 0, interpretación con anclaje y época.» `agx/02_TRAZABILIDAD/05_COBERTURA_Y_LIMITES.md` l.30: «V3 orientaciones/ceros eran hipótesis sin operador».

En el corpus, «orientación» y «matriz» hablan siempre de la **dirección** (dónde están sus ceros, en qué sentido se construyó el árbol) y nunca del signo de la comparación. La frase «el cero del vector es el tercer cero (orientación)» (`MAPA` §12 l.248 y comentario de `src/encaje.js` l.20) es lectura del asistente, no del corpus: el tercer cero es un cero de dirección bajo regla de época; el «todo ceros = exacto» del vector es coincidencia.

### 2.5 Origen histórico del «con signo»

Comprobado con grep sobre los 64 archivos del paquete: «con signo», «vectores firmados en diez componentes», «vector firmado» y «vector posicional con signo» aparecen solo en documentos redactados en V4 (`00_LEER_PRIMERO.md`, `01_NUCLEO_V4/02` y `/04`, `02_TRAZABILIDAD/01`, `/02`, `/03` y `/04`). En V3, en V2 y en los catorce originales de `90_FUENTES_CONSULTA`, «firmado» es siempre un evento firmado. V4 lo reconoce al listarlo bajo «Ampliaciones V4 [EXTEND]» (`01_HERENCIA` l.20–24). El signo, por tanto, no es un residuo de borradores anteriores: es una novedad de V4.

Lo que había antes y no es esto:

- La única resta de los originales: `…/90_FUENTES_CONSULTA/STATE_DECISIONES_DEL_USUARIO_2026-10-21.md` l.60: «para PV2 el usuario propuso distinguir la aportación nueva mediante `5^5 − 4^4`, y para PV3 `6^6 − 5^5`. Estas expresiones **no deben imponerse como algoritmos de conteo de hechos** sin demostrar su interpretación.» `…/STATE_Auditoria_PV1_PV4_Recuperacion_Historica_2026-10-20.md` l.49: «**NO RECUPERADO COMO ALGORITMO HISTÓRICO:** las restas `5⁵−4⁴`, `6⁶−5⁵`, `7⁷−6⁶`»; l.175: «No trasladable automáticamente: […] restas de potencias como supuestos algoritmos, score BTML confundido con posición PV8, cualquier equivalencia TreePath=PVPath.» `…/STATE_C3G_Gramatica_Generativa_10PV_Investigacion_v1.5-candidata.md` l.77: «La resta de las «coronas» no está acreditada como algoritmo canónico histórico.» Es una diferencia de conjuntos (lo que se añade), no una dirección con signo.
- V3, exploratoria l.475: «### 15.4 Crecimiento de geometrías y «diferencia» entre ellas» (4^4, 5^5, 6^6…; «conservar la intuición espacial hasta especificarla»).
- V2, núcleo02 l.49: «6. **Comparar/traducir:** cómo relacionar dos árboles/épocas con compatibilidad parcial, diferencias y procedencia, evitando pérdida silenciosa.» Sin signo.
- «Falta» en la herencia tiene sentido de profundidad desarrollada, no de magnitud del dígito: `…/90_FUENTES_CONSULTA/AGRAM_C2_Unidad_Decapolar_Composicion_Recursiva_v0.4-candidata.md` l.248: «el prefijo `11` está **estructuralmente ejecutado hasta la segunda perspectiva**; `1111` puede quedar incompleto por falta de enlaces y no debe mostrarse como un recorrido de cuatro niveles confirmado.»

### 2.6 Autoridad de todo lo anterior

- `02_BTML` l.33: ENCAJAR V0 es «contrato conceptual, no función total demostrada»; l.51: «**V5:** probar mediante ejemplos y UI las reglas completas de ceros, orientación, prioridad/desempates, composición de anclajes y las cien reglas cortas. El usuario aceptó trasladar allí la validación del encaje.»
- `03_REGISTRO` l.3: «La siguiente secuencia **no sustituye la transcripción original del chat**. […] La mayor parte de «cierres» fueron aceptaciones pragmáticas para avanzar, no ratificación de gramática formal.» `05_COBERTURA` l.7: «**No se ha exportado automáticamente una transcripción forense de mensajes**». Ningún pasaje del signo lleva marca [U]: no se sabe si «con signo» lo dijo VG o el asistente.
- Regla de precedencia, `01_HERENCIA` l.5: «Correción expresa más reciente del usuario > acuerdos anteriores compatibles > V4 como propuesta de contrato conceptual > V3/V2 como antecedentes > prototipos/laboratorios históricos.»
- `MAPA` §12 l.248 [D] (6-11, VG «lo veo bien»): «**Vector de diez diferencias con signo** […]: destino − origen dígito a dígito; todo ceros = exacto; […] el cero del vector es el tercer cero (orientación). Orden por encaje sin borrar: exactos, luego profundidades de acuerdo, luego menor desplazamiento, empates por llegada; el sentido agrupa, no ordena. […] la época cambia los vectores.» l.252 [D] (7-11 madrugada): «VG dudó de los vectores negativos («lo único que indicas es la distancia, siempre positiva»). […] Por tanto: ordena la DISTANCIA (|diferencia| profundidad a profundidad, sin sumar); el signo es informativo (falta → completar, sobra → reducir) y solo cuenta donde la regla de la dimensión lo permita (reglas por dimensión: pendientes). Mi lectura «negativo = lectura cruz→X, positivo = escritura» queda RETIRADA [YO].»
- Después de ese [D], VG escribió: «No estoy seguro, de lo del número negativo. Era solo una apreciación.» Esa frase no es decisión; el [D] de l.252 se apoyó en ella, así que queda pendiente de confirmación.

## 3. Las lecturas de esta noche: apoyo y fallo

Se contrastaron cuatro hipótesis con el corpus. Ninguna es decisión. Dos revisiones independientes coincidieron en lo que sigue.

**H1 · Signo por componente, gateado por la regla corta de la profundidad; la distancia por dígito no ordena.**
Apoyo: literal en l.37 y l.39; «no puntuar por cercanía ciega» (03_REGISTRO l.22); «semántica de vector» es el cuarto de cinco criterios en l.38; con época 0 (dígito = PV en todas las profundidades) ninguna regla habilita hoy el signo.
Fallo: «la distancia no ordena» no está escrito en ningún sitio; el corpus veta la distancia escalar, y que la |diferencia| por dígito sin regla corta sea «cercanía ciega» es inferencia (razonable: con dígito = PV, el 0 no está «más cerca» del 2 que el 7, son perspectivas). Lee «faltas/excedentes» también como profundidad desarrollada, cosa que l.39 no dice.

**H2 · La «orientación» (tercer cero) y la «matriz» de VG nombran una propiedad global de la dirección del candidato (desde arriba / desde abajo), que vive en POSICIONAR y no es el signo del vector.**
Apoyo: literal en 02_BTML l.23 y l.30, V3 núcleo03 l.23, 04_AGRAM l.15–16 (POSICIONAR antes de COMPARAR), 03_REGISTRO l.22 («comparar después de interpretar»). Acierta en que «el cero del vector es el tercer cero» no está en el corpus.
Fallo: la orientación está marcada tres veces como hipótesis sin operador, así que no sostiene un dato nuevo; que VG quisiera decir la inversión V3 con «la matriz es negativa» es conjetura, igual de compatible con un resumen global del vector (lo que ya hace `signo()`); y defiende dejar el orden por distancia citando frases que apoyan el signo por componente, no el orden.

**H3 · La información se genera de 0 hacia arriba (prefijo sin huecos); es regla de serialización, no semántica del dígito; el signo mide desplazamiento respecto de lo buscado y solo significa algo donde la regla corta haga ordinal al dígito.**
Apoyo: l.12 [U], l.19 (coste de 100 entradas), V2 l.14 (posiciones semánticas), MAPA §10.4. Explica por qué la colisión del índice 0 es estructural: si el primer hijo es siempre el 0, el primer descendiente comparte cadena con su padre. Señala una asimetría real: completar cuesta posiciones o referencias; «reducir» no es operación («No existe modificar en sitio: corregir es añadir un ocupante», FUNDAMENTOS).
Fallo: «adelantarse es imposible por construcción» no vale con el anclaje `en`, que es justo lo que VG llamó «forzar a empezar en un número alto»; y tras vaciar de sentido la magnitud del dígito deja que |diferencia| siga ordenando.

**H4 · «Sin signo» es falsa en lo histórico: el signo nace en V4 como ampliación, no es residuo de V2/V3; el corpus niega la distancia escalar, no la distancia por profundidad; no se borra sin corrección expresa de VG.**
Apoyo: el hecho histórico está comprobado (§2.5); la regla de precedencia es literal; VG no pidió quitar el signo.
Fallo: da por hecho que la distancia por profundidad puede ordenar apoyándose en «distancias vectoriales» (04_AGRAM l.24), que es una salida del motor, no un criterio de orden; su lectura de «de 0 hacia arriba» como «destino − origen > 0 = el candidato viene de antes» choca con dígito = PV y con el anclaje; no entra en los tres ceros, en el artefacto de los escritos ni en la convención numérica invertida.

Resumen de las dos revisiones: H1 es la más fiel al texto de V4; H4 acierta en lo histórico; H3 aporta la explicación estructural de las colisiones y la asimetría completar/reducir; H2 aporta que orientación y signo son cosas distintas. Ninguna decide.

## 4. Lo que hoy hace el código

`src/encaje.js` (rama `main`, PR #17 y #22):

- l.22–26 `vector(origen, destino)`: `destino − origen` dígito a dígito. En `conEncaje` (l.88–93) **origen = dirección del candidato** (`o.dir` si es referencia, `o.origen` si no) y **destino = dirección buscada**. El número es, por tanto, `buscada − candidata`: un candidato en 7 colocado en 2 da −5 → «reducir».
- l.34–38 `acuerdo(v)`: ceros seguidos desde la profundidad 0, sin distinguir si el 0 es índice recorrido o cero de representación: `vector('1000000000','1000000000')` da acuerdo 10.
- l.41–65 `distancia` (|d| por componente), `norma` (suma de |d|, «medida de consulta»), `faltas` (componentes > 0), `excedentes` (< 0), `signo` (global: exacto / completar / reducir / mixto).
- l.68–86 `compararDistancia` y `ordenarPorEncaje`: acuerdo descendente → |d_k| profundidad a profundidad, sin sumar → llegada. «El signo no ordena.»
- l.137–138: a los **escritos** (anclados con `en`) se les asigna `origen: '0000000000'`; su vector son los dígitos de su anclaje y su signo es siempre «completar».
- l.20, comentario: «El cero de orientación es el tercer cero: ninguna diferencia ahí» (lectura del asistente; ver §2.4).
- Ninguna función consulta la época ni la regla corta; `src/epocas.js` solo tiene `reglaCorta(profundidad, digito) → PV[digito]`.

`src/bql.js`: `BUSCAR` hereda el orden de `ocupantes` (l.272); `SIGNO()`, `FALTAS()`, `EXCEDENTES()`, `ACUERDO()`, `DESPLAZAMIENTO()` (l.386–404) solo dentro de FILTRAR/ORDENAR; `DESPLAZAMIENTO()` devuelve la suma de |d|.
`src/motor.js` l.67–75: la consolidación guarda `vector` y `signo` de cada fuente elegida en `contexto.encaje`.
`test/vector.test.js` fija la convención (l.13–15), el orden (l.32–41), el artefacto de los escritos (l.52, l.68, l.85–86) y que las colisiones por ceros son exactas entre sí (l.58–60).
`docs/FUNDAMENTOS.md`, «El vector de encaje»: describe lo anterior y deja escrito «Pendiente de VG: si el signo es por componente o del vector entero, y el orden que impone que la información crezca desde el cero».
`app.js`: no muestra ni vector ni signo (y el corpus pide validar el encaje con UI).

### El ejemplo: la compra del menú

Datos (`ejemplos/ikisai/compra-food.mjs`): cocina publica el **menú** (`1` = `['ensalada','guiso','fruta']`, `2` = `['sin gluten','vegetariano']`); la huésped escribe la **compra** sobre el menú (`1` = `[→menú:1, 1, 'EUR 12']`, `2` = `[→menú:2]`, `3` = `['huesped','cocina']`, `4` = `['pagar','servir']`); cocina escribe la **cuenta** sobre la compra, anclada **en** `1000000000` (recursos). Variante del test: un registro X cuya posición 2 (criterios) es una referencia a la posición 7 (futuro) de un plan («cena el sábado»), más un hijo escrito en X:2 («criterio escrito»).

Hoy, `ocupantes(compra, [1])`, que es lo que devuelve `BUSCAR(1)` desde la compra:

| ocupante | origen → destino | vector | acuerdo | signo |
|---|---|---|---|---|
| propio `[1]` = `[→menú:1, 1, 'EUR 12']` | 1000000000 → 1000000000 | [0,0,…] | 10 | exacto |
| propio `[1.0]` = `→menú:1` (colisión por ceros) | 1000000000 → 1000000000 | [0,0,…] | 10 | exacto |
| referencia: menú:1 = `['ensalada','guiso','fruta']` | 1000000000 → 1000000000 | [0,0,…] | 10 | exacto |
| escrito: la cuenta | 0000000000 → 1000000000 | [1,0,…] | 0 | completar (faltas 1) |

Hoy, `ocupantes(X, [2])`: propio `[2]` exacto; referencia plan:7 «cena el sábado», 7000000000 → 2000000000 = [−5,0,…], «reducir»; escrito «criterio escrito», 0000000000 → 2000000000 = [2,0,…], «completar». Orden por encaje: propio, escrito (|2|), referencia (|5|). Orden por llegada: propio, referencia, escrito.

## 5. Opciones para VG

A–D responden a «qué es el signo y qué ordena»; E se puede sumar a cualquiera de ellas. Después van las decisiones transversales, que hacen falta con casi cualquier opción. No se recomienda ninguna.

### A · Como está: signo por componente informativo, etiqueta global derivada, la distancia por dígito ordena tras el acuerdo

- Qué es: lo acordado en `MAPA` §12 l.252. El vector lleva signo por componente; `signo()` lo resume «en su completa» (exacto / completar / reducir / mixto); el orden es exactos → acuerdo → |diferencia| profundidad a profundidad → llegada.
- Código: nada. Solo escribir la convención en `docs/FUNDAMENTOS.md` (qué se resta a qué, qué ordena, qué significa el signo, qué pasa con los tres ceros) y retirar la frase del tercer cero (comentario l.20 y `MAPA` §12 l.248).
- Ejemplo: la tabla de §4 tal cual. La cuenta sale cuarta, «completar»; en X:2 el escrito [2] sale antes que la referencia [−5] porque |2| < |5|.
- Apoyo y coste: VG dijo «lo veo bien» al vector y el [D] de l.252 lo recoge; pero el corpus no autoriza el escalón de distancia («no puntuar por cercanía ciega»; vector cuarto de cinco criterios de una «propuesta de evaluación») y, con dígito = PV, |2| < |5| compara perspectivas (criterios frente a futuro) como si fueran números.

### B · Signo por componente bajo regla corta; mientras ningún dígito tenga orden (época 0), ni el signo ni la distancia por dígito ordenan

- Qué es: la lectura literal de l.39 («solo… si la regla de esa dimensión lo permite») llevada también al orden: exactos → acuerdo de prefijos → llegada. El signo y la |diferencia| se calculan y se muestran, pero no cuentan hasta que la regla corta de esa profundidad declare un orden entre dígitos.
- Código: `src/epocas.js` gana un gancho por profundidad (p. ej. `permiteOrden(profundidad)`, hoy `false` en las diez); `ordenarPorEncaje` usa `compararDistancia` solo en profundidades habilitadas; `signo()`, `faltas()`, `excedentes()` reciben la época y devuelven «sin regla» (o PENDIENTE) donde no la hay; en BQL, `SIGNO()`, `FALTAS()`, `EXCEDENTES()` devuelven eso mismo; `motor.consolidar` guarda además la época bajo la que se calculó el vector (`MAPA` §12: «la época cambia los vectores»). Tests l.32–41, l.52, l.56, l.63–73 y l.85 cambian.
- Ejemplo: en X:2 el orden pasa a propio, referencia, escrito (llegada), porque |2| frente a |5| no significa nada entre «criterios» y «futuro». `CONTAR(FILTRAR(BUSCAR(1), SIGNO() = "completar"))` ya no da 1: según `agx/01_NUCLEO_V4/03_BQL_SINTAXIS_SEMANTICA_Y_EJEMPLOS.md` l.46 («Datos faltantes en FILTRAR no se transforman en «false»: no descartar indebidamente candidatos»), sale PENDIENTE. La cuenta sigue cuarta (acuerdo 0 frente a 10), con su vector [1,0,…] visible y signo «sin regla».
- Apoyo y coste: es lo que dice V4 letra por letra y lo que impone la [D] de época 0; cuesta que, hasta la primera regla corta ordinal, SIGNO/FALTAS/EXCEDENTES no sirvan para filtrar y que el orden entre no exactos sea solo por llegada.

### C · Signo global del candidato («el vector es negativo en su completa») y vector de distancias positivas

- Qué es: un solo signo por candidato (exacto / completar / reducir / mixto, calculado de la pareja origen-destino) y un vector de diez distancias sin signo. Es la segunda frase de VG leída como «en vez de», no como «además de» (el «además de» es la opción A, donde `signo()` ya resume el vector entero).
- Código: `vector()` devuelve |destino − origen|; `signo()` se calcula antes de tomar el valor absoluto y se conserva; `faltas()`/`excedentes()` quedan como cuentas o desaparecen; en BQL `SIGNO()` sigue y `FALTAS()`/`EXCEDENTES()` según lo anterior; `motor` guarda distancia + signo; tests l.14–15 y l.53 cambian.
- Ejemplo: la cuenta: [1,0,…] + «completar»; la referencia plan:7 en X:2: [5,0,…] + «reducir». Pero un candidato `1700000000` buscado en `2300000000` sale [1,4,0,…] + «mixto», y ya no se sabe en qué profundidad falta y en cuál sobra (hoy: [+1,−4,0,…]).
- Apoyo y coste: ninguna frase del corpus habla de un signo global; el ejemplo [EX] da signos por dígito y l.39 pide «faltas/excedentes» en plural; se pierde el detalle que l.37 exige, aunque sigue reconstruible desde `origenDir` y `destino`, que se conservan.

### D · Sin signo: solo distancia («lo único que indicas es la distancia, siempre positiva»)

- Qué es: la primera duda de VG tomada como decisión. El vector es |diferencia| por profundidad; no hay signo, faltas ni excedentes.
- Código: `vector()` = valores absolutos; se borran `faltas()`, `excedentes()`, `signo()` y los campos `signo`, `faltas`, `excedentes` de `conEncaje`; en BQL desaparecen `SIGNO()`, `FALTAS()`, `EXCEDENTES()` (quedan `ACUERDO()` y `DESPLAZAMIENTO()`); `motor` deja de guardar `signo`; tests l.14–15, 19–27, 52–54, 60, 67–69 y 85 cambian; `ordenarPorEncaje` no cambia, porque ya no usa el signo.
- Ejemplo: la cuenta [1,0,…] y la referencia plan:7 [5,0,…]; nada dice si falta o sobra. Las dos candidatas del corpus, `8412500000` y `8412100000` frente a `8412300000`, quedan iguales: [0,0,0,0,2,0,…].
- Apoyo y coste: ninguna fuente anterior a V4 tiene signo que «recuperar» (§2.5); contradice l.37, l.39 y el [DESC] de 02_DESCARTES l.10 («Comparar diez dígitos con signo»); por la regla de precedencia solo vale con una corrección expresa de VG, registrada como decisión nueva; y VG dijo después «era solo una apreciación».

### E · Orientación como propiedad del candidato, separada del signo (sumable a A–D)

- Qué es: la «matriz negativa» leída como la orientación de construcción del corpus (desde arriba, ceros al final, `1100000000`; desde abajo, ceros al principio, `0000000011`). Pertenece a POSICIONAR (paso 2 de ENCAJAR V0), no a COMPARAR (paso 3).
- Código: campo `orientacion` en cada ocupante (`'desde-arriba'` hoy, la única que el código produce: `direccion()` rellena ceros a la derecha y `caminosDe()` desciende por el índice 0; `'desde-abajo'` PENDIENTE hasta que exista regla de época); `vector()` solo entre direcciones de la misma orientación y, si difieren, PENDIENTE (l.49: «Referencia/contexto ausente → PENDIENTE»); ningún operador de inversión en BQL; retirar «el cero del vector es el tercer cero» (comentario l.20 y `MAPA` §12 l.248). Opcional y deducido: `sentido(v)` = signo de la primera componente no nula (antes/después en el orden 0→9), que agrupa y no ordena (§12: «el sentido agrupa, no ordena»).
- Ejemplo: hoy todos los ocupantes de la compra y de la cuenta son «desde-arriba»; nada cambia. Si algún día un registro construido desde abajo expusiera `0000000011` y se comparase con `1100000000`, hoy saldría [−1,−1,0,0,0,0,0,0,+1,+1] («mixto», acuerdo 0); con E sale PENDIENTE.
- Apoyo y coste: la separación orientación/signo y la etapa son literales (§2.4); pero la orientación es «hipótesis sin operador» rectificada tres veces por VG, así que un campo con un único valor posible sería un dato por hipótesis; y que VG se refiriera a esto con «la matriz es negativa» es conjetura.

### Decisiones transversales (hacen falta con A, B, C o E)

**T1 · Qué se resta a qué.** Corpus [EX]: `candidata − solicitada` (candidata `8412500000` «tiene +2»). Código y `MAPA` §12: `destino − origen` con origen = candidata, es decir `buscada − candidata`. Las etiquetas coinciden (candidato más alto → «reducir» en ambos), el número está invertido. Código si se adopta la del corpus: invertir `vector()` o documentar la inversa; tests l.13–15, 53–54, 86. Ejemplo: la referencia plan:7 colocada en X:2 pasa de −5 a +5; sigue siendo «reducir».

**T2 · El vector de los escritos.** Hoy origen artificial `0000000000` (l.138): la cuenta, anclada en 1, sale [1,0,…] «completar», «le falta el 1» (test l.68). Alternativas: origen = su anclaje `en` (vector cero: está exactamente donde se le ancló; `MAPA` §10.4 «la posición es el anclaje, no un hueco»), o sin vector. Código: l.138 y tests l.52, 54, 56, 67–70, 85–86. Ejemplo: con origen = anclaje, `BUSCAR(1)` desde la compra da cuatro exactos (acuerdo 10 los cuatro) y `FILTRAR(BUSCAR(1), SIGNO() = "completar")` da 0; la cuenta sigue cuarta, pero por llegada y no por distancia.

**T3 · Los tres ceros dentro del vector.** Hoy `acuerdo()` cuenta todo 0 como acuerdo; `[1]` y `[1.0]` de la compra son exactos entre sí (test l.58–60), coherente con «colisiones, no apaños». Alternativa: un estado por componente (índice real en ambos / cero de representación en uno o en ambos), usando `camino.length` del propio, `indicesDe(dir)` de la referencia y el anclaje del escrito. Código: `acuerdo()`, `conEncaje` y un campo nuevo por componente. Ejemplo: entre `[1]` y `[1.0]`, la profundidad 1 sería «no desarrollada frente a índice 0 real» en vez de «acuerdo». Decidir además si ese estado cambia el orden entre colisiones por ceros (hoy, no).

**T4 · Faltas/excedentes de profundidad.** Lectura de la herencia (V3 l.19, C2 l.248): «falta» = el candidato está desarrollado a menos profundidad que la buscada; «excedente» = a más. No necesita regla corta y hoy no se calcula. Código: dato nuevo `profundidadCandidato − profundidadBuscada`, independiente del vector de dígitos. Ejemplo: la referencia menú:1 trae `['ensalada','guiso','fruta']`, desarrollada una profundidad más allá de la posición pedida `1000000000`: excedente de profundidad +1 con vector de dígitos exacto.

**T5 · DESPLAZAMIENTO() y el acceso por profundidad.** `DESPLAZAMIENTO()` suma |d| (bql.js l.402): es la distancia escalar que 02_DESCARTES l.10 pide no usar para comparar. Decidir si se queda como consulta (nunca como orden por defecto) o se retira, y si BQL expone el vector por profundidad (`DIFERENCIA(k)`, `VECTOR()`). Ejemplo: hoy `CONTAR(FILTRAR(BUSCAR(1), DESPLAZAMIENTO() > 0))` da 1 (la cuenta).

## 6. Lo que no se puede decidir desde el corpus

1. **La convención numérica** (T1): el corpus solo tiene un ejemplo (candidata − solicitada) y el código hace lo contrario; nadie fijó cuál.
2. **Si la |diferencia| por dígito puede ordenar en época 0**: el corpus veta la distancia escalar y la «cercanía ciega», pone el vector cuarto entre cinco criterios y llama al orden «propuesta de evaluación»; no dice ni sí ni no a la distancia por profundidad. `MAPA` §12 lo tiene como [D], apoyado en una duda que VG llama ahora «solo una apreciación».
3. **Qué es «la regla de esa dimensión»** (l.39): no está definida; la lectura «regla corta de la profundidad» es natural pero deducida. Con la [D] de época 0 ninguna profundidad habilita el signo; qué devuelven SIGNO/FALTAS/EXCEDENTES mientras tanto (valor bruto, «sin regla», PENDIENTE) no lo dice nadie.
4. **Cuál será la primera regla corta ordinal** (¿los diez hitos de PV8?) y si en ella el signo podrá ordenar o solo informar; el corpus prohíbe «recomendar mayor grado de forma ciega» y recuerda que la escala de hitos «no es una medida métrica».
5. **Si existe un signo global** («la matriz es negativa», «el vector en su completa»): el corpus no lo tiene; lo más cercano es la orientación de construcción, hipótesis sin operador. Si VG quería el resumen derivado, ya existe (`signo()`); si quería la orientación, es otra pieza (E); y qué significaría «mixto» bajo un signo global.
6. **Qué significan «faltas/excedentes»**: magnitud del dígito (l.39 y código) o profundidad desarrollada (herencia), o ambas como datos separados (T4).
7. **Qué vale un 0 del vector** entre un índice 0 recorrido y un cero de representación (T3); 02_DESCARTES l.27 lo deja [OPEN] y 04_ABIERTOS l.24 (caso 2, «dos nodos con cadena "8412000000" pero rutas/profundidades diferentes») lo manda a la interfaz.
8. **El vector de los escritos** (T2): el anclaje `en` es decisión de VG del 6-11, posterior al corpus; nada dice qué vector lleva lo anclado.
9. **Las candidatas generadas por anclaje** del ejemplo [EX] (`8412000000` + hijo 3 → `8412300000` «solo si existe la relación posicional aplicable»): es el único caso del corpus donde el signo por componente tiene el sentido estructural que VG describe (+2 = dos huecos después dentro del mismo padre). El código no genera candidatas: los escritos declaran `en` exacto y las referencias `dir` exacta. El corpus no dice si hay que construir ese generador ni cuál es «la relación posicional aplicable».
10. **«Empezar en un número alto»**: el corpus documenta el coste físico (100 entradas) y la regla sin huecos; no dice si un candidato anclado en k sin 0…k−1 debe marcarse como «sin orden de generación» ni si eso toca al vector.
11. **Si `DESPLAZAMIENTO()` puede existir** como consulta (T5).
12. **Qué hace el vector entre orientaciones distintas**, si algún día existe «desde abajo»: el corpus prohíbe la inversión como operación y no dice más (E).
13. **La autoridad del «con signo»**: nace en V4 sin [U] ni transcripción forense, pendiente de «validar con UI». Ratificarlo, cambiarlo o retirarlo es decisión nueva de VG, no vuelta a un estado anterior; y el [D] de `MAPA` §12 l.252 necesita su confirmación expresa.
14. **Dónde se escribe la convención**: `docs/FUNDAMENTOS.md` remite a esta nota; `app.js` no muestra vector ni signo, y el corpus pide validar el encaje en la interfaz.

## Fuentes leídas

- `agx/00_LEER_PRIMERO.md`; `agx/01_NUCLEO_V4/01_MODELO_INTEGRADO_V1_A_V4.md`, `02_BTML_ESTRUCTURA_POSICIONES_Y_CEROS.md`, `03_BQL_SINTAXIS_SEMANTICA_Y_EJEMPLOS.md`, `04_AGRAM_OPERACIONES_AUTORIZACION_Y_REGISTRO.md`, `06_EPOCAS_TIEMPO_EPRT_Y_FRONTERAS.md`.
- `agx/02_TRAZABILIDAD/01_HERENCIA_COMPATIBILIDAD_Y_REEMPLAZOS.md`, `02_DESCARTES_Y_NO_REGRESION.md`, `03_REGISTRO_HITOS_V4.md`, `04_ABIERTOS_Y_PRUEBAS_V5.md`, `05_COBERTURA_Y_LIMITES.md`.
- `agx/80_HERENCIA_V3_INTEGRA/01_NUCLEO/02_DIEZ_PV_Y_EXPERIENCIA_VISUAL.md`, `03_BTML_ESTRUCTURA_EPOCAS_Y_OPERACIONES_ABIERTAS.md`; `03_TRANSICION/ESPECIFICACION_EXPLORATORIA_V3_INTEGRA.md`, `AUDITORIA_CONTINUIDAD_V2_V3_INTEGRA.md`; `80_V2_INTEGRO/01_NUCLEO/02_BTML_ESTRUCTURA_Y_PREGUNTAS.md`; `80_V2_INTEGRO/90_FUENTES_CONSULTA/` (STATE_DECISIONES_DEL_USUARIO_2026-10-21, STATE_Auditoria_PV1_PV4_Recuperacion_Historica_2026-10-20, STATE_C3G_Gramatica_Generativa_10PV_v1.5, AGRAM_C2_Unidad_Decapolar_v0.4, AGRAM_PV8_R1_Calibracion_Dinamica_v1.1). Grep de «signo», «firmad», «diferencia», «orientación», «cero», «faltas», «excedentes», «reducir», «completar», «distancia», «dimensi» sobre los 64 archivos.
- `MAPA_GLOBAL_AGRAM.md` §10.4, §10.6, §12; `src/encaje.js`, `src/bql.js`, `src/motor.js`, `src/epocas.js`, `test/vector.test.js`, `ejemplos/ikisai/compra-food.mjs`, `docs/FUNDAMENTOS.md`, `app.js`.
