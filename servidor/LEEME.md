# El libro compartido: el servidor

Etapa 3 del roadmap (`MUELA/equipo/agram/ROADMAP_MVP.md`; mapa §17 [D], VG): un único eje accesible desde el móvil y el ordenador. El servidor es mínimo y de **solo añadir**: guarda eventos firmados, los ordena por llegada y da la hora; **no valida reglas** (eso lo hace cada cliente con el núcleo, `src/sincronia.js`). El eje es **privado con clave de lectura**; se escribe solo con eventos **firmados por una identidad con alta en el eje** (firmas Schnorr BIP-340, `docs/notas/FIRMAS_BIP340.md`; sin compatibilidad con las P-256 de antes: un eje con eventos P-256 no se sube, se empieza uno nuevo).

**Nada está desplegado.** El proyecto Supabase de AGRAM aún no existe; lo que hay aquí es código listo para desplegar y probado contra el servidor de prueba local (`servidor/prueba/servidor.mjs`), que sirve el mismo contrato. El contrato entero: `docs/CONTRATO.md` §15.

```
servidor/
  supabase/
    migraciones/0001_eventos.sql     las tablas `ejes` y `eventos` (solo añadir, RLS, disparador contra UPDATE/DELETE)
    funciones/eventos/index.ts       la función de borde (Deno): el contrato sobre PostgREST, por fetch, sin dependencias
    funciones/eventos/api.js         el contrato como (Request) → Response; lo comparten la función y el servidor de prueba
    funciones/eventos/verificar.js   hash y firma (Schnorr BIP-340) reimplementados sin el núcleo (la paridad la comprueba test/paridad-funcion.test.js)
    funciones/eventos/noble-secp256k1.js  la librería de BIP-340: copia idéntica, byte a byte, de src/vendor/noble-secp256k1.js (src/vendor/LEEME.md)
    funciones/eventos/LEEME.md       cómo probar la función a mano
    funciones/guia/index.ts          la función de la guía del PV9 (Deno): contesta preguntas llamando a la API de Anthropic
    funciones/guia/api.js            su contrato como (Request) → Response; lo comparten la función y el servidor de prueba (autónoma: se despliega sola)
    funciones/archivos/index.ts      la función de los archivos adjuntos (Deno): el bucket privado agram-archivos por la API REST de Storage
    funciones/archivos/api.js        su contrato (subir, bajar, tipos, tope); lo comparten la función y el servidor de prueba (autónoma)
    migraciones/0002_archivos.sql    el bucket privado agram-archivos (2 MB, cinco tipos)
  prueba/
    servidor.mjs                     el mismo contrato en Node (node:http), en memoria o en un JSON; para pruebas y desarrollo
    cripto-nucleo.mjs                la comprobación del servidor hecha con src/evento.js y src/autoridad.js
```

## Desplegar en un proyecto Supabase nuevo

Lo hace VG, o Core con VG delante. Ningún valor de credenciales entra en este repositorio (es público).

1. **Crear el proyecto.** En la cuenta de Supabase de Ikisai (la misma de Ikisai Apps), un proyecto **aparte** para AGRAM (plan gratuito), para no tocar producción. Región: la de Ikisai Apps. Guardar la URL del proyecto, la clave anónima y la **clave de servicio** en `PROD/ikisai-apps/private/` (junto a `cloud-credentials.json`, por ejemplo como `agram-supabase.json`), **nunca en el repositorio**.
2. **Las tablas.** O bien con la CLI (`supabase link --project-ref <ref>` desde una carpeta con `supabase/migrations/` que contenga `0001_eventos.sql`, y `supabase db push`), o bien pegando `migraciones/0001_eventos.sql` tal cual en el editor SQL del panel. Es idempotente (`if not exists`, `drop trigger if exists`).
3. **La función.** `supabase functions deploy eventos --no-verify-jwt` desde una carpeta con `supabase/functions/eventos/` que contenga `index.ts`, `api.js`, `verificar.js` y `noble-secp256k1.js` (copiar los cuatro archivos de `servidor/supabase/funciones/eventos/`; el último es la librería de las firmas Schnorr BIP-340, `docs/notas/FIRMAS_BIP340.md`, y `verificar.js` la importa con una ruta relativa). `--no-verify-jwt` porque la función lleva su propia autorización (la clave de lectura del eje y las firmas de los eventos): así la carta no necesita la clave anónima. `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` las inyecta Supabase en toda función.
4. **Variables de entorno.** Opcional: `supabase secrets set AGRAM_CREAR_EJES=<un secreto largo al azar>` para crear ejes con la cabecera `X-Crear-Ejes` sin manejar la clave de servicio desde fuera. Sin ella, crear ejes solo vale con `Authorization: Bearer <clave de servicio>`. Guardar el secreto en la misma carpeta privada.
5. **CORS.** La función admite `https://agram.ikisai.com`, la beta (`https://beta.agram.ikisai.com`, `https://agram-beta.pages.dev`) y `http://localhost:*` (`ORIGENES` en `api.js`). Otro origen (una vista previa) se añade ahí y se vuelve a desplegar.

