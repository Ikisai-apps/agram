# Prueba del extranjero

Nota de resultados · 7-11-2026 · Base: `main` en `8d73b44` (PR #30), Node 24.14.1. La prueba la propuso el mapa (§12, «Idea de fondo»): **un agente sin corpus, solo con las reglas y la gramática, escribe registros y fórmulas correctas.** Aquí el «extranjero» solo leyó `docs/BTML.md`, `docs/BQL.md` y `docs/MOTOR.md`; ni `src/`, ni `test/`, ni el mapa, ni el corpus. Después un conocedor del proyecto (que sí leyó `src/` y el mapa) calificó cada intento. Lo que es interpretación del calificador va marcado «lectura del calificador»; lo que falta por decidir, «[X] decidir VG».

Rutas abreviadas: `MAPA` = `MUELA/equipo/agram/MAPA_GLOBAL_AGRAM.md` (fuera del repositorio). Los cuatro scripts del extranjero vivían fuera del repositorio (`extranjero-<tarea>.mjs`, importando el repositorio por URL `file:///` absoluta); su código, su salida y sus dudas completas están en el anexo. Se volvieron a ejecutar sobre `8d73b44` para esta nota: la salida es idéntica a la que entregaron.

## 1. Resultado en una tabla

| Tarea | ¿Corre a la primera? | ¿Resultado correcto? | ¿Razonamiento correcto? | Calificación |
|---|---|---|---|---|
| 1. Reserva de alojamiento con fórmulas de total y composición con tiempo, en un eje propio | sí | sí (160 EUR; 160 EUR + 48 h; pago de 160 EUR tomado de la fórmula) | sí; modelo distinto del decidido por VG, que no estaba en los documentos | **correcto, con reparos de modelo** |
| 2. Cinco consultas BQL sobre `ejemploCompra` | sí | sí (2 · 0 / 8 EUR · propio [4] · 12 EUR + 20 min · PENDIENTE) | no en la consulta 3: creía que los escritos tienen acuerdo 0 (lo decía `docs/BQL.md`) | **correcto, con un error de razonamiento inducido por el documento** |
| 3. Ocupantes de `1000000000` de la compra y cómo cambia al escribir en 2 | sí | sí (4 ocupantes; la 1 no cambia; la 2 pasa de 3 a 4 y a 5) | sí | **correcto** (el más completo) |
| 4. Ciclo completo del motor con un pago de 14 EUR | sí | sí (EJECUTADO; cocina 12 → 26 EUR; huésped 48 → 34) | sí; el importe se tecleó en vez de salir de la fórmula de la cuenta | **correcto, con un reparo** |

Ningún intento tuvo un error de código. Los cuatro escribieron registros válidos, fórmulas que el motor evalúa y un ciclo completo a partir de tres documentos. Lo que falló fueron **los documentos**: tres de los cuatro extranjeros descubrieron por su cuenta, ejecutando los ejemplos, que BTML, BQL y MOTOR describían un encaje anterior al código (escritos «desde la raíz», vector `destino − origen`, «ordena la distancia») y unos ids anteriores a la PR #18; el cuarto (fórmulas) razonó con la regla vieja. Esta misma PR corrige los documentos (§6).

## 2. Tarea 1: la reserva

**Enunciado.** Una reserva de alojamiento con fórmulas de total y composición con tiempo, en un eje propio.

**Qué hizo.** Génesis propio (la casa recibe 200 h de T, 1000 EUR y 5 P con ámbito `genesis`); alta de la persona huésped; una «disponibilidad» de la casa con `['Habitaciones', ['doble', '80 EUR'], ['individual', '50 EUR']]` en la posición 1; la reserva, escrita por la persona huésped `sobre` la disponibilidad `en: '1000000000'`, con la décupla de recursos `[ref a la doble, 2, ref al precio, '=LOCAL(1) * LOCAL(2)', '=LOCAL(3) + LOCAL(1) * 24 h']`, criterios, comunicación, acción, 5 = ref a la disponibilidad, 6 = ref al alta, 7 = fecha de llegada; una proyección (la llegada, con `t` futuro); el eje temporal; el ciclo en la fábrica de la disponibilidad (la persona huésped consolida, la casa autoriza, la persona huésped paga `total.valor.cantidad` en `total.valor.unidad`); guardar y restaurar.

**Salida clave.** `[1,3] total = noches × precio → 160 EUR`; `[1,4] → 160 EUR + 48 h`; `EUR casa 700 → 860 · huesped 300 → 140`; restaurado con `EJECUTADO` y las mismas fórmulas.

**Calificación del conocedor.**

- Correcto en todo lo que el código comprueba. Bien resuelto: pagar con el valor que da la fórmula en vez de teclearlo; referencias en vez de copias para la habitación y el precio; comprobar los ejemplos de los propios documentos antes de fiarse de ellos.
- **Reparo de modelo (no es culpa suya).** VG decidió el 7-11 (MAPA §12, «Anclaje de la reserva») que la reserva se ancla **en la plaza**, dentro de los recursos de la disponibilidad (`en: '1100000000'` para la doble), con las noches en el **7 de la propia reserva**, y que las reservas de la misma plaza colisionan ahí. El extranjero ancló en `1000000000` (todas las habitaciones a la vez) y puso las noches en 1.1. Los documentos no lo decían; ahora sí (`docs/BTML.md` §5). Abajo, la versión con el anclaje decidido.
- **Total en 1.3 y tiempo en 1.4.** La época 0 vale en todas las profundidades (MAPA §10.4), así que `1300000000` se lee «recursos › comunicación» y `1400000000` «recursos › fábrica»; el propio extranjero lo vio con `leerDireccion` y lo preguntó. Siguió la plantilla «qué, cuánto, a qué precio» del ejemplo de la compra (lo dice en sus dudas: «1.0 qué, 1.1 cuánto, 1.2 precio, 1.3 ?, 1.4 ?»), que es léxico humano (§5.2). Dónde vive un total calculado: [X] decidir VG.
- **Posiciones 5 y 6 rellenadas para poder usar la 7.** Válido (un array no admite huecos), pero sin convención: `desdeMapped` y `consolidar` heredan del foco por referencia (`{ ref: foco, dir }`) y el extranjero puso otra cosa (la disponibilidad entera y el alta). Con las noches en el 7 (decisión de VG) esto pasará en toda reserva: [X] decidir VG qué va en 5 y 6.
- Cobró 16 minutos de T (uno por posición) escribiendo con `eje.escribir`; no hacía falta (el eje solo exige mover algo de T). Ahora lo dice `docs/BTML.md` §2.3.

La reserva con el anclaje decidido por VG (ejecutable desde la raíz con `node --input-type=module < archivo.mjs`; la fórmula del total en la 4 y lo que va en 5 y 6 son elección del calificador, [X]):

```js
import { Eje, encaje, bql } from './src/index.js';
const t = '2026-11-07T10:00:00Z';
const gasta = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });
const eje = await Eje.genesis({ identidad: 'casa', emision: [{ token: 'T', escala: 'hora', cantidad: 100 }, { token: 'E', denominacion: 'EUR', cantidad: 1000 }, { token: 'P', cantidad: 5, ambito: 'genesis' }], foco: 'Casa', t });
const alta = await eje.escribir({ autor: 'casa', sobre: eje.genesisId, t, movimientos: [gasta('casa'), { token: 'T', escala: 'hora', cantidad: 10, de: 'casa', a: 'ana' }, { token: 'T', escala: 'hora', cantidad: 10, de: 'casa', a: 'bea' }], payload: ['Altas', ['ana', 'bea']] });
const disp = await eje.escribir({ autor: 'casa', sobre: alta.id, t, movimientos: [gasta('casa')], payload: ['Disponibilidad 14-16 nov', ['Habitaciones', ['doble', '80 EUR'], ['individual', '50 EUR']]] });
const reserva = (quien, noches) => eje.escribir({
  autor: quien, sobre: disp.id, en: '1100000000', t, movimientos: [gasta(quien)],
  payload: ['Reserva de ' + quien, [{ ref: disp.id, dir: '1110000000' }], 'sin mascotas', [quien, 'casa'], '=LOCAL(1, 0) * LOCAL(7) + LOCAL(7) * 24 h', { ref: disp.id }, { ref: alta.id }, noches],
});
const ra = await reserva('ana', 2);
const rb = await reserva('bea', 3);
console.log('plaza 1.1:', encaje.ocupantes(eje, disp.id, [1, 1]).map((o) => o.origen + (o.autor ? ' ' + o.autor : ' ' + JSON.stringify(o.camino))).join(' · '));
console.log('reservas en la plaza:', bql.consultar(eje, disp.id, [1, 9], 'CONTAR(FILTRAR(BUSCAR(1), ORIGEN() = "escrito"))').texto);
console.log('total ana:', bql.evaluar(eje, ra.id, [4]).texto, '· total bea:', bql.evaluar(eje, rb.id, [4]).texto);
```

```text
plaza 1.1: propio [1,1] · propio [1,1,0] · escrito ana · escrito bea
reservas en la plaza: 2
total ana: 160 EUR + 48 h · total bea: 240 EUR + 72 h
```

Las dos reservas colisionan en la plaza y se cuentan desde la disponibilidad con una fórmula de profundidad 1 (anfitrión `[1]`, `BUSCAR(1)` = la plaza 1.1). La capacidad como serie limitada de tokens E (MAPA §12, «Capacidad y tokens casan») necesita la emisión de series, que no está en `main` (PR #35 abierta).

## 3. Tarea 2: cinco consultas BQL

**Enunciado.** Sobre `ejemploCompra`: contar candidatos de la posición 4, sumar solo escritos, elegir el de mayor acuerdo, componer precio con 20 min, una PENDIENTE a propósito.

| Consulta | Fórmula del extranjero (slot `4000000000` de la compra) | Eje de ejemplo tal cual | Con tres propinas escritas en la 4 |
|---|---|---|---|
| 1 | `CONTAR(BUSCAR(4))` | `2` | `5` |
| 2 | `SUMAR(FILTRAR(BUSCAR(4), ORIGEN() = "escrito"))` | `0` | `8 EUR (2 EUR + 5 EUR + 1 EUR)` |
| 3 | `ELEGIR(ORDENAR(BUSCAR(4), ACUERDO(), "desc"))` | `1 candidato: propio ec0734c3` | `1 candidato: propio ec0734c3` |
| 4 | `LOCAL(1, 2) + 20 min` | `12 EUR + 20 min` | igual |
| 5 | `LOCAL(7)` | `PENDIENTE: posición sin desarrollar` | igual |

**Calificación del conocedor.**

- Las cinco fórmulas son correctas y dan lo que el código da. Bien visto: que `2` cuenta la colisión `[4]`/`[4, 0]`; que la suma vacía es `0`; que `'EUR 12'` vale en un slot pero no en una fórmula; que `"desc"` podía significar dos cosas y lo comprobó ejecutando.
- **Error de razonamiento (inducido por `docs/BQL.md` §7.4).** Explicó la consulta 3 así: «los dos propios tienen acuerdo 10 y empatan; los escritos tienen acuerdo 0». Es falso desde la PR #28: un escrito anclado en la dirección buscada es encaje **exacto** (acuerdo 10). En el escenario con propinas los **cinco** candidatos tienen acuerdo 10, `ORDENAR(…, ACUERDO(), "desc")` no mueve nada y sale el primer propio por llegada. El resultado es el mismo por casualidad. Y su conclusión «`ACUERDO()` solo discrimina entre referencias y escritos» también: hoy solo separa las **referencias que alcanzan otra dirección** del resto.
- «El candidato con mayor acuerdo» es una pregunta casi vacía en la época 0 (§5.1, punto 2).
- La suma vacía da el numero `0` **sin unidad**: si después se le suma una magnitud (`… + 1 EUR`) la consulta es INCOMPATIBLE. El extranjero no cayó, pero es una trampa del lenguaje (§5.3).

## 4. Tareas 3 y 4

### 4.1 Tarea 3: la dirección `1000000000` de la compra

**Qué hizo.** Mostró que `direccion([1]) === direccion([1, 0])` y que por eso colisionan cuatro ocupantes: el array `[1]`, su posición 0 `[1, 0]` (la referencia al menú:1), lo que esa referencia alcanza (`["ensalada","guiso","fruta"]`) y la cuenta escrita por cocina con `en: '1000000000'`; recalculó a mano vector, distancia, acuerdo y signo; comparó orden de llegada y de encaje; escribió dos registros con `en: '2000000000'` y mostró que la 1 no cambia (4 ocupantes) y la 2 pasa de 3 a 4 y a 5; recorrió `arbol` y `colisiones` antes y después; contrastó con los ejemplos de los documentos.

**Calificación del conocedor.** Correcto en todo. Los cuatro ocupantes son exactos (vector cero) y por eso el orden de encaje coincide con el de llegada; lo dijo y lo explicó. Interpretó «escribir en 2» como anclar en `2000000000`; el enunciado también admitía `1200000000` (la 1.2), pero su lectura enseña lo importante: el anclaje es exacto y una escritura en la 2 no toca la 1. Sus dudas eran todas fundadas y quedan resueltas en los documentos: si la colisión `[1]`/`[1, 0]` es querida (sí: «colisiones, no apaños», MAPA §12); qué significa `camino` según el origen; que `rota` no existe cuando no hay rotura; que `ocupantes` recibe índices, no una dirección; que `arbol` no entra en los escritos; que un escrito puede anclarse en una posición que el foco no desarrolla.

### 4.2 Tarea 4: el ciclo con un pago de 14 EUR

**Qué hizo.** `descubrir` sobre la compra; `consolidar` (la persona huésped elige la cuenta como candidato en 1 y teclea `'pagar 14 EUR a cocina'` en 4); `autorizar` (la casa, con P sobre `genesis`); `ejecutar` (la persona huésped mueve 14 EUR a cocina); estado, evidencia, hilo y lista de consolidaciones. Provocó a propósito doce rechazos (sin elecciones, posición 0, hueco, ejecutar sin autorizar, autor que se autoriza, cocina sin P, autorizar algo que no es consolidación, dos autorizaciones, ejecutar otro autor, tokens ajenos, saldo insuficiente, dos ejecuciones) y explicó cada uno.

**Calificación del conocedor.** Correcto, y el más riguroso con los rechazos. Reparo: el importe está **tecleado** dos veces (en la acción y en el movimiento) cuando la cuenta ya lo calcula (`=REF("ec0734c3", "1200000000") + 2 EUR` → `14 EUR`). El motor no compara el texto consolidado con lo que se ejecuta (ahora `docs/MOTOR.md` §13.18). La pieza que lo habría llevado a derivarlo, `proponer` (operador B, PR #26), no estaba en `docs/MOTOR.md` porque el documento se escribió sobre una base anterior; ahora está en §2.1, con el ciclo completo sobre la cuenta y el pago tomado de la fórmula. Sus dudas, fundadas: `contexto.encaje[k].origen` de un escrito (`1000000000`) no coincide con el `dir` de la referencia guardada (`0000000000`) — son cosas distintas y ahora se dice (`docs/MOTOR.md` §3.2); el error de `ejecutar` sin autorizar es el nombre del estado a secas (§13.17); `evaluar` no sigue la referencia de la consolidación y `descubrir` sí muestra su texto.

## 5. Hallazgos sobre el lenguaje

### 5.1 Ambigüedades

1. **La colisión por ceros cuenta doble.** `CONTAR(BUSCAR(4))` es `2` en una compra sin escritos: el array `['pagar', 'servir']` y su posición 0 `'pagar'`. `descubrir` lista `[1]` y `[1, 0]` como dos candidatos que muestran lo mismo. Es lo decidido («colisiones, no apaños»), pero para quien pregunta «cuántos candidatos hay» sorprende. [X] decidir VG: si una vista (o un `CONTAR`) debe poder agrupar una posición con su posición 0.
2. **En la época 0 casi todo empata.** Propios y escritos son siempre exactos; solo una referencia que alcanza otra dirección tiene acuerdo menor que 10. Así `ACUERDO()`, `SIGNO()`, `FALTAS()` y `DESPLAZAMIENTO()` dan casi siempre 10 / exacto / 0 / 0, y el orden de una posición es, en la práctica, el de llegada. Es coherente con la opción B (MAPA §12), pero conviene que VG sepa que hoy esas funciones apenas discriminan con datos reales.
3. **`"desc"`.** El documento decía «invierte»; el código invierte el comparador con orden estable (los empates conservan el orden de entrada). El extranjero tuvo que ejecutar para saberlo. Corregido en `docs/BQL.md` §7.7.
4. **Alcance de una fórmula.** Solo ve su décupla anfitriona: desde `[1, 3]` no se puede leer `[7]` ni `[1]` del mismo registro, porque no hay `LOCAL` absoluto y `REF` al propio registro es imposible (su id es el hash del payload que contiene la fórmula). Esto decide dónde puede vivir un total. [X] decidir VG si hace falta una lectura absoluta dentro del propio registro (para `BUSCAR` ya está decidido: un texto de diez dígitos es dirección absoluta, MAPA §12; no implementado).
5. **Qué va en las posiciones intermedias** cuando se necesita una posterior (5 y 6 para usar la 7). [X] decidir VG.

### 5.2 Léxico humano que no está en los datos

1. **«qué, cuánto, a qué precio».** El comentario de `ejemplos/ikisai/compra-food.mjs` y `docs/BTML.md` §1.5 leían así la posición 1 de la compra. La regla corta dice otra cosa: 1.0 representación, 1.1 recursos, 1.2 criterios. El extranjero de la reserva lo copió como plantilla y su «total» acabó en «recursos › comunicación». El documento ya lo explica; el comentario del ejemplo es código y no se toca aquí. [X] decidir VG si el ejemplo debe reordenarse según la época 0.
2. **Las unidades son etiquetas.** `EUR`, `min`, `h` no están ligadas a nada: `48 h` en BQL no es T, y `EUR` coincide con la denominación del token E solo porque se escriben igual. Los extranjeros de la reserva y del ciclo tuvieron que pasar a mano `valor.cantidad` y `valor.unidad` al movimiento. [X] decidir VG si las unidades de BQL deben ligarse a las series de tokens (escalas de T, denominaciones de E).
3. **El texto de la acción no es la acción.** `'pagar'`, `'pagar 14 EUR a cocina'`, `'cobrar 160 EUR'` son texto en la posición 4; lo que pasa de verdad son los `movimientos` de `ejecutar`, y nada los une (se puede consolidar «pagar 14 EUR» y ejecutar otra cantidad). [X] decidir VG (probablemente es de AARPIA).
4. **Fechas.** Una fecha en la 7 es un texto ISO que `tiempo.js` no interpreta (lo lista como `declarado`, delta 0). Pendiente de PV7 real (timelocks, fechas en el payload).
5. **Lectura del calificador.** Cuando la regla de posiciones no le daba un sitio («dónde pongo el total»), el extranjero recurrió a nombres («total», «noches», «precio»). Es la frontera de la idea de fondo (MAPA §12: «posiciones en vez de nombres»): las posiciones bastan para leer, escribir y ejecutar, pero no aún para **colocar** un dato derivado.

### 5.3 API confusa

| Qué | Dónde confunde | Estado |
|---|---|---|
| `vector(origen, destino)` documentado como `destino − origen`; el código hace `candidato − buscado` | signo cambiado en todos los ejemplos | documentos corregidos |
| `ocupantes(eje, id, indices)` solo admite un array; con `'1000000000'` lanza `RangeError: entre 0 y 10 índices`; BQL admite las dos formas | quien venga de BQL | documentado (`docs/BTML.md` §6.1) |
| `camino` significa cosas distintas según el origen; para un escrito, `dir` (`0000000000`) y `origenDir` (su anclaje) no coinciden; en la consolidación, `encaje.origen` no es el `dir` de la referencia | lectura de candidatos y de consolidaciones | documentado (`docs/BTML.md` §6.2, `docs/MOTOR.md` §3.2) |
| `rota` no existe cuando no hay rotura (no es `false`) | comprobaciones `o.rota === false` | documentado |
| En `src/index.js`, `escritura` (función de `modos.js`) no es el módulo `src/escritura.js` (que se exporta como `salida`) | importar desde el índice | documentado (`docs/BTML.md` §0) |
| `evaluar` no sigue la referencia de un slot literal; `LOCAL`, `REF` y `ACTUAL` sí | `evaluar(consolidación, [1])` da `→ c7c163ae` y `descubrir` da «Cuenta del menú» | ya documentado (BQL §3, §12.7) |
| `SUMAR` de una colección vacía es `0` sin unidad: no se suma con una magnitud | totales sobre posiciones vacías | documentado (BQL §7.10, §12.12) |
| `'EUR 12'` vale en un slot; `=EUR 12` es `ERROR: identificador suelto` | copiar literales a fórmulas | documentado (BQL §3) |
| `proponer` guarda el texto de una magnitud con su desglose (`"14 EUR (12 EUR + 2 EUR)"`), que BQL relee como `texto` | el importe deja de ser operable en la consolidación | documentado (`docs/MOTOR.md` §13.16); [X] decidir VG si se corrige en código |
| `ejecutar` sin autorizar lanza `Error('PENDIENTE DE AUTORIZACIÓN')`, igual que el valor de `estadoDe` | distinguir error de estado | documentado (§13.17) |
| `eje.saldo(id, 'P')` da 0 sin avisar: la clave `'P'` no existe (P siempre lleva ámbito) | quien lea `docs/BTML.md` §2 antiguo | documentos corregidos |
| No hay función para el valor del candidato elegido de una colección cualquiera | «elige el mejor y dame su valor» | documentado como pendiente (BQL §11) |

## 6. Hallazgos sobre los documentos

**Causa.** `docs/BTML.md` (PR #23) y `docs/BQL.md` (PR #24) se escribieron sobre una base anterior a la PR #18 (ámbito de P, que cambió todos los ids); `docs/MOTOR.md` (PR #30) sobre una base anterior a la PR #26 (`proponer`); y las PR #28 y #29 cambiaron el encaje después de fusionar los tres. Nadie volvió a ejecutar los ejemplos. Al empezar esta prueba, de los 30 ejemplos ejecutables con salida escrita, **10 daban otra salida** (8 en BTML, 2 en MOTOR), más 2 líneas del ejemplo completo de BQL, 3 del de MOTOR, y filas y cifras de las tablas de BQL §7.4, §7.6, §7.7 y §7.11.

**Qué indujo a error, y cómo queda en esta PR.**

| Documento | Lo que decía | Lo que dice ahora |
|---|---|---|
| BTML §6.2, §6.3, §6.5; BQL §7.4, §7.6, §7.7, §7.11; MOTOR §2, §3.2, §3.3, §10; FUNDAMENTOS «El vector de encaje» | escrito: `origenDir = '0000000000'`, `[1, 0, …]`, `completar`, acuerdo 0; vector `destino − origen`, positivo = falta; «ordena la distancia» | escrito: anclado en la dirección buscada, exacto; vector `candidato − buscado`, positivo = sobra (reducir), negativo = falta (completar); ordenan el acuerdo de prefijo y la llegada; la distancia solo en profundidades que una época declare ordinales (ninguna en la época 0) |
| BTML, BQL (todas las salidas) | ids `1b133344`, `2a2a06e3`, `37c58bd2`, `25ddaa89`, `441d7a2b` | ids actuales (`2983477b`, `240c6005`, `579144c6`, `ec0734c3`, `c7c163ae`) y aviso de no copiarlos en código |
| BTML §2.1, §2.2, §7.1, §8, §9, §10 | P con clave `'P'` o `'P:<denominacion>'`; génesis con `{ token: 'P', cantidad: 10 }` | P con ámbito obligatorio (`'P:genesis'`, `'P:<id>'`), R con emisor; `eje.poderes`, `eje.poderSobre`, `eje.reputaciones`, `AMBITO_GENESIS` |
| BTML §1.5 | «1 recursos (qué, cuánto, a qué precio)» | la lectura de la época 0 en profundidad 1 y el aviso de que esa glosa es léxico humano |
| BTML §0 | `src/index.js` «(entre otros)» | la lista completa, el cruce `escritura`/`salida`, cómo importar desde fuera de la raíz y cómo ejecutar en PowerShell |
| BTML §5 | sin criterio para `en` | `en` puede ser cualquier dirección; orden de los escritos por entrada; el anclaje de la reserva decidido por VG |
| BTML §9 | — | qué hay en la posición 4 del ejemplo (solo los dos propios) |
| BQL §3, §5, §7.1, §7.10, §11, §12 | — | asimetría `'EUR 12'`; unidades como etiquetas; `desglose` siempre; `1 candidato`; alcance de una fórmula; `consultar` y ciclos; suma vacía; `BUSCAR` por dirección decidido y no implementado |
| MOTOR §0, §1, §2.1, §11, §13 | sin `proponer` | `proponer` y `OPERADORES` con un ejemplo que paga lo que calcula la fórmula; defectos 16–18 |

Tras las correcciones, los 31 ejemplos ejecutables con salida y los dos ejemplos completos dan exactamente la salida escrita (comprobado ejecutándolos todos desde la raíz).

**Propuesta del calificador (no aplicada).** Una prueba que ejecute los ejemplos de `docs/*.md` y compare con la salida escrita habría avisado en cada una de las PR #26–#29. Es una herramienta, no una regla del lenguaje; [X] decidir VG si se añade a `test/`.

**Solape con la PR #35 (abierta).** Reescribe `docs/BTML.md` §2 (series de tokens) y vuelve a cambiar los ids del ejemplo. Si entra antes, en los conflictos valen su §2 y sus ids, y de esta PR el resto (encaje, §5, §6, BQL, MOTOR); si entra después, lo mismo. En los dos casos hay que volver a ejecutar los ejemplos.

## 7. [X] decidir VG, en una lista

1. Dónde vive un total calculado de un registro (1.k, 2, 4…).
2. Qué va en las posiciones intermedias (5, 6) cuando un registro necesita la 7.
3. Si hace falta una lectura absoluta dentro del propio registro desde una subdécupla (como la dirección absoluta ya decidida para `BUSCAR`).
4. Si una vista o `CONTAR` debe poder agrupar una posición con su posición 0.
5. Si las unidades de BQL deben ligarse a las series de tokens.
6. Qué une el texto de la acción consolidada con los movimientos de la ejecución (¿AARPIA?).
7. Si `proponer` debe guardar una magnitud como magnitud (`'14 EUR'`) y no como su texto con desglose.
8. Si el ejemplo de la compra debe reordenar su posición 1 según la época 0 o conservar la glosa como comentario.
9. Si se añade a `test/` una prueba que ejecute los ejemplos de los documentos.

## Anexo: los cuatro intentos tal como se entregaron

Código, salida, dudas y lo que les faltó en los documentos, sin editar salvo las rutas locales (`file:///<repo>/` en lugar de la ruta del repositorio en la máquina). Los ids y los mensajes son los que dio `main` en `8d73b44`. Las secciones de los documentos que citan («BTML §6.5 decía…») son las de su versión anterior a esta PR.

### Tarea 1: reserva de alojamiento (eje propio)

<details>
<summary>Código</summary>

```js
// extranjero-reserva.mjs — reserva de alojamiento en una casa de eventos.
// Escrito solo con docs/BTML.md, docs/BQL.md y docs/MOTOR.md (sin leer src/ ni test/).
// Ejecutar:  node <temporal>\extranjero-reserva.mjs
import { Eje, contarPosiciones, leerDireccion, resolver, bql, motor, tiempo, encaje, persistencia }
  from 'file:///<repo>/src/index.js';

const { evaluar, consultar } = bql;
const { descubrir, consolidar, autorizar, ejecutar, estadoDe, puedeAutorizar, FABRICA } = motor;
const { ejeTemporal } = tiempo;
const { ocupantes } = encaje;

const corto = (x) => JSON.stringify(x).replace(/[0-9a-f]{64}/g, (m) => m.slice(0, 8));
const id8 = (id) => id.slice(0, 8);
const t = (dia, hora) => `2026-11-${dia}T${hora}:00Z`;
const gastaT = (de, cantidad = 1) => ({ token: 'T', escala: 'minuto', cantidad, de, a: null });
const muestra = (etiqueta, r) => console.log('  ' + etiqueta.padEnd(52), '→', r.estado.padEnd(12), r.texto);

// ---------------------------------------------------------------------------
// 1. Génesis propio: la casa recibe tiempo, euros y poder sobre todo el eje.
// ---------------------------------------------------------------------------
const eje = await Eje.genesis({
  identidad: 'casa',
  emision: [
    { token: 'T', escala: 'hora', cantidad: 200 },
    { token: 'E', denominacion: 'EUR', cantidad: 1000 },
    { token: 'P', cantidad: 5, ambito: 'genesis' },
  ],
  foco: 'Casa de eventos',
  t: t('07', '09:00'),
});
console.log('1. génesis', id8(eje.genesisId), '· identidades', JSON.stringify(eje.identidades()));

// ---------------------------------------------------------------------------
// 2. Alta de la persona huésped: existe al recibir tokens (T para escribir, EUR para pagar).
// ---------------------------------------------------------------------------
const alta = await eje.escribir({
  autor: 'casa', sobre: eje.genesisId, t: t('07', '09:05'),
  movimientos: [
    gastaT('casa', 2),
    { token: 'T', escala: 'hora', cantidad: 10, de: 'casa', a: 'huesped' },
    { token: 'E', denominacion: 'EUR', cantidad: 300, de: 'casa', a: 'huesped' },
  ],
  payload: ['Altas de noviembre', ['huesped']],
});
console.log('2. alta', id8(alta.id), '· identidades', JSON.stringify(eje.identidades()), '· huesped EUR', eje.saldo('huesped', 'E:EUR'), 'T(h)', eje.saldoT('huesped', 'hora'));

// ---------------------------------------------------------------------------
// 3. Disponibilidad de la casa: registro de la casa sobre el alta.
//    Posición 1 (recursos): 1.1 = ['doble', '80 EUR'], 1.2 = ['individual', '50 EUR'].
//    La habitación doble vive en 1100000000 y su precio por noche en 1110000000.
// ---------------------------------------------------------------------------
const payloadDisponibilidad = [
  'Disponibilidad del 14 al 16 de noviembre',                        // 0 representación
  ['Habitaciones', ['doble', '80 EUR'], ['individual', '50 EUR']],    // 1 recursos
  ['máximo 3 noches', 'llegada a partir de las 15:00'],              // 2 criterios
  ['casa'],                                                          // 3 comunicación
  ['reservar', 'cobrar al llegar'],                                  // 4 acción
];
const disponibilidad = await eje.escribir({
  autor: 'casa', sobre: alta.id, t: t('07', '10:00'),
  movimientos: [gastaT('casa', contarPosiciones(payloadDisponibilidad))],   // un minuto por posición
  payload: payloadDisponibilidad,
});
const D = disponibilidad.id;
console.log('3. disponibilidad', id8(D), '· posiciones', contarPosiciones(payloadDisponibilidad), '· 1100000000 =', corto(resolver(disponibilidad.payload, '1100000000')), '· 1110000000 =', corto(resolver(disponibilidad.payload, '1110000000')));

// ---------------------------------------------------------------------------
// 4. La reserva: registro de la persona huésped SOBRE la disponibilidad, anclado en su posición 1 (recursos).
//    Nada se copia: la habitación y el precio son referencias a la disponibilidad.
//    Dos fórmulas BQL dentro de la décupla de recursos (anfitrión [1]):
//      1.3  =LOCAL(1) * LOCAL(2)          → total = noches × precio
//      1.4  =LOCAL(3) + LOCAL(1) * 24 h   → el total compuesto con el tiempo de estancia
// ---------------------------------------------------------------------------
const payloadReserva = [
  'Reserva de habitación doble, 2 noches',          // 0 representación
  [                                                 // 1 recursos
    { ref: D, dir: '1100000000' },                  //   1.0 habitación: la entrada «doble» de la casa
    2,                                              //   1.1 noches
    { ref: D, dir: '1110000000' },                  //   1.2 precio por noche: el de la casa (80 EUR)
    '=LOCAL(1) * LOCAL(2)',                         //   1.3 total
    '=LOCAL(3) + LOCAL(1) * 24 h',                  //   1.4 total + tiempo de estancia
  ],
  ['desayuno incluido', 'cama doble', 'sin mascotas'],   // 2 criterios
  ['huesped', 'casa'],                              // 3 comunicación
  ['reservar', 'pagar al llegar'],                  // 4 acción
  { ref: D },                                       // 5 estructura: el registro en foco
  { ref: alta.id },                                 // 6 pasado: el alta de la persona huésped
  '2026-11-14T15:00:00Z',                           // 7 futuro: fecha de llegada
];
const reserva = await eje.escribir({
  autor: 'huesped', sobre: D, en: '1000000000', t: t('07', '12:00'),
  movimientos: [gastaT('huesped', contarPosiciones(payloadReserva))],
  payload: payloadReserva,
});
console.log('4. reserva', id8(reserva.id), '· sobre', id8(reserva.sobre), '· en', reserva.en, '· posiciones', contarPosiciones(payloadReserva), '· minutos de T movidos', reserva.movimientos[0].cantidad);
console.log('   payload', corto(reserva.payload));
console.log('   hilo', eje.hilo(reserva.id).map((e) => e.autor + '@' + id8(e.id)).join(' > '));
console.log('   época 0 de 1300000000 (donde vive el total):', leerDireccion('1300000000').map((x) => x.profundidad + ':' + x.digito + '=' + x.significado).join(' '));

// Una proyección: la llegada, escrita sobre la reserva en su posición 7 con t en el futuro.
const llegada = await eje.escribir({
  autor: 'huesped', sobre: reserva.id, en: '7000000000', t: '2026-11-14T15:00:00Z',
  movimientos: [gastaT('huesped')],
  payload: 'llegada prevista a las 15:00',
});

// ---------------------------------------------------------------------------
// 5. BQL: evaluar los slots tal como están y consultar desde la raíz.
// ---------------------------------------------------------------------------
console.log('5. evaluar(eje, reserva, dir)');
muestra('[1,0] habitación (referencia, no se sigue)', evaluar(eje, reserva.id, [1, 0]));
muestra('[1,1] noches', evaluar(eje, reserva.id, [1, 1]));
muestra('[1,2] precio (referencia, no se sigue)', evaluar(eje, reserva.id, [1, 2]));
const total = evaluar(eje, reserva.id, [1, 3]);
muestra('[1,3] total = noches × precio', total);
const conTiempo = evaluar(eje, reserva.id, [1, 4]);
muestra('[1,4] total + tiempo de estancia', conTiempo);
muestra('[7]   fecha futura', evaluar(eje, reserva.id, [7]));
muestra('[8]   sin desarrollar', evaluar(eje, reserva.id, [8]));
console.log('   dependencias de [1,3]:', JSON.stringify(total.dependencias.map((d) => id8(d) + ':' + d.slice(65))));
console.log('   dependencias de [1,4]:', JSON.stringify(conTiempo.dependencias.map((d) => id8(d) + ':' + d.slice(65))));
console.log('   valor crudo de [1,3]:', JSON.stringify(total.valor));

console.log('   consultar desde la raíz de la reserva (anfitrión [])');
const c = (f) => muestra(f, consultar(eje, reserva.id, [9], f));
c('LOCAL(1, 0)');                                            // sigue la referencia → la entrada «doble»
c('LOCAL(1, 2)');                                            // sigue la referencia → 80 EUR
c('LOCAL(1, 3)');                                            // la fórmula del total
c('REF("' + id8(D) + '", "1110000000") * LOCAL(1, 1)');       // el mismo total, leyendo el precio de la casa por REF
c('LOCAL(1, 3) <= 200 EUR');                                 // un criterio sobre el total
c('LOCAL(1, 4)');
c('LOCAL(1, 3) + 15 min');
c('CONTAR(BUSCAR(1))');

console.log('   desde la disponibilidad: qué ocupa su posición 1 (recursos)');
for (const o of ocupantes(eje, D, [1])) console.log('     ' + o.origen.padEnd(11) + id8(o.evento) + ' camino ' + JSON.stringify(o.camino) + ' · ' + o.signo + ' · vector ' + JSON.stringify(o.vector));
muestra('CONTAR(FILTRAR(BUSCAR(1), ORIGEN() = "escrito"))', consultar(eje, D, [9], 'CONTAR(FILTRAR(BUSCAR(1), ORIGEN() = "escrito"))'));

// ---------------------------------------------------------------------------
// 6. Eje temporal de la reserva: pasado (hilo) y futuro (posición 7 declarada + proyección).
// ---------------------------------------------------------------------------
const et = ejeTemporal(eje, reserva.id, { ahora: t('07', '18:00') });
console.log('6. eje temporal · ahora', et.ahora, '· pasado', et.totalPasado, '· futuro', et.totalFuturo);
for (const x of et.pasado) console.log('   pasado', x.tipo.padEnd(13), id8(x.id), x.autor.padEnd(8), x.t, String(x.delta).padStart(7), x.banda);
for (const x of et.futuro) console.log('   futuro', x.tipo.padEnd(13), id8(x.id), (x.autor ?? '').padEnd(8), x.t ?? '', String(x.delta).padStart(7), x.banda, x.contenido ?? '', x.estado ?? '');

// ---------------------------------------------------------------------------
// 7. Fábrica: la casa descubre la reserva en su disponibilidad; la persona huésped la consolida,
//    la casa la autoriza (P sobre el génesis) y la persona huésped la ejecuta pagando el total calculado por BQL.
// ---------------------------------------------------------------------------
console.log('7. fábrica');
const d = descubrir(eje, D);
for (const p of d) console.log('   posición', p.posicion, p.candidatos.map((x) => x.origen + ' ' + id8(x.evento) + ' «' + x.texto + '» (' + x.signo + ')').join(' · ') || 'nada');
const candidata = d[0].candidatos.find((x) => x.origen === 'escrito' && x.evento === reserva.id);
const cons = await consolidar(eje, {
  autor: 'huesped', foco: D, t: t('07', '12:30'), titulo: 'Reserva confirmada',
  elecciones: { 1: { candidato: candidata }, 4: 'cobrar ' + total.texto },
});
console.log('   consolidación', id8(cons.id), corto(cons.payload), '· en', cons.en === FABRICA ? 'FABRICA' : cons.en, '·', estadoDe(eje, cons.id));
console.log('   encaje guardado', corto(cons.contexto.encaje));
console.log('   puede autorizar:', ['casa', 'huesped'].map((i) => i + '=' + puedeAutorizar(eje, i, cons.id)).join(' '));
const aut = await autorizar(eje, { autorizante: 'casa', consolidacion: cons.id, t: t('07', '12:45'), nota: 'habitación doble reservada' });
console.log('   autorización', id8(aut.id), JSON.stringify(aut.payload), '·', estadoDe(eje, cons.id));
const antes = { casa: eje.saldo('casa', 'E:EUR'), huesped: eje.saldo('huesped', 'E:EUR') };
const ej = await ejecutar(eje, {
  autor: 'huesped', consolidacion: cons.id, t: t('07', '13:00'), titulo: 'Pagado',
  movimientos: [{ token: 'E', denominacion: total.valor.unidad, cantidad: total.valor.cantidad, de: 'huesped', a: 'casa' }],
});
console.log('   ejecución', id8(ej.id), corto(ej.payload), '·', estadoDe(eje, cons.id));
console.log('   EUR casa', antes.casa, '→', eje.saldo('casa', 'E:EUR'), '· huesped', antes.huesped, '→', eje.saldo('huesped', 'E:EUR'));
console.log('   hilo de la ejecución:', eje.hilo(ej.id).map((x) => x.autor + '@' + id8(x.id)).join(' > '));

// ---------------------------------------------------------------------------
// 8. Guardar y reconstruir: todo se revalida y las fórmulas siguen dando lo mismo.
// ---------------------------------------------------------------------------
const copia = await persistencia.restaurar(JSON.parse(JSON.stringify(persistencia.serializar(eje))));
console.log('8. restaurado', copia.orden.length, 'eventos ·', estadoDe(copia, cons.id), '· total en la copia:', evaluar(copia, reserva.id, [1, 3]).texto, '·', evaluar(copia, reserva.id, [1, 4]).texto);
```

</details>

<details>
<summary>Salida</summary>

```text
Archivo: <temporal>\extranjero-reserva.mjs
Comando: node <temporal>\extranjero-reserva.mjs   (Node v24.14.1, desde <repo>; funcionó a la primera, sin errores)

1. génesis 13bdbfdc · identidades ["casa"]
2. alta 15b559fd · identidades ["casa","huesped"] · huesped EUR 300 T(h) 10
3. disponibilidad bb5b418d · posiciones 11 · 1100000000 = ["doble","80 EUR"] · 1110000000 = "80 EUR"
4. reserva 7b0b5a3a · sobre bb5b418d · en 1000000000 · posiciones 16 · minutos de T movidos 16
   payload ["Reserva de habitación doble, 2 noches",[{"ref":"bb5b418d","dir":"1100000000"},2,{"ref":"bb5b418d","dir":"1110000000"},"=LOCAL(1) * LOCAL(2)","=LOCAL(3) + LOCAL(1) * 24 h"],["desayuno incluido","cama doble","sin mascotas"],["huesped","casa"],["reservar","pagar al llegar"],{"ref":"bb5b418d"},{"ref":"15b559fd"},"2026-11-14T15:00:00Z"]
   hilo huesped@7b0b5a3a > casa@bb5b418d > casa@15b559fd > casa@13bdbfdc
   época 0 de 1300000000 (donde vive el total): 0:1=recursos 1:3=comunicación
5. evaluar(eje, reserva, dir)
  [1,0] habitación (referencia, no se sigue)           → RESUELTO     → bb5b418d
  [1,1] noches                                         → RESUELTO     2
  [1,2] precio (referencia, no se sigue)               → RESUELTO     → bb5b418d
  [1,3] total = noches × precio                        → RESUELTO     160 EUR
  [1,4] total + tiempo de estancia                     → RESUELTO     160 EUR + 48 h
  [7]   fecha futura                                   → RESUELTO     2026-11-14T15:00:00Z
  [8]   sin desarrollar                                → PENDIENTE    PENDIENTE: posición sin desarrollar
   dependencias de [1,3]: ["bb5b418d:1110000000","7b0b5a3a:1300000000"]
   dependencias de [1,4]: ["bb5b418d:1110000000","7b0b5a3a:1300000000","7b0b5a3a:1400000000"]
   valor crudo de [1,3]: {"tipo":"magnitud","cantidad":160,"unidad":"EUR","desglose":[{"cantidad":160,"unidad":"EUR"}]}
   consultar desde la raíz de la reserva (anfitrión [])
  LOCAL(1, 0)                                          → RESUELTO     [2 posiciones]
  LOCAL(1, 2)                                          → RESUELTO     80 EUR
  LOCAL(1, 3)                                          → RESUELTO     160 EUR
  REF("bb5b418d", "1110000000") * LOCAL(1, 1)          → RESUELTO     160 EUR
  LOCAL(1, 3) <= 200 EUR                               → RESUELTO     verdadero
  LOCAL(1, 4)                                          → RESUELTO     160 EUR + 48 h
  LOCAL(1, 3) + 15 min                                 → RESUELTO     160 EUR + 15 min
  CONTAR(BUSCAR(1))                                    → RESUELTO     3
   desde la disponibilidad: qué ocupa su posición 1 (recursos)
     propio     bb5b418d camino [1] · exacto · vector [0,0,0,0,0,0,0,0,0,0]
     propio     bb5b418d camino [1,0] · exacto · vector [0,0,0,0,0,0,0,0,0,0]
     escrito    7b0b5a3a camino [] · exacto · vector [0,0,0,0,0,0,0,0,0,0]
  CONTAR(FILTRAR(BUSCAR(1), ORIGEN() = "escrito"))     → RESUELTO     1
6. eje temporal · ahora 2026-11-07T18:00:00Z · pasado 3 · futuro 2
   pasado registro      bb5b418d casa     2026-11-07T10:00:00Z  -28800 dia
   pasado registro      15b559fd casa     2026-11-07T09:05:00Z  -32100 dia
   pasado registro      13bdbfdc casa     2026-11-07T09:00:00Z  -32400 dia
   futuro declarado     7b0b5a3a huesped  2026-11-07T12:00:00Z       0 segundo 2026-11-14T15:00:00Z 
   futuro proyeccion    e29b98ff huesped  2026-11-14T15:00:00Z  594000 semana  
7. fábrica
   posición 1 propio bb5b418d «Habitaciones» (exacto) · propio bb5b418d «Habitaciones» (exacto) · escrito 7b0b5a3a «Reserva de habitación doble, 2 noches» (exacto)
   posición 2 propio bb5b418d «máximo 3 noches» (exacto) · propio bb5b418d «máximo 3 noches» (exacto)
   posición 3 propio bb5b418d «casa» (exacto) · propio bb5b418d «casa» (exacto)
   posición 4 propio bb5b418d «reservar» (exacto) · propio bb5b418d «reservar» (exacto)
   consolidación d42ed0b1 ["Reserva confirmada",{"ref":"7b0b5a3a","dir":"0000000000"},{"ref":"bb5b418d","dir":"2000000000"},{"ref":"bb5b418d","dir":"3000000000"},"cobrar 160 EUR"] · en FABRICA · PENDIENTE DE AUTORIZACIÓN
   encaje guardado [{"posicion":1,"evento":"7b0b5a3a","tipo":"escrito","origen":"1000000000","destino":"1000000000","vector":[0,0,0,0,0,0,0,0,0,0],"signo":"exacto"}]
   puede autorizar: casa=true huesped=false
   autorización ca938197 "==habitación doble reservada" · AUTORIZADO
   ejecución a9d06816 ["Pagado",{"ref":"d42ed0b1"},{"ref":"ca938197"}] · EJECUTADO
   EUR casa 700 → 860 · huesped 300 → 140
   hilo de la ejecución: huesped@a9d06816 > huesped@d42ed0b1 > casa@bb5b418d > casa@15b559fd > casa@13bdbfdc
8. restaurado 8 eventos · EJECUTADO · total en la copia: 160 EUR · 160 EUR + 48 h

--- Comprobación adicional (los snippets de los propios documentos, ejecutados tal cual, contra lo que dicen) ---
BTML §6.3 (ocupantes de la posición 1 de la compra con la cuenta escrita en 1000000000):
  propio [1] ec0734c3 1000000000 [0,0,0,0,0,0,0,0,0,0] exacto 10
  propio [1,0] ec0734c3 1000000000 [0,0,0,0,0,0,0,0,0,0] exacto 10
  referencia [1] 579144c6 1000000000 [0,0,0,0,0,0,0,0,0,0] exacto 10
  escrito [] c7c163ae 1000000000 [0,0,0,0,0,0,0,0,0,0] exacto 10        ← el doc dice: escrito [] 441d7a2b 0000000000 [1,0,…] completar 0
BTML §6.5 (llegada vs encaje; formato origen:signo:vector[0]:origenDir):
  propio:exacto:0:2000000000 referencia:reducir:5:7000000000 escrito:exacto:0:2000000000   ← el doc dice: propio:exacto:0 referencia:reducir:-5 escrito:completar:2
BTML §6.5 vector():
  vector('1230000000','1200000000') = [0,0,3,0,…] acuerdo 2 reducir faltas 0 excedentes 1 norma 3   ← el doc dice [0,0,-3,…]
  vector('0000000000','4000000000') = [-4,0,…] completar                                            ← el doc dice [4,0,…]
  vector('1700000000','2300000000') = [-1,4,0,…] mixto                                              ← el doc dice [1,-4,…]
  ordenarPorEncaje → exacto | desvio hondo | ref desde 7 | escrito en 2 | otro escrito              ← el doc dice exacto | desvio hondo | escrito en 2 | otro escrito | ref desde 7
BQL §7.11 sobre la compra con la cuenta (slot [1]):
  SIGNO()="exacto" → 4 (doc: 3) · SIGNO()="completar" → 0 (doc: 1) · FALTAS()=1 → 0 (doc: 1) · DESPLAZAMIENTO()>0 → 0 (doc: 1)
MOTOR §3.3 encaje guardado del candidato cuenta: {"origen":"1000000000","destino":"1000000000","vector":[0,…],"signo":"exacto"}   ← el doc dice origen 0000000000, vector [1,0,…], completar
```

</details>

<details>
<summary>Dudas</summary>

- Dónde anclar la reserva (`en`): la puse en la posición 1 (recursos) de la disponibilidad, por analogía con la cuenta del ejemplo (anclada en 1000000000 de la compra). Podría ser la raíz (por defecto) o la posición 4 (la acción «reservar»). Los documentos dejan `en` a quien llama (mapa §10.6 pendiente) sin un criterio para un registro «respuesta».
- Dónde viven las fórmulas: las puse DENTRO de la décupla de recursos (1.3 total, 1.4 total+tiempo) porque LOCAL solo ve el anfitrión (la décupla que contiene el slot). Una fórmula en una subposición de 2, 3 o 4 no puede leer la posición 1 del registro: no hay «LOCAL de raíz», y no puede usar REF a sí misma porque el id del registro es el hash de su propio payload. ¿Es un límite buscado? ¿O el total debería ir en una posición raíz (2 como criterio, 4 como actuación), donde el anfitrión es [] y LOCAL(1, 1) sí llega?
- Lectura bajo época 0 de la dirección del total (1300000000): «recursos > comunicación». No parece el sentido de un total. ¿La regla corta por profundidad vale tal cual dentro de una décupla de recursos (1.0 qué, 1.1 cuánto, 1.2 precio, 1.3 ?, 1.4 ?)? El ejemplo de la compra tampoco lo aplica en profundidad 1.
- Para llegar a la posición 7 tuve que rellenar 5 y 6. Puse referencias: 5 = {ref: foco} (estructura: registro en foco) y 6 = {ref: alta} (pasado). ¿Es la convención correcta, o lo canónico es heredar del foco por referencia como hacen desdeMapped y consolidar ({ref: foco, dir: posición i})?
- La fecha futura en 7 es un texto ISO. ejeTemporal la lista como `declarado` con delta 0 y banda `segundo`, sin interpretarla; la proyección real sale solo cuando escribo un hijo con t futuro (lo hice también: `llegada`). ¿Qué forma debe tener una fecha en el payload mientras PV7 no exista?
- Unidades de tiempo en BQL: escribí `24 h` (h es un identificador cualquiera). No hay puente entre la magnitud `48 h` y el token T (segundos, escala `hora`): la composición «160 EUR + 48 h» es solo texto compuesto. ¿Se espera que las unidades de tiempo de BQL coincidan con ESCALAS_T (hora, minuto…)?
- Coste en T: moví contarPosiciones(payload) minutos (16 para la reserva), siguiendo la regla de escribirDesde. Para eje.escribir directo bastaría 1 minuto. ¿Qué es lo correcto cuando no se pasa por escribirDesde?
- Quién consolida y quién ejecuta: la persona huésped consolida y ejecuta (paga), la casa autoriza con su P sobre el génesis. Si fuera la casa quien consolida (quien «acepta» la reserva) nadie podría autorizarla (defecto 15 de MOTOR §13). ¿La reserva es un ciclo del huésped o de la casa?
- `ambito: 'genesis'` en la emisión de P del génesis: lo tomé del ejemplo de MOTOR §10; BTML.md no lo documenta y su génesis de ejemplo no lo lleva. No probé qué pasa sin ámbito.
- El escrito (la reserva) sale `exacto` con vector 0 en ocupantes, descubrir y en el encaje guardado de la consolidación; los tres documentos dicen que un escrito viene de la raíz (origenDir 0000000000, vector [1,0,…], completar). Ejecuté los snippets de los documentos y el código tampoco reproduce sus salidas. ¿Cuál es la semántica vigente de un escrito: nace en su raíz y se coloca en `en` (falta profundidad), o nace ya en `en`?
- El signo del vector: hoy el código devuelve vector = origen − destino (una referencia a la 7 colocada en la 2 da +5 y `reducir`; un escrito de la raíz colocado en la 4 daría −4 y `completar`), y faltas() cuenta las componentes negativas. Los documentos dicen lo contrario (destino − origen; positivo = falta). Además ordenarPorEncaje ya no da el orden del doc («El signo no ordena» o la regla de distancia ha cambiado: ref desde 7 va antes que un escrito a distancia 2). Esto toca directamente la duda del usuario sobre «el número negativo»: ¿cuál es la convención que se quiere, y debe ordenar el signo o solo la distancia? ¿Se quiere poder marcar negativo el vector entero (orientación) y no solo una componente?
- Pago «al llegar» frente a ejecución inmediata: ejecuté el pago en el acto porque no hay timelock (pendiente). La acción consolidada 'cobrar 160 EUR' es texto fijo (no hay concatenación en BQL), así que si cambiaran las noches el total de la fórmula cambiaría y el texto de la consolidación no.

</details>

<details>
<summary>Lo que faltó en los documentos</summary>

- La lista completa de exports de src/index.js. BTML.md dice «(entre otros)»: tuve que ejecutar `import('./src/index.js')` para saber que `bql` se exporta como espacio de nombres (BQL.md solo documenta `./src/bql.js`), y que existen `escritura`, `pointed`, `sequenced`, `mapped`, `AMBITO_GENESIS`, `motor.proponer`, `motor.OPERADORES`, ninguno documentado.
- El campo `ambito` de los movimientos P y las claves de saldo `P:genesis` / `P:<id>`: BTML §2.1–2.2 (familias, forma del movimiento, claveToken) no lo mencionan; solo se deduce de MOTOR §4.1/§10 (`eje.poderes`, `eje.poderSobre`, `eje.saldo('casa','P:genesis')`), funciones que tampoco están en la API mínima de BTML §10.
- Los tres documentos están desactualizados respecto al encaje: (a) un escrito ya no viene de la raíz: origenDir = su `en`, siempre `exacto` (BTML §6.2 origenDir, §6.3 y §6.5 ejemplos; BQL §7.4 «escrito → origenDir = '0000000000'», §7.6 FALTAS()=1 → 3, §7.11 completar → 1; MOTOR §2 «completar: viene de la raíz», §3.3 encaje guardado, §10 salida); (b) el signo del vector está invertido (código: origen − destino; faltas cuenta negativos); (c) ordenarPorEncaje da otro orden que el ejemplo de BTML §6.5. Las salidas reales están en «salida».
- BTML.md cita ids del eje de ejemplo (1b133344, 2a2a06e3, 37c58bd2, 25ddaa89, 441d7a2b) que ya no son los reales (2983477b, 240c6005, 579144c6, ec0734c3, c7c163ae). MOTOR.md lo avisa; BTML.md no, y sus salidas «reales» no se reproducen.
- Una regla explícita de alcance de las fórmulas: «una fórmula solo ve la décupla que la contiene; desde una subposición no hay forma de leer la raíz del registro, y no puede referenciarse a sí misma por REF porque el id depende del payload». Se deduce de BQL §7.1 pero no está dicho como límite de diseño, y condiciona dónde se pueden poner totales.
- Una recomendación sobre `en` para un registro que responde a otro (reserva sobre disponibilidad, cuenta sobre compra): raíz o posición, y con qué criterio. El ejemplo de la cuenta usa 1000000000 sin explicar por qué.
- Qué poner en las posiciones intermedias (5, 6) cuando se necesita una posterior (7): BTML §3.2 dice «con contenido o con referencias» pero no cuál es la referencia canónica (¿el foco en esa posición, como hacen desdeMapped/consolidar? ¿cualquier cosa?).
- Cómo escribir un instante o fecha en un payload de modo que tiempo.js lo entienda, aunque sea provisionalmente (hoy la posición 7 se lista con delta 0 y banda `segundo` sea lo que sea; solo se avisa en «pendiente»).
- Qué unidades de tiempo usar en magnitudes BQL (h, min, hora, minuto…) y su relación con ESCALAS_T del token T; BQL §3/§4 admiten cualquier identificador y §11 dice que no hay conversión, pero no hay una convención recomendada.
- El coste de T esperado cuando se escribe con eje.escribir directo (sin escribirDesde): un minuto fijo o un minuto por posición. MOTOR §7.2 solo fija la regla para escribirDesde.
- La forma completa del Resultado.valor de una magnitud: `desglose` aparece siempre, también con un solo sumando ([{cantidad:160, unidad:'EUR'}]); BQL §5 lo describe como si solo importara con varios sumandos.
- La forma de la entrada `declarado` de ejeTemporal: lleva `id`, `autor` y `t` del propio foco además de `contenido`; MOTOR §8.2 solo documenta `contenido`, `delta: 0` y banda `segundo`.
- Cómo ejecutar en PowerShell/Git Bash en Windows: los snippets con `node --input-type=module -e "..."` llevan comillas dobles anidadas y los heredocs fallan en Git Bash; el único camino fiable fue escribir el .mjs en un archivo y ejecutarlo con `node ruta.mjs`.

</details>

### Tarea 2: cinco consultas BQL

<details>
<summary>Código</summary>

```js
// <temporal>\extranjero-formulas.mjs
// Cinco consultas BQL sobre el eje de ejemplo, escritas solo a partir de
// docs/BTML.md, docs/BQL.md y docs/MOTOR.md (sin leer src/ ni test/ ni el mapa).
// Ejecutar desde la raíz del repo:  node <temporal>\extranjero-formulas.mjs
import { ejemploCompra, ejemploCuenta } from 'file:///<repo>/ejemplos/ikisai/compra-food.mjs';
import { consultar } from 'file:///<repo>/src/bql.js';

const { eje, compra } = await ejemploCompra();   // génesis, alta, menú, compra
await ejemploCuenta(eje, compra);                 // + cuenta (escrita en 1000000000 de la compra)

// El slot solo fija el anfitrión: con '4000000000' el anfitrión es la raíz de la compra,
// así que BUSCAR(4) mira la posición 4 de la compra y LOCAL(1, 2) lee el precio ("EUR 12").
const SLOT = '4000000000';

const consultas = [
  ['(1) candidatos de la posición 4',  'CONTAR(BUSCAR(4))'],
  ['(2) suma de los escritos en 4',    'SUMAR(FILTRAR(BUSCAR(4), ORIGEN() = "escrito"))'],
  ['(3) candidato con mayor acuerdo',  'ELEGIR(ORDENAR(BUSCAR(4), ACUERDO(), "desc"))'],
  ['(4) precio de la compra + 20 min', 'LOCAL(1, 2) + 20 min'],
  ['(5) PENDIENTE a propósito',        'LOCAL(7)'],
];

const corre = (titulo) => {
  console.log('--- ' + titulo + ' · eventos en el eje: ' + eje.orden.length);
  for (const [etiqueta, f] of consultas) {
    const r = consultar(eje, compra.id, SLOT, f);
    console.log(etiqueta.padEnd(34) + f.padEnd(50) + '→ ' + r.estado.padEnd(13) + r.texto);
  }
  console.log('eventos tras consultar (sin efectos): ' + eje.orden.length);
};

// A. El eje de ejemplo tal cual: la posición 4 de la compra es ['pagar', 'servir'] y nadie ha escrito en ella.
corre('A. eje de ejemplo tal cual (compra ' + compra.id.slice(0, 8) + ')');

// B. Tres propinas escritas en la posición 4 de la compra (sobre + en), para que (2) sume algo
//    y (3) tenga candidatos con acuerdo 0 frente a los propios con acuerdo 10.
const T = '2026-11-07T16:00:00Z';
const gastaT = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });
for (const propina of ['2 EUR', '5 EUR', '1 EUR']) {
  await eje.escribir({ autor: 'huesped', sobre: compra.id, en: SLOT, t: T, movimientos: [gastaT('huesped')], payload: propina });
}
corre('B. con tres propinas escritas en 4000000000 de la compra');

// Detalle de (3) en B: qué candidato sale elegido y con qué acuerdo.
const elegido = consultar(eje, compra.id, SLOT, 'ELEGIR(ORDENAR(BUSCAR(4), ACUERDO(), "desc"))');
if (elegido.estado === 'RESUELTO') {
  const c = elegido.valor.items[0];
  console.log('elegido: origen=' + c.origen + ' evento=' + c.evento.slice(0, 8) + ' indices=' + JSON.stringify(c.indices) + ' acuerdo=' + c.acuerdo + ' signo=' + c.signo);
}
```

</details>

<details>
<summary>Salida</summary>

```text
$ cd <repo> && node <temporal>\extranjero-formulas.mjs   (Node v24.14.1)

--- A. eje de ejemplo tal cual (compra ec0734c3) · eventos en el eje: 5
(1) candidatos de la posición 4   CONTAR(BUSCAR(4))                                 → RESUELTO     2
(2) suma de los escritos en 4     SUMAR(FILTRAR(BUSCAR(4), ORIGEN() = "escrito"))   → RESUELTO     0
(3) candidato con mayor acuerdo   ELEGIR(ORDENAR(BUSCAR(4), ACUERDO(), "desc"))     → RESUELTO     1 candidato: propio ec0734c3
(4) precio de la compra + 20 min  LOCAL(1, 2) + 20 min                              → RESUELTO     12 EUR + 20 min
(5) PENDIENTE a propósito         LOCAL(7)                                          → PENDIENTE    PENDIENTE: posición sin desarrollar
eventos tras consultar (sin efectos): 5
--- B. con tres propinas escritas en 4000000000 de la compra · eventos en el eje: 8
(1) candidatos de la posición 4   CONTAR(BUSCAR(4))                                 → RESUELTO     5
(2) suma de los escritos en 4     SUMAR(FILTRAR(BUSCAR(4), ORIGEN() = "escrito"))   → RESUELTO     8 EUR (2 EUR + 5 EUR + 1 EUR)
(3) candidato con mayor acuerdo   ELEGIR(ORDENAR(BUSCAR(4), ACUERDO(), "desc"))     → RESUELTO     1 candidato: propio ec0734c3
(4) precio de la compra + 20 min  LOCAL(1, 2) + 20 min                              → RESUELTO     12 EUR + 20 min
(5) PENDIENTE a propósito         LOCAL(7)                                          → PENDIENTE    PENDIENTE: posición sin desarrollar
eventos tras consultar (sin efectos): 8
elegido: origen=propio evento=ec0734c3 indices=[4] acuerdo=10 signo=exacto
```

</details>

<details>
<summary>Dudas</summary>

- (2) «sumen solo los escritos en esa posición»: en el eje de ejemplo tal cual (los cinco eventos de BTML §9) nadie ha escrito en la posición 4 de la compra, así que la respuesta honesta es `0` (colección vacía → numero 0, BQL §7.10). Añadí tres propinas en `4000000000` (sección B) para que la suma diga algo (`8 EUR (2 EUR + 5 EUR + 1 EUR)`); no sé si el encargo quería el eje intacto (resultado 0) o el escenario con escritos, así que imprimí los dos.
- (3) «el candidato con mayor acuerdo»: los dos propios (`[4]` y `[4, 0]`, que colisionan por los ceros finales) tienen acuerdo 10 y empatan; los escritos tienen acuerdo 0. ¿Cuál de los dos propios es «el» candidato? Sale `[4]` porque el orden es estable y `[4]` llega antes que `[4, 0]`, pero el empate no lo resuelve el encaje sino la llegada. Además, como `BUSCAR` ya ordena por encaje (acuerdo primero), `ELEGIR(BUSCAR(4))` daría lo mismo; puse `ORDENAR(…, ACUERDO(), "desc")` por fidelidad al enunciado.
- (3) Dudé de si `"desc"` invierte la lista ya ordenada (y entonces el empate saldría al revés, `[4, 0]` primero) o aplica un comparador descendente estable (empates en su orden de entrada). Lo comprobé ejecutando: es lo segundo (`indices=[4]`). Sin ejecutar no podía saberlo.
- (4) «el precio de la compra»: lo tomé de la posición 1.2 de la compra (`'EUR 12'`, literal con unidad delante, que §3 admite en un slot pero no en una fórmula). Otra lectura posible era el precio que fija la cuenta (`=REF(…, "1200000000") + 2 EUR` = 14 EUR); elegí el literal de la compra porque el enunciado dice «de la compra». El resultado es una composición (`12 EUR + 20 min`), no una suma: `min` y `EUR` no se funden.
- (5) Para PENDIENTE a propósito hay al menos tres vías documentadas: `LOCAL(7)` (posición sin desarrollar, elegida), `ACTUAL(7)` (`sin candidatos en la posición 7`) y `CONTAR(FILTRAR(BUSCAR(4), ACTUAL(0) = "pagar"))` (un candidato terminal sin posición 0). Elegí la más simple; no sé si se prefería la de colecciones.
- Elegí `'4000000000'` como `dir` de `consultar` solo para fijar el anfitrión en la raíz de la compra (BQL §7.1); cualquier dirección de profundidad 1 habría servido. No estaba seguro de si consultar «desde» el mismo slot que se busca (`[4]` con `BUSCAR(4)`) podía disparar `ciclo en …`; no lo hace porque la posición 4 no es fórmula.
- Incluí `ejemploCuenta` para trabajar sobre «el eje de ejemplo» completo (cinco eventos) aunque la cuenta se ancla en `1000000000` y no afecta a las consultas sobre la posición 4. `ejemploCuenta` admite un tercer parámetro `privadaCocina` (MOTOR §0); lo omití porque el eje se creó sin claves.
- Los ids: BTML §9 y BQL citan la compra como `25ddaa89` y MOTOR como `ec0734c3` (tras la PR #18). La ejecución real da `ec0734c3`, así que MOTOR es el actual; no afecta al código porque uso `compra.id`, pero al leer los tres documentos a la vez confunde.
- Las propinas las escribe `huesped` con un minuto de T cada una (saldo 24 h − 1 h según BTML §9), con el mismo `t` y payloads distintos para que los ids no choquen (`evento ya registrado`). No vi en los documentos si tres escritos con el mismo `t` plantean algún problema de orden; el orden de llegada fue el de entrada, como dice BQL §7.4.

</details>

<details>
<summary>Lo que faltó en los documentos</summary>

- BQL §7.7: «el texto desc … invierte» es ambiguo entre invertir la lista ordenada (que invertiría también los empates) y ordenar con comparador descendente estable. Para un `ELEGIR` sobre un empate (los dos propios con acuerdo 10) la diferencia decide qué candidato sale; tuve que ejecutar para saber que los empates conservan el orden de entrada también con `desc`.
- BQL no dice en ningún sitio, de forma explícita, que un propio tiene siempre acuerdo 10 y vector cero (se deduce de §7.4 «propio → origenDir = destino»), ni advierte de que, por tanto, «el candidato con mayor acuerdo» será siempre un propio mientras exista uno: `ACUERDO()` solo discrimina entre referencias y escritos. Una frase en §7.11 lo habría dejado claro.
- No hay en BQL una función para obtener el valor del candidato elegido (`ELEGIR` devuelve una colección, no el valor). Desde JavaScript hay que ir a `valor.items[0]` (lo hice) o abusar de `SUMAR` sobre una colección de un ítem (§12.6). Faltaría decir cuál es la vía prevista, o anotar que no la hay.
- El estado del eje de ejemplo en la posición 4: ni BTML §9 ni BQL dicen que la posición 4 de la compra no tiene escritos en el eje de ejemplo (el escenario de las propinas de BQL §7.4 y §10 es de `test/bql-colecciones.test.js` y del ejemplo ejecutable, no del eje de `compra-food.mjs`). Una tabla «qué hay en cada posición de la compra, con ocupantes» evitaría adivinar si (2) debe dar 0 o algo más.
- Los tres documentos no concuerdan en los ids del eje de ejemplo (BTML/BQL: `25ddaa89`; MOTOR: `ec0734c3`) ni en el génesis (BTML §8 muestra `P 10` sin `ambito`; MOTOR §4.1 dice que el génesis ya lleva `ambito: 'genesis'`). MOTOR lo advierte en una nota, pero BTML y BQL deberían actualizarse o remitir a esa nota al principio.
- BQL §1 dice que `dir` de `consultar` «solo sirve para fijar el anfitrión», pero no aclara si es seguro usar como `dir` la misma posición que se consulta con `BUSCAR`/`ACTUAL` (riesgo de `ciclo en …`). Por §7.5 se intuye que solo hay ciclo si ese slot contiene una fórmula; convendría decirlo junto a la firma de `consultar`.
- Las unidades de las magnitudes (`min`, `EUR`) no tienen relación con las escalas de T (`minuto`) ni con las denominaciones de E (`EUR`): BQL §11 lo deja como pendiente («conversión de unidades»), pero una línea en §3 o §5 diciendo que `20 min` es una etiqueta literal sin vínculo con `SEGUNDOS.minuto` ahorraría la duda al componer «precio + 20 min».
- Ningún documento dice cómo importar el eje de ejemplo desde fuera del repositorio (`file:///…/ejemplos/ikisai/compra-food.mjs` funciona porque sus imports internos son relativos); lo supe por el enunciado de la tarea, no por los documentos. Una línea en BTML §9 bastaría.
- BQL §5 muestra el formato de una colección con varios ítems (`3 candidatos: …`) y vacía (`0 candidatos`), pero no el singular (`1 candidato: …`); lo inferí y acertó. Menor, pero es lo que se compara en una prueba.

</details>

### Tarea 3: la dirección 1000000000 de la compra

<details>
<summary>Código</summary>

```js
// Ocupantes de la dirección 1000000000 de la compra del menú, por qué colisionan,
// vector y distancia de cada uno, orden de salida; luego un escrito nuevo en la posición 2.
// Escrito solo con docs/BTML.md, docs/BQL.md y docs/MOTOR.md, sin leer src/ ni test/.
// Ejecutar: node <temporal>\extranjero-direccion.mjs

const RAIZ_REPO = 'file:///<repo>/';
const { ejemploCompra, ejemploCuenta } = await import(RAIZ_REPO + 'ejemplos/ikisai/compra-food.mjs');
const { ocupantes, caminosDe, vector, distancia, acuerdo, signo, norma, faltas, excedentes, ordenarPorEncaje, arbol, colisiones } = await import(RAIZ_REPO + 'src/encaje.js');
const { direccion, indicesDe, resolver } = await import(RAIZ_REPO + 'src/btml.js');

const corto = (x) => JSON.stringify(x).replace(/[0-9a-f]{64}/g, (m) => m.slice(0, 8));
const id8 = (id) => id.slice(0, 8);
const T = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });

// ---------------------------------------------------------------------------
// 0. El eje de ejemplo: génesis, alta, menú, compra + cuenta
// ---------------------------------------------------------------------------
const { eje, menu, compra } = await ejemploCompra();
const cuenta = await ejemploCuenta(eje, compra);

console.log('=== 0. Eje de ejemplo ===');
console.log('eventos:', eje.orden.map((id) => id8(id) + ':' + eje.obtener(id).autor).join('  '));
console.log('compra', id8(compra.id), 'payload:', corto(compra.payload));
console.log('cuenta', id8(cuenta.id), 'sobre', id8(cuenta.sobre), 'en', cuenta.en, 'payload[0]:', JSON.stringify(cuenta.payload[0]));

// ---------------------------------------------------------------------------
// 1. Por qué colisionan: los ceros finales de la dirección
// ---------------------------------------------------------------------------
console.log('\n=== 1. Por qué colisionan en 1000000000 ===');
console.log('direccion([1])   =', direccion([1]));
console.log('direccion([1,0]) =', direccion([1, 0]), '→ iguales:', direccion([1]) === direccion([1, 0]));
console.log('indicesDe("1000000000") =', JSON.stringify(indicesDe('1000000000')), '(los ceros finales se quitan: el índice 0 real final no se puede nombrar)');
console.log('compra.payload[1]    =', corto(resolver(compra.payload, '1000000000')), '← camino [1], un array con posición 0');
console.log('compra.payload[1][0] =', corto(compra.payload[1][0]), '← camino [1,0], una referencia al menú:1000000000');
const caminos = caminosDe(compra.payload, '1000000000');
console.log('caminosDe(compra.payload, "1000000000") →', JSON.stringify(caminos.map((c) => c.indices)), '(caminos propios que comparten la dirección)');
console.log('el menú:1000000000 alcanza:', corto(resolver(menu.id === compra.payload[1][0].ref ? eje.obtener(menu.id).payload : null, '1000000000')));
console.log('escritos del foco anclados en 1000000000:', eje.sobre(compra.id, '1000000000').map((e) => id8(e.id) + ' (' + e.autor + ')').join(', '));

// ---------------------------------------------------------------------------
// 2. Los ocupantes: orden de llegada y orden de encaje, con vector y distancia
// ---------------------------------------------------------------------------
function tabla(lista) {
  for (const [k, o] of lista.entries()) {
    console.log(
      ' ', String(k).padStart(2) + '.',
      o.origen.padEnd(10),
      'camino', JSON.stringify(o.camino).padEnd(6),
      'vive en', id8(o.evento) + ':' + o.dir,
      '| origenDir', o.origenDir, '→ destino', o.destino,
      '| vector', JSON.stringify(o.vector),
      '| distancia', JSON.stringify(o.distancia),
      '| acuerdo', o.acuerdo, '| signo', o.signo, '| faltas', o.faltas, '| excedentes', o.excedentes, '| norma', norma(o.vector),
    );
    console.log('      contenido:', corto(o.contenido), '| rota:', o.rota ?? false, o.autor ? '| autor ' + o.autor + ' t ' + o.t : '');
    console.log('      procedencia:', corto(o.procedencia));
  }
}

console.log('\n=== 2a. ocupantes(eje, compra, [1]) en orden de LLEGADA ===');
const llegada = ocupantes(eje, compra.id, [1], { orden: 'llegada' });
tabla(llegada);

console.log('\n=== 2b. ocupantes(eje, compra, [1]) en orden de ENCAJE (por defecto) ===');
const encaje = ocupantes(eje, compra.id, [1]);
tabla(encaje);
console.log('mismo conjunto en ambos órdenes:', llegada.length === encaje.length && llegada.every((o) => encaje.some((p) => p.procedencia.join() === o.procedencia.join())));
console.log('[1] y [1,0] nombran la misma dirección: ocupantes(..., [1,0]).length =', ocupantes(eje, compra.id, [1, 0]).length);

// Comprobar a mano el vector y la distancia de cada ocupante con las funciones sueltas
console.log('\n=== 2c. Recalculo a mano: vector(origenDir, destino) ===');
for (const o of encaje) {
  const v = vector(o.origenDir, o.destino);
  const d = distancia(v);
  const ok = JSON.stringify(v) === JSON.stringify(o.vector) && JSON.stringify(d) === JSON.stringify(o.distancia) && acuerdo(v) === o.acuerdo && signo(v) === o.signo && faltas(v) === o.faltas && excedentes(v) === o.excedentes;
  console.log(' ', o.origen.padEnd(10), 'vector', JSON.stringify(v), 'distancia', JSON.stringify(d), 'acuerdo', acuerdo(v), 'signo', signo(v), '→ coincide con el ocupante:', ok);
}
console.log('ordenarPorEncaje(llegada) da el mismo orden que ocupantes por defecto:',
  JSON.stringify(ordenarPorEncaje(llegada).map((o) => o.procedencia.join())) === JSON.stringify(encaje.map((o) => o.procedencia.join())));

// ---------------------------------------------------------------------------
// 3. El árbol lógico de la compra antes de escribir nada más
// ---------------------------------------------------------------------------
console.log('\n=== 3. Colisiones de la compra ANTES de escribir en la posición 2 ===');
const antes = arbol(eje, compra.id);
for (const [dir, oc] of antes) console.log(' ', dir, oc.map((o) => o.origen + '#' + o.camino.join('.')).join(' '));
console.log('colisiones:', colisiones(antes).map((c) => c.dir + ':' + c.ocupantes.length).join(' '));
console.log('ocupantes de [2] antes:', ocupantes(eje, compra.id, [2]).map((o) => o.origen + '#' + o.camino.join('.') + '(' + o.signo + ')').join(' '));
console.log('compra.payload[2] =', corto(compra.payload[2]), '← un array con una referencia a menú:2000000000 (criterios)');

// ---------------------------------------------------------------------------
// 4. Escribir un registro nuevo en la posición 2 de la compra (sobre + en)
// ---------------------------------------------------------------------------
console.log('\n=== 4. Escribir un registro en la posición 2 de la compra ===');
const saldoAntes = eje.saldoT('huesped', 'minuto');
const criterio = await eje.escribir({
  autor: 'huesped',
  sobre: compra.id,
  en: '2000000000',
  t: '2026-11-07T15:30:00Z',
  movimientos: [T('huesped')],
  payload: 'sin lactosa',
});
console.log('nuevo', id8(criterio.id), 'autor', criterio.autor, 'sobre', id8(criterio.sobre), 'en', criterio.en, 'payload', JSON.stringify(criterio.payload));
console.log('T de huesped (min):', saldoAntes, '→', eje.saldoT('huesped', 'minuto'), '| eventos en el eje:', eje.orden.length);
console.log('el payload de la compra NO cambia:', corto(eje.obtener(compra.id).payload) === corto(compra.payload), '| hijos en 2000000000:', eje.sobre(compra.id, '2000000000').length);

console.log('\n=== 4a. ocupantes(eje, compra, [2]) DESPUÉS (orden de encaje) ===');
const despues2 = ocupantes(eje, compra.id, [2]);
tabla(despues2);
console.log('en orden de llegada:', ocupantes(eje, compra.id, [2], { orden: 'llegada' }).map((o) => o.origen + '#' + o.camino.join('.')).join(' '));
console.log('en orden de encaje: ', despues2.map((o) => o.origen + '#' + o.camino.join('.')).join(' '));

// Un segundo escrito en la misma posición: la igualdad de vector se resuelve por llegada
const segundo = await eje.escribir({
  autor: 'cocina',
  sobre: compra.id,
  en: '2000000000',
  t: '2026-11-07T15:31:00Z',
  movimientos: [T('cocina')],
  payload: ['Criterio de cocina', 'sin frutos secos'],
});
console.log('\nsegundo escrito', id8(segundo.id), 'por', segundo.autor, 'en', segundo.en, '→ ocupantes de [2]:');
tabla(ocupantes(eje, compra.id, [2]));

console.log('\n=== 4b. Colisiones de la compra DESPUÉS ===');
const despues = arbol(eje, compra.id);
for (const [dir, oc] of despues) console.log(' ', dir, oc.map((o) => o.origen + '#' + o.camino.join('.')).join(' '));
console.log('colisiones antes :', colisiones(antes).map((c) => c.dir + ':' + c.ocupantes.length).join(' '));
console.log('colisiones después:', colisiones(despues).map((c) => c.dir + ':' + c.ocupantes.length).join(' '));
console.log('la posición 1 sigue igual (4 ocupantes):', ocupantes(eje, compra.id, [1]).length);
console.log('la posición 1 NO ve el escrito de la 2 y la 2 NO ve la cuenta de la 1:',
  !ocupantes(eje, compra.id, [1]).some((o) => o.evento === criterio.id), !ocupantes(eje, compra.id, [2]).some((o) => o.evento === cuenta.id));

// ---------------------------------------------------------------------------
// 5. Contraste con lo que dicen los documentos (BTML §6.3/§6.5, MOTOR §2, BQL §7.4/§7.11)
// ---------------------------------------------------------------------------
console.log('\n=== 5. Contraste con los documentos ===');
const v = vector('1230000000', '1200000000');
console.log('vector(1230000000 → 1200000000) =', JSON.stringify(v), signo(v), '| BTML §6.5 decía [0,0,-3,…] reducir (destino − origen)');
console.log('vector(0000000000 → 4000000000) =', JSON.stringify(vector('0000000000', '4000000000')), signo(vector('0000000000', '4000000000')), '| BTML §6.5 decía [4,0,…] completar');
console.log('vector(1700000000 → 2300000000) =', JSON.stringify(vector('1700000000', '2300000000')), signo(vector('1700000000', '2300000000')), '| BTML §6.5 decía [1,-4,…] mixto');
const lista = [
  { nombre: 'ref desde 7', vector: vector('7000000000', '2000000000') },
  { nombre: 'escrito en 2', vector: vector('0000000000', '2000000000') },
  { nombre: 'exacto', vector: vector('2000000000', '2000000000') },
  { nombre: 'desvio hondo', vector: vector('2300000000', '2000000000') },
  { nombre: 'otro escrito', vector: vector('0000000000', '2000000000') },
];
console.log('ordenarPorEncaje:', ordenarPorEncaje(lista).map((x) => x.nombre + JSON.stringify(x.vector.slice(0, 2))).join(' | '));
console.log('BTML §6.5 decía:  exacto | desvio hondo | escrito en 2 | otro escrito | ref desde 7   (menor distancia a igual acuerdo)');

// El escenario de BTML §6.5 sobre un eje limpio: referencia a la 7 colocada en la 2 + escrito en la 2
const { eje: eje2, compra: compra2 } = await ejemploCompra();
const Tc = T('casa');
const plan = await eje2.escribir({ autor: 'casa', sobre: compra2.id, t: '2026-11-07T16:00:00Z', movimientos: [Tc], payload: ['Plan', 'a', 'b', 'c', 'd', 'e', 'f', 'cena'] });
const x = await eje2.escribir({ autor: 'casa', sobre: compra2.id, t: '2026-11-07T16:00:00Z', movimientos: [Tc], payload: ['X', 'r', { ref: plan.id, dir: '7000000000' }] });
await eje2.escribir({ autor: 'casa', sobre: x.id, en: '2000000000', t: '2026-11-07T16:00:00Z', movimientos: [Tc], payload: 'criterio escrito' });
const f = (o) => o.origen + ':' + o.signo + ':' + o.vector[0] + ':' + o.origenDir;
console.log('escenario §6.5, llegada:', ocupantes(eje2, x.id, [2], { orden: 'llegada' }).map(f).join(' '));
console.log('escenario §6.5, encaje: ', ocupantes(eje2, x.id, [2]).map(f).join(' '));
console.log('BTML §6.5 decía:         propio:exacto:0 referencia:reducir:-5 escrito:completar:2  /  propio escrito referencia');

// BQL §7.11 sobre la compra con la cuenta escrita en 1000000000
const { consultar } = await import(RAIZ_REPO + 'src/bql.js');
const { eje: eje3, compra: compra3 } = await ejemploCompra();
await ejemploCuenta(eje3, compra3);
for (const [formula, docs] of [
  ['CONTAR(FILTRAR(BUSCAR(1), SIGNO() = "exacto"))', '3'],
  ['CONTAR(FILTRAR(BUSCAR(1), SIGNO() = "completar"))', '1'],
  ['CONTAR(FILTRAR(BUSCAR(1), FALTAS() = 1))', '1'],
  ['CONTAR(FILTRAR(BUSCAR(1), DESPLAZAMIENTO() > 0))', '1'],
  ['CONTAR(FILTRAR(BUSCAR(1), ACUERDO() = 10))', '3'],
]) console.log('BQL', formula.padEnd(52), '→', consultar(eje3, compra3.id, [1], formula).texto.padEnd(3), '| BQL §7.11 decía', docs);
```

</details>

<details>
<summary>Salida</summary>

```text
$ node <temporal>\extranjero-direccion.mjs   (Node v24.14.1, cwd <repo>, 2026-11-07)

=== 0. Eje de ejemplo ===
eventos: 2983477b:casa  240c6005:casa  579144c6:cocina  ec0734c3:huesped  c7c163ae:cocina
compra ec0734c3 payload: ["Compra del menú del día",[{"ref":"579144c6","dir":"1000000000"},1,"EUR 12"],[{"ref":"579144c6","dir":"2000000000"}],["huesped","cocina"],["pagar","servir"]]
cuenta c7c163ae sobre ec0734c3 en 1000000000 payload[0]: "Cuenta del menú"

=== 1. Por qué colisionan en 1000000000 ===
direccion([1])   = 1000000000
direccion([1,0]) = 1000000000 → iguales: true
indicesDe("1000000000") = [1] (los ceros finales se quitan: el índice 0 real final no se puede nombrar)
compra.payload[1]    = [{"ref":"579144c6","dir":"1000000000"},1,"EUR 12"] ← camino [1], un array con posición 0
compra.payload[1][0] = {"ref":"579144c6","dir":"1000000000"} ← camino [1,0], una referencia al menú:1000000000
caminosDe(compra.payload, "1000000000") → [[1],[1,0]] (caminos propios que comparten la dirección)
el menú:1000000000 alcanza: ["ensalada","guiso","fruta"]
escritos del foco anclados en 1000000000: c7c163ae (cocina)

=== 2a. ocupantes(eje, compra, [1]) en orden de LLEGADA ===
   0. propio     camino [1]    vive en ec0734c3:1000000000 | origenDir 1000000000 → destino 1000000000 | vector [0,0,0,0,0,0,0,0,0,0] | distancia [0,0,0,0,0,0,0,0,0,0] | acuerdo 10 | signo exacto | faltas 0 | excedentes 0 | norma 0
      contenido: [{"ref":"579144c6","dir":"1000000000"},1,"EUR 12"] | rota: false 
      procedencia: ["ec0734c3:1000000000#1"]
   1. propio     camino [1,0]  vive en ec0734c3:1000000000 | origenDir 1000000000 → destino 1000000000 | vector [0,0,0,0,0,0,0,0,0,0] | distancia [0,0,0,0,0,0,0,0,0,0] | acuerdo 10 | signo exacto | faltas 0 | excedentes 0 | norma 0
      contenido: {"ref":"579144c6","dir":"1000000000"} | rota: false 
      procedencia: ["ec0734c3:1000000000#1.0"]
   2. referencia camino [1]    vive en 579144c6:1000000000 | origenDir 1000000000 → destino 1000000000 | vector [0,0,0,0,0,0,0,0,0,0] | distancia [0,0,0,0,0,0,0,0,0,0] | acuerdo 10 | signo exacto | faltas 0 | excedentes 0 | norma 0
      contenido: ["ensalada","guiso","fruta"] | rota: false 
      procedencia: ["ec0734c3:1000000000#1.0","579144c6:1000000000"]
   3. escrito    camino []     vive en c7c163ae:0000000000 | origenDir 1000000000 → destino 1000000000 | vector [0,0,0,0,0,0,0,0,0,0] | distancia [0,0,0,0,0,0,0,0,0,0] | acuerdo 10 | signo exacto | faltas 0 | excedentes 0 | norma 0
      contenido: ["Cuenta del menú","=REF(\"ec0734c3\", \"1200000000\") + 2 EUR","=LOCAL(1) + 15 min","==no es fórmula"] | rota: false | autor cocina t 2026-11-07T14:10:00Z
      procedencia: ["c7c163ae:0000000000"]

=== 2b. ocupantes(eje, compra, [1]) en orden de ENCAJE (por defecto) ===
   0. propio     camino [1]    vive en ec0734c3:1000000000 | origenDir 1000000000 → destino 1000000000 | vector [0,0,0,0,0,0,0,0,0,0] | distancia [0,0,0,0,0,0,0,0,0,0] | acuerdo 10 | signo exacto | faltas 0 | excedentes 0 | norma 0
      contenido: [{"ref":"579144c6","dir":"1000000000"},1,"EUR 12"] | rota: false 
      procedencia: ["ec0734c3:1000000000#1"]
   1. propio     camino [1,0]  vive en ec0734c3:1000000000 | origenDir 1000000000 → destino 1000000000 | vector [0,0,0,0,0,0,0,0,0,0] | distancia [0,0,0,0,0,0,0,0,0,0] | acuerdo 10 | signo exacto | faltas 0 | excedentes 0 | norma 0
      contenido: {"ref":"579144c6","dir":"1000000000"} | rota: false 
      procedencia: ["ec0734c3:1000000000#1.0"]
   2. referencia camino [1]    vive en 579144c6:1000000000 | origenDir 1000000000 → destino 1000000000 | vector [0,0,0,0,0,0,0,0,0,0] | distancia [0,0,0,0,0,0,0,0,0,0] | acuerdo 10 | signo exacto | faltas 0 | excedentes 0 | norma 0
      contenido: ["ensalada","guiso","fruta"] | rota: false 
      procedencia: ["ec0734c3:1000000000#1.0","579144c6:1000000000"]
   3. escrito    camino []     vive en c7c163ae:0000000000 | origenDir 1000000000 → destino 1000000000 | vector [0,0,0,0,0,0,0,0,0,0] | distancia [0,0,0,0,0,0,0,0,0,0] | acuerdo 10 | signo exacto | faltas 0 | excedentes 0 | norma 0
      contenido: ["Cuenta del menú","=REF(\"ec0734c3\", \"1200000000\") + 2 EUR","=LOCAL(1) + 15 min","==no es fórmula"] | rota: false | autor cocina t 2026-11-07T14:10:00Z
      procedencia: ["c7c163ae:0000000000"]
mismo conjunto en ambos órdenes: true
[1] y [1,0] nombran la misma dirección: ocupantes(..., [1,0]).length = 4

=== 2c. Recalculo a mano: vector(origenDir, destino) ===
  propio     vector [0,0,0,0,0,0,0,0,0,0] distancia [0,0,0,0,0,0,0,0,0,0] acuerdo 10 signo exacto → coincide con el ocupante: true
  propio     vector [0,0,0,0,0,0,0,0,0,0] distancia [0,0,0,0,0,0,0,0,0,0] acuerdo 10 signo exacto → coincide con el ocupante: true
  referencia vector [0,0,0,0,0,0,0,0,0,0] distancia [0,0,0,0,0,0,0,0,0,0] acuerdo 10 signo exacto → coincide con el ocupante: true
  escrito    vector [0,0,0,0,0,0,0,0,0,0] distancia [0,0,0,0,0,0,0,0,0,0] acuerdo 10 signo exacto → coincide con el ocupante: true
ordenarPorEncaje(llegada) da el mismo orden que ocupantes por defecto: true

=== 3. Colisiones de la compra ANTES de escribir en la posición 2 ===
  0000000000 propio# propio#0
  1000000000 propio#1 propio#1.0 referencia#1 escrito#
  1100000000 propio#1.1
  1200000000 propio#1.2
  2000000000 propio#2 propio#2.0 referencia#2
  3000000000 propio#3 propio#3.0
  3100000000 propio#3.1
  4000000000 propio#4 propio#4.0
  4100000000 propio#4.1
colisiones: 0000000000:2 1000000000:4 2000000000:3 3000000000:2 4000000000:2
ocupantes de [2] antes: propio#2(exacto) propio#2.0(exacto) referencia#2(exacto)
compra.payload[2] = [{"ref":"579144c6","dir":"2000000000"}] ← un array con una referencia a menú:2000000000 (criterios)

=== 4. Escribir un registro en la posición 2 de la compra ===
nuevo 8fbcb402 autor huesped sobre ec0734c3 en 2000000000 payload "sin lactosa"
T de huesped (min): 1380 → 1379 | eventos en el eje: 6
el payload de la compra NO cambia: true | hijos en 2000000000: 1

=== 4a. ocupantes(eje, compra, [2]) DESPUÉS (orden de encaje) ===
   0. propio     camino [2]    vive en ec0734c3:2000000000 | origenDir 2000000000 → destino 2000000000 | vector [0,0,0,0,0,0,0,0,0,0] | distancia [0,0,0,0,0,0,0,0,0,0] | acuerdo 10 | signo exacto | faltas 0 | excedentes 0 | norma 0
      contenido: [{"ref":"579144c6","dir":"2000000000"}] | rota: false 
      procedencia: ["ec0734c3:2000000000#2"]
   1. propio     camino [2,0]  vive en ec0734c3:2000000000 | origenDir 2000000000 → destino 2000000000 | vector [0,0,0,0,0,0,0,0,0,0] | distancia [0,0,0,0,0,0,0,0,0,0] | acuerdo 10 | signo exacto | faltas 0 | excedentes 0 | norma 0
      contenido: {"ref":"579144c6","dir":"2000000000"} | rota: false 
      procedencia: ["ec0734c3:2000000000#2.0"]
   2. referencia camino [2]    vive en 579144c6:2000000000 | origenDir 2000000000 → destino 2000000000 | vector [0,0,0,0,0,0,0,0,0,0] | distancia [0,0,0,0,0,0,0,0,0,0] | acuerdo 10 | signo exacto | faltas 0 | excedentes 0 | norma 0
      contenido: ["sin gluten","vegetariano"] | rota: false 
      procedencia: ["ec0734c3:2000000000#2.0","579144c6:2000000000"]
   3. escrito    camino []     vive en 8fbcb402:0000000000 | origenDir 2000000000 → destino 2000000000 | vector [0,0,0,0,0,0,0,0,0,0] | distancia [0,0,0,0,0,0,0,0,0,0] | acuerdo 10 | signo exacto | faltas 0 | excedentes 0 | norma 0
      contenido: "sin lactosa" | rota: false | autor huesped t 2026-11-07T15:30:00Z
      procedencia: ["8fbcb402:0000000000"]
en orden de llegada: propio#2 propio#2.0 referencia#2 escrito#
en orden de encaje:  propio#2 propio#2.0 referencia#2 escrito#

segundo escrito f3b2ed61 por cocina en 2000000000 → ocupantes de [2]:
   0. propio     camino [2]    vive en ec0734c3:2000000000 | origenDir 2000000000 → destino 2000000000 | vector [0,0,0,0,0,0,0,0,0,0] | distancia [0,0,0,0,0,0,0,0,0,0] | acuerdo 10 | signo exacto | faltas 0 | excedentes 0 | norma 0
      contenido: [{"ref":"579144c6","dir":"2000000000"}] | rota: false 
      procedencia: ["ec0734c3:2000000000#2"]
   1. propio     camino [2,0]  vive en ec0734c3:2000000000 | origenDir 2000000000 → destino 2000000000 | vector [0,0,0,0,0,0,0,0,0,0] | distancia [0,0,0,0,0,0,0,0,0,0] | acuerdo 10 | signo exacto | faltas 0 | excedentes 0 | norma 0
      contenido: {"ref":"579144c6","dir":"2000000000"} | rota: false 
      procedencia: ["ec0734c3:2000000000#2.0"]
   2. referencia camino [2]    vive en 579144c6:2000000000 | origenDir 2000000000 → destino 2000000000 | vector [0,0,0,0,0,0,0,0,0,0] | distancia [0,0,0,0,0,0,0,0,0,0] | acuerdo 10 | signo exacto | faltas 0 | excedentes 0 | norma 0
      contenido: ["sin gluten","vegetariano"] | rota: false 
      procedencia: ["ec0734c3:2000000000#2.0","579144c6:2000000000"]
   3. escrito    camino []     vive en 8fbcb402:0000000000 | origenDir 2000000000 → destino 2000000000 | vector [0,0,0,0,0,0,0,0,0,0] | distancia [0,0,0,0,0,0,0,0,0,0] | acuerdo 10 | signo exacto | faltas 0 | excedentes 0 | norma 0
      contenido: "sin lactosa" | rota: false | autor huesped t 2026-11-07T15:30:00Z
      procedencia: ["8fbcb402:0000000000"]
   4. escrito    camino []     vive en f3b2ed61:0000000000 | origenDir 2000000000 → destino 2000000000 | vector [0,0,0,0,0,0,0,0,0,0] | distancia [0,0,0,0,0,0,0,0,0,0] | acuerdo 10 | signo exacto | faltas 0 | excedentes 0 | norma 0
      contenido: ["Criterio de cocina","sin frutos secos"] | rota: false | autor cocina t 2026-11-07T15:31:00Z
      procedencia: ["f3b2ed61:0000000000"]

=== 4b. Colisiones de la compra DESPUÉS ===
  0000000000 propio# propio#0
  1000000000 propio#1 propio#1.0 referencia#1 escrito#
  1100000000 propio#1.1
  1200000000 propio#1.2
  2000000000 propio#2 propio#2.0 referencia#2 escrito# escrito#
  3000000000 propio#3 propio#3.0
  3100000000 propio#3.1
  4000000000 propio#4 propio#4.0
  4100000000 propio#4.1
colisiones antes : 0000000000:2 1000000000:4 2000000000:3 3000000000:2 4000000000:2
colisiones después: 0000000000:2 1000000000:4 2000000000:5 3000000000:2 4000000000:2
la posición 1 sigue igual (4 ocupantes): 4
la posición 1 NO ve el escrito de la 2 y la 2 NO ve la cuenta de la 1: true true

=== 5. Contraste con los documentos ===
vector(1230000000 → 1200000000) = [0,0,3,0,0,0,0,0,0,0] reducir | BTML §6.5 decía [0,0,-3,…] reducir (destino − origen)
vector(0000000000 → 4000000000) = [-4,0,0,0,0,0,0,0,0,0] completar | BTML §6.5 decía [4,0,…] completar
vector(1700000000 → 2300000000) = [-1,4,0,0,0,0,0,0,0,0] mixto | BTML §6.5 decía [1,-4,…] mixto
ordenarPorEncaje: exacto[0,0] | desvio hondo[0,3] | ref desde 7[5,0] | escrito en 2[-2,0] | otro escrito[-2,0]
BTML §6.5 decía:  exacto | desvio hondo | escrito en 2 | otro escrito | ref desde 7   (menor distancia a igual acuerdo)
escenario §6.5, llegada: propio:exacto:0:2000000000 referencia:reducir:5:7000000000 escrito:exacto:0:2000000000
escenario §6.5, encaje:  propio:exacto:0:2000000000 escrito:exacto:0:2000000000 referencia:reducir:5:7000000000
BTML §6.5 decía:         propio:exacto:0 referencia:reducir:-5 escrito:completar:2  /  propio escrito referencia
BQL CONTAR(FILTRAR(BUSCAR(1), SIGNO() = "exacto"))       → 4   | BQL §7.11 decía 3
BQL CONTAR(FILTRAR(BUSCAR(1), SIGNO() = "completar"))    → 0   | BQL §7.11 decía 1
BQL CONTAR(FILTRAR(BUSCAR(1), FALTAS() = 1))             → 0   | BQL §7.11 decía 1
BQL CONTAR(FILTRAR(BUSCAR(1), DESPLAZAMIENTO() > 0))     → 0   | BQL §7.11 decía 1
BQL CONTAR(FILTRAR(BUSCAR(1), ACUERDO() = 10))           → 4   | BQL §7.11 decía 3

RESUMEN DE LO QUE DEMUESTRA LA SALIDA
- La dirección 1000000000 de la compra (ec0734c3) tiene 4 ocupantes: (a) propio camino [1], el array [ref→menú:1, 1, "EUR 12"]; (b) propio camino [1,0], la referencia {ref: menú, dir: 1000000000}; (c) referencia: lo que esa referencia alcanza, menú:1000000000 = ["ensalada","guiso","fruta"], con procedencia compra:1000000000#1.0 → menú:1000000000; (d) escrito: la cuenta de cocina (c7c163ae), anclada con sobre=compra, en=1000000000, con su payload entero.
- Colisionan porque direccion([1]) === direccion([1,0]) === '1000000000': los ceros finales de la dirección no distinguen «la posición 1» de «la posición 1.0» (indicesDe quita los ceros finales), así que caminosDe devuelve [[1],[1,0]]; la referencia en [1,0] arrastra su destino a la misma dirección; y la cuenta se ancló ahí por decisión del autor (`en`). Ninguno sobrescribe a otro: el payload de la compra no cambia.
- Vector y distancia: HOY los cuatro tienen vector [0,…,0], distancia [0,…,0], acuerdo 10, signo exacto, faltas 0, excedentes 0, norma 0, porque origenDir = destino = 1000000000 en los cuatro (también en el escrito). Los docs decían que el escrito venía de 0000000000 con vector [1,0,…], signo completar, acuerdo 0: eso ya no es lo que hace el código.
- Orden: como los cuatro empatan en acuerdo y distancia, el orden de encaje coincide con el de llegada: propio[1], propio[1,0], referencia, escrito.
- Escribir en la posición 2: antes 2000000000 tenía 3 ocupantes (propio[2], propio[2,0], referencia a menú:2 = ["sin gluten","vegetariano"]); tras escribir 'sin lactosa' (huesped, en=2000000000) pasa a 4, y tras un segundo escrito de cocina a 5. Todos exactos; los escritos salen al final, en orden de entrada en el eje. La posición 1 no se entera (sigue con 4) y colisiones(arbol) pasa de 2000000000:3 a 2000000000:5. Cuesta 1 minuto de T por escrito; el eje pasa de 5 a 7 eventos.
```

</details>

<details>
<summary>Dudas</summary>

- Escritos con vector cero: hoy un escrito anclado en 1000000000 sale con origenDir = destino, vector [0,…], signo exacto, acuerdo 10. Los tres documentos dicen lo contrario (origenDir '0000000000', vector [1,0,…], completar, acuerdo 0; BTML §6.1/§6.3/§6.5, MOTOR §2 y §3.3 'encaje guardado', BQL §7.4 y §7.11). ¿Cuál es la intención? Si los escritos son siempre exactos, SIGNO()/FALTAS()/DESPLAZAMIENTO() ya no distinguen nunca un escrito de un propio, y la única fuente de vectores no nulos pasan a ser las referencias.
- Signo del vector: el código devuelve origen − destino (vector('1230000000','1200000000') = [0,0,+3], reducir; vector('0000000000','4000000000') = [-4], completar), mientras BTML §6.5 define destino − origen con 'positivo = falta, negativo = sobra'. signo/faltas/excedentes siguen diciendo lo mismo con el signo invertido, así que parece un cambio deliberado de convención. ¿Cuál es la canónica? Esto conecta con la duda abierta del usuario sobre 'el número negativo' / 'la matriz negativa': hoy el signo se decide por componente y signo(v) resume el vector; no hay noción de 'vector negativo entero' distinta de 'reducir'.
- Orden a igual acuerdo: BTML §6.5 dice 'a igual acuerdo, menor distancia profundidad a profundidad'. Con la lista del propio documento, ordenarPorEncaje pone 'ref desde 7' (vector [5,0], distancia 5) por delante de 'escrito en 2' ([-2,0], distancia 2). O el desempate ya mira el signo (reducir antes que completar, o valor con signo descendente, o faltas ascendente), o hay otro criterio; no puedo saberlo sin leer src/encaje.js. Nota: en el escenario real de §6.5 el escrito ya no entra en ese desempate porque sale exacto.
- ¿La colisión [1]/[1,0] es semántica deseada ('la posición y su representación son lo mismo') o un límite técnico de la dirección de diez dígitos? BTML §4.2 lo lista como pendiente pero §6 lo trata como estado normal; para un programador externo no queda claro si debe diseñar contando con ello o esperando que cambie.
- El ocupante de origen 'referencia' lleva camino [1] (indicesDe del dir alcanzado en el OTRO evento) y evento = el menú, no la compra. Es coherente con §6.2 pero confunde: 'camino' significa cosas distintas según el origen (ruta en el foco para propios, ruta en el evento alcanzado para referencias, [] para escritos). ¿Es intencional que no haya un campo con 'por qué camino del foco llegó'? (procedencia lo da, pero como texto).
- Orden de llegada de los escritos: lo comprobé con t crecientes (15:30, 15:31) y salen en orden de entrada en el eje; no comprobé qué pasa si el segundo escrito lleva un t anterior al primero. BTML §5 dice 'en orden de entrada', así que asumo eje.orden y no t.
- rota: en ocupantes no rotos el campo viene undefined, no false (lo imprimo con ?? false). Menor, pero conviene decidir si el campo existe siempre.
- Los ids del eje de ejemplo que cita BTML.md/BQL.md (1b133344, 25ddaa89, 441d7a2b) no son los que salen (2983477b, ec0734c3, c7c163ae). MOTOR.md lo avisa (PR #18); los otros dos documentos no. Mi salida coincide con MOTOR.md.
- No comprobé si escribir con en='2000000000' exige que el foco tenga desarrollada la posición 2: la compra la tiene. BTML §5 ancla una nota en 7000000000 de una compra sin posición 7, así que deduzco que no se exige, pero no está dicho como regla.

</details>

<details>
<summary>Lo que faltó en los documentos</summary>

- Las salidas de los ejemplos sobre escritos están desactualizadas y me habrían hecho 'adivinar' mal: BTML §6.1 (tabla: escrito → origenDir '0000000000'), §6.3 (salida: escrito [1,0,…] completar 0), §6.5 (segundo ejemplo: escrito:completar:2 y el orden 'propio escrito referencia'), MOTOR §2 (descubrir: cuenta 'completar'), MOTOR §3.3 (encaje guardado con origen '0000000000', vector [1,0,…], completar), MOTOR §10 (el guiso 'reducir' con vector [0,-1,…]), BQL §7.4 (escrito → origenDir '0000000000', vector [4,0,…]) y BQL §7.11 (SIGNO()='completar' → 1, FALTAS()=1 → 1, DESPLAZAMIENTO()>0 → 1, ACUERDO()=10 → 3). Hoy dan exacto/0/0/0/4. Hay que regenerar esas salidas o explicar el cambio.
- La definición del vector en BTML §6.5 ('destino − origen', 'positivo = falta, negativo = sobra') no coincide con el código (origen − destino; positivo = sobra/reducir). Falta la regla vigente en una línea y, si se cambió a propósito, por qué (qué significa un componente negativo ahora).
- La regla 2 de ordenarPorEncaje ('a igual acuerdo, menor distancia profundidad a profundidad') no describe el orden actual (ref desde 7 antes que escrito en 2). Falta la regla real de desempate, incluido si el signo ordena (el texto dice explícitamente 'el signo no ordena').
- Una nota al principio de BTML.md y BQL.md avisando de que sus ids (1b133344…, 25ddaa89…) son anteriores a la PR #18 y hoy salen 2983477b…, ec0734c3…, c7c163ae…; solo MOTOR.md lo dice.
- Una frase explícita: 'un escrito puede anclarse en cualquier dirección del foco, exista o no esa posición en su payload'. Se deduce del ejemplo de §5 (en: '7000000000'), pero no está enunciado como regla.
- Qué significa exactamente origenDir para cada origen HOY (propio: la dirección; referencia: el dir alcanzado en el otro evento; escrito: ¿siempre igual al destino?). La tabla de §6.2 solo dice 'dirección de donde viene el contenido'.
- Que arbol(eje, id) no desciende dentro de los escritos (un escrito con payload array aparece como un único ocupante camino [] en la dirección de anclaje; sus subposiciones no generan direcciones del foco). §6.6 lo deja implícito.
- Que ocupantes recibe índices (array), no una dirección de diez dígitos; §6.2 lo muestra en la firma pero no lo dice, y BQL sí acepta ambas formas, lo que invita a confundirse.
- Cómo ejecutar desde fuera de la raíz del repo: los documentos asumen 'desde la raíz'; con import() dinámico y URLs file:/// funciona desde cualquier cwd, pero no se dice.
- El valor de rota cuando no hay rotura (undefined, no false).

</details>

### Tarea 4: el ciclo del motor con un pago de 14 EUR

<details>
<summary>Código</summary>

```js
// Archivo: <temporal>\extranjero-ciclo.mjs
// Ciclo completo del motor AGRAM sobre el eje de ejemplo, escrito solo con docs/BTML.md, docs/BQL.md y docs/MOTOR.md.
// Ejecutar: node <temporal>\extranjero-ciclo.mjs
const RAIZ_REPO = 'file:///<repo>/';
const { ejemploCompra, ejemploCuenta } = await import(RAIZ_REPO + 'ejemplos/ikisai/compra-food.mjs');
const { descubrir, consolidar, autorizar, ejecutar, puedeAutorizar, autorizacionesValidas, estadoDe, consolidaciones, FABRICA } = await import(RAIZ_REPO + 'src/motor.js');
const { evaluar } = await import(RAIZ_REPO + 'src/bql.js');

const corto = (x) => JSON.stringify(x).replace(/[0-9a-f]{64}/g, (m) => m.slice(0, 8));
const T = '2026-11-07T16:00:00Z';
const rechazo = (etiqueta, p) => p.then((ev) => console.log('  [inesperado] ' + etiqueta + ' NO fue rechazado:', ev.id.slice(0, 8)), (e) => console.log('  rechazo ' + etiqueta + ' -> ' + e.message));

// 0. Eje de ejemplo: génesis, alta, menú, compra + cuenta (cocina escribe la cuenta en la posición 1 de la compra).
const { eje, alta, menu, compra } = await ejemploCompra();
const cuenta = await ejemploCuenta(eje, compra);
console.log('== 0. Eje de ejemplo:', eje.orden.map((id) => id.slice(0, 8)).join(' '), '· registros', eje.orden.length);
console.log('   identidades', JSON.stringify(eje.identidades()), '· poderes casa', corto(eje.poderes('casa')), '· cocina', corto(eje.poderes('cocina')), '· huesped', corto(eje.poderes('huesped')));
console.log('   saldos EUR: casa', eje.saldo('casa', 'E:EUR'), 'cocina', eje.saldo('cocina', 'E:EUR'), 'huesped', eje.saldo('huesped', 'E:EUR'));

// 1. Descubrir: candidatos de las posiciones 1–4 de la compra. No escribe nada.
console.log('\n== 1. descubrir(eje, compra)');
const d = descubrir(eje, compra.id);
for (const p of d) {
  console.log('   posición', p.posicion, p.dir, p.candidatos.length, 'candidatos');
  for (const c of p.candidatos) console.log('     ' + c.origen.padEnd(11) + c.evento.slice(0, 8) + ' camino ' + JSON.stringify(c.camino) + ' · ' + c.estado + ' · ' + c.texto + ' · ' + c.signo + ' v' + JSON.stringify(c.vector.slice(0, 2)));
}
console.log('   registros tras descubrir:', eje.orden.length, '(sin efectos)');

// 2. Consolidar: la cuenta como recurso (posición 1) y un terminal nuevo en la fábrica (posición 4).
console.log('\n== 2. consolidar');
const candidatoCuenta = d[0].candidatos.find((c) => c.origen === 'escrito' && c.evento === cuenta.id);
console.log('   candidato elegido:', candidatoCuenta.origen, candidatoCuenta.evento.slice(0, 8), 'dir', candidatoCuenta.dir, 'signo', candidatoCuenta.signo, 'texto', JSON.stringify(candidatoCuenta.texto));
await rechazo('consolidar sin elecciones', consolidar(eje, { autor: 'huesped', foco: compra.id, t: T, elecciones: {} }));
await rechazo('consolidar con posición 0', consolidar(eje, { autor: 'huesped', foco: compra.id, t: T, elecciones: { 0: 'x' } }));
await rechazo('consolidar con hueco en 5', consolidar(eje, { autor: 'huesped', foco: compra.id, t: T, elecciones: { 7: 'x' } }));
const antesT = eje.saldoT('huesped', 'minuto');
const antesEUR = eje.saldo('huesped', 'E:EUR');
const cons = await consolidar(eje, {
  autor: 'huesped', foco: compra.id, t: T, titulo: 'Pago de la cuenta',
  elecciones: { 1: { candidato: candidatoCuenta }, 4: 'pagar 14 EUR a cocina' },
});
console.log('   consolidación', cons.id.slice(0, 8), '· sobre compra', cons.sobre === compra.id, '· en FABRICA', cons.en === FABRICA, '· autor', cons.autor);
console.log('   payload', corto(cons.payload));
console.log('   contexto', corto(cons.contexto));
console.log('   movimientos', corto(cons.movimientos), '· minutos T gastados', antesT - eje.saldoT('huesped', 'minuto'), '· EUR movidos', antesEUR - eje.saldo('huesped', 'E:EUR'), '(consolidar no ejecuta)');
console.log('   posiciones 2 y 3 heredadas de la compra por referencia:', corto(cons.payload[2]), corto(cons.payload[3]));
console.log('   lo que alcanza la posición 1 (BQL):', evaluar(eje, cons.id, [1]).texto, '· posición 4:', evaluar(eje, cons.id, [4]).texto);
console.log('   estado:', estadoDe(eje, cons.id));

// 3. Ejecutar antes de tiempo: debe rechazarse.
console.log('\n== 3. ejecutar antes de autorizar');
await rechazo('ejecutar pendiente', ejecutar(eje, { autor: 'huesped', consolidacion: cons.id, t: T }));

// 4. Autorizar: quién puede (regla V0: P > 0 sobre el registro y no ser el autor).
console.log('\n== 4. autorizar');
for (const i of ['casa', 'cocina', 'huesped']) console.log('   puedeAutorizar', i.padEnd(8), puedeAutorizar(eje, i, cons.id), '· poderSobre', eje.poderSobre(i, cons.id));
await rechazo('autoriza el autor (huesped)', autorizar(eje, { autorizante: 'huesped', consolidacion: cons.id, t: T }));
await rechazo('autoriza cocina sin P', autorizar(eje, { autorizante: 'cocina', consolidacion: cons.id, t: T }));
await rechazo('autorizar algo que no es consolidación', autorizar(eje, { autorizante: 'casa', consolidacion: compra.id, t: T }));
const aut = await autorizar(eje, { autorizante: 'casa', consolidacion: cons.id, t: T, nota: 'adelante' });
console.log('   autorización', aut.id.slice(0, 8), '· sobre consolidación', aut.sobre === cons.id, '· en', aut.en, '· payload', JSON.stringify(aut.payload), '· BQL lo lee como', JSON.stringify(evaluar(eje, aut.id, []).texto));
console.log('   contexto', JSON.stringify(aut.contexto), '· movimientos', JSON.stringify(aut.movimientos));
console.log('   válidas', autorizacionesValidas(eje, cons.id).length, '· estado:', estadoDe(eje, cons.id));
await rechazo('autorizar dos veces', autorizar(eje, { autorizante: 'casa', consolidacion: cons.id, t: T }));

// 5. Ejecutar: rechazos primero, luego el pago real de 14 EUR de huesped a cocina.
console.log('\n== 5. ejecutar');
await rechazo('ejecuta otro autor (casa)', ejecutar(eje, { autor: 'casa', consolidacion: cons.id, t: T }));
await rechazo('ejecuta con tokens ajenos (de: cocina)', ejecutar(eje, { autor: 'huesped', consolidacion: cons.id, t: T, movimientos: [{ token: 'E', denominacion: 'EUR', cantidad: 14, de: 'cocina', a: 'huesped' }] }));
await rechazo('ejecuta con saldo insuficiente (1000 EUR)', ejecutar(eje, { autor: 'huesped', consolidacion: cons.id, t: T, movimientos: [{ token: 'E', denominacion: 'EUR', cantidad: 1000, de: 'huesped', a: 'cocina' }] }));
console.log('   tras los rechazos el estado sigue:', estadoDe(eje, cons.id), '· registros', eje.orden.length);
const antes = { cocina: eje.saldo('cocina', 'E:EUR'), huesped: eje.saldo('huesped', 'E:EUR'), minutos: eje.saldoT('huesped', 'minuto') };
const ej = await ejecutar(eje, {
  autor: 'huesped', consolidacion: cons.id, t: T, titulo: 'Pagado',
  movimientos: [{ token: 'E', denominacion: 'EUR', cantidad: 14, de: 'huesped', a: 'cocina' }],
});
console.log('   ejecución', ej.id.slice(0, 8), '· sobre consolidación', ej.sobre === cons.id, '· en', ej.en);
console.log('   payload', corto(ej.payload));
console.log('   contexto', corto(ej.contexto));
console.log('   movimientos', corto(ej.movimientos));
console.log('   EUR cocina', antes.cocina, '->', eje.saldo('cocina', 'E:EUR'), '· EUR huesped', antes.huesped, '->', eje.saldo('huesped', 'E:EUR'), '· minutos huesped', antes.minutos, '->', eje.saldoT('huesped', 'minuto'));
await rechazo('ejecutar dos veces', ejecutar(eje, { autor: 'huesped', consolidacion: cons.id, t: T }));

// 6. Estado y evidencia.
console.log('\n== 6. estado y evidencia');
console.log('   estadoDe:', estadoDe(eje, cons.id));
console.log('   evidencia:', corto(ej.contexto.evidencia), '· [0] es la consolidación', ej.contexto.evidencia[0] === cons.id, '· [1] es la autorización', ej.contexto.evidencia[1] === aut.id);
console.log('   payload[1].ref -> consolidación', ej.payload[1].ref === cons.id, '· payload[2].ref -> autorización', ej.payload[2].ref === aut.id);
console.log('   hilo de la ejecución:', eje.hilo(ej.id).map((x) => x.autor + ':' + x.id.slice(0, 8)).join(' -> '));
console.log('   consolidaciones de la compra:', corto(consolidaciones(eje, compra.id)));
console.log('   escritos en la fábrica de la consolidación:', eje.sobre(cons.id, FABRICA).map((x) => x.contexto.fase + ':' + x.autor).join(' · '));
console.log('   fuentes de la consolidación:', corto(cons.contexto.fuentes), '= cuenta', cons.contexto.fuentes[0] === cuenta.id);
console.log('   registros finales', eje.orden.length, ':', eje.orden.map((id) => id.slice(0, 8)).join(' '));

// ---------------------------------------------------------------------------
// Archivo auxiliar: <temporal>\extranjero-check.mjs
// Comprobación extra tras ver que el candidato «escrito» salía «exacto» y no «completar» como dicen los docs.
const R = 'file:///<repo>/';
const { ejemploCompra: ec, ejemploCuenta: ecu } = await import(R + 'ejemplos/ikisai/compra-food.mjs');
const { ocupantes } = await import(R + 'src/encaje.js');
const { consultar } = await import(R + 'src/bql.js');
{
  const { eje, compra } = await ec();
  await ecu(eje, compra);
  console.log('saldo P casa:', eje.saldo('casa', 'P'), '· P:genesis:', eje.saldo('casa', 'P:genesis'));
  for (const o of ocupantes(eje, compra.id, [1])) console.log('ocupante', o.origen, o.evento.slice(0,8), 'origenDir', o.origenDir, 'destino', o.destino, JSON.stringify(o.vector.slice(0,2)), o.signo, 'acuerdo', o.acuerdo);
  for (const f of ['CONTAR(FILTRAR(BUSCAR(1), SIGNO() = "completar"))', 'CONTAR(FILTRAR(BUSCAR(1), FALTAS() = 1))', 'CONTAR(FILTRAR(BUSCAR(1), DESPLAZAMIENTO() > 0))', 'CONTAR(FILTRAR(BUSCAR(1), ACUERDO() = 10))']) console.log(f, '->', consultar(eje, compra.id, [1], f).texto);
  const Tm = { token: 'T', escala: 'minuto', cantidad: 1, de: 'casa', a: null };
  const plan = await eje.escribir({ autor: 'casa', sobre: compra.id, t: '2026-11-07T16:00:00Z', movimientos: [Tm], payload: ['Plan', 'a', 'b', 'c', 'd', 'e', 'f', 'cena'] });
  const x = await eje.escribir({ autor: 'casa', sobre: compra.id, t: '2026-11-07T16:00:00Z', movimientos: [Tm], payload: ['X', 'r', { ref: plan.id, dir: '7000000000' }] });
  await eje.escribir({ autor: 'casa', sobre: x.id, en: '2000000000', t: '2026-11-07T16:00:00Z', movimientos: [Tm], payload: 'criterio escrito' });
  const f = (o) => o.origen + ':' + o.signo + ':' + o.vector[0];
  console.log('BTML 6.5 llegada:', ocupantes(eje, x.id, [2], { orden: 'llegada' }).map(f).join(' '));
  console.log('BTML 6.5 encaje: ', ocupantes(eje, x.id, [2]).map(f).join(' '));
}
```

</details>

<details>
<summary>Salida</summary>

```text
$ node --version
v24.14.1
$ node <temporal>\extranjero-ciclo.mjs
== 0. Eje de ejemplo: 2983477b 240c6005 579144c6 ec0734c3 c7c163ae · registros 5
   identidades ["casa","cocina","huesped"] · poderes casa [{"ambito":"genesis","cantidad":10}] · cocina [] · huesped []
   saldos EUR: casa 440 cocina 12 huesped 48

== 1. descubrir(eje, compra)
   posición 1 1000000000 4 candidatos
     propio     ec0734c3 camino [1] · RESUELTO · → 579144c6 · exacto v[0,0]
     propio     ec0734c3 camino [1,0] · RESUELTO · → 579144c6 · exacto v[0,0]
     referencia 579144c6 camino [1] · RESUELTO · ensalada · exacto v[0,0]
     escrito    c7c163ae camino [] · RESUELTO · Cuenta del menú · exacto v[0,0]
   posición 2 2000000000 3 candidatos
     propio     ec0734c3 camino [2] · RESUELTO · → 579144c6 · exacto v[0,0]
     propio     ec0734c3 camino [2,0] · RESUELTO · → 579144c6 · exacto v[0,0]
     referencia 579144c6 camino [2] · RESUELTO · sin gluten · exacto v[0,0]
   posición 3 3000000000 2 candidatos
     propio     ec0734c3 camino [3] · RESUELTO · huesped · exacto v[0,0]
     propio     ec0734c3 camino [3,0] · RESUELTO · huesped · exacto v[0,0]
   posición 4 4000000000 2 candidatos
     propio     ec0734c3 camino [4] · RESUELTO · pagar · exacto v[0,0]
     propio     ec0734c3 camino [4,0] · RESUELTO · pagar · exacto v[0,0]
   registros tras descubrir: 5 (sin efectos)

== 2. consolidar
   candidato elegido: escrito c7c163ae dir 0000000000 signo exacto texto "Cuenta del menú"
  rechazo consolidar sin elecciones -> nada que consolidar
  rechazo consolidar con posición 0 -> las elecciones van en posiciones 1–9
  rechazo consolidar con hueco en 5 -> hueco en 5: elige algo o quita las posiciones siguientes
   consolidación 1f021b97 · sobre compra true · en FABRICA true · autor huesped
   payload ["Pago de la cuenta",{"ref":"c7c163ae","dir":"0000000000"},{"ref":"ec0734c3","dir":"2000000000"},{"ref":"ec0734c3","dir":"3000000000"},"pagar 14 EUR a cocina"]
   contexto {"motor":"fabrica","fase":"consolidado","fuentes":["c7c163ae"],"encaje":[{"posicion":1,"evento":"c7c163ae","tipo":"escrito","origen":"1000000000","destino":"1000000000","vector":[0,0,0,0,0,0,0,0,0,0],"signo":"exacto"}],"modo":"mapped"}
   movimientos [{"token":"T","escala":"minuto","cantidad":5,"de":"huesped","a":null}] · minutos T gastados 5 · EUR movidos 0 (consolidar no ejecuta)
   posiciones 2 y 3 heredadas de la compra por referencia: {"ref":"ec0734c3","dir":"2000000000"} {"ref":"ec0734c3","dir":"3000000000"}
   lo que alcanza la posición 1 (BQL): → c7c163ae · posición 4: pagar 14 EUR a cocina
   estado: PENDIENTE DE AUTORIZACIÓN

== 3. ejecutar antes de autorizar
  rechazo ejecutar pendiente -> PENDIENTE DE AUTORIZACIÓN

== 4. autorizar
   puedeAutorizar casa     true · poderSobre 10
   puedeAutorizar cocina   false · poderSobre 0
   puedeAutorizar huesped  false · poderSobre 0
  rechazo autoriza el autor (huesped) -> el autor no se autoriza a sí mismo
  rechazo autoriza cocina sin P -> cocina no tiene poder (P) sobre este registro
  rechazo autorizar algo que no es consolidación -> no es una consolidación: ec0734c3
   autorización 450e0f00 · sobre consolidación true · en 4000000000 · payload "==adelante" · BQL lo lee como "=adelante"
   contexto {"motor":"fabrica","fase":"autorizado","modo":"pointed"} · movimientos [{"token":"T","escala":"minuto","cantidad":1,"de":"casa","a":null}]
   válidas 1 · estado: AUTORIZADO
  rechazo autorizar dos veces -> ya está autorizado

== 5. ejecutar
  rechazo ejecuta otro autor (casa) -> ejecuta el autor de la consolidación: huesped
  rechazo ejecuta con tokens ajenos (de: cocina) -> evento rechazado: nadie mueve tokens ajenos: cocina no es el autor
  rechazo ejecuta con saldo insuficiente (1000 EUR) -> evento rechazado: saldo insuficiente de E:EUR en huesped
   tras los rechazos el estado sigue: AUTORIZADO · registros 7
   ejecución 009e27d6 · sobre consolidación true · en 4000000000
   payload ["Pagado",{"ref":"1f021b97"},{"ref":"450e0f00"}]
   contexto {"motor":"fabrica","fase":"ejecutado","evidencia":["1f021b97","450e0f00"]}
   movimientos [{"token":"T","escala":"minuto","cantidad":1,"de":"huesped","a":null},{"token":"E","denominacion":"EUR","cantidad":14,"de":"huesped","a":"cocina"}]
   EUR cocina 12 -> 26 · EUR huesped 48 -> 34 · minutos huesped 1375 -> 1374
  rechazo ejecutar dos veces -> ya ejecutado

== 6. estado y evidencia
   estadoDe: EJECUTADO
   evidencia: ["1f021b97","450e0f00"] · [0] es la consolidación true · [1] es la autorización true
   payload[1].ref -> consolidación true · payload[2].ref -> autorización true
   hilo de la ejecución: huesped:009e27d6 -> huesped:1f021b97 -> huesped:ec0734c3 -> cocina:579144c6 -> casa:240c6005 -> casa:2983477b
   consolidaciones de la compra: [{"id":"1f021b97","autor":"huesped","t":"2026-11-07T16:00:00Z","titulo":"Pago de la cuenta","estado":"EJECUTADO","fuentes":["c7c163ae"]}]
   escritos en la fábrica de la consolidación: autorizado:casa · ejecutado:huesped
   fuentes de la consolidación: ["c7c163ae"] = cuenta true
   registros finales 8 : 2983477b 240c6005 579144c6 ec0734c3 c7c163ae 1f021b97 450e0f00 009e27d6

$ node <temporal>\extranjero-check.mjs
saldo P casa: 0 · P:genesis: 10
ocupante propio ec0734c3 origenDir 1000000000 destino 1000000000 [0,0] exacto acuerdo 10
ocupante propio ec0734c3 origenDir 1000000000 destino 1000000000 [0,0] exacto acuerdo 10
ocupante referencia 579144c6 origenDir 1000000000 destino 1000000000 [0,0] exacto acuerdo 10
ocupante escrito c7c163ae origenDir 1000000000 destino 1000000000 [0,0] exacto acuerdo 10
CONTAR(FILTRAR(BUSCAR(1), SIGNO() = "completar")) -> 0
CONTAR(FILTRAR(BUSCAR(1), FALTAS() = 1)) -> 0
CONTAR(FILTRAR(BUSCAR(1), DESPLAZAMIENTO() > 0)) -> 0
CONTAR(FILTRAR(BUSCAR(1), ACUERDO() = 10)) -> 4
BTML 6.5 llegada: propio:exacto:0 referencia:reducir:5 escrito:exacto:0
BTML 6.5 encaje:  propio:exacto:0 escrito:exacto:0 referencia:reducir:5

EXPLICACIÓN DE CADA RECHAZO (todos provocados a propósito; ninguno dejó rastro en el eje: los registros pasan de 5 a 8 solo por consolidación, autorización y ejecución):
- «nada que consolidar»: elecciones vacío (MOTOR §3.4).
- «las elecciones van en posiciones 1–9»: clave 0 (la representación no se elige).
- «hueco en 5: elige algo o quita las posiciones siguientes»: elegí la 7 sola; las 1–4 se heredan de la compra porque tienen ocupantes, pero la compra no tiene posición 5 y no hay nada con qué rellenarla.
- «PENDIENTE DE AUTORIZACIÓN» (al ejecutar antes de autorizar): ejecutar exige estado AUTORIZADO; el mensaje es el estado a secas, sin prefijo.
- «el autor no se autoriza a sí mismo»: huesped consolidó, no puede autorizar (regla V0).
- «cocina no tiene poder (P) sobre este registro»: cocina nunca recibió P (poderSobre = 0); solo podría si casa le delegara P con ámbito el menú o la compra.
- «no es una consolidación: ec0734c3»: intenté autorizar la compra, que no tiene fase 'consolidado'.
- «ya está autorizado»: segunda autorización de casa sobre la misma consolidación; solo se escribe si está pendiente.
- «ejecuta el autor de la consolidación: huesped»: casa intentó ejecutar.
- «evento rechazado: nadie mueve tokens ajenos: cocina no es el autor»: movimiento con de: 'cocina' firmado por huesped; lo rechaza el eje, no el motor, y el evento entero se descarta.
- «evento rechazado: saldo insuficiente de E:EUR en huesped»: 1000 EUR con 48 de saldo.
- «ya ejecutado»: segunda ejecución.
```

</details>

<details>
<summary>Dudas</summary>

- Vector de encaje de los escritos: los tres documentos dicen que un hijo escrito en 1000000000 viene de la raíz (origenDir '0000000000', vector [1,0,…], signo 'completar', faltas 1; BTML §6.2, §6.3, §6.5; BQL §7.4, §7.11; MOTOR §2, §3.3). El código da origenDir = destino, vector todo ceros y 'exacto'. ¿Cuál es la verdad? Si es el código, SIGNO()/FALTAS()/DESPLAZAMIENTO() ya no distinguen un escrito de un propio y el encaje guardado en contexto.encaje de la consolidación es siempre 'exacto' para escritos; si son los docs, hay una regresión en encaje.js.
- Signo del vector de las referencias: BTML §6.5 dice vector = destino − origen (una referencia a 7 colocada en 2 da [-5,…], 'reducir' = solo negativos). El código da +5 con signo 'reducir'. O la resta cambió a origen − destino y las etiquetas no, o 'reducir' ya no significa 'solo negativos'. Esto conecta con la duda del usuario sobre «el número negativo» / «la matriz negativa»: hoy el signo por componente y la etiqueta del vector dicen cosas contrarias, así que no se puede razonar sobre orientación con lo que hay.
- Incoherencia dentro de la consolidación: payload[1] guarda { ref: cuenta, dir: '0000000000' } (el payload entero de la cuenta) pero contexto.encaje[0].origen dice '1000000000'. El dato referenciado y el origen declarado del encaje no coinciden. ¿Cuál debería usar quien lea la consolidación después?
- ¿La «identidad adecuada» para autorizar es casa (único P del eje de ejemplo, ámbito genesis) o debería ser cocina (quien cobra) previa delegación de P con ámbito? Elegí casa porque el eje de ejemplo no tiene delegación; mostré que cocina es rechazada y por qué. No sé cuál es la intención de producto.
- El rechazo de ejecutar sobre una consolidación pendiente lanza literalmente 'PENDIENTE DE AUTORIZACIÓN' sin prefijo ('no se puede ejecutar: …'). Como mensaje de error es ambiguo frente a estadoDe(), que devuelve la misma cadena como valor normal. ¿Es intencional?
- La nota de autorizar se guarda siempre como '==adelante' y BQL la lee como '=adelante' (MOTOR §13.1). ¿Alguna vista debe mostrar la nota? Si sí, hoy siempre lleva un '=' delante.
- Posición 1 de la consolidación: evaluar(cons, [1]) da '→ c7c163ae' (referencia sin seguir), mientras que descubrir mostraba 'Cuenta del menú' para el mismo candidato. Para una vista «lo elegido fue X» hay que saber que evaluar no sigue referencias y usar LOCAL/REF o encaje.seguir; no es obvio sin leer BQL §3 con cuidado.
- costeT: la consolidación costó 5 minutos aunque solo tecleé dos cosas (título y la 4); el candidato y las dos heredadas cuentan igual (MOTOR §13.12). ¿Es el comportamiento deseado para el usuario que paga T?
- Candidatos 'propio [1]' y 'propio [1,0]' aparecen siempre duplicados en descubrir por la colisión de ceros finales. Para una interfaz, ¿se muestran los dos o se deduplican? El documento lo explica, pero no dice qué hacer con ello.

</details>

<details>
<summary>Lo que faltó en los documentos</summary>

- Los documentos están desactualizados respecto al código en el encaje de los ocupantes: escritos ya no son 'completar' y el signo de las referencias sale positivo. Afecta a los ejemplos ejecutables de BTML §6.3 y §6.5, BQL §7.4/§7.11 y MOTOR §2/§3.3, que ya no dan la salida impresa. Un programador nuevo que compare salida real con el documento concluye que algo está roto sin saber qué lado.
- Cómo se importa desde fuera del repositorio: los docs solo muestran node --input-type=module -e desde la raíz con rutas relativas. Tuve que adivinar que import() con URL file:/// absoluta funciona en Windows (funciona). Faltan una línea sobre importar por URL absoluta y el package.json/entry point (¿hay 'type': 'module'? ¿src/index.js es el punto de entrada recomendado?).
- eje.poderes(identidad) y eje.poderSobre(identidad, registro) se usan en MOTOR §4.1 pero no están en la API mínima de BTML §10 (la clase Eje allí no los lista) ni se explica la forma de 'ambito' del token P ('genesis' | id de registro) ni que la clave de saldo pasa a ser 'P:genesis' (saldo('casa','P') = 0 aunque el génesis emita 10 P). BTML §2.1/§2.2 y §8 aún muestran { token: 'P', cantidad: 10 } sin ámbito y claves 'P' o 'P:<denominacion>'. Hay que leer MOTOR para enterarse de que BTML está anticuado en esto (la nota de PR #18 lo insinúa pero no lo describe).
- ejemplos/ikisai/compra-food.mjs: no se documenta su firma completa ni sus ids actuales en BTML (BTML cita 1b133344…; MOTOR cita 2983477b…; la salida real es la de MOTOR). Faltó decir en BTML §9 que los ids de esa tabla no son los actuales.
- Qué devuelve consolidar como 'dir' de un candidato escrito: la tabla de MOTOR §3.2 dice { ref: candidato.evento, dir: candidato.dir ?? '0000000000' }, y BTML §6.2 dice que un escrito tiene dir '0000000000'; correcto, pero no se dice que entonces contexto.encaje[k].origen no es ese dir sino el destino. Falta una frase que fije qué significa 'origen' en encaje para escritos.
- El orden de comprobación de ejecutar y el texto exacto de sus errores: la tabla de MOTOR §5 lista 'PENDIENTE DE AUTORIZACIÓN' como mensaje, pero no deja claro que es el mensaje literal sin prefijo; lo confirmé ejecutando.
- Para 'mostrar la evidencia' faltó un ejemplo de lectura: cómo recorrer ej.payload[1]/[2] (referencias) y contexto.evidencia hacia atrás, y que el hilo de la ejecución pasa por la consolidación (no por la autorización, que es hermana en la fábrica). Lo deduje de los ejemplos; una frase lo habría evitado.
- Cómo listar lo escrito en la fábrica de una consolidación para auditar (eje.sobre(cons.id, FABRICA)) y distinguir válidos de ruido: está en MOTOR §4.2 por partes, pero no hay una receta de 'mostrar estado y evidencia' de una consolidación.
- El rol de 'descubrir' para un candidato escrito: caminoVisible devuelve [0] y texto 'Cuenta del menú', pero el candidato elegido se guarda como referencia a '0000000000' (todo el payload). Faltó decir que lo visible (PV0) y lo referenciado (el registro entero) no coinciden por diseño.

</details>
