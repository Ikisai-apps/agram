# Catálogo de efectos

Cada operación dice qué cambió, de qué clase y cómo se ve en su mundo. Es el puente entre el núcleo y los mundos animados (big picture §6, tanda 3): sobrio y animado son dos renders de la misma operación (FUNDAMENTOS), y los dos leen la misma lista de efectos. Si una animación no sale de un efecto, no corresponde a ningún cambio y no se dibuja.

Código: `src/efectos.js`, que `src/index.js` exporta como espacio de nombres `efectos` (`import { efectos } from './src/index.js'`; `efectos.efectosDe(eje, compra)`). Nombres: `datos/efectos.json` (y su copia importable `datos/efectos.js`). Pruebas: `test/efectos.test.js`.

```js
import { efectosDe, efectosDelEje, verEn, sobrio } from './src/efectos.js';

const efectos = efectosDe(eje, compra);   // el evento o su id
console.log(sobrio(efectos));             // «mundo · efecto · lugar», una línea por efecto
verEn(efectos[0], 6);                     // cómo lo ve otro mundo (aquí, los hilos del pasado)
```

## Qué es un efecto

```
{ evento, tipo, mundo, celda, clase, nombre, metafora, fuente, decisiones, ...lo propio del tipo }
```

- **tipo**: `ver`, `sustituir`, `anclado`, `escrito`, `impulso`, `modificar` (del registro o de una celda suya), `token` (un movimiento), `fase` o `ruido` (un registro del motor).
- **mundo**: el PV de la posición donde ocurre (época 0: cada dígito es un PV), de 0 a 9.
- **celda**: la dirección de diez dígitos en el foco del evento. Un movimiento de tokens no ocurre en una celda sino entre carteras: su celda es `null`.
- **clase**: la clase de modificación, de 0 a 9 (mapa §12 [D]: 0 ver/sustituir, 1 impulso de recursos, 2 criterio, 3 comunicación, 4 acción; 5 a 9 sin nombre, [X]).
- **nombre** y **metáfora**: cómo se ve en su mundo, del catálogo. **fuente**: de dónde sale el nombre.
- **decisiones**: las marcas «[X] decidir VG» que le tocan (ver más abajo). Nunca está vacía: el emparejamiento de nombres está abierto entero.

Lo que tiene celda lleva además `camino` (el camino exacto de índices: distingue 1, 1.0 y 1.0.0, que comparten dirección), `marco` (el camino desde el que se lee la clase), `ruta` (dónde está dentro del payload; `[]` es el registro entero), `posicion`, `subposicion` y `etiqueta` («i.j.k»). Siempre se cumple `clase === claseRelativa(celda, marco)`.

Los demás campos, por tipo: el registro entero, `colisiona` (cuántos ocupantes había antes) y `con` (cuáles, con su origen y su camino); un movimiento, `movimiento` (emitir, mover o consumir), `token`, `serie`, `cantidad`, `de` y `a`; una fase, `fase` y, según cuál, `elecciones` o `evidencia`; el ruido, `fase` y `motivo`.

## De dónde sale

**No sale solo del evento.** Sale del evento y de lo que el núcleo ya sabe de él, sin estado aparte. Fuera del evento mira dos cosas, y las dos son del núcleo:

1. **Para saber si un registro colisiona**, su foco y lo escrito antes en la misma dirección (`encaje.ocupantes`). Lo escrito después no cambia el efecto de lo anterior.
2. **Para saber si una fase del motor cuenta**, las reglas del motor sobre el eje tal como está (`consolidaciones`, `autorizacionesValidas` y la condición con la que `estadoDe` da EJECUTADO). Como el motor, el juicio es el de ahora: si quien escribió una autorización sin poder lo recibe después, su autorización pasa a contar (`estadoDe` pasa a AUTORIZADO) y el efecto también.

No guarda nada: un eje reconstruido desde su lista de eventos da los mismos efectos, y calcularlos no escribe. Cuatro fuentes, en este orden:

### 1. El registro entero

Un registro escrito sobre su foco en `en` es **un ocupante más de esa dirección**, como en el núcleo (mapa §12 [D]; `src/encaje.js`): ocupa la dirección entera, no celda a celda, y sus caminos con ceros finales colisionan en ella. Su camino es el de `en` sin ceros finales.

**El marco es la raíz del foco** (mapa §13 [D] con n = 0): posición, subposición y clase son los tres primeros dígitos de `en`. Así, un registro en `7310000000` sobre el menú es la celda 7.3.1: los hilos del futuro, clase 1. El registro no guarda desde qué camino se escribió, así que fuera de la raíz lleva la marca del marco ([X]).

| Caso | Tipo |
|---|---|
| Clase 1 | `impulso` |
| Clases 2 a 9 | `modificar` (el nombre genérico lleva el de su clase) |
| Clase 0, el registro es una referencia a su foco | `ver`: el registro mínimo de ver |
| Clase 0, la dirección ya tenía ocupantes | `sustituir`: colisiona con ellos (los del foco, lo que alcanzan sus referencias y lo escrito antes allí). Corregir es añadir. |
| Clase 0, es el primero | `anclado`: lo lejano se ancla en su posición |
| El génesis, que no tiene foco | `escrito` |

Dos registros en `7000000000` sobre el menú: el primero ancla y el segundo colisiona con él (`ocupantes` da 2). Uno en `1100000000`, donde el menú tiene «guiso», colisiona con «guiso».

**Leer desde el camino de quien mira** (`efectosDe(eje, evento, { marco })`, opcional): si el registro está anclado en ese camino o bajo él (el marco es exacto: [1, 0] no es [1]) y el camino deja sitio a la clase, el registro y lo que trae dentro se sitúan desde ese marco (mapa §13 [D]: la clase es el dígito n+2) y cada efecto lo dice en `marco`. Si no, se lee desde la raíz, como sin marco. Un registro en `1000000000` con `[ref, [ref, ['ver', 'impulso']]]` da desde la raíz 1.0.0 y 1.1.1 (hasta la profundidad 3); desde `[1]`, 0.0.0, 1.1.0 y 1.1.1, que es 1.1.1.1: clase 1. Lo usa la fábrica de la X (`mundos/fabrica.js`), que pinta la matriz relativa al camino del foco. Lleva la marca del marco leído ([X]): el registro sigue sin guardar desde qué camino se escribió. Las fases del motor no cambian.

### 2. Lo que trae dentro

Si el payload es un array, cada nodo suyo es una celda en la misma lectura: su dirección es `en` seguido de su ruta, hasta la profundidad 3 tras el marco (posición, subposición, clase; sin marco, 3 desde la raíz); lo que cuelga más hondo es contenido de esa celda. Por eso, la misma celda da siempre el mismo mundo, venga de un terminal o de un array. La posición 0 (y la 0.0…) es la representación del registro: colisiona con él en su dirección y no da un efecto aparte.

**Leer así un registro cualquiera es propuesta** ([X]): la matriz 10×10×10 está decidida solo para el registro de salida de la fábrica (mapa §12 y §13), y hoy ningún registro de `main` lo es con certeza. Toda celda de dentro lleva esa marca.

Una celda de dentro **no colisiona**: el núcleo solo cuenta como ocupante el registro entero (`ocupantes(menu, [1, 1])` es solo «guiso», aunque la compra traiga algo en su [1][1]). Su tipo sale de su clase:

