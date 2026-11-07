# AGRAM

Núcleo genérico de AGRAM: una base de datos de eventos que se mueve sobre una estructura de tokens, con payloads BTML y vistas por puntos de vista.

- **BTML** es la estructura de datos: payloads terminales o arrays posicionales de hasta diez posiciones, direcciones de diez dígitos.
- **BQL** es la lógica de vistas: cómo se mueven y se consultan los datos. V0 según el corpus: fórmulas en un slot con `=`, `LOCAL`, `REF`, `BUSCAR` por índice (camino exacto) y por dirección (la colisión entera), magnitudes con desglose y composición heterogénea, estados RESUELTO/PENDIENTE (con PENDIENTE DE AUTORIZACIÓN y PENDIENTE POR LÍMITE)/INCOMPATIBLE/ERROR, evaluación sin efectos (`src/bql.js`).
- **AGRAM** es el motor: la ejecución real (pendiente).

Estado: cartón piedra completo del ciclo. Eje (génesis, identidades, transiciones de tokens encadenadas por referencia, posición `en`), encaje (ocupantes por posición, árbol lógico), BQL V0 con colecciones, motor (descubrir, consolidar en la fábrica, autorizar con poder, ejecutar con evidencia), autoridad mínima (claves y firmas por identidad), eje temporal (6/7), comparabilidad relativa y confluencia del 8 (bases fundibles por medida, por serie de token y por posición con procedencia, en tres cohortes, sin nivel ni grado), persistencia local, épocas en datos (la época 0 y la «época 1 (propuesta)», pendiente de VG: `docs/REGLAS_CORTAS.md`), y los tres modos leyendo y escribiendo con su proporción. Además: la fábrica con la matriz 10×10×10 relativa al camino y topes duros de emisión por modo (`src/escritura.js`, `src/modos.js`), las bases del 8 escritas como registros en la posición 8 (`src/bases.js`, `BASES()` en BQL), el catálogo de efectos (`src/efectos.js`, `docs/EFECTOS.md`), las cinco capas de validez como estados independientes (`src/validez.js`, `docs/VALIDEZ.md`), Scened mínimo con varios focos en escena, con capacidad de lectura, no tope duro (`src/scened.js`, `docs/MODOS.md`) y el primer mundo animado, los hilos del 6 y 7 (`mundos/hilos.js`). Ver `docs/FUNDAMENTOS.md`.

```sh
node ejemplos/ikisai/correr.mjs
```

Las apps de Ikisai aparecen solo como ejemplo transversal en `ejemplos/ikisai`, con datos inventados: una compra de comida (`compra-food.mjs`), una reserva de alojamiento (`reserva-booking.mjs`: las reservas colisionan en la plaza, y la casa emite una serie de tokens, uno por plaza y noche, que la ejecución entrega a quien reserva; sin token, no se ejecuta) y una tarea de Tasks (`tarea-tasks.mjs`: presupuestos que colisionan en recursos, una fórmula que se queda con el primero que cabe, partidas respaldadas por series de tokens y el ciclo del motor hasta la entrega y el pago), tres dominios sobre el mismo núcleo, cada uno con sus pruebas (`test/ejemplo-*.test.js`). Este repositorio es público: nada real, ningún secreto.

```sh
npm test
```

El banco de rendimiento del núcleo (`bench/eje.mjs`, sin dependencias) construye ejes de 1.000, 5.000 y 20.000 registros con una semilla y mide escribir, validar, leer, BQL, confluir y guardar; los resultados comentados están en `docs/notas/RENDIMIENTO.md`:

```sh
npm run bench
npm run bench -- --tamanos 1000 --solo ocupantes,bql
```

JavaScript puro, sin dependencias, ejecutable en Node y en el navegador. El frontend de cartón piedra es `index.html` + `app.js` (Pointed, Sequenced y Mapped sobre el ejemplo elegido: comida, reserva o tarea; con «animado», las celdas 6 y 7 de Mapped dibujan los hilos y «ver los hilos» abre la vista completa debajo, en `mundos/hilos-ui.js`; en `ui/`, el encaje de cada ocupante, proponer, la época y los saldos por series); se publica en GitHub Pages en cada push a `main`: https://ikisai-apps.github.io/agram/ (dominio `agram.ikisai.com` pendiente del CNAME en DNS).
