# Reglas cortas

Una regla corta dice qué significa cada dígito de una dirección en una profundidad. Diez profundidades por diez dígitos: cien reglas cortas (corpus V4, épocas). Las reglas largas refinan prefijos concretos sin contradecir las cortas; todavía no existen.

Estado:

- **Época 0, decidida por VG** (mapa §10.4 [D]): cada dígito es un PV en todas las profundidades. No cambia.
- **Época 1 (propuesta).** Se llama así y no «época 1»: el nombre definitivo queda libre para la que VG decida. Nada de ella es canon hasta que VG decida; las preguntas están al final, marcadas «[X] decidir VG». El código la carga y la lee, pero ninguna pantalla la usa por defecto.

## Dónde viven

| Archivo | Qué es |
|---|---|
| `datos/epocas/epoca-0.json` | La época 0: diez reglas que valen en todas las profundidades (`"profundidad": "todas"`). |
| `datos/epocas/epoca-1-propuesta.json` | La época 1 (propuesta): nombre, estado, principios, las cien reglas `{ profundidad, digito, nombre, significado, ejemplo }` y las dudas. |
| `datos/epocas/epocas.js` | Copia generada de los JSON (`export const`), para importarlos sin fetch en Node y en el navegador. Se regenera con `npm run epocas`; una prueba avisa si está desfasada. |
| `src/epocas.js` | `PV`, `EPOCA_0` (igual que antes), `EPOCA_1_PROPUESTA`, `EPOCAS` (nombre → época), `cargarEpoca(datos, { respaldo })`, `leerDireccion(dir, época o nombre)`. |

```js
import { EPOCA_1_PROPUESTA, EPOCAS, cargarEpoca, leerDireccion } from './src/epocas.js';
EPOCA_1_PROPUESTA.reglaCorta(1, 2)            // → 'con qué condición'
EPOCA_1_PROPUESTA.regla(1, 2)                 // → { profundidad, digito, nombre, significado, ejemplo }
EPOCA_1_PROPUESTA.ordinal(3)                  // → false: en la época 1 (propuesta) todas las profundidades son nominales
leerDireccion('1200000000', 'época 1 (propuesta)')
// → [{ profundidad: 0, digito: 1, significado: 'recursos' }, { profundidad: 1, digito: 2, significado: 'con qué condición' }]
cargarEpoca(datos, { respaldo: EPOCAS['época 0'] })  // lo que falte se lee con la época 0
```

Una época puede declarar `"ordinales": [k, …]`: las profundidades donde el dígito es orden y no nombre. Se convierte en `epoca.ordinal(k)`, el gancho que ya usa `src/encaje.js`: solo ahí la distancia del vector ordena (opción B, decidida por VG el 7-11 tarde, mapa §12 [D]). La época 0 y la época 1 (propuesta) no declaran ninguna.

Pointed, Sequenced y Mapped aceptan la época por objeto o por nombre, igual que `leerDireccion` (`decupla(ev, 'época 1 (propuesta)', profundidad)`, `secuencia(eje, id, { epoca: 'época 1 (propuesta)' })`, `mapa(eje, id, { epoca: EPOCA_1_PROPUESTA })`); por defecto siguen con la época 0. Un nombre que no existe, también «época 1», da `época desconocida`.

## Época 0 (decidida)

| Dígito | Regla corta (todas las profundidades) | Significado |
|---|---|---|
| 0 | **representación** | PV0: la lente libre sobre el registro en foco (nombre, cifra, imagen, HTML). Puede engañar; no garantiza verdad. |
| 1 | **recursos** | PV1, reino o ciudad: cantidades, entradas y salidas, costes, disponibilidad. |
| 2 | **criterios** | PV2, jardín: lo que distingue cosas aparentemente iguales; decisiones y preferencias; BUSCAR, FILTRAR, ORDENAR, ELEGIR. |
| 3 | **comunicación** | PV3, parque acuático: hablar y escuchar, persona y grupo; no crea ni infiere relaciones ni motivos. |
| 4 | **fábrica** | PV4: preparar la actuación con recursos, criterios y comunicaciones y consolidar la elección; en 4 se ejecuta. |
| 5 | **estructura** | PV5: el registro en foco, el centro de la cruceta (mapa §9 [D]); su estructura, referencias y firmas. |
| 6 | **pasado** | PV6: hilos del pasado, registros encadenados por referencia; procedencia; más detalle cerca del presente. |
| 7 | **futuro** | PV7: hilos del futuro: previsiones, compromisos, expiración, ejecución condicional autorizada. |
| 8 | **comparabilidad** | PV8, cielo: la confluencia de los hilos; posición frente a comparables, medidas, los diez hitos nivel.grado; las estrellas no son verdad. |
| 9 | **camino** | PV9: la guía que baja de las bases: secuencias, tutoriales, siguiente paso; sugerir no es ejecutar. |

## El principio de derivación

**El dígito sigue siendo el PV en todas las profundidades; lo que la época 1 (propuesta) añade es el nombre del grano.**

