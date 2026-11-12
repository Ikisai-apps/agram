# Enganchar el libro compartido en la carta (para una PR posterior)

> **Hecho** (rama `carta-sincronia`): la carta ya sincroniza; lo vigente está en `docs/CONTRATO.md` §15.8, `carta/sincronia.js` y `test/carta-sincronia.test.js`. Este documento queda como **registro histórico** de la especificación que se siguió; lo que se decidió además de lo que dice está en §15.7 y §15.8 del contrato (las preferencias sin defecto en el formulario, el registro que acaba en el primer hueco, la clave de lectura dentro de lo cifrado de la copia, restaurar bajando el eje del servidor).

Etapa 3 del roadmap (`docs/CONTRATO.md` §15; `servidor/LEEME.md`). La PR del libro compartido no toca `carta/` porque la etapa 2 (mi cuenta, #103: `carta/app.js`, `carta/cuentas.js`, la pantalla de arranque) entró a la vez. Esto dice **dónde llamar a qué**; los nombres de `carta/app.js` son los de `main` `93e86a3` (`estado`, `guardar()`, `arrancar()`, `manejadores.seguir`, `firmarCon`) y las claves de almacén las de `carta/cuentas.js`: lo que importa es el momento, no la línea.

## 1. Qué hay en el núcleo

```js
import { sincronia, contrato } from '../src/index.js';
const S = new sincronia.Sincronia({ url, eje, claveLectura, fetch: globalThis.fetch.bind(globalThis) });
const informe = await S.sincronizar(estado.eje);   // baja, valida, reordena si hace falta, sube lo pendiente; nunca lanza por la red
S.serializar() / sincronia.Sincronia.restaurar(datos, { claveLectura })
S.cola · S.rechazados · S.pendientes(eje) · S.marcarReloj(eje)
```

`informe`: `{ eje, bajados, anadidos, rechazados: [{ id, motivo, de }], subidos, pendientes, reordenado, sinRed, errores }`.

## 2. La configuración: `sync url` y `sync ledger`; la clave de lectura aparte

- La plantilla «preferences» (`epoch.9.3`) tiene dos ajustes nuevos (desde VG 13-11, #77, claves de un registro de claves y valores, sin huecos), **`sync url`** (la base del servidor: `https://<ref>.supabase.co/functions/v1`, o `http://127.0.0.1:8787` con el servidor de prueba) y **`sync ledger`** (el nombre del eje en el servidor). Se leen con `contrato.configuracion(eje, yo)['sync url']` y `['sync ledger']`; sin valor, `undefined`: el eje vive solo en este dispositivo. Sus etiquetas y ayudas en español ya están en `epoch.9.4` («servidor», «eje compartido»): el formulario de preferencias de la carta las pinta solo, como las demás posiciones (el 5 sigue siendo el tipo y no se pinta).
- **La clave de lectura NO va en el registro de preferencias** (el registro entra en el eje y el eje se comparte: cualquiera que lea el eje la vería). Vive en `localStorage`, **por cuenta**, junto a lo que `carta/cuentas.js` ya guarda por cuenta (`agram.eje.<id del alta>` el eje, `agram.clave.<id del alta>` la clave privada, `agram.cuenta` la última usada): la clave de lectura en **`agram.sync.<id del alta>`**. La pantalla de preferencias pinta un campo aparte «clave de lectura» que escribe y lee ese `localStorage`, nunca el eje. Lo mismo que hace la copia de seguridad cifrada de la etapa 2 con la clave privada vale para esta: forma parte de lo que se exporta cifrado con frase.
- El estado de la sincronía (`S.serializar()`: la cola, los órdenes del servidor, lo rechazado; sin la clave) se guarda **junto al eje**, por cuenta: `agram.sync.estado.<id del alta>` con `guardarLocal`, en la misma función `guardar()` que guarda el eje y el libro local (el estado no es secreto; la clave de `agram.sync.<id del alta>` sí: se tratan aparte).

## 3. Dónde llamar a qué

1. **Al arrancar** (`arrancar()`, después de restaurar el eje y la cuenta, antes de `pintar()`): si la configuración tiene `sync url` y `sync ledger` y hay clave de lectura en `localStorage`, `estado.sincronia = Sincronia.restaurar(datos guardados, { claveLectura })` o `new Sincronia(...)` si no había nada guardado; `estado.sincronia.marcarReloj(estado.eje)`; y lanzar `sincronizar()` (abajo) sin esperar (`void`), para que la carta pinte ya con lo local.
2. **Sin eje local todavía** (un dispositivo nuevo con la cuenta restaurada de la copia de seguridad, o con la clave de lectura pegada a mano): `const { eje } = await S.sincronizar(null)` crea el eje desde el génesis del servidor; si `eje` es `null` o hay `errores`, la carta lo dice y arranca con el eje de ejemplo como hoy.
3. **Después de cada escritura** (`manejadores.seguir` tras `acciones.autoejecutar`, y cualquier otro sitio donde se llame a `eje.escribir`/`eje.anadir`, como `englobar` del libro local): `guardar()` y, si hay `estado.sincronia`, `sincronizar()` sin esperar. No hace falta encolar a mano: lo pendiente es lo que el eje tiene y el servidor no.
4. **Al volver la red** (`window.addEventListener('online', …)`) y **cada 30 s** mientras la pestaña está visible (`document.visibilityState === 'visible'`): `sincronizar()`. Con la espera creciente de la cola basta con eso: la cola decide si toca reintentar.
5. **`sincronizar()` en la carta** es una función que serializa las llamadas (una a la vez: si llega otra mientras corre, se marca y se repite al acabar), y al terminar:
   - si `informe.reordenado` o `informe.anadidos.length`: `guardar()` y `pintar()` (el eje cambió; el foco por id sigue valiendo, los índices se reconstruyeron dentro del mismo objeto `estado.eje`);
   - guarda `S.serializar()`;
   - enseña el estado (§4).
6. **Cambiar de cuenta** (`carta/cuentas.js`): cada cuenta tiene su eje, su libro local y su sincronía; al cambiar, se cierra la de antes (nada que cerrar: es un objeto) y se abre la de la nueva como en el paso 1.
7. **Reiniciar** (`reiniciar()`) y borrar una cuenta: borrar también `agram.sync.estado.<id del alta>`; la clave de lectura (`agram.sync.<id del alta>`) solo si se borra la cuenta entera.

## 4. Qué enseñar

En la línea de estado donde hoy va «guardado en el navegador (n registros)»:

- `pendientes.length` > 0: «n por subir» (y, si `sinRed`, «sin red: se subirá al volver»);
- `rechazados.length` > 0: «n registros no entraron» con un desplegable que lista `id.slice(0, 8)` y `motivo`; `de: 'reglas'` es un registro ajeno que las reglas no admiten aquí, `de: 'reorden'` uno local que dejó de valer al llegar antes otro, `de: 'servidor'` uno local que el servidor no acepta (el motivo lleva el estado HTTP);
- `errores.length` > 0: el texto tal cual (un 401 es la clave de lectura; «el eje del servidor no es este» es que `sync ledger` apunta a otro eje);
- `reordenado`: aviso breve «el orden cambió al sincronizar».

Nada de esto bloquea: la carta sigue escribiendo en local y la cola se encarga.

## 5. Lo que no hace la carta

No crea ejes en el servidor (`POST /ejes` exige la clave de servicio o `AGRAM_CREAR_EJES`: lo hace Core o VG a mano, `servidor/LEEME.md`), no guarda la clave de lectura en el eje, no firma nada que no firme ya (`firmarCon`): la sincronía sube los eventos tal como el eje los guarda.
