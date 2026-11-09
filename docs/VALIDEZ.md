# Las cinco capas de validez

`src/validez.js` lee un registro y devuelve cinco estados independientes, uno por capa: forma y época, interpretación, criptografía y procedencia, acreditación material, permiso y ejecución. Cada capa dice `ok`, `pendiente` o `falla`, con sus motivos y un resumen. No hay veredicto global ni puntuación, y la función no escribe nada.

Las cinco capas vienen del corpus V2 y se conservan en V3 y V4. El mapa global las marca [A] (§2.8): acuerdo de trabajo, no ratificado por VG.

- V2 `02_CONTEXTO/05_PROTOCOLOS_EPRT_Y_VERIFICACION.md` l.30–36: «Separar expresamente: 1. Validez de forma/época […] 2. **Interpretable**: una lectura tiene contexto, tipo de resultado y resolución de referencias suficiente. 3. **Criptográficamente comprobable**: firmas, hash, procedencia de un registro […] 4. Materialmente acreditado […] 5. Autorizado/ejecutado».
- V4 `01_MODELO_INTEGRADO_V1_A_V4.md` l.40: «Validez estructural ≠ interpretación suficiente ≠ firma/criptografía ≠ prueba material ≠ autorización.»
- V4 `06_EPOCAS_TIEMPO_EPRT_Y_FRONTERAS.md` l.33–41: las cinco capas («2. Interpretación de contexto, referencias y posiciones», l.36), y «PV5 permite inspeccionar señales, no garantizar las cinco capas».
- Contrato v0.2 l.293: «Los estados pueden coexistir por campo o afirmación. No colapsarlos en una puntuación global inventada.»

La nota de lectura `docs/notas/CAPAS_DE_VALIDEZ.md` recoge las citas y las opciones A–J. Esta pieza corresponde a la opción B, un módulo de solo lectura, con el vocabulario `ok`/`pendiente`/`falla` del encargo. También responde al hallazgo C29 de `docs/notas/AUDITORIA_AJUSTE.md` («no se sabe qué capa falló»), sin tocar `eje.validar`. La opción C, pintar las capas en PV5, queda fuera de esta pieza.

## 1. Principios que el código respeta

- **Independientes.** Cada capa se calcula por su cuenta y ninguna lee el estado de otra. Un mismo hecho puede tocar dos capas por razones distintas: si huésped emite euros de la casa, nadie los respalda (4) y nadie emite en nombre de otro (5). Y al revés, dos hechos distintos en dos capas: si cocina (una cosa) emite minutos de T, el reloj los respalda (4 en `ok`) pero solo las personas emiten (5); si huésped (una persona) emite más horas de las que da el reloj desde su alta, falta respaldo (4) y el permiso está (5 en `ok`).
- **Sin veredicto.** El resultado no tiene `estado`, `valido` ni nota; solo las cinco partes.
- **Sin efectos.** La función no escribe en el eje ni modifica el evento (`test/validez.test.js`, «sin efectos»).
- **Una firma no es veracidad.** Una firma verificada deja la capa 3 en `ok` y no sube ninguna otra. Un pago firmado de cien euros que el autor no tiene sale con la capa 3 en `ok` y la capa 4 en `falla`.
- **Lo ausente no es falso.** Si falta una referencia, un foco o un contexto, el estado es `pendiente`, porque puede llegar (V4 `02_BTML…` l.49: «Referencia/contexto ausente → PENDIENTE»). Una referencia ausente da lo mismo escrita como `{ ref }` o como `=REF(…)`: `pendiente` en la capa 2 (BQL da `PENDIENTE`, «referencia ausente del eje»).
- **Pendiente es lo que puede llegar.** Lo que nunca llegará no es `pendiente`: un evento no cambia, así que un movimiento mal formado no se arreglará (capa 4 en `falla`), y a una identidad que ya existe no se le puede añadir clave (una firma suya sin clave cuenta como sin firma, ver el punto 4 del §8).
- **La época está fuera del dato** (MAPA §9 [D]). La capa 1 lee el registro bajo la época que se elige al leer (la época 0 por defecto). Si una regla corta falta, el registro queda «no legible bajo esta época» (`pendiente`), sin estar mal formado. Es provisional: punto 12 del §8.
- **PV5 inspecciona, no garantiza.** Lo que ninguna capa comprueba está en la columna «no comprueba» de la tabla del §3.