Por qué no puede cambiar el PV del dígito. Un escrito se ancla con su raíz en cualquier dirección (`en`), y `BUSCAR` devuelve juntos propios, referencias y escritos. Dentro de `FILTRAR`, `ACTUAL(m)` lee la posición m de cada candidato: en un escrito, la m de su raíz (profundidad 0); en un propio, la m un nivel más abajo (`src/bql.js`). Si el dígito m significara cosas distintas según la profundidad, la misma `ACTUAL(m)` leería dos cosas distintas en la misma colección. Es la misma conclusión que la decisión de VG para la época 0.

Cómo se deriva cada profundidad de la anterior. Aplicar un PV es volver a interrogar el resultado, y el orden importa (13 no es 31, D04). La profundidad d+1 es el PV aplicado a lo que hay en la posición de profundidad d, y su nombre es la pregunta que ese PV le hace:

> 0 **qué** · 1 **cuánto** · 2 **con qué condición** · 3 **con quién** · 4 **qué se hace** · 5 **dónde encaja** · 6 **de dónde viene** · 7 **para cuándo** · 8 **frente a otros** · 9 **cómo**

Tres de las cuatro propuestas llegaron por caminos distintos a esta misma decena. En la profundidad 0 se queda la décupla del registro con la cruceta de VG; en la 2, cuando lo de arriba es un valor, la decena se concreta en la anatomía del valor que BQL ya maneja; de la 3 a la 9 no se especializa nada.

### Principios de la época 1 (propuesta)

1. Invariancia. Un escrito se ancla con su raíz («en») en cualquier dirección y BUSCAR devuelve juntos propios, referencias y escritos; dentro de FILTRAR, ACTUAL(m) lee la posición m de la raíz del escrito y la m un nivel más abajo del propio (src/bql.js). Para que ACTUAL(m) no sea ambiguo, el dígito m tiene que nombrar el mismo PV en todas las profundidades. La época 1 (propuesta) no cambia el PV de ningún dígito: nombra su grano. Coincide con lo decidido para la época 0 (mapa §10.4 [D]).
2. Derivación. La profundidad d+1 es el PV aplicado a lo que hay en la posición de profundidad d: aplicar un PV es volver a interrogar el resultado, y el orden importa (13 no es 31, D04). Su nombre es la pregunta que el PV le hace a ese contenido: 0 qué, 1 cuánto, 2 con qué condición, 3 con quién, 4 qué se hace, 5 dónde encaja, 6 de dónde viene, 7 para cuándo, 8 frente a otros, 9 cómo.
3. Profundidad 0 = época 0 con la cruceta de VG (mapa §9 [D] y §9.4 [D]): 5 el registro en foco, 0 la lente sobre él, 6·7 el eje de hilos, 8 su confluencia, 9 los caminos que bajan, 1–4 los ramales donde va la mano, y en 4 se ejecuta. Lectura cruz → X; escritura X → cruz.
4. Profundidad 2 = el detalle. Cuando lo que hay en la profundidad 1 es un valor, sus diez preguntas son la anatomía del valor tal como BQL ya lo maneja: valor mostrado, cantidad, unidad o condición, quién lo dice, operación, firma y referencia, desglose, vigencia, frente a lo previsto, fórmula. Un terminal no tiene posiciones (mapa §12 [D]): sobre un terminal es una lectura de BQL, no un nodo de BTML. En el registro de salida de la fábrica la profundidad 2 es la clase de modificación: los diez PV como tercer dígito, matriz 10×10×10 (VG, 7-11 tarde, mapa §12 [D]); coincide con la invariancia.
5. Profundidades 3 a 9 sin especializar. Ningún caso real llega ahí; la época 0 es el respaldo de lo no consolidado y las reglas no se inventan sin casos (cierre V4). Se leen con la misma decena de preguntas de la profundidad 1, un grano más abajo, sin significado nuevo; se prueban con una lectura de punta a punta de una reserva hasta '1721347610', construida para recorrer las profundidades y no como modelo de reserva (dónde se ancla una reserva lo decidió VG: en la plaza 1.k, con las noches en su 7; mapa §12 [D]).
6. Lo escrito se lee siempre como registro. Lo escrito «en» una dirección es el payload entero de un registro nuevo (mapa §10.4 [D]): su raíz se lee desde su profundidad 0, sea cual sea la profundidad del anclaje, y el anclaje se lee con la regla del foco. Es lo que hace src/encaje.js: los escritos tienen origen '0000000000'.
7. Ceros (mapa §12 [D], colisiones, no apaños). x.0 es la cara de x y colisiona con ella: '1000000000' nombra 1, 1.0, 1.0.0…, todos ocupantes con su camino exacto. Un terminal no tiene posición 0: ACTUAL(0) sobre él es PENDIENTE.
8. Varios en una posición: dos maneras que no se confunden. Hilera: varios ítems dentro de un registro, en el orden de quien escribe, hasta diez (Sequenced escribe una hilera, mapa §10.6). Ocupantes: varios registros en la misma dirección, en el orden del encaje, sin límite (mapa §12). El repositorio hace las dos cosas; la época 1 (propuesta) no elige ([X] decidir VG, duda 2).
9. Más de diez: nunca un undécimo dígito ni una hilera de hileras, sino un registro propio referenciado por elemento o una vista BQL (BUSCAR, ACTUAL), las dos vías del corpus V4. Al agotar las diez profundidades, una referencia es cambio de foco y el registro referido se lee desde su 0.
10. Orden y signo. En la época 1 (propuesta) las diez profundidades son nominales: ordinal(k) es falso para todas. Opción B, decidida por VG el 7-11 tarde (mapa §12 [D]): en el encaje ordenan el acuerdo de prefijo y la llegada; el signo, por componente, y la distancia son información, y solo ordenarían en una profundidad que una época haga ordinal, y solo ahí. Las candidatas que han salido (hitos de PV8, escalas de T, pasos de 9) son prefijos concretos y no profundidades enteras ([X] decidir VG, duda 6).
11. Modo no es profundidad. La proporción de Pointed, Sequenced y Mapped (10, 100 y 1000 posiciones, mapa §10.1 [D]) cuenta posiciones vistas; no da significado al dígito. Ninguna regla corta nombra un modo (corpus V4: más profundidad no es más zoom).
12. Compatibilidad. Cada regla de la época 1 (propuesta) refina la de la época 0 en el mismo dígito; un mismo dato se lee desde las dos (la época está fuera del dato, mapa §9 [D]). Las reglas largas podrán especializar prefijos sin contradecir las cortas (corpus V2).
13. Itinerario. El corpus propone que cada época consolide una profundidad y permite estudiar las cien desde el principio: esta época 1 (propuesta) consolida la 1, adelanta la 2 y deja de la 3 a la 9 en respaldo.

