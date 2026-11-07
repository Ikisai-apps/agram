# AGRAM

Núcleo genérico de AGRAM: una base de datos de eventos que se mueve sobre una estructura de tokens, con payloads BTML y vistas por puntos de vista.

- **BTML** es la estructura de datos: payloads terminales o arrays posicionales de hasta diez posiciones, direcciones de diez dígitos.
- **BQL** es la lógica de vistas: cómo se mueven y se consultan los datos. V0 según el corpus: fórmulas en un slot con `=`, `LOCAL`, `REF`, `BUSCAR` por índice (camino exacto) y por dirección (la colisión entera), magnitudes con desglose y composición heterogénea, estados RESUELTO/PENDIENTE (con PENDIENTE DE AUTORIZACIÓN y PENDIENTE POR LÍMITE)/INCOMPATIBLE/ERROR, evaluación sin efectos (`src/bql.js`).
- **AGRAM** es el motor: la ejecución real (pendiente).

Estado: cartón piedra completo del ciclo. Eje (génesis, identidades, transiciones de tokens encadenadas por referencia, posición `en`), encaje (ocupantes por posición, árbol lógico), BQL V0 con colecciones, motor (descubrir, consolidar en la fábrica, autorizar con poder, ejecutar con evidencia), autoridad mínima (claves y firmas por identidad), eje temporal (6/7), comparabilidad relativa y confluencia del 8 (bases fundibles por medida, por serie de token y por posición con procedencia, en tres cohortes, sin nivel ni grado), persistencia local, épocas en datos (la época 0 y la «época 1 (propuesta)», pendiente de VG: `docs/REGLAS_CORTAS.md`), y los tres modos leyendo y escribiendo con su proporción. Ver `docs/FUNDAMENTOS.md`.

```sh
node ejemplos/ikisai/correr.mjs
```

Las apps de Ikisai aparecen solo como ejemplo transversal en `ejemplos/ikisai`, con datos inventados: una compra de comida (`compra-food.mjs`), una reserva de alojamiento (`reserva-booking.mjs`: las reservas colisionan en la plaza, y la casa emite una serie de tokens, uno por plaza y noche, que la ejecución entrega a quien reserva; sin token, no se ejecuta) y una tarea de Tasks (`tarea-tasks.mjs`: presupuestos que colisionan en recursos, una fórmula que se queda con el primero que cabe, partidas respaldadas por series de tokens y el ciclo del motor hasta la entrega y el pago), tres dominios sobre el mismo núcleo, cada uno con sus pruebas (`test/ejemplo-*.test.js`). Este repositorio es público: nada real, ningún secreto.

```sh
npm test
```

JavaScript puro, sin dependencias, ejecutable en Node y en el navegador. El frontend de cartón piedra es `index.html` + `app.js` (Pointed y Sequenced sobre el eje de ejemplo); se publica en GitHub Pages en cada push a `main`: https://ikisai-apps.github.io/agram/ (dominio `agram.ikisai.com` pendiente del CNAME en DNS).

Render animado (`mundos/`): la cruz entera sobre el mismo eje que el sobrio, hilos del 6 y 7, cielo del 8 (las bases como constelaciones) y camino del 9 (los pasos hacia la acción, con previsualizar sin escribir), con el 5 en el centro. Ver `docs/MUNDOS.md`.
