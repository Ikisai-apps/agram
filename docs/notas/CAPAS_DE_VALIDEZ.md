# Las cinco capas de validez

Nota de lectura para VG · 7-11-2026 · **No decide nada.** Recoge lo que dice el corpus (citas literales con archivo y línea), qué cubre hoy el código de `main` capa por capa y las opciones abiertas. Base: las dos lecturas y el juez del batallón anterior, comprobados de nuevo contra el corpus, contra el MAPA en su estado de esta tarde (§12, decisiones de VG del 7-11) y contra el código (`main` en `8d73b44`, 101 pruebas en verde). Lo que es deducción del asistente va marcado como tal.

Rutas abreviadas: `agx/` = raíz del paquete del corpus V4 (copia local de trabajo); `V2/` = `agx/80_HERENCIA_V3_INTEGRA/80_V2_INTEGRO/`; `V3/` = `agx/80_HERENCIA_V3_INTEGRA/`; `MAPA` = `MUELA/equipo/agram/MAPA_GLOBAL_AGRAM.md` (fuera de este repositorio); `06_EPOCAS` = `agx/01_NUCLEO_V4/06_EPOCAS_TIEMPO_EPRT_Y_FRONTERAS.md`; `04_AGRAM` = `agx/01_NUCLEO_V4/04_AGRAM_OPERACIONES_AUTORIZACION_Y_REGISTRO.md`.

