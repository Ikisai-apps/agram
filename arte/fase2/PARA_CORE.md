# AGRAM - Entrega completa de fase 2

Contrato aplicado: paquete 2.2 y ACEPTACION-00.md. Esta es la entrega unica de los bloques 0 a 6 solicitada por Core y VG.

## Resultado

626 recursos individuales: **503 SVG y 123 Lottie**, con 626 miniaturas PNG RGBA 256x256. Todos tienen entrada, ruta y SHA-256. No hay piezas pendientes.

| Bloque | Recursos | Contenido |
|---|---:|---|
| 0 | 128 | Biblioteca aceptada: 127 heredadas + transferir; indice con las dos cuentas corregidas |
| 1 | 76 | Sellos de elementos, tiendas, lentes, etapas, aro y acciones |
| 2 | 100 | Los 20 personajes: esperar en 3 orientaciones, actuar y celebrar de frente |
| 3 | 260 | Etapas faltantes y orientaciones de la X; nuevas etapas 10 intermedio; cruz frontal |
| 4 | 7 | Nuevos efectos sin caja; el octavo, transferir, esta en bloque 0 |
| 5 | 34 | 18 marcos transparentes y 16 fondos opacos |
| 6 | 21 | Ciudad ilustrada: 7 elementos, 10 etapas y 4 personajes esperar |

Las cantidades que difieren de la tabla no indican falta de cobertura:

- Bloque 1: las 30 piezas de elementos originales ya incluyen las 2 lentes. Se han hecho los sellos de esas 30 y tambien de las 3 tiendas aprobadas: 33 elementos + 32 etapas + 11 iconos = 76 SVG, sin duplicar las lentes.
- Bloque 3: las cuatro etapas 10 sello de la X ya se producen con su alcance final en bloque 1. Se reutilizan; no se duplican claves. Las cuatro etapas 10 intermedio se redibujan en bloque 3. Todas las etapas 1-10, orientaciones y niveles exigidos estan cubiertos.
- Bloque 4: transferir es exactamente el Lottie aceptado del bloque 0. Hay ocho efectos primarios en el conjunto. Los ocho movimientos heredados con caja siguen como respaldo.

## Que abrir primero

1. `catalogo-completo.pdf`: 55 paginas. Incluye las progresiones completas de los ocho mundos y todas las miniaturas por bloque. Cada bloque conserva tambien su `catalogo.pdf`.
2. `visor-local.html`: visor autocontenido de los 626 recursos, con filtro por bloque y busqueda, dos fondos, reproduccion, fotogramas por pasos y pieza de muestra opcional. No hace llamadas de red.
3. `validacion.json` y `auditoria-final.json`: comprobaciones automaticas y visuales adicionales.
4. `DUDAS.md`: decisiones tomadas sin consultas intermedias, tal como autoriza el contrato 2.2.

## Validacion

Desde la raiz descomprimida:

```text
python -I validar.py . --bloque todos --json validacion.json
```

Resultado: **0 errores, cobertura completa, 0 pendientes**. Los 11 avisos son los Lottie de 48 fotogramas heredados y autorizados. Se adjunta el validador 2.2 recibido, sin cambios. Su hash se comprueba frente al contrato.

Tambien se han ejecutado `--bloque 0` a `--bloque 6` sobre la raiz completa; los resultados estan en `bloque-N/validacion.json`. La cobertura es acumulativa, contando lo que se conserva o reutiliza de bloques anteriores. No ejecutar el bloque 3 aislado esperando que repita los centros de etapa conservados en bloques 0 y 1.

## Pruebas locales adicionales

- Las 111 animaciones nuevas de bloques 2, 4 y 6 cargan en lottie-web 5.13.0 / Microsoft Edge (Chromium), sin errores JavaScript. Se han inspeccionado once muestras por animacion, ademas de las miniaturas centrales.
- Los 84 bucles nuevos (80 en bloque 2 y 4 en bloque 6) tienen fotogramas 0 y 49 identicos en PNG, para evitar saltos al volver al inicio.
- Todas las miniaturas son RGBA 256; los 18 marcos tienen centro transparente y los 16 fondos tienen alfa 255 en toda la superficie.
- Comprobacion de recortes no intencionados en todas las miniaturas nuevas; los efectos que entran desde un borde son intencionados.
- Los SVG se han parseado como XML y no contienen imagenes, texto, script ni foreignObject. Todos usan viewBox 512.
- El visor final se ha abierto y probado con filtros, reproduccion y pasos; sin peticiones HTTP.
- Todas las 55 paginas del PDF se han renderizado con Poppler y revisado visualmente.

El bloque 0 conserva su aceptacion previa por Core. Las dos cuentas tienen ya `mundos: [6,7]`, sin pendiente: ciclo principal PV6; rara principal PV7. El vendedor esperar antiguo y las etapas 10 heredadas de la X quedan como respaldo de sus sustitutos.

## Revision final que corresponde a Core

Importar los indices al modelo de visualizacion real y probar la seleccion por PV, rol, etapa, orientacion y nivel. Verificar los Lottie en la version de reproductor de AGRAM (Core uso 5.12.2 en bloque 0). La prueba local no sustituye esta integracion, que no se ha realizado desde este entorno.

Las orientaciones de personajes mantienen manos, herramientas y relojes sin espejar: se usa compresion frontal y ajuste facial. Las etapas laterales usan una proyeccion oblicua leve conservando el soporte horizontal. Las siluetas sello llevan un contorno claro exterior fino para sostenerse sobre fondos claros y oscuros.

Si hay correcciones, devolver una sola lista `CORRECCIONES-fase2.md`, con ruta completa incluyendo bloque, motivo y comportamiento o aspecto esperado. No hace falta nuevo encargo general.

## Fuentes y conservacion

Los recursos originales y los ZIP de entrada se conservan en el workspace. Las fuentes de produccion se incluyen en `fuentes-produccion/`; son herramientas de construccion, no codigo de la aplicacion. Requieren los paquetes de entrada y el layout de trabajo documentado en su LEEME. No se ha modificado codigo, repositorios ni servidores de AGRAM.
