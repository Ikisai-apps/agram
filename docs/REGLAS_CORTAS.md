# Reglas cortas

Una regla corta dice qué significa cada dígito de una dirección en una profundidad. Diez profundidades por diez dígitos: **cien reglas cortas**, y son la **época 0** completa (decisión de VG, 7-11 noche; corpus V4, épocas). Las **reglas largas** especializan rutas completas y son lo que pulen las épocas futuras: sin contradecir las cortas, ganan a ellas al leer esa ruta exacta. Todavía no hay ninguna escrita; el cargador ya las admite.

## El principio

- **Profundidad 0 = la cruceta**: los diez PV sobre el registro en foco.
- **En toda profundidad n ≥ 1, el dígito es el PV aplicado al nodo de arriba.** Aplicar un PV es volver a interrogar el resultado, y el orden importa (13 no es 31).
- **Ninguna profundidad es ordinal**: todos los dígitos son nominales; ni el signo ni la distancia del vector ordenan en el encaje (opción B, mapa §12 [D]).
- **Reglas cortas = época 0; reglas largas = lo que pulen las épocas.**

| Dígito | Profundidad 0 (cruceta) | Profundidades 1 a 9 (aplicado al nodo de arriba) |
|---|---|---|
| 0 | **representación** | **qué es** |
| 1 | **recursos** | **cuánto** |
| 2 | **criterios** | **con qué condición** |
| 3 | **comunicación** | **con quién** |
| 4 | **fábrica** | **qué se hace** |
| 5 | **estructura** | **dónde encaja** |
| 6 | **pasado** | **de dónde viene** |
| 7 | **futuro** | **para cuándo** |
| 8 | **comparabilidad** | **frente a otros** |
| 9 | **camino** | **cómo** |

Las preguntas son: 0 qué es (su valor o representación), 1 cuánto (cantidad, recursos), 2 con qué condición (criterio), 3 con quién, 4 qué se hace (la fórmula), 5 dónde encaja, 6 de dónde viene, 7 para cuándo, 8 frente a otros (comparación, bases), 9 cómo (guía, interpretación).

Por qué el dígito no cambia de PV de una profundidad a otra: un escrito se ancla con su raíz en cualquier dirección (`en`), y `BUSCAR` devuelve juntos propios, referencias y escritos; dentro de `FILTRAR`, `ACTUAL(m)` lee la posición m de cada candidato, sea cual sea su profundidad (`src/bql.js`). Si el dígito m significara cosas distintas según la profundidad, `ACTUAL(m)` sería ambiguo. Lo mismo dice la fábrica: su tercer dígito son los diez PV (VG, 7-11 tarde, mapa §12 [D]).

## Regla corta y regla larga

| | Regla corta | Regla larga |
|---|---|---|
| Dice | qué significa un dígito en una profundidad | qué significa una ruta completa de dos a diez dígitos |
| Dato | `{ profundidad, digito, nombre, significado, ejemplo }` | `{ ruta, nombre, significado, ejemplo }` |
| Cuántas | cien, sin huecos ni duplicados | las que haga falta, dispersas |
| Quién | la época 0 | las épocas futuras |
| Al leer | vale siempre | al leer esa ruta exacta (o una dirección que pase por ella) gana a la corta |

Retirada de la «época 1 (propuesta)»: el 7-11 noche VG decidió que sus preguntas eran justo las reglas de las profundidades 1 a 9 de la época 0. Se retiró como época (se borra `datos/epocas/epoca-1-propuesta.json` y `EPOCA_1_PROPUESTA`) y su contenido está fundido en la tabla de abajo. El nombre «época 1» sigue libre para la primera época que pula reglas largas.

## Dónde viven

| Archivo | Qué es |
|---|---|
| `datos/epocas/epoca-0.json` | La época 0: nombre, estado, decisión, principios, `ordinales: []`, las cien reglas cortas y las dudas. |
| `datos/epocas/epocas.js` | Copia generada de los JSON (`export const`), para importarlos sin fetch en Node y en el navegador. Se regenera con `npm run epocas`; una prueba avisa si está desfasada. |
| `src/epocas.js` | `PV`, `EPOCA_0`, `EPOCAS` (nombre → época), `cargarEpoca(datos, { respaldo })`, `epocaDe`, `leerDireccion(dir, época o nombre)`. |

```js
import { EPOCA_0, EPOCAS, cargarEpoca, leerDireccion } from './src/epocas.js';
EPOCA_0.reglaCorta(0, 1)                      // → 'recursos' (la cruceta)
EPOCA_0.reglaCorta(1, 4)                      // → 'qué se hace' (aplicado al nodo de arriba)
EPOCA_0.regla(1, 4)                           // → { profundidad, digito, nombre, significado, ejemplo }
EPOCA_0.ordinal(3)                            // → false: todas las profundidades son nominales
leerDireccion('1400000000')
// → [{ profundidad: 0, digito: 1, significado: 'recursos' }, { profundidad: 1, digito: 4, significado: 'qué se hace' }]
cargarEpoca(datos, { respaldo: EPOCAS['época 0'] })  // lo que falte se lee con la época 0

// Una regla larga lleva `ruta` en lugar de `profundidad` y `digito`:
const e1 = cargarEpoca({ nombre: 'ejemplo', reglas: [{ ruta: '14', nombre: 'lo que se paga' }] }, { respaldo: EPOCA_0 });
leerDireccion('1400000000', e1)
// → [{ profundidad: 0, digito: 1, significado: 'recursos' },
//    { profundidad: 1, digito: 4, significado: 'lo que se paga', larga: '14' }]
```

