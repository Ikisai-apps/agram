# Prueba del extranjero

Dos rondas. La primera (cuatro tareas: reserva con fórmulas, cinco consultas BQL, ocupantes de una dirección, ciclo del motor) ocupa las secciones 1–7 y su anexo. La **ronda 2** (cinco tareas nuevas: plazas como serie limitada, poder con ámbito, reputación a una cosa, Mapped con lo lejano anclado, BQL por orden de llegada) va al final, con su propio anexo.

Nota de resultados · 7-11-2026 · Base: `main` en `8d73b44` (PR #30), Node 24.14.1. Rebasada después sobre `main` en `95e5396` (PR #41, con las series de tokens de la PR #35): las correcciones de los documentos, los ids y el ejemplo de la reserva (§2) están al día de las series; el anexo conserva lo que dio `8d73b44`. La prueba la propuso el mapa (§12, «Idea de fondo»): **un agente sin corpus, solo con las reglas y la gramática, escribe registros y fórmulas correctas.** Aquí el «extranjero» solo leyó `docs/BTML.md`, `docs/BQL.md` y `docs/MOTOR.md`; ni `src/`, ni `test/`, ni el mapa, ni el corpus. Después un conocedor del proyecto (que sí leyó `src/` y el mapa) calificó cada intento. Lo que es interpretación del calificador va marcado «lectura del calificador»; lo que falta por decidir, «[X] decidir VG».

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
- **Posiciones 5 y 6 rellenadas para poder usar la 7.** Válido (un array no admite huecos), pero no según la regla: el mapa (§12, «Posiciones sin contenido», 7-11) decide prefijo denso y sin «no aplicable», con las celdas sin cambio como **referencia al foco** (`{ ref: foco, dir }`, lo que ya hacen `desdeMapped` y `consolidar`) y lo lejano por anclaje. El extranjero puso otra cosa (la disponibilidad entera y el alta). Con las noches en el 7 (decisión de VG) esto pasará en toda reserva; el ejemplo de abajo sigue la regla.
- Cobró 16 minutos de T (uno por posición) escribiendo con `eje.escribir`; no hacía falta (el eje solo exige mover algo de T). Ahora lo dice `docs/BTML.md` §2.3.

La reserva con el anclaje decidido por VG (ejecutable desde la raíz con `node --input-type=module < archivo.mjs`; la fórmula del total en la 4 es elección del calificador, [X]; 5 y 6 son referencias al foco con el camino del anclaje, como en `consolidar`; con las series de la PR #35: E con emisor y minutos para escribir; puesto al día el 7-11 noche: el génesis lo emite una persona (PR #62), sin clave solo como demostración (`demostracion: true`), y cada plaza es una décupla con el 0 envuelto, VG «por hojas»):

```js
import { Eje, encaje, bql } from './src/index.js';
const t = '2026-11-07T10:00:00Z';
const gasta = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });
const eje = await Eje.genesis({ demostracion: true, identidad: 'casa', emision: [{ token: 'R', cantidad: 5 }, { token: 'P', cantidad: 5, ambito: 'genesis' }, { token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 1000 }], foco: 'Casa', t });
// Ana y bea escriben su propia alta (VG, 10-11, B1: son personas); T no cruza de persona (VG, 7-11 noche): reciben
// euros y escriben con su asignación de T del día (VG, 8-11).
for (const id of ['ana', 'bea']) await eje.entrar({ identidad: id, t });
const alta = await eje.escribir({ autor: 'casa', sobre: eje.genesisId, t, movimientos: [gasta('casa'), { token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 300, de: 'casa', a: 'ana' }, { token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 300, de: 'casa', a: 'bea' }], payload: ['Altas', ['ana', 'bea']] });
const disp = await eje.escribir({ autor: 'casa', sobre: alta.id, t, movimientos: [gasta('casa')], payload: ['Disponibilidad 14-16 nov', ['Habitaciones', [['doble'], '80 EUR'], [['individual'], '50 EUR']]] });
const reserva = (quien, noches) => eje.escribir({
  autor: quien, sobre: disp.id, en: '1100000000', t, movimientos: [gasta(quien)],
  payload: ['Reserva de ' + quien, [{ ref: disp.id, dir: '1110000000' }], 'sin mascotas', [quien, 'casa'], '=LOCAL(1, 0) * LOCAL(7) + LOCAL(7) * 24 h', { ref: disp.id, dir: '1150000000' }, { ref: disp.id, dir: '1160000000' }, noches],
});
const ra = await reserva('ana', 2);
const rb = await reserva('bea', 3);
console.log('plaza 1.1:', encaje.ocupantes(eje, disp.id, [1, 1]).map((o) => o.origen + (o.autor ? ' ' + o.autor : ' ' + JSON.stringify(o.camino))).join(' · '));
console.log('reservas en la plaza:', encaje.ocupantes(eje, disp.id, [1, 1]).filter((o) => o.origen === 'escrito').length);
console.log('total ana:', bql.evaluar(eje, ra.id, [4]).texto, '· total bea:', bql.evaluar(eje, rb.id, [4]).texto);
```

```text
plaza 1.1: propio [1,1] · propio [1,1,0] · escrito ana · escrito bea
reservas en la plaza: 2
total ana: 160 EUR + 48 h · total bea: 240 EUR + 72 h
```

Las dos reservas colisionan en la plaza y se cuentan desde la disponibilidad con una fórmula de profundidad 1 (anfitrión `[1]`, `BUSCAR(1)` = la plaza 1.1). La capacidad como serie limitada de tokens E (MAPA §12, «Capacidad y tokens casan») ya se puede emitir desde la PR #35 (`docs/BTML.md` §2.4: la casa emite `E:casa/cama@<noche>`, un token por plaza y noche); este ejemplo no la usa: las reservas colisionan y se cuentan, pero no mueven plazas.

## 3. Tarea 2: cinco consultas BQL

**Enunciado.** Sobre `ejemploCompra`: contar candidatos de la posición 4, sumar solo escritos, elegir el de mayor acuerdo, componer precio con 20 min, una PENDIENTE a propósito.

| Consulta | Fórmula del extranjero (slot `4000000000` de la compra) | Eje de ejemplo tal cual | Con tres propinas escritas en la 4 |
|---|---|---|---|
| 1 | `CONTAR(BUSCAR(4))` | `2` | `5` |
| 2 | `SUMAR(FILTRAR(BUSCAR(4), ORIGEN() = "escrito"))` | `0` | `8 EUR (2 EUR + 5 EUR + 1 EUR)` |
| 3 | `ELEGIR(ORDENAR(BUSCAR(4), ACUERDO(), "desc"))` | `1 candidato: propio f9e59d1e` | `1 candidato: propio f9e59d1e` |
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

**Calificación del conocedor.** Correcto, y el más riguroso con los rechazos. Reparo: el importe está **tecleado** dos veces (en la acción y en el movimiento) cuando la cuenta ya lo calcula (`=REF("f9e59d1e", "1200000000") + 2 EUR` → `14 EUR`). El motor no compara el texto consolidado con lo que se ejecuta (ahora `docs/MOTOR.md` §13.18). La pieza que lo habría llevado a derivarlo, `proponer` (operador B, PR #26), no estaba en `docs/MOTOR.md` porque el documento se escribió sobre una base anterior; ahora está en §2.1, con el ciclo completo sobre la cuenta y el pago tomado de la fórmula. Sus dudas, fundadas: `contexto.encaje[k].origen` de un escrito (`1000000000`) no coincide con el `dir` de la referencia guardada (`0000000000`) — son cosas distintas y ahora se dice (`docs/MOTOR.md` §3.2); el error de `ejecutar` sin autorizar es el nombre del estado a secas (§13.17); `evaluar` no sigue la referencia de la consolidación y `descubrir` sí muestra su texto.

## 5. Hallazgos sobre el lenguaje

### 5.1 Ambigüedades

1. **La colisión por ceros cuenta doble.** `CONTAR(BUSCAR(4))` es `2` en una compra sin escritos: el array `['pagar', 'servir']` y su posición 0 `'pagar'`. `descubrir` lista `[1]` y `[1, 0]` como dos candidatos que muestran lo mismo. Es lo decidido para la dirección («colisiones, no apaños»: `4000000000` nombra a la vez la 4 y la 4.0), pero para quien pregunta «cuántos candidatos hay» sorprende. El mapa ya lo resuelve (§12, «BUSCAR por dirección y por índice», 7-11): con un número, `BUSCAR` es índice (camino exacto, relativo al anfitrión); con un texto de diez dígitos, dirección (la colisión entera). Cuando se escribió esta nota `BUSCAR` solo admitía índices y devolvía la colisión entera; lo implementó después la #36 (integración 7-11): `CONTAR(BUSCAR(4))` da `1` y `CONTAR(BUSCAR("4000000000"))`, `2` (`docs/BQL.md` §7.4).
2. **En la época 0 casi todo empata.** Propios y escritos son siempre exactos; solo una referencia que alcanza otra dirección tiene acuerdo menor que 10. Así `ACUERDO()`, `SIGNO()`, `FALTAS()` y `DESPLAZAMIENTO()` dan casi siempre 10 / exacto / 0 / 0, y el orden de una posición es, en la práctica, el de llegada. Es coherente con la opción B (MAPA §12), pero conviene que VG sepa que hoy esas funciones apenas discriminan con datos reales.
3. **`"desc"`.** El documento decía «invierte»; el código invierte el comparador con orden estable (los empates conservan el orden de entrada). El extranjero tuvo que ejecutar para saberlo. Corregido en `docs/BQL.md` §7.7.
4. **Alcance de una fórmula.** Solo ve su décupla anfitriona: desde `[1, 3]` no se puede leer `[7]` ni `[1]` del mismo registro, porque no hay `LOCAL` absoluto y `REF` al propio registro es imposible (su id es el hash del payload que contiene la fórmula). Esto decide dónde puede vivir un total. Cuando se escribió esta nota no había lectura absoluta dentro del propio registro; la da ahora `BUSCAR` por dirección (decidido, MAPA §12: un texto de diez dígitos es dirección absoluta en el registro), que implementó la #36 (integración 7-11): desde `[1, 3]`, `BUSCAR("7000000000")` devuelve la colisión entera de la 7 del registro (`docs/BQL.md` §7.1 y §7.4). `LOCAL`, `BUSCAR` por índice y `ACTUAL(pv)` siguen viendo solo la décupla anfitriona. [X] decidir VG si `LOCAL` y `ACTUAL` admiten también una dirección o basta `BUSCAR`.
5. **Qué va en las posiciones intermedias** cuando se necesita una posterior (5 y 6 para usar la 7). Decidido por el mapa (§12, «Posiciones sin contenido», 7-11): prefijo denso, sin «no aplicable»; las celdas sin cambio son referencia al foco y lo lejano va por anclaje. Lo que faltaba era decirlo en los documentos (§2).

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
| `evaluar` no sigue la referencia de un slot literal; `LOCAL`, `REF` y `ACTUAL` sí | `evaluar(consolidación, [1])` da `→ c70bfa6e` y `descubrir` da «Cuenta del menú» | ya documentado (BQL §3, §12.7) |
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
| BTML, BQL (todas las salidas) | ids `1b133344`, `2a2a06e3`, `37c58bd2`, `25ddaa89`, `441d7a2b` | ids actuales tras la PR #35 (`6c1c5968`, `ccf5a120`, `4598f23e`, `f9e59d1e`, `c70bfa6e`) y aviso de no copiarlos en código |
| BTML §2.1, §2.2, §7.1, §8, §9, §10 | P con clave `'P'` o `'P:<denominacion>'`; génesis con `{ token: 'P', cantidad: 10 }` | P con ámbito obligatorio (`'P:genesis'`, `'P:<id>'`), R con emisor; `eje.poderes`, `eje.poderSobre`, `eje.reputaciones`, `AMBITO_GENESIS`. Tras rebasar, en §2 manda la reescritura de la PR #35 (series de tokens: T por escala, E con emisor); esta PR solo añade a §2.3 que `eje.escribir` exige mover algo de T y que el minuto por posición es de `escribirDesde` y del motor |
| BTML §1.5 | «1 recursos (qué, cuánto, a qué precio)» | la lectura de la época 0 en profundidad 1 y el aviso de que esa glosa es léxico humano |
| BTML §0 | `src/index.js` «(entre otros)» | la lista completa, el cruce `escritura`/`salida`, cómo importar desde fuera de la raíz y cómo ejecutar en PowerShell |
| BTML §5 | sin criterio para `en` | `en` puede ser cualquier dirección; orden de los escritos por entrada; el anclaje de la reserva decidido por VG |
| BTML §9 | — | qué hay en la posición 4 del ejemplo (solo los dos propios) |
| BQL §3, §5, §7.1, §7.10, §11, §12 | — | asimetría `'EUR 12'`; unidades como etiquetas; `desglose` siempre; `1 candidato`; alcance de una fórmula; `consultar` y ciclos; suma vacía; `BUSCAR` por dirección decidido y no implementado |
| MOTOR §0, §1, §2.1, §11, §13 | sin `proponer` | `proponer` y `OPERADORES` con un ejemplo que paga lo que calcula la fórmula; defectos 16–18 |

Tras las correcciones, los 31 ejemplos ejecutables con salida y los dos ejemplos completos dan exactamente la salida escrita (comprobado ejecutándolos todos desde la raíz).

**Propuesta del calificador (no aplicada).** Una prueba que ejecute los ejemplos de `docs/*.md` y compare con la salida escrita habría avisado en cada una de las PR #26–#29. Es una herramienta, no una regla del lenguaje; [X] decidir VG si se añade a `test/`.

**Solape con la PR #35 (fusionada antes que esta).** Reescribió `docs/BTML.md` §2 (series de tokens) y volvió a cambiar los ids del ejemplo. Al rebasar sobre `main` (#41) quedaron de la #35 su §2, sus ids y su API de saldos (`T:minuto`, `E:casa/EUR`, `eje.tiempos`, `eje.recursos`, `eje.series`); de esta PR, el resto (encaje, §5, §6, BQL, MOTOR), con el ejemplo de `proponer` (MOTOR §2.1) y la reserva de §2 pasados a las series (E con emisor, minutos para escribir). Se volvieron a ejecutar los 31 ejemplos y los dos ejemplos completos sobre `95e5396`: dan la salida escrita.

## 7. [X] decidir VG, en una lista

Solo lo que el mapa no decide. Dos puntos de la primera versión de esta nota ya los decide el mapa (§12, 7-11): qué va en las posiciones intermedias (prefijo denso, sin «no aplicable», celdas sin cambio = referencia al foco, lo lejano por anclaje) y si `CONTAR` agrupa una posición con su posición 0 (`BUSCAR` con número es índice, camino exacto; con texto de diez dígitos es dirección, la colisión entera; implementado en la #36).

1. Dónde vive un total calculado de un registro (1.k, 2, 4…).
2. Si `LOCAL` y `ACTUAL` admiten también una dirección absoluta dentro del propio registro, o basta `BUSCAR` por dirección (ya decidido).
3. Si las unidades de BQL deben ligarse a las series de tokens.
4. Qué une el texto de la acción consolidada con los movimientos de la ejecución (¿AARPIA?).
5. Si `proponer` debe guardar una magnitud como magnitud (`'14 EUR'`) y no como su texto con desglose.
6. Si el ejemplo de la compra debe reordenar su posición 1 según la época 0 o conservar la glosa como comentario.
7. Si se añade a `test/` una prueba que ejecute los ejemplos de los documentos.

## Anexo: los cuatro intentos tal como se entregaron

Código, salida, dudas y lo que les faltó en los documentos, sin editar salvo las rutas locales (`file:///<repo>/` en lugar de la ruta del repositorio en la máquina). Los ids y los mensajes son los que dio `main` en `8d73b44`. Las secciones de los documentos que citan («BTML §6.5 decía…») son las de su versión anterior a esta PR.

**Contra `main` en `7090c8c` (7-11, noche)**, con `<repo>` sustituido por el repositorio, los cuatro scripts dan esto. El anexo no se reescribe: es el registro de lo que entregaron. Los ids del ejemplo son hoy génesis `6c1c5968`, alta `ccf5a120`, menú `4598f23e`, compra `f9e59d1e` y cuenta `c70bfa6e` (antes `2983477b`, `240c6005`, `579144c6`, `ec0734c3` y `c7c163ae`).

| Script | ¿Corre? | Qué cambia |
|---|---|---|
| Tarea 1, `extranjero-reserva.mjs` | **no**: para en el alta con `evento mal formado: movimiento 2: E exige emisor: la serie es de quien la emite` | Las series de tokens (PR #35): E lleva emisor. La versión corregida de §2 sí corre y da su salida. |
| Tarea 2, `extranjero-formulas.mjs` | sí | `CONTAR(BUSCAR(4))` da 1 (antes 2) sin propinas y 4 (antes 5) con ellas: un número en `BUSCAR` es el camino exacto, y la 4.0 ya no entra (mapa §12 [D]). Lo demás, igual. |
| Tarea 3, `extranjero-direccion.mjs` | sí | Desde la compra, `BUSCAR(1)` filtrado por `SIGNO() = "exacto"` o `ACUERDO() = 10` da 2 (antes 4): el camino exacto `[1]` y la cuenta escrita. Los minutos de la persona huésped son 480 → 479 (antes 1380 → 1379): minutos y horas son series distintas. El «resumen de lo que demuestra la salida» del final es texto del extranjero, no salida del script. Lo demás, igual con los ids nuevos. |
| Tarea 4, `extranjero-ciclo.mjs` | **no**: llega a la autorización y para al ejecutar con `evento mal formado: movimiento 1: E exige emisor: la serie es de quien la emite` | Las series de tokens: el pago necesita `emisor: 'casa'` y los saldos se leen en `E:casa/EUR` (el script lee `E:EUR`, que hoy da 0). La autorización lleva además `contexto.autoridad` con la regla V0 declarada. |

Los ejemplos ejecutables de esta nota que no son del anexo (el de §2) se comprueban con `node docs/comprobar.mjs`.

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

---

## Ronda 2

Nota de resultados · 7-11-2026 (tarde) · Base: la ronda 1 (PR #37) rebasada sobre `main` en `95e5396` (PR #41, con las series de tokens de la PR #35), es decir, los documentos tal como quedan tras la ronda 1. Comprobada también sobre `main` en `d1214fe` (PR #32): entre una base y otra solo entraron notas (PR #39 y #32), el rebase sale limpio y los ids y las salidas no cambian. Node 24.14.1. Cinco tareas nuevas, distintas de las de la ronda 1, cada una hecha como un programador que nunca ha visto el proyecto y solo tiene `docs/BTML.md`, `docs/BQL.md` y `docs/MOTOR.md`. Después, la calificación de un conocedor (que leyó `src/`, el mapa §12–§13 y las PR abiertas #21 y #40).

**Cómo se hizo, y qué la diferencia de la ronda 1.** No había herramienta para lanzar un agente aparte, así que extranjero y calificador fueron el mismo agente, en dos fases seguidas: primero las cinco tareas sin abrir `src/` ni `test/`; después la calificación. Antes de la primera fase, el encargo obligaba a leer el mapa §12–§13 y la ronda 1, así que el extranjero ya conocía las decisiones de VG sobre plazas, titulares y delegación. Esas decisiones están también en `docs/BTML.md` §2.4, §2.5 y §5, así que la ventaja fue pequeña; donde pudo pesar se dice. Los scripts vivían fuera del repositorio (`extranjero2-<tarea>.mjs`, importando `file:///<repo>/src/index.js`); su código, su salida y las dudas del extranjero están en el anexo de esta ronda, al final.

### R2.1 Resultado en una tabla

| Tarea | ¿Corre a la primera? | ¿Resultado correcto? | ¿Razonamiento correcto? | Calificación |
|---|---|---|---|---|
| 1. Una casa emite una serie limitada de plazas; dos huéspedes reservan la misma plaza en noches solapadas | sí | sí: la reserva de ana se ejecuta (noches 13 y 14); la de bea se escribe, colisiona en la plaza 1.1 y su ejecución se rechaza (`saldo insuficiente de E:casa/hab1-cama1@2026-11-14 en hab-1`); su consolidación queda `AUTORIZADO` | sí; las plazas las conserva la habitación, como corrigió VG el 7-11 | **correcto, con dos reparos que vienen de los documentos** |
| 2. Delegación de P con ámbito a un registro de dominio; autorizar dentro y fuera | sí | sí | sí | **correcto** |
| 3. Reputación de una persona a una cosa; la cosa intenta pasarla | sí | sí: la cosa no la pasa, ni la devuelve, ni la consume | sí; anticipó el rechazo | **correcto** (el documento era ambiguo sobre «solo él la mueve») |
| 4. Una décupla desde Mapped con celdas heredadas y una celda anclada lejos | no: importó un `btml` que no existe, y una fórmula cruzaba una referencia (los dos documentados) | sí, tras corregirse leyendo los documentos | ancló la celda lejana en la décupla; la PR #40 la ancla en el foco; el mapa no fija el sitio | **correcto en BTML; el sitio del ancla, [X]** |
| 5. BQL: el escrito más reciente usando ORIGEN y la llegada; otra que falle con INCOMPATIBLE | sí | (a) esa consulta no existe en BQL V0, y lo demostró con seis intentos; (b) sí | sí | **correcto; revela un hueco del lenguaje** |

Ningún error de modelo. Los cinco escribieron registros válidos y usaron el motor, los tokens y BQL como el código espera, a partir de tres documentos. Esta vez los ejemplos de los documentos ya daban su salida (los 34 ejecutables), así que lo que falló fue lo que los documentos **no decían**: qué llevan 5 y 6 de la reserva y que, con el `dir` del camino del anclaje, no alcanzan nada, qué es `rota`, qué quiere decir «solo él la mueve», los separadores reservados de la PR #41, los mensajes de P, `VERSION = 2` en MOTOR y «lo lejano por anclaje». Todo eso queda corregido en esta PR (R2.8).

### R2.2 Tarea 1: plazas y dos reservas solapadas

**Qué hizo.** Génesis de la casa (grupo, con minutos, euros y P sobre `genesis`); alta de ana y bea (personas) y de `hab-1` (cosa); la disponibilidad `['Disponibilidad 13-16 nov', ['Habitación 1', 'cama 1']]`, escrita por la casa, que en el **mismo evento** emite tres series de un token (`E:casa/hab1-cama1@2026-11-13`, `@14`, `@15`) y se las da a la habitación. Las dos reservas se anclan en la plaza (`sobre: disponibilidad`, `en: '1100000000'`), con las noches en el 7 (`['2026-11-13', '2026-11-14']` y `['2026-11-14', '2026-11-15']`) y 5 y 6 como referencia a 1.1.5 y 1.1.6 de la disponibilidad. Para cada reserva, la habitación consolida (con `proponer`), la casa autoriza y la habitación ejecuta moviendo el token de cada noche a quien reservó.

**Salida clave.** `ocupantes de la plaza 1.1: propio:exacto · escrito:ana:exacto · escrito:bea:exacto`; `CONTAR(FILTRAR(BUSCAR(1), ORIGEN() = "escrito"))` desde `[1, 9]` de la disponibilidad → `2`; ana `EJECUTADO`; bea `evento rechazado: saldo insuficiente de E:casa/hab1-cama1@2026-11-14 en hab-1` y `AUTORIZADO`; plazas después: ana 13 y 14, bea ninguna, la habitación la 15. La habitación no puede emitir (`solo personas y grupos emiten: hab-1 es cosa`) ni cobrar en su ejecución (`nadie mueve tokens ajenos: bea no es el autor`).

**Calificación del conocedor.**

- Correcto según los invariantes y las decisiones del 7-11 (mapa §12): todo evento mueve T; emite un grupo; la serie es limitada (emitido 1 por noche); la cosa es titular, conserva y mueve, y no emite; la reserva se ancla en la plaza con las noches en su 7; las reservas colisionan y se ven todas; la segunda «se escribe y colisiona pero no se ejecuta (saldo insuficiente)», que es la frase del mapa. No calculó nunca el solape para decidir: lo impide el token de la noche 14, que existe una vez.
- Bien visto: que, con «ejecuta el autor» y «nadie mueve tokens ajenos» (MOTOR §5), quien entrega las plazas tiene que ser quien las tiene, y que el pago no cabe en la misma ejecución (lo probó). Su modelo (la habitación conserva y entrega) sigue la corrección de VG sobre titulares («una persona emite los tokens de plaza de una habitación y se los da a la habitación; la habitación los conserva y los maneja»); el ejemplo Booking de la PR #21 aún hace que entregue la casa. Lectura del calificador: las dos formas son válidas en el código; la de la habitación es la más cercana a lo último decidido.
- **Reparo 1 (del documento).** Las referencias 5 y 6 apuntan a 1.1.5 y 1.1.6 de la disponibilidad, que no existen: no alcanzan nada. El documento decía «referencia al foco (`{ ref: foco, dir }`)» sin `dir` y sin avisar. El ejemplo del calificador de la ronda 1 (§2, más arriba) hace lo mismo: `{ ref: disp.id, dir: '1150000000' }` sobre una plaza `['doble', '80 EUR']` sin posición 5. Y `seguir` no las marca `rota` (solo marca un id desconocido o 20 saltos), en contra de lo que decía BTML §6.2. El `dir` que eligió (el camino del anclaje) tampoco lo fija nadie: se parece a las heredadas de `consolidar` solo en la forma, porque `consolidar` rechazaría esas posiciones (`hueco en 5: elige algo o quita las posiciones siguientes`: el foco no tiene ocupantes en 1.1.5). Ahora BTML §3.3, §5 y §6.2 lo dicen, con un [X]: las noches dentro (y entonces qué llevan 5 y 6) o ancladas aparte en el 7 de la reserva («lo lejano por anclaje»).
- **Reparo 2 (del motor V0).** Entregar la plaza y cobrar son dos consolidaciones sin atomicidad: si se cobra primero y la plaza ya no está, el dinero se ha ido. Es el hueco de AARPIA (mapa §12); la PR #21 lo marca igual. Ahora en MOTOR §5 y §12.
- Menor: la cantidad de noches en 1.1 repite lo que dice el 7. La acción `'reservar'` en la 4 es texto (ronda 1, §5.2.3). Cómo se nombra la plaza dentro de la denominación no estaba en ningún sitio: [X] (la PR #21 propone el id de la habitación y la dirección de la plaza).

### R2.3 Tarea 2: poder con ámbito

**Qué hizo.** La casa (10 P sobre `genesis`) escribe dos dominios hermanos, Alojamiento y Restaurante, y la Habitación 1 colgada de Alojamiento; delega 3 P con ámbito Alojamiento a recepción. Ana consolida sobre cuatro registros: una reserva colgada de la Habitación 1, un pedido colgado de Restaurante, una nota colgada del alta que solo **referencia** Alojamiento, y Alojamiento mismo. Recepción delega 1 P con ámbito Habitación 1 a turno-noche. Intentos de ensanchar o salirse: ámbito `genesis`, ámbito Restaurante, un ámbito inexistente, P sin ámbito, emitir P.

**Salida clave.** Recepción: poder 3 sobre la reserva y sobre Alojamiento, 0 sobre el pedido y sobre la nota; autoriza la reserva (`AUTORIZADO`) y no el pedido (`recepcion no tiene poder (P) sobre este registro`). Turno-noche: 1 sobre la reserva, 0 sobre Alojamiento. Los cinco intentos se rechazan con su motivo exacto. La casa no puede autorizar su propia consolidación sobre Alojamiento y recepción sí.

**Calificación del conocedor.** Correcto en todo, y es justo lo que decidió VG (mapa §12, «Poder de recepción»): el dominio, la delegación con ese ámbito, autorizar lo que cuelga y delegar hacia abajo. Bien elegida la nota que solo referencia el dominio: enseña que el ámbito es el subárbol por `sobre` y que una referencia no transmite autoridad. Y el último caso enseña que delegar resuelve el defecto 15 de MOTOR §13 (quien tiene todo el poder no puede autorizarse a sí mismo). Sus dudas, fundadas, y ahora en BTML §2.5 y §7.4: los tres mensajes de P no estaban documentados, ni que el ámbito no sigue referencias, ni dónde escribir la delegación (da igual: lo fija el movimiento). Su pregunta por el id del génesis la comprobó el calificador: `{ token: 'P', ambito: eje.genesisId }` se acepta y autoriza en todo el eje, igual que `'genesis'`, con otra clave de saldo. Pero no son dos nombres para el mismo poder: quien tiene P sobre el id del génesis no puede delegarlo con ámbito `'genesis'` (`saldo insuficiente de P sobre el eje en rec`, porque `ambitosQueCubren('genesis')` solo da `['genesis']`), y al revés sí (con P sobre `genesis` se delega con ámbito el id). [X].

### R2.4 Tarea 3: reputación a una cosa

**Qué hizo.** Bea (persona) emite 5 de `R:bea` y da 2 a `hab-1` en el mismo evento (una reseña). La habitación intenta pasar 1 a otra cosa, a una persona, de vuelta a bea, consumirla, emitir la suya y emitir «la de bea». Después: bea intenta retirarla, ana intenta emitir y pasar `R:bea`, y bea amplía su serie con 3 y da 1 a la habitación 2.

**Salida clave.** Los cuatro movimientos de la cosa: `R no es fungible: solo la mueve su emisor bea`; emitir: `solo personas y grupos emiten: hab-1 es cosa` y `nadie emite en nombre de otro: bea no es el autor`; bea no la retira (mismo mensaje); serie final `{"emisor":"bea","emitido":8}`; el rastro, dos eventos de bea (+5, +3).

**Calificación del conocedor.** Correcto: es la regla del código (`validarMovimiento`: en R, `de` es el emisor o `null`) y la del mapa («reputación = serie declarada por su emisor, ampliable solo por él y con rastro visible»; las cosas son titulares y no emiten). Lo que revela: la reputación dada es un **sello**: nadie la vuelve a mover, ni quien la tiene ni quien la dio. Encaja con «no fungible», pero la frase del mapa «la cosa conserva y maneja sus tokens» no vale para R, y nada permite retirar una reputación (¿una reseña falsa?): [X]. El documento decía «solo él la mueve», que se lee como «el emisor la mueve esté donde esté»; ahora BTML §2.2 y §2.4 dicen que solo sale de la cartera de su emisor, listan los mensajes y avisan de que el de «retirar» nombra al emisor aunque sea él el autor.

### R2.5 Tarea 4: Mapped con heredadas y una celda lejana

**Qué hizo.** Sobre una ficha de excursión con posiciones 0–4, ana escribe desde Mapped una décupla con 1 (`@<ficha>:1000000000` y `2`) y 3 (`ana`, `bea`); 0 y 2 se heredan por referencia (`heredadas [0,2]`, coste 6 minutos). Comprueba que meter la 9 en la misma décupla falla (`hueco en 5: el foco no tiene esa posición`), y escribe la 9 como registro Pointed anclado en `9000000000` **de la décupla**, más otro en `9870000000`. Lo lee con `ocupantes`, `arbol` y BQL: `BUSCAR(9)` encuentra el escrito, `LOCAL(9)` no (no está en el payload), `ACTUAL(9)` → `ver la cascada`; `LOCAL(1, 1) * REF("<ficha>", "1200000000")` → `30 EUR`.

**Calificación del conocedor.**

- Correcto en BTML: prefijo denso, celdas sin cambio heredadas por referencia (no copia), proporción de Mapped, coste por posición, lo lejano fuera de la décupla y anclado, exacto en su dirección.
- Los dos tropiezos fueron de lectura, no de los documentos: BTML §0 decía que `btml.js` va en plano, y BQL §3 que un camino de índices no atraviesa una referencia. Los dos los arregló volviendo a leer el documento: los documentos funcionaron como referencia. Aun así, BTML §0 ahora dice qué módulos **no** son espacio de nombres y qué error da.
- **Dónde se ancla lo lejano.** Los documentos no lo decían (ni la palabra). El extranjero ancló en la décupla; la PR #40 (abierta) ancla en el **foco**, en la dirección de la celda bajo el camino. El mapa no decide entre las dos: el §12 dice solo «lo lejano = anclaje», y el §13 («la celda i.j.k bajo el camino c se escribe en `direccion([...c, i, j, k])`») fija las coordenadas de la matriz de salida, no de qué registro cuelga el ancla. Leerlo como «en el foco» es una lectura del calificador, no una decisión: [X]. La diferencia no es de forma: con la elección del extranjero, la ficha no ve la 9 (`CONTAR(BUSCAR(9))` desde la ficha → `0`) y la décupla sí; anclada en el foco, al revés. Ahora BTML §5 describe los dos sitios con su [X] y MOTOR §7.2 dice que `desdeMapped` de `main` aún no ancla.
- Su duda 4 es una consecuencia de los ceros: la heredada de la 0 con camino vacío es `{ ref: foco, dir: '0000000000' }`, que alcanza el payload entero del foco, no su posición 0 (raíz y 0 colisionan, BTML §4.2). Coherente con «la dirección nombra la colisión entera», pero sorprende; ahora en MOTOR §7.2.

### R2.6 Tarea 5: el escrito más reciente, y una INCOMPATIBLE

**Qué hizo.** Una cena con `[4] = ['pagar', 'servir']` y tres propinas escritas en `4000000000`: 2 EUR (t 21:00), 5 EUR (t 21:30) y 1 EUR (t 21:10, que **llega la última**). Seis intentos de quedarse con el escrito más reciente por llegada: los escritos tal cual; `ELEGIR` (da el más antiguo); `ORDENAR(…, ORIGEN(), "desc")` y `ORDENAR(…, ACUERDO(), "desc")` (no invierten los empates); `ELEGIR(…, CONTAR(…))` (todos, en orden); `ORDENAR(…, ACTUAL(), "desc")` (el mayor, no el más reciente). Conclusión: en BQL no se puede; desde JavaScript, `items.at(-1)`. INCOMPATIBLE: `SUMAR(escritos) + 1` → `INCOMPATIBLE: magnitud en EUR y numero no se suman`, con una de control que suma `LOCAL(1, 2)` (misma unidad: `32 EUR`) y otra, `ELEGIR(LOCAL(4))` → `ELEGIR espera una colección, no array`.

**Calificación del conocedor.** Correcto, y bien demostrado: cada intento tiene su porqué y todos están en los documentos (BQL §7.4, §7.7, §11). El calificador lo confirmó en el código: no hay función de llegada, de último ni de inversión en `main`, ni en la PR #36. Lo que revela es serio: el desempate por llegada pone delante **lo más antiguo** y no se puede leer al revés, mientras el mapa dice que «no existe modificar en sitio: corregir es añadir un ocupante». Así, `ACTUAL(pv)` lee el original y BQL no alcanza la corrección. Ahora BQL §7.5, §7.7 y §11 lo dicen, con un [X]. La INCOMPATIBLE elegida es la trampa de las unidades (ronda 1, §5.3); bien con su control.

### R2.7 Lo que revela sobre el lenguaje

1. **Dos capas que funcionan juntas.** La posición muestra (las dos reservas colisionan en la plaza y se ven) y el token decide (la noche 14 existe una vez). Es «las dos cosas a la vez» (mapa §12), y el extranjero lo resolvió sin una línea de lógica de solape: el lenguaje no excluye en la posición, raciona en la serie.
2. **El motor V0 ejecuta una parte.** Toda operación con dos titulares (plaza por pago, compra con entrega) se parte en dos ciclos sin atomicidad, y la ejecución que el eje rechaza no deja rastro: la consolidación sigue `AUTORIZADO`. Es el hueco de AARPIA visto desde un caso.
3. **El poder sigue el anclaje, no las referencias.** Un ámbito es un subárbol de hilos. Coherente con «referencias que no copian»: tampoco transmiten autoridad.
4. **La reputación dada es un sello.** Nadie la vuelve a mover. Encaja con «no fungible», pero deja sin camino la retirada.
5. **La llegada desempata pero no se lee.** BQL sabe lo primero, no lo último; con «corregir es añadir», lo que BQL lee por defecto es el original.
6. **«Lo lejano por anclaje» tiene dos lecturas** (en la décupla o en el foco) y cambian quién ve la celda. Mientras el lenguaje no fije el sitio, lo elige quien escribe ([X], R2.9).
7. **Los nombres vuelven por la denominación.** `hab1-cama1@2026-11-14` es léxico; la PR #21 la deriva de la posición (id de la habitación y dirección de la plaza), que es «posiciones en vez de nombres» (mapa §12, «Idea de fondo»).
8. **Los mensajes de rechazo bastaron.** En las tres tareas de tokens cada rechazo nombró la regla exacta, y los que no estaban documentados se entendían solos (salvo el de R al retirar). Para un lector sin corpus, los mensajes del eje son parte de la gramática.
9. **Los ceros, otra vez.** La heredada de la 0 alcanza el foco entero; `ocupantes` de la plaza cuenta el propio una vez porque la plaza es un terminal (con un array contaría dos, ronda 1 §5.1).

### R2.8 Lo que faltó en los documentos, y cómo queda en esta PR

| Documento | Lo que faltaba o inducía a error | Lo que dice ahora |
|---|---|---|
| BTML §0 | (el extranjero importó `btml`; el documento ya decía «en plano») | qué módulos no son espacio de nombres y el error que da |
| BTML §2.2 | los separadores reservados de la PR #41 (`\|`, `:`, `/` en identidades, denominaciones, ámbitos y escalas) no estaban; «R: solo él la mueve», ambiguo; errores de `validarMovimiento` incompletos | la regla de los separadores (una denominación con hora se rechaza), R con `de` = emisor o `null`, la tabla entera de errores |
| BTML §2.4 | qué quiere decir «no fungible» para quien recibe R; el rastro sin función; cómo se nombra la plaza | un párrafo y dos [X] |
| BTML §2.5 | dónde se escribe la delegación; que el ámbito no sigue referencias; los mensajes de P; el id del génesis como ámbito | cuatro puntos, uno con [X] (el id del génesis autoriza como `genesis`, pero no se delega como `genesis`) |
| BTML §3.3, §6.2 | «`rota`: `true` si una referencia no llegó a contenido» (falso para una posición que el evento no desarrolla) | solo id desconocido o 20 saltos; una posición sin desarrollar da `undefined` sin `rota` |
| BTML §5 | 5 y 6 de la reserva sin `dir` y sin decir que no alcanzan nada; «lo lejano por anclaje» sin describir que nadie fija el `dir` de 5 y 6 (el del extranjero, el camino del anclaje, no alcanza nada y `consolidar` no lo fabricaría) y un [X]; un párrafo sobre lo lejano con sus dos sitios (en el foco, como la PR #40, o en la décupla) y un [X] |
| BTML §7.4, §11 | los rechazos de P | filas nuevas |
| BQL §7.5, §7.7, §11 | que `ACTUAL` da lo más antiguo y que lo último no se puede elegir | notas y un [X] |
| MOTOR §5, §12 | la ejecución de dos partes; la ejecución rechazada sin rastro | un párrafo y filas |
| MOTOR §7.2 | la heredada de la 0; la celda lejana | una nota |
| MOTOR §9, §11 | `VERSION = 1` (es 2 desde la PR #35), sin el error de versión ni `apartarLocal` | corregido, como en BTML §8.1 |

Comprobado: los 34 ejemplos ejecutables de los tres documentos (32 con `node -e`, uno de ellos, BQL §1, entre comillas simples; y los dos completos, BQL §10 y MOTOR §10) dan exactamente la salida escrita, antes y después de estos cambios; `node --test` en verde. Sin cambios de código.

### R2.9 [X] decidir VG (ronda 2)

Solo lo que el mapa no decide.

1. Dónde van las noches de la reserva: dentro de su payload, y entonces qué llevan 5 y 6 (referencias al foco con el camino del anclaje, que no alcanzan nada y que `consolidar` no fabricaría, u otra cosa), o ancladas aparte en el 7 de la reserva (lo lejano por anclaje).
2. La ejecución de dos partes (plaza por pago) sin atomicidad mientras no exista AARPIA; y si una ejecución rechazada debe dejar rastro (un estado de rechazo). La PR #21 pide lo primero también.
3. Cómo se nombra la plaza dentro de la denominación (también en la PR #21).
4. Si el emisor puede retirar reputación dada, o quien la recibe rechazarla.
5. El id del génesis como ámbito de P: rechazarlo o tratarlo como `genesis` (hoy autoriza igual, pero no se puede delegar como `genesis`).
6. Cómo lee BQL lo más reciente: desempate por llegada al revés (lo último delante), una función para el último, o `"desc"` que invierta también los empates.
7. Dónde se ancla lo lejano: en el foco, en la dirección de la celda bajo el camino (como la PR #40), o en la propia décupla (como el extranjero). El mapa dice que va por anclaje, no dónde.

## Anexo de la ronda 2: los cinco intentos tal como se entregaron

Código, salida y dudas, sin editar salvo la ruta del repositorio (`file:///<repo>/`). Los ids son los que da `main` en `95e5396` con los `t` fijos de cada script, y siguen iguales en `d1214fe` (entre las dos solo entraron notas); se ejecutan con `node extranjero2-<tarea>.mjs` desde cualquier carpeta.

### Tarea 1: plazas como serie limitada y dos reservas solapadas

<details>
<summary>Código (`extranjero2-plazas.mjs`)</summary>

```js
// Prueba del extranjero, ronda 2, tarea 1: plazas como serie limitada y dos reservas solapadas.
// Fuentes usadas: docs/BTML.md §2.2-§2.4 (series de E, emisión, cosas titulares), §5 (anclaje de la reserva en la plaza,
// noches en el 7, 5 y 6 como referencia al foco), §6 (ocupantes); docs/MOTOR.md §1-§5 (ciclo, ejecuta el autor,
// cada movimiento sale del autor), §2.1 (proponer); docs/BQL.md §7.4 (BUSCAR, ORIGEN).
import { Eje, encaje, bql, motor, salida } from 'file:///<repo>/src/index.js';

const corto = (x) => JSON.stringify(x).replace(/[0-9a-f]{64}/g, (m) => m.slice(0, 8));
const t = (dia, hora) => `2026-11-${dia}T${hora}:00Z`;
const gasta = (de, cantidad = 1) => ({ token: 'T', escala: 'minuto', cantidad, de, a: null });
const daT = (a, cantidad) => ({ token: 'T', escala: 'minuto', cantidad, de: 'casa', a });
const daEUR = (a, cantidad) => ({ token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad, de: 'casa', a });
const NOCHES = ['2026-11-13', '2026-11-14', '2026-11-15'];
const plaza = (noche) => 'hab1-cama1@' + noche; // denominación: una plaza y una noche
const clavePlaza = (noche) => 'E:casa/' + plaza(noche);

// 1. Génesis: la casa es un grupo (puede emitir), con minutos, euros y poder sobre todo el eje.
const eje = await Eje.genesis({
  identidad: 'casa', tipo: 'grupo', t: t('10', '09:00'), foco: 'Casa rural de ejemplo',
  emision: [{ token: 'T', escala: 'minuto', cantidad: 600 }, { token: 'E', denominacion: 'EUR', cantidad: 1000 }, { token: 'P', cantidad: 5, ambito: 'genesis' }],
});

// 2. Altas: dos personas huéspedes y la habitación (una cosa: titular que no emite).
const alta = await eje.escribir({
  autor: 'casa', sobre: eje.genesisId, t: t('10', '09:05'),
  movimientos: [gasta('casa'), daT('ana', 60), daT('bea', 60), daT('hab-1', 60), daEUR('ana', 300), daEUR('bea', 300)],
  payload: ['Altas', ['ana', 'bea', 'hab-1']],
  contexto: { tipos: { ana: 'persona', bea: 'persona', 'hab-1': 'cosa' } },
});

// 3. Disponibilidad: la casa la escribe y en el mismo evento emite la serie limitada de la plaza 1.1
//    (un token por plaza y noche) y se la da a la habitación, que la conserva.
const emisiones = NOCHES.flatMap((n) => [
  { token: 'E', emisor: 'casa', denominacion: plaza(n), cantidad: 1, de: null, a: 'casa' },
  { token: 'E', emisor: 'casa', denominacion: plaza(n), cantidad: 1, de: 'casa', a: 'hab-1' },
]);
const disp = await eje.escribir({
  autor: 'casa', sobre: alta.id, t: t('10', '09:10'),
  movimientos: [gasta('casa'), ...emisiones],
  payload: ['Disponibilidad 13-16 nov', ['Habitación 1', 'cama 1']], // la plaza es la 1.1
});
console.log('series:', eje.series().filter((s) => s.token === 'E' && s.denominacion !== 'EUR').map((s) => s.clave + ' ' + s.emitido).join(' · '));
console.log('plazas de hab-1:', eje.recursos('hab-1').map((r) => r.denominacion + '=' + r.cantidad).join(' '));

// 4. Las dos reservas, ancladas EN LA PLAZA (sobre: disponibilidad, en: 1.1), noches en el 7 de la reserva,
//    5 y 6 como referencia al foco (camino del anclaje: 1.1.5 y 1.1.6). Prefijo denso, sin «no aplicable».
const EN_PLAZA = '1100000000';
const intentoMapped = (() => { const c = []; c[1] = ['@' + disp.id.slice(0, 8) + ':1100000000']; c[7] = ['2026-11-13']; try { return corto(salida.desdeMapped(eje, c, disp.id, [1, 1])); } catch (e) { return e.message; } })();
console.log('desdeMapped con camino [1, 1] sobre la plaza:', intentoMapped);
const reserva = (quien, noches, hora) => eje.escribir({
  autor: quien, sobre: disp.id, en: EN_PLAZA, t: t('11', hora), movimientos: [gasta(quien)],
  payload: [
    'Reserva de ' + quien,                       // 0 representación
    [{ ref: disp.id, dir: EN_PLAZA }, noches.length], // 1 recursos: la plaza (por referencia) y cuántas noches
    'sin mascotas',                              // 2 criterios
    [quien, 'casa'],                             // 3 comunicación
    'reservar',                                  // 4 fábrica
    { ref: disp.id, dir: '1150000000' },          // 5 sin contenido propio: referencia al foco
    { ref: disp.id, dir: '1160000000' },          // 6 ídem
    noches,                                      // 7 futuro: las noches
  ],
});
const ra = await reserva('ana', ['2026-11-13', '2026-11-14'], '10:00');
const rb = await reserva('bea', ['2026-11-14', '2026-11-15'], '10:05');

// 5. La colisión: las dos reservas son ocupantes de la plaza.
console.log('ocupantes de la plaza 1.1:', encaje.ocupantes(eje, disp.id, [1, 1]).map((o) => o.origen + (o.autor ? ':' + o.autor : '') + ':' + o.signo).join(' · '));
console.log('BQL desde [1, 9] de la disponibilidad:', bql.consultar(eje, disp.id, [1, 9], 'CONTAR(FILTRAR(BUSCAR("1100000000"), ORIGEN() = "escrito"))').texto, 'reservas en la plaza');
console.log('5 de la reserva de ana:', bql.evaluar(eje, ra.id, [5]).texto, '· leída en fórmula:', bql.consultar(eje, ra.id, [9], 'LOCAL(5)').texto, '· seguida:', JSON.stringify(encaje.seguir(eje, ra.payload[5]).contenido), encaje.seguir(eje, ra.payload[5]).rota);
const solape = ra.payload[7].filter((n) => rb.payload[7].includes(n));
console.log('noches solapadas (calculado en JS):', solape.join(', '));

// 6. El ciclo. Las plazas las tiene hab-1, y en la ejecución todo movimiento sale del autor (MOTOR §5),
//    así que consolida y ejecuta la habitación; autoriza la casa (P sobre genesis, no es la autora).
async function asignar(res, quien, hora) {
  const p = motor.proponer(eje, res.id);
  const cons = await motor.consolidar(eje, { autor: 'hab-1', foco: res.id, t: t('11', hora), titulo: 'Asignar plaza a ' + quien, elecciones: p.elecciones });
  await motor.autorizar(eje, { autorizante: 'casa', consolidacion: cons.id, t: t('11', hora) });
  const movimientos = res.payload[7].map((n) => ({ token: 'E', emisor: 'casa', denominacion: plaza(n), cantidad: 1, de: 'hab-1', a: quien }));
  try {
    await motor.ejecutar(eje, { autor: 'hab-1', consolidacion: cons.id, t: t('11', hora), titulo: 'Plaza asignada', movimientos });
  } catch (e) { console.log('  ejecutar para ' + quien + ':', e.message); }
  console.log('  ' + quien + ':', motor.estadoDe(eje, cons.id), '· elecciones', corto(p.elecciones));
  return cons;
}
console.log('ciclo:');
const ca = await asignar(ra, 'ana', '11:00');
const cb = await asignar(rb, 'bea', '11:10');

// 7. Saldos de plazas después.
const plazasDe = (id) => NOCHES.map((n) => n.slice(8) + ':' + eje.saldo(id, clavePlaza(n))).join(' ');
console.log('plazas → ana', plazasDe('ana'), '| bea', plazasDe('bea'), '| hab-1', plazasDe('hab-1'));
console.log('emitido de cada noche:', NOCHES.map((n) => eje.serie(clavePlaza(n)).emitido).join(' '), '· la casa no puede emitir más a nombre de otro ni la habitación emitir:');
await eje.escribir({ autor: 'hab-1', sobre: disp.id, t: t('11', '12:00'), movimientos: [gasta('hab-1'), { token: 'E', emisor: 'hab-1', denominacion: plaza('2026-11-14'), cantidad: 1, de: null, a: 'hab-1' }], payload: 'otra plaza' }).catch((e) => console.log('  ' + e.message));

// 8. ¿Podría la habitación cobrar en la misma ejecución? (el pago es de la huésped, no suyo)
const cc = await motor.consolidar(eje, { autor: 'hab-1', foco: rb.id, t: t('11', '12:10'), titulo: 'Asignar y cobrar', elecciones: { 1: { ref: rb.id, dir: '7000000000' } } });
await motor.autorizar(eje, { autorizante: 'casa', consolidacion: cc.id, t: t('11', '12:10') });
await motor.ejecutar(eje, { autor: 'hab-1', consolidacion: cc.id, t: t('11', '12:10'), movimientos: [{ token: 'E', emisor: 'casa', denominacion: plaza('2026-11-15'), cantidad: 1, de: 'hab-1', a: 'bea' }, { token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 80, de: 'bea', a: 'casa' }] }).catch((e) => console.log('pago en la misma ejecución:', e.message));
console.log('consolidaciones de la reserva de bea:', motor.consolidaciones(eje, rb.id).map((c) => c.titulo + '=' + c.estado).join(' · '));
```

</details>

<details>
<summary>Salida</summary>

```text
series: E:casa/hab1-cama1@2026-11-13 1 · E:casa/hab1-cama1@2026-11-14 1 · E:casa/hab1-cama1@2026-11-15 1
plazas de hab-1: hab1-cama1@2026-11-13=1 hab1-cama1@2026-11-14=1 hab1-cama1@2026-11-15=1
desdeMapped con camino [1, 1] sobre la plaza: hueco en 2: el foco no tiene esa posición; rellénala o quita las siguientes
ocupantes de la plaza 1.1: propio:exacto · escrito:ana:exacto · escrito:bea:exacto
BQL desde [1, 9] de la disponibilidad: 2 reservas en la plaza
5 de la reserva de ana: → bc80ade8 · leída en fórmula: PENDIENTE: posición sin desarrollar · seguida: undefined undefined
noches solapadas (calculado en JS): 2026-11-14
ciclo:
  ana: EJECUTADO · elecciones {"1":{"ref":"3c278426","dir":"1000000000"},"2":{"ref":"3c278426","dir":"2000000000"},"3":{"ref":"3c278426","dir":"3000000000"},"4":{"ref":"3c278426","dir":"4000000000"}}
  ejecutar para bea: evento rechazado: saldo insuficiente de E:casa/hab1-cama1@2026-11-14 en hab-1
  bea: AUTORIZADO · elecciones {"1":{"ref":"f25471fd","dir":"1000000000"},"2":{"ref":"f25471fd","dir":"2000000000"},"3":{"ref":"f25471fd","dir":"3000000000"},"4":{"ref":"f25471fd","dir":"4000000000"}}
plazas → ana 13:1 14:1 15:0 | bea 13:0 14:0 15:0 | hab-1 13:0 14:0 15:1
emitido de cada noche: 1 1 1 · la casa no puede emitir más a nombre de otro ni la habitación emitir:
  evento rechazado: solo personas y grupos emiten: hab-1 es cosa
pago en la misma ejecución: evento rechazado: nadie mueve tokens ajenos: bea no es el autor
consolidaciones de la reserva de bea: Asignar plaza a bea=AUTORIZADO · Asignar y cobrar=AUTORIZADO
```

</details>

<details>
<summary>Dudas</summary>

1. ¿Quién ejecuta? MOTOR §5 dice que ejecuta el autor de la consolidación y que cada movimiento sale del autor. Las plazas las tiene la habitación (BTML §2.4: la cosa conserva y mueve), así que consolida y ejecuta la habitación y autoriza la casa. La persona huésped no puede recibir las plazas desde una ejecución suya, y la habitación no puede cobrar en la suya (lo probé: `nadie mueve tokens ajenos`). El pago tendría que ser otra consolidación, y nada une las dos.
2. ¿Cómo nombro la plaza en la denominación? El ejemplo de BTML §2.4 usa `cama@2026-11-13` con dos tokens para dos camas. Con una plaza concreta puse `hab1-cama1@<noche>`; no encontré regla.
3. «5 y 6: referencia al foco (`{ ref: foco, dir }`)»: ¿qué `dir`? Usé el camino del anclaje (1.1.5 y 1.1.6), como `consolidar` con `camino`. La disponibilidad no tiene esas posiciones: `LOCAL(5)` da PENDIENTE y `seguir` da `contenido` undefined con `rota` sin definir, aunque BTML §6.2 dice que `rota` es `true` si la referencia no llegó a contenido. `desdeMapped` con `camino [1, 1]` se niega (`hueco en 2`). ¿La regla era otra?
4. El solape de noches no se puede calcular en BQL (no hay intersección); lo saqué en JS solo para enseñarlo. Lo que impide la segunda reserva es el token de la noche 14, que existe una vez.
5. La consolidación de bea se queda en `AUTORIZADO`: no hay rechazar, y la ejecución fallida no queda escrita en ningún sitio.
6. Las noches del 7 son texto ISO; nada las interpreta (MOTOR §8.2 solo mira la 7 como `declarado`).

</details>

### Tarea 2: delegación de P con ámbito y autorización dentro y fuera

<details>
<summary>Código (`extranjero2-poder.mjs`)</summary>

```js
// Prueba del extranjero, ronda 2, tarea 2: delegación de P con ámbito a un registro de dominio;
// autorización dentro y fuera del ámbito.
// Fuentes usadas: docs/BTML.md §2.2 (P exige ámbito), §2.3 (solo el génesis emite P), §2.5 (P por delegación,
// poderSobre, ambitosQueCubren), §7.1; docs/MOTOR.md §4 (regla V0: P > 0 sobre el hilo y no ser el autor).
import { Eje, motor } from 'file:///<repo>/src/index.js';

const corto = (x) => JSON.stringify(x).replace(/[0-9a-f]{64}/g, (m) => m.slice(0, 8));
const t = (hora) => `2026-11-12T${hora}:00Z`;
const gasta = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });
const daT = (a, cantidad) => ({ token: 'T', escala: 'minuto', cantidad, de: 'casa', a });
const P = (cantidad, ambito, de, a) => ({ token: 'P', cantidad, ambito, de, a });
const nombre = new Map();
const n = (id) => nombre.get(id) ?? id.slice(0, 8);

const eje = await Eje.genesis({ identidad: 'casa', tipo: 'grupo', t: t('08:00'), foco: 'Casa rural de ejemplo',
  emision: [{ token: 'T', escala: 'minuto', cantidad: 600 }, { token: 'P', cantidad: 10, ambito: 'genesis' }] });
nombre.set(eje.genesisId, 'génesis');
const alta = await eje.escribir({ autor: 'casa', sobre: eje.genesisId, t: t('08:05'),
  movimientos: [gasta('casa'), daT('recepcion', 60), daT('turno-noche', 60), daT('ana', 60)],
  payload: ['Altas', ['recepcion', 'turno-noche', 'ana']], contexto: { tipos: { recepcion: 'persona', 'turno-noche': 'persona', ana: 'persona' } } });
nombre.set(alta.id, 'alta');

// Dos registros de dominio de la casa, hermanos: Alojamiento y Restaurante. Bajo Alojamiento, la habitación 1.
const escribe = async (autor, sobre, payload, nom, hora, extra = []) => { const ev = await eje.escribir({ autor, sobre, t: t(hora), movimientos: [gasta(autor), ...extra], payload }); nombre.set(ev.id, nom); return ev; };
const aloj = await escribe('casa', alta.id, ['Alojamiento', ['Habitación 1', 'Habitación 2']], 'Alojamiento', '08:10');
const rest = await escribe('casa', alta.id, ['Restaurante', ['Menú del día']], 'Restaurante', '08:11');
const hab1 = await escribe('casa', aloj.id, ['Habitación 1', ['cama 1']], 'Habitación 1', '08:12');

// Delegación: la casa da 3 P con ámbito Alojamiento a recepción (en un evento sobre el propio dominio).
await escribe('casa', aloj.id, 'recepción decide sobre Alojamiento', 'delegación casa→recepción', '08:20', [P(3, aloj.id, 'casa', 'recepcion')]);
console.log('casa', corto(eje.poderes('casa')), '· recepción', corto(eje.poderes('recepcion')));
console.log('ámbitos que cubren Habitación 1:', eje.ambitosQueCubren(hab1.id).map(n).join(' > '));

// Lo que se autoriza: consolidaciones de ana sobre registros dentro y fuera de Alojamiento.
const reserva = await escribe('ana', hab1.id, ['Reserva de ana', ['cama 1', 2]], 'reserva (cuelga de Habitación 1)', '09:00');
const pedido = await escribe('ana', rest.id, ['Pedido de ana', ['Menú del día', 1]], 'pedido (cuelga de Restaurante)', '09:01');
const nota = await escribe('ana', alta.id, ['Nota que cita Alojamiento', { ref: aloj.id, dir: '1000000000' }], 'nota (referencia a Alojamiento, cuelga del alta)', '09:02');
const consolida = async (foco) => { const c = await motor.consolidar(eje, { autor: 'ana', foco: foco.id, t: t('09:10'), titulo: 'Consolidación sobre ' + n(foco.id), elecciones: { 1: 'sí' } }); nombre.set(c.id, 'cons. sobre ' + n(foco.id)); return c; };
const cR = await consolida(reserva), cP = await consolida(pedido), cN = await consolida(nota), cA = await consolida(aloj);
const tabla = (quien) => [cR, cP, cN, cA].map((c) => '    ' + n(c.id).padEnd(52) + ' poderSobre ' + eje.poderSobre(quien, c.id) + ' · puede ' + motor.puedeAutorizar(eje, quien, c.id)).join('\n');
console.log('recepción:\n' + tabla('recepcion'));
for (const c of [cR, cP]) await motor.autorizar(eje, { autorizante: 'recepcion', consolidacion: c.id, t: t('09:20') }).then(() => console.log('  autoriza', n(c.id), '→', motor.estadoDe(eje, c.id)), (e) => console.log('  autoriza', n(c.id), '→', e.message));

// Delegar hacia abajo: recepción da 1 P con ámbito Habitación 1 a turno-noche.
await escribe('recepcion', hab1.id, 'turno de noche en la habitación 1', 'delegación recepción→turno', '09:30', [P(1, hab1.id, 'recepcion', 'turno-noche')]);
console.log('recepción', corto(eje.poderes('recepcion')), '· turno-noche', corto(eje.poderes('turno-noche')));
console.log('turno-noche:\n' + tabla('turno-noche'));
// Intentos de ensanchar o salirse: con ámbito genesis, con ámbito Restaurante, con un ámbito inexistente, y P sin ámbito.
for (const [qué, m] of [['ámbito genesis', P(1, 'genesis', 'recepcion', 'turno-noche')], ['ámbito Restaurante', P(1, rest.id, 'recepcion', 'turno-noche')], ['ámbito inexistente', P(1, 'f'.repeat(64), 'recepcion', 'turno-noche')], ['sin ámbito', { token: 'P', cantidad: 1, de: 'recepcion', a: 'turno-noche' }], ['emitir P', P(1, aloj.id, null, 'recepcion')]]) {
  await eje.escribir({ autor: 'recepcion', sobre: aloj.id, t: t('09:40'), movimientos: [gasta('recepcion'), m], payload: 'intento: ' + qué }).then(() => console.log('  recepción delega con', qué, '→ aceptado', corto(eje.poderes('turno-noche'))), (e) => console.log('  recepción delega con', qué, '→', e.message));
}
// La casa consolida sobre Alojamiento: recepción puede autorizarla (la casa tiene todo P genesis, pero es la autora).
const cCasa = await motor.consolidar(eje, { autor: 'casa', foco: aloj.id, t: t('10:00'), titulo: 'Tarifa de invierno', elecciones: { 1: 'tarifa B' } });
console.log('consolidación de la casa sobre Alojamiento: casa puede', motor.puedeAutorizar(eje, 'casa', cCasa.id), '· recepción puede', motor.puedeAutorizar(eje, 'recepcion', cCasa.id));
console.log('P total de recepción (clave P a secas):', eje.saldo('recepcion', 'P'), '· P:<Alojamiento>', eje.saldo('recepcion', 'P:' + aloj.id));
```

</details>

<details>
<summary>Salida</summary>

```text
casa [{"ambito":"genesis","cantidad":7}] · recepción [{"ambito":"fe1a504a","cantidad":3}]
ámbitos que cubren Habitación 1: Habitación 1 > Alojamiento > alta > génesis > genesis
recepción:
    cons. sobre reserva (cuelga de Habitación 1)         poderSobre 3 · puede true
    cons. sobre pedido (cuelga de Restaurante)           poderSobre 0 · puede false
    cons. sobre nota (referencia a Alojamiento, cuelga del alta) poderSobre 0 · puede false
    cons. sobre Alojamiento                              poderSobre 3 · puede true
  autoriza cons. sobre reserva (cuelga de Habitación 1) → AUTORIZADO
  autoriza cons. sobre pedido (cuelga de Restaurante) → recepcion no tiene poder (P) sobre este registro
recepción [{"ambito":"fe1a504a","cantidad":2}] · turno-noche [{"ambito":"8f21531f","cantidad":1}]
turno-noche:
    cons. sobre reserva (cuelga de Habitación 1)         poderSobre 1 · puede true
    cons. sobre pedido (cuelga de Restaurante)           poderSobre 0 · puede false
    cons. sobre nota (referencia a Alojamiento, cuelga del alta) poderSobre 0 · puede false
    cons. sobre Alojamiento                              poderSobre 0 · puede false
  recepción delega con ámbito genesis → evento rechazado: saldo insuficiente de P sobre el eje en recepcion
  recepción delega con ámbito Restaurante → evento rechazado: saldo insuficiente de P sobre b890e8d4 en recepcion
  recepción delega con ámbito inexistente → evento rechazado: ámbito desconocido: ffffffff
  recepción delega con sin ámbito → evento mal formado: movimiento 1: P exige ámbito: no hay poder total
  recepción delega con emitir P → evento rechazado: solo el génesis emite P
consolidación de la casa sobre Alojamiento: casa puede false · recepción puede true
P total de recepción (clave P a secas): 0 · P:<Alojamiento> 2
```

</details>

<details>
<summary>Dudas</summary>

1. ¿Sobre qué registro escribo la delegación? La escribí sobre el dominio; los documentos no dicen si importa (el ámbito va en el movimiento).
2. Los rechazos de P (`saldo insuficiente de P sobre el eje en recepcion`, `… sobre <id8> en recepcion`, `ámbito desconocido: ffffffff`) no están en la tabla de BTML §7.4; se entienden solos.
3. `ambitosQueCubren` devuelve el id del génesis y además `'genesis'`. ¿Son el mismo ámbito? ¿Puedo delegar con `ambito: eje.genesisId`?
4. La nota que solo referencia Alojamiento queda fuera del ámbito: el poder sigue `sobre` (el hilo), no las referencias. Lo esperaba por MOTOR §4.1, pero no está dicho así.

</details>

### Tarea 3: reputación de una persona a una cosa, y la cosa intentando pasarla

<details>
<summary>Código (`extranjero2-reputacion.mjs`)</summary>

```js
// Prueba del extranjero, ronda 2, tarea 3: reputación emitida por una persona a una cosa, y la cosa intentando pasarla.
// Fuentes usadas: docs/BTML.md §2.1 (R: clave R:<emisor>, la emite su emisor), §2.2 (emisor obligatorio en R,
// «solo él la mueve»), §2.4 (emisión de R, rastro visible, «sigue sin ser fungible»), §7.1 (tipos), §7.4 (rechazos).
import { Eje } from 'file:///<repo>/src/index.js';

const t = (hora) => `2026-11-14T${hora}:00Z`;
const gasta = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });
const daT = (a, cantidad) => ({ token: 'T', escala: 'minuto', cantidad, de: 'casa', a });
const R = (cantidad, emisor, de, a) => ({ token: 'R', cantidad, emisor, de, a });

const eje = await Eje.genesis({ identidad: 'casa', tipo: 'grupo', t: t('08:00'), foco: 'Casa rural de ejemplo', emision: [{ token: 'T', escala: 'minuto', cantidad: 600 }] });
const alta = await eje.escribir({ autor: 'casa', sobre: eje.genesisId, t: t('08:05'),
  movimientos: [gasta('casa'), daT('bea', 60), daT('ana', 60), daT('hab-1', 60), daT('hab-2', 60)],
  payload: ['Altas', ['bea', 'ana', 'hab-1', 'hab-2']], contexto: { tipos: { bea: 'persona', ana: 'persona', 'hab-1': 'cosa', 'hab-2': 'cosa' } } });

// 1. bea (persona) declara su serie de reputación y da 2 a la habitación 1 (una cosa), en el mismo evento.
const resena = await eje.escribir({ autor: 'bea', sobre: alta.id, t: t('10:00'), movimientos: [gasta('bea'), R(5, 'bea', null, 'bea'), R(2, 'bea', 'bea', 'hab-1')], payload: ['Reseña de bea', 'habitación 1: limpia y tranquila'] });
console.log('serie R:bea', JSON.stringify(eje.serie('R:bea')), '· bea', JSON.stringify(eje.reputaciones('bea')), '· hab-1', JSON.stringify(eje.reputaciones('hab-1')));

// 2. La cosa intenta pasarla: a otra cosa, a una persona, de vuelta a bea, y consumirla.
const intenta = (qué, m) => eje.escribir({ autor: 'hab-1', sobre: resena.id, t: t('11:00'), movimientos: [gasta('hab-1'), m], payload: 'intento: ' + qué })
  .then(() => console.log('hab-1', qué, '→ aceptado ·', 'hab-1', JSON.stringify(eje.reputaciones('hab-1')), 'hab-2', JSON.stringify(eje.reputaciones('hab-2')), 'ana', JSON.stringify(eje.reputaciones('ana'))), (e) => console.log('hab-1', qué, '→', e.message));
await intenta('pasa 1 a hab-2', R(1, 'bea', 'hab-1', 'hab-2'));
await intenta('pasa 1 a ana', R(1, 'bea', 'hab-1', 'ana'));
await intenta('devuelve 1 a bea', R(1, 'bea', 'hab-1', 'bea'));
await intenta('la consume (a: null)', R(1, 'bea', 'hab-1', null));
await intenta('emite la suya', R(1, 'hab-1', null, 'hab-1'));
await intenta('emite «de bea»', R(1, 'bea', null, 'bea'));

// 3. Y los otros: bea le quita lo dado, ana emite a nombre de bea, ana pasa R:bea que no tiene, bea amplía su serie.
await eje.escribir({ autor: 'bea', sobre: resena.id, t: t('12:00'), movimientos: [gasta('bea'), R(1, 'bea', 'hab-1', 'bea')], payload: 'me la quedo' }).catch((e) => console.log('bea retira 1 de hab-1 →', e.message));
await eje.escribir({ autor: 'ana', sobre: resena.id, t: t('12:01'), movimientos: [gasta('ana'), R(1, 'bea', null, 'ana')], payload: 'x' }).catch((e) => console.log('ana emite R:bea →', e.message));
await eje.escribir({ autor: 'ana', sobre: resena.id, t: t('12:02'), movimientos: [gasta('ana'), R(1, 'bea', 'ana', 'hab-1')], payload: 'x' }).catch((e) => console.log('ana pasa R:bea →', e.message));
await eje.escribir({ autor: 'bea', sobre: resena.id, t: t('12:03'), movimientos: [gasta('bea'), R(3, 'bea', null, 'bea'), R(1, 'bea', 'bea', 'hab-2')], payload: 'segunda reseña' });
console.log('después: serie', JSON.stringify(eje.serie('R:bea')), '· bea', eje.saldo('bea', 'R:bea'), 'hab-1', eje.saldo('hab-1', 'R:bea'), 'hab-2', eje.saldo('hab-2', 'R:bea'));
// 4. El rastro: cada emisión de R:bea es un evento de bea en el eje.
const rastro = eje.orden.map((id) => eje.obtener(id)).filter((ev) => ev.movimientos.some((m) => m.token === 'R' && m.emisor === 'bea' && m.de === null));
console.log('rastro de R:bea:', rastro.map((ev) => ev.autor + ' ' + ev.t.slice(11, 16) + ' +' + ev.movimientos.filter((m) => m.token === 'R' && m.de === null).reduce((s, m) => s + m.cantidad, 0)).join(' · '));
```

</details>

<details>
<summary>Salida</summary>

```text
serie R:bea {"emisor":"bea","emitido":5} · bea [{"emisor":"bea","cantidad":3}] · hab-1 [{"emisor":"bea","cantidad":2}]
hab-1 pasa 1 a hab-2 → evento mal formado: movimiento 1: R no es fungible: solo la mueve su emisor bea
hab-1 pasa 1 a ana → evento mal formado: movimiento 1: R no es fungible: solo la mueve su emisor bea
hab-1 devuelve 1 a bea → evento mal formado: movimiento 1: R no es fungible: solo la mueve su emisor bea
hab-1 la consume (a: null) → evento mal formado: movimiento 1: R no es fungible: solo la mueve su emisor bea
hab-1 emite la suya → evento rechazado: solo personas y grupos emiten: hab-1 es cosa
hab-1 emite «de bea» → evento rechazado: nadie emite en nombre de otro: bea no es el autor
bea retira 1 de hab-1 → evento mal formado: movimiento 1: R no es fungible: solo la mueve su emisor bea
ana emite R:bea → evento mal formado: movimiento 1: la emisión de R va a su propio emisor
ana pasa R:bea → evento mal formado: movimiento 1: R no es fungible: solo la mueve su emisor bea
después: serie {"emisor":"bea","emitido":8} · bea 5 hab-1 2 hab-2 1
rastro de R:bea: bea 10:00 +5 · bea 12:03 +3
```

</details>

<details>
<summary>Dudas</summary>

1. «R: emisor obligatorio (solo él la mueve)». Al principio lo leí como «el emisor la mueve esté donde esté», por ejemplo para retirarla. No: `de` tiene que ser el emisor y además el autor, así que lo ya dado no lo mueve nadie. Al intentar retirarla, el mensaje dice «solo la mueve su emisor bea» cuando el autor es bea: despista.
2. Una cosa con R no puede devolverla ni consumirla: se queda como un sello. ¿Es lo querido?
3. «Rastro visible»: no hay función que lo dé; recorrí `eje.orden`. `eje.series()` solo da el total.

</details>

### Tarea 4: décupla desde Mapped con heredadas y una celda anclada lejos

<details>
<summary>Código (`extranjero2-mapped.mjs`)</summary>

```js
// Prueba del extranjero, ronda 2, tarea 4: una décupla escrita desde Mapped con celdas heredadas por referencia
// y una celda anclada lejos.
// Fuentes usadas: docs/MOTOR.md §7.2 (item, desdeMapped, costeT, escribirDesde), §7.1 (proporción de Mapped);
// docs/BTML.md §3.2 (prefijo denso: «para escribir en la 4 hay que rellenar 0-3»), §3.3 (referencias no copian),
// §5 (en: cualquier dirección del foco, la desarrolle o no), §6 (ocupantes, árbol); docs/BQL.md §7.4 (BUSCAR).
// Lectura del extranjero de «anclada lejos»: la celda que cae lejos del prefijo denso (aquí la 9, «camino», y una
// subposición honda 9.8.7) no se escribe dentro de la décupla, que tendría que rellenar 4-8, sino como registro propio
// anclado con `en` en esa dirección de la décupla.
import { Eje, encaje, bql, salida, direccion, indicesDe } from 'file:///<repo>/src/index.js';

const corto = (x) => JSON.stringify(x).replace(/[0-9a-f]{64}/g, (m) => m.slice(0, 8));
const t = (hora) => `2026-11-15T${hora}:00Z`;
const gasta = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });

const eje = await Eje.genesis({ identidad: 'casa', tipo: 'grupo', t: t('08:00'), foco: 'Casa rural de ejemplo', emision: [{ token: 'T', escala: 'minuto', cantidad: 600 }] });
const alta = await eje.escribir({ autor: 'casa', sobre: eje.genesisId, t: t('08:05'), movimientos: [gasta('casa'), { token: 'T', escala: 'minuto', cantidad: 120, de: 'casa', a: 'ana' }], payload: ['Altas', ['ana']], contexto: { tipos: { ana: 'persona' } } });
// El foco: una ficha de excursión con cinco posiciones desarrolladas.
const ficha = await eje.escribir({ autor: 'casa', sobre: alta.id, t: t('09:00'), movimientos: [gasta('casa')],
  payload: ['Excursión al río', ['bocadillo', 'agua', '15 EUR'], ['calzado de montaña'], ['ana', 'guía'], ['salir 10:00', 'volver 14:00']] });

// La décupla de ana desde Mapped: rellena 1 (con una referencia por prefijo) y 3; deja vacías 0 y 2, que se heredan.
const p8 = ficha.id.slice(0, 8);
const celdas = [];
celdas[1] = ['@' + p8 + ':1000000000', '2'];   // recursos: los de la ficha (por referencia) y dos personas
celdas[3] = ['ana', 'bea'];                      // comunicación
const { payload, heredadas } = salida.desdeMapped(eje, celdas, ficha.id);
console.log('payload', corto(payload), '· heredadas', JSON.stringify(heredadas), '· coste', salida.costeT(payload), 'min');
const dec = await salida.escribirDesde(eje, { modo: 'mapped', autor: 'ana', sobre: ficha.id, t: t('10:00'), payload });
console.log('décupla', dec.id.slice(0, 8), 'modo', dec.contexto.modo, 'mueve', corto(dec.movimientos));

// Intento ingenuo: poner también la 9 en la misma décupla.
const lejos = celdas.slice(); lejos[9] = ['ver la cascada'];
try { salida.desdeMapped(eje, lejos, ficha.id); } catch (e) { console.log('con la 9 dentro:', e.message); }

// La celda lejana, anclada: un registro Pointed de ana sobre la décupla, en 9000000000; y otro más hondo en 9870000000.
const lejana = await salida.escribirDesde(eje, { modo: 'pointed', autor: 'ana', sobre: dec.id, en: '9000000000', t: t('10:05'), payload: salida.desdePointed(eje, 'ver la cascada') });
const honda = await salida.escribirDesde(eje, { modo: 'pointed', autor: 'ana', sobre: dec.id, en: direccion([9, 8, 7]), t: t('10:06'), payload: salida.desdePointed(eje, '@' + p8 + ':4100000000') });
console.log('ancladas:', lejana.en, JSON.stringify(lejana.payload), '·', honda.en, corto(honda.payload));

// Lectura: el payload no tiene 9; la 9 tiene un ocupante escrito; las heredadas alcanzan la ficha sin copiarla.
const ver = (dir) => encaje.ocupantes(eje, dec.id, indicesDe(dir)).map((o) => o.origen + ' ' + (o.evento === dec.id ? 'décupla' : o.evento === ficha.id ? 'ficha' : o.evento.slice(0, 8)) + ' ' + JSON.stringify(o.contenido) + ' ' + o.signo).join(' | ');
for (const d of ['0000000000', '1000000000', '2000000000', '3000000000', '9000000000', '9870000000']) console.log(d, '→', ver(d) || 'nadie');
console.log('arbol de la décupla:', [...encaje.arbol(eje, dec.id).keys()].join(' '));
console.log('BQL desde la raíz de la décupla:', ['LOCAL(2)', 'LOCAL(9)', 'CONTAR(BUSCAR(9))', 'ACTUAL(9)', 'CONTAR(BUSCAR(9, 8, 7))', 'ACTUAL(1)', 'LOCAL(1, 1) * LOCAL(1, 0, 2)', 'LOCAL(1, 1) * REF("' + p8 + '", "1200000000")'].map((f) => f + ' = ' + bql.consultar(eje, dec.id, [5], f).texto).join(' · '));
console.log('el 9 del foco (la ficha) no se entera:', bql.consultar(eje, ficha.id, [5], 'CONTAR(BUSCAR(9))').texto, '· hijos de la ficha', eje.sobre(ficha.id).length, '· de la décupla', eje.sobre(dec.id).length);
console.log('minutos de ana:', eje.saldoT('ana', 'minuto'), '(120 − décupla − dos ancladas)');
```

</details>

<details>
<summary>Salida</summary>

```text
payload [{"ref":"cb00aee9","dir":"0000000000"},[{"ref":"cb00aee9","dir":"1000000000"},2],{"ref":"cb00aee9","dir":"2000000000"},["ana","bea"]] · heredadas [0,2] · coste 6 min
décupla 22d4c0c1 modo mapped mueve [{"token":"T","escala":"minuto","cantidad":6,"de":"ana","a":null}]
con la 9 dentro: hueco en 5: el foco no tiene esa posición; rellénala o quita las siguientes
ancladas: 9000000000 "ver la cascada" · 9870000000 {"ref":"cb00aee9","dir":"4100000000"}
0000000000 → propio décupla [{"ref":"cb00aee9d101715249ddd994c94cf622a0e1dc1280c8651b10697556ab9f9f8c","dir":"0000000000"},[{"ref":"cb00aee9d101715249ddd994c94cf622a0e1dc1280c8651b10697556ab9f9f8c","dir":"1000000000"},2],{"ref":"cb00aee9d101715249ddd994c94cf622a0e1dc1280c8651b10697556ab9f9f8c","dir":"2000000000"},["ana","bea"]] exacto | propio décupla {"ref":"cb00aee9d101715249ddd994c94cf622a0e1dc1280c8651b10697556ab9f9f8c","dir":"0000000000"} exacto | referencia ficha ["Excursión al río",["bocadillo","agua","15 EUR"],["calzado de montaña"],["ana","guía"],["salir 10:00","volver 14:00"]] exacto
1000000000 → propio décupla [{"ref":"cb00aee9d101715249ddd994c94cf622a0e1dc1280c8651b10697556ab9f9f8c","dir":"1000000000"},2] exacto | propio décupla {"ref":"cb00aee9d101715249ddd994c94cf622a0e1dc1280c8651b10697556ab9f9f8c","dir":"1000000000"} exacto | referencia ficha ["bocadillo","agua","15 EUR"] exacto
2000000000 → propio décupla {"ref":"cb00aee9d101715249ddd994c94cf622a0e1dc1280c8651b10697556ab9f9f8c","dir":"2000000000"} exacto | referencia ficha ["calzado de montaña"] exacto
3000000000 → propio décupla ["ana","bea"] exacto | propio décupla "ana" exacto
9000000000 → escrito f5d2bd9a "ver la cascada" exacto
9870000000 → escrito dc92dcdd {"ref":"cb00aee9d101715249ddd994c94cf622a0e1dc1280c8651b10697556ab9f9f8c","dir":"4100000000"} exacto
arbol de la décupla: 0000000000 1000000000 1100000000 2000000000 3000000000 3100000000 9000000000 9870000000
BQL desde la raíz de la décupla: LOCAL(2) = [1 posiciones] · LOCAL(9) = PENDIENTE: posición sin desarrollar · CONTAR(BUSCAR(9)) = 1 · ACTUAL(9) = ver la cascada · CONTAR(BUSCAR(9, 8, 7)) = 1 · ACTUAL(1) = [2 posiciones] · LOCAL(1, 1) * LOCAL(1, 0, 2) = PENDIENTE: posición sin desarrollar · LOCAL(1, 1) * REF("cb00aee9", "1200000000") = 30 EUR
el 9 del foco (la ficha) no se entera: 0 · hijos de la ficha 1 · de la décupla 2
minutos de ana: 112 (120 − décupla − dos ancladas)
```

</details>

<details>
<summary>Dudas</summary>

1. «Anclada lejos» no aparece en los tres documentos. Lo leí así: la celda lejana no entra en la décupla (habría que rellenar 4–8) y va como registro aparte anclado con `en`. ¿Anclado en la décupla o en el foco? Elegí la décupla.
2. El primer intento falló al importar: `import { btml }` no existe (`does not provide an export named 'btml'`). BTML §0 ya decía que `btml.js` va en plano; lo leí deprisa.
3. `LOCAL(1, 0, 2)` da PENDIENTE porque el camino no atraviesa la referencia (BQL §3 lo decía). Con `REF("<ficha>", "1200000000")` sale `30 EUR`.
4. La heredada de la 0 es `{ ref: ficha, dir: '0000000000' }` y alcanza la ficha entera, no «Excursión al río».
5. `LOCAL(2)` sale `[1 posiciones]`.

</details>

### Tarea 5: el escrito más reciente por llegada, y una INCOMPATIBLE

<details>
<summary>Código (`extranjero2-consultas.mjs`)</summary>

```js
// Prueba del extranjero, ronda 2, tarea 5: (a) entre los ocupantes de una posición, el escrito más reciente usando
// ORIGEN y el orden de llegada; (b) una consulta que falle a propósito con INCOMPATIBLE.
// Fuentes usadas: docs/BQL.md §7.4 (BUSCAR: orden por encaje, empates por llegada; escritos en orden de entrada),
// §7.6 FILTRAR, §7.7 ORDENAR («desc» invierte el comparador, no la lista), §7.8 ELEGIR, §7.10 SUMAR, §6.1, §8, §11
// («t del candidato no es accesible desde BQL»); docs/BTML.md §5 (escritos por orden de entrada, no por t).
import { Eje, bql } from 'file:///<repo>/src/index.js';

const t = (hora) => `2026-11-16T${hora}:00Z`;
const gasta = (de) => ({ token: 'T', escala: 'minuto', cantidad: 1, de, a: null });
const eje = await Eje.genesis({ identidad: 'casa', tipo: 'grupo', t: t('08:00'), foco: 'Casa rural de ejemplo', emision: [{ token: 'T', escala: 'minuto', cantidad: 600 }] });
const alta = await eje.escribir({ autor: 'casa', sobre: eje.genesisId, t: t('08:05'), movimientos: [gasta('casa'), { token: 'T', escala: 'minuto', cantidad: 60, de: 'casa', a: 'ana' }, { token: 'T', escala: 'minuto', cantidad: 60, de: 'casa', a: 'bea' }], payload: ['Altas', ['ana', 'bea']], contexto: { tipos: { ana: 'persona', bea: 'persona' } } });
const cena = await eje.escribir({ autor: 'casa', sobre: alta.id, t: t('20:00'), movimientos: [gasta('casa')], payload: ['Cena', ['menú', 2, '24 EUR'], ['sin gluten'], ['ana', 'bea'], ['pagar', 'servir']] });
// Tres propinas escritas en la fábrica (4) de la cena. La tercera llega la última pero declara un t anterior.
const propina = (autor, cantidad, hora) => eje.escribir({ autor, sobre: cena.id, en: '4000000000', t: t(hora), movimientos: [gasta(autor)], payload: cantidad + ' EUR' });
const p1 = await propina('ana', 2, '21:00');
const p2 = await propina('bea', 5, '21:30');
const p3 = await propina('ana', 1, '21:10');
const nombre = new Map([[p1.id, 'p1 (2 EUR, 21:00)'], [p2.id, 'p2 (5 EUR, 21:30)'], [p3.id, 'p3 (1 EUR, 21:10, llega la última)']]);
console.log('llegada (eje.sobre):', eje.sobre(cena.id, '4000000000').map((e) => nombre.get(e.id)).join(' → '));

const q = (f) => { const r = bql.consultar(eje, cena.id, [9], f); const ids = r.valor?.items?.map((c) => nombre.get(c.evento) ?? c.origen) ?? []; console.log(r.estado.padEnd(12), f, '\n             →', ids.length ? ids.join(' · ') : r.texto); return r; };
const ESCRITOS = 'FILTRAR(BUSCAR(4), ORIGEN() = "escrito")';
console.log('(a) el escrito más reciente por llegada:');
q(ESCRITOS);                                                  // los tres, por llegada (todos exactos: empatan)
q(`ELEGIR(${ESCRITOS})`);                                     // el primero: el MÁS ANTIGUO
q(`ELEGIR(ORDENAR(${ESCRITOS}, ORIGEN(), "desc"))`);          // «desc» no invierte los empates
q(`ELEGIR(ORDENAR(${ESCRITOS}, ACUERDO(), "desc"))`);         // ídem: todos acuerdo 10
q(`ELEGIR(${ESCRITOS}, CONTAR(${ESCRITOS}))`);                // los n primeros = todos; no hay «el último»
q(`ELEGIR(ORDENAR(${ESCRITOS}, ACTUAL(), "desc"))`);          // por valor: la mayor (no la más reciente)
// Fuera de BQL: el último de la colección.
const todos = bql.consultar(eje, cena.id, [9], ESCRITOS).valor.items;
console.log('desde JS, items.at(-1):', nombre.get(todos.at(-1).evento), '· por t (JS):', nombre.get([...todos].sort((a, b) => Date.parse(b.t) - Date.parse(a.t))[0].evento));

console.log('(b) INCOMPATIBLE a propósito:');
q(`SUMAR(${ESCRITOS}) + 1`);                                  // magnitud en EUR + numero
q(`SUMAR(${ESCRITOS}) + LOCAL(1, 2)`);                         // control: misma unidad, resuelve
q(`ELEGIR(LOCAL(4))`);                                         // un array no es una colección
```

</details>

<details>
<summary>Salida</summary>

```text
llegada (eje.sobre): p1 (2 EUR, 21:00) → p2 (5 EUR, 21:30) → p3 (1 EUR, 21:10, llega la última)
(a) el escrito más reciente por llegada:
RESUELTO     FILTRAR(BUSCAR(4), ORIGEN() = "escrito") 
             → p1 (2 EUR, 21:00) · p2 (5 EUR, 21:30) · p3 (1 EUR, 21:10, llega la última)
RESUELTO     ELEGIR(FILTRAR(BUSCAR(4), ORIGEN() = "escrito")) 
             → p1 (2 EUR, 21:00)
RESUELTO     ELEGIR(ORDENAR(FILTRAR(BUSCAR(4), ORIGEN() = "escrito"), ORIGEN(), "desc")) 
             → p1 (2 EUR, 21:00)
RESUELTO     ELEGIR(ORDENAR(FILTRAR(BUSCAR(4), ORIGEN() = "escrito"), ACUERDO(), "desc")) 
             → p1 (2 EUR, 21:00)
RESUELTO     ELEGIR(FILTRAR(BUSCAR(4), ORIGEN() = "escrito"), CONTAR(FILTRAR(BUSCAR(4), ORIGEN() = "escrito"))) 
             → p1 (2 EUR, 21:00) · p2 (5 EUR, 21:30) · p3 (1 EUR, 21:10, llega la última)
RESUELTO     ELEGIR(ORDENAR(FILTRAR(BUSCAR(4), ORIGEN() = "escrito"), ACTUAL(), "desc")) 
             → p2 (5 EUR, 21:30)
desde JS, items.at(-1): p3 (1 EUR, 21:10, llega la última) · por t (JS): p2 (5 EUR, 21:30)
(b) INCOMPATIBLE a propósito:
INCOMPATIBLE SUMAR(FILTRAR(BUSCAR(4), ORIGEN() = "escrito")) + 1 
             → INCOMPATIBLE: magnitud en EUR y numero no se suman
RESUELTO     SUMAR(FILTRAR(BUSCAR(4), ORIGEN() = "escrito")) + LOCAL(1, 2) 
             → 32 EUR (2 EUR + 5 EUR + 1 EUR + 24 EUR)
INCOMPATIBLE ELEGIR(LOCAL(4)) 
             → INCOMPATIBLE: ELEGIR espera una colección, no array
```

</details>

<details>
<summary>Dudas</summary>

1. No encontré cómo quedarme con el último. `"desc"` no invierte los empates (BQL §7.7), `t` no es accesible (§11) y no hay índice de llegada. Lo más cerca: el más antiguo (`ELEGIR`) o todos en orden (`ELEGIR` con `CONTAR`). Fuera de BQL, `items.at(-1)`.
2. Si corregir es añadir un ocupante, ¿cómo lee BQL el valor corregido? `ACTUAL(pv)` da el primero.
3. Para la INCOMPATIBLE sumé EUR con un número sin unidad; la de control, con la misma unidad, resuelve.

</details>