## 2. Uso

<!-- comprobar: fragmento -->
```js
import { validez, CAPAS, ESTADOS_CAPA, ESTADO_MOTOR, estadoDeBql } from './src/validez.js';

const v = await validez(eje, evento, { epoca }); // evento: un id del eje o un evento (esté o no en el eje)
v.capas;          // [5 partes], en el orden del corpus
v.forma; v.interpretacion; v.criptografia; v.acreditacion; v.permiso; // las mismas partes, por nombre
v.enEje;          // true si es el registro del eje: su id está en el eje y corresponde a su cuerpo
v.resumen;        // cinco líneas
// cada parte: { capa, clave, nombre, estado: 'ok' | 'pendiente' | 'falla', motivos: [], resumen, …detalle }
```

`evento` puede ser un registro que no está en el eje: un borrador, uno recibido o uno manipulado. Se lee contra el eje sin añadirlo. Una copia con el id de un registro del eje y otro cuerpo no es ese registro: `enEje` es `false` y se lee como un borrador (§5). Un id que no está en el eje lanza `registro desconocido`. Un evento malformado no hace fallar la llamada: la capa que no se puede comprobar queda en `falla` con el motivo «no se pudo comprobar».

La compra del ejemplo (`ejemplos/ikisai/compra-food.mjs`, sin claves; salida real):

```text
1 forma y época: ok · forma válida · legible bajo época 0 (profundidad 2)
2 interpretación: ok · sin fórmulas · 2 de 2 referencias resuelven
3 criptografía y procedencia: ok · id correcto · sin firma (huesped no tiene clave) · foco en el eje
4 acreditación material: ok · 2 movimientos respaldados por series de su emisor, ningún saldo negativo · externa: sin acreditar
5 permiso y ejecución: ok · mueve lo suyo · no es consolidación, autorización ni ejecución
```

Detalle de cada parte:

| Capa | Campos |
|---|---|
| 1 | `errores` (los de `validarForma`), `epoca`, `profundidad`, `lectura.en` (la dirección `en` leída bajo la época) |
| 2 | `formulas: [{ camino, dir, formula, estado (BQL), texto, capa }]`, `referencias: [{ desde: 'payload' \| 'contexto.fuentes' \| 'contexto.evidencia', camino?, ref, dir?, estado, procedencia? }]` |
| 3 | `idCorrecto`, `firma` (`verificada`, `sin firma`, `sin verificar`, `ausente`, `inválida`, `de otro`), `firmante`, `clavesDeclaradas: [{ identidad, por, posesion }]` (`probada`, `falla` o `sin probar`), `enEje`, `demostracion` (R9: el eje es de demostración) |
| 4 | `movimientos: [{ i, clave, de, a, cantidad, estado, motivo? }]`, `externa` (constante `SIN_ACREDITAR`) |
| 5 | `libro: { estado, motivos }`, `motor` (null fuera de la fábrica), `regla`, `externa` (constante `SIN_CONFIRMAR`) |

`motor` de una consolidación: `{ fase, estadoMotor, puedenAutorizar, autorizaciones, noCuentan, ejecuciones }`. De una autorización o una ejecución: `{ fase, consolidacion, estadoConsolidacion, cuenta }`.

## 3. Qué comprueba cada capa y qué no