Una regla larga se aplica a la entrada de `leerDireccion` cuya ruta (los dígitos hasta esa profundidad) coincide exactamente con la suya, también cuando la dirección sigue más abajo; y gana a la corta. Las de la propia época mandan sobre las del respaldo. `epoca.reglaLarga(ruta)` da el nombre, `epoca.larga(ruta)` la regla entera y `epoca.largas` la lista de las propias. El ejemplo es de uso: no hay contenido de reglas largas escrito.

Una época puede declarar `"ordinales": [k, …]`: las profundidades donde el dígito es orden y no nombre. Se convierte en `epoca.ordinal(k)`, el gancho que ya usa `src/encaje.js`: solo ahí la distancia del vector ordena (opción B, mapa §12 [D]). La época 0 no declara ninguna.

Pointed, Sequenced y Mapped aceptan la época por objeto o por nombre, igual que `leerDireccion` (`decupla(ev, 'época 0', profundidad)`, `secuencia(eje, id, { epoca })`, `mapa(eje, id, { camino, epoca })`); por defecto, la época 0. Un nombre que no existe, también «época 1» y «época 1 (propuesta)», da `época desconocida`.

## Las cien reglas

### Profundidad 0: la cruceta

Los diez PV sobre el registro en foco, tal como estaban: 5 es el registro en foco, 0 la lente libre sobre él, 6·7 el eje de hilos, 8 su confluencia, 9 los caminos que bajan y 1–4 los ramales donde va la mano; en 4 se ejecuta.

| Dígito | Regla corta | Significado y ejemplo |
|---|---|---|
| 0 | **representación** | PV0: la lente libre sobre el registro en foco (nombre, cifra, imagen, HTML). Puede engañar; no garantiza verdad. *Ejemplo:* compra 0 = 'Compra del menú del día'; =LOCAL(0) lo devuelve. |
| 1 | **recursos** | PV1, reino o ciudad: cantidades, entradas y salidas, costes, disponibilidad. *Ejemplo:* compra 1 = [ref menú:1, 1, 'EUR 12']: qué, cuánto, a qué precio. |
| 2 | **criterios** | PV2, jardín: lo que distingue cosas aparentemente iguales; decisiones y preferencias; BUSCAR, FILTRAR, ORDENAR, ELEGIR. *Ejemplo:* menú 2 = ['sin gluten', 'vegetariano']; compra 2 = [ref menú:2]. |
| 3 | **comunicación** | PV3, parque acuático: hablar y escuchar, persona y grupo; no crea ni infiere relaciones ni motivos. *Ejemplo:* compra 3 = ['huesped', 'cocina']: quién habla con quién. |
| 4 | **fábrica** | PV4: preparar la actuación con recursos, criterios y comunicaciones y consolidar la elección; en 4 se ejecuta. *Ejemplo:* compra 4 = ['pagar', 'servir']; consolidar() escribe en '4000000000' (FABRICA). |
| 5 | **estructura** | PV5: el registro en foco, el centro de la cruceta (mapa §9 [D]); su estructura, referencias y firmas. *Ejemplo:* Los campos de encaje de un candidato (ORIGEN(), ACUERDO(), SIGNO()) son su 5. |
| 6 | **pasado** | PV6: hilos del pasado, registros encadenados por referencia; procedencia; más detalle cerca del presente. *Ejemplo:* El hilo de la compra: compra → menú → altas → génesis (por «sobre»). |
| 7 | **futuro** | PV7: hilos del futuro: previsiones, compromisos, expiración, ejecución condicional autorizada. *Ejemplo:* Una consolidación pendiente de autorización aparece como futuro del foco (ejeTemporal). |
| 8 | **comparabilidad** | PV8, cielo: la confluencia de los hilos; posición frente a comparables, medidas, los diez hitos nivel.grado; las estrellas no son verdad. *Ejemplo:* situar(eje, compra) sitúa la compra en su caja entre sus hermanos, leyendo la base escrita en el 8 del menú. |
| 9 | **camino** | PV9: la guía que baja de las bases: secuencias, tutoriales, siguiente paso; sugerir no es ejecutar. *Ejemplo:* Décupla del corpus V4: 9 = 'Confirmar la elección antes de registrar'. |

### Profundidad 1: la parte

Cada dígito es el PV aplicado a la mirada de la profundidad 0 (el 1 de «1.4» es «recursos» y el 4 pregunta qué se hace con ellos). Aquí se fundió la antigua propuesta de época 1.

