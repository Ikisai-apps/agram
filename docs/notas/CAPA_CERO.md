# La capa cero: el libro de transacciones

Nota · 9-11-2026 · Paso 1 del plan del mapa global (§16, «La capa cero: transacciones») · Cambia la forma del motor, no su comportamiento: los tests de antes pasan igual y los ejemplos de los documentos dan la misma salida.

**Lo que decidió VG (9-11).** La capa de abajo es la de transacciones: cinco primitivas (acuñar, transferir, bloquear con salida, liberar, quemar), un anclaje (`sobre`, `en`) y un memo (el payload BTML). «Registrar es hacer una transacción.» Las reglas de economía pasarán a ser condiciones de validez escritas en BQL (paso 2); en este paso no se reescribe ninguna regla: se cambia la forma del motor para que quepan.

**Qué hay ahora.**

- `src/libro.js`: el libro. Asientos por identidad y serie (disponible, y bloqueado por salida), las cinco primitivas, la atomicidad (una transacción se aplica entera o nada) y un evaluador de condiciones enchufable. Sin reglas de negocio: solo aritmética.
- `src/condiciones/`: las reglas de siempre, envueltas tal cual como condiciones de validez, por familias (`evento.js`, `identidad.js`, `ciclo.js`, `tope.js`, `r.js`) y en el mismo orden en que las aplicaba `eje.validar`. Cada una cita las filas de `docs/notas/INVENTARIO_REGLAS.md` §2 que cubre.
- `src/eje.js`: `Eje` conserva su API, pero por dentro traduce cada evento a una transacción (`eje.transaccion(ev)`) y delega en el libro con las condiciones. Saldos, bloqueos, lo emitido y consumido de cada serie, el T gastado del día y el T consumido sobre cada registro se leen del libro (`eje.libro`).
- `src/validez.js`: las capas leen el eje de justo antes del registro (`eje.antes(k)`, el mismo eje reaplicado) y evalúan las mismas condiciones del ciclo y de R (`motivosDe`). Una sola verdad.
- La persistencia no cambia: se guarda la lista de eventos (versión 3) y el libro se reconstruye aplicándolos.

## 1. El libro

| Qué | Cómo |
|---|---|
| Primitivas | `acunar(serie, a, cantidad)`, `transferir(serie, de, a, cantidad)`, `bloquear(serie, de, cantidad, salida)`, `liberar(serie, de, cantidad, salida)`, `quemar(serie, de, cantidad)`: construyen el objeto de la primitiva |
| Transacción | `transaccion({ movimientos, ancla: { sobre, en }, memo, autor, t, firma, abre, … })`. `movimientos` son PASOS: una primitiva o un grupo (un array) que se aplica entero o nada. `abre`: cuentas que nacen con ella aunque no reciban nada (el autor del génesis) |
| Aplicar | `await libro.aplicar(tx, condiciones, contexto)` → `{ ok, motivos }`: evalúa las condiciones sobre el libro de antes, simula los pasos en orden y, si no hay motivos, la asienta |
| Probar | `await libro.probar(tx, condiciones, contexto)` → `{ motivos, simulacion }`, sin tocar el libro; `libro.evaluar(tx, condiciones, contexto)`, solo las condiciones; `libro.asentar(tx, simulacion?)`, sin condiciones (reconstruir), y lanza si la aritmética falla |
| Leer | `saldo(id, serie)`, `bloqueado(id, serie, salida?)`, `bloqueadoPorSalida(salida, serie?)`, `bloqueos(id)`, `bloqueosCon(salida)`, `vista(id)` (la cartera por series: lo que será la posición 1 del alta), `alta(id)` (la transacción que abrió su cuenta), `titulares()`, `tiene(id)` |
| Sumas | `sumas({ primitiva, serie, registro, titular, clase, etiqueta, desde, hasta })`: lo que leen las bases. Sin tramo, de un índice; con tramo (`desde`, `hasta`: transacciones en orden de llegada), del diario. `asientos(filtro)`: el diario |