## La época 1 (propuesta), de un vistazo

| Dígito | PV | Prof. 0 | Prof. 1 | Prof. 2 | Prof. 3 a 9 |
|---|---|---|---|---|---|
| 0 | PV0 | representación | qué | valor mostrado | qué |
| 1 | PV1 | recursos | cuánto | cantidad | cuánto |
| 2 | PV2 | criterios | con qué condición | unidad o condición | con qué condición |
| 3 | PV3 | comunicación | con quién | quién lo dice | con quién |
| 4 | PV4 | fábrica | qué se hace | operación | qué se hace |
| 5 | PV5 | estructura | dónde encaja | firma y referencia | dónde encaja |
| 6 | PV6 | pasado | de dónde viene | desglose | de dónde viene |
| 7 | PV7 | futuro | para cuándo | vigencia | para cuándo |
| 8 | PV8 | comparabilidad | frente a otros | frente a lo previsto | frente a otros |
| 9 | PV9 | camino | cómo | fórmula | cómo |

### Profundidad 0: el registro en foco

| Dígito | Nombre | Significado | Ejemplo |
|---|---|---|---|
| 0 | **representación** | La lente sobre el registro en foco (nombre, cifra, imagen): lo que se ve primero; puede engañar, no garantiza verdad. Igual que en la época 0. | compra 0 = 'Compra del menú del día'; =LOCAL(0) lo devuelve. |
| 1 | **recursos** | Lo que el registro tiene, cuesta o mueve: cantidades, entradas y salidas, disponibilidad; aquí viven las magnitudes y la cuenta. Ramal de la mano entre 6 y 8. Igual que en la época 0. | compra 1 = [ref menú:1, 1, 'EUR 12']. BUSCAR(1) da cuatro ocupantes, todos exactos: propio 1, propio 1.0 (colisión por ceros), la hilera de platos alcanzada por la referencia y la cuenta escrita en '1000000000'; en la cuenta, =REF(compra, "1200000000") + 2 EUR → 14 EUR (12 EUR + 2 EUR). |
| 2 | **criterios** | Lo que distingue y decide: preferencias, condiciones, filtros; una fórmula aquí filtra, ordena y elige sin publicar. Ramal de la mano entre 8 y 7. Igual que en la época 0. | menú 2 = ['sin gluten', 'vegetariano'] y compra 2 = [ref menú:2]; =ELEGIR(FILTRAR(BUSCAR(1), ORIGEN() = "escrito")) propone la cuenta y no registra nada. |
| 3 | **comunicación** | Quién habla y quién escucha en torno al registro: actos observables, sin inferir motivos ni relaciones. Ramal de la mano entre 6 y 9. Igual que en la época 0. | compra 3 = ['huesped', 'cocina']; un aviso escrito en '3000000000' sobre la compra es un ocupante más del 3. |
| 4 | **fábrica** | Donde se prepara y consolida la actuación; en 4 se ejecuta, y ejecutar escribe un registro nuevo que entra en el eje (X → cruz). Consolidar no ejecuta. Ramal de la mano entre 7 y 9. Igual que en la época 0. | compra 4 = ['pagar', 'servir']; consolidar() escribe en '4000000000' (FABRICA) con sus fuentes y el vector de cada una. |
| 5 | **estructura** | El registro en foco, centro de la cruceta (mapa §9 [D]): su estructura, referencias, firmas y dónde encaja. Lo da la reconstrucción. Igual que en la época 0. | Décupla del corpus V4: 5 = '8412300000' (dónde encaja lo que se busca); en BQL, los campos de encaje de un candidato son su 5: ORIGEN(), ACUERDO(), SIGNO(), FALTAS(), EXCEDENTES(). |
| 6 | **pasado** | El hilo hacia atrás: registros encadenados por referencia (sobre) y lo ya ocurrido; más detalle cerca del presente. Lo da el eje. Igual que en la época 0. | El hilo de la compra es compra → menú → altas → génesis (por «sobre»); ejeTemporal(eje, compra) coloca lo anterior por bandas (hora, día…). |
| 7 | **futuro** | El hilo hacia delante: horizonte declarado, compromisos, expiración; las consolidaciones pendientes son futuro subjetivo. Lo da el eje. Igual que en la época 0. | reserva 7 = 'salida 16-11 12:00'; sobre la compra, =ACTUAL(7) es PENDIENTE: nadie ha declarado futuro. |
| 8 | **comparabilidad** | La confluencia de los hilos: el registro frente a sus comparables accesibles, medidas y los diez hitos nivel.grado; las estrellas no son verdad. Igual que en la época 0. | comparar(eje, compra) sitúa la compra entre sus hermanos; los hitos: índice 3 → 3.1 aprendizaje profesional. |
| 9 | **camino** | La guía que baja de las bases: secuencias, tutoriales, el siguiente paso; sugerir no es ejecutar. Igual que en la época 0. | Décupla del corpus V4: 9 = 'Confirmar la elección antes de registrar'. |