| Dígito | Regla corta | Significado y ejemplo |
|---|---|---|
| 0 | **qué es** | Aplicado al nodo de arriba (la mirada de la profundidad 0, el PV del registro en foco): qué es la parte; su nombre o cara, lo que se ve si no se desarrolla. *Ejemplo:* compra 4.0 = 'pagar': =LOCAL(4, 0) lo devuelve; x.0 ocupa la misma dirección que x (colisión por ceros). |
| 1 | **cuánto** | Aplicado al nodo de arriba (la mirada de la profundidad 0, el PV del registro en foco): cuánto; su magnitud (número con unidad, veces, duración), donde SUMAR y el producto tienen sentido. *Ejemplo:* compra 1.1 = 1 (un menú): =LOCAL(1, 1) * 12 EUR da 12 EUR. |
| 2 | **con qué condición** | Aplicado al nodo de arriba (la mirada de la profundidad 0, el PV del registro en foco): con qué condición; el criterio que la distingue o la condiciona: precio, requisito, límite. *Ejemplo:* compra 1.2 = 'EUR 12': =REF(compra, "1200000000") da 12 EUR; una corrección escrita en '1200000000' es otro ocupante. |
| 3 | **con quién** | Aplicado al nodo de arriba (la mirada de la profundidad 0, el PV del registro en foco): con quién; su contraparte, quién la provee, la recibe o responde por ella. *Ejemplo:* Reserva de Booking con 1.3 = 'recepción': quién atiende los recursos de la reserva. |
| 4 | **qué se hace** | Aplicado al nodo de arriba (la mirada de la profundidad 0, el PV del registro en foco): qué se hace; lo que se hace o se hará con ella. El 4 del 4 es la acción de la acción. *Ejemplo:* compra 1.4 = 'pagar' (lo que se hace con el recurso) y 3.4 = 'avisar'. |
| 5 | **dónde encaja** | Aplicado al nodo de arriba (la mirada de la profundidad 0, el PV del registro en foco): dónde encaja; la dirección o referencia donde encaja en el árbol, lo que BUSCAR(LOCAL(5)) recibiría. *Ejemplo:* Reserva de Booking con 1.5 = { ref: calendario, dir: '7000000000' }: dónde encajan sus recursos. |
| 6 | **de dónde viene** | Aplicado al nodo de arriba (la mirada de la profundidad 0, el PV del registro en foco): de dónde viene; su origen y procedencia, desde cuándo y qué había antes. *Ejemplo:* La cuenta 1 sale de la compra 1.2; la reserva de Booking con 1.6 = 'entrada 14-11'. |
| 7 | **para cuándo** | Aplicado al nodo de arriba (la mirada de la profundidad 0, el PV del registro en foco): para cuándo; su plazo o compromiso, hasta cuándo vale o cuándo se cumple. *Ejemplo:* Reserva de Booking con 1.7 = 'salida 16-11 12:00'; un menú con 1.7 = 'hasta las 16:00'. |
| 8 | **frente a otros** | Aplicado al nodo de arriba (la mirada de la profundidad 0, el PV del registro en foco): frente a otros; dónde queda frente a sus comparables: diferencia, nivel, hito requerido. *Ejemplo:* Tarea con 4.8 = '3.1' (aprendizaje profesional, el hito del índice 3). |
| 9 | **cómo** | Aplicado al nodo de arriba (la mirada de la profundidad 0, el PV del registro en foco): cómo; cómo se consigue, se usa o se aplica, y el siguiente paso. *Ejemplo:* Reserva de Booking con 1.9 = 'check-in a partir de las 15:00'; tarea con 4.9 = 'poner manteles'. |

### Profundidad 2: el detalle

Cada dígito es el PV aplicado a la parte. Cuando la parte es un valor, la decena es la anatomía del valor que BQL ya maneja; un terminal no tiene posiciones (mapa §12 [D]), así que sobre un terminal es una lectura de BQL, no un nodo de BTML.

| Dígito | Regla corta | Significado y ejemplo |
|---|---|---|
| 0 | **qué es** | Aplicado al nodo de arriba (la parte, el nodo de la profundidad 1): qué es; el valor tal como se muestra. Colisiona con el detalle (x.y.0 ocupa la dirección de x.y). Si el detalle es un terminal no tiene posiciones: la lectura es de BQL sobre el valor. *Ejemplo:* compra 1.2 = 'EUR 12' es terminal: BQL lo muestra como '12 EUR'; un terminal no tiene posición 0 en BTML. |
| 1 | **cuánto** | Aplicado al nodo de arriba (la parte, el nodo de la profundidad 1): cuánto; la cantidad, el número puro. Sobre un terminal, lectura de BQL. *Ejemplo:* La cantidad de compra 1.2 es 12, el número puro. |
| 2 | **con qué condición** | Aplicado al nodo de arriba (la parte, el nodo de la profundidad 1): con qué condición; la unidad o la condición que hace válido el valor; separa magnitudes del mismo número. Sobre un terminal, lectura de BQL. *Ejemplo:* La unidad de compra 1.2 es EUR; unidades distintas no se suman, se componen (14 EUR + 15 min no se funden). |
| 3 | **con quién** | Aplicado al nodo de arriba (la parte, el nodo de la profundidad 1): con quién; quién fija el valor, lo cobra o responde por él. *Ejemplo:* El precio de compra 1.2 lo fija cocina y lo paga el huésped. |
| 4 | **qué se hace** | Aplicado al nodo de arriba (la parte, el nodo de la profundidad 1): qué se hace; la operación que lo produjo: suma, producto, elección, consolidación. *Ejemplo:* Los 14 EUR de la cuenta nacen de una suma: =REF(compra, "1200000000") + 2 EUR. |
| 5 | **dónde encaja** | Aplicado al nodo de arriba (la parte, el nodo de la profundidad 1): dónde encaja; dónde vive y quién lo firma: registro, dirección, camino de índices, firma. *Ejemplo:* La cuenta 1 depende de 'compra:1200000000' (dependencias de evaluar()). |
| 6 | **de dónde viene** | Aplicado al nodo de arriba (la parte, el nodo de la profundidad 1): de dónde viene; el desglose, los operandos y la procedencia del valor. *Ejemplo:* 14 EUR (12 EUR + 2 EUR): el desglose del valor; procedencia de sus operandos. |
| 7 | **para cuándo** | Aplicado al nodo de arriba (la parte, el nodo de la profundidad 1): para cuándo; hasta cuándo vale o cuándo se liquida. *Ejemplo:* Un precio 'de hoy'; una tarifa 'hasta el 30-11'; un precio vencido sigue siendo ocupante, con su fecha. |
| 8 | **frente a otros** | Aplicado al nodo de arriba (la parte, el nodo de la profundidad 1): frente a otros; lo ocurrido frente a lo previsto o frente a sus comparables; señala la diferencia, no puntúa. *Ejemplo:* La cuenta cobra 14 EUR frente a los 12 EUR del menú: señala la diferencia, no puntúa. |
| 9 | **cómo** | Aplicado al nodo de arriba (la parte, el nodo de la profundidad 1): cómo; el camino de cálculo, la fórmula o la instrucción que lo obtiene. *Ejemplo:* La fórmula '=REF(…) + 2 EUR'; con '==' se guarda como texto sin evaluarse. |