| Capa | Qué comprueba (código) | Qué **no** comprueba | De quién es lo que falta |
|---|---|---|---|
| **1 · forma y época** | `validarForma`: autor, `sobre`, `en` de diez dígitos, `t` ISO, movimientos bien formados, el autor mueve T, payload terminal o array de 1 a 10 posiciones sin huecos. Además, que cada dígito del payload y de `en` tenga regla corta bajo la época elegida | Que el contenido signifique lo que dice (PV0 puede ser engañoso); las reglas largas, que no existen; que la época elegida sea la legítima; la profundidad (pasar de diez no es de forma: va en la capa 2) | Reglas cortas y largas (V5); legitimidad del tronco: VG |
| **2 · interpretación** | Lo que se puede leer: cada fórmula BQL del payload, evaluada con `bql.evaluar` en su celda (`RESUELTO` → ok; `PENDIENTE…` → pendiente; `INCOMPATIBLE`, `ERROR` → falla); cada referencia BTML del payload, seguida con `encaje.seguir` (ausente → pendiente; posición sin desarrollar → pendiente; cadena sin fin → falla); las referencias del contexto (`contexto.fuentes`, `contexto.evidencia`: ausente → pendiente; no es un id → falla); y que ningún nodo pase de diez profundidades (pendiente, como BQL) | Los literales, que se leen tal cual sin que eso los haga ciertos; los permisos de lectura (`04_AGRAM` l.14); las fórmulas de los registros que cuelgan de este | Permisos de lectura: [X] abierto (BQL tiene el gancho `puedeLeer`, sin regla); el cambio de foco: [X] (F1 de la auditoría) |
| **3 · criptografía y procedencia** | `id` = hash del cuerpo canónico; firma ECDSA del autor si tiene clave en el libro de su momento; firma de un autor sin alta → pendiente (su clave puede llegar con el alta); con `exigirFirmas` y sin clave → falla; **sin clave no se actúa** (R9): fuera de un eje de demostración, un autor sin clave → falla, y un génesis sin clave → falla; foco (`sobre`) y autor en el eje; claves declaradas solo para identidades nuevas que reciben tokens, cada una con su **prueba de posesión** (`posesion`: la clave nueva firma el id del alta) → `probada`; si la firma no es de esa clave → falla; sin prueba → `sin probar` (falla fuera de la demostración) | Quién hay detrás de una clave; anclaje (raíz Merkle, Bitcoin) y transporte (Nostr); **que lo firmado sea verdad** | AARPIA (identidades); StateArk/Bitcoin (anclaje) |
| **4 · acreditación material** | El respaldo en el libro, desde los datos del eje: cada token que se mueve es de una serie emitida (`emitido > 0`) por su emisor; fuera del génesis (VG, 7-11 noche; reglas de `src/ciclo.js` con capa 4), una emisión de T la respalda el reloj (el tope desde el alta de la persona; PROVISIONAL [X], pendiente del estudio de neutralidad ante agrupación y división), una de P un registro que existe (nunca `genesis`), y una de E coincide con la caducidad de su serie (como instante); el `t` del evento no es anterior al de su foco ni al alta de su autor, ni va más de un año por delante del mayor `t` del eje (**[X] confirmar VG**); un registro guardado con la versión 2 se lee con las reglas de entonces (la marca `v2`, `docs/MOTOR.md` §9); cada emisión de E o R la hace el emisor de su serie, a su nombre (no hay grupos que emitan: VG, 8-11); emitir R tiene su colateral (R6, `src/lente.js`: R del autor bloqueada con la salida = la serie, la décima parte de lo emitido) y el colateral no baja de ahí; bloquear sale del disponible y liberar, de lo bloqueado con esa salida; P respaldado por el poder de los ámbitos que cubren el suyo, y ese ámbito existe; ningún saldo queda negativo; lo emitido sigue siendo finito. Un movimiento mal formado o un evento sin movimientos: falla (su respaldo no se puede comprobar) | **Que lo afirmado ocurrió en el mundo**: que cocina sirvió el menú, que la plaza existe, que los euros de la casa tienen algo detrás fuera del eje. Ninguna evidencia ni garantía externa | Fuera de AGRAM (V2: «evidencia y garantías externas apropiadas»); StateArk/Bitcoin para el valor |
| **5 · permiso y ejecución** | En el libro: nadie mueve tokens ajenos, sin excepciones (el «por cuenta de un grupo» se retiró: VG, 8-11, «los grupos son solo delegación»); un alta no declara el tipo `grupo` (no hay identidades de grupo); solo emiten las personas (VG, 7-11 noche; el tipo declarado en el alta solo decide esto, quién firma emisiones, y nada más: R10, el tipo no da renta), T para sí mismas, P solo sobre un registro que escribieron (quien solo tiene P lo transfiere, no lo acuña); nadie emite en nombre de otro (MAPA §12 [D]: «Nadie emite denominación ajena; solo el emisor amplía su serie»); el escalonado T → R → P → E (`src/ciclo.js`, las reglas con capa 5; la «R propia en juego» es el colateral de R6); el colateral de R no se libera con devoluciones sin atender, y solo el emisor atiende las de su R (`contexto.atiende`, `src/lente.js`); tipos declarados en el alta y solo para identidades nuevas; el génesis emite a su autor. En la fábrica: `motor.estadoDe`, quién puede autorizar (`puedeAutorizar`: quien tiene P sobre el registro del recurso, el autor incluido; VG, 7-11 noche: autorizar = bloquear P con el umbral del dueño, `docs/MOTOR.md` §4) y cuánto P hay bloqueado contra el umbral, autorizaciones que no cuentan (no bloquean P que cuente), y que una ejecución la escriba el autor de la consolidación estando AUTORIZADA justo antes (el P bloqueado de ese momento, leído en el libro de justo antes, porque después se libera); y R3: ampliar una serie `P:X` ya emitida solo vale ejecutando una consolidación autorizada sobre X | **Efectos externos confirmados** (que el pago salió, que el servicio se prestó); el resultado (éxito, rechazo, no ocurrido, parcial, sin confirmación: `04_AGRAM` l.34); la ejecución real (AARPIA) | AARPIA: «el motor real de autorización/ejecución» (MAPA §12 [D]) |