### Profundidad 1: la parte

| Dígito | Nombre | Significado | Ejemplo |
|---|---|---|---|
| 0 | **qué** | PV0 de la parte: su nombre o cara, lo que se ve si no se desarrolla. Colisiona con la posición de arriba (x.0 ocupa la misma dirección que x). | compra 4.0 = 'pagar': =LOCAL(4, 0) lo devuelve y BUSCAR(4) da 4 y 4.0 como dos ocupantes propios; 'pagar' es terminal y no tiene 0. |
| 1 | **cuánto** | PV1 de la parte: su magnitud (número con unidad, veces, duración); donde SUMAR y el producto tienen sentido. | compra 1.1 = 1 (un menú): =LOCAL(1, 1) * 12 EUR → 12 EUR. Hoy menú 1 = ['ensalada', 'guiso', 'fruta'] es una hilera: LOCAL(1, 1) = 'guiso' sale como «cuánto» (duda 2). |
| 2 | **con qué condición** | PV2 de la parte: el criterio que la distingue o condiciona: precio, requisito, límite. | compra 1.2 = 'EUR 12': =REF(compra, "1200000000") → 12 EUR. Una corrección escrita en '1200000000' sería otro ocupante: corregir es añadir. |
| 3 | **con quién** | PV3 de la parte: su contraparte: quién la provee, la recibe o responde por ella, persona o cosa. | Una reserva con 1.3 = 'recepción'. Hoy compra 3 = ['huesped', 'cocina'] es una hilera: LOCAL(3, 1) = 'cocina' sale como «cuánto» (duda 12). |
| 4 | **qué se hace** | PV4 de la parte: lo que se hace o se hará con ella. El 4 del 4 es la acción de la acción. | 1.4 = 'pagar' (lo que se hace con el recurso); 3.4 = 'avisar'. La autorización y la ejecución se escriben en el 4 de la consolidación, que está en el 4 del foco (duda 10). |
| 5 | **dónde encaja** | PV5 de la parte: la dirección o referencia donde encaja en el árbol; lo que BUSCAR(LOCAL(5)) recibiría. | Una reserva con 1.5 = {ref: calendario, dir: '7000000000'}. BUSCAR por dirección está decidido (VG, 7-11 tarde, mapa §12 [D]: un texto de diez dígitos es dirección), pero el código aún solo toma índices del anfitrión (duda 11). |
| 6 | **de dónde viene** | PV6 de la parte: su origen y procedencia: de dónde sale, desde cuándo, qué había antes. | La cuenta 1 sale de la compra 1.2: evaluar(eje, cuenta, '1000000000') da la dependencia «compra:1200000000». Una reserva con 1.6 = 'entrada 14-11'. |
| 7 | **para cuándo** | PV7 de la parte: su plazo o compromiso: hasta cuándo vale o cuándo se cumple. | Una reserva con 1.7 = 'salida 16-11 12:00'; un menú con 1.7 = 'hasta las 16:00'. |
| 8 | **frente a otros** | PV8 de la parte: dónde queda frente a sus comparables: diferencia, nivel, hito requerido. | Una tarea con 4.8 = '3.1' (aprendizaje profesional, el hito del índice 3). |
| 9 | **cómo** | PV9 de la parte: cómo se consigue, se usa o se aplica; el siguiente paso. | Una reserva con 1.9 = 'check-in a partir de las 15:00'; una tarea con 4.9 = 'poner manteles'. |

### Profundidad 2: el detalle

