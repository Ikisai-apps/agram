# Rendimiento del núcleo

Nota de medida · 7-11-2026 · **No decide nada de AGRAM.** Mide el núcleo de `main` en `7090c8c` con un banco reproducible, señala los puntos calientes y propone. Desde entonces `main` recibió la integración #55 (`03dbf34`: fábrica, bases, efectos, validez, Scened, mundo de los hilos y frontend). Esta rama la lleva fusionada, con las pruebas en verde, y Scened usa ya el índice de prefijos (§8.3). Las tablas de §3, §4 y §6 son de `7090c8c` y no se han vuelto a medir; las bases del 8 sí se miden ahora con el `main` actual (§5). Solo se han tocado cuatro índices sin cambio de semántica (§8), cada uno con su prueba; el resto son propuestas (§7). Lo que roza una decisión va marcado «[X] decidir VG».

Banco: `bench/eje.mjs`, sin dependencias. `npm run bench` (1.000, 5.000 y 20.000 registros); `npm run bench -- --tamanos 1000 --solo ocupantes,bql` para una parte; `--json fichero` guarda las filas. Las tablas de esta nota salen tal cual de esa salida.

## 1. En tres frases

1. **Escribir no se degrada con el tamaño**: añadir un registro firmado ya creado cuesta ≈1–1,5 ms y escribirlo entero (crear, firmar y añadir) ≈1,8–3,8 ms, sin crecer de 1.000 a 20.000 registros (lo que cambia entre columnas es la carga de la máquina), y casi todo es criptografía por Web Crypto (SHA-256 del id, verificar la firma ECDSA e importar la clave pública del autor).
2. **Tres cosas crecen mal**: (a) los ocupantes de una posición muy concurrida, porque marcar los empates comparaba cada par (cuadrático: 400 ms con 1.066 ocupantes en una posición): **corregido aquí**, lineal; (b) **restaurar**, que revalida todo el eje en serie esperando a la criptografía (137 s con 20.000 registros en `main`, en una pasada con la máquina cargada; es la medida que más varía con la carga, §2); (c) **confluir recalculado**, lineal en la cohorte con un coste alto por registro (9 s la cohorte «general» con 20.000), que es justo lo que las bases del 8 (PR #44) evitan.
3. **`guardarLocal` deja de caber hacia los 8.000 registros**: el eje serializado ocupa ≈600 bytes por registro (11,6 MB con 20.000) y `localStorage` suele dar 5 MB por origen. La interfaz avisa, pero mal («sin almacenamiento», cuando es cuota llena), y lo grave no se ve: queda la copia anterior, más corta, que al recargar se carga como buena, y los registros posteriores se pierden sin aviso (P3).

## 2. Cómo se mide

**El eje generado** (PRNG `mulberry32` con semilla `20261107`; `construir(n, semilla)` se puede importar del banco):

- génesis de un grupo con clave, que emite T, E (EUR) y P sobre todo el eje;
- √n/3 proyectos (11 con 1.000, 24 con 5.000, 47 con 20.000), colgados del génesis; cada uno da de alta a **una cosa con clave**: la identidad propia que escribirá su base del 8 (`bases.identidadDe`);
- n/40 identidades dadas de alta de cinco en cinco: personas, grupos y cosas; el 85 % con clave (firman); el 20 % recibe P sobre el eje (pueden autorizar);
- el resto, **escritos sobre focos al azar**: 6 % sobre una «plaza» (el primer proyecto; el 60 % de lo suyo, anclado en `1000000000`, donde todo colisiona), 12 % sobre los focos calientes (el génesis y los cuatro primeros proyectos), 37 % sobre lo reciente (los últimos 60) y el resto uniforme; `en` por pesos de PV (1–4 y 7 más usados), a veces a profundidad 2 o en la raíz;
- payloads de 1 a 10 posiciones y hasta 3 de hondo: números, magnitudes (`'12 EUR'`), textos, **referencias** (`{ ref }` o `{ ref, dir }` a un camino real del otro registro, la mitad a lo reciente) y **fórmulas BQL** (LOCAL, BUSCAR por índice y por dirección, FILTRAR, ORDENAR + ELEGIR, SUMAR, REF por prefijo de 8, magnitudes);
- un 3 % de las veces, un **ciclo del motor**: consolidar (dos o tres elecciones, por referencia y terminal) → autorizar (80 %, por alguien con P que no es el autor) → ejecutar (70 % de lo autorizado, moviendo EUR);
- un 5 % de los registros lleva fecha futura (proyecciones para el eje temporal).

Las claves ECDSA salen de Web Crypto, no de la semilla: los ids cambian de una pasada a otra; la forma del eje (quién escribe qué, sobre qué y dónde) no.

**Los focos** de las medidas de lectura: el génesis; el **caliente** (el que más hijos tiene: la plaza, con 1.577 hijos y 1.066 ocupantes en `1000000000` con 20.000 registros); el **mediano** (la mediana de hijos entre los que tienen alguno: 1); una **hoja** al azar; y el de **hilo más largo** (23 eslabones con 20.000).

**Qué se cronometra**: lo síncrono, repetido hasta 300 ms y la mediana; por evento (validar, añadir, escribir, medidasDe), la mediana de 200 (o 100) eventos; lo caro (construir, confluir, restaurar), una vez. La construcción da la media por tipo de registro y su desglose crear · firmar · añadir.

**La máquina**: Windows 10, 4 hilos, Node 24.14.1, **compartida con otros agentes** (carga del 85–100 % durante las pasadas). Los números absolutos salen inflados y con ruido, sobre todo lo que espera a la criptografía (va por el grupo de hilos de libuv, que compite con los demás procesos); lo que vale es **cómo crecen** con el tamaño y las proporciones entre filas. En un microbanco aparte (con la misma carga), `subtle.digest` cuesta ≈0,16 ms esperado de uno en uno y ≈0,06 ms lanzado en paralelo, `verify` ≈0,45 ms e importar una clave pública ≈0,33 ms; `createHash` de Node, síncrono, 0,015 ms (no sirve: el núcleo corre también en el navegador). Restaurar es lo más sensible: en la revisión, con 1.000 registros, dio 9,8 ms por evento dentro del banco y 1,4 ms por evento aislado.

## 3. La tabla (esta PR)

Salida de `npm run bench` en esta rama sobre `7090c8c`, antes de fusionar la #55 (una pasada; semilla 20261107; Node 24.14.1; win32/x64):

- Focos de 1000: génesis 43 hijos, hilo 1; caliente 72 hijos, hilo 2; mediano 1 hijos, hilo 3; hoja 0 hijos, hilo 3; profundo 0 hijos, hilo 14. Memoria tras construir: 9 MB.
- Focos de 5000: génesis 175 hijos, hilo 1; caliente 411 hijos, hilo 2; mediano 1 hijos, hilo 8; hoja 0 hijos, hilo 12; profundo 0 hijos, hilo 19. Memoria tras construir: 20 MB.
- Focos de 20000: génesis 587 hijos, hilo 1; caliente 1577 hijos, hilo 2; mediano 1 hijos, hilo 12; hoja 0 hijos, hilo 5; profundo 0 hijos, hilo 23. Memoria tras construir: 47 MB.

| sección | medida | 1000 | 5000 | 20000 | nota (del mayor) |
|---|---|---:|---:|---:|---|
| construir | construir el eje entero (ms) | 3889 | 50925 | 78933 | 20000 registros; 581 ciclos del motor |
| construir | escribir: ms por registro (media de la construcción) | 3.89 | 10.2 | 3.95 |  |
| construir | alta firmado (ms/registro) | 7.29 | 5.88 | 3.90 | 147 registros (crear 0.656 · firmar 0.480 · añadir 2.76) |
| construir | escrito firmado (ms/registro) | 3.57 | 10.7 | 4.10 | 16448 registros (crear 0.810 · firmar 0.953 · añadir 2.34) |
| construir | escrito sin firma (ms/registro) | 2.34 | 4.30 | 1.79 | 2046 registros (crear 0.847 · firmar 0.0006 · añadir 0.940) |
| construir | motor: autorizar (ms/registro) | 2.83 | 11.3 | 4.25 | 460 registros |
| construir | motor: consolidar (ms/registro) | 4.02 | 10.3 | 3.99 | 581 registros |
| construir | motor: ejecutar (ms/registro) | 8.37 | 13.7 | 4.64 | 317 registros |
| validar | validar firmado (ms/evento) | 1.15 | 6.55 | 1.53 | 200 eventos |
| validar | validar sin firma (ms/evento) | 0.313 | 0.498 | 0.329 | 200 eventos |
| validar | · verificarId: canónico + SHA-256 (ms/evento) | 0.224 | 0.310 | 0.240 |  |
| validar | · verificar la firma, importando la clave (ms/evento) | 0.694 | 0.915 | 0.790 |  |
| validar | · solo subtle.verify, con la clave ya importada (ms/evento) | 0.606 | 0.649 | 0.859 |  |
| validar | · solo importar la clave pública (ms/evento) | 0.333 | 0.368 | 0.285 |  |
| ocupantes | ocupantes de las 10 posiciones · génesis (ms) | 0.509 | 2.16 | 6.83 | 587 hijos; 505 ocupantes, 208 en la posición mayor |
| ocupantes | arbol · génesis (ms) | 0.808 | 2.76 | 7.83 | 59 direcciones |
| vistas | mapa · génesis (ms) | 0.038 | 0.024 | 0.028 |  |
| vistas | ejeTemporal · génesis (ms) | 0.265 | 1.30 | 4.20 | 1 en el hilo; 561 pasado, 30 futuro |
| ocupantes | ocupantes de las 10 posiciones · caliente (ms) | 0.863 | 4.90 | 19.4 | 1577 hijos; 1487 ocupantes, 1066 en la posición mayor |
| ocupantes | arbol · caliente (ms) | 1.04 | 5.62 | 18.2 | 63 direcciones |
| vistas | mapa · caliente (ms) | 0.040 | 0.026 | 0.025 |  |
| vistas | ejeTemporal · caliente (ms) | 0.497 | 2.82 | 10.4 | 2 en el hilo; 1490 pasado, 113 futuro |
| ocupantes | ocupantes de las 10 posiciones · mediano (ms) | 0.304 | 0.090 | 0.069 | 1 hijos; 3 ocupantes, 2 en la posición mayor |
| ocupantes | arbol · mediano (ms) | 0.397 | 0.166 | 0.060 | 3 direcciones |
| vistas | mapa · mediano (ms) | 0.034 | 0.019 | 0.021 |  |
| vistas | ejeTemporal · mediano (ms) | 0.037 | 0.048 | 0.073 | 12 en el hilo; 12 pasado, 0 futuro |
| ocupantes | ocupantes de las 10 posiciones · hoja (ms) | 0.082 | 0.181 | 0.041 | 0 hijos; 1 ocupantes, 1 en la posición mayor |
| ocupantes | arbol · hoja (ms) | 0.047 | 0.282 | 0.013 | 1 direcciones |
| vistas | mapa · hoja (ms) | 0.023 | 0.030 | 0.015 |  |
| vistas | ejeTemporal · hoja (ms) | 0.021 | 0.084 | 0.028 | 5 en el hilo; 4 pasado, 0 futuro |
| ocupantes | ocupantes de las 10 posiciones · profundo (ms) | 0.049 | 0.119 | 0.039 | 0 hijos; 1 ocupantes, 1 en la posición mayor |
| ocupantes | arbol · profundo (ms) | 0.034 | 0.133 | 0.014 | 1 direcciones |
| vistas | mapa · profundo (ms) | 0.026 | 0.038 | 0.025 |  |
| vistas | ejeTemporal · profundo (ms) | 0.083 | 0.121 | 0.113 | 23 en el hilo; 22 pasado, 0 futuro |
| BQL | BUSCAR dirección, colisión entera · caliente (ms) | 0.651 | 3.30 | 12.3 | PENDIENTE POR LÍMITE (1000 de 1066) |
| BQL | BUSCAR índice, camino exacto · caliente (ms) | 0.622 | 3.42 | 12.3 | PENDIENTE POR LÍMITE (1000 de 1065) |
| BQL | FILTRAR por origen · caliente (ms) | 0.656 | 3.98 | 12.9 | PENDIENTE POR LÍMITE (1000 de 1066) |
| BQL | FILTRAR leyendo ACTUAL(0), para en el primero sin 0 · caliente (ms) | 0.892 | 4.09 | 13.0 | PENDIENTE POR LÍMITE (1000 de 1066) |
| BQL | ORDENAR + ELEGIR · caliente (ms) | 0.730 | 4.65 | 13.9 | PENDIENTE POR LÍMITE (1000 de 1066) |
| BQL | BUSCAR dirección, colisión entera · mediano (ms) | 0.056 | 0.051 | 0.041 | 1 |
| BQL | BUSCAR índice, camino exacto · mediano (ms) | 0.052 | 0.041 | 0.038 | 1 |
| BQL | FILTRAR por origen · mediano (ms) | 0.065 | 0.071 | 0.051 | 0 |
| BQL | FILTRAR leyendo ACTUAL(0), para en el primero sin 0 · mediano (ms) | 0.230 | 0.267 | 0.193 | PENDIENTE |
| BQL | ORDENAR + ELEGIR · mediano (ms) | 0.076 | 0.092 | 0.067 | 1 candidato: propio 5143fad8 |
| BQL | BUSCAR dirección, colisión entera · génesis (ms) | 0.103 | 0.233 | 0.589 | 53 |
| BQL | BUSCAR índice, camino exacto · génesis (ms) | 0.094 | 0.231 | 0.527 | 52 |
| BQL | FILTRAR por origen · génesis (ms) | 0.149 | 0.259 | 0.634 | 51 |
| BQL | FILTRAR leyendo ACTUAL(0), para en el primero sin 0 · génesis (ms) | 0.295 | 0.436 | 0.815 | PENDIENTE |
| BQL | ORDENAR + ELEGIR · génesis (ms) | 0.122 | 0.313 | 0.800 | 3 candidatos: propio b4b0f339 ·  |
| BQL | REF por prefijo de 8 (ms) | 0.022 | 0.022 | 0.017 | un registro de hace un tercio del eje |
| BQL | evaluar una fórmula del eje (ms/fórmula) | 0.155 | 0.071 | 0.124 | 240 de 300 registros al azar: RESUELTO 216, PENDIENTE 15, INCOMPATIBLE 6, ERROR 3 |
| confluir | medidasDe de un registro (ms) | 0.258 | 0.193 | 0.212 | mediana de 200 al azar |
| confluir | confluir, recalcula · hermanos (ms) | 22.5 | 142 | 527 | 1577 comparables |
| confluir | confluir, recalcula · proyecto (ms) | 84.1 | 474 | 2392 | 7357 comparables |
| confluir | confluir, recalcula · general (ms) | 362 | 1519 | 5980 | 20000 comparables |
| bases | bases del 8 | — | — | — | src/bases.js no estaba en `7090c8c` (PR #44): ver §5 |
| persistencia | serializar (ms) | 0.133 | 0.769 | 6.05 |  |
| persistencia | JSON.stringify (ms) | 10.7 | 52.0 | 346 | 11.6 MB |
| persistencia | JSON.parse (ms) | 12.8 | 66.2 | 470 |  |
| persistencia | restaurar (ms) | 2979 | 6388 | 53852 | 2.69 ms/evento |
| escribir | añadir firmado con el eje lleno (ms/evento) | 1.33 | 0.955 | 1.44 | 200 eventos |
| escribir | eje.escribir firmado: crear + firmar + añadir (ms/evento) | 2.42 | 1.77 | 3.80 | 100 eventos |

Cómo leerla: cada columna es una pasada, y la carga de la máquina cambió entre ellas (la de 5.000 cayó en un pico: construir a 10 ms por registro frente a 4 en las otras dos). Lo que hay que mirar es lo que crece con el tamaño y lo que no: escribir, validar, `mapa`, REF y lo de los focos pequeños quedan planos; ocupantes, árbol, BUSCAR y eje temporal de la plaza y del génesis crecen con sus hijos (lineal); confluir crece con la cohorte; restaurar, con el eje entero (54 s con 20.000, 2,7 ms por evento; en `main`, 137 s en otra pasada con otra carga: la diferencia no es toda de esta PR, que en el A/B de §4 gana ×1,18 al restaurar).

## 4. Antes y después de los índices de esta PR

Pasadas separadas en el tiempo no se pueden comparar en una máquina compartida (la carga cambia de un minuto a otro). Estas tablas salen de un A/B **intercalado**: el mismo generador y la misma semilla construyen un eje con `main` y otro con esta rama, y cada medida alterna una y otra (mediana de 5 a 9 vueltas). El guion del A/B no está en el repositorio: importa `construir` y `elegirFocos` de `bench/eje.mjs` de cada rama. Si «main / PR» es mayor que 1, esta PR va más rápida.

**5.000 registros** (restaurar, con 2.000):

| medida (ms, mediana) | main | esta PR | main / PR |
|---|---:|---:|---:|
| ocupantes de las 10 posiciones · caliente | 22,5 | 7,55 | ×2,98 |
| ocupantes de las 10 posiciones · génesis | 3,44 | 2,38 | ×1,45 |
| ocupantes de las 10 posiciones · mediano (×100) | 9,41 | 10,2 | ×0,93 (ruido) |
| arbol · caliente | 24,8 | 7,37 | ×3,37 |
| BUSCAR dirección · caliente | 24,3 | 4,04 | ×6,00 |
| BUSCAR dirección · génesis | 0,390 | 0,344 | ×1,13 |
| mapa · caliente (×100) | 47,1 | 2,19 | ×21,5 |
| REF por prefijo de 8 (×100) | 92,6 | 4,07 | ×22,8 |
| medidasDe de 500 registros | 233 | 211 | ×1,10 |
| confluir · hermanos | 178 | 175 | ×1,02 |
| confluir · general | 2.243 | 2.008 | ×1,12 |
| verificar la firma de 300 eventos | 534 | 275 | ×1,94 |
| restaurar 2.000 registros | 6.038 | 5.110 | ×1,18 |

**20.000 registros** (sin restaurar: no cabe intercalado en un tiempo razonable):

| medida (ms, mediana) | main | esta PR | main / PR |
|---|---:|---:|---:|
| ocupantes de las 10 posiciones · caliente | 497 | 49,6 | ×10,0 |
| ocupantes de las 10 posiciones · génesis | 40,8 | 7,00 | ×5,83 |
| ocupantes de las 10 posiciones · mediano (×100) | 7,05 | 7,48 | ×0,94 (ruido) |
| arbol · caliente | 452 | 38,6 | ×11,7 |
| BUSCAR dirección · caliente | 458 | 19,4 | ×23,5 |
| BUSCAR dirección · génesis | 1,21 | 0,714 | ×1,70 |
| mapa · caliente (×100) | 326 | 3,02 | ×108 |
| REF por prefijo de 8 (×100) | 226 | 2,99 | ×75,7 |
| medidasDe de 500 registros | 361 | 285 | ×1,27 |
| confluir · hermanos | 1.038 | 655 | ×1,59 |
| confluir · general | 12.037 | 7.116 | ×1,69 |
| verificar la firma de 300 eventos | 1.142 | 970 | ×1,18 |

Lo cuadrático desaparece (×10 a ×24 en la plaza con 20.000, y crece con el tamaño); las referencias por prefijo y `sobre` dejan de depender del tamaño del eje; confluir recalculado gana ×1,6–1,7 de rebote (sus fórmulas usan REF y BUSCAR). La firma gana entre ×1,2 y ×1,9 según la carga: lo que se ahorra es la importación, y la espera del grupo de hilos sigue (P1).

Una primera versión de los empates por claves era **más lenta** que la de pares con dos o tres ocupantes (lo normal): montar mapas y claves cuesta más que comparar tres pares, y `medidasDe` (diez posiciones por registro) lo notaba. Por eso hasta 12 ocupantes se sigue comparando por pares (el cruce medido está hacia 12–16) y, por encima, por claves. Lo mismo con la copia de `sobre`: `slice()` y no `[...]`, que en listas vacías era el doble de lento.

## 5. Bases del 8: fundir frente a recalcular (PR #44, ya en `main`)

Primera pasada (la tabla de abajo): con `src/bases.js` de la PR #44 (`bases-del-8`, `f1cfe66`) puesta encima de esta rama, y su `tiempo.js` (que deja las bases fuera de los comparables): `node bench/eje.mjs --solo confluir,bases`. La #44 está ya en `main` con la #55, con los mismos `src/bases.js` y `src/tiempo.js` que `f1cfe66`; con esta rama fusionada con `main`, `npm run bench` mide las bases sin poner nada encima (segunda pasada, más abajo). El banco escribe las bases de abajo arriba (cada proyecto con su cosa y su clave, después el génesis) y compara `situar` (lee la base del 8 que resume la cohorte) con `confluir` (recalcula la cohorte entera), sobre el mismo foco: el primer hijo de la plaza.

| medida (ms) | 1.000 | 5.000 | 20.000 | nota (20.000) |
|---|---:|---:|---:|---|
| calcularBase del proyecto caliente | 59,3 | 94,5 | 936 | 1.577 hijos medidos |
| escribirBase, por base | 28,7 | 47,1 | 97,5 | 41 bases (los proyectos con hijos y el génesis) |
| **situar · hermanos** | 0,542 | 0,820 | **2,51** | n 1.577 |
| confluir · hermanos | 18,7 | 100 | 922 | n 1.577 → **×367** |
| **situar · proyecto** | 0,602 | 0,804 | **2,49** | n 1.578 (el subárbol con base) |
| confluir · proyecto | 136 | 501 | 2.415 | n 7.357 → ×968 |
| **situar · general** | 0,749 | 1,20 | **5,49** | n 3.610 (el subárbol con base) |
| confluir · general | 261 | 1.194 | 8.583 | n 20.000 → ×1.562 |
| leerBase + fundir dos estadísticas | 0,072 | 0,231 | 1,95 | |

Segunda pasada, con el `main` actual (`03dbf34`) fusionado en esta rama: `node bench/eje.mjs --solo bases` (otra carga: construir fue a ≈6,6 ms por registro, frente a ≈4 en la primera; aquí `confluir` va en la misma fila que `situar`, medido justo después):

| medida (ms) | 1.000 | 5.000 | 20.000 | nota (20.000) |
|---|---:|---:|---:|---|
| calcularBase del proyecto caliente | 131 | 195 | 734 | 1.577 hijos medidos |
| escribirBase, por base | 58,4 | 35,7 | 58,2 | 41 bases |
| **situar · hermanos** | 0,603 | 0,804 | **2,25** | n 1.577; confluir 577 ms → ×257 |
| **situar · proyecto** | 0,527 | 0,836 | **1,97** | n 1.578; confluir 1.843 ms con n 7.357 → ×934 |
| **situar · general** | 0,794 | 1,38 | **4,92** | n 3.610; confluir 5.480 ms con n 20.000 → ×1.115 |
| leerBase + fundir dos estadísticas | 0,067 | 0,246 | 1,76 | |

Las dos pasadas dicen lo mismo: `situar` en milisegundos y `confluir` en cientos o miles; los factores cambian con la carga (×257 a ×367 en «hermanos»), el orden de magnitud no.

Lectura:

- **Fundir gana por dos y tres órdenes de magnitud** donde la comparación es justa: en «hermanos» las dos miden los mismos 1.577 registros y situar va 367 veces más rápido. Escribir la base cuesta lo que un recálculo de sus hijos (calcularBase ≈ confluir · hermanos), y se paga una vez por base, no por lectura.
- **En «proyecto» y «general» la base cubre menos**: n 1.578 frente a 7.357, y 3.610 frente a 20.000. Una base funde las de sus hijos, y aquí solo los proyectos y el génesis tienen identidad propia con clave (`bases.identidadDe`: una cosa dada de alta en el propio registro), así que lo que cuelga de un hijo sin base no cuenta (la #44 lo dice en `sinBase`). Con bases a todas las alturas los números se igualarían; hoy eso depende de cómo se identifica un registro con una identidad, que la #44 deja en «[X] decidir VG» (AARPIA).
- **situar no es O(1)**: crece con los hijos del registro que resume (0,5 ms con 72 hijos, 2,5 ms con 1.577) porque la `frescura` de la base recorre los hijos medidos para ver qué base vigente tiene cada uno, y para cada uno `particion` copia `eje.sobre(id)` entero solo para mirar su largo. Propuesta para la #44: guardar en la partición el largo visto y comparar con el largo del índice sin copiar, y llevar la frescura de forma incremental (lo llegado desde «hasta» por contador). Sigue siendo pequeño frente a recalcular.
- La PR #52 trae otra `src/bases.js` con otra API (`baseDe`, `fundirHaciaArriba`, `situar(…, { cohorte })`, sin `calcularBase`); el banco la detecta y salta la sección. Si sustituye a la #44, esta sección se ha de adaptar.

## 6. Puntos calientes, por orden

Medidos en `main` (`7090c8c`) con 20.000 registros, en una pasada del banco con `main` solo, distinta del A/B de §4 (por eso no coinciden: los ocupantes de la plaza dan aquí 401 ms y en el A/B 497 ms; es la carga). Del que más duele al que menos:

1. **Restaurar: 137 s** (6,9 ms por evento, con la máquina cargada: es lo que más varía con la carga, §2). Revalida cada evento en serie: copia JSON dos veces, SHA-256 del cuerpo, importa la clave del autor, verifica la firma y simula los movimientos. Es lineal, pero con un coste por evento alto que casi todo es **esperar** a Web Crypto (el 46 % del perfil, el hilo parado). Con la clave importada una vez (§8.4) baja la parte de la firma; lo grande es P1 y, si VG lo quiere, P2.
2. **Confluir recalculado: 9,3 s «general», 2,2 s «proyecto», 0,48 s «hermanos»**. Lineal en la cohorte, a ≈0,2–0,45 ms por registro (`medidasDe`: diez listas de ocupantes completas y todas las fórmulas del payload evaluadas). Las bases del 8 lo resuelven para la lectura (§5); recalcular sigue haciendo falta al escribir una base y al comprobarla: P4.
3. **Ocupantes de una posición muy concurrida: 401 ms** las diez posiciones de la plaza (1.066 ocupantes en una), 453 ms su árbol y **467 ms un BUSCAR** que encima acaba en PENDIENTE POR LÍMITE. Era cuadrático (`marcarEmpates`): **corregido aquí** (§8.1). Queda lineal, con un coste por ocupante alto (vector, signo, justificación en texto, cuatro copias del objeto): P5.
4. **Validar una firma: 0,7 ms de verificar + 0,3 ms de importar la clave** cada vez, aunque la clave sea siempre la misma. **Corregido aquí** (§8.4).
5. **REF por prefijo, «@id» y los REF que lee Scened: lineales en el eje** (0,87 ms por referencia con 20.000; en confluir «general» con 5.000, un 10 % del perfil). **Corregido aquí** (§8.3).
6. **`sobre(id, en)`** filtraba todos los hijos del registro en cada llamada (el génesis y la plaza, con cientos o miles): `mapa` de la plaza, 1,4 ms. **Corregido aquí** (§8.2).
7. **Guardar**: 11,6 MB de JSON con 20.000 registros (≈600 bytes por registro); no cabe en `localStorage` a partir de ≈8.000, y entonces queda guardada la copia anterior: P3.

Lo que **no** es un problema a estos tamaños: escribir (añadir, 1–1,5 ms; escribir entero, 1,8–3,8 ms por evento; plano con el tamaño), el `mapa` de cualquier foco, el eje temporal (13 ms en la plaza con 1.577 hijos y 113 proyecciones), BUSCAR/FILTRAR/ORDENAR en focos normales (≤1 ms), evaluar una fórmula (0,1–0,4 ms), `serializar` (7 ms) y la memoria (≈40 MB con 20.000 registros).

## 7. Propuestas (no implementadas)

Por ganancia esperada. Ninguna cambia lo que AGRAM decide salvo las marcadas [X].

**P1. Restaurar en dos pasadas.** `Eje.desde` (`src/eje.js:87`) añade los eventos uno a uno y cada uno espera a su hash y a su firma, que van por el grupo de hilos: en el perfil de restaurar 3.000 registros, el 46 % del tiempo el hilo principal está **parado esperando** a la criptografía. Propuesta: (1) en paralelo y por lotes, lo que no depende del orden: que el id es el hash del cuerpo y, para los autores cuya clave declaró un alta anterior (se recogen de `contexto.claves` en una pasada sin criptografía), la firma; (2) en serie, como hoy, saldos, series, tipos y claves, con lo ya verificado. Lo único medido es `subtle.digest`: en el microbanco de §2, 0,056 ms en paralelo frente a 0,16 ms en serie (×2,9). `verify` e `importKey` en paralelo no se han medido, y la validación en serie (saldos, series, tipos y claves) se queda como está: ×3–5 en restaurar sería una **cota optimista**, que hay que medir con el cambio hecho. Lo que se acepta y se rechaza es lo mismo; solo puede cambiar cuál de varios errores se nombra primero. Toca `desde` y `validar`.

**P2. Puntos de control para no revalidarlo todo al cargar.** Aun con P1, cargar es lineal en la historia entera. Guardar con el eje los saldos, las series, los tipos, las claves y los índices de un prefijo, con la huella de ese prefijo, y validar al cargar solo lo posterior. Rompe la regla de `Eje.desde` «nada se da por bueno»: **[X] decidir VG** si un punto de control puede sustituir a la revalidación y quién lo firma (AARPIA).

**P3. Almacenamiento del navegador.** `guardarLocal` (`src/persistencia.js:26`) mete el eje entero en `localStorage`, que suele dar 5 MB: con ≈600 bytes por registro deja de caber hacia los 8.000 registros (11,6 MB con 20.000). Cuando `setItem` falla, devuelve `false` y la interfaz avisa (`app.js`: «sin almacenamiento: nada se guarda al recargar»), pero el aviso confunde (es cuota llena, no falta de almacenamiento) y calla lo que pasa de verdad: en `localStorage` sigue la copia anterior, más corta. Al recargar, `cargarLocal` la restaura sin error y la interfaz dice «cargado del navegador · N registros»: los registros escritos después se han perdido y nada lo dice. Propuesta: IndexedDB (cuotas de cientos de MB) o trozos; y, mientras tanto, si no cabe, borrar la copia vieja o marcarla como incompleta, y que el aviso diga que este eje no cabe y no se guardará. **[X] decidir VG** si el eje del navegador ha de crecer más allá de una demostración (no se toca el frontend en esta PR).

**P4. Ocupantes ligeros para medir.** `posicionesDe` (`src/tiempo.js:205`) pide los ocupantes completos de las diez posiciones de cada registro (vector, signo, empates, justificación en texto…) solo para saber si hay alguno y de qué procedencia. En el perfil de confluir «general» con 5.000 registros, `conEncaje`, `ocupantes`, `caminosDe`, `marcarEmpates` y `justificar` suman más del 30 %. Una lectura ligera (tipo y camino, sin encaje) da la misma procedencia: se espera ×2–3 en `medidasDe` y en todo lo que recalcula (confluir, calcularBase, situar del foco). No es un índice: por eso no va en esta PR.

**P5. BUSCAR por encima del límite, sin construirlo todo.** Con más de `LIMITES.candidatos` (1.000) ocupantes, `buscar` (`src/bql.js:400`) construye primero todos (vectores, empates, justificaciones) y después para con PENDIENTE POR LÍMITE. Contar antes (caminos del payload y escritos de la dirección, que el índice de §8 ya da) y parar sin construir; el `parcial { examinados, de }` sale igual.

**P6. Una sola copia y un solo hash por escritura.** `eje.escribir` normaliza y hashea en `crearEvento`; `anadir` vuelve a copiar (`copiaGuardable`, `src/eje.js:256`) y `validar` copia otra vez (`normalizarEvento`, l.178) y vuelve a hashear (`verificarId`, l.186). Pasar a `validar` la copia ya normalizada (interno) y recordar el id verificado de la copia congelada ahorra dos copias JSON y un SHA-256 por evento: ≈0,2–0,3 ms de ≈2 ms.

**P7. Las paradas de BQL sin pila.** `Parada extends Error` (`src/bql.js:63`): cada PENDIENTE, INCOMPATIBLE o ERROR de una fórmula captura la pila de JavaScript, y son control de flujo (un 3 % de confluir). Una parada que no la capture no cambia ningún resultado; solo deja de haber `e.stack`.

**P8. Índices que el banco no ejerce todavía.** (a) `registrosEn` (`src/motor.js:325`) recorre `eje.orden` entero y cada payload buscando quién referencia una posición: lineal en el eje por cada `ocupacion`. Un índice inverso de referencias (destino → quién lo referencia, en orden de llegada), mantenido al añadir, lo haría proporcional a lo que referencia. (b) `#porSerie` (`src/eje.js:126`) recorre todas las claves de saldo de la identidad para sacar una familia; `poderSobre` lo llama en cada `estadoDe`, y una identidad con muchas series (la casa de Booking: una por plaza y noche) lo paga en cada consulta. Un índice por familia. Las dos son índices sin cambio de semántica, pero no se implementan sin una medida que las pida: el banco no genera capacidades ni series de plazas (§9).

## 8. Implementado en esta PR

Cuatro índices (o recuerdos) triviales. Ninguno cambia lo que se devuelve; cada uno tiene su prueba en `test/rendimiento.test.js`, que lo compara con la forma directa de antes.

1. **Empates en lineal** (`marcarEmpates`, `src/encaje.js`). Antes: por cada ocupante, comparar con todos los demás (n² comparaciones; 1.066 ocupantes en una posición son 1,1 millones). Ahora: cada ocupante lleva la clave de lo que mira el comparador (el acuerdo y, en cada profundidad que la época declare ordinal, la distancia) y se cuentan las claves iguales. Empatan si y solo si sus claves son iguales; una distancia que no es un número finito no empata con nada, igual que en la comparación; un mismo objeto repetido no empata consigo mismo. Prueba: 600 listas al azar de hasta 40 ocupantes (con duplicados, NaN e Infinity, con y sin ordinales) dan exactamente lo mismo que la comparación por pares; y 20.000 ocupantes en una posición se marcan en unas décimas de segundo (por pares serían 400 millones de comparaciones; la prueba admite hasta dos segundos).
2. **`sobre(id, en)` por dirección** (`src/eje.js`). Antes filtraba todos los hijos del registro en cada llamada; ahora el eje guarda, además de los hijos de cada registro, los mismos partidos por `en`, en orden de entrada, y devuelve una copia. Lo usan `ocupantes`, `mapa`, el motor (`estadoDe`, `consolidaciones`) y BUSCAR. Prueba: 400 escritos al azar, y para cada registro y cada dirección (más algunas que no existen y valores que no son direcciones) da lo mismo que filtrar; la copia no toca el índice; restaurar lo reconstruye.
3. **`eje.conPrefijo(p)`** (`src/eje.js`; lo usan `REF("…")` en `src/bql.js`, «@id» en `src/escritura.js` y los REF de las fórmulas que Scened lee para sus aristas: `resolverPrefijo` en `src/scened.js`, llegado con la #55). Antes, cada referencia por prefijo recorría `eje.orden` entero. Ahora, los ids agrupados por sus cuatro primeros caracteres (16⁴ grupos): un prefijo de cuatro o más mira solo su grupo, en orden de entrada; uno más corto recorre como antes. Si el eje que reciben no tiene el método, recorren `eje.orden` como antes. Prueba: prefijos de todos los largos, existentes o no, dan lo mismo que filtrar; REF resuelve, se declara ambigua o PENDIENTE exactamente igual; «@id», igual; y la escena de Scened (con un REF de cada prefijo, con y sin @ y en mayúsculas) es la misma con el índice que sin él.
4. **Cada clave pública se importa una vez** (`verificar`, `src/autoridad.js`). Importar la JWK costaba casi lo mismo que verificar la firma, y el eje verifica muchas veces con la misma clave: la que guarda congelada desde el alta. Se recuerda la clave importada por el objeto JWK, **solo si está congelado**. `Object.isFrozen` mira solo el primer nivel: el material de la clave (`kty`, `crv`, `x`, `y`) está en ese nivel y no cambia; un `key_ops` de dentro sí podría, y solo decide si se puede importar para verificar. El eje congela entera la copia que guarda, así que con sus claves el resultado es el mismo que importar cada vez; una importación fallida no se recuerda. Prueba: con una JWK congelada, la misma respuesta cada vez (firma propia, ajena, cambiada; JWK que no se importa); con una JWK que se puede cambiar, si cambia, verifica con la nueva; y el eje rechaza una firma de otra clave.

## 9. Lo que el banco no mide

- **El navegador**: el banco corre en Node. Web Crypto del navegador tiene otros costes (en general, sin grupo de hilos que esperar, pero sin `node:crypto` como alternativa). El frontend no se toca ni se mide.
- **La capacidad y las series de plazas** (`motor.ocupacion`, `registrosEn`, `#porSerie` con muchas series): el generador no declara capacidades ni emite series por plaza y noche (P8).
- **Épocas con profundidades ordinales**: todo se mide con la época 0 (sin ordinales). Con ordinales, la clave de empate de §8 es más larga, pero sigue siendo lineal.
- **Memoria fina**: `heapUsed` tras construir, sin forzar la recogida de basura (11 MB con 1.000 registros, 18 MB con 5.000, 39 MB con 20.000 en `main`).
- **Lo que llegó con la #55** (Scened, capas de validez, efectos, la fábrica 10×10×10, el mundo de los hilos), salvo las bases (§5): el banco no lo ejerce todavía. Scened usa ya el índice de prefijos (§8.3), probado, pero sin medir su escena.
- **Lo que sigue en PR sin fusionar**: BASES en BQL (#52), que trae otra `src/bases.js` con otra API; si sustituye a la de la #44, la sección de bases del banco se ha de adaptar (hoy la salta sin fallar).
- **Varias pasadas por tamaño**: cada número es una pasada; en una máquina compartida conviene repetir y mirar el orden de magnitud.