### Profundidad 3: el nodo de la profundidad 2

Cada dígito es el PV aplicado al nodo de la profundidad 2. De aquí a la profundidad 9, los ejemplos recorren una sola lectura ilustrativa de una reserva de Booking (1.7.2.1.3.4.7.6.1: salida tardía, suplemento, quién lo cobra, qué hace, para cuándo, de dónde viene el plazo, cuántas políticas rigen), construida para recorrer las profundidades y no como modelo de reserva.

| Dígito | Regla corta | Significado y ejemplo |
|---|---|---|
| 0 | **qué es** | Aplicado al nodo de arriba (el detalle, el nodo de la profundidad 2): qué es; su nombre, su valor o su representación tal como se muestra. *Ejemplo:* Salida tardía, hasta las 14:00 (1.7.2: la condición de la salida de la reserva de Booking). |
| 1 | **cuánto** | Aplicado al nodo de arriba (el detalle, el nodo de la profundidad 2): cuánto; su cantidad, su medida o los recursos que mueve. *Ejemplo:* Dos horas de gracia. |
| 2 | **con qué condición** | Aplicado al nodo de arriba (el detalle, el nodo de la profundidad 2): con qué condición; la condición o el criterio que lo distingue, lo limita o lo decide. *Ejemplo:* Solo si la habitación siguiente está libre. |
| 3 | **con quién** | Aplicado al nodo de arriba (el detalle, el nodo de la profundidad 2): con quién; con quién se relaciona: quién lo da, lo recibe o responde por él. *Ejemplo:* La concede recepción. |
| 4 | **qué se hace** | Aplicado al nodo de arriba (el detalle, el nodo de la profundidad 2): qué se hace; lo que se hace con él: la acción o la fórmula que lo trabaja. *Ejemplo:* Se pide y se aplica en recepción. |
| 5 | **dónde encaja** | Aplicado al nodo de arriba (el detalle, el nodo de la profundidad 2): dónde encaja; su lugar en el árbol, su referencia o su firma. *Ejemplo:* Cuelga de la salida de la reserva (1.7). |
| 6 | **de dónde viene** | Aplicado al nodo de arriba (el detalle, el nodo de la profundidad 2): de dónde viene; su origen, su procedencia y lo que había antes. *Ejemplo:* Sale de la política del alojamiento. |
| 7 | **para cuándo** | Aplicado al nodo de arriba (el detalle, el nodo de la profundidad 2): para cuándo; su plazo, su vigencia o su compromiso. *Ejemplo:* Se pide antes de las 10:00 del día de salida. |
| 8 | **frente a otros** | Aplicado al nodo de arriba (el detalle, el nodo de la profundidad 2): frente a otros; cómo queda frente a otros comparables: diferencia, nivel o base. *Ejemplo:* Frente a la salida normal de las 12:00. |
| 9 | **cómo** | Aplicado al nodo de arriba (el detalle, el nodo de la profundidad 2): cómo; la guía, la interpretación o el siguiente paso. *Ejemplo:* Se pide en recepción o por el chat de Booking. |

### Profundidad 4: el nodo de la profundidad 3

Cada dígito es el PV aplicado al nodo de la profundidad 3.