| Dígito | Nombre | Significado | Ejemplo |
|---|---|---|---|
| 0 | **valor mostrado** | PV0 del detalle: el valor tal como se muestra. Colisiona con el detalle (x.y.0 ocupa la dirección de x.y). Si el detalle es un terminal, no tiene posiciones en BTML (un terminal no tiene 0): esta lectura es de BQL sobre el valor, no un nodo (duda 4). | compra 1.2 = 'EUR 12' es terminal: 1.2.0 no existe en BTML; BQL lo muestra como '12 EUR' (formato()). |
| 1 | **cantidad** | PV1 del detalle: el número puro. Si el detalle es un terminal, no tiene posiciones en BTML (un terminal no tiene 0): esta lectura es de BQL sobre el valor, no un nodo (duda 4). | La cantidad de compra 1.2 es 12 (la magnitud de BQL guarda cantidad 12). |
| 2 | **unidad o condición** | PV2 del detalle: el criterio que separa magnitudes del mismo número: la unidad o la condición que lo hace válido; unidades distintas no se suman, se componen. Si el detalle es un terminal, no tiene posiciones en BTML (un terminal no tiene 0): esta lectura es de BQL sobre el valor, no un nodo (duda 4). | La unidad de compra 1.2 es EUR. La cuenta en 2: =LOCAL(1) + 15 min → '14 EUR (12 EUR + 2 EUR) + 15 min': mismas cantidades no se funden si la unidad difiere. |
| 3 | **quién lo dice** | PV3 del detalle: quién lo fija, lo cobra o responde por él. | El precio de compra 1.2 lo fija cocina; el movimiento E:casa/EUR de la compra lleva 12 de huésped a cocina (la serie la emite la casa, que la respalda). |
| 4 | **operación** | PV4 del detalle: el acto u operación que lo produjo: suma, producto, elección, consolidación. | Los 14 EUR de la cuenta nacen de una suma (=REF(…) + 2 EUR). |
| 5 | **firma y referencia** | PV5 del detalle: dónde vive y quién lo firma: registro, dirección, camino de índices, firma. | La cuenta 1 depende de «compra:1200000000» (dependencias de evaluar()); es lo que vigilan la pila de ciclos y la caché. |
| 6 | **desglose** | PV6 del detalle: de dónde sale: operandos, desglose y procedencia (el pasado del valor). | 14 EUR (12 EUR + 2 EUR): el desglose de la magnitud; un ocupante alcanzado por referencia lleva su procedencia. |
| 7 | **vigencia** | PV7 del detalle: hasta cuándo vale o cuándo se liquida. | Un precio 'de hoy'; una tarifa 'hasta el 30-11'. Un precio vencido sigue siendo ocupante, con su t. |
| 8 | **frente a lo previsto** | PV8 del detalle: lo ocurrido frente a lo previsto o frente a sus comparables; señala la diferencia, no puntúa. | La cuenta cobra 14 EUR frente a los 12 EUR del menú. |
| 9 | **fórmula** | PV9 del detalle: el camino de cálculo, la fórmula o instrucción que lo obtiene. | Hoy la fórmula es el propio slot: '=REF(…) + 2 EUR'; con '==' se guarda como texto sin evaluarse. |

### Profundidades 3 a 9: sin especializar

La misma decena de la profundidad 1, un grano más abajo. Ningún caso real llega ahí; se comprueba con una lectura de punta a punta (construida, no vivida): la dirección `'1721347610'` en una reserva. Recorre las profundidades; no es el modelo de una reserva, cuyo anclaje decidió VG (7-11 tarde, mapa §12 [D]): en la plaza, dentro de los recursos de la disponibilidad (1.k), con las noches en el 7 de la propia reserva.

| Prof. | Dígito | Época 0 | Época 1 (propuesta) | En la reserva |
|---|---|---|---|---|
| 0 | 1 | recursos | recursos | la habitación (recursos de la reserva) |
| 1 | 7 | futuro | para cuándo | la salida, 16-11 12:00 |
| 2 | 2 | criterios | unidad o condición | su condición: late checkout |
| 3 | 1 | recursos | cuánto | 15 EUR |
| 4 | 3 | comunicación | con quién | recepción, que cobra |
| 5 | 4 | fábrica | qué se hace | cobrar |
| 6 | 7 | futuro | para cuándo | al salir, 12:00 |
| 7 | 6 | pasado | de dónde viene | desde la apertura de caja, 8:00 |
| 8 | 1 | recursos | cuánto | 4 horas |

Las setenta reglas, con su ejemplo:

| Prof. | Dígito | Nombre | Ejemplo (lectura de prueba en una reserva) |
|---|---|---|---|
| 3 | 0 | qué | 1.7.2 = la condición de la salida; 1.7.2.0 = 'late checkout' y '1720000000' nombra 1.7.2 y 1.7.2.0 a la vez. |
| 3 | 1 | cuánto | 1.7.2.1 = '15 EUR'; =REF(reserva, "1721000000") → 15 EUR. |
| 3 | 2 | con qué condición | 1.7.2.2 = 'si hay disponibilidad'. |
| 3 | 3 | con quién | 1.7.2.3 = 'recepción' (quien lo concede). |
| 3 | 4 | qué se hace | 1.7.2.4 = 'solicitar'. |
| 3 | 5 | dónde encaja | 1.7.2.5 = {ref: normas de la casa, dir: '2000000000'}. |
| 3 | 6 | de dónde viene | 1.7.2.6 = 'desde 2025'. |
| 3 | 7 | para cuándo | 1.7.2.7 = 'hasta las 14:00'. |
| 3 | 8 | frente a otros | 1.7.2.8 = 'habitual en casas comparables'. |
| 3 | 9 | cómo | 1.7.2.9 = 'pedirlo la víspera'. |
| 4 | 0 | qué | 1.7.2.1 = los 15 EUR del late checkout; 1.7.2.1.0 = '15 EUR'. |
| 4 | 1 | cuánto | 1.7.2.1.1 = 15. |
| 4 | 2 | con qué condición | 1.7.2.1.2 = 'pago en recepción'. |
| 4 | 3 | con quién | 1.7.2.1.3 = 'recepción' (quien cobra). El ejemplo de encaje del corpus V4 cae en este dígito: '8412300000' es un 3 en la profundidad 4, y el candidato '8412500000' difiere en +2 aquí (acuerdo 4, reducir). |
| 4 | 4 | qué se hace | 1.7.2.1.4 = 'cobrar al salir'. |
| 4 | 5 | dónde encaja | 1.7.2.1.5 = {ref: tarifas, dir: '1200000000'}. |
| 4 | 6 | de dónde viene | 1.7.2.1.6 = 'antes 10 EUR'. |
| 4 | 7 | para cuándo | 1.7.2.1.7 = 'esta temporada'. |
| 4 | 8 | frente a otros | 1.7.2.1.8 = 'por debajo de la media de la zona'. |
| 4 | 9 | cómo | 1.7.2.1.9 = 'se calcula con la tarifa vigente'. |
| 5 | 0 | qué | 1.7.2.1.3 = recepción; 1.7.2.1.3.0 = 'recepción'. |
| 5 | 1 | cuánto | 1.7.2.1.3.1 = '1 persona de turno'. |
| 5 | 2 | con qué condición | 1.7.2.1.3.2 = 'con caja abierta'. |
| 5 | 3 | con quién | 1.7.2.1.3.3 = 'huésped' (con quien trata). |
| 5 | 4 | qué se hace | 1.7.2.1.3.4 = 'cobrar'. |
| 5 | 5 | dónde encaja | 1.7.2.1.3.5 = {ref: turno de recepción, dir: '4000000000'}. |
| 5 | 6 | de dónde viene | 1.7.2.1.3.6 = 'desde las 8:00'. |
| 5 | 7 | para cuándo | 1.7.2.1.3.7 = 'hasta las 22:00'. |
| 5 | 8 | frente a otros | 1.7.2.1.3.8 = '3.2' (resolución profesional, el hito del índice 4). |
| 5 | 9 | cómo | 1.7.2.1.3.9 = 'siguiente: entregar recibo'. |
| 6 | 0 | qué | 1.7.2.1.3.4 = cobrar; 1.7.2.1.3.4.0 = 'cobrar'. |
| 6 | 1 | cuánto | 1.7.2.1.3.4.1 = '15 EUR'. |
| 6 | 2 | con qué condición | 1.7.2.1.3.4.2 = 'efectivo o tarjeta'. |
| 6 | 3 | con quién | 1.7.2.1.3.4.3 = 'a la huésped'. |
| 6 | 4 | qué se hace | 1.7.2.1.3.4.4 = 'ejecutar' (lo que se hace con el cobro). |
| 6 | 5 | dónde encaja | 1.7.2.1.3.4.5 = {ref: consolidación del cobro}. |
| 6 | 6 | de dónde viene | 1.7.2.1.3.4.6 = 'consolidado a las 11:50'. |
| 6 | 7 | para cuándo | 1.7.2.1.3.4.7 = 'al salir, 12:00'. |
| 6 | 8 | frente a otros | 1.7.2.1.3.4.8 = 'frente a otros cobros del día'. |
| 6 | 9 | cómo | 1.7.2.1.3.4.9 = 'siguiente: recibo'. |
| 7 | 0 | qué | 1.7.2.1.3.4.7 = al salir; 1.7.2.1.3.4.7.0 = '12:00'. |
| 7 | 1 | cuánto | 1.7.2.1.3.4.7.1 = '1 hora de margen'. |
| 7 | 2 | con qué condición | 1.7.2.1.3.4.7.2 = 'si no hay late checkout'. |
| 7 | 3 | con quién | 1.7.2.1.3.4.7.3 = 'recepción avisa'. |
| 7 | 4 | qué se hace | 1.7.2.1.3.4.7.4 = 'avisar'. |
| 7 | 5 | dónde encaja | 1.7.2.1.3.4.7.5 = {ref: calendario, dir: '7000000000'}. |
| 7 | 6 | de dónde viene | 1.7.2.1.3.4.7.6 = 'desde la apertura de caja, 8:00'. vector('1721347600', '1721347000') tiene +6 en la profundidad 7: acuerdo 7, signo reducir (al candidato le sobra). |
| 7 | 7 | para cuándo | 1.7.2.1.3.4.7.7 = 'tope 14:00'. |
| 7 | 8 | frente a otros | 1.7.2.1.3.4.7.8 = 'habitual'. |
| 7 | 9 | cómo | 1.7.2.1.3.4.7.9 = 'siguiente: cierre de caja'. |
| 8 | 0 | qué | 1.7.2.1.3.4.7.6 = desde las 8:00; 1.7.2.1.3.4.7.6.0 = '8:00'. |
| 8 | 1 | cuánto | 1.7.2.1.3.4.7.6.1 = '4 horas'; =REF(reserva, "1721347610") → 4 horas. |
| 8 | 2 | con qué condición | 1.7.2.1.3.4.7.6.2 = 'días laborables'. |
| 8 | 3 | con quién | 1.7.2.1.3.4.7.6.3 = 'turno de mañana'. |
| 8 | 4 | qué se hace | 1.7.2.1.3.4.7.6.4 = 'abrir caja'. |
| 8 | 5 | dónde encaja | 1.7.2.1.3.4.7.6.5 = {ref: caja, dir: '1000000000'}. |
| 8 | 6 | de dónde viene | 1.7.2.1.3.4.7.6.6 = 'desde el 1-11'. |
| 8 | 7 | para cuándo | 1.7.2.1.3.4.7.6.7 = 'hasta el cambio de horario'. |
| 8 | 8 | frente a otros | 1.7.2.1.3.4.7.6.8 = 'igual que otras casas'. |
| 8 | 9 | cómo | 1.7.2.1.3.4.7.6.9 = 'siguiente: cuadre'. |
| 9 | 0 | qué | '1721347610' nombra a la vez 1.7.2.1.3.4.7.6.1 (las 4 horas) y su 0: es la última colisión posible, no hay undécimo dígito. |
| 9 | 1 | cuánto | 1.7.2.1.3.4.7.6.1.1 = 4. |
| 9 | 2 | con qué condición | 1.7.2.1.3.4.7.6.1.2 = 'hora': una escala de T; 4 horas + 30 min se compone, no se convierte. |
| 9 | 3 | con quién | 1.7.2.1.3.4.7.6.1.3 = 'turno' (a quién se le cuentan). |
| 9 | 4 | qué se hace | 1.7.2.1.3.4.7.6.1.4 = 'contar'. |
| 9 | 5 | dónde encaja | 1.7.2.1.3.4.7.6.1.5 = {ref: saldo T:hora del turno}. |
| 9 | 6 | de dónde viene | 1.7.2.1.3.4.7.6.1.6 = 'antes 3 horas'. |
| 9 | 7 | para cuándo | 1.7.2.1.3.4.7.6.1.7 = 'este ciclo de 28 días'. |
| 9 | 8 | frente a otros | 1.7.2.1.3.4.7.6.1.8 = 'en la media'. |
| 9 | 9 | cómo | '1721347619' con {ref: cuadre de caja}: no hay más profundidad; la referencia es cambio de foco y el cuadre se lee desde su profundidad 0. |

