# La capa cero: el libro de transacciones

Nota · 9-11-2026 · Paso 1 del plan del mapa global (§16, «La capa cero: transacciones») · Cambia la forma del motor, no su comportamiento: los tests de antes pasan igual y los ejemplos de los documentos dan la misma salida. Puesta al día con el encargo 3b (VG, 8-11 a 10-11, mapa §15 y §16): lo que el 3b cambia ya no vive en JavaScript (§3).

**Lo que decidió VG (9-11).** La capa de abajo es la de transacciones: cinco primitivas (acuñar, transferir, bloquear con salida, liberar, quemar), un anclaje (`sobre`, `en`) y un memo (el payload BTML). «Registrar es hacer una transacción.» Las reglas de economía pasarán a ser condiciones de validez escritas en BQL (paso 2); en este paso no se reescribe ninguna regla: se cambia la forma del motor para que quepan.

**Qué hay ahora.**

- `src/libro.js`: el libro. Asientos por identidad y serie (disponible, y bloqueado por salida), las cinco primitivas, la atomicidad (una transacción se aplica entera o nada) y un evaluador de condiciones enchufable. Sin reglas de negocio: solo aritmética.
- `src/condiciones/`: el suelo y lo que queda de las reglas de JavaScript (desde el encargo 3a, junto a las reglas de la época conectadas: `reglas.js`, §3), como condiciones de validez, por familias (`evento.js`, `identidad.js`, `ciclo.js`, `tope.js`; `r.js` se retiró con el encargo 3b) y en el mismo orden en que las aplicaba `eje.validar`. Cada una cita las filas de `docs/notas/INVENTARIO_REGLAS.md` §2 que cubre.
- `src/eje.js`: `Eje` conserva su API, pero por dentro traduce cada evento a una transacción (`eje.transaccion(ev)`) y delega en el libro con las condiciones. Saldos, bloqueos, lo emitido y consumido de cada serie, el T gastado del día y el T consumido sobre cada registro se leen del libro (`eje.libro`).
- `src/validez.js`: las capas leen el eje de justo antes del registro (`eje.antes(k)`, el mismo eje reaplicado) y evalúan las mismas condiciones del ciclo (`motivosDe`; de R no queda ninguna en JS desde el encargo 3b). Una sola verdad.
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

- `clase` y `etiqueta`: el libro suma aparte cada clase (`emision`, `asignacion`, `informativo`, `reposicion`, `obtencion`) y, por titular, cada etiqueta. Lo emitido de una serie es lo acuñado como emisión; el T gastado de un día es lo acuñado como asignación con la etiqueta de ese día; el P que obtiene una identidad por una regla que escribe (encargo 3b) es lo acuñado como obtención con la etiqueta = el nombre de la regla; esa suma es el nivel ya alcanzado, contra el que el eje acuña con tope (abajo).
- `tope` (acuñar): acuña como mucho lo que falte para que lo acuñado con esa clase y etiqueta llegue al tope. Es la acuñación programada del mapa §16 («T: acuñación programada por reloj, quemar al gastar»): quien fija el tope (la asignación del día, TT-2) es la regla, no el libro. Desde la decisión de VG tras el 3b-bis, también la obtención de P: lo que una regla que escribe coloca con `put v at A.2.1.(r)` es un nivel, y el eje lo acuña con `tope: v` (clase `obtencion`, etiqueta = la regla): solo la diferencia, y nada si el nivel ya está alcanzado (un paso que acuña 0 no se asienta; el eje ni siquiera lo pone). Nunca se quema por bajar el nivel. Y un segundo tope, **por serie**: lo que una regla acuña por lo que llega de una serie de E o de R (la colocación dice en `desde` el movimiento en que se hizo) no pasa, sumando todos los orígenes, de diez por unidad acuñada de esa serie (lo emitido antes y lo que la transacción acuña), menos lo que esa regla ya acuñó por ella; así la misma unidad no da P dos veces aunque vuelva al emisor por un tercero y salga otra vez. El paso apunta cuánto viene de cada serie (`series`) y el eje lo suma al asentar (`eje.obtenidoDeSerie(serie, regla)`).
- `fuentes` (transferir, quemar): las series de donde sale, en orden; lo que sale de otra serie queda en el diario como reposición. Era el débito de P que subía por el hilo (PP-4); desde el encargo 3b el eje ya no la usa: el P se mueve en su registro exacto y reposicionarlo es una transacción con dos movimientos, quemar aquí y acuñar allí con factor (subir ×0,1, bajar ×1,1: «P is repositioned one step at a time»).
- `salida` (transferir; encargo 3b): sale de lo bloqueado de `de` con esa salida y llega a `a` bloqueado con ella, o a su disponible si la salida nombra a `a`. Es delegar (mapa §15 [D] (6): «transferencia con salida») y recoger lo que guarda una invitación (§16).