| Dígito | Regla corta | Significado y ejemplo |
|---|---|---|
| 0 | **qué es** | Aplicado al nodo de arriba (el nodo de la profundidad 3): qué es; su nombre, su valor o su representación tal como se muestra. *Ejemplo:* EUR 15 (1.7.2.1: el suplemento de la salida tardía). |
| 1 | **cuánto** | Aplicado al nodo de arriba (el nodo de la profundidad 3): cuánto; su cantidad, su medida o los recursos que mueve. *Ejemplo:* 15, la cantidad pura. |
| 2 | **con qué condición** | Aplicado al nodo de arriba (el nodo de la profundidad 3): con qué condición; la condición o el criterio que lo distingue, lo limita o lo decide. *Ejemplo:* Por hora de retraso, con tope de dos horas. |
| 3 | **con quién** | Aplicado al nodo de arriba (el nodo de la profundidad 3): con quién; con quién se relaciona: quién lo da, lo recibe o responde por él. *Ejemplo:* Lo cobra el alojamiento y lo paga el huésped. |
| 4 | **qué se hace** | Aplicado al nodo de arriba (el nodo de la profundidad 3): qué se hace; lo que se hace con él: la acción o la fórmula que lo trabaja. *Ejemplo:* Se suma a la cuenta de la reserva. |
| 5 | **dónde encaja** | Aplicado al nodo de arriba (el nodo de la profundidad 3): dónde encaja; su lugar en el árbol, su referencia o su firma. *Ejemplo:* Se apunta en la cuenta de la reserva. |
| 6 | **de dónde viene** | Aplicado al nodo de arriba (el nodo de la profundidad 3): de dónde viene; su origen, su procedencia y lo que había antes. *Ejemplo:* Sale de la tarifa del alojamiento. |
| 7 | **para cuándo** | Aplicado al nodo de arriba (el nodo de la profundidad 3): para cuándo; su plazo, su vigencia o su compromiso. *Ejemplo:* Se cobra al salir, el 16-11. |
| 8 | **frente a otros** | Aplicado al nodo de arriba (el nodo de la profundidad 3): frente a otros; cómo queda frente a otros comparables: diferencia, nivel o base. *Ejemplo:* Frente a la tarifa normal de EUR 90 por noche. |
| 9 | **cómo** | Aplicado al nodo de arriba (el nodo de la profundidad 3): cómo; la guía, la interpretación o el siguiente paso. *Ejemplo:* Se paga con tarjeta en recepción. |

### Profundidad 5: el nodo de la profundidad 4

Cada dígito es el PV aplicado al nodo de la profundidad 4.

| Dígito | Regla corta | Significado y ejemplo |
|---|---|---|
| 0 | **qué es** | Aplicado al nodo de arriba (el nodo de la profundidad 4): qué es; su nombre, su valor o su representación tal como se muestra. *Ejemplo:* Recepción (1.7.2.1.3: quién cobra el suplemento). |
| 1 | **cuánto** | Aplicado al nodo de arriba (el nodo de la profundidad 4): cuánto; su cantidad, su medida o los recursos que mueve. *Ejemplo:* Un solo puesto atiende. |
| 2 | **con qué condición** | Aplicado al nodo de arriba (el nodo de la profundidad 4): con qué condición; la condición o el criterio que lo distingue, lo limita o lo decide. *Ejemplo:* Solo de 7:00 a 22:00. |
| 3 | **con quién** | Aplicado al nodo de arriba (el nodo de la profundidad 4): con quién; con quién se relaciona: quién lo da, lo recibe o responde por él. *Ejemplo:* Responde ante la dirección del alojamiento. |
| 4 | **qué se hace** | Aplicado al nodo de arriba (el nodo de la profundidad 4): qué se hace; lo que se hace con él: la acción o la fórmula que lo trabaja. *Ejemplo:* Cobrar y dar el recibo. |
| 5 | **dónde encaja** | Aplicado al nodo de arriba (el nodo de la profundidad 4): dónde encaja; su lugar en el árbol, su referencia o su firma. *Ejemplo:* Es un puesto del equipo del alojamiento. |
| 6 | **de dónde viene** | Aplicado al nodo de arriba (el nodo de la profundidad 4): de dónde viene; su origen, su procedencia y lo que había antes. *Ejemplo:* Sale del cuadrante de turnos. |
| 7 | **para cuándo** | Aplicado al nodo de arriba (el nodo de la profundidad 4): para cuándo; su plazo, su vigencia o su compromiso. *Ejemplo:* Cada día de salida. |
| 8 | **frente a otros** | Aplicado al nodo de arriba (el nodo de la profundidad 4): frente a otros; cómo queda frente a otros comparables: diferencia, nivel o base. *Ejemplo:* Frente a gestionarlo por la aplicación de Booking. |
| 9 | **cómo** | Aplicado al nodo de arriba (el nodo de la profundidad 4): cómo; la guía, la interpretación o el siguiente paso. *Ejemplo:* Se localiza con el aviso de salida. |

### Profundidad 6: el nodo de la profundidad 5

Cada dígito es el PV aplicado al nodo de la profundidad 5.