## De dónde sale

Cuatro propuestas de cien reglas (desde el corpus literal, desde los casos de Ikisai, desde la cruceta y la escritura, desde BQL) y tres jueces. La mejor puntuada fue la de BQL (93 puntos frente a 80–81), por ser la única que parte de un invariante comprobado en el código. Es la base. Injertos:

- De la propuesta de los casos: lo escrito se lee siempre como registro; más de diez nunca es undécimo dígito; la decena de preguntas.
- Del corpus literal: hilera y ocupantes como dos maneras de «varios en una posición»; el orden de cada mundo, solo como regla larga.
- De la cruceta: cruz y X dentro de cada pieza; las evidencias de la ejecución en 5 y 6 (como dudas).

Correcciones sobre la base, por lo que dijeron los jueces y por lo ya decidido:

- La distancia no desempata: con la opción B del encaje, decidida por VG el 7-11 tarde (mapa §12 [D]), ordenan el acuerdo de prefijo y la llegada.
- Un terminal no tiene posiciones: la anatomía de la profundidad 2 es una lectura de BQL sobre un terminal, no un nodo.
- Ninguna regla nombra un modo: la proporción de Pointed, Sequenced y Mapped cuenta posiciones, no da significado.
- «Un array nunca es una lista» no se adopta: el repositorio escribe hileras (Sequenced) y la pregunta queda para VG (duda 2).
- Signos según el código: el escrito anclado en la dirección buscada es exacto; `+6` en un dígito es «reducir».

## Dudas para VG

Decisiones de VG del 7-11 por la tarde (mapa §12 [D]) que ya responden parte de lo que esta propuesta preguntaba, y que se recogen en cada duda: el signo, opción B (duda 6 y principio 10); BUSCAR por índice y por dirección (duda 11 y regla 1.5); las bases del 8 (duda 7); la fábrica como matriz 10×10×10 con la clase de modificación en el tercer dígito (dudas 1, 4 y 10, principio 4); el anclaje de la reserva (la lectura de prueba de las profundidades 3 a 9). Lo que queda abierto sigue marcado «[X] decidir VG».