Una condición es una función `(tx, libroAntes, contexto) → null | motivo` (o un objeto `{ nombre, filas, familia, evaluar }`); un motivo es un texto, un objeto `{ texto, … }` o una lista. Un motivo con `paso` rechaza un movimiento concreto: ese paso no se simula y su motivo va en su sitio entre los fallos de la aritmética (así lo hacía el eje con «nadie mueve tokens ajenos»).

Tres opciones aritméticas de las primitivas, para que las reglas de hoy quepan sin cambiar de comportamiento:

- `clase` y `etiqueta`: el libro suma aparte cada clase (`emision`, `asignacion`, `informativo`, `reposicion`) y, por titular, cada etiqueta. Lo emitido de una serie es lo acuñado como emisión; el T gastado de un día es lo acuñado como asignación con la etiqueta de ese día.
- `tope` (acuñar): acuña como mucho lo que falte para que lo acuñado con esa clase y etiqueta llegue al tope. Es la acuñación programada del mapa §16 («T: acuñación programada por reloj, quemar al gastar»): quien fija el tope (la asignación del día, TT-2) es la regla, no el libro.
- `fuentes` (transferir, quemar): las series de donde sale, en orden. Es el débito de P que sube por el hilo (PP-4); lo que sale de otra serie queda en el diario como reposición, quemar allí y acuñar aquí con factor 1, que es la forma del P nuevo («reposicionar = quemar y acuñar con factor», mapa §16).

## 2. Evento ↔ transacción

`eje.transaccion(ev)` da un paso por movimiento, en su orden (un movimiento mal formado es un paso vacío: lo cuenta la forma).

| Movimiento del evento | Paso de la transacción |
|---|---|
| `de: null` (emitir) | `acunar(serie, a, cantidad)`, clase `emision` |
| `estado: 'bloqueo'` | `bloquear(serie, de, cantidad, salida)` |
| `estado: 'liberacion'` | `liberar(serie, de, cantidad, salida)` |
| P con `de` | `transferir(P:ámbito, de, a, cantidad, { fuentes })` (o `quemar` si `a: null`), con las fuentes del ámbito más concreto al génesis (`eje.ambitosQueCubren`) |
| T informativo (pasado, futuro, inventado) | `acunar(T:x, autor, c)` clase `informativo` + `quemar(T:x, autor, c)`, con su `refiere` y su `nota`: «si lo gastas te vuelve a salir uno» |
| T de la asignación del día (una persona con alta) | `acunar(T:e, autor, c)` clase `asignacion`, etiqueta = el día civil, tope = la asignación del día + `quemar` (o `transferir` a una cosa): lo que falte sale del T explícito |
| lo demás con `a: null` | `quemar(serie, de, cantidad)` |
| lo demás | `transferir(serie, de, a, cantidad)` |
| `sobre`, `en` | `ancla: { sobre, en }` |
| `payload` | `memo` |
| `autor`, `t`, `id`, `firma`, `firmante` | los mismos campos de la transacción |
| `contexto.genesis` | `abre: [autor]`: la cuenta del autor del génesis nace con él |

Lo que el eje guardaba aparte y ahora lee del libro (inventario §4):

| Antes | Ahora |
|---|---|
| `saldos`, `bloqueados`, `#porSalida` | `libro.saldo`, `libro.bloqueado`, `libro.bloqueadoPorSalida`, `libro.bloqueos(Con)` (`eje.saldos` y `eje.bloqueados` siguen como copias leídas del libro) |
| `#altas` | `libro.alta(id)`: la primera transacción que abrió su cuenta |
| `#series`: emitido, consumido, `deAsignacion` | sumas de lo acuñado como emisión, de lo quemado y de lo acuñado como asignación; el eje solo guarda qué series existen, su emisor y su contrato (E) |
| `#gastadoT` | `sumas({ primitiva: 'acunar', serie: 'T:<escala>', titular, clase: 'asignacion', etiqueta: <día> })` |
| `#tiempoSobre` | `sumas({ primitiva: 'quemar', serie: 'T:<escala>', registro })` |
| `#informativo` | `asientos({ primitiva: 'quemar', clase: 'informativo', registro })` |
| `libroAntes` de `src/validez.js` | `eje.antes(k)`: el eje con los `k` primeros eventos, con su libro |