| Dígito | Regla corta | Significado y ejemplo |
|---|---|---|
| 0 | **qué es** | Aplicado al nodo de arriba (el nodo de la profundidad 5): qué es; su nombre, su valor o su representación tal como se muestra. *Ejemplo:* Cobrar y dar el recibo (1.7.2.1.3.4: lo que hace recepción). |
| 1 | **cuánto** | Aplicado al nodo de arriba (el nodo de la profundidad 5): cuánto; su cantidad, su medida o los recursos que mueve. *Ejemplo:* Una vez por reserva. |
| 2 | **con qué condición** | Aplicado al nodo de arriba (el nodo de la profundidad 5): con qué condición; la condición o el criterio que lo distingue, lo limita o lo decide. *Ejemplo:* Solo con la cuenta cerrada. |
| 3 | **con quién** | Aplicado al nodo de arriba (el nodo de la profundidad 5): con quién; con quién se relaciona: quién lo da, lo recibe o responde por él. *Ejemplo:* Lo hace quien esté en el turno. |
| 4 | **qué se hace** | Aplicado al nodo de arriba (el nodo de la profundidad 5): qué se hace; lo que se hace con él: la acción o la fórmula que lo trabaja. *Ejemplo:* Primero se cobra; después se da el recibo. |
| 5 | **dónde encaja** | Aplicado al nodo de arriba (el nodo de la profundidad 5): dónde encaja; su lugar en el árbol, su referencia o su firma. *Ejemplo:* Es un paso de la salida. |
| 6 | **de dónde viene** | Aplicado al nodo de arriba (el nodo de la profundidad 5): de dónde viene; su origen, su procedencia y lo que había antes. *Ejemplo:* Viene del protocolo de salida. |
| 7 | **para cuándo** | Aplicado al nodo de arriba (el nodo de la profundidad 5): para cuándo; su plazo, su vigencia o su compromiso. *Ejemplo:* Antes de entregar la llave. |
| 8 | **frente a otros** | Aplicado al nodo de arriba (el nodo de la profundidad 5): frente a otros; cómo queda frente a otros comparables: diferencia, nivel o base. *Ejemplo:* Frente a cobrar por adelantado. |
| 9 | **cómo** | Aplicado al nodo de arriba (el nodo de la profundidad 5): cómo; la guía, la interpretación o el siguiente paso. *Ejemplo:* Se hace siguiendo el protocolo de salida. |

### Profundidad 7: el nodo de la profundidad 6

Cada dígito es el PV aplicado al nodo de la profundidad 6.

| Dígito | Regla corta | Significado y ejemplo |
|---|---|---|
| 0 | **qué es** | Aplicado al nodo de arriba (el nodo de la profundidad 6): qué es; su nombre, su valor o su representación tal como se muestra. *Ejemplo:* Al salir, el 16-11 (1.7.2.1.3.4.7: el plazo de cobrar). |
| 1 | **cuánto** | Aplicado al nodo de arriba (el nodo de la profundidad 6): cuánto; su cantidad, su medida o los recursos que mueve. *Ejemplo:* Media hora de margen. |
| 2 | **con qué condición** | Aplicado al nodo de arriba (el nodo de la profundidad 6): con qué condición; la condición o el criterio que lo distingue, lo limita o lo decide. *Ejemplo:* Se cumple cuando el huésped llega a recepción. |
| 3 | **con quién** | Aplicado al nodo de arriba (el nodo de la profundidad 6): con quién; con quién se relaciona: quién lo da, lo recibe o responde por él. *Ejemplo:* Lo vigila recepción. |
| 4 | **qué se hace** | Aplicado al nodo de arriba (el nodo de la profundidad 6): qué se hace; lo que se hace con él: la acción o la fórmula que lo trabaja. *Ejemplo:* Se avisa al huésped el día antes. |
| 5 | **dónde encaja** | Aplicado al nodo de arriba (el nodo de la profundidad 6): dónde encaja; su lugar en el árbol, su referencia o su firma. *Ejemplo:* Cae en el último día de la estancia. |
| 6 | **de dónde viene** | Aplicado al nodo de arriba (el nodo de la profundidad 6): de dónde viene; su origen, su procedencia y lo que había antes. *Ejemplo:* Viene de la hora de salida de la reserva (1.7). |
| 7 | **para cuándo** | Aplicado al nodo de arriba (el nodo de la profundidad 6): para cuándo; su plazo, su vigencia o su compromiso. *Ejemplo:* Hasta que el huésped salga. |
| 8 | **frente a otros** | Aplicado al nodo de arriba (el nodo de la profundidad 6): frente a otros; cómo queda frente a otros comparables: diferencia, nivel o base. *Ejemplo:* Frente a las salidas de las otras reservas del día. |
| 9 | **cómo** | Aplicado al nodo de arriba (el nodo de la profundidad 6): cómo; la guía, la interpretación o el siguiente paso. *Ejemplo:* Se recuerda con un aviso por la mañana. |

### Profundidad 8: el nodo de la profundidad 7

Cada dígito es el PV aplicado al nodo de la profundidad 7.