## Crear el primer eje y obtener su clave de lectura

```sh
curl -X POST https://<ref>.supabase.co/functions/v1/eventos/ejes \
  -H "X-Crear-Ejes: $AGRAM_CREAR_EJES" -H "Content-Type: application/json" \
  -d '{"eje":"vg"}'
# → 201 {"eje":"vg","claveLectura":"<43 caracteres base64url>","creado":"2026-…"}
```

La clave de lectura se devuelve **una sola vez**: el servidor guarda solo su hash SHA-256. Se guarda en `PROD/ikisai-apps/private/` y se da a cada dispositivo de VG (la carta la guarda en `localStorage` por cuenta, `agram.sync.<alta>`; `docs/CONTRATO.md` §15.8). Si se pierde, se crea otro eje y se vuelven a subir los eventos (son los mismos: el servidor es idempotente por id).

La URL que va en la configuración de la carta (`sync url`) es la base de la función: `https://<ref>.supabase.co/functions/v1`; el nombre del eje (`sync ledger`), `vg`. Las rutas cuelgan de ahí: `POST …/functions/v1/eventos`, `GET …/functions/v1/eventos?eje=vg&desde=0`, `POST …/functions/v1/eventos/ejes`.

## Configurar la carta tras desplegar

En el primer dispositivo, con la cuenta de VG abierta en la carta (`https://agram.ikisai.com`):

1. **configuración** (la barra): en **servidor** la base de la función, `https://<ref>.supabase.co/functions/v1`; en **eje compartido** el nombre del eje creado arriba (`vg`); en **clave de lectura** la que devolvió `POST …/eventos/ejes`. **guardar**. El servidor y el eje van en el registro de preferencias (en el eje, que se comparte; no son secretos); la clave de lectura, solo en este navegador (`agram.sync.<alta>`), nunca en el eje.
2. La línea de estado, bajo «guardado en este navegador», dice «al día con el eje compartido» cuando todo ha subido (o «n por subir», «sin red…», los errores tal cual: un 401 es la clave de lectura).
3. **copia de seguridad**: el archivo lleva ahora también la clave de lectura, cifrada con la frase.
4. En cada otro dispositivo: **restaurar una cuenta** con ese archivo y la frase. La carta baja el eje del servidor (`sincronizar(null)`) y repone la clave de lectura; desde ahí, los dos dispositivos se sincronizan solos (al escribir, al volver la red y cada 30 s).

Con el servidor de prueba es igual, con `http://127.0.0.1:8787` como servidor y la carta servida desde `http://localhost:<puerto>` o `http://127.0.0.1:<puerto>` (CORS).

## El servidor de prueba

```sh
node servidor/prueba/servidor.mjs --puerto 8787 --secreto prueba            # en memoria
node servidor/prueba/servidor.mjs --puerto 8787 --archivo /tmp/libro.json    # persiste en un JSON
```

El mismo contrato en `http://127.0.0.1:8787` (`POST /ejes` con `X-Crear-Ejes: prueba`, `POST /eventos`, `GET /eventos`), sin Supabase. Diferencias con la función de Deno: **ninguna de contrato**. Cambian el almacén (memoria o JSON en vez de PostgREST), la criptografía (el núcleo, en vez de `verificar.js`; `test/paridad-funcion.test.js` comprueba que deciden lo mismo), que `POST /ejes` se autoriza con `--secreto`/`AGRAM_CREAR_EJES` (no hay clave de servicio) y que, además de `/eventos/ejes`, responde en `/ejes`. Las pruebas lo arrancan en un puerto libre: `test/servidor-prueba.test.js` (el contrato), `test/sincronia.test.js` (el cliente).

## El transporte (simulación de AARPIA)

