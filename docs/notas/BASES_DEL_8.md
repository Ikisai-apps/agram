# Bases del 8: registros fundibles en la posición 8

Nota de la pieza · 7-11-2026 · Código: `src/bases.js`. Pruebas: `test/bases.test.js`. Ejemplo: `ejemplos/ikisai/compras-hermanas.mjs` (datos inventados). Resumen en `docs/MOTOR.md` §14. Lo que el mapa no decide va marcado **[X] decidir VG**; nada de eso se ha inventado como decisión, solo como valor provisional para que el código funcione.

Rutas abreviadas: `MAPA` = `C:\Users\acer\Documents\Ikisai\MUELA\equipo\agram\MAPA_GLOBAL_AGRAM.md`; `PV8_R1` = `agx/80_HERENCIA_V3_INTEGRA/80_V2_INTEGRO/90_FUENTES_CONSULTA/AGRAM_PV8_R1_Calibracion_Dinamica_Comparabilidad_Impugnacion_v1.1-candidata.md` (herencia V2, candidata).

## 1. Lo decidido

`MAPA` §12, [D] «Cohortes y bases del 8» (VG, 7-11 tarde: «exactamente lo que buscábamos»):

> tres cohortes útiles (hermanos = elementos similares; linaje/proyecto = dónde estoy; general = el ámbito). Sin base de datos aparte: las estadísticas son REGISTROS escritos en la posición 8 del registro que resumen («bases»), con referencias a lo medido; el 8 del proyecto funde las bases de sus hijos; el 8 del génesis funde las de los proyectos. Corregir = añadir otra base (historia gratis). Medidas FUNDIBLES: recuentos, sumas, mín, máx e histograma de diez cajas por medida = una décupla por medida, cuyas diez posiciones son los diez niveles/hitos del 8; el foco se sitúa en su caja en cada cohorte. Fundir es O(1); la base lleva fecha y frescura. La escribe la propia cosa (proyecto) con su clave y gastando su T. Cortes de las cajas = regla de la época. Lo no fundible (medianas exactas, correlaciones) se aproxima o se descarta. Código: bases en el 8 con fundir/frescura y BASES() en BQL; la cohorte se elige leyendo el 8 del padre, del proyecto o del génesis.

Del corpus heredado (V2, candidato; solo como apoyo, no decide): «La misma evidencia en una cohorte nueva: posición **relativa** distinta» y «No borrar las valoraciones anteriores. Cada valoración es un producto contextual con identificador, perfil de reglas, snapshot del corpus accesible, cohorte y resultado» (`PV8_R1` l.235 y l.238); «Dos cohortes no conectadas — Comparar por separado; no inventar escala puente» (`PV8_R1` l.376, R29); distinguir `n_registros` de `n_actores_declarados` (`PV8_R1` §6.2).

## 2. Qué hace el código

### 2.1 Medidas de un registro: `medir(eje, id)`

Recuentos, todos fundibles. Un objeto plano `{ <medida>: número }`:

| Medida | Qué cuenta |
|---|---|
| `posiciones.0` … `posiciones.9` | posiciones desarrolladas (terminales, referencias incluidas) bajo la posición k de la raíz del payload: una décupla por registro. Un payload terminal no tiene posición 0: cuenta 0 en cada PV. |
| `posiciones` | posiciones desarrolladas del payload entero (un terminal = 1). |
| `escritos` | registros escritos encima (hijos), **sin contar las bases**. |
| `identidades` | identidades distintas entre el autor y los `de`/`a` de sus movimientos. |
| `profundidad` | del hilo: génesis = 0. |
| `formulas.resueltas`, `formulas.pendientes` | fórmulas BQL del payload evaluadas al medir; pendiente = no resuelta (PENDIENTE, INCOMPATIBLE o ERROR). |
| `movimientos.<clave de serie>` | movimientos del evento en cada serie de token (`movimientos.T:hora`, `movimientos.E:casa/EUR`, `movimientos.P:<ámbito>`, `movimientos.R:<emisor>`). Una por serie movida; sin conversión ni suma entre series. |

