# Bases del 8: registros fundibles en la posición 8

Nota de la pieza · 7-11-2026 · Código: `src/bases.js` (y el filtro de las bases en `src/tiempo.js`, `BASES()` en `src/bql.js`). Pruebas: `test/bases.test.js`. Ejemplo: `ejemplos/ikisai/compras-hermanas.mjs` (datos inventados). Resumen en `docs/MOTOR.md` §14 y `docs/BQL.md` §7.13. Lo que el mapa no decide va marcado **[X] decidir VG**; nada de eso se ha inventado como decisión, solo como valor provisional para que el código funcione.

Rutas abreviadas: `MAPA` = el mapa global de AGRAM (`MUELA/equipo/agram/MAPA_GLOBAL_AGRAM.md`, fuera del repositorio); `PV8_R1` = `agx/80_HERENCIA_V3_INTEGRA/80_V2_INTEGRO/90_FUENTES_CONSULTA/AGRAM_PV8_R1_Calibracion_Dinamica_Comparabilidad_Impugnacion_v1.1-candidata.md` (herencia V2, candidata).

## 1. Lo decidido

`MAPA` §12, [D] «Cohortes y bases del 8» (VG, 7-11 tarde: «exactamente lo que buscábamos»):

> tres cohortes útiles (hermanos = elementos similares; linaje/proyecto = dónde estoy; general = el ámbito). Sin base de datos aparte: las estadísticas son REGISTROS escritos en la posición 8 del registro que resumen («bases»), con referencias a lo medido; el 8 del proyecto funde las bases de sus hijos; el 8 del génesis funde las de los proyectos. Corregir = añadir otra base (historia gratis). Medidas FUNDIBLES: recuentos, sumas, mín, máx e histograma de diez cajas por medida = una décupla por medida, cuyas diez posiciones son los diez niveles/hitos del 8; el foco se sitúa en su caja en cada cohorte. Fundir es O(1); la base lleva fecha y frescura. La escribe la propia cosa (proyecto) con su clave y gastando su T. Cortes de las cajas = regla de la época. Lo no fundible (medianas exactas, correlaciones) se aproxima o se descarta. Código: bases en el 8 con fundir/frescura y BASES() en BQL; la cohorte se elige leyendo el 8 del padre, del proyecto o del génesis.

Y `MAPA` §12, [D] «Corrección de VG sobre titulares»: las cosas tienen clave privada y pública, firman por sí mismas y tienen cartera; quien da de alta declara persona, grupo o cosa. Los diez hitos llevan sus etiquetas literales (`MAPA` §2.2 [D20]).

Del corpus heredado (V2, candidato; solo como apoyo, no decide): «La misma evidencia en una cohorte nueva: posición **relativa** distinta» y «No borrar las valoraciones anteriores. Cada valoración es un producto contextual con identificador, perfil de reglas, snapshot del corpus accesible, cohorte y resultado» (`PV8_R1` l.235 y l.238); «Dos cohortes no conectadas — Comparar por separado; no inventar escala puente» (`PV8_R1` l.376, R29).

## 2. Qué hace el código

### 2.1 Una sola verdad con la confluencia