Las dos constantes que dejan esto dicho en cada lectura:

- `SIN_ACREDITAR` (capa 4): «sin acreditar: que ocurrió en el mundo no lo prueba el eje (fuera de AGRAM)».
- `SIN_CONFIRMAR` (capa 5): «sin confirmar: los efectos fuera del eje son de AARPIA».

## 4. Estados

| Estado | Significa |
|---|---|
| `ok` | la capa comprueba lo suyo y no encuentra nada |
| `pendiente` | falta algo que puede llegar o que otro tiene que hacer: una referencia o un foco ausente, un autor sin alta, una posición sin desarrollar, una fórmula `PENDIENTE`, un nodo a más de diez profundidades (falta el cambio de foco), una consolidación sin autorizar o sin ejecutar, una regla corta que la época no tiene |
| `falla` | lo que hay contradice lo que la capa exige, o no se puede comprobar y nunca se podrá: forma rota, fórmula imposible, id que no corresponde, firma ausente o inválida, tokens sin respaldo o saldo negativo, un movimiento mal formado, tokens ajenos, una emisión en nombre de otro, una autorización o una ejecución que no cuenta |

Dentro de una capa se queda el peor de sus motivos: `falla` antes que `pendiente`, y `pendiente` antes que `ok`.

BQL → capa 2 (`estadoDeBql`): `RESUELTO` → `ok`; todo lo que empieza por `PENDIENTE` (también `PENDIENTE POR LÍMITE` o `PENDIENTE DE AUTORIZACIÓN`) → `pendiente`; `INCOMPATIBLE`, `ERROR` y cualquier otro → `falla`.

Motor → capa 5 (`ESTADO_MOTOR`):

| `estadoDe` | Capa 5 | Motivo |
|---|---|---|
| `PENDIENTE DE AUTORIZACIÓN` | `pendiente` | quién puede autorizar hoy, o «nadie puede autorizar hoy», y cuánto P hay bloqueado de cuánto emitido con el umbral (`0 de 10 P del eje bloqueado; umbral: más de la mitad`); y cada «autorizado» que no bloquea P que cuente |
| `AUTORIZADO` | `pendiente` | por quién y con cuánto P bloqueado, y que falta ejecutar: consolidar no es ejecutar |
| `EJECUTADO` | `ok` | efectos externos sin confirmar; si ninguna ejecución se hizo con la consolidación AUTORIZADA justo antes, `falla` (§6) |
| otro | `pendiente` | «estado del motor sin traducir a esta capa» |

