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
5. **CORS.** La función admite `https://agram.ikisai.com` y `http://localhost:*` (`ORIGENES` en `api.js`). Otro origen (una vista previa) se añade ahí y se vuelve a desplegar.

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

## La guía del PV9 (función `guia`)

La carta tiene una guía de solo lectura en el PV9 que pregunta a Claude con el contexto de la pantalla (`docs/CONTRATO.md` §16). Su vía preferida es esta función, hermana de `eventos`: la clave de Anthropic vive en el servidor, nunca en el navegador ni en el repositorio.

1. **Los secretos.** `supabase secrets set ANTHROPIC_API_KEY=<la clave de la API de Anthropic>` (guardarla también en `PROD/ikisai-apps/private/`, nunca en el repositorio). `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` las inyecta Supabase (la función lee con ellas la tabla `ejes` para comprobar la clave de lectura).
2. **Desplegar.** `supabase functions deploy guia --no-verify-jwt` desde una carpeta con `supabase/functions/guia/` que contenga `index.ts` y `api.js` (copiar los dos de `servidor/supabase/funciones/guia/`; es autónoma, no importa nada de `eventos`). `--no-verify-jwt`: la función lleva su propia autorización, la clave de lectura del eje (`X-Clave-Lectura`), la misma del libro compartido.
3. **Probarla.**
```sh
curl -s -X POST https://<ref>.supabase.co/functions/v1/guia \
  -H "X-Clave-Lectura: $CLAVE" -H "Content-Type: application/json" \
  -d '{"eje":"vg","mensajes":[{"role":"user","content":"¿qué es AGRAM?"}],"contexto":"pantalla de prueba"}'
# → 200 {"texto":"…","uso":{"entrada":…,"salida":…}}; sin la cabecera → 401; eje que no existe → 404;
#   contexto de más de 8 000 caracteres → 413; más de 30 preguntas por minuto en el eje → 429.
```
4. **La carta.** Sin cambios: la guía usa el mismo `sync url`, `sync ledger` y clave de lectura del libro compartido; los ajustes de la guía (modelo, vía `server`, historial, tope del contexto) están en «configuración». Con el servidor de prueba (`servidor/prueba/servidor.mjs`), `/guia` responde con un eco fijo, sin llamar a nadie.

Mientras no haya servidor, la guía tiene una vía **directa** (provisional): la clave de Anthropic se pega en «configuración» y vive solo en ese navegador (`agram.ia.<alta>`, fuera del eje y de la copia de seguridad).

## Lo que queda para desplegar

- Crear el proyecto Supabase (VG) y guardar sus credenciales en `PROD/ikisai-apps/private/`.
- Pasar la migración y desplegar la función (pasos 2 a 4). Probarla a mano (`funciones/eventos/LEEME.md`).
- Crear el eje de VG y repartir su clave de lectura a sus dispositivos.
- Configurar la carta en cada dispositivo («Configurar la carta tras desplegar», arriba). La carta ya está enganchada (`docs/CONTRATO.md` §15.8).
- Para la guía: `supabase secrets set ANTHROPIC_API_KEY=…` y desplegar `guia` («La guía del PV9», arriba).