La confluencia del 8 (`tiempo.confluir`, PR #19, ya en `main`) calcula al vuelo las bases de una cohorte. Las bases del 8 son **lo mismo, escrito**: `bases.medir` es `tiempo.medidasDe` (con un guarda para `BASES()`), las cohortes son las de `tiempo.comparables` (`tiempo.proyectoDe` para el proyecto), la caja es `tiempo.cajaDe`, cada medida se funde con `tiempo.fundir` y los cortes salen del mismo gancho `epoca.cortes(clave)`. Con los mismos cortes, `situar` da los mismos números que `confluir` en las tres cohortes (lo comprueba `test/bases.test.js`).

Una estadística guarda, para un conjunto de registros: `n`; por cada medida de `tiempo.MEDIDAS` (posiciones desarrolladas, terminales, escritos, movimientos, identidades, profundidad del hilo, fórmulas resueltas y pendientes) y por cada serie de token movida (`T:hora`, `E:casa/EUR`…), un bloque `{ n, suma, minimo, maximo, cortes, origenCortes, cajas }`; por cada posición 0–9, cuántos la tienen desarrollada y por qué procedencia (propia, referencia, escrita); y cuántos tienen algo escrito en la raíz. Todo se funde sumando: O(1) respecto a lo medido.

### 2.2 La escribe la propia cosa

`escribirBase(eje, { registro, privada, t, epoca })` escribe un evento en el 8 del registro (`sobre`: el registro, `en`: `CIELO = '8000000000'`), firmado por la **identidad propia** del registro y gastando un minuto de su T (`COSTE_BASE`). El contexto es `{ bases: true, n, nSubarbol, hasta, epoca, sinBase }`.

`identidadDe(eje, id)` dice cuál es esa identidad: la única cosa (tipo `cosa`, con clave) a la que el propio registro da de alta en su contexto; la del génesis, su autor (el génesis solo declara a su autor). Sin identidad propia, el registro no escribe bases. **[X] decidir VG: cómo se identifica un registro con una identidad** (es de AARPIA; esto es lo mínimo que el eje ya permite: dar de alta una cosa con su clave y su T en el mismo evento).

### 2.3 Cortes: regla de la época

Los cortes de las cajas de una medida salen de `epoca.cortes(clave)`, con las claves de `confluir` (`'terminales'`, `'T:hora'`…). La época 0 no los declara. Sin ellos, `confluir` saca los de cada cohorte (igual anchura), que no se funden; una base no puede, porque sus cajas se funden con las de otras bases, así que usa unos provisionales fijos (`CORTES_PROVISIONALES`, `origenCortes: 'provisional'`):

| Medidas | Cortes provisionales | Cajas |
|---|---|---|
| `terminales`, `escritos`, cantidades de token | 1 2 3 4 6 10 16 26 42 | 0 · 1 · 2 · 3 · 4–5 · 6–9 · 10–15 · 16–25 · 26–41 · ≥42 |
| `posiciones`, `movimientos`, `identidades`, `profundidadHilo`, `formulasResueltas`, `formulasPendientes` | 1 2 3 4 5 6 7 8 9 | 0 · 1 · … · 8 · ≥9 |

Que los cortes son regla de la época está decidido; **[X] decidir VG: sus valores**. Cada bloque guarda sus cortes y `fundir` rechaza bloques con cortes distintos (no se inventa escala puente); los mismos cortes de orígenes distintos sí se funden, y el bloque lo dice (`origenCortes: 'mixto'`).

### 2.4 Una base por 8, con dos estadísticas

`calcularBase(eje, registro)` calcula lo que se escribe:

- **hijos**: los hijos del registro, medidos uno a uno: los hermanos entre sí. Es la cohorte de hermanos de cada hijo.
- **subárbol**: el registro y todo lo que cuelga de él. Es la cohorte de proyecto (en el 8 del proyecto) y la general (en el del génesis). Funde, **sin releer registros**, el subárbol de la base vigente de cada hijo: así el 8 del proyecto funde las bases de sus hijos y el del génesis las de los proyectos. Un hijo sin base cuenta por sí mismo; si además tiene descendencia, esa descendencia no cuenta y el hijo queda en `sinBase`. **[X] decidir VG: cómo se completa lo que cuelga de un hijo sin base** (releerlo rompería «fundir es O(1)»).

Las referencias `{ref}` del payload apuntan a los hijos medidos y a las bases fundidas. `hasta` es el último hijo medido.

### 2.5 Qué cuenta como base

Solo es base (`esBase`, `basesEn`) lo que, en el 8 del registro:

1. firma la identidad propia del registro, que gasta T en el evento;
2. lleva exactamente el contexto `{ bases, n, nSubarbol, hasta, epoca, sinBase }`, con tipos válidos, que casa con el payload;
3. tiene un payload coherente: cajas que suman n, cortes crecientes, mínimo ≤ máximo, `n·mínimo ≤ suma ≤ n·máximo`, primera y última caja ocupadas iguales a las del mínimo y del máximo, recuentos por posición posibles;
4. mide **todos** los hijos llegados hasta `hasta`, en su orden;
5. funde bases válidas del 8 de esos hijos (como mucho una por hijo), y su `nSubarbol` es 1 más lo que aporta cada hijo.

Lo demás escrito en el 8 (una compra que se declara base, una base bien formada firmada por otro, un contexto raro, unas referencias que no son los hijos) es **un hijo más**: cuenta en `escritos`, en `comparar` y en la confluencia, y deja la base vieja con novedades. Nadie se esconde declarándose base, y nadie falsea la estadística de una cosa que no es suya.

### 2.6 Las bases no son hermanas, escritos ni comparables

`bases.hijos(eje, id)` es lo escrito sobre un registro sin sus bases válidas. `src/tiempo.js` lo usa en `medir` (escritos), `comparar` (hermanos), `comparables` (las tres cohortes de `confluir`) y `posicionesDe` (una base en el 8 no desarrolla esa posición). Así escribir una base no cambia lo que mide, y `comparar` en la vista Mapped (`app.js`, celda 8) da lo mismo antes y después de escribir las bases. Una base solo se compara consigo misma.

### 2.7 Leer, frescura y comprobación

`leerBase(eje, id)` da la base vigente (la última llegada; **[X] decidir VG: «más reciente» por llegada, no por `t`**), con `anteriores` (las bases válidas anteriores: colisiones en el 8) y su **frescura**, que cuenta lo LLEGADO sin releer:

- `hijosNuevos`: hijos del registro llegados después de `hasta`;
- `basesNuevas`: hijos medidos cuya base vigente ya no es la fundida (o no la tenían);
- `debajo`: lo mismo, sumado, en las bases fundidas que siguen vigentes, a cualquier altura;
- `sinNovedades`: si todo es cero.

La frescura no ve cambios en lo ya medido (un escrito sobre un hijo sin base, una fórmula que se resuelve). Para eso está `comprobar(eje, base)`, que recalcula la base y la compara, bajando por las fundidas vigentes, y dice `alDia` y qué difiere. **[X] decidir VG: qué es la frescura de una base** (el mapa solo dice que la lleva).

### 2.8 Situar

`situar(eje, foco, { alcance })` lee el 8 de la cohorte y devuelve la forma de `confluir`: por medida y por serie, el bloque con el foco situado (`foco`, `caja`, `hito`: la etiqueta de la caja, `enCaja`, `debajo`, `encima`, `media`); por posición, cuántos la tienen y si el foco la tiene; y la raíz. Añade `incluido` (si la base mide al foco, bajando por las fundidas) y `cambiadas` (medidas en que el foco, medido ahora, cae en una caja vacía aunque la base lo incluya: ha cambiado desde entonces).

| Alcance | Lee | Estadística |
|---|---|---|
| `hermanos` | el 8 del padre | hijos |
| `proyecto` | el 8 de `tiempo.proyectoDe` (el registro del hilo que cuelga del génesis) | subárbol |
| `general` | el 8 del génesis | subárbol |

`PENDIENTE` con el motivo si no hay base o cohorte (el génesis no tiene padre). Nada asigna nivel ni grado.

### 2.9 `BASES()` en BQL

`BASES()` = n de la base del 8 del anfitrión; `BASES(alcance)` = n de la cohorte; `BASES(alcance, medida)` = la caja del anfitrión; `BASES(alcance, medida, k)` = cuántos hay en la caja k; `BASES(alcance, medida, campo)` = `suma`, `minimo`, `maximo`, `media` de la base o `foco`, `caja`, `enCaja`, `debajo`, `encima` del anfitrión. La dependencia es la base leída; el gancho `puedeLeer` de BQL decide leer la base y, si hay que situarlo, el anfitrión entero. Una fórmula `BASES()` que sitúa a su propio registro, evaluada mientras ese registro se mide para una base, queda PENDIENTE (no se mide a sí misma). Detalle y ejemplos en `docs/BQL.md` §7.13. **[X] decidir VG: la firma de `BASES()`.**

Encima, `CAJA(medida, alcance?)` (= `BASES(alcance, medida)`, con `"hermanos"` por defecto) y `FRESCURA(alcance?)` (las llegadas que cuenta la frescura de la base): cobran lo que examina la lectura, no miden al anfitrión si no hay base y, sin base, el motivo dice cómo escribirla. `docs/BQL.md` §7.14; pruebas en `test/bases-bql.test.js`.

### 2.10 Ejemplo ejecutado

Árbol de `ejemplos/ikisai/compras-hermanas.mjs`: dos proyectos bajo el génesis (el comedor, con el menú del día y el de la cena; el mercado, con un puesto) y ocho compras. Cada registro que resume a otros da de alta, en su propio evento, a su cosa (`comedor`, `menu-dia`, `menu-cena`, `mercado`, `puesto`) con clave y unos minutos de T. `escribirBasesDelEjemplo` escribe las seis bases de abajo arriba, cada una firmada por su cosa; la del génesis, por la casa.

```sh
node --input-type=module -e "
import { ejemploComprasHermanas, escribirBaseDe, escribirBasesDelEjemplo } from './ejemplos/ikisai/compras-hermanas.mjs';
import { medir, leerBase, situar, comprobar, cajasEtiquetadas, identidadDe } from './src/bases.js';
import { ALCANCES, comparar } from './src/tiempo.js';
import { consultar } from './src/bql.js';
const ej = await ejemploComprasHermanas();
const { eje } = ej;
const g = medir(eje, ej.guisos.id);
console.log('guisos', JSON.stringify({ posiciones: g.posiciones, terminales: g.terminales, escritos: g.escritos, identidades: g.identidades, profundidadHilo: g.profundidadHilo, formulasResueltas: g.formulasResueltas, formulasPendientes: g.formulasPendientes, tokens: g.tokens }));
const antes = comparar(eje, ej.guisos.id);
await escribirBasesDelEjemplo(ej);
const nombres = [['menú', ej.menu.id], ['cena', ej.cena.id], ['puesto', ej.puesto.id], ['comedor', ej.comedor.id], ['mercado', ej.mercado.id], ['génesis', eje.genesisId]];
for (const [nombre, id] of nombres) {
  const b = leerBase(eje, id);
  console.log(nombre.padEnd(8), 'firma', identidadDe(eje, id).padEnd(9), '· hijos', b.hijos.n, '· subárbol', String(b.subarbol.n).padStart(2), '· fundidas', b.refsBases.length, '· terminales', b.subarbol.medidas.terminales.cajas.join(' '), '· sin novedades', b.frescura.sinNovedades);
}
console.log(cajasEtiquetadas(leerBase(eje, eje.genesisId).subarbol, 'terminales').map((c) => c.caja + ' ' + c.nombre + ': ' + c.cuenta).join(' | '));
for (const alcance of ALCANCES) {
  const s = situar(eje, ej.guisos.id, { alcance });
  const t = s.medidas.terminales;
  console.log(alcance.padEnd(8), s.estado, '· n', String(s.n).padStart(2), '· terminales', t.foco, 'caja', t.caja, '(' + t.hito.nombre + ')', 'debajo', t.debajo, 'en caja', t.enCaja, 'encima', t.encima, '· pendientes', s.medidas.formulasPendientes.foco, 'debajo', s.medidas.formulasPendientes.debajo, '· la 4 en', s.posiciones[4].comparables + '/' + s.n);
}
const q = (f) => consultar(eje, ej.guisos.id, [], f).texto;
console.log('BQL:', ['BASES(\"hermanos\")', 'BASES(\"general\")', 'BASES(\"proyecto\", \"terminales\")', 'BASES(\"general\", \"E:casa/EUR\", \"suma\")'].map((f) => f + ' = ' + q(f)).join(' · '));
console.log('comparar igual tras las bases:', JSON.stringify(comparar(eje, ej.guisos.id).comparables.map((x) => x.id)) === JSON.stringify(antes.comparables.map((x) => x.id)));
await eje.escribir({ autor: 'vecina', sobre: ej.menu.id, t: '2026-11-07T18:30:00Z', movimientos: [{ token: 'T', escala: 'hora', cantidad: 1, de: 'vecina', a: null }], payload: 'Un té' });
console.log('menú tras un té:', JSON.stringify(leerBase(eje, ej.menu.id).frescura), '· génesis:', JSON.stringify(leerBase(eje, eje.genesisId).frescura));
await escribirBaseDe(ej, ej.menu.id, { t: '2026-11-07T19:00:00Z' });
const m = leerBase(eje, ej.menu.id);
console.log('menú corregido: hijos', m.hijos.n, '· anteriores', m.anteriores, '· comedor:', JSON.stringify(leerBase(eje, ej.comedor.id).frescura));
await eje.escribir({ autor: 'vecina', sobre: ej.cafe.id, en: '4000000000', t: '2026-11-07T19:30:00Z', movimientos: [{ token: 'T', escala: 'hora', cantidad: 1, de: 'vecina', a: null }], payload: 'Sin azúcar' });
const c = comprobar(eje, leerBase(eje, ej.menu.id));
console.log('nota sobre el café: sin novedades', leerBase(eje, ej.menu.id).frescura.sinNovedades, '· comprobar', c.alDia, JSON.stringify(c.diferencias.map((d) => d.hijos)));
"
```

```text
guisos {"posiciones":5,"terminales":9,"escritos":0,"identidades":2,"profundidadHilo":3,"formulasResueltas":1,"formulasPendientes":1,"tokens":{"T:hora":1,"E:casa/EUR":12}}
menú     firma menu-dia  · hijos 4 · subárbol  5 · fundidas 0 · terminales 0 1 0 0 0 4 0 0 0 0 · sin novedades true
cena     firma menu-cena · hijos 2 · subárbol  3 · fundidas 0 · terminales 0 0 0 0 2 1 0 0 0 0 · sin novedades true
puesto   firma puesto    · hijos 2 · subárbol  3 · fundidas 0 · terminales 0 0 0 1 2 0 0 0 0 0 · sin novedades true
comedor  firma comedor   · hijos 2 · subárbol  9 · fundidas 2 · terminales 0 1 0 0 3 5 0 0 0 0 · sin novedades true
mercado  firma mercado   · hijos 1 · subárbol  4 · fundidas 1 · terminales 0 0 0 2 2 0 0 0 0 0 · sin novedades true
génesis  firma casa      · hijos 2 · subárbol 14 · fundidas 2 · terminales 0 2 0 2 5 5 0 0 0 0 · sin novedades true
0 idea: 0 | 1 aprendizaje: 2 | 2 avanzado: 0 | 3 aprendizaje profesional: 2 | 4 resolución profesional: 5 | 5 aprendizaje superior: 5 | 6 solución profesional avanzada: 0 | 7 investigación: 0 | 8 trabajo maestro: 0 | 9 resolución experimental muy avanzada: 0
hermanos RESUELTO · n  4 · terminales 9 caja 5 (aprendizaje superior) debajo 1 en caja 3 encima 0 · pendientes 1 debajo 3 · la 4 en 2/4
proyecto RESUELTO · n  9 · terminales 9 caja 5 (aprendizaje superior) debajo 4 en caja 5 encima 0 · pendientes 1 debajo 8 · la 4 en 2/9
general  RESUELTO · n 14 · terminales 9 caja 5 (aprendizaje superior) debajo 9 en caja 5 encima 0 · pendientes 1 debajo 13 · la 4 en 2/14
BQL: BASES("hermanos") = 4 · BASES("general") = 14 · BASES("proyecto", "terminales") = 5 · BASES("general", "E:casa/EUR", "suma") = 685
comparar igual tras las bases: true
menú tras un té: {"t":"2026-11-07T18:00:00Z","hijosNuevos":1,"basesNuevas":0,"debajo":0,"sinNovedades":false} · génesis: {"t":"2026-11-07T18:00:00Z","hijosNuevos":0,"basesNuevas":0,"debajo":1,"sinNovedades":false}
menú corregido: hijos 5 · anteriores 1 · comedor: {"t":"2026-11-07T18:00:00Z","hijosNuevos":0,"basesNuevas":1,"debajo":0,"sinNovedades":false}
nota sobre el café: sin novedades true · comprobar false [["escritos","posiciones","posiciones por PV"]]
```

Los ids no se imprimen: las claves de la casa y de las cosas son nuevas en cada ejecución y entran en los eventos, así que cambian.

Lectura: la compra de dos guisos (nueve terminales, una fórmula pendiente) cae en la caja 5 de `terminales` en las tres cohortes, pero la cohorte cambia lo que hay alrededor: con sus hermanos, uno por debajo y tres en su caja; en el ámbito general, nueve por debajo. Es la única con una fórmula pendiente: en `formulasPendientes` todo el resto queda por debajo. La etiqueta «aprendizaje superior» es la de la caja 5, no un grado de la compra. Un té sobre el menú deja su base con novedades, y el génesis lo ve debajo (a través de la base del comedor); al corregir la base del menú, la del comedor ve una base nueva en sus hijos. Una nota sobre el café no es una llegada al menú: la frescura no la ve y `comprobar` sí.

`E:casa/EUR` suma 685 en el ámbito general: son los euros movidos por los catorce registros (los 500 que emite el génesis, los que reparten el comedor y el mercado y los de las compras). Cada serie va por su clave y no se suma con otras.

## 3. Abiertos ([X] decidir VG)

Lo decidido en `MAPA` §12 está construido: la base la escribe la propia cosa con su clave y gastando su T; los cortes salen de la época; `BASES()` está en BQL. Queda por decidir:

1. **Cómo se identifica un registro con una identidad.** Hoy, la única cosa con clave que el propio registro da de alta; la del génesis, su autor (§2.2).
2. **Valores de los cortes** mientras la época no los declara (§2.3).
3. **Coste de una base.** Un minuto de T, como la ejecución. Con la regla de escritura (un minuto por posición, `src/escritura.js`) serían cientos de minutos: una base ocupa cientos de posiciones.
4. **Composición de las cohortes**, la misma que en `tiempo.comparables` (#19): qué registro es el proyecto, si su cohorte es todo lo que cuelga de él o solo sus hijos, y si los hermanos exigen además la misma posición `en`.
5. **Fórmulas pendientes.** PENDIENTE, INCOMPATIBLE y ERROR cuentan juntas (como en `tiempo.medidasDe`).
6. **Disposición del payload.** Hoy una lista (título, n, las dos estadísticas, las referencias): `n` cae en la posición 1 y las series en la 4 de cada estadística, sin atender al PV de cada posición. Podría ir por PV.
7. **«Más reciente» por llegada**, no por `t`: una base con `t` atrasado escrita después manda.
8. **Qué es la frescura** (§2.7): hoy, lo llegado; aparte, `comprobar`.
9. **Lo que cuelga de un hijo sin base** no cuenta y se dice (`sinBase`, §2.4).
10. **La firma de `BASES()`** (§2.9). Hay dos formas que no caben juntas: la de aquí (números) y la primera de la #52 (`BASES(cohorte?)`, un valor `bases` con la mediana aproximada desde las cajas); las compara `docs/BQL.md` §7.14.
11. **Dos lecturas del 8**: `confluir` (al vuelo, fresca) y las bases (escritas). Si la interfaz y BQL deben leer solo las bases escritas y retirar `comparar` y el cálculo al vuelo (auditoría C18) o conservar las dos.

## 4. Límites observados

- `movimientos.P:<ámbito>` y cada serie de token crean un bloque por serie: con muchas series la base crece (sigue sin depender de n).
- Medir evalúa fórmulas en el momento: la misma compra puede pasar de pendiente a resuelta sin que la base lo vea hasta que se reescriba (`comprobar` sí lo ve).
- Una fórmula `BASES()` en un registro cuenta como pendiente en la medida de ese registro para una base, y como resuelta si `confluir` lo mide directamente: la medida de un registro con `BASES()` dentro depende de quién la pide.
- Lo que se guarda en el 8 depende del 8 anterior por las fórmulas que leen el 8 sin situar a su registro (`FRESCURA`, `BASES` sin medida o con un dato de la base): sin base escrita cuentan como pendientes y con base, como resueltas. La primera base de un 8 y la siguiente, sin que llegue nada, difieren; la frescura de la primera no lo ve y `comprobar` sí (`docs/BQL.md` §7.14). **[X] decidir VG: si las fórmulas que leen el 8 deben contar en `formulasResueltas` y `formulasPendientes`.**
- Lo escrito sobre una compra (que no es una cosa) no entra en el subárbol de su menú: la compra no tiene base que lo resuma (`sinBase`).
- `app.js` sigue mostrando `comparar` en la celda 8 de Mapped («entre hermanos X de Y», ordenado por la puntuación fija `posiciones + 2 × escritos + movimientos` de `tiempo.comparar`: un ranking de «más = mejor»); mostrar las bases es trabajo del frontend. **[X] decidir VG: si la celda 8 debe leer las bases (`BASES`, `CAJA`, `FRESCURA`) en lugar de ese puesto.**