El segundo reloj de cada registro (`X.6.8.1`, el recibo de llegada que firma un relé de Nostr; `docs/CONTRATO.md` §4.4) lo pide `src/sincronia.js` al servidor con `GET /eventos/recibo?eje=…&id=…` → `{ instante, rele, firma, recibo }`. Hoy **no hay AARPIA ni relé real**: `servidor/sim/aarpia/` es una **simulación** (copia del commit d282161 de `InTheState/aarpia/transporte`, ver su `LEEME.md`), JavaScript puro, sin dependencias: **la misma API que las funciones `eventos` y `archivos`** (importa las de `servidor/supabase/funciones/`), con un relé Nostr en memoria por debajo (cada evento viaja como un kind 7700; el recibo, un 7701 firmado por el relé) y un Blossom en memoria para los archivos (cifrados antes de subir). Pruebas: `test/sim-aarpia.test.js`; la paridad con un evento real, `test/recibo.test.js`. Cuando exista AARPIA real se sustituye con la misma forma.

```sh
node servidor/sim/aarpia/servidor.mjs                    # http://127.0.0.1:8788/eventos, /eventos/recibo y /archivos  (--puerto, --secreto)
```

El sobre 7700 lo firma una clave de transporte del servicio, no el autor (la carta, por HTTP, no manda su clave privada). Un servidor **sin** `/eventos/recibo` (la función de Supabase de hoy) es válido: la sincronía lo detecta una vez por sesión y no vuelve a pedirlo. El servidor de prueba (`servidor/prueba/servidor.mjs`) sirve la ruta en memoria, con un relé y una firma falsos, para que `test/sincronia.test.js` la cubra.

## El sello de tiempo (simulación de StateArk)

El tercer reloj de cada registro (`X.6.8.2`, el bloque de Bitcoin que lo sella; `docs/CONTRATO.md` §4.4) lo pone `src/sello.js`, que no importa ninguna simulación (TOK-74): la recibe inyectada (`selloCon`), y `servidor/sim/sello-agram.js` (`selloSimulado`) se la da. Hoy **no hay Bitcoin ni StateArk**: `servidor/sim/stateark/` es una **simulación** (copia del commit ddcc475 de `InTheState/stateark/sim`, ver su `LEEME.md`: el sello **ancla por Taproot** (VG 13-11): una transacción de anclaje con forma de Bitcoin cuya salida P2TR compromete los lotes como hojas `OP_RETURN <raíz>` de su árbol Taproot, con la cabecera de su bloque firmada por el observador; además del §3 trae §5 pagos, con transacciones serializadas como Bitcoin y el recibo único «pago» (`reciboPago`), §6 custodia y §8 candado, que solo están copiados y probados, la carta no los usa), JavaScript puro, sin dependencias, con las pruebas en `test/sim-stateark*.test.js`. Lo que la simulación da lo comprueban las reglas de la época «sealed» (el sello copiado en `X.6.8.2`) y «paid» (el recibo de pago copiado en `X.6.8.3` con `eje.marcarPago`), `docs/CONTRATO.md` §4.4. Cuando exista StateArk real se sustituye con la misma forma (`sellar`, `prueba`, `verificar`).

```sh
node servidor/sim/stateark/servidor.js 8787 600000      # un servicio de sello local; un bloque cada 10 min (sin el segundo número, solo POST /minar)
```

`POST /sellar` `{ ids }`, `GET /prueba/:id` (202 si pendiente, 404 si nunca se selló), `POST /verificar` `{ id, prueba }` y `POST /minar` (solo en la simulación). Escucha solo en 127.0.0.1, con CORS abierto. Por el servicio **solo pasan ids** (SHA-256 del cuerpo), nunca eventos. La carta lo usa si la configuración trae «seal url» (ajustes del exterior, ver abajo y el §16.2 bis del contrato); en Node, `sello.crearSello()` sin url usa la simulación en memoria.

## Elegir Supabase o la simulación

