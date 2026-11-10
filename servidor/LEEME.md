# El libro compartido: el servidor

Etapa 3 del roadmap (`MUELA/equipo/agram/ROADMAP_MVP.md`; mapa §17 [D], VG): un único eje accesible desde el móvil y el ordenador. El servidor es mínimo y de **solo añadir**: guarda eventos firmados, los ordena por llegada y da la hora; **no valida reglas** (eso lo hace cada cliente con el núcleo, `src/sincronia.js`). El eje es **privado con clave de lectura**; se escribe solo con eventos **firmados por una identidad con alta en el eje**.

**Nada está desplegado.** El proyecto Supabase de AGRAM aún no existe; lo que hay aquí es código listo para desplegar y probado contra el servidor de prueba local (`servidor/prueba/servidor.mjs`), que sirve el mismo contrato. El contrato entero: `docs/CONTRATO.md` §13.

```
servidor/
  supabase/
    migraciones/0001_eventos.sql     las tablas `ejes` y `eventos` (solo añadir, RLS, disparador contra UPDATE/DELETE)
    funciones/eventos/index.ts       la función de borde (Deno): el contrato sobre PostgREST, por fetch, sin dependencias
    funciones/eventos/api.js         el contrato como (Request) → Response; lo comparten la función y el servidor de prueba
    funciones/eventos/verificar.js   hash y firma reimplementados sin el núcleo (la paridad la comprueba test/paridad-funcion.test.js)
    funciones/eventos/LEEME.md       cómo probar la función a mano
  prueba/
    servidor.mjs                     el mismo contrato en Node (node:http), en memoria o en un JSON; para pruebas y desarrollo
    cripto-nucleo.mjs                la comprobación del servidor hecha con src/evento.js y src/autoridad.js
```

## Desplegar en un proyecto Supabase nuevo

Lo hace VG, o Core con VG delante. Ningún valor de credenciales entra en este repositorio (es público).

1. **Crear el proyecto.** En la cuenta de Supabase de Ikisai (la misma de Ikisai Apps), un proyecto **aparte** para AGRAM (plan gratuito), para no tocar producción. Región: la de Ikisai Apps. Guardar la URL del proyecto, la clave anónima y la **clave de servicio** en `PROD/ikisai-apps/private/` (junto a `cloud-credentials.json`, por ejemplo como `agram-supabase.json`), **nunca en el repositorio**.
2. **Las tablas.** O bien con la CLI (`supabase link --project-ref <ref>` desde una carpeta con `supabase/migrations/` que contenga `0001_eventos.sql`, y `supabase db push`), o bien pegando `migraciones/0001_eventos.sql` tal cual en el editor SQL del panel. Es idempotente (`if not exists`, `drop trigger if exists`).
3. **La función.** `supabase functions deploy eventos --no-verify-jwt` desde una carpeta con `supabase/functions/eventos/` que contenga `index.ts`, `api.js` y `verificar.js` (copiar los tres archivos de `servidor/supabase/funciones/eventos/`). `--no-verify-jwt` porque la función lleva su propia autorización (la clave de lectura del eje y las firmas de los eventos): así la carta no necesita la clave anónima. `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` las inyecta Supabase en toda función.
4. **Variables de entorno.** Opcional: `supabase secrets set AGRAM_CREAR_EJES=<un secreto largo al azar>` para crear ejes con la cabecera `X-Crear-Ejes` sin manejar la clave de servicio desde fuera. Sin ella, crear ejes solo vale con `Authorization: Bearer <clave de servicio>`. Guardar el secreto en la misma carpeta privada.
5. **CORS.** La función admite `https://agram.ikisai.com` y `http://localhost:*` (`ORIGENES` en `api.js`). Otro origen (una vista previa) se añade ahí y se vuelve a desplegar.

## Crear el primer eje y obtener su clave de lectura

```sh
curl -X POST https://<ref>.supabase.co/functions/v1/eventos/ejes \
  -H "X-Crear-Ejes: $AGRAM_CREAR_EJES" -H "Content-Type: application/json" \
  -d '{"eje":"vg"}'
# → 201 {"eje":"vg","claveLectura":"<43 caracteres base64url>","creado":"2026-…"}
```

La clave de lectura se devuelve **una sola vez**: el servidor guarda solo su hash SHA-256. Se guarda en `PROD/ikisai-apps/private/` y se da a cada dispositivo de VG (la carta la guarda en `localStorage` por cuenta; `carta/sincronia-ui.md`). Si se pierde, se crea otro eje y se vuelven a subir los eventos (son los mismos: el servidor es idempotente por id).

La URL que va en la configuración de la carta (`sync url`) es la base de la función: `https://<ref>.supabase.co/functions/v1`; el nombre del eje (`sync ledger`), `vg`. Las rutas cuelgan de ahí: `POST …/functions/v1/eventos`, `GET …/functions/v1/eventos?eje=vg&desde=0`, `POST …/functions/v1/eventos/ejes`.

## El servidor de prueba

```sh
node servidor/prueba/servidor.mjs --puerto 8787 --secreto prueba            # en memoria
node servidor/prueba/servidor.mjs --puerto 8787 --archivo /tmp/libro.json    # persiste en un JSON
```

El mismo contrato en `http://127.0.0.1:8787` (`POST /ejes` con `X-Crear-Ejes: prueba`, `POST /eventos`, `GET /eventos`), sin Supabase. Diferencias con la función de Deno: **ninguna de contrato**. Cambian el almacén (memoria o JSON en vez de PostgREST), la criptografía (el núcleo, en vez de `verificar.js`; `test/paridad-funcion.test.js` comprueba que deciden lo mismo), que `POST /ejes` se autoriza con `--secreto`/`AGRAM_CREAR_EJES` (no hay clave de servicio) y que, además de `/eventos/ejes`, responde en `/ejes`. Las pruebas lo arrancan en un puerto libre: `test/servidor-prueba.test.js` (el contrato), `test/sincronia.test.js` (el cliente).

## Lo que queda para desplegar

- Crear el proyecto Supabase (VG) y guardar sus credenciales en `PROD/ikisai-apps/private/`.
- Pasar la migración y desplegar la función (pasos 2 a 4). Probarla a mano (`funciones/eventos/LEEME.md`).
- Crear el eje de VG y repartir su clave de lectura a sus dispositivos.
- Enganchar la carta (`carta/sincronia-ui.md`): una PR posterior, porque `carta/` lo está tocando la etapa 2 (mi cuenta).
