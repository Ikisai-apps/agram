# Bases del 8: una sola verdad, la escrita

Nota de la pieza · 7-11-2026 (noche: una sola verdad del 8) · Código: `src/bases.js` (la única medida, las bases, su lectura y el respaldo `confluir`), `BASES()`, `CAJA()` y `FRESCURA()` en `src/bql.js`, la celda 8 en `src/mapped.js` (`ocho`) y el cielo en `mundos/cielo.js`. Pruebas: `test/bases.test.js`, `test/bases-bql.test.js`, `test/confluencia.test.js`, `test/cielo.test.js`, `test/mapped.test.js`. Ejemplo: `ejemplos/ikisai/compras-hermanas.mjs` (datos inventados). Resumen en `docs/MOTOR.md` §8.3 y §14 y en `docs/BQL.md` §7.13 y §7.14. Lo que el mapa no decide va marcado **[X] decidir VG**; nada de eso se ha inventado como decisión, solo como valor provisional para que el código funcione.

Rutas abreviadas: `MAPA` = el mapa global de AGRAM (`MUELA/equipo/agram/MAPA_GLOBAL_AGRAM.md`, fuera del repositorio); `PV8_R1` = `agx/80_HERENCIA_V3_INTEGRA/80_V2_INTEGRO/90_FUENTES_CONSULTA/AGRAM_PV8_R1_Calibracion_Dinamica_Comparabilidad_Impugnacion_v1.1-candidata.md` (herencia V2, candidata).

## 1. Lo decidido

`MAPA` §12, [D] «Cohortes y bases del 8» (VG, 7-11 tarde: «exactamente lo que buscábamos»):

> tres cohortes útiles (hermanos = elementos similares; linaje/proyecto = dónde estoy; general = el ámbito). Sin base de datos aparte: las estadísticas son REGISTROS escritos en la posición 8 del registro que resumen («bases»), con referencias a lo medido; el 8 del proyecto funde las bases de sus hijos; el 8 del génesis funde las de los proyectos. Corregir = añadir otra base (historia gratis). Medidas FUNDIBLES: recuentos, sumas, mín, máx e histograma de diez cajas por medida = una décupla por medida, cuyas diez posiciones son los diez niveles/hitos del 8; el foco se sitúa en su caja en cada cohorte. Fundir es O(1); la base lleva fecha y frescura. La escribe la propia cosa (proyecto) con su clave y gastando su T. Cortes de las cajas = regla de la época. Lo no fundible (medianas exactas, correlaciones) se aproxima o se descarta. Código: bases en el 8 con fundir/frescura y BASES() en BQL; la cohorte se elige leyendo el 8 del padre, del proyecto o del génesis.

`MAPA` §12, [D] «Una sola verdad del 8» (VG, 7-11 noche, decisión 7 de §14.1: «estoy de acuerdo»), que confirma el diseño de §14.2 tal cual:

> la verdad del 8 es la ESCRITA (base en la posición 8 del registro, escrita por la propia cosa o por quien tiene P sobre ella, gastando T, con refs y «hasta»); `medir()` único y fundible; base del padre = fundido de los hijos, del proyecto = fundido de sus hijos, del génesis = fundido de los proyectos; las tres cohortes se leen del 8 del padre / del proyecto / del génesis, nunca recorriendo; el cálculo al vuelo (confluir) queda solo como respaldo declarado («sin base escrita»); BQL BASES/CAJA/FRESCURA heredan puedeLeer y presupuesto; cortes = regla de la época (decisión 2); se retira comparar() con pesos de tiempo.js.

`MAPA` §12, [D] «Cortes y etiquetas del 8» (VG, 7-11 noche, decisión 2): los cortes de las diez cajas son regla de la época (`epoca.cortes`); la época 0 trae la escala provisional creciente a saltos `1 2 3 4 6 10 16 26 42`, sin más pretensión, y se cambiará con datos reales; las bases guardan con qué cortes se escribieron. Las diez etiquetas de los hitos son texto informativo de la caja, nunca un juicio.

Y `MAPA` §12, [D] «Corrección de VG sobre titulares»: las cosas tienen clave privada y pública, firman por sí mismas y tienen cartera; quien da de alta declara persona, grupo o cosa. Los diez hitos llevan sus etiquetas literales (`MAPA` §2.2 [D20]).

