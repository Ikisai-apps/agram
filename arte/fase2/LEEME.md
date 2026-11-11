# Arte de la fase 2

Procedencia: fase 2 de la IA de imagen de VG (entrega única de los bloques 0 a 6, contrato 2.2 del encargo `MUELA/equipo/agram/encargo-fase2/`), aceptada por Core y VG el 9-11-2026. Los documentos de la entrega están al lado: `PARA_CORE.md` (alcance, pruebas y revisión) y `DUDAS.md` (las decisiones de producción).

Licencia: pendiente de decidir VG.

## Contenido

De cada bloque entran en el repositorio **solo** `biblioteca/` (los archivos: 503 SVG y 123 Lottie, 5,1 MB) e `indice.json` (una entrada por pieza, el formato del documento 03 del encargo). Las miniaturas, los catálogos PDF, el visor local y el validador de la entrega se quedan fuera (no los usa la aplicación).

| Bloque | Piezas | Qué |
|---|---:|---|
| `bloque-0` | 128 | la biblioteca heredada de la fase 1 (`heredado: true`) y el `transferir` nuevo; las etapas 10 y el `vendedor-esperar` antiguos quedan con `respaldo: true` |
| `bloque-1` | 76 | el nivel `sello`: elementos, etapas 1/3/5/10, iconos y huecos del aro, lentes |
| `bloque-2` | 100 | los 20 personajes: `esperar` en tres orientaciones, `actuar` y `celebrar` de frente (Lottie, 50 fotogramas, 24 fps) |
| `bloque-3` | 260 | las etapas 1-10 de los ocho mundos en `intermedio` y `sello` (la X en tres orientaciones, la cruz solo centro) |
| `bloque-4` | 7 | los efectos sin caja (`crear-*`, `bloquear`, `liberar`, `quemar`); `transferir` está en el bloque 0 |
| `bloque-5` | 34 | 18 marcos (uno por mundo y el neutro) y 16 fondos opacos (etapas 5 y 10) |
| `bloque-6` | 21 | el nivel `ilustrado` de la ciudad: 7 elementos, 10 etapas y 4 `esperar` |

## Cómo entra en la aplicación

`node arte/importar.mjs arte/fase2/bloque-0 … arte/fase2/bloque-6 --nombre general --escribir` lee los siete índices y genera **un** modelo de visualización (`datos/epocas/modelos/general.json` y `general/`: el arte general de la época, #25), sin copiar ningún archivo: las piezas referencian estas rutas. Después, `npm run epocas`. Lo que el importador hace con cada campo del índice (`tipo`, `nombre`, `nivel`/`tamano`, `pv: "comun"`, `mundos`, `heredado`, `respaldo`) está en `arte/MANIFIESTO.md` §3 y §4.

## Seguridad

Antes de copiarlos, Core repitió sobre los 626 archivos su propia comprobación (aparte del validador de la entrega): SVG sin `<script>`, atributos `on*=`, `<image>`, `<foreignObject>`, `<a>`, `<use>` externo, `href`/`url()` externos, entidades ni SMIL; Lottie sin expresiones (ninguna clave `"x"` con cadena), sin `assets` de imagen, sin fuentes ni cadenas `http`/`data`; cada ruta del índice existe, su `sha256` coincide y no hay archivos sin entrada. Resultado: 0 errores. Los SVG se pintan siempre como `<img>` y los Lottie con lottie-web en `svg`.