Siguen en el eje (no son aritmética de saldos): las claves y los tipos de las altas, el reloj (`tMaximo`), las consolidaciones que ya ampliaron P (R3), el prefijo de la versión 2 y los índices (lo escrito sobre cada registro, por posición, por autor, por prefijo).

## 3. Las condiciones envueltas

En el orden en que se evalúan (`CONDICIONES` en `src/condiciones/index.js`), que es el de `eje.validar` antes de este cambio. «Suelo» es lo que el inventario (§1) deja como código. La última columna (encargo 2, 9-11) dice qué regla de `epoch.2` la traduce, por su posición 2.g.k (`docs/BQLM.md` §10), o que no cabe (el motivo, en §10.3). Las reglas aún no están conectadas: el eje sigue usando estas condiciones.

| Condición | Filas del inventario | Archivo | Qué comprueba (de dónde venía) | Regla BQLM (`docs/BQLM.md` §10) |
|---|---|---|---|---|
| `EV-1` | EV-1, EV-2, EV-3, TT-5, TT-7, PP-1, BL-1, RR-1 | `evento.js` | la forma del evento y de sus movimientos (`validarForma`) | 2.0.1, 2.0.0 (EV-2), 2.0.2 (TT-7), 2.0.3 (TT-5), 2.0.4 (BL-1), 2.0.5 y 2.0.6 (la emisión va a su emisor); el resto de la forma es suelo; RR-1, retirada |
| `suelo:id` | — | `evento.js` | el id es el hash del cuerpo | — (suelo) |
| `suelo:nuevo` | — | `evento.js` | el evento no está ya | — (suelo) |
| `suelo:un-genesis` | — | `evento.js` | solo hay un génesis | — (suelo) |
| `ancla` | — | `evento.js` | el foco existe (solo el génesis no tiene) | 2.1.0 |
| `ID-1` | ID-1 | `evento.js` | el autor tiene cuenta en el libro (su alta) | 2.1.1 |
| `ID-5` | ID-4, ID-5 | `identidad.js` | quien tiene clave firma; sin clave no se actúa (R9) | no cabe |
| `ID-6` | ID-2, ID-6 | `identidad.js` | las claves se declaran en el alta, con su prueba de posesión | no cabe |
| `ID-3` | ID-2, ID-3 | `identidad.js` | los tipos se declaran en el alta y no cambian; sin grupos | no cabe |
| `VA-3` | VA-3 | `ciclo.js` | las reglas de emisión de la versión 2, en su prefijo | no cabe |
| `RL-1` | RL-1, RL-2, RL-3 | `ciclo.js` | el reloj: ni antes que el foco ni que el alta del autor, ni más de un año por delante | 2.1.2, 2.1.3, 2.1.4 |
| `ID-9` | ID-9, ID-10, TT-1, PP-2, PP-3, EE-9 | `ciclo.js` | quién emite: solo personas, a su nombre; T no; P sobre un registro suyo, una vez (R3); la caducidad de la serie | 2.1.5 (R), 2.0.5 (E), 2.1.6 (TT-1), 2.1.7 y 2.1.8 (PP-2); no caben «solo las personas emiten», PP-3 y EE-9 |
| `TT-6` | TT-6 | `ciclo.js` | T no se bloquea ni se libera | 2.1.9 |
| `TT-4` | TT-2, TT-3, TT-4 | `ciclo.js` | T del día agotado | 2.0.0 |
| `TT-8` | TT-8, TT-9 | `ciclo.js` | T no cruza de persona; de cosa a cosa, solo del mismo dueño | no cabe |
| `PP-5` | PP-5 | `ciclo.js` | no se estrecha P hacia una serie cerrada ni hacia la raíz de otro | no cabe |
| `ES-1` | ES-1, ES-2, ES-3 | `ciclo.js` | el escalonado: R exige T; P, T y R en juego; E, además P sobre el registro | 2.2.0, 2.2.1, 2.2.2 |
| `VA-3` | VA-3 | `tope.js` | en el prefijo de la versión 2, la E no lleva registro, divisible ni emisores | no cabe |
| `EE-1` | EE-1, EE-9 | `tope.js` | el registro de la serie de E existe; su contrato (divisible, emisores) | 2.2.3 (el registro); el contrato no cabe |
| `EE-8` | EE-8 | `tope.js` | el P que respalda E vivo no se libera | 2.2.4 (salida de una serie); la de familia no cabe |
| `EE-10` | EE-10 | `tope.js` | en la emisión conjunta, cada coemisor tiene su P bloqueado | no cabe |
| `EE-5` | EE-3, EE-4, EE-5, EE-6, EE-7, EE-11, RL-4 | `tope.js` | el tope compartido por franja y la cuota por P bloqueado | no cabe |
| `RR-3` | RR-3 | `r.js` | emitir R exige colateral | retirada (VG, 9-11); 2.1.5 sin colateral |
| `RR-4` | RR-4 | `r.js` | el colateral no se libera con devoluciones sin atender ni bajo el mínimo | retirada (VG, 9-11) |
| `RR-5` | RR-5 | `r.js` | solo el emisor atiende las devoluciones de su R | no cabe |
| `ID-8` | ID-8 | `identidad.js` | de paso: nadie mueve tokens ajenos | 2.2.5 |
| `PP-4` | PP-4 | `ciclo.js` | de paso: el ámbito del P que se mueve existe | 2.2.6 |