Las dieciséis primeras son fijas (`MEDIDAS`); las de movimientos aparecen con las series. Una serie que una base no nombra vale cero en sus n registros, así que fundir es exacto.

### 2.2 Histograma de diez cajas y cortes

Por medida, una base guarda `{ cajas: [diez recuentos], suma, minimo, maximo }` y la base entera `n`. Las diez posiciones de `cajas` son los diez niveles/hitos del 8: `ETIQUETAS` = `HITOS` de `src/tiempo.js`, **solo como etiquetas** (`cajasEtiquetadas(base, medida)`); nada asigna nivel ni grado a nadie.

Cortes fijos por medida (`CORTES`, nueve umbrales; caja k = valores con `cortes[k-1] <= v < cortes[k]`):

| Medidas | Cortes | Cajas |
|---|---|---|
| `posiciones.*`, `posiciones`, `escritos` | 1 2 3 4 6 10 16 26 42 | 0 · 1 · 2 · 3 · 4–5 · 6–9 · 10–15 · 16–25 · 26–41 · ≥42 |
| `identidades`, `profundidad`, `formulas.*`, `movimientos.*` | 1 2 3 4 5 6 7 8 9 | 0 · 1 · … · 8 · ≥9 |

**[X] decidir VG: cortes = regla de la época.** Hoy son una constante (`VERSION_CORTES = 'cortes-0'`) que va en el contexto de cada base; `fundir` rechaza bases con cortes distintos (no se inventa escala puente).

### 2.3 Fundir: `fundir(a, b)`

Suma caja a caja, suma las sumas y `n`, toma mínimo y máximo. Coste fijo (dieciséis medidas más las series), independiente de cuántos registros resuma cada base: O(1) respecto a lo medido. Conmutativa y asociativa, con neutro `baseVacia()`. Rechaza cortes distintos y profundidades distintas. Devuelve solo la estadística; las referencias las pone quien construye la base.

Lo no fundible no está: ni medianas ni cuantiles ni correlaciones. La media sale de `suma / n`.

### 2.4 El 8 del padre: `baseDe(eje, padre)` y `escribirBase`

`baseDe` mide uno a uno los hijos del padre (los hermanos entre sí, sin las bases) y los funde. `escribirBase(eje, { autor, padre, privada, t, desde = 'hijos' })` la escribe como un evento normal:

| Campo | Valor |
|---|---|
| `sobre` / `en` | el padre / `CIELO` = `'8000000000'` |
| `autor` | una identidad **con clave**, que firma (`privada` obligatoria) |
| `movimientos` | `COSTE_BASE`: un minuto de T del autor |
| `contexto` | `{ bases: true, n, hasta, profundidad, desde, cortes }`; `hasta` = id del último hijo medido |
| `payload` | `['Bases del 8', n, [diez bloques de posiciones.0–9], [seis bloques del registro], [pares (clave de serie, bloque)], [referencias {ref} a lo medido]]`, con `bloque = [cajas, suma, mínimo, máximo]`; las listas de más de diez se anidan en décuplas (`empaquetar`) |

No se escribe una base vacía (`nada que medir`). **Corregir = escribir otra base**: la anterior se queda en el 8 como un ocupante más (colisión); `encaje.ocupantes(eje, padre, [8])` las da todas.

### 2.5 Hacia arriba: `fundirHaciaArriba(eje, id, { profundidad })`

La base de un registro a partir de las bases escritas en el 8 de sus hijos, **sin releer registros**. `profundidad` dice a cuántas generaciones por debajo están los registros medidos: la base de hijos es la 1; la del proyecto, que funde las de sus hijos, la 2; la del génesis sobre los proyectos, la 3 en el ejemplo. Así la cohorte siempre son registros a la misma altura y no se mezclan hijos con nietos. Sin `profundidad`, se infiere de las bases de los hijos (todas iguales, o error). Las referencias son las **bases fundidas**; los hijos con descendencia y sin base a esa profundidad quedan en `sinBase` (no cuentan: hay que escribirla antes), los que no tienen descendencia en `vacios`. Se escribe con `escribirBase(…, { desde: 'bases' })`.