Es solo configuración de la cuenta (`docs/CONTRATO.md` §16.2 bis, decisión #58 de VG): ni la carta ni el núcleo cambian. En «configuración» hay dos sitios:

- **Servidor y eje compartido** («preferences»): `sync url` y `sync ledger` (y la clave de lectura, aparte). Es **Supabase** (o el servidor de prueba, que habla lo mismo): los eventos, los archivos y la guía van ahí. Con solo esto la carta es la de siempre: solo el reloj 6.8.0.
- **Ajustes del exterior** («exterior settings», desplegable debajo de los de la guía): `relay url` (transporte: eventos y recibo, 6.8.1), `blossom url` (archivos) y `seal url` (sello, 6.8.2). Cada una que esté **manda sobre `sync url` para lo suyo**; el nombre del eje y la clave de lectura son los mismos. Sin url, nada va por ese camino (sin `seal url`, nada se sella). Además `guide url` (la guía por la pasarela de AARPIA, en vez de la función de Supabase), `observer keys` y `confirmations` (las claves del observador y cuántas confirmaciones hacen «en firme»; se leen de la cuenta raíz del eje, `docs/CONTRATO.md` §4.4 y §16.2 bis). Sin `guide url`, la guía sigue en `sync url`.

Para probar con la simulación:

```sh
node servidor/sim/aarpia/servidor.mjs                  # http://127.0.0.1:8788  (eventos, recibo y archivos)
node servidor/sim/stateark/servidor.js 8787 600000     # http://127.0.0.1:8787  (sello; un bloque cada 10 min)
```

y en los ajustes del exterior: `relay url` y `blossom url` = `http://127.0.0.1:8788`, `seal url` = `http://127.0.0.1:8787` (más el eje compartido: `sync ledger`, y su clave de lectura, que se crea con `POST /eventos/ejes` en el servicio simulado, cabecera `X-Crear-Ejes: prueba`). Los registros siguen siendo los mismos (ids, cuerpos, orden); la simulación añade el recibo del relé y el bloque simulado, y el registro sale «verificado» (`contrato.verificado`). Para volver a Supabase, vaciar las tres url (dejar el campo vacío: el ajuste deja de escribirse, VG 13-11, #77). `test/paridad-exterior.test.js` hace la misma secuencia (crear la cuenta, escribir, adjuntar, sincronizar, bajar en otro dispositivo) por los dos y comprueba que cambia solo lo que debe.

## La guía del PV9 (función `guia`)

La carta tiene una guía de solo lectura en el PV9 que pregunta a Claude con el contexto de la pantalla (`docs/CONTRATO.md` §16). Su vía preferida es esta función, hermana de `eventos`: la clave de Anthropic vive en el servidor, nunca en el navegador ni en el repositorio.

1. **Los secretos.** `supabase secrets set ANTHROPIC_API_KEY=<la clave de la API de Anthropic>` (guardarla también en `PROD/ikisai-apps/private/`, nunca en el repositorio). `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` las inyecta Supabase (la función lee con ellas la tabla `ejes` para comprobar la clave de lectura).
2. **Desplegar.** `supabase functions deploy guia --no-verify-jwt` desde una carpeta con `supabase/functions/guia/` que contenga `index.ts` y `api.js` (copiar los dos de `servidor/supabase/funciones/guia/`; es autónoma, no importa nada de `eventos`). `--no-verify-jwt`: la función lleva su propia autorización, la clave de lectura del eje (`X-Clave-Lectura`), la misma del libro compartido.
3. **Probarla.**
```sh
curl -s -X POST https://<ref>.supabase.co/functions/v1/guia \
  -H "X-Clave-Lectura: $CLAVE" -H "Content-Type: application/json" \
  -d '{"eje":"vg","mensajes":[{"role":"user","content":"¿qué es AGRAM?"}],"contexto":"pantalla de prueba"}'
# → 200 {"texto":"…","uso":{"entrada":…,"salida":…}}; sin la cabecera → 401; eje que no existe → 401 (igual que la clave mala, #106);
#   contexto de más de 8 000 caracteres → 413; más de 30 preguntas por minuto en el eje → 429.
```
4. **La carta.** Sin cambios: la guía usa el mismo `sync url`, `sync ledger` y clave de lectura del libro compartido; los ajustes de la guía (modelo, vía `server`, historial, tope del contexto) están en «configuración». Con el servidor de prueba (`servidor/prueba/servidor.mjs`), `/guia` responde con un eco fijo, sin llamar a nadie.

Mientras no haya servidor, la guía tiene una vía **directa** (provisional): la clave de Anthropic se pega en «configuración» y vive solo en ese navegador (`agram.ia.<alta>`, fuera del eje y de la copia de seguridad).

## Los archivos adjuntos (función `archivos`)

La representación HTML del PV0 y la acción «adjuntar un archivo» (issues #21, #22; `docs/CONTRATO.md` §2.1). Los archivos van a un **bucket privado** de Supabase Storage, `agram-archivos`, bajo `<eje>/<sha256>`; el registro guarda solo `archivo:<sha256>`. La función comprueba la clave de lectura del eje (la tabla `ejes`, la misma del libro compartido) y entra al bucket con el rol de servicio; nadie más llega a él.

1. **El bucket.** Pegar `migraciones/0002_archivos.sql` en el editor SQL (o `supabase db push` con ella en `supabase/migrations/`): crea `agram-archivos` privado, con tope de 2 MB y los cinco tipos admitidos; es idempotente. Por el panel es lo mismo: Storage → New bucket → `agram-archivos`, Public **desactivado**, límite 2 MB, tipos `text/html, image/png, image/jpeg, image/svg+xml, application/json`. **Sin políticas** en `storage.objects` para `anon` ni `authenticated`.
2. **Desplegar.** `supabase functions deploy archivos --no-verify-jwt` desde una carpeta con `supabase/functions/archivos/` que contenga `index.ts` y `api.js` (copiar los dos de `servidor/supabase/funciones/archivos/`; es autónoma). `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` las inyecta Supabase; no hace falta ningún secreto más.
3. **Probarla.**
```sh
curl -s -X POST "https://<ref>.supabase.co/functions/v1/archivos?eje=vg" \
  -H "X-Clave-Lectura: $CLAVE" -H "Content-Type: text/html" --data-binary @arte-agram/agram.html
# → 201 {"id":"<sha256>","tipo":"text/html","bytes":…}; otra vez → 200 (idempotente);
#   sin la cabecera → 401; otro tipo → 415; más de 2 MB → 413
curl -s -D - "https://<ref>.supabase.co/functions/v1/archivos/<sha256>?eje=vg" -H "X-Clave-Lectura: $CLAVE" -o /dev/null
# → 200 con Content-Type text/html, Content-Disposition: inline, Content-Security-Policy: sandbox; …, nosniff
```
4. **La carta.** Sin cambios: usa el mismo `sync url`, `sync ledger` y clave de lectura de la cuenta. Supabase Storage puede guardar el HTML como `text/plain`: la función sirve el tipo por el contenido (`tipoPorContenido`). CORS: los mismos orígenes que `eventos` (`ORIGENES` en `api.js`).

Con el servidor de prueba (`servidor/prueba/servidor.mjs`), `/archivos` y `/archivos/<id>` responden igual, con los archivos en memoria (no van al `--archivo` JSON).

## Servir la carta desde el nodo (y el `sitio.json`)

La carta es estática (`index.html` + `carta/` + `src/` + `datos/` + `antigua/` + `ejemplos/` + `arte/`, lo mismo que GitHub Pages sirve de la raíz del repositorio): un nodo propio (`https://aarpia.ikisai.com`) puede servirla junto a la API de `eventos`. Se sirve **lo que sirve la raíz salvo lo que no es la web**; es la misma lista de exclusión que usa `beta/publicar.mjs` (`EXCLUIR`): `.git`, `node_modules`, `test`, `bench`, `.github`, `servidor`, `beta`, `.playwright-mcp`, `.wrangler`. Con `servidor/` fuera, los secretos y las funciones no se publican.

**`sitio.json`** (opcional, `docs/CONTRATO.md` §16.2 ter): en la raíz de lo que se sirve, junto a `index.html`, con los defectos de esa casa:

```sh
cp sitio.ejemplo.json sitio.json     # y editar: "sync url", "sync ledger", "guide url" (solo ajustes; NUNCA una clave)
```

- Está en `.gitignore`: no va al repositorio (solo `sitio.ejemplo.json`). Como `beta/publicar.mjs` copia la raíz **del disco**, un `sitio.json` que haya en la carpeta desde la que se publica **sí** se publica con la beta (no está en `EXCLUIR`, a propósito: es lo que la hace apuntar al nodo). El de `sitio.ejemplo.json` también viaja, es inocuo.
- Cada cuenta **nueva** nace con esos ajustes; la configuración (el 9) los enseña a quien no tiene el suyo. La **clave de lectura** la mete cada persona en su navegador: si el `sitio.json` trae una, se ignora y la consola avisa.
- `sw.js` sirve primero lo que tiene en caché y refresca detrás: tras cambiar `sitio.json`, la primera carga puede enseñar el anterior y la siguiente el nuevo (la beta no cachea: `_headers` y un `sw.js` que se da de baja).
- Servirlo con `Cache-Control: no-cache` y con el tipo `application/json`; si falta el archivo, la carta sigue como siempre.

## Lo que queda para desplegar

- Crear el proyecto Supabase (VG) y guardar sus credenciales en `PROD/ikisai-apps/private/`.
- Pasar la migración y desplegar la función (pasos 2 a 4). Probarla a mano (`funciones/eventos/LEEME.md`).
- Crear el eje de VG y repartir su clave de lectura a sus dispositivos.
- Configurar la carta en cada dispositivo («Configurar la carta tras desplegar», arriba). La carta ya está enganchada (`docs/CONTRATO.md` §15.8).
- Para la guía: `supabase secrets set ANTHROPIC_API_KEY=…` y desplegar `guia` («La guía del PV9», arriba).
- Para los archivos adjuntos: pasar `0002_archivos.sql` (el bucket privado) y desplegar `archivos` («Los archivos adjuntos», arriba).
