# Las cinco capas de validez

`src/validez.js` lee un registro y devuelve cinco estados independientes, uno por capa: forma y época, interpretación, criptografía y procedencia, acreditación material, permiso y ejecución. Cada capa dice `ok`, `pendiente` o `falla`, con sus motivos y un resumen. No hay veredicto global ni puntuación, y la función no escribe nada.

Las cinco capas vienen del corpus V2 y se conservan en V3 y V4. El mapa global las marca [A] (§2.8): acuerdo de trabajo, no ratificado por VG.

- V2 `02_CONTEXTO/05_PROTOCOLOS_EPRT_Y_VERIFICACION.md`: «Separar expresamente: 1. Validez de forma/época […] 2. Interpretable […] 3. Criptográficamente comprobable […] 4. Materialmente acreditado […] 5. Autorizado/ejecutado».
- V4 `01_MODELO_INTEGRADO_V1_A_V4.md` l.40: «Validez estructural ≠ interpretación suficiente ≠ firma/criptografía ≠ prueba material ≠ autorización.»
- V4 `06_EPOCAS_TIEMPO_EPRT_Y_FRONTERAS.md` l.33–41: las cinco capas, y «PV5 permite inspeccionar señales, no garantizar las cinco capas».
- Contrato v0.2 l.293: «Los estados pueden coexistir por campo o afirmación. No colapsarlos en una puntuación global inventada.»

