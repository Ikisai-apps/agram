# Inventario: de código a reglas

Nota de lectura · 9-11-2026 · Base: `main` en 24ef6c5 · No cambia código ni tests y no decide nada.

**Estado en `main`.** Desde la capa cero (paso 1 del mapa §16, `docs/notas/CAPA_CERO.md`), las reglas de `src/eje.js`, `src/ciclo.js` y `src/lente.js` que esta tabla localiza son condiciones de validez de una transacción en `src/condiciones/`, envueltas tal cual y nombradas por sus filas; `reglasDelTope` vive en `src/condiciones/tope.js`, y el estado del §4 (saldos, bloqueos, series, T gastado, T sobre cada registro) se lee del libro (`src/libro.js`). La columna «Hoy» es de antes: lo que dice `eje.js:validar`, `eje.js:reglasDelTope` o `eje.js:erroresGenesis` está ahora en `src/condiciones/` (`evento.js`, `identidad.js`, `tope.js`), y la tabla del §3 de `CAPA_CERO.md` da la condición de cada fila.

**Para qué.** VG, 8/9-11 (mapa §15 [D], «Todo son reglas; BQL mínimo; el árbol de registro mínimo»): «todas las reglas de funcionamiento tienen que estar como reglas cortas y largas, definidas en BQL y usadas desde las reglas, no desde código hardcodeado. Este es el punto principal de todo». BQL ha de encoger hasta ser álgebra sobre la matriz BTML; lo que sea «escoger algo concreto» pasa a ser una posición BTML definida por reglas; y el estado del eje (cartera, P, bloqueos, gastado del día, lente, capacidad) ha de existir como registros legibles por posición, como ya pasa con el 8. Esta nota es el primer paso del orden de trabajo acordado allí: el inventario.

**Qué hay y qué no.** Por encargo de Core (recorte del 9-11), la nota tiene cinco partes: (1) el suelo, lo que se queda como código; (2) la tabla de reglas que hoy viven en JavaScript, que es el producto; (3) las funciones de BQL de hoy, clasificadas, sin proponer el léxico final; (4) el estado que hoy guardan las estructuras internas, solo como inventario; (5) lo que no he sabido expresar. El léxico mínimo y el árbol de registro mínimo son diseño: los deciden Core y VG, y aquí no van.

**Cómo leer las posiciones de la tabla 2.** Son una **hipótesis de trabajo [H]** para poder rellenar la columna, no un diseño. Siguen la plantilla que dio Core para el encargo (el alta de una identidad: 1 cartera, 2 criterios y P posicionado, 3 lente y R, 7 tiempo y asignación; un registro de recurso: 2 capacidad y criterio de recuento, 8 base) y las decisiones de VG que ya dan sitio a algo (autor = PV3 y fecha = PV6, §14 [D]; bases en el 8, §12 [D]; fábrica en el 4, §12 [D]; lente en el 3 del alta, §12 R6). La línea de BQL de cada regla está escrita con la notación de trabajo de abajo, que **no** es una propuesta de léxico: solo dice qué operaciones necesita cada regla.

---

## 1. El suelo

Lo que debe quedarse como código porque no es una regla de funcionamiento sino lo que las reglas necesitan para existir:

- **BTML**: la forma del payload (terminal, décupla, lista por hojas, sin huecos ni nulos, raíz ≤ 10), las direcciones de diez dígitos con ceros finales, `resolver` y `nodoEn`.
- **Evento**: JSON canónico, hash SHA-256 como id, firma Schnorr BIP-340 (antes ECDSA P-256; `docs/notas/FIRMAS_BIP340.md`) y prueba de posesión (verificar es criptografía, no regla), instante ISO estricto en UTC, congelado, y la **llegada** (el orden de entrada en el eje).
- **Aritmética de saldos por serie**: la clave de serie (`claveToken`, `partirClave`), aplicar los movimientos de un evento en orden sobre una vista (todo o nada), disponible y bloqueado por salida.
- **Intérprete de BQL**: tokenizar, analizar, evaluar, los cuatro estados y sus subtipos, la pila de ciclos, el presupuesto, el gancho de lectura `puedeLeer`.
- **Reconstrucción**: ocupantes de una dirección (propio por ceros finales, lo que alcanza una referencia, lo escrito anclado ahí) y seguir referencias; el hilo por `sobre`.
- **Cargador de épocas**: `cargarEpoca`, `leerDireccion`, `leerCamino`, herencia del respaldo.
- **Persistencia**: guardar la lista de eventos y restaurar revalidándolos uno a uno.

Por módulo (los códigos de la columna derecha son las filas de la tabla 2):

| Módulo | Parte que es suelo | Reglas disfrazadas de código |
|---|---|---|
| `src/btml.js` | todo: forma, lista y décupla por hojas, direcciones, `resolver`, `dentroDeLista`, `nodoEn` | ninguna |
| `src/evento.js` | `canonico`, `hash`, `cuerpo`, `crearEvento`, `normalizarEvento`, `congelar`, `verificarId`, la parte de forma de `validarForma` | EV-1, EV-2, EV-3, TT-5 (dentro de `validarForma`, `esConsumoT`, `esPresente`) |
| `src/instante.js` | todo: ISO estricto con zona, `msUTC` | ninguna (lo usa D-FECHA) |
| `src/autoridad.js` | todo: claves, `firmar`, `verificar`, `firmarPosesion`, `verificarPosesion`, `clavePublicaValida` | ninguna (exigir firma o posesión está en el eje: ID-4 a ID-7) |
| `src/tokens.js` | `FAMILIAS`, `SERIE`, `claveToken`, `partirClave`, `esIdRegistro`, la forma de `validarMovimiento` (campos y tipos) | TT-2, TT-5, TT-7, TT-16, EE-2, EE-3, EE-4, RR-1, PP-1, BL-1, ID-3, ID-9 (`ASIGNACION_T`, `PARTES_T`, `ESCALAS_*`, `capacidadDe`, `franjaDe`, `familiaDe`, `TIPOS`, `EMITEN`, `SEGUNDOS`, partes de `validarMovimiento`) |
| `src/eje.js` | la lista de eventos, los índices (`hijos`, `#hijosEn`, `#prefijos`, `#porAutor`, `#llegada`), `#aplicar` como aritmética de saldos, la simulación de saldos de `validar`, `hilo`, `sobre`, `sobreDe` | ID-1, ID-2, ID-4 a ID-8, GN-1, GN-2, TT-3, TT-10, TT-11, RL-4, EE-1, EE-5 a EE-12, PP-4, PP-6, BL-2, BL-3, RR-2, VA-3 |
| `src/ciclo.js` | nada | todo el módulo: ID-3, ID-9, ID-10, TT-1, TT-4, TT-6, TT-8, TT-9, RL-1 a RL-3, PP-2, PP-3, PP-5, PP-7, ES-1 a ES-3, EE-9, VA-3 |
| `src/autorizacion.js` | el «lector» (leer igual el eje de ahora y el de antes) | todo lo demás: AU-1 a AU-9 |
| `src/motor.js` | nada propio (llama a la escritura y al eje) | AU-10 a AU-14, FA-1 a FA-4, BL-4, TP-2, TP-3 |
| `src/elegibles.js` | nada | todo: EN-6 a EN-9 |
| `src/lente.js` | el índice incremental (ya es una lectura materializada de los eventos) | RR-3 a RR-9 |
| `src/bases.js` | `fundir` y la forma del payload de una base (álgebra y forma) | OC-1 a OC-15 |
| `src/tiempo.js` | nada | TT-13, TT-14, TT-17, TP-1 |
| `src/modos.js` | `contenido`, `orden`, `recortar`, `admitir` como álgebra de recuento | MO-1 a MO-7, TT-12 (los números de cada modo y de cada escala) |
| `src/escritura.js` | `construir` (forma canónica de la salida), `item` (lectura de la entrada del formulario) | FA-5 a FA-11, TT-15 |
| `src/encaje.js` | `caminosDe`, `ocupantes`, `seguir`, `lista`, `vector` (resta de direcciones), `acuerdo` | EN-1 a EN-5 (qué ordena y qué no; el tope de saltos) |
| `src/validez.js` | `libroAntes` (relectura del libro hasta un evento), la forma de los partes de capa | VA-1, VA-2; repite casi todas las demás con el libro de antes |
| `src/epocas.js` | todo el cargador | `CORTES_PROVISIONALES` como respaldo de código (OC-8) |
| `src/bql.js` | el intérprete entero | BQ-1 a BQ-5, EN-7 (dentro de `BUSCAR`), OC-13, RR-8 (dentro de `BASES`, `CAJA`, `FRESCURA`, `VALOR_R`, `LENTE`), `exigirSerie`, `comoEscribirla` |
| `src/persistencia.js` | todo | la marca del prefijo v2 (VA-3) |

Una lectura de conjunto: siete reglas **ya leen posiciones** BTML (umbral en el 2, capacidad en el 2, elegibles en el 2.3 y el 3, lente en el 3 del alta, fábrica en el 4, tramo en el 7, bases en el 8). Todas las demás leen estructuras internas del eje o campos de `contexto`.

---

## 2. Reglas que hoy viven en JavaScript

### 2.1 Notación de trabajo (no es léxico)

| Signo | Qué quiere decir | Hoy en BQL |
|---|---|---|
| `r.d` | la dirección `d` del registro `r` (`1.2` = `1200000000`) | — |
| `⟨r.d⟩` | traer: los ocupantes de `r.d` (colección, en orden de encaje) | `REF`, `LOCAL`, `BUSCAR` |
| `M{k}` · `M{−1}` | el ocupante `k` por llegada · el último | `BUSCAR(n, k)` |
| `M·x` | aplicar: la posición `x` de cada elemento de `M` (transponer) | `ACTUAL(x)` dentro de `FILTRAR` |
| `M[cond]` | filtrar: los elementos de `M` que cumplen `cond` | `FILTRAR` |
| `#M` · `ΣM` · `máx M` | contar · sumar · máximo | `CONTAR`, `SUMAR`, — |
| `↑r` | desplazar: el hilo de `r` hasta el génesis (r, su `6.5`, el `6.5` de ese…) | — |
| `+ − × ÷ ⌊⌋` · `= ≠ < ≤` · `∧ ∨ ¬ ∈` | aritmética, comparación, lógica | operadores, `Y`, `O`, `NO` |
| `← x` | colocar `x` (solo reglas que escriben: la fábrica) | — |
| `ε·nombre` | un dato de la época (una posición de su árbol; su dirección la fija el árbol mínimo) | — |
| `ev`, `X`, `g`, `alta(Y)` | el evento que se valida, su autor (`⟨ev.3⟩`), el génesis, el registro de alta de `Y` | — |
| `@antes` | la lectura materializada hasta justo antes de `ev` (su «hasta») | — |