> **Estado en `main` (`03dbf34`, 7-11 noche, tras la integración #55).** Las dos PR que §3 da por abiertas ya están en `main`: la #35 (series de tokens) se fusionó, y con ella **ya no es verdad que «solo el génesis emite»**: personas y grupos emiten su serie de E y de R, y P solo el génesis (`docs/FUNDAMENTOS.md`, «Series de tokens»); la #36 entró con la integración del 7-11 (#51): `PENDIENTE POR LÍMITE` con parciales y el gancho `puedeLeer`, que ahora recibe también el camino exacto (`docs/BQL.md` §9.6). La época 1 (propuesta) está en datos, pero sigue sin haber comprobación de forma bajo una época. La autorización declara su regla V0 en `contexto.autoridad.regla`. La opción B (un módulo de solo lectura con las cinco capas) está en `main` desde la #55 (`src/validez.js`, `docs/VALIDEZ.md`), sin veredicto global. Ninguna capa está decidida: los abiertos están en `docs/VALIDEZ.md` §8.

## 1. La cuestión en tres frases

1. V2 separó cinco capas de validez de un registro (forma y época; interpretable; criptográficamente comprobable; materialmente acreditado; autorizado y ejecutado); V3 y V4 las conservan, el MAPA las marca [A] y VG nunca las ha decidido como tales: el corpus solo pide que no se confundan y que PV5 las inspeccione sin garantizarlas.
2. El código cubre cada capa por separado y sin nombrarlas: forma entera; interpretación por slot y por referencia; id obligatorio y firma opcional; nada de acreditación material; y permiso en dos niveles internos (el libro de tokens y la regla V0 de la fábrica), sin la mitad externa.
3. Queda por decidir si se exponen juntas (dónde, con qué vocabulario y a qué grano) y varias piezas que el corpus deja abiertas: qué es acreditar, quién escribe el resultado de una ejecución, si las firmas son obligatorias y si quien da de alta debe probar la posesión de la clave.

## 2. Lo que dice el corpus

### 2.1 Qué son las cinco capas

`V2/02_CONTEXTO/05_PROTOCOLOS_EPRT_Y_VERIFICACION.md` l.28–34 (sección marcada [U/DOC/H]):

> «Separar expresamente:
> 1. **Validez de forma/época**: una interfaz construye una estructura compatible con reglas semánticas convenidas.
> 2. **Interpretable**: una lectura tiene contexto, tipo de resultado y resolución de referencias suficiente.
> 3. **Criptográficamente comprobable**: firmas, hash, procedencia de un registro o pertenencia a un compromiso correctamente revelado.
> 4. **Materialmente acreditado**: la afirmación sobre el mundo está apoyada en evidencia y garantías externas apropiadas.
> 5. **Autorizado/ejecutado**: una transición o acción cumple el protocolo de autoridad y sus efectos se han confirmado cuando corresponda.»

Repetidas en `V3/01_NUCLEO/04_TIEMPO_TOKENS_PROTOCOLOS_Y_GARANTIAS.md` l.29 («Cinco capas distintas de validez [V2]») y en `06_EPOCAS` l.33–39 («1. Forma/época/estructura. 2. Interpretación de contexto, referencias y posiciones. 3. Criptografía/procedencia. 4. Acreditación material. 5. Permiso/transición autorizada/ejecución comprobada.»). `MAPA` §2.8 l.102: «Cinco capas de validez (V2): forma y época, interpretación de contexto, criptografía y procedencia, acreditación material, permiso con transición autorizada y ejecución comprobada [A]. PV5 inspecciona señales de las cinco; no las garantiza [A].»

### 2.2 No son equivalentes ni se infieren una de otra

- `agx/01_NUCLEO_V4/01_MODELO_INTEGRADO_V1_A_V4.md` l.40: «Validez estructural ≠ interpretación suficiente ≠ firma/criptografía ≠ prueba material ≠ autorización.»
- `V3/03_TRANSICION/DELTAS_DECISIONES_ABIERTOS.md` l.41: «**Validez estructural ≠ interpretabilidad ≠ prueba criptográfica ≠ verdad material ≠ permiso.**»
- `V2/01_NUCLEO/02_BTML_ESTRUCTURA_Y_PREGUNTAS.md` l.63: «Las reglas/convenciones de la época pueden ayudar a **formar árboles válidos**. Validez estructural, interpretabilidad, verdad, firma y legitimidad de la actuación no son equivalentes.»

El corpus las formula siempre como negaciones o como «separar»; nunca como una secuencia de comprobación obligatoria.

### 2.3 PV5 inspecciona, no garantiza

- `V3/01_NUCLEO/04_…` l.37: «La **PV5 permite inspeccionar** indicios de estas capas, pero **no garantiza** ninguna por el simple hecho de abrir su vista.»
- `06_EPOCAS` l.41: «**PV5 permite inspeccionar señales, no garantizar las cinco capas**.»
- `agx/01_NUCLEO_V4/05_DIEZ_PV_UI_Y_MODOS.md` l.19: «**PV5 · estructura/inspección:** vista tipo JSON, referencias, IDs, firmas, capas de validez; es lente de comprobación, no garante central.»
- `agx/02_TRAZABILIDAD/02_DESCARTES_Y_NO_REGRESION.md` l.15: «No presentar PV5 como verdad, árbitro universal, certificado de privacidad ni autorización.»
- `V2/02_CONTEXTO/05_…` l.36: «mirar un hash no prueba que una afirmación sea verdadera ni que un tercero haya consentido asociar estructuras.»

### 2.4 La única instrucción de exponerlas

`V3/03_TRANSICION/AUDITORIA_CONTINUIDAD_V2_V3_INTEGRA.md` l.218: «### 01.17 Cinco capas de validez, confianza y verificación — RECUPERAR»; l.228: «**V3:** mantiene visualización frente a ejecución y PV5 JSON, pero **omite esta secuencia como tal**. **Acción:** incluir las cinco distinciones como parte estable de la lectura PV0/PV5/PV4. Ni ver hash demuestra verdad, ni ver un vínculo acredita consentimiento.» Es una acción de auditoría [A], no una decisión de VG.

### 2.5 Fronteras

- `04_AGRAM` l.5: AGRAM «**interpreta y construye** vistas y cambios […]; puede invocar servicios autorizados, pero **no** genera por sí mismo derechos, firmas, pruebas materiales, pagos ni ejecuciones».
- `04_AGRAM` l.33–34: «Ejecutar exige acto solicitante, permisos, reglas admitidas, condiciones, límites de gasto/tiempo/alcance y ejecutor apropiado (posiblemente AARPIA u otro).» «Registrar resultado diferencia éxito, rechazo, no ocurrido, ejecutado parcialmente, sin confirmación, etc. Una compra elegida o autorizada no equivale a una compra efectivamente hecha.» l.36: «Registro, autorización y verificación material permanecen fronteras independientes.»
- `06_EPOCAS` l.30: «**Nostr:** transporte/distribución de eventos firmados, payload de información libre; firma ≠ veracidad; publicación ≠ descubribilidad universal.» `V3/01_NUCLEO/04_…` l.24: «Una firma no hace que el contenido sea verdadero»; l.27: «**Frontera de implementación:** […] Una vista animada no prueba conectores, permisos, transmisión ni ejecución.»
- `MAPA` §2.8 l.102: «Hoy, por decisión de VG, quedan fuera salvo el corazón de AARPIA: instancias y transiciones [D, 6-11].» `MAPA` §12 l.249 [D]: «**AARPIA** es el motor real de autorización/ejecución; lo del motor (P>0 y no el autor; ejecuta el autor) es un hueco provisional.»

### 2.6 Correcciones de VG que rozan las capas

- `V2/01_NUCLEO/04_CORRECCIONES_DE_ESTA_CONVERSACION.md` l.18 (corrección 14): «**La interfaz es productora de validez.** Construir datos desde una interfaz guiada por la gramática de época ayuda a crear estructuras válidas; no igualar validez a verdad material.» Y l.11 (corrección 7): «**PV5 verifica.** Punto de vista de inspección estructural […]; **no asumir que construye toda composición**.»
- `V2/90_FUENTES_CONSULTA/STATE_DECISIONES_DEL_USUARIO_2026-10-21.md` l.225: «### D27 · Separar especificado, implementado, verificado y real [D]».
- `MAPA` §9 l.160 [D]: «**La época es una convención paralela, no un atributo del dato.**» Consecuencia directa para la capa 1: «según las reglas de la época» solo puede comprobarse bajo la época elegida al leer, nunca guardarse en el registro.
- `MAPA` §9 l.162 [D/O]: «En el centro queda el registro concreto en foco, el JSON que se visualiza: eso es PV5. Una lente sobre él da PV0». La consecuencia «PV5 no es una lente de inspección sino el propio registro en foco» (l.164) está marcada [YO/!]: es lectura del autor del mapa, no corrección de VG.

### 2.7 Lo que falta no es falso: los estados de BQL

`agx/01_NUCLEO_V4/03_BQL_SINTAXIS_SEMANTICA_Y_EJEMPLOS.md` l.46: «Estados principales V0: **RESUELTO** (evaluación suficiente), **PENDIENTE** (dato/criterio/elección o contexto falta), **INCOMPATIBLE** […], **ERROR** […]. PENDIENTE DE AUTORIZACIÓN es estado operativo distinto de fracaso de cálculo; agotamiento de recursos puede ser PENDIENTE POR LÍMITE con parciales señalados. Datos faltantes en FILTRAR no se transforman en “false”».

### 2.8 Vocabularios de estado: todos provisionales

- C2 (`V2/90_FUENTES_CONSULTA/AGRAM_C2_Unidad_Decapolar_Composicion_Recursiva_v0.4-candidata.md`) l.66: «cada PV expone un estado lógico de esta familia provisional» (`present`, `derived`, `linked`, `unknown`, `unresolved`, `withheld`, `not_applicable`, `disputed`); l.79: «**[ABIERTO]** El vocabulario normativo final, estados compuestos y pruebas para `not_applicable`. […] un estado único por PV puede» ser demasiado grueso.
- Contrato v0.2 (`…/AGRAM_Contrato_Construccion_Transmision_Reconstruccion_v0.2.md`) l.293: «Los estados pueden coexistir por campo o afirmación. No colapsarlos en una puntuación global inventada.»
- `MAPA` §12 l.265 [D, VG 7-11 tarde]: «Sin «no aplicable»». Descarta al menos `not_applicable` de la familia C2 para las posiciones.

### 2.9 Decisiones de VG del 7-11 que tocan las capas 3 y 5

- `MAPA` §11 l.239 [A]: «**Autoridad mínima:** ECDSA P-256; clave por identidad (génesis o declarada por quien da de alta en el mismo evento que da tokens); quien tiene clave firma y el eje verifica; nadie mueve tokens ajenos. **Límite conocido:** quien da de alta declara la clave sin prueba de posesión (quién registra identidades = decisión de VG).» `MAPA` §10.5 l.218 [X]: «autoridad/firmas de cartón».
- `MAPA` §12 l.255 [D]: «**Las series de tokens son una constante y se estandarizan** […] T = siete tokens, uno por escala […]; E = denominaciones emitidas en serie limitada por quien las respalda […]; P por ámbito; R por emisor. […] Nadie emite denominación ajena; solo el emisor amplía su serie.»
- `MAPA` §12 l.260 [D]: «**Poder de recepción y reputación:** la casa escribe un registro de dominio («Alojamiento») y delega P con ese ámbito; recepción autoriza lo que cuelga de ahí y puede delegar hacia abajo.»
- `MAPA` §12 l.262 [D]: «las COSAS (objetos, elementos) SÍ son titulares: con AARPIA tienen clave privada y pública, firman por sí mismas, tienen cartera, reciben y envían tokens según sus reglas de criterio. Lo único reservado a PERSONAS y GRUPOS es EMITIR (iniciar) tokens».

## 3. Lo que hoy hace el código, capa por capa

| capa | qué hay | dónde | qué falta |
|---|---|---|---|
| 1 · forma | `validarForma`: autor, `sobre` id o null, `en` de diez dígitos, `t` ISO, movimientos no vacíos, el autor mueve T, payload terminal o array 1–10 sin nulos ni huecos | `src/evento.js` l.57–76; `src/btml.js` `validarPayload`; `eje.validar` la llama (`src/eje.js` l.109) | **época**: no hay comprobación bajo una época (`src/epocas.js` solo tiene `EPOCA_0.reglaCorta`, nominal); `validarPayload` no limita la profundidad |
| 2 · interpretable | estados BQL `RESUELTO`/`PENDIENTE`/`INCOMPATIBLE`/`ERROR` por slot; referencias rotas marcadas `rota: true` con su `procedencia` | `src/bql.js` l.26; `src/encaje.js` `seguir` l.158 y l.165 | `eje.validar` no comprueba que las referencias del payload existan: un `{ref: 'inexistente'}` entra en el eje y solo falla al leer o al consolidar («fuente desconocida»); no hay «este registro es interpretable»; no hay permisos de lectura (`04_AGRAM` l.14 los pone en RESOLVER) |
| 3 · criptografía y procedencia | `id` = SHA-256 del cuerpo canónico, verificado al añadir; Schnorr BIP-340 (antes ECDSA P-256; `docs/notas/FIRMAS_BIP340.md`); quien tiene clave firma y `firmante === autor`; claves declaradas solo para identidades nuevas que reciben tokens en ese evento | `src/evento.js` l.79; `src/eje.js` l.110, l.116–129; `src/autoridad.js` | `exigirFirmas = false` por defecto (`src/eje.js` l.11): un autor sin clave escribe sin firma; sin prueba de posesión; sin anclaje ni «pertenencia a un compromiso» |
| 4 · acreditación material | nada; el código no lo pretende | `src/motor.js` l.200: la `evidencia` de `ejecutar` son ids internos | todo: no hay forma de escribir ni de leer una acreditación externa |
| 5 · permiso y ejecución | libro de tokens: «solo el génesis emite», «nadie mueve tokens ajenos», saldo suficiente, P con ámbito, simulación sobre una vista; fábrica: `puedeAutorizar` = P > 0 sobre el hilo y no ser el autor, `autorizacionesValidas` descarta lo escrito por quien no puede, `estadoDe` → `PENDIENTE DE AUTORIZACIÓN` / `AUTORIZADO` / `EJECUTADO` | `src/eje.js` l.131–149; `src/motor.js` l.151–154, l.205–217; `test/motor.test.js` l.68–70 | la mitad externa: «efectos confirmados», resultado (éxito, rechazo, no ocurrido, parcial, sin confirmación); `EJECUTADO` hoy significa «la transición de tokens entró en el eje», no «ocurrió fuera»; la regla es V0 provisional [D] |

En la interfaz (`app.js`, sin tocar): «✓ firmado / sin firma» en la cabecera (l.87); estado BQL por slot; el JSON del registro en la celda 5 de Mapped; en la fábrica, el estado y si el visor puede autorizar (l.242) y el rótulo «consolidar no es ejecutar» (l.260). Son señales de las capas 2, 3 y 5 sin nombrarlas; no hay señal de la capa 1 (solo el rechazo al escribir) ni de la 4.

`eje.validar` (`src/eje.js` l.108–150) devuelve una lista plana de mensajes que mezcla capas: forma («payload …»), criptografía («firma inválida de …»), permiso («saldo insuficiente de …»).

PR abiertas, sin fusionar, que tocan las capas: **#35** (series de tokens: emisión de E por su emisor, `nadie emite una denominación ajena`; capa 5, libro); **#36** (BQL según el corpus: `PENDIENTE POR LÍMITE` con parciales y un gancho opcional `puedeLeer(evId, dir)` que devuelve `PENDIENTE DE AUTORIZACIÓN` al leer; capa 2 y la cuestión de los permisos de lectura).

### El ejemplo: la compra del menú

Sin claves (`ejemploCompra()`): los cinco registros entran sin firma. La compra es forma válida (array de cinco, sin huecos, el autor mueve T); sus posiciones 1–4 se resuelven; id verificado, sin firma; ninguna acreditación; en el libro, 1 h de T de huésped y 12 EUR de huésped a cocina. Si cocina escribe a mano `{ fase: 'autorizado' }` sobre una consolidación de huésped sin tener P sobre ese registro (`test/motor.test.js` l.68–70), el estado sigue en `PENDIENTE DE AUTORIZACIÓN` y la interfaz no lo muestra: el escrito existe, pero no cuenta.

## 4. Opciones para VG

A y B son excluyentes; C depende de B; D–J son decisiones que hacen falta con B y casi todas tienen sentido por sí solas. No se recomienda ninguna.

### A · No exponer las capas todavía

- Qué es: dejar las señales sueltas que ya hay y esperar a que AARPIA y el uso real digan qué hace falta. Coherente con que el corpus solo tiene una acción [A] de auditoría, no una decisión.
- Cambio en código: ninguno. Una nota en `docs/FUNDAMENTOS.md`, junto a «AARPIA e identidades» (l.47–49): el código cubre forma, interpretación por slot, id y firma opcional y permiso interno; acreditación material y efectos externos no existen.
- Ejemplo: la compra se ve como hoy: cabecera «sin firma», slots coloreados por estado BQL, la fábrica con «pendiente de autorización».

### B · Módulo de solo lectura `src/validez.js`

- Qué es: `capas(eje, id)` devuelve cinco entradas independientes, sin puntuación agregada, sin efectos y sin campos nuevos en el evento (guardar la validez en el evento convertiría una lectura en dato, contra «PV5 inspecciona, no garantiza»). La capa 4 es siempre «sin acreditar»; la 5 va en tres partes (libro, fábrica, externa).
- Cambio en código: `src/validez.js`, exportado en `src/index.js`. Reutiliza `validarForma` y `verificarId` (`src/evento.js`), `autoridad.verificar`, `bql.evaluar`, `encaje.seguir`/`ocupantes`, `motor.estadoDe`/`autorizacionesValidas`, `eje.poderSobre`, `eje.sobre`, `eje.claves`. Los textos en una constante, para cambiarlos cuando VG elija vocabulario (D). `test/validez.test.js` sobre los cinco registros del menú, con y sin claves.
- Ejemplo: `validez.capas(eje, compra.id)` sin claves → forma: válida (leída bajo época 0); interpretación: posiciones 1–4 resueltas, 0 referencias rotas; criptografía: id verificado · sin firma (autor sin clave) · sin anclaje; acreditación: sin acreditar; permiso: libro = movimientos admitidos, fábrica = no es consolidación, externa = sin confirmación.

### C · Las cinco capas en PV5

- Qué es: cinco líneas sobrias, una por capa, encima del JSON de la celda 5 de Mapped y en la cabecera de Pointed, en lugar del «✓ firmado / sin firma» suelto; y en la fábrica, lo escrito por quien no puede aparece como «no cuenta». Es la acción 01.17 de la auditoría. Depende de B.
- Cambio en código: `app.js` (celda 5 de Mapped, cabecera de Pointed, panel de la fábrica) llama a `validez.capas` y pinta cinco líneas; se mantiene el detalle del JSON.
- Ejemplo: el caso de `test/motor.test.js` l.68–70 en pantalla: «5 permiso: PENDIENTE DE AUTORIZACIÓN · escrito de cocina, no cuenta (sin P sobre este registro) · regla V0 provisional». Es, literalmente, «ver un vínculo no acredita consentimiento».

### D · Vocabulario de estados por capa

- Qué es: cuatro candidatos, todos del corpus y ninguno ratificado. D1: los estados BQL para todas las capas. D2: la familia C2 (sin `not_applicable`, descartado esta tarde). D3: los resultados del contrato v0.2 (Conforme, Inconsistente, Insuficiente, Contradictorio, No accesible, No resoluble). D4: una palabra en español por capa y estado (válida/inválida; interpretable/parcial/no interpretable; verificado/sin firma; sin acreditar; admitido/pendiente/autorizado/ejecutado/sin confirmación). Lo único prohibido en todos los casos es reducir a «válido/no válido» o a una puntuación.
- Cambio en código: una constante `ESTADOS_CAPA` en el módulo de B y los textos de `app.js`.
- Ejemplo: la cuenta con `=REF("<id inexistente>", "1200000000") + 2 EUR`: D1 → interpretación `ERROR` (o `PENDIENTE` si entra la PR #36); D2 → `unresolved`; D3 → No resoluble; D4 → no interpretable. En los cuatro casos forma, criptografía y permiso siguen válidos: ese es el valor de tenerlas separadas.

### E · Grano: registro, posición u ocupante

- Qué es: C2 avisa de que un estado único por PV es grueso; el contrato v0.2 dice que «los estados pueden coexistir por campo o afirmación». Las capas 1, 4 y 5 son del registro en cualquier caso; la 2 y la 3 pueden bajar a posición u ocupante.
- Cambio en código: firma de `capas(eje, id)` (registro), `capas(eje, id, indices)` (posición, vía `encaje.ocupantes`), o capas 2 y 3 como lista por ocupante con su `procedencia`.
- Ejemplo: la posición 1 de la compra tiene cuatro ocupantes (propio `[1]`, propio `[1.0]`, la referencia a menú:1 y la cuenta escrita). Por registro: interpretable. Por ocupante: si cocina tuviera clave y huésped no, la cuenta escrita sería «firmada» y la compra «sin firma».

### F · Capa 4 mientras no haya nada externo

- Qué es: F1, constante «sin acreditar» (lo único que el corpus garantiza). F2, además, listar las declaraciones de terceros escritas sobre el registro como declaraciones, nunca como pruebas. F3, añadir «disputado» cuando dos declaraciones se contradigan, lo que exige una regla de contradicción que no existe.
- Cambio en código: F1: la constante. F2: `eje.sobre(id)` filtrado por autores distintos del autor, con su firma. F3: nada hasta tener la regla.
- Ejemplo: tras pagar 14 EUR, cocina escribe «servido» y huésped «recibido». F1: «sin acreditar». F2: «sin acreditar · 2 declaraciones: cocina “servido” (sin firma), huésped “recibido” (sin firma)». F3: si huésped escribiera «no me sirvieron», nadie puede hoy decir que contradice a «servido»: son texto libre.

### G · Firmas, claves e identidades

- Qué es: G1, mantener `exigirFirmas = false` y mostrar «sin firma (autor sin clave)» como estado válido de la capa 3. G2, `exigirFirmas = true` por defecto. G3, prueba de posesión al dar de alta (la identidad nueva firma también el alta, o un segundo evento suyo antes de aceptar sus escritos). Con la decisión de esta tarde (§2.9: las cosas son titulares y firman por sí mismas con AARPIA; solo personas y grupos emiten), G3 alcanza también a las cosas, y la capa 3 tendría que distinguir quién firma (persona, grupo o cosa) cuando eso se declare en el alta.
- Cambio en código: G1: nada. G2: `src/eje.js` l.11 y l.24 (`exigirFirmas = true`); `ejemploCompra()` deja de funcionar sin claves; `test/autoridad.test.js` ya cubre el modo estricto. G3: en `eje.validar` (l.125–129) exigir, para cada clave declarada en `contexto.claves`, una firma de esa identidad sobre el alta; cambia `crearEvento`, el cuerpo del evento y `docs/BTML.md` §7.
- Ejemplo: hoy el alta de cocina, hecha por la casa, declara la clave de cocina sin que cocina demuestre tenerla. Con G2 un génesis sin clave lanza «el génesis debe ir firmado» (l.37). Con G3 el alta se rechazaría salvo que cocina firme también, y la capa 3 pasaría de «clave declarada por casa, sin prueba de posesión» a «clave con posesión probada».

### H · La mitad externa de la capa 5: el resultado

- Qué es: cómo entra en el eje el resultado de una ejecución y quién lo escribe. H1: solo el ejecutor, sobre su propio «ejecutado». H2: cualquiera con P sobre el hilo. H3: nada hasta AARPIA, y mientras tanto «sin confirmación» constante. Es la misma pieza que la opción F de `docs/notas/FABRICA_10X10.md`.
- Cambio en código: H3: nada. H1/H2: en `src/motor.js`, fase `resultado` con `contexto.resultado ∈ {éxito, rechazo, no ocurrido, parcial, sin confirmación}` escrita sobre el «ejecutado», y `estadoDe` → «EJECUTADO · <resultado>» solo si lo escribe quien puede. Sigue siendo una declaración interna: la capa 4 no sube.
- Ejemplo: huésped declara «parcial» (le sirvieron el guiso, no la fruta): PV5 mostraría «5 permiso: EJECUTADO · resultado declarado por el ejecutor: parcial · externa: sin confirmación» y «4 acreditación: sin acreditar».

### I · Capa 1 y época

- Qué es: I1, solo un dato informativo «leída bajo época N» hasta que existan reglas más allá de la época 0. I2, cuando existan, `epoca.validar(payload)` dice si el árbol es legible bajo la época elegida, sin guardarlo. Ambas respetan «la época está fuera del dato» [D]; I2 es la corrección 14 («la interfaz es productora de validez») llevada a la lectura.
- Cambio en código: I1: un campo en la capa 1 de B. I2: método opcional `validar(payload)` por época en `src/epocas.js` (con la PR #33, en los datos de la época); `escribirDesde` podría avisar, no rechazar.
- Ejemplo: hoy toda compra es «válida · leída bajo época 0». Si una época posterior dijera que bajo `1` la profundidad 1 es «qué, cuánto, a qué precio», `[→menú:1, 1, 'EUR 12']` sería legible y `[1, 'EUR 12']` sería «válida · no legible bajo esa época: falta qué», sin dejar de estar en el eje.

### J · Errores de `eje.validar` etiquetados por capa

- Qué es: un cambio pequeño que hace visible la separación en el propio rechazo, útil para los borradores en la interfaz.
- Cambio en código: `src/eje.js` l.108–150: `errores.push({ capa, mensaje })` (forma = 1; id, firma y claves = 3; movimientos y saldos = 5); `anadir` sigue lanzando `Error('evento rechazado: ' + mensajes.join('; '))` para no romper las pruebas ni `docs/BTML.md`.
- Ejemplo: un borrador con firma inválida y 100 EUR que no tiene da hoy «evento rechazado: firma inválida de bea; saldo insuficiente de E:EUR en bea». Con J: `[{ capa: 3, mensaje: 'firma inválida de bea' }, { capa: 5, mensaje: 'saldo insuficiente de E:EUR en bea' }]`, y el formulario puede decir «criptografía: firma inválida · permiso: saldo insuficiente».

## 5. Lo que no se puede decidir desde el corpus

1. **Si las capas se exponen** como estados de un registro: el corpus solo tiene la acción 01.17 de la auditoría [A] y la mención «capas de validez» en PV5 (V4 05 l.19).
2. **El orden y la obligatoriedad**: nada dice que fallar una capa bloquee la comprobación de otra. La única cadena obligatoria que existe es interna a la capa 5 (consolidado → autorizado → ejecutado).
3. **El vocabulario** (D) y **el grano** (E): todos los candidatos son provisionales («[ABIERTO] el vocabulario normativo final»).
4. **Qué es operativamente acreditar** (capa 4): quién atesta, con qué formato, si vive como evento del eje o fuera de él, y qué convierte dos declaraciones en «disputado».
5. **Quién escribe el resultado** de una ejecución y con qué autoridad (H); si esa confirmación es la capa 4 o otra cosa; cómo se representará en el eje una autorización o una ejecución de AARPIA.
6. **Firmas y altas** (G): si un autor sin clave es aceptable, quién da de alta identidades y si debe haber prueba de posesión (`MAPA` §11 l.239: «decisión de VG»); cómo firma un grupo (`MAPA` §12 l.261: «es de AARPIA»).
7. **Qué significa comprobar «época»** en un registro cuando la época está fuera del dato (I); el corpus V2/V3 hablaba de «reglas de la época» cuando la época aún se pensaba dentro del árbol.
8. **Qué son los «permisos de lectura»** (`04_AGRAM` l.14) y a qué capa pertenecen (2 o 5); la PR #36 propone un gancho, sin regla.
9. **Cómo se escribe «desconocido» o «reservado»** en una décupla sin null (`MAPA` §4.6 [X]); esta tarde VG ha descartado «no aplicable», no los demás.
10. **Si PENDIENTE DE AUTORIZACIÓN y PENDIENTE POR LÍMITE** se unifican con los estados BQL o siguen separados (`docs/BQL.md` l.643: hoy el primero es fase del motor y el segundo no existe en `main`).

## Fuentes leídas

- Diario del batallón anterior: `leer:capas-validez:0`, `leer:capas-validez:1`, `juez:capas-validez`.
- `V2/02_CONTEXTO/05_PROTOCOLOS_EPRT_Y_VERIFICACION.md`; `V2/01_NUCLEO/02_BTML_ESTRUCTURA_Y_PREGUNTAS.md`, `04_CORRECCIONES_DE_ESTA_CONVERSACION.md`; `V2/90_FUENTES_CONSULTA/` (STATE_DECISIONES_DEL_USUARIO_2026-10-21, AGRAM_C2 v0.4, contrato v0.2); `V3/01_NUCLEO/04_TIEMPO_TOKENS_PROTOCOLOS_Y_GARANTIAS.md`; `V3/03_TRANSICION/AUDITORIA_CONTINUIDAD_V2_V3_INTEGRA.md`, `DELTAS_DECISIONES_ABIERTOS.md`; `agx/01_NUCLEO_V4/01_MODELO_INTEGRADO_V1_A_V4.md`, `03_BQL_SINTAXIS_SEMANTICA_Y_EJEMPLOS.md`, `04_AGRAM_OPERACIONES_AUTORIZACION_Y_REGISTRO.md`, `05_DIEZ_PV_UI_Y_MODOS.md`, `06_EPOCAS_TIEMPO_EPRT_Y_FRONTERAS.md`; `agx/02_TRAZABILIDAD/02_DESCARTES_Y_NO_REGRESION.md`.
- `MAPA` §2.8, §4.6, §9, §10.5, §11, §12 (incluidas las decisiones del 7-11 tarde).
- `src/evento.js`, `src/eje.js`, `src/autoridad.js`, `src/btml.js`, `src/bql.js`, `src/encaje.js`, `src/motor.js`, `src/epocas.js`, `test/motor.test.js`, `test/autoridad.test.js`, `docs/BQL.md`, `docs/FUNDAMENTOS.md`, `app.js` (solo lectura), `ejemplos/ikisai/compra-food.mjs`; PR #35 y #36 (descripción).
