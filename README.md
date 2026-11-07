# AGRAM

Núcleo genérico de AGRAM: una base de datos de eventos que se mueve sobre una estructura de tokens, con payloads BTML y vistas por puntos de vista.

- **BTML** es la estructura de datos: payloads terminales o arrays posicionales de hasta diez posiciones, direcciones de diez dígitos.
- **BQL** es la lógica de vistas: cómo se mueven y se consultan los datos. V0: fórmulas en un slot con `=`, `LOCAL`, `REF`, magnitudes con desglose y composición heterogénea, estados RESUELTO/PENDIENTE/INCOMPATIBLE/ERROR, evaluación sin efectos (`src/bql.js`).
- **AGRAM** es el motor: la ejecución real (pendiente).

Estado: cartón piedra completo del ciclo. Eje (génesis, identidades, transiciones de tokens encadenadas por referencia, posición `en`), encaje (ocupantes por posición, árbol lógico), BQL V0 con colecciones, motor (descubrir, consolidar en la fábrica, autorizar con poder, ejecutar con evidencia), autoridad mínima (claves y firmas por identidad), eje temporal (6/7), comparabilidad relativa y confluencia del 8 (bases por medida y por posición entre comparables accesibles, sin nivel ni grado), persistencia local, y los tres modos leyendo y escribiendo con su proporción. Ver `docs/FUNDAMENTOS.md`.

```sh
node ejemplos/ikisai/correr.mjs
```

Las apps de Ikisai aparecen solo como ejemplo transversal en `ejemplos/ikisai`, con datos inventados. Este repositorio es público: nada real, ningún secreto.

```sh
npm test
```

JavaScript puro, sin dependencias, ejecutable en Node y en el navegador. El frontend de cartón piedra es `index.html` + `app.js` (Pointed y Sequenced sobre el eje de ejemplo); se publica en GitHub Pages en cada push a `main`: https://ikisai-apps.github.io/agram/ (dominio `agram.ikisai.com` pendiente del CNAME en DNS).
