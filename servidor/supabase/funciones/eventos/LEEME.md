# La función `eventos`: cómo probarla a mano

La función de borde (`index.ts`, Deno) no corre en CI: no hay Deno allí. Lo que sí corre es la **paridad**: `test/paridad-funcion.test.js` comprueba que `verificar.js` (hash, copia normalizada y firma, sin el núcleo) decide lo mismo que `src/evento.js` y `src/autoridad.js` caso a caso, y que el contrato entero (`api.js`, el mismo módulo que sirve `index.ts`) da las mismas respuestas con las dos criptografías. `index.ts` solo añade el almacén sobre PostgREST y `Deno.serve`.

Por qué JavaScript y no TypeScript para `verificar.js` y `api.js`: Deno los importa tal cual desde `index.ts`, y Node los importa en las pruebas sin transpilar ni dependencias (Node 22, el de CI, no quita tipos por defecto en todas sus versiones). Es la limitación que pedía documentar el encargo: la lógica compartida va en `.js` con comentarios, no en `.ts`.

## Con la CLI de Supabase, en local

```sh
supabase start                                  # Postgres + PostgREST + funciones en local (Docker)
supabase db reset                               # aplica supabase/migrations/ (copiar ahí 0001_eventos.sql)
supabase functions serve eventos --no-verify-jwt --env-file .env.local
```

`.env.local` (fuera del repositorio) con `AGRAM_CREAR_EJES=prueba`; `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` las pone `supabase start` (las imprime). La función queda en `http://127.0.0.1:54321/functions/v1/eventos`.

## Las peticiones

```sh
BASE=http://127.0.0.1:54321/functions/v1
# 1. Crear un eje (una vez; la clave de lectura solo se ve aquí).
curl -s -X POST $BASE/eventos/ejes -H "X-Crear-Ejes: prueba" -H "Content-Type: application/json" -d '{"eje":"vg"}'
# 2. El génesis firmado (sacarlo de un eje local: serializar(eje).eventos[0]).
curl -s -X POST $BASE/eventos -H "X-Clave-Lectura: $CLAVE" -H "Content-Type: application/json" -d '{"eje":"vg","evento":'"$(cat genesis.json)"'}'
# → 201 {"orden":1,"recibido":"…"}; repetirlo → 200 {"orden":1,"recibido":"…","duplicado":true}
# 3. Bajar.
curl -s "$BASE/eventos?eje=vg&desde=0" -H "X-Clave-Lectura: $CLAVE"
# Sin la cabecera → 401; un eje que no existe → 401 igual que la clave mala (no se revela qué ejes hay, #106); un evento con la firma tocada → 400; un autor sin alta → 403.
```

Un génesis y unos eventos firmados para pegar se obtienen con el núcleo:

```sh
node --input-type=module -e '
import { Eje } from "./src/eje.js"; import { generarClaves } from "./src/autoridad.js"; import { serializar } from "./src/persistencia.js";
const c = await generarClaves();
const eje = await Eje.genesis({ identidad: "vg", foco: ["mi eje"], t: new Date().toISOString(), clave: c.publica, privada: c.privada, exigirFirmas: true });
await eje.escribir({ autor: "vg", sobre: eje.genesisId, t: new Date().toISOString(), movimientos: [{ token: "T", escala: "minuto", cantidad: 1, de: "vg", a: null }], payload: ["hola"] }, c.privada);
console.log(JSON.stringify(serializar(eje).eventos));'
```

## Lo mismo sin Supabase

`node servidor/prueba/servidor.mjs --puerto 8787 --secreto prueba` sirve el mismo contrato (`BASE=http://127.0.0.1:8787`), y `test/servidor-prueba.test.js` lo recorre entero.

## Qué comprueba la función de un evento (y qué no)

Comprueba: que el cuerpo es `{ eje, evento }`, el eje existe y la clave de lectura es la suya; el evento tiene forma (autor, id hexadecimal, firma BIP-340 en hex de 64 bytes, firmante = autor, `sobre`, `en`, `contexto`, `posesion`); el id es el hash SHA-256 del cuerpo canónico; si el eje está vacío, que sea un génesis con la clave de su autor en `contexto.claves` y firmado con ella; si no, que no sea un génesis y que la firma verifique con la clave del **alta** del autor (el primer evento guardado del eje que la declara en `contexto.claves`); el tope de 256 KB y 60 escrituras por minuto por eje. Lo guarda con su orden de llegada y la hora del servidor.

No comprueba: movimientos, payload BTML, el instante `t`, las pruebas de posesión ni ninguna regla de la época. Eso lo valida cada cliente con `eje.anadir` al bajar; lo que no pasa va a `rechazados` del cliente (`src/sincronia.js`).