## 5. El libro del momento

Cada registro se lee en su lugar del eje. Si el registro es el del eje (su id está en el eje y corresponde a su cuerpo), el libro (saldos, series, claves y tipos) se rehace con los eventos anteriores a él, así que las capas 3, 4 y 5 dicen lo que valía cuando entró, y la fábrica se lee con el motor del eje para ese id. Si no lo es (un borrador, uno recibido o una copia manipulada con el mismo id), se lee con el libro de ahora y la fábrica como borrador: lo que diría el motor si entrara, sin las autorizaciones ni el estado del registro real. El libro se rehace leyendo `eje.orden`, sin tocar el eje; el poder P se descuenta igual que en el eje, del ámbito más concreto al más amplio (`eje.ambitosQueCubren`).

La excepción es quién puede autorizar y si una consolidación está autorizada: se calcula con el eje de ahora, igual que hace el motor (`puedeAutorizar`, `autorizacionesValidas`, `estadoDe`). Como autorizar es bloquear P (VG, 7-11 noche), el P bloqueado no se puede delegar mientras siga bloqueado, así que la casa ya no puede deshacer su autorización delegando; sí liberándolo (retirarla), y entonces deja de contar. Una ejecución, en cambio, se juzga con el libro de justo antes de ella (el P bloqueado de ese momento), porque al ejecutar el bloqueo se libera.

## 6. Lo que el eje rechaza, por capa

`eje.validar` devuelve una lista plana de mensajes que mezcla capas (`docs/BTML.md` §7.4). Este es el reparto que hace `validez`, sin tocar el eje:

| Rechazo del eje | Capa |
|---|---|
| `evento mal formado: …` (`validarForma`) | 1 (y 4 si es un movimiento: su respaldo no se puede comprobar) |
| `id no corresponde al cuerpo` | 3 |
| `ya hay génesis`, `solo el génesis carece de foco` | 3 |
| `every record hangs on a record of the ledger` (el foco no está) | 3 (pendiente: puede llegar) |
| `referencia a un evento que no está en el eje` (suelo, VG, 10-11, C1) | 2 (pendiente: con red se resolvería antes de aceptar) |
| `firma inválida`, `autor sin clave`, `clave inválida`, `prueba de posesión inválida para …`, `prueba de posesión de … sin clave declarada` (suelo: criptografía) | 3 |
| `who has a key signs`, `without a key nobody acts`, `a key is declared at its alta`, `a declared key comes with its proof` (reglas de la época, B4) | 3 |
| `no hay tipo en el alta` (B1); en el prefijo de la versión 2, `no se puede cambiar el tipo`, `tipo declarado … sin darle tokens`, `tipo inválido` | 5 |
| `writing burns today's T`, `not before its focus`, `not before the writer joined`, `at most a year ahead`, `E is tied to a record that exists`, `locked P backing live E is not released`, `P moves within a known scope` (reglas de la época) | 4 |
| `P sobre todo el eje («genesis») solo lo emite el génesis`, `P fuera del génesis va sobre un registro existente`, `la serie … caduca …` / `… no caduca` | 4 |
| `only persons mint`, `E is minted by and to its issuer`, `R is minted by its issuer`, `nobody mints T`, `T is not locked`, `T only goes to things`, `nobody moves tokens of others` (reglas de la época) | 5 |
| `la emisión de P va a quien la emite`, `P sobre … lo acuña solo quien escribió el registro …`, `emitir … exige consumir T del autor`, `… exige R propia en juego`, `emitir E exige P del autor sobre el registro` (siguen en JS hasta el 3b) | 5 |
| `saldo disponible insuficiente para bloquear`, `no hay … bloqueado … con la salida` | 4 |
| `la serie … no admite tanto` | 4 |
| `saldo insuficiente de P`, `saldo insuficiente de …` | 4 |
| `evento ya registrado` | ninguna: si es el registro del eje, se lee en su lugar |

Las reglas de la época llegan a las capas con los mismos motivos que da el eje (`src/condiciones/reglas.js`, `CAPA_DE_REGLA`): la validez y el eje leen las mismas reglas. En el prefijo de la versión 2, la capa 3 y la 5 dicen lo de entonces, con sus textos (`firma ausente`, `nadie mueve tokens ajenos`…).