## 2. Evento ↔ transacción

`eje.transaccion(ev)` da un paso por movimiento, en su orden (un movimiento mal formado es un paso vacío: lo cuenta la forma).

| Movimiento del evento | Paso de la transacción |
|---|---|
| `de: null` (emitir) | `acunar(serie, a, cantidad)`, clase `emision`; si es P, clase `reposicion` (nadie acuña P a mano: la regla «P is repositioned one step at a time» lo exige con su quema) |
| `estado: 'bloqueo'` | `bloquear(serie, de, cantidad, salida)` |
| `estado: 'liberacion'` | `liberar(serie, de, cantidad, salida)` |
| transferencia con `salida` | `transferir(serie, de, a, cantidad, { salida })` |
| P con `de` | `transferir(P:registro, de, a, cantidad)` (o `quemar` si `a: null`), en el registro exacto (encargo 3b: sin fuentes ni ámbitos que cubran el suyo) |
| T informativo (pasado, futuro, inventado) | `acunar(T:x, autor, c)` clase `informativo` + `quemar(T:x, autor, c)`, con su `refiere` y su `nota`: «si lo gastas te vuelve a salir uno» |
| T de la asignación del día (una persona con alta) | `acunar(T:e, autor, c)` clase `asignacion`, etiqueta = el día civil, tope = la asignación del día + `quemar` (o `transferir` a una cosa): lo que falte sale del T explícito |
| lo demás con `a: null` | `quemar(serie, de, cantidad)` |
| lo demás | `transferir(serie, de, a, cantidad)` |
| `sobre`, `en` | `ancla: { sobre, en }` |
| `payload` | `memo` |
| `autor`, `t`, `id`, `firma`, `firmante` | los mismos campos de la transacción |
| `contexto.genesis` | `abre: [autor]`: la cuenta del autor del génesis nace con él. El génesis no mueve nada (encargo 3b: la época 0 en el eje) |
| (detrás de los movimientos) | la obtención de P: lo que colocan las reglas que escriben de la época (`put v at A.2.1.(r)`, un nivel) se acuña en la misma transacción, `acunar(P:r/A, A, v, { tope: v })` con clase `obtencion` y etiqueta = la regla: lo que falte para llegar al nivel, hasta donde llegue el cupo de las series de donde viene (el tope por serie: diez por unidad acuñada de la serie, de todos los orígenes); un paso por regla, titular y registro (el máximo de lo colocado), y ninguno si el nivel ya está alcanzado o no queda cupo |

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

Siguen en el eje (no son aritmética de saldos): las claves y los tipos de las altas, el reloj (`tMaximo`), el prefijo de la versión 2 y los índices (lo escrito sobre cada registro, por posición, por autor, por prefijo).

## 3. Las condiciones

