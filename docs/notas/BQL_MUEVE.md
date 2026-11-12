# BQL mueve: las plantillas migradas y las pendientes

**Estado:** nota del encargo «bql-escritura» (ola 2 del estudio BQL-transacciones), 12-11, sobre `beta`. Recoge lo que hizo y lo que queda; lo decidido está en `docs/notas/DECISIONES_2026-11-12.md` (#49, decisiones 5 a 8 y 10, y #48) y lo que existe, en `docs/BQLM.md` §11 (los verbos y el invariante), `docs/CONTRATO.md` §12 (la transacción, el coste y el anuncio) y `docs/MOTOR.md` §4.1 (el anuncio y sus estaciones).

## Lo que entró

- **Los verbos** (decisión 5): `mint transfer lock release burn` con `from to exit when price`, `memo` y la serie como posición de su familia (`T.1`, `T.8`, `R.(me)`, `E.(x).(y)[.(z)]`, `P.(x)[.(y)]`). En una plantilla, `put v at A.1.(S).1` es el nivel en mano.
- **El invariante del núcleo** (decisión 6): solo una plantilla mueve, y la firma quien la lanza; una regla con un verbo no se carga y, evaluada, es ERROR (aunque el verbo no se llegue a evaluar); un `put` solo en una regla que escribe y solo en `DESTINOS_DE_PUT` (`A.2.1`). Pruebas: `test/bqlm.test.js`, `test/seguridad-bqlm.test.js` (SEG-14, SEG-15).
- **El coste de escribir** (decisión 7): la lectura de la época «the cost of writing» (un minuto del calendario por posición del payload de la candidata, A3), que usan `escribirDesde` (`costeT`) y `acciones.transaccion` (la T en la escala pedida o en la menor que lo cubre). El minuto copiado sale de todas las plantillas salvo «admit someone» (la lista de esa plantilla lo lleva aún; `transaccion` no lo cuenta dos veces).
- **El anuncio** (decisión 8) es un registro del 4.1 con uno o varios movimientos anunciados (estado «anunciado», sin tocar saldos; en BQL, un verbo con `when`), cumplido por lo que se ancla sobre él; sus estaciones (propuesta, autorizada, ejecutada, verificada) son datos de `epoch.4.3`. La lectura «stage» es la única fórmula de lo anunciado (cerrado, «what is missing», el paso «ciclo» y las estaciones la leen). **#48 resuelto**: un pago cumple solo el anuncio sobre el que se ancla; la prueba reproduce el defecto con la fórmula de antes y pasa con la de ahora.

## Las plantillas

**Migradas, con doble ejecución** (la lista de antes delante de las sentencias; `test/acciones.test.js` exige el mismo evento por las dos vías sobre los ejemplos): give own R, commit P, declare future T, write to X, apply a resource, issue E tied to X, lock E as a bid for a quota, consume, expire something mine, forgive, return R (ask for attention), commit time, register a thing, reposition P toward X.

**Migradas sin lista** (solo el coste de escribir, «write» en su 4): anchor here, attach a file, aggregate T, attend, borrow criteria from someone, break down, change cohort, close, declare capacity or threshold, measure, propose, reference X from another record, set a group price.

**Migradas y con la lista retirada**: pay y deliver (su lista solo sabía leer el anuncio como payload; la prueba de igualdad la compara con sus sentencias sobre los anuncios de antes) y anclan ahora en el 4 del anuncio que cumplen.

**Sin migrar**: admit someone (la lleva otro encargo: `admit-someone.json`, `with-whom`, elegibles). Sigue por su lista; para migrarla basta poner sus sentencias detrás de su lista (la doble ejecución la comprueba sola) y quitar el minuto copiado.

Las de solo leer (ask for a recommendation, compare with another record, view the whole tutorial, view thread) y las del camino (follow the path, auto-run to the end) no mueven.

## Lo que queda

- **Retirar las listas** cuando «admit someone» esté migrada: entonces `recetasDe`, `movimientosDe` y `serieDe` de `src/acciones.js` se van, y con ellos el «extra» de la posición 2 y el texto `"nobody"`.
- **`motor.siguiente`** sigue armando en JavaScript «move what was announced» y «commit P» (ahora anclado sobre el anuncio); el estudio pide que pase por las plantillas.
- **El coste en la validación**: «writing burns today's T» sigue pidiendo al menos una quema de T de hoy, no lo exigido por posición; exigirlo obligaría a pagar por posición a todo lo que se escribe a mano (ejemplos y pruebas). Core, pendiente de revisar VG.
- **El ajuste fino por escalas y el botón de ejecutar con el rango** (decisión 7) son de la carta.
- **«Declarar T futuro» como anuncio de T**: hoy es el T informativo con su fecha (sin cambiar el evento, por la doble ejecución); que lo cumpla el T real que se trabaja anclado sobre él queda por decidir.
- **Los ejemplos de antes**: compra (`ejemploFabrica`), Booking y Tasks escriben ya el anuncio como movimientos anunciados; las pruebas y los ejemplos que lo escriben como payload siguen leyéndose con la misma fórmula. Retirar esa forma es otro paso.
- **«Sin verificar no se ejecuta»** (#50): la estación «verificada» existe como dato, pero nada exige verificar antes de mover.

## Tras la fusión con PV3 (encargo «fusión», 12-11)

Al fundir esta rama con PV3 v2 (la R como precio universal) ganó la semántica de PV3 y el mecanismo de aquí:

- **write to X**: la sentencia dice lo de PV3: si `me` tiene R de `first it.3` (se la dio), la devuelve (`transfer … R.(first it.3)`); si no, `put` de su R hasta el precio y `transfer` a `first it.3`. **attend** devuelve la R que X trajo de su autor (`transfer` de `R.(first it.3)`). **register a thing**: los minutos sin defecto (#46), la sentencia los lee del parámetro. **admit someone** quedó migrada (`put`, `transfer` de R y de T); las plantillas nuevas de PV3 que solo quemaban el minuto (configure a place, move to group, remove someone, set a minimum, set a minimum rank, veto someone) son «write».
- Con todas dando el mismo evento por las dos vías (los cinco remitentes de PV3 y gus incluidos), **la lista de antes se retiró**: las décuplas del 4 y `"nobody"`, `recetasDe`, `movimientosDe`, la rama por partes de `serieDe`, el minuto copiado, `doble` y `opciones.via`. Lo que movía la lista en cada caso de los ejemplos quedó en `test/doble-ejecucion-esperada.json` (los ids, por su lugar en el orden del eje), y la prueba exige que las sentencias sigan moviendo eso.
- Sigue pendiente lo de «Lo que queda» salvo su primer punto.