Las capas también señalan cosas que el eje admite:

- una referencia a un evento ausente, en el payload (`{ ref }` o `=REF`) o en el contexto (capa 2, pendiente);
- una fórmula pendiente o imposible (capa 2);
- un nodo a más de diez profundidades (capa 2, pendiente: posición sin desarrollar, como BQL);
- un «autorizado» escrito por quien no puede, o un «ejecutado» sin autorización (capa 5, falla en ese registro);
- en un eje de demostración, una firma de un autor con alta y sin clave, que nunca podrá verificarse (capa 3, `firma: 'sin verificar'`; cuenta como sin firma, ver el punto 4 del §8). Fuera de la demostración el eje ya no la admite (R9).

## 7. Casos (`test/validez.test.js`)

Estados en el orden 1–5:

| Caso | Estados | Lo que muestra |
|---|---|---|
| La compra, la cuenta, las altas, el menú y el génesis del ejemplo | ok ok ok ok ok | las fórmulas de la cuenta, resueltas («14 EUR (12 EUR + 2 EUR)») |
| Nota con `{ ref: <id ausente> }` y otra a una posición sin desarrollar | ok **pendiente** ok ok ok | lo ausente no es falso; las referencias son de la capa 2 |
| `=REF("ffffffff", …) + 2 EUR` y `{ ref: <id ausente> }` | ok **pendiente** ok ok ok | la misma referencia ausente da lo mismo en la misma capa, se escriba como se escriba |
| Borrador cuyo foco no está en el eje | ok ok **pendiente** ok ok | el foco es procedencia del registro (ver el punto 11 del §8) |
| Firma quitada tras restaurar (con claves) | ok ok **falla** ok ok | las otras cuatro son las mismas que con la firma; `restaurar` del guardado sin firma se rechaza |
| Firma de cocina, que tiene alta y no tiene clave | ok ok ok ok ok | `firma: 'sin verificar'`: no puede llegar la clave; cuenta como sin firma (G1) |
| Firma de alguien sin alta | ok ok **pendiente** ok ok | la clave puede llegar con el alta |
| Pago firmado de 100 EUR que el autor no tiene | ok ok ok **falla** ok | una firma no es veracidad |
| Cocina paga con `E:cocina/EUR`, que nunca emitió | ok ok ok **falla** ok | sin serie no hay respaldo; moverlos sí es cosa suya |
| Huesped emite `E:casa/EUR` | ok ok ok **falla** **falla** | nadie los respalda (4) y nadie emite en nombre de otro (5) |
| Huesped mueve euros de la casa | ok ok ok ok **falla** | hay respaldo, no hay permiso |
| Cocina emite minutos de T, una serie nueva de T (`T:anio`) o P | ok ok ok **falla** **falla** | un hecho, dos capas, dos razones: solo el génesis respalda y emite T y P |
| Cocina delega más P del que tiene | ok ok ok **falla** ok | P respaldado por sus ámbitos |
| `=LOCAL(5) + 2 EUR` sin posición 5 | ok **pendiente** ok ok ok | fórmula pendiente |
| `="propina" + 2 EUR` | ok **falla** ok ok ok | fórmula imposible (INCOMPATIBLE) |
| Consolidación sin autorizar | ok ok ok ok **pendiente** | pueden autorizar: casa · 0 de 10 P del eje bloqueado; umbral: más de la mitad |
| «Autorizado» escrito a mano por cocina | ok ok ok ok **falla** | el escrito existe y no cuenta; la consolidación sigue pendiente y lo lista en `noCuentan` |
| Autorizada por la casa | ok ok ok ok **pendiente** | AUTORIZADO por casa (10 de 10 P del eje bloqueado; umbral: más de la mitad) · falta ejecutar |
| Ejecutada por el autor | ok ok ok ok ok | EJECUTADO · externa: sin confirmar |
| «Ejecutado» a mano sin autorización | ok ok ok ok **falla** | el motor da EJECUTADO; la capa 5 no (`docs/MOTOR.md` §13.2) |
| La compra con otro payload y el mismo id | ok ok **falla** ok ok | el id no corresponde al cuerpo: el registro no es el que dice ser, y `enEje` es `false` |
| La compra con `contexto.fase = 'consolidado'`, o una consolidación autorizada copiada con otro payload | ok ok **falla** ok **pendiente** | la capa 5 la lee como borrador («no está en el eje: se lee como borrador»): no dice lo del registro real, que en el segundo caso es AUTORIZADO |
| La compra bajo una época sin reglas en profundidad 1 | **pendiente** ok ok ok ok | la época está fuera del dato: bajo la época 0, ok |
| Payload de once profundidades (el eje lo admite) | ok **pendiente** ok ok ok | no es de forma; la capa 2 da lo mismo que BQL en `main` |
| Evento sin movimientos o con un movimiento mal formado (y sin id o con el id roto) | **falla** ok **falla** **falla** ok | el evento no cambia: lo que no se puede comprobar no es pendiente |