Del corpus heredado (V2, candidato; solo como apoyo, no decide): «La misma evidencia en una cohorte nueva: posición **relativa** distinta» y «No borrar las valoraciones anteriores. Cada valoración es un producto contextual con identificador, perfil de reglas, snapshot del corpus accesible, cohorte y resultado» (`PV8_R1` l.235 y l.238); «Dos cohortes no conectadas — Comparar por separado; no inventar escala puente» (`PV8_R1` l.376, R29).

## 2. Qué hace el código

### 2.1 Una sola verdad: la escrita

Antes convivían dos lecturas del 8: `tiempo.confluir` (al vuelo, PR #19) y las bases escritas (PR #44), más un puesto entre hermanos con pesos (`tiempo.comparar`). Ahora:

- **Una sola medida**: `bases.medir(eje, id)`. Se retiran `tiempo.medir` (la medida simple), `tiempo.medidasDe`, `tiempo.distribucion`, los cortes de cohorte (`tiempo.cortesDeCohorte`) y `tiempo.comparar` con su puntuación `posiciones + 2 × escritos + movimientos`. `tiempo.js` se queda con el eje temporal (PV6 y PV7) y reexporta de `bases.js` lo del 8 que otros módulos leían allí.
- **La verdad es la escrita**: las cohortes se leen del 8 que las resume (`situar`), nunca recorriendo el eje.
- **Respaldo declarado**: si ese 8 no tiene base escrita, `situar` lo dice (PENDIENTE, frescura «sin base escrita») y, solo si se pide (`{ respaldo: true }`), calcula al vuelo con `confluir`, que recorre la cohorte (`comparables`), funde con las mismas funciones (`medir`, `unitaria`, `fundir`) y lo declara: `escrita: false`, `respaldo: true`, `frescura: 'sin base escrita'`. BQL nunca usa el respaldo.

Una medida (`medir`) da, para un registro: las posiciones desarrolladas 0–9 con su procedencia (propia, referencia, escrita; `posicionesDe`), los terminales del payload, los escritos encima (sin sus bases), los movimientos, los tokens movidos por serie (`T:hora`, `E:casa/EUR`…; `clavesDe`), las identidades distintas que tocan sus movimientos, la profundidad del hilo y las fórmulas resueltas y pendientes.

Una estadística guarda, para un conjunto de registros: `n`; por cada medida (`MEDIDAS`) y por cada serie de token movida, un bloque `{ n, suma, minimo, maximo, cortes, origenCortes, cajas }`; por cada posición 0–9, cuántos la tienen desarrollada y por qué procedencia; y cuántos tienen algo escrito en la raíz. Todo se funde sumando: O(1) respecto a lo medido, asociativo y conmutativo, con la estadística vacía como neutro (lo comprueba `test/bases.test.js` como propiedad sobre todos los registros del ejemplo).

### 2.2 La escribe la propia cosa o quien tiene P sobre ella

`escribirBase(eje, { registro, autor, privada, t, epoca })` escribe un evento en el 8 del registro (`sobre`: el registro, `en`: `CIELO = '8000000000'`), firmado por `autor` y gastando un minuto de su T (`COSTE_BASE`). El contexto es `{ bases: true, n, nSubarbol, hasta, epoca, sinBase }`.

- Por defecto, `autor` es la **identidad propia** del registro (`identidadDe`): la única cosa (tipo `cosa`, con clave) a la que el propio registro da de alta en su contexto; la del génesis, su autor. **[X] decidir VG: cómo se identifica un registro con una identidad** (es de AARPIA; esto es lo mínimo que el eje ya permite).
- Si no, `autor` ha de tener **P sobre el registro** (`eje.poderSobre`: P con ámbito el eje entero o un registro de su hilo). En el ejemplo, la casa (con P sobre todo el eje) puede escribir la base de cualquier registro, también de una compra, que no tiene cosa propia.
- Siempre con clave: una base va firmada. `puedeEscribirBase(eje, autor, registro)` dice si alguien puede hoy (`por: 'identidad' | 'poder'`) y, si no, por qué (`nadie sin P sobre <id8> escribe su base: …`).

### 2.3 Cortes: regla de la época

Los cortes de las cajas de una medida salen de `epoca.cortes(clave)` (`cortesDe`). La época 0 trae, para todas las medidas y series, la escala `1 2 3 4 6 10 16 26 42` (`datos/epocas/epoca-0.json`, campo `cortes`; `cargarEpoca` lo convierte en el gancho y lo hereda por respaldo). **[X] decidir VG: sus valores**, y si alguna medida lleva los suyos.

| Cortes de la época 0 | Cajas |
|---|---|
| 1 2 3 4 6 10 16 26 42 | 0 · 1 · 2 · 3 · 4–5 · 6–9 · 10–15 · 16–25 · 26–41 · ≥42 |

Una época que no da cortes para una clave usa los de la época 0 (`origenCortes: 'respaldo'`). Cada bloque guarda sus cortes y `fundir` rechaza bloques con cortes distintos (no se inventa escala puente); los mismos cortes de orígenes distintos sí se funden, y el bloque lo dice (`origenCortes: 'mixto'`). Como todas las cohortes comparten los cortes de la época, sus cajas se funden de una a otra; los cortes de cada cohorte (igual anchura entre su mínimo y su máximo) se retiran.

Una sola escala (VG, 8-11): las cajas se calculan sobre cantidades y cuotas, no sobre recuentos, así que `cortes` es una única lista de nueve umbrales para todas las medidas y series; la forma por medida queda en desuso (se reduce a la escala única). Una época sin `cortes` hereda los de su respaldo, igual que hereda las reglas cortas; si nadie los trae, vale la escala provisional con origen `provisional` (`CORTES_PROVISIONALES`, `epoca.cortesConOrigen()`).

### 2.4 Una base por 8, con dos estadísticas

`calcularBase(eje, registro)` calcula lo que se escribe:

- **hijos**: el fundido de las medidas de los hijos del registro: los hermanos entre sí. Es la cohorte de hermanos de cada hijo.
- **subárbol**: el registro y todo lo que cuelga de él. Es la cohorte de proyecto (en el 8 del proyecto) y la general (en el del génesis). Funde, **sin releer registros**, el subárbol de la base vigente de cada hijo: así el 8 del proyecto funde las bases de sus hijos y el del génesis las de los proyectos. Un hijo sin base cuenta por sí mismo; si además tiene descendencia, esa descendencia no cuenta y el hijo queda en `sinBase`. **[X] decidir VG: cómo se completa lo que cuelga de un hijo sin base** (releerlo rompería «fundir es O(1)»).

Las referencias `{ref}` del payload apuntan a los hijos medidos y a las bases fundidas. `hasta` es el último hijo medido.

### 2.5 Qué cuenta como base

Solo es base (`esBase`, `basesEn`) lo que, en el 8 del registro:

1. firma con su clave la identidad propia del registro, o quien tenía P sobre él **al escribirla** (el poder se cuenta con lo llegado antes de la base, repitiendo el débito de P del eje; si después lo delega o lo gasta, la base sigue valiendo, y la que escribió antes de tenerlo sigue sin contar), y gasta T en el evento;
2. lleva exactamente el contexto `{ bases, n, nSubarbol, hasta, epoca, sinBase }`, con tipos válidos, que casa con el payload;
3. tiene un payload coherente: cajas que suman n, cortes crecientes, mínimo ≤ máximo, `n·mínimo ≤ suma ≤ n·máximo`, primera y última caja ocupadas iguales a las del mínimo y del máximo, recuentos por posición posibles;
4. mide **todos** los hijos llegados hasta `hasta`, en su orden;
5. funde bases válidas del 8 de esos hijos (como mucho una por hijo), y su `nSubarbol` es 1 más lo que aporta cada hijo.

Lo demás escrito en el 8 (una compra que se declara base, una base bien formada firmada por alguien sin P, un contexto raro, unas referencias que no son los hijos) es **un hijo más**: cuenta en `escritos` y en el respaldo, y deja la base vieja con novedades. Nadie se esconde declarándose base, y nadie sin P falsea la estadística de una cosa que no es suya. **[X] decidir VG: si el poder se mira al escribir la base (hoy) o al leerla (como mira el motor para autorizar).**

### 2.6 Las bases no son hermanas, escritos ni comparables

`bases.hijos(eje, id)` es lo escrito sobre un registro sin sus bases válidas. Lo usan `medir` (escritos), `comparables` (las cohortes del respaldo) y `posicionesDe` (una base en el 8 no desarrolla esa posición). Así escribir una base no cambia lo que mide. Una base solo se compara consigo misma.

### 2.7 Leer, frescura y comprobación

`leerBase(eje, id)` da la base vigente (la última llegada; **[X] decidir VG: «más reciente» por llegada, no por `t`**), con su `autor`, `por` (`identidad` o `poder`), `anteriores` (las bases válidas anteriores: colisiones en el 8) y su **frescura**, que cuenta lo LLEGADO sin releer:

- `hijosNuevos`: hijos del registro llegados después de `hasta`;
- `basesNuevas`: hijos medidos cuya base vigente ya no es la fundida (o no la tenían);
- `debajo`: lo mismo, sumado, en las bases fundidas que siguen vigentes, a cualquier altura;
- `sinNovedades`: si todo es cero.

Sin base escrita no hay frescura: la lectura dice «sin base escrita» (`SIN_BASE_ESCRITA`). La frescura no ve cambios en lo ya medido (un escrito sobre un hijo sin base, una fórmula que se resuelve). Para eso está `comprobar(eje, base)`, que recalcula la base y la compara, bajando por las fundidas vigentes, y dice `alDia` y qué difiere. **[X] decidir VG: qué es la frescura de una base** (el mapa solo dice que la lleva).

### 2.8 Situar: leer la cohorte del 8

`situar(eje, foco, { alcance, respaldo })` lee el 8 de la cohorte y devuelve, con `escrita: true`, la base leída (`base`, `autor`, `frescura`), por medida y por serie el bloque con el foco situado (`foco`, `caja`, `hito`: la etiqueta de la caja, `enCaja`, `debajo`, `encima`, `media`); por posición, cuántos la tienen y si el foco la tiene; la raíz; `incluido` (si la base mide al foco, bajando por las fundidas) y `cambiadas` (medidas en que el foco, medido ahora, cae en una caja vacía aunque la base lo incluya: ha cambiado desde entonces).

| Alcance | Lee | Estadística |
|---|---|---|
| `hermanos` | el 8 del padre | hijos |
| `proyecto` | el 8 de `proyectoDe` (el registro del hilo que cuelga del génesis) | subárbol |
| `general` | el 8 del génesis | subárbol |

Sin cohorte (el génesis no tiene padre): PENDIENTE con el motivo. Sin base escrita: PENDIENTE con frescura `'sin base escrita'`, o, con `{ respaldo: true }`, `confluir`. Con las bases al día y sin hijos sin base, lo leído coincide con lo que `confluir` recalcula al vuelo (lo comprueba `test/bases.test.js` en los seis 8 del ejemplo y en las tres cohortes); si algo no está escrito, manda lo escrito y `comprobar` lo dice. Nada asigna nivel ni grado ni puntúa.

### 2.9 `BASES()`, `CAJA()` y `FRESCURA()` en BQL

`BASES()` = n de la base del 8 del anfitrión; `BASES(alcance)` = n de la cohorte; `BASES(alcance, medida)` = la caja del anfitrión; `BASES(alcance, medida, k)` = cuántos hay en la caja k; `BASES(alcance, medida, campo)` = `suma`, `minimo`, `maximo`, `media` de la base o `foco`, `caja`, `enCaja`, `debajo`, `encima` del anfitrión. `CAJA(medida, alcance?)` = `BASES(alcance, medida)`, con `"hermanos"` por defecto; `FRESCURA(alcance?)` = las llegadas que cuenta la frescura de la base.

Las tres leen solo la base escrita y comparten la lectura del 8: heredan el **presupuesto** de la fórmula (cobran lo que examina la lectura, antes de medir nada), el gancho **`puedeLeer`** (leer la base; si hay que situarlo, el anfitrión entero; con gancho no cuentan las fórmulas del anfitrión, que la medida evalúa sin él), los motivos (sin base: `sin base escrita en el 8 de <id8> (…)` y quién puede escribirla: la propia cosa o quienes tienen clave y P sobre el registro) y las dependencias (el 8 leído, la base y, si lo sitúa, el anfitrión). Una fórmula que sitúa a su propio registro, evaluada mientras ese registro se mide para una base, queda PENDIENTE (no se mide a sí misma). Detalle en `docs/BQL.md` §7.13 y §7.14. **[X] decidir VG: la firma de `BASES()`.**

### 2.10 La celda 8 de Mapped y el cielo

`mapped.ocho(eje, foco, { alcance, epoca })` da lo que lee la celda 8 de Mapped: la base escrita en el 8 de la cohorte (`escrita`, `base`, `frescura`, `n`) o el respaldo al vuelo, dicho (`frescura: 'sin base escrita'`), y por medida la caja del foco con lo que queda debajo, en ella y encima; sin puesto ni puntuación. `mapped.textoOcho` lo pone en texto (`8 · hermanos · base <id8> (sin novedades) · n 4` o `8 · hermanos · sin base escrita (respaldo al vuelo) · n 4`). `mapa()` no lo calcula (se pide por cada registro de una escena). El cielo (`mundos/cielo.js`, `datosCielo`) lee igual con `situar` y su respaldo, y dice «sin base escrita». `app.js` pinta con `ocho` la celda 8 en sobrio («entre hermanos» la base leída o «sin base escrita (respaldo al vuelo)», y la caja del foco por medida).

### 2.11 Ejemplo ejecutado

Árbol de `ejemplos/ikisai/compras-hermanas.mjs`: dos proyectos bajo el génesis (el comedor, con el menú del día y el de la cena; el mercado, con un puesto) y ocho compras. Cada registro que resume a otros da de alta, en su propio evento, a su cosa (`comedor`, `menu-dia`, `menu-cena`, `mercado`, `puesto`) con clave y unos minutos de T. La casa tiene P sobre todo el eje. `escribirBasesDelEjemplo` escribe las seis bases de abajo arriba, cada una firmada por su cosa; la del génesis, por la casa.

```sh
node --input-type=module -e "
import { ejemploComprasHermanas, escribirBaseDe, escribirBasesDelEjemplo } from './ejemplos/ikisai/compras-hermanas.mjs';
import { ALCANCES, medir, leerBase, situar, comprobar, cajasEtiquetadas, puedeEscribirBase } from './src/bases.js';
import { consultar } from './src/bql.js';
const ej = await ejemploComprasHermanas();
const { eje } = ej;
const g = medir(eje, ej.guisos.id);
console.log('guisos', JSON.stringify({ posiciones: g.posiciones, terminales: g.terminales, escritos: g.escritos, identidades: g.identidades, profundidadHilo: g.profundidadHilo, formulasResueltas: g.formulasResueltas, formulasPendientes: g.formulasPendientes, tokens: g.tokens }));
const sin = situar(eje, ej.guisos.id);
const alVuelo = situar(eje, ej.guisos.id, { alcance: 'general', respaldo: true });
console.log('sin bases:', sin.estado, '·', sin.frescura, '· respaldo general: n', alVuelo.n, '·', alVuelo.frescura);
console.log('quién escribe la base del menú:', ['menu-dia', 'casa', 'cocina'].map((x) => x + ' ' + (puedeEscribirBase(eje, x, ej.menu.id).por ?? 'no')).join(' · '));
await escribirBasesDelEjemplo(ej);
const nombres = [['menú', ej.menu.id], ['cena', ej.cena.id], ['puesto', ej.puesto.id], ['comedor', ej.comedor.id], ['mercado', ej.mercado.id], ['génesis', eje.genesisId]];
for (const [nombre, id] of nombres) {
  const b = leerBase(eje, id);
  console.log(nombre.padEnd(8), 'firma', b.autor.padEnd(9), '(' + b.por + ') · hijos', b.hijos.n, '· subárbol', String(b.subarbol.n).padStart(2), '· fundidas', b.refsBases.length, '· terminales', b.subarbol.medidas.terminales.cajas.join(' '), '· sin novedades', b.frescura.sinNovedades);
}
console.log(cajasEtiquetadas(leerBase(eje, eje.genesisId).subarbol, 'terminales').map((c) => c.caja + ' ' + c.nombre + ': ' + c.cuenta).join(' | '));
for (const alcance of ALCANCES) {
  const s = situar(eje, ej.guisos.id, { alcance });
  const t = s.medidas.terminales;
  console.log(alcance.padEnd(8), s.estado, s.escrita ? 'escrita' : 'al vuelo', '· n', String(s.n).padStart(2), '· terminales', t.foco, 'caja', t.caja, '(' + t.hito.nombre + ')', 'debajo', t.debajo, 'en caja', t.enCaja, 'encima', t.encima, '· pendientes', s.medidas.formulasPendientes.foco, 'debajo', s.medidas.formulasPendientes.debajo, '· la 4 en', s.posiciones[4].comparables + '/' + s.n);
}
console.log('lo escrito = lo calculado al vuelo antes:', JSON.stringify(situar(eje, ej.guisos.id, { alcance: 'general' }).medidas) === JSON.stringify(alVuelo.medidas));
const q = (f) => consultar(eje, ej.guisos.id, [], f).texto;
console.log('BQL:', ['BASES(\"hermanos\")', 'BASES(\"general\")', 'BASES(\"proyecto\", \"terminales\")', 'BASES(\"general\", \"E:casa/EUR\", \"suma\")'].map((f) => f + ' = ' + q(f)).join(' · '));
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
sin bases: PENDIENTE · sin base escrita · respaldo general: n 14 · sin base escrita
quién escribe la base del menú: menu-dia identidad · casa poder · cocina no
menú     firma menu-dia  (identidad) · hijos 4 · subárbol  5 · fundidas 0 · terminales 0 1 0 0 0 4 0 0 0 0 · sin novedades true
cena     firma menu-cena (identidad) · hijos 2 · subárbol  3 · fundidas 0 · terminales 0 0 0 0 2 1 0 0 0 0 · sin novedades true
puesto   firma puesto    (identidad) · hijos 2 · subárbol  3 · fundidas 0 · terminales 0 0 0 1 2 0 0 0 0 0 · sin novedades true
comedor  firma comedor   (identidad) · hijos 2 · subárbol  9 · fundidas 2 · terminales 0 1 0 0 3 5 0 0 0 0 · sin novedades true
mercado  firma mercado   (identidad) · hijos 1 · subárbol  4 · fundidas 1 · terminales 0 0 0 2 2 0 0 0 0 0 · sin novedades true
génesis  firma casa      (identidad) · hijos 2 · subárbol 14 · fundidas 2 · terminales 0 2 0 2 5 5 0 0 0 0 · sin novedades true
0 idea: 0 | 1 aprendizaje: 2 | 2 avanzado: 0 | 3 aprendizaje profesional: 2 | 4 resolución profesional: 5 | 5 aprendizaje superior: 5 | 6 solución profesional avanzada: 0 | 7 investigación: 0 | 8 trabajo maestro: 0 | 9 resolución experimental muy avanzada: 0
hermanos RESUELTO escrita · n  4 · terminales 9 caja 5 (aprendizaje superior) debajo 1 en caja 3 encima 0 · pendientes 1 debajo 3 · la 4 en 2/4
proyecto RESUELTO escrita · n  9 · terminales 9 caja 5 (aprendizaje superior) debajo 4 en caja 5 encima 0 · pendientes 1 debajo 8 · la 4 en 2/9
general  RESUELTO escrita · n 14 · terminales 9 caja 5 (aprendizaje superior) debajo 9 en caja 5 encima 0 · pendientes 1 debajo 13 · la 4 en 2/14
lo escrito = lo calculado al vuelo antes: true
BQL: BASES("hermanos") = 4 · BASES("general") = 14 · BASES("proyecto", "terminales") = 5 · BASES("general", "E:casa/EUR", "suma") = 685
menú tras un té: {"t":"2026-11-07T18:00:00Z","hijosNuevos":1,"basesNuevas":0,"debajo":0,"sinNovedades":false} · génesis: {"t":"2026-11-07T18:00:00Z","hijosNuevos":0,"basesNuevas":0,"debajo":1,"sinNovedades":false}
menú corregido: hijos 5 · anteriores 1 · comedor: {"t":"2026-11-07T18:00:00Z","hijosNuevos":0,"basesNuevas":1,"debajo":0,"sinNovedades":false}
nota sobre el café: sin novedades true · comprobar false [["escritos","posiciones","posiciones por PV"]]
```

Los ids no se imprimen: las claves de la casa y de las cosas son nuevas en cada ejecución y entran en los eventos, así que cambian.

Lectura: sin bases, `situar` no inventa nada: dice «sin base escrita», y el respaldo calcula al vuelo los catorce registros y lo declara. La base del menú la puede escribir su cosa (identidad) o la casa (poder); cocina, sin P sobre el menú, no. Escritas las seis bases, la compra de dos guisos (nueve terminales, una fórmula pendiente) cae en la caja 5 de `terminales` (de 6 a 9) en las tres cohortes, y la cohorte cambia lo que hay alrededor: con sus hermanos, uno por debajo y tres en su caja; en el ámbito general, nueve por debajo. Lo leído del 8 del génesis es exactamente lo que el respaldo calculaba al vuelo antes de escribir nada. Es la única con una fórmula pendiente: en `formulasPendientes` todo el resto queda por debajo. La etiqueta «aprendizaje superior» es la de la caja 5, no un grado de la compra. Un té sobre el menú deja su base con novedades, y el génesis lo ve debajo (a través de la base del comedor); al corregir la base del menú, la del comedor ve una base nueva en sus hijos. Una nota sobre el café no es una llegada al menú: la frescura no la ve y `comprobar` sí.

`E:casa/EUR` suma 685 en el ámbito general: son los euros movidos por los catorce registros (los 500 que emite el génesis, los que reparten el comedor y el mercado y los de las compras). Cada serie va por su clave y no se suma con otras.

## 3. Abiertos ([X] decidir VG)

Lo decidido en `MAPA` §12 y §14.2 está construido: la verdad del 8 es la escrita, la escribe la propia cosa o quien tiene P sobre ella con su clave y gastando su T, `medir` es único y fundible, las cohortes se leen del 8, `confluir` queda como respaldo declarado, se retira `comparar`, BQL hereda gancho y presupuesto, y los cortes salen de la época (la 0 trae `1 2 3 4 6 10 16 26 42`). Queda por decidir:

1. **Cómo se identifica un registro con una identidad.** Hoy, la única cosa con clave que el propio registro da de alta; la del génesis, su autor (§2.2).
2. **Valores de los cortes** de la época 0 (`1 2 3 4 6 10 16 26 42` para todo, provisional) y si alguna medida lleva los suyos (§2.3).
3. **Coste de una base.** Un minuto de T, como la ejecución. Con la regla de escritura (un minuto por posición, `src/escritura.js`) serían cientos de minutos: una base ocupa cientos de posiciones.
4. **Composición de las cohortes**: qué registro es el proyecto, si su cohorte es todo lo que cuelga de él o solo sus hijos, y si los hermanos exigen además la misma posición `en`.
5. **Fórmulas pendientes.** PENDIENTE, INCOMPATIBLE y ERROR cuentan juntas.
6. **Disposición del payload.** Hoy una lista (título, n, las dos estadísticas, las referencias): `n` cae en la posición 1 y las series en la 4 de cada estadística, sin atender al PV de cada posición. Podría ir por PV.
7. **«Más reciente» por llegada**, no por `t`: una base con `t` atrasado escrita después manda.
8. **Qué es la frescura** (§2.7): hoy, lo llegado; aparte, `comprobar`.
9. **Lo que cuelga de un hijo sin base** no cuenta y se dice (`sinBase`, §2.4).
10. **La firma de `BASES()`** (§2.9). Hay dos formas que no caben juntas; las compara `docs/BQL.md` §7.14.
11. **El poder para escribir una base, ¿al escribirla o hoy?** Hoy se mira al escribirla (§2.5): una base de quien tenía P sigue valiendo aunque después lo delegue. El motor, para autorizar, mira el poder de hoy.

## 4. Límites observados

- `movimientos.P:<ámbito>` y cada serie de token crean un bloque por serie: con muchas series la base crece (sigue sin depender de n).
- Medir evalúa fórmulas en el momento: la misma compra puede pasar de pendiente a resuelta sin que la base lo vea hasta que se reescriba (`comprobar` sí lo ve).
- Una fórmula `BASES()` en un registro cuenta como pendiente en la medida de ese registro para una base, y como resuelta si el respaldo lo mide directamente: la medida de un registro con `BASES()` dentro depende de quién la pide.
- Lo que se guarda en el 8 depende del 8 anterior por las fórmulas que leen el 8 sin situar a su registro (`FRESCURA`, `BASES` sin medida o con un dato de la base): sin base escrita cuentan como pendientes y con base, como resueltas. La primera base de un 8 y la siguiente, sin que llegue nada, difieren; la frescura de la primera no lo ve y `comprobar` sí (`docs/BQL.md` §7.14). **[X] decidir VG: si las fórmulas que leen el 8 deben contar en `formulasResueltas` y `formulasPendientes`.**
- Lo escrito sobre una compra (que no es una cosa) no entra en el subárbol de su menú mientras nadie escriba la base de la compra (`sinBase`); quien tiene P sobre ella puede escribirla.
- Validar una base escrita por poder repasa los movimientos de P anteriores a ella (una vez por base: la partición del 8 se guarda).
- `mapped.mapa().medidas` y la suma de Scened siguen siendo recuentos de la vista (hilo, escritos, movimientos, identidades, posiciones del camino), no la medida del 8; la celda 8 lee `mapped.ocho()`.