**Encargo 3a (VG, 10-11, paso 9): las reglas conectadas.** Las reglas del 2 de la época (`docs/BQLM.md` §5 y §10) son condiciones de la transacción (`src/condiciones/reglas.js`): cada una se evalúa con el BQL mínimo sobre el eje de antes (`ContextoEje`) y rechaza con el mensaje de su 9. Las condiciones JS que sustituyen, verificadas por equivalencia (`test/reglas-bqlm.test.js`, con los ejemplos de Ikisai y un fuzz con semilla fija), se retiraron de `src/`; su código vive solo en `test/condiciones-retiradas.mjs`, y la red de equivalencia las sigue comparando. Las reglas no se evalúan en el prefijo de la versión 2 (suelo de persistencia), en un evento mal formado (la forma es suelo) ni en uno con una referencia a un evento ausente (C1). Si alguna regla falla con un veredicto, cuentan esas; si no, la primera que queda PENDIENTE (lo que no se sabe no se acepta). El génesis ya no pasa por ellas (encargo 3b: es la época 0 en el eje, no una transacción; solo el suelo).

**Encargo 3b (VG, 8-11 a 10-11, mapa §15 y §16).** Lo que el 3a dejó en JS porque el 3b lo cambiaba ya no está en `src/`: `src/autorizacion.js` (el paso de autorizar y el poder para autorizar), `src/condiciones/r.js` (el colateral de R, RR-3 y RR-4, y atender, RR-5) y, en `src/ciclo.js`, el P acuñado por el autor del registro (PP-2, PP-3, R3), el estrechamiento (PP-5) y el escalonado (ES-1). Son reglas de la época (las nuevas de la tabla de abajo, las tres que escriben y las lecturas «attended», «share» y «weight»), o se retiraron. En JS solo queda del 3b lo que es suelo: la aritmética del libro (la transferencia con salida, y en la capa 4 de `src/validez.js` que sacar lo bloqueado de otro solo vale aceptando la propia invitación) y acuñar lo que colocan las reglas que escriben (`src/eje.js`, la obtención); cuánto, a quién y dónde lo dicen las reglas.

En el orden en que se evalúan (`CONDICIONES` en `src/condiciones/index.js`):

| Condición | Archivo | Qué comprueba | Por qué sigue en código |
|---|---|---|---|
| `EV-1` | `evento.js` | la forma del evento y de sus movimientos (`validarForma`) | suelo de forma (BTML). Seis reglas repiten parte de ella (abajo): son una segunda red, que solo mira eventos bien formados |
| `suelo:id` | `evento.js` | el id es el hash del cuerpo | suelo |
| `suelo:nuevo` | `evento.js` | el evento no está ya | suelo |
| `suelo:un-genesis` | `evento.js` | solo hay un génesis, y es el único sin foco | suelo (absorbe «solo el génesis carece de foco», del antiguo `ancla`) |
| `suelo:referencias` | `evento.js` | una referencia del payload a un evento que el eje no tiene se rechaza al entrar | suelo (VG, 10-11, C1: «mientras el eje es local; con red, se resuelve antes de aceptar») |
| `ID-1` | `evento.js` | en el prefijo de la versión 2, el autor tiene cuenta | suelo de persistencia (B1: fuera de él, quien escribe sin cuenta escribe su propia alta) |
| `suelo:firma` | `identidad.js` | la firma verifica; la bandera `exigirFirmas` | suelo: criptografía (`src/autoridad.js`). En el prefijo de la versión 2, las reglas de entonces |
| `suelo:claves` | `identidad.js` | la clave es una clave pública válida; la prueba de posesión verifica; no hay prueba sin clave | suelo: criptografía. En el prefijo de la versión 2, las reglas de entonces |
| `ID-3` | `identidad.js` | no hay tipo en el alta; en el prefijo de la versión 2, los tipos de entonces | suelo de persistencia (B1, A4) |
| las 30 reglas de la época | `reglas.js` | la tabla de abajo | — |
| `VA-3` | `ciclo.js` | las reglas de emisión de la versión 2, en su prefijo | suelo de persistencia |
| `EE-9` | `ciclo.js` | la caducidad de una serie de E la fija su primera emisión | no cabe (§10.3 de `docs/BQLM.md`) |
| `VA-3` | `tope.js` | en el prefijo de la versión 2, la E no lleva registro, divisible ni emisores | suelo de persistencia |
| `EE-1` | `tope.js` | el contrato de la serie de E (divisible, emisores) | no cabe (que el registro exista ya es la regla «E is tied to a record that exists») |
| `EE-8` | `tope.js` | el P que respalda E vivo no se libera | la salida de familia (EE-4) no cabe; la regla «locked P backing live E is not released» cubre la de una serie, también conectada |
| `EE-10` | `tope.js` | en la emisión conjunta, cada coemisor tiene su P bloqueado | no cabe |
| `EE-5` | `tope.js` | el tope compartido por franja y la cuota por P bloqueado | no cabe del todo (las vistas ya están: `X.7.1`, `before.6.3`; falta cómo se declara la capacidad, EE-2) |