Después, la aritmética del libro, paso a paso: saldo disponible, bloqueado con esa salida, series finitas. El eje pone a sus fallos el texto de siempre (`saldo insuficiente de <serie> en <id>`, `saldo disponible insuficiente para bloquear …`, `no hay … bloqueado en … con la salida «…»`, `saldo insuficiente de P sobre …`, `la serie … no admite tanto`); el gasto de la asignación del día que no alcanza no lleva texto propio porque ya lo dice `TT-4`.

Al crear un eje, el génesis pasa `GN-1` (GN-1, GN-2, TT-1: lo que emite y declara) y `GN-2` (GN-2, ID-5, ID-7: su firma); al restaurarlo, además, su forma (`EV-1`) y su id, y la firma solo si todo lo demás pasa. En BQL mínimo, lo que comprueba `GN-1` está en las reglas 2.0.7, 2.0.8 y 2.0.9 y, en el génesis, también en 2.0.5, 2.1.5, 2.1.6 y 2.2.5; `GN-2` no cabe.

Las secciones de las reglas siguen en su sitio y se pueden llamar enteras como antes: `reglasDelCiclo` (`src/ciclo.js`, con `SECCIONES_DEL_CICLO`), `reglasDelTope` (`src/condiciones/tope.js`, reexportada por `src/eje.js`) y `reglasDeR` (`src/lente.js`, con `SECCIONES_DE_R`).

## 4. Un ejemplo

La compra de comida de Ikisai: la huésped paga doce euros a la cocina y gasta una hora de su día. Su transacción, su cartera y un evento que no pasa:

```js
import { ejemploCompra } from './ejemplos/ikisai/compra-food.mjs';
import { crearEvento } from './src/evento.js';
import { CONDICIONES } from './src/condiciones/index.js';
const { eje, menu, compra } = await ejemploCompra();
const texto = (p) => p.primitiva + '(' + [p.serie, p.de, p.a].filter(Boolean).join(', ') + ', ' + p.cantidad + ')' + (p.clase ? ' [' + p.clase + (p.tope !== undefined ? ', tope ' + p.tope : '') + ']' : '');
const tx = eje.antes(eje.orden.indexOf(compra.id)).transaccion(compra);
console.log('ancla:', tx.ancla.sobre.slice(0, 8), tx.ancla.en, '· autor:', tx.autor, '· memo: el payload de la compra');
tx.movimientos.forEach((paso, i) => console.log('paso ' + i + ':', paso.map(texto).join(' + ')));
console.log('cartera de huesped:', JSON.stringify(eje.libro.vista('huesped')));
console.log('T sobre el menú:', JSON.stringify(eje.tiempoSobre(menu.id)));
const malo = await crearEvento({ autor: 'huesped', sobre: menu.id, t: compra.t, payload: 'vale', movimientos: [
  { token: 'T', escala: 'minuto', cantidad: 1, de: 'huesped', a: null },
  { token: 'E', emisor: 'huesped', denominacion: 'vale', cantidad: 1, de: null, a: 'huesped' },
  { token: 'E', emisor: 'casa', denominacion: 'EUR', cantidad: 100, de: 'huesped', a: 'cocina' }] });
const { motivos } = await eje.libro.probar(eje.transaccion(malo), CONDICIONES, eje.contexto(malo));
for (const m of motivos) console.log((m.condicion ?? 'aritmética, paso ' + m.paso) + ': ' + m.texto);
console.log(await eje.validar(malo));
```