**Corta o larga** [H]: corta = la regla cuelga de un dígito y vale en cualquier ruta que pase por él (rige todo evento o toda posición de ese dígito); larga = vale solo en una ruta concreta (el 2.3 de un registro, el 3 de un alta, el 4 de la fábrica, el 8).

### 2.2 Despliegues y lecturas materializadas que usa la tabla

Reglas de despliegue (hacen que una posición exista a partir de un dato que hoy no la tiene) [H]:

| Código | Despliega | En |
|---|---|---|
| D-META | los metadatos del evento como ocupantes implícitos: autor y firmante → `ev.3`; `t` → `ev.6.0`; `sobre` y `en` → `ev.6.5`; id → `ev.5`; movimientos → `ev.1` | diseño [H] de Fable (§14, «metadatos como ocupantes implícitos») sobre la decisión de VG «autor y fecha son puntos de vista» [D] |
| D-MOV | un movimiento → décupla: 0 serie · 1 cantidad · 2 estado y salida · 3 de, a · 5 registro (E) · 7 caduca o refiere · 9 nota | `ev.1{k}` |
| D-FECHA | un instante → décupla por escala de T: la posición k es el número de periodo en la escala k (0 segundo … 3 día civil UTC, 4 semana, 5 ciclo, 6 año) | `ev.6.0`, `r.7` |
| D-SERIE | una clave de serie → décupla: 0 familia · 1 emisor, escala o ámbito · 2 denominación · 5 registro · 7 franja | una serie |
| D-ALTA | el alta de `Y`: el primer evento con `Y` como destino en `⟨·.1⟩·a` | `g.3` |
| D-VALOR | un terminal «12 EUR» → su anatomía de profundidad 2 (2.1 cuánto, 2.2 unidad) | REGLAS_CORTAS, duda 3 [X] |

Lecturas materializadas (registros de estado escritos o leídos «hasta» un evento, como el 8) [H]:

| Código | Qué guarda | Dónde |
|---|---|---|
| M-ALTAS | identidades: alta, tipo, clave | `g.3` |
| M-CARTERA | saldos de `Y` por serie: disponible y bloqueado por salida (`1.<serie>.2`) | `alta(Y).1` |
| M-P | el P de `Y` y en qué registros está | `alta(Y).2` |
| M-R | la serie `R:Y`: emitido, colateral, devoluciones y su atención, obligación; y la lente de `Y` (ya está ahí) | `alta(Y).3` |
| M-T | T gastado por día civil y escala | `alta(Y).7.<día>.<escala>` |
| M-SERIE | las series de E atadas a `r`: contrato, emitido, consumido, vivo por franja | `r.1` |
| M-FABRICA | el peso de la autorización de una consolidación `c`: bloqueos con salida `c`, actos de respaldo | `c.4` |
| M-RELOJ | el mayor `t` aceptado, por autor | `g.6` |
| M-8 | la base del 8 (ya existe) | `r.8` |

### 2.3 La tabla

Columnas: código · regla · dónde está hoy · posición BTML que haría falta · despliegue · BQL mínimo · corta (C) o larga (L) · qué decisión la respalda (mapa global, `MAPA`; «§15 retira» marca lo que la conversación del 8-11 ya da por cambiar).

#### Evento

