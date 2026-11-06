# AGRAM

Núcleo genérico de AGRAM: una base de datos de eventos que se mueve sobre una estructura de tokens, con payloads BTML y vistas por puntos de vista.

- **BTML** es la estructura de datos: payloads terminales o arrays posicionales de hasta diez posiciones, direcciones de diez dígitos.
- **BQL** es la lógica de vistas: cómo se mueven y se consultan los datos (pendiente).
- **AGRAM** es el motor: la ejecución real (pendiente).

Estado: cartón piedra del **eje** (génesis, identidades, transiciones de tokens encadenadas por referencia), **Pointed** (una décupla) y **Sequenced** (diez décuplas en hilera: hilo o hijos del foco). Capacidad y proporción de escritura por modo en `src/modos.js`. Ver `docs/FUNDAMENTOS.md`.

```sh
node ejemplos/ikisai/correr.mjs
```

Las apps de Ikisai aparecen solo como ejemplo transversal en `ejemplos/ikisai`, con datos inventados. Este repositorio es público: nada real, ningún secreto.

```sh
npm test
```

JavaScript puro, sin dependencias, ejecutable en Node y en el navegador. El frontend de cartón piedra es `index.html` + `app.js` (Pointed y Sequenced sobre el eje de ejemplo); se publica en GitHub Pages en cada push a `main`.
