# Arte de prueba 03

Procedencia: prueba 03 de la IA de imagen de VG, nivel «intermedio», siguiendo la guía de arte v3b. Son piezas de prueba para el reproductor (`pruebas/carta/`), no arte definitivo.

Licencia: pendiente de decidir VG.

## Contenido

- `ciudad/elemento/`: tres SVG de 512×512 (`tienda-centro-intermedio.svg`, `tienda-izquierda-intermedio.svg`, `tienda-derecha-intermedio.svg`), las tres orientaciones de la tienda.
- `ciudad/munequito/vendedor-esperar-intermedio.json`: Lottie de 512×512, 24 fps, 48 fotogramas (2 s), bucle de «esperar» del vendedor.

## Izquierda y derecha son piezas distintas

En AGRAM las piezas izquierda y derecha son siempre archivos distintos: la izquierda es el lado del PV1 y la derecha el del PV2, y cambian por separado. El espejo (`scaleX(-1)`) es solo un atajo de producción del generador de imágenes; el código nunca debe usarlo como pieza. La página de prueba muestra una fila «solo para comparar» con la izquierda espejada frente a la derecha real.

## Revisión al incorporarlas

- El Lottie no contiene expresiones (ninguna clave `"x"` con cadena de código), ni `assets` (ni capas de imagen externas), ni direcciones `http`.
- Los SVG no contienen `<script>`, atributos `on*=`, `<image>`, `<foreignObject>` ni referencias externas (`href`, `url(http…)`).
