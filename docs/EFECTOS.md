# Catálogo de efectos

Cada operación dice qué cambió, de qué clase y cómo se ve en su mundo. Es el puente entre el núcleo y los mundos animados (big picture §6, tanda 3): sobrio y animado son dos renders de la misma operación (FUNDAMENTOS), y los dos leen la misma lista de efectos. Si una animación no sale de un efecto, no corresponde a ningún cambio y no se dibuja.

Código: `src/efectos.js`. Nombres: `datos/efectos.json` (y su copia importable `datos/efectos.js`). Pruebas: `test/efectos.test.js`.

```js
import { efectosDe, efectosDelEje, verEn, sobrio } from './src/efectos.js';

const efectos = efectosDe(eje, compra);   // el evento o su id
console.log(sobrio(efectos));             // «mundo · efecto · celda», una línea por efecto
verEn(efectos[0], 6);                     // cómo lo ve otro mundo (aquí, los hilos del pasado)
```

## Qué es un efecto

```
{ evento, tipo, mundo, celda, clase, nombre, metafora, fuente, decision? , ...lo propio del tipo }
```

- **mundo**: el PV de la posición donde ocurre (época 0: cada dígito es un PV), de 0 a 9.
- **celda**: la dirección de diez dígitos, en el foco del evento.
- **clase**: la clase de modificación, de 0 a 9 (mapa §12 [D]: 0 ver/sustituir, 1 impulso de recursos, 2 criterio, 3 comunicación, 4 acción; 5 a 9 sin nombre, [X]).
- **tipo**: `ver`, `sustituir`, `escrito`, `anclado`, `impulso`, `modificar` (de celda), `token` o `fase`.
- **nombre** y **metáfora**: cómo se ve en su mundo, del catálogo. **fuente**: de dónde sale el nombre. **decision**: «[X] decidir VG» si el corpus no lo nombra.

Las celdas llevan además `posicion`, `subposicion` y `etiqueta` («i.j.k»); los movimientos, `movimiento` (emitir, mover o consumir), `token`, `serie`, `cantidad`, `de` y `a`; las fases, `fase`.

## De dónde sale

Solo del evento, sin estado aparte: de su payload, sus movimientos y su contexto. Lo único que se mira fuera es su foco (el registro al que apunta `sobre`), para saber si una celda ya tenía algo. Por eso un eje reconstruido desde su lista de eventos da los mismos efectos, y calcularlos no escribe nada. Tres fuentes, en este orden:

### 1. Cada celda emitida

**La clase es relativa al anclaje** (mapa §13 [D]: la matriz 10×10×10 es relativa al camino). Un registro anclado en `en` (profundidad n) que es un **array** desarrolla esa posición: su `[i][j][k]` es la celda i.j.k bajo `en`, en la dirección `en` + i j k, con la clase en la profundidad n+2. Lo que cuelgue más hondo es contenido de esa celda. Así, bajo el anclaje `1000000000`, la celda `1201000000` es de clase 1 aunque su tercer dígito absoluto sea 0 (`claseRelativa(celda, en)`).

Un registro que es un **terminal** ocupa la posición `en` misma: lo escrito va en el PV donde se escribe (VG, 6-11), así que su celda es `en`, su mundo el de su último dígito (la raíz, 0) y su clase 0. Es lo que escriben Pointed y la autorización del motor.

El tipo de cada celda, por orden:

| Caso | Tipo |
|---|---|
| Referencia al foco | **herencia: no es efecto**, salvo que el registro la marque como vista: entonces `ver` (clase 0). La marca es `contexto.vistas` (celdas «i.j»), o no estar en `contexto.heredadas` cuando el registro las lista (como hace la PR #40), o que el registro entero sea esa referencia (el registro mínimo de ver). |
| Clase 1 | `impulso` |
| Clases 2 a 9 | `modificar` (el nombre genérico lleva el de su clase) |
| Clase 0, el foco ya tiene algo en esa celda | `sustituir`: un ocupante más, que colisiona con el que había (corregir es añadir). Los ceros finales nombran la colisión: la celda 4.0 alcanza la posición 4. |
| Clase 0, el foco no tiene nada donde se ancla el registro | `anclado`: lo lejano se cuelga de su posición (mapa §12). |
| Clase 0, en otro caso | `escrito`: una hoja nueva de una rama que el foco ya tiene. En el génesis, que no tiene foco, todo es escrito. |

### 2. Cada movimiento de tokens

Un efecto por movimiento: `emitir` (de nadie), `mover` o `consumir` (a nadie), con su serie (`T:hora`, `E:casa/EUR`…), cantidad, de y a. La celda es el anclaje del evento. El mundo y la clase son los de su familia, según los cuatro moduladores del jardín del corpus: E luz → 1, P calor → 2, R agua → 3, T vida → 4. El corpus los da como «metáfora, no equivalencia técnica aprobada» ([X] decidir VG), y coinciden con los nombres que VG dio a las clases 1 a 4 (impulso de recursos, criterio, comunicación, acción) y con P = poder/criterio.

### 3. La fase del motor

Si `contexto.fase` es `consolidado`, `autorizado` o `ejecutado`, un efecto `fase` en la posición donde se ancla el registro: la fábrica. Su clase sale 0, como en la PR #40, que deja abierto en qué dirección se escriben autorizar y ejecutar para que su clase salga de ella ([X] decidir VG).

`descubrir` y `proponer` no escriben eventos: no tienen efecto.

## Los mundos

Por mundo y por tipo, el nombre del efecto visible. El corpus da el vocabulario de cada mundo, pero no lo empareja con operaciones («el significado algebraico de esas interacciones se definirá después»): **el emparejamiento entero es propuesta**, y los nombres que no están en el corpus llevan además «[X] decidir VG» en el catálogo (aquí, [X]). Lo que un mundo no nombra sale con el nombre genérico de la operación (`sustituir`, `modificar (criterio)`, `emitir T`…) y «[X] decidir VG».

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

`verEn(efecto, mundo)` dice cómo ve un mundo un efecto que ocurre en otro, o `null` si ese mundo no lo declara. Una consolidación ocurre en la fábrica; los hilos del futuro la ven como un arco al futuro, el camino la previsualiza y el jardín ve fructificar los criterios elegidos. La ejecución ancla en los dos hilos y el camino la ejecuta. La lente lo muestra todo y la estructura lo inspecciona todo.

## Render sobrio

`sobrio(efectos)` da una línea por efecto, «mundo · efecto · celda»; con `{ detalle: true }` añade la celda relativa y su tipo, la serie con su cantidad y su sentido, o la fase. La compra del ejemplo:

```
lente · mostrar · 0000000000 · 0.0.0 sustituir
ciudad · encarecer o abaratar · 1100000000 · 1.1.0 sustituir
ciudad · encarecer o abaratar · 1200000000 · 1.2.0 sustituir
parque · hablar · 3000000000 · 3.0.0 escrito
parque · hablar · 3100000000 · 3.1.0 escrito
fábrica · paso · 4000000000 · 4.0.0 escrito
fábrica · paso · 4100000000 · 4.1.0 escrito
fábrica · línea que se mueve · 0000000000 · T:hora 1 huesped→∅
ciudad · mercancía que fluye · 0000000000 · E:casa/EUR 12 huesped→cocina
```

Las referencias de la compra al menú (sus posiciones 1.0 y 2.0) son herencia: no salen. El render animado llega con los mundos (tandas 4 a 6) y leerá esta misma lista.

## Datos

`datos/efectos.json` manda: por mundo (`mundos[pv].efectos`), cada clave es un tipo de celda (`escrito`, `sustituir`, `ver`, `anclado`, `impulso`, `modificar`, o `modificar.<clase>` para una clase concreta), un movimiento (`token.emitir`, `token.mover`, `token.consumir`), una fase (`fase.consolidado`…) o `*` para todo lo demás de ese mundo. Cada entrada lleva `nombre`, `metafora`, `fuente` y, si el corpus no la nombra, `decision`. Además: las clases (`clases`), el mundo y la clase de cada familia de tokens (`familias`) y lo que cada tipo significa (`tipos`).

Se cambia el JSON y se regenera la copia importable, que el navegador carga sin fetch:

```sh
node datos/generar-efectos.mjs
```

Una prueba comprueba que `datos/efectos.js` está al día.

## Abierto: [X] decidir VG

1. **El emparejamiento operación ↔ nombre**, mundo a mundo. Los nombres del corpus llevan su fuente; los demás, «[X] decidir VG».
2. **El marco de un array anclado fuera de la raíz.** Hoy un array desarrolla su anclaje: cada `[i]` es el PV i de esa posición (época 0), y su mundo es el de i; así la cuenta del ejemplo, anclada en los recursos de la compra, pone su `[2]` en el jardín. Es lo que dice el mapa §13 y lo que hace la PR #40 con los registros «dentro» (anclados en la dirección de su camino). La alternativa es que todo el registro vaya al mundo de su anclaje (lo escrito va en el PV donde se escribe): una hilera de Sequenced escrita en la 4 serían diez pasos de la fábrica.
3. **Las celdas ancladas aparte de la PR #40** (sin base: el registro va en la dirección de su celda i.j.k) son terminales y se leen como tales: su mundo es el último dígito y su clase 0, lo que solo acierta si j y k son 0. Para que su clase salga del evento tendrían que guardar su camino (p. ej. `contexto.camino`) o su celda.
4. **Ver y heredar** dan el mismo payload (PR #40). Aquí se distinguen por `contexto.vistas` o `contexto.heredadas`; un registro de la #40 que solo ve no guarda `heredadas`, y sus vistas se leerían como herencia. Propuesta: guardar `contexto.vistas`.
5. **Toda referencia al foco es herencia**, también las que apuntan a otra dirección del foco (los huecos de la consolidación) y la de la ejecución a su consolidación.
6. **Familias de tokens → mundo y clase**: los moduladores del corpus, tentativos.
7. **La clase de las fases** (0, como en la #40) y la de las clases 5 a 9 (sin nombre).
8. **El parque no sabe aún si se habla a una persona o a un grupo.**
9. **Qué operación produce** cerrar vía, marchitar, silenciar, previsualizar y fundir.