La consolidación del ciclo, paso a paso (salida real):

```text
5 permiso y ejecución: pendiente · mueve lo suyo · PENDIENTE DE AUTORIZACIÓN · pueden autorizar: casa · 0 de 10 P del eje bloqueado; umbral: más de la mitad
5 permiso y ejecución: falla · mueve lo suyo · autorizado que no cuenta · consolidación PENDIENTE DE AUTORIZACIÓN   ← el «autorizado» de cocina
5 permiso y ejecución: pendiente · mueve lo suyo · AUTORIZADO por casa (10 de 10 P del eje bloqueado; umbral: más de la mitad) · falta ejecutar
5 permiso y ejecución: ok · mueve lo suyo · EJECUTADO · externa: sin confirmar
```

## 8. Abierto: [X] decidir VG

Lo que el mapa no decide y aquí no se inventa. El código toma la opción indicada como provisional y la deja en un solo sitio para poder cambiarla.

1. **Vocabulario.** `ok`/`pendiente`/`falla` es el vocabulario de trabajo del encargo. La nota (opción D) lista cuatro candidatos del corpus y ninguno está ratificado. Cambiarlo toca `ESTADOS_CAPA`, `ESTADO_MOTOR` y `estadoDeBql`.
2. **Grano.** Hoy es el registro. La nota (opción E) propone bajar las capas 2 y 3 a posición u ocupante. Las fórmulas y las referencias ya salen una a una en el detalle.
3. **Qué capa lleva el libro de tokens, y la capa 4 en `ok`.** Hay dos cosas sin decidir.
   - **El reparto.** La nota (§3 y opción B) ponía el libro de tokens entero en la capa 5 («libro de tokens»: series, saldos, P con ámbito) y dejaba la 4 fija en «sin acreditar». Esta pieza, por el encargo, pasa a la 4 el respaldo (series emitidas por quien las respalda, saldos, P), y deja en la 5 quién mueve y quién emite.
   - **El estado de la 4.** El corpus pide evidencia externa. Hoy la capa queda en `ok` cuando el libro respalda y dice «externa: sin acreditar».
   - **Alternativas:** devolver series y saldos a la 5, como en la nota, con la 4 siempre «sin acreditar» (opción F1) o «no comprobada» (auditoría, C29); o mantener el reparto y dejar la 4 en `pendiente` mientras no haya nada externo.