Después, la aritmética del libro, paso a paso (suelo: la atomicidad de los saldos): saldo disponible, bloqueado con esa salida, series finitas. El eje pone a sus fallos el texto de siempre (`saldo insuficiente de <serie> en <id>`, `saldo disponible insuficiente para bloquear …`, `no hay … bloqueado en … con la salida «…»`, `saldo insuficiente de P sobre …`, `la serie … no admite tanto`).

**Regla ↔ condición retirada ↔ suelo.** Las 30 reglas de la época que son condiciones, en el orden de su 8, con lo que sustituyen. «Retirada» quiere decir que el código JS ya no está en `src/` (vive en `test/condiciones-retiradas.mjs`); «a la vez» quiere decir que la condición JS sigue y la regla también rechaza (la forma, o una parte que la regla no cubre); «sin copia», que el encargo 3b cambió lo que comprobaba y su código no se guarda ni en las pruebas.

| Regla | Condición JS | Estado | Capa de validez |
|---|---|---|---|
| writing burns today's T | `TT-4` (TT-2, TT-3, TT-4); la mitad de forma de `EV-1` (EV-2) | `TT-4` retirada; la forma, a la vez | 4 |
| every record hangs on a record of the ledger | `ancla` | retirada; «solo el génesis carece de foco» pasa a `suelo:un-genesis` | 3 |
| every event moves tokens | `EV-1` (EV-1) | a la vez (forma) | 1 |
| T is whole | `EV-1` (TT-7) | a la vez (forma) | 1 |
| informative T is only burned | `EV-1` (TT-5) | a la vez (forma) | 1 |
| locks keep their holder and name an exit | `EV-1` (BL-1) | a la vez (forma) | 1 |
| E is minted by and to its issuer | `EV-1` (la emisión va a su emisor) e `ID-9` (nadie emite en nombre de otro, E) | `ID-9`, retirada; la forma, a la vez | 5 |
| R is minted to its issuer | `EV-1` (la emisión de R va a su emisor) | a la vez (forma) | 1 |
| who has a key signs | `ID-5` (firma ausente, el firmante es el autor) | retirada; verificar la firma es `suelo:firma` | 3 |
| without a key nobody acts | `ID-5` (sin clave no se actúa, R9) | retirada | 3 |
| a key is declared at its alta | `ID-6` (no se cambia la clave; sin darle tokens) | retirada; la clave válida es `suelo:claves` | 3 |
| a declared key comes with its proof | `ID-6` (sin prueba de posesión) | retirada; verificar la prueba es `suelo:claves` | 3 |
| not before its focus | `RL-1` (RL-1) | retirada | 4 |
| not before the writer joined | `RL-1` (RL-2) | retirada | 4 |
| at most a year ahead | `RL-1` (RL-3) | retirada | 4 |
| only persons mint | `ID-9` (solo las personas emiten) | retirada (en el prefijo de la versión 2, el tipo declarado: `VA-3` de `ciclo.js`) | 5 |
| R is minted by its issuer | `ID-9` (nadie emite en nombre de otro, R) | retirada | 5 |
| nobody mints T | `ID-9` (TT-1, T no se emite) | retirada | 5 |
| T is not locked | `TT-6` | retirada | 5 |
| T only goes to things | `TT-8` (TT-8, TT-9) | retirada | 5 |
| E is tied to a record that exists | `EE-1` (el registro de la serie) | retirada esa parte; el contrato sigue en `EE-1` | 4 |
| locked P backing live E is not released | `EE-8` | a la vez (la salida de familia, EE-4, solo la mira JS) | 4 |
| nobody moves tokens of others | `ID-8` (de paso) | retirada; la excepción de aceptar la propia invitación la repite el suelo (capa 4) | 5 |
| P moves within a known scope | `PP-4` (de paso) | retirada; desde el 3b, cualquier movimiento de P va sobre un registro del libro (sin «genesis») | 4 |
| P is repositioned one step at a time | `PP-2` (P acuñado) y `PP-5` (estrechar) | retiradas sin copia en las pruebas (3b: la regla cambia lo que comprobaban; reposicionar con factor, N7) | 5 |
| minting R needs real T | `ES-1` (R exige T) | retirada sin copia (3b, N3) | 5 |
| minting E needs P on its record | `ES-1` (E exige P sobre el registro) | retirada sin copia (3b, D1) | 5 |
| minting E needs own R issued | `ES-1` (E exige R propia en juego) | retirada sin copia (3b, D2: sin colateral, basta haberla emitido) | 5 |
| attention has a price | — | nueva (3b: PV3, la regla de atención) | 5 |
| a person joins by an invitation | — (el alta abierta, `eje.entrar`) | nueva (3b: el alta es aceptar una invitación) | 5 |

