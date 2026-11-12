# StateArk simulado (sello de tiempo, §3)

**Esto es una SIMULACIÓN.** No toca Bitcoin ni OpenTimestamps: la cadena es de mentira (sin prueba de trabajo, sin red). Se **sustituirá por StateArk real** con la misma forma (`sellar`, `prueba`, `verificar`); quien lo usa (`src/sello.js`) no cambia.

- **Origen:** copia, sin cambios, de `src/` del paquete `stateark-sim` de Core StateArk (`C:\Users\acer\Documents\InTheState\stateark\sim`, git local), **commit b65c93d** («stateark-sim §3: sello de tiempo simulado para X.6.8.2»). Solo el §3; lo que Core StateArk haya añadido después (recibos de pago, etc.) no está aquí. Las pruebas originales (22) están en `test/sim-stateark.test.js` con las rutas adaptadas.
- **Qué hace:** `sellar(ids)` mete un lote de ids (árbol de Merkle) en espera; `minar()` (solo en la simulación) lo mete en un bloque; `prueba(id)` da `{ altura, hash, instante, lote, prueba }` o `{ pendiente: true, lote }` o `null`; `verificar(evento|id, prueba)` no se fía de la prueba y la recalcula. El `instante` del bloque es una cota superior (el lote existía como muy tarde entonces).
- **Servicio HTTP** (`node servidor/sim/stateark/servidor.js [puerto] [minarCada_ms]`): `POST /sellar`, `GET /prueba/:id` (202 si pendiente), `POST /verificar`, `POST /minar`.
- **No editar aquí.** Si algo hay que cambiar, se pide a Core StateArk y se vuelve a copiar.