| # | Regla | Hoy | Posición | Despliegue | BQL mínimo | C/L | Respaldo |
|---|---|---|---|---|---|---|---|
| EV-1 | Todo evento mueve tokens (el génesis puede no mover nada) | `evento.js:validarForma` | `ev.1` | D-META | `#⟨ev.1⟩ ≥ 1 ∨ ev = g` | C | §10.1 [D] «todo evento ES una transición de tokens» |
| EV-2 | Escribir consume T del autor: de = autor, a = nada, sin estado | `evento.js:validarForma`, `esConsumoT` | `ev.1`, `ev.3` | D-MOV | `#⟨ev.1⟩[familia=T ∧ de=X ∧ a=∅ ∧ estado=∅] ≥ 1` | C | §12 [D] «T, corregido por VG» (1) |
| EV-3 | Un registro es presente si consume T real; el pagado solo con T informativo no lo es (desde VG 13-11, #76, la época 0 exige a todo registro el coste en T real, así que no admite uno así) | `evento.js:esPresente`; `bql.js` `PRESENTE` | `ev.1` | D-MOV | `#⟨ev.1⟩[familia=T ∧ de=X ∧ a=∅ ∧ escala ∈ ε·reales] ≥ 1` | C | §12 [D] dudas de T resueltas, A4 (8-11) |

#### Identidades, claves y tipos

| # | Regla | Hoy | Posición | Despliegue | BQL mínimo | C/L | Respaldo |
|---|---|---|---|---|---|---|---|
| ID-1 | Una identidad nace al recibir tokens por primera vez: ese evento es su alta | `eje.js:#aplicar` (`#altas`) | `g.3` (M-ALTAS) | D-ALTA | `alta(Y) = eventos[Y ∈ ⟨·.1⟩·a]{0}` | C | §12 [D] «Identidades: quien da de alta declara» |
| ID-2 | Clave y tipo se declaran en el evento que da tokens, solo para identidades nuevas, y no cambian | `eje.js:validar` | `alta(Y).3` (hoy `contexto.claves` y `contexto.tipos`) | D-META | `Y ∈ ⟨ev.3⟩·claves ⇒ Y ∉ g.3@antes ∧ Y ∈ ⟨ev.1⟩·a` | L | §11 [A] paso 4; §12 [D] identidades |
| ID-3 | Tipos: persona o cosa; «grupo» se rechaza | `ciclo.js:motivoTipo`; `tokens.js:TIPOS` | `alta(Y).3` | — | `tipo ∈ ε·tipos` | L | §12 [D] «los grupos son secundarios» (8-11) [X confirmar VG] |
| ID-4 | Sin clave no se actúa (salvo en un eje de demostración) | `eje.js:validar` (`#exigeClave`) | `g.3`, bandera en `g` | — | `⟨g.3⟩[Y=X]·clave ≠ ∅ ∨ ε·demostración` | C | §12 [D] regla madre (7-11n), R9 de la nota de neutralidad |
| ID-5 | Quien tiene clave firma, y el firmante es el autor | `eje.js:validar` | `ev.3` | D-META | `⟨ev.3⟩·firmante = X` (verificar la firma es suelo) | C | §11 [A] paso 4 |
| ID-6 | Cada clave declarada llega con su prueba de posesión (opcional en demostración) | `eje.js:validar`; `autoridad.js:verificarPosesion` | `ev.3` | D-META | `∀k ∈ ⟨ev.3⟩·claves: posesión(k)` (comprobarla es suelo) | L | R9, nota de neutralidad §4 [Core; regla madre «Sí» de VG] |
| ID-7 | La demostración sale solo de la bandera firmada del génesis | `eje.js:#aplicar` | `g` (hoy `contexto.demostracion`) | D-META | `ε·demostración = ⟨g⟩·demostración` | L | §14.1-18 SEG-02 [X] |
| ID-8 | Nadie mueve tokens ajenos: todo movimiento con origen lo escribe su titular | `eje.js:validar` (`motivoAjenos`) | `ev.1`, `ev.3` | D-MOV | `⟨ev.1⟩[de≠∅ ∧ de≠X] = ∅` | C | §11 [A] paso 4; §12 [D] «solo delegación» (8-11) |
| ID-9 | Solo las personas emiten | `ciclo.js:reglasDelCiclo` (`EMITEN`) | `g.3` | D-MOV | `⟨ev.1⟩[de=∅] ≠ ∅ ⇒ tipo(X) ∈ ε·emiten` | C | §12 [D] corrección de titulares (7-11 tarde); ciclo de vida (7-11n) |
| ID-10 | Nadie emite en nombre de otro: en E y R, emisor = autor y la emisión va al emisor | `ciclo.js`; `tokens.js:validarMovimiento` | `ev.1` | D-MOV | `⟨ev.1⟩[de=∅ ∧ familia∈{E,R}]·emisor = {X} = ·a` | C | §12 [D] ciclo de vida («emite siempre una persona») |

#### Génesis

| # | Regla | Hoy | Posición | Despliegue | BQL mínimo | C/L | Respaldo |
|---|---|---|---|---|---|---|---|
| GN-1 | El génesis solo emite a su autor, no emite T, su P es sobre todo el eje y su E no lleva registro ni coemisores | `eje.js:erroresGenesis` | `g.1` | D-MOV | `⟨g.1⟩[de≠∅ ∨ a≠⟨g.3⟩ ∨ familia=T ∨ (familia=P ∧ ámbito≠g)] = ∅` | L | §10.1 [D] génesis; §12 [D] dudas de T, A1 (8-11) |
| GN-2 | El génesis declara solo la clave y el tipo de su autor, que es persona; con clave va firmado; sin clave solo como demostración | `eje.js:erroresGenesis`, `erroresFirmaGenesis` | `g.3` | D-META | `⟨g.3⟩ = {autor} ∧ tipo = persona ∧ (clave ∨ demostración)` | L | §10.1 [D]; R9 |

#### Tiempo (T)

| # | Regla | Hoy | Posición | Despliegue | BQL mínimo | C/L | Respaldo |
|---|---|---|---|---|---|---|---|
| TT-1 | Nadie emite T, ni el génesis | `ciclo.js` (`T_NO_SE_EMITE`); `eje.js:erroresGenesis` | `ev.1` | D-MOV | `#⟨ev.1⟩[familia=T ∧ de=∅] = 0` | C | §12 [D] dudas de T, A1 (8-11) |
| TT-2 | Asignación diaria por escala: 86400 s, 1440 min, 24 h, 1 día, 1/7 de semana, 1/28 de ciclo, 1/364 de año | `tokens.js:ASIGNACION_T`, `PARTES_T`, `asignacionT` | `ε·asignación`; `alta(X).7` (M-T) | D-FECHA | `queda(X,k) = ε·asignación{k} − Σ⟨alta(X).7.<día(ev)>.k⟩` | L | §12 [D] «T como asignación diaria» (8-11) |
| TT-3 | Lo no gastado no se acumula: cada día civil empieza entero | `eje.js:gastadoT`, `#quedaAsignacion` | `alta(X).7.<día>` | D-FECHA | la misma de TT-2: el día lo pone D-FECHA y nada suma días anteriores | L | §12 [D] dudas de T, A1 |
| TT-4 | No se gasta más de lo que queda del día («T del día agotado») | `ciclo.js:reglasDelCiclo` | `alta(X).7@antes`, `ev.1` | D-MOV, D-FECHA | `Σ⟨ev.1⟩[familia=T ∧ escala=k ∧ de=X ∧ a≠X]·cant ≤ queda(X,k)` | C | §12 [D] asignación diaria («no te puedes gastar más») |
| TT-5 | Pasado, futuro e inventado son ilimitados, solo se consumen y llevan la fecha a la que se refieren (obligatoria en pasado y futuro) | `tokens.js:validarMovimiento`; `ciclo.js:esInformativoT`; `eje.js:saldoT` | `ev.1` (D-MOV.7) | D-MOV | `escala ∈ ε·informativas ⇒ a=∅ ∧ estado=∅ ∧ (escala=inventado ∨ refiere≠∅)` | C | §12 [D] asignación diaria (tres escalas); dudas A4 |
| TT-6 | T no se bloquea ni se libera | `ciclo.js` (`T_NO_SE_BLOQUEA`) | `ev.1` | D-MOV | `#⟨ev.1⟩[familia=T ∧ estado≠∅] = 0` | C | §12 [D] dudas A1 («no hay T acumulable») |
| TT-7 | T va en enteros (cada escala es un token) | `tokens.js:validarMovimiento` | `ev.1` | D-MOV | `⟨ev.1⟩[familia=T ∧ cant≠⌊cant⌋] = ∅` | C | §12 [D] las series se estandarizan (7-11) |
| TT-8 | T no cruza de persona: darlo a otra persona se rechaza (dar tiempo es emitir E en tiempo propio) | `ciclo.js:reglasDelCiclo` | `ev.1`, `g.3` | D-MOV | `⟨ev.1⟩[familia=T ∧ a∉{∅,X}]·a ⊂ cosas` | C | §12 [D] «T, corregido por VG» (3) |
| TT-9 | De persona a cosa sí; de cosa a cosa solo con el mismo dueño, o si el autor escribió el alta de la destino o tiene P sobre ella | `ciclo.js` (`cosaACosa`) | `g.3` (dueño = autor del alta), `alta(X).2` | — | `tipo(X)=tipo(a)=cosa ⇒ dueño(a) ∈ {X, dueño(X)} ∨ P(X, alta(a)) > 0` | C | §12 [D] dudas A2 (8-11) |
| TT-10 | Una cosa conserva el T recibido hasta gastarlo (no tiene asignación) | `eje.js:saldoT` | `alta(cosa).1` (M-CARTERA) | — | `queda(cosa,k) = ⟨alta(cosa).1.T:k⟩·disponible` | L | §12 [D] dudas A1 («el depósito de la máquina») |
| TT-11 | El T consumido se anota en el registro `sobre`; el 8 lo funde como `tiempo:<escala>`, sin lo que cuestan sus propias bases | `eje.js:#aplicar` (`#tiempoSobre`); `bases.js:tiempoMedido` | `r.8` (M-8) | D-MOV | `tiempo(r,k) = Σ(hijos(r)·1)[familia=T ∧ escala=k ∧ a=∅]·cant` | L | §12 [D] «T, corregido por VG» (1) |
| TT-12 | Cada escala real declara un orden de magnitud (segundo 1 … año 7); las informativas no tienen | `modos.js:ORDENES_DE_ESCALA`, `ordenDeEscala` | `ε·ordenDeEscala` | — | dato de la época | C | §12 [D] «T, corregido» (4) [X la correspondencia exacta] |
| TT-13 | ~~Incongruencia (se enseña, no rechaza): el orden de lo emitido no es el de la mayor escala consumida~~ **RETIRADA por VG 12-11 (#65)**: `incongruenciaDe` y `incongruenciaT` ya no existen; la escala la propone el 4 (`escalaQueCubre`, TT-14) | ~~`tiempo.js:incongruenciaDe`~~ | `ev`, `ev.1` | D-MOV | `orden(#hojas(ev)) ≠ ε·ordenDeEscala{máx escala consumida}` | C | §12 [D] «T, corregido» (4) |
| TT-14 | La escala que cubre lo emitido es la de orden que lo alcanza, sin bajar del minuto (VG 13-11, #78) (antes: «si lo emitido es mayor que su escala, se recomienda la de orden superior»; sin la marca de incongruencia, VG 12-11 #65) | `tiempo.js:escalaQueCubre` | `ev` | — | `(ε·reales[ε·ordenDeEscala ≥ orden(#hojas(ev))]){0}` | C | §12 [D] dudas A3 (8-11) |
| TT-15 | Coste de escribir: un minuto por posición del registro, lo heredado incluido; autorizar, liberar y la lente lo mismo o un minuto; una base, un minuto | `escritura.js:costeT`; `motor.js:autorizar`, `ejecutar`, `liberar`; `lente.js:declararLente`; `bases.js:COSTE_BASE` | `ev.1` | D-MOV | `Σ⟨ev.1⟩[T ∧ burn ∧ de=autor]·cant·segundos(escala) ≥ the cost of writing(ev)`: la condición «writing burns today's T» lo exige desde el 12-11 (#64 b); lo escrito a mano usa `quemaDelCoste` | C | §10.6 [A] cartón piedra [X si el relleno se cobra; coste de la base] |
| TT-16 | Duración de cada escala en segundos, con el año de 13 × 28 + 1 días (solo para medir distancias) | `tokens.js:SEGUNDOS` | `ε·segundos` | — | dato de la época | C | §2.6 [A/D] calendario 13 × 28 + 1 |
| TT-17 | La banda de una distancia es la escala más pequeña que la contiene | `tiempo.js:banda` | `ev.6.0` frente a ahora | D-FECHA | `(ε·reales[Δ < ε·segundos]){0}` | C | §11 [A] paso 5 |

#### Reloj

| # | Regla | Hoy | Posición | Despliegue | BQL mínimo | C/L | Respaldo |
|---|---|---|---|---|---|---|---|
| RL-1 | El `t` de un evento no es anterior al de su foco | `ciclo.js:reglasDelCiclo` | `ev.6.0`, `⟨ev.6.5⟩.6.0` | D-META | `ev.6.0 ≥ ⟨ev.6.5⟩·6.0` | C | FUNDAMENTOS, «el reloj no va hacia atrás» [X confirmar VG] |
| RL-2 | Ni anterior al alta de su autor | `ciclo.js:reglasDelCiclo` | `ev.6.0`, `alta(X).6.0` | D-META | `ev.6.0 ≥ alta(X)·6.0` | C | ídem [X] |
| RL-3 | Ni más de un año por delante del mayor `t` del eje | `ciclo.js` (`ADELANTO_MAXIMO_MS`) | `g.6` (M-RELOJ) | D-META | `ev.6.0 ≤ máx ⟨g.6⟩@antes + ε·segundos{año}` | C | revisión de seguridad 7-11n [X confirmar VG] |
| RL-4 | La caducidad se mira con el menor entre el `t` del evento y el mayor `t` de los demás (sin el autor ni los emisores de lo que emite); sin eventos de otros, nada caduca | `eje.js:reglasDelTope` (`reloj`), `tMaximo` | `g.6` (por autor) | D-META | `reloj = mín(ev.6.0, máx ⟨g.6⟩[autor ∉ {X} ∪ emisores(ev)])` | C | §14.1-18 SEG-03 y SEG-05 [X]; VG 8-11: no lo ve vulnerable |
| RL-5 | Un registro está sellado si la prueba del sello de tiempo copiada en él cuadra: su id con el camino «sip» da la raíz del lote, la raíz con el camino «bitcoin» llega a la cabecera, la cabecera da el hash del sello con prueba de trabajo, la altura firmada es la suya y la firmó un observador declarado por la cuenta raíz | antes `contrato.verificado` con `eje.sello(id).verificado` (lo que dijo `verificar` del sellador); hoy la lectura «sealed» de la época (`X.6.8.5`) | `X.6.8.2` (la décupla del SIP 0), `before.8.6` | relojes, `before.8` | `bytes(S.4) = bytes(it.5) ∧ hex(merkle(bytes(it.5), S.8, S.9, "sip")) = S.3 ∧ merkle(bytes(S.3), S.7.4, S.7.5, "bitcoin") = C.3 ∧ hex(C.7) = S.2 ∧ below(reverse(C.7), C.8) ∧ le(S.7.2) = S.1 ∧ signed(S.7.1, hash(cat(S.7.0, S.7.2), "StateArk/Observador/Cabecera/v1"), S.7.3) ∧ S.7.3 ∈ before.8.6`, con C = `cabecera(S.7.0)` (posiciones de `POSICIONES_DEL_SELLO`); lo que falta, PENDIENTE | L | VG 12-11, #64 d y #67; H9 del SIP 0 (encargo «verificado-regla») |
| RL-6 | El recibo de llegada copiado en un registro lo firma su relé | antes `contrato.verificado` (solo si lo había); hoy la lectura «received» de la época (`X.6.8.4`) | `X.6.8.1` (la décupla del recibo: 1 instante, 2 relé, 3 firma, 4 id del recibo) | relojes | `signed(bytes(R.3), bytes(R.4), bytes(R.2))`, R = el recibo copiado; sin el id del recibo, PENDIENTE. Falta que el recibo sea de X (etiqueta «g» del 7701) y una lista de relés [X] | L | VG 12-11, #64 d y #67 (encargo «verificado-regla») |

#### Recursos (E)

| # | Regla | Hoy | Posición | Despliegue | BQL mínimo | C/L | Respaldo |
|---|---|---|---|---|---|---|---|
| EE-1 | La serie de E se ata a un registro que exista; sin él, al alta de su emisor | `eje.js:reglasDelTope` (§1), `contratoE` | `r.1` (M-SERIE) | D-SERIE | `registro(k) = ⟨k⟩·5 ∨ alta(emisor)`; `registro(k) ∈ eje` | L | §12 [D] «E atada al recurso» (R2, 7-11n) |
| EE-2 | La capacidad de un registro es un entero positivo en la posición 2 de su payload | `tokens.js:capacidadDe` (`CRITERIO_CAPACIDAD`) | `r.2` | — | `cap(r) = ⟨r.2⟩[entero > 0]{0}` | L | §12 [D] «capacidad y tokens casan» (7-11) [X cómo se declara] |
| EE-3 | La franja es lo que va tras la última `@` de la denominación, texto opaco; sin `@`, una sola | `tokens.js:franjaDe` | D-SERIE.7 | D-SERIE | (despliegue) | C | §14.1-14 [D Core] franja |
| EE-4 | La familia es la misma clave con la franja `*`: un bloqueo de familia respalda todas sus franjas | `tokens.js:familiaDe` | D-SERIE.7 = `*` | D-SERIE | `familia(k) = k con ·7 ← *` | C | §14.1-14 [X Core] |
| EE-5 | Tope compartido: para cada registro del hilo que declara capacidad, el E vivo de la franja (todas las denominaciones y emisores, de él y lo que cuelga) no pasa de ella | `eje.js:reglasDelTope` (§2), `topes` | `r.1` (M-SERIE, vivo por franja) | D-SERIE | `∀A ∈ ↑registro(k)[cap]: Σ series[A ∈ ↑·5 ∧ ·7=f]·vivo ≤ cap(A)` | L | §12 [D] «E atada al recurso» (tope compartido) |
| EE-6 | E vivo = emitido − consumido, y nada si la serie caducó con el reloj de RL-4 | `eje.js:vivo`, `caducada` | `r.1` | D-SERIE | `vivo(k) = reloj < ⟨k⟩·7 ? emitido − consumido : 0` | C | §12 [D] ciclo de vida (caducidad declarada) |
| EE-7 | Cuota: el E vivo de una serie no pasa de ⌊P bloqueado por sus emisores con salida = la serie o su familia ÷ P emitido × capacidad⌋; el P es el del registro si lo tiene, si no el del eje | `eje.js:reglasDelTope` (§3) | `alta(e).1` (bloqueos), `A.2` | — | `vivo(k) ≤ ⌊Σ bloq(emisores, P:A, {k, familia(k)}) ÷ emitido(P:A) × cap(A)⌋` | L | §12 [D] «E atada» («en proporción al P:X que bloquea») · §15 revisar con el P nuevo |
| EE-8 | El P bloqueado con salida = una serie de E no se libera mientras viva esa E (o alguna franja de la familia) | `eje.js:reglasDelTope` (§4) | `alta(X).1.<P>.2` | D-MOV | `liberar(P, salida=k) ⇒ vivo(k) = 0` | C | §12 [D] «E atada» («no se libera mientras viva el E») |
| EE-9 | El contrato de la serie (caduca, divisible, emisores) lo fija la primera emisión; sin `divisible`, enteros | `eje.js:reglasDelTope` (§5); `ciclo.js` (caducidad) | `r.1` (contrato) | D-SERIE | `ampliar k ⇒ (caduca, divisible, emisores) = los de ⟨k⟩{0}`; `¬divisible ⇒ cant = ⌊cant⌋` | C | §12 [D] «E atada» (redondeo) |
| EE-10 | Emisión conjunta: cada coemisor tiene antes su propio P bloqueado para la serie (es su firma) | `eje.js:reglasDelTope` (§5) | `alta(e).1` | — | `∀e ∈ emisores ∖ {X}: bloq(e, P, {k, familia(k)}) > 0` | C | §12 [D] «E atada» (emisión conjunta) [X firma = bloqueo] |
| EE-11 | Sin capacidad declarada en el hilo no hay tope: deuda del emisor | `eje.js:series` (`SIN_CAPACIDAD`) | `r.2` | — | `#↑registro(k)[cap] = 0 ⇒ sin tope` | L | §12 [D] «E atada» (EUR sin tope) |
| EE-12 | La caducidad es un campo del contrato: nada ocurre solo al caducar; los tokens se siguen moviendo | `eje.js:caducada` | D-SERIE.7 | D-SERIE | `caducada(k) = reloj ≥ ⟨k⟩·7` | C | §12 [D] ciclo de vida («nunca automática») |

#### Reputación (R)

| # | Regla | Hoy | Posición | Despliegue | BQL mínimo | C/L | Respaldo |
|---|---|---|---|---|---|---|---|
| RR-1 | R no es fungible: solo la mueve su emisor; quien la tiene solo puede devolvérsela | `tokens.js:validarMovimiento` | `ev.1` | D-MOV | `⟨ev.1⟩[familia=R ∧ de≠∅ ∧ de≠emisor ∧ a≠emisor] = ∅` | C | §12 [D] ciclo de vida; devolver [X confirmar VG] |
| RR-2 | La obligación del emisor es su R en manos ajenas | `eje.js:obligaciones` | `alta(Y).3` (M-R) | — | `oblig(Y) = Σ carteras[titular≠Y]·R:Y` | L | §12 [D] ciclo de vida (doble entrada, V10) |
| RR-3 | Emitir R exige colateral: R propia bloqueada con salida = la serie, al menos 1/10 de lo emitido tras el evento | `lente.js:reglasDeR` (`COLATERAL_R`) | `alta(X).1`, `alta(X).3` | — | `bloq(X, R:X, R:X) × 10 ≥ emitido(R:X) tras ev` | C | §12 [D] resto de la lista (R6) [X el 1/10] |
| RR-4 | El colateral no se libera con devoluciones sin atender ni por debajo del mínimo | `lente.js:reglasDeR` | `alta(Y).3` | — | `liberar colateral ⇒ #pendientes(Y)=0 ∧ resto × 10 ≥ emitido` | C | ídem |
| RR-5 | Devolver R a su emisor es pedir atención; atender es un evento del emisor que cita la devolución | `lente.js:anotar`, `reglasDeR` | `alta(Y).3` (devoluciones); la cita, hoy `contexto.atiende` | D-META | `atendida(d) = #eventos[autor=Y ∧ d ∈ ·6·atiende] > 0` | L | §12 [D] R6 |
| RR-6 | «R propia en juego» (para emitir P o E) es ese colateral sobre su propia serie | `lente.js:rPropiaEnJuego` | `alta(X).1` | — | `bloq(X, R:X, R:X) > 0 ∧ bloq × 10 ≥ emitido(R:X)` | C | §12 [D] ciclo de vida (escalonado) + R6 |
| RR-7 | La lente: evento del lector en el 3 de su alta (o de un registro «lente» suyo) con pares [emisor, peso 0–1], hasta diez; la última declaración de cada emisor manda | `lente.js:anotar`, `paresDeLente`, `lenteDe` | `alta(L).3` (ya es posicional) | — | `peso(L,e) = ⟨alta(L).3⟩[autor=L]·*[·0=e]{−1}·1` | L | §12 [D] R6 (7-11n) |
| RR-8 | Valor de R ante un lector = Σ peso × participación; el emisor que no nombra y la R propia pesan 0 | `lente.js:detalleValor`, `tenencia`; `bql.js` `VALOR_R` | `alta(L).3`, `alta(T).1` | — | `Σ_e peso(L,e) × parte(T, R:e)` | L | ídem |
| RR-9 | La participación se mide sobre lo emitido cuando llegó cada tenencia; devolver la baja a prorrata | `lente.js:anotar` | `alta(T).1.R:e` | — | `parte += c ÷ emitido@llegada`; al devolver `parte × (1 − c ÷ saldo)` | C | ídem [X por tramos] |

#### Poder (P)

| # | Regla | Hoy | Posición | Despliegue | BQL mínimo | C/L | Respaldo |
|---|---|---|---|---|---|---|---|
| PP-1 | P exige ámbito: no hay P total | `tokens.js:validarMovimiento` | D-SERIE.1 | D-SERIE | `⟨ev.1⟩[familia=P ∧ ámbito=∅] = ∅` | C | §12 [D] ciclo de vida P |
| PP-2 | Acuñar P solo sobre un registro que existe y que escribió el autor; sobre todo el eje, solo el génesis | `ciclo.js:reglasDelCiclo` | `r.3` (autor) | D-META | `⟨ev.1⟩[familia=P ∧ de=∅]·ámbito ⊂ registros[·3=X]` | C | §12 [D] ciclo de vida P · **§15 retira** («desaparece: el autor de X acuña P:X») |
| PP-3 | R3: P:X es una serie cerrada; ampliarla es ejecutar de verdad una consolidación sobre X autorizada, con evidencia, y una sola vez | `ciclo.js:porQueNoAmplia`, `consolidacionQueAmplia`; `eje.js` (`#ampliadas`) | `X.2` (serie P:X), `c.4` | D-META | `emitido(P:X) > 0 ⇒ ⟨ev.6.5⟩=c ∧ estado(c)=AUTORIZADO ∧ c ∈ ev·evidencia ∧ c no usada` | L | §12 [D] «autorizar = bloquear P» (R3) · **§15 retira** |
| PP-4 | Delegar P debita del ámbito más concreto que lo cubre, subiendo por el hilo hasta el génesis | `eje.js:#planDebitoP`, `ambitosQueCubren` | `alta(X).2` (M-P) | — | debitar en el orden de `↑ámbito`, después `g` | C | §12 [D] ciclo de vida P («delegar estrechando») · §15 lo cambia (subir deja una décima) |
| PP-5 | No se estrecha P hacia una serie cerrada; hacia la raíz de un dominio, solo su autor | `ciclo.js:reglasDelCiclo` | `A.2`, `A.3` | — | `estrechar hacia A ⇒ emitido(P:A) = 0 ∧ (A·6.5 ≠ g ∨ A·3 = X)` | L | FUNDAMENTOS, R3 [X confirmar VG] · §15 |
| PP-6 | El poder sobre un registro es la suma del P cuyo ámbito es el eje o un registro de su hilo | `eje.js:poderSobre` | `alta(X).2` | — | `Σ⟨alta(X).2⟩[ámbito ∈ ↑r ∪ {g}]·cant` | C | §12 [D] ciclo de vida P · §15 lo sustituye (peso por dominio) |
| PP-7 | `P:genesis` y `P:<id del génesis>` son la misma serie | `ciclo.js:clavesDeSerieP`; `autorizacion.js:clavesDeP` | `g.2` | D-SERIE | identidad de dos claves | L | FUNDAMENTOS [Core] · §15 retira el P del génesis |

#### Escalonado

| # | Regla | Hoy | Posición | Despliegue | BQL mínimo | C/L | Respaldo |
|---|---|---|---|---|---|---|---|
| ES-1 | Emitir R exige consumir T real del autor en el mismo evento | `ciclo.js:reglasDelCiclo` | `ev.1` | D-MOV | `⟨ev.1⟩[familia=R ∧ de=∅] ≠ ∅ ⇒ EV-3` | C | §12 [D] ciclo de vida (escalonado) · §15 N3 «dos secuencias» |
| ES-2 | Emitir P exige T y R propia en juego | `ciclo.js` | `ev.1`, `alta(X).1` | D-MOV | `emite P ⇒ EV-3 ∧ RR-6` | C | ídem |
| ES-3 | Emitir E exige T, R propia en juego y P del autor sobre el registro `sobre` | `ciclo.js` | `ev.1`, `alta(X).2` | D-MOV | `emite E ⇒ EV-3 ∧ RR-6 ∧ PP-6(X, ⟨ev.6.5⟩) > 0` | C | ídem |

#### Bloqueos

| # | Regla | Hoy | Posición | Despliegue | BQL mínimo | C/L | Respaldo |
|---|---|---|---|---|---|---|---|
| BL-1 | Bloquear y liberar no cambian de titular (de = a = autor) y exigen salida | `tokens.js:validarMovimiento` | `ev.1` (D-MOV.2) | D-MOV | `⟨ev.1⟩[estado≠∅ ∧ (de≠X ∨ a≠X ∨ salida=∅)] = ∅` | C | §12 [D] ciclo de vida («saldo = disponible + bloqueado») |
| BL-2 | Bloquear sale del disponible; liberar no devuelve más de lo bloqueado con esa salida | `eje.js:validar` | `alta(X).1.<serie>.2` (M-CARTERA) | D-MOV | `liberar c ⇒ c ≤ ⟨alta(X).1.k.2⟩[salida=s]·cant` | C | ídem; [X qué hace verificable una salida] |
| BL-3 | Lo bloqueado con una salida, sumando titulares (el peso de una autorización) | `eje.js:bloqueadoCon`, `#porSalida` | `c.4` (M-FABRICA) cuando la salida es `c` | — | `Σ carteras·⟨1.k.2⟩[salida=s]·cant` | C | §12 [D] «autorizar = bloquear P» |
| BL-4 | Un bloqueo de autorización caduca en un ciclo, declarado y nunca automático | `motor.js:PLAZO_AUTORIZACION`, `autorizacionCaducada` | `a.7` | D-FECHA | `caduca(a) = a·6.0 + ε·segundos{ciclo}` | L | §12 [D] resto de la lista («un ciclo, declarada») [X] |

#### Autorización y ciclo de la fábrica

Todo este bloque lo pone en cuestión §15 [D]: «el guion fijo consolidar → autorizar → ejecutar es erróneo»; los estados pasan a ser lecturas del criterio del dueño en su PV2. Se inventaría porque hoy es código.

| # | Regla | Hoy | Posición | Despliegue | BQL mínimo | C/L | Respaldo |
|---|---|---|---|---|---|---|---|
| AU-1 | Una consolidación es un registro con fase «consolidado», motor «fábrica» y anclado en el 4 de un camino | `autorizacion.js:esConsolidacion` | `ev.6.5` (en acaba en 4); la fase, hoy `contexto.fase` | D-META | `último dígito(ev·6.5·en) = 4 ∧ fase = consolidado` | L | §11 [A] paso 3 · **§15: pasa a lectura** |
| AU-2 | El registro del recurso X es el más cercano del hilo del foco con P propio emitido y de la cadena del dueño; si no hay, el génesis | `autorizacion.js:recursoDe` | `↑⟨c.6.5⟩`, `·.2` | — | `X = (↑⟨c.6.5⟩)[emitido(P:·) > 0 ∧ AU-3]{0} ∨ g` | L | §14.1-17 [D] (1) «tu recomendación» y su salvedad · §15 |
| AU-3 | Cadena del dueño: la raíz, lo que escribió su autor, lo de quien tiene P sobre la raíz por encima del umbral, o lo establecido por una consolidación autorizada (`contexto.subdominio`) | `autorizacion.js:subregistroDelDueno` | `r.3`; la marca, hoy `contexto.subdominio` | D-META | `r·3 = raíz·3 ∨ AU-6(P(r·3, raíz)) ∨ estado(r·subdominio) ∈ {AUTORIZADO, EJECUTADO}` | L | §14.1-17 salvedad [D]; detalle [X Core] |
| AU-4 | Qué P cuenta: P:X si X tiene P propio; si no, el del eje | `autorizacion.js:clavesDeP` | `X.2` | — | `claves = emitido(P:X) > 0 ? {P:X} : {P:g}` | L | §12 [D] «el génesis solo manda donde nadie ha emitido P» · §15 retira el P del génesis |
| AU-5 | El umbral es un terminal «umbral a/b» o «umbral 0.x» en el 2 (o un 2.k) de X; sin él, más de la mitad | `autorizacion.js:umbralDe`, `leerUmbral`, `UMBRAL_POR_DEFECTO` | `X.2` | D-VALOR (leer «a/b») | `u = ⟨X.2⟩[empieza por «umbral»]{0} ∨ ε·umbralPorDefecto` | L | §12 [D] «autorizar = bloquear P» («la segunda») · §15 N4 plantillas de recuento |
| AU-6 | Alcanza: bloqueado × b ≥ a × emitido (estricto con el umbral por defecto); sin nada emitido nadie autoriza | `autorizacion.js:alcanzaUmbral` | — | — | `peso × b ≥ a × emitido(P:X) ∧ emitido > 0` | C | ídem |
| AU-7 | Peso = P que cuenta bloqueado con salida = la consolidación, de cualquiera y el autor incluido, más el P que respalda E del recurso de quien tiene en pie su acto de voluntad | `autorizacion.js:pesoDe`, `conActoDeRespaldo` | `c.4` (M-FABRICA) | D-META | `Σ bloq(claves, c) + Σ ⟨c.4⟩[respaldo ∧ ¬libera]·autor·respaldo` | L | §12 [D] «el P que respalda E cuenta también» (8-11) [X el acto de voluntad] |
| AU-8 | Respaldo: P bloqueado con salida = una serie de E (o su familia) atada a X o a lo que cuelga de X, con E vivo | `autorizacion.js:respaldoDe`, `cuelgaDe` | `alta(i).1` | D-SERIE | `bloqueos(i)[clave ∈ claves ∧ X ∈ ↑registro(salida) ∧ vivo(salida) > 0]` | L | ídem |
| AU-9 | Estado: EJECUTADO si hay una ejecución de su autor con la evidencia en el eje; si no, AUTORIZADO si alcanza; si no, PENDIENTE DE AUTORIZACIÓN | `autorizacion.js:estadoPorPeso`, `ejecucionesDe`; `motor.js:estadoDe` | `c.4` | D-META | `#⟨c.4⟩[fase=ejecutado ∧ ·3=c·3 ∧ evidencia ⊂ eje] > 0 ? EJECUTADO : AU-6 ? AUTORIZADO : PENDIENTE` | L | §11 [A] · **§15: deja de ser del núcleo** |
| AU-10 | Ejecuta solo el autor, solo si está autorizada y no ejecutada; libera su propio bloqueo y deja la evidencia | `motor.js:ejecutar` | `c.4` | D-META | `⟨ev.6.5⟩=c ∧ X = c·3 ∧ estado(c) = AUTORIZADO` | L | §11 [A] («ejecuta el autor», hueco provisional; §12 [D] AARPIA) · **§15 retira** |
| AU-11 | Puede autorizar quien tiene clave y P que cuente, disponible o respaldando | `motor.js:puedeAutorizar` | `alta(i).1`, `alta(i).2` | — | `clave(i) ∧ (P disponible en claves + respaldo(i)) > 0` | L | §12 [D] «autorizar = bloquear P» · §15 |
| AU-12 | Autorizar bloquea por defecto todo el disponible que cuenta, o solo el acto de respaldo si con él basta | `motor.js:autorizar` | `ev.1` | D-MOV | (es lo que propone la escritura, no una validación) | — | [Core] |
| AU-13 | Libera solo el titular, en la fábrica de la consolidación; el mismo registro retira el acto de respaldo | `motor.js:liberar` | `c.4`; la marca, hoy `contexto.libera` | D-META | `libera ⇒ X = titular` | L | §12 [D] R5 («quien bloqueó puede retirarlo») |
| AU-14 | Cuentan las autorizaciones que bloquean P que cuenta con salida = la consolidación, o los actos de respaldo en pie | `motor.js:autorizacionesValidas` | `c.4` | D-MOV | `⟨c.4⟩[fase=autorizado ∧ (·1[P ∧ bloqueo ∧ salida=c] ≠ ∅ ∨ respaldo)]` | L | ídem |

#### Fábrica y registro de salida

| # | Regla | Hoy | Posición | Despliegue | BQL mínimo | C/L | Respaldo |
|---|---|---|---|---|---|---|---|
| FA-1 | Consolidar: elecciones en 1–9; lo anterior no elegido se hereda del foco por referencia si tiene ocupantes; si no, hueco y rechazo | `motor.js:consolidar` | `foco.camino.4` | — | `∀ i < último: elegida(i) ∨ #⟨foco.i⟩ > 0` | L | §12 [D] «posiciones sin contenido y registro de salida» [X matriz o consolidar] |
| FA-2 | La consolidación se ancla en el 4 del camino y guarda fuentes, encaje y nuevos | `motor.js:consolidar` | `ev.6.5 ← camino.4`; hoy `contexto.fuentes`, `encaje`, `nuevos` | D-META | `ev·6.5·en ← camino·4` | L | §12 [D] fábrica; §5 [YO] 7 |
| FA-3 | Proponer: una fórmula que da colección propone su primer candidato; un valor, un terminal nuevo; un literal, una referencia al foco | `motor.js:proponer` | `foco.1`–`foco.4` | — | `propuesta(i) = ⟨foco.i⟩{0}` | L | §11 [A] paso 3 (operador B) |
| FA-4 | Descubrir mira las posiciones de interacción 1–4 del foco | `motor.js:descubrir` | `foco.1`–`foco.4` | — | `⟨foco.{1,2,3,4}⟩` | C | §9 [D] cruceta: la mano trabaja en 1–4 |
| FA-5 | Matriz 10×10×10 relativa al camino: la celda i.j.k cae en camino·i·j·k y su clase es el dígito n + 2 | `escritura.js:claseDe` | `ev.6.5` + camino | D-META | `clase = dígito(ev·6.5, n + 2)` | C | §12 [D] tercera dimensión = PV; §13 relativa al camino |
| FA-6 | Clases nombradas: 0 ver o sustituir, 1 impulso de recursos, 2 criterio, 3 comunicación, 4 acción; 5–9 sin nombre | `escritura.js:CLASES` | `ε` (la profundidad n + 2) | — | regla corta de la época | C | §12 [D] (7-11 tarde) [X 5–9] |
| FA-7 | Herencia: lo anterior no modificado se hereda por referencia solo si el foco tiene contenido en ese camino exacto | `escritura.js:ubicarSobre`, `hayContenido`, `construir` | `foco.camino` | — | `∀ hueco < celda: escrito ∨ #⟨foco.hueco⟩(exacto) > 0` | C | §12 [D] «no se rellena macizo» |
| FA-8 | Lo lejano, sin base en el foco, no se rechaza: se ancla en su posición | `escritura.js:ubicar` | `ev.6.5 ← camino·i·j·k` | D-META | `¬FA-7 ⇒ en ← camino·i·j·k` | C | §12 [D] «lo lejano = anclaje» |
| FA-9 | Ver es una celda de clase 0 sin contenido: una referencia a la celda del foco, que tiene que existir; así siempre se emite algo | `escritura.js:valorDe`, `desdeMapped` | `foco.i.j` | — | `ver(i.j) ⇒ #⟨foco.i.j⟩ > 0` | C | §12 [D] «ver un contenido ya es una modificación» |
| FA-10 | Si todo el registro es herencia, no hay nada que emitir | `escritura.js:escribirRegistro` | — | — | `#hojas(ev) − #heredadas ≥ 1` | C | ídem |
| FA-11 | Pointed escribe un terminal; Sequenced una hilera de 1 a 10 sin huecos | `escritura.js:desdePointed`, `desdeSequenced` | `ev` | — | `#hojas(ev) = 1` · `1 ≤ #hilera ≤ 10` | L | §10.6 [A] |

#### Modos y tamaños

| # | Regla | Hoy | Posición | Despliegue | BQL mínimo | C/L | Respaldo |
|---|---|---|---|---|---|---|---|
| MO-1 | Lo leído y lo emitido se cuentan por lo que hay: cada posición con contenido una, cada ocupante de una lista uno | `modos.js:contenido` | — | — | `#hojas(·)` | C | §12 [D] decisión 10.1 |
| MO-2 | El orden de magnitud n va de 10^(n−1) a 10^n posiciones | `modos.js:orden`, `minimoDe`, `maximoDe` | — | — | `orden(p) = máx(1, ⌈log₁₀ p⌉)` para p ≥ 1; `orden(0) = 0` | C | §12 [D] «T, corregido» (4) |
| MO-3 | Máximo y mínimo por modo: Pointed 10 y 1, Sequenced 100 y 10, Mapped 1000 y 100, Scened 10000 y 1000; Be todos y sin mínimo | `modos.js:MODOS` | `ε·modos` | — | dato de la época | C | §12 [D] decisión 6; 10.4 |
| MO-4 | Tope duro de emisión: lo emitido (sin lo heredado) no pasa del máximo del modo | `modos.js:cabeTope`; `escritura.js:comprobarLimites` | `ev` (el modo, hoy `contexto.modo`) | D-META | `#hojas(ev) − #heredadas ≤ ε·máximo{modo}` | C | §12 [D] decisiones 6 y 10.3 |
| MO-5 | Todos los modos cortan duro al leer en su máximo (Be no corta) | `modos.js:recortar`, `admitir`, `avisoCorte` | — | — | `M{0 … ε·máximo{modo} − 1}` | C | §12 [D] decisión 10.2 |
| MO-6 | La proporción propone (Pointed 1/10, Sequenced 1/10–1/5, Mapped 1/4–1/3 del máximo); fuera de ella, aviso | `modos.js:escritura`, `proporcionDe` | `ε·proporción` | — | `⌊ε·máximo × ε·proporción⌋` | C | §10 [D] proporción; §12 [D] decisión 10.3 |
| MO-7 | Cada vista y cada emisión dicen tres números: conseguido, mínimo y máximo | `modos.js:alcanceDe` | — | — | `(#hojas, ε·mínimo, ε·máximo)` | C | §12 [D] decisión 6 |

#### Encaje, lectura y elegibilidad

| # | Regla | Hoy | Posición | Despliegue | BQL mínimo | C/L | Respaldo |
|---|---|---|---|---|---|---|---|
| EN-1 | Una dirección con ceros finales nombra la colisión entera; un número es índice (camino exacto) | `encaje.js:caminosDe`, `ocupantes`; `bql.js` `BUSCAR` | — | — | `⟨r.d⟩` | C | §12 [D] colisiones; BUSCAR por dirección y por índice |
| EN-2 | Ocupantes: lo propio, lo que alcanza su referencia, lo escrito anclado ahí | `encaje.js:ocupantes` | — | — | `⟨r.d⟩ = propio ∪ alcanzado ∪ escritos` | C | §12 [D] «qué es una colisión» |
| EN-3 | Ordena el acuerdo de prefijo y después la llegada; la distancia solo en las profundidades que la época haga ordinales; el signo informa | `encaje.js:ordenarPorEncaje`, `vector`, `acuerdo` | `ε·ordinales` | — | ordenar por (acuerdo descendente, llegada) | C | §12 [D] signo, opción B (7-11 tarde) |
| EN-4 | Empate: mismo acuerdo (y misma distancia ordinal); decide la llegada | `encaje.js:marcarEmpates` | — | — | `acuerdo(a) = acuerdo(b)` | C | ídem |
| EN-5 | Una referencia se sigue hasta 20 saltos; la ausente queda PENDIENTE | `encaje.js:seguir` (`MAX_SALTOS`) | `ε·saltos` | — | `≤ ε·saltos` | C | §2.3 [A] «un dato faltante no es falso» |
| EN-6 | Elegibles: la lista del 2.3 del dueño (o `cualquiera`); si no hay, su autor y los nombrados en su 3 con alta; las correcciones del dueño se añaden | `elegibles.js:elegibles` | `r.2.3`, `r.3` | — | `elig(r) = {r·3·autor} ∪ ⟨r.2.3⟩[autor=dueño] ∪ (lista vacía ? ⟨r.3⟩ ∩ g.3 : ∅)` | L | §14 [D] «quién ocupa una posición ajena» (7-11n); §14.1-15 [D Core] `cualquiera` |
| EN-7 | Elegibles antes que límites; los demás quedan en un recuento que no puntúa | `elegibles.js:ocupantesElegibles`; `bql.js:buscar`; `motor.js:descubrir` | — | — | `⟨r.d⟩[autor ∈ elig(r)]` antes del tope | C | R8 [D regla madre] |
| EN-8 | En la hilera de hijos de Sequenced, los elegibles van delante | `elegibles.js:hijosElegibles` | `r.*` | — | `hijos[elegible] ⧺ hijos[¬elegible]` | L | ídem |
| EN-9 | Un registro nombrado cuenta como un ocupante: tener P sobre él no hace elegible | `elegibles.js` | `r.3` | — | (no suma quien tiene P) | C | §12 [D] «solo delegación» (8-11) |

#### El 8

| # | Regla | Hoy | Posición | Despliegue | BQL mínimo | C/L | Respaldo |
|---|---|---|---|---|---|---|---|
| OC-1 | La base la escribe en el 8 la propia cosa o quien tenía P sobre el registro al escribirla, con clave y gastando T | `bases.js:puedeEscribirBase`, `leerSiEsBase`, `poderAntes`, `escribirBase` | `r.8` (M-8) | D-META | `X ∈ {cosa(r)} ∪ P(·, r)@antes > 0 ∧ firma ∧ EV-2` | L | §12 [D] cohortes y bases; §14.1-12 [D] «al escribirla» · §15 P nuevo |
| OC-2 | La cosa de un registro es la única cosa con clave que da de alta en su contexto; la del génesis, su autor | `bases.js:identidadDe` | `r.3` | D-META | `cosa(r) = ⟨r.3⟩[tipo=cosa ∧ clave]` si es una | L | [X decidir VG] cómo se identifica un registro con una identidad |
| OC-3 | La base mide exactamente los hijos hasta su «hasta», en orden, y funde como mucho una base vigente por hijo | `bases.js:leerSiEsBase`, `calcularBase` | `r.8` | — | `refsHijos = hijos(r){0 … hasta}` | L | §14.2 (b)(c), confirmado por VG (decisión 7) |
| OC-4 | Las bases no son hijos ni comparables de lo que miden | `bases.js:particion`, `hijos`, `comparables` | `r.8` | — | `hijos(r) = ⟨r.*⟩ ∖ bases(r)` | L | §14.2 |
| OC-5 | Manda la última base por llegada; las anteriores quedan como colisión | `bases.js:leerBase` | `r.8` | — | `⟨r.8⟩[base]{−1}` | L | §12 [D] «corregir = añadir otra base» [X por llegada y no por t] |
| OC-6 | Cohortes: hermanos = el 8 del padre; proyecto = el 8 del registro del hilo que cuelga del génesis; general = el 8 del génesis | `bases.js:cohorteDe`, `proyectoDe` | `padre.8`, `proyecto.8`, `g.8` | — | `proyecto(r) = (↑r){−2}` | L | §12 [D] cohortes [X qué registro es el proyecto] |
| OC-7 | Solo las cantidades (sumas por serie y `tiempo:`) tienen cajas; los recuentos informan | `bases.js:MEDIDAS`, `esRecuento` | `ε·medidas` | — | dato de la época | C | §12 [D] R7 (7-11n) |
| OC-8 | Caja = cuántos cortes deja el valor por debajo; los cortes son de la época (1 2 3 4 6 10 16 26 42) y se heredan del respaldo | `bases.js:cortesDe`, `cajaDe`; `epocas.js:cargarEpoca` | `ε·cortes` (ya en `epoca-0.json`) | — | `#ε·cortes[≤ v]` | C | §14 [D] cortes (7-11n); §14.1-12 [D] |
| OC-9 | Cuota = valor ÷ suma de la cohorte; caja de cuota = ⌊10 × cuota⌋, como mucho 9 | `bases.js:cuotaDe`, `cajaDeCuota` | `r.8` | — | `mín(9, ⌊10 × v ÷ Σ⌋)` | C | §12 [D] R7 |
| OC-10 | Fundir: n, suma, mínimo, máximo y cajas, sumando caja a caja | `bases.js:fundir` | — | — | `Σ` caja a caja; `mín`; `máx` | C | §12 [D] cohortes («medidas fundibles») |
| OC-11 | Frescura = lo llegado desde la base: hijos nuevos, bases nuevas y lo mismo debajo | `bases.js:frescura` | `r.8` («hasta») | — | `#hijos(r)[llegada > hasta] + …` | L | §12 [D] «la base lleva fecha y frescura» [X qué es] |
| OC-12 | PV8 ordena registros por masa (suma por serie), nunca identidades | `bases.js:porMasa`, `masaDe` | `r.8` | — | ordenar por `⟨·.8⟩·serie` descendente | C | §12 [D] R7 |
| OC-13 | Sin base escrita, BQL no calcula al vuelo (PENDIENTE); calcular al vuelo es un respaldo declarado | `bql.js:leerCohorte`; `bases.js:confluir` | `r.8` | — | `⟨r.8⟩[base] = ∅ ⇒ PENDIENTE` | C | §12 [D] decisión 7 |
| OC-14 | Las diez etiquetas de las cajas (los hitos) son texto informativo | `bases.js:HITOS` | `ε·hitos` | — | dato de la época | C | §2.2 [D20]; §14 [D] etiquetas |
| OC-15 | Escribir una base cuesta, como todo registro, un minuto por posición (cientos de minutos: #64 b, 12-11); `COSTE_BASE` ya no se cobra | `bases.js:escribirBase` (`quemaDelCoste`) | `ev.1` | D-MOV | la de TT-15 | C | [X decidir VG: el coste de la base] |

#### Eje temporal y capacidad de una posición

| # | Regla | Hoy | Posición | Despliegue | BQL mínimo | C/L | Respaldo |
|---|---|---|---|---|---|---|---|
| TP-1 | Pasado: el hilo y los escritos con `t` ≤ ahora; futuro: los escritos posteriores, las consolidaciones sin ejecutar y lo declarado en el 7 | `tiempo.js:ejeTemporal` | `f.6`, `f.7` | D-FECHA | `pasado = ↑f ∪ ⟨f.*⟩[·6.0 ≤ ahora]` | L | §11 [A] paso 5; §10 [D] hilos |
| TP-2 | Tramo: el 7 del registro como `[[inicio], [fin]]` ISO, sin contar el fin; vale lo propio o lo que ancla su autor | `motor.js:tramoDe` | `r.7` | D-FECHA | `tramo(r) = ⟨r.7⟩[autor = r·3]{0}` | L | §12 [D] anclaje de la reserva («noches en el 7») [X la forma] |
| TP-3 | Ocupación informativa: tramos solapados de los ocupantes ejecutados frente a la capacidad de la posición (su 2) | `motor.js:ocupacion`, `registrosEn`, `maximoALaVez` | `pos.2`, ocupantes de `pos` | D-FECHA | `máx a la vez(tramos) < cap(pos)` | L | §12 [D] capacidad y tokens (contador informativo) |

#### Reglas de evaluación de BQL

| # | Regla | Hoy | Posición | Despliegue | BQL mínimo | C/L | Respaldo |
|---|---|---|---|---|---|---|---|
| BQ-1 | Límites: presupuesto 2000, profundidad 100, candidatos 1000; pasarse da PENDIENTE POR LÍMITE | `bql.js:LIMITES` | `ε·límites` | — | dato de la época | C | §2.3 [A] límites de cálculo |
| BQ-2 | Más de diez profundidades da PENDIENTE, no ERROR | `bql.js:leerSlot`, `buscar` | — | — | `#d > 10 ⇒ PENDIENTE` | C | §13 [X] (7-11 tarde) |
| BQ-3 | Un texto «número palabra» o «palabra número» es una magnitud | `bql.js:valorDe` (`RE_MAGNITUD_SLOT`) | el terminal, profundidad 2 | D-VALOR | `⟨r.d.1⟩` cuánto, `⟨r.d.2⟩` unidad | C | REGLAS_CORTAS, duda 3 [X]; [X] forma de una magnitud |
| BQ-4 | Un texto de diez dígitos es una dirección; una cadena de cifras es texto | `bql.js:valorDe` | — | — | (lectura de un terminal) | C | §12 [D] BUSCAR por dirección y por índice |
| BQ-5 | Misma unidad suma conservando el desglose; distinta compone; solo se compara lo del mismo tipo y unidad | `bql.js:sumar`, `comparar` | — | — | álgebra | C | §2.3 [A] tipos («200 m + 5 €») |

#### Validez y versiones

| # | Regla | Hoy | Posición | Despliegue | BQL mínimo | C/L | Respaldo |
|---|---|---|---|---|---|---|---|
| VA-1 | Cinco capas con ok, pendiente o falla, sin veredicto global; repiten las reglas de arriba con el libro de justo antes | `validez.js:validez`, `libroAntes` | todas las M-* `@antes` | — | cada capa = las filas de su familia | C | §2.8 [A] |
| VA-2 | Lo que no se lee bajo la época elegida queda pendiente, no es un fallo | `validez.js:capaForma` | — | — | — | C | §9 [D] época fuera del dato |
| VA-3 | El prefijo migrado de la versión 2 se valida con sus reglas (T y P solo del génesis; personas y grupos emiten; sin escalonado ni reloj) | `ciclo.js:reglasV2`; `eje.js` (`eventosV2`); `persistencia.js` | — | — | otro juego de reglas para un tramo del eje | — | [Core] persistencia v3 |

Son 138 filas. Las que §15 retira o cambia (PP-2 a PP-7, AU-1 a AU-14, EE-7, OC-1) son 22: conviene no pasarlas a reglas tal cual, sino esperar al P nuevo y al ciclo como lectura.

---

## 3. Las funciones de BQL hoy

Todas las de `src/bql.js`, sin proponer sustitutos ni léxico final (lo deciden Core y VG). «Álgebra» = operar sobre la matriz (traer, colocar, aplicar una posición, sumar, comparar, contar); «escoger» = elegir algo concreto por su nombre o su significado, con una regla de funcionamiento dentro.

| Función | Qué hace | Clase | Por qué |
|---|---|---|---|
| `=` y `==` | fórmula en un slot; texto que empieza por «=» | suelo | convención del intérprete |
| literales: número, `"texto"`, `12 EUR` | valores | álgebra | la magnitud escrita en un slot (no en la fórmula) lleva la regla BQ-3 |
| `+` `-` | suma con desglose; unidades distintas componen | álgebra | |
| `*` `/` y `-` unario | producto, división, negación | álgebra | |
| `=` `<>` `<` `>` `<=` `>=` | comparan escalares del mismo tipo y unidad | álgebra | |
| `Y` `O` `NO` | lógica | álgebra | |
| `LOCAL(i, …)` | trae una posición de la décupla anfitriona | álgebra | traer relativo |
| `REF(id, dir?)` | trae otro registro o una dirección suya | álgebra | traer absoluto; resolver el id por prefijo es suelo |
| `BUSCAR(n)`, `BUSCAR(n, …, k)`, `BUSCAR("dirección")` | trae los ocupantes de una posición (índice, ocupante k o colisión entera) | mixto | traer es álgebra, pero lleva dentro la elegibilidad del dueño (EN-6, EN-7) y el tope de candidatos (BQ-1) |
| `ACTUAL(pv)` dentro de `FILTRAR` u `ORDENAR` | la posición pv de cada candidato | álgebra | aplicar una posición a una colección (transponer) |
| `ACTUAL(pv, cantidad?)` fuera | busca en pv y toma los primeros | mixto | `BUSCAR` más tomar posiciones de la lista |
| `FILTRAR(col, cond)` | los candidatos que cumplen la condición | álgebra | |
| `ORDENAR(col, expr, "desc"?)` | permuta la colección por una clave escalar | álgebra | |
| `ELEGIR(col, k?)` | las k primeras, sin publicar | álgebra | tomar posiciones de la lista; su papel en la fábrica (FA-3) es la elección |
| `CONTAR(col)` · `SUMAR(col)` | contar · sumar | álgebra | |
| `ORIGEN()` | propio, referencia o escrito | escoger | lee un metadato del encaje; REGLAS_CORTAS pone los campos de encaje en el 5 del candidato |
| `PRESENTE()` | si el registro del candidato pagó con T real | escoger | lleva dentro EV-3 |
| `ACUERDO()` | profundidades de acuerdo del vector | álgebra | resta de direcciones y cuenta de ceros iniciales |
| `DESPLAZAMIENTO()` | suma de distancias del vector | álgebra | |
| `FALTAS()` · `EXCEDENTES()` | cuántas componentes negativas · positivas | álgebra | |
| `SIGNO()` | exacto, completar, reducir o mixto | escoger | da un nombre a partir del vector |
| `BASES(alcance?, medida?, k o campo?)` | lee la base del 8 de una cohorte | escoger | lleva dentro OC-6, OC-7, OC-8, OC-13 y la forma de la base |
| `CAJA(medida, alcance?)` | la caja del anfitrión | escoger | ídem, más OC-9 |
| `FRESCURA(alcance?)` | llegadas desde la base | escoger | lleva dentro OC-11 |
| `VALOR_R("titular")` | valor de la R con la lente del lector | escoger | lleva dentro RR-7, RR-8, RR-9 |
| `LENTE("emisor")` | peso que el lector da a un emisor | escoger | es leer una posición (`alta(lector).3`) por el nombre del emisor |

Recuento: de 26 entradas, 16 son álgebra o suelo, 2 mixtas y 8 escogen algo concreto.

---

## 4. El estado que hoy guardan las estructuras internas

Inventario, sin diseño: qué se guarda, dónde, de qué sale y qué filas lo leen. Todo se deriva de la lista de eventos, que es lo único que se persiste.

| Estructura | Dónde | Qué guarda | Sale de | Filas que lo leen |
|---|---|---|---|---|
| `saldos` | `eje.js` (`Eje`) | identidad → serie → disponible | los movimientos, en orden | BL-2, TT-10, PP-6, ES-2, ES-3, RR-2, AU-11 |
| `bloqueados` | `eje.js` | identidad → serie → salida → cantidad | movimientos con estado | BL-2, EE-7, EE-8, EE-10, RR-3, RR-4, RR-6, AU-8 |
| `#porSalida` | `eje.js` | salida → serie → identidad → cantidad (índice inverso) | ídem | BL-3, AU-7, AU-14 |
| `claves` | `eje.js` | identidad → clave pública | `contexto.claves` de las altas | ID-4 a ID-6, OC-1, AU-11 |
| `#tipos` | `eje.js` | identidad → persona o cosa | `contexto.tipos` de las altas | ID-3, ID-9, TT-8, TT-9, OC-2 |
| `#altas` | `eje.js` | identidad → { id, t } del alta | primer movimiento recibido | ID-1, RL-2, TT-2, RR-7 |
| `#series` | `eje.js` | serie → emisor, emitido, consumido, `deAsignacion`; en E, caduca, registro, divisible, emisores | emisiones y consumos | EE-1, EE-5 a EE-12, PP-3, PP-5, AU-4, RR-3 |
| `#gastadoT` | `eje.js` | [persona, escala, día civil] → gastado | consumos de T | TT-2 a TT-4 |
| `#tiempoSobre` | `eje.js` | registro → escala → T consumido sobre él | consumos de T | TT-11 |
| `#informativo` | `eje.js` | registro → T pasado, futuro, inventado con sus dos fechas | consumos informativos | TT-5 |
| `#tMax`, `#tPorAutor` | `eje.js` | mayor `t`, en total y por autor | `t` de cada evento | RL-3, RL-4 |
| `#ampliadas` | `eje.js` | consolidaciones que ya respaldaron una ampliación de P | ejecuciones | PP-3 |
| `demostracion` | `eje.js` | si el eje es de demostración | `contexto.demostracion` del génesis | ID-4, ID-6, ID-7 |
| `#prefijoV2`, `eventosV2` | `eje.js` | qué eventos se validan con las reglas de la versión 2 | la marca de `persistencia.js` | VA-3 |
| `hijos`, `#hijosEn`, `#porAutor`, `#llegada`, `#prefijos` | `eje.js` | índices: lo escrito sobre cada registro, por dirección, por autor; orden de entrada; ids por prefijo | `sobre`, `en`, autor, orden | EN-*, OC-*, AU-7, AU-9 (son suelo) |
| índice de la lente (`INDICES`) | `lente.js` | R: emitido, tenencias (saldo, parte, eventos), devoluciones y su atención, anclas «lente», declaraciones de lente | movimientos de R, eventos en el 3 del alta, `contexto.atiende`, `contexto.lente` | RR-2 a RR-9 |
| `PARTICIONES` | `bases.js` | por registro: sus hijos y sus bases válidas | lo escrito sobre él | OC-1, OC-3 a OC-5, OC-11 |
| `importadas` | `autoridad.js` | claves públicas ya importadas | — | caché, suelo |
| `libroAntes` | `validez.js` | copia de saldos, bloqueos, series, claves, tipos y altas hasta un evento | releer los eventos hasta él | VA-1 (todas, con «hasta») |

Estado que no se guarda y se recalcula en cada lectura: el estado de una consolidación (AU-9), el registro del recurso (AU-2), el umbral (AU-5), los elegibles (EN-6), el E vivo y los topes (EE-5, EE-6), el valor de R (RR-8), el poder sobre un registro (PP-6), la frescura (OC-11).

Estado que vive en `contexto` de los eventos, fuera de las posiciones, y que leen reglas: `genesis`, `demostracion`, `claves`, `tipos`, `fase`, `motor`, `fuentes`, `encaje`, `nuevos`, `evidencia`, `autoridad` (con `respaldo` y `caduca`), `libera`, `atiende`, `lente`, `subdominio`, `heredadas`, `modo`, `bases` (con `n`, `nSubarbol`, `hasta`, `epoca`, `sinBase`). Ninguno se puede leer hoy con BQL.

Ya legible por posición (como el 8): bases (`r.8`), lente (`alta.3`), umbral y capacidad (`r.2`), elegibles (`r.2.3`, `r.3`), fábrica (`x.4`), tramo (`r.7`). Y con «hasta» explícito, solo dos: las bases del 8 y `libroAntes`.

---

## 5. Lo que no he sabido expresar como posición y álgebra mínima

Para que VG decida; no propongo salida.

1. **Las claves de serie no son dígitos.** `E:casa/cama-2@2026-11-13@<id>` se parte por texto (la primera `/`, la última `@`). La franja, la familia `@*` y la denominación son «escoger algo concreto» sobre un texto. Sin un despliegue que convierta la clave en posiciones (D-SERIE), las series quedan como ocupantes de una lista que solo se filtran comparando textos.
2. **La fecha.** Pasar un instante ISO a su día civil exige calendario (⌊ms ÷ 86 400 000⌋, meses de longitud variable, zonas). Es la regla de despliegue que VG pone de ejemplo, pero no es álgebra sobre la matriz: o es suelo o es una primitiva nueva.
3. **Recorridos sin tope fijo.** El hilo (`↑r`), la cadena de referencias (hasta 20 saltos), la frescura y el fundido de bases bajan o suben un número de niveles que no se conoce de antemano. Hace falta un desplazamiento repetido con tope; con «coloca, trae, aplica» de un paso no sale.
4. **Ordenar y «el último».** Varias reglas dependen de la llegada (la última declaración de la lente, la última base, el desempate del encaje) o de ordenar por una clave (PV8 por masa). La llegada es del eje, no del payload.
5. **Redondeos y desigualdades estrictas.** La cuota de E usa ⌊⌋ con un margen de coma flotante; el umbral distingue «más de la mitad» (>) de «alcanzar» (≥). Es aritmética, pero no está entre las operaciones que nombró VG.
6. **Máximo y mínimo sobre todo el eje.** El reloj (RL-3, RL-4) es el mayor `t` de los eventos de otros: una lectura global que excluye identidades concretas.
7. **Validar un evento que aún no está en el árbol.** Las reglas leen el estado `@antes` y el propio evento como candidato. El álgebra necesita un contexto «como si estuviera» que no es una posición.
8. **Aplicar los movimientos en orden.** Saldo insuficiente, bloquear y luego liberar en el mismo evento, emitir y dar a la vez: es simulación secuencial. La dejo en el suelo (aritmética de saldos), pero varias reglas (TT-4, RR-3, RR-6, EE-7) cuentan lo que el propio evento mueve antes y después.
9. **Tres reglas en la misma posición 2 con tres formas distintas.** La capacidad es un entero en el 2, el umbral es un texto que empieza por «umbral» en el 2 o en un 2.k, y los elegibles son la lista del 2.3. Distinguirlas exige mirar el tipo o el prefijo del texto.
10. **Metadatos en `contexto`.** Las reglas de la fábrica, la lente, R y las bases leen dieciocho campos de `contexto` (sección 4). REGLAS_CORTAS deja abierto si la fase va en el payload (duda 8) y dónde van las referencias de `ejecutar` (duda 7). Sin esa decisión, D-META no tiene destino fijo.
11. **Lecturas de texto.** «12 EUR» como magnitud y «umbral 1/2» como fracción son análisis de un terminal, no posiciones.
12. **Criptografía y gancho de lectura.** Verificar firmas y posesión, y el gancho `puedeLeer`, no son reglas de la época: son suelo o AARPIA.
13. **Propiedades sobre el conjunto de reglas.** «Ninguna regla lee T para conceder algo a terceros» y «el tipo no da renta» son comprobaciones sobre todas las reglas a la vez (hoy, pruebas estáticas), no una regla más.
14. **Varias versiones de reglas en un mismo eje.** El prefijo de la versión 2 se valida con otras reglas (VA-3). Como reglas de una época es natural, pero el cargador tendría que elegir la época por tramo del eje, y hoy la época está fuera del dato (§9 [D]).
15. **El P nuevo de §15** (diez unidades por décupla, una décima al subir, el 100 % por dominio, plantillas de recuento) no está en el código, así que no está en la tabla.