| Dígito | Regla corta | Significado y ejemplo |
|---|---|---|
| 0 | **qué es** | Aplicado al nodo de arriba (el nodo de la profundidad 7): qué es; su nombre, su valor o su representación tal como se muestra. *Ejemplo:* La política de salida del alojamiento (1.7.2.1.3.4.7.6: de dónde viene el plazo). |
| 1 | **cuánto** | Aplicado al nodo de arriba (el nodo de la profundidad 7): cuánto; su cantidad, su medida o los recursos que mueve. *Ejemplo:* Una sola política para todo el alojamiento. |
| 2 | **con qué condición** | Aplicado al nodo de arriba (el nodo de la profundidad 7): con qué condición; la condición o el criterio que lo distingue, lo limita o lo decide. *Ejemplo:* Vale salvo acuerdo escrito con la dirección. |
| 3 | **con quién** | Aplicado al nodo de arriba (el nodo de la profundidad 7): con quién; con quién se relaciona: quién lo da, lo recibe o responde por él. *Ejemplo:* La fija la dirección. |
| 4 | **qué se hace** | Aplicado al nodo de arriba (el nodo de la profundidad 7): qué se hace; lo que se hace con él: la acción o la fórmula que lo trabaja. *Ejemplo:* Se aplica a cada reserva. |
| 5 | **dónde encaja** | Aplicado al nodo de arriba (el nodo de la profundidad 7): dónde encaja; su lugar en el árbol, su referencia o su firma. *Ejemplo:* Cuelga de las normas de la casa. |
| 6 | **de dónde viene** | Aplicado al nodo de arriba (el nodo de la profundidad 7): de dónde viene; su origen, su procedencia y lo que había antes. *Ejemplo:* Viene de las condiciones del alojamiento publicadas en Booking. |
| 7 | **para cuándo** | Aplicado al nodo de arriba (el nodo de la profundidad 7): para cuándo; su plazo, su vigencia o su compromiso. *Ejemplo:* Vigente hasta fin de temporada. |
| 8 | **frente a otros** | Aplicado al nodo de arriba (el nodo de la profundidad 7): frente a otros; cómo queda frente a otros comparables: diferencia, nivel o base. *Ejemplo:* Frente a la política de otros alojamientos. |
| 9 | **cómo** | Aplicado al nodo de arriba (el nodo de la profundidad 7): cómo; la guía, la interpretación o el siguiente paso. *Ejemplo:* Se lee en las condiciones publicadas. |

### Profundidad 9: el nodo de la profundidad 8

Cada dígito es el PV aplicado al nodo de la profundidad 8.

| Dígito | Regla corta | Significado y ejemplo |
|---|---|---|
| 0 | **qué es** | Aplicado al nodo de arriba (el nodo de la profundidad 8): qué es; su nombre, su valor o su representación tal como se muestra. *Ejemplo:* Una sola política, la publicada (1.7.2.1.3.4.7.6.1: cuántas políticas rigen). |
| 1 | **cuánto** | Aplicado al nodo de arriba (el nodo de la profundidad 8): cuánto; su cantidad, su medida o los recursos que mueve. *Ejemplo:* Un solo documento. |
| 2 | **con qué condición** | Aplicado al nodo de arriba (el nodo de la profundidad 8): con qué condición; la condición o el criterio que lo distingue, lo limita o lo decide. *Ejemplo:* Sin excepciones salvo acuerdo escrito. |
| 3 | **con quién** | Aplicado al nodo de arriba (el nodo de la profundidad 8): con quién; con quién se relaciona: quién lo da, lo recibe o responde por él. *Ejemplo:* La publica el alojamiento ante sus huéspedes. |
| 4 | **qué se hace** | Aplicado al nodo de arriba (el nodo de la profundidad 8): qué se hace; lo que se hace con él: la acción o la fórmula que lo trabaja. *Ejemplo:* Se aplica a todas las reservas. |
| 5 | **dónde encaja** | Aplicado al nodo de arriba (el nodo de la profundidad 8): dónde encaja; su lugar en el árbol, su referencia o su firma. *Ejemplo:* Cuelga de las condiciones del alojamiento. |
| 6 | **de dónde viene** | Aplicado al nodo de arriba (el nodo de la profundidad 8): de dónde viene; su origen, su procedencia y lo que había antes. *Ejemplo:* Viene de la última revisión de las condiciones. |
| 7 | **para cuándo** | Aplicado al nodo de arriba (el nodo de la profundidad 8): para cuándo; su plazo, su vigencia o su compromiso. *Ejemplo:* Vigente toda la temporada. |
| 8 | **frente a otros** | Aplicado al nodo de arriba (el nodo de la profundidad 8): frente a otros; cómo queda frente a otros comparables: diferencia, nivel o base. *Ejemplo:* Frente a la política del año anterior. |
| 9 | **cómo** | Aplicado al nodo de arriba (el nodo de la profundidad 8): cómo; la guía, la interpretación o el siguiente paso. *Ejemplo:* Se lee en la ficha del alojamiento. |

## Para decidir VG

Lo que sigue abierto y no se decidió al completar la época 0 (la numeración es nueva; vienen de las dudas de la propuesta retirada). Todo está marcado «[X] decidir VG».