```text
ancla: 61aa68f7 0000000000 · autor: huesped · memo: el payload de la compra
paso 0: acunar(T:hora, huesped, 1) [asignacion, tope 24] + quemar(T:hora, huesped, 1)
paso 1: transferir(E:casa/EUR, huesped, cocina, 12)
cartera de huesped: {"E:casa/EUR":{"disponible":48,"bloqueado":{}}}
T sobre el menú: {"hora":1}
ES-1: emitir E exige R propia en juego: R:huesped bloqueada como colateral (salida «R:huesped»), al menos la décima parte de lo emitido de R:huesped, antes o en el mismo evento (R6)
ES-1: emitir E exige P del autor sobre el registro 61aa68f7 (saldo o movimiento de P en el mismo evento)
aritmética, paso 2: saldo disponible insuficiente de E:casa/EUR en huesped: 100 pedido
[
  'emitir E exige R propia en juego: R:huesped bloqueada como colateral (salida «R:huesped»), al menos la décima parte de lo emitido de R:huesped, antes o en el mismo evento (R6)',
  'emitir E exige P del autor sobre el registro 61aa68f7 (saldo o movimiento de P en el mismo evento)',
  'saldo insuficiente de E:casa/EUR en huesped'
]
```

La hora de la huésped no es un saldo: sale de su asignación del día (acuñación programada con tope 24) y se quema sobre el menú, que es lo que `tiempoSobre` suma. El evento malo falla por dos condiciones (`ES-1`, el escalonado) y por la aritmética del paso 2; `eje.validar` da los mismos motivos con el texto de siempre.

## 5. Lo que queda para los pasos siguientes

- Las condiciones son las reglas de JavaScript de siempre, envueltas: el paso 2 las escribió en BQL mínimo, en `epoch.2` (27 reglas verificadas contra estas condiciones, `docs/BQLM.md` §10, `test/reglas-bqlm.test.js`); conectarlas al eje y retirar estas es el encargo 3.
- La capa 4 de validez (`capaAcreditacion`) conserva su simulación por movimiento, con sus propios textos («saldo de … tiene …, mueve …»), aunque lee el libro de antes y las mismas condiciones; pasarla a la simulación del libro cambiaría sus textos.
- `src/bases.js` (`poderAntes`) rehace a mano el débito de P anterior a una base; las bases leen el T sobre cada registro, que ya viene del libro. Pasar sus sumas a `libro.sumas` es del paso del 8.
- El génesis no emite T y la asignación diaria no es todavía una acuñación por reloj de verdad: se acuña al gastar, con tope. Igual con el T informativo.
- Prueba: `test/libro.test.js` (las primitivas, la atomicidad, las sumas, las condiciones) y `test/capa-cero.test.js` (los ejemplos de Ikisai contra la aritmética de antes rehecha a mano, la correspondencia evento ↔ transacción, la reconstrucción y el orden de las condiciones). Para cambiar la forma y no el comportamiento, solo se tocó un test: la lista de sitios que pueden leer el tipo de una identidad (R10, `test/neutralidad-reglas.test.js`) añade `src/condiciones/identidad.js`, adonde se movieron las comprobaciones del alta y del génesis.