- 1 · [X] decidir VG. ¿La época 1 (propuesta) solo nombra el grano de cada profundidad, con estos nombres? Que el dígito sea el PV en toda profundidad lo sostienen ya la época 0 (mapa §10.4 [D]) y la fábrica (VG, 7-11 tarde, mapa §12 [D]: el tercer dígito son los diez PV, «siempre estamos aplicando los puntos de vista»), y es lo que exige ACTUAL(m) (principio de invariancia). Si alguna profundidad tiene que cambiar el significado del dígito, hay que cambiar también ACTUAL y BUSCAR.
- 2 · [X] decidir VG. Varios en una posición: ¿hilera, ocupantes o las dos? Hoy menú 1 = ['ensalada', 'guiso', 'fruta'] y, bajo la época 1 (propuesta), LOCAL(1, 1) = 'guiso' sale como «cuánto» (en la época 0, «recursos»). Opciones: (a) aceptar que una hilera escrita en una posición de PV se lea como décupla y que la procedencia diga que vino de una hilera; (b) que una lista sean ocupantes (tres platos = tres escritos en '1000000000', tres T:minuto); (c) que alguna profundidad sea de orden, lo que rompe el principio de invariancia. De esto depende que exista alguna profundidad ordinal.
- 3 · [X] decidir VG. ¿Son estas las etiquetas que Mapped debe mostrar al bajar dentro de una posición (qué, cuánto, con qué condición…)? Basta con pasar epoca: 'época 1 (propuesta)' a mapped.mapa; la pantalla no se ha tocado.
- 4 · [X] decidir VG. Anatomía del valor en la profundidad 2: ¿posiciones consultables (LOCAL(1, 2, 2) = 'EUR') o lectura de BQL sobre los campos que ya guarda (unidad, desglose, dependencias)? En el registro de salida de la fábrica ya está decidido (VG, 7-11 tarde, mapa §12 [D]): el tercer dígito es la clase de modificación (0 ver/sustituir, 1 impulso de recursos, 2 criterio, 3 comunicación, 4 acción…), matriz 10×10×10. Queda fuera de la fábrica.
- 5 · [X] decidir VG. Profundidades 3 a 9: ¿la decena de preguntas de la profundidad 1, o los nombres de PV de la época 0 tal cual, hasta que un caso real llegue ahí?
- 6 · [X] decidir VG. ¿Qué profundidad es ordinal, si alguna? El signo ya está decidido (VG, 7-11 tarde, mapa §12 [D]: opción B de docs/notas/SIGNO_DEL_VECTOR.md; ni signo ni distancia ordenan hasta que una época haga ordinal una profundidad, y entonces solo ahí). Candidatas: los diez hitos de PV8 (índice = hito), las siete escalas de T en 6·7, los pasos de 9; son prefijos concretos, así que irían como reglas largas de prefijo o haciendo ordinal la profundidad entera.
- 7 · [X] decidir VG. Cruz y X dentro de cada pieza: ¿0 y 5–9 los dan el eje y la reconstrucción y 1–4 los escribe la mano también en las profundidades 1 y 2, de modo que el motor pueda proponer el 1–4 de una pieza desde sus 6·7·8·9 (1 entre 6 y 8, 2 entre 8 y 7, 3 entre 6 y 9, 4 entre 7 y 9)? Y lo declarado frente a lo derivado en 5 y 6: ¿dos ocupantes que colisionan? En el 8 ya lo resuelven las bases (VG, 7-11 tarde, mapa §12 [D]): lo derivado son registros escritos en el 8 de lo que resumen, ocupantes que colisionan con lo declarado; corregir es añadir otra base.
- 8 · [X] decidir VG. Candidatos pendientes (comprobado en el código): sobre la compra, FILTRAR(BUSCAR(4), ACTUAL(0) = "pagar") da PENDIENTE aunque 4.0 sea 'pagar', porque el candidato 'pagar' es terminal, no tiene 0, y un PENDIENTE para todo el FILTRAR. El corpus V4 deja abierta la «política de filtrado de candidatos pendientes». ¿Se aparta y se cuenta el candidato pendiente, o se para la consulta?
- 9 · [X] decidir VG. motor.ejecutar() pone las referencias a la consolidación y a la autorización en las posiciones 1 y 2 del payload; por PV les tocarían 5 (firma y referencia) y 6 (de dónde viene). ¿Se cambia?
- 10 · [X] decidir VG. La fase de la fábrica vive hoy en contexto.fase: ¿se escribe en el payload para que BQL la lea (el 4 del 4)? Y la cadena consolidación → autorización → ejecución, anclada cada una en el 4 del registro anterior: ¿se lee como profundidad dentro del foco (4.4…) o como cambio de foco en cada paso? Hoy arbol() no concatena anclajes. Ya decidido alrededor (mapa §12 [D]): la autorización y la ejecución reales son de AARPIA, y el registro de salida de la fábrica es la matriz 10×10×10 con la clase de modificación como tercer dígito.
- 11 · [X] decidir VG. ¿El 5 guarda la dirección donde encaja lo buscado, de modo que BUSCAR(LOCAL(5)) tenga sentido (corpus V4)? Lo demás ya lo decidió VG (7-11 tarde, mapa §12 [D]): BUSCAR por índice y por dirección, las dos sin ambigüedad; un número es índice (camino exacto, relativo al anfitrión) y un texto de diez dígitos es dirección (absoluta en el registro, nombra la colisión entera), como BUSCAR("8412300000"), igual que las referencias. El código aún solo toma índices (src/bql.js).
- 12 · [X] decidir VG. compra 3 = ['huesped', 'cocina'] se lee en la época 1 (propuesta) como 3.0 «qué» y 3.1 «cuánto». ¿Se reescribe el ejemplo (por ejemplo 3 = ['pide el menú', 1, 'sin gluten', 'cocina'], que obliga a rellenar 3.1 y 3.2) o se acepta la hilera (duda 2)?
- 13 · [X] decidir VG. Más de diez (mesas de doce, grupos grandes): ¿registro propio referenciado o vista BQL, como propone el principio?
- 14 · [X] decidir VG. Subir desde una fórmula honda: LOCAL lee hermanos de su misma profundidad (en 1.2, LOCAL(1) es 1.1); para leer el foco hace falta REF(id del foco, dirección). ¿Basta o hace falta un ámbito para el foco?