### 2.6 Leer: `leerBase(eje, id, { profundidad, autor })`

La base más reciente **por llegada** en el 8 de `id`, o `null`. Solo cuenta lo que está firmado por una identidad con clave y bien formado (cajas que suman n, extremos finitos, `n` igual al del contexto); lo demás escrito en el 8 se ignora. Devuelve la estadística, las referencias, los metadatos, `anteriores` (bases válidas anteriores en ese 8) y la **frescura**: `{ t, hijosNuevos, basesNuevas, alDia }`; `hijosNuevos` = hijos llegados después de `hasta`; `basesNuevas` (solo en las fundidas) = hijos cuya base vigente ya no es la fundida.

### 2.7 Situar: `situar(eje, foco, { cohorte })`

| Cohorte | Lee el 8 de | Profundidad |
|---|---|---|
| `hermanos` | el padre | 1 |
| `proyecto` | el proyecto: el registro del hilo que cuelga del génesis (`proyectoDe`), o el `proyecto` dado si está en el hilo | distancia del foco al proyecto |
| `general` | el génesis | profundidad del foco |

Por medida: `{ valor, caja, etiqueta (HITOS de esa caja), enCaja, debajo, encima, minimo, maximo, media }`, con `debajo + enCaja + encima = n`. Estado `RESUELTO`, o `PENDIENTE` con motivo: `sin cohorte` (el génesis no tiene padre; un proyecto no tiene proyecto encima) o `sin base en el 8 de …`. `incluido` dice si la base de hermanos mide al foco.

### 2.8 Ejemplo ejecutado

Árbol de `ejemplos/ikisai/compras-hermanas.mjs`: dos proyectos bajo el génesis (las altas, con el menú del día y el de la cena; el mercado, con un puesto), ocho compras a profundidad 3. La casa escribe seis bases (`escribirBasesDelEjemplo`): hermanos en el 8 del menú, de la cena y del puesto; fundidas en el 8 de los dos proyectos y del génesis.

```sh
node --input-type=module -e "
import { generarClaves } from './src/autoridad.js';
import { ejemploComprasHermanas, escribirBasesDelEjemplo } from './ejemplos/ikisai/compras-hermanas.mjs';
import { medir, leerBase, escribirBase, situar, cajasEtiquetadas, COHORTES } from './src/bases.js';
const casa = await generarClaves();
const ej = await ejemploComprasHermanas({ claves: { casa } });
const { eje } = ej;
console.log('guisos', JSON.stringify(medir(eje, ej.guisos.id)));
await escribirBasesDelEjemplo(ej, casa.privada);
const nombres = [['menú', ej.menu.id], ['cena', ej.cena.id], ['puesto', ej.puesto.id], ['alta', ej.alta.id], ['mercado', ej.mercado.id], ['génesis', eje.genesisId]];
for (const [nombre, id] of nombres) {
  const b = leerBase(eje, id);
  console.log(nombre.padEnd(8), 'n', b.n, '· prof.', b.profundidad, '·', b.desde.padEnd(5), '· refs', b.refs.length, '· posiciones', b.medidas.posiciones.cajas.join(' '), '· suma', b.medidas.posiciones.suma, '· al día', b.frescura.alDia);
}
console.log(cajasEtiquetadas(leerBase(eje, eje.genesisId), 'posiciones').map((c) => c.caja + ' ' + c.nivel + ' ' + c.nombre + ': ' + c.cuenta).join(' | '));
for (const cohorte of COHORTES) {
  const s = situar(eje, ej.guisos.id, { cohorte });
  const p = s.medidas.posiciones;
  const f = s.medidas['formulas.pendientes'];
  console.log(cohorte.padEnd(8), s.estado, '· n', s.n, '· posiciones', p.valor, 'caja', p.caja, '(' + p.etiqueta.nombre + ')', 'debajo', p.debajo, 'en caja', p.enCaja, 'encima', p.encima, '· pendientes', f.valor, 'caja', f.caja, 'debajo', f.debajo);
}
await eje.escribir({ autor: 'vecina', sobre: ej.menu.id, t: '2026-11-07T18:30:00Z', movimientos: [{ token: 'T', escala: 'hora', cantidad: 1, de: 'vecina', a: null }], payload: 'Un té' });
console.log('menú tras un té:', JSON.stringify(leerBase(eje, ej.menu.id).frescura));
await escribirBase(eje, { autor: 'casa', padre: ej.menu.id, privada: casa.privada, t: '2026-11-07T19:00:00Z' });
const m = leerBase(eje, ej.menu.id);
console.log('menú corregido: n', m.n, '· anteriores', m.anteriores, '· al día', m.frescura.alDia, '· alta:', JSON.stringify(leerBase(eje, ej.alta.id).frescura));
console.log('sin base:', situar(eje, ej.fruta.id, { cohorte: 'hermanos', autor: 'cocina' }).motivo.replace(/[0-9a-f]{8}/, '<menú>'), '· génesis:', situar(eje, eje.genesisId).motivo);
"
```