La nota de lectura `docs/notas/CAPAS_DE_VALIDEZ.md` (PR #39, abierta) recoge las citas y las opciones A–J. Esta pieza corresponde a la opción B, un módulo de solo lectura, con el vocabulario `ok`/`pendiente`/`falla` del encargo. La opción C, pintar las capas en PV5, queda fuera de esta pieza.

## 1. Principios que el código respeta

- **Independientes.** Cada capa se calcula por su cuenta y ninguna lee el estado de otra. Un mismo hecho puede tocar dos capas por razones distintas: si cocina emite minutos de T, la capa 4 falla (la serie es de la casa) y la 5 también (solo el génesis emite T).
- **Sin veredicto.** El resultado no tiene `estado`, `valido` ni nota; solo las cinco partes.
- **Sin efectos.** La función no escribe en el eje ni modifica el evento (`test/validez.test.js`, «sin efectos»).
- **Una firma no es veracidad.** Una firma verificada deja la capa 3 en `ok` y no sube ninguna otra. Un pago firmado de cien euros que el autor no tiene sale con la capa 3 en `ok` y la capa 4 en `falla`.
- **Lo ausente no es falso.** Si falta una referencia, un foco o un contexto, el estado es `pendiente`, porque puede llegar (V4 `02_BTML…` l.49: «Referencia/contexto ausente → PENDIENTE»).
- **La época está fuera del dato** (MAPA §9 [D]). La capa 1 lee el registro bajo la época que se elige al leer (la época 0 por defecto). Si una regla corta falta, el registro queda «no legible bajo esta época» (`pendiente`), sin estar mal formado.
- **PV5 inspecciona, no garantiza.** Lo que ninguna capa comprueba está en la columna «no comprueba» de la tabla del §3.

## 2. Uso

```js
import { validez, CAPAS, ESTADOS_CAPA, ESTADO_MOTOR, estadoDeBql } from './src/validez.js';

const v = await validez(eje, evento, { epoca }); // evento: un id del eje o un evento (esté o no en el eje)
v.capas;          // [5 partes], en el orden del corpus
v.forma; v.interpretacion; v.criptografia; v.acreditacion; v.permiso; // las mismas partes, por nombre
v.resumen;        // cinco líneas
// cada parte: { capa, clave, nombre, estado: 'ok' | 'pendiente' | 'falla', motivos: [], resumen, …detalle }
```

`evento` puede ser un registro que no está en el eje: un borrador, uno recibido o uno manipulado. Se lee contra el eje sin añadirlo. Un id que no está en el eje lanza `registro desconocido`. Un evento malformado no hace fallar la llamada: la capa que no se puede comprobar queda en `falla` con el motivo «no se pudo comprobar».

La compra del ejemplo (`ejemplos/ikisai/compra-food.mjs`, sin claves):

```text
1 forma y época: ok · forma válida · legible bajo época 0 (profundidad 2)
2 interpretación: ok · sin fórmulas: literales y referencias
3 criptografía y procedencia: ok · id correcto · sin firma (huesped no tiene clave) · foco en el eje · 2 de 2 referencias resuelven
4 acreditación material: ok · 2 movimientos respaldados por series de su emisor, ningún saldo negativo · externa: sin acreditar
5 permiso y ejecución: ok · mueve lo suyo · no es consolidación, autorización ni ejecución
```

Detalle de cada parte:

| Capa | Campos |
|---|---|
| 1 | `errores` (los de `validarForma`), `epoca`, `profundidad`, `lectura.en` (la dirección `en` leída bajo la época) |
| 2 | `formulas: [{ camino, dir, formula, estado (BQL), texto, capa }]` |
| 3 | `idCorrecto`, `firma` (`verificada`, `sin firma`, `ausente`, `inválida`, `de otro`, `sin verificar`), `firmante`, `clavesDeclaradas: [{ identidad, por, posesion: 'sin probar' }]`, `referencias: [{ desde, camino?, ref, dir?, estado, procedencia? }]`, `enEje` |
| 4 | `movimientos: [{ i, clave, de, a, cantidad, estado, motivo? }]`, `externa` (constante `SIN_ACREDITAR`) |
| 5 | `libro: { estado, motivos }`, `motor` (null fuera de la fábrica), `regla`, `externa` (constante `SIN_CONFIRMAR`) |

`motor` de una consolidación: `{ fase, estadoMotor, puedenAutorizar, autorizaciones, noCuentan, ejecuciones }`. De una autorización o una ejecución: `{ fase, consolidacion, estadoConsolidacion, cuenta }`.

## 3. Qué comprueba cada capa y qué no

| Capa | Qué comprueba (código) | Qué **no** comprueba | De quién es lo que falta |
|---|---|---|---|
| **1 · forma y época** | `validarForma`: autor, `sobre`, `en` de diez dígitos, `t` ISO, movimientos bien formados, el autor mueve T, payload terminal o array de 1 a 10 posiciones sin huecos. Además, que ningún nodo pase de diez profundidades y que cada dígito del payload y de `en` tenga regla corta bajo la época elegida | Que el contenido signifique lo que dice (PV0 puede ser engañoso); las reglas largas, que no existen; que la época elegida sea la legítima | Reglas cortas y largas (V5); legitimidad del tronco: VG |
| **2 · interpretación** | Cada fórmula BQL del payload, evaluada con `bql.evaluar` en su celda: `RESUELTO` → ok; `PENDIENTE…` → pendiente; `INCOMPATIBLE`, `ERROR` → falla | Los literales, que se leen tal cual sin que eso los haga ciertos; los permisos de lectura (`04_AGRAM` l.14); las fórmulas de los registros que cuelgan de este; las referencias BTML, que van en la capa 3 | Permisos de lectura: [X] abierto (PR #36 propone un gancho) |
| **3 · criptografía y procedencia** | `id` = hash del cuerpo canónico; firma ECDSA del autor si tiene clave en el libro de su momento; firma sin clave contra la que verificar → pendiente; con `exigirFirmas` y sin clave → falla; foco (`sobre`) y autor en el eje; claves declaradas solo para identidades nuevas que reciben tokens; referencias del payload seguidas con `encaje.seguir` (ausente → pendiente; posición sin desarrollar → pendiente; cadena sin fin → falla); `contexto.fuentes` y `contexto.evidencia` presentes | Que quien declara una clave la posea (sin prueba de posesión); quién hay detrás de una clave; cómo firma un grupo; anclaje (raíz Merkle, Bitcoin) y transporte (Nostr); **que lo firmado sea verdad** | AARPIA (identidades, firmas de grupo); StateArk/Bitcoin (anclaje) |
| **4 · acreditación material** | El respaldo en el libro, desde los datos del eje: cada token que se mueve es de una serie emitida (`emitido > 0`) por su emisor; cada emisión la hace el emisor de su serie; P respaldado por el poder de los ámbitos que cubren el suyo, y ese ámbito existe; ningún saldo queda negativo; lo emitido sigue siendo finito | **Que lo afirmado ocurrió en el mundo**: que cocina sirvió el menú, que la plaza existe, que los euros de la casa tienen algo detrás fuera del eje. Ninguna evidencia ni garantía externa | Fuera de AGRAM (V2: «evidencia y garantías externas apropiadas»); StateArk/Bitcoin para el valor |
| **5 · permiso y ejecución** | En el libro: nadie mueve tokens ajenos; T y P solo los emite el génesis; E y R solo las emite una persona o un grupo; tipos declarados en el alta y solo para identidades nuevas; el génesis emite a su autor. En la fábrica: `motor.estadoDe`, quién puede autorizar (`puedeAutorizar` con la regla V0), autorizaciones que no cuentan, y que una ejecución la escriba el autor de la consolidación con una autorización válida en su `evidencia` | **Efectos externos confirmados** (que el pago salió, que el servicio se prestó); el resultado (éxito, rechazo, no ocurrido, parcial, sin confirmación: `04_AGRAM` l.34); la autoridad real, porque la regla V0 es un hueco provisional (MAPA §12 [D]) | AARPIA: «el motor real de autorización/ejecución» (MAPA §12 [D]) |

Las dos constantes que dejan esto dicho en cada lectura:

- `SIN_ACREDITAR` (capa 4): «sin acreditar: que ocurrió en el mundo no lo prueba el eje (fuera de AGRAM)».
- `SIN_CONFIRMAR` (capa 5): «sin confirmar: los efectos fuera del eje son de AARPIA».

## 4. Estados

| Estado | Significa |
|---|---|
| `ok` | la capa comprueba lo suyo y no encuentra nada |
| `pendiente` | falta algo que puede llegar o que otro tiene que hacer: una referencia o un foco ausente, una posición sin desarrollar, una fórmula `PENDIENTE`, una consolidación sin autorizar o sin ejecutar, una regla corta que la época no tiene |
| `falla` | lo que hay contradice lo que la capa exige: forma rota, fórmula imposible, id que no corresponde, firma ausente o inválida, tokens sin respaldo o saldo negativo, tokens ajenos, una autorización o una ejecución que no cuenta |

Dentro de una capa se queda el peor de sus motivos: `falla` antes que `pendiente`, y `pendiente` antes que `ok`.

BQL → capa 2 (`estadoDeBql`): `RESUELTO` → `ok`; todo lo que empieza por `PENDIENTE` (también `PENDIENTE POR LÍMITE` o `PENDIENTE DE AUTORIZACIÓN`, si llegan) → `pendiente`; `INCOMPATIBLE`, `ERROR` y cualquier otro → `falla`.

Motor → capa 5 (`ESTADO_MOTOR`):

| `estadoDe` | Capa 5 | Motivo |
|---|---|---|
| `PENDIENTE DE AUTORIZACIÓN` | `pendiente` | quién puede autorizar hoy, o «nadie puede autorizar hoy» (`docs/MOTOR.md` §13.15); y cada «autorizado» escrito por quien no puede |
| `AUTORIZADO` | `pendiente` | por quién, y que falta ejecutar: consolidar no es ejecutar |
| `EJECUTADO` | `ok` | efectos externos sin confirmar; si ninguna ejecución lleva una autorización válida en su evidencia, `falla` (§6) |
| otro | `pendiente` | «estado del motor sin traducir a esta capa» |

## 5. El libro del momento

Cada registro se lee en su lugar del eje. Si el evento está en el eje (un evento con su id), el libro (saldos, series, claves y tipos) se rehace con los eventos anteriores a él, así que las capas 3, 4 y 5 dicen lo que valía cuando entró. Si no está, se lee con el libro de ahora. El libro se rehace leyendo `eje.orden`, sin tocar el eje; el poder P se descuenta igual que en el eje, del ámbito más concreto al más amplio (`eje.ambitosQueCubren`).

La excepción es quién puede autorizar. Se calcula con el poder de ahora, igual que hace el motor (`puedeAutorizar`, `autorizacionesValidas`, `estadoDe`): si la casa delega todo su P después de autorizar, su autorización deja de contar. Es la regla V0 tal como está (ver [X] 8 en el §8).

## 6. Lo que el eje rechaza, por capa

`eje.validar` devuelve una lista plana de mensajes que mezcla capas (`docs/BTML.md` §7.4). Este es el reparto que hace `validez`, sin tocar el eje:

| Rechazo del eje | Capa |
|---|---|
| `evento mal formado: …` (`validarForma`) | 1 |
| `id no corresponde al cuerpo` | 3 |
| `ya hay génesis`, `solo el génesis carece de foco` | 3 |
| `foco desconocido` | 3 (pendiente) |
| `autor desconocido` | 3 (pendiente) |
| `firma ausente`, `el firmante debe ser el autor`, `firma inválida`, `autor sin clave` | 3 |
| `no se puede cambiar la clave`, `clave declarada … sin darle tokens`, `clave inválida` | 3 |
| `no se puede cambiar el tipo`, `tipo declarado … sin darle tokens`, `tipo inválido` | 5 |
| `solo el génesis emite T/P`, `solo personas y grupos emiten` | 5 |
| `nadie mueve tokens ajenos` | 5 |
| `nadie emite en nombre de otro` | 4 |
| `la serie … no admite tanto` | 4 |
| `ámbito desconocido`, `saldo insuficiente de P` | 4 |
| `saldo insuficiente de …` | 4 |
| `evento ya registrado` | ninguna: si el id ya está, el registro se lee en su lugar |

Las capas también señalan cosas que el eje admite:

- una referencia del payload a un evento ausente (capa 3, pendiente);
- una fórmula pendiente o imposible (capa 2);
- un nodo a más de diez profundidades (capa 1, falla: sin dirección posible, MAPA §2.1 [A]);
- un «autorizado» escrito por quien no puede, o un «ejecutado» sin autorización (capa 5, falla en ese registro);
- una firma sin clave contra la que verificar (capa 3, pendiente).

## 7. Casos (`test/validez.test.js`)

Estados en el orden 1–5:

| Caso | Estados | Lo que muestra |
|---|---|---|
| La compra, la cuenta, las altas, el menú y el génesis del ejemplo | ok ok ok ok ok | las fórmulas de la cuenta, resueltas («14 EUR (12 EUR + 2 EUR)») |
| Nota con `{ ref: <id ausente> }` y otra a una posición sin desarrollar | ok ok **pendiente** ok ok | lo ausente no es falso |
| Borrador cuyo foco no está en el eje | ok ok **pendiente** ok ok | idem |
| Firma quitada tras restaurar (con claves) | ok ok **falla** ok ok | las otras cuatro son las mismas que con la firma; `restaurar` del guardado sin firma se rechaza |
| Pago firmado de 100 EUR que el autor no tiene | ok ok ok **falla** ok | una firma no es veracidad |
| Cocina paga con `E:cocina/EUR`, que nunca emitió | ok ok ok **falla** ok | sin serie no hay respaldo; moverlos sí es cosa suya |
| Huesped emite `E:casa/EUR` | ok ok ok **falla** ok | la serie no la respalda su emisor |
| Huesped mueve euros de la casa | ok ok ok ok **falla** | hay respaldo, no hay permiso |
| Cocina emite minutos de T | ok ok ok **falla** **falla** | un hecho, dos capas, dos razones |
| Cocina delega más P del que tiene | ok ok ok **falla** ok | P respaldado por sus ámbitos |
| `=LOCAL(5) + 2 EUR` sin posición 5 | ok **pendiente** ok ok ok | fórmula pendiente |
| `=REF("ffffffff", …)` y `="propina" + 2 EUR` | ok **falla** ok ok ok | una fórmula no es una referencia BTML: la capa 3 sigue en ok |
| Consolidación sin autorizar | ok ok ok ok **pendiente** | pueden autorizar: casa (regla V0) |
| «Autorizado» escrito a mano por cocina | ok ok ok ok **falla** | el escrito existe y no cuenta; la consolidación sigue pendiente y lo lista en `noCuentan` |
| Autorizada por la casa | ok ok ok ok **pendiente** | AUTORIZADO por casa · falta ejecutar |
| Ejecutada por el autor | ok ok ok ok ok | EJECUTADO · externa: sin confirmar |
| «Ejecutado» a mano sin autorización | ok ok ok ok **falla** | el motor da EJECUTADO; la capa 5 no (`docs/MOTOR.md` §13.2) |
| La compra con otro payload y el mismo id | ok ok **falla** ok ok | el id no corresponde al cuerpo: el registro no es el que dice ser |
| La compra bajo una época sin reglas en profundidad 1 | **pendiente** ok ok ok ok | la época está fuera del dato: bajo la época 0, ok |
| Payload de once profundidades (el eje lo admite) | **falla** ok ok ok ok | sin dirección posible |

La consolidación del ciclo, paso a paso (salida real):

```text
5 permiso y ejecución: pendiente · mueve lo suyo · PENDIENTE DE AUTORIZACIÓN · pueden autorizar: casa
5 permiso y ejecución: falla · mueve lo suyo · autorizado que no cuenta · consolidación PENDIENTE DE AUTORIZACIÓN   ← el «autorizado» de cocina
5 permiso y ejecución: pendiente · mueve lo suyo · AUTORIZADO por casa · falta ejecutar
5 permiso y ejecución: ok · mueve lo suyo · EJECUTADO · externa: sin confirmar
```

## 8. Abierto: [X] decidir VG

Lo que el mapa no decide y aquí no se inventa. El código toma la opción indicada como provisional y la deja en un solo sitio para poder cambiarla.

1. **Vocabulario.** `ok`/`pendiente`/`falla` es el vocabulario de trabajo del encargo. La nota (opción D) lista cuatro candidatos del corpus y ninguno está ratificado. Cambiarlo toca `ESTADOS_CAPA`, `ESTADO_MOTOR` y `estadoDeBql`.
2. **Grano.** Hoy es el registro. La nota (opción E) propone bajar las capas 2 y 3 a posición u ocupante. Las fórmulas y las referencias ya salen una a una en el detalle.
3. **Capa 4 en `ok` cuando el libro respalda.** El encargo pide el respaldo en el libro; el corpus pide evidencia externa. Hoy la capa queda en `ok` y dice «externa: sin acreditar». La alternativa (opción F1 de la nota) es dejarla en `pendiente` mientras no haya nada externo.
4. **Autor sin clave.** Hoy la capa 3 queda en `ok` con «sin firma» (opción G1). Las alternativas: exigir firmas (G2) o exigir prueba de posesión de la clave al dar de alta (G3).
5. **`EJECUTADO` en `ok`.** Hoy significa que la transición de tokens entró en el eje, no que ocurrió fuera. Falta saber quién declara el resultado (opción H de la nota) y si esa declaración pertenece a la capa 4 o a la 5.
6. **Más de diez profundidades = falla.** Es una lectura del [A] del MAPA §2.1 («al agotar diez niveles se cambia de foco»). El eje lo admite hoy.
7. **`INCOMPATIBLE` → falla.** Podría ser `pendiente` si se entiende que falta una conversión. Hoy no hay conversiones y BQL lo trata como fallo de tipos.
8. **Quién pudo autorizar.** Hoy se calcula con el P de ahora, como el motor. Leerlo con el P del momento de la autorización cambiaría también `motor.estadoDe`.
9. **La capa 5 exige autorización en la evidencia de una ejecución y `estadoDe` no** (`docs/MOTOR.md` §13.2). Falta decidir si se arregla en el motor (`src/motor.js` lo tocan las PR #21, #40 y #42).
10. **Exponer las capas.** Hay dos piezas pendientes, fuera de esta PR para no chocar con otras: exportar `validez` en `src/index.js` (la PR #44 lo toca) y pintarlo en PV5 (opción C de la nota, `app.js`).