4. **Autor sin clave.** ~~Opción G1~~ **Resuelto con R9** (regla madre de la neutralidad, aceptada por VG el 7-11 noche; `docs/notas/NEUTRALIDAD_IDENTIDAD.md` §4): G2 y G3 a la vez. Fuera de un eje de demostración, sin clave no se actúa (la capa 3 de un autor sin clave queda en `falla`) y cada clave declarada en un alta trae su prueba de posesión (`posesion`), que la capa 3 da por `probada` o `falla`. En un eje de demostración (`contexto.demostracion` del génesis; también los que vienen de la versión 2) sigue G1: «sin firma» en `ok`, la firma que nunca podrá verificarse como `sin verificar`, y la clave sin prueba como `sin probar`. Solo queda `pendiente` si el autor aún no tiene alta, porque la clave puede llegar con ella.
5. **`EJECUTADO` en `ok`.** Hoy significa que la transición de tokens entró en el eje, no que ocurrió fuera. Falta saber quién declara el resultado (opción H de la nota) y si esa declaración pertenece a la capa 4 o a la 5.
6. **Más de diez profundidades.** La primera versión de esta PR lo daba como `falla` de forma (capa 1). Eso choca con dos cosas de la auditoría (`docs/notas/AUDITORIA_AJUSTE.md`):
   - La auditoría refutó justo esa lectura. En l.299 dice: «El límite es de posicionamiento por foco, no de forma». El corpus lo pone al posicionar: «sin superar diez profundidades por marco» (`04_AGRAM` l.15).
   - La auditoría pide un solo estado en todos los módulos (F1; l.447: «Hay que elegir antes de fusionar» la #36, que daba PENDIENTE, y la #43, que daba ERROR). La `falla` de la capa 1 era una tercera respuesta.

   Por eso hoy va en la capa 2 («posiciones», V4 06 l.36) como `pendiente`, con el texto de BQL («posición sin desarrollar»). Es lo que eligió la integración del 7-11 sin revisar (MAPA §13; `docs/BQL.md` §8), así que no añade una tercera respuesta. Sigue abierto con F1: el estado común («requiere cambio de foco», propone la auditoría) y cómo se registra el cambio de foco.
7. **`INCOMPATIBLE` → falla.** Podría ser `pendiente` si se entiende que falta una conversión. Hoy no hay conversiones y BQL lo trata como fallo de tipos.
8. **Quién pudo autorizar.** El estado de una consolidación se calcula con el P bloqueado de ahora, como el motor; una ejecución se juzga con el de justo antes de ella (VG, 7-11 noche: autorizar = bloquear P). Si el umbral o lo emitido cambian después (una ampliación de `P:X`), el estado de una consolidación aún sin ejecutar cambia con ellos.
9. **La capa 5 exige que la consolidación estuviera AUTORIZADA al ejecutarla y `estadoDe` no** (`docs/MOTOR.md` §13.2): un «ejecutado» escrito a mano por el autor da EJECUTADO en el motor y `falla` en la capa 5. Falta decidir si se arregla en el motor.
10. **Pintar las capas en PV5.** El módulo ya se exporta: `src/index.js` lo da como espacio de nombres (`import { validez } from './src/index.js'`, y luego `await validez.validez(eje, id)`, `validez.CAPAS`…), junto con `efectos`. Falta pintarlo en PV5 (opción C de la nota, `app.js`).
11. **Referencias en la capa 2; el foco en la 3.** Las referencias van en la capa 2, como dice el corpus (V4 06 l.36; V2 05 l.33: «resolución de referencias suficiente») y como las ponía la nota (§3). Eso vale para las del payload, escritas como `{ ref }` o como `=REF`, y para las del contexto (`fuentes`, `evidencia`). El foco (`sobre`) y el autor se quedan en la 3, como «procedencia de un registro» (V2 05 l.34): su hilo hasta el génesis y quién lo escribe. Es una lectura. El corpus pone también el «contexto» en la capa 2, y el foco podría ir allí.
12. **Época en la capa 1 (opción I de la nota, que no decide).** Hoy se usa una variante de I2: cada dígito del payload o de `en` sin regla corta bajo la época elegida deja la capa en `pendiente` («no legible bajo esta época»). Con I1 sería solo un dato informativo («leída bajo época N») y no cambiaría el estado. Tampoco está decidido si «sin regla» es `pendiente` (la época puede ganar la regla) o `falla`.
13. **Lo que no se puede comprobar.** Un movimiento mal formado o un evento sin movimientos dejan la capa 4 en `falla` («su respaldo no se puede comprobar»), igual que el resto de lo que no se puede comprobar (§2): el evento no cambia, así que no es `pendiente`. La alternativa es dejarla en `ok` sin nada que respaldar y que lo mal formado lo diga solo la capa 1.