```text
guisos {"posiciones.0":1,"posiciones.1":3,"posiciones.2":1,"posiciones.3":2,"posiciones.4":2,"posiciones.5":0,"posiciones.6":0,"posiciones.7":0,"posiciones.8":0,"posiciones.9":0,"posiciones":9,"escritos":0,"identidades":2,"profundidad":3,"formulas.resueltas":1,"formulas.pendientes":1,"movimientos.T:hora":1,"movimientos.E:casa/EUR":1}
menú     n 4 · prof. 1 · hijos · refs 4 · posiciones 0 1 0 0 0 3 0 0 0 0 · suma 25 · al día true
cena     n 2 · prof. 1 · hijos · refs 2 · posiciones 0 0 0 0 1 1 0 0 0 0 · suma 10 · al día true
puesto   n 2 · prof. 1 · hijos · refs 2 · posiciones 0 0 0 0 2 0 0 0 0 0 · suma 8 · al día true
alta     n 6 · prof. 2 · bases · refs 2 · posiciones 0 1 0 0 1 4 0 0 0 0 · suma 35 · al día true
mercado  n 2 · prof. 2 · bases · refs 1 · posiciones 0 0 0 0 2 0 0 0 0 0 · suma 8 · al día true
génesis  n 8 · prof. 3 · bases · refs 2 · posiciones 0 1 0 0 3 4 0 0 0 0 · suma 43 · al día true
0 0.3 idea: 0 | 1 1.1 aprendizaje: 1 | 2 2.1 aprendizaje avanzado: 0 | 3 3.1 aprendizaje profesional: 0 | 4 3.2 resolución profesional: 3 | 5 4.1 aprendizaje superior: 4 | 6 4.2 solución profesional avanzada: 0 | 7 5.1 investigación: 0 | 8 5.2 trabajo maestro: 0 | 9 5.3 resolución experimental: 0
hermanos RESUELTO · n 4 · posiciones 9 caja 5 (aprendizaje superior) debajo 1 en caja 3 encima 0 · pendientes 1 caja 1 debajo 3
proyecto RESUELTO · n 6 · posiciones 9 caja 5 (aprendizaje superior) debajo 2 en caja 4 encima 0 · pendientes 1 caja 1 debajo 5
general  RESUELTO · n 8 · posiciones 9 caja 5 (aprendizaje superior) debajo 4 en caja 4 encima 0 · pendientes 1 caja 1 debajo 7
menú tras un té: {"t":"2026-11-07T18:00:00Z","hijosNuevos":1,"basesNuevas":0,"alDia":false}
menú corregido: n 5 · anteriores 1 · al día true · alta: {"t":"2026-11-07T18:00:00Z","hijosNuevos":0,"basesNuevas":1,"alDia":false}
sin base: sin base en el 8 de <menú> a profundidad 1 · génesis: sin cohorte: el foco no tiene padre
```