| Caso | Tipo |
|---|---|
| Referencia al foco | **herencia: no es efecto**, salvo que el registro la marque como vista: entonces `ver` (clase 0). La marca es `contexto.vistas` (rutas «i.j») o no estar en `contexto.heredadas` cuando el registro las lista (como hace la PR #40). |
| Clase 0 | `escrito` |
| Clase 1 | `impulso` |
| Clases 2 a 9 | `modificar` |

### 3. Cada movimiento de tokens

Un efecto por movimiento: `emitir` (de nadie), `mover` o `consumir` (a nadie), con su serie (`T:hora`, `E:casa/EUR`…), cantidad, de y a. No tiene celda: va entre carteras. El mundo y la clase son los de su familia, según los cuatro moduladores del jardín del corpus: E luz → 1, P calor → 2, R agua → 3, T vida → 4. El corpus los da como «metáfora, no equivalencia técnica aprobada» ([X]).

### 4. La fase del motor

Un registro con `contexto.fase` (`consolidado`, `autorizado` o `ejecutado`) tiene el formato del motor: **no se lee celda a celda**. Da un solo efecto, la transición, y solo si el motor la reconoce:

| Fase | Cuenta si | Si no, `ruido` con el motivo |
|---|---|---|
| consolidado | `consolidaciones()` la lista: está en la posición 4 de su camino | fuera de la fábrica |
| autorizado | es la primera de `autorizacionesValidas()`: sobre una consolidación, en su fábrica, de quien tiene poder y no es su autor | no es sobre una consolidación · fuera de la fábrica · el autor no se autoriza a sí mismo · sin poder (P) · ya estaba autorizada |
| ejecutado | es la primera que cumple la condición de EJECUTADO de `estadoDe()`: del autor, con la evidencia en el eje | ejecuta quien no es el autor · evidencia rota · ya estaba ejecutada |

Una fase que cuenta está en la fábrica (mundo 4), en la dirección donde el motor la ancla, leída desde su camino (`en` sin el 4): clase 0 ([X]). La consolidación dice qué fijó en cada posición del foco (`elecciones`: elegida, nueva o heredada) y la ejecución su `evidencia`; no se animan aparte. El ruido no es una transición: sus tokens sí se movieron y salen como siempre, pero ningún mundo lo nombra, y los hilos no lo ven.

`descubrir` y `proponer` no escriben eventos: no tienen efecto.

## Las marcas de cada efecto

`decisiones` junta, en este orden:

- **la del nombre**: la de su entrada del catálogo (todas dicen «emparejamiento propuesto»; las que no son palabra del corpus lo dicen además), o «el corpus no nombra este efecto en este mundo» si el mundo no tiene entrada;
- **la de la clase**, si es de 5 a 9 (sin nombre);
- **la de la matriz**, en las celdas de dentro;
- **la del marco**, en lo escrito fuera de la raíz; si se lee desde el camino de quien mira, la del marco leído;
- **la de la familia**, en los movimientos;
- **la de la clase de la fase**, en las fases.

## Los mundos

Por mundo y por tipo, el nombre del efecto visible. El corpus da el vocabulario de cada mundo, pero no lo empareja con operaciones («el significado algebraico de esas interacciones se definirá después»): **el emparejamiento entero es propuesta**, y cada entrada del catálogo lo marca. Los nombres que tampoco son palabra del corpus van aquí con [X]. Lo que un mundo no nombra sale con el nombre genérico de la operación (`sustituir`, `modificar (criterio)`, `emitir T`, `ruido`…) y «[X] decidir VG».

| PV | Mundo | Efectos con nombre | Fuente |
|---|---|---|---|
| 0 | lente | todo: **mostrar** | V3E §04: «Su finalidad es mostrar el elemento»; no promete verdad |
| 1 | ciudad | escrito: **abrir tienda** [X] · sustituir: **encarecer o abaratar** · impulso y mover E: **mercancía que fluye** · emitir E: **abrir vía** | V3 PV1: apertura/cierre de vías y recursos, abaratamiento/encarecimiento de costes, flujos de mercancías; V3E §05.1: un proyecto pequeño empieza como una tienda |
| 2 | jardín | escrito: **brotar** [X] · sustituir y modificar: **florecer** · impulso: **luz** · P: **calor** · visto desde aquí, consolidar: **fructificar** | mapa §12 [D]: hojas, flores y frutos son la metáfora de la modificación; V3 PV2: las plantas crecen, florecen y fructifican; moduladores |
| 3 | parque | escrito y sustituir: **hablar** [X] · ver: **escuchar** · impulso: **paquete** · mover R: **subir el agua** [X] | V3E §07: los cuatro actos, el agua, los paquetes con tokens. [X]: el núcleo no distingue aún si se habla a una persona (bañera) o a un grupo (piscina) |
| 4 | fábrica | escrito y sustituir: **paso** · impulso: **impulso** · T: **línea que se mueve** [X] · fases: **consolidar**, **autorizar**, **ejecutar** | V3E §08.1: paso a paso, línea de diez pasos; mapa §12 [D]: el impulso financiero es la base de la ejecución; V4: consolidación, autorización, ejecución |
| 5 | estructura | todo: **inspeccionar** | V3E §09: inspeccionar qué hay detrás, tipo JSON |
| 6 | hilos del pasado | escrito, sustituir y anclado: **entra por la izquierda** [X] · ejecutar: **ancla** [X] | big picture §6; corpus: izquierda pasado, derecha futuro |
| 7 | hilos del futuro | escrito, sustituir y anclado: **arco al futuro** [X] · consolidar: **arco al futuro** [X] · ejecutar: **ancla** [X] | big picture §6: una consolidación pendiente se dibuja a la derecha, la ejecución ancla |
| 8 | cielo | escrito: **constelación** · sustituir: **caja** | V3 PV8: estrellas y constelaciones; mapa §12 [D]: el foco se sitúa en su caja en cada cohorte |
| 9 | camino | escrito y sustituir: **paso adelante** [X] · consolidar: **previsualizar** · ejecutar: **ejecutar** | V3 PV9: previsualizar y ejecutar, con autoridad explícita; V3E §12.1: etapas, pasos y transiciones |

Sin operación que los produzca todavía (en el catálogo, `sinOperacion`): cerrar vía, seguridad y ciudadanos modelo (ciudad); marchitar (jardín: nada se borra, corregir es añadir); silenciar (parque); previsualizar como registro (fábrica); fundir las bases (cielo, llega con la confluencia del 8).

### Ver desde otro mundo

`verEn(efecto, mundo)` dice cómo ve un mundo un efecto que ocurre en otro, con la marca de ese nombre en `decisiones`, o `null` si ese mundo no lo declara. Una consolidación ocurre en la fábrica; los hilos del futuro la ven como un arco al futuro, el camino la previsualiza y el jardín ve fructificar los criterios elegidos. La ejecución ancla en los dos hilos y el camino la ejecuta. La lente lo muestra todo y la estructura lo inspecciona todo. Nadie ve el ruido, salvo la lente y la estructura.

## Render sobrio

`sobrio(efectos)` da una línea por efecto, «mundo · efecto · lugar»: el lugar es la celda, y en un movimiento, su serie. Con `{ detalle: true }` añade la celda relativa y su tipo (con «registro» delante si es el registro entero), la cantidad y su sentido, la fase o el motivo del ruido. La compra del ejemplo:

```
lente · mostrar · 0000000000 · registro 0.0.0 sustituir
ciudad · abrir tienda · 1100000000 · 1.1.0 escrito
ciudad · abrir tienda · 1200000000 · 1.2.0 escrito
parque · hablar · 3000000000 · 3.0.0 escrito
parque · hablar · 3100000000 · 3.1.0 escrito
fábrica · paso · 4000000000 · 4.0.0 escrito
fábrica · paso · 4100000000 · 4.1.0 escrito
fábrica · línea que se mueve · T:hora · 1 huesped→∅
ciudad · mercancía que fluye · E:casa/EUR · 12 huesped→cocina
```

La compra ocupa la raíz del menú, donde ya estaban el menú y su representación: colisiona. Sus referencias al menú (sus posiciones 1.0 y 2.0) son herencia: no salen. Su título es su representación. Lo demás va celda a celda, con la marca de la matriz. Y una autorización sin poder:

```
fábrica · línea que se mueve · T:minuto · 1 cocina→∅
fábrica · ruido · 4000000000 · autorizado: sin poder (P) sobre la consolidación
```

El render animado llega con los mundos (tandas 4 a 6) y leerá esta misma lista.

## Datos

`datos/efectos.json` manda: por mundo (`mundos[pv].efectos`), cada clave es un tipo de celda (`escrito`, `sustituir`, `ver`, `anclado`, `impulso`, `modificar`, o `modificar.<clase>` para una clase concreta), un movimiento (`token.emitir`, `token.mover`, `token.consumir`), una fase (`fase.consolidado`…) o `*` para todo lo demás de ese mundo. Cada entrada lleva `nombre`, `metafora`, `fuente` y `decision`. Además: las marcas que llevan los efectos (`marcas`), las clases (`clases`), el mundo y la clase de cada familia de tokens (`familias`) y lo que cada tipo significa (`tipos`).

Se cambia el JSON y se regenera la copia importable, que el navegador carga sin fetch:

```sh
node datos/generar-efectos.mjs
```

Una prueba comprueba que `datos/efectos.js` está al día. El módulo exporta `CATALOGO`, `TIPOS_EFECTO`, `MARCAS_EFECTO`, `SIN_NOMBRE`, `efectosDe`, `efectosDelEje`, `verEn`, `claseRelativa`, `nombreMundo`, `sobrio`, `RENDERS` y `render`; una prueba comprueba que ninguno choca con los nombres de `src/index.js`.

## Abierto: [X] decidir VG

1. **El emparejamiento operación ↔ nombre**, mundo a mundo. Cada entrada lleva su fuente y su marca.
2. **Leer el contenido de un registro como la matriz 10×10×10.** Decidido para el registro de salida de la fábrica; aquí se aplica a todo registro, con la marca. Falta saber qué registros son esa salida: la #40 ya está en `main` (`escribirSalida`, `docs/MOTOR.md` §7), y si escribir y consolidar son la misma salida sigue abierto (`docs/notas/FABRICA_10X10.md`, D1/D2).
3. **El marco.** El registro no guarda desde qué camino del foco se escribió, y se lee desde la raíz. La app escribe en `direccion([...camino, PV])`, la #40 ancla aparte las celdas sin base en su `camino + i.j.k`, y el motor consolida en `camino + 4` (este caso se resuelve: su camino es `en` sin el 4). Para leer los demás desde su camino, el registro tendría que guardarlo (propuesta: en su contexto). Mientras, quien mira puede pedir su camino como marco (`{ marco }`), con su marca.
4. **Ver y heredar** dan el mismo payload (PR #40). Aquí se distinguen por `contexto.vistas` o `contexto.heredadas`; un registro de la #40 que solo ve no guarda `heredadas`, y sus vistas se leerían como herencia. Propuesta: guardar `contexto.vistas`.
5. **Toda referencia al foco es herencia**, también las que apuntan a otra dirección del foco.
6. **Familias de tokens → mundo y clase**: los moduladores del corpus, tentativos.
7. **La clase de las fases** (0, como en la #40) y la de las clases 5 a 9 (sin nombre).
8. **El parque no sabe aún si se habla a una persona o a un grupo.**
9. **Qué operación produce** cerrar vía, marchitar, silenciar, previsualizar y fundir.
10. **La fase se juzga con el eje de ahora**, porque así la juzga el motor (regla V0, provisional hasta AARPIA). Además, `estadoDe` da EJECUTADO sin mirar si hubo autorización (`ejecutar` sí la exige); los efectos siguen a `estadoDe`.
11. **Cómo se ve el ruido** en el animado, si se ve: hoy ningún mundo lo nombra.