Las seis reglas que el 3a dejó preparadas en `datos/epocas/reglas-3b/` (el P acuñado, el P del génesis, el escalonado) se retiraron con la carpeta: el 3b las sustituye por las de arriba y por las tres reglas que escriben («writing a record gives ten P on it», «getting E gives ten P on its record», «receiving R gives ten P on the root of its issuer»), que no son condiciones: lo que colocan lo acuña el libro. La red de equivalencia (`test/reglas-bqlm.test.js`) solo compara las reglas que sustituyen una condición JS sin cambiarla.

Las lecturas (B5: «present», «informative», «attended», «obligation»; y con el 3b, «share» y «weight», el peso por dominio) están en el 2 de la época, pero no son condiciones: el contexto las pone en la posición que dice su 3 (`docs/BQLM.md` §5).

Al crear un eje, el génesis pasa `GN-1` (GN-2, TT-1: lo que declara; desde el 3b, que no mueve nada), `GN-2` (GN-2, ID-5, ID-7: su firma) y `suelo:referencias`; al restaurarlo, además, su forma (`EV-1`) y su id, y la firma solo si todo lo demás pasa.

Las secciones que quedan en JS se pueden llamar enteras como antes: `reglasDelCiclo` (`src/ciclo.js`, con `SECCIONES_DEL_CICLO`: solo `EE-9`) y `reglasDelTope` (`src/condiciones/tope.js`, reexportada por `src/eje.js`). `reglasDeR` se retiró con el colateral de R.

## 4. Un ejemplo

La compra de comida de Ikisai: la huésped paga doce euros a la cocina y gasta una hora de su día. Su transacción, su cartera y un evento que no pasa:

```js
import { ejemploCompra } from './ejemplos/ikisai/compra-food.mjs';
import { crearEvento } from './src/evento.js';
import { CONDICIONES } from './src/condiciones/index.js';
const { eje, menu, compra } = await ejemploCompra();
const nombre = { [eje.genesisId]: 'génesis', [eje.alta('huesped').id]: 'alta de huesped', [compra.id]: 'compra', [menu.id]: 'menú' };
const corto = (k) => (k.startsWith('P:') ? 'P:' + (nombre[k.slice(2, 66)] ?? k.slice(2, 10)) + k.slice(66) : k);
const texto = (p) => p.primitiva + '(' + [corto(p.serie), p.de, p.a].filter(Boolean).join(', ') + ', ' + p.cantidad + ')' + (p.clase ? ' [' + p.clase + (p.tope !== undefined ? ', tope ' + p.tope : '') + ']' : '');
const tx = eje.antes(eje.orden.indexOf(compra.id)).transaccion(compra);
console.log('ancla:', nombre[tx.ancla.sobre], tx.ancla.en, '· autor:', tx.autor, '· memo: el payload de la compra');
tx.movimientos.forEach((paso, i) => console.log('paso ' + i + ':', paso.map(texto).join(' + ')));
console.log('cartera de huesped:', Object.entries(eje.libro.vista('huesped')).map(([k, v]) => corto(k) + ' ' + v.disponible).join(' · '));
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
ancla: menú 0000000000 · autor: huesped · memo: el payload de la compra
paso 0: acunar(T:hora, huesped, 1) [asignacion, tope 24] + quemar(T:hora, huesped, 1)
paso 1: transferir(E:casa/EUR, huesped, cocina, 12)
paso 2: acunar(P:compra/huesped, huesped, 10) [obtencion, tope 10]
cartera de huesped: R:casa 1 · P:alta de huesped/huesped 10 · P:génesis.3/huesped 10 · E:casa/EUR 48 · P:génesis.1/huesped 600 · P:compra/huesped 10
T sobre el menú: {"hora":1}
minting E needs own R issued: minting E needs own R issued: huesped mints E and has never issued R of its own
aritmética, paso 2: saldo disponible insuficiente de E:casa/EUR en huesped: 100 pedido
[
  'minting E needs own R issued: huesped mints E and has never issued R of its own',
  'saldo insuficiente de E:casa/EUR en huesped'
]
```

La hora de la huésped no es un saldo: sale de su asignación del día (acuñación programada con tope 24) y se quema sobre el menú, que es lo que `tiempoSobre` suma. Detrás de los movimientos va la obtención de P (encargo 3b): la huésped obtiene diez P sobre la compra que escribe, también como acuñación programada (tope 10: el nivel que coloca la regla; VG, tras 3b-bis). La cocina no obtiene nada por los euros que recibe: le llegan de la huésped, no de su emisor, la casa (encargo 3b-bis: solo da P lo que llega de su emisor, diez por unidad neta). Cada serie de P lleva su origen (`P:<registro>/<origen>`): todo lo de la cartera de la huésped es de origen huésped. En su cartera están, además, la unidad de R de la casa que le guardaba su invitación y el P que obtuvo al escribir su alta (diez) y al recibir de la casa una R y sesenta euros (diez por unidad, por mirada: diez sobre el 3 del génesis por la R y 600 sobre su 1 por los euros; encargo 3c-2a). El evento malo falla por una regla de la época («minting E needs own R issued»: emite E sin haber emitido nunca R propia) y por la aritmética del paso 2; `eje.validar` da los mismos motivos.

## 5. Lo que queda para los pasos siguientes

- Hecho en el encargo 3a (paso 9): las reglas de la época están conectadas al eje y las condiciones JS que sustituyen, retiradas (§3). Hecho en el 3b: el P acuñado, el escalonado y el colateral de R salieron de JS (§3). Queda para VG si las seis reglas de forma sustituyen a `validarForma` en lo que repiten.
- La capa 4 de validez (`capaAcreditacion`) conserva su simulación por movimiento, con sus propios textos («saldo de … tiene …, mueve …»), aunque lee el libro de antes y las mismas condiciones; pasarla a la simulación del libro cambiaría sus textos.
- `src/bases.js` (`poderAntes`) lee del libro el P exacto anterior a una base (encargo 3b: sin ámbitos que cubran el suyo); las bases leen el T sobre cada registro, que ya viene del libro. Pasar sus sumas a `libro.sumas` es del paso del 8.
- El génesis no emite T y la asignación diaria no es todavía una acuñación por reloj de verdad: se acuña al gastar, con tope. Igual con el T informativo.
- Prueba: `test/libro.test.js` (las primitivas, la atomicidad, las sumas, las condiciones) y `test/capa-cero.test.js` (los ejemplos de Ikisai contra la aritmética de antes rehecha a mano, la correspondencia evento ↔ transacción, la reconstrucción y el orden de las condiciones). Para cambiar la forma y no el comportamiento, solo se tocó un test: la lista de sitios que pueden leer el tipo de una identidad (R10, `test/neutralidad-reglas.test.js`) añade `src/condiciones/identidad.js`, adonde se movieron las comprobaciones del alta y del génesis.