- 1 · [X] decidir VG. Varios en una posición: ¿hilera, ocupantes o las dos? Hoy menú 1 = ['ensalada', 'guiso', 'fruta'] y, en la época 0, LOCAL(1, 1) = 'guiso' se lee como «cuánto». Opciones: (a) aceptar que una hilera escrita en una posición de PV se lea como décupla y que la procedencia diga que vino de una hilera; (b) que una lista sean ocupantes (tres platos = tres escritos en '1000000000', tres T:minuto); (c) que alguna profundidad sea de orden, lo que rompe el principio de invariancia. De esto depende que exista alguna profundidad ordinal.
- 2 · [X] decidir VG. ¿Son estas las etiquetas que Mapped debe mostrar al bajar dentro de una posición (qué, cuánto, con qué condición…)? Con la época 0, mapped.mapa ya da estas etiquetas en toda profundidad ≥ 1.
- 3 · [X] decidir VG. Anatomía del valor en la profundidad 2: ¿posiciones consultables (LOCAL(1, 2, 2) = 'EUR') o lectura de BQL sobre los campos que ya guarda (unidad, desglose, dependencias)? En el registro de salida de la fábrica ya está decidido (VG, 7-11 tarde, mapa §12 [D]): el tercer dígito es la clase de modificación (0 ver/sustituir, 1 impulso de recursos, 2 criterio, 3 comunicación, 4 acción…), matriz 10×10×10. Queda fuera de la fábrica.
- 4 · [X] decidir VG. ¿Qué profundidad es ordinal, si alguna? El signo ya está decidido (VG, 7-11 tarde, mapa §12 [D]: opción B de docs/notas/SIGNO_DEL_VECTOR.md; ni signo ni distancia ordenan hasta que una época haga ordinal una profundidad, y entonces solo ahí). Candidatas: los diez hitos de PV8 (índice = hito), las siete escalas de T en 6·7, los pasos de 9; son prefijos concretos, así que irían como reglas largas de prefijo o haciendo ordinal la profundidad entera.
- 5 · [X] decidir VG. Cruz y X dentro de cada pieza: ¿0 y 5–9 los dan el eje y la reconstrucción y 1–4 los escribe la mano también en las profundidades 1 y 2, de modo que el motor pueda proponer el 1–4 de una pieza desde sus 6·7·8·9 (1 entre 6 y 8, 2 entre 8 y 7, 3 entre 6 y 9, 4 entre 7 y 9)? Y lo declarado frente a lo derivado en 5 y 6: ¿dos ocupantes que colisionan? En el 8 ya lo resuelven las bases (VG, 7-11 tarde, mapa §12 [D]): lo derivado son registros escritos en el 8 de lo que resumen, ocupantes que colisionan con lo declarado; corregir es añadir otra base.
- 6 · [X] decidir VG. Candidatos pendientes (comprobado en el código): sobre la compra, FILTRAR(BUSCAR("4000000000"), ACTUAL(0) = "pagar") da PENDIENTE, porque la colisión entera trae dos candidatos, la 4 y la 4.0, y la 4.0, 'pagar', es terminal y no tiene 0: un candidato pendiente deja pendiente todo el FILTRAR. Por índice no pasa: FILTRAR(BUSCAR(4), ACTUAL(0) = "pagar") da un candidato, la 4 (camino exacto), porque su 0 es 'pagar'. El corpus V4 deja abierta la «política de filtrado de candidatos pendientes». ¿Se aparta y se cuenta el candidato pendiente, o se para la consulta?
- 7 · [X] decidir VG. motor.ejecutar() pone las referencias a la consolidación y a la autorización en las posiciones 1 y 2 del payload; por PV les tocarían 5 (firma y referencia) y 6 (de dónde viene). ¿Se cambia?
- 8 · [X] decidir VG. La fase de la fábrica vive hoy en contexto.fase: ¿se escribe en el payload para que BQL la lea (el 4 del 4)? Y la cadena consolidación → autorización → ejecución, anclada cada una en el 4 del registro anterior: ¿se lee como profundidad dentro del foco (4.4…) o como cambio de foco en cada paso? Hoy arbol() no concatena anclajes. Ya decidido alrededor (mapa §12 [D]): la autorización y la ejecución reales son de AARPIA, y el registro de salida de la fábrica es la matriz 10×10×10 con la clase de modificación como tercer dígito.
- 9 · [X] decidir VG. ¿El 5 guarda la dirección donde encaja lo buscado, de modo que BUSCAR(LOCAL(5)) tenga sentido (corpus V4)? Lo demás ya lo decidió VG (7-11 tarde, mapa §12 [D]): BUSCAR por índice y por dirección, las dos sin ambigüedad; un número es índice (camino exacto, relativo al anfitrión) y un texto de diez dígitos es dirección (absoluta en el registro, nombra la colisión entera), como BUSCAR("8412300000"), igual que las referencias. Las dos están implementadas desde la PR #36 (src/bql.js, docs/BQL.md §7.4), y el ejemplo de Tasks ya busca con BUSCAR(LOCAL(5)) el texto de diez dígitos que guarda en su 5.
- 10 · [X] decidir VG. compra 3 = ['huesped', 'cocina'] se lee en la época 0 como 3.0 «qué es» y 3.1 «cuánto». ¿Se reescribe el ejemplo (por ejemplo 3 = ['pide el menú', 1, 'sin gluten', 'cocina'], que obliga a rellenar 3.1 y 3.2) o se acepta la hilera (duda 1)?
- 11 · [X] decidir VG. Más de diez (mesas de doce, grupos grandes): ¿registro propio referenciado o vista BQL, como propone el principio?
- 12 · [X] decidir VG. Subir desde una fórmula honda: LOCAL lee hermanos de su misma profundidad (en 1.2, LOCAL(1) es 1.1); para leer el foco hace falta REF(id del foco, dirección). ¿Basta o hace falta un ámbito para el foco?