Los ids no se imprimen: la clave de la casa es nueva en cada ejecución y entra en el génesis, así que cambian.

Lectura: la compra de dos guisos (nueve posiciones, una fórmula pendiente) cae en la caja 5 de `posiciones` en las tres cohortes, pero la cohorte cambia lo que hay alrededor: con sus hermanos, uno por debajo y tres en su caja; en el ámbito general, cuatro por debajo. Es la única con una fórmula pendiente: en `formulas.pendientes` todo el resto queda por debajo. La etiqueta «aprendizaje superior» es la de la caja 5, no un grado de la compra.

## 3. Abiertos ([X] decidir VG)

1. **Cortes = regla de la época.** Hoy, constante `CORTES` (`cortes-0`). Cuando la época los declare, cada base dirá con qué cortes se hizo y no se fundirán bases de cortes distintos (ya es así).
2. **Quién escribe.** El mapa: «la propia cosa (proyecto) con su clave». Hoy: cualquier identidad con clave que firme y tenga T; en el ejemplo, la casa. Debería ser el registro resumido como identidad (una cosa con clave). Y quién puede escribir bases en un 8 ajeno (hoy cualquiera con clave: es de AARPIA).
3. **Coste.** Un minuto de T, como la ejecución. Con la regla de escritura (un minuto por posición) serían cientos de minutos: cada medida ocupa trece posiciones.
4. **Qué registro es el proyecto.** Hoy, el del hilo que cuelga del génesis (como en la PR #19); `situar` admite otro con `{ proyecto }` si está en el hilo.
5. **Hermanos y la posición `en`.** Hoy los hermanos son todos los hijos del padre, anclados donde sea (como `comparar`).
6. **Fórmulas pendientes.** PENDIENTE, INCOMPATIBLE y ERROR cuentan juntas como pendientes.
7. **Disposición del payload.** Hoy una lista (título, n, PV, registro, series, referencias). Podría ir por PV (cada familia de medidas en el PV que le toca).
8. **«Más reciente» por llegada**, no por `t`: una base con `t` atrasado escrita después manda.
9. **Frescura** solo cuenta hijos nuevos y bases nuevas; no ve que un hijo ya medido haya cambiado (escritos nuevos encima, fórmulas que se resuelven).

## 4. BASES() en BQL (propuesta, no implementada)

`src/bql.js` no se toca en esta pieza. Lo que BQL debería exponer, con el anfitrión del slot como registro:

| Función | Devuelve |
|---|---|
| `BASES()` | numero: `n` de la base vigente del 8 del anfitrión |
| `BASES("medida", k)` | numero: recuento de la caja k (0–9) de esa medida en esa base |
| `BASES("medida", "suma" \| "minimo" \| "maximo")` | numero |
| `SITUAR("medida", "hermanos" \| "proyecto" \| "general")` | numero: la caja (0–9) del anfitrión en esa cohorte |

PENDIENTE con el motivo de `leerBase`/`situar` cuando no hay base o cohorte; la dependencia anotada es la base leída (`<id de la base>:0000000000`). Ojo al ciclo de importación: `bases.js` usa `evaluar` de BQL para contar fórmulas; si `bql.js` importa `bases.js`, ninguno de los dos debe usar al otro al cargar.

## 5. Relación con la PR #19 y límites observados

- La PR #19 (`confluir` en `src/tiempo.js`, abierta) **calcula** cohortes y bases sin escribirlas, con medidas casi iguales (allí `cajas: null` si los cortes salen de la cohorte). Esta pieza las **escribe** como registros, con cortes fijos. Si se fusionan las dos, `medir` debería ser uno solo.
- `tiempo.comparar` y `tiempo.medir` (no tocados) cuentan las bases como hermanos y como escritos; al integrarlas deberían filtrar `esBase`.
- `movimientos.P:<ámbito>` crea una medida por ámbito: con muchos ámbitos la base crece (sigue sin depender de n).
- Medir evalúa fórmulas en el momento: la misma compra puede pasar de pendiente a resuelta sin que la base lo vea hasta que se reescriba.
